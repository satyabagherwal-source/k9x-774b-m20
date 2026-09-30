# Forensic Learning Record (Deep Inspection): atilaahmettaner/tradingview-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/atilaahmettaner-tradingview-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/atilaahmettaner/tradingview-mcp](https://github.com/atilaahmettaner/tradingview-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:48:15.670Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `atilaahmettaner/tradingview-mcp`
- **Description**: TradingView MCP server — real-time market data, technical analysis, screeners & backtesting for Claude, ChatGPT, Cursor & any MCP client. Stocks, crypto, forex & futures across global exchanges. Hosted or self-host.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 4880 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `openclaw/trading.py`
```
#!/usr/bin/env python3
"""
CLI wrapper for tradingview-mcp — called by OpenClaw agent via bash.

Usage:
    python3 trading.py price AAPL
    python3 trading.py snapshot
    python3 trading.py backtest AAPL rsi 1y
    python3 trading.py backtest BTC-USD bollinger 6mo 1h
    python3 trading.py compare AAPL 2y
    python3 trading.py walkforward AAPL rsi 2y
    python3 trading.py sentiment BTC

Install path: ~/.openclaw/tools/trading.py
"""
import sys
import json
import os

# Auto-discover site-packages for tradingview-mcp-server across uv installs
# (glob covers any home directory and Python version — no hardcoded paths).
import glob
candidates = glob.glob(
    os.path.expanduser(
        "~/.local/share/uv/tools/tradingview-mcp-server/lib/python*/site-packages"
    )
)
if candidates:
    sys.path.insert(0, candidates[0])

try:
    from tradingview_mcp.core.services.yahoo_finance_service import get_price, get_market_snapshot
    from tradingview_mcp.core.services.backtest_service import run_backtest, compare_strategies, walk_forward_backtest
    # marketaux_service replaced the old Reddit-based sentiment_service with
    # the same function name and output shape (licensed news sentiment).
    from tradingview_mcp.core.services.marketaux_service import analyze_sentiment
except ImportError as e:
    print(json.dumps({"error": str(e), "fix": "Run: uv tool install tradingview-mcp-server"}))
    sys.exit(1)

cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
args = sys.argv[2:]


def _require_symbol():
    """Return the first positional (symbol) argument.

    Emits a clear operator-facing error and exits non-zero when it is missing,
    instead of letting ``args[0]`` raise an opaque IndexError.
    """
    if not args:
        print(json.dumps({
            "error": f"Missing required symbol argument for '{cmd}'. "
                     f"Run 'trading.py help' for usage."
        }))
        sys.exit(1)
    return args[0]


try:
    if cmd == "price":
        print(json.dumps(get_price(_require_symbol()), indent=2))

    elif cmd == "snapshot":
        print(json.dumps(get_market_snapshot(), indent=2))

    elif cmd == "backtest":
        symbol   = _require_symbol()
        strategy = args[1] if len(args) > 1 else "rsi"
        period   = args[2] if len(args) > 2 else "1y"
        interval = args[3] if len(args) > 3 else "1d"
        print(json.dumps(run_backtest(symbol, strategy, period, interval=interval), indent=2))

    elif cmd == "compare":
        symbol = _require_symbol()
        period = args[1] if len(args) > 1 else "1y"
        print(json.dumps(compare_strategies(symbol, period), indent=2))

    elif cmd == "walkforward":
        symbol   = _require_symbol()
        strategy = args[1] if len(args) > 1 else "rsi"
        period   = args[2] if len(args) > 2 else "2y"
        print(json.dumps(walk_forward_backtest(symbol, strategy, period), indent=2))

    elif cmd == "sentiment":
        print(json.dumps(analyze_sentiment(_require_symbol()), indent=2))

    elif cmd == "help":
        print("Commands: price <sym> | snapshot | backtest <sym> <strategy> <period> [interval] | compare <sym> [period] | walkforward <sym> [strategy] [period] | sentiment <sym>")
        print("Strategies: rsi | bollinger | macd | ema_cross | supertrend | donchian")

    else:
        print(json.dumps({"error": f"Unknown command: {cmd}"}))

except Exception as e:
    print(json.dumps({"error": str(e)}))

```

### Core Architecture Module: `src/tradingview_mcp/__init__.py`
```
"""TradingView MCP server package."""

```

### Core Architecture Module: `src/tradingview_mcp/core/data/egx_indices.py`
```
"""EGX (Egyptian Exchange) index constituents.

Defines the constituent stocks for the main EGX indices:
- EGX30: Top 30 most liquid and active stocks (blue chips)
- EGX70 EWI: Next 70 stocks by liquidity (mid/small cap)
- EGX100 EWI: EGX30 + EGX70 combined
- SHARIAH33: Shariah-compliant index (34 stocks)
- EGX35-LV: Low Volatility index (35 stocks)
- TAMAYUZ: Small/micro-cap emerging companies index (5 stocks)

Constituents validated against the live TradingView egypt-market listing
on 2026-08-26 (dead symbols pruned). Index membership itself follows the
EGX semi-annual reviews (Feb/Aug) and must be updated from egx.com.eg
announcements — the scanner can verify a symbol exists, not which index
it belongs to.
"""
from __future__ import annotations
from typing import Dict, List


# EGX30 Price Index - Top 30 blue-chip stocks (weighted by free-float market cap)
EGX30_CONSTITUENTS: List[str] = [
    "ISPH",   # Ibnsina Pharma
    "ABUK",   # Abu Qir Fertilizers
    "EMFD",   # Emaar Misr Development
    "AMOC",   # Alexandria Mineral Oils Company
    "COMI",   # Commercial International Bank (CIB)
    "EAST",   # Eastern Company
    "RMDA",   # Rameda
    "CCAP",   # Qalaa Holdings
    "ETEL",   # Telecom Egypt
    "ORAS",   # Orascom Construction
    "ORHD",   # Orascom Development Egypt
    # 2026-08 review: EGCH, ARCC, ORWE, OIH demoted to EGX70; MFPC, ALCN,
    # SKPC, CLHO promoted in.
    "MFPC",   # Misr Fertilizers Production Company (MOPCO)
    "ALCN",   # Alexandria Container & Cargo Handling
    "SKPC",   # Sidi Kerir Petrochemicals (SIDPEC)
    "CLHO",   # Cleopatra Hospitals Group
    "EFIH",   # e-finance Investment Group
    "EFID",   # Edita Food Industries
    "PHDC",   # Palm Hills Development
    "BTFH",   # Beltone Holding
    "JUFO",   # Juhayna Food Industries
    "GBCO",   # GB Corp
    "RAYA",   # Raya Holding
    "VLMR",   # Valmore Holding (USD)
    "VLMRA",  # Valmore Holding (EGP)
    "FWRY",   # Fawry
    "HRHO",   # EFG Holding
    "TMGH",   # Talaat Moustafa Group
    "HELI",   # Heliopolis Housing
    "MCQE",   # Misr Cement Qena
    "EGAL",   # Egypt Aluminium
    "ADIB",   # Abu Dhabi Islamic Bank Egypt
]

# EGX70 EWI - Next 70 stocks by liquidity (equal-weighted)
EGX70_CONSTITUENTS: List[str] = [
    "AMER",   # Amer Group
    "ATLC",   # AT Lease
    "TALM",   # Taaleem Management Services
    # "AIHC" (Arabia Investments Holding) removed 2026-08-26 — no longer
    # returned by the TradingView scanner (delisted/suspended).
    "AIDC",   # Arabia Investment & Development
    "ASPI",   # Aspire Capital Holding
    "SCEM",   # Sinai Cement
    "ASCM",   # ASCOM Mining
    "ACTF",   # Act Financial
    "IDRE",   # Ismailia New Development
    "ISMA",   # Ismailia Misr Poultry
    "AFDI",   # Al Ahly Development & Investment
    "EXPA",   # Export Development Bank of Egypt
    "DAPH",   # Development & Engineering Consultants
    "ISMQ",   # Iron & Steel for Mines & Quarries
    "ICFC",   # International Fertilizers & Chemicals
    "IFAP",   # International Agricultural Products
    "ZEOT",   # Extracted Oils & Derivatives
    "OCDI",   # SODIC
    "SWDY",   # Elsewedy Electric
    "ELSH",   # El Shams Housing
    "UEGC",   # Upper Egypt Contracting
    "ENGC",   # Engineering Industries (ICON)
    "PRCL",   # General Ceramics & Porcelain
    "MEPA",   # Medical Packaging
    "OBRI",   # Obour Land Real Estate Investment
    "ECAP",   # El Ezz Ceramics & Porcelain (Gemma)
    "POUL",   # Cairo Poultry
    "COSG",   # Cairo Oils & Soap
    "CSAG",   # Canal Shipping Agencies
    "IEEC",   # Industrial & Engineering Projects
    "PHAR",   # EIPICO
    "ETRS",   # Egytrans
    "EGTS",   # Egyptian Resorts Company
    "MOED",   # Modern Education Systems
    "MPRC",   # Egyptian Media Production City
    "EHDR",   # Egyptian Housing Development
    "ARAB",   # Arab Developers Holding
    "AMIA",   # Al Moatamad Investments
    "MPCO",   # Mansoura Poultry
    "KABO",   # Kabo Textiles
    "NIPH",   # Nile Pharmaceuticals
    "MTIE",   # MM Group
    "OFH",    # OB Financial Holding
    "HDBK",   # Housing & Development Bank
    "CIEB",   # Credit Agricole Egypt
    "TANM",   # Tanmeya Real Estate Investment
    "BIOC",   # GlaxoSmithKline Egypt
    "SVCE",   # South Valley Cement
    "GPIM",   # GB for Urban Development
    "DSCW",   # Dice Sport & Casual Wear
    "RACC",   # Raya Contact Center
    "ZMID",   # Zahraa Maadi Investment
    "SIPC",   # Saba International Pharma
    "SDTI",   # Sharm Dreams
    "NCCW",   # Nasr Civil Works
    "TAQA",   # TAQA Arabia
    "CNFN",   # Contact Financial Holding
    "LCSW",   # Lecico Egypt
    "MCRO",   # Macro Group
    "MASR",   # Madinet Masr
    "ATQA",   # Attaka Steel
    "AFMC",   # Alexandria Mills
    "MPCI",   # Memphis Pharma
    "KRDI",   # Nile Agriculture Development
    "VALU",   # valU Consumer Finance
    "UNIP",   # Unipack
    # 2026-08 review: demoted from EGX30 (MFPC, ALCN, SKPC promoted out of
    # this list; CLHO entered EGX30 from outside the EGX70).
    "EGCH",   # KIMA (El Nasr Chemicals)
    "ARCC",   # Arabian Cement
    "ORWE",   # Oriental Weavers
    "OIH",    # Orascom Investment Holding
]


# SHARIAH33 - Shariah-compliant index (34 stocks)
SHARIAH33_CONSTITUENTS: List[str] = [
    "ISPH",   # Ibn Sina Pharma
    "AMOC",   # Alexandria Mineral Oils Company
    "ICFC",   # International Fertilizers Company
    "IFAP",   # International Crops
    "OCDI",   # Sixth of October Development & Investment - SODIC
    "RMDA",   # 10th of Ramadan for Pharmaceutical Industries - RAMEDA
    "ACGC",   # Arab Cotton Ginning Company
    "ARCC",   # Arab Cement Company
    "CIRA",   # Cairo Investment & Development - SERA Education
    "ETRS",   # Egyptian Transport Services - Egytrans
    "ETEL",   # Telecom Egypt
    "MPCO",   # Mansoura Poultry
    "ORWE",   # Oriental Weavers
    "MTIE",   # M.M. Group for Industry & Global Trade
    "ORAS",   # Orascom Construction PLC
    "ORHD",   # Orascom Development Egypt
    "EFIH",   # EFG Hermes Financial & Digital Investments
    "EFID",   # Edita Food Industries
    "PHDC",   # Palm Hills Developments
    "SAUD",   # Bank of Baraka Egypt
    "FAITA",  # Faisal Islamic Bank of Egypt - USD
    "FAIT",   # Faisal Islamic Bank of Egypt - EGP
    "JUFO",   # Juhayna Food Industries
    "RACC",   # Raya Contact Centers
    "SKPC",   # Sidi Kerir Petrochemicals - SIDPEC
    "OLFI",   # Obour Land for Food Industries
    "EGAS",   # Egypt Gas
    "LCSW",   # LESECO Egypt
    "TMGH",   # Talaat Moustafa Group Holding
    "MASR",   # Madinat Misr for Housing & Development
    "ATQA",   # Egypt National Steel - Ataka
    "MCQE",   # Misr Cement - Qena
    "EGAL",   # Egyptalum
    "ADIB",   # Abu Dhabi Islamic Bank Egypt
]

# EGX35-LV - Low Volatility index (35 stocks)
EGX35LV_CONSTITUENTS: List[str] = [
    "ABUK",   # Abu Qir Fertilizers & Chemicals
    "EMFD",   # Emaar Misr for Development
    "ACTF",   # ACT Financial Consulting
    "ALCN",   # Alexandria Container & Cargo Handling
    "AMOC",   # Alexandria Mineral Oils Company
    "AFDI",   # Al Ahly for Development & Investment
    "COMI",   # Commercial International Bank (CIB)
    "EXPA",   # Export Development Bank of Egypt
    "EAST",   # Eastern Company
    "ELSH",   # El Shams for Housing & Development
    "ENGC",   # Engineering Architectural Industries for Construction & Development - ICON
    "RMDA",   # 10th of Ramadan for Pharmaceutical Industries - RAMEDA
    "PHAR",   # Egyptian International Pharmaceutical Industries - EIPICO
    "ETEL",   # Telecom Egypt
    "EHDR",   # Egyptians for Housing & Development
    "ORWE",   # Oriental Weavers
    "ORAS",   # Orascom Construction PLC
    "EFIH",   # EFG Hermes Financial & Digital Investments
    "EFID",   # Edita Food Industries
    "PHDC",   # Palm Hills Developments
    "HDBK",   # Housing & Development Bank
    "CIEB",   # Credit Agricole Egypt
    "JUFO",   # Juhayna Food Industries
    "SKPC",   # Sidi K
```

