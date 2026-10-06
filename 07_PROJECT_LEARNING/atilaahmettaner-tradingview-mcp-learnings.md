# Forensic Learning Record (Deep Inspection): atilaahmettaner/tradingview-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/atilaahmettaner-tradingview-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/atilaahmettaner/tradingview-mcp](https://github.com/atilaahmettaner/tradingview-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:26:55.466Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `atilaahmettaner/tradingview-mcp`
- **Description**: TradingView MCP server — real-time market data, technical analysis, screeners & backtesting for Claude, ChatGPT, Cursor & any MCP client. Stocks, crypto, forex & futures across global exchanges. Hosted or self-host.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 4919 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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
    "SKPC",   # Sidi Kerir Petrochemicals - SIDPEC
    "TAQA",   # Arabia Energy
    "VLMRA",  # ValMora Holding for Investments - EGP
    "FWRY",   # Fawry for Banking Technology & Electronic Payments
    "LCSW",   # LESECO Egypt
    "HRHO",   # EFG Holding Group
    "TMGH",   # Talaat Moustafa Group Holding
    "MASR",   # Madinat Misr for Housing & Development
    "HELI",   # Heliopolis Housing & Development
    "MFPC",   # Misr Fertilizers Production Company - MOPCO
    "ADIB",   # Abu Dhabi Islamic Bank Egypt
    "KRDI",   # Nahr El-Kheir for Agricultural Development & Environmental Services
]

# TAMAYUZ - Small/micro-cap emerging companies index (5 stocks)
TAMAYUZ_CONSTITUENTS: List[str] = [
    "INEG",   # Integrated Engineering Group
    "IBCT",   # International Business Corporation for Trade & Agencies
    "VERT",   # Vertica for Industry & Trade
    "HBCO",   # HIBCO for Commercial Investments & Real Estate Development
    "UTOP",   # Utopia for Real Estate & Tourism Investment
]


def get_egx30_symbols() -> List[str]:
    """Return EGX30 constituent symbols with EGX: prefix."""
    return [f"EGX:{s}" for s in EGX30_CONSTITUENTS]


def get_egx70_symbols() -> List[str]:
    """Return EGX70 constituent symbols with EGX: prefix."""
    return [f"EGX:{s}" for s in EGX70_CONSTITUENTS]


def get_egx100_symbols() -> List[str]:
    """Return EGX100 (EGX30 + EGX70) constituent symbols with EGX: prefix."""
    return get_egx30_symbols() + get_egx70_symbols()


def get_shariah33_symbols() -> List[str]:
    """Return SHARIAH33 constituent symbols with EGX: prefix."""
    return [f"EGX:{s}" for s in SHARIAH33_CONSTITUENTS]


def get_egx35lv_symbols() -> List[str]:
    """Return EGX35-LV constituent symbols with EGX: prefix."""
    return [f"EGX:{s}" for s in EGX35LV_CONSTITUENTS]


def get_tamayuz_symbols() -> List[str]:
    """Return TAMAYUZ constituent symbols with EGX: prefix."""
    return [f"EGX:{s}" for s in TAMAYUZ_CONSTITUENTS]


