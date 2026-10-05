# Forensic Learning Record (Deep Inspection): Fincept-Corporation/FinceptTerminal

> **Canonical Artifact**: `07_PROJECT_LEARNING/fincept-corporation-finceptterminal-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Fincept-Corporation/FinceptTerminal](https://github.com/Fincept-Corporation/FinceptTerminal))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:20:57.259Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Fincept-Corporation/FinceptTerminal`
- **Description**: FinceptTerminal is a modern finance application offering advanced market analytics, investment research, and economic data tools, designed for interactive exploration and data-driven decision-making in a user-friendly environment.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 32113 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `fincept-qt/packaging/flatpak/preflight.py`
```
"""Offline pre-flight for the Flathub submission.

Checks the subset of flatpak-builder-lint / AppStream rules that can be
verified WITHOUT a Linux box, so the real lint run passes first time:

  * every git source is pinned (Flathub: a tag without a commit is a hard
    error for new submissions -- tags are mutable)
  * the ref the manifest builds actually EXISTS on the remote, and its commit
    matches the tag (the manifest once pointed at an untagged v4.5.0, so the
    build could never have succeeded)
  * screenshots are pinned to a tag/commit, not a mutable branch
  * the newest <release> matches the version the manifest builds, so Flathub
    cannot advertise a version whose binary it does not have
  * the desktop entry is internally consistent with the manifest and declares
    no MIME type or field code the app cannot honour

Run:  python preflight.py       (needs pyyaml; exits non-zero on any failure)

It does NOT replace flatpak-builder-lint -- run that on Linux too. See
FLATHUB.md.
"""
import io, os, re, sys, subprocess, xml.dom.minidom
import yaml

D = os.path.dirname(os.path.abspath(__file__))
# <repo>/fincept-qt/packaging/flatpak -> <repo>
REPO = os.path.abspath(os.path.join(D, "..", "..", ".."))
APPID = "in.fincept.FinceptTerminal"
fails, warns = [], []

def ck(ok, label, hard=True):
    print(f"  [{'PASS' if ok else ('FAIL' if hard else 'WARN')}] {label}")
    if not ok:
        (fails if hard else warns).append(label)

print("[1] manifest YAML")
man = yaml.safe_load(io.open(os.path.join(D, f"{APPID}.yml"), encoding="utf-8"))
ck(man["id"] == APPID, f"id matches filename ({APPID})")
ck(bool(man.get("command")), "command declared")
ck(man.get("runtime") and man.get("sdk"), "runtime + sdk declared")

print("[2] git sources pinned (Flathub: tag without commit = ERROR for new submissions)")
srcs = [(m.get("name", "?"), s) for m in man["modules"] if isinstance(m, dict)
        for s in m.get("sources", []) if isinstance(s, dict) and s.get("type") == "git"]
ck(len(srcs) > 0, f"found {len(srcs)} git sources")
for name, s in srcs:
    url = s["url"].rsplit("/", 1)[-1]
    if "tag" in s:
        ck("commit" in s, f"{name}:{url} has tag -> must also have commit")
    else:
        ck("commit" in s, f"{name}:{url} pinned by commit")
    if "commit" in s:
        ck(bool(re.fullmatch(r"[0-9a-f]{40}", s["commit"])), f"{name}:{url} commit is full 40-char SHA")

print("[3] built ref actually exists on the remote")
for name, s in srcs:
    if "FinceptTerminal.git" in s["url"]:
        tag = s.get("tag")
        r = subprocess.run(["git", "ls-remote", "--tags", "origin", f"refs/tags/{tag}"],
                           cwd=REPO, capture_output=True, text=True)
        ck(bool(r.stdout.strip()), f"tag {tag} exists on origin")
        if s.get("commit"):
            r2 = subprocess.run(["git", "rev-parse", f"{tag}^{{commit}}"], cwd=REPO,
                                capture_output=True, text=True)
            ck(r2.stdout.strip() == s["commit"], f"commit matches {tag} ({r2.stdout.strip()[:8]})")

print("[4] metainfo XML")
mp = os.path.join(D, f"{APPID}.metainfo.xml")
dom = xml.dom.minidom.parse(mp)
xt = io.open(mp, encoding="utf-8").read()
ck(True, "well-formed XML")
def one(tag):
    n = dom.getElementsByTagName(tag)
    return n[0].firstChild.nodeValue.strip() if n and n[0].firstChild else None
ck(one("id") == APPID, "metainfo id matches app id")
for t in ("name", "summary", "metadata_license", "project_license"):
    ck(bool(one(t)), f"<{t}> present")
ck(len(dom.getElementsByTagName("screenshot")) > 0, "has screenshots")
ck(bool(dom.getElementsByTagName("content_rating")), "has content_rating (OARS)")
launch = dom.getElementsByTagName("launchable")
ck(bool(launch) and launch[0].firstChild.nodeValue.strip() == f"{APPID}.desktop",
   "launchable points at the desktop id")

print("[5] screenshots not on a mutable branch")
imgs = [n.firstChild.nodeValue.strip() for n in dom.getElementsByTagName("image") if n.firstChild]
ck(len(imgs) > 0, f"{len(imgs)} screenshot URLs")
for u in imgs:
    ck("/main/" not in u and "/master/" not in u, f"pinned (not a branch): .../{u.rsplit('/',1)[-1]}")

print("[6] newest listed release matches what the manifest builds")
rels = [r.getAttribute("version") for r in dom.getElementsByTagName("release")]
built = [s.get("tag") for _, s in srcs if "FinceptTerminal.git" in s["url"]][0].lstrip("v")
ck(bool(rels), f"releases listed: {rels[:3]}")
ck(rels and rels[0] == built, f"newest release {rels[0] if rels else None} == built version {built}")
for r in dom.getElementsByTagName("release"):
    ck(bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", r.getAttribute("date"))),
       f"release {r.getAttribute('version')} date is ISO-8601")

print("[7] desktop entry")
dp = os.path.join(D, f"{APPID}.desktop")
kv = dict(l.split("=", 1) for l in io.open(dp, encoding="utf-8").read().splitlines()
          if "=" in l and not l.startswith("["))
ck(kv.get("Type") == "Application", "Type=Application")
ck(bool(kv.get("Name")), "Name present")
ck(kv.get("Icon") == APPID, f"Icon == app id ({APPID})")
ck(kv.get("Exec", "").split()[0] == man["command"], "Exec binary == manifest command")
cats = [c for c in kv.get("Categories", "").split(";") if c]
MAIN = {"AudioVideo","Audio","Video","Development","Education","Game","Graphics",
        "Network","Office","Science","Settings","System","Utility"}
ck(bool(set(cats) & MAIN), f"has a main category ({sorted(set(cats) & MAIN)})")
ck("MimeType" not in kv or bool(kv.get("MimeType")), "no empty MimeType")
if "MimeType" in kv:
    ck(False, "declares MimeType with no shared-mime-info XML installed", hard=False)
ck("%" not in kv.get("Exec", ""), "Exec has no field code the app cannot honour")

print("[8] installed assets exist")
ck(os.path.isfile(os.path.join(REPO, "fincept-qt", "resources", f"{APPID}.png")), "256x256 icon present")
for u in imgs:
    rel = u.split("/images/")[-1]
    ck(os.path.isfile(os.path.join(REPO, "images", rel)), f"screenshot source images/{rel}")

print(f"\n{len(fails)} failure(s), {len(warns)} warning(s)")
if fails:
    for f in fails: print("  FAIL:", f)
if warns:
    for w in warns: print("  WARN:", w)
sys.exit(1 if fails else 0)

```

