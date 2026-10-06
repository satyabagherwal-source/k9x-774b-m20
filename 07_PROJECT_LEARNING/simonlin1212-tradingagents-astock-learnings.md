# Forensic Learning Record (Deep Inspection): simonlin1212/TradingAgents-astock

> **Canonical Artifact**: `07_PROJECT_LEARNING/simonlin1212-tradingagents-astock-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/simonlin1212/TradingAgents-astock](https://github.com/simonlin1212/TradingAgents-astock))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:02:47.542Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `simonlin1212/TradingAgents-astock`
- **Description**: A股多Agent投研框架 — 适配A股数据源(龙虎榜/游资/解禁等)，7位分析师基于A股规则的辩论决策，基于TradingAgents深度改造，适配大A。A-share multi-agent investment research framework — 7 AI analysts, bull/bear debate, risk assessment。
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 3627 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/utils.py`
```
import questionary
from typing import List, Optional, Tuple, Dict

from rich.console import Console

from cli.models import AnalystType
from tradingagents.llm_clients.model_catalog import get_model_options

console = Console()

TICKER_INPUT_EXAMPLES = "Examples: SPY, CNC.TO, 7203.T, 0700.HK"

ANALYST_ORDER = [
    ("Market Analyst", AnalystType.MARKET),
    ("Social Media Analyst", AnalystType.SOCIAL),
    ("News Analyst", AnalystType.NEWS),
    ("Fundamentals Analyst", AnalystType.FUNDAMENTALS),
]


def get_ticker() -> str:
    """Prompt the user to enter a ticker symbol."""
    ticker = questionary.text(
        f"Enter the exact ticker symbol to analyze ({TICKER_INPUT_EXAMPLES}):",
        validate=lambda x: len(x.strip()) > 0 or "Please enter a valid ticker symbol.",
        style=questionary.Style(
            [
                ("text", "fg:green"),
                ("highlighted", "noinherit"),
            ]
        ),
    ).ask()

    if not ticker:
        console.print("\n[red]No ticker symbol provided. Exiting...[/red]")
        exit(1)

    return normalize_ticker_symbol(ticker)


def normalize_ticker_symbol(ticker: str) -> str:
    """Normalize ticker input while preserving exchange suffixes.

    Also validates the result is safe to interpolate into a filesystem path —
    the ticker becomes a directory name under ``results_dir`` and the report
    save path, so an input like ``../../tmp/evil`` would otherwise escape the
    intended directory (#51). ``safe_ticker_component`` rejects ``/``, ``..``,
    ``~`` etc. and auto-resolves Chinese names to A-stock codes; it raises
    ``ValueError`` on anything unsafe.
    """
    from tradingagents.dataflows.utils import safe_ticker_component

    return safe_ticker_component(ticker.strip().upper())


def get_analysis_date() -> str:
    """Prompt the user to enter a date in YYYY-MM-DD format."""
    import re
    from datetime import datetime

    def validate_date(date_str: str) -> bool:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
            return False
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
            return True
        except ValueError:
            return False

    date = questionary.text(
        "Enter the analysis date (YYYY-MM-DD):",
        validate=lambda x: validate_date(x.strip())
        or "Please enter a valid date in YYYY-MM-DD format.",
        style=questionary.Style(
            [
                ("text", "fg:green"),
                ("highlighted", "noinherit"),
            ]
        ),
    ).ask()

    if not date:
        console.print("\n[red]No date provided. Exiting...[/red]")
        exit(1)

    return date.strip()


def select_analysts() -> List[AnalystType]:
    """Select analysts using an interactive checkbox."""
    choices = questionary.checkbox(
        "Select Your [Analysts Team]:",
        choices=[
            questionary.Choice(display, value=value) for display, value in ANALYST_ORDER
        ],
        instruction="\n- Press Space to select/unselect analysts\n- Press 'a' to select/unselect all\n- Press Enter when done",
        validate=lambda x: len(x) > 0 or "You must select at least one analyst.",
        style=questionary.Style(
            [
                ("checkbox-selected", "fg:green"),
                ("selected", "fg:green noinherit"),
                ("highlighted", "noinherit"),
                ("pointer", "noinherit"),
            ]
        ),
    ).ask()

    if not choices:
        console.print("\n[red]No analysts selected. Exiting...[/red]")
        exit(1)

    return choices


def select_research_depth() -> int:
    """Select research depth using an interactive selection."""

    # Define research depth options with their corresponding values
    DEPTH_OPTIONS = [
        ("Shallow - Quick research, few debate and strategy discussion rounds", 1),
        ("Medium - Middle ground, moderate debate rounds and strategy discussion", 3),
        ("Deep - Comprehensive research, in depth debate and strategy discussion", 5),
    ]

    choice = questionary.select(
        "Select Your [Research Depth]:",
        choices=[
            questionary.Choice(display, value=value) for display, value in DEPTH_OPTIONS
        ],
        instruction="\n- Use arrow keys to navigate\n- Press Enter to select",
        style=questionary.Style(
            [
                ("selected", "fg:yellow noinherit"),
                ("highlighted", "fg:yellow noinherit"),
                ("pointer", "fg:yellow noinherit"),
            ]
        ),
    ).ask()

    if choice is None:
        console.print("\n[red]No research depth selected. Exiting...[/red]")
        exit(1)

    return choice


def _fetch_openrouter_models() -> List[Tuple[str, str]]:
    """Fetch available models from the OpenRouter API."""
    import requests
    try:
        resp = requests.get("https://openrouter.ai/api/v1/models", timeout=10)
        resp.raise_for_status()
        models = resp.json().get("data", [])
        return [(m.get("name") or m["id"], m["id"]) for m in models]
    except Exception as e:
        console.print(f"\n[yellow]Could not fetch OpenRouter models: {e}[/yellow]")
        return []


def select_openrouter_model() -> str:
    """Select an OpenRouter model from the newest available, or enter a custom ID."""
    models = _fetch_openrouter_models()

    choices = [questionary.Choice(name, value=mid) for name, mid in models[:5]]
    choices.append(questionary.Choice("Custom model ID", value="custom"))

    choice = questionary.select(
        "Select OpenRouter Model (latest available):",
        choices=choices,
        instruction="\n- Use arrow keys to navigate\n- Press Enter to select",
        style=questionary.Style([
            ("selected", "fg:magenta noinherit"),
            ("highlighted", "fg:magenta noinherit"),
            ("pointer", "fg:magenta noinherit"),
        ]),
    ).ask()

    if choice is None or choice == "custom":
        return questionary.text(
            "Enter OpenRouter model ID (e.g. google/gemma-4-26b-a4b-it):",
            validate=lambda x: len(x.strip()) > 0 or "Please enter a model ID.",
        ).ask().strip()

    return choice


def _prompt_custom_model_id() -> str:
    """Prompt user to type a custom model ID."""
    return questionary.text(
        "Enter model ID:",
        validate=lambda x: len(x.strip()) > 0 or "Please enter a model ID.",
    ).ask().strip()


def _select_model(provider: str, mode: str) -> str:
    """Select a model for the given provider and mode (quick/deep)."""
    if provider.lower() == "openrouter":
        return select_openrouter_model()

    if provider.lower() == "openai_compatible":
        return _prompt_custom_model_id()

    if provider.lower() == "azure":
        return questionary.text(
            f"Enter Azure deployment name ({mode}-thinking):",
            validate=lambda x: len(x.strip()) > 0 or "Please enter a deployment name.",
        ).ask().strip()

    choice = questionary.select(
        f"Select Your [{mode.title()}-Thinking LLM Engine]:",
        choices=[
            questionary.Choice(display, value=value)
            for display, value in get_model_options(provider, mode)
        ],
        instruction="\n- Use arrow keys to navigate\n- Press Enter to select",
        style=questionary.Style(
            [
                ("selected", "fg:magenta noinherit"),
                ("highlighted", "fg:magenta noinherit"),
                ("pointer", "fg:magenta noinherit"),
            ]
        ),
    ).ask()

    if choice is None:
        console.print(f"\n[red]No {mode} thinking llm engine selected. Exiting...[/red]")
        exit(1)

    if choice == "custom":
        return _prompt_custom_model_id()

    return choice


def select_shallow_thinking_agent(provider) -> str:
    """Select shallow thinking llm engine using an interactive selection."""
    return _select_model(provider, "quick")


def select_deep_thinking_agent(provider) -> str:
    """Select deep thinking llm engine using an interactive selection."""
    return _select_model(provider, "deep")

def select_llm_provider() -> tuple[str, str | None]:
    """Select the LLM provider and its API endpoint."""
    # (display_name, provider_key, base_url)
    PROVIDERS = [
        ("OpenAI", "openai", "https://api.openai.com/v1"),
        ("Google", "google", None),
        ("Anthropic", "anthropic", "https://api.anthropic.com/"),
        ("xAI", "xai", "https://api.x.ai/v1"),
        ("DeepSeek", "deepseek", "https://api.deepseek.com"),
        ("Qwen", "qwen", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
        ("GLM", "glm", "https://open.bigmodel.cn/api/paas/v4/"),
        ("OpenRouter", "openrouter", "https://openrouter.ai/api/v1"),
        ("OpenAI-Compatible (custom base URL / 自定义 OpenAI 兼容网关)", "openai_compatible", None),
        ("Azure OpenAI", "azure", None),
        ("Ollama", "ollama", "http://localhost:11434/v1"),
    ]

    choice = questionary.select(
        "Select your LLM Provider:",
        choices=[
            questionary.Choice(display, value=(provider_key, url))
            for display, provider_key, url in PROVIDERS
        ],
        instruction="\n- Use arrow keys to navigate\n- Press Enter to select",
        style=questionary.Style(
            [
                ("selected", "fg:magenta noinherit"),
                ("highlighted", "fg:magenta noinherit"),
                ("pointer", "fg:magenta noinherit"),
            ]
        ),
    ).ask()

    if choice is None:
        console.print("\n[red]No LLM provider selected. Exiting...[/red]")
        exit(1)

    provider, url = choice

    # The generic OpenAI-compatible relay has no fixed endpoint — prompt for it.
    # The API key is read from OPENAI_COMPATIBLE_API_KEY (or OPENAI_API_KEY).
    if provider == "openai_compatible":
        url = questionary.text(
            "Enter the OpenAI-compatible Base URL (e.g. https://your-relay.example/v1):",
```

### Core Architecture Module: `tradingagents/agents/utils/agent_states.py`
```
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph import MessagesState


# Researcher team state
class InvestDebateState(TypedDict):
    bull_history: Annotated[
        str, "Bullish Conversation history"
    ]  # Bullish Conversation history
    bear_history: Annotated[
        str, "Bearish Conversation history"
    ]  # Bullish Conversation history
    history: Annotated[str, "Conversation history"]  # Conversation history
    current_response: Annotated[str, "Latest response"]  # Last response
    judge_decision: Annotated[str, "Final judge decision"]  # Last response
    count: Annotated[int, "Length of the current conversation"]  # Conversation length


# Risk management team state
class RiskDebateState(TypedDict):
    aggressive_history: Annotated[
        str, "Aggressive Agent's Conversation history"
    ]  # Conversation history
    conservative_history: Annotated[
        str, "Conservative Agent's Conversation history"
    ]  # Conversation history
    neutral_history: Annotated[
        str, "Neutral Agent's Conversation history"
    ]  # Conversation history
    history: Annotated[str, "Conversation history"]  # Conversation history
    latest_speaker: Annotated[str, "Analyst that spoke last"]
    current_aggressive_response: Annotated[
        str, "Latest response by the aggressive analyst"
    ]  # Last response
    current_conservative_response: Annotated[
        str, "Latest response by the conservative analyst"
    ]  # Last response
    current_neutral_response: Annotated[
        str, "Latest response by the neutral analyst"
    ]  # Last response
    judge_decision: Annotated[str, "Judge's decision"]
    count: Annotated[int, "Length of the current conversation"]  # Conversation length


class AgentState(MessagesState):
    company_of_interest: Annotated[str, "Company that we are interested in trading"]
    trade_date: Annotated[str, "What date we are trading at"]

    sender: Annotated[str, "Agent that sent this message"]

    # research step
    market_report: Annotated[str, "Report from the Market Analyst"]
    sentiment_report: Annotated[str, "Report from the Social Media Analyst"]
    news_report: Annotated[
        str, "Report from the News Researcher of current world affairs"
    ]
    fundamentals_report: Annotated[str, "Report from the Fundamentals Researcher"]
    policy_report: Annotated[str, "Report from the Policy Analyst (A-stock specific)"]
    hot_money_report: Annotated[str, "Report from the Hot Money Tracker (A-stock specific)"]
    lockup_report: Annotated[str, "Report from the Lockup/Reduction Watcher (A-stock specific)"]

    # data quality gate
    data_quality_summary: Annotated[str, "Quality gate assessment of all analyst reports (hard checks + LLM review)"]

    # researcher team discussion step
    investment_debate_state: Annotated[
        InvestDebateState, "Current state of the debate on if to invest or not"
    ]
    investment_plan: Annotated[str, "Plan generated by the Analyst"]

    trader_investment_plan: Annotated[str, "Plan generated by the Trader"]

    # risk management team discussion step
    risk_debate_state: Annotated[
        RiskDebateState, "Current state of the debate on evaluating risk"
    ]
    final_trade_decision: Annotated[str, "Final decision made by the Risk Analysts"]
    past_context: Annotated[str, "Memory log context injected at run start (same-ticker decisions + cross-ticker lessons)"]

```

### Core Architecture Module: `tradingagents/agents/utils/agent_utils.py`
```
from langchain_core.messages import HumanMessage, RemoveMessage

# Import tools from separate utility files
from tradingagents.agents.utils.core_stock_tools import (
    get_stock_data
)
from tradingagents.agents.utils.technical_indicators_tools import (
    get_indicators
)
from tradingagents.agents.utils.fundamental_data_tools import (
    get_fundamentals,
    get_balance_sheet,
    get_cashflow,
    get_income_statement
)
from tradingagents.agents.utils.news_data_tools import (
    get_news,
    get_insider_transactions,
    get_global_news
)
from tradingagents.agents.utils.signal_data_tools import (
    get_profit_forecast,
    get_hot_stocks,
    get_northbound_flow,
    get_concept_blocks,
    get_fund_flow,
    get_dragon_tiger_board,
    get_lockup_expiry,
    get_industry_comparison,
)


def get_language_instruction() -> str:
    """Return a prompt instruction for the configured output language.

    Returns empty string when English (default), so no extra tokens are used.
    Only applied to user-facing agents (analysts, portfolio manager).
    Internal debate agents stay in English for reasoning quality.
    """
    from tradingagents.dataflows.config import get_config
    lang = get_config().get("output_language", "English")
    if lang.strip().lower() == "english":
        return ""
    return f" Write your entire response in {lang}."


def build_instrument_context(ticker: str) -> str:
    """Describe the exact instrument so agents preserve exchange-qualified tickers."""
    return (
        f"The instrument to analyze is `{ticker}`. "
        "Use this exact ticker in every tool call, report, and recommendation, "
        "preserving any exchange suffix (e.g. `.TO`, `.L`, `.HK`, `.T`). "
        "When a tool argument is named `ticker`, pass only this ticker value; "
        "do not pass company names, sectors, concepts, or search keywords."
    )

def create_msg_delete():
    def delete_messages(state):
        """Clear messages and add placeholder for Anthropic compatibility"""
        messages = state["messages"]

        # Remove all messages
        removal_operations = [RemoveMessage(id=m.id) for m in messages]

        # Add a minimal placeholder message
        placeholder = HumanMessage(content="Continue")

        return {"messages": removal_operations + [placeholder]}

    return delete_messages


        

```

### Core Architecture Module: `tradingagents/agents/utils/context.py`
```
"""辩论历史滚动窗口压缩。

多空 / 风险辩手每轮把完整 `history` 注入 prompt，同时再单独注入一次
`current_response`（恰是 history 的最后一条发言），导致最新发言被重复注入、
注入 token 随辩论轮数平方增长。这里提供 `compact_history`：保留最近
`max_turns` 条发言全文，更早的压成「角色: 首句要点」一行，供辩手在注入前调用。
"""

from __future__ import annotations

import re

# 辩手把每条发言拼成「{角色} Analyst: {正文}」（见 bull/bear 及三个 risk debator 的
# argument 构造）。按「换行 + 角色前缀」切分出各条发言；正文几乎不会出现这类前缀。
_ROUND_SPLIT = re.compile(
    r"\n(?=(?:Bull|Bear|Aggressive|Conservative|Neutral) Analyst:)"
)

# 早期发言压成一行时，首句截断到该长度，避免摘要本身再膨胀。
_SUMMARY_MAX_CHARS = 120


def compact_history(history: str, max_turns: int = 4) -> str:
    """把辩论历史压到「最近 max_turns 条全文 + 更早每条一句摘要」。

    `history` 是纯字符串累积字段（InvestDebateState.history /
    RiskDebateState.history）。发言数不超过 max_turns 时原样返回；超过时把更早的
    发言压成「角色: 首句」一行。默认配置下（多空各 1 轮 = 2 条、风险各 1 轮 =
    3 条）不会触发，仅当调大 max_debate_rounds / max_risk_discuss_rounds 时生效。
    """
    if not history.strip():
        return ""

    turns = [t for t in _ROUND_SPLIT.split(history) if t.strip()]
    if len(turns) <= max_turns:
        return history

    head = turns[:-max_turns]
    tail = turns[-max_turns:]
    summaries = [f"{_speaker(t)}: {_first_sentence(t)}" for t in head]

    return (
        "[早期论点摘要]\n"
        + "\n".join(summaries)
        + "\n\n[近期完整辩论]\n"
        + "\n".join(tail)
    )


def _speaker(turn: str) -> str:
    """取一条发言开头的角色名（如 'Bull Analyst'），识别不到回退 'Analyst'。"""
    text = turn.strip()
    for name in ("Bull", "Bear", "Aggressive", "Conservative", "Neutral"):
        if text.startswith(f"{name} Analyst"):
            return f"{name} Analyst"
    return "Analyst"


def _first_sentence(turn: str) -> str:
    """取一条发言正文的第一句，截断到 _SUMMARY_MAX_CHARS。"""
    body = turn.strip()
    # 去掉开头的「角色: 」前缀（partition 只取第一个冒号后的正文）
    _, _, body = body.partition(":")
    body = body.strip()
    # 取第一句（按中英文句号 / 换行切，取最早出现者），无句号则整段
    stops = [i for i in (body.find(ch) for ch in (".", "。", "!", "！", "?", "？", "\n")) if i != -1]
    if stops:
        body = body[: min(stops) + 1]
    body = body.strip()
    if len(body) > _SUMMARY_MAX_CHARS:
        return body[:_SUMMARY_MAX_CHARS] + "…"
    return body

```

### Core Architecture Module: `tradingagents/agents/utils/core_stock_tools.py`
```
from langchain_core.tools import tool
from typing import Annotated
from tradingagents.dataflows.interface import route_to_vendor


@tool
def get_stock_data(
    symbol: Annotated[str, "6-digit A-stock code (e.g. 600379). Must be numeric, NOT company name or Chinese text"],
    start_date: Annotated[str, "Start date in yyyy-mm-dd format"],
    end_date: Annotated[str, "End date in yyyy-mm-dd format"],
) -> str:
    """
    Retrieve stock price data (OHLCV) for a given stock code.
    Uses the configured core_stock_apis vendor.
    Args:
        symbol (str): 6-digit A-stock code, e.g. 600379, 300750. Must be the numeric code, not the company name.
        start_date (str): Start date in yyyy-mm-dd format
        end_date (str): End date in yyyy-mm-dd format
    Returns:
        str: A formatted dataframe containing the stock price data for the specified stock code in the specified date range.
    """
    return route_to_vendor("get_stock_data", symbol, start_date, end_date)

```

### Core Architecture Module: `tradingagents/agents/utils/fundamental_data_tools.py`
```
from langchain_core.tools import tool
from typing import Annotated
from tradingagents.dataflows.interface import route_to_vendor


@tool
def get_fundamentals(
    ticker: Annotated[str, "6-digit A-stock code (e.g. 600379). Must be numeric, NOT company name"],
    curr_date: Annotated[str, "current date you are trading at, yyyy-mm-dd"],
) -> str:
    """
    Retrieve comprehensive fundamental data for a given ticker symbol.
    Uses the configured fundamental_data vendor.
    Args:
        ticker (str): Ticker symbol of the company
        curr_date (str): Current date you are trading at, yyyy-mm-dd
    Returns:
        str: A formatted report containing comprehensive fundamental data
    """
    return route_to_vendor("get_fundamentals", ticker, curr_date)


@tool
def get_balance_sheet(
    ticker: Annotated[str, "6-digit A-stock code (e.g. 600379). Must be numeric, NOT company name"],
    freq: Annotated[str, "reporting frequency: annual/quarterly"] = "quarterly",
    curr_date: Annotated[str, "current date you are trading at, yyyy-mm-dd"] = None,
) -> str:
    """
    Retrieve balance sheet data for a given ticker symbol.
    Uses the configured fundamental_data vendor.
    Args:
        ticker (str): Ticker symbol of the company
        freq (str): Reporting frequency: annual/quarterly (default quarterly)
        curr_date (str): Current date you are trading at, yyyy-mm-dd
    Returns:
        str: A formatted report containing balance sheet data
    """
    return route_to_vendor("get_balance_sheet", ticker, freq, curr_date)


@tool
def get_cashflow(
    ticker: Annotated[str, "6-digit A-stock code (e.g. 600379). Must be numeric, NOT company name"],
    freq: Annotated[str, "reporting frequency: annual/quarterly"] = "quarterly",
    curr_date: Annotated[str, "current date you are trading at, yyyy-mm-dd"] = None,
) -> str:
    """
    Retrieve cash flow statement data for a given ticker symbol.
    Uses the configured fundamental_data vendor.
    Args:
        ticker (str): Ticker symbol of the company
        freq (str): Reporting frequency: annual/quarterly (default quarterly)
        curr_date (str): Current date you are trading at, yyyy-mm-dd
    Returns:
        str: A formatted report containing cash flow statement data
    """
    return route_to_vendor("get_cashflow", ticker, freq, curr_date)


@tool
def get_income_statement(
    ticker: Annotated[str, "6-digit A-stock code (e.g. 600379). Must be numeric, NOT company name"],
    freq: Annotated[str, "reporting frequency: annual/quarterly"] = "quarterly",
    curr_date: Annotated[str, "current date you are trading at, yyyy-mm-dd"] = None,
) -> str:
    """
    Retrieve income statement data for a given ticker symbol.
    Uses the configured fundamental_data vendor.
    Args:
        ticker (str): Ticker symbol of the company
        freq (str): Reporting frequency: annual/quarterly (default quarterly)
        curr_date (str): Current date you are trading at, yyyy-mm-dd
    Returns:
        str: A formatted report containing income statement data
    """
    return route_to_vendor("get_income_statement", ticker, freq, curr_date)
```

### Core Architecture Module: `tradingagents/agents/utils/memory.py`
```
"""Append-only markdown decision log for TradingAgents."""

from typing import List, Optional
from pathlib import Path
import re

from tradingagents.agents.utils.rating import parse_rating


class TradingMemoryLog:
    """Append-only markdown log of trading decisions and reflections."""

    # HTML comment: cannot appear in LLM prose output, safe as a hard delimiter
    _SEPARATOR = "\n\n<!-- ENTRY_END -->\n\n"
    # Precompiled patterns — avoids re-compilation on every load_entries() call
    _DECISION_RE = re.compile(r"DECISION:\n(.*?)(?=\nREFLECTION:|\Z)", re.DOTALL)
    _REFLECTION_RE = re.compile(r"REFLECTION:\n(.*?)$", re.DOTALL)

    def __init__(self, config: dict = None):
        cfg = config or {}
        self._log_path = None
        path = cfg.get("memory_log_path")
        if path:
            self._log_path = Path(path).expanduser()
            self._log_path.parent.mkdir(parents=True, exist_ok=True)
        # Optional cap on resolved entries. None disables rotation.
        self._max_entries = cfg.get("memory_log_max_entries")

    # --- Write path (Phase A) ---

    def store_decision(
        self,
        ticker: str,
        trade_date: str,
        final_trade_decision: str,
    ) -> None:
        """Append pending entry at end of propagate(). No LLM call."""
        if not self._log_path:
            return
        # Idempotency guard: fast raw-text scan instead of full parse
        if self._log_path.exists():
            raw = self._log_path.read_text(encoding="utf-8")
            for line in raw.splitlines():
                if line.startswith(f"[{trade_date} | {ticker} |") and line.endswith("| pending]"):
                    return
        rating = parse_rating(final_trade_decision)
        tag = f"[{trade_date} | {ticker} | {rating} | pending]"
        entry = f"{tag}\n\nDECISION:\n{final_trade_decision}{self._SEPARATOR}"
        with open(self._log_path, "a", encoding="utf-8") as f:
            f.write(entry)

    # --- Read path (Phase A) ---

    def load_entries(self) -> List[dict]:
        """Parse all entries from log. Returns list of dicts."""
        if not self._log_path or not self._log_path.exists():
            return []
        text = self._log_path.read_text(encoding="utf-8")
        raw_entries = [e.strip() for e in text.split(self._SEPARATOR) if e.strip()]
        entries = []
        for raw in raw_entries:
            parsed = self._parse_entry(raw)
            if parsed:
                entries.append(parsed)
        return entries

    def get_pending_entries(self) -> List[dict]:
        """Return entries with outcome:pending (for Phase B)."""
        return [e for e in self.load_entries() if e.get("pending")]

    def get_past_context(self, ticker: str, n_same: int = 5, n_cross: int = 3) -> str:
        """Return formatted past context string for agent prompt injection."""
        entries = [e for e in self.load_entries() if not e.get("pending")]
        if not entries:
            return ""

        same, cross = [], []
        for e in reversed(entries):
            if len(same) >= n_same and len(cross) >= n_cross:
                break
            if e["ticker"] == ticker and len(same) < n_same:
                same.append(e)
            elif e["ticker"] != ticker and len(cross) < n_cross:
                cross.append(e)

        if not same and not cross:
            return ""

        parts = []
        if same:
            parts.append(f"Past analyses of {ticker} (most recent first):")
            parts.extend(self._format_full(e) for e in same)
        if cross:
            parts.append("Recent cross-ticker lessons:")
            parts.extend(self._format_reflection_only(e) for e in cross)
        return "\n\n".join(parts)

    # --- Update path (Phase B) ---

    def update_with_outcome(
        self,
        ticker: str,
        trade_date: str,
        raw_return: float,
        alpha_return: float,
        holding_days: int,
        reflection: str,
    ) -> None:
        """Replace pending tag and append REFLECTION section using atomic write.

        Finds the first pending entry matching (trade_date, ticker), updates
        its tag with return figures, and appends a REFLECTION section.  Uses
        a temp-file + os.replace() so a crash mid-write never corrupts the log.
        """
        if not self._log_path or not self._log_path.exists():
            return

        text = self._log_path.read_text(encoding="utf-8")
        blocks = text.split(self._SEPARATOR)

        pending_prefix = f"[{trade_date} | {ticker} |"
        raw_pct = f"{raw_return:+.1%}"
        alpha_pct = f"{alpha_return:+.1%}"

        updated = False
        new_blocks = []
        for block in blocks:
            stripped = block.strip()
            if not stripped:
                new_blocks.append(block)
                continue

            lines = stripped.splitlines()
            tag_line = lines[0].strip()

            if (
                not updated
                and tag_line.startswith(pending_prefix)
                and tag_line.endswith("| pending]")
            ):
                # Parse rating from the existing pending tag
                fields = [f.strip() for f in tag_line[1:-1].split("|")]
                rating = fields[2]
                new_tag = (
                    f"[{trade_date} | {ticker} | {rating}"
                    f" | {raw_pct} | {alpha_pct} | {holding_days}d]"
                )
                rest = "\n".join(lines[1:])
                new_blocks.append(
                    f"{new_tag}\n\n{rest.lstrip()}\n\nREFLECTION:\n{reflection}"
                )
                updated = True
            else:
                new_blocks.append(block)

        if not updated:
            return

        new_blocks = self._apply_rotation(new_blocks)
        new_text = self._SEPARATOR.join(new_blocks)
        tmp_path = self._log_path.with_suffix(".tmp")
        tmp_path.write_text(new_text, encoding="utf-8")
        tmp_path.replace(self._log_path)

    def batch_update_with_outcomes(self, updates: List[dict]) -> None:
        """Apply multiple outcome updates in a single read + atomic write.

        Each element of updates must have keys: ticker, trade_date,
        raw_return, alpha_return, holding_days, reflection.
        """
        if not self._log_path or not self._log_path.exists() or not updates:
            return

        text = self._log_path.read_text(encoding="utf-8")
        blocks = text.split(self._SEPARATOR)

        # Build lookup keyed by (trade_date, ticker) for O(1) dispatch
        update_map = {(u["trade_date"], u["ticker"]): u for u in updates}

        new_blocks = []
        for block in blocks:
            stripped = block.strip()
            if not stripped:
                new_blocks.append(block)
                continue

            lines = stripped.splitlines()
            tag_line = lines[0].strip()

            matched = False
            for (trade_date, ticker), upd in list(update_map.items()):
                pending_prefix = f"[{trade_date} | {ticker} |"
                if tag_line.startswith(pending_prefix) and tag_line.endswith("| pending]"):
                    fields = [f.strip() for f in tag_line[1:-1].split("|")]
                    rating = fields[2]
                    raw_pct = f"{upd['raw_return']:+.1%}"
                    alpha_pct = f"{upd['alpha_return']:+.1%}"
                    new_tag = (
                        f"[{trade_date} | {ticker} | {rating}"
                        f" | {raw_pct} | {alpha_pct} | {upd['holding_days']}d]"
                    )
                    rest = "\n".join(lines[1:])
                    new_blocks.append(
                        f"{new_tag}\n\n{rest.lstrip()}\n\nREFLECTION:\n{upd['reflection']}"
                    )
                    del update_map[(trade_date, ticker)]
                    matched = True
                    break

            if not matched:
                new_blocks.append(block)

        new_blocks = self._apply_rotation(new_blocks)
        new_text = self._SEPARATOR.join(new_blocks)
        tmp_path = self._log_path.with_suffix(".tmp")
        tmp_path.write_text(new_text, encoding="utf-8")
        tmp_path.replace(self._log_path)

    # --- Helpers ---

    def _apply_rotation(self, blocks: List[str]) -> List[str]:
        """Drop oldest resolved blocks when their count exceeds max_entries.

        Pending blocks are always kept (they represent unprocessed work).
        Returns ``blocks`` unchanged when rotation is disabled or under cap.
        """
        if not self._max_entries or self._max_entries <= 0:
            return blocks

        # Tag each block with (kept, is_resolved) by parsing tag-line markers.
        decisions = []
        for block in blocks:
            stripped = block.strip()
            if not stripped:
                decisions.append((block, False))
                continue
            tag_line = stripped.splitlines()[0].strip()
            is_resolved = (
                tag_line.startswith("[")
                and tag_line.endswith("]")
                and not tag_line.endswith("| pending]")
            )
            decisions.append((block, is_resolved))

        resolved_count = sum(1 for _, r in decisions if r)
        if resolved_count <= self._max_entries:
            return blocks

        to_drop = resolved_count - self._max_entries
        kept: List[str] = []
        for block, is_resolved in decisions:
            if is_resolved and to_drop > 0:
                to_drop -= 1
                continue
            kept.append(block)
        return kept

    def _parse_entry(self, raw: str) -> Optional[dict]:
        lines = raw.strip().splitlines()
        if not lines:
            return None
        tag_line = lines[0].strip()
        if not (tag_line.startswith("[") and tag_line.endswith("]")):
            return None
        fields = [f.strip() for f in tag_line[1:-1].split("|")]
        if len(fiel
```

