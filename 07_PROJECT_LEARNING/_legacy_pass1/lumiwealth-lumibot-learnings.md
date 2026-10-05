# Forensic Learning Record (Deep Inspection): Lumiwealth/lumibot

> **Canonical Artifact**: `07_PROJECT_LEARNING/lumiwealth-lumibot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Lumiwealth/lumibot](https://github.com/Lumiwealth/lumibot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:23:33.480Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Lumiwealth/lumibot`
- **Description**: AI agents that actually place the trade. 12 brokers, real backtests, stocks options futures forex crypto and prediction markets.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2100 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/botspot_error_reporting_example.py`
```
"""
Example demonstrating Botspot error reporting integration with Lumibot logger.

This example shows how errors logged through the unified logger are automatically
reported to the Botspot API when the LUMIWEALTH_API_KEY is available.

To enable Botspot error reporting:
1. Set LUMIWEALTH_API_KEY environment variable with your API key (or have it in your .env file)
2. Use the standard Lumibot logger for all logging

Example:
    export LUMIWEALTH_API_KEY="your-api-key-here"
    python botspot_error_reporting_example.py
"""

import os
from lumibot.tools.lumibot_logger import get_logger, get_strategy_logger

# Example 1: Basic logger usage
def example_basic_logging():
    """Demonstrate basic logging with automatic Botspot reporting."""
    logger = get_logger(__name__)
    
    # Info messages are not reported to Botspot
    logger.info("Application started successfully")
    
    # Warning messages ARE reported to Botspot
    logger.warning("Configuration file not found, using defaults")
    
    # Error messages ARE reported to Botspot (as CRITICAL severity)
    logger.error("Failed to connect to data source")
    
    # Critical messages ARE reported to Botspot
    logger.critical("System is in an unsafe state - shutting down")


# Example 2: Strategy-specific logging
def example_strategy_logging():
    """Demonstrate strategy logging with automatic Botspot reporting."""
    logger = get_strategy_logger(__name__, "StockDiversifiedLeverage")
    
    # Strategy-specific messages include the strategy name
    logger.info("Strategy initialized")
    
    # Warnings include strategy context
    logger.warning("Portfolio imbalance detected")
    
    # Errors are reported with strategy-specific error codes
    logger.error("Failed to execute rebalancing trade")


# Example 3: Structured error reporting
def example_structured_errors():
    """Demonstrate structured error format for better Botspot integration."""
    logger = get_logger(__name__)
    
    # Use structured format: "ERROR_CODE: message | details"
    logger.error("DATA_FEED_ERROR: Market data connection lost | Provider: AlphaVantage, Retry count: 3")
    
    # Strategy logger with structured format
    strategy_logger = get_strategy_logger(__name__, "MomentumStrategy")
    strategy_logger.error("EXECUTION_ERROR: Order rejected by broker | Symbol: AAPL, Reason: Insufficient margin")


# Example 4: Error deduplication
def example_error_deduplication():
    """Demonstrate how duplicate errors are counted rather than spammed."""
    logger = get_logger(__name__)
    
    # These identical errors will be counted, not duplicated
    for i in range(5):
        logger.error("Database connection timeout")
    
    # The Botspot handler will report this as a single error with count=5


def main():
    """Run all examples."""
    print("Botspot Error Reporting Examples")
    print("=" * 50)
    
    # Check if Botspot is configured
    from lumibot.credentials import LUMIWEALTH_API_KEY
    if LUMIWEALTH_API_KEY or os.environ.get("LUMIWEALTH_API_KEY"):
        print("✅ Botspot error reporting is ENABLED")
        print("   Bot ID is handled automatically by the API")
    else:
        print("❌ Botspot error reporting is DISABLED")
        print("   Set LUMIWEALTH_API_KEY to enable")
    
    print("\nRunning examples...\n")
    
    print("1. Basic logging example:")
    example_basic_logging()
    
    print("\n2. Strategy logging example:")
    example_strategy_logging()
    
    print("\n3. Structured error example:")
    example_structured_errors()
    
    print("\n4. Error deduplication example:")
    example_error_deduplication()
    
    print("\n✅ Examples completed!")
    print("\nNote: If Botspot is configured, all WARNING+ messages above were")
    print("automatically reported to the Botspot API endpoint.")


if __name__ == "__main__":
    main()
```

### Core Architecture Module: `examples/databento_futures_example.py`
```
"""
DataBento Futures Trading Strategy Example

This example demonstrates how to use DataBento as a data source for futures trading
with Lumibot. It shows how to:
1. Configure DataBento as a data source
2. Create a simple futures trading strategy
3. Backtest using DataBento data

Requirements:
- DataBento API key
- databento Python package: pip install databento
"""

from datetime import datetime, timedelta
from lumibot.strategies import Strategy
from lumibot.entities import Asset
from lumibot.backtesting import DataBentoDataBacktesting


class DataBentoFuturesExample(Strategy):
    """
    Example strategy using DataBento for futures data
    
    This strategy implements a simple moving average crossover system for E-mini S&P 500 futures.
    """
    
    def initialize(self):
        """Initialize the strategy"""
        # Set the sleep time between iterations (in seconds)
        self.sleeptime = 300  # 5 minutes
        
        # Define the futures contract we want to trade
        # Using E-mini S&P 500 futures expiring in March 2025
        self.asset = Asset(
            symbol="ES",
            asset_type="future", 
            expiration=datetime(2025, 3, 21).date()  # Third Friday of March
        )
        
        # Moving average periods
        self.short_ma_period = 10
        self.long_ma_period = 30
        
        # Position sizing
        self.position_size = 1  # Number of contracts
        
        # Track last signal to avoid over-trading
        self.last_signal = None
        
        self.log_message("DataBento Futures Strategy initialized")
        self.log_message(f"Trading asset: {self.asset.symbol} expiring {self.asset.expiration}")

    def on_trading_iteration(self):
        """Main trading logic executed on each iteration"""
        
        # Get historical price data for moving averages
        bars = self.get_historical_prices(
            asset=self.asset,
            length=self.long_ma_period + 10,  # Extra buffer
            timestep="minute"
        )
        
        if bars is None or len(bars.df) < self.long_ma_period:
            self.log_message("Insufficient data for analysis")
            return
        
        # Calculate moving averages
        df = bars.df
        short_ma = df['close'].rolling(window=self.short_ma_period).mean()
        long_ma = df['close'].rolling(window=self.long_ma_period).mean()
        
        # Get current values
        current_short_ma = short_ma.iloc[-1]
        current_long_ma = long_ma.iloc[-1]
        current_price = df['close'].iloc[-1]
        
        # Get previous values for crossover detection
        prev_short_ma = short_ma.iloc[-2]
        prev_long_ma = long_ma.iloc[-2]
        
        # Determine signal
        signal = None
        
        # Bullish crossover: short MA crosses above long MA
        if prev_short_ma <= prev_long_ma and current_short_ma > current_long_ma:
            signal = "BUY"
        
        # Bearish crossover: short MA crosses below long MA
        elif prev_short_ma >= prev_long_ma and current_short_ma < current_long_ma:
            signal = "SELL"
        
        # Log current state
        self.log_message(f"Price: {current_price:.2f}, Short MA: {current_short_ma:.2f}, Long MA: {current_long_ma:.2f}")
        
        # Execute trades based on signal
        current_position = self.get_position(self.asset)
        
        if signal == "BUY" and self.last_signal != "BUY":
            if current_position:
                # Close any short position
                if current_position.quantity < 0:
                    self.sell_all(self.asset)
            
            # Open long position
            order = self.create_order(
                asset=self.asset,
                quantity=self.position_size,
                side="buy"
            )
            self.submit_order(order)
            
            self.last_signal = "BUY"
            self.log_message(f"BUY signal: Opening long position of {self.position_size} contracts")
        
        elif signal == "SELL" and self.last_signal != "SELL":
            if current_position:
                # Close any long position
                if current_position.quantity > 0:
                    self.sell_all(self.asset)
            
            # Open short position
            order = self.create_order(
                asset=self.asset,
                quantity=self.position_size,
                side="sell"
            )
            self.submit_order(order)
            
            self.last_signal = "SELL"
            self.log_message(f"SELL signal: Opening short position of {self.position_size} contracts")
        
        # Log position information
        if current_position:
            unrealized_pnl = current_position.quantity * (current_price - current_position.avg_fill_price)
            self.log_message(f"Current position: {current_position.quantity} contracts, "
                           f"Avg price: {current_position.avg_fill_price:.2f}, "
                           f"Unrealized P&L: ${unrealized_pnl:.2f}")


if __name__ == "__main__":
    """
    Example of how to backtest the strategy using DataBento data
    
    Before running this, make sure to:
    1. Install databento: pip install databento
    2. Set your DataBento API key in environment variables:
       export DATABENTO_API_KEY="your_api_key_here"
    3. Optionally set DATA_SOURCE=databento in environment variables
    """
    
    # Define backtest parameters
    backtest_start = datetime(2025, 1, 1)
    backtest_end = datetime(2025, 1, 31)
    
    # Note: You'll need a valid DataBento API key for this to work
    api_key = "your_databento_api_key_here"  # Replace with your actual API key
    
    # Create the strategy
    strategy = DataBentoFuturesExample()
    
    # Set up backtesting with DataBento data source
    strategy.backtest(
        DataBentoDataBacktesting,
        backtest_start,
        backtest_end,
        api_key=api_key,
        show_plot=True,
        show_tearsheet=True,
        save_tearsheet=True
    )

```

### Core Architecture Module: `examples/databento_optimized_example.py`
```
"""
Example showing how to use DataBento backtesting with improved prefetch functionality.

This example demonstrates the new prefetch approach that loads all required data upfront,
reducing redundant API calls and log spam during backtesting.
"""

from datetime import datetime, timedelta

# Mock example - in real usage, import from lumibot
class MockDataBentoBacktesting:
    """Mock class to demonstrate the prefetch concept"""
    
    def __init__(self, datetime_start, datetime_end, api_key):
        self.datetime_start = datetime_start
        self.datetime_end = datetime_end
        self.api_key = api_key
        self._prefetched_assets = set()
        self.pandas_data = {}
        print(f"DataBento backtesting initialized for period: {datetime_start} to {datetime_end}")
    
    def prefetch_data(self, assets, timestep="minute"):
        """Simulate prefetching data for assets"""
        print(f"Prefetching {timestep} data for {len(assets)} assets...")
        for asset in assets:
            print(f"  - Fetching data for {asset}")
            # Simulate data fetching
            self._prefetched_assets.add(asset)
        print("Prefetch complete!")
    
    def initialize_data_for_backtest(self, strategy_assets, timestep="minute"):
        """Convenience method to prefetch all required data"""
        print(f"Initializing backtesting data for {len(strategy_assets)} assets")
        self.prefetch_data(strategy_assets, timestep)


def demonstrate_prefetch_optimization():
    """
    Demonstrate the prefetch optimization approach
    """
    print("=== DataBento Backtesting Optimization Demo ===")
    print()
    
    # Set up backtest parameters
    backtesting_start = datetime(2023, 1, 1)
    backtesting_end = datetime(2023, 1, 31)
    
    # Assets to trade
    assets = ["ESH23", "NQH23", "CLH23"]  # Futures symbols
    
    print("OLD APPROACH (without prefetch):")
    print("❌ Data fetched on-demand during each iteration")
    print("❌ Repeated cache checks and API calls")
    print("❌ Excessive log messages like:")
    print("   INFO: Checking cache for ESH23...")
    print("   INFO: Cache hit for ESH23")
    print("   INFO: Checking cache for ESH23...")  
    print("   INFO: Cache hit for ESH23")
    print("   (repeated 1000s of times)")
    print()
    
    print("NEW APPROACH (with prefetch):")
    print("✅ All data loaded upfront during initialization")
    print("✅ No redundant API calls during backtest")
    print("✅ Minimal log output")
    print()
    
    # Create optimized DataBento data source
    data_source = MockDataBentoBacktesting(
        datetime_start=backtesting_start,
        datetime_end=backtesting_end,
        api_key="demo_key"
    )
    
    print("Step 1: Initialize data source")
    print("Step 2: Prefetch all required data upfront")
    data_source.initialize_data_for_backtest(assets, timestep="minute")
    
    print()
    print("Step 3: Run backtest (no more data fetching needed)")
    print("✅ Backtest runs efficiently with prefetched data")
    print("✅ No repeated log messages")
    print("✅ Faster execution")
    

def show_usage_patterns():
    """Show different ways to use the prefetch functionality"""
    print("\n=== Usage Patterns ===")
    print()
    
    print("PATTERN 1: Automatic prefetch in strategy initialization")
    print("""
class MyStrategy(Strategy):
    assets = ["ESH23", "NQH23"]
    
    def initialize(self):
        # Automatically prefetch all required data
        if hasattr(self._data_source, 'initialize_data_for_backtest'):
            self._data_source.initialize_data_for_backtest(
                strategy_assets=self.assets,
                timestep="minute"
            )
    """)
    
    print("PATTERN 2: Manual prefetch before backtest")
    print("""
# Create data source
data_source = DataBentoDataBacktesting(
    datetime_start=start_date,
    datetime_end=end_date,
    api_key=api_key
)

# Manually prefetch data for specific assets
assets = [Asset("ESH23", "future"), Asset("NQH23", "future")]
data_source.prefetch_data(assets, timestep="minute")

# Run backtest with prefetched data
strategy.backtest(data_source, ...)
    """)
    
    print("PATTERN 3: Mixed approach with multiple timesteps")
    print("""
# Prefetch different timesteps as needed
data_source.prefetch_data(assets, timestep="minute")  # For intraday signals
data_source.prefetch_data(assets, timestep="hour")    # For trend analysis
data_source.prefetch_data(assets, timestep="day")     # For position sizing
    """)


def performance_comparison():
    """Show performance improvement expectations"""
    print("\n=== Performance Comparison ===")
    print()
    
    print("BEFORE optimization:")
    print("⏱️  Backtest time: 45 minutes")
    print("📊 Log lines: 15,000+")
    print("🌐 API calls: 2,500+")
    print("💾 Cache checks: 5,000+")
    print()
    
    print("AFTER optimization:")
    print("⏱️  Backtest time: 8 minutes (5.6x faster)")
    print("📊 Log lines: 50 (300x fewer)")
    print("🌐 API calls: 5 (500x fewer)")
    print("💾 Cache checks: 0 (eliminated)")
    print()
    
    print("KEY IMPROVEMENTS:")
    print("✅ Faster execution due to eliminated redundant work")
    print("✅ Cleaner logs focused on strategy logic")
    print("✅ Reduced API usage and costs")
    print("✅ Better debugging experience")


if __name__ == "__main__":
    demonstrate_prefetch_optimization()
    show_usage_patterns()
    performance_comparison()

```

### Core Architecture Module: `examples/projectx_example.py`
```
"""
ProjectX Example Strategy for Lumibot

This example demonstrates how to use the ProjectX broker integration
for futures trading with Lumibot. ProjectX supports multiple underlying
futures brokers (TSX, TOPONE, etc.) through a unified API.

Environment Variables Required:
- PROJECTX_FIRM: Broker name (e.g., "TSX", "TOPONE")
- PROJECTX_API_KEY: Your API key for the broker
- PROJECTX_USERNAME: Your username for the broker  
- PROJECTX_BASE_URL: Base URL for the broker API
- PROJECTX_PREFERRED_ACCOUNT_NAME: (Optional) Preferred account name

Example .env file:
PROJECTX_FIRM=TSX
PROJECTX_API_KEY=your_api_key_here
PROJECTX_USERNAME=your_username_here
PROJECTX_BASE_URL=https://api.yourbroker.com
PROJECTX_PREFERRED_ACCOUNT_NAME=Practice-Account-1
"""

import logging

from lumibot.brokers import ProjectX
from lumibot.data_sources import ProjectXData
from lumibot.entities import Asset
from lumibot.strategies import Strategy


class ProjectXFuturesStrategy(Strategy):
    """
    Example strategy using ProjectX broker for futures trading.
    
    This strategy demonstrates:
    - Connecting to ProjectX broker
    - Creating futures assets
    - Placing market and limit orders
    - Managing positions
    - Getting market data
    """
    
    # Strategy parameters
    parameters = {
        "symbol": "ES",  # E-mini S&P 500 futures
        "quantity": 1,   # Number of contracts to trade
        "take_profit_percent": 0.02,  # 2% take profit
        "stop_loss_percent": 0.01,    # 1% stop loss
        "lookback_period": 20,        # Lookback period for moving average
    }
    
    def initialize(self):
        """Initialize the strategy."""
        # Set trading frequency
        self.sleeptime = "1M"  # Check every minute
        
        # Create the futures asset
        self.asset = Asset(self.parameters["symbol"], asset_type="future")
        
        # Track our position
        self.position_size = 0
        self.entry_price = None
        
        # Track moving average for trend
        self.price_history = []
        
        logging.info(f"Initialized ProjectX strategy for {self.parameters['symbol']}")
    
    def on_trading_iteration(self):
        """Main trading logic executed each iteration."""
        try:
            # Get current price
            current_price = self.get_last_price(self.asset)
            if current_price is None:
                self.log_message("Could not get current price, skipping iteration")
                return
            
            # Update price history for moving average calculation
            self.price_history.append(current_price)
            if len(self.price_history) > self.parameters["lookback_period"]:
                self.price_history.pop(0)
            
            # Calculate moving average if we have enough data
            if len(self.price_history) >= self.parameters["lookback_period"]:
                moving_average = sum(self.price_history) / len(self.price_history)
                
                # Get current position
                position = self.get_position(self.asset)
                current_quantity = int(position.quantity) if position else 0
                
                self.log_message(f"Current price: {current_price:.2f}, MA: {moving_average:.2f}, Position: {current_quantity}")
                
                # Trading logic
                if current_quantity == 0:
                    # No position - look for entry signals
                    if current_price > moving_average:
                        # Price above MA - go long
                        self.log_message(f"Price above MA, going long {self.parameters['quantity']} contracts")
                        self._enter_long_position(current_price)
                    elif current_price < moving_average:
                        # Price below MA - go short
                        self.log_message(f"Price below MA, going short {self.parameters['quantity']} contracts")
                        self._enter_short_position(current_price)
                
                elif current_quantity > 0:
                    # Long position - check exit conditions
                    if self.entry_price:
                        profit_pct = (current_price - self.entry_price) / self.entry_price
                        
                        if profit_pct >= self.parameters["take_profit_percent"]:
                            self.log_message(f"Take profit triggered: {profit_pct:.2%}")
                            self._close_position()
                        elif profit_pct <= -self.parameters["stop_loss_percent"]:
                            self.log_message(f"Stop loss triggered: {profit_pct:.2%}")
                            self._close_position()
                        elif current_price < moving_average:
                            self.log_message("Price below MA, closing long position")
                            self._close_position()
                
                elif current_quantity < 0:
                    # Short position - check exit conditions
                    if self.entry_price:
                        profit_pct = (self.entry_price - current_price) / self.entry_price
                        
                        if profit_pct >= self.parameters["take_profit_percent"]:
                            self.log_message(f"Take profit triggered: {profit_pct:.2%}")
                            self._close_position()
                        elif profit_pct <= -self.parameters["stop_loss_percent"]:
                            self.log_message(f"Stop loss triggered: {profit_pct:.2%}")
                            self._close_position()
                        elif current_price > moving_average:
                            self.log_message("Price above MA, closing short position")
                            self._close_position()
            
            else:
                self.log_message(f"Building price history: {len(self.price_history)}/{self.parameters['lookback_period']}")
        
        except Exception as e:
            self.log_message(f"Error in trading iteration: {e}")
    
    def _enter_long_position(self, current_price):
        """Enter a long position."""
        order = self.create_order(
            asset=self.asset,
            quantity=self.parameters["quantity"],
            side="buy",
            type="market"
        )
        self.submit_order(order)
        self.entry_price = current_price
    
    def _enter_short_position(self, current_price):
        """Enter a short position."""
        order = self.create_order(
            asset=self.asset,
            quantity=self.parameters["quantity"],
            side="sell",
            type="market"
        )
        self.submit_order(order)
        self.entry_price = current_price
    
    def _close_position(self):
        """Close the current position."""
        position = self.get_position(self.asset)
        if position and position.quantity != 0:
            # Determine the side to close the position
            side = "sell" if position.quantity > 0 else "buy"
            quantity = abs(int(position.quantity))
            
            order = self.create_order(
                asset=self.asset,
                quantity=quantity,
                side=side,
                type="market"
            )
            self.submit_order(order)
            self.entry_price = None
    
    def on_abrupt_closing(self):
        """Handle strategy shutdown."""
        self.log_message("Strategy shutting down, closing any open positions")
        self._close_position()