### Core Architecture Module: `fincept-qt/scripts/Analytics/alternateInvestment/asset_location.py`
```
"""
Asset Location Module

Tax-efficient placement of assets across account types

CFA Standards: After-tax returns, Tax alpha

Key Concepts:
- Tax-inefficient assets → Tax-deferred accounts
- Tax-efficient assets → Taxable accounts
- Municipal bonds → Taxable (already tax-free)
- REITs → Tax-deferred (high dividend yield)
"""

from decimal import Decimal, getcontext
from typing import Dict, Any, List, Tuple
from enum import Enum
import logging

logger = logging.getLogger(__name__)
getcontext().prec = 28


class AccountType(Enum):
    """Account types for asset location"""
    TAXABLE = "taxable"
    TAX_DEFERRED = "tax_deferred"  # 401k, Traditional IRA
    TAX_FREE = "tax_free"  # Roth IRA, Roth 401k


class AssetTaxProfile(Enum):
    """Tax efficiency of asset class"""
    VERY_TAX_EFFICIENT = "very_efficient"  # Tax-managed equity, I Bonds
    TAX_EFFICIENT = "efficient"  # Index funds, municipal bonds
    TAX_NEUTRAL = "neutral"  # Balanced funds
    TAX_INEFFICIENT = "inefficient"  # Taxable bonds, actively managed
    VERY_TAX_INEFFICIENT = "very_inefficient"  # REITs, commodities, high-yield bonds


class AssetLocationAnalyzer:
    """
    Asset Location Analysis for Tax Optimization

    Rules:
    1. Place tax-inefficient assets in tax-advantaged accounts
    2. Place tax-efficient assets in taxable accounts
    3. Exceptions: Municipal bonds (already tax-free)
    4. REITs and commodities → Tax-deferred
    5. International stocks → Consider taxable (foreign tax credit)

    Verdict: Essential for wealth maximization
    Value: Can add 0.10% - 0.75% annual return
    """

    def __init__(self, tax_bracket: Decimal = Decimal('0.24')):
        """
        Initialize Asset Location Analyzer

        Args:
            tax_bracket: Federal marginal tax rate (e.g., 0.24 for 24%)
        """
        self.tax_bracket = tax_bracket
        self.ltcg_rate = Decimal('0.15')  # Long-term capital gains rate (15% typical)
        self.qualified_dividend_rate = Decimal('0.15')  # Qualified dividend rate
        self.state_tax_rate = Decimal('0.05')  # Average state tax (5%)

    def tax_efficiency_score(self, asset_class: str) -> Tuple[AssetTaxProfile, Decimal]:
        """
        Determine tax efficiency of asset class

        Returns:
            (AssetTaxProfile, tax_drag_estimate)
        """
        tax_profiles = {
            # Very Tax-Efficient (0-0.3% tax drag)
            'tax_managed_equity': (AssetTaxProfile.VERY_TAX_EFFICIENT, Decimal('0.002')),
            'i_bonds': (AssetTaxProfile.VERY_TAX_EFFICIENT, Decimal('0.001')),
            'tips': (AssetTaxProfile.VERY_TAX_EFFICIENT, Decimal('0.003')),
            'municipal_bonds': (AssetTaxProfile.VERY_TAX_EFFICIENT, Decimal('0.0')),

            # Tax-Efficient (0.3-0.8% tax drag)
            'equity_index_fund': (AssetTaxProfile.TAX_EFFICIENT, Decimal('0.005')),
            'total_market_index': (AssetTaxProfile.TAX_EFFICIENT, Decimal('0.006')),
            'international_equity': (AssetTaxProfile.TAX_EFFICIENT, Decimal('0.007')),

            # Tax-Neutral (0.8-1.5% tax drag)
            'balanced_fund': (AssetTaxProfile.TAX_NEUTRAL, Decimal('0.012')),
            'value_stocks': (AssetTaxProfile.TAX_NEUTRAL, Decimal('0.010')),

            # Tax-Inefficient (1.5-2.5% tax drag)
            'taxable_bonds': (AssetTaxProfile.TAX_INEFFICIENT, Decimal('0.020')),
            'corporate_bonds': (AssetTaxProfile.TAX_INEFFICIENT, Decimal('0.022')),
            'active_equity': (AssetTaxProfile.TAX_INEFFICIENT, Decimal('0.018')),

            # Very Tax-Inefficient (2.5%+ tax drag)
            'reits': (AssetTaxProfile.VERY_TAX_INEFFICIENT, Decimal('0.030')),
            'high_yield_bonds': (AssetTaxProfile.VERY_TAX_INEFFICIENT, Decimal('0.035')),
            'commodities': (AssetTaxProfile.VERY_TAX_INEFFICIENT, Decimal('0.028')),
            'actively_managed': (AssetTaxProfile.VERY_TAX_INEFFICIENT, Decimal('0.025')),
        }

        return tax_profiles.get(asset_class.lower().replace(' ', '_'),
                                (AssetTaxProfile.TAX_NEUTRAL, Decimal('0.012')))

    def optimal_location(self, asset_class: str) -> Dict[str, Any]:
        """Determine optimal account location for asset class"""
        profile, tax_drag = self.tax_efficiency_score(asset_class)

        # Location priority rules
        location_rules = {
            AssetTaxProfile.VERY_TAX_EFFICIENT: {
                'priority_1': AccountType.TAXABLE,
                'reason': 'Already tax-efficient, preserve tax-deferred space',
                'analysis_quote': 'Keep tax-efficient assets in taxable accounts'
            },
            AssetTaxProfile.TAX_EFFICIENT: {
                'priority_1': AccountType.TAXABLE,
                'priority_2': AccountType.TAX_DEFERRED,
                'reason': 'Low tax drag, can go in taxable',
                'analysis_quote': 'Index funds work well in taxable accounts'
            },
            AssetTaxProfile.TAX_NEUTRAL: {
                'priority_1': AccountType.TAX_DEFERRED,
                'priority_2': AccountType.TAXABLE,
                'reason': 'Moderate tax drag',
                'analysis_quote': 'Consider tax-deferred if space available'
            },
            AssetTaxProfile.TAX_INEFFICIENT: {
                'priority_1': AccountType.TAX_DEFERRED,
                'priority_2': AccountType.TAX_FREE,
                'reason': 'High tax drag, shelter from taxes',
                'analysis_quote': 'Tax-inefficient assets belong in tax-deferred accounts'
            },
            AssetTaxProfile.VERY_TAX_INEFFICIENT: {
                'priority_1': AccountType.TAX_DEFERRED,
                'priority_2': AccountType.TAX_FREE,
                'priority_3': AccountType.TAXABLE,
                'reason': 'Very high tax drag, must shelter',
                'analysis_quote': 'REITs and commodities → tax-deferred only'
            }
        }

        rule = location_rules[profile]

        return {
            'asset_class': asset_class,
            'tax_profile': profile.value,
            'estimated_tax_drag': float(tax_drag),
            'optimal_account': rule['priority_1'].value,
            'alternative_accounts': [v.value for k, v in rule.items() if k.startswith('priority') and k != 'priority_1'],
            'reason': rule['reason'],
            'analysis_guidance': rule['analysis_quote']
        }

    def location_value_added(self, asset_value: Decimal, asset_class: str,
                            years: int = 30) -> Dict[str, Any]:
        """
        Calculate value of optimal vs suboptimal location

        Compares:
        - Optimal location (tax-efficient placement)
        - Suboptimal location (all in taxable)
        """
        profile, tax_drag = self.tax_efficiency_score(asset_class)
        annual_return = Decimal('0.08')  # 8% baseline return

        # Optimal location: shelter tax-inefficient assets
        if profile in [AssetTaxProfile.TAX_INEFFICIENT, AssetTaxProfile.VERY_TAX_INEFFICIENT]:
            # Tax-deferred growth
            optimal_value = asset_value * ((Decimal('1') + annual_return) ** years)
            # Tax on withdrawal at ordinary income rate
            after_tax_optimal = optimal_value * (Decimal('1') - self.tax_bracket)
        else:
            # Tax-efficient in taxable
            after_tax_return = annual_return - tax_drag
            optimal_value = asset_value * ((Decimal('1') + after_tax_return) ** years)
            # Already after-tax
            after_tax_optimal = optimal_value

        # Suboptimal: everything in taxable with full tax drag
        suboptimal_return = annual_return - tax_drag
        suboptimal_value = asset_value * ((Decimal('1') + suboptimal_return) ** years)

        # Value added
        value_added = after_tax_optimal - suboptimal_value
        value_added_pct = (value_added / suboptimal_value) * Decimal('100')

        # Annual alpha
        annual_alpha = (((after_tax_optim
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/alternateInvestment/base_analytics.py`
```
"""Alternative Investments Base Analytics Module

Core financial mathematics and abstract base classes for alternative investment analytics.
"""

import numpy as np
import pandas as pd
from decimal import Decimal, getcontext
from typing import List, Optional, Dict, Any, Tuple, Union
from datetime import datetime, timedelta
from abc import ABC, abstractmethod
import logging

from config import (
    MarketData, CashFlow, Performance, AssetParameters, AssetClass,
    Constants, Config, ValidationRules
)

try:
    from market_config import get_market_config, get_market_by_currency, MarketRegion
    MARKET_CONFIG_AVAILABLE = True
except ImportError:
    MARKET_CONFIG_AVAILABLE = False

logger = logging.getLogger(__name__)


class FinancialMath:
    """Core financial mathematics functions following CFA standards"""

    @staticmethod
    def irr(cash_flows: List[CashFlow], guess: Decimal = Decimal('0.10')) -> Optional[Decimal]:
        """
        Calculate Internal Rate of Return using Newton-Raphson method
        CFA Standard: IRR is the discount rate that makes NPV = 0

        Args:
            cash_flows: List of CashFlow objects
            guess: Initial guess for IRR

        Returns:
            IRR as decimal (e.g., 0.15 for 15%)
        """
        if not cash_flows:
            return None

        # Sort cash flows by date
        sorted_cfs = sorted(cash_flows, key=lambda x: x.date)

        # Convert to numpy arrays for calculation
        dates = [datetime.strptime(cf.date, '%Y-%m-%d') for cf in sorted_cfs]
        amounts = [float(cf.amount) for cf in sorted_cfs]

        # Calculate days from first cash flow
        base_date = dates[0]
        days = [(d - base_date).days for d in dates]

        def npv(rate):
            return sum(amount / (1 + rate) ** (day / 365.25) for amount, day in zip(amounts, days))

        def npv_derivative(rate):
            return sum(-amount * (day / 365.25) / (1 + rate) ** ((day / 365.25) + 1)
                       for amount, day in zip(amounts, days))

        rate = float(guess)
        for _ in range(Config.PE_IRR_MAX_ITERATIONS):
            npv_val = npv(rate)
            if abs(npv_val) < float(Config.PE_IRR_TOLERANCE):
                return Decimal(str(rate))

            npv_deriv = npv_derivative(rate)
            if abs(npv_deriv) < 1e-12:
                break

            rate = rate - npv_val / npv_deriv

        return None  # Convergence failed

    @staticmethod
    def npv(cash_flows: List[CashFlow], discount_rate: Decimal) -> Decimal:
        """
        Calculate Net Present Value
        CFA Standard: NPV = Σ(CF_t / (1+r)^t)

        Args:
            cash_flows: List of CashFlow objects
            discount_rate: Discount rate as decimal

        Returns:
            NPV value
        """
        if not cash_flows:
            return Decimal('0')

        sorted_cfs = sorted(cash_flows, key=lambda x: x.date)
        base_date = datetime.strptime(sorted_cfs[0].date, '%Y-%m-%d')

        npv_value = Decimal('0')
        for cf in sorted_cfs:
            cf_date = datetime.strptime(cf.date, '%Y-%m-%d')
            years = Decimal(str((cf_date - base_date).days)) / Constants.DAYS_IN_YEAR
            present_value = cf.amount / ((Decimal('1') + discount_rate) ** years)
            npv_value += present_value

        return npv_value

    @staticmethod
    def moic(cash_flows: List[CashFlow]) -> Optional[Decimal]:
        """
        Calculate Multiple of Invested Capital
        CFA Standard: MOIC = Total Distributions / Total Contributions

        Args:
            cash_flows: List of CashFlow objects

        Returns:
            MOIC as decimal multiple
        """
        total_invested = Decimal('0')
        total_distributed = Decimal('0')

        for cf in cash_flows:
            if cf.amount < 0:  # Investment/contribution
                total_invested += abs(cf.amount)
            elif cf.amount > 0:  # Distribution
                total_distributed += cf.amount

        if total_invested == 0:
            return None

        return total_distributed / total_invested

    @staticmethod
    def dpi(cash_flows: List[CashFlow]) -> Decimal:
        """
        Calculate Distributions to Paid-In Capital
        CFA Standard: DPI = Cumulative Distributions / Paid-In Capital

        Args:
            cash_flows: List of CashFlow objects

        Returns:
            DPI ratio
        """
        total_paid_in = Decimal('0')
        total_distributions = Decimal('0')

        for cf in cash_flows:
            if cf.cf_type in ['capital_call', 'investment'] or cf.amount < 0:
                total_paid_in += abs(cf.amount)
            elif cf.cf_type == 'distribution' or cf.amount > 0:
                total_distributions += cf.amount

        if total_paid_in == 0:
            return Decimal('0')

        return total_distributions / total_paid_in

    @staticmethod
    def rvpi(cash_flows: List[CashFlow], current_nav: Decimal) -> Decimal:
        """
        Calculate Residual Value to Paid-In Capital
        CFA Standard: RVPI = Net Asset Value / Paid-In Capital

        Args:
            cash_flows: List of CashFlow objects
            current_nav: Current Net Asset Value

        Returns:
            RVPI ratio
        """
        total_paid_in = Decimal('0')

        for cf in cash_flows:
            if cf.cf_type in ['capital_call', 'investment'] or cf.amount < 0:
                total_paid_in += abs(cf.amount)

        if total_paid_in == 0:
            return Decimal('0')

        return current_nav / total_paid_in

    @staticmethod
    def sharpe_ratio(returns: List[Decimal], risk_free_rate: Decimal = None) -> Decimal:
        """
        Calculate Sharpe Ratio
        CFA Standard: (Portfolio Return - Risk-Free Rate) / Portfolio Standard Deviation

        Args:
            returns: List of period returns
            risk_free_rate: Risk-free rate for the period

        Returns:
            Sharpe ratio
        """
        if len(returns) < 2:
            return Decimal('0')

        if risk_free_rate is None:
            risk_free_rate = Config.RISK_FREE_RATE / Constants.MONTHS_IN_YEAR  # Monthly rate

        excess_returns = [r - risk_free_rate for r in returns]
        mean_excess = sum(excess_returns) / len(excess_returns)

        if len(excess_returns) == 1:
            return Decimal('0')

        variance = sum((r - mean_excess) ** 2 for r in excess_returns) / (len(excess_returns) - 1)
        std_dev = variance.sqrt()

        if std_dev == 0:
            return Decimal('0')

        return mean_excess / std_dev

    @staticmethod
    def sortino_ratio(returns: List[Decimal], target_return: Decimal = Decimal('0')) -> Decimal:
        """
        Calculate Sortino Ratio
        CFA Standard: (Portfolio Return - Target Return) / Downside Deviation

        Args:
            returns: List of period returns
            target_return: Target or minimum acceptable return

        Returns:
            Sortino ratio
        """
        if len(returns) < 2:
            return Decimal('0')

        excess_returns = [r - target_return for r in returns]
        mean_excess = sum(excess_returns) / len(excess_returns)

        # Calculate downside deviation (only negative excess returns)
        downside_returns = [r for r in excess_returns if r < 0]

        if not downside_returns:
            return Decimal('999')  # No downside risk

        downside_variance = sum(r ** 2 for r in downside_returns) / len(returns)
        downside_deviation = downside_variance.sqrt()

        if downside_deviation == 0:
            return Decimal('0')

        return mean_excess / downside_deviation

    @staticmethod
    def maximum_drawdown(prices: List[Decimal]) -> Tuple[Decimal, int, int]:
        """
        Calculate Maximum Drawdown
        CFA Standard: Maximum peak-to-trough decline

        Args:
            prices: List of price values

        Returns:
            Tuple o
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/alternateInvestment/cli.py`
```
"""Alternative Investments CLI

Unified command-line interface for alternative investment analytics.
"""

import sys
import json
import argparse
from decimal import Decimal
from typing import Dict, Any, List
from datetime import datetime, timedelta

from config import AssetClass, HedgeFundStrategy, CommoditySector, RealEstateType, AssetParameters, MarketData
from digital_assets import DigitalAssetAnalyzer
from hedge_funds import HedgeFundAnalyzer
from natural_resources import CommodityAnalyzer
from private_capital import PrivateEquityAnalyzer
from real_estate import RealEstateAnalyzer, InternationalREITAnalyzer
from performance_metrics import PerformanceAnalyzer
from risk_analyzer import RiskAnalyzer
from data_handler import DataHandler

# New modules from alternative investment analysis
from inflation_protected import TIPSAnalyzer, IBondAnalyzer
from high_yield_bonds import HighYieldBondAnalyzer
from preferred_stocks import PreferredStockAnalyzer
from precious_metals import PreciousMetalsEquityAnalyzer
from convertible_bonds import ConvertibleBondAnalyzer
from fixed_annuities import FixedAnnuityAnalyzer, InflationIndexedAnnuityAnalyzer
from emerging_market_bonds import EmergingMarketBondAnalyzer
from managed_futures import ManagedFuturesAnalyzer
from market_neutral import MarketNeutralAnalyzer
from stable_value import StableValueFundAnalyzer
from equity_indexed_annuities import EquityIndexedAnnuityAnalyzer
from asset_location import AssetLocationAnalyzer
from covered_calls import CoveredCallAnalyzer
from sri_funds import SRIFundAnalyzer
from leveraged_funds import LeveragedFundAnalyzer
from structured_products import StructuredProductAnalyzer
from variable_annuities import VariableAnnuityAnalyzer


def decimal_default(obj):
    """JSON serializer for Decimal objects"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def main():
    parser = argparse.ArgumentParser(description='Alternative Investments Analytics CLI')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Digital Assets
    digital = subparsers.add_parser('digital-assets', help='Digital asset analytics')
    digital.add_argument('--data', required=True, help='Asset data (JSON)')
    digital.add_argument('--method', default='fundamental', help='Analysis method: fundamental, volatility, onchain')

    # Hedge Funds
    hedge = subparsers.add_parser('hedge-funds', help='Hedge fund analytics')
    hedge.add_argument('--data', required=True, help='Fund data (JSON)')
    hedge.add_argument('--method', default='metrics', help='Analysis method: metrics, performance, fees')

    # Natural Resources
    natural = subparsers.add_parser('natural-resources', help='Natural resource analytics')
    natural.add_argument('--data', required=True, help='Resource data (JSON)')
    natural.add_argument('--method', default='basis', help='Analysis method: basis, contango, futures')

    # Private Capital
    private = subparsers.add_parser('private-capital', help='Private capital analytics')
    private.add_argument('--data', required=True, help='Investment data (JSON)')
    private.add_argument('--method', default='metrics', help='Analysis method: metrics, irr, moic')

    # Real Estate
    real_estate = subparsers.add_parser('real-estate', help='Real estate analytics')
    real_estate.add_argument('--data', required=True, help='Property data (JSON)')
    real_estate.add_argument('--method', default='noi', help='Analysis method: noi, caprate, dcf')

    # International REITs
    intl_reit = subparsers.add_parser('intl-reit', help='International REIT analytics')
    intl_reit.add_argument('--data', required=True, help='International REIT data (JSON)')
    intl_reit.add_argument('--method', default='diversification', help='Analysis method: diversification, currency, expense, regional')

    # Performance Metrics
    performance = subparsers.add_parser('performance', help='Performance metrics')
    performance.add_argument('--returns', required=True, help='Returns data (JSON)')
    performance.add_argument('--benchmark', help='Benchmark returns (JSON)')
    performance.add_argument('--method', default='twr', help='Analysis method: twr, mwr, sharpe')

    # Risk Analysis
    risk = subparsers.add_parser('risk', help='Risk analysis')
    risk.add_argument('--returns', required=True, help='Returns data (JSON)')
    risk.add_argument('--method', default='var', help='Analysis method: var, cvar, stress')
    risk.add_argument('--confidence-level', type=float, default=0.95, help='VaR confidence level')

    # TIPS (Inflation-Protected Securities)
    tips = subparsers.add_parser('tips', help='TIPS analytics')
    tips.add_argument('--data', required=True, help='TIPS data (JSON)')
    tips.add_argument('--method', default='real_yield', help='Analysis method: real_yield, inflation_scenarios, tax_efficiency')

    # I Bonds
    ibonds = subparsers.add_parser('ibonds', help='I Bonds (Series I Savings Bonds) analytics')
    ibonds.add_argument('--data', required=True, help='I Bond data (JSON)')
    ibonds.add_argument('--method', default='composite_rate', help='Analysis method: composite_rate, penalty, compare_tips, tax_efficiency')

    # High-Yield Bonds
    high_yield = subparsers.add_parser('high-yield', help='High-yield bond analytics')
    high_yield.add_argument('--data', required=True, help='Bond data (JSON)')
    high_yield.add_argument('--method', default='credit_analysis', help='Analysis method: credit_analysis, default_prob, equity_behavior')

    # Preferred Stocks
    preferred = subparsers.add_parser('preferred-stocks', help='Preferred stock analytics')
    preferred.add_argument('--data', required=True, help='Preferred stock data (JSON)')
    preferred.add_argument('--method', default='yield_analysis', help='Analysis method: yield_analysis, call_risk, dividend_safety')

    # Precious Metals Equities
    pme = subparsers.add_parser('pme', help='Precious metals equities analytics')
    pme.add_argument('--data', required=True, help='PME data (JSON)')
    pme.add_argument('--method', default='correlation', help='Analysis method: correlation, drawdowns, crisis_performance')

    # Convertible Bonds
    convertible = subparsers.add_parser('convertible-bonds', help='Convertible bond analytics')
    convertible.add_argument('--data', required=True, help='Convertible bond data (JSON)')
    convertible.add_argument('--method', default='conversion_premium', help='Analysis method: conversion_premium, bond_floor, upside_participation')

    # Fixed Annuities
    annuity = subparsers.add_parser('annuities', help='Fixed annuity analytics')
    annuity.add_argument('--data', required=True, help='Annuity data (JSON)')
    annuity.add_argument('--method', default='payouts', help='Analysis method: payouts, inflation_erosion, self_insurance')

    # Inflation-Indexed Annuities
    inflation_annuity = subparsers.add_parser('inflation-annuity', help='Inflation-indexed annuity analytics')
    inflation_annuity.add_argument('--data', required=True, help='Inflation annuity data (JSON)')
    inflation_annuity.add_argument('--method', default='compare_fixed', help='Analysis method: compare_fixed, compare_tips, longevity, inflation_value')

    # Emerging Market Bonds
    em_bonds = subparsers.add_parser('em-bonds', help='Emerging market bond analytics')
    em_bonds.add_argument('--data', required=True, help='EM bond data (JSON)')
    em_bonds.add_argument('--method', default='yield_spread', help='Analysis method: yield_spread, default_risk, currency_risk')

    # Managed Futures
    managed_futures = subparsers.add_parser('managed-futures', help='Managed futures / CTA analytics')
    managed_futures.add_argument('--data', required=True, help='Managed futures data (JSON)')
    managed_futures.add_argument('--method', default='trend_following', help='Analysis method: trend_following, crisis_alpha, fee_impact
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/alternateInvestment/config.py`
```
"""
Alternative Investments Configuration Module

Configuration, constants, enums, and validation rules for alternative investment analytics.
Supports private equity, real estate, hedge funds, commodities, and digital assets.

IMPORTANT: This module provides GLOBAL configurations. For market-specific parameters
(tax rates, trading days, etc.), use market_config.py
"""

from decimal import Decimal, getcontext
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
import logging

# Set high precision for financial calculations
getcontext().prec = 28


# ============================================================================
# CALCULATION CONSTANTS (UNIVERSAL)
# ============================================================================

class Constants:
    """
    Mathematical and financial constants (market-agnostic)
    For market-specific values, use market_config.py
    """
    DAYS_IN_YEAR = Decimal('365.25')
    BUSINESS_DAYS_IN_YEAR = Decimal('252')  # Default US/Europe, override with market_config
    MONTHS_IN_YEAR = Decimal('12')
    QUARTERS_IN_YEAR = Decimal('4')
    BASIS_POINTS = Decimal('10000')
    PERCENT = Decimal('100')

    # Risk-free rates (default, override with market_config)
    DEFAULT_RISK_FREE_RATE = Decimal('0.03')  # 3% global average

    # Alternative investment specific
    PE_TYPICAL_FUND_LIFE = 10  # years (global standard)
    RE_DEPRECIATION_YEARS = 40  # Average global, use market_config for specific
    COMMODITY_STORAGE_COST_TYPICAL = Decimal('0.02')  # 2% global average


# ============================================================================
# ENUMS AND CLASSIFICATIONS
# ============================================================================

class AssetClass(Enum):
    """Alternative investment asset classes"""
    PRIVATE_EQUITY = "private_equity"
    PRIVATE_DEBT = "private_debt"
    REAL_ESTATE = "real_estate"
    REIT = "reit"
    INFRASTRUCTURE = "infrastructure"
    COMMODITIES = "commodities"
    TIMBERLAND = "timberland"
    FARMLAND = "farmland"
    RAW_LAND = "raw_land"
    HEDGE_FUND = "hedge_fund"
    DIGITAL_ASSETS = "digital_assets"
    FIXED_INCOME = "fixed_income"
    EQUITY = "equity"
    ALTERNATIVE = "alternative"


class InvestmentMethod(Enum):
    """Investment access methods"""
    DIRECT = "direct"
    CO_INVESTMENT = "co_investment"
    FUND = "fund"


class HedgeFundStrategy(Enum):
    """Hedge fund strategy classifications"""
    # Equity Related
    LONG_SHORT_EQUITY = "long_short_equity"
    EQUITY_MARKET_NEUTRAL = "equity_market_neutral"
    DEDICATED_SHORT_BIAS = "dedicated_short_bias"

    # Event Driven
    MERGER_ARBITRAGE = "merger_arbitrage"
    DISTRESSED_SECURITIES = "distressed_securities"
    ACTIVIST = "activist"
    SPECIAL_SITUATIONS = "special_situations"

    # Relative Value
    FIXED_INCOME_ARBITRAGE = "fixed_income_arbitrage"
    CONVERTIBLE_ARBITRAGE = "convertible_arbitrage"
    ASSET_BACKED_SECURITIES = "asset_backed_securities"
    VOLATILITY_ARBITRAGE = "volatility_arbitrage"

    # Opportunistic
    GLOBAL_MACRO = "global_macro"
    CTA_MANAGED_FUTURES = "cta_managed_futures"

    # Specialist
    REINSURANCE = "reinsurance"
    STRUCTURED_CREDIT = "structured_credit"

    # Multi-Manager
    MULTI_STRATEGY = "multi_strategy"
    FUND_OF_FUNDS = "fund_of_funds"


class CommoditySector(Enum):
    """Commodity sector classifications"""
    ENERGY = "energy"
    METALS = "metals"
    AGRICULTURE = "agriculture"
    LIVESTOCK = "livestock"


class RealEstateType(Enum):
    """Real estate property types"""
    OFFICE = "office"
    RETAIL = "retail"
    INDUSTRIAL = "industrial"
    MULTIFAMILY = "multifamily"
    HOTEL = "hotel"
    MIXED_USE = "mixed_use"
    LAND = "land"


# ============================================================================
# DATA SCHEMAS
# ============================================================================

@dataclass
class AssetParameters:
    """
    Standard parameters for alternative investments

    For market-specific parameters (tax rates, trading days, etc.),
    specify market_region and the system will auto-load from market_config.py
    """
    asset_class: AssetClass
    ticker: Optional[str] = None
    name: Optional[str] = None
    currency: str = "USD"
    market_region: Optional[str] = None  # ISO country code or "GLOBAL"
    inception_date: Optional[str] = None
    management_fee: Optional[Decimal] = None
    performance_fee: Optional[Decimal] = None
    hurdle_rate: Optional[Decimal] = None
    high_water_mark: bool = True
    lock_up_period: Optional[int] = None  # months
    redemption_frequency: Optional[str] = None
    minimum_investment: Optional[Decimal] = None


@dataclass
class MarketData:
    """Standardized market data structure"""
    timestamp: str
    price: Decimal
    volume: Optional[Decimal] = None
    bid: Optional[Decimal] = None
    ask: Optional[Decimal] = None
    high: Optional[Decimal] = None
    low: Optional[Decimal] = None
    open: Optional[Decimal] = None
    close: Optional[Decimal] = None


@dataclass
class CashFlow:
    """Cash flow data structure"""
    date: str
    amount: Decimal
    cf_type: str  # 'inflow', 'outflow', 'distribution', 'capital_call'
    description: Optional[str] = None


@dataclass
class Performance:
    """Performance metrics structure"""
    period: str
    total_return: Decimal
    annualized_return: Optional[Decimal] = None
    volatility: Optional[Decimal] = None
    sharpe_ratio: Optional[Decimal] = None
    max_drawdown: Optional[Decimal] = None
    benchmark_return: Optional[Decimal] = None
    alpha: Optional[Decimal] = None
    beta: Optional[Decimal] = None


# ============================================================================
# CONFIGURATION SETTINGS
# ============================================================================

class Config:
    """Main configuration class"""

    # Data validation settings
    PRICE_TOLERANCE = Decimal('0.0001')  # 1 basis point
    MAX_LEVERAGE = Decimal('10.0')
    MIN_PRICE = Decimal('0.0001')

    # Performance calculation settings
    ANNUALIZATION_FACTOR = Constants.DAYS_IN_YEAR
    RISK_FREE_RATE = Constants.DEFAULT_RISK_FREE_RATE

    # Alternative investment specific settings
    PE_IRR_TOLERANCE = Decimal('0.000001')
    PE_IRR_MAX_ITERATIONS = 1000

    # Real estate settings
    RE_CAP_RATE_MIN = Decimal('0.01')  # 1%
    RE_CAP_RATE_MAX = Decimal('0.20')  # 20%

    # Commodity settings
    COMMODITY_ROLL_DAYS = 5  # Days before expiry to roll

    # Hedge fund settings
    HF_HIGH_WATER_MARK_DEFAULT = True
    HF_HURDLE_RATE_DEFAULT = Decimal('0.08')  # 8%

    # Digital assets settings
    CRYPTO_VOLATILITY_FLOOR = Decimal('0.10')  # 10% minimum volatility

    # Portfolio settings
    MAX_CONCENTRATION = Decimal('0.50')  # 50% max in single asset
    MIN_WEIGHT = Decimal('0.001')  # 0.1% minimum weight

    # Reporting settings
    DECIMAL_PLACES = 4
    PERCENTAGE_DECIMAL_PLACES = 2

    @classmethod
    def get_asset_defaults(cls, asset_class: AssetClass) -> Dict[str, Any]:
        """Get default parameters for asset class"""
        defaults = {
            AssetClass.PRIVATE_EQUITY: {
                'management_fee': Decimal('0.02'),  # 2%
                'performance_fee': Decimal('0.20'),  # 20%
                'lock_up_period': 120,  # 10 years
                'minimum_investment': Decimal('1000000')  # $1M
            },
            AssetClass.PRIVATE_DEBT: {
                'management_fee': Decimal('0.015'),  # 1.5%
                'performance_fee': Decimal('0.10'),  # 10%
                'lock_up_period': 60,  # 5 years
                'minimum_investment': Decimal('250000')  # $250K
            },
            AssetClass.REAL_ESTATE: {
                'management_fee': Decimal('0.01'),  # 1%
                'performance_fee': Decimal('0.15'),  # 15%
                'minimum_investment': Decimal('5000
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/alternateInvestment/convertible_bonds.py`
```
"""convertible_bonds Module"""

import numpy as np
import pandas as pd
from decimal import Decimal, getcontext
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, timedelta
import logging

from config import (
    MarketData, CashFlow, Performance, AssetParameters, AssetClass,
    Constants, Config
)
from base_analytics import AlternativeInvestmentBase, FinancialMath

logger = logging.getLogger(__name__)


class ConvertibleBondAnalyzer(AlternativeInvestmentBase):
    """
    Convertible Bond Analyzer

    CFA Standards: Fixed Income - Convertibles, Embedded Options

    Key Concepts from Key insight: - Hybrid security: Bond + equity call option
    - Conversion ratio and conversion price
    - Investment value (straight bond floor)
    - Conversion value (equity floor)
    - Conversion premium
    - Asymmetric payoff structure

    Verdict: "The Flawed" - Complex, expensive, limited upside capture
    """

    def __init__(self, parameters: AssetParameters):
        super().__init__(parameters)
        self.face_value = parameters.face_value if hasattr(parameters, 'face_value') else Decimal('1000')
        self.coupon_rate = parameters.coupon_rate if hasattr(parameters, 'coupon_rate') else Decimal('0.03')
        self.maturity_years = parameters.maturity_years if hasattr(parameters, 'maturity_years') else 5
        self.current_price = parameters.current_market_value if hasattr(parameters, 'current_market_value') else self.face_value

        # Conversion features
        self.conversion_ratio = parameters.conversion_ratio if hasattr(parameters, 'conversion_ratio') else Decimal('20')
        self.conversion_price = self.face_value / self.conversion_ratio
        self.stock_price = parameters.stock_price if hasattr(parameters, 'stock_price') else Decimal('45')

        # Credit parameters
        self.credit_spread = parameters.credit_spread if hasattr(parameters, 'credit_spread') else Decimal('0.02')

    def calculate_conversion_value(self, stock_price: Optional[Decimal] = None) -> Decimal:
        """
        Calculate conversion value (equity floor)

        CFA: Conversion Value = Conversion Ratio × Stock Price

        Args:
            stock_price: Current stock price (default: self.stock_price)

        Returns:
            Conversion value
        """
        if stock_price is None:
            stock_price = self.stock_price

        return self.conversion_ratio * stock_price

    def calculate_straight_bond_value(self, market_yield: Decimal) -> Decimal:
        """
        Calculate investment value (straight bond floor)

        CFA: Value convertible as if it were a plain bond
        Bond Value = PV(Coupons) + PV(Principal)

        Args:
            market_yield: Market yield for comparable non-convertible bond

        Returns:
            Straight bond value
        """
        annual_coupon = self.coupon_rate * self.face_value

        # Present value of coupons
        pv_coupons = Decimal('0')
        for t in range(1, self.maturity_years + 1):
            pv_coupons += annual_coupon / ((Decimal('1') + market_yield) ** Decimal(str(t)))

        # Present value of principal
        pv_principal = self.face_value / ((Decimal('1') + market_yield) ** Decimal(str(self.maturity_years)))

        return pv_coupons + pv_principal

    def calculate_conversion_premium(self, stock_price: Optional[Decimal] = None) -> Dict[str, Any]:
        """
        Calculate conversion premium

        CFA: Premium = (Convertible Price - Conversion Value) / Conversion Value
        Shows how much investor pays for the conversion option

        Args:
            stock_price: Current stock price

        Returns:
            Conversion premium metrics
        """
        conversion_value = self.calculate_conversion_value(stock_price)

        # Conversion premium (dollar and percentage)
        premium_dollar = self.current_price - conversion_value
        premium_percent = premium_dollar / conversion_value if conversion_value > 0 else Decimal('0')

        # Breakeven stock price increase
        breakeven_increase = premium_percent

        return {
            'current_bond_price': float(self.current_price),
            'conversion_value': float(conversion_value),
            'conversion_premium_dollar': float(premium_dollar),
            'conversion_premium_percent': float(premium_percent),
            'breakeven_stock_increase': float(breakeven_increase),
            'interpretation': self._interpret_conversion_premium(premium_percent)
        }

    def _interpret_conversion_premium(self, premium: Decimal) -> str:
        """Interpret conversion premium level"""
        if premium < Decimal('0.10'):
            return 'Low premium - In-the-money, equity-like behavior'
        elif premium < Decimal('0.20'):
            return 'Moderate premium - Balanced hybrid'
        elif premium < Decimal('0.30'):
            return 'High premium - Bond-like behavior, expensive option'
        else:
            return 'Very high premium - Expensive, limited equity participation'

    def calculate_bond_floor(self, market_yield: Decimal) -> Dict[str, Any]:
        """
        Calculate bond floor and downside protection

        CFA: Bond floor = max(Straight Bond Value, Conversion Value)
        Provides downside protection

        Args:
            market_yield: Market yield for comparable non-convertible

        Returns:
            Floor analysis
        """
        straight_bond_value = self.calculate_straight_bond_value(market_yield)
        conversion_value = self.calculate_conversion_value()

        bond_floor = max(straight_bond_value, conversion_value)

        # Downside protection
        downside_protection = (self.current_price - bond_floor) / self.current_price if self.current_price > 0 else Decimal('0')

        # Premium to floor
        premium_to_floor = (self.current_price - bond_floor) / bond_floor if bond_floor > 0 else Decimal('0')

        return {
            'straight_bond_value': float(straight_bond_value),
            'conversion_value': float(conversion_value),
            'bond_floor': float(bond_floor),
            'current_price': float(self.current_price),
            'downside_protection': float(downside_protection),
            'premium_to_floor': float(premium_to_floor),
            'primary_floor': 'Bond' if straight_bond_value > conversion_value else 'Equity'
        }

    def calculate_upside_participation(self, stock_price_scenarios: List[Decimal]) -> Dict[str, Any]:
        """
        Calculate upside participation vs direct equity

        Criticism: Convertibles capture only partial upside vs direct stock ownership
        Premium paid for conversion option reduces gains

        Args:
            stock_price_scenarios: List of potential stock prices

        Returns:
            Upside participation analysis
        """
        results = []

        initial_stock_price = self.stock_price
        initial_conversion_value = self.calculate_conversion_value(initial_stock_price)

        for future_stock_price in stock_price_scenarios:
            # Stock return
            stock_return = (future_stock_price - initial_stock_price) / initial_stock_price

            # Convertible bond value (assume converts if in-the-money)
            future_conversion_value = self.calculate_conversion_value(future_stock_price)

            # Convertible return (from current price, not conversion value)
            convertible_return = (future_conversion_value - self.current_price) / self.current_price

            # Participation rate
            participation = convertible_return / stock_return if stock_return != 0 else Decimal('0')

            results.append({
                'stock_price': float(future_stock_price),
                'stock_return': float(stock_return),
                'convertible_return': float(convertible_return),
                'participation_rate': float(participation),
          
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/alternateInvestment/covered_calls.py`
```
"""
Covered Calls Module

Options strategy of holding stock + selling call option

CFA Standards: Derivatives, Options Strategies

Key Concepts: - Sell call option on stock you own
- Collect premium but cap upside
- Tax inefficiency (converts LTCG to short-term income)
- Transaction costs eat returns
- Better alternative: buy fewer shares

Verdict: THE FLAWED - Tax inefficient, costly
Rating: 3/10 - Avoid in taxable accounts
"""

from decimal import Decimal, getcontext
from typing import Dict, Any, List
from datetime import datetime, timedelta
import logging

from config import AssetParameters, AssetClass
from base_analytics import AlternativeInvestmentBase

logger = logging.getLogger(__name__)
getcontext().prec = 28


class CoveredCallAnalyzer(AlternativeInvestmentBase):
    """
    Covered Call Strategy Analyzer

    1. Tax Problem: Converts long-term gains to short-term income
    2. Transaction Costs: Commissions + bid-ask spreads
    3. Opportunity Cost: Cap upside participation
    4. Better Alternative: Just hold fewer shares if want less risk

    Verdict: THE FLAWED
    Rating: 3/10 - Avoid, especially in taxable accounts
    """

    def __init__(self, parameters: AssetParameters):
        super().__init__(parameters)

        # Stock position
        self.stock_price = getattr(parameters, 'stock_price', Decimal('100'))
        self.shares_owned = getattr(parameters, 'shares_owned', 100)
        self.position_value = self.stock_price * Decimal(str(self.shares_owned))

        # Call option sold
        self.strike_price = getattr(parameters, 'strike_price', self.stock_price * Decimal('1.05'))  # 5% OTM
        self.option_premium = getattr(parameters, 'option_premium', self.stock_price * Decimal('0.02'))  # 2% premium
        self.days_to_expiration = getattr(parameters, 'days_to_expiration', 30)

        # Costs
        self.option_commission = getattr(parameters, 'option_commission', Decimal('0.65'))  # Per contract
        self.stock_commission = getattr(parameters, 'stock_commission', Decimal('0'))  # Zero commission brokers
        self.bid_ask_spread_pct = getattr(parameters, 'bid_ask_spread_pct', Decimal('0.01'))  # 1% spread

        # Tax rates
        self.ordinary_tax_rate = getattr(parameters, 'ordinary_tax_rate', Decimal('0.37'))  # Top bracket
        self.ltcg_rate = getattr(parameters, 'ltcg_rate', Decimal('0.20'))  # LTCG rate
        self.holding_period = getattr(parameters, 'holding_period_days', 400)  # Days held

    def calculate_option_income(self) -> Dict[str, Any]:
        """Calculate premium income from selling calls"""
        # Premium received (per share)
        premium_per_share = self.option_premium

        # Contracts (100 shares per contract)
        contracts = self.shares_owned / 100

        # Total premium
        total_premium = premium_per_share * Decimal(str(self.shares_owned))

        # Transaction costs
        commission_cost = self.option_commission * Decimal(str(contracts))
        bid_ask_cost = total_premium * self.bid_ask_spread_pct
        total_costs = commission_cost + bid_ask_cost

        # Net premium
        net_premium = total_premium - total_costs

        # Annualized return from premium
        annual_factor = Decimal('365') / Decimal(str(self.days_to_expiration))
        annualized_return = (net_premium / self.position_value) * annual_factor

        return {
            'premium_per_share': float(premium_per_share),
            'total_premium': float(total_premium),
            'contracts': float(contracts),
            'commission_cost': float(commission_cost),
            'bid_ask_cost': float(bid_ask_cost),
            'total_costs': float(total_costs),
            'net_premium': float(net_premium),
            'return_on_position': float(net_premium / self.position_value),
            'annualized_return_estimate': float(annualized_return),
            'note': 'Return capped at strike price'
        }

    def tax_consequences(self) -> Dict[str, Any]:
        """
        Analyze tax consequences of covered calls

        Key Issue: Tax treatment destroys strategy in taxable accounts

        Problem: If stock called away, gain taxed as SHORT-TERM even if held > 1 year
        """
        # Scenario 1: Stock NOT called (expires worthless or bought back)
        premium_income = self.option_premium * Decimal(str(self.shares_owned))

        # Commission to close position
        contracts = self.shares_owned / 100
        close_commission = self.option_commission * Decimal(str(contracts))

        # Premium taxed as short-term income
        premium_after_tax = premium_income * (Decimal('1') - self.ordinary_tax_rate)

        # Scenario 2: Stock CALLED AWAY
        # Any gain becomes short-term (even if held > 1 year)
        assumed_cost_basis = self.stock_price * Decimal('0.90')  # Assume bought 10% lower
        gain_per_share = self.strike_price - assumed_cost_basis

        # If held > 1 year but called: LTCG becomes short-term
        tax_if_ltcg = gain_per_share * Decimal(str(self.shares_owned)) * self.ltcg_rate
        tax_if_called = (gain_per_share * Decimal(str(self.shares_owned)) + premium_income) * self.ordinary_tax_rate

        # Tax penalty from call
        tax_penalty = tax_if_called - tax_if_ltcg

        return {
            'scenario_1_not_called': {
                'premium_income': float(premium_income),
                'tax_rate_on_premium': float(self.ordinary_tax_rate),
                'after_tax_premium': float(premium_after_tax),
                'note': 'Premium taxed as ordinary income'
            },
            'scenario_2_stock_called': {
                'gain_per_share': float(gain_per_share),
                'total_gain': float(gain_per_share * Decimal(str(self.shares_owned))),
                'holding_period_days': self.holding_period,
                'tax_if_ltcg': float(tax_if_ltcg),
                'tax_if_called_short_term': float(tax_if_called),
                'tax_penalty_from_call': float(tax_penalty),
                'penalty_pct_of_gain': float(tax_penalty / (gain_per_share * Decimal(str(self.shares_owned)))) if gain_per_share > 0 else 0,
                'analysis_warning': 'Call destroys LTCG treatment - converts to short-term'
            },
            'analysis_conclusion': 'Tax consequences make covered calls toxic in taxable accounts'
        }

    def opportunity_cost_analysis(self, market_scenarios: List[Decimal] = None) -> Dict[str, Any]:
        """
        Analyze opportunity cost of capping upside

        Key insight: You give up unlimited upside for small premium
        """
        if market_scenarios is None:
            # Stock return scenarios
            market_scenarios = [
                Decimal('-0.20'),  # -20%
                Decimal('-0.10'),  # -10%
                Decimal('0.00'),   # Flat
                Decimal('0.05'),   # +5%
                Decimal('0.10'),   # +10% (above strike)
                Decimal('0.15'),   # +15%
                Decimal('0.20'),   # +20%
                Decimal('0.30'),   # +30%
            ]

        strike_pct = (self.strike_price / self.stock_price) - Decimal('1')
        premium_pct = self.option_premium / self.stock_price

        results = []
        for scenario in market_scenarios:
            stock_return = scenario

            # Covered call return
            if stock_return <= strike_pct:
                # Stock not called
                cc_return = stock_return + premium_pct
            else:
                # Stock called - capped at strike
                cc_return = strike_pct + premium_pct

            # Opportunity cost
            opportunity_cost = stock_return - cc_return

            results.append({
                'stock_return': float(stock_return),
                'covered_call_return': float(cc_return),
                'premium_boost': float(premium_pct),
                'opportunity_cost': float(opportunity_cost),
                'upside_cap
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/alternateInvestment/data_handler.py`
```
"""data_handler Module"""

import pandas as pd
import numpy as np
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Union, Any, Tuple
from datetime import datetime, date
import json
import csv
from dataclasses import asdict
import logging

from config import (
    MarketData, CashFlow, Performance, AssetParameters, AssetClass,
    Config, ValidationRules, Constants
)

logger = logging.getLogger(__name__)


class DataValidationError(Exception):
    """Custom exception for data validation errors"""
    pass


class DataHandler:
    """
    Centralized data handler for all alternative investment data sources
    Supports multiple input formats and validates according to CFA standards
    """

    def __init__(self):
        self.config = Config()
        self.validation_rules = ValidationRules()

    def standardize_price_data(self, data: Union[Dict, pd.DataFrame, List]) -> List[MarketData]:
        """
        Standardize price data from various sources into MarketData objects

        Args:
            data: Price data in various formats

        Returns:
            List of MarketData objects
        """
        try:
            if isinstance(data, pd.DataFrame):
                return self._from_dataframe(data)
            elif isinstance(data, dict):
                return self._from_dict(data)
            elif isinstance(data, list):
                return self._from_list(data)
            else:
                raise DataValidationError(f"Unsupported data type: {type(data)}")

        except Exception as e:
            logger.error(f"Error standardizing price data: {str(e)}")
            raise DataValidationError(f"Failed to standardize price data: {str(e)}")

    def _from_dataframe(self, df: pd.DataFrame) -> List[MarketData]:
        """Convert DataFrame to MarketData objects"""
        required_columns = ['timestamp', 'price']
        if not all(col in df.columns for col in required_columns):
            raise DataValidationError(f"DataFrame must contain columns: {required_columns}")

        market_data = []
        for _, row in df.iterrows():
            md = MarketData(
                timestamp=self._standardize_timestamp(row['timestamp']),
                price=self._to_decimal(row['price']),
                volume=self._to_decimal(row.get('volume')),
                bid=self._to_decimal(row.get('bid')),
                ask=self._to_decimal(row.get('ask')),
                high=self._to_decimal(row.get('high')),
                low=self._to_decimal(row.get('low')),
                open=self._to_decimal(row.get('open')),
                close=self._to_decimal(row.get('close'))
            )
            self._validate_market_data(md)
            market_data.append(md)

        return market_data

    def _from_dict(self, data: Dict) -> List[MarketData]:
        """Convert dictionary to MarketData objects"""
        if 'data' in data:
            data = data['data']

        if isinstance(data, list):
            return [self._dict_to_market_data(item) for item in data]
        else:
            return [self._dict_to_market_data(data)]

    def _from_list(self, data: List) -> List[MarketData]:
        """Convert list to MarketData objects"""
        return [self._dict_to_market_data(item) for item in data]

    def _dict_to_market_data(self, item: Dict) -> MarketData:
        """Convert single dictionary item to MarketData"""
        md = MarketData(
            timestamp=self._standardize_timestamp(item.get('timestamp', item.get('date', item.get('time')))),
            price=self._to_decimal(item.get('price', item.get('close'))),
            volume=self._to_decimal(item.get('volume')),
            bid=self._to_decimal(item.get('bid')),
            ask=self._to_decimal(item.get('ask')),
            high=self._to_decimal(item.get('high')),
            low=self._to_decimal(item.get('low')),
            open=self._to_decimal(item.get('open')),
            close=self._to_decimal(item.get('close'))
        )
        self._validate_market_data(md)
        return md

    def standardize_cash_flows(self, data: Union[Dict, pd.DataFrame, List]) -> List[CashFlow]:
        """
        Standardize cash flow data for IRR and performance calculations

        Args:
            data: Cash flow data in various formats

        Returns:
            List of CashFlow objects
        """
        try:
            if isinstance(data, pd.DataFrame):
                return self._cash_flows_from_dataframe(data)
            elif isinstance(data, dict):
                return self._cash_flows_from_dict(data)
            elif isinstance(data, list):
                return self._cash_flows_from_list(data)
            else:
                raise DataValidationError(f"Unsupported cash flow data type: {type(data)}")

        except Exception as e:
            logger.error(f"Error standardizing cash flows: {str(e)}")
            raise DataValidationError(f"Failed to standardize cash flows: {str(e)}")

    def _cash_flows_from_dataframe(self, df: pd.DataFrame) -> List[CashFlow]:
        """Convert DataFrame to CashFlow objects"""
        required_columns = ['date', 'amount']
        if not all(col in df.columns for col in required_columns):
            raise DataValidationError(f"Cash flow DataFrame must contain columns: {required_columns}")

        cash_flows = []
        for _, row in df.iterrows():
            cf = CashFlow(
                date=self._standardize_date(row['date']),
                amount=self._to_decimal(row['amount']),
                cf_type=row.get('type', 'inflow' if float(row['amount']) > 0 else 'outflow'),
                description=row.get('description')
            )
            self._validate_cash_flow(cf)
            cash_flows.append(cf)

        return sorted(cash_flows, key=lambda x: x.date)

    def _cash_flows_from_dict(self, data: Dict) -> List[CashFlow]:
        """Convert dictionary to CashFlow objects"""
        if 'cash_flows' in data:
            data = data['cash_flows']

        if isinstance(data, list):
            return [self._dict_to_cash_flow(item) for item in data]
        else:
            return [self._dict_to_cash_flow(data)]

    def _cash_flows_from_list(self, data: List) -> List[CashFlow]:
        """Convert list to CashFlow objects"""
        return [self._dict_to_cash_flow(item) for item in data]

    def _dict_to_cash_flow(self, item: Dict) -> CashFlow:
        """Convert single dictionary item to CashFlow"""
        cf = CashFlow(
            date=self._standardize_date(item.get('date', item.get('timestamp'))),
            amount=self._to_decimal(item.get('amount', item.get('value'))),
            cf_type=item.get('type', item.get('cf_type', 'inflow' if float(item.get('amount', 0)) > 0 else 'outflow')),
            description=item.get('description', item.get('desc'))
        )
        self._validate_cash_flow(cf)
        return cf

    def load_from_csv(self, file_path: str, data_type: str = 'price') -> Union[List[MarketData], List[CashFlow]]:
        """
        Load data from CSV file

        Args:
            file_path: Path to CSV file
            data_type: 'price' or 'cash_flow'

        Returns:
            Standardized data objects
        """
        try:
            df = pd.read_csv(file_path)

            if data_type == 'price':
                return self.standardize_price_data(df)
            elif data_type == 'cash_flow':
                return self.standardize_cash_flows(df)
            else:
                raise DataValidationError(f"Unsupported data type: {data_type}")

        except Exception as e:
            logger.error(f"Error loading CSV file {file_path}: {str(e)}")
            raise DataValidationError(f"Failed to load CSV: {str(e)}")

    def load_from_json(self, file_path: str, data_type: str = 'price') -> Union[List[MarketData], List[CashFlow]]:
        """
        Load data from JSON file

        Args:
            file_path: Path to JSON file

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #23** (2025-02-24): **Issue while installation**
  *Symptoms*: Hi @tilakpatel22. First of all I must say this seems to be an amazing tool - great work!  However, when I try to install it using the EXE, the app just doesnt launch. When I install it using Pypi, it is says I don't have certain libraries installed. When I try to install the requirements, I get an error while installing empyrical.  Please help me
  **Post-Mortem & Fix Analysis**:
  > @dopevog I'm looking into the issue and will be fixing it in 6-12 hours
  > @dopevog May i Know what python version you are using and have you tried pip install fincept-terminal[all] this should properly install all the libraries 
  > I reinstalled using pip install fincept-terminal[all] but still get this error on running. I am using python 3.12.7  ![Image](https://github.com/user-attachments/assets/3b40e460-1f09-4f20-942c-6e0a331f2689)

- **Issue #16** (2025-02-07): **[Bug] Stuck at the welcome screen**
  *Symptoms*: ### Describe the Bug When  running the app with fincept command after installing through pip, it shows the welcome screen, I can open the command palette, change theme etc., but what seems to be buttons is cut and I cannot scroll or move forward from that screen in any way.  ### Steps to Reproduce Steps to reproduce the behavior: 1. `pip install fincept-terminal` in a venv(Python 3.11) 2. `fincept`   ### Expected Behavior I expected the page to be scrollablel.  ### Screenshots  ![Image](https://github.com/user-attachments/assets/5ff54901-da25-4e96-ae7f-a4ed6991b8b0)  ### System Information - **OS**: Ubuntu 24.04.1 LTS 
  **Post-Mortem & Fix Analysis**:
  > Noted, Maybe issue due to different screen sizes in next update I will correct this 
  > Install the latest version from[ PyPI](https://pypi.org/project/fincept-terminal/) - https://pypi.org/project/fincept-terminal/  we have solved this issue and report other bugs as you find we haven't tested project much yet so you may encounter more bugs 

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

### Incident Patch 1: `ec88590a` (2026-08-31)
**Commit Message**: Mcp and tool system fixes

**File**: `fincept-qt/packaging/flatpak/in.fincept.FinceptTerminal.desktop` (modified, +1/-2)
```diff
@@ -4,11 +4,10 @@ Type=Application
 Name=Fincept Terminal
 GenericName=Financial Intelligence Terminal
 Comment=Professional financial data terminal with AI analytics, trading, and market data