### Core Architecture Module: `tradingagents/agents/utils/news_data_tools.py`
```
from langchain_core.tools import tool
from typing import Annotated
import re
from tradingagents.dataflows.interface import route_to_vendor

_A_STOCK_CODE_RE = re.compile(r"^\d{6}$")


def _invalid_a_stock_code_message(tool_name: str, ticker: str) -> str:
    return (
        f"Invalid ticker for `{tool_name}`: {ticker!r}. "
        "This tool only accepts a 6-digit A-stock code, not Chinese text, "
        "company names, sector names, concepts, or search keywords. "
        "Use the original analysis ticker/code in the tool call."
    )


def _validate_a_stock_code(tool_name: str, ticker: str) -> tuple[bool, str]:
    code = str(ticker or "").strip()
    if not _A_STOCK_CODE_RE.fullmatch(code):
        return False, _invalid_a_stock_code_message(tool_name, code)
    return True, code


@tool
def get_news(
    ticker: Annotated[str, "6-digit A-stock code (e.g. 600379). Must be numeric, NOT company name or Chinese text"],
    start_date: Annotated[str, "Start date in yyyy-mm-dd format"],
    end_date: Annotated[str, "End date in yyyy-mm-dd format"],
) -> str:
    """
    Retrieve news data for a given stock code.
    Uses the configured news_data vendor.
    Args:
        ticker (str): 6-digit A-stock code, e.g. 600379, 300750. Must be the numeric code, not the company name.
        start_date (str): Start date in yyyy-mm-dd format
        end_date (str): End date in yyyy-mm-dd format
    Returns:
        str: A formatted string containing news data
    """
    ok, code_or_message = _validate_a_stock_code("get_news", ticker)
    if not ok:
        return code_or_message
    return route_to_vendor("get_news", code_or_message, start_date, end_date)

@tool
def get_global_news(
    curr_date: Annotated[str, "Current date in yyyy-mm-dd format"],
    look_back_days: Annotated[int, "Number of days to look back"] = 7,
    limit: Annotated[int, "Maximum number of articles to return"] = 5,
) -> str:
    """
    Retrieve global news data.
    Uses the configured news_data vendor.
    Args:
        curr_date (str): Current date in yyyy-mm-dd format
        look_back_days (int): Number of days to look back (default 7)
        limit (int): Maximum number of articles to return (default 5)
    Returns:
        str: A formatted string containing global news data
    """
    return route_to_vendor("get_global_news", curr_date, look_back_days, limit)

@tool
def get_insider_transactions(
    ticker: Annotated[str, "6-digit A-stock code (e.g. 600379). Must be numeric, NOT company name"],
) -> str:
    """
    Retrieve insider transaction information about a company.
    Uses the configured news_data vendor.
    Args:
        ticker (str): 6-digit A-stock code, e.g. 600379
    Returns:
        str: A report of insider transaction data
    """
    ok, code_or_message = _validate_a_stock_code("get_insider_transactions", ticker)
    if not ok:
        return code_or_message
    return route_to_vendor("get_insider_transactions", code_or_message)

```

### Core Architecture Module: `tradingagents/agents/utils/rating.py`
```
"""Shared 5-tier rating vocabulary and a deterministic heuristic parser.

The same five-tier scale (Buy, Overweight, Hold, Underweight, Sell) is used by:
- The Research Manager (investment plan recommendation)
- The Portfolio Manager (final position decision)
- The signal processor (rating extracted for downstream consumers)
- The memory log (rating tag stored alongside each decision entry)

Centralising it here avoids drift between those call sites.

Chinese output: when ``output_language`` is Chinese and a weak model or an
OpenAI-compatible relay falls back from structured output to free-text (see
:func:`tradingagents.agents.utils.structured.invoke_structured_or_freetext`),
the final decision arrives as Chinese prose with **no** English ``Rating:``
header — just a line like ``最终评级：卖出``. The parser therefore also
recognises the Chinese 5-tier vocabulary; without it, every such run silently
defaulted to Hold regardless of the model's actual call (issues #78 / #80).
"""

from __future__ import annotations

import re
from typing import Tuple


# Canonical, ordered 5-tier scale (most bullish to most bearish).
RATINGS_5_TIER: Tuple[str, ...] = (
    "Buy", "Overweight", "Hold", "Underweight", "Sell",
)

_RATING_SET = {r.lower() for r in RATINGS_5_TIER}

# Matches "Rating: X" / "rating - X" / "Rating: **X**" — tolerates markdown
# bold wrappers and either a colon or hyphen separator.
_RATING_LABEL_RE = re.compile(r"rating.*?[:\-][\s*]*(\w+)", re.IGNORECASE)

# Chinese 5-tier vocabulary → canonical English rating.
_CN_RATING_MAP = {
    "强烈买入": "Buy", "买入": "Buy", "买进": "Buy",
    "增持": "Overweight",
    "持有": "Hold", "中性": "Hold", "观望": "Hold", "维持": "Hold",
    "减持": "Underweight",
    "强烈卖出": "Sell", "清仓": "Sell", "卖出": "Sell",
}
# Longest-first so "强烈买入" beats "买入" and "强烈卖出" beats "卖出" at the
# same position (regex alternation is leftmost, first-listed among equals).
_CN_ALT = "|".join(sorted(_CN_RATING_MAP, key=len, reverse=True))

_CN_LABEL_PREFIX = (
    r"(?:最终评级|评级|投资评级|评级结论|最终投资建议|投资建议|操作建议|"
    r"推荐评级|建议|推荐)\s*[:：\-]\s*\*{0,2}\s*"
)

# A labelled Chinese rating, e.g. "最终评级：卖出" / "投资建议: **增持**".
_CN_LABEL_RE = re.compile(_CN_LABEL_PREFIX + r"(" + _CN_ALT + r")")

# 中文标签后面跟**英文**评级词，例如 "最终评级：Buy"。output_language 设为中文、
# 但模型保留了英文评级词时就是这个形状——而它躲过了上面每一条规则：
# 英文标签规则要求出现 "rating"；中文标签规则只认中文评级词；裸英文词扫描按
# 空白切分，"最终评级：Buy" 是**一个** token，`strip("*:.,")` 又剥不掉全角冒号。
# 结果是静默落到默认值 Hold —— 决策评级被悄悄改写，报告里完全看不出来。
# 评级词后面**不能延续成更长的词**。
#
# 判据刻意选"否定词字符"而不是"枚举允许的标点"——后者是个填不完的坑，这条规则
# 前后被修了三轮才收敛：
#   · `(?![A-Za-z])`  漏掉连字符与数字：`Sell-off risk`→Sell、`Buy2024`→Buy
#   · 枚举收尾标点     漏掉开引号：`Buy（基于风险收益比）`、`Underweight(估值偏高)`
#     被判成 Hold —— 而静默改写决策评级会一路污染记忆日志与绩效统计
# 现在只问一件事：紧跟其后的字符会不会让它变成另一个词？会就不算评级。
# 中文、各种括号、标点、空白、行尾一律放行。
# 「会让它变成另一个词」的字符。连字符要看后面：`Sell-off` 是构词，
# `Sell- 退出` 里的 `-` 只是分隔符，后者不该被判否。
_WORD_CONTINUATION = r"(?:[A-Za-z0-9_]|-(?=[A-Za-z0-9_]))"
# ⚠️ markdown 的收尾星号必须**放进前瞻内部**，不能写成 `\*{0,2}(?!...)` 先消耗再判断：
# 那样正则会回溯——`建议：**Sell**-off risk` 里 `\*{0,2}` 先吃掉 `**` 被 `-` 判否，
# 退一步只吃一个 `*`，剩下的 `*` 恰好满足边界，于是又判成 Sell。
# 写成"后面不能是（0~2 个星号 + 词字符）"就没有可回溯的余地。
# （不用占有量词 `(?>...)`：那是 Python 3.11+ 才有的，本项目声明支持 3.10。）
_RATING_VALUE_END = r"(?!\*{0,2}" + _WORD_CONTINUATION + r")"

_CN_LABEL_EN_RE = re.compile(
    _CN_LABEL_PREFIX + r"(" + "|".join(RATINGS_5_TIER) + r")" + _RATING_VALUE_END,
    re.IGNORECASE,
)
# Bare Chinese rating term anywhere (last-resort fallback).
_CN_TERM_RE = re.compile(_CN_ALT)


def parse_rating(text: str, default: str = "Hold") -> str:
    """Heuristically extract a 5-tier rating from English or Chinese prose.

    Pass order (first hit wins; explicit labels always beat bare words):
    1. English ``Rating: X`` label (tolerant of markdown bold).
    2. Chinese rating label, e.g. ``最终评级：卖出`` / ``投资建议: 增持``；
       也接受中文标签后跟英文评级词的混排（``最终评级：Buy``）。
    3. First bare English 5-tier word found anywhere.
    4. First bare Chinese rating term found anywhere (longest match wins).

    Returns a Title-cased canonical rating, or ``default`` if none appears.
    """
    # 1. English explicit label
    for line in text.splitlines():
        m = _RATING_LABEL_RE.search(line)
        if m and m.group(1).lower() in _RATING_SET:
            return m.group(1).capitalize()

    # 2. Chinese explicit label (最终评级：卖出 …)
    m = _CN_LABEL_RE.search(text)
    if m:
        return _CN_RATING_MAP[m.group(1)]

    # 2b. Chinese label + English rating word (最终评级：Buy)
    m = _CN_LABEL_EN_RE.search(text)
    if m:
        return m.group(1).capitalize()

    # 3. Bare English rating word
    for line in text.splitlines():
        for word in line.lower().split():
            clean = word.strip("*:.,")
            if clean in _RATING_SET:
                return clean.capitalize()

    # 4. Bare Chinese rating term (last resort; leftmost, longest at that spot)
    m = _CN_TERM_RE.search(text)
    if m:
        return _CN_RATING_MAP[m.group(0)]

    return default

```

### Core Architecture Module: `tradingagents/agents/utils/signal_data_tools.py`
```
from langchain_core.tools import tool
from typing import Annotated
from tradingagents.dataflows.interface import route_to_vendor


@tool
def get_profit_forecast(
    ticker: Annotated[str, "A-stock code (e.g. 688017)"],
    curr_date: Annotated[str, "Analysis date in YYYY-MM-DD format (required)"],
) -> str:
    """
    Retrieve consensus EPS forecasts with forward valuation metrics.
    Returns analyst coverage count, EPS range, forward PE, PEG, and PE digestion time.
    Uses the configured signal_data vendor.

    ⚠️ curr_date 是**必填**：一致预期只有"当前"版本，没有历史时点值。数据层靠这个
    参数判断是不是在复盘历史，并在正文顶部加未来函数告警。给默认值等于没设防——
    模型按 {"ticker": "600519"} 调用时 curr_date 为空串，判定为"非历史"，告警永远
    不触发，今天的预测就被当成分析日当天的事实（v0.5.5 加告警，v0.5.8 才真正生效）。

    Args:
        ticker (str): A-stock code
        curr_date (str): Analysis date, used to flag look-ahead when historical
    Returns:
        str: Consensus forecast report with valuation metrics
    """
    return route_to_vendor("get_profit_forecast", ticker, curr_date)


@tool
def get_hot_stocks(
    curr_date: Annotated[str, "Date in YYYY-MM-DD format, empty for today"] = "",
) -> str:
    """
    Retrieve today's strong stocks with topic attribution reason tags.
    Shows WHY stocks surged (e.g. '算力租赁+AI政务'), curated by 同花顺 editorial team.
    Includes theme frequency analysis.
    Uses the configured signal_data vendor.
    Args:
        curr_date (str): Date in YYYY-MM-DD format, empty string for today
    Returns:
        str: Hot stocks list with reason tags and theme frequency
    """
    return route_to_vendor("get_hot_stocks", curr_date)


@tool
def get_northbound_flow(
    curr_date: Annotated[str, "Date in YYYY-MM-DD format"],
    include_history: Annotated[
        bool, "Include historical daily data (last 20 trading days)"
    ] = False,
) -> str:
    """
    Retrieve northbound capital flow (沪深股通) data.
    Realtime: minute-level cumulative net buying for HGT + SGT.
    History (optional): daily-level data for trend analysis.
    Uses the configured signal_data vendor.
    Args:
        curr_date (str): Date in YYYY-MM-DD format
        include_history (bool): Whether to include historical daily data
    Returns:
        str: Northbound capital flow report with bullish/bearish signal
    """
    return route_to_vendor("get_northbound_flow", curr_date, include_history)


@tool
def get_concept_blocks(
    ticker: Annotated[str, "A-stock code (e.g. 688017)"],
) -> str:
    """
    Retrieve concept/sector/region blocks that a stock belongs to.
    Shows industry (申万), concept themes (e.g. 机器人概念, 减速器), and region.
    Each block includes current day's change percentage.
    Uses the configured signal_data vendor.
    Args:
        ticker (str): A-stock code
    Returns:
        str: Concept and sector block membership with daily changes
    """
    return route_to_vendor("get_concept_blocks", ticker)


@tool
def get_fund_flow(
    ticker: Annotated[str, "A-stock code"],
    curr_date: Annotated[str, "Date in YYYY-MM-DD format"],
    include_history: Annotated[
        bool, "Include historical daily fund flow (last 20 days)"
    ] = True,
) -> str:
    """
    Retrieve individual stock fund flow (main force vs retail investor).
    Realtime: minute-level super/large/medium/small order flow.
    History: daily net inflow by order size for 20 trading days.
    Uses the configured signal_data vendor.
    Args:
        ticker (str): A-stock code
        curr_date (str): Date in YYYY-MM-DD format
        include_history (bool): Include 20-day historical daily flow
    Returns:
        str: Fund flow report with main force signal
    """
    return route_to_vendor("get_fund_flow", ticker, curr_date, include_history)


@tool
def get_dragon_tiger_board(
    ticker: Annotated[str, "A-stock code (e.g. 000858)"],
    curr_date: Annotated[str, "Date in YYYY-MM-DD format"],
    look_back_days: Annotated[int, "Days to look back (default 30)"] = 30,
) -> str:
    """
    Retrieve dragon-tiger board (龙虎榜) data for a stock.
    Shows recent LHB appearances, top buyer/seller seats (营业部),
    and institutional involvement. Key signal for hot money tracking.
    Args:
        ticker (str): A-stock code
        curr_date (str): Date in YYYY-MM-DD format
        look_back_days (int): How many days back to search
    Returns:
        str: LHB appearances with seat details and institutional activity
    """
    return route_to_vendor("get_dragon_tiger_board", ticker, curr_date, look_back_days)


@tool
def get_lockup_expiry(
    ticker: Annotated[str, "A-stock code (e.g. 000858)"],
    curr_date: Annotated[str, "Date in YYYY-MM-DD format"],
    forward_days: Annotated[int, "Days forward to check (default 90)"] = 90,
) -> str:
    """
    Retrieve lockup expiry (限售解禁) schedule for a stock.
    Shows historical unlock records and upcoming expiry calendar
    with impact metrics (unlock quantity, market cap ratio).
    Args:
        ticker (str): A-stock code
        curr_date (str): Date in YYYY-MM-DD format
        forward_days (int): How many days forward to check
    Returns:
        str: Lockup expiry schedule with impact assessment
    """
    return route_to_vendor("get_lockup_expiry", ticker, curr_date, forward_days)


@tool
def get_industry_comparison(
    ticker: Annotated[str, "A-stock code (e.g. 000858)"],
    curr_date: Annotated[str, "Date in YYYY-MM-DD format"],
) -> str:
    """
    Retrieve industry sector performance comparison (行业横向对比).
    Shows all 90 THS industries ranked by performance with turnover,
    net capital flow, and leading stocks. Useful for sector rotation analysis.
    Args:
        ticker (str): A-stock code (used to identify relevant sector)
        curr_date (str): Date in YYYY-MM-DD format
    Returns:
        str: Industry performance ranking with key metrics
    """
    return route_to_vendor("get_industry_comparison", ticker, curr_date)

```

### Core Architecture Module: `tradingagents/agents/utils/structured.py`
```
"""Shared helpers for invoking an agent with structured output and a graceful fallback.

The Portfolio Manager, Trader, and Research Manager all follow the same
canonical pattern:

1. At agent creation, wrap the LLM with ``with_structured_output(Schema)``
   so the model returns a typed Pydantic instance. If the provider does
   not support structured output (rare; mostly older Ollama models), the
   wrap is skipped and the agent uses free-text generation instead.
2. At invocation, run the structured call and render the result back to
   markdown. If the structured call itself fails for any reason
   (malformed JSON from a weak model, transient provider issue), fall
   back to a plain ``llm.invoke`` so the pipeline never blocks.

Centralising the pattern here keeps the agent factories small and ensures
all three agents log the same warnings when fallback fires.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional, TypeVar

from pydantic import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


def bind_structured(llm: Any, schema: type[T], agent_name: str) -> Optional[Any]:
    """Return ``llm.with_structured_output(schema)`` or ``None`` if unsupported.

    Logs a warning when the binding fails so the user understands the agent
    will use free-text generation for every call instead of one-shot fallback.
    """
    try:
        return llm.with_structured_output(schema)
    except (NotImplementedError, AttributeError) as exc:
        logger.warning(
            "%s: provider does not support with_structured_output (%s); "
            "falling back to free-text generation",
            agent_name, exc,
        )
        return None


def invoke_structured_or_freetext(
    structured_llm: Optional[Any],
    plain_llm: Any,
    prompt: Any,
    render: Callable[[T], str],
    agent_name: str,
) -> str:
    """Run the structured call and render to markdown; fall back to free-text on any failure.

    ``prompt`` is whatever the underlying LLM accepts (a string for chat
    invocations, a list of message dicts for chat models that take that
    shape). The same value is forwarded to the free-text path so the
    fallback sees the same input the structured call did.
    """
    if structured_llm is not None:
        try:
            result = structured_llm.invoke(prompt)
            return render(result)
        except Exception as exc:
            logger.warning(
                "%s: structured-output invocation failed (%s); retrying once as free text",
                agent_name, exc,
            )

    response = plain_llm.invoke(prompt)
    return response.content

```

### Core Architecture Module: `tradingagents/agents/utils/technical_indicators_tools.py`
```
from langchain_core.tools import tool
from typing import Annotated
from tradingagents.dataflows.interface import route_to_vendor

@tool
def get_indicators(
    symbol: Annotated[str, "6-digit A-stock code (e.g. 600379). Must be numeric, NOT company name or Chinese text"],
    indicator: Annotated[str, "technical indicator to get the analysis and report of"],
    curr_date: Annotated[str, "The current trading date you are trading on, YYYY-mm-dd"],
    look_back_days: Annotated[int, "how many days to look back"] = 30,
) -> str:
    """
    Retrieve a single technical indicator for a given stock code.
    Uses the configured technical_indicators vendor.
    Args:
        symbol (str): 6-digit A-stock code, e.g. 600379, 300750. Must be the numeric code, not the company name.
        indicator (str): A single technical indicator name, e.g. 'rsi', 'macd'. Call this tool once per indicator.
        curr_date (str): The current trading date you are trading on, YYYY-mm-dd
        look_back_days (int): How many days to look back, default is 30
    Returns:
        str: A formatted dataframe containing the technical indicators for the specified stock code and indicator.
    """
    # LLMs sometimes pass multiple indicators as a comma-separated string;
    # split and process each individually.
    indicators = [i.strip().lower() for i in indicator.split(",") if i.strip()]
    results = []
    for ind in indicators:
        try:
            results.append(route_to_vendor("get_indicators", symbol, ind, curr_date, look_back_days))
        except ValueError as e:
            results.append(str(e))
    return "\n\n".join(results)
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #113** (2026-09-20): **GLM / Qwen 的接入端点：CLI 与客户端兜底不一致（国内站 vs 国际站）**
  *Symptoms*: ## 问题  同一批 provider，CLI 与 Web UI 默认连到**不同站点**：  | provider | CLI（`cli/utils.py`） | 客户端兜底（`llm_clients/openai_client.py`） | |---|---|---| | glm | `https://open.bigmodel.cn/api/paas/v4/`（国内站），254 行 | `https://api.z.ai/api/paas/v4/`（海外站），146 行 | | qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1`（国内站），253 行 | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`（国际站），145 行 |  不是随机值不同，而是**两组「国内站 vs 国际站」被分别写死在两个入口**。  Web 侧栏填了 Base URL 时会覆盖兜底值（`openai_client.py:211` 的 `self.base_url or default_base`）， 但该字段默认留空，所以：  - 从 CLI 跑 → 国内站 - 从 Web 跑 → 海外站 - 用 `role_llms` 指定同一家厂商 → 海外站（除非显式给 `backend_url`）  同一个 provider 换个入口就换站点，属意外行为，且报告里看不出来。  ## 证据  同一个 ZHIPU_API_KEY 实测 `GET /models`：  - `api.z.ai/api/paas/v4/models` → 200 - `open.bigmodel.cn/api/paas/v4/models` → 200  两站都可用、返回同一份模型列表，所以**不会报错**，只会静默走不同网络路径。 差别是实打实的：`open.bigmodel.cn` 命中 GeoIP(CN) 直连，`api.z.ai` 要绕境外节点。  ## 期望  这属于产品取向，我不擅自改默认值，想请你定：  1. **统一到国内站**（`open.bigmodel.cn` / `dashscope.aliyuncs.com`），与 CLI 一致 2. **统一到海外站**（`api.z.ai` / `dashscope-intl.aliyuncs.com`），保留现有兜底值 3. 保持现状，但把差异写进 README 的 provider 表与 Web 侧栏提示  我倾向 **1**：这是 A 股特化 fork，用户主体在国内；且方案 2 会让 CLI 与 Web 的行为继续分裂。 如果你是面向海外用户设计的，2 也成立。  定了之后我可以提 PR（`_PROVIDER_CONFIG` 改两行 + 可选地补 README）。  ## 影响面（若采纳 1 或 2）  - `tradingagents/llm_clients/openai_client.py:145-146`（两行） - 不改公共 API、不改配置结构 - 既有用户若依赖当前兜底端点，需用 `backend_url` / 侧栏 Base URL 显式覆盖   （建议写进 CHANGELOG 的 breaking 段落）  ## 备注  这不是「哪个站点更快」的网速之争，而是**一致性**问题：同一份代码里两组值互相矛盾， 无论最终选哪边，都不该留两组。Qwen 那组推测是同批改动漏掉的，一并列出
  **Post-Mortem & Fix Analysis**:
  > **采纳方案 1（统一到国内站）**，已经改好合进 main 了。  先说这个 issue 的质量：给了精确行号、自己实测了两站的 `GET /models` 都返回 200、把"不是网速之争而是一致性问题"讲清楚了，还主动把产品取向的决定权留给维护者。这是我们这段时间收到的最省事的一个 issue，谢谢。  ## 核实结果  你说的两处完全属实，我还多查了一层：  **其余 provider 一直是一致的**——xai / deepseek / openrouter / ollama 两处逐字相同。**只有 glm 和 qwen 这两个国内厂商分裂了**，这个分布本身就说明是漏改而不是有意设计。  `git log -S` 查下来，三个值（CLI 的 `open.bigmodel.cn`、兜底的 `api.z.ai`、兜底的 `dashscope-intl`）**都是同一个提交 `c567f8a`「v0.2.4 A股深度特化版」引入的**——不是后来某次改动只改了一半，是当初写的时候两处分别填的，从第一天起就没对齐。  还有一条你没提到、但把取向钉死了的证据：**README.md 和 README_en.md 都让用户去 `open.bigmodel.cn` 申请 key**。也就是说文档让用户拿国内站的 key，Web UI 却连海外站——正因为两站互认同一个 key 才一直没人发现。  所以方案 1 不只是"用户主体在国内"的倾向问题，而是让代码回到文档已经声明的意图上。  ## 改了什么  `_PROVIDER_CONFIG` 两行，和你说的影响面一致：  ```diff -    "qwen": ("https://dashscope-intl.aliyuncs.com/compatible-mode/v1", "DASHSCOPE_API_KEY"), -    "glm": ("https://api.z.ai/api/paas/v4/", "ZHIPU_API_KEY"), +    "qwen": ("https://dashscope.aliyuncs.com/compatible-mode/v1", "DASHSCOPE_API_KEY"), +    "glm": ("https://open.bigmodel.cn/api/paas/v4
  > 修复已合并进 main（`922db59`），随下个版本发布。  README 的 provider 表补 base URL 那件事如果你有兴趣，欢迎单独开 PR——这条 issue 就先关了，有后续在这里回复会自动重开。

- **Issue #112** (2026-09-20): **feat(glm): 模型表补充 GLM-5.3 / 5.3-Flash / 5.2**
  *Symptoms*: ## 补充 GLM 已上线但未收录的模型  `MODEL_OPTIONS["glm"]` 的 quick 档到 `glm-5` 为止、deep 档到 `glm-5.1` 为止。 智谱当前实际可用（实测 `GET /models`，`api.z.ai` 与 `open.bigmodel.cn` 返回一致）：  ``` glm-4.5  glm-4.5-air  glm-4.6  glm-4.7  glm-5  glm-5-turbo glm-5.1  glm-5.2  glm-5.3  glm-5.3-flash ```  5.2 / 5.3 已上线但未收录，用户在 Web 侧栏与 CLI 里都选不到。  新增：  ``` quick: glm-5.3-flash / glm-5.3 / glm-5 / glm-4.7 deep:  glm-5.3 / glm-5.2 / glm-5.1 / glm-5 ```  低成本项（`glm-5` / `glm-4.7`）与 `Custom model ID` 保留。 纯增补，不改任何既有选项的语义，不填就不生效。  ### 测试  ``` env -u ALL_PROXY .venv/bin/python -m pytest tests/ -q -> 378 passed, 14 skipped, 0 failed ``` 
  **Post-Mortem & Fix Analysis**:
  > 谢谢补模型表，也抱歉这个和 #111 一起压了几天。  `glm-5.3` 和 `glm-5.2` 我在智谱官方文档上确认存在，没问题。  **但 `glm-5.3-flash` 我查不到。** 翻了两个页面：  - 模型总览页的完整模型 ID 清单里，Flash 系只有 `glm-4.7-flash` / `glm-4.7-flashx` / `glm-4.5-flash` / `glm-4-flash-250414`，没有 `glm-5.3-flash` - `glm-4.5-flash` 的文档页也明确提到「GLM-4.5-Flash 将于 2026-01-30 下线，请求自动路由到 GLM-4.7-Flash」，同样没提 5.3-flash  模型表这东西写错了用户是直接调不通的（报 model not found），而且排在 `quick` 列表第一个，等于默认选项。所以想先跟你确认：  **能给个出处吗？** 官方文档链接、控制台的模型列表截图，或者你实际调通的一次请求截图都行。如果是最近刚上、文档还没同步，那完全可能——智谱新模型上线快于文档更新是常有的事，我只是不能凭猜测合进去。  如果一时找不到出处，我建议先把 `glm-5.3-flash` 这行摘掉，只合 `glm-5.3` 和 `glm-5.2` 两个已确认的，等确认了再单独加。你改一下我这边马上合。  另外一个小的：两处描述文案不一致，`quick` 里写 `"GLM-5.3 - Latest flagship"`，`deep` 里写 `"GLM-5.3 - Latest flagship model"`，统一一下更整齐。顺手的事，不强求。 
  > 已核对后合并 🙏  四个模型 ID 都在智谱官方文档的模型总览页查到了实体：`glm-5.3`（旗舰）、`glm-5.3-flash`（原生多模态）、`glm-5.2`、`glm-5.1`，不是凭印象加的。排序也合理——quick 档把 flash 放最前、deep 档把 5.3 放最前，和 MiniMax 那组的写法一致。  跑了全量：378 passed / 14 skipped（skip 全是未装 `claude-agent-sdk` 的可选依赖），无回归。  感谢贡献！

