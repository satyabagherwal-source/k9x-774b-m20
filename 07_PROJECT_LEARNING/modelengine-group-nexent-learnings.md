# Forensic Learning Record (Deep Inspection): ModelEngine-Group/nexent

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelengine-group-nexent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ModelEngine-Group/nexent](https://github.com/ModelEngine-Group/nexent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:00:20.995Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ModelEngine-Group/nexent`
- **Description**: Nexent is a zero-code platform for auto-generating production-grade AI agents using Harness Engineering principles — unified tools, skills, memory, and orchestration with built-in constraints, feedback loops, and control planes.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5895 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/apps/permission_utils.py`
```
from http import HTTPStatus

from fastapi import HTTPException

from management.services.knowledge_base.service import ElasticSearchService


def require_knowledge_base_edit_permission(index_name: str, user_id: str, tenant_id: str) -> None:
    try:
        ElasticSearchService.require_knowledge_base_edit_permission(
            index_name=index_name,
            user_id=user_id,
            tenant_id=tenant_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=str(exc))


def require_knowledge_base_read_permission(index_name: str, user_id: str, tenant_id: str) -> None:
    """FastAPI adapter: raise 404 if KB is missing, 403 if the user cannot read it."""
    try:
        ElasticSearchService.require_knowledge_base_read_permission(
            index_name=index_name,
            user_id=user_id,
            tenant_id=tenant_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=str(exc))

```

### Core Architecture Module: `backend/data_process/utils.py`
```
"""
Utility functions for Celery tasks
"""
import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional

import redis
from celery.result import AsyncResult

from .app import app as celery_app

logger = logging.getLogger("data_process.utils")


def _parse_failure_info(info: Any) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Parse Celery failure metadata as structured JSON or plain error text."""
    if isinstance(info, dict):
        return info, None
    if info is None:
        return None, None

    info_text = str(info).strip()
    if not info_text:
        return None, None

    try:
        parsed_info = json.loads(info_text)
    except (json.JSONDecodeError, TypeError):
        return None, info_text

    if isinstance(parsed_info, dict):
        return parsed_info, None
    return None, info_text


def get_all_task_ids_from_redis(redis_client: redis.Redis) -> List[str]:
    """
    Get all task IDs from Redis backend

    Returns:
        List of task IDs found in Redis
    """
    task_ids = []
    try:
        # Get all keys matching Celery result pattern
        for key in redis_client.scan_iter(
                match='celery-task-meta-*', count=500):
            if isinstance(key, bytes):
                key = key.decode('utf-8')

            # Extract task ID from key format: celery-task-meta-<task_id>
            if key.startswith('celery-task-meta-'):
                task_id = key.replace('celery-task-meta-', '')
                task_ids.append(task_id)

        logger.debug(f"Found {len(task_ids)} task IDs in Redis")
    except Exception as e:
        logger.warning(f"Failed to get task IDs from Redis: {str(e)}")

    return task_ids


async def get_task_info(task_id: str) -> Dict[str, Any]:
    """
    Get task status and metadata

    Args:
        task_id: Celery task ID

    Returns:
        Task status information
    """
    loop = asyncio.get_running_loop()

    def sync_get():
        result = AsyncResult(task_id, app=celery_app)

        # Get current time for updated_at if not available
        current_time = time.time()

        # Construct basic status information
        status_info = {
            'id': task_id,
            'index_name': '',
            'task_name': '',
            'path_or_url': '',
            'original_filename': '',
            'file_id': None,
            'status': result.status if result.status else 'PENDING',
            'created_at': current_time,
            'updated_at': current_time,
            'error': None
        }

        # Check if result backend is available
        backend_available = True
        try:
            status = result.status
            if status:
                status_info['status'] = status
        except AttributeError as e:
            if 'DisabledBackend' in str(e):
                logger.warning(
                    f"Result backend is disabled for task {task_id}: {str(e)}")
                backend_available = False
                status_info['error'] = "Result backend disabled - cannot retrieve task status"
            else:
                logger.warning(f"Backend error for task {task_id}: {str(e)}")
                backend_available = False
                status_info['error'] = f"Backend error: {str(e)}"
        except Exception as e:
            logger.warning(
                f"Error accessing task status for {task_id}: {str(e)}")
            backend_available = False
            status_info['error'] = f"Status access error: {str(e)}"

        # If backend is available, try to get metadata
        if backend_available:
            try:
                # Add metadata from task state
                if result.info:
                    if isinstance(result.info, dict):
                        # For successful tasks, the result may contain metadata
                        metadata = result.info

                        # Get task_name from metadata if available
                        if 'task_name' in metadata:
                            status_info['task_name'] = metadata['task_name']

                        # Add timestamps if available
                        if 'start_time' in metadata:
                            status_info['created_at'] = metadata['start_time']

                        # Extract index_name from metadata
                        if 'index_name' in metadata:
                            status_info['index_name'] = metadata['index_name']

                        if 'source' in metadata:
                            status_info['path_or_url'] = metadata['source']

                        if 'original_filename' in metadata:
                            status_info['original_filename'] = metadata['original_filename']

                        if 'file_id' in metadata:
                            status_info['file_id'] = metadata['file_id']
                        
                        # Get progress info from metadata
                        if 'total_chunks' in metadata:
                            status_info['total_chunks'] = metadata['total_chunks']
                        if 'processed_chunks' in metadata:
                            status_info['processed_chunks'] = metadata['processed_chunks']
                        
                        # Always try to get latest progress from Redis (real-time updates during vectorization)
                        # Redis progress takes precedence over metadata for active tasks
                        try:
                            from services.redis_service import get_redis_service
                            redis_service = get_redis_service()
                            progress_info = redis_service.get_progress_info(task_id)
                            if progress_info:
                                # Use Redis progress as primary source (updated in real-time)
                                status_info['processed_chunks'] = progress_info.get('processed_chunks', status_info.get('processed_chunks'))
                                status_info['total_chunks'] = progress_info.get('total_chunks', status_info.get('total_chunks'))
                        except Exception as e:
                            logger.debug(f"Failed to get progress from Redis for task {task_id}: {str(e)}")
                # Add error information for failed tasks
                if result.failed():
                    try:
                        error_json, plain_error = _parse_failure_info(
                            result.info)
                        if plain_error:
                            status_info['error'] = plain_error

                        if error_json:
                            if error_json.get('message') is not None:
                                status_info['error'] = error_json.get(
                                    'message')
                            if error_json.get('index_name') is not None:
                                status_info['index_name'] = error_json.get(
                                    'index_name')
                            if error_json.get('task_name') is not None:
                                status_info['task_name'] = error_json.get(
                                    'task_name')
                            if error_json.get('source') is not None:
                                status_info['path_or_url'] = error_json.get(
                                    'source')
                            if error_json.get('original_filename') is not None:
                                status_info['original_filename'] = error_json.get(
                                    'original_filename')
                            if error_json.get('file_id') is not None:
                                status_info['file_id'] = error_json.get('file_id')
                        elif not status_info['error']:
                            # fallback: compatible with previous format
                            status_info['error'] = str(
                                result.result) if result.result else "Unknown error"
                        if (
                            isinstance(result.result, dict)
                            and result.result.get('file_id') is not None
                        ):
                            status_info['file_id'] = result.result.get('file_id')
                    except Exception as e:
                        logger.warning(
                            f"Could not parse error info for task {task_id}, falling back. Error: {e}")
                        status_info['error'] = str(
                            result.result) if result.result else "Unknown error"
                    logger.debug(
                        f"Task {task_id} failed with error: {status_info['error']}")

                # Add result information for successful tasks
                if result.successful() and result.result:
                    if isinstance(result.result, dict):
                        # Include specific result fields that are useful for API
                        for key in [
                            'chunks_count',
                            'processing_time',
                            'storage_time',
                            'es_result',
                            'file_id',
                        ]:
                            if key in result.result:
                                status_info[key] = result.result[key]
            except Exception as e:
                logger.warning(
                    f"Error getting metadata for task {task_id}: {str(e)}")
                status_info['error'] = f"Metadata access error: {str(e)}"
        logger.debug(
            f"Task {task_id} status: {status_info['status']}, index: {status_info['index_name']}, task_name: {status_info['task_name']}")
        return status_info
    try:
        return await loop.run_in_executor(None, sync_get)
    except ValueError as e:
        if "Exception information must 
```

### Core Architecture Module: `backend/data_process/worker.py`
```
"""
Celery worker script for data processing tasks

This script is used to start Celery workers for processing data
and forwarding to vector storage.

Enhanced with worker initialization signal design pattern.

Usage:
    # Start a worker that handles both queues
    python worker.py

    # Start a worker for processing only (high concurrency)
    QUEUES=process_q WORKER_CONCURRENCY=8 python worker.py

    # Start a worker for forwarding only (lower concurrency)
    QUEUES=forward_q WORKER_CONCURRENCY=2 python worker.py
"""

import logging
import os
import sys
import time
import threading
import traceback

import ray
from celery.signals import (
    task_failure,
    task_postrun,
    task_prerun,
    worker_init,
    worker_process_init,
    worker_ready,
    worker_shutting_down,
)

from consts.const import (
    CELERY_TASK_TIME_LIMIT,
    CELERY_WORKER_PREFETCH_MULTIPLIER,
    ELASTICSEARCH_SERVICE,
    QUEUES,
    RAY_ADDRESS,
    RAY_preallocate_plasma,
    REDIS_URL,
    WORKER_CONCURRENCY,
    WORKER_NAME,
    DP_PART_PROCESSOR_COUNT,
)

from .app import app
from .ray_config import RayConfig

# Global worker state for monitoring and debugging
worker_state = {
    'initialized': False,
    'ready': False,
    'start_time': None,
    'process_id': None,
    'tasks_completed': 0,
    'tasks_failed': 0,
    'environment_validated': False,
    'services_validated': False
}

logger = logging.getLogger("data_process.worker")


# ============================================================================
# WORKER INITIALIZATION SIGNALS
# ============================================================================
@worker_init.connect
def setup_worker_environment(**kwargs):
    """
    Call when initializing worker environment
    This is the earliest initialization step - environment variables and basic configuration
    """
    start_time = time.time()
    worker_state['start_time'] = start_time
    worker_state['process_id'] = os.getpid()

    logger.info("="*60)
    logger.info("🚀 Celery Worker initialization started")
    logger.info(f"Process ID: {os.getpid()}")
    logger.info("="*60)

    try:
        # Disable verbose Celery task success logging
        logging.getLogger('celery.worker.strategy').setLevel(logging.WARNING)

        # Initialize Ray - connect to existing cluster
        if not ray.is_initialized():
            logger.info("🔮 Ray connecting to existing cluster...")

            # Get Ray address from environment
            ray_address = RAY_ADDRESS

            try:
                os.environ["RAY_preallocate_plasma"] = str(
                    RAY_preallocate_plasma).lower()

                # Initialize Ray using the centralized RayConfig helper
                if not RayConfig.init_ray_for_worker(ray_address):
                    logger.warning("Warning: fallback to direct ray.init")
                    # Fallback to direct ray.init if helper fails
                    ray.init(
                        address=ray_address,
                        ignore_reinit_error=True,
                    )

                logger.info(
                    f"✅ Ray connected to cluster at {ray_address} successfully.")

            except Exception as e:
                logger.error(f"❌ Failed to connect to Ray cluster: {str(e)}")
                logger.error(
                    "💡 Please make sure Ray cluster is started before workers!")
                logger.error(
                    "💡 You can start it via: python data_process_service.py")
                raise ConnectionError(
                    f"Cannot connect to Ray cluster: {str(e)}")

        # Check environment variables
        logger.info("🔍 Check sensitive variables")
        sensitive_vars = {
            'REDIS_URL': REDIS_URL,
            'ELASTICSEARCH_SERVICE': ELASTICSEARCH_SERVICE
        }

        for var_name, var_value in sensitive_vars.items():
            if var_value:
                logger.debug(f"  ✅ {var_name}: SET")
            else:
                logger.error(f"  ❌ {var_name}: NOT SET")

        worker_state['initialized'] = True
        elapsed = time.time() - start_time
        logger.debug(
            f"✅ Worker environment initialized (time: {elapsed:.2f} s)")

    except Exception as e:
        logger.error(f"❌ Worker environment initialization failed: {str(e)}")
        logger.error(f"Error details: {traceback.format_exc()}")
        # Do not exit here, let Celery handle the error
        raise


@worker_process_init.connect
def setup_worker_process_resources(**kwargs):
    """
    Call when initializing each worker process
    Suitable for initializing process-specific resources (e.g. database connection pool)
    """
    process_id = os.getpid()
    logger.info(f"⚙️ Initialize worker process {process_id}")

    try:
        # Celery prefork children need their own OTLP provider/exporter. Importing
        # monitoring here avoids inheriting a dead BatchSpanProcessor thread.
        try:
            from utils.monitoring import monitoring_manager

            logger.info(
                "Knowledge telemetry initialized in worker process: enabled=%s",
                monitoring_manager.is_enabled,
            )
        except Exception:
            logger.warning(
                "Knowledge telemetry initialization failed; worker will continue",
                exc_info=True,
            )

        # Initialize process-specific resources
        # e.g. database connection pool, cache client, etc.

        # Validate critical service connections
        logger.debug("🔍 Validate service connections")
        validate_service_connections()
        worker_state['services_validated'] = True
        logger.debug("✅ Service connections validated")

        # Initialize heavy objects like DataProcessCore
        logger.debug("⚙️ Initialize data processing components")
        # Here we can pre-initialize global objects to avoid delays on the first task

        logger.debug(f"✅ Worker process {process_id} initialized")

    except Exception as e:
        logger.error(
            f"❌ Worker process {process_id} initialization failed: {str(e)}")
        raise


@worker_ready.connect
def worker_ready_handler(**kwargs):
    """
    Call when worker is fully ready
    Suitable for registering services, starting monitoring, etc.
    """
    process_id = os.getpid()
    start_time = worker_state.get('start_time')
    total_startup_time = time.time() - start_time if start_time else 0

    worker_state['ready'] = True

    logger.debug("✅ " + "="*50)
    logger.info("✅ Celery Worker is fully ready!")
    logger.debug(f"Process ID: {process_id}")
    logger.debug(f"Total startup time: {total_startup_time:.2f} s")
    logger.debug("✅ " + "="*50)

    # Display worker status summary
    logger.debug("📊 Worker status summary:")
    for key, value in worker_state.items():
        logger.debug(f"  {key}: {value}")

    # Register health check endpoints, start monitoring, etc.
    logger.debug("🔍 Worker is ready to receive tasks")

    # Prewarm Ray actors for process-related queues to reduce first-task latency.
    # IMPORTANT: run asynchronously so worker queue registration is never blocked.
    try:
        queue_set = {q.strip() for q in QUEUES.split(",") if q.strip()}
        if "process_q" in queue_set or "process_part_q" in queue_set:
            from data_process.tasks import prewarm_ray_actors

            # Prewarm a cluster-global shared actor pool once at startup.
            # Multiple workers may trigger this, but pool manager is idempotent.
            target = DP_PART_PROCESSOR_COUNT

            def _prewarm_in_background():
                try:
                    warmed = prewarm_ray_actors(target_size=target)
                    logger.info(
                        f"Prewarmed Ray actor pool in background, warmed_actors={warmed}, target={target}, queues={sorted(queue_set)}"
                    )
                except Exception as exc:
                    logger.warning(f"Background prewarm failed: {exc}")

            threading.Thread(target=_prewarm_in_background, daemon=True).start()
    except Exception as exc:
        logger.warning(f"Failed to schedule Ray actor prewarm on worker ready: {exc}")

    # Periodic concurrency + Ray CPU availability log for process_part_q.
    try:
        queue_set = {q.strip() for q in QUEUES.split(",") if q.strip()}
        if "process_part_q" in queue_set:
            def _log_part_concurrency():
                while True:
                    try:
                        inspector = app.control.inspect(timeout=1)
                        active = inspector.active() or {}
                        part_active = 0
                        for _, tasks in active.items():
                            for t in tasks or []:
                                if t.get("name") == "data_process.tasks.process_part":
                                    part_active += 1
                        try:
                            ray_available = ray.available_resources() if ray.is_initialized() else {}
                        except Exception:
                            ray_available = {}
                        avail_cpu = ray_available.get("CPU", 0.0)
                        logger.info(
                            f"[process_part] active={part_active}, ray_available_cpu={avail_cpu}"
                        )
                    except Exception as exc:
                        logger.debug(f"Failed to collect process_part concurrency stats: {exc}")
                    time.sleep(5)

            threading.Thread(target=_log_part_concurrency, daemon=True).start()
    except Exception as exc:
        logger.warning(f"
```

### Core Architecture Module: `backend/database/knowledge_file_lifecycle_db.py`
```
"""Database access for durable knowledge-base file lifecycle records."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

from sqlalchemy import and_, or_

from .client import as_dict, get_db_session
from .db_models import KnowledgeFileLifecycle


ACTIVE_STATUSES = (
    "UPLOADING",
    "UPLOADED",
    "PROCESSING",
    "FORWARDING",
    "FAILED",
    "COMPLETED",
)
HIDDEN_STATUSES = ("DELETE_REQUESTED", "DELETED")


def new_file_id() -> str:
    """Generate a stable, opaque file ID without exposing object paths."""
    return uuid4().hex


def create_file_record(
    *,
    file_id: Optional[str],
    tenant_id: str,
    knowledge_id: int,
    index_name: str,
    original_filename: str,
    bucket_name: Optional[str] = None,
    object_name: Optional[str] = None,
    file_size: Optional[int] = None,
    upload_owner_service: Optional[str] = None,
    status: str = "UPLOADING",
    stage: str = "UPLOAD",
    created_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Create one lifecycle record before upload; filename may later be made unique."""
    row = KnowledgeFileLifecycle(
        file_id=file_id or new_file_id(),
        tenant_id=str(tenant_id),
        knowledge_id=int(knowledge_id),
        index_name=index_name,
        original_filename=original_filename or "",
        bucket_name=bucket_name,
        object_name=object_name,
        file_size=file_size,
        upload_owner_service=upload_owner_service,
        status=status,
        stage=stage,
        created_by=created_by,
        updated_by=created_by,
    )
    with get_db_session() as session:
        session.add(row)
        session.flush()
        return as_dict(row)


def create_file_records(records: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Create a batch of lifecycle records in one transaction.

    The upload workflow must not persist a partial batch.  Keeping the whole
    insert in one session means a constraint or database failure rolls back
    every row before any object is written to MinIO.
    """
    rows = []
    for record in records:
        rows.append(
            KnowledgeFileLifecycle(
                file_id=record.get("file_id") or new_file_id(),
                tenant_id=str(record["tenant_id"]),
                knowledge_id=int(record["knowledge_id"]),
                index_name=record["index_name"],
                original_filename=record.get("original_filename") or "",
                bucket_name=record.get("bucket_name"),
                object_name=record.get("object_name"),
                file_size=record.get("file_size"),
                upload_owner_service=record.get("upload_owner_service"),
                status=record.get("status", "UPLOADING"),
                stage=record.get("stage", "UPLOAD"),
                created_by=record.get("created_by"),
                updated_by=record.get("updated_by", record.get("created_by")),
            )
        )

    if not rows:
        return []

    with get_db_session() as session:
        session.add_all(rows)
        session.flush()
        return [as_dict(row) for row in rows]


def get_file_record(
    *,
    file_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    index_name: Optional[str] = None,
    object_name: Optional[str] = None,
    include_hidden: bool = False,
) -> Optional[Dict[str, Any]]:
    """Find a lifecycle record by stable ID or legacy path identity."""
    if not file_id and not object_name:
        return None
    with get_db_session() as session:
        query = session.query(KnowledgeFileLifecycle)
        if file_id:
            query = query.filter(KnowledgeFileLifecycle.file_id == file_id)
        else:
            query = query.filter(KnowledgeFileLifecycle.object_name == object_name)
        if tenant_id is not None:
            query = query.filter(KnowledgeFileLifecycle.tenant_id == str(tenant_id))
        if index_name is not None:
            query = query.filter(KnowledgeFileLifecycle.index_name == index_name)
        if not include_hidden:
            query = query.filter(KnowledgeFileLifecycle.status.notin_(HIDDEN_STATUSES))
        row = query.order_by(KnowledgeFileLifecycle.update_time.desc()).first()
        return as_dict(row) if row is not None else None


def list_file_records(
    *,
    index_name: str,
    tenant_id: Optional[str] = None,
    include_hidden: bool = False,
) -> List[Dict[str, Any]]:
    """List lifecycle records for a knowledge base."""
    with get_db_session() as session:
        query = session.query(KnowledgeFileLifecycle).filter(
            KnowledgeFileLifecycle.index_name == index_name,
        )
        if tenant_id is not None:
            query = query.filter(KnowledgeFileLifecycle.tenant_id == str(tenant_id))
        if not include_hidden:
            query = query.filter(KnowledgeFileLifecycle.status.notin_(HIDDEN_STATUSES))
        return [as_dict(row) for row in query.order_by(KnowledgeFileLifecycle.create_time.asc()).all()]


def fail_interrupted_file_tasks() -> List[Dict[str, Any]]:
    """Fail ingestion stages that had actually started before worker restart.

    FORWARDING without a forward task ID is still queued behind a completed
    process task and is intentionally left for the existing Celery chain.
    """
    with get_db_session() as session:
        rows = (
            session.query(KnowledgeFileLifecycle)
            .filter(
                KnowledgeFileLifecycle.delete_flag == "N",
                or_(
                    KnowledgeFileLifecycle.status == "PROCESSING",
                    and_(
                        KnowledgeFileLifecycle.status == "FORWARDING",
                        KnowledgeFileLifecycle.forward_task_id.is_not(None),
                    ),
                ),
            )
            .with_for_update()
            .all()
        )
        recovered = []
        failed_at = datetime.utcnow()
        for row in rows:
            recovered.append(as_dict(row))
            row.status = "FAILED"
            row.error_code = "CONTAINER_RESTARTED"
            row.error_message = "Data-process service restarted before the task completed"
            row.error_stage = row.stage or (
                "FORWARD" if row.forward_task_id else "PROCESS"
            )
            row.failed_at = failed_at
            row.version = int(row.version or 0) + 1
        return recovered


def list_uploading_files_created_before(
    cutoff: datetime,
    upload_owner_service: str,
) -> List[Dict[str, Any]]:
    """Return old uploads owned by the service that is being restarted."""
    if not upload_owner_service:
        raise ValueError("upload_owner_service is required for upload recovery")

    with get_db_session() as session:
        rows = (
            session.query(KnowledgeFileLifecycle)
            .filter(
                KnowledgeFileLifecycle.status == "UPLOADING",
                KnowledgeFileLifecycle.delete_flag == "N",
                KnowledgeFileLifecycle.upload_owner_service == upload_owner_service,
                KnowledgeFileLifecycle.create_time < cutoff,
            )
            .order_by(KnowledgeFileLifecycle.create_time.asc())
            .all()
        )
        return [as_dict(row) for row in rows]


def transition_file_record(
    file_id: str,
    *,
    status: Optional[str] = None,
    stage: Optional[str] = None,
    expected_statuses: Optional[Iterable[str]] = None,
    expected_version: Optional[int] = None,
    updated_by: Optional[str] = None,
    **fields: Any,
) -> Optional[Dict[str, Any]]:
    """Apply an optimistic-lock lifecycle update, returning None on a stale update."""
    allowed_fields = {
        "bucket_name",
        "object_name",
        "original_filename",
        "file_size",
        "uploaded_at",
        "completed_at",
        "process_task_id",
        "forward_task_id",
        "parent_task_id",
        "processing_attempt",
        "error_code",
        "error_message",
        "error_stage",
        "failed_at",
        "deleted_at",
        "storage_object_id",
    }
    with get_db_session() as session:
        query = session.query(KnowledgeFileLifecycle).filter(
            KnowledgeFileLifecycle.file_id == file_id,
        )
        if expected_statuses:
            query = query.filter(KnowledgeFileLifecycle.status.in_(tuple(expected_statuses)))
        if expected_version is not None:
            query = query.filter(KnowledgeFileLifecycle.version == expected_version)
        row = query.with_for_update().first()
        if row is None:
            return None
        if status is not None:
            row.status = status
        if stage is not None:
            row.stage = stage
        for key, value in fields.items():
            if key in allowed_fields:
                setattr(row, key, value)
        if updated_by is not None:
            row.updated_by = updated_by
        row.version = int(row.version or 0) + 1
        session.flush()
        return as_dict(row)


def delete_file_record(
    file_id: str,
    *,
    expected_statuses: Optional[Iterable[str]] = None,
) -> bool:
    """Physically delete a lifecycle row, returning whether a row was removed.

    Deletion is idempotent: a concurrent request may remove the row first, in
    which case ``False`` is returned and the caller can treat it as already
    deleted.  Status filtering prevents a stale cleanup callback from
    deleting a newly active row that reuses an object identity.
    """
    with get_db_session() as session:
        query = session.query(KnowledgeFileLifecycle).filter(
            KnowledgeFileLifecycle.file_id == file_id,
        )
        if expected_statuses:
            query = query.filter(KnowledgeFileLifecycle.status.in_(tuple(expected_statuses)))
        return bool(query.delete(synchronize_session=False))


def delete_file_records_for_knowledge_base(
    *,
    index_name: s
```

### Core Architecture Module: `backend/database/utils.py`
```
from typing import Any, Dict


# Global tracking field management methods
def add_creation_tracking(data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    """
    Add creation tracking fields (created_by and updated_by)

    Args:
        data: Data dictionary to add fields to
        user_id: Current user ID

    Returns:
        Dict[str, Any]: Data dictionary with tracking fields added
    """
    data_copy = data.copy()
    data_copy["created_by"] = user_id
    data_copy["updated_by"] = user_id
    return data_copy


def add_update_tracking(data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    """
    Add update tracking field (updated_by)

    Args:
        data: Data dictionary to add field to
        user_id: Current user ID

    Returns:
        Dict[str, Any]: Data dictionary with tracking field added
    """
    data_copy = data.copy()
    data_copy["updated_by"] = user_id
    return data_copy

```

### Core Architecture Module: `backend/services/agent_automation/schedule_engine.py`
```
"""Compatibility adapter from API models to the SDK schedule engine."""

from datetime import datetime

from nexent.scheduler import (
    ScheduleSpec,
    compute_next_fire_at as compute_sdk_next_fire_at,
    is_valid_cron_expression as validate_sdk_cron_expression,
)

from .models import ScheduleTrigger


def is_valid_cron_expression(expression: str) -> bool:
    return validate_sdk_cron_expression(expression)


def compute_next_fire_at(
    trigger: ScheduleTrigger,
    after: datetime,
    fire_count: int,
) -> datetime | None:
    spec = ScheduleSpec(
        mode=trigger.mode,
        rule_type=trigger.rule_type,
        timezone=trigger.timezone,
        start_at=trigger.start_at,
        end_at=trigger.end_at,
        cron_expr=trigger.cron_expr,
        interval_seconds=trigger.interval_seconds,
        max_fire_count=trigger.max_fire_count,
    )
    return compute_sdk_next_fire_at(spec, after, fire_count)

```

### Core Architecture Module: `backend/services/providers/modelengine_provider.py`
```
import logging
from typing import Dict, List

import aiohttp

from consts.const import DEFAULT_LLM_MAX_TOKENS
from services.providers.base import (
    AbstractModelProvider,
    _classify_provider_error,
    _extract_capacity_hints_from_raw,
)

logger = logging.getLogger("model_provider")

MODEL_ENGINE_NORTH_PREFIX = "open/router/v1"


def _extract_capacity_hints(raw: Dict) -> Dict:
    return _extract_capacity_hints_from_raw(raw)


def get_model_engine_raw_url(model_engine_url: str) -> str:
    """
    Extract the raw base URL from a ModelEngine URL by stripping any API paths.

    Args:
        model_engine_url: Full ModelEngine URL potentially containing API paths

    Returns:
        Base URL without trailing paths
    """
    if not model_engine_url:
        return ""
    # Remove any trailing /open/router/v1 or similar paths to get base host
    raw_url = model_engine_url.split(
        "/open/")[0] if "/open/" in model_engine_url else model_engine_url
    # Remove trailing slash if present
    return raw_url.rstrip('/')


class ModelEngineProvider(AbstractModelProvider):
    """Concrete implementation for ModelEngine provider."""

    async def get_models(self, provider_config: Dict) -> List[Dict]:
        """
        Fetch models from ModelEngine API.

        Args:
            provider_config: Configuration dict containing model_type, base_url, and api_key

        Returns:
            List of models with canonical fields. Returns error dict if API call fails.
        """
        try:
            model_type: str = provider_config.get("model_type", "")
            host = provider_config.get("base_url")
            api_key = provider_config.get("api_key")
            model_engine_url = get_model_engine_raw_url(host)
            if not host or not api_key:
                logger.warning("ModelEngine host or api key not configured")
                return []

            headers = {"Authorization": f"Bearer {api_key}"}

            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30),
                connector=aiohttp.TCPConnector(ssl=False)
            ) as session:
                async with session.get(
                    f"{model_engine_url.rstrip('/')}/{MODEL_ENGINE_NORTH_PREFIX}/models",
                    headers=headers
                ) as response:
                    # Use centralized error classification
                    if response.status >= 400:
                        error_text = await response.text()
                        return _classify_provider_error(
                            "ModelEngine",
                            status_code=response.status,
                            error_message=error_text
                        )

                    data = await response.json()
                    all_models = data.get("data", [])
                    logger.info(
                        f"ModelEngine API returned {len(all_models)} models")

            # Type mapping from ModelEngine to internal types
            type_map = {
                "embed": "embedding",
                "chat": "llm",
                "asr": "vlm4",
                "tts": "tts",
                "rerank": "rerank",
                "multimodal": "vlm",
            }

            filtered_models = []
            for model in all_models:
                me_type = model.get("type", "")
                internal_type = type_map.get(me_type)

                # If model_type filter is provided, only include matching models
                if model_type and internal_type != model_type:
                    continue

                if internal_type:
                    cleaned_model = {
                        "id": model.get("id", ""),
                        "model_type": internal_type,
                        "model_tag": me_type,
                        "max_tokens": DEFAULT_LLM_MAX_TOKENS if internal_type in ("llm", "vlm") else 0,
                        "base_url": host,
                        "api_key": api_key,
                    }
                    cleaned_model.update(_extract_capacity_hints(model))
                    filtered_models.append(cleaned_model)

            return filtered_models
        except Exception as e:
            return _classify_provider_error("ModelEngine", exception=e)

```

### Core Architecture Module: `backend/services/runtime_state_service.py`
```
import hashlib
import logging
import socket
import time
from typing import Any, Dict, List, Optional, Tuple

from nexent.core.concurrency import ManagedTaskSpec, ThreadManager

try:
    import redis
except ImportError:
    redis = None

from consts.const import (
    RUNTIME_CANCEL_TTL_SECONDS,
    RUNTIME_COMPLETED_TTL_SECONDS,
    RUNTIME_RUN_TTL_SECONDS,
    RUNTIME_STATE_REDIS_URL,
    RUNTIME_STREAM_MAX_LEN,
    RUNTIME_STREAM_TTL_SECONDS,
)

logger = logging.getLogger(__name__)


class RuntimeStateService:
    """Redis-backed short-lived state used by multi-replica runtime services."""

    def __init__(self):
        self._client: Optional[Any] = None
        self._pod_name = socket.gethostname()
        self._thread_manager: Optional[ThreadManager] = None

    def set_thread_manager(self, thread_manager: ThreadManager) -> None:
        """Inject the process-local manager used for blocking Redis calls."""
        self._thread_manager = thread_manager

    async def _run_managed(self, task_name: str, fn, *args, **kwargs):
        if self._thread_manager is None:
            return fn(*args, **kwargs)
        return await self._thread_manager.run(
            "control-io",
            ManagedTaskSpec(
                task_name=task_name,
                owner="services.runtime_state_service",
            ),
            fn,
            *args,
            **kwargs,
        )

    @property
    def enabled(self) -> bool:
        return bool(RUNTIME_STATE_REDIS_URL)

    @property
    def client(self) -> Any:
        if not RUNTIME_STATE_REDIS_URL:
            raise ValueError("RUNTIME_STATE_REDIS_URL or REDIS_URL environment variable is not set")
        if redis is None:
            raise ValueError("redis package is not installed")
        if self._client is None:
            self._client = redis.from_url(
                RUNTIME_STATE_REDIS_URL,
                socket_timeout=5,
                socket_connect_timeout=5,
                decode_responses=True,
            )
        return self._client

    def _run_key(self, user_id: str, conversation_id: int) -> str:
        return f"runtime:run:{user_id}:{conversation_id}"

    def _cancel_key(self, user_id: str, conversation_id: int) -> str:
        return f"runtime:cancel:{user_id}:{conversation_id}"

    def _stream_key(self, user_id: str, conversation_id: int) -> str:
        return f"runtime:stream:{user_id}:{conversation_id}"

    def _stream_done_key(self, user_id: str, conversation_id: int) -> str:
        return f"runtime:stream:done:{user_id}:{conversation_id}"

    def _idempotency_key(self, key: str) -> str:
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        return f"northbound:idempotency:{digest}"

    def _rate_key(self, tenant_id: str, minute_bucket: str) -> str:
        return f"northbound:rate:{tenant_id}:{minute_bucket}"

    def _expire_completed_runtime_keys(self, user_id: str, conversation_id: int) -> None:
        ttl = max(1, RUNTIME_COMPLETED_TTL_SECONDS)
        for key in (
            self._run_key(user_id, conversation_id),
            self._cancel_key(user_id, conversation_id),
            self._stream_key(user_id, conversation_id),
            self._stream_done_key(user_id, conversation_id),
        ):
            self.client.expire(key, ttl)

    def reset_stream(self, user_id: str, conversation_id: int) -> None:
        if not self.enabled:
            return
        try:
            self.client.delete(
                self._stream_key(user_id, conversation_id),
                self._stream_done_key(user_id, conversation_id),
            )
        except Exception as exc:
            logger.warning("Failed to reset runtime stream state: %s", exc)

    async def reset_stream_async(self, user_id: str, conversation_id: int) -> None:
        await self._run_managed("runtime-state-reset-stream", self.reset_stream, user_id, conversation_id)

    def register_run(self, user_id: str, conversation_id: int, message_id: Optional[int] = None) -> None:
        if not self.enabled:
            return
        try:
            now = str(int(time.time()))
            payload = {
                "owner_pod": self._pod_name,
                "status": "running",
                "started_at": now,
                "updated_at": now,
            }
            if message_id is not None:
                payload["message_id"] = str(message_id)
            key = self._run_key(user_id, conversation_id)
            self.client.hset(key, mapping=payload)
            self.client.expire(key, RUNTIME_RUN_TTL_SECONDS)
            self.client.delete(self._cancel_key(user_id, conversation_id))
        except Exception as exc:
            logger.warning("Failed to register runtime run state: %s", exc)

    def mark_run_finished(self, user_id: str, conversation_id: int, status: str) -> None:
        if not self.enabled:
            return
        try:
            key = self._run_key(user_id, conversation_id)
            self.client.hset(key, mapping={
                "status": status,
                "updated_at": str(int(time.time())),
            })
            self._expire_completed_runtime_keys(user_id, conversation_id)
        except Exception as exc:
            logger.warning("Failed to mark runtime run state as finished: %s", exc)

    def get_run_state(self, user_id: str, conversation_id: int) -> Dict[str, str]:
        if not self.enabled:
            return {}
        try:
            return self.client.hgetall(self._run_key(user_id, conversation_id)) or {}
        except Exception as exc:
            logger.warning("Failed to get runtime run state: %s", exc)
            return {}

    async def get_run_state_async(self, user_id: str, conversation_id: int) -> Dict[str, str]:
        return await self._run_managed("runtime-state-get-run", self.get_run_state, user_id, conversation_id)

    def set_cancel_signal(self, user_id: str, conversation_id: int) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.setex(self._cancel_key(user_id, conversation_id), RUNTIME_CANCEL_TTL_SECONDS, self._pod_name)
            return True
        except Exception as exc:
            logger.warning("Failed to set runtime cancel signal: %s", exc)
            return False

    def is_cancelled(self, user_id: str, conversation_id: int) -> bool:
        if not self.enabled:
            return False
        try:
            return bool(self.client.get(self._cancel_key(user_id, conversation_id)))
        except Exception as exc:
            logger.warning("Failed to read runtime cancel signal: %s", exc)
            return False

    async def is_cancelled_async(self, user_id: str, conversation_id: int) -> bool:
        return await self._run_managed("runtime-state-is-cancelled", self.is_cancelled, user_id, conversation_id)

    def append_stream_event(self, user_id: str, conversation_id: int, chunk: str) -> Optional[str]:
        if not self.enabled:
            return None
        try:
            stream_key = self._stream_key(user_id, conversation_id)
            event_id = self.client.xadd(
                stream_key,
                {"chunk": chunk},
                maxlen=RUNTIME_STREAM_MAX_LEN,
                approximate=True,
            )
            self.client.expire(stream_key, RUNTIME_STREAM_TTL_SECONDS)
            return event_id
        except Exception as exc:
            logger.warning("Failed to append runtime stream event: %s", exc)
            return None

    async def append_stream_event_async(self, user_id: str, conversation_id: int, chunk: str) -> Optional[str]:
        return await self._run_managed(
            "runtime-state-append-event",
            self.append_stream_event,
            user_id,
            conversation_id,
            chunk,
        )

    def mark_stream_completed(
        self,
        user_id: str,
        conversation_id: int,
        status: str,
        error: Optional[str] = None,
    ) -> None:
        if not self.enabled:
            return
        try:
            payload = {
                "status": status,
                "updated_at": str(int(time.time())),
            }
            if error:
                payload["error"] = error
            done_key = self._stream_done_key(user_id, conversation_id)
            self.client.hset(done_key, mapping=payload)
            self._expire_completed_runtime_keys(user_id, conversation_id)
        except Exception as exc:
            logger.warning("Failed to mark runtime stream completed: %s", exc)

    async def mark_stream_completed_async(
        self,
        user_id: str,
        conversation_id: int,
        status: str,
        error: Optional[str] = None,
    ) -> None:
        await self._run_managed(
            "runtime-state-mark-stream-completed",
            self.mark_stream_completed,
            user_id,
            conversation_id,
            status,
            error,
        )

    def get_stream_status(self, user_id: str, conversation_id: int) -> Dict[str, str]:
        if not self.enabled:
            return {}
        try:
            return self.client.hgetall(self._stream_done_key(user_id, conversation_id)) or {}
        except Exception as exc:
            logger.warning("Failed to get runtime stream status: %s", exc)
            return {}

    async def get_stream_status_async(self, user_id: str, conversation_id: int) -> Dict[str, str]:
        return await self._run_managed(
            "runtime-state-get-stream-status",
            self.get_stream_status,
            user_id,
            conversation_id,
        )

    def read_stream_events(
        self,
        user_id: str,
        conversation_id: int,
        after_id: Optional[str] = None,
    ) -> List[Tuple[str, str]]:
        if not self.enabled:
            return []
        try:
            min_id = "-" if after_id is None else f"({after_id}"
            events = self.client.xrange(self._stream_key(user_id, conversa
```

### Core Architecture Module: `backend/services/thread_lifecycle_service.py`
```
from nexent.core.concurrency import LanePolicy, ThreadManager

from consts.const import (
    NORTHBOUND_CONTROL_THREAD_MAX_QUEUE_SIZE,
    NORTHBOUND_CONTROL_THREAD_MAX_WORKERS,
    NORTHBOUND_THREAD_SHUTDOWN_GRACE_SECONDS,
    RUNTIME_AGENT_THREAD_CANCEL_GRACE_SECONDS,
    RUNTIME_AGENT_THREAD_MAX_QUEUE_SIZE,
    RUNTIME_AGENT_THREAD_MAX_WORKERS,
    RUNTIME_AGENT_THREAD_QUEUE_TIMEOUT_SECONDS,
    RUNTIME_MCP_CLOSE_TIMEOUT_SECONDS,
    RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
)


runtime_thread_manager = ThreadManager(
    service_name="runtime",
    lane_policies={
        "agent-run": LanePolicy(
            name="agent-run",
            max_workers=RUNTIME_AGENT_THREAD_MAX_WORKERS,
            max_queue_size=RUNTIME_AGENT_THREAD_MAX_QUEUE_SIZE,
            queue_timeout_seconds=RUNTIME_AGENT_THREAD_QUEUE_TIMEOUT_SECONDS,
            cancel_grace_seconds=RUNTIME_AGENT_THREAD_CANCEL_GRACE_SECONDS,
            shutdown_grace_seconds=RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
        "control-io": LanePolicy(
            name="control-io",
            max_workers=16,
            max_queue_size=32,
            queue_timeout_seconds=0,
            cancel_grace_seconds=2,
            shutdown_grace_seconds=RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
        "model-tool-io": LanePolicy(
            name="model-tool-io",
            max_workers=max(4, RUNTIME_AGENT_THREAD_MAX_WORKERS),
            max_queue_size=RUNTIME_AGENT_THREAD_MAX_QUEUE_SIZE,
            queue_timeout_seconds=0,
            cancel_grace_seconds=RUNTIME_AGENT_THREAD_CANCEL_GRACE_SECONDS,
            shutdown_grace_seconds=RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
        "mcp-session": LanePolicy(
            name="mcp-session",
            max_workers=RUNTIME_AGENT_THREAD_MAX_WORKERS,
            max_queue_size=0,
            queue_timeout_seconds=0,
            cancel_grace_seconds=RUNTIME_MCP_CLOSE_TIMEOUT_SECONDS,
            shutdown_grace_seconds=RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
        "sandbox": LanePolicy(
            name="sandbox",
            max_workers=200,
            max_queue_size=8,
            queue_timeout_seconds=0,
            cancel_grace_seconds=5,
            shutdown_grace_seconds=RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
        "background-service": LanePolicy(
            name="background-service",
            max_workers=12,
            max_queue_size=8,
            queue_timeout_seconds=0,
            cancel_grace_seconds=RUNTIME_AGENT_THREAD_CANCEL_GRACE_SECONDS,
            shutdown_grace_seconds=RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
        "evaluation": LanePolicy(
            name="evaluation",
            max_workers=6,
            max_queue_size=12,
            queue_timeout_seconds=0,
            cancel_grace_seconds=5,
            shutdown_grace_seconds=RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
    },
)


config_thread_manager = ThreadManager(
    service_name="config",
    lane_policies={
        "control-io": LanePolicy(
            name="control-io",
            max_workers=16,
            max_queue_size=32,
            queue_timeout_seconds=0,
            cancel_grace_seconds=2,
            shutdown_grace_seconds=RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
        "background-service": LanePolicy(
            name="background-service",
            max_workers=12,
            max_queue_size=8,
            queue_timeout_seconds=0,
            cancel_grace_seconds=5,
            shutdown_grace_seconds=RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
        "evaluation": LanePolicy(
            name="evaluation",
            max_workers=6,
            max_queue_size=12,
            queue_timeout_seconds=0,
            cancel_grace_seconds=5,
            shutdown_grace_seconds=RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
        "model-tool-io": LanePolicy(
            name="model-tool-io",
            max_workers=6,
            max_queue_size=16,
            queue_timeout_seconds=0,
            cancel_grace_seconds=5,
            shutdown_grace_seconds=RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
    },
)


northbound_thread_manager = ThreadManager(
    service_name="northbound",
    lane_policies={
        "control-io": LanePolicy(
            name="control-io",
            max_workers=NORTHBOUND_CONTROL_THREAD_MAX_WORKERS,
            max_queue_size=NORTHBOUND_CONTROL_THREAD_MAX_QUEUE_SIZE,
            queue_timeout_seconds=0,
            cancel_grace_seconds=2,
            shutdown_grace_seconds=NORTHBOUND_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
        "background-service": LanePolicy(
            name="background-service",
            max_workers=12,
            max_queue_size=8,
            queue_timeout_seconds=0,
            cancel_grace_seconds=2,
            shutdown_grace_seconds=NORTHBOUND_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
    },
)


mcp_thread_manager = ThreadManager(
    service_name="api-to-mcp",
    lane_policies={
        "control-io": LanePolicy(
            name="control-io",
            max_workers=8,
            max_queue_size=16,
            queue_timeout_seconds=0,
            cancel_grace_seconds=5,
            shutdown_grace_seconds=RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
        "background-service": LanePolicy(
            name="background-service",
            max_workers=12,
            max_queue_size=8,
            queue_timeout_seconds=0,
            cancel_grace_seconds=5,
            shutdown_grace_seconds=RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS,
        ),
    },
)

```

### Core Architecture Module: `backend/utils/__init__.py`
```
# Utils package for Nexent backend

```

### Core Architecture Module: `backend/utils/a2a_http_client.py`
```
"""
HTTP client utilities for A2A protocol communication.
"""
import asyncio
import logging
from typing import Any, AsyncIterator, Dict, Optional
import aiohttp

logger = logging.getLogger(__name__)

# Default timeout for A2A requests (5 minutes)
DEFAULT_TIMEOUT = 300.0
# Shorter timeout for lightweight requests like agent-card (10 seconds)
AGENT_CARD_TIMEOUT = 10.0
# Retry settings
DEFAULT_MAX_RETRIES = 3
RETRY_BACKOFF_FACTOR = 0.5

# Runtime error message
ERR_CLIENT_NOT_INITIALIZED = "Client not initialized. Use async context manager."
# Content type / accept header for JSON payloads
CONTENT_TYPE_JSON = "application/json"


class A2AHttpStatusError(Exception):
    """Raised when an A2A endpoint returns a non-success HTTP status."""

    def __init__(self, method: str, url: str, status: int):
        super().__init__(f"A2A {method} request to {url} failed with HTTP {status}")
        self.status = status


class A2AHttpClient:
    """HTTP client for A2A protocol communication."""

    def __init__(
        self,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES
    ):
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.max_retries = max_retries
        self._session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        connector = aiohttp.TCPConnector(
            limit=100,
            limit_per_host=20,
            ttl_dns_cache=300,
            enable_cleanup_closed=True,
            force_close=True,  # Disable keep-alive to avoid server closing connection mid-response
        )
        self._session = aiohttp.ClientSession(
            timeout=self.timeout,
            connector=connector,
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._session:
            await self._session.close()

    async def _handle_retryable(
        self,
        exc: Exception,
        attempt: int,
        url: str,
        context: str
    ) -> None:
        """Handle a retryable exception. Raises if all retries exhausted."""
        if attempt < self.max_retries - 1:
            wait_time = RETRY_BACKOFF_FACTOR * (2 ** attempt)
            error_type = type(exc).__name__
            logger.warning(
                f"{context} for {url}: [{error_type}] {exc}, "
                f"retrying in {wait_time}s (attempt {attempt + 1}/{self.max_retries})"
            )
            await asyncio.sleep(wait_time)
        else:
            logger.error(f"All retries exhausted for {url}: {context} - {exc}")
            raise exc

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        read_response: bool = True,
        **kwargs
    ) -> aiohttp.ClientResponse:
        """Execute HTTP request with automatic retry on transient failures.

        Args:
            method: HTTP method
            url: Target URL
            read_response: If True, return (status, body_text). If False, return response object.
            **kwargs: Additional arguments for the request
        """
        last_exception = None

        for attempt in range(self.max_retries):
            try:
                async with await self._session.request(method, url, **kwargs) as response:
                    if response.status < 500 and not read_response:
                        return response
                    body = await response.read()
                    if response.status < 500:
                        return (response.status, body)
                    if attempt < self.max_retries - 1:
                        wait_time = RETRY_BACKOFF_FACTOR * (2 ** attempt)
                        logger.warning(
                            f"HTTP {response.status} for {url}, "
                            f"retrying in {wait_time}s (attempt {attempt + 1}/{self.max_retries})"
                        )
                        await asyncio.sleep(wait_time)
                        continue
                    return (response.status, body)
            except (aiohttp.ClientConnectionResetError, aiohttp.ServerDisconnectedError) as e:
                last_exception = e
                await self._handle_retryable(e, attempt, url, type(e).__name__)
            except aiohttp.ClientError as e:
                last_exception = e
                await self._handle_retryable(e, attempt, url, "Request failed")
            except asyncio.TimeoutError as e:
                last_exception = e
                await self._handle_retryable(e, attempt, url, "Request timeout")

        if last_exception:
            raise last_exception
        raise aiohttp.ClientError(f"Request failed after {self.max_retries} attempts")

    async def get_json(
        self,
        url: str,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Send a GET request and return JSON response."""
        if not self._session:
            raise RuntimeError(ERR_CLIENT_NOT_INITIALIZED)

        # Add default headers if not provided
        request_headers = {
            "User-Agent": "Nexent-A2A-Client/1.0",
            "Accept": CONTENT_TYPE_JSON,
            "Connection": "close",
            "A2A-Version": "1.0",
        }
        if headers:
            request_headers.update(headers)

        logger.debug(f"A2A GET request: url={url}")

        try:
            status, body = await self._request_with_retry(
                "GET",
                url,
                headers=request_headers
            )
            if not 200 <= status < 300:
                raise A2AHttpStatusError("GET", url, status)

            # Decode body and handle empty responses
            body_text = body.decode('utf-8') if body else ""
            
            if not body_text.strip():
                logger.error(
                    f"A2A GET received empty response for {url}: HTTP status={status}. "
                    f"Expected JSON response but got empty body."
                )
                raise ValueError(f"Empty response from {url} (HTTP {status})")
            
            # Parse JSON from body
            import json
            data = json.loads(body_text)
            return data
        except asyncio.TimeoutError as e:
            logger.error(f"A2A GET timeout for {url}: {e}")
            raise
        except aiohttp.ClientResponseError as e:
            logger.error(f"A2A GET HTTP error for {url}: {e.status}")
            raise
        except ValueError:
            # Re-raise empty response errors without wrapping
            raise
        except Exception as e:
            import traceback
            logger.error(f"A2A GET request failed for {url}: {type(e).__name__}: {e}\n{traceback.format_exc()}")
            raise

    async def post_json(
        self,
        url: str,
        payload: Dict[str, Any],
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, str]] = None,
        cookies: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Send a POST request and return JSON response."""
        if not self._session:
            raise RuntimeError(ERR_CLIENT_NOT_INITIALIZED)

        # Add default headers if not provided
        request_headers = {
            "Content-Type": CONTENT_TYPE_JSON,
            "Accept": CONTENT_TYPE_JSON,
            "Connection": "close",
            "A2A-Version": "1.0",
        }
        if headers:
            request_headers.update(headers)

        logger.info(f"A2A POST request: url={url}")

        try:
            status, body = await self._request_with_retry(
                "POST",
                url,
                json=payload,
                headers=request_headers,
                params=params,
                cookies=cookies,
            )
            if not 200 <= status < 300:
                raise A2AHttpStatusError("POST", url, status)

            # Decode body and handle empty responses
            body_text = body.decode('utf-8') if body else ""
            
            if not body_text.strip():
                logger.error(
                    f"A2A POST received empty response for {url}: HTTP status={status}. "
                    f"This usually indicates the remote agent is not responding correctly. "
                    f"Check that the agent URL '{url}' is correct and the agent is running."
                )
                raise ValueError(
                    f"Empty response from agent at {url} (HTTP {status}). "
                    f"The agent may be unreachable, still processing, or the endpoint URL is incorrect."
                )
            
            # Parse JSON from body
            import json
            data = json.loads(body_text)
            return data
        except asyncio.TimeoutError as e:
            logger.error(f"A2A POST timeout for {url}: {e}")
            raise
        except aiohttp.ClientResponseError as e:
            logger.error(f"A2A POST HTTP error for {url}: {e.status}")
            raise
        except ValueError:
            # Re-raise empty response errors without wrapping
            raise
        except Exception as e:
            import traceback
            logger.error(f"A2A POST request failed for {url}: {type(e).__name__}: {e}\n{traceback.format_exc()}")
            raise

    async def post_stream(
        self,
        url: str,
        payload: Dict[str, Any],
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, str]] = None,
        cookies: Optional[Dict[str, str]] = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """Send a streaming POST request and yield SSE events."""
        if not self._session:
            raise RuntimeError(ERR_CLIENT_NOT_INITIALIZED)

        try:
            response = await self._session.post(
                url,
                json=payload,
                headers=headers,
                params=params,
                cookies=cookies,
            )
            res
```

### Core Architecture Module: `backend/utils/agent_profile_utils.py`
```
"""Shared helpers for building agent profile context for LLM prompts.

Extracted from evaluator_service, agent_evaluation_service, and
evaluation_set_service to eliminate ~300 lines of duplicated code.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from database.agent_db import query_sub_agent_relations, search_agent_info_by_agent_id
from database.tool_db import search_tools_for_sub_agent
from management.services.skill.service import SkillService


logger = logging.getLogger(__name__)

_MAX_TOOLS = 30
_MAX_SKILLS = 20
_MAX_SUB_AGENTS = 5
_DESC_TOOL_MAX = 200
_DESC_SKILL_MAX = 150
_DESC_SUB_AGENT_MAX = 150
_DESC_KB_MAX = 300
_DESC_AGENT_MAX = 2000
_DUTY_PROMPT_MAX = 3000


def _fetch_agent_tools(
    agent_id: int, tenant_id: str
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Load tools for an agent.

    Returns ``(tools, kb_index_names)`` where ``tools`` is the truncated
    tool list for the profile and ``kb_index_names`` is the list of
    knowledge-base index names referenced by search tools.
    """
    tools_list: List[Dict[str, Any]] = []
    kb_index_names: List[str] = []
    try:
        tools = search_tools_for_sub_agent(agent_id, tenant_id)
        if not tools:
            return tools_list, kb_index_names
        for t in tools[:_MAX_TOOLS]:
            name = t.get("name") or t.get("class_name", "")
            if not name:
                continue
            desc = t.get("description") or t.get("description_zh") or ""
            tools_list.append({
                "name": name,
                "description": desc[:_DESC_TOOL_MAX],
                "source": t.get("source", ""),
            })
            if name in ("search_knowledge", "knowledge_base_search"):
                kb_index_names.extend(_extract_kb_index_names(t))
    except Exception:
        logger.warning("Failed to load tools for agent %d", agent_id, exc_info=True)
    return tools_list, kb_index_names


def _extract_kb_index_names(tool: Dict[str, Any]) -> List[str]:
    """Extract knowledge-base index names from a search tool's params."""
    params = tool.get("params")
    if isinstance(params, list):
        candidates: List[Any] = params
    elif isinstance(params, dict):
        candidates = [params]
    else:
        return []

    names: List[str] = []
    for p in candidates:
        if not isinstance(p, dict):
            continue
        raw = p.get("index_names") or p.get("kb_names") or []
        if isinstance(raw, list):
            names.extend(raw)
    return names


def _fetch_knowledge_bases(
    kb_index_names: List[str], tenant_id: str
) -> List[Dict[str, Any]]:
    """Load knowledge-base info for the given index names."""
    if not kb_index_names:
        return []
    try:
        from database.client import get_db_session
        from database.db_models import KnowledgeRecord
        from database.knowledge_db import get_knowledge_name_map_by_index_names

        name_map = get_knowledge_name_map_by_index_names(kb_index_names, tenant_id)
        with get_db_session() as session:
            rows = session.query(
                KnowledgeRecord.index_name,
                KnowledgeRecord.knowledge_name,
                KnowledgeRecord.knowledge_describe,
            ).filter(
                KnowledgeRecord.index_name.in_(kb_index_names),
                KnowledgeRecord.tenant_id == tenant_id,
                KnowledgeRecord.delete_flag != "Y",
            ).all()
        return [
            {
                "name": kb_name or name_map.get(idx_name, idx_name),
                "description": (kb_desc or "")[:_DESC_KB_MAX],
            }
            for idx_name, kb_name, kb_desc in rows
        ]
    except Exception:
        logger.warning("Failed to load KB info", exc_info=True)
        return []


def _fetch_agent_skills(agent_id: int, tenant_id: str) -> List[Dict[str, Any]]:
    """Load enabled skills for an agent."""
    try:
        skill_service = SkillService()
        skills = skill_service.get_enabled_skills_for_agent(
            agent_id=agent_id, tenant_id=tenant_id,
        )
        if not skills:
            return []
        result: List[Dict[str, Any]] = []
        for s in skills[:_MAX_SKILLS]:
            name = s.get("name", "")
            if name:
                desc = (s.get("description") or "")[:_DESC_SKILL_MAX]
                result.append({"name": name, "description": desc})
        return result
    except Exception:
        logger.warning("Failed to load skills for agent %d", agent_id, exc_info=True)
        return []


def _fetch_sub_agents(agent_id: int, tenant_id: str) -> List[Dict[str, Any]]:
    """Load sub-agent info for an agent."""
    try:
        sub_relations = query_sub_agent_relations(
            main_agent_id=agent_id, tenant_id=tenant_id,
        )
        if not sub_relations:
            return []
        result: List[Dict[str, Any]] = []
        for rel in sub_relations[:_MAX_SUB_AGENTS]:
            sub_agent = search_agent_info_by_agent_id(
                agent_id=rel["selected_agent_id"], tenant_id=tenant_id,
            )
            if not sub_agent:
                continue
            name = sub_agent.get("display_name") or sub_agent.get("name", "")
            if name:
                desc = (sub_agent.get("description") or "")[:_DESC_SUB_AGENT_MAX]
                result.append({"name": name, "description": desc})
        return result
    except Exception:
        logger.warning("Failed to load sub-agents for agent %d", agent_id, exc_info=True)
        return []


def fetch_agent_profile(agent_id: int, tenant_id: str) -> Optional[Dict[str, Any]]:
    """Query agent info + tools + skills + sub-agents.

    Returns a structured dict (all string values are truncated for LLM context
    limits), or ``None`` when the agent is not found.
    """
    agent = search_agent_info_by_agent_id(agent_id=agent_id, tenant_id=tenant_id)
    if not agent:
        return None

    tools, kb_index_names = _fetch_agent_tools(agent_id, tenant_id)
    return {
        "name": agent.get("display_name") or agent.get("name") or "",
        "description": (agent.get("description") or "")[:_DESC_AGENT_MAX],
        "duty_prompt": (agent.get("duty_prompt") or "")[:_DUTY_PROMPT_MAX],
        "constraint_prompt": (agent.get("constraint_prompt") or "")[:_DESC_AGENT_MAX],
        "business_description": (agent.get("business_description") or "")[:_DESC_AGENT_MAX],
        "tools": tools,
        "skills": _fetch_agent_skills(agent_id, tenant_id),
        "sub_agents": _fetch_sub_agents(agent_id, tenant_id),
        "knowledge_bases": _fetch_knowledge_bases(kb_index_names, tenant_id),
    }


def _format_list_section(
    items: List[Dict[str, Any]], label: str
) -> str:
    """Format a list of ``{name, description}`` dicts as a labeled line.

    Returns ``""`` when ``items`` is empty.
    """
    if not items:
        return ""
    parts: List[str] = []
    for item in items:
        desc = item.get("description", "")
        if desc:
            parts.append(f"{item['name']} ({desc})")
        else:
            parts.append(item["name"])
    return f"{label}: {'; '.join(parts)}"


def _format_tool_section(tools: List[Dict[str, Any]]) -> str:
    """Format tools as a labeled line, including source tags."""
    if not tools:
        return ""
    parts: List[str] = []
    for t in tools:
        src = t.get("source", "")
        tag = f" [{src.upper()}]" if src and src != "local" else ""
        desc = t.get("description", "")
        if desc:
            parts.append(f"{t['name']}{tag}: {desc}")
        else:
            parts.append(f"{t['name']}{tag}")
    return f"Tools: {'; '.join(parts)}"


def format_agent_profile_context(profile: Optional[Dict[str, Any]]) -> str:
    """Render an agent profile as a human-readable Markdown string for LLM prompts.

    Returns an empty string when ``profile`` is ``None`` or empty.
    """
    if not profile:
        return ""

    lines: List[str] = [f"### Agent: {profile['name']}"]
    if profile["description"]:
        lines.append(f"Description: {profile['description']}")
    if profile["duty_prompt"]:
        lines.append(f"Duty: {profile['duty_prompt']}")
    if profile["constraint_prompt"]:
        lines.append(f"Constraints: {profile['constraint_prompt']}")
    if profile["business_description"]:
        lines.append(f"Business Context: {profile['business_description']}")

    tool_line = _format_tool_section(profile.get("tools", []))
    if tool_line:
        lines.append(tool_line)

    skill_line = _format_list_section(profile.get("skills", []), "Skills")
    if skill_line:
        lines.append(skill_line)

    sub_line = _format_list_section(profile.get("sub_agents", []), "Sub-agents")
    if sub_line:
        lines.append(sub_line)

    kb_line = _format_list_section(profile.get("knowledge_bases", []), "Knowledge Bases")
    if kb_line:
        lines.append(kb_line)

    return "## Agent Configuration\n" + "\n".join(lines)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4049** (2026-09-30): **docs: update third-party notices (#4048)**
  *Symptoms*: 

- **Issue #4048** (2026-09-30): **docs: update third-party notices**
  *Symptoms*: Updates the root NOTICE for 2025-2026, documents the current principal third-party components and licenses, and points distributors to the project manifests and lockfiles for the broader dependency set. Documentation-only change; validated with git diff --check.

- **Issue #4047** (2026-09-30): **Release v2.7.0 merge**
  *Symptoms*: Merge main (v2.6.1 hotfix history) back into develop for v2.7.0  The v2.6.1 hotfixes landed on main but were never merged back into develop, so both branches evolved the same files independently. The resulting divergence makes the v2.7.0 release PR (develop -> main) conflict on 45 files. This merge restores the missing back-flow.  Resolution: - Conflicted files take the develop side. develop already carries the   hotfix content through a different lineage (#3973, #3998, #4024) and   its wording is the later evolution, so no fix is lost. - main-only edits that are still live are preserved; files main changed   only on paths that develop has since reorganised (agentConfig/ ->   capability/, agents/ -> agents/[agentId]/) resolve to their new   locations. - v2.6.1_001_remove_human_interaction.sql stays deleted: #4024 already   folded its body into v2.7.0_merged_migrations.sql. - VERSION stays v2.7.0, the release being prepared.  The merged tree is identical to develop's tip; this commit exists only to rejoin the two histories so the release PR merges without conflicts.  Verified: python syntax across merged modules, and the test_model_management_service / test_config_sync_service suites.

- **Issue #4045** (2026-09-30): **Fix/default model backfill select best**
  *Symptoms*: 修改了默认模型配置逻辑， 1.没有默认模型的时候，批量添加直接选上下文最大的 2.如果已有默认模型，就添加模型的时候不会再去变动 3.如果默认模型是空的，那就从新添加的里面选 没有默认模型就选上下文最大 <img width="2192" height="1422" alt="20260930-112409" src="https://github.com/user-attachments/assets/0c4683a6-09d7-4b1d-83d4-52cb195fde50" />  有模型但是没有默认模型，从新添加的模型里面选  <img width="2493" height="1760" alt="20260930-112531" src="https://github.com/user-attachments/assets/e64145c3-d582-4154-a2fa-8246d2921f1c" /> <img width="2492" height="1749" alt="20260930-112539" src="https://github.com/user-attachments/assets/836f1258-3bbe-4daf-b31e-92cd9105a5fe" />   
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/ModelEngine-Group/nexent/pull/4045?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ModelEngine-Group) Report :x: Patch coverage is `66.00000%` with `17 lines` in your changes missing coverage. Please review. | [Files with missing lines](https://app.codecov.io/gh/ModelEngine-Group/nexent/pull/4045?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ModelEngine-Group) | Patch % | Lines | |---|---|---| | [backend/apps/model\_managment\_app.py](https://app.codecov.io/gh/ModelEngine-Group/nexent/pull/4045?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ModelEngine-Group#diff-YmFja2VuZC9hcHBzL21vZGVsX21hbmFnbWVudF9hcHAucHk=) | 26.66% | [11 Missing :warning: ](https://app.codecov.io/gh/ModelEngine-Group/nexent/pull/4045?src=pr&el=tree&utm_medium=refer

- **Issue #4044** (2026-09-30): **merge(main): merge v2.7.0 release from develop**
  *Symptoms*: Summary Merge latest develop into main for the v2.7.0 release. No conflicts (develop synchronized with main via #4047).  Changes v2.7.0 release (58 commits) Includes v2.6.1 main hotfixes (enforce explicit CodeAgent termination and silent recovery #3969, plus the v2.6.1 hotfix merges #3971/#3983/#3993) Agent Workbench launch flow, model config redesign, tenant-scoped model management, evaluation and paged agent list fixes, and more SQL migration consolidation into v2.7.0_merged_migrations.sql  Notes v2.7.0 tag: (updated after merge) Docker image build triggered

- **Issue #4043** (2026-09-29): **fix: let tenant admins manage models of their own tenant**
  *Symptoms*: fix: let tenant admins manage models of their own tenant  #4008 restricted the cross-tenant /model/manage/* endpoints to the SU role. The whitelist could not tell a foreign-tenant call from one naming the caller's own tenant, so ADMIN users lost the whole Models tab on /resource-manage: manage/list returned 403 and the page rendered an empty table without surfacing an error.  - Replace _require_manage_role with _require_manage_scope: SU may target any   tenant, ADMIN only the tenant its bearer token belongs to, and every other   role is rejected as before - Allow ADMIN in _MANAGE_ALLOWED_ROLES; the role still has to be checked   separately because ADMIN and SU share the same model:* permission seeds - Apply the scope check to all 8 /manage/* endpoints (list, create, update,   delete, batch_create, healthcheck, provider/list, provider/create) - Update the module docstring to describe the role + tenant scope contract - Reject the ADMIN cross-tenant test's blind spot: the old case used a foreign   tenant_id, which is why losing own-tenant access went uncaught - Add own-tenant list/update coverage, a foreign-tenant update case, and a DEV   case proving require(model:read) alone cannot reach the manage surface
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/ModelEngine-Group/nexent/pull/4043?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=ModelEngine-Group) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)

- **Issue #4042** (2026-09-30): **🐛 Fix(evaluation): surface run delete errors and hide the delete button for unauthorized users**
  *Symptoms*: ## Problem  1. On the evaluation page, the run-delete handler awaited `fetch(DELETE /api/agent-evaluations/{id})` and then removed the row from the table **without ever looking at the response**. `fetch` only rejects on network errors, so every HTTP failure was treated as success. For a non-creator DEV user the backend answers 403 `160208` ("Only the creator or a tenant administrator can delete this evaluation run"): the row vanished with no message, the run stayed in the database and "came back" after a refresh — a silent false success. 2. The same unchecked-fetch pattern existed in three more mutating calls on the page: evaluator delete (table view and card view) and evaluator publish. Those refresh the list afterwards, so a failure did not corrupt the list, but the user got no feedback at all (silent no-op). 3. Even with correct error handling, showing a delete button that can only fail is poor UX for restricted roles: the backend allows only the run creator or the admin-like roles (`SU/ADMIN/SPEED/ASSET_OWNER`) to delete a run.  ## Fix  **Run delete (root cause)** - Check the DELETE response: on failure show an error toast — `getI18nErrorMessage` maps the backend codes (`160208`, `000501`; the zh/en `errorCode.*` translations already exist) — and keep the row; remove it from the table only on success.  **Button visibility** - The run delete button renders only when the current user may actually delete that run: `run.created_by === user.id` or the role is in `S

- **Issue #4041** (2026-09-29): **fix(frontend): handle agent name overflow and card tag layout**
  *Symptoms*: 1. 解决名称溢出的问题 <img width="1695" height="1305" alt="image" src="https://github.com/user-attachments/assets/8fdae8b0-80ae-4a60-9b40-81a7358c87a8" /> 2. 调整卡片中tag的位置  3 删除/agents?agentId=xxx链接，使用/agents/123来跳转agent编辑页

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

### Incident Patch 1: `5fb390b8` (2026-09-30)
**Commit Message**: Merge main (v2.6.1 hotfix history) back into develop for v2.7.0

The v2.6.1 hotfixes landed on main but were never merged back into
develop, so both branches evolved the same files independently. The
resulting divergence makes the v2.7.0 release PR (develop -> main)
conflict on 45 files. This merge restores the missing back-flow.

Resolution:
- Conflicted files take the develop side. develop already carries the
  hotfix content through a different lineage (#3973, #3998, #4024) and
  its wording is the later evolution, so no fix is lost.
- main-only edits that are still live are preserved; files main changed
  only on paths that develop has since reorganised (agentConfig/ ->
  capability/, agents/ -> agents/[agentId]/) resolve to their new
  locations.
- v2.6.1_001_remove_human_interaction.sql stays deleted: #4024 already
  folded its body into v2.7.0_merged_migrations.sql.
- VERSION stays v2.7.0, the release being prepared.

The merged tree is identical to develop's tip; this commit exists only
to rejoin the two histories so the release PR merges without conflicts.

Verified: python syntax across merged modules, and the
test_model_management_service / test_config_sync_service suite



---

### Incident Patch 2: `1c928950` (2026-09-30)
**Commit Message**: Fix/default model backfill select best (#4045)

* fix(model): let backfill swap auto-picked defaults for larger-context models

The default-model backfill runs after EVERY model creation, and a slot it
fills is treated as final. Batch adds create models one by one, so the
first-created model permanently occupied the slot before better candidates
landed -- the "available first, then larger context window" ranking never
got to compare across the batch. Observed live: a 5-model batch import
left a 256K-context model as the default LLM while two 1M-context models
arrived right after it.

Distinguish user choices from backfill placeholders via the config row's
user_id: the UI save path (set_single_config) stamps the acting user on
rows it writes, backfill-inserted rows leave it empty. Backfill now:

- never touches a slot whose row carries a user_id (user's explicit choice)
- re-evaluates a previously auto-configured slot on every create and swaps
  in the best candidate (available first, then larger context); the first
  user save flips the row to user-owned and locks it
- repairs dangling rows and fills never-configured slots as before

get_single_config_info now also returns the row'

**File**: `backend/apps/model_managment_app.py` (modified, +42/-1)
```diff
@@ -21,6 +21,7 @@
 
 from consts.model import (
     BatchCreateModelsRequest,
+    BackfillDefaultsRequest,
     CapacitySuggestionFields,
     ModelRequest,
     ModelProbeRequest,
@@ -65,6 +66,8 @@
     pop_capacity_accept_signal,
     _record_capacity_suggestion_accept,
     get_model_reasoning_capability,
+    _ids_for_created_models,
+    _backfill_default_model_slots,
 )
 from permissions.depends import authenticate, require
 from permissions.models import CurrentUser
@@ -266,9 +269,14 @@ async def create_model(
         user_id, tenant_id = current_user.user_id, current_user.tenant_id
         model_data = request.model_dump()
         accept_signal = pop_capacity_accept_signal(model_data)
+        # Batch-import flow control flag: popped here so it never reaches
+        # the service/DB layer (same contract as the accept-signal fields).
+        skip_backfill = bool(model_data.pop("skip_default_backfill", None))
         logger.debug(
             f"Start to create model, user_id: {user_id}, tenant_id: {tenant_id}")
-        create_result = await create_model_for_tenant(user_id, tenant_id, model_data)
+        create_result = await create_model_for_tenant(
+            user_id, tenant_id, model_data,
+            skip_default_backfill=skip_backfill)
         if accept_signal is not None:
             _record_capacity_suggestion_accept(
                 accept_signal["match_kind"], request.model_factory
@@ -290,6 +298,39 @@ async def create_model(
             status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail=str(e))
 
 
+@router.post("/backfill_defaults")
+async def backfill_default_model_slots(
+    request: BackfillDefaultsRequest,
+    current_user: CurrentUser = Depends(require(MODEL_CREATE_PERMISSION)),
+):
+    """Finalize default-model auto-configuration after a batch import.
+
+    The batch dialog creates its rows one HTTP call at a time with
+    skip_default_backfill set; this endpoint runs the auto-configuration
+    ONCE with the whole batch's models as candidates, so empty slots get
+    the best model of the batch instead of whichever row happened to be
+    created first. Occupied slots (user- or system-configured) are never
+    touched.
+    """
+    try:
+        user_id, tenant_id = current_user.user_id, current_user.tenant_id
+        created_ids = _ids_for_created_models(
+            request.display_names, tenant_id)
+        auto_configured = _backfill_default_model_slots(
+            user_id, tenant_id, new_model_ids=created_ids)
+        return JSONResponse(status_code=HTTPStatus.OK, content={
+            "auto_configured_defaults": auto_configured,
+            "message": "Default model backfill completed"
+        })
+    except TokenExpiredError as e:
+        logging.warning("Session expired")
+        raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail=str(e))
+    except Exception as e:
+        logging.error(f"Failed to backfill default model slots: {str(e)}")
+        raise HTTPException(
+            status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail=str(e))
+
+
 @router.post("/suggest-capacity")
 async def suggest_model_capacity(
     request: ModelCapacitySuggestionRequest,
```

**File**: `backend/consts/model.py` (modified, +17/-0)
```diff
@@ -578,6 +578,23 @@ class ModelRequest(BaseModel):
     # forwards them to model_capacity_suggestion_accept_total.
     accepted_suggestion_match_kind: Optional[str] = None
     accepted_capability_profile_version: Optional[str] = None
+    # Batch-import flow control (never persisted). The batch dialog creates
+    # rows one HTTP call at a time; rows marked skip_default_backfill leave
+    # default-model slots untouched so a single finalize call (after the
+    # loop) can fill empty slots from the whole batch at once. Popped by
+    # the app layer before the dict reaches the service/DB layer.
+    skip_default_backfill: Optional[bool] = None
+
+
+class BackfillDefaultsRequest(BaseModel):
+    """Request payload for POST /model/backfill_defaults only.
+
+    Finalizes default-model auto-configuration after a batch import: empty
+    slots are filled from the best model among the given display names.
+    Occupied slots (user- or system-configured) are never touched.
+    """
+    display_names: List[str] = Field(
+        ..., description="Display names of the models created in the batch")
 
 
 class ModelProbeRequest(ModelRequest):
```

**File**: `backend/database/tenant_config_db.py` (modified, +6/-1)
```diff
@@ -98,7 +98,12 @@ def get_single_config_info(tenant_id: str, select_key: str):
         if result:
             record_info = {
                 "config_value": result.config_value,
-                "tenant_config_id": result.tenant_config_id
+                "tenant_config_id": result.tenant_config_id,
+                # The UI config-save path (set_single_config) stamps the
+                # acting user here; auto-backfilled rows leave it empty.
+                # Consumers use it to tell "user chose this" from "system
+                # picked a placeholder".
+                "user_id": result.user_id,
             }
 
             return record_info
```

**File**: `backend/services/model_management_service.py` (modified, +96/-21)
```diff
@@ -410,7 +410,12 @@ async def resolve_embedding_base_url(model_data: Dict[str, Any]) -> Tuple[Option
     return None, None
 
 
-async def create_model_for_tenant(user_id: str, tenant_id: str, model_data: Dict[str, Any]):
+async def create_model_for_tenant(
+    user_id: str,
+    tenant_id: str,
+    model_data: Dict[str, Any],
+    skip_default_backfill: bool = False,
+):
     """Create a single model record for the given tenant.
 
     Raises ValueError on display name conflict or invalid input.
@@ -528,7 +533,16 @@ async def create_model_for_tenant(user_id: str, tenant_id: str, model_data: Dict
                 f"Model {model_data['display_name']} created successfully")
 
         # Auto-configure default-model slots that the tenant never set.
-        auto_configured = _backfill_default_model_slots(user_id, tenant_id)
+        # Only the models created by THIS call are eligible for empty slots.
+        # Batch imports pass skip_default_backfill on their per-row creates
+        # and finalize once after the whole batch (backfill_defaults), so the
+        # first row no longer permanently claims empty slots.
+        if skip_default_backfill:
+            return {"auto_configured_defaults": []}
+        created_ids = _ids_for_created_models(
+            [model_data["display_name"]], tenant_id, model_data.get("model_type"))
+        auto_configured = _backfill_default_model_slots(
+            user_id, tenant_id, new_model_ids=created_ids)
         return {"auto_configured_defaults": auto_configured}
     except ValueError:
         # Let the API layer map conflicts to 409 instead of 500.
@@ -637,11 +651,12 @@ def _resolve_existing_slot_config(tenant_id: str, config_key: str):
     """Classify a default-model slot's existing config row.
 
     Returns (live_model_id, stale_row):
-    - live_model_id set: the configured default still exists -- backfill must
-      skip (user's explicit choice).
+    - live_model_id set: the slot is occupied by a live model (user- or
+      system-configured) -- backfill must never touch it.
     - stale_row set: a row exists but its model has been deleted (dangling
       default) -- backfill repairs that row in place.
-    - both None: the slot was never configured -- backfill inserts a row.
+    - both None: the slot is empty (never configured or cleared by the
+      user) -- backfill fills it from the current call's new models.
     """
     row = get_single_config_info(tenant_id, config_key)
     # Note: the DB helper returns {} (not None) when no row matches.
@@ -657,14 +672,58 @@ def _resolve_existing_slot_config(tenant_id: str, config_key: str):
     return None, row
 
 
-def _backfill_default_model_slots(user_id: str, tenant_id: str) -> List[Dict[str, Any]]:
+def _ids_for_created_models(
+    display_names: List[str],
+    tenant_id: str,
+    model_type: Optional[str] = None,
+) -> set:
+    """Resolve the ids of freshly created models from their display names.
+
+    create_model_record returns only a bool, so the ids are recovered by
+    display-name lookup. An optional model_type restricts the match; for
+    multi_embedding creates the embedding twin is included automatically
+    (both records share the display name).
+    """
+    accepted_types = None
+    if model_type:
+        accepted_types = {model_type}
+        if model_type == "multi_embedding":
+            accepted_types.add("embedding")
+    ids = set()
+    for name in display_names:
+        if not name:
+            continue
+        for record in get_models_by_display_name(name, tenant_id):
+            if accepted_types is None or record.get("model_type") in accepted_types:
+                ids.add(record["model_id"])
+    return ids
+
+
+def _backfill_default_model_slots(
+    user_id: str,
+    tenant_id: str,
+    new_model_ids: Optional[set] = None,
+) -> List[Dict[str, Any]]:
     """Auto-configure default-model slots after models are created.
 
-    A slot is skipped only when its config row points at a still-existing
-    model; empty slots and dangling rows (model deleted) are (re)filled. The
-    candidate pool is the tenant's live models of the matching type, ranked by
-    availability then context size. Failures are logged and skipped so
-    backfill can never break the create flow.
+    Slot handling:
+    - An OCCUPIED slot (any live model, whether the user picked it or an
+      earlier backfill did) is never touched: adding more models later must
+      not move an existing default. Batch imports therefore mark their
+      per-row creates with skip_default_backfill and finalize once after the
+      whole batch, so the first row no longer permanently claims the slot.
+    - An EMPTY slot (never configured, or deliberately cleared by the user)
+      is filled ONLY from the models created in the current call
+      (new_model_ids). Resurrecting an older model the user passed over
+      (e.g. after clearing a default) would silently override that choice.
+      Legacy
```

**File**: `frontend/app/[locale]/models/components/model/ModelAddDialog.tsx` (modified, +23/-0)
```diff
@@ -981,6 +981,7 @@ function BatchAddForm({
     setSubmitting(true);
     let created = 0;
     const failed: string[] = [];
+    const createdDisplayNames: string[] = [];
     for (const row of rows) {
       // User-modified overrides win; otherwise use catalog suggestions.
       const override = rowOverrides[row.id] ?? rowSuggestions[row.id];
@@ -1004,6 +1005,11 @@ function BatchAddForm({
           // carry the verified result into the created record instead of
           // resetting to not_detected.
           connectStatus: "available",
+          // Batch rows leave default-slot auto-configuration to the single
+          // finalize call after the loop, so the whole batch competes for
+          // empty slots at once (and occupied slots stay untouched) instead
+          // of the first row permanently claiming them.
+          skipDefaultBackfill: true,
         };
         if (override?.settings) {
           applyAdvancedSettingsToParams(
@@ -1013,12 +1019,29 @@ function BatchAddForm({
           );
         }
         await createModel(tenantId, params);
+        createdDisplayNames.push(
+          override?.displayName?.trim() || row.model_name
+        );
         created++;
       } catch (error: any) {
         failed.push(row.model_name);
         log.error("batch add model failed", row.model_name, error);
       }
     }
+    if (created > 0) {
+      // Single finalize for the whole batch: empty slots get the best model
+      // among the freshly created ones; occupied slots are never touched.
+      // Only the user-facing flow (no tenantId override) — the manage-tenant
+      // path targets another tenant and keeps its own behavior.
+      // Best-effort — a failure here does not fail the import.
+      if (!tenantId) {
+        try {
+          await modelService.backfillDefaults(createdDisplayNames);
+        } catch (error) {
+          log.warn("Failed to finalize default-model backfill:", error);
+        }
+      }
+    }
     setSubmitting(false);
     if (created > 0) {
       if (failed.length === 0) {
```

**File**: `frontend/services/api.ts` (modified, +1/-0)
```diff
@@ -270,6 +270,7 @@ export const API_ENDPOINTS = {
     customModelCreate: `${API_BASE_URL}/model/create`,
     customModelCreateProvider: `${API_BASE_URL}/model/provider/create`,
     customModelBatchCreate: `${API_BASE_URL}/model/provider/batch_create`,
+    customModelBackfillDefaults: `${API_BASE_URL}/model/backfill_defaults`,
     getProviderSelectedModalList: `${API_BASE_URL}/model/provider/list`,
     customModelDelete: (displayName: string) =>
       `${API_BASE_URL}/model/delete?display_name=${encodeURIComponent(
```

**File**: `frontend/services/modelService.ts` (modified, +35/-0)
```diff
@@ -402,6 +402,10 @@ export const modelService = {
     temperature?: number;
     topP?: number;
     extraParams?: Record<string, unknown>;
+    // Batch-import flow control: rows marked here leave default-model slots
+    // untouched; the batch finalize call (backfillDefaults) runs the
+    // auto-configuration once for the whole batch.
+    skipDefaultBackfill?: boolean;
   }): Promise<any> => {
     try {
       const requestBody: any = {
@@ -422,6 +426,10 @@ export const modelService = {
         ...buildInferenceParamsRequestBody(model),
       };
 
+      if (model.skipDefaultBackfill) {
+        requestBody.skip_default_backfill = true;
+      }
+
       // Add STT specific fields
       if (model.modelFactory) {
         requestBody.model_factory = model.modelFactory;
@@ -457,6 +465,33 @@ export const modelService = {
     }
   },
 
+  // Finalize default-model auto-configuration after a batch import: empty
+  // slots get the best model among the given display names; occupied slots
+  // (user- or system-configured) are never touched.
+  backfillDefaults: async (displayNames: string[]): Promise<any> => {
+    try {
+      const response = await authedFetch(
+        API_ENDPOINTS.model.customModelBackfillDefaults,
+        {
+          method: "POST",
+          headers: getAuthHeaders(),
+          body: JSON.stringify({ display_names: displayNames }),
+        }
+      );
+      const result = await response.json();
+      if (response.status !== 200) {
+        throw new ModelError(
+          result.detail || result.message || "Failed to backfill defaults",
+          response.status
+        );
+      }
+      return result;
+    } catch (error) {
+      if (error instanceof ModelError) throw error;
+      throw new ModelError("Failed to backfill defaults", 500);
+    }
+  },
+
   addProviderModel: async (model: {
     provider: string;
     type?: ModelType; // v2.6.0: optional — when omitted, backend returns all types and infers per-model
```

**File**: `test/backend/services/test_model_management_service.py` (modified, +197/-11)
```diff
@@ -635,8 +635,10 @@ async def test_create_model_for_tenant_success_llm():
 
         await svc.create_model_for_tenant(user_id, tenant_id, model_data)
 
-        mock_get_by_display.assert_called_once_with(
-            "huggingface/llama", tenant_id)
+        # Called twice: once for the display-name conflict check and once by
+        # _ids_for_created_models to resolve the new model's id for backfill.
+        mock_get_by_display.assert_any_call("huggingface/llama", tenant_id)
+        assert mock_get_by_display.call_count == 2
         # create_model_record called once for non-multimodal
         assert mock_create.call_count == 1
 
@@ -2768,17 +2770,20 @@ async def test_usm_embedding_localhost_replaced_before_url_resolution():
 # ============================================================================
 
 
-def _model_row(model_id, model_type, display_name, connect_status="available", context=None):
-    return {
+def _model_row(model_id, model_type, display_name, connect_status="available", context=None, created=None):
+    row = {
         "model_id": model_id,
         "model_type": model_type,
         "display_name": display_name,
         "connect_status": connect_status,
         "context_window_tokens": context,
     }
+    if created is not None:
+        row["create_time"] = created
+    return row
 
 
-def _run_backfill(svc, existing_rows, existing_config, live_model_ids=None, updated=None):
+def _run_backfill(svc, existing_rows, existing_config, live_model_ids=None, updated=None, new_model_ids=None):
     inserted = []
     updated = updated if updated is not None else []
     live_ids = live_model_ids if live_model_ids is not None else {
@@ -2808,7 +2813,8 @@ def fake_get_model_by_model_id(model_id, tenant_id=None):
             mock.patch.object(svc, "insert_config", side_effect=fake_insert_config), \
             mock.patch.object(svc, "update_config_by_tenant_config_id", side_effect=fake_update_config), \
             mock.patch.object(svc, "get_model_by_model_id", side_effect=fake_get_model_by_model_id):
-        result = svc._backfill_default_model_slots("u1", "t1")
+        result = svc._backfill_default_model_slots(
+            "u1", "t1", new_model_ids=new_model_ids)
     return result, inserted, updated
 
 
@@ -2842,18 +2848,64 @@ def test_backfill_prefers_available_models():
 
 def test_backfill_never_touches_configured_slots():
     svc = import_svc()
-    rows = [_model_row(1, "llm", "llm-one"), _model_row(2, "embedding", "emb-one")]
-    # LLM_ID row exists and points at a live model (id 1) -- must not be
-    # overwritten even though a "better" candidate exists.
+    rows = [_model_row(1, "llm", "llm-one", context=32000),
+            _model_row(2, "llm", "better-llm", context=1048576),
+            _model_row(3, "embedding", "emb-one")]
+    # LLM_ID row exists, points at a live model (id 1) and carries the acting
+    # user's id (UI save path) -- must not be overwritten even though model 2
+    # has a larger context window.
     result, inserted, updated = _run_backfill(
-        svc, rows, {"LLM_ID": {"config_value": "1", "tenant_config_id": 100}},
-        live_model_ids={1, 2})
+        svc, rows,
+        {"LLM_ID": {"config_value": "1", "tenant_config_id": 100, "user_id": "u1"}},
+        live_model_ids={1, 2, 3})
 
     assert {e["config_key"] for e in result} == {"EMBEDDING_ID"}
     assert all(d["config_key"] != "LLM_ID" for d in inserted)
     assert all(cid != 100 for cid, _ in updated)
 
 
+def test_backfill_never_touches_occupied_auto_slots():
+    """An occupied slot is never touched -- whether the user picked the model
+    or an earlier backfill did. Adding models later (even better ones) must
+    not move an existing default; batches finalize once with the whole
+    batch's models instead of swapping row by row."""
+    svc = import_svc()
+    rows = [
+        _model_row(1, "llm", "auto-picked", context=262144),
+        _model_row(2, "llm", "larger-context", context=1048576),
+    ]
+    # Auto-configured row: user_id empty (backfill-written), pointing at the
+    # smaller model. A better model exists (and was just created) -- the slot
+    # must stay frozen.
+    result, inserted, updated = _run_backfill(
+        svc, rows,
+        {"LLM_ID": {"config_value": "1", "tenant_config_id": 100, "user_id": None}},
+        live_model_ids={1, 2},
+        new_model_ids={2})
+
+    assert result == []
+    assert inserted == []
+    assert updated == []
+
+
+def test_backfill_keeps_auto_slot_when_occupant_still_best():
+    """An auto-configured slot whose occupant already ranks first is left
+    alone (no redundant update)."""
+    svc = import_svc()
+    rows = [
+        _model_row(1, "llm", "small-ctx", context=32000),
+        _model_row(2, "llm", "big-ctx", context=1048576),
+    ]
+    result, inserted, updated = _run_backfill(
+        svc, rows,
+        {"LLM_ID": {"config_value": "2", "tenant_config_id": 100, "user_id": None}},
+        
```

---

### Incident Patch 3: `04c68c4d` (2026-09-30)
**Commit Message**: 🐛 Fix(evaluation): surface run delete errors and hide the delete button for unauthorized users (#4042)

* 🐛 Fix(evaluation): surface run delete errors and hide button for unauthorized users

* ♻️ Refactor(evaluation): extract shared error-toast helper to fix Sonar duplication

**File**: `frontend/app/[locale]/evaluation/page.tsx` (modified, +106/-41)
```diff
@@ -1,5 +1,12 @@
 "use client";
-import { useState, useEffect, useRef, useCallback, type Key } from "react";
+import {
+  useState,
+  useEffect,
+  useRef,
+  useCallback,
+  type Key,
+  type ReactNode,
+} from "react";
 import {
   Tabs,
   Typography,
@@ -45,6 +52,8 @@ import {
 } from "@/const/agentEvaluation";
 import { useModelList } from "@/hooks/model/useModelList";
 import { useDeployment } from "@/components/providers/deploymentProvider";
+import { useAuthorizationContext } from "@/components/providers/AuthorizationProvider";
+import { USER_ROLES } from "@/const/auth";
 import { getI18nErrorMessage } from "@/const/errorMessageI18n";
 import {
   buildEvaluationTaskQuery,
@@ -54,6 +63,46 @@ import {
 import AnnotationLabels from "./components/AnnotationLabels";
 const { Text, Title } = Typography;
 
+// Roles allowed to delete ANY evaluation run. Mirrors the backend's
+// CAN_EDIT_ALL_USER_ROLES (backend/consts/const.py); all other roles can
+// only delete runs they created themselves.
+const EVALUATION_DELETE_ALL_ROLES = new Set<string>([
+  USER_ROLES.SU,
+  USER_ROLES.ADMIN,
+  USER_ROLES.SPEED,
+  USER_ROLES.ASSET_OWNER,
+]);
+
+/**
+ * Fire a body-less mutating request (DELETE / POST) and surface backend
+ * errors as a toast. Returns true only on success so callers can skip
+ * their success path (local row removal / list refresh).
+ */
+async function requestWithErrorToast(
+  url: string,
+  method: "DELETE" | "POST",
+  failKey: string,
+  t: (key: string) => string,
+  message: { error: (content: ReactNode) => void }
+): Promise<boolean> {
+  try {
+    const resp = await fetch(url, { method, headers: getAuthHeaders() });
+    if (!resp.ok) {
+      const d = await resp.json().catch(() => ({}));
+      message.error(
+        d.code
+          ? getI18nErrorMessage(d.code, t)
+          : d.detail || d.message || t(failKey)
+      );
+      return false;
+    }
+    return true;
+  } catch {
+    message.error(t(failKey));
+    return false;
+  }
+}
+
 function useList(url: string) {
   /**
    * Tiny reusable list fetcher — used for agent/evaluator/evaluation-set
@@ -105,6 +154,14 @@ function RunsTab() {
   const [evalSets, setEvalSets] = useState<any[]>([]);
   const [evaluators, setEvaluators] = useState<any[]>([]);
 
+  // The backend rejects DELETE for non-creators outside the admin-like
+  // roles (error 160208), so hide the delete button for those users
+  // instead of letting them hit the rejection.
+  const { user } = useAuthorizationContext();
+  const canDeleteRun = (r: any) =>
+    (user?.id != null && r?.created_by === user.id) ||
+    EVALUATION_DELETE_ALL_ROLES.has(user?.role ?? "");
+
   // ── Drawer (create-evaluation form) state ─────────────────────────────
   // Short variable names intentionally match the drawer inputs one-to-one:
   //   sA  = selected agent_id
@@ -349,29 +406,36 @@ function RunsTab() {
               }
             />
           </Tooltip>
-          <Popconfirm
-            title={t("agentEvaluation.deleteConfirm")}
-            onConfirm={async () => {
-              await fetch(
-                API_ENDPOINTS.agentEvaluations.delete(r.agent_evaluation_id),
-                { method: "DELETE", headers: getAuthHeaders() }
-              );
-              setRuns((prev) =>
-                prev.filter(
-                  (x) => x.agent_evaluation_id !== r.agent_evaluation_id
-                )
-              );
-            }}
-          >
-            <Tooltip title={t("agentEvaluation.delete")}>
-              <Button
-                type="link"
-                size="small"
-                danger
-                icon={<Trash2 className="size-3.5" />}
-              />
-            </Tooltip>
-          </Popconfirm>
+          {canDeleteRun(r) && (
+            <Popconfirm
+              title={t("agentEvaluation.deleteConfirm")}
+              onConfirm={async () => {
+                const ok = await requestWithErrorToast(
+                  API_ENDPOINTS.agentEvaluations.delete(r.agent_evaluation_id),
+                  "DELETE",
+                  "agentEvaluation.message.deleteRunFailed",
+                  t,
+                  message
+                );
+                if (ok) {
+                  setRuns((prev) =>
+                    prev.filter(
+                      (x) => x.agent_evaluation_id !== r.agent_evaluation_id
+                    )
+                  );
+                }
+              }}
+            >
+              <Tooltip title={t("agentEvaluation.delete")}>
+                <Button
+                  type="link"
+                  size="small"
+                  danger
+                  icon={<Trash2 className="size-3.5" />}
+                />
+              </Tooltip>
+            </Popconfirm>
+          )}
         </Space>
       ),
     },
@@ -852,6 +916,16 @@ function EvaluatorsTab() {
   const { message } = App.useApp();
   const currentLang = (i18n.language || "zh").startsWith("zh") ? "zh" : "en";

```

**File**: `frontend/public/locales/en/common.json` (modified, +1/-0)
```diff
@@ -4837,6 +4837,7 @@
   "agentEvaluation.pagination.total": "Total {{total}} items",
   "agentEvaluation.progressLabel": "Progress",
   "agentEvaluation.publish": "Publish",
+  "agentEvaluation.publishFailed": "Failed to publish evaluator",
   "agentEvaluation.published": "Published",
   "agentEvaluation.queryCountRequired": "Please select at least one runtime evaluator",
   "agentEvaluation.save": "Save",
```

**File**: `frontend/public/locales/zh/common.json` (modified, +1/-0)
```diff
@@ -4851,6 +4851,7 @@
   "agentEvaluation.pagination.total": "共 {{total}} 条",
   "agentEvaluation.progressLabel": "进度",
   "agentEvaluation.publish": "发布",
+  "agentEvaluation.publishFailed": "发布失败",
   "agentEvaluation.published": "已发布",
   "agentEvaluation.queryCountRequired": "请选择至少一个运行时评估器",
   "agentEvaluation.save": "保存",
```

---

### Incident Patch 4: `89d92744` (2026-09-29)
**Commit Message**: fix: let tenant admins manage models of their own tenant (#4043)

#4008 closed a horizontal-privilege hole on /model/manage/* by restricting
the endpoints to the SU role. The whitelist did not distinguish a
cross-tenant call from one naming the caller's own tenant, so ADMIN users
lost the whole Models tab on /resource-manage: manage/list returned 403 and
the page rendered an empty table with no error, because the create, update,
delete, healthcheck and provider endpoints share the same guard.

The page always sends the caller's own tenant_id (UserManageComp falls back
to user.tenantId for non-SU), so rejecting ADMIN blocked no cross-tenant
access -- it only broke tenant admins managing their own models.

Replace the role whitelist with a role + tenant scope check: SU may target
any tenant, ADMIN only the tenant its token belongs to, and every other role
is rejected as before. ADMIN and SU share the same model:* permission seeds,
so the role itself still has to be checked -- permissions alone cannot
separate them.

The existing ADMIN cross-tenant test kept passing because it used a foreign
tenant_id, which is why the regression went uncaught. Add own-tenant
coverage for list and upd

**File**: `backend/apps/model_managment_app.py` (modified, +32/-16)
```diff
@@ -10,7 +10,8 @@
 Authorization: Mutating endpoints require RBAC permissions (model:create /
 model:update / model:delete) via ``permissions.depends.require``; read endpoints
 require ``model:read``. Cross-tenant ``/manage/*`` endpoints additionally
-require the SU role. Identity is resolved from the bearer token into a
+require the SU role, or the ADMIN role when the targeted tenant is the
+caller's own. Identity is resolved from the bearer token into a
 ``CurrentUser`` and propagated as ``user_id`` / ``tenant_id`` to services.
 """
 
@@ -77,9 +78,11 @@
 MODEL_READ_PERMISSION = "model:read"
 MODEL_UPDATE_PERMISSION = "model:update"
 MODEL_DELETE_PERMISSION = "model:delete"
-# Cross-tenant manage endpoints are SU-only; ADMIN shares the same MODEL seeds
-# so permission strings cannot separate them.
-_MANAGE_ALLOWED_ROLES = ("SU",)
+# Roles allowed on the cross-tenant /manage/* endpoints. ADMIN shares the same
+# MODEL permission seeds as SU, so permission strings cannot separate the two
+# and the role itself must be checked. ADMIN is scoped to its own tenant by
+# ``_require_manage_scope``; SU may target any tenant.
+_MANAGE_ALLOWED_ROLES = ("SU", "ADMIN")
 
 # Model Catalog loader (with graceful fallback)
 try:
@@ -147,12 +150,25 @@ def _log_safe(value: Any) -> str:
     return _LOG_UNSAFE_CHARS.sub("", str(value))
 
 
-def _require_manage_role(current_user: CurrentUser) -> None:
-    """Restrict cross-tenant manage endpoints to super admins."""
-    if current_user.normalized_role not in _MANAGE_ALLOWED_ROLES:
+def _require_manage_scope(current_user: CurrentUser, target_tenant_id: str) -> None:
+    """Authorize a /manage/* call against the tenant it targets.
+
+    SU may manage any tenant. ADMIN may manage only the tenant its token
+    belongs to -- the tenant-resource page always passes the caller's own
+    tenant_id, so restricting ADMIN outright would break tenant admins
+    managing their own models while blocking no cross-tenant access. Any
+    other role, or an ADMIN naming a foreign tenant, is rejected.
+    """
+    role = current_user.normalized_role
+    if role not in _MANAGE_ALLOWED_ROLES:
+        raise HTTPException(
+            status_code=HTTPStatus.FORBIDDEN,
+            detail="This operation requires SU or tenant ADMIN role",
+        )
+    if role != "SU" and target_tenant_id != current_user.tenant_id:
         raise HTTPException(
             status_code=HTTPStatus.FORBIDDEN,
-            detail="This operation requires SU role",
+            detail="Tenant admins may only manage models of their own tenant",
         )
 
 
@@ -716,7 +732,7 @@ async def manage_check_model_health(
     Returns:
         Connectivity check result with updated status.
     """
-    _require_manage_role(current_user)
+    _require_manage_scope(current_user, request.tenant_id)
     try:
         logger.debug(
             f"Start to check model connectivity for tenant, user_id: {current_user.user_id}, "
@@ -760,7 +776,7 @@ async def manage_create_model(
     Returns:
         Success message on successful creation.
     """
-    _require_manage_role(current_user)
+    _require_manage_scope(current_user, request.tenant_id)
     try:
         user_id = current_user.user_id
         logger.debug(
@@ -811,7 +827,7 @@ async def manage_update_model(
     Returns:
         Success message on successful update.
     """
-    _require_manage_role(current_user)
+    _require_manage_scope(current_user, request.tenant_id)
     try:
         user_id = current_user.user_id
         logger.debug(
@@ -863,7 +879,7 @@ async def manage_delete_model(
     Returns:
         Success message with deleted model name.
     """
-    _require_manage_role(current_user)
+    _require_manage_scope(current_user, request.tenant_id)
     try:
         user_id = current_user.user_id
         logger.debug(
@@ -908,7 +924,7 @@ async def manage_batch_create_models(
     Returns:
         Success message on completion.
     """
-    _require_manage_role(current_user)
+    _require_manage_scope(current_user, request.tenant_id)
     try:
         user_id = current_user.user_id
         logger.debug(
@@ -960,7 +976,7 @@ async def manage_list_models(
     Returns:
         Paginated model list for the specified tenant.
     """
-    _require_manage_role(current_user)
+    _require_manage_scope(current_user, request.tenant_id)
     try:
         logger.debug(
             f"Start to list models for tenant, user_id: {current_user.user_id}, target_tenant_id: {request.tenant_id}, "
@@ -1001,7 +1017,7 @@ async def manage_list_provider_models(
     Returns:
         List of available provider models for the specified tenant.
     """
-    _require_manage_role(current_user)
+    _require_manage_scope(current_user, request.tenant_id)
     try:
         logger.debug(
             f"Start to list provider models for tenant, user_id: {current_user.user_id}, target_tenant_id: {request.tenant_id}, "
@@ -1039,7 +1055,7 @@ async def manage_create_pro
```

**File**: `test/backend/app/test_model_rbac.py` (modified, +83/-4)
```diff
@@ -2,7 +2,8 @@
 
 Verifies that mutating /model/* endpoints reject the DEV role (which only
 holds model:read), read endpoints stay accessible to DEV, and the
-cross-tenant /manage/* endpoints are restricted to SU.
+/manage/* endpoints accept SU for any tenant plus ADMIN for its own tenant
+only.
 """
 
 import sys
@@ -185,9 +186,9 @@ async def test_admin_can_create_model(admin_client, mocker):
 
 
 @pytest.mark.asyncio
-async def test_admin_cannot_access_manage_endpoints(admin_client, mocker):
-    """ADMIN shares the SU model seeds, so manage/* must fall back to the
-    SU role whitelist."""
+async def test_admin_cannot_access_foreign_tenant_manage_endpoints(admin_client, mocker):
+    """ADMIN shares the SU model seeds, so cross-tenant manage/* calls must be
+    rejected by the role+tenant scope check rather than by permission strings."""
     mocker.patch(
         'backend.apps.model_managment_app.list_models_for_admin',
         return_value={"models": [], "total": 0},
@@ -200,8 +201,86 @@ async def test_admin_cannot_access_manage_endpoints(admin_client, mocker):
     assert response.status_code == HTTPStatus.FORBIDDEN
 
 
+@pytest.mark.asyncio
+async def test_admin_cannot_mutate_foreign_tenant_models(admin_client, mocker):
+    """The own-tenant allowance must not extend to mutating endpoints either."""
+    mock_update = mocker.patch(
+        'backend.apps.model_managment_app.update_single_model_for_tenant',
+        return_value=None,
+    )
+    response = admin_client.post(
+        "/model/manage/update",
+        json={
+            "tenant_id": "other_tenant",
+            "current_display_name": "m",
+            "model_name": "m2",
+        },
+        headers=auth_header,
+    )
+    assert response.status_code == HTTPStatus.FORBIDDEN
+    mock_update.assert_not_awaited()
+
+
+@pytest.mark.asyncio
+async def test_admin_can_list_own_tenant_models(admin_client, mocker):
+    """Tenant admins manage their own tenant via /resource-manage, which always
+    passes the caller's own tenant_id. Regression: manage/list used to be
+    SU-only, so the Models tab rendered an empty table for ADMIN."""
+    mock_list = mocker.patch(
+        'backend.apps.model_managment_app.list_models_for_admin',
+        return_value={"models": [], "total": 0},
+    )
+    response = admin_client.post(
+        "/model/manage/list",
+        json={"tenant_id": "rbac_tenant", "page": 1, "page_size": 10},
+        headers=auth_header,
+    )
+    assert response.status_code == HTTPStatus.OK
+    mock_list.assert_awaited_once()
+    # The own-tenant id must be the one forwarded to the service.
+    assert mock_list.await_args.args[0] == "rbac_tenant"
+
+
+@pytest.mark.asyncio
+async def test_admin_can_mutate_own_tenant_models(admin_client, mocker):
+    """Create/update/delete of the ADMIN's own tenant models stay available."""
+    mock_update = mocker.patch(
+        'backend.apps.model_managment_app.update_single_model_for_tenant',
+        return_value=None,
+    )
+    response = admin_client.post(
+        "/model/manage/update",
+        json={
+            "tenant_id": "rbac_tenant",
+            "current_display_name": "m",
+            "model_name": "m2",
+        },
+        headers=auth_header,
+    )
+    assert response.status_code == HTTPStatus.OK
+    mock_update.assert_awaited_once()
+
+
+@pytest.mark.asyncio
+async def test_dev_cannot_access_own_tenant_manage_endpoints(dev_client, mocker):
+    """DEV holds model:read and passes require(), so the scope check is the only
+    thing keeping it off the manage surface -- even for its own tenant."""
+    mock_list = mocker.patch(
+        'backend.apps.model_managment_app.list_models_for_admin',
+        return_value={"models": [], "total": 0},
+    )
+    response = dev_client.post(
+        "/model/manage/list",
+        json={"tenant_id": "rbac_tenant", "page": 1, "page_size": 10},
+        headers=auth_header,
+    )
+    assert response.status_code == HTTPStatus.FORBIDDEN
+    mock_list.assert_not_awaited()
+
+
 @pytest.mark.asyncio
 async def test_su_can_access_manage_endpoints(su_client, mocker):
+    """SU may target any tenant, including one that is not its own."""
     mocker.patch(
         'backend.apps.model_managment_app.list_models_for_admin',
         return_value={"models": [], "total": 0},
```

---

### Incident Patch 5: `be69e7b3` (2026-09-29)
**Commit Message**: fix(frontend): handle agent name overflow and card tag layout (#4041)

* update version style

* 删除右下角“联系我们”，优化超级管理员界面

* fix(frontend): keep agent conversations visible after returning

* fix: show repository status in paged agent list

* fix(frontend): move skill listing action to more menu

* fix: restrict agent repository review data in paged list

* fix(frontend): return from chat when thread reload fails

* fix(frontend): handle agent name overflow and card tag layout

---------

Co-authored-by: Summer-Si <[REDACTED_EMAIL]>
Co-authored-by: panyehong <[REDACTED_EMAIL]>

**File**: `frontend/app/[locale]/agent-space/agent-space.tsx` (modified, +6/-4)
```diff
@@ -248,14 +248,16 @@ export function AgentSpace({ active }: { active: boolean }) {
                 </span>
               ) : null}
               {listing.version_label ? (
-                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
+                <span className="flex min-w-0 max-w-full items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                   <span
                     className="size-1.5 shrink-0 rounded-full bg-primary"
                     aria-hidden
                   />
-                  {t("agentRepository.mine.currentVersion", {
-                    version: listing.version_label,
-                  })}
+                  <span className="min-w-0 truncate">
+                    {t("agentRepository.mine.currentVersion", {
+                      version: listing.version_label,
+                    })}
+                  </span>
                 </span>
               ) : null}
             </>
```

**File**: `frontend/app/[locale]/agent-space/components/MineReviewStatusModal.tsx` (modified, +4/-7)
```diff
@@ -53,25 +53,22 @@ export function MineReviewStatusModal({
         icon: Clock,
         label: t("repository.listingStatus.pendingLabel"),
         description: t("repository.listingStatus.pendingDescription"),
-        tone:
-          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
+        tone: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
         iconClass: "text-amber-600 dark:text-amber-300",
       }
     : isRejected
       ? {
           icon: XCircle,
           label: t("repository.listingStatus.rejectedLabel"),
           description: t("repository.listingStatus.rejectedDescription"),
-          tone:
-            "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
+          tone: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
           iconClass: "text-red-600 dark:text-red-300",
         }
       : {
           icon: CheckCircle2,
           label: t("repository.listingStatus.listedLabel"),
           description: t("repository.listingStatus.listedDescription"),
-          tone:
-            "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
+          tone: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
           iconClass: "text-emerald-600 dark:text-emerald-300",
         };
 
@@ -192,7 +189,7 @@ export function MineReviewStatusModal({
       <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
         <div className="flex justify-between gap-4">
           <span>{t("agentRepository.mine.reviewModal.version")}</span>
-          <span className="font-medium text-slate-700 dark:text-slate-200">
+          <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
             {versionLabel}
           </span>
         </div>
```

**File**: `frontend/app/[locale]/agent-space/components/MyAgentCard.tsx` (modified, +66/-52)
```diff
@@ -160,14 +160,16 @@ export function MyAgentCard({
       onClick={onView}
       subtitle={
         versionLabel != null ? (
-          <span className="inline-flex items-center gap-1.5 truncate">
+          <span className="flex min-w-0 items-center gap-1.5">
             <span
               className="size-1.5 shrink-0 rounded-full bg-primary"
               aria-hidden
             />
-            {t("agentRepository.mine.currentVersion", {
-              version: versionLabel,
-            })}
+            <span className="min-w-0 truncate">
+              {t("agentRepository.mine.currentVersion", {
+                version: versionLabel,
+              })}
+            </span>
           </span>
         ) : undefined
       }
@@ -188,29 +190,24 @@ export function MyAgentCard({
           </>
         ) : undefined
       }
-      headerActions={
-        <div className="flex shrink-0 flex-col items-end gap-1.5">
-          {menuItems.length > 0 ? (
-            <Dropdown
-              menu={{ items: menuItems }}
-              open={guideMenuOpen}
-              onOpenChange={onGuideMenuOpenChange}
-              trigger={["click"]}
-            >
-              <Button
-                type="text"
-                size="small"
-                className="size-8 shrink-0 text-slate-400 hover:text-slate-600"
-                icon={<MoreHorizontal className="size-4" aria-hidden />}
-                aria-label={t("agentRepository.mine.menu.more")}
-                aria-haspopup="menu"
-              />
-            </Dropdown>
-          ) : null}
-          <div className="flex flex-wrap items-center justify-end gap-1.5">
+      statusRow={
+        <div className="flex w-full min-w-0 items-center gap-2">
+          <span
+            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
+              published
+                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
+                : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
+            }`}
+          >
+            {published
+              ? t("agentRepository.mine.lifecycle.published")
+              : t("agentRepository.mine.lifecycle.draft")}
+          </span>
+          <div className="flex min-w-0 flex-1 justify-end">
             {repositoryBadge ? (
               <span
-                className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
+                aria-label={`${t(repositoryBadge.labelKey)}${repositoryBadge.versionLabel ? ` · ${repositoryBadge.versionLabel}` : ""}`}
+                className={`block w-fit max-w-full truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                   repositoryBadge.variant === "pending"
                     ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                     : repositoryBadge.variant === "rejected"
@@ -224,39 +221,56 @@ export function MyAgentCard({
                   : null}
               </span>
             ) : null}
+          </div>
+        </div>
+      }
+      headerActions={
+        menuItems.length > 0 || agent.is_available === false ? (
+          <div className="grid h-[60px] grid-rows-2">
+            <div className="flex items-center justify-end">
+              {menuItems.length > 0 ? (
+                <Dropdown
+                  menu={{ items: menuItems }}
+                  open={guideMenuOpen}
+                  onOpenChange={onGuideMenuOpenChange}
+                  trigger={["click"]}
+                >
+                  <Button
+                    type="text"
+                    size="small"
+                    className="size-8 shrink-0 text-slate-400 hover:text-slate-600"
+                    icon={<MoreHorizontal className="size-4" aria-hidden />}
+                    aria-label={t("agentRepository.mine.menu.more")}
+                    aria-haspopup="menu"
+                  />
+                </Dropdown>
+              ) : null}
+            </div>
             {agent.is_available === false ? (
-              <Tooltip
-                title={
-                  unavailableReasonLabels.length > 0
-                    ? unavailableReasonLabels.join(", ")
-                    : t("agentSelector.agentUnavailable")
-                }
-              >
-                <span
-                  className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300"
-                  aria-label={
-                    unavailableReasonLabels.join(", ") ||
-                    t("agentSelector.agentUnavailable")
+              <div className="flex items-center justify-end">
+                <Tooltip
+                  title={
+                    unavailableReasonLabels.length > 0
+                      ? unavailableReasonLabels.join(", ")
+                      : t("agentSelector.agentUnavailable")
                   }
                 >
-                  {t("mcpConfig
```

**File**: `frontend/app/[locale]/agent-space/components/ReviewAgentList.tsx` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ export function ReviewAgentList({
                   </h3>
                 </div>
 
-                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
+                <div className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                   {versionLabel}
                 </div>
 
```

**File**: `frontend/app/[locale]/agents/page.tsx` (modified, +86/-21)
```diff
@@ -13,7 +13,7 @@ import {
   Pagination,
   Row,
   Spin,
-  Tag,
+  Tooltip,
 } from "antd";
 import { Bot, FileInput, Pencil, Search, Clock } from "lucide-react";
 import { useTranslation } from "react-i18next";
@@ -33,6 +33,8 @@ import { useAgentStore } from "@/stores/agentStore";
 import type { Agent } from "@/types/agentConfig";
 import { AgentDetail } from "@/components/agent/agent-detail";
 import { mapAgentInfoDetail } from "@/lib/myAgentDetail";
+import { getMineCardRepositoryStatusBadge } from "@/lib/agentRepositoryMine";
+import { getUnavailableReasonLabels } from "@/lib/agentLabelMapper";
 
 import AgentConfigActions from "./components/agent-config-actions";
 import AgentAvatar from "./components/agent-avatar";
@@ -92,6 +94,7 @@ export default function AgentsPage() {
     search,
     page,
     pageSize: itemsPerPage,
+    includeRepositoryInfo: true,
   });
   const cardHeight = `calc((100% - ${(rows - 1) * 20}px) / ${rows})`;
 
@@ -243,6 +246,13 @@ export default function AgentsPage() {
                   </Col>
                   {(agents as AgentCardItem[]).map((agent) => {
                     const date = formatAgentDate(agent);
+                    const repositoryBadge = getMineCardRepositoryStatusBadge(
+                      agent.repository_info ?? []
+                    );
+                    const unavailableReasonLabels = getUnavailableReasonLabels(
+                      agent.unavailable_reasons ?? [],
+                      t
+                    );
                     return (
                       <Col
                         key={agent.id}
@@ -257,13 +267,21 @@ export default function AgentsPage() {
                           className="h-full min-h-0"
                           title={getAgentTitle(agent)}
                           subtitle={
-                            agent.current_version_no
-                              ? t("agentRepository.mine.currentVersion", {
-                                  version:
-                                    agent.version_name ||
-                                    `V${agent.current_version_no}`,
-                                })
-                              : undefined
+                            agent.current_version_no ? (
+                              <span className="flex min-w-0 items-center gap-1.5">
+                                <span
+                                  className="size-1.5 shrink-0 rounded-full bg-primary"
+                                  aria-hidden
+                                />
+                                <span className="min-w-0 truncate">
+                                  {t("agentRepository.mine.currentVersion", {
+                                    version:
+                                      agent.version_name ||
+                                      `V${agent.current_version_no}`,
+                                  })}
+                                </span>
+                              </span>
+                            ) : undefined
                           }
                           icon={
                             <AgentAvatar
@@ -277,25 +295,72 @@ export default function AgentsPage() {
                             t("agentRepository.card.noDescription")
                           }
                           descriptionLines={2}
-                          actions={
-                            <div className="flex flex-col items-end gap-1.5">
-                              <AgentConfigActions
-                                agentId={Number(agent.id)}
-                                readOnly={agent.permission === "READ_ONLY"}
-                                variant="menu"
-                                onManageVersions={handleManageVersions}
-                              />
-                              <Tag
-                                color={
-                                  agent.current_version_no ? "green" : "orange"
-                                }
+                          fixedHeaderLayout
+                          statusRow={
+                            <div className="flex min-h-5 w-full min-w-0 items-center gap-2">
+                              <span
+                                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
+                                  agent.current_version_no
+                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
+                                    : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
+                                }`}
                               >
                                 {agent.current_version_no
                                   ? t(
                                       "agentRepository.mine.lifecycle.published"
                                     )
                                   : t("agentRepository.mine.lifecycle.draft")}
-                      
```

**File**: `frontend/app/[locale]/skill-space/components/MineSkillsView.tsx` (modified, +27/-20)
```diff
@@ -513,6 +513,7 @@ function MineSkillCard({
           <Bot className="size-5" aria-hidden />
         </div>
       }
+      fixedHeaderLayout
       description={
         skill.description || t("skillRepository.common.noDescription")
       }
@@ -540,26 +541,32 @@ function MineSkillCard({
       }
       footerLayout="inline"
       headerActions={
-        <div className="flex flex-col items-end gap-1">
-          {canEdit || canApplyListing ? (
-            <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
-              <Button
-                type="text"
-                size="small"
-                className="size-8 shrink-0 text-slate-400 hover:text-slate-600"
-                icon={<MoreHorizontal className="size-4" aria-hidden />}
-                aria-label={t("skillRepository.common.moreActions")}
-              />
-            </Dropdown>
-          ) : null}
-          {hasRepositoryInfo ? (
-            <span
-              className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${MINE_SKILL_STATUS_CLASS[repositoryStatus]}`}
-            >
-              {getSkillRepositoryStatusLabel(t, repositoryStatus)}
-            </span>
-          ) : null}
-        </div>
+        canEdit || canApplyListing || hasRepositoryInfo ? (
+          <div className="grid h-[60px] max-w-[120px] grid-rows-2">
+            <div className="flex items-center justify-end">
+              {canEdit || canApplyListing ? (
+                <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
+                  <Button
+                    type="text"
+                    size="small"
+                    className="size-8 shrink-0 text-slate-400 hover:text-slate-600"
+                    icon={<MoreHorizontal className="size-4" aria-hidden />}
+                    aria-label={t("skillRepository.common.moreActions")}
+                  />
+                </Dropdown>
+              ) : null}
+            </div>
+            <div className="flex min-w-0 items-center justify-end">
+              {hasRepositoryInfo ? (
+                <span
+                  className={`block max-w-full truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${MINE_SKILL_STATUS_CLASS[repositoryStatus]}`}
+                >
+                  {getSkillRepositoryStatusLabel(t, repositoryStatus)}
+                </span>
+              ) : null}
+            </div>
+          </div>
+        ) : undefined
       }
       footer={
         <div className="flex items-center gap-2">
```

**File**: `frontend/components/resource/ResourceCard.tsx` (modified, +27/-3)
```diff
@@ -14,13 +14,17 @@ export interface ResourceCardProps {
   icon?: ReactNode;
   /** Status or lifecycle content displayed beside the title. */
   badge?: ReactNode;
+  /** Status content displayed across the card above the description. */
+  statusRow?: ReactNode;
   /** Resource tags displayed below the description. */
   tags?: ReactNode;
   meta?: ReactNode;
   /** Display footer actions below metadata instead of beside it. */
   footerLayout?: "inline" | "stacked";
   /** Status icons displayed beside the title, left of actions. */
   headerActions?: ReactNode;
+  /** Keep header positions stable while centering the icon vertically. */
+  fixedHeaderLayout?: boolean;
   /** Actions displayed at the top-right (e.g., "..." menu). */
   actions?: ReactNode;
   footer?: ReactNode;
@@ -43,10 +47,12 @@ export default function ResourceCard({
   descriptionLines = 3,
   icon,
   badge,
+  statusRow,
   tags,
   meta,
   footerLayout = "stacked",
   headerActions,
+  fixedHeaderLayout = false,
   actions,
   footer,
   children,
@@ -101,9 +107,20 @@ export default function ResourceCard({
               isInteractive && "pointer-events-none relative z-[1]"
             )}
           >
-            <div className="flex items-start gap-3">
+            <div
+              className={cn(
+                "flex gap-3",
+                fixedHeaderLayout ? "min-h-[60px] items-center" : "items-start"
+              )}
+            >
               {icon ? <span className="shrink-0">{icon}</span> : null}
-              <div className="min-w-0 flex-1">
+              <div
+                className={cn(
+                  "min-w-0 flex-1",
+                  fixedHeaderLayout &&
+                    "flex h-11 flex-col justify-between self-center"
+                )}
+              >
                 <h2
                   id={titleId}
                   className="truncate text-base font-semibold text-slate-900 dark:text-slate-100"
@@ -124,6 +141,7 @@ export default function ResourceCard({
                   data-resource-card-action
                   className={cn(
                     "flex shrink-0 items-start gap-1",
+                    fixedHeaderLayout && "self-center",
                     actionClassName
                   )}
                   onDoubleClick={(event) => event.stopPropagation()}
@@ -134,9 +152,15 @@ export default function ResourceCard({
               ) : null}
             </div>
             <div className="flex flex-1 flex-col">
+              {statusRow ? (
+                <div className="mt-1 min-w-0">{statusRow}</div>
+              ) : null}
               {description ? (
                 <div
-                  className="mt-4 min-h-0 overflow-hidden text-sm leading-6 text-slate-600 dark:text-slate-300"
+                  className={cn(
+                    "min-h-0 overflow-hidden text-sm leading-6 text-slate-600 dark:text-slate-300",
+                    statusRow ? "mt-3" : "mt-4"
+                  )}
                   style={{
                     display: "-webkit-box",
                     WebkitBoxOrient: "vertical",
```

**File**: `frontend/tests/workbench/AgentPicker.test.tsx` (modified, +5/-0)
```diff
@@ -144,6 +144,11 @@ function mount() {
   );
   return onSelect;
 }
+it("opens the selected Agent's editor from the edit button", async () => {
+  mount();
+  await userEvent.click(screen.getByRole("button", { name: "编辑" }));
+  expect(routerPush).toHaveBeenCalledWith("/zh/agents/8");
+});
 it("shows the backend unavailable reason and only one published version badge", async () => {
   const select = vi.fn();
   render(
```

---

### Incident Patch 6: `69b8f391` (2026-09-29)
**Commit Message**: 🐛 Bugfix: Fixed the issue with agent redirection when creating agents in the Agent Workbench; fixed the issue where agents were not fully displayed on the agent configuration page. (#4040)

**File**: `backend/database/agent_db.py` (modified, +2/-0)
```diff
@@ -548,6 +548,8 @@ def query_agent_list_candidates_by_tenant_id(
                 AgentInfo.version_no == 0,
                 AgentInfo.delete_flag != 'Y',
                 AgentInfo.enabled.is_(True),
+                or_(AgentInfo.agent_origin.is_(None), AgentInfo.agent_origin != "SYSTEM"),
+                or_(AgentInfo.system_key.is_(None), AgentInfo.system_key == ""),
             )
             .order_by(AgentInfo.create_time.desc(), AgentInfo.agent_id.desc())
             .all()
```

**File**: `frontend/app/[locale]/agent-space/my-agent.tsx` (modified, +2/-4)
```diff
@@ -388,7 +388,7 @@ export function MyAgent({
       invalidateAgentRepositoryCaches(queryClient),
       queryClient.invalidateQueries({ queryKey: [AGENTS_LIST_QUERY_KEY] }),
     ]);
-    router.push(`/${locale}/agents?agent_id=${agentId}`);
+    router.push(`/${locale}/agents/${agentId}`);
   };
 
   const handleEdit = (
@@ -398,9 +398,7 @@ export function MyAgent({
     if (permission === "READ_ONLY") {
       return;
     }
-    router.push(
-      `/${locale}/agents?agent_id=${agentId}&from=agent-space&tab=mine`
-    );
+    router.push(`/${locale}/agents/${agentId}?from=agent-space&tab=mine`);
   };
 
   const handleDeleteAgent = (agent: MyEditableAgentItem) => {
```

**File**: `frontend/app/[locale]/layout.client.tsx` (modified, +9/-2)
```diff
@@ -43,8 +43,15 @@ export function ClientLayout({ children }: { children: ReactNode }) {
   const [collapsed, setCollapsed] = useState(effectivePath === "/workbench");
 
   useEffect(() => {
-    if (effectivePath !== "/workbench") return;
-    const frame = requestAnimationFrame(() => setCollapsed(true));
+    if (
+      effectivePath !== "/workbench" &&
+      !effectivePath.startsWith("/agents/") &&
+      effectivePath !== "/skill-space"
+    )
+      return;
+    const frame = requestAnimationFrame(() =>
+      setCollapsed(effectivePath === "/workbench")
+    );
     return () => cancelAnimationFrame(frame);
   }, [effectivePath]);
 
```

**File**: `frontend/components/navigation/SideNavigation.tsx` (modified, +7/-4)
```diff
@@ -206,16 +206,19 @@ export function SideNavigation({ collapsed }: SideNavigationProps) {
   // Update selected key and expand parent menu when pathname changes
   useEffect(() => {
     const currentPath = getEffectiveRoutePath(pathname);
+    const routePath = currentPath.startsWith("/agents/")
+      ? "/agents"
+      : currentPath;
     const matchedKey =
-      currentPath === "/newchat"
+      routePath === "/newchat"
         ? "/chat"
-        : ROUTE_PATHS.includes(currentPath)
-          ? currentPath
+        : ROUTE_PATHS.includes(routePath)
+          ? routePath
           : null;
     setSelectedKey(matchedKey || "");
 
     // Auto-expand parent menu when visiting child page
-    const parentKey = findParentKey(currentPath);
+    const parentKey = findParentKey(routePath);
     setOpenKeys(parentKey ? [parentKey] : []);
   }, [pathname]);
 
```

**File**: `frontend/features/agentAutomation/components/AutomationProposalMessage.tsx` (modified, +5/-2)
```diff
@@ -86,8 +86,11 @@ export default function AutomationProposalMessage({
 
   const configureAgent = () => {
     const agentId = currentProposal.task?.agent_id;
-    const suffix = agentId ? `?agent_id=${agentId}` : "";
-    router.push(`/${i18n.language}/agents${suffix}`);
+    router.push(
+      agentId
+        ? `/${i18n.language}/agents/${agentId}`
+        : `/${i18n.language}/agents`
+    );
   };
 
   return (
```

**File**: `frontend/features/workbench/components/AgentPicker.tsx` (modified, +5/-2)
```diff
@@ -68,7 +68,10 @@ export function AgentPicker({
     );
   const [search, setSearch] = useState("");
   const queryClient = useQueryClient();
-  const { t } = useTranslation();
+  const { t, i18n } = useTranslation();
+  const locale = (i18n.resolvedLanguage || i18n.language).startsWith("en")
+    ? "en"
+    : "zh";
   const [tab, setTab] = useState("mine");
   const [page, setPage] = useState(1);
   const [total, setTotal] = useState(0);
@@ -359,7 +362,7 @@ export function AgentPicker({
                       size="small"
                       aria-label="编辑"
                       onClick={() =>
-                        router.push(`/agents?agent_id=${agent.id}`)
+                        router.push(`/${locale}/agents/${agent.id}`)
                       }
                     >
                       编辑
```

**File**: `frontend/features/workbench/components/CreationResultCards.tsx` (modified, +10/-4)
```diff
@@ -28,7 +28,10 @@ export function AgentCreationResultCard({
   description?: string;
   completed?: boolean;
 }) {
-  const { t } = useTranslation("common");
+  const { t, i18n } = useTranslation("common");
+  const locale = (i18n.resolvedLanguage || i18n.language).startsWith("en")
+    ? "en"
+    : "zh";
   const [agentDetails, setAgentDetails] = useState<{
     name: string;
     description?: string;
@@ -60,7 +63,7 @@ export function AgentCreationResultCard({
   const displayDescription = description || agentDetails?.description;
   return (
     <Link
-      href={`/agents?agent_id=${agentId}`}
+      href={`/${locale}/agents/${agentId}`}
       className="group my-4 block w-full min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:border-primary/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
     >
       <div className="flex items-start gap-3 p-4">
@@ -109,7 +112,10 @@ export function SkillCreationResultCard({
   saved: boolean;
   onSave: (payload: SkillPayload) => Promise<void>;
 }) {
-  const { t } = useTranslation("common");
+  const { t, i18n } = useTranslation("common");
+  const locale = (i18n.resolvedLanguage || i18n.language).startsWith("en")
+    ? "en"
+    : "zh";
   const [saving, setSaving] = useState(false);
   const [lookup, setLookup] = useState<{
     name: string;
@@ -179,7 +185,7 @@ export function SkillCreationResultCard({
       </p>
       {isSaved ? (
         <Button asChild size="sm" variant="outline">
-          <Link href="/skill-space?tab=mine">
+          <Link href={`/${locale}/skill-space?tab=mine`}>
             {t("workbench.creation.openSkills", "查看我的 Skills")}
           </Link>
         </Button>
```

**File**: `frontend/tests/workbench/AgentPicker.test.tsx` (modified, +17/-1)
```diff
@@ -26,7 +26,8 @@ vi.mock("@/features/workbench/hooks/useResourceTags", () => ({
     visibleIds: null,
   }),
 }));
-vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
+const routerPush = vi.hoisted(() => vi.fn());
+vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));
 const empty = vi.hoisted(() => []);
 const agent = {
   id: "8",
@@ -52,6 +53,21 @@ beforeEach(() => {
   });
   vi.mocked(importAgentFromRepository).mockResolvedValue({ agent_id: 99 });
 });
+it("opens the selected Agent's configuration route from the picker", async () => {
+  render(
+    <QueryClientProvider client={new QueryClient()}>
+      <AgentPicker
+        open
+        agents={[agent]}
+        onSelect={vi.fn()}
+        onCancel={vi.fn()}
+      />
+    </QueryClientProvider>
+  );
+
+  await userEvent.click(screen.getByRole("button", { name: "编辑" }));
+  expect(routerPush).toHaveBeenCalledWith("/zh/agents/8");
+});
 it("paginates six agents and resets the page on search", async () => {
   render(
     <QueryClientProvider client={new QueryClient()}>
```

---

### Incident Patch 7: `0c9ff869` (2026-09-29)
**Commit Message**: fix: show repository status in paged agent list (#4039)

* update version style

* 删除右下角“联系我们”，优化超级管理员界面

* fix(frontend): keep agent conversations visible after returning

* fix: show repository status in paged agent list

* fix(frontend): move skill listing action to more menu

* fix: restrict agent repository review data in paged list

* fix(frontend): return from chat when thread reload fails

---------

Co-authored-by: Summer-Si <[REDACTED_EMAIL]>

**File**: `backend/apps/agent_app.py` (modified, +5/-0)
```diff
@@ -837,6 +837,9 @@ async def list_agent_page_api(
     search_tag_predicates: Optional[str] = Query(None, description="Text-search tag predicates as JSON"),
     page: int = Query(1, ge=1, description="Page number starting from 1"),
     page_size: int = Query(20, ge=1, le=100, description="Items per page"),
+    include_repository_info: bool = Query(
+        False, description="Include repository listings for agents on this page"
+    ),
     authorization: Optional[str] = Header(None),
     request: Request = None,
 ):
@@ -852,11 +855,13 @@ async def list_agent_page_api(
         kwargs = {
             "tenant_id": resolved_tenant_id,
             "user_id": user_id,
+            "caller_tenant_id": auth_tenant_id,
             "permission": permission,
             "tag": tag,
             "search": search,
             "page": page,
             "page_size": page_size,
+            "include_repository_info": include_repository_info,
         }
         if created_by:
             kwargs["created_by"] = created_by
```

**File**: `backend/database/agent_repository_db.py` (modified, +7/-2)
```diff
@@ -354,14 +354,15 @@ def list_agent_repository_by_agent_ids(
     *,
     statuses: Collection[str],
     publisher_tenant_id: str,
+    publisher_user_id: Optional[str] = None,
 ) -> List[dict]:
     """List repository rows for the given agents, scoped to publisher tenant and statuses."""
     if not agent_ids:
         return []
 
     status_list = list(statuses)
     with get_db_session() as session:
-        rows = (
+        query = (
             session.query(
                 AgentRepository.agent_repository_id,
                 AgentRepository.agent_id,
@@ -377,7 +378,11 @@ def list_agent_repository_by_agent_ids(
                 AgentRepository.agent_id.in_(agent_ids),
                 AgentRepository.status.in_(status_list),
             )
-            .order_by(
+        )
+        if publisher_user_id is not None:
+            query = query.filter(AgentRepository.publisher_user_id == publisher_user_id)
+        rows = (
+            query.order_by(
                 AgentRepository.agent_id,
                 AgentRepository.create_time.desc(),
             )
```

**File**: `backend/management/services/agent/management.py` (modified, +70/-0)
```diff
@@ -14,6 +14,7 @@
 from agents.create_agent_info import create_tool_config_list
 from utils.agent_transfer_utils import portable_tool_params, validate_import_tool_params
 from services.agent_version_service import publish_version_impl
+from consts.agent_repository import STATUS_PENDING_REVIEW, STATUS_REJECTED, STATUS_SHARED
 from consts.const import TOOL_TYPE_MAPPING, \
     MODEL_CONFIG_MAPPING, CAN_EDIT_ALL_USER_ROLES, PERMISSION_PRIVATE
 from consts.exceptions import (
@@ -67,6 +68,7 @@
 )
 from database import skill_db
 from management.services.skill.service import SkillService
+from database.agent_repository_db import list_agent_repository_by_agent_ids
 from database.agent_version_db import batch_search_version_names, query_version_list
 from database.group_db import query_group_ids_by_user
 from database.user_tenant_db import get_user_tenant_by_user_id
@@ -922,6 +924,7 @@ async def list_all_agent_info_impl(
 async def list_agent_page_impl(
     tenant_id: str,
     user_id: str,
+    caller_tenant_id: Optional[str] = None,
     permission: Optional[str] = None,
     tag: Optional[str] = None,
     search: Optional[str] = None,
@@ -932,6 +935,7 @@ async def list_agent_page_impl(
     created_by_not: Optional[str] = None,
     tag_predicates: Optional[list] = None,
     search_tag_predicates: Optional[list] = None,
+    include_repository_info: bool = False,
 ) -> Dict[str, Any]:
     """List visible agents with server-side filters and pagination."""
     if created_by and created_by_not:
@@ -1127,6 +1131,72 @@ async def list_agent_page_impl(
             )
             agent["version_label"] = version.get("version_name")
             agent["version_create_time"] = version.get("create_time")
+    if include_repository_info:
+        for scope_tenant_id in tenant_ids:
+            scoped_agents = [
+                agent for scope, agent in paged_scoped_agents
+                if scope == scope_tenant_id
+            ]
+            if not scoped_agents:
+                continue
+            scoped_agent_ids = [int(agent["agent_id"]) for agent in scoped_agents]
+            shared_records = list_agent_repository_by_agent_ids(
+                scoped_agent_ids,
+                statuses=(STATUS_SHARED,),
+                publisher_tenant_id=scope_tenant_id,
+            )
+            publisher_records = []
+            if scope_tenant_id == caller_tenant_id and user_role == "ADMIN":
+                publisher_records = list_agent_repository_by_agent_ids(
+                    scoped_agent_ids,
+                    statuses=(STATUS_PENDING_REVIEW, STATUS_REJECTED, STATUS_SHARED),
+                    publisher_tenant_id=scope_tenant_id,
+                )
+            elif scope_tenant_id == caller_tenant_id and user_role == "DEV":
+                publisher_records = list_agent_repository_by_agent_ids(
+                    scoped_agent_ids,
+                    statuses=(STATUS_PENDING_REVIEW, STATUS_REJECTED, STATUS_SHARED),
+                    publisher_tenant_id=scope_tenant_id,
+                    publisher_user_id=user_id,
+                )
+            records_by_id = {
+                int(record["agent_repository_id"]): (record, False)
+                for record in shared_records
+                if record["status"] == STATUS_SHARED
+            }
+            records_by_id.update({
+                int(record["agent_repository_id"]): (record, True)
+                for record in publisher_records
+            })
+            repository_by_agent_id: dict[int, list[dict]] = {}
+            for record, is_publisher in records_by_id.values():
+                created_at = record.get("create_time")
+                repository_by_agent_id.setdefault(int(record["agent_id"]), []).append(
+                    {
+                        "agent_repository_id": record["agent_repository_id"],
+                        "status": record["status"],
+                        "version_no": record["version_no"],
+                        "version_label": record.get("version_name"),
+                        "create_time": (
+                            created_at.isoformat()
+                            if hasattr(created_at, "isoformat")
+                            else created_at
+                        ),
+                        "content": record.get("content") if is_publisher else None,
+                    }
+                )
+            for records in repository_by_agent_id.values():
+                records.sort(
+                    key=lambda item: (
+                        str(item["create_time"] or ""),
+                        int(item["agent_repository_id"]),
+                    ),
+                    reverse=True,
+                )
+            for agent in scoped_agents:
+                agent["repository_info"] = repository_by_agent_id.get(
+                    int(agent["agent_id"]), []
+                )
     paged_agents = [agent for _, agent in paged_scoped_agents]
     return {
       
```

**File**: `frontend/app/[locale]/agent-space/components/MyAgentCard.tsx` (modified, +25/-38)
```diff
@@ -1,9 +1,7 @@
 "use client";
 
-import { Button, Dropdown, Spin, Tooltip } from "antd";
+import { Button, Dropdown, Tooltip } from "antd";
 import type { MenuProps } from "antd";
-import { useState } from "react";
-import { useAgentRepositoryListings } from "@/hooks/agentRepository/useAgentRepositoryListings";
 import {
   ClipboardCheck,
   Clock,
@@ -21,7 +19,7 @@ import { getUnavailableReasonLabels } from "@/lib/agentLabelMapper";
 import {
   formatMineDate,
   getMineCardMenuActions,
-  toMineRepositoryInfo,
+  getMineCardRepositoryStatusBadge,
   type MineCardMenuAction,
 } from "@/lib/agentRepositoryMine";
 import type { MyEditableAgentItem } from "@/types/agentRepository";
@@ -69,16 +67,6 @@ export function MyAgentCard({
   isDeleting = false,
 }: MyAgentCardProps) {
   const { t } = useTranslation("common");
-  const [menuOpen, setMenuOpen] = useState(false);
-  const {
-    data: listingData,
-    isLoading: isListingLoading,
-    isError: isListingError,
-    refetch,
-  } = useAgentRepositoryListings(
-    { agent_id: agent.agent_id, page: 1, page_size: 100 },
-    menuOpen || guideMenuOpen === true
-  );
 
   const title = agent.name?.trim() || t("agentRepository.card.untitled");
   const description =
@@ -88,8 +76,6 @@ export function MyAgentCard({
     agent.unavailable_reasons ?? [],
     t
   );
-  const repositoryInfo = toMineRepositoryInfo(listingData?.items ?? []);
-  const agentWithRepository = { ...agent, repository_info: repositoryInfo };
   const { canOpen: published } = getAgentUsageGuideAccess({
     currentVersionNo: agent.current_version_no,
     permission: agent.permission,
@@ -99,9 +85,10 @@ export function MyAgentCard({
   const canEdit = agent.permission !== "READ_ONLY";
   const canView = (agent.current_version_no ?? 0) > 0;
   const canEvaluate = canView;
-  const menuActions = listingData
-    ? getMineCardMenuActions(agentWithRepository)
-    : [];
+  const menuActions = getMineCardMenuActions(agent);
+  const repositoryBadge = getMineCardRepositoryStatusBadge(
+    agent.repository_info
+  );
 
   const menuItems: MenuProps["items"] = menuActions.map((action) => {
     const icon =
@@ -122,29 +109,13 @@ export function MyAgentCard({
           return;
         }
         onViewReview(
-          agentWithRepository,
+          agent,
           action === "reviewUpdate" ? "reviewUpdate" : "review"
         );
       },
     };
   });
 
-  if (isListingLoading) {
-    menuItems.unshift({
-      key: "loading",
-      label: <Spin size="small" />,
-      disabled: true,
-    });
-  } else if (isListingError) {
-    menuItems.unshift({
-      key: "retry",
-      label: t("repository.common.retry"),
-      onClick: () => {
-        void refetch();
-      },
-    });
-  }
-
   if (canEvaluate) {
     menuItems.push({
       key: "evaluate",
@@ -223,7 +194,7 @@ export function MyAgentCard({
             <Dropdown
               menu={{ items: menuItems }}
               open={guideMenuOpen}
-              onOpenChange={onGuideMenuOpenChange ?? setMenuOpen}
+              onOpenChange={onGuideMenuOpenChange}
               trigger={["click"]}
             >
               <Button
@@ -236,7 +207,23 @@ export function MyAgentCard({
               />
             </Dropdown>
           ) : null}
-          <div className="flex items-center gap-1.5">
+          <div className="flex flex-wrap items-center justify-end gap-1.5">
+            {repositoryBadge ? (
+              <span
+                className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
+                  repositoryBadge.variant === "pending"
+                    ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
+                    : repositoryBadge.variant === "rejected"
+                      ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
+                      : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
+                }`}
+              >
+                {t(repositoryBadge.labelKey)}
+                {repositoryBadge.versionLabel
+                  ? ` · ${repositoryBadge.versionLabel}`
+                  : null}
+              </span>
+            ) : null}
             {agent.is_available === false ? (
               <Tooltip
                 title={
```

**File**: `frontend/app/[locale]/agent-space/my-agent.tsx` (modified, +3/-10)
```diff
@@ -158,6 +158,7 @@ export function MyAgent({
     (): AgentListFilters => ({
       tenantId: user?.tenantId ?? null,
       enabled: active,
+      includeRepositoryInfo: true,
       page,
       pageSize,
       search: searchQuery.trim() || undefined,
@@ -697,15 +698,7 @@ export function MyAgent({
             }`}
           >
             {t(ownershipLabelKey[filter])}
-            <span
-              className={`rounded px-1.5 text-xs ${
-                ownership === filter
-                  ? "bg-white/20"
-                  : "bg-white/70 text-slate-500 dark:bg-slate-900/50 dark:text-slate-400"
-              }`}
-            >
-              {counts[filter]}
-            </span>
+            <span className="text-xs opacity-80">{counts[filter]}</span>
           </button>
         ))}
       </div>
@@ -888,7 +881,7 @@ function toMyAgentItem(agent: Agent): MyEditableAgentItem {
     version_create_time: agent.version_create_time ?? null,
     permission: agent.permission,
     tags: agent.tags,
-    repository_info: [],
+    repository_info: agent.repository_info ?? [],
   };
 }
 
```

**File**: `frontend/app/[locale]/mcp-space/components/McpToolsSearchFilterBar.tsx` (modified, +1/-7)
```diff
@@ -72,13 +72,7 @@ export default function McpToolsSearchFilterBar({
       }`}
     >
       <span>{item.label}</span>
-      <span
-        className={`ml-1.5 rounded-full px-1.5 text-xs ${
-          selected ? "bg-white/20 text-white" : "bg-white text-slate-500"
-        }`}
-      >
-        {item.count}
-      </span>
+      <span className="ml-1 text-xs opacity-80">{item.count}</span>
     </button>
   );
 
```

**File**: `frontend/app/[locale]/mcp-space/components/MineMcpServiceCard.tsx` (modified, +5/-1)
```diff
@@ -304,7 +304,11 @@ export default function MineMcpServiceCard({
           <Button
             type="text"
             size="small"
-            className="!text-slate-600 hover:!bg-transparent hover:!text-blue-500"
+            className={
+              isEnabled
+                ? "!bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100 hover:!text-emerald-800 dark:!bg-emerald-900/30 dark:!text-emerald-300 dark:hover:!bg-emerald-900/50"
+                : "!text-slate-600 hover:!bg-transparent hover:!text-blue-500"
+            }
             loading={toggling}
             icon={<Power className="size-3.5" />}
             onClick={() => onToggle(localService)}
```

**File**: `frontend/app/[locale]/newchat/assistant-ui/thread-list.tsx` (modified, +67/-55)
```diff
@@ -39,6 +39,7 @@ import log from "@/lib/logger";
 import { conversationService } from "@/services/conversationService";
 import type { FC } from "react";
 import { setPendingThreadOperationId } from "../adapter/conversation-thread-list-adapter";
+import { getVisibleThreadIds } from "./visible-thread-ids";
 
 // Conversation status indicator component
 const ConversationStatusIndicator: FC<{
@@ -89,7 +90,8 @@ const useBatchSelection = (): BatchSelectionValue | null =>
 export const BatchSelectionProvider: FC<{
   children: ReactNode;
   onNewConversation?: () => void | Promise<void>;
-}> = ({ children, onNewConversation }) => {
+  serverConversationIds?: ReadonlyMap<string, string>;
+}> = ({ children, onNewConversation, serverConversationIds }) => {
   const { t } = useTranslation();
   const aui = useAui();
   const { confirm } = useConfirmModal();
@@ -109,8 +111,13 @@ export const BatchSelectionProvider: FC<{
   }, []);
 
   const selectAllVisible = useCallback(() => {
-    setSelectedIds(() => new Set(threadIds));
-  }, [threadIds]);
+    setSelectedIds(
+      () =>
+        new Set(
+          getVisibleThreadIds(threadIds, threadItems, serverConversationIds)
+        )
+    );
+  }, [threadIds, threadItems, serverConversationIds]);
 
   const clear = useCallback(() => setSelectedIds(new Set()), []);
 
@@ -132,9 +139,10 @@ export const BatchSelectionProvider: FC<{
     );
     const conversationIds: number[] = [];
     for (const id of selectedIds) {
-      const remoteId = itemsById.get(id)?.remoteId;
-      const num = Number(remoteId);
-      if (remoteId && Number.isInteger(num) && num > 0) {
+      const conversationId =
+        serverConversationIds?.get(id) || itemsById.get(id)?.remoteId;
+      const num = Number(conversationId);
+      if (conversationId && Number.isInteger(num) && num > 0) {
         conversationIds.push(num);
       }
     }
@@ -144,7 +152,8 @@ export const BatchSelectionProvider: FC<{
     // If so, the main panel must switch to a fresh thread after reload,
     // otherwise it would keep pointing at a now-deleted conversation.
     const activeRemoteId = mainThreadId
-      ? itemsById.get(mainThreadId)?.remoteId
+      ? serverConversationIds?.get(mainThreadId) ||
+        itemsById.get(mainThreadId)?.remoteId
       : undefined;
     const activeConversationId = Number(activeRemoteId);
     const activeDeleted =
@@ -184,6 +193,7 @@ export const BatchSelectionProvider: FC<{
     selectedIds,
     threadItems,
     mainThreadId,
+    serverConversationIds,
     confirm,
     t,
     aui,
@@ -295,39 +305,39 @@ export const BatchSidebarFooter: FC<{ onSwitchToLegacy?: () => void }> = ({
 
 interface ThreadListProps {
   generatedTitles?: ReadonlyMap<string, string>;
+  serverConversationIds?: ReadonlyMap<string, string>;
 }
 
 export const ThreadList: FC<ThreadListProps> = ({
   generatedTitles,
+  serverConversationIds,
 }) => {
   const { t } = useTranslation();
   const completedConversations = useMemo(() => new Set<string>(), []);
   const isLoading = useAuiState((s) => s.threads.isLoading);
   const isLoadingMore = useAuiState((s) => s.threads.isLoadingMore);
   const hasMore = useAuiState((s) => s.threads.hasMore);
+  const threadIds = useAuiState((s) => s.threads.threadIds);
+  const threadItems = useAuiState((s) => s.threads.threadItems);
+  const visibleThreadIds = getVisibleThreadIds(
+    threadIds,
+    threadItems,
+    serverConversationIds
+  );
 
   return (
     <div className="flex flex-col p-2">
       <AuiIf condition={(s) => s.threads.isLoading}>
         <ThreadListSkeleton />
       </AuiIf>
-      <AuiIf
-        condition={(s) =>
-          !s.threads.isLoading && s.threads.threadIds.length === 0
-        }
-      >
-        <ThreadListEmpty />
-      </AuiIf>
-      <AuiIf
-        condition={(s) =>
-          !s.threads.isLoading && s.threads.threadIds.length > 0
-        }
-      >
+      {!isLoading && visibleThreadIds.length === 0 && <ThreadListEmpty />}
+      {!isLoading && visibleThreadIds.length > 0 && (
         <ThreadListItems
           completedConversations={completedConversations}
           generatedTitles={generatedTitles}
+          visibleThreadIds={visibleThreadIds}
         />
-      </AuiIf>
+      )}
       <ThreadListPrimitive.LoadMore
         disabled={!hasMore || isLoading || isLoadingMore}
         className="mt-1 flex h-8 w-full items-center justify-center gap-2 rounded-lg px-3 text-xs text-muted-foreground hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
@@ -363,51 +373,45 @@ const ThreadListEmpty: FC = () => {
 interface ThreadListItemsProps {
   completedConversations: Set<string>;
   generatedTitles?: ReadonlyMap<string, string>;
+  visibleThreadIds: string[];
 }
 
 const ThreadListItems: FC<ThreadListItemsProps> = ({
   completedConversations,
   generatedTitles,
+  visibleThreadIds,
 }) => {
   const { t } = useTranslation();
 
-  const groups = useThreadListGroups();
+  const groups = useThreadListG
```

---

### Incident Patch 8: `a5b16754` (2026-09-28)
**Commit Message**: Fix: AIDP document list history merge, processing order and creation time (#4016)

* Fix: keep ingested AIDP documents visible when the channel history is used

The document list switched data sources instead of combining them: while the
resolved channel directory was empty the list was served from the knowledge-base
scoped listing, and as soon as one upload landed in that directory the all-status
history took over. The history only covers the resolved channel directory, so
every file ingested into another directory disappeared from the list right after
an upload — reported on 2.6.1 for files that were created before the upgrade.

Merge the two sources instead:

- The knowledge-base scoped listing guarantees membership, the history supplies
  the live statuses, and a file only the history knows about (still uploading,
  or failed before ingestion) is kept exactly as reported.
- Items are matched through every identity they expose, so a file that one
  payload describes with a uuid and the other with an ino number stays one row.
- Files taken from the listing are marked COMPLETED, which is all that listing
  ever returns.

The listing is read in pages of 100, capped at 20 pages, and

**File**: `backend/ext_components/aidp/apps/aidp_mgmt_app.py` (modified, +325/-28)
```diff
@@ -86,7 +86,9 @@
 # every other reported status is counted as work in progress: `processing_count`
 # is what keeps the frontend polling, and a build that reports a stage we do not
 # know yet must not stop it early either.
-_TERMINAL_DOC_STATUSES = ("COMPLETED", "FAILED")
+_DOC_STATUS_COMPLETED = "COMPLETED"
+_DOC_STATUS_FAILED = "FAILED"
+_TERMINAL_DOC_STATUSES = (_DOC_STATUS_COMPLETED, _DOC_STATUS_FAILED)
 
 
 def _upload_failure(file_name: str, reason_zh: str, reason_en: str) -> dict:
@@ -404,6 +406,112 @@ def _resolve_doc_history_channel(
     return channel
 
 
+# How many history pages one document-list request may read. The endpoint is
+# paginated and puts files that are still being processed in front, so a burst
+# of simultaneous uploads can spill past the first page.
+_HISTORY_PAGE_LIMIT = 20
+
+
+def _history_reports_more(payload: dict) -> bool | None:
+    """Whether the payload explicitly says another history page exists.
+
+    Only unambiguous signals are trusted: this endpoint family reports
+    ``total_count`` as the size of the current page elsewhere, so it cannot be
+    read as a grand total. ``None`` means the payload does not say, and the
+    caller has to ask for the next page to find out.
+    """
+    has_more = payload.get("has_more")
+    if isinstance(has_more, bool):
+        return has_more
+    if "next_link" in payload:
+        return bool(payload.get("next_link"))
+    return None
+
+
+async def _load_doc_history_items(
+    server_url: str,
+    api_key: str,
+    kds_id: str,
+    fs_id: str,
+    dir_path: str,
+) -> list[dict]:
+    """Read the channel directory's all-status history across its pages.
+
+    Reading only the first page would drop precisely the files this listing
+    exists to show: the endpoint sorts files that are still being processed to
+    the front, so more simultaneous uploads than fit in a page push the rest out
+    of view.
+
+    The walk stops at an empty page, stops when the payload says there is no
+    further page, and stops when a page adds nothing new — the last one keeps a
+    build that ignores ``page`` from looping over the same files. It is capped
+    at ``_HISTORY_PAGE_LIMIT`` so one list request cannot turn into an unbounded
+    number of upstream calls; reaching the cap is logged because the files
+    beyond it are then unknown.
+    """
+    collected: list[dict] = []
+    seen: set[str] = set()
+    for page in range(1, _HISTORY_PAGE_LIMIT + 1):
+        payload = await run_blocking(
+            "aidp-doc-history",
+            list_aidp_doc_history_impl,
+            server_url,
+            api_key,
+            fs_id,
+            dir_path,
+            kds_id,
+            None,
+            page,
+            lane="control-io",
+            owner="config",
+        )
+        raw_items = payload.get("value") if isinstance(payload, dict) else None
+        page_items = (
+            [item for item in raw_items if isinstance(item, dict)]
+            if isinstance(raw_items, list)
+            else []
+        )
+        if not page_items:
+            return collected
+
+        added = 0
+        for item in page_items:
+            identities = _document_identities(item)
+            key = identities[0] if identities else f"anonymous-{page}-{len(collected)}"
+            if key in seen:
+                continue
+            seen.add(key)
+            collected.append(item)
+            added += 1
+
+        reported_more = (
+            _history_reports_more(payload) if isinstance(payload, dict) else None
+        )
+        if reported_more is False:
+            return collected
+        if added == 0:
+            # The same page came back again, so this build does not honour
+            # `page`: stop instead of looping over the same files, but say so,
+            # because everything beyond the first page stays invisible.
+            logger.warning(
+                "AIDP file history for KB %s answered page %d without new items (%d read); "
+                "the endpoint appears to ignore `page`, so files beyond the first page stay "
+                "invisible",
+                kds_id,
+                page,
+                len(collected),
+            )
+            return collected
+    logger.warning(
+        "AIDP file history for KB %s reached %d pages (%d files); the statuses of further "
+        "files are not read",
+        kds_id,
+        _HISTORY_PAGE_LIMIT,
+        len(collected),
+    )
+    return collected
+
+
 async def _load_doc_history(
     server_url: str,
     api_key: str,
@@ -430,19 +538,14 @@ async def _load_doc_history(
         if not channel:
             # The reason is reported by ``_resolve_doc_history_channel``.
             return None
-        history = await run_blocking(
-            "aidp-doc-history",
-            list_aidp_doc_history_impl,
+        items = await _load_doc_history_items(
             server_url,
             api_key,
+            kds_id,

```

**File**: `backend/ext_components/aidp/services/aidp_service.py` (modified, +71/-12)
```diff
@@ -241,20 +241,68 @@ def _extract_list_payload(payload: Any) -> list | None:
     return None
 
 
+def _timestamp_or_iso(value: Any) -> str | None:
+    """Return an ISO-8601 string for a Unix timestamp or an already-ISO value.
+
+    AIDP spells the creation time two ways: the document listing reports
+    ``first_upload_time`` / ``create_time`` as Unix seconds, while the
+    knowledge-file history already sends the canonical ``created_at`` as an ISO
+    string. Both spellings have to survive normalization, otherwise the history
+    rows lose a column the listing rows keep.
+    """
+    if isinstance(value, str):
+        text = value.strip()
+        if not text:
+            return None
+        try:
+            float(text)
+        except ValueError:
+            # Already an ISO-8601 string: keep it verbatim.
+            return text
+        value = text
+    return _timestamp_to_iso(value)
+
+
+# Spellings AIDP uses for a document timestamp, in priority order. The history
+# endpoint sends the canonical ``created_at``, the listing reports the upload
+# stamp, and ``update_time`` closes the chain because a file AIDP has not
+# finished registering yet reports no creation time at all — for a freshly
+# uploaded file the update stamp is the moment it was accepted, which beats
+# leaving the column empty.
+_CREATED_AT_KEYS = ("first_upload_time", "create_time", "created_at", "update_time")
+_UPDATED_AT_KEYS = ("update_time", "updated_at")
+
+
+def _first_reported(raw: Dict[str, Any], keys: tuple[str, ...]) -> Any:
+    """Return the first value ``raw`` reports for ``keys``, skipping blanks.
+
+    ``None``, an empty string and ``False`` all mean "not reported": AIDP sends
+    any of them for unset fields. Treating the blank spelling as a value would
+    shadow the next key in the chain, which is how an empty ``create_time`` hid a
+    populated ``created_at`` and left the creation time null.
+    """
+    for key in keys:
+        value = raw.get(key)
+        if value is None or value == "" or value is False:
+            continue
+        return value
+    return None
+
+
 def _normalize_aidp_doc(raw: Dict[str, Any]) -> Dict[str, Any]:
     """Map an AIDP document item to the shape the frontend expects.
 
-    AIDP returns ``first_upload_time`` / ``create_time`` as the creation timestamp
-    and ``update_time`` as the last-modified timestamp. The frontend schema
-    expects ``created_at`` (ISO string). This mapper performs that conversion
-    and carries through all other fields unchanged.
+    AIDP spells the timestamps several ways: the document listing reports
+    ``first_upload_time`` / ``create_time`` as Unix seconds, while the
+    knowledge-file history already sends the canonical ``created_at`` as an ISO
+    string, and either side may send an unset field as ``""``. Both spellings
+    therefore have to be accepted, and blank ones skipped, so a history row keeps
+    the creation time instead of losing it here. All other fields are carried
+    through unchanged.
     """
     out = dict(raw)
-    created_raw = raw.get("first_upload_time") or raw.get("create_time")
-    out["created_at"] = _timestamp_to_iso(created_raw)
-
-    updated_raw = raw.get("update_time")
-    out["updated_at"] = _timestamp_to_iso(updated_raw)
+    out["created_at"] = _timestamp_or_iso(_first_reported(raw, _CREATED_AT_KEYS))
+    out["updated_at"] = _timestamp_or_iso(_first_reported(raw, _UPDATED_AT_KEYS))
     return out
 
 
@@ -1732,18 +1780,25 @@ def list_aidp_doc_history_impl(
     dir_path: str,
     kds_id: str,
     tenant_id: str | None = None,
+    page: int = 1,
 ) -> Dict[str, Any]:
-    """List every file in a channel directory regardless of processing status.
+    """List a page of a channel directory regardless of processing status.
 
     Endpoint: ``POST /KnowledgeBase/Tenants/{tenant}/KnowledgeBases/{kds_id}/KnowledgeFiles/History``
-    Body: ``{"fs_id": <str>, "dir_path": <str>}``
+    Body: ``{"fs_id": <str>, "dir_path": <str>, "page": <int>}``
     Response: ``{"value": [<document with status>, ...]}``
 
     Unlike ``list_aidp_docs_impl`` this returns files that are still being
     chunked/embedded (``PROCESSING``) or that failed (``FAILED``), which is what
     lets the UI show an upload immediately instead of only after ingestion.
+
+    The endpoint is paginated (``page`` is one-based) and sorts files that are
+    still being processed to the front, so a burst of simultaneous uploads can
+    spill past the first page: callers must walk the pages instead of reading
+    only the first one.
     """
     normalized_url = _validate_params(server_url, api_key)
+    normalized_page = page if isinstance(page, int) and page > 0 else 1
 
     if not isinstance(kds_id, str) or not kds_id.strip():
         raise AppException(
@@ -1782,7 +1837,11 @@ def list_aidp_doc_history_impl(
             lambda: client.post(
                 history_url,
                 headers=headers,
-            
```

**File**: `test/ext_components/aidp/mock_servers/aidp_mgmt_mock_server.py` (modified, +46/-3)
```diff
@@ -24,6 +24,10 @@
     non-terminal ``UPLOADING`` / ``EXTRACTING`` stages.
   * ``GET .../KnowledgeFiles`` keeps returning COMPLETED documents only (mirrors
     real AIDP), while ``POST .../KnowledgeFiles/History`` returns every status.
+  * ``POST .../KnowledgeFiles/History`` is paginated (body ``page``, ten entries
+    per page) and lists files that are still being processed first, so a burst of
+    simultaneous uploads spills onto the next page and the caller has to walk the
+    pages. Tune the page size with ``POST /_mock/history-page-size?size=N``.
 
 Knowledge base + document state is persisted to ``_state/knowledge_bases.json``
 (next to this file). On restart the mock loads the file, so KBs created by
@@ -90,6 +94,10 @@
 # Overridable at runtime through POST /_mock/processing-seconds.
 _PROCESSING_SECONDS = 8.0
 
+# Entries one history page returns. Real AIDP pages the channel directory, so the
+# backend has to walk the pages; keep this small to exercise that locally.
+_HISTORY_PAGE_SIZE = 10
+
 # Directory for persisted runtime state. Lives next to this file so the mock
 # is self-contained (no absolute paths) and stays out of version control via
 # ``.gitignore``. Only KB + document state is persisted; failure-injection
@@ -343,6 +351,7 @@ class DocHistoryBody(BaseModel):
 
     fs_id: Optional[str] = None
     dir_path: Optional[str] = None
+    page: int = 1
 
 
 class DocStatusBody(BaseModel):
@@ -489,6 +498,21 @@ def set_processing_seconds(
     return JSONResponse(content={"processing_seconds": _PROCESSING_SECONDS})
 
 
+@app.post("/_mock/history-page-size")
+def set_history_page_size(
+    size: int = Query(10, ge=1, le=1000, description="Entries returned per history page"),
+) -> JSONResponse:
+    """Tune how many entries one history page returns.
+
+    Set it to 1 to make every file land on its own page, which is how the
+    multi-page walk is exercised locally.
+    """
+    global _HISTORY_PAGE_SIZE
+    _HISTORY_PAGE_SIZE = size
+    logger.info("MOCK CONFIG  history page size = %s", size)
+    return JSONResponse(content={"history_page_size": _HISTORY_PAGE_SIZE})
+
+
 @app.post("/_mock/doc-status")
 def force_doc_status(body: DocStatusBody) -> JSONResponse:
     """Force one document into a given status (used to render a stage in the UI)."""
@@ -965,11 +989,30 @@ def knowledge_file_history(
         }
         for doc in _DOCUMENTS_BY_KB.get(kds_id, [])
     ]
+    # Real AIDP lists files that are still being processed first and pages the
+    # directory, which is what lets more simultaneous uploads than fit in one
+    # page spill onto the next. Mirrored here, so a caller that reads only the
+    # first page is caught locally instead of in production. The sort is stable,
+    # so documents keep their insertion order inside each group.
+    items.sort(key=lambda item: item["status"] in _TERMINAL_STATUSES)
+    page = body.page if isinstance(body.page, int) and body.page > 0 else 1
+    start = (page - 1) * _HISTORY_PAGE_SIZE
+    end = start + _HISTORY_PAGE_SIZE
+    page_items = items[start:end]
+    next_link = (
+        f"{_KB_PREFIX}/{kds_id}/KnowledgeFiles/History?page={page + 1}"
+        if end < len(items)
+        else None
+    )
     logger.info(
-        "FILE HISTORY  kds_id=%s fs_id=%s dir_path=%s returned=%d",
-        kds_id, body.fs_id, body.dir_path, len(items),
+        "FILE HISTORY  kds_id=%s fs_id=%s dir_path=%s page=%d returned=%d total=%d",
+        kds_id, body.fs_id, body.dir_path, page, len(page_items), len(items),
     )
-    return JSONResponse(content={"value": items})
+    return JSONResponse(content={
+        "value": page_items,
+        "total_count": len(items),
+        "next_link": next_link,
+    })
 
 
 # =============================================================================
```

**File**: `test/ext_components/aidp/test_aidp_mgmt_app.py` (modified, +418/-13)
```diff
@@ -1605,7 +1605,8 @@ def test_history_source_report_statuses_and_processing_count(self):
                           return_value=self._CHANNELS), \
              patch.object(aidp_mgmt_app, "list_aidp_doc_history_impl",
                           return_value=history) as mock_history, \
-             patch.object(aidp_mgmt_app, "list_aidp_docs_impl") as mock_completed, \
+             patch.object(aidp_mgmt_app, "list_aidp_docs_impl",
+                          return_value={"value": []}) as mock_completed, \
              patch.object(aidp_mgmt_app, "count_aidp_docs_impl") as mock_count:
             response = client.get(
                 "/aidp-mgmt/knowledge-bases/kb-1/documents",
@@ -1625,16 +1626,287 @@ def test_history_source_report_statuses_and_processing_count(self):
         assert body["has_more"] is False
         assert body["total_reliable"] is True
         assert body["processing_count"] == 1
-        # The history payload is authoritative: the completed-files listing and
-        # its Count endpoint must not be hit at all.
-        mock_history.assert_called_once()
-        # The call carries the resolved channel plus the KB the path is scoped to.
-        assert mock_history.call_args.args[2:] == (
-            "fs-1", "/aidp/knowledge/kb-1", "kb-1",
+        # The history decides the statuses, but the knowledge-base scoped
+        # listing is still read: the history only covers the resolved channel
+        # directory, so it cannot decide membership on its own.
+        # The history is walked page by page; this stub answers every page with
+        # the same file set, so the walk stops at the page that adds nothing new
+        # instead of looping over it.
+        assert [entry.args[6] for entry in mock_history.call_args_list] == [1, 2]
+        assert mock_history.call_args_list[0].args[2:] == (
+            "fs-1", "/aidp/knowledge/kb-1", "kb-1", None, 1,
         )
-        mock_completed.assert_not_called()
+        mock_completed.assert_called_once()
+        assert mock_completed.call_args.args[2:] == ("kb-1", 1, 100)
+        # The merged set is complete in one pass, so Count is never needed.
         mock_count.assert_not_called()
 
+    def test_files_ingested_outside_the_channel_directory_stay_visible(self):
+        """A directory-scoped history must not hide files ingested elsewhere.
+
+        The regression this guards: while the resolved channel directory is
+        empty the list is served from the knowledge-base scoped listing, and as
+        soon as one upload lands in that directory the history takes over and
+        every file from another directory disappears.
+        """
+        client = _client()
+        from ext_components.aidp.apps import aidp_mgmt_app
+        from ext_components.aidp.services import aidp_permission_service
+
+        history = {
+            "value": [
+                {"file_uuid": "uuid-new", "file_ino_no": "f-new",
+                 "file_name": "new.pdf", "first_upload_time": 1718000900,
+                 "status": "UPLOADING"},
+            ]
+        }
+        listing = {
+            "value": [
+                {"file_ino_no": "f-legacy-a", "file_name": "legacy-a.txt",
+                 "create_time": 1718000000},
+                {"file_ino_no": "f-legacy-b", "file_name": "legacy-b.txt",
+                 "create_time": 1718000100},
+                {"file_ino_no": "f-new", "file_name": "new.pdf",
+                 "create_time": 1718000900},
+            ]
+        }
+
+        with patch.object(aidp_permission_service, "require_permission",
+                          return_value=self._read_only()), \
+             patch.object(aidp_mgmt_app, "get_cached_aidp_channels",
+                          return_value=self._CHANNELS), \
+             patch.object(aidp_mgmt_app, "list_aidp_doc_history_impl",
+                          return_value=history), \
+             patch.object(aidp_mgmt_app, "list_aidp_docs_impl",
+                          return_value=listing):
+            response = client.get(
+                "/aidp-mgmt/knowledge-bases/kb-1/documents",
+                headers=_bearer(),
+            )
+
+        assert response.status_code == HTTPStatus.OK
+        body = response.json()
+        # Everything is visible, newest first.
+        assert [item["file_ino_no"] for item in body["value"]] == [
+            "f-new", "f-legacy-b", "f-legacy-a",
+        ]
+        assert body["total_count"] == 3
+        # The upload carries the live status, the ingested files are done.
+        statuses = {item["file_ino_no"]: item["status"] for item in body["value"]}
+        assert statuses == {
+            "f-new": "UPLOADING",
+            "f-legacy-b": "COMPLETED",
+            "f-legacy-a": "COMPLETED",
+        }
+        # A file both sources know about stays a single row, even though only one
+        # of them reports its uuid.
+        assert len(body["value"]) == 3
+        assert body["processing_count"] == 
```

**File**: `test/ext_components/aidp/test_aidp_service.py` (modified, +53/-0)
```diff
@@ -914,6 +914,58 @@ def test_falls_back_to_create_time(self, normalize):
         result = normalize({"create_time": 1700000000})
         assert result["created_at"] is not None
 
+    def test_keeps_an_iso_created_at_the_payload_reports(self, normalize):
+        """The history endpoint already spells the creation time ``created_at``."""
+        result = normalize({"created_at": "2024-06-10T06:20:00Z", "file_name": "a.txt"})
+        assert result["created_at"] == "2024-06-10T06:20:00Z"
+        assert result["file_name"] == "a.txt"
+
+    def test_keeps_an_iso_updated_at_the_payload_reports(self, normalize):
+        result = normalize({"updated_at": "2024-06-10T06:20:00Z"})
+        assert result["updated_at"] == "2024-06-10T06:20:00Z"
+
+    def test_numeric_upload_time_wins_over_a_reported_created_at(self, normalize):
+        """A listing row reports both; the upload timestamp stays authoritative."""
+        result = normalize({
+            "first_upload_time": 1700000000,
+            "created_at": "2024-06-10T06:20:00Z",
+        })
+        assert "2023-11-14" in result["created_at"]
+
+    def test_numeric_string_timestamp_is_converted(self, normalize):
+        result = normalize({"created_at": "1700000000"})
+        assert "2023-11-14" in result["created_at"]
+
+    def test_history_item_keeps_its_created_at(self, aidp_service_module):
+        """Regression: the history's ``created_at`` used to be blanked to null."""
+        result = aidp_service_module._normalize_history_doc({
+            "file_uuid": "uuid-1",
+            "created_at": "2024-06-10T06:20:00Z",
+            "status": "uploading",
+        })
+        assert result["created_at"] == "2024-06-10T06:20:00Z"
+        assert result["status"] == "UPLOADING"
+
+    def test_empty_create_time_does_not_hide_a_reported_created_at(self, normalize):
+        """A blank ``create_time`` means "not reported", not a value to keep."""
+        result = normalize({
+            "create_time": "",
+            "created_at": "2024-06-10T06:20:00Z",
+            "update_time": 1700000000,
+        })
+        assert result["created_at"] == "2024-06-10T06:20:00Z"
+        assert "2023-11-14" in result["updated_at"]
+
+    def test_empty_first_upload_time_does_not_hide_create_time(self, normalize):
+        result = normalize({"first_upload_time": "", "create_time": 1700000000})
+        assert "2023-11-14" in result["created_at"]
+
+    def test_falls_back_to_update_time_when_no_creation_time_is_reported(self, normalize):
+        """A file AIDP has not registered yet reports only its update time."""
+        result = normalize({"update_time": 1700000000})
+        assert result["created_at"] is not None
+        assert result["created_at"] == result["updated_at"]
+
     def test_uses_update_time_for_updated_at(self, normalize):
         result = normalize({"update_time": 1700000000, "first_upload_time": 1600000000})
         assert result["updated_at"] is not None
@@ -2825,6 +2877,7 @@ def test_success_posts_body_and_normalizes_status(self, aidp_service_module):
         assert call_args.kwargs["json"] == {
             "fs_id": "fs-1",
             "dir_path": "/aidp/knowledge/kb-1",
+            "page": 1,
         }
         assert call_args.kwargs["headers"]["Authorization"] == "Bearer jwt-token"
 
```

---

### Incident Patch 9: `4e8aca76` (2026-09-28)
**Commit Message**: release(v2.7.0): sync main hotfix history, consolidate SQL migrations, bump version (#4024)

* merge v2.6.1 hotfix release from hotfix/v2.6.1 (#3971)

* 🐛 Fix(evaluation): run trials in runtime service (#3954)

* fix(evaluation): run trials in runtime service

Route trial evaluations through the authenticated Config-to-Runtime proxy and use Config's manager only for creation-stage preparation. Keep Agent execution and evaluator scoring in Runtime.

Co-authored-by: Codex <[REDACTED_EMAIL]>

Generated-by: gpt-5

* test(evaluation): stub config thread manager

Keep pure-logic service import tests aligned with the Config and Runtime thread-manager split.

Co-authored-by: Codex <[REDACTED_EMAIL]>

Generated-by: gpt-5

* test(evaluation): stub runtime jwt helper

* test(evaluation): cover trial proxy error paths

* Fix/override delete (#3958)

* Fix: override dialog only shows override values, not model defaults (deleted params no longer reappear)

* Fix: custom param deletion persists (null markers), per-agent capacity overrides take effect, and edit-dialog connectivity probe uses stored api_key

* Fix: rename ModelRequest.model_id to probe_model_id - model_dump() is spread into INSERT

**File**: `VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v2.6.0
+v2.7.0
```

**File**: `deploy/sql/migrations/README.md` (modified, +5/-3)
```diff
@@ -35,9 +35,11 @@ COLUMN IF NOT EXISTS`, and conflict-safe inserts where possible.
 Historical migrations through v2.4.0 are consolidated by minor version in
 `v2.2_merged_migrations.sql`, `v2.3_merged_migrations.sql`, and
 `v2.4_merged_migrations.sql`, and migrations since v2.4.0 are consolidated in
-`v2.5.0_merged_migrations.sql` and `v2.6.0_merged_migrations.sql` (which merges
-all migrations applied after the v2.5.1 release, through v2.6.0). Newer
-migrations remain separate until their minor-version history is consolidated.
+`v2.5.0_merged_migrations.sql`, `v2.6.0_merged_migrations.sql` (which merges
+all migrations applied after the v2.5.1 release, through v2.6.0), and
+`v2.7.0_merged_migrations.sql` (which merges all migrations applied after
+the v2.6.1 release, through v2.7.0). Newer migrations remain separate until
+their minor-version history is consolidated.
 
 Important: do NOT modify a `*_merged_migrations.sql` file after it has been
 deployed. Because it bundles many historical migrations, even a comment-only
```

**File**: `deploy/sql/migrations/v2.6.0_z_agent_repository_icon_url.sql` (removed, +0/-23)
```diff
@@ -1,23 +0,0 @@
--- Repository listings now store an optional uploaded image URL. Legacy emoji
--- values fall back to the deterministic agent icon after this migration.
-DO $$
-BEGIN
-  IF EXISTS (
-    SELECT 1 FROM information_schema.columns
-    WHERE table_schema = 'nexent' AND table_name = 'ag_agent_repository_t'
-      AND column_name = 'icon'
-  ) AND NOT EXISTS (
-    SELECT 1 FROM information_schema.columns
-    WHERE table_schema = 'nexent' AND table_name = 'ag_agent_repository_t'
-      AND column_name = 'icon_url'
-  ) THEN
-    ALTER TABLE nexent.ag_agent_repository_t RENAME COLUMN icon TO icon_url;
-    UPDATE nexent.ag_agent_repository_t SET icon_url = NULL;
-  END IF;
-END $$;
-
-ALTER TABLE nexent.ag_agent_repository_t
-  ALTER COLUMN icon_url TYPE VARCHAR(1024);
-
-COMMENT ON COLUMN nexent.ag_agent_repository_t.icon_url IS
-  'Repository icon URL; NULL uses the agent ID based default icon';
```

**File**: `deploy/sql/migrations/v2.6.1_001_remove_human_interaction.sql` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
--- Deploy only after all processes using the retired interaction engine have stopped.
--- Ordinary conversation messages and units are intentionally preserved.
-DROP TABLE IF EXISTS nexent.human_event_t;
-DROP TABLE IF EXISTS nexent.human_execution_t;
-DROP TABLE IF EXISTS nexent.human_request_t;
-DROP TABLE IF EXISTS nexent.human_run_t;
--- This function is used exclusively by the four tables removed above.
-DROP FUNCTION IF EXISTS nexent.human_interaction_audit_timestamp();
```

**File**: `deploy/sql/migrations/v2.6.1_002_remove_dev_models_menu.sql` (removed, +0/-10)
```diff
@@ -1,10 +0,0 @@
--- Remove the model management page from the DEV role menu.
--- Developers must not see or manage models; they only consume
--- administrator-configured models. RESOURCE MODEL READ is kept so
--- model pickers in agent editing keep working.
--- Pattern follows v2.3 migration that removed ASSET_OWNER /owner-manage.
-DELETE FROM nexent.role_permission_t
-WHERE user_role = 'DEV'
-  AND permission_category = 'VISIBILITY'
-  AND permission_type = 'LEFT_NAV_MENU'
-  AND permission_subtype = '/models';
```

**File**: `deploy/sql/migrations/v2.7.0_merged_migrations.sql` (renamed, +65/-0)
```diff
@@ -1,3 +1,67 @@
+-- Nexent merged SQL migrations: v2.7.0
+-- Previous release tag: v2.6.1
+-- Source bodies are embedded byte-for-byte in deployment order.
+-- Do not reorder or rewrite sections without equivalence validation.
+
+-- Source migration: v2.6.0_z_agent_repository_icon_url.sql
+-- Source SHA-256: 5ffc0a0389f5ed3ab0538139f0870f2d35fb10fdcbb91a62555774e886842d89
+
+-- Repository listings now store an optional uploaded image URL. Legacy emoji
+-- values fall back to the deterministic agent icon after this migration.
+DO $$
+BEGIN
+  IF EXISTS (
+    SELECT 1 FROM information_schema.columns
+    WHERE table_schema = 'nexent' AND table_name = 'ag_agent_repository_t'
+      AND column_name = 'icon'
+  ) AND NOT EXISTS (
+    SELECT 1 FROM information_schema.columns
+    WHERE table_schema = 'nexent' AND table_name = 'ag_agent_repository_t'
+      AND column_name = 'icon_url'
+  ) THEN
+    ALTER TABLE nexent.ag_agent_repository_t RENAME COLUMN icon TO icon_url;
+    UPDATE nexent.ag_agent_repository_t SET icon_url = NULL;
+  END IF;
+END $$;
+
+ALTER TABLE nexent.ag_agent_repository_t
+  ALTER COLUMN icon_url TYPE VARCHAR(1024);
+
+COMMENT ON COLUMN nexent.ag_agent_repository_t.icon_url IS
+  'Repository icon URL; NULL uses the agent ID based default icon';
+
+
+-- Source migration: v2.6.1_001_remove_human_interaction.sql
+-- Source SHA-256: 08f51328a6de8a7537265d5087be872b33ea8f1282fc892a0f5b1f4baa364479
+
+-- Deploy only after all processes using the retired interaction engine have stopped.
+-- Ordinary conversation messages and units are intentionally preserved.
+DROP TABLE IF EXISTS nexent.human_event_t;
+DROP TABLE IF EXISTS nexent.human_execution_t;
+DROP TABLE IF EXISTS nexent.human_request_t;
+DROP TABLE IF EXISTS nexent.human_run_t;
+-- This function is used exclusively by the four tables removed above.
+DROP FUNCTION IF EXISTS nexent.human_interaction_audit_timestamp();
+
+
+-- Source migration: v2.6.1_002_remove_dev_models_menu.sql
+-- Source SHA-256: e1c57d58d6754351c05820017e0bc24774c8d2728151ca517a186631338e35af
+
+-- Remove the model management page from the DEV role menu.
+-- Developers must not see or manage models; they only consume
+-- administrator-configured models. RESOURCE MODEL READ is kept so
+-- model pickers in agent editing keep working.
+-- Pattern follows v2.3 migration that removed ASSET_OWNER /owner-manage.
+DELETE FROM nexent.role_permission_t
+WHERE user_role = 'DEV'
+  AND permission_category = 'VISIBILITY'
+  AND permission_type = 'LEFT_NAV_MENU'
+  AND permission_subtype = '/models';
+
+
+-- Source migration: v2.6.2_001_agent_workbench.sql
+-- Source SHA-256: 5b210092620c8088caf1f39514a54c2c35d74bd578d26cd24d95ce224af241e7
+
 -- Add protected platform Agent identity for the intelligent workbench.
 ALTER TABLE nexent.ag_tenant_agent_t
     ADD COLUMN IF NOT EXISTS system_key VARCHAR(100),
@@ -70,3 +134,4 @@ COMMENT ON COLUMN nexent.conversation_record_t.workbench_config IS
 
 COMMENT ON COLUMN nexent.conversation_record_t.workbench_config_version IS
     'Monotonic optimistic-lock version for workbench_config';
+
```

**File**: `doc/docs/zh/backend/human-in-the-loop-implementation.md` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ Web 直接复用原 `ClarificationCard` 的外框、图标、文本/单选/多
 
 保留普通 `POST /agent/run`、`GET /agent/stop/{run_id}` 和 northbound 对应普通能力。携带 `enable_hitl`、`hitl_run_id`、`hitl_after_event` 的旧执行请求明确返回参数错误，包括 false、null 和零值；旧专属路由不再注册。
 
-新增 `deploy/sql/migrations/v2.6.1_001_remove_human_interaction.sql`，依次删除 `human_event_t`、`human_execution_t`、`human_request_t`、`human_run_t` 和仅供四表使用的审计函数，不使用 CASCADE。已合入的初始化及历史 SQL 保持原样。新安装先执行历史 SQL，再执行清理迁移，最终不存在四表。
+清理迁移原为 `deploy/sql/migrations/v2.6.1_001_remove_human_interaction.sql`，现已整合进 `deploy/sql/migrations/v2.7.0_merged_migrations.sql`（源节：`v2.6.1_001_remove_human_interaction.sql`），依次删除 `human_event_t`、`human_execution_t`、`human_request_t`、`human_run_t` 和仅供四表使用的审计函数，不使用 CASCADE。已合入的初始化及历史 SQL 保持原样。新安装先执行历史 SQL，再执行清理迁移，最终不存在四表。
 
 部署时须先停止旧进程和旧 scheduler，再同步更新 Web/runtime 并执行清理迁移。清理直接删除旧 HITL 数据，不提供搬迁或执行恢复。本次开发验证只对隔离临时 PostgreSQL 容器执行迁移，没有部署或修改现有业务数据库。
 
```

**File**: `test/backend/management/test_system_agent_provider.py` (modified, +8/-2)
```diff
@@ -552,11 +552,17 @@ def test_sal_016_publish_failure_does_not_advance_revision(mocker):
 def test_sal_014_migration_contains_nullable_system_revision():
     """UT-BE-SAL-014."""
     migration = (
-        "deploy/sql/migrations/v2.6.2_001_agent_workbench.sql"
+        "deploy/sql/migrations/v2.7.0_merged_migrations.sql"
     )
 
+    # The workbench schema was consolidated into v2.7.0_merged_migrations.sql
+    # (source section: v2.6.2_001_agent_workbench.sql); scope the assertions
+    # to that section.
     with open(migration, encoding="utf-8") as file:
-        sql = file.read()
+        full_sql = file.read()
+
+    start = full_sql.index("-- Source migration: v2.6.2_001_agent_workbench.sql")
+    sql = full_sql[start:]
 
     assert "ADD COLUMN IF NOT EXISTS system_revision" in sql
     assert "system_revision VARCHAR" in sql
```

---

### Incident Patch 10: `b84fae3b` (2026-09-28)
**Commit Message**: fix(agent): 修复输出协议重试与流式显示（develop） (#4023)

* fix(agent): preserve model attempt streaming across semantic retries

(cherry picked from commit e38fd5039af23dc24db5afecd4f2bcf8383fb46b)

* feat(agent): make strict output repair opt-in per agent

* fix(agent): continue bare output and reinforce action protocol

* test(agent): keep context reminder fixture lint clean

* Restore legacy code action routing and accept final strict attempt

* Gate empty model response retries on strict code action mode

* Show a quiet final hint for legacy empty model responses

* test(agent): adapt protocol regression tests to develop

* fix(agent): align protocol tests and preserve guardrail user boundary

**File**: `backend/agents/create_agent_info.py` (modified, +1/-0)
```diff
@@ -1921,6 +1921,7 @@ async def create_agent_config(
         model_name=model_name,
         provide_run_summary=agent_info.get("provide_run_summary", False),
         allow_chat_metadata=agent_info.get("allow_chat_metadata", False),
+        enable_protocol_repair_retry=agent_info.get("enable_protocol_repair_retry") is True,
         managed_agents=managed_agents,
         external_a2a_agents=external_a2a_agents,
         context_manager_config=cm_config,
```

**File**: `backend/consts/model.py` (modified, +2/-0)
```diff
@@ -1325,6 +1325,7 @@ class AgentInfoRequest(BaseModel):
     group_ids: Optional[List[int]] = None
     ingroup_permission: Optional[str] = None
     enable_context_manager: Optional[bool] = None
+    enable_protocol_repair_retry: Optional[bool] = None
     is_a2a: Optional[bool] = None
     verification_config: Optional[Dict[str, Any]] = None
     context_policy: Optional[Dict[str, Any]] = None
@@ -1427,6 +1428,7 @@ class ExportAndImportAgentInfo(BaseModel):
     is_main_agent: bool = True
     provide_run_summary: bool
     allow_chat_metadata: bool = False
+    enable_protocol_repair_retry: bool = False
     verification_config: Optional[Dict[str, Any]] = None
     context_policy: Optional[Dict[str, Any]] = None
     duty_prompt: Optional[str] = None
```

**File**: `backend/database/agent_db.py` (modified, +2/-0)
```diff
@@ -272,6 +272,7 @@ def create_agent(agent_info, tenant_id: str, user_id: str):
     info_with_metadata.setdefault("context_policy", None)
     info_with_metadata.setdefault("model_params_override", None)
     info_with_metadata.setdefault("is_a2a", False)
+    info_with_metadata.setdefault("enable_protocol_repair_retry", False)
     info_with_metadata.update({
         "tenant_id": tenant_id,
         "version_no": 0,  # Default to draft version
@@ -309,6 +310,7 @@ def create_agent(agent_info, tenant_id: str, user_id: str):
             "is_main_agent": new_agent.is_main_agent,
             "provide_run_summary": new_agent.provide_run_summary,
             "allow_chat_metadata": bool(new_agent.allow_chat_metadata),
+            "enable_protocol_repair_retry": new_agent.enable_protocol_repair_retry,
             "business_description": new_agent.business_description,
             "business_logic_model_id": new_agent.business_logic_model_id,
             "business_logic_model_name": new_agent.business_logic_model_name,
```

**File**: `backend/database/db_models.py` (modified, +7/-0)
```diff
@@ -726,6 +726,13 @@ class AgentInfo(TableBase):
         ),
     )
     enable_context_manager = Column(Boolean, default=True, doc="Whether to enable context management (compression) for this agent")
+    enable_protocol_repair_retry = Column(
+        Boolean,
+        default=False,
+        server_default=text("false"),
+        nullable=False,
+        comment="Whether this agent uses strict output validation and silent protocol repair",
+    )
     is_a2a = Column(Boolean, default=False, nullable=False, doc="Whether to publish this agent as an A2A Server agent")
     verification_config = Column(JSONB, doc="Layered ReAct self-verification configuration")
     context_policy = Column(JSONB, doc="Agent-level context processing policy override")
```

**File**: `backend/management/services/agent/management.py` (modified, +3/-0)
```diff
@@ -530,6 +530,7 @@ async def export_agent_by_agent_id(
                                           is_main_agent=agent_info.get("is_main_agent", True),
                                           provide_run_summary=agent_info["provide_run_summary"],
                                           allow_chat_metadata=agent_info.get("allow_chat_metadata", False),
+                                          enable_protocol_repair_retry=agent_info.get("enable_protocol_repair_retry") is True,
                                           verification_config=agent_info.get("verification_config"),
                                           context_policy=agent_info.get("context_policy"),
                                           model_params_override=agent_info.get("model_params_override"),
@@ -698,6 +699,7 @@ async def import_agent_by_agent_id(
                                          "is_main_agent": getattr(import_agent_info, "is_main_agent", True),
                                          "provide_run_summary": import_agent_info.provide_run_summary,
                                          "allow_chat_metadata": import_agent_info.allow_chat_metadata,
+                                         "enable_protocol_repair_retry": getattr(import_agent_info, "enable_protocol_repair_retry", False),
                                          "verification_config": getattr(import_agent_info, "verification_config", None),
                                          "context_policy": getattr(import_agent_info, "context_policy", None),
                                          "model_params_override": getattr(import_agent_info, "model_params_override", None),
@@ -908,6 +910,7 @@ async def list_all_agent_info_impl(
                 "is_a2a_server": agent["agent_id"] in a2a_server_agent_ids,
                 "allow_chat_metadata": bool(agent.get("allow_chat_metadata", False)),
                 "model_params_override": agent.get("model_params_override"),
+                "enable_protocol_repair_retry": agent.get("enable_protocol_repair_retry") is True,
             })
 
         return simple_agent_list
```

**File**: `backend/management/services/agent/service.py` (modified, +15/-0)
```diff
@@ -700,6 +700,18 @@ async def update_agent_info_impl(
 
     # If agent_id is None, create a new agent; otherwise, update existing
     agent_id: Optional[int] = request.agent_id
+    if agent_id is not None and isinstance(getattr(request, "enable_protocol_repair_retry", None), bool):
+        agent_record = search_agent_info_by_agent_id(agent_id, tenant_id)
+        user_tenant_record = get_user_tenant_by_user_id(user_id) or {}
+        user_role = str(user_tenant_record.get("user_role") or "").upper()
+        permission = resolve_agent_list_permission(
+            user_role=user_role,
+            agent=agent_record,
+            user_id=user_id,
+            can_edit_all=user_role in CAN_EDIT_ALL_USER_ROLES,
+        )
+        if permission != "EDIT":
+            raise ForbiddenError("You do not have permission to edit this agent")
     try:
         if agent_id is None:
             # Create agent - automatically set group_ids to current user's groups
@@ -725,6 +737,9 @@ async def update_agent_info_impl(
                     "allow_chat_metadata": request.allow_chat_metadata
                     if request.allow_chat_metadata is not None
                     else False,
+                    "enable_protocol_repair_retry": request.enable_protocol_repair_retry
+                    if request.enable_protocol_repair_retry is not None
+                    else False,
                     "is_a2a": request.is_a2a if request.is_a2a is not None else False,
                     "verification_config": request.verification_config,
                     "context_policy": request.context_policy,
```

**File**: `backend/services/agent_version_service.py` (modified, +1/-0)
```diff
@@ -1037,6 +1037,7 @@ async def list_published_agents_impl(
                 "example_questions": agent.get("example_questions"),
                 "allow_chat_metadata": bool(agent.get("allow_chat_metadata", False)),
                 "model_params_override": agent.get("model_params_override"),
+                "enable_protocol_repair_retry": agent.get("enable_protocol_repair_retry") is True,
             })
 
         try:
```

**File**: `deploy/sql/migrations/v2.6.1_002_agent_protocol_repair_retry.sql` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+ALTER TABLE nexent.ag_tenant_agent_t
+    ADD COLUMN IF NOT EXISTS enable_protocol_repair_retry BOOLEAN NOT NULL DEFAULT FALSE;
+
+ALTER TABLE nexent.ag_tenant_agent_t
+    ALTER COLUMN enable_protocol_repair_retry SET DEFAULT FALSE;
+
+COMMENT ON COLUMN nexent.ag_tenant_agent_t.enable_protocol_repair_retry IS
+    'Whether this agent uses strict output validation and silent protocol repair';
```

---

### Incident Patch 11: `6ad0b4aa` (2026-09-28)
**Commit Message**: bugfix: fix infinite loop when agent configuration update fails in certain scenarios (#4022)

* bugfix: fix infinite loop when agent configuration update fails in certain scenarios

* bugfix: fix infinite loop when agent configuration update fails in certain scenarios

---------

Co-authored-by: hzw <[REDACTED_EMAIL]>

**File**: `frontend/app/[locale]/agents/[agentId]/components/agent-prompt.tsx` (modified, +86/-27)
```diff
@@ -1,7 +1,17 @@
 "use client";
 
 import { useTranslation } from "react-i18next";
-import { Button, Col, Form, Input, Modal, Popover, Row, Select, Tooltip } from "antd";
+import {
+  Button,
+  Col,
+  Form,
+  Input,
+  Modal,
+  Popover,
+  Row,
+  Select,
+  Tooltip,
+} from "antd";
 import { GripVertical, ListOrdered, Maximize2, Settings2 } from "lucide-react";
 import {
   DndContext,
@@ -115,6 +125,9 @@ export default function AgentPrompt() {
   const updateDraft = useAgentStore((state) => state.updateDraft);
   const flushDraft = useAgentStore((state) => state.flushDraft);
   const updateAgent = useAgentStore((state) => state.updateAgentConfig);
+  const reconcileUnavailableModels = useAgentStore(
+    (state) => state.reconcileUnavailableModels
+  );
   const agentId = useAgentStore((state) => state.agentId);
   const defaultLlmConfig = useAgentStore((state) => state.defaultLlmConfig);
   const { configFocusRequest } = useNl2AgentFlow();
@@ -160,22 +173,30 @@ export default function AgentPrompt() {
   );
 
   const selectedModelIds = useMemo(() => {
-    const configuredModelIds = editedAgent.model_ids ?? [];
+    const configuredModelIds = (editedAgent.model_ids ?? []).map(Number);
     if (configuredModelIds.length > 0) {
       return configuredModelIds.filter((id) => availableModelIds.has(id));
     }
-    return defaultLlmConfig?.id && availableModelIds.has(defaultLlmConfig.id)
-      ? [defaultLlmConfig.id]
+    const defaultModelId = defaultLlmConfig?.id
+      ? Number(defaultLlmConfig.id)
+      : null;
+    return defaultModelId !== null && availableModelIds.has(defaultModelId)
+      ? [defaultModelId]
       : [];
   }, [availableModelIds, defaultLlmConfig?.id, editedAgent.model_ids]);
 
   useEffect(() => {
     if (!modelListLoaded || !editedAgent.model_ids?.length) return;
 
-    const nextModelIds = editedAgent.model_ids.filter((id) =>
+    const currentModelIds = editedAgent.model_ids.map(Number);
+    const nextModelIds = currentModelIds.filter((id) =>
       availableModelIds.has(id)
     );
-    if (nextModelIds.length === editedAgent.model_ids.length) return;
+    if (nextModelIds.length === currentModelIds.length) return;
+
+    // Keep the Ant Design Form value in sync with the cleaned agent draft.
+    // Otherwise Form.Item can re-inject an unavailable raw model ID into Select.
+    form.setFieldValue("model_ids", nextModelIds);
 
     const modelNames = nextModelIds.map((id) => {
       const option = modelOptions.find((model) => model.value === id);
@@ -184,7 +205,7 @@ export default function AgentPrompt() {
     const primaryModel = modelOptions.find(
       (option) => option.value === nextModelIds[0]
     );
-    updateAgent({
+    reconcileUnavailableModels({
       model_ids: nextModelIds,
       model: primaryModel?.displayName ?? "",
       model_names: modelNames,
@@ -194,23 +215,31 @@ export default function AgentPrompt() {
     editedAgent.model_ids,
     modelListLoaded,
     modelOptions,
-    updateAgent,
+    form,
+    reconcileUnavailableModels,
   ]);
 
   const { specs: inferenceSpecs } = useInferenceFieldSpecs({ enabled: true });
-  const [configuringModelId, setConfiguringModelId] = useState<number | null>(null);
-  const [editingOverrideValue, setEditingOverrideValue] = useState<ModelAdvancedSettingsValue | null>(null);
-  const modelParamsOverride = (editedAgent.model_params_override ?? {}) as ModelOverrideMap;
+  const [configuringModelId, setConfiguringModelId] = useState<number | null>(
+    null
+  );
+  const [editingOverrideValue, setEditingOverrideValue] =
+    useState<ModelAdvancedSettingsValue | null>(null);
+  const modelParamsOverride = (editedAgent.model_params_override ??
+    {}) as ModelOverrideMap;
   const configuringModel = useMemo(
-    () => (availableLlmModels ?? []).find((m) => m.id === configuringModelId) ?? null,
+    () =>
+      (availableLlmModels ?? []).find((m) => m.id === configuringModelId) ??
+      null,
     [availableLlmModels, configuringModelId]
   );
   useEffect(() => {
     if (!configuringModel) {
       setEditingOverrideValue(null);
       return;
     }
-    const overrideEntry = modelParamsOverride[String(configuringModel.id)] ?? {};
+    const overrideEntry =
+      modelParamsOverride[String(configuringModel.id)] ?? {};
     const modelDefaultsRecord = {
       temperature: configuringModel.temperature,
       top_p: configuringModel.topP,
@@ -269,24 +298,32 @@ export default function AgentPrompt() {
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [configuringModel, configuringModelId, inferenceSpecs]);
 
-  const handleModelParamsOverrideChange = (modelId: number, next: ModelAdvancedSettingsValue) => {
+  const handleModelParamsOverrideChange = (
+    modelId: number,
+    next: ModelAdvancedSettingsValue
+  ) => {
     const entry = buildModelOverrideEntry(
       next,
-      availableLlmModels.find((model) => model.id === modelId)?.reasoningCapability
+      availableLlmModels.fin
```

**File**: `frontend/stores/agentStore.ts` (modified, +82/-2)
```diff
@@ -55,6 +55,8 @@ export type AgentDraftPatch = Partial<AgentDraft>;
 export interface AgentSaveTask {
   agentId: number;
   patch: AgentDraftPatch;
+  source?: "user" | "automatic-model-reconciliation";
+  signature?: string;
 }
 
 export interface PersistedResourceBindings {
@@ -83,6 +85,7 @@ interface AgentStoreState {
   updateDraft: (patch: AgentDraftPatch) => void;
   flushDraft: () => void;
   updateAgentConfig: (patch: AgentDraftPatch) => void;
+  reconcileUnavailableModels: (patch: AgentDraftPatch) => void;
   updateTools: (tools: Tool[]) => void;
   updateSkills: (skills: AgentDraft["skills"]) => void;
   updateSubAgentIds: (ids: number[]) => void;
@@ -201,6 +204,26 @@ let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;
 let saveQueue: AgentSaveTask[] = [];
 let saveQueueProcessing = false;
 let idleWaiters: Array<(success: boolean) => void> = [];
+const failedAutoReconciliationSignatures = new Set<string>();
+
+const serializeModelIds = (modelIds: number[]): string =>
+  JSON.stringify(modelIds);
+
+const getModelReconciliationSignature = (
+  agentId: number,
+  currentModelIds: number[],
+  nextModelIds: number[]
+): string =>
+  `${agentId}:${serializeModelIds(currentModelIds)}=>${serializeModelIds(nextModelIds)}`;
+
+const clearAutoReconciliationFailures = (agentId: number): void => {
+  const prefix = `${agentId}:`;
+  failedAutoReconciliationSignatures.forEach((signature) => {
+    if (signature.startsWith(prefix)) {
+      failedAutoReconciliationSignatures.delete(signature);
+    }
+  });
+};
 
 const resolveIdleWaiters = () => {
   if (saveQueueProcessing || saveQueue.length > 0) {
@@ -492,6 +515,13 @@ async function processSaveQueue(): Promise<void> {
           return;
         }
 
+        if (
+          task.source === "automatic-model-reconciliation" &&
+          task.signature
+        ) {
+          failedAutoReconciliationSignatures.add(task.signature);
+        }
+
         saveQueue = saveQueue.slice(1);
         useAgentStore.setState((state) => ({
           editedAgent: mergeDraft(
@@ -516,13 +546,34 @@ async function processSaveQueue(): Promise<void> {
 }
 
 export const useAgentStore = create<AgentStoreState>((set) => {
-  const enqueue = (patch: AgentDraftPatch) => {
+  const enqueue = (
+    patch: AgentDraftPatch,
+    options: Pick<AgentSaveTask, "source" | "signature"> = {}
+  ) => {
     const { agentId, isReadOnly } = useAgentStore.getState();
     if (agentId === null || isReadOnly) {
       return;
     }
 
-    const task: AgentSaveTask = { agentId, patch: cloneDraft(patch) };
+    if (
+      options.source === "automatic-model-reconciliation" &&
+      options.signature &&
+      failedAutoReconciliationSignatures.has(options.signature)
+    ) {
+      return;
+    }
+
+    if (options.source !== "automatic-model-reconciliation") {
+      if (patch.model_ids !== undefined) {
+        clearAutoReconciliationFailures(agentId);
+      }
+    }
+
+    const task: AgentSaveTask = {
+      agentId,
+      patch: cloneDraft(patch),
+      ...options,
+    };
     saveQueue = [...saveQueue, task];
     set((state) => ({
       editedAgent: mergeDraft(state.editedAgent, task.patch),
@@ -593,6 +644,34 @@ export const useAgentStore = create<AgentStoreState>((set) => {
       }
     },
     updateAgentConfig: enqueue,
+    reconcileUnavailableModels: (patch) => {
+      const { agentId, editedAgent, isReadOnly } = useAgentStore.getState();
+      const nextModelIds = patch.model_ids;
+      if (
+        agentId === null ||
+        isReadOnly ||
+        !editedAgent ||
+        nextModelIds === undefined
+      ) {
+        return;
+      }
+
+      const currentModelIds = editedAgent.model_ids ?? [];
+      if (
+        serializeModelIds(currentModelIds) === serializeModelIds(nextModelIds)
+      ) {
+        return;
+      }
+
+      enqueue(patch, {
+        source: "automatic-model-reconciliation",
+        signature: getModelReconciliationSignature(
+          agentId,
+          currentModelIds,
+          nextModelIds
+        ),
+      });
+    },
     updateTools: (tools) => enqueue({ tools }),
     updateSkills: (skills) => enqueue({ skills }),
     updateSubAgentIds: (sub_agent_id_list) => enqueue({ sub_agent_id_list }),
@@ -650,6 +729,7 @@ export const useAgentStore = create<AgentStoreState>((set) => {
     reset: () => {
       clearPendingDraftSave();
       saveQueue = [];
+      failedAutoReconciliationSignatures.clear();
       set((state) => ({
         agentId: null,
         currentAgentId: null,
```

---

### Incident Patch 12: `4c9591b1` (2026-09-28)
**Commit Message**: feature: agent publish guide (#4011)

* feat: add agent sharing backend foundation

* feat: expose northbound API base URL

* feat: guide users to published agent usage

* feat: add agent usage guide modal

* feat: support scoped runtime rate limits

* feat: add authenticated agent share session APIs

* feat: isolate agent share run identities

* feat: protect agent share run lifecycle

* feat: add authenticated agent share page

* feat: protect agent share responses from caching

* feat: secure all agent share responses

* feat: rate limit agent share runs

* test: cover isolated agent share runtime sessions

* test: cover agent share revocation during runs

* fix: sanitize agent share management errors

* test: cover agent share session history isolation

* test: keep shared sessions out of conversation lists

* feat: link northbound guide to API key settings

* feat: localize agent share page feedback

* feat: retry unavailable A2A guide settings

* feat: restore published agent usage guide targets

* feat: complete agent share guide lifecycle

* test: lock agent publish guide outcomes

* feat: guard and restore agent share pages

* feat: improve agent guide accessibility

* cho

**File**: `.gitignore` (modified, +2/-1)
```diff
@@ -96,5 +96,6 @@ agent_repository_frontend
 # Added by code-review-graph
 .code-review-graph/
 
+.codex/skills/openspec-*
 # Added by Serena MCP
-.serena/
\ No newline at end of file
+.serena/
```

**File**: `frontend/app/[locale]/agent-space/components/AgentUsageGuideModal.tsx` (added, +263/-0)
```diff
@@ -0,0 +1,263 @@
+"use client";
+
+import { useEffect, useMemo, useState } from "react";
+import { useQuery } from "@tanstack/react-query";
+import { Alert, App, Button, Modal, Spin, Tabs, Typography } from "antd";
+import { Copy, ExternalLink } from "lucide-react";
+import { useTranslation } from "react-i18next";
+import A2AServerSettingsPanel from "../../agents/components/a2a/A2AServerSettingsPanel";
+import {
+  buildAgentShareUrl,
+  buildNorthboundDocsUrl,
+  buildNorthboundCurl,
+  buildNorthboundRunUrl,
+  buildUserApiKeyPath,
+  getAgentUsageGuideAccess,
+  getA2AGuideState,
+} from "@/lib/agentUsageGuide";
+import { a2aClientService } from "@/services/a2aService";
+import { fetchPublishedAgentList } from "@/services/agentConfigService";
+import { configService } from "@/services/configService";
+import type { Agent } from "@/types/agentConfig";
+import type { MyEditableAgentItem } from "@/types/agentRepository";
+
+interface AgentUsageGuideModalProps {
+  agent: MyEditableAgentItem | null;
+  locale: string;
+  open: boolean;
+  onClose: () => void;
+}
+
+export function AgentUsageGuideModal({
+  agent,
+  locale,
+  open,
+  onClose,
+}: AgentUsageGuideModalProps) {
+  const { t } = useTranslation("common");
+  const { message } = App.useApp();
+  const [activeTab, setActiveTab] = useState("share");
+  const agentId = agent?.agent_id;
+  const agentName = agent?.name?.trim() || "agent";
+  const { canOpen } = getAgentUsageGuideAccess({
+    currentVersionNo: agent?.current_version_no,
+  });
+
+  useEffect(() => {
+    if (open) {
+      setActiveTab("share");
+    }
+  }, [agentId, open]);
+
+  const frontendConfigQuery = useQuery({
+    queryKey: ["frontend-config"],
+    queryFn: () => configService.fetchRuntimeFrontendConfig(),
+    enabled: open && activeTab === "northbound",
+  });
+  const a2aQuery = useQuery({
+    queryKey: ["a2aServerSettings", agentId],
+    queryFn: () => a2aClientService.getServerSettings(agentId!),
+    enabled: open && activeTab === "a2a" && agentId != null,
+  });
+  const publishedAgentsQuery = useQuery({
+    queryKey: ["publishedAgentsList"],
+    queryFn: fetchPublishedAgentList,
+    enabled: open && activeTab === "northbound" && agentId != null,
+  });
+  const publishedAgent = publishedAgentsQuery.data?.data?.find(
+    (candidate: Agent) => candidate.id === String(agentId)
+  );
+
+  const shareUrl = useMemo(() => {
+    if (!open || !canOpen || agentId == null || typeof window === "undefined") {
+      return "";
+    }
+    return buildAgentShareUrl(window.location.origin, locale, agentId);
+  }, [agentId, canOpen, locale, open]);
+  const northboundUrl = buildNorthboundRunUrl(
+    frontendConfigQuery.data?.northboundBaseUrl,
+    typeof window === "undefined" ? undefined : window.location.origin
+  );
+  const northboundCurl = buildNorthboundCurl(
+    publishedAgent?.name?.trim() || agentName,
+    northboundUrl
+  );
+  const a2aGuideState = getA2AGuideState({
+    isLoading: a2aQuery.isLoading,
+    isError: a2aQuery.isError,
+    isEnabled: Boolean(
+      a2aQuery.data?.success && a2aQuery.data.data?.is_enabled
+    ),
+  });
+  const copy = async (value: string) => {
+    try {
+      await navigator.clipboard.writeText(value);
+      message.success(t("common.copied"));
+    } catch {
+      message.error(t("agentUsageGuide.copyFailed"));
+    }
+  };
+
+  return (
+    <Modal
+      title={t("agentUsageGuide.title", { name: agent?.name })}
+      open={open}
+      onCancel={onClose}
+      footer={null}
+      destroyOnHidden
+      mask={{ closable: true }}
+      width={760}
+    >
+      <div
+        data-testid="agent-usage-guide-content"
+        data-stable-height="true"
+        className="min-h-[420px] max-h-[420px] overflow-y-auto pr-1"
+      >
+        <Tabs
+          activeKey={activeTab}
+          onChange={setActiveTab}
+          items={[
+            {
+              key: "share",
+              label: t("agentUsageGuide.tabs.share"),
+              children:
+                canOpen && shareUrl ? (
+                  <div className="space-y-4">
+                    <Alert
+                      type="info"
+                      showIcon
+                      message={t("agentUsageGuide.share.notice")}
+                    />
+                    <div className="pt-2">
+                      <Typography.Paragraph
+                        copyable={{ text: shareUrl }}
+                        className="mb-0 break-all rounded bg-slate-50 p-3"
+                      >
+                        {shareUrl}
+                      </Typography.Paragraph>
+                      <div className="mt-3 flex flex-wrap gap-2">
+                        <Button
+                          icon={<Copy className="size-4" aria-hidden />}
+                          onClick={() => copy(shareUrl)}
+                        >
+                          {t("common.copy")}
+                        </Button>
+                        <Button
+        
```

**File**: `frontend/app/[locale]/agent-space/components/MyAgentCard.tsx` (modified, +35/-5)
```diff
@@ -15,6 +15,7 @@ import {
   Trash2,
 } from "lucide-react";
 import { useTranslation } from "react-i18next";
+import { getAgentUsageGuideAccess } from "@/lib/agentUsageGuide";
 import { getAgentRepositoryTagLabel } from "@/lib/agentRepositoryLabels";
 import { getUnavailableReasonLabels } from "@/lib/agentLabelMapper";
 import {
@@ -38,6 +39,10 @@ interface MyAgentCardProps {
   ) => void;
   onDelete: () => void;
   onEvaluate: () => void;
+  onUsageGuide: () => void;
+  highlighted?: boolean;
+  guideMenuOpen?: boolean;
+  onGuideMenuOpenChange?: (open: boolean) => void;
   isApplying?: boolean;
   isDeleting?: boolean;
 }
@@ -56,6 +61,10 @@ export function MyAgentCard({
   onViewReview,
   onDelete,
   onEvaluate,
+  onUsageGuide,
+  highlighted = false,
+  guideMenuOpen,
+  onGuideMenuOpenChange,
   isApplying = false,
   isDeleting = false,
 }: MyAgentCardProps) {
@@ -68,7 +77,7 @@ export function MyAgentCard({
     refetch,
   } = useAgentRepositoryListings(
     { agent_id: agent.agent_id, page: 1, page_size: 100 },
-    menuOpen
+    menuOpen || guideMenuOpen === true
   );
 
   const title = agent.name?.trim() || t("agentRepository.card.untitled");
@@ -79,9 +88,12 @@ export function MyAgentCard({
     agent.unavailable_reasons ?? [],
     t
   );
-  const published = (agent.current_version_no ?? 0) > 0;
   const repositoryInfo = toMineRepositoryInfo(listingData?.items ?? []);
   const agentWithRepository = { ...agent, repository_info: repositoryInfo };
+  const { canOpen: published } = getAgentUsageGuideAccess({
+    currentVersionNo: agent.current_version_no,
+    permission: agent.permission,
+  });
   const footerDate = formatMineDate(agent.version_create_time);
   const versionLabel = agent.version_label;
   const canEdit = agent.permission !== "READ_ONLY";
@@ -146,6 +158,16 @@ export function MyAgentCard({
     menuItems.push({ type: "divider" });
   }
 
+  if (published) {
+    menuItems.push({
+      key: "usageGuide",
+      icon: <Share2 className="size-3.5" aria-hidden />,
+      label: t("agentRepository.mine.menu.usageGuide"),
+      className: guideMenuOpen ? "font-semibold" : undefined,
+      onClick: onUsageGuide,
+    });
+  }
+
   if (canEdit) {
     menuItems.push({
       key: "delete",
@@ -160,7 +182,10 @@ export function MyAgentCard({
   return (
     <ResourceCard
       title={title}
-      className="h-full"
+      className={`h-full ${
+        highlighted ? "rounded-xl ring-2 ring-primary ring-offset-2" : ""
+      }`}
+      aria-current={highlighted ? "true" : undefined}
       onClick={onView}
       subtitle={
         versionLabel != null ? (
@@ -197,15 +222,17 @@ export function MyAgentCard({
           {menuItems.length > 0 ? (
             <Dropdown
               menu={{ items: menuItems }}
+              open={guideMenuOpen}
+              onOpenChange={onGuideMenuOpenChange ?? setMenuOpen}
               trigger={["click"]}
-              onOpenChange={setMenuOpen}
             >
               <Button
                 type="text"
                 size="small"
                 className="size-8 shrink-0 text-slate-400 hover:text-slate-600"
                 icon={<MoreHorizontal className="size-4" aria-hidden />}
                 aria-label={t("agentRepository.mine.menu.more")}
+                aria-haspopup="menu"
               />
             </Dropdown>
           ) : null}
@@ -220,7 +247,10 @@ export function MyAgentCard({
               >
                 <span
                   className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300"
-                  aria-label={unavailableReasonLabels.join(", ") || t("agentSelector.agentUnavailable")}
+                  aria-label={
+                    unavailableReasonLabels.join(", ") ||
+                    t("agentSelector.agentUnavailable")
+                  }
                 >
                   {t("mcpConfig.status.unavailable")}
                 </span>
```

**File**: `frontend/app/[locale]/agent-space/my-agent.tsx` (modified, +135/-3)
```diff
@@ -28,7 +28,13 @@ import {
 import { useTagDefinitions, useTagLibraries } from "@/hooks/useTagManagement";
 import { getTagSearchPredicates } from "@/lib/systemTagLabels";
 import { parseReviewDeepLinkParams } from "@/lib/notificationNavigation";
+import { parseAgentUsageGuideParams } from "@/lib/agentUsageGuide";
 import log from "@/lib/logger";
+import {
+  getAgentUsageGuideOpenAction,
+  parseAgentUsageGuideTargetParams,
+  resolveAgentUsageGuideTarget,
+} from "@/lib/agentUsageGuide";
 import {
   isCancelableRepositoryStatus,
   isTakeDownableRepositoryStatus,
@@ -46,6 +52,7 @@ import {
 } from "@/types/agentRepository";
 import { MineApplyListingModal } from "./components/MineApplyListingModal";
 import { MineReviewStatusModal } from "./components/MineReviewStatusModal";
+import { AgentUsageGuideModal } from "./components/AgentUsageGuideModal";
 import { CreateNewAgentCard } from "./components/CreateNewAgentCard";
 import { MyAgentCard } from "./components/MyAgentCard";
 import ResourceCardGrid from "@/components/resource/ResourceCardGrid";
@@ -199,16 +206,24 @@ export function MyAgent({
     () => parseReviewDeepLinkParams(searchParams),
     [searchParams]
   );
+  const usageGuideDeepLink = useMemo(
+    () => parseAgentUsageGuideParams(searchParams),
+    [searchParams]
+  );
+  const usageGuideTarget = useMemo(
+    () => parseAgentUsageGuideTargetParams(searchParams),
+    [searchParams]
+  );
   const { data: deepLinkMineData, isLoading: deepLinkFallbackLoading } =
     useMyEditableAgents(
       {
         ownership: "all",
-        agent_id: reviewDeepLink?.agentId,
+        agent_id: reviewDeepLink?.agentId ?? usageGuideTarget?.agentId,
         page: 1,
         page_size: 1,
         new_agent_padding: false,
       },
-      active && reviewDeepLink != null
+      active && (reviewDeepLink != null || usageGuideTarget != null)
     );
   const deepLinkFallbackAgent = useMemo(() => {
     const item = deepLinkMineData?.items?.[0];
@@ -217,6 +232,12 @@ export function MyAgent({
   const onReviewDeepLinkConsumed = useCallback(() => {
     router.replace(`/${locale}/agent-space?tab=mine`);
   }, [locale, router]);
+  const onUsageGuideDeepLinkConsumed = useCallback(() => {
+    if (!usageGuideTarget) return;
+    router.replace(
+      `/${locale}/agent-space?tab=mine&agent_id=${usageGuideTarget.agentId}`
+    );
+  }, [locale, router, usageGuideTarget]);
   const onOwnershipChange = (value: MineOwnershipFilter) => {
     setOwnership(value);
     setPage(1);
@@ -296,7 +317,13 @@ export function MyAgent({
   const [applyModalOpen, setApplyModalOpen] = useState(false);
   const [applyModalAgent, setApplyModalAgent] =
     useState<MyEditableAgentItem | null>(null);
+  const [usageGuideAgent, setUsageGuideAgent] =
+    useState<MyEditableAgentItem | null>(null);
+  const [guidedMenuAgentId, setGuidedMenuAgentId] = useState<number | null>(
+    null
+  );
   const consumedDeepLinkRef = useRef<number | null>(null);
+  const consumedUsageGuideRef = useRef<number | null>(null);
 
   const createListingMutation = useCreateAgentRepositoryListing();
   const updateStatusMutation = useUpdateAgentRepositoryStatus();
@@ -305,6 +332,50 @@ export function MyAgent({
   });
 
   const normalizedQuery = searchQuery.trim().toLowerCase();
+  const usageGuideTargetState = useMemo(
+    () =>
+      usageGuideTarget
+        ? resolveAgentUsageGuideTarget({
+            agentId: usageGuideTarget.agentId,
+            agents,
+            fallbackAgent: deepLinkFallbackAgent,
+            isListLoading: isLoading,
+            isFallbackLoading: deepLinkFallbackLoading,
+            isActive: active,
+            getAgentId: (agent) =>
+              isNewAgentPaddingItem(agent) ? null : agent.agent_id,
+          })
+        : null,
+    [
+      agents,
+      deepLinkFallbackAgent,
+      deepLinkFallbackLoading,
+      isLoading,
+      usageGuideTarget,
+    ]
+  );
+  const displayedAgents = useMemo(() => {
+    if (usageGuideTargetState?.state !== "found") {
+      return agents;
+    }
+    const targetAgent = usageGuideTargetState.agent;
+    if (
+      isNewAgentPaddingItem(targetAgent) ||
+      agents.some(
+        (agent) =>
+          !isNewAgentPaddingItem(agent) &&
+          agent.agent_id === targetAgent.agent_id
+      )
+    ) {
+      return agents;
+    }
+    return [targetAgent, ...agents];
+  }, [agents, usageGuideTargetState]);
+  const highlightedAgentId =
+    usageGuideTargetState?.state === "found" &&
+    !isNewAgentPaddingItem(usageGuideTargetState.agent)
+      ? usageGuideTargetState.agent.agent_id
+      : null;
 
   const handleCreateAgent = () => {
     setCreateAgentModalVisible(true);
@@ -505,6 +576,47 @@ export function MyAgent({
     t,
   ]);
 
+  useEffect(() => {
+    if (!usageGuideDeepLink) {
+      consumedUsageGuideRef.current = null;
+      return;
+    }
+
+    if (!usageGuideTargetState) {
+      return;
+    }
+    const openAction = getAgentUsageGuideOpenAct
```

**File**: `frontend/app/[locale]/agents/[agentId]/agent-config.tsx` (modified, +24/-5)
```diff
@@ -17,6 +17,7 @@ import { getTenantResourceLimitMessage } from "@/const/errorMessageI18n";
 import { useSaveGuard } from "@/hooks/agent/useSaveGuard";
 import { useAgentReadOnly } from "@/hooks/agent/useAgentReadOnly";
 import { useNl2AgentFlow } from "@/contexts/nl2AgentFlow";
+import { buildDefaultAgentVersionName } from "@/lib/agentUsageGuide";
 
 import AgentInfo from "./components/agent-info";
 import AgentPrmopt from "./components/agent-prompt";
@@ -168,7 +169,8 @@ export default function AgentConfig({
   const { t } = useTranslation("common");
   const [form] = Form.useForm();
   const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
-  const [isRefreshingAvailability, setIsRefreshingAvailability] = useState(false);
+  const [isRefreshingAvailability, setIsRefreshingAvailability] =
+    useState(false);
   const [activeConfigTab, setActiveConfigTab] =
     useState<AgentConfigTab>("basic");
   const [openSections, setOpenSections] = useState<
@@ -204,7 +206,9 @@ export default function AgentConfig({
   const { message } = App.useApp();
   const saveError = useAgentStore((state) => state.saveError);
   const clearSaveError = useAgentStore((state) => state.clearSaveError);
-  const replaceServerSnapshot = useAgentStore((state) => state.replaceServerSnapshot);
+  const replaceServerSnapshot = useAgentStore(
+    (state) => state.replaceServerSnapshot
+  );
 
   const handleRefreshAvailability = useCallback(async () => {
     if (!agentId || isRefreshingAvailability) return;
@@ -214,7 +218,9 @@ export default function AgentConfig({
       if (result.success && result.data) {
         replaceServerSnapshot(agentId, result.data);
       } else {
-        message.error(result.message || t("agent.config.refreshAvailabilityFailed"));
+        message.error(
+          result.message || t("agent.config.refreshAvailabilityFailed")
+        );
       }
     } catch {
       message.error(t("agent.config.refreshAvailabilityFailed"));
@@ -255,7 +261,10 @@ export default function AgentConfig({
 
     lastScrolledRequestRef.current = requestKey;
     const frameId = window.requestAnimationFrame(() => {
-      const sectionRefs: Record<ConfigSectionKey, React.RefObject<HTMLDivElement | null>> = {
+      const sectionRefs: Record<
+        ConfigSectionKey,
+        React.RefObject<HTMLDivElement | null>
+      > = {
         display_info: displayInfoSectionRef,
         role_model: roleModelSectionRef,
         tools: toolsSectionRef,
@@ -407,7 +416,14 @@ export default function AgentConfig({
                     <Button
                       type="link"
                       size="small"
-                      icon={<RefreshCw size={12} className={isRefreshingAvailability ? "animate-spin" : ""} />}
+                      icon={
+                        <RefreshCw
+                          size={12}
+                          className={
+                            isRefreshingAvailability ? "animate-spin" : ""
+                          }
+                        />
+                      }
                       onClick={handleRefreshAvailability}
                       disabled={isRefreshingAvailability}
                       loading={isRefreshingAvailability}
@@ -614,6 +630,9 @@ export default function AgentConfig({
         open={isPublishModalOpen}
         onClose={() => setIsPublishModalOpen(false)}
         agentId={agentId}
+        defaultVersionName={buildDefaultAgentVersionName(
+          editedAgent?.display_name || editedAgent?.name
+        )}
         onPublished={onPublished}
       />
     </Form>
```

**File**: `frontend/app/[locale]/agents/[agentId]/page.tsx` (modified, +9/-2)
```diff
@@ -42,6 +42,7 @@ import { useAgentInfo } from "@/hooks/agent/useAgentInfo";
 import { useAgentVersionDetail } from "@/hooks/agent/useAgentVersionDetail";
 import { useAgentVersionList } from "@/hooks/agent/useAgentVersionList";
 import { searchAgentInfo } from "@/services/agentConfigService";
+import { buildAgentUsageGuidePath } from "@/lib/agentUsageGuide";
 import log from "@/lib/logger";
 import type {
   Nl2AgentDraftField,
@@ -111,7 +112,12 @@ function PanelCard({
 
 function AgentSetupContent() {
   const { t } = useTranslation("common");
-  const { agentId } = useParams<{ agentId: string }>();
+  const router = useRouter();
+  const { agentId, locale: routeLocale } = useParams<{
+    agentId: string;
+    locale: string;
+  }>();
+  const locale = routeLocale || "en";
   const queryClient = useQueryClient();
   const snapshotRefreshQueue = useRef<Promise<boolean>>(Promise.resolve(true));
   const nl2AgentChatPanelRef = useRef<Nl2AgentChatPanelHandle>(null);
@@ -288,7 +294,8 @@ function AgentSetupContent() {
         error,
       });
     });
-  }, [currentAgentId, queryClient, refetchAgentInfo]);
+    router.push(buildAgentUsageGuidePath(locale, currentAgentId));
+  }, [currentAgentId, locale, queryClient, refetchAgentInfo, router]);
 
   return (
     <div className="flex h-full w-full min-h-0 flex-col bg-white">
```

**File**: `frontend/app/[locale]/agents/components/a2a/A2AServerSettingsPanel.tsx` (modified, +26/-4)
```diff
@@ -8,6 +8,7 @@ import {
   message,
 } from "antd";
 import { Copy, CheckCircle, Info } from "lucide-react";
+import { buildCopyAriaLabel } from "@/lib/agentUsageGuide";
 
 interface A2ASupportedInterface {
   protocolBinding?: string;
@@ -62,14 +63,23 @@ export default function A2AServerSettingsPanel({
   const CopyButton = ({
     text,
     field,
+    label,
   }: {
     text: string;
     field: string;
+    label: string;
   }) => (
     <Button
       type="text"
       size="small"
-      icon={copiedField === field ? <CheckCircle size={14} /> : <Copy size={14} />}
+      aria-label={buildCopyAriaLabel(t("common.copy"), label)}
+      icon={
+        copiedField === field ? (
+          <CheckCircle size={14} aria-hidden />
+        ) : (
+          <Copy size={14} aria-hidden />
+        )
+      }
       onClick={() => handleCopy(text, field)}
     />
   );
@@ -90,7 +100,11 @@ export default function A2AServerSettingsPanel({
             <div className="flex flex-col sm:flex-row sm:items-start gap-2">
               <div className="sm:w-[150px] sm:flex-shrink-0 flex items-center justify-between">
                 <span className="text-sm text-gray-600">{t("a2a.server.endpointId")}</span>
-                <CopyButton text={previewData.endpointId} field="endpointId" />
+                <CopyButton
+                  text={previewData.endpointId}
+                  field="endpointId"
+                  label={t("a2a.server.endpointId")}
+                />
               </div>
               <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">{previewData.endpointId}</code>
             </div>
@@ -99,7 +113,11 @@ export default function A2AServerSettingsPanel({
             <div className="flex flex-col sm:flex-row sm:items-start gap-2">
               <div className="sm:w-[150px] sm:flex-shrink-0 flex items-center justify-between">
                 <span className="text-sm text-gray-600">{t("a2a.server.agentCardUrl")}</span>
-                <CopyButton text={previewData.agentCardUrl} field="agentCardUrl" />
+                <CopyButton
+                  text={previewData.agentCardUrl}
+                  field="agentCardUrl"
+                  label={t("a2a.server.agentCardUrl")}
+                />
               </div>
               <div className="flex flex-col gap-1 min-w-0 w-full">
                 <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all">{previewData.agentCardUrl}</code>
@@ -151,7 +169,11 @@ export default function A2AServerSettingsPanel({
         {/* Usage Note */}
         <div className="text-xs text-gray-500 p-3 bg-blue-50 rounded border border-blue-100">
           <div className="flex items-start gap-2">
-            <Info size={14} className="mt-0.5 flex-shrink-0 text-blue-500" />
+            <Info
+              size={14}
+              className="mt-0.5 flex-shrink-0 text-blue-500"
+              aria-hidden
+            />
             <div>
               <p className="font-medium text-blue-700 mb-1">
                 {t("a2a.server.usageTitle", { defaultValue: "How to use these endpoints" })}
```

**File**: `frontend/app/[locale]/agents/versions/AgentVersionPubulishModal.tsx` (modified, +40/-65)
```diff
@@ -3,14 +3,16 @@
 import { useState, useEffect } from "react";
 import { useTranslation } from "react-i18next";
 import { App, Modal, Form, Input, Button } from "antd";
-import { useQuery, useQueryClient } from "@tanstack/react-query";
+import { useQueryClient } from "@tanstack/react-query";
 
 const { TextArea } = Input;
 
 import { publishVersion, updateVersion } from "@/services/agentVersionService";
 import { useAgentVersionList } from "@/hooks/agent/useAgentVersionList";
-import A2AServerSettingsPanel from "../components/a2a/A2AServerSettingsPanel";
-import { a2aClientService } from "@/services/a2aService";
+import {
+  buildDefaultAgentVersionName,
+  getAgentPublishCompletion,
+} from "@/lib/agentUsageGuide";
 import log from "@/lib/logger";
 
 export interface AgentVersionPubulishModalProps {
@@ -19,6 +21,7 @@ export interface AgentVersionPubulishModalProps {
   agentId?: number | null;
   versionNo?: number | null;
   isEdit?: boolean;
+  defaultVersionName?: string;
   initialValues?: {
     version_name?: string;
     release_note?: string;
@@ -33,6 +36,7 @@ export default function AgentVersionPubulishModal({
   agentId,
   versionNo,
   isEdit = false,
+  defaultVersionName,
   initialValues,
   onPublished,
   onUpdated,
@@ -46,27 +50,20 @@ export default function AgentVersionPubulishModal({
 
   const [isLoading, setIsLoading] = useState(false);
   const [publishForm] = Form.useForm();
-  const [showA2ASettings, setShowA2ASettings] = useState(false);
-  const [a2aAgentInfo, setA2aAgentInfo] = useState<{
-    endpoint_id: string;
-    agent_id: number;
-  } | null>(null);
-  const { data: a2aSettingsData } = useQuery({
-    queryKey: ["a2aServerSettings", a2aAgentInfo?.agent_id],
-    queryFn: () => a2aClientService.getServerSettings(a2aAgentInfo!.agent_id),
-    enabled: showA2ASettings && !!a2aAgentInfo,
-  });
 
   // Reset form when modal opens or initialValues changes
   useEffect(() => {
     if (open) {
       if (isEdit && initialValues) {
         publishForm.setFieldsValue(initialValues);
       } else if (!isEdit) {
-        publishForm.resetFields();
+        publishForm.setFieldsValue({
+          version_name:
+            defaultVersionName || buildDefaultAgentVersionName(undefined),
+        });
       }
     }
-  }, [open, isEdit, initialValues, publishForm]);
+  }, [open, isEdit, initialValues, defaultVersionName, publishForm]);
 
   // Custom validator for duplicate version name
   const validateVersionName = {
@@ -83,22 +80,30 @@ export default function AgentVersionPubulishModal({
       );
 
       if (duplicate) {
-        return Promise.reject(new Error(t("agent.version.versionNameDuplicate")));
+        return Promise.reject(
+          new Error(t("agent.version.versionNameDuplicate"))
+        );
       }
 
       return Promise.resolve();
     },
   };
 
-  const handleSubmit = async (values: { version_name?: string; release_note?: string }) => {
+  const handleSubmit = async (values: {
+    version_name?: string;
+    release_note?: string;
+  }) => {
     if (isEdit) {
       await handleUpdate(values);
     } else {
       await handlePublish(values);
     }
   };
 
-  const handlePublish = async (values: { version_name?: string; release_note?: string }) => {
+  const handlePublish = async (values: {
+    version_name?: string;
+    release_note?: string;
+  }) => {
     if (!agentId) {
       message.error(t("agent.error.agentNotFound"));
       return;
@@ -112,26 +117,14 @@ export default function AgentVersionPubulishModal({
     try {
       setIsLoading(true);
       const result = await publishVersion(agentId, values);
-      if (result.success) {
+      if (getAgentPublishCompletion(result) === "complete") {
         message.success(t("agent.version.publishSuccess"));
-        if (result.data?.a2a_agent) {
-          setA2aAgentInfo({
-            endpoint_id: result.data.a2a_agent.endpoint_id,
-            agent_id: result.data.a2a_agent.agent_id,
-          });
-          onClose();
-          publishForm.resetFields();
-          onPublished?.();
-          queryClient.invalidateQueries({ queryKey: ["agents"] });
-          queryClient.invalidateQueries({ queryKey: ["publishedAgentsList"] });
-          setShowA2ASettings(true);
-        } else {
-          onClose();
-          publishForm.resetFields();
-          onPublished?.();
-          queryClient.invalidateQueries({ queryKey: ["agents"] });
-          queryClient.invalidateQueries({ queryKey: ["publishedAgentsList"] });
-        }
+        onClose();
+        publishForm.resetFields();
+        onPublished?.();
+        queryClient.invalidateQueries({ queryKey: ["agents"] });
+        queryClient.invalidateQueries({ queryKey: ["publishedAgentsList"] });
+        queryClient.invalidateQueries({ queryKey: ["myEditableAgents"] });
       } else {
         message.error(result.message || t("agent.version.publishFailed"));
       }
@@ -143,7 +136,10 @@ export default function AgentVersionPubulishModal
```

---

### Incident Patch 13: `697d5321` (2026-09-28)
**Commit Message**: 🐛 Bugfix: Added a configuration option to control the parallel_executor timeout. (#4021)

**File**: `backend/agents/create_agent_info.py` (modified, +17/-9)
```diff
@@ -86,6 +86,7 @@
     NEXENT_SANDBOX_WORKSPACE_VOLUME,
     RUNTIME_MCP_CLOSE_TIMEOUT_SECONDS,
     RUNTIME_MCP_TOOL_TIMEOUT_SECONDS,
+    RUNTIME_PARALLEL_EXECUTOR_TIMEOUT_SECONDS,
 )
 from consts.model import ToolParamsRequest
 from consts.exceptions import ValidationError, WorkbenchError
@@ -97,6 +98,21 @@
 logger.setLevel(logging.INFO)
 
 
+def _build_parallel_executor_tool_config(default_timeout_seconds: int) -> ToolConfig:
+    return ToolConfig(
+        class_name=ParallelExecutorTool.__name__,
+        name=ParallelExecutorTool.name,
+        description=ParallelExecutorTool.description,
+        inputs=json.dumps(
+            ParallelExecutorTool.inputs_for_timeout(default_timeout_seconds),
+            ensure_ascii=False,
+        ),
+        output_type=ParallelExecutorTool.output_type,
+        params={"default_timeout_seconds": default_timeout_seconds},
+        source="local",
+    )
+
+
 def _create_fixed_search_memory_tool():
     """Create the internal search tool lazily to keep import boundaries stable."""
     from nexent.core.tools.search_memory_tool import SearchMemoryTool
@@ -1429,15 +1445,7 @@ async def create_agent_config(
     # Append parallel_executor as an always-available system-managed tool.
     # Memory handling is wired separately below: only store_memory is exposed
     # to the model, while search_memory runs once during preparation.
-    tool_list.append(ToolConfig(
-        class_name=ParallelExecutorTool.__name__,
-        name=ParallelExecutorTool.name,
-        description=ParallelExecutorTool.description,
-        inputs=json.dumps(ParallelExecutorTool.inputs, ensure_ascii=False),
-        output_type=ParallelExecutorTool.output_type,
-        params={},
-        source="local",
-    ))
+    tool_list.append(_build_parallel_executor_tool_config(RUNTIME_PARALLEL_EXECUTOR_TIMEOUT_SECONDS))
 
     if (
         include_automation_tool
```

**File**: `backend/consts/const.py` (modified, +5/-0)
```diff
@@ -344,6 +344,11 @@ class VectorDatabaseType(str, Enum):
 RUNTIME_MCP_TOOL_TIMEOUT_SECONDS = float(
     os.getenv("RUNTIME_MCP_TOOL_TIMEOUT_SECONDS", "60")
 )
+RUNTIME_PARALLEL_EXECUTOR_TIMEOUT_SECONDS = int(
+    os.getenv("RUNTIME_PARALLEL_EXECUTOR_TIMEOUT_SECONDS", "120")
+)
+if RUNTIME_PARALLEL_EXECUTOR_TIMEOUT_SECONDS <= 0:
+    raise ValueError("RUNTIME_PARALLEL_EXECUTOR_TIMEOUT_SECONDS must be greater than zero")
 RUNTIME_MCP_CLOSE_TIMEOUT_SECONDS = float(
     os.getenv("RUNTIME_MCP_CLOSE_TIMEOUT_SECONDS", "5")
 )
```

**File**: `deploy/env/.env.example` (modified, +1/-0)
```diff
@@ -156,6 +156,7 @@ RUNTIME_AGENT_THREAD_MAX_QUEUE_SIZE=32
 RUNTIME_AGENT_THREAD_QUEUE_TIMEOUT_SECONDS=30
 RUNTIME_AGENT_THREAD_CANCEL_GRACE_SECONDS=5
 RUNTIME_MCP_TOOL_TIMEOUT_SECONDS=60
+RUNTIME_PARALLEL_EXECUTOR_TIMEOUT_SECONDS=120
 RUNTIME_MCP_CLOSE_TIMEOUT_SECONDS=5
 RUNTIME_THREAD_SHUTDOWN_GRACE_SECONDS=30
 NORTHBOUND_CONTROL_THREAD_MAX_WORKERS=8
```

**File**: `sdk/nexent/core/tools/parallel_executor.py` (modified, +24/-2)
```diff
@@ -1,4 +1,5 @@
 from concurrent.futures import TimeoutError as FutureTimeoutError
+from copy import deepcopy
 import threading
 from typing import Any, Dict
 
@@ -82,7 +83,27 @@ class ParallelExecutorTool(Tool):
     }
     output_type = "any"
 
-    def forward(self, tasks, timeout: int = 120, max_workers: int = 4):
+    @classmethod
+    def inputs_for_timeout(cls, default_timeout_seconds: int) -> dict:
+        inputs = deepcopy(cls.inputs)
+        inputs["timeout"]["default"] = default_timeout_seconds
+        inputs["timeout"]["description"] = f"Per-task timeout in seconds (default {default_timeout_seconds})"
+        inputs["timeout"]["description_zh"] = f"单个任务超时秒数（默认{default_timeout_seconds}）"
+        return inputs
+
+    def __init__(self, default_timeout_seconds: int = 120):
+        if (
+            isinstance(default_timeout_seconds, bool)
+            or not isinstance(default_timeout_seconds, int)
+            or default_timeout_seconds <= 0
+        ):
+            raise ValueError("default_timeout_seconds must be a positive integer")
+        super().__init__()
+        self.default_timeout_seconds = default_timeout_seconds
+        self.inputs = self.inputs_for_timeout(default_timeout_seconds)
+        self.description_zh = self.description_zh.replace("默认120秒", f"默认{default_timeout_seconds}秒")
+
+    def forward(self, tasks, timeout: int | None = None, max_workers: int = 4):
         """Execute the tasks in parallel.
 
         ``tasks`` is a list where each element is a 2-tuple
@@ -91,7 +112,8 @@ def forward(self, tasks, timeout: int = 120, max_workers: int = 4):
 
         Returns a list (all 2-tuples) or dict (all 3-tuples).
         """
-        return _parallel_executor(tasks, timeout=timeout, max_workers=max_workers)
+        effective_timeout = self.default_timeout_seconds if timeout is None else timeout
+        return _parallel_executor(tasks, timeout=effective_timeout, max_workers=max_workers)
 
 
 # ---------------------------------------------------------------------------
```

**File**: `test/backend/agents/test_create_agent_info.py` (modified, +8/-1)
```diff
@@ -10,6 +10,7 @@
 
 env_state = bootstrap_test_env()
 consts_const = env_state["mock_const"]
+consts_const.RUNTIME_PARALLEL_EXECUTOR_TIMEOUT_SECONDS = 120
 
 # Mock consts.model module with HistoryItem class
 from typing import List, Optional, Dict, Any
@@ -463,6 +464,9 @@ class MockUncertaintyReserveBasisUnknown(Exception):
 _mock_parallel_executor_tool_cls.name = "parallel_executor"
 _mock_parallel_executor_tool_cls.description = "Execute multiple independent calls in parallel."
 _mock_parallel_executor_tool_cls.inputs = {"tasks": {"type": "array"}}
+_mock_parallel_executor_tool_cls.inputs_for_timeout = lambda timeout: {
+    "tasks": {"type": "array"}, "timeout": {"type": "integer", "default": timeout}
+}
 _mock_parallel_executor_tool_cls.output_type = "any"
 _parallel_executor_mod = _create_stub_module(
     "nexent.core.tools.parallel_executor",
@@ -2350,7 +2354,8 @@ async def test_create_agent_config_basic(self):
                 patch('backend.agents.create_agent_info.build_memory_context') as mock_build_memory, \
                 patch('backend.agents.create_agent_info.AgentConfig') as mock_agent_config, \
                 patch('backend.agents.create_agent_info.prepare_prompt_templates') as mock_prepare_templates, \
-                patch('backend.agents.create_agent_info.get_model_by_model_id') as mock_get_model_by_id:
+                patch('backend.agents.create_agent_info.get_model_by_model_id') as mock_get_model_by_id, \
+                patch('backend.agents.create_agent_info.RUNTIME_PARALLEL_EXECUTOR_TIMEOUT_SECONDS', 240):
 
             # Set mock return values
             mock_search_agent.return_value = {
@@ -2412,6 +2417,8 @@ async def test_create_agent_config_basic(self):
             assert len(pe_calls) == 1
             assert pe_calls[0][1]["name"] == "parallel_executor"
             assert pe_calls[0][1]["source"] == "local"
+            assert pe_calls[0][1]["params"] == {"default_timeout_seconds": 240}
+            assert '"default": 240' in pe_calls[0][1]["inputs"]
 
     @pytest.mark.asyncio
     async def test_create_agent_config_with_sub_agents(self):
```

**File**: `test/sdk/core/tools/test_parallel_executor.py` (modified, +17/-0)
```diff
@@ -1,5 +1,6 @@
 import contextvars
 import time
+from unittest.mock import patch
 
 import pytest
 
@@ -198,6 +199,22 @@ def test_default_max_workers_allows_parallelism(self):
 # ---------------------------------------------------------------------------
 
 class TestParallelExecutorTool:
+    def test_configured_default_timeout_and_explicit_override(self):
+        tool = ParallelExecutorTool(default_timeout_seconds=240)
+        assert tool.inputs["timeout"]["default"] == 240
+        assert "默认240秒" in tool.description_zh
+
+        with patch("sdk.nexent.core.tools.parallel_executor._parallel_executor") as execute:
+            tool.forward(tasks=[])
+            execute.assert_called_with([], timeout=240, max_workers=4)
+            tool.forward(tasks=[], timeout=30)
+            execute.assert_called_with([], timeout=30, max_workers=4)
+
+    @pytest.mark.parametrize("timeout", [0, -1, True, 1.5])
+    def test_invalid_configured_default_timeout(self, timeout):
+        with pytest.raises(ValueError, match="positive integer"):
+            ParallelExecutorTool(default_timeout_seconds=timeout)
+
     def test_forward_delegates_to_parallel_executor(self):
         """ParallelExecutorTool.forward should delegate to _parallel_executor."""
         tool = ParallelExecutorTool()
```

---

### Incident Patch 14: `38646955` (2026-09-28)
**Commit Message**: fix: enforce and localize conversation resource limits (#3717)

**File**: `backend/apps/conversation_management_app.py` (modified, +3/-0)
```diff
@@ -17,6 +17,7 @@
     RenameRequest,
 )
 from consts.exceptions import (
+    AppException,
     ConversationNotFoundError,
     ValidationError,
     TokenExpiredError,
@@ -65,6 +66,8 @@ async def create_new_conversation_endpoint(request: ConversationRequest, authori
     except TokenExpiredError as e:
         logging.warning("Session expired")
         raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail=str(e))
+    except AppException:
+        raise
     except Exception as e:
         logging.error(f"Failed to create conversation: {str(e)}")
         raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail=str(e))
```

**File**: `backend/consts/const.py` (modified, +2/-0)
```diff
@@ -217,6 +217,8 @@ class VectorDatabaseType(str, Enum):
 MAX_GROUPS_PER_TENANT = _positive_int_env("MAX_GROUPS_PER_TENANT", 1_000)
 MAX_SUPER_ADMIN_COUNT = _positive_int_env("MAX_SUPER_ADMIN_COUNT", 1)
 MAX_ADMINS_PER_TENANT = _positive_int_env("MAX_ADMINS_PER_TENANT", 1_000)
+MAX_CONVERSATION_TURNS = _positive_int_env("MAX_CONVERSATION_TURNS", 100)
+MAX_CONVERSATIONS_PER_USER = _positive_int_env("MAX_CONVERSATIONS_PER_USER", 1_000)
 MAX_AGENTS_PER_TENANT = _positive_int_env("MAX_AGENTS_PER_TENANT", 1_000)
 
 # Invitation code type for asset administrator registration
```

**File**: `backend/database/conversation_db.py` (modified, +82/-2)
```diff
@@ -3,9 +3,16 @@
 from datetime import datetime
 from typing import Any, Dict, List, Optional, TypedDict
 
-from sqlalchemy import asc, desc, func, insert, select, update
+from sqlalchemy import asc, desc, func, insert, select, text, update
 
+from consts.const import (
+    MAX_CONVERSATION_TURNS,
+    MAX_CONVERSATIONS_PER_USER,
+    MESSAGE_ROLE,
+)
+from consts.error_code import ErrorCode
 from consts.exceptions import (
+    AppException,
     ConversationNotFoundError,
     RuntimeMetadataVersionConflict,
     WorkbenchConfigVersionConflict,
@@ -123,6 +130,70 @@ def _get_effective_tenant_id(user_tenant: Dict[str, Any]) -> str:
     return DEFAULT_TENANT_ID
 
 
+def _lock_conversation_limit_scope(session, scope: str) -> None:
+    """Serialize quota checks for one user or conversation within a transaction."""
+    session.execute(
+        text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
+        {"lock_key": scope},
+    )
+
+
+def _enforce_user_conversation_limit(session, user_id: Optional[str]) -> None:
+    """Reject creation when a user already owns the configured number of conversations."""
+    if not user_id:
+        return
+
+    _lock_conversation_limit_scope(session, f"conversation-user-limit:{user_id}")
+    statement = select(func.count(ConversationRecord.conversation_id)).where(
+        ConversationRecord.created_by == user_id,
+        ConversationRecord.delete_flag == "N",
+    )
+    conversation_count = int(session.scalar(statement) or 0)
+    if conversation_count >= MAX_CONVERSATIONS_PER_USER:
+        raise AppException(
+            ErrorCode.TENANT_RESOURCE_EXCEEDED,
+            "Conversation history limit reached: "
+            f"maximum {MAX_CONVERSATIONS_PER_USER} conversations per user",
+            details={
+                "resource": "conversations",
+                "scope": "user",
+                "limit": MAX_CONVERSATIONS_PER_USER,
+                "current_count": conversation_count,
+            },
+        )
+
+
+def _enforce_conversation_turn_limit(
+    session,
+    conversation_id: int,
+    message_role: str,
+    user_id: Optional[str],
+) -> None:
+    """Reject a new user message when the conversation turn quota is reached."""
+    if not user_id or message_role != MESSAGE_ROLE["USER"]:
+        return
+
+    _lock_conversation_limit_scope(session, f"conversation-turn-limit:{conversation_id}")
+    statement = select(func.count(ConversationMessage.message_id)).where(
+        ConversationMessage.conversation_id == conversation_id,
+        ConversationMessage.message_role == MESSAGE_ROLE["USER"],
+        ConversationMessage.delete_flag == "N",
+    )
+    turn_count = int(session.scalar(statement) or 0)
+    if turn_count >= MAX_CONVERSATION_TURNS:
+        raise AppException(
+            ErrorCode.TENANT_RESOURCE_EXCEEDED,
+            "Conversation turn limit reached: "
+            f"maximum {MAX_CONVERSATION_TURNS} turns per conversation",
+            details={
+                "resource": "conversation_turns",
+                "scope": "conversation",
+                "limit": MAX_CONVERSATION_TURNS,
+                "current_count": turn_count,
+            },
+        )
+
+
 def create_conversation(conversation_title: str, user_id: Optional[str] = None,
                         agent_id: Optional[int] = None,
                         chat_mode: Optional[str] = None,
@@ -143,6 +214,8 @@ def create_conversation(conversation_title: str, user_id: Optional[str] = None,
         Dict[str, Any]: Dictionary containing complete information of the newly created conversation
     """
     with get_db_session() as session:
+        _enforce_user_conversation_limit(session, user_id)
+
         # Prepare data dictionary
         data = {"conversation_title": conversation_title, "delete_flag": 'N'}
         if agent_id is not None:
@@ -225,6 +298,13 @@ def create_conversation_message(message_data: Dict[str, Any], user_id: Optional[
         # Ensure conversation_id is integer type
         conversation_id = int(message_data['conversation_id'])
         message_idx = int(message_data['message_idx'])
+        message_role = message_data['role']
+        _enforce_conversation_turn_limit(
+            session=session,
+            conversation_id=conversation_id,
+            message_role=message_role,
+            user_id=user_id,
+        )
 
         minio_files = message_data.get('minio_files')
         # Convert minio_files to JSON string for storage
@@ -234,7 +314,7 @@ def create_conversation_message(message_data: Dict[str, Any], user_id: Optional[
                 minio_files = json.dumps(minio_files)
 
         # Prepare data dictionary
-        data = {"conversation_id": conversation_id, "message_index": message_idx, "message_role": message_data['role'],
+        data = {"conversation_id": conversation_id, "message_index": message_idx, "message_role": message_role,
                 "message_content": message_data['content'], "minio_files": m
```

**File**: `backend/services/conversation_management_service.py` (modified, +3/-1)
```diff
@@ -10,7 +10,7 @@
 
 from consts.const import LANGUAGE, MODEL_CONFIG_MAPPING, MESSAGE_ROLE, DEFAULT_EN_TITLE, DEFAULT_ZH_TITLE
 from consts.model import AgentRequest, MessageRequest, MessageUnit
-from consts.exceptions import ConversationNotFoundError, ValidationError
+from consts.exceptions import AppException, ConversationNotFoundError, ValidationError
 from database.conversation_db import (
     CHAT_MODE_VALUES,
     create_conversation,
@@ -431,6 +431,8 @@ def create_new_conversation(
             create_kwargs["workbench_config"] = workbench_config
         conversation_data = create_conversation(title, user_id, **create_kwargs)
         return conversation_data
+    except AppException:
+        raise
     except Exception as e:
         logging.error(f"Failed to create conversation: {str(e)}")
         raise Exception(str(e))
```

**File**: `deploy/env/.env.example` (modified, +2/-1)
```diff
@@ -82,6 +82,8 @@ MAX_USERS_PER_TENANT=10000
 MAX_GROUPS_PER_TENANT=1000
 MAX_SUPER_ADMIN_COUNT=1
 MAX_ADMINS_PER_TENANT=1000
+MAX_CONVERSATION_TURNS=100
+MAX_CONVERSATIONS_PER_USER=1000
 
 # Minio Config
 MINIO_ENDPOINT=http://nexent-minio:9000
@@ -362,4 +364,3 @@ LOG_MAX_BYTES=52428800
 
 # Number of backup files to retain
 LOG_BACKUP_COUNT=30
-
```

**File**: `frontend/app/[locale]/chat/internal/chatInterface.tsx` (modified, +4/-1)
```diff
@@ -10,6 +10,7 @@ import { useTranslation } from "react-i18next";
 import { ROLE_ASSISTANT } from "@/const/agentConfig";
 import { ENABLE_CITATION_CLICK_HIGHLIGHT } from "@/const/citation";
 import { MESSAGE_ROLES } from "@/const/chatConfig";
+import { getConversationResourceLimitMessage } from "@/const/errorMessageI18n";
 import { useConfig } from "@/hooks/useConfig";
 import { useModelList } from "@/hooks/model/useModelList";
 import { useAuthorizationContext } from "@/components/providers/AuthorizationProvider";
@@ -1085,7 +1086,9 @@ export function ChatInterface() {
           });
         } else {
           log.error(t("chatInterface.errorLabel"), error);
-          const errorMessage = t("chatInterface.errorProcessingRequest");
+          const errorMessage =
+            getConversationResourceLimitMessage(error, t) ||
+            t("chatInterface.errorProcessingRequest");
           setSessionMessages((prev) => {
             const newMessages = { ...prev };
             const lastMsg =
```

**File**: `frontend/app/[locale]/newchat/assistant-ui/composer.tsx` (modified, +10/-2)
```diff
@@ -68,6 +68,7 @@ import {
 } from "../ui/skill-directives";
 import { ordinarySendError, protectOrdinarySend } from "../utils/ordinary-send";
 import { RuntimeMetadataEditor } from "@/components/chat/RuntimeMetadataEditor";
+import { getConversationResourceLimitMessage } from "@/const/errorMessageI18n";
 
 export type ChatMode = "planning" | "execution";
 
@@ -254,7 +255,11 @@ export const Composer: FC<ComposerProps> = ({
       restoreDraft: true,
       onRejected: (error) => {
         if (runtime.threads.getState().mainThreadId === threadId) {
-          setSendError(ordinarySendError(error, i18n.language));
+          setSendError(
+            ordinarySendError(error, i18n.language, (value) =>
+              getConversationResourceLimitMessage(value, t)
+            )
+          );
         }
       },
     });
@@ -658,7 +663,10 @@ export const Composer: FC<ComposerProps> = ({
                     </Tooltip>
                   </AuiIf>
                 )}
-                <ComposerSendOrCancel onSend={prepareSend} disabled={disabled} />
+                <ComposerSendOrCancel
+                  onSend={prepareSend}
+                  disabled={disabled}
+                />
               </div>
             </div>
           </ComposerPrimitive.Root>
```

**File**: `frontend/app/[locale]/newchat/assistant-ui/thread.tsx` (modified, +13/-1)
```diff
@@ -67,6 +67,7 @@ import {
 } from "lucide-react";
 import { message } from "antd";
 import type { Agent, PublishedAgent } from "@/types/agentConfig";
+import { getConversationResourceLimitMessage } from "@/const/errorMessageI18n";
 import { getAgentIcon } from "@/lib/chat/agentIconUtils";
 import { useModelList } from "@/hooks/model/useModelList";
 import {
@@ -1215,10 +1216,21 @@ const ThreadScrollToBottom: FC = () => {
 };
 
 const MessageError: FC = () => {
+  const { t } = useTranslation();
+  const rawError = useAuiState((state) => {
+    const status = state.message.status;
+    return status?.type === "incomplete" && status.reason === "error"
+      ? status.error
+      : undefined;
+  });
+  const localizedMessage = getConversationResourceLimitMessage(rawError, t);
+
   return (
     <MessagePrimitive.Error>
       <ErrorPrimitive.Root className="aui-message-error-root border-destructive bg-destructive/10 text-destructive dark:bg-destructive/5 mt-2 rounded-md border p-3 text-sm dark:text-red-200">
-        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
+        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2">
+          {localizedMessage ?? undefined}
+        </ErrorPrimitive.Message>
       </ErrorPrimitive.Root>
     </MessagePrimitive.Error>
   );
```

---

### Incident Patch 15: `524a3740` (2026-09-28)
**Commit Message**: feat(logging):Security Audit Logging (#4015)

* feat: 添加安全审计服务并在关键操作记录审计日志

新增 audit_service 服务用于记录安全审计事件，在用户注册、登录、登出、密码修改、OAuth/ CAS 相关操作、令牌管理、账户撤销等关键安全操作中记录审计日志，同时新增对应测试用例确保审计功能正常工作。

* feat: 为 API 密钥操作添加上下文安全审计日志

在 API 密钥应用和北向应用中，为刷新、撤销 API 密钥以及批量创建 API 用户等操作添加安全审计日志记录，仅记录非敏感的目标用户信息、操作人信息和请求标识，避免泄露明文 API 密钥。同时新增对应的测试用例验证审计日志的正确性和安全性。

* feat: 为用户、租户、邀请和群组操作添加安全审计日志

在多个API端点（用户、租户、邀请、群组相关的创建、更新、删除等操作）中添加了安全审计日志记录，同时新增了对应的测试用例来验证审计日志的正确性。

**File**: `backend/apps/api_key_app.py` (modified, +24/-2)
```diff
@@ -2,9 +2,9 @@
 
 import logging
 from http import HTTPStatus
-from typing import Optional
+from typing import Any, Dict, Optional
 
-from fastapi import APIRouter, Header, HTTPException, Query
+from fastapi import APIRouter, Header, HTTPException, Query, Request
 from fastapi.responses import JSONResponse
 
 from consts.exceptions import (
@@ -19,6 +19,7 @@
     refresh_user_api_key,
     revoke_user_api_keys,
 )
+from services.audit_service import record_security_event
 from utils.auth_utils import get_current_user_context
 
 logger = logging.getLogger("api_key_app")
@@ -37,6 +38,19 @@ def _map_error(exc: Exception) -> None:
     raise exc
 
 
+def _audit_safe_target(result: Dict[str, Any]) -> Dict[str, Any]:
+    """Pick non-secret target fields for the audit trail.
+
+    The service results carry the freshly created plaintext API key; only the
+    whitelisted identifiers below are handed to the audit entry.
+    """
+    return {
+        "target_user_id": (result or {}).get("user_id"),
+        "target_email": (result or {}).get("email"),
+        "revoked_count": (result or {}).get("revoked_count"),
+    }
+
+
 @router.get("")
 async def list_api_keys_endpoint(
     tenant_id: str = Query(...),
@@ -66,6 +80,7 @@ async def list_api_keys_endpoint(
 @router.post("/refresh")
 async def refresh_api_key_endpoint(
     payload: ApiKeyTargetRequest,
+    http_request: Request,
     authorization: Optional[str] = Header(None),
 ) -> JSONResponse:
     try:
@@ -77,6 +92,9 @@ async def refresh_api_key_endpoint(
             user_id=payload.user_id,
             email=str(payload.email) if payload.email else None,
         )
+        record_security_event("api_key_refresh", request=http_request,
+                              user_id=actor_user_id, tenant_id=tenant_id,
+                              details=_audit_safe_target(result))
         return JSONResponse(
             status_code=HTTPStatus.OK, content={"message": "success", "data": result}
         )
@@ -87,6 +105,7 @@ async def refresh_api_key_endpoint(
 
 @router.delete("")
 async def revoke_api_key_endpoint(
+    http_request: Request,
     user_id: Optional[str] = Query(None),
     email: Optional[str] = Query(None),
     authorization: Optional[str] = Header(None),
@@ -101,6 +120,9 @@ async def revoke_api_key_endpoint(
             user_id=target.user_id,
             email=str(target.email) if target.email else None,
         )
+        record_security_event("api_key_revoke", request=http_request,
+                              user_id=actor_user_id, tenant_id=tenant_id,
+                              details=_audit_safe_target(result))
         return JSONResponse(
             status_code=HTTPStatus.OK, content={"message": "success", "data": result}
         )
```

**File**: `backend/apps/cas_app.py` (modified, +11/-1)
```diff
@@ -22,6 +22,7 @@
     renew_with_ticket,
     revoke_from_logout_request,
 )
+from services.audit_service import record_security_event
 
 logger = logging.getLogger(__name__)
 router = APIRouter(prefix="/user/cas", tags=["cas"])
@@ -46,9 +47,13 @@ async def login(redirect: str = Query("/", description="URL to return to after l
 
 
 @router.get("/callback")
-async def callback(ticket: str = "", redirect: str = "/"):
+async def callback(http_request: Request, ticket: str = "", redirect: str = "/"):
     try:
         result = await login_with_ticket(ticket, redirect)
+        result_user = (result or {}).get("user") or {}
+        record_security_event("cas_login", request=http_request,
+                              user_id=result_user.get("id"),
+                              user_email=result_user.get("email"))
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={"message": "CAS login successful", "data": result},
@@ -118,6 +123,11 @@ async def _handle_logout_request(
     )
     result = revoke_from_logout_request(logout_request)
     logger.info("CAS SLO %s revoke result: %s", endpoint, result)
+    record_security_event("cas_logout", request=request,
+                          details={"endpoint": endpoint,
+                                   "revoked": (result or {}).get("revoked"),
+                                   "cas_user_id": (result or {}).get("cas_user_id", ""),
+                                   "session_index": (result or {}).get("session_index", "")})
     return JSONResponse(
         status_code=HTTPStatus.OK,
         content={"message": "success", "data": result},
```

**File**: `backend/apps/group_app.py` (modified, +51/-9)
```diff
@@ -4,7 +4,7 @@
 import logging
 from typing import Optional
 
-from fastapi import APIRouter, HTTPException, Header
+from fastapi import APIRouter, Header, HTTPException, Request
 from http import HTTPStatus
 from starlette.responses import JSONResponse
 
@@ -20,6 +20,7 @@
     ValidationError,
     tenant_resource_limit_error_payload,
 )
+from services.audit_service import record_security_event
 from services.group_service import (
     create_group, get_group_info, update_group, delete_group,
     add_user_to_single_group, remove_user_from_single_group, get_group_users,
@@ -36,6 +37,7 @@
 @router.post("", response_model=None)
 async def create_group_endpoint(
     request: GroupCreateRequest,
+    http_request: Request,
     authorization: Optional[str] = Header(None)
 ) -> JSONResponse:
     """
@@ -50,7 +52,7 @@ async def create_group_endpoint(
     """
     try:
         # Get current user ID from token
-        user_id, _ = get_current_user_id(authorization)
+        user_id, operator_tenant_id = get_current_user_id(authorization)
 
         # Create group
         group_info = create_group(
@@ -62,6 +64,10 @@ async def create_group_endpoint(
 
         logger.info(f"Created group '{request.group_name}' in tenant {request.tenant_id} by user {user_id}")
 
+        record_security_event("group_create", request=http_request,
+                              user_id=user_id, tenant_id=operator_tenant_id,
+                              details={"tenant_id": request.tenant_id,
+                                       "group_name": request.group_name})
         return JSONResponse(
             status_code=HTTPStatus.CREATED,
             content={
@@ -205,6 +211,7 @@ async def get_groups_endpoint(
 async def update_group_endpoint(
     group_id: int,
     request: GroupUpdateRequest,
+    http_request: Request,
     authorization: Optional[str] = Header(None)
 ) -> JSONResponse:
     """
@@ -220,7 +227,7 @@ async def update_group_endpoint(
     """
     try:
         # Get current user ID from token
-        user_id, _ = get_current_user_id(authorization)
+        user_id, operator_tenant_id = get_current_user_id(authorization)
 
         # Prepare updates dict
         updates = {}
@@ -244,6 +251,10 @@ async def update_group_endpoint(
 
         logger.info(f"Updated group {group_id} by user {user_id}")
 
+        record_security_event("group_update", request=http_request,
+                              user_id=user_id, tenant_id=operator_tenant_id,
+                              details={"group_id": group_id,
+                                       "updated_fields": sorted(updates)})
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={
@@ -280,6 +291,7 @@ async def update_group_endpoint(
 @router.delete("/{group_id}")
 async def delete_group_endpoint(
     group_id: int,
+    http_request: Request,
     authorization: Optional[str] = Header(None)
 ) -> JSONResponse:
     """
@@ -294,7 +306,7 @@ async def delete_group_endpoint(
     """
     try:
         # Get current user ID from token
-        user_id, _ = get_current_user_id(authorization)
+        user_id, operator_tenant_id = get_current_user_id(authorization)
 
         # Delete group
         success = delete_group(
@@ -307,6 +319,9 @@ async def delete_group_endpoint(
 
         logger.info(f"Deleted group {group_id} by user {user_id}")
 
+        record_security_event("group_delete", request=http_request,
+                              user_id=user_id, tenant_id=operator_tenant_id,
+                              details={"group_id": group_id})
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={
@@ -344,6 +359,7 @@ async def delete_group_endpoint(
 async def add_user_to_group_endpoint(
     group_id: int,
     request: GroupUserRequest,
+    http_request: Request,
     authorization: Optional[str] = Header(None)
 ) -> JSONResponse:
     """
@@ -363,7 +379,7 @@ async def add_user_to_group_endpoint(
             raise ValidationError("group_ids should not be provided for single group operation")
 
         # Get current user ID from token
-        current_user_id, _ = get_current_user_id(authorization)
+        current_user_id, operator_tenant_id = get_current_user_id(authorization)
 
         # Add user to group
         result = add_user_to_single_group(
@@ -374,6 +390,10 @@ async def add_user_to_group_endpoint(
 
         logger.info(f"Added user {request.user_id} to group {group_id} by user {current_user_id}")
 
+        record_security_event("group_member_add", request=http_request,
+                              user_id=current_user_id, tenant_id=operator_tenant_id,
+                              details={"target_user_id": request.user_id,
+                                       "group_id": group_id})
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={
@@ -412,6 +432,7 @@ async def add_user_to_group_endpoint(
 async def remove
```

**File**: `backend/apps/invitation_app.py` (modified, +27/-5)
```diff
@@ -4,14 +4,15 @@
 import logging
 from typing import Optional
 
-from fastapi import APIRouter, HTTPException, Header
+from fastapi import APIRouter, Header, HTTPException, Request
 from http import HTTPStatus
 from starlette.responses import JSONResponse
 
 from consts.model import (
     InvitationCreateRequest, InvitationUpdateRequest, InvitationListRequest
 )
 from consts.exceptions import NotFoundException, ValidationError, UnauthorizedError, DuplicateError
+from services.audit_service import record_security_event
 from services.invitation_service import (
     create_invitation_code, update_invitation_code, get_invitation_by_code,
     check_invitation_available, use_invitation_code, update_invitation_code_status,
@@ -86,6 +87,7 @@ async def list_invitations_endpoint(
 @router.post("")
 async def create_invitation_endpoint(
     request: InvitationCreateRequest,
+    http_request: Request,
     authorization: Optional[str] = Header(None)
 ) -> JSONResponse:
     """
@@ -100,7 +102,7 @@ async def create_invitation_endpoint(
     """
     try:
         # Get current user ID from token
-        user_id, _ = get_current_user_id(authorization)
+        user_id, operator_tenant_id = get_current_user_id(authorization)
 
         # Validate tenant_id from request
         tenant_id = request.tenant_id
@@ -123,6 +125,13 @@ async def create_invitation_endpoint(
 
         logger.info(f"Created invitation code {invitation_info['invitation_code']} (type: {request.code_type}) for tenant {tenant_id} by user {user_id}")
 
+        record_security_event("invitation_create", request=http_request,
+                              user_id=user_id, tenant_id=operator_tenant_id,
+                              details={"invitation_code": (invitation_info or {}).get("invitation_code"),
+                                       "code_type": request.code_type,
+                                       "tenant_id": request.tenant_id,
+                                       "capacity": request.capacity,
+                                       "group_ids": (request.group_ids or [])[:20]})
         return JSONResponse(
             status_code=HTTPStatus.CREATED,
             content={
@@ -173,6 +182,7 @@ async def create_invitation_endpoint(
 async def update_invitation_endpoint(
     invitation_code: str,
     request: InvitationUpdateRequest,
+    http_request: Request,
     authorization: Optional[str] = Header(None)
 ) -> JSONResponse:
     """
@@ -188,7 +198,7 @@ async def update_invitation_endpoint(
     """
     try:
         # Get current user ID from token
-        user_id, _ = get_current_user_id(authorization)
+        user_id, operator_tenant_id = get_current_user_id(authorization)
 
         # Get invitation info to find invitation_id
         invitation_info = get_invitation_by_code(invitation_code)
@@ -221,6 +231,10 @@ async def update_invitation_endpoint(
 
         logger.info(f"Updated invitation code {invitation_code} by user {user_id}")
 
+        record_security_event("invitation_update", request=http_request,
+                              user_id=user_id, tenant_id=operator_tenant_id,
+                              details={"invitation_code": invitation_code,
+                                       "updates": updates})
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={
@@ -334,6 +348,7 @@ async def check_invitation_code_endpoint(invitation_code: str) -> JSONResponse:
 @router.delete("/{invitation_code}")
 async def delete_invitation_endpoint(
     invitation_code: str,
+    http_request: Request,
     authorization: Optional[str] = Header(None)
 ) -> JSONResponse:
     """
@@ -348,7 +363,7 @@ async def delete_invitation_endpoint(
     """
     try:
         # Get current user ID from token
-        user_id, _ = get_current_user_id(authorization)
+        user_id, operator_tenant_id = get_current_user_id(authorization)
 
         # Get invitation info to find invitation_id
         invitation_info = get_invitation_by_code(invitation_code)
@@ -368,6 +383,9 @@ async def delete_invitation_endpoint(
 
         logger.info(f"Deleted invitation code {invitation_code} by user {user_id}")
 
+        record_security_event("invitation_delete", request=http_request,
+                              user_id=user_id, tenant_id=operator_tenant_id,
+                              details={"invitation_code": invitation_code})
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={
@@ -438,6 +456,7 @@ async def check_invitation_available_endpoint(invitation_code: str) -> JSONRespo
 @router.post("/{invitation_code}/use")
 async def use_invitation_endpoint(
     invitation_code: str,
+    http_request: Request,
     authorization: Optional[str] = Header(None)
 ) -> JSONResponse:
     """
@@ -452,7 +471,7 @@ async def use_invitation_endpoint(
     """
     try:
         # Get current user ID from token
-        current_user_id, _ = get_current_user_id(autho
```

**File**: `backend/apps/northbound_app.py` (modified, +45/-1)
```diff
@@ -1,6 +1,6 @@
 import logging
 from http import HTTPStatus
-from typing import Optional, Dict, Any
+from typing import Any, Dict, List, Optional
 from urllib.parse import urlparse, unquote
 import re
 import uuid
@@ -38,6 +38,7 @@
     refresh_user_api_key,
     revoke_user_api_keys,
 )
+from services.audit_service import record_security_event
 from services.northbound_service import (
     NorthboundContext,
     get_conversation_history,
@@ -197,6 +198,40 @@ def _raise_api_key_http_exception(exc: Exception) -> None:
     raise exc
 
 
+def _audit_safe_target(result: Dict[str, Any], request_id: str) -> Dict[str, Any]:
+    """Pick non-secret target fields for the audit trail.
+
+    The service results carry the freshly created plaintext API key; only the
+    whitelisted identifiers below are handed to the audit entry.
+    """
+    return {
+        "target_user_id": (result or {}).get("user_id"),
+        "target_email": (result or {}).get("email"),
+        "revoked_count": (result or {}).get("revoked_count"),
+        "request_id": request_id,
+    }
+
+
+def _audit_safe_batch(
+    payload: ApiUserBatchCreateRequest,
+    created: List[Dict[str, Any]],
+    request_id: str,
+) -> Dict[str, Any]:
+    """Pick non-secret batch fields for the audit trail.
+
+    Each created item carries a plaintext API key, so only the request intent
+    and the created user ids (bounded) are recorded.
+    """
+    created = created or []
+    return {
+        "role": payload.role,
+        "group_id": payload.group_id,
+        "count": len(created),
+        "user_ids": [item.get("user_id") for item in created][:20],
+        "request_id": request_id,
+    }
+
+
 @router.post(
     "/api-users/batch",
     status_code=HTTPStatus.CREATED,
@@ -216,6 +251,9 @@ async def create_api_users_batch_endpoint(
             group_id=payload.group_id,
             count=payload.count,
         )
+        record_security_event("northbound_api_users_batch_create", request=request,
+                              user_id=ctx.user_id, tenant_id=ctx.tenant_id,
+                              details=_audit_safe_batch(payload, data, ctx.request_id))
         return JSONResponse(
             status_code=HTTPStatus.CREATED,
             content={"message": "success", "requestId": ctx.request_id, "data": data},
@@ -242,6 +280,9 @@ async def refresh_api_key_endpoint(
             user_id=payload.user_id,
             email=str(payload.email) if payload.email else None,
         )
+        record_security_event("northbound_api_key_refresh", request=request,
+                              user_id=ctx.user_id, tenant_id=ctx.tenant_id,
+                              details=_audit_safe_target(data, ctx.request_id))
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={"message": "success", "requestId": ctx.request_id, "data": data},
@@ -266,6 +307,9 @@ async def revoke_api_key_endpoint(
             user_id=target.user_id,
             email=str(target.email) if target.email else None,
         )
+        record_security_event("northbound_api_key_revoke", request=request,
+                              user_id=ctx.user_id, tenant_id=ctx.tenant_id,
+                              details=_audit_safe_target(data, ctx.request_id))
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={"message": "success", "requestId": ctx.request_id, "data": data},
```

**File**: `backend/apps/oauth_app.py` (modified, +14/-2)
```diff
@@ -40,6 +40,7 @@
     get_current_user_id,
     get_supabase_admin_client,
 )
+from services.audit_service import record_security_event
 
 logger = logging.getLogger(__name__)
 router = APIRouter(prefix="/user/oauth", tags=["oauth"])
@@ -100,6 +101,7 @@ async def link(provider: str, authorization: Optional[str] = Header(None)):
 
 @router.get("/callback")
 async def callback(
+    http_request: Request,
     provider: str,
     code: str = "",
     state: str = "",
@@ -215,6 +217,9 @@ async def callback(
         expiry_seconds = JWT_EXPIRY_SECONDS
         expires_at = calculate_expires_at(jwt_token)
 
+        record_security_event("oauth_login", request=http_request,
+                              user_id=supabase_user_id, user_email=email,
+                              details={"provider": provider, "linked": bool(link_user_id)})
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={
@@ -301,6 +306,10 @@ async def complete(
             password=request_data.password,
             invite_code=request_data.invite_code,
         )
+        completed_user = (result or {}).get("user") or {}
+        record_security_event("oauth_signup", request=request,
+                              user_id=completed_user.get("id"),
+                              user_email=completed_user.get("email"))
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={"message": "OAuth account completed", "data": result},
@@ -355,13 +364,16 @@ async def get_accounts(authorization: Optional[str] = Header(None)):
 
 
 @router.delete("/accounts/{provider}")
-async def delete_account(provider: str, authorization: Optional[str] = Header(None)):
+async def delete_account(provider: str, http_request: Request, authorization: Optional[str] = Header(None)):
     if not authorization:
         raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail="Not logged in")
 
     try:
-        user_id, _ = get_current_user_id(authorization)
+        user_id, tenant_id = get_current_user_id(authorization)
         unlink_account(user_id, provider)
+        record_security_event("oauth_unlink", request=http_request,
+                              user_id=user_id, tenant_id=tenant_id,
+                              details={"provider": provider})
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={
```

**File**: `backend/apps/tenant_app.py` (modified, +19/-4)
```diff
@@ -4,7 +4,7 @@
 import logging
 from typing import Optional
 
-from fastapi import APIRouter, HTTPException, Header, Body
+from fastapi import APIRouter, Body, Header, HTTPException, Request
 from http import HTTPStatus
 from starlette.responses import JSONResponse
 
@@ -21,6 +21,7 @@
     ValidationError,
     tenant_resource_limit_error_payload,
 )
+from services.audit_service import record_security_event
 from services.tenant_service import (
     create_tenant,
     get_tenant_info_for_user,
@@ -37,6 +38,7 @@
 @router.post("", response_model=None)
 async def create_tenant_endpoint(
     request: TenantCreateRequest,
+    http_request: Request,
     authorization: Optional[str] = Header(None)
 ) -> JSONResponse:
     """
@@ -51,7 +53,7 @@ async def create_tenant_endpoint(
     """
     try:
         # Get current user ID from token
-        user_id, _ = get_current_user_id(authorization)
+        user_id, operator_tenant_id = get_current_user_id(authorization)
 
         # Create tenant
         tenant_info = create_tenant(
@@ -64,6 +66,10 @@ async def create_tenant_endpoint(
 
         logger.info(f"Created tenant {tenant_info['tenant_id']} by user {user_id}")
 
+        record_security_event("tenant_create", request=http_request,
+                              user_id=user_id, tenant_id=operator_tenant_id,
+                              details={"tenant_id": (tenant_info or {}).get("tenant_id"),
+                                       "tenant_name": request.tenant_name})
         return JSONResponse(
             status_code=HTTPStatus.CREATED,
             content={
@@ -196,6 +202,7 @@ async def get_all_tenants_endpoint(
 async def update_tenant_endpoint(
     tenant_id: str,
     request: TenantUpdateRequest,
+    http_request: Request,
     authorization: Optional[str] = Header(None)
 ) -> JSONResponse:
     """
@@ -211,7 +218,7 @@ async def update_tenant_endpoint(
     """
     try:
         # Get current user ID from token
-        user_id, _ = get_current_user_id(authorization)
+        user_id, operator_tenant_id = get_current_user_id(authorization)
 
         # Update tenant
         updated_tenant = update_tenant_info(
@@ -222,6 +229,10 @@ async def update_tenant_endpoint(
 
         logger.info(f"Updated tenant {tenant_id} by user {user_id}")
 
+        record_security_event("tenant_update", request=http_request,
+                              user_id=user_id, tenant_id=operator_tenant_id,
+                              details={"tenant_id": tenant_id,
+                                       "tenant_name": request.tenant_name})
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={
@@ -259,6 +270,7 @@ async def update_tenant_endpoint(
 @router.delete("/{tenant_id}")
 async def delete_tenant_endpoint(
     tenant_id: str,
+    http_request: Request,
     authorization: Optional[str] = Header(None)
 ) -> JSONResponse:
     """
@@ -283,13 +295,16 @@ async def delete_tenant_endpoint(
     """
     try:
         # Get current user ID from token
-        user_id, _ = get_current_user_id(authorization)
+        user_id, operator_tenant_id = get_current_user_id(authorization)
 
         # Perform tenant deletion with all associated resources
         await delete_tenant(tenant_id, deleted_by=user_id)
 
         logger.info(f"Deleted tenant {tenant_id} and all associated resources by user {user_id}")
 
+        record_security_event("tenant_delete", request=http_request,
+                              user_id=user_id, tenant_id=operator_tenant_id,
+                              details={"tenant_id": tenant_id})
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={
```

**File**: `backend/apps/user_app.py` (modified, +14/-2)
```diff
@@ -4,7 +4,7 @@
 import logging
 from typing import Optional
 
-from fastapi import APIRouter, HTTPException, Header
+from fastapi import APIRouter, Header, HTTPException, Request
 from http import HTTPStatus
 from starlette.responses import JSONResponse
 
@@ -18,6 +18,7 @@
     UnauthorizedError,
     tenant_resource_limit_error_payload,
 )
+from services.audit_service import record_security_event
 from services.user_service import (
     delete_user_and_cleanup, get_users_for_requester, update_user_for_requester
 )
@@ -99,6 +100,7 @@ async def get_users_endpoint(
 async def update_user_endpoint(
     user_id: str,
     request: UserUpdateRequest,
+    http_request: Request,
     authorization: Optional[str] = Header(None)
 ) -> JSONResponse:
     """
@@ -127,6 +129,11 @@ async def update_user_endpoint(
 
         logger.info(f"Updated user {user_id} by user {current_user_id}")
 
+        record_security_event("user_update", request=http_request,
+                              user_id=current_user_id, tenant_id=requester_tenant_id,
+                              details={"target_user_id": user_id,
+                                       "changes": {key: value for key, value in request.model_dump().items()
+                                                   if value is not None}})
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={
@@ -165,6 +172,7 @@ async def update_user_endpoint(
 @router.delete("/{user_id}")
 async def delete_user_endpoint(
     user_id: str,
+    http_request: Request,
     authorization: Optional[str] = Header(None)
 ) -> JSONResponse:
     """
@@ -185,7 +193,7 @@ async def delete_user_endpoint(
     """
     try:
         # Get current user ID from token for access control
-        current_user_id, _ = get_current_user_id(authorization)
+        current_user_id, operator_tenant_id = get_current_user_id(authorization)
 
         # Get user tenant ID for cleanup operations
         user_tenant = get_user_tenant_by_user_id(user_id)
@@ -199,6 +207,10 @@ async def delete_user_endpoint(
 
         logger.info(f"Permanently deleted user {user_id} by admin {current_user_id}")
 
+        record_security_event("user_delete", request=http_request,
+                              user_id=current_user_id, tenant_id=operator_tenant_id,
+                              details={"target_user_id": user_id,
+                                       "target_tenant_id": tenant_id})
         return JSONResponse(
             status_code=HTTPStatus.OK,
             content={
```

#### Recent Merged Pull Requests:
- **PR #4049** (2026-09-30): docs: update third-party notices (#4048) (@WMC001)
- **PR #4048** (2026-09-30): docs: update third-party notices (@WMC001)
- **PR #4047** (2026-09-30): Release v2.7.0 merge (@jeffwu-1999)
- **PR #4045** (2026-09-30): Fix/default model backfill select best (@lijiayang619)
- **PR #4044** (2026-09-30): merge(main): merge v2.7.0 release from develop (@jeffwu-1999)
- **PR #4043** (2026-09-29): fix: let tenant admins manage models of their own tenant (@jeffwu-1999)
- **PR #4042** (2026-09-30): 🐛 Fix(evaluation): surface run delete errors and hide the delete button for unauthorized users (@cj2026-bit)
- **PR #4041** (2026-09-29): fix(frontend): handle agent name overflow and card tag layout (@xuyaqist)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