-Exec=FinceptTerminal %U
+Exec=FinceptTerminal
 Icon=in.fincept.FinceptTerminal
 Terminal=false
 StartupWMClass=FinceptTerminal
 StartupNotify=true
 Categories=Finance;Office;Science;
-MimeType=application/x-fincept;
 Keywords=finance;trading;stocks;crypto;portfolio;AI;analytics;markets;
```

**File**: `fincept-qt/packaging/flatpak/in.fincept.FinceptTerminal.metainfo.xml` (modified, +15/-5)
```diff
@@ -46,23 +46,23 @@
   <screenshots>
     <screenshot type="default">
       <caption>Dashboard with customizable widget grid</caption>
-      <image>https://raw.githubusercontent.com/Fincept-Corporation/FinceptTerminal/main/images/Dashboard.png</image>
+      <image>https://raw.githubusercontent.com/Fincept-Corporation/FinceptTerminal/v4.4.1/images/Dashboard.png</image>
     </screenshot>
     <screenshot>
       <caption>Equity research with comprehensive analysis</caption>
-      <image>https://raw.githubusercontent.com/Fincept-Corporation/FinceptTerminal/main/images/EquityResearch.png</image>
+      <image>https://raw.githubusercontent.com/Fincept-Corporation/FinceptTerminal/v4.4.1/images/EquityResearch.png</image>
     </screenshot>
     <screenshot>
       <caption>Portfolio management and analytics</caption>
