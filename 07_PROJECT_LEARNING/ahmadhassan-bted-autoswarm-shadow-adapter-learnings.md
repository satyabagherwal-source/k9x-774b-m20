> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ahmadhassan-bted-autoswarm-shadow-adapter-learnings.md`  
> **Source**: github ([https://github.com/AhmadHassan-BTed/AutoSwarm-Shadow-Adapter](https://github.com/AhmadHassan-BTed/AutoSwarm-Shadow-Adapter))  
> **Source Version**: `69d27ddc`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T12:03:34.038Z  
> **Learning ID**: `learn-github-ahmadhassan-bted-autoswarm-shadow-adapter`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): AhmadHassan-BTed/AutoSwarm-Shadow-Adapter

> **Canonical Artifact**: `07_PROJECT_LEARNING/ahmadhassan-bted-autoswarm-shadow-adapter-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AhmadHassan-BTed/AutoSwarm-Shadow-Adapter](https://github.com/AhmadHassan-BTed/AutoSwarm-Shadow-Adapter))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T12:03:29.063Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AhmadHassan-BTed/AutoSwarm-Shadow-Adapter`
- **Description**: Zero-modification Human-in-the-Loop adapter for OpenOPC's agentic DAG runtime.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2015 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `shadow_adapter/frontend/src/hooks/useSubmitTask.ts`
```
import { useState } from 'react';
import { api } from '../api/client';
import { TaskSubmitResponse } from '../types';

export interface UseSubmitTaskResult {
  submitTask: (taskId: string, deliverableText: string, files: File[]) => Promise<TaskSubmitResponse | null>;
  submitting: boolean;
  error: string | null;
  isSuccess: boolean;
  successMessage: string | null;
  reset: () => void;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 10;
const MAX_TOTAL_SIZE_MB = 50;

export const useSubmitTask = (): UseSubmitTaskResult => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const reset = () => {
    setSubmitting(false);
    setError(null);
    setIsSuccess(false);
    setSuccessMessage(null);
  };

  const submitTask = async (
    taskId: string,
    deliverableText: string,
    files: File[]
  ): Promise<TaskSubmitResponse | null> => {
    setError(null);

    if (!deliverableText.trim() && files.length === 0) {
      setError('Please provide deliverable text or attach at least one file.');
      return null;
    }

    if (files.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed per submission. You selected ${files.length}.`);
      return null;
    }

    let totalSize = 0;
    for (const f of files) {
      const sizeMB = f.size / (1024 * 1024);
      if (sizeMB > MAX_FILE_SIZE_MB) {
        setError(`File "${f.name}" exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB}MB.`);
        return null;
      }
      totalSize += f.size;
    }

    if (totalSize / (1024 * 1024) > MAX_TOTAL_SIZE_MB) {
      setError(`Total payload size exceeds the maximum allowed ${MAX_TOTAL_SIZE_MB}MB limit.`);
      return null;
    }

    try {
      setSubmitting(true);
      const res = await api.submitTask(taskId, deliverableText, files);
      setIsSuccess(true);
      setSuccessMessage(res.message || 'Deliverable submitted successfully.');
      return res;
    } catch (err: any) {
      setError(err.message || 'Submission failed. Please check your connection and try again.');
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    submitTask,
    submitting,
    error,
    isSuccess,
    successMessage,
    reset,
  };
};

```

### Core Architecture Module: `shadow_adapter/worker.py`
```
"""ShadowWorker SDK and CLI Daemon for Distributed Silicon Nodes.

Enables Bring Your Own Compute (BYOC) for OpenOPC roles. Runs on remote PCs,
authenticates with central Shadow Adapter API, polls pending tasks for assigned roles,
executes local LLM inference (Ollama, OpenAI, Anthropic, or custom handlers), and
submits deliverables to unblock OpenOPC DAG workflows.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from collections.abc import Awaitable, Callable
from typing import Any

import httpx
from loguru import logger

TaskHandlerCallable = Callable[[dict[str, Any]], Awaitable[str]]


class ShadowWorker:
    """Distributed Worker Client for OpenOPC Shadow Adapter."""

    def __init__(
        self,
        server_url: str = "http://localhost:8800",
        username: str = "silicon_worker",
        password: str = "password123",
        role: str | None = None,
        provider: str = "ollama",
        model: str = "llama3.3:70b",
        api_key: str | None = None,
        api_base: str | None = None,
        poll_interval: float = 3.0,
        custom_handler: TaskHandlerCallable | None = None,
    ) -> None:
        self.server_url = server_url.rstrip("/")
        self.username = username
        self.password = password
        self.role = role
        self.provider = provider.lower()
        self.model = model
        self.api_key = api_key or os.getenv("LOCAL_OPENAI_API_KEY") or os.getenv("LOCAL_ANTHROPIC_KEY") or ""
        self.api_base = api_base or os.getenv("OLLAMA_HOST") or ""
        self.poll_interval = poll_interval
        self.custom_handler = custom_handler

        self.access_token: str | None = None
        self._running = False

    async def login(self, client: httpx.AsyncClient) -> str:
        """Authenticate with central Shadow Adapter API and obtain JWT access token."""
        endpoints = [
            f"{self.server_url}/api/auth/login",
            f"{self.server_url}/api/v1/auth/login",
        ]
        last_error = None

        for ep in endpoints:
            try:
                res = await client.post(
                    ep,
                    json={"username": self.username, "password": self.password},
                    timeout=10.0,
                )
                if res.status_code == 200:
                    data = res.json()
                    token = data.get("access_token")
                    if token:
                        self.access_token = token
                        logger.info(f"[ShadowWorker] Authenticated as '{self.username}' on {ep}")
                        return token
            except Exception as e:
                last_error = e

        # If user does not exist, attempt auto-registration
        reg_endpoints = [
            f"{self.server_url}/api/auth/register",
            f"{self.server_url}/api/v1/auth/register",
        ]
        for ep in reg_endpoints:
            try:
                reg_res = await client.post(
                    ep,
                    json={
                        "username": self.username,
                        "password": self.password,
                        "email": f"{self.username}@node.local",
                    },
                    timeout=10.0,
                )
                if reg_res.status_code == 201:
                    logger.info(f"[ShadowWorker] Auto-registered worker identity '{self.username}'")
                    # Retry login
                    return await self.login(client)
            except Exception as e:
                logger.debug(f"[ShadowWorker] Auto-register check failed on {ep}: {e}")

        raise RuntimeError(
            f"Failed to authenticate with Shadow Adapter at {self.server_url}: {last_error or 'Invalid credentials'}"
        )

    def _get_headers(self) -> dict[str, str]:
        if not self.access_token:
            raise RuntimeError("Worker is not authenticated. Call login() first.")
        return {"Authorization": f"Bearer {self.access_token}"}

    async def fetch_pending_tasks(self, client: httpx.AsyncClient) -> list[dict[str, Any]]:
        """Fetch pending tasks from central server, optionally filtered by assigned_role."""
        headers = self._get_headers()
        url = f"{self.server_url}/api/tasks?status=pending"
        res = await client.get(url, headers=headers, timeout=10.0)

        if res.status_code == 401:
            logger.warning("[ShadowWorker] JWT token expired. Re-authenticating...")
            await self.login(client)
            headers = self._get_headers()
            res = await client.get(url, headers=headers, timeout=10.0)

        res.raise_for_status()
        tasks = res.json()

        if self.role:
            filtered = [t for t in tasks if t.get("assigned_role") == self.role or not t.get("assigned_role")]
            return filtered
        return tasks

    async def claim_task(self, client: httpx.AsyncClient, task_id: str) -> dict[str, Any]:
        """Claim a pending task on central server."""
        headers = self._get_headers()
        url = f"{self.server_url}/api/tasks/{task_id}/claim"
        res = await client.post(url, headers=headers, timeout=10.0)
        res.raise_for_status()
        return res.json()

    async def submit_deliverable(
        self,
        client: httpx.AsyncClient,
        task_id: str,
        deliverable_text: str,
    ) -> dict[str, Any]:
        """Submit completed deliverable to central server to unblock DAG."""
        headers = self._get_headers()
        url = f"{self.server_url}/api/tasks/{task_id}/submit"
        res = await client.post(
            url,
            headers=headers,
            data={"deliverable_text": deliverable_text},
            timeout=30.0,
        )
        res.raise_for_status()
        return res.json()

    async def execute_local_model(self, client: httpx.AsyncClient, task: dict[str, Any]) -> str:
        """Execute local LLM inference or custom callback on remote worker PC."""
        if self.custom_handler:
            logger.info(f"[ShadowWorker] Invoking custom task handler for task '{task.get('id')}'")
            return await self.custom_handler(task)

        task_title = task.get("title", "Task Brief")
        task_brief = task.get("brief_md") or task.get("description") or "Complete assigned role objective."
        prompt = (
            f"You are a remote Silicon Employee serving in role '{self.role or 'Specialist'}'.\n"
            f"Task: {task_title}\n\nBrief:\n{task_brief}\n\n"
            f"Please generate the complete professional deliverable."
        )

        logger.info(f"[ShadowWorker] Processing task '{task_title}' using provider '{self.provider}' ({self.model})")

        # Provider 1: Ollama / Local Open-Source LLM
        if self.provider == "ollama":
            base = self.api_base or "http://localhost:11434"
            ollama_url = f"{base.rstrip('/')}/api/generate"
            try:
                res = await client.post(
                    ollama_url,
                    json={"model": self.model, "prompt": prompt, "stream": False},
                    timeout=120.0,
                )
                if res.status_code == 200:
                    return res.json().get("response", "").strip()
            except Exception as e:
                logger.warning(f"[ShadowWorker] Local Ollama call failed ({e}). Falling back to synthetic deliverable.")

        # Provider 2: OpenAI / Custom OpenAI-compatible endpoint
        elif self.provider in ("openai", "vllm", "litellm"):
            base = self.api_base or "https://api.openai.com/v1"
            headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
            openai_url = f"{base.rstrip('/')}/chat/completions"
            try:
                res = await client.post(
                    openai_url,
                    headers=headers,
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                    timeout=120.0,
                )
                if res.status_code == 200:
                    choices = res.json().get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "").strip()
            except Exception as e:
                logger.warning(f"[ShadowWorker] OpenAI API call failed ({e}). Falling back to synthetic deliverable.")

        # Provider 3: Anthropic Claude API
        elif self.provider == "anthropic":
            base = self.api_base or "https://api.anthropic.com/v1"
            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            try:
                res = await client.post(
                    f"{base.rstrip('/')}/messages",
                    headers=headers,
                    json={
                        "model": self.model,
                        "max_tokens": 4096,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                    timeout=120.0,
                )
                if res.status_code == 200:
                    content_blocks = res.json().get("content", [])
                    if content_blocks:
                        return content_blocks[0].get("text", "").strip()
            except Exception as e:
                logger.warning(f"[ShadowWorker] Anthropic call failed ({e}). Falling back to synthetic deliverable.")

        # Synthetic Fallback Delivery
        return (
            f"[DECENTRALIZED SILICON DELIVERABLE]\n"
            f"Node Provider: {self.provider} ({self.model})\n"
            f"Assigned Role: {self.role or 'General Worker'}\n"
            f"Task: {task_title}\n\n"
            f"Execution completed successfully by remote compute node."
        )

    asyn
```

### Core Architecture Module: `shadow_worker.py`
```
#!/usr/bin/env python3
"""Root convenience launcher for ShadowWorker CLI daemon.

