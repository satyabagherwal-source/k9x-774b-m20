# Forensic Learning Record (Deep Inspection): hummingbot/hummingbot

> **Canonical Artifact**: `07_PROJECT_LEARNING/hummingbot-hummingbot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hummingbot/hummingbot](https://github.com/hummingbot/hummingbot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:42:47.136Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hummingbot/hummingbot`
- **Description**: Open source software that helps you create and deploy high-frequency crypto trading bots
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 20280 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bin/conf_migration_script.py`
```
import argparse

import path_util  # noqa: F401

from hummingbot.client.config.conf_migration import migrate_configs
from hummingbot.client.config.config_crypt import ETHKeyFileSecretManger

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate the HummingBot confs")
    parser.add_argument("password", type=str, help="Required to migrate all encrypted configs.")
    args = parser.parse_args()
    secrets_manager_ = ETHKeyFileSecretManger(args.password)
    migrate_configs(secrets_manager_)

```

### Core Architecture Module: `bin/hummingbot.py`
```
#!/usr/bin/env python

import asyncio
from typing import Coroutine, List, Optional
from weakref import ReferenceType, ref

import path_util  # noqa: F401

from hummingbot import chdir_to_data_directory, init_logging
from hummingbot.client.config.client_config_map import ClientConfigMap
from hummingbot.client.config.config_crypt import ETHKeyFileSecretManger
from hummingbot.client.config.config_helpers import (
    ClientConfigAdapter,
    create_yml_files_legacy,
    load_client_config_map_from_file,
    write_config_to_yml,
)
from hummingbot.client.config.security import Security
from hummingbot.client.hummingbot_application import HummingbotApplication
from hummingbot.client.settings import AllConnectorSettings
from hummingbot.client.ui import login_prompt
from hummingbot.client.ui.style import load_style
from hummingbot.core.event.event_listener import EventListener
from hummingbot.core.event.events import HummingbotUIEvent
from hummingbot.core.utils import detect_available_port
from hummingbot.core.utils.async_utils import safe_gather


class UIStartListener(EventListener):
    def __init__(self, hummingbot_app: HummingbotApplication, is_script: Optional[bool] = False,
                 script_config: Optional[dict] = None, is_quickstart: Optional[bool] = False):
        super().__init__()
        self._hb_ref: ReferenceType = ref(hummingbot_app)
        self._is_script = is_script
        self._is_quickstart = is_quickstart
        self._script_config = script_config

    def __call__(self, _):
        asyncio.create_task(self.ui_start_handler())

    @property
    def hummingbot_app(self) -> HummingbotApplication:
        return self._hb_ref()

    async def ui_start_handler(self):
        hb: HummingbotApplication = self.hummingbot_app
        if hb.strategy_name is not None:
            if not self._is_script:
                write_config_to_yml(hb.strategy_config_map, hb.strategy_file_name, hb.client_config_map)
            hb.start(log_level=hb.client_config_map.log_level,
                     v2_conf=self._script_config if self._is_script else None,
                     is_quickstart=self._is_quickstart)


async def main_async(client_config_map: ClientConfigAdapter):
    await Security.wait_til_decryption_done()
    await create_yml_files_legacy()

    init_logging("hummingbot_logs.yml", client_config_map)

    AllConnectorSettings.initialize_paper_trade_settings(client_config_map.paper_trade.paper_trade_exchanges)

    hb = HummingbotApplication.main_application(client_config_map)

    # The listener needs to have a named variable for keeping reference, since the event listener system
    # uses weak references to remove unneeded listeners.
    start_listener: UIStartListener = UIStartListener(hb)
    hb.app.add_listener(HummingbotUIEvent.Start, start_listener)

    tasks: List[Coroutine] = [hb.run()]
    if client_config_map.debug_console:
        if not hasattr(__builtins__, "help"):
            import _sitebuiltins
            __builtins__["help"] = _sitebuiltins._Helper()

        from hummingbot.core.management.console import start_management_console
        management_port: int = detect_available_port(8211)
        tasks.append(start_management_console(locals(), host="localhost", port=management_port))
    await safe_gather(*tasks)


def main():
    chdir_to_data_directory()
    secrets_manager_cls = ETHKeyFileSecretManger

    try:
        ev_loop: asyncio.AbstractEventLoop = asyncio.get_running_loop()
    except RuntimeError:
        ev_loop: asyncio.AbstractEventLoop = asyncio.new_event_loop()
        asyncio.set_event_loop(ev_loop)

    # We need to load a default style for the login screen because the password is required to load the
    # real configuration now that it can include secret parameters
    style = load_style(ClientConfigAdapter(ClientConfigMap()))

    if login_prompt(secrets_manager_cls, style=style):
        client_config_map = load_client_config_map_from_file()
        ev_loop.run_until_complete(main_async(client_config_map))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `bin/hummingbot_quickstart.py`
