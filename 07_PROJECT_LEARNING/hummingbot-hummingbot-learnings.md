# Forensic Learning Record (Deep Inspection): hummingbot/hummingbot

> **Canonical Artifact**: `07_PROJECT_LEARNING/hummingbot-hummingbot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hummingbot/hummingbot](https://github.com/hummingbot/hummingbot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:02:05.021Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hummingbot/hummingbot`
- **Description**: Open source software that helps you create and deploy high-frequency crypto trading bots
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 20311 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bin/path_util.py`
```
#!/usr/bin/python

if "hummingbot-dist" in __file__:
    # Dist environment.
    import os
    import sys
    sys.path.append(sys.path.pop(0))
    sys.path.insert(0, os.getcwd())

    import hummingbot
    hummingbot.set_prefix_path(os.getcwd())
else:
    # Dev environment.
    import sys
    from os.path import join, realpath
    sys.path.insert(0, realpath(join(__file__, "../../")))

```

### Core Architecture Module: `hummingbot/cli/engine.py`
```
"""The detached bot engine (the child process spawned by ``hbot start``).

Unlike ``HummingbotApplication.run_headless()`` — which mandates an MQTT broker — this engine
keeps the process alive with its own loop. Status is computed **on demand**: the engine writes a
fresh ``status.json`` only when it receives SIGUSR1 (sent by ``hbot status``), plus once at
startup (so ``hbot start`` can detect readiness) and once on shutdown. There is no polling
interval — the agent decides how often to query. On SIGTERM/SIGINT it stops the strategy
gracefully (cancelling open orders) and shuts down.

Invoked as: ``python -m hummingbot.cli.engine --name <name> [--config f | --script-config c]``
The password is passed via the ``HBOT_PASSWORD`` env var (never argv).
"""
import argparse
import asyncio
import inspect
import logging
import os
import signal
import sys
import time
from typing import Any, Dict, Optional

from hummingbot.cli import bot
from hummingbot.client.config.config_crypt import ETHKeyFileSecretManger
from hummingbot.client.config.config_helpers import load_client_config_map_from_file
from hummingbot.client.hummingbot_application import HummingbotApplication
from hummingbot.client.runner import (
    autofix_permissions,
    bootstrap_application,
    load_and_start_strategy,
    wait_for_gateway_ready,
)

BALANCE_TIMEOUT = 10.0


async def _collect_balances(hb: HummingbotApplication) -> Dict[str, Dict[str, float]]:
    balances: Dict[str, Dict[str, float]] = {}
    tc = hb.trading_core
    for name in list(tc.connector_manager.connectors.keys()):
        try:
            bals = await asyncio.wait_for(tc.get_current_balances(name), BALANCE_TIMEOUT)
            balances[name] = {asset: float(amt) for asset, amt in bals.items() if amt}
        except Exception:
            continue
    return balances


async def _format_status_text(hb: HummingbotApplication) -> Optional[str]:
    strategy = hb.trading_core.strategy
    if strategy is None:
        return None
    try:
        result = strategy.format_status()
        # some strategies (e.g. spot_perpetual_arbitrage) define format_status as a coroutine
        if inspect.iscoroutine(result):
            result = await result
        return result
    except Exception:
        return None


async def _write_snapshot(hb: HummingbotApplication, name: str, *, running: bool) -> None:
    snapshot: Dict[str, Any] = {
        "name": name,
        "pid": os.getpid(),
        "running": running,
        "updated_at": time.time(),
    }
    try:
        snapshot["engine"] = hb.trading_core.get_status()
    except Exception:
        snapshot["engine"] = None
    snapshot["format_status"] = await _format_status_text(hb)
    if running:
        snapshot["balances"] = await _collect_balances(hb)
    bot.write_status(snapshot)


async def _serve(hb: HummingbotApplication, name: str) -> None:
    """Keep the process alive until a stop signal arrives.

    Status snapshots are written on demand (SIGUSR1 from ``hbot status``), not on a timer.
    """
    loop = asyncio.get_event_loop()
    stop_event = asyncio.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop_event.set)
    loop.add_signal_handler(
        signal.SIGUSR1,
        lambda: loop.create_task(_write_snapshot(hb, name, running=True)))

    # Initial snapshot so `hbot start` can detect readiness.
    await _write_snapshot(hb, name, running=True)
    try:
        await stop_event.wait()
    finally:
        logging.getLogger().info("Stop requested — winding down strategy and cancelling orders.")
        try:
            await hb.stop_loop()
        except Exception:
            logging.getLogger().error("Error during graceful stop.", exc_info=True)
        try:
            await hb.trading_core.shutdown()
        except Exception:
            logging.getLogger().error("Error during shutdown.", exc_info=True)
        await _write_snapshot(hb, name, running=False)
        bot.clear_pid()


async def run_engine(name: str,
                     config_file_name: Optional[str],
                     v2_conf: Optional[str],
                     password: str,
                     auto_set_permissions: Optional[str]) -> int:
    client_config_map = load_client_config_map_from_file()

    if auto_set_permissions is not None:
        autofix_permissions(auto_set_permissions)

    # Boot headless with per-instance logging up front: the structured log at logs/logs_<name>.log is
    # the single rotating log (read by `hbot logs`); silence_console drops the stdout handlers that would
    # otherwise duplicate into the redirected, non-rotating bot.log. No MQTT (this engine isn't run_headless).
    hb = await bootstrap_application(
        client_config_map, ETHKeyFileSecretManger(password),
        strategy_file_name=name, override_log_level=client_config_map.log_level,
        headless=True, silence_console=True)
    if hb is None:
        return 4

    started = await load_and_start_strategy(
        hb, config_file_name=config_file_name, v2_conf=v2_conf, headless=True)
    if not started:
        logging.getLogger().error("Failed to load strategy. Exiting.")
        return 1

    await wait_for_gateway_ready(hb)

    # Record the sqlite DB path so `hbot trades/history` can find it deterministically.
    db_path = hb.trading_core.trade_fill_db.db_path if hb.trading_core.trade_fill_db is not None else None
    bot.update_meta(
        db_path=db_path,
        config_file_path=hb.trading_core._strategy_file_name or hb.strategy_file_name,
        strategy_name=hb.trading_core.strategy_name,
    )

    await _serve(hb, name)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="hbot detached bot engine (internal).")
    parser.add_argument("--name", required=True)
    parser.add_argument("--config", default=None)
    parser.add_argument("--script-config", default=None, dest="script_config")
    parser.add_argument("--auto-set-permissions", default=None, dest="auto_set_permissions")
    args = parser.parse_args()

    # Read the password, then scrub it from this process's environment so none of the subprocesses
    # the engine (or a connector) may spawn inherit the keystore password. The engine lives for the
    # bot's whole run — the password should live only in this variable, not in the inheritable env.
    password = os.environ.get("HBOT_PASSWORD") or os.environ.get("CONFIG_PASSWORD")
    os.environ.pop("HBOT_PASSWORD", None)
    os.environ.pop("CONFIG_PASSWORD", None)
    if not password:
        sys.stderr.write("HBOT_PASSWORD is not set; the engine cannot unlock the keystore.\n")
        sys.exit(4)

    try:
        ev_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(ev_loop)
        rc = ev_loop.run_until_complete(
            run_engine(args.name, args.config, args.script_config, password, args.auto_set_permissions))
    except Exception:
        logging.getLogger().error("Engine crashed.", exc_info=True)
        rc = 1
    sys.exit(rc)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `hummingbot/client/command/command_utils.py`
```
"""
Shared utilities for gateway commands - UI and display functions.
"""
import asyncio
from typing import TYPE_CHECKING, Any, Dict, List

if TYPE_CHECKING:
    from hummingbot.connector.gateway.gateway_base import GatewayBase


class GatewayCommandUtils:
    """Utility functions for gateway commands - UI and display functions."""

    @staticmethod
    def is_placeholder_wallet(wallet_address: str) -> bool:
        """
        Check if a wallet address is a placeholder.

        :param wallet_address: Wallet address to check
        :return: True if it's a placeholder, False otherwise
        """
        if not wallet_address:
            return False
        return "wallet-address" in wallet_address.lower()

    @staticmethod
    async def monitor_transaction_with_timeout(
        app: Any,  # HummingbotApplication
        connector: "GatewayBase",
        order_id: str,
        timeout: float = 60.0,
        check_interval: float = 1.0,
        pending_msg_delay: float = 3.0
    ) -> Dict[str, Any]:
        """
        Monitor a transaction until completion or timeout by polling order status.

        :param app: HummingbotApplication instance (for notify method)
        :param connector: GatewayBase connector instance
        :param order_id: Order ID to monitor
        :param timeout: Maximum time to wait in seconds
        :param check_interval: How often to check status in seconds
        :param pending_msg_delay: When to show pending message
        :return: Dictionary with status information
        """
        elapsed = 0
        pending_shown = False
        hardware_wallet_msg_shown = False

        while elapsed < timeout:
            # Directly update order status for temporary connectors (not on clock)
            tracked_orders = connector.gateway_orders
            if tracked_orders:
                await connector.update_order_status(tracked_orders)

            order = connector.get_order(order_id)

            # Check if transaction is complete (success, failed, or cancelled)
            if order and order.is_done:
                # For LP operations (RANGE orders), is_done=True with state=OPEN means success
                # For swap orders, check is_filled
                is_success = order.is_filled or (not order.is_failure and not order.is_cancelled)

                result = {
                    "completed": True,
                    "success": is_success,
                    "failed": order.is_failure if order else False,
                    "cancelled": order.is_cancelled if order else False,
                    "order": order,
                    "elapsed_time": elapsed
                }

                # Show appropriate message
                if is_success:
                    app.notify("\n✓ Transaction completed successfully!")
                    if order.exchange_order_id:
                        app.notify(f"Transaction hash: {order.exchange_order_id}")
                elif order.is_failure:
                    app.notify("\n✗ Transaction failed")
                elif order.is_cancelled:
                    app.notify("\n✗ Transaction cancelled")

                return result

            # Special handling for PENDING_CREATE state (hardware wallet approval)
            if order and hasattr(order, 'current_state') and str(order.current_state) == "OrderState.PENDING_CREATE":
                if elapsed > 10 and not hardware_wallet_msg_shown:
                    app.notify("If using a hardware wallet, please approve the transaction on your device.")
                    hardware_wallet_msg_shown = True

            await asyncio.sleep(check_interval)
            elapsed += check_interval

            # Show pending message after delay
            if elapsed >= pending_msg_delay and not pending_shown:
                app.notify("Transaction pending...")
                pending_shown = True

        # Timeout reached
        order = connector.get_order(order_id)
        result = {
            "completed": False,
            "timeout": True,
            "order": order,
            "elapsed_time": elapsed
        }

        app.notify("\n⚠️  Transaction may still be pending.")
        if order and order.exchange_order_id:
            app.notify(f"You can check the transaction manually: {order.exchange_order_id}")

        return result

    @staticmethod
    def handle_transaction_result(
        app: Any,
        result: Dict[str, Any],
        success_msg: str = "Transaction completed successfully!",
        failure_msg: str = "Transaction failed. Please try again.",
        timeout_msg: str = "Transaction timed out. Check your wallet for status."
    ) -> bool:
        """
        Handle transaction result and show appropriate message.

        :param app: HummingbotApplication instance (for notify method)
        :param result: Result dict from monitor_transaction_with_timeout
        :param success_msg: Message to show on success
        :param failure_msg: Message to show on failure
        :param timeout_msg: Message to show on timeout
        :return: True if successful, False otherwise
        """
        if result.get("completed") and result.get("success"):
            app.notify(f"\n✓ {success_msg}")
            return True
        elif result.get("failed") or (result.get("completed") and not result.get("success")):
            app.notify(f"\n✗ {failure_msg}")
            return False
        elif result.get("timeout"):
            app.notify(f"\n⚠️  {timeout_msg}")
            return False
        return False

    @staticmethod
    def format_address_display(address: str) -> str:
        """
        Format wallet/token address for display.

        :param address: Full address
        :return: Shortened address format (e.g., "0x1234...5678")
        """
        if not address:
            return "Unknown"
        if len(address) > 10:
            return f"{address[:6]}...{address[-4:]}"
        return address

    @staticmethod
    def format_allowance_display(
        allowances: Dict[str, Any],
        token_data: Dict[str, Any],
        connector_name: str = None
    ) -> List[Dict[str, str]]:
        """
        Format allowance data for display.

        :param allowances: Dictionary with token symbols as keys and allowance values
        :param token_data: Dictionary with token symbols as keys and Token info as values
        :param connector_name: Optional connector name for display
        :return: List of formatted rows for display
        """
        rows = []

        for token, allowance in allowances.items():
            # Get token info with fallback
            token_info = token_data.get(token, {})

            # Format allowance - show "Unlimited" for very large values
            try:
                allowance_val = float(allowance)
                # Check if it's larger than 10^10 (10 billion)
                if allowance_val >= 10**10:
                    formatted_allowance = "Unlimited"
                else:
                    # Show up to 4 decimal places
                    if allowance_val == int(allowance_val):
                        formatted_allowance = f"{int(allowance_val):,}"
                    else:
                        formatted_allowance = f"{allowance_val:,.4f}".rstrip('0').rstrip('.')
            except (ValueError, TypeError):
                formatted_allowance = str(allowance)

            # Format address for display
            address = token_info.get("address", "Unknown")
            formatted_address = GatewayCommandUtils.format_address_display(address)

            row = {
                "Symbol": token.upper(),
                "Address": formatted_address,
                "Allowance": formatted_allowance
            }

            rows.append(row)

        return rows

    @staticmethod
    def display_balance_impact_table(
        app: Any,  # HummingbotApplication
        wallet_address: str,
        current_balances: Dict[str, float],
        balance_changes: Dict[str, float],
        native_token: str,
        gas_fee: float,
        warnings: List[str],
        title: str = "Balance Impact"
    ):
        """
        Display a unified balance impact table showing current and projected balances.

        :param app: HummingbotApplication instance (for notify method)
        :param wallet_address: Wallet address
        :param current_balances: Current token balances
        :param balance_changes: Expected balance changes (positive for increase, negative for decrease)
        :param native_token: Native token symbol
        :param gas_fee: Gas fee in native token
        :param warnings: List to append warnings to
        :param title: Title for the table
        """
        # Format wallet address
        wallet_display = GatewayCommandUtils.format_address_display(wallet_address)

        app.notify(f"\n=== {title} ===")
        app.notify(f"Wallet: {wallet_display}")
        app.notify("\nToken     Current Balance → After Transaction")
        app.notify("-" * 50)

        # Display all tokens
        all_tokens = set(current_balances.keys()) | set(balance_changes.keys())

        for token in sorted(all_tokens):
            current = current_balances.get(token, 0)
            change = balance_changes.get(token, 0)

            # Apply gas fee to native token
            if token == native_token and gas_fee > 0:
                change -= gas_fee

            new_balance = current + change

            # Format the display
            if change != 0:
                app.notify(f"  {token:<8} {current:>14.6f} → {new_balance:>14.6f}")

                # Check for insufficient balance
                if new_balance < 0:
                    warnings.append(f"Insufficient {token} balance! You have {current:.6f} but need {abs(change):.6f}")
            else:
                app.notify(f"  {token:<8} {current:>14.6f}")

    @staticmethod
    def display_transaction_fee_details(
        app: Any,  # HummingbotApplic
```

### Core Architecture Module: `hummingbot/client/ui/interface_utils.py`
```
import asyncio
from decimal import Decimal
from typing import Any, List, Optional, Set, Tuple

import pandas as pd
import psutil
import tabulate

from hummingbot.client.config.config_data_types import ClientConfigEnum
from hummingbot.client.performance import PerformanceMetrics
from hummingbot.model.trade_fill import TradeFill

s_decimal_0 = Decimal("0")


def format_bytes(size):
    for unit in ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB"]:
        if abs(size) < 1024.0:
            return f"{size:.2f} {unit}"
        size /= 1024.0
    return f"{size:.2f} YB"


async def start_timer(timer):
    count = 1
    while True:
        count += 1

        mins, sec = divmod(count, 60)
        hour, mins = divmod(mins, 60)
        days, hour = divmod(hour, 24)

        timer.log(f"Uptime: {days:>3} day(s), {hour:02}:{mins:02}:{sec:02}")
        await _sleep(1)


async def _sleep(delay):
    """
    A wrapper function that facilitates patching the sleep in unit tests without affecting the asyncio module
    """
    await asyncio.sleep(delay)


async def start_process_monitor(process_monitor):
    hb_process = psutil.Process()
    while True:
        with hb_process.oneshot():
            threads = hb_process.num_threads()
            process_monitor.log("CPU: {:>5}%, ".format(hb_process.cpu_percent()) +
                                "Mem: {:>10} ({}), ".format(
                                    format_bytes(hb_process.memory_info().vms / threads),
                                    format_bytes(hb_process.memory_info().rss)) +
                                "Threads: {:>3}, ".format(threads)
                                )
        await _sleep(1)


async def start_trade_monitor(trade_monitor):
    from hummingbot.client.hummingbot_application import HummingbotApplication
    hb = HummingbotApplication.main_application()
    trade_monitor.log("Trades: 0, Total P&L: 0.00, Return %: 0.00%")

    while True:
        try:
            if hb.trading_core._strategy_running and hb.trading_core.strategy is not None:
                if all(market.ready for market in hb.trading_core.markets.values()):
                    with hb.trading_core.trade_fill_db.get_new_session() as session:
                        trades: List[TradeFill] = hb._get_trades_from_session(
                            int(hb.init_time * 1e3),
                            session=session,
                            config_file_path=hb.strategy_file_name)
                        if len(trades) > 0:
                            return_pcts = []
                            pnls = []
                            market_info: Set[Tuple[str, str]] = set((t.market, t.symbol) for t in trades)
                            for market, symbol in market_info:
                                cur_trades = [t for t in trades if t.market == market and t.symbol == symbol]
                                cur_balances = await hb.trading_core.get_current_balances(market)
                                perf = await PerformanceMetrics.create(symbol, cur_trades, cur_balances)
                                return_pcts.append(perf.return_pct)
                                pnls.append(perf.total_pnl)
                            avg_return = sum(return_pcts) / len(return_pcts) if len(return_pcts) > 0 else s_decimal_0
                            quote_assets = set(t.symbol.split("-")[1] for t in trades)
                            if len(quote_assets) == 1:
                                total_pnls = f"{PerformanceMetrics.smart_round(sum(pnls))} {list(quote_assets)[0]}"
                            else:
                                total_pnls = "N/A"
                            trade_monitor.log(f"Trades: {len(trades)}, Total P&L: {total_pnls}, "
                                              f"Return %: {avg_return:.2%}")
            await _sleep(2.0)  # sleeping for longer to manage resources
        except asyncio.CancelledError:
            raise
        except Exception:
            hb.logger().exception("start_trade_monitor failed.")
            await _sleep(2.0)


def format_df_for_printout(
    df: pd.DataFrame, table_format: ClientConfigEnum, max_col_width: Optional[int] = None, index: bool = False
) -> str:
    if max_col_width is not None:  # in anticipation of the next release of tabulate which will include maxcolwidth
        max_col_width = max(max_col_width, 4)

        def _truncate(value: Any) -> str:
            """Ensure all cells are strings before enforcing width limits."""
            value_str = "" if value is None else str(value)
            return value_str if len(value_str) < max_col_width else f"{value_str[:max_col_width - 3]}..."

        df = df.apply(lambda s: s.apply(_truncate))
        df.columns = [c if len(c) < max_col_width else f"{c[:max_col_width - 3]}..." for c in df.columns]

    original_preserve_whitespace = tabulate.PRESERVE_WHITESPACE
    original_wide_chars_mode = tabulate.WIDE_CHARS_MODE
    tabulate.PRESERVE_WHITESPACE = True
    tabulate.WIDE_CHARS_MODE = False  # Use len() for column widths for consistent cross-platform behavior
    try:
        formatted_df = tabulate.tabulate(df, tablefmt=table_format, showindex=index, headers="keys")
    finally:
        tabulate.PRESERVE_WHITESPACE = original_preserve_whitespace
        tabulate.WIDE_CHARS_MODE = original_wide_chars_mode
    return formatted_df

```

### Core Architecture Module: `hummingbot/connector/derivative/aevo_perpetual/aevo_perpetual_utils.py`
```
from decimal import Decimal

from pydantic import ConfigDict, Field, SecretStr

from hummingbot.client.config.config_data_types import BaseConnectorConfigMap
from hummingbot.core.data_type.trade_fee import TradeFeeSchema

DEFAULT_FEES = TradeFeeSchema(
    maker_percent_fee_decimal=Decimal("0"),
    taker_percent_fee_decimal=Decimal("0.0005"),
    buy_percent_fee_deducted_from_returns=True,
)

CENTRALIZED = True

EXAMPLE_PAIR = "ETH-USDC"

BROKER_ID = "HBOT"


class AevoPerpetualConfigMap(BaseConnectorConfigMap):
    connector: str = "aevo_perpetual"
    aevo_perpetual_api_key: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Aevo API key",
            "is_secure": True,
            "is_connect_key": True,
            "prompt_on_new": True,
        },
    )
    aevo_perpetual_api_secret: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Aevo API secret",
            "is_secure": True,
            "is_connect_key": True,
            "prompt_on_new": True,
        },
    )
    aevo_perpetual_signing_key: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Aevo signing key (private key)",
            "is_secure": True,
            "is_connect_key": True,
            "prompt_on_new": True,
        },
    )
    aevo_perpetual_account_address: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Aevo account address",
            "is_secure": True,
            "is_connect_key": True,
            "prompt_on_new": True,
        },
    )
    model_config = ConfigDict(title="aevo_perpetual")


KEYS = AevoPerpetualConfigMap.model_construct()

OTHER_DOMAINS = ["aevo_perpetual_testnet"]
OTHER_DOMAINS_PARAMETER = {"aevo_perpetual_testnet": "aevo_perpetual_testnet"}
OTHER_DOMAINS_EXAMPLE_PAIR = {"aevo_perpetual_testnet": "ETH-USDC"}
OTHER_DOMAINS_DEFAULT_FEES = {"aevo_perpetual_testnet": [0, 0.0005]}


class AevoPerpetualTestnetConfigMap(BaseConnectorConfigMap):
    connector: str = "aevo_perpetual_testnet"
    aevo_perpetual_testnet_api_key: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Aevo testnet API key",
            "is_secure": True,
            "is_connect_key": True,
            "prompt_on_new": True,
        },
    )
    aevo_perpetual_testnet_api_secret: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Aevo testnet API secret",
            "is_secure": True,
            "is_connect_key": True,
            "prompt_on_new": True,
        },
    )
    aevo_perpetual_testnet_signing_key: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Aevo testnet signing key (private key)",
            "is_secure": True,
            "is_connect_key": True,
            "prompt_on_new": True,
        },
    )
    aevo_perpetual_testnet_account_address: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Aevo testnet account address",
            "is_secure": True,
            "is_connect_key": True,
            "prompt_on_new": True,
        },
    )
    model_config = ConfigDict(title="aevo_perpetual")


OTHER_DOMAINS_KEYS = {
    "aevo_perpetual_testnet": AevoPerpetualTestnetConfigMap.model_construct(),
}

```

