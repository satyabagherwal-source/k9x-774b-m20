# Forensic Learning Record (Deep Inspection): OpenByteInc/QuantDinger

> **Canonical Artifact**: `07_PROJECT_LEARNING/openbyteinc-quantdinger-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/OpenByteInc/QuantDinger](https://github.com/OpenByteInc/QuantDinger))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:18:08.760Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `OpenByteInc/QuantDinger`
- **Description**: Open-source AI Trading OS, agent trading, and vibe trading, with Jev System One integration. Research, build Python strategies, backtest, and paper/live trade across crypto, stocks, and forex. Launch your own multi-tenant trading SaaS with built-in user management, billing, payments, and settlement.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12475 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend_api_python/app/commands/kafka_audit_worker.py`
```
"""Independent consumer that validates active Kafka runtime events."""

from __future__ import annotations

import os
import time


def main() -> None:
    os.environ["QD_PROCESS_ROLE"] = "kafka-audit"

    from app import create_app
    from app.events.kafka import KafkaEventConsumer
    from app.events.protocol import (
        EventEnvelope,
        MarketBarClosedV1,
        StrategyEvaluationBatchV1,
    )
    from app.events.topics import topic_for_event
    from app.runtime.process import ShutdownSignal
    from app.services.strategy_command_repository import StrategyCommandRepository
    from app.utils.logger import get_logger
    from app.workers.trading import build_worker_id

    logger = get_logger(__name__)
    app = create_app(register_http_routes=False)
    shutdown = ShutdownSignal()
    shutdown.install()
    repository = StrategyCommandRepository()
    worker_id = build_worker_id()
    consumer = KafkaEventConsumer(
        topics=[
            topic_for_event(MarketBarClosedV1.event_type),
            topic_for_event(StrategyEvaluationBatchV1.event_type),
        ],
        group_id=os.getenv("KAFKA_AUDIT_GROUP_ID", "quantdinger-runtime-audit-v1"),
    )
    last_event: dict[str, object] = {}
    last_heartbeat = 0.0

    def handle(event: EventEnvelope) -> bool:
        payload = event.payload
        if event.event_type == MarketBarClosedV1.event_type:
            required = (
                "venue",
                "market_type",
                "instrument_id",
                "timeframe",
                "closed_bar_token",
            )
        elif event.event_type == StrategyEvaluationBatchV1.event_type:
            required = (
                "strategy_shard",
                "strategy_ids",
                "source_event_id",
                "timeframe",
                "closed_bar_token",
            )
            if not isinstance(payload.get("strategy_ids"), list) or not payload["strategy_ids"]:
                raise ValueError(f"kafkaAudit.invalidStrategyBatch:{event.event_id}")
        else:
            logger.warning("Unexpected runtime event type: %s", event.event_type)
            return True
        if any(payload.get(field) in (None, "") for field in required):
            raise ValueError(f"kafkaAudit.invalidEvent:{event.event_id}")
        last_event.clear()
        last_event.update({
            "last_event_id": event.event_id,
            "last_event_type": event.event_type,
            "last_partition_key": event.partition_key,
            "last_occurred_at": event.occurred_at,
        })
        return True

    with app.app_context():
        try:
            logger.info("Kafka audit worker started: %s", worker_id)
            while not shutdown.event.is_set():
                consumer.poll_once(handle, timeout=1.0)
                now = time.monotonic()
                if now - last_heartbeat >= 10.0:
                    repository.record_worker_heartbeat(
                        worker_id=worker_id,
                        role="kafka-audit",
                        metadata={**consumer.snapshot(), **last_event},
                    )
                    last_heartbeat = now
        finally:
            consumer.close()
            repository.mark_worker_stopped(worker_id)
            logger.info("Kafka audit worker stopped: %s", worker_id)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `backend_api_python/app/commands/strategy_dispatcher_worker.py`
```
"""Kafka worker that maps market events to strategy-shard evaluation batches."""

from __future__ import annotations

import os
import time


def main() -> None:
    os.environ["QD_PROCESS_ROLE"] = "strategy-dispatcher"

    from app import create_app
    from app.events.dispatcher import StrategyDueDispatcher
    from app.events.kafka import KafkaEventConsumer
    from app.events.protocol import MarketBarClosedV1
    from app.events.topics import topic_for_event
    from app.runtime.process import ShutdownSignal
    from app.services.strategy_command_repository import StrategyCommandRepository
    from app.utils.logger import get_logger
    from app.workers.trading import build_worker_id

    logger = get_logger(__name__)
    app = create_app(register_http_routes=False)
    shutdown = ShutdownSignal()
    shutdown.install()
    heartbeat_repository = StrategyCommandRepository()
    worker_id = build_worker_id()
    dispatcher = StrategyDueDispatcher()
    consumer = KafkaEventConsumer(
        topics=[topic_for_event(MarketBarClosedV1.event_type)],
        group_id=os.getenv(
            "KAFKA_STRATEGY_DISPATCH_GROUP_ID",
            "quantdinger-strategy-dispatch-v1",
        ),
    )
    last_heartbeat = 0.0

    with app.app_context():
        try:
            logger.info("Strategy dispatcher worker started: %s", worker_id)
            while not shutdown.event.is_set():
                consumer.poll_once(dispatcher.dispatch, timeout=1.0)
                now = time.monotonic()
                if now - last_heartbeat >= 10.0:
                    heartbeat_repository.record_worker_heartbeat(
                        worker_id=worker_id,
                        role="strategy-dispatcher",
                        metadata={**consumer.snapshot(), **dispatcher.snapshot()},
                    )
                    last_heartbeat = now
        finally:
            consumer.close()
            dispatcher.close()
            heartbeat_repository.mark_worker_stopped(worker_id)
            logger.info("Strategy dispatcher worker stopped: %s", worker_id)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `backend_api_python/app/commands/strategy_evaluator_worker.py`
```
"""Active evaluator worker with durable inbox and shard fencing."""

from __future__ import annotations

import os
import time


def main() -> None:
    os.environ["QD_PROCESS_ROLE"] = "strategy-evaluator"

    from app import create_app
    from app.events.evaluator import StrategyEvaluationBatchHandler
    from app.events.kafka import KafkaEventConsumer
    from app.events.protocol import StrategyEvaluationBatchV1
    from app.events.topics import topic_for_event
    from app.runtime.process import ShutdownSignal
    from app.services.strategy_command_repository import StrategyCommandRepository
    from app.utils.logger import get_logger
    from app.workers.trading import build_worker_id

    logger = get_logger(__name__)
    app = create_app(register_http_routes=False)
    shutdown = ShutdownSignal()
    shutdown.install()
    heartbeat_repository = StrategyCommandRepository()
    worker_id = build_worker_id()
    group_id = os.getenv(
        "KAFKA_STRATEGY_EVALUATOR_GROUP_ID",
        "quantdinger-strategy-evaluator-active-v1",
    )
    handler = StrategyEvaluationBatchHandler(
        owner_id=worker_id,
        consumer_group=group_id,
    )
    consumer = KafkaEventConsumer(
        topics=[topic_for_event(StrategyEvaluationBatchV1.event_type)],
        group_id=group_id,
        on_partitions_revoked=handler.release_partition_keys,
    )
    last_heartbeat = 0.0

    with app.app_context():
        try:
            logger.info(
                "Strategy evaluator worker started: worker=%s mode=%s",
                worker_id,
                handler.mode,
            )
            while not shutdown.event.is_set():
                consumer.poll_once(handler.handle, timeout=1.0)
                now = time.monotonic()
                if now - last_heartbeat >= 10.0:
                    if handler.runtime_host is not None:
                        local_ids = handler.runtime_host.local_strategy_ids()
                        running_ids = set(
                            handler.subscriptions.running_strategy_ids(local_ids)
                        )
                        handler.runtime_host.reconcile(running_ids)
                    heartbeat_repository.record_worker_heartbeat(
                        worker_id=worker_id,
                        role="strategy-evaluator",
                        metadata={**consumer.snapshot(), **handler.snapshot()},
                    )
                    last_heartbeat = now
        finally:
            consumer.close()
            handler.close()
            heartbeat_repository.mark_worker_stopped(worker_id)
            logger.info("Strategy evaluator worker stopped: %s", worker_id)


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
    parser.add_argument(
        "role",
        choices=(
            "trading",
            "scheduler",
            "celery",
            "kafka-audit",
            "strategy-dispatcher",
            "strategy-evaluator",
        ),
    )
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

### Core Architecture Module: `backend_api_python/app/services/grid/engine.py`
```
"""Grid engine: resting limit orders, cell pairing, initial position."""

from __future__ import annotations

import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from app.services.grid.config import GridBotConfig
from app.services.grid.exchange_orders import (
    cancel_grid_order,
    execute_grid_market_order,
    make_grid_client_order_id,
    make_grid_initial_client_order_id,
    normalize_grid_order_quantity,
    place_grid_limit_order,
    query_grid_order_fill,
    wait_grid_market_fill,
)
from app.services.grid.fill_handler import record_grid_market_fill
from app.services.grid.levels import GridCellSpec, generate_cells, generate_levels
from app.services.grid.resting_orders_repo import GridRestingOrder, GridRestingOrderRepository
from app.services.grid.runtime_state import load_grid_resting_state, persist_grid_resting_state
from app.services.live_trading.grid_cells import GridCellRepository, GridCellState
from app.services.live_trading.limit_price_safety import (
    is_marketable_limit_price,
    normalize_marketable_limit_price,
)
from app.utils.logger import get_logger
from app.utils.strategy_runtime_logs import append_strategy_log

logger = get_logger(__name__)

MarketSignalFn = Callable[[str, float, float, str], bool]
# (signal_type, usdt_amount, price, reason) -> success


class GridEngine:
    def __init__(
        self,
        strategy_id: int,
        symbol: str,
        trading_config: Dict[str, Any],
        exchange_config: Dict[str, Any],
        *,
        user_id: int = 1,
        create_client_fn: Callable[[], Any],
        enqueue_market: MarketSignalFn,
    ) -> None:
        self.strategy_id = int(strategy_id)
        self.user_id = int(user_id or 1)
        self.symbol = str(symbol or "")
        self.trading_config = trading_config if isinstance(trading_config, dict) else {}
        self.exchange_config = exchange_config if isinstance(exchange_config, dict) else {}
        self.cfg = GridBotConfig.from_trading_config(self.trading_config)
        self._create_client = create_client_fn
        self._enqueue_market = enqueue_market
        self.order_guard = None
        self._orders = GridRestingOrderRepository()
        self._cells = GridCellRepository()
        self._bootstrapped = False
        self._initial_done = False
        self._paused_entries = False
        self._runtime_params: Dict[str, Any] = {}
        gs = load_grid_resting_state(self.trading_config)
        if gs.get("initial_market_done"):
            self._initial_done = True
        baseline = gs.get("initial_exchange_baseline")
        self._initial_exchange_baseline = (
            {
                "long": max(0.0, float((baseline or {}).get("long") or 0.0)),
                "short": max(0.0, float((baseline or {}).get("short") or 0.0)),
            }
            if isinstance(baseline, dict)
            else {}
        )
        seeded = gs.get("initial_seeded_cells")
        self._initial_seeded_cells = {
            int(index)
            for index in (seeded if isinstance(seeded, list) else [])
            if str(index).lstrip("-").isdigit()
        }
        self._consecutive_order_errors = 0
        self._stop_requested = False
        self._stop_reason = ""
        self._last_initial_attempt_ts = 0.0
        self._initial_retry_sec = 30.0
        self._initial_market_attempts = 0
        self._initial_market_max_attempts = 3
        self._last_entry_order_ts = 0.0
        self._entry_ownership_cache: Dict[str, Tuple[float, bool, Dict[str, Any]]] = {}
        self._ownership_check_errors: set[str] = set()
        self._exchange_open_orders_cache: Optional[Tuple[float, List[Dict[str, Any]]]] = None
        self._exchange_reservation_logged: set[str] = set()
        self._last_reduce_only_conflict_ts = 0.0
        self._last_market_price = 0.0
        self._startup_initial_fills: List[Dict[str, Any]] = []

    @property
    def stop_requested(self) -> bool:
        return bool(self._stop_requested)

    @property
    def stop_reason(self) -> str:
        return str(self._stop_reason or "")

    def _record_order_error(self, purpose: str, exc: Exception) -> None:
        if self._stop_requested:
            return
        msg = str(exc or "")
        logger.warning(
            "Grid place limit failed sid=%s cell purpose=%s: %s",
            self.strategy_id,
            purpose,
            msg,
        )
        from app.services.strategy_lifecycle import is_recoverable_position_error

        recoverable = is_recoverable_position_error(msg)
        lower_msg = msg.lower()
        if "-2022" in lower_msg or "reduceonly order is rejected" in lower_msg:
            self._exchange_open_orders_cache = None
            self._last_reduce_only_conflict_ts = time.time()
        append_strategy_log(self.strategy_id, "warning" if recoverable else "error", f"Grid limit failed {purpose}: {msg}")
        if recoverable:
            self._consecutive_order_errors = 0
            return
        self._consecutive_order_errors += 1
        try:
            from app.services.strategy_lifecycle import maybe_auto_stop_on_exchange_error

            threshold = 5
            try:
                import os

                threshold = max(1, int(os.getenv("GRID_ORDER_ERROR_STOP_THRESHOLD", "5")))
            except Exception:
                threshold = 5
            if maybe_auto_stop_on_exchange_error(
                self.strategy_id,
                msg,
                source="grid_order",
                consecutive_failures=self._consecutive_order_errors,
                consecutive_threshold=threshold,
                perform_stop=False,
            ):
                self._stop_requested = True
                self._paused_entries = True
                self._stop_reason = "exchange error while placing grid resting order"
        except Exception as e:
            logger.debug("grid auto-stop check sid=%s: %s", self.strategy_id, e)

    def _initial_capital_usdt(self) -> float:
        init_cap = float(self.trading_config.get("initial_capital") or 0)
        if init_cap <= 0:
            init_cap = float(self.trading_config.get("_grid_budget") or 0)
        if init_cap <= 0:
            cell_budget = self._grid_budget_usdt() * self.cfg.tradable_cell_count
            init_cap = cell_budget if self.cfg.grid_count_unit == "cells" else cell_budget * 2
        return init_cap

    def _grid_budget_usdt(self, cell_index: Optional[int] = None) -> float:
        if cell_index is not None and 0 <= int(cell_index) < len(self.cfg.cell_budget_pcts):
            pct = max(0.0, float(self.cfg.cell_budget_pcts[int(cell_index)] or 0.0))
            if pct <= 0:
                return 0.0
        else:
            pct = max(0.0, float(self.cfg.amount_per_grid_pct or 0.0))
        if pct > 0:
            capital = float(
                self.trading_config.get("initial_capital")
                or self.trading_config.get("_grid_budget")
                or 0.0
            )
            if capital > 0:
                return capital * pct
        return max(0.0, float(self.cfg.amount_per_grid or 0.0))

    def set_runtime_params(self, params: Dict[str, Any]) -> None:
        self._runtime_params = dict(params or {})

    def actor_snapshot(self) -> Dict[str, Any]:
        return {
            "bootstrapped": bool(self._bootstrapped),
            "initial_done": bool(self._initial_done),
            "paused_entries": bool(self._paused_entries),
            "runtime_params": dict(self._runtime_params),
            "stop_requested": bool(self._stop_requested),
            "stop_reason": str(self._stop_reason or ""),
            "last_market_price": float(self._last_market_price or 0.0),
            "consecutive_order_errors": int(self._consecutive_order_errors or 0),
        }

    def restore_actor_snapshot(self, state: Dict[str, Any]) -> None:
        if not isinstance(state, dict) or not state:
            return
        self._bootstrapped = bool(state.get("bootstrapped", self._bootstrapped))
        self._initial_done = bool(state.get("initial_done", self._initial_done))
        self._paused_entries = bool(state.get("paused_entries", self._paused_entries))
        runtime_params = state.get("runtime_params")
        if isinstance(runtime_params, dict):
            self._runtime_params = dict(runtime_params)
        self._stop_requested = bool(state.get("stop_requested", self._stop_requested))
        self._stop_reason = str(state.get("stop_reason") or self._stop_reason or "")
        try:
            self._last_market_price = max(
                0.0,
                float(state.get("last_market_price") or self._last_market_price or 0.0),
            )
        except (TypeError, ValueError):
            pass
        try:
            self._consecutive_order_errors = max(
                0,
                int(state.get("consecutive_order_errors") or 0),
            )
        except (TypeError, ValueError):
            pass

    def _observe_market_price(self, price: float) -> None:
        value = float(price or 0.0)
        if value > 0:
            self._last_market_price = value

    def _qty_from_usdt(self, usdt: float, price: float) -> float:
        if price <= 0 or usdt <= 0:
            return 0.0
        lev = self.cfg.leverage if self.cfg.market_type != "spot" else 1.0
        return float(usdt) * lev / float(price)

    def _levels_and_cells(self) -> Tuple[List[float], List[GridCellSpec]]:
        upper, lower = self.cfg.effective_bounds(self._runtime_params)
        levels = generate_levels(lower, upper, self.cfg.grid_line_count, self.cfg.grid_mode)
        return levels, generate_cells(levels)

    def bootstrap(self, current_price: float) -> Tuple[bool, str]:
        if current_price <= 0:
            return False, "invalid price"
        self._observe_market_price(current_price)
        levels, cells = self._levels_and_cells()
        if not cells:
            return False, "failed to generate g
```

### Core Architecture Module: `backend_api_python/app/services/grid/runtime_state.py`
```
"""Persist grid resting runtime flags in trading_config.script_runtime_state."""

from __future__ import annotations

import json
from typing import Any, Dict

from app.utils.db import get_db_connection
from app.utils.logger import get_logger

logger = get_logger(__name__)

_GRID_STATE_KEY = "grid_resting"


def load_grid_resting_state(trading_config: Dict[str, Any]) -> Dict[str, Any]:
    tc = trading_config if isinstance(trading_config, dict) else {}
    raw = tc.get("script_runtime_state") or {}
    if isinstance(raw, str) and raw.strip():
        try:
            raw = json.loads(raw)
        except Exception:
            raw = {}
    if not isinstance(raw, dict):
        return {}
    gs = raw.get(_GRID_STATE_KEY)
    return dict(gs) if isinstance(gs, dict) else {}


def persist_grid_resting_state(strategy_id: int, updates: Dict[str, Any]) -> None:
    if not updates:
        return
    try:
        with get_db_connection() as db:
            cur = db.cursor()
            cur.execute("SELECT trading_config FROM qd_strategies_trading WHERE id = %s", (int(strategy_id),))
            row = cur.fetchone()
            if not row:
                cur.close()
                return
            tc = row.get("trading_config")
            if isinstance(tc, str) and tc.strip():
                try:
                    tc = json.loads(tc)
                except Exception:
                    tc = {}
            elif not isinstance(tc, dict):
                tc = {}
            raw = tc.get("script_runtime_state") or {}
            if isinstance(raw, str) and raw.strip():
                try:
                    raw = json.loads(raw)
                except Exception:
                    raw = {}
            if not isinstance(raw, dict):
                raw = {}
            gs = raw.get(_GRID_STATE_KEY)
            merged = dict(gs) if isinstance(gs, dict) else {}
            merged.update(updates)
            raw[_GRID_STATE_KEY] = merged
            tc["script_runtime_state"] = raw
            cur.execute(
                "UPDATE qd_strategies_trading SET trading_config = %s WHERE id = %s",
                (json.dumps(tc, ensure_ascii=False), int(strategy_id)),
            )
            db.commit()
            cur.close()
    except Exception as e:
        logger.warning("persist_grid_resting_state sid=%s: %s", strategy_id, e)

```

### Core Architecture Module: `backend_api_python/app/services/notifications/webhook.py`
```
from __future__ import annotations

import base64
import hmac
import hashlib
import json
import time
import urllib.parse
from typing import Any, Dict, List, Tuple


_WEBHOOK_DIALECT_PATTERNS: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("feishu", (
        "open.feishu.cn/open-apis/bot/v2/hook/",
        "open.larksuite.com/open-apis/bot/v2/hook/",
        "open.larkoffice.com/open-apis/bot/v2/hook/",
        "www.larksuite.com/open-apis/bot/v2/hook/",
    )),
    ("dingtalk", ("oapi.dingtalk.com/robot/send",)),
    ("wecom", ("qyapi.weixin.qq.com/cgi-bin/webhook/send",)),
    ("slack", ("hooks.slack.com/services/",)),
)


def detect_webhook_dialect(url: str) -> str:
    """Return a vendor dialect name, or ``generic`` for self-hosted endpoints."""
    lowered = (url or "").lower()
    for dialect, prefixes in _WEBHOOK_DIALECT_PATTERNS:
        if any(prefix in lowered for prefix in prefixes):
            return dialect
    return "generic"


def shorten(value: str, limit: int = 4000) -> str:
    text = str(value or "")
    return text if len(text) <= limit else (text[:limit] + "...")


def format_float(value: Any, *, max_decimals: int = 10) -> str:
    try:
        number = float(value or 0.0)
    except Exception:
        number = 0.0
    text = f"{number:.{max_decimals}f}".rstrip("0").rstrip(".")
    return text or "0"


def build_webhook_text(payload: Dict[str, Any]) -> Tuple[str, str]:
    """Distill an internal signal payload into plain title/body text."""
    data = payload or {}
    explicit_title = str(data.get("title") or "").strip()
    explicit_msg = str(data.get("message") or "").strip()
    if explicit_title or explicit_msg:
        return (explicit_title or "QuantDinger"), (explicit_msg or "")

    strategy = data.get("strategy") or {}
    instrument = data.get("instrument") or {}
    signal = data.get("signal") or {}
    order = data.get("order") or {}

    strategy_name = str(strategy.get("name") or "").strip()
    symbol = str(instrument.get("symbol") or "").strip()
    signal_type = str(signal.get("type") or signal.get("action") or "").strip()
    side = str(signal.get("side") or "").strip()

    title_bits: List[str] = []
    if strategy_name:
        title_bits.append(strategy_name)
    if symbol:
        title_bits.append(symbol)
    if signal_type:
        title_bits.append(signal_type.upper())
    title = " · ".join(title_bits) if title_bits else "QuantDinger Signal"

    body_lines: List[str] = []
    if strategy_name:
        body_lines.append(f"Strategy: {strategy_name}")
    if symbol:
        body_lines.append(f"Symbol: {symbol}")
    if signal_type:
        body_lines.append(f"Signal: {signal_type}")
    if side:
        body_lines.append(f"Side: {side}")
    try:
        ref_price = float(order.get("ref_price") or 0)
        if ref_price > 0:
            body_lines.append(f"Price: {format_float(ref_price)}")
    except Exception:
        pass
    try:
        stake = float(order.get("stake_amount") or 0)
        if stake > 0:
            body_lines.append(f"Amount: {format_float(stake)}")
    except Exception:
        pass
    timestamp = str(data.get("timestamp_iso") or "").strip()
    if timestamp:
        body_lines.append(f"Time: {timestamp}")

    if not body_lines:
        body_lines.append(shorten(json.dumps(data, ensure_ascii=False), 800))
    return title, "\n".join(body_lines)