### Core Architecture Module: `src/tradingview_mcp/core/data/egx_sectors.py`
```
"""EGX (Egyptian Exchange) sector classification for stock symbols.

Symbols validated against the live TradingView egypt-market listing on
2026-08-26; 12 delisted/suspended symbols were pruned. New listings are
NOT auto-assigned to sectors (sector membership needs manual research) —
the full live universe lives in coinlist/egx.txt.
"""
from __future__ import annotations
from typing import Any, Dict, List, Set

# Sector metadata: market cap weight (%), value traded (LE), volume, market cap (LE)
EGX_SECTOR_META: Dict[str, Dict[str, Any]] = {
    "banks": {
        "market_cap_weight": 24.25,
        "market_cap_le": 764_739_680_138,
        "value_le": 535_771_978,
        "value_pct": 9.30,
        "volume": 7_178_860,
        "volume_pct": 0.35,
    },
    "basic_resources": {
        "market_cap_weight": 15.96,
        "market_cap_le": 503_377_840_279,
        "value_le": 943_626_902,
        "value_pct": 16.38,
        "volume": 34_419_148,
        "volume_pct": 1.70,
    },
    "healthcare_and_pharma": {
        "market_cap_weight": 3.02,
        "market_cap_le": 95_339_365_687,
        "value_le": 362_201_314,
        "value_pct": 6.29,
        "volume": 168_389_924,
        "volume_pct": 8.29,
    },
    "industrial_goods_and_services": {
        "market_cap_weight": 6.58,
        "market_cap_le": 207_482_953_267,
        "value_le": 94_232_268,
        "value_pct": 1.64,
        "volume": 35_123_104,
        "volume_pct": 1.73,
    },
    "real_estate": {
        "market_cap_weight": 11.89,
        "market_cap_le": 374_996_430_009,
        "value_le": 1_328_214_860,
        "value_pct": 23.06,
        "volume": 1_069_999_779,
        "volume_pct": 52.70,
    },
    "travel_and_leisure": {
        "market_cap_weight": 0.85,
        "market_cap_le": 26_710_170_478,
        "value_le": 45_559_591,
        "value_pct": 0.79,
        "volume": 5_080_616,
        "volume_pct": 0.25,
    },
    "utilities": {
        "market_cap_weight": 0.75,
        "market_cap_le": 23_686_451_422,
        "value_le": 8_432_609,
        "value_pct": 0.15,
        "volume": 446_683,
        "volume_pct": 0.02,
    },
    "it_media_and_communication": {
        "market_cap_weight": 9.36,
        "market_cap_le": 295_321_450_209,
        "value_le": 397_424_046,
        "value_pct": 6.90,
        "volume": 87_306_677,
        "volume_pct": 4.30,
    },
    "food_beverages_and_tobacco": {
        "market_cap_weight": 8.15,
        "market_cap_le": 256_955_059_857,
        "value_le": 307_973_960,
        "value_pct": 5.35,
        "volume": 72_721_257,
        "volume_pct": 3.58,
    },
    "energy_and_support_services": {
        "market_cap_weight": 0.68,
        "market_cap_le": 21_314_790_445,
        "value_le": 110_033_851,
        "value_pct": 1.91,
        "volume": 12_513_370,
        "volume_pct": 0.62,
    },
    "trade_and_distributors": {
        "market_cap_weight": 1.10,
        "market_cap_le": 34_759_558_266,
        "value_le": 103_562_606,
        "value_pct": 1.80,
        "volume": 12_208_009,
        "volume_pct": 0.60,
    },
    "shipping_and_transportation": {
        "market_cap_weight": 3.22,
        "market_cap_le": 101_692_038_998,
        "value_le": 73_947_527,
        "value_pct": 1.28,
        "volume": 3_412_518,
        "volume_pct": 0.17,
    },
    "education_services": {
        "market_cap_weight": 1.48,
        "market_cap_le": 46_606_969_683,
        "value_le": 13_224_589,
        "value_pct": 0.23,
        "volume": 9_489_540,
        "volume_pct": 0.47,
    },
    "non_bank_financial_services": {
        "market_cap_weight": 6.91,
        "market_cap_le": 217_831_009_414,
        "value_le": 828_813_172,
        "value_pct": 14.39,
        "volume": 267_507_864,
        "volume_pct": 13.18,
    },
    "contracting_and_construction": {
        "market_cap_weight": 2.13,
        "market_cap_le": 67_067_682_370,
        "value_le": 242_741_327,
        "value_pct": 4.21,
        "volume": 181_352_942,
        "volume_pct": 8.93,
    },
    "textiles_and_durables": {
        "market_cap_weight": 1.10,
        "market_cap_le": 34_831_779_103,
        "value_le": 81_577_559,
        "value_pct": 1.42,
        "volume": 29_970_788,
        "volume_pct": 1.48,
    },
    "building_materials": {
        "market_cap_weight": 2.39,
        "market_cap_le": 75_364_203_134,
        "value_le": 273_177_371,
        "value_pct": 4.74,
        "volume": 12_115_171,
        "volume_pct": 0.60,
    },
    "paper_and_packaging": {
        "market_cap_weight": 0.18,
        "market_cap_le": 5_803_552_401,
        "value_le": 9_590_748,
        "value_pct": 0.17,
        "volume": 21_227_330,
        "volume_pct": 1.04,
    },
}

# Sector mapping: sector name -> set of ticker symbols (without EGX: prefix)
EGX_SECTORS: Dict[str, Set[str]] = {

    "banks": {
        "CANA",  # Suez Canal Bank
        "EXPA",  # Export Development Bank
        "CIEB",  # Credit Agricole Egypt
        "SAUD",  # Al Baraka Bank
        "UBEE",  # The United Bank
        "EGBE",  # Egyptian Gulf Bank
        "HDBK",  # Housing & Development Bank
        "FAIT",  # Faisal Islamic Bank
        "FAITA", # Faisal Islamic Bank (USD)
        "QNBE",  # QNB Alahli
        "COMI",  # CIB
        "ADIB",  # ADIB Egypt
    },

    "basic_resources": {
        "ATQA",  # Misr National Steel - Ataqa
        "MICH",  # Misr Chemical Industries
        "KZPC",  # Kafr El Zayat Pesticides
        "ASCM",  # ASEC Company For Mining - ASCOM
        "SKPC",  # Sidi Kerir Petrochemicals - SIDPEC
        "ISMQ",  # Iron And Steel for Mines and Quarries
        "EGCH",  # Egyptian Chemical Industries (Kima)
        "EFIC",  # Egyptian Financial & Industrial
        "IRON",  # Egyptian Iron & Steel
        "ALUM",  # Arab Aluminum
        "MFPC",  # Misr Fertilizers Production Company - Mopco
        "EGAL",  # Egypt Aluminum
        "ABUK",  # Abou Kir Fertilizers
    },

    "healthcare_and_pharma": {
        "MIPH",  # Minapharm Pharmaceuticals
        "RMDA",  # Rameda
        "BIOC",  # Glaxo Smith Kline	
        "AXPH",  # Alexandria Pharmaceuticals
        "OCPH",  # October Pharma
        "APPC",  # Arab Pharmaceuticals
        "SIPC",  # Sabaa International Company
        "MCRO",  # Macro Group Pharmaceuticals
        "ISPH",  # Ibnsina Pharma
        "SPMD",  # Speed Medical
        "CPCI",  # Cairo Pharmaceuticals
        "PRMH",  # Premium HealthCare Group
        "MPCI",  # Memphis Pharmaceuticals
        "NIPH",  # El-Nile Pharmaceuticals
        "NINH",  # Nozha International Hospital
        "AMES",  # Alexandria New Medical Center
        "CLHO",  # Cleopatra Hospital Company
        "PHAR",  # EIPICO
    },

    "industrial_goods_and_services": {
        "ENGC",  # El Arabia Engineering Industries
        "SWDY",  # Elsewedy Electric
        "GDWA",  # Gadwa For Industrial Development
        "DTPP",  # Delta Printing & Packaging
        "ELEC",  # Electro Cable Egypt
        "GBCO",  # GB Corp
    },

    "real_estate": {
        "RREI",  # Arab Real Estate Investment CO.-ALICO
        "MAAL",  # Egyptian Gulf Marseilia
        "ELSH",  # El Shams Housing
        "AREH",  # Egyptian Real Estate Group
        "ORHD",  # Orascom Development Egypt
        "GIHD",  # Gharbia Islamic Housing Development
        "MASR",  # Madinet Masr
        "OCDI",  # SODIC
        "EMFD",  # Emaar Misr
        "TMGH",  # Talaat Moustafa Group
        "PHDC",  # Palm Hills
        "HELI",  # Heliopolis Housing
        "ZMID",  # Zahraa Maadi
        "ADRI",  # Arab Developers Holding
        "IDRE",  # Ismailia Development
        "AMER",  # Amer Group
        "OBRI",  # El Obour Real Estate
        "PRDC",  # Pioneers Properties
        "UEGC",  # ElSaeed Contracting
        "ELKA",  # El Kahera Housing
    },

    "travel_and_leisure": {
        "MHOT",  # Misr Hotels
        "MMAT",  # Marsa Marsa Alam For Tourism Development
        "SDTI",  # Sharm Dreams Co. for Tourism Investment

```

### Core Architecture Module: `src/tradingview_mcp/core/errors.py`
```
"""
Structured error envelope and exception types for tradingview-mcp.

All recoverable failures return a typed error envelope:

    {"error": {"code": "<CODE>", "message": "<human-readable>", **extras}}

Use :func:`make_error` to construct envelopes and :func:`is_error` to check
them. Service layers may also raise typed exceptions (e.g.
:class:`BatchExecutionError`) which the MCP tool wrapper layer converts to the
same envelope shape so MCP clients see a uniform error API.

Migration notes
---------------
- Tools that adopt this format return ``dict`` (the envelope) on error and
  their normal type on success — the static return type becomes a union.
- Callers must check ``isinstance(result, dict) and "error" in result``
  instead of substring-matching previous ``{"error": "Analysis failed: ..."}``
  strings.
- Adoption is opt-in per tool; see PR notes for the current opt-in set.
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Union


class ErrorCode(str, Enum):
    """Stable string codes for programmatic branching by MCP clients.

    Values are plain strings so they survive JSON serialization without
    extra encoding, and so they can be compared against literals like
    ``code == "ALL_BATCHES_FAILED"`` from any language.
    """

    # Input / validation
    SYMBOL_NOT_FOUND = "SYMBOL_NOT_FOUND"
    INVALID_EXCHANGE = "INVALID_EXCHANGE"
    INVALID_TIMEFRAME = "INVALID_TIMEFRAME"
    INVALID_PARAMETER = "INVALID_PARAMETER"

    # Upstream (TradingView / Yahoo / RSS feeds)
    UPSTREAM_RATE_LIMIT = "UPSTREAM_RATE_LIMIT"
    UPSTREAM_TIMEOUT = "UPSTREAM_TIMEOUT"
    UPSTREAM_ERROR = "UPSTREAM_ERROR"
    ALL_BATCHES_FAILED = "ALL_BATCHES_FAILED"

    # Data
    NO_DATA = "NO_DATA"
    PARTIAL_DATA = "PARTIAL_DATA"

    # Environment
    DEPENDENCY_MISSING = "DEPENDENCY_MISSING"
    INTERNAL_ERROR = "INTERNAL_ERROR"


def make_error(code: Union[ErrorCode, str], message: str, **extra: Any) -> dict[str, Any]:
    """Construct a structured error envelope.

    Args:
        code: An :class:`ErrorCode` value or its raw string form. Accepting
            plain strings keeps the helper usable from code that doesn't want
            to import the enum (and from external contributions adopting the
            envelope shape).
        message: Human-readable description suitable for showing to a user.
        **extra: Additional structured fields — e.g. ``retry_after_s=30``,
            ``batches_attempted=5``, ``first_error="..."``, ``symbol="AAPL"``.

    Returns:
        ``{"error": {"code": ..., "message": ..., **extra}}``
    """
    code_str = code.value if isinstance(code, ErrorCode) else str(code)
    err: dict[str, Any] = {"code": code_str, "message": message}
    if extra:
        err.update(extra)
    return {"error": err}


def is_error(payload: Any) -> bool:
    """True if *payload* is an error envelope produced by :func:`make_error`.

    Checks both the outer ``"error"`` key and the inner ``"code"`` to avoid
    false positives against legacy string-error payloads (which had
    ``payload["error"]`` as a string, not a dict).
    """
    return (
        isinstance(payload, dict)
        and isinstance(payload.get("error"), dict)
        and "code" in payload["error"]
    )


class ScreenerServiceError(RuntimeError):
    """Typed service-layer failure carrying an :class:`ErrorCode`.

    Subclasses ``RuntimeError`` deliberately: the pre-envelope service guards
    raised bare ``RuntimeError``, so any external caller with
    ``except RuntimeError`` keeps working unchanged while the MCP boundary
    gains a lossless translation to the structured envelope.

    Attributes:
        code:  Stable :class:`ErrorCode` for programmatic branching.
        extra: Structured context merged into the envelope
               (e.g. ``exchange="EGX"``, ``retryable=True``).
    """

    def __init__(self, code: Union[ErrorCode, str], message: str, **extra: Any) -> None:
        super().__init__(message)
        self.code = code
        self.extra = extra

    def to_envelope(self) -> dict[str, Any]:
        return make_error(self.code, str(self), **self.extra)


class BatchExecutionError(Exception):
    """Raised by batched scanners when every batch failed.

    The service layer raises this so the MCP tool wrapper at the boundary
    can convert it to an :func:`make_error` envelope with full context.
    Callers must not swallow it silently — that defeats the whole point of
    the sentinel.

    Attributes:
        batches_attempted: How many batches were issued to upstream.
        batches_failed: How many of those failed
            (equals ``batches_attempted`` whenever this is raised).
        first_error: ``repr()`` of the first exception observed across the
            batch loop, kept verbatim for debugging.
    """

    def __init__(
        self,
        batches_attempted: int,
        batches_failed: int,
        first_error: str,
    ) -> None:
        super().__init__(
            f"All {batches_attempted} batches failed; first error: {first_error}"
        )
        self.batches_attempted = batches_attempted
        self.batches_failed = batches_failed
        self.first_error = first_error


class PartialDataError(Exception):
    """Raised when a batched scan aborted early but still produced rows.

    Wall-clock budgets and consecutive-failure bails used to return a plain
    truncated list, indistinguishable from a complete scan — the abort reason
    went only to stderr. This carries the partial rows plus scan telemetry so
    the MCP boundary can return them WITH a PARTIAL_DATA envelope.

    Attributes:
        rows: The rows collected before the abort (already sorted/truncated).
        batches_attempted / total_batches: Scan progress at abort time.
        aborted_reason: Human-readable cause ("wall-clock budget…", …).
    """

    def __init__(
        self,
        rows: list,
        batches_attempted: int,
        total_batches: int,
        aborted_reason: str,
    ) -> None:
        super().__init__(
            f"Partial scan: {batches_attempted}/{total_batches} batches before abort "
            f"({aborted_reason})"
        )
        self.rows = rows
        self.batches_attempted = batches_attempted
        self.total_batches = total_batches
        self.aborted_reason = aborted_reason


def exception_to_envelope(exc: BaseException, *, context: str = "") -> dict[str, Any]:
    """Translate any exception into the structured envelope at the MCP boundary.

    ``retryable`` semantics: batched-scan wipeouts are storms that pass, so
    they are marked retryable; unexpected exceptions are not (retrying the
    same bug yields the same crash).

    Args:
        exc:     The caught exception.
        context: Tool name prefixed to unexpected-exception messages so the
                 envelope stays diagnosable without a traceback.
    """
    if isinstance(exc, ScreenerServiceError):
        return exc.to_envelope()
    if isinstance(exc, PartialDataError):
        env = make_error(
            ErrorCode.PARTIAL_DATA, str(exc),
            batches_attempted=exc.batches_attempted,
            total_batches=exc.total_batches,
            aborted_reason=exc.aborted_reason,
            retryable=True,
        )
        # Partial rows ride alongside the error so callers keep the data.
        env["rows"] = exc.rows
        return env
    if isinstance(exc, BatchExecutionError):
        return make_error(
            ErrorCode.ALL_BATCHES_FAILED, str(exc),
            batches_attempted=exc.batches_attempted,
            batches_failed=exc.batches_failed,
            first_error=exc.first_error,
            retryable=True,
        )
    msg = f"{context} failed: {exc!r}" if context else repr(exc)
    return make_error(ErrorCode.INTERNAL_ERROR, msg, retryable=False)

```