### Core Architecture Module: `hummingbot/connector/derivative/aevo_perpetual/aevo_perpetual_web_utils.py`
```
from decimal import ROUND_DOWN, Decimal
from typing import Any, Dict, Optional

import hummingbot.connector.derivative.aevo_perpetual.aevo_perpetual_constants as CONSTANTS
from hummingbot.core.api_throttler.async_throttler import AsyncThrottler
from hummingbot.core.web_assistant.auth import AuthBase
from hummingbot.core.web_assistant.connections.data_types import RESTMethod, RESTRequest
from hummingbot.core.web_assistant.rest_pre_processors import RESTPreProcessorBase
from hummingbot.core.web_assistant.web_assistants_factory import WebAssistantsFactory


class AevoPerpetualRESTPreProcessor(RESTPreProcessorBase):

    async def pre_process(self, request: RESTRequest) -> RESTRequest:
        if request.headers is None:
            request.headers = {}
        request.headers["Content-Type"] = "application/json"
        return request


def private_rest_url(*args, **kwargs) -> str:
    return rest_url(*args, **kwargs)


def public_rest_url(*args, **kwargs) -> str:
    return rest_url(*args, **kwargs)


def rest_url(path_url: str, domain: str = CONSTANTS.DEFAULT_DOMAIN):
    base_url = CONSTANTS.BASE_URL if domain == CONSTANTS.DEFAULT_DOMAIN else CONSTANTS.TESTNET_BASE_URL
    return base_url + path_url


def wss_url(domain: str = CONSTANTS.DEFAULT_DOMAIN):
    base_ws_url = CONSTANTS.WSS_URL if domain == CONSTANTS.DEFAULT_DOMAIN else CONSTANTS.TESTNET_WSS_URL
    return base_ws_url


def build_api_factory(
        throttler: Optional[AsyncThrottler] = None,
        auth: Optional[AuthBase] = None) -> WebAssistantsFactory:
    throttler = throttler or create_throttler()
    api_factory = WebAssistantsFactory(
        throttler=throttler,
        rest_pre_processors=[AevoPerpetualRESTPreProcessor()],
        auth=auth)

    return api_factory


def build_api_factory_without_time_synchronizer_pre_processor(throttler: AsyncThrottler) -> WebAssistantsFactory:
    api_factory = WebAssistantsFactory(
        throttler=throttler,
        rest_pre_processors=[AevoPerpetualRESTPreProcessor()])

    return api_factory


def create_throttler() -> AsyncThrottler:
    return AsyncThrottler(CONSTANTS.RATE_LIMITS)


def is_exchange_information_valid(rule: Dict[str, Any]) -> bool:
    return bool(rule.get("is_active", False))


def decimal_to_int(value: Decimal, decimals: int = 6) -> int:
    scale = Decimal(10) ** decimals
    return int((value * scale).quantize(Decimal("1"), rounding=ROUND_DOWN))


async def get_current_server_time(
        throttler: Optional[AsyncThrottler] = None,
        domain: str = CONSTANTS.DEFAULT_DOMAIN,
) -> float:
    throttler = throttler or create_throttler()
    api_factory = build_api_factory_without_time_synchronizer_pre_processor(throttler=throttler)
    rest_assistant = await api_factory.get_rest_assistant()
    response = await rest_assistant.execute_request(
        url=public_rest_url(path_url=CONSTANTS.PING_PATH_URL, domain=domain),
        method=RESTMethod.GET,
        throttler_limit_id=CONSTANTS.PING_PATH_URL,
    )
    server_time = response.get("timestamp")

    if server_time is None:
        raise KeyError(f"Unexpected server time response: {response}")
    return float(server_time)

```

### Core Architecture Module: `hummingbot/connector/derivative/architect_perpetual/architect_perpetual_utils.py`
```
from decimal import Decimal

from pydantic import ConfigDict, Field, SecretStr

from hummingbot.client.config.config_data_types import BaseConnectorConfigMap
from hummingbot.connector.derivative.architect_perpetual import architect_perpetual_constants as CONSTANTS
from hummingbot.core.data_type.trade_fee import TradeFeeSchema

DEFAULT_FEES = TradeFeeSchema(  # https://architect.co/legal/ax-pricing-policy section 5
    maker_percent_fee_decimal=Decimal("0.0002"),
    taker_percent_fee_decimal=Decimal("0.0025"),
    buy_percent_fee_deducted_from_returns=True
)

CENTRALIZED = True

EXAMPLE_PAIR = "EUR-USD"


class ArchitectPerpetualConfigMapBase(BaseConnectorConfigMap):
    use_auth_for_public_endpoints: bool = True  # used for MarketDataProvider.update_rates_task
    api_key: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Architect Perpetual API key",
            "is_secure": True,
            "is_connect_key": True,
            "prompt_on_new": True
        }
    )
    api_secret: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Architect Perpetual API secret",
            "is_secure": True,
            "is_connect_key": True,
            "prompt_on_new": True
        }
    )


class ArchitectPerpetualConfigMap(ArchitectPerpetualConfigMapBase):
    connector: str = CONSTANTS.EXCHANGE_NAME
    model_config = ConfigDict(title=CONSTANTS.EXCHANGE_NAME)


KEYS = ArchitectPerpetualConfigMap.model_construct()

OTHER_DOMAINS = [CONSTANTS.SANDBOX_DOMAIN]
OTHER_DOMAINS_PARAMETER = {CONSTANTS.SANDBOX_DOMAIN: CONSTANTS.SANDBOX_DOMAIN}
OTHER_DOMAINS_EXAMPLE_PAIR = {CONSTANTS.SANDBOX_DOMAIN: EXAMPLE_PAIR}
OTHER_DOMAINS_DEFAULT_FEES = {CONSTANTS.SANDBOX_DOMAIN: DEFAULT_FEES}


class ArchitectTestnetConfigMap(ArchitectPerpetualConfigMapBase):
    connector: str = CONSTANTS.SANDBOX_DOMAIN
    model_config = ConfigDict(title=CONSTANTS.SANDBOX_DOMAIN)


OTHER_DOMAINS_KEYS = {CONSTANTS.SANDBOX_DOMAIN: ArchitectTestnetConfigMap.model_construct()}

```

### Core Architecture Module: `hummingbot/connector/derivative/architect_perpetual/architect_perpetual_web_utils.py`
```
from typing import Callable, Optional

import pandas as pd

from hummingbot.connector.derivative.architect_perpetual import architect_perpetual_constants as CONSTANTS
from hummingbot.connector.time_synchronizer import TimeSynchronizer
from hummingbot.connector.utils import TimeSynchronizerRESTPreProcessor
from hummingbot.core.api_throttler.async_throttler import AsyncThrottler
from hummingbot.core.web_assistant.auth import AuthBase
from hummingbot.core.web_assistant.connections.data_types import RESTMethod
from hummingbot.core.web_assistant.web_assistants_factory import WebAssistantsFactory


def public_rest_url(path_url: str, domain: str) -> str:
    return f"{CONSTANTS.REST_URL_BASES[domain]}{path_url}"


def private_rest_url(path_url: str, domain: str) -> str:
    return f"{CONSTANTS.REST_URL_BASES[domain]}{path_url}"


def public_ws_url(domain: str) -> str:
    return CONSTANTS.PUBLIC_WS_URL[domain]


def private_ws_url(domain: str) -> str:
    return CONSTANTS.PRIVATE_WS_URL[domain]


def build_api_factory(
    throttler: Optional[AsyncThrottler] = None,
    time_synchronizer: Optional[TimeSynchronizer] = None,
    time_provider: Optional[Callable] = None,
    auth: Optional[AuthBase] = None,
    domain: str = CONSTANTS.DEFAULT_DOMAIN,
) -> WebAssistantsFactory:
    throttler = throttler or create_throttler()
    time_synchronizer = time_synchronizer or TimeSynchronizer()
    time_provider = time_provider or (lambda: get_current_server_time(throttler=throttler, domain=domain))
    api_factory = WebAssistantsFactory(
        throttler=throttler,
        auth=auth,
        rest_pre_processors=[
            TimeSynchronizerRESTPreProcessor(
                synchronizer=time_synchronizer,
                time_provider=time_provider
            ),
        ],
    )

    return api_factory


def build_api_factory_without_time_synchronizer_pre_processor(
    throttler: Optional[AsyncThrottler] = None
) -> WebAssistantsFactory:
    throttler = throttler or create_throttler()
    api_factory = WebAssistantsFactory(throttler=throttler)

    return api_factory


def create_throttler() -> AsyncThrottler:
    throttler = AsyncThrottler(CONSTANTS.RATE_LIMITS)

    return throttler


async def get_current_server_time(
    throttler: Optional[AsyncThrottler] = None, domain: str = CONSTANTS.DEFAULT_DOMAIN
) -> float:
    throttler = throttler or create_throttler()
    api_factory = build_api_factory_without_time_synchronizer_pre_processor(throttler=throttler)
    rest_assistant = await api_factory.get_rest_assistant()

    url = public_rest_url(path_url=CONSTANTS.SERVER_TIME_ENDPOINT, domain=domain)
    response = await rest_assistant.execute_request(
        url=url,
        throttler_limit_id=CONSTANTS.SERVER_TIME_ENDPOINT,
        method=RESTMethod.GET,
        return_err=True,
    )
    timestamp = pd.Timestamp(response["timestamp"]).timestamp()

    return timestamp

```

### Core Architecture Module: `hummingbot/connector/derivative/backpack_perpetual/backpack_perpetual_utils.py`
```
from decimal import Decimal
from typing import Any, Dict

from pydantic import ConfigDict, Field, SecretStr

from hummingbot.client.config.config_data_types import BaseConnectorConfigMap
from hummingbot.core.data_type.trade_fee import TradeFeeSchema

CENTRALIZED = True
EXAMPLE_PAIR = "SOL-USDC"

DEFAULT_FEES = TradeFeeSchema(
    maker_percent_fee_decimal=Decimal("0.0002"),
    taker_percent_fee_decimal=Decimal("0.0005"),
    buy_percent_fee_deducted_from_returns=False
)


def is_exchange_information_valid(exchange_info: Dict[str, Any]) -> bool:
    """
    Verifies if a trading pair is enabled to operate with based on its exchange information
    :param exchange_info: the exchange information for a trading pair
    :return: True if the trading pair is enabled, False otherwise
    """
    is_trading = exchange_info.get("visible", False)

    market_type = exchange_info.get("marketType", None)
    is_perp = market_type == "PERP"

    return is_trading and is_perp


class BackpackConfigMap(BaseConnectorConfigMap):
    connector: str = "backpack_perpetual"
    backpack_api_key: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": lambda cm: "Enter your Backpack Perpetual API key",
            "is_secure": True,
            "is_connect_key": True,
            "prompt_on_new": True,
        }
    )
    backpack_api_secret: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": lambda cm: "Enter your Backpack Perpetual API secret",
            "is_secure": True,
            "is_connect_key": True,
            "prompt_on_new": True,
        }
    )
    model_config = ConfigDict(title="backpack_perpetual")


KEYS = BackpackConfigMap.model_construct()

```

### Core Architecture Module: `hummingbot/connector/derivative/backpack_perpetual/backpack_perpetual_web_utils.py`
```
from typing import Callable, Optional

import hummingbot.connector.derivative.backpack_perpetual.backpack_perpetual_constants as CONSTANTS
from hummingbot.connector.time_synchronizer import TimeSynchronizer
from hummingbot.connector.utils import TimeSynchronizerRESTPreProcessor
from hummingbot.core.api_throttler.async_throttler import AsyncThrottler
from hummingbot.core.web_assistant.auth import AuthBase
from hummingbot.core.web_assistant.connections.data_types import RESTMethod
from hummingbot.core.web_assistant.web_assistants_factory import WebAssistantsFactory


def public_rest_url(path_url: str,
                    domain: str = CONSTANTS.DEFAULT_DOMAIN) -> str:
    """
    Creates a full URL for provided public REST endpoint
    :param path_url: a public REST endpoint
    :param domain: the Backpack domain to connect to. The default value is "exchange"
    :return: the full URL to the endpoint
    """
    return CONSTANTS.REST_URL.format(domain) + path_url


def private_rest_url(path_url: str, domain: str = CONSTANTS.DEFAULT_DOMAIN) -> str:
    """
    Creates a full URL for provided private REST endpoint
    :param path_url: a private REST endpoint
    :param domain: the Backpack domain to connect to. The default value is "exchange"
    :return: the full URL to the endpoint
    """
    return CONSTANTS.REST_URL.format(domain) + path_url


def build_api_factory(
        throttler: Optional[AsyncThrottler] = None,
        time_synchronizer: Optional[TimeSynchronizer] = None,
        domain: str = CONSTANTS.DEFAULT_DOMAIN,
        time_provider: Optional[Callable] = None,
        auth: Optional[AuthBase] = None, ) -> WebAssistantsFactory:
    throttler = throttler or create_throttler()
    time_synchronizer = time_synchronizer or TimeSynchronizer()
    time_provider = time_provider or (lambda: get_current_server_time(
        throttler=throttler,
        domain=domain,
    ))
    api_factory = WebAssistantsFactory(
        throttler=throttler,
        auth=auth,
        rest_pre_processors=[
            TimeSynchronizerRESTPreProcessor(synchronizer=time_synchronizer, time_provider=time_provider),
        ])
    return api_factory


def build_api_factory_without_time_synchronizer_pre_processor(throttler: AsyncThrottler) -> WebAssistantsFactory:
    api_factory = WebAssistantsFactory(throttler=throttler)
    return api_factory


def create_throttler() -> AsyncThrottler:
    return AsyncThrottler(CONSTANTS.RATE_LIMITS)


async def get_current_server_time(
        throttler: Optional[AsyncThrottler] = None,
        domain: str = CONSTANTS.DEFAULT_DOMAIN,
) -> float:
    throttler = throttler or create_throttler()
    api_factory = build_api_factory_without_time_synchronizer_pre_processor(throttler=throttler)
    rest_assistant = await api_factory.get_rest_assistant()
    response = await rest_assistant.execute_request(
        url=public_rest_url(path_url=CONSTANTS.SERVER_TIME_PATH_URL, domain=domain),
        method=RESTMethod.GET,
        throttler_limit_id=CONSTANTS.SERVER_TIME_PATH_URL,
    )
    server_time = float(response)
    return server_time

```

### Core Architecture Module: `hummingbot/connector/derivative/binance_perpetual/binance_perpetual_utils.py`
```
from decimal import Decimal

from pydantic import ConfigDict, Field, SecretStr

from hummingbot.client.config.config_data_types import BaseConnectorConfigMap
from hummingbot.core.data_type.trade_fee import TradeFeeSchema

DEFAULT_FEES = TradeFeeSchema(
    maker_percent_fee_decimal=Decimal("0.0002"),
    taker_percent_fee_decimal=Decimal("0.0004"),
    buy_percent_fee_deducted_from_returns=True
)

CENTRALIZED = True

EXAMPLE_PAIR = "BTC-USDT"

BROKER_ID = "x-3QreWesy"


class BinancePerpetualConfigMap(BaseConnectorConfigMap):
    connector: str = "binance_perpetual"
    binance_perpetual_api_key: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Binance Perpetual API key",
            "is_secure": True, "is_connect_key": True, "prompt_on_new": True}
    )
    binance_perpetual_api_secret: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Binance Perpetual API secret",
            "is_secure": True, "is_connect_key": True, "prompt_on_new": True}
    )


KEYS = BinancePerpetualConfigMap.model_construct()

OTHER_DOMAINS = ["binance_perpetual_testnet"]
OTHER_DOMAINS_PARAMETER = {"binance_perpetual_testnet": "binance_perpetual_testnet"}
OTHER_DOMAINS_EXAMPLE_PAIR = {"binance_perpetual_testnet": "BTC-USDT"}
OTHER_DOMAINS_DEFAULT_FEES = {"binance_perpetual_testnet": [0.02, 0.04]}


class BinancePerpetualTestnetConfigMap(BaseConnectorConfigMap):
    connector: str = "binance_perpetual_testnet"
    binance_perpetual_testnet_api_key: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Binance Perpetual testnet API key",
            "is_secure": True, "is_connect_key": True, "prompt_on_new": True}
    )
    binance_perpetual_testnet_api_secret: SecretStr = Field(
        default=...,
        json_schema_extra={
            "prompt": "Enter your Binance Perpetual testnet API secret",
            "is_secure": True, "is_connect_key": True, "prompt_on_new": True}
    )
    model_config = ConfigDict(title="binance_perpetual")


OTHER_DOMAINS_KEYS = {"binance_perpetual_testnet": BinancePerpetualTestnetConfigMap.model_construct()}

```

### Core Architecture Module: `hummingbot/connector/derivative/binance_perpetual/binance_perpetual_web_utils.py`
```
from typing import Any, Callable, Dict, Optional

import hummingbot.connector.derivative.binance_perpetual.binance_perpetual_constants as CONSTANTS
from hummingbot.connector.time_synchronizer import TimeSynchronizer
from hummingbot.connector.utils import TimeSynchronizerRESTPreProcessor
from hummingbot.core.api_throttler.async_throttler import AsyncThrottler
from hummingbot.core.web_assistant.auth import AuthBase
from hummingbot.core.web_assistant.connections.data_types import RESTMethod, RESTRequest
from hummingbot.core.web_assistant.rest_pre_processors import RESTPreProcessorBase
from hummingbot.core.web_assistant.web_assistants_factory import WebAssistantsFactory


class BinancePerpetualRESTPreProcessor(RESTPreProcessorBase):

    async def pre_process(self, request: RESTRequest) -> RESTRequest:
        if request.headers is None:
            request.headers = {}
        request.headers["Content-Type"] = (
            "application/json" if request.method == RESTMethod.POST else "application/x-www-form-urlencoded"
        )
        return request


def public_rest_url(path_url: str, domain: str = "binance_perpetual"):
    base_url = CONSTANTS.PERPETUAL_BASE_URL if domain == "binance_perpetual" else CONSTANTS.TESTNET_BASE_URL
    return base_url + path_url


def private_rest_url(path_url: str, domain: str = "binance_perpetual"):
    base_url = CONSTANTS.PERPETUAL_BASE_URL if domain == "binance_perpetual" else CONSTANTS.TESTNET_BASE_URL
    return base_url + path_url


def wss_url(endpoint: str, domain: str = "binance_perpetual"):
    base_ws_url = CONSTANTS.PERPETUAL_WS_URL if domain == "binance_perpetual" else CONSTANTS.TESTNET_WS_URL
    return base_ws_url + endpoint


def build_api_factory(
        throttler: Optional[AsyncThrottler] = None,
        time_synchronizer: Optional[TimeSynchronizer] = None,
        domain: str = CONSTANTS.DOMAIN,
        time_provider: Optional[Callable] = None,
        auth: Optional[AuthBase] = None) -> WebAssistantsFactory:
    throttler = throttler or create_throttler()
    time_synchronizer = time_synchronizer or TimeSynchronizer()
    time_provider = time_provider or (lambda: get_current_server_time(
        throttler=throttler,
        domain=domain,
    ))
    api_factory = WebAssistantsFactory(
        throttler=throttler,
        auth=auth,
        rest_pre_processors=[
            TimeSynchronizerRESTPreProcessor(synchronizer=time_synchronizer, time_provider=time_provider),
            BinancePerpetualRESTPreProcessor(),
        ])
    return api_factory


def build_api_factory_without_time_synchronizer_pre_processor(throttler: AsyncThrottler) -> WebAssistantsFactory:
    api_factory = WebAssistantsFactory(
        throttler=throttler,
        rest_pre_processors=[BinancePerpetualRESTPreProcessor()])
    return api_factory


def create_throttler() -> AsyncThrottler:
    return AsyncThrottler(CONSTANTS.RATE_LIMITS)


async def get_current_server_time(
        throttler: Optional[AsyncThrottler] = None,
        domain: str = CONSTANTS.DOMAIN,
) -> float:
    throttler = throttler or create_throttler()
    api_factory = build_api_factory_without_time_synchronizer_pre_processor(throttler=throttler)
    rest_assistant = await api_factory.get_rest_assistant()
    response = await rest_assistant.execute_request(
        url=public_rest_url(path_url=CONSTANTS.SERVER_TIME_PATH_URL, domain=domain),
        method=RESTMethod.GET,
        throttler_limit_id=CONSTANTS.SERVER_TIME_PATH_URL,
    )
    server_time = response["serverTime"]
    return server_time


def is_exchange_information_valid(rule: Dict[str, Any]) -> bool:
    """
    Verifies if a trading pair is enabled to operate with based on its exchange information

    :param exchange_info: the exchange information for a trading pair

    :return: True if the trading pair is enabled, False otherwise
    """
    if rule["contractType"] in ("PERPETUAL", "TRADIFI_PERPETUAL") and rule["status"] == "TRADING":
        valid = True
    else:
        valid = False
    return valid

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8495** (2026-10-06): **Strategy V2 - LP volume drops when executors complete as POSITION_HOLD**
  *Symptoms*: ### Describe the bug  Strategy V2 `PerformanceReport.volume_traded` loses accumulated LP volume when an LP executor completes as `CloseType.POSITION_HOLD`.  While active, the LP executor reports fee-derived volume through `filled_amount_quote`. After closure, `ExecutorOrchestrator.generate_performance_report()` skips that value for `POSITION_HOLD` executors and counts `PositionHold.volume_traded_quote` instead. For LPs, the held orders summarize the **net token conversion** between deposit and withdrawal, rather than the cumulative swaps represented by the LP's earned fees. These values are not interchangeable.  A receipt-based offline reproduction with the native reporting methods gave:  | Stage | Volume contribution | | --- | ---: | | Active LP: approximately 0.0064759 quote in fees at a 0.01% fee rate | 64.7591 quote | | Completed as `POSITION_HOLD` | 0.976711 quote | | Archived via the cached-performance path | 0.976711 quote |  The same lifecycle caused a live controller's aggregate reported volume to fall from approximately 126.73 to 61.72 quote after two LP closures. The drop is in performance accounting; it does not establish that earned fees or wallet assets were lost.  ### Steps to reproduce  1. Run an LP executor with `keep_position=True`, and let it accrue fees so `filled_amount_quote` exceeds the net conversion represented by its held orders. 2. Read the controller performance while the LP is active. 3. Close the LP at a range limit, completing it as `POSITION_HO
  **Post-Mortem & Fix Analysis**:
  > Implemented in https://github.com/hummingbot/hummingbot/pull/8496 (branch `fix/preserve-lp-volume-on-position-hold`, commit `2b298336e`).  The PR preserves LP executor volume after `POSITION_HOLD` completion and in cached performance. Synthetic LP net-conversion entries remain available for inventory/PnL, but no longer contribute additional held-position volume.  Validation: 239 focused orchestration/LP tests passed, including closure → archival → restoration and duplicate-counting regressions; changed production lines have 100% diff coverage. All applicable pre-commit hooks passed.  Existing historical performance snapshots and pre-fix stored Position volume aggregates are not migrated. The fix has not been deployed to the running Docker bot. 

- **Issue #8463** (2026-09-25): **XRPL - custom market name is ignored, so two tokens with the same code overwrite each other in balances**
  *Symptoms*: ### Describe the bug  On XRPL a token is identified by its currency code together with the account that issued it, so USDC from Circle and USDC from GateHub are different assets that share a code. A custom_markets entry was added for the GateHub token under the name USDC.gh-XRP and it did appear in the trading pair list, but balance kept showing a single USDC figure matching only one of the two holdings on the wallet.  <img width="2048" height="789" alt="Image" src="https://github.com/user-attachments/assets/59f26e04-558a-4da2-bf0d-cc895b265ff7" />  The name given to a custom market is not used when the connector decides what to call a token in balances. Built-in markets do use theirs, which is how the shipped list keeps Bitstamp's USD separate as USD.b, but custom entries are merged in without that step and fall back to the plain currency code unless trading_pair_symbol is filled in. Two markets for the same code then produce the same name, the balance list keeps one value per name, and one holding silently overwrites the other. Nothing is flagged as missing or wrong, the surviving figure depends on the order the ledger returns the trustlines, and that understated balance also feeds anything that sizes orders from available funds.    ### Steps to reproduce  1. Use an XRPL wallet holding USDC from Circle `rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE` and USDC from GateHub `rcEGREd8NmkKRE8GE424sksyt1tJVFZwu`, with clearly different amounts on each. 2. Run `connect xrpl` with that wallet
  **Post-Mortem & Fix Analysis**:
  > I think this is fine. USDC Gatehub is no longer being used actively in XRPL, and USDC Coinbase is the canonical one.
  > Submitted a fix ensuring custom market trading pair symbols are preserved when resolving token symbols with regression tests in #8465.

- **Issue #8462** (2026-09-18): **Kalshi perpetual - LIMIT and LIMIT_MAKER close orders can open a position instead of reducing one**
  *Symptoms*: ### Describe the bug    A take-profit order meant only to reduce an open position was accepted by Kalshi as an ordinary opening order. Hummingbot marks it CLOSE internally, but the request carries no reduce-only flag, so Kalshi treats it like any other order.  <img width="940" height="1299" alt="Image" src="https://github.com/user-attachments/assets/df6fa689-411e-4d53-9e04-e4fda7a3cacd" />  ``` 026-09-17 21:42:00,019 - 352472 - hummingbot.connector.derivative.kalshi_perpetual.kalshi_perpetual_derivative.KalshiPerpetualDerivative - NETWORK - Error submitting buy LIMIT_MAKER order to Kalshi_perpetual for 0.000100 BTC-USD 76100. Traceback (most recent call last):   File "/home/eddga/hummingbot/hummingbot/8454/hummingbot/connector/exchange_py_base.py", line 462, in _create_order     await self._place_order_and_process_update(order=order, **kwargs,)   File "/home/eddga/hummingbot/hummingbot/8454/hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_derivative.py", line 328, in _place_order_and_process_update     exchange_order_id, update_timestamp = await self._place_order(                                           ^^^^^^^^^^^^^^^^^^^^^^^^     ...<7 lines>...     )     ^   File "/home/eddga/hummingbot/hummingbot/8454/hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_derivative.py", line 313, in _place_order     response = await self._api_post(                ^^^^^^^^^^^^^^^^^^^^^     ...<3 lines>...         limit_id=CONSTANTS.CREATE_ORDER_LIMIT_ID)     

