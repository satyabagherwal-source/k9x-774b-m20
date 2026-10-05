# Forensic Learning Record (Deep Inspection): OpenByteInc/QuantDinger

> **Canonical Artifact**: `07_PROJECT_LEARNING/openbyteinc-quantdinger-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/OpenByteInc/QuantDinger](https://github.com/OpenByteInc/QuantDinger))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:35:28.586Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `OpenByteInc/QuantDinger`
- **Description**: Open-source AI Trading OS, agent trading, and vibe trading, with Jev System One integration. Research, build Python strategies, backtest, and paper/live trade across crypto, stocks, and forex. Launch your own multi-tenant trading SaaS with built-in user management, billing, payments, and settlement.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12343 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend_api_python/app/__init__.py`
```
"""QuantDinger Python API Flask application factory."""
from __future__ import annotations

import json
import math
import os
from datetime import date, datetime
from pathlib import Path

try:
    from dotenv import load_dotenv

    _backend_dir = Path(__file__).resolve().parents[1]
    load_dotenv(_backend_dir / ".env", override=False)
    load_dotenv(_backend_dir.parent / ".env", override=False)
except Exception:
    pass

from flask import Flask
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS

from app.startup import (
    get_pending_order_worker as get_pending_order_worker,
    get_trading_executor as get_trading_executor,
    run_startup_hooks,
)
from app.utils.logger import get_logger, setup_logger
from app.utils.timeutil import to_utc_iso


logger = get_logger(__name__)


class SafeJSONProvider(DefaultJSONProvider):
    """JSON provider that normalizes NaN/Inf and datetime values."""

    @staticmethod
    def default(o):
        if isinstance(o, datetime):
            return to_utc_iso(o)
        if isinstance(o, date):
            return o.isoformat()
        return DefaultJSONProvider.default(o)

    def dumps(self, obj, **kwargs):
        kwargs.setdefault("default", self.default)
        return _safe_json_dumps(obj, **kwargs)


def _safe_json_dumps(obj, **kwargs):
    return json.dumps(_sanitize(obj), **kwargs)


def _sanitize(obj):
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, datetime):
        return to_utc_iso(obj)
    if isinstance(obj, date):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    return obj


def _configure_cors(app: Flask) -> None:
    origins = [
        o.strip() for o in os.getenv(
            "FRONTEND_URL",
            "http://localhost:8888,http://localhost:8000",
        ).split(",")
        if o.strip()
    ]
    capacitor_origins = [
        "https://localhost",
        "http://localhost",
        "capacitor://localhost",
        "ionic://localhost",
        "https://localhost:*",
        "http://localhost:*",
    ]
    for origin in capacitor_origins:
        if origin not in origins:
            origins.append(origin)

    CORS(app, origins=origins, supports_credentials=False, send_wildcard=False)
    logger.info(f"CORS allowed origins: {origins}")


def _configure_ibkr_asyncio() -> None:
    try:
        from ib_insync import util as ib_util
        ib_util.patchAsyncio()
        logger.info("ib_insync: patchAsyncio enabled for stable IBKR connections")
    except Exception as exc:
        logger.debug(f"ib_insync patchAsyncio skipped (ib_insync not installed?): {exc}")


def _bootstrap_database() -> None:
    try:
        from app.utils.db import get_db_type, init_database
        logger.info(f"Database type: {get_db_type()}")
        init_database()

        from app.runtime.roles import ProcessRole, current_process_role

        if current_process_role() in {ProcessRole.API, ProcessRole.LEGACY}:
            from app.services.user_service import get_user_service

            get_user_service().ensure_admin_exists()

            try:
                from app.services.builtin_indicators import upgrade_builtin_indicator_samples

                upgrade_builtin_indicator_samples()
            except Exception as sample_exc:
                logger.warning(f"Builtin indicator sample upgrade skipped: {sample_exc}")
    except Exception as e:
        logger.warning(f"Database initialization note: {e}")


def create_app(config_name='default', *, register_http_routes: bool = True):
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.json_provider_class = SafeJSONProvider
    app.json = SafeJSONProvider(app)
    app.config['JSON_AS_ASCII'] = False

    if register_http_routes:
        _configure_cors(app)
    setup_logger()

    if register_http_routes:
        from app.observability import init_http_observability

        init_http_observability(app)

    from app.utils.auth import _configure_jwt_secret_warnings
    _configure_jwt_secret_warnings()

    _configure_ibkr_asyncio()
    _bootstrap_database()

    if register_http_routes:
        from app.routes import register_routes

        register_routes(app)
    run_startup_hooks(app)

    return app

```

### Core Architecture Module: `backend_api_python/app/_version.py`
```
"""Application version resolution.

Release builds inject ``APP_VERSION`` from the Git tag. Local source runs can
fall back to Git metadata or the repo-root ``VERSION`` file, so the app version
no longer needs to be edited in Python code for every release.
"""

from __future__ import annotations

import os
import subprocess
from collections.abc import Mapping
from pathlib import Path

FALLBACK_VERSION = "0.0.0-dev"
TAG_REF_PREFIX = "refs/tags/"
BRANCH_REF_PREFIX = "refs/heads/"


def normalize_version(value: object) -> str:
    """Normalize common tag/env formats into the display version."""
    text = str(value or "").strip()
    if not text:
        return ""
    if text.startswith(TAG_REF_PREFIX):
        text = text[len(TAG_REF_PREFIX) :]
    elif text.startswith(BRANCH_REF_PREFIX):
        text = text[len(BRANCH_REF_PREFIX) :]
    if text.startswith("v") and len(text) > 1 and text[1].isdigit():
        text = text[1:]
    return text


def _find_repo_root(start: Path) -> Path | None:
    current = start.resolve()
    if current.is_file():
        current = current.parent
    candidates = (current, *current.parents)
    for candidate in candidates:
        if (candidate / ".git").exists():
            return candidate
    for candidate in candidates:
        if (candidate / "VERSION").is_file():
            return candidate
    return None


def _git_describe(repo_root: Path) -> str:
    if not (repo_root / ".git").exists():
        return ""

    commands = (
        ("git", "describe", "--tags", "--exact-match", "HEAD"),
        ("git", "describe", "--tags", "--abbrev=7", "--dirty"),
    )
    for command in commands:
        try:
            completed = subprocess.run(
                command,
                cwd=repo_root,
                check=True,
                capture_output=True,
                text=True,
                timeout=2,
            )
        except Exception:
            continue
        version = normalize_version(completed.stdout)
        if version:
            return version
    return ""


def _version_file(repo_root: Path) -> str:
    version_file = repo_root / "VERSION"
    if not version_file.is_file():
        return ""
    try:
        return normalize_version(version_file.read_text(encoding="utf-8").strip())
    except OSError:
        return ""


def _build_stamp(app_root: Path, names: tuple[str, ...]) -> str:
    for name in names:
        path = app_root / name
        if not path.is_file():
            continue
        try:
            version = normalize_version(path.read_text(encoding="utf-8").strip())
        except OSError:
            continue
        if version:
            return version
    return ""


def resolve_app_version(
    env: Mapping[str, object] | None = None,
    *,
    repo_root: Path | None = None,
    app_root: Path | None = None,
    use_git: bool = True,
) -> str:
    """Resolve the current app version.

    Priority:
    1. Explicit runtime/build environment (APP_VERSION / QUANTDINGER_VERSION)
    2. Docker build stamp file (BUILD_VERSION)
    3. CI tag environment (GIT_TAG / GITHUB_REF_NAME / GITHUB_REF)
    4. Docker tag stamp file (BUILD_GIT_TAG)
    5. Local Git tag/describe metadata
    6. Repo-root VERSION fallback file
    7. Development placeholder
    """
    source_env = os.environ if env is None else env

    for key in ("APP_VERSION", "QUANTDINGER_VERSION"):
        version = normalize_version(source_env.get(key))
        if version:
            return version

    build_root = app_root or Path(__file__).resolve().parents[1]
    version = _build_stamp(build_root, ("BUILD_VERSION",))
    if version:
        return version

    for key in ("GIT_TAG", "GITHUB_REF_NAME", "GITHUB_REF"):
        version = normalize_version(source_env.get(key))
        if version and version not in {"latest", "main", "master"}:
            return version

    version = _build_stamp(build_root, ("BUILD_GIT_TAG",))
    if version and version not in {"latest", "main", "master"}:
        return version

    root = repo_root or _find_repo_root(Path(__file__).resolve())
    if root is not None:
        if use_git:
            version = _git_describe(root)
            if version:
                return version
        version = _version_file(root)
        if version:
            return version

    return FALLBACK_VERSION


APP_VERSION = resolve_app_version()

```

### Core Architecture Module: `backend_api_python/app/celery_app.py`
```
"""Celery application with lazy Flask application context integration."""

from __future__ import annotations

import os

from celery import Celery, Task
from app.config.redis_urls import celery_broker_url, celery_result_backend_url


class FlaskContextTask(Task):
    abstract = True
    _flask_app = None

    def __call__(self, *args, **kwargs):
        if self._flask_app is None:
            os.environ["QD_PROCESS_ROLE"] = "celery"
            from app import create_app

            self._flask_app = create_app(register_http_routes=False)
        with self._flask_app.app_context():
            return self.run(*args, **kwargs)


celery_app = Celery("quantdinger", task_cls=FlaskContextTask)
celery_app.conf.update(
    broker_url=celery_broker_url(),
    result_backend=celery_result_backend_url(),
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone=os.getenv("TZ", "Asia/Shanghai"),
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=max(1, int(os.getenv("CELERY_WORKER_PREFETCH", "1"))),
    worker_max_tasks_per_child=max(1, int(os.getenv("CELERY_MAX_TASKS_PER_CHILD", "100"))),
    task_soft_time_limit=max(60, int(os.getenv("CELERY_TASK_SOFT_TIME_LIMIT", "3300"))),
    task_time_limit=max(120, int(os.getenv("CELERY_TASK_TIME_LIMIT", "3600"))),
    result_expires=max(3600, int(os.getenv("CELERY_RESULT_EXPIRES", "86400"))),
    broker_transport_options={
        "visibility_timeout": max(3600, int(os.getenv("CELERY_VISIBILITY_TIMEOUT", "7200"))),
    },
    imports=(
        "app.tasks.agent_jobs",
        "app.tasks.fast_analysis",
        "app.tasks.maintenance",
        "app.tasks.fundamental_sync",
    ),
    task_routes={
        "quantdinger.tasks.fast_analysis": {"queue": "ai"},
        "quantdinger.tasks.agent_job": {"queue": "jobs"},
        "quantdinger.tasks.expire_agent_jobs": {"queue": "maintenance"},
        "quantdinger.tasks.reflection": {"queue": "maintenance"},
        "quantdinger.tasks.ai_calibration": {"queue": "maintenance"},
        "quantdinger.tasks.market_catalog_sync": {"queue": "maintenance"},
        "quantdinger.tasks.fundamental_sync_tick": {"queue": "maintenance"},
        "quantdinger.tasks.worker_heartbeat": {"queue": "maintenance"},
        "quantdinger.tasks.cleanup_runtime_metadata": {"queue": "maintenance"},
    },
    beat_schedule={
        "fundamental-sync": {
            "task": "quantdinger.tasks.fundamental_sync_tick",
            "schedule": 60.0,
        },
        "expire-billed-agent-jobs": {
            "task": "quantdinger.tasks.expire_agent_jobs",
            "schedule": 60.0,
        },
        "reflection-cycle": {
            "task": "quantdinger.tasks.reflection",
            "schedule": max(300, int(os.getenv("REFLECTION_WORKER_INTERVAL_SEC", "86400"))),
        },
        "ai-calibration-cycle": {
            "task": "quantdinger.tasks.ai_calibration",
            "schedule": max(3600, int(os.getenv("AI_CALIBRATION_INTERVAL_SEC", "86400"))),
        },
        "market-catalog-sync": {
            "task": "quantdinger.tasks.market_catalog_sync",
            "schedule": max(900, int(os.getenv("MARKET_CATALOG_SYNC_INTERVAL_SEC", "86400"))),
        },
        "celery-worker-heartbeat": {
            "task": "quantdinger.tasks.worker_heartbeat",
            "schedule": 10.0,
        },
        "runtime-metadata-cleanup": {
            "task": "quantdinger.tasks.cleanup_runtime_metadata",
            "schedule": 86400.0,
        },
    },
)

__all__ = ["celery_app"]

```

### Core Architecture Module: `backend_api_python/app/commands/__init__.py`
```
"""Backend process entrypoints."""

```

### Core Architecture Module: `backend_api_python/app/commands/migrate.py`
```
"""Fail-fast database migration entrypoint for deployments."""

from __future__ import annotations


def main() -> None:
    print("[migration] database bootstrap starting", flush=True)
    from app.utils.db import init_database

    init_database(strict_migrations=True)
    print("[migration] database bootstrap finished", flush=True)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `backend_api_python/app/commands/scheduler.py`
```
"""Scheduler process entrypoint."""

from __future__ import annotations

import os


def main() -> None:
    os.environ["QD_PROCESS_ROLE"] = "scheduler"

    from app import create_app
    from app.runtime.process import ShutdownSignal
    from app.startup import _start_scheduler_services
    from app.services.strategy_command_repository import StrategyCommandRepository
    from app.workers.trading import build_worker_id

    app = create_app(register_http_routes=False)
    shutdown = ShutdownSignal()
    shutdown.install()
    repository = StrategyCommandRepository()
    worker_id = build_worker_id()
    lease_key = "scheduler-global-services"
    lease_seconds = max(10, int(os.getenv("SCHEDULER_LEASE_SEC", "30")))
    leader = False
    with app.app_context():
        try:
            while not shutdown.event.is_set():
                if not leader:
                    leader = repository.acquire_process_lease(
                        lease_key=lease_key,
                        owner_id=worker_id,
                        lease_seconds=lease_seconds,
                    )
                    if leader:
                        _start_scheduler_services()
                else:
                    leader = repository.renew_process_lease(
                        lease_key=lease_key,
                        owner_id=worker_id,
                        lease_seconds=lease_seconds,
                    )
                    if not leader:
                        break
                repository.record_worker_heartbeat(
                    worker_id=worker_id,
                    role="scheduler",
                    metadata={"leader": leader},
                )
                shutdown.event.wait(10)
        finally:
            if leader:
                repository.release_process_lease(lease_key=lease_key, owner_id=worker_id)
            repository.mark_worker_stopped(worker_id)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `backend_api_python/app/commands/trading_worker.py`
```
"""Trading worker process entrypoint."""

from __future__ import annotations

import os
import signal


def main() -> None:
    os.environ["QD_PROCESS_ROLE"] = "trading"

    from app import create_app
    from app.startup import get_trading_executor
    from app.workers.trading import TradingWorker

    app = create_app(register_http_routes=False)
    worker = TradingWorker(get_trading_executor())

    def stop(_signum, _frame) -> None:
        worker.stop()

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    with app.app_context():
        worker.run_forever()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `backend_api_python/app/commands/worker_health.py`
```
"""Container health check for durable backend workers."""