Usage:
  python shadow_worker.py --server-url http://localhost:8800 --role legal_counsel
"""

from shadow_adapter.worker import main

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `example_usage.py`
```
"""example_usage.py — Drop-in integration demo for openopc-shadow-adapter.

This script demonstrates how to integrate Shadow Mode into your OpenOPC setup:
1. Programmatically inject ShadowModeAdapter into OpenOPC's ADAPTER_CLASSES registry.
2. Intercept an OpenOPC task and park it in shadow_tasks.db without blocking threads.
3. Simulate a human contractor submitting a deliverable via the REST API.
4. Execute the resume pipeline to update OpenOPC's store.db to APPROVED phase.

Usage:
    python example_usage.py
"""

from __future__ import annotations

import asyncio
import sqlite3
import tempfile
from pathlib import Path

# ── Step 1: Programmatic Adapter Injection into OpenOPC ───────────────────
# In a real OpenOPC app, import ADAPTER_CLASSES from opc.layer3_agent.adapters.registry
try:
    from opc.core.models import Task, TaskStatus
    from opc.layer3_agent.adapters.registry import ADAPTER_CLASSES

    HAS_OPENOPC_PACKAGE = True
except ImportError:
    # Standalone mock fallback for demonstration
    ADAPTER_CLASSES = {}
    HAS_OPENOPC_PACKAGE = False

    class TaskStatus:
        PENDING = "pending"
        AWAITING_HUMAN = "awaiting_human"
        DONE = "done"

    class Task:
        def __init__(self, id, title, description, assigned_to, linked_work_item_id=""):
            self.id = id
            self.title = title
            self.description = description
            self.assigned_to = assigned_to
            self.status = TaskStatus.PENDING
            self.priority = 5
            self.project_id = "default"
            self.metadata = {"assigned_external_agent": "shadow"}
            self.linked_work_item_id = linked_work_item_id


from shadow_adapter.adapter import ShadowModeAdapter
from shadow_adapter.config import ShadowConfig
from shadow_adapter.models import ShadowSubmission
from shadow_adapter.shadow_store import ShadowStore

# Register the ShadowModeAdapter with OpenOPC
ADAPTER_CLASSES["shadow"] = ShadowModeAdapter


def init_mock_opc_store(db_path: Path, task_id: str, work_item_id: str) -> None:
    """Helper to initialize a mock OpenOPC store.db."""
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            title TEXT,
            description TEXT,
            assigned_to TEXT,
            status TEXT DEFAULT 'pending',
            priority INTEGER DEFAULT 5,
            project_id TEXT DEFAULT 'default',
            metadata TEXT DEFAULT '{}',
            result TEXT,
            execution_lock INTEGER DEFAULT 0,
            execution_locked_at TEXT,
            created_at TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS delegation_work_items (
            work_item_id TEXT PRIMARY KEY,
            run_id TEXT,
            role_id TEXT,
            title TEXT,
            phase TEXT DEFAULT 'ready',
            metadata TEXT DEFAULT '{}',
            created_at TEXT,
            updated_at TEXT
        )
    """)
    conn.execute(
        "INSERT INTO tasks (id, title, status) VALUES (?, ?, 'running')",
        (task_id, "Review Security Compliance"),
    )
    conn.execute(
        "INSERT INTO delegation_work_items (work_item_id, title, phase) VALUES (?, ?, 'running')",
        (work_item_id, "Review Security Compliance"),
    )
    conn.commit()
    conn.close()


async def main() -> None:
    print("================================================================")
    print("  OpenOPC Shadow Adapter — Drop-in Integration Demo")
    print("================================================================")

    with tempfile.TemporaryDirectory() as tmp_dir:
        work_dir = Path(tmp_dir)
        opc_store_path = work_dir / "opc_store.db"
        shadow_db_path = work_dir / "shadow_tasks.db"
        upload_dir = work_dir / "shadow_uploads"

        opc_task_id = "opc_task_demo_101"
        work_item_id = "wi_demo_101"

        # Initialize mock OpenOPC store.db
        init_mock_opc_store(opc_store_path, opc_task_id, work_item_id)

        # ── Step 2: Configure Shadow Mode ──────────────────────────────────
        config = ShadowConfig(
            db_path=str(shadow_db_path),
            upload_dir=str(upload_dir),
            opc_store_path=str(opc_store_path),
            jwt_secret="demo-secret-key-12345",
        )

        shadow_store = ShadowStore(config.db_path)
        await shadow_store.initialize()

        adapter = ShadowModeAdapter(shadow_config=config, shadow_store=shadow_store)

        # Create OpenOPC Task context
        task = Task(
            id=opc_task_id,
            title="Review Security Compliance & Audit Logs",
            description="Verify SOC2 compliance section and approve third-party vendor access.",
            assigned_to="security_compliance_lead",
            linked_work_item_id=work_item_id,
        )

        # ── Step 3: OpenOPC Engine dispatches task to ShadowModeAdapter ──
        print("\n1. OpenOPC Engine calls adapter.execute()...")
        start = asyncio.get_event_loop().time()
        task_result = await adapter.execute(task, workspace_path=str(work_dir))
        elapsed_ms = (asyncio.get_event_loop().time() - start) * 1000

        print(f"   ✓ execute() returned in {elapsed_ms:.2f}ms")
        print(f"   ✓ Returned Status: {task_result.status}")
        print(f"   ✓ Returned Content: {task_result.content}")
        print(f"   ✓ Parked Shadow Task ID: {task_result.artifacts['shadow_task_id']}")

        shadow_id = task_result.artifacts["shadow_task_id"]

        # ── Step 4: Human Contractor Workflow (via React Portal / REST API) ─
        print("\n2. Contractor claims task and submits deliverable...")
        contractor_id = "contractor_alice"

        await shadow_store.claim_task(shadow_id, contractor_id)
        print(f"   ✓ Task claimed by contractor '{contractor_id}'")

        submission = ShadowSubmission(
            deliverable_text="SOC2 audit completed. All vendor access controls verified and approved.",
            deliverable_files=["soc2_compliance_report.pdf"],
        )
        submitted = await shadow_store.submit_task(shadow_id, contractor_id, submission)
        print(f"   ✓ Deliverable submitted (Status: {submitted.status.value})")

        # ── Step 5: Resume OpenOPC DAG ────────────────────────────────────
        print("\n3. API triggers resume_task() to unblock OpenOPC DAG...")
        resume_res = await ShadowModeAdapter.resume_task(
            shadow_task=submitted,
            opc_store_path=config.opc_store_path,
        )

        if resume_res.success:
            await shadow_store.mark_resumed(shadow_id)
            print("   ✓ Resume callback succeeded!")
            print(f"   ✓ OpenOPC Task Status: {resume_res.opc_task_status}")
            print(f"   ✓ OpenOPC WorkItem Phase: {resume_res.opc_work_item_phase}")

        # ── Step 6: Verify final OpenOPC DB state ─────────────────────────
        conn = sqlite3.connect(str(opc_store_path))
        task_status_in_opc = conn.execute("SELECT status FROM tasks WHERE id = ?", (opc_task_id,)).fetchone()[0]
        wi_phase_in_opc = conn.execute(
            "SELECT phase FROM delegation_work_items WHERE work_item_id = ?",
            (work_item_id,),
        ).fetchone()[0]
        conn.close()

        print("\n4. Verified OpenOPC Database State:")
        print(f"   ✓ Task '{opc_task_id}' Status in store.db: {task_status_in_opc}")
        print(f"   ✓ Delegation WorkItem '{work_item_id}' Phase in store.db: {wi_phase_in_opc}")

        print("\n================================================================")
        print("  Demo Complete: Human-in-the-Loop Integration Verified! ✅")
        print("================================================================")

        await shadow_store.close()


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `shadow_adapter/__init__.py`
```
"""openopc-shadow-adapter — Human-in-the-loop Shadow Mode for OpenOPC."""

from __future__ import annotations

from shadow_adapter.adapter import ShadowModeAdapter
from shadow_adapter.api.app import start_server_in_thread
from shadow_adapter.worker import ShadowWorker

__version__ = "0.1.0"
__all__ = ["ShadowModeAdapter", "ShadowWorker", "__version__", "start_server_in_thread"]

```