- **Issue #8374** (2026-07-21): **Bug Report — Local dashboard installation/running is unclear**
  *Symptoms*: ### Describe the bug  I'm following [the documentation/quickstart guide](https://hummingbot.org/blog/hummingbot-dashboard-quickstart-guide/) for accessing a hummingbot dashboard on my machine. Installation has gone smoothly, but there doesn't appear to be any dashboard to access that matches the screenshot seen in the guide. It mentions hitting port `8501`, but that port isn't specified in the project's docker compose and searching across the repository for it yields very few results.  Is the quickstart guide in need of corrections/updates?   ### Steps to reproduce  1. [Access quickstart guide](https://hummingbot.org/blog/hummingbot-dashboard-quickstart-guide/) 2.Follow installation instructions  3. Attempt to access localhost:8501 / the dashboard   ### Release version  2.14.0  ### Type of installation  Source  ### Attach required files  _No response_
  **Post-Mortem & Fix Analysis**:
  > Dashboard is already deprecated - please use Condor instead. 

- **Issue #8346** (2026-07-29): **PMM Mister - GLOBAL_STOP_LOSS can spam when position profit protection and target_base stop loss are both enabled**
  *Symptoms*: ### Describe the bug  While reviewing PMM Mister behavior, historical data showed a risky interaction when `position_profit_protection=true` and `global_sl_enabled=true`. In that setup, position profit protection can block reduction-side orders when reducing the held position would lock in a loss. That leaves the position exposed while unrealized PnL keeps dropping until it eventually reaches the configured global stop loss.  <img width="1670" height="1340" alt="Image" src="https://github.com/user-attachments/assets/90546e13-eb06-44a7-8bd2-28d3cf1c1932" />  ``` 2026-06-05 11:21:44,302 - 18 - hummingbot.strategy_v2.runnable_base - INFO - Global close phase=stopping complete. All executors stopped. Transitioning to closing. 2026-06-05 11:21:44,303 - 18 - hummingbot.strategy_v2.runnable_base - INFO - Global close phase=closing: exchange position is 0. Done. 2026-06-05 11:21:45,304 - 18 - hummingbot.strategy_v2.runnable_base - INFO - === GLOBAL STOP_LOSS TRIGGERED — PHASE 1: STOPPING EXECUTORS ===   PnL: -8.0046% | Position: 0.84 | Base%: 71.1844%   Stopping 0 active executors before closing position. 2026-06-05 11:21:46,306 - 18 - hummingbot.strategy_v2.runnable_base - INFO - Global close phase=stopping complete. All executors stopped. Transitioning to closing. 2026-06-05 11:21:46,307 - 18 - hummingbot.strategy_v2.runnable_base - INFO - Global close phase=closing: exchange position is 0. Done. 2026-06-05 11:21:47,308 - 18 - hummingbot.strategy_v2.runnable_base - INFO - === GLOBA
  **Post-Mortem & Fix Analysis**:
  > Hi @rapcmia, I confirmed the root cause. `_check_global_tp_sl()` reads `position_amount` from `processed_data`, which is sourced from `positions_held` in the orchestrator. That lags behind the connector's WebSocket-updated position data by one or more ticks, so even after `_get_exchange_position()` confirms the close (position = 0), the very next tick still sees the stale non-zero value and re-triggers, resetting `_global_close_retries` to 0 and defeating the abort guard.  Submitted a fix in #8348, which adds a cooldown flag that blocks re-triggering until the orchestrator's data also confirms the position is gone.

- **Issue #8327** (2026-07-29): **Lighter perpetual - historical candles returns 500 when candles timestamps are invalid (HAPI)**
  *Symptoms*: ### Describe the bug  This issue was noticed while using the Hummingbot API trade page with lighter_perpetual selected. Instead of returning candle data or a clear validation message, the historical candles request failed and the API returned 500 Internal Server Error. The backend log showed that the upstream Lighter candles endpoint rejected the request because end_timestamp was not greater than start_timestamp.  ```python 2026-06-26 13:35:20,428 - routers.market_data - ERROR - Unexpected error fetching historical candles: Error executing request GET https://mainnet.zklighter.elliot.ai/api/v1/candles. HTTP status is 400. Error: {"code":22400,"message":"invalid timestamps: end_timestamp must be greater than start_timestamp"} Traceback (most recent call last):   File "/hummingbot-api/routers/market_data.py", line 158, in get_historical_candles     historical_data = await asyncio.wait_for(                       ^^^^^^^^^^^^^^^^^^^^^^^   File "/opt/conda/envs/hummingbot-api/lib/python3.12/asyncio/tasks.py", line 520, in wait_for     return await fut            ^^^^^^^^^   File "/opt/conda/envs/hummingbot-api/lib/python3.12/site-packages/hummingbot/data_feed/candles_feed/candles_base.py", line 197, in get_historical_candles     raise e   File "/opt/conda/envs/hummingbot-api/lib/python3.12/site-packages/hummingbot/data_feed/candles_feed/candles_base.py", line 176, in get_historical_candles     candles = await self.fetch_candles(start_time=current_start_time,               ^^^^^^^^
  **Post-Mortem & Fix Analysis**:
  > I dug into this and the root cause is one level above the Lighter feed.  `CandlesBase.get_historical_candles` calls `fetch_candles` with `limit=0` whenever the requested range rounds to `start == end` — either a range shorter than one interval, or pagination landing exactly on the start boundary. With `limit=0`, `fetch_candles` computes `candles_to_fetch = 0`, which collapses the request window to `start_time == end_time` — exactly the zero-width range Lighter rejects with `end_timestamp must be greater than start_timestamp`.  #8311 added client-side validation in `_get_rest_candles_params` (both Lighter feeds), so the invalid request no longer reaches the exchange — but the caller still constructs it, so the same scenario now fails with a client-side `ValueError` instead of the upstream 400, and HAPI still returns 500.  Fix (PR coming shortly): clamp the fetch size in `CandlesBase.fetch_candles` so the request window always spans at least one interval, and dedupe the boundary candle i

- **Issue #8326** (2026-06-30): **Lighter spot - market sell exits fail on LIT-USDC during grid_strike testing**
  *Symptoms*: ### Describe the bug  This issue was spotted while testing the #8311 with the `generic.grid_strike` controller on Lighter spot using `LIT-USDC`. The strategy was able to start, place limit-maker buy orders, and record completed buy fills, so the entry side looked normal. The problem showed up when the strategy tried to close filled levels using market sell orders. Those sell orders were created, but they failed almost immediately and kept retrying instead of closing the position as expected.  <img width="932" height="810" alt="Image" src="https://github.com/user-attachments/assets/13aa68d5-1417-4c2e-910f-76376a458901" />  The same behavior was then compared against the `development` branch and it still appeared there, so this does not currently look like a PR-only regression. In the test log, the Lighter spot connector also reported that `LIT-USDC` is not a loaded Lighter spot market even though order book subscription and limit buys still proceeded. In the matching SQLite file, completed buy orders were recorded, while repeated market sell attempts were stored as `OrderFailure`. This suggests the spot connector path for `LIT-USDC` is not handling market sell exits reliably in this flow.    ### Steps to reproduce  1. Run `v2_with_controllers` with `26062026_gridstrike01spot.yml` using `connector_name: lighter` and `trading_pair: LIT-USDC`. 2. Let the strategy place and fill one or more limit-maker buy orders. 3. Wait for the take-profit close logic to submit market sell exits
  **Post-Mortem & Fix Analysis**:
  > Fixed #8311 commit 432f75720cda22f6da3f970012eebd205212bbc4

- **Issue #8309** (2026-08-03): **Lighter perpetual - repeated 429 errors appear during Condor + HAPI test**
  *Symptoms*: ### Describe the bug  This issue was found while testing PR #8304 through the Condor + HAPI. Repeated `429 Too Many Requests` errors appeared on Lighter when perpetual APIs were enabled. The failures showed up in both the Lighter perpetual private websocket connection and Lighter candle polling, which caused repeated retries instead of stabilizing.  ``` 2026-06-18 08:03:37,134 - hummingbot.connector.derivative.lighter_perpetual.lighter_perpetual_user_stream_data_source.LighterPerpetualUserStreamDataSource - ERROR - Unexpected error while listening to user stream. Retrying after 5 seconds... Traceback (most recent call last):   File "/opt/conda/envs/hummingbot-api/lib/python3.12/site-packages/hummingbot/core/data_type/user_stream_tracker_data_source.py", line 45, in listen_for_user_stream     self._ws_assistant = await self._connected_websocket_assistant()                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/opt/conda/envs/hummingbot-api/lib/python3.12/site-packages/hummingbot/connector/derivative/lighter_perpetual/lighter_perpetual_user_stream_data_source.py", line 47, in _connected_websocket_assistant     await self._ws_assistant.connect(   File "/opt/conda/envs/hummingbot-api/lib/python3.12/site-packages/hummingbot/core/web_assistant/ws_assistant.py", line 45, in connect     await self._connection.connect(   File "/opt/conda/envs/hummingbot-api/lib/python3.12/site-packages/hummingbot/core/web_assistant/connections/ws_connection.py", line 39, in conn

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

### Incident Patch 1: `0d6cd852` (2026-09-18)
**Commit Message**: Merge pull request #8464 from hummingbot/fix/kalshi-perpetual-resting-close-orders

(fix) emulate reduce_only for resting kalshi_perpetual close orders

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_constants.py` (modified, +2/-1)
```diff
@@ -57,7 +57,8 @@
 CANCEL_ORDER_LIMIT_ID = f"DELETE{ORDER_PATH_URL}"
 
 # Order parameters. Kalshi only takes limit orders (price is required), so market orders are sent as
-# immediate-or-cancel limit orders priced this far through the book. reduce_only is rejected on resting orders.
+# immediate-or-cancel limit orders priced this far through the book. reduce_only is rejected on resting orders, so the
+# connector emulates it for them.
 TIME_IN_FORCE_GTC = "good_till_canceled"
 TIME_IN_FORCE_IOC = "immediate_or_cancel"
 SELF_TRADE_PREVENTION_TYPE = "taker_at_cross"
```

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_derivative.py` (modified, +21/-1)
```diff
@@ -308,8 +308,13 @@ async def _place_order(
         if order_type is OrderType.LIMIT_MAKER:
             order["post_only"] = True
         if position_action is PositionAction.CLOSE and time_in_force == CONSTANTS.TIME_IN_FORCE_IOC:
-            # Kalshi rejects reduce_only on resting orders, so only immediate orders can carry it.
             order["reduce_only"] = True
+        elif position_action is PositionAction.CLOSE and self._close_would_open_position(trading_pair, trade_type):
+            # Kalshi rejects reduce_only on resting orders, so it's emulated. The cached position may not include the
+            # fill this close follows yet, so it's refreshed before rejecting.
+            await self._update_positions()
+            if self._close_would_open_position(trading_pair, trade_type):
+                raise ValueError(f"No {trading_pair} position for the {trade_type.name} order {order_id} to close.")
         response = await self._api_post(
             path_url=CONSTANTS.ORDERS_PATH_URL,
             data=order,
@@ -641,7 +646,12 @@ async def _update_balances(self):
                                       for key in ("initial_margin", "maintenance_margin", "resting_orders_margin")}
         self._orders_in_balance = acknowledged
 
+    def _close_would_open_position(self, trading_pair: str, trade_type: TradeType) -> bool:
+        position = self._perpetual_trading.get_position(trading_pair)
+        return position is None or (position.amount > 0) == (trade_type is TradeType.BUY)
+
     async def _update_positions(self):
+        requested_at = self.current_timestamp
         response = await self._api_get(
             path_url=CONSTANTS.POSITIONS_PATH_URL,
             params={"subaccount": 0},
@@ -670,6 +680,16 @@ async def _update_positions(self):
         # Kalshi only lists open positions: anything no longer listed was closed.
         for pos_key in set(self._perpetual_trading.account_positions.keys()) - open_position_keys:
             self._perpetual_trading.remove_position(pos_key)
+        # Resting close orders aren't reduce_only on Kalshi: once their position is gone, filling them would open one.
+        # Orders placed after the request may follow a fill this response doesn't include yet, so they're checked
+        # again by another refresh instead.
+        for order in list(self.in_flight_orders.values()):
+            if (order.position is PositionAction.CLOSE and order.is_open
+                    and self._close_would_open_position(order.trading_pair, order.trade_type)):
+                if order.creation_timestamp < requested_at:
+                    safe_ensure_future(self._execute_cancel(order.trading_pair, order.client_order_id))
+                else:
+                    self._schedule_account_refresh()
 
     async def _trading_pair_position_mode_set(self, mode: PositionMode, trading_pair: str) -> Tuple[bool, str]:
         if mode == PositionMode.ONEWAY:
```

**File**: `test/hummingbot/connector/derivative/kalshi_perpetual/test_kalshi_perpetual_derivative.py` (modified, +73/-0)
```diff
@@ -19,6 +19,7 @@
     KalshiPerpetualBudgetChecker,
     KalshiPerpetualDerivative,
 )
+from hummingbot.connector.derivative.position import Position
 from hummingbot.connector.test_support.perpetual_derivative_test import AbstractPerpetualDerivativeTests
 from hummingbot.connector.trading_rule import TradingRule
 from hummingbot.core.data_type.common import OrderType, PositionAction, PositionMode, PositionSide, TradeType
@@ -837,6 +838,78 @@ def test_create_market_order_is_immediate_limit_order_through_the_book(self, moc
         self.exchange.get_price.assert_any_call(self.trading_pair, is_buy=True)
         self.exchange.get_price.assert_any_call(self.trading_pair, is_buy=False)
 
+    def _set_position(self, amount: str):
+        position_side = PositionSide.LONG if Decimal(amount) > 0 else PositionSide.SHORT
+        self.exchange._perpetual_trading.set_position(self.trading_pair, Position(
+            trading_pair=self.trading_pair, position_side=position_side, unrealized_pnl=Decimal("0"),
+            entry_price=Decimal("10000"), amount=Decimal(amount), leverage=Decimal("1")))
+
+    def test_create_order_to_close_short_position(self):
+        # Resting closes need a position to close
+        self._set_position("-100")
+        super().test_create_order_to_close_short_position()
+
+    def test_create_order_to_close_long_position(self):
+        self._set_position("100")
+        super().test_create_order_to_close_long_position()
+
+    @aioresponses()
+    def test_resting_close_order_without_position_is_rejected_after_refreshing_positions(self, mock_api):
+        self._simulate_trading_rules_initialized()
+        self._set_position("1")  # a long position: a buy would add to it
+        positions_url = web_utils.private_rest_url(CONSTANTS.POSITIONS_PATH_URL)
+        mock_api.get(_regex(positions_url), body=json.dumps({"positions": []}))
+
+        with self.assertRaises(ValueError):
+            self.async_run_with_timeout(self.exchange._place_order(
+                order_id="11", trading_pair=self.trading_pair, amount=Decimal("1"), trade_type=TradeType.BUY,
+                order_type=OrderType.LIMIT, price=Decimal("10000"), position_action=PositionAction.CLOSE))
+
+        self.assertEqual(1, len(self._all_executed_requests(mock_api, positions_url)))
+        self.assertEqual([], self._all_executed_requests(mock_api, self.order_creation_url))
+
+    @aioresponses()
+    def test_resting_close_order_is_placed_when_refreshed_positions_include_the_position(self, mock_api):
+        self._simulate_trading_rules_initialized()
+        position = {"subaccount": 0, "market_ticker": self.exchange_trading_pair, "position": "-1.00",
+                    "entry_price": "10000", "unrealized_pnl": "0", "fees": "0", "is_portfolio": False}
+        mock_api.get(_regex(web_utils.private_rest_url(CONSTANTS.POSITIONS_PATH_URL)),
+                     body=json.dumps({"positions": [position]}))
+        mock_api.post(self.order_creation_url, body=json.dumps(self.order_creation_request_successful_mock_response))
+
+        self.async_run_with_timeout(self.exchange._place_order(
+            order_id="11", trading_pair=self.trading_pair, amount=Decimal("1"), trade_type=TradeType.BUY,
+            order_type=OrderType.LIMIT_MAKER, price=Decimal("10000"), position_action=PositionAction.CLOSE))
+
+        request_data = json.loads(self._all_executed_requests(mock_api, self.order_creation_url)[0].kwargs["data"])
+        self.assertNotIn("reduce_only", request_data)
+
+    @aioresponses()
+    def test_update_positions_cancels_resting_close_orders_left_without_a_position(self, mock_api):
+        self._simulate_trading_rules_initialized()
+        self.exchange._set_current_timestamp(NOW)
+        self._set_position("-1")
+        for order_id, trade_type, position_action in (("stale", TradeType.BUY, PositionAction.CLOSE),
+                                                      ("open", TradeType.BUY, PositionAction.OPEN)):
+            self.exchange.start_tracking_order(
+                order_id=order_id, exchange_order_id=f"ex-{order_id}", trading_pair=self.trading_pair,
+                order_type=OrderType.LIMIT, trade_type=trade_type, price=Decimal("10000"), amount=Decimal("1"),
+                position_action=position_action)
+        self.exchange._set_current_timestamp(NOW + 1)
+        # Placed as the request is sent: it may close a position the response doesn't include yet, so another
+        # refresh checks it again
+        self.exchange.start_tracking_order(
+            order_id="fresh", exchange_order_id="ex-fresh", trading_pair=self.trading_pair, order_type=OrderType.LIMIT,
+            trade_type=TradeType.BUY, price=Decimal("10000"), amount=Decimal("1"), position_action=PositionAction.CLOSE)
+        self.exchange._execute_cancel = AsyncMock()
+        mock_api.get(_regex(web_utils.private_rest_url(CONSTANTS.POSITIONS_PATH_URL)), body=json.dumps({"positions": []}))
+
+        self.async_run
```

---

### Incident Patch 2: `7bddea37` (2026-09-17)
**Commit Message**: (fix) recheck kalshi_perpetual close orders the cancel pass skipped

A close placed while a position refresh was in flight is skipped by the
cancel pass, and its own order events only refresh balances, so a stale
cached position could leave it resting with no position to reduce.
Skipping one now schedules another refresh, which sees it as older.

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_derivative.py` (modified, +7/-3)
```diff
@@ -681,11 +681,15 @@ async def _update_positions(self):
         for pos_key in set(self._perpetual_trading.account_positions.keys()) - open_position_keys:
             self._perpetual_trading.remove_position(pos_key)
         # Resting close orders aren't reduce_only on Kalshi: once their position is gone, filling them would open one.
-        # Orders placed after the request may follow a fill this response doesn't include yet, so they're left alone.
+        # Orders placed after the request may follow a fill this response doesn't include yet, so they're checked
+        # again by another refresh instead.
         for order in list(self.in_flight_orders.values()):