- **Issue #111** (2026-09-20): **fix(a_stock): 同花顺一致预期在 pandas 3.x 下取空 + 概念板块静默吞掉百度风控 403**
  *Symptoms*: ## 两个数据源调用的失败被静默吞掉  修 `a_stock.py` 里两处会让分析师拿到**假事实**的问题。两个 commit 可独立看。  ### 1. 同花顺一致预期在 pandas 3.x 下必然取空 (`3174a3f`)  `_ths_eps_forecast` 把 HTML 文本直接传给 `pd.read_html`。pandas 3.x 起 `io` 参数只接受路径 / URL / 文件对象，字符串一律按**路径**处理 → `FileNotFoundError`； 异常消息里还带着整页 133KB HTML，日志被刷满。  `pyproject.toml` 声明 `pandas>=2.3.0`，pandas 3.x 在允许区间内，属必现回归。  影响：`get_fundamentals` 的一致预期 EPS 段 + `get_profit_forecast` 双双失效。  验证（pandas 3.0.5）：  ``` pd.read_html('<table>...</table>')               -> FileNotFoundError pd.read_html(io.StringIO('<table>...</table>'))  -> OK ```  修后实测取到 002008 的 2026–2028 三年一致预期（14 家机构，均值 2.63 / 4.05 / 5.46）。  ### 2. 概念板块把百度风控 403 谎报成「该股无概念板块」(`80694d0`)  百度 PAE `getrelatedblock` 被风控时返回 HTTP 403 +：  ```json {"ResultCode": 0, "Result": {"code": 403, "isCaptchaEnabled": true, "msg": "hit risk"}} ```  外层 `ResultCode` 是**整数** 0，而代码判断是 `str(...) != "0"` —— 整数 0 正好过关， 随后 `result.get(code, [])` 取空，落到 `return f"No concept/block data for {code}"`。 一次「取数被拦」被当成「该股确实没有概念板块」这个事实喂给模型，报告里看不出来。  改为单独识别 `Result.code == 403` 并如实报出失败原因。 顺带把手工拼接的 query string 换成 `params=`（原写法把 code 直接插进 URL）。  ### 未解决：需要维护者决策（本 PR 不擅自引入依赖）  该接口对 python-requests 的 TLS 指纹做风控。同一时刻实测：  | 客户端 | 结果 | |---|---| | curl（未编码 / 已编码 URL） | 200 | | `curl_cffi` `impersonate=chrome/safari/firefox` | 200 | | python-requests | 连续 6/6 → 403 |  要稳定取数需要浏览器指纹伪装，但那意味着把 `curl_cffi` 提为**直接依赖** （目前它只是传递依赖，未写进 `pyproject.toml`）。是否引入请维护者定， 本 PR 只做到「不谎报」。  > 附：最初我怀疑是 URL 未编码导致被拒，后来用 `curl -g`（关闭 curl 自身的 > `[]` glob）复测发现未编码也 200，**该假设已推翻
  **Post-Mortem & Fix Analysis**:
  > 已合并，两个修复都很扎实。抱歉从 9-16 压到今天才回。  尤其是百度那个——**外层 `ResultCode` 整数 `0` vs 字符串 `"0"`** 的差别，被 `str()` 一包就都放行了，风控响应一路走到「取不到分类」分支，最后以 `No concept/block data` 的面目出现。一个「被拦截」的事实变成「这只股票没有概念板块」喂给模型，这种错得无声无息的比直接报错危险得多。  我本地实测确认了你的判断：  ``` 正常响应 ResultCode = '0'   类型 str str(rc) != "0"  →  False   （放行） ```  也验了你把手拼 URL 改成 `params=` 不会弄坏接口——两种形式实际发出的 URL 不同（`params` 会多编码 `:` 和 `,` 为 `%3A` `%2C`），但都 HTTP 200 拿到了 600519 的真数据（行业=食品饮料，申万一级）。  ---  **有一条想请你再看一眼**（不影响这次合并，下次一起改就行）：  新加的判断是  ```python if isinstance(result, dict) and result.get("code") == 403: ```  这里用严格 `==` 比整数 403。但这个 PR 修的恰恰是「同一个字段百度有时给整数、有时给字符串」——新判据等于在同一个坑边上又站了一次。如果哪天风控回的是 `"code": "403"`，这个分支就会静默失效，退回到今天这个「说成没有概念板块」的行为。  建议写成宽松比较：  ```python if isinstance(result, dict) and str(result.get("code")) == "403": ```  或者干脆不认 code、改认更稳的信号（`isCaptchaEnabled` / `msg` 里的 `risk`）。  我本机此刻没被风控（`ResultCode` 正常返回字符串 `'0'`），所以**没能实际复现 403 那条响应**，上面是照你给的结构推的——如果你手上有真实的 403 响应样本，贴出来更好，也方便加一条测试把这个分支钉住。  顺带一提：这个 PR 是纯源码改动、没有测试。403 分支的行为是明确可构造的（mock 一个 `{"Resu

- **Issue #110** (2026-09-20): **feat(llm): 接入火山方舟 Coding Plan / Agent Plan 订阅套餐**
  *Symptoms*: 火山引擎的方舟订阅套餐对外提供 Anthropic Messages 兼容端点，但与官方 Anthropic 有三处差异需要独立 client：base_url 套餐固定、API Key 套餐专属（不能与 ANTHROPIC_API_KEY 混用）、模型 ID 用方舟自己的命名。  - 新增 VolcengineArkClient：复用 ChatAnthropic 封装，按 provider 解析套餐端点与专属 Key，若没有专属key，将回落 ANTHROPIC_API_KEY - factory 路由 ark_coding / ark_agent 到新 client - model_catalog 新增 ARK_PLAN_ENDPOINTS 端点表与两组模型下拉清单 - validators 放行方舟任意模型 ID - .env.example 补充 ARK_CODING_API_KEY / ARK_AGENT_API_KEY 变量
  **Post-Mortem & Fix Analysis**:
  > 谢谢，也谢谢你在 #99 那边主动做了拆分——拆完确实清楚多了，火山方舟接入这一块单独看很聚焦。#99 我看到你已经自己关掉了。  抱歉从 9-11 压到现在没回。  代码读下来结构是对的：`volcengine_client.py` 独立成文件、`factory` 里注册、`validators` 补校验、`model_catalog` 加模型，分层很清楚，也没有把凭据写进代码（我扫过新增的 145 行，零命中）。  **卡在一件事上：这个 PR 没有任何测试。**  新增了一个 provider client（72 行）、动了 `factory.py`、`validators.py`、`model_catalog.py`，全部零测试覆盖。这个仓库最近几个 PR（#96 / #100 / #103 / #107 / #109）都是带测试进来的，我们想把这个惯例保持住——LLM provider 这一层尤其容易出静默问题：凭据没配时报什么、base_url 拼错时报什么、订阅套餐和按量计费走的分支对不对，这些不写测试就只能等用户来提 issue。  不用做得很重，参考 `tests/test_openai_compatible_provider.py` 的写法，覆盖这几条就够：  1. 给定环境变量时 `factory` 能正确造出 volcengine client，且 base_url / model 传对了 2. 缺少必需环境变量时 `validators` 报出清楚的错误（而不是到调用时才炸） 3. Coding Plan / Agent Plan 两种订阅套餐分别走到预期的分支 4. `model_catalog` 里新加的模型 ID 能被 `get_capabilities` 正确解析（不会掉进错误的 pattern）  补上测试我这边就合。如果哪条不好写或者你觉得没必要，说一下理由也行，我们讨论。  另外想确认一下：`.env.example` 里新增的 8 行，变量名和火山方舟控制台里的叫法一致吗？这块用户照抄的概率很高，名字对不上就白配了。 
  > 感谢这个 PR，代码写得很规范——模块 docstring 把「为什么需要独立 client」的三条差异写清楚了，还附了官方文档出处，这比大多数接入类 PR 都认真 🙏  但这条**不合并**，原因是产品边界，不是代码质量：  **本项目不再接入各家的订阅套餐专属接入方式。** 每接一个套餐就是一整套独立资产——独立 client、专属 Key 变量、独立模型下拉清单、validators 放行规则，而这些东西会跟着对方的端点路径和模型命名一起变；套餐类产品的调整通常还不发公告。接一个不难，难的是长期这些入口坏了没人发现，用户撞上的是「配了 Key 但连不上」这种最难排查的故障。  项目现有的通用路径是 `BACKEND_URL` + OpenAI 兼容端点。方舟订阅套餐如果对外提供兼容端点，走这条通用路径同样能用，代价只是用户自己填一次地址——这个代价我认为比长期维护 N 个专属 client 划算。  另外提一个**建议你在自己 fork 里改掉的点**（与合不合并无关，是个真实风险）：  ```python api_key = os.environ.get(api_key_env) or os.environ.get("ANTHROPIC_API_KEY") ```  这个回落的本意是兼容既有配置，可以理解，但失败模式是：用户设了真实的 `ANTHROPIC_API_KEY`（很常见），在 UI 里选了 `ark_coding` 却忘了配 `ARK_CODING_API_KEY` —— 此时**会把 Anthropic 官方的 Key 发到火山方舟的端点上**。跨厂商的凭据回落最好不要有，宁可直接报错让用户去配，也比把 A 家的 Key 送到 B 家的服务器上安全。  再次感谢，希望别被这个决定劝退——欢迎继续提其它方向的 PR。

- **Issue #109** (2026-09-20): **refactor(agents): 压缩辩论历史并去除重复的最后一条发言注入**
  *Symptoms*: ## 问题描述  多空辩手（`bull_researcher` / `bear_researcher`）与风险辩手（`aggressive_debator` / `neutral_debator` / `conservative_debator`）每轮辩论时，既把完整的 `history` 注入 prompt，又单独注入一次 `current_response`（或 `current_*_response`）——而后者恰好就是 `history` 的最后一条发言。这带来两个问题：  1. **最新发言被重复注入**：同一条发言在 prompt 里出现两次，浪费 token。 2. **注入 token 接近平方增长**：`history` 每轮线性累加，叠加每轮重复注入最新发言的冗余，随辩论轮数放大。  默认配置（多空各 1 轮、风险各 1 轮）下影响有限，但一旦调大 `max_debate_rounds` / `max_risk_discuss_rounds`，token 膨胀会变得显著。  ## 解决方案  1. 新增 `compact_history()`（`tradingagents/agents/utils/context.py`）：保留最近 `max_turns` 条发言全文，更早的压成「角色: 首句要点」一行，供辩手在注入前调用。纯标准库实现，无第三方依赖。 2. 删除辩手 prompt 中重复的 `current_response` / `current_*_response` 注入，让 `history`（经 `compact_history` 包裹）成为唯一的信息来源。  ## 改动内容  - 新增 `tradingagents/agents/utils/context.py`：`compact_history` 及辅助函数 `_speaker` / `_first_sentence`（含中文句号 `。` 的切分）。 - 新增 `tests/test_context_compaction.py`：9 个单元测试。 - 修改 5 个辩手节点，去掉重复注入并接入 `compact_history`：   - `tradingagents/agents/researchers/bull_researcher.py`   - `tradingagents/agents/researchers/bear_researcher.py`   - `tradingagents/agents/risk_mgmt/aggressive_debator.py`   - `tradingagents/agents/risk_mgmt/neutral_debator.py`   - `tradingagents/agents/risk_mgmt/conservative_debator.py`  ## 测试  - 新增 9 个单元测试全部通过（`pytest tests/test_context_compaction.py`）。 - `compact_history` 覆盖：空历史、小于/等于/大于 `max_turns` 三种边界、早期发言压成首句摘要（中文句号切分）、近期发言保留全文。 - 辩手去冗余：断言「对方最后一条发言」在 prompt 中只出现一次（改动前因 `history` + `current_response` 双重注入会重复出现）。 - 现有测试无回归：改动仅影响 prompt 文本，不动 state 字段与辩论轮数路由逻辑。  
  **Post-Mortem & Fix Analysis**:
  > 谢谢，也抱歉从 9-8 压到现在。  这个方向我认同——辩论历史无限增长确实是个真问题，而且「最后一条发言被重复注入」这种 bug 不看代码根本发现不了，模型只会表现得有点奇怪。你还带了 155 行测试（`tests/test_context_compaction.py`），这点很好。  这轮我们先合了 #103 / #107 / #111 三个，**你这个排在下一批**，我会在干净环境里跑完整测试后再给具体意见——它动了 5 个 agent 文件（两个 researcher + 三个 risk debator）加一个新的 `context.py`，属于会影响所有分析输出的改动，我想自己跑一遍、对比压缩前后的实际 prompt 再下结论，不想只看 diff 就合。  预计这两天给你回。如果期间你想先动手，有两件事可以提前说清楚，能省一轮来回：  1. **压缩的触发阈值是怎么定的**——按条数、按 token 数，还是按字符数？如果是估算的 token，用的什么口径（不同模型 tokenizer 差别不小） 2. **压缩会不会丢掉关键结论**——辩论历史被压缩后，后面的 agent 还能不能看到前面轮次的核心论点。如果测试里已经覆盖了这条，指给我看就行  再次抱歉让你等这么久。 
  > 验收通过，已合并。比我预期的稳妥，说一下我验了什么。  ## 我上一条问的两个问题，代码里都有答案  **① 触发阈值按什么算** —— 按**发言条数**（`max_turns=4`），不是 token 也不是字符。更重要的是你在 docstring 里写清楚了默认配置不会触发，我实测确认：  ``` 默认 max_debate_rounds=1  → 多空共 2 条发言 默认 max_risk_discuss_rounds=1 → 风险共 3 条发言   阈值 4 默认多空历史 → 原样返回: True 默认风险历史 → 原样返回: True ```  也就是说**压缩这一半对现有用户是零行为变化**，只有调大轮数的人才会碰到。这个设计选择我很认同——上下文压缩是有损的，默认不动比默认省 token 重要。  **② 会不会丢关键结论** —— 压缩那部分因为默认不触发，实际风险接近零；触发时早期发言压成首句，这是摘要的固有取舍，下面有一条相关建议。  ## 去重那一半我单独验了  这部分是**默认生效**的，动了 5 个 agent，所以我没只看测试绿。核心问题是：`current_response` 真的等于 `history` 的最后一条吗？如果不是，删掉它就不是去重而是丢信息。  逐个查了状态写回：  ```python # bull / bear "history": history + "\n" + argument, "current_response": argument,          # 同一个 argument  # conservative / neutral（aggressive 读的是这两个） "history": history + "\n" + argument, "current_conservative_response": argument, ```  **五个文件全部同构**，写进 `history` 的和单独注入的是同一个变量、一字不差，确认是纯重复注入，删掉零信息损失。也确认了五处都改齐了（各 1 处 `compact_history`，0 处残留的重复注入）。  ## 测试  ``` 合并前 main : 411 passed, 14 skipped 合并 #109 后 : 420 passed, 14 skip

- **Issue #108** (2026-09-20): **一个问题，这个tradingagents给投研者带来什么价值？**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > 好问题。它不给结论，给的是**过程**：把一只票的技术面、基本面、新闻、政策、游资、解禁等维度各自交给一个 agent 用真实数据写报告，再让多空辩论和风控 agent 互相挑毛病，最后把整条推理链、引用的数据和分歧点原样摆出来。  对投研者的价值主要三点：  1. 把每天重复的取数、整理、写初稿的活自动化掉，人只做判断； 2. 多角色互驳能把自己没想到的反方论据逼出来，比一个人闷头看更不容易偏； 3. 全程可追溯——哪个结论来自哪份数据一目了然，复盘时能定位错在哪一环。  它不是选股器，也不给投资建议，这是项目的边界（README 免责声明）。如果你有具体的使用场景，或者想看某类报告的样例，说一下我可以补文档。 
  > 上面那条应该把问题回答了，先关掉这个 issue。  如果你后来真的跑起来了、有具体场景上的疑问（比如某类报告怎么读、某个 agent 的结论为什么是那样），随时在这里回复，issue 会自动重开，或者另开一个都行。  顺带一提，刚合并的几个改动里有一个对新用户比较有用：现在某个工具取不到数时，报告里会明确列出「哪一块缺了」而不是含糊带过，并且可以单独重试那一项。下个版本发布后会在 CHANGELOG 里写明。 

- **Issue #107** (2026-09-20): **feat: track, retry, and surface missing data**
  *Symptoms*: Rebased on current upstream main (v0.5.16) and split into reviewable commits.  - Record failed/partial tool calls by ticker/date/stage, persist tasks, retry exact calls, cache successful outputs, and consume them on fresh analysis. - Surface missing-data status in the report viewer with retry and fresh reanalysis controls. - Add explicit incomplete-data warnings to Markdown and PDF exports.  Validation: `.venv/bin/pytest -q tests/test_missing_data_tasks.py tests/test_report_viewer_pdf_gate.py tests/test_pdf_export.py` (19 passed).  Unrelated local working-tree changes were intentionally left untouched.
  **Post-Mortem & Fix Analysis**:
  > rebase 到 v0.5.16 并拆成两个 commit 这版好评审多了，谢谢。方向不变（#58 已关掉指到这里）。我本地全量跑了一遍：**387 passed / 1 failed**，合并前三件事：  **1. 一个现有测试被改坏了。** `tests/test_sentiment_data_tools.py::test_graph_tool_node_matches_analyst_tools` 用正则 `"social": ToolNode\(\s*\[(.*?)\]\s*\)` 扫源码，你在列表后面加了 `, wrap_tool_call=...` 之后它匹配不到了：  ``` AssertionError: 找不到 social 的 ToolNode 定义 ```  把那个正则放宽成允许列表后跟可选的 `wrap_tool_call=…` 即可（这个测试的目的是校验 social 节点的工具集合，与你的改动不冲突）。  **2. `ToolNode(wrap_tool_call=…)` 要 langgraph ≥ 1.0。** 我在 langgraph 0.6.11 上实测 `ToolNode.__init__` 没有这个参数，而 `pyproject.toml` 只要求 `langgraph>=0.4.8`——装着老版本的用户升级项目后会在**建图时直接 TypeError**，整个项目不可用。请把 pin 抬到你实际验证过的版本（建议 `langgraph>=1.0`），并在 CHANGELOG 里注明这是依赖要求的变化。  **3. 测试里的 `sys.modules.setdefault` 假模块有污染风险。** `test_missing_data_tasks.py` 在模块顶层给 `langchain_core` / `langchain_core.messages` / `tradingagents.dataflows.utils` 装 stub，只要这个文件先于真模块被导入（pytest 收集顺序变化、或者单独跑它之后再跑别的），后面所有用真 `langchain_core` 的测试都会拿到假的。这次全量恰好没触发，但它是埋着的。请改成 `monkeypatch.setitem(sys.modules, …)`（`test_report
  > 验收通过，已合并。感谢，也抱歉让你从 9-8 等到今天。  我 9-5 提的三点逐条核对如下：  **① 正则放宽** — 已改成可选组，`wrap_tool_call` 在与不在都能匹配。我做了两次变异确认这条校验真的有效：  - 从图里 `"social": ToolNode([...])` 删掉一个 `get_hot_stocks` → **测试变红**（判据有效，不是摆设） - 删掉 `, wrap_tool_call=make_tool_call_recorder("social")` → **测试仍绿**（正是这次要的兼容性）  **② `langgraph>=1.0`** — 已抬。本地实测 0.6.11 的 `ToolNode` 确实没有 `wrap_tool_call`，这个 pin 是必须的。  **③ `sys.modules.setdefault`** — 已清零（`grep -c` 在 `tests/test_missing_data_tasks.py` 里 0 命中，`monkeypatch.setitem` 也是 0），改用直接 import 真模块，很好。  **测试结果**（Python 3.12，langgraph 1.2.11）：  ``` 基线 main(v0.5.17)  : 378 passed, 14 skipped 合并 #107 之后       : 395 passed, 14 skipped, 0 failed ```  +17 条新测试，零回归。  **我合并时剥离了 CHANGELOG 的改动**，说明一下原因，下次提 PR 可以省掉这一步：  你把条目加在了 `## [0.5.16] — 2026-09-02` 段里，但 0.5.16 和 0.5.17 都已经发布了，这批功能会随下一个版本出去——写进已发布的版本段会让人以为装 0.5.16 就有 `langgraph>=1.0` 的要求，对 breaking change 尤其容易误导。  我起初想新建一个 `## [未发布]` 段，结果被仓库自己的测试拦下来了：  ``` tests/test_version_consistency.py::test_changelog_top_entry_matches_pyproject AssertionError

- **Issue #106** (2026-08-29): **TDX 平台功能补全：引擎接线与 9 项差距关闭（Phase 6）**
  *Symptoms*: ## Problem Statement  平台已完成通达信式五大深度模块（图表、数据、信号、选股、组合）与回测封装，并配套了完整的《功能文档》与《开发文档》。但从使用者视角看，产品仍是"半成品"：  - AI 决策回测只有 HTTP 端点，界面上没有任何入口——用户无法一键验证"AI 说买入，到底靠不靠谱"。 - 预警系统只实现了 3/7 种条件（价格上破/下破/放量），用户最需要的"RSI 超卖提醒"、"上穿均线提醒"定义了却不会触发；且预警、自选股只存浏览器本地，换设备即丢失。 - 自然语言选股用正则解析，稍微复杂一点的表达（"市值大于500亿的半导体股中 RSI 超卖的"）就识别失败。 - 同一套选股/组合功能在 HTTP 服务层与引擎模块是**两套并行实现**，字段口径不一，维护成本翻倍。 - 没有分时图；后端无法导出高清图表图片；三大报表/行业对比/股东动向只有生文本；指标 25 个远少于通达信 200+；性能指标（渲染<100ms、单指标<10ms、选股<1s）从未被基准测试验证。  ## Solution  以"引擎接线"为主线，分里程碑关闭功能文档 §13 的全部 9 项差距：  1. **统一实现**：HTTP 服务层的组合/选股迁移到已有的引擎模块之上（API 契约保持不变），消除双实现。 2. **预警补全**：信号引擎补齐 4 种指标/交叉条件的求值；新增后端预警 CRUD 端点与持久化；自选股同步提供后端持久化；GUI 双通道（本地即时 + 后端同步）。 3. **回测 GUI**：报告页新增"回测此决策"入口，可视化回测结果（收益曲线、Sharpe、回撤、胜率），支持不同持有天数对比；后端补图片导出渲染。 4. **体验补缺**：独立分时图页（均价线+量）；三大报表/行业对比/股东动向专属可视化面板。 5. **智能升级**：自然语言选股从正则解析升级为 LLM 结构化解析（带 LLM 缓存）。 6. **指标扩充**：第一批增量（EXPMA、薛斯通道、神奇九转等常用集）。 7. **性能护栏**：按设计文档 §5 目标建立基准测试，防止回归。  ## User Stories  ### 回测  1. 作为散户投资者，我希望在 AI 分析报告页一键回测本次交易决策，以便验证 AI 建议在历史数据上是否靠谱。 2. 作为散户投资者，我希望回测结果展示收益曲线、Sharpe、最大回撤、胜率，以便直观判断策略质量。 3. 作为交易员，我希望对比不同持有天数（1/3/5/10 天）下的回测结果，以便选择最佳退出时机。 4. 作为交易员，我希望回测结果可以导出为图片分享，以便在社群讨论。 5. 作为量化爱好者，我希望回测使用前复权数据并明确标注，以便避免复权偏差造成的虚假收益。 6. 作为用户，当回测依赖（akquant）未安装时，我希望看到明确的安装指引而不是报错崩溃，以便自行解决问题。  ### 预警  7. 作为散户投资者，我希望设置"RSI 低于 30 时提醒我"，以便在超卖时不错过买入机会。 8. 作为散户投资者，我希望设置"价格上穿/下穿 MA20 时提醒我"，以便捕捉趋势转折。 9. 作为散户投资者，我希望设置"指标高于/低于某阈值"与"放量"预警，以便覆盖价、量、指标三类监控。 10. 作为用户，我希望预警规则保存在服务端，以便换设备或重装后规则不丢。 11. 作为用户，我希望预警触发时收到桌面通知，以便不盯着盘也能及时反应。 12. 作为用户，我希望查看预警的触发历史，以便复盘预警质量。 13. 作为用户，我
  **Post-Mortem & Fix Analysis**:
  > 误发至此仓库，规格已迁移到本人仓库：https://github.com/sunsumyu/TradingAgents/issues/1

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

### Incident Patch 1: `d3939816` (2026-09-21)
**Commit Message**: fix: bound external calls for v0.5.20

**File**: `CHANGELOG.md` (modified, +49/-0)
```diff
@@ -6,6 +6,55 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
 and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 Breaking changes within the 0.x line are called out explicitly.
 
+## [0.5.20] — 2026-09-21
+
+### 修复：`claude_agent_sdk` 订阅主路径此前完全没有超时（补上 v0.5.19 自己记下的那个缺口）
+
+v0.5.19 把 `llm_timeout` 铺到了每一个走 LangChain 客户端的 provider，同时在「已知限制」
+里写明订阅覆盖的**主路径**罩不到：`AgentSDKChatModel` 不经 LangChain，直接驱动 Agent SDK
+的异步生成器（背后是 `claude` 子进程）。子进程卡住 ⇒ `async for` 永远悬着 ⇒ 进程活着、
+零输出、永不返回。`fallback_spec` 里那份超时只在**已经降级之后**才生效，而挂死恰恰发生在
+降级之前。本版关掉这个缺口。
+
+- `ClaudeAgentSDKClient` 开始接收 `llm_timeout`（由 `trading_graph._resilience_kwargs()`
+  按目标 provider 注入，与其它 provider 同一个配置项，不新增配置键）。
+- **预算按"一次模型调用"换算**：`llm_timeout` 在别的 provider 那里是一次 HTTP 请求的超时，
+  分析师的 ReAct 循环由 LangGraph 在外面驱动，每轮各拿一份完整预算。Agent SDK 反过来，把
+  整个工具循环跑在**同一次** `.invoke()` 里（最多 `_TOOL_MAX_TURNS` 轮），所以整段预算
+  ＝ `llm_timeout × 本次允许的模型轮数`；单轮调用（deep / structured 节点）拿到的就是
+  `llm_timeout` 本身。⚠️ 整段固定 150 秒会让分析师几乎每次都超时并降级到**按 token 计费**
+  的 provider —— 正是启用订阅要避免的事。
+- 超时抛 `_SDKTimeout`，走**既有**的 `_FALLBACK_ERRORS` 通路：配了降级目标就降级，
+  没配就照常往外抛。认证失败仍然**不**在该元组里（降级 = 悄悄开始计费）。
+- 资源收尾：`_query` 在 `finally` 里显式关闭 SDK 异步生成器（连同它拉起的子进程），
+  不再依赖事件循环的 `shutdown_asyncgens` 兜底；只要配置了超时预算，无论调用方有没有
+  事件循环，都通过 daemon 工作线程 + 有界 join 兜底「SDK 连取消都不理」的情况。
+- 没配 `llm_timeout` 时行为与本版之前完全一致（不设超时）；布尔值 / `0` / 负数 /
+  解析不了的值一律落到"不设超时"，而不是"立刻超时"。
+
+### 修复：Alpha Vantage 的出站请求没有超时
+
+`alpha_vantage_common._make_api_request` 的 `requests.get` 不带 `timeout`，语义是
+**永远等下去**——与上面同一类静默卡死。新增模块级 `REQUEST_TIMEOUT = 30`（比仓内其它
+数据源的 10~15 秒宽一档：境外端点，且 `outputsize=full` 的全历史 CSV 是这里最大的响应）。
+
+### 测试
+
+新增 35 条（`tests/test_agent_sdk_timeout.py` 29 条 + `tests/test_alpha_vantage_timeout.py`
+5 条，另在 `tests/test_llm_timeout.py` 增 1 条钉配置透传）。全部不碰真实 provider：
+无网络、无子进程、无订阅额度。
+
+- ⚠️ 订阅超时的用例**刻意不挂 `requires_sdk`**：`claude-agent-sdk` 是可选 extra，干净安装
+  里装不上（现有 13 条 skip 就是它），把超时护栏挂在可选依赖上等于默认配置下一条都不跑。
+  改为用替身顶住模块里两个 SDK 名字，其余全走生产代码。
+- 9 个变异逐一验红：删掉订阅客户端的韧性注入 / `_timeout_for` 不按轮数放大 /
+  `_SDKTimeout` 退出 `_FALLBACK_ERRORS` / 去掉 `asyncio.wait_for` / 无界 `thread.join()` /
+  无事件循环主路径退回无界 `asyncio.run` / 布尔 `llm_timeout` 被当成秒数 /
+  `requests.get` 去掉 `timeout=` / `REQUEST_TIMEOUT` 写成 0。
+- 一条假绿当场修掉：`asyncio.run` 退出时会自动 `shutdown_asyncgens` 把生成器的 `finally`
+  补跑一遍，所以"超时后生成器被收尾"那条用例**删掉显式 aclose 照样绿**。补了一条手工开
+  循环、跑完不调 `shutdown_asyncgens` 的用例，才能把"`_query` 自己收的"和"循环兜底收的"分开。
+
 ## [0.5.19] — 2026-09-21
 
 ### 修复：LLM 请求此前没有超时，挂起的网关会让分析永久卡住（#100，by @k176060444-lgtm）
```

**File**: `CLAUDE.md` (modified, +17/-2)
```diff
@@ -6,7 +6,7 @@
 - **仓库**: https://github.com/simonlin1212/TradingAgents-astock
 - **协议**: Apache 2.0
 - **Python**: >=3.10
-- **当前版本**: 0.5.19（2026-09-21 待发布）
+- **当前版本**: 0.5.20（2026-09-21）
   ⚠️ 改版本号时**三处要一起改**：`pyproject.toml` / `CHANGELOG.md` / 这一行。漏了这行会让后续 agent 和发版流程读到旧版本（`tests/test_version_consistency.py` 会拦）。
 
 ## 架构
@@ -99,7 +99,7 @@ deepseek-v4-flash 等模型在 tool call 时可能返回中文股票名而非 6
 
 ### 测试
 **干净 clone（`pip install -e .` 不带 `[agentsdk]`）跑 `pytest tests/` 应当是
-361 passed / 13 skipped / **0 failed**。出现 failed 就是真回归。**
+512 passed / 13 skipped / **0 failed**（v0.5.20 实测，Python 3.13）。出现 failed 就是真回归。**
 需要可选依赖的用例用 `requires_sdk` 标记跳过——⚠️ **占位类型绝不要用 `Exception`
 基类**：`ClaudeSDKError` 曾被占位成 `Exception`，进 `_FALLBACK_ERRORS` 后让"订阅凭据
 失效不得降级到计费 provider"这条护栏彻底失效（v0.5.4 修）。
@@ -133,6 +133,21 @@ deepseek-v4-flash 等模型在 tool call 时可能返回中文股票名而非 6
 静默给用户留下一台死服务器。另外快照**必须在 `config.setup()` 之后**取，否则拿到的是
 模块默认空值，"还原"反而把用户真实配置抹成空。
 
+### 订阅主路径的超时：`_run_query` 是唯一入口（v0.5.20）
+
+`claude_agent_sdk` 不走 LangChain，`llm_timeout` 罩不到它，所以超时在
+`claude_agent_sdk_client.py` 里自己实现。**新增任何驱动 SDK 的调用路径，都要走
+`self._run_query(...)`，不要直接 `_run_async(self._query(...))`** —— 后者没有超时，
+等于给订阅路径重开「进程活着、零输出、永不返回」那个洞。
+
+预算 = `llm_timeout × 本次允许的模型轮数`（`_timeout_for`）。⚠️ **别改成整段固定
+`llm_timeout`**：Agent SDK 把整个工具循环跑在**一次** `.invoke()` 里（最多
+`_TOOL_MAX_TURNS` 轮），150 秒套上去会让分析师几乎每次都超时并降级到按 token 计费的
+provider —— 正是启用订阅要避免的事。`_timeout_for` 收的轮数必须和 `_build_options`
+里设的 `max_turns` 是同一个值。
+
+超时抛 `_SDKTimeout`，在 `_FALLBACK_ERRORS` 里（认证失败仍然不在，见该元组注释）。
+
 ### 待处理 PR
 - PR #18（hejingchi）：start_date 功能 + 主题切换 + Windows 字体。不建议直接 merge（与 v0.2.6 冲突），start_date 功能值得后续自行实现。
 
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -325,7 +325,7 @@ streamlit run web/app.py
 | `max_tokens` | `None` | 单次回复的最大输出 token 数。`None` = 用 provider 默认值。**报告写到一半就断，先调这里**（不是上下文超长）；也可用环境变量 `TRADINGAGENTS_MAX_TOKENS`。#91 |
 | `output_language` | `"Chinese"` | 报告输出语言（内部辩论始终英文） |
 | `market_lookback_days` | `None` | 技术分析回溯天数（分析区间 = 起始日期 → 分析日期）。Web/CLI 由「数据起始日期」自动算出；`None` = 模型自选（约 30 天）。#16 |
-| `llm_timeout` | `150` | 单次 LLM 请求超时（秒），**对所有走 LangChain 客户端的 provider 生效**（`openai` / `anthropic` / `google` / `azure` 及全部 OpenAI 兼容项，订阅撞额度后的降级客户端也带）。此前没有超时：LangChain 的三个封装层（ChatOpenAI / ChatAnthropic / AzureChatOpenAI）在没给超时时都把 `None` **显式**传给底层 SDK，而这在 httpx 里的语义是「不设超时」——挂起的网关会让分析**永久卡住**（进程活着、零输出、永不返回）。⚠️ **例外**：`claude_agent_sdk` 订阅覆盖的**主路径**不走 LangChain 客户端，不受本项保护（已知缺口；它的降级客户端不受影响）。深度推理模型如果经常在吐出首个 token 之前就超过这个值，把它调大（#100） |
+| `llm_timeout` | `150` | 单次 LLM 请求超时（秒），**对所有走 LangChain 客户端的 provider 生效**（`openai` / `anthropic` / `google` / `azure` 及全部 OpenAI 兼容项，订阅撞额度后的降级客户端也带）。此前没有超时：LangChain 的三个封装层（ChatOpenAI / ChatAnthropic / AzureChatOpenAI）在没给超时时都把 `None` **显式**传给底层 SDK，而这在 httpx 里的语义是「不设超时」——挂起的网关会让分析**永久卡住**（进程活着、零输出、永不返回）。`claude_agent_sdk` 订阅覆盖的**主路径**不走 LangChain 客户端，v0.5.20 起由客户端自己实现同一个配置项：订阅调用的整段预算 = 本项 × 该次调用允许的模型轮数（Agent SDK 把整个工具循环跑在**一次**调用里，单轮调用就等于本项本身），超时按限流同样的路径降级。深度推理模型如果经常在吐出首个 token 之前就超过这个值，把它调大（#100） |
 | `llm_max_retries` | `3` | 应用层重试次数，覆盖 408 / 409 / 429 / 5xx 与连接类错误（含读超时），即 OpenAI SDK 原本会重试的那一套。**仅作用于走 OpenAI 兼容客户端的 provider**（`openai` / `deepseek` / `qwen` / `glm` / `minimax` / `xai` / `openrouter` / `ollama` / `openai_compatible`）：只有它们的 SDK 层重试被置 0 并交给应用层；Anthropic / Google / Azure 沿用各家 SDK 自己的重试，不碰 |
 | `llm_retry_delay` | `5` | 重试初始退避秒数，指数翻倍：5s → 10s → 20s |
 | `max_debate_rounds` | `1` | Bull vs Bear 辩论轮数 |
```

**File**: `README_en.md` (modified, +1/-1)
```diff
@@ -310,7 +310,7 @@ All configuration is passed in through the `config` dictionary. Complete options
 | `max_tokens` | `None` | Max output tokens per reply. `None` = the provider's own default. **If a report stops mid-sentence, raise this first** (it is the output cap, not the context window); also settable via `TRADINGAGENTS_MAX_TOKENS`. #91 |
 | `output_language` | `"Chinese"` | Language for report output (internal debates are always in English) |
 | `market_lookback_days` | `None` | Lookback period in days for technical analysis (analysis range = start date → analysis date). Automatically calculated from the "data start date" in Web/CLI; `None` = model chooses (~30 days). #16 |
-| `llm_timeout` | `150` | Per-request LLM timeout in seconds, **applied to every provider that goes through a LangChain client** (`openai` / `anthropic` / `google` / `azure` and all OpenAI-compatible ones; the quota-fallback client carries it too). There used to be no timeout at all: all three LangChain wrappers (ChatOpenAI / ChatAnthropic / AzureChatOpenAI) pass `None` **explicitly** to the underlying SDK when no timeout is given, and to httpx that means "no timeout" — so a hung gateway wedged the analysis **forever** (process alive, no output, never returns). ⚠️ **Exception**: the `claude_agent_sdk` subscription override's **main path** does not go through a LangChain client and is not covered by this setting (known gap; its fallback client is unaffected). Raise it if your reasoning model regularly needs longer than this before its first token (#100) |
+| `llm_timeout` | `150` | Per-request LLM timeout in seconds, **applied to every provider that goes through a LangChain client** (`openai` / `anthropic` / `google` / `azure` and all OpenAI-compatible ones; the quota-fallback client carries it too). There used to be no timeout at all: all three LangChain wrappers (ChatOpenAI / ChatAnthropic / AzureChatOpenAI) pass `None` **explicitly** to the underlying SDK when no timeout is given, and to httpx that means "no timeout" — so a hung gateway wedged the analysis **forever** (process alive, no output, never returns). The `claude_agent_sdk` subscription override's **main path** does not go through a LangChain client; since v0.5.20 the client implements this same setting itself: the budget for one subscription call is this value x the number of model turns that call may take (the Agent SDK runs a whole tool loop inside a **single** call; a single-turn call gets exactly this value), and a timeout falls back along the same path as a rate limit. Raise it if your reasoning model regularly needs longer than this before its first token (#100) |
 | `llm_max_retries` | `3` | Application-level retry count, covering 408 / 409 / 429 / 5xx and connection errors (read timeouts included) — i.e. exactly what the OpenAI SDK used to retry. **Only applies to providers that go through the OpenAI-compatible client** (`openai` / `deepseek` / `qwen` / `glm` / `minimax` / `xai` / `openrouter` / `ollama` / `openai_compatible`): only their SDK-level retries are zeroed and handed to the application layer. Anthropic / Google / Azure keep their own SDK retries untouched |
 | `llm_retry_delay` | `5` | Initial retry backoff in seconds, doubling each time: 5s → 10s → 20s |
 | `max_debate_rounds` | `1` | Number of Bull vs Bear debate rounds |
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "tradingagents-astock"
-version = "0.5.19"
+version = "0.5.20"
 description = "A股多Agent投研框架 — 基于 TradingAgents 深度特化"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `tests/test_agent_sdk_timeout.py` (added, +450/-0)