```
#!/usr/bin/env python

import argparse
import asyncio
import logging
import os
from typing import Coroutine, List

import path_util  # noqa: F401

from bin.hummingbot import UIStartListener, detect_available_port
from hummingbot import init_logging
from hummingbot.client.config.config_crypt import BaseSecretsManager, ETHKeyFileSecretManger
from hummingbot.client.config.config_helpers import load_client_config_map_from_file
from hummingbot.client.hummingbot_application import HummingbotApplication
from hummingbot.client.runner import (
    autofix_permissions,
    bootstrap_application,
    load_and_start_strategy,
    wait_for_gateway_ready,
)
from hummingbot.client.ui import login_prompt
from hummingbot.client.ui.style import load_style
from hummingbot.core.event.events import HummingbotUIEvent
from hummingbot.core.management.console import start_management_console
from hummingbot.core.utils.async_utils import safe_gather


class CmdlineParser(argparse.ArgumentParser):
    def __init__(self):
        super().__init__()
        self.add_argument("--config-file-name", "-f",
                          type=str,
                          required=False,
                          help="Specify a file in `conf/` to load as the strategy config file.")
        self.add_argument("--v2",
                          type=str,
                          required=False,
                          dest="v2_conf",
                          help="V2 strategy config file name (from conf/scripts/).")
        self.add_argument("--config-password", "-p",
                          type=str,
                          required=False,
                          help="Specify the password to unlock your encrypted files.")
        self.add_argument("--auto-set-permissions",
                          type=str,
                          required=False,
                          help="Try to automatically set config / logs / data dir permissions, "
                               "useful for Docker containers.")
        self.add_argument("--headless",
                          type=bool,
                          nargs='?',
                          const=True,
                          default=None,
                          help="Run in headless mode without CLI interface.")


async def quick_start(args: argparse.Namespace, secrets_manager: BaseSecretsManager):
    """Start Hummingbot using unified HummingbotApplication in either UI or headless mode."""
    client_config_map = load_client_config_map_from_file()

    if args.auto_set_permissions is not None:
        autofix_permissions(args.auto_set_permissions)

    # Shared boot (login, yml, basic logging, system configs, paper-trade, build app). Logging is
    # re-initialized later in run_application with the strategy file name. MQTT autostarts only headless.
    hb = await bootstrap_application(client_config_map, secrets_manager,
                                     headless=args.headless, mqtt_autostart=args.headless)
    if hb is None:
        return

    # Load and start strategy if provided
    if args.v2_conf is not None or args.config_file_name is not None:
        success = await load_and_start_strategy(
            hb,
            config_file_name=args.config_file_name,
            v2_conf=args.v2_conf,
            headless=bool(args.headless),
        )
        if not success:
            logging.getLogger().error("Failed to load strategy. Exiting.")
            raise SystemExit(1)

    await wait_for_gateway_ready(hb)

    # Run the application
    await run_application(hb, args, client_config_map)


async def run_application(hb: HummingbotApplication, args: argparse.Namespace, client_config_map):
    """Run the application in headless or UI mode."""
    if args.headless:
        # Re-initialize logging with proper strategy file name for headless mode
        log_file_name = hb.strategy_file_name.split(".")[0] if hb.strategy_file_name else "hummingbot"
        init_logging("hummingbot_logs.yml", hb.client_config_map,
                     override_log_level=hb.client_config_map.log_level,
                     strategy_file_path=log_file_name)
        await hb.run()
    else:
        # Set up UI mode with start listener
        start_listener: UIStartListener = UIStartListener(
            hb,
            is_script=args.v2_conf is not None,
            script_config=getattr(hb, 'script_config', None),
            is_quickstart=True
        )
        hb.app.add_listener(HummingbotUIEvent.Start, start_listener)

        tasks: List[Coroutine] = [hb.run()]
        if client_config_map.debug_console:
            management_port: int = detect_available_port(8211)
            tasks.append(start_management_console(locals(), host="localhost", port=management_port))

        await safe_gather(*tasks)


def main():
    args = CmdlineParser().parse_args()

    # Parse environment variables from Dockerfile.
    # If an environment variable is not empty and it's not defined in the arguments, then we'll use the environment
    # variable.
    if args.config_file_name is None and len(os.environ.get("CONFIG_FILE_NAME", "")) > 0:
        args.config_file_name = os.environ["CONFIG_FILE_NAME"]

    if args.v2_conf is None and len(os.environ.get("SCRIPT_CONFIG", "")) > 0:
        args.v2_conf = os.environ["SCRIPT_CONFIG"]

    if args.config_password is None and len(os.environ.get("CONFIG_PASSWORD", "")) > 0:
        args.config_password = os.environ["CONFIG_PASSWORD"]

    if args.headless is None and len(os.environ.get("HEADLESS_MODE", "")) > 0:
        args.headless = os.environ["HEADLESS_MODE"].lower() == "true"

    # If no password is given from the command line, prompt for one.
    secrets_manager_cls = ETHKeyFileSecretManger
    client_config_map = load_client_config_map_from_file()
    if args.config_password is None:
        secrets_manager = login_prompt(secrets_manager_cls, style=load_style(client_config_map))
        if not secrets_manager:
            return
    else:
        secrets_manager = secrets_manager_cls(args.config_password)

    try:
        ev_loop: asyncio.AbstractEventLoop = asyncio.get_running_loop()
    except RuntimeError:
        ev_loop: asyncio.AbstractEventLoop = asyncio.new_event_loop()
        asyncio.set_event_loop(ev_loop)

    ev_loop.run_until_complete(quick_start(args, secrets_manager))


if __name__ == "__main__":
    main()

```

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