-            if (order.position is PositionAction.CLOSE and order.is_open and order.creation_timestamp < requested_at
+            if (order.position is PositionAction.CLOSE and order.is_open
                     and self._close_would_open_position(order.trading_pair, order.trade_type)):
-                safe_ensure_future(self._execute_cancel(order.trading_pair, order.client_order_id))
+                if order.creation_timestamp < requested_at:
+                    safe_ensure_future(self._execute_cancel(order.trading_pair, order.client_order_id))
+                else:
+                    self._schedule_account_refresh()
 
     async def _trading_pair_position_mode_set(self, mode: PositionMode, trading_pair: str) -> Tuple[bool, str]:
         if mode == PositionMode.ONEWAY:
```

**File**: `test/hummingbot/connector/derivative/kalshi_perpetual/test_kalshi_perpetual_derivative.py` (modified, +3/-1)
```diff
@@ -896,7 +896,8 @@ def test_update_positions_cancels_resting_close_orders_left_without_a_position(s
                 order_type=OrderType.LIMIT, trade_type=trade_type, price=Decimal("10000"), amount=Decimal("1"),
                 position_action=position_action)
         self.exchange._set_current_timestamp(NOW + 1)
-        # Placed as the request is sent: it may close a position the response doesn't include yet
+        # Placed as the request is sent: it may close a position the response doesn't include yet, so another
+        # refresh checks it again
         self.exchange.start_tracking_order(
             order_id="fresh", exchange_order_id="ex-fresh", trading_pair=self.trading_pair, order_type=OrderType.LIMIT,
             trade_type=TradeType.BUY, price=Decimal("10000"), amount=Decimal("1"), position_action=PositionAction.CLOSE)
@@ -907,6 +908,7 @@ def test_update_positions_cancels_resting_close_orders_left_without_a_position(s
         self.async_run_with_timeout(asyncio.sleep(0))
 
         self.exchange._execute_cancel.assert_awaited_once_with(self.trading_pair, "stale")
+        self.exchange._schedule_account_refresh.assert_called_once_with()
 
     def test_order_state_is_derived_from_fill_and_remaining_counts(self):
         self._use_contract_size("0.0001")
```

---

### Incident Patch 3: `8ed2a924` (2026-09-17)
**Commit Message**: (fix) emulate reduce_only for resting kalshi_perpetual close orders

Kalshi rejects reduce_only unless the order is immediate, so LIMIT and
LIMIT_MAKER closes could open a position. Resting closes with no position
to reduce are now rejected (after refreshing positions), and position
refreshes cancel resting closes whose position is gone.

Fixes #8462

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_constants.py` (modified, +2/-1)
```diff
@@ -57,7 +57,8 @@
 CANCEL_ORDER_LIMIT_ID = f"DELETE{ORDER_PATH_URL}"
 
 # Order parameters. Kalshi only takes limit orders (price is required), so market orders are sent as
-# immediate-or-cancel limit orders priced this far through the book. reduce_only is rejected on resting orders.
+# immediate-or-cancel limit orders priced this far through the book. reduce_only is rejected on resting orders, so the
+# connector emulates it for them.
 TIME_IN_FORCE_GTC = "good_till_canceled"
 TIME_IN_FORCE_IOC = "immediate_or_cancel"
 SELF_TRADE_PREVENTION_TYPE = "taker_at_cross"
```

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_derivative.py` (modified, +17/-1)
```diff
@@ -308,8 +308,13 @@ async def _place_order(
         if order_type is OrderType.LIMIT_MAKER:
             order["post_only"] = True
         if position_action is PositionAction.CLOSE and time_in_force == CONSTANTS.TIME_IN_FORCE_IOC:
-            # Kalshi rejects reduce_only on resting orders, so only immediate orders can carry it.
             order["reduce_only"] = True
+        elif position_action is PositionAction.CLOSE and self._close_would_open_position(trading_pair, trade_type):
+            # Kalshi rejects reduce_only on resting orders, so it's emulated. The cached position may not include the
+            # fill this close follows yet, so it's refreshed before rejecting.
+            await self._update_positions()
+            if self._close_would_open_position(trading_pair, trade_type):
+                raise ValueError(f"No {trading_pair} position for the {trade_type.name} order {order_id} to close.")
         response = await self._api_post(
             path_url=CONSTANTS.ORDERS_PATH_URL,
             data=order,
@@ -641,7 +646,12 @@ async def _update_balances(self):
                                       for key in ("initial_margin", "maintenance_margin", "resting_orders_margin")}
         self._orders_in_balance = acknowledged
 
+    def _close_would_open_position(self, trading_pair: str, trade_type: TradeType) -> bool:
+        position = self._perpetual_trading.get_position(trading_pair)
+        return position is None or (position.amount > 0) == (trade_type is TradeType.BUY)
+
     async def _update_positions(self):
+        requested_at = self.current_timestamp
         response = await self._api_get(
             path_url=CONSTANTS.POSITIONS_PATH_URL,
             params={"subaccount": 0},
@@ -670,6 +680,12 @@ async def _update_positions(self):
         # Kalshi only lists open positions: anything no longer listed was closed.
         for pos_key in set(self._perpetual_trading.account_positions.keys()) - open_position_keys:
             self._perpetual_trading.remove_position(pos_key)
+        # Resting close orders aren't reduce_only on Kalshi: once their position is gone, filling them would open one.
+        # Orders placed after the request may follow a fill this response doesn't include yet, so they're left alone.
+        for order in list(self.in_flight_orders.values()):
+            if (order.position is PositionAction.CLOSE and order.is_open and order.creation_timestamp < requested_at
+                    and self._close_would_open_position(order.trading_pair, order.trade_type)):
+                safe_ensure_future(self._execute_cancel(order.trading_pair, order.client_order_id))
 
     async def _trading_pair_position_mode_set(self, mode: PositionMode, trading_pair: str) -> Tuple[bool, str]:
         if mode == PositionMode.ONEWAY:
```

**File**: `test/hummingbot/connector/derivative/kalshi_perpetual/test_kalshi_perpetual_derivative.py` (modified, +71/-0)
```diff
@@ -19,6 +19,7 @@
     KalshiPerpetualBudgetChecker,
     KalshiPerpetualDerivative,
 )
+from hummingbot.connector.derivative.position import Position
 from hummingbot.connector.test_support.perpetual_derivative_test import AbstractPerpetualDerivativeTests
 from hummingbot.connector.trading_rule import TradingRule
 from hummingbot.core.data_type.common import OrderType, PositionAction, PositionMode, PositionSide, TradeType
@@ -837,6 +838,76 @@ def test_create_market_order_is_immediate_limit_order_through_the_book(self, moc
         self.exchange.get_price.assert_any_call(self.trading_pair, is_buy=True)
         self.exchange.get_price.assert_any_call(self.trading_pair, is_buy=False)
 
+    def _set_position(self, amount: str):
+        position_side = PositionSide.LONG if Decimal(amount) > 0 else PositionSide.SHORT
+        self.exchange._perpetual_trading.set_position(self.trading_pair, Position(
+            trading_pair=self.trading_pair, position_side=position_side, unrealized_pnl=Decimal("0"),
+            entry_price=Decimal("10000"), amount=Decimal(amount), leverage=Decimal("1")))
+
+    def test_create_order_to_close_short_position(self):
+        # Resting closes need a position to close
+        self._set_position("-100")
+        super().test_create_order_to_close_short_position()
+
+    def test_create_order_to_close_long_position(self):
+        self._set_position("100")
+        super().test_create_order_to_close_long_position()
+
+    @aioresponses()
+    def test_resting_close_order_without_position_is_rejected_after_refreshing_positions(self, mock_api):
+        self._simulate_trading_rules_initialized()
+        self._set_position("1")  # a long position: a buy would add to it
+        positions_url = web_utils.private_rest_url(CONSTANTS.POSITIONS_PATH_URL)
+        mock_api.get(_regex(positions_url), body=json.dumps({"positions": []}))
+
+        with self.assertRaises(ValueError):
+            self.async_run_with_timeout(self.exchange._place_order(
+                order_id="11", trading_pair=self.trading_pair, amount=Decimal("1"), trade_type=TradeType.BUY,
+                order_type=OrderType.LIMIT, price=Decimal("10000"), position_action=PositionAction.CLOSE))
+
+        self.assertEqual(1, len(self._all_executed_requests(mock_api, positions_url)))
+        self.assertEqual([], self._all_executed_requests(mock_api, self.order_creation_url))
+
+    @aioresponses()
+    def test_resting_close_order_is_placed_when_refreshed_positions_include_the_position(self, mock_api):
+        self._simulate_trading_rules_initialized()
+        position = {"subaccount": 0, "market_ticker": self.exchange_trading_pair, "position": "-1.00",
+                    "entry_price": "10000", "unrealized_pnl": "0", "fees": "0", "is_portfolio": False}
+        mock_api.get(_regex(web_utils.private_rest_url(CONSTANTS.POSITIONS_PATH_URL)),
+                     body=json.dumps({"positions": [position]}))
+        mock_api.post(self.order_creation_url, body=json.dumps(self.order_creation_request_successful_mock_response))
+
+        self.async_run_with_timeout(self.exchange._place_order(
+            order_id="11", trading_pair=self.trading_pair, amount=Decimal("1"), trade_type=TradeType.BUY,
+            order_type=OrderType.LIMIT_MAKER, price=Decimal("10000"), position_action=PositionAction.CLOSE))
+
+        request_data = json.loads(self._all_executed_requests(mock_api, self.order_creation_url)[0].kwargs["data"])
+        self.assertNotIn("reduce_only", request_data)
+
+    @aioresponses()
+    def test_update_positions_cancels_resting_close_orders_left_without_a_position(self, mock_api):
+        self._simulate_trading_rules_initialized()
+        self.exchange._set_current_timestamp(NOW)
+        self._set_position("-1")
+        for order_id, trade_type, position_action in (("stale", TradeType.BUY, PositionAction.CLOSE),
+                                                      ("open", TradeType.BUY, PositionAction.OPEN)):
+            self.exchange.start_tracking_order(
+                order_id=order_id, exchange_order_id=f"ex-{order_id}", trading_pair=self.trading_pair,
+                order_type=OrderType.LIMIT, trade_type=trade_type, price=Decimal("10000"), amount=Decimal("1"),
+                position_action=position_action)
+        self.exchange._set_current_timestamp(NOW + 1)
+        # Placed as the request is sent: it may close a position the response doesn't include yet
+        self.exchange.start_tracking_order(
+            order_id="fresh", exchange_order_id="ex-fresh", trading_pair=self.trading_pair, order_type=OrderType.LIMIT,
+            trade_type=TradeType.BUY, price=Decimal("10000"), amount=Decimal("1"), position_action=PositionAction.CLOSE)
+        self.exchange._execute_cancel = AsyncMock()
+        mock_api.get(_regex(web_utils.private_rest_url(CONSTANTS.POSITIONS_PATH_URL)), body=json.dumps({"positions": []}))
+
+        self.async_run_with_timeout(self.exchange._update_positions()
```

---

### Incident Patch 4: `7a76df99` (2026-09-17)
**Commit Message**: Merge pull request #8448 from hummingbot/fix/xrpl-custom-market-balances

fix(xrpl): resolve token symbols for markets without a trading_pair_symbol

**File**: `hummingbot/connector/exchange/xrpl/xrpl_exchange.py` (modified, +8/-1)
```diff
@@ -3170,7 +3170,14 @@ async def wait_for_final_transaction_outcome(self, transaction, prelim_result, m
 
     def get_token_symbol_from_all_markets(self, code: str, issuer: str) -> Optional[str]:
         all_markets = self._make_xrpl_trading_pairs_request()
-        for market_name, market in all_markets.items():
+        # Markets declaring a trading_pair_symbol are consulted first. That alias is an
+        # explicit naming decision, so it keeps precedence over the code-derived fallback
+        # and every lookup that resolved before still resolves to the same symbol. sorted()
+        # is stable, so markets keep their relative order within each group.
+        ordered_markets = sorted(
+            all_markets.items(), key=lambda item: item[1].trading_pair_symbol is None
+        )
+        for market_name, market in ordered_markets:
             token_symbol = market.get_token_symbol(code, issuer)
 
             if token_symbol is not None:
```

**File**: `hummingbot/connector/exchange/xrpl/xrpl_utils.py` (modified, +16/-5)
```diff
@@ -142,14 +142,25 @@ def __repr__(self):
         return str(self.model_dump())
 
     def get_token_symbol(self, code: str, issuer: str) -> Optional[str]:
-        if self.trading_pair_symbol is None:
-            return None
-
+        """Symbol this market knows the given currency/issuer pair by, if it is one of them.
+
+        ``trading_pair_symbol`` is optional and only exists to alias a token to a different
+        display symbol. When it is not set there is still a perfectly good answer for a
+        matching currency and issuer — the market's own ``base``/``quote`` code — so the
+        match is what decides the outcome, not the presence of the alias.
+
+        Returning None whenever the alias was unset made the caller in ``_update_balances``
+        skip the balance entirely (``if token_symbol is None: continue``), so a real
+        on-ledger holding disappeared from balances and portfolio rather than showing up
+        with a zero value. Every entry in ``custom_markets`` is written without an alias
+        unless the user knows to add one — including the ``SOLO-XRP`` example shipped as
+        the field's own default — so this hit the default configuration too.
+        """
         if code.upper() == self.base.upper() and issuer.upper() == self.base_issuer.upper():
-            return self.trading_pair_symbol.split("-")[0]
+            return self.trading_pair_symbol.split("-")[0] if self.trading_pair_symbol else self.base.upper()
 
         if code.upper() == self.quote.upper() and issuer.upper() == self.quote_issuer.upper():
-            return self.trading_pair_symbol.split("-")[1]
+            return self.trading_pair_symbol.split("-")[1] if self.trading_pair_symbol else self.quote.upper()
 
         return None
 
```

**File**: `test/hummingbot/connector/exchange/xrpl/test_xrpl_market_token_symbol.py` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+import unittest
+
+from hummingbot.connector.exchange.xrpl.xrpl_utils import XRPLMarket
+
+BTC_ISSUER = "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"  # noqa: mock
+SOLO_ISSUER = "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz"  # noqa: mock
+
+
+class XRPLMarketGetTokenSymbolTests(unittest.TestCase):
+    """``trading_pair_symbol`` is an optional alias, not a precondition for matching.
+
+    ``_update_balances`` resolves every trustline the ledger returns through
+    ``get_token_symbol`` and skips the balance when it comes back None. Returning None
+    for any market without an alias therefore dropped real on-ledger holdings out of
+    balances and portfolio entirely — not shown at zero, absent. Entries in
+    ``custom_markets`` are written without an alias unless the user knows to add one,
+    including the ``SOLO-XRP`` example that ships as the field's own default.
+    """
+
+    def setUp(self):
+        self.market = XRPLMarket(base="BTC", quote="XRP", base_issuer=BTC_ISSUER, quote_issuer="")
+        self.aliased = XRPLMarket(
+            base="BTC",
+            quote="XRP",
+            base_issuer=BTC_ISSUER,
+            quote_issuer="",
+            trading_pair_symbol="WBTC-XRP",
+        )
+
+    def test_base_resolves_without_an_alias(self):
+        self.assertEqual(self.market.get_token_symbol("BTC", BTC_ISSUER), "BTC")
+
+    def test_quote_resolves_without_an_alias(self):
+        self.assertEqual(self.market.get_token_symbol("XRP", ""), "XRP")
+
+    def test_an_alias_still_takes_precedence(self):
+        self.assertEqual(self.aliased.get_token_symbol("BTC", BTC_ISSUER), "WBTC")
+        self.assertEqual(self.aliased.get_token_symbol("XRP", ""), "XRP")
+
+    def test_a_different_issuer_is_not_a_match(self):
+        """Same currency code from another gateway is a different asset."""
+        self.assertIsNone(self.market.get_token_symbol("BTC", SOLO_ISSUER))
+
+    def test_an_unknown_code_is_not_a_match(self):
+        self.assertIsNone(self.market.get_token_symbol("DOGE", BTC_ISSUER))
+
+    def test_matching_is_case_insensitive(self):
+        self.assertEqual(self.market.get_token_symbol("btc", BTC_ISSUER.lower()), "BTC")
+
+    def test_the_symbol_is_uppercase(self):
+        lowercase = XRPLMarket(base="btc", quote="xrp", base_issuer=BTC_ISSUER, quote_issuer="")
+        self.assertEqual(lowercase.get_token_symbol("BTC", BTC_ISSUER), "BTC")
+
+    def test_two_issuers_of_one_currency_code_stay_distinct(self):
+        """The fallback returns the currency code, so it is worth pinning that a market
+        still only answers for its own issuer. Two gateways issuing "BTC" are different
+        assets, and each market matches exactly one of them."""
+        theirs = XRPLMarket(base="BTC", quote="XRP", base_issuer=SOLO_ISSUER, quote_issuer="")
+
+        self.assertEqual(self.market.get_token_symbol("BTC", BTC_ISSUER), "BTC")
+        self.assertIsNone(self.market.get_token_symbol("BTC", SOLO_ISSUER))
+        self.assertEqual(theirs.get_token_symbol("BTC", SOLO_ISSUER), "BTC")
+        self.assertIsNone(theirs.get_token_symbol("BTC", BTC_ISSUER))
+
+    def test_the_shipped_default_market_resolves(self):
+        """The SOLO-XRP entry that XRPLConfigMap.custom_markets defaults to carries no
+        alias, so before this fix the connector's own default configuration dropped
+        SOLO balances."""
+        from hummingbot.connector.exchange.xrpl.xrpl_utils import XRPLConfigMap
+
+        default_markets = XRPLConfigMap.model_fields["custom_markets"].default
+        solo = default_markets["SOLO-XRP"]
+        self.assertIsNone(solo.trading_pair_symbol)
+        self.assertEqual(solo.get_token_symbol("SOLO", SOLO_ISSUER), "SOLO")
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 5: `178a3f08` (2026-09-17)
**Commit Message**: Merge branch 'development' into fix/xrpl-custom-market-balances

**File**: `hummingbot/connector/derivative/kalshi_perpetual/dummy.pxd` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+cdef class dummy():
+    pass
```

**File**: `hummingbot/connector/derivative/kalshi_perpetual/dummy.pyx` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+cdef class dummy():
+    pass
```

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_api_order_book_data_source.py` (added, +300/-0)
```diff
@@ -0,0 +1,300 @@
+import asyncio
+from datetime import datetime
+from decimal import Decimal
+from typing import TYPE_CHECKING, Any, Dict, List, Optional
+from urllib.parse import urlparse
+
+import hummingbot.connector.derivative.kalshi_perpetual.kalshi_perpetual_constants as CONSTANTS
+import hummingbot.connector.derivative.kalshi_perpetual.kalshi_perpetual_web_utils as web_utils
+from hummingbot.core.data_type.common import TradeType
+from hummingbot.core.data_type.funding_info import FundingInfo, FundingInfoUpdate
+from hummingbot.core.data_type.order_book_message import OrderBookMessage, OrderBookMessageType
+from hummingbot.core.data_type.perpetual_api_order_book_data_source import PerpetualAPIOrderBookDataSource
+from hummingbot.core.web_assistant.connections.data_types import WSJSONRequest
+from hummingbot.core.web_assistant.web_assistants_factory import WebAssistantsFactory
+from hummingbot.core.web_assistant.ws_assistant import WSAssistant
+
+if TYPE_CHECKING:
+    from hummingbot.connector.derivative.kalshi_perpetual.kalshi_perpetual_derivative import KalshiPerpetualDerivative
+
+
+class KalshiPerpetualAPIOrderBookDataSource(PerpetualAPIOrderBookDataSource):
+    """
+    Kalshi quotes margin markets per contract. Everything published to Hummingbot is converted to underlying units
+    with the connector's contract size (price / contract_size, contracts * contract_size), so BTC-USD is in USD/BTC.
+
+    Kalshi order book deltas carry the *change* at a price level, while Hummingbot diffs carry the new size, so a copy
+    of each book is kept and updated in the websocket read loop, the only place where snapshots and deltas arrive in
+    order. The same loop numbers every order book message with an id that never decreases, including across
+    reconnections and REST snapshots, because the tracker drops diffs older than the last snapshot.
+    """
+
+    def __init__(
+            self,
+            trading_pairs: List[str],
+            connector: 'KalshiPerpetualDerivative',
+            api_factory: WebAssistantsFactory,
+            domain: str = CONSTANTS.DEFAULT_DOMAIN
+    ):
+        super().__init__(trading_pairs)
+        self._connector = connector
+        self._api_factory = api_factory
+        self._domain = domain
+        self._trade_messages_queue_key = CONSTANTS.WS_TRADE_MESSAGE
+        self._diff_messages_queue_key = CONSTANTS.WS_ORDER_BOOK_DELTA_MESSAGE
+        self._snapshot_messages_queue_key = CONSTANTS.WS_ORDER_BOOK_SNAPSHOT_MESSAGE
+        self._funding_info_messages_queue_key = CONSTANTS.WS_TICKER_MESSAGE
+        self._last_request_id = 0
+        self._last_update_id = 0
+        # Per connection: channel -> subscription id, order book subscription id -> last seq, and the local books
+        # (market ticker -> side -> price -> contracts).
+        self._channel_sids: Dict[str, int] = {}
+        self._last_order_book_seq: Dict[int, int] = {}
+        self._local_books: Dict[str, Dict[str, Dict[Decimal, Decimal]]] = {}
+
+    async def get_last_traded_prices(self,
+                                     trading_pairs: List[str],
+                                     domain: Optional[str] = None) -> Dict[str, float]:
+        return await self._connector.get_last_traded_prices(trading_pairs=trading_pairs)
+
+    async def get_funding_info(self, trading_pair: str) -> FundingInfo:
+        symbol = await self._connector.exchange_symbol_associated_to_pair(trading_pair=trading_pair)
+        market_response, funding_estimate = await asyncio.gather(
+            self._connector._api_get(
+                path_url=CONSTANTS.MARKET_PATH_URL.format(ticker=symbol),
+                limit_id=CONSTANTS.MARKET_PATH_URL),
+            self._connector._api_get(
+                path_url=CONSTANTS.FUNDING_RATE_ESTIMATE_PATH_URL,
+                params={"ticker": symbol},
+                limit_id=CONSTANTS.FUNDING_RATE_ESTIMATE_PATH_URL),
+        )
+        contract_size = self._connector.get_contract_size(trading_pair)
+        return FundingInfo(
+            trading_pair=trading_pair,
+            index_price=Decimal(market_response["market"]["reference_price"]["price"]) / contract_size,
+            mark_price=Decimal(funding_estimate["mark_price"]) / contract_size,
+            next_funding_utc_timestamp=int(datetime.fromisoformat(funding_estimate["next_funding_time"]).timestamp()),
+            rate=Decimal(str(funding_estimate["funding_rate"])),
+        )
+
+    async def _request_order_book_snapshot(self, trading_pair: str) -> Dict[str, Any]:
+        symbol = await self._connector.exchange_symbol_associated_to_pair(trading_pair=trading_pair)
+        return await self._connector._api_get(
+            path_url=CONSTANTS.ORDER_BOOK_PATH_URL.format(ticker=symbol),
+            limit_id=CONSTANTS.ORDER_BOOK_PATH_URL)
+
+    async def _order_book_snapshot(self, trading_pair: str) -> OrderBookMessage:
+        snapshot_response: Dict[str, Any] = await self._request_order_boo
```

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_api_user_stream_data_source.py` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+import asyncio
+from typing import Any, Dict
+from urllib.parse import urlparse
+
+import hummingbot.connector.derivative.kalshi_perpetual.kalshi_perpetual_constants as CONSTANTS
+import hummingbot.connector.derivative.kalshi_perpetual.kalshi_perpetual_web_utils as web_utils
+from hummingbot.connector.derivative.kalshi_perpetual.kalshi_perpetual_auth import KalshiPerpetualAuth
+from hummingbot.core.data_type.user_stream_tracker_data_source import UserStreamTrackerDataSource
+from hummingbot.core.web_assistant.connections.data_types import WSJSONRequest
+from hummingbot.core.web_assistant.web_assistants_factory import WebAssistantsFactory
+from hummingbot.core.web_assistant.ws_assistant import WSAssistant
+
+
+class KalshiPerpetualAPIUserStreamDataSource(UserStreamTrackerDataSource):
+    """
+    Kalshi has no listen key: private channels use the same signed websocket handshake as the public ones.
+    Only fill and order events exist (no balance or position channel). They are queued raw, per contract, and the
+    connector converts them to underlying units.
+    """
+
+    def __init__(
+            self,
+            auth: KalshiPerpetualAuth,
+            api_factory: WebAssistantsFactory,
+            domain: str = CONSTANTS.DEFAULT_DOMAIN,
+    ):
+        super().__init__()
+        self._auth = auth
+        self._api_factory = api_factory
+        self._domain = domain
+
+    async def _get_ws_assistant(self) -> WSAssistant:
+        return await self._api_factory.get_ws_assistant()
+
+    async def _connected_websocket_assistant(self) -> WSAssistant:
+        url = web_utils.wss_url(self._domain)
+        headers = self._auth.header_for_authentication(method="GET", path=urlparse(url).path)
+        ws: WSAssistant = await self._get_ws_assistant()
+        await ws.connect(ws_url=url, ping_timeout=CONSTANTS.HEARTBEAT_TIME_INTERVAL, ws_headers=headers)
+        return ws
+
+    async def _subscribe_channels(self, websocket_assistant: WSAssistant):
+        try:
+            # Without market_tickers the private channels cover every market, so pairs added later need no update.
+            payload = {
+                "id": 1,
+                "cmd": "subscribe",
+                "params": {"channels": [CONSTANTS.WS_FILL_CHANNEL, CONSTANTS.WS_USER_ORDERS_CHANNEL]},
+            }
+            await websocket_assistant.send(WSJSONRequest(payload=payload))
+            self.logger().info("Subscribed to private fill and user order channels...")
+        except asyncio.CancelledError:
+            raise
+        except Exception:
+            self.logger().exception("Unexpected error occurred subscribing to private channels...")
+            raise
+
+    async def _process_event_message(self, event_message: Dict[str, Any], queue: asyncio.Queue):
+        if not event_message:
+            return
+        message_type = event_message.get("type")
+        if message_type in (CONSTANTS.WS_FILL_MESSAGE, CONSTANTS.WS_USER_ORDER_MESSAGE):
+            queue.put_nowait(event_message)
+        elif message_type == CONSTANTS.WS_ERROR_MESSAGE:
+            # A rejected subscription keeps the connection open without private events: raising reconnects after a
+            # pause and subscribes again.
+            raise IOError(f"Kalshi user stream error: {event_message.get('msg')}")
```

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_auth.py` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+import base64
+import re
+import textwrap
+from typing import Dict
+from urllib.parse import urlparse
+
+from cryptography.hazmat.primitives import hashes, serialization
+from cryptography.hazmat.primitives.asymmetric import padding
+from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
+
+from hummingbot.connector.time_synchronizer import TimeSynchronizer
+from hummingbot.core.web_assistant.auth import AuthBase
+from hummingbot.core.web_assistant.connections.data_types import RESTRequest, WSRequest
+
+# Matches a PEM block whatever its label (PKCS#1 "RSA PRIVATE KEY" or PKCS#8 "PRIVATE KEY") so a key whose line
+# breaks were lost when pasted into a single-line prompt can be re-wrapped.
+_PEM_BLOCK_PATTERN = re.compile(r"-----BEGIN ([A-Z0-9 ]+)-----(.*?)-----END \1-----", re.DOTALL)
+
+
+class KalshiPerpetualAuth(AuthBase):
+    """
+    Kalshi signs every authenticated REST request and the WebSocket handshake with the same three headers:
+    an RSA-PSS (SHA-256) signature over timestamp_ms + HTTP method + path, where the path excludes the query string.
+    https://docs.kalshi.com/getting_started/api_keys
+    """
+
+    def __init__(self, api_key: str, private_key: str, time_provider: TimeSynchronizer):
+        self._api_key: str = api_key
+        self._private_key: RSAPrivateKey = self._load_private_key(private_key)
+        self._time_provider: TimeSynchronizer = time_provider
+
+    async def rest_authenticate(self, request: RESTRequest) -> RESTRequest:
+        auth_headers = self.header_for_authentication(method=request.method.value, path=urlparse(request.url).path)
+        request.headers = {**request.headers, **auth_headers} if request.headers is not None else auth_headers
+        return request
+
+    async def ws_authenticate(self, request: WSRequest) -> WSRequest:
+        # Kalshi authenticates the WebSocket once, at handshake time, with header_for_authentication().
+        return request  # pass-through
+
+    def header_for_authentication(self, method: str, path: str) -> Dict[str, str]:
+        timestamp = str(int(self._time_provider.time() * 1e3))
+        return {
+            "KALSHI-ACCESS-KEY": self._api_key,
+            "KALSHI-ACCESS-SIGNATURE": self._generate_signature(f"{timestamp}{method.upper()}{path}"),
+            "KALSHI-ACCESS-TIMESTAMP": timestamp,
+        }
+
+    def _generate_signature(self, message: str) -> str:
+        signature = self._private_key.sign(
+            message.encode("utf-8"),
+            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH),
+            hashes.SHA256(),
+        )
+        return base64.b64encode(signature).decode("utf-8")
+
+    @staticmethod
+    def _load_private_key(private_key: str) -> RSAPrivateKey:
+        pem = private_key.strip().replace("\\n", "\n")
+        match = _PEM_BLOCK_PATTERN.search(pem)
+        if match is None:
+            raise ValueError("The Kalshi private key must be a PEM-encoded RSA key.")
+        label, body = match.group(1), "".join(match.group(2).split())
+        pem = f"-----BEGIN {label}-----\n" + "\n".join(textwrap.wrap(body, 64)) + f"\n-----END {label}-----\n"
+
+        key = serialization.load_pem_private_key(pem.encode("utf-8"), password=None)
+        if not isinstance(key, RSAPrivateKey):
+            raise TypeError("The Kalshi private key must be an RSA key.")
+        return key
```

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_constants.py` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+from decimal import Decimal
+from typing import List
+
+from hummingbot.core.api_throttler.data_types import LinkedLimitWeightPair, RateLimit
+
+EXCHANGE_NAME = "kalshi_perpetual"
+
+# Production only. Kalshi also has a demo environment (https://external-api.demo.kalshi.co/trade-api/v2), which is
+# not supported. The domain selects the base URL in web_utils.
+DEFAULT_DOMAIN = EXCHANGE_NAME
+
+# Margin markets are tickers like KXBTCPERP (BTC-USD), quoted, margined and settled in USD.
+MARKET_TICKER_PREFIX = "KX"
+MARKET_TICKER_SUFFIX = "PERP"
+COLLATERAL_TOKEN = "USD"
+
+# Kalshi requires a client_order_id but documents no length or charset limit; it recommends UUIDs (36 characters),
+# so generated ids stay within that length. https://docs.kalshi.com/margin-rest/orders/create-order
+CLIENT_ORDER_ID_PREFIX = "HBOT"
+MAX_ORDER_ID_LEN = 36
+
+# Base URLs include the API version prefix; path constants start with "/" and match the docs verbatim
+# (e.g. "/margin/exchange/status"). Requests are signed over the full path, "/trade-api/v2" included.
+# https://docs.kalshi.com/margin
+REST_URLS = {
+    DEFAULT_DOMAIN: "https://external-api.kalshi.com/trade-api/v2",
+}
+
+# Every channel, public ones included, needs the signed handshake (unauthenticated connections get HTTP 401).
+# https://docs.kalshi.com/margin-ws/websockets/websocket-connection
+WSS_URLS = {
+    DEFAULT_DOMAIN: "wss://external-api-margin-ws.kalshi.com/trade-api/ws/v2/margin",
+}
+# Kalshi sends a ping frame every 10 seconds and WSConnection answers it with a pong.
+# https://docs.kalshi.com/margin-ws/websockets/connection-keep-alive
+HEARTBEAT_TIME_INTERVAL = 10
+
+# Public REST endpoints
+EXCHANGE_STATUS_PATH_URL = "/margin/exchange/status"
+MARKETS_PATH_URL = "/margin/markets"
+MARKET_PATH_URL = "/margin/markets/{ticker}"
+ORDER_BOOK_PATH_URL = "/margin/markets/{ticker}/orderbook"
+FUNDING_RATE_ESTIMATE_PATH_URL = "/margin/funding_rates/estimate"
+
+# Private REST endpoints. Orders are cancelled and queried by Kalshi's order_id only (no client_order_id lookup).
+ORDERS_PATH_URL = "/margin/orders"
+ORDER_PATH_URL = "/margin/orders/{order_id}"
+FILLS_PATH_URL = "/margin/fills"
+POSITIONS_PATH_URL = "/margin/positions"
+BALANCE_PATH_URL = "/margin/balance"
+FUNDING_HISTORY_PATH_URL = "/margin/funding_history"
+FEE_TIERS_PATH_URL = "/margin/fee_tiers"
+
+# Throttler ids for paths used with more than one HTTP method
+CREATE_ORDER_LIMIT_ID = f"POST{ORDERS_PATH_URL}"
+GET_ORDER_LIMIT_ID = f"GET{ORDER_PATH_URL}"
+CANCEL_ORDER_LIMIT_ID = f"DELETE{ORDER_PATH_URL}"
+
+# Order parameters. Kalshi only takes limit orders (price is required), so market orders are sent as
+# immediate-or-cancel limit orders priced this far through the book. reduce_only is rejected on resting orders.
+TIME_IN_FORCE_GTC = "good_till_canceled"
+TIME_IN_FORCE_IOC = "immediate_or_cancel"
+SELF_TRADE_PREVENTION_TYPE = "taker_at_cross"
+MARKET_ORDER_SLIPPAGE = Decimal("0.05")
+
+# Funding is settled every 8 hours (04:00, 12:00 and 20:00 UTC); payments are polled more often than that.
+FUNDING_FEE_POLL_INTERVAL = 600
+
+# No SERVER_TIME_PATH_URL: Kalshi has no server-time endpoint and documents no tolerance window for the
+# KALSHI-ACCESS-TIMESTAMP (ms) signed header, so requests are signed with local time and never resynced.
+# https://docs.kalshi.com/getting_started/api_keys
+
+# Perps traffic draws from its own token buckets (separate from event contracts): a Read bucket for GETs and a Write
+# bucket for order placement and cancels. Budgets are the Basic tier's; every margin call costs 10 tokens except
+# GET /margin/balance: 5, or 50 with compute_available_balance=true (it scans all resting orders), which the connector
+# always passes. https://docs.kalshi.com/getting_started/rate_limits
+READ_BUCKET_LIMIT_ID = "PerpsReadBucket"
+WRITE_BUCKET_LIMIT_ID = "PerpsWriteBucket"
+READ_TOKENS_PER_SECOND = 200
+WRITE_TOKENS_PER_SECOND = 100
+DEFAULT_REQUEST_COST = 10
+BALANCE_REQUEST_COST = 50
+
+
+def _endpoint_limit(limit_id: str, bucket_id: str, bucket_tokens: int, cost: int = DEFAULT_REQUEST_COST) -> RateLimit:
+    return RateLimit(
+        limit_id=limit_id,
+        limit=bucket_tokens // cost,
+        time_interval=1,
+        linked_limits=[LinkedLimitWeightPair(bucket_id, cost)],
+    )
+
+
+RATE_LIMITS: List[RateLimit] = [
+    RateLimit(limit_id=READ_BUCKET_LIMIT_ID, limit=READ_TOKENS_PER_SECOND, time_interval=1),
+    RateLimit(limit_id=WRITE_BUCKET_LIMIT_ID, limit=WRITE_TOKENS_PER_SECOND, time_interval=1),
+    *[
+        _endpoint_limit(limit_id, READ_BUCKET_LIMIT_ID, READ_TOKENS_PER_SECOND)
+        for limit_id in (
+            EXCHANGE_STATUS_PATH_URL, MARKETS_PATH_URL, MARKET_PATH_URL, ORDER_BOOK_PATH_URL,
+            FUNDING_RATE_ESTIMATE_PATH_URL, GET_ORDER_LIMIT_ID, FILLS_PATH_URL, POSITIONS_PATH_URL,
+            FUNDING_HISTORY_PATH_URL, FEE_TIERS_PATH_URL,
+        )
+    ],
+    _endpoint_limit(BALANCE_PATH_URL, READ_BUCKET_LIMIT_ID, READ
```

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_derivative.py` (added, +736/-0)
```diff
@@ -0,0 +1,736 @@
+import asyncio
+import time
+from copy import copy
+from datetime import datetime, timedelta, timezone
+from decimal import Decimal
+from typing import Any, AsyncIterable, Dict, List, Optional, Set, Tuple
+
+from bidict import bidict
+
+from hummingbot.connector.constants import s_decimal_NaN
+from hummingbot.connector.derivative.kalshi_perpetual import (
+    kalshi_perpetual_constants as CONSTANTS,
+    kalshi_perpetual_web_utils as web_utils,
+)
+from hummingbot.connector.derivative.kalshi_perpetual.kalshi_perpetual_api_order_book_data_source import (
+    KalshiPerpetualAPIOrderBookDataSource,
+)
+from hummingbot.connector.derivative.kalshi_perpetual.kalshi_perpetual_api_user_stream_data_source import (
+    KalshiPerpetualAPIUserStreamDataSource,
+)
+from hummingbot.connector.derivative.kalshi_perpetual.kalshi_perpetual_auth import KalshiPerpetualAuth
+from hummingbot.connector.derivative.perpetual_budget_checker import PerpetualBudgetChecker
+from hummingbot.connector.derivative.position import Position
+from hummingbot.connector.perpetual_derivative_py_base import PerpetualDerivativePyBase
+from hummingbot.connector.trading_rule import TradingRule
+from hummingbot.connector.utils import combine_to_hb_trading_pair
+from hummingbot.core.api_throttler.data_types import RateLimit
+from hummingbot.core.data_type.common import OrderType, PositionAction, PositionMode, PositionSide, TradeType
+from hummingbot.core.data_type.in_flight_order import InFlightOrder, OrderState, OrderUpdate, TradeUpdate
+from hummingbot.core.data_type.order_book_tracker_data_source import OrderBookTrackerDataSource
+from hummingbot.core.data_type.order_candidate import OrderCandidate, PerpetualOrderCandidate
+from hummingbot.core.data_type.trade_fee import TokenAmount, TradeFeeBase
+from hummingbot.core.data_type.user_stream_tracker_data_source import UserStreamTrackerDataSource
+from hummingbot.core.utils.async_utils import safe_ensure_future
+from hummingbot.core.utils.estimate_fee import build_trade_fee
+from hummingbot.core.web_assistant.web_assistants_factory import WebAssistantsFactory
+
+
+class KalshiPerpetualBudgetChecker(PerpetualBudgetChecker):
+    """
+    Executors reserve an order's margin with their own configured leverage, which Kalshi doesn't use: its margin follows
+    from its own rates. Each order's leverage is capped at Kalshi's for the order's side and notional, so orders Kalshi
+    would reject for margin aren't approved.
+    """
+
+    def populate_collateral_entries(self, order_candidate: OrderCandidate) -> OrderCandidate:
+        if isinstance(order_candidate, PerpetualOrderCandidate) and not order_candidate.position_close:
+            notional = order_candidate.amount * order_candidate.price
+            max_leverage = self._exchange.max_leverage(
+                order_candidate.trading_pair, order_candidate.order_side,
+                notional if notional.is_finite() else Decimal("0"))
+            if max_leverage is not None and order_candidate.leverage > max_leverage:
+                order_candidate = copy(order_candidate)
+                order_candidate.leverage = max_leverage
+        return super().populate_collateral_entries(order_candidate)
+
+
+class KalshiPerpetualDerivative(PerpetualDerivativePyBase):
+    """
+    Kalshi quotes margin markets per contract, while Hummingbot works in underlying units: prices are divided and
+    sizes multiplied by each market's contract size when read from Kalshi, and the reverse when sent to it.
+    """
+    web_utils = web_utils
+
+    SHORT_POLL_INTERVAL = 5.0
+    LONG_POLL_INTERVAL = 120.0
+    # Balance and position refreshes triggered by the user stream run at most this often: a balance request costs
+    # BALANCE_REQUEST_COST of the READ_TOKENS_PER_SECOND read budget.
+    ACCOUNT_REFRESH_MIN_INTERVAL = 1.0
+
+    def __init__(
+            self,
+            balance_asset_limit: Optional[Dict[str, Dict[str, Decimal]]] = None,
+            rate_limits_share_pct: Decimal = Decimal("100"),
+            kalshi_perpetual_api_key: str = None,
+            kalshi_perpetual_private_key: str = None,
+            trading_pairs: Optional[List[str]] = None,
+            trading_required: bool = True,
+            domain: str = CONSTANTS.DEFAULT_DOMAIN,
+    ):
+        self.kalshi_perpetual_api_key = kalshi_perpetual_api_key
+        self.kalshi_perpetual_private_key = kalshi_perpetual_private_key
+        self._trading_required = trading_required
+        self._trading_pairs = trading_pairs
+        self._domain = domain
+        self._contract_sizes: Dict[str, Decimal] = {}
+        self._tick_sizes: Dict[str, Decimal] = {}
+        # trading pair -> side -> (notional in USD, leverage) tiers, in increasing notional
+        self._leverage_estimates: Dict[str, Dict[TradeType, List[Tuple[Decimal, Decimal]]]] = {}
+        # Margin totals of the last balance response (initial_margin, maintenance_margin, resting_orders_margin)
+      
```

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_utils.py` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+from decimal import Decimal
+
+from pydantic import Field, SecretStr
+
+from hummingbot.client.config.config_data_types import BaseConnectorConfigMap
+from hummingbot.core.data_type.trade_fee import TradeFeeSchema
+
+# Base tier ($0 30-day volume): 5 bps maker, 12 bps taker, charged on notional in USD. Higher tiers are cheaper.
+# https://docs.kalshi.com/margin-rest/fees/get-fee-tier-rates
+# https://help.kalshi.com/en/articles/16071417-perps-fees-explained
+DEFAULT_FEES = TradeFeeSchema(
+    # Every fee is charged in USD, the collateral, whether the fill opens or closes a position.
+    percent_fee_token="USD",
+    maker_percent_fee_decimal=Decimal("0.0005"),
+    taker_percent_fee_decimal=Decimal("0.0012"),
+    # Paid from the USD collateral, so it adds to the cost instead of being deducted from what is received
+    # (TradeFeeSchema requires this whenever percent_fee_token is set).
+    buy_percent_fee_deducted_from_returns=False,
+)
+
+CENTRALIZED = True
+
+# Kalshi margin tickers look like KXBTCPERP and are quoted in USD.
+EXAMPLE_PAIR = "BTC-USD"
+
+
+class KalshiPerpetualConfigMap(BaseConnectorConfigMap):
+    connector: str = "kalshi_perpetual"
+    kalshi_perpetual_api_key: SecretStr = Field(
+        default=...,
+        json_schema_extra={
+            "prompt": "Enter your Kalshi Perpetual API key ID",
+            "is_secure": True, "is_connect_key": True, "prompt_on_new": True}
+    )
+    kalshi_perpetual_private_key: SecretStr = Field(
+        default=...,
+        json_schema_extra={
+            "prompt": "Enter your Kalshi Perpetual RSA private key (PEM)",
+            "is_secure": True, "is_connect_key": True, "prompt_on_new": True}
+    )
+
+
+KEYS = KalshiPerpetualConfigMap.model_construct()
```

---

### Incident Patch 6: `342556fb` (2026-09-15)
**Commit Message**: (fix) fetch kalshi_perpetual REST fills once per polling cycle

The fills endpoint can't filter by order, so the base class downloaded the same fills once per tracked order, and
during a network outage logged a failure with its full traceback for each of them. Fetch the fills of all orders with
a single request and log one short warning when it fails; missed fills are recovered on the next poll.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_derivative.py` (modified, +27/-4)
```diff
@@ -386,17 +386,40 @@ async def _request_order_status(self, tracked_order: InFlightOrder) -> OrderUpda
             exchange_order_id=str(order["order_id"]),
         )
 
+    async def _update_orders_fills(self, orders: List[InFlightOrder]):
+        """
+        The fills endpoint can't filter by order, so the base class's request per order downloads the same fills once
+        for each tracked order, and during a network outage logs a failure with its traceback for each of them. The
+        fills of all the orders are fetched with a single request instead.
+        """
+        # Orders without an exchange order id were never created (e.g. rejected), or their creation request hasn't
+        # returned: there are no fills to fetch, and waiting for the id would hold up the status polling loop.
+        orders = [order for order in orders if order.exchange_order_id is not None]
+        if not orders:
+            return
+        try:
+            fills = await self._request_fills(since=min(order.creation_timestamp for order in orders))
+        except asyncio.CancelledError:
+            raise
+        except Exception as request_error:
+            # Missed fills are fetched again on the next poll, as fills are requested since the orders' creation.
+            self.logger().warning(f"Failed to fetch trade updates for {len(orders)} orders. Error: {request_error}")
+            return
+        for order in orders:
+            for trade_update in self._trade_updates_from_fills(order=order, fills=fills):
+                self._order_tracker.process_trade_update(trade_update)
+
     async def _all_trade_updates_for_order(self, order: InFlightOrder) -> List[TradeUpdate]:
         """
         A fill has the same id over REST (fill_id) and the websocket (trade_id), as checked against live fills, so the
         order tracker drops the fills the user stream already delivered and only the missing ones are added.
         """
         if order.exchange_order_id is None:
-            # Never created (e.g. rejected), or its creation request hasn't returned: there are no fills to fetch, and
-            # waiting for the id would hold up the status polling loop for GET_EX_ORDER_ID_TIMEOUT per order.
             return []
-        fills = [fill for fill in await self._request_fills(since=order.creation_timestamp)
-                 if fill["order_id"] == order.exchange_order_id]
+        return self._trade_updates_from_fills(order=order, fills=await self._request_fills(since=order.creation_timestamp))
+
+    def _trade_updates_from_fills(self, order: InFlightOrder, fills: List[Dict[str, Any]]) -> List[TradeUpdate]:
+        fills = [fill for fill in fills if fill["order_id"] == order.exchange_order_id]
         fills.sort(key=lambda fill: self._parse_timestamp(fill["created_time"]))
         return [
             self._trade_update(
```

**File**: `test/hummingbot/connector/derivative/kalshi_perpetual/test_kalshi_perpetual_derivative.py` (modified, +47/-0)
```diff
@@ -7,6 +7,7 @@
 from typing import Any, Callable, Dict, List, Optional, Tuple
 from unittest.mock import AsyncMock, MagicMock, patch
 
+import aiohttp
 from aioresponses import aioresponses
 from aioresponses.core import RequestCall
 from cryptography.hazmat.primitives import serialization
@@ -922,6 +923,52 @@ def test_rest_fills_follow_the_pagination_cursor(self, mock_api):
         self.assertEqual({"min_ts": NOW - 100, "limit": 1000}, requests[0].kwargs["params"])
         self.assertEqual({"min_ts": NOW - 100, "limit": 1000, "cursor": "page-2"}, requests[1].kwargs["params"])
 
+    @aioresponses()
+    def test_rest_fills_of_all_orders_are_fetched_with_a_single_request(self, mock_api):
+        first_order = self._track_order_for_rest_fills()
+        self.exchange.start_tracking_order(
+            order_id="12", exchange_order_id="22", trading_pair=self.trading_pair, order_type=OrderType.LIMIT,
+            trade_type=TradeType.SELL, price=Decimal("10000"), amount=Decimal("1"),
+            position_action=PositionAction.OPEN)
+        self.exchange.start_tracking_order(
+            order_id="13", exchange_order_id=None, trading_pair=self.trading_pair, order_type=OrderType.LIMIT,
+            trade_type=TradeType.BUY, price=Decimal("10000"), amount=Decimal("1"),
+            position_action=PositionAction.OPEN)
+        second_order = self.exchange.in_flight_orders["12"]
+        pending_order = self.exchange.in_flight_orders["13"]
+        fills = [self._fill(first_order, "fill-1", Decimal("10000"), Decimal("0.4"), created_time=NOW - 60),
+                 self._fill(second_order, "fill-2", Decimal("10000"), Decimal("0.6"), created_time=NOW - 30)]
+        mock_api.get(self.fills_url, body=json.dumps({"fills": fills, "cursor": ""}))
+
+        self.async_run_with_timeout(self.exchange._update_orders_fills([first_order, second_order, pending_order]))
+
+        self.assertEqual({"fill-1"}, set(first_order.order_fills))
+        self.assertEqual({"fill-2"}, set(second_order.order_fills))
+        requests = self._all_executed_requests(mock_api, self.fills_url)
+        self.assertEqual(1, len(requests))
+        self.assertEqual({"min_ts": NOW - 100, "limit": 1000}, requests[0].kwargs["params"])
+
+    @aioresponses()
+    def test_rest_fills_network_error_logs_once_and_the_next_poll_recovers_the_fills(self, mock_api):
+        order = self._track_order_for_rest_fills()
+        error = aiohttp.ClientConnectionError("Cannot connect to host external-api.kalshi.com:443 ssl:default")
+        mock_api.get(self.fills_url, exception=error)
+        fills = [self._fill(order, "fill-1", Decimal("10000"), Decimal("0.4"), created_time=NOW - 60)]
+        mock_api.get(self.fills_url, body=json.dumps({"fills": fills, "cursor": ""}))
+
+        self.async_run_with_timeout(self.exchange._update_orders_fills([order]))
+
+        failures = [record for record in self.log_records
+                    if record.getMessage().startswith("Failed to fetch trade updates")]
+        self.assertEqual(1, len(failures))
+        self.assertEqual("WARNING", failures[0].levelname)
+        self.assertIsNone(failures[0].exc_info)
+        self.assertEqual({}, order.order_fills)
+
+        self.async_run_with_timeout(self.exchange._update_orders_fills([order]))
+
+        self.assertEqual({"fill-1"}, set(order.order_fills))
+
     @aioresponses()
     def test_repeated_rest_fill_triggers_only_one_event(self, mock_api):
         order = self._track_order_for_rest_fills()
```

---

### Incident Patch 7: `f6966448` (2026-09-14)
**Commit Message**: (fix) only count real not-found errors towards losing an order

Any failed status request (DNS failure, HTTP 5xx, timeout) counted towards
the lost-order limit, so a network outage marked orders still resting on the
exchange as failed. Overlapping status polling passes then removed them from
lost-order tracking, and their later fills were ignored, leaving untracked
positions (#8457).

An order now counts as not found only when the connector detects a not-found
error, or when it still has no exchange order id. A cancel request timeout no
longer counts either. hyperliquid_perpetual, bybit_perpetual, kucoin_perpetual
and foxbit, which had their own copy of the logic, follow the same rule.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01GoK66Jdz8U27QX1bB1au9L

**File**: `hummingbot/connector/derivative/bybit_perpetual/bybit_perpetual_derivative.py` (modified, +4/-1)
```diff
@@ -395,7 +395,10 @@ async def _update_order_status(self):
                     f"Error fetching status update for the order {active_order.client_order_id}: {resp}.",
                     app_warning_msg=f"Failed to fetch status update for the order {active_order.client_order_id}."
                 )
-                await self._order_tracker.process_order_not_found(active_order.client_order_id)
+                # Other errors (e.g. a network outage) say nothing about the order: losing it would stop tracking it
+                if (active_order.exchange_order_id is None
+                        or self._is_order_not_found_during_status_update_error(status_update_exception=resp)):
+                    await self._order_tracker.process_order_not_found(active_order.client_order_id)
 
         for order_status in parsed_status_responses:
             self._process_order_event_message(order_status["list"][0])
```

**File**: `hummingbot/connector/derivative/hyperliquid_perpetual/hyperliquid_perpetual_derivative.py` (modified, +5/-15)
```diff
@@ -817,23 +817,13 @@ async def _all_trade_updates_for_order(self, order: InFlightOrder) -> List[Trade
         pass
 
     async def _handle_update_error_for_active_order(self, order: InFlightOrder, error: Exception):
-        try:
-            raise error
-        except (asyncio.TimeoutError, KeyError):
+        if isinstance(error, KeyError):
+            # The status response has no "order": Hyperliquid answered, but doesn't know the order
             self.logger().debug(
-                f"Tracked order {order.client_order_id} does not have an exchange id. "
-                f"Attempting fetch in next polling interval."
-            )
-            await self._order_tracker.process_order_not_found(order.client_order_id)
-        except asyncio.CancelledError:
-            raise
-        except Exception as request_error:
-            self.logger().warning(
-                f"Error fetching status update for the active order {order.client_order_id}: {request_error}.",
-            )
-            self.logger().debug(
-                f"Order {order.client_order_id} not found counter: {self._order_tracker._order_not_found_records.get(order.client_order_id, 0)}")
+                f"Tracked order {order.client_order_id} was not found. Attempting fetch in next polling interval.")
             await self._order_tracker.process_order_not_found(order.client_order_id)
+        else:
+            await super()._handle_update_error_for_active_order(order=order, error=error)
 
     async def _request_order_status(self, tracked_order: InFlightOrder) -> OrderUpdate:
         client_order_id = tracked_order.client_order_id
```

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_derivative.py` (modified, +4/-21)
```diff
@@ -347,30 +347,13 @@ async def _place_order_and_process_update(self, order: InFlightOrder, **kwargs)
 
     async def _place_cancel(self, order_id: str, tracked_order: InFlightOrder):
         exchange_order_id = await tracked_order.get_exchange_order_id()
-        try:
-            await self._api_delete(
-                path_url=CONSTANTS.ORDER_PATH_URL.format(order_id=exchange_order_id),
-                is_auth_required=True,
-                limit_id=CONSTANTS.CANCEL_ORDER_LIMIT_ID)
-        except asyncio.TimeoutError as timeout_error:
-            # The base class reads a timeout as "no exchange order id yet" and counts it towards losing the order.
-            raise IOError(f"The cancel request for order {order_id} timed out.") from timeout_error
+        await self._api_delete(
+            path_url=CONSTANTS.ORDER_PATH_URL.format(order_id=exchange_order_id),
+            is_auth_required=True,
+            limit_id=CONSTANTS.CANCEL_ORDER_LIMIT_ID)
         # Cancellation is synchronous: a 200 means the remaining contracts are cancelled.
         return True
 
-    async def _handle_update_error_for_active_order(self, order: InFlightOrder, error: Exception):
-        """
-        The base class counts every failed status request towards losing the order, so a network outage of a few
-        polls fails orders still resting on Kalshi and stops tracking them, and their later fills are ignored. Only
-        Kalshi's not_found, or an order that never got its exchange order id, counts; other errors are retried.
-        """
-        if (self._is_order_not_found_during_status_update_error(status_update_exception=error)
-                or (isinstance(error, asyncio.TimeoutError) and order.exchange_order_id is None)):
-            await super()._handle_update_error_for_active_order(order=order, error=error)
-        else:
-            self.logger().warning(
-                f"Error fetching status update for the active order {order.client_order_id}: {error}.")
-
     async def _request_order_status(self, tracked_order: InFlightOrder) -> OrderUpdate:
         exchange_order_id = await tracked_order.get_exchange_order_id()
         response = await self._api_get(
```

**File**: `hummingbot/connector/derivative/kucoin_perpetual/kucoin_perpetual_derivative.py` (modified, +5/-1)
```diff
@@ -398,7 +398,11 @@ async def _update_order_status(self):
                     f"Error fetching status update for the order {active_order.client_order_id}: {resp}.",
                     app_warning_msg=f"Failed to fetch status update for the order {active_order.client_order_id}."
                 )
-                await self._order_tracker.process_order_not_found(active_order.client_order_id)
+                # Other errors (e.g. a network outage) say nothing about the order: losing it would stop tracking it
+                if (active_order.exchange_order_id is None
+                        or (isinstance(resp, Exception)
+                            and self._is_order_not_found_during_status_update_error(status_update_exception=resp))):
+                    await self._order_tracker.process_order_not_found(active_order.client_order_id)
 
         for order_status in parsed_status_responses:
             self._process_order_event_message(order_status)
```

**File**: `hummingbot/connector/exchange/foxbit/foxbit_exchange.py` (modified, +4/-1)
```diff
@@ -741,7 +741,10 @@ async def _update_order_status(self):
                     )
                     # Wait until the order not found error have repeated a few times before actually treating
                     # it as failed. See: https://github.com/CoinAlpha/hummingbot/issues/601
-                    await self._order_tracker.process_order_not_found(client_order_id)
+                    # Other errors (e.g. a network outage) say nothing about the order: losing it would stop tracking it
+                    if (tracked_order.exchange_order_id is None
+                            or self._is_order_not_found_during_status_update_error(order_update)):
+                        await self._order_tracker.process_order_not_found(client_order_id)
 
                 else:
                     # Update order execution status
```

**File**: `hummingbot/connector/exchange_py_base.py` (modified, +22/-11)
```diff
@@ -539,6 +539,10 @@ async def _execute_order_cancel(self, order: InFlightOrder) -> Optional[str]:
         except asyncio.CancelledError:
             raise
         except asyncio.TimeoutError:
+            if order.exchange_order_id is not None:
+                # The cancel request itself timed out, which says nothing about the order
+                self.logger().error(f"Failed to cancel order {order.client_order_id}", exc_info=True)
+                return None
             # some exchanges do not allow cancels with the client/user order id
             # so log a warning and wait for the creation of the order to complete
             self.logger().warning(
@@ -1004,22 +1008,29 @@ async def _update_orders_fills(self, orders: List[InFlightOrder]):
                 )
 
     async def _handle_update_error_for_active_order(self, order: InFlightOrder, error: Exception):
+        """
+        Only an order the exchange reports as not found, or one that never got its exchange order id, counts towards
+        losing it. Any other error (e.g. a network outage) says nothing about the order, and losing an order that is
+        still resting on the exchange stops tracking it, so its later fills would be missed.
+        """
         try:
             raise error
-        except asyncio.TimeoutError:
-            self.logger().debug(
-                f"Tracked order {order.client_order_id} does not have an exchange id. "
-                f"Attempting fetch in next polling interval."
-            )
-            await self._order_tracker.process_order_not_found(order.client_order_id)
         except asyncio.CancelledError:
             raise
         except Exception as request_error:
-            self.logger().warning(
-                f"Error fetching status update for the active order {order.client_order_id}: {request_error}.",
-            )
-            self.logger().debug(f"Order {order.client_order_id} not found counter: {self._order_tracker._order_not_found_records.get(order.client_order_id, 0)}")
-            await self._order_tracker.process_order_not_found(order.client_order_id)
+            if order.exchange_order_id is None:
+                self.logger().debug(
+                    f"Tracked order {order.client_order_id} does not have an exchange id. "
+                    f"Attempting fetch in next polling interval."
+                )
+            else:
+                self.logger().warning(
+                    f"Error fetching status update for the active order {order.client_order_id}: {request_error}.",
+                )
+            if (order.exchange_order_id is None
+                    or self._is_order_not_found_during_status_update_error(status_update_exception=request_error)):
+                self.logger().debug(f"Order {order.client_order_id} not found counter: {self._order_tracker._order_not_found_records.get(order.client_order_id, 0)}")
+                await self._order_tracker.process_order_not_found(order.client_order_id)
 
     async def _handle_update_error_for_lost_order(self, order: InFlightOrder, error: Exception):
         is_not_found = self._is_order_not_found_during_status_update_error(status_update_exception=error)
```

**File**: `hummingbot/connector/test_support/exchange_connector_test.py` (modified, +2/-1)
```diff
@@ -1235,7 +1235,8 @@ async def test_update_order_status_when_request_fails_marks_order_as_not_found(s
             self.assertFalse(order.is_filled)
             self.assertFalse(order.is_done)
 
-            self.assertEqual(1, self.exchange._order_tracker._order_not_found_records[order.client_order_id])
+            # A failed request (e.g. a network outage) says nothing about the order, so it doesn't count as not found
+            self.assertEqual(0, self.exchange._order_tracker._order_not_found_records[order.client_order_id])
 
         @aioresponses()
         async def test_update_order_status_when_order_has_not_changed_and_one_partial_fill(self, mock_api):
```

**File**: `test/hummingbot/connector/derivative/architect_perpetual/test_architect_perpetual_derivative.py` (modified, +2/-1)
```diff
@@ -1516,7 +1516,8 @@ async def test_update_order_status_when_request_fails_marks_order_as_not_found(s
         self.assertFalse(order.is_filled)
         self.assertFalse(order.is_done)
 
-        self.assertEqual(1, self.exchange._order_tracker._order_not_found_records[order.client_order_id])
+        # A failed request (e.g. a network outage) says nothing about the order, so it doesn't count as not found
+        self.assertEqual(0, self.exchange._order_tracker._order_not_found_records[order.client_order_id])
 
     @aioresponses()
     async def test_update_trading_rules(self, mock_api):
```

---

### Incident Patch 8: `4bbaccf9` (2026-09-14)
**Commit Message**: (fix) keep kalshi_perpetual orders tracked through network errors

The base class counted every failed status request towards losing an order,
so a DNS outage of a few polls marked orders still resting on Kalshi as failed
and stopped tracking them, and their later fills would be ignored. Only
Kalshi's not_found (or a missing exchange order id) counts now; cancel request
timeouts no longer count either.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01GoK66Jdz8U27QX1bB1au9L

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_derivative.py` (modified, +21/-4)
```diff
@@ -347,13 +347,30 @@ async def _place_order_and_process_update(self, order: InFlightOrder, **kwargs)
 
     async def _place_cancel(self, order_id: str, tracked_order: InFlightOrder):
         exchange_order_id = await tracked_order.get_exchange_order_id()
-        await self._api_delete(
-            path_url=CONSTANTS.ORDER_PATH_URL.format(order_id=exchange_order_id),
-            is_auth_required=True,
-            limit_id=CONSTANTS.CANCEL_ORDER_LIMIT_ID)
+        try:
+            await self._api_delete(
+                path_url=CONSTANTS.ORDER_PATH_URL.format(order_id=exchange_order_id),
+                is_auth_required=True,
+                limit_id=CONSTANTS.CANCEL_ORDER_LIMIT_ID)
+        except asyncio.TimeoutError as timeout_error:
+            # The base class reads a timeout as "no exchange order id yet" and counts it towards losing the order.
+            raise IOError(f"The cancel request for order {order_id} timed out.") from timeout_error
         # Cancellation is synchronous: a 200 means the remaining contracts are cancelled.
         return True
 
+    async def _handle_update_error_for_active_order(self, order: InFlightOrder, error: Exception):
+        """
+        The base class counts every failed status request towards losing the order, so a network outage of a few
+        polls fails orders still resting on Kalshi and stops tracking them, and their later fills are ignored. Only
+        Kalshi's not_found, or an order that never got its exchange order id, counts; other errors are retried.
+        """
+        if (self._is_order_not_found_during_status_update_error(status_update_exception=error)
+                or (isinstance(error, asyncio.TimeoutError) and order.exchange_order_id is None)):
+            await super()._handle_update_error_for_active_order(order=order, error=error)
+        else:
+            self.logger().warning(
+                f"Error fetching status update for the active order {order.client_order_id}: {error}.")
+
     async def _request_order_status(self, tracked_order: InFlightOrder) -> OrderUpdate:
         exchange_order_id = await tracked_order.get_exchange_order_id()
         response = await self._api_get(
```

**File**: `test/hummingbot/connector/derivative/kalshi_perpetual/test_kalshi_perpetual_derivative.py` (modified, +70/-0)
```diff
@@ -1191,6 +1191,76 @@ def test_not_found_errors_are_recognized(self):
         self.assertFalse(self.exchange._is_order_not_found_during_cancelation_error(other))
         self.assertFalse(self.exchange._is_order_not_found_during_status_update_error(other))
 
+    @aioresponses()
+    async def test_update_order_status_when_request_fails_marks_order_as_not_found(self, mock_api):
+        # Overrides the generic test: only Kalshi's not_found counts towards losing an order, not any failed request
+        order = self._track_open_order()
+        self.configure_http_error_order_status_response(order=order, mock_api=mock_api)
+
+        await self.exchange._update_orders()
+
+        self.assertTrue(order.is_open)
+        self.assertNotIn(order.client_order_id, self.exchange._order_tracker._order_not_found_records)
+        self.assertTrue(any(
+            record.levelname == "WARNING"
+            and record.getMessage().startswith(f"Error fetching status update for the active order {order.client_order_id}")
+            for record in self.log_records))
+
+    async def test_network_errors_during_status_updates_do_not_lose_the_order(self):
+        order = self._track_open_order()
+        self.exchange._request_order_status = AsyncMock(
+            side_effect=IOError("Cannot connect to host external-api.kalshi.com:443 ssl:default"))
+
+        for _ in range(self.exchange._order_tracker.lost_order_count_limit + 2):
+            await self.exchange._update_orders()
+
+        self.assertTrue(order.is_open)
+        self.assertIn(order.client_order_id, self.exchange.in_flight_orders)
+        self.assertNotIn(order.client_order_id, self.exchange._order_tracker.lost_orders)
+        self.assertEqual(0, len(self.order_failure_logger.event_log))
+
+    @aioresponses()
+    async def test_not_found_during_status_updates_loses_the_order(self, mock_api):
+        order = self._track_open_order()
+        for _ in range(self.exchange._order_tracker.lost_order_count_limit + 1):
+            self.configure_order_not_found_error_order_status_response(order=order, mock_api=mock_api)
+            await self.exchange._update_orders()
+
+        self.assertIn(order.client_order_id, self.exchange._order_tracker.lost_orders)
+        self.assertTrue(order.is_failure)
+
+    async def test_status_update_timeout_without_exchange_order_id_counts_towards_losing_the_order(self):
+        self.exchange._set_current_timestamp(NOW)
+        self.exchange.start_tracking_order(
+            order_id="11", exchange_order_id=None, trading_pair=self.trading_pair, order_type=OrderType.LIMIT,
+            trade_type=TradeType.BUY, price=Decimal("77825"), amount=Decimal("1"), position_action=PositionAction.OPEN)
+        self.exchange._request_order_status = AsyncMock(side_effect=asyncio.TimeoutError())
+
+        await self.exchange._update_orders()
+
+        self.assertEqual(1, self.exchange._order_tracker._order_not_found_records["11"])
+
+    async def test_status_update_timeout_with_exchange_order_id_is_retried(self):
+        order = self._track_open_order()
+        self.exchange._request_order_status = AsyncMock(side_effect=asyncio.TimeoutError())
+
+        await self.exchange._update_orders()
+
+        self.assertNotIn(order.client_order_id, self.exchange._order_tracker._order_not_found_records)
+
+    async def test_cancel_request_timeout_does_not_count_towards_losing_the_order(self):
+        order = self._track_open_order()
+        self.exchange._api_delete = AsyncMock(side_effect=asyncio.TimeoutError())
+
+        result = await self.exchange._execute_order_cancel(order)
+
+        self.assertIsNone(result)
+        self.assertNotIn(order.client_order_id, self.exchange._order_tracker._order_not_found_records)
+        self.assertTrue(self.is_logged("ERROR", f"Failed to cancel order {order.client_order_id}"))
+        self.assertFalse(self.is_logged(
+            "WARNING", f"Failed to cancel the order {order.client_order_id} because it does not have an exchange "
+                       f"order id yet"))
+
     # Time synchronizer: Kalshi has no server time, so the connector keeps local time and never resyncs.
 
     def test_update_time_synchronizer_successfully(self):
```

---

### Incident Patch 9: `45c93084` (2026-09-10)
**Commit Message**: (fix) reconnect kalshi_perpetual streams on websocket errors

Kalshi answers a rejected subscribe or update_subscription with an error frame and keeps the connection open without
those streams, which were only logged. Both data sources now raise on error frames, so the base loop reconnects after
its pause and resubscribes every tracked pair. IOError rather than ConnectionError, which would reconnect without
pausing.

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_api_order_book_data_source.py` (modified, +4/-1)
```diff
@@ -187,7 +187,10 @@ async def _process_message_for_unknown_channel(
         if message_type == CONSTANTS.WS_SUBSCRIBED_MESSAGE:
             self._channel_sids[event_message["msg"]["channel"]] = event_message["msg"]["sid"]
         elif message_type == CONSTANTS.WS_ERROR_MESSAGE:
-            self.logger().error(f"Error message received from the order book stream: {event_message.get('msg')}")
+            # Kalshi answers a rejected subscribe or update_subscription with an error and keeps the connection open,
+            # without those streams. Raising reconnects after a pause, and the new subscription covers every tracked
+            # pair. Not a ConnectionError, which would reconnect without pausing.
+            raise IOError(f"Kalshi order book stream error: {event_message.get('msg')}")
 
     async def _parse_order_book_snapshot_message(self, raw_message: Dict[str, Any], message_queue: asyncio.Queue):
         msg = raw_message["msg"]
```

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_api_user_stream_data_source.py` (modified, +3/-1)
```diff
@@ -62,4 +62,6 @@ async def _process_event_message(self, event_message: Dict[str, Any], queue: asy
         if message_type in (CONSTANTS.WS_FILL_MESSAGE, CONSTANTS.WS_USER_ORDER_MESSAGE):
             queue.put_nowait(event_message)
         elif message_type == CONSTANTS.WS_ERROR_MESSAGE:
-            self.logger().error(f"Error message received from the user stream: {event_message.get('msg')}")
+            # A rejected subscription keeps the connection open without private events: raising reconnects after a
+            # pause and subscribes again.
+            raise IOError(f"Kalshi user stream error: {event_message.get('msg')}")
```

**File**: `test/hummingbot/connector/derivative/kalshi_perpetual/test_kalshi_perpetual_api_order_book_data_source.py` (modified, +13/-6)
```diff
@@ -313,15 +313,22 @@ async def test_update_ids_keep_increasing_across_reconnections_and_rest_snapshot
         self.assertEqual(3, rest_snapshot.update_id)
         self.assertEqual(4, queued[self.data_source._snapshot_messages_queue_key][0]["update_id"])
 
-    async def test_process_websocket_messages_records_sids_and_logs_errors(self):
+    async def test_process_websocket_messages_records_sids(self):
+        await self._processed(self._subscribed_events())
+
+        self.assertEqual({"orderbook_delta": 1, "trade": 2, "ticker": 3}, self.data_source._channel_sids)
+
+    async def test_error_message_raises_to_reconnect_after_a_pause(self):
+        # A rejected subscription keeps the connection open without its streams
         error_event = {"id": 1, "type": "error", "msg": {"code": 9, "msg": "Authentication required"}}
 
-        await self._processed([*self._subscribed_events(), error_event])
+        with self.assertRaises(IOError) as context:
+            await self._processed([*self._subscribed_events(), error_event])
 
-        self.assertEqual({"orderbook_delta": 1, "trade": 2, "ticker": 3}, self.data_source._channel_sids)
-        self.assertTrue(self._is_logged(
-            "ERROR",
-            "Error message received from the order book stream: {'code': 9, 'msg': 'Authentication required'}"))
+        # A ConnectionError would reconnect without pausing, in a loop if the error persists
+        self.assertNotIsInstance(context.exception, ConnectionError)
+        self.assertEqual(
+            "Kalshi order book stream error: {'code': 9, 'msg': 'Authentication required'}", str(context.exception))
 
     # WEBSOCKET — listen_for_trades
 
```

**File**: `test/hummingbot/connector/derivative/kalshi_perpetual/test_kalshi_perpetual_api_user_stream_data_source.py` (modified, +8/-5)
```diff
@@ -143,18 +143,21 @@ async def test_listen_for_user_stream_does_not_queue_empty_payload(self, ws_conn
         self.assertEqual(0, msg_queue.qsize())
 
     @patch("aiohttp.ClientSession.ws_connect", new_callable=AsyncMock)
-    async def test_listen_for_user_stream_logs_error_messages_without_queueing_them(self, ws_connect_mock):
+    async def test_listen_for_user_stream_reconnects_after_an_error_message(self, ws_connect_mock):
+        # A rejected subscription keeps the connection open without private events
         ws_connect_mock.return_value = self.mocking_assistant.create_websocket_mock()
         error_event = {"id": 1, "type": "error", "msg": {"code": 9, "msg": "Authentication required"}}
         self.mocking_assistant.add_websocket_aiohttp_message(ws_connect_mock.return_value, json.dumps(error_event))
+        self.data_source._sleep = AsyncMock(side_effect=asyncio.CancelledError)  # the pause before reconnecting
         msg_queue = asyncio.Queue()
 
-        self.listening_task = self.local_event_loop.create_task(self.data_source.listen_for_user_stream(msg_queue))
-        await self.mocking_assistant.run_until_all_aiohttp_messages_delivered(ws_connect_mock.return_value)
+        with self.assertRaises(asyncio.CancelledError):
+            await self.data_source.listen_for_user_stream(msg_queue)
 
         self.assertEqual(0, msg_queue.qsize())
-        self.assertTrue(self._is_logged(
-            "ERROR", "Error message received from the user stream: {'code': 9, 'msg': 'Authentication required'}"))
+        self.assertTrue(
+            self._is_logged("ERROR", "Unexpected error while listening to user stream. Retrying after 5 seconds..."))
+        self.assertIsNone(self.data_source._ws_assistant)
 
     @patch("aiohttp.ClientSession.ws_connect", new_callable=AsyncMock)
     @patch("hummingbot.core.data_type.user_stream_tracker_data_source.UserStreamTrackerDataSource._sleep")
```

---

### Incident Patch 10: `74f1338e` (2026-09-10)
**Commit Message**: (fix) deduplicate kalshi_perpetual REST fills by trade id

Kalshi's websocket trade_id is the REST fill_id (checked on every fill of three live runs), so the order tracker
deduplicates the two sources itself. This replaces the amount-prefix and grace-period heuristic, which could add a fill
twice when the websocket missed an earlier fill of a different size but delivered a later one.

**File**: `hummingbot/connector/derivative/kalshi_perpetual/kalshi_perpetual_derivative.py` (modified, +8/-20)
```diff
@@ -64,8 +64,6 @@ class KalshiPerpetualDerivative(PerpetualDerivativePyBase):
 
     SHORT_POLL_INTERVAL = 5.0
     LONG_POLL_INTERVAL = 120.0
-    # REST fills younger than this are left to the websocket, the primary fill source (see _all_trade_updates_for_order)
-    REST_FILL_GRACE_PERIOD = 10.0
     # Balance and position refreshes triggered by the user stream run at most this often: a balance request costs
     # BALANCE_REQUEST_COST of the READ_TOKENS_PER_SECOND read budget.
     ACCOUNT_REFRESH_MIN_INTERVAL = 1.0
@@ -373,10 +371,8 @@ async def _request_order_status(self, tracked_order: InFlightOrder) -> OrderUpda
 
     async def _all_trade_updates_for_order(self, order: InFlightOrder) -> List[TradeUpdate]:
         """
-        The websocket is the primary fill source, and Kalshi does not document whether its fill ids (websocket
-        trade_id, REST fill_id) match, so the tracker can't deduplicate across sources. To never count a fill twice,
-        REST only contributes fills older than the grace period and beyond the amount already recorded for the order
-        (both sources report an order's fills in the same time order).
+        A fill has the same id over REST (fill_id) and the websocket (trade_id), as checked against live fills, so the
+        order tracker drops the fills the user stream already delivered and only the missing ones are added.
         """
         if order.exchange_order_id is None:
             # Never created (e.g. rejected), or its creation request hasn't returned: there are no fills to fetch, and
@@ -385,26 +381,18 @@ async def _all_trade_updates_for_order(self, order: InFlightOrder) -> List[Trade
         fills = [fill for fill in await self._request_fills(since=order.creation_timestamp)
                  if fill["order_id"] == order.exchange_order_id]
         fills.sort(key=lambda fill: self._parse_timestamp(fill["created_time"]))
-
-        trade_updates = []
-        cumulative_amount = Decimal("0")
-        for fill in fills:
-            cumulative_amount += self._from_exchange_count(order.trading_pair, fill["count"])
-            if cumulative_amount <= order.executed_amount_base:
-                continue
-            fill_timestamp = self._parse_timestamp(fill["created_time"])
-            if self.current_timestamp - fill_timestamp < self.REST_FILL_GRACE_PERIOD:
-                break
-            trade_updates.append(self._trade_update(
+        return [
+            self._trade_update(
                 order=order,
                 trade_id=fill["fill_id"],
                 exchange_order_id=fill["order_id"],
-                fill_timestamp=fill_timestamp,
+                fill_timestamp=self._parse_timestamp(fill["created_time"]),
                 price=fill["price"],
                 count=fill["count"],
                 fee_paid=fill["fees"],
-            ))
-        return trade_updates
+            )
+            for fill in fills
+        ]
 
     async def _request_fills(self, since: float) -> List[Dict[str, Any]]:
         # The fills endpoint can't filter by order or market, only by time; it is paginated with a cursor.
```

**File**: `test/hummingbot/connector/derivative/kalshi_perpetual/test_kalshi_perpetual_derivative.py` (modified, +10/-23)
```diff
@@ -282,8 +282,6 @@ def create_exchange_instance(self):
         # The generic setUp builds the symbol map directly, so the contract specs it would load are seeded here.
         exchange._contract_sizes[self.trading_pair] = Decimal("1")
         exchange._tick_sizes[self.trading_pair] = Decimal("0.0001")
-        # The generic fill mocks are timestamped at order creation; the grace period has its own tests below.
-        exchange.REST_FILL_GRACE_PERIOD = 0
         exchange.ACCOUNT_REFRESH_MIN_INTERVAL = 0
         # Fills refresh positions and balances, which has its own tests below; elsewhere the refresh would send
         # requests no test mocks.
@@ -888,37 +886,26 @@ def _track_order_for_rest_fills(self) -> InFlightOrder:
             trade_type=TradeType.BUY, price=Decimal("10000"), amount=Decimal("1"),
             position_action=PositionAction.OPEN)
         self.exchange._set_current_timestamp(NOW)
-        self.exchange.REST_FILL_GRACE_PERIOD = KalshiPerpetualDerivative.REST_FILL_GRACE_PERIOD
         return self.exchange.in_flight_orders["11"]
 
     @aioresponses()
-    def test_rest_fills_only_add_the_amount_the_websocket_did_not_report(self, mock_api):
+    def test_rest_fills_add_only_the_fills_the_websocket_missed(self, mock_api):
         order = self._track_order_for_rest_fills()
-        # The websocket already delivered the first fill, under its own trade id
+        # The websocket missed the first fill and delivered the second, whose trade_id is the REST fill_id
         self.exchange._process_fill_event(
-            self._fill_event(order, "ws-trade-1", Decimal("10000"), Decimal("0.4"), ts=NOW - 60)["msg"])
-        other_order_fill = {**self._fill(order, "rest-other", Decimal("10000"), Decimal("1"), created_time=NOW - 50),
+            self._fill_event(order, "fill-2", Decimal("10000"), Decimal("0.6"), ts=NOW - 30)["msg"])
+        other_order_fill = {**self._fill(order, "fill-other", Decimal("10000"), Decimal("1"), created_time=NOW - 50),
                             "order_id": "99"}
-        fills = [self._fill(order, "rest-2", Decimal("10000"), Decimal("0.6"), created_time=NOW - 30),
+        fills = [self._fill(order, "fill-2", Decimal("10000"), Decimal("0.6"), created_time=NOW - 30),
                  other_order_fill,
-                 self._fill(order, "rest-1", Decimal("10000"), Decimal("0.4"), created_time=NOW - 60)]
+                 self._fill(order, "fill-1", Decimal("10000"), Decimal("0.4"), created_time=NOW - 60)]
         mock_api.get(self.fills_url, body=json.dumps({"fills": fills, "cursor": ""}))
 
-        trade_updates = self.async_run_with_timeout(self.exchange._all_trade_updates_for_order(order))
-
-        self.assertEqual(["rest-2"], [trade_update.trade_id for trade_update in trade_updates])
-        self.assertEqual(Decimal("0.6"), trade_updates[0].fill_base_amount)
-
-    @aioresponses()
-    def test_rest_fills_within_the_grace_period_are_left_to_the_websocket(self, mock_api):
-        order = self._track_order_for_rest_fills()
-        fills = [self._fill(order, "rest-1", Decimal("10000"), Decimal("0.4"), created_time=NOW - 60),
-                 self._fill(order, "rest-2", Decimal("10000"), Decimal("0.6"), created_time=NOW - 5)]
-        mock_api.get(self.fills_url, body=json.dumps({"fills": fills, "cursor": ""}))
-
-        trade_updates = self.async_run_with_timeout(self.exchange._all_trade_updates_for_order(order))
+        self.async_run_with_timeout(self.exchange._update_orders_fills([order]))
 
-        self.assertEqual(["rest-1"], [trade_update.trade_id for trade_update in trade_updates])
+        self.assertEqual({"fill-1", "fill-2"}, set(order.order_fills))
+        self.assertEqual(Decimal("1"), order.executed_amount_base)
+        self.assertEqual(2, len(self.order_filled_logger.event_log))
 
     @aioresponses()
     def test_rest_fills_follow_the_pagination_cursor(self, mock_api):
```

---

### Incident Patch 11: `6b6f8ff7` (2026-09-09)
**Commit Message**: Merge branch 'development' into fix/xrpl-custom-market-balances

**File**: `hummingbot/strategy_v2/backtesting/backtesting_engine_base.py` (modified, +100/-20)
```diff
@@ -1,8 +1,9 @@
 import importlib
 import inspect
 import os
+from collections import deque
 from decimal import Decimal
-from typing import Dict, List, Optional, Type, Union
+from typing import Deque, Dict, List, Optional, Type, Union
 
 import numpy as np
 import pandas as pd
@@ -153,14 +154,29 @@ def get_position_summary(self, mid_price: Decimal) -> PositionSummary:
 class BacktestingEngineBase:
     __controller_class_cache = LazyDict[str, Type[ControllerBase]]()
 
-    def __init__(self):
+    #: Seconds of terminated-executor history exposed to the controller on every tick. The full
+    #: ledger is always kept internally for the results; this only bounds the controller's view so
+    #: a run stays linear in the number of executors instead of quadratic. One hour comfortably
+    #: covers the cooldown/refresh windows the shipped controller bases look back over (the market
+    #: making base cools down for 15s by default, the directional one for 300s).
+    DEFAULT_TERMINATED_EXECUTORS_WINDOW: float = 60 * 60
+
+    def __init__(self, terminated_executors_window: Optional[float] = DEFAULT_TERMINATED_EXECUTORS_WINDOW):
+        """
+        Args:
+            terminated_executors_window: How far back (in seconds of simulated time) terminated
+                executors stay visible in ``controller.executors_info``. Pass ``None`` to hand the
+                controller the full history instead, which is quadratic in the number of executors.
+        """
         self.controller = None
         self.backtesting_resolution = None
         self.backtesting_data_provider = BacktestingDataProvider(connectors={})
         self.position_executor_simulator = PositionExecutorSimulator()
         self.dca_executor_simulator = DCAExecutorSimulator()
         self.grid_executor_simulator = GridExecutorSimulator()
         self.order_executor_simulator = OrderExecutorSimulator()
+        self.terminated_executors_window = terminated_executors_window
+        self._reset_simulation_state()
 
     @classmethod
     def load_controller_config(cls,
@@ -261,15 +277,7 @@ async def simulate_execution(self, trade_cost: float) -> list:
             List[ExecutorInfo]: List of executor information objects detailing the simulation results.
         """
         processed_features = self.prepare_market_data()
-        self.active_executor_simulations: List[ExecutorSimulation] = []
-        self.stopped_executors_info: List[ExecutorInfo] = []
-        self.active_position_holds: Dict[str, BacktestPositionHold] = {}
-        self._position_hold_processed_ids: set = set()
-        self._pending_position_hold_executors: List[ExecutorInfo] = []
-        self.position_held_timeseries: List[Dict] = []
-        self.pnl_timeseries: List[Dict] = []
-        self._executor_realized_pnl = 0.0
-        self._cumulative_volume = 0.0
+        self._reset_simulation_state()
         last_index = processed_features.index[-1]
         for i, row in processed_features.iterrows():
             await self.update_state(row)
@@ -282,9 +290,76 @@ async def simulate_execution(self, trade_cost: float) -> list:
                 elif isinstance(action, StopExecutorAction):
                     self.handle_stop_action(action, row["timestamp"])
 
+        # Closing tick: everything determine_executor_actions() did on the last row happened
+        # after that tick's update_executors_info(). Give the engine one last look so those
+        # executors are terminated, booked into the running totals and — when they keep their
+        # position — routed to the position-hold ledger, exactly as on any other tick. Without
+        # it a maker order created and filled on the last row reached the ledger as a
+        # POSITION_HOLD whose exposure no BacktestPositionHold ever accounted for, so its fill
+        # was dropped from both the executor PnL and the position summaries.
+        self.update_executors_info(last_index)
         # Final flush: convert any last-tick POSITION_HOLD executors into position holds
         self._update_positions_from_stopped_executors()
-        return self.controller.executors_info
+        return self.collect_executors_ledger(last_index)
+
+    def _reset_simulation_state(self):
+        """Reset every accumulator a single backtesting run writes to."""
+        self.active_executor_simulations: List[ExecutorSimulation] = []
+        self.stopped_executors_info: List[ExecutorInfo] = []
+        self.active_position_holds: Dict[str, BacktestPositionHold] = {}
+        self._position_hold_processed_ids: set = set()
+        self._pending_position_hold_executors: List[ExecutorInfo] = []
+        self.position_held_timeseries: List[Dict] = []
+        self.pnl_timeseries: List[Dict] = []
+        self._executor_realized_pnl = 0.0
+        self._cumulative_volume = 0.0
+        # Time-windowed view of terminated executors handed to the controller: the oldest ones
+        # fall out of the left end. ``None`` means the controller ge
```

**File**: `test/hummingbot/strategy_v2/backtesting/test_backtesting_executors_view.py` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+"""The controller's view of the executors must stay bounded while the run ledger stays complete.
+
+Handing the controller every executor ever created makes a run quadratic in the number of
+executors (each tick copies a list that only grows), so the engine exposes a time-bounded
+window of terminated executors instead. The ledger that ``simulate_execution`` returns — the
+one the results are summarized from — must keep every single executor regardless.
+"""
+import unittest
+from decimal import Decimal
+from unittest.mock import MagicMock
+
+from hummingbot.core.data_type.common import TradeType
+from hummingbot.strategy_v2.backtesting.backtesting_engine_base import BacktestingEngineBase
+from hummingbot.strategy_v2.executors.position_executor.data_types import PositionExecutorConfig, TripleBarrierConfig
+from hummingbot.strategy_v2.models.base import RunnableStatus
+from hummingbot.strategy_v2.models.executors import CloseType
+from hummingbot.strategy_v2.models.executors_info import ExecutorInfo
+
+
+class _FakeSimulation:
+    """Minimal stand-in for an ExecutorSimulation that terminates at a fixed timestamp."""
+
+    def __init__(self, executor_id: str, start: float, close_timestamp: float,
+                 close_type: CloseType = CloseType.TAKE_PROFIT):
+        self.config = PositionExecutorConfig(
+            id=executor_id, timestamp=start,
+            connector_name="binance", trading_pair="ETH-USDT",
+            side=TradeType.BUY, amount=Decimal("1"),
+            triple_barrier_config=TripleBarrierConfig(take_profit=Decimal("0.01")),
+        )
+        self.close_timestamp = close_timestamp
+        self.close_type = close_type
+
+    def get_executor_info_at_timestamp(self, timestamp: float) -> ExecutorInfo:
+        is_done = timestamp >= self.close_timestamp
+        return ExecutorInfo(
+            id=self.config.id, timestamp=self.config.timestamp, type="position_executor",
+            status=RunnableStatus.TERMINATED if is_done else RunnableStatus.RUNNING,
+            config=self.config,
+            net_pnl_pct=Decimal("0"), net_pnl_quote=Decimal("1"),
+            cum_fees_quote=Decimal("0"), filled_amount_quote=Decimal("100"),
+            is_active=not is_done, is_trading=not is_done,
+            custom_info={"side": TradeType.BUY, "close_price": 1, "level_id": "buy_0"},
+            close_timestamp=self.close_timestamp if is_done else None,
+            close_type=self.close_type if is_done else None,
+        )
+
+
+class TestControllerExecutorsView(unittest.TestCase):
+    WINDOW = 600.0  # seconds of terminated history the controller gets to see
+
+    def _engine(self, window=WINDOW):
+        engine = BacktestingEngineBase(terminated_executors_window=window)
+        engine.controller = MagicMock()
+        return engine
+
+    @staticmethod
+    def _run_ticks(engine, n_ticks: int, close_type: CloseType = CloseType.TAKE_PROFIT,
+                   tick_seconds: float = 60.0):
+        """Create one executor per tick that terminates on the next tick."""
+        max_view_len = 0
+        for tick in range(n_ticks):
+            now = 1000.0 + tick * tick_seconds
+            engine.active_executor_simulations.append(
+                _FakeSimulation(f"executor_{tick}", start=now,
+                                close_timestamp=now + tick_seconds, close_type=close_type))
+            engine.update_executors_info(timestamp=now)
+            engine._update_positions_from_stopped_executors()
+            max_view_len = max(max_view_len, len(engine.controller.executors_info))
+        return max_view_len
+
+    def test_controller_view_is_bounded_while_ledger_stays_complete(self):
+        engine = self._engine()
+        n_ticks = 200
+
+        max_view_len = self._run_ticks(engine, n_ticks)
+
+        # One executor terminates per tick, so the whole run creates n_ticks - 1 terminated ones.
+        self.assertEqual(len(engine.stopped_executors_info), n_ticks - 1)
+        # The ledger returned to the caller keeps every one of them, plus the still-running one.
+        last_timestamp = 1000.0 + (n_ticks - 1) * 60.0
+        self.assertEqual(len(engine.collect_executors_ledger(last_timestamp)), n_ticks)
+        # The controller only ever sees the active executor plus the last WINDOW seconds of them
+        # (a 600s window at one termination every 60s covers 11 of them, both ends included).
+        self.assertLessEqual(max_view_len, 1 + self.WINDOW / 60 + 1)
+        self.assertLess(max_view_len, n_ticks)
+
+    def test_view_keeps_the_whole_window_and_nothing_older(self):
+        engine = self._engine()
+
+        self._run_ticks(engine, 200)
+
+        view = engine.controller.executors_info
+        terminated = [executor for executor in view if executor.is_done]
+        # Every terminated executor still inside the window is there, in termination order.
+        self.assertEqual(len(terminated), self.WINDOW / 60 + 1)
+        last_timestamp = 10
```

**File**: `test/hummingbot/strategy_v2/backtesting/test_backtesting_final_tick_ledger.py` (added, +217/-0)
```diff
@@ -0,0 +1,217 @@
+"""What the controller does on the closing tick has to reach the results.
+
+``update_executors_info()`` runs at the *start* of a tick, so anything
+``determine_executor_actions()`` does on the last one happens after the engine's last look at
+the executors. The ledger returned by ``simulate_execution()`` is therefore rebuilt from the
+live simulations rather than replayed from that stale look.
+"""
+import unittest
+from decimal import Decimal
+from unittest.mock import MagicMock
+
+import pandas as pd
+
+from hummingbot.core.data_type.common import TradeType
+from hummingbot.strategy_v2.backtesting.backtesting_engine_base import BacktestingEngineBase
+from hummingbot.strategy_v2.backtesting.executor_simulator_base import ExecutorSimulation
+from hummingbot.strategy_v2.executors.order_executor.data_types import ExecutionStrategy, OrderExecutorConfig
+from hummingbot.strategy_v2.executors.position_executor.data_types import PositionExecutorConfig, TripleBarrierConfig
+from hummingbot.strategy_v2.models.base import RunnableStatus
+from hummingbot.strategy_v2.models.executor_actions import CreateExecutorAction, StopExecutorAction
+from hummingbot.strategy_v2.models.executors import CloseType
+
+TICKS = [0.0, 60.0, 120.0]
+
+
+def _config(executor_id: str, timestamp: float) -> PositionExecutorConfig:
+    return PositionExecutorConfig(
+        id=executor_id, timestamp=timestamp,
+        connector_name="binance", trading_pair="ETH-USDT",
+        side=TradeType.BUY, amount=Decimal("1"), entry_price=Decimal("100"),
+        triple_barrier_config=TripleBarrierConfig(take_profit=Decimal("0.01")),
+        level_id="buy_0",
+    )
+
+
+def _simulation(config: PositionExecutorConfig, timestamps, close_type=CloseType.TIME_LIMIT,
+                net_pnl_quote=Decimal("3")) -> ExecutorSimulation:
+    df = pd.DataFrame({
+        "net_pnl_pct": [0.03] * len(timestamps),
+        "net_pnl_quote": [float(net_pnl_quote)] * len(timestamps),
+        "cum_fees_quote": [0.1] * len(timestamps),
+        "filled_amount_quote": [100.0] * len(timestamps),
+        "close": [100.0] * len(timestamps),
+    }, index=pd.Index(timestamps, name="timestamp"))
+    return ExecutorSimulation(config=config, executor_simulation=df, close_type=close_type)
+
+
+def _order_config(executor_id: str, timestamp: float) -> OrderExecutorConfig:
+    return OrderExecutorConfig(
+        id=executor_id, timestamp=timestamp,
+        connector_name="binance", trading_pair="ETH-USDT",
+        side=TradeType.BUY, amount=Decimal("1"), price=Decimal("100"),
+        execution_strategy=ExecutionStrategy.MARKET,
+        level_id="buy_0",
+    )
+
+
+def _hold_simulation(config: OrderExecutorConfig, timestamps, entry_price=100.0) -> ExecutorSimulation:
+    """A maker order that fills and keeps the position: terminates as POSITION_HOLD."""
+    df = pd.DataFrame({
+        "net_pnl_pct": [0.0] * len(timestamps),
+        "net_pnl_quote": [0.0] * len(timestamps),
+        "cum_fees_quote": [0.0] * len(timestamps),
+        "filled_amount_quote": [entry_price] * len(timestamps),
+        "current_position_average_price": [entry_price] * len(timestamps),
+        "close": [entry_price] * len(timestamps),
+    }, index=pd.Index(timestamps, name="timestamp"))
+    return ExecutorSimulation(config=config, executor_simulation=df, close_type=CloseType.POSITION_HOLD)
+
+
+def _features() -> pd.DataFrame:
+    return pd.DataFrame({
+        "timestamp": TICKS,
+        "close_bt": [100.0] * len(TICKS),
+    }, index=pd.Index(TICKS, name="timestamp"))
+
+
+class _ScriptedController:
+    """Controller that emits a scripted list of actions per tick."""
+
+    def __init__(self, actions_by_tick):
+        self._actions_by_tick = actions_by_tick
+        self.config = MagicMock(connector_name="binance", trading_pair="ETH-USDT", id="test")
+        self.market_data_provider = MagicMock()
+        self.processed_data = {}
+        self.executors_info = []
+        self.positions_held = []
+
+    def determine_executor_actions(self):
+        return self._actions_by_tick.get(self.processed_data["timestamp"], [])
+
+
+class TestFinalTickLedger(unittest.IsolatedAsyncioTestCase):
+
+    @staticmethod
+    def _engine(controller, simulations_by_id):
+        engine = BacktestingEngineBase()
+        engine.controller = controller
+        engine.prepare_market_data = MagicMock(return_value=_features())
+        engine.simulate_executor = MagicMock(
+            side_effect=lambda config, df, trade_cost: simulations_by_id[config.id])
+        return engine
+
+    async def test_executor_created_on_the_final_tick_reaches_the_ledger(self):
+        """The last tick's CreateExecutorAction lands after update_executors_info() has run."""
+        early, late = _config("early", 60.0), _config("late", 120.0)
+        controller = _ScriptedController({
+            60.0: [CreateExecutorAction(controller_id="test", executor_config=early)],
+            120.0: [Cre
```

---

### Incident Patch 12: `1067844c` (2026-09-05)
**Commit Message**: Merge pull request #8447 from hummingbot/fix/backtesting-executor-ledger

(perf) bound the controller's executor view in backtesting, and report closing-tick executors

**File**: `hummingbot/strategy_v2/backtesting/backtesting_engine_base.py` (modified, +100/-20)
```diff
@@ -1,8 +1,9 @@
 import importlib
 import inspect
 import os
+from collections import deque
 from decimal import Decimal
-from typing import Dict, List, Optional, Type, Union
+from typing import Deque, Dict, List, Optional, Type, Union
 
 import numpy as np
 import pandas as pd
@@ -153,14 +154,29 @@ def get_position_summary(self, mid_price: Decimal) -> PositionSummary:
 class BacktestingEngineBase:
     __controller_class_cache = LazyDict[str, Type[ControllerBase]]()
 
-    def __init__(self):
+    #: Seconds of terminated-executor history exposed to the controller on every tick. The full
+    #: ledger is always kept internally for the results; this only bounds the controller's view so
+    #: a run stays linear in the number of executors instead of quadratic. One hour comfortably
+    #: covers the cooldown/refresh windows the shipped controller bases look back over (the market
+    #: making base cools down for 15s by default, the directional one for 300s).
+    DEFAULT_TERMINATED_EXECUTORS_WINDOW: float = 60 * 60
+
+    def __init__(self, terminated_executors_window: Optional[float] = DEFAULT_TERMINATED_EXECUTORS_WINDOW):
+        """
+        Args:
+            terminated_executors_window: How far back (in seconds of simulated time) terminated
+                executors stay visible in ``controller.executors_info``. Pass ``None`` to hand the
+                controller the full history instead, which is quadratic in the number of executors.
+        """
         self.controller = None
         self.backtesting_resolution = None
         self.backtesting_data_provider = BacktestingDataProvider(connectors={})
         self.position_executor_simulator = PositionExecutorSimulator()
         self.dca_executor_simulator = DCAExecutorSimulator()
         self.grid_executor_simulator = GridExecutorSimulator()
         self.order_executor_simulator = OrderExecutorSimulator()
+        self.terminated_executors_window = terminated_executors_window
+        self._reset_simulation_state()
 
     @classmethod
     def load_controller_config(cls,
@@ -261,15 +277,7 @@ async def simulate_execution(self, trade_cost: float) -> list:
             List[ExecutorInfo]: List of executor information objects detailing the simulation results.
         """
         processed_features = self.prepare_market_data()
-        self.active_executor_simulations: List[ExecutorSimulation] = []
-        self.stopped_executors_info: List[ExecutorInfo] = []
-        self.active_position_holds: Dict[str, BacktestPositionHold] = {}
-        self._position_hold_processed_ids: set = set()
-        self._pending_position_hold_executors: List[ExecutorInfo] = []
-        self.position_held_timeseries: List[Dict] = []
-        self.pnl_timeseries: List[Dict] = []
-        self._executor_realized_pnl = 0.0
-        self._cumulative_volume = 0.0
+        self._reset_simulation_state()
         last_index = processed_features.index[-1]
         for i, row in processed_features.iterrows():
             await self.update_state(row)
@@ -282,9 +290,76 @@ async def simulate_execution(self, trade_cost: float) -> list:
                 elif isinstance(action, StopExecutorAction):
                     self.handle_stop_action(action, row["timestamp"])
 
+        # Closing tick: everything determine_executor_actions() did on the last row happened
+        # after that tick's update_executors_info(). Give the engine one last look so those
+        # executors are terminated, booked into the running totals and — when they keep their
+        # position — routed to the position-hold ledger, exactly as on any other tick. Without
+        # it a maker order created and filled on the last row reached the ledger as a
+        # POSITION_HOLD whose exposure no BacktestPositionHold ever accounted for, so its fill
+        # was dropped from both the executor PnL and the position summaries.
+        self.update_executors_info(last_index)
         # Final flush: convert any last-tick POSITION_HOLD executors into position holds
         self._update_positions_from_stopped_executors()
-        return self.controller.executors_info
+        return self.collect_executors_ledger(last_index)
+
+    def _reset_simulation_state(self):
+        """Reset every accumulator a single backtesting run writes to."""
+        self.active_executor_simulations: List[ExecutorSimulation] = []
+        self.stopped_executors_info: List[ExecutorInfo] = []
+        self.active_position_holds: Dict[str, BacktestPositionHold] = {}
+        self._position_hold_processed_ids: set = set()
+        self._pending_position_hold_executors: List[ExecutorInfo] = []
+        self.position_held_timeseries: List[Dict] = []
+        self.pnl_timeseries: List[Dict] = []
+        self._executor_realized_pnl = 0.0
+        self._cumulative_volume = 0.0
+        # Time-windowed view of terminated executors handed to the controller: the oldest ones
+        # fall out of the left end. ``None`` means the controller ge
```

**File**: `test/hummingbot/strategy_v2/backtesting/test_backtesting_executors_view.py` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+"""The controller's view of the executors must stay bounded while the run ledger stays complete.
+
+Handing the controller every executor ever created makes a run quadratic in the number of
+executors (each tick copies a list that only grows), so the engine exposes a time-bounded
+window of terminated executors instead. The ledger that ``simulate_execution`` returns — the
+one the results are summarized from — must keep every single executor regardless.
+"""
+import unittest
+from decimal import Decimal
+from unittest.mock import MagicMock
+
+from hummingbot.core.data_type.common import TradeType
+from hummingbot.strategy_v2.backtesting.backtesting_engine_base import BacktestingEngineBase
+from hummingbot.strategy_v2.executors.position_executor.data_types import PositionExecutorConfig, TripleBarrierConfig
+from hummingbot.strategy_v2.models.base import RunnableStatus
+from hummingbot.strategy_v2.models.executors import CloseType
+from hummingbot.strategy_v2.models.executors_info import ExecutorInfo
+
+
+class _FakeSimulation:
+    """Minimal stand-in for an ExecutorSimulation that terminates at a fixed timestamp."""
+
+    def __init__(self, executor_id: str, start: float, close_timestamp: float,
+                 close_type: CloseType = CloseType.TAKE_PROFIT):
+        self.config = PositionExecutorConfig(
+            id=executor_id, timestamp=start,
+            connector_name="binance", trading_pair="ETH-USDT",
+            side=TradeType.BUY, amount=Decimal("1"),
+            triple_barrier_config=TripleBarrierConfig(take_profit=Decimal("0.01")),
+        )
+        self.close_timestamp = close_timestamp
+        self.close_type = close_type
+
+    def get_executor_info_at_timestamp(self, timestamp: float) -> ExecutorInfo:
+        is_done = timestamp >= self.close_timestamp
+        return ExecutorInfo(
+            id=self.config.id, timestamp=self.config.timestamp, type="position_executor",
+            status=RunnableStatus.TERMINATED if is_done else RunnableStatus.RUNNING,
+            config=self.config,
+            net_pnl_pct=Decimal("0"), net_pnl_quote=Decimal("1"),
+            cum_fees_quote=Decimal("0"), filled_amount_quote=Decimal("100"),
+            is_active=not is_done, is_trading=not is_done,
+            custom_info={"side": TradeType.BUY, "close_price": 1, "level_id": "buy_0"},
+            close_timestamp=self.close_timestamp if is_done else None,
+            close_type=self.close_type if is_done else None,
+        )
+
+
+class TestControllerExecutorsView(unittest.TestCase):
+    WINDOW = 600.0  # seconds of terminated history the controller gets to see
+
+    def _engine(self, window=WINDOW):
+        engine = BacktestingEngineBase(terminated_executors_window=window)
+        engine.controller = MagicMock()
+        return engine
+
+    @staticmethod
+    def _run_ticks(engine, n_ticks: int, close_type: CloseType = CloseType.TAKE_PROFIT,
+                   tick_seconds: float = 60.0):
+        """Create one executor per tick that terminates on the next tick."""
+        max_view_len = 0
+        for tick in range(n_ticks):
+            now = 1000.0 + tick * tick_seconds
+            engine.active_executor_simulations.append(
+                _FakeSimulation(f"executor_{tick}", start=now,
+                                close_timestamp=now + tick_seconds, close_type=close_type))
+            engine.update_executors_info(timestamp=now)
+            engine._update_positions_from_stopped_executors()
+            max_view_len = max(max_view_len, len(engine.controller.executors_info))
+        return max_view_len
+
+    def test_controller_view_is_bounded_while_ledger_stays_complete(self):
+        engine = self._engine()
+        n_ticks = 200
+
+        max_view_len = self._run_ticks(engine, n_ticks)
+
+        # One executor terminates per tick, so the whole run creates n_ticks - 1 terminated ones.
+        self.assertEqual(len(engine.stopped_executors_info), n_ticks - 1)
+        # The ledger returned to the caller keeps every one of them, plus the still-running one.
+        last_timestamp = 1000.0 + (n_ticks - 1) * 60.0
+        self.assertEqual(len(engine.collect_executors_ledger(last_timestamp)), n_ticks)
+        # The controller only ever sees the active executor plus the last WINDOW seconds of them
+        # (a 600s window at one termination every 60s covers 11 of them, both ends included).
+        self.assertLessEqual(max_view_len, 1 + self.WINDOW / 60 + 1)
+        self.assertLess(max_view_len, n_ticks)
+
+    def test_view_keeps_the_whole_window_and_nothing_older(self):
+        engine = self._engine()
+
+        self._run_ticks(engine, 200)
+
+        view = engine.controller.executors_info
+        terminated = [executor for executor in view if executor.is_done]
+        # Every terminated executor still inside the window is there, in termination order.
+        self.assertEqual(len(terminated), self.WINDOW / 60 + 1)
+        last_timestamp = 10
```

**File**: `test/hummingbot/strategy_v2/backtesting/test_backtesting_final_tick_ledger.py` (added, +217/-0)
```diff
@@ -0,0 +1,217 @@
+"""What the controller does on the closing tick has to reach the results.
+
+``update_executors_info()`` runs at the *start* of a tick, so anything
+``determine_executor_actions()`` does on the last one happens after the engine's last look at
+the executors. The ledger returned by ``simulate_execution()`` is therefore rebuilt from the
+live simulations rather than replayed from that stale look.
+"""
+import unittest
+from decimal import Decimal
+from unittest.mock import MagicMock
+
+import pandas as pd
+
+from hummingbot.core.data_type.common import TradeType
+from hummingbot.strategy_v2.backtesting.backtesting_engine_base import BacktestingEngineBase
+from hummingbot.strategy_v2.backtesting.executor_simulator_base import ExecutorSimulation
+from hummingbot.strategy_v2.executors.order_executor.data_types import ExecutionStrategy, OrderExecutorConfig
+from hummingbot.strategy_v2.executors.position_executor.data_types import PositionExecutorConfig, TripleBarrierConfig
+from hummingbot.strategy_v2.models.base import RunnableStatus
+from hummingbot.strategy_v2.models.executor_actions import CreateExecutorAction, StopExecutorAction
+from hummingbot.strategy_v2.models.executors import CloseType
+
+TICKS = [0.0, 60.0, 120.0]
+
+
+def _config(executor_id: str, timestamp: float) -> PositionExecutorConfig:
+    return PositionExecutorConfig(
+        id=executor_id, timestamp=timestamp,
+        connector_name="binance", trading_pair="ETH-USDT",
+        side=TradeType.BUY, amount=Decimal("1"), entry_price=Decimal("100"),
+        triple_barrier_config=TripleBarrierConfig(take_profit=Decimal("0.01")),
+        level_id="buy_0",
+    )
+
+
+def _simulation(config: PositionExecutorConfig, timestamps, close_type=CloseType.TIME_LIMIT,
+                net_pnl_quote=Decimal("3")) -> ExecutorSimulation:
+    df = pd.DataFrame({
+        "net_pnl_pct": [0.03] * len(timestamps),
+        "net_pnl_quote": [float(net_pnl_quote)] * len(timestamps),
+        "cum_fees_quote": [0.1] * len(timestamps),
+        "filled_amount_quote": [100.0] * len(timestamps),
+        "close": [100.0] * len(timestamps),
+    }, index=pd.Index(timestamps, name="timestamp"))
+    return ExecutorSimulation(config=config, executor_simulation=df, close_type=close_type)
+
+
+def _order_config(executor_id: str, timestamp: float) -> OrderExecutorConfig:
+    return OrderExecutorConfig(
+        id=executor_id, timestamp=timestamp,
+        connector_name="binance", trading_pair="ETH-USDT",
+        side=TradeType.BUY, amount=Decimal("1"), price=Decimal("100"),
+        execution_strategy=ExecutionStrategy.MARKET,
+        level_id="buy_0",
+    )
+
+
+def _hold_simulation(config: OrderExecutorConfig, timestamps, entry_price=100.0) -> ExecutorSimulation:
+    """A maker order that fills and keeps the position: terminates as POSITION_HOLD."""
+    df = pd.DataFrame({
+        "net_pnl_pct": [0.0] * len(timestamps),
+        "net_pnl_quote": [0.0] * len(timestamps),
+        "cum_fees_quote": [0.0] * len(timestamps),
+        "filled_amount_quote": [entry_price] * len(timestamps),
+        "current_position_average_price": [entry_price] * len(timestamps),
+        "close": [entry_price] * len(timestamps),
+    }, index=pd.Index(timestamps, name="timestamp"))
+    return ExecutorSimulation(config=config, executor_simulation=df, close_type=CloseType.POSITION_HOLD)
+
+
+def _features() -> pd.DataFrame:
+    return pd.DataFrame({
+        "timestamp": TICKS,
+        "close_bt": [100.0] * len(TICKS),
+    }, index=pd.Index(TICKS, name="timestamp"))
+
+
+class _ScriptedController:
+    """Controller that emits a scripted list of actions per tick."""
+
+    def __init__(self, actions_by_tick):
+        self._actions_by_tick = actions_by_tick
+        self.config = MagicMock(connector_name="binance", trading_pair="ETH-USDT", id="test")
+        self.market_data_provider = MagicMock()
+        self.processed_data = {}
+        self.executors_info = []
+        self.positions_held = []
+
+    def determine_executor_actions(self):
+        return self._actions_by_tick.get(self.processed_data["timestamp"], [])
+
+
+class TestFinalTickLedger(unittest.IsolatedAsyncioTestCase):
+
+    @staticmethod
+    def _engine(controller, simulations_by_id):
+        engine = BacktestingEngineBase()
+        engine.controller = controller
+        engine.prepare_market_data = MagicMock(return_value=_features())
+        engine.simulate_executor = MagicMock(
+            side_effect=lambda config, df, trade_cost: simulations_by_id[config.id])
+        return engine
+
+    async def test_executor_created_on_the_final_tick_reaches_the_ledger(self):
+        """The last tick's CreateExecutorAction lands after update_executors_info() has run."""
+        early, late = _config("early", 60.0), _config("late", 120.0)
+        controller = _ScriptedController({
+            60.0: [CreateExecutorAction(controller_id="test", executor_config=early)],
+            120.0: [Cre
```

---

### Incident Patch 13: `4361c1cb` (2026-09-01)
**Commit Message**: fix(xrpl): let an explicit alias outrank the code-derived fallback

Review feedback on #8448: the new fallback made alias-less markets resolve, so
one could answer for a trustline ahead of a market that declares a
trading_pair_symbol for the same asset — changing a symbol that already
resolved before this branch.

Consult markets declaring an alias first. That alias is an explicit naming
decision, so every lookup that resolved before still resolves to the same
symbol and the fallback only fills gaps. sorted() is stable, so markets keep
their relative order within each group.

Also pins that a market still answers only for its own issuer: two gateways
issuing the same currency code are different assets, and the fallback returning
that code does not blur them at this level.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `hummingbot/connector/exchange/xrpl/xrpl_exchange.py` (modified, +8/-1)
```diff
@@ -3170,7 +3170,14 @@ async def wait_for_final_transaction_outcome(self, transaction, prelim_result, m
 
     def get_token_symbol_from_all_markets(self, code: str, issuer: str) -> Optional[str]:
         all_markets = self._make_xrpl_trading_pairs_request()
-        for market_name, market in all_markets.items():
+        # Markets declaring a trading_pair_symbol are consulted first. That alias is an
+        # explicit naming decision, so it keeps precedence over the code-derived fallback
+        # and every lookup that resolved before still resolves to the same symbol. sorted()
+        # is stable, so markets keep their relative order within each group.
+        ordered_markets = sorted(
+            all_markets.items(), key=lambda item: item[1].trading_pair_symbol is None
+        )
+        for market_name, market in ordered_markets:
             token_symbol = market.get_token_symbol(code, issuer)
 
             if token_symbol is not None:
```

**File**: `test/hummingbot/connector/exchange/xrpl/test_xrpl_market_token_symbol.py` (modified, +11/-0)
```diff
@@ -51,6 +51,17 @@ def test_the_symbol_is_uppercase(self):
         lowercase = XRPLMarket(base="btc", quote="xrp", base_issuer=BTC_ISSUER, quote_issuer="")
         self.assertEqual(lowercase.get_token_symbol("BTC", BTC_ISSUER), "BTC")
 
+    def test_two_issuers_of_one_currency_code_stay_distinct(self):
+        """The fallback returns the currency code, so it is worth pinning that a market
+        still only answers for its own issuer. Two gateways issuing "BTC" are different
+        assets, and each market matches exactly one of them."""
+        theirs = XRPLMarket(base="BTC", quote="XRP", base_issuer=SOLO_ISSUER, quote_issuer="")
+
+        self.assertEqual(self.market.get_token_symbol("BTC", BTC_ISSUER), "BTC")
+        self.assertIsNone(self.market.get_token_symbol("BTC", SOLO_ISSUER))
+        self.assertEqual(theirs.get_token_symbol("BTC", SOLO_ISSUER), "BTC")
+        self.assertIsNone(theirs.get_token_symbol("BTC", BTC_ISSUER))
+
     def test_the_shipped_default_market_resolves(self):
         """The SOLO-XRP entry that XRPLConfigMap.custom_markets defaults to carries no
         alias, so before this fix the connector's own default configuration dropped
```

---

### Incident Patch 14: `3522f14b` (2026-09-01)
**Commit Message**: fix(xrpl): resolve token symbols for markets without a trading_pair_symbol

XRPLMarket.get_token_symbol returned None whenever trading_pair_symbol was
unset, before testing whether the currency and issuer matched at all.

_update_balances resolves every trustline the ledger returns through that
method and skips the balance when it comes back None, so a real on-ledger
holding disappeared from balances and portfolio entirely — not reported at
zero, absent.

trading_pair_symbol is optional and exists only to alias a token to a
different display symbol. When it is unset there is still a correct answer for
a matching currency and issuer: the market's own base/quote code. Entries in
custom_markets are written without an alias unless the user knows to add one,
so this affected ordinary configuration — including the SOLO-XRP example that
ships as the custom_markets field's own default, which meant the connector's
default configuration dropped SOLO balances.

Let the currency/issuer match decide the outcome and fall back to the market's
own code, keeping the alias where one is set. The change is additive: a lookup
that resolved before resolves to the same symbol, and a non-match is still
No

**File**: `hummingbot/connector/exchange/xrpl/xrpl_utils.py` (modified, +16/-5)
```diff
@@ -142,14 +142,25 @@ def __repr__(self):
         return str(self.model_dump())
 
     def get_token_symbol(self, code: str, issuer: str) -> Optional[str]:
-        if self.trading_pair_symbol is None:
-            return None
-
+        """Symbol this market knows the given currency/issuer pair by, if it is one of them.
+
+        ``trading_pair_symbol`` is optional and only exists to alias a token to a different
+        display symbol. When it is not set there is still a perfectly good answer for a
+        matching currency and issuer — the market's own ``base``/``quote`` code — so the
+        match is what decides the outcome, not the presence of the alias.
+
+        Returning None whenever the alias was unset made the caller in ``_update_balances``
+        skip the balance entirely (``if token_symbol is None: continue``), so a real
+        on-ledger holding disappeared from balances and portfolio rather than showing up
+        with a zero value. Every entry in ``custom_markets`` is written without an alias
+        unless the user knows to add one — including the ``SOLO-XRP`` example shipped as
+        the field's own default — so this hit the default configuration too.
+        """
         if code.upper() == self.base.upper() and issuer.upper() == self.base_issuer.upper():
-            return self.trading_pair_symbol.split("-")[0]
+            return self.trading_pair_symbol.split("-")[0] if self.trading_pair_symbol else self.base.upper()
 
         if code.upper() == self.quote.upper() and issuer.upper() == self.quote_issuer.upper():
-            return self.trading_pair_symbol.split("-")[1]
+            return self.trading_pair_symbol.split("-")[1] if self.trading_pair_symbol else self.quote.upper()
 
         return None
 
```

**File**: `test/hummingbot/connector/exchange/xrpl/test_xrpl_market_token_symbol.py` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+import unittest
+
+from hummingbot.connector.exchange.xrpl.xrpl_utils import XRPLMarket
+
+BTC_ISSUER = "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"  # noqa: mock
+SOLO_ISSUER = "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz"  # noqa: mock
+
+
+class XRPLMarketGetTokenSymbolTests(unittest.TestCase):
+    """``trading_pair_symbol`` is an optional alias, not a precondition for matching.
+
+    ``_update_balances`` resolves every trustline the ledger returns through
+    ``get_token_symbol`` and skips the balance when it comes back None. Returning None
+    for any market without an alias therefore dropped real on-ledger holdings out of
+    balances and portfolio entirely — not shown at zero, absent. Entries in
+    ``custom_markets`` are written without an alias unless the user knows to add one,
+    including the ``SOLO-XRP`` example that ships as the field's own default.
+    """
+
+    def setUp(self):
+        self.market = XRPLMarket(base="BTC", quote="XRP", base_issuer=BTC_ISSUER, quote_issuer="")
+        self.aliased = XRPLMarket(
+            base="BTC",
+            quote="XRP",
+            base_issuer=BTC_ISSUER,
+            quote_issuer="",
+            trading_pair_symbol="WBTC-XRP",
+        )
+
+    def test_base_resolves_without_an_alias(self):
+        self.assertEqual(self.market.get_token_symbol("BTC", BTC_ISSUER), "BTC")
+
+    def test_quote_resolves_without_an_alias(self):
+        self.assertEqual(self.market.get_token_symbol("XRP", ""), "XRP")
+
+    def test_an_alias_still_takes_precedence(self):
+        self.assertEqual(self.aliased.get_token_symbol("BTC", BTC_ISSUER), "WBTC")
+        self.assertEqual(self.aliased.get_token_symbol("XRP", ""), "XRP")
+
+    def test_a_different_issuer_is_not_a_match(self):
+        """Same currency code from another gateway is a different asset."""
+        self.assertIsNone(self.market.get_token_symbol("BTC", SOLO_ISSUER))
+
+    def test_an_unknown_code_is_not_a_match(self):
+        self.assertIsNone(self.market.get_token_symbol("DOGE", BTC_ISSUER))
+
+    def test_matching_is_case_insensitive(self):
+        self.assertEqual(self.market.get_token_symbol("btc", BTC_ISSUER.lower()), "BTC")
+
+    def test_the_symbol_is_uppercase(self):
+        lowercase = XRPLMarket(base="btc", quote="xrp", base_issuer=BTC_ISSUER, quote_issuer="")
+        self.assertEqual(lowercase.get_token_symbol("BTC", BTC_ISSUER), "BTC")
+
+    def test_the_shipped_default_market_resolves(self):
+        """The SOLO-XRP entry that XRPLConfigMap.custom_markets defaults to carries no
+        alias, so before this fix the connector's own default configuration dropped
+        SOLO balances."""
+        from hummingbot.connector.exchange.xrpl.xrpl_utils import XRPLConfigMap
+
+        default_markets = XRPLConfigMap.model_fields["custom_markets"].default
+        solo = default_markets["SOLO-XRP"]
+        self.assertIsNone(solo.trading_pair_symbol)
+        self.assertEqual(solo.get_token_symbol("SOLO", SOLO_ISSUER), "SOLO")
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 15: `036f3e17` (2026-09-03)
**Commit Message**: (fix) route closing-tick POSITION_HOLD executors through position-hold accounting

An executor created on the final tick was rebuilt into the ledger by
collect_executors_ledger() without ever passing through update_executors_info(),
so a POSITION_HOLD termination got no BacktestPositionHold. summarize_results()
masks POSITION_HOLD executors out of the executor PnL, so the fill was dropped
from both sides: no executor PnL and no held exposure.

Give the engine one last look at the executors after the loop, before the
position-hold flush, so closing-tick executors are terminated, booked and routed
exactly as on any other tick.

**File**: `hummingbot/strategy_v2/backtesting/backtesting_engine_base.py` (modified, +8/-0)
```diff
@@ -290,6 +290,14 @@ async def simulate_execution(self, trade_cost: float) -> list:
                 elif isinstance(action, StopExecutorAction):
                     self.handle_stop_action(action, row["timestamp"])
 
+        # Closing tick: everything determine_executor_actions() did on the last row happened
+        # after that tick's update_executors_info(). Give the engine one last look so those
+        # executors are terminated, booked into the running totals and — when they keep their
+        # position — routed to the position-hold ledger, exactly as on any other tick. Without
+        # it a maker order created and filled on the last row reached the ledger as a
+        # POSITION_HOLD whose exposure no BacktestPositionHold ever accounted for, so its fill
+        # was dropped from both the executor PnL and the position summaries.
+        self.update_executors_info(last_index)
         # Final flush: convert any last-tick POSITION_HOLD executors into position holds
         self._update_positions_from_stopped_executors()
         return self.collect_executors_ledger(last_index)
```

**File**: `test/hummingbot/strategy_v2/backtesting/test_backtesting_final_tick_ledger.py` (modified, +51/-0)
```diff
@@ -14,6 +14,7 @@
 from hummingbot.core.data_type.common import TradeType
 from hummingbot.strategy_v2.backtesting.backtesting_engine_base import BacktestingEngineBase
 from hummingbot.strategy_v2.backtesting.executor_simulator_base import ExecutorSimulation
+from hummingbot.strategy_v2.executors.order_executor.data_types import ExecutionStrategy, OrderExecutorConfig
 from hummingbot.strategy_v2.executors.position_executor.data_types import PositionExecutorConfig, TripleBarrierConfig
 from hummingbot.strategy_v2.models.base import RunnableStatus
 from hummingbot.strategy_v2.models.executor_actions import CreateExecutorAction, StopExecutorAction
@@ -44,6 +45,29 @@ def _simulation(config: PositionExecutorConfig, timestamps, close_type=CloseType
     return ExecutorSimulation(config=config, executor_simulation=df, close_type=close_type)
 
 
+def _order_config(executor_id: str, timestamp: float) -> OrderExecutorConfig:
+    return OrderExecutorConfig(
+        id=executor_id, timestamp=timestamp,
+        connector_name="binance", trading_pair="ETH-USDT",
+        side=TradeType.BUY, amount=Decimal("1"), price=Decimal("100"),
+        execution_strategy=ExecutionStrategy.MARKET,
+        level_id="buy_0",
+    )
+
+
+def _hold_simulation(config: OrderExecutorConfig, timestamps, entry_price=100.0) -> ExecutorSimulation:
+    """A maker order that fills and keeps the position: terminates as POSITION_HOLD."""
+    df = pd.DataFrame({
+        "net_pnl_pct": [0.0] * len(timestamps),
+        "net_pnl_quote": [0.0] * len(timestamps),
+        "cum_fees_quote": [0.0] * len(timestamps),
+        "filled_amount_quote": [entry_price] * len(timestamps),
+        "current_position_average_price": [entry_price] * len(timestamps),
+        "close": [entry_price] * len(timestamps),
+    }, index=pd.Index(timestamps, name="timestamp"))
+    return ExecutorSimulation(config=config, executor_simulation=df, close_type=CloseType.POSITION_HOLD)
+
+
 def _features() -> pd.DataFrame:
     return pd.DataFrame({
         "timestamp": TICKS,
@@ -139,6 +163,33 @@ async def test_running_totals_and_ledger_agree_on_the_booked_executors(self):
             self.assertEqual(ledger_by_id[executor_id].status, RunnableStatus.TERMINATED)
             self.assertIsNotNone(ledger_by_id[executor_id].close_type)
 
+    async def test_position_hold_created_on_the_final_tick_is_accounted_for(self):
+        """A maker order created and filled on the closing tick keeps its position, so it has to
+        go through position-hold accounting rather than land in the ledger unaccounted for."""
+        late = _order_config("late_hold", 120.0)
+        controller = _ScriptedController({
+            120.0: [CreateExecutorAction(controller_id="test", executor_config=late)],
+        })
+        engine = self._engine(controller, {"late_hold": _hold_simulation(late, [120.0])})
+
+        ledger = await engine.simulate_execution(trade_cost=0.0)
+
+        self.assertEqual([executor.id for executor in ledger], ["late_hold"])
+        self.assertEqual(ledger[0].close_type, CloseType.POSITION_HOLD)
+
+        # Its exposure reaches the position-hold ledger...
+        holds = list(engine.active_position_holds.values())
+        self.assertEqual(len(holds), 1)
+        self.assertEqual(holds[0].net_amount_base, Decimal("1"))
+        self.assertEqual(holds[0].volume_traded_quote, Decimal("100"))
+        # ...and the fill is not silently dropped from the summary: a POSITION_HOLD executor is
+        # excluded from the executor PnL, so without the hold its 100 quote of volume vanished.
+        results = BacktestingEngineBase.summarize_results(
+            ledger, total_amount_quote=1000,
+            position_holds=holds, final_price=Decimal("110"),
+            pnl_timeseries=engine.pnl_timeseries)
+        self.assertEqual(results["unrealized_pnl_quote"], 10.0)
+
     def test_executor_stopped_after_the_last_look_keeps_its_terminated_info(self):
         """A StopExecutorAction handled after update_executors_info() must win over the stale
         running snapshot the controller was holding."""
```

#### Recent Merged Pull Requests:
- **PR #8496** (2026-10-06): fix/ preserve LP volume across POSITION_HOLD closure (@mlguys)
- **PR #8492** (closed): Feat/unified account balance grouping (@isreallee82)
- **PR #8467** (2026-09-22): Sync / Staging to master  v2.17 (@rapcmia)
- **PR #8464** (2026-09-18): (fix) emulate reduce_only for resting kalshi_perpetual close orders (@cardosofede)
- **PR #8461** (2026-09-23): fix / race condition in api throttler acquire() (@mnaamani)
- **PR #8460** (closed): (fix) race condition in api throttler acquire() (@mnaamani)
- **PR #8459** (2026-09-20): Sync / Development to Staging v2.17 (@rapcmia)
- **PR #8456** (closed): feat: implement ZTDX perpetual connector (@jetlee12)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