```diff
@@ -0,0 +1,450 @@
+"""claude_agent_sdk 订阅**主路径**的超时回归（v0.5.20）。
+
+v0.5.19 把 `llm_timeout` 铺到了所有走 LangChain 客户端的 provider，唯独
+`claude_agent_sdk` 的主路径罩不到：它不经 LangChain，直接驱动 Agent SDK 的异步
+生成器（背后是 `claude` 子进程）。子进程卡住 ⇒ `async for` 永远悬着 ⇒ 进程活着、
+零输出、永不返回。README 当时把这条写成「已知缺口」，本文件把它关掉。
+
+⚠️ 刻意**不**用 `requires_sdk` 跳过。`claude-agent-sdk` 是可选 extra，干净安装里
+装不上（本仓现有 13 条 skip 就是它）；把超时护栏挂在可选依赖上，等于默认配置下
+一条都不跑——而超时正是默认配置下最该被保护的东西。所以这里只用替身顶住模块里
+两个 SDK 名字（`_sdk` / `ClaudeAgentOptions`），其余全走生产代码。
+
+全程不碰真实 provider：没有网络、没有子进程、没有订阅额度。
+"""
+
+import asyncio
+import threading
+import time
+from types import SimpleNamespace
+
+import pytest
+from pydantic import BaseModel
+
+from tradingagents.llm_clients import claude_agent_sdk_client as mod
+from tradingagents.llm_clients.claude_agent_sdk_client import (
+    ClaudeAgentSDKClient,
+    _SDKTimeout,
+)
+
+# 用例里给的超时都远小于"挂起协程"的睡眠时长，这样断言 elapsed 才能区分
+# 「真的中断了」和「等它自己睡醒」。
+_TINY_TIMEOUT = 0.05      # 秒，换算后仍 < 挂起时长
+_HANG_SECONDS = 30        # 挂起协程的睡眠时长：不超时就必然跑满这个数
+_ELAPSED_CEILING = 5      # 秒，判定"确实提前中断"的上界
+
+
+class _Plan(BaseModel):
+    decision: str
+    confidence: int
+
+
+class _FakeSDKModule:
+    """顶掉 `mod._sdk`：`_query` 只用到这四个类型做 isinstance 判定。"""
+
+    class RateLimitEvent:
+        pass
+
+    class AssistantMessage:
+        pass
+
+    class TextBlock:
+        pass
+
+    class ResultMessage:
+        pass
+
+
+@pytest.fixture
+def sdk_stub(monkeypatch):
+    """让本模块在**没装** claude-agent-sdk 时也能走完 get_llm → _invoke_* 整条链。
+
+    只顶两个名字：`_sdk`（存在性哨兵 + isinstance 用的类型）和 `ClaudeAgentOptions`
+    （选项构造器）。真正发起调用的 `_query` / `_sdk.query` 由每条用例自己换掉。
+    """
+    monkeypatch.setattr(mod, "_sdk", _FakeSDKModule())
+    monkeypatch.setattr(mod, "ClaudeAgentOptions", lambda **kw: SimpleNamespace(**kw))
+    monkeypatch.setattr(mod, "create_sdk_mcp_server", lambda *a, **k: object())
+
+    def _fake_tool_decorator(name, description, schema):
+        def decorate(fn):
+            fn.name = name
+            return fn
+        return decorate
+
+    monkeypatch.setattr(mod, "_sdk_tool", _fake_tool_decorator)
+    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "test-oauth-token")
+    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
+
+
+class _FakeLangChainTool:
+    name = "get_thing"
+    description = "gets a thing"
+    args_schema = None
+
+    def invoke(self, args):
+        return "thing-data"
+
+
+class _StubStructured:
+    def __init__(self, schema):
+        self._schema = schema
+
+    def invoke(self, prompt, *a, **k):
+        return self._schema(decision="fallback-buy", confidence=1)
+
+
+class _StubBoundTools:
+    def invoke(self, prompt, *a, **k):
+        from langchain_core.messages import AIMessage
+        return AIMessage(content="served by fallback tools")
+
+
+class _StubLLM:
+    def invoke(self, prompt, *a, **k):
+        from langchain_core.messages import AIMessage
+        return AIMessage(content="served by fallback")
+
+    def with_structured_output(self, schema, **k):
+        return _StubStructured(schema)
+
+    def bind_tools(self, tools, **k):
+        return _StubBoundTools()
+
+
+def _install_stub_fallback(monkeypatch):
+    monkeypatch.setattr(
+        "tradingagents.llm_clients.factory.create_llm_client",
+        lambda **kw: type("C", (), {"get_llm": lambda self: _StubLLM()})(),
+    )
+
+
+_FALLBACK_SPEC = {"provider": "deepseek", "model": "deepseek-v4-pro", "base_url": None}
+
+
+def _hanging_client(monkeypatch, timeout=_TINY_TIMEOUT, fallback_spec=None):
+    """客户端的 `_query` 永远不返回 —— 模拟 SDK/CLI 卡住。"""
+    client = ClaudeAgentSDKClient(
+        "claude-opus-4-8", timeout=timeout, fallback_spec=fallback_spec
+    )
+
+    async def hang(prompt, options, prefer_result=False):
+        await asyncio.sleep(_HANG_SECONDS)
+        return "never", None
+
+    monkeypatch.setattr(client, "_query", hang)
+    return client
+
+
+# --------------------------------------------------------------------------- #
+# 预算换算：llm_timeout 是「一次模型调用」的预算
+# --------------------------------------------------------------------------- #
+
+@pytest.mark.unit
+class TestTimeoutBudget:
+    def test_no_timeout_configured_keeps_old_behaviour(self):
+        # 没配 llm_timeout ⇒ 不设超时，行为与本改动前完全一致。
+        client = ClaudeAgentSDKClient("claude-opus-4-8")
+        assert client.timeout is None
+        assert client._timeout_for(1) is None
+        assert client._timeout_for(mod._TOOL_MAX_TURNS) is None
+
+    def test_single_turn_budget_equals_llm_timeout(self):
+        client = ClaudeAgentSDKClient("claude-opus-4-8", timeout=150)
+        assert client._timeout_for(1) == 150
+
+    def test_tool_loop_budget_scales_with_allowed_turns(self):
+        # Agent SDK 把整个 ReAct 循环跑在**一次** invoke 里，最多 _TOOL_MAX_TURNS
+        # 次模型调用；别的 provider 那里每轮都是一次新 HTTP 请求、各拿一份完整预算。
+        # 整段固定 150 秒 ⇒ 分析师几乎每次都超时降级到按 token 计费的 provider。
+        client = ClaudeAgentSDKClient("claude-opus-4-8", timeout=150)
+        assert client._timeout_for(mod._TOOL_MAX_TURN
```

**File**: `tests/test_alpha_vantage_timeout.py` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+"""Alpha Vantage 出站请求的超时回归（v0.5.20）。
+
+`requests.get` 不给 timeout 的语义是**永远等下去**：网关挂起时整轮分析进程
+活着、零输出、永不返回，和 #100 的 LLM 挂死是同一类静默失败。
+
+三件事一起钉：请求真的带上了超时、超时值确实是个正数（写成 0/None 等于白加）、
+以及加超时没有改掉正常返回和限流识别这两条既有行为。
+
+全程不碰真实 Alpha Vantage：`requests.get` 被替身顶掉，API key 用假值。
+"""
+
+import json
+
+import pytest
+
+from tradingagents.dataflows import alpha_vantage_common as av
+
+
+class _FakeResponse:
+    def __init__(self, text: str):
+        self.text = text
+
+    def raise_for_status(self):
+        return None
+
+
+@pytest.fixture
+def fake_api_key(monkeypatch):
+    """`_make_api_request` 会先读环境变量，没有就直接 ValueError。"""
+    monkeypatch.setenv("ALPHA_VANTAGE_API_KEY", "test-key-never-sent")
+
+
+def _capture_request(monkeypatch, text: str = "timestamp,close\n2026-09-21,10"):
+    """换掉 `requests.get`，记录它收到的参数并返回固定响应。"""
+    calls = {}
+
+    def fake_get(url, **kwargs):
+        calls["url"] = url
+        calls["kwargs"] = kwargs
+        return _FakeResponse(text)
+
+    monkeypatch.setattr(av.requests, "get", fake_get)
+    return calls
+
+
+@pytest.mark.unit
+def test_request_carries_the_module_timeout(monkeypatch, fake_api_key):
+    calls = _capture_request(monkeypatch)
+    av._make_api_request("TIME_SERIES_DAILY", {"symbol": "AAPL"})
+
+    assert "timeout" in calls["kwargs"], (
+        "requests.get 没带 timeout —— 语义是永远等下去，挂起的网关会让整轮分析静默卡死"
+    )
+    assert calls["kwargs"]["timeout"] == av.REQUEST_TIMEOUT
+
+
+@pytest.mark.unit
+def test_timeout_policy_is_a_positive_number():
+    # 阴性对照：把常量写成 0 / None / 负数，"有超时"就退化回"没超时"
+    # （requests 收到 None 就是无限等），而上面那条断言照样绿。
+    assert isinstance(av.REQUEST_TIMEOUT, (int, float))
+    assert not isinstance(av.REQUEST_TIMEOUT, bool)
+    assert av.REQUEST_TIMEOUT > 0
+
+
+@pytest.mark.unit
+def test_normal_csv_response_still_returned(monkeypatch, fake_api_key):
+    # 正常行为不能被超时改动动到：CSV 原样返回。
+    body = "timestamp,close\n2026-09-21,10"
+    _capture_request(monkeypatch, text=body)
+    assert av._make_api_request("TIME_SERIES_DAILY", {"symbol": "AAPL"}) == body
+
+
+@pytest.mark.unit
+def test_rate_limit_still_detected(monkeypatch, fake_api_key):
+    # 限流识别走的是响应体 JSON 里的 "Information"，与超时无关，必须照旧生效。
+    _capture_request(
+        monkeypatch,
+        text=json.dumps({"Information": "Our standard API rate limit is 25 requests per day"}),
+    )
+    with pytest.raises(av.AlphaVantageRateLimitError):
+        av._make_api_request("TIME_SERIES_DAILY", {"symbol": "AAPL"})
+
+
+@pytest.mark.unit
+def test_missing_api_key_still_raises_before_any_request(monkeypatch):
+    # 上游给少了（没配 key）：应当在发请求之前就报错，而不是带着空 key 发出去。
+    calls = _capture_request(monkeypatch)
+    monkeypatch.delenv("ALPHA_VANTAGE_API_KEY", raising=False)
+    with pytest.raises(ValueError, match="ALPHA_VANTAGE_API_KEY"):
+        av._make_api_request("TIME_SERIES_DAILY", {"symbol": "AAPL"})
+    assert calls == {}, "缺 key 时不该发出任何请求"
```

**File**: `tests/test_llm_timeout.py` (modified, +28/-3)
```diff
@@ -65,7 +65,11 @@ def clean_global_config():
 def _build_graph(tmp_path, overrides, selected_analysts=("market",)):
     """真的把 `TradingAgentsGraph` 建出来，抓每一次 `create_llm_client` 的入参。
 
-    返回 ``(主客户端调用列表, fallback_spec)``。
+    返回 ``(每一次 create_llm_client 的入参列表, fallback_spec)``。
+
+    第一个返回值包含**所有**客户端，订阅客户端（provider="claude_agent_sdk"）也在内
+    ——它本身也需要超时，而 `fallback_spec` 里那份只在降级**之后**才生效。
+    各用例一律按 provider / model 过滤自己关心的那条。
 
     🔴 不在测试里照抄一遍那份 kwargs —— 抄出来的断言改真代码也不会红，等于没测。
        仓库里就有一条那样的（test_agent_sdk_provider.test_fallback_spec_carries_callbacks
@@ -74,10 +78,9 @@ def _build_graph(tmp_path, overrides, selected_analysts=("market",)):
     seen = {"main": [], "fallback": None}
 
     def fake_create(**kw):
+        seen["main"].append(kw)
         if "fallback_spec" in kw:
             seen["fallback"] = kw["fallback_spec"]
-        else:
-            seen["main"].append(kw)
         return Mock(get_llm=Mock(return_value=Mock()))
 
     config = dict(DEFAULT_CONFIG)
@@ -343,6 +346,28 @@ class TestResilienceFollowsTargetProvider:
     下面每条都走真实构造路径。
     """
 
+    def test_subscription_client_itself_carries_timeout(self, tmp_path):
+        # v0.5.19 只给**降级**客户端带了超时，订阅**主路径**自己一个都没有 ——
+        # 而挂死恰恰发生在降级之前：Agent SDK 的子进程卡住，async for 永远悬着。
+        # 下面一并做阴性对照：订阅客户端不走 OpenAIClient，那三个应用层重试键
+        # 它根本不读，注入进去只会污染 **kwargs。
+        main, _ = _build_graph(tmp_path, {
+            "llm_provider": "deepseek",
+            "deep_think_provider_override": "claude_agent_sdk",
+            "quick_think_provider_override": "claude_agent_sdk",
+            "agent_sdk_fallback_provider": "deepseek",
+            "agent_sdk_fallback_model": "deepseek-chat",
+            "llm_timeout": 150, "llm_max_retries": 3, "llm_retry_delay": 5,
+        })
+        sdk_clients = [kw for kw in main if kw["provider"] == "claude_agent_sdk"]
+        assert len(sdk_clients) == 2, (
+            f"deep+quick 都开了订阅，应建两个订阅客户端：{[k['provider'] for k in main]}"
+        )
+        for kw in sdk_clients:
+            assert kw["timeout"] == 150, "订阅主路径没拿到 llm_timeout ⇒ 卡住就永不返回"
+            for key in ("max_retries", "app_retries", "app_retry_delay"):
+                assert key not in kw, f"订阅客户端不该带 {key}：{kw.get(key)}"
+
     def test_openai_compatible_fallback_carries_timeout_and_retries(self, tmp_path):
         # 降级是**撞额度那一刻**才走到的路径，目标往往就是 OpenAI 兼容网关 ——
         # 正是"显式 None ⇒ 永不超时"那个洞所在。漏带 = #100 修的挂死在最需要它
```

---

### Incident Patch 2: `7747b6dd` (2026-09-20)
**Commit Message**: fix: harden LLM resilience for v0.5.19

**File**: `CHANGELOG.md` (modified, +130/-0)
```diff
@@ -6,6 +6,136 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
 and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 Breaking changes within the 0.x line are called out explicitly.
 
+## [0.5.19] — 2026-09-21
+
+### 修复：LLM 请求此前没有超时，挂起的网关会让分析永久卡住（#100，by @k176060444-lgtm）
+
+langchain 的封装层在用户没给超时时，会把 `None` **显式**传给底层 SDK 再传到 httpx ——
+httpx 收到显式 `None` 的语义是「不设超时」，不是「用默认值」。对着一个接受连接但永不回应的
+socket 实测：跑满 120 秒零输出、零异常。也就是说上游网关一挂，风险辩论节点不是等得久，
+是**永远不返回**，进程活着但没有任何输出。
+
+这**不是 OpenAI 路径独有的**。实测构造出来的对象（不是底层库的默认常量）：
+
+| 封装层 | 不给 timeout | 给 timeout=150 |
+|---|---|---|
+| `ChatOpenAI` | SDK client.timeout = `None`（无限等） | `150.0` |
+| `ChatAnthropic` | SDK client.timeout = `None`（无限等） | `150.0` |
+| `AzureChatOpenAI` | SDK client.timeout = `None`（无限等） | `150.0` |
+
+所以 `llm_timeout`（默认 150 秒）**对所有走 LangChain 客户端的 provider 生效**——
+`openai` / `anthropic` / `google` / `azure` 及全部 OpenAI 兼容项，订阅撞额度后的降级客户端
+也带上。（「另几家 SDK 自带 600 秒读超时」只对**裸 SDK** 成立，本项目从不直接用裸 SDK。）
+
+⚠️ **一处例外**：`claude_agent_sdk` 订阅覆盖的**主路径**不经过 LangChain 客户端
+（`AgentSDKChatModel` 直接调 Agent SDK 子进程），因此不受 `llm_timeout` 保护 ——
+这是**本版未消除的已知缺口**，不是新引入的。它的降级客户端走正常链路，不受影响。
+
+### 修复：SDK 重试被置 0 之后，应用层漏接了 429 / 408 / 409 与连接类错误
+
+#100 把 OpenAI 兼容路径的 SDK 层 `max_retries` 置 0、改由应用层指数退避重试，但应用层
+只捕获了 5xx 与读超时。SDK 原本的可重试集合是 **408 / 409 / 429 / 5xx + 连接类异常**
+（`openai/_base_client.py::_should_retry`），而 `RateLimitError` **不是**
+`InternalServerError` 的子类（实测 `issubclass` 为 False）——结果是这个「韧性 PR」把韧性
+做没了：高峰期一个 429 就能让整轮分析当场死掉，而 SDK 从前会重试 2 次。
+
+现在按 SDK 同一套判据重试；408 / 409 没有专属异常类型（408 是裸 `APIStatusError`、
+409 是 `ConflictError`），所以按状态码判。**鉴权 / 参数错误（400 / 401 / 404 / 422）
+仍然第一次就抛**，不让用户干等三轮退避才看到「你的 key 不对」。
+
+### 修复：超时与重试改为按**目标 provider** 计算，三个调用点各自应用
+
+这份 kwargs 有三个消费方——主客户端、订阅撞额度后的降级 `fallback_spec`、分角色模型
+`role_llms`——每个都可能指向**不同的** provider。此前按 `config["llm_provider"]` 一刀切，
+于是：
+
+- **降级路径一个韧性参数都没带**。降级目标往往就是一个 OpenAI 兼容网关，也就是上面那个
+  「永不返回」的洞所在；漏带的话，这个挂死会恰好在撞额度、最需要它工作的那一刻原样复现。
+- **`role_llms` 两个方向都错**。主 `anthropic` + `bull=deepseek` 时，deepseek 角色拿不到
+  应用层重试（而它的 SDK 重试本该被置 0 并接管）；反方向则会把 `max_retries=0` 套到
+  Anthropic 头上，静默关掉它自己的 SDK 重试。
+- **`agent_sdk_fallback_provider` 的比较是全仓唯一没有 `.lower()` 的**。写成 `"DeepSeek"`
+  时同一家被判成跨厂商，`backend_url` 被扔掉、降级请求发去官方默认端点（拿自建网关的 key
+  去官方认证 = 401）。
+
+### 修复：provider 字符串的归一化统一到 `create_llm_client` 这个中央边界
+
+provider 来自用户手写的 `llm_provider` / `role_llms` / 降级配置，`"DeepSeek"`、
+`" deepseek "` 都是常见写法（README 通篇就写作 DeepSeek）。工厂此前只做 `.lower()`，
+**带首尾空格的写法会一路走到最后抛 `Unsupported LLM provider`** ——
+`role_llms: {"bull": {"provider": " DeepSeek "}}` 直接让启动失败。
+
+现在 `create_llm_client` 统一 `strip().lower()`，并让 `trading_graph` 里那四处判据
+（`base_url` 取舍 / 专属参数过滤 / 韧性参数 / role 实例缓存键）共用**同一个**归一化结果。
+口径不一致的两个具体后果：同一家被判成跨厂商而丢掉 `backend_url`；
+`"deepseek"` 与 `" deepseek "` 被当成两家、同一个 (模型, 端点) 白建第二条连接。
+拼错的 provider（如 `"deepsek"`）仍照常报错，strip 不会把它"救"成可用。
+
+### 修复：opencode.ai 网关开了流式却没开 `stream_usage`，token 统计静默归零
+
+langchain 只在非流式回复上自带 `usage_metadata`；流式下要显式
+`stream_options.include_usage`，而它的自动开启逻辑在设了 `openai_api_base` 时直接跳过
+（opencode 这条路恒定设了 base_url）。后果不报错：整轮跑完统计面板写
+`tokens_in=0 / tokens_out=0`，看起来像「这次没花钱」。现在显式开启，
+并把 `stream_usage` 加入透传参数，需要关掉的人可以显式传 `False`。
+
+### 修复：`llm_max_retries` 配成负数时 `invoke()` 静默返回 `None`
+
+`range(-1 + 1)` 让循环一次都不执行，旧代码在末尾 `return None`，调用方会在很远的地方炸在
+`result.tool_calls` 上、根因完全看不出来。现在次数夹到非负（仍执行一次），
+且那条不可达分支改为抛 `RuntimeError`。
+
+### 新增：GLM 模型表补充 GLM-5.3 / GLM-5.3-Flash / GLM-5.2（#112，by @FelixWang119）
+
+四个模型 ID 均已对照智谱官方模型总览页核实存在。quick 档新增 `glm-5.3-flash` 与 `glm-5.3`，
+deep 档新增 `glm-5.3` 与 `glm-5.2`。
+
+### 文档
+
+- 配置表补上 `llm_timeout` / `llm_max_retries` / `llm_retry_delay` 三项（中英文同步）。
+- 配置表补上远程 Ollama 的写法（#61）：`llm_provider` 选 `ollama`、`backend_url` 填
+  `http://<主机>:11434/v1`。这个能力一直都在，只是从没写进文档。
+
+### 测试
+
+新增 38 条（`tests/test_llm_timeout.py` 由 11 条增至 49 条）。全量在两套依赖上各跑一次，
+**均 0 failed**：
+
+| 环境 | Python | openai | langchain-openai | 结果 |
+|---|---|---|---|---|
+| A | 3.12.13 | 3.16.2 | 1.6.2 | 476 passed / 14 skipped / 48 subtests |
+| B | 3.13.13 | 2.48.0 | 1.4.1 | 477 passed / 13 skipped / 51 subtests |
+
+两者相差的那 1 passed / 1 skipped / 3 subtests 只来自 `tests/test_google_api_key.py`：
+环境 B 装了 `langchain-google-genai` 4.3.1，环境 A 没装（#87 的 httpx 冲突）。
+环境 A 的 476 − 38 = 438，与合并 #100+#112 后记录的基线一致。
+
+跑两套是因为本版的判据挂在 OpenAI SDK 的异常形状上：**两个大版本里
+408 → 裸 `APIStatusError`、409 → `ConflictError`、429 → `RateLimitError` 的映射都实测成立**，
+所以按状态码判这条实现是跨版本稳的。
+
+- 三个消费方的用例都走**真实构造路径**（建出 `TradingAgentsGraph` 并抓
+  `create_llm_client` 的实际入参），不在测试里照抄一遍待测的那份 kwargs。
+- provider 拼写的用例**必须打到真工厂**：只断言"被 patch 的工厂收到了什么 kwargs"
+  是假绿 —— 归一化不一致时恰恰是真工厂抛 `Unsupported LLM provider`。
+- 每条护栏都有阴性对照：降级到 anthropic 只拿超时不拿重试、role_llms 反方向、
+  400/401/404/422 第一次就抛、显式 `stream_usage=False` 要被尊重、
+  拼错的 provider 仍报错。
+- 16 个变异逐一验红（超时移进 OpenAI 门内 / 降级不带参数 / 降级按 llm_provider 算 /
+  role_llms 不重算 / 三处 provider 归一化各自退化 / 工厂 strip 过头 / 缓存键脱钩 /
+  捕获集合缩回 / 408 按类型判 / `APIStatusError` 一把梭 / 不夹负数 /
+
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 - **仓库**: https://github.com/simonlin1212/TradingAgents-astock
 - **协议**: Apache 2.0
 - **Python**: >=3.10
-- **当前版本**: 0.5.18（2026-09-20 发布）
+- **当前版本**: 0.5.19（2026-09-21 待发布）
   ⚠️ 改版本号时**三处要一起改**：`pyproject.toml` / `CHANGELOG.md` / 这一行。漏了这行会让后续 agent 和发版流程读到旧版本（`tests/test_version_consistency.py` 会拦）。
 
 ## 架构
```

**File**: `README.md` (modified, +4/-1)
```diff
@@ -320,11 +320,14 @@ streamlit run web/app.py
 | `llm_provider` | `"minimax"` | LLM 提供商：`minimax` / `deepseek` / `qwen` / `glm` / `openai` / `anthropic` / `google` / `xai` / `ollama` |
 | `deep_think_llm` | `"MiniMax-M2.7"` | Research Manager + Portfolio Manager 用的模型 |
 | `quick_think_llm` | `"MiniMax-M2.7-highspeed"` | 所有 Analyst / Researcher / Trader 用的模型 |
-| `backend_url` | `None` | 自定义 API 端点 / 第三方中转网关。可在 Web UI 侧边栏填写，或用 `.env` 的 `BACKEND_URL`；方便国内通过代理访问 Claude / OpenAI |
+| `backend_url` | `None` | 自定义 API 端点 / 第三方中转网关。可在 Web UI 侧边栏填写，或用 `.env` 的 `BACKEND_URL`；方便国内通过代理访问 Claude / OpenAI。**跑远程 Ollama 也是填这里**：`llm_provider` 选 `ollama`、`backend_url` 填 `http://<主机>:11434/v1`，不填则默认本机 `http://localhost:11434/v1`（#61） |
 | `role_llms` | `{}` | **可选**：给单个角色指定另一家模型（如多空辩手用不同厂商），留空 = 全部沿用 quick/deep 两档，行为不变。见下方「分角色模型」 #39 |
 | `max_tokens` | `None` | 单次回复的最大输出 token 数。`None` = 用 provider 默认值。**报告写到一半就断，先调这里**（不是上下文超长）；也可用环境变量 `TRADINGAGENTS_MAX_TOKENS`。#91 |
 | `output_language` | `"Chinese"` | 报告输出语言（内部辩论始终英文） |
 | `market_lookback_days` | `None` | 技术分析回溯天数（分析区间 = 起始日期 → 分析日期）。Web/CLI 由「数据起始日期」自动算出；`None` = 模型自选（约 30 天）。#16 |
+| `llm_timeout` | `150` | 单次 LLM 请求超时（秒），**对所有走 LangChain 客户端的 provider 生效**（`openai` / `anthropic` / `google` / `azure` 及全部 OpenAI 兼容项，订阅撞额度后的降级客户端也带）。此前没有超时：LangChain 的三个封装层（ChatOpenAI / ChatAnthropic / AzureChatOpenAI）在没给超时时都把 `None` **显式**传给底层 SDK，而这在 httpx 里的语义是「不设超时」——挂起的网关会让分析**永久卡住**（进程活着、零输出、永不返回）。⚠️ **例外**：`claude_agent_sdk` 订阅覆盖的**主路径**不走 LangChain 客户端，不受本项保护（已知缺口；它的降级客户端不受影响）。深度推理模型如果经常在吐出首个 token 之前就超过这个值，把它调大（#100） |
+| `llm_max_retries` | `3` | 应用层重试次数，覆盖 408 / 409 / 429 / 5xx 与连接类错误（含读超时），即 OpenAI SDK 原本会重试的那一套。**仅作用于走 OpenAI 兼容客户端的 provider**（`openai` / `deepseek` / `qwen` / `glm` / `minimax` / `xai` / `openrouter` / `ollama` / `openai_compatible`）：只有它们的 SDK 层重试被置 0 并交给应用层；Anthropic / Google / Azure 沿用各家 SDK 自己的重试，不碰 |
+| `llm_retry_delay` | `5` | 重试初始退避秒数，指数翻倍：5s → 10s → 20s |
 | `max_debate_rounds` | `1` | Bull vs Bear 辩论轮数 |
 | `max_risk_discuss_rounds` | `1` | 风险三方辩论轮数 |
 | `data_vendors` | 全部 `"a_stock"` | 数据供应商路由 |
```

**File**: `README_en.md` (modified, +4/-1)
```diff
@@ -305,11 +305,14 @@ All configuration is passed in through the `config` dictionary. Complete options
 | `llm_provider` | `"minimax"` | LLM provider: `minimax` / `deepseek` / `qwen` / `glm` / `openai` / `anthropic` / `google` / `xai` / `ollama` |
 | `deep_think_llm` | `"MiniMax-M2.7"` | Model used by the Research Manager + Portfolio Manager |
 | `quick_think_llm` | `"MiniMax-M2.7-highspeed"` | Model used by all Analysts / Researchers / Traders |
-| `backend_url` | `None` | Custom API endpoint / third-party relay gateway. Can be filled in via the Web UI sidebar or the `.env` file's `BACKEND_URL`; useful for accessing Claude / OpenAI from within China via a proxy |
+| `backend_url` | `None` | Custom API endpoint / third-party relay gateway. Can be filled in via the Web UI sidebar or the `.env` file's `BACKEND_URL`; useful for accessing Claude / OpenAI from within China via a proxy. **This is also how you reach a remote Ollama**: set `llm_provider` to `ollama` and `backend_url` to `http://<host>:11434/v1`; leaving it unset defaults to the local `http://localhost:11434/v1` (#61) |
 | `role_llms` | `{}` | **Optional**: give individual roles a different model (e.g. bull vs bear from different vendors). Empty = every role uses the quick/deep pair as before. See "Per-role models" below. #39 |
 | `max_tokens` | `None` | Max output tokens per reply. `None` = the provider's own default. **If a report stops mid-sentence, raise this first** (it is the output cap, not the context window); also settable via `TRADINGAGENTS_MAX_TOKENS`. #91 |
 | `output_language` | `"Chinese"` | Language for report output (internal debates are always in English) |
 | `market_lookback_days` | `None` | Lookback period in days for technical analysis (analysis range = start date → analysis date). Automatically calculated from the "data start date" in Web/CLI; `None` = model chooses (~30 days). #16 |
+| `llm_timeout` | `150` | Per-request LLM timeout in seconds, **applied to every provider that goes through a LangChain client** (`openai` / `anthropic` / `google` / `azure` and all OpenAI-compatible ones; the quota-fallback client carries it too). There used to be no timeout at all: all three LangChain wrappers (ChatOpenAI / ChatAnthropic / AzureChatOpenAI) pass `None` **explicitly** to the underlying SDK when no timeout is given, and to httpx that means "no timeout" — so a hung gateway wedged the analysis **forever** (process alive, no output, never returns). ⚠️ **Exception**: the `claude_agent_sdk` subscription override's **main path** does not go through a LangChain client and is not covered by this setting (known gap; its fallback client is unaffected). Raise it if your reasoning model regularly needs longer than this before its first token (#100) |
+| `llm_max_retries` | `3` | Application-level retry count, covering 408 / 409 / 429 / 5xx and connection errors (read timeouts included) — i.e. exactly what the OpenAI SDK used to retry. **Only applies to providers that go through the OpenAI-compatible client** (`openai` / `deepseek` / `qwen` / `glm` / `minimax` / `xai` / `openrouter` / `ollama` / `openai_compatible`): only their SDK-level retries are zeroed and handed to the application layer. Anthropic / Google / Azure keep their own SDK retries untouched |
+| `llm_retry_delay` | `5` | Initial retry backoff in seconds, doubling each time: 5s → 10s → 20s |
 | `max_debate_rounds` | `1` | Number of Bull vs Bear debate rounds |
 | `max_risk_discuss_rounds` | `1` | Number of risk three-way debate rounds |
 | `data_vendors` | All `"a_stock"` | Data vendor routing |
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "tradingagents-astock"
-version = "0.5.18"
+version = "0.5.19"
 description = "A股多Agent投研框架 — 基于 TradingAgents 深度特化"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `tests/test_llm_timeout.py` (modified, +366/-3)