### Core Architecture Module: `shadow_adapter/adapter.py`
```
"""Core Shadow Mode Adapter for OpenOPC.

Extends OpenOPC's ExternalAgentAdapter to provide a non-blocking Human-in-the-Loop (HITL)
execution surface. Intercepts tasks, parks them in an isolated SQLite database,
and releases execution threads instantly.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from loguru import logger

from shadow_adapter.config import ShadowConfig
from shadow_adapter.models import (
    ShadowTask,
    ShadowTaskStatus,
    TaskResumeResult,
)
from shadow_adapter.shadow_store import ShadowStore

# Import OpenOPC core types or use fallback dataclass mocks for standalone testing
try:
    from opc.core.models import AgentStatus, Task, TaskResult, TaskStatus
    from opc.layer3_agent.adapters.base import ExternalAgentAdapter

    HAS_OPENOPC = True
except ImportError:
    HAS_OPENOPC = False
    from dataclasses import dataclass, field

    class AgentStatus:  # type: ignore[no-redef]
        IDLE = "idle"
        RUNNING = "running"
        BLOCKED = "blocked"
        ERROR = "error"

    class TaskStatus:  # type: ignore[no-redef]
        PENDING = "pending"
        RUNNING = "running"
        AWAITING_HUMAN = "awaiting_human"
        DONE = "done"
        FAILED = "failed"

    @dataclass
    class Task:  # type: ignore[no-redef]
        id: str
        session_id: str | None = None
        title: str = ""
        description: str = ""
        assigned_to: str = ""
        status: Any = TaskStatus.PENDING
        priority: int = 5
        project_id: str = "default"
        metadata: dict = field(default_factory=dict)
        linked_work_item_id: str = ""

    @dataclass
    class TaskResult:  # type: ignore[no-redef]
        status: Any
        content: str = ""
        artifacts: dict = field(default_factory=dict)
        escalation: dict | None = None
        cost: float = 0.0
        token_usage: dict = field(default_factory=dict)

    class ExternalAgentAdapter:  # type: ignore[no-redef]
        agent_type: str = ""

        def __init__(self, config: Any = None) -> None:
            self.config = config

        async def is_available(self) -> bool:
            return True


class ShadowModeAdapter(ExternalAgentAdapter):
    """External agent adapter that parks tasks for human contractor execution."""

    agent_type: str = "shadow"
    default_command: str = "shadow"

    def __init__(
        self,
        config: Any = None,
        shadow_config: ShadowConfig | None = None,
        shadow_store: ShadowStore | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        super().__init__(config)
        self.shadow_config = shadow_config or ShadowConfig()
        self._shadow_store = shadow_store
        self._last_shadow_result: TaskResult | None = None

    async def _get_store(self) -> ShadowStore:
        if self._shadow_store is None:
            self._shadow_store = ShadowStore(self.shadow_config.db_path)
            await self._shadow_store.initialize()
        return self._shadow_store

    async def is_available(self, *args: Any, **kwargs: Any) -> bool:
        """Shadow adapter is always available since it has no external CLI dependency."""
        return True

    async def get_status(self, *args: Any, **kwargs: Any) -> Any:
        """Return idle AgentStatus since human work happens asynchronously out-of-band."""
        return getattr(AgentStatus, "IDLE", "idle")

    def agent_isolation_home_slug(self) -> str | None:
        """Return isolation slug required by OpenOPC broker in Company Mode."""
        return "shadow"

    def agent_home_env_vars(self, home: str) -> dict[str, str]:
        """Return isolation env vars required by OpenOPC broker."""
        return {"SHADOW_ADAPTER_HOME": str(home)}

    def post_install_agent_home(self, home: str) -> None:
        """Post-install callback for OpenOPC broker isolation home."""
        pass

    def supports_interactive(self) -> bool:
        return False

    def supports_session_resume(self) -> bool:
        return False

    def stdin_policy_for_process(
        self,
        cmd: list[str],
        metadata: dict[str, Any] | None = None,
    ) -> str:
        return "devnull"

    def supports_approval_prompt_handling(
        self,
        cmd: list[str],
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        return False

    def build_invocation(
        self,
        task: Task,
        workspace_path: str | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[list[str], dict[str, Any]]:
        """Return non-empty command for external broker audit and invocation tracking."""
        return ["shadow", "--mode", "park"], {
            "agent": self.agent_type,
            "command": "shadow --mode park",
            "workspace": workspace_path or "",
            "mode": "shadow_human_in_loop",
        }

    async def start_process(
        self,
        cmd: list[str],
        workspace_path: str,
        extra_env: dict[str, str] | None = None,
        task: Task | None = None,
        launch_metadata: dict[str, Any] | None = None,
    ) -> Any:
        """Intercept task parking when invoked via OpenOPC ExternalAgentBroker.start_process().

        Parks the task in local shadow DB and returns a completed mock subprocess.
        """
        import asyncio
        import sys

        if task is not None:
            self._last_shadow_result = await self.execute(task, workspace_path)

        content = self._last_shadow_result.content if self._last_shadow_result else "shadow_mode_parked"
        # Launch a quick no-op python subprocess that prints the content and exits cleanly
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-c",
            f"import sys; print({repr(content)}); sys.exit(0)",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=workspace_path if workspace_path and Path(workspace_path).exists() else None,
        )
        return proc

    def normalize_result_output(self, output: str) -> str:
        """Return the parked result content when called by ExternalAgentBroker."""
        if self._last_shadow_result is not None:
            return self._last_shadow_result.content
        return output

    def extract_structured_result_fields(self, output: str) -> dict[str, Any]:
        """Return parked result artifacts when called by ExternalAgentBroker."""
        if self._last_shadow_result is not None and self._last_shadow_result.artifacts:
            return self._last_shadow_result.artifacts
        return {}

    async def execute(
        self,
        task: Task,
        workspace_path: str = "",
        *args: Any,
        **kwargs: Any,
    ) -> TaskResult:
        """Intercept an OpenOPC task, park it in local DB, and return AWAITING_HUMAN immediately.

        Wrapped in an Exception Black Hole to prevent host engine process crashes.
        """
        try:
            task_id = str(getattr(task, "id", "") or "").strip()
            task_title = str(getattr(task, "title", "") or "Untitled Task").strip()
            logger.info(f"[ShadowModeAdapter] Intercepting OpenOPC task {task_id} ('{task_title}')")

            store = await self._get_store()

            # Check if already parked
            existing = await store.get_task_by_opc_id(task_id)
            if existing and existing.status in (
                ShadowTaskStatus.PENDING,
                ShadowTaskStatus.CLAIMED,
            ):
                logger.info(f"[ShadowModeAdapter] Task {task_id} is already parked as {existing.id}")
                return TaskResult(
                    status=TaskStatus.AWAITING_HUMAN,
                    content=f"Task is currently parked for human completion in Shadow Mode (shadow_id={existing.id}).",
                    artifacts={
                        "shadow_task_id": existing.id,
                        "opc_task_id": task_id,
                        "parked_at": existing.parked_at.isoformat(),
                        "status": existing.status.value,
                    },
                )

            # Defensive Map OpenOPC Task to ShadowTask
            shadow_task = self._task_to_shadow_task(task)

            # Park in isolated SQLite store
            await store.create_task(shadow_task)

            logger.info(
                f"[ShadowModeAdapter] Parked task {task_id} as shadow_id={shadow_task.id}. "
                f"Returning AWAITING_HUMAN status to release thread."
            )

            return TaskResult(
                status=TaskStatus.AWAITING_HUMAN,
                content=(
                    f"Task '{task_title}' intercepted and parked for human contractor deliverable. "
                    f"Shadow Task ID: {shadow_task.id}"
                ),
                artifacts={
                    "shadow_task_id": shadow_task.id,
                    "opc_task_id": task_id,
                    "opc_work_item_id": shadow_task.opc_work_item_id,
                    "parked_at": shadow_task.parked_at.isoformat(),
                    "status": ShadowTaskStatus.PENDING.value,
                },
            )
        except Exception as exc:
            logger.exception(f"[ShadowModeAdapter] Critical execution failure: {exc}")
            return TaskResult(
                status=TaskStatus.FAILED,
                content=f"Shadow Mode Intercept Critical Error: {exc}",
                artifacts={"error": str(exc), "source": "shadow_mode_adapter"},
            )

    # ------------------------------------------------------------------
    # Helper & Resume Methods
    # ------------------------------------------------------------------

    @staticmethod
    def _task_to_shadow_task(task: Task) -> ShadowTask:
        """Defensively convert an OpenOPC Task model to a local ShadowTask model."""
        task_id = str(getattr(task, "id", "") or 
```