from __future__ import annotations

import argparse
import os
import sys

from app.utils.db import get_db_connection


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("role", choices=("trading", "scheduler", "celery"))
    parser.add_argument("--max-age", type=int, default=45)
    args = parser.parse_args()

    credential_key = str(os.getenv("CREDENTIAL_ENCRYPTION_KEY") or "").strip()
    session_key = str(os.getenv("SECRET_KEY") or "").strip()
    if args.role in {"trading", "scheduler"} and not credential_key:
        if (
            len(session_key.encode("utf-8")) < 10
            or session_key == "quantdinger-secret-key-change-me"
        ):
            sys.exit(1)

    with get_db_connection() as db:
        cur = db.cursor()
        try:
            cur.execute(
                """
                SELECT COUNT(*) AS count
                FROM qd_worker_heartbeats
                WHERE role = %s AND status = 'running'
                  AND heartbeat_at >= NOW() - (%s * INTERVAL '1 second')
                """,
                (args.role, max(1, int(args.max_age))),
            )
            row = cur.fetchone() or {}
        finally:
            cur.close()
    if int(row.get("count") or 0) < 1:
        sys.exit(1)


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #248** (2026-09-17): **感谢大佬开源，实盘好像存在系统盈利记录与交易所真实盈利记录不一致的问题**
  *Symptoms*: ### Describe the bug  ### 1、系统盈利账单和交易所账单不一致，交易记录中显示6.16U的盈利，但是模拟盘中只有0.53U <img width="2029" height="131" alt="Image" src="https://github.com/user-attachments/assets/d848fc59-3965-4b68-8223-2db2da98f1ce" />  <img width="1732" height="664" alt="Image" src="https://github.com/user-attachments/assets/cf2a0884-0559-48c5-b207-e95d4ea76b41" />     ------------------------------------------------------------------------------------------------------------------  ### 2、实盘运行一会后就出现系统仓位和交易所仓位不一致。应该是交易所平仓了但是系统中还没有平仓还在持续计算着，导致两边的交易记录对不上  <img width="1701" height="688" alt="Image" src="https://github.com/user-attachments/assets/d5c12525-1834-40a2-818e-1c3096f5b700" />   ##系统版本 V5.2.1 使用docker部署，东京2核4G服务器centos8， 之前几个版本实盘也存在这种情况，目前只使用了币安和欧易都会发生这种情况   ### Expected behavior  _No response_  ### Deployment method  Docker Compose  ### Relevant logs  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈。这个问题已经修复，并已包含在 **v5.2.2** 及当前 `main` 中。  我们根据 issue 中的数据复现并确认了根因：OKX 永续合约成交数量使用“张”作为单位，旧版私有成交推送路径曾把 `0.52` 张直接按 `0.52 ETH` 入账；该合约面值为 `0.1 ETH`，实际成交量应为 `0.052 ETH`。因此旧版会把盈亏放大约 10 倍，也可能在交易所已平仓后让本地账本留下残余仓位。  修复内容包括： - OKX 等合约成交按交易所产品元数据统一换算为基础资产数量； - REST 与私有推送按成交 ID、累计数量和累计费用进行幂等对账，避免重复或乱序入账； - 使用交易所回报的已实现盈亏和手续费进行核对； - 平仓成交与交易所持仓快照会同步清理本地残余仓位； - 增加了针对 issue 中 `0.52` 张 → `0.052 ETH`、盈亏、手续费、重复成交和持仓同步的回归测试。  相关修复：[`6f82a5f`](https://github.com/OpenByteInc/QuantDinger/commit/6f82a5f5b066a1a844d76cd00c2c9500158498e8)、[`6ae972f`](https://github.com/OpenByteInc/QuantDinger/commit/6ae972fb317957d0505b22b434beb4d7b03842ac)。  请升级到 v5.2.2 或更新版本后观察新产生的成交。需要说明的是，v5.2.1 已经写入的错误历史账本不会被统一自动改写，因为不同合约面值及 REST/私有推送交错情况不同。如果升级后新成交仍能复现，请提供策略 ID、交易所订单 ID 和大致时间段（请勿提供 API 密钥），我们可以继续核对。

- **Issue #223** (2026-08-27): **Runtime cycle skipped because no instrument has usable market data**
  *Symptoms*: ### Describe the bug  2026/08/23 17:29:36 警告 Runtime cycle skipped because no instrument has usable market data 2026/08/23 17:29:36 警告 Skipped 1 instrument(s) without usable market data (Crypto:AVAX/USDT@binance:spot:strategyV2.noMarketData) 2026/08/23 17:29:30 警告 Runtime cycle skipped because no instrument has usable market data 2026/08/23 17:29:30 警告 Skipped 1 instrument(s) without usable market data (Crypto:AVAX/USDT@binance:spot:strategyV2.noMarketData) 2026/08/23 17:29:25 警告 Runtime cycle skipped because no instrument has usable market data 2026/08/23 17:29:25 警告 Skipped 1 instrument(s) without usable market data (Crypto:AVAX/USDT@binance:spot:strategyV2.noMarketData) 2026/08/23 17:29:20 警告 Runtime cycle skipped because no instrument has usable market data 2026/08/23 17:29:20 警告 Skipped 1 instrument(s) without usable market data (Crypto:AVAX/USDT@binance:spot:strategyV2.noMarketData) 2026/08/23 17:29:14 警告 Runtime cycle skipped because no instrument has usable market data 2026/08/23 17:29:14 警告 Skipped 1 instrument(s) without usable market data (Crypto:AVAX/USDT@binance:spot:strategyV2.noMarketData) 2026/08/23 17:29:09 警告 Runtime cycle skipped because no instrument has usable market data 2026/08/23 17:29:09 警告 Skipped 1 instrument(s) without usable market data (Crypto:AVAX/USDT@binance:spot:strategyV2.noMarketData) 2026/08/23 17:29:02 警告 Runtime cycle skipped because no instrument has usable market data 2026/08/23 17:29:02 警告 Skipped 1 instrument(s) without usable market
  **Post-Mortem & Fix Analysis**:
  > 已修复并发布到主分支。  相关提交： - Backend: https://github.com/OpenByteInc/QuantDinger/commit/21f1fb6 - Desktop: https://github.com/OpenByteInc/QuantDinger-Vue/commit/5806fd2  修复内容：行情失败现在保留结构化底层原因，并区分无行情、区域限制、代理失败、交易对不存在、限流、交易所不可用和周期不支持；策略日志会展示交易所、交易对、周期、处理建议及脱敏后的原始错误。相同错误按分钟去重，恢复后会记录恢复日志。  验证：后端全量 1461 passed / 5 skipped；真实公共接口验证 OKX、HTX、Bitget、Gate 可获取行情，Binance 451 和 Bybit 地区拦截均正确归类为区域限制；桌面端单测、Lint 和构建通过。

- **Issue #211** (2026-08-27): **After creating a container using the Docker plugin in the BT Panel, the port cannot be modified, and only 5,000 ports are accessible. Here is the reason why.**
  *Symptoms*: ### Describe the bug  After creating a container using the Docker plugin in the BT Panel, the port cannot be modified, and only 5,000 ports are accessible. Here is the reason why. BT Panel website: https://bt.cn  ### Steps to reproduce  install BT Panel  BT Panel website: https://bt.cn  ### Expected behavior  _No response_  ### Deployment method  Docker Compose  ### Relevant logs  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 部署说明已修正并发布到主分支： https://github.com/OpenByteInc/QuantDinger/commit/21f1fb6  中英文云部署文档现已说明：宝塔面板通过 Compose 创建容器后，应修改项目根目录 .env 并重新创建对应服务；容器内部后端固定监听 5000 属于正常架构；生产公网仅暴露 80/443，通过 Nginx/站点反向代理访问前端，不应直接公开 5000、5432 或 6379。同时修复了 FRONTEND_HOST/FRONTEND_PORT 和 MOBILE_HOST/MOBILE_PORT 的环境变量示例。

- **Issue #208** (2026-08-17): **AI 策略生成总是失败：`DiscoveryContext.set_metadata()` 拒绝 AI 生成代码的位置参数调用**
  *Symptoms*: ### Describe the bug  ## 问题描述  `POST /api/strategies/generate` 每次调用都会失败，报错：  ``` strategyV2.generationInvalid   -> strategyV2.initializeFailed: DiscoveryContext.set_metadata() takes 1 positional argument but 3 were given ```  系统提示词让大模型使用 `context.set_metadata(...)`，但没有给出精确的函数签名；而运行时实现只接受**关键字参数**（`**values`）。大模型（我用 DeepSeek `deepseek-v4-flash` 稳定复现）总是生成**位置参数**写法 `set_metadata("key", "value")`，在编译策略时直接抛 `TypeError`。内置的"自动修复"环节也无法修复，因为报错信息本身没有传达"必须用关键字参数"这个契约。  ### Steps to reproduce  ## 复现步骤  1. 用预构建镜像部署（`ghcr.io/openbyteinc/quantdinger-backend:latest`，2026-08-14 构建） 2. 配置任意 LLM 提供商（已验证 DeepSeek，模型 `deepseek-v4-flash`） 3. 登录后调用接口，随便给个提示词：  ```bash curl -s -X POST http://127.0.0.1:5000/api/strategies/generate \   -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \   -d '{"prompt":"写一个 BTC/USDT 1小时周期的简单双均线交叉策略。"}' ```  4. 返回：  ```json {"code":0,"msg":"strategyV2.generationInvalid","data":{"error":"strategyV2.initializeFailed:DiscoveryContext.set_metadata() takes 1 positional argument but 3 were given"}} ```  后端日志确认：首次编译失败（`3 were given`）→ 自动修复 → 修复后的代码再次失败（`2 were given`）：  ``` repairing invalid generated strategy: strategyV2.initializeFailed:DiscoveryContext.set_metadata() takes 1 positional argument but 3 were given strategy generation failed: strategyV2.initializeFailed:DiscoveryContext.set_metadata() takes 1 positional argument but 2 were given ```  ##   ### Expected behavior  ## 预期行为  策略生成应该成功。要么：  - 运行时接受位置参数写法（`set_metadata("direction", "long")`），或者 -