```diff
@@ -7,22 +7,39 @@
 """
 
 import time as _time
-from unittest.mock import Mock
+from unittest.mock import Mock, patch
 
+import httpx
 import pytest
-from openai import InternalServerError, APITimeoutError
+from openai import APIConnectionError, APITimeoutError, InternalServerError, OpenAI
 
+from tradingagents.dataflows import config as _dataflows_config
 from tradingagents.default_config import DEFAULT_CONFIG
 from tradingagents.graph import trading_graph as tg
+from tradingagents.llm_clients.factory import create_llm_client as real_create_llm_client
 from tradingagents.llm_clients.openai_client import NormalizedChatOpenAI, OpenAIClient
 
+# 超时/重试三件套 + timeout，四个键一起看：少看一个就会漏掉"只修了一半"。
+_RESILIENCE_KEYS = ("timeout", "max_retries", "app_retries", "app_retry_delay")
+
+# 状态码 → SDK 真正会抛的那个异常类型。自己 Mock(status_code=...) 造不出
+# 408 是裸 APIStatusError、409 是 ConflictError 这种真实形状，而按类型判还是按
+# 状态码判恰恰是这里的关键分歧，所以走 SDK 自己的映射函数。
+_STATUS_ERROR_SOURCE = OpenAI(api_key="test-key-not-used")
+
 
 def _graph_with(config):
     graph = tg.TradingAgentsGraph.__new__(tg.TradingAgentsGraph)
     graph.config = config
     return graph
 
 
+def _status_error(code):
+    return _STATUS_ERROR_SOURCE._make_status_error_from_response(
+        httpx.Response(code, request=httpx.Request("POST", "https://example.invalid/v1"))
+    )
+
+
 def _server_error(status=503):
     return InternalServerError(f"{status}", response=Mock(status_code=status), body=None)
 
@@ -31,6 +48,51 @@ def _timeout_error():
     return APITimeoutError(request=Mock())
 
 
+@pytest.fixture
+def clean_global_config():
+    """`TradingAgentsGraph.__init__` 会 set_config() 改全局配置（原地 update，不可逆）。
+
+    不还原的话，本文件建过图之后，同一次 pytest 里后面的用例会读到被污染的
+    `get_config()` —— 那种失败看起来像"另一个模块坏了"，最难查。
+    """
+    saved = None if _dataflows_config._config is None else dict(_dataflows_config._config)
+    try:
+        yield
+    finally:
+        _dataflows_config._config = saved
+
+
+def _build_graph(tmp_path, overrides, selected_analysts=("market",)):
+    """真的把 `TradingAgentsGraph` 建出来，抓每一次 `create_llm_client` 的入参。
+
+    返回 ``(主客户端调用列表, fallback_spec)``。
+
+    🔴 不在测试里照抄一遍那份 kwargs —— 抄出来的断言改真代码也不会红，等于没测。
+       仓库里就有一条那样的（test_agent_sdk_provider.test_fallback_spec_carries_callbacks
+       自己把 spec 字典拼了一遍）。这里走的是生产路径本身。
+    """
+    seen = {"main": [], "fallback": None}
+
+    def fake_create(**kw):
+        if "fallback_spec" in kw:
+            seen["fallback"] = kw["fallback_spec"]
+        else:
+            seen["main"].append(kw)
+        return Mock(get_llm=Mock(return_value=Mock()))
+
+    config = dict(DEFAULT_CONFIG)
+    config.update({
+        "data_cache_dir": str(tmp_path / "cache"),
+        "results_dir": str(tmp_path / "results"),
+    })
+    config.update(overrides)
+    with patch.object(tg, "create_llm_client", fake_create):
+        tg.TradingAgentsGraph(
+            selected_analysts=list(selected_analysts), debug=False, config=config
+        )
+    return seen["main"], seen["fallback"]
+
+
 @pytest.mark.unit
 class TestProviderKwargs:
     def test_timeout_forwarded_and_sdk_retries_zeroed(self):
@@ -57,14 +119,42 @@ def test_anthropic_and_google_do_not_zero_max_retries(self):
         # 针对 PR #100 review 回归防护：只有走 OpenAIClient 的 provider 才会
         # 关闭 SDK 重试并注入应用层退避参数。Anthropic / Google 等原生 SDK 具有
         # 自己的重试逻辑，不能注入 max_retries=0 破坏其弹性，也不能注入未使用的 app_retries。
+        #
+        # 🔴 但 `timeout` **必须照给**，这两件事是分开的。
+        #    "另几家 SDK 自带 600 秒读超时" 只对**裸 SDK** 成立，本项目一次都没
+        #    走过裸 SDK：langchain 的三个封装层在用户没给超时时都把 None
+        #    **显式**传下去，httpx 收到显式 None = 不设超时。实测构造出来的对象：
+        #      ChatAnthropic()          -> sdk client.timeout=None（无限等）
+        #      ChatAnthropic(timeout=150) -> 150.0
+        #      AzureChatOpenAI 同形状。
+        #    不给超时就是给它们重开 #100 那个"进程活着、零输出、永不返回"的洞。
         for provider in ("anthropic", "google", "azure", "claude_agent_sdk"):
             g = _graph_with({"llm_provider": provider, "llm_timeout": 120})
             kw = g._get_provider_kwargs()
-            assert kw.get("timeout") == 120
+            assert kw.get("timeout") == 120, f"{provider} 少了超时 = 可能永久挂起"
             assert "max_retries" not in kw
             assert "app_retries" not in kw
             assert "app_retry_delay" not in kw
 
+    def test_resilience_kwargs_normalizes_its_own_input(self):
+        # `_resilience_kwargs` 是三个调用点共用的判据，它**自己**归一化入参，
+        # 这样第四个调用点不必记得先 strip/lower。三个现有调用点都已各自归一化
+        # （它们还要拿归一化结果去比 base_url、算缓存键），所以这条契约只能在
+        # 这一层直接钉，否则它是一段谁也证伪不了的代码。
+        g = _graph_with({"llm_provider": "anthropic", "llm_timeout": 120})
+        for raw in (" DeepSeek ", "DEEPSEEK", "deepseek\n"):
+            assert g._resilience_kwargs(raw)["max_retries"] == 0, raw
+        for raw in (" Anthropic ", None, "", 123):
+            assert "max_retries" not in g._resilience_kwargs(raw), raw
+
+    def test_provider_comparison_is_case_and_space_insensitive(self):
+        # 用户把 provider 写成 "DeepSeek" / " deepseek "
```

**File**: `tradingagents/default_config.py` (modified, +10/-5)
```diff
@@ -33,13 +33,18 @@
     ),
     # 单次 LLM 请求超时（秒）。None = 用 provider/客户端默认值。设具体值可兜底
     # 「请求挂起导致静默卡死」——超时后由客户端抛异常，而非进程 alive 但永久无输出。
-    # 经 _get_provider_kwargs → _PASSTHROUGH_KWARGS 透传给 openai / anthropic 系客户端；
-    # claude_agent_sdk 的 AgentSDKChatModel 不走该链路，暂不受此超时保护（已知缺口）。
+    # 经 _resilience_kwargs → 各 client 的 _PASSTHROUGH_KWARGS 透传，**对所有走
+    # LangChain 客户端的 provider 生效**（含订阅降级客户端）：langchain 的三个封装层
+    # 在没给超时时都把 None 显式传给底层 SDK，而 httpx 收到显式 None = 不设超时
+    #（"各家 SDK 自带 600 秒"只对裸 SDK 成立，本项目不走裸 SDK）。
+    # ⚠️ 例外：claude_agent_sdk 订阅覆盖的**主路径**（AgentSDKChatModel 直连 Agent SDK
+    # 子进程）不走该链路，暂不受此超时保护（已知缺口）。
     "llm_timeout": 150,
-    # 5xx（502/503 等）及读超时后的应用层重试次数。SDK 层恒 0 重试（仅限 OpenAI 兼容客户端，见 _get_provider_kwargs），
-    # 由 openai_client.invoke 按下面的固定冷静期退避重试，而非 SDK 的 0.5s 指数退避。
+    # 应用层重试次数，覆盖 408 / 409 / 429 / 5xx 与连接类错误（含读超时）——即 OpenAI SDK
+    # 原本会重试的那一套。SDK 层恒 0 重试（仅限 OpenAI 兼容客户端，见 _resilience_kwargs），
+    # 由 openai_client.invoke 按下面的退避节奏重试，而非 SDK 的 0.5s 起步退避。
     "llm_max_retries": 3,
-    # 5xx 重试的初始退避（秒），指数翻倍：第 1 次重试等 5s、第 2 次 10s、第 3 次 20s...
+    # 重试的初始退避（秒），指数翻倍：第 1 次重试等 5s、第 2 次 10s、第 3 次 20s...
     # 避免对刚报错的上游立即重试造成雪崩，也避免固定间隔在持续故障时反复撞击。
     "llm_retry_delay": 5,
     # 可选：给单个角色单独指定模型（#39）。留空 = 全部角色沿用上面的
```

**File**: `tradingagents/graph/trading_graph.py` (modified, +81/-23)
```diff
@@ -67,13 +67,18 @@
 })
 
 # 各家 provider 私有的参数：换了 provider 就不能带过去（别家可能直接拒收）。
+# ⚠️ 超时/重试**不在**这张表里——它们由 `_resilience_kwargs()` 按目标 provider
+#    重算（见那里的注释）。放进来会变成第二道判据，两道判据迟早对不上。
 _PROVIDER_SPECIFIC_KWARGS = frozenset({
     "reasoning_effort",   # openai
     "thinking_level",     # google
     "effort",             # anthropic
-    "max_retries",        # 仅 openai_compatible 设为 0；换 provider 时沿用 SDK 默认
-    "app_retries",        # 仅 openai_client 读取
-    "app_retry_delay",    # 仅 openai_client 读取
+})
+
+# 超时与重试三件套：由 `_resilience_kwargs()` 统一产出，也由它统一覆盖。
+# 任何继承来的 llm_kwargs 在换目标 provider 时，这几个键都要先剔除再重算。
+_RESILIENCE_KWARGS = frozenset({
+    "timeout", "max_retries", "app_retries", "app_retry_delay",
 })
 
 
@@ -250,9 +255,15 @@ def _make_client(override_on, sdk_model_key, fallback_model_key):
                 # provider 做降级时不能把它带过去（例如把 anthropic 降级请求发到
                 # MiniMax 网关），否则同样是撞额度那一刻才炸。None ⇒ 该 provider
                 # 用自己的默认端点。
-                cross_provider = bool(_fb_provider) and _fb_provider != self.config["llm_provider"]
+                # provider 比较一律 strip+lower：配成 "DeepSeek" 时**同一家**会被判成
+                # 跨厂商，`backend_url` 就被扔掉，降级请求发去该 provider 的默认端点
+                # ——同样是撞额度那一刻才炸。
+                _fb_norm = str(_fb_provider or "").strip().lower()
+                _main_norm = str(self.config["llm_provider"] or "").strip().lower()
+                cross_provider = bool(_fb_norm) and _fb_norm != _main_norm
+                _fb_effective = _fb_norm or _main_norm
                 fallback_spec = {
-                    "provider": _fb_provider or self.config["llm_provider"],
+                    "provider": _fb_effective,
                     "model": _fb_model or self.config[fallback_model_key],
                     "base_url": None if cross_provider else self.config.get("backend_url"),
                     # 带上 callbacks：降级意味着**开始计费**，此时统计/成本回调
@@ -263,6 +274,12 @@ def _make_client(override_on, sdk_model_key, fallback_model_key):
                     # 用户配 max_tokens 想避免的事（#91）。
                     **({"max_tokens": self.config["max_tokens"]}
                        if self.config.get("max_tokens") else {}),
+                    # 超时与应用层重试同样要带过去，理由和上面两条一样：降级是
+                    # **撞额度那一刻**才走到的路径，而降级目标往往就是一个 OpenAI
+                    # 兼容网关——正是 #100 那个"永不返回"的洞所在。漏带的话，这个
+                    # 挂死会恰好在最需要它工作的时候原样复现。
+                    # 判据按 `_fb_effective`（真正的目标）算，不是按 llm_provider。
+                    **self._resilience_kwargs(_fb_effective),
                 }
                 return create_llm_client(
                     provider="claude_agent_sdk",
@@ -378,12 +395,18 @@ def _build_role_llms(
                     f'例如 {{"provider": "deepseek", "model": "deepseek-chat"}}。'
                 )
             provider = spec.get("provider") or main_provider
+            # role_llms 的 provider 是用户手写的自由字符串（README 通篇写作
+            # "DeepSeek"）。下面四处判据 —— base_url / 专属参数 / 韧性参数 / 缓存键
+            # —— 必须用**同一个**归一化结果，否则会出现"这处算同一家、那处算跨厂商"。
+            # 口径与 factory.create_llm_client 一致：strip().lower()。
+            provider_norm = provider.strip().lower()
+            main_norm = str(main_provider or "").strip().lower()
             # backend_url 是给主 provider 配的端点。换了厂商还把它带过去，请求就会
             # 发到另一家的网关（和 agent_sdk 降级那里同一个坑）。None = 用该
             # provider 自己的默认端点。
             if "backend_url" in spec:
                 base_url = spec["backend_url"]
-            elif provider.lower() == str(main_provider).lower():
+            elif provider_norm == main_norm:
                 base_url = self.config.get("backend_url")
             else:
                 base_url = None
@@ -392,13 +415,24 @@ def _build_role_llms(
             # `reasoning_effort`、google 的 `thinking_level`、anthropic 的 `effort`
             # 都是各家私有的，塞进 qwen / glm / 自建网关的请求体里可能直接被拒。
             # 通用参数（max_tokens / callbacks 等）保留。
+            # `dict(...)` 是防御性的：下面要 pop 韧性键，同名分支直接复用引用就会
+            # 就地改掉调用方的 llm_kwargs。**当前观察不到后果**（主 quick/deep 两个
+            # 客户端已在本方法之前建好），所以没有测试钉它；留着是为了别人挪动建
+            # 客户端的顺序时不会踩到。
             role_kwargs = (
-                llm_kwargs if provider.lower() == str(main_provider).lower()
+                dict(llm_kwargs) if provider_norm == main_norm
                 else {k: v for k, v in llm_kwargs.items()
                       if k not in _PROVIDER_SPECIFIC_KWARGS}
             )
-
-            key = (provider.lower(), spec["model"], base_url, spec.get("api_key"))
+            # 超时/重试按**这个角色的** provider 重算，不沿用主 provider 的那份：
+            # 主 anthropic + bull=deepseek 时，deepseek 角色本该拿到应用层退避重试
+            # （它的 SDK 重试被我们置 0 了）；反方向则绝不能把 max_retries=0 套到
+            # anthropic 头上。两个方向都只有按目标算才对。
+            for key in _RESILIENCE_KWARGS:
+                role_kwargs.pop(key, None)
+            role_kwargs.update(self._resilience_kwargs(provider_norm))
+
+            key = (provider_norm, spec["model"], base_url, spec.get("api_key"))
             if key not in cache:
 
```

---

### Incident Patch 3: `dd35ce2c` (2026-09-20)
**Commit Message**: Merge pull request #100 from k176060444-lgtm/fix/llm-resilience

fix(llm): prevent hangs via timeout retry and streaming keep-alive

**File**: `tests/test_llm_timeout.py` (added, +183/-0)
```diff
@@ -0,0 +1,183 @@
+"""llm_timeout / llm_max_retries / llm_retry_delay 透传与应用层重试回归测试。
+
+风险辩论节点内同步 llm.invoke() 曾缺少超时保护：provider 请求挂起时节点永不返回，
+进程 alive 但静默卡死。补丁分两层：
+- SDK 层：timeout 兜底挂起，max_retries 恒 0（重试交给应用层）。
+- 应用层：openai_client.invoke 捕获 5xx，按指数退避重试（5s, 10s, 20s...）。
+"""
+
+import time as _time
+from unittest.mock import Mock
+
+import pytest
+from openai import InternalServerError, APITimeoutError
+
+from tradingagents.default_config import DEFAULT_CONFIG
+from tradingagents.graph import trading_graph as tg
+from tradingagents.llm_clients.openai_client import NormalizedChatOpenAI, OpenAIClient
+
+
+def _graph_with(config):
+    graph = tg.TradingAgentsGraph.__new__(tg.TradingAgentsGraph)
+    graph.config = config
+    return graph
+
+
+def _server_error(status=503):
+    return InternalServerError(f"{status}", response=Mock(status_code=status), body=None)
+
+
+def _timeout_error():
+    return APITimeoutError(request=Mock())
+
+
+@pytest.mark.unit
+class TestProviderKwargs:
+    def test_timeout_forwarded_and_sdk_retries_zeroed(self):
+        g = _graph_with({"llm_provider": "openai", "llm_timeout": 120, "llm_max_retries": 2, "llm_retry_delay": 5})
+        kw = g._get_provider_kwargs()
+        assert kw["timeout"] == 120
+        assert kw["max_retries"] == 0        # SDK 层恒 0，重试交给应用层
+        assert kw["app_retries"] == 2        # 应用层重试次数
+        assert kw["app_retry_delay"] == 5    # 初始退避（秒）
+
+    def test_app_retries_zero_is_not_dropped(self):
+        # app_retries=0（不重试）是合法值，不能因为 falsy 被默认值覆盖。
+        g = _graph_with({"llm_provider": "openai", "llm_max_retries": 0})
+        assert g._get_provider_kwargs()["app_retries"] == 0
+
+    def test_defaults_when_keys_absent(self):
+        g = _graph_with({"llm_provider": "openai"})
+        kw = g._get_provider_kwargs()
+        assert kw["max_retries"] == 0        # 恒 0
+        assert kw["app_retries"] == 3        # 默认 3
+        assert kw["app_retry_delay"] == 5    # 默认 5
+
+    def test_anthropic_and_google_do_not_zero_max_retries(self):
+        # 针对 PR #100 review 回归防护：只有走 OpenAIClient 的 provider 才会
+        # 关闭 SDK 重试并注入应用层退避参数。Anthropic / Google 等原生 SDK 具有
+        # 自己的重试逻辑，不能注入 max_retries=0 破坏其弹性，也不能注入未使用的 app_retries。
+        for provider in ("anthropic", "google", "azure", "claude_agent_sdk"):
+            g = _graph_with({"llm_provider": provider, "llm_timeout": 120})
+            kw = g._get_provider_kwargs()
+            assert kw.get("timeout") == 120
+            assert "max_retries" not in kw
+            assert "app_retries" not in kw
+            assert "app_retry_delay" not in kw
+
+
+@pytest.mark.unit
+class TestRetryParamsReachClient:
+    def test_retry_params_reach_chatopenai(self, monkeypatch):
+        monkeypatch.setenv("OPENAI_COMPATIBLE_API_KEY", "k")
+        client = OpenAIClient(
+            "m", base_url="https://relay.example/v1", provider="openai_compatible",
+            timeout=120, max_retries=0, app_retries=2, app_retry_delay=5,
+        )
+        llm = client.get_llm()
+        assert llm.request_timeout == 120.0   # langchain 内部字段名
+        assert llm.max_retries == 0           # SDK 层不重试
+        assert llm.app_retries == 2
+        assert llm.app_retry_delay == 5.0
+
+
+@pytest.mark.unit
+class TestAppLayerRetry:
+    def test_retries_on_5xx_then_succeeds(self, monkeypatch):
+        from langchain_openai import ChatOpenAI
+
+        calls = {"n": 0}
+
+        def fake_invoke(self, input, config=None, **kw):
+            calls["n"] += 1
+            if calls["n"] <= 2:
+                raise _server_error()
+            return Mock(content="ok")
+
+        monkeypatch.setattr(ChatOpenAI, "invoke", fake_invoke)
+        monkeypatch.setattr(
+            "tradingagents.llm_clients.openai_client.normalize_content", lambda r: "normalized"
+        )
+        monkeypatch.setattr(
+            "tradingagents.llm_clients.openai_client.warn_if_truncated", lambda *a, **k: None
+        )
+        monkeypatch.setattr(_time, "sleep", lambda s: None)
+
+        llm = NormalizedChatOpenAI(model="m", api_key="k", app_retries=2, app_retry_delay=5)
+        assert llm.invoke("hi") == "normalized"
+        assert calls["n"] == 3               # 2 次 5xx + 1 次成功
+
+    def test_raises_after_retries_exhausted(self, monkeypatch):
+        from langchain_openai import ChatOpenAI
+
+        def fake_invoke(self, input, config=None, **kw):
+            raise _server_error()
+
+        monkeypatch.setattr(ChatOpenAI, "invoke", fake_invoke)
+        monkeypatch.setattr(_time, "sleep", lambda s: None)
+
+        llm = NormalizedChatOpenAI(model="m", api_key="k", app_retries=2, app_retry_delay=5)
+        with pytest.raises(InternalServerError):
+            llm.invoke("hi")
+
+    def test_exponential_backoff_delays(self, monkeypatch):
+        from langchain_openai import ChatOpenAI
+
+        delays = []
+
+        def fake_invoke(self, input, config=None, **kw):
+            raise _server_error()
+
+        monkeypatch.
```

**File**: `tests/test_openai_compatible_provider.py` (modified, +61/-1)
```diff
@@ -8,7 +8,11 @@
 import pytest
 
 from tradingagents.llm_clients.factory import _OPENAI_COMPATIBLE, create_llm_client
-from tradingagents.llm_clients.openai_client import NormalizedChatOpenAI, OpenAIClient
+from tradingagents.llm_clients.openai_client import (
+    DeepSeekChatOpenAI,
+    NormalizedChatOpenAI,
+    OpenAIClient,
+)
 
 
 @pytest.mark.unit
@@ -86,3 +90,59 @@ def test_role_api_key_absent_falls_back_to_env(self, monkeypatch):
         )
         llm = client.get_llm()
         assert llm.client._client.api_key == "env-key"
+
+
+@pytest.mark.unit
+class TestOpenCodeGoStreaming:
+    def test_opencode_go_deepseek_enables_streaming_and_subclass(self, monkeypatch):
+        monkeypatch.setenv("OPENAI_COMPATIBLE_API_KEY", "k")
+        client = OpenAIClient(
+            "deepseek-v4-pro", base_url="https://opencode.ai/zen/go/v1",
+            provider="openai_compatible",
+        )
+        llm = client.get_llm()
+        assert llm.streaming is True
+        assert isinstance(llm, DeepSeekChatOpenAI)
+
+    def test_non_opencode_base_url_keeps_streaming_off(self, monkeypatch):
+        monkeypatch.setenv("OPENAI_COMPATIBLE_API_KEY", "k")
+        client = OpenAIClient(
+            "deepseek-v4-pro", base_url="https://relay.example/v1",
+            provider="openai_compatible",
+        )
+        llm = client.get_llm()
+        assert llm.streaming is False
+        assert not isinstance(llm, DeepSeekChatOpenAI)
+
+    def test_opencode_go_non_deepseek_model_streams_but_no_subclass(self, monkeypatch):
+        monkeypatch.setenv("OPENAI_COMPATIBLE_API_KEY", "k")
+        client = OpenAIClient(
+            "mimo-v2.5", base_url="https://opencode.ai/zen/go/v1",
+            provider="openai_compatible",
+        )
+        llm = client.get_llm()
+        assert llm.streaming is True
+        assert not isinstance(llm, DeepSeekChatOpenAI)
+
+
+@pytest.mark.unit
+class TestDeepSeekStreamingReasoningCapture:
+    def test_capture_reasoning_content_on_streaming_chunk(self):
+        from langchain_core.messages import AIMessageChunk
+
+        llm = DeepSeekChatOpenAI(model="deepseek-v4-pro", api_key="k")
+        chunk = {
+            "choices": [{"delta": {"reasoning_content": "让我想想", "content": "答案是2"}}]
+        }
+        gen_chunk = llm._convert_chunk_to_generation_chunk(chunk, AIMessageChunk, {})
+        assert gen_chunk is not None
+        assert gen_chunk.message.additional_kwargs.get("reasoning_content") == "让我想想"
+
+    def test_chunk_without_reasoning_is_left_untouched(self):
+        from langchain_core.messages import AIMessageChunk
+
+        llm = DeepSeekChatOpenAI(model="deepseek-v4-pro", api_key="k")
+        chunk = {"choices": [{"delta": {"content": "普通回答"}}]}
+        gen_chunk = llm._convert_chunk_to_generation_chunk(chunk, AIMessageChunk, {})
+        assert gen_chunk is not None
+        assert "reasoning_content" not in gen_chunk.message.additional_kwargs
```

**File**: `tradingagents/default_config.py` (modified, +11/-0)
```diff
@@ -31,6 +31,17 @@
         if os.environ.get("TRADINGAGENTS_MAX_TOKENS")
         else None
     ),
+    # 单次 LLM 请求超时（秒）。None = 用 provider/客户端默认值。设具体值可兜底
+    # 「请求挂起导致静默卡死」——超时后由客户端抛异常，而非进程 alive 但永久无输出。
+    # 经 _get_provider_kwargs → _PASSTHROUGH_KWARGS 透传给 openai / anthropic 系客户端；
+    # claude_agent_sdk 的 AgentSDKChatModel 不走该链路，暂不受此超时保护（已知缺口）。
+    "llm_timeout": 150,
+    # 5xx（502/503 等）及读超时后的应用层重试次数。SDK 层恒 0 重试（仅限 OpenAI 兼容客户端，见 _get_provider_kwargs），
+    # 由 openai_client.invoke 按下面的固定冷静期退避重试，而非 SDK 的 0.5s 指数退避。
+    "llm_max_retries": 3,
+    # 5xx 重试的初始退避（秒），指数翻倍：第 1 次重试等 5s、第 2 次 10s、第 3 次 20s...
+    # 避免对刚报错的上游立即重试造成雪崩，也避免固定间隔在持续故障时反复撞击。
+    "llm_retry_delay": 5,
     # 可选：给单个角色单独指定模型（#39）。留空 = 全部角色沿用上面的
     # quick/deep 两档，行为与以前完全一致——大多数人只有一家模型，不需要碰这里。
     #
```

**File**: `tradingagents/graph/trading_graph.py` (modified, +18/-0)
```diff
@@ -59,6 +59,7 @@
 from .propagation import Propagator
 from .reflection import Reflector
 from .signal_processing import SignalProcessor
+from ..llm_clients.factory import _OPENAI_COMPATIBLE
 
 # 七个分析师角色——它们受 `selected_analysts` 控制，没选中就不会进图。
 _ANALYST_ROLES = frozenset({
@@ -70,6 +71,9 @@
     "reasoning_effort",   # openai
     "thinking_level",     # google
     "effort",             # anthropic
+    "max_retries",        # 仅 openai_compatible 设为 0；换 provider 时沿用 SDK 默认
+    "app_retries",        # 仅 openai_client 读取
+    "app_retry_delay",    # 仅 openai_client 读取
 })
 
 
@@ -423,6 +427,20 @@ def _get_provider_kwargs(self) -> Dict[str, Any]:
         if max_tokens:
             kwargs["max_tokens"] = max_tokens
 
+        # 项目级 LLM 请求超时/重试（#300705 静默卡死兜底）：单次请求挂起时
+        # 由 timeout 兜底，避免风险辩论节点永久卡住（进程 alive 但无输出）。
+        timeout = self.config.get("llm_timeout")
+        if timeout is not None:
+            kwargs["timeout"] = timeout
+        # 应用层重试机制仅在 NormalizedChatOpenAI (OpenAIClient) 中实现。
+        # 仅对走 OpenAIClient 的 provider 关 SDK 重试（恒 0）并注入应用层退避重试参数；
+        # 其余 provider（anthropic / google 等）沿用各家 SDK 原生重试，不碰 max_retries，
+        # 避免 Claude 直连与 Gemini 用户的 SDK 重试被静默关掉（PR #100 review）。
+        if provider in _OPENAI_COMPATIBLE:
+            kwargs["max_retries"] = 0
+            kwargs["app_retries"] = self.config.get("llm_max_retries", 3)
+            kwargs["app_retry_delay"] = self.config.get("llm_retry_delay", 5)
+
         if provider == "google":
             thinking_level = self.config.get("google_thinking_level")
             if thinking_level:
```

**File**: `tradingagents/llm_clients/openai_client.py` (modified, +69/-4)
```diff
@@ -1,9 +1,11 @@
 import logging
 import os
+import time
 from typing import Any, Optional
 
 from langchain_core.messages import AIMessage
 from langchain_openai import ChatOpenAI
+from openai import InternalServerError, APITimeoutError
 
 from .base_client import BaseLLMClient, normalize_content, warn_if_truncated
 from .capabilities import get_capabilities
@@ -27,10 +29,37 @@ class NormalizedChatOpenAI(ChatOpenAI):
     purpose-built subclasses below so this base class stays small.
     """
 
+    # 应用层重试参数（由 get_llm 从配置注入；SDK 层 max_retries 恒 0）。
+    app_retries: int = 0
+    app_retry_delay: float = 5.0   # 初始退避（秒），指数翻倍：5s, 10s, 20s...
+
     def invoke(self, input, config=None, **kwargs):
-        response = super().invoke(input, config, **kwargs)
-        warn_if_truncated(response, self.model_name)
-        return normalize_content(response)
+        # 应用层重试：SDK 层 max_retries 恒 0（见 _get_provider_kwargs），5xx 与
+        # 超时（APITimeoutError）会直接抛到这里，由本层按指数退避重试（5s, 10s,
+        # 20s...），而非 SDK 的 0.5s。超时单独捕获是因为 reasoning 模型（如
+        # minimax-m3）在复杂 prompt 下会间歇性读超时，重试一次大概率能救回。
+        for attempt in range(self.app_retries + 1):
+            try:
+                response = super().invoke(input, config, **kwargs)
+                warn_if_truncated(response, self.model_name)
+                return normalize_content(response)
+            except (InternalServerError, APITimeoutError) as exc:
+                if attempt >= self.app_retries:
+                    raise
+                # 指数退避：app_retry_delay * 2^attempt（5s, 10s, 20s...）。
+                delay = self.app_retry_delay * (2 ** attempt)
+                if isinstance(exc, InternalServerError):
+                    logger.warning(
+                        "LLM 5xx（HTTP %s）请求失败，%s 秒后重试（%d/%d）",
+                        exc.status_code, delay, attempt + 1, self.app_retries,
+                    )
+                else:
+                    logger.warning(
+                        "LLM 请求超时（%s），%s 秒后重试（%d/%d）",
+                        type(exc).__name__, delay, attempt + 1, self.app_retries,
+                    )
+                time.sleep(delay)
+        return None  # pragma: no cover - 循环必 raise 或 return
 
     def with_structured_output(self, schema, *, method=None, **kwargs):
         capabilities = get_capabilities(self.model_name)
@@ -117,6 +146,26 @@ def _create_chat_result(self, response, generation_info=None):
                 generation.message.additional_kwargs["reasoning_content"] = reasoning
         return chat_result
 
+    def _convert_chunk_to_generation_chunk(
+        self, chunk, default_chunk_class, base_generation_info
+    ):
+        # langchain-openai's streaming path drops ``reasoning_content`` from
+        # deltas. Rescue it into ``additional_kwargs`` so the round-trip on
+        # the next turn — see ``_get_request_payload`` — still has it. Chunk
+        # aggregation in langchain-core concatenates string additional_kwargs,
+        # yielding the complete reasoning_content on the final AIMessage.
+        gen_chunk = super()._convert_chunk_to_generation_chunk(
+            chunk, default_chunk_class, base_generation_info
+        )
+        if gen_chunk is None:
+            return None
+        choices = chunk.get("choices") or chunk.get("chunk", {}).get("choices") or []
+        if choices:
+            reasoning = (choices[0].get("delta") or {}).get("reasoning_content")
+            if reasoning:
+                gen_chunk.message.additional_kwargs["reasoning_content"] = reasoning
+        return gen_chunk
+
 class MinimaxChatOpenAI(NormalizedChatOpenAI):
     """MiniMax M2.x adapter.
 
@@ -242,14 +291,30 @@ def get_llm(self) -> Any:
             if cap.default_max_tokens is not None:
                 llm_kwargs["max_tokens"] = cap.default_max_tokens
 
+        # 应用层重试参数（不进 _PASSTHROUGH_KWARGS，但需传给 NormalizedChatOpenAI）。
+        llm_kwargs["app_retries"] = self.kwargs.get("app_retries", 0)
+        llm_kwargs["app_retry_delay"] = self.kwargs.get("app_retry_delay", 5.0)
+
         # Native OpenAI: use Responses API for consistent behavior across
         # all model families. Third-party providers use Chat Completions.
         if self.provider == "openai":
             llm_kwargs["use_responses_api"] = True
 
+        # The OpenCode Go gateway (opencode.ai) drops the connection on long
+        # non-streamed responses (~3 min idle timeout, #782/#1204). Streaming
+        # keeps the socket active; langchain aggregates chunks back to a single
+        # AIMessage so callers see no difference.
+        base_url_for_check = llm_kwargs.get("base_url", "") or ""
+        is_opencode_go = "opencode.ai" in base_url_for_check
+        if is_opencode_go:
+            llm_kwargs.setdefault("streaming", True)
+
         # DeepSeek's thinking-mode quirks live in their own subclass so the
         # base NormalizedChatOpenAI stays free of provider-specific branches.
-        if self.provider == "deepseek":
+        #
```