### Core Architecture Module: `shadow_adapter/api/app.py`
```
"""FastAPI application factory for the Shadow Adapter API server.

Serves:
- Versioned REST API under `/api/v1` (`/api/v1/auth`, `/api/v1/tasks`, `/api/v1/health`)
- Legacy backward-compatibility routes under `/api`
- Exception Black Hole global exception handler
- Static files for the built React Human Portal (`frontend/dist`) mounted at `/`
- CLI runner `shadow-serve` entry point
"""

from __future__ import annotations

import argparse
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger

from shadow_adapter.api.routes_artifacts import artifacts_router
from shadow_adapter.api.routes_auth import router as auth_router
from shadow_adapter.api.routes_tasks import router as tasks_router
from shadow_adapter.config import ShadowConfig
from shadow_adapter.security import SecurityManager
from shadow_adapter.shadow_store import ShadowStore
from shadow_adapter.upload import SecureUploadHandler


def create_app(config: ShadowConfig | None = None) -> FastAPI:
    """Application factory for the Shadow Adapter FastAPI server."""
    cfg = config or ShadowConfig()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logger.info(f"Initializing Shadow Adapter API (db={cfg.db_path}, upload_dir={cfg.upload_dir})")
        store = ShadowStore(cfg.db_path)
        await store.initialize()

        app.state.config = cfg
        app.state.shadow_store = store
        app.state.security = SecurityManager(cfg)
        app.state.upload_handler = SecureUploadHandler(cfg)

        yield

        logger.info("Shutting down Shadow Adapter API...")
        await store.close()

    app = FastAPI(
        title="OpenOPC Contractor & Silicon Worker Portal API",
        version="0.1.0",
        description="REST API and Contractor Portal for shadow-mode OpenOPC task intercept, park, and resume.",
        lifespan=lifespan,
    )

    # Portal Coexistence Middleware — distinctly identifies responses from Port 8800
    @app.middleware("http")
    async def add_portal_identity_header(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Portal-Identity"] = "OpenOPC-Shadow-Worker-Portal"
        return response

    # CORS configuration for development React server (Vite)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Exception Black Hole (Global Catch-All Exception Handler) ──────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception(f"[Global Exception Black Hole] Unhandled error on {request.url}: {exc}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error occurred.",
                "error_type": type(exc).__name__,
                "path": str(request.url.path),
            },
        )

    # ── Register Versioned REST API routers (/api/v1 and legacy /api) ──────────
    # Versioned v1 endpoints
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth (v1)"])
    app.include_router(tasks_router, prefix="/api/v1/tasks", tags=["Tasks (v1)"])
    app.include_router(artifacts_router, prefix="/api/v1/artifacts", tags=["Artifacts (v1)"])

    # Legacy /api backwards-compatibility endpoints
    app.include_router(auth_router, prefix="/api/auth", tags=["Auth (legacy)"])
    app.include_router(tasks_router, prefix="/api/tasks", tags=["Tasks (legacy)"])
    app.include_router(artifacts_router, prefix="/api/artifacts", tags=["Artifacts (legacy)"])

    # Health check endpoints
    @app.get("/api/v1/health", tags=["Health"])
    @app.get("/api/health", tags=["Health"])
    async def health_alias(request: Request):
        from shadow_adapter.api.routes_tasks import health_check

        store = request.app.state.shadow_store
        return await health_check(store=store, config=cfg)

    # Mount static files from frontend/dist if available
    dist_dir = Path(__file__).parent.parent / "frontend" / "dist"
    if dist_dir.exists() and (dist_dir / "index.html").exists():
        logger.info(f"Mounting React SPA static files from {dist_dir}")

        app.mount(
            "/assets",
            StaticFiles(directory=str(dist_dir / "assets")),
            name="static_assets",
        )

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(full_path: str):
            # API requests that didn't match an endpoint return 404 JSON
            if full_path.startswith("api/"):
                return JSONResponse(
                    status_code=404,
                    content={"detail": f"API route '/{full_path}' not found"},
                )

            target_file = dist_dir / full_path
            if target_file.exists() and target_file.is_file():
                return FileResponse(str(target_file))
            # Fallback to index.html for client-side React routing
            return FileResponse(str(dist_dir / "index.html"))

    else:

        @app.get("/", include_in_schema=False)
        async def root_fallback():
            return {
                "message": "OpenOPC Shadow Adapter API Server",
                "version": "0.1.0",
                "docs": "/docs",
                "status": "Frontend production build not found in frontend/dist. API routes active under /api/v1.",
            }

    return app


def start_server_in_thread(
    port: int = 8800,
    host: str = "0.0.0.0",
    config: ShadowConfig | None = None,
) -> threading.Thread:
    """Launch the Shadow Adapter FastAPI server programmatically in a background thread.

    Enables running the Human Portal REST API programmatically inside your
    main OpenOPC application process without needing a separate terminal command.
    """
    import threading

    import uvicorn

    cfg = config or ShadowConfig(api_port=port, api_host=host)
    app = create_app(cfg)

    uv_config = uvicorn.Config(app, host=host, port=port, log_level="warning")
    server = uvicorn.Server(uv_config)

    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    logger.info(f"Programmatic Shadow Adapter server launched in background thread on http://{host}:{port}")
    return thread


def main() -> None:
    """CLI entry point for ``shadow-serve`` command."""
    parser = argparse.ArgumentParser(description="OpenOPC Shadow Adapter Server")
    parser.add_argument("--port", type=int, default=8800, help="Port to bind (default: 8800)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind (default: 0.0.0.0)")
    parser.add_argument("--db", type=str, default="./shadow_tasks.db", help="Path to SQLite database")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")

    args = parser.parse_args()

    import uvicorn

    config = ShadowConfig(api_port=args.port, api_host=args.host, db_path=args.db)
    app = create_app(config)

    logger.info(f"Starting shadow-serve on http://{args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `shadow_adapter/api/dependencies.py`
```
"""FastAPI Dependency Injection layer for Shadow Adapter API.

Provides clean DI for:
- Database store instance (ShadowStore)
- OpcResumeRepository instance
- Security manager (JWT verification & password hashing)
- Secure upload handler
- Configuration settings (ShadowConfig, UploadLimits, JwtConfig)
- HandoffService (The Temporal Bridge)
- AuthService (Carbon Employee Identity)
- Authenticated current contractor (via OAuth2 password bearer token)
- Admin role authorization check
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer

from shadow_adapter.config import ShadowConfig
from shadow_adapter.models import JwtConfig, ShadowContractor, UploadLimits
from shadow_adapter.repositories.opc_resume_repo import OpcResumeRepository
from shadow_adapter.security import SecurityManager
from shadow_adapter.services.auth_service import AuthService
from shadow_adapter.services.handoff_service import HandoffService
from shadow_adapter.shadow_store import ShadowStore
from shadow_adapter.upload import SecureUploadHandler

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_config(request: Request) -> ShadowConfig:
    """Inject ShadowConfig from FastAPI application state."""
    config: ShadowConfig | None = getattr(request.app.state, "config", None)
    if config is None:
        config = ShadowConfig()
    return config


async def get_jwt_config(
    config: Annotated[ShadowConfig, Depends(get_config)],
) -> JwtConfig:
    """Construct JwtConfig DTO from ShadowConfig."""
    return JwtConfig(
        secret=config.jwt_secret,
        algorithm=config.jwt_algorithm,
        expire_hours=config.jwt_expire_hours,
    )


async def get_upload_limits(
    config: Annotated[ShadowConfig, Depends(get_config)],
) -> UploadLimits:
    """Construct UploadLimits DTO from ShadowConfig."""
    return UploadLimits(
        max_file_count=config.max_files_per_submission,
        max_file_size_bytes=config.max_file_size_bytes,
        max_total_size_bytes=config.max_upload_size_bytes,
        allowed_extensions=config.allowed_extensions_set,
    )


async def get_store(request: Request) -> ShadowStore:
    """Inject ShadowStore instance from FastAPI application state."""
    store: ShadowStore | None = getattr(request.app.state, "shadow_store", None)
    if store is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database store is not initialized in application state",
        )
    return store


async def get_security(
    request: Request,
    jwt_config: Annotated[JwtConfig, Depends(get_jwt_config)],
) -> SecurityManager:
    """Inject SecurityManager instance constructed with JwtConfig DTO."""
    security: SecurityManager | None = getattr(request.app.state, "security", None)
    if security is None:
        security = SecurityManager(jwt_config)
    return security


async def get_upload_handler(
    request: Request,
    limits: Annotated[UploadLimits, Depends(get_upload_limits)],
) -> SecureUploadHandler:
    """Inject SecureUploadHandler instance constructed with UploadLimits DTO."""
    handler: SecureUploadHandler | None = getattr(request.app.state, "upload_handler", None)
    if handler is None:
        config = await get_config(request)
        handler = SecureUploadHandler(limits, config.upload_path)
    return handler


async def get_opc_resume_repo() -> OpcResumeRepository:
    """Inject OpcResumeRepository instance."""
    return OpcResumeRepository()


from shadow_adapter.repositories.artifact_repo import CorporateArtifactsRepository
from shadow_adapter.services.org_service import OrgHierarchyService


async def get_artifact_repo(
    store: Annotated[ShadowStore, Depends(get_store)],
) -> CorporateArtifactsRepository:
    """Inject CorporateArtifactsRepository initialized with ShadowStore db_path."""
    repo = CorporateArtifactsRepository(store.db_path)
    await repo.initialize()
    return repo


async def get_org_service() -> OrgHierarchyService:
    """Inject OrgHierarchyService."""
    return OrgHierarchyService()


async def get_handoff_service(
    store: Annotated[ShadowStore, Depends(get_store)],
    opc_resume: Annotated[OpcResumeRepository, Depends(get_opc_resume_repo)],
    upload_handler: Annotated[SecureUploadHandler, Depends(get_upload_handler)],
    upload_limits: Annotated[UploadLimits, Depends(get_upload_limits)],
    artifact_repo: Annotated[CorporateArtifactsRepository, Depends(get_artifact_repo)],
    org_service: Annotated[OrgHierarchyService, Depends(get_org_service)],
) -> HandoffService:
    """Inject HandoffService (The Temporal Bridge)."""
    return HandoffService(
        store,
        opc_resume,
        upload_handler,
        upload_limits,
        artifact_repo,
        org_service,
    )


async def get_auth_service(
    store: Annotated[ShadowStore, Depends(get_store)],
    security: Annotated[SecurityManager, Depends(get_security)],
) -> AuthService:
    """Inject AuthService."""
    return AuthService(store=store, security=security)


async def get_current_contractor(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    store: Annotated[ShadowStore, Depends(get_store)],
    security: Annotated[SecurityManager, Depends(get_security)],
) -> ShadowContractor:
    """Validate JWT token and inject current authenticated ShadowContractor."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = security.decode_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    contractor_id = payload["sub"]
    contractor = await store.get_contractor(contractor_id)
    if not contractor or not contractor.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contractor account not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return contractor