- **Issue #185** (2026-09-13): **配置AI/LLM 配置之后，点击保存，自动退出登录了，而且竟然不能再次登录，即便配置不对也不应该退出登录吧？还是说我创建容器配置有问题**
  *Symptoms*: ### Describe the bug  <img width="2846" height="1486" alt="Image" src="https://github.com/user-attachments/assets/96aeaf95-5759-45f9-a4ce-8d741d187171" />  <img width="2704" height="1378" alt="Image" src="https://github.com/user-attachments/assets/01dfb858-cc2d-475d-9a39-5b925065ee00" />  ### Steps to reproduce  1. 配置AI/LLM 2.点击保存 3. 自动退出登录，再次登录也报错无法正常登录  ### Expected behavior  _No response_  ### Deployment method  Docker Compose  ### Relevant logs  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 是不是配置.env不能在网页上配置
  > 已修复保存设置时运行时配置重载导致会话失效的问题。相关修复避免配置刷新改变认证所依赖的运行时密钥，并补齐设置、密钥遮罩和认证回归检查。  修复提交：[1d0a7ef](https://github.com/OpenByteInc/QuantDinger/commit/1d0a7ef)。本次重新运行 settings secret masking 和 auth security 测试，全部通过。  请更新后端；AI/LLM 配置可以在网页保存，不需要因此改为只能编辑 .env。按已修复关闭。若升级后仍无法登录，请提供脱敏后的登录错误和后端日志，便于区分其他配置问题。

- **Issue #181** (2026-09-13): **回测时间BUG**
  *Symptoms*: ### Describe the bug  <img width="1564" height="818" alt="Image" src="https://github.com/user-attachments/assets/f7b3f868-3e8a-40a9-8e65-4cf316e65dcf" />  回测记录中的交易时间没有按实际时区记录  ### Steps to reproduce  回测记录里比对进出场时机及价格即可复现  ### Expected behavior  _No response_  ### Deployment method  Docker Compose  ### Relevant logs  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 已修复回测时间序列化：后端统一输出带 UTC 信息的时间，前端按用户时区格式化，避免无时区时间被重复解释或产生偏移。  后端修复：[23b1aad](https://github.com/OpenByteInc/QuantDinger/commit/23b1aad)；前端回测结果使用统一 UTC 解析和用户时间格式化。本次 Strategy API V2 runtime/service 时间相关回归测试通过。  请同时更新前后端，并重新运行回测后核对。旧记录中已经丢失的时区信息不能仅靠界面更新可靠恢复。按已修复关闭；如新回测仍有偏移，请附运行时区、原始时间值和具体交易记录。

- **Issue #177** (2026-09-13): **mdd metrics incorrect?**
  *Symptoms*: ### Describe the bug  mdd incorrect? <img width="1882" height="829" alt="Image" src="https://github.com/user-attachments/assets/9c1885a6-1fd3-44e9-a89c-98887991e381" />  ### Steps to reproduce  1. Use template SMA strategy. 2. Run backtest.  ### Expected behavior  _No response_  ### Deployment method  Docker Compose  ### Relevant logs  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Hi! I looked into this report. I traced the drawdown computation in StrategyV2Broker._result and the insolvency path in liquidate_if_insolvent, and reproduced it with the Dual Moving Average template (BTC swap, 20x leverage). The reported MDD seems tied to the liquidation path: equity is marked at bar close, liquidation triggers at the same close, and the curve is floored at zero, so maxDrawdown can show -100% while the visible curve suggests a different story. I'd like to (1) extract the drawdown calculation into a pure, unit-tested function with regression tests for monotonic decline, peak-to-trough, and bankruptcy cases, and (2) confirm the expected semantics with you — should liquidation clamp MDD at -100%, or should the trough reflect a maintenance-margin level? Do you already have plans for metrics semantics around liquidation? Happy to open a small PR.
  > Thank you for the report and the follow-up investigation. We reviewed the calculation and tested the insolvency path.  The original screenshot is mathematically consistent: total return is measured against initial capital, whereas drawdown is measured against the running equity peak. An equity path of approximately 100 → 135.68 → 94.52 gives a total return of -5.48% and a maximum drawdown of -30.34%.  We did identify and fix a separate history-display problem: uniform sampling could discard the peak/trough or shift the visible insolvency boundary. Commit cb78a62f9279615b76f27a134dc53118d0f295a3 preserves the critical equity points when compacting newly saved results. Existing saved histories are not rewritten automatically; rerun affected backtests after updating.  Regarding liquidation semantics: the current simulator uses bar-close insolvency, force-closes positions, records an absorbed deficit through liquidationAdjustment, and stops further strategy orders. Zero equity therefore pr

- **Issue #171** (2026-09-13): **配置AI\LLM后做诊断分析正常，策略研发显示Chat API 尚未接入**
  *Symptoms*: ### Describe the bug  配置AI\LLM后做诊断分析正常，策略研发显示Chat API 尚未接入   ### Steps to reproduce  <img width="1250" height="785" alt="Image" src="https://github.com/user-attachments/assets/a8ca121c-0a5f-4883-a004-994ec38ade23" /> <img width="1719" height="134" alt="Image" src="https://github.com/user-attachments/assets/12fa1c03-c91b-4894-a51f-b0a4acd714d1" />  ### Expected behavior  _No response_  ### Deployment method  Docker Compose  ### Relevant logs  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈。诊断分析正常，只能说明对应的模型调用链路可用，不能证明策略研发的聊天接口、前后端版本和代理路由均已正确对接。当前报告缺少具体版本、失败请求及后端日志，暂时无法确认原环境的根因。  本次先关闭这条旧报告，不将其标记为已验证修复。如果更新到配套的最新前后端镜像后仍出现“Chat API 尚未接入”，请新开 Issue，附上失败请求的 URL、HTTP 状态码、响应正文及同一时间的后端日志，并隐藏 Token 等敏感信息。

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

### Incident Patch 1: `572ee86c` (2026-09-28)
**Commit Message**: docs: simplify security advisory details

**File**: `SECURITY.md` (modified, +14/-26)
```diff
@@ -126,29 +126,18 @@ encrypted with the previous `CREDENTIAL_ENCRYPTION_KEY` until they have been
 re-encrypted or re-entered; changing that key without a migration makes stored
 credentials unreadable.
 
-### September 2026 — Alpaca endpoint validation and strategy compiler isolation (resolved)
-
-Two authenticated attack paths were resolved on **September 29, 2026**. The
-Alpaca credential flow previously accepted a client-supplied API base URL,
-which could cause the backend to send an authenticated request to an
-attacker-selected network endpoint. Strategy compilation also executed the
-strategy `initialize` callback outside the hard process boundary used for the
-initial source evaluation, allowing a malicious callback to consume a web
-worker indefinitely.
-
-QuantDinger now rejects API-supplied Alpaca endpoint overrides, restricts
-Alpaca trading endpoints to the official paper and live hosts, and performs
-strategy discovery in a disposable process with a clean environment, a hard
-wall-clock deadline, bounded output, and operating-system memory/CPU resource
-limits where supported. These protections are mandatory and do not depend on
-an opt-in deployment flag. The fixes are included in commit
-[`f8e0a64`](https://github.com/OpenByteInc/QuantDinger/commit/f8e0a64be99a1f1e6669cc54f1ca8f8c42c33aa4).
-
-Operators should upgrade to the latest supported revision. If untrusted users
-could access the affected Alpaca credential endpoints, rotate the relevant
-Alpaca API credentials and review outbound network and application logs. The
-strategy compiler issue affected availability and did not by itself expose
-credentials or trading data.
+### September 2026 — Broker and strategy execution hardening (resolved)
+
+Two authenticated security issues involving broker endpoint validation and
+strategy compilation resource controls were resolved on **September 29,
+2026**. The update restricts broker connections to approved endpoints and
+enforces process isolation and resource limits during strategy discovery.
+
+Operators should upgrade to the latest supported revision. Deployments that
+allowed untrusted users to access broker configuration before the update
+should review relevant logs and rotate affected broker credentials as a
+precaution. Additional technical details are intentionally limited here to
+support responsible disclosure.
 
 ## Security Acknowledgments
 
@@ -165,9 +154,8 @@ credentials or trading data.
   report helped strengthen QuantDinger's IP-based authentication and anti-abuse
   controls.
 - **Dan Aridor and the [SPR{K3](https://sprk3.com/) security research team** —
-  responsibly disclosed the Alpaca outbound-request and strategy compiler
-  resource-exhaustion issues resolved in September 2026. Their clear reports,
-  contained proofs of concept, and coordinated-disclosure approach helped us
+  responsibly disclosed two backend security issues resolved in September
+  2026. Their clear reports and coordinated-disclosure approach helped us
   validate and remediate both issues safely.
 
 ---
```

---

### Incident Patch 2: `d4969980` (2026-09-28)
**Commit Message**: docs: publish security fixes and clean documentation

**File**: `SECURITY.md` (modified, +29/-0)
```diff
@@ -126,6 +126,30 @@ encrypted with the previous `CREDENTIAL_ENCRYPTION_KEY` until they have been
 re-encrypted or re-entered; changing that key without a migration makes stored
 credentials unreadable.
 
+### September 2026 — Alpaca endpoint validation and strategy compiler isolation (resolved)
+
+Two authenticated attack paths were resolved on **September 29, 2026**. The
+Alpaca credential flow previously accepted a client-supplied API base URL,
+which could cause the backend to send an authenticated request to an
+attacker-selected network endpoint. Strategy compilation also executed the
+strategy `initialize` callback outside the hard process boundary used for the
+initial source evaluation, allowing a malicious callback to consume a web
+worker indefinitely.
+
+QuantDinger now rejects API-supplied Alpaca endpoint overrides, restricts
+Alpaca trading endpoints to the official paper and live hosts, and performs
+strategy discovery in a disposable process with a clean environment, a hard
+wall-clock deadline, bounded output, and operating-system memory/CPU resource
+limits where supported. These protections are mandatory and do not depend on
+an opt-in deployment flag. The fixes are included in commit
+[`f8e0a64`](https://github.com/OpenByteInc/QuantDinger/commit/f8e0a64be99a1f1e6669cc54f1ca8f8c42c33aa4).
+
+Operators should upgrade to the latest supported revision. If untrusted users
+could access the affected Alpaca credential endpoints, rotate the relevant
+Alpaca API credentials and review outbound network and application logs. The
+strategy compiler issue affected availability and did not by itself expose
+credentials or trading data.
+
 ## Security Acknowledgments
 
 - **Risma Ajul**, security researcher — responsibly disclosed the critical JWT
@@ -140,6 +164,11 @@ credentials unreadable.
   improper trust of client-supplied proxy IP headers in September 2026. The
   report helped strengthen QuantDinger's IP-based authentication and anti-abuse
   controls.
+- **Dan Aridor and the [SPR{K3](https://sprk3.com/) security research team** —
+  responsibly disclosed the Alpaca outbound-request and strategy compiler
+  resource-exhaustion issues resolved in September 2026. Their clear reports,
+  contained proofs of concept, and coordinated-disclosure approach helped us
+  validate and remediate both issues safely.
 
 ---
 
```

**File**: `docs/README.md` (modified, +2/-0)
```diff
@@ -109,6 +109,8 @@ ownership or shared state.
 - [Chart indicator development](trading/INDICATOR_DEV_GUIDE.md)
 - [Interactive Brokers](trading/IBKR_TRADING_GUIDE_EN.md)
 - [Live-trading safety](trading/LIVE_TRADING_SAFETY.md)
+- [Public universes and point-in-time fundamentals (Chinese)](trading/PUBLIC_UNIVERSE_AND_FUNDAMENTALS_CN.md)
+- [Fundamental-data preparation operations (Chinese)](strategies/FUNDAMENTAL_DATA_PREPARATION_CN.md)
 - Runnable examples in [`examples/`](examples/)
 
 ### APIs and agents
```

**File**: `docs/agent/README.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ This folder holds **agent-facing** material for coding assistants (Cursor, Claud
 |----------|---------|
 | [MCP_SETUP.md](MCP_SETUP.md) | Wire Cursor / Claude Code / Codex / remote agents to a QuantDinger backend via the `quantdinger-mcp` MCP server (local stdio + remote HTTP) |
 | [AGENT_QUICKSTART.md](AGENT_QUICKSTART.md) | Operator + integrator walkthrough: issue a token, call the Gateway, run paper trades |
+| [cursor-mcp.example.json](cursor-mcp.example.json) | Minimal Cursor MCP configuration with replaceable endpoint and token placeholders |
 | [agent-openapi.json](agent-openapi.json) | Machine-readable contract for `/api/agent/v1` (OpenAPI 3.0) |
 | [../architecture/API_CONVENTIONS.md](../architecture/API_CONVENTIONS.md) | Shared HTTP conventions (envelopes, auth, Public/Internal tiers) |
 | [../api/openapi.yaml](../api/openapi.yaml) | Human Web API spec (flask-smorest; migration in progress) |
```

**File**: `docs/agent/README_CN.md` (modified, +3/-2)
```diff
@@ -6,8 +6,9 @@
 
 1. [Agent Gateway 快速开始](AGENT_QUICKSTART_CN.md)：创建令牌、验证身份、提交策略与回测。
 2. [MCP 接入指南](MCP_SETUP_CN.md)：连接 Cursor、Claude Code、Codex 或远程 Agent。
-3. [Agent OpenAPI](agent-openapi.json)：查看 `/api/agent/v1` 的机器可读契约。
-4. [API 约定](../architecture/API_CONVENTIONS.md)（英文）：理解响应、认证和接口分层。
+3. [Cursor MCP 配置示例](cursor-mcp.example.json)：使用可替换地址与 Token 占位符的最小配置。
+4. [Agent OpenAPI](agent-openapi.json)：查看 `/api/agent/v1` 的机器可读契约。
+5. [API 约定](../architecture/API_CONVENTIONS.md)（英文）：理解响应、认证和接口分层。
 
 ## 权限模型
 
```

**File**: `docs/deployment/NOTIFICATION_TELEGRAM_CONFIG_CN.md` (modified, +6/-13)
```diff
@@ -31,16 +31,14 @@
 3. 按照提示输入机器人名称（如：`QuantDinger Signal Bot`）
 4. 输入机器人用户名（必须以 `bot` 结尾，如：`quantdinger_signal_bot`）
 
-<img src="../screenshots/notification_telegram_token.png" alt="创建 Telegram Bot" width="100%" style="border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
-
 ---
 
 ## 第二步：获取 Bot Token
 
 创建成功后，BotFather 会返回一个 **HTTP API Token**，格式如下：
 
 ```
-123456789:ABCdefGHIjklMNOpqrsTUVwxyz
+BOT_ID:REPLACE_WITH_BOT_TOKEN
 ```
 
 > ⚠️ **安全提示**：请妥善保管此 Token，不要泄露给他人。如果 Token 泄露，请立即在 BotFather 中使用 `/revoke` 命令重新生成。
@@ -58,14 +56,10 @@
 https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getUpdates
 ```
 
-**示例**：
-```
-https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/getUpdates
-```
-
 3. 在返回的 JSON 中找到 `chat.id` 字段，这就是您的 User ID
 
-<img src="../screenshots/notification_telegram_userid_get.png" alt="获取 User ID" width="100%" style="border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
+不要把真实 Bot Token 放进截图、Issue、聊天记录或 Shell 历史。测试 API
+时应通过环境变量或密钥管理服务注入 Token。
 
 ### 方法二：通过 @userinfobot 获取
 
@@ -80,7 +74,7 @@ https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/getUpdates
 
 ```bash
 # Telegram Bot Token（必填）
-TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
+TELEGRAM_BOT_TOKEN=BOT_ID:REPLACE_WITH_BOT_TOKEN
 ```
 
 配置完成后重启后端服务使配置生效。
@@ -94,8 +88,6 @@ TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
 1. 勾选启用 **Telegram** 通知渠道
 2. 在 **User ID** 字段填入您的 Telegram User ID
 
-<img src="../screenshots/notification_telegram_userid.png" alt="配置 User ID" width="100%" style="border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
-
 > 💡 **提示**：支持填入多个 User ID（逗号分隔）或群组/频道 ID，实现多人通知。
 
 ---
@@ -115,7 +107,8 @@ TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
 
 ### Q: Token 格式是什么？
 
-Token 格式为 `数字:字母数字字符串`，例如 `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
+Token 格式为 `Bot_ID:密钥`，例如 `BOT_ID:REPLACE_WITH_BOT_TOKEN`。
+实际配置必须使用 BotFather 签发的值。
 
 ---
 
```

---

### Incident Patch 3: `f8e0a64b` (2026-09-28)
**Commit Message**: fix: harden execution and broker product routing

**File**: `ROADMAP.md` (modified, +6/-0)
```diff
@@ -43,6 +43,12 @@ auditable analytics.
 | Auditable AI entry filters | P1 | Done | [#263](https://github.com/OpenByteInc/QuantDinger/issues/263) |
 | External signal integrations | P1 | Next | [#256](https://github.com/OpenByteInc/QuantDinger/issues/256) |
 
+## Future architecture RFCs
+
+| Workstream | Stage | Target | Design document |
+| --- | --- | --- | --- |
+| Hyperscale event-driven trading architecture for 20,000 users and 100,000 active strategies | RFC | V6 | [V6 hyperscale architecture plan](docs/architecture/V6_HYPERSCALE_ARCHITECTURE_PLAN.md) |
+
 ## How to contribute
 
 Only scoped work marked **Ready** and **help wanted** should be implemented
```

**File**: `backend_api_python/app/openapi/schemas/high_risk.py` (modified, +16/-2)
```diff
@@ -120,7 +120,8 @@ class QuickTradeOrderRequestSchema(Schema):
         load_default="market",
         validate=validate.OneOf(("market", "limit")),
     )
-    amount = fields.Float(required=True, validate=validate.Range(min=0, min_inclusive=False))
+    amount = fields.Float(load_default=0, validate=validate.Range(min=0))
+    quantity = fields.Float(load_default=0, validate=validate.Range(min=0))
     price = fields.Float(load_default=0, validate=validate.Range(min=0))
     leverage = fields.Integer(load_default=1, validate=validate.Range(min=1, max=125))
     market_type = fields.String(
@@ -133,11 +134,15 @@ class QuickTradeOrderRequestSchema(Schema):
     margin_mode = fields.String(load_default="", validate=validate.Length(max=16))
     marginMode = fields.String(load_default="", validate=validate.Length(max=16))
     ai_decision_filter = fields.Boolean(load_default=False)
+    instrument_id = fields.String(load_default="", validate=validate.Length(max=128))
+    product_type = fields.String(load_default="", validate=validate.Length(max=64))
+    api_family = fields.String(load_default="", validate=validate.Length(max=64))
+    resolve_product = fields.Boolean(load_default=False)
 
     @pre_load
     def normalize_values(self, data, **kwargs):
         normalized = dict(data or {})
-        for key in ("side", "order_type", "market_type", "margin_mode", "marginMode"):
+        for key in ("side", "order_type", "market_type", "margin_mode", "marginMode", "product_type", "api_family"):
             if key in normalized:
                 normalized[key] = str(normalized[key] or "").strip().lower()
         return normalized
@@ -146,6 +151,11 @@ def normalize_values(self, data, **kwargs):
     def validate_limit_price(self, data, **kwargs):
         if data.get("order_type") == "limit" and float(data.get("price") or 0) <= 0:
             raise ValidationError("price must be greater than zero for limit orders", field_name="price")
+        quantity = float(data.get("quantity") or 0)
+        amount = float(data.get("amount") or 0)
+        is_spot_sell = data.get("market_type") == "spot" and data.get("side") == "sell"
+        if amount <= 0 and not (is_spot_sell and quantity > 0):
+            raise ValidationError("amount must be greater than zero", field_name="amount")
 
 
 class QuickTradeCloseRequestSchema(Schema):
@@ -167,6 +177,10 @@ class QuickTradeCloseRequestSchema(Schema):
         validate=validate.OneOf(("", "long", "short")),
     )
     source = fields.String(load_default="manual", validate=validate.Length(max=64))
+    instrument_id = fields.String(load_default="", validate=validate.Length(max=128))
+    product_type = fields.String(load_default="", validate=validate.Length(max=64))
+    api_family = fields.String(load_default="", validate=validate.Length(max=64))
+    resolve_product = fields.Boolean(load_default=False)
 
     @pre_load
     def normalize_values(self, data, **kwargs):
```

**File**: `backend_api_python/app/routes/agent_v1/strategy_sources.py` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ def list_strategy_templates():
 
 
 @agent_v1_bp.route("/strategy-sources/compile", methods=["POST"])
-@agent_required(SCOPE_R)
+@agent_required(SCOPE_W)
 def compile_strategy_source():
     """Compile Strategy API V2 source without persisting it."""
     body, err = get_json_or_400()
```

**File**: `backend_api_python/app/routes/alpaca.py` (modified, +12/-9)
```diff
@@ -66,6 +66,8 @@ def _config_from_request(data: dict) -> AlpacaConfig:
     secret_key = str(data.get("secretKey") or data.get("secret_key") or "").strip()
     if not api_key or not secret_key:
         raise ValueError("apiKey and secretKey required")
+    if str(data.get("baseUrl") or data.get("base_url") or "").strip():
+        raise ValueError("ALPACA_BASE_URL_OVERRIDE_NOT_ALLOWED")
     paper_raw = data.get("paper")
     if paper_raw is None:
         paper = api_key.upper().startswith("PK")
@@ -75,7 +77,6 @@ def _config_from_request(data: dict) -> AlpacaConfig:
         api_key=api_key,
         secret_key=secret_key,
         paper=paper,
-        base_url=data.get("baseUrl") or data.get("base_url") or None,
     )
 
 