-      <image>https://raw.githubusercontent.com/Fincept-Corporation/FinceptTerminal/main/images/Portfolio.png</image>
+      <image>https://raw.githubusercontent.com/Fincept-Corporation/FinceptTerminal/v4.4.1/images/Portfolio.png</image>
     </screenshot>
     <screenshot>
       <caption>News aggregation from multiple sources</caption>
-      <image>https://raw.githubusercontent.com/Fincept-Corporation/FinceptTerminal/main/images/News.png</image>
+      <image>https://raw.githubusercontent.com/Fincept-Corporation/FinceptTerminal/v4.4.1/images/News.png</image>
     </screenshot>
     <screenshot>
       <caption>Visual node editor for workflows</caption>
-      <image>https://raw.githubusercontent.com/Fincept-Corporation/FinceptTerminal/main/images/NodeEditor.png</image>
+      <image>https://raw.githubusercontent.com/Fincept-Corporation/FinceptTerminal/v4.4.1/images/NodeEditor.png</image>
     </screenshot>
   </screenshots>
 
@@ -71,6 +71,15 @@
   </provides>
 
   <releases>
+    <!-- 4.5.0 is NOT released yet: no v4.4.1-style tag exists for it and
+         updates.json still reports 4.4.1. The Flatpak manifest therefore
+         builds v4.4.1, and the newest release listed here must match what
+         is actually shipped, or Flathub advertises a version whose binary
+         it does not have. Notes kept verbatim: on tagging v4.5.0, delete
+         these two comment lines and bump tag+commit in the manifest.
+    <release version="4.5.0" ...> block below is inert until then.
+    -->
+    <!--
     <release version="4.5.0" date="2026-08-31">
       <description>
         <p>Fixes AI tool calling with Google Gemini. Around 150 tools take a free-form options object, which Gemini's schema cannot express; those tools were being advertised to Gemini as taking no arguments at all, so the assistant could call them but never pass them anything. They now work on Gemini as they already did on other providers.</p>