---

### Incident Patch 4: `9782a1f5` (2026-08-17)
**Commit Message**: fix(llm): prevent hangs via timeout retry and streaming keep-alive

DeepSeek V4 thinking models emit long reasoning chains that can trip the
OpenCode Go gateway's ~3min idle timeout (TauricResearch/TradingAgents#1204),
leaving the process hung. Combined with transient 5xx / read-timeouts from
unstable LLM backends, a single node failure aborts the whole run.

- forward llm_timeout so a hung request can't stall the graph silently
- retry 5xx AND read-timeouts at the app layer with exponential backoff
  (previously only 5xx was retried; a read-timeout crashed the graph)
- raise llm_timeout 120->150 and llm_max_retries 2->3
- enable streaming on opencode-go to keep the socket alive past the idle timeout
- capture reasoning_content on the streaming path so the DeepSeek round-trip
  on the next turn doesn't fail

**File**: `tests/test_llm_timeout.py` (added, +183/-0)
```diff
@@ -0,0 +1,183 @@
+"""llm_timeout / llm_max_retries / llm_retry_delay 透传与应用层重试回归测试。
+
+风险辩论节点内同步 llm.invoke() 曾缺少超时保护：provider 请求挂起时节点永不返回，
+进程 alive 但静默卡死。补丁分两层：
+- SDK 层：timeout 兜底挂起，max_retries 恒 0（重试交给应用层）。
+- 应用层：openai_client.invoke 捕获 5xx，按指数退避重试（5s, 10s, 20s...）。
+"""
+
+import time as _time
+from unittest.mock import Mock
+
+import pytest
+from openai import InternalServerError, APITimeoutError
+
+from tradingagents.default_config import DEFAULT_CONFIG
+from tradingagents.graph import trading_graph as tg
+from tradingagents.llm_clients.openai_client import NormalizedChatOpenAI, OpenAIClient
+
+
+def _graph_with(config):
+    graph = tg.TradingAgentsGraph.__new__(tg.TradingAgentsGraph)
+    graph.config = config
+    return graph
+
+
+def _server_error(status=503):
+    return InternalServerError(f"{status}", response=Mock(status_code=status), body=None)
+
+
+def _timeout_error():
+    return APITimeoutError(request=Mock())
+
+
+@pytest.mark.unit
+class TestProviderKwargs:
+    def test_timeout_forwarded_and_sdk_retries_zeroed(self):
+        g = _graph_with({"llm_provider": "openai", "llm_timeout": 120, "llm_max_retries": 2, "llm_retry_delay": 5})
+        kw = g._get_provider_kwargs()
+        assert kw["timeout"] == 120
+        assert kw["max_retries"] == 0        # SDK 层恒 0，重试交给应用层
+        assert kw["app_retries"] == 2        # 应用层重试次数
+        assert kw["app_retry_delay"] == 5    # 初始退避（秒）
+
+    def test_app_retries_zero_is_not_dropped(self):
+        # app_retries=0（不重试）是合法值，不能因为 falsy 被默认值覆盖。
+        g = _graph_with({"llm_provider": "openai", "llm_max_retries": 0})
+        assert g._get_provider_kwargs()["app_retries"] == 0
+
+    def test_defaults_when_keys_absent(self):
+        g = _graph_with({"llm_provider": "openai"})
+        kw = g._get_provider_kwargs()
+        assert kw["max_retries"] == 0        # 恒 0
+        assert kw["app_retries"] == 3        # 默认 3
+        assert kw["app_retry_delay"] == 5    # 默认 5
+
+    def test_anthropic_and_google_do_not_zero_max_retries(self):
+        # 针对 PR #100 review 回归防护：只有走 OpenAIClient 的 provider 才会
+        # 关闭 SDK 重试并注入应用层退避参数。Anthropic / Google 等原生 SDK 具有
+        # 自己的重试逻辑，不能注入 max_retries=0 破坏其弹性，也不能注入未使用的 app_retries。
+        for provider in ("anthropic", "google", "azure", "claude_agent_sdk"):
+            g = _graph_with({"llm_provider": provider, "llm_timeout": 120})
+            kw = g._get_provider_kwargs()
+            assert kw.get("timeout") == 120
+            assert "max_retries" not in kw
+            assert "app_retries" not in kw
+            assert "app_retry_delay" not in kw
+
+
+@pytest.mark.unit
+class TestRetryParamsReachClient:
+    def test_retry_params_reach_chatopenai(self, monkeypatch):
+        monkeypatch.setenv("OPENAI_COMPATIBLE_API_KEY", "k")
+        client = OpenAIClient(
+            "m", base_url="https://relay.example/v1", provider="openai_compatible",
+            timeout=120, max_retries=0, app_retries=2, app_retry_delay=5,
+        )
+        llm = client.get_llm()
+        assert llm.request_timeout == 120.0   # langchain 内部字段名
+        assert llm.max_retries == 0           # SDK 层不重试
+        assert llm.app_retries == 2
+        assert llm.app_retry_delay == 5.0
+
+
+@pytest.mark.unit
+class TestAppLayerRetry:
+    def test_retries_on_5xx_then_succeeds(self, monkeypatch):
+        from langchain_openai import ChatOpenAI
+
+        calls = {"n": 0}
+
+        def fake_invoke(self, input, config=None, **kw):
+            calls["n"] += 1
+            if calls["n"] <= 2:
+                raise _server_error()
+            return Mock(content="ok")
+
+        monkeypatch.setattr(ChatOpenAI, "invoke", fake_invoke)
+        monkeypatch.setattr(
+            "tradingagents.llm_clients.openai_client.normalize_content", lambda r: "normalized"
+        )
+        monkeypatch.setattr(
+            "tradingagents.llm_clients.openai_client.warn_if_truncated", lambda *a, **k: None
+        )
+        monkeypatch.setattr(_time, "sleep", lambda s: None)
+
+        llm = NormalizedChatOpenAI(model="m", api_key="k", app_retries=2, app_retry_delay=5)
+        assert llm.invoke("hi") == "normalized"
+        assert calls["n"] == 3               # 2 次 5xx + 1 次成功
+
+    def test_raises_after_retries_exhausted(self, monkeypatch):
+        from langchain_openai import ChatOpenAI
+
+        def fake_invoke(self, input, config=None, **kw):
+            raise _server_error()
+
+        monkeypatch.setattr(ChatOpenAI, "invoke", fake_invoke)
+        monkeypatch.setattr(_time, "sleep", lambda s: None)
+
+        llm = NormalizedChatOpenAI(model="m", api_key="k", app_retries=2, app_retry_delay=5)
+        with pytest.raises(InternalServerError):
+            llm.invoke("hi")
+
+    def test_exponential_backoff_delays(self, monkeypatch):
+        from langchain_openai import ChatOpenAI
+
+        delays = []
+
+        def fake_invoke(self, input, config=None, **kw):
+            raise _server_error()
+
+        monkeypatch.
```

**File**: `tests/test_openai_compatible_provider.py` (modified, +61/-1)
```diff
@@ -8,7 +8,11 @@
 import pytest
 
 from tradingagents.llm_clients.factory import _OPENAI_COMPATIBLE, create_llm_client
-from tradingagents.llm_clients.openai_client import NormalizedChatOpenAI, OpenAIClient
+from tradingagents.llm_clients.openai_client import (
+    DeepSeekChatOpenAI,
+    NormalizedChatOpenAI,
+    OpenAIClient,
+)
 
 
 @pytest.mark.unit
@@ -86,3 +90,59 @@ def test_role_api_key_absent_falls_back_to_env(self, monkeypatch):
         )
         llm = client.get_llm()
         assert llm.client._client.api_key == "env-key"
+
+
+@pytest.mark.unit
+class TestOpenCodeGoStreaming:
+    def test_opencode_go_deepseek_enables_streaming_and_subclass(self, monkeypatch):
+        monkeypatch.setenv("OPENAI_COMPATIBLE_API_KEY", "k")
+        client = OpenAIClient(
+            "deepseek-v4-pro", base_url="https://opencode.ai/zen/go/v1",
+            provider="openai_compatible",
+        )
+        llm = client.get_llm()
+        assert llm.streaming is True
+        assert isinstance(llm, DeepSeekChatOpenAI)
+
+    def test_non_opencode_base_url_keeps_streaming_off(self, monkeypatch):
+        monkeypatch.setenv("OPENAI_COMPATIBLE_API_KEY", "k")
+        client = OpenAIClient(
+            "deepseek-v4-pro", base_url="https://relay.example/v1",
+            provider="openai_compatible",
+        )
+        llm = client.get_llm()
+        assert llm.streaming is False
+        assert not isinstance(llm, DeepSeekChatOpenAI)
+
+    def test_opencode_go_non_deepseek_model_streams_but_no_subclass(self, monkeypatch):
+        monkeypatch.setenv("OPENAI_COMPATIBLE_API_KEY", "k")
+        client = OpenAIClient(
+            "mimo-v2.5", base_url="https://opencode.ai/zen/go/v1",
+            provider="openai_compatible",
+        )
+        llm = client.get_llm()
+        assert llm.streaming is True
+        assert not isinstance(llm, DeepSeekChatOpenAI)
+
+
+@pytest.mark.unit
+class TestDeepSeekStreamingReasoningCapture:
+    def test_capture_reasoning_content_on_streaming_chunk(self):
+        from langchain_core.messages import AIMessageChunk
+
+        llm = DeepSeekChatOpenAI(model="deepseek-v4-pro", api_key="k")
+        chunk = {
+            "choices": [{"delta": {"reasoning_content": "让我想想", "content": "答案是2"}}]
+        }
+        gen_chunk = llm._convert_chunk_to_generation_chunk(chunk, AIMessageChunk, {})
+        assert gen_chunk is not None
+        assert gen_chunk.message.additional_kwargs.get("reasoning_content") == "让我想想"
+
+    def test_chunk_without_reasoning_is_left_untouched(self):
+        from langchain_core.messages import AIMessageChunk
+
+        llm = DeepSeekChatOpenAI(model="deepseek-v4-pro", api_key="k")
+        chunk = {"choices": [{"delta": {"content": "普通回答"}}]}
+        gen_chunk = llm._convert_chunk_to_generation_chunk(chunk, AIMessageChunk, {})
+        assert gen_chunk is not None
+        assert "reasoning_content" not in gen_chunk.message.additional_kwargs
```

**File**: `tradingagents/default_config.py` (modified, +11/-0)
```diff
@@ -31,6 +31,17 @@
         if os.environ.get("TRADINGAGENTS_MAX_TOKENS")
         else None
     ),
+    # 单次 LLM 请求超时（秒）。None = 用 provider/客户端默认值。设具体值可兜底
+    # 「请求挂起导致静默卡死」——超时后由客户端抛异常，而非进程 alive 但永久无输出。
+    # 经 _get_provider_kwargs → _PASSTHROUGH_KWARGS 透传给 openai / anthropic 系客户端；
+    # claude_agent_sdk 的 AgentSDKChatModel 不走该链路，暂不受此超时保护（已知缺口）。
+    "llm_timeout": 150,
+    # 5xx（502/503 等）及读超时后的应用层重试次数。SDK 层恒 0 重试（仅限 OpenAI 兼容客户端，见 _get_provider_kwargs），
+    # 由 openai_client.invoke 按下面的固定冷静期退避重试，而非 SDK 的 0.5s 指数退避。
+    "llm_max_retries": 3,
+    # 5xx 重试的初始退避（秒），指数翻倍：第 1 次重试等 5s、第 2 次 10s、第 3 次 20s...
+    # 避免对刚报错的上游立即重试造成雪崩，也避免固定间隔在持续故障时反复撞击。
+    "llm_retry_delay": 5,
     # 可选：给单个角色单独指定模型（#39）。留空 = 全部角色沿用上面的
     # quick/deep 两档，行为与以前完全一致——大多数人只有一家模型，不需要碰这里。
     #
```

**File**: `tradingagents/graph/trading_graph.py` (modified, +18/-0)
```diff
@@ -59,6 +59,7 @@
 from .propagation import Propagator
 from .reflection import Reflector
 from .signal_processing import SignalProcessor
+from ..llm_clients.factory import _OPENAI_COMPATIBLE
 
 # 七个分析师角色——它们受 `selected_analysts` 控制，没选中就不会进图。
 _ANALYST_ROLES = frozenset({
@@ -70,6 +71,9 @@
     "reasoning_effort",   # openai
     "thinking_level",     # google
     "effort",             # anthropic
+    "max_retries",        # 仅 openai_compatible 设为 0；换 provider 时沿用 SDK 默认
+    "app_retries",        # 仅 openai_client 读取
+    "app_retry_delay",    # 仅 openai_client 读取
 })
 
 
@@ -423,6 +427,20 @@ def _get_provider_kwargs(self) -> Dict[str, Any]:
         if max_tokens:
             kwargs["max_tokens"] = max_tokens
 
+        # 项目级 LLM 请求超时/重试（#300705 静默卡死兜底）：单次请求挂起时
+        # 由 timeout 兜底，避免风险辩论节点永久卡住（进程 alive 但无输出）。
+        timeout = self.config.get("llm_timeout")
+        if timeout is not None:
+            kwargs["timeout"] = timeout
+        # 应用层重试机制仅在 NormalizedChatOpenAI (OpenAIClient) 中实现。
+        # 仅对走 OpenAIClient 的 provider 关 SDK 重试（恒 0）并注入应用层退避重试参数；
+        # 其余 provider（anthropic / google 等）沿用各家 SDK 原生重试，不碰 max_retries，
+        # 避免 Claude 直连与 Gemini 用户的 SDK 重试被静默关掉（PR #100 review）。
+        if provider in _OPENAI_COMPATIBLE:
+            kwargs["max_retries"] = 0
+            kwargs["app_retries"] = self.config.get("llm_max_retries", 3)
+            kwargs["app_retry_delay"] = self.config.get("llm_retry_delay", 5)
+
         if provider == "google":
             thinking_level = self.config.get("google_thinking_level")
             if thinking_level:
```

**File**: `tradingagents/llm_clients/openai_client.py` (modified, +69/-4)
```diff
@@ -1,9 +1,11 @@
 import logging
 import os
+import time
 from typing import Any, Optional
 
 from langchain_core.messages import AIMessage
 from langchain_openai import ChatOpenAI
+from openai import InternalServerError, APITimeoutError
 
 from .base_client import BaseLLMClient, normalize_content, warn_if_truncated
 from .capabilities import get_capabilities
@@ -27,10 +29,37 @@ class NormalizedChatOpenAI(ChatOpenAI):
     purpose-built subclasses below so this base class stays small.
     """
 
+    # 应用层重试参数（由 get_llm 从配置注入；SDK 层 max_retries 恒 0）。
+    app_retries: int = 0
+    app_retry_delay: float = 5.0   # 初始退避（秒），指数翻倍：5s, 10s, 20s...
+
     def invoke(self, input, config=None, **kwargs):
-        response = super().invoke(input, config, **kwargs)
-        warn_if_truncated(response, self.model_name)
-        return normalize_content(response)
+        # 应用层重试：SDK 层 max_retries 恒 0（见 _get_provider_kwargs），5xx 与
+        # 超时（APITimeoutError）会直接抛到这里，由本层按指数退避重试（5s, 10s,
+        # 20s...），而非 SDK 的 0.5s。超时单独捕获是因为 reasoning 模型（如
+        # minimax-m3）在复杂 prompt 下会间歇性读超时，重试一次大概率能救回。
+        for attempt in range(self.app_retries + 1):
+            try:
+                response = super().invoke(input, config, **kwargs)
+                warn_if_truncated(response, self.model_name)
+                return normalize_content(response)
+            except (InternalServerError, APITimeoutError) as exc:
+                if attempt >= self.app_retries:
+                    raise
+                # 指数退避：app_retry_delay * 2^attempt（5s, 10s, 20s...）。
+                delay = self.app_retry_delay * (2 ** attempt)
+                if isinstance(exc, InternalServerError):
+                    logger.warning(
+                        "LLM 5xx（HTTP %s）请求失败，%s 秒后重试（%d/%d）",
+                        exc.status_code, delay, attempt + 1, self.app_retries,
+                    )
+                else:
+                    logger.warning(
+                        "LLM 请求超时（%s），%s 秒后重试（%d/%d）",
+                        type(exc).__name__, delay, attempt + 1, self.app_retries,
+                    )
+                time.sleep(delay)
+        return None  # pragma: no cover - 循环必 raise 或 return
 
     def with_structured_output(self, schema, *, method=None, **kwargs):
         capabilities = get_capabilities(self.model_name)
@@ -117,6 +146,26 @@ def _create_chat_result(self, response, generation_info=None):
                 generation.message.additional_kwargs["reasoning_content"] = reasoning
         return chat_result
 
+    def _convert_chunk_to_generation_chunk(
+        self, chunk, default_chunk_class, base_generation_info
+    ):
+        # langchain-openai's streaming path drops ``reasoning_content`` from
+        # deltas. Rescue it into ``additional_kwargs`` so the round-trip on
+        # the next turn — see ``_get_request_payload`` — still has it. Chunk
+        # aggregation in langchain-core concatenates string additional_kwargs,
+        # yielding the complete reasoning_content on the final AIMessage.
+        gen_chunk = super()._convert_chunk_to_generation_chunk(
+            chunk, default_chunk_class, base_generation_info
+        )
+        if gen_chunk is None:
+            return None
+        choices = chunk.get("choices") or chunk.get("chunk", {}).get("choices") or []
+        if choices:
+            reasoning = (choices[0].get("delta") or {}).get("reasoning_content")
+            if reasoning:
+                gen_chunk.message.additional_kwargs["reasoning_content"] = reasoning
+        return gen_chunk
+
 class MinimaxChatOpenAI(NormalizedChatOpenAI):
     """MiniMax M2.x adapter.
 
@@ -242,14 +291,30 @@ def get_llm(self) -> Any:
             if cap.default_max_tokens is not None:
                 llm_kwargs["max_tokens"] = cap.default_max_tokens
 
+        # 应用层重试参数（不进 _PASSTHROUGH_KWARGS，但需传给 NormalizedChatOpenAI）。
+        llm_kwargs["app_retries"] = self.kwargs.get("app_retries", 0)
+        llm_kwargs["app_retry_delay"] = self.kwargs.get("app_retry_delay", 5.0)
+
         # Native OpenAI: use Responses API for consistent behavior across
         # all model families. Third-party providers use Chat Completions.
         if self.provider == "openai":
             llm_kwargs["use_responses_api"] = True
 
+        # The OpenCode Go gateway (opencode.ai) drops the connection on long
+        # non-streamed responses (~3 min idle timeout, #782/#1204). Streaming
+        # keeps the socket active; langchain aggregates chunks back to a single
+        # AIMessage so callers see no difference.
+        base_url_for_check = llm_kwargs.get("base_url", "") or ""
+        is_opencode_go = "opencode.ai" in base_url_for_check
+        if is_opencode_go:
+            llm_kwargs.setdefault("streaming", True)
+
         # DeepSeek's thinking-mode quirks live in their own subclass so the
         # base NormalizedChatOpenAI stays free of provider-specific branches.
-        if self.provider == "deepseek":
+        #
```

---

### Incident Patch 5: `922db59a` (2026-09-20)
**Commit Message**: fix(llm): CLI 与客户端兜底连到不同站点（#113）

同一批 provider 的 base URL 写在两处，v0.2.4 引入时就没对齐：

  provider   CLI(cli/utils.py)              客户端兜底(openai_client.py)
  glm        open.bigmodel.cn（国内）        api.z.ai（海外）
  qwen       dashscope.aliyuncs.com（国内）  dashscope-intl（国际）

两站都能用同一个 key 且返回同一份模型列表，所以不报错——只是从 CLI 跑走国内站、
从 Web 跑走海外站（侧栏 Base URL 默认留空时用兜底值），报告里也看不出来。
其余 provider（xai / deepseek / openrouter / ollama）两处一直是一致的。

统一到国内站，判据：这是 A 股特化 fork，README 中英文都让用户去
open.bigmodel.cn 申请 key，用户主体在国内。海外用户不受影响——国内站同样可用，
需要指定端点可用 backend_url / 侧栏 Base URL 显式覆盖。

新增 tests/test_provider_endpoint_consistency.py 钉住两处一致，以及 glm/qwen
不得回到海外站——此前这两个值零测试覆盖，所以分裂了三个版本没人发现。
比对范围用显式的 _MUST_AGREE 集合并断言「恰好相等」：只断言交集非空的话，
某一侧漏写一个 provider 会让它悄悄退出比对而测试照样绿，那正是要防的失效模式。

issue 由 @FelixWang119 提出，含精确行号与两站实测对比。