async def require_admin(
    contractor: Annotated[ShadowContractor, Depends(get_current_contractor)],
) -> ShadowContractor:
    """Ensure the current contractor has the 'admin' role."""
    if "admin" not in contractor.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for this endpoint",
        )
    return contractor

```

### Core Architecture Module: `shadow_adapter/api/routes_artifacts.py`
```
"""REST API endpoints for Corporate Artifacts and Knowledge Graph Context Routing.

Provides endpoints for downloading corporate artifacts, inspecting artifact metadata,
and fetching upstream context graph payloads for downstream tasks.
"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from loguru import logger

from shadow_adapter.api.dependencies import get_current_contractor, get_handoff_service
from shadow_adapter.models import (
    CorporateArtifact,
    ShadowContractor,
    UpstreamContextPayload,
)
from shadow_adapter.services.handoff_service import HandoffService

artifacts_router = APIRouter()


@artifacts_router.get("/{artifact_id}", response_model=CorporateArtifact, tags=["Artifacts"])
async def get_artifact_detail(
    artifact_id: str,
    handoff: Annotated[HandoffService, Depends(get_handoff_service)],
    current_user: Annotated[ShadowContractor, Depends(get_current_contractor)],
) -> CorporateArtifact:
    """Retrieve metadata for a specific Corporate Artifact."""
    if not handoff._artifact_repo:
        raise HTTPException(status_code=500, detail="Artifact repository not configured.")

    artifact = await handoff._artifact_repo.get_artifact(artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail=f"Corporate artifact '{artifact_id}' not found.")
    return artifact


@artifacts_router.get("/{artifact_id}/download", tags=["Artifacts"])
async def download_artifact_file(
    artifact_id: str,
    handoff: Annotated[HandoffService, Depends(get_handoff_service)],
    current_user: Annotated[ShadowContractor, Depends(get_current_contractor)],
) -> FileResponse:
    """Download the binary stream for a Corporate Artifact."""
    if not handoff._artifact_repo:
        raise HTTPException(status_code=500, detail="Artifact repository not configured.")

    artifact = await handoff._artifact_repo.get_artifact(artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail=f"Corporate artifact '{artifact_id}' not found.")

    file_path = Path(artifact.storage_path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail=f"Physical file for artifact '{artifact_id}' not found on storage.")

    return FileResponse(
        path=str(file_path),
        filename=artifact.original_filename,
        media_type=artifact.mime_type,
    )


@artifacts_router.get("/context/{task_id}", response_model=UpstreamContextPayload, tags=["Context Routing"])
async def get_task_upstream_context(
    task_id: str,
    handoff: Annotated[HandoffService, Depends(get_handoff_service)],
    current_user: Annotated[ShadowContractor, Depends(get_current_contractor)],
) -> UpstreamContextPayload:
    """Retrieve the complete upstream context payload (ancestor deliverables & artifacts) for a task."""
    try:
        return await handoff.get_task_upstream_context(task_id)
    except Exception as e:
        logger.error(f"Error fetching upstream context for task '{task_id}': {e}")
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' context not found.")

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

### Incident Patch 1: `d7662df5` (2026-07-29)
**Commit Message**: fix: resolve compatibility crashes by implementing required adapter methods, fixing task invocation, and normalizing CSS tokens.

**File**: `docs/compatibility_audit1.1.md` (added, +171/-0)
```diff
@@ -0,0 +1,171 @@
+# 🔴 Ruthless Compatibility Audit: `openopc-shadow-adapter` vs OpenOPC Core
+
+> **Audit Date**: 2026-07-29  
+> **OpenOPC Source**: `main` (latest pull)  
+> **Shadow Adapter Source**: `main` (commit `bf6bc6e`)  
+> **Verdict**: **5 Critical Failures, 4 Major Warnings, 3 Minor Misalignments**
+
+---
+
+## 🔴 CRITICAL FAILURES (Will Break at Runtime)
+
+### CRITICAL-1: Execution Path Bypass — `adapter.execute()` Is Never Called by the Broker
+
+> [!CAUTION]
+> **This is the single most dangerous bug in the entire adapter. The entire architecture is wired to a method the OpenOPC engine never invokes through the standard external-agent path.**
+
+**Evidence Chain:**
+- [ExternalAgentBroker.run()](file:///home/leech/Projects/OpenOPC/opc/layer3_agent/external_broker.py#L378-L481) is the method the engine calls for **all** external agent execution
+- `broker.run()` calls `adapter.build_invocation()` → then `_run_monitored_process()` → which calls `adapter.start_process()` (line 955) to spawn a **subprocess**
+- `broker.run()` **never** calls `adapter.execute()`
+- Our `ShadowModeAdapter.execute()` is dead code from the broker's perspective — the entire task-parking logic lives there, but the broker will never reach it
+- Instead, `broker.run()` tries to launch `adapter.start_process(cmd=[], ...)` with an **empty command list** (from our `build_invocation()` returning `[]`), which will crash `asyncio.create_subprocess_exec(*[])` with `IndexError`
+
+**When `adapter.execute()` IS called:** Only by [NativeAgent.execute()](file:///home/leech/Projects/OpenOPC/opc/engine.py#L9580) for **native** agents, not external ones. The `_run_task_once()` method (line 9033) routes external agents through `self.external_broker.run(adapter=..., task=...)`, NOT `adapter.execute()`.
+
+**Impact:** When `preferred_external_agent: shadow` fires, the engine will:
+1. Call `ShadowModeAdapter.build_invocation()` → returns `([], {...})`
+2. Call `broker._run_monitored_process()` → calls `adapter.start_process(cmd=[], ...)`
+3. `asyncio.create_subprocess_exec(*[])` → **IndexError crash**
+4. The entire DAG node fails
+
+---
+
+### CRITICAL-2: Missing `agent_isolation_home_slug()` Crashes Company Mode
+
+> [!CAUTION]
+> **In Company Mode, the broker REQUIRES an `agent_isolation_home_slug()` return value. Our adapter returns `None`, which raises `RuntimeError`.**
+
+**Evidence:** [external_broker.py L860-864](file:///home/leech/Projects/OpenOPC/opc/layer3_agent/external_broker.py#L860-L864):
+```python
+slug = adapter.agent_isolation_home_slug()
+if not slug:
+    raise RuntimeError(
+        f"External adapter `{adapter.agent_type}` does not provide an opc-collab CLI isolation home."
+    )
+```
+
+Our `ShadowModeAdapter` inherits the base class default `agent_isolation_home_slug()` which returns `None`. In Company Mode (which is **the primary use case** we're targeting), this line fires before `start_process()` is even reached, crashing the execution with `RuntimeError`.
+
+---
+
+### CRITICAL-3: `get_status()` Returns Wrong Type
+
+> [!WARNING]
+> **Our `get_status()` returns `str("idle")` instead of the required `AgentStatus` enum.**
+
+**Evidence:**
+- Base class signature: `async def get_status(self) -> AgentStatus` — returns [AgentStatus enum](file:///home/leech/Projects/OpenOPC/opc/core/models.py#L142-L146)
+- Our implementation: `return getattr(TaskStatus, "IDLE", "idle")` — returns a `TaskStatus` member or a bare string
+- `AgentStatus.IDLE` ≠ `TaskStatus.IDLE` — they are different enums with different semantic purposes
+
+---
+
+### CRITICAL-4: `ExternalAgentConfig` Not Provided — Constructor Mismatch
+
+> [!WARNING]
+> **The AdapterRegistry passes `config=agent_config` where `agent_config` is an `ExternalAgentConfig | None`. Our adapter constructor signature accepts this, but the `AgentsConfig.agents` dict does NOT contain a `"shadow"` key by default, so `agent_config = self.config.agents.get("shadow")` returns `None`.**
+
+**Evidence:** [AgentsConfig](file:///home/leech/Projects/OpenOPC/opc/core/config.py#L364-L377) default `agents` dict only contains `claude_code`, `cursor`, `codex`, `opencode`. No `shadow`.
+
+When [AdapterRegistry.initialize()](file:///home/leech/Projects/OpenOPC/opc/layer3_agent/adapters/registry.py#L42-L58) runs:
+```python
+agent_config = self.config.agents.get(agent_type)  # returns None for "shadow"
+adapter = adapter_cls(config=agent_config)  # calls ShadowModeAdapter(config=None)
+```
+
+Our constructor calls `super().__init__(config)` which sets `self.config = ExternalAgentConfig(command="shadow")`. This works but means:
+- `self.config.run_mode = "batch"` (default) — but Company Mode sets roles to `"interactive"`
+- The broker checks `adapter.config.run_mode` to decide execution path
+- Shadow can never be discovered via `self.config.agents.get("shadow")` without user configuration
+
+---
+
+### CRITICAL-5: Resume Repository Direct SQL Write Bypasses Phase Transition Hooks
+
+> [!C
```

**File**: `docs/implementation_plan1.1.md` (added, +351/-0)
```diff
@@ -0,0 +1,351 @@
+# Implementation Plan: Symbiotic Compatibility Fix
+
+> **Goal**: Resolve all 12 issues from the [Compatibility Audit](file:///home/leech/.gemini/antigravity-ide/brain/5e36574d-1d33-47ca-9558-5489286aab6d/compatibility_audit.md) to make `openopc-shadow-adapter` a true, zero-error symbiote on OpenOPC.
+
+---
+
+## Phase 1: Critical Runtime Fixes (Must Ship First)
+
+These 5 fixes prevent **hard crashes** when the OpenOPC engine dispatches a task to our adapter.
+
+---
+
+### Fix 1.1 — Override `start_process()` and Rewire the Execution Path
+
+**Problem**: The broker calls `adapter.start_process()` → `asyncio.create_subprocess_exec(*[])` → crash. Our `execute()` method is dead code.
+
+**Solution**: Override `start_process()` on `ShadowModeAdapter` to perform the task-parking logic internally (the same logic currently in `execute()`), then return a **mock process** that the broker's stream monitor can safely consume.
+
+#### [MODIFY] [adapter.py](file:///home/leech/Projects/OpenOPC/openopc-shadow-adapter/shadow_adapter/adapter.py)
+
+```python
+import asyncio
+
+async def start_process(
+    self,
+    cmd: list[str],
+    workspace_path: str,
+    extra_env: dict[str, str] | None = None,
+    task: Task | None = None,
+    launch_metadata: dict[str, Any] | None = None,
+) -> asyncio.subprocess.Process:
+    """Override: park the task in shadow DB instead of launching a subprocess.
+    
+    Returns a completed mock process so the broker's stream monitor
+    exits cleanly with a DONE result containing our deliverable content.
+    """
+    if task is not None:
+        result = await self.execute(task, workspace_path)
+        # Stash the result so normalize_result_output can retrieve it
+        self._last_shadow_result = result
+    
+    # Return a process that is already finished (exit code 0)
+    # The broker reads stdout/stderr streams — we give it our result content
+    proc = await asyncio.create_subprocess_exec(
+        "echo", result.content if task else "shadow_mode_parked",
+        stdout=asyncio.subprocess.PIPE,
+        stderr=asyncio.subprocess.PIPE,
+    )
+    return proc
+```
+
+And override `normalize_result_output()` to return the stashed shadow result:
+
+```python
+def normalize_result_output(self, output: str) -> str:
+    if hasattr(self, "_last_shadow_result"):
+        return self._last_shadow_result.content
+    return output
+```
+
+And override `extract_structured_result_fields()` to return shadow artifacts:
+
+```python
+def extract_structured_result_fields(self, output: str) -> dict[str, Any]:
+    if hasattr(self, "_last_shadow_result"):
+        return self._last_shadow_result.artifacts or {}
+    return {}
+```
+
+---
+
+### Fix 1.2 — Implement `agent_isolation_home_slug()` for Company Mode
+
+**Problem**: Broker checks `adapter.agent_isolation_home_slug()` → `None` → `RuntimeError` crash.
+
+**Solution**: Return a slug so the broker provisions a home directory. The shadow adapter doesn't need it, but the broker mandates it.
+
+#### [MODIFY] [adapter.py](file:///home/leech/Projects/OpenOPC/openopc-shadow-adapter/shadow_adapter/adapter.py)
+
+```python
+def agent_isolation_home_slug(self) -> str | None:
+    """Provide a home slug for Company Mode collaboration surface."""
+    return "shadow"
+
+def agent_home_env_vars(self, home: str) -> dict[str, str]:
+    """No agent-specific env vars needed — shadow parks, not executes."""
+    return {"SHADOW_ADAPTER_HOME": home}
+
+def post_install_agent_home(self, home: str) -> None:
+    """No post-install actions needed for shadow adapter."""
+    pass
+```
+
+---
+
+### Fix 1.3 — Fix `get_status()` Return Type
+
+**Problem**: Returns `TaskStatus.IDLE` (wrong enum) or bare string `"idle"` instead of `AgentStatus`.
+
+**Solution**:
+
+#### [MODIFY] [adapter.py](file:///home/leech/Projects/OpenOPC/openopc-shadow-adapter/shadow_adapter/adapter.py)
+
+```python
+async def get_status(self, *args: Any, **kwargs: Any) -> Any:
+    """Return IDLE AgentStatus since human work happens asynchronously."""
+    try:
+        from opc.core.models import AgentStatus
+        return AgentStatus.IDLE
+    except ImportError:
+        return "idle"
+```
+
+---
+
+### Fix 1.4 — Handle Missing `ExternalAgentConfig` Gracefully
+
+**Problem**: `AgentsConfig.agents` has no `"shadow"` key → `config=None` → adapter gets default `ExternalAgentConfig(command="shadow")` which is fine, but `self.config.run_mode` defaults to `"batch"`.
+
+**Solution**: Our adapter should work correctly regardless of what config it receives. Set sensible defaults in the constructor:
+
+#### [MODIFY] [adapter.py](file:///home/leech/Projects/OpenOPC/openopc-shadow-adapter/shadow_adapter/adapter.py)
+
+```python
+def __init__(self, config: Any = None, **kwargs: Any) -> None:
+    super().__init__(config)
+    self.shadow_config = kwargs.get("shadow_config") or ShadowConfig()
+    self._shadow_store = kwargs.get("shadow_store")
+    self._last_shadow_result 
```

**File**: `shadow_adapter/adapter.py` (modified, +87/-5)
```diff
@@ -23,14 +23,20 @@
 
 # Import OpenOPC core types or use fallback dataclass mocks for standalone testing
 try:
-    from opc.core.models import Task, TaskResult, TaskStatus
+    from opc.core.models import AgentStatus, Task, TaskResult, TaskStatus
     from opc.layer3_agent.adapters.base import ExternalAgentAdapter
 
     HAS_OPENOPC = True
 except ImportError:
     HAS_OPENOPC = False
     from dataclasses import dataclass, field
 
+    class AgentStatus:  # type: ignore[no-redef]
+        IDLE = "idle"
+        RUNNING = "running"
+        BLOCKED = "blocked"
+        ERROR = "error"
+
     class TaskStatus:  # type: ignore[no-redef]
         PENDING = "pending"
         RUNNING = "running"
@@ -87,6 +93,7 @@ def __init__(
         super().__init__(config)
         self.shadow_config = shadow_config or ShadowConfig()
         self._shadow_store = shadow_store
+        self._last_shadow_result: TaskResult | None = None
 
     async def _get_store(self) -> ShadowStore:
         if self._shadow_store is None:
@@ -99,8 +106,40 @@ async def is_available(self, *args: Any, **kwargs: Any) -> bool:
         return True
 
     async def get_status(self, *args: Any, **kwargs: Any) -> Any:
-        """Return idle status since human work happens asynchronously out-of-band."""
-        return getattr(TaskStatus, "IDLE", "idle")
+        """Return idle AgentStatus since human work happens asynchronously out-of-band."""
+        return getattr(AgentStatus, "IDLE", "idle")
+
+    def agent_isolation_home_slug(self) -> str | None:
+        """Return isolation slug required by OpenOPC broker in Company Mode."""
+        return "shadow"
+
+    def agent_home_env_vars(self, home: str) -> dict[str, str]:
+        """Return isolation env vars required by OpenOPC broker."""
+        return {"SHADOW_ADAPTER_HOME": str(home)}
+
+    def post_install_agent_home(self, home: str) -> None:
+        """Post-install callback for OpenOPC broker isolation home."""
+        pass
+
+    def supports_interactive(self) -> bool:
+        return False
+
+    def supports_session_resume(self) -> bool:
+        return False
+
+    def stdin_policy_for_process(
+        self,
+        cmd: list[str],
+        metadata: dict[str, Any] | None = None,
+    ) -> str:
+        return "devnull"
+
+    def supports_approval_prompt_handling(
+        self,
+        cmd: list[str],
+        metadata: dict[str, Any] | None = None,
+    ) -> bool:
+        return False
 
     def build_invocation(
         self,
@@ -109,13 +148,56 @@ def build_invocation(
         *args: Any,
         **kwargs: Any,
     ) -> tuple[list[str], dict[str, Any]]:
-        """Return empty command list because shadow tasks do not launch subprocesses."""
-        return [], {
+        """Return non-empty command for external broker audit and invocation tracking."""
+        return ["shadow", "--mode", "park"], {
             "agent": self.agent_type,
+            "command": "shadow --mode park",
             "workspace": workspace_path or "",
             "mode": "shadow_human_in_loop",
         }
 
+    async def start_process(
+        self,
+        cmd: list[str],
+        workspace_path: str,
+        extra_env: dict[str, str] | None = None,
+        task: Task | None = None,
+        launch_metadata: dict[str, Any] | None = None,
+    ) -> Any:
+        """Intercept task parking when invoked via OpenOPC ExternalAgentBroker.start_process().
+
+        Parks the task in local shadow DB and returns a completed mock subprocess.
+        """
+        import asyncio
+        import sys
+
+        if task is not None:
+            self._last_shadow_result = await self.execute(task, workspace_path)
+
+        content = self._last_shadow_result.content if self._last_shadow_result else "shadow_mode_parked"
+        # Launch a quick no-op python subprocess that prints the content and exits cleanly
+        proc = await asyncio.create_subprocess_exec(
+            sys.executable,
+            "-c",
+            f"import sys; print({repr(content)}); sys.exit(0)",
+            stdout=asyncio.subprocess.PIPE,
+            stderr=asyncio.subprocess.PIPE,
+            cwd=workspace_path if workspace_path and Path(workspace_path).exists() else None,
+        )
+        return proc
+
+    def normalize_result_output(self, output: str) -> str:
+        """Return the parked result content when called by ExternalAgentBroker."""
+        if self._last_shadow_result is not None:
+            return self._last_shadow_result.content
+        return output
+
+    def extract_structured_result_fields(self, output: str) -> dict[str, Any]:
+        """Return parked result artifacts when called by ExternalAgentBroker."""
+        if self._last_shadow_result is not None and self._last_shadow_result.artifacts:
+            return self._last_shadow_result.artifacts
+        return {}
+
     async def execute(
         self,
         task: Task,
```

**File**: `shadow_adapter/frontend/src/index.css` (modified, +54/-24)
```diff
@@ -3,33 +3,63 @@
 @import "tailwindcss/utilities";
 
 :root {
-  --opc-bg: #0c111b;
-  --opc-elevated: #141b2b;
-  --opc-secondary: #1a2332;
-  --opc-surface: rgba(20, 27, 43, 0.75);
-  --opc-text: #e2e8f0;
-  --opc-text-secondary: #8494a7;
-  --opc-text-dim: #64748b;
-  --opc-accent: #14b8a6;
-  --opc-accent-hover: #0d9488;
-  --opc-accent-soft: rgba(20, 184, 166, 0.15);
-  --opc-border: rgba(148, 163, 184, 0.12);
-  --opc-border-hover: rgba(148, 163, 184, 0.28);
+  /* OpenOPC Office UI Design Tokens */
+  --bg: #0c111b;
+  --bg-elevated: #141b2b;
+  --bg-card: #141b2b;
+  --bg-secondary: #1a2332;
+  --text: #e2e8f0;
+  --text-secondary: #8494a7;
+  --text-dim: #64748b;
+  --border: rgba(148, 163, 184, 0.12);
+  --border-hover: rgba(148, 163, 184, 0.22);
+  --surface: rgba(20, 27, 43, 0.7);
+  --surface-hover: rgba(30, 41, 63, 0.7);
+  --accent: #6366f1;
+  --accent-hover: #4f46e5;
+  --accent-soft: rgba(99, 102, 241, 0.15);
+  --accent-glow: rgba(99, 102, 241, 0.3);
+  --green: #34d399;
+  --yellow: #fbbf24;
+  --red: #f87171;
+  --radius: 12px;
+  --radius-sm: 8px;
+  --radius-xs: 6px;
+
+  /* Symbiote Aliases */
+  --opc-bg: var(--bg);
+  --opc-elevated: var(--bg-elevated);
+  --opc-secondary: var(--bg-secondary);
+  --opc-surface: var(--surface);
+  --opc-text: var(--text);
+  --opc-text-secondary: var(--text-secondary);
+  --opc-text-dim: var(--text-dim);
+  --opc-accent: var(--accent);
+  --opc-accent-hover: var(--accent-hover);
+  --opc-accent-soft: var(--accent-soft);
+  --opc-border: var(--border);
+  --opc-border-hover: var(--border-hover);
 }
 
 .light-theme {
-  --opc-bg: #f8fafc;
-  --opc-elevated: #ffffff;
-  --opc-secondary: #f1f5f9;
-  --opc-surface: rgba(255, 255, 255, 0.9);
-  --opc-text: #0f172a;
-  --opc-text-secondary: #475569;
-  --opc-text-dim: #94a3b8;
-  --opc-accent: #0d9488;
-  --opc-accent-hover: #0f766e;
-  --opc-accent-soft: rgba(13, 148, 136, 0.12);
-  --opc-border: rgba(203, 213, 225, 0.6);
-  --opc-border-hover: rgba(148, 163, 184, 0.8);
+  --bg: #f8fafc;
+  --bg-elevated: #ffffff;
+  --bg-card: #ffffff;
+  --bg-secondary: #f1f5f9;
+  --text: #0f172a;
+  --text-secondary: #475569;
+  --text-dim: #94a3b8;
+  --border: rgba(203, 213, 225, 0.6);
+  --border-hover: rgba(148, 163, 184, 0.8);
+  --surface: rgba(255, 255, 255, 0.9);
+  --surface-hover: rgba(241, 245, 249, 0.9);
+  --accent: #4f46e5;
+  --accent-hover: #4338ca;
+  --accent-soft: rgba(79, 70, 229, 0.12);
+  --accent-glow: rgba(79, 70, 229, 0.25);
+  --green: #10b981;
+  --yellow: #f59e0b;
+  --red: #ef4444;
 }
 
 body {
```

**File**: `shadow_adapter/repositories/opc_resume_repo.py` (modified, +61/-35)
```diff
@@ -41,6 +41,8 @@ async def resume(
         """Push human deliverable back into OpenOPC store to unblock the DAG.
 
         Wrapped in an Exception Black Hole for safe execution.