@@ -79,6 +88,7 @@
         <p>Tool sequences now have a time limit as well as a step limit, and say which one ran out instead of stopping without explanation. Also fixes the AstraFlow and AstraFlow CN providers failing to find their endpoint when the base URL field was cleared.</p>
       </description>
     </release>
+    -->
     <release version="4.4.1" date="2026-08-19">
       <description>
         <p>Adds the TickerAll (MetaTrader 5) broker integration, so MT5 accounts can be linked, funded and traded from the equity trading screen alongside the existing brokers.</p>
```

**File**: `fincept-qt/packaging/flatpak/in.fincept.FinceptTerminal.yml` (modified, +9/-2)
```diff
@@ -52,10 +52,17 @@ modules:
       - cmake --build _build --parallel
       - cmake --install _build
     sources:
-      # Main repository
+      # Main repository.
+      # Flathub's linter REQUIRES a commit alongside a tag ("this is an error
+      # for new submissions if a commit is missing with a tag") — tags are
+      # mutable, so the commit is what makes the build reproducible.
+      # Pinned to the latest *released* tag. Bump both fields together on each
+      # release; a tag that does not exist fails the build at source fetch,
+      # which is what v4.5.0 did here before it was ever tagged.
       - type: git
         url: https://github.com/Fincept-Corporation/FinceptTerminal.git
-        tag: v4.5.0
+        tag: v4.4.1
+        commit: 4d169bd4e1a5011ecc1d8befedb8e0d713dbfe3e
       # Vendored FetchContent dependencies (no network during build)
       - type: git
         url: https://github.com/QtExcel/QXlsx.git
```

**File**: `fincept-qt/packaging/flatpak/preflight.py` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+"""Offline pre-flight for the Flathub submission.
+
+Checks the subset of flatpak-builder-lint / AppStream rules that can be
+verified WITHOUT a Linux box, so the real lint run passes first time:
+
+  * every git source is pinned (Flathub: a tag without a commit is a hard
+    error for new submissions -- tags are mutable)
+  * the ref the manifest builds actually EXISTS on the remote, and its commit
+    matches the tag (the manifest once pointed at an untagged v4.5.0, so the
+    build could never have succeeded)
+  * screenshots are pinned to a tag/commit, not a mutable branch
+  * the newest <release> matches the version the manifest builds, so Flathub
+    cannot advertise a version whose binary it does not have
+  * the desktop entry is internally consistent with the manifest and declares
+    no MIME type or field code the app cannot honour
+
+Run:  python preflight.py       (needs pyyaml; exits non-zero on any failure)
+
+It does NOT replace flatpak-builder-lint -- run that on Linux too. See
+FLATHUB.md.
+"""
+import io, os, re, sys, subprocess, xml.dom.minidom
+import yaml
+
+D = os.path.dirname(os.path.abspath(__file__))
+# <repo>/fincept-qt/packaging/flatpak -> <repo>
+REPO = os.path.abspath(os.path.join(D, "..", "..", ".."))
+APPID = "in.fincept.FinceptTerminal"
+fails, warns = [], []
+
+def ck(ok, label, hard=True):
+    print(f"  [{'PASS' if ok else ('FAIL' if hard else 'WARN')}] {label}")
+    if not ok:
+        (fails if hard else warns).append(label)
+
+print("[1] manifest YAML")
+man = yaml.safe_load(io.open(os.path.join(D, f"{APPID}.yml"), encoding="utf-8"))
+ck(man["id"] == APPID, f"id matches filename ({APPID})")
+ck(bool(man.get("command")), "command declared")
+ck(man.get("runtime") and man.get("sdk"), "runtime + sdk declared")
+
+print("[2] git sources pinned (Flathub: tag without commit = ERROR for new submissions)")
+srcs = [(m.get("name", "?"), s) for m in man["modules"] if isinstance(m, dict)
+        for s in m.get("sources", []) if isinstance(s, dict) and s.get("type") == "git"]
+ck(len(srcs) > 0, f"found {len(srcs)} git sources")
+for name, s in srcs:
+    url = s["url"].rsplit("/", 1)[-1]
+    if "tag" in s:
+        ck("commit" in s, f"{name}:{url} has tag -> must also have commit")
+    else:
+        ck("commit" in s, f"{name}:{url} pinned by commit")
+    if "commit" in s:
+        ck(bool(re.fullmatch(r"[0-9a-f]{40}", s["commit"])), f"{name}:{url} commit is full 40-char SHA")
+
+print("[3] built ref actually exists on the remote")
+for name, s in srcs:
+    if "FinceptTerminal.git" in s["url"]:
+        tag = s.get("tag")
+        r = subprocess.run(["git", "ls-remote", "--tags", "origin", f"refs/tags/{tag}"],
+                           cwd=REPO, capture_output=True, text=True)
+        ck(bool(r.stdout.strip()), f"tag {tag} exists on origin")
+        if s.get("commit"):
+            r2 = subprocess.run(["git", "rev-parse", f"{tag}^{{commit}}"], cwd=REPO,
+                                capture_output=True, text=True)
+            ck(r2.stdout.strip() == s["commit"], f"commit matches {tag} ({r2.stdout.strip()[:8]})")
+
+print("[4] metainfo XML")
+mp = os.path.join(D, f"{APPID}.metainfo.xml")
+dom = xml.dom.minidom.parse(mp)
+xt = io.open(mp, encoding="utf-8").read()
+ck(True, "well-formed XML")
+def one(tag):
+    n = dom.getElementsByTagName(tag)
+    return n[0].firstChild.nodeValue.strip() if n and n[0].firstChild else None
+ck(one("id") == APPID, "metainfo id matches app id")
+for t in ("name", "summary", "metadata_license", "project_license"):
+    ck(bool(one(t)), f"<{t}> present")
+ck(len(dom.getElementsByTagName("screenshot")) > 0, "has screenshots")
+ck(bool(dom.getElementsByTagName("content_rating")), "has content_rating (OARS)")
+launch = dom.getElementsByTagName("launchable")
+ck(bool(launch) and launch[0].firstChild.nodeValue.strip() == f"{APPID}.desktop",
+   "launchable points at the desktop id")
+
+print("[5] screenshots not on a mutable branch")
+imgs
```