### Core Architecture Module: `src/tradingview_mcp/core/services/bitcoin_market_service.py`
```
"""
Bitcoin Market Pulse — single-call macro context for crypto questions.

Why this exists: when a user asks Claude "should I buy SOL?" the right answer
isn't just SOL's chart — it's also "what is BTC doing, and is dominance rising
or falling?". A SOL setup that looks great in isolation can be a death trap
when BTC is dumping and dominance is climbing (capital flight to BTC, alts
bleed regardless of their own technicals).

This service collapses that whole macro check into ONE call. Returns:
  - BTC price + 24h change
  - BTC dominance + market-cap percentage trend
  - Total crypto market cap + 24h change
  - A one-paragraph risk assessment Claude can quote directly to the user

Data source: CoinGecko public API. Free tier, no API key required.
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error

_TIMEOUT = 10
_UA = "tradingview-mcp/0.8.0"
_GLOBAL_URL = "https://api.coingecko.com/api/v3/global"
_PRICE_URL = (
    "https://api.coingecko.com/api/v3/simple/price"
    "?ids=bitcoin&vs_currencies=usd"
    "&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true"
)


def _http_get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": _UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _classify_risk(btc_change_24h: float, btc_dominance: float, total_mcap_change_24h: float) -> tuple[str, str]:
    """Map (btc trend, dominance, broader market) -> label + reasoning paragraph.

    Bands chosen from years of crypto behavior, not statistical fit:
    - Dominance > 55: BTC sucks oxygen out of alts.
    - Dominance < 45: alt-favorable. Classic late-bull / altseason setup.
    - BTC +/- 2% / 24h: noise. >5%: meaningful directional move.
    """
    btc_volatile = abs(btc_change_24h) > 5
    dom_high = btc_dominance > 55
    dom_low = btc_dominance < 45

    if btc_volatile and btc_change_24h < 0:
        return ("HIGH_RISK",
            f"BTC is down {btc_change_24h:.1f}% in 24h - that's a meaningful move, not noise. "
            f"Dominance at {btc_dominance:.1f}% means alts are likely bleeding harder than the headline. "
            f"Total crypto market cap is {total_mcap_change_24h:+.1f}% on the day. "
            f"Tight stops or sit-out on alt entries until BTC stabilizes.")
    if btc_volatile and btc_change_24h > 0:
        rotation = ("BTC is leading, alts may lag this leg." if dom_high
                    else "alts probably ripping harder - late-bull behavior." if dom_low
                    else "balanced rotation, both moving together.")
        return ("OPPORTUNITY_WITH_CAUTION",
            f"BTC is up {btc_change_24h:.1f}% in 24h - strong move. "
            f"Dominance at {btc_dominance:.1f}%: {rotation} "
            f"Total market cap {total_mcap_change_24h:+.1f}%.")
    if dom_high and btc_change_24h < -1.5:
        return ("ALT_RISK",
            f"BTC dominance high ({btc_dominance:.1f}%) AND BTC soft ({btc_change_24h:+.1f}%/24h) - "
            "worst combo for altcoins. Capital is in BTC and BTC isn't holding. "
            "Alt longs face a double headwind regardless of individual setups.")
    if dom_low and btc_change_24h > 1.5:
        return ("ALT_FAVORABLE",
            f"BTC dominance low ({btc_dominance:.1f}%) and BTC up {btc_change_24h:+.1f}% - "
            "classic capital-rotation-into-alts pattern. Macro is permissive for strong alt setups.")
    return ("NEUTRAL",
        f"BTC {btc_change_24h:+.1f}%/24h, dominance {btc_dominance:.1f}%, "
        f"total mcap {total_mcap_change_24h:+.1f}%. No strong directional signal - "
        "individual chart setups carry most of the weight here.")


def get_bitcoin_market_pulse() -> dict:
    """Fetch BTC price + dominance + total market context in one call.

    Returns a structured dict Claude can quote/summarize. On any upstream failure,
    returns a partial result with an `error` field - never raises, since this is
    typically called as CONTEXT enrichment, not the user's primary question.
    """
    out: dict = {"source": "CoinGecko", "tool": "bitcoin_market_pulse"}

    try:
        gdata = _http_get_json(_GLOBAL_URL).get("data", {})
        dominance = gdata.get("market_cap_percentage", {}).get("btc")
        eth_dominance = gdata.get("market_cap_percentage", {}).get("eth")
        total_mcap_usd = gdata.get("total_market_cap", {}).get("usd")
        total_mcap_change_24h = gdata.get("market_cap_change_percentage_24h_usd")
        active_cryptos = gdata.get("active_cryptocurrencies")
    except (urllib.error.URLError, json.JSONDecodeError, KeyError) as e:
        return {**out, "error": f"global fetch failed: {type(e).__name__}: {e}"}

    try:
        pdata = _http_get_json(_PRICE_URL).get("bitcoin", {})
        btc_price = pdata.get("usd")
        btc_change_24h = pdata.get("usd_24h_change")
        btc_volume_24h = pdata.get("usd_24h_vol")
        btc_market_cap = pdata.get("usd_market_cap")
    except (urllib.error.URLError, json.JSONDecodeError, KeyError) as e:
        return {**out, "error": f"price fetch failed: {type(e).__name__}: {e}"}

    if all(v is not None for v in (btc_change_24h, dominance, total_mcap_change_24h)):
        risk_label, risk_text = _classify_risk(btc_change_24h, dominance, total_mcap_change_24h)
    else:
        risk_label, risk_text = "UNKNOWN", "Some metrics missing; cannot classify."

    return {
        **out,
        "bitcoin": {
            "price_usd": btc_price,
            "change_24h_pct": btc_change_24h,
            "volume_24h_usd": btc_volume_24h,
            "market_cap_usd": btc_market_cap,
        },
        "dominance": {"btc_pct": dominance, "eth_pct": eth_dominance},
        "total_market": {
            "market_cap_usd": total_mcap_usd,
            "change_24h_pct": total_mcap_change_24h,
            "active_cryptocurrencies": active_cryptos,
        },
        "assessment": {"label": risk_label, "summary": risk_text},
    }

```

### Core Architecture Module: `src/tradingview_mcp/core/services/coinlist.py`
```
from __future__ import annotations
import os
from functools import lru_cache
from typing import Dict, FrozenSet, List
from ..utils.validators import COINLIST_DIR


def load_symbols(exchange: str) -> List[str]:
    """Load symbols for a given exchange, with multiple fallback strategies.

    Cached per exchange (the coinlist files ship with the package and don't
    change at runtime) — every scan used to re-read and re-parse the file.
    Returns a fresh copy so callers can't poison the cache by mutating it.
    """
    return list(_load_symbols_cached(exchange))


@lru_cache(maxsize=64)
def _load_symbols_cached(exchange: str) -> tuple:
    # Try multiple possible paths
    possible_paths = [
        os.path.join(COINLIST_DIR, f"{exchange}.txt"),
        os.path.join(COINLIST_DIR, f"{exchange.lower()}.txt"),
        # Fallback: relative to this file
        os.path.join(os.path.dirname(__file__), "..", "..", "coinlist", f"{exchange}.txt"),
        # Another fallback
        os.path.join(os.path.dirname(__file__), "..", "..", "coinlist", f"{exchange.lower()}.txt")
    ]
    
    for path in possible_paths:
        try:
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                symbols = tuple(line.strip() for line in content.split('\n') if line.strip())
                if symbols:  # Only return if we actually got symbols
                    return symbols
        except (FileNotFoundError, IOError, UnicodeDecodeError):
            continue

    # If all fails, return empty tuple
    return ()


# "all.txt" is an aggregate of every exchange — suggesting it as an exchange
# would send the model straight back into an invalid `exchange` value.
_SUGGESTION_EXCLUDE = {"all"}


@lru_cache(maxsize=1)
def _coinlist_index() -> Dict[str, FrozenSet[str]]:
    """EXCHANGE (upper) -> frozenset of its listed symbols, from local files.

    Built once per process (the coinlist directory ships with the package and
    doesn't change at runtime). Used only on error paths, so the one-time
    directory scan is not on any hot path.
    """
    index: Dict[str, FrozenSet[str]] = {}
    try:
        names = os.listdir(COINLIST_DIR)
    except OSError:
        return index
    for name in names:
        if not name.endswith(".txt"):
            continue
        exch = name[:-4]
        if exch.lower() in _SUGGESTION_EXCLUDE:
            continue
        try:
            with open(os.path.join(COINLIST_DIR, name), "r", encoding="utf-8") as f:
                # Lines ship as "EXCHANGE:TICKER" (e.g. "KUCOIN:HYPEUSDT");
                # index the bare ticker so lookups match either input form.
                symbols = frozenset(
                    line.strip().upper().split(":")[-1]
                    for line in f
                    if line.strip()
                )
        except (OSError, UnicodeDecodeError):
            continue
        if symbols:
            index[exch.upper()] = symbols
    return index


def exchanges_listing_symbol(symbol: str, max_results: int = 6) -> List[str]:
    """Exchanges (per the local coinlists) where *symbol* is listed.

    Zero network cost — reads only the bundled coinlist files. Accepts bare
    tickers ("HYPEUSDT") or prefixed ones ("BINANCE:HYPEUSDT"). Returns
    exchange names sorted alphabetically, capped at *max_results*; empty list
    when the ticker appears in no local list (likely a typo or an unsupported
    venue).
    """
    bare = symbol.strip().upper().split(":")[-1]
    if not bare:
        return []
    matches = sorted(
        exch for exch, symbols in _coinlist_index().items() if bare in symbols
    )
    return matches[:max_results]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6** (2026-03-28): **[BUG]**
  *Symptoms*: This appears to only support KUCOIN, and doesn't look at my tradingview AT ALL.  <img width="660" height="378" alt="Image" src="https://github.com/user-attachments/assets/4c288180-6869-4c86-9fb5-30580f90674c" />
  **Post-Mortem & Fix Analysis**:
  > Thank you for the report! The hardcoded crypto market type issue has been fixed in PR #11 (now released in v0.4.0). The framework now dynamically supports individual stocks across various exchanges including NASDAQ, NYSE, BIST, and EGX.  Please note that S&P 500 (SPX) is an index, rather than an individual stock ticker, so it cannot be queried directly through the standard stock screeners yet. We are tracking broad index support as a separate feature request.  Closing this issue as the primary crypto-only limitation has been successfully resolved!

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

### Incident Patch 1: `c46d99ae` (2026-08-31)
**Commit Message**: fix: scan the full symbol universe and make momentum conditions mandatory

fetch_bollinger_analysis and scan_consecutive_candles truncated the symbol list (limit*2 / min(limit*3, 200)), silently screening only the alphabetical head of the exchange. Both now scan the full list in 200-symbol batches, tolerating per-batch failures. The momentum gate required only 3 of 5 conditions, letting a flat bar pass; all conditions are now mandatory, RSI/SMA null handling is explicit, and the payload declares its single-bar basis.

**File**: `src/tradingview_mcp/core/services/screener_service.py` (modified, +48/-19)
```diff
@@ -136,19 +136,28 @@ def fetch_bollinger_analysis(
             exchange=exchange, retryable=False,
         )
 
-    symbols = symbols[: limit * 2]
+    # Scan the FULL symbol list in batches. The old `symbols[: limit * 2]`
+    # truncation meant only the alphabetical head of the exchange was ever
+    # screened — on EGX (292 names, sorted) mid-alphabet symbols could never
+    # appear in squeeze results regardless of their setups.
     screener = EXCHANGE_SCREENER.get(exchange, "crypto")
-
-    try:
-        analysis = get_multiple_analysis(screener=screener, interval=timeframe, symbols=symbols)
-    except Exception as exc:
-        # Single-shot fetch (no batching here): a failure is an upstream
-        # problem, and TradingView storms pass — mark it retryable.
+    analysis: dict = {}
+    batch_errors = 0
+    batch_size = 200
+    for i in range(0, len(symbols), batch_size):
+        batch = symbols[i : i + batch_size]
+        try:
+            analysis.update(
+                get_multiple_analysis(screener=screener, interval=timeframe, symbols=batch)
+            )
+        except Exception:
+            batch_errors += 1
+    if not analysis:
         raise ScreenerServiceError(
             ErrorCode.UPSTREAM_ERROR,
-            f"Analysis failed: {humanize_upstream_error(exc)}",
+            "Analysis failed for every batch — upstream storm; retry shortly.",
             retryable=True,
-        ) from exc
+        )
 
     rows: List[Row] = []
     for key, value in analysis.items():