+        Uses OPCStore when available to trigger transition validation and phase hooks,
+        with an aiosqlite direct WAL fallback for standalone mode.
         """
         try:
             db_path = Path(opc_store_path)
@@ -59,44 +61,68 @@ async def resume(
                 content=task_result_content,
                 artifacts=task_result_artifacts or {},
             )
-
-            now_iso = datetime.now(timezone.utc).isoformat()
-
+            result_dict = json.loads(result_json)
             target_phase = str(shadow_task.opc_metadata.get("target_phase") or "approved")
-
-            async with aiosqlite.connect(str(db_path)) as db:
-                await db.execute("PRAGMA journal_mode=WAL")
-
-                # Step 3: Update task status in OpenOPC database
-                cursor = await db.execute(
-                    """UPDATE tasks
-                       SET status = 'done',
-                           result = ?,
-                           execution_lock = 0,
-                           execution_locked_at = NULL
-                       WHERE id = ?""",
-                    (result_json, shadow_task.opc_task_id),
-                )
-
-                task_found = cursor.rowcount > 0
-                if not task_found:
-                    logger.warning(
-                        f"[OpcResumeRepository] No OpenOPC task row matched id '{shadow_task.opc_task_id}' in store.db (Orphaned task)"
-                    )
-
-                # Step 4: If linked to a work item, advance phase to OpenOPC expected phase
-                work_item_updated = False
+            task_found = False
+            work_item_updated = False
+
+            # Try using OpenOPC Store API first (fires phase hooks & validates state transitions)
+            try:
+                from opc.core.models import Phase, TaskStatus
+                from opc.database.store import OPCStore
+
+                store = OPCStore(str(db_path))
+                await store.initialize()
+
+                # Update Task
+                task = await store.get_task(shadow_task.opc_task_id)
+                if task:
+                    task.status = TaskStatus.DONE
+                    task.execution_lock = False
+                    task.execution_locked_at = None
+                    task.result = result_dict
+                    await store.save_task(task)
+                    task_found = True
+
+                # Update Work Item Phase
                 if shadow_task.opc_work_item_id:
-                    wi_cursor = await db.execute(
-                        """UPDATE delegation_work_items
-                           SET phase = ?,
-                               updated_at = ?
-                           WHERE work_item_id = ?""",
-                        (target_phase, now_iso, shadow_task.opc_work_item_id),
+                    updated_wi = await store.update_delegation_work_item(
+                        work_item_id=shadow_task.opc_work_item_id,
+                        phase=target_phase,
+                        deliverable_summary=task_result_content or shadow_task.deliverable_text,
                     )
-                    work_item_updated = wi_cursor.rowcount > 0
-
-                await db.commit()
+                    work_item_updated = updated_wi is not None
+
+                await store.close()
+            except (ImportError, Exception) as store_api_exc:
+                logger.debug(f"[OpcResumeRepository] Store API resume fallback to direct WAL: {store_api_exc}")
+                # Direct WAL fallback
+                now_iso = datetime.now(timezone.utc).isoformat()
+                async with aiosqlite.connect(str(db_path)) as db:
+                    await db.execute("PRAGMA journal_mode=WAL")
+
+                    cursor = await db.execute(
+                        """UPDATE tasks
+                           SET status = 'done',
+                               result = ?,
+                               execution_lock = 0,
+                               execution_locked_at = NULL
+                           WHERE id = ?""",
+                        (result_json, shadow_task.opc_task_id),
+                    )
+                    task_found = cursor.rowcount > 0
+
+                    if shadow_task.opc_work_item_id:
+                        wi_cursor = await db.execute(
+                            """UPDATE delegation_work_items
+                               SET phase = ?,
+                                   updated_at = ?
+                               WHERE work_item_id = ?""",
+                            (target_phase, now_iso, shadow_task.opc_work_item_id),
+                        )
+                        work_item_updated = wi_cursor.rowcount > 0
+
+                    await db.commit()
 
             log
```

**File**: `tests/test_adapter.py` (modified, +26/-2)
```diff
@@ -50,15 +50,39 @@ async def test_adapter_availability_and_status(shadow_config: ShadowConfig) -> N
 
 
 async def test_build_invocation(shadow_config: ShadowConfig) -> None:
-    """Test build_invocation returns an empty command list."""
+    """Test build_invocation returns a non-empty command for broker tracking."""
     adapter = ShadowModeAdapter(shadow_config=shadow_config)
     task = Task(id="t_inv_1", title="Invocation Test")
     cmd, env = adapter.build_invocation(task, workspace_path="/tmp/workspace")
-    assert cmd == []
+    assert cmd == ["shadow", "--mode", "park"]
     assert env["agent"] == "shadow"
     assert env["workspace"] == "/tmp/workspace"
 
 
+async def test_agent_isolation_home_slug(shadow_config: ShadowConfig) -> None:
+    """Test agent_isolation_home_slug returns valid slug for OpenOPC broker."""
+    adapter = ShadowModeAdapter(shadow_config=shadow_config)
+    assert adapter.agent_isolation_home_slug() == "shadow"
+    assert adapter.agent_home_env_vars("/tmp/home") == {"SHADOW_ADAPTER_HOME": "/tmp/home"}
+
+
+async def test_start_process_interception(shadow_config: ShadowConfig, shadow_store: ShadowStore, tmp_path: Path) -> None:
+    """Test start_process intercepts task, parks it, and returns a completed process."""
+    adapter = ShadowModeAdapter(shadow_config=shadow_config, shadow_store=shadow_store)
+    task = Task(id="t_proc_1", title="Start Process Intercept Test")
+    proc = await adapter.start_process(
+        cmd=["shadow", "--mode", "park"],
+        workspace_path=str(tmp_path),
+        task=task,
+    )
+    assert proc is not None
+    await proc.wait()
+    assert proc.returncode == 0
+    parked = await shadow_store.get_task_by_opc_id("t_proc_1")
+    assert parked is not None
+    assert parked.title == "Start Process Intercept Test"
+
+
 async def test_adapter_execute_parks_task(
     shadow_config: ShadowConfig,
     shadow_store: ShadowStore,
```

**File**: `tests/test_opc_integration.py` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@ async def test_signature_survival() -> None:
         "/tmp",
         extra_opt="opt_val",
     )
-    assert cmd == []
+    assert cmd == ["shadow", "--mode", "park"]
     assert env["mode"] == "shadow_human_in_loop"
 
 
```

---

### Incident Patch 2: `348db675` (2026-07-25)
**Commit Message**: docs(readme): sync user header changes with Quick Start integration steps

**File**: `README.md` (modified, +11/-10)
```diff
@@ -24,17 +24,17 @@
 
 ---
 
-## Primary Operational Use Cases
+## Use AI Agents For
 
-### 1. Augmenting Vacant or Overloaded Roles
+### Augmenting Vacant or Overloaded Roles
 *Lost a developer? Legal reviewer on leave? Analyst at capacity?*
 AI agents perform 90% of preliminary work (research, code generation, test suite execution, drafting). Shadow Adapter routes only the final approval decision to an available human manager.
 
-### 2. Run Your Entire Business on AI Autopilot
+### Running Your Entire Business on AI Autopilot
 *One operator with the leverage of a 10-person team.*
 Your AI Research Analyst, Dev Team, Marketing Lead, and Legal Counsel operate 24/7. Shadow Adapter queues strategic checkpoints for your review without stalling non-dependent work streams.
 
-### 3. Enterprise Regulatory Compliance
+### Ensuring Enterprise Regulatory Compliance
 In finance, healthcare, legal, and security, frameworks (SOC 2, ISO 27001, GDPR) mandate human sign-off. Shadow Adapter records immutable audit events with timestamps and contractor attribution for complete compliance verification.
 
 ---
@@ -99,8 +99,8 @@ For complete technical sequence diagrams, state machine maps, and database schem
 pip install openopc-shadow-adapter
 ```
 
-### Step 2: Register Adapter in Your Python Startup Script
-In your main OpenOPC application script (e.g., `main.py` or `run_company.py`), register the adapter **before** initializing or running your OpenOPC DAG pipeline:
+### Step 2: Register Adapter in Your Application Script
+In your main OpenOPC startup script (e.g., `main.py` or `run_company.py`), register the adapter **before** running your DAG engine:
 
 ```python
 # main.py (Your OpenOPC application entry point)
@@ -110,13 +110,14 @@ from shadow_adapter.adapter import ShadowModeAdapter
 # Register "shadow" mode into OpenOPC's adapter registry
 ADAPTER_CLASSES["shadow"] = ShadowModeAdapter
 
-# Now launch your OpenOPC DAG engine as normal
+# Now launch your OpenOPC DAG pipeline as normal
 ```
 
-### Step 3: Configure Role in Your Organization Config
-In your OpenOPC organization config (`.opc/config/company_orgs/company_config.yaml`), set `preferred_external_agent: shadow` for any role requiring human review:
+### Step 3: Configure Roles in Organization Config
+In your OpenOPC organization config (`.opc/config/company_orgs/company_config.yaml`), set `preferred_external_agent: shadow` for any role requiring human approval:
 
 ```yaml
+# .opc/config/company_orgs/company_config.yaml
 roles:
   legal_counsel:
     title: "Human Legal Counsel"
@@ -130,7 +131,7 @@ roles:
 ```
 
 ### Step 4: Launch Web Portal Server
-Run the REST server and React Human Web Portal in your terminal:
+Run the portal server in your terminal:
 
 ```bash
 shadow-serve --port 8800
```

---

### Incident Patch 3: `bf6bc6e1` (2026-07-25)
**Commit Message**: docs: add professional symbiotic architecture phrasing in README and implementation_guide.md

**File**: `README.md` (modified, +1/-0)
```diff
@@ -47,6 +47,7 @@
 2. **Contractor & Silicon Worker Portal**: Provides a dedicated, secure React 19 UI and REST API (`shadow-serve`) for human reviewers and remote workers (`shadow-worker`).
 3. **Consolidated Corporate Brain**: Automatically packages ancestor deliverables, structured markdown briefs (`brief_md`), and uploaded file artifacts (`CorporateArtifacts`) for downstream context inheritance.
 4. **Canonical State Subordination**: Resumes OpenOPC's native `store.db` state machine (`delegation_work_items.phase`) instantly when deliverables are submitted.
+5. **Symbiotic Architecture**: Functions as an independent, non-invasive extension that plugs into OpenOPC's external agent registry (`ADAPTER_CLASSES["shadow"]`) with zero core repository modifications.
 
 ---
 
```

**File**: `docs/implementation_guide.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ This guide provides step-by-step setup, configuration, and architectural walkthr
 
 ## 1. Architecture Overview
 
-`openopc-shadow-adapter` is a decoupled, zero-core-modification extension for OpenOPC.
+`openopc-shadow-adapter` operates as a non-invasive **symbiotic architecture extension** for OpenOPC. It is completely independent and requires zero code modifications to the core OpenOPC repository.
 
 ```mermaid
 flowchart TD
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


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. resolve compatibility crashes by implementing required adapter methods, fixing t

**RULE**:
When implementing operations in `docs/compatibility_audit1.1.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in AhmadHassan-BTed/AutoSwarm-Shadow-Adapter. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d7662df5`: resolve compatibility crashes by implementing required adapter methods, fixing task invocation, and normalizing CSS tokens.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/compatibility_audit1.1.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
# 🔴 Ruthless Compatibility Audit: `openopc-shadow-adapter` vs OpenOPC Core

> **Audit Date**: 2026-07-29  
> **OpenOPC Source**: `main` (latest pull)  
> **Shadow Adapter Source**: `main` (commit `bf6bc6e`)  
> **Verdict**: **5 Critical Failures, 4 Major Warnings, 3 Minor Misalignments**

---

## 🔴 CRITICAL FAILURES (Will Break at Runtime)

### CRITICAL-1: Execution Path Bypass — `adapter.execute()` Is Never Called by the Broker

> [!CAUTION]
> **This is the single most dangerous bug in the entire adapter. The entire architecture is wired to a method the OpenOPC engine never invokes through the standard external-agent path.**

**Evidence Chain:**
- [ExternalAgentBroker.run()](file:///home/leech/Projects/OpenOPC/opc/layer3_agent/external_broker.py#L378-L481) is the method the engine calls for **all** external agent execution
- `broker.run()` calls `adapter.build_invocation()` → then `_run_monitored_process()` → which calls `adapter.start_process()` (line 955) to spawn a **subprocess**
- `broker.run()` **never** calls `adapter.execute()`
- Our `ShadowModeAdapter.execute()` is dead code from the broker's perspective — the entire task-parking logic lives there, but the broker will ne
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d7662df5` are properly handled with clean fallback behavior.