**File**: `fincept-qt/src/trading/brokers/icicidirect/IciciDirectBroker.h` (modified, +13/-3)
```diff
@@ -17,14 +17,24 @@ namespace fincept::trading {
 /// DELETE=cancel). Symbol mapping (normal ticker <-> ICICI stock_code, plus F&O
 /// expiry/strike/right decomposition) comes from InstrumentService ("icicidirect").
 ///
-/// Scope (v1): REST only. Live tick streaming (Breeze Socket.IO) is deferred, so
-/// ws_adapter_name() returns "".
+/// Live tick streaming IS supported: IciciDirectWebSocket speaks Breeze's
+/// Socket.IO (Engine.IO v4) transport and is constructed by AccountDataStream
+/// for this broker id. It shipped in the same commit as the REST surface — the
+/// "v1: REST only, streaming deferred" note that used to sit here was stale from
+/// the first release and claimed the opposite of what the code does.
 class IciciDirectBroker : public IBroker {
   public:
     BrokerId id() const override { return BrokerId::IciciDirect; }
     const char* name() const override { return "ICICI Direct"; }
     const char* base_url() const override { return "https://api.icicidirect.com/breezeapi/api/v1"; }
-    const char* ws_adapter_name() const override { return ""; } // streaming deferred
+    // Nothing dispatches on this today — AccountDataStream picks the socket with
+    // a hardcoded `broker_id_ == "..."` chain, and every other broker's adapter
+    // name is likewise unread. Leaving it empty is still wrong: ICICI was the only
+    // broker returning "" while all the others name their adapter, so the day this
+    // accessor becomes the dispatch key, ICICI is the one that silently loses
+    // streaming — and "" would read as a deliberate "no socket" rather than an
+    // oversight.
+    const char* ws_adapter_name() const override { return "icicidirect"; }
 
     BrokerProfile profile() const override {
         return BrokerProfile{
```

---

### Incident Patch 2: `8b665804` (2026-08-31)
**Commit Message**: Mcp and tool system fixes

**File**: `README.md` (modified, +0/-10)
```diff
@@ -161,16 +161,6 @@ Questions: [support@fincept.in](mailto:support@fincept.in) · [Terms](https://fi
 
 ### **Your Thinking is the Only Limit. The Data Isn't.**
 
-<div align="center">
-<a href="https://star-history.com/#Fincept-Corporation/FinceptTerminal&Date">
- <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date&theme=dark" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date" />
-   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date" />
- </picture>
-</a>
-</div>
-
 [![Repobeats](https://repobeats.axiom.co/api/embed/fincept-corporation-finceptterminal.svg "Repobeats analytics image")](https://repobeats.axiom.co)
 
 [![Email](https://img.shields.io/badge/Email-support@fincept.in-blue)](mailto:support@fincept.in)
```

**File**: `fincept-qt/CMakeLists.txt` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ if(WIN32 AND CMAKE_HOST_WIN32)
     unset(_fincept_sdk_dirs)
 endif()
 
-project(FinceptTerminal VERSION 4.4.1 LANGUAGES C CXX)
+project(FinceptTerminal VERSION 4.5.0 LANGUAGES C CXX)
 
 # Strip C/C++ flags out of RC invocations — rc.exe only understands /D, /I, /fo.
 if(WIN32)
```

**File**: `fincept-qt/packaging/flatpak/in.fincept.FinceptTerminal.metainfo.xml` (modified, +8/-0)
```diff
@@ -71,6 +71,14 @@
   </provides>
 
   <releases>
+    <release version="4.5.0" date="2026-08-31">
+      <description>
+        <p>Fixes AI tool calling with Google Gemini. Around 150 tools take a free-form options object, which Gemini's schema cannot express; those tools were being advertised to Gemini as taking no arguments at all, so the assistant could call them but never pass them anything. They now work on Gemini as they already did on other providers.</p>
+        <p>The assistant runs a turn's independent tool calls at the same time instead of one after another, so a request that needs several lookups returns sooner. Tools that change something still run in order, on their own.</p>
+        <p>Long-running work — backtests, quant modules, agent runs — hands back a job you can watch instead of freezing the conversation for minutes; this now covers around 190 tools rather than a dozen. Job status reports elapsed time against the tool's own budget along with the tool's latest output, and cancelling a job returns control immediately.</p>
+        <p>Tool sequences now have a time limit as well as a step limit, and say which one ran out instead of stopping without explanation. Also fixes the AstraFlow and AstraFlow CN providers failing to find their endpoint when the base URL field was cleared.</p>
+      </description>
+    </release>
     <release version="4.4.1" date="2026-08-19">
       <description>
         <p>Adds the TickerAll (MetaTrader 5) broker integration, so MT5 accounts can be linked, funded and traded from the equity trading screen alongside the existing brokers.</p>
```

**File**: `fincept-qt/packaging/flatpak/in.fincept.FinceptTerminal.yml` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ modules:
       # Main repository
       - type: git
         url: https://github.com/Fincept-Corporation/FinceptTerminal.git
-        tag: v4.4.1
+        tag: v4.5.0
       # Vendored FetchContent dependencies (no network during build)
       - type: git
         url: https://github.com/QtExcel/QXlsx.git
```

**File**: `fincept-qt/packaging/installer/packages/com.fincept.terminal.core/meta/license.txt` (modified, +1/-1)
```diff
@@ -226,5 +226,5 @@ Status:           Current. Remains in force until expressly superseded by a
                   subsequent version published by Fincept Corporation. The
                   date above marks the most recent revision and is NOT an
                   expiry date.
-Software Version: 4.4.1 (licence applies to all releases, branches, tags,
+Software Version: 4.5.0 (licence applies to all releases, branches, tags,
                   and commits of the open-source edition)
```

---

### Incident Patch 3: `5f35156a` (2026-08-31)
**Commit Message**: Merge pull request #379 from mstru54/fix/macos-intel-openssl-prefix

fix(setup): resolve openssl@3 prefix via brew so setup.sh works on Intel Macs

**File**: `setup.sh` (modified, +7/-2)
```diff
@@ -208,8 +208,13 @@ echo "[6/7] Configuring (preset: $PRESET)..."
 # Override the preset's default CMAKE_PREFIX_PATH with the one we just set,
 # so the build picks up the aqtinstall location rather than ~/Qt/6.8.3/...
 EXTRA_ARGS=""
-if [ "$PLATFORM" = "macos" ] && [ -d "/opt/homebrew/opt/openssl@3" ]; then
-    EXTRA_ARGS="-DOPENSSL_ROOT_DIR=/opt/homebrew/opt/openssl@3"
+if [ "$PLATFORM" = "macos" ]; then
+    # Resolve the openssl@3 prefix from brew itself rather than hardcoding the
+    # Apple Silicon path — Intel Macs use /usr/local, not /opt/homebrew.
+    OPENSSL_PREFIX="$(brew --prefix openssl@3 2>/dev/null || true)"
+    if [ -n "$OPENSSL_PREFIX" ] && [ -d "$OPENSSL_PREFIX" ]; then
+        EXTRA_ARGS="-DOPENSSL_ROOT_DIR=$OPENSSL_PREFIX"
+    fi
 fi
 
 cmake --preset "$PRESET" -DCMAKE_PREFIX_PATH="$QT_PREFIX" $EXTRA_ARGS \
```

---

### Incident Patch 4: `433c0d94` (2026-08-31)
**Commit Message**: Merge pull request #374 from ivanoviczeljko/fix-broken-star-history

Fixed broken star history in README docs

**File**: `README.md` (modified, +4/-4)
```diff
@@ -162,11 +162,11 @@ Questions: [support@fincept.in](mailto:support@fincept.in) · [Terms](https://fi
 ### **Your Thinking is the Only Limit. The Data Isn't.**
 
 <div align="center">
-<a href="https://star-history.com/#Fincept-Corporation/FinceptTerminal&Date">
+<a href="https://star-history.dera.page/#Fincept-Corporation/FinceptTerminal&Date">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date&theme=dark" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date" />
-   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date&theme=dark" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date" />
  </picture>
 </a>
 </div>
```

---

### Incident Patch 5: `e009a48e` (2026-08-30)
**Commit Message**: fix(setup): resolve openssl@3 prefix via brew instead of hardcoding Apple Silicon path

The macOS configure step only set OPENSSL_ROOT_DIR when
/opt/homebrew/opt/openssl@3 existed. That path is Apple Silicon only —
Intel Macs install Homebrew under /usr/local, so on those machines
EXTRA_ARGS stayed empty and the build was configured without an OpenSSL
root.

Two consequences on Intel:

1. find_package(OpenSSL REQUIRED) in fincept-qt/CMakeLists.txt has no
   root to search. macOS ships no OpenSSL development headers, so
   configure fails.

2. More subtly, the `if(APPLE AND OPENSSL_ROOT_DIR)` block that symlinks
   libssl/libcrypto into Qt's lib dir is skipped. Per the comment there,
   that makes Qt's openssl TLS plugin fail to register and fall back to
   the deprecated SecureTransport backend, which double-frees in SSLWrite
   during QWebSocket close and crashes the crypto tab.

Ask brew for the prefix instead, which is correct on both architectures
and also honours a non-standard HOMEBREW_PREFIX. Falls back to leaving
EXTRA_ARGS empty when openssl@3 is not installed, so behaviour is
unchanged where the formula is absent.

Verified on macOS 15.7.9 / Intel x86_64, Apple Clang 17, 

**File**: `setup.sh` (modified, +7/-2)
```diff
@@ -208,8 +208,13 @@ echo "[6/7] Configuring (preset: $PRESET)..."
 # Override the preset's default CMAKE_PREFIX_PATH with the one we just set,
 # so the build picks up the aqtinstall location rather than ~/Qt/6.8.3/...
 EXTRA_ARGS=""
-if [ "$PLATFORM" = "macos" ] && [ -d "/opt/homebrew/opt/openssl@3" ]; then
-    EXTRA_ARGS="-DOPENSSL_ROOT_DIR=/opt/homebrew/opt/openssl@3"
+if [ "$PLATFORM" = "macos" ]; then
+    # Resolve the openssl@3 prefix from brew itself rather than hardcoding the
+    # Apple Silicon path — Intel Macs use /usr/local, not /opt/homebrew.
+    OPENSSL_PREFIX="$(brew --prefix openssl@3 2>/dev/null || true)"
+    if [ -n "$OPENSSL_PREFIX" ] && [ -d "$OPENSSL_PREFIX" ]; then
+        EXTRA_ARGS="-DOPENSSL_ROOT_DIR=$OPENSSL_PREFIX"
+    fi
 fi
 
 cmake --preset "$PRESET" -DCMAKE_PREFIX_PATH="$QT_PREFIX" $EXTRA_ARGS \
```

---

### Incident Patch 6: `925c293a` (2026-08-21)
**Commit Message**: Fixed broken star history in README doc

**File**: `README.md` (modified, +4/-4)
```diff
@@ -162,11 +162,11 @@ Questions: [support@fincept.in](mailto:support@fincept.in) · [Terms](https://fi
 ### **Your Thinking is the Only Limit. The Data Isn't.**
 
 <div align="center">
-<a href="https://star-history.com/#Fincept-Corporation/FinceptTerminal&Date">
+<a href="https://star-history.dera.page/#Fincept-Corporation/FinceptTerminal&Date">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date&theme=dark" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date" />
-   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date&theme=dark" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=Fincept-Corporation/FinceptTerminal&type=Date" />
  </picture>
 </a>
 </div>
```

---

### Incident Patch 7: `25d41a7b` (2026-08-17)
**Commit Message**: mt5 broker fixed

**File**: `fincept-qt/CMakeLists.txt` (modified, +2/-0)
```diff
@@ -1212,6 +1212,7 @@ set(TRADING_SOURCES
     src/trading/brokers/tradier/TradierBroker.cpp
     src/trading/brokers/saxo/SaxoBankBroker.cpp
     src/trading/brokers/metaapi/MetaApiBroker.cpp
+    src/trading/brokers/tickerall/TickerAllBroker.cpp
 
     # Instrument system (Phase 1)
     src/trading/instruments/InstrumentNormalize.cpp
@@ -2606,6 +2607,7 @@ set_source_files_properties(
     src/trading/brokers/tradier/TradierBroker.cpp
     src/trading/brokers/saxo/SaxoBankBroker.cpp
     src/trading/brokers/metaapi/MetaApiBroker.cpp
+    src/trading/brokers/tickerall/TickerAllBroker.cpp
     PROPERTIES SKIP_UNITY_BUILD_INCLUSION TRUE
 )
 
```

**File**: `fincept-qt/scripts/Analytics/backtesting/base/fincept_strategy_runner.py` (modified, +5/-10)
```diff
@@ -21,6 +21,7 @@
 from fincept_engine import QCAlgorithm, Symbol, TradeBar, Slice
 from fincept_engine.enums import Resolution, SecurityType
 from _registry import STRATEGY_REGISTRY
+from _loader import resolve_strategy_path
 
 
 class FinceptStrategyRunner:
@@ -43,16 +44,10 @@ def load_strategy_class(self, strategy_id: str):
         if not info:
             raise ValueError(f"Strategy {strategy_id} not found in registry")
 
-        # Containment check. `Path / value` silently ESCAPES the root when
-        # `value` is absolute ("C:/x", "/etc/x") or walks up ("../../x"), and
-        # the code below exec()s whatever it reads. Resolve first, then assert
-        # the result is still under strategies_dir.
-        root = self.strategies_dir.resolve()
-        strategy_path = (root / info['path']).resolve()
-        if not strategy_path.is_relative_to(root):
-            raise ValueError(
-                f"Strategy path escapes the strategies directory: {info['path']}"
-            )
+        # Containment check - the code below exec()s whatever it reads, so the
+        # resolved path must stay under strategies_dir. Shared with live_runner.py
+        # via _loader; raises StrategyPathError (a ValueError) if it escapes.
+        strategy_path = resolve_strategy_path(self.strategies_dir, info['path'])
         if not strategy_path.exists():
             raise FileNotFoundError(f"Strategy file not found: {strategy_path}")
 
```

**File**: `fincept-qt/scripts/strategies/_loader.py` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+#!/usr/bin/env python3
+"""
+Fincept Terminal - Shared Strategy Loading Helpers
+
+Two places read a path out of the strategy registry and exec() the file it
+points at:
+
+  - Analytics/backtesting/base/fincept_strategy_runner.py  (backtest)
+  - strategies/live_runner.py                              (paper/live deploy)
+
+They each implemented path resolution independently and drifted apart - one had
+a containment check and the other did not (issue #369). The check lives here now
+so both loaders share one contract and cannot diverge again.
+"""
+
+from pathlib import Path
+from typing import Union
+
+
+class StrategyPathError(ValueError):
+    """A registry path resolved outside the strategies directory.
+
+    Subclasses ValueError so callers with an existing `except ValueError`
+    handler keep catching it.
+    """
+
+
+def resolve_strategy_path(strategies_dir: Union[str, Path], path: Union[str, Path]) -> Path:
+    """Resolve a registry `path` against `strategies_dir`, asserting containment.
+
+    `Path / value` (and `os.path.join`) silently ESCAPE the root when `value` is
+    absolute ("C:/x", "/etc/x") or walks up ("../../x"), and both callers exec()
+    whatever they read. Resolve first, then assert the result is still under the
+    root. `.resolve()` follows symlinks, so a link pointing out of the tree is
+    rejected too.
+
+    Returns the resolved absolute path. Existence is deliberately NOT checked -
+    the two callers report a missing file in different ways.
+
+    Raises StrategyPathError if the path escapes the strategies directory.
+    """
+    root = Path(strategies_dir).resolve()
+    resolved = (root / Path(path)).resolve()
+    if not resolved.is_relative_to(root):
+        raise StrategyPathError(
+            f"Strategy path escapes the strategies directory: {path}"
+        )
+    return resolved
```

**File**: `fincept-qt/scripts/strategies/live_runner.py` (modified, +20/-3)
```diff
@@ -24,6 +24,14 @@
 import signal
 from datetime import datetime, timezone
 