@@ -85,7 +86,6 @@ def _config_to_vault_dict(config: AlpacaConfig) -> dict:
         "api_key": config.api_key,
         "secret_key": config.secret_key,
         "paper": bool(config.paper),
-        "base_url": config.base_url or "",
         "market_category": "USStock",
         "market_type": "spot",
     }
@@ -211,12 +211,16 @@ def _client_from_saved_credential(cfg=None):
     cfg = cfg if cfg is not None else _load_saved_alpaca_config(user_id)
     if not cfg:
         return None
-    config = AlpacaConfig(
-        api_key=str(cfg.get("api_key") or cfg.get("apiKey") or "").strip(),
-        secret_key=str(cfg.get("secret_key") or cfg.get("secretKey") or cfg.get("secret") or "").strip(),
-        paper=_as_bool(cfg.get("paper"), str(cfg.get("api_key") or "").upper().startswith("PK")),
-        base_url=cfg.get("base_url") or cfg.get("baseUrl") or None,
-    )
+    try:
+        config = AlpacaConfig(
+            api_key=str(cfg.get("api_key") or cfg.get("apiKey") or "").strip(),
+            secret_key=str(cfg.get("secret_key") or cfg.get("secretKey") or cfg.get("secret") or "").strip(),
+            paper=_as_bool(cfg.get("paper"), str(cfg.get("api_key") or "").upper().startswith("PK")),
+            base_url=cfg.get("base_url") or cfg.get("baseUrl") or None,
+        )
+    except ValueError:
+        logger.warning("Rejected a saved Alpaca credential with a non-official trading endpoint")
+        return None
     if not config.api_key or not config.secret_key:
         return None
     client = AlpacaClient(config)
@@ -279,7 +283,6 @@ def connect():
         apiKey (required): API key (PK prefix = paper, AK = live)
         secretKey (required): Secret key
         paper (optional, default true): Use paper trading
-        baseUrl (optional): Override API base URL
     """
     try:
         data = request.get_json() or {}
```

**File**: `backend_api_python/app/routes/credentials.py` (modified, +6/-4)
```diff
@@ -211,11 +211,12 @@ def test_credential(data):
                 },
             })
         if exchange_id == 'alpaca':
+            if str(data.get('base_url') or data.get('baseUrl') or '').strip():
+                raise ValueError('ALPACA_BASE_URL_OVERRIDE_NOT_ALLOWED')
             config = {
                 'exchange_id': exchange_id,
                 'api_key': str(data.get('api_key') or data.get('apiKey') or '').strip(),
                 'secret_key': str(data.get('secret_key') or data.get('secretKey') or '').strip(),
-                'base_url': str(data.get('base_url') or data.get('baseUrl') or '').strip(),
             }
             client = create_client(config, market_type='spot')
             if hasattr(client, 'connect') and not client.connect():
@@ -270,17 +271,18 @@ def create_credential(data):
             # AK* hits api.alpaca.markets. We deliberately do NOT expose a paper
             # toggle in the UI: the user provides whichever key matches the env
             # they want to trade in, and factory.create_alpaca_client routes
-            # automatically. base_url is still accepted as an explicit override
-            # (rare — only useful behind a corporate proxy or for unit tests).
+            # automatically. Trading endpoints are fixed to Alpaca's official
+            # HTTPS hosts and cannot be overridden by credential input.
             api_key = (data.get('api_key') or data.get('apiKey') or '').strip()
             secret_key = (data.get('secret_key') or data.get('secretKey') or '').strip()
+            if str(data.get('base_url') or data.get('baseUrl') or '').strip():
+                raise ValueError('ALPACA_BASE_URL_OVERRIDE_NOT_ALLOWED')
             if not api_key or not secret_key:
                 return jsonify({'code': 0, 'msg': 'Missing api_key/secret_key', 'data': None}), 400
 
             config.update({
                 'api_key': api_key,
                 'secret_key': secret_key,
-                'base_url': (data.get('base_url') or data.get('baseUrl') or '').strip(),
             })
             # Surface the inferred env in the hint so the credential list still
             # tells users at a glance whether this key targets paper or live.
```

---

### Incident Patch 4: `709521ff` (2026-09-26)
**Commit Message**: fix: improve virtual strategy lifecycle and grid orders

**File**: `backend_api_python/app/routes/strategy.py` (modified, +7/-2)
```diff
@@ -244,15 +244,20 @@ def stop_strategy(strategy_id: int):
         close_positions=close_positions,
     )
     status = str(result.get("status") or "")
-    if status in {"stopping", "stopped"}:
+    if status == "stopped":
         get_strategy_service().update_strategy_status(strategy_id, "stopped", user_id=int(g.user_id))
     data = {"id": strategy_id, **result}
     if not result.get("success"):
         message = "strategyV2.stopClosePartialFailure" if close_positions and status == "stopped" else "strategyV2.stopFailed"
         return _error(message, 409, data=data)
     if status == "stopping":
         return _ok(data, "strategyV2.stopQueued"), 202
-    message = "strategyV2.stoppedAndCloseQueued" if close_positions else "strategyV2.paused"
+    completed = int(result.get("close_orders_completed") or 0)
+    queued = int(result.get("close_orders_queued") or 0)
+    if close_positions and completed > 0 and completed == queued:
+        message = "strategyV2.stoppedAndVirtualCloseCompleted"
+    else:
+        message = "strategyV2.stoppedAndCloseQueued" if close_positions else "strategyV2.paused"
     return _ok(data, message)
 
 
```

**File**: `backend_api_python/app/services/strategy_v2/live_execution.py` (modified, +10/-0)
```diff
@@ -119,6 +119,16 @@ def has_inflight(self, request: LiveOrderRequest) -> bool:
         each symbol/position leg prevents those semantic duplicates without
         blocking the opposite leg of a true hedge strategy.
         """
+        if (
+            str(request.execution_mode or "").strip().lower() == "signal"
+            and str(request.strategy_type or "").strip().lower() == "grid"
+            and str(request.order_type or "").strip().lower() == "limit"
+            and str(request.client_order_id or "").strip()
+        ):
+            # A generated grid emits several independently tracked price levels
+            # in one cycle.  Their stable client IDs provide idempotency, while
+            # the virtual ledger keeps every level isolated from live execution.
+            return False
         lane = self._position_lane(request.action)
         if not lane:
             return False
```

**File**: `backend_api_python/app/services/trading_executor.py` (modified, +93/-0)
```diff
@@ -285,6 +285,9 @@ def stop_strategy_with_policy(
         """Pause a strategy and optionally queue reduce-only closes for its owned legs."""
         sid = int(strategy_id)
         strategy = self._load_strategy(sid) or {}
+        execution_mode = str(strategy.get("execution_mode") or "live").strip().lower()
+        if close_positions and execution_mode == "signal":
+            return self._stop_signal_strategy_with_virtual_close(sid, strategy)
         positions: List[Dict[str, Any]] = []
         run_id = 0
         if close_positions:
@@ -372,6 +375,96 @@ def stop_strategy_with_policy(
             result["success"] = False
         return result
 
+    def _stop_signal_strategy_with_virtual_close(
+        self,
+        strategy_id: int,
+        strategy: Mapping[str, Any],
+    ) -> Dict[str, Any]:
+        """Stop a signal runtime and synchronously settle all virtual positions."""
+        sid = int(strategy_id)
+        stopped = self.stop_strategy(sid)
+        result: Dict[str, Any] = {
+            "success": bool(stopped),
+            "status": "stopped" if stopped else "running",
+            "close_requested": True,
+            "close_orders_queued": 0,
+            "close_orders_completed": 0,
+            "close_errors": [],
+        }
+        if not stopped:
+            return result
+
+        with get_db_connection() as db:
+            cur = db.cursor()
+            cur.execute(
+                """
+                SELECT symbol, side, size, entry_price, current_price, market_type,
+                       strategy_run_id
+                FROM qd_strategy_virtual_positions
+                WHERE strategy_id = %s AND size > 0
+                ORDER BY symbol, side
+                """,
+                (sid,),
+            )
+            positions = [dict(row) for row in (cur.fetchall() or [])]
+            cur.close()
+        if not positions:
+            return result
+
+        from app.services.virtual_trading import settle_virtual_pending_order
+
+        trading_config = _json_object(strategy.get("trading_config"))
+        leverage = max(1.0, float(trading_config.get("leverage") or strategy.get("leverage") or 1.0))
+        notification_config = _json_object(strategy.get("notification_config"))
+        signal_ts = int(time.time())
+        for row in positions:
+            side = str(row.get("side") or "").strip().lower()
+            if side not in {"long", "short"}:
+                result["close_errors"].append("strategyV2.closePositionSideInvalid")
+                continue
+            price = float(row.get("current_price") or row.get("entry_price") or 0.0)
+            quantity = max(0.0, float(row.get("size") or 0.0))
+            run_id = int(row.get("strategy_run_id") or 0)
+            if run_id <= 0:
+                result["close_errors"].append("strategyV2.closeRunIdentityMissing")
+                continue
+            if price <= 0 or quantity <= 0:
+                result["close_errors"].append("strategyV2.closePositionQuoteMissing")
+                continue
+            try:
+                pending_id = self.order_gateway.submit(LiveOrderRequest(
+                    strategy_id=sid,
+                    strategy_run_id=run_id,
+                    user_id=int(strategy.get("user_id") or 0),
+                    symbol=str(row.get("symbol") or ""),
+                    action="close_long" if side == "long" else "close_short",
+                    quantity=quantity,
+                    reference_price=price,
+                    signal_timestamp=signal_ts,
+                    market_type=str(row.get("market_type") or strategy.get("market_type") or "spot"),
+                    execution_mode="signal",
+                    leverage=leverage,
+                    reason="user_stop_and_close",
+                    notification_config=notification_config,
+                    execution_algo="market",
+                    order_type="market",
+                ))
+         
```

**File**: `backend_api_python/app/services/virtual_trading.py` (modified, +24/-0)
```diff
@@ -468,6 +468,29 @@ def _json_mapping(value: Any) -> dict[str, Any]:
     }
 
 
+def settle_virtual_pending_order(pending_order_id: int) -> dict[str, Any]:
+    """Fill one already-persisted signal order without waiting for the worker poll."""
+    order_id = int(pending_order_id or 0)
+    if order_id <= 0:
+        raise ValueError("virtualTrading.invalidIdentity")
+    with get_db_connection() as db:
+        cur = db.cursor()
+        cur.execute("SELECT * FROM pending_orders WHERE id = %s", (order_id,))
+        row = dict(cur.fetchone() or {})
+        cur.close()
+    if not row:
+        raise ValueError("virtualTrading.pendingOrderNotFound")
+    raw_payload = row.get("payload_json")
+    if isinstance(raw_payload, Mapping):
+        payload = dict(raw_payload)
+    elif isinstance(raw_payload, str) and raw_payload.strip():
+        decoded = json.loads(raw_payload)
+        payload = dict(decoded) if isinstance(decoded, Mapping) else {}
+    else:
+        payload = {}
+    return execute_virtual_signal_order(row, payload)
+
+
 def _cancel_virtual_order(pending_order_id: int, virtual_order_id: int, order_intent_id: int) -> None:
     with get_db_connection() as db:
         cur = db.cursor()
@@ -751,4 +774,5 @@ def _timestamp(value: Any) -> int:
     "list_virtual_positions",
     "list_virtual_trades",
     "match_virtual_limit_orders",
+    "settle_virtual_pending_order",
 ]
```

**File**: `backend_api_python/app/workers/trading.py` (modified, +1/-1)
```diff
@@ -211,7 +211,7 @@ def _stop_strategy(self, strategy_id: int, *, close_positions: bool = False) ->
                 owner_id=self.worker_id,
             )
             return result
-        if not self.executor.stop_strategy(strategy_id, persist_status=False):
+        if not self.executor.stop_strategy(strategy_id, persist_status=True):
             raise RuntimeError("Executor failed to stop the local strategy runtime.")
         self._lease_heartbeat.forget_strategy(strategy_id)
         self.repository.release_strategy_lease(strategy_id=strategy_id, owner_id=self.worker_id)