**File**: `tests/test_provider_endpoint_consistency.py` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+"""CLI 与客户端兜底必须指向同一个 provider 端点（#113）。
+
+同一批 provider 的 base URL 写在两处：`cli/utils.py` 的 `select_llm_provider()`
+里给 CLI 用，`llm_clients/openai_client.py` 的 `_PROVIDER_CONFIG` 给客户端兜底
+（Web 侧栏 Base URL 留空时生效）。v0.2.4 引入时两处就没对齐：glm 一边
+`open.bigmodel.cn`（国内站）一边 `api.z.ai`（海外站），qwen 一边
+`dashscope.aliyuncs.com` 一边 `dashscope-intl`。两站都能用同一个 key 且返回同一份
+模型列表，所以**不报错**，只是从 CLI 跑和从 Web 跑会静默走不同网络路径。
+
+这条测试钉住「两处对同一个 provider 必须给同一个值」，防止再分裂一次。
+CLI 的列表是 `select_llm_provider()` 的局部变量，所以照 test_sentiment_data_tools
+的做法扫源码而不是 import。
+"""
+
+import inspect
+import re
+
+from cli.utils import select_llm_provider
+from tradingagents.llm_clients.openai_client import _PROVIDER_CONFIG
+
+
+def _cli_endpoints() -> dict[str, str]:
+    """从 select_llm_provider 源码里抽出 {provider_key: base_url}，跳过 base_url 为 None 的。"""
+    src = inspect.getsource(select_llm_provider)
+    return {
+        key: url
+        for key, url in re.findall(r'\(\s*"[^"]+"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)', src)
+    }
+
+
+# 两侧都带 base URL、因而必须逐字一致的 provider。
+# 不含 minimax（只有客户端兜底有，CLI 的 provider 列表里没有这一项），
+# 也不含 azure / google / openai_compatible（CLI 侧 base_url 为 None，运行时再问）。
+_MUST_AGREE = {"deepseek", "glm", "ollama", "openrouter", "qwen", "xai"}
+
+
+def test_cli_and_client_fallback_agree_on_endpoints():
+    """两处都定义了的 provider，base URL 必须逐字相同。"""
+    cli = _cli_endpoints()
+    assert cli, "没从 select_llm_provider 里解析出任何 provider，正则或源码结构变了"
+
+    shared = sorted(set(cli) & set(_PROVIDER_CONFIG))
+    # 这里必须是**恰好相等**而不是「非空」：只断言非空的话，某一侧少写了一个
+    # provider（或正则漏解析了一行）会让它悄悄退出比对范围，测试照样绿——
+    # 那正是这条测试要防的失效模式。少了就说明两侧的 provider 名单开始分家，
+    # 新增 provider 时请同步更新 _MUST_AGREE。
+    assert set(shared) == _MUST_AGREE, (
+        f"应当逐字比对的 provider 集合变了：实际 {sorted(shared)}，预期 {sorted(_MUST_AGREE)}。"
+        "若是有意增删 provider，请同步改 _MUST_AGREE；否则是某一侧漏写或解析失效。"
+    )
+
+    mismatches = {
+        key: (cli[key], _PROVIDER_CONFIG[key][0])
+        for key in shared
+        if cli[key] != _PROVIDER_CONFIG[key][0]
+    }
+    assert not mismatches, (
+        "CLI 与客户端兜底对同一 provider 给了不同端点，用户换个入口就换站点：\n"
+        + "\n".join(f"  {k}: CLI={v[0]!r} 兜底={v[1]!r}" for k, v in mismatches.items())
+    )
+
+
+def test_domestic_providers_point_to_domestic_sites():
+    """glm / qwen 面向国内用户，兜底端点不能是海外站（#113 的具体取向）。
+
+    这是 A 股特化 fork，README 中英文都让用户去 open.bigmodel.cn 申请 key。
+    要改成面向海外，需同时改 CLI、兜底、README 三处并在 CHANGELOG 标 breaking。
+    """
+    overseas = {
+        "glm": "api.z.ai",
+        "qwen": "dashscope-intl",
+    }
+    for provider, marker in overseas.items():
+        url = _PROVIDER_CONFIG[provider][0]
+        assert marker not in url, (
+            f"{provider} 的兜底端点回到了海外站 {url}；"
+            f"若确要切换，请同时改 cli/utils.py 与 README 并标 breaking"
+        )
```

**File**: `tradingagents/llm_clients/openai_client.py` (modified, +2/-2)
```diff
@@ -142,8 +142,8 @@ def _get_request_payload(self, input_, *, stop=None, **kwargs):
 _PROVIDER_CONFIG = {
     "xai": ("https://api.x.ai/v1", "XAI_API_KEY"),
     "deepseek": ("https://api.deepseek.com", "DEEPSEEK_API_KEY"),
-    "qwen": ("https://dashscope-intl.aliyuncs.com/compatible-mode/v1", "DASHSCOPE_API_KEY"),
-    "glm": ("https://api.z.ai/api/paas/v4/", "ZHIPU_API_KEY"),
+    "qwen": ("https://dashscope.aliyuncs.com/compatible-mode/v1", "DASHSCOPE_API_KEY"),
+    "glm": ("https://open.bigmodel.cn/api/paas/v4/", "ZHIPU_API_KEY"),
     "openrouter": ("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY"),
     "ollama": ("http://localhost:11434/v1", None),
     "minimax": ("https://api.minimax.chat/v1", "MINIMAX_API_KEY"),
```

---

### Incident Patch 6: `a13f336e` (2026-09-16)
**Commit Message**: fix(a_stock): 概念板块把百度风控 403 谎报成「该股无概念板块」

百度 PAE `getrelatedblock` 被风控时返回 HTTP 403 +：

    {"ResultCode": 0(整数), "Result": {"code": 403, "isCaptchaEnabled": true,
                                       "msg": "hit risk"}}

外层 `ResultCode` 是**整数** 0，而代码里是 `str(d.get("ResultCode", -1)) != "0"`，
整数 0 正好通过检查，随后 `result.get(code, [])` 取空，落到
`return f"No concept/block data for {code}"`。

后果：一次「取数被拦」被当成「该股确实没有概念板块」这个事实喂给模型，
且报告里完全看不出异常。现在单独识别 `Result.code == 403` 并如实报出失败原因。

顺带把手工拼接的 query string 换成 `params=`（原写法把 code 直接插进 URL，
若 code 含需转义字符会拼出坏 URL）。

补充实测：该接口对 python-requests 的 TLS 指纹做风控——同一时刻 curl
（编码 / 不编码均可）与 curl_cffi `impersonate=chrome` 都返回 200，
而 requests 连续 6/6 返回 403。要稳定取数需要浏览器指纹伪装，
这属于是否新增 curl_cffi 直接依赖的决策，本 PR 不擅自引入。

**File**: `tradingagents/dataflows/a_stock.py` (modified, +16/-6)
```diff
@@ -1976,12 +1976,12 @@ def get_concept_blocks(
     code = _normalize_ticker(ticker)
 
     try:
-        url = (
-            "https://finance.pae.baidu.com/api/getrelatedblock"
-            f'?stock=[{{"code":"{code}","market":"ab","type":"stock"}}]'
-            "&finClientType=pc"
-        )
-        r = requests.get(url, headers=_BAIDU_PAE_HEADERS, timeout=10)
+        url = "https://finance.pae.baidu.com/api/getrelatedblock"
+        params = {
+            "stock": f'[{{"code":"{code}","market":"ab","type":"stock"}}]',
+            "finClientType": "pc",
+        }
+        r = requests.get(url, params=params, headers=_BAIDU_PAE_HEADERS, timeout=10)
         d = r.json()
 
         if str(d.get("ResultCode", -1)) != "0":
@@ -1991,6 +1991,16 @@ def get_concept_blocks(
             )
 
         result = d.get("Result", {})
+        # 百度风控会回 HTTP 403 + {"ResultCode": 0(整数), "Result": {"code": 403,
+        # "isCaptchaEnabled": true, "msg": "hit risk"}}。外层 ResultCode 是**整数** 0，
+        # 上面那句 str() 比较放它过关，于是被风控当成"该股没有概念板块"——一个错的事实
+        # 喂给模型。这里必须单独识别，把失败如实报出来。
+        if isinstance(result, dict) and result.get("code") == 403:
+            return (
+                f"Baidu PAE 风控拦截（hit risk），{code} 的概念板块本次取不到。"
+                "该接口会对 python-requests 的 TLS 指纹做风控（同一时刻 curl 正常），"
+                "需 curl_cffi 浏览器指纹伪装才能稳定取数。"
+            )
         categories = result.get(code, [])
         if not categories:
             return f"No concept/block data for {code}"
```

---

### Incident Patch 7: `2444646a` (2026-09-16)
**Commit Message**: fix(a_stock): 同花顺一致预期在 pandas 3.x 下必然取空

`_ths_eps_forecast` 把 HTML 文本直接传给 `pd.read_html`。pandas 3.x 起
`read_html` 的 `io` 参数只接受路径 / URL / 文件对象，字符串会被当作**路径**，
于是必然抛 FileNotFoundError；异常消息里还带着整页 133KB HTML，把日志刷满。

实测 pandas 3.0.5：

    pd.read_html('<table>...</table>')                  -> FileNotFoundError
    pd.read_html(io.StringIO('<table>...</table>'))     -> OK

影响范围：`get_fundamentals` 的一致预期 EPS 段和 `get_profit_forecast` 双双失效。
用 io.StringIO 包装后实测可正常取到 002008 的 2026-2028 三年一致预期（14 家机构）。

pyproject 声明的是 `pandas>=2.3.0`，pandas 3.x 在允许区间内，属于必现回归。

**File**: `tradingagents/dataflows/a_stock.py` (modified, +2/-1)
```diff
@@ -18,6 +18,7 @@
 from datetime import date, datetime, timedelta, timezone
 from dateutil.relativedelta import relativedelta
 import contextlib
+import io
 import json as _json
 import os
 import logging
@@ -611,7 +612,7 @@ def _ths_eps_forecast(code: str) -> pd.DataFrame:
     }
     r = _requests.get(url, headers=headers, timeout=15)
     r.encoding = "gbk"
-    dfs = pd.read_html(r.text)
+    dfs = pd.read_html(io.StringIO(r.text))
     # Find the table containing EPS data
     for df in dfs:
         cols = [str(c) for c in df.columns]
```

---

### Incident Patch 8: `dc737a09` (2026-09-02)
**Commit Message**: fix: 只传部分 config 时 TradingAgentsGraph 直接 KeyError（#101）

README 快速开始的示例只给 4 个键，而 __init__ 里 `config or DEFAULT_CONFIG` 是整体替换，
紧接着 os.makedirs(config["data_cache_dir"]) 就抛 KeyError —— 照 README 粘贴即崩。

- 新增 merge_config()：传入的 config 当覆盖项与 DEFAULT_CONFIG 浅合并，
  与 dataflows 层 set_config() 的合并语义对齐；传完整 config 的用户行为不变
- README 中英文说清 config 是传给 TradingAgentsGraph(config=...) 的字典、不是仓库里的文件，
  以及这段代码放在哪运行
- 根目录 main.py 从上游残留的 NVDA/yfinance 示例改成与 README 一致的 A 股可运行示例
- 新增 tests/test_partial_config.py

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +3/-1)
```diff
@@ -213,7 +213,9 @@ BACKEND_URL=https://your-relay.example/v1   # 你的网关地址（也可在 Web
 
 ### 3. 运行分析
 
-根据你选择的供应商修改 config：
+新建一个 Python 文件（比如项目根目录下的 `run.py`），把下面这段粘进去，按你选的供应商改 `config` 后运行 `uv run python run.py`。根目录自带的 `main.py` 就是这个示例的可运行版本，直接 `uv run python main.py` 也行。
+
+> `config` 不是仓库里的某个配置文件，而是传给 `TradingAgentsGraph(config=...)` 的一个字典：只写你要覆盖的项，其余项自动取 `tradingagents/default_config.py` 里的默认值（完整可选项见下文「配置说明」一节）。
 
 ```python
 from tradingagents.graph.trading_graph import TradingAgentsGraph
```

**File**: `README_en.md` (modified, +3/-1)
```diff
@@ -200,7 +200,9 @@ BACKEND_URL=https://your-relay.example/v1   # Your gateway URL (can also be set
 
 ### 3. Run Analysis
 
-Modify the configuration based on your chosen provider:
+Create a Python file (e.g. `run.py` in the project root), paste the snippet below, adjust `config` for your provider, then run `uv run python run.py`. The bundled `main.py` in the project root is a runnable copy of this example — `uv run python main.py` works too.
+
+> `config` is not a file in the repo. It is a plain dict passed to `TradingAgentsGraph(config=...)`: list only the keys you want to override; everything else falls back to the defaults in `tradingagents/default_config.py` (full option list in the configuration section below).
 
 ```python
 from tradingagents.graph.trading_graph import TradingAgentsGraph
```

**File**: `main.py` (modified, +24/-23)
```diff
@@ -1,31 +1,32 @@
-from tradingagents.graph.trading_graph import TradingAgentsGraph
-from tradingagents.default_config import DEFAULT_CONFIG
+"""最小可运行示例 —— 就是 README「快速开始 · 3. 运行分析」里的那段代码。
 
+`config` 是传给 TradingAgentsGraph 的**覆盖项**字典，不是配置文件：
+只写要改的键，其余取 tradingagents/default_config.py 的默认值（#101）。
+API key 走 .env（见 README 第 2 步）。运行：uv run python main.py
+"""
 from dotenv import load_dotenv
 
-# Load environment variables from .env file
-load_dotenv()
+from tradingagents.graph.trading_graph import TradingAgentsGraph
 
-# Create a custom config
-config = DEFAULT_CONFIG.copy()
-config["deep_think_llm"] = "gpt-5.4-mini"  # Use a different model
-config["quick_think_llm"] = "gpt-5.4-mini"  # Use a different model
-config["max_debate_rounds"] = 1  # Increase debate rounds
+load_dotenv()
 
-# Configure data vendors (default uses yfinance, no extra API keys needed)
-config["data_vendors"] = {
-    "core_stock_apis": "yfinance",           # Options: alpha_vantage, yfinance
-    "technical_indicators": "yfinance",      # Options: alpha_vantage, yfinance
-    "fundamental_data": "yfinance",          # Options: alpha_vantage, yfinance
-    "news_data": "yfinance",                 # Options: alpha_vantage, yfinance
+# ── MiniMax 示例（推荐）─────────────────────────────
+config = {
+    "llm_provider": "minimax",
+    "deep_think_llm": "MiniMax-M2.7",
+    "quick_think_llm": "MiniMax-M2.7-highspeed",
+    "output_language": "Chinese",
 }
 
-# Initialize with custom config
-ta = TradingAgentsGraph(debug=True, config=config)
-
-# forward propagate
-_, decision = ta.propagate("NVDA", "2024-05-10")
-print(decision)
+# ── DeepSeek 示例 ───────────────────────────────────
+# config = {
+#     "llm_provider": "deepseek",
+#     "deep_think_llm": "deepseek-chat",
+#     "quick_think_llm": "deepseek-chat",
+#     "output_language": "Chinese",
+# }
 
-# Memorize mistakes and reflect
-# ta.reflect_and_remember(1000) # parameter is the position returns
+if __name__ == "__main__":
+    ta = TradingAgentsGraph(debug=True, config=config)
+    final_state, decision = ta.propagate("688017", "2026-05-12")
+    print(decision)
```

**File**: `tests/test_partial_config.py` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+"""#101：README 快速开始只传 4 个键的 config 曾直接 KeyError('data_cache_dir')。"""
+from tradingagents.default_config import DEFAULT_CONFIG
+from tradingagents.graph.trading_graph import merge_config
+
+
+def test_partial_config_is_merged_over_defaults():
+    partial = {"llm_provider": "minimax", "deep_think_llm": "MiniMax-M2.7", "output_language": "Chinese"}
+    merged = merge_config(partial)
+    assert merged["llm_provider"] == "minimax"
+    assert merged["deep_think_llm"] == "MiniMax-M2.7"
+    assert merged["output_language"] == "Chinese"
+    # README 示例没给的键必须从默认值补齐，__init__ 紧接着就要用它们建目录
+    assert merged["data_cache_dir"] == DEFAULT_CONFIG["data_cache_dir"]
+    assert merged["results_dir"] == DEFAULT_CONFIG["results_dir"]
+    assert set(DEFAULT_CONFIG) <= set(merged)
+
+
+def test_none_config_equals_defaults_but_is_a_copy():
+    merged = merge_config(None)
+    assert merged == DEFAULT_CONFIG
+    assert merged is not DEFAULT_CONFIG
+    merged["llm_provider"] = "changed-in-test"
+    assert DEFAULT_CONFIG["llm_provider"] != "changed-in-test"
+
+
+def test_user_nested_dict_replaces_default_wholesale():
+    merged = merge_config({"role_llms": {"bull": {"provider": "openai", "model": "x"}}})
+    assert merged["role_llms"] == {"bull": {"provider": "openai", "model": "x"}}
```

**File**: `tradingagents/graph/trading_graph.py` (modified, +16/-1)
```diff
@@ -139,6 +139,21 @@ def _is_unsupported_by_yfinance(symbol: str) -> bool:
     )
 
 
+def merge_config(config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
+    """用户传入的 config 是**覆盖项**，不是完整配置：缺的键一律取 DEFAULT_CONFIG。
+
+    README 快速开始的示例只给 4 个键（llm_provider / 两个模型 / output_language）。
+    此前这里是 ``config or DEFAULT_CONFIG`` —— 整体替换、不合并，紧接着
+    ``os.makedirs(config["data_cache_dir"])`` 就 KeyError，照 README 粘贴即崩（#101）。
+    dataflows 层的 set_config() 本来就是合并语义，这里与之对齐。
+    浅合并：嵌套字典（如 role_llms）按用户给的整份为准。
+    """
+    merged = DEFAULT_CONFIG.copy()
+    if config:
+        merged.update(config)
+    return merged
+
+
 class TradingAgentsGraph:
     """Main class that orchestrates the trading agents framework."""
 
@@ -158,7 +173,7 @@ def __init__(
             callbacks: Optional list of callback handlers (e.g., for tracking LLM/tool stats)
         """
         self.debug = debug
-        self.config = config or DEFAULT_CONFIG
+        self.config = merge_config(config)
         self.callbacks = callbacks or []
 
         # Update the interface's config
```

---

### Incident Patch 9: `3563c10d` (2026-08-21)
**Commit Message**: fix(llm): bound DeepSeek V4 output via model capabilities

Capped only explicitly identified DeepSeek V4 thinking models at 8192
tokens (reasoning + content) via capabilities.py, per PR #100 maintainer
review. Follow-up to #100 (which removed the contested global
DEFAULT_CONFIG max_tokens=8192 and kept it at None / provider-native).
Upstream #1204: uncapped V4 reasoning chains can trip the OpenCode Go /
OpenAI-compatible gateway ~3 min idle timeout.

- Add default_max_tokens to ModelCapabilities and
  _DEEPSEEK_V4_DEFAULT_MAX_TOKENS = 8192 (single source; matches
  anthropic_client _THIRD_PARTY_DEFAULT_MAX_TOKENS = 8192 provenance,
  #91 report-truncated feedback). Only DEEPSEEK_THINKING carries it.
- OpenAIClient.get_llm fills max_tokens from capabilities only when the
  caller did not already set one (explicit TRADINGAGENTS_MAX_TOKENS /
  role_llms max_tokens wins). Matcher reuses the existing strict
  DeepSeek V4 pattern ^deepseek-v4(?:$|[.-]) — V3.x, Claude/OpenAI/
  Gemini/MiniMax/unknown models stay at None.
- Tests cover V4 vs non-V4, V3.x non-match, explicit-override wins,
  and provider-kwargs -> llm propagation plus capability regression.

No change to DEFAULT_CONFIG glob

**File**: `tests/test_deepseek_v4_max_tokens.py` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+"""Unit tests for DeepSeek V4 capability-based max_tokens bounding.
+
+This bounds the output budget only for explicitly identified DeepSeek V4
+thinking models via capabilities.py — not as a global DEFAULT_CONFIG cap.
+See #100 review, #1204 and PR #100 boundary note.
+
+Must cover:
+1) V4 models (flash/pro/reasoner and pattern variants) get 8192
+2) non-V4 models keep provider default (None)
+3) V3.x not mis-matched
+4) explicit max_tokens overrides the capability default
+5) provider kwargs / request level receives correct value
+6) existing capability/tool_choice/json_mode behaviours untouched
+"""
+
+import os
+
+import pytest
+
+from tradingagents.llm_clients.capabilities import (
+    _DEEPSEEK_V4_DEFAULT_MAX_TOKENS,
+    get_capabilities,
+)
+from tradingagents.llm_clients.openai_client import OpenAIClient
+from tradingagents.graph.trading_graph import TradingAgentsGraph
+
+
+@pytest.mark.unit
+class TestV4GetsMaxTokens:
+    def test_v4_exact_ids_get_8192(self):
+        for model in ("deepseek-v4-flash", "deepseek-v4-pro", "deepseek-reasoner"):
+            cap = get_capabilities(model)
+            assert cap.default_max_tokens == _DEEPSEEK_V4_DEFAULT_MAX_TOKENS
+
+    def test_v4_pattern_variants_get_8192(self):
+        for model in ("deepseek-v4", "deepseek-v4.1", "deepseek-v4-turbo"):
+            assert get_capabilities(model).default_max_tokens == _DEEPSEEK_V4_DEFAULT_MAX_TOKENS
+
+    def test_reasoner_pattern_gets_8192(self):
+        assert get_capabilities("deepseek-reasoner-v2").default_max_tokens == _DEEPSEEK_V4_DEFAULT_MAX_TOKENS
+
+    def test_constant_is_8192(self):
+        # Single source of truth — matches anthropic third-party fallback (#91).
+        assert _DEEPSEEK_V4_DEFAULT_MAX_TOKENS == 8192
+
+
+@pytest.mark.unit
+class TestNonV4NoCap:
+    def test_v3_family_has_no_cap(self):
+        for model in ("deepseek-v3", "deepseek-v3.2", "deepseek-chat"):
+            assert get_capabilities(model).default_max_tokens is None
+
+    def test_other_models_have_no_cap(self):
+        for model in ("gpt-5.4", "MiniMax-M2.7", "mimo-v2.5", "unknown-model", "claude-sonnet-4"):
+            assert get_capabilities(model).default_max_tokens is None
+
+    def test_future_minimax_has_no_cap(self):
+        assert get_capabilities("MiniMax-M3").default_max_tokens is None
+
+
+@pytest.mark.unit
+class TestExplicitOverridesCapability:
+    def test_explicit_max_tokens_wins_on_openai_client(self, monkeypatch):
+        monkeypatch.setenv("OPENAI_COMPATIBLE_API_KEY", "k")
+        client = OpenAIClient(
+            "deepseek-v4-pro",
+            base_url="https://relay.example/v1",
+            provider="openai_compatible",
+            max_tokens=16000,
+        )
+        llm = client.get_llm()
+        assert llm.max_tokens == 16000
+
+    def test_no_explicit_gives_capability_default(self, monkeypatch):
+        monkeypatch.setenv("OPENAI_COMPATIBLE_API_KEY", "k")
+        client = OpenAIClient(
+            "deepseek-v4-pro",
+            base_url="https://relay.example/v1",
+            provider="openai_compatible",
+        )
+        llm = client.get_llm()
+        assert llm.max_tokens == _DEEPSEEK_V4_DEFAULT_MAX_TOKENS
+
+
+@pytest.mark.unit
+class TestProviderKwargsLevel:
+    def test_graph_provider_kwargs_cap_flows_to_llm(self, monkeypatch):
+        monkeypatch.setenv("OPENAI_COMPATIBLE_API_KEY", "k")
+        # Config has no explicit max_tokens -> _get_provider_kwargs won't set it.
+        g = TradingAgentsGraph.__new__(TradingAgentsGraph)
+        g.config = {"max_tokens": None, "llm_provider": "openai_compatible"}
+        kw = g._get_provider_kwargs()
+        assert "max_tokens" not in kw
+        # Yet OpenAIClient fills it for V4 via capabilities
+        llm = OpenAIClient("deepseek-v4-pro", base_url="https://relay.example/v1", provider="openai_compatible", **kw).get_llm()
+        assert llm.max_tokens == _DEEPSEEK_V4_DEFAULT_MAX_TOKENS
+
+    def test_explicit_graph_max_tokens_wins(self, monkeypatch):
+        monkeypatch.setenv("OPENAI_COMPATIBLE_API_KEY", "k")
+        g = TradingAgentsGraph.__new__(TradingAgentsGraph)
+        g.config = {"max_tokens": 12345, "llm_provider": "openai_compatible"}
+        kw = g._get_provider_kwargs()
+        assert kw["max_tokens"] == 12345
+        llm = OpenAIClient("deepseek-v4-pro", base_url="https://relay.example/v1", provider="openai_compatible", **kw).get_llm()
+        assert llm.max_tokens == 12345
+
+    def test_non_v4_graph_no_cap_stays_none(self, monkeypatch):
+        monkeypatch.setenv("OPENAI_COMPATIBLE_API_KEY", "k")
+        g = TradingAgentsGraph.__new__(TradingAgentsGraph)
+        g.config = {"max_tokens": None, "llm_provider": "openai_compatible"}
+        kw = g._get_provider_kwargs()
+        llm = OpenAIClient("deepseek-v3", base_url="https://relay.example/v1", provider="openai_compatible", **kw).get_llm()
+        assert llm.max_tokens is None
+
+
+@pytest.mark.unit
+class TestNoRegr
```

**File**: `tradingagents/llm_clients/capabilities.py` (modified, +14/-2)
```diff
@@ -11,7 +11,7 @@
 
 import re
 from dataclasses import dataclass
-from typing import Literal
+from typing import Literal, Optional
 
 
 StructuredMethod = Literal[
@@ -32,14 +32,26 @@ class ModelCapabilities:
     preferred_structured_method: StructuredMethod
     requires_reasoning_content_roundtrip: bool = False
     supports_reasoning_split: bool = False
+    default_max_tokens: Optional[int] = None
 
 
+# DeepSeek V4 thinking 系的默认输出预算（reasoning + content 共用）。
+#
+# 来源：维护者在 PR #100 指出 8192 是“各家 Anthropic 兼容端点普遍支持的档位”
+# （anthropic_client.py _THIRD_PARTY_DEFAULT_MAX_TOKENS = 8192，缘起 #91
+# “报告写到一半结束”）。同一档位在 opencode-go 约 3 分钟 idle timeout 场景
+# 下（#1204）可约束 V4 reasoning 链的无限输出——不设上限时后端的长 reasoning
+# 链会导致网关空闲超时、进程挂起。PR #100 按维护者建议把**全局** 8192 撤回
+# 为 None（provider 原生上限），8192 仅应作用于**经明确识别的 V4 模型**。
+_DEEPSEEK_V4_DEFAULT_MAX_TOKENS = 8192
+
 _DEEPSEEK_THINKING = ModelCapabilities(
     supports_tool_choice=False,
     supports_json_mode=True,
     supports_json_schema=False,
     preferred_structured_method="function_calling",
     requires_reasoning_content_roundtrip=True,
+    default_max_tokens=_DEEPSEEK_V4_DEFAULT_MAX_TOKENS,
 )
 
 _DEEPSEEK_CHAT = ModelCapabilities(
@@ -80,7 +92,7 @@ class ModelCapabilities:
 }
 
 _BY_PATTERN: list[tuple[re.Pattern[str], ModelCapabilities]] = [
-    # 只匹配已实测的 V4 家族。`^deepseek-v\d` 会连 deepseek-v3* 和未来所有版本一起
+    # 只匹配已实测的 V4 家族。`^deepseek-v\\d` 会连 deepseek-v3* 和未来所有版本一起
     # 吃掉，把「不接受 tool_choice」这个**只在 V4/reasoner 上验证过**的结论强加给
     # 未验证的型号——结构化输出会从强制 schema 工具调用降级为可选调用，反而更容易
     # 退回自由文本。与下方 MiniMax 同一把尺子：新家族实测过再加。
```

**File**: `tradingagents/llm_clients/openai_client.py` (modified, +10/-0)
```diff
@@ -232,6 +232,16 @@ def get_llm(self) -> Any:
             if key in self.kwargs:
                 llm_kwargs[key] = self.kwargs[key]
 
+        # Model-specific output budget via capabilities.py — not a global cap.
+        # DeepSeek V4 reasoning 链不设上限会撞 opencode-go 约 3 分钟 idle timeout
+        #（#1204），但全局 8192 会误伤 Claude/Gemini 等（见 PR #100 review）。
+        # 仅当用户未显式设 max_tokens 时，按 capabilities 的 default_max_tokens
+        # 兜底，且 matcher 严格限于 V4 家族（capabilities.py: ^deepseek-v4）。
+        if "max_tokens" not in llm_kwargs:
+            cap = get_capabilities(self.model)
+            if cap.default_max_tokens is not None:
+                llm_kwargs["max_tokens"] = cap.default_max_tokens
+
         # Native OpenAI: use Responses API for consistent behavior across
         # all model families. Third-party providers use Chat Completions.
         if self.provider == "openai":
```

---

### Incident Patch 10: `0badc334` (2026-08-09)
**Commit Message**: fix: 连字符分隔符被当成构词 / 版本号三处不同步（codex 第九轮）

1. `最终评级：**Sell**- 退出` 里的 - 只是分隔符，却被当成"会延续成更长的词"判否，
   parse_rating 静默返回 Hold，记录下错误的决策。
   判据再补一层：连字符要看后面——跟字母/数字是构词（Sell-off / Buy-side 拒），
   跟空白或其它字符只是分隔符（Sell- 退出 收）。覆盖矩阵扩到 27 例。

2. 上一版改了 pyproject 和 CHANGELOG，漏了 CLAUDE.md 的「当前版本」行，后续 agent
   和发版流程会读到旧版本。新增 test_version_consistency.py，三处不一致直接失败，
   不再靠人记得。

测试：新增 4 例，369 passed / 13 skipped / 0 failed。→ v0.5.14

**File**: `CHANGELOG.md` (modified, +23/-0)
```diff
@@ -6,6 +6,29 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
 and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 Breaking changes within the 0.x line are called out explicitly.
 
+## [0.5.14] — 2026-08-09
+
+### 修复：连字符分隔符被当成构词，评级被静默丢弃
+
+`最终评级：**Sell**- 退出` 里的 `-` 只是分隔符，却被当成"会延续成更长的词"而判否，
+`parse_rating` 静默返回 Hold —— 记录下错误的决策。
+
+判据再补一层：**连字符要看它后面**。跟字母/数字是构词（`Sell-off` / `Buy-side` 拒），
+跟空白或其它字符只是分隔符（`Sell- 退出` 收）。覆盖矩阵扩到 27 例。
+
+### 修复：版本号三处不同步
+
+上一版改了 `pyproject.toml` 和 `CHANGELOG.md`，**漏了 `CLAUDE.md` 的「当前版本」行**
+—— 后续 agent 和发版流程读它会拿到旧版本。
+
+新增 `tests/test_version_consistency.py`：三处不一致直接测试失败，不再靠人记得。
+
+### 测试
+
+369 passed / 13 skipped / **0 failed**（新增 4 例）。
+
+---
+
 ## [0.5.13] — 2026-08-09
 
 ### 修复：加粗 + 连字符仍会被判成评级（正则回溯）
```

**File**: `CLAUDE.md` (modified, +2/-1)
```diff
@@ -6,7 +6,8 @@
 - **仓库**: https://github.com/simonlin1212/TradingAgents-astock
 - **协议**: Apache 2.0
 - **Python**: >=3.10
-- **当前版本**: 0.5.12（2026-08-09 发布，经 codex 八轮审计）
+- **当前版本**: 0.5.14（2026-08-09 发布，经 codex 九轮审计）
+  ⚠️ 改版本号时**三处要一起改**：`pyproject.toml` / `CHANGELOG.md` / 这一行。漏了这行会让后续 agent 和发版流程读到旧版本（`tests/test_version_consistency.py` 会拦）。
 
 ## 架构
 
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "tradingagents-astock"
-version = "0.5.13"
+version = "0.5.14"
 description = "A股多Agent投研框架 — 基于 TradingAgents 深度特化"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `tests/test_signal_processing.py` (modified, +3/-0)
```diff
@@ -229,6 +229,9 @@ def test_chinese_terms_unaffected(self):
             ("建议：**Sell**-off risk remains elevated", "Hold"),
             ("最终评级：**Buy**-side interest is weak", "Hold"),
             ("最终评级：**Buy**2024", "Hold"),
+            # 连字符要看后面：跟字母是构词（拒），跟空白只是分隔符（收，第九轮）
+            ("最终评级：**Sell**- 退出", "Sell"),
+            ("最终评级：Sell- 退出", "Sell"),
             # —— 中文评级词不受影响 ——
             ("最终评级：买入", "Buy"),
             ("最终评级：卖出", "Sell"),
```

**File**: `tests/test_version_consistency.py` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+"""版本号三处必须一致（codex 第九轮）。
+
+`pyproject.toml` 是权威值，但 `CHANGELOG.md` 的最新条目和 `CLAUDE.md` 的「当前版本」
+也各写了一份。这轮就漏了 `CLAUDE.md`——后续 agent 和发版流程读它会拿到旧版本。
+"""
+import pathlib
+import re
+
+ROOT = pathlib.Path(__file__).resolve().parent.parent
+
+
+def _pyproject_version() -> str:
+    m = re.search(r'^version\s*=\s*"([^"]+)"', (ROOT / "pyproject.toml").read_text(encoding="utf-8"), re.M)
+    assert m, "pyproject.toml 里找不到 version"
+    return m.group(1)
+
+
+def test_changelog_top_entry_matches_pyproject():
+    version = _pyproject_version()
+    text = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
+    m = re.search(r"^## \[([^\]]+)\]", text, re.M)
+    assert m, "CHANGELOG.md 里找不到版本条目"
+    assert m.group(1) == version, (
+        f"CHANGELOG 最新条目是 {m.group(1)}，pyproject 是 {version}"
+    )
+
+
+def test_claude_md_current_version_matches_pyproject():
+    version = _pyproject_version()
+    text = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")
+    m = re.search(r"\*\*当前版本\*\*[:：]\s*([0-9][0-9.]*)", text)
+    assert m, "CLAUDE.md 里找不到「当前版本」"
+    assert m.group(1) == version, (
+        f"CLAUDE.md 写的是 {m.group(1)}，pyproject 是 {version}"
+    )
```

**File**: `tradingagents/agents/utils/rating.py` (modified, +3/-1)
```diff
@@ -68,7 +68,9 @@
 #     被判成 Hold —— 而静默改写决策评级会一路污染记忆日志与绩效统计
 # 现在只问一件事：紧跟其后的字符会不会让它变成另一个词？会就不算评级。
 # 中文、各种括号、标点、空白、行尾一律放行。
-_WORD_CONTINUATION = r"[A-Za-z0-9_\-]"
+# 「会让它变成另一个词」的字符。连字符要看后面：`Sell-off` 是构词，
+# `Sell- 退出` 里的 `-` 只是分隔符，后者不该被判否。
+_WORD_CONTINUATION = r"(?:[A-Za-z0-9_]|-(?=[A-Za-z0-9_]))"
 # ⚠️ markdown 的收尾星号必须**放进前瞻内部**，不能写成 `\*{0,2}(?!...)` 先消耗再判断：
 # 那样正则会回溯——`建议：**Sell**-off risk` 里 `\*{0,2}` 先吃掉 `**` 被 `-` 判否，
 # 退一步只吃一个 `*`，剩下的 `*` 恰好满足边界，于是又判成 Sell。
```

---

### Incident Patch 11: `1edf4be2` (2026-08-09)
**Commit Message**: fix: 加粗+连字符仍被判成评级（正则回溯，codex 第八轮）

v0.5.12 把 markdown 收尾星号写成 \*{0,2}(?!词字符)——先消耗再判断会回溯：
`建议：**Sell**-off risk remains elevated` 里 \*{0,2} 先吃掉 **，被 - 判否后退一步
只吃一个 *，剩下那个 * 恰好满足边界，于是又判成 Sell。正好把这条规则本来要挡的
连字符散文放了回来。

改成把星号放进前瞻内部（(?!\*{0,2}词字符)）——"后面不能是（0~2 个星号 + 词字符）"
没有可回溯的余地。`最终评级：**Sell**` 不受影响。

⚠️ 刻意不用占有量词 (?>...) / *+：那是 Python 3.11+ 特性，而本项目声明
requires-python = ">=3.10"，3.10 用户会在导入时就 re.error——比逻辑 bug 更硬的破坏。
新增守卫用例直接检查编译后的 pattern。

覆盖矩阵扩到 25 例。测试：新增 4 例，365 passed / 13 skipped / 0 failed。→ v0.5.13

**File**: `CHANGELOG.md` (modified, +24/-0)
```diff
@@ -6,6 +6,30 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
 and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 Breaking changes within the 0.x line are called out explicitly.
 
+## [0.5.13] — 2026-08-09
+
+### 修复：加粗 + 连字符仍会被判成评级（正则回溯）
+
+v0.5.12 把 markdown 收尾星号写成 `\*{0,2}(?!词字符)` —— **先消耗再判断会回溯**：
+`建议：**Sell**-off risk remains elevated` 里 `\*{0,2}` 先吃掉 `**`，被 `-` 判否后
+退一步只吃一个 `*`，剩下那个 `*` 恰好满足边界，于是又判成 Sell。正好把这条规则本来
+要挡的连字符散文放了回来。
+
+改成把星号**放进前瞻内部**（`(?!\*{0,2}词字符)`）——"后面不能是（0~2 个星号 + 词
+字符）"没有可回溯的余地。`最终评级：**Sell**` 这类正常写法不受影响。
+
+⚠️ **刻意不用占有量词 `(?>...)` / `*+`**：那是 Python 3.11+ 才有的，而本项目声明
+`requires-python = ">=3.10"`，3.10 用户会在**导入时**就 `re.error`——比逻辑 bug
+更硬的破坏。新增一条守卫用例，直接检查编译后的 pattern 里没有这些写法。
+
+覆盖矩阵扩到 25 例。
+
+### 测试
+
+365 passed / 13 skipped / **0 failed**（新增 4 例）。
+
+---
+
 ## [0.5.12] — 2026-08-09
 
 Codex 第七轮 + **两处重构**。这两块前后各被修了三轮"修了又漏"，问题不在某个字符，
```

**File**: `CLAUDE.md` (modified, +78/-1)
```diff
@@ -6,7 +6,7 @@
 - **仓库**: https://github.com/simonlin1212/TradingAgents-astock
 - **协议**: Apache 2.0
 - **Python**: >=3.10
-- **当前版本**: 0.4.0
+- **当前版本**: 0.5.12（2026-08-09 发布，经 codex 八轮审计）
 
 ## 架构
 
@@ -52,9 +52,86 @@ v0.2.5 起完全移除 akshare 依赖，所有数据通过直连 HTTP API 获取
 ### 东财接口防封限流（v0.2.11 新增，移植自 a-stock-data v3.2）
 `a_stock.py` 里所有指向 `eastmoney.com` 的请求（push2 / push2his / datacenter-web / search-api / np-weblist 共 7 个调用点）统一走节流入口 `_em_get()`：模块级时间戳串行限流（默认间隔 `EM_MIN_INTERVAL=1.0s`，可用同名环境变量覆盖）+ 0.1~0.5s 随机抖动 + 复用 `requests.Session`（Keep-Alive）+ 默认 UA。多 Agent 跑批量分析不再触发东财临时封 IP。**仅东财限流**——mootdx(TCP) / 腾讯 / 新浪 / 同花顺 / 财联社 / 百度 等非东财源不受影响。批量场景可设 `EM_MIN_INTERVAL=1.5~2` 进一步降速。新增东财端点时务必走 `_em_get` 而非裸 `requests.get`。
 
+### 未来函数防护（v0.5.1 新增，改数据层必读）
+历史日期上跑分析时，数据层**不得**把"今天"的数据当成分析日当天的事实——报告里完全
+看不出来，属于静默失败。`a_stock.py` 提供 `_is_historical(curr_date)` 与
+`_snapshot_notice()` 两个共用工具：能做时点截断的就截断（如 `get_fund_flow` 按
+curr_date 过滤历史行、复盘时整段不取实时分钟数据）；数据源根本没有历史时点值的
+（腾讯实时估值、同花顺当前一致预期）就在正文顶部**明确告警**并指示模型不得当作当天
+事实。**新增任何收 `curr_date` 的接口，必须处理这两种情况之一，不能收了不用。**
+
+### 非 A 股代码防护（v0.5.3 新增，v0.5.5 补全）
+`_normalize_ticker()` 会拒绝港股（4~5 位数字 / `.HK`）与美股代码。**新增任何 vendor
+方法都必须走它，不要直接调 `safe_ticker_component`**——后者只做路径安全校验，不认市场。
+mootdx/腾讯/东财对不存在的代码常返回空值或僵尸报价而非报错，绕过就等于让模型拿别的
+市场的数据写报告。
+
+⚠️ v0.5.3 曾声称"一个卡点覆盖 15 个接口"，**实际漏了 3 个**（龙虎榜/解禁/行业对比直接
+调了 `safe_ticker_component`），拿 `00700` 调用会返回"近30日未上龙虎榜"这种看起来完全
+正常的报告。v0.5.5 补全。**改完这类防护要枚举所有 vendor 逐个实测，别从设计推断覆盖面。**
+
+### 截断告警要覆盖每种 provider 形状（v0.5.5）
+`warn_if_truncated` 必须认全四种：Anthropic `stop_reason=max_tokens`、OpenAI 兼容
+`finish_reason=length`、Gemini `finish_reason=MAX_TOKENS`（大写）、**OpenAI Responses
+API `status=incomplete` + `incomplete_details.reason=max_output_tokens`**。最后一种最
+要紧——`openai` 是默认 provider 且走 Responses API，v0.5.1 漏掉它导致这个告警在默认
+配置下一次都不会触发。新增 provider 时必须补对应形状 + 一个会触发的样本测试。
+
+### 分角色模型 role_llms（v0.5.0 新增）
+可选，默认空表＝完全维持 quick/deep 两档原行为。合法角色名在 `graph/setup.py` 的
+`ROLE_KEYS`；`GraphSetup.llm_for(role)` 是取模型的唯一入口。**新增 agent 节点时用
+`self.llm_for("<角色名>")`，别直接引用 `self.quick_thinking_llm`**，否则该角色无法被
+单独配置。
+
+### 决策绩效统计（v0.5.2 新增）
+`tradingagents performance` 读记忆日志里已结算的决策算指标，零 LLM 调用。
+**改 `TradingMemoryLog` 的标签格式会直接打断它**（依赖 `[日期 | 代码 | 评级 | raw |
+alpha | holding]` 结构，且 holding 带 `d` 后缀）。
+
+⚠️ **指标命名即口径**：`direction_accuracy`（方向正确率）是唯一衡量判断准不准的——
+看多要跑赢、看空要跑输才算对，Hold 不计入。`up_rate` / `outperform_rate` 只描述标的
+怎么走，**与判断对错无关**。v0.5.2 曾把前者叫"胜率"，导致给 Sell 之后股价下跌（判断
+正确）被记成失败，v0.5.5 改正。
+
 ### 模型兼容性
 deepseek-v4-flash 等模型在 tool call 时可能返回中文股票名而非 6 位代码。`safe_ticker_component` 已加兜底自动转码，但不同模型表现仍有差异。
 
+### 测试
+**干净 clone（`pip install -e .` 不带 `[agentsdk]`）跑 `pytest tests/` 应当是
+361 passed / 13 skipped / **0 failed**。出现 failed 就是真回归。**
+需要可选依赖的用例用 `requires_sdk` 标记跳过——⚠️ **占位类型绝不要用 `Exception`
+基类**：`ClaudeSDKError` 曾被占位成 `Exception`，进 `_FALLBACK_ERRORS` 后让"订阅凭据
+失效不得降级到计费 provider"这条护栏彻底失效（v0.5.4 修）。
+
+### CLI 必须保住裸跑（v0.5.9 血的教训）
+`cli/main.py` 里的 `@app.callback(invoke_without_command=True)` **不能删**。Typer 只
+注册一个命令时是"单命令模式"，裸跑 `tradingagents` 等于跑那个命令；一旦注册第二个
+子命令就切换成"命令组模式"，裸跑直接报 `Missing command` 退出——而 README 和所有文档
+写的都是裸跑，等于**每个现有用户升级后第一条命令就失败**。加子命令时务必先跑
+`tests/test_cli_default_command.py`。
+
+### 评级边界规则：改之前先跑整张矩阵（v0.5.12）
+`rating.py` 里「中文标签 + 英文评级词」的边界判据是
+**「后面不能延续成更长的词」**（`(?![A-Za-z0-9_-])`），不是"枚举允许的标点"。
+这条规则前后被修了三轮才收敛——每轮都是往白名单加字符、每轮都漏：
+无边界→`Buyer interest`判 Buy；`(?![A-Za-z])`→`Sell-off`判 Sell；枚举收尾标点
+→`Buy（基于风险收益比）`**反被判成 Hold**。
+
+⚠️ **动这条规则必须整张跑 `test_rating_value_boundary_matrix`（22 例）**，
+只补自己想到的一两个用例正是前三轮反复的成因。误判会静默改写决策评级，
+一路污染记忆日志与绩效统计。
+
+### 探测 mootdx 不能覆写用户配置（v0.5.10，v0.5.12 重构）
+`StdQuotes.__init__` 里有 `config.set('BESTIP', {'HQ': self.server})`——**每建一次带
+`server` 的 client 都会持久化写进 mootdx 配置文件**。逐台探测会把用户原本配好的服务器
+一路覆写，最后留下一台死的，还会连累同机其它用 mootdx 的程序。
+
+用 `with _preserve_mootdx_bestip() as keep:` 包住探测：选出可用服务器时调 `keep()`
+表示"这次覆写是想要的"，其余每条退出路径（**含异常**）自动还原。
+⚠️ **别改回手动调还原函数**——那样再加一条提前返回就会漏掉一处，而漏掉的后果是
+静默给用户留下一台死服务器。另外快照**必须在 `config.setup()` 之后**取，否则拿到的是
+模块默认空值，"还原"反而把用户真实配置抹成空。
+
 ### 待处理 PR
 - PR #18（hejingchi）：start_date 功能 + 主题切换 + Windows 字体。不建议直接 merge（与 v0.2.6 冲突），start_date 功能值得后续自行实现。
 
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "tradingagents-astock"
-version = "0.5.12"
+version = "0.5.13"
 description = "A股多Agent投研框架 — 基于 TradingAgents 深度特化"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `tests/test_signal_processing.py` (modified, +31/-0)
```diff
@@ -224,6 +224,11 @@ def test_chinese_terms_unaffected(self):
             ("最终评级：Buy-side interest is weak", "Hold"),
             ("最终评级：Buy2024", "Hold"),                       # 数字后缀
             ("最终评级：Buy_target", "Hold"),                    # 下划线
+            # 加粗 + 连字符：`\*{0,2}` 先消耗再判断会回溯——吃掉 `**` 被 `-` 判否后
+            # 退一步只吃一个 `*`，剩下的 `*` 恰好满足边界，于是又判成 Sell（第八轮）
+            ("建议：**Sell**-off risk remains elevated", "Hold"),
+            ("最终评级：**Buy**-side interest is weak", "Hold"),
+            ("最终评级：**Buy**2024", "Hold"),
             # —— 中文评级词不受影响 ——
             ("最终评级：买入", "Buy"),
             ("最终评级：卖出", "Sell"),
@@ -232,3 +237,29 @@ def test_chinese_terms_unaffected(self):
     )
     def test_rating_value_boundary_matrix(self, text, expected):
         assert parse_rating(text) == expected
+
+
+@pytest.mark.unit
+def test_rating_regex_stays_python310_compatible():
+    """评级正则不能用 Python 3.11+ 才有的原子组 / 占有量词。
+
+    pyproject 声明 `requires-python = ">=3.10"`，用 `(?>...)` 或 `*+` 会让 3.10
+    用户在**导入时**就 re.error——比逻辑 bug 更硬的破坏。
+    """
+    import re
+
+    from tradingagents.agents.utils import rating
+
+    # 直接检查真正编译出来的 pattern，而不是源码文本——注释里提到这些写法是正常的
+    patterns = [
+        v.pattern for v in vars(rating).values() if isinstance(v, re.Pattern)
+    ] + [
+        v for k, v in vars(rating).items()
+        if isinstance(v, str) and k.isupper() and k.endswith(("_RE", "_END", "_PREFIX", "_CONTINUATION"))
+    ]
+    assert patterns, "没取到任何正则，用例失去意义"
+
+    for pat in patterns:
+        assert "(?>" not in pat, f"原子组是 Python 3.11+ 特性：{pat}"
+        for possessive in ("*+", "++", "?+", "}+"):
+            assert possessive not in pat, f"占有量词 {possessive} 是 Python 3.11+ 特性：{pat}"
```

**File**: `tradingagents/agents/utils/rating.py` (modified, +6/-2)
```diff
@@ -69,8 +69,12 @@
 # 现在只问一件事：紧跟其后的字符会不会让它变成另一个词？会就不算评级。
 # 中文、各种括号、标点、空白、行尾一律放行。
 _WORD_CONTINUATION = r"[A-Za-z0-9_\-]"
-# 先吃掉 markdown 的收尾星号（`最终评级：**Sell**`）
-_RATING_VALUE_END = r"\*{0,2}(?!" + _WORD_CONTINUATION + r")"
+# ⚠️ markdown 的收尾星号必须**放进前瞻内部**，不能写成 `\*{0,2}(?!...)` 先消耗再判断：
+# 那样正则会回溯——`建议：**Sell**-off risk` 里 `\*{0,2}` 先吃掉 `**` 被 `-` 判否，
+# 退一步只吃一个 `*`，剩下的 `*` 恰好满足边界，于是又判成 Sell。
+# 写成"后面不能是（0~2 个星号 + 词字符）"就没有可回溯的余地。
+# （不用占有量词 `(?>...)`：那是 Python 3.11+ 才有的，本项目声明支持 3.10。）
+_RATING_VALUE_END = r"(?!\*{0,2}" + _WORD_CONTINUATION + r")"
 
 _CN_LABEL_EN_RE = re.compile(
     _CN_LABEL_PREFIX + r"(" + "|".join(RATINGS_5_TIER) + r")" + _RATING_VALUE_END,
```

---

### Incident Patch 12: `f5cd0ef6` (2026-08-09)
**Commit Message**: fix: 上一版那两个修复本身都没修对（codex 第六轮）

1. BESTIP 快照取到的是空默认值 → v0.5.10 的修复无效
   新进程里 mootdx 要等 BaseQuotes.__init__ 调 config.setup() 之后才把持久化的值
   读进来，此前 get("BESTIP") 是模块默认空值。快照到空值后，全部探测失败时的
   "还原"反而把用户真实配置抹成空——比不还原更糟。
   实测 0.11.7：setup 前 {'HQ': ''}，setup 后 {'HQ': ['218.6.170.47', 7709]}。
   现在快照前先显式 setup()；端到端验证真实探测 38 台全失败后用户配置完好。
   测试也改为复刻真实构造函数语义（旧假件不调 setup，抓不到这条）。

2. 评级边界仍放行连字符散文 → v0.5.10 的修复不完整
   (?![A-Za-z]) 只挡紧跟字母的情况，连字符和数字后缀照样过关：
   `建议：Sell-off risk remains elevated` → Sell、`最终评级：Buy2024` → Buy。
   改为要求评级词后是真正的结束（行尾/空白/中文/常见标点），并先吃掉 markdown
   收尾星号，`最终评级：**Sell**` 不受影响。

测试：新增 2 例，340 passed / 13 skipped / 0 failed。版本 → v0.5.11

**File**: `CHANGELOG.md` (modified, +36/-0)
```diff
@@ -6,6 +6,42 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
 and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 Breaking changes within the 0.x line are called out explicitly.
 
+## [0.5.11] — 2026-08-09
+
+Codex 第六轮：**上一版那两个修复本身都没修对。**
+
+### 修复：BESTIP 快照取到的是空默认值（v0.5.10 的修复无效）
+
+v0.5.10 为了不覆写用户配置，在探测前快照了 `config.get("BESTIP")`。但在新进程里
+**mootdx 要等 `BaseQuotes.__init__` 调 `config.setup()` 之后才把持久化的值读进来**
+——此前 `get("BESTIP")` 返回的是模块默认空值。于是快照到的是空值，一旦全部探测失败，
+"还原"反而**把用户真实配置抹成空**，比不还原更糟。
+
+实测（mootdx 0.11.7）：`setup()` 前 `{'HQ': ''}`，`setup()` 后
+`{'HQ': ['218.6.170.47', 7709]}`。现在快照前先显式 `setup()`。
+
+端到端验证：真实探测 38 台全部失败后，用户配置的服务器完好无损。
+测试也改为复刻真实构造函数语义（旧的假件根本不调 `setup()`，所以抓不到这条）。
+
+### 修复：评级边界仍放行连字符散文（v0.5.10 的修复不完整）
+
+`(?![A-Za-z])` 只挡住了紧跟字母的情况，连字符和数字后缀照样过关：
+
+| 文本 | v0.5.10 | 现在 |
+|---|---|---|
+| `建议：Sell-off risk remains elevated` | Sell ❌ | Hold |
+| `最终评级：Buy-side interest is weak` | Buy ❌ | Hold |
+| `最终评级：Buy2024` | Buy ❌ | Hold |
+
+改为要求评级词后面是**真正的结束**（行尾 / 空白 / 中文 / 常见标点），并先吃掉
+markdown 的收尾星号，`最终评级：**Sell**` 这类正常写法不受影响。
+
+### 测试
+
+340 passed / 13 skipped / **0 failed**（新增 2 例）。
+
+---
+
 ## [0.5.10] — 2026-08-09
 
 Codex 第五轮的两处，都是新增行为自己带出来的副作用。
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "tradingagents-astock"
-version = "0.5.10"
+version = "0.5.11"
 description = "A股多Agent投研框架 — 基于 TradingAgents 深度特化"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `tests/test_mootdx_server_selection.py` (modified, +14/-2)
```diff
@@ -269,12 +269,24 @@ def test_probing_restores_mootdx_bestip_when_nothing_works(handshake_fails, monk
     """
     from mootdx import config as mootdx_config
 
-    original = {"HQ": ("1.2.3.4", 7709), "EX": "", "GP": ""}
-    store = {"BESTIP": dict(original)}
+    original = {"HQ": ["1.2.3.4", 7709], "EX": "", "GP": ""}
+    store = {"BESTIP": {"HQ": "", "EX": "", "GP": ""}}   # 未 setup 时的模块默认空值
+    setup_called = {"n": 0}
+
+    def fake_setup():
+        # 复刻真实语义：setup() 之后才把持久化的值读进来
+        setup_called["n"] += 1
+        store["BESTIP"] = dict(original)
+
+    monkeypatch.setattr(mootdx_config, "setup", fake_setup)
     monkeypatch.setattr(mootdx_config, "get", lambda k: store.get(k))
     monkeypatch.setattr(mootdx_config, "set", lambda k, v: store.__setitem__(k, v))
 
     with pytest.raises(RuntimeError):
         a_stock._get_mootdx_client()
 
+    assert setup_called["n"] >= 1, (
+        "必须先 setup() 再快照——新进程里 config.get('BESTIP') 是模块默认空值，"
+        "快照到空值的话'还原'反而会把用户真实配置抹掉"
+    )
     assert store["BESTIP"] == original, "全部探测失败后应把 BESTIP 还原成原样"
```

**File**: `tests/test_signal_processing.py` (modified, +11/-0)
```diff
@@ -194,3 +194,14 @@ def test_real_mixed_ratings_still_parse(self):
     def test_chinese_terms_unaffected(self):
         assert parse_rating("最终评级：买入") == "Buy"
         assert parse_rating("最终评级：卖出") == "Sell"
+
+    def test_hyphenated_and_suffixed_prose_rejected(self):
+        """`(?![A-Za-z])` 不够——连字符和数字后缀能过关（codex 第六轮）。"""
+        assert parse_rating("建议：Sell-off risk remains elevated") == "Hold"
+        assert parse_rating("最终评级：Buy-side interest is weak") == "Hold"
+        assert parse_rating("最终评级：Buy2024") == "Hold"
+
+    def test_markdown_bold_rating_still_parses(self):
+        """收紧边界不能误伤 markdown 加粗写法。"""
+        assert parse_rating("最终评级：**Sell**") == "Sell"
+        assert parse_rating("投资建议: **增持**") == "Overweight"
```

**File**: `tradingagents/agents/utils/rating.py` (modified, +10/-4)
```diff
@@ -59,11 +59,17 @@
 # 英文标签规则要求出现 "rating"；中文标签规则只认中文评级词；裸英文词扫描按
 # 空白切分，"最终评级：Buy" 是**一个** token，`strip("*:.,")` 又剥不掉全角冒号。
 # 结果是静默落到默认值 Hold —— 决策评级被悄悄改写，报告里完全看不出来。
-# ⚠️ 末尾的 `(?![A-Za-z])` 不能省：没有词边界时 `最终评级：Buyer interest remains weak`
-# 会被判成 Buy、`建议：Selling pressure is high` 判成 Sell。这类误判会被写进记忆日志，
-# 再污染决策绩效统计——而且从报告里完全看不出来。
+# 评级词后面必须是**真正的结束**：行尾、空白、或中文/常见标点。
+#
+# ⚠️ 只排除下一个字母（`(?![A-Za-z])`）是不够的——`建议：Sell-off risk remains elevated`
+# 和 `最终评级：Buy-side interest is weak` 里连字符能过关，照样被判成 Sell / Buy；
+# `最终评级：Buy2024` 同理。而这些恰恰就是本规则要挡的"标签后跟英文散文"。
+# 这类误判会被写进记忆日志，再污染决策绩效统计，报告里完全看不出来。
+# 先吃掉 markdown 的收尾星号（`最终评级：**Sell**`），再要求真正的结束。
+_RATING_VALUE_END = r"\*{0,2}(?=$|[\s，。；、！？,.;!?)\]}」』】》]|[\u4e00-\u9fff])"
+
 _CN_LABEL_EN_RE = re.compile(
-    _CN_LABEL_PREFIX + r"(" + "|".join(RATINGS_5_TIER) + r")(?![A-Za-z])",
+    _CN_LABEL_PREFIX + r"(" + "|".join(RATINGS_5_TIER) + r")" + _RATING_VALUE_END,
     re.IGNORECASE,
 )
 # Bare Chinese rating term anywhere (last-resort fallback).
```

**File**: `tradingagents/dataflows/a_stock.py` (modified, +5/-0)
```diff
@@ -370,6 +370,11 @@ def _get_mootdx_client():
     saved_bestip = None
     try:
         from mootdx import config as _mootdx_config
+        # 🔴 必须先 setup() 再快照：新进程里 `config.get("BESTIP")` 返回的是模块默认
+        # 空值，用户持久化的服务器要等 `BaseQuotes.__init__` 调 setup() 才被读进来。
+        # 快照到空值的话，"还原"反而会把用户真实配置抹成空——比不还原更糟。
+        # 实测（mootdx 0.11.7）：setup 前 {'HQ': ''}，setup 后 {'HQ': ['218.6.x.x', 7709]}。
+        _mootdx_config.setup()
         saved_bestip = _mootdx_config.get("BESTIP")
         if isinstance(saved_bestip, dict):
             saved_bestip = dict(saved_bestip)
```

---

### Incident Patch 13: `cbabc02f` (2026-08-09)
**Commit Message**: fix: 探测覆写 mootdx 配置 / 中英混排评级误判（codex 第五轮）

两处都是新增行为自己带出来的副作用。

1. 探测服务器会覆写用户配置的 mootdx 服务器
   StdQuotes.__init__ 里有 config.set('BESTIP', {'HQ': self.server})——每建一次
   带 server 的 client 都会持久化写进配置文件。v0.5.6 把候选表扩到 38 台后，逐台
   探测等于一路覆写用户原本配好的服务器，最后留下最后一台失败的：裸 factory 兜底
   （读 BESTIP）再也救不回来，同机上其它用 mootdx 的程序也被连累。
   现在探测前快照 BESTIP，兜底前与全失败时都还原。

2. 中文标签后跟英文散文被误判成评级
   _CN_LABEL_EN_RE 缺词边界：`最终评级：Buyer interest remains weak` → Buy，
   `建议：Selling pressure is high` → Sell。误判会写进记忆日志再污染绩效统计，
   报告里完全看不出来。已加 (?![A-Za-z])，正常中英混排不受影响。

测试：新增 4 例，338 passed / 13 skipped / 0 failed。版本 → v0.5.10

**File**: `CHANGELOG.md` (modified, +36/-0)
```diff
@@ -6,6 +6,42 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
 and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 Breaking changes within the 0.x line are called out explicitly.
 
+## [0.5.10] — 2026-08-09
+
+Codex 第五轮的两处，都是新增行为自己带出来的副作用。
+
+### 修复：探测服务器会覆写用户配置的 mootdx 服务器
+
+mootdx 的 `StdQuotes.__init__` 里有 `config.set('BESTIP', {'HQ': self.server})`
+——**每建一次带 `server` 的 client 都会持久化写进它的配置文件**。v0.5.6 把候选表从
+10 台扩到 38 台之后，逐台探测等于把用户原本配好的服务器一路覆写，最后留在配置里的
+是最后一台**失败的**服务器：
+
+- 下面那个裸 `Quotes.factory()` 兜底读的正是 BESTIP，于是再也救不回来；
+- 更糟的是同一台机器上**其它用 mootdx 的程序**也会被留下一台死服务器。
+
+现在探测前先快照 BESTIP，裸 factory 兜底之前、以及一台都没选出来时都还原回去。
+
+### 修复：中文标签后跟英文散文会被误判成评级
+
+`_CN_LABEL_EN_RE` 缺词边界，于是：
+
+| 文本 | 修复前 | 修复后 |
+|---|---|---|
+| `最终评级：Buyer interest remains weak` | Buy ❌ | Hold |
+| `建议：Selling pressure is high` | Sell ❌ | Hold |
+| `最终评级：Holder structure changed` | Hold（碰巧对） | Hold |
+
+这类误判会被写进记忆日志，再污染 `tradingagents performance` 的评级统计，
+而且从报告里完全看不出来。已加 `(?![A-Za-z])`，正常的中英混排（`最终评级：Buy`）
+不受影响。
+
+### 测试
+
+338 passed / 13 skipped / **0 failed**（新增 4 例）。
+
+---
+
 ## [0.5.9] — 2026-08-09
 
 ### 🔴 修复：裸跑 `tradingagents` 被 v0.5.2 打断（升级即破坏）
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "tradingagents-astock"
-version = "0.5.9"
+version = "0.5.10"
 description = "A股多Agent投研框架 — 基于 TradingAgents 深度特化"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `tests/test_mootdx_server_selection.py` (modified, +21/-0)
```diff
@@ -257,3 +257,24 @@ def test_bestip_is_never_used(handshake_fails):
         a_stock._get_mootdx_client()
 
     assert handshake_fails["bestip_used"] is False
+
+
+def test_probing_restores_mootdx_bestip_when_nothing_works(handshake_fails, monkeypatch):
+    """探测不能把用户配好的服务器覆写掉（codex 第五轮）。
+
+    mootdx 的 StdQuotes.__init__ 里有 `config.set('BESTIP', {'HQ': self.server})`
+    ——每建一次带 server 的 client 都会持久化写入配置文件。逐台探测 38 个候选等于
+    一路覆写，最后留下的是最后一台**失败的**服务器，裸 factory 兜底（读 BESTIP）
+    再也救不回来，还会连累同机上其它用 mootdx 的程序。
+    """
+    from mootdx import config as mootdx_config
+
+    original = {"HQ": ("1.2.3.4", 7709), "EX": "", "GP": ""}
+    store = {"BESTIP": dict(original)}
+    monkeypatch.setattr(mootdx_config, "get", lambda k: store.get(k))
+    monkeypatch.setattr(mootdx_config, "set", lambda k, v: store.__setitem__(k, v))
+
+    with pytest.raises(RuntimeError):
+        a_stock._get_mootdx_client()
+
+    assert store["BESTIP"] == original, "全部探测失败后应把 BESTIP 还原成原样"
```

**File**: `tests/test_signal_processing.py` (modified, +26/-0)
```diff
@@ -168,3 +168,29 @@ def test_makes_no_llm_calls(self):
     def test_default_when_no_rating_present(self):
         sp = SignalProcessor()
         assert sp.process_signal("Plain prose without a recommendation.") == "Hold"
+
+
+@pytest.mark.unit
+class TestParseRatingWordBoundary:
+    """中文标签后跟英文散文时，不能把词首当成完整评级（codex 第五轮）。
+
+    没有词边界的话 `最终评级：Buyer interest remains weak` 会被判成 Buy、
+    `建议：Selling pressure is high` 判成 Sell。这类误判会写进记忆日志，
+    再污染决策绩效统计——而且从报告里完全看不出来。
+    """
+
+    def test_english_prose_after_cn_label_is_not_a_rating(self):
+        assert parse_rating("最终评级：Buyer interest remains weak") == "Hold"
+        assert parse_rating("建议：Selling pressure is high") == "Hold"
+        assert parse_rating("最终评级：Holder structure changed") == "Hold"
+
+    def test_real_mixed_ratings_still_parse(self):
+        """加了边界不能误伤正常的中英混排。"""
+        assert parse_rating("最终评级：Buy") == "Buy"
+        assert parse_rating("最终评级：Sell\n理由若干。") == "Sell"
+        assert parse_rating("投资建议：Overweight") == "Overweight"
+        assert parse_rating("评级 - buy") == "Buy"
+
+    def test_chinese_terms_unaffected(self):
+        assert parse_rating("最终评级：买入") == "Buy"
+        assert parse_rating("最终评级：卖出") == "Sell"
```

**File**: `tradingagents/agents/utils/rating.py` (modified, +5/-1)
```diff
@@ -59,8 +59,12 @@
 # 英文标签规则要求出现 "rating"；中文标签规则只认中文评级词；裸英文词扫描按
 # 空白切分，"最终评级：Buy" 是**一个** token，`strip("*:.,")` 又剥不掉全角冒号。
 # 结果是静默落到默认值 Hold —— 决策评级被悄悄改写，报告里完全看不出来。
+# ⚠️ 末尾的 `(?![A-Za-z])` 不能省：没有词边界时 `最终评级：Buyer interest remains weak`
+# 会被判成 Buy、`建议：Selling pressure is high` 判成 Sell。这类误判会被写进记忆日志，
+# 再污染决策绩效统计——而且从报告里完全看不出来。
 _CN_LABEL_EN_RE = re.compile(
-    _CN_LABEL_PREFIX + r"(" + "|".join(RATINGS_5_TIER) + r")", re.IGNORECASE
+    _CN_LABEL_PREFIX + r"(" + "|".join(RATINGS_5_TIER) + r")(?![A-Za-z])",
+    re.IGNORECASE,
 )
 # Bare Chinese rating term anywhere (last-resort fallback).
 _CN_TERM_RE = re.compile(_CN_ALT)
```

**File**: `tradingagents/dataflows/a_stock.py` (modified, +30/-0)
```diff
@@ -362,6 +362,29 @@ def _get_mootdx_client():
 
     from mootdx.quotes import Quotes
 
+    # ⚠️ mootdx 的 `StdQuotes.__init__` 里有 `config.set('BESTIP', {'HQ': self.server})`
+    # ——每建一次带 server 的 client 都会**持久化写入它的配置文件**。逐台探测 38 个候选
+    # 就等于把用户原本配好的服务器一路覆写掉，最后留在配置里的是最后一台**失败的**
+    # 服务器；下面的裸 factory 兜底（它读 BESTIP）也就再也救不回来，还会连累同一台
+    # 机器上其它用 mootdx 的程序。所以探测前先快照，选不出可用服务器时原样还回去。
+    saved_bestip = None
+    try:
+        from mootdx import config as _mootdx_config
+        saved_bestip = _mootdx_config.get("BESTIP")
+        if isinstance(saved_bestip, dict):
+            saved_bestip = dict(saved_bestip)
+    except Exception as e:  # 版本差异导致取不到就跳过恢复，别影响主流程
+        logger.debug("读取 mootdx BESTIP 失败，探测后不做恢复：%s", e)
+
+    def _restore_bestip():
+        if saved_bestip is None:
+            return
+        try:
+            from mootdx import config as _cfg
+            _cfg.set("BESTIP", saved_bestip)
+        except Exception as e:
+            logger.debug("恢复 mootdx BESTIP 失败：%s", e)
+
     # TCP 预筛并发跑：38 台里多数是"连都连不上"，串行每台要等满超时（实测整轮
     # 73.7s，首次调用像卡死）。预筛纯粹是等 IO，并发不改变选取语义——下面仍按
     # 原顺序、逐台做真实取数验证，精选表依旧优先。
@@ -387,6 +410,10 @@ def _get_mootdx_client():
             logger.debug("mootdx %s:%s 建连成功但取不到数，换下一台", ip, port)
 
 
+    # 裸 factory 读的就是 BESTIP，而上面的逐台探测已经把它覆写了——必须先还原成
+    # 用户原本配置的那台，这个兜底才有意义。
+    _restore_bestip()
+
     # 最后再试一次裸 factory（老用户的 mootdx config 里可能已存了可用 IP）。
     # ⚠️ 刻意**不用** `bestip=True`：它会把整张主机表做一遍测速，实测要几分钟。
     # 上面 `_candidate_tdx_servers()` 已经把 mootdx 自带的完整主机表逐台验证过了，
@@ -402,6 +429,9 @@ def _get_mootdx_client():
             _mootdx_client = candidate
             return _mootdx_client
 
+    # 一台都没选出来：把 BESTIP 还原成探测前的样子，别留下一台死服务器
+    _restore_bestip()
+
     _mootdx_unavailable_until = time.time() + _MOOTDX_RETRY_AFTER_S
     if tcp_ok_but_dead:
         # 说清楚是"协议被拒"而不是"连不上"——这两者的排查方向完全不同。
```

---

### Incident Patch 14: `39689739` (2026-08-09)
**Commit Message**: fix: 未完成任务索引写失败不再静默吞掉（承接 #93）

#93 的重试 + 降级思路是对的，但最后一层 `except OSError: pass` 完全静默——
索引一直写不进去时用户永远不会知道，「未完成任务」列表长期不更新也无从排查。

改为打一条 warning：仍然不往上抛（不中断分析，读取端容错、下次会重建），
但至少可见。本项目对静默吞错一贯从严。

**File**: `web/history.py` (modified, +12/-4)
```diff
@@ -3,6 +3,7 @@
 from __future__ import annotations
 
 import json
+import logging
 import re
 import tempfile
 import threading
@@ -13,6 +14,8 @@
 from tradingagents.default_config import DEFAULT_CONFIG
 
 
+logger = logging.getLogger(__name__)
+
 _INCOMPLETE_TASKS_FILE = Path.home() / ".tradingagents" / "incomplete_tasks.json"
 _INCOMPLETE_TASKS_LOCK = threading.Lock()
 
@@ -117,12 +120,17 @@ def _save_incomplete_index(entries: list[dict[str, Any]]) -> None:
         except OSError:
             raise
 
-    # 重试耗尽仍被占用：直接覆写（非原子但可接受）；仍失败则静默忽略，
-    # 索引缺失不致命，读取端容错，下次写入会自动重建。
+    # 重试耗尽仍被占用：直接覆写（非原子但可接受）。
     try:
         _INCOMPLETE_TASKS_FILE.write_text(payload, encoding="utf-8")
-    except OSError:
-        pass
+    except OSError as e:
+        # 索引写不进去不致命——读取端容错、下次写入会自动重建，所以不往上抛。
+        # 但**不能一声不吭**：完全静默的话，用户永远不会知道它一直在失败，
+        # 「未完成任务」列表长期不更新时也无从排查。
+        logger.warning(
+            "写入未完成任务索引失败（已重试并降级为直接覆写）：%s。"
+            "不影响本次分析，但侧边栏的未完成任务列表可能不是最新的。", e
+        )
 
 
 def _checkpoint_step(ticker: str, trade_date: str) -> int | None:
```

---

### Incident Patch 15: `3b934676` (2026-08-09)
**Commit Message**: fix: 修复 Web UI 崩溃 - Windows 文件锁冲突 (PermissionError WinError 5) (#93)

web/history.py _save_incomplete_index 的 tmp.replace() 在 Windows 上目标文件被占用时抛 PermissionError，导致多实例并发时侧边栏渲染崩溃。改为 3 次重试 + 降级直写 + 兜底静默，索引写失败不再致命（读取端已容错 JSON）。

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `web/history.py` (modified, +39/-11)
```diff
@@ -82,19 +82,47 @@ def _load_incomplete_index() -> list[dict[str, Any]]:
 
 
 def _save_incomplete_index(entries: list[dict[str, Any]]) -> None:
+    """原子写 incomplete_tasks.json，兼容 Windows 文件占用。
+
+    目标文件可能被其他进程短暂占用（如多实例 Web UI、杀毒软件扫描），
+    此时 ``tmp.replace`` 在 Windows 上会抛 ``PermissionError``（#77）。
+    先重试几次等待锁释放，仍失败则降级为直接覆写——读取端
+    （``_load_incomplete_index``）已容错损坏 JSON，索引写不进去不致命。
+    """
     parent = _INCOMPLETE_TASKS_FILE.parent
     parent.mkdir(parents=True, exist_ok=True)
-    with tempfile.NamedTemporaryFile(
-        "w",
-        encoding="utf-8",
-        dir=parent,
-        prefix=f"{_INCOMPLETE_TASKS_FILE.stem}.",
-        suffix=".tmp",
-        delete=False,
-    ) as f:
-        json.dump(entries, f, ensure_ascii=False, indent=2)
-        tmp = Path(f.name)
-    tmp.replace(_INCOMPLETE_TASKS_FILE)
+    payload = json.dumps(entries, ensure_ascii=False, indent=2)
+
+    for attempt in range(3):
+        tmp: Path | None = None
+        try:
+            with tempfile.NamedTemporaryFile(
+                "w",
+                encoding="utf-8",
+                dir=parent,
+                prefix=f"{_INCOMPLETE_TASKS_FILE.stem}.",
+                suffix=".tmp",
+                delete=False,
+            ) as f:
+                f.write(payload)
+                tmp = Path(f.name)
+            tmp.replace(_INCOMPLETE_TASKS_FILE)
+            return
+        except PermissionError:
+            if tmp is not None:
+                tmp.unlink(missing_ok=True)
+            if attempt < 2:
+                # 锁通常是瞬时的，短暂等待后重试
+                time.sleep(0.15 * (attempt + 1))
+        except OSError:
+            raise
+
+    # 重试耗尽仍被占用：直接覆写（非原子但可接受）；仍失败则静默忽略，
+    # 索引缺失不致命，读取端容错，下次写入会自动重建。
+    try:
+        _INCOMPLETE_TASKS_FILE.write_text(payload, encoding="utf-8")
+    except OSError:
+        pass
 
 
 def _checkpoint_step(ticker: str, trade_date: str) -> int | None:
```

#### Recent Merged Pull Requests:
- **PR #112** (2026-09-20): feat(glm): 模型表补充 GLM-5.3 / 5.3-Flash / 5.2 (@FelixWang119)
- **PR #111** (2026-09-20): fix(a_stock): 同花顺一致预期在 pandas 3.x 下取空 + 概念板块静默吞掉百度风控 403 (@FelixWang119)
- **PR #110** (closed): feat(llm): 接入火山方舟 Coding Plan / Agent Plan 订阅套餐 (@XuLpCMCC)
- **PR #109** (2026-09-20): refactor(agents): 压缩辩论历史并去除重复的最后一条发言注入 (@SummerCaptain)
- **PR #107** (2026-09-20): feat: track, retry, and surface missing data (@zhanghang02)
- **PR #103** (2026-09-20): fix(llm): bound DeepSeek V4 output via model capabilities (@k176060444-lgtm)
- **PR #100** (2026-09-20): fix(llm): prevent hangs via timeout retry and streaming keep-alive (@k176060444-lgtm)
- **PR #99** (closed): feat: 接入火山方舟订阅套餐 + Web 配置持久化 + 锁超时降级 (@XuLpCMCC)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