def main():
    """
    Run the ProjectX futures trading strategy.
    
    Make sure you have set up your environment variables:
    - PROJECTX_FIRM
    - PROJECTX_API_KEY  
    - PROJECTX_USERNAME
    - PROJECTX_BASE_URL
    - PROJECTX_PREFERRED_ACCOUNT_NAME (optional)
    """
    # Create ProjectX data source first
    data_source = ProjectXData()
    
    # Create ProjectX broke
```

### Core Architecture Module: `lumibot/__init__.py`
```
import os
import re
import sys
import types
from importlib.machinery import ModuleSpec, PathFinder

_SETUP_VERSION_RE = re.compile(r"^\s*version\s*=\s*(['\"])(?P<version>.+?)\1\s*,?\s*$")


def _read_version_from_setup_py() -> str | None:
    """Best-effort: when running from a source checkout via PYTHONPATH, prefer setup.py's version.

    This avoids the common confusion where importlib.metadata returns the *installed* wheel
    version (e.g. 4.4.16) while the runtime is actually importing source (e.g. 4.4.18).
    """

    try:
        current = os.path.dirname(os.path.abspath(__file__))
        while True:
            setup_py = os.path.join(current, "setup.py")
            if os.path.isfile(setup_py):
                with open(setup_py, encoding="utf-8", errors="ignore") as file:
                    for line in file:
                        match = _SETUP_VERSION_RE.match(line)
                        if match:
                            return match.group("version").strip()
            parent = os.path.dirname(current)
            if parent == current:
                break
            current = parent
    except Exception:
        pass
    return None


# Get and display the version
try:
    __version__ = _read_version_from_setup_py()
    if __version__ is None:
        from importlib.metadata import version

        __version__ = version("lumibot")
except ImportError:
    # Fallback for Python < 3.8
    try:
        import pkg_resources
        __version__ = pkg_resources.get_distribution("lumibot").version
    except:
        __version__ = "unknown"
except:
    __version__ = "unknown"


_LOG_LEVELS = {
    "CRITICAL": 50,
    "FATAL": 50,
    "ERROR": 40,
    "WARNING": 30,
    "WARN": 30,
    "INFO": 20,
    "DEBUG": 10,
    "NOTSET": 0,
}


def _log_startup_version() -> None:
    level_name = os.environ.get("LUMIBOT_LOG_LEVEL", "INFO").upper()
    if _LOG_LEVELS.get(level_name, 20) > 20:
        return

    import logging

    level = getattr(logging, level_name, logging.INFO)
    logger = logging.getLogger("lumibot")
    logger.setLevel(level)

    console_handlers = [
        handler
        for handler in logger.handlers
        if isinstance(handler, logging.StreamHandler) and not isinstance(handler, logging.FileHandler)
    ]
    if not console_handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
        logger.addHandler(handler)
        console_handlers = [handler]

    for handler in console_handlers:
        handler.setLevel(level)
        if handler.formatter is None:
            handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))

    logger.info(f"LumiBot v{__version__} starting")


_log_startup_version()

# Get the major and minor Python version
major, minor = sys.version_info[:2]

# Check if Python version is less than 3.10
if (major, minor) < (3, 10):
    import warnings

    warnings.warn("Lumibot requires Python 3.10 or higher.", RuntimeWarning)

# SOURCE PATH
LUMIBOT_SOURCE_PATH = os.path.dirname(os.path.abspath(__file__))
LUMIBOT_DEFAULT_TIMEZONE = "America/New_York"
LUMIBOT_DEFAULT_QUOTE_ASSET_SYMBOL = "USD"
LUMIBOT_DEFAULT_QUOTE_ASSET_TYPE = "forex"


def _default_cache_folder() -> str:
    env_value = os.environ.get("LUMIBOT_CACHE_FOLDER")
    if env_value:
        return env_value
    if sys.platform == "darwin":
        return os.path.expanduser("~/Library/Caches/lumibot/1.0")
    if os.name == "nt":
        root = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~\\AppData\\Local")
        return os.path.join(root, "LumiWealth", "lumibot", "Cache", "1.0")
    root = os.environ.get("XDG_CACHE_HOME") or os.path.expanduser("~/.cache")
    return os.path.join(root, "lumibot", "1.0")


LUMIBOT_CACHE_FOLDER = _default_cache_folder()

# Ensure cache folder exists
if not os.path.exists(LUMIBOT_CACHE_FOLDER):
    try:
        os.makedirs(LUMIBOT_CACHE_FOLDER)
    except Exception as e:
        import warnings

        warnings.warn(
            f"""Could not create cache folder because of the following error:
            {e}. Please fix the issue to use data caching."""
        )

_SUBMODULE_EXPORTS = {
    "strategies",
    "brokers",
    "backtesting",
    "entities",
    "data_sources",
    "traders",
    "tools",
    "components",
    "constants",
    "credentials",
    "trading_builtins",
}


class _EntitiesAliasLoader:
    def create_module(self, spec):
        return None

    def exec_module(self, module):
        load = module.__dict__.get("_load")
        if load is not None:
            load()


_ENTITIES_ALIAS_LOADER = _EntitiesAliasLoader()


class _EntitiesAliasFinder:
    _lumibot_entities_alias_finder = True

    def find_spec(self, fullname, path=None, target=None):
        if fullname in _ENTITY_SUBMODULE_ALIAS_NAMES:
            return ModuleSpec(fullname, _ENTITIES_ALIAS_LOADER, is_package=False)
        if fullname == "entities":
            spec = ModuleSpec(fullname, _ENTITIES_ALIAS_LOADER, is_package=True)
            spec.submodule_search_locations = _EntitiesAlias.__path__
            return spec
        return None


class _EntitiesAlias(types.ModuleType):
    _lumibot_entities_alias = True
    __path__ = [os.path.join(os.path.dirname(os.path.abspath(__file__)), "entities")]
    __file__ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "entities", "__init__.py")
    __package__ = "entities"

    def __init__(self, name: str):
        super().__init__(name)
        self.__spec__ = ModuleSpec(name, _ENTITIES_ALIAS_LOADER, is_package=True)
        self.__spec__.submodule_search_locations = self.__path__

    def __getattr__(self, name):
        import importlib

        entities_module = importlib.import_module("lumibot.entities")
        if name in getattr(entities_module, "__all__", ()):
            value = getattr(entities_module, name)
            setattr(self, name, value)
            return value

        alias = sys.modules.get(f"entities.{name}")
        if alias is not None:
            return alias

        try:
            module = importlib.import_module(f"lumibot.entities.{name}")
            sys.modules[f"entities.{name}"] = module
        except ModuleNotFoundError:
            module = importlib.import_module(f"entities.{name}")
        return module


class _EntitiesSubmoduleAlias(types.ModuleType):
    def __init__(self, alias_name: str, target_name: str):
        super().__init__(alias_name)
        self.__package__ = "entities"
        self.__spec__ = ModuleSpec(alias_name, _ENTITIES_ALIAS_LOADER, is_package=False)
        self._target_name = target_name
        self._target_module = None

    def _load(self):
        import importlib

        module = self._target_module
        if module is None:
            module = importlib.import_module(self._target_name)
            self._target_module = module
        return module

    def __getattr__(self, name):
        return getattr(self._load(), name)

    def __dir__(self):
        return dir(self._load())


_ENTITY_SUBMODULES = (
    "asset",
    "bar",
    "bars",
    "cash_event",
    "chains",
    "data",
    "data_polars",
    "dataline",
    "order",
    "position",
    "quote",
    "trading_fee",
    "trading_slippage",
    "smart_limit",
)
_ENTITY_SUBMODULE_ALIAS_NAMES = {f"entities.{_submodule}" for _submodule in _ENTITY_SUBMODULES}


def _has_entities_alias_finder() -> bool:
    return any(getattr(_finder, "_lumibot_entities_alias_finder", False) for _finder in sys.meta_path)


def _entities_package_exists() -> bool:
    existing = sys.modules.get("entities")
    if existing is not None and not getattr(existing, "_lumibot_entities_alias", False):
        return True
    if _has_entities_alias_finder():
        return False
    try:
        return PathFinder.find_spec("entities") is not None
    except (ImportError, AttributeError, ValueError):
        return False


if not
```

### Core Architecture Module: `lumibot/__main__.py`
```
"""Allow `python -m lumibot` to reach the command line interface."""

from lumibot.cli import main

if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `lumibot/_lazy_imports.py`
```
"""Small lazy import helpers for startup-sensitive modules."""

from importlib import import_module
import os
import sys
from types import ModuleType


class LazyModule(ModuleType):
    """Module-like proxy that imports the target module on first real use."""

    def __init__(self, module_name: str):
        super().__init__(module_name)
        super().__setattr__("_module_name", module_name)
        super().__setattr__("_module", None)

    def _load(self):
        module = super().__getattribute__("_module")
        if module is None:
            module = import_module(super().__getattribute__("_module_name"))
            super().__setattr__("_module", module)
        return module

    def __getattr__(self, name):
        return getattr(self._load(), name)

    def __setattr__(self, name, value):
        if name in {"_module_name", "_module"}:
            super().__setattr__(name, value)
            return
        setattr(self._load(), name, value)

    def __delattr__(self, name):
        if name in {"_module_name", "_module"}:
            super().__delattr__(name)
            return
        delattr(self._load(), name)

    def __dir__(self):
        return dir(self._load())


class LazyClassMeta(type):
    """Class-like proxy that imports a target class on first construction/use."""

    def __new__(mcls, name, bases, namespace, **kwargs):
        resolved_bases = []
        changed = False
        for base in bases:
            if isinstance(base, LazyClassMeta) and "_module_name" in base.__dict__:
                resolved_bases.append(base._load())
                changed = True
            else:
                resolved_bases.append(base)

        if changed:
            return type(name, tuple(resolved_bases), dict(namespace))
        return super().__new__(mcls, name, bases, namespace, **kwargs)

    def _load(cls):
        target_class = type.__getattribute__(cls, "_target_class")
        if target_class is None:
            module = import_module(type.__getattribute__(cls, "_module_name"))
            target_class = getattr(module, type.__getattribute__(cls, "_class_name"))
            type.__setattr__(cls, "_target_class", target_class)
        return target_class

    def __call__(cls, *args, **kwargs):
        return cls._load()(*args, **kwargs)

    @property
    def __signature__(cls):
        import inspect

        return inspect.signature(cls._load())

    def __getattr__(cls, name):
        return getattr(cls._load(), name)

    def __instancecheck__(cls, instance):
        target_class = type.__getattribute__(cls, "_target_class")
        if target_class is None:
            target_class = cls._load()
        return isinstance(instance, target_class)

    def __subclasscheck__(cls, subclass):
        target_class = type.__getattribute__(cls, "_target_class")
        if target_class is None:
            target_class = cls._load()
        return issubclass(subclass, target_class)

    def __dir__(cls):
        return dir(cls._load())

    def __repr__(cls):
        target_class = type.__getattribute__(cls, "_target_class")
        if target_class is not None:
            return repr(target_class)
        return f"<lazy class {type.__getattribute__(cls, '_module_name')}.{type.__getattribute__(cls, '_class_name')}>"


def lazy_class(module_name: str, class_name: str):
    """Return a class-like lazy proxy for a target class."""

    return LazyClassMeta(
        class_name,
        (),
        {
            "__module__": module_name,
            "__doc__": f"Lazy proxy for {module_name}.{class_name}.",
            "_module_name": module_name,
            "_class_name": class_name,
            "_target_class": None,
        },
    )


class LazyTypingName:
    """Proxy for typing names used by stringified annotations."""

    __slots__ = ("_name", "_value")

    def __init__(self, name: str):
        self._name = name
        self._value = None

    def _load(self):
        value = self._value
        if value is None:
            import typing

            value = getattr(typing, self._name)
            self._value = value
        return value

    def __getitem__(self, item):
        return self._load()[item]

    def __getattr__(self, name):
        return getattr(self._load(), name)

    def __call__(self, *args, **kwargs):
        return self._load()(*args, **kwargs)

    def __or__(self, other):
        return self._load() | other

    def __ror__(self, other):
        return other | self._load()

    def __repr__(self):
        return f"<lazy typing.{self._name}>"


def lazy_typing(name: str):
    """Return a lazy proxy for a typing module export."""

    return LazyTypingName(name)


_LOG_LEVELS = {
    "CRITICAL": 50,
    "FATAL": 50,
    "ERROR": 40,
    "WARNING": 30,
    "WARN": 30,
    "INFO": 20,
    "DEBUG": 10,
    "NOTSET": 0,
}


def _configured_log_level() -> int:
    return _LOG_LEVELS.get(os.environ.get("LUMIBOT_LOG_LEVEL", "INFO").upper(), 20)


class LazyLogger:
    """Logger proxy that imports LumiBot logging only when a message should emit."""

    __slots__ = ("_name", "_logger", "__dict__")

    def __init__(self, name: str):
        self._name = name
        self._logger = None

    def _load(self):
        if self._logger is None:
            from lumibot.tools.lumibot_logger import get_logger

            self._logger = get_logger(self._name)
        return self._logger

    def _log(self, level: int, method: str, *args, **kwargs):
        if self._logger is not None or "lumibot.tools.lumibot_logger" in sys.modules or level >= _configured_log_level():
            getattr(self._load(), method)(*args, **kwargs)

    def debug(self, *args, **kwargs):
        self._log(10, "debug", *args, **kwargs)

    def info(self, *args, **kwargs):
        self._log(20, "info", *args, **kwargs)

    def warning(self, *args, **kwargs):
        self._log(30, "warning", *args, **kwargs)

    def error(self, *args, **kwargs):
        self._log(40, "error", *args, **kwargs)

    def exception(self, *args, **kwargs):
        kwargs.setdefault("exc_info", True)
        self.error(*args, **kwargs)

    def isEnabledFor(self, level: int):
        if self._logger is not None or "lumibot.tools.lumibot_logger" in sys.modules:
            return self._load().isEnabledFor(level)
        return level >= _configured_log_level()

    def __getattr__(self, name):
        return getattr(self._load(), name)


class LazyStrategyLogger:
    """Strategy logger proxy that defers LumiBot logger imports until first emitted message."""

    __slots__ = ("_name", "_strategy_name", "_logger", "__dict__")

    def __init__(self, name: str, strategy_name: str):
        self._name = name
        self._strategy_name = strategy_name
        self._logger = None

    def _load(self):
        if self._logger is None:
            from lumibot.tools.lumibot_logger import get_strategy_logger

            self._logger = get_strategy_logger(self._name, self._strategy_name)
        return self._logger

    def _log(self, level: int, method: str, *args, **kwargs):
        if self._logger is not None or "lumibot.tools.lumibot_logger" in sys.modules or level >= _configured_log_level():
            getattr(self._load(), method)(*args, **kwargs)

    def debug(self, *args, **kwargs):
        self._log(10, "debug", *args, **kwargs)

    def info(self, *args, **kwargs):
        self._log(20, "info", *args, **kwargs)

    def warning(self, *args, **kwargs):
        self._log(30, "warning", *args, **kwargs)

    def error(self, *args, **kwargs):
        self._log(40, "error", *args, **kwargs)

    def exception(self, *args, **kwargs):
        kwargs.setdefault("exc_info", True)
        self.error(*args, **kwargs)

    def isEnabledFor(self, level: int):
        if self._logger is not None or "lumibot.tools.lumibot_logger" in sys.modules:
            return self._load().isEnabledFor(level)
        return level >= _configured_log_level()

    def update_strategy_name(se
```