```

---

### Incident Patch 5: `0ae43533` (2026-09-26)
**Commit Message**: fix: allow focused AI edits on legacy strategies

**File**: `backend_api_python/app/routes/strategy.py` (modified, +13/-2)
```diff
@@ -27,6 +27,7 @@
     apply_deterministic_strategy_edit,
     build_strategy_generation_request,
     build_strategy_system_prompt,
+    resolve_strategy_validation_intent,
     select_strategy_system_prompt,
     validate_generated_strategy,
 )
@@ -370,6 +371,11 @@ def generate_strategy():
             code = _strip_code_fence(str(content or ""))
             edit_plan = {"executor": "model", "operation": "generate_candidate"}
         candidate_before_validation = code
+        validation_intent = resolve_strategy_validation_intent(
+            prompt=prompt,
+            existing_code=existing_code,
+            context=context,
+        )
         code, program, behavior_validation = _compile_or_repair_generated_strategy(
             llm,
             user_prompt,
@@ -378,7 +384,7 @@ def generate_strategy():
             generation_mode=generation_mode,
             context=context,
             system_prompt=full_system_prompt,
-            intent=generation_intent,
+            intent=validation_intent,
         )
         if code != candidate_before_validation and edit_plan.get("executor") == "model_patch":
             edit_plan = {
@@ -759,6 +765,11 @@ def run_strategy_workspace_turn():
                 candidate_code = _strip_code_fence(str(generated or ""))
                 edit_plan = {"executor": "model", "operation": "generate_candidate"}
         candidate_before_validation = candidate_code
+        validation_intent = resolve_strategy_validation_intent(
+            prompt=prompt,
+            existing_code=existing_code,
+            context=context,
+        )
         candidate_code, program, behavior_validation = _compile_or_repair_generated_strategy(
             llm,
             user_prompt,
@@ -767,7 +778,7 @@ def run_strategy_workspace_turn():
             generation_mode=generation_mode,
             context=context,
             system_prompt=full_system_prompt,
-            intent=generation_intent,
+            intent=validation_intent,
         )
         if candidate_code != candidate_before_validation and edit_plan.get("executor") == "model_patch":
             edit_plan = {
```

**File**: `backend_api_python/app/services/strategy_ai_generation.py` (modified, +40/-0)
```diff
@@ -36,6 +36,14 @@
     r"(?:我让你|按(?:上面|刚才)|不要(?:再)?.{0,8}解释|直接).{0,24}(?:改|修改|写入|应用|执行)",
     re.IGNORECASE,
 )
+
+_SOURCE_PRESERVATION_CAPABILITIES = {
+    "crypto_swap",
+    "bidirectional",
+    "one_way_reversal",
+    "supertrend",
+    "technical_factors",
+}
 _OTHER_EDIT_RE = re.compile(
     r"(?:止损|止盈|仓位|杠杆|标的|多空|做多|做空|long|short|indicator|指标|信号|参数)",
     re.IGNORECASE,
@@ -187,6 +195,38 @@ def apply_deterministic_strategy_edit(
     return "".join(lines), edit_plan
 
 
+def resolve_strategy_validation_intent(
+    *,
+    prompt: str,
+    existing_code: str = "",
+    context: dict | None = None,
+) -> StrategyAIGenerationIntent:
+    """Enforce requested contracts without retroactively blocking unrelated edits."""
+    source_intent = resolve_strategy_generation_intent(
+        prompt=prompt,
+        existing_code=existing_code,
+        context=context,
+    )
+    requested_intent = resolve_strategy_generation_intent(
+        prompt=prompt,
+        context=context,
+    )
+    capabilities = {
+        *requested_intent.capabilities,
+        *(
+            capability
+            for capability in source_intent.capabilities
+            if capability in _SOURCE_PRESERVATION_CAPABILITIES
+        ),
+    }
+    return StrategyAIGenerationIntent(
+        tuple(sorted(capabilities)),
+        source_intent.requested_direction_mode,
+        source_intent.factor_ids,
+        requested_intent.required_factor_ids,
+    )
+
+
 def select_strategy_system_prompt(asset_type: str, generation_mode: str = "authoring") -> str:
     normalized_type = normalize_asset_type(asset_type)
     mode = str(generation_mode or "authoring").strip().lower()
```

**File**: `backend_api_python/tests/test_strategy_ai_capabilities.py` (modified, +46/-0)
```diff
@@ -6,6 +6,7 @@
 from app.services.strategy_ai_generation import (
     build_strategy_generation_request,
     build_strategy_system_prompt,
+    resolve_strategy_validation_intent,
     validate_generated_strategy,
 )
 from app.services.strategy_authoring import get_strategy_authoring_contract
@@ -138,6 +139,51 @@ def test_capability_resolver_reserves_both_for_explicit_hedge_mode():
     assert set(intent.capabilities) >= {"crypto_swap", "bidirectional"}
 
 
+def test_unrelated_edit_does_not_retroactively_enforce_legacy_grid_lifecycle():
+    source = "PERSIST_RUNTIME_STATE = True\n\n" + _swap_source(
+        direction_mode="long_only",
+        body='''    order_target_percent(
+        g.symbol,
+        0.4,
+        position_side="long",
+        client_order_id="legacy-grid-entry",
+        reason="grid_entry",
+    )''',
+    )
+
+    generation_intent = resolve_strategy_generation_intent(
+        prompt="修改一下策略名字",
+        existing_code=source,
+    )
+    validation_intent = resolve_strategy_validation_intent(
+        prompt="修改一下策略名字",
+        existing_code=source,
+    )
+
+    assert {"persistent_state", "order_lifecycle"} <= set(
+        generation_intent.capabilities
+    )
+    assert "persistent_state" not in validation_intent.capabilities
+    assert "order_lifecycle" not in validation_intent.capabilities
+    validate_generated_strategy(
+        source,
+        asset_type="script",
+        prompt="修改一下策略名字",
+        intent=validation_intent,
+    )
+
+
+def test_grid_lifecycle_contract_remains_required_when_requested():
+    validation_intent = resolve_strategy_validation_intent(
+        prompt="修复网格订单状态跟踪",
+        existing_code="",
+    )
+
+    assert {"persistent_state", "order_lifecycle"} <= set(
+        validation_intent.capabilities
+    )
+
+
 @pytest.mark.parametrize(
     "prompt,expected",
     [
```

---

### Incident Patch 6: `200480ec` (2026-09-26)
**Commit Message**: fix: restore backend CI guardrails

**File**: `backend_api_python/app/routes/indicator.py` (modified, +9/-150)
```diff
@@ -11,7 +11,6 @@
 from __future__ import annotations
 
 import json
-import os
 import re
 import time
 import traceback
@@ -27,12 +26,7 @@
 )
 from app.services.ai_copilot_context import fit_messages_to_budget
 from app.services.ai_authoring_intent import resolve_authoring_intent
-from app.services.ai_code_edits import (
-    CODE_EDIT_SYSTEM_SUFFIX,
-    CodeEditError,
-    apply_model_code_edits,
-    code_edit_user_instruction,
-)
+from app.services.indicator_ai_generation import generate_indicator_code_candidate
 from app.services.indicator_ai_workspace import (
     begin_turn as begin_indicator_ai_turn,
     classify_indicator_ai_intent,
@@ -944,151 +938,16 @@ def _template_code() -> str:
         return code
 
     def _generate_code_via_llm() -> tuple[str, Dict[str, Any]]:
-        """Use unified LLMService to support all configured providers (OpenRouter, OpenAI, Grok, etc.)."""
-        from app.services.llm import LLMService
-        
-        llm = LLMService()
-        
-        # Get provider and model from env config (no frontend override)
-        current_provider = llm.provider
-        current_model = llm.get_code_generation_model()
-        current_api_key = llm.get_api_key()
-        base_url = llm.get_base_url()
-        
-        logger.info(f"AI Code Generation - Provider: {current_provider.value}, Model: {current_model}, Base URL: {base_url}, API Key configured: {bool(current_api_key)}")
-        
-        # Check if any LLM provider is configured
-        if not current_api_key:
-            logger.warning("No LLM API key configured, using template code")
-            return _template_code(), {"executor": "template", "operation": "generate_candidate"}
-
-        def _context_block() -> str:
-            if not context:
-                return ""
-            lines: List[str] = []
-            market = str(context.get("market") or "").strip()
-            symbol = str(context.get("symbol") or "").strip()
-            timeframe = str(context.get("timeframe") or "").strip()
-            indicator_name = str(context.get("indicatorName") or "").strip()
-            indicator_description = str(context.get("indicatorDescription") or "").strip()
-            param_defaults = context.get("paramDefaults")
-            if market or symbol or timeframe:
-                lines.append(f"- Current chart: market={market or 'unknown'}, symbol={symbol or 'unknown'}, timeframe={timeframe or 'unknown'}")
-            if indicator_name:
-                lines.append(f"- Current indicator name: {indicator_name}")
-            if indicator_description:
-                lines.append(f"- Current indicator description: {indicator_description[:300]}")
-            if isinstance(param_defaults, dict) and param_defaults:
-                try:
-                    lines.append("- Existing @param defaults: " + json.dumps(param_defaults, ensure_ascii=False)[:1200])
-                except Exception:
-                    pass
-            if not lines:
-                return ""
-            return (
-                "\n\n# Current IDE context (for intent only; do not hardcode symbol/timeframe/account settings)\n"
-                + "\n".join(lines)
-            )
-
-        # Build user prompt (match PHP behavior)
-        context_text = _context_block()
-        user_prompt = prompt + context_text
-        use_patch_response = bool(existing.strip())
-        if existing:
-            user_prompt = (
-                "# Existing QuantDinger indicator code (source of truth):\n\n```python\n"
-                + existing.strip()
-                + "\n```\n\n# Change request:\n\n"
-                + prompt
-                + context_text
-                + "\n\nPreserve my_indicator_name/description, df = df.copy(), declared @param values read via params.get(...), output dict with layers defaulting to [], and list lengths == len(df). "
-                "Do not emit execution columns, # @strategy, risk, sizing, timeframe, or trade-directi
```

**File**: `backend_api_python/app/routes/strategy_ledger_routes.py` (modified, +1/-1)
```diff
@@ -193,7 +193,7 @@ def get_trades():
         if is_derivatives_market(market_type):
             market_type = "swap"
 
-        if str(st.get("execution_mode") or "signal").strip().lower() == "signal":
+        if str(st.get("execution_mode") or "").strip().lower() == "signal":
             return jsonify({
                 "code": 1,
                 "msg": "success",
```

**File**: `backend_api_python/app/services/indicator_ai_generation.py` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+"""Indicator code-candidate generation outside the HTTP route."""
+
+from __future__ import annotations
+
+import json
+import os
+from typing import Any, Callable, Dict, List, Mapping
+
+from app.services.ai_code_edits import (
+    CODE_EDIT_SYSTEM_SUFFIX,
+    CodeEditError,
+    apply_model_code_edits,
+    code_edit_user_instruction,
+)
+from app.services.ai_copilot_context import fit_messages_to_budget
+
+
+def _context_block(context: Mapping[str, Any]) -> str:
+    lines: List[str] = []
+    market = str(context.get("market") or "").strip()
+    symbol = str(context.get("symbol") or "").strip()
+    timeframe = str(context.get("timeframe") or "").strip()
+    indicator_name = str(context.get("indicatorName") or "").strip()
+    indicator_description = str(context.get("indicatorDescription") or "").strip()
+    param_defaults = context.get("paramDefaults")
+    if market or symbol or timeframe:
+        lines.append(
+            f"- Current chart: market={market or 'unknown'}, "
+            f"symbol={symbol or 'unknown'}, timeframe={timeframe or 'unknown'}"
+        )
+    if indicator_name:
+        lines.append(f"- Current indicator name: {indicator_name}")
+    if indicator_description:
+        lines.append(f"- Current indicator description: {indicator_description[:300]}")
+    if isinstance(param_defaults, dict) and param_defaults:
+        lines.append(
+            "- Existing @param defaults: "
+            + json.dumps(param_defaults, ensure_ascii=False, default=str)[:1200]
+        )
+    if not lines:
+        return ""
+    return (
+        "\n\n# Current IDE context (for intent only; do not hardcode "
+        "symbol/timeframe/account settings)\n"
+        + "\n".join(lines)
+    )
+
+
+def _strip_code_fences(content: Any) -> str:
+    text = str(content or "").strip()
+    if text.startswith("```python"):
+        text = text[9:]
+    elif text.startswith("```"):
+        text = text[3:]
+    if text.endswith("```"):
+        text = text[:-3]
+    return text.strip()
+
+
+def generate_indicator_code_candidate(
+    *,
+    prompt: str,
+    existing: str,
+    context: Mapping[str, Any],
+    system_prompt: str,
+    workspace_context: Mapping[str, Any] | None,
+    template_factory: Callable[[], str],
+    logger: Any,
+) -> tuple[str, Dict[str, Any]]:
+    """Generate a full candidate or apply bounded model edit operations."""
+    from app.services.llm import LLMService
+
+    llm = LLMService()
+    current_provider = llm.provider
+    current_model = llm.get_code_generation_model()
+    current_api_key = llm.get_api_key()
+    base_url = llm.get_base_url()
+    logger.info(
+        "AI Code Generation - Provider: %s, Model: %s, Base URL: %s, "
+        "API Key configured: %s",
+        current_provider.value,
+        current_model,
+        base_url,
+        bool(current_api_key),
+    )
+
+    if not current_api_key:
+        logger.warning("No LLM API key configured, using template code")
+        return template_factory(), {"executor": "template", "operation": "generate_candidate"}
+
+    context_text = _context_block(context)
+    user_prompt = prompt + context_text
+    use_patch_response = bool(existing.strip())
+    if existing:
+        user_prompt = (
+            "# Existing QuantDinger indicator code (source of truth):\n\n```python\n"
+            + existing.strip()
+            + "\n```\n\n# Change request:\n\n"
+            + prompt
+            + context_text
+            + "\n\nPreserve my_indicator_name/description, df = df.copy(), declared @param "
+            "values read via params.get(...), output dict with layers defaulting to [], and list "
+            "lengths == len(df). Do not emit execution columns, # @strategy, risk, sizing, "
+            "timeframe, or trade-direction settings. For visual signals, output one-bar event "
+            "markers by default; do not repeat markers on every bar while a condition remains "
+            "true. For every 
```

**File**: `backend_api_python/app/services/pending_order_worker.py` (modified, +17/-88)
```diff
@@ -1444,97 +1444,26 @@ def _dispatch_one(self, order_row: Dict[str, Any]) -> None:
             pass
 
         if mode == "signal":
-            # The virtual ledger rejects live strategies and is idempotent by
-            # pending order id. It never imports or invokes a broker adapter.
-            try:
-                from app.services.virtual_trading import execute_virtual_signal_order
-
-                virtual_fill = execute_virtual_signal_order(order_row, payload)
-            except Exception as exc:
-                self._mark_failed(order_id=order_id, error=f"virtual_fill_failed:{exc}"[:500])
-                logger.exception(
-                    "Virtual fill failed: strategy_id=%s pending_id=%s signal=%s symbol=%s",
-                    strategy_id,
-                    order_id,
-                    signal_type,
-                    symbol,
-                )
-                append_strategy_log(
-                    int(strategy_id or 0),
-                    "error",
-                    "strategyRuntime.virtualFillFailed",
-                )
-                return
-
-            # notification_config is stored in payload_json at enqueue time;
-            # fall back to the strategy record when older queue rows omit it.
-            if (not notification_config) and strategy_id:
-                notification_config = self._load_notification_config(int(strategy_id))
-
-            stake_quote = calc_notional_value(float(price or 0.0), float(amount or 0.0)) or float(amount or 0.0)
-            results = self._notifier.notify_signal(
-                strategy_id=int(strategy_id or 0),
-                strategy_name=str(strategy_name or ""),
-                symbol=str(symbol or ""),
-                signal_type=str(signal_type or ""),
-                price=float(price or 0.0),
-                stake_amount=float(stake_quote),
-                direction=str(direction or "long"),
-                notification_config=notification_config if isinstance(notification_config, dict) else {},
-                extra={
-                    "pending_order_id": order_id,
-                    "mode": mode,
-                    "virtual_order_id": int(virtual_fill.get("virtual_order_id") or 0),
-                    "virtual_fill_price": float(virtual_fill.get("fill_price") or 0.0),
-                },
+            from app.services.pending_orders.signal_execution import (
+                dispatch_virtual_signal_order,
             )
 
-            attempted = list(results.keys())
-            ok_channels = [c for c, r in results.items() if (r or {}).get("ok")]
-            fail_channels = [c for c, r in results.items() if not (r or {}).get("ok")]
-
-            virtual_note = (
-                f"virtual_{virtual_fill.get('status') or 'filled'}="
-                f"{int(virtual_fill.get('virtual_order_id') or 0)}"
+            dispatch_virtual_signal_order(
+                worker=self,
+                order_row=order_row,
+                payload=payload,
+                order_id=order_id,
+                strategy_id=strategy_id,
+                strategy_name=strategy_name,
+                signal_type=signal_type,
+                symbol=symbol,
+                price=price,
+                amount=amount,
+                direction=direction,
+                notification_config=notification_config,
+                append_log=append_strategy_log,
+                logger=logger,
             )
-            if ok_channels:
-                note = f"{virtual_note};notified_ok={','.join(ok_channels)}"
-                if fail_channels:
-                    note += f";fail={','.join(fail_channels)}"
-                self._mark_sent(
-                    order_id=order_id,
-                    note=note[:200],
-                    filled=float(virtual_fill.get("fill_quantity") or 0.0),
-                    avg_price=float(virtual_fill.get("fill_price") or 0.0),
-                    executed_at=int(time.time()),
-        
```

**File**: `backend_api_python/app/services/pending_orders/signal_execution.py` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+"""Signal-mode virtual execution and notification dispatch."""
+
+from __future__ import annotations
+
+import logging
+import time
+from typing import Any, Callable, Mapping
+
+from app.utils.pnl import calc_notional_value
+
+
+def dispatch_virtual_signal_order(
+    *,
+    worker: Any,
+    order_row: Mapping[str, Any],
+    payload: Mapping[str, Any],
+    order_id: int,
+    strategy_id: Any,
+    strategy_name: str,
+    signal_type: Any,
+    symbol: Any,
+    price: float,
+    amount: float,
+    direction: str,
+    notification_config: Any,
+    append_log: Callable[..., Any],
+    logger: logging.Logger,
+) -> None:
+    """Fill the isolated virtual ledger, then send best-effort notifications."""
+    try:
+        from app.services.virtual_trading import execute_virtual_signal_order
+
+        virtual_fill = execute_virtual_signal_order(dict(order_row), dict(payload))
+    except Exception as exc:
+        worker._mark_failed(order_id=order_id, error=f"virtual_fill_failed:{exc}"[:500])
+        logger.exception(
+            "Virtual fill failed: strategy_id=%s pending_id=%s signal=%s symbol=%s",
+            strategy_id,
+            order_id,
+            signal_type,
+            symbol,
+        )
+        append_log(
+            int(strategy_id or 0),
+            "error",
+            "strategyRuntime.virtualFillFailed",
+        )
+        return
+
+    resolved_notification_config = notification_config
+    if not resolved_notification_config and strategy_id:
+        resolved_notification_config = worker._load_notification_config(int(strategy_id))
+
+    stake_quote = calc_notional_value(price, amount) or amount
+    results = worker._notifier.notify_signal(
+        strategy_id=int(strategy_id or 0),
+        strategy_name=str(strategy_name or ""),
+        symbol=str(symbol or ""),
+        signal_type=str(signal_type or ""),
+        price=price,
+        stake_amount=float(stake_quote),
+        direction=str(direction or "long"),
+        notification_config=(
+            resolved_notification_config
+            if isinstance(resolved_notification_config, dict)
+            else {}
+        ),
+        extra={
+            "pending_order_id": order_id,
+            "mode": "signal",
+            "virtual_order_id": int(virtual_fill.get("virtual_order_id") or 0),
+            "virtual_fill_price": float(virtual_fill.get("fill_price") or 0.0),
+        },
+    )
+
+    attempted = list(results.keys())
+    ok_channels = [channel for channel, result in results.items() if (result or {}).get("ok")]
+    fail_channels = [channel for channel, result in results.items() if not (result or {}).get("ok")]
+    virtual_note = (
+        f"virtual_{virtual_fill.get('status') or 'filled'}="
+        f"{int(virtual_fill.get('virtual_order_id') or 0)}"
+    )
+
+    if ok_channels:
+        note = f"{virtual_note};notified_ok={','.join(ok_channels)}"
+        if fail_channels:
+            note += f";fail={','.join(fail_channels)}"
+        level = "signal"
+        message = "strategyRuntime.virtualFillCompleted"
+    else:
+        first_error = next(
+            (
+                f"{channel}:{(results.get(channel) or {}).get('error')}"
+                for channel in attempted
+                if (results.get(channel) or {}).get("error")
+            ),
+            "",
+        )
+        note = f"{virtual_note};notify_failed={first_error or 'no_channel'}"
+        level = "warning"
+        message = "strategyRuntime.virtualFillNotificationFailed"
+
+    worker._mark_sent(
+        order_id=order_id,
+        note=note[:200],
+        filled=float(virtual_fill.get("fill_quantity") or 0.0),
+        avg_price=float(virtual_fill.get("fill_price") or 0.0),
+        executed_at=int(time.time()),
+        final_filled=True,
+    )
+    append_log(int(strategy_id or 0), level, message)
```

---

### Incident Patch 7: `7da255c1` (2026-09-25)
**Commit Message**: fix: harden live order execution recovery

**File**: `backend_api_python/app/services/alpaca_trading/client.py` (modified, +22/-0)
```diff
@@ -289,6 +289,7 @@ def place_market_order(
         market_type: str = "USStock",
         take_profit_price: float = 0.0,
         stop_loss_price: float = 0.0,
+        client_order_id: str = "",
     ) -> OrderResult:
         """Place a market order. market_type: 'USStock' or 'crypto'."""
         try:
@@ -317,6 +318,8 @@ def place_market_order(
                 "side": modules["OrderSide"].BUY if side.lower() == "buy" else modules["OrderSide"].SELL,
                 "time_in_force": modules["TimeInForce"].GTC if asset_class == "crypto" else modules["TimeInForce"].DAY,
             }
+            if str(client_order_id or "").strip():
+                request_kwargs["client_order_id"] = str(client_order_id).strip()[:48]
             take_profit_price = float(take_profit_price or 0.0)
             stop_loss_price = float(stop_loss_price or 0.0)
             if asset_class == "us_equity" and (take_profit_price > 0 or stop_loss_price > 0):
@@ -359,6 +362,7 @@ def place_market_order(
                     "requested_qty": requested_quantity,
                     "submitted_qty": float(quantity),
                     "submitted_at": str(order.submitted_at),
+                    "client_order_id": str(getattr(order, "client_order_id", "") or client_order_id),
                     **self._order_commission_snapshot(order),
                 },
             )
@@ -376,6 +380,7 @@ def place_limit_order(
         extended_hours: bool = False,
         take_profit_price: float = 0.0,
         stop_loss_price: float = 0.0,
+        client_order_id: str = "",
     ) -> OrderResult:
         """Place a limit order. extended_hours=True for pre/post-market."""
         try:
@@ -405,6 +410,8 @@ def place_limit_order(
                 "limit_price": price,
                 "extended_hours": extended_hours if asset_class == "us_equity" else False,
             }
+            if str(client_order_id or "").strip():
+                request_kwargs["client_order_id"] = str(client_order_id).strip()[:48]
             if asset_class == "us_equity":
                 request_kwargs["limit_price"] = _normalize_equity_price(price)
             take_profit_price = float(take_profit_price or 0.0)
@@ -443,6 +450,7 @@ def place_limit_order(
                     "status": status,
                     "limit_price": price,
                     "extended_hours": extended_hours,
+                    "client_order_id": str(getattr(order, "client_order_id", "") or client_order_id),
                     **self._order_commission_snapshot(order),
                 },
             )
@@ -503,6 +511,20 @@ def get_order_status(self, order_id: str) -> OrderResult:
             logger.error("Alpaca get_order_status failed: %s", err)
             return OrderResult(success=False, message=err)
 
+    def get_order_status_by_client_id(self, client_order_id: str) -> OrderResult:
+        """Fetch an order using Alpaca's idempotent client order id."""
+        try:
+            self._ensure_connected()
+            requested = str(client_order_id or "").strip()
+            if not requested:
+                return OrderResult(success=False, message="Missing client_order_id")
+            order = self._trading_client.get_order_by_client_id(requested)
+            return self.get_order_status(str(getattr(order, "id", "") or ""))
+        except Exception as e:
+            err = _format_alpaca_error(e)
+            logger.error("Alpaca get_order_status_by_client_id failed: %s", err)
+            return OrderResult(success=False, message=err)
+
     def get_account_activities(
         self,
         *,
```

**File**: `backend_api_python/app/services/execution_streams/processor.py` (modified, +19/-1)
```diff
@@ -221,8 +221,9 @@ def _project_pending_order(self, event: Dict[str, Any], binding: Dict[str, Any])
                 SET filled = GREATEST(COALESCE(filled, 0), %s),
                     avg_price = CASE WHEN %s > 0 THEN %s ELSE avg_price END,
                     status = CASE
-                        WHEN status IN ('failed','cancelled') THEN status
                         WHEN %s = 'filled' THEN 'filled'
+                        WHEN status = 'failed' AND %s > 0 THEN 'sent'
+                        WHEN status IN ('failed','cancelled') THEN status
                         ELSE status
                     END,
                     fee_status = %s,
@@ -236,11 +237,28 @@ def _project_pending_order(self, event: Dict[str, Any], binding: Dict[str, Any])
                     aggregate_avg,
                     aggregate_avg,
                     queue_status,
+                    target,
                     str(event.get("fee_status") or "pending"),
                     target,
                     pending_id,
                 ),
             )
+            order_intent_id = int(pending.get("order_intent_id") or 0)
+            if order_intent_id > 0:
+                cur.execute(
+                    """
+                    UPDATE strategy_order_intents
+                    SET status = CASE
+                            WHEN status = 'filled' OR %s = 'filled' THEN 'filled'
+                            WHEN %s > 0 THEN 'partially_filled'
+                            WHEN %s = 'cancelled' THEN 'cancelled'
+                            ELSE status
+                        END,
+                        updated_at = NOW()
+                    WHERE id = %s
+                    """,
+                    (queue_status, target, queue_status, order_intent_id),
+                )
             cur.execute(
                 """
                 UPDATE qd_live_order_bindings
```

**File**: `backend_api_python/app/services/ibkr_trading/client.py` (modified, +49/-0)
```diff
@@ -245,6 +245,7 @@ def _trade_result(self, trade, *, message_prefix: str = "Order") -> OrderResult:
             "filled": float(getattr(order_status, "filled", 0) or 0),
             "remaining": float(getattr(order_status, "remaining", 0) or 0),
             "avgFillPrice": float(getattr(order_status, "avgFillPrice", 0) or 0),
+            "orderRef": str(getattr(order, "orderRef", "") or ""),
             **fee_snapshot,
         }
         return OrderResult(
@@ -284,6 +285,7 @@ def place_market_order(
         side: str,
         quantity: float,
         market_type: str = "USStock",
+        client_order_id: str = "",
     ) -> OrderResult:
         """
         Place a market order.
@@ -313,6 +315,8 @@ def place_market_order(
                 totalQuantity=quantity,
                 account=self._account
             )
+            if str(client_order_id or "").strip():
+                order.orderRef = str(client_order_id).strip()[:64]
             
             trade = self._ib.placeOrder(contract, order)
             
@@ -335,6 +339,7 @@ def place_limit_order(
         quantity: float,
         price: float,
         market_type: str = "USStock",
+        client_order_id: str = "",
     ) -> OrderResult:
         """
         Place a limit order.
@@ -366,6 +371,8 @@ def place_limit_order(
                 lmtPrice=price,
                 account=self._account
             )
+            if str(client_order_id or "").strip():
+                order.orderRef = str(client_order_id).strip()[:64]
             
             trade = self._ib.placeOrder(contract, order)
             self._ib.sleep(1)
@@ -391,6 +398,7 @@ def place_bracket_order(
         stop_loss_price: float = 0.0,
         limit_price: float = 0.0,
         market_type: str = "USStock",
+        client_order_id: str = "",
     ) -> OrderResult:
         """Submit a parent order and attached take-profit/stop-loss orders atomically."""
         try:
@@ -412,6 +420,8 @@ def place_bracket_order(
                 if float(limit_price or 0.0) > 0
                 else ib_insync.MarketOrder(action, quantity, account=self._account)
             )
+            if str(client_order_id or "").strip():
+                parent.orderRef = str(client_order_id).strip()[:64]
             parent.orderId = self._ib.client.getReqId()
             parent.transmit = False
 
@@ -530,6 +540,45 @@ def get_order_status(self, order_id: int) -> OrderResult:
             logger.error(f"Get order status failed: {e}")
             return OrderResult(success=False, order_id=order_id, message=str(e))
 
+    def get_order_status_by_client_id(self, client_order_id: str) -> OrderResult:
+        """Return the latest order carrying the deterministic IBKR orderRef."""
+        try:
+            self._ensure_connected()
+            requested = str(client_order_id or "").strip()
+            if not requested:
+                return OrderResult(success=False, message="Missing client_order_id")
+            trades = []
+            for method_name, args in (
+                ("reqAllOpenOrders", ()),
+                ("openTrades", ()),
+                ("trades", ()),
+                ("reqCompletedOrders", (False,)),
+            ):
+                method = getattr(self._ib, method_name, None)
+                if not callable(method):
+                    continue
+                try:
+                    trades.extend(list(method(*args) or []))
+                except Exception:
+                    continue
+            for trade in trades:
+                order = getattr(trade, "order", None)
+                if str(getattr(order, "orderRef", "") or "") == requested:
+                    return self._trade_result(trade)
+            return OrderResult(
+                success=True,
+                status="Unknown",
+                message="Order not found by orderRef in the current IBKR session",
+                raw={"orderRef": requested},
+            )
+        except Exception a
```

**File**: `backend_api_python/app/services/live_trading/adapters.py` (modified, +7/-1)
```diff
@@ -2,7 +2,7 @@
 
 from __future__ import annotations
 
-from typing import Any, Dict
+from typing import Any, Callable, Dict, Optional
 
 from app.services.live_trading.base import LiveOrderResult
 from app.services.live_trading.contracts import FillSnapshot, OrderIntent, PositionSnapshot
@@ -28,6 +28,7 @@ def __init__(
         ref_price: float = 0.0,
         spot_quote_amt: float = 0.0,
         spot_market_buy_uses_quote: bool = False,
+        before_submit: Optional[Callable[[OrderIntent], None]] = None,
     ):
         self.client = client
         self.exchange_id = str(exchange_id or "")
@@ -37,8 +38,11 @@ def __init__(
         self.ref_price = float(ref_price or 0.0)
         self.spot_quote_amt = float(spot_quote_amt or 0.0)
         self.spot_market_buy_uses_quote = bool(spot_market_buy_uses_quote)
+        self.before_submit = before_submit
 
     def place_market_order(self, intent: OrderIntent) -> LiveOrderResult:
+        if self.before_submit is not None:
+            self.before_submit(intent)
         return place_live_market_order(
             client=self.client,
             symbol=str(intent.symbol),
@@ -57,6 +61,8 @@ def place_market_order(self, intent: OrderIntent) -> LiveOrderResult:
         )
 
     def place_limit_order(self, intent: OrderIntent) -> LiveOrderResult:
+        if self.before_submit is not None:
+            self.before_submit(intent)
         return place_live_limit_order(
             client=self.client,
             symbol=str(intent.symbol),
```

**File**: `backend_api_python/app/services/live_trading/alpaca_ownership.py` (modified, +3/-0)
```diff
@@ -137,6 +137,7 @@ def execute_guarded_alpaca_order(worker, **kwargs):
         kwargs["_notify_live_best_effort"](status="failed", error=reason)
         return
     credential_id = credential_id_from_exchange_config(kwargs["exchange_config"])
+    prepare_submission = kwargs.pop("prepare_submission", None)
     try:
         with alpaca_account_lock(credential_id):
             payload = dict(kwargs["payload"])
@@ -150,6 +151,8 @@ def execute_guarded_alpaca_order(worker, **kwargs):
                 amount=payload.get("amount") or row.get("amount") or 0,
                 order_id=order_id,
             )
+            if callable(prepare_submission):
+                prepare_submission()
             worker._execute_alpaca_order_locked(**{**kwargs, "payload": payload})
     except Exception as exc:
         reason = str(exc)
```

---

### Incident Patch 8: `393f50bb` (2026-09-24)
**Commit Message**: fix: satisfy backend structure guard

**File**: `backend_api_python/app/openapi/register.py` (modified, +2/-0)
```diff
@@ -81,6 +81,7 @@ def register_human_blueprints(api: Api) -> None:
     from app.routes.fast_analysis import fast_analysis_blp
     from app.routes.billing import billing_blp
     from app.routes.quick_trade import quick_trade_blp
+    from app.routes.quick_trade_event_radar import quick_trade_event_radar_blp
 
     registrations: list[tuple] = [
         (health_blp, ""),
@@ -108,6 +109,7 @@ def register_human_blueprints(api: Api) -> None:
         (fast_analysis_blp, "/api/fast-analysis"),
         (billing_blp, "/api/billing"),
         (quick_trade_blp, "/api/quick-trade"),
+        (quick_trade_event_radar_blp, "/api/quick-trade"),
     ]
 
     for blp, prefix in registrations:
```

**File**: `backend_api_python/app/routes/quick_trade.py` (modified, +3/-49)
```diff
@@ -45,16 +45,13 @@
     limit_order_kwargs,
     quick_order_status,
 )
-from app.services.quick_trade.symbols import (
-    is_supported_crypto_exchange,
-    symbols_match as quick_trade_symbols_match,
-)
+from app.services.quick_trade.symbols import is_supported_crypto_exchange, symbols_match as quick_trade_symbols_match
+from app.services.quick_trade.history import parse_quick_trade_metadata
 from app.services.live_trading.position_row_parse import (
     extract_signed_position_qty,
     infer_position_side_from_row,
 )
 from app.services.ai_decision_filter import list_ai_decisions
-from app.services.event_radar import EventRadarError, get_event_radar_service
 from app.utils.request_guard import RequestGuardError, cache_key, guarded_cached
 
 logger = get_logger(__name__)
@@ -1942,17 +1939,6 @@ def get_history():
 
         trades = []
         for r in rows:
-            raw_result = r.get("raw_result") or {}
-            if isinstance(raw_result, str):
-                try:
-                    raw_result = json.loads(raw_result)
-                except (TypeError, ValueError):
-                    raw_result = {}
-            quick_trade_meta = {}
-            if isinstance(raw_result, dict):
-                candidate = raw_result.get("_quick_trade")
-                if isinstance(candidate, dict):
-                    quick_trade_meta = candidate
             trades.append({
                 "id": r.get("id"),
                 "credential_id": r.get("credential_id"),
@@ -1975,11 +1961,7 @@ def get_history():
                 "commission_quote": float(r.get("commission_quote") or 0),
                 "error_msg": r.get("error_msg") or "",
                 "source": r.get("source") or "",
-                "margin_mode": quick_trade_meta.get("margin_mode") or "",
-                "requested_base_qty": float(quick_trade_meta.get("requested_base_qty") or 0),
-                "notional_usdt": float(quick_trade_meta.get("notional_usdt") or 0),
-                "amount_semantics": quick_trade_meta.get("amount_semantics") or "",
-                "client_order_id": quick_trade_meta.get("client_order_id") or "",
+                **parse_quick_trade_metadata(r.get("raw_result")),
                 "created_at": str(r.get("created_at") or ""),
             })
 
@@ -2008,33 +1990,5 @@ def get_ai_decisions():
     return jsonify({"code": 1, "msg": "common.success", "data": rows})
 
 
-@quick_trade_blp.route('/event-radar', methods=['GET'])
-@login_required
-def get_event_radar():
-    """Return Event Radar availability and the latest reference analysis."""
-    symbol = str(request.args.get("symbol") or "").strip()
-    market_type = str(request.args.get("market_type") or "").strip()
-    data = get_event_radar_service().get_status(int(g.user_id), symbol, market_type)
-    return jsonify({"code": 1, "msg": "common.success", "data": data})
-
-
-@quick_trade_blp.route('/event-radar/analyze', methods=['POST'])
-@login_required
-def analyze_event_radar():
-    """Run a paid, reference-only event analysis for the current instrument."""
-    payload = request.get_json(silent=True) or {}
-    try:
-        data = get_event_radar_service().analyze(
-            int(g.user_id),
-            str(payload.get("symbol") or ""),
-            str(payload.get("market_type") or ""),
-        )
-        return jsonify({"code": 1, "msg": "common.success", "data": data})
-    except EventRadarError as exc:
-        return jsonify({"code": 0, "msg": exc.code, "data": exc.details}), exc.status
-    except Exception as exc:
-        logger.exception("Event Radar analysis failed")
-        return jsonify({"code": 0, "msg": "event_radar_failed", "data": {"error": str(exc)}}), 500
-
 # openapi-compat: legacy import name
 quick_trade_bp = quick_trade_blp
```

**File**: `backend_api_python/app/routes/quick_trade_event_radar.py` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+"""Reference-only Event Radar endpoints for Quick Trade."""
+
+from flask import g, jsonify, request
+
+from app.openapi.blueprint import HumanBlueprint as Blueprint
+from app.services.event_radar import EventRadarError, get_event_radar_service
+from app.utils.auth import login_required
+from app.utils.logger import get_logger
+
+logger = get_logger(__name__)
+
+quick_trade_event_radar_blp = Blueprint("quick_trade_event_radar", __name__)
+
+
+@quick_trade_event_radar_blp.route("/event-radar", methods=["GET"])
+@login_required
+def get_event_radar():
+    """Return Event Radar availability and the latest reference analysis."""
+    symbol = str(request.args.get("symbol") or "").strip()
+    market_type = str(request.args.get("market_type") or "").strip()
+    data = get_event_radar_service().get_status(int(g.user_id), symbol, market_type)
+    return jsonify({"code": 1, "msg": "common.success", "data": data})
+
+
+@quick_trade_event_radar_blp.route("/event-radar/analyze", methods=["POST"])
+@login_required
+def analyze_event_radar():
+    """Run a paid, reference-only event analysis for the current instrument."""
+    payload = request.get_json(silent=True) or {}
+    try:
+        data = get_event_radar_service().analyze(
+            int(g.user_id),
+            str(payload.get("symbol") or ""),
+            str(payload.get("market_type") or ""),
+        )
+        return jsonify({"code": 1, "msg": "common.success", "data": data})
+    except EventRadarError as exc:
+        return jsonify({"code": 0, "msg": exc.code, "data": exc.details}), exc.status
+    except Exception as exc:
+        logger.exception("Event Radar analysis failed")
+        return jsonify({"code": 0, "msg": "event_radar_failed", "data": {"error": str(exc)}}), 500
```

**File**: `backend_api_python/app/services/quick_trade/history.py` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+"""Quick Trade history response helpers."""
+
+from __future__ import annotations
+
+import json
+from typing import Any
+
+
+def _number(value: Any) -> float:
+    try:
+        return float(value or 0)
+    except (TypeError, ValueError):
+        return 0.0
+
+
+def parse_quick_trade_metadata(raw_result: Any) -> dict[str, Any]:
+    """Extract stable history fields from stored execution metadata."""
+    if isinstance(raw_result, str):
+        try:
+            raw_result = json.loads(raw_result)
+        except (TypeError, ValueError):
+            raw_result = {}
+    candidate = raw_result.get("_quick_trade") if isinstance(raw_result, dict) else {}
+    metadata = candidate if isinstance(candidate, dict) else {}
+    return {
+        "margin_mode": metadata.get("margin_mode") or "",
+        "requested_base_qty": _number(metadata.get("requested_base_qty")),
+        "notional_usdt": _number(metadata.get("notional_usdt")),
+        "amount_semantics": metadata.get("amount_semantics") or "",
+        "client_order_id": metadata.get("client_order_id") or "",
+    }
```

**File**: `backend_api_python/tests/test_quick_trade_history.py` (modified, +5/-5)
```diff
@@ -3,7 +3,7 @@
 
 from flask import Flask, g
 
-from app.routes import quick_trade
+from app.routes import quick_trade, quick_trade_event_radar
 
 
 class _Cursor:
@@ -122,9 +122,9 @@ def get_status(self, user_id, symbol, market_type):
             captured.update(user_id=user_id, symbol=symbol, market_type=market_type)
             return {"enabled": True, "cost": 5, "latest": None}
 
-    monkeypatch.setattr(quick_trade, "get_event_radar_service", lambda: Service())
+    monkeypatch.setattr(quick_trade_event_radar, "get_event_radar_service", lambda: Service())
     app = Flask(__name__)
-    handler = inspect.unwrap(quick_trade.get_event_radar)
+    handler = inspect.unwrap(quick_trade_event_radar.get_event_radar)
 
     with app.test_request_context("/api/quick-trade/event-radar?symbol=BTC/USDT&market_type=swap"):
         g.user_id = 99
@@ -139,9 +139,9 @@ class Service:
         def analyze(self, user_id, symbol, market_type):
             return {"reference_only": True, "symbol": symbol, "market_type": market_type}
 
-    monkeypatch.setattr(quick_trade, "get_event_radar_service", lambda: Service())
+    monkeypatch.setattr(quick_trade_event_radar, "get_event_radar_service", lambda: Service())
     app = Flask(__name__)
-    handler = inspect.unwrap(quick_trade.analyze_event_radar)
+    handler = inspect.unwrap(quick_trade_event_radar.analyze_event_radar)
     assert "place_order" not in inspect.getsource(handler)
 
     with app.test_request_context(
```

---

### Incident Patch 9: `ecd685cd` (2026-09-24)
**Commit Message**: fix(ai): compose JEV decisions from atomic checks

**File**: `backend_api_python/app/services/ai_decision_filter.py` (modified, +18/-21)
```diff
@@ -80,17 +80,6 @@
             "insufficient": "Execution evidence is incomplete and no concrete blocking issue can be established.",
         },
     },
-    "entry_decision": {
-        "type": "choice",
-        "instructions": (
-            "Make the final pre-trade decision using the full supplied state. Reject only for concrete evidence of "
-            "a directional contradiction, material portfolio risk, or unsafe execution. Missing evidence alone must not reject."
-        ),
-        "criteria": {
-            "pass": "The entry is supported or mixed, stays within risk limits, and has no concrete blocking condition.",
-            "reject": "Concrete supplied evidence makes this new exposure directionally contradictory, materially risky, or unsafe.",
-        },
-    },
 }
 
 JEV_CHECK_OPTIONS = {
@@ -99,7 +88,6 @@
     "market_regime": {"favorable", "neutral", "adverse", "insufficient"},
     "risk_check": {"clear", "caution", "block", "insufficient"},
     "execution_quality": {"clear", "caution", "block", "insufficient"},
-    "entry_decision": {"pass", "reject"},
 }
 
 
@@ -295,14 +283,17 @@ def _evaluate_jev(
             })
 
         min_confidence = max(0.0, min(float(config.get("min_confidence") or 0.55), 1.0))
-        for name in ("entry_decision", "risk_check", "execution_quality"):
+        for name in ("risk_check", "execution_quality"):
             confidence = results[name][2]
             if confidence is None or confidence < min_confidence:
-                raise ValueError(f"Jev confidence below threshold for {name}")
+                confidence_text = "missing" if confidence is None else f"{confidence:.3f}"
+                raise ValueError(
+                    f"Jev confidence below threshold for {name} "
+                    f"(confidence={confidence_text}, threshold={min_confidence:.3f})"
+                )
 
-        entry_choice, probabilities, confidence = results["entry_decision"]
-        risk_choice = results["risk_check"][0]
-        execution_choice = results["execution_quality"][0]
+        risk_choice, _, risk_confidence = results["risk_check"]
+        execution_choice, _, execution_confidence = results["execution_quality"]
         signal_choice, _, signal_confidence = results["signal_alignment"]
         regime_choice, _, regime_confidence = results["market_regime"]
         directional_block = (
@@ -312,8 +303,7 @@ def _evaluate_jev(
             and float(regime_confidence or 0) >= min_confidence
         )
         allowed = (
-            entry_choice == "pass"
-            and risk_choice != "block"
+            risk_choice != "block"
             and execution_choice != "block"
             and not directional_block
         )
@@ -327,7 +317,15 @@ def _evaluate_jev(
         elif directional_block:
             reason = "jev_entry_rejected:signal_conflict"
         else:
-            reason = "jev_entry_rejected:entry_reject"
+            reason = "jev_entry_rejected"
+        if risk_choice == "block":
+            confidence = risk_confidence
+        elif execution_choice == "block":
+            confidence = execution_confidence
+        elif directional_block:
+            confidence = min(float(signal_confidence or 0), float(regime_confidence or 0))
+        else:
+            confidence = min(float(risk_confidence or 0), float(execution_confidence or 0))
         return self._result(
             allowed,
             final_choice,
@@ -337,7 +335,6 @@ def _evaluate_jev(
             started,
             model=model,
             confidence=confidence,
-            probabilities=probabilities,
             checks=checks,
         )
 
```

**File**: `backend_api_python/tests/test_ai_decision_filter.py` (modified, +35/-6)
```diff
@@ -41,7 +41,6 @@ def _jev_answers(**choices):
         "market_regime": ("favorable", {"favorable": 0.8, "neutral": 0.15, "adverse": 0.03, "insufficient": 0.02}),
         "risk_check": ("clear", {"clear": 0.85, "caution": 0.1, "block": 0.03, "insufficient": 0.02}),
         "execution_quality": ("clear", {"clear": 0.85, "caution": 0.1, "block": 0.03, "insufficient": 0.02}),
-        "entry_decision": ("pass", {"pass": 0.9, "reject": 0.1}),
     }
     defaults.update(choices)
     return {
@@ -167,7 +166,6 @@ def raise_for_status(self):
 
         def json(self):
             return {"answers": _jev_answers(
-                entry_decision=("reject", {"pass": 0.1, "reject": 0.9}),
                 risk_check=("block", {"clear": 0.03, "caution": 0.05, "block": 0.9, "insufficient": 0.02}),
             )}
 
@@ -236,9 +234,9 @@ def raise_for_status(self):
         def json(self):
             return {
                 "answers": {
-                    "entry_decision": {
-                        "choice": "pass",
-                        "probabilities": {"pass": 0.8, "reject": 0.2},
+                    "risk_check": {
+                        "choice": "clear",
+                        "probabilities": {"clear": 0.8, "caution": 0.2},
                         "confidence": 0.6,
                     }
                 }
@@ -324,7 +322,7 @@ def raise_for_status(self):
 
         def json(self):
             return {"answers": _jev_answers(
-                entry_decision=("pass", {"pass": 0.6, "reject": 0.4}),
+                risk_check=("clear", {"clear": 0.6, "caution": 0.2, "block": 0.1, "insufficient": 0.1}),
             )}
 
     class LLM:
@@ -353,6 +351,37 @@ def call_llm_api(self, *args, **kwargs):
     assert result.allowed is True
     assert result.provider == "llm"
     assert "confidence below threshold" in result.fallback_reason
+    assert "confidence=0.600" in result.fallback_reason
+    assert "threshold=0.650" in result.fallback_reason
+
+
+def test_jev_uses_atomic_checks_without_composite_entry_question(monkeypatch):
+    captured = {}
+
+    class Response:
+        def raise_for_status(self):
+            return None
+
+        def json(self):
+            return {"answers": _jev_answers()}
+
+    monkeypatch.setattr(module.AIDecisionFilter, "_jev_config", staticmethod(lambda: {
+        "api_key": "secret",
+        "base_url": "https://api.typesafe.ai/v1",
+        "model": "jev-latest",
+        "timeout_seconds": "8",
+        "min_confidence": "0.55",
+    }))
+    monkeypatch.setattr(module.requests, "post", lambda *args, **kwargs: (captured.update(kwargs) or Response()))
+    monkeypatch.setattr(module.AIDecisionFilter, "_persist", staticmethod(lambda request, result: None))
+
+    result = module.AIDecisionFilter().evaluate(_request(), enabled=True)
+
+    assert "entry_decision" not in captured["json"]["questions"]
+    assert result.allowed is True
+    assert result.provider == "jev"
+    assert result.decision == "pass"
+    assert result.confidence == 0.85
 
 
 def test_billing_charge_and_refund_use_one_decision_reference(monkeypatch):
```

---

### Incident Patch 10: `06ee7f3f` (2026-09-24)
**Commit Message**: fix(trading): consume filtered strategy signals once

**File**: `backend_api_python/app/services/strategy_v2/live_execution.py` (modified, +70/-1)
```diff
@@ -3,6 +3,7 @@
 from __future__ import annotations
 
 import json
+import threading
 from dataclasses import dataclass
 from typing import Any
 
@@ -44,6 +45,62 @@ class StrategyV2OrderGateway:
 
     _ACTIVE_PENDING_STATUSES = ("pending", "processing", "sent", "syncing")
 
+    def __init__(self, *, decision_filter_factory=None) -> None:
+        self._decision_filter_factory = decision_filter_factory
+        self._ai_rejection_latches: dict[int, set[tuple[str, str, str]]] = {}
+        self._ai_signal_cycle: dict[int, set[tuple[str, str, str]]] = {}
+        self._ai_latch_lock = threading.Lock()
+
+    @staticmethod
+    def _ai_signal_fingerprint(request: LiveOrderRequest) -> tuple[str, str, str]:
+        return (
+            str(request.symbol or "").strip(),
+            str(request.action or "").strip().lower(),
+            str(request.reason or "").strip(),
+        )
+
+    def begin_signal_cycle(self, strategy_run_id: int) -> None:
+        run_id = int(strategy_run_id or 0)
+        if run_id <= 0:
+            return
+        with self._ai_latch_lock:
+            self._ai_signal_cycle[run_id] = set()
+
+    def finish_signal_cycle(self, strategy_run_id: int) -> None:
+        run_id = int(strategy_run_id or 0)
+        if run_id <= 0:
+            return
+        with self._ai_latch_lock:
+            seen = self._ai_signal_cycle.pop(run_id, None)
+            if seen is None:
+                return
+            remaining = self._ai_rejection_latches.get(run_id, set()).intersection(seen)
+            if remaining:
+                self._ai_rejection_latches[run_id] = remaining
+            else:
+                self._ai_rejection_latches.pop(run_id, None)
+
+    def clear_signal_state(self, strategy_run_id: int) -> None:
+        run_id = int(strategy_run_id or 0)
+        with self._ai_latch_lock:
+            self._ai_signal_cycle.pop(run_id, None)
+            self._ai_rejection_latches.pop(run_id, None)
+
+    def _is_ai_rejection_latched(self, request: LiveOrderRequest) -> bool:
+        run_id = int(request.strategy_run_id or 0)
+        fingerprint = self._ai_signal_fingerprint(request)
+        with self._ai_latch_lock:
+            seen = self._ai_signal_cycle.get(run_id)
+            if seen is not None:
+                seen.add(fingerprint)
+            return fingerprint in self._ai_rejection_latches.get(run_id, set())
+
+    def _latch_ai_rejection(self, request: LiveOrderRequest) -> None:
+        run_id = int(request.strategy_run_id or 0)
+        fingerprint = self._ai_signal_fingerprint(request)
+        with self._ai_latch_lock:
+            self._ai_rejection_latches.setdefault(run_id, set()).add(fingerprint)
+
     @staticmethod
     def _position_lane(action: str) -> str:
         signal = str(action or "").strip().lower()
@@ -98,6 +155,12 @@ def has_inflight(self, request: LiveOrderRequest) -> bool:
 
     def submit(self, request: LiveOrderRequest) -> int | None:
         request = self._validate(request)
+        if (
+            request.execution_mode == "live"
+            and request.ai_decision_filter
+            and self._is_ai_rejection_latched(request)
+        ):
+            return None
         service = OrderIntentService(
             strategy_id=request.strategy_id,
             strategy_run_id=request.strategy_run_id,
@@ -149,7 +212,12 @@ def submit(self, request: LiveOrderRequest) -> int | None:
         if request.execution_mode == "live" and request.ai_decision_filter:
             from app.services.ai_decision_filter import AIDecisionFilter, AIDecisionRequest
 
-            decision = AIDecisionFilter().evaluate(
+            decision_filter = (
+                self._decision_filter_factory()
+                if self._decision_filter_factory is not None
+                else AIDecisionFilter()
+            )
+            decision = decision_filter.evaluate(
                 AIDecisionRequest(
                     user_id=request.user_id,
                     sou
```

**File**: `backend_api_python/app/services/trading_executor.py` (modified, +21/-0)
```diff
@@ -874,6 +874,13 @@ def runtime_prices() -> dict[str, float]:
                                     )
                                 )
                             if frame_advanced:
+                                begin_signal_cycle = getattr(
+                                    self.order_gateway,
+                                    "begin_signal_cycle",
+                                    None,
+                                )
+                                if callable(begin_signal_cycle):
+                                    begin_signal_cycle(run_id)
                                 intents, messages, timestamp = session.process(
                                     frames,
                                     frequency_frames=frequency_frames,
@@ -918,6 +925,13 @@ def runtime_prices() -> dict[str, float]:
                                                 ),
                                             },
                                         })
+                                finish_signal_cycle = getattr(
+                                    self.order_gateway,
+                                    "finish_signal_cycle",
+                                    None,
+                                )
+                                if callable(finish_signal_cycle):
+                                    finish_signal_cycle(run_id)
                                 initial_frames_pending = False
                                 last_signal_bar_token = current_bar_token
                                 last_processed_frame_timestamp = latest_frame_timestamp
@@ -1027,6 +1041,13 @@ def runtime_prices() -> dict[str, float]:
                 append_strategy_log(strategy_id, "error", exit_reason)
             self._mark_stopped(strategy_id)
         finally:
+            clear_signal_state = getattr(
+                self.order_gateway,
+                "clear_signal_state",
+                None,
+            )
+            if callable(clear_signal_state):
+                clear_signal_state(run_id)
             if state_store is not None:
                 state_store.flush()
             if market_price_feed is not None:
```

**File**: `backend_api_python/tests/test_strategy_v2_order_gateway.py` (modified, +78/-11)
```diff
@@ -32,19 +32,26 @@ def __exit__(self, *_args):
     def cursor(self):
         return self._cursor
 
+    def commit(self):
+        return None
+
 
-def _request(action="open_long"):
+def _request(action="open_long", **overrides):
+    values = {
+        "strategy_id": 7,
+        "strategy_run_id": 42,
+        "user_id": 12,
+        "symbol": "BTC/USDT",
+        "action": action,
+        "quantity": 0.01,
+        "reference_price": 60_000.0,
+        "signal_timestamp": 123,
+        "market_type": "swap",
+        "execution_mode": "live",
+    }
+    values.update(overrides)
     return LiveOrderRequest(
-        strategy_id=7,
-        strategy_run_id=42,
-        user_id=12,
-        symbol="BTC/USDT",
-        action=action,
-        quantity=0.01,
-        reference_price=60_000.0,
-        signal_timestamp=123,
-        market_type="swap",
-        execution_mode="live",
+        **values,
     )
 
 
@@ -89,3 +96,63 @@ def create_intent(self, **_kwargs):
 
     monkeypatch.setattr(live_execution, "OrderIntentService", _IntentService)
     assert StrategyV2OrderGateway().submit(_request()) is None
+
+
+def test_ai_rejection_is_latched_until_the_signal_disappears(monkeypatch):
+    decisions = []
+    next_intent_id = iter((91, 92))
+
+    class _IntentService:
+        def __init__(self, **_kwargs):
+            pass
+
+        @staticmethod
+        def build_signal_idempotency_key(**kwargs):
+            return f"signal-{kwargs['signal_ts']}"
+
+        def create_intent(self, **_kwargs):
+            return SimpleNamespace(
+                id=next(next_intent_id),
+                existing=False,
+                status="intent_created",
+            )
+
+    class _RejectingFilter:
+        @staticmethod
+        def evaluate(request, *, enabled):
+            decisions.append((request.action, enabled))
+            return SimpleNamespace(allowed=False)
+
+    monkeypatch.setattr(live_execution, "OrderIntentService", _IntentService)
+    monkeypatch.setattr(
+        live_execution,
+        "get_db_connection",
+        lambda: _Db(_Cursor({})),
+    )
+    gateway = StrategyV2OrderGateway(decision_filter_factory=_RejectingFilter)
+    request = _request(ai_decision_filter=True, reason="dual_ma_open_long")
+
+    gateway.begin_signal_cycle(42)
+    assert gateway.submit(request) is None
+    gateway.finish_signal_cycle(42)
+
+    gateway.begin_signal_cycle(42)
+    assert gateway.submit(_request(
+        ai_decision_filter=True,
+        reason="dual_ma_open_long",
+        signal_timestamp=124,
+    )) is None
+    gateway.finish_signal_cycle(42)
+    assert decisions == [("open_long", True)]
+
+    gateway.begin_signal_cycle(42)
+    gateway.finish_signal_cycle(42)
+
+    gateway.begin_signal_cycle(42)
+    assert gateway.submit(_request(
+        ai_decision_filter=True,
+        reason="dual_ma_open_long",
+        signal_timestamp=125,
+    )) is None
+    gateway.finish_signal_cycle(42)
+    assert decisions == [("open_long", True), ("open_long", True)]
```

#### Recent Merged Pull Requests:
- **PR #264** (closed): feat(backtest): add benchmark-relative information ratio metrics (@ZhangWT02)
- **PR #262** (closed): chore(deps): bump the python-runtime group across 1 directory with 18 updates (@dependabot[bot])
- **PR #261** (closed): chore(deps): bump github/codeql-action from 4.37.3 to 4.38.0 (@dependabot[bot])
- **PR #250** (closed): fix: merge US stock 3m bars returned by the Yahoo chart (@Dev-next-gen)
- **PR #249** (2026-09-17): fix: catch up weekly and monthly schedules missed at a period boundary (@Dev-next-gen)
- **PR #246** (2026-09-16): fix: keep HTX spot frozen balance in the owned base inventory (@Dev-next-gen)
- **PR #243** (2026-09-13): fix: infer Bybit, Bitget and Binance precision from Decimal exponent (@Dev-next-gen)
- **PR #240** (closed): chore(deps): bump the python-runtime group across 1 directory with 15 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