### Core Architecture Module: `conf/__init__.py`
```
#!/usr/bin/env python

import logging as _logging
import os

_logger = _logging.getLogger(__name__)

master_host = "***REMOVED***"
master_user = "***REMOVED***"
master_password = "***REMOVED***"
master_db = "***REMOVED***"

slave_host = "127.0.0.1"
slave_user = "reader"
slave_password = "falcon"
slave_db = "falcon"

mysql_master_server = "***REMOVED***"
mysql_slave_server = "***REMOVED***"

mysql_user = "***REMOVED***"
mysql_password = "***REMOVED***"
mysql_db = "***REMOVED***"

order_book_db = "***REMOVED***"
sparrow_db = "***REMOVED***"

order_books_db_2 = {
    "host": "***REMOVED***",
    "user": "***REMOVED***",
    "password": "***REMOVED***",
    "db": "**REMOVED***",
}

# whether to enable api mocking in unit test cases
mock_api_enabled = os.getenv("MOCK_API_ENABLED")

"""
# Binance Tests
binance_api_key = os.getenv("BINANCE_API_KEY")
binance_api_secret = os.getenv("BINANCE_API_SECRET")

# Binance Perpetuals Tests
binance_perpetuals_api_key = os.getenv("BINANCE_PERPETUALS_API_KEY")
binance_perpetuals_api_secret = os.getenv("BINANCE_PERPETUALS_API_SECRET")

# Coinbase Advanced Trade Tests
coinbase_advanced_trade_api_key = os.getenv("COINBASE_ADVANCED_TRADE_API_KEY")
coinbase_advanced_trade_secret_key = os.getenv("COINBASE_ADVANCED_TRADE_SECRET_KEY")


# Htx Tests
htx_api_key = os.getenv("HTX_API_KEY")
htx_secret_key = os.getenv("HTX_SECRET_KEY")

# Bittrex Tests
bittrex_api_key = os.getenv("BITTREX_API_KEY")
bittrex_secret_key = os.getenv("BITTREX_SECRET_KEY")

# KuCoin Tests
kucoin_api_key = os.getenv("KUCOIN_API_KEY")
kucoin_secret_key = os.getenv("KUCOIN_SECRET_KEY")
kucoin_passphrase = os.getenv("KUCOIN_PASSPHRASE")

test_web3_provider_list = [os.getenv("WEB3_PROVIDER")]

# Kraken Tests
kraken_api_key = os.getenv("KRAKEN_API_KEY")
kraken_secret_key = os.getenv("KRAKEN_SECRET_KEY")

# OKX Test
okx_api_key = os.getenv("OKX_API_KEY")
okx_secret_key = os.getenv("OKX_SECRET_KEY")
okx_passphrase = os.getenv("OKX_PASSPHRASE")

# BitMart Test
bitmart_api_key = os.getenv("BITMART_API_KEY")
bitmart_secret_key = os.getenv("BITMART_SECRET_KEY")
bitmart_memo = os.getenv("BITMART_MEMO")

# BTC Markets Test
btc_markets_api_key = os.getenv("BTC_MARKETS_API_KEY")
btc_markets_secret_key = os.getenv("BTC_MARKETS_SECRET_KEY")

# Gate.io Tests
gate_io_api_key = os.getenv("GATE_IO_API_KEY")
gate_io_secret_key = os.getenv("GATE_IO_SECRET_KEY")

# Mexc Tests
mexc_api_key = os.getenv("MEXC_API_KEY")
mexc_api_secret = os.getenv("MEXC_API_SECRET")

# Wallet Tests
test_erc20_token_address = os.getenv("TEST_ERC20_TOKEN_ADDRESS")
web3_test_private_key_a = os.getenv("TEST_WALLET_PRIVATE_KEY_A")
web3_test_private_key_b = os.getenv("TEST_WALLET_PRIVATE_KEY_B")
web3_test_private_key_c = os.getenv("TEST_WALLET_PRIVATE_KEY_C")

coinalpha_order_book_api_username = "***REMOVED***"
coinalpha_order_book_api_password = "***REMOVED***"
"""

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #8308** (2026-08-03): **Lighter perpetual - private websocket fails in Condor + HAPI testing even after connector re-add**
  *Symptoms*: ### Describe the bug  This issue was found while testing PR #8304 through Condor + HAPI. After adding the Lighter perpetual connector, authenticated balance data was available, which suggests the credentials were loaded and basic authenticated access was working. Even so, the private websocket kept failing and repeatedly returned an error saying the auth field was required for the `account_all_orders` channel.  ``` 2026-06-18 07:46:22,349 - hummingbot.connector.derivative.lighter_perpetual.lighter_perpetual_user_stream_data_source.LighterPerpetualUserStreamDataSource - ERROR - Unexpected error while listening to user stream. Retrying after 5 seconds... Traceback (most recent call last):   File "/opt/conda/envs/hummingbot-api/lib/python3.12/site-packages/hummingbot/core/data_type/user_stream_tracker_data_source.py", line 48, in listen_for_user_stream     await self._process_websocket_messages(websocket_assistant=self._ws_assistant, queue=output)   File "/opt/conda/envs/hummingbot-api/lib/python3.12/site-packages/hummingbot/connector/derivative/lighter_perpetual/lighter_perpetual_user_stream_data_source.py", line 89, in _process_websocket_messages     await self._process_event_message(event_message=data, queue=queue)   File "/opt/conda/envs/hummingbot-api/lib/python3.12/site-packages/hummingbot/connector/derivative/lighter_perpetual/lighter_perpetual_user_stream_data_source.py", line 106, in _process_event_message     raise IOError(f"Lighter private websocket error: {event_mess

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
+      
```

---

### Incident Patch 2: `7bddea37` (2026-09-17)
**Commit Message**: (fix) recheck kalshi_perpetual close orders the cancel pass skipped

A close placed while a position refresh was in flight is skipped by the
cancel pass, and its own order events only refresh balances, so a stale
cached position could leave it resting with no position to reduce.
Skipping one now schedules another refresh, which sees it as older.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

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

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

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
+      
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
+        contract_size = self._connector.get_contra
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

---

### Incident Patch 6: `342556fb` (2026-09-15)
**Commit Message**: (fix) fetch kalshi_perpetual REST fills once per polling cycle

The fills endpoint can't filter by order, so the base class downloaded the same fills once per tracked order, and
during a network outage logged a failure with its full traceback for each of them. Fetch the fills of all orders with
a single request and log one short warning when it fails; missed fills are recovered on the next poll.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

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

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
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

---

### Incident Patch 8: `4bbaccf9` (2026-09-14)
**Commit Message**: (fix) keep kalshi_perpetual orders tracked through network errors

The base class counted every failed status request towards losing an order,
so a DNS outage of a few polls marked orders still resting on Kalshi as failed
and stopped tracking them, and their later fills would be ignored. Only
Kalshi's not_found (or a missing exchange order id) counts now; cancel request
timeouts no longer count either.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
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
+            "WARNING", f"Failed to cancel the order {order.client_order_id} because it doe
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

#### Recent Merged Pull Requests:
- **PR #8492** (closed): Feat/unified account balance grouping (@isreallee82)
- **PR #8467** (2026-09-22): Sync / Staging to master  v2.17 (@rapcmia)
- **PR #8464** (2026-09-18): (fix) emulate reduce_only for resting kalshi_perpetual close orders (@cardosofede)
- **PR #8461** (2026-09-23): fix / race condition in api throttler acquire() (@mnaamani)
- **PR #8460** (closed): (fix) race condition in api throttler acquire() (@mnaamani)
- **PR #8459** (2026-09-20): Sync / Development to Staging v2.17 (@rapcmia)
- **PR #8456** (closed): feat: implement ZTDX perpetual connector (@jetlee12)
- **PR #8454** (2026-09-17): (feat) add kalshi_perpetual connector (@cardosofede)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