### Core Architecture Module: `lumibot/_lazy_timezone.py`
```
"""Lazy timezone helpers for startup-sensitive modules."""

from datetime import tzinfo


class LazyPytzTimezone(tzinfo):
    """tzinfo proxy that imports pytz and builds the timezone on first use."""

    __isabstractmethod__ = False

    def __init__(self, timezone_name: str):
        self._timezone_name = timezone_name
        self._timezone = None

    def _load(self):
        if self._timezone is None:
            import pytz

            self._timezone = pytz.timezone(self._timezone_name)
        return self._timezone

    @property
    def zone(self):
        return self._timezone_name

    @property
    def key(self):
        return self._timezone_name

    def utcoffset(self, dt):
        timezone = self._load()
        if dt is not None and dt.tzinfo is self:
            dt = dt.replace(tzinfo=timezone)
        return timezone.utcoffset(dt)

    def dst(self, dt):
        timezone = self._load()
        if dt is not None and dt.tzinfo is self:
            dt = dt.replace(tzinfo=timezone)
        return timezone.dst(dt)

    def tzname(self, dt):
        timezone = self._load()
        if dt is not None and dt.tzinfo is self:
            dt = dt.replace(tzinfo=timezone)
        return timezone.tzname(dt)

    def fromutc(self, dt):
        timezone = self._load()
        if dt.tzinfo is self:
            dt = dt.replace(tzinfo=timezone)
        return timezone.fromutc(dt)

    def localize(self, *args, **kwargs):
        return self._load().localize(*args, **kwargs)

    def normalize(self, *args, **kwargs):
        return self._load().normalize(*args, **kwargs)

    @property
    def __class__(self):
        return self._load().__class__

    def __str__(self):
        return str(self._load())

    def __repr__(self):
        return repr(self._load())

    def __eq__(self, other):
        if isinstance(other, LazyPytzTimezone):
            other = other._load()
        return self._load() == other

    def __hash__(self):
        return hash(self._load())

    def __getattr__(self, name):
        return getattr(self._load(), name)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1171** (2026-09-13): **Preserve newer broker positions during overlapping refreshes**
  *Symptoms*: Background polling and strategy position reads can finish out of order. An older response could delete a position refreshed by a newer read, revert its quantity, or resurrect a closed position.  Sequence shared broker reads and apply their results under the tracker lock. Ignore responses older than the latest successfully applied request. Keep network I/O outside the lock, preserve new-fill fields and ownership as well as pruning protection, and allow older success when a newer request fails.  Validation: 125 related tests pass, including five deterministic threaded cases through the real Bitunix client and public Strategy accessor with intercepted transport; the original race failed before the fix. A separate red regression confirmed stale same-asset updates overwrote newly streamed position fields; it now verifies preservation and reconciliation on the next fresh snapshot. Covers shared tracking, Schwab and cloud snapshots. Test lint/format, changed-line public hygiene and focused Sphinx content build pass. The shared broker has 12 unchanged baseline lint findings.  Targets the active 4.5.92 source branch. Package publication and downstream runtime recovery remain separate; no live orders or customer deployment changes.   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  - **Bug Fixes**   - Improved broker position refresh reliability when multiple updates overlap.   - Newer position data now takes precedence over older, d
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Lumiwealth/lumibot/pull/1171#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/Lumiwealth/lumibot/pull/1171#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Path: .coderabbit.yaml  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `c81f690c-2753-41a2-bb00-7e81bb38984c`  </detail
  > @coderabbitai review
  > <!-- This is an auto-generated reply by CodeRabbit --> <!-- CodeRabbit review command invocation: v2:657de77e950c2be7baa30147dcb93376ae9728982d478eb361feaa0c754c9eb8 --> <details> <summary>✅ Action performed</summary>  Review finished.  > Note: CodeRabbit is an incremental review system and does not re-review already reviewed commits. This command is applicable only when automatic reviews are paused.  </details>

- **Issue #1170** (2026-09-13): **Preserve broker positions across failed snapshot refreshes**
  *Symptoms*: A failed Bitunix position read was returned as an empty or partial snapshot, allowing shared synchronization to erase known positions. Reject unreadable snapshots atomically with `LumibotBrokerAPIError`, preserve tracked state, and allow the next refresh to retry. Successful empty snapshots now remove every stale non-cash position by iterating a stable copy instead of mutating the traversed list.  Validation: 123 focused tests pass, including the real Bitunix client/broker path with intercepted transport, public Strategy position reads, polling failure/recovery, malformed rows, long/short signs, cash preservation, concurrent-fill protection, and rejection of ambiguous same-symbol active positions. Initial regressions: 16 failures and 4 passes. Review added three failing duplicate-position cases, now passing; zero-quantity rows remain supported. Changed Bitunix code and new tests pass Ruff F/I; shared broker's nine existing annotation diagnostics are identical to baseline. Focused Sphinx content build and public leak check pass.  No exchange orders, live account reads, package publication, or downstream deployment. This repairs source behavior; it does not establish a historical incident's cause or prove deployed recovery. Target is the existing active version branch; its separate release PR remains unchanged.   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Bug Fixes**   * Bitunix position updates now preserve tracked
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Lumiwealth/lumibot/pull/1170#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/Lumiwealth/lumibot/pull/1170#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Path: .coderabbit.yaml  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `41afb754-31c3-43af-9f4a-48cf62ec0a54`  </detail
  > @coderabbitai review 
  > <!-- This is an auto-generated reply by CodeRabbit --> <!-- CodeRabbit review command invocation: v2:e96c8c10ac2185d4404bb2447e34c88ce4fc8bfdac24aa4619ea5c41a4b03bfe --> <details> <summary>⚠️ Action not completed</summary>  Head commit changed.  > Note: CodeRabbit is an incremental review system and does not re-review already reviewed commits. This command is applicable only when automatic reviews are paused.  </details>

- **Issue #1169** (2026-09-12): **fix: preserve strategy assets across variable backups**
  *Symptoms*: ## Problem  Strategy variable backups turn `Asset` instances into plain dictionaries. After a restart, `get_position()` and `add_ohlc()` reject those values. The new persistence regressions reproduce this through both scheduled files and SQLite.  ## Change  Preserve `Asset` type through the shared tagged backup codec and use that codec for both persistence backends. Nested instruments, option underlyings, leverage, and precision survive restarts. Ordinary dictionaries, including literal type-envelope shapes, are escaped and restored unchanged. Malformed typed state fails before partial restoration. Serialization errors stay inside the backup error boundary and preserve prior stored state.  ## Validation  Seven initial regressions fail before the repair; six additional cases reproduce the review findings before their fixes. Final validation after integrating the current version branch: 56 focused tests pass, zero fail or skip:  ```sh LUMIBOT_DISABLE_DOTENV=1 PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=. python -m pytest tests/test_strategy_asset_backup.py tests/test_scheduled_run_once.py tests/test_position_serialization.py tests/test_order_serialization.py -q -p no:cacheprovider --tb=short python -m ruff check --select F,I lumibot/strategies/_strategy.py tests/test_strategy_asset_backup.py python scripts/check_public_repo_hygiene.py --diff-range origin/version/4.5.92...HEAD git diff --check ```  All checks above pass. The changed public documentation page also passes a focused Sphin
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Lumiwealth/lumibot/pull/1169#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/Lumiwealth/lumibot/pull/1169#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Path: .coderabbit.yaml  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `d50df165-8eac-4f2d-bcf9-d0efbd7ee4c2`  </detail
  > @coderabbitai review
  > <!-- This is an auto-generated reply by CodeRabbit --> <!-- CodeRabbit review command invocation: v2:86999287eaa1d8b6fe52283e2cf48e2973d23ae964db0a516d00b3cbdcbed755 --> <details> <summary>✅ Action performed</summary>  Review finished.  > Note: CodeRabbit is an incremental review system and does not re-review already reviewed commits. This command is applicable only when automatic reviews are paused.  </details>

- **Issue #270** (2023-08-22): **Backtest: Polygion.io “Official” Library | RESTClient**
  *Symptoms*: Body of Issue: The ‘unsupported’ client gives only single response within many of the different asset traded helper functions, where as the ‘supported’ RESTClient has opportunities to return a list of said attributes.  Documentation References: Below are the code locations to check for updates on the ‘unsupported’ polygon library to the official ‘supported’ polygon library, which also can use the RESTClient.   ‘unsupported’ - ReadTheDocs: https://polygon.readthedocs.io/en/latest/Options.html 'supported' - ReadTheDocs: https://polygon-api-client.readthedocs.io/en/latest/index.html ‘supported’ - Polygon Website: https://polygon.io/docs/options/getting-started ‘supported’ - GitHub: https://github.com/polygon-io/client-python  Lumibot Files: polygon_backtesting.py 1.	get_chains (from interactive_brokers.py)         a.	Opportunity to remove the “SMART” from get_chains dictionary (TBD). 2.	get_expiration (from interactive_brokers.py) 3.     get_strikes (not in interactive_brokers.py)         a.      This could be a low effort add  polygon_helper.py 1.	get_price_data_from_polygon         a.	should not require updates 2.	get_full_range_aggregate_bars         a.	should not require updates 5.	Polygon API KEY         a.	Replace the ‘unsupported’ api function/key with the ‘supported’ api function.         b.	‘unsupported’:                  i.	polygon.CryptoClient; polygon.StocksClient; polygon.ForexClient; polygon.OptionsClient         c.	‘supported’:        

- **Issue #129** (2022-02-10): **Test commit**
  *Symptoms*: Test pull request

- **Issue #127** (2022-02-10): **Code correction: IB Positions returning 0 quantity.**
  *Symptoms*: Interactive Brokers will return positions with zero quantity. This carries through to Lumibot and `self.get_positions` will return assets with `0` quantity, which can lead to errors in the user bot if `len(self.get_positions)` is used.  List comprehension added to IB to remove positions with '0' quantity.  Black formatter did some minor formatting.  2nd commit:  In `_parse_broker_order` in InteractiveBrokers, the existing incorrect code is trying to use `DATE_MAP` using IB code eg: `OPT`. Needs to use lumibot's `option` which is take from the `TYPE_MAP` dictionary. 

- **Issue #125** (2022-01-14): **Improving on the migration of name and budget to positional arguments.**
  *Symptoms*: Adding in better handling for positional and kwargs to migrate the strategy and budget to keyword arguments.  Minor change to update fasttrading.  Since it is now possible our users can have variable number of args, we can attempt to catch them and handle them instead of always throwing errors.

- **Issue #124** (2022-01-13): **Positional error, strategy name and budget and pandas Attribute Error.**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ## Catching backtest positional arguments error, strategy name and budget. Error being thrown when user uses the old method of passing in the strategy name and budget as positional arguments.  This results in an AttributeError for the backtesting_start date.  This commit catches the error and returns a message instructing the user to change the `name` and `budget` positional arguments to keyword arguments.  ## PandasDataBacktesting bug, attribute not found error, reverting changed code.  A change made to PandasDataBacktesting Class that created a bug in the pandas backtesting, resulting in attributes not found. Not sure what the change was about.  Here is the original: ``` class PandasDataBacktesting(DataSourceBacktesting, PandasData):     def __init__(self, datetime_start, datetime_end, pandas_data=None, **kwargs):         self.LIVE_DATA_SOURCE = PandasData         PandasData.__init__(self, pandas_data, **kwargs)         DataSourceBacktesting.__init__(self, datetime_s
  > All tests are passing now. 
  > One final check on that method I deleted. I searched the online docs for `get_data` and it's not in the docs. 

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

### Incident Patch 1: `b623a692` (2026-09-26)
**Commit Message**: fix(data): quotes keep the data's price precision

Data.get_quote and DataPolars.get_quote rounded open, high, low, close, bid
and ask to 2 decimals (_DATA_QUOTE_FIELDS / quote_fields). A SHIB quote of
0.00001236 became 0.0, and PandasData.get_quote then dropped it as
non-positive, so sub-cent crypto had no quote at all. Same class as the
Order.avg_fill_price fix fa631fb8. Price fields now keep full precision;
volume and size fields keep their existing integer rounding.

Red first: tests/test_data_entity.py::test_quote_keeps_sub_cent_crypto_prices
(pandas and polars: 0.0 != 1.236e-05). Guard:
::test_stock_quote_values_are_unchanged_by_keeping_precision (2-decimal stock
quote values identical).

Effect on real strategies (warm cache, offline replay; base = 6c1dfb11):
- SEH Simple, Jan 2 to Sep 19: identical (166 fills, trades/stats hashes
  equal, final 110223.18; 147.5 s vs 149.0 s)
- min_mkt: identical (100 fills, 99220.14)

Tests (LUMIBOT_DISABLE_DOTENV_LOCAL=1 LUMIBOT_CACHE_BACKEND=local
LUMIBOT_CACHE_MODE=disabled):
- tests/test_data_entity.py + visibility/forming + polars parity: 49/49
- broad -k (same list as be0df267), acceptance file excluded: 1639 passed,
  26 skipped, 3 x

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 ## 4.6.2 - Unreleased
 
 ### Fixed
+- Backtest quotes keep the data's full price precision. `Data.get_quote()` and `DataPolars.get_quote()` rounded open, high, low, close, bid and ask to 2 decimals, so a sub-cent crypto quote (SHIB near 0.0000124) became 0.0 and was then dropped as non-positive.
 - Intraday backtests no longer see one bar into the future through `get_last_price()` and `get_quote()`. Minute and hour trade bars are stamped at their start (verified for IBKR and ThetaData), so at simulated time T the bar stamped T is still forming and its close is the price at T plus one bar. The ThetaData and BotSpot Auto (routed) data sources returned that close as the last price and quote price, and IBKR/Polygon quotes, whose bid and ask are built from the close, did too, while a market order at T fills at the bar's open. A strategy could see where the minute would close and buy at its open. The price at T is now the forming bar's open (or the last closed bar's close); real quote snapshots (ThetaData NBBO, which is stamped at the snapshot time) are unchanged.
 - Intraday history shows a bar as soon as it has closed, even when no later bar exists yet. After a session close, overnight or across a gap, the last bar stayed hidden until the next bar existed (at 03:00 the newest visible 1-minute bar was 19:58, not 19:59). A bar counts as closed when its start plus its length has passed; the length is at least the nominal step and at least the smallest spacing in the series, so 5-minute bars stored as minute bars and hourly bars after a half-hour first bar never show early.
 - Polygon-routed stocks in `BACKTESTING_DATA_SOURCE` router backtests credit dividends. Polygon bars are split-adjusted only and carry no dividend column, so they got none; they now read dividends from the same free corporate-actions source that enriches IBKR daily bars. Routed dividend lookups now skip futures, crypto and other non-stock assets, which pay no dividends: a held futures or crypto position made the router download daily bars the strategy never asked for.
```

**File**: `docs/investigations/2026-09-25_INTRADAY_LAST_PRICE_LOOKAHEAD.md` (modified, +4/-3)
```diff
@@ -57,7 +57,8 @@ Strategies change only when they decide from `get_last_price()` or `get_quote()`
 `tests/test_data_get_bars_day_includes_latest_completed_bar.py -k forming_bar` (pandas and polars). Red on the code
 before the fix; green after.
 
-## Open
+## Follow-up done
 
-- `Data.get_quote` / `DataPolars.get_quote` round bid, ask, open and close to 2 decimals, so a sub-cent crypto quote
-  becomes 0.0 and is dropped as non-positive (same class as the `Order.avg_fill_price` fix `fa631fb8`).
+- `Data.get_quote` / `DataPolars.get_quote` rounded bid, ask, open and close to 2 decimals, so a sub-cent crypto quote
+  became 0.0 and was dropped as non-positive (same class as the `Order.avg_fill_price` fix `fa631fb8`). Fixed right
+  after this one; SEH Simple and min_mkt unchanged.
```

**File**: `lumibot/entities/data.py` (modified, +8/-6)
```diff
@@ -27,14 +27,16 @@
     "bid_exchange",
     "ask_exchange",
 )
+# Price fields keep the provider's precision (None = no rounding). They were rounded to 2 decimals,
+# so a sub-cent crypto quote (SHIB 0.0000124) became 0.0 and was then dropped as non-positive.
 _DATA_QUOTE_FIELDS = {
-    "open": ("open", 2),
-    "high": ("high", 2),
-    "low": ("low", 2),
-    "close": ("close", 2),
+    "open": ("open", None),
+    "high": ("high", None),
+    "low": ("low", None),
+    "close": ("close", None),
     "volume": ("volume", 0),
-    "bid": ("bid", 2),
-    "ask": ("ask", 2),
+    "bid": ("bid", None),
+    "ask": ("ask", None),
     "bid_size": ("bid_size", 0),
     "bid_condition": ("bid_condition", 0),
     "bid_exchange": ("bid_exchange", 0),
```

**File**: `lumibot/entities/data_polars.py` (modified, +6/-6)
```diff
@@ -503,13 +503,13 @@ def get_quote(self, dt, length=1, timeshift=0):
             return {}
 
         quote_fields = {
-            "open": ("open", 2),
-            "high": ("high", 2),
-            "low": ("low", 2),
-            "close": ("close", 2),
+            "open": ("open", None),
+            "high": ("high", None),
+            "low": ("low", None),
+            "close": ("close", None),
             "volume": ("volume", 0),
-            "bid": ("bid", 2),
-            "ask": ("ask", 2),
+            "bid": ("bid", None),
+            "ask": ("ask", None),
             "bid_size": ("bid_size", 0),
             "bid_condition": ("bid_condition", 0),
             "bid_exchange": ("bid_exchange", 0),
```

**File**: `tests/test_data_entity.py` (modified, +51/-0)
```diff
@@ -483,3 +483,54 @@ def test_get_quote_includes_source_bar_provenance(self):
         assert quote["ask"] == 70512.75
         assert quote["bar_timestamp"] == bar_dt
         assert quote["bar_timestep"] == "minute"
+
+
+def _sub_cent_quote_data(kind: str):
+    """SHIB/USD minute bars with real quotes around $0.0000123 (closed bars at the asked time)."""
+    tz = pytz.timezone("America/New_York")
+    idx = pd.DatetimeIndex([tz.localize(datetime(2026, 9, 15, 10, m)) for m in range(3)], name="datetime")
+    frame = pd.DataFrame(
+        {
+            "open": [0.00001230, 0.00001232, 0.00001234],
+            "high": [0.00001236, 0.00001238, 0.00001240],
+            "low": [0.00001229, 0.00001231, 0.00001233],
+            "close": [0.00001233, 0.00001235, 0.00001237],
+            "volume": [1e9, 1e9, 1e9],
+            "bid": [0.00001232, 0.00001234, 0.00001236],
+            "ask": [0.00001234, 0.00001236, 0.00001238],
+        },
+        index=idx,
+    )
+    asset = Asset("SHIB", asset_type=Asset.AssetType.CRYPTO)
+    quote = Asset("USD", asset_type=Asset.AssetType.FOREX)
+    if kind == "pandas":
+        return Data(asset, frame, timestep="minute", quote=quote), tz
+    import polars as pl
+
+    from lumibot.entities.data_polars import DataPolars
+
+    return DataPolars(asset=asset, df=pl.from_pandas(frame.reset_index()), timestep="minute", quote=quote), tz
+
+
+@pytest.mark.parametrize("kind", ["pandas", "polars"])
+def test_quote_keeps_sub_cent_crypto_prices(kind):
+    """Data.get_quote / DataPolars.get_quote rounded open/high/low/close/bid/ask to 2 decimals, so a
+    SHIB quote of 0.00001236 became 0.0 (and PandasData then dropped it as non-positive)."""
+    data, tz = _sub_cent_quote_data(kind)
+    quote = data.get_quote(tz.localize(datetime(2026, 9, 15, 10, 3)))  # the 10:02 bar has closed
+    assert quote["bid"] == 0.00001236
+    assert quote["ask"] == 0.00001238
+    assert quote["close"] == 0.00001237
+    assert quote["open"] == 0.00001234
+
+
+def test_stock_quote_values_are_unchanged_by_keeping_precision():
+    """Two-decimal stock prices come back exactly as before."""
+    tz = pytz.timezone("America/New_York")
+    idx = pd.DatetimeIndex([tz.localize(datetime(2026, 9, 15, 10, 0)), tz.localize(datetime(2026, 9, 15, 10, 1))])
+    frame = pd.DataFrame({"open": [650.12, 650.2], "high": [650.5, 650.4], "low": [650.0, 650.1],
+                          "close": [650.33, 650.25], "volume": [100.0, 120.0], "bid": [650.32, 650.24],
+                          "ask": [650.34, 650.26]}, index=idx)
+    data = Data(Asset("SPY"), frame, timestep="minute")
+    quote = data.get_quote(tz.localize(datetime(2026, 9, 15, 10, 2)))
+    assert (quote["open"], quote["close"], quote["bid"], quote["ask"]) == (650.2, 650.25, 650.24, 650.26)
```

---

### Incident Patch 2: `be0df267` (2026-09-26)
**Commit Message**: fix(backtesting): no one-bar lookahead in intraday last price and quotes

Minute and hour TRADE bars are stamped at their start. Verified from real
data: SPY 2024-01-30 09:30 has open 490.56 / close 490.92 in both IBKR and
the cached ThetaData minute OHLC, and Theta trade bars run 04:00 to 19:59.
At simulated time T the bar stamped T is still forming; its close is the
price at T plus one bar.

- ThetaDataBacktestingPandas.get_last_price (_resolve_last_trade_close:
  closes.iloc[: iter_count + 1], since d0861e4c / 2025-12) returned that
  close. RoutedBacktestingPandas inherits it, and 4.6.1 (8b6c4523) made
  BotSpot Auto stock quotes use minute bars once loaded, so production
  4.6.1 intraday stock backtests got it.
- Quote.price is the bar close, and IBKR/Polygon history has no quotes, so
  bid/ask were synthesized from that close (Data.get_quote, DataPolars
  .get_quote, and the Theta pandas quote fast path).
- A market order at T fills at the bar's OPEN. End to end (routed IBKR,
  bars open=HHMM, close=HHMM.99): at 10:00 the strategy saw 1000.99 and was
  filled at 1000.00, i.e. it could see where the minute closes and buy at
  its open.

Fix: while the bar at T is forming (bar_

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 ## 4.6.2 - Unreleased
 
 ### Fixed
+- Intraday backtests no longer see one bar into the future through `get_last_price()` and `get_quote()`. Minute and hour trade bars are stamped at their start (verified for IBKR and ThetaData), so at simulated time T the bar stamped T is still forming and its close is the price at T plus one bar. The ThetaData and BotSpot Auto (routed) data sources returned that close as the last price and quote price, and IBKR/Polygon quotes, whose bid and ask are built from the close, did too, while a market order at T fills at the bar's open. A strategy could see where the minute would close and buy at its open. The price at T is now the forming bar's open (or the last closed bar's close); real quote snapshots (ThetaData NBBO, which is stamped at the snapshot time) are unchanged.
 - Intraday history shows a bar as soon as it has closed, even when no later bar exists yet. After a session close, overnight or across a gap, the last bar stayed hidden until the next bar existed (at 03:00 the newest visible 1-minute bar was 19:58, not 19:59). A bar counts as closed when its start plus its length has passed; the length is at least the nominal step and at least the smallest spacing in the series, so 5-minute bars stored as minute bars and hourly bars after a half-hour first bar never show early.
 - Polygon-routed stocks in `BACKTESTING_DATA_SOURCE` router backtests credit dividends. Polygon bars are split-adjusted only and carry no dividend column, so they got none; they now read dividends from the same free corporate-actions source that enriches IBKR daily bars. Routed dividend lookups now skip futures, crypto and other non-stock assets, which pay no dividends: a held futures or crypto position made the router download daily bars the strategy never asked for.
 - Backtests no longer pay a dividend on shares bought on the ex-dividend date. The dividend check runs before every iteration, so a position opened during the ex-date was credited by the next check (a BotSpot Auto backtest bought XBI at 11:31 on its ex-date and was credited $11.32). Only shares held when the day began are entitled.
```

**File**: `lumibot/backtesting/thetadata_backtesting_pandas.py` (modified, +45/-3)
```diff
@@ -2932,12 +2932,42 @@ def _resolve_last_trade_close(key: object) -> Optional[float]:
 
             try:
                 iter_count = data_obj.get_iter_count(dt)
-                closes = close_series.iloc[: iter_count + 1]
+                # Minute/hour bars are stamped at their start. While the bar at dt is still
+                # forming its close is the price one bar later (2026-09-25: at 10:00 this
+                # returned 10:00's close, known at 10:01, while a market order at 10:00 fills at
+                # 10:00's open). Use that bar's open, the price at dt, or the last closed close.
+                state_fn = getattr(data_obj, "_intraday_state_at", None)
+                if callable(state_fn) and state_fn(iter_count, dt) == "forming":
+                    open_series = df.get("open")
+                    bar_open = None
+                    if open_series is not None:
+                        try:
+                            bar_open = float(open_series.iloc[iter_count])
+                        except Exception:
+                            bar_open = None
+                    bar_missing = False
+                    if "missing" in df.columns:
+                        try:
+                            bar_missing = bool(df["missing"].iloc[iter_count])
+                        except Exception:
+                            bar_missing = False
+                    if bar_open is not None and bar_open > 0 and not bar_missing and bar_open == bar_open:
+                        frame_last_dt = df.index[iter_count]
+                        frame_last_close = bar_open
+                        try:
+                            frame_last_dt = frame_last_dt.isoformat()
+                        except AttributeError:
+                            frame_last_dt = str(frame_last_dt)
+                        return float(self._adjust_stale_daily_price_for_stock_split(data_obj, bar_open, dt))
+                    closes = close_series.iloc[:iter_count]
+                else:
+                    closes = close_series.iloc[: iter_count + 1]
                 if "missing" in df.columns:
+                    rows = len(closes)
                     try:
-                        missing_mask = df["missing"].iloc[: iter_count + 1].astype(bool)
+                        missing_mask = df["missing"].iloc[:rows].astype(bool)
                     except Exception:
-                        missing_mask = df["missing"].iloc[: iter_count + 1] == 1
+                        missing_mask = df["missing"].iloc[:rows] == 1
                     closes = closes[~missing_mask.fillna(True)]
             except Exception:
                 # Defensive fallback: filter by timestamp if iter lookup fails.
@@ -3881,6 +3911,18 @@ def _get(column: str):
                 ask_size = _get("ask_size")
                 volume = _get("volume")
 
+                # The bar stamped at dt is still forming: its close is the price one bar later
+                # (2026-09-25). Report its open, the price at dt; bid/ask synthesized from that
+                # close (IBKR/Polygon history) follow it. Real quote snapshots are kept.
+                state_fn = getattr(fast_data, "_intraday_state_at", None)
+                if callable(state_fn) and state_fn(iter_count, dt) == "forming":
+                    bar_open = _get("open")
+                    if bar_open is not None:
+                        if bid == close and ask == close:
+                            bid = bar_open
+                            ask = bar_open
+                        close = bar_open
+
                 # Match PandasData.get_quote(): treat non-positive bid/ask as missing.
                 for side_key, side_val in (("bid", bid), ("ask", ask)):
                     if side_val is None:
```

**File**: `lumibot/entities/data.py` (modified, +55/-21)
```diff
@@ -55,27 +55,26 @@
     pass
 
 
-def _intraday_bar_closed_at(index_ns, i, dt, *, timestep, index_tz, cache_owner) -> bool:
-    """True when the intraday bar at row ``i`` (the last bar at or before ``dt``) has closed by ``dt``.
-
-    Intraday history hides the bar at ``dt``'s row because it may still be forming. When no later
-    bar exists yet (after a session close, overnight, across a gap) that bar may already be
-    complete: the 19:59 bar closes at 20:00, but it stayed hidden until the 04:00 bar existed
-    (release gate 2026-09-25). A bar counts as closed when ``bar_start + length <= dt``, where the
-    length is the larger of the nominal step (1 minute or 1 hour) and the smallest spacing in the
-    series, so 5-minute bars stored as "minute" and hourly bars after a 09:30 half-hour bar are
-    never shown before they close.
+def _intraday_bar_state(index_ns, i, dt, *, timestep, index_tz, cache_owner):
+    """Return "closed", "forming" or None for the intraday bar at row ``i`` at time ``dt``.
+
+    Minute and hour bars are stamped at their start (verified for IBKR and ThetaData trade bars:
+    SPY 2024-01-30 09:30 has open 490.56 and close 490.92 in both). A bar is closed once
+    ``bar_start + length <= dt``; before that its close, high, low and volume are the future.
+    The length is the larger of the nominal step (1 minute or 1 hour) and the most common spacing
+    in the series, so 5-minute bars stored as "minute" and hourly bars after a 09:30 half-hour bar
+    are never treated as closed early. None means not an intraday bar at or before ``dt``.
     """
     nominal_ns = 60_000_000_000 if timestep == "minute" else 3_600_000_000_000 if timestep == "hour" else None
     if nominal_ns is None or index_ns is None:
-        return False
+        return None
     n = len(index_ns)
     try:
         i = int(i)
     except Exception:
-        return False
+        return None
     if i < 0 or i >= n:
-        return False
+        return None
     try:
         ts = pd.Timestamp(dt)
         if ts.tzinfo is None and index_tz is not None:
@@ -84,24 +83,38 @@ def _intraday_bar_closed_at(index_ns, i, dt, *, timestep, index_tz, cache_owner)
             ts = ts.tz_localize(None)
         dt_ns = int(ts.value)
     except Exception:
-        return False
+        return None
     bar_start = int(index_ns[i])
     if bar_start > dt_ns or (i + 1 < n and int(index_ns[i + 1]) <= dt_ns):
-        return False
+        return None
     cached = getattr(cache_owner, "_closed_bar_length_cache", None)
     if cached is None or cached[0] != n or cached[1] != timestep:
         spacing_ns = 0
         if n > 1:
             diffs = np.diff(np.asarray(index_ns, dtype="int64"))
             positive = diffs[diffs > 0]
             if positive.size:
-                spacing_ns = int(positive.min())
+                # Most common spacing: robust to a few odd rows inside 5-minute data and to the
+                # gaps of a sparse 1-minute series.
+                values, counts = np.unique(positive, return_counts=True)
+                spacing_ns = int(values[int(np.argmax(counts))])
         cached = (n, timestep, max(nominal_ns, spacing_ns))
         try:
             cache_owner._closed_bar_length_cache = cached
         except Exception:
             pass
-    return bar_start + cached[2] <= dt_ns
+    return "closed" if bar_start + cached[2] <= dt_ns else "forming"
+
+
+def _intraday_bar_closed_at(index_ns, i, dt, *, timestep, index_tz, cache_owner) -> bool:
+    """True when the intraday bar at row ``i`` (the last bar at or before ``dt``) has closed by ``dt``.
+
+    Intraday history hides the bar at ``dt``'s row because it may still be forming. When no later
+    bar exists yet (after a session close, overnight, across a gap) that bar may already be
+    complete: the 19:59 bar closes at 20:00, but it stayed hidden until the 04:00 bar existed
+    (release gate 2026-09-25). See `_intraday_bar_state` for the bar length 
```

**File**: `lumibot/entities/data_polars.py` (modified, +29/-1)
```diff
@@ -461,13 +461,32 @@ def checker(self, *args, **kwargs):
 
         return checker
 
+    def _intraday_state_at(self, iter_count, dt):
+        """"closed", "forming" or None for the intraday bar at iter_count (see data._intraday_bar_state)."""
+        if self.timestep == "day":
+            return None
+        from lumibot.entities.data import _intraday_bar_state
+
+        try:
+            index = pd.DatetimeIndex(self.iter_index.index)
+        except Exception:
+            return None
+        return _intraday_bar_state(
+            index.asi8, iter_count, dt, timestep=self.timestep, index_tz=index.tz, cache_owner=self
+        )
+
     @check_data
     def get_last_price(self, dt, length=1, timeshift=0) -> Union[float, Decimal, None]:
         """Returns the last known price of the data."""
         iter_count = self.get_iter_count(dt)
         open_price = self.datalines["open"].dataline[iter_count]
         close_price = self.datalines["close"].dataline[iter_count]
-        price = close_price if dt > self.datalines["datetime"].dataline[iter_count] else open_price
+        state = self._intraday_state_at(iter_count, dt)
+        if state is None:
+            price = close_price if dt > self.datalines["datetime"].dataline[iter_count] else open_price
+        else:
+            # A bar stamped at its start is forming until start + length: its close is the future.
+            price = close_price if state == "closed" else open_price
         return price
 
     @check_data
@@ -527,6 +546,15 @@ def _get_value(column: str, round_digits: Optional[int]):
         quote_dict = {
             name: _get_value(column, digits) for name, (column, digits) in quote_fields.items()
         }
+        if self._intraday_state_at(iter_count, dt) == "forming":
+            # Same rule as Data.get_quote: the forming bar's close is the future.
+            open_value = quote_dict.get("open")
+            close_value = quote_dict.get("close")
+            if open_value is not None and not pd.isna(open_value):
+                if quote_dict.get("bid") == close_value and quote_dict.get("ask") == close_value:
+                    quote_dict["bid"] = open_value
+                    quote_dict["ask"] = open_value
+                quote_dict["close"] = open_value
 
         return quote_dict
 
```

**File**: `tests/backtest/test_routed_backtesting_ibkr_prefetch.py` (modified, +126/-0)
```diff
@@ -1516,3 +1516,129 @@ def fake_polygon(*, start, end, **_):
         router._datetime = LUMIBOT_DEFAULT_PYTZ.localize(datetime.fromisoformat(f"{day}T09:30"))
         paid[day] = float(router.get_yesterday_dividends([tlt], quote=quote).get(tlt) or 0.0)
     assert paid == {"2026-06-30": 0.0, "2026-07-01": 0.318, "2026-07-02": 0.0, "2026-08-03": 0.330}
+
+
+# ---------------------------------------------------------------------------
+# One-minute lookahead in last price and quotes (2026-09-25)
+#
+# IBKR and ThetaData stamp minute TRADE bars at their start (verified: SPY 2024-01-30 09:30 has
+# open 490.56 / close 490.92 in both). At simulated time T the bar stamped T is still forming,
+# so its close is the price at T + 1 minute. get_last_price() and IBKR get_quote() (whose
+# bid/ask are synthesized from the close) returned that close, while a market order at T
+# fills at the bar's OPEN: a strategy could see where the minute closes and buy at its open.
+# ---------------------------------------------------------------------------
+
+
+def _hhmm_minute_bars(start_dt: datetime, end_dt: datetime) -> pd.DataFrame:
+    """Extended-hours minute bars whose prices name their bar: open HHMM.00, close HHMM.99."""
+    idx = pd.date_range(pd.Timestamp(start_dt).tz_convert(LUMIBOT_DEFAULT_PYTZ).floor("min"),
+                        pd.Timestamp(end_dt).tz_convert(LUMIBOT_DEFAULT_PYTZ), freq="1min")
+    idx = idx[(idx.dayofweek < 5) & (idx.hour >= 4) & (idx.hour < 20)]
+    hhmm = pd.Series(idx.hour * 100 + idx.minute, index=idx, dtype="float64")
+    frame = pd.DataFrame({"open": hhmm, "high": hhmm + 0.99, "low": hhmm, "close": hhmm + 0.99, "volume": 1000.0}, index=idx)
+    frame["bid"] = frame["close"]  # what ibkr_helper synthesizes when IBKR history has no bid/ask
+    frame["ask"] = frame["close"]
+    return frame
+
+
+def _hhmm_router(monkeypatch):
+    import lumibot.tools.ibkr_helper as ibkr_helper
+
+    monkeypatch.setenv("DATADOWNLOADER_BASE_URL", "http://localhost:8080")
+    monkeypatch.setenv("DATADOWNLOADER_API_KEY", "<redacted>")
+    start = LUMIBOT_DEFAULT_PYTZ.localize(datetime(2026, 9, 14, 0, 0))
+    end = LUMIBOT_DEFAULT_PYTZ.localize(datetime(2026, 9, 19, 0, 0))
+    router = _make_router(start, end, {"default": "ibkr", "stock": "ibkr", "index": "ibkr"})
+
+    def fake_get_price_data(*, asset, quote, timestep, start_dt, end_dt, **_):
+        if timestep == "day":
+            return _daily_ohlc(start_dt, end_dt)
+        return _hhmm_minute_bars(start_dt, end_dt)
+
+    monkeypatch.setattr(ibkr_helper, "get_price_data", fake_get_price_data)
+    asset = Asset("SPY", asset_type=Asset.AssetType.STOCK)
+    quote = Asset("USD", asset_type=Asset.AssetType.FOREX)
+    router._datetime = LUMIBOT_DEFAULT_PYTZ.localize(datetime(2026, 9, 15, 9, 0))
+    router.get_historical_prices(asset, 30, "minute", quote=quote)  # the strategy loaded minute bars
+    return router, asset, quote
+
+
+@pytest.mark.parametrize(
+    "hh, mm, expected",
+    [
+        (10, 0, 1000.00),   # 10:00 bar forming: its open, never its close (1000.99)
+        (10, 1, 1001.00),
+        (15, 59, 1559.00),
+        (20, 0, 1959.99),   # after the close the 19:59 bar has closed: its close
+    ],
+)
+def test_minute_last_price_at_t_never_uses_the_close_of_the_bar_starting_at_t(monkeypatch, no_local_theta_terminal, hh, mm, expected):
+    router, asset, quote = _hhmm_router(monkeypatch)
+    router._datetime = LUMIBOT_DEFAULT_PYTZ.localize(datetime(2026, 9, 15, hh, mm))
+    assert float(router.get_last_price(asset, quote=quote)) == expected
+
+
+@pytest.mark.parametrize("hh, mm, expected", [(10, 0, 1000.00), (15, 59, 1559.00)])
+def test_minute_quote_at_t_never_uses_the_close_of_the_bar_starting_at_t(monkeypatch, no_local_theta_terminal, hh, mm, expected):
+    router, asset, quote = _hhmm_router(monkeypatch)
+    router._datetime = LUMIBOT_DEFAULT_PYTZ.localize(datetime(2026, 9, 15, hh, mm))
+    q = router.get_quote(asset, quote=quote)
+
```

---

### Incident Patch 3: `16ed3345` (2026-09-26)
**Commit Message**: fix(data): a closed intraday bar is visible without waiting for a later bar

Release gate finding (2026-09-25). Intraday Data.get_bars hides the bar at
the simulated time's row because it may still be forming. When no later bar
exists (after a session close, overnight, across a gap) that bar may already
be complete: at 20:00, 20:01 and 03:00 the newest visible 1-minute bar was
19:58 although the 19:59 bar closed at 20:00; it appeared only once the 04:00
bar existed. Same for an hourly 15:00 bar after the 16:00 close.

Data._get_bars_row_bounds / _get_bars_dict and DataPolars._get_bars_dict now
include the bar at iter_count when bar_start + length <= dt, where length =
max(nominal step (1 min / 1 h), smallest spacing in the series). So 5-minute
bars stored with timestep "minute" and hourly bars after a 09:30 half-hour bar
are never shown before they close. Only for timeshift >= 0; negative
timeshift (broker fill reads) keeps its old row math. Daily bars unchanged.

Red first (tests/test_data_get_bars_day_includes_latest_completed_bar.py,
pandas and polars): 10 failed (20:00 and 03:00 showed 19:58; 5-minute gap at
10:05 hid the 10:00 bar; hourly 16:00 and 08:00 hid the 15:00 bar). Th

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 ## 4.6.2 - Unreleased
 
 ### Fixed
+- Intraday history shows a bar as soon as it has closed, even when no later bar exists yet. After a session close, overnight or across a gap, the last bar stayed hidden until the next bar existed (at 03:00 the newest visible 1-minute bar was 19:58, not 19:59). A bar counts as closed when its start plus its length has passed; the length is at least the nominal step and at least the smallest spacing in the series, so 5-minute bars stored as minute bars and hourly bars after a half-hour first bar never show early.
 - Polygon-routed stocks in `BACKTESTING_DATA_SOURCE` router backtests credit dividends. Polygon bars are split-adjusted only and carry no dividend column, so they got none; they now read dividends from the same free corporate-actions source that enriches IBKR daily bars. Routed dividend lookups now skip futures, crypto and other non-stock assets, which pay no dividends: a held futures or crypto position made the router download daily bars the strategy never asked for.
 - Backtests no longer pay a dividend on shares bought on the ex-dividend date. The dividend check runs before every iteration, so a position opened during the ex-date was credited by the next check (a BotSpot Auto backtest bought XBI at 11:31 on its ex-date and was credited $11.32). Only shares held when the day began are entitled.
 - `Order.avg_fill_price` keeps the broker's full precision. Setting it rounded to 2 decimals (the constructor never did), so a sub-cent crypto fill such as 0.0000123 became 0.0, forex and sub-penny option fills moved (1.08765 became 1.09), and live brokers passed the rounded value into fill processing for cash and positions.
```

**File**: `lumibot/entities/data.py` (modified, +73/-2)
```diff
@@ -55,6 +55,55 @@
     pass
 
 
+def _intraday_bar_closed_at(index_ns, i, dt, *, timestep, index_tz, cache_owner) -> bool:
+    """True when the intraday bar at row ``i`` (the last bar at or before ``dt``) has closed by ``dt``.
+
+    Intraday history hides the bar at ``dt``'s row because it may still be forming. When no later
+    bar exists yet (after a session close, overnight, across a gap) that bar may already be
+    complete: the 19:59 bar closes at 20:00, but it stayed hidden until the 04:00 bar existed
+    (release gate 2026-09-25). A bar counts as closed when ``bar_start + length <= dt``, where the
+    length is the larger of the nominal step (1 minute or 1 hour) and the smallest spacing in the
+    series, so 5-minute bars stored as "minute" and hourly bars after a 09:30 half-hour bar are
+    never shown before they close.
+    """
+    nominal_ns = 60_000_000_000 if timestep == "minute" else 3_600_000_000_000 if timestep == "hour" else None
+    if nominal_ns is None or index_ns is None:
+        return False
+    n = len(index_ns)
+    try:
+        i = int(i)
+    except Exception:
+        return False
+    if i < 0 or i >= n:
+        return False
+    try:
+        ts = pd.Timestamp(dt)
+        if ts.tzinfo is None and index_tz is not None:
+            ts = ts.tz_localize(index_tz)
+        elif ts.tzinfo is not None and index_tz is None:
+            ts = ts.tz_localize(None)
+        dt_ns = int(ts.value)
+    except Exception:
+        return False
+    bar_start = int(index_ns[i])
+    if bar_start > dt_ns or (i + 1 < n and int(index_ns[i + 1]) <= dt_ns):
+        return False
+    cached = getattr(cache_owner, "_closed_bar_length_cache", None)
+    if cached is None or cached[0] != n or cached[1] != timestep:
+        spacing_ns = 0
+        if n > 1:
+            diffs = np.diff(np.asarray(index_ns, dtype="int64"))
+            positive = diffs[diffs > 0]
+            if positive.size:
+                spacing_ns = int(positive.min())
+        cached = (n, timestep, max(nominal_ns, spacing_ns))
+        try:
+            cache_owner._closed_bar_length_cache = cached
+        except Exception:
+            pass
+    return bar_start + cached[2] <= dt_ns
+
+
 class Data:
     """Input and manage Pandas dataframes for backtesting.
 
@@ -1193,7 +1242,10 @@ def _get_bars_dict(self, dt, length=1, timestep=None, timeshift=0):
         if self.timestep == "day":
             end_row = iter_count + 1 - timeshift
         else:
-            end_row = iter_count - timeshift
+            visible_end = iter_count
+            if timeshift >= 0 and self._last_bar_closed_at(iter_count, dt):
+                visible_end = iter_count + 1
+            end_row = visible_end - timeshift
 
         data_len = len(next(iter(self.datalines.values())).dataline) if self.datalines else 0
         if end_row > data_len:
@@ -1269,6 +1321,22 @@ def _normalize_timeshift_to_rows(self, timeshift):
 
         return int(timeshift or 0)
 
+    def _last_bar_closed_at(self, iter_count, dt) -> bool:
+        index_ns = getattr(self, "_index_values_ns", None)
+        if index_ns is None:
+            try:
+                index_ns = pd.DatetimeIndex(self.df.index).asi8
+            except Exception:
+                return False
+        return _intraday_bar_closed_at(
+            index_ns,
+            iter_count,
+            dt,
+            timestep=self.timestep,
+            index_tz=getattr(self.df.index, "tz", None),
+            cache_owner=self,
+        )
+
     def _get_bars_row_bounds(self, dt, length=1, timeshift=0):
         timeshift = self._normalize_timeshift_to_rows(timeshift)
 
@@ -1282,7 +1350,10 @@ def _get_bars_row_bounds(self, dt, length=1, timeshift=0):
         if self.timestep == "day":
             end_row = int(iter_count) + 1 - timeshift
         else:
-            end_row = int(iter_count) - timeshift
+            visible_end = int(iter_count)
+            if timeshift >= 0 and self._last_bar_closed_at
```

**File**: `lumibot/entities/data_polars.py` (modified, +14/-1)
```diff
@@ -553,7 +553,20 @@ def _get_bars_dict(self, dt, length=1, timestep=None, timeshift=0):
                 timeshift = timeshift_converted
 
         # Get bars.
-        end_row = self.get_iter_count(dt) - timeshift
+        iter_count = self.get_iter_count(dt)
+        visible_end = iter_count
+        if self.timestep != "day" and timeshift >= 0:
+            from lumibot.entities.data import _intraday_bar_closed_at
+
+            try:
+                index = pd.DatetimeIndex(self.iter_index.index)
+                if _intraday_bar_closed_at(
+                    index.asi8, iter_count, dt, timestep=self.timestep, index_tz=index.tz, cache_owner=self
+                ):
+                    visible_end = iter_count + 1
+            except Exception:
+                pass
+        end_row = visible_end - timeshift
         start_row = end_row - length
 
         if start_row < 0:
```

**File**: `tests/test_data_get_bars_day_includes_latest_completed_bar.py` (modified, +81/-0)
```diff
@@ -45,3 +45,84 @@ def test_data_get_bars_day_includes_latest_completed_bar() -> None:
     assert bars.index[-1].date() == datetime.date(2015, 8, 20)
     assert float(bars["close"].iloc[-1]) == 20.0
 
+
+
+# ---------------------------------------------------------------------------
+# Intraday: a bar that has closed is visible even when no later bar exists yet
+# (release gate 2026-09-25: at 03:00 the newest visible bar was 19:58, not 19:59; the
+# 19:59 bar closed at 20:00 but stayed hidden until the 04:00 bar existed).
+# ---------------------------------------------------------------------------
+
+import pytest
+
+_NY = pytz.timezone("America/New_York")
+
+
+def _intraday_frame(stamps: list[str]) -> pd.DataFrame:
+    idx = pd.DatetimeIndex([_NY.localize(datetime.datetime.fromisoformat(s)) for s in stamps], name="datetime")
+    px = [100.0 + i for i in range(len(idx))]
+    return pd.DataFrame({"open": px, "high": px, "low": px, "close": px, "volume": [1] * len(idx)}, index=idx)
+
+
+def _data(kind: str, frame: pd.DataFrame, timestep: str):
+    asset = Asset("SPY", asset_type="stock")
+    if kind == "pandas":
+        return Data(asset=asset, df=frame, timestep=timestep)
+    import polars as pl
+
+    from lumibot.entities.data_polars import DataPolars
+
+    flat = frame.reset_index()
+    flat.columns = ["datetime", "open", "high", "low", "close", "volume"]
+    return DataPolars(asset=asset, df=pl.from_pandas(flat), timestep=timestep, quote=asset)
+
+
+def _last_visible(data, at: str, length: int = 3) -> str:
+    bars = data.get_bars(_NY.localize(datetime.datetime.fromisoformat(at)), length=length, timestep=data.timestep)
+    return bars.index[-1].tz_convert(_NY).strftime("%m-%d %H:%M")
+
+
+@pytest.mark.parametrize("kind", ["pandas", "polars"])
+@pytest.mark.parametrize(
+    "at, expected",
+    [
+        ("2026-09-15 19:59", "09-15 19:58"),  # 19:59 bar still forming
+        ("2026-09-15 20:00", "09-15 19:59"),  # closed at the session end
+        ("2026-09-16 03:00", "09-15 19:59"),  # overnight
+        ("2026-09-16 04:00", "09-15 19:59"),  # 04:00 bar forming
+        ("2026-09-16 04:01", "09-16 04:00"),
+    ],
+)
+def test_minute_bar_is_visible_once_closed_even_without_a_later_bar(kind, at, expected):
+    frame = _intraday_frame(["2026-09-15 19:57", "2026-09-15 19:58", "2026-09-15 19:59",
+                             "2026-09-16 04:00", "2026-09-16 04:01", "2026-09-16 04:02"])
+    assert _last_visible(_data(kind, frame, "minute"), at) == expected
+
+
+@pytest.mark.parametrize("kind", ["pandas", "polars"])
+@pytest.mark.parametrize(
+    "at, expected",
+    [
+        ("2026-09-15 10:02", "09-15 09:55"),  # 10:00 five-minute bar runs to 10:05: never early
+        ("2026-09-15 10:05", "09-15 10:00"),  # closed, and no 10:05 bar exists (gap)
+    ],
+)
+def test_multi_minute_bars_stored_as_minute_are_never_visible_before_they_close(kind, at, expected):
+    frame = _intraday_frame(["2026-09-15 09:45", "2026-09-15 09:50", "2026-09-15 09:55",
+                             "2026-09-15 10:00", "2026-09-15 10:15"])
+    assert _last_visible(_data(kind, frame, "minute"), at) == expected
+
+
+@pytest.mark.parametrize("kind", ["pandas", "polars"])
+@pytest.mark.parametrize(
+    "at, expected",
+    [
+        ("2026-09-15 15:30", "09-15 14:00"),  # the 15:00 hourly bar runs to 16:00
+        ("2026-09-15 16:00", "09-15 15:00"),
+        ("2026-09-16 08:00", "09-15 15:00"),
+    ],
+)
+def test_hourly_bar_after_an_irregular_first_bar_is_not_visible_early(kind, at, expected):
+    frame = _intraday_frame(["2026-09-15 09:30", "2026-09-15 10:00", "2026-09-15 11:00", "2026-09-15 12:00",
+                             "2026-09-15 13:00", "2026-09-15 14:00", "2026-09-15 15:00", "2026-09-16 09:30"])
+    assert _last_visible(_data(kind, frame, "hour"), at) == expected
```

**File**: `tests/test_hour_timestep_support.py` (modified, +5/-2)
```diff
@@ -488,5 +488,8 @@ def download_ohlcv(self, symbol, timeframe, start_datetime, end_dt):
     bars = ds.get_historical_prices(asset, length=1, timestep="minute", quote=quote)
 
     assert bars is not None
-    assert bars.df["close"].iloc[-1] == 200.5
-    assert bars.df.index[-1].tz_convert("UTC") == pd.Timestamp("2026-06-23 19:58:00+00:00")
+    # The 19:59 UTC bar closes at 20:00, the simulated time, and no later bar exists, so it is the
+    # newest completed bar (4.6.2: a closed bar is visible without waiting for a later bar; this
+    # used to return the 19:58 bar). The refreshed frame, not the stale 2026-06-16 alias, serves it.
+    assert bars.df["close"].iloc[-1] == 201.5
+    assert bars.df.index[-1].tz_convert("UTC") == pd.Timestamp("2026-06-23 19:59:00+00:00")
```

---

### Incident Patch 4: `19e63e84` (2026-09-26)
**Commit Message**: fix(routed): Polygon stocks get dividends; skip non-stock dividend lookups

CodeRabbit on PR #1180 (4.6.2 follow-up) and a related find.

1. Polygon-routed stocks had no dividend source. Polygon bars are
   split-adjusted only (dividends are not in the price) and carry no
   dividend column. They now read dividends from
   ibkr_helper._get_cached_equity_actions (the free, split-adjusted
   corporate-actions table that already enriches IBKR daily bars), cached
   per symbol; only the current date's amount is read.
2. The routed lookup ran for every held asset. For futures and crypto (no
   dividends) it asked for daily bars once per simulated day, so a held MES
   or BTC position made the router download daily history the strategy never
   requested (futures daily bars are built from hourly downloads). Assets
   that are not stocks now return 0 without any lookup. Alpaca-routed stocks
   return 0 without a lookup too (adjustment="all" prices already include
   dividends, as pinned in b6294cfe; that guard test now loads the strategy's
   own daily bars explicitly and asserts the dividend lookup fetches nothing).

Red first: test_polygon_routed_stocks_get_dividends_from_corporate_acti

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 ## 4.6.2 - Unreleased
 
 ### Fixed
+- Polygon-routed stocks in `BACKTESTING_DATA_SOURCE` router backtests credit dividends. Polygon bars are split-adjusted only and carry no dividend column, so they got none; they now read dividends from the same free corporate-actions source that enriches IBKR daily bars. Routed dividend lookups now skip futures, crypto and other non-stock assets, which pay no dividends: a held futures or crypto position made the router download daily bars the strategy never asked for.
 - Backtests no longer pay a dividend on shares bought on the ex-dividend date. The dividend check runs before every iteration, so a position opened during the ex-date was credited by the next check (a BotSpot Auto backtest bought XBI at 11:31 on its ex-date and was credited $11.32). Only shares held when the day began are entitled.
 - `Order.avg_fill_price` keeps the broker's full precision. Setting it rounded to 2 decimals (the constructor never did), so a sub-cent crypto fill such as 0.0000123 became 0.0, forex and sub-penny option fills moved (1.08765 became 1.09), and live brokers passed the rounded value into fill processing for cash and positions.
 - IBKR futures intraday history no longer stops at the first weekend. The backward pager ended at the first empty page, and a 1000-minute page ending at the Sunday 18:00 ET open is all weekend, so an MES 1-minute backtest for Sep 1 to 18, 2026 only had data from Sep 6. Pages that are closed by the CME weekend and daily-break rules are now stepped over without a request, and up to three empty pages during rule-calendar trading time (holiday closes such as Good Friday) are stepped over before the walk stops.
```

**File**: `lumibot/backtesting/routed_backtesting.py` (modified, +52/-2)
```diff
@@ -1212,19 +1212,36 @@ def get_yesterday_dividends(self, assets, quote=None):
         Alpaca-routed stocks correctly get no cash dividend: the routed Alpaca source keeps
         AlpacaBacktesting's default auto_adjust=True, which requests adjustment="all" bars, so
         dividends are already in the price series. Crediting cash on top would count them twice.
+        Polygon bars are split-adjusted only and carry no dividend column, so Polygon-routed stocks
+        read dividends from corporate actions. Assets other than stocks pay none and are not looked up.
         """
         theta_assets = []
         routed_assets = []
+        corporate_action_assets = []
+        result = {}
         for asset in assets:
+            # Only stocks (and ETFs) pay dividends. Looking up anything else made the router
+            # download daily bars nobody asked for (futures daily bars come from hourly downloads).
+            if _normalize_asset_type(getattr(asset, "asset_type", "")) != "stock":
+                result[asset] = 0.0
+                continue
             try:
                 provider = self._provider_spec_for_asset(asset).provider
             except Exception:
                 provider = "thetadata"
-            (theta_assets if provider == "thetadata" else routed_assets).append(asset)
+            if provider == "thetadata":
+                theta_assets.append(asset)
+            elif provider == "alpaca":
+                result[asset] = 0.0  # adjustment="all": dividends are already in the prices
+            elif provider == "polygon":
+                corporate_action_assets.append(asset)  # split-adjusted only, no dividend column
+            else:
+                routed_assets.append(asset)
 
-        result = {}
         if theta_assets:
             result.update(dict(super().get_yesterday_dividends(theta_assets, quote=quote).items()))
+        if corporate_action_assets:
+            result.update(self._corporate_action_dividends(corporate_action_assets))
         if not routed_assets:
             return AssetsMapping(result)
 
@@ -1278,6 +1295,39 @@ def get_yesterday_dividends(self, assets, quote=None):
             result[asset] = dividend
         return AssetsMapping(result)
 
+    def _corporate_action_dividends(self, assets) -> dict:
+        """Dividends for assets whose bars carry none (Polygon: split-adjusted prices only).
+
+        Uses the same free corporate-actions source that enriches IBKR daily stock bars
+        (`ibkr_helper._get_cached_equity_actions`, split-adjusted cash amounts by ex-date).
+        Only the current date's amount is read, so the full table is no lookahead.
+        """
+        current_date = self._datetime.date() if hasattr(self._datetime, "date") else self._datetime
+        cache = getattr(self, "_corporate_action_dividend_cache", None)
+        if cache is None:
+            cache = self._corporate_action_dividend_cache = {}
+        out = {}
+        for asset in assets:
+            symbol = str(getattr(asset, "symbol", "") or "").upper()
+            by_date = cache.get(symbol)
+            if by_date is None:
+                by_date = {}
+                try:
+                    end = getattr(self, "datetime_end", None)
+                    actions = ibkr_helper._get_cached_equity_actions(symbol, last_needed_datetime=end)
+                    if actions is not None and not actions.empty and "Dividends" in actions.columns:
+                        index = pd.DatetimeIndex(actions.index)
+                        index = index.tz_localize(LUMIBOT_DEFAULT_PYTZ) if index.tz is None else index.tz_convert(LUMIBOT_DEFAULT_PYTZ)
+                        amounts = pd.to_numeric(actions["Dividends"], errors="coerce").fillna(0.0).to_numpy()
+                        for ts, amount in zip(index, amounts):
+                            if amount > 0:
+                                by_date[ts.date()] = by_date.get(ts.date(), 0.0) + float(amount)
+                exc
```

**File**: `tests/backtest/test_routed_backtesting_ibkr_prefetch.py` (modified, +68/-1)
```diff
@@ -1446,6 +1446,73 @@ def fake_between_dates(self, *, base_asset, quote_asset, timestep, data_datetime
     quote = Asset("USD", asset_type=Asset.AssetType.FOREX)
     router._datetime = LUMIBOT_DEFAULT_PYTZ.localize(datetime(2026, 6, 18, 9, 30))
 
-    assert float(router.get_yesterday_dividends([spy], quote=quote).get(spy) or 0.0) == 0.0
+    router.get_historical_prices(spy, 5, "day", quote=quote)  # the strategy's own daily bars
     assert sources, "the Alpaca source was never asked for daily bars"
     assert sources[0]._auto_adjust is True  # adjustment="all": dividends are in the prices
+    asked = len(sources)
+    assert float(router.get_yesterday_dividends([spy], quote=quote).get(spy) or 0.0) == 0.0
+    assert len(sources) == asked  # the dividend lookup itself fetches nothing for Alpaca
+
+
+def test_routed_dividend_lookup_never_downloads_bars_for_futures_or_crypto(monkeypatch, no_local_theta_terminal):
+    """Only stocks pay dividends. The routed lookup asked for daily bars for every held asset
+    without a dividend column, so a futures or crypto position made the router download daily
+    history the strategy never asked for (futures daily bars are derived from hourly downloads)."""
+    from datetime import date as _date
+
+    import lumibot.tools.ibkr_helper as ibkr_helper
+
+    monkeypatch.setenv("DATADOWNLOADER_BASE_URL", "http://localhost:8080")
+    monkeypatch.setenv("DATADOWNLOADER_API_KEY", "<redacted>")
+    start = LUMIBOT_DEFAULT_PYTZ.localize(datetime(2026, 6, 1, 0, 0))
+    end = LUMIBOT_DEFAULT_PYTZ.localize(datetime(2026, 8, 31, 0, 0))
+    router = _make_router(start, end, {"default": "ibkr", "stock": "ibkr", "future": "ibkr", "crypto": "ibkr"})
+    fetches = []
+    monkeypatch.setattr(ibkr_helper, "get_price_data", lambda **kw: fetches.append(kw) or pd.DataFrame())
+    mes = Asset("MES", asset_type=Asset.AssetType.FUTURE, expiration=_date(2026, 12, 18))
+    btc = Asset("BTC", asset_type=Asset.AssetType.CRYPTO)
+    quote = Asset("USD", asset_type=Asset.AssetType.FOREX)
+
+    for day in (1, 2, 3):
+        router._datetime = LUMIBOT_DEFAULT_PYTZ.localize(datetime(2026, 7, day, 9, 30))
+        result = router.get_yesterday_dividends([mes, btc], quote=quote)
+        assert float(result.get(mes) or 0.0) == 0.0 and float(result.get(btc) or 0.0) == 0.0
+    assert fetches == []
+
+
+def test_polygon_routed_stocks_get_dividends_from_corporate_actions(monkeypatch, no_local_theta_terminal):
+    """CodeRabbit on PR #1180 (4.6.2 follow-up): Polygon bars are split-adjusted only (dividends are
+    not in the price) and carry no dividend column, so Polygon-routed stocks got no dividends. They
+    now use the same free corporate-actions source that enriches IBKR daily bars."""
+    import lumibot.backtesting.routed_backtesting as routed
+    import lumibot.tools.ibkr_helper as ibkr_helper
+    import lumibot.tools.polygon_helper as polygon_helper
+
+    monkeypatch.setenv("DATADOWNLOADER_BASE_URL", "http://localhost:8080")
+    monkeypatch.setenv("DATADOWNLOADER_API_KEY", "<redacted>")
+    monkeypatch.setenv("POLYGON_API_KEY", "test")
+    monkeypatch.setattr(routed, "POLYGON_API_KEY", "test")
+
+    def fake_polygon(*, start, end, **_):
+        frame = _daily_ohlc(start, end)
+        frame.index = frame.index + pd.Timedelta(hours=16)
+        return frame
+
+    monkeypatch.setattr(polygon_helper, "get_price_data_from_polygon", fake_polygon)
+    actions = pd.DataFrame(
+        {"Dividends": [0.318, 0.330], "Stock Splits": [0.0, 0.0]},
+        index=pd.DatetimeIndex([pd.Timestamp("2026-07-01", tz=LUMIBOT_DEFAULT_PYTZ),
+                                pd.Timestamp("2026-08-03", tz=LUMIBOT_DEFAULT_PYTZ)]),
+    )
+    monkeypatch.setattr(ibkr_helper, "_get_cached_equity_actions", lambda symbol, **_: actions if symbol == "TLT" else actions.iloc[0:0])
+
+    start = LUMIBOT_DEFAULT_PYTZ.localize(datetime(2026, 6, 1, 0, 0))
+    end = LUMIBOT_DEFAULT_PYTZ.localize(datetime(2026, 8, 31, 0, 
```

---

### Incident Patch 5: `9536786a` (2026-09-26)
**Commit Message**: fix(strategy): only shares held when the day began earn that day's dividend

Release gate finding (2026-09-25). Strategy._update_cash_with_dividends runs
before every trading iteration and credits every tracked position once per
date. A position bought on the ex-date existed by the next iteration and was
credited: SEH Simple bought XBI 2026-06-22 11:31 (its ex-date) and got
82 x 0.138 = $11.32. The logic predates 4.6.1; 6cedc0fa made it reachable on
BotSpot Auto by restoring dividends there.

The first call of each date now snapshots the holdings; only those assets,
with their start-of-day quantity, are credited that day. Shares added during
the ex-date earn nothing; shares sold during the day still earn it (they were
held at the start). The per-date tracker still prevents double credit.

Red first: test_position_bought_on_the_ex_date_does_not_receive_that_days_dividend
(cash 100011.316, expected 100000.0).

Tests (LUMIBOT_DISABLE_DOTENV_LOCAL=1 LUMIBOT_CACHE_BACKEND=local
LUMIBOT_CACHE_MODE=disabled):
- pytest tests/test_strategy_dividend_cash_batch.py: 3/3
- pytest -m "not apitest and not downloader" tests -k "dividend or split or
  cash": 196 passed, 2 skipped, 1 xpassed, 22 sub

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 ## 4.6.2 - Unreleased
 
 ### Fixed
+- Backtests no longer pay a dividend on shares bought on the ex-dividend date. The dividend check runs before every iteration, so a position opened during the ex-date was credited by the next check (a BotSpot Auto backtest bought XBI at 11:31 on its ex-date and was credited $11.32). Only shares held when the day began are entitled.
 - `Order.avg_fill_price` keeps the broker's full precision. Setting it rounded to 2 decimals (the constructor never did), so a sub-cent crypto fill such as 0.0000123 became 0.0, forex and sub-penny option fills moved (1.08765 became 1.09), and live brokers passed the rounded value into fill processing for cash and positions.
 - IBKR futures intraday history no longer stops at the first weekend. The backward pager ended at the first empty page, and a 1000-minute page ending at the Sunday 18:00 ET open is all weekend, so an MES 1-minute backtest for Sep 1 to 18, 2026 only had data from Sep 6. Pages that are closed by the CME weekend and daily-break rules are now stepped over without a request, and up to three empty pages during rule-calendar trading time (holiday closes such as Good Friday) are stepped over before the walk stops.
 - IBKR minute backtests in a long-running process (a notebook, a local script, a service that runs many backtests) ask again for a session that had no trades once its one-day marker expires. The series was remembered as checked for the life of the process, so the marker never expired in practice.
```

**File**: `lumibot/strategies/_strategy.py` (modified, +16/-2)
```diff
@@ -2161,10 +2161,22 @@ def _update_cash_with_dividends(self):
 
             positions = self.broker.get_tracked_positions(self._name)
 
+            # ENTITLEMENT: only shares held when the day began earn that day's dividend. This runs
+            # before every iteration, so a position bought on the ex-date existed by the next one
+            # and used to be credited (release gate 2026-09-25: XBI bought 2026-06-22 11:31 on
+            # its ex-date got 82 x 0.138). The first call of each date snapshots the holdings.
+            if getattr(self, "_dividend_entitlement_date", None) != current_date:
+                self._dividend_entitlement_date = current_date
+                self._dividend_entitled_quantity = {
+                    getattr(p.asset, "symbol", str(p.asset)): p.quantity for p in positions
+                }
+            entitled_quantity = self._dividend_entitled_quantity
+
             assets = []
             for position in positions:
                 if position.asset != self._quote_asset and position.asset.asset_type != "option":
-                    assets.append(position.asset)
+                    if getattr(position.asset, "symbol", str(position.asset)) in entitled_quantity:
+                        assets.append(position.asset)
 
             # Early return if no assets - avoid expensive dividend API calls
             if not assets:
@@ -2178,7 +2190,9 @@ def _update_cash_with_dividends(self):
 
             for position in positions:
                 asset = position.asset
-                quantity = position.quantity
+                quantity = entitled_quantity.get(getattr(asset, "symbol", str(asset)))
+                if quantity is None:
+                    continue  # opened today: not entitled to today's dividend
                 dividend_per_share = 0 if dividends_per_share is None else dividends_per_share.get(asset, 0)
 
                 # Skip if no dividend or already applied for this (date, asset) combination
```

**File**: `tests/test_strategy_dividend_cash_batch.py` (modified, +57/-0)
```diff
@@ -44,3 +44,60 @@ def _counting_set_cash_position(value):
 
     assert result == 109.0
     assert calls["count"] == 1
+
+
+def _ex_date_strategy(monkeypatch, dividends):
+    data_source = PandasDataBacktesting(
+        datetime_start=datetime(2026, 6, 19),
+        datetime_end=datetime(2026, 6, 26),
+        show_progress_bar=False,
+    )
+    broker = BacktestingBroker(data_source=data_source)
+    strategy = _DividendBatchStrategy(broker=broker)
+    strategy._set_cash_position(100_000.0)
+    monkeypatch.setattr(
+        strategy,
+        "get_yesterday_dividends",
+        lambda assets: {a: dividends.get((strategy.get_datetime().date().isoformat(), a.symbol), 0.0) for a in assets},
+    )
+    return broker, strategy
+
+
+def test_position_bought_on_the_ex_date_does_not_receive_that_days_dividend(monkeypatch):
+    """Release gate, 2026-09-25: a position bought ON the ex-date still received that day's dividend,
+    because _update_cash_with_dividends runs before every iteration and the position existed by the
+    next one (SEH Simple: XBI bought 2026-06-22 11:31, credited 82 x 0.138 = $11.32). Only shares
+    held when the day began are entitled."""
+    import pytz
+
+    ny = pytz.timezone("America/New_York")
+    xbi = Asset("XBI")
+    broker, strategy = _ex_date_strategy(monkeypatch, {("2026-06-22", "XBI"): 0.138})
+
+    broker._update_datetime(ny.localize(datetime(2026, 6, 22, 9, 30)))
+    strategy._update_cash_with_dividends()  # first check of the ex-date: nothing held
+    broker._filled_positions.append(Position(strategy=strategy.name, asset=xbi, quantity=Decimal("82")))
+    for minute in (31, 32, 33):
+        broker._update_datetime(ny.localize(datetime(2026, 6, 22, 11, minute)))
+        strategy._update_cash_with_dividends()
+
+    assert strategy.cash == 100_000.0
+
+
+def test_position_held_into_the_ex_date_is_paid_once_on_the_shares_held_at_the_start(monkeypatch):
+    import pytz
+
+    ny = pytz.timezone("America/New_York")
+    xle = Asset("XLE")
+    broker, strategy = _ex_date_strategy(monkeypatch, {("2026-06-22", "XLE"): 0.80})
+    broker._filled_positions.append(Position(strategy=strategy.name, asset=xle, quantity=Decimal("100")))
+
+    broker._update_datetime(ny.localize(datetime(2026, 6, 22, 9, 30)))
+    strategy._update_cash_with_dividends()
+    assert strategy.cash == 100_080.0
+
+    # Buying 50 more on the ex-date adds no dividend; the credit is not repeated either.
+    broker.get_tracked_position(strategy.name, xle)._quantity = Decimal("150")
+    broker._update_datetime(ny.localize(datetime(2026, 6, 22, 14, 0)))
+    strategy._update_cash_with_dividends()
+    assert strategy.cash == 100_080.0
```

---

### Incident Patch 6: `fa631fb8` (2026-09-26)
**Commit Message**: fix(order): keep the broker's precision in Order.avg_fill_price

CodeRabbit on PR #1180 (4.6.2 follow-up). The avg_fill_price setter rounded
every value to 2 decimals (since 2024-01), while the constructor kept the
exact value. Effects:
- a sub-cent crypto fill (SHIB 0.0000123456) became 0.0;
- forex and sub-penny option fills moved (EUR 1.08765 -> 1.09, 1.235 -> 1.24);
- live brokers call _process_filled_order(order, order.avg_fill_price, ...),
  so cash and positions booked the rounded price;
- backtests set order.avg_fill_price = price, so get_fill_price() and
  multileg net prices used the rounded value.
The setter now stores float(value) (None stays None).

Blast radius checked: trade-event logs record the price argument, not
avg_fill_price; Polymarket already relied on the unrounded constructor path.
One legacy assertion encoded the rounding: tests/test_alpaca_backtesting.py
test_btc_minute_1d_5 / test_btc_minute_30m_5 expected 94153.05 while the line
above pins the same open at 94153.0455 and the comment says "Open of ...".
Updated to the exact open with a LEGACY comment (stricter, not looser).

Red first: tests/test_order.py::test_avg_fill_price_setter_keeps_the_broker_prec

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 ## 4.6.2 - Unreleased
 
 ### Fixed
+- `Order.avg_fill_price` keeps the broker's full precision. Setting it rounded to 2 decimals (the constructor never did), so a sub-cent crypto fill such as 0.0000123 became 0.0, forex and sub-penny option fills moved (1.08765 became 1.09), and live brokers passed the rounded value into fill processing for cash and positions.
 - IBKR futures intraday history no longer stops at the first weekend. The backward pager ended at the first empty page, and a 1000-minute page ending at the Sunday 18:00 ET open is all weekend, so an MES 1-minute backtest for Sep 1 to 18, 2026 only had data from Sep 6. Pages that are closed by the CME weekend and daily-break rules are now stepped over without a request, and up to three empty pages during rule-calendar trading time (holiday closes such as Good Friday) are stepped over before the walk stops.
 - IBKR minute backtests in a long-running process (a notebook, a local script, a service that runs many backtests) ask again for a session that had no trades once its one-day marker expires. The series was remembered as checked for the life of the process, so the marker never expired in practice.
 
```

**File**: `lumibot/entities/order.py` (modified, +4/-1)
```diff
@@ -1093,7 +1093,10 @@ def avg_fill_price(self):
 
     @avg_fill_price.setter
     def avg_fill_price(self, value):
-        self._avg_fill_price = round(float(value), 2) if value is not None else None
+        # Keep the broker's precision (the constructor always did). Rounding to 2 decimals turned
+        # a sub-cent crypto fill into 0.0 and moved forex and sub-penny option fills, and live
+        # brokers pass this value into _process_filled_order, so cash and positions booked it.
+        self._avg_fill_price = float(value) if value is not None else None
 
     @property
     def identifier(self):
```

**File**: `tests/test_alpaca_backtesting.py` (modified, +10/-2)
```diff
@@ -1170,7 +1170,11 @@ def test_btc_minute_1d_5(
         assert order_tracker["iteration_at"].isoformat() == '2025-01-13T00:00:00-06:00'
         assert order_tracker["submitted_at"].isoformat() == '2025-01-13T00:00:00-06:00'
         assert order_tracker["filled_at"].isoformat() == '2025-01-13T00:00:00-06:00'
-        assert order_tracker["avg_fill_price"] == 94153.05  # Open of '2025-01-13T00:00:00-06:00'
+        # LEGACY TEST (2025-03-11). The fill is the open of '2025-01-13T00:00:00-06:00', which the
+        # last_prices assertion above pins at 94153.0455. 94153.05 was that open rounded by the old
+        # 2-decimal Order.avg_fill_price setter (removed in 4.6.2: it turned sub-cent crypto fills
+        # into 0.0). The expected value is now the exact open, not a looser check.
+        assert order_tracker["avg_fill_price"] == 94153.0455  # Open of '2025-01-13T00:00:00-06:00'
 
     def test_btc_minute_30m_5(
             self,
@@ -1250,7 +1254,11 @@ def test_btc_minute_30m_5(
         assert order_tracker["iteration_at"].isoformat() == '2025-01-13T00:00:00-06:00'
         assert order_tracker["submitted_at"].isoformat() == '2025-01-13T00:00:00-06:00'
         assert order_tracker["filled_at"].isoformat() == '2025-01-13T00:00:00-06:00'
-        assert order_tracker["avg_fill_price"] == 94153.05  # Open of '2025-01-13T00:00:00-06:00'
+        # LEGACY TEST (2025-03-11). The fill is the open of '2025-01-13T00:00:00-06:00', which the
+        # last_prices assertion above pins at 94153.0455. 94153.05 was that open rounded by the old
+        # 2-decimal Order.avg_fill_price setter (removed in 4.6.2: it turned sub-cent crypto fills
+        # into 0.0). The expected value is now the exact open, not a looser check.
+        assert order_tracker["avg_fill_price"] == 94153.0455  # Open of '2025-01-13T00:00:00-06:00'
 
     def test_amzn_day_1d_dump_benchmark_stats(
             self,
```

**File**: `tests/test_order.py` (modified, +34/-0)
```diff
@@ -137,6 +137,40 @@ def test_get_filled_price(self):
         buy_order.avg_fill_price = 50.0
         assert buy_order.get_fill_price() == 50.0
 
+    @pytest.mark.parametrize(
+        "asset, price",
+        [
+            (Asset("SHIB", asset_type="crypto"), 0.0000123456),  # sub-cent coin
+            (Asset("BTC", asset_type="crypto"), 94558.7512),
+            (Asset("EUR", asset_type="forex"), 1.08765),
+            (Asset("SPY", asset_type="option", expiration=__import__("datetime").date(2026, 10, 16), strike=650, right="CALL"), 1.235),
+            (Asset("MES", asset_type="future", expiration=__import__("datetime").date(2026, 12, 18)), 6612.25),
+        ],
+    )
+    def test_avg_fill_price_setter_keeps_the_broker_precision(self, asset, price):
+        """The setter rounded every fill to 2 decimals (since 2024), while the constructor kept the
+        exact value. A sub-cent crypto fill became 0.0, forex and sub-penny option fills moved, and
+        live brokers pass order.avg_fill_price into _process_filled_order, so cash and positions
+        booked the rounded price (CodeRabbit on PR #1180)."""
+        quote = Asset("USD", asset_type="forex")
+        order = Order(strategy="abc", asset=asset, side="buy", quantity=10, quote=quote)
+        order.avg_fill_price = price
+        assert order.avg_fill_price == price
+        assert order.get_fill_price() == price
+        constructed = Order(strategy="abc", asset=asset, side="buy", quantity=10, quote=quote, avg_fill_price=price)
+        assert constructed.avg_fill_price == price
+
+    def test_avg_fill_price_setter_accepts_strings_decimals_and_none(self):
+        from decimal import Decimal
+
+        order = Order(strategy="abc", asset=Asset("SPY"), side="buy", quantity=1)
+        order.avg_fill_price = "412.3456"
+        assert order.avg_fill_price == 412.3456
+        order.avg_fill_price = Decimal("0.00012345")
+        assert order.avg_fill_price == 0.00012345
+        order.avg_fill_price = None
+        assert order.avg_fill_price is None
+
     def test_smart_limit_order_type_in_str(self):
         asset = Asset("SPY")
         order = Order(
```

---

### Incident Patch 7: `252f0d07` (2026-09-26)
**Commit Message**: fix(ibkr): futures intraday paging continues across weekends and holidays

Data matrix 2026-09-25 (4.6.0 and 4.6.1 identical): MES continuous 1-minute
for Sep 1 to 18 started at the Sunday Sep 6 18:00 ET open; Sep 1 to 4 were
missing. The backward pager treated the first empty page as the start of
history, and a 1000-minute page ending at the Sunday open is all weekend.
Stocks got closed-page stepping in 1e97eb7b; futures never did, so every
futures intraday walk stopped at its first weekend.

- _cursor_before_closed_futures_page steps over pages closed by the CME rule
  calendar (_us_futures_closed_interval: weekends, daily 17:00-18:00 ET) with
  no request, like _cursor_before_closed_equity_page for stocks.
- Holiday closes are not in that rule calendar. Up to
  IBKR_FUTURES_MAX_EMPTY_OPEN_PAGES (3) consecutive empty pages during
  rule-calendar trading time are stepped back one page each before the walk
  stops; the counter resets on every non-empty page. Daily bars are unchanged.

Red first: test_ibkr_futures_minute_paging_continues_across_closed_weekends_and_holidays
labor_day_weekend: 13200 bars missing; holiday_close: 5160 bars missing.
Live on the production downloader afte

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 ## 4.6.2 - Unreleased
 
 ### Fixed
+- IBKR futures intraday history no longer stops at the first weekend. The backward pager ended at the first empty page, and a 1000-minute page ending at the Sunday 18:00 ET open is all weekend, so an MES 1-minute backtest for Sep 1 to 18, 2026 only had data from Sep 6. Pages that are closed by the CME weekend and daily-break rules are now stepped over without a request, and up to three empty pages during rule-calendar trading time (holiday closes such as Good Friday) are stepped over before the walk stops.
 - IBKR minute backtests in a long-running process (a notebook, a local script, a service that runs many backtests) ask again for a session that had no trades once its one-day marker expires. The series was remembered as checked for the life of the process, so the marker never expired in practice.
 
 ## 4.6.1 - 2026-09-25
```

**File**: `lumibot/tools/ibkr_helper.py` (modified, +52/-0)
```diff
@@ -93,6 +93,9 @@
 # of history. A 1000-minute page is 16.7 hours, a weekend is about 56 closed hours.
 # The bound only guards against a calendar bug; a real walk skips one or two per gap.
 IBKR_MAX_CLOSED_PAGE_SKIPS = 2000
+# Consecutive empty futures pages during rule-calendar trading time that are stepped over
+# before the walk treats the empty answer as the start of history (holiday closes).
+IBKR_FUTURES_MAX_EMPTY_OPEN_PAGES = 3
 # Smallest daily page tried after IBKR says "Chart data unavailable" for a page that
 # reaches back before the contract's first bar (see _smaller_daily_period_after_chart_unavailable).
 IBKR_DAILY_MIN_PAGE_DAYS = 5
@@ -603,6 +606,35 @@ def _cursor_before_closed_equity_page(
     return page_end
 
 
+def _cursor_before_closed_futures_page(
+    *,
+    asset_type: str,
+    bar: str,
+    period: str,
+    cursor_end: datetime,
+) -> Optional[datetime]:
+    """Where backward pagination continues after an empty US futures intraday page.
+
+    Same idea as `_cursor_before_closed_equity_page`, with the CME rule calendar
+    (`_us_futures_closed_interval`: weekends and the daily 17:00-18:00 ET break). Without it
+    every futures walk stopped at the first weekend: MES 1-minute for Sep 1 to 18, 2026 started
+    at the Sunday Sep 6 18:00 open (data matrix, 2026-09-25). Returns None when the empty page
+    covered open time by those rules.
+    """
+    if asset_type not in {"future", "cont_future"} or (bar or "").strip().lower().endswith("d"):
+        return None
+    step = _period_to_timedelta(period)
+    if step is None:
+        return None
+    page_end = cursor_end
+    for _ in range(64):
+        page_start = page_end - step
+        if not _us_futures_closed_interval(page_start, page_end):
+            return page_end if page_end != cursor_end else None
+        page_end = page_start
+    return page_end
+
+
 def _previous_close_if_only_session_start_is_open(
     *, page_start: datetime, page_end: datetime, extended: bool
 ) -> Optional[datetime]:
@@ -2340,6 +2372,7 @@ def _fetch_history_between_dates(
     start_dt = _to_utc(start_dt)
     chunks: list[pd.DataFrame] = []
     closed_pages_skipped = 0
+    futures_empty_open_pages = 0
     checkpointed_pages = 0
 
     # Opt-in trace: log every real network fetch + caller, to audit cache-miss root causes.
@@ -2471,11 +2504,29 @@ def _fetch_history_between_dates(
                 cursor_end=cursor_end,
                 include_after_hours=include_after_hours,
             )
+            if skipped_to is None:
+                skipped_to = _cursor_before_closed_futures_page(
+                    asset_type=asset_type, bar=bar, period=period, cursor_end=cursor_end
+                )
             if skipped_to is not None:
                 closed_pages_skipped += 1
                 if closed_pages_skipped <= IBKR_MAX_CLOSED_PAGE_SKIPS and skipped_to > start_dt:
                     cursor_end = skipped_to
                     continue
+            # Futures holiday closes (Good Friday, Christmas) are not in the simple CME rule
+            # calendar, so their empty pages look like trading time. Step back one page, a few
+            # times, before treating the empty answer as the start of history.
+            if (
+                chunks
+                and asset_type in {"future", "cont_future"}
+                and not (bar or "").strip().lower().endswith("d")
+                and futures_empty_open_pages < IBKR_FUTURES_MAX_EMPTY_OPEN_PAGES
+            ):
+                page_span = _period_to_timedelta(period)
+                if page_span is not None and cursor_end - page_span > start_dt:
+                    futures_empty_open_pages += 1
+                    cursor_end = cursor_end - page_span
+                    continue
         if not data:
             # If we already fetched earlier chunks, keep them and stop paging.
             # CME weekend/maintenance gaps (Fri 4pm CT → Sun 5pm CT, nightly 4–5pm CT)
@@ -2524,6 +2575
```

**File**: `tests/test_ibkr_helper_unit.py` (modified, +84/-0)
```diff
@@ -1539,3 +1539,87 @@ def test_ibkr_page_request_end_keeps_the_one_bar_shift_for_futures_and_old_windo
     assert ibkr_helper._ibkr_page_request_end(recent, 3600, "future") == recent + timedelta(hours=1)
     # Stock at the delayed-feed limit stays at the limit.
     assert ibkr_helper._ibkr_page_request_end(recent, 3600, "stock") == recent
+
+
+# ---------------------------------------------------------------------------
+# Futures paging across closed weekends and holidays (2026-09-25 data matrix)
+# ---------------------------------------------------------------------------
+
+
+def _cme_minute_bars(first_day: str, last_day: str, *, halts=()) -> pd.DataFrame:
+    """CME equity-futures 1-minute bars: Sunday 18:00 ET to Friday 17:00 ET, daily 17:00-18:00 break.
+
+    `halts` are (start, end) ET strings with no trading (holiday closes).
+    """
+    idx = pd.date_range(pd.Timestamp(f"{first_day} 00:00", tz=_NY), pd.Timestamp(f"{last_day} 23:59", tz=_NY), freq="1min")
+    dow = idx.weekday
+    hour = idx.hour
+    open_mask = (
+        ((dow <= 3) & (hour != 17))
+        | ((dow == 4) & (hour < 17))
+        | ((dow == 6) & (hour >= 18))
+    )
+    for halt_start, halt_end in halts:
+        open_mask &= ~((idx >= pd.Timestamp(halt_start, tz=_NY)) & (idx < pd.Timestamp(halt_end, tz=_NY)))
+    idx = idx[open_mask]
+    px = 6500.0 + pd.Series(range(len(idx)), index=idx, dtype="float64") * 0.01
+    return pd.DataFrame({"open": px, "high": px + 0.25, "low": px - 0.25, "close": px, "volume": 10.0}, index=idx)
+
+
+def _futures_page_fake(vendor: pd.DataFrame, calls: list):
+    def _fake_history_request(*, conid, period, bar, start_time, **_):
+        end = pd.Timestamp(start_time)
+        end = end.tz_localize("UTC") if end.tzinfo is None else end.tz_convert("UTC")
+        calls.append(end)
+        span = pd.Timedelta(minutes=int(str(period).removesuffix("min")))
+        rows = vendor.loc[(vendor.index > end - span) & (vendor.index <= end - pd.Timedelta(minutes=2))].tail(1000)
+        return {"data": [{"t": int(ts.timestamp() * 1000), "o": float(r["open"]), "h": float(r["high"]),
+                          "l": float(r["low"]), "c": float(r["close"]), "v": float(r["volume"])}
+                         for ts, r in rows.iterrows()]}
+
+    return _fake_history_request
+
+
+def _mes_contract():
+    from datetime import date as _date
+
+    return Asset("MES", asset_type=Asset.AssetType.FUTURE, expiration=_date(2026, 12, 18))
+
+
+@pytest.mark.parametrize(
+    "first_day, last_day, halts, label",
+    [
+        # Labor Day 2026: equity futures halt Monday Sep 7 13:00 to 18:00 ET.
+        ("2026-08-31", "2026-09-18", [("2026-09-07 13:00", "2026-09-07 18:00")], "labor_day_weekend"),
+        # A full holiday close (Good Friday style): no trading Thursday 17:00 to Sunday 18:00 ET.
+        ("2026-03-30", "2026-04-10", [("2026-04-02 17:00", "2026-04-05 18:00")], "holiday_close"),
+    ],
+)
+def test_ibkr_futures_minute_paging_continues_across_closed_weekends_and_holidays(monkeypatch, first_day, last_day, halts, label):
+    """Data matrix 2026-09-25 (both 4.6.0 and 4.6.1): MES 1-minute for Sep 1 to 18 started at the
+    Sunday Sep 6 18:00 open; Sep 1 to 4 were missing. The backward pager stops at the first empty
+    page, and a 1000-minute page ending at the Sunday open is all weekend. Stocks already step
+    over closed pages; futures did not."""
+    import lumibot.tools.ibkr_helper as ibkr_helper
+
+    monkeypatch.setattr(ibkr_helper, "_resolve_conid", lambda **_: 793356217)
+    vendor = _cme_minute_bars(first_day, last_day, halts=halts).tz_convert("UTC")
+    calls: list = []
+    monkeypatch.setattr(ibkr_helper, "_ibkr_history_request", _futures_page_fake(vendor, calls))
+
+    result = ibkr_helper._fetch_history_between_dates(
+        asset=_mes_contract(),
+        quote=Asset("USD", asset_type=Asset.AssetType.FOREX),
+        timestep="minute",
+        start_dt=vendor.index.min().to_pydatetime(),
+   
```

---

### Incident Patch 8: `de982f29` (2026-09-26)
**Commit Message**: fix(ibkr): recheck an expired empty-session marker in a long-lived process

CodeRabbit on PR #1180 (4.6.2 follow-up). A minute series whose only missing
session carried a fresh minute_session_gap_empty marker was recorded in
_RUNTIME_MINUTE_GAP_CHECKED_SERIES without an expiry. In a process that
outlives the 24 h marker (notebook, local script, multi-backtest service)
the scan was skipped forever, so the session was never asked again.

The checked entry now stores recheck_at, the earliest future marker expiry in
the window (_minute_marker_recheck_at); after it the window is scanned again.
Marker writing and checking use the _ibkr_history_now_utc() seam instead of
datetime.now so they share one clock.

Red first: test_empty_session_marker_is_rechecked_after_it_expires_in_a_long_lived_process
made 1 request after expiry, expected 2.

Note: the hourly repair (_RUNTIME_HOURLY_GAP_CHECKED_SERIES) has the same
pattern; not changed here.

Tests (LUMIBOT_DISABLE_DOTENV_LOCAL=1 LUMIBOT_CACHE_BACKEND=local
LUMIBOT_CACHE_MODE=disabled):
- pytest tests/test_ibkr_daily_gap_self_healing.py: 28/28
- owning files (gap, ibkr_helper_unit, routed prefetch, routed unit): 118/118

Co-Authored-By: Claud

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -2,6 +2,9 @@
 
 ## 4.6.2 - Unreleased
 
+### Fixed
+- IBKR minute backtests in a long-running process (a notebook, a local script, a service that runs many backtests) ask again for a session that had no trades once its one-day marker expires. The series was remembered as checked for the life of the process, so the marker never expired in practice.
+
 ## 4.6.1 - 2026-09-25
 
 ### Fixed
```

**File**: `lumibot/tools/ibkr_helper.py` (modified, +32/-4)
```diff
@@ -140,9 +140,12 @@ class IbkrFuturesConidLookupError(RuntimeError):
     str,
     tuple[tuple[int, str, str, int], datetime, datetime],
 ] = {}
+# series -> (cache signature, checked window start, end, recheck_at). recheck_at is the earliest
+# expiry of an empty-session marker in that window (None when there is none): after it the
+# window is scanned again, so a long-lived process asks for the session again.
 _RUNTIME_MINUTE_GAP_CHECKED_SERIES: Dict[
     str,
-    tuple[tuple[int, str, str, int], datetime, datetime],
+    tuple[tuple[int, str, str, int], datetime, datetime, Optional[datetime]],
 ] = {}
 # Per-process memory for the minute-hole repair, in memory only, with monotonic timestamps so
 # it expires after IBKR_MINUTE_GAP_RETRY_COOLDOWN_SECONDS: sessions whose request failed, and
@@ -3662,7 +3665,7 @@ def _has_real_bar_on(day: pd.Timestamp) -> bool:
         reasons = df_cache["missing_reason"].fillna("").astype(str).to_numpy()
         marker_mask = missing_mask & (reasons == IBKR_MINUTE_GAP_MARKER_REASON)
         if bool(marker_mask.any()):
-            now_utc = pd.Timestamp(now or datetime.now(timezone.utc))
+            now_utc = pd.Timestamp(now or _ibkr_history_now_utc())
             now_utc = now_utc.tz_localize(timezone.utc) if now_utc.tzinfo is None else now_utc.tz_convert(timezone.utc)
             retry_after = pd.to_datetime(
                 df_cache.loc[marker_mask, "missing_retry_after"], utc=True, errors="coerce"
@@ -3765,11 +3768,12 @@ def _repair_us_stock_index_minute_gaps(
     request_end = _to_utc(end_dt)
     previous_check = _RUNTIME_MINUTE_GAP_CHECKED_SERIES.get(series_key)
     if previous_check is not None:
-        checked_signature, checked_start, checked_end = previous_check
+        checked_signature, checked_start, checked_end, recheck_at = previous_check
         if (
             checked_signature == _hourly_cache_signature(df_cache)
             and checked_start <= request_start
             and checked_end >= request_end
+            and (recheck_at is None or _ibkr_history_now_utc() < recheck_at)
         ):
             return df_cache
 
@@ -3779,6 +3783,7 @@ def _repair_us_stock_index_minute_gaps(
             _hourly_cache_signature(df_cache),
             request_start,
             request_end,
+            _minute_marker_recheck_at(df_cache, start_dt=start_dt, end_dt=end_dt),
         )
         return df_cache
 
@@ -3875,7 +3880,7 @@ def _repair_us_stock_index_minute_gaps(
             unsaved_pages = 0
 
     if empty_sessions:
-        retry_after = datetime.now(timezone.utc) + timedelta(seconds=IBKR_GAP_RETRY_TTL_SECONDS)
+        retry_after = _ibkr_history_now_utc() + timedelta(seconds=IBKR_GAP_RETRY_TTL_SECONDS)
         working = _merge_frames(working, _minute_session_markers(empty_sessions, retry_after=retry_after))
 
     if not working.equals(df_cache):
@@ -3907,10 +3912,33 @@ def _repair_us_stock_index_minute_gaps(
             _hourly_cache_signature(working),
             request_start,
             request_end,
+            _minute_marker_recheck_at(working, start_dt=start_dt, end_dt=end_dt),
         )
     return working
 
 
+def _minute_marker_recheck_at(df_cache: pd.DataFrame, *, start_dt: datetime, end_dt: datetime) -> Optional[datetime]:
+    """Earliest future expiry of an empty-session marker inside the window, or None."""
+    if df_cache is None or df_cache.empty or not {"missing", "missing_reason", "missing_retry_after"}.issubset(df_cache.columns):
+        return None
+    try:
+        idx = pd.DatetimeIndex(df_cache.index)
+        idx = idx.tz_localize(LUMIBOT_DEFAULT_PYTZ) if idx.tz is None else idx.tz_convert(LUMIBOT_DEFAULT_PYTZ)
+        mask = (
+            df_cache["missing"].fillna(False).astype(bool).to_numpy()
+            & (df_cache["missing_reason"].fillna("").astype(str).to_numpy() == IBKR_MINUTE_GAP_MARKER_REASON)
+            & (idx >= pd.Timestamp(_to_utc(start_dt))) & (idx <= pd.Timestamp(_to_utc(end_dt)))
+        )
+ 
```

**File**: `tests/test_ibkr_daily_gap_self_healing.py` (modified, +32/-0)
```diff
@@ -962,3 +962,35 @@ def test_each_new_backtest_in_the_process_warns_about_unrepaired_sessions(monkey
             ibkr_helper.get_price_data(start_dt=datetime(2026, 8, 3, 8, tzinfo=timezone.utc),
                                        end_dt=datetime(2026, 8, 14, 23, 59, tzinfo=timezone.utc), **_MINUTE_KW)
         assert any("missing 4 session" in r.getMessage() for r in caplog.records), backtest_id
+
+
+def test_empty_session_marker_is_rechecked_after_it_expires_in_a_long_lived_process(monkeypatch, tmp_path) -> None:
+    """CodeRabbit on PR #1180: a series whose only missing session carried a fresh
+    minute_session_gap_empty marker was remembered as "checked". In a process that outlives the
+    marker (24 h: a notebook or a multi-backtest service), that memory skipped the scan, so the
+    session was never asked again after the marker expired."""
+    _minute_setup(monkeypatch, tmp_path)
+    days = _minute_days("2026-08-03", "2026-08-14")
+    quiet_day = "2026-08-07"
+    vendor = _minute_vendor([d for d in days if d != quiet_day])
+    feed, _ = _minute_feed(vendor)
+    _new_minute_process(monkeypatch, feed)
+    ibkr_helper.get_price_data(start_dt=datetime(2026, 8, 3, 8, tzinfo=timezone.utc),
+                               end_dt=datetime(2026, 8, 6, 23, 59, tzinfo=timezone.utc), **_MINUTE_KW)
+    _new_minute_process(monkeypatch, feed)
+    ibkr_helper.get_price_data(start_dt=datetime(2026, 8, 10, 8, tzinfo=timezone.utc),
+                               end_dt=datetime(2026, 8, 14, 23, 59, tzinfo=timezone.utc), **_MINUTE_KW)
+
+    window = dict(start_dt=datetime(2026, 8, 3, 8, tzinfo=timezone.utc),
+                  end_dt=datetime(2026, 8, 14, 23, 59, tzinfo=timezone.utc))
+    feed, served = _minute_feed(vendor)
+    _new_minute_process(monkeypatch, feed)
+    ibkr_helper.get_price_data(**window, **_MINUTE_KW)  # asks once, writes the empty marker
+    assert served["pages"] == 1
+    ibkr_helper.get_price_data(**window, **_MINUTE_KW)  # marker fresh: no request
+    assert served["pages"] == 1
+
+    later = datetime(2026, 9, 25, tzinfo=timezone.utc) + timedelta(seconds=ibkr_helper.IBKR_GAP_RETRY_TTL_SECONDS + 60)
+    monkeypatch.setattr(ibkr_helper, "_ibkr_history_now_utc", lambda: later)
+    ibkr_helper.get_price_data(**window, **_MINUTE_KW)  # same process, marker expired: ask again
+    assert served["pages"] == 2
```

---

### Incident Patch 9: `2dfdda10` (2026-09-26)
**Commit Message**: v4.6.1 - IBKR backtest data fixes, fill prices, dividends, agent tools (#1180)

v4.6.1 - IBKR backtest data fixes, fill prices, dividends, agent tools

**File**: `CHANGELOG.md` (modified, +6/-1)
```diff
@@ -1,12 +1,17 @@
 # Changelog
 
-## 4.6.1 - Unreleased
+## 4.6.1 - 2026-09-25
 
 ### Fixed
+- IBKR intraday history no longer drops the bar just before each page end. An IBKR page ending at T holds bars only up to two bars before T, so pages anchored at a session close lost every session's final bar (SPX 1-minute lost the 15:59 closing bar of every session but the last, verified live; stock extended hours lost 19:59) and pages continuing from the previous page's first bar lost the bar before it (QQQ 5-minute lost a bar about every 3.5 days). Each intraday page now asks one bar later, never past the delayed-feed limit for stocks and indexes; daily requests are unchanged.
+- Routed (BotSpot Auto) stock backtests credit dividends again. The router inherited ThetaData's dividend lookup, which asked the ThetaData corporate-actions API even for stocks whose bars come from IBKR. ThetaData is switched off, every lookup failed quietly, and every dividend was zero (a 400 TLT + 50 SPY hold from June to August 2026 missed $354.40). Assets routed to IBKR now read the dividend on its ex-date from the IBKR daily bars, which already carry it; only assets routed to ThetaData still ask ThetaData. This also removes two failing ThetaData requests per held stock per backtest. A daily frame that ends before the current date is refreshed at most once per simulated day instead of being rescanned on every lookup. Alpaca-routed stocks correctly get no cash dividend, because their prices are dividend-adjusted (Alpaca adjustment="all").
+- IBKR 1-minute stock and index backtests no longer skip sessions missing inside a cached series. The cache check only compared the edges of the requested window, so a cache holding June and September (two earlier backtests) served a June-to-September backtest with July and August missing: no request, no error, and the strategy saw one stale bar for weeks. Interrupted downloads and LumiBot 4.6.0 (which stopped paging at every weekend) left the same holes in the shared cache. Missing sessions inside the window are now downloaded, one request per session; a session IBKR has no bars for is remembered for a day.
+- Trading agents report the actual fill prices, credit or debit, cash change and resulting risk from the order status and fresh account reads, not the planned limit. A 4.6.1 release eval reported a planned $1.00 condor credit when the fills gave $0.80.
 - `get_historical_prices_for_assets()` / `get_bars()` fetch each distinct asset once when the list repeats an asset, instead of raising "assets must not contain duplicate entries" and crashing the backtest (a real strategy listed a holding that was also its own group's proxy).
 - A minute history request in a daily-cadence backtest (for example `sleeptime="1D"`) now returns minute bars or nothing, never daily bars. The ThetaData and routed (`BACKTESTING_DATA_SOURCE` router map) data sources rewrote an explicit `get_historical_prices(asset, 1440, "minute")` into a day request once the backtest ran on a daily sleeptime, so a routed IBKR SPCX backtest got 52 daily bars labeled as a minute answer. Only implicit requests (no timestep) still follow the daily cadence.
 - IBKR 1-minute stock history now pages across weekends, holidays and overnight gaps. The backward pager asks IBKR in 1000-minute pages (16.7 hours); a weekend is about 56 closed hours, so the page ending Monday 04:00 ET is always empty and the pager used to stop there. Multi-week minute backtests only ever saw the last few sessions, reported "IBKR cached history remained underfilled" on every bar, and strategies that need intraday bars never traded. An empty page whose whole window is closed-market time is now stepped over without a request; an empty page during trading time keeps the old stop behavior.
 - IBKR stock and index 1-minute paging now anchors each older page at the previous session's close, so one request covers one whole session. Pages used to straddle the closed overnight gap: about 1.8 downlo
```

**File**: `docs/investigations/2026-09-24_IBKR_PAGING_AND_LISTING_BOUNDARIES.md` (modified, +51/-0)
```diff
@@ -79,6 +79,57 @@ The pager now hands every `IBKR_PAGE_CHECKPOINT_EVERY` (10) pages to a checkpoin
 Test: `tests/backtest/test_routed_backtesting_ibkr_prefetch.py::test_ibkr_minute_paging_checkpoints_pages_so_a_stopped_run_keeps_its_progress`
 (red: no cache file after 25 served pages).
 
+## 8. Holes inside a cached minute series were never fetched (2026-09-25)
+
+Found by the 4.6.1 release gate. `get_price_data` compared only the edges of the requested window with the minute
+cache. A cache holding June and September (two earlier backtests on the same symbol) served a June-to-September
+backtest with July and August missing: zero requests, no error, one stale bar for weeks, zero trades. The same holes
+come from sections 3 and 7 (kept newer pages, page checkpoints) and from LumiBot 4.6.0, which stopped at every weekend
+and wrote those holes into the shared S3 cache. Daily and hourly series already had hole repair; minute did not.
+
+`_repair_us_stock_index_minute_gaps` now runs after the edge checks for US stock and index minute series. It lists NYSE
+sessions strictly between the first and last real bar of the window that have no bar, and fetches each one (one
+request per session, the same cost as a cold walk). A session IBKR answers with no bars (a thin symbol with no prints)
+gets a `minute_session_gap_empty` marker for `IBKR_GAP_RETRY_TTL_SECONDS`, so later backtests do not ask again. A failed
+request writes nothing and is retried by the next process; each series and window is checked once per process.
+
+Cost (CodeRabbit on PR #1180 asked for a time limit): at most one request per session in the window, once per process,
+never more than a cold download of that window. A failed session is not asked again for 5 minutes in the same
+process (a sliding-window caller used to ask it on every bar: 13 requests instead of 4 in the test), and repair pauses
+for the series for 5 minutes after 3 failures in a row (30 requests instead of 3). The pause expires, so a long-lived
+process (notebook, local script, multi-backtest service) repairs the hole once the downloader recovers; the release gate
+found that a permanent give-up served a later backtest 34 of 77 sessions silently. Every serve of a series with known
+unrepaired sessions logs a WARNING naming the symbol, timestep and missing-session count (at most once a minute per
+series within one backtest; every new backtest warns). No wall-clock limit on purpose: results would depend on
+downloader load. Live on the production downloader: a 10-session SPY hole took 10 requests, 52 s (median 5.1 s); the
+next call made none. The session scan uses binary searches: 3 ms for a year of extended-hours minute bars (27 ms with
+per-row date math).
+Tests: `tests/test_ibkr_daily_gap_self_healing.py -k minute` (6 tests; red before the fix: 43 July/August sessions
+missing, 24 and 19 sessions missing after an interrupted download, 10 SPX sessions missing).
+
+Read-only scan of the shared cache on 2026-09-25 (`prod/cache/v44`, the namespace written this week): 1 of 29 intraday
+stock files has a hole (SPY 5-minute, 2026-08-17 to 08-19). The older `prod/cache/v1` namespace (last written 2026-09-08)
+has 5 of 78 files with holes (SPX, APP, QQQ, SPY, TQQQ minute; 233 sessions). With this fix those holes are fetched the
+next time a backtest reads the file, so no manual cleanup is required.
+
+## 9. Every page lost the bar just before its end (2026-09-25)
+
+An IBKR page with `startTime=T` holds bars only up to `T - 2 bars`; the bar that starts one bar before T (and ends at
+T) is left out. The downloader keeps every row it gets inside the window, so this is IBKR's answer. Recorded on the
+production downloader: SPY 1-minute `startTime=20260918-00:00` (20:00 ET) ended at 19:58 ET; SPX 1-minute pages ending
+at the 16:00 ET close held 389 bars ending 15:58; QQQ 5-minute `startTime=20260302-13:40` ended at 13:30 UTC.
+
+Effect: section 6 anchors pages at a session close, so 4.6.1 lost every sess
```

**File**: `docsrc/backtesting.ibkr.rst` (modified, +6/-0)
```diff
@@ -66,6 +66,12 @@ IBKR returns at most about 1,000 bars per request, so LumiBot walks backwards pa
   stop 20 minutes before the current time. A backtest that ends today during market hours simply ends a little
   earlier.
 - **Daily windows** up to 993 days are one request sized to the window; longer windows use 5-year pages.
+- **Dividends.** IBKR history has no corporate actions, so LumiBot adds dividends and splits to IBKR daily stock bars
+  from a free corporate-actions source. BotSpot Auto backtests credit a held stock's dividend on its ex-date from
+  those daily bars.
+- **Holes in cached minute bars.** When the cache has bars on both sides of a missing session (for example from two
+  earlier backtests, or a download that was stopped), LumiBot downloads each missing session instead of skipping it.
+  A session with no trades at all is remembered for a day so it is not requested again by every backtest.
 
 Futures Exchange Routing (auto + override)
 ------------------------------------------
```

**File**: `lumibot/backtesting/routed_backtesting.py` (modified, +90/-1)
```diff
@@ -12,7 +12,7 @@
 from lumibot.backtesting.thetadata_backtesting_pandas import ThetaDataBacktestingPandas
 from lumibot.constants import LUMIBOT_DEFAULT_PYTZ
 from lumibot.credentials import ALPACA_CONFIG, COINBASE_CONFIG, KRAKEN_CONFIG, POLYGON_API_KEY
-from lumibot.entities import Asset, Data
+from lumibot.entities import Asset, AssetsMapping, Data
 from lumibot.tools import ibkr_helper
 from lumibot.tools import polygon_helper
 from lumibot.tools.helpers import parse_timestep_qty_and_unit
@@ -1189,6 +1189,95 @@ def _provider_spec_for_asset(self, asset: Asset) -> ProviderSpec:
             raw = self._routing.get(asset_type) or self._routing.get("default") or "thetadata"
         return self._registry.resolve_provider_spec(raw)
 
+    @staticmethod
+    def _frame_last_date(frame):
+        if frame is None or not len(getattr(frame, "index", [])):
+            return None
+        index = pd.DatetimeIndex(frame.index)
+        if index.tz is not None:
+            index = index.tz_convert(LUMIBOT_DEFAULT_PYTZ)
+        return index.max().date()
+
+    def get_yesterday_dividends(self, assets, quote=None):
+        """Return each asset's dividend for the current backtest date from the provider of its bars.
+
+        WHY (2026-09-25): this class inherited ThetaData's override, which asks the ThetaData
+        corporate-actions API for every stock, including stocks whose bars come from IBKR.
+        ThetaData is switched off (2026-09-23), every lookup failed quietly, and every BotSpot
+        Auto stock backtest got zero dividends: a 400 TLT + 50 SPY hold from June to August
+        2026 kept its cash flat. IBKR daily bars already carry the dividend on its ex-date
+        (`ibkr_helper._append_equity_corporate_actions_daily`), so only assets routed to
+        ThetaData still ask ThetaData.
+
+        Alpaca-routed stocks correctly get no cash dividend: the routed Alpaca source keeps
+        AlpacaBacktesting's default auto_adjust=True, which requests adjustment="all" bars, so
+        dividends are already in the price series. Crediting cash on top would count them twice.
+        """
+        theta_assets = []
+        routed_assets = []
+        for asset in assets:
+            try:
+                provider = self._provider_spec_for_asset(asset).provider
+            except Exception:
+                provider = "thetadata"
+            (theta_assets if provider == "thetadata" else routed_assets).append(asset)
+
+        result = {}
+        if theta_assets:
+            result.update(dict(super().get_yesterday_dividends(theta_assets, quote=quote).items()))
+        if not routed_assets:
+            return AssetsMapping(result)
+
+        current_date = self._datetime.date() if hasattr(self._datetime, "date") else self._datetime
+        cache = getattr(self, "_routed_dividend_cache", None)
+        if cache is None:
+            cache = self._routed_dividend_cache = {}
+        for asset in routed_assets:
+            cached = cache.get(asset)
+            # Rebuild when nothing is cached, or when the cached daily frame ended before today
+            # and it has not been refreshed today yet. Checking once per simulated day matters:
+            # an intraday strategy asks on every iteration, and a frame that stays short (IBKR has
+            # no newer daily bar yet) was rescanned in full on every call (CodeRabbit, PR #1180).
+            stale = cached is not None and (cached["last_date"] is None or current_date > cached["last_date"])
+            if cached is None or (stale and cached["checked_date"] != current_date):
+                frame = self._get_backtest_daily_corporate_action_frame(asset, quote=quote)
+                frame_last = self._frame_last_date(frame)
+                if frame is None or "dividend" not in frame.columns or frame_last is None or frame_last < current_date:
+                    try:
+                        # Loads or extends the native daily series; routed IBKR prefetches the
+ 
```

**File**: `lumibot/backtesting/thetadata_backtesting_pandas.py` (modified, +8/-0)
```diff
@@ -2807,6 +2807,14 @@ def _has_loaded_intraday_series(self, asset, quote=None) -> bool:
                     now = now.tz_localize(None)
                 elif index.tz is not None:
                     now = now.tz_convert(index.tz) if now.tzinfo is not None else now.tz_localize(index.tz)
+                if index.is_monotonic_increasing:
+                    # Binary search, not a mask: this runs on every quote and last-price
+                    # lookup, and a full-index mask over an 8-month minute series cost
+                    # about 0.4 ms per call.
+                    pos = int(index.searchsorted(now, side="right"))
+                    if pos > 0 and index[pos - 1] > now - pd.Timedelta(days=4):
+                        return True
+                    continue
                 recent = index[(index <= now) & (index > now - pd.Timedelta(days=4))]
                 if len(recent) > 0:
                     return True
```

---

### Incident Patch 10: `ed67175a` (2026-09-26)
**Commit Message**: fix(ibkr): minute-hole repair retries after a cooldown and warns when serving holes

Release gate finding on 6d3f3c1a: after 3 consecutive failed repair
requests a series was given up for the life of the process. In a long-lived
process (notebook, local script, multi-backtest service) a later backtest ran
after the downloader recovered and silently got 34 of 77 sessions, with no
request and no warning (probe_cap_and_memory.py).

- Failed-session and given-up marks now carry a monotonic timestamp and
  expire after IBKR_MINUTE_GAP_RETRY_COOLDOWN_SECONDS (300 s); a successful
  retry clears the session's mark. _ibkr_monotonic() is the test seam.
- A series with unresolved sessions is no longer marked "checked", so later
  calls re-scan (3 ms) and retry once the cooldown has passed.
- Every serve of a series with known unrepaired sessions logs a WARNING
  naming symbol, timestep, missing-session count and first/last session. It
  is limited to once a minute per series within one backtest, so a
  sliding-window caller does not log one per bar; the limit is keyed on the
  downloader queue client id that every backtest data source sets, so each
  new backtest in the process warns.

Red f

**File**: `docs/investigations/2026-09-24_IBKR_PAGING_AND_LISTING_BOUNDARIES.md` (modified, +7/-3)
```diff
@@ -94,9 +94,13 @@ gets a `minute_session_gap_empty` marker for `IBKR_GAP_RETRY_TTL_SECONDS`, so la
 request writes nothing and is retried by the next process; each series and window is checked once per process.
 
 Cost (CodeRabbit on PR #1180 asked for a time limit): at most one request per session in the window, once per process,
-never more than a cold download of that window. A failed session is not asked again in the same process (a
-sliding-window caller used to ask it on every bar: 13 requests instead of 4 in the test), and repair stops for the
-series after 3 failures in a row (30 requests instead of 3). No wall-clock limit on purpose: results would depend on
+never more than a cold download of that window. A failed session is not asked again for 5 minutes in the same
+process (a sliding-window caller used to ask it on every bar: 13 requests instead of 4 in the test), and repair pauses
+for the series for 5 minutes after 3 failures in a row (30 requests instead of 3). The pause expires, so a long-lived
+process (notebook, local script, multi-backtest service) repairs the hole once the downloader recovers; the release gate
+found that a permanent give-up served a later backtest 34 of 77 sessions silently. Every serve of a series with known
+unrepaired sessions logs a WARNING naming the symbol, timestep and missing-session count (at most once a minute per
+series within one backtest; every new backtest warns). No wall-clock limit on purpose: results would depend on
 downloader load. Live on the production downloader: a 10-session SPY hole took 10 requests, 52 s (median 5.1 s); the
 next call made none. The session scan uses binary searches: 3 ms for a year of extended-hours minute bars (27 ms with
 per-row date math).
```

**File**: `lumibot/tools/ibkr_helper.py` (modified, +89/-31)
```diff
@@ -82,6 +82,12 @@
 # consecutive failed requests, because the downloader is then down, not the data missing.
 IBKR_MINUTE_GAP_REPAIR_MAX_CONSECUTIVE_FAILURES = 3
 IBKR_MINUTE_GAP_MARKER_REASON = "minute_session_gap_empty"
+# A failed repair request, or a series given up after consecutive failures, is retried after
+# this long in the same process (a notebook or multi-backtest service outlives an outage).
+IBKR_MINUTE_GAP_RETRY_COOLDOWN_SECONDS = 300.0
+# Serving a minute series with known unrepaired sessions logs a WARNING, at most this often
+# per series so a sliding-window caller does not log one per bar.
+IBKR_MINUTE_GAP_WARNING_INTERVAL_SECONDS = 60.0
 # Backward pagination of US stock intraday history steps over closed-market pages
 # (weekends, holidays, overnight) instead of treating their empty answer as the start
 # of history. A 1000-minute page is 16.7 hours, a weekend is about 56 closed hours.
@@ -138,11 +144,14 @@ class IbkrFuturesConidLookupError(RuntimeError):
     str,
     tuple[tuple[int, str, str, int], datetime, datetime],
 ] = {}
-# Per-process memory for the minute-hole repair (in memory only; the next process retries):
-# sessions whose request failed, and series whose repair stopped after consecutive failures.
-# Without it a sliding-window caller asked the same failing session on every bar.
-_RUNTIME_MINUTE_GAP_FAILED_SESSIONS: Dict[str, set] = {}
-_RUNTIME_MINUTE_GAP_REPAIR_STOPPED: set[str] = set()
+# Per-process memory for the minute-hole repair, in memory only, with monotonic timestamps so
+# it expires after IBKR_MINUTE_GAP_RETRY_COOLDOWN_SECONDS: sessions whose request failed, and
+# series whose repair stopped after consecutive failures. Without it a sliding-window caller
+# asked the same failing session on every bar; without the expiry a long-lived process kept a
+# hole after the downloader recovered.
+_RUNTIME_MINUTE_GAP_FAILED_SESSIONS: Dict[str, Dict[pd.Timestamp, float]] = {}
+_RUNTIME_MINUTE_GAP_REPAIR_STOPPED: Dict[str, float] = {}
+_RUNTIME_MINUTE_GAP_LAST_WARNING: Dict[str, float] = {}
 _DISABLE_CONIDS_REMOTE_UPLOAD = False
 _LOGGED_CONIDS_REMOTE_UPLOAD_DISABLE = False
 _LOGGED_HISTORY_ALIASES: set[str] = set()
@@ -516,6 +525,11 @@ def _ibkr_history_now_utc() -> datetime:
     return datetime.now(timezone.utc)
 
 
+def _ibkr_monotonic() -> float:
+    """Monotonic clock for in-process cooldowns (a seam so tests can advance it)."""
+    return time.monotonic()
+
+
 def _is_chart_data_unavailable(exc: BaseException) -> bool:
     return "chart data unavailable" in str(exc).lower()
 
@@ -3725,8 +3739,10 @@ def _repair_us_stock_index_minute_gaps(
     Cost bound (CodeRabbit on PR #1180 asked for a timer): at most one request per session in
     the requested window, once per process, which is never more than downloading that window
     cold (live 2026-09-25: a 10-session SPY hole took 10 requests, 52 s; the next call made
-    none). A session whose request failed is not asked again in this process, and repair stops
-    for the series after IBKR_MINUTE_GAP_REPAIR_MAX_CONSECUTIVE_FAILURES in a row. There is
+    none). A session whose request failed is not asked again in this process until
+    IBKR_MINUTE_GAP_RETRY_COOLDOWN_SECONDS pass, repair pauses for the series for the same
+    cooldown after IBKR_MINUTE_GAP_REPAIR_MAX_CONSECUTIVE_FAILURES in a row, and every serve
+    of a series with known unrepaired sessions logs a WARNING (at most once a minute). There is
     deliberately no wall-clock limit: it would leave July missing on a busy downloader and not
     on a quiet one, which is the silent-hole bug this repair exists to fix.
     """
@@ -3757,21 +3773,31 @@ def _repair_us_stock_index_minute_gaps(
         ):
             return df_cache
 
-    if series_key in _RUNTIME_MINUTE_GAP_REPAIR_STOPPED:
+    all_missing = _missing_us_minute_sessions(df_cache, start_dt=start_dt, end_dt=end_dt)
+    if not all_missing:
+        _RUNTIME_MINUTE_GAP_CHECKED_SERIES[series_key] = (
+    
```

**File**: `tests/test_ibkr_daily_gap_self_healing.py` (modified, +84/-4)
```diff
@@ -630,7 +630,8 @@ def _new_minute_process(monkeypatch, feed) -> None:
     monkeypatch.setattr(ibkr_helper, "_RUNTIME_HISTORY_NO_DATA_WINDOWS", {})
     monkeypatch.setattr(ibkr_helper, "_RUNTIME_MINUTE_GAP_CHECKED_SERIES", {}, raising=False)
     monkeypatch.setattr(ibkr_helper, "_RUNTIME_MINUTE_GAP_FAILED_SESSIONS", {}, raising=False)
-    monkeypatch.setattr(ibkr_helper, "_RUNTIME_MINUTE_GAP_REPAIR_STOPPED", set(), raising=False)
+    monkeypatch.setattr(ibkr_helper, "_RUNTIME_MINUTE_GAP_REPAIR_STOPPED", {}, raising=False)
+    monkeypatch.setattr(ibkr_helper, "_RUNTIME_MINUTE_GAP_LAST_WARNING", {}, raising=False)
     monkeypatch.setattr(ibkr_helper, "queue_request", feed)
 
 
@@ -819,7 +820,7 @@ def _cache_two_weeks_with_a_hole(monkeypatch, vendor):
                                end_dt=datetime(2026, 8, 14, 23, 59, tzinfo=timezone.utc), **_MINUTE_KW)
 
 
-def test_minute_hole_session_that_failed_is_not_requested_again_in_the_same_process(monkeypatch, tmp_path) -> None:
+def test_minute_hole_session_that_failed_is_not_requested_again_within_the_cooldown(monkeypatch, tmp_path) -> None:
     """CodeRabbit on PR #1180 worried the minute repair can stall a backtest. Its cost is one request
     per missing session, the same as downloading that window cold, but a session whose request
     FAILED was asked again by every later call with a different window in the same process (a
@@ -833,11 +834,11 @@ def test_minute_hole_session_that_failed_is_not_requested_again_in_the_same_proc
     for minute in range(10):  # ten calls, each with a slightly wider window
         ibkr_helper.get_price_data(start_dt=datetime(2026, 8, 3, 8, tzinfo=timezone.utc),
                                    end_dt=datetime(2026, 8, 14, 23, minute, tzinfo=timezone.utc), **_MINUTE_KW)
-    # Aug 6, 10 and 11 are fetched once; Aug 7 is asked once and not again this process.
+    # Aug 6, 10 and 11 are fetched once; Aug 7 is asked once and not again within the cooldown.
     assert served["pages"] == 4
 
 
-def test_minute_hole_repair_stops_for_the_process_when_the_downloader_keeps_failing(monkeypatch, tmp_path) -> None:
+def test_minute_hole_repair_pauses_while_the_downloader_keeps_failing(monkeypatch, tmp_path) -> None:
     _minute_setup(monkeypatch, tmp_path)
     vendor = _minute_vendor(_minute_days("2026-08-03", "2026-08-14"))
     _cache_two_weeks_with_a_hole(monkeypatch, vendor)
@@ -882,3 +883,82 @@ def test_minute_hole_scan_finds_no_false_holes_across_daylight_saving_switches()
         holey = frame.loc[~frame.index.tz_convert(_NY).strftime("%Y-%m-%d").isin([_minute_days(first, last)[5]])]
         found = ibkr_helper._missing_us_minute_sessions(holey, start_dt=start, end_dt=end)
         assert [open_.date().isoformat() for open_, _ in found] == [_minute_days(first, last)[5]]
+
+
+class _Clock:
+    def __init__(self):
+        self.now = 1000.0
+
+    def __call__(self):
+        return self.now
+
+
+def test_minute_hole_repair_retries_in_the_same_process_after_the_downloader_recovers(monkeypatch, tmp_path) -> None:
+    """Release gate probe, 2026-09-25: after 3 failed repair requests the series was given up for the
+    life of the process. A second backtest in the same long-lived process (a notebook, a local
+    script, a multi-backtest service) ran after the downloader recovered and silently got 34 of 77
+    sessions, with no request and no warning. Failed marks now expire after a cooldown."""
+    _minute_setup(monkeypatch, tmp_path)
+    clock = _Clock()
+    monkeypatch.setattr(ibkr_helper, "_ibkr_monotonic", clock, raising=False)
+    vendor = _minute_vendor(_minute_days("2026-08-03", "2026-08-14"))
+    _cache_two_weeks_with_a_hole(monkeypatch, vendor)
+    window = dict(start_dt=datetime(2026, 8, 3, 8, tzinfo=timezone.utc),
+                  end_dt=datetime(2026, 8, 14, 23, 59, tzinfo=timezone.utc))
+
+    feed, _ = _failing_minute_feed(vendor, failing_days=None)
+    _new_minute_process(monkeypatch, feed)
+    ibkr_helper.get_pri
```

#### Recent Merged Pull Requests:
- **PR #1181** (2026-09-27): v4.6.2 - IBKR paging, lookahead and precision fixes (@grzesir)
- **PR #1180** (2026-09-26): v4.6.1 - IBKR backtest data fixes, fill prices, dividends, agent tools (@grzesir)
- **PR #1178** (2026-09-24): v4.6.0 - AI agents, Alpaca backtest config fix, IBKR window loop fix (@grzesir)
- **PR #1176** (closed): 4.5.92 (re-cut after agent eval gate) (@grzesir)
- **PR #1174** (2026-09-23): v4.5.92 - Alpaca backtesting on the BotSpot path, IBKR request loop, GPT-6 Luna support (@grzesir)
- **PR #1173** (closed): Add scoped email and Slack communications (@grzesir)
- **PR #1172** (closed): Austin 20260912 001 (@austinjung)
- **PR #1171** (2026-09-13): Preserve newer broker positions during overlapping refreshes (@mpelteshki)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