@@ -872,15 +881,23 @@ def scan_consecutive_candles(
     if not symbols:
         return {"error": f"No symbols found for exchange: {exchange}", "exchange": exchange, "timeframe": timeframe}
 
-    symbols = symbols[: min(limit * 3, 200)]
+    # Full-universe batched scan (the old `symbols[: min(limit*3, 200)]`
+    # truncation silently limited the screen to the alphabetical head).
     screener = EXCHANGE_SCREENER.get(exchange, "crypto")
-
-    try:
-        analysis = get_multiple_analysis(screener=screener, interval=timeframe, symbols=symbols)
-    except Exception as exc:
+    analysis: dict = {}
+    batch_size = 200
+    for i in range(0, len(symbols), batch_size):
+        batch = symbols[i : i + batch_size]
+        try:
+            analysis.update(
+                get_multiple_analysis(screener=screener, interval=timeframe, symbols=batch)
+            )
+        except Exception:
+            continue
+    if not analysis:
         return make_error(
             ErrorCode.UPSTREAM_ERROR,
-            f"Pattern analysis failed: {humanize_upstream_error(exc)}",
+            "Pattern analysis failed for every batch — upstream storm; retry shortly.",
             retryable=True, retry_after_s=60,
             exchange=exchange, timeframe=timeframe,
         )
@@ -906,13 +923,20 @@ def scan_consecutive_candles(
             candle_range = high_price - low_price
             body_to_range_ratio = candle_body / candle_range if candle_range > 0 else 0
 
-            rsi = indicators.get("RSI", 50)
-            sma20 = indicators.get("SMA20", close_price)
-            ema50 = indicators.get("EMA50", close_price)
+            # TradingView returns explicit nulls; .get defaults don't fire.
+            rsi = indicators.get("RSI")
+            rsi = 50.0 if rsi is None else rsi
+            sma20 = indicators.get("SMA20") or close_price
+            ema50 = indicators.get("EMA50") or close_price
 
             price_above_sma = close_price > sma20
             price_above_ema = close_price > ema50
 
+            # ALL conditions are mandatory. The old 3-of-5 vote let a FLAT bar
+            # pass (body + SMA + RSI + volume = 4/5 with zero price change),
+            # so the scanner fired on any mildly green day and polluted the
+            # candidates composite with hollow hits. `volume > 1000` shares is
+            # a crypto-era placeholder kept only as a dead-ticker floor.
             if pattern_type == "bullish":
   
```

---

### Incident Patch 2: `910c9293` (2026-08-31)
**Commit Message**: fix: keep Bollinger band breakouts on their own side of the signal

A close beyond the upper/lower band (rating +/-3) mapped to NEUTRAL, so the strongest reading this measure produces registered as a downgrade in signal-change consumers. Ratings >= 2 now map to BUY and <= -2 to SELL.

**File**: `src/tradingview_mcp/core/services/indicators.py` (modified, +5/-2)
```diff
@@ -28,10 +28,13 @@ def compute_bb_rating_signal(close: float, bb_upper: float, bb_middle: float, bb
     elif close < bb_middle:
         rating = -1
 
+    # A close beyond the band (|rating| == 3) is the strongest reading this
+    # measure produces — it must stay on its own side, never fall back to
+    # NEUTRAL (a breakout day previously read as a downgrade in signal_change).
     signal = "NEUTRAL"
-    if rating == 2:
+    if rating >= 2:
         signal = "BUY"
-    elif rating == -2:
+    elif rating <= -2:
         signal = "SELL"
     return rating, signal
 
```

---

### Incident Patch 3: `637b41be` (2026-08-28)
**Commit Message**: fix: ignore Yahoo's frozen quote block and price from the candle series

Yahoo serves a stale meta quote for some venues while the chart series stays
current. Every EGX (.CA) symbol returns regularMarketTime = 2024-07-23 with a
regularMarketPrice from that day (regularMarketDayHigh/Low/Volume are all
None), while the daily closes are current. Formatting a quote compared the
2024 price against a 2026 close and invented moves: CCAP.CA reported price 2.2
against its real 5.75 close as "-61.74%", MENA.CA "-76.3%", GBCO.CA "-50.86%".
BTFH.CA looked plausible only because its 2024 price sat near today's - the
corruption was invisible on some symbols and severe on others.

_format_quote now detects a stale quote (regularMarketTime lagging the newest
candle by more than a day, or a missing quote price) and takes price and
previous close from the candle series instead, which stays current. Fresh
quotes are still preferred so intraday moves are not lost. The chosen basis is
exposed as `price_source` ("quote" | "candle_close") and `quote_stale`.

Also widen the quote window from 2d to 5d: when the newest session has no
trades yet its close is None, leaving a 2-day window with a single usable


**File**: `src/tradingview_mcp/core/services/yahoo_finance_service.py` (modified, +71/-18)
```diff
@@ -41,41 +41,92 @@
 # ─── Shared helpers ─────────────────────────────────────────────────────────
 
 
-def _quote_url(symbol: str) -> str:
-    return f"{_BASE}/{symbol}?interval=1d&range=2d"
+# 5 days (not 2): when the newest session has no trades yet its close is None,
+# and a 2-day window then leaves only ONE usable close — too few to derive a
+# previous close, which used to fall back to chartPreviousClose (the same bar)
+# and report a 0% or nonsense move.
+_QUOTE_RANGE = "5d"
 
+# How far meta.regularMarketTime may lag the newest candle before the whole
+# quote block is treated as stale. One day covers normal intraday lag.
+_STALE_QUOTE_SECONDS = 86_400
 
-def _get_previous_close(chart_result: dict) -> Optional[float]:
-    """Extract previous trading day's close from candle data.
 
-    The meta fields 'previousClose' and 'chartPreviousClose' are unreliable:
-    - 'previousClose' is often None
-    - 'chartPreviousClose' returns the chart range start price, not yesterday's close
+def _quote_url(symbol: str) -> str:
+    return f"{_BASE}/{symbol}?interval=1d&range={_QUOTE_RANGE}"
 
-    Instead, we use the actual close prices from the 2-day candle data.
-    With range=2d, indicators.quote[0].close gives [prev_day_close, today_close].
-    """
+
+def _valid_closes(chart_result: dict) -> list[float]:
+    """Daily closes with empty (None) candles dropped, oldest first."""
     try:
         closes = chart_result.get("indicators", {}).get("quote", [{}])[0].get("close", [])
-        # Filter out None values (can happen for incomplete candles)
-        valid_closes = [c for c in closes if c is not None]
-        if len(valid_closes) >= 2:
-            return valid_closes[-2]
+        return [c for c in closes if c is not None]
     except (IndexError, TypeError, KeyError):
-        pass
-    # Fallback to meta fields if candle data unavailable
+        return []
+
+
+def _quote_is_stale(chart_result: dict) -> bool:
+    """True when meta's quote block is older than the candle data.
+
+    Yahoo serves a frozen quote block for some venues while the chart series
+    stays current — observed on every EGX (.CA) symbol, where
+    ``regularMarketTime`` sits at 2024-07-23 and ``regularMarketPrice`` is the
+    price from that day. Comparing that against a current close produced
+    fictional moves (CCAP.CA: 2.2 vs a real 5.75 close, reported as -61%).
+    ``regularMarketDayHigh``/``Low``/``Volume`` are None in that state too.
+    """
+    meta = chart_result.get("meta", {})
+    if meta.get("regularMarketPrice") is None:
+        return True
+    quote_ts = meta.get("regularMarketTime")
+    if quote_ts is None:
+        return True
+    timestamps = chart_result.get("timestamp") or []
+    if not timestamps:
+        return False
+    try:
+        return quote_ts < timestamps[-1] - _STALE_QUOTE_SECONDS
+    except TypeError:
+        return True
+
+
+def _get_previous_close(chart_result: dict) -> Optional[float]:
+    """Extract the previous trading day's close from candle data.
+
+    The meta fields are unreliable: 'previousClose' is often None and
+    'chartPreviousClose' returns the chart range's start price rather than
+    yesterday's close.
+    """
+    closes = _valid_closes(chart_result)
+    if len(closes) >= 2:
+        return closes[-2]
     meta = chart_result.get("meta", {})
     return meta.get("previousClose") or meta.get("chartPreviousClose")
 
 
 def _format_quote(symbol: str, chart_result: dict) -> dict:
     """Pure formatter — no I/O. Shared by sync and async paths."""
     meta = chart_result.get("meta", {})
-    price = meta.get("regularMarketPrice")
+    closes = _valid_closes(chart_result)
+    stale = _quote_is_stale(chart_result)
+
+    if stale and closes:
+        # Fall back to the candle series, which stays current. Candle closes
+        # arrive as float32 (6.900000095367432) — round so callers and the
+        # wire format show a real price.
+        price = round(closes[-1], 4)
+   
```

**File**: `tests/unit/services/test_yahoo_stale_quote.py` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+"""Regression tests for Yahoo's frozen quote block.
+
+Yahoo serves a stale meta quote for some venues while the candle series stays
+current. Observed 2026-08-28 on every EGX (.CA) symbol: ``regularMarketTime``
+stuck at 2024-07-23 with ``regularMarketPrice`` from that day, while the daily
+closes were current. Comparing the two produced fictional moves — CCAP.CA
+reported price 2.2 against a real 5.75 close, i.e. "-61.74%".
+"""
+from __future__ import annotations
+
+from tradingview_mcp.core.services.yahoo_finance_service import _format_quote
+
+# 2024-07-23 20:00 UTC — the frozen timestamp Yahoo returns for EGX symbols.
+STALE_TS = 1721764800
+# Late-August 2026 daily bars.
+FRESH_TS = [1756080000, 1756166400, 1756252800, 1756339200, 1756425600]
+
+
+def _chart(closes, *, quote_price, quote_ts, timestamps=None):
+    return {
+        "meta": {
+            "regularMarketPrice": quote_price,
+            "regularMarketTime": quote_ts,
+            "currency": "EGP",
+            "chartPreviousClose": closes[0] if closes else None,
+        },
+        "timestamp": timestamps if timestamps is not None else FRESH_TS[: len(closes)],
+        "indicators": {"quote": [{"close": closes}]},
+    }
+
+
+def test_stale_quote_falls_back_to_candle_closes():
+    """CCAP.CA shape: 2024 quote price must not be compared to a 2026 close."""
+    chart = _chart([5.60, 5.78, 5.71, 5.83, 5.75], quote_price=2.2, quote_ts=STALE_TS)
+    q = _format_quote("CCAP.CA", chart)
+
+    assert q["quote_stale"] is True
+    assert q["price_source"] == "candle_close"
+    assert q["price"] == 5.75                 # newest close, not the 2024 quote
+    assert q["previous_close"] == 5.83
+    assert q["change_pct"] == -1.37           # a real one-day move
+    # The bug produced roughly -61%; anything near that is a regression.
+    assert abs(q["change_pct"]) < 20
+
+
+def test_stale_quote_with_empty_newest_candle():
+    """Session with no trades yet: newest candle is None, older closes remain."""
+    chart = _chart(
+        [6.94, 6.99, 7.00, 6.97, 6.90, None],
+        quote_price=1.635,
+        quote_ts=STALE_TS,
+        timestamps=FRESH_TS + [1756512000],
+    )
+    q = _format_quote("MENA.CA", chart)
+    assert q["price"] == 6.90
+    assert q["previous_close"] == 6.97
+    assert abs(q["change_pct"]) < 5
+
+
+def test_fresh_quote_is_trusted():
+    """Normal venue: a current quote still drives price (intraday moves matter)."""
+    fresh_ts = FRESH_TS[-1] + 3600
+    chart = _chart([150.0, 152.5], quote_price=153.75, quote_ts=fresh_ts,
+                   timestamps=FRESH_TS[:2])
+    q = _format_quote("AAPL", chart)
+
+    assert q["quote_stale"] is False
+    assert q["price_source"] == "quote"
+    assert q["price"] == 153.75               # live price, not the candle close
+    assert q["previous_close"] == 150.0
+    assert q["change_pct"] == 2.5
+
+
+def test_missing_quote_price_uses_candles():
+    chart = _chart([10.0, 10.5], quote_price=None, quote_ts=None)
+    q = _format_quote("XYZ.CA", chart)
+    assert q["quote_stale"] is True
+    assert q["price"] == 10.5
+    assert q["previous_close"] == 10.0
+
+
+def test_single_close_leaves_change_none():
+    """One usable close: report the price but never invent a change."""
+    chart = _chart([5.75], quote_price=2.2, quote_ts=STALE_TS)
+    q = _format_quote("CCAP.CA", chart)
+    assert q["price"] == 5.75
+    assert q["previous_close"] is None
+    assert q["change"] is None
+    assert q["change_pct"] is None
```

---

### Incident Patch 4: `1a1cb6e3` (2026-08-28)
**Commit Message**: fix: anchor trade-setup stop/targets/R:R to each scenario's own entry

compute_trade_setup derived entries from EMA20/nearest-resistance while the
stop-loss and risk/reward stayed anchored to the close. The two anchors could
cross: on stocks trading well above their EMA20 the suggested pullback entry
landed BELOW its own stop (observed live on EGX:CCAP - entry 5.49, stop 5.50,
R:R 0.10), and R:R graded a trade nobody planned to take, false-rejecting
EGX:COMI's valid pullback at 1.9 when entry-anchored math gives 2.87.

Each entry is now a self-contained scenario: the stop sits below THAT
scenario's entry (tighter of nearest-support minus 0.5*ATR, or entry minus
1.5*ATR), targets must sit strictly above it, and R:R is measured from it.
Legacy top-level stop_loss/targets/risk_reward mirror the primary scenario so
they always describe one coherent trade; per-scenario plans are exposed under
`scenarios` with `primary_scenario` naming the chosen one, and
`risk_reward.measured_from_entry` makes the basis explicit. Falls back to a
coherent at-market scenario when no S/R levels exist.

Invariant now holds for every scenario: stop < entry < target_1.
Covered by tests/unit/services/test_trad

**File**: `src/tradingview_mcp/core/services/egx_service.py` (modified, +6/-0)
```diff
@@ -569,6 +569,8 @@ def _pct_rank(val: float) -> float:
                         "stop_distance_pct": setup["stop_distance_pct"],
                         "targets": setup["targets"],
                         "risk_reward": setup["risk_reward"],
+                        "scenarios": setup.get("scenarios", {}),
+                        "primary_scenario": setup.get("primary_scenario"),
                         "supports": setup["supports"],
                         "resistances": setup["resistances"],
                     }
@@ -855,6 +857,8 @@ def _pct_rank(val: float) -> float:
                         "stop_distance_pct": setup["stop_distance_pct"],
                         "targets": setup["targets"],
                         "risk_reward": setup["risk_reward"],
+                        "scenarios": setup.get("scenarios", {}),
+                        "primary_scenario": setup.get("primary_scenario"),
                         "supports": setup["supports"],
                         "resistances": setup["resistances"],
                     }
@@ -979,6 +983,8 @@ def generate_egx_trade_plan(symbol: str, timeframe: str = "1D") -> dict:
             "stop_distance_pct": setup["stop_distance_pct"],
             "targets": setup["targets"],
             "risk_reward": setup["risk_reward"],
+            "scenarios": setup.get("scenarios", {}),
+            "primary_scenario": setup.get("primary_scenario"),
             "supports": setup["supports"],
             "resistances": setup["resistances"],
         }
```

**File**: `src/tradingview_mcp/core/services/indicators.py` (modified, +93/-32)
```diff
@@ -1205,7 +1205,12 @@ def compute_stock_score(indicators: Dict, change_pct_rank: Optional[float] = Non
 def compute_trade_setup(indicators: Dict) -> Optional[Dict]:
     """Generate entry points, stop-loss, targets, and S/R levels.
 
-    Only call this for stocks that pass the stock score threshold (>=70).
+    Every scenario (pullback / breakout / market-fallback) anchors its stop,
+    targets and R:R to ITS OWN entry price. The legacy top-level fields
+    (``stop_loss``, ``targets``, ``risk_reward``) mirror the primary scenario,
+    so entry/stop/targets/R:R always describe one coherent trade
+    (stop < entry < target_1 for longs). Per-scenario plans live under
+    ``scenarios`` with the chosen one named in ``primary_scenario``.
     """
     close = indicators.get("close")
     high = indicators.get("high")
@@ -1277,35 +1282,89 @@ def compute_trade_setup(indicators: Dict) -> Optional[Dict]:
     if pullback_entry:
         setup_types.append("pullback")
 
-    # ── Stop-Loss ─────────────────────────────────────────────────────────
-    # Tighter of: below nearest support by 0.5×ATR, or entry - 1.5×ATR
+    # ── Per-scenario stop / targets / R:R ────────────────────────────────
+    # Each scenario anchors everything to ITS OWN entry. (Previously the
+    # stop and R:R were anchored to the close while the entry came from
+    # EMA20/resistance — on stocks trading far above their EMA20 that
+    # produced plans whose entry sat BELOW the stop, and R:R numbers that
+    # graded a trade nobody planned to take.)
+
+    def _build_scenario(kind: str, raw_entry: float) -> Optional[Dict]:
+        entry = _safe_round(raw_entry, 2)
+        if not entry or entry <= 0:
+            return None
+
+        # Tighter of: 0.5×ATR below the nearest support UNDER the entry,
+        # or 1.5×ATR below the entry itself.
+        stop_candidates = [entry - 1.5 * atr]
+        sup_below = [s for s in supports if s < entry]
+        if sup_below:
+            stop_candidates.append(sup_below[0] - 0.5 * atr)
+        stop = _safe_round(max(stop_candidates), 2)
+        if stop is None or stop >= entry:
+            stop = _safe_round(entry - 1.0 * atr, 2)
+        if stop is None or stop >= entry or stop <= 0:
+            return None
+
+        stop_pct = ((entry - stop) / entry) * 100
+        if stop_pct < 0.5:  # unrealistically tight — widen to 1 ATR
+            stop = _safe_round(entry - 1.0 * atr, 2)
+            if stop is None or stop >= entry or stop <= 0:
+                return None
+            stop_pct = ((entry - stop) / entry) * 100
+
+        # Targets must sit strictly ABOVE this scenario's entry.
+        res_above = [r for r in resistances if r > entry]
+        target_1 = res_above[0] if res_above else _safe_round(entry + 1.5 * atr, 2)
+        target_2 = res_above[1] if len(res_above) >= 2 else _safe_round(entry + 3.0 * atr, 2)
+        if target_1 and target_2 and target_2 <= target_1:
+            target_2 = _safe_round(entry + 3.0 * atr, 2)
+
+        risk = entry - stop
+        rr_1 = _safe_round((target_1 - entry) / risk, 1) if target_1 else None
+        rr_2 = _safe_round((target_2 - entry) / risk, 1) if target_2 else None
 
-    atr_stop = _safe_round(close - 1.5 * atr, 2)
-    support_stop = None
-    if supports:
-        support_stop = _safe_round(supports[0] - 0.5 * atr, 2)
-
-    if support_stop and atr_stop:
-        stop_loss = max(support_stop, atr_stop)  # Tighter of the two
-    elif support_stop:
-        stop_loss = support_stop
-    else:
-        stop_loss = atr_stop
+        return {
+            "type": kind,
+            "entry": entry,
+            "stop_loss": stop,
+            "stop_distance_pct": _safe_round(stop_pct, 2),
+            "targets": {"target_1": target_1, "target_2": target_2},
+            "risk_reward": {"to_target_1": rr_1, "to_target_2": rr_2},
+        }
 
-    # Validate stop isn't unrealistically tight (<0.5% from close) or wide (>10%)
-    stop_pct = ((close 
```

**File**: `src/tradingview_mcp/core/services/screener_service.py` (modified, +2/-0)
```diff
@@ -776,6 +776,8 @@ def analyze_coin(
                         "stop_distance_pct": setup["stop_distance_pct"],
                         "targets": setup["targets"],
                         "risk_reward": setup["risk_reward"],
+                        "scenarios": setup.get("scenarios", {}),
+                        "primary_scenario": setup.get("primary_scenario"),
                         "supports": setup["supports"],
                         "resistances": setup["resistances"],
                     }
```

**File**: `tests/unit/services/test_trade_setup.py` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+"""Regression tests for compute_trade_setup's entry-anchored scenario math.
+
+The 2026-08 bug: entries came from EMA20/resistance while the stop and R:R
+stayed anchored to the close. On stocks trading far above their EMA20
+(observed live on EGX:CCAP) the suggested pullback entry landed BELOW the
+stop-loss, and R:R graded a trade nobody planned to take (false-rejecting
+EGX:COMI's valid pullback at "1.9 < 2").
+"""
+from __future__ import annotations
+
+import pytest
+
+from tradingview_mcp.core.services.indicators import compute_trade_setup
+
+
+def _assert_long_invariants(sc: dict) -> None:
+    """Every scenario must describe a coherent long trade."""
+    entry, stop = sc["entry"], sc["stop_loss"]
+    t1, t2 = sc["targets"]["target_1"], sc["targets"]["target_2"]
+    assert stop < entry, f"stop {stop} must sit below entry {entry}"
+    assert t1 > entry, f"target_1 {t1} must sit above entry {entry}"
+    assert t2 > entry, f"target_2 {t2} must sit above entry {entry}"
+    rr1 = sc["risk_reward"]["to_target_1"]
+    assert rr1 == pytest.approx((t1 - entry) / (entry - stop), abs=0.05), \
+        "R:R must be measured from the scenario's own entry"
+
+
+def test_ccap_shape_entry_never_below_stop():
+    """Live CCAP shape: close 5.75 far above EMA20 5.49, support at 5.60.
+
+    Old code: stop = max(5.60 - 0.5*ATR, close - 1.5*ATR) ≈ 5.50-5.52 while
+    the pullback entry was 5.49 — entry below stop.
+    """
+    ind = {
+        "close": 5.75,
+        "high": 5.80,
+        "low": 5.70,
+        "ATR": 0.1667,
+        "EMA20": 5.49,
+        "Pivot.M.Classic.S1": 5.60,
+        "Pivot.M.Classic.R1": 5.78,
+        "Pivot.M.Classic.R2": 5.83,
+    }
+    setup = compute_trade_setup(ind)
+    assert setup is not None
+
+    scenarios = setup["scenarios"]
+    assert "pullback" in scenarios and "breakout" in scenarios
+    for sc in scenarios.values():
+        _assert_long_invariants(sc)
+
+    # Legacy top-level fields must mirror ONE coherent scenario.
+    primary = scenarios[setup["primary_scenario"]]
+    assert setup["stop_loss"] == primary["stop_loss"]
+    assert setup["targets"] == primary["targets"]
+    assert setup["risk_reward"]["to_target_1"] == primary["risk_reward"]["to_target_1"]
+    assert setup["risk_reward"]["measured_from_entry"] == primary["entry"]
+    # The displayed entry (pullback preferred) must sit above the displayed stop.
+    assert setup["entry_points"]["pullback_entry"] > setup["stop_loss"]
+
+
+def test_comi_shape_no_false_reject():
+    """Live COMI shape: entry-anchored R:R must clear 2.0 where the old
+    close-anchored math false-rejected at ~1.9."""
+    ind = {
+        "close": 139.28,
+        "high": 140.9,
+        "low": 138.5,
+        "ATR": 1.0133,
+        "EMA20": 138.89,
+        "Pivot.M.Classic.S1": 138.30,
+        "Pivot.M.Classic.R1": 142.13,
+    }
+    setup = compute_trade_setup(ind)
+    assert setup is not None
+    pullback = setup["scenarios"]["pullback"]
+    _assert_long_invariants(pullback)
+
+    entry, stop = pullback["entry"], pullback["stop_loss"]
+    t1 = pullback["targets"]["target_1"]
+    # Old (close-anchored) math graded this < 2; entry-anchored clears it.
+    old_rr = (t1 - ind["close"]) / (ind["close"] - stop)
+    assert old_rr < 2.0
+    assert pullback["risk_reward"]["to_target_1"] >= 2.0
+
+
+def test_market_fallback_when_no_sr_levels():
+    """No pivots/EMAs/BB → still returns one coherent at-market scenario."""
+    ind = {"close": 10.0, "high": 10.2, "low": 9.8, "ATR": 0.2}
+    setup = compute_trade_setup(ind)
+    assert setup is not None
+    assert setup["primary_scenario"] == "market"
+    market = setup["scenarios"]["market"]
+    _assert_long_invariants(market)
+    assert market["entry"] == 10.0
+    assert "market" in setup["setup_types"]
+
+
+def test_breakout_targets_sit_above_breakout_entry():
+    """Breakout scenario must not reuse its own entry level as target_1."""
+    ind = {
+        "close"
```

---

### Incident Patch 5: `7d7e441b` (2026-08-26)
**Commit Message**: fix: low-severity indicator and data-quality batch

- AO exactly 0 reads Neutral, not Bearish; missing ATR%/BBW reports
  volatility 'Unknown' instead of asserting 'Low' on absent data.
- Guard close==0 in fibonacci key-zone distance math (ZeroDivisionError).
- Drop the dead ZeroDivisionError catch in compute_bbw ('not sma' already
  excludes 0) and the unused start_idx in calc_macd.
- compute_trade_quality drops its never-used stock_score parameter
  (4 call sites updated).
- load_symbols is cached per exchange (files ship with the package);
  returns a fresh copy so callers can't poison the cache.
- yahoo_finance: a missing previous close stays None — substituting the
  current price silently reported change=0.0, indistinguishable from a
  flat session.
- Remove the now-unused Column/get_market_type imports in
  screener_service.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

**File**: `src/tradingview_mcp/core/services/coinlist.py` (modified, +15/-5)
```diff
@@ -6,7 +6,17 @@
 
 
 def load_symbols(exchange: str) -> List[str]:
-    """Load symbols for a given exchange, with multiple fallback strategies."""
+    """Load symbols for a given exchange, with multiple fallback strategies.
+
+    Cached per exchange (the coinlist files ship with the package and don't
+    change at runtime) — every scan used to re-read and re-parse the file.
+    Returns a fresh copy so callers can't poison the cache by mutating it.
+    """
+    return list(_load_symbols_cached(exchange))
+
+
+@lru_cache(maxsize=64)
+def _load_symbols_cached(exchange: str) -> tuple:
     # Try multiple possible paths
     possible_paths = [
         os.path.join(COINLIST_DIR, f"{exchange}.txt"),
@@ -22,14 +32,14 @@ def load_symbols(exchange: str) -> List[str]:
             if os.path.exists(path):
                 with open(path, 'r', encoding='utf-8') as f:
                     content = f.read()
-                symbols = [line.strip() for line in content.split('\n') if line.strip()]
+                symbols = tuple(line.strip() for line in content.split('\n') if line.strip())
                 if symbols:  # Only return if we actually got symbols
                     return symbols
         except (FileNotFoundError, IOError, UnicodeDecodeError):
             continue
-    
-    # If all fails, return empty list
-    return []
+
+    # If all fails, return empty tuple
+    return ()
 
 
 # "all.txt" is an aggregate of every exchange — suggesting it as an exchange
```

**File**: `src/tradingview_mcp/core/services/egx_service.py` (modified, +3/-3)
```diff
@@ -561,7 +561,7 @@ def _pct_rank(val: float) -> float:
             if result["score"] >= 70:
                 setup = compute_trade_setup(ind)
                 if setup:
-                    quality = compute_trade_quality(ind, result["score"], setup)
+                    quality = compute_trade_quality(ind, setup)
                     entry["trade_setup"] = {
                         "setup_types": setup["setup_types"],
                         "entry_points": setup["entry_points"],
@@ -847,7 +847,7 @@ def _pct_rank(val: float) -> float:
             if result["score"] >= 70:
                 setup = compute_trade_setup(ind)
                 if setup:
-                    quality = compute_trade_quality(ind, result["score"], setup)
+                    quality = compute_trade_quality(ind, setup)
                     stock_entry["trade_setup"] = {
                         "setup_types": setup["setup_types"],
                         "entry_points": setup["entry_points"],
@@ -945,7 +945,7 @@ def generate_egx_trade_plan(symbol: str, timeframe: str = "1D") -> dict:
         return {"error": f"Could not compute stock score for {full_symbol}"}
 
     setup = compute_trade_setup(ind)
-    quality = compute_trade_quality(ind, score_result["score"], setup) if setup else None
+    quality = compute_trade_quality(ind, setup) if setup else None
     extended = extract_extended_indicators(ind)
 
     output: dict = {
```

**File**: `src/tradingview_mcp/core/services/indicators.py` (modified, +14/-9)
```diff
@@ -7,12 +7,10 @@ def compute_change(open_price: float, close: float) -> float:
 
 
 def compute_bbw(sma: float, bb_upper: float, bb_lower: float) -> Optional[float]:
+    # `not sma` already excludes 0 (and None), so no ZeroDivisionError here.
     if not sma:
         return None
-    try:
-        return (bb_upper - bb_lower) / sma
-    except ZeroDivisionError:
-        return None
+    return (bb_upper - bb_lower) / sma
 
 
 def compute_bb_rating_signal(close: float, bb_upper: float, bb_middle: float, bb_lower: float) -> Tuple[int, str]:
@@ -209,7 +207,14 @@ def extract_extended_indicators(indicators: Dict) -> Dict:
     atr = {
         "value": _safe_round(atr_value, 4),
         "percent_of_price": _safe_round(atr_pct, 2),
-        "volatility": "High" if atr_pct and atr_pct > 3 else "Medium" if atr_pct and atr_pct > 1.5 else "Low",
+        # Missing ATR is "Unknown", not "Low" — asserting calm markets on
+        # absent data misleads downstream risk sizing.
+        "volatility": (
+            "Unknown" if atr_pct is None
+            else "High" if atr_pct > 3
+            else "Medium" if atr_pct > 1.5
+            else "Low"
+        ),
     }
 
     # --- MACD ---
@@ -363,7 +368,7 @@ def extract_extended_indicators(indicators: Dict) -> Dict:
             ao_signal = "Bullish"
             if ao_prev is not None and ao_value > ao_prev:
                 ao_signal = "Bullish (Rising)"
-        else:
+        elif ao_value < 0:  # exactly 0 stays Neutral, not Bearish
             ao_signal = "Bearish"
             if ao_prev is not None and ao_value < ao_prev:
                 ao_signal = "Bearish (Falling)"
@@ -1338,7 +1343,7 @@ def compute_trade_setup(indicators: Dict) -> Optional[Dict]:
 # Answers: "Is this setup actually tradable?"
 # ---------------------------------------------------------------------------
 
-def compute_trade_quality(indicators: Dict, stock_score: int, trade_setup: Dict) -> Dict:
+def compute_trade_quality(indicators: Dict, trade_setup: Dict) -> Dict:
     """Score the trade setup quality out of 100.
 
     Sections:
@@ -1586,11 +1591,11 @@ def analyze_fibonacci_position(close: float, fib_levels: Dict) -> Dict:
         if golden_lo <= close <= golden_hi:
             key_zone = "Golden Pocket (0.618-0.786)"
 
-    if key_zone is None and fib_5:
+    if key_zone is None and fib_5 and close:
         if abs(close - fib_5) / close * 100 < 1.5:
             key_zone = "50% Retracement Zone"
 
-    if key_zone is None and fib_618:
+    if key_zone is None and fib_618 and close:
         if abs(close - fib_618) / close * 100 < 1.5:
             key_zone = "0.618 Level (Golden Ratio)"
 
```

**File**: `src/tradingview_mcp/core/services/indicators_calc.py` (modified, +0/-1)
```diff
@@ -141,7 +141,6 @@ def calc_macd(
     macd_values = [(i, v) for i, v in enumerate(macd_line) if v is not None]
     if len(macd_values) >= signal:
         # Compute EMA of macd values
-        start_idx = macd_values[0][0]
         macd_only = [v for _, v in macd_values]
         sig_ema = calc_ema(macd_only, signal)
         for j, (orig_i, _) in enumerate(macd_values):
```

**File**: `src/tradingview_mcp/core/services/screener_service.py` (modified, +5/-5)
```diff
@@ -29,7 +29,6 @@
 from tradingview_mcp.core.services.indicators import compute_metrics
 from tradingview_mcp.core.utils.validators import (
     EXCHANGE_SCREENER,
-    get_market_type,
     get_tv_exchange_prefix,
 )
 
@@ -48,7 +47,6 @@
 
 try:
     from tradingview_screener import Query
-    from tradingview_screener.column import Column
     _SCREENER_AVAILABLE = True
 except ImportError:
     _SCREENER_AVAILABLE = False
@@ -682,7 +680,7 @@ def analyze_coin(
                         "supports": setup["supports"],
                         "resistances": setup["resistances"],
                     }
-                    quality = compute_trade_quality(indicators, score_result["score"], setup)
+                    quality = compute_trade_quality(indicators, setup)
                     if quality:
                         trade_data["trade_quality_score"] = quality["trade_quality_score"]
                         trade_data["trade_quality"] = quality["quality"]
@@ -719,9 +717,11 @@ def analyze_coin(
             "market_sentiment": {
                 "overall_rating": metrics["rating"],
                 "buy_sell_signal": metrics["signal"],
+                # bbw=None means "unknown", not "calm market".
                 "volatility": (
-                    "High" if metrics["bbw"] and metrics["bbw"] > 0.05
-                    else "Medium" if metrics["bbw"] and metrics["bbw"] > 0.02
+                    "Unknown" if metrics["bbw"] is None
+                    else "High" if metrics["bbw"] > 0.05
+                    else "Medium" if metrics["bbw"] > 0.02
                     else "Low"
                 ),
                 "momentum": "Bullish" if metrics["change"] > 0 else "Bearish",
```

---

### Incident Patch 6: `28ed45e2` (2026-08-26)
**Commit Message**: fix: backtest metrics — mark-to-market equity, forced exits, fair benchmark

- Drawdown/Calmar/Sharpe now come from a per-BAR mark-to-market equity
  series when candles are available: intra-trade dips count (a trade that
  rode -40% before exiting +2% used to show ~0% drawdown), and Sharpe
  annualizes actual bar-frequency returns instead of treating irregular
  per-trade returns as fixed periods. Aggregated cross-fold OOS trades
  keep the per-trade approximation (no single candle list applies).
- Open positions at data end are force-closed at the final bar and
  flagged forced_exit — silently discarding them reported only closed
  winners and made trade counts flap between adjacent periods.
- Buy-and-hold benchmark is charged the strategy's own round-trip
  commission+slippage, removing its structural edge in vs_buy_and_hold.
- compare_strategies validates period like run_backtest ('1Y' now errors
  clearly instead of failing as 'Failed to fetch data'); docstring says 9
  strategies, not 6. Hourly annualization uses 6.5 bars/day (US session).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

**File**: `src/tradingview_mcp/core/services/backtest_service.py` (modified, +126/-29)
```diff
@@ -33,7 +33,9 @@
 _VALID_INTERVALS = {"1d", "1h"}
 
 # Annualization factor for Sharpe ratio
-_ANNUALIZATION = {"1d": 252, "1h": 252 * 6}
+# Bars per year: 252 trading days; US regular session is 6.5 hours → 6.5
+# hourly bars per day.
+_ANNUALIZATION = {"1d": 252, "1h": int(252 * 6.5)}
 
 _STRATEGY_LABELS = {
     "rsi":              "RSI Oversold/Overbought",
@@ -97,6 +99,23 @@ def _fetch_ohlcv(symbol: str, period: str, interval: str = "1d") -> list[dict]:
 
 # ─── Strategy Engines ─────────────────────────────────────────────────────────
 
+def _finalize_trades(trades: list, position, candles: list) -> list:
+    """Close any still-open position at the final bar, flagged forced_exit.
+
+    Silently discarding open positions biased every strategy's results: one
+    currently underwater in an open trade reported only its closed winners,
+    and trade counts flapped between adjacent periods.
+    """
+    if position is not None and candles:
+        trades.append({
+            **position,
+            "exit_date": candles[-1]["date"],
+            "exit_price": candles[-1]["close"],
+            "forced_exit": True,
+        })
+    return trades
+
+
 def _run_rsi(candles, oversold=40, overbought=60, period=14, **_):
     closes = [c["close"] for c in candles]
     rsi    = calc_rsi(closes, period)
@@ -110,7 +129,7 @@ def _run_rsi(candles, oversold=40, overbought=60, period=14, **_):
         elif position is not None and rsi[i] > overbought:
             trades.append({**position, "exit_date": date, "exit_price": price})
             position = None
-    return trades
+    return _finalize_trades(trades, position, candles)
 
 
 def _run_bollinger(candles, period=20, std_mult=2.0, **_):
@@ -126,7 +145,7 @@ def _run_bollinger(candles, period=20, std_mult=2.0, **_):
         elif position is not None and price > bb["middle"][i]:
             trades.append({**position, "exit_date": date, "exit_price": price})
             position = None
-    return trades
+    return _finalize_trades(trades, position, candles)
 
 
 def _run_macd(candles, fast=12, slow=26, signal=9, **_):
@@ -143,7 +162,7 @@ def _run_macd(candles, fast=12, slow=26, signal=9, **_):
         elif position is not None and mp > sp and m <= s:
             trades.append({**position, "exit_date": date, "exit_price": price})
             position = None
-    return trades
+    return _finalize_trades(trades, position, candles)
 
 
 def _run_ema_cross(candles, fast_period=20, slow_period=50, **_):
@@ -161,7 +180,7 @@ def _run_ema_cross(candles, fast_period=20, slow_period=50, **_):
         elif position is not None and fp > sp and f <= s:
             trades.append({**position, "exit_date": date, "exit_price": price})
             position = None
-    return trades
+    return _finalize_trades(trades, position, candles)
 
 
 def _run_supertrend(candles, atr_period=10, multiplier=3.0, **_):
@@ -180,7 +199,7 @@ def _run_supertrend(candles, atr_period=10, multiplier=3.0, **_):
         elif position is not None and dp == 1 and d == -1:
             trades.append({**position, "exit_date": date, "exit_price": price})
             position = None
-    return trades
+    return _finalize_trades(trades, position, candles)
 
 
 def _run_donchian(candles, period=20, **_):
@@ -200,7 +219,7 @@ def _run_donchian(candles, period=20, **_):
         elif position is not None and lows[i] < dc["lower"][i - 1]:
             trades.append({**position, "exit_date": date, "exit_price": price})
             position = None
-    return trades
+    return _finalize_trades(trades, position, candles)
 
 
 def _run_rsi_pullback(candles, rsi_period=14, oversold=40, overbought=70,
@@ -225,7 +244,7 @@ def _run_rsi_pullback(candles, rsi_period=14, oversold=40, overbought=70,
         elif position is not None and (rsi[i] > overbought or price < sma_fast[i]):
             trades.append({**position, "exit_date": date, "exit_price": price})
             position = None
-    return trades
+    retur
```

**File**: `tests/unit/services/test_backtest_metrics.py` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+"""Regression tests for backtest metric correctness.
+
+- Open positions at data end were silently discarded (a strategy underwater
+  in an open trade reported only its closed winners) → now force-closed at
+  the final bar, flagged forced_exit.
+- Drawdown/equity were computed only at trade exits, so a trade that rode a
+  deep dip before exiting green showed near-zero drawdown → now mark-to-market
+  per bar.
+- Buy-and-hold benchmark was cost-free while the strategy paid
+  commission+slippage → now charged one round trip of the same costs.
+"""
+from __future__ import annotations
+
+from tradingview_mcp.core.services import backtest_service
+
+
+def _candle(date: str, price: float) -> dict:
+    return {"date": date, "open": price, "high": price * 1.01,
+            "low": price * 0.99, "close": price, "volume": 100}
+
+
+class TestForcedExit:
+    def test_open_position_is_closed_at_final_bar(self):
+        # RSI dives below 40 (entry) and never recovers above 60 (no exit).
+        prices = [100.0] * 15 + [90.0, 80.0, 70.0, 65.0, 60.0]
+        candles = [_candle(f"2024-01-{i+1:02d}", p) for i, p in enumerate(prices)]
+        trades = backtest_service._run_rsi(candles)
+        assert len(trades) == 1
+        assert trades[0]["forced_exit"] is True
+        assert trades[0]["exit_date"] == candles[-1]["date"]
+        assert trades[0]["exit_price"] == 60.0  # the loss is realized, not hidden
+
+
+class TestMarkToMarketDrawdown:
+    def test_intra_trade_dip_counts_toward_drawdown(self):
+        # One trade: enter day 1 at 100, dip to 60 mid-trade, exit day 5 at 102.
+        candles = [
+            _candle("2024-01-01", 100.0),
+            _candle("2024-01-02", 80.0),
+            _candle("2024-01-03", 60.0),
+            _candle("2024-01-04", 90.0),
+            _candle("2024-01-05", 102.0),
+        ]
+        trades = [{
+            "entry_date": "2024-01-01", "entry_price": 100.0,
+            "exit_date": "2024-01-05", "exit_price": 102.0,
+            "return_pct": 2.0, "strategy": "x",
+        }]
+
+        m = backtest_service._calc_metrics(trades, 10_000, "1d", candles=candles)
+        # Equity dips to 6,000 at the trough → ~40% drawdown. The old
+        # exit-only path reported 0% for this winning trade.
+        assert m["max_drawdown_pct"] <= -39.0
+        assert m["total_return_pct"] == 2.0
+
+    def test_without_candles_falls_back_to_trade_based(self):
+        trades = [{
+            "entry_date": "a", "entry_price": 100.0,
+            "exit_date": "b", "exit_price": 102.0,
+            "return_pct": 2.0, "strategy": "x",
+        }]
+        m = backtest_service._calc_metrics(trades, 10_000, "1d")
+        assert m["total_return_pct"] == 2.0
+        assert m["max_drawdown_pct"] == 0
+
+
+class TestFairBuyAndHold:
+    def test_benchmark_pays_the_same_round_trip_costs(self):
+        candles = [_candle("2024-01-01", 100.0), _candle("2024-01-02", 110.0)]
+        assert backtest_service._buy_and_hold_return(candles) == 10.0
+        assert backtest_service._buy_and_hold_return(candles, 0.1, 0.05) == 9.7
```

---

### Incident Patch 7: `f1091dc9` (2026-08-26)
**Commit Message**: fix: reliability sweep — partial-scan honesty, thread safety, timeouts, null guards

- PARTIAL_DATA: batched scans that abort mid-flight (budget / consecutive-
  failure bail) now raise PartialDataError; the tool boundary returns a
  PARTIAL_DATA envelope that still carries the collected rows, instead of
  a plain list indistinguishable from a complete scan.
- Thread safety: options _SESSION_CACHE handshake is now lock-guarded
  (interleaved handshakes could pair one session's Yahoo crumb with
  another's cookies → persistent 401s); ATR backfill copies the cached
  indicators dict instead of mutating the provider's shared cache entry;
  the screener cache is bounded at 256 entries (oldest-first eviction).
- Timeouts: stock_screener get_scanner_data calls get timeout=20
  (requests has no default; a stalled endpoint hung the worker forever).
- multi_agent_service: explicit-null-safe reads for RSI/close/MACD/bbw —
  TradingView returns explicit nulls, so dict.get defaults never fired
  and 'None > 60' crashed the tool.
- marketaux: whole-word keyword scoring ('up' no longer matches 'supply')
  and exact entity-symbol match (startswith attributed FB/FDX news to F).
- EGX: overview cou

**File**: `src/tradingview_mcp/core/errors.py` (modified, +42/-0)
```diff
@@ -143,6 +143,37 @@ def __init__(
         self.first_error = first_error
 
 
+class PartialDataError(Exception):
+    """Raised when a batched scan aborted early but still produced rows.
+
+    Wall-clock budgets and consecutive-failure bails used to return a plain
+    truncated list, indistinguishable from a complete scan — the abort reason
+    went only to stderr. This carries the partial rows plus scan telemetry so
+    the MCP boundary can return them WITH a PARTIAL_DATA envelope.
+
+    Attributes:
+        rows: The rows collected before the abort (already sorted/truncated).
+        batches_attempted / total_batches: Scan progress at abort time.
+        aborted_reason: Human-readable cause ("wall-clock budget…", …).
+    """
+
+    def __init__(
+        self,
+        rows: list,
+        batches_attempted: int,
+        total_batches: int,
+        aborted_reason: str,
+    ) -> None:
+        super().__init__(
+            f"Partial scan: {batches_attempted}/{total_batches} batches before abort "
+            f"({aborted_reason})"
+        )
+        self.rows = rows
+        self.batches_attempted = batches_attempted
+        self.total_batches = total_batches
+        self.aborted_reason = aborted_reason
+
+
 def exception_to_envelope(exc: BaseException, *, context: str = "") -> dict[str, Any]:
     """Translate any exception into the structured envelope at the MCP boundary.
 
@@ -157,6 +188,17 @@ def exception_to_envelope(exc: BaseException, *, context: str = "") -> dict[str,
     """
     if isinstance(exc, ScreenerServiceError):
         return exc.to_envelope()
+    if isinstance(exc, PartialDataError):
+        env = make_error(
+            ErrorCode.PARTIAL_DATA, str(exc),
+            batches_attempted=exc.batches_attempted,
+            total_batches=exc.total_batches,
+            aborted_reason=exc.aborted_reason,
+            retryable=True,
+        )
+        # Partial rows ride alongside the error so callers keep the data.
+        env["rows"] = exc.rows
+        return env
     if isinstance(exc, BatchExecutionError):
         return make_error(
             ErrorCode.ALL_BATCHES_FAILED, str(exc),
```

**File**: `src/tradingview_mcp/core/services/egx_service.py` (modified, +26/-2)
```diff
@@ -67,12 +67,21 @@ def get_egx_market_overview(timeframe: str = "1D", limit: int = 10) -> dict:
     screener = EXCHANGE_SCREENER.get("egx", "egypt")
     all_stocks: List[dict] = []
     batch_size = 200
+    batches_failed = 0
+    symbols_skipped = 0
+    first_error: str | None = None
 
     for i in range(0, len(symbols), batch_size):
         batch = symbols[i : i + batch_size]
         try:
             analysis = get_multiple_analysis(screener=screener, interval=timeframe, symbols=batch)
-        except Exception:
+        except Exception as exc:
+            # Count instead of swallowing outright — a systemic failure
+            # (auth change, schema change) used to surface only as
+            # "No data returned for EGX stocks" with zero diagnostic.
+            batches_failed += 1
+            if first_error is None:
+                first_error = repr(exc)
             continue
 
         for sym, data in analysis.items():
@@ -96,10 +105,15 @@ def get_egx_market_overview(timeframe: str = "1D", limit: int = 10) -> dict:
                     }
                 )
             except Exception:
+                symbols_skipped += 1
                 continue
 
     if not all_stocks:
-        return {"error": "No data returned for EGX stocks", "timeframe": timeframe}
+        out = {"error": "No data returned for EGX stocks", "timeframe": timeframe}
+        if batches_failed:
+            out["batches_failed"] = batches_failed
+            out["first_error"] = first_error
+        return out
 
     by_change = sorted(all_stocks, key=lambda x: x["changePercent"], reverse=True)
     by_volume = sorted(all_stocks, key=lambda x: x["volume"] or 0, reverse=True)
@@ -108,6 +122,8 @@ def get_egx_market_overview(timeframe: str = "1D", limit: int = 10) -> dict:
         "exchange": "EGX",
         "timeframe": timeframe,
         "total_analyzed": len(all_stocks),
+        "batches_failed": batches_failed,
+        "symbols_skipped": symbols_skipped,
         "top_gainers": by_change[:limit],
         "top_losers": by_change[-limit:][::-1],
         "most_active": by_volume[:limit],
@@ -1094,6 +1110,14 @@ def analyze_egx_fibonacci(
                 "hint": "Period high/low data not available for this symbol",
             }
 
+    if swing_low <= 0:
+        # Possible via the R3/S3 pivot fallback above; dividing by it would
+        # raise an uncaught ZeroDivisionError out of the tool.
+        return {
+            "error": "Invalid swing low (<= 0) — cannot compute Fibonacci range",
+            "swing_high": swing_high,
+            "swing_low": swing_low,
+        }
     swing_range_pct = ((swing_high - swing_low) / swing_low) * 100
     if swing_range_pct < 2:
         return {
```

**File**: `src/tradingview_mcp/core/services/marketaux_service.py` (modified, +10/-4)
```diff
@@ -169,9 +169,14 @@ def _clean_text(text: str) -> str:
 
 
 def _keyword_score(text: str) -> float:
-    t = (text or "").lower()
-    bull = sum(1 for w in _BULLISH_KEYWORDS if w in t)
-    bear = sum(1 for w in _BEARISH_KEYWORDS if w in t)
+    import re
+
+    # Whole-word matching only: bare substring checks scored "up" inside
+    # "supply", "call" inside "recall", "top" inside "stop" — systematically
+    # corrupting the bullish/bearish label.
+    words = set(re.findall(r"[a-z]+", (text or "").lower()))
+    bull = sum(1 for w in _BULLISH_KEYWORDS if w in words)
+    bear = sum(1 for w in _BEARISH_KEYWORDS if w in words)
     total = bull + bear
     if total == 0:
         return 0.0
@@ -251,11 +256,12 @@ def analyze_sentiment(
     scores: list[float] = []
     top: list[dict] = []
     for a in articles:
+        # Exact symbol match: startswith attributed FB/FDX sentiment to "F".
         ent_scores = [
             e.get("sentiment_score")
             for e in (a.get("entities") or [])
             if isinstance(e.get("sentiment_score"), (int, float))
-            and (e.get("symbol", "").upper().startswith(base) if base else True)
+            and (e.get("symbol", "").upper() == base if base else True)
         ]
         if not ent_scores:  # fall back to any scored entity on the article
             ent_scores = [
```

**File**: `src/tradingview_mcp/core/services/multi_agent_service.py` (modified, +18/-12)
```diff
@@ -33,9 +33,13 @@ def calculate_sentiment_score(indicators: dict, price_change: float) -> dict:
     Returns:
         Dict with 'score' (raw), 'normalized' (-3..+3), and 'signals' list.
     """
-    rsi = indicators.get("RSI", 50.0)
-    macd = indicators.get("MACD.macd", 0.0)
-    macd_signal = indicators.get("MACD.signal", 0.0)
+    # TradingView returns explicit nulls, so dict.get defaults don't fire —
+    # `indicators.get("RSI", 50.0)` yields None when the key exists as None,
+    # and `None > 60` crashes the whole tool.
+    rsi = indicators.get("RSI")
+    rsi = 50.0 if rsi is None else rsi
+    macd = indicators.get("MACD.macd")
+    macd_signal = indicators.get("MACD.signal")
 
     score = 0
     signals: list[str] = []
@@ -80,9 +84,11 @@ def calculate_risk_score(indicators: dict, bbw: float) -> dict:
     Returns:
         Dict with 'score' (negative = more risk), 'warnings' list, and 'level' label.
     """
-    close = indicators.get("close", 0.0)
-    sma20 = indicators.get("SMA20", close)
-    ema200 = indicators.get("EMA200", close)
+    # Explicit-null-safe reads (see calculate_sentiment_score).
+    close = indicators.get("close") or 0.0
+    sma20 = indicators.get("SMA20") or close
+    ema200 = indicators.get("EMA200") or close
+    bbw = bbw or 0.0
 
     score = 0
     warnings: list[str] = []
@@ -94,7 +100,7 @@ def calculate_risk_score(indicators: dict, bbw: float) -> dict:
         score += 1
         warnings.append("Low volatility (Squeeze)")
 
-    if ema200 is not None and close < ema200:
+    if ema200 and close < ema200:
         score -= 1
         warnings.append("Price below 200 EMA (Long-term bearish structure)")
 
@@ -146,10 +152,10 @@ def run_multi_agent_analysis(
     if not metrics:
         return {"error": f"Could not compute metrics for {symbol}"}
 
-    price = metrics.get("price", 0.0)
-    change = metrics.get("change", 0.0)
-    bb_rating = metrics.get("rating", 0)
-    bbw = metrics.get("bbw", 0.0)
+    price = metrics.get("price") or 0.0
+    change = metrics.get("change") or 0.0
+    bb_rating = metrics.get("rating") or 0
+    bbw = metrics.get("bbw") or 0.0  # compute_metrics returns bbw=None sometimes
 
     # Agent 1 — Technical Analyst
     tech_analyst = {
@@ -159,7 +165,7 @@ def run_multi_agent_analysis(
         "key_observations": [
             f"Price is {price} ({change:+.2f}%)",
             f"Bollinger Rating: {bb_rating} ({metrics.get('signal', 'Neutral')})",
-            f"RSI: {indicators.get('RSI', 50):.1f}",
+            f"RSI: {indicators.get('RSI') or 50.0:.1f}",
         ],
     }
 
```

**File**: `src/tradingview_mcp/core/services/options_service.py` (modified, +29/-22)
```diff
@@ -32,6 +32,7 @@
 
 import http.cookiejar
 import json
+import threading
 import time
 import urllib.parse
 import urllib.request
@@ -50,8 +51,12 @@
 _BASE = "https://query2.finance.yahoo.com/v7/finance/options"
 
 # Session cache: crumb tokens expire — re-handshake every ~25 minutes.
+# The lock matters: tools run on worker threads, and Yahoo's crumb is bound to
+# the cookie jar it was issued against. Two interleaved handshakes could pair
+# one session's crumb with the other's cookies → persistent 401s.
 _SESSION_CACHE: dict = {"crumb": None, "opener": None, "ts": 0.0}
 _SESSION_TTL = 1500
+_SESSION_LOCK = threading.Lock()
 
 
 def _new_session_opener() -> urllib.request.OpenerDirector:
@@ -76,30 +81,31 @@ def _get_session() -> tuple:
     2. Ask query2/v1/test/getcrumb for the per-session crumb token.
     3. Re-use both for all subsequent options calls.
     """
-    now = time.time()
-    if _SESSION_CACHE["crumb"] and (now - _SESSION_CACHE["ts"]) < _SESSION_TTL:
-        return _SESSION_CACHE["crumb"], _SESSION_CACHE["opener"]
+    with _SESSION_LOCK:
+        now = time.time()
+        if _SESSION_CACHE["crumb"] and (now - _SESSION_CACHE["ts"]) < _SESSION_TTL:
+            return _SESSION_CACHE["crumb"], _SESSION_CACHE["opener"]
 
-    opener = _new_session_opener()
-    # Cookie-drop step. Any HTTP status here is fine — we only need Set-Cookie.
-    try:
-        opener.open("https://fc.yahoo.com/", timeout=_TIMEOUT)
-    except urllib.error.HTTPError:
-        pass
-    except urllib.error.URLError:
-        pass
+        opener = _new_session_opener()
+        # Cookie-drop step. Any HTTP status here is fine — we only need Set-Cookie.
+        try:
+            opener.open("https://fc.yahoo.com/", timeout=_TIMEOUT)
+        except urllib.error.HTTPError:
+            pass
+        except urllib.error.URLError:
+            pass
 
-    req = urllib.request.Request(
-        "https://query2.finance.yahoo.com/v1/test/getcrumb",
-        headers={"User-Agent": _UA, "Accept": "text/plain"},
-    )
-    with opener.open(req, timeout=_TIMEOUT) as resp:
-        crumb = resp.read().decode("utf-8").strip()
-    if not crumb or len(crumb) > 100:
-        raise ValueError(f"unexpected crumb response: {crumb[:80]!r}")
+        req = urllib.request.Request(
+            "https://query2.finance.yahoo.com/v1/test/getcrumb",
+            headers={"User-Agent": _UA, "Accept": "text/plain"},
+        )
+        with opener.open(req, timeout=_TIMEOUT) as resp:
+            crumb = resp.read().decode("utf-8").strip()
+        if not crumb or len(crumb) > 100:
+            raise ValueError(f"unexpected crumb response: {crumb[:80]!r}")
 
-    _SESSION_CACHE.update(crumb=crumb, opener=opener, ts=now)
-    return crumb, opener
+        _SESSION_CACHE.update(crumb=crumb, opener=opener, ts=now)
+        return crumb, opener
 
 
 def _fetch(url: str) -> dict:
@@ -121,7 +127,8 @@ def _go() -> dict:
     except urllib.error.HTTPError as e:
         if e.code in (401, 403):
             # Session likely expired mid-flight. Invalidate and retry once.
-            _SESSION_CACHE.update(crumb=None, opener=None, ts=0.0)
+            with _SESSION_LOCK:
+                _SESSION_CACHE.update(crumb=None, opener=None, ts=0.0)
             return _go()
         raise
 
```

---

### Incident Patch 8: `90032cfe` (2026-08-26)
**Commit Message**: fix: five verified correctness bugs from the code review

- top_losers returned the smallest of the top GAINERS: the service sorted
  desc and truncated to limit before the tool re-sorted asc. sort='asc'
  now orders before truncation so actual losers surface.
- volume_breakout_scan's missing-baseline fallback volume/(volume/2) was
  always exactly 2.0, passing the default 2.0x gate — every baseline-less
  symbol read as a breakout. Baseline-less symbols are now skipped.
- Walk-forward both-negative fold scoring used te/tr, rewarding strategies
  that lose MORE out-of-sample (train -1%/test -2% scored a capped 2.0
  'maximally robust'). Now tr/te; plus warmup-aware insufficient_data
  folds excluded from the average instead of reading as OVERFITTED, and a
  caveat that no parameters are fit (score = regime consistency).
- Multi-TF alignment zipped success-only scores against the full timeframe
  list, shifting every score after a failed TF onto the wrong key. Scores
  are recorded as (tf, score) pairs at the success site.
- fetch_multi_timeframe_patterns ignored its symbols argument (whole-
  exchange scan + limit(len(symbols))) while caching on it. Now
  set_tickers() on the calle

**File**: `src/tradingview_mcp/core/services/backtest_service.py` (modified, +56/-8)
```diff
@@ -292,6 +292,22 @@ def _run_triple_ema(candles, fast_period=20, slow_period=50, trend_period=200, *
     "triple_ema":       _run_triple_ema,
 }
 
+# Bars each strategy needs before its slowest indicator produces signals.
+# Walk-forward test slices shorter than this cannot trade at all — scoring
+# them 0.0 falsely reads as "fails out-of-sample" when the real cause is
+# "window too small to even warm up".
+_STRATEGY_WARMUP_BARS = {
+    "rsi":              14,
+    "bollinger":        20,
+    "macd":             35,   # slow EMA 26 + signal 9
+    "ema_cross":        50,   # slow EMA
+    "supertrend":       10,   # ATR period
+    "donchian":         20,
+    "rsi_pullback":     200,  # SMA200 (excluded from walk-forward anyway)
+    "keltner_breakout": 20,   # EMA20 / ATR14
+    "triple_ema":       200,  # trend EMA (excluded from walk-forward anyway)
+}
+
 
 # ─── Transaction Costs ────────────────────────────────────────────────────────
 
@@ -643,11 +659,16 @@ def walk_forward_backtest(
       - Train (70%): in-sample strategy simulation
       - Test  (30%): out-of-sample forward validation
 
-    Robustness score (test_return / train_return):
+    Robustness score (test_return / train_return; train/test when both are
+    negative, so losing LESS out-of-sample scores higher):
       >= 0.8  → ROBUST    (no overfitting)
       >= 0.5  → MODERATE  (some degradation)
       >= 0.2  → WEAK      (likely overfitted)
       < 0.2   → OVERFITTED (do not trade live)
+
+    Folds whose test slice is shorter than the strategy's indicator warmup
+    are flagged ``insufficient_data`` and excluded from the average — a
+    window too small to trade is not evidence of out-of-sample failure.
     """
     strategy = strategy.lower().strip()
     period   = period.lower().strip()
@@ -682,11 +703,13 @@ def walk_forward_backtest(
     if len(candles) < min_bars:
         return {"error": f"Not enough data ({len(candles)} bars) for {n_splits} splits. Try longer period."}
 
-    fn        = _STRATEGY_MAP[strategy]
-    fold_size = len(candles) // n_splits
+    fn          = _STRATEGY_MAP[strategy]
+    fold_size   = len(candles) // n_splits
+    warmup_bars = _STRATEGY_WARMUP_BARS.get(strategy, 20)
 
     folds: list[dict]   = []
     all_test_trades: list[dict] = []
+    insufficient_folds = 0
 
     for fold_i in range(n_splits):
         start  = fold_i * fold_size
@@ -700,6 +723,11 @@ def walk_forward_backtest(
         if len(train_c) < 20 or len(test_c) < 5:
             continue
 
+        # A test slice too short for the strategy's slowest indicator can
+        # never trade — recording fold_rob=0.0 would falsely count it as
+        # out-of-sample failure. Mark it and exclude it from the average.
+        insufficient = len(test_c) < warmup_bars + 5
+
         train_t = _apply_costs(fn(train_c), commission_pct, slippage_pct)
         test_t  = _apply_costs(fn(test_c),  commission_pct, slippage_pct)
         train_m = _calc_metrics(train_t, initial_capital, interval)
@@ -708,10 +736,17 @@ def walk_forward_backtest(
         all_test_trades.extend(test_t)
 
         tr, te = train_m["total_return_pct"], test_m["total_return_pct"]
-        if tr == 0:
+        if insufficient:
+            fold_rob = None
+            insufficient_folds += 1
+        elif tr == 0:
             fold_rob = 1.0 if te == 0 else 0.0
         elif tr < 0 and te < 0:
-            fold_rob = round(min(te / tr, 2.0), 2)
+            # Both windows lost money: robustness = did the test lose LESS?
+            # tr/te > 1 when the test loss is smaller than the train loss.
+            # (The old te/tr rewarded losing MORE out-of-sample: train -1%,
+            # test -2% scored a capped 2.0 — "maximally robust".)
+            fold_rob = round(max(min(tr / te, 2.0), 0.0), 2)
         elif tr < 0:
             fold_rob = 0.0
         else:
@@ -732,14 +767,21 @@ def walk_forward_backtest(
             "test_trades":           test_m["total_trades"],
        
```

**File**: `src/tradingview_mcp/core/services/indicators.py` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ def compute_metrics(indicators: Dict) -> Optional[Dict]:
 
         return {
             "price": round(close, 4),
+            "open": round(open_price, 4),
             "change": round(change, 3),
             "bbw": round(bbw, 4) if bbw is not None else None,
             "rating": rating,
```

**File**: `src/tradingview_mcp/core/services/scanner_service.py` (modified, +7/-5)
```diff
@@ -146,11 +146,13 @@ def volume_breakout_scan(
 
                 price_change = ((close - open_price) / open_price) * 100 if open_price > 0 else 0
 
-                if sma20_volume and sma20_volume > 0:
-                    volume_ratio = volume / sma20_volume
-                else:
-                    avg_estimate = volume / 2
-                    volume_ratio = volume / avg_estimate if avg_estimate > 0 else 1
+                # No volume baseline → no volume signal. The old fallback
+                # (volume / (volume/2)) was always exactly 2.0, so every
+                # baseline-less symbol passed the default 2.0x gate and the
+                # scan flooded with fake "breakouts".
+                if not sma20_volume or sma20_volume <= 0:
+                    continue
+                volume_ratio = volume / sma20_volume
 
                 if abs(price_change) >= price_change_min and volume_ratio >= volume_multiplier:
                     rsi = ind.get("RSI", 50)
```

**File**: `src/tradingview_mcp/core/services/screener_service.py` (modified, +32/-16)
```diff
@@ -29,7 +29,11 @@
 )
 from tradingview_mcp.core.services.coinlist import exchanges_listing_symbol, load_symbols
 from tradingview_mcp.core.services.indicators import compute_metrics
-from tradingview_mcp.core.utils.validators import EXCHANGE_SCREENER, get_market_type
+from tradingview_mcp.core.utils.validators import (
+    EXCHANGE_SCREENER,
+    get_market_type,
+    get_tv_exchange_prefix,
+)
 
 # Resilience layer (does not require tradingview_ta; safe to import unconditionally).
 from tradingview_mcp.core.services.screener_provider import _scan_with_retry, humanize_upstream_error
@@ -193,6 +197,7 @@ def fetch_trending_analysis(
     filter_type: str = "",
     rating_filter: int = None,
     limit: int = 50,
+    sort: str = "desc",
 ) -> List[Row]:
     """
     Fetch trending coins across all available symbols in batches of 200.
@@ -203,9 +208,13 @@ def fetch_trending_analysis(
         filter_type:   Optional filter mode ('rating').
         rating_filter: BB rating value to match when filter_type == 'rating'.
         limit:         Maximum rows to return.
+        sort:          'desc' → biggest gainers first; 'asc' → biggest losers
+                       first. Sorting happens BEFORE the limit truncation —
+                       'asc' returns the market's actual losers, not the
+                       bottom of a gainers-truncated list.
 
     Returns:
-        List of Row dicts sorted by changePercent descending.
+        List of Row dicts sorted by changePercent in the requested order.
     """
     if not _TA_AVAILABLE:
         raise ScreenerServiceError(
@@ -334,7 +343,7 @@ def fetch_trending_analysis(
             first_error=first_error or "unknown",
         )
 
-    all_coins.sort(key=lambda x: x["changePercent"], reverse=True)
+    all_coins.sort(key=lambda x: x["changePercent"], reverse=(sort != "asc"))
     return all_coins[:limit]
 
 
@@ -541,10 +550,13 @@ def fetch_multi_timeframe_patterns(
             "RSI",
         ]
 
-        market = get_market_type(exchange)
-        q = Query().set_markets(market).select(*cols)
-        q = q.where(Column("exchange") == exchange.upper())
-        q = q.limit(len(symbols))
+        # Query the CALLER'S symbols. The old whole-exchange scan with
+        # .limit(len(symbols)) returned the first N arbitrary rows of the
+        # market — while the cache key below was keyed on the ignored symbol
+        # list, so different symbol lists collided onto the same wrong rows.
+        prefix = get_tv_exchange_prefix(exchange)
+        full_symbols = [s if ":" in s else f"{prefix}:{s}" for s in symbols]
+        q = Query().select(*cols).set_tickers(*full_symbols)
 
         # Route through resilience layer (retry + stale-while-error).
         cp_cache_key = (
@@ -1043,7 +1055,11 @@ def run_multi_timeframe_analysis(
     }
 
     tf_results: dict = {}
-    alignment_scores: list[int] = []
+    # (timeframe, bias) pairs recorded together at the success site. Keeping
+    # them paired matters: a bare score list zipped against the full
+    # `timeframes` later misattributes every score after a failed timeframe
+    # (1W errors → 1D's score reported under the "1W" key, and so on).
+    alignment_scores: list[tuple[str, int]] = []
 
     # Fast-fail guards: 5 timeframes × (~5s retries + 15s cooldown) ≈ 100s
     # when upstream cliffs. Bail after N consecutive failures, or when the
@@ -1100,7 +1116,7 @@ def run_multi_timeframe_analysis(
             tf_context = analyze_timeframe_context(indicators, tf)
 
             bias_num = 1 if tf_context["bias"] == "Bullish" else -1 if tf_context["bias"] == "Bearish" else 0
-            alignment_scores.append(bias_num)
+            alignment_scores.append((tf, bias_num))
 
             tf_results[tf] = {
                 "label": tf_labels.get(tf, tf),
@@ -1138,9 +1154,9 @@ def run_multi_timeframe_analysis(
                 _fill_skipped_tfs(tf_results, timeframes, "upstream cliff")
                 break
 
-    total_score =
```

**File**: `src/tradingview_mcp/server.py` (modified, +4/-3)
```diff
@@ -164,11 +164,12 @@ def top_losers(exchange: str = "KUCOIN", timeframe: str = "15m", limit: int = 25
     timeframe = sanitize_timeframe(timeframe, "15m")
     limit = max(1, min(limit, 50))
     try:
-        rows = fetch_trending_analysis(exchange, timeframe=timeframe, limit=limit)
+        # sort="asc" makes the service sort BEFORE truncating to limit —
+        # re-sorting after fetch returned the smallest of the top GAINERS.
+        rows = fetch_trending_analysis(exchange, timeframe=timeframe, limit=limit, sort="asc")
     except Exception as e:
         return exception_to_envelope(e, context="top_losers")
-    rows.sort(key=lambda x: x["changePercent"])
-    return [{"symbol": r["symbol"], "changePercent": r["changePercent"], "indicators": dict(r["indicators"])} for r in rows[:limit]]
+    return [{"symbol": r["symbol"], "changePercent": r["changePercent"], "indicators": dict(r["indicators"])} for r in rows]
 
 
 @mcp.tool(annotations=ToolAnnotations(title="Bollinger Squeeze Scanner", readOnlyHint=True, destructiveHint=False, openWorldHint=True))
```

---

### Incident Patch 9: `b17aae72` (2026-08-24)
**Commit Message**: fix: preload pandas on the main thread — 7 tools hung forever under stdio (#91)

Seven tools that build bare tradingview_screener Query() calls (stock_prices,
stock_screener, futures_market_overview, futures_top_movers,
futures_category_snapshot, advanced_candle_pattern, egx_fibonacci_retracement)
deadlocked under the stdio server: their first call lazily imported pandas
inside an anyio.to_thread worker, which blocked on the interpreter import lock
while the event loop awaited the worker. The 25+ tools routing through
screener_provider never touch pandas, which is why only these seven hung —
and why nothing reproduced in-process, where pandas was already imported.

Import pandas eagerly at module import (main thread) so the in-worker import
is a no-op. Verified end-to-end over a fresh stdio process: all seven now
return in ~2s. Bump to 0.8.1.

Root cause + fix reported by @Dcherukuri in #91 with a complete diagnosis.

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "tradingview-mcp-server"
-version = "0.8.0"
+version = "0.8.1"
 description = "Advanced AI Trading Intelligence Framework — MCP server with walk-forward backtesting, trade logs, equity curves, 1h timeframe, sentiment, Yahoo Finance, and 30+ technical analysis tools"
 readme = "README.md"
 requires-python = ">=3.10,<3.14"
```

**File**: `src/tradingview_mcp/server.py` (modified, +8/-0)
```diff
@@ -15,6 +15,14 @@
 import os
 from typing import Optional
 
+# Eagerly import pandas on the main thread. Several tools route through
+# tradingview_screener's bare Query(), whose first call imports pandas lazily —
+# and under the stdio server that first import happens inside an
+# anyio.to_thread worker, deadlocking against the interpreter's import lock
+# while the event loop awaits the worker (issue #91: seven tools hung forever
+# on a fresh stdio process). Preloading here makes the in-worker import a no-op.
+import pandas  # noqa: F401
+
 from mcp.server.fastmcp import FastMCP
 from mcp.types import ToolAnnotations
 
```

---

### Incident Patch 10: `e5e1f59a` (2026-08-05)
**Commit Message**: fix: registry description under the 100-char limit

**File**: `server.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
   "name": "io.github.atilaahmettaner/tradingview-mcp",
-  "description": "Real-time market data, multi-exchange screeners, 37 technical-analysis tools and backtesting for stocks, crypto, forex & futures. No TradingView account required.",
+  "description": "Real-time market data, screeners, technical analysis & backtesting for stocks, crypto and forex.",
   "repository": {
     "url": "https://github.com/atilaahmettaner/tradingview-mcp",
     "source": "github"
```

#### Recent Merged Pull Requests:
- **PR #99** (closed): docs: add hardened Hermes Agent integration (@RedGh0st1)
- **PR #94** (2026-09-01): feat: 0.9.0 — code-review remediation, CI, and EGX smart-money tools (@Galileo103)
- **PR #86** (2026-07-29): fix(deps): pin mcp[cli] below 2 — 0.8.0 release (mcp 2.0.0 breaks fresh installs) (@atilaahmettaner)
- **PR #85** (2026-07-30): Require mcp>=1.14.0,<2 — locked 1.12.4 and current 2.x both break the server at import (@27qtk5t425-pixel)
- **PR #83** (closed): pull request (@normantus)
- **PR #82** (2026-07-15): feat: server-side sort_by on stock_screener (@atilaahmettaner)
- **PR #81** (2026-07-15): feat: daily OHLC (open/high/low) on stock_screener + stock_prices rows (@atilaahmettaner)
- **PR #80** (2026-07-13): feat: exclude_otc (default on) + compact rows on stock_screener; limits to 2,000 (@atilaahmettaner)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