+# _loader lives next to this file; guarantee it is importable whether we are run
+# as a script (sys.path[0] is already this dir) or imported from elsewhere.
+_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
+if _SCRIPT_DIR not in sys.path:
+    sys.path.insert(0, _SCRIPT_DIR)
+
+from _loader import resolve_strategy_path, StrategyPathError
+
 # ============================================================================
 # SQLite Schema & DB Helpers
 # ============================================================================
@@ -143,8 +151,17 @@ def cmd_deploy(deploy_id: str, strategy_id: str, params_json: str, db_path: str,
             conn.close()
             return
 
-        full_path = os.path.join(strategies_dir, strategy_path)
-        if not os.path.exists(full_path):
+        # Containment check - the exec() below runs whatever this path points at,
+        # and the registry value may be absolute or contain "..". Shared with
+        # fincept_strategy_runner.py via _loader so the two cannot diverge.
+        try:
+            full_path = resolve_strategy_path(strategies_dir, strategy_path)
+        except StrategyPathError as e:
+            _update_status(conn, deploy_id, "error", str(e))
+            conn.close()
+            return
+
+        if not full_path.exists():
             _update_status(conn, deploy_id, "error", f"Strategy file not found: {strategy_path}")
             conn.close()
             return
@@ -154,7 +171,7 @@ def cmd_deploy(deploy_id: str, strategy_id: str, params_json: str, db_path: str,
             source = f.read()
 
         module_globals = {}
-        exec(compile(source, full_path, "exec"), module_globals)
+        exec(compile(source, str(full_path), "exec"), module_globals)
 
         # Find the QCAlgorithm subclass
         algo_class = None
```

**File**: `fincept-qt/src/screens/equity_trading/AccountManagementDialog.cpp` (modified, +41/-0)
```diff
@@ -141,6 +141,15 @@ static QVector<CredSubField> custom_cred_fields(const QString& broker_id) {
                 {"password", QObject::tr("PASSWORD"), true},
                 {"dob", QObject::tr("DATE OF BIRTH (DD/MM/YYYY)"), false},
                 {"totp", QObject::tr("TOTP (current 6-digit code, if enabled)"), true}};
+    // MT5 via the TickerAll hosted bridge. Not a delimiter-packing broker: it
+    // needs the MT5 SERVER name, which has no CredentialField of its own, so the
+    // plain profile form cannot render it. MT4 solved the same problem with a
+    // whole dedicated page (build_mt4_form); four labelled boxes do it here.
+    if (broker_id == QLatin1String("metatrader5"))
+        return {{"api_key", QObject::tr("TICKERALL API KEY"), true},
+                {"server", QObject::tr("MT5 SERVER (e.g. Exness-MT5Trial7)"), false},
+                {"login", QObject::tr("MT5 LOGIN"), false},
+                {"password", QObject::tr("MT5 PASSWORD"), true}};
     return {};
 }
 
@@ -173,6 +182,17 @@ static ExchangeArgs pack_custom_credentials(const QString& broker_id, const QMap
         a.api_key = v.value("userid");
         a.api_secret = v.value("password");
         a.auth_code = v.value("dob") + S + v.value("totp");
+    } else if (broker_id == QLatin1String("metatrader5")) {
+        // TickerAllBroker::exchange_token() parses auth_code as JSON
+        // {"login","password","server"} — same contract as MetaApiBroker's MT4
+        // flow, so the MT5 password never touches api_key/api_secret.
+        a.api_key = v.value("api_key");
+        a.auth_code = QString::fromUtf8(QJsonDocument(QJsonObject{
+                                                          {"login", v.value("login")},
+                                                          {"password", v.value("password")},
+                                                          {"server", v.value("server")},
+                                                      })
+                                            .toJson(QJsonDocument::Compact));
     }
     return a;
 }
@@ -682,6 +702,27 @@ void AccountManagementDialog::load_saved_credentials(const QString& account_id)
         return;
     }
 
+    // MT5 (TickerAll) uses the custom-sub-field form but, unlike the delimiter
+    // brokers below, its parts are stored unpacked and are NOT daily-expiring: the
+    // API key, server and login all round-trip cleanly. Repopulate them by key
+    // (not by index, so field order stays free to change) and leave only the
+    // password blank — it is never persisted, and once the session exists it is
+    // not needed again.
+    if (creds.broker_id == QStringLiteral("metatrader5") && !cred_form_keys_.isEmpty()) {
+        const auto extra = QJsonDocument::fromJson(creds.additional_data.toUtf8()).object();
+        const QMap<QString, QString> values = {
+            {QStringLiteral("api_key"), creds.api_key},
+            {QStringLiteral("server"), extra.value("server").toString()},
+            {QStringLiteral("login"), creds.user_id},
+        };
+        for (int i = 0; i < cred_form_keys_.size() && i < cred_fields_.size(); ++i) {
+            const auto it = values.constFind(cred_form_keys_[i]);
+            if (it != values.constEnd())
+                cred_fields_[i]->setText(*it);
+        }
+        return;
+    }
+
     // Custom multi-sub-field forms (delimiter brokers) can't be cleanly unpacked
     // back into individual boxes — and they're daily-expiring TOTP logins anyway —
     // so leave them blank for re-entry rather than mis-populate from packed creds.
```

---

### Incident Patch 8: `9b860f35` (2026-07-25)
**Commit Message**: general updates and bug fixes

**File**: `.github/workflows/build-cpp.yml` (modified, +49/-0)
```diff
@@ -800,12 +800,61 @@ jobs:
           export OUTPUT="FinceptTerminal-Linux-x86_64.AppImage"
           export UPDATE_INFORMATION="gh-releases-zsync|Fincept-Corporation|FinceptTerminal|latest|FinceptTerminal-Linux-x86_64.AppImage.zsync"
 
+          # ── OpenSSL must be bundled as a MATCHED PAIR (#352) ───────────────
+          # The app only calls libcrypto APIs, so ld's --as-needed drops
+          # libssl.so.3 from DT_NEEDED and linuxdeploy (which walks DT_NEEDED)
+          # bundled libcrypto.so.3 alone. Qt then dlopen()s the HOST libssl.so.3,
+          # which needs OPENSSL_3.3.0 from the stale bundled libcrypto 3.0.2:
+          #   qt.tlsbackend.ossl: Failed to load libssl/libcrypto  → all HTTPS dies.
+          # Keep this in sync with the same block in release.yml.
+          resolve_soname() {
+            local soname="$1" path
+            path=$(ldconfig -p | awk -v s="${soname}" '$1 == s && /x86-64/ { print $NF; exit }')
+            if [ -z "${path}" ] || [ "$(basename "${path}")" != "${soname}" ]; then
+              path="/usr/lib/x86_64-linux-gnu/${soname}"
+            fi
+            if [ ! -e "${path}" ]; then
+              echo "::error::${soname} not found on the runner — cannot bundle a consistent OpenSSL pair (#352)" >&2
+              exit 1
+            fi
+            printf '%s' "${path}"
+          }
+          OPENSSL_ARGS=()
+          for _so in libssl.so.3 libcrypto.so.3; do
+            _path=$(resolve_soname "${_so}")
+            echo "Bundling OpenSSL library: ${_path}"
+            OPENSSL_ARGS+=(--library "${_path}")
+          done
+
           ./linuxdeploy-x86_64.AppImage \
             --appdir AppDir \
             --plugin qt \
             --output appimage \
+            "${OPENSSL_ARGS[@]}" \
             2>&1 || true
 
+          # ── Guard: never ship a half-bundled OpenSSL again (#352) ──────────
+          SSL_BUNDLED=$(find AppDir -name 'libssl.so.3' -print -quit)
+          CRYPTO_BUNDLED=$(find AppDir -name 'libcrypto.so.3' -print -quit)
+          if [ -z "${SSL_BUNDLED}" ] || [ -z "${CRYPTO_BUNDLED}" ]; then
+            echo "::error::AppImage must bundle libssl.so.3 AND libcrypto.so.3 (ssl='${SSL_BUNDLED}' crypto='${CRYPTO_BUNDLED}') — a bundled libcrypto next to the host libssl breaks all TLS (#352)"
+            exit 1
+          fi
+          if LD_LIBRARY_PATH="$(dirname "${SSL_BUNDLED}")" ldd "${SSL_BUNDLED}" \
+               | grep -q 'libcrypto\.so\.3 => not found'; then
+            echo "::error::Bundled libssl.so.3 cannot resolve the bundled libcrypto.so.3"
+            LD_LIBRARY_PATH="$(dirname "${SSL_BUNDLED}")" ldd "${SSL_BUNDLED}" || true
+            exit 1
+          fi
+          echo "OpenSSL pair OK: ${SSL_BUNDLED} + ${CRYPTO_BUNDLED}"
+
+          TLS_PLUGIN=$(find AppDir -name 'libqopensslbackend.so' -print -quit)
+          if [ -z "${TLS_PLUGIN}" ]; then
+            echo "::error::Qt TLS backend plugin (libqopensslbackend.so) missing from AppDir — HTTPS would fail at runtime"
+            exit 1
+          fi
+          echo "Qt TLS plugin OK: ${TLS_PLUGIN}"
+
           # Verify AppImage was created
           if [ ! -f "$OUTPUT" ]; then
             # Fallback: find any AppImage produced
```

**File**: `.github/workflows/release.yml` (modified, +79/-1)
```diff
@@ -847,14 +847,71 @@ jobs:
           export OUTPUT="FinceptTerminal-${VERSION}-linux-x64-setup.run"
           export UPDATE_INFORMATION="gh-releases-zsync|Fincept-Corporation|FinceptTerminal|latest|FinceptTerminal-*-linux-x64-setup.run.zsync"
 
+          # ── OpenSSL must be bundled as a MATCHED PAIR (#352) ───────────────
+          # The app only calls libcrypto APIs (storage/secure/SecureStorage.cpp,
+          # trading/exchanges/hyperliquid/HyperliquidSigner.cpp), so ld's default
+          # --as-needed drops libssl.so.3 from DT_NEEDED even though CMake links
+          # OpenSSL::SSL. linuxdeploy walks DT_NEEDED, so it bundled libcrypto.so.3
+          # ALONE. Qt's TLS backend dlopen()s libssl.so.3 at runtime and picks the
+          # HOST copy (3.3+ on Arch/NixOS/Fedora), which needs OPENSSL_3.3.0 from
+          # libcrypto but finds our stale bundled 3.0.2 first on LD_LIBRARY_PATH:
+          #   qt.tlsbackend.ossl: Failed to load libssl/libcrypto
+          # → every HTTPS request fails and the setup wizard says "no network".
+          # Force-deploy both so the bundled pair is internally consistent.
+          resolve_soname() {
+            local soname="$1" path
+            path=$(ldconfig -p | awk -v s="${soname}" '$1 == s && /x86-64/ { print $NF; exit }')
+            # ldconfig prints the SONAME-named file; fall back to the multiarch
+            # path if the cache is stale or the name doesn't match exactly.
+            if [ -z "${path}" ] || [ "$(basename "${path}")" != "${soname}" ]; then
+              path="/usr/lib/x86_64-linux-gnu/${soname}"
+            fi
+            if [ ! -e "${path}" ]; then
+              echo "::error::${soname} not found on the runner — cannot bundle a consistent OpenSSL pair (#352)" >&2
+              exit 1
+            fi
+            printf '%s' "${path}"
+          }
+          OPENSSL_ARGS=()
+          for _so in libssl.so.3 libcrypto.so.3; do
+            _path=$(resolve_soname "${_so}")
+            echo "Bundling OpenSSL library: ${_path}"
+            OPENSSL_ARGS+=(--library "${_path}")
+          done
+
           ./linuxdeploy-x86_64.AppImage \
             --appdir "${APPDIR}" \
             --plugin qt \
             --output appimage \
+            "${OPENSSL_ARGS[@]}" \
             --desktop-file "${APPDIR}/usr/share/applications/fincept-terminal.desktop" \
             --icon-file "${ICON_DEST}" \
             2>&1
 