def adapt_payload_for_dialect(dialect: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Translate the internal payload to the vendor's required JSON schema."""
    title, body = build_webhook_text(payload)

    if dialect == "feishu":
        return {"msg_type": "text", "content": {"text": f"{title}\n{shorten(body)}"}}
    if dialect == "dingtalk":
        return {
            "msgtype": "markdown",
            "markdown": {"title": shorten(title, 64), "text": f"### {title}\n\n{shorten(body)}"},
        }
    if dialect == "wecom":
        return {"msgtype": "markdown", "markdown": {"content": f"### {title}\n\n{shorten(body, 4000)}"}}
    if dialect == "slack":
        return {"text": f"*{title}*\n{shorten(body)}"}
    return payload


def feishu_sign(secret: str, timestamp_str: str) -> str:
    """Return the Feishu/Lark custom-bot HMAC signature."""
    key = f"{timestamp_str}\n{secret}".encode("utf-8")
    digest = hmac.new(key, b"", hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


def dingtalk_signed_url(url: str, secret: str) -> str:
    """Append DingTalk custom-bot signature query parameters to a webhook URL."""
    ts_ms = str(int(time.time() * 1000))
    string_to_sign = f"{ts_ms}\n{secret}"
    digest = hmac.new(secret.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha256).digest()
    sign = urllib.parse.quote_plus(base64.b64encode(digest).decode("utf-8"))
    separator = "&" if ("?" in url) else "?"
    return f"{url}{separator}timestamp={ts_ms}&sign={sign}"


def check_vendor_response(dialect: str, status_code: int, text: str) -> Tuple[bool, str]:
    """Normalize vendor webhook response bodies into success/error results."""
    if status_code < 200 or status_code >= 300:
        return False, f"http_{status_code}:{shorten(text, 300)}"

    body = (text or "").strip()
    if dialect == "slack":
        ok = body.lower() == "ok" or body.startswith("{")
        return ok, "" if ok else f"slack_unexpected:{shorten(body, 300)}"

    if dialect in ("feishu", "dingtalk", "wecom"):
        if not body or not body.startswith("{"):
            return True, ""
        try:
            obj = json.loads(body)
        except Exception:
            return True, ""
        code = obj.get("code", obj.get("errcode", obj.get("StatusCode")))
        if code in (0, "0", None):
            return True, ""
        msg = obj.get("msg") or obj.get("errmsg") or ""
        return False, f"{dialect}_error:code={code}:{shorten(msg, 200)}"

    return True, ""

```

### Core Architecture Module: `backend_api_python/app/services/pending_order_loops.py`
```
"""Independent order dispatch and exchange reconciliation loops."""
from app.utils.logger import get_logger

logger = get_logger(__name__)


class PendingOrderLoops:
    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._tick()
            except Exception as e:
                logger.warning(f"PendingOrderWorker tick error: {e}")
            self._stop_event.wait(self.poll_interval_sec)

    def _run_sync_loop(self) -> None:
        while not self._stop_event.is_set():
            for sync in (self._sync_quick_trade_orders, self._sync_alpaca_sent_orders, self._sync_live_sent_orders, self._maybe_sync_positions):
                if self._stop_event.is_set() or (self.lease_guard and not self.lease_guard()):
                    break
                try:
                    sync()
                except Exception:
                    logger.warning("Order reconciliation failed: %s", sync.__name__, exc_info=True)
            self._stop_event.wait(self.poll_interval_sec)

    def _tick(self) -> None:
        if self.lease_guard and not self.lease_guard():
            return
        orders = self._fetch_pending_orders(limit=self.batch_size)
        if not orders:
            return

        for o in orders:
            if self._stop_event.is_set() or (self.lease_guard and not self.lease_guard()):
                break
            oid = o.get("id")
            if not oid:
                continue

            # Mark processing (best-effort)
            if not self._mark_processing(order_id=int(oid)):
                continue

            try:
                self._dispatch_one(o)
            except Exception as e:
                self._mark_failed(order_id=int(oid), error=str(e))


```

### Core Architecture Module: `backend_api_python/app/services/pending_order_worker.py`
```
"""
Pending order worker.

This worker polls `pending_orders` periodically and dispatches orders based on `execution_mode`:
- signal: fill the isolated virtual account and send notifications.
- live: dispatch normalized live orders through exchange and broker clients.
"""

from __future__ import annotations

import json
from app.services.strategy_runtime.cancellations import dispatch_requested_cancel
import os
import re
import threading
import time
from dataclasses import replace
from typing import Any, Dict, List, Optional, Tuple

from app.services.signal_notifier import SignalNotifier
from app.services.instrument_rules import get_instrument_rules_provider
from app.services.exchange_execution import load_strategy_configs, resolve_exchange_config, safe_exchange_config_for_log
from app.services.live_trading.execution import place_order_from_signal
from app.services.live_trading.factory import create_client
from app.services.live_trading.records import (
    ensure_position_ledger_schema,
    normalize_strategy_symbol,
    strategy_allowed_symbols,
)
from app.services.live_trading.account_configuration import (
    requires_derivatives_account_configuration,
)
from app.services.live_trading.strategy_position_sync import (
    strategy_uses_fill_ledger,
)
from app.services.live_trading.account_positions import (
    account_legs_from_exchange_maps,
    sync_account_positions,
)
from app.services.live_trading.adapters import LiveOrderPhaseAdapter
from app.services.live_trading.contracts import OrderIntent
from app.services.live_trading.executors import (
    LimitThenMarketExecutor,
    MarketOrderExecutor,
    RestingLimitExecutor,
)
from app.services.live_trading.leg_context import credential_id_from_exchange_config
from app.services.live_trading.position_query import resolve_reduce_only_quantity
from app.services.live_trading.position_ownership import supports_position_coexistence
from app.utils.pnl import calc_notional_value
from app.utils.numeric_precision import format_decimal
from app.services.live_trading.base import LiveTradingError, is_file_descriptor_exhausted
from app.services.pending_orders.fill_records import (
    persist_strategy_fill, proportional_spot_position_fill_quantity,
    trade_close_reason_from_payload,
)
from app.services.pending_orders.fee_reconciliation import (
    allow_fee_reconciliation_attempt,
    commission_snapshot as _commission_snapshot,
    fee_breakdown_snapshot as _fee_breakdown_snapshot,
    fee_breakdown_to_quote,
    fee_storage_values,
    incremental_fees,
    previous_commission as _previous_commission,
    previous_fee_breakdown as _previous_fee_breakdown,
)
from app.services.pending_orders.live_order_support import (
    FillAccumulator,
    LiveOrderNotifier,
    LiveOrderRejected,
    apply_execution_result,
    bind_instrument_product_contract,
    build_live_order_context,
    console_print,
    make_client_order_id,
    signal_to_side_pos_reduce,
)
from app.services.pending_orders.live_order_phases import (
    maker_limit_price,
    wait_live_order_fill,
)
from app.services.pending_orders.entry_position_guard import (
    evaluate_entry_position_guard,
    strategy_allows_simultaneous_legs as _strategy_allows_simultaneous_legs,
)
from app.services.grid.exchange_orders import query_grid_order_fill
from app.services.pending_orders.position_sync_cache import (
    exchange_sync_backoff_sec,
    get_position_sync_snapshot,
    invalidate_position_sync_snapshot_for_exchange,
    is_exchange_rate_limit_error,
    is_exchange_sync_backoff,
    position_sync_cache_key,
    set_exchange_sync_backoff,
    set_position_sync_snapshot,
)
from app.services.pending_order_position_sync import PendingOrderPositionSyncMixin
from app.services.pending_orders.sent_order_recovery import (
    is_final_fill, normalize_live_order_status,
    tracked_fill_baseline,
)
from app.services.pending_orders.order_quantities import (
    exchange_quantity_snapshot,
    reconciled_queue_status,
)
from app.services.pending_orders.broker_support import (
    broker_order_type as _broker_order_type,
    broker_protection_prices as _broker_protection_prices,
    redact_exchange_json as _redact_exchange_json,
)
from app.services.pending_orders.submission_recovery import SubmissionRecoveryMixin
from app.services.pending_orders.claims import claim_pending_order
from app.services.live_trading.binance import BinanceFuturesClient
from app.services.live_trading.binance_spot import BinanceSpotClient
from app.services.live_trading.okx import OkxClient
from app.services.live_trading.bitget import BitgetMixClient
from app.services.live_trading.bitget_spot import BitgetSpotClient
from app.services.live_trading.bybit import BybitClient
from app.services.live_trading.gate import GateSpotClient, GateUsdtFuturesClient
from app.services.live_trading.htx import HtxClient
from app.utils.db import get_db_connection
from app.services.pending_order_loops import PendingOrderLoops
from app.utils.logger import get_logger
from app.utils.strategy_runtime_logs import append_strategy_log
from app.services.strategy_lifecycle import (
    auto_stop_live_strategy,
    is_fatal_exchange_error,
    should_skip_position_sync,
)

# Lazy import IBKR to avoid ImportError if ib_insync not installed
IBKRClient = None


# Lazy import Alpaca to avoid ImportError if alpaca-py not installed
AlpacaClient = None

logger = get_logger(__name__)

ALPACA_FILL_DELTA_EPSILON = 1e-8


class PendingOrderWorker(
    SubmissionRecoveryMixin,
    PendingOrderLoops,
    PendingOrderPositionSyncMixin,
):
    def __init__(self, poll_interval_sec: float = 1.0, batch_size: int = 50):
        self.poll_interval_sec = float(poll_interval_sec)
        self.batch_size = int(batch_size)
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._sync_thread: Optional[threading.Thread] = None
        self.lease_guard = None
        self._lock = threading.Lock()
        self._notifier = SignalNotifier()
        self._instrument_rules = get_instrument_rules_provider()

        # Reclaim stuck orders (e.g. if the worker crashed after claiming an order).
        try:
            self._stale_processing_sec = int(os.getenv("PENDING_ORDER_STALE_SEC", "90"))
        except Exception:
            self._stale_processing_sec = 90
        self._fee_sync_retry_sec = max(60, int(os.getenv("LIVE_FEE_SYNC_RETRY_SEC", "300")))
        self._fee_sync_batch_per_account = max(1, int(os.getenv("LIVE_FEE_SYNC_BATCH_PER_ACCOUNT", "5")))
        # Position sync self-check (best-effort): keep local positions aligned with exchange.
        self._position_sync_enabled = os.getenv("POSITION_SYNC_ENABLED", "true").lower() == "true"
        self._position_sync_interval_sec = float(os.getenv("POSITION_SYNC_INTERVAL_SEC", "30"))
        self._last_position_sync_ts = 0.0
        self._exchange_catchups: set[tuple[str, int, str]] = set()
        self._last_stream_audit: Dict[tuple[str, int, str, int], float] = {}
        self._stream_audit_sec = max(10.0, float(os.getenv("EXECUTION_STREAM_REST_AUDIT_SEC", "30")))
        logger.info(f"PendingOrderWorker: sync_enabled={self._position_sync_enabled}, interval={self._position_sync_interval_sec}s")

    def request_exchange_catchup(
        self,
        *,
        exchange_id: str,
        credential_id: int,
        market_type: str,
    ) -> None:
        key = (
            str(exchange_id or "").lower(),
            int(credential_id or 0),
            str(market_type or "").lower(),
        )
        with self._lock:
            self._exchange_catchups.add(key)

    def start(self) -> bool:
        with self._lock:
            if self._thread and self._thread.is_alive() and self._sync_thread and self._sync_thread.is_alive():
                return True
            try:
                ensure_position_ledger_schema()
            except Exception as e:
                logger.warning("ensure_position_ledger_schema failed: %s", e)
            self._stop_event.clear()
            if not self._thread or not self._thread.is_alive():
                self._thread = threading.Thread(target=self._run_loop, name="PendingOrderWorker", daemon=True)
                self._thread.start()
            if not self._sync_thread or not self._sync_thread.is_alive():
                self._sync_thread = threading.Thread(target=self._run_sync_loop, name="PendingOrderReconciliation", daemon=True)
                self._sync_thread.start()
            logger.info("PendingOrderWorker started")
            return True

    def stop(self, timeout_sec: float = 5.0) -> None:
        with self._lock:
            self._stop_event.set()
            th = self._thread
        if th and th.is_alive():
            th.join(timeout=timeout_sec)
        if self._sync_thread and self._sync_thread.is_alive():
            self._sync_thread.join(timeout=timeout_sec)
        logger.info("PendingOrderWorker stopped")

    def _sync_quick_trade_orders(self, limit: int = 50) -> None:
        """Reconcile non-terminal Quick Trade orders and protect new fills."""
        try:
            with get_db_connection() as db:
                cur = db.cursor()
                cur.execute(
                    """
                    SELECT *
                    FROM qd_quick_trades
                    WHERE status IN ('submitted', 'partially_filled')
                      AND (
                            COALESCE(exchange_order_id, '') <> ''
                            OR COALESCE(client_order_id, '') <> ''
                          )
                      AND created_at >= NOW() - INTERVAL '7 days'
                    ORDER BY created_at ASC, id ASC
                    LIMIT %s
                    """,
                    (int(limit),),
                )
                rows = cur.fetchall() or []
                cur.close()
        except Exception as exc:
            logger.debug("Quick Trade reconciliation query failed: %s", exc)
            return
```

### Core Architecture Module: `backend_api_python/app/services/strategy_evolution/engine.py`
```
"""Optimization engine independent from HTTP and existing backtest routes."""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable
from dataclasses import asdict
from datetime import datetime
from statistics import mean, median
from time import perf_counter
from typing import Any

from .constraints import ParameterConstraint, first_rejection
from .models import EvolutionConfig, SearchParameter
from .search import ParameterSampler
from .statistics import (
    composite_score,
    deflated_sharpe,
    equity_returns,
    metric_snapshot,
    monte_carlo_bootstrap,
    parameter_heatmap,
    probability_of_backtest_overfitting,
    sample_sharpe,
)
from .walk_forward import WalkForwardFold, build_walk_forward_plan


Evaluator = Callable[[dict[str, Any], datetime, datetime, float, float], dict[str, Any]]
ProgressCallback = Callable[[dict[str, Any]], None]


class StrategyEvolutionFailure(ValueError):
    """A user-facing evolution failure with structured diagnostics."""

    def __init__(self, code: str, details: dict[str, Any]) -> None:
        super().__init__(code)
        self.code = code
        self.details = details


class StrategyEvolutionEngine:
    def __init__(self, evaluator: Evaluator) -> None:
        self.evaluator = evaluator

    def run(
        self,
        *,
        parameters: list[SearchParameter],
        config: EvolutionConfig,
        start_date: datetime,
        end_date: datetime,
        commission: float,
        slippage: float,
        constraints: tuple[ParameterConstraint, ...] = (),
        on_progress: ProgressCallback | None = None,
    ) -> dict[str, Any]:
        started_at = perf_counter()
        if not parameters:
            raise ValueError("strategyEvolution.parametersRequired")
        if len(parameters) > 8:
            raise ValueError("strategyEvolution.parameterLimitExceeded")
        context_provider = getattr(self.evaluator, "walk_forward_context", None)
        walk_forward_context = (
            context_provider(start_date, end_date)
            if callable(context_provider)
            else {}
        )
        plan = build_walk_forward_plan(
            start_date,
            end_date,
            folds=config.folds,
            train_ratio=config.train_ratio,
            blind_ratio=config.blind_ratio,
            observations=walk_forward_context.get("observations"),
            warmup_bars=max(
                int(walk_forward_context.get("warmupBars") or 0),
                _parameter_lookback_bars(parameters),
            ),
            embargo_bars=config.embargo_bars,
        )
        sampler = ParameterSampler(parameters, seed=config.seed)
        grid = sampler.grid(config.trials) if config.method == "grid" else []
        trial_count = len(grid) if config.method == "grid" else config.trials
        history: list[tuple[dict[str, Any], float]] = []
        trials: list[dict[str, Any]] = []
        seen: set[tuple[tuple[str, str], ...]] = set()
        for trial_index in range(trial_count):
            params = self._candidate(config, sampler, grid, history, trial_index)
            identity = tuple(sorted((str(key), repr(value)) for key, value in params.items()))
            rejection = first_rejection(constraints, params)
            if rejection is not None:
                trial = self._skipped_trial(trial_index + 1, params, "parameterConstraint")
                trial["constraint"] = rejection.metadata()
            elif identity in seen:
                trial = self._skipped_trial(trial_index + 1, params, "duplicateCandidate")
            else:
                seen.add(identity)
                trial = self._evaluate_trial(
                    trial_index + 1,
                    params,
                    plan.folds,
                    config,
                    commission,
                    slippage,
                    [float(row[1]) for row in history],
                )
            trials.append(trial)
            if not trial["pruned"]:
                history.append((params, float(trial["score"])))
            if on_progress:
                on_progress({
                    "phase": "search",
                    "completed": trial_index + 1,
                    "total": trial_count,
                    "bestScore": max((row["score"] for row in trials if not row["pruned"]), default=0.0),
                })
        completed = sorted(
            (row for row in trials if not row["pruned"] and row["components"].get("validationActivity", 0) > 0),
            key=lambda row: row["score"],
            reverse=True,
        )
        if not completed:
            raise StrategyEvolutionFailure(
                "strategyEvolution.allTrialsPruned",
                self._failure_diagnostics(trials),
            )
        best = completed[0]
        blind_result = None
        if plan.blind_start and plan.blind_end:
            blind_result = self.evaluator(best["params"], plan.blind_start, plan.blind_end, commission, slippage)
        final_result = blind_result or best["validationResults"][-1]
        diagnostic_results = list(best["validationResults"])
        if blind_result:
            diagnostic_results.append(blind_result)
        returns = [
            value
            for diagnostic_result in diagnostic_results
            for value in equity_returns(diagnostic_result.get("equityCurve") or [])
        ]
        score_matrix = [[float(item["score"]) for item in row["folds"] if "score" in item] for row in completed]
        pbo = probability_of_backtest_overfitting(score_matrix)
        dsr = deflated_sharpe(
            returns,
            observed_sharpe=sample_sharpe(returns),
            trials=len(completed),
        )
        monte_carlo = monte_carlo_bootstrap(
            returns,
            paths=config.monte_carlo_paths,
            block_size=config.block_size,
            seed=config.seed + 991,
        )
        cost_stress = self._cost_stress(
            best["params"],
            plan.blind_start or start_date,
            plan.blind_end or end_date,
            commission,
            slippage,
            config.cost_multipliers,
        )
        robustness = self._robustness_grade(pbo, dsr, monte_carlo, cost_stress)
        return {
            "status": "complete",
            "method": config.method,
            "config": asdict(config),
            "plan": {
                **plan.metadata(),
                "frequency": walk_forward_context.get("frequency"),
            },
            "summary": {
                "bestScore": best["score"],
                "robustnessScore": robustness["score"],
                "robustnessGrade": robustness["grade"],
                "availableChecks": robustness["availableChecks"],
                "totalChecks": robustness["totalChecks"],
                "oosReturn": best["components"]["oosReturn"],
                "oosSharpe": best["components"]["oosSharpe"],
                "maxDrawdown": best["components"]["maxDrawdown"],
                "decayRate": best["components"]["decayRate"],
                "completedTrials": len(completed),
                "prunedTrials": sum(1 for row in trials if row["pruned"]),
                "constraintRejectedTrials": sum(1 for row in trials if row.get("reason") == "parameterConstraint"),
                "duplicateTrials": sum(1 for row in trials if row.get("reason") == "duplicateCandidate"),
                "actualBacktestRuns": self._evaluation_count(),
                "elapsedSeconds": round(perf_counter() - started_at, 2),
            },
            "bestParams": best["params"],
            "trials": [self._public_trial(row) for row in trials],
            "topCandidates": [self._public_trial(row) for row in completed[: config.top_candidates]],
            "convergence": self._convergence(trials),
            "heatmap": parameter_heatmap(trials),
            "equityCurve": final_result.get("equityCurve") or [],
            "validation": {
                "pbo": pbo,
                "deflatedSharpe": dsr,
                "monteCarlo": monte_carlo,
                "costStress": cost_stress,
            },
            "constraints": [constraint.metadata() for constraint in constraints],
        }

    def _evaluate_trial(
        self,
        number: int,
        params: dict[str, Any],
        folds: tuple[WalkForwardFold, ...],
        config: EvolutionConfig,
        commission: float,
        slippage: float,
        prior_scores: list[float],
    ) -> dict[str, Any]:
        train_metrics: list[dict[str, float]] = []
        validation_metrics: list[dict[str, float]] = []
        validation_results: list[dict[str, Any]] = []
        fold_rows: list[dict[str, Any]] = []
        pruned = False
        evaluate_plan = getattr(self.evaluator, "evaluate_plan", None)
        prepared_results = evaluate_plan(params, folds, commission, slippage) if callable(evaluate_plan) else None
        for fold_index, fold in enumerate(folds):
            if prepared_results is not None:
                train_result, validation_result = prepared_results[fold_index]
            else:
                train_result = self.evaluator(params, fold.train_start, fold.train_end, commission, slippage)
                validation_result = self.evaluator(params, fold.validation_start, fold.validation_end, commission, slippage)
            train_metric = metric_snapshot(train_result)
            validation_metric = metric_snapshot(validation_result)
            train_metrics.append(train_metric)
            validation_metrics.append(validation_metric)
            validation_results.append(validation_result)
            partial_score, _ = composite_score(train_metrics, validation_metrics, config.weights)
            fold_rows.append({
                **fold.metadata(),
                "train": train_metric,
                "validation": validation_metric,
                "score": validation_metric["return"],
```

### Core Architecture Module: `backend_api_python/app/services/strategy_lifecycle.py`
```
"""
Unified auto-stop for live strategies after fatal exchange/auth/connectivity errors.

Position sync and order workers call `auto_stop_live_strategy` so DB status, executor
threads, and runtime logs stay consistent (avoids endless retry spam after restart).
"""

from __future__ import annotations

import threading
from typing import Set

from app.utils.db import get_db_connection
from app.utils.logger import get_logger
from app.utils.strategy_runtime_logs import append_strategy_log

logger = get_logger(__name__)

_quiet_lock = threading.Lock()
_quiet_sids: Set[int] = set()


def is_fatal_exchange_error(msg: str) -> bool:
    """Return True when the strategy should not keep retrying exchange/private APIs."""
    m = (msg or "").lower()
    if not m:
        return False
    if "unsupported market type" in m or "unsupported market" in m:
        return True
    tokens = (
        # Programming/adapter contract failures are deterministic. Retrying on
        # every candle can enqueue an entire robot order ladder without any
        # chance of recovery until the service is upgraded.
        "got an unexpected keyword argument",
        "missing 1 required positional argument",
        "binance http 401",
        '"code":-2015',
        "-2015",
        "okx http 401",
        '"code":"50111"',
        "50111",
        "invalid api-key",
        "invalid api key",
        "invalid ok-access-key",
        "invalid ip",
        "invalid_ip",
        "40018",
        "permissions for action",
        "unauthorized",
        "forbidden",
        " http 401",
        "authentication",
        "signature mismatch",
        "invalid_signature",
        "permission denied",
        "connection refused",
        "connect call failed",
        "errno 111",
        "make sure api port on tws",
        "failed to connect to ibkr",
        "ibkr connection failed",
        "live trading error",
        "single-asset collateral mode is temporarily unavailable",
        "disabled ibkr",
        "已关闭 ibkr",
        "missing okx",
        "api_key/secret_key",
        "secret_key/passphrase",
        "missing api_key",
        "missing secret",
        "missing passphrase",
        "missing credential",
        "no credential",
        "exchange credential",
        "unsupported client for grid",
    )
    return any(t in m for t in tokens)


def is_recoverable_position_error(reason: str) -> bool:
    from app.services.pending_orders.error_classification import is_exchange_price_band_error

    if is_exchange_price_band_error(reason):
        return True
    return not is_fatal_exchange_error(reason) and any(code in str(reason or "").lower() for code in (
        "position_drift_detected", "minimum_trade_unit", "min_notional",
        "position_ownership_drift", "target_already_met",
        "below step/min", "below lot step/minqty", "below min/precision",
        "below mintradeusdt/precision",
        '"code":-2022', "'code': -2022", "'code':-2022",
        '"code":-4118', "'code': -4118", "'code':-4118",
        "reduceonly order is rejected", "reduce only order is rejected",
        "reduceonly order failed", "reduce only order failed",
    ))


def maybe_auto_stop_on_exchange_error(
    strategy_id: int,
    msg: str,
    *,
    source: str = "exchange",
    consecutive_failures: int = 0,
    consecutive_threshold: int = 5,
    perform_stop: bool = True,
) -> bool:
    """
    Stop a live strategy after a fatal exchange/auth error or repeated failures.
    Returns True if auto-stop was triggered (or already quieted for this run).
    """
    sid = int(strategy_id or 0)
    if sid <= 0:
        return False
    reason = (msg or "").strip()
    if not reason:
        return False
    if is_fatal_exchange_error(reason):
        if perform_stop:
            auto_stop_live_strategy(sid, reason, source=source)
        return True
    if is_recoverable_position_error(reason):
        # Reject the individual entry/undersized order while keeping position
        # monitoring and reduce-only protection alive.
        return False
    if consecutive_failures >= max(1, int(consecutive_threshold or 5)):
        if perform_stop:
            auto_stop_live_strategy(
                sid,
                f"Repeated exchange errors ({consecutive_failures}): {reason}",
                source=source,
            )
        return True
    return False


def should_skip_position_sync(strategy_id: int) -> bool:
    """In-process guard: skip sync for strategies already auto-stopped this run."""
    with _quiet_lock:
        return int(strategy_id) in _quiet_sids


def auto_stop_live_strategy(
    strategy_id: int,
    reason: str,
    *,
    source: str = "position_sync",
) -> bool:
    """
    Mark strategy stopped in DB, stop executor thread if running, append runtime log.
    Safe to call multiple times for the same strategy_id.
    """
    sid = int(strategy_id)
    if sid <= 0:
        return False

    reason = (reason or "").strip() or "fatal exchange error"
    with _quiet_lock:
        already = sid in _quiet_sids
        _quiet_sids.add(sid)
    if already:
        return True

    log_msg = f"Auto-stopped ({source}): {reason}"
    logger.error("[Strategy %s] %s", sid, log_msg)
    try:
        append_strategy_log(sid, "error", log_msg)
    except Exception:
        pass

    try:
        with get_db_connection() as db:
            cur = db.cursor()
            cur.execute(
                "UPDATE qd_strategies_trading SET status = 'stopped' WHERE id = %s",
                (sid,),
            )
            db.commit()
            cur.close()
    except Exception as e:
        logger.warning("auto_stop: DB update failed for strategy %s: %s", sid, e)

    try:
        from app import get_trading_executor

        get_trading_executor().stop_strategy(sid)
    except Exception as e:
        logger.debug("auto_stop: executor stop_strategy(%s): %s", sid, e)

    return True

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

### Incident Patch 1: `972b119a` (2026-10-05)
**Commit Message**: fix: improve live trading errors and position modes

**File**: `backend_api_python/app/routes/strategy_logs_routes.py` (modified, +6/-0)
```diff
@@ -3,6 +3,7 @@
 
 from app.routes.strategy_blueprint import strategy_blp
 from app.routes.strategy_services import get_strategy_service
+from app.services.pending_orders.error_classification import classify_strategy_exchange_log
 from app.utils.auth import login_required
 from app.utils.db import get_db_connection
 from app.utils.logger import get_logger
@@ -73,6 +74,11 @@ def get_strategy_logs():
                 rr['message'] = str(
                     market_data_error.get('message') or 'No usable market data is available.'
                 )
+            else:
+                exchange_error = classify_strategy_exchange_log(msg)
+                if exchange_error:
+                    rr['event_type'] = 'exchange_error'
+                    rr['exchange_error'] = exchange_error
             ts = rr.get('timestamp')
             if ts is not None:
                 from app.utils.timeutil import to_utc_iso
```

**File**: `backend_api_python/app/services/pending_orders/error_classification.py` (modified, +155/-13)
```diff
@@ -6,6 +6,28 @@
 from typing import Any
 
 
+EXCHANGE_IDS = ("binance", "okx", "gate", "bybit", "bitget", "htx", "alpaca", "ibkr")
+
+
+def _has_error_code(text: str, *codes: str) -> bool:
+    """Match codes in common exchange error fields without matching prices/quantities."""
+    return any(
+        re.search(
+            rf"(?:s?code|retcode|error(?:\s+code)?)\s*['\" :=-]*{re.escape(code)}(?!\d)",
+            text,
+        )
+        for code in codes
+    )
+
+
+def _detect_exchange(text: str) -> str:
+    lower = text.lower()
+    for exchange_id in EXCHANGE_IDS:
+        if re.search(rf"(?<![a-z]){re.escape(exchange_id)}(?![a-z])", lower):
+            return exchange_id
+    return "exchange"
+
+
 def is_exchange_price_band_error(error: Any) -> bool:
     """Recognize dynamic exchange price-band rejections across adapters."""
     lower = str(error or "").strip().lower()
@@ -65,23 +87,143 @@ def classify_exchange_order_error(error: Any) -> dict[str, Any]:
     lower = raw.lower()
     http_match = re.search(r"\bhttp\s+(\d{3})\b|\b(5\d{2})\s+(?:bad gateway|gateway timeout|service unavailable)\b", lower)
     http_status = int(next((value for value in (http_match.groups() if http_match else ()) if value), 0) or 0)
+    exchange_id = _detect_exchange(raw)
+
+    def result(category: str, *, retryable: bool = False) -> dict[str, Any]:
+        return {
+            "category": category,
+            "retryable": retryable,
+            "http_status": http_status,
+            "exchange": exchange_id,
+            "raw": raw,
+        }
+
+    if (
+        http_status == 401
+        or _has_error_code(lower, "-1002", "-1022", "-2014", "-2015", "10003", "10004", "10005", "10007", "10010", "33004", "50103", "50104", "50105", "50106", "40002", "40003", "40005", "40009", "40018")
+        or any(token in lower for token in (
+            "invalid api-key", "invalid api key", "api key is invalid", "api-key format invalid",
+            "api key has expired", "permission denied", "invalid signature", "error sign",
+            "user authentication failed", "unmatched ip", "invalid ip", "ip whitelist",
+            "ip not whitelisted", "not_login", "unauthorized",
+        ))
+    ):
+        return result("credentials")
+    if (
+        _has_error_code(lower, "-1021", "10002", "50102")
+        or any(token in lower for token in ("invalid timestamp", "request time exceeds", "outside of the recvwindow", "timestamp request expired"))
+    ):
+        return result("clock_skew")
+    if (
+        http_status == 429
+        or _has_error_code(lower, "-1003", "-1008", "-1015", "10006", "10429", "20003", "50011", "429")
+        or any(token in lower for token in (
+            "rate limit", "rate_limit", "too many request", "too many visits",
+            "request_frequency", "operation too frequent", "max rate of messages",
+        ))
+    ):
+        return result("rate_limit", retryable=True)
+    if (
+        _has_error_code(lower, "-1121", "10029", "25100", "200")
+        or any(token in lower for token in (
+            "invalid symbol", "bad_symbol", "contract_not_found", "trading pair does not exist",
+            "no security definition has been found", "symbol is invalid",
+        ))
+    ):
+        return result("invalid_symbol")
     if http_status >= 500 or any(token in lower for token in (
         "bad gateway", "gateway timeout", "service unavailable", "connection reset",
         "connection timed out", "timeout waiting for response", "temporarily unavailable",
     )):
-        return {"category": "transport", "retryable": True, "http_status": http_status, "raw": raw}
+        return result("transport", retryable=True)
     if is_exchange_price_band_error(raw):
-        return {"category": "price_band", "retryable": True, "http_status": http_status, "raw": raw}
-    if any(token in lower for token in (
-        "insufficient_available", "insufficient balance", "insufficient margin",
-        "not enough balance", "margin insufficient",
-    )):
-        return {"category": "insufficient_funds", "retryable": False, "http_status": http_status, "raw": raw}
-    if re.search(r"below|step|minqty|min qty|minsize|min size|min_notional|minnotional|invalid (qty|quantity|size|amount)", lower):
-        return {"category": "order_size", "retryable": False, "http_status": http_status, "raw": raw}
-    if any(token in lower for token in ("position mode", "margin mode", "leverage")):
-        return {"category": "account_configuration", "retryable": False, "http_status": http_status, "raw": raw}
-    return {"category": "exchange_rejected", "retryable": False, "http_status": http_status, "raw": raw}
+        return result("price_band", retryable=True)
+    if (
+        _has_error_code(lower, "-2018", "-2019", "110004", "110006", "110007", "110012", "110044", "110045", "110051", "110052", "110053", "51008", "25202", "25203", "40310000")
+        or any(token in lower for token in (
+          
```

**File**: `backend_api_python/app/services/strategy_ai_capabilities.py` (modified, +2/-2)
```diff
@@ -127,9 +127,9 @@ def metadata(self) -> dict[str, Any]:
 - `direction_mode` is strategy capability metadata. `position_side` is the concrete `long` or `short` hedge leg on a position read or order. They are not interchangeable.
 - `one_way` means one signed net position. Use `get_position(symbol)` and omit `position_side` from every order. Positive targets open or maintain long exposure; negative targets open or maintain short exposure; close the current position before opening the opposite side.
 - For `long_only`, `short_only`, `both`, and `neutral`, every `get_position(...)` and order call for a swap instrument must explicitly pass `position_side="long"` or `position_side="short"` (a variable resolving to one of those values is also valid).
-- In hedge mode, `get_position(symbol)` is not a synthetic net position. Read each owned leg explicitly and test `abs(position.amount)`.
+- For `long_only`, `short_only`, `both`, and `neutral`, hedge-account positions remain explicit legs. A `one_way` strategy is the exception: the runtime exposes its single active strategy-owned leg through the signed `get_position(symbol)` view on either account mode.
 - Short targets use negative quantity, value, or percent while still declaring `position_side="short"`. Closing either leg uses a zero target for that same `position_side`.
-- `one_way` requires exchange one-way mode in live trading. `both` and `neutral` require exchange hedge mode. `allow_leverage` remains a separate source permission and must never be multiplied into order sizing.
+- `one_way` is account-mode adaptive in live trading: the runtime uses a net position on one-way accounts and routes the active leg explicitly on hedge accounts while preventing simultaneous strategy-owned legs. `both` and `neutral` still require exchange hedge mode. `allow_leverage` remains a separate source permission and must never be multiplied into order sizing.
 """,
         repair="""
 - For `one_way`, remove `position_side` and implement signed net-position reversal. For all hedge-leg modes, add an explicit valid `position_side` to every Crypto swap position read and order.
```

**File**: `backend_api_python/app/services/strategy_runtime/live_portfolio.py` (modified, +31/-4)
```diff
@@ -39,18 +39,45 @@ def refresh_members(service, candidates, manifest, user_id, strategy_id, now, ex
 
 def positions_by_symbol(executor, strategy_id, candidates, strategy):
     from app.services.strategy_live_guard import resolve_strategy_direction_mode
-    owns_both = resolve_strategy_direction_mode(strategy or {}) in {'both', 'neutral'}
+    direction_mode = resolve_strategy_direction_mode(strategy or {})
+    strategy_config = strategy or {}
+    trading_config = strategy_config.get('trading_config') or {}
+    if not isinstance(trading_config, dict):
+        trading_config = {}
+    default_market_type = str(
+        trading_config.get('market_type')
+        or strategy_config.get('market_type')
+        or 'spot'
+    ).strip().lower()
     grouped = defaultdict(list)
     for row in executor._get_current_positions(strategy_id, None):
         grouped[str(row.get('symbol') or '').split(':')[0]].append(row)
     output = {}
     for member in candidates:
         rows = grouped.get(str(member.get('symbol') or '').split(':')[0], [])
-        for row in rows if owns_both else rows[:1]:
+        market_type = str(member.get('market_type') or default_market_type).strip().lower()
+        if market_type in {'future', 'futures', 'perp', 'perpetual'}:
+            market_type = 'swap'
+        explicit_legs = market_type == 'swap' and direction_mode in {
+            'long_only', 'short_only', 'both', 'neutral',
+        }
+        owned_sides = (
+            {'long'} if direction_mode == 'long_only'
+            else {'short'} if direction_mode == 'short_only'
+            else {'long', 'short'}
+        )
+        selected_rows = (
+            [
+                row for row in rows
+                if ('short' if row.get('side') == 'short' else 'long') in owned_sides
+            ]
+            if explicit_legs else rows[:1]
+        )
+        for row in selected_rows:
             side = 'short' if row.get('side') == 'short' else 'long'
-            key = member['key'] + (f'::{side}' if owns_both else '')
+            key = member['key'] + (f'::{side}' if explicit_legs else '')
             output[key] = dict(amount=row.get('size') or 0, side=side,
-                position_side=side if owns_both else '', avg_cost=row.get('entry_price') or 0,
+                position_side=side if explicit_legs else '', avg_cost=row.get('entry_price') or 0,
                 last_price=row.get('current_price') or 0)
     return output
 
```

**File**: `backend_api_python/app/services/trading_executor.py` (modified, +16/-6)
```diff
@@ -336,15 +336,25 @@ def _preflight_live_strategy(self, strategy_id: int) -> None:
         owns_both_legs = direction_mode in {"both", "neutral"} or neutral_grid
         if owns_both_legs and is_hedge is not True:
             raise RuntimeError(f"strategyV2.dualDirectionHedgeModeRequired:{label}")
-        if direction_mode == "one_way" and is_hedge is True:
-            raise RuntimeError(f"strategyV2.oneWayPositionModeRequired:{label}")
-        if is_hedge is not True:
-            if is_hedge is None:
-                raise RuntimeError(f"strategyV2.hedgeModeUnknown:{label}")
+        if is_hedge is None:
+            raise RuntimeError(f"strategyV2.hedgeModeUnknown:{label}")
+
+        # ``one_way`` describes a strategy that owns one signed exposure and
+        # never keeps long and short open together. It does not require the
+        # exchange account itself to use net-position mode: the pending-order
+        # worker maps every action to the correct LONG/SHORT leg in hedge mode,
+        # while reversal execution closes and synchronizes before re-entry.
+        # Only fixed-side strategies may share opposite hedge-account legs; a
+        # reversing strategy continues to reserve the whole instrument.
+        allow_opposite_leg = (
+            is_hedge is True
+            and direction_mode in {"long_only", "short_only"}
+            and not neutral_grid
+        )
         conflict = find_live_strategy_conflict(
             strategy,
             user_id,
-            allow_opposite_leg=is_hedge is True and not owns_both_legs,
+            allow_opposite_leg=allow_opposite_leg,
         )
         if conflict:
             raise RuntimeError(live_conflict_message(conflict))
```

**File**: `backend_api_python/migrations/strategy_v2_templates.sql` (modified, +7/-5)
```diff
@@ -53,9 +53,10 @@ def handle_data(context, data):
         order_target_percent(g.symbol, 0.0, reason="single_ma_exit")
 $single$, '{"params":[{"name":"ma_period","type":"integer","default":50,"min":2,"max":250,"step":1,"labelKey":"strategyV2.params.maPeriod","descriptionKey":"strategyV2.params.maPeriodDesc"},{"name":"target_pct","type":"percent","default":0.95,"min":0.05,"max":1,"step":0.05,"labelKey":"strategyV2.params.targetPosition","descriptionKey":"strategyV2.params.targetPositionDesc"}]}'::jsonb, '["strategy-v2","cta","moving-average","us-stock"]'::jsonb, 'line-chart', 'green', 10, TRUE, '{"source":"system_seed","version":11,"apiVersion":2}'::jsonb, NOW()),
 
-('strategy_v2_double_ma', 'script', 'Dual Moving Average', 'A parameterized BTC perpetual dual moving-average strategy with optional leverage.', $double$"""
+('strategy_v2_double_ma', 'script', 'Dual Moving Average', 'A BTC perpetual single-position long/short reversal strategy that adapts to one-way and hedge-mode accounts.', $double$"""
 Dual Moving Average
-BTC perpetual trend strategy with configurable long and short regimes.
+BTC perpetual single-position trend strategy with configurable long and short regimes.
+Live execution adapts automatically to one-way or hedge-mode exchange accounts.
 """
 
 # @param fast_period int 20 range=2:100:1
@@ -102,7 +103,7 @@ def handle_data(context, data):
             order_target_percent(g.symbol, -target_pct, reason="dual_ma_open_short")
         elif not allow_short and short_open:
             order_target_percent(g.symbol, 0.0, reason="dual_ma_close_short_disabled")
-$double$, '{"params":[{"name":"fast_period","type":"integer","default":20,"min":2,"max":100,"step":1,"labelKey":"trading-assistant.templateParam.fast_period.label","descriptionKey":"trading-assistant.templateParam.fast_period.desc"},{"name":"slow_period","type":"integer","default":60,"min":5,"max":300,"step":1,"labelKey":"trading-assistant.templateParam.slow_period.label","descriptionKey":"trading-assistant.templateParam.slow_period.desc"},{"name":"target_pct","type":"percent","default":0.95,"min":0.05,"max":1,"step":0.05,"labelKey":"strategyV2.params.targetPosition","descriptionKey":"strategyV2.params.targetPositionDesc"},{"name":"allow_short","type":"boolean","default":true,"labelKey":"strategyV2.params.allowShort","descriptionKey":"strategyV2.params.allowShortDesc"}]}'::jsonb, '["strategy-v2","cta","moving-average","crypto","swap","one-way"]'::jsonb, 'swap', 'blue', 20, TRUE, '{"source":"system_seed","version":12,"apiVersion":2}'::jsonb, NOW()),
+$double$, '{"params":[{"name":"fast_period","type":"integer","default":20,"min":2,"max":100,"step":1,"labelKey":"trading-assistant.templateParam.fast_period.label","descriptionKey":"trading-assistant.templateParam.fast_period.desc"},{"name":"slow_period","type":"integer","default":60,"min":5,"max":300,"step":1,"labelKey":"trading-assistant.templateParam.slow_period.label","descriptionKey":"trading-assistant.templateParam.slow_period.desc"},{"name":"target_pct","type":"percent","default":0.95,"min":0.05,"max":1,"step":0.05,"labelKey":"strategyV2.params.targetPosition","descriptionKey":"strategyV2.params.targetPositionDesc"},{"name":"allow_short","type":"boolean","default":true,"labelKey":"strategyV2.params.allowShort","descriptionKey":"strategyV2.params.allowShortDesc"}]}'::jsonb, '["strategy-v2","cta","moving-average","crypto","swap","single-position","account-mode-adaptive"]'::jsonb, 'swap', 'blue', 20, TRUE, '{"source":"system_seed","version":13,"apiVersion":2,"positionModeCompatibility":["one_way","hedge"]}'::jsonb, NOW()),
 
 ('strategy_v2_bullish_three_lines', 'script', 'Bullish Candle Through Three Averages', 'An A-share bullish candle breakout through three configurable averages.', $three$"""
 Bullish Candle Through Three Averages
@@ -301,9 +302,10 @@ def handle_data(context, data):
         order_target_percent(g.symbol, 0.0, reason="indicator_resonance_exit")
 $resonance$, '{"params":[{"name":"fast_period","type":"integer","default":12,"min":2,"max":100,"step":1,"labelKey":"trading-assistant.templateParam.fast_period.label"},{"name":"slow_period","type":"integer","default":26,"min":3,"max":200,"step":1,"labelKey":"trading-assistant.templateParam.slow_period.label"},{"name":"signal_period","type":"integer","default":9,"min":2,"max":100,"step":1,"labelKey":"strategyV2.params.signalPeriod"},{"name":"rsi_period","type":"integer","default":14,"min":2,"max":100,"step":1,"labelKey":"strategyV2.params.rsiPeriod"},{"name":"rsi_min","type":"number","default":50,"min":0,"max":100,"step":1,"labelKey":"strategyV2.params.rsiMin"},{"name":"rsi_max","type":"number","default":75,"min":0,"max":100,"step":1,"labelKey":"strategyV2.params.rsiMax"},{"name":"adx_period","type":"integer","default":14,"min":2,"max":100,"step":1,"labelKey":"strategyV2.params.adxPeriod"},{"name":"adx_min","type":"number","default":20,"min":0,"max":100,"step":1,"labelKey":"strategyV2.params.adxMin"},{"name":"target_pct","type
```

**File**: `backend_api_python/tests/test_hedged_live_strategy_contract.py` (modified, +77/-4)
```diff
@@ -182,7 +182,7 @@ def test_swap_preflight_accepts_one_way_strategy_on_net_account(monkeypatch):
     assert conflict_calls == [{"allow_opposite_leg": False}]
 
 
-def test_swap_preflight_rejects_one_way_strategy_on_hedge_account(monkeypatch):
+def test_swap_preflight_accepts_one_way_strategy_on_hedge_account_and_reserves_symbol(monkeypatch):
     from app.services.grid import exchange_requirements
     from app.services.live_trading import factory
     from app.services import exchange_execution
@@ -193,7 +193,12 @@ def test_swap_preflight_rejects_one_way_strategy_on_hedge_account(monkeypatch):
         "_load_strategy",
         lambda _sid: _strategy(20, "", direction_mode="one_way"),
     )
-    monkeypatch.setattr(strategy_live_guard, "find_live_strategy_conflict", lambda *_args, **_kwargs: None)
+    conflict_calls = []
+    monkeypatch.setattr(
+        strategy_live_guard,
+        "find_live_strategy_conflict",
+        lambda *_args, **kwargs: conflict_calls.append(kwargs) or None,
+    )
     monkeypatch.setattr(exchange_execution, "resolve_exchange_config", lambda *_args, **_kwargs: {"exchange_id": "okx"})
     monkeypatch.setattr(factory, "create_client", lambda *_args, **_kwargs: object())
     monkeypatch.setattr(
@@ -202,8 +207,8 @@ def test_swap_preflight_rejects_one_way_strategy_on_hedge_account(monkeypatch):
         lambda *_args, **_kwargs: (True, "okx_long_short_mode"),
     )
 
-    with pytest.raises(RuntimeError, match="strategyV2.oneWayPositionModeRequired"):
-        executor._preflight_live_strategy(20)
+    executor._preflight_live_strategy(20)
+    assert conflict_calls == [{"allow_opposite_leg": False}]
 
 
 def test_swap_preflight_accepts_confirmed_hedge_mode(monkeypatch):
@@ -308,6 +313,74 @@ def test_live_position_snapshot_keeps_both_owned_legs(monkeypatch):
     assert snapshot["Crypto:BTC/USDT@okx:swap::short"]["amount"] == pytest.approx(2.5)
 
 
+@pytest.mark.parametrize(
+    ("direction_mode", "side"),
+    [("long_only", "long"), ("short_only", "short")],
+)
+def test_fixed_side_swap_snapshot_keeps_explicit_position_leg(
+    monkeypatch,
+    direction_mode,
+    side,
+):
+    executor = TradingExecutor()
+    strategy = _strategy(26, side, direction_mode=direction_mode)
+    candidates = [{
+        "key": "Crypto:BTC/USDT@okx:swap",
+        "symbol": "BTC/USDT",
+        "market_type": "swap",
+    }]
+    monkeypatch.setattr(
+        executor,
+        "_get_current_positions",
+        lambda *_args: [{
+            "symbol": "BTC/USDT",
+            "side": side,
+            "size": 1.25,
+            "entry_price": 100,
+            "current_price": 101,
+        }],
+    )
+
+    snapshot = executor._positions_by_symbol(26, candidates, strategy=strategy)
+    key = f"Crypto:BTC/USDT@okx:swap::{side}"
+
+    assert set(snapshot) == {key}
+    assert snapshot[key]["amount"] == pytest.approx(1.25)
+    assert snapshot[key]["side"] == side
+    assert snapshot[key]["position_side"] == side
+
+
+@pytest.mark.parametrize("side", ["long", "short"])
+def test_one_way_position_snapshot_collapses_active_leg_without_hedge_suffix(
+    monkeypatch,
+    side,
+):
+    executor = TradingExecutor()
+    strategy = _strategy(26, "", direction_mode="one_way")
+    candidates = [{
+        "key": "Crypto:BTC/USDT@okx:swap",
+        "symbol": "BTC/USDT",
+    }]
+    monkeypatch.setattr(
+        executor,
+        "_get_current_positions",
+        lambda *_args: [{
+            "symbol": "BTC/USDT",
+            "side": side,
+            "size": 1.25,
+            "entry_price": 100,
+            "current_price": 101,
+        }],
+    )
+
+    snapshot = executor._positions_by_symbol(26, candidates, strategy=strategy)
+
+    assert set(snapshot) == {"Crypto:BTC/USDT@okx:swap"}
+    assert snapshot["Crypto:BTC/USDT@okx:swap"]["amount"] == pytest.approx(1.25)
+    assert snapshot["Crypto:BTC/USDT@okx:swap"]["side"] == side
+    assert snapshot["Crypto:BTC/USDT@okx:swap"]["position_side"] == ""
+
+
 def test_live_direction_guard_logs_warning_without_failing_runtime(monkeypatch):
     import app.services.trading_executor as trading_executor_module
 
```

**File**: `backend_api_python/tests/test_order_safety_helpers.py` (modified, +53/-1)
```diff
@@ -2,7 +2,10 @@
 
 import pytest
 
-from app.services.pending_orders.error_classification import classify_exchange_order_error
+from app.services.pending_orders.error_classification import (
+    classify_exchange_order_error,
+    classify_strategy_exchange_log,
+)
 from app.services.pending_orders.order_budget import strategy_order_budget_snapshot
 from app.services.pending_orders.order_quantities import (
     exchange_executable_base_quantity,
@@ -110,6 +113,55 @@ def test_dynamic_price_band_error_has_retryable_category(error):
     assert result["retryable"] is True
 
 
+@pytest.mark.parametrize(
+    ("message", "category", "exchange"),
+    [
+        (
+            'Auto-stopped (position_sync_binance): Binance HTTP 401: {"code":-2015,"msg":"Invalid API-key, IP, or permissions for action"}',
+            "credentials",
+            "binance",
+        ),
+        (
+            'Exchange order failed (gate BTC/USDT close_short): Gate HTTP 400: {"label":"MARKET_PRICE_TOO_DEVIATED","message":"price deviates too much"}',
+            "price_band",
+            "gate",
+        ),
+        (
+            'Exchange order failed (gate BTC/USDT open_short): Gate HTTP 400: {"label":"INSUFFICIENT_AVAILABLE","message":"margin 950 while available 800"}',
+            "insufficient_funds",
+            "gate",
+        ),
+        (
+            'Exchange order failed (bybit BTC/USDT open_long): Bybit error: {"retCode":10006,"retMsg":"Too many visits"}',
+            "rate_limit",
+            "bybit",
+        ),
+        (
+            'Exchange order failed (okx BTC/USDT open_long): OKX error: {"sCode":"50102","sMsg":"Timestamp request expired"}',
+            "clock_skew",
+            "okx",
+        ),
+    ],
+)
+def test_strategy_exchange_logs_have_stable_user_facing_categories(message, category, exchange):
+    result = classify_strategy_exchange_log(message)
+    assert result is not None
+    assert result["category"] == category
+    assert result["exchange"] == exchange
+    assert result["technical_detail"] == message
+
+
+def test_non_exchange_strategy_log_is_not_misclassified():
+    assert classify_strategy_exchange_log("Strategy runtime scheduled") is None
+
+
+def test_binance_max_leverage_error_is_risk_limit_not_balance_shortfall():
+    result = classify_exchange_order_error(
+        'Binance HTTP 400: {"code":-2027,"msg":"Exceeded the maximum allowable position at current leverage."}'
+    )
+    assert result["category"] == "risk_limit"
+
+
 def test_legacy_executor_type_routes_to_grid_engine():
     assert resolve_bot_type({"trading_config": {"executor_type": "grid"}}) == "grid"
     assert resolve_bot_type({"template_key": "robot_v2_layered_martingale"}) == "layered_martingale"
```

---

### Incident Patch 2: `db49a4c6` (2026-10-05)
**Commit Message**: fix: invalidate stale authentication sessions

**File**: `backend_api_python/app/services/user_service.py` (modified, +4/-1)
```diff
@@ -913,7 +913,10 @@ def reset_password(self, user_id: int, new_password: str) -> bool:
                 cur.execute(
                     """
                     UPDATE qd_users
-                    SET password_hash = ?, password_changed_at = NOW(), updated_at = NOW()
+                    SET password_hash = ?,
+                        password_changed_at = NOW(),
+                        token_version = COALESCE(token_version, 1) + 1,
+                        updated_at = NOW()
                     WHERE id = ?
                     """,
                     (password_hash, user_id),
```

**File**: `backend_api_python/tests/test_auth_security.py` (modified, +59/-0)
```diff
@@ -1,11 +1,15 @@
 """Regression tests for JWT forgery and authorization bypasses."""
 
 import datetime
+from contextlib import contextmanager
 
 import jwt
 from flask import Flask, jsonify
 
 from app.config.settings import Config
+from app.services import user_service as user_service_module
+from app.services.user_service import UserService
+from app.utils import db as db_module
 from app.utils import auth
 
 
@@ -136,6 +140,61 @@ def test_token_version_change_during_verification_is_rejected(monkeypatch):
     assert auth.verify_token(_encode(_claims(token_version=1))) is None
 
 
+def test_password_reset_invalidates_existing_token(monkeypatch):
+    state = {
+        "username": "victim",
+        "role": "user",
+        "status": "active",
+        "password_hash": "old-hash",
+        "token_version": 7,
+    }
+
+    class FakeCursor:
+        result = None
+
+        def execute(self, sql, params=()):
+            normalized = " ".join(sql.lower().split())
+            if normalized.startswith("update qd_users"):
+                state["password_hash"] = params[0]
+                if "token_version = coalesce(token_version, 1) + 1" in normalized:
+                    state["token_version"] = (state["token_version"] or 1) + 1
+                return
+            if "select username, role, status, token_version" in normalized:
+                self.result = dict(state)
+                return
+            raise AssertionError(f"Unexpected SQL: {normalized}")
+
+        def fetchone(self):
+            return self.result
+
+        def close(self):
+            pass
+
+    class FakeConnection:
+        def cursor(self):
+            return FakeCursor()
+
+        def commit(self):
+            pass
+
+    @contextmanager
+    def fake_connection():
+        yield FakeConnection()
+
+    monkeypatch.setattr(user_service_module, "get_db_connection", fake_connection)
+    monkeypatch.setattr(db_module, "get_db_connection", fake_connection)
+    monkeypatch.setattr(UserService, "_password_changed_column_ready", True)
+
+    service = UserService()
+    monkeypatch.setattr(service, "hash_password", lambda _: "new-hash")
+    token = auth.generate_token(1, "victim", "user", token_version=7)
+
+    assert service.reset_password(1, "new-password") is True
+    assert state["password_hash"] == "new-hash"
+    assert state["token_version"] == 8
+    assert auth.verify_token(token) is None
+
+
 def test_admin_required_uses_only_verified_database_role(monkeypatch):
     app = Flask(__name__)
 
```

---

### Incident Patch 3: `a5a9f4c7` (2026-10-01)
**Commit Message**: fix: upgrade pypdf security baseline

**File**: `backend_api_python/requirements.lock` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@ pygments==2.20.0
 pyjwt==2.15.0
 pyluach==2.3.0
 pyotp==2.10.0
-pypdf==6.16.2
+pypdf==6.19.0
 pyproject-hooks==1.2.0
 pysocks==1.7.1
 python-dateutil==2.9.0.post0
```

**File**: `backend_api_python/requirements.txt` (modified, +2/-2)
```diff
@@ -47,8 +47,8 @@ flask-smorest>=0.47.0,<0.48
 marshmallow>=4.3.0,<5
 PyYAML>=6.0.3
 # Server-side PDF export for AI analysis reports
-# PDF resource exhaustion and malformed-stream advisories; 6.16.2+
-pypdf>=6.16.2,<7
+# PDF parser security advisories; 6.19.0+
+pypdf>=6.19.0,<7
 reportlab>=5.0.0
 # Password hashing
 bcrypt>=5.0.0
```

---

### Incident Patch 4: `1de49655` (2026-10-01)
**Commit Message**: fix: prevent orphaned strategy orders

**File**: `backend_api_python/app/services/exchange_execution.py` (modified, +4/-1)
```diff
@@ -105,9 +105,12 @@ def load_strategy_configs(strategy_id: int) -> Dict[str, Any]:
             """,
             (int(strategy_id),),
         )
-        row = cur.fetchone() or {}
+        row = cur.fetchone()
         cur.close()
 
+    if not row:
+        raise LookupError("strategyV2.strategyNotFound")
+
     exchange_config = _safe_json_loads(row.get("exchange_config"), {})
     trading_config = _safe_json_loads(row.get("trading_config"), {})
 
```

**File**: `backend_api_python/app/services/strategy.py` (modified, +8/-1)
```diff
@@ -371,7 +371,14 @@ def _cleanup_strategy_references(cur, strategy_id: int) -> None:
             """,
             (strategy_id,),
         )
-        cur.execute("DELETE FROM pending_orders WHERE strategy_id = ?", (strategy_id,))
+        cur.execute(
+            """
+            DELETE FROM pending_orders
+            WHERE strategy_id = ?
+               OR (NULLIF(payload_json, '')::jsonb ->> 'strategy_id') = ?
+            """,
+            (strategy_id, str(strategy_id)),
+        )
         cur.execute("DELETE FROM qd_live_order_bindings WHERE strategy_id = ?", (strategy_id,))
         cur.execute(
             """
```

**File**: `backend_api_python/migrations/20261001_strategy_delete_cleanup.sql` (removed, +0/-174)
```diff
@@ -1,174 +0,0 @@
--- Remove stale strategy runtime data and make future strategy deletes atomic.
--- The same statements are included in init.sql for automatic upgrades.
-
-CREATE OR REPLACE FUNCTION qd_cleanup_deleted_strategy()
-RETURNS TRIGGER AS $$
-BEGIN
-    UPDATE qd_execution_events AS event
-    SET processed_at = COALESCE(event.processed_at, NOW()),
-        process_error = 'strategy_deleted',
-        next_attempt_at = NOW()
-    WHERE event.processed_at IS NULL
-      AND EXISTS (
-        SELECT 1
-        FROM qd_live_order_bindings AS binding
-        WHERE binding.strategy_id = OLD.id
-          AND binding.credential_id = event.credential_id
-          AND LOWER(binding.exchange_id) = LOWER(event.exchange_id)
-          AND (
-            (event.exchange_order_id <> '' AND binding.exchange_order_id = event.exchange_order_id)
-            OR (event.client_order_id <> '' AND binding.client_order_id = event.client_order_id)
-          )
-      );
-
-    DELETE FROM pending_orders WHERE strategy_id = OLD.id;
-    DELETE FROM qd_live_order_bindings WHERE strategy_id = OLD.id;
-    DELETE FROM strategy_runtime_locks
-    WHERE strategy_run_id IN (
-        SELECT id FROM strategy_runs WHERE strategy_id = OLD.id
-    );
-    DELETE FROM strategy_order_fills WHERE strategy_id = OLD.id;
-    DELETE FROM strategy_order_intents WHERE strategy_id = OLD.id;
-    DELETE FROM strategy_runtime_state WHERE strategy_id = OLD.id;
-    DELETE FROM strategy_runtime_events WHERE strategy_id = OLD.id;
-    DELETE FROM strategy_runs WHERE strategy_id = OLD.id;
-    DELETE FROM qd_strategy_commands WHERE strategy_id = OLD.id;
-    DELETE FROM qd_strategy_runtime_leases WHERE strategy_id = OLD.id;
-
-    UPDATE qd_backtest_runs SET strategy_id = NULL WHERE strategy_id = OLD.id;
-    UPDATE qd_backtest_trades SET strategy_id = NULL WHERE strategy_id = OLD.id;
-    UPDATE qd_indicator_codes SET source_strategy_id = NULL WHERE source_strategy_id = OLD.id;
-    RETURN OLD;
-END;
-$$ LANGUAGE plpgsql;
-
-DROP TRIGGER IF EXISTS trg_cleanup_deleted_strategy ON qd_strategies_trading;
-CREATE TRIGGER trg_cleanup_deleted_strategy
-BEFORE DELETE ON qd_strategies_trading
-FOR EACH ROW EXECUTE FUNCTION qd_cleanup_deleted_strategy();
-
-UPDATE qd_execution_events AS event
-SET processed_at = COALESCE(event.processed_at, NOW()),
-    process_error = 'strategy_deleted',
-    next_attempt_at = NOW()
-WHERE event.processed_at IS NULL
-  AND EXISTS (
-    SELECT 1
-    FROM qd_live_order_bindings AS binding
-    WHERE binding.strategy_id > 0
-      AND NOT EXISTS (
-        SELECT 1 FROM qd_strategies_trading AS strategy
-        WHERE strategy.id = binding.strategy_id
-      )
-      AND binding.credential_id = event.credential_id
-      AND LOWER(binding.exchange_id) = LOWER(event.exchange_id)
-      AND (
-        (event.exchange_order_id <> '' AND binding.exchange_order_id = event.exchange_order_id)
-        OR (event.client_order_id <> '' AND binding.client_order_id = event.client_order_id)
-      )
-  );
-
-DELETE FROM strategy_runtime_locks AS runtime_lock
-WHERE runtime_lock.strategy_run_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM strategy_runs AS run
-    WHERE run.id = runtime_lock.strategy_run_id
-  );
-
-DELETE FROM strategy_runtime_locks AS runtime_lock
-WHERE runtime_lock.strategy_run_id IN (
-    SELECT run.id
-    FROM strategy_runs AS run
-    WHERE run.strategy_id > 0
-      AND NOT EXISTS (
-        SELECT 1 FROM qd_strategies_trading AS strategy
-        WHERE strategy.id = run.strategy_id
-      )
-);
-
-DELETE FROM pending_orders AS pending
-WHERE pending.strategy_id IS NOT NULL
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = pending.strategy_id
-  );
-
-DELETE FROM qd_live_order_bindings AS binding
-WHERE binding.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = binding.strategy_id
-  );
-
-DELETE FROM strategy_order_fills AS fill
-WHERE fill.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = fill.strategy_id
-  );
-
-DELETE FROM strategy_order_intents AS intent
-WHERE intent.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = intent.strategy_id
-  );
-
-DELETE FROM strategy_runtime_state AS runtime_state
-WHERE runtime_state.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = runtime_state.strategy_id
-  );
-
-DELETE FROM strategy_runtime_events AS runtime_event
-WHERE runtime_event.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = runtime_event.strategy_id
-  );
-
-DELETE FROM strategy_runs AS run
-WHERE run.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = run.strategy_id
-  );
-
-DELE
```

**File**: `backend_api_python/migrations/init.sql` (modified, +3/-128)
```diff
@@ -3223,7 +3223,9 @@ BEGIN
           )
       );
 
-    DELETE FROM pending_orders WHERE strategy_id = OLD.id;
+    DELETE FROM pending_orders
+    WHERE strategy_id = OLD.id
+       OR (NULLIF(payload_json, '')::jsonb ->> 'strategy_id') = OLD.id::text;
     DELETE FROM qd_live_order_bindings WHERE strategy_id = OLD.id;
     DELETE FROM strategy_runtime_locks
     WHERE strategy_run_id IN (
@@ -3248,130 +3250,3 @@ DROP TRIGGER IF EXISTS trg_cleanup_deleted_strategy ON qd_strategies_trading;
 CREATE TRIGGER trg_cleanup_deleted_strategy
 BEFORE DELETE ON qd_strategies_trading
 FOR EACH ROW EXECUTE FUNCTION qd_cleanup_deleted_strategy();
-
--- Repair orphan rows created before deletion cleanup became transactional.
-UPDATE qd_execution_events AS event
-SET processed_at = COALESCE(event.processed_at, NOW()),
-    process_error = 'strategy_deleted',
-    next_attempt_at = NOW()
-WHERE event.processed_at IS NULL
-  AND EXISTS (
-    SELECT 1
-    FROM qd_live_order_bindings AS binding
-    WHERE binding.strategy_id > 0
-      AND NOT EXISTS (
-        SELECT 1 FROM qd_strategies_trading AS strategy
-        WHERE strategy.id = binding.strategy_id
-      )
-      AND binding.credential_id = event.credential_id
-      AND LOWER(binding.exchange_id) = LOWER(event.exchange_id)
-      AND (
-        (event.exchange_order_id <> '' AND binding.exchange_order_id = event.exchange_order_id)
-        OR (event.client_order_id <> '' AND binding.client_order_id = event.client_order_id)
-      )
-  );
-
-DELETE FROM strategy_runtime_locks AS runtime_lock
-WHERE runtime_lock.strategy_run_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM strategy_runs AS run
-    WHERE run.id = runtime_lock.strategy_run_id
-  );
-
-DELETE FROM strategy_runtime_locks AS runtime_lock
-WHERE runtime_lock.strategy_run_id IN (
-    SELECT run.id
-    FROM strategy_runs AS run
-    WHERE run.strategy_id > 0
-      AND NOT EXISTS (
-        SELECT 1 FROM qd_strategies_trading AS strategy
-        WHERE strategy.id = run.strategy_id
-      )
-);
-
-DELETE FROM pending_orders AS pending
-WHERE pending.strategy_id IS NOT NULL
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = pending.strategy_id
-  );
-
-DELETE FROM qd_live_order_bindings AS binding
-WHERE binding.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = binding.strategy_id
-  );
-
-DELETE FROM strategy_order_fills AS fill
-WHERE fill.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = fill.strategy_id
-  );
-
-DELETE FROM strategy_order_intents AS intent
-WHERE intent.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = intent.strategy_id
-  );
-
-DELETE FROM strategy_runtime_state AS runtime_state
-WHERE runtime_state.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = runtime_state.strategy_id
-  );
-
-DELETE FROM strategy_runtime_events AS runtime_event
-WHERE runtime_event.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = runtime_event.strategy_id
-  );
-
-DELETE FROM strategy_runs AS run
-WHERE run.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = run.strategy_id
-  );
-
-DELETE FROM qd_strategy_commands AS command
-WHERE command.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = command.strategy_id
-  );
-
-DELETE FROM qd_strategy_runtime_leases AS lease
-WHERE lease.strategy_id > 0
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = lease.strategy_id
-  );
-
-UPDATE qd_backtest_runs AS run
-SET strategy_id = NULL
-WHERE run.strategy_id IS NOT NULL
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = run.strategy_id
-  );
-
-UPDATE qd_backtest_trades AS trade
-SET strategy_id = NULL
-WHERE trade.strategy_id IS NOT NULL
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = trade.strategy_id
-  );
-
-UPDATE qd_indicator_codes AS listing
-SET source_strategy_id = NULL
-WHERE listing.source_strategy_id IS NOT NULL
-  AND NOT EXISTS (
-    SELECT 1 FROM qd_strategies_trading AS strategy
-    WHERE strategy.id = listing.source_strategy_id
-  );
```

**File**: `backend_api_python/tests/test_exchange_execution_strategy_config.py` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+import pytest
+
+from app.services import exchange_execution
+
+
+class _Cursor:
+    def execute(self, _sql, _params):
+        return None
+
+    def fetchone(self):
+        return None
+
+    def close(self):
+        return None
+
+
+class _Connection:
+    def __enter__(self):
+        return self
+
+    def __exit__(self, exc_type, exc, tb):
+        return False
+
+    def cursor(self):
+        return _Cursor()
+
+
+def test_load_strategy_configs_rejects_missing_strategy(monkeypatch):
+    monkeypatch.setattr(exchange_execution, "get_db_connection", lambda: _Connection())
+
+    with pytest.raises(LookupError, match="strategyV2.strategyNotFound"):
+        exchange_execution.load_strategy_configs(738)
```

**File**: `backend_api_python/tests/test_strategy_delete_cleanup.py` (modified, +10/-11)
```diff
@@ -85,6 +85,8 @@ def test_delete_strategy_removes_all_runtime_references_in_one_transaction(monke
     ):
         assert f"DELETE FROM {table}" in sql
     assert "UPDATE qd_execution_events AS event" in sql
+    assert "NULLIF(payload_json, '')::jsonb" in sql
+    assert (42, "42") in [params for _statement, params in cursor.statements]
     assert "UPDATE qd_strategy_commands SET status = 'cancelled'" in sql
     assert "UPDATE qd_backtest_runs SET strategy_id = NULL" in sql
     assert "UPDATE qd_backtest_trades SET strategy_id = NULL" in sql
@@ -120,15 +122,12 @@ def test_delete_strategy_returns_false_without_touching_orphans_for_wrong_owner(
     assert connection.rolled_back is True
 
 
-def test_schema_installs_trigger_and_repairs_preexisting_orphans():
+def test_schema_installs_strategy_delete_trigger_without_history_repair():
     migrations = Path(__file__).resolve().parents[1] / "migrations"
-    for path in (
-        migrations / "init.sql",
-        migrations / "20261001_strategy_delete_cleanup.sql",
-    ):
-        sql = path.read_text(encoding="utf-8")
-        assert "CREATE OR REPLACE FUNCTION qd_cleanup_deleted_strategy()" in sql
-        assert "BEFORE DELETE ON qd_strategies_trading" in sql
-        assert "DELETE FROM qd_live_order_bindings AS binding" in sql
-        assert "DELETE FROM qd_strategy_runtime_leases AS lease" in sql
-        assert "process_error = 'strategy_deleted'" in sql
+    sql = (migrations / "init.sql").read_text(encoding="utf-8")
+    assert "CREATE OR REPLACE FUNCTION qd_cleanup_deleted_strategy()" in sql
+    assert "BEFORE DELETE ON qd_strategies_trading" in sql
+    assert "NULLIF(payload_json, '')::jsonb" in sql
+    assert "process_error = 'strategy_deleted'" in sql
+    assert "Repair orphan rows created before deletion cleanup became transactional" not in sql
+    assert not (migrations / "20261001_strategy_delete_cleanup.sql").exists()
```

---

### Incident Patch 5: `4b6d6951` (2026-10-01)
**Commit Message**: fix: remove orphaned strategy runtime data

**File**: `backend_api_python/app/data_sources/native_crypto.py` (modified, +2/-2)
```diff
@@ -386,7 +386,6 @@ def fetch_ticker(self, symbol: str) -> Dict[str, Any]:
             host = "https://fapi.binance.com" if self.market_type == "swap" else "https://api.binance.com"
             path = "/fapi/v1/ticker/24hr" if self.market_type == "swap" else "/api/v3/ticker/24hr"
             row = self._get(host + path, {"symbol": native})
-            percentage = _float(row.get("change24h")) * 100
             return _ticker(
                 symbol=canonical,
                 last=row.get("lastPrice"),
@@ -448,13 +447,14 @@ def fetch_ticker(self, symbol: str) -> Dict[str, Any]:
             row = rows[0] if isinstance(rows, list) and rows else rows
             if not isinstance(row, dict):
                 raise NativeCryptoAPIError(f"symbol not found: {native}")
+            change_24h = row.get("change24h")
             return _ticker(
                 symbol=canonical,
                 last=row.get("lastPr") or row.get("last"),
                 open_price=row.get("open"),
                 high=row.get("high24h"),
                 low=row.get("low24h"),
-                percentage=percentage,
+                percentage=_float(change_24h) * 100 if change_24h is not None else None,
                 quote_volume=row.get("quoteVolume"),
                 timestamp=row.get("ts") or payload.get("requestTime"),
             )
```

**File**: `backend_api_python/app/routes/strategy.py` (modified, +7/-2)
```diff
@@ -212,10 +212,15 @@ def update_strategy(strategy_id: int):
 @strategy_blp.route("/strategies/<int:strategy_id>", methods=["DELETE"])
 @login_required
 def delete_strategy(strategy_id: int):
+    from app.services.strategy import StrategyDeleteBlocked
+
     if get_trading_executor().is_running(strategy_id):
         return _error("strategyV2.stopBeforeDelete", 409)
-    if not get_strategy_service().delete_strategy(strategy_id, user_id=int(g.user_id)):
-        return _error("strategyV2.strategyNotFound", 404)
+    try:
+        if not get_strategy_service().delete_strategy(strategy_id, user_id=int(g.user_id)):
+            return _error("strategyV2.strategyNotFound", 404)
+    except StrategyDeleteBlocked as exc:
+        return _error(str(exc), 409)
     return _ok({"id": strategy_id}, "strategyV2.deleted")
 
 
```

**File**: `backend_api_python/app/routes/user.py` (modified, +14/-4)
```diff
@@ -1771,17 +1771,27 @@ def admin_delete_system_strategy():
 
         from app import get_trading_executor
         from app.routes.strategy import get_strategy_service
+        from app.services.strategy import StrategyDeleteBlocked
 
         svc = get_strategy_service()
         st = svc.get_strategy(strategy_id)
         if not st:
             return jsonify({'code': 0, 'msg': 'Strategy not found', 'data': None}), 404
 
-        if str(st.get('status') or '').strip().lower() == 'running':
-            svc.update_strategy_status(strategy_id, 'stopped')
-            get_trading_executor().stop_strategy(strategy_id, persist_status=False)
+        executor = get_trading_executor()
+        if str(st.get('status') or '').strip().lower() == 'running' or executor.is_running(strategy_id):
+            stop_result = executor.stop_strategy_with_policy(strategy_id, close_positions=False)
+            if str(stop_result.get('status') or '') != 'stopped':
+                return jsonify({
+                    'code': 0,
+                    'msg': 'strategyV2.stopBeforeDelete',
+                    'data': {'id': strategy_id, **stop_result},
+                }), 409
 
-        ok = svc.delete_strategy(strategy_id)
+        try:
+            ok = svc.delete_strategy(strategy_id)
+        except StrategyDeleteBlocked as exc:
+            return jsonify({'code': 0, 'msg': str(exc), 'data': {'id': strategy_id}}), 409
         if not ok:
             return jsonify({'code': 0, 'msg': 'Failed to delete strategy', 'data': None}), 500
 
```

**File**: `backend_api_python/app/services/execution_streams/repository.py` (modified, +8/-0)
```diff
@@ -245,6 +245,14 @@ def resolve_binding(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
                 FROM qd_live_order_bindings
                 WHERE credential_id = %s
                   AND exchange_id = %s
+                  AND (
+                    strategy_id <= 0
+                    OR EXISTS (
+                      SELECT 1
+                      FROM qd_strategies_trading AS strategy
+                      WHERE strategy.id = qd_live_order_bindings.strategy_id
+                    )
+                  )
                   AND (market_type = %s OR market_type = '' OR %s = ''
                     OR (market_type IN ('crypto', 'spot') AND %s IN ('crypto', 'spot')))
                   AND (symbol = '' OR regexp_replace(upper(symbol), '[-/_]', '', 'g') = %s)
```

**File**: `backend_api_python/app/services/strategy.py` (modified, +133/-6)
```diff
@@ -24,6 +24,11 @@ def __init__(self, limit: int, running: int):
         self.running = int(running)
 
 
+class StrategyDeleteBlocked(Exception):
+    def __init__(self):
+        super().__init__("strategyV2.stopBeforeDelete")
+
+
 def _strip_legacy_risk_pct_basis(value: Any) -> Any:
     if isinstance(value, dict):
         return {
@@ -278,21 +283,143 @@ def delete_strategy(self, strategy_id: int, user_id: int | None = None) -> bool:
             values.append(int(user_id))
         with get_db_connection() as db:
             cur = db.cursor()
-            cur.execute(f"DELETE FROM qd_strategies_trading WHERE {where}", tuple(values))
-            changed = int(cur.rowcount or 0)
-            db.commit()
-            cur.close()
+            try:
+                cur.execute(
+                    f"SELECT id FROM qd_strategies_trading WHERE {where} FOR UPDATE",
+                    tuple(values),
+                )
+                if not cur.fetchone():
+                    db.rollback()
+                    return False
+
+                cur.execute(
+                    """
+                    SELECT 1
+                    FROM qd_strategy_runtime_leases
+                    WHERE strategy_id = ? AND lease_expires_at >= NOW()
+                    LIMIT 1
+                    """,
+                    (int(strategy_id),),
+                )
+                active_lease = bool(cur.fetchone())
+                if active_lease:
+                    raise StrategyDeleteBlocked()
+
+                cur.execute(
+                    """
+                    UPDATE qd_strategy_commands
+                    SET status = 'cancelled',
+                        completed_at = COALESCE(completed_at, NOW()),
+                        updated_at = NOW(),
+                        error_message = CASE
+                            WHEN error_message = '' THEN 'strategy_deleted'
+                            ELSE error_message
+                        END
+                    WHERE strategy_id = ?
+                      AND (
+                        status = 'pending'
+                        OR (status = 'processing' AND lease_expires_at < NOW())
+                      )
+                    """,
+                    (int(strategy_id),),
+                )
+                cur.execute(
+                    """
+                    SELECT 1
+                    FROM qd_strategy_commands
+                    WHERE strategy_id = ?
+                      AND status = 'processing'
+                      AND COALESCE(lease_expires_at, NOW()) >= NOW()
+                    LIMIT 1
+                    """,
+                    (int(strategy_id),),
+                )
+                if cur.fetchone():
+                    raise StrategyDeleteBlocked()
+
+                self._cleanup_strategy_references(cur, int(strategy_id))
+                cur.execute(f"DELETE FROM qd_strategies_trading WHERE {where}", tuple(values))
+                changed = int(cur.rowcount or 0)
+                db.commit()
+            except Exception:
+                db.rollback()
+                raise
+            finally:
+                cur.close()
         return changed > 0
 
+    @staticmethod
+    def _cleanup_strategy_references(cur, strategy_id: int) -> None:
+        cur.execute(
+            """
+            UPDATE qd_execution_events AS event
+            SET processed_at = COALESCE(event.processed_at, NOW()),
+                process_error = 'strategy_deleted',
+                next_attempt_at = NOW()
+            WHERE event.processed_at IS NULL
+              AND EXISTS (
+                SELECT 1
+                FROM qd_live_order_bindings AS binding
+                WHERE binding.strategy_id = ?
+                  AND binding.credential_id = event.credential_id
+                  AND LOWER(binding.exchange_id) = LOWER(event.exchange_id)
+                  AND (
+                    (event.exchange_order_id <> '' AND binding.exchange_order_id = event.exchange_order_id)
+                    OR (event.client_order_id <> '' AND binding.client_order_id = event.client_order_id)
+                  )
+              )
+            """,
+            (strategy_id,),
+        )
+        cur.execute("DELETE FROM pending_orders WHERE strategy_id = ?", (strategy_id,))
+        cur.execute("DELETE FROM qd_live_order_bindings WHERE strategy_id = ?", (strategy_id,))
+        cur.execute(
+            """
+            DELETE FROM strategy_runtime_locks
+            WHERE strategy_run_id IN (
+                SELECT id FROM strategy_runs WHERE strategy_id = ?
+            )
+            """,
+            (strategy_id,),
+        )
+        for table in (
+            "strategy_order_fills",
+            "strategy_order_intents",
+            "strategy_runtime_state",
+            "strategy_runtime_events",
+            "strategy_runs",
+            "qd_strategy_commands",
+            "qd_strategy_runtime_leases",
+        ):
+            cur.exec
```

**File**: `backend_api_python/migrations/20261001_strategy_delete_cleanup.sql` (added, +174/-0)
```diff
@@ -0,0 +1,174 @@
+-- Remove stale strategy runtime data and make future strategy deletes atomic.
+-- The same statements are included in init.sql for automatic upgrades.
+
+CREATE OR REPLACE FUNCTION qd_cleanup_deleted_strategy()
+RETURNS TRIGGER AS $$
+BEGIN
+    UPDATE qd_execution_events AS event
+    SET processed_at = COALESCE(event.processed_at, NOW()),
+        process_error = 'strategy_deleted',
+        next_attempt_at = NOW()
+    WHERE event.processed_at IS NULL
+      AND EXISTS (
+        SELECT 1
+        FROM qd_live_order_bindings AS binding
+        WHERE binding.strategy_id = OLD.id
+          AND binding.credential_id = event.credential_id
+          AND LOWER(binding.exchange_id) = LOWER(event.exchange_id)
+          AND (
+            (event.exchange_order_id <> '' AND binding.exchange_order_id = event.exchange_order_id)
+            OR (event.client_order_id <> '' AND binding.client_order_id = event.client_order_id)
+          )
+      );
+
+    DELETE FROM pending_orders WHERE strategy_id = OLD.id;
+    DELETE FROM qd_live_order_bindings WHERE strategy_id = OLD.id;
+    DELETE FROM strategy_runtime_locks
+    WHERE strategy_run_id IN (
+        SELECT id FROM strategy_runs WHERE strategy_id = OLD.id
+    );
+    DELETE FROM strategy_order_fills WHERE strategy_id = OLD.id;
+    DELETE FROM strategy_order_intents WHERE strategy_id = OLD.id;
+    DELETE FROM strategy_runtime_state WHERE strategy_id = OLD.id;
+    DELETE FROM strategy_runtime_events WHERE strategy_id = OLD.id;
+    DELETE FROM strategy_runs WHERE strategy_id = OLD.id;
+    DELETE FROM qd_strategy_commands WHERE strategy_id = OLD.id;
+    DELETE FROM qd_strategy_runtime_leases WHERE strategy_id = OLD.id;
+
+    UPDATE qd_backtest_runs SET strategy_id = NULL WHERE strategy_id = OLD.id;
+    UPDATE qd_backtest_trades SET strategy_id = NULL WHERE strategy_id = OLD.id;
+    UPDATE qd_indicator_codes SET source_strategy_id = NULL WHERE source_strategy_id = OLD.id;
+    RETURN OLD;
+END;
+$$ LANGUAGE plpgsql;
+
+DROP TRIGGER IF EXISTS trg_cleanup_deleted_strategy ON qd_strategies_trading;
+CREATE TRIGGER trg_cleanup_deleted_strategy
+BEFORE DELETE ON qd_strategies_trading
+FOR EACH ROW EXECUTE FUNCTION qd_cleanup_deleted_strategy();
+
+UPDATE qd_execution_events AS event
+SET processed_at = COALESCE(event.processed_at, NOW()),
+    process_error = 'strategy_deleted',
+    next_attempt_at = NOW()
+WHERE event.processed_at IS NULL
+  AND EXISTS (
+    SELECT 1
+    FROM qd_live_order_bindings AS binding
+    WHERE binding.strategy_id > 0
+      AND NOT EXISTS (
+        SELECT 1 FROM qd_strategies_trading AS strategy
+        WHERE strategy.id = binding.strategy_id
+      )
+      AND binding.credential_id = event.credential_id
+      AND LOWER(binding.exchange_id) = LOWER(event.exchange_id)
+      AND (
+        (event.exchange_order_id <> '' AND binding.exchange_order_id = event.exchange_order_id)
+        OR (event.client_order_id <> '' AND binding.client_order_id = event.client_order_id)
+      )
+  );
+
+DELETE FROM strategy_runtime_locks AS runtime_lock
+WHERE runtime_lock.strategy_run_id > 0
+  AND NOT EXISTS (
+    SELECT 1 FROM strategy_runs AS run
+    WHERE run.id = runtime_lock.strategy_run_id
+  );
+
+DELETE FROM strategy_runtime_locks AS runtime_lock
+WHERE runtime_lock.strategy_run_id IN (
+    SELECT run.id
+    FROM strategy_runs AS run
+    WHERE run.strategy_id > 0
+      AND NOT EXISTS (
+        SELECT 1 FROM qd_strategies_trading AS strategy
+        WHERE strategy.id = run.strategy_id
+      )
+);
+
+DELETE FROM pending_orders AS pending
+WHERE pending.strategy_id IS NOT NULL
+  AND NOT EXISTS (
+    SELECT 1 FROM qd_strategies_trading AS strategy
+    WHERE strategy.id = pending.strategy_id
+  );
+
+DELETE FROM qd_live_order_bindings AS binding
+WHERE binding.strategy_id > 0
+  AND NOT EXISTS (
+    SELECT 1 FROM qd_strategies_trading AS strategy
+    WHERE strategy.id = binding.strategy_id
+  );
+
+DELETE FROM strategy_order_fills AS fill
+WHERE fill.strategy_id > 0
+  AND NOT EXISTS (
+    SELECT 1 FROM qd_strategies_trading AS strategy
+    WHERE strategy.id = fill.strategy_id
+  );
+
+DELETE FROM strategy_order_intents AS intent
+WHERE intent.strategy_id > 0
+  AND NOT EXISTS (
+    SELECT 1 FROM qd_strategies_trading AS strategy
+    WHERE strategy.id = intent.strategy_id
+  );
+
+DELETE FROM strategy_runtime_state AS runtime_state
+WHERE runtime_state.strategy_id > 0
+  AND NOT EXISTS (
+    SELECT 1 FROM qd_strategies_trading AS strategy
+    WHERE strategy.id = runtime_state.strategy_id
+  );
+
+DELETE FROM strategy_runtime_events AS runtime_event
+WHERE runtime_event.strategy_id > 0
+  AND NOT EXISTS (
+    SELECT 1 FROM qd_strategies_trading AS strategy
+    WHERE strategy.id = runtime_event.strategy_id
+  );
+
+DELETE FROM strategy_runs AS run
+WHERE run.strategy_id > 0
+  AND NOT EXISTS (
+    SELECT 1 FROM qd_strategies_trading AS strategy
+    WHERE strategy.id = run.strategy_id
+  );
+
+DELE
```

**File**: `backend_api_python/migrations/init.sql` (modified, +174/-0)
```diff
@@ -3201,3 +3201,177 @@ CREATE TABLE IF NOT EXISTS qd_exchange_order_pnl (
     PRIMARY KEY (credential_id, exchange_id, market_type, symbol, exchange_order_id)
 );
 CREATE INDEX IF NOT EXISTS idx_exchange_pnl_checked ON qd_exchange_order_pnl(credential_id, checked_at);
+
+-- Keep strategy deletion atomic even when a caller bypasses the application service.
+CREATE OR REPLACE FUNCTION qd_cleanup_deleted_strategy()
+RETURNS TRIGGER AS $$
+BEGIN
+    UPDATE qd_execution_events AS event
+    SET processed_at = COALESCE(event.processed_at, NOW()),
+        process_error = 'strategy_deleted',
+        next_attempt_at = NOW()
+    WHERE event.processed_at IS NULL
+      AND EXISTS (
+        SELECT 1
+        FROM qd_live_order_bindings AS binding
+        WHERE binding.strategy_id = OLD.id
+          AND binding.credential_id = event.credential_id
+          AND LOWER(binding.exchange_id) = LOWER(event.exchange_id)
+          AND (
+            (event.exchange_order_id <> '' AND binding.exchange_order_id = event.exchange_order_id)
+            OR (event.client_order_id <> '' AND binding.client_order_id = event.client_order_id)
+          )
+      );
+
+    DELETE FROM pending_orders WHERE strategy_id = OLD.id;
+    DELETE FROM qd_live_order_bindings WHERE strategy_id = OLD.id;
+    DELETE FROM strategy_runtime_locks
+    WHERE strategy_run_id IN (
+        SELECT id FROM strategy_runs WHERE strategy_id = OLD.id
+    );
+    DELETE FROM strategy_order_fills WHERE strategy_id = OLD.id;
+    DELETE FROM strategy_order_intents WHERE strategy_id = OLD.id;
+    DELETE FROM strategy_runtime_state WHERE strategy_id = OLD.id;
+    DELETE FROM strategy_runtime_events WHERE strategy_id = OLD.id;
+    DELETE FROM strategy_runs WHERE strategy_id = OLD.id;
+    DELETE FROM qd_strategy_commands WHERE strategy_id = OLD.id;
+    DELETE FROM qd_strategy_runtime_leases WHERE strategy_id = OLD.id;
+
+    UPDATE qd_backtest_runs SET strategy_id = NULL WHERE strategy_id = OLD.id;
+    UPDATE qd_backtest_trades SET strategy_id = NULL WHERE strategy_id = OLD.id;
+    UPDATE qd_indicator_codes SET source_strategy_id = NULL WHERE source_strategy_id = OLD.id;
+    RETURN OLD;
+END;
+$$ LANGUAGE plpgsql;
+
+DROP TRIGGER IF EXISTS trg_cleanup_deleted_strategy ON qd_strategies_trading;
+CREATE TRIGGER trg_cleanup_deleted_strategy
+BEFORE DELETE ON qd_strategies_trading
+FOR EACH ROW EXECUTE FUNCTION qd_cleanup_deleted_strategy();
+
+-- Repair orphan rows created before deletion cleanup became transactional.
+UPDATE qd_execution_events AS event
+SET processed_at = COALESCE(event.processed_at, NOW()),
+    process_error = 'strategy_deleted',
+    next_attempt_at = NOW()
+WHERE event.processed_at IS NULL
+  AND EXISTS (
+    SELECT 1
+    FROM qd_live_order_bindings AS binding
+    WHERE binding.strategy_id > 0
+      AND NOT EXISTS (
+        SELECT 1 FROM qd_strategies_trading AS strategy
+        WHERE strategy.id = binding.strategy_id
+      )
+      AND binding.credential_id = event.credential_id
+      AND LOWER(binding.exchange_id) = LOWER(event.exchange_id)
+      AND (
+        (event.exchange_order_id <> '' AND binding.exchange_order_id = event.exchange_order_id)
+        OR (event.client_order_id <> '' AND binding.client_order_id = event.client_order_id)
+      )
+  );
+
+DELETE FROM strategy_runtime_locks AS runtime_lock
+WHERE runtime_lock.strategy_run_id > 0
+  AND NOT EXISTS (
+    SELECT 1 FROM strategy_runs AS run
+    WHERE run.id = runtime_lock.strategy_run_id
+  );
+
+DELETE FROM strategy_runtime_locks AS runtime_lock
+WHERE runtime_lock.strategy_run_id IN (
+    SELECT run.id
+    FROM strategy_runs AS run
+    WHERE run.strategy_id > 0
+      AND NOT EXISTS (
+        SELECT 1 FROM qd_strategies_trading AS strategy
+        WHERE strategy.id = run.strategy_id
+      )
+);
+
+DELETE FROM pending_orders AS pending
+WHERE pending.strategy_id IS NOT NULL
+  AND NOT EXISTS (
+    SELECT 1 FROM qd_strategies_trading AS strategy
+    WHERE strategy.id = pending.strategy_id
+  );
+
+DELETE FROM qd_live_order_bindings AS binding
+WHERE binding.strategy_id > 0
+  AND NOT EXISTS (
+    SELECT 1 FROM qd_strategies_trading AS strategy
+    WHERE strategy.id = binding.strategy_id
+  );
+
+DELETE FROM strategy_order_fills AS fill
+WHERE fill.strategy_id > 0
+  AND NOT EXISTS (
+    SELECT 1 FROM qd_strategies_trading AS strategy
+    WHERE strategy.id = fill.strategy_id
+  );
+
+DELETE FROM strategy_order_intents AS intent
+WHERE intent.strategy_id > 0
+  AND NOT EXISTS (
+    SELECT 1 FROM qd_strategies_trading AS strategy
+    WHERE strategy.id = intent.strategy_id
+  );
+
+DELETE FROM strategy_runtime_state AS runtime_state
+WHERE runtime_state.strategy_id > 0
+  AND NOT EXISTS (
+    SELECT 1 FROM qd_strategies_trading AS strategy
+    WHERE strategy.id = runtime_state.strategy_id
+  );
+
+DELETE FROM strategy_runtime_events AS runtime_event
+WHERE runtime_event.strategy_id > 0
+  AND NOT EXISTS (
+    SELECT 1 FROM qd_strategies_tra
```

**File**: `backend_api_python/tests/test_native_crypto_public_client.py` (modified, +32/-0)
```diff
@@ -142,3 +142,35 @@ def fake_get(_url, params):
 
     assert "BTC/USDT" in markets
     assert captured == [{"category": "spot"}]
+
+
+@pytest.mark.parametrize("market_type", ["spot", "swap"])
+def test_bitget_ticker_parses_change_rate_without_unbound_state(market_type, monkeypatch):
+    client = NativeCryptoPublicClient("bitget", market_type)
+    monkeypatch.setattr(
+        client,
+        "_get",
+        lambda *_args, **_kwargs: {
+            "code": "00000",
+            "requestTime": 1700000000000,
+            "data": [
+                {
+                    "symbol": "BTCUSDT",
+                    "lastPr": "101.25",
+                    "open": "100",
+                    "high24h": "103",
+                    "low24h": "99",
+                    "change24h": "0.0125",
+                    "quoteVolume": "2500000",
+                    "ts": "1700000000123",
+                }
+            ],
+        },
+    )
+
+    ticker = client.fetch_ticker("BTC/USDT")
+
+    assert ticker["last"] == 101.25
+    assert ticker["percentage"] == 1.25
+    assert ticker["changePercent"] == 1.25
+    assert ticker["timestamp"] == 1700000000123
```

---

### Incident Patch 6: `af85e77e` (2026-10-01)
**Commit Message**: fix: expose virtual ledgers in admin strategy overview

**File**: `backend_api_python/app/routes/user.py` (modified, +175/-67)
```diff
@@ -1063,6 +1063,37 @@ def _batch_load_credential_exchange_map(credential_ids: set) -> dict:
     return credential_map
 
 
+def _admin_strategy_ledger_metrics(
+    *,
+    execution_mode: str,
+    strategy_initial_capital: float,
+    positions: list,
+    trade_stats: dict,
+) -> dict:
+    """Build admin metrics from the ledger selected by execution mode."""
+    mode = str(execution_mode or '').strip().lower()
+    initial_capital = float(strategy_initial_capital or 0)
+    if mode == 'signal' and float(trade_stats.get('virtual_initial_capital') or 0) > 0:
+        initial_capital = float(trade_stats['virtual_initial_capital'])
+    total_unrealized_pnl = sum(float(p.get('unrealized_pnl') or 0) for p in positions)
+    total_realized_pnl = float(trade_stats.get('total_realized_pnl') or 0)
+    total_pnl = total_unrealized_pnl + total_realized_pnl
+    total_equity = sum(float(p.get('equity') or 0) for p in positions)
+    if mode == 'signal':
+        total_equity = initial_capital + total_pnl
+    return {
+        'ledger_mode': 'virtual' if mode == 'signal' else 'live',
+        'initial_capital': initial_capital,
+        'position_count': len(positions),
+        'trade_count': int(trade_stats.get('trade_count') or 0),
+        'total_unrealized_pnl': total_unrealized_pnl,
+        'total_realized_pnl': total_realized_pnl,
+        'total_pnl': total_pnl,
+        'total_equity': total_equity,
+        'roi': (total_pnl / initial_capital * 100) if initial_capital > 0 else 0,
+    }
+
+
 @user_blp.route('/system-strategies', methods=['GET'])
 @login_required
 @admin_required
@@ -1112,15 +1143,29 @@ def get_system_strategies():
         }
         sort_expr_map = {
             'total_pnl': (
-                "(COALESCE((SELECT SUM(unrealized_pnl) FROM qd_strategy_positions p WHERE p.strategy_id = s.id), 0)"
-                " + COALESCE((SELECT SUM(COALESCE(t.profit, 0) - COALESCE(t.commission_quote, t.commission, 0)) FROM qd_strategy_trades t WHERE t.strategy_id = s.id), 0)"
-                " + COALESCE((SELECT SUM(COALESCE(f.amount, 0)) FROM qd_strategy_funding_fees f WHERE f.strategy_id = s.id), 0)"
-                " + COALESCE((SELECT SUM(COALESCE(a.amount, 0)) FROM qd_strategy_broker_activities a WHERE a.strategy_id = s.id), 0))"
+                "(CASE WHEN LOWER(COALESCE(s.execution_mode, 'signal')) = 'signal' THEN "
+                "COALESCE((SELECT va.realized_pnl FROM qd_strategy_virtual_accounts va WHERE va.strategy_id = s.id), 0) "
+                "+ COALESCE((SELECT SUM(vp.unrealized_pnl) FROM qd_strategy_virtual_positions vp WHERE vp.strategy_id = s.id), 0) "
+                "ELSE COALESCE((SELECT SUM(p.unrealized_pnl) FROM qd_strategy_positions p WHERE p.strategy_id = s.id), 0) "
+                "+ COALESCE((SELECT SUM(COALESCE(t.profit, 0) - COALESCE(t.commission_quote, t.commission, 0)) FROM qd_strategy_trades t WHERE t.strategy_id = s.id), 0) "
+                "+ COALESCE((SELECT SUM(COALESCE(f.amount, 0)) FROM qd_strategy_funding_fees f WHERE f.strategy_id = s.id), 0) "
+                "+ COALESCE((SELECT SUM(COALESCE(a.amount, 0)) FROM qd_strategy_broker_activities a WHERE a.strategy_id = s.id), 0) END)"
+            ),
+            'trade_count': (
+                "(CASE WHEN LOWER(COALESCE(s.execution_mode, 'signal')) = 'signal' "
+                "THEN (SELECT COUNT(*) FROM qd_strategy_virtual_trades vt WHERE vt.strategy_id = s.id) "
+                "ELSE (SELECT COUNT(*) FROM qd_strategy_trades t WHERE t.strategy_id = s.id) END)"
+            ),
+            'position_count': (
+                "(CASE WHEN LOWER(COALESCE(s.execution_mode, 'signal')) = 'signal' "
+                "THEN (SELECT COUNT(*) FROM qd_strategy_virtual_positions vp WHERE vp.strategy_id = s.id AND ABS(COALESCE(vp.size, 0)) > 0) "
+                "ELSE (SELECT COUNT(*) FROM qd_strategy_positions p WHERE p.strategy_id = s.id AND ABS(COALESCE(p.size, 0)) > 0) END)"
             ),
-            'trade_count': '(SELECT COUNT(*) FROM qd_strategy_trades t WHERE t.strategy_id = s.id)',
-            'position_count': '(SELECT COUNT(*) FROM qd_strategy_positions p WHERE p.strategy_id = s.id)',
             'total_equity': (
-                'COALESCE((SELECT SUM(equity) FROM qd_strategy_positions p WHERE p.strategy_id = s.id), 0)'
+                "(CASE WHEN LOWER(COALESCE(s.execution_mode, 'signal')) = 'signal' THEN "
+                "COALESCE((SELECT va.initial_cash + va.realized_pnl FROM qd_strategy_virtual_accounts va WHERE va.strategy_id = s.id), s.initial_capital, 0) "
+                "+ COALESCE((SELECT SUM(vp.unrealized_pnl) FROM qd_strategy_virtual_positions vp WHERE vp.strategy_id = s.id), 0) "
+                "ELSE COALESCE((SELECT SUM(p.equity) FROM qd_strategy_positions p WHERE p.strategy_id = s.id), 0) END)"
             ),
         }
         direction = 'ASC' if sort_order == 'asc' else 'DESC'
@@ -1249,51 +1294,92 @@ def get_system_strategies():
             # Collect strategy IDs
```

**File**: `backend_api_python/tests/test_system_strategy_exchange_display.py` (modified, +46/-1)
```diff
@@ -1,6 +1,12 @@
 """Admin system-strategies exchange column resolution."""
 
-from app.routes.user import _strategy_exchange_display_name, _strategy_v2_admin_metadata
+import pytest
+
+from app.routes.user import (
+    _admin_strategy_ledger_metrics,
+    _strategy_exchange_display_name,
+    _strategy_v2_admin_metadata,
+)
 
 
 def test_inline_exchange_id():
@@ -141,3 +147,42 @@ def test_strategy_v2_admin_metadata_exposes_declared_grid_executor():
 
     assert metadata['strategy_class'] == 'robot'
     assert metadata['bot_type'] == 'grid'
+
+
+def test_signal_admin_metrics_use_virtual_account_and_ledger():
+    metrics = _admin_strategy_ledger_metrics(
+        execution_mode='signal',
+        strategy_initial_capital=1000,
+        positions=[{'unrealized_pnl': 12.5, 'equity': 0}],
+        trade_stats={
+            'trade_count': 7,
+            'total_realized_pnl': -2.5,
+            'virtual_initial_capital': 500,
+        },
+    )
+
+    assert metrics['ledger_mode'] == 'virtual'
+    assert metrics['initial_capital'] == pytest.approx(500)
+    assert metrics['position_count'] == 1
+    assert metrics['trade_count'] == 7
+    assert metrics['total_pnl'] == pytest.approx(10)
+    assert metrics['total_equity'] == pytest.approx(510)
+    assert metrics['roi'] == pytest.approx(2)
+
+
+def test_live_admin_metrics_keep_live_position_equity():
+    metrics = _admin_strategy_ledger_metrics(
+        execution_mode='live',
+        strategy_initial_capital=1000,
+        positions=[{'unrealized_pnl': 8, 'equity': 1008}],
+        trade_stats={
+            'trade_count': 3,
+            'total_realized_pnl': 4,
+            'virtual_initial_capital': 500,
+        },
+    )
+
+    assert metrics['ledger_mode'] == 'live'
+    assert metrics['initial_capital'] == pytest.approx(1000)
+    assert metrics['total_pnl'] == pytest.approx(12)
+    assert metrics['total_equity'] == pytest.approx(1008)
```

---

### Incident Patch 7: `7b661150` (2026-10-01)
**Commit Message**: fix: normalize Bitget fees to dollar value

**File**: `backend_api_python/app/routes/strategy_ledger_routes.py` (modified, +13/-0)
```diff
@@ -27,6 +27,19 @@ def _normalize_trade_row_for_api(trade: dict, *, leverage: float = 1.0, market_t
     except Exception:  # pragma: no cover
         Decimal = ()  # type: ignore
     out = dict(trade)
+    commission_ccy = str(out.get("commission_ccy") or "").strip().upper()
+    exchange_id = str(out.get("exchange_id") or "").strip().lower()
+    if (
+        out.get("commission_quote") is None
+        and commission_ccy in {"", "UNKNOWN"}
+        and (commission_ccy != "UNKNOWN" or exchange_id == "bitget")
+    ):
+        from app.services.live_trading.fee_quote import STABLE_QUOTES, symbol_currencies
+
+        _, quote_currency = symbol_currencies(str(out.get("symbol") or ""))
+        if quote_currency in STABLE_QUOTES and out.get("commission") is not None:
+            out["commission_quote"] = out.get("commission")
+            out["commission_ccy"] = quote_currency
     for k in (
         "price",
         "amount",
```

**File**: `backend_api_python/app/services/live_trading/bitget.py` (modified, +27/-5)
```diff
@@ -24,6 +24,18 @@
 from app.services.live_trading.symbols import to_bitget_um_symbol
 
 
+def _settlement_currency(symbol: str, product_type: str) -> str:
+    product = str(product_type or "").strip().upper()
+    if product.startswith("USDT"):
+        return "USDT"
+    if product.startswith("USDC"):
+        return "USDC"
+    from app.services.live_trading.fee_quote import symbol_currencies
+
+    base, quote = symbol_currencies(symbol)
+    return base if product.startswith("COIN") else quote
+
+
 class BitgetMixClient(BaseRestClient):
     _CHANNEL_API_CODE = "qvz9x"
 
@@ -80,9 +92,9 @@ def _to_dec(x: Any) -> Decimal:
             return Decimal("0")
 
     @staticmethod
-    def _parse_fee_detail(raw_fd: Any) -> Tuple[Decimal, str]:
+    def _parse_fee_detail(raw_fd: Any, *, received_currency: str = "") -> Tuple[Decimal, str]:
         from app.services.live_trading.bitget_fees import fee_storage
-        return fee_storage(raw_fd)
+        return fee_storage(raw_fd, received_currency=received_currency)
 
     @staticmethod
     def _dec_str(d: Decimal, max_decimals: int = 18, strict_precision: Optional[int] = None) -> str:
@@ -1008,6 +1020,7 @@ def wait_for_fill(
         }
         """
         end_ts = time.time() + float(max_wait_sec or 0.0)
+        settlement_currency = _settlement_currency(symbol, product_type)
         last_detail: Dict[str, Any] = {}
         last_fills: Dict[str, Any] = {}
         state = ""
@@ -1028,7 +1041,10 @@ def _fee_from_order_detail_row(drow: Dict[str, Any]) -> Tuple[Decimal, str]:
             ).strip()
             # Bitget V2: feeDetail nested structure (may be list, dict, or JSON string)
             if fv is None or str(fv).strip() in ("", "0", "0.0"):
-                fd_fee, fd_ccy = self._parse_fee_detail(drow.get("feeDetail"))
+                fd_fee, fd_ccy = self._parse_fee_detail(
+                    drow.get("feeDetail"),
+                    received_currency=settlement_currency,
+                )
                 if fd_ccy:
                     logger.debug("Bitget order detail fee via feeDetail: %.8f %s", fd_fee, fd_ccy)
                     return fd_fee, fd_ccy or ccy
@@ -1061,7 +1077,10 @@ def _fee_from_order_detail_row(drow: Dict[str, Any]) -> Tuple[Decimal, str]:
                                 total_base += sz_base
                                 total_quote += sz_base * px
                             from app.services.live_trading.bitget_fees import fee_breakdown
-                            native = fee_breakdown(f.get("feeDetail"))
+                            native = fee_breakdown(
+                                f.get("feeDetail"),
+                                received_currency=settlement_currency,
+                            )
                             if not native and f.get("fee") is not None:
                                 native = fee_breakdown({"fee": f["fee"], "feeCoin": f.get("feeCoin") or f.get("feeCcy")})
                             for currency, amount in native.items():
@@ -1108,7 +1127,10 @@ def _fee_from_order_detail_row(drow: Dict[str, Any]) -> Tuple[Decimal, str]:
                     filled = float(d.get("baseVolume") or d.get("filledQty") or 0.0) if (d.get("baseVolume") or d.get("filledQty")) else 0.0
                     dfee, dccy = _fee_from_order_detail_row(d)
                     from app.services.live_trading.bitget_fees import fee_breakdown
-                    detail_fees = fee_breakdown(d.get("feeDetail"))
+                    detail_fees = fee_breakdown(
+                        d.get("feeDetail"),
+                        received_currency=settlement_currency,
+                    )
                     if not detail_fees and dccy and dccy != "MIXED":
                         detail_fees = {str(dccy).upper(): float(dfee)}
                     abs_fee = dfee
```

**File**: `backend_api_python/app/services/live_trading/bitget_fees.py` (modified, +5/-3)
```diff
@@ -16,7 +16,9 @@ def fee_breakdown(raw, *, received_currency=""):
         details = raw["newFees"]
         result = {}
         if details.get("d") not in (None, ""):
-            result["BGB"] = -float(details["d"])
+            bgb_fee = -float(details["d"])
+            if bgb_fee != 0:
+                result["BGB"] = bgb_fee
         if details.get("r") not in (None, ""):
             result[received_currency or "UNKNOWN"] = -float(details["r"])
         return result
@@ -50,8 +52,8 @@ def fee_breakdown(raw, *, received_currency=""):
     return result
 
 
-def fee_storage(raw):
-    fees = fee_breakdown(raw)
+def fee_storage(raw, *, received_currency=""):
+    fees = fee_breakdown(raw, received_currency=received_currency)
     if len(fees) == 1:
         currency, amount = next(iter(fees.items()))
         return Decimal(str(amount)), currency
```

**File**: `backend_api_python/app/services/live_trading/bitget_spot.py` (modified, +12/-1)
```diff
@@ -518,6 +518,9 @@ def wait_for_fill(
         poll_interval_sec: float = 0.5,
     ) -> Dict[str, Any]:
         end_ts = time.time() + float(max_wait_sec or 0.0)
+        from app.services.live_trading.fee_quote import symbol_currencies
+
+        base_currency, quote_currency = symbol_currencies(symbol)
         last_order: Dict[str, Any] = {}
         last_fills: Dict[str, Any] = {}
         state = ""
@@ -551,7 +554,15 @@ def _spot_order_row(raw: Dict[str, Any]) -> Dict[str, Any]:
                                 total_base += sz
                                 total_quote += sz * px
                             from app.services.live_trading.bitget_fees import fee_breakdown
-                            native = fee_breakdown(f.get("feeDetail"))
+                            received_currency = (
+                                base_currency
+                                if str(f.get("side") or "").strip().lower() == "buy"
+                                else quote_currency
+                            )
+                            native = fee_breakdown(
+                                f.get("feeDetail"),
+                                received_currency=received_currency,
+                            )
                             if not native and f.get("fee") is not None:
                                 native = fee_breakdown({"fee": f["fee"], "feeCoin": f.get("feeCoin") or f.get("feeCcy")})
                             for currency, amount in native.items():
```

**File**: `backend_api_python/tests/test_fill_accounting_contracts.py` (modified, +58/-0)
```diff
@@ -198,6 +198,15 @@ def test_bitget_rest_fee_sign_and_rebates(value, expected):
     assert fee_breakdown({"feeCoin": "USDT", "totalFee": value}) == {"USDT": expected}
 
 
+def test_bitget_new_fee_payload_uses_supplied_settlement_currency():
+    from app.services.live_trading.bitget_fees import fee_breakdown
+
+    assert fee_breakdown(
+        {"newFees": {"d": "0", "r": "-0.5662405"}},
+        received_currency="USDT",
+    ) == {"USDT": 0.5662405}
+
+
 def test_fee_adapter_and_executor_preserve_mixed_rebate():
     from app.services.live_trading.executors import _merge_fee_breakdowns
     from app.services.pending_orders.live_order_support import FillAccumulator
@@ -397,6 +406,55 @@ def test_bitget_detail_retains_multiple_native_fee_currencies(monkeypatch):
     assert result["fee_ccy"] == "MIXED"
 
 
+def test_bitget_mix_fill_maps_new_fee_payload_to_contract_settlement_currency(monkeypatch):
+    from app.services.live_trading.bitget import BitgetMixClient
+
+    client = BitgetMixClient(api_key="test", secret_key="test", passphrase="test")
+    monkeypatch.setattr(
+        client,
+        "get_order_fills",
+        lambda **kw: {
+            "data": {
+                "fillList": [
+                    {
+                        "baseVolume": "0.0113",
+                        "price": "83516.30",
+                        "feeDetail": {"newFees": {"d": "0", "r": "-0.5662405"}},
+                    }
+                ]
+            }
+        },
+    )
+
+    result = client.wait_for_fill(
+        symbol="BTC/USDT",
+        product_type="USDT-FUTURES",
+        order_id="1",
+        max_wait_sec=0,
+    )
+
+    assert result["fees_by_ccy"] == {"USDT": 0.5662405}
+    assert result["fee_ccy"] == "USDT"
+
+
+def test_trade_api_normalizes_legacy_unknown_stable_quote_fee_to_dollars():
+    from app.routes.strategy_ledger_routes import _normalize_trade_row_for_api
+
+    row = _normalize_trade_row_for_api(
+        {
+            "symbol": "BTC/USDT",
+            "exchange_id": "bitget",
+            "commission": 0.5662405,
+            "commission_ccy": "UNKNOWN",
+            "commission_quote": None,
+        },
+        market_type="swap",
+    )
+
+    assert row["commission_quote"] == 0.5662405
+    assert row["commission_ccy"] == "USDT"
+
+
 def test_grid_initial_recovery_cannot_invent_trade_from_account_position(monkeypatch):
     from app.services.grid import engine as module
 
```

---

### Incident Patch 8: `eb680e2b` (2026-10-01)
**Commit Message**: fix: unblock distributed strategy stops

**File**: `backend_api_python/app/routes/strategy.py` (modified, +1/-1)
```diff
@@ -268,7 +268,7 @@ def stop_strategy(strategy_id: int):
     )
     result.setdefault("close_requested", close_positions)
     status = str(result.get("status") or "")
-    if status == "stopped":
+    if status == "stopped" or (result.get("success") and status == "stopping"):
         get_strategy_service().update_strategy_status(strategy_id, "stopped", user_id=int(g.user_id))
     data = {"id": strategy_id, **result}
     if not result.get("success"):
```

**File**: `backend_api_python/app/services/distributed_runtime_host.py` (modified, +24/-3)
```diff
@@ -8,6 +8,7 @@
 from app.services.strategy_command_repository import StrategyCommandRepository
 from app.services.trading_executor import TradingExecutor
 from app.utils.logger import get_logger
+from app.utils.strategy_runtime_logs import append_strategy_log
 from app.workers.lease_heartbeat import LeaseHeartbeat
 
 
@@ -33,6 +34,7 @@ def __init__(
         self._lock = threading.RLock()
         self._lost_strategies: set[int] = set()
         self._owned_strategies: set[int] = set()
+        self._start_failures: dict[int, str] = {}
         self._lease_heartbeat = LeaseHeartbeat(
             self.owner_id,
             self.lease_seconds,
@@ -58,18 +60,29 @@ def evaluate(self, strategy_id: int, event, *, timeout: float = 60.0) -> bool:
                 self._owned_strategies.add(strategy_id)
                 self._lease_heartbeat.watch_strategy(strategy_id)
                 if not self.executor.start_strategy(strategy_id):
+                    detail = str(
+                        getattr(self.executor, "_last_start_failure", "")
+                        or "strategyRuntime.startFailed"
+                    )
+                    self._record_start_failure(strategy_id, detail)
                     self._release_runtime(strategy_id)
                     return False
                 started = True
         if started:
-            ready, _hint = self.executor.wait_strategy_running(
+            ready, hint = self.executor.wait_strategy_running(
+                strategy_id,
+                timeout=min(max(1.0, timeout), 30.0),
+            )
+            if not ready:
+                self._record_start_failure(
                     strategy_id,
-                    timeout=min(max(1.0, timeout), 30.0),
+                    str(hint or "strategyRuntime.startFailed"),
                 )
-            if not ready:
                 self.executor.stop_strategy(strategy_id, persist_status=False)
                 self._release_runtime(strategy_id)
                 return False
+        with self._lock:
+            self._start_failures.pop(strategy_id, None)
         if not self._runtime_valid(strategy_id):
             return False
         return self.executor.trigger_bar_evaluation(
@@ -78,6 +91,14 @@ def evaluate(self, strategy_id: int, event, *, timeout: float = 60.0) -> bool:
             timeout=timeout,
         )
 
+    def _record_start_failure(self, strategy_id: int, detail: str) -> None:
+        strategy_id = int(strategy_id)
+        with self._lock:
+            if self._start_failures.get(strategy_id) == detail:
+                return
+            self._start_failures[strategy_id] = detail
+        append_strategy_log(strategy_id, "error", detail)
+
     def reconcile(self, running_strategy_ids: set[int] | None = None) -> None:
         local_ids = set(self.local_strategy_ids())
         desired = local_ids if running_strategy_ids is None else {
```

**File**: `backend_api_python/app/services/strategy_command_repository.py` (modified, +44/-2)
```diff
@@ -81,8 +81,28 @@ def enqueue(
                 )
                 row = cur.fetchone()
                 if row:
+                    command = StrategyCommand.from_row(dict(row))
+                    if (
+                        command_type == "stop"
+                        and bool((payload or {}).get("close_positions"))
+                        and not bool(command.payload.get("close_positions"))
+                    ):
+                        cur.execute(
+                            """
+                            UPDATE qd_strategy_commands
+                            SET payload_json = COALESCE(payload_json, '{}'::jsonb)
+                                || %s::jsonb,
+                                updated_at = NOW()
+                            WHERE id = %s
+                            RETURNING *
+                            """,
+                            (json.dumps({"close_positions": True}), command.id),
+                        )
+                        upgraded = cur.fetchone()
+                        if upgraded:
+                            command = StrategyCommand.from_row(dict(upgraded))
                     db.commit()
-                    return StrategyCommand.from_row(dict(row))
+                    return command
 
                 cur.execute(
                     """
@@ -122,7 +142,7 @@ def claim_next(self, *, owner_id: str, lease_seconds: int, max_attempts: int) ->
                             (command.status = 'processing' AND command.lease_expires_at < NOW())
                           )
                           AND (
-                            command.command_type IN ('start', 'reconcile')
+                            command.command_type IN ('start', 'stop', 'reconcile')
                             OR lease.strategy_id IS NULL
                             OR lease.owner_id = %s
                             OR lease.lease_expires_at < NOW()
@@ -315,6 +335,28 @@ def release_strategy_lease(self, *, strategy_id: int, owner_id: str) -> None:
             finally:
                 cur.close()
 
+    def revoke_strategy_lease(self, *, strategy_id: int) -> bool:
+        with get_db_connection() as db:
+            cur = db.cursor()
+            try:
+                cur.execute(
+                    """
+                    UPDATE qd_strategy_runtime_leases
+                    SET owner_id = '',
+                        fencing_token = fencing_token + 1,
+                        lease_expires_at = NOW() - INTERVAL '1 second',
+                        heartbeat_at = NOW(),
+                        updated_at = NOW()
+                    WHERE strategy_id = %s
+                    """,
+                    (int(strategy_id),),
+                )
+                revoked = cur.rowcount == 1
+                db.commit()
+                return revoked
+            finally:
+                cur.close()
+
     def record_worker_heartbeat(
         self,
         *,
```

**File**: `backend_api_python/app/workers/trading.py` (modified, +2/-0)
```diff
@@ -297,11 +297,13 @@ def _stop_strategy(self, strategy_id: int, *, close_positions: bool = False) ->
                 strategy_id=strategy_id,
                 owner_id=self.worker_id,
             )
+            self.repository.revoke_strategy_lease(strategy_id=strategy_id)
             return result
         if not self.executor.stop_strategy(strategy_id, persist_status=True):
             raise RuntimeError("Executor failed to stop the local strategy runtime.")
         self._lease_heartbeat.forget_strategy(strategy_id)
         self.repository.release_strategy_lease(strategy_id=strategy_id, owner_id=self.worker_id)
+        self.repository.revoke_strategy_lease(strategy_id=strategy_id)
         return {"strategy_id": strategy_id, "status": "stopped"}
 
     def _reconcile(self, strategy_id: int) -> dict:
```

**File**: `backend_api_python/tests/test_distributed_runtime_host.py` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+from __future__ import annotations
+
+import threading
+
+from app.services import distributed_runtime_host as host_module
+from app.services.distributed_runtime_host import DistributedRuntimeHost
+
+
+class FakeHeartbeat:
+    def __init__(self, *_args, **_kwargs):
+        self.watched = set()
+
+    def start(self):
+        return None
+
+    def watch_strategy(self, strategy_id):
+        self.watched.add(int(strategy_id))
+
+    def forget_strategy(self, strategy_id):
+        self.watched.discard(int(strategy_id))
+
+    def strategy_valid(self, strategy_id):
+        return int(strategy_id) in self.watched
+
+    def close(self):
+        return None
+
+
+class FakeRepository:
+    def __init__(self):
+        self.released = []
+
+    def acquire_strategy_lease(self, **_kwargs):
+        return 9
+
+    def release_strategy_lease(self, *, strategy_id, owner_id):
+        self.released.append((int(strategy_id), owner_id))
+
+
+class RejectingExecutor:
+    def __init__(self):
+        self.lock = threading.Lock()
+        self.runtime_guard = None
+        self.running_strategies = {}
+        self._last_start_failure = "Bitget position mode does not match the strategy."
+        self.cleared = []
+
+    def _discard_dead_runtimes(self):
+        return None
+
+    def is_running(self, _strategy_id):
+        return False
+
+    def set_runtime_fencing_token(self, _strategy_id, _token):
+        return None
+
+    def clear_runtime_fencing_token(self, strategy_id):
+        self.cleared.append(int(strategy_id))
+
+    def start_strategy(self, _strategy_id):
+        return False
+
+
+def test_distributed_start_failure_is_logged_once_with_exact_detail(monkeypatch):
+    logs = []
+    repository = FakeRepository()
+    monkeypatch.setattr(host_module, "LeaseHeartbeat", FakeHeartbeat)
+    monkeypatch.setattr(
+        host_module,
+        "append_strategy_log",
+        lambda strategy_id, level, message: logs.append((strategy_id, level, message)),
+    )
+    host = DistributedRuntimeHost(
+        owner_id="evaluator-a",
+        executor=RejectingExecutor(),
+        repository=repository,
+    )
+
+    assert host.evaluate(55, object()) is False
+    assert host.evaluate(55, object()) is False
+
+    assert logs == [
+        (55, "error", "Bitget position mode does not match the strategy."),
+    ]
+    assert repository.released == [(55, "evaluator-a"), (55, "evaluator-a")]
```

**File**: `backend_api_python/tests/test_runtime_fencing.py` (modified, +31/-0)
```diff
@@ -103,6 +103,37 @@ def test_releasing_runtime_lease_preserves_fencing_row(monkeypatch):
     assert params == (11, "worker-a")
 
 
+def test_revoking_runtime_lease_invalidates_any_owner(monkeypatch):
+    connection = FakeConnection(None)
+    connection.commit = lambda: None
+    monkeypatch.setattr(repository_module, "get_db_connection", lambda: connection)
+
+    assert StrategyCommandRepository().revoke_strategy_lease(strategy_id=11) is True
+
+    sql, params = connection.cursor_value.executions[0]
+    assert "UPDATE qd_strategy_runtime_leases" in sql
+    assert "fencing_token = fencing_token + 1" in sql
+    assert "owner_id = ''" in sql
+    assert "owner_id = %s" not in sql
+    assert params == (11,)
+
+
+def test_stop_command_can_be_claimed_across_runtime_owners(monkeypatch):
+    connection = FakeConnection(None)
+    connection.commit = lambda: None
+    connection.rollback = lambda: None
+    monkeypatch.setattr(repository_module, "get_db_connection", lambda: connection)
+
+    assert StrategyCommandRepository().claim_next(
+        owner_id="worker-a",
+        lease_seconds=30,
+        max_attempts=3,
+    ) is None
+
+    sql, _params = connection.cursor_value.executions[0]
+    assert "command.command_type IN ('start', 'stop', 'reconcile')" in sql
+
+
 def test_releasing_shard_lease_preserves_fencing_row(monkeypatch):
     connection = FakeConnection(None)
     connection.commit = lambda: None
```

**File**: `backend_api_python/tests/test_strategy_command_repository.py` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+from __future__ import annotations
+
+from app.services import strategy_command_repository as repository_module
+from app.services.strategy_command_repository import StrategyCommandRepository
+
+
+def _command_row(*, close_positions: bool) -> dict:
+    return {
+        "id": 17,
+        "strategy_id": 55,
+        "user_id": 1,
+        "command_type": "stop",
+        "status": "pending",
+        "idempotency_key": "stop-55",
+        "payload_json": {"close_positions": close_positions},
+        "result_json": {},
+        "attempts": 0,
+        "error_message": "",
+    }
+
+
+class FakeCursor:
+    def __init__(self):
+        self.executions = []
+        self.current_sql = ""
+
+    def execute(self, sql, params):
+        self.current_sql = sql
+        self.executions.append((sql, params))
+
+    def fetchone(self):
+        if "SELECT * FROM qd_strategy_commands" in self.current_sql:
+            return _command_row(close_positions=False)
+        if "SET payload_json" in self.current_sql:
+            return _command_row(close_positions=True)
+        return None
+
+    def close(self):
+        return None
+
+
+class FakeConnection:
+    def __init__(self):
+        self.cursor_value = FakeCursor()
+
+    def __enter__(self):
+        return self
+
+    def __exit__(self, *_args):
+        return False
+
+    def cursor(self):
+        return self.cursor_value
+
+    def commit(self):
+        return None
+
+    def rollback(self):
+        return None
+
+
+def test_pending_pause_is_upgraded_to_pause_and_close(monkeypatch):
+    connection = FakeConnection()
+    monkeypatch.setattr(repository_module, "get_db_connection", lambda: connection)
+
+    command = StrategyCommandRepository().enqueue(
+        strategy_id=55,
+        command_type="stop",
+        user_id=1,
+        payload={"close_positions": True},
+        idempotency_key="stop-55-close",
+    )
+
+    assert command.payload["close_positions"] is True
+    upgrade_sql, upgrade_params = connection.cursor_value.executions[2]
+    assert "SET payload_json" in upgrade_sql
+    assert upgrade_params == ('{"close_positions": true}', 17)
```

**File**: `backend_api_python/tests/test_strategy_stop_response.py` (modified, +2/-2)
```diff
@@ -9,8 +9,8 @@
 
 
 @pytest.mark.parametrize("close_positions,result,http_status,message,persist", [
-    (False, {"success": True, "status": "stopping", "command_id": 7}, 202, "strategyV2.stopQueued", False),
-    (True, {"success": True, "status": "stopping", "command_id": 7}, 202, "strategyV2.stopAndCloseQueued", False),
+    (False, {"success": True, "status": "stopping", "command_id": 7}, 202, "strategyV2.stopQueued", True),
+    (True, {"success": True, "status": "stopping", "command_id": 7}, 202, "strategyV2.stopAndCloseQueued", True),
     (False, {"success": True, "status": "stopped"}, 200, "strategyV2.paused", True),
     (True, {"success": True, "status": "stopped", "close_positions_found": 0}, 200, "strategyV2.stoppedNoPositions", True),
     (True, {"success": True, "status": "stopped", "close_orders_queued": 1}, 200, "strategyV2.stoppedAndCloseQueued", True),
```

---

### Incident Patch 9: `7a7177a1` (2026-10-01)
**Commit Message**: fix: complete distributed strategy stop commands

**File**: `backend_api_python/app/routes/strategy.py` (modified, +40/-8)
```diff
@@ -106,6 +106,22 @@ def _error(message: str, status: int = 400, data: Any = None):
     return jsonify({"code": 0, "msg": message, "data": data}), status
 
 
+def _stop_result_message(result: dict[str, Any]) -> str:
+    close_positions = bool(result.get("close_requested"))
+    status = str(result.get("status") or "")
+    if status == "stopping":
+        return "strategyV2.stopAndCloseQueued" if close_positions else "strategyV2.stopQueued"
+    if not close_positions:
+        return "strategyV2.paused"
+    if result.get("close_positions_found") == 0:
+        return "strategyV2.stoppedNoPositions"
+    completed = int(result.get("close_orders_completed") or 0)
+    queued = int(result.get("close_orders_queued") or 0)
+    if completed > 0 and completed == queued:
+        return "strategyV2.stoppedAndVirtualCloseCompleted"
+    return "strategyV2.stoppedAndCloseQueued"
+
+
 def _strategy(strategy_id: int):
     return get_strategy_service().get_strategy(int(strategy_id), user_id=int(g.user_id))
 
@@ -250,6 +266,7 @@ def stop_strategy(strategy_id: int):
         strategy_id,
         close_positions=close_positions,
     )
+    result.setdefault("close_requested", close_positions)
     status = str(result.get("status") or "")
     if status == "stopped":
         get_strategy_service().update_strategy_status(strategy_id, "stopped", user_id=int(g.user_id))
@@ -258,14 +275,29 @@ def stop_strategy(strategy_id: int):
         message = "strategyV2.stopClosePartialFailure" if close_positions and status == "stopped" else "strategyV2.stopFailed"
         return _error(message, 409, data=data)
     if status == "stopping":
-        return _ok(data, "strategyV2.stopQueued"), 202
-    completed = int(result.get("close_orders_completed") or 0)
-    queued = int(result.get("close_orders_queued") or 0)
-    if close_positions and completed > 0 and completed == queued:
-        message = "strategyV2.stoppedAndVirtualCloseCompleted"
-    else:
-        message = "strategyV2.stoppedAndCloseQueued" if close_positions else "strategyV2.paused"
-    return _ok(data, message)
+        return _ok(data, _stop_result_message(result)), 202
+    return _ok(data, _stop_result_message(result))
+
+
+@strategy_blp.route("/strategies/<int:strategy_id>/commands/<int:command_id>", methods=["GET"])
+@login_required
+def strategy_command_status(strategy_id: int, command_id: int):
+    if not _strategy(strategy_id):
+        return _error("strategyV2.strategyNotFound", 404)
+    executor = get_trading_executor()
+    get_status = getattr(executor, "get_command_status", None)
+    if not callable(get_status):
+        return _error("strategyV2.commandStatusUnavailable", 503)
+    result = get_status(strategy_id, command_id)
+    if result is None:
+        return _error("strategyV2.commandNotFound", 404)
+    status = str(result.get("status") or "")
+    if status == "stopped":
+        get_strategy_service().update_strategy_status(strategy_id, "stopped", user_id=int(g.user_id))
+    if not result.get("success"):
+        message = "strategyV2.stopClosePartialFailure" if status == "stopped" else "strategyV2.stopFailed"
+        return _error(message, 409, data=result)
+    return _ok(result, _stop_result_message(result))
 
 
 @strategy_blp.route("/strategies/exchange/test", methods=["POST"])
```

**File**: `backend_api_python/app/services/strategy_command_client.py` (modified, +33/-0)
```diff
@@ -121,6 +121,39 @@ def stop_strategy_with_policy(
                 "close_errors": [str(exc)],
             }
 
+    def get_command_status(self, strategy_id: int, command_id: int) -> dict | None:
+        command = self.repository.get(int(command_id))
+        if command is None or int(command.strategy_id) != int(strategy_id):
+            return None
+        base = {
+            "command_id": int(command.id),
+            "command_status": str(command.status),
+            "attempts": int(command.attempts or 0),
+            "close_requested": bool(command.payload.get("close_positions")),
+        }
+        if command.status == "succeeded":
+            result = dict(command.result or {})
+            result.setdefault("success", True)
+            result.setdefault("status", "stopped" if command.command_type == "stop" else command.status)
+            result.setdefault("close_orders_queued", 0)
+            result.setdefault("close_errors", [])
+            return {**base, **result}
+        if command.status in {"failed", "cancelled"}:
+            return {
+                **base,
+                "success": False,
+                "status": "running",
+                "close_orders_queued": 0,
+                "close_errors": [command.error_message] if command.error_message else [],
+            }
+        return {
+            **base,
+            "success": True,
+            "status": "stopping" if command.command_type == "stop" else command.status,
+            "close_orders_queued": 0,
+            "close_errors": [],
+        }
+
     def _wait(self, command_id: int, timeout: float):
         deadline = time.monotonic() + max(0.0, float(timeout))
         interval = max(0.05, float(os.getenv("STRATEGY_COMMAND_POLL_SEC", "0.2")))
```

**File**: `backend_api_python/app/services/trading_executor.py` (modified, +3/-0)
```diff
@@ -522,6 +522,7 @@ def stop_strategy_with_policy(
             "success": bool(stopped),
             "status": "stopped" if stopped else "running",
             "close_requested": bool(close_positions),
+            "close_positions_found": len(positions),
             "close_orders_queued": 0,
             "close_errors": [],
         }
@@ -587,6 +588,7 @@ def _stop_signal_strategy_with_virtual_close(
             "success": bool(stopped),
             "status": "stopped" if stopped else "running",
             "close_requested": True,
+            "close_positions_found": 0,
             "close_orders_queued": 0,
             "close_orders_completed": 0,
             "close_errors": [],
@@ -608,6 +610,7 @@ def _stop_signal_strategy_with_virtual_close(
             )
             positions = [dict(row) for row in (cur.fetchall() or [])]
             cur.close()
+        result["close_positions_found"] = len(positions)
         if not positions:
             return result
 
```

**File**: `backend_api_python/app/workers/trading.py` (modified, +1/-3)
```diff
@@ -281,10 +281,8 @@ def _stop_strategy(self, strategy_id: int, *, close_positions: bool = False) ->
             unregister_streams = getattr(self.executor, "unregister_market_streams", None)
             if callable(unregister_streams):
                 unregister_streams(strategy_id)
-            was_distributed = strategy_id in self._distributed_strategy_ids
             self._distributed_strategy_ids.discard(strategy_id)
-            if was_distributed and strategy_id not in self._local_strategy_ids():
-                return {"strategy_id": strategy_id, "status": "stopped"}
+            self._remote_strategy_ids.discard(strategy_id)
         if close_positions:
             result = self.executor.stop_strategy_with_policy(
                 strategy_id,
```

**File**: `backend_api_python/tests/test_hedged_live_strategy_contract.py` (modified, +25/-0)
```diff
@@ -599,6 +599,11 @@ def close(self):
         return None
 
 
+class _EmptyStopCursor(_StopCursor):
+    def fetchall(self):
+        return []
+
+
 def test_stop_policy_distinguishes_pause_only_from_pause_and_close(monkeypatch):
     executor = TradingExecutor()
     strategy = _strategy(40, "long")
@@ -625,6 +630,26 @@ def test_stop_policy_distinguishes_pause_only_from_pause_and_close(monkeypatch):
     ]
 
 
+def test_stop_and_close_without_positions_completes_without_an_order(monkeypatch):
+    import app.services.trading_executor as trading_executor_module
+
+    executor = TradingExecutor()
+    strategy = _strategy(40, "long")
+    monkeypatch.setattr(executor, "_load_strategy", lambda _sid: strategy)
+    monkeypatch.setattr(executor, "stop_strategy", lambda _sid: True)
+    monkeypatch.setattr(trading_executor_module, "get_db_connection", lambda: _Db(_EmptyStopCursor()))
+    submitted = []
+    executor.order_gateway.submit = lambda request: submitted.append(request) or len(submitted)
+
+    result = executor.stop_strategy_with_policy(40, close_positions=True)
+
+    assert result["success"] is True
+    assert result["status"] == "stopped"
+    assert result["close_positions_found"] == 0
+    assert result["close_orders_queued"] == 0
+    assert submitted == []
+
+
 def test_signal_stop_and_close_settles_virtual_positions_without_live_orders(monkeypatch):
     import app.services.trading_executor as trading_executor_module
     import app.services.virtual_trading as virtual_trading_module
```

**File**: `backend_api_python/tests/test_strategy_command_client.py` (modified, +44/-0)
```diff
@@ -122,3 +122,47 @@ def fail(**kwargs):
     result = StrategyCommandClient(repository).stop_strategy_with_policy(9)
     assert result["success"] is False
     assert "command_id" not in result
+
+
+def test_command_status_reports_pending_stop_without_claiming_completion(monkeypatch):
+    repository = FakeRepository(status="processing")
+    client = StrategyCommandClient(repository)
+    monkeypatch.setenv("STRATEGY_COMMAND_STOP_WAIT_SEC", "0")
+    client.stop_strategy_with_policy(9, close_positions=True)
+
+    result = client.get_command_status(9, 1)
+
+    assert result["success"] is True
+    assert result["status"] == "stopping"
+    assert result["command_status"] == "processing"
+    assert result["close_requested"] is True
+
+
+def test_command_status_preserves_terminal_stop_result():
+    repository = FakeRepository(status="succeeded")
+    client = StrategyCommandClient(repository)
+    client.stop_strategy_with_policy(9, close_positions=True)
+    repository.commands[0] = replace(
+        repository.commands[0],
+        result={
+            "success": True,
+            "status": "stopped",
+            "close_requested": True,
+            "close_positions_found": 0,
+        },
+    )
+
+    result = client.get_command_status(9, 1)
+
+    assert result["status"] == "stopped"
+    assert result["close_positions_found"] == 0
+    assert result["command_status"] == "succeeded"
+
+
+def test_command_status_rejects_another_strategy_command(monkeypatch):
+    repository = FakeRepository(status="pending")
+    client = StrategyCommandClient(repository)
+    monkeypatch.setenv("STRATEGY_COMMAND_STOP_WAIT_SEC", "0")
+    client.stop_strategy_with_policy(9)
+
+    assert client.get_command_status(10, 1) is None
```

**File**: `backend_api_python/tests/test_strategy_stop_response.py` (modified, +41/-1)
```diff
@@ -10,8 +10,9 @@
 
 @pytest.mark.parametrize("close_positions,result,http_status,message,persist", [
     (False, {"success": True, "status": "stopping", "command_id": 7}, 202, "strategyV2.stopQueued", False),
-    (True, {"success": True, "status": "stopping", "command_id": 7}, 202, "strategyV2.stopQueued", False),
+    (True, {"success": True, "status": "stopping", "command_id": 7}, 202, "strategyV2.stopAndCloseQueued", False),
     (False, {"success": True, "status": "stopped"}, 200, "strategyV2.paused", True),
+    (True, {"success": True, "status": "stopped", "close_positions_found": 0}, 200, "strategyV2.stoppedNoPositions", True),
     (True, {"success": True, "status": "stopped", "close_orders_queued": 1}, 200, "strategyV2.stoppedAndCloseQueued", True),
     (False, {"success": False, "status": "running"}, 409, "strategyV2.stopFailed", False),
     (True, {"success": False, "status": "running"}, 409, "strategyV2.stopFailed", False),
@@ -33,3 +34,42 @@ def test_stop_response_matches_execution_state(monkeypatch, close_positions, res
     assert response.json["data"] == {"id": 20, **result}
     assert service.update_strategy_status.called is persist
     executor.stop_strategy_with_policy.assert_called_once_with(20, close_positions=close_positions)
+
+
+def test_stop_command_status_persists_terminal_worker_result(monkeypatch):
+    service = Mock()
+    executor = Mock()
+    executor.get_command_status.return_value = {
+        "success": True,
+        "status": "stopped",
+        "command_id": 7,
+        "command_status": "succeeded",
+        "close_requested": True,
+        "close_positions_found": 0,
+    }
+    monkeypatch.setattr(routes, "_strategy", lambda _: {"id": 20})
+    monkeypatch.setattr(routes, "get_strategy_service", lambda: service)
+    monkeypatch.setattr(routes, "get_trading_executor", lambda: executor)
+    app = Flask(__name__)
+    with app.test_request_context():
+        g.user_id = 1
+        response = app.make_response(unwrap(routes.strategy_command_status)(20, 7))
+
+    assert response.status_code == 200
+    assert response.json["msg"] == "strategyV2.stoppedNoPositions"
+    assert response.json["data"]["command_status"] == "succeeded"
+    service.update_strategy_status.assert_called_once_with(20, "stopped", user_id=1)
+
+
+def test_stop_command_status_cannot_cross_strategy_boundary(monkeypatch):
+    executor = Mock()
+    executor.get_command_status.return_value = None
+    monkeypatch.setattr(routes, "_strategy", lambda _: {"id": 20})
+    monkeypatch.setattr(routes, "get_trading_executor", lambda: executor)
+    app = Flask(__name__)
+    with app.test_request_context():
+        g.user_id = 1
+        response = app.make_response(unwrap(routes.strategy_command_status)(20, 99))
+
+    assert response.status_code == 404
+    assert response.json["msg"] == "strategyV2.commandNotFound"
```

**File**: `backend_api_python/tests/test_trading_worker_boundaries.py` (modified, +37/-1)
```diff
@@ -23,6 +23,8 @@ def __init__(self, *, stop_result: bool = True) -> None:
         self.lock = __import__("threading").Lock()
         self.stopped = []
         self.registered_streams = []
+        self.unregistered_streams = []
+        self.policy_stops = []
         self.stop_result = stop_result
         self.handoffs = []
 
@@ -43,6 +45,9 @@ def clear_runtime_fencing_token(self, strategy_id):
     def register_market_streams(self, strategy_id, streams):
         self.registered_streams.append((int(strategy_id), set(streams)))
 
+    def unregister_market_streams(self, strategy_id):
+        self.unregistered_streams.append(int(strategy_id))
+
     def stop_strategy(self, strategy_id, persist_status=False, preserve_run=False):
         del persist_status
         self.stopped.append(int(strategy_id))
@@ -53,11 +58,14 @@ def stop_strategy(self, strategy_id, persist_status=False, preserve_run=False):
         return self.stop_result
 
     def stop_strategy_with_policy(self, strategy_id, *, close_positions):
-        del close_positions
+        self.policy_stops.append((int(strategy_id), bool(close_positions)))
         stopped = self.stop_strategy(strategy_id)
         return {
             "strategy_id": strategy_id,
             "success": stopped,
+            "status": "stopped" if stopped else "running",
+            "close_requested": bool(close_positions),
+            "close_positions_found": 0,
             "message": "runtime stop timeout" if not stopped else "",
         }
 
@@ -191,6 +199,34 @@ def test_distributed_bar_start_registers_routes_without_local_runtime(monkeypatc
     assert executor.running_strategies == {}
 
 
+def test_distributed_stop_and_close_runs_full_stop_policy(monkeypatch):
+    from app.services.strategy_event_subscriptions import (
+        StrategyEventSubscriptionRepository,
+    )
+
+    removed = []
+    monkeypatch.setenv("STRATEGY_DISTRIBUTED_BAR_ENABLED", "true")
+    monkeypatch.setattr(
+        StrategyEventSubscriptionRepository,
+        "remove_strategy",
+        lambda _self, strategy_id: removed.append(int(strategy_id)),
+    )
+    repository = FakeRepository()
+    executor = FakeExecutor()
+    worker = TradingWorker(executor, repository)
+    worker._distributed_strategy_ids.add(55)
+
+    result = worker._stop_strategy(55, close_positions=True)
+
+    assert result["status"] == "stopped"
+    assert result["close_positions_found"] == 0
+    assert removed == [55]
+    assert executor.unregistered_streams == [55]
+    assert executor.policy_stops == [(55, True)]
+    assert repository.released == [(55, worker.worker_id)]
+    assert 55 not in worker._distributed_strategy_ids
+
+
 def test_distributed_restore_does_not_reregister_an_active_strategy(monkeypatch):
     from app.services.strategy import StrategyService
     from app.services.strategy_event_subscriptions import (
```

---

### Incident Patch 10: `816a7ef3` (2026-10-01)
**Commit Message**: fix: mark live strategy positions with venue prices

**File**: `backend_api_python/app/routes/strategy_positions_routes.py` (modified, +1/-6)
```diff
@@ -83,12 +83,7 @@ def get_positions():
                 continue
             entry = float(r.get("entry_price") or 0.0)
             current_price = float(r.get("current_price") or entry or 0.0)
-            stored_pnl = r.get("unrealized_pnl")
-            pnl = (
-                float(stored_pnl)
-                if stored_pnl is not None
-                else calc_unrealized_pnl(side, entry, current_price, size)
-            )
+            pnl = calc_unrealized_pnl(side, entry, current_price, size)
             pct = calc_pnl_percent(
                 entry,
                 size,
```

**File**: `backend_api_python/app/services/live_trading/records.py` (modified, +99/-1)
```diff
@@ -15,9 +15,10 @@
 
 import time
 import json
-from typing import Any, Dict, List, Optional, Set, Tuple, TYPE_CHECKING
+from typing import Any, Dict, List, Mapping, Optional, Set, Tuple, TYPE_CHECKING
 
 from app.utils.db import get_db_connection
+from app.utils.pnl import calc_unrealized_pnl
 
 if TYPE_CHECKING:
     from app.services.live_trading.leg_context import LegContext
@@ -635,6 +636,11 @@ def patch_position_markers(
     if not row or float(row.get("size") or 0.0) <= 0:
         return False
 
+    size = max(0.0, float(row.get("size") or 0.0))
+    entry_price = max(0.0, float(row.get("entry_price") or 0.0))
+    unrealized = calc_unrealized_pnl(side_l, entry_price, px, size)
+    notional = entry_price * size
+    pnl_percent = unrealized / notional * 100.0 if notional > 0 else 0.0
     hp = float(highest_price or 0.0)
     lp = float(lowest_price or 0.0)
     with get_db_connection() as db:
@@ -645,6 +651,8 @@ def patch_position_markers(
             SET current_price = %s,
                 highest_price = CASE WHEN %s > 0 THEN %s ELSE highest_price END,
                 lowest_price = CASE WHEN %s > 0 THEN %s ELSE lowest_price END,
+                unrealized_pnl = %s,
+                pnl_percent = %s,
                 updated_at = NOW()
             WHERE strategy_id = %s AND symbol = %s AND side = %s AND size > 0
             """,
@@ -654,6 +662,8 @@ def patch_position_markers(
                 hp,
                 lp,
                 lp,
+                unrealized,
+                pnl_percent,
                 int(strategy_id),
                 str(sym_key),
                 side_l,
@@ -665,6 +675,94 @@ def patch_position_markers(
     return updated
 
 
+def mark_live_positions(
+    strategy_id: int,
+    prices: Mapping[str, Any],
+) -> int:
+    """Mark one strategy ledger from venue-scoped runtime prices."""
+    normalized_prices: Dict[str, float] = {}
+    ambiguous_symbols: Set[str] = set()
+    for instrument_key, raw_price in (prices or {}).items():
+        text = str(instrument_key or "").strip()
+        if ":" in text:
+            text = text.split(":", 1)[-1]
+        symbol_key = normalize_strategy_symbol(text.split("@", 1)[0])
+        try:
+            price = float(raw_price or 0.0)
+        except (TypeError, ValueError):
+            continue
+        if not symbol_key or price <= 0:
+            continue
+        previous = normalized_prices.get(symbol_key)
+        if previous is not None and abs(previous - price) > max(1e-10, abs(previous) * 1e-10):
+            ambiguous_symbols.add(symbol_key)
+            continue
+        normalized_prices[symbol_key] = price
+    for symbol_key in ambiguous_symbols:
+        normalized_prices.pop(symbol_key, None)
+    if not normalized_prices:
+        return 0
+
+    updated = 0
+    with get_db_connection() as db:
+        cur = db.cursor()
+        cur.execute(
+            """
+            SELECT id, symbol_canonical, symbol, side, size, entry_price
+            FROM qd_strategy_positions
+            WHERE strategy_id = %s AND size > 0
+            FOR UPDATE
+            """,
+            (int(strategy_id),),
+        )
+        rows = cur.fetchall() or []
+        for raw in rows:
+            row = dict(raw)
+            symbol_key = normalize_strategy_symbol(
+                str(row.get("symbol_canonical") or row.get("symbol") or "")
+            )
+            current_price = normalized_prices.get(symbol_key)
+            if not current_price:
+                continue
+            size = max(0.0, float(row.get("size") or 0.0))
+            entry_price = max(0.0, float(row.get("entry_price") or 0.0))
+            if size <= 1e-12 or entry_price <= 0:
+                continue
+            side = str(row.get("side") or "long").strip().lower()
+            unrealized = calc_unrealized_pnl(side, entry_price, current_price, size)
+            notional = entry_price * size
+            pnl_percent = unrealized / notional * 100.0 if notional > 0 else 0.0
+            cur.execute(
+                """
+                UPDATE qd_strategy_positions
+                SET current_price = %s,
+                    highest_price = GREATEST(COALESCE(highest_price, 0), %s),
+                    lowest_price = CASE
+                        WHEN COALESCE(lowest_price, 0) <= 0 THEN %s
+                        ELSE LEAST(lowest_price, %s)
+                    END,
+                    unrealized_pnl = %s,
+                    pnl_percent = %s,
+                    updated_at = NOW()
+                WHERE id = %s AND strategy_id = %s AND size > 0
+                """,
+                (
+                    current_price,
+                    current_price,
+                    current_price,
+                    current_price,
+                    unrealized,
+                    pnl_percent,
+                    int(row.get("id") or 0),
+                    int(strategy_id),
+                ),
+            )
+            updated
```

**File**: `backend_api_python/app/services/trading_executor.py` (modified, +26/-0)
```diff
@@ -965,11 +965,13 @@ def wake_for_closed_bar(event) -> None:
                 1.0,
                 min(60.0, configured_state_write_interval),
             )
+            position_mark_interval = state_write_interval
             price_stale_after = max(
                 risk_tick * 3.0,
                 min(30.0, float(trading_config.get("price_stale_after_seconds") or 10.0)),
             )
             next_signal_poll = 0.0
+            next_position_mark_at = 0.0
             last_signal_bar_token: int | None = None
             last_processed_frame_timestamp: pd.Timestamp | None = None
             initial_frames_pending = True
@@ -1031,6 +1033,16 @@ def wake_for_closed_bar(event) -> None:
                     elif stale_price_logged:
                         append_strategy_log(strategy_id, "info", "Live price feed recovered")
                         stale_price_logged = False
+                    if (
+                        execution_mode == "live"
+                        and active_prices
+                        and positions
+                        and price_clock >= next_position_mark_at
+                    ):
+                        from app.services.live_trading.records import mark_live_positions
+
+                        mark_live_positions(strategy_id, active_prices)
+                        next_position_mark_at = price_clock + position_mark_interval
                     if execution_mode == "signal" and active_prices:
                         from app.services.virtual_trading import (
                             mark_virtual_positions,
@@ -1968,6 +1980,15 @@ def evaluate_grid_risk(price: float) -> List[Dict[str, Any]]:
         if not ok:
             raise RuntimeError(f"grid.startupFailed:{message}")
         tick_seconds = max(0.25, min(5.0, float(trading_config.get("risk_tick_seconds") or 1)))
+        try:
+            position_mark_interval = float(
+                trading_config.get("state_write_interval_seconds")
+                or os.getenv("STRATEGY_STATE_WRITE_INTERVAL_SEC", "5")
+            )
+        except (TypeError, ValueError):
+            position_mark_interval = 5.0
+        position_mark_interval = max(1.0, min(60.0, position_mark_interval))
+        next_position_mark_at = 0.0
         last_prices: dict[str, float] = {}
         stale_logged = False
         grid_exit_reason = "grid strategy stopped"
@@ -1995,6 +2016,11 @@ def evaluate_grid_risk(price: float) -> List[Dict[str, Any]]:
                 current_price = float(prices.get(key) or 0)
                 if current_price > 0:
                     last_prices[key] = current_price
+                    if cycle_started >= next_position_mark_at:
+                        from app.services.live_trading.records import mark_live_positions
+
+                        mark_live_positions(strategy_id, {key: current_price})
+                        next_position_mark_at = cycle_started + position_mark_interval
                     runner.tick(current_price, high=current_price, low=current_price, bars_df=frame)
                     runner.checkpoint()
                     if stale_logged:
```

**File**: `backend_api_python/tests/test_strategy_position_sync.py` (modified, +78/-0)
```diff
@@ -1,7 +1,12 @@
 """Tests for local position snapshot helpers used by live sync and UI."""
 
+from contextlib import contextmanager
+
+import pytest
+
 from app.services.live_trading.records import (
     lookup_exchange_side_qty,
+    mark_live_positions,
     normalize_strategy_symbol,
     strategy_allowed_symbols,
 )
@@ -133,3 +138,76 @@ def test_apply_exchange_snapshot_skips_unrelated_symbols(monkeypatch):
     assert written == 1
     assert len(upserts) == 1
     assert upserts[0]["symbol"] == "ETH/USDT"
+
+
+def test_mark_live_positions_updates_price_and_unrealized_pnl(monkeypatch):
+    from app.services.live_trading import records
+
+    updates = []
+
+    class Cursor:
+        rowcount = 0
+
+        def execute(self, query, params=()):
+            if "SELECT id, symbol_canonical" in query:
+                self.rowcount = 0
+            elif "UPDATE qd_strategy_positions" in query:
+                updates.append(params)
+                self.rowcount = 1
+
+        def fetchall(self):
+            return [{
+                "id": 7,
+                "symbol_canonical": "BTC/USDT",
+                "symbol": "BTC/USDT",
+                "side": "short",
+                "size": 0.0044,
+                "entry_price": 84135.9,
+            }]
+
+        def close(self):
+            return None
+
+    class Connection:
+        def cursor(self):
+            return Cursor()
+
+        def commit(self):
+            return None
+
+    @contextmanager
+    def connection():
+        yield Connection()
+
+    monkeypatch.setattr(records, "get_db_connection", connection)
+
+    count = mark_live_positions(
+        21,
+        {"Crypto:BTC/USDT@gate:swap": 84000.0},
+    )
+
+    assert count == 1
+    assert updates[0][0] == pytest.approx(84000.0)
+    assert updates[0][4] == pytest.approx((84135.9 - 84000.0) * 0.0044)
+    assert updates[0][5] > 0
+    assert updates[0][7] == 21
+
+
+def test_mark_live_positions_rejects_ambiguous_cross_venue_prices(monkeypatch):
+    from app.services.live_trading import records
+
+    monkeypatch.setattr(
+        records,
+        "get_db_connection",
+        lambda: pytest.fail("ambiguous venue prices must not reach the live ledger"),
+    )
+
+    count = mark_live_positions(
+        21,
+        {
+            "Crypto:BTC/USDT@binance:swap": 84000.0,
+            "Crypto:BTC/USDT@gate:swap": 84020.0,
+        },
+    )
+
+    assert count == 0
```

---

### Incident Patch 11: `b6e33359` (2026-10-01)
**Commit Message**: fix: restore CI release checks

**File**: `backend_api_python/app/routes/alpaca.py` (modified, +1/-1)
```diff
@@ -421,7 +421,7 @@ def place_order():
     Request body:
         symbol (required): Ticker, e.g. AAPL
         side (required): buy or sell
-        quantity or notional (required): Share quantity or USD amount
+        quantity or notional (required): Share quantity or USD amount; mutually exclusive
         marketType (optional): USStock or crypto (default USStock)
         orderType (optional): market or limit (default market)
         price (required for limit): Limit price
```

**File**: `backend_api_python/requirements.lock` (modified, +3/-3)
```diff
@@ -61,7 +61,7 @@ jsonschema==4.26.0
 jsonschema-specifications==2025.9.1
 kombu==5.6.2
 korean-lunar-calendar==0.4.0
-litellm==1.93.1
+litellm==1.93.2
 lxml==6.1.1
 markdown-it-py==4.2.0
 markupsafe==3.0.3
@@ -90,7 +90,7 @@ pycparser==3.0
 pydantic==2.13.4
 pydantic-core==2.46.4
 pygments==2.20.0
-pyjwt==2.13.0
+pyjwt==2.15.0
 pyluach==2.3.0
 pyotp==2.10.0
 pypdf==6.16.2
@@ -123,7 +123,7 @@ typing-extensions==4.16.0
 typing-inspection==0.4.2
 tzdata==2026.3
 tzlocal==5.4.4
-urllib3==2.7.0
+urllib3==2.8.0
 uvloop==0.22.1
 vine==5.1.0
 wcwidth==0.8.2
```

**File**: `backend_api_python/requirements.txt` (modified, +6/-3)
```diff
@@ -13,15 +13,18 @@ pandas>=3.0.5
 TA-Lib==0.7.1
 exchange-calendars>=4.13.2,<5
 requests>=2.34.2
+# CVE-2026-97687 and related redirect/decompression advisories; 2.8.0+
+urllib3>=2.8.0,<3
 websocket-client>=1.9.0,<2
-litellm>=1.93.0,<1.94
+# CVE-2026-84377; 1.93.2+
+litellm>=1.93.2,<1.94
 # ccxt 4.5.73 pins certifi==2026.6.17. Keep the direct floor
 # aligned with the exchange client until ccxt relaxes its constraint.
 certifi>=2026.6.17
 PySocks>=1.7.1
 akshare>=1.18.80
-# GHSA-752w-5fwx-jx9f (crit header); 2.12.0+
-PyJWT>=2.13.0,<3
+# GHSA-752w-5fwx-jx9f and 2026 JWT validation advisories; 2.15.0+
+PyJWT>=2.15.0,<3
 python-dotenv>=1.2.2
 # GHSA-g6cj-pr64-35w5 (PKCS#7 Bleichenbacher oracle); 50.0.0+
 # ccxt 4.5.73 currently constrains cryptography to the 50.x release line.
```

**File**: `backend_api_python/tests/test_runtime_io_optimizations.py` (modified, +5/-2)
```diff
@@ -56,6 +56,10 @@ def test_bar_event_bypasses_poll_throttle_at_boundary():
 def test_flat_crypto_bar_runtime_uses_idle_wait(monkeypatch):
     monkeypatch.setenv("BAR_IDLE_SCHEDULER_ENABLED", "1")
     monkeypatch.setenv("BAR_IDLE_WAKE_INTERVAL_SEC", "10")
+    monkeypatch.setattr(
+        "app.services.trading_executor.seconds_until_next_completed_bar",
+        lambda _frequency: 30.0,
+    )
 
     wait_seconds = _runtime_wait_seconds(
         risk_tick=1.0,
@@ -69,8 +73,7 @@ def test_flat_crypto_bar_runtime_uses_idle_wait(monkeypatch):
         market_ready=True,
     )
 
-    assert wait_seconds > 1.0
-    assert wait_seconds <= 10.0
+    assert wait_seconds == 10.0
 
 
 def test_active_runtime_keeps_risk_tick(monkeypatch):
```

---

### Incident Patch 12: `b5ed54d1` (2026-09-28)
**Commit Message**: test: update quick trade cancel dependency patch

**File**: `backend_api_python/tests/test_quick_trade_cancel.py` (modified, +2/-1)
```diff
@@ -6,6 +6,7 @@
 from app.routes import quick_trade
 from app.services.live_trading import fee_quote
 from app.services.pending_orders import live_order_phases
+from app.services.quick_trade import products
 
 
 class _Cursor:
@@ -70,7 +71,7 @@ def fake_cancel(**kwargs):
         return {"status": "cancelled"}
 
     monkeypatch.setattr(quick_trade, "get_db_connection", fake_connection)
-    monkeypatch.setattr(quick_trade, "build_exchange_config", lambda *args, **kwargs: {"market_type": "swap"})
+    monkeypatch.setattr(products, "build_exchange_config", lambda *args, **kwargs: {"market_type": "swap"})
     monkeypatch.setattr(quick_trade, "create_exchange_client", lambda *args, **kwargs: client)
     monkeypatch.setattr(live_order_phases, "cancel_live_limit_order", fake_cancel)
     monkeypatch.setattr(
```

---

### Incident Patch 13: `572ee86c` (2026-09-28)
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

### Incident Patch 14: `d4969980` (2026-09-28)
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

**File**: `docs/deployment/NOTIFICATION_TELEGRAM_CONFIG_EN.md` (modified, +6/-13)
```diff
@@ -31,16 +31,14 @@
 3. Enter a display name for your bot (e.g., `QuantDinger Signal Bot`)
 4. Choose a unique username ending with `bot` (e.g., `quantdinger_signal_bot`)
 
-<img src="../screenshots/notification_telegram_token.png" alt="Create Telegram Bot" width="100%" style="border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
-
 ---
 
 ## Step 2: Obtain Bot Token
 
 Upon successful creation, BotFather will provide an **HTTP API Token** in this format:
 
 ```
-123456789:ABCdefGHIjklMNOpqrsTUVwxyz
+BOT_ID:REPLACE_WITH_BOT_TOKEN
 ```
 
 > ⚠️ **Security Notice**: Keep this token secure and never share it publicly. If compromised, use `/revoke` command in BotFather to regenerate immediately.
@@ -58,14 +56,10 @@ Upon successful creation, BotFather will provide an **HTTP API Token** in this f
 https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getUpdates
 ```
 
-**Example**:
-```
-https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/getUpdates
-```
-
 3. Locate the `chat.id` field in the JSON response — this is your User ID
 
-<img src="../screenshots/notification_telegram_userid_get.png" alt="Get User ID" width="100%" style="border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
+Do not paste a real bot token into screenshots, issues, chat messages, or shell
+history. Use an environment variable or a secret manager when testing the API.
 
 ### Method 2: Via @userinfobot
 
@@ -80,7 +74,7 @@ Add the Bot Token to your `backend_api_python/.env` file:
 
 ```bash
 # Telegram Bot Token (required)
-TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
+TELEGRAM_BOT_TOKEN=BOT_ID:REPLACE_WITH_BOT_TOKEN
 ```
 
 Restart the backend service after configuration to apply changes.
@@ -94,8 +88,6 @@ In the strategy configuration page under "Signal Notifications":
 1. Enable the **Telegram** notification channel
 2. Enter your Telegram User ID in the designated field
 
-<img src="../screenshots/notification_telegram_userid.png" alt="Configure User ID" width="100%" style="border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
-
 > 💡 **Tip**: You can enter multiple User IDs (comma-separated) or group/channel IDs for multi-recipient notifications.
 
 ---
@@ -115,7 +107,8 @@ Yes. Add the bot to a group, then use the group ID (negative number) as the targ
 
 ### Q: What's the token format?
 
-Token format is `numbers:alphanumeric_string`, e.g., `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
+Token format is `bot_id:secret`, for example
+`BOT_ID:REPLACE_WITH_BOT_TOKEN`. Always use the value issued by BotFather.
 
 ---
 
```

**File**: `docs/deployment/USDT_PAYMENT_GUIDE.md` (removed, +0/-179)
```diff
@@ -1,179 +0,0 @@
-# USDT 支付配置指南
-
-本文档描述 QuantDinger v5 当前的 USDT 收款流程，面向需要完成生产配置与验收的运营人员。
-
-> **核心机制**：所有用户付到**同一个主钱包地址**，订单通过「**金额尾数**」识别（base 价格 + 一个不超过 0.01 USDT 的小尾数）。**不再有派生地址，不再需要归集**。
-
----
-
-## 1. 选哪几条链？
-
-| 链 | 典型手续费 | 推荐场景 | 备注 |
-|---|---|---|---|
-| **BSC (BEP20)** | ≈ $0.30 | 🟢 推荐主选 | 速度快、费用低、用户基数大 |
-| **Solana (SPL)** | ≈ $0.0005 | 🟢 推荐 | 极便宜，Phantom / Solflare 一扫即填 |
-| **TRON (TRC20)** | ≈ $1.50 | 🟡 国内/币安习惯用户 | 老用户最熟悉的链 |
-| **Ethereum (ERC20)** | ≈ $5.00 | 🔴 不推荐做主链 | 仅作大额企业用户兜底 |
-
-建议至少同时开 BSC + TRC20 两条，对应「省钱用户」+「币安习惯用户」两群人。
-
----
-
-## 2. 准备主钱包地址
-
-每条要开的链准备一个**纯收款地址**（建议跟交易/经营钱包分离，做收款专用）：
-
-| 链 | 地址类型 | 来源 |
-|---|---|---|
-| TRC20 | `T...` (base58, 34 字符) | TronLink / imToken / TP / 任意 TRON 钱包 |
-| BEP20 | `0x...` (40 字符 EVM) | MetaMask / TrustWallet — 同一个 EVM 私钥也可用于 ERC20 |
-| ERC20 | `0x...` (40 字符 EVM) | 通常和 BEP20 用同一个 EVM 地址，省一组管理 |
-| SOL | base58 (44 字符左右) | Phantom / Solflare / TP |
-
-> ⚠️ Solana 必须填**钱包地址**（不是 USDT ATA），扫描器内部自动定位用户 ATA。
-
----
-
-## 3. 申请区块浏览器 API Key（强烈建议）
-
-匿名访问 Etherscan / BscScan 每天 ≤200 次，订单略多就被限流。免费 Key 配额是 100k/月，绝对够用。
-
-| 服务 | 申请页面 | env 变量 |
-|---|---|---|
-| Etherscan | <https://etherscan.io/myapikey> | `ETHERSCAN_API_KEY` |
-| BscScan | <https://bscscan.com/myapikey> | `BSCSCAN_API_KEY` |
-| TronGrid | <https://www.trongrid.io/dashboard/keys> | `TRONGRID_API_KEY` |
-| Solana RPC | 公开节点免费即可；若高并发可用 [Helius](https://helius.dev/) 或 [QuickNode](https://www.quicknode.com/) | `SOLANA_RPC_URL` |
-
----
-
-## 4. 编辑 `.env`
-
-最小化配置（只开 BSC + TRC20）：
-
-```bash
-# ===== 主开关 =====
-USDT_PAY_ENABLED=true
-USDT_PAY_ENABLED_CHAINS=TRC20,BEP20
-
-# ===== 收款地址（只填要开的链） =====
-USDT_TRC20_ADDRESS=Txxx...你的TRON地址xxxxxxxxxxxx
-USDT_BEP20_ADDRESS=0xxxx...你的BSC地址xxxxxxxxxxxxxxxxxxxx
-
-# ===== 浏览器 API Key（推荐） =====
-TRONGRID_API_KEY=trongrid-key-here
-BSCSCAN_API_KEY=bscscan-key-here
-
-# ===== 金额尾数精度（默认 6 位就够，每单最多额外 1¢） =====
-USDT_AMOUNT_SUFFIX_DECIMALS=6
-
-# ===== 入账确认延迟 / 订单过期 =====
-USDT_PAY_CONFIRM_SECONDS=30
-USDT_PAY_EXPIRE_MINUTES=30
-USDT_WORKER_POLL_INTERVAL=30
-```
-
-四条全开的样例直接复制 `env.example` 里 USDT 段即可。
-
----
-
-## 5. 启动 & 验证
-
-### 5.1 重启后端
-
-数据库 schema 会自动迁移（`init.sql` 里的 `DO $$ ... ADD COLUMN IF NOT EXISTS ...` 块幂等），不需要任何 `psql` 手工命令。
-
-### 5.2 验证链选择器
-
-打开前端「会员中心」→ 点任意一个套餐的「立即购买」按钮：
-
-- ✅ 看到「选择支付网络」弹窗，列出你开启的所有链
-- ❌ 看不到选项 → 检查 env：链未配地址或不在 `USDT_PAY_ENABLED_CHAINS` 白名单
-
-### 5.3 发一笔最小订单测试
-
-1. 选 BSC（最便宜），点「继续支付」
-2. 弹支付页 → 看到大字号金额 `19.99xxxx USDT`（**xxxx 高亮成红色** = 尾数）
-3. 用 MetaMask / TokenPocket 移动端扫二维码 → 应该自动跳到 USDT 转账页，**地址 + 金额都已填好**（这就是 EIP-681 deep link 效果）
-4. 转账完成 → 后端 worker 30s 内扫到 → 订单变成 `paid` → 再 30s 后变 `confirmed` → 会员到期日刷新
-
-### 5.4 常见自检命令
-
-```bash
-# 看后端 worker 日志
-docker compose logs -f backend | grep -E "UsdtOrderWorker|USDT reconcile|USDT order"
-
-# 直接 ping API（带登录 Cookie 或 Bearer Token）
-curl -H "Authorization: Bearer <token>" http://localhost:5000/api/billing/usdt/chains
-```
-
-正常返回示例：
-
-```json
-{
-  "code": 1,
-  "data": {
-    "chains": [
-      { "code": "BEP20", "label": "BSC (BEP20)", "address": "0x...", "recommended": true, "typical_fee_usdt": 0.3, ... },
-      { "code": "TRC20", "label": "TRON (TRC20)", "address": "Txxx", "recommended": false, "typical_fee_usdt": 1.5, ... }
-    ]
-  }
-}
-```
-
----
-
-## 6. 故障排查
-
-| 症状 | 可能原因 | 处理 |
-|---|---|---|
-| 前端弹「暂无可用的支付网络」 | `USDT_PAY_ENABLED_CHAINS` 为空 / 所有 `USDT_*_ADDRESS` 为空 | 至少配一条 |
-| 订单创单返回 `usdt_pay_disabled` | `USDT_PAY_ENABLED=false` | 改为 `true` 重启 |
-| 订单创单返回 `chain_not_available` | 用户选的链未配地址或不在白名单 | 见 5.2 |
-| 订单 30 分钟后还 `pending`，链上明明到账 | watcher 没运行 / API Key 超限 / 金额没匹配上 | 看 worker 日志；金额匹配是**精确匹配**，转账时金额必须严格等于订单要求 |
-| 创单返回 `amount_collision` | 极少见：10 次重试都撞到同 (chain, amount) 唯一索引 | 通常是 `USDT_AMOUNT_SUFFIX_DECIMALS=4` 太小，改为 6 |
-| 单子 `expired` 但用户说付了 | 转账金额尾数错（手输金额漏了几位） | 提示用户重新下单；旧订单从客服后台手工兑账 |
-
----
-
-## 7. 钱包兼容性对照
-
-| 钱包 | TRC20 URI | EVM (EIP-681) | Solana Pay |
-|---|---|---|---|
-| **MetaMask** | – | ✅ 自动填 | – |
-| **TrustWallet** | – | ✅ 自动填 | – |
-| **imToken** | ✅ 自动填 | ✅ 自动填 | ✅ 自动填 |
-| **TokenPocket (TP)** | ✅ 自动填 | ✅ 自动填 | ✅ 自动填 |
-| **OKX Wallet** | ✅ 自动填 | ✅ 自动填 | ✅ 自动填 |
-| **Coinbase Wallet** | – | ✅ 自动填 | – |
-| **Phantom** | – | – | ✅ 自动填 |
-| **Solflare** | – | – | ✅ 自动填 |
-| **TronLink (旧版)** | ⚠️ 只读地址 | – | – |
-| **Binance Wallet (内置)** | ⚠️ 只读地址 | ⚠️ 只读地址 | ⚠️ 只读地址 |
-
-「只读地址」的钱包扫码后只会读到收款地址，用户需要从订单页**复制金额**（金额按钮就在二维码下方）。订单页对金额做了红色高亮 + 一键复制，最大程度降低漏付/少付的概率。
-
----
-
-## 8. FAQ
-
-**Q：为什么每单要让用户多付一点点（比如 19.9 → 19.991234）？**
-A：这就是「订单身份证」—— 我们用这个尾数把链上转账匹配回订单。每单最多额外 1¢ 是设计上限。
-
-**Q：能不能让金额完全对齐 base 价（不带尾数）？**
-A：可以，但那样多笔金额相同的并发订单会撞车，必须重新引入派生地址。两难取舍，我们选了「+1¢ 容忍」。
-
-**Q：碰撞概率有多大？**
-A：6 位精度下尾数 slot 空间 ≈ 10000，30 分钟窗口内同金额同链订单要超过 ~100 个才有可观碰撞率。下单冲突会自动重试 10 次，业务侧基本看不到。
-
-**Q：API Key 不申请行不行？**
-A：测试可以，生产强烈不建议。Etherscan / BscScan 匿名 200 次/天，一上量就会限流，导致订单 30 分钟内匹配不到链上转账，用户体验掉到地板。
-
-**Q：旧的 xpub 派生订单还能用吗？**
-A：v3.0.6 不再生成新的派生订单。老订单数据仍保留在 `qd_usdt_orders` 表里，用户可以查看历史；但 worker 只对新模型订单做匹配（chain ∈ 新四链 + address = 主钱包地址）。需要兑账老订单请走客服后台手
```

**File**: `docs/trading/PUBLIC_UNIVERSE_AND_FUNDAMENTALS_CN.md` (modified, +15/-18)
```diff
@@ -1,24 +1,21 @@
 # 公开股票池基础库与基本面数据约定
 
-更新日期：2026-07-12
+## 1. 默认公开股票池
 
-## 1. 当前固定快照
+QuantDinger 可以从公开数据源维护以下股票池。实际成员数量与来源版本会随
+再平衡、数据源可用性和完整性校验变化，不应把文档中的示例数量当作交易保证。
 
-数据库已写入以下 `2026-07-12`（Asia/Shanghai 采集日）当前快照。运行数据库以 UTC 日期保存首个有效日，因此本次成员的 `valid_from` 为 `2026-07-11`，来源版本仍为 `2026-07-12`：
+| 股票池 | 来源与约束 |
+|---|---|
+| 沪深300、中证500 | 中证指数公开成分接口，经 AKShare 适配 |
+| 标普500 | `datasets/s-and-p-500-companies`，ODC PDDL |
+| 纳斯达克100 | `Gary-Strauss/NASDAQ100_Constituents`，MIT；底层数据来自 Wikipedia，需保留 CC BY-SA 署名 |
+| 加密市值 Top-100 | CoinGecko 当前市值排序接口 |
+| 恒生指数系列 | 恒生指数公司公开 factsheet，包括 HSI、HSTECH、HSCEI 和 HSHDYI |
 
-| 股票池 | 数量 | 来源 |
-|---|---:|---|
-| 沪深300 | 300 | 中证指数公开成分接口，经 AKShare 适配 |
-| 中证500 | 500 | 中证指数公开成分接口，经 AKShare 适配 |
-| 标普500 | 503 | `datasets/s-and-p-500-companies`，ODC PDDL |
-| 纳斯达克100 | 101 | `Gary-Strauss/NASDAQ100_Constituents`，MIT；底层数据来自 Wikipedia，需保留 CC BY-SA 署名 |
-| 加密市值 Top-100 | 100 | CoinGecko 当前市值排序接口 |
-| 恒生指数核心50 | 50 | 恒生指数公司官方 HSI factsheet 的前50大权重成分 |
-| 恒生科技30 | 30 | 恒生指数公司官方 HSTECH factsheet |
-| 恒生国企50 | 50 | 恒生指数公司官方 HSCEI factsheet |
-| 恒生高股息50 | 50 | 恒生指数公司官方 HSHDYI factsheet |
-
-这些记录是当前快照，不代表 2026-07-12 之前的真实历史成分。每次月度更新都会关闭被剔除成分的有效区间，并为新增成分建立新的 `valid_from`，从现在开始积累平台自己的时点历史。
+首次导入只建立当时可观察到的成分快照，不会伪造更早的历史成员。后续更新会
+关闭被剔除成分的有效区间，并为新增成分建立新的 `valid_from`，逐步积累平台
+自己的时点历史。
 
 刷新命令：
 
@@ -35,8 +32,8 @@ python scripts/refresh_public_universe_snapshots.py \
 港股指数池使用恒生指数公司 factsheet，ETF 分类直接使用证券主表：
 
 - 港股指数池：恒生指数核心50、恒生科技30、恒生国企50、恒生高股息50；保存官方权重和行业。
-- 港股核心 ETF：`HKStock + etf + is_hot`，当前固定 18 只宽基、科技、红利、黄金和债券 ETF
-- 美股核心 ETF：`USStock + etf + is_hot`，当前固定 31 只主流宽基、行业、债券和商品 ETF
+- 港股核心 ETF：`HKStock + etf + is_hot`，由证券目录维护宽基、科技、红利、黄金和债券 ETF
+- 美股核心 ETF：`USStock + etf + is_hot`，由证券目录维护主流宽基、行业、债券和商品 ETF
 - 全量港股仍保留在证券搜索主表，不默认作为截面回测池。
 
 证券同步会读取 HKEX `ListOfSecurities.xlsx` 的 `Category` 字段，把 `Equity` 和 `Exchange Traded Products` 分开。美国证券目录使用 Nasdaq Trader 的 `ETF` 标记。
```

---

### Incident Patch 15: `f8e0a64b` (2026-09-28)
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

**File**: `backend_api_python/app/routes/quick_trade.py` (modified, +126/-192)
```diff
@@ -47,9 +47,14 @@
 )
 from app.services.quick_trade.symbols import is_supported_crypto_exchange, symbols_match as quick_trade_symbols_match
 from app.services.quick_trade.history import parse_quick_trade_metadata
-from app.services.live_trading.position_row_parse import (
-    extract_signed_position_qty,
-    infer_position_side_from_row,
+from app.services.quick_trade.products import (
+    build_product_aware_config as _build_product_aware_config,
+)
+from app.services.quick_trade.positions import (
+    extract_signed_position_qty as _extract_signed_position_qty,
+    infer_position_side_from_row as _infer_position_side_from_row,
+    normalize_okx_positions_raw as _normalize_okx_positions_raw,
+    parse_positions as _parse_positions,
 )
 from app.services.ai_decision_filter import list_ai_decisions
 from app.utils.request_guard import RequestGuardError, cache_key, guarded_cached
@@ -334,6 +339,7 @@ def place_order(body):
       side           (str)    - "buy" or "sell"
       order_type     (str)    - "market" or "limit"  (default: market)
       amount         (float)  - spot quote amount or swap margin amount in USDT
+      quantity       (float)  - optional exact base quantity for spot sell orders
       price          (float)  - limit price (required for limit orders)
       leverage       (int)    - leverage multiplier (default: 1)
                                 - leverage = 1: spot market
@@ -343,13 +349,15 @@ def place_order(body):
       sl_price       (float)  - stop-loss price (optional, for record only)
       source         (str)    - "ai_radar" / "ai_analysis" / "indicator" / "manual"
     """
+    exchange_id = ""
     try:
         user_id = g.user_id
         credential_id = int(body.get("credential_id") or 0)
         symbol = str(body.get("symbol") or "").strip()
         side = str(body.get("side") or "").strip().lower()
         order_type = str(body.get("order_type") or "market").strip().lower()
         usdt_amount = float(body.get("amount") or 0)
+        requested_base_quantity = float(body.get("quantity") or 0)
         price = float(body.get("price") or 0)
         leverage = int(body.get("leverage") or 1)
         market_type = str(body.get("market_type") or "").strip().lower()
@@ -371,8 +379,6 @@ def place_order(body):
             return jsonify({"code": 0, "msg": "Missing symbol"}), 400
         if side not in ("buy", "sell"):
             return jsonify({"code": 0, "msg": "side must be 'buy' or 'sell'"}), 400
-        if usdt_amount <= 0:
-            return jsonify({"code": 0, "msg": "amount must be > 0"}), 400
         if order_type == "limit" and price <= 0:
             return jsonify({"code": 0, "msg": "price required for limit orders"}), 400
 
@@ -383,22 +389,33 @@ def place_order(body):
             market_type = "swap" if leverage > 1 else "spot"
         if market_type == "swap" and not margin_mode:
             margin_mode = "cross"
+        uses_base_quantity = market_type == "spot" and side == "sell" and requested_base_quantity > 0
+        if usdt_amount <= 0 and not uses_base_quantity:
+            return jsonify({"code": 0, "msg": "amount must be > 0"}), 400
+        if requested_base_quantity > 0 and not uses_base_quantity:
+            return jsonify({"code": 0, "msg": "quantity is only supported for spot sell orders"}), 400
         order_notional_usdt = _resolve_order_notional_usdt(usdt_amount, leverage, market_type)
 
         # ---- build exchange client ----
         cfg_overrides: Dict[str, Any] = {"market_type": market_type}
         if margin_mode in ("cross", "isolated"):
             cfg_overrides["margin_mode"] = margin_mode
             cfg_overrides["td_mode"] = margin_mode
-        exchange_config = build_exchange_config(credential_id, user_id, cfg_overrides)
+        exchange_config, resolved_product = _build_product_aware_config(
+            credential_id,
+            user_id,
+            symbol=symbol,
+            market_type=market_type,
+            source=body,
+            overrides=cfg_overrides,
+        )
         exchange_id = (exchange_config.get("exchange_id") or "").strip().lower()
         if not exchange_id:
             return jsonify({"code": 0, "msg": "Invalid credential: missing exchange_id"}), 400
 
         qt_rej = _reject_quick_trade_if_desktop_broker(exchange_id)
         if qt_rej is not None:
             return qt_rej
-
         client = create_exchange_client(exchange_config, market_type=market_type)
 
         if market_type == "swap":
@@ -412,9 +429,10 @@ def place_order(body):
                 margin_mode=margin_mode,
             )
 
-        # Spot input is quote notional. Swap input is margin and expands by leverage.
+        # Spot buys use quote notional; exact spot sells may use base quantity.
+        # Swap input is margin and expands by leverage.
         limit_price_for_conversion = price if order_type == "limit" and price > 0 else 0.0
-        base_qty = _convert_usdt_to_base_qty(
+        b
```

**File**: `backend_api_python/app/services/alpaca_trading/client.py` (modified, +32/-11)
```diff
@@ -22,6 +22,12 @@
 logger = get_logger(__name__)
 
 
+_ALPACA_TRADING_HOSTS = {
+    "api.alpaca.markets",
+    "paper-api.alpaca.markets",
+}
+
+
 def _market_hint_from_type(market_type: str) -> str:
     return "Crypto" if (market_type or "").strip().lower() == "crypto" else "USStock"
 
@@ -116,10 +122,20 @@ def normalize_base_url(base_url: Optional[str]) -> Optional[str]:
         raw = "https://" + raw
 
     parts = urlsplit(raw)
+    scheme = (parts.scheme or "").lower()
+    hostname = (parts.hostname or "").lower().rstrip(".")
+    if scheme != "https":
+        raise ValueError("Alpaca base URL must use HTTPS")
+    if hostname not in _ALPACA_TRADING_HOSTS:
+        raise ValueError("Alpaca base URL must use an official Alpaca trading host")
+    if parts.username or parts.password or parts.port is not None:
+        raise ValueError("Alpaca base URL must not contain credentials or a custom port")
     path = (parts.path or "").rstrip("/")
     if path.lower() == "/v2":
         path = ""
-    normalized = urlunsplit((parts.scheme or "https", parts.netloc, path, "", ""))
+    elif path:
+        raise ValueError("Alpaca base URL must not contain a path")
+    normalized = urlunsplit(("https", hostname, path, "", ""))
     return normalized.rstrip("/") or None
 
 
@@ -210,21 +226,30 @@ def connected(self) -> bool:
         """Connection is verified by a successful account fetch."""
         return self._trading_client is not None and self._account_id is not None
 
+    def _trading_base_url(self) -> str:
+        expected_host = "paper-api.alpaca.markets" if self.config.paper else "api.alpaca.markets"
+        base_url = normalize_base_url(self.config.base_url)
+        if base_url and (urlsplit(base_url).hostname or "").lower() != expected_host:
+            raise ValueError("Alpaca base URL does not match the selected account environment")
+        return base_url or f"https://{expected_host}"
+
     def connect(self) -> bool:
         """Initialize Alpaca client and verify credentials by fetching account."""
         try:
-            modules = _ensure_alpaca()
             api_key = (self.config.api_key or "").strip()
             secret_key = (self.config.secret_key or "").strip()
             if not api_key or not secret_key:
                 logger.error("Alpaca connect failed: empty api_key or secret_key")
                 return False
 
+            base_url = self._trading_base_url()
+            modules = _ensure_alpaca()
+
             self._trading_client = modules["TradingClient"](
                 api_key=api_key,
                 secret_key=secret_key,
                 paper=self.config.paper,
-                url_override=self.config.base_url,
+                url_override=base_url,
             )
             # Paper trading keys use the standard Alpaca market-data endpoint.
             # The SDK sandbox flag targets a separate data sandbox and rejects
@@ -542,9 +567,7 @@ def get_account_activities(
         )
         if not types:
             return []
-        host = self.config.base_url or (
-            "https://paper-api.alpaca.markets" if self.config.paper else "https://api.alpaca.markets"
-        )
+        host = self._trading_base_url()
         url = f"{host.rstrip('/')}/v2/account/activities"
         params: Dict[str, Any] = {
             "activity_types": types,
@@ -691,8 +714,8 @@ def get_orders(self, status: str = "all", limit: int = 100, *, raise_on_error: b
                     "quantity": _num(getattr(o, "qty", None), default=None),
                     "qty": _num(getattr(o, "qty", None), default=None),
                     "notional": _num(getattr(o, "notional", 0), default=0.0),
-                    "orderType": _enum_value(getattr(o, "order_type", "")),
-                    "order_type": _enum_value(getattr(o, "order_type", "")),
+                    "orderType": _enum_value(getattr(o, "order_type", None) or getattr(o, "type", "")),
+                    "order_type": _enum_value(getattr(o, "order_type", None) or getattr(o, "type", "")),
                     "limitPrice": _num(getattr(o, "limit_price", None), default=None),
                     "limit_price": _num(getattr(o, "limit_price", None), default=None),
                     "status": _enum_value(getattr(o, "status", "")),
@@ -759,9 +782,7 @@ def get_connection_status(self) -> Dict[str, Any]:
         return {
             "connected": self.connected,
             "paper": self.config.paper,
-            "base_url": self.config.base_url or (
-                "https://paper-api.alpaca.markets" if self.config.paper else "https://api.alpaca.markets"
-            ),
+            "base_url": self._trading_base_url(),
             "account_id": self._account_id,
         }
 
```

**File**: `backend_api_python/app/services/live_trading/factory.py` (modified, +1/-1)
```diff
@@ -424,7 +424,7 @@ def create_alpaca_client(exchange_config: Dict[str, Any]):
     - api_key:    Alpaca API key (PK*=paper, AK*=live)
     - secret_key: Alpaca API secret
     - paper:      Boolean (default True). 'true'/'false' strings also accepted.
-    - base_url:   Optional explicit URL override (otherwise paper/live decides)
+    - base_url:   Optional official Alpaca URL retained for stored-config compatibility
 
     Unlike IBKR, Alpaca is stateless REST — no terminal/gateway needed,
     so it's the recommended USStock broker on cloud / SaaS deployments where
```

#### Recent Merged Pull Requests:
- **PR #272** (closed): chore(deps): bump the python-runtime group across 1 directory with 17 updates (@dependabot[bot])
- **PR #271** (closed): chore(deps): bump the python-runtime group across 1 directory with 18 updates (@dependabot[bot])
- **PR #270** (closed): chore(deps): bump the python-runtime group across 1 directory with 19 updates (@dependabot[bot])
- **PR #269** (closed): chore(deps): bump the python-runtime group across 1 directory with 20 updates (@dependabot[bot])
- **PR #265** (closed): chore(deps): bump the python-runtime group across 1 directory with 19 updates (@dependabot[bot])
- **PR #264** (closed): feat(backtest): add benchmark-relative information ratio metrics (@ZhangWT02)
- **PR #262** (closed): chore(deps): bump the python-runtime group across 1 directory with 18 updates (@dependabot[bot])
- **PR #261** (closed): chore(deps): bump github/codeql-action from 4.37.3 to 4.38.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