# Index metadata
EGX_INDICES: Dict[str, dict] = {
  
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
        "ROTO",  # Rowad Tourism (Al Rowad)
        "ELWA",  # El Wadi For International and Investment Development
        "PHTV",  # Pyramisa Hotels
        "EGTS",  # Egyptian for Tourism Resorts
        "TRTO",  # TransOceans Tours
        "RTVC",  # Remco for Touristic Villages Construction
    },

    "utilities": {
        "EGAS", # Natural Gas & Mining Project (Egypt Gas)
        "TAQA", # Taqa Arabia
    },

    "it_media_and_communication": {
        "DGTZ",  # Digitize for Investment And Technology
        "MPRC",  # Egyptian Media Production City
        "EGSA",  # Egyptian Satellites (NileSat) (USD)
        "EFIH",  # E-finance
        "RACC",  # Raya Customer Experience
        "OIH",   # Orascom Investment Holding
        "FWRY",  # Fawry
        "ETEL",  # Telecom Egypt
    },

    "food_beverages_and_tobacco": {
        "ELNA",  # El Nasr For Manufacturing Agricultural Crops
        "KRDI",  # Al Khair River For Development Agricultural Investment & Environmental Services
        "GSSC",  # General Silos & Storage
        "CEFM",  # Middle Egypt Flour Mills
        "SUGR",  # Delta Sugar
        "ADPC",  # The Arab Dairy Products Co. Arab Dairy - Panda
        "LUTS",  # Lotus For Agricultural Investments And Development
        "GGRN",  # Gogreen for Agricultural Investment
        "INFI",  # Ismailia National Food Industries
        "ISMA",  # Ismailia Misr Poultry
        "MPCO",  # Mansourah Poultry
        "POUL",  # Cairo Poultry
        "EPCO",  # Egypt for Poultry
        "EAST",  # Eastern Company
        "ZEOT",  # Extracted Oils
        "MILS",  # North Cairo Mills
        "AFMC",  # Alexandria Flour Mills
        "UEFM",  # Upper Egypt Flour Mills
        "WCDF",  # Middle & West Delta Flour Mills
        "SCFM",  # South Cairo & Giza Mills & Bakeries
        "COSG",  # Cairo Oils & Soap
        "MOSC",  # Misr Oils & Soap
        "AJWA",  # AJWA for Food Industries company Egypt
        "SNFC",  # Sharkia National Food
        "DOMT",  
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

### Core Architecture Module: `src/tradingview_mcp/core/services/egx_service.py`
```
"""
EGX Service — all business logic for Egyptian Exchange (EGX) market tools.

Contains market overview, sector scanning, index analysis, stock screening,
trade plan generation, and Fibonacci retracement analysis.

All public functions return plain dicts / lists and are independently testable
without the MCP layer.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from tradingview_mcp.core.services.coinlist import load_symbols
from tradingview_mcp.core.services.indicators import (
    compute_metrics,
    extract_extended_indicators,
    compute_stock_score,
    compute_trade_setup,
    compute_trade_quality,
    compute_fibonacci_levels,
    analyze_fibonacci_position,
    detect_trend_for_fibonacci,
)
from tradingview_mcp.core.utils.validators import EXCHANGE_SCREENER, sanitize_timeframe

# Resilience layer (no tradingview_ta dependency; safe to import unconditionally).
from tradingview_mcp.core.services.screener_provider import _scan_with_retry

try:
    # Patched: route through resilience layer (retry + 60s TTL cache).
    import tradingview_ta  # noqa: F401  presence check
    from tradingview_mcp.core.services.screener_provider import (
        resilient_get_multiple_analysis as get_multiple_analysis,
    )
    _TA_AVAILABLE = True
except ImportError:
    _TA_AVAILABLE = False

try:
    from tradingview_screener import Query
    _SCREENER_AVAILABLE = True
except ImportError:
    _SCREENER_AVAILABLE = False


# ── Market Overview ────────────────────────────────────────────────────────────

def get_egx_market_overview(timeframe: str = "1D", limit: int = 10) -> dict:
    """
    Comprehensive EGX market overview: top gainers, losers, most active.

    Args:
        timeframe: TradingView interval (default '1D').
        limit:     Stocks per category (max 20).

    Returns:
        Dict with top_gainers, top_losers, most_active, and market_stats.
    """
    if not _TA_AVAILABLE:
        return {"error": "tradingview_ta is missing; run `uv sync`."}

    symbols = load_symbols("egx")
    if not symbols:
        return {"error": "No EGX symbols found. Check coinlist/egx.txt"}

    screener = EXCHANGE_SCREENER.get("egx", "egypt")
    all_stocks: List[dict] = []
    batch_size = 200
    batches_failed = 0
    symbols_skipped = 0
    first_error: str | None = None

    for i in range(0, len(symbols), batch_size):
        batch = symbols[i : i + batch_size]
        try:
            analysis = get_multiple_analysis(screener=screener, interval=timeframe, symbols=batch)
        except Exception as exc:
            # Count instead of swallowing outright — a systemic failure
            # (auth change, schema change) used to surface only as
            # "No data returned for EGX stocks" with zero diagnostic.
            batches_failed += 1
            if first_error is None:
                first_error = repr(exc)
            continue

        for sym, data in analysis.items():
            if data is None:
                continue
            try:
                ind = data.indicators
                metrics = compute_metrics(ind)
                if not metrics:
                    continue
                all_stocks.append(
                    {
                        "symbol": sym,
                        "price": metrics.get("price", 0),
                        "changePercent": metrics.get("change", 0),
                        "volume": ind.get("volume", 0),
                        "rsi": round(ind.get("RSI", 0) or 0, 2),
                        "bbw": metrics.get("bbw", 0),
                        "rating": metrics.get("rating", 0),
                        "signal": metrics.get("signal", "N/A"),
                    }
                )
            except Exception:
                symbols_skipped += 1
                continue

    if not all_stocks:
        out = {"error": "No data returned for EGX stocks", "timeframe": timeframe}
        if batches_failed:
            out["batches_failed"] = batches_failed
            out["first_error"] = first_error
        return out

    by_change = sorted(all_stocks, key=lambda x: x["changePercent"], reverse=True)
    by_volume = sorted(all_stocks, key=lambda x: x["volume"] or 0, reverse=True)

    return {
        "exchange": "EGX",
        "timeframe": timeframe,
        "total_analyzed": len(all_stocks),
        "batches_failed": batches_failed,
        "symbols_skipped": symbols_skipped,
        "top_gainers": by_change[:limit],
        "top_losers": by_change[-limit:][::-1],
        "most_active": by_volume[:limit],
        "market_stats": {
            "advancing": len([s for s in all_stocks if s["changePercent"] > 0]),
            "declining": len([s for s in all_stocks if s["changePercent"] < 0]),
            "unchanged": len([s for s in all_stocks if s["changePercent"] == 0]),
            "avg_change": (
                round(sum(s["changePercent"] for s in all_stocks) / len(all_stocks), 2)
                if all_stocks else 0
            ),
        },
    }


# ── Sector Scan ────────────────────────────────────────────────────────────────

def scan_egx_sector(sector: str = "", timeframe: str = "1D", limit: int = 20) -> dict:
    """
    Scan EGX stocks by sector, or list all available sectors.

    Args:
        sector:    Sector key (empty string → list all sectors).
        timeframe: TradingView interval (default '1D').
        limit:     Max results per sector.

    Returns:
        Sector data dict or available sectors list.
    """
    from tradingview_mcp.core.data.egx_sectors import (
        get_all_sectors,
        get_symbols_by_sector,
        get_sector,
    )

    if not sector:
        return {
            "available_sectors": get_all_sectors(),
            "usage": "Pass a sector name to scan. Example: sector='banks'",
        }

    if not _TA_AVAILABLE:
        return {"error": "tradingview_ta is missing; run `uv sync`."}

    sector_key = sector.strip().lower().replace(" ", "_")
    symbols = get_symbols_by_sector(sector_key)

    if not symbols:
        return {
            "error": f"Unknown sector: {sector}",
            "available_sectors": get_all_sectors(),
        }

    screener = EXCHANGE_SCREENER.get("egx", "egypt")

    try:
        analysis = get_multiple_analysis(screener=screener, interval=timeframe, symbols=symbols)
    except Exception as exc:
        return {"error": f"Analysis failed: {exc}"}

    results: List[dict] = []
    for sym, data in analysis.items():
        if data is None:
            continue
        try:
            ind = data.indicators
            metrics = compute_metrics(ind)
            if not metrics:
                continue
            results.append(
                {
                    "symbol": sym,
                    "sector": get_sector(sym),
                    "price": metrics.get("price", 0),
                    "changePercent": metrics.get("change", 0),
                    "volume": ind.get("volume", 0),
                    "rsi": round(ind.get("RSI", 0) or 0, 2),
                    "bbw": metrics.get("bbw", 0),
                    "rating": metrics.get("rating", 0),
                    "signal": metrics.get("signal", "N/A"),
                    "bb_upper": round(ind.get("BB.upper", 0) or 0, 4),
                    "bb_lower": round(ind.get("BB.lower", 0) or 0, 4),
                    "sma20": round(ind.get("SMA20", 0) or 0, 4),
                    "ema50": round(ind.get("EMA50", 0) or 0, 4),
                }
            )
        except Exception:
            continue

    results.sort(key=lambda x: x["changePercent"], reverse=True)
    sector_changes = [r["changePercent"] for r in results if r["changePercent"] is not None]
    avg_change = round(sum(sector_changes) / len(sector_changes), 2) if sector_changes else 0

    return {
        "exchange": "EGX",
        "sector": sector_key,
        "timeframe": timeframe,
        "total_stocks": len(results),
        "sector_avg_change": avg_change,
        "sector_sentiment": "Bullish" if avg_change > 0.5 else "Bearish" if avg_change < -0.5 else "Neutral",
        "data": results[:limit],
    }


# ── Sector Rotation Scanner ────────────────────────────────────────────────────

def _compute_sector_momentum_score(
    avg_change: float,
    avg_rsi: float,
    breadth_pct: float,
    volume_flow_positive: bool,
    change_rank_pct: float,
) -> int:
    """Compute a 0–100 sector momentum score from four components."""
    change_pts = round(change_rank_pct * 30)

    if 50 <= avg_rsi <= 70:
        rsi_pts = 25
    elif 40 <= avg_rsi < 50 or 70 < avg_rsi <= 80:
        rsi_pts = 15
    elif 30 <= avg_rsi < 40:
        rsi_pts = 10
    elif avg_rsi > 80:
        rsi_pts = 5
    else:
        rsi_pts = 8

    breadth_pts = round(min(breadth_pct, 100) / 100 * 25)
    volume_pts = 20 if volume_flow_positive else 0
    return max(0, min(100, change_pts + rsi_pts + breadth_pts + volume_pts))


def _generate_rotation_signals(ranked_sectors: list) -> List[str]:
    """Generate human-readable money-rotation signals from a ranked heatmap."""
    signals: List[str] = []
    for s in ranked_sectors:
        if s["status"] == "Hot":
            signals.append(
                f"Money rotating INTO {s['display_name']} "
                f"(Hot, {s['avg_change_pct']:+.2f}% avg, "
                f"{s['volume_flow']['signal'].lower()}, "
                f"weight {s['market_cap_weight']}%)"
            )
        elif s["status"] == "Cold":
            signals.append(
                f"Money rotating OUT OF {s['display_name']} "
                f"(Cold, {s['avg_change_pct']:+.2f}% avg, "
                f"{s['volume_flow']['signal'].lower()}, "
                f"weight {s['market_cap_weight']}%)"
            )
    return signals


def run_egx_sector_scanner(
    timeframe: str = "1D",
    top_n_sectors: int = 5,
    top_n_stocks: int = 3,
    min_stock_score: int = 60,
) -> dict:
    """
    Full EGX sector rotation scanner — ra
```

### Core Architecture Module: `src/tradingview_mcp/core/services/extended_hours_service.py`
```
"""
Extended-hours price service for US stocks.

Why this exists: a paying customer (US Army officer who trades on mobile)
asked "can you pull real-time after/extended hours?". He's tracking stocks
in the pre-market 4:00-9:30am ET and after-hours 4:00-8:00pm ET sessions
where earnings reactions and overnight news land.

Yahoo Finance's chart endpoint with `includePrePost=true` returns 1-minute
candles for the full extended trading day. We walk through the candles,
classify each by which session window it falls in (using the response's
`currentTradingPeriod` boundaries), and report the most recent valid close
for each session.

Behavior across the trading day:
- Pre-market session (4:00-9:30am ET): pre_market populated, post null
- Regular session (9:30am-4:00pm ET): pre + regular populated, post null
- Post-market session (4:00-8:00pm ET): all three populated
- Overnight / weekend: returns whatever's most recent in each window

Returns `null` for whichever session has no data — Claude can quote that
back to the user as "no after-hours print yet" rather than guessing.
"""
from __future__ import annotations

import json
import time
import urllib.request
import urllib.error
from typing import Optional

import httpx

from tradingview_mcp.core.services.proxy_manager import get_httpx_proxy

_TIMEOUT = 12
_UA = "tradingview-mcp/0.8.1"
_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"


def _quote_url(symbol: str) -> str:
    return f"{_BASE}/{symbol}?interval=1m&range=1d&includePrePost=true"


def _change_pct(price: Optional[float], reference: Optional[float]) -> Optional[float]:
    """Percentage change from reference to price; None if either is missing."""
    if price is None or reference is None or reference == 0:
        return None
    return round((price - reference) / reference * 100, 2)


def _fmt_time(ts: Optional[int]) -> Optional[str]:
    if ts is None:
        return None
    return time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(ts))


def _shape_extended_hours(symbol: str, data: dict) -> dict:
    """Pure formatter for the Yahoo chart response. Shared sync + async."""
    try:
        result = data["chart"]["result"][0]
        meta = result["meta"]
        period = meta["currentTradingPeriod"]
        timestamps = result["timestamp"]
        closes = result["indicators"]["quote"][0]["close"]
    except (KeyError, IndexError, TypeError) as e:
        return {"symbol": symbol.upper(), "error": f"unexpected response shape: {e}"}

    regular_start = period["regular"]["start"]
    regular_end = period["regular"]["end"]

    pre_price, pre_time = None, None
    regular_price_intraday, regular_time = None, None
    post_price, post_time = None, None

    for ts, c in zip(timestamps, closes):
        if c is None:
            continue
        if ts < regular_start:
            pre_price, pre_time = c, ts
        elif ts <= regular_end:
            regular_price_intraday, regular_time = c, ts
        else:
            post_price, post_time = c, ts

    # Prefer the meta `regularMarketPrice` (consolidated tape); fall back to
    # latest 1m candle if meta missing.
    regular_close = meta.get("regularMarketPrice") or regular_price_intraday
    previous_close = meta.get("previousClose") or meta.get("chartPreviousClose")

    out = {
        "symbol": symbol.upper(),
        "currency": meta.get("currency", "USD"),
        "exchange": meta.get("exchangeName"),
        "market_state": meta.get("marketState"),
        "previous_close": previous_close,
        "pre_market": None,
        "regular": None,
        "post_market": None,
        "source": "Yahoo Finance",
    }

    if pre_price is not None:
        out["pre_market"] = {
            "price": pre_price,
            "as_of_utc": _fmt_time(pre_time),
            "change_vs_previous_close_pct": _change_pct(pre_price, previous_close),
        }

    if regular_close is not None:
        out["regular"] = {
            "price": regular_close,
            "as_of_utc": _fmt_time(meta.get("regularMarketTime") or regular_time),
            "change_pct": _change_pct(regular_close, previous_close),
        }

    if post_price is not None:
        out["post_market"] = {
            "price": post_price,
            "as_of_utc": _fmt_time(post_time),
            "change_vs_regular_close_pct": _change_pct(post_price, regular_close),
        }

    return out


def get_extended_hours_price(symbol: str) -> dict:
    """Fetch latest pre-market, regular-session, and post-market prices (sync).

    Args:
        symbol: US stock symbol (e.g. AAPL, NVDA, SPY, ^GSPC).

    Returns:
        Dict with `pre_market`, `regular`, `post_market` blocks plus computed
        percentage changes. On upstream failure, returns `{symbol, error}`.
    """
    req = urllib.request.Request(
        _quote_url(symbol),
        headers={"User-Agent": _UA, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, json.JSONDecodeError) as e:
        return {"symbol": symbol.upper(), "error": f"{type(e).__name__}: {e}"}

    return _shape_extended_hours(symbol, data)


async def get_extended_hours_price_async(symbol: str) -> dict:
    """Async version of :func:`get_extended_hours_price` (uses httpx).

    Same return shape, including the error envelope on failure.
    """
    proxy = get_httpx_proxy()
    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT,
            headers={"User-Agent": _UA, "Accept": "application/json"},
            proxy=proxy,
        ) as client:
            resp = await client.get(_quote_url(symbol))
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        return {"symbol": symbol.upper(), "error": f"{type(e).__name__}: {e}"}

    return _shape_extended_hours(symbol, data)

```

### Core Architecture Module: `src/tradingview_mcp/core/services/futures_service.py`
```
"""
Futures Service — TradingView futures market data via tradingview_screener.

Covers CME, COMEX, NYMEX, CBOT, and optionally ICE/EUREX.
"""
from __future__ import annotations

from typing import Any

try:
    from tradingview_screener import Query
    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False


def _futures_query():
    """Build a query targeting the TradingView *futures* scanner.

    We deliberately use ``Query().set_markets("futures")`` instead of the
    ``futures()`` helper shipped in tradingview-screener 3.2+. Starting in
    3.2.0 every bare ``Query()`` / ``futures()`` injects a default *stock*
    preset (an ``is_primary`` filter plus an equity ``type``/``typespecs``
    filter2) that silently returns 0 rows for non-equity markets — which would
    break both this module and the crypto screener tools. tradingview-screener
    is pinned to ==3.0.0 in pyproject.toml for exactly this reason; if you ever
    lift that pin, you must clear the stock preset (drop ``filter``/``filter2``)
    before querying futures or crypto.
    """
    if not _AVAILABLE:
        raise RuntimeError("tradingview_screener not installed")
    return Query().set_markets("futures")


# Exchanges grouped by category for filtering
US_FUTURES_EXCHANGES = ["CME", "COMEX", "NYMEX", "CBOT"]
ALL_FUTURES_EXCHANGES = ["CME", "COMEX", "NYMEX", "CBOT", "ICEEUR", "ICESG", "EUREX"]

# Well-known front-month continuous contract symbols
FUTURES_WATCHLIST: dict[str, list[str]] = {
    "equity_index": [
        "CME_MINI:ES1!", "CME_MINI:NQ1!", "CME_MINI:RTY1!", "CBOT_MINI:YM1!",
        "CME_MINI:EMD1!", "CME:NKD1!",
    ],
    "energy": [
        "NYMEX:CL1!", "NYMEX:NG1!", "NYMEX:HO1!", "NYMEX:RB1!",
        "NYMEX:MCL1!", "ICEEUR:BRN1!",
    ],
    "metals": [
        "COMEX:GC1!", "COMEX:SI1!", "COMEX:HG1!", "NYMEX:PL1!",
        "NYMEX:PA1!", "COMEX:ALI1!", "COMEX:ZNC1!",
    ],
    "agriculture": [
        "CBOT:ZC1!", "CBOT:ZW1!", "CBOT:ZS1!", "CBOT:ZL1!",
        "CBOT:ZM1!", "CME:LE1!", "CME:HE1!",
    ],
    "rates": [
        "CBOT:ZN1!", "CBOT:ZF1!", "CBOT:ZT1!", "CBOT:ZB1!",
        "CBOT:TN1!", "CBOT:UB1!", "CME:SR31!",
    ],
    "forex": [
        "CME:6E1!", "CME:6B1!", "CME:6J1!", "CME:6A1!",
        "CME:6C1!", "CME:6S1!",
    ],
    "crypto_futures": [
        "CME:BTC1!", "CME:MBT1!", "CME:ETH1!", "CME:MET1!",
    ],
}

_SCREENER_COLS = [
    "name", "description", "close", "open", "high", "low",
    "volume", "change", "change_abs", "currency", "exchange",
]

# get_scanner_data forwards kwargs to requests.post, which has NO default
# timeout — a stalled TradingView endpoint would otherwise hang the worker
# thread (and the MCP tool call) indefinitely.
_SCAN_TIMEOUT_S = 20


def _build_query(exchanges: list[str], volume_min: int = 0, limit: int = 50):
    q = _futures_query()
    q = q.select(*_SCREENER_COLS)
    filters = [{"left": "exchange", "operation": "in_range", "right": exchanges}]
    if volume_min > 0:
        filters.append({"left": "volume", "operation": "greater", "right": volume_min})
    q.query["filter"] = filters
    q.query["range"] = [0, limit]
    return q


def _tickers_query(symbols: list[str]):
    """Query a fixed set of contracts by ticker (no exchange/volume filter)."""
    q = _futures_query()
    q = q.select(*_SCREENER_COLS)
    q.query["symbols"] = {"tickers": symbols}
    q.query.pop("filter", None)
    q.query["range"] = [0, len(symbols)]
    return q


def get_futures_overview(
    category: str = "all",
    exchanges: str = "us",
    limit: int = 30,
    volume_min: int = 0,
) -> dict[str, Any]:
    """
    Top futures contracts sorted by volume.

    Args:
        category: all | equity_index | energy | metals | agriculture | rates | forex | crypto_futures
        exchanges: us (CME/COMEX/NYMEX/CBOT) | global (adds ICE/EUREX)
        limit: max rows
        volume_min: minimum volume filter
    """
    ex_list = ALL_FUTURES_EXCHANGES if exchanges.lower() == "global" else US_FUTURES_EXCHANGES

    # For a specific known category, query its contracts directly and rank them
    # by volume. A thinly-traded category (e.g. metals) often does NOT appear in
    # the top `limit` rows of an all-futures volume scan, so the old approach of
    # "scan everything, then filter by name" returned nothing — and then
    # silently fell back to the full unfiltered list, mislabeling unrelated
    # contracts under the requested category. Querying the category tickers is
    # both reliable and honest.
    if category != "all" and category in FUTURES_WATCHLIST:
        symbols = FUTURES_WATCHLIST[category]
        q = _tickers_query(symbols)
        q.query["sort"] = {"sortBy": "volume", "sortOrder": "desc"}
        count, df = q.get_scanner_data(timeout=_SCAN_TIMEOUT_S)
        rows = df.to_dict(orient="records")
        return {
            "category": category,
            "exchanges": ex_list,
            "total_available": count,
            "returned": len(rows),
            "contracts": rows,
        }

    # category == "all" (or unrecognized): broad volume scan across exchanges.
    q = _build_query(ex_list, volume_min=volume_min, limit=limit)
    q.query["sort"] = {"sortBy": "volume", "sortOrder": "desc"}
    count, df = q.get_scanner_data(timeout=_SCAN_TIMEOUT_S)
    rows = df.to_dict(orient="records")
    return {
        "category": category,
        "exchanges": ex_list,
        "total_available": count,
        "returned": len(rows),
        "contracts": rows,
    }


def get_futures_movers(
    direction: str = "gainers",
    exchanges: str = "us",
    limit: int = 20,
    volume_min: int = 10,
) -> dict[str, Any]:
    """Top futures gainers or losers by % change."""
    direction = direction.lower().strip()
    if direction not in ("gainers", "losers"):
        # A typo like "gainer" used to silently return LOSERS (any value
        # other than the literal "gainers" fell into the asc branch).
        return {"error": f"Unknown direction '{direction}'. Valid: gainers, losers"}
    ex_list = ALL_FUTURES_EXCHANGES if exchanges.lower() == "global" else US_FUTURES_EXCHANGES
    q = _build_query(ex_list, volume_min=volume_min, limit=limit)
    sort_order = "desc" if direction == "gainers" else "asc"
    q.query["sort"] = {"sortBy": "change", "sortOrder": sort_order}
    count, df = q.get_scanner_data(timeout=_SCAN_TIMEOUT_S)
    return {
        "direction": direction,
        "total_available": count,
        "contracts": df.to_dict(orient="records"),
    }


def get_futures_category_snapshot(category: str) -> dict[str, Any]:
    """
    Get quote for all well-known contracts in a specific category.

    Args:
        category: equity_index | energy | metals | agriculture | rates | forex | crypto_futures
    """
    symbols = FUTURES_WATCHLIST.get(category)
    if not symbols:
        valid = list(FUTURES_WATCHLIST.keys())
        return {"error": f"Unknown category '{category}'. Valid: {valid}"}

    q = _tickers_query(symbols)

    try:
        count, df = q.get_scanner_data(timeout=_SCAN_TIMEOUT_S)
    except Exception as exc:
        # Do NOT silently fall back to an unrelated volume scan — that returns
        # contracts the caller never asked for, mislabeled under this category.
        # Surface the failure honestly instead.
        return {
            "category": category,
            "error": f"futures snapshot request failed: {exc}",
            "requested": symbols,
            "contracts": [],
        }

    return {
        "category": category,
        "requested": symbols,
        "returned": len(df),
        "contracts": df.to_dict(orient="records"),
    }


def get_futures_watchlist() -> dict[str, Any]:
    """Return the full categorized futures watchlist with all front-month symbols."""
    return {
        "description": "Well-known continuous front-month futures contracts by category",
        "categories": FUTURES_WATCHLIST,
        "total_symbols": sum(len(v) for v in FUTURES_WATCHLIST.values()),
    }

```

### Core Architecture Module: `src/tradingview_mcp/core/services/indicators.py`
```
from __future__ import annotations
from typing import Dict, Optional, Tuple


def compute_change(open_price: float, close: float) -> float:
    return ((close - open_price) / open_price) * 100 if open_price else 0.0


def compute_bbw(sma: float, bb_upper: float, bb_lower: float) -> Optional[float]:
    # `not sma` already excludes 0 (and None), so no ZeroDivisionError here.
    if not sma:
        return None
    return (bb_upper - bb_lower) / sma


def compute_bb_rating_signal(close: float, bb_upper: float, bb_middle: float, bb_lower: float) -> Tuple[int, str]:
    rating = 0
    if close > bb_upper:
        rating = 3
    elif close > bb_middle + ((bb_upper - bb_middle) / 2):
        rating = 2
    elif close > bb_middle:
        rating = 1
    elif close < bb_lower:
        rating = -3
    elif close < bb_middle - ((bb_middle - bb_lower) / 2):
        rating = -2
    elif close < bb_middle:
        rating = -1

    # A close beyond the band (|rating| == 3) is the strongest reading this
    # measure produces — it must stay on its own side, never fall back to
    # NEUTRAL (a breakout day previously read as a downgrade in signal_change).
    signal = "NEUTRAL"
    if rating >= 2:
        signal = "BUY"
    elif rating <= -2:
        signal = "SELL"
    return rating, signal


def compute_metrics(indicators: Dict) -> Optional[Dict]:
    try:
        open_price = indicators["open"]
        close = indicators["close"]
        sma = indicators["SMA20"]
        bb_upper = indicators["BB.upper"]
        bb_lower = indicators["BB.lower"]
        bb_middle = sma

        change = compute_change(open_price, close)
        bbw = compute_bbw(sma, bb_upper, bb_lower)
        rating, signal = compute_bb_rating_signal(close, bb_upper, bb_middle, bb_lower)

        return {
            "price": round(close, 4),
            "open": round(open_price, 4),
            "change": round(change, 3),
            "bbw": round(bbw, 4) if bbw is not None else None,
            "rating": rating,
            "signal": signal,
        }
    except (KeyError, TypeError):
        return None


def _safe_round(value, decimals: int = 4):
    """Round a value safely, returning None if the value is None or invalid."""
    if value is None:
        return None
    try:
        return round(float(value), decimals)
    except (TypeError, ValueError):
        return None


def extract_extended_indicators(indicators: Dict) -> Dict:
    """Extract extended technical indicators from TradingView data.

    Returns a dict with RSI, OBV, SMA, EMA, ATR, MACD, Volume, Support/Resistance,
    Bollinger Bands, and market structure details.
    """
    close = indicators.get("close")
    open_price = indicators.get("open")
    high = indicators.get("high")
    low = indicators.get("low")
    volume = indicators.get("volume")

    # --- RSI ---
    rsi_value = indicators.get("RSI")
    rsi_signal = "Neutral"
    if rsi_value is not None:
        if rsi_value > 70:
            rsi_signal = "Overbought"
        elif rsi_value > 60:
            rsi_signal = "Bullish"
        elif rsi_value < 30:
            rsi_signal = "Oversold"
        elif rsi_value < 40:
            rsi_signal = "Bearish"

    rsi = {
        "value": _safe_round(rsi_value, 2),
        "signal": rsi_signal,
    }

    # --- OBV (On Balance Volume) ---
    obv_direction = None
    if volume is not None and open_price and close:
        obv_direction = "accumulation" if close > open_price else "distribution" if close < open_price else "neutral"

    obv = {
        "current_volume": _safe_round(volume, 0),
        "direction": obv_direction,
        "note": "OBV direction inferred from current candle (close vs open)",
    }

    # --- SMA (Simple Moving Average) ---
    sma10 = indicators.get("SMA10")
    sma20 = indicators.get("SMA20")
    sma30 = indicators.get("SMA30")
    sma50 = indicators.get("SMA50")
    sma100 = indicators.get("SMA100")
    sma200 = indicators.get("SMA200")

    sma_data = {
        "sma10": _safe_round(sma10, 4),
        "sma20": _safe_round(sma20, 4),
        "sma30": _safe_round(sma30, 4),
        "sma50": _safe_round(sma50, 4),
        "sma100": _safe_round(sma100, 4),
        "sma200": _safe_round(sma200, 4),
    }

    # SMA trend signals
    sma_signals = []
    if close and sma50:
        if close > sma50:
            sma_signals.append("Price above SMA50 (bullish)")
        else:
            sma_signals.append("Price below SMA50 (bearish)")
    if close and sma200:
        if close > sma200:
            sma_signals.append("Price above SMA200 (long-term bullish)")
        else:
            sma_signals.append("Price below SMA200 (long-term bearish)")
    if sma50 and sma200:
        if sma50 > sma200:
            sma_signals.append("Golden Cross (SMA50 > SMA200)")
        else:
            sma_signals.append("Death Cross (SMA50 < SMA200)")

    sma_data["signals"] = sma_signals

    # --- EMA (Exponential Moving Average) ---
    ema9 = indicators.get("EMA9")
    ema10 = indicators.get("EMA10")
    ema20 = indicators.get("EMA20")
    ema30 = indicators.get("EMA30")
    ema50 = indicators.get("EMA50")
    ema100 = indicators.get("EMA100")
    ema200 = indicators.get("EMA200")

    ema_data = {
        "ema9": _safe_round(ema9, 4),
        "ema10": _safe_round(ema10, 4),
        "ema20": _safe_round(ema20, 4),
        "ema30": _safe_round(ema30, 4),
        "ema50": _safe_round(ema50, 4),
        "ema100": _safe_round(ema100, 4),
        "ema200": _safe_round(ema200, 4),
    }

    # EMA trend signals
    ema_signals = []
    if close and ema20:
        if close > ema20:
            ema_signals.append("Price above EMA20 (short-term bullish)")
        else:
            ema_signals.append("Price below EMA20 (short-term bearish)")
    if close and ema50:
        if close > ema50:
            ema_signals.append("Price above EMA50 (mid-term bullish)")
        else:
            ema_signals.append("Price below EMA50 (mid-term bearish)")
    if close and ema200:
        if close > ema200:
            ema_signals.append("Price above EMA200 (long-term bullish)")
        else:
            ema_signals.append("Price below EMA200 (long-term bearish)")
    if ema50 and ema200:
        if ema50 > ema200:
            ema_signals.append("Golden Cross (EMA50 > EMA200)")
        else:
            ema_signals.append("Death Cross (EMA50 < EMA200)")
    if ema9 and ema20:
        if ema9 > ema20:
            ema_signals.append("Fast EMA bullish (EMA9 > EMA20)")
        else:
            ema_signals.append("Fast EMA bearish (EMA9 < EMA20)")

    ema_data["signals"] = ema_signals

    # --- ATR (Average True Range) ---
    atr_value = indicators.get("ATR")
    atr_pct = None
    if atr_value is not None and close and close > 0:
        atr_pct = (atr_value / close) * 100

    atr = {
        "value": _safe_round(atr_value, 4),
        "percent_of_price": _safe_round(atr_pct, 2),
        # Missing ATR is "Unknown", not "Low" — asserting calm markets on
        # absent data misleads downstream risk sizing.
        "volatility": (
            "Unknown" if atr_pct is None
            else "High" if atr_pct > 3
            else "Medium" if atr_pct > 1.5
            else "Low"
        ),
    }

    # --- MACD ---
    macd_line = indicators.get("MACD.macd")
    macd_signal_line = indicators.get("MACD.signal")
    macd_histogram = None
    macd_crossover = "Neutral"
    if macd_line is not None and macd_signal_line is not None:
        macd_histogram = macd_line - macd_signal_line
        if macd_line > macd_signal_line:
            macd_crossover = "Bullish"
        elif macd_line < macd_signal_line:
            macd_crossover = "Bearish"

    macd = {
        "macd_line": _safe_round(macd_line, 6),
        "signal_line": _safe_round(macd_signal_line, 6),
        "histogram": _safe_round(macd_histogram, 6),
        "crossover": macd_crossover,
    }

    # --- Volume ---
    volume_sma20 = indicators.get("volume.SMA20")
    volume_ratio = None
    volume_signal = "Normal"
    if volume is not None and volume_sma20 and volume_sma20 > 0:
        volume_ratio = volume / volume_sma20
        if volume_ratio >= 3.0:
            volume_signal = "Very High"
        elif volume_ratio >= 2.0:
            volume_signal = "High"
        elif volume_ratio >= 1.5:
            volume_signal = "Above Average"
        elif volume_ratio < 0.5:
            volume_signal = "Very Low"
        elif volume_ratio < 0.8:
            volume_signal = "Below Average"

    volume_data = {
        "current": _safe_round(volume, 0),
        "average_20": _safe_round(volume_sma20, 0),
        "ratio": _safe_round(volume_ratio, 2),
        "signal": volume_signal,
    }

    # --- Bollinger Bands ---
    bb_upper = indicators.get("BB.upper")
    bb_lower = indicators.get("BB.lower")
    bb_middle = sma20  # BB middle = SMA20

    bb_data = {
        "upper": _safe_round(bb_upper, 4),
        "middle": _safe_round(bb_middle, 4),
        "lower": _safe_round(bb_lower, 4),
    }

    if bb_upper and bb_lower and bb_middle and bb_middle > 0:
        bbw = (bb_upper - bb_lower) / bb_middle
        bb_data["width"] = _safe_round(bbw, 4)
        bb_data["squeeze"] = bbw < 0.02
    else:
        bb_data["width"] = None
        bb_data["squeeze"] = False

    if close and bb_upper and bb_lower:
        if close > bb_upper:
            bb_data["position"] = "Above Upper Band"
        elif close < bb_lower:
            bb_data["position"] = "Below Lower Band"
        elif bb_middle and close > bb_middle:
            bb_data["position"] = "Upper Half"
        else:
            bb_data["position"] = "Lower Half"
    else:
        bb_data["position"] = "Unknown"

    # --- Support & Resistance (from Pivot Points) ---
    support_resistance = _extract_support_resistance(indicators, close)

    # --- Stochastic ---
    stoch_k = indicators.get("Stoch.K")
    stoch_d = indicators.get("Stoch.D")
    stoch_signal = "Neutral"
    if stoch_k is 
```

### Core Architecture Module: `src/tradingview_mcp/core/services/indicators_calc.py`
```
"""
Technical Indicators Calculator — pure Python stdlib, zero dependencies.

All functions take a list of float closing prices (or OHLCV dicts)
and return computed indicator values.

Indicators:
  - EMA, SMA
  - RSI (Wilder's smoothing)
  - Bollinger Bands
  - MACD
  - ATR (Average True Range)
  - Supertrend
  - Donchian Channel
  - ADX (Average Directional Index)
"""
from __future__ import annotations

import math
from typing import Optional


# ─── EMA ──────────────────────────────────────────────────────────────────────

def calc_ema(closes: list[float], period: int) -> list[Optional[float]]:
    """Exponential Moving Average. First (period-1) values are None."""
    result: list[Optional[float]] = [None] * len(closes)
    if len(closes) < period:
        return result
    k = 2 / (period + 1)
    # seed with SMA
    sma = sum(closes[:period]) / period
    result[period - 1] = sma
    for i in range(period, len(closes)):
        result[i] = closes[i] * k + result[i - 1] * (1 - k)
    return result


# ─── SMA ──────────────────────────────────────────────────────────────────────

def calc_sma(closes: list[float], period: int) -> list[Optional[float]]:
    """Simple Moving Average."""
    result: list[Optional[float]] = [None] * len(closes)
    for i in range(period - 1, len(closes)):
        result[i] = sum(closes[i - period + 1 : i + 1]) / period
    return result


# ─── RSI ──────────────────────────────────────────────────────────────────────

def calc_rsi(closes: list[float], period: int = 14) -> list[Optional[float]]:
    """
    Relative Strength Index (Wilder's smoothing).
    First (period) values are None.
    """
    result: list[Optional[float]] = [None] * len(closes)
    if len(closes) < period + 1:
        return result

    gains, losses = [], []
    for i in range(1, period + 1):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))

    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period

    if avg_loss == 0:
        result[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        result[period] = 100 - (100 / (1 + rs))

    for i in range(period + 1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gain = max(diff, 0)
        loss = max(-diff, 0)
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        if avg_loss == 0:
            result[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            result[i] = 100 - (100 / (1 + rs))

    return result


# ─── Bollinger Bands ──────────────────────────────────────────────────────────

def calc_bollinger(
    closes: list[float], period: int = 20, std_mult: float = 2.0
) -> dict[str, list[Optional[float]]]:
    """
    Bollinger Bands.
    Returns dict with 'upper', 'middle' (SMA), 'lower' lists.
    """
    middle = calc_sma(closes, period)
    upper: list[Optional[float]] = [None] * len(closes)
    lower: list[Optional[float]] = [None] * len(closes)

    for i in range(period - 1, len(closes)):
        window = closes[i - period + 1 : i + 1]
        mean = middle[i]
        variance = sum((x - mean) ** 2 for x in window) / period
        std = math.sqrt(variance)
        upper[i] = mean + std_mult * std
        lower[i] = mean - std_mult * std

    return {"upper": upper, "middle": middle, "lower": lower}


# ─── MACD ─────────────────────────────────────────────────────────────────────

def calc_macd(
    closes: list[float],
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> dict[str, list[Optional[float]]]:
    """
    MACD = EMA(fast) - EMA(slow).
    Signal = EMA(MACD, signal_period).
    Histogram = MACD - Signal.
    """
    ema_fast = calc_ema(closes, fast)
    ema_slow = calc_ema(closes, slow)

    n = len(closes)
    macd_line: list[Optional[float]] = [None] * n
    for i in range(n):
        if ema_fast[i] is not None and ema_slow[i] is not None:
            macd_line[i] = ema_fast[i] - ema_slow[i]

    # Signal line = EMA of MACD line (only over non-None values)
    signal_line: list[Optional[float]] = [None] * n
    histogram: list[Optional[float]] = [None] * n

    # Find first valid macd index
    macd_values = [(i, v) for i, v in enumerate(macd_line) if v is not None]
    if len(macd_values) >= signal:
        # Compute EMA of macd values
        macd_only = [v for _, v in macd_values]
        sig_ema = calc_ema(macd_only, signal)
        for j, (orig_i, _) in enumerate(macd_values):
            if sig_ema[j] is not None:
                signal_line[orig_i] = sig_ema[j]
                histogram[orig_i] = macd_line[orig_i] - sig_ema[j]

    return {"macd": macd_line, "signal": signal_line, "histogram": histogram}


# ─── ATR (Average True Range) ─────────────────────────────────────────────────

def calc_atr(
    highs: list[float], lows: list[float], closes: list[float], period: int = 14
) -> list[Optional[float]]:
    """
    Average True Range — measures market volatility.
    True Range = max(H-L, |H-prevC|, |L-prevC|)
    ATR = Wilder's smoothed average of TR.
    """
    n = len(closes)
    result: list[Optional[float]] = [None] * n
    if n < period + 1:
        return result

    trs = []
    for i in range(1, n):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        )
        trs.append(tr)

    # Seed with simple average
    atr = sum(trs[:period]) / period
    result[period] = atr
    for i in range(period + 1, n):
        atr = (atr * (period - 1) + trs[i - 1]) / period
        result[i] = atr

    return result


# ─── Supertrend ───────────────────────────────────────────────────────────────

def calc_supertrend(
    highs: list[float],
    lows: list[float],
    closes: list[float],
    atr_period: int = 10,
    multiplier: float = 3.0,
) -> dict[str, list]:
    """
    Supertrend indicator.
    Returns dict with:
      'direction': 1 (bullish) or -1 (bearish) per candle (None before warmup)
      'upper': upper band values
      'lower': lower band values
    """
    n = len(closes)
    atr = calc_atr(highs, lows, closes, atr_period)

    direction: list[Optional[int]] = [None] * n
    upper: list[Optional[float]] = [None] * n
    lower: list[Optional[float]] = [None] * n

    # prev values for smoothing
    prev_upper = None
    prev_lower = None
    prev_dir   = None

    for i in range(1, n):
        if atr[i] is None:
            continue

        hl2  = (highs[i] + lows[i]) / 2.0
        u    = hl2 + multiplier * atr[i]
        l    = hl2 - multiplier * atr[i]

        # Adjust bands to avoid widening
        if prev_upper is not None:
            u = min(u, prev_upper) if closes[i - 1] < prev_upper else u
            l = max(l, prev_lower) if closes[i - 1] > prev_lower else l

        upper[i] = u
        lower[i] = l

        # Determine direction
        if prev_dir is None:
            direction[i] = 1 if closes[i] > u else -1
        elif prev_dir == 1:
            direction[i] = 1 if closes[i] >= l else -1
        else:
            direction[i] = -1 if closes[i] <= u else 1

        prev_upper = u
        prev_lower = l
        prev_dir   = direction[i]

    return {"direction": direction, "upper": upper, "lower": lower}


# ─── Donchian Channel ─────────────────────────────────────────────────────────

def calc_donchian(
    highs: list[float], lows: list[float], period: int = 20
) -> dict[str, list[Optional[float]]]:
    """
    Donchian Channel.
    Returns dict with 'upper' (highest high), 'lower' (lowest low), 'middle'.
    """
    n = len(highs)
    upper: list[Optional[float]] = [None] * n
    lower: list[Optional[float]] = [None] * n
    middle: list[Optional[float]] = [None] * n

    for i in range(period - 1, n):
        u = max(highs[i - period + 1 : i + 1])
        l = min(lows[i - period + 1 : i + 1])
        upper[i]  = u
        lower[i]  = l
        middle[i] = (u + l) / 2

    return {"upper": upper, "lower": lower, "middle": middle}

```

### Core Architecture Module: `src/tradingview_mcp/core/services/marketaux_service.py`
```
"""
Licensed news + sentiment via the Marketaux API.

Replaces the RSS scrape (news_service.py) and the Reddit scrape
(sentiment_service.py) with a single licensed source. Both public functions
keep the exact names and output shapes of the modules they replace, so
server.py only swaps imports.

Design constraints (free plan: 100 requests/day, 3 articles/request):
  - ONE underlying fetch per symbol serves BOTH news and sentiment —
    articles are the news; their entity sentiment scores are the sentiment.
    combined_analysis therefore costs 1 request, not 2.
  - 4h TTL cache, stale entries retained: on a daily-timeframe product,
    4h-old headlines are fine, and stale beats empty when the budget runs out.
  - Hard daily budget (default 90, env-tunable): once spent, serve stale or a
    shape-compatible "unavailable" payload — never raise into the tool layer.

Env:
  MARKETAUX_API_TOKEN   required for live data (no token -> graceful stub)
  MARKETAUX_DAILY_BUDGET optional, default 90
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Optional

_API_URL = "https://api.marketaux.com/v1/news/all"
_TIMEOUT = 10
_TTL_SECONDS = 4 * 3600
_CACHE_MAX_ENTRIES = 500

# Suffixes used by exchange-style crypto tickers (BTCUSDT -> BTC).
_QUOTE_SUFFIXES = ("USDT", "USDC", "BUSD", "PERP", "USD")
_KNOWN_CRYPTO_BASES = {
    "BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "DOGE", "AVAX", "DOT", "LINK",
    "TRX", "TON", "PEPE", "AAVE", "HYPE", "TAO", "WLD", "SUI", "NEAR", "LTC",
}

_lock = threading.Lock()
_cache: dict[str, tuple[float, list[dict]]] = {}
_budget = {"day": "", "used": 0}


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _budget_left() -> int:
    limit = int(os.environ.get("MARKETAUX_DAILY_BUDGET", "90"))
    if _budget["day"] != _today():
        _budget["day"] = _today()
        _budget["used"] = 0
    return limit - _budget["used"]


def _clean_symbol(symbol: str) -> tuple[str, bool]:
    """BTCUSDT -> ("BTC", True); AAPL -> ("AAPL", False)."""
    s = (symbol or "").upper().strip()
    is_crypto = False
    for suf in _QUOTE_SUFFIXES:
        if s.endswith(suf) and len(s) > len(suf) + 1:
            s = s[: -len(suf)]
            is_crypto = True
            break
    if s in _KNOWN_CRYPTO_BASES:
        is_crypto = True
    return s, is_crypto


def _request(params: dict) -> Optional[list[dict]]:
    """One live Marketaux call. Returns article list, or None on any failure.
    Caller is responsible for budget accounting."""
    token = os.environ.get("MARKETAUX_API_TOKEN", "")
    if not token:
        return None
    q = dict(params)
    q["api_token"] = token
    q.setdefault("language", "en")
    q.setdefault("filter_entities", "true")
    q.setdefault("limit", "3")
    url = f"{_API_URL}?{urllib.parse.urlencode(q)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "tradingview-mcp"})
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data.get("data") or []
    except Exception:
        return None


def _get_articles(symbol: Optional[str], category: str) -> tuple[list[dict], str]:
    """Cached article fetch. Returns (articles, freshness) where freshness is
    "live" | "cached" | "stale" | "unavailable"."""
    if symbol:
        base, is_crypto = _clean_symbol(symbol)
        key = f"sym:{base}"
    else:
        base, is_crypto = "", category == "crypto"
        key = f"cat:{category}"

    now = time.time()
    with _lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < _TTL_SECONDS:
            return hit[1], "cached"
        if _budget_left() <= 0:
            return (hit[1], "stale") if hit else ([], "unavailable")
        _budget["used"] += 1  # reserve before the network call

    if base:
        # Crypto tickers aren't reliably in Marketaux's symbols index — a text
        # search on the base finds coin coverage; equities go through symbols=.
        params = {"search": base} if is_crypto else {"symbols": base}
    elif category == "crypto":
        params = {"search": "cryptocurrency OR bitcoin"}
    else:
        params = {}  # general market news

    articles = _request(params)

    # Equity-style lookup that came back empty may still be a crypto ticker
    # we don't know (e.g. a new coin) — one text-search fallback, budget permitting.
    if base and not is_crypto and articles == []:
        with _lock:
            can_retry = _budget_left() > 0
            if can_retry:
                _budget["used"] += 1
        if can_retry:
            articles = _request({"search": base})

    with _lock:
        if articles is None:
            hit = _cache.get(key)
            return (hit[1], "stale") if hit else ([], "unavailable")
        _cache[key] = (now, articles)
        if len(_cache) > _CACHE_MAX_ENTRIES:
            oldest = min(_cache, key=lambda k: _cache[k][0])
            _cache.pop(oldest, None)
        return articles, "live"


def _clean_text(text: str) -> str:
    import re
    text = re.sub(r"<[^>]+>", "", text or "")
    for entity, char in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&nbsp;", " ")):
        text = text.replace(entity, char)
    return text.strip()


# Keyword fallback for articles Marketaux returns WITHOUT entity scores (its
# text-search path — most crypto coverage — attaches no entities). Same scorer
# the old Reddit service used, applied to licensed headline/description text.
_BULLISH_KEYWORDS = [
    "buy", "bull", "moon", "pump", "long", "call", "up", "gain",
    "strong", "breakout", "bullish", "rally", "surge", "upside",
    "accumulate", "undervalued", "support", "bottom", "recovery",
]
_BEARISH_KEYWORDS = [
    "sell", "bear", "dump", "short", "put", "down", "loss", "weak",
    "crash", "drop", "bearish", "tank", "decline", "downside",
    "overvalued", "resistance", "top", "overbought", "bubble",
]


def _keyword_score(text: str) -> float:
    import re

    # Whole-word matching only: bare substring checks scored "up" inside
    # "supply", "call" inside "recall", "top" inside "stop" — systematically
    # corrupting the bullish/bearish label.
    words = set(re.findall(r"[a-z]+", (text or "").lower()))
    bull = sum(1 for w in _BULLISH_KEYWORDS if w in words)
    bear = sum(1 for w in _BEARISH_KEYWORDS if w in words)
    total = bull + bear
    if total == 0:
        return 0.0
    return (bull - bear) / total


def _label(score: float) -> str:
    if score > 0.2:
        return "Strongly Bullish"
    elif score > 0.05:
        return "Bullish"
    elif score < -0.2:
        return "Strongly Bearish"
    elif score < -0.05:
        return "Bearish"
    return "Neutral"


# ─── Public API (same names/shapes as the modules this replaces) ─────────────

def fetch_news_summary(
    symbol: Optional[str] = None,
    category: str = "stocks",
    limit: int = 10,
) -> dict:
    """Licensed financial news via Marketaux. Same output shape as the old
    RSS-based fetch_news_summary."""
    if not os.environ.get("MARKETAUX_API_TOKEN"):
        return {
            "symbol": symbol, "category": category, "count": 0, "items": [],
            "provider": "marketaux",
            "error": "MARKETAUX_API_TOKEN not configured",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    articles, freshness = _get_articles(symbol, category)
    items = [{
        "title": a.get("title", ""),
        "url": a.get("url", ""),
        "published": a.get("published_at", ""),
        "summary": _clean_text(a.get("description") or a.get("snippet") or "")[:300],
        "source": a.get("source", "Marketaux"),
    } for a in articles[:limit]]
    out = {
        "symbol": symbol,
        "category": category,
        "count": len(items),
        "items": items,
        "provider": "marketaux",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if freshness in ("stale", "unavailable"):
        out["note"] = f"news {freshness}: daily news budget exhausted or provider unreachable"
    return out


def analyze_sentiment(
    symbol: str,
    category: str = "all",
    limit: int = 20,
) -> dict:
    """News-based sentiment via Marketaux entity sentiment scores. Same output
    shape as the old Reddit-based analyze_sentiment (top_posts now carries
    news articles instead of Reddit posts)."""
    base, _ = _clean_symbol(symbol)
    if not os.environ.get("MARKETAUX_API_TOKEN"):
        return {
            "symbol": (symbol or "").upper(), "sentiment_score": 0.0,
            "sentiment_label": "Unavailable", "posts_analyzed": 0,
            "bullish_count": 0, "bearish_count": 0, "neutral_count": 0,
            "top_posts": [], "sources": ["Marketaux news"],
            "provider": "marketaux",
            "error": "MARKETAUX_API_TOKEN not configured",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    articles, freshness = _get_articles(symbol, category)

    scores: list[float] = []
    top: list[dict] = []
    for a in articles:
        # Exact symbol match: startswith attributed FB/FDX sentiment to "F".
        ent_scores = [
            e.get("sentiment_score")
            for e in (a.get("entities") or [])
            if isinstance(e.get("sentiment_score"), (int, float))
            and (e.get("symbol", "").upper() == base if base else True)
        ]
        if not ent_scores:  # fall back to any scored entity on the article
            ent_scores = [
                e.get("sentiment_score")
                for e in (a.get("entities") or [])
                if isinstance(e.get("sentiment_score"), (int, float))
            ]
        if ent_scores:
            art_score = sum(ent_scores) / len(ent_scores)
        else:
            # No entity scores at all (Marketaux's text-search path) —
        
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

### Incident Patch 1: `eade8dce` (2026-10-04)
**Commit Message**: fix: accept TradingView's numeric interval codes as timeframes (#104)

Programmatic integrations send TradingView's native interval codes: minutes
as a bare number ("60", "240") and D / W for day and week. None of them
were in the alias table. Before 0.9.0 an unknown timeframe silently fell back
to the tool default, so a "60" request returned 15m data with nothing to say
so. Since 0.9.0's strict validation the same call raises INVALID_TIMEFRAME.

Measured on the hosted deployment over 30 days: 3,753 calls (40% of all
timeframe-carrying calls to validating tools) came from one integration
sending "60" and "240" to coin_analysis. Pre-0.9.0 they all got 15m data
(RSI 59.8 for both "60" and "240"). With this change they get real 1h
(RSI 65.6) and 4h (RSI 58.6) data.

Maps 5, 15, 60, 240, 1440, D and W onto the supported set. Unsupported
intervals (30m, 120, ...) still fail loudly. Tests cover both directions.

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -4,6 +4,15 @@ All notable changes to this project will be documented in this file.
 
 ## [Unreleased]
 
+### Fixed
+- **TradingView interval codes rejected as timeframes**: `"60"`, `"240"`,
+  `"15"`, `"5"`, `"1440"`, `"D"` and `"W"` are now accepted and mapped to
+  `1h`, `4h`, `15m`, `5m` and `1D` / `1W`. Integrations sending TradingView's
+  native codes used to silently get the tool's default timeframe instead
+  (a `"60"` request returned 15m data), and since 0.9.0's strict validation
+  they got `INVALID_TIMEFRAME`. Unsupported intervals (`30m`, `120`, ...)
+  still fail loudly.
+
 ## [0.9.0] - 2026-08-26
 
 ### Changed (behavior)
```

**File**: `src/tradingview_mcp/core/utils/validators.py` (modified, +13/-0)
```diff
@@ -11,6 +11,19 @@
     "1d": "1D",
     "1w": "1W",
     "1m": "1M",
+    # TradingView's own interval codes: minutes as a bare number, D/W for day
+    # and week. Programmatic integrations send these ("60", "240"). Before
+    # 0.9.0 an unknown value silently fell back to the tool default, so a
+    # "60" request quietly got 15m data; since 0.9.0 it raised
+    # INVALID_TIMEFRAME. Only intervals the server supports are mapped, so
+    # "30", "120" etc. still fail loudly.
+    "5": "5m",
+    "15": "15m",
+    "60": "1h",
+    "240": "4h",
+    "1440": "1D",
+    "d": "1D",
+    "w": "1W",
 }
 
 # Exchanges that represent stock markets (not crypto)
```

**File**: `tests/unit/test_validators.py` (modified, +23/-1)
```diff
@@ -1,4 +1,7 @@
-from tradingview_mcp.core.utils.validators import sanitize_timeframe
+import pytest
+
+from tradingview_mcp.core.errors import ErrorCode, ScreenerServiceError
+from tradingview_mcp.core.utils.validators import sanitize_timeframe, validate_timeframe
 
 
 def test_sanitize_timeframe_accepts_lowercase_day_week_month():
@@ -22,3 +25,22 @@ def test_sanitize_timeframe_preserves_intraday_timeframes():
 
 def test_sanitize_timeframe_falls_back_to_default():
     assert sanitize_timeframe("invalid", "15m") == "15m"
+
+
+@pytest.mark.parametrize("code,expected", [
+    ("5", "5m"), ("15", "15m"), ("60", "1h"), ("240", "4h"),
+    ("1440", "1D"), ("D", "1D"), ("d", "1D"), ("W", "1W"), (" 60 ", "1h"),
+])
+def test_tradingview_numeric_interval_codes_map_to_supported_timeframes(code, expected):
+    # Integrations send TradingView's native codes; "60" used to silently
+    # become the 15m default, and then started raising INVALID_TIMEFRAME.
+    assert validate_timeframe(code) == expected
+    assert sanitize_timeframe(code) == expected
+
+
+@pytest.mark.parametrize("code", ["30m", "30", "120", "7", "1s"])
+def test_unsupported_timeframes_still_raise(code):
+    with pytest.raises(ScreenerServiceError) as exc:
+        validate_timeframe(code)
+    assert exc.value.code == ErrorCode.INVALID_TIMEFRAME
+
```

---

### Incident Patch 2: `b9753142` (2026-10-04)
**Commit Message**: fix: correct wrong exchange codes in FUTURES_WATCHLIST (ES/NQ/RTY/YM silently return 0 rows) (#98)

TradingView's screener API silently returns 0 rows (no error) when a
ticker's exchange prefix doesn't match how the contract is actually
indexed. Several entries in FUTURES_WATCHLIST used a plausible but
wrong exchange, which made get_futures_overview and
get_futures_category_snapshot return empty results for the most
commonly requested contracts with no indication anything was wrong:

- equity_index: ES1!, NQ1!, RTY1! are indexed under CME_MINI, not CME;
  YM1! under CBOT_MINI, not CME; EMD1! under CME_MINI, not CME.
  NKD1! under CME was already correct.
- agriculture: LE1! (Live Cattle) and HE1! (Lean Hogs) are indexed
  under CME, not CBOT.

Verified every ticker in FUTURES_WATCHLIST (all 7 categories) live via
tradingview_screener's Query().set_markets("futures") — energy,
metals, rates, forex, and crypto_futures were already correct.

Adds tests/stress/test_futures_watchlist_tickers.py, parametrized over
every FUTURES_WATCHLIST ticker, to catch this class of regression. It
follows the repo's existing opt-in `stress` marker convention since it
requires live upstream access.

Co-

**File**: `src/tradingview_mcp/core/services/futures_service.py` (modified, +3/-3)
```diff
@@ -39,8 +39,8 @@ def _futures_query():
 # Well-known front-month continuous contract symbols
 FUTURES_WATCHLIST: dict[str, list[str]] = {
     "equity_index": [
-        "CME:ES1!", "CME:NQ1!", "CME:RTY1!", "CME:YM1!",
-        "CME:EMD1!", "CME:NKD1!",
+        "CME_MINI:ES1!", "CME_MINI:NQ1!", "CME_MINI:RTY1!", "CBOT_MINI:YM1!",
+        "CME_MINI:EMD1!", "CME:NKD1!",
     ],
     "energy": [
         "NYMEX:CL1!", "NYMEX:NG1!", "NYMEX:HO1!", "NYMEX:RB1!",
@@ -52,7 +52,7 @@ def _futures_query():
     ],
     "agriculture": [
         "CBOT:ZC1!", "CBOT:ZW1!", "CBOT:ZS1!", "CBOT:ZL1!",
-        "CBOT:ZM1!", "CBOT:LE1!", "CBOT:HE1!",
+        "CBOT:ZM1!", "CME:LE1!", "CME:HE1!",
     ],
     "rates": [
         "CBOT:ZN1!", "CBOT:ZF1!", "CBOT:ZT1!", "CBOT:ZB1!",
```

**File**: `tests/stress/test_futures_watchlist_tickers.py` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+"""Real-network check — every FUTURES_WATCHLIST ticker must resolve.
+
+TradingView's screener API silently returns 0 rows for a ticker whose
+exchange prefix doesn't match how that contract is actually indexed — no
+error, just an empty DataFrame. ``CME:ES1!``, ``CME:NQ1!``, ``CME:RTY1!``,
+``CME:YM1!`` and ``CME:EMD1!`` looked plausible (they trade on CME/CBOT
+under those product codes) but the screener indexes the E-mini contracts
+under ``CME_MINI``/``CBOT_MINI``, and CBOT-grouped livestock (``LE1!``,
+``HE1!``) is actually indexed under plain ``CME``. Both mistakes made
+get_futures_overview/get_futures_category_snapshot return an empty result
+for the most commonly requested contracts (NQ, ES, RTY, YM) with no
+indication anything was wrong.
+
+Mocks can't catch this — the bug IS the mapping to a real upstream
+exchange code. Run explicitly (skipped by default, like the rest of
+``tests/stress``):
+
+    pytest -m stress -v
+"""
+from __future__ import annotations
+
+import pytest
+
+from tradingview_mcp.core.services.futures_service import (
+    FUTURES_WATCHLIST,
+    _tickers_query,
+)
+
+pytestmark = pytest.mark.stress
+
+_ALL_TICKERS = [
+    (category, symbol)
+    for category, symbols in FUTURES_WATCHLIST.items()
+    for symbol in symbols
+]
+
+
+@pytest.mark.parametrize("category,symbol", _ALL_TICKERS)
+def test_watchlist_ticker_resolves_to_real_data(category, symbol):
+    count, df = _tickers_query([symbol]).get_scanner_data(timeout=20)
+    assert len(df) > 0, (
+        f"{symbol!r} in FUTURES_WATCHLIST[{category!r}] returned 0 rows from "
+        f"the live screener — wrong exchange prefix for this contract."
+    )
+    assert df.iloc[0]["name"] == symbol.split(":", 1)[1]
```

---

### Incident Patch 3: `c6a03bc7` (2026-10-04)
**Commit Message**: docs: security notice about impersonating copies distributing npm malware (#102)

Copies of this repository under other accounts (not GitHub forks) add a
package.json that pulls oracle-redis, listed by OpenSSF as malware
(MAL-2026-16390, a RAT installed via an npm postinstall script). One of them
reuses this project's PyPI name and re-commits its history, so people
searching for tradingview-mcp can land on it.

State plainly that the project is Python-only with no official npm package,
list the official sources, and tell anyone who ran npm install on a copy to
treat the machine as compromised. Placed right above Quick Start, where
people decide what to install.

Reported in #101.

**File**: `README.md` (modified, +5/-0)
```diff
@@ -126,6 +126,11 @@ https://github-production-user-asset-6210df.s3.amazonaws.com/67838093/478689497-
 
 ---
 
+> [!WARNING]
+> **Security notice: impersonating copies of this repository.** This project is **Python-only** and has **no official npm / Node.js package**. The only official sources are this repository (`atilaahmettaner/tradingview-mcp`), the PyPI package [`tradingview-mcp-server`](https://pypi.org/project/tradingview-mcp-server/), and the hosted server at [pro.cryptosieve.com](https://pro.cryptosieve.com).
+>
+> Copies of this repository published under other accounts add a `package.json` whose dependencies install malware through npm (for example `oracle-redis`, [MAL-2026-16390](https://osv.dev/vulnerability/MAL-2026-16390)). If you cloned a "tradingview-mcp" repository from another account and ran `npm install`, treat that machine as compromised. Thanks to @roberttidball for the report (#101).
+
 ## 🚀 Quick Start (5 Minutes)
 
 **Two ways to run it — the same 37 tools either way:**
```

---

### Incident Patch 4: `c46d99ae` (2026-08-31)
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
                 conditions = [
                     current_change > min_growth,
@@ -933,7 +957,7 @@ def scan_consecutive_candles(
                 continue
 
             pattern_strength = sum(conditions)
-            if pattern_strength < 3:
+            if not all(conditions):
                 continue
 
             metrics = compute_metrics(indicators)
@@ -972,6 +996,11 @@ def scan_consecutive_candles(
         "pattern_type": pattern_type,
         "candle_count": candle_count,
         "min_growth": min_growth,
+        # Honesty: this scan inspects ONE completed bar per symbol. The
+        # multi-bar "consecutive" check is applied by callers with candle
+        # history (the EGX app verifies candle_count rising closes on Yahoo
+        # daily data before counting a hit).
+        "basis": "single-bar snapshot; consecutive-candle verification is the caller's",
         "total_found": len(pattern_coins),
         "data": pattern_coins[:limit],
     }
```

---

### Incident Patch 5: `910c9293` (2026-08-31)
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

### Incident Patch 6: `637b41be` (2026-08-28)
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
+        prev_close = round(closes[-2], 4) if len(closes) >= 2 else None
+        price_source = "candle_close"
+    else:
+        price = meta.get("regularMarketPrice")
+        prev_close = _get_previous_close(chart_result)
+        if isinstance(prev_close, float):
+            prev_close = round(prev_close, 4)
+        price_source = "quote"
+
     # A missing previous close stays None — substituting the current price
     # silently reported change=0.0, indistinguishable from a genuinely flat
     # session.
-    prev_close = _get_previous_close(chart_result)
     chg = round(price - prev_close, 4) if (price and prev_close) else None
     chg_pct = (
         round((price - prev_close) / prev_close * 100, 2)
@@ -94,6 +145,8 @@ def _format_quote(symbol: str, chart_result: dict) -> dict:
         "market_state": meta.get("marketState", ""),  # REGULAR, PRE, POST, CLOSED
         "52w_high": meta.get("fiftyTwoWeekHigh"),
         "52w_low": meta.get("fiftyTwoWeekLow"),
+        "price_s
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

### Incident Patch 7: `1a1cb6e3` (2026-08-28)
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
-    stop_pct = ((close - stop_loss) / close) * 100 if stop_loss else None
-    if stop_pct is not None and stop_pct < 0.5:
-        stop_loss = _safe_round(close - 1.0 * atr, 2)
-        stop_pct = ((close - stop_loss) / close) * 100
+    scenarios: Dict[str, Dict] = {}
+    if pullback_entry:
+        sc = _build_scenario("pullback", pullback_entry)
+        if sc:
+            scenarios["pullback"] = sc
+    if breakout_entry:
+        sc = _build_scenario("breakout", breakout_entry)
+        if sc:
+            scenarios["breakout"] = sc
+    if not scenarios:
+        # No S/R-derived entries — plan an at-market trade so callers still
+        # get one coherent set of levels.
+        sc = _build_scenario("market", close)
+        if sc:
+            scenarios["market"] = sc
+            setup_types.append("market")
+
+    if not scenarios:
+        return None
 
-    # ── Targets ───────────────────────────────────────────────────────────
-    target_1 = resistances[0] if len(resistances) >= 1 else _sa
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
+    breakout = setup["scenarios"]["breakout"]
+    assert breakout["entry"] == 5.78
+    assert breakout["targets"]["target_1"] == 5.83  # next resistance, not 5.78
+
+
+def test_returns_none_without_atr():
+    assert compute_trade_setup({"close": 10.0}) is None
+    assert compute_trade_setup({"close": 10.0, "ATR": 0}) is None
```

---

### Incident Patch 8: `7d7e441b` (2026-08-26)
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

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

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

**File**: `src/tradingview_mcp/core/services/yahoo_finance_service.py` (modified, +4/-1)
```diff
@@ -72,7 +72,10 @@ def _format_quote(symbol: str, chart_result: dict) -> dict:
     """Pure formatter — no I/O. Shared by sync and async paths."""
     meta = chart_result.get("meta", {})
     price = meta.get("regularMarketPrice")
-    prev_close = _get_previous_close(chart_result) or price
+    # A missing previous close stays None — substituting the current price
+    # silently reported change=0.0, indistinguishable from a genuinely flat
+    # session.
+    prev_close = _get_previous_close(chart_result)
     chg = round(price - prev_close, 4) if (price and prev_close) else None
     chg_pct = (
         round((price - prev_close) / prev_close * 100, 2)
```

---

### Incident Patch 9: `28ed45e2` (2026-08-26)
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

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

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
+    return _finalize_trades(trades, position, candles)
 
 
 def _run_keltner_breakout(candles, ema_period=20, atr_period=14, multiplier=2.0, **_):
@@ -251,7 +270,7 @@ def _run_keltner_breakout(candles, ema_period=20, atr_period=14, multiplier=2.0,
         elif position is not None and price < ema[i]:
             trades.append({**position, "exit_date": date, "exit_price": price})
             position = None
-    return trades
+    return _finalize_trades(trades, position, candles)
 
 
 def _run_triple_ema(candles, fast_period=20, slow_period=50, trend_period=200, **_):
@@ -277,7 +296,7 @@ def _run_triple_ema(candles, fast_period=20, slow_period=50, trend_period=200, *
         elif position is not None and bear_cross:
             trades.append({**position, "exit_date": date, "exit_price": price})
             position = None
-    return trades
+    return _finalize_trades(trades, position, candles)
 
 
 _STRATEGY_MAP = {
@@ -374,7 +393,60 @@ def _build_equity_curve(trades: list[dict], initia
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

### Incident Patch 10: `f1091dc9` (2026-08-26)
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

**File**: `src/tradingview_mcp/core/services/proxy_manager.py` (modified, +26/-5)
```diff
@@ -22,6 +22,7 @@
 
 import os
 import random
+import urllib.parse
 import urllib.request
 from typing import Optional
 
@@ -36,15 +37,30 @@
 
 # ─── Read config from env ─────────────────────────────────────────────────────
 
+def _env_int(name: str, default: int) -> int:
+    """Read an int env var; a malformed value falls back with a stderr note
+    instead of raising ValueError out of every proxied request."""
+    raw = os.environ.get(name, "")
+    if not raw:
+        return default
+    try:
+        return int(raw)
+    except ValueError:
+        import sys
+        print(f"[tradingview_mcp] ignoring non-numeric {name}={raw!r}, "
+              f"using {default}", file=sys.stderr)
+        return default
+
+
 def _cfg() -> dict:
     return {
         "host":    os.environ.get("PROXY_HOST", "p.webshare.io"),
         "port":    os.environ.get("PROXY_PORT", "80"),
         "prefix":  os.environ.get("PROXY_USERNAME_PREFIX", ""),
         "password": os.environ.get("PROXY_PASSWORD", ""),
         "enabled": os.environ.get("PROXY_ENABLED", "true").lower() == "true",
-        "min":     int(os.environ.get("PROXY_SESSION_MIN", "1")),
-        "max":     int(os.environ.get("PROXY_SESSION_MAX", "250")),
+        "min":     _env_int("PROXY_SESSION_MIN", 1),
+        "max":     _env_int("PROXY_SESSION_MAX", 250),
     }
 
 
@@ -60,7 +76,11 @@ def get_proxy_url() -> Optional[str]:
         return None
     c = _cfg()
     session_id = random.randint(c["min"], c["max"])
-    return f"http://{c['prefix']}-{session_id}:{c['password']}@{c['host']}:{c['port']}"
+    # URL-encode credentials: a password containing @ : / or # would
+    # otherwise produce a proxy URL that parses to the wrong host/auth.
+    user = urllib.parse.quote(f"{c['prefix']}-{session_id}", safe="")
+    pwd = urllib.parse.quote(c["password"], safe="")
+    return f"http://{user}:{pwd}@{c['host']}:{c['port']}"
 
 
 def get_proxy() -> Optional[dict]:
@@ -96,8 +116,9 @@ def build_opener_with_proxy(
 
     proxy_url = get_proxy_url()
     c = _cfg()
-    # Extract username from the full url for auth handler
-    username = proxy_url.split("//")[1].split(":")[0]
+    # Extract username from the full url for auth handler (unquote — the URL
+    # form is percent-encoded; the password manager wants the raw value).
+    username = urllib.parse.unquote(proxy_url.split("//")[1].split(":")[0])
 
     proxy_handler = urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url})
     pwd_mgr = urllib.request.HTTPPasswordMgrWithDefaultRealm()
```

**File**: `src/tradingview_mcp/core/services/scanner_service.py` (modified, +28/-4)
```diff
@@ -15,7 +15,13 @@
 import time as _time
 from typing import List, Optional
 
-from tradingview_mcp.core.errors import BatchExecutionError, ErrorCode, is_error, make_error
+from tradingview_mcp.core.errors import (
+    BatchExecutionError,
+    ErrorCode,
+    PartialDataError,
+    is_error,
+    make_error,
+)
 from tradingview_mcp.core.services.coinlist import load_symbols
 from tradingview_mcp.core.services.screener_service import (
     _batch_budget_s,
@@ -83,14 +89,16 @@ def volume_breakout_scan(
 
     capped_symbols = min(len(symbols), 500)
     total_batches = (capped_symbols + batch_size - 1) // batch_size
+    aborted_reason: Optional[str] = None
 
     for i in range(0, capped_symbols, batch_size):
         # Bail fast if we've spent the wall-clock budget on retries.
         if (_time.time() - started_at) >= budget_s:
+            aborted_reason = f"wall-clock budget ({budget_s:.0f}s) exhausted"
             try:
                 print(
                     f"[tradingview_mcp] volume_breakout_scan aborted: "
-                    f"wall-clock budget ({budget_s:.0f}s) exhausted at batch "
+                    f"{aborted_reason} at batch "
                     f"{batches_attempted}/{total_batches}",
                     file=sys.stderr,
                 )
@@ -118,11 +126,15 @@ def volume_breakout_scan(
                 pass
 
             if consecutive_failures >= max_consec:
+                aborted_reason = (
+                    f"{consecutive_failures} consecutive batch failures "
+                    f"(upstream cliff)"
+                )
                 try:
                     print(
                         f"[tradingview_mcp] volume_breakout_scan aborted: "
-                        f"{consecutive_failures} consecutive batch failures "
-                        f"at batch {batches_attempted}/{total_batches}",
+                        f"{aborted_reason} at batch "
+                        f"{batches_attempted}/{total_batches}",
                         file=sys.stderr,
                     )
                 except Exception:
@@ -194,6 +206,18 @@ def volume_breakout_scan(
         key=lambda x: (x["volume_strength"], abs(x["changePercent"])),
         reverse=True,
     )
+
+    # Aborted mid-scan with some successful batches: surface partiality
+    # (PARTIAL_DATA envelope carrying the rows) instead of a plain list
+    # indistinguishable from a complete scan.
+    if aborted_reason is not None:
+        raise PartialDataError(
+            rows=volume_breakouts[:limit],
+            batches_attempted=batches_attempted,
+            total_batches=total_batches,
+            aborted_reason=aborted_reason,
+        )
+
     return volume_breakouts[:limit]
 
 
```

**File**: `src/tradingview_mcp/core/services/screener_provider.py` (modified, +7/-0)
```diff
@@ -178,6 +178,10 @@ def _wait_for_failure_cooldown() -> None:
 
 _SCREENER_CACHE: Dict[Tuple, Tuple[float, Any]] = {}
 _SCREENER_CACHE_LOCK = _RLock()
+# Entries were only ever popped on a stale *lookup*, so a long-running server
+# serving many distinct (symbols, interval) tuples grew without bound. Evict
+# oldest-first past this cap.
+_SCREENER_CACHE_MAX_ENTRIES = 256
 
 
 def _cache_get(key: Tuple):
@@ -224,6 +228,9 @@ def _cache_set(key: Tuple, payload: Any) -> None:
         return
     with _SCREENER_CACHE_LOCK:
         _SCREENER_CACHE[key] = (_time.time(), payload)
+        while len(_SCREENER_CACHE) > _SCREENER_CACHE_MAX_ENTRIES:
+            oldest = min(_SCREENER_CACHE, key=lambda k: _SCREENER_CACHE[k][0])
+            _SCREENER_CACHE.pop(oldest, None)
 
 
 # --- Throttle for tradingview_ta calls (added 2026-05-15) -----------------
```

---

### Incident Patch 11: `90032cfe` (2026-08-26)
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
             "test_sharpe":           test_m["sharpe_ratio"],
             "fold_robustness_score": fold_rob,
+            "insufficient_data":     insufficient,
         })
 
     if not folds:
         return {"error": "Could not generate any valid folds. Try a longer period or fewer splits."}
 
-    avg_train  = round(statistics.mean(f["train_return_pct"] for f in folds), 2)
-    avg_test   = round(statistics.mean(f["test_return_pct"]  for f in folds), 2)
-    avg_robust = round(statistics.mean(f["fold_robustness_score"] for f in folds), 2)
+    scored_folds = [f for f in folds if not f["insufficient_data"]]
+    if not scored_folds:
+        return {"error": (f"Every test window is shorter than the ~{warmup_bars}-bar "
+                          f"warmup '{strategy}' needs to trade at all. Use a longer "
+                          f"period or fewer splits."), "folds": folds}
+
+    avg_train  = round(statistics.mean(f["train_return_pct"] for f in scored_folds), 2)
+    avg_test   = round(s
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
 
-    total_score = sum(alignment_scores)
-    all_bullish = all(s > 0 for s in alignment_scores) if alignment_scores else False
-    all_bearish = all(s < 0 for s in alignment_scores) if alignment_scores else False
+    total_score = sum(s for _, s in alignment_scores)
+    all_bullish = all(s > 0 for _, s in alignment_scores) if alignment_scores else False
+    all_bearish = all(s < 0 for _, s in alignment_scores) if alignment_scores else False
 
     if all_bullish:
         alignment, confidence, action = "FULLY ALIGNED BULLISH", "Very High", "STRONG BUY - All timeframes bullish. Look for pullback entry on 1H/15m."
@@ -1157,10 +1173,10 @@ def run_multi_timeframe_analysis(
     else:
         alignment, confidence, action = "MIXED/RANGING", "Low", "HOLD/NO TRADE - Timeframes conflict. Wait for alignment."
 
-    higher_tf_bias = alignment_scores[0] if alignment_scores else 0
+    higher_tf_bias = alignment_scores[0][1] if alignment_scores else 0
     divergent_tfs = [
-        timeframes[i]
-        f
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

**File**: `tests/unit/services/test_multi_tf_alignment.py` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+"""Regression test for multi-timeframe alignment score misattribution.
+
+``alignment_scores`` was appended only for timeframes that succeeded, but
+``scores_by_tf`` zipped it against the FULL timeframe list — so when 1W
+errored, 1D's score was reported under the "1W" key and every later
+timeframe shifted by one. Scores are now recorded as (tf, score) pairs.
+"""
+from __future__ import annotations
+
+from types import SimpleNamespace
+from typing import Any
+from unittest.mock import patch
+
+from tradingview_mcp.core.services import screener_service
+
+
+def _bullish_indicators() -> dict[str, Any]:
+    return {
+        "open": 100.0, "close": 110.0, "high": 111.0, "low": 99.0,
+        "SMA20": 105.0, "BB.upper": 115.0, "BB.lower": 95.0,
+        "EMA20": 105.0, "EMA50": 104.0, "EMA100": 103.0, "EMA200": 100.0,
+        "RSI": 55.0, "MACD.macd": 1.0, "MACD.signal": 0.5, "ADX": 30.0,
+        "volume": 1_000.0, "volume.SMA20": 800.0, "VWAP": 105.0, "ATR": 2.0,
+    }
+
+
+def test_failed_timeframe_does_not_shift_scores(monkeypatch):
+    monkeypatch.setattr(screener_service, "_TA_AVAILABLE", True)
+
+    def fake_analysis(screener, interval, symbols):
+        if interval == "1W":
+            raise RuntimeError("upstream 500 for weekly")
+        return {symbols[0]: SimpleNamespace(indicators=_bullish_indicators())}
+
+    with patch.object(screener_service, "get_multiple_analysis",
+                      side_effect=fake_analysis):
+        result = screener_service.run_multi_timeframe_analysis(
+            "KUCOIN:BTCUSDT", "kucoin",
+        )
+
+    scores = result["alignment"]["scores_by_tf"]
+
+    # The failed timeframe must be absent — before the fix it received the
+    # next timeframe's score and every subsequent key shifted by one.
+    assert "1W" not in scores
+    assert set(scores) == {"1D", "4h", "1h", "15m"}
+    assert "error" in result["timeframes"]["1W"]
+
+    # Every reported score must agree with that SAME timeframe's bias.
+    bias_to_score = {"Bullish": 1, "Bearish": -1, "Neutral": 0}
+    for tf, score in scores.items():
+        assert score == bias_to_score[result["timeframes"][tf]["bias"]], tf
```

**File**: `tests/unit/services/test_multi_tf_patterns_tickers.py` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+"""Regression test: fetch_multi_timeframe_patterns must query the CALLER'S
+symbols, not the first N arbitrary rows of a whole-exchange scan.
+
+The old code did ``set_markets(...).limit(len(symbols))`` — the ``symbols``
+argument was silently ignored while the resilience cache was keyed on it, so
+different symbol lists collided onto the same wrong rows.
+"""
+from __future__ import annotations
+
+from unittest.mock import patch
+
+import pandas as pd
+
+from tradingview_mcp.core.services import screener_service
+
+
+def test_query_targets_the_requested_symbols():
+    captured = {}
+
+    def fake_scan(q, cache_key=None, **_):
+        captured["query"] = q.query
+        return 0, pd.DataFrame()
+
+    with patch.object(screener_service, "_scan_with_retry", side_effect=fake_scan):
+        screener_service.fetch_multi_timeframe_patterns(
+            "kucoin", ["KUCOIN:AUSDT", "BUSDT"], "15m", 3, 10.0,
+        )
+
+    tickers = captured["query"]["symbols"]["tickers"]
+    # Prefixed symbols pass through; bare ones get the exchange prefix.
+    assert tickers == ["KUCOIN:AUSDT", "KUCOIN:BUSDT"]
```

**File**: `tests/unit/services/test_top_losers_sort.py` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+"""Regression tests for the top_losers sort-before-truncate bug.
+
+``fetch_trending_analysis`` used to sort descending and truncate to ``limit``
+unconditionally; ``top_losers`` then re-sorted that slice ascending — so with
+limit=25 it returned the 25 biggest GAINERS presented smallest-first, and the
+market's actual losers never left the service layer. The fix threads a
+``sort`` parameter through so ordering happens before truncation.
+"""
+from __future__ import annotations
+
+from types import SimpleNamespace
+from typing import Any
+from unittest.mock import patch
+
+from tradingview_mcp import server
+from tradingview_mcp.core.services import screener_service
+
+
+def _indicators(open_price: float, close: float) -> dict[str, Any]:
+    """Indicators that pass compute_metrics with change = close vs open."""
+    return {
+        "open": open_price,
+        "close": close,
+        "SMA20": 100.0,
+        "BB.upper": 110.0,
+        "BB.lower": 90.0,
+        "EMA50": 100.0,
+        "RSI": 50.0,
+        "volume": 1_000.0,
+    }
+
+
+def _analysis_response() -> dict:
+    """Five symbols spanning -20%..+20% so order is unambiguous."""
+    changes = {"UP20": 120.0, "UP10": 110.0, "FLAT": 100.0, "DN10": 90.0, "DN20": 80.0}
+    return {
+        sym: SimpleNamespace(indicators=_indicators(100.0, close))
+        for sym, close in changes.items()
+    }
+
+
+def _patched(sort: str, limit: int):
+    with patch.object(screener_service, "get_multiple_analysis",
+                      return_value=_analysis_response()), \
+         patch.object(screener_service, "load_symbols",
+                      return_value=["UP20", "UP10", "FLAT", "DN10", "DN20"]):
+        return screener_service.fetch_trending_analysis(
+            "KUCOIN", timeframe="15m", limit=limit, sort=sort,
+        )
+
+
+class TestFetchTrendingAnalysisSort:
+    def test_desc_returns_biggest_gainers(self):
+        rows = _patched(sort="desc", limit=2)
+        assert [r["symbol"] for r in rows] == ["UP20", "UP10"]
+
+    def test_asc_returns_biggest_losers_not_smallest_gainers(self):
+        """The bug: asc-after-truncate would yield ['FLAT', 'UP10'] here."""
+        rows = _patched(sort="asc", limit=2)
+        assert [r["symbol"] for r in rows] == ["DN20", "DN10"]
+        assert all(r["changePercent"] < 0 for r in rows)
+
+
+class TestTopLosersTool:
+    def test_tool_requests_ascending_sort(self, monkeypatch):
+        captured: dict[str, Any] = {}
+
+        def fake_fetch(exchange, timeframe="5m", filter_type="",
+                       rating_filter=None, limit=50, sort="desc"):
+            captured["sort"] = sort
+            captured["limit"] = limit
+            return [
+                {"symbol": "DN20", "changePercent": -20.0, "indicators": {}},
+                {"symbol": "DN10", "changePercent": -10.0, "indicators": {}},
+            ]
+
+        monkeypatch.setattr(server, "fetch_trending_analysis", fake_fetch)
+        rows = server.top_losers(exchange="KUCOIN", timeframe="15m", limit=2)
+
+        assert captured["sort"] == "asc"
+        assert captured["limit"] == 2
+        # Service order (losers-first) must be preserved, not re-sorted.
+        assert [r["symbol"] for r in rows] == ["DN20", "DN10"]
```

---

### Incident Patch 12: `b17aae72` (2026-08-24)
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

### Incident Patch 13: `e5e1f59a` (2026-08-05)
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

---

### Incident Patch 14: `008b1f03` (2026-07-30)
**Commit Message**: Require mcp>=1.14.0,<2 — locked 1.12.4 and current 2.x both break the server at import (#85)

* Require mcp>=1.14.0,<2 so the server can actually start

The declared floor of mcp[cli]>=1.12.0 admits two versions that break the
server at import time, and the pinned uv.lock resolution (1.12.4) is one of
them -- a local `uv sync` or `pip install -e .` produces a server that cannot
register a single tool.

server.py uses `from __future__ import annotations`, so every parameter
annotation reaches FastMCP as a string. Tool.from_function in mcp <=1.13.x
calls issubclass(param.annotation, Context) on that string and raises
"TypeError: issubclass() arg 1 must be a class" on the first @mcp.tool
decorator, at import time.

mcp 2.x fails differently: it removed mcp.server.fastmcp entirely, so the
import on server.py line 18 raises ModuleNotFoundError. Since 2.0.0 is what
a bare `pip install` resolves to today, the open upper range is the more
likely failure in practice.

Verified against this repo by installing each version and importing
tradingview_mcp.server on CPython 3.12:

  1.12.4  FAIL  TypeError (issubclass on str annotation)
  1.13.0  FAIL  TypeError (issubclass on str annotation)
  1

**File**: `pyproject.toml` (modified, +9/-5)
```diff
@@ -20,12 +20,16 @@ classifiers = [
 dependencies = [
   "feedparser>=6.0.12",
   "httpx>=0.27",
-  # Capped below 2. mcp 2.0.0 (2026-07-28, the stateless-spec SDK rework)
-  # removes the `mcp.server.fastmcp` module our server imports, so an open
-  # range breaks every fresh install (and any Docker rebuild — `uv pip
-  # install --system .` ignores uv.lock). Moving to the 2.x SDK
+  # Lower bound is 1.14.0, not 1.12.0: server.py uses `from __future__ import
+  # annotations`, so every annotation reaches FastMCP as a string. Tool.from_function
+  # in <=1.13.x calls issubclass(param.annotation, Context) on that string and dies
+  # with "TypeError: issubclass() arg 1 must be a class" at import time — every tool
+  # registration fails, so the server never starts.
+  # Upper bound excludes 2.x: it removed the mcp.server.fastmcp module our server
+  # imports, so an open range breaks every fresh install (and any Docker rebuild —
+  # `uv pip install --system .` ignores uv.lock). Moving to the 2.x SDK
   # (FastMCP -> MCPServer) is a deliberate migration, not a drive-by resolve.
-  "mcp[cli]>=1.12.0,<2",
+  "mcp[cli]>=1.14.0,<2",
   "requests>=2.32",
   # Pinned to ==3.0.0 on purpose. 3.2.0 makes a bare Query() default to a
   # *stock* preset filter that silently returns 0 rows for crypto/futures
```

**File**: `uv.lock` (modified, +139/-4)
```diff
@@ -58,6 +58,68 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/e5/48/1549795ba7742c948d2ad169c1c8cdbae65bc450d6cd753d124b17c8cd32/certifi-2025.8.3-py3-none-any.whl", hash = "sha256:f6c12493cfb1b06ba2ff328595af9350c65d6644968e5d3a2ffd78699af217a5", size = 161216, upload-time = "2025-08-03T03:07:45.777Z" },
 ]
 
+[[package]]
+name = "cffi"
+version = "2.1.0"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "pycparser", marker = "implementation_name != 'PyPy'" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/57/5f/ff100cae70ebe9d8df1c01a00e510e45d9adb5c1fdda84791b199141de97/cffi-2.1.0.tar.gz", hash = "sha256:efc1cdd798b1aaf39b4610bba7aad28c9bea9b910f25c784ccf9ec1fa719d1f9", size = 531036, upload-time = "2026-07-06T21:34:30.382Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/c0/e9/6d7724983b3d5a0908dbf74f64038ade77c18646ff6636ec7894fd392ce1/cffi-2.1.0-cp310-cp310-macosx_10_15_x86_64.whl", hash = "sha256:b65f590ef2a44640f9a05dbb548a429b4ade77913ce683ac8b1480777658a6c0", size = 183837, upload-time = "2026-07-06T21:32:09.655Z" },
+    { url = "https://files.pythonhosted.org/packages/69/aa/24580a278de21fd7322635556334d9b535f1cbc00b0a3919447cdf464c65/cffi-2.1.0-cp310-cp310-macosx_11_0_arm64.whl", hash = "sha256:164bff1657b2a74f0b6d54e11c9b375bc97b931f2ca9c43fcf875838da1570dd", size = 184226, upload-time = "2026-07-06T21:32:11.196Z" },
+    { url = "https://files.pythonhosted.org/packages/88/a9/02cae418ec4beb282ace11958d9d4737793439d561fadc7e6d56f2e2b354/cffi-2.1.0-cp310-cp310-manylinux1_i686.manylinux2014_i686.manylinux_2_17_i686.manylinux_2_5_i686.whl", hash = "sha256:c941bb58d5a6e1c3892d86e42927ed6c180302f07e6d395d08c416e594b98b46", size = 211107, upload-time = "2026-07-06T21:32:12.328Z" },
+    { url = "https://files.pythonhosted.org/packages/3b/30/c806937ed5e4c2c7ac30d9d6b76b5dc57ff8b75d83800d9bb11a8253cf2a/cffi-2.1.0-cp310-cp310-manylinux2014_aarch64.manylinux_2_17_aarch64.whl", hash = "sha256:a016194dbe13d14ee9556e734b772d8d67b947092b268d757fd4290e3ba2dfc2", size = 218733, upload-time = "2026-07-06T21:32:13.67Z" },
+    { url = "https://files.pythonhosted.org/packages/f9/cf/398272b8bbfd58aa314fda5a7f1cdbb26d1d78ae324a11211521315dd1f0/cffi-2.1.0-cp310-cp310-manylinux2014_ppc64le.manylinux_2_17_ppc64le.whl", hash = "sha256:03e9810d18c646077e501f661b682fbf5dee4676048527ca3cffe66faa9960dd", size = 205543, upload-time = "2026-07-06T21:32:15.148Z" },
+    { url = "https://files.pythonhosted.org/packages/45/ca/f91641185cdd90c36d317a9dc7f85e88ef8682d8b300977baff5e23c35d8/cffi-2.1.0-cp310-cp310-manylinux2014_s390x.manylinux_2_17_s390x.whl", hash = "sha256:19c54ac121cad98450b4896fa9a43ee0180d57bc4bc911a33db6cab1efab6cd3", size = 205460, upload-time = "2026-07-06T21:32:16.479Z" },
+    { url = "https://files.pythonhosted.org/packages/38/66/04781a77b411f0bb5b234d62c1814754ab75ebe455ccff1b08e8d7aae98f/cffi-2.1.0-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.whl", hash = "sha256:4d433a51f1870e43a13b6732f92aaf540ff77c2015097c78556f75a2d6c030e0", size = 218760, upload-time = "2026-07-06T21:32:17.98Z" },
+    { url = "https://files.pythonhosted.org/packages/d0/9a/bb1d5ed9c3fcae158e9f6391bf309c95d98c2ac37ed56573228471d0af5e/cffi-2.1.0-cp310-cp310-musllinux_1_2_aarch64.whl", hash = "sha256:3d7f118b5adbfdfead90c25822690b02bc8074fba949bb7858bec4ebd55adb43", size = 221230, upload-time = "2026-07-06T21:32:19.407Z" },
+    { url = "https://files.pythonhosted.org/packages/41/aa/3c1409cdd26094efacd1c36c66e0a6eb9d4296e4fd4f9901b8b2042f4323/cffi-2.1.0-cp310-cp310-musllinux_1_2_i686.whl", hash = "sha256:c5f5df567f6eb216de69be06ce55c8b714090fae02b18a3b40da8163b8c5fa9c", size = 213524, upload-time = "2026-07-06T21:32:20.828Z" },
+    { url = "https://files.pythonhosted.org/packages/fa/75/74dfb7c3fc6ebbd408038476bd4c1d7e925c62614e7b9c534ecc34218288/cffi-2.1.0-cp310-cp310-musllinux_1_2_x86_64.whl", hash = "sha256:11b3fb55f4f8ad92274ed26705f65d8f91457de71f5380061eb6d125a768fecd", size = 220341, upload-time = "2026-07-06T21:32:21.9Z" },
+    { url = "https://files.pythonhosted.org/packages/70/b6/9003c33a3e7d2c1306f5962e646457dcfe5a8cd8fce6bbe02d7af25db783/cffi-2.1.0-cp310-cp310-win32.whl", hash = "sha256:9d72af0cf10a76a600a9690078fe31c63b9588c8e86bf9fd353f713c84b5db0f", size = 174578, upload-time = "2026-07-06T21:32:23.073Z" },
+    { url = "https://files.pythonhosted.org/packages/8a/26/710688310447531c7a22f857c7f79d9855ec18b03e04494ced723fb37e2f/cffi-2.1.0-cp310-cp310-win_amd64.whl", hash = "sha256:fb62edb5bb52cca65fab91a63afa7561607120d26090a7e8fda6fb9f064726da", size = 185071, upload-time = "2026-07-06T21:32:24.671Z" },
+    { url = "https://files.pythonhosted.org/packages/d3/67/85c89a59ba36a671e79638f44d466749f08179266a57e4f2ffdf92174072/cffi-2.1.0-cp311-cp311-macosx_10_15_x86_64.whl", hash = "sha256:02cb7ff33ded4f1532476731f89ede53e2e488a8e6205515a82144246ffa7dcc", size = 183845, upload-time = "2026-07-06T21:32:26.32Z" },
+    { url = "http
```

---

### Incident Patch 15: `aba34550` (2026-07-29)
**Commit Message**: fix(deps): pin mcp[cli] below 2 — mcp 2.0.0 removes mcp.server.fastmcp (#86)

mcp 2.0.0 (2026-07-28, the stateless-spec SDK rework) deletes the
mcp.server.fastmcp module this server imports, so every fresh
pip install / uvx since 2026-07-28 resolves 2.0.0 and dies with
ModuleNotFoundError. Docker rebuilds hit the same cliff because the
image build uses 'uv pip install --system .' and ignores uv.lock.

Also: bump version to 0.8.0 (first PyPI release since 0.7.1 — ~63
commits of markets/tools/async/error-envelope work), write the 0.8.0
CHANGELOG entry, and document MARKETAUX_API_TOKEN in .env.example
(news moved from RSS/Reddit to Marketaux after 0.7.1).

Migrating to the 2.x SDK (FastMCP -> MCPServer) is a deliberate
follow-up, not a drive-by resolve.

**File**: `.env.example` (modified, +12/-2)
```diff
@@ -6,10 +6,20 @@
 # 3. .env is in .gitignore — it will NEVER be committed to git
 # =============================================================
 
+# ── News (Optional — Marketaux) ───────────────────────────────
+# financial_news / news-driven sentiment use the licensed Marketaux API
+# (replaced the old RSS/Reddit scraping). Get a token at
+# https://www.marketaux.com — without it the news tools return empty
+# results (every other tool works normally).
+
+MARKETAUX_API_TOKEN=your_marketaux_token_here
+# Max Marketaux requests per day before serving cached/stub results
+MARKETAUX_DAILY_BUDGET=90
+
 # ── Proxy (Optional — Webshare Rotating Residential) ──────────
 # Get credentials from: https://proxy.webshare.io/proxy/list
-# Enables access to Yahoo Finance, Xueqiu, and reduces Reddit rate-limits.
-# Leave blank to run WITHOUT proxy (Reddit & RSS will still work).
+# Enables access to Yahoo Finance and Xueqiu behind rate-limits.
+# Leave blank to run WITHOUT proxy (TradingView tools work fine without it).
 
 PROXY_HOST=p.webshare.io
 PROXY_PORT=80
```

**File**: `CHANGELOG.md` (modified, +48/-0)
```diff
@@ -4,7 +4,25 @@ All notable changes to this project will be documented in this file.
 
 ## [Unreleased]
 
+## [0.8.0] - 2026-07-29
+
 ### Fixed
+- **CRITICAL — pinned `mcp[cli]>=1.12.0,<2`**: `mcp` 2.0.0 (released 2026-07-28
+  alongside the MCP 2026-07-28 stateless spec) removes the `mcp.server.fastmcp`
+  module this server imports. 0.7.1's published metadata carries the open
+  `>=1.12.0` range, so every fresh `pip install` / `uvx` since 2026-07-28
+  resolved mcp 2.0.0 and died on startup with
+  `ModuleNotFoundError: No module named 'mcp.server.fastmcp'`. Upgrade to
+  0.8.0 to get a working install. Migrating to the 2.x SDK
+  (FastMCP → MCPServer) will be a deliberate follow-up release.
+- **`volume_confirmation_analysis` bare-symbol failures**: bare crypto symbols
+  (no exchange prefix) failed ~99% of the time; symbols are now resolved
+  before analysis.
+- **Donchian breakout off-by-one**: the breakout strategy read a window that
+  included the current bar, inflating backtest results; window is now strictly
+  historical (regression-tested).
+- **Backtest input validation**: initial capital and cost parameters are now
+  validated instead of silently producing nonsense results.
 - **`coin_analysis` ATR null bug**: `tradingview_ta` omits the `ATR` column from
   its analysis payload, which left `indicators["ATR"]` (and every downstream
   consumer — stop-loss sizing, trade-quality score, volatility metrics) at
@@ -17,7 +35,37 @@ All notable changes to this project will be documented in this file.
   screener column logic (`5m→5`, `15m→15`, `1h→60`, `4h→240`, `1D/1W/1M`
   unchanged); unknown timeframes degrade to the unsuffixed `ATR` column.
 
+### Added
+- **Markets**: Taiwan (TWSE, TPEX), Saudi Arabia (TADAWUL), US futures across
+  CME/COMEX/NYMEX/CBOT (equity index, energy, metals, agriculture, rates, FX,
+  crypto futures), AMEX/NYSEARCA aliases, auto-venue fallback for unlisted
+  symbols, precious-metal futures resolution via TVC.
+- **Tools**: `stock_screener` + `stock_prices` (bulk fetches up to 1,000 rows,
+  `exclude_otc`, server-side sorting, daily OHLC), `stock_options_chain` +
+  `stock_options_unusual_activity`, `stock_extended_hours`,
+  `bitcoin_market_pulse`.
+- **Directory-grade tool metadata**: every tool now ships `title`,
+  `readOnlyHint`, and an explicit `destructiveHint=False` annotation.
+- **Multi-arch Docker image CI**: GHCR images built for linux/amd64 +
+  linux/arm64 on every push to main and on version tags.
+
 ### Changed
+- **Every tool now runs off the event loop** (blanket async offload) — a slow
+  upstream call can no longer block the MCP server's event loop.
+- **Structured error envelopes everywhere**: screener/scanner failures return
+  machine-readable envelopes with retryability signals and symbol
+  suggestions instead of bare strings; note that tool return types are now
+  `list[dict] | dict` (consumers that assumed a bare list should handle the
+  envelope shape).
+- **News pipeline**: RSS/Reddit scraping replaced with the licensed Marketaux
+  API. Set `MARKETAUX_API_TOKEN` (see `.env.example`) to enable
+  `financial_news` and news-driven sentiment; without a token the news tools
+  return empty results while everything else works normally.
+- **Reliability**: bounded HTTP timeouts with stale-while-error fallback,
+  retry + 60s TTL response cache, `tradingview_ta` request throttling,
+  fast-fail on upstream outages.
+- Python support capped below 3.14 (`requires-python >=3.10,<3.14`) until the
+  dependency stack publishes 3.14 wheels.
 - `requests` is now an explicit dependency in `pyproject.toml`. It was already
   pulled in transitively by `tradingview-screener` / `tradingview-ta`, but the
   new ATR injection path uses it directly, so it is no longer safe to rely on
```

**File**: `pyproject.toml` (modified, +7/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "tradingview-mcp-server"
-version = "0.7.1"
+version = "0.8.0"
 description = "Advanced AI Trading Intelligence Framework — MCP server with walk-forward backtesting, trade logs, equity curves, 1h timeframe, sentiment, Yahoo Finance, and 30+ technical analysis tools"
 readme = "README.md"
 requires-python = ">=3.10,<3.14"
@@ -20,7 +20,12 @@ classifiers = [
 dependencies = [
   "feedparser>=6.0.12",
   "httpx>=0.27",
-  "mcp[cli]>=1.12.0",
+  # Capped below 2. mcp 2.0.0 (2026-07-28, the stateless-spec SDK rework)
+  # removes the `mcp.server.fastmcp` module our server imports, so an open
+  # range breaks every fresh install (and any Docker rebuild — `uv pip
+  # install --system .` ignores uv.lock). Moving to the 2.x SDK
+  # (FastMCP -> MCPServer) is a deliberate migration, not a drive-by resolve.
+  "mcp[cli]>=1.12.0,<2",
   "requests>=2.32",
   # Pinned to ==3.0.0 on purpose. 3.2.0 makes a bare Query() default to a
   # *stock* preset filter that silently returns 0 rows for crypto/futures
```

**File**: `uv.lock` (modified, +2/-2)
```diff
@@ -958,7 +958,7 @@ wheels = [
 
 [[package]]
 name = "tradingview-mcp-server"
-version = "0.7.1"
+version = "0.8.0"
 source = { editable = "." }
 dependencies = [
     { name = "feedparser" },
@@ -979,7 +979,7 @@ dev = [
 requires-dist = [
     { name = "feedparser", specifier = ">=6.0.12" },
     { name = "httpx", specifier = ">=0.27" },
-    { name = "mcp", extras = ["cli"], specifier = ">=1.12.0" },
+    { name = "mcp", extras = ["cli"], specifier = ">=1.12.0,<2" },
     { name = "requests", specifier = ">=2.32" },
     { name = "tradingview-screener", specifier = "==3.0.0" },
     { name = "tradingview-ta", specifier = ">=3.3.0" },
```

#### Recent Merged Pull Requests:
- **PR #105** (2026-10-04): docs(readme): put a clickable hosted option above the fold (@atilaahmettaner)
- **PR #104** (2026-10-04): fix: accept TradingView's numeric interval codes as timeframes (@atilaahmettaner)
- **PR #102** (2026-10-04): docs: security notice about impersonating copies distributing npm malware (@atilaahmettaner)
- **PR #100** (closed): feat: anti-rug checks & backtest fixes (@issacleandry3-spec)
- **PR #99** (closed): docs: add hardened Hermes Agent integration (@RedGh0st1)
- **PR #98** (2026-10-04): fix: correct wrong exchange codes in FUTURES_WATCHLIST (ES/NQ/RTY/YM silently return 0 rows) (@ferhat-pixel)
- **PR #94** (2026-09-01): feat: 0.9.0 — code-review remediation, CI, and EGX smart-money tools (@Galileo103)
- **PR #90** (closed): docs: add OrcaRouter as an OpenClaw provider option (@XiaoHuo888-hue)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