+          # ── Guard: never ship a half-bundled OpenSSL again (#352) ──────────
+          SSL_BUNDLED=$(find "${APPDIR}" -name 'libssl.so.3' -print -quit)
+          CRYPTO_BUNDLED=$(find "${APPDIR}" -name 'libcrypto.so.3' -print -quit)
+          if [ -z "${SSL_BUNDLED}" ] || [ -z "${CRYPTO_BUNDLED}" ]; then
+            echo "::error::AppImage must bundle libssl.so.3 AND libcrypto.so.3 (ssl='${SSL_BUNDLED}' crypto='${CRYPTO_BUNDLED}') — a bundled libcrypto next to the host libssl breaks all TLS (#352)"
+            exit 1
+          fi
+          if LD_LIBRARY_PATH="$(dirname "${SSL_BUNDLED}")" ldd "${SSL_BUNDLED}" \
+               | grep -q 'libcrypto\.so\.3 => not found'; then
+            echo "::error::Bundled libssl.so.3 cannot resolve the bundled libcrypto.so.3"
+            LD_LIBRARY_PATH="$(dirname "${SSL_BUNDLED}")" ldd "${SSL_BUNDLED}" || true
+            exit 1
+          fi
+          echo "OpenSSL pair OK: ${SSL_BUNDLED} + ${CRYPTO_BUNDLED}"
+
+          # Qt's TLS backend plugin is dlopen()ed too — if the qt plugin didn't
+          # deploy it, HTTPS fails with the same "no network" symptom.
+          TLS_PLUGIN=$(find "${APPDIR}" -name 'libqopensslbackend.so' -print -quit)
+          if [ -z "${TLS_PLUGIN}" ]; then
+            echo "::error::Qt TLS backend plugin (libqopensslbackend.so) missing from AppDir — HTTPS would fail at runtime"
+            exit 1
+          fi
+          echo "Qt TLS plugin OK: ${TLS_PLUGIN}"
+
           # linuxdeploy names the output after the desktop entry — find it.
           if [
```

**File**: `README.md` (modified, +3/-1)
```diff
@@ -74,7 +74,9 @@ Latest release: **v4.2.0** — [View all releases](https://github.com/Fincept-Co
 | Platform | Download | Run |
 |----------|----------|-----|
 | **Windows x64** | [FinceptTerminal-Windows-x64-setup.exe](https://github.com/Fincept-Corporation/FinceptTerminal/releases/download/v4.2.0/FinceptTerminal-4.2.0-windows-x64-setup.exe) | Run installer → launch `FinceptTerminal.exe` |
-| **Linux x64** | [FinceptTerminal-Linux-x64.run](https://github.com/Fincept-Corporation/FinceptTerminal/releases/download/v4.2.0/FinceptTerminal-4.2.0-linux-x64-setup.run) | `chmod +x` → run installer |
+| **Linux x64 (AppImage)** | [FinceptTerminal-Linux-x64.run](https://github.com/Fincept-Corporation/FinceptTerminal/releases/download/v4.2.0/FinceptTerminal-4.2.0-linux-x64-setup.run) | `chmod +x` → run installer |
+| **Linux x64 (Debian/Ubuntu)** | [FinceptTerminal-Linux-x64.deb](https://github.com/Fincept-Corporation/FinceptTerminal/releases/download/v4.2.0/FinceptTerminal-4.2.0-linux-x64.deb) | `sudo apt install ./FinceptTerminal-4.2.0-linux-x64.deb` |
+| **Linux x64 (Fedora/RHEL)** | [FinceptTerminal-Linux-x64.rpm](https://github.com/Fincept-Corporation/FinceptTerminal/releases/download/v4.2.0/FinceptTerminal-4.2.0-linux-x64.rpm) | `sudo dnf install ./FinceptTerminal-4.2.0-linux-x64.rpm` |
 | **macOS Apple Silicon** | [FinceptTerminal-macOS-arm64.dmg](https://github.com/Fincept-Corporation/FinceptTerminal/releases/download/v4.2.0/FinceptTerminal-4.2.0-macos-arm64-setup.dmg) | Open DMG → drag to Applications |
 <!-- DOWNLOAD-TABLE-END -->
 
```

**File**: `fincept-qt/CMakeLists.txt` (modified, +1/-0)
```diff
@@ -1479,6 +1479,7 @@ set(UI_SOURCES
     src/ui/charts/SeriesLayer.cpp
     src/ui/charts/HorizontalLineLayer.cpp
     src/ui/charts/ChartOverlayManager.cpp
+    src/ui/charts/TimeAxisNavigator.cpp
     src/ui/charts/IndicatorPicker.cpp
     src/ui/charts/IndicatorParamDialog.cpp
     src/ui/charts/layers/EmaLayer.cpp
```

**File**: `fincept-qt/src/screens/crypto_trading/CryptoChart.cpp` (modified, +135/-15)
```diff
@@ -18,7 +18,8 @@
 //  • Time-axis label format auto-scales with the timeframe
 //    (HH:mm · MMM dd HH:mm · MMM dd · MMM yy)
 //  • Generous bottom margin so the time-axis labels stop being clipped
-//  • Mouse wheel = zoom price axis; drag = pan
+//  • Mouse wheel = zoom time (Ctrl+wheel = price), left-drag = pan,
+//    double-click = back to auto-follow (see TimeAxisNavigator)
 //
 // Sizing principles:
 //  • No pixel-pinned heights on the header buttons — uses QSS padding so
@@ -117,6 +118,19 @@ QFont scene_font() {
     return f;
 }
 
+// Pixel clamps for the candle body. Qt derives the body width from the candle
+// time period in DOMAIN units (qtcharts candlestick.cpp: `columnWidth =
+// m_timePeriod`), so a chart holding only a handful of candles stretches every
+// body across the plot — the giant blocks in issue #338. The maximum keeps a
+// 3-candle chart looking like candles; the minimum stops a 120-candle chart
+// from collapsing into hairlines.
+constexpr qreal kMaxCandlePx = 18.0;
+constexpr qreal kMinCandlePx = 2.0;
+
+// One wheel notch.
+constexpr double kZoomInFactor = 0.85;
+constexpr double kZoomOutFactor = 1.0 / kZoomInFactor;
+
 } // namespace
 
 // ── HoverChartView ──────────────────────────────────────────────────────────
@@ -136,35 +150,72 @@ class HoverChartView : public QChartView {
 
   protected:
     void mouseMoveEvent(QMouseEvent* e) override {
-        if (host_ && chart()) {
+        if (dragging_ && host_) {
+            const int dx = e->pos().x() - drag_pos_.x();
+            drag_pos_ = e->pos();
+            host_->pan_time_pixels(dx);
+        } else if (host_ && chart()) {
             const QPointF chart_pos = chart()->mapToValue(e->pos());
             host_->on_hover_position(chart_pos, e->pos());
         }
         QChartView::mouseMoveEvent(e);
     }
+    void mousePressEvent(QMouseEvent* e) override {
+        if (e->button() == Qt::LeftButton) {
+            dragging_ = true;
+            drag_pos_ = e->pos();
+            setCursor(Qt::ClosedHandCursor);
+            if (host_)
+                host_->on_hover_leave(); // crosshair off while dragging
+        }
+        QChartView::mousePressEvent(e);
+    }
+    void mouseReleaseEvent(QMouseEvent* e) override {
+        if (e->button() == Qt::LeftButton && dragging_) {
+            dragging_ = false;
+            unsetCursor();
+        }
+        QChartView::mouseReleaseEvent(e);
+    }
+    void mouseDoubleClickEvent(QMouseEvent* e) override {
+        // Back to auto-follow — the live candle stream drives the axis again.
+        if (host_)
+            host_->reset_view();
+        e->accept();
+    }
     void leaveEvent(QEvent* e) override {
         if (host_)
             host_->on_hover_leave();
         QChartView::leaveEvent(e);
     }
     void wheelEvent(QWheelEvent* e) override {
-        if (!chart()) {
+        if (!chart() || !host_) {
             QChartView::wheelEvent(e);
             return;
         }
-        // Zoom price axis only. Wheel-panning the time axis collides with the
-        // candle stream — users expect Time fixed and Price scaled.
-        const double factor = (e->angleDelta().y() > 0) ? 0.9 : 1.1;
-        if (auto* y = qobject_cast<QValueAxis*>(host_ ? host_->price_axis_ : nullptr)) {
-            const double mid = (y->min() + y->max()) / 2.0;
-            const double span = (y->max() - y->min()) * factor;
-            y->setRange(mid - span / 2.0, mid + span / 2.0);
+        const bool zoom_in = e->angleDelta().y() > 0;
+        const double factor = zoom_in ? kZoomInFactor : kZoomOutFactor;
+
+        // Ctrl+wheel keeps the old behaviour (scale the price axis); a plain
+        // wheel now zooms time, which is what the candle chart needs to be
+        // scrollable at all (#338).
+        if (e->modifiers().testFlag(Qt::ControlModifier)) {
+            if (auto* y = host_->price_axis_) {
+                const double mid = (y->min() + y->max()) / 2.0;
+                co
```

---

### Incident Patch 9: `d2af7396` (2026-07-25)
**Commit Message**: Merge pull request #357 from texas0418/fix/macos-zlib-prefix

Fix macOS/Linux link failure: only define Z_PREFIX on Windows

**File**: `fincept-qt/src/trading/instruments/InstrumentDecompress.cpp` (modified, +3/-1)
```diff
@@ -10,7 +10,9 @@
 // shadows it on the include path (e.g. a PostgreSQL install whose include dir
 // precedes QtZlib), the unprefixed symbols won't link. Define it ourselves so
 // inflate() → z_inflate() regardless of which standard zlib.h is picked up.
-#ifndef Z_PREFIX
+// On macOS/Linux we link the system zlib (ZLIB::ZLIB in CMakeLists.txt),
+// whose symbols are unprefixed — so only define Z_PREFIX on Windows.
+#if defined(_WIN32) && !defined(Z_PREFIX)
 #    define Z_PREFIX
 #endif
 #include <zlib.h>
```

---

### Incident Patch 10: `41ee551e` (2026-07-25)
**Commit Message**: Merge pull request #360 from akmalsyrf/fix/register-username-field-318

fix(auth): add username field to RegisterScreen (#318)

**File**: `fincept-qt/src/screens/auth/RegisterScreen.cpp` (modified, +25/-13)
```diff
@@ -135,8 +135,8 @@ RegisterScreen::RegisterScreen(QWidget* parent) : QWidget(parent) {
     });
     connect(&auth, &auth::AuthManager::otp_verified, this, [this]() {
         verify_btn_->setEnabled(true);
-        for (QLineEdit* w :
-             {first_name_, last_name_, email_, phone_, country_code_, password_, confirm_pw_, otp_input_}) {
+        for (QLineEdit* w : {first_name_, last_name_, username_, email_, phone_, country_code_, password_,
+                             confirm_pw_, otp_input_}) {
             if (w)
                 w->clear();
         }
@@ -249,6 +249,10 @@ void RegisterScreen::build_form_page() {
     nrl->addLayout(ln_col);
     vl->addWidget(name_row);
 
+    // Username is required by POST /user/register; do not invent it from the
+    // name fields (that hid the control and caused silent collisions — #318).
+    add_field(username_lbl_, username_, vl);
+
     add_field(email_lbl_, email_, vl);
 
     // Phone + country code side by side
@@ -436,6 +440,8 @@ void RegisterScreen::retranslateUi() {
         first_name_lbl_->setText(tr("FIRST NAME"));
     if (last_name_lbl_)
         last_name_lbl_->setText(tr("LAST NAME"));
+    if (username_lbl_)
+        username_lbl_->setText(tr("USERNAME"));
     if (email_lbl_)
         email_lbl_->setText(tr("EMAIL"));
     if (code_lbl_)
@@ -451,6 +457,8 @@ void RegisterScreen::retranslateUi() {
         first_name_->setPlaceholderText(tr("First"));
     if (last_name_)
         last_name_->setPlaceholderText(tr("Last"));
+    if (username_)
+        username_->setPlaceholderText(tr("3-50 chars, letters/numbers/_"));
     if (email_)
         email_->setPlaceholderText(tr("user@domain.com"));
     if (country_code_)
@@ -501,17 +509,30 @@ void RegisterScreen::on_register() {
 
     QString fn = first_name_->text().trimmed();
     QString ln = last_name_->text().trimmed();
+    QString username = auth::sanitize_input(username_->text()).toLower();
     QString em = email_->text().trimmed();
     QString ph = phone_->text().trimmed();
     QString cc = country_code_->text().trimmed();
     QString pw = password_->text();
     QString cpw = confirm_pw_->text();
 
-    if (fn.isEmpty() || ln.isEmpty() || em.isEmpty() || ph.isEmpty() || pw.isEmpty() || cpw.isEmpty()) {
+    if (fn.isEmpty() || ln.isEmpty() || username.isEmpty() || em.isEmpty() || ph.isEmpty() || pw.isEmpty() ||
+        cpw.isEmpty()) {
         error_label_->setText(tr("All fields are required"));
         error_label_->show();
         return;
     }
+    if (username.length() < 3 || username.length() > 50) {
+        error_label_->setText(tr("Username must be 3-50 characters"));
+        error_label_->show();
+        return;
+    }
+    // Keep usernames URL/API-safe; spaces from names were a common failure mode.
+    if (!QRegularExpression(QStringLiteral("^[a-z0-9_]+$")).match(username).hasMatch()) {
+        error_label_->setText(tr("Username may only contain letters, numbers, and underscores"));
+        error_label_->show();
+        return;
+    }
     if (cc.isEmpty()) {
         error_label_->setText(tr("Country code is required (e.g. +1, +91)"));
         error_label_->show();
@@ -539,13 +560,6 @@ void RegisterScreen::on_register() {
         return;
     }
 
-    QString username = auth::sanitize_input(fn + ln).toLower();
-    if (username.length() < 3 || username.length() > 50) {
-        error_label_->setText(tr("Username must be 3-50 characters"));
-        error_label_->show();
-        return;
-    }
-
     register_btn_->setEnabled(false);
     register_btn_->setText(tr("  CREATING...  "));
     auth::AuthManager::instance().signup(username, em, pw, ph, {}, cc);
@@ -565,9 +579,7 @@ void RegisterScreen::on_verify_otp() {
 }
 
 void RegisterScreen::on_resend_otp() {
-    QString fn = first_name_->text().trimmed();
-    QString ln = last_name_->text().trimmed();
-    QString username = auth::sanitize_input(fn + ln).toLower();
+    QString username = auth::sanitize_input(usernam
```

**File**: `fincept-qt/src/screens/auth/RegisterScreen.h` (modified, +2/-0)
```diff
@@ -32,6 +32,7 @@ class RegisterScreen : public QWidget {
     QLabel* form_title_ = nullptr;
     QLabel* first_name_lbl_ = nullptr;
     QLabel* last_name_lbl_ = nullptr;
+    QLabel* username_lbl_ = nullptr;
     QLabel* email_lbl_ = nullptr;
     QLabel* code_lbl_ = nullptr;
     QLabel* phone_lbl_ = nullptr;
@@ -40,6 +41,7 @@ class RegisterScreen : public QWidget {
 
     QLineEdit* first_name_ = nullptr;
     QLineEdit* last_name_ = nullptr;
+    QLineEdit* username_ = nullptr;
     QLineEdit* email_ = nullptr;
     QLineEdit* phone_ = nullptr;
     QLineEdit* country_code_ = nullptr;
```

#### Recent Merged Pull Requests:
- **PR #396** (closed): fix(algo): seed sma_series/ema_series past a NaN prefix (@LudwigJMarx)
- **PR #394** (closed): Integration proposal from AI/ML API (@hugoaimlapi)
- **PR #391** (closed): fix: validate locale tag and guard TS parsing against XXE (CWE-22/611) (@fstark96)
- **PR #390** (closed): Bypass login/PIN gate so the app launches straight into the dashboard (@sbOogway)
- **PR #379** (2026-08-31): fix(setup): resolve openssl@3 prefix via brew so setup.sh works on Intel Macs (@mstru54)
- **PR #377** (closed): Remove user auth (@xiaohunsdt)
- **PR #374** (2026-08-31): Fixed broken star history in README docs (@ivanoviczeljko)
- **PR #372** (closed): fix(dashboard): ticker tape renders point change as a percentage (@bcho12)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
