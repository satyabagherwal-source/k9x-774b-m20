# Forensic Learning Record (Deep Inspection): Fincept-Corporation/FinceptTerminal

> **Canonical Artifact**: `07_PROJECT_LEARNING/fincept-corporation-finceptterminal-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Fincept-Corporation/FinceptTerminal](https://github.com/Fincept-Corporation/FinceptTerminal))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:10:31.953Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Fincept-Corporation/FinceptTerminal`
- **Description**: FinceptTerminal is a modern finance application offering advanced market analytics, investment research, and economic data tools, designed for interactive exploration and data-driven decision-making in a user-friendly environment.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 32210 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `fincept-qt/scripts/Analytics/alternateInvestment/real_estate.py`
```
"""real_estate Module"""

import numpy as np
import pandas as pd
from decimal import Decimal, getcontext
from typing import List, Dict, Optional, Any, Tuple
from datetime import datetime, timedelta
import logging

from config import (
    MarketData, CashFlow, Performance, AssetParameters, AssetClass,
    Constants, Config, RealEstateType
)
from base_analytics import AlternativeInvestmentBase, FinancialMath

logger = logging.getLogger(__name__)


class RealEstateAnalyzer(AlternativeInvestmentBase):
    """
    Real Estate investment analysis and valuation
    CFA Standards: DCF, Direct Capitalization, Sales Comparison approaches
    """

    def __init__(self, parameters: AssetParameters):
        super().__init__(parameters)
        self.property_type = getattr(parameters, 'property_type', RealEstateType.OFFICE)
        self.acquisition_price = getattr(parameters, 'acquisition_price', None)
        self.current_market_value = getattr(parameters, 'current_market_value', None)
        self.gross_rental_income = getattr(parameters, 'gross_rental_income', None)
        self.operating_expenses = getattr(parameters, 'operating_expenses', None)
        self.vacancy_rate = getattr(parameters, 'vacancy_rate', Decimal('0.05'))  # 5% default
        self.cap_rate = getattr(parameters, 'cap_rate', None)

    def calculate_noi(self) -> Decimal:
        """
        Calculate Net Operating Income
        CFA Standard: NOI = Gross Rental Income - Operating Expenses - Vacancy Loss
        """
        if not self.gross_rental_income:
            return Decimal('0')

        effective_gross_income = self.gross_rental_income * (Decimal('1') - self.vacancy_rate)
        operating_expenses = self.operating_expenses or Decimal('0')

        noi = effective_gross_income - operating_expenses
        return max(noi, Decimal('0'))

    def calculate_cap_rate(self, market_value: Decimal = None) -> Optional[Decimal]:
        """
        Calculate Capitalization Rate
        CFA Standard: Cap Rate = NOI / Property Value
        """
        noi = self.calculate_noi()
        value = market_value or self.current_market_value or self.acquisition_price

        if not value or value == 0 or noi <= 0:
            return None

        cap_rate = noi / value

        # Validate cap rate is within reasonable range
        if self.config.RE_CAP_RATE_MIN <= cap_rate <= self.config.RE_CAP_RATE_MAX:
            return cap_rate

        logger.warning(f"Calculated cap rate {cap_rate} outside normal range")
        return cap_rate

    def direct_capitalization_value(self, market_cap_rate: Decimal) -> Decimal:
        """
        Direct Capitalization valuation approach
        CFA Standard: Property Value = NOI / Cap Rate
        """
        noi = self.calculate_noi()

        if market_cap_rate <= 0:
            raise ValueError("Cap rate must be positive")

        return noi / market_cap_rate

    def dcf_valuation(self, projection_years: int = 10,
                      terminal_cap_rate: Decimal = None,
                      discount_rate: Decimal = None) -> Dict[str, Decimal]:
        """
        Discounted Cash Flow valuation
        CFA Standard: DCF approach for income-producing real estate
        """
        if not self.gross_rental_income:
            return {"error": "Gross rental income required for DCF"}

        if discount_rate is None:
            discount_rate = self.config.RISK_FREE_RATE + Decimal('0.04')  # Add 4% risk premium

        if terminal_cap_rate is None:
            terminal_cap_rate = self.calculate_cap_rate() or Decimal('0.06')

        # Project cash flows
        current_noi = self.calculate_noi()
        annual_growth_rate = Decimal('0.03')  # 3% annual growth assumption

        projected_cfs = []
        for year in range(1, projection_years + 1):
            projected_noi = current_noi * ((Decimal('1') + annual_growth_rate) ** year)
            projected_cfs.append(projected_noi)

        # Calculate terminal value
        terminal_noi = projected_cfs[-1] * (Decimal('1') + annual_growth_rate)
        terminal_value = terminal_noi / terminal_cap_rate

        # Discount cash flows to present value
        pv_cash_flows = Decimal('0')
        for year, cf in enumerate(projected_cfs, 1):
            pv = cf / ((Decimal('1') + discount_rate) ** year)
            pv_cash_flows += pv

        # Discount terminal value
        pv_terminal = terminal_value / ((Decimal('1') + discount_rate) ** projection_years)

        total_property_value = pv_cash_flows + pv_terminal

        return {
            "dcf_value": total_property_value,
            "pv_cash_flows": pv_cash_flows,
            "pv_terminal_value": pv_terminal,
            "terminal_value": terminal_value,
            "implied_cap_rate": current_noi / total_property_value if total_property_value > 0 else Decimal('0')
        }

    def calculate_real_estate_ratios(self) -> Dict[str, Decimal]:
        """Calculate key real estate financial ratios"""
        ratios = {}

        # Debt Service Coverage Ratio (if debt information available)
        noi = self.calculate_noi()

        # Operating Expense Ratio
        if self.gross_rental_income and self.operating_expenses:
            effective_gross = self.gross_rental_income * (Decimal('1') - self.vacancy_rate)
            expense_ratio = self.operating_expenses / effective_gross
            ratios['operating_expense_ratio'] = expense_ratio

        # NOI Margin
        if self.gross_rental_income:
            effective_gross = self.gross_rental_income * (Decimal('1') - self.vacancy_rate)
            noi_margin = noi / effective_gross if effective_gross > 0 else Decimal('0')
            ratios['noi_margin'] = noi_margin

        # Occupancy Rate
        occupancy_rate = Decimal('1') - self.vacancy_rate
        ratios['occupancy_rate'] = occupancy_rate

        return ratios

    def calculate_nav(self) -> Decimal:
        """Calculate current NAV based on market value or DCF"""
        if self.current_market_value:
            return self.current_market_value

        # Use DCF valuation as fallback
        dcf_result = self.dcf_valuation()
        if isinstance(dcf_result, dict) and 'dcf_value' in dcf_result:
            return dcf_result['dcf_value']

        return self.acquisition_price or Decimal('0')

    def calculate_key_metrics(self) -> Dict[str, Any]:
        """Calculate key real estate metrics"""
        metrics = {}

        # Basic metrics
        noi = self.calculate_noi()
        metrics['noi'] = float(noi)

        cap_rate = self.calculate_cap_rate()
        if cap_rate:
            metrics['cap_rate'] = float(cap_rate)

        # Ratios
        ratios = self.calculate_real_estate_ratios()
        for key, value in ratios.items():
            metrics[key] = float(value)

        # Valuation metrics
        dcf_result = self.dcf_valuation()
        if isinstance(dcf_result, dict) and 'dcf_value' in dcf_result:
            metrics['dcf_valuation'] = float(dcf_result['dcf_value'])
            metrics['implied_cap_rate'] = float(dcf_result['implied_cap_rate'])

        # Performance metrics
        if self.acquisition_price and self.current_market_value:
            total_return = (self.current_market_value - self.acquisition_price) / self.acquisition_price
            metrics['capital_appreciation'] = float(total_return)

        # Income yield
        if self.current_market_value or self.acquisition_price:
            property_value = self.current_market_value or self.acquisition_price
            income_yield = noi / property_value if property_value > 0 else Decimal('0')
            metrics['income_yield'] = float(income_yield)

        return metrics

    def valuation_summary(self) -> Dict[str, Any]:
        """Comprehensive real estate valuation summary"""
        return {
            "property_overview": {
                "property_type": self.property_type.value,
                "acquisition_price": float(self.acquisition_price) if self.acquisition_price else None,
                "current_market_value": float(self.current_market_value) if self.current_market_value else None,
                "gross_rental_income": float(self.gross_rental_income) if self.gross_rental_income else None,
                "vacancy_rate": float(self.vacancy_rate)
            },
            "financial_metrics": self.calculate_key_metrics(),
            "valuation_approaches": {
                "direct_cap": float(self.direct_capitalization_value(self.cap_rate)) if self.cap_rate else None,
                "dcf": self.dcf_valuation()
            }
        }


class REITAnalyzer(AlternativeInvestmentBase):
    """
    Real Estate Investment Trust (REIT) analysis
    CFA Standards: NAV, FFO, AFFO calculations and valuation
    """

    def __init__(self, parameters: AssetParameters):
        super().__init__(parameters)
        self.shares_outstanding = getattr(parameters, 'shares_outstanding', None)
        self.total_assets = getattr(parameters, 'total_assets', None)
        self.total_debt = getattr(parameters, 'total_debt', None)
        self.property_value = getattr(parameters, 'property_value', None)
        self.net_income = getattr(parameters, 'net_income', None)
        self.depreciation = getattr(parameters, 'depreciation', None)
        self.amortization = getattr(parameters, 'amortization', None)
        self.gains_on_sales = getattr(parameters, 'gains_on_sales', Decimal('0'))
        self.recurring_capex = getattr(parameters, 'recurring_capex', None)
        self.leasing_costs = getattr(parameters, 'leasing_costs', None)

    def calculate_ffo(self) -> Optional[Decimal]:
        """
        Calculate Funds From Operations
        CFA Standard: FFO = Net Income + Depreciation + Amortization - Gains on Sales
        """
        if not all([self.net_income, self.depreciation]):
            return None

        ffo = self.net_income + self.depreciation

        if self.amortization:
            ffo += self.am
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/corporateFinance/startup_valuation/scorecard_method.py`
```
"""Scorecard Valuation Method"""
from typing import Dict, Any
import sys

class ScorecardMethod:
    """Scorecard (or Payne) Method for startup valuation"""

    def __init__(self, region: str = 'US'):
        self.region = region

        self.typical_pre_money_valuations = {
            'US': {'seed': 2_000_000, 'series_a': 5_000_000},
            'Europe': {'seed': 1_500_000, 'series_a': 4_000_000},
            'Asia': {'seed': 1_800_000, 'series_a': 4_500_000}
        }

        self.factor_weights = {
            'management_team': 0.30,
            'size_of_opportunity': 0.25,
            'product_technology': 0.15,
            'competitive_environment': 0.10,
            'marketing_sales_channels': 0.10,
            'need_for_additional_investment': 0.05,
            'other_factors': 0.05
        }

    def get_baseline_valuation(self, stage: str = 'seed') -> float:
        """Get baseline valuation for region and stage"""

        region_valuations = self.typical_pre_money_valuations.get(self.region, self.typical_pre_money_valuations['US'])
        return region_valuations.get(stage, region_valuations['seed'])

    def assess_factor(self, factor_name: str, comparison_score: float) -> float:
        """
        Assess factor relative to average startup

        Args:
            factor_name: Name of factor being assessed
            comparison_score: -0.5 to +0.5 (0 = average, +0.5 = way above, -0.5 = way below)

        Returns:
            Adjustment multiplier (e.g., 1.3 for 30% above average)
        """

        if factor_name not in self.factor_weights:
            raise ValueError(f"Unknown factor: {factor_name}")

        weight = self.factor_weights[factor_name]

        adjustment = 1 + (comparison_score * weight / 0.30)

        return max(0.5, min(1.5, adjustment))

    def calculate_valuation(self, stage: str, factor_assessments: Dict[str, float],
                          custom_baseline: float = None) -> Dict[str, Any]:
        """
        Calculate valuation using scorecard method

        Args:
            stage: Funding stage ('seed', 'series_a')
            factor_assessments: Dict of factor_name -> comparison_score (-0.5 to +0.5)
            custom_baseline: Optional custom baseline instead of regional average

        Returns:
            Detailed valuation breakdown
        """

        baseline = custom_baseline or self.get_baseline_valuation(stage)

        factor_multipliers = {}
        cumulative_multiplier = 1.0

        for factor, comparison_score in factor_assessments.items():
            multiplier = self.assess_factor(factor, comparison_score)
            factor_multipliers[factor] = {
                'comparison_score': comparison_score,
                'weight': self.factor_weights[factor],
                'multiplier': multiplier
            }

            weight = self.factor_weights[factor]
            cumulative_multiplier *= (1 + (multiplier - 1) * weight / sum(self.factor_weights.values()))

        final_valuation = baseline * cumulative_multiplier

        return {
            'method': 'Scorecard Method',
            'baseline_valuation': baseline,
            'region': self.region,
            'stage': stage,
            'factor_assessments': factor_multipliers,
            'cumulative_multiplier': cumulative_multiplier,
            'final_valuation': final_valuation,
            'adjustment_pct': (cumulative_multiplier - 1) * 100
        }

    def comprehensive_assessment(self, stage: str, team_strength: str, market_size: str,
                                product_strength: str, competition: str,
                                sales_traction: str) -> Dict[str, Any]:
        """
        Comprehensive assessment with simplified inputs

        Args:
            All parameters: 'weak', 'average', 'strong', 'excellent'

        Returns:
            Valuation result
        """

        strength_to_score = {
            'weak': -0.4,
            'below_average': -0.2,
            'average': 0.0,
            'above_average': 0.2,
            'strong': 0.35,
            'excellent': 0.5
        }

        assessments = {
            'management_team': strength_to_score.get(team_strength, 0),
            'size_of_opportunity': strength_to_score.get(market_size, 0),
            'product_technology': strength_to_score.get(product_strength, 0),
            'competitive_environment': strength_to_score.get(competition, 0),
            'marketing_sales_channels': strength_to_score.get(sales_traction, 0),
            'need_for_additional_investment': 0.0,
            'other_factors': 0.0
        }

        return self.calculate_valuation(stage, assessments)

    def sensitivity_analysis(self, stage: str, base_assessments: Dict[str, float],
                           variable_factor: str) -> Dict[str, Any]:
        """Run sensitivity analysis on single factor"""

        results = []

        for score in [-0.5, -0.3, -0.1, 0, 0.1, 0.3, 0.5]:
            test_assessments = base_assessments.copy()
            test_assessments[variable_factor] = score

            valuation_result = self.calculate_valuation(stage, test_assessments)

            results.append({
                'factor_score': score,
                'valuation': valuation_result['final_valuation'],
                'multiplier': valuation_result['cumulative_multiplier']
            })

        return {
            'variable_factor': variable_factor,
            'sensitivity_data': results,
            'baseline_valuation': self.get_baseline_valuation(stage)
        }

# ---- service ABI shim (MAAnalyticsService) BEGIN ----
# The Qt MAAnalyticsService calls `scorecard_method.py calculate <flat-params-json>` (argv length 3), with the seven
# factor multipliers as a list. The native form is `scorecard stage region assessments_json`, so a service-style
# call is translated here and then falls through to the native dispatch. Any other argv shape is untouched.
_SERVICE_COMMANDS = ("calculate",)
_SVC_FACTORS = ("management_team", "size_of_opportunity", "product_technology", "competitive_environment",
                "marketing_sales_channels", "need_for_additional_investment", "other_factors")
_SVC_STAGES = {"early": "series_a", "growth": "series_a"}  # the baseline table only has seed / series_a


def _service_argv(argv):
    import json
    if len(argv) != 3 or argv[1] not in _SERVICE_COMMANDS:
        return argv
    try:
        p = json.loads(argv[2])
    except ValueError:
        return argv
    if not isinstance(p, dict):
        return argv
    stage = str(p.get("stage", "seed")).strip().lower()
    stage = _SVC_STAGES.get(stage, stage)
    region = str(p.get("region", "US"))
    assessments = p.get("assessments")
    if isinstance(assessments, list):
        # Panel order matches _SVC_FACTORS; each value is a 0.5-1.5 multiplier of the average company.
        assessments = {name: float(v) for name, v in zip(_SVC_FACTORS, assessments)
                       if isinstance(v, (int, float)) and not isinstance(v, bool)}
    elif not isinstance(assessments, dict):
        assessments = {}
    return [argv[0], "scorecard", stage, region, json.dumps(assessments)]
# ---- service ABI shim (MAAnalyticsService) END ----


def main():
    """CLI entry point - outputs JSON for C++ integration"""
    import json

    sys.argv = _service_argv(sys.argv)
    if len(sys.argv) < 2:
        result = {"success": False, "error": "No command specified"}
        print(json.dumps(result))
        sys.exit(1)

    command = sys.argv[1]

    try:
        if command == "scorecard":
            if len(sys.argv) < 5:
                raise ValueError("Stage, region, and factor assessments required")
            stage = sys.argv[2]
            region = sys.argv[3]
            factor_assessments = json.loads(sys.argv[4])

            scorecard = ScorecardMethod(region=region.capitalize() if region.lower() in ('us','europe','asia') else 'US')
            # Map all frontend key variants to internal scorecard factor names
            key_map = {
                # management team
                'team': 'management_team', 'management_team': 'management_team',
                'quality_team': 'management_team', 'team_strength': 'management_team',
                # market size
                'market_size': 'size_of_opportunity', 'market_opportunity': 'size_of_opportunity',
                'size_of_opportunity': 'size_of_opportunity',
                # product
                'product': 'product_technology', 'product_technology': 'product_technology',
                'product_strength': 'product_technology',
                # competitive
                'competitive': 'competitive_environment', 'competitive_environment': 'competitive_environment',
                'competition': 'competitive_environment',
                # marketing
                'marketing': 'marketing_sales_channels', 'marketing_channels': 'marketing_sales_channels',
                'sales_channels': 'marketing_sales_channels', 'marketing_sales_channels': 'marketing_sales_channels',
                # need for investment
                'need_for_funding': 'need_for_additional_investment',
                'need_for_investment': 'need_for_additional_investment',
                'need_for_additional_investment': 'need_for_additional_investment',
                # other
                'other': 'other_factors', 'other_factors': 'other_factors',
            }
            mapped = {}
            for k, v in factor_assessments.items():
                internal_key = key_map.get(k)
                if internal_key:
                    # Frontend sends multipliers (0.5-1.5); convert to comparison scores (-0.5 to +0.5)
                    # If value > 1.1 or < 0.9 it's clearly a multiplier, otherwise treat as comparison score
                    val = float(v)
                    if val >= 0.5 or val < -0.5:
                        # It's a multiplier (e.g. 1.2 = 20% above avg) → comp
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/derivatives/core.py`
```
"""
Derivatives Core Analytics Module
===============================

Core framework for derivatives analytics providing foundational classes, data structures, and validation utilities. Implements CFA Institute standard methodologies for derivative pricing, risk measurement, and portfolio management.

===== DATA SOURCES REQUIRED =====
INPUT:
  - Market data including spot prices, interest rates, dividend yields
  - Volatility surfaces and option pricing parameters
  - Derivative instrument specifications (strike, expiry, type)
  - Day count conventions and calendar data
  - Interest rate curves and yield curves
  - Corporate actions and event data

OUTPUT:
  - Standardized derivative instrument representations
  - Market data validation and processing
  - Pricing result containers and calculations
  - Time calculations using various day count conventions
  - Interest rate conversion utilities
  - Model validation and error handling

PARAMETERS:
  - spot_price: Current spot price of underlying asset
  - risk_free_rate: Risk-free interest rate
  - dividend_yield: Dividend yield for the underlying
  - volatility: Volatility parameter for pricing models
  - time_to_expiry: Time to expiration in years
  - strike_price: Strike price for options
  - notional: Contract notional amount - default: 1.0
  - day_count: Day count convention - default: DayCountConvention.ACT_365
  - from_compounding: Source rate compounding method
  - to_compounding: Target rate compounding method
  - frequency: Compounding frequency for discrete rates
"""

from abc import ABC, abstractmethod
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Union, Dict, Any, List
from datetime import datetime, date
import numpy as np
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DerivativeType(Enum):
    """Classification of derivative instruments"""
    FORWARD = "forward"
    FUTURE = "future"
    SWAP = "swap"
    OPTION = "option"
    CREDIT_DERIVATIVE = "credit_derivative"


class OptionType(Enum):
    """Option contract types"""
    CALL = "call"
    PUT = "put"


class Position(Enum):
    """Trading position direction"""
    LONG = "long"
    SHORT = "short"


class ExerciseStyle(Enum):
    """Option exercise styles"""
    EUROPEAN = "european"
    AMERICAN = "american"
    BERMUDAN = "bermudan"


class UnderlyingType(Enum):
    """Types of underlying assets"""
    EQUITY = "equity"
    BOND = "bond"
    COMMODITY = "commodity"
    CURRENCY = "currency"
    INTEREST_RATE = "interest_rate"
    INDEX = "index"


class DayCountConvention(Enum):
    """Day count conventions for financial calculations"""
    ACT_360 = "ACT/360"
    ACT_365 = "ACT/365"
    THIRTY_360 = "30/360"
    ACT_ACT = "ACT/ACT"


@dataclass
class MarketData:
    """Market data container for derivative pricing"""
    spot_price: float
    risk_free_rate: float
    dividend_yield: float = 0.0
    volatility: float = 0.0
    time_to_expiry: float = 0.0
    strike_price: Optional[float] = None
    forward_price: Optional[float] = None

    def __post_init__(self):
        """Validate market data inputs"""
        if self.spot_price <= 0:
            raise ValueError("Spot price must be positive")
        if self.volatility < 0:
            raise ValueError("Volatility cannot be negative")
        if self.time_to_expiry < 0:
            raise ValueError("Time to expiry cannot be negative")


@dataclass
class PricingResult:
    """Container for derivative pricing results"""
    fair_value: float
    intrinsic_value: Optional[float] = None
    time_value: Optional[float] = None
    greeks: Optional[Dict[str, float]] = None
    confidence_interval: Optional[tuple] = None
    calculation_details: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        """Calculate derived values"""
        if self.intrinsic_value is not None and self.time_value is None:
            self.time_value = self.fair_value - self.intrinsic_value


class ValidationError(Exception):
    """Custom exception for validation errors"""
    pass


class PricingError(Exception):
    """Custom exception for pricing calculation errors"""
    pass


class DerivativeInstrument(ABC):
    """
    Abstract base class for all derivative instruments.
    Implements common interface following CFA curriculum structure.
    """

    def __init__(self,
                 derivative_type: DerivativeType,
                 underlying_type: UnderlyingType,
                 expiry_date: Union[datetime, date],
                 notional: float = 1.0,
                 day_count: DayCountConvention = DayCountConvention.ACT_365):

        self.derivative_type = derivative_type
        self.underlying_type = underlying_type
        self.expiry_date = expiry_date
        self.notional = notional
        self.day_count = day_count
        self.creation_date = datetime.now()

        self._validate_inputs()

    def _validate_inputs(self):
        """Validate instrument parameters"""
        if self.notional <= 0:
            raise ValidationError("Notional amount must be positive")

        if isinstance(self.expiry_date, date):
            self.expiry_date = datetime.combine(self.expiry_date, datetime.min.time())

        if self.expiry_date <= self.creation_date:
            raise ValidationError("Expiry date must be in the future")

    @abstractmethod
    def calculate_payoff(self, spot_price: float) -> float:
        """Calculate payoff at expiration given spot price"""
        pass

    @abstractmethod
    def fair_value(self, market_data: MarketData) -> PricingResult:
        """Calculate fair value using appropriate pricing model"""
        pass

    def time_to_expiry(self, valuation_date: Optional[datetime] = None) -> float:
        """Calculate time to expiry in years"""
        if valuation_date is None:
            valuation_date = datetime.now()

        time_diff = self.expiry_date - valuation_date

        if self.day_count == DayCountConvention.ACT_365:
            return time_diff.total_seconds() / (365.25 * 24 * 3600)
        elif self.day_count == DayCountConvention.ACT_360:
            return time_diff.total_seconds() / (360 * 24 * 3600)
        elif self.day_count == DayCountConvention.THIRTY_360:
            return time_diff.days / 360
        else:  # ACT_ACT
            return time_diff.total_seconds() / (365.25 * 24 * 3600)

    def is_expired(self, valuation_date: Optional[datetime] = None) -> bool:
        """Check if derivative has expired"""
        if valuation_date is None:
            valuation_date = datetime.now()
        return valuation_date >= self.expiry_date

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(type={self.derivative_type.value}, expiry={self.expiry_date})"


class ForwardCommitment(DerivativeInstrument):
    """Base class for forward commitments (forwards, futures, swaps)"""

    def __init__(self,
                 derivative_type: DerivativeType,
                 underlying_type: UnderlyingType,
                 expiry_date: Union[datetime, date],
                 contract_price: float,
                 notional: float = 1.0,
                 day_count: DayCountConvention = DayCountConvention.ACT_365):
        super().__init__(derivative_type, underlying_type, expiry_date, notional, day_count)
        self.contract_price = contract_price

        if contract_price <= 0:
            raise ValidationError("Contract price must be positive")


class ContingentClaim(DerivativeInstrument):
    """Base class for contingent claims (options)"""

    def __init__(self,
                 option_type: OptionType,
                 underlying_type: UnderlyingType,
                 expiry_date: Union[datetime, date],
                 strike_price: float,
                 exercise_style: ExerciseStyle = ExerciseStyle.EUROPEAN,
                 notional: float = 1.0,
                 day_count: DayCountConvention = DayCountConvention.ACT_365):

        super().__init__(DerivativeType.OPTION, underlying_type, expiry_date, notional, day_count)
        self.option_type = option_type
        self.strike_price = strike_price
        self.exercise_style = exercise_style

        if strike_price <= 0:
            raise ValidationError("Strike price must be positive")

    def moneyness(self, spot_price: float) -> str:
        """Determine option moneyness"""
        if self.option_type == OptionType.CALL:
            if spot_price > self.strike_price:
                return "ITM"  # In-the-money
            elif spot_price == self.strike_price:
                return "ATM"  # At-the-money
            else:
                return "OTM"  # Out-of-the-money
        else:  # PUT
            if spot_price < self.strike_price:
                return "ITM"
            elif spot_price == self.strike_price:
                return "ATM"
            else:
                return "OTM"

    def intrinsic_value(self, spot_price: float) -> float:
        """Calculate intrinsic value of option"""
        if self.option_type == OptionType.CALL:
            return max(0, spot_price - self.strike_price)
        else:  # PUT
            return max(0, self.strike_price - spot_price)


class PricingEngine(ABC):
    """Abstract base class for pricing engines"""

    @abstractmethod
    def price(self, instrument: DerivativeInstrument, market_data: MarketData) -> PricingResult:
        """Price derivative instrument"""
        pass

    @abstractmethod
    def validate_inputs(self, instrument: DerivativeInstrument, market_data: MarketData) -> bool:
        """Validate inputs for pricing"""
        pass


class ModelValidator:
    """Validation utilities for derivative models"""

    @staticmethod
    def validate_probability(prob: float) -> bool:
        """Validate probability is between 0 and 1"""
        return 0 <= prob <= 1

    @staticmethod
    def validate_positive(value: float, name: str) -
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/derivatives/utils.py`
```

"""Derivatives Utils Module
=================================

Fixed income utility functions

===== DATA SOURCES REQUIRED =====
INPUT:
  - Underlying asset price data and market information
  - Option chain data with strikes, expirations, and premiums
  - Interest rate curves and volatility surfaces
  - Market quotes and bid-ask spreads
  - Counterparty information and collateral data

OUTPUT:
  - Derivatives pricing models and Greeks calculations
  - Portfolio risk metrics and exposure analysis
  - Arbitrage opportunities and trading signals
  - Scenario analysis and stress test results
  - Hedging effectiveness and optimization recommendations

PARAMETERS:
  - risk_free_rate: Risk-free rate for option pricing (default: 0.02)
  - volatility_method: Volatility estimation method (default: 'historical')
  - dividend_yield: Dividend yield for underlying assets (default: 0.0)
  - time_steps: Number of time steps for simulation (default: 100)
  - confidence_level: Confidence level for risk metrics (default: 0.95)
"""



import numpy as np
import pandas as pd
from typing import List, Tuple, Optional, Callable, Union, Dict, Any
from datetime import datetime, date, timedelta
from scipy import optimize, interpolate, stats
from scipy.special import erf, erfc
import calendar
import logging
from enum import Enum
from dataclasses import dataclass

from .core import DayCountConvention, ValidationError, ModelValidator

logger = logging.getLogger(__name__)


class InterpolationMethod(Enum):
    """Interpolation methods for yield curves and surfaces"""
    LINEAR = "linear"
    CUBIC_SPLINE = "cubic"
    NATURAL_SPLINE = "natural"
    HERMITE = "hermite"
    AKIMA = "akima"


class OptimizationMethod(Enum):
    """Optimization methods for numerical procedures"""
    NEWTON_RAPHSON = "newton_raphson"
    BISECTION = "bisection"
    BRENT = "brent"
    SECANT = "secant"
    LEVENBERG_MARQUARDT = "lm"


@dataclass
class Holiday:
    """Holiday definition for business day calculations"""
    name: str
    date: datetime
    country: str = "US"


class BusinessDayCalculator:
    """Business day calculations with holiday support"""

    def __init__(self, country: str = "US"):
        self.country = country
        self.holidays = self._load_holidays()

    def _load_holidays(self) -> List[Holiday]:
        """Load holidays for specified country"""
        # US Federal Holidays (simplified)
        current_year = datetime.now().year
        holidays = []

        for year in range(current_year - 1, current_year + 5):
            # New Year's Day
            holidays.append(Holiday("New Year's Day", datetime(year, 1, 1)))

            # Independence Day
            holidays.append(Holiday("Independence Day", datetime(year, 7, 4)))

            # Christmas Day
            holidays.append(Holiday("Christmas Day", datetime(year, 12, 25)))

            # Martin Luther King Jr. Day (3rd Monday in January)
            jan_1 = datetime(year, 1, 1)
            days_to_monday = (7 - jan_1.weekday()) % 7
            first_monday = jan_1 + timedelta(days=days_to_monday)
            mlk_day = first_monday + timedelta(days=14)  # 3rd Monday
            holidays.append(Holiday("MLK Day", mlk_day))

            # Presidents Day (3rd Monday in February)
            feb_1 = datetime(year, 2, 1)
            days_to_monday = (7 - feb_1.weekday()) % 7
            first_monday = feb_1 + timedelta(days=days_to_monday)
            presidents_day = first_monday + timedelta(days=14)
            holidays.append(Holiday("Presidents Day", presidents_day))

            # Labor Day (1st Monday in September)
            sep_1 = datetime(year, 9, 1)
            days_to_monday = (7 - sep_1.weekday()) % 7
            labor_day = sep_1 + timedelta(days=days_to_monday)
            holidays.append(Holiday("Labor Day", labor_day))

            # Thanksgiving (4th Thursday in November)
            nov_1 = datetime(year, 11, 1)
            days_to_thursday = (3 - nov_1.weekday()) % 7
            first_thursday = nov_1 + timedelta(days=days_to_thursday)
            thanksgiving = first_thursday + timedelta(days=21)  # 4th Thursday
            holidays.append(Holiday("Thanksgiving", thanksgiving))

        return holidays

    def is_business_day(self, date_input: Union[datetime, date]) -> bool:
        """Check if date is a business day"""
        if isinstance(date_input, date):
            date_input = datetime.combine(date_input, datetime.min.time())

        # Check if weekend
        if date_input.weekday() >= 5:  # Saturday = 5, Sunday = 6
            return False

        # Check if holiday
        for holiday in self.holidays:
            if (date_input.date() == holiday.date.date() and
                    holiday.country == self.country):
                return False

        return True

    def add_business_days(self, start_date: Union[datetime, date],
                          days: int) -> datetime:
        """Add business days to a date"""
        if isinstance(start_date, date):
            start_date = datetime.combine(start_date, datetime.min.time())

        current_date = start_date
        days_added = 0

        while days_added < days:
            current_date += timedelta(days=1)
            if self.is_business_day(current_date):
                days_added += 1

        return current_date

    def business_days_between(self, start_date: Union[datetime, date],
                              end_date: Union[datetime, date]) -> int:
        """Count business days between two dates"""
        if isinstance(start_date, date):
            start_date = datetime.combine(start_date, datetime.min.time())
        if isinstance(end_date, date):
            end_date = datetime.combine(end_date, datetime.min.time())

        if start_date >= end_date:
            return 0

        business_days = 0
        current_date = start_date

        while current_date < end_date:
            current_date += timedelta(days=1)
            if self.is_business_day(current_date):
                business_days += 1

        return business_days


class MathUtils:
    """Mathematical utility functions for derivatives pricing"""

    @staticmethod
    def normal_cdf(x: float) -> float:
        """Cumulative distribution function of standard normal"""
        return 0.5 * (1 + erf(x / np.sqrt(2)))

    @staticmethod
    def normal_pdf(x: float) -> float:
        """Probability density function of standard normal"""
        return np.exp(-0.5 * x ** 2) / np.sqrt(2 * np.pi)

    @staticmethod
    def inverse_normal_cdf(p: float) -> float:
        """Inverse cumulative distribution function (quantile)"""
        if not 0 < p < 1:
            raise ValueError("Probability must be between 0 and 1")
        return stats.norm.ppf(p)

    @staticmethod
    def bivariate_normal_cdf(x: float, y: float, rho: float) -> float:
        """Bivariate normal cumulative distribution function"""
        return stats.multivariate_normal.cdf([x, y], cov=[[1, rho], [rho, 1]])

    @staticmethod
    def black_scholes_call_delta(S: float, K: float, T: float, r: float,
                                 sigma: float, q: float = 0) -> float:
        """Black-Scholes call delta (analytical)"""
        if T <= 0:
            return 1.0 if S > K else 0.0

        d1 = (np.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        return np.exp(-q * T) * MathUtils.normal_cdf(d1)

    @staticmethod
    def black_scholes_gamma(S: float, K: float, T: float, r: float,
                            sigma: float, q: float = 0) -> float:
        """Black-Scholes gamma (analytical)"""
        if T <= 0:
            return 0.0

        d1 = (np.log(S / K) + (r - q + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        return (np.exp(-q * T) * MathUtils.normal_pdf(d1)) / (S * sigma * np.sqrt(T))

    @staticmethod
    def compound_interest(principal: float, rate: float, time: float,
                          frequency: int = 1) -> float:
        """Calculate compound interest"""
        return principal * (1 + rate / frequency) ** (frequency * time)

    @staticmethod
    def continuous_compounding(principal: float, rate: float, time: float) -> float:
        """Calculate continuous compounding"""
        return principal * np.exp(rate * time)

    @staticmethod
    def present_value(future_value: float, rate: float, time: float) -> float:
        """Calculate present value with continuous compounding"""
        return future_value * np.exp(-rate * time)

    @staticmethod
    def annuity_pv(payment: float, rate: float, periods: int) -> float:
        """Present value of ordinary annuity"""
        if rate == 0:
            return payment * periods
        return payment * (1 - (1 + rate) ** -periods) / rate

    @staticmethod
    def perpetuity_pv(payment: float, rate: float) -> float:
        """Present value of perpetuity"""
        if rate <= 0:
            raise ValueError("Rate must be positive for perpetuity")
        return payment / rate


class InterpolationEngine:
    """Advanced interpolation methods for financial data"""

    @staticmethod
    def linear_interpolation(x_points: np.ndarray, y_points: np.ndarray,
                             x_new: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        """Linear interpolation"""
        if len(x_points) != len(y_points):
            raise ValueError("x_points and y_points must have same length")

        return np.interp(x_new, x_points, y_points)

    @staticmethod
    def cubic_spline_interpolation(x_points: np.ndarray, y_points: np.ndarray,
                                   x_new: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        """Cubic spline interpolation"""
        if len(x_points) < 4:
            return InterpolationEngine.linear_interpolation(x_points, y_points, x_new)

        spline = interpolate.CubicSpline(x_points, y_points)
        return spline(x_new)

    @staticmethod
    def natural_spline_interpolatio
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/economics/analytics_engine.py`
```
"""
Analytics Engine Module
=======================

Advanced statistical analysis, forecasting, and scenario analysis for economic data.
Provides sophisticated analytical capabilities including time series forecasting,
statistical hypothesis testing, Monte Carlo simulation, and scenario analysis.

===== DATA SOURCES REQUIRED =====
INPUT:
  - Pandas DataFrame/Series with economic/financial data
  - Time series data with datetime index (for time series analysis)
  - Scenario parameters (dictionaries for scenario analysis)
  - Volatility, drift, base values (for Monte Carlo simulation)

OUTPUT:
  - Descriptive statistics (mean, median, variance, percentiles)
  - Correlation matrices with p-values
  - Hypothesis test results (t-tests, normality tests)
  - Time series forecasts (ARIMA, exponential smoothing, linear trend)
  - Monte Carlo simulation results with risk metrics
  - Scenario analysis comparisons and sensitivity results

PARAMETERS:
  - precision: Decimal precision (default: 8)
  - base_currency: Currency for calculations (default: 'USD')
  - confidence_level: Statistical confidence (default: 0.95)
  - forecast_periods: Number of periods to forecast (default: 12)
  - num_simulations: Monte Carlo simulations (default: 1000)
  - distribution: Probability distribution (default: 'normal')
"""

import numpy as np
import pandas as pd
from decimal import Decimal
from typing import Dict, List, Tuple, Optional, Any, Union, Callable
from datetime import datetime, timedelta
import warnings
from scipy import stats
from scipy.optimize import minimize
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, mean_absolute_error
import logging
from .core import EconomicsBase, ValidationError, CalculationError, DataError

logger = logging.getLogger(__name__)

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')


class StatisticalAnalyzer(EconomicsBase):
    """Advanced statistical analysis for economic data"""

    def __init__(self, precision: int = 8, base_currency: str = 'USD'):
        super().__init__(precision, base_currency)

    def descriptive_statistics(self, data: pd.Series,
                               confidence_level: float = 0.95) -> Dict[str, Any]:
        """Calculate comprehensive descriptive statistics"""

        if data.empty:
            raise ValidationError("Empty data series provided")

        # Remove NaN values
        clean_data = data.dropna()
        if clean_data.empty:
            raise ValidationError("No valid data points after removing NaN values")

        n = len(clean_data)
        mean = clean_data.mean()
        std = clean_data.std()

        # Basic statistics
        basic_stats = {
            'count': n,
            'mean': self.to_decimal(mean),
            'median': self.to_decimal(clean_data.median()),
            'mode': self.to_decimal(clean_data.mode().iloc[0]) if not clean_data.mode().empty else None,
            'standard_deviation': self.to_decimal(std),
            'variance': self.to_decimal(clean_data.var()),
            'minimum': self.to_decimal(clean_data.min()),
            'maximum': self.to_decimal(clean_data.max()),
            'range': self.to_decimal(clean_data.max() - clean_data.min())
        }

        # Percentiles
        percentiles = {}
        for p in [1, 5, 10, 25, 50, 75, 90, 95, 99]:
            percentiles[f'p{p}'] = self.to_decimal(clean_data.quantile(p / 100))

        # Shape statistics
        shape_stats = {
            'skewness': self.to_decimal(clean_data.skew()),
            'kurtosis': self.to_decimal(clean_data.kurtosis()),
            'excess_kurtosis': self.to_decimal(clean_data.kurtosis() - 3)
        }

        # Confidence intervals
        alpha = 1 - confidence_level
        t_critical = stats.t.ppf(1 - alpha / 2, n - 1)
        margin_of_error = t_critical * (std / np.sqrt(n))

        confidence_intervals = {
            'mean_ci_lower': self.to_decimal(mean - margin_of_error),
            'mean_ci_upper': self.to_decimal(mean + margin_of_error),
            'confidence_level': self.to_decimal(confidence_level)
        }

        # Normality tests
        normality_tests = self._test_normality(clean_data)

        return {
            'basic_statistics': basic_stats,
            'percentiles': percentiles,
            'shape_statistics': shape_stats,
            'confidence_intervals': confidence_intervals,
            'normality_tests': normality_tests,
            'outlier_analysis': self._analyze_outliers(clean_data)
        }

    def _test_normality(self, data: pd.Series) -> Dict[str, Any]:
        """Test for normality using multiple tests"""

        results = {}

        # Shapiro-Wilk test (best for small samples)
        if len(data) <= 5000:
            shapiro_stat, shapiro_p = stats.shapiro(data)
            results['shapiro_wilk'] = {
                'statistic': self.to_decimal(shapiro_stat),
                'p_value': self.to_decimal(shapiro_p),
                'is_normal': shapiro_p > 0.05
            }

        # Kolmogorov-Smirnov test
        ks_stat, ks_p = stats.kstest(data, 'norm', args=(data.mean(), data.std()))
        results['kolmogorov_smirnov'] = {
            'statistic': self.to_decimal(ks_stat),
            'p_value': self.to_decimal(ks_p),
            'is_normal': ks_p > 0.05
        }

        # Anderson-Darling test
        ad_stat, ad_critical, ad_significance = stats.anderson(data, dist='norm')
        results['anderson_darling'] = {
            'statistic': self.to_decimal(ad_stat),
            'critical_values': [self.to_decimal(cv) for cv in ad_critical],
            'significance_levels': [self.to_decimal(sl) for sl in ad_significance],
            'is_normal': ad_stat < ad_critical[2]  # 5% significance level
        }

        return results

    def _analyze_outliers(self, data: pd.Series) -> Dict[str, Any]:
        """Analyze outliers using multiple methods"""

        # IQR method
        Q1 = data.quantile(0.25)
        Q3 = data.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        iqr_outliers = ((data < lower_bound) | (data > upper_bound)).sum()

        # Z-score method
        z_scores = np.abs((data - data.mean()) / data.std())
        zscore_outliers = (z_scores > 3).sum()

        # Modified Z-score method
        median = data.median()
        mad = np.median(np.abs(data - median))
        modified_z_scores = 0.6745 * (data - median) / mad
        modified_zscore_outliers = (np.abs(modified_z_scores) > 3.5).sum()

        return {
            'iqr_method': {
                'outlier_count': int(iqr_outliers),
                'outlier_percentage': self.to_decimal((iqr_outliers / len(data)) * 100),
                'lower_bound': self.to_decimal(lower_bound),
                'upper_bound': self.to_decimal(upper_bound)
            },
            'zscore_method': {
                'outlier_count': int(zscore_outliers),
                'outlier_percentage': self.to_decimal((zscore_outliers / len(data)) * 100),
                'threshold': self.to_decimal(3)
            },
            'modified_zscore_method': {
                'outlier_count': int(modified_zscore_outliers),
                'outlier_percentage': self.to_decimal((modified_zscore_outliers / len(data)) * 100),
                'threshold': self.to_decimal(3.5)
            }
        }

    def correlation_analysis(self, data: pd.DataFrame,
                             method: str = 'pearson') -> Dict[str, Any]:
        """Comprehensive correlation analysis"""

        if data.empty:
            raise ValidationError("Empty dataframe provided")

        # Select only numeric columns
        numeric_data = data.select_dtypes(include=[np.number])
        if numeric_data.empty:
            raise ValidationError("No numeric columns found in data")

        # Calculate correlation matrix
        if method.lower() == 'pearson':
            corr_matrix = numeric_data.corr(method='pearson')
        elif method.lower() == 'spearman':
            corr_matrix = numeric_data.corr(method='spearman')
        elif method.lower() == 'kendall':
            corr_matrix = numeric_data.corr(method='kendall')
        else:
            raise ValidationError(f"Unknown correlation method: {method}")

        # Calculate p-values for correlations
        p_values = self._calculate_correlation_pvalues(numeric_data, method)

        # Find significant correlations
        significant_correlations = self._find_significant_correlations(
            corr_matrix, p_values, alpha=0.05
        )

        # Identify highest correlations
        highest_correlations = self._find_highest_correlations(corr_matrix, top_n=10)

        return {
            'correlation_matrix': corr_matrix.round(4).to_dict(),
            'p_values': p_values,
            'method': method,
            'significant_correlations': significant_correlations,
            'highest_correlations': highest_correlations,
            'summary_statistics': {
                'mean_correlation': self.to_decimal(
                    corr_matrix.values[np.triu_indices_from(corr_matrix.values, k=1)].mean()),
                'max_correlation': self.to_decimal(
                    corr_matrix.values[np.triu_indices_from(corr_matrix.values, k=1)].max()),
                'min_correlation': self.to_decimal(
                    corr_matrix.values[np.triu_indices_from(corr_matrix.values, k=1)].min())
            }
        }

    def _calculate_correlation_pvalues(self, data: pd.DataFrame, method: str) -> Dict[str, Dict[str, float]]:
        """Calculate p-values for correlation matrix"""

        columns = data.columns
        p_values = {}

        for i, col1 in enumerate(columns):
            p_values[col1] = {}
            for j, col2 in enumerate(columns):
                if i == j:
                    p_values[col1][col2] = 0.0
                else:
          
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/economics/core.py`
```
"""
Economics Analytics Core Framework
==================================

Comprehensive foundation for economic analysis providing base classes, validation utilities, mathematical functions, and data containers. Implements CFA Institute standard methodologies with high-precision decimal arithmetic for reliable economic calculations.

===== DATA SOURCES REQUIRED =====
INPUT:
  - Economic time series data (GDP, inflation, interest rates)
  - Exchange rate data and currency information
  - Balance of payments and capital flow statistics
  - Price level indices and inflation measures
  - Central bank policy data and monetary indicators
  - Trade statistics and international transaction data

OUTPUT:
  - Validated economic data containers with metadata
  - High-precision calculation results and analytics
  - Standardized economic indicators and metrics
  - Data quality assessments and validation reports
  - Mathematical calculations for economic modeling
  - Configuration settings and global constants

PARAMETERS:
  - precision: Decimal precision for calculations - default: 8
  - base_currency: Base currency for analysis - default: 'USD'
  - data_validation_enabled: Enable input validation - default: True
  - error_tolerance: Numerical error tolerance - default: 1e-6
  - default_confidence_interval: Default CI for calculations - default: 0.95
  - cache_enabled: Enable result caching - default: True
  - currency_code: ISO 4217 currency code
  - exchange_rate: Foreign exchange rate value
  - interest_rate: Annual interest rate (can be negative)
  - inflation_rate: Annual inflation rate
  - gdp_value: Gross Domestic Product value
  - time_period: Time period in years
"""

import re
import logging
from abc import ABC, abstractmethod
from decimal import Decimal, getcontext, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Union, Tuple
from datetime import datetime, date
import pandas as pd
import numpy as np

# Set high precision for financial calculations
getcontext().prec = 28

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EconomicsError(Exception):
    """Base exception for economics module"""
    pass


class ValidationError(EconomicsError):
    """Data validation errors"""
    pass


class CalculationError(EconomicsError):
    """Mathematical calculation errors"""
    pass


class DataError(EconomicsError):
    """Data sourcing and formatting errors"""
    pass


class EconomicsBase(ABC):
    """
    Abstract base class for all economics analysis components.
    Ensures consistent interface and precision across modules.
    """

    def __init__(self, precision: int = 8, base_currency: str = 'USD'):
        self.precision = precision
        self.base_currency = base_currency
        self.validator = DataValidator()
        self._results_cache = {}

    def to_decimal(self, value: Union[float, int, str]) -> Decimal:
        """Convert value to high-precision Decimal"""
        try:
            return Decimal(str(value)).quantize(
                Decimal('0.' + '0' * self.precision),
                rounding=ROUND_HALF_UP
            )
        except Exception as e:
            raise CalculationError(f"Cannot convert {value} to Decimal: {e}")

    def validate_inputs(self, **kwargs) -> bool:
        """Validate input parameters"""
        return self.validator.validate_parameters(**kwargs)

    @abstractmethod
    def calculate(self, *args, **kwargs) -> Dict[str, Any]:
        """Main calculation method - must be implemented by subclasses"""
        pass

    def get_metadata(self) -> Dict[str, Any]:
        """Return component metadata"""
        return {
            'class': self.__class__.__name__,
            'precision': self.precision,
            'base_currency': self.base_currency,
            'timestamp': datetime.now().isoformat()
        }


class DataValidator:
    """
    Comprehensive data validation for economics calculations.
    Ensures data quality and CFA-compliant input standards.
    """

    def __init__(self):
        self.currency_codes = {
            'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD',
            'SEK', 'NOK', 'DKK', 'CNY', 'INR', 'BRL', 'RUB', 'ZAR',
            'MXN', 'SGD', 'HKD', 'KRW', 'TRY', 'PLN', 'CZK', 'HUF'
        }

    def validate_currency_code(self, code: str) -> bool:
        """Validate ISO currency code"""
        if not isinstance(code, str) or len(code) != 3:
            raise ValidationError(f"Invalid currency code format: {code}")
        if code.upper() not in self.currency_codes:
            raise ValidationError(f"Unsupported currency code: {code}")
        return True

    def validate_exchange_rate(self, rate: Union[float, Decimal]) -> bool:
        """Validate exchange rate values"""
        rate = Decimal(str(rate)) if not isinstance(rate, Decimal) else rate
        if rate <= 0:
            raise ValidationError(f"Exchange rate must be positive: {rate}")
        if rate > Decimal('1000000'):
            raise ValidationError(f"Exchange rate seems unrealistic: {rate}")
        return True

    def validate_interest_rate(self, rate: Union[float, Decimal]) -> bool:
        """Validate interest rate (can be negative)"""
        rate = Decimal(str(rate)) if not isinstance(rate, Decimal) else rate
        if rate < Decimal('-0.10') or rate > Decimal('1.0'):
            raise ValidationError(f"Interest rate outside reasonable range: {rate}")
        return True

    def validate_time_period(self, period: Union[int, float]) -> bool:
        """Validate time periods in years"""
        if not isinstance(period, (int, float)) or period <= 0:
            raise ValidationError(f"Time period must be positive: {period}")
        if period > 100:
            raise ValidationError(f"Time period seems unrealistic: {period}")
        return True

    def validate_gdp_data(self, gdp: Union[float, Decimal]) -> bool:
        """Validate GDP values"""
        gdp = Decimal(str(gdp)) if not isinstance(gdp, Decimal) else gdp
        if gdp <= 0:
            raise ValidationError(f"GDP must be positive: {gdp}")
        return True

    def validate_inflation_rate(self, rate: Union[float, Decimal]) -> bool:
        """Validate inflation rates"""
        rate = Decimal(str(rate)) if not isinstance(rate, Decimal) else rate
        if rate < Decimal('-0.5') or rate > Decimal('2.0'):
            raise ValidationError(f"Inflation rate outside normal range: {rate}")
        return True

    def validate_date_format(self, date_input: Union[str, datetime, date]) -> datetime:
        """Validate and convert date inputs"""
        if isinstance(date_input, datetime):
            return date_input
        elif isinstance(date_input, date):
            return datetime.combine(date_input, datetime.min.time())
        elif isinstance(date_input, str):
            try:
                return datetime.strptime(date_input, '%Y-%m-%d')
            except ValueError:
                try:
                    return datetime.strptime(date_input, '%Y/%m/%d')
                except ValueError:
                    raise ValidationError(f"Invalid date format: {date_input}")
        else:
            raise ValidationError(f"Unsupported date type: {type(date_input)}")

    def validate_percentage(self, value: Union[float, Decimal]) -> bool:
        """Validate percentage values (0-100 or 0-1)"""
        value = Decimal(str(value)) if not isinstance(value, Decimal) else value
        if value < 0 or value > 100:
            raise ValidationError(f"Percentage outside valid range: {value}")
        return True

    def validate_dataframe(self, df: pd.DataFrame, required_columns: List[str]) -> bool:
        """Validate pandas DataFrame structure"""
        if not isinstance(df, pd.DataFrame):
            raise ValidationError("Input must be a pandas DataFrame")

        missing_cols = set(required_columns) - set(df.columns)
        if missing_cols:
            raise ValidationError(f"Missing required columns: {missing_cols}")

        if df.empty:
            raise ValidationError("DataFrame cannot be empty")

        return True

    def validate_bid_ask_spread(self, bid: Decimal, ask: Decimal) -> bool:
        """Validate bid-ask spread"""
        if bid >= ask:
            raise ValidationError(f"Bid ({bid}) must be less than ask ({ask})")

        spread = (ask - bid) / bid
        if spread > Decimal('0.1'):  # 10% spread seems excessive
            raise ValidationError(f"Bid-ask spread too wide: {spread:.4f}")

        return True

    def validate_parameters(self, **kwargs) -> bool:
        """Validate multiple parameters based on their types"""
        validators = {
            'currency': self.validate_currency_code,
            'exchange_rate': self.validate_exchange_rate,
            'interest_rate': self.validate_interest_rate,
            'time_period': self.validate_time_period,
            'gdp': self.validate_gdp_data,
            'inflation': self.validate_inflation_rate,
            'percentage': self.validate_percentage,
            'date': self.validate_date_format
        }

        for param_name, param_value in kwargs.items():
            # Extract parameter type from name
            param_type = None
            for validator_type in validators.keys():
                if validator_type in param_name.lower():
                    param_type = validator_type
                    break

            if param_type and param_value is not None:
                validators[param_type](param_value)

        return True


class CalculationUtils:
    """
    Utility functions for common economic calculations.
    Provides mathematical precision and error handling.
    """

    @staticmethod
    def compound_growth_rate(initial: Decimal, final: Decimal, periods: Decimal) -> Decimal:
        """Calculate compound annual growth rate"""
        if initial <= 0 or final <= 0 or periods <= 0:
            raise Calculat
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/equityInvestment/utils/calculations.py`
```

"""Equity Investment Calculations Module
======================================

Financial calculations and utility functions

===== DATA SOURCES REQUIRED =====
INPUT:
  - Company financial statements and SEC filings
  - Market price data and trading volume information
  - Industry reports and competitive analysis data
  - Management guidance and analyst estimates
  - Economic indicators affecting equity markets

OUTPUT:
  - Equity valuation models and fair value estimates
  - Fundamental analysis metrics and financial ratios
  - Investment recommendations and target prices
  - Risk assessments and portfolio implications
  - Sector and industry comparative analysis

PARAMETERS:
  - valuation_method: Primary valuation methodology (default: 'DCF')
  - discount_rate: Discount rate for valuation (default: 0.10)
  - terminal_growth: Terminal growth rate assumption (default: 0.025)
  - earnings_multiple: Target earnings multiple (default: 15.0)
  - reporting_currency: Reporting currency (default: 'USD')
"""



import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple, Union
import math
from scipy import stats
from scipy.optimize import fsolve
import warnings

from .base_models import ValidationError


class FinancialCalculations:
    """Common financial calculation utilities"""

    @staticmethod
    def time_value_of_money(principal: float, rate: float, periods: int,
                            compounding: str = "annual") -> Dict[str, float]:
        """Comprehensive time value of money calculations"""

        # Compounding frequency mapping
        compounding_freq = {
            "annual": 1,
            "semi-annual": 2,
            "quarterly": 4,
            "monthly": 12,
            "daily": 365,
            "continuous": float('inf')
        }

        freq = compounding_freq.get(compounding.lower(), 1)

        if freq == float('inf'):  # Continuous compounding
            future_value = principal * math.exp(rate * periods)
            effective_rate = math.exp(rate) - 1
        else:
            future_value = principal * (1 + rate / freq) ** (freq * periods)
            effective_rate = (1 + rate / freq) ** freq - 1

        present_value = future_value / ((1 + effective_rate) ** periods)

        return {
            'principal': principal,
            'future_value': future_value,
            'present_value_of_fv': present_value,
            'effective_annual_rate': effective_rate,
            'total_interest': future_value - principal,
            'compounding_frequency': freq
        }

    @staticmethod
    def annuity_calculations(payment: float, rate: float, periods: int,
                             annuity_type: str = "ordinary") -> Dict[str, float]:
        """Calculate present and future value of annuities"""

        if rate <= 0:
            # Handle zero interest rate case
            pv_annuity = payment * periods
            fv_annuity = payment * periods
        else:
            # Ordinary annuity (payments at end of period)
            pv_ordinary = payment * ((1 - (1 + rate) ** -periods) / rate)
            fv_ordinary = payment * (((1 + rate) ** periods - 1) / rate)

            if annuity_type.lower() == "due":
                # Annuity due (payments at beginning of period)
                pv_annuity = pv_ordinary * (1 + rate)
                fv_annuity = fv_ordinary * (1 + rate)
            else:
                pv_annuity = pv_ordinary
                fv_annuity = fv_ordinary

        return {
            'payment_amount': payment,
            'present_value': pv_annuity,
            'future_value': fv_annuity,
            'total_payments': payment * periods,
            'total_interest': fv_annuity - (payment * periods),
            'annuity_type': annuity_type
        }

    @staticmethod
    def perpetuity_value(payment: float, discount_rate: float,
                         growth_rate: float = 0) -> Dict[str, float]:
        """Calculate present value of perpetuity"""

        if discount_rate <= growth_rate:
            raise ValidationError("Discount rate must be greater than growth rate")

        if growth_rate == 0:
            # Simple perpetuity
            pv = payment / discount_rate
        else:
            # Growing perpetuity
            pv = payment / (discount_rate - growth_rate)

        return {
            'payment': payment,
            'discount_rate': discount_rate,
            'growth_rate': growth_rate,
            'present_value': pv,
            'perpetuity_type': 'Growing' if growth_rate > 0 else 'Simple'
        }

    @staticmethod
    def loan_calculations(principal: float, annual_rate: float, years: int,
                          payment_frequency: int = 12) -> Dict[str, Any]:
        """Calculate loan payments and amortization"""

        monthly_rate = annual_rate / payment_frequency
        total_payments = years * payment_frequency

        if annual_rate == 0:
            payment = principal / total_payments
        else:
            payment = principal * (monthly_rate * (1 + monthly_rate) ** total_payments) / \
                      ((1 + monthly_rate) ** total_payments - 1)

        # Create amortization schedule
        balance = principal
        schedule = []
        total_interest = 0

        for i in range(1, int(total_payments) + 1):
            interest_payment = balance * monthly_rate
            principal_payment = payment - interest_payment
            balance -= principal_payment
            total_interest += interest_payment

            schedule.append({
                'payment_number': i,
                'payment': payment,
                'principal': principal_payment,
                'interest': interest_payment,
                'balance': max(0, balance)  # Avoid negative balance due to rounding
            })

        return {
            'loan_amount': principal,
            'monthly_payment': payment,
            'total_payments': total_payments,
            'total_interest': total_interest,
            'total_cost': principal + total_interest,
            'amortization_schedule': schedule[:12],  # First year only
            'full_schedule_available': True
        }

    @staticmethod
    def bond_calculations(face_value: float, coupon_rate: float, market_rate: float,
                          years_to_maturity: float, frequency: int = 2) -> Dict[str, float]:
        """Calculate bond price, yield, and duration"""

        periods = years_to_maturity * frequency
        coupon_payment = (face_value * coupon_rate) / frequency
        period_rate = market_rate / frequency

        # Bond price calculation
        if market_rate == 0:
            bond_price = face_value + (coupon_payment * periods)
        else:
            # Present value of coupon payments
            pv_coupons = coupon_payment * ((1 - (1 + period_rate) ** -periods) / period_rate)
            # Present value of face value
            pv_face = face_value / ((1 + period_rate) ** periods)
            bond_price = pv_coupons + pv_face

        # Current yield
        current_yield = (coupon_payment * frequency) / bond_price

        # Macaulay Duration
        cash_flows = [coupon_payment] * int(periods)
        cash_flows[-1] += face_value  # Add face value to last payment

        weighted_time = 0
        total_pv = 0

        for t, cf in enumerate(cash_flows, 1):
            pv_cf = cf / ((1 + period_rate) ** t)
            weighted_time += (t / frequency) * pv_cf
            total_pv += pv_cf

        macaulay_duration = weighted_time / total_pv
        modified_duration = macaulay_duration / (1 + market_rate / frequency)

        return {
            'bond_price': bond_price,
            'face_value': face_value,
            'coupon_rate': coupon_rate,
            'market_rate': market_rate,
            'current_yield': current_yield,
            'macaulay_duration': macaulay_duration,
            'modified_duration': modified_duration,
            'price_sensitivity': modified_duration * bond_price * 0.01,  # Price change for 1% rate change
            'premium_discount': 'Premium' if bond_price > face_value else 'Discount' if bond_price < face_value else 'Par'
        }


class StatisticalCalculations:
    """Statistical analysis utilities for finance"""

    @staticmethod
    def descriptive_statistics(data: Union[List[float], pd.Series]) -> Dict[str, float]:
        """Calculate comprehensive descriptive statistics"""

        if isinstance(data, list):
            data = pd.Series(data)

        return {
            'count': len(data),
            'mean': data.mean(),
            'median': data.median(),
            'mode': data.mode().iloc[0] if not data.mode().empty else np.nan,
            'std_dev': data.std(),
            'variance': data.var(),
            'skewness': data.skew(),
            'kurtosis': data.kurtosis(),
            'min': data.min(),
            'max': data.max(),
            'range': data.max() - data.min(),
            'q25': data.quantile(0.25),
            'q75': data.quantile(0.75),
            'iqr': data.quantile(0.75) - data.quantile(0.25),
            'cv': data.std() / data.mean() if data.mean() != 0 else np.nan
        }

    @staticmethod
    def correlation_analysis(x: Union[List[float], pd.Series],
                             y: Union[List[float], pd.Series]) -> Dict[str, float]:
        """Calculate correlation and regression statistics"""

        if isinstance(x, list):
            x = pd.Series(x)
        if isinstance(y, list):
            y = pd.Series(y)

        # Remove missing values
        valid_data = pd.DataFrame({'x': x, 'y': y}).dropna()
        x_clean = valid_data['x']
        y_clean = valid_data['y']

        if len(x_clean) < 2:
            return {'error': 'Insufficient data for correlation analysis'}

        # Correlation
        pearson_corr = x_clean.corr(y_clean)
        spearman_corr = x_clean.corr(y_clean, method='spearman')

        # Li
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/finanicalanalysis/core/__init__.py`
```
"""Core Module"""
from .data_processor import DataProcessor, FinancialStatements, CompanyInfo, FinancialPeriod, ReportingStandard, CurrencyType, DataSource
from .base_analyzer import BaseAnalyzer, AnalysisResult, AnalysisType, RiskLevel, TrendDirection, ComparativeAnalysis, QualityAssessment
__all__ = ["DataProcessor", "FinancialStatements", "CompanyInfo", "FinancialPeriod", "ReportingStandard", "CurrencyType", "DataSource", "BaseAnalyzer", "AnalysisResult", "AnalysisType", "RiskLevel", "TrendDirection", "ComparativeAnalysis", "QualityAssessment"]


```

### Core Architecture Module: `fincept-qt/scripts/Analytics/finanicalanalysis/core/base_analyzer.py`
```
"""
Financial Statement Base Analyzer Module
=========================================

Abstract base class providing foundation for all financial statement analyzers with
CFA-compliant methodologies. Ensures consistent analysis framework across all
specialized financial analysis modules with standardized interfaces and validation.

===== DATA SOURCES REQUIRED =====
INPUT:
  - Company financial statements (10-K, 10-Q filings)
  - Management discussion and analysis (MD&A) sections
  - Auditor reports and financial statement footnotes
  - Industry benchmarks and comparative company data
  - Economic indicators affecting financial performance

OUTPUT:
  - Standardized financial analysis framework and interfaces
  - Abstract base classes for specialized analyzers
  - Common validation rules and quality checks
  - Consistent reporting templates and formats
  - Integration points for various analysis modules

PARAMETERS:
  - analysis_period: Financial analysis period (default: 3 years)
  - industry_benchmark: Industry for comparative analysis (default: 'auto')
  - quality_threshold: Minimum financial quality score (default: 0.7)
  - currency_reporting: Reporting currency for analysis (default: 'USD')
  - compliance_standard: Compliance standard (default: 'CFA')
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Union, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np
from datetime import datetime, date
import logging

# Import from data_processor
from .data_processor import FinancialStatements, CompanyInfo, FinancialPeriod, ReportingStandard


class AnalysisType(Enum):
    """Types of financial analysis"""
    LIQUIDITY = "liquidity"
    ACTIVITY = "activity"
    SOLVENCY = "solvency"
    PROFITABILITY = "profitability"
    VALUATION = "valuation"
    QUALITY = "quality"
    TECHNICAL = "technical"
    FUNDAMENTAL = "fundamental"


class RiskLevel(Enum):
    """Risk assessment levels"""
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"


class TrendDirection(Enum):
    """Trend direction classification"""
    IMPROVING = "improving"
    STABLE = "stable"
    DETERIORATING = "deteriorating"
    VOLATILE = "volatile"


@dataclass
class AnalysisResult:
    """Standardized analysis result structure"""
    analysis_type: AnalysisType
    metric_name: str
    value: float
    interpretation: str
    risk_level: RiskLevel
    trend: TrendDirection = None
    benchmark_comparison: str = None
    industry_percentile: float = None
    quality_score: float = None
    methodology: str = None
    limitations: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)


@dataclass
class ComparativeAnalysis:
    """Multi-period or peer comparison results"""
    periods: List[str]
    values: List[float]
    trend_analysis: str
    volatility_measure: float
    growth_rate: float = None
    peer_comparison: Dict[str, float] = field(default_factory=dict)


@dataclass
class QualityAssessment:
    """Data and earnings quality assessment"""
    overall_score: float  # 0-100 scale
    earnings_quality: float
    balance_sheet_quality: float
    cash_flow_quality: float
    red_flags: List[str] = field(default_factory=list)
    warning_signs: List[str] = field(default_factory=list)
    quality_drivers: List[str] = field(default_factory=list)


class BaseAnalyzer(ABC):
    """
    Abstract base class for all financial statement analyzers.
    Implements CFA Institute analysis framework and best practices.
    """

    def __init__(self, enable_logging: bool = True):
        """Initialize base analyzer with common functionality"""
        self.logger = logging.getLogger(self.__class__.__name__) if enable_logging else None
        self._initialize_benchmarks()
        self._initialize_formulas()

    def _initialize_benchmarks(self):
        """Initialize industry benchmarks and thresholds"""
        # Standard liquidity benchmarks
        self.liquidity_benchmarks = {
            'current_ratio': {'excellent': 2.0, 'good': 1.5, 'adequate': 1.2, 'poor': 1.0},
            'quick_ratio': {'excellent': 1.5, 'good': 1.0, 'adequate': 0.8, 'poor': 0.5},
            'cash_ratio': {'excellent': 0.5, 'good': 0.3, 'adequate': 0.2, 'poor': 0.1}
        }

        # Standard activity benchmarks
        self.activity_benchmarks = {
            'asset_turnover': {'excellent': 2.0, 'good': 1.5, 'adequate': 1.0, 'poor': 0.5},
            'inventory_turnover': {'excellent': 12.0, 'good': 8.0, 'adequate': 6.0, 'poor': 4.0},
            'receivables_turnover': {'excellent': 12.0, 'good': 8.0, 'adequate': 6.0, 'poor': 4.0}
        }

        # Standard solvency benchmarks
        self.solvency_benchmarks = {
            'debt_to_equity': {'excellent': 0.3, 'good': 0.5, 'adequate': 1.0, 'poor': 2.0},
            'debt_to_assets': {'excellent': 0.2, 'good': 0.3, 'adequate': 0.5, 'poor': 0.7},
            'interest_coverage': {'excellent': 10.0, 'good': 5.0, 'adequate': 2.5, 'poor': 1.5}
        }

        # Standard profitability benchmarks
        self.profitability_benchmarks = {
            'gross_margin': {'excellent': 0.4, 'good': 0.3, 'adequate': 0.2, 'poor': 0.1},
            'operating_margin': {'excellent': 0.2, 'good': 0.15, 'adequate': 0.1, 'poor': 0.05},
            'net_margin': {'excellent': 0.15, 'good': 0.1, 'adequate': 0.05, 'poor': 0.02},
            'roe': {'excellent': 0.2, 'good': 0.15, 'adequate': 0.1, 'poor': 0.05},
            'roa': {'excellent': 0.15, 'good': 0.1, 'adequate': 0.05, 'poor': 0.02}
        }

        # Quality assessment thresholds
        self.quality_thresholds = {
            'earnings_quality': {'high': 80, 'moderate': 60, 'low': 40},
            'cash_flow_quality': {'high': 80, 'moderate': 60, 'low': 40},
            'balance_sheet_quality': {'high': 80, 'moderate': 60, 'low': 40}
        }

    def _initialize_formulas(self):
        """Initialize standard financial formulas and calculations"""
        # This will be extended by specific analyzers
        self.formula_registry = {}

    @abstractmethod
    def analyze(self, statements: FinancialStatements,
                comparative_data: Optional[List[FinancialStatements]] = None,
                industry_data: Optional[Dict] = None) -> List[AnalysisResult]:
        """
        Main analysis method - must be implemented by subclasses

        Args:
            statements: Current period financial statements
            comparative_data: Historical data for trend analysis
            industry_data: Industry benchmarks and peer data

        Returns:
            List of analysis results
        """
        pass

    @abstractmethod
    def get_key_metrics(self, statements: FinancialStatements) -> Dict[str, float]:
        """Return key metrics calculated by this analyzer"""
        pass

    def validate_data_sufficiency(self, statements: FinancialStatements,
                                  required_fields: List[str]) -> Tuple[bool, List[str]]:
        """
        Validate that required data fields are present for analysis

        Args:
            statements: Financial statements to validate
            required_fields: List of required field names

        Returns:
            Tuple of (is_sufficient, missing_fields)
        """
        missing_fields = []

        # Check across all statement types
        all_data = {
            **statements.income_statement,
            **statements.balance_sheet,
            **statements.cash_flow
        }

        for field in required_fields:
            if field not in all_data or all_data[field] is None:
                missing_fields.append(field)

        is_sufficient = len(missing_fields) == 0

        if not is_sufficient and self.logger:
            self.logger.warning(f"Missing required fields for analysis: {missing_fields}")

        return is_sufficient, missing_fields

    def calculate_trend(self, values: List[float], periods: List[str]) -> ComparativeAnalysis:
        """
        Calculate trend analysis for a series of values

        Args:
            values: List of metric values over time
            periods: List of period identifiers

        Returns:
            ComparativeAnalysis object with trend information
        """
        if len(values) < 2:
            return ComparativeAnalysis(
                periods=periods,
                values=values,
                trend_analysis="Insufficient data for trend analysis",
                volatility_measure=0.0
            )

        # Calculate growth rate (CAGR if multiple periods)
        if len(values) > 1:
            if values[0] != 0:
                if len(values) == 2:
                    growth_rate = (values[-1] / values[0]) - 1
                else:
                    n_periods = len(values) - 1
                    growth_rate = (values[-1] / values[0]) ** (1 / n_periods) - 1
            else:
                growth_rate = None
        else:
            growth_rate = None

        # Calculate volatility (coefficient of variation)
        mean_value = np.mean(values)
        std_value = np.std(values)
        volatility = std_value / mean_value if mean_value != 0 else 0

        # Determine trend direction
        if len(values) >= 3:
            recent_trend = np.polyfit(range(len(values)), values, 1)[0]
            if recent_trend > 0.05 * mean_value:
                trend_description = "Strong upward trend"
            elif recent_trend > 0.02 * mean_value:
                trend_description = "Moderate upward trend"
            elif recent_trend < -0.05 * mean_value:
                trend_description = "Strong downward trend"
            elif recent_trend < -0.02 * mean_value:
                trend_description = "Moderate downward trend"
            else:
                trend_description = "Stable trend"
        else:
            if values[-1] > values[0]:
      
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/finanicalanalysis/core/data_processor.py`
```

"""
Financial Statement Data Processor Module
========================================

Financial data processing and standardization for analysis

===== DATA SOURCES REQUIRED =====
INPUT:
  - Company financial statements and SEC filings
  - Management discussion and analysis sections
  - Auditor reports and financial statement footnotes
  - Industry benchmarks and competitor data
  - Economic indicators affecting financial performance

OUTPUT:
  - Financial analysis metrics and key performance indicators
  - Trend analysis and financial ratio calculations
  - Risk assessment and quality metrics
  - Comparative analysis and benchmarking results
  - Investment recommendations and insights

PARAMETERS:
  - analysis_period: Financial analysis period (default: 3 years)
  - industry_benchmark: Industry for comparative analysis (default: 'auto')
  - quality_threshold: Minimum financial quality score (default: 0.7)
  - growth_assumption: Growth rate assumption (default: 0.05)
  - currency: Reporting currency (default: 'USD')
"""


import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Union, Any
from datetime import datetime, date
from dataclasses import dataclass, field
from enum import Enum
import logging


class ReportingStandard(Enum):
    """Financial reporting standards"""
    IFRS = "IFRS"
    US_GAAP = "US_GAAP"
    LOCAL_GAAP = "LOCAL_GAAP"


class CurrencyType(Enum):
    """Currency classification for multinational operations"""
    PRESENTATION = "presentation"  # Reporting currency
    FUNCTIONAL = "functional"  # Primary economic environment
    LOCAL = "local"  # Local country currency


class DataSource(Enum):
    """Supported data sources"""
    API = "api"
    CSV = "csv"
    EXCEL = "excel"
    JSON = "json"
    MANUAL = "manual"
    TERMINAL = "terminal"


@dataclass
class CompanyInfo:
    """Company identification and basic information"""
    ticker: str
    name: str
    sector: str
    industry: str
    country: str
    reporting_standard: ReportingStandard
    fiscal_year_end: str
    presentation_currency: str
    functional_currency: str = None
    exchange: str = None
    market_cap: float = None


@dataclass
class FinancialPeriod:
    """Financial reporting period information"""
    period_end: date
    period_type: str  # 'annual', 'quarterly', 'interim'
    fiscal_year: int
    fiscal_period: str  # 'Q1', 'Q2', 'Q3', 'Q4', 'FY'
    reporting_date: date = None
    audit_status: str = None  # 'audited', 'reviewed', 'unaudited'


@dataclass
class FinancialStatements:
    """Standardized financial statement data structure"""
    # Company and period info
    company_info: CompanyInfo
    period_info: FinancialPeriod

    # Income Statement
    income_statement: Dict[str, float] = field(default_factory=dict)

    # Balance Sheet
    balance_sheet: Dict[str, float] = field(default_factory=dict)

    # Cash Flow Statement
    cash_flow: Dict[str, float] = field(default_factory=dict)

    # Statement of Equity
    equity_statement: Dict[str, float] = field(default_factory=dict)

    # Notes and supplementary information
    notes: Dict[str, Any] = field(default_factory=dict)

    # Ratios and metrics (calculated)
    ratios: Dict[str, float] = field(default_factory=dict)

    # Data quality indicators
    data_quality: Dict[str, Any] = field(default_factory=dict)


class DataProcessor:
    """
    Universal financial data processor supporting multiple data sources and formats.
    Ensures CFA-compliant standardization and validation.
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._initialize_standard_mappings()

    def _initialize_standard_mappings(self):
        """Initialize standard account mappings for different reporting standards"""

        # Income Statement Standard Mappings
        self.income_statement_mapping = {
            'revenue': ['revenue', 'sales', 'net_sales', 'total_revenue', 'net_revenue'],
            'cost_of_sales': ['cost_of_sales', 'cost_of_goods_sold', 'cogs', 'cost_of_revenue'],
            'gross_profit': ['gross_profit', 'gross_income'],
            'operating_expenses': ['operating_expenses', 'total_operating_expenses'],
            'selling_expenses': ['selling_expenses', 'sales_expenses', 'marketing_expenses'],
            'administrative_expenses': ['administrative_expenses', 'admin_expenses', 'general_admin'],
            'rd_expenses': ['research_development', 'rd_expenses', 'r_and_d'],
            'depreciation': ['depreciation', 'depreciation_amortization', 'da_expense'],
            'operating_income': ['operating_income', 'ebit', 'operating_profit'],
            'interest_expense': ['interest_expense', 'interest_cost', 'finance_costs'],
            'interest_income': ['interest_income', 'interest_revenue'],
            'other_income': ['other_income', 'other_revenue', 'non_operating_income'],
            'pretax_income': ['pretax_income', 'ebt', 'income_before_tax'],
            'tax_expense': ['tax_expense', 'income_tax', 'provision_for_taxes'],
            'net_income': ['net_income', 'net_profit', 'profit_after_tax'],
            'discontinued_operations': ['discontinued_operations', 'discontinued_ops'],
            'extraordinary_items': ['extraordinary_items', 'exceptional_items'],
            'basic_eps': ['basic_eps', 'earnings_per_share_basic'],
            'diluted_eps': ['diluted_eps', 'earnings_per_share_diluted'],
            'shares_outstanding_basic': ['shares_outstanding_basic', 'basic_shares'],
            'shares_outstanding_diluted': ['shares_outstanding_diluted', 'diluted_shares']
        }

        # Balance Sheet Standard Mappings
        self.balance_sheet_mapping = {
            # Assets
            'cash_equivalents': ['cash', 'cash_equivalents', 'cash_and_equivalents'],
            'short_term_investments': ['short_term_investments', 'marketable_securities'],
            'accounts_receivable': ['accounts_receivable', 'receivables', 'trade_receivables'],
            'inventory': ['inventory', 'inventories'],
            'prepaid_expenses': ['prepaid_expenses', 'prepaid_assets'],
            'current_assets': ['current_assets', 'total_current_assets'],
            'ppe_gross': ['ppe_gross', 'property_plant_equipment_gross'],
            'accumulated_depreciation': ['accumulated_depreciation', 'accum_depreciation'],
            'ppe_net': ['ppe_net', 'property_plant_equipment_net'],
            'intangible_assets': ['intangible_assets', 'intangibles'],
            'goodwill': ['goodwill'],
            'long_term_investments': ['long_term_investments', 'investments'],
            'total_assets': ['total_assets', 'assets'],

            # Liabilities
            'accounts_payable': ['accounts_payable', 'payables', 'trade_payables'],
            'short_term_debt': ['short_term_debt', 'current_debt'],
            'accrued_liabilities': ['accrued_liabilities', 'accrued_expenses'],
            'current_liabilities': ['current_liabilities', 'total_current_liabilities'],
            'long_term_debt': ['long_term_debt', 'non_current_debt'],
            'deferred_tax_liability': ['deferred_tax_liability', 'deferred_tax_liab'],
            'other_liabilities': ['other_liabilities', 'other_non_current_liab'],
            'total_liabilities': ['total_liabilities', 'liabilities'],

            # Equity
            'common_stock': ['common_stock', 'share_capital'],
            'retained_earnings': ['retained_earnings'],
            'accumulated_oci': ['accumulated_oci', 'other_comprehensive_income'],
            'treasury_stock': ['treasury_stock', 'treasury_shares'],
            'total_equity': ['total_equity', 'shareholders_equity', 'stockholders_equity']
        }

        # Cash Flow Statement Standard Mappings
        self.cash_flow_mapping = {
            # Operating Activities
            'net_income_cf': ['net_income', 'profit_after_tax'],
            'depreciation_cf': ['depreciation', 'depreciation_amortization'],
            'amortization_cf': ['amortization'],
            'stock_compensation': ['stock_based_compensation', 'share_based_comp'],
            'deferred_tax': ['deferred_tax', 'deferred_tax_expense'],
            'working_capital_change': ['working_capital_change', 'change_working_capital'],
            'accounts_receivable_change': ['accounts_receivable_change'],
            'inventory_change': ['inventory_change'],
            'accounts_payable_change': ['accounts_payable_change'],
            'operating_cash_flow': ['operating_cash_flow', 'cash_from_operations'],

            # Investing Activities
            'capex': ['capital_expenditures', 'capex', 'ppe_investments'],
            'acquisitions': ['acquisitions', 'business_acquisitions'],
            'asset_sales': ['asset_sales', 'asset_disposals'],
            'investment_purchases': ['investment_purchases', 'securities_purchased'],
            'investment_sales': ['investment_sales', 'securities_sold'],
            'investing_cash_flow': ['investing_cash_flow', 'cash_from_investing'],

            # Financing Activities
            'debt_issued': ['debt_issued', 'debt_proceeds'],
            'debt_repaid': ['debt_repaid', 'debt_repayments'],
            'equity_issued': ['equity_issued', 'stock_issued'],
            'equity_repurchased': ['equity_repurchased', 'stock_repurchased'],
            'dividends_paid': ['dividends_paid', 'dividend_payments'],
            'financing_cash_flow': ['financing_cash_flow', 'cash_from_financing'],

            # Net Change
            'net_cash_change': ['net_cash_change', 'net_change_cash'],
            'cash_beginning': ['cash_beginning_period', 'beginning_cash'],
            'cash_ending': ['cash_ending_period', 'ending_cash']
        }

    def process_data(self, data: Union[Dict, pd.DataFrame, str],
                     source_type: DataSource,
                     company_info: CompanyInfo,
                     period_info: FinancialPeriod) -> Financi
```

### Core Architecture Module: `fincept-qt/scripts/Analytics/finanicalanalysis/statement_analyzers/__init__.py`
```
"""Statement Analyzers Module"""
from .income_statement import IncomeStatementAnalyzer
from .balance_sheet import BalanceSheetAnalyzer
from .cash_flow import CashFlowAnalyzer
from .comprehensive_analyzer import ComprehensiveAnalyzer
__all__ = ["IncomeStatementAnalyzer", "BalanceSheetAnalyzer", "CashFlowAnalyzer", "ComprehensiveAnalyzer"]


```

### Core Architecture Module: `fincept-qt/scripts/Analytics/finanicalanalysis/statement_analyzers/balance_sheet.py`
```

"""
Financial Statement Balance Sheet Module
========================================

Balance sheet analysis and financial position assessment

===== DATA SOURCES REQUIRED =====
INPUT:
  - Company financial statements and SEC filings
  - Management discussion and analysis sections
  - Auditor reports and financial statement footnotes
  - Industry benchmarks and competitor data
  - Economic indicators affecting financial performance

OUTPUT:
  - Financial analysis metrics and key performance indicators
  - Trend analysis and financial ratio calculations
  - Risk assessment and quality metrics
  - Comparative analysis and benchmarking results
  - Investment recommendations and insights

PARAMETERS:
  - analysis_period: Financial analysis period (default: 3 years)
  - industry_benchmark: Industry for comparative analysis (default: 'auto')
  - quality_threshold: Minimum financial quality score (default: 0.7)
  - growth_assumption: Growth rate assumption (default: 0.05)
  - currency: Reporting currency (default: 'USD')
"""


import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
import logging

# Import from core modules
from ..core.base_analyzer import BaseAnalyzer, AnalysisResult, AnalysisType, RiskLevel, TrendDirection, \
    ComparativeAnalysis
from ..core.data_processor import FinancialStatements, ReportingStandard


class AssetQuality(Enum):
    """Asset quality classification"""
    HIGH_QUALITY = "high_quality"
    MODERATE_QUALITY = "moderate_quality"
    LOW_QUALITY = "low_quality"
    IMPAIRED = "impaired"


class LiabilityType(Enum):
    """Liability classification"""
    CURRENT = "current"
    NON_CURRENT = "non_current"
    CONTINGENT = "contingent"
    OFF_BALANCE_SHEET = "off_balance_sheet"


class EquityStructure(Enum):
    """Equity structure classification"""
    SIMPLE = "simple"
    COMPLEX = "complex"
    HIGHLY_LEVERAGED = "highly_leveraged"


@dataclass
class LiquidityAnalysis:
    """Comprehensive liquidity analysis results"""
    current_ratio: float
    quick_ratio: float
    cash_ratio: float
    working_capital: float
    working_capital_ratio: float
    net_working_capital: float
    liquidity_quality_score: float
    liquidity_risk_level: RiskLevel
    short_term_debt_coverage: float = None
    cash_conversion_cycle: float = None


@dataclass
class AssetAnalysis:
    """Detailed asset composition and quality analysis"""
    asset_turnover: float
    current_asset_ratio: float
    non_current_asset_ratio: float
    intangible_asset_ratio: float
    goodwill_ratio: float
    ppe_ratio: float
    asset_quality_score: float
    depreciation_rate: float = None
    asset_age_factor: float = None
    impairment_indicators: List[str] = field(default_factory=list)


@dataclass
class LiabilityAnalysis:
    """Comprehensive liability structure analysis"""
    debt_to_equity: float
    debt_to_assets: float
    current_liability_ratio: float
    long_term_debt_ratio: float
    interest_bearing_debt_ratio: float
    debt_maturity_profile: Dict[str, float] = field(default_factory=dict)
    off_balance_sheet_items: float = None
    contingent_liabilities: float = None


@dataclass
class EquityAnalysis:
    """Equity structure and quality analysis"""
    equity_ratio: float
    retained_earnings_ratio: float
    book_value_per_share: float
    tangible_book_value_per_share: float
    equity_multiplier: float
    return_on_equity: float = None
    dividend_coverage: float = None
    share_repurchase_activity: float = None


class BalanceSheetAnalyzer(BaseAnalyzer):
    """
    Comprehensive balance sheet analyzer implementing CFA Institute standards.
    Covers asset analysis, liability evaluation, liquidity assessment, and equity structure.
    """

    def __init__(self, enable_logging: bool = True):
        super().__init__(enable_logging)
        self._initialize_balance_sheet_formulas()
        self._initialize_balance_sheet_benchmarks()

    def _initialize_balance_sheet_formulas(self):
        """Initialize balance sheet specific formulas"""
        self.formula_registry.update({
            'current_ratio': lambda current_assets, current_liabs: self.safe_divide(current_assets, current_liabs),
            'quick_ratio': lambda quick_assets, current_liabs: self.safe_divide(quick_assets, current_liabs),
            'cash_ratio': lambda cash, current_liabs: self.safe_divide(cash, current_liabs),
            'debt_to_equity': lambda total_debt, total_equity: self.safe_divide(total_debt, total_equity),
            'debt_to_assets': lambda total_debt, total_assets: self.safe_divide(total_debt, total_assets),
            'asset_turnover': lambda revenue, avg_total_assets: self.safe_divide(revenue, avg_total_assets),
            'equity_multiplier': lambda total_assets, total_equity: self.safe_divide(total_assets, total_equity),
            'working_capital_ratio': lambda working_capital, total_assets: self.safe_divide(working_capital,
                                                                                            total_assets)
        })

    def _initialize_balance_sheet_benchmarks(self):
        """Initialize balance sheet specific benchmarks"""
        # Asset composition benchmarks (industry-dependent)
        self.asset_composition_benchmarks = {
            'current_asset_ratio': {'high': 0.4, 'moderate': 0.3, 'low': 0.2},
            'intangible_ratio': {'high': 0.3, 'moderate': 0.15, 'low': 0.05},
            'goodwill_ratio': {'high': 0.2, 'moderate': 0.1, 'low': 0.05}
        }

        # Liability structure benchmarks
        self.liability_benchmarks = {
            'current_liability_ratio': {'high': 0.4, 'moderate': 0.3, 'low': 0.2},
            'long_term_debt_ratio': {'high': 0.4, 'moderate': 0.25, 'low': 0.15}
        }

    def analyze(self, statements: FinancialStatements,
                comparative_data: Optional[List[FinancialStatements]] = None,
                industry_data: Optional[Dict] = None) -> List[AnalysisResult]:
        """
        Comprehensive balance sheet analysis

        Args:
            statements: Current period financial statements
            comparative_data: Historical financial statements for trend analysis
            industry_data: Industry benchmarks and peer data

        Returns:
            List of analysis results covering all balance sheet aspects
        """
        results = []

        # Validate data sufficiency
        required_fields = ['total_assets', 'total_liabilities', 'total_equity']
        is_sufficient, missing_fields = self.validate_data_sufficiency(statements, required_fields)

        if not is_sufficient:
            if self.logger:
                self.logger.warning(f"Insufficient data for complete analysis. Missing: {missing_fields}")

        # Liquidity analysis
        results.extend(self._analyze_liquidity(statements, comparative_data, industry_data))

        # Asset analysis
        results.extend(self._analyze_assets(statements, comparative_data, industry_data))

        # Liability analysis
        results.extend(self._analyze_liabilities(statements, comparative_data, industry_data))

        # Equity analysis
        results.extend(self._analyze_equity(statements, comparative_data, industry_data))

        # Financial position quality
        results.extend(self._assess_financial_position_quality(statements, comparative_data))

        # Common-size analysis
        results.extend(self._perform_common_size_analysis(statements, comparative_data))

        # Balance sheet relationships
        results.extend(self._analyze_balance_sheet_relationships(statements, comparative_data))

        return results

    def _analyze_liquidity(self, statements: FinancialStatements,
                           comparative_data: Optional[List[FinancialStatements]] = None,
                           industry_data: Optional[Dict] = None) -> List[AnalysisResult]:
        """Comprehensive liquidity analysis"""
        results = []
        balance_sheet = statements.balance_sheet

        current_assets = balance_sheet.get('current_assets', 0)
        current_liabilities = balance_sheet.get('current_liabilities', 0)
        cash_equivalents = balance_sheet.get('cash_equivalents', 0)
        accounts_receivable = balance_sheet.get('accounts_receivable', 0)
        inventory = balance_sheet.get('inventory', 0)

        # Current Ratio
        if current_liabilities > 0:
            current_ratio = self.safe_divide(current_assets, current_liabilities)
            benchmark = self.liquidity_benchmarks.get('current_ratio', {})
            risk_level = self.assess_risk_level(current_ratio, benchmark, higher_is_better=True)

            results.append(AnalysisResult(
                analysis_type=AnalysisType.LIQUIDITY,
                metric_name="Current Ratio",
                value=current_ratio,
                interpretation=self.generate_interpretation("current ratio", current_ratio, risk_level,
                                                            AnalysisType.LIQUIDITY),
                risk_level=risk_level,
                benchmark_comparison=self.compare_to_industry(current_ratio, industry_data.get(
                    'current_ratio') if industry_data else None),
                methodology="Current Assets / Current Liabilities",
                limitations=["Does not consider asset quality or conversion timing"]
            ))

        # Quick Ratio (Acid Test)
        if current_liabilities > 0:
            quick_assets = current_assets - inventory  # Excluding inventory
            quick_ratio = self.safe_divide(quick_assets, current_liabilities)
            benchmark = self.liquidity_benchmarks.get('quick_ratio', {})
            risk_level = self.assess_risk_level(quick_ratio, benchmark, higher_is_better=True)

            results.append(AnalysisResult(
                analysis_type=AnalysisType.LIQUIDITY,
 
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

### Incident Patch 1: `600783ee` (2026-10-01)
**Commit Message**: Bug fixes

**File**: `.github/scripts/arch_ratchet.py` (modified, +8/-0)
```diff
@@ -128,6 +128,14 @@ def scan_file(path: Path) -> tuple[int, int, list[tuple[int, str]]]:
 
 
 def main() -> int:
+    # The report prints "→"; a Windows console defaults to cp1252 and would
+    # raise UnicodeEncodeError instead of showing which ratchet rose.
+    for stream in (sys.stdout, sys.stderr):
+        try:
+            stream.reconfigure(encoding="utf-8", errors="replace")
+        except (AttributeError, ValueError):
+            pass
+
     ap = argparse.ArgumentParser()
     ap.add_argument("--root", default="fincept-qt/src")
     ap.add_argument("--update-baseline", action="store_true")
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 > [!IMPORTANT]
 > ## 🔒 Fincept Terminal **Enterprise** — the private edition is now available.
-> RealTime data · Multi-agent AI research · Live broker, Backtest & Algo execution · Priority support
+> RealTime data · Multi-agent AI research · Live broker, Backtest & Algo execution · Priority support ·
 > Equity Research · Portfolio Management · Financial Workflows · Quant Research Lab · Maritime · Geopolitics
 >
 > | Plan | Price |
```

**File**: `docs/CONTRIBUTING.md` (modified, +2/-1)
```diff
@@ -74,9 +74,10 @@ Optional (speeds up rebuilds): **ccache 4.13.4** on Windows is auto-detected.
 git clone https://github.com/Fincept-Corporation/FinceptTerminal.git
 cd FinceptTerminal
 ./setup.sh      # Linux / macOS — installs toolchain + Qt via aqtinstall, then builds
-setup.bat       # Windows — run from a VS 2022 Developer Command Prompt
 ```
 
+> **Windows:** `setup.sh` is Linux / macOS only. Install the prerequisites in [GETTING_STARTED.md](./GETTING_STARTED.md#quick-setup), then follow the manual steps below from a **Developer Command Prompt for VS 2022** (or Developer PowerShell) so MSVC and the Windows SDK are on `PATH`.
+
 ### Manual — CMake presets
 
 All day-to-day development uses presets from `fincept-qt/CMakePresets.json`.
```

**File**: `fincept-qt/docs/DATAHUB_TOPICS.md` (modified, +3/-3)
```diff
@@ -76,12 +76,12 @@ plan's risk-mitigation cadence).
 
 | Pattern | Producer | TTL | Min interval | Notes |
 |---|---|---|---|---|
-| `geopolitics:events` | `GeopoliticsService` | 2 min | 30 s | Conflict monitor news events (default params). Payload: `EventsPage` (events sorted newest-first + pagination + credits metering). |
+| `geopolitics:events` | `GeopoliticsService` | 2 min | 30 s | Conflict monitor news events (default params). Payload: `EventsPage` (events sorted newest-first + pagination + credits metering). Only an unfiltered first-page fetch publishes here; filtered/paged Monitor queries are delivered to their caller via `events_loaded` and matched by `EventsPage::request_key`. |
 | `geopolitics:countries` | `GeopoliticsService` | 10 min | 60 s | Unique country list w/ event counts |
 | `geopolitics:categories` | `GeopoliticsService` | 10 min | 60 s | Unique event category list |
 | `geopolitics:cities` | `GeopoliticsService` | 10 min | 60 s | Cities with extracted coordinates |
 | `geopolitics:hdx:<context>` | `GeopoliticsService` | 1 h | 60 s | `<context>` = conflicts, humanitarian, country:<iso>, topic:<slug>, search:<q> |
-| `geopolitics:trade:<kind>` | `GeopoliticsService` | 15 min (push-only) | — | `<kind>` = benefits, restrictions |
+| `geopolitics:trade:<kind>` | `GeopoliticsService` | 15 min (push-only) | — | `<kind>` = benefits, restrictions, blocs, barrier |
 | `geopolitics:geolocation` | `GeopoliticsService` | 15 min (push-only) | — | Extracted coords from headline batch |
 | `geopolitics:relationship_graph:<ticker>` | `RelationshipMapService` | 10 min | 2 min | yfinance-backed corporate relationship snapshot |
 
@@ -171,7 +171,7 @@ Terminal-wide topics — same numbers shown to every user, no `<pubkey>` segment
 |---|---|---|---|---|
 | `treasury:buyback_epoch` | `BuybackBurnService` | 60 s | 30 s | Current epoch summary. Shape: `BuybackEpoch{epoch_no, start/end_ts_ms, revenue_total/subs/predmkt/misc_usd, buyback_usd, staker_yield_usd, treasury_topup_usd, fncpt_bought/burned_raw, fncpt_decimals, avg_buy_price_usd, burn_signature, is_mock}`. The three USD splits (`buyback`, `staker_yield`, `treasury_topup`) implement the plan §5.4 50/25/25 distribution; the worker chooses the actual percentages per epoch. `burn_signature` is base58 — `BuybackBurnPanel` opens it on Solscan. |
 | `treasury:burn_total` | `BuybackBurnService` | 5 min | 60 s | All-time totals. Shape: `BurnTotal{total_burned_raw, supply_remaining_raw, decimals, spent_on_buyback_usd, is_mock}`. |
-| `treasury:supply_history` | `BuybackBurnService` | 1 h | 5 min | 12-month time-series for the supply chart. Shape: `QVector<SupplyHistoryPoint{ts_ms, total_raw, circulating_raw, burned_raw, decimals}>`. Producer publishes the whole vector on every refresh; subscribers (`SupplyChartPanel`) replace the series wholesale. |
+| `treasury:supply_history` | `BuybackBurnService` | 1 h | 5 min | 12-month time-series for the supply chart. Shape: `QVector<SupplyHistoryPoint{ts_ms, total_raw, circulating_raw, burned_raw, decimals, is_mock}>` (`is_mock` marks the built-in demo series; the chart's DEMO pill reads it). Producer publishes the whole vector on every refresh; subscribers (`SupplyChartPanel`) replace the series wholesale. |
 | `treasury:reserves` | `TreasuryService` | 5 min | 60 s | Current SOL + USDC holdings of the treasury multisig. Source: `SolanaRpcClient::get_sol_balance` + `get_token_balance(USDC mint)` against the pubkey in SecureStorage `fincept.treasury_pubkey`. SOL→USD price is peeked from `market:price:token:<wSOL>` so we don't double-fetch. Shape: `TreasuryReserves{pubkey_b58, sol_lamports, usdc_amount, sol_usd_price, total_usd, multisig_label, multisig_url, is_mock}`. |
 | `treasury:runway` | `TreasuryService` | 5 min | 60 s | Months of runway at current burn. Computed as `total_usd / monthly_opex_usd`; opex from SecureStorage `fincept.treasury_monthly_opex_usd` (default $100k). Shape: `TreasuryRunway{total_usd, monthly_opex_usd, months, is_mock}`. Re-derived in lock-step with `treasury:reserves`. |
 
```

**File**: `fincept-qt/docs/translations/README.zh-TW.md` (modified, +1/-2)
```diff
@@ -111,8 +111,7 @@ cd FinceptTerminal
 # Linux / macOS — 一鍵建置
 chmod +x setup.sh && ./setup.sh
 
-# Windows（在 VS 2022 Developer Command Prompt 執行）
-setup.bat
+# Windows：沒有一鍵建置腳本，請依 docs/GETTING_STARTED.md 手動建置（在 VS 2022 Developer Command Prompt 執行）
 ```
 
 ### 安裝 Python 相依套件
```

**File**: `fincept-qt/scripts/Analytics/backtesting/backtestingpy/backtestingpy_provider.py` (modified, +12/-1)
```diff
@@ -1187,6 +1187,17 @@ def _extract_performance_metrics(self, stats) -> PerformanceMetrics:
         sortino = self._safe_stat(stats, 'Sortino Ratio', 0)
         calmar = self._safe_stat(stats, 'Calmar Ratio', 0)
 
+        # backtesting.py reports an unbounded profit factor (inf / NaN) when there is no losing
+        # trade; _safe_stat flattened that to 0, i.e. "worst possible" for the best possible run.
+        # Keep it as +inf (JSON null -> the UI shows "∞").
+        profit_factor = self._safe_stat(stats, 'Profit Factor', 0)
+        try:
+            raw_pf = float(stats.get('Profit Factor', 0))
+            if np.isposinf(raw_pf) or (np.isnan(raw_pf) and winning_trades > 0 and losing_trades == 0):
+                profit_factor = float('inf')
+        except (TypeError, ValueError):
+            pass
+
         return PerformanceMetrics(
             total_return=self._safe_stat(stats, 'Return [%]', 0) / 100.0,
             annualized_return=ann_return,
@@ -1195,7 +1206,7 @@ def _extract_performance_metrics(self, stats) -> PerformanceMetrics:
             max_drawdown=abs(self._safe_stat(stats, 'Max. Drawdown [%]', 0)) / 100.0,
             win_rate=win_rate,
             loss_rate=1.0 - win_rate,
-            profit_factor=self._safe_stat(stats, 'Profit Factor', 0),
+            profit_factor=profit_factor,
             volatility=volatility,
             calmar_ratio=calmar,
             total_trades=total_trades,
```

**File**: `fincept-qt/scripts/Analytics/backtesting/base/advanced_metrics.py` (modified, +19/-9)
```diff
@@ -20,6 +20,7 @@ def calculate_all(
     benchmark_series: Optional[np.ndarray] = None,
     risk_free_rate: float = 0.0,
     dates: Optional[List[str]] = None,
+    periods_per_year: float = 252.0,
 ) -> Dict[str, Any]:
     """
     Calculate all advanced metrics from equity curve and optional benchmark.
@@ -29,6 +30,9 @@ def calculate_all(
         benchmark_series: Daily benchmark equity values (same length), or None
         risk_free_rate: Annual risk-free rate (default 0)
         dates: ISO date strings corresponding to equity_series
+        periods_per_year: bars per year of equity_series (252 daily equities, 365 24x7
+            daily, ~1764 for 1h US bars...). Annualisation basis for alpha / tracking
+            error / information ratio and the rolling Sharpe / volatility series.
 
     Returns:
         Dictionary with all advanced metrics (camelCase keys for JSON)
@@ -43,7 +47,8 @@ def calculate_all(
     if len(returns) < 2:
         return _empty_metrics()
 
-    daily_rf = risk_free_rate / 252.0
+    ppy = float(periods_per_year) if periods_per_year and periods_per_year > 0 else 252.0
+    daily_rf = risk_free_rate / ppy
 
     # --- Risk Metrics ---
     var95 = float(np.percentile(returns, 5))
@@ -94,8 +99,8 @@ def calculate_all(
     monthly_returns = _calculate_monthly_returns(equity_series, dates)
 
     # --- Rolling Metrics ---
-    rolling_sharpe = _rolling_sharpe(returns, window=60, rf=daily_rf, dates=dates)
-    rolling_volatility = _rolling_volatility(returns, window=20, dates=dates)
+    rolling_sharpe = _rolling_sharpe(returns, window=60, rf=daily_rf, dates=dates, ppy=ppy)
+    rolling_volatility = _rolling_volatility(returns, window=20, dates=dates, ppy=ppy)
     rolling_drawdown = _rolling_drawdown(equity_series, dates=dates)
 
     # --- Benchmark-relative metrics ---
@@ -118,16 +123,16 @@ def calculate_all(
             # Alpha (annualized Jensen's alpha)
             benchmark_alpha = float(
                 (np.mean(returns[:len(bench_returns)]) - daily_rf -
-                 benchmark_beta * (np.mean(bench_returns) - daily_rf)) * 252
+                 benchmark_beta * (np.mean(bench_returns) - daily_rf)) * ppy
             )
 
             # Tracking Error
             active_returns = returns[:len(bench_returns)] - bench_returns
-            tracking_error = float(np.std(active_returns, ddof=1) * np.sqrt(252))
+            tracking_error = float(np.std(active_returns, ddof=1) * np.sqrt(ppy))
 
             # Information Ratio
             if tracking_error > 1e-10:
-                information_ratio = float(np.mean(active_returns) * 252 / tracking_error)
+                information_ratio = float(np.mean(active_returns) * ppy / tracking_error)
 
             # R-squared
             correlation = np.corrcoef(returns[:len(bench_returns)], bench_returns)[0, 1]
@@ -227,7 +232,10 @@ def _calculate_monthly_returns(
                 monthly_data[py] = {}
             ret = (prev_equity - month_start_equity) / month_start_equity if month_start_equity > 0 else 0
             monthly_data[py][pm] = ret
-            month_start_equity = equity_series[i]
+            # The next month's base is THIS month's closing equity. It was the new month's
+            # first bar, which dropped every month's first-bar return and made the monthly
+            # figures fail to compound to the total return.
+            month_start_equity = prev_equity
 
         prev_month = current_key
         prev_equity = equity_series[i]
@@ -263,14 +271,15 @@ def _rolling_sharpe(
     window: int = 60,
     rf: float = 0.0,
     dates: Optional[List[str]] = None,
+    ppy: float = 252.0,
 ) -> List[Dict[str, Any]]:
     """Calculate rolling Sharpe ratio"""
     result = []
     for i in range(window, len(returns)):
         window_returns = returns[i - window:i]
         excess = window_returns - rf
         std = np.std(excess, ddof=1)
-        sharpe = float(np.mean(excess) / std * np.sqrt(252)) if std > 1e-10 else 0.0
+        sharpe = float(np.mean(excess) / std * np.sqrt(ppy)) if std > 1e-10 else 0.0
         date = dates[i + 1] if dates and i + 1 < len(dates) else str(i)
         result.append({'date': str(date).split('T')[0], 'value': round(sharpe, 4)})
     return result
@@ -280,12 +289,13 @@ def _rolling_volatility(
     returns: np.ndarray,
     window: int = 20,
     dates: Optional[List[str]] = None,
+    ppy: float = 252.0,
 ) -> List[Dict[str, Any]]:
     """Calculate rolling annualized volatility"""
     result = []
     for i in range(window, len(returns)):
         window_returns = returns[i - window:i]
-        vol = float(np.std(window_returns, ddof=1) * np.sqrt(252))
+        vol = float(np.std(window_returns, ddof=1) * np.sqrt(ppy))
         date = dates[i + 1] if dates and i + 1 < len(dates) else str(i)
         result.append({'date': str(date).split('T')[0], 'value': round(vol, 6)})
     return result
```

**File**: `fincept-qt/scripts/Analytics/backtesting/base/fincept_strategy_runner.py` (modified, +55/-8)
```diff
@@ -68,14 +68,27 @@ def load_strategy_class(self, strategy_id: str):
         # Execute strategy file
         exec(code, namespace)
 
-        # Find the algorithm class (inherits from QCAlgorithm)
-        strategy_class = None
-        for name, obj in namespace.items():
-            if (isinstance(obj, type) and
-                issubclass(obj, QCAlgorithm) and
-                obj is not QCAlgorithm):
-                strategy_class = obj
-                break
+        # Find the algorithm class (inherits from QCAlgorithm).
+        # The strategy file starts with `from AlgorithmImports import *`, which drags several
+        # unrelated QCAlgorithm subclasses into `namespace` (QCAlgorithmFramework,
+        # OptionAssignmentRegressionAlgorithm, ...). Taking the FIRST subclass found therefore
+        # instantiated one of those instead of the strategy, whose empty initialize() never
+        # subscribed anything: nearly every backtest ran flat with zero trades. Only classes
+        # DEFINED by the strategy code (exec leaves their __module__ at the namespace's
+        # __name__, 'builtins') count; the last one defined wins.
+        own_module = namespace.get('__name__', 'builtins')
+        defined = [obj for obj in namespace.values()
+                   if isinstance(obj, type) and issubclass(obj, QCAlgorithm) and obj is not QCAlgorithm
+                   and getattr(obj, '__module__', None) == own_module]
+        strategy_class = defined[-1] if defined else None
+        if strategy_class is None:
+            # Unusual layout (class imported from a helper module): fall back to the old scan.
+            for name, obj in namespace.items():
+                if (isinstance(obj, type) and
+                    issubclass(obj, QCAlgorithm) and
+                    obj is not QCAlgorithm):
+                    strategy_class = obj
+                    break
 
         if not strategy_class:
             raise ValueError(f"No QCAlgorithm subclass found in {info['path']}")
@@ -195,6 +208,7 @@ def execute_strategy(self, strategy_id: str, params: Dict[str, Any]) -> Dict[str
                     all_timestamps.add(bar['time'])
 
             timestamps = sorted(all_timestamps)
+            stamped_orders = set()  # tickets already given their bar time (see below)
 
             for timestamp_str in timestamps:
                 timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
@@ -219,17 +233,34 @@ def execute_strategy(self, strategy_id: str, params: Dict[str, Any]) -> Dict[str
                         slice_data.add(symbol_str, bar)
 
                 # Update securities with current prices
+                bar_prices = {}
                 for symbol_str in slice_data._data.keys():
                     if symbol_str in algorithm.securities:
                         price = slice_data[symbol_str].close
                         algorithm.securities[symbol_str].update_price(price)
+                        bar_prices[symbol_str] = price
+                # Mark open positions to this bar's close. The portfolio only re-priced a
+                # holding at the moment it was FILLED, so equity stayed flat between trades
+                # (a buy-and-hold year reported exactly the starting capital).
+                if bar_prices and hasattr(algorithm.portfolio, 'update_market_prices'):
+                    algorithm.portfolio.update_market_prices(bar_prices)
 
                 # Call OnData
                 if hasattr(algorithm, 'on_data'):
                     algorithm.on_data(slice_data)
                 elif hasattr(algorithm, 'OnData'):
                     algorithm.OnData(slice_data)
 
+                # Orders are stamped with the wall clock when created; give the ones this bar
+                # produced the BAR's time so fills carry their simulated date (not "today").
+                for oid, ticket in algorithm.transactions._orders.items():
+                    if oid not in stamped_orders:
+                        stamped_orders.add(oid)
+                        try:
+                            ticket.time = timestamp
+                        except Exception:
+                            pass
+
                 # Record equity
                 portfolio_value = algorithm.portfolio.total_portfolio_value
                 equity_curve.append({
@@ -252,10 +283,26 @@ def execute_strategy(self, strategy_id: str, params: Dict[str, Any]) -> Dict[str
                         'type': order.order_type.name
                     })
 
+            # Positions still open at the end of the run (symbol/qty/avg cost/last price) so
+            # callers can report them; additive key, existing consumers ignore it.
+            open_positions = []
+            try:
+                for ticker, h in algorithm.portfolio.get_holdings_summary().items():
+                    open_positions.append({
+                        'symbol': ticker,
+                        'quantity': h['quantity'],
+         
```

---

### Incident Patch 2: `33378076` (2026-10-01)
**Commit Message**: Merge pull request #396 from LudwigJMarx/fix/395-indicator-series-nan-seed

fix(algo): seed sma_series/ema_series past a NaN prefix

**File**: `fincept-qt/src/algo_engine/IndicatorEngine.cpp` (modified, +24/-8)
```diff
@@ -27,16 +27,31 @@ void IndicatorEngine::extract_arrays(const QVector<OhlcvCandle>& candles, QVecto
     }
 }
 
+// Both helpers emit a series whose first period-1 samples are NaN, and callers
+// feed exactly such a series straight back in (Stochastic's %D over %K, MACD's
+// signal line over the MACD line, DEMA/TEMA's EMA of an EMA). Seeding the
+// window at index 0 pulls those NaNs into the running sum, and a NaN never
+// leaves a rolling sum or an EMA recursion again, so the whole output is NaN
+// however long the input is. Seed from the first finite sample instead.
+static int first_finite(const QVector<double>& src) {
+    const int n = src.size();
+    int i = 0;
+    while (i < n && !std::isfinite(src[i]))
+        ++i;
+    return i;
+}
+
 QVector<double> IndicatorEngine::sma_series(const QVector<double>& src, int period) {
     const int n = src.size();
     QVector<double> out(n, std::numeric_limits<double>::quiet_NaN());
-    if (n < period)
+    const int start = first_finite(src);
+    if (n - start < period)
         return out;
     double sum = 0;
-    for (int i = 0; i < period; ++i)
+    for (int i = start; i < start + period; ++i)
         sum += src[i];
-    out[period - 1] = sum / period;
-    for (int i = period; i < n; ++i) {
+    out[start + period - 1] = sum / period;
+    for (int i = start + period; i < n; ++i) {
         sum += src[i] - src[i - period];
         out[i] = sum / period;
     }
@@ -46,14 +61,15 @@ QVector<double> IndicatorEngine::sma_series(const QVector<double>& src, int peri
 QVector<double> IndicatorEngine::ema_series(const QVector<double>& src, int period) {
     const int n = src.size();
     QVector<double> out(n, std::numeric_limits<double>::quiet_NaN());
-    if (n < period)
+    const int start = first_finite(src);
+    if (n - start < period)
         return out;
     double sum = 0;
-    for (int i = 0; i < period; ++i)
+    for (int i = start; i < start + period; ++i)
         sum += src[i];
-    out[period - 1] = sum / period;
+    out[start + period - 1] = sum / period;
     double mult = 2.0 / (period + 1);
-    for (int i = period; i < n; ++i)
+    for (int i = start + period; i < n; ++i)
         out[i] = (src[i] - out[i - 1]) * mult + out[i - 1];
     return out;
 }
```

**File**: `fincept-qt/tests/CMakeLists.txt` (modified, +10/-2)
```diff
@@ -23,7 +23,7 @@
 # signal about the unit, not about this file: extract the pure logic into a small
 # header (or a leaf .cpp) and test that. Do not grow the link line.
 #
-# Current cost of the whole suite: 3 executables, 5 translation units.
+# Current cost of the whole suite: 4 executables, 7 translation units.
 # ─────────────────────────────────────────────────────────────────────────────
 
 # Qt Test ships with every Qt installation, so this adds no new dependency.
@@ -119,4 +119,12 @@ fincept_add_test(tst_order_validator
     tst_order_validator.cpp
     "${PROJECT_SOURCE_DIR}/src/trading/OrderValidator.cpp")
 
-message(STATUS "Fincept tests: tst_broker_modify_fields, tst_result, tst_order_validator")
+# src/algo_engine/IndicatorEngine.{h,cpp}: the .cpp includes only its own
+# header, which includes only algo_engine/AlgoEngineTypes.h (Qt Core types +
+# plain structs, no .cpp of its own). One extra TU, same shape as the validator
+# suite above.
+fincept_add_test(tst_indicator_engine
+    tst_indicator_engine.cpp
+    "${PROJECT_SOURCE_DIR}/src/algo_engine/IndicatorEngine.cpp")
+
+message(STATUS "Fincept tests: tst_broker_modify_fields, tst_result, tst_order_validator, tst_indicator_engine")
```

**File**: `fincept-qt/tests/tst_indicator_engine.cpp` (added, +204/-0)
```diff
@@ -0,0 +1,204 @@
+// Unit tests for src/algo_engine/IndicatorEngine.{h,cpp}
+//
+// IndicatorEngine.cpp includes only its own header, which includes
+// algo_engine/AlgoEngineTypes.h (Qt Core types + plain aggregate structs, no
+// .cpp of its own). One extra translation unit, no service, network or broker
+// linkage.
+//
+// The headline case is the NaN prefix. sma_series() and ema_series() both emit
+// a series whose first period-1 samples are NaN, and four call sites feed such
+// a series straight back in: DEMA and TEMA (EMA of an EMA), MACD (signal line
+// over the MACD line) and Stochastic (%D over %K). A seed window that starts at
+// index 0 therefore sums NaN, and neither the rolling sum nor the EMA recursion
+// ever recovers. DEMA, TEMA and MACD report "insufficient data" on any history
+// at all, and %D silently degrades to %K.
+
+#include "algo_engine/AlgoEngineTypes.h"
+#include "algo_engine/IndicatorEngine.h"
+
+#include <QJsonObject>
+#include <QString>
+#include <QTest>
+#include <QVector>
+
+#include <cmath>
+
+using fincept::algo::IndicatorEngine;
+using fincept::algo::IndicatorResult;
+using fincept::algo::OhlcvCandle;
+
+namespace {
+
+// A rising series, far longer than any default period in the catalogue
+// (the largest is Ichimoku's senkou = 52). Nothing here is borderline: if an
+// indicator cannot produce a value from 500 bars, it cannot produce one at all.
+QVector<OhlcvCandle> rising_candles(int n = 500) {
+    QVector<OhlcvCandle> out;
+    out.reserve(n);
+    for (int i = 0; i < n; ++i) {
+        OhlcvCandle c;
+        c.open_time = i;
+        c.close_time = i;
+        c.close = 100.0 + i * 0.5;
+        c.open = c.close - 0.25;
+        c.high = c.close + 1.0;
+        c.low = c.close - 1.0;
+        c.volume = 1000;
+        c.is_closed = true;
+        out.append(c);
+    }
+    return out;
+}
+
+// %K oscillates only if the price does. A straight line pins %K to a constant,
+// which would make the %D-equals-%K defect invisible.
+QVector<OhlcvCandle> oscillating_candles(int n = 200) {
+    QVector<OhlcvCandle> out;
+    out.reserve(n);
+    for (int i = 0; i < n; ++i) {
+        OhlcvCandle c;
+        c.open_time = i;
+        c.close_time = i;
+        c.close = 100.0 + 10.0 * std::sin(i * 0.3);
+        c.open = c.close;
+        c.high = c.close + 0.5;
+        c.low = c.close - 0.5;
+        c.volume = 1000;
+        c.is_closed = true;
+        out.append(c);
+    }
+    return out;
+}
+
+QString why(const IndicatorResult& r) {
+    return r.valid ? QStringLiteral("(valid)") : r.error;
+}
+
+} // namespace
+
+class TstIndicatorEngine : public QObject {
+    Q_OBJECT
+
+  private slots:
+    // Baseline: the two helpers work when nobody feeds them a NaN prefix.
+    void sma_and_ema_produce_values();
+
+    // EMA of an EMA.
+    void dema_produces_a_value_from_ample_history();
+    void tema_produces_a_value_from_ample_history();
+
+    // EMA of the MACD line.
+    void macd_produces_a_signal_line_from_ample_history();
+
+    // SMA of %K.
+    void stochastic_d_is_the_average_of_the_last_k_values();
+
+    // The clamp in compute() must keep holding.
+    void unknown_indicator_is_reported_as_such();
+};
+
+void TstIndicatorEngine::sma_and_ema_produce_values() {
+    const auto candles = rising_candles();
+    QJsonObject p;
+    p["period"] = 20;
+
+    const auto sma = IndicatorEngine::compute(QStringLiteral("SMA"), candles, p, QStringLiteral("value"));
+    QVERIFY2(sma.valid, qPrintable(why(sma)));
+    QVERIFY(std::isfinite(sma.current.value(QStringLiteral("value"))));
+
+    const auto ema = IndicatorEngine::compute(QStringLiteral("EMA"), candles, p, QStringLiteral("value"));
+    QVERIFY2(ema.valid, qPrintable(why(ema)));
+    QVERIFY(std::isfinite(ema.current.value(QStringLiteral("value"))));
+}
+
+void TstIndicatorEngine::dema_produces_a_value_from_ample_history() {
+    const auto candles = rising_candles();
+    QJsonObject p;
+    p["period"] = 20; // the catalogue default in AlgoTradingTypes.h
+
+    const auto r = IndicatorEngine::compute(QStringLiteral("DEMA"), candles, p, QStringLiteral("value"));
+    QVERIFY2(r.valid, qPrintable(why(r)));
+    const double v = r.current.value(QStringLiteral("value"));
+    QVERIFY(std::isfinite(v));
+
+    // DEMA exists to cut the lag of a plain EMA. On a strictly rising series it
+    // must therefore sit above it, which also rules out a value that merely
+    // happens to be finite.
+    const auto ema = IndicatorEngine::compute(QStringLiteral("EMA"), candles, p, QStringLiteral("value"));
+    QVERIFY(ema.valid);
+    QVERIFY2(v > ema.current.value(QStringLiteral("value")),
+             qPrintable(QStringLiteral("DEMA %1 <= EMA %2").arg(v).arg(ema.current.value(QStringLiteral("value")))));
+}
+
+void TstIndicatorEngine::tema_produces_a_value_from_ample_history() {
+    const auto candles = rising_candles();
+    QJsonObject p;
+    p["period"] = 20;
+
+    const auto r = IndicatorEngine::compute(Q
```

---

### Incident Patch 3: `fea3d19f` (2026-09-20)
**Commit Message**: fix(algo): seed sma_series/ema_series past a NaN prefix

Both helpers seeded their window at index 0 regardless of what was in
it. Both also emit a series whose first period-1 samples are NaN, and
four call sites feed exactly such a series back in. One NaN in the seed
window makes the seed NaN, and it never leaves the rolling sum
(sum += src[i] - src[i - period]) or the EMA recursion
(out[i] = (src[i] - out[i - 1]) * mult + out[i - 1]) again. The whole
output is NaN however long the input is.

What that cost, with the catalogue defaults from AlgoTradingTypes.h:

  DEMA        never returned a value unless period == 1
  TEMA        never returned a value unless period == 1
  MACD        never returned a value unless slow == 1
  STOCHASTIC  %D silently fell back to %K unless k_period == 1

All four are selectable in the strategy builder.
ConditionEvaluator::operand_value turns the first three into NaN plus
"Insufficient data for ...", so the condition never fires whatever
history is loaded. The fourth is the worse one: a wrong number with no
error at all.

Both helpers now skip a leading run of non-finite samples and seed from
the first finite one. std::isfinite rather than !std::isn

**File**: `fincept-qt/src/algo_engine/IndicatorEngine.cpp` (modified, +24/-8)
```diff
@@ -27,16 +27,31 @@ void IndicatorEngine::extract_arrays(const QVector<OhlcvCandle>& candles, QVecto
     }
 }
 
+// Both helpers emit a series whose first period-1 samples are NaN, and callers
+// feed exactly such a series straight back in (Stochastic's %D over %K, MACD's
+// signal line over the MACD line, DEMA/TEMA's EMA of an EMA). Seeding the
+// window at index 0 pulls those NaNs into the running sum, and a NaN never
+// leaves a rolling sum or an EMA recursion again, so the whole output is NaN
+// however long the input is. Seed from the first finite sample instead.
+static int first_finite(const QVector<double>& src) {
+    const int n = src.size();
+    int i = 0;
+    while (i < n && !std::isfinite(src[i]))
+        ++i;
+    return i;
+}
+
 QVector<double> IndicatorEngine::sma_series(const QVector<double>& src, int period) {
     const int n = src.size();
     QVector<double> out(n, std::numeric_limits<double>::quiet_NaN());
-    if (n < period)
+    const int start = first_finite(src);
+    if (n - start < period)
         return out;
     double sum = 0;
-    for (int i = 0; i < period; ++i)
+    for (int i = start; i < start + period; ++i)
         sum += src[i];
-    out[period - 1] = sum / period;
-    for (int i = period; i < n; ++i) {
+    out[start + period - 1] = sum / period;
+    for (int i = start + period; i < n; ++i) {
         sum += src[i] - src[i - period];
         out[i] = sum / period;
     }
@@ -46,14 +61,15 @@ QVector<double> IndicatorEngine::sma_series(const QVector<double>& src, int peri
 QVector<double> IndicatorEngine::ema_series(const QVector<double>& src, int period) {
     const int n = src.size();
     QVector<double> out(n, std::numeric_limits<double>::quiet_NaN());
-    if (n < period)
+    const int start = first_finite(src);
+    if (n - start < period)
         return out;
     double sum = 0;
-    for (int i = 0; i < period; ++i)
+    for (int i = start; i < start + period; ++i)
         sum += src[i];
-    out[period - 1] = sum / period;
+    out[start + period - 1] = sum / period;
     double mult = 2.0 / (period + 1);
-    for (int i = period; i < n; ++i)
+    for (int i = start + period; i < n; ++i)
         out[i] = (src[i] - out[i - 1]) * mult + out[i - 1];
     return out;
 }
```

---

### Incident Patch 4: `4cf2f1e6` (2026-09-20)
**Commit Message**: test(algo): pin the NaN prefix defect in IndicatorEngine

sma_series() and ema_series() both emit a series whose first period-1
samples are NaN, and four call sites feed such a series straight back
in: compute_dema and compute_tema (EMA of an EMA), compute_macd (signal
line over the MACD line), compute_stochastic (%D over %K).

This commit only records what that costs. Red on the current tree:

  FAIL!  : dema_produces_a_value_from_ample_history() 'r.valid' returned FALSE. (Insufficient data for DEMA)
  FAIL!  : tema_produces_a_value_from_ample_history() 'r.valid' returned FALSE. (Insufficient data for TEMA)
  FAIL!  : macd_produces_a_signal_line_from_ample_history() 'r.valid' returned FALSE. (Insufficient data for MACD)
  FAIL!  : stochastic_d_is_the_average_of_the_last_k_values() Compared doubles are not the same (fuzzy compare)
     Actual   (d)                         : 40.5600865331
     Expected ((k[0] + k[1] + k[2]) / 3.0): 59.3901506623
  Totals: 4 passed, 4 failed, 0 skipped, 0 blacklisted, 6ms

500 bars at period 20 is far past any catalogue default, so the three
"insufficient data" cases are not a data problem.

The %D case reads %K through candles.mid(0, n - back), the 

**File**: `fincept-qt/tests/CMakeLists.txt` (modified, +10/-2)
```diff
@@ -23,7 +23,7 @@
 # signal about the unit, not about this file: extract the pure logic into a small
 # header (or a leaf .cpp) and test that. Do not grow the link line.
 #
-# Current cost of the whole suite: 3 executables, 5 translation units.
+# Current cost of the whole suite: 4 executables, 7 translation units.
 # ─────────────────────────────────────────────────────────────────────────────
 
 # Qt Test ships with every Qt installation, so this adds no new dependency.
@@ -119,4 +119,12 @@ fincept_add_test(tst_order_validator
     tst_order_validator.cpp
     "${PROJECT_SOURCE_DIR}/src/trading/OrderValidator.cpp")
 
-message(STATUS "Fincept tests: tst_broker_modify_fields, tst_result, tst_order_validator")
+# src/algo_engine/IndicatorEngine.{h,cpp}: the .cpp includes only its own
+# header, which includes only algo_engine/AlgoEngineTypes.h (Qt Core types +
+# plain structs, no .cpp of its own). One extra TU, same shape as the validator
+# suite above.
+fincept_add_test(tst_indicator_engine
+    tst_indicator_engine.cpp
+    "${PROJECT_SOURCE_DIR}/src/algo_engine/IndicatorEngine.cpp")
+
+message(STATUS "Fincept tests: tst_broker_modify_fields, tst_result, tst_order_validator, tst_indicator_engine")
```

**File**: `fincept-qt/tests/tst_indicator_engine.cpp` (added, +204/-0)
```diff
@@ -0,0 +1,204 @@
+// Unit tests for src/algo_engine/IndicatorEngine.{h,cpp}
+//
+// IndicatorEngine.cpp includes only its own header, which includes
+// algo_engine/AlgoEngineTypes.h (Qt Core types + plain aggregate structs, no
+// .cpp of its own). One extra translation unit, no service, network or broker
+// linkage.
+//
+// The headline case is the NaN prefix. sma_series() and ema_series() both emit
+// a series whose first period-1 samples are NaN, and four call sites feed such
+// a series straight back in: DEMA and TEMA (EMA of an EMA), MACD (signal line
+// over the MACD line) and Stochastic (%D over %K). A seed window that starts at
+// index 0 therefore sums NaN, and neither the rolling sum nor the EMA recursion
+// ever recovers. DEMA, TEMA and MACD report "insufficient data" on any history
+// at all, and %D silently degrades to %K.
+
+#include "algo_engine/AlgoEngineTypes.h"
+#include "algo_engine/IndicatorEngine.h"
+
+#include <QJsonObject>
+#include <QString>
+#include <QTest>
+#include <QVector>
+
+#include <cmath>
+
+using fincept::algo::IndicatorEngine;
+using fincept::algo::IndicatorResult;
+using fincept::algo::OhlcvCandle;
+
+namespace {
+
+// A rising series, far longer than any default period in the catalogue
+// (the largest is Ichimoku's senkou = 52). Nothing here is borderline: if an
+// indicator cannot produce a value from 500 bars, it cannot produce one at all.
+QVector<OhlcvCandle> rising_candles(int n = 500) {
+    QVector<OhlcvCandle> out;
+    out.reserve(n);
+    for (int i = 0; i < n; ++i) {
+        OhlcvCandle c;
+        c.open_time = i;
+        c.close_time = i;
+        c.close = 100.0 + i * 0.5;
+        c.open = c.close - 0.25;
+        c.high = c.close + 1.0;
+        c.low = c.close - 1.0;
+        c.volume = 1000;
+        c.is_closed = true;
+        out.append(c);
+    }
+    return out;
+}
+
+// %K oscillates only if the price does. A straight line pins %K to a constant,
+// which would make the %D-equals-%K defect invisible.
+QVector<OhlcvCandle> oscillating_candles(int n = 200) {
+    QVector<OhlcvCandle> out;
+    out.reserve(n);
+    for (int i = 0; i < n; ++i) {
+        OhlcvCandle c;
+        c.open_time = i;
+        c.close_time = i;
+        c.close = 100.0 + 10.0 * std::sin(i * 0.3);
+        c.open = c.close;
+        c.high = c.close + 0.5;
+        c.low = c.close - 0.5;
+        c.volume = 1000;
+        c.is_closed = true;
+        out.append(c);
+    }
+    return out;
+}
+
+QString why(const IndicatorResult& r) {
+    return r.valid ? QStringLiteral("(valid)") : r.error;
+}
+
+} // namespace
+
+class TstIndicatorEngine : public QObject {
+    Q_OBJECT
+
+  private slots:
+    // Baseline: the two helpers work when nobody feeds them a NaN prefix.
+    void sma_and_ema_produce_values();
+
+    // EMA of an EMA.
+    void dema_produces_a_value_from_ample_history();
+    void tema_produces_a_value_from_ample_history();
+
+    // EMA of the MACD line.
+    void macd_produces_a_signal_line_from_ample_history();
+
+    // SMA of %K.
+    void stochastic_d_is_the_average_of_the_last_k_values();
+
+    // The clamp in compute() must keep holding.
+    void unknown_indicator_is_reported_as_such();
+};
+
+void TstIndicatorEngine::sma_and_ema_produce_values() {
+    const auto candles = rising_candles();
+    QJsonObject p;
+    p["period"] = 20;
+
+    const auto sma = IndicatorEngine::compute(QStringLiteral("SMA"), candles, p, QStringLiteral("value"));
+    QVERIFY2(sma.valid, qPrintable(why(sma)));
+    QVERIFY(std::isfinite(sma.current.value(QStringLiteral("value"))));
+
+    const auto ema = IndicatorEngine::compute(QStringLiteral("EMA"), candles, p, QStringLiteral("value"));
+    QVERIFY2(ema.valid, qPrintable(why(ema)));
+    QVERIFY(std::isfinite(ema.current.value(QStringLiteral("value"))));
+}
+
+void TstIndicatorEngine::dema_produces_a_value_from_ample_history() {
+    const auto candles = rising_candles();
+    QJsonObject p;
+    p["period"] = 20; // the catalogue default in AlgoTradingTypes.h
+
+    const auto r = IndicatorEngine::compute(QStringLiteral("DEMA"), candles, p, QStringLiteral("value"));
+    QVERIFY2(r.valid, qPrintable(why(r)));
+    const double v = r.current.value(QStringLiteral("value"));
+    QVERIFY(std::isfinite(v));
+
+    // DEMA exists to cut the lag of a plain EMA. On a strictly rising series it
+    // must therefore sit above it, which also rules out a value that merely
+    // happens to be finite.
+    const auto ema = IndicatorEngine::compute(QStringLiteral("EMA"), candles, p, QStringLiteral("value"));
+    QVERIFY(ema.valid);
+    QVERIFY2(v > ema.current.value(QStringLiteral("value")),
+             qPrintable(QStringLiteral("DEMA %1 <= EMA %2").arg(v).arg(ema.current.value(QStringLiteral("value")))));
+}
+
+void TstIndicatorEngine::tema_produces_a_value_from_ample_history() {
+    const auto candles = rising_candles();
+    QJsonObject p;
+    p["period"] = 20;
+
+    const auto r = IndicatorEngine::compute(Q
```

---

### Incident Patch 5: `ec88590a` (2026-08-31)
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
+imgs = [n.firstChild.nodeValue.strip() for n in dom.getElementsByTagName("image") if n.firstChild]
+ck(len(imgs) > 0, f"{len(imgs)} screenshot URLs")
+for u in imgs:
+    ck("/main/" not in u and "/master/" not in u, f"pinned (not a branch): .../{u.rsplit('/',1)[-1]}")
+
+print("[6] newest listed release matches what the manifest builds")
+rels = [r.getAttribute("version") for r in dom.getElementsByTagName("release")]
+built = [s.get("tag") for _, s in srcs if "FinceptTerminal.git" in s["url"]][0].lstrip("v")
+ck(bool(rels), f"releases listed: {rels[:3]}")
+ck(rels and rels[0] == built, f"newest release {rels[0] if rels else None} == built version {built}")
+for r in dom.getElementsByTagName("release"):
+    ck(bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", r.getAttribute("date"))),
+       f"release {r.getAttribute('version')} date is ISO-8601")
+
+print("[7] desktop entry")
+dp = os.path.join(D, f"{APPID}.desktop")
+kv = dict(l.split("=", 1) for l in io.open(dp, encoding="utf-8").read().splitli
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

**File**: `fincept-qt/src/trading/brokers/tickerall/TickerAllBroker.h` (modified, +2/-1)
```diff
@@ -85,7 +85,8 @@ class TickerAllBroker : public IBroker {
                                                    const QString& resolution, const QString& from_date,
                                                    const QString& to_date) override;
 
-    // Streaming deferred, same as IciciDirectBroker. TickerAll does expose a
+    // Streaming genuinely is deferred here (unlike IciciDirectBroker, whose
+    // socket shipped alongside its REST surface). TickerAll does expose a
     // WebSocket (wss://api.tickerall.com/v1/stream: ticks, positions, orders),
     // and wiring an adapter here is the natural follow-up — it would also let
     // get_quotes() serve real streamed bid/ask instead of the per-symbol M1
```

---

### Incident Patch 6: `8b665804` (2026-08-31)
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

**File**: `fincept-qt/packaging/linux/AppImageBuilder.yml` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ AppDir:
     id: com.fincept.terminal
     name: Fincept Terminal
     icon: fincept-terminal
-    version: !ENV ${FINCEPT_VERSION:-4.4.1}
+    version: !ENV ${FINCEPT_VERSION:-4.5.0}
     exec: usr/bin/FinceptTerminal
     exec_args: $@
 
@@ -56,6 +56,6 @@ AppDir:
 AppImage:
   arch: x86_64
   comp: xz
-  file_name: FinceptTerminal-!ENV ${FINCEPT_VERSION:-4.4.1}-x86_64.AppImage
+  file_name: FinceptTerminal-!ENV ${FINCEPT_VERSION:-4.5.0}-x86_64.AppImage
   sign-key: None
   update-information: gh-releases-zsync|Fincept-Corporation|FinceptTerminal|latest|FinceptTerminal-*x86_64.AppImage.zsync
```

**File**: `fincept-qt/packaging/linux/fincept-terminal.appdata.xml` (modified, +5/-0)
```diff
@@ -28,6 +28,11 @@
     <binary>FinceptTerminal</binary>
   </provides>
   <releases>
+    <release version="4.5.0" date="2026-08-31">
+      <description>
+        <p>Version 4.5.0 — Fixes AI tool calling with Google Gemini: around 150 tools that take a free-form options object were being advertised to Gemini as taking no arguments, so they could be called but never given any input. The assistant now runs a turn's independent tool calls in parallel, while tools that change something still run in order. Long-running work (backtests, quant modules, agent runs) hands back a job you can watch and cancel instead of freezing the conversation, now across ~190 tools rather than a dozen. Tool sequences gain a time limit alongside the step limit and report which ran out. Fixes the AstraFlow providers failing to resolve their endpoint when the base URL was cleared.</p>
+      </description>
+    </release>
     <release version="4.4.1" date="2026-08-19">
       <description>
         <p>Version 4.4.1 — Adds the TickerAll (MetaTrader 5) broker integration for linking and trading MT5 accounts. Python runtime provisioning is more reliable on first run, and the unused FinRL analytics module and its heavy dependencies have been removed.</p>
```

**File**: `fincept-qt/scripts/agents/rdagents/mcp_server.py` (modified, +478/-58)
```diff
@@ -23,7 +23,9 @@
 import ast
 import json
 import logging
+import math
 import os
+import sys
 from datetime import datetime, timedelta
 from typing import Any
 
@@ -99,13 +101,21 @@ def _compile_factor_expr(expr: str):
 # ---------------------------------------------------------------------------
 
 MCP_SERVER_AVAILABLE = False
+# Which FastMCP is in use. The two packages export the same class name and the
+# same decorators, but they do NOT agree on how a server is started, so the
+# serving code has to know which one it got. See _serve().
+#   "mcp"     — the official SDK (`pip install mcp`), FastMCP under mcp.server
+#   "fastmcp" — the standalone package (`pip install fastmcp`)
+MCP_IMPL = ""
 try:
     from mcp.server.fastmcp import FastMCP
     MCP_SERVER_AVAILABLE = True
+    MCP_IMPL = "mcp"
 except ImportError:
     try:
         from fastmcp import FastMCP  # type: ignore
         MCP_SERVER_AVAILABLE = True
+        MCP_IMPL = "fastmcp"
     except ImportError:
         FastMCP = None  # type: ignore
 
@@ -124,6 +134,144 @@ def _compile_factor_expr(expr: str):
     pass
 
 
+# ---------------------------------------------------------------------------
+# Macro indicator catalogue (economics_data)
+# ---------------------------------------------------------------------------
+# Three kinds of indicator, and the difference is the whole point: a caller
+# cannot interpret a number without knowing which kind produced it.
+#
+#   market — the ticker *is* the indicator.   vix -> ^VIX really is the VIX.
+#   proxy  — the ticker is a tradeable stand-in whose price is NOT the
+#            statistic. ^VXX is a volatility ETN; its ~5200 has no reading as
+#            an unemployment rate. Presenting it unlabelled next to a market
+#            value invites exactly that misreading.
+#   static — a constant baked in here (or via env override), not fetched.
+#
+# These live at module scope, not inside build_mcp_server(), so the valid-name
+# list has exactly one home. It previously had three — the two dicts, a
+# hardcoded default list, and the docstring — and the latter two had already
+# drifted: `nasdaq` and `dow` were fetchable but undocumented, so a caller had
+# no way to learn they existed. Derive, don't restate.
+
+INDICATOR_TICKERS: dict[str, str] = {
+    "treasury_10y": "^TNX",
+    "treasury_2y":  "^IRX",
+    "vix":          "^VIX",
+    "dxy":          "DX-Y.NYB",
+    "oil_wti":      "CL=F",
+    "gold":         "GC=F",
+    "sp500":        "^GSPC",
+    "nasdaq":       "^IXIC",
+    "dow":          "^DJI",
+}
+
+# Market proxies for series with no yfinance ticker. Each MUST carry a note
+# saying what the number actually is — that is the entire reason this table is
+# separate from INDICATOR_TICKERS rather than merged into it.
+FRED_PROXIES: dict[str, str] = {
+    "cpi":          "RINF",
+    "unemployment": "^VXX",
+}
+
+PROXY_NOTES: dict[str, str] = {
+    "cpi": (
+        "PROXY, not the CPI. This is the market price of RINF (ProShares "
+        "Inflation Expectations ETF), a tradeable read on expected inflation. "
+        "It is not a CPI index level or an inflation rate. For the actual "
+        "series use FRED CPIAUCSL."
+    ),
+    "unemployment": (
+        "PROXY, and a poor one. This is the market price of ^VXX (a "
+        "short-term VIX futures ETN): a risk-sentiment gauge with no "
+        "unemployment content whatsoever. Do not read it as an unemployment "
+        "rate. For the actual series use FRED UNRATE."
+    ),
+}
+
+# Constants, with an env override. `note` is surfaced verbatim to the caller.
+STATIC_INDICATORS: dict[str, tuple[str, str]] = {
+    "fed_rate":   ("FED_RATE_OVERRIDE",   "5.25"),
+    "gdp_growth": ("GDP_GROWTH_OVERRIDE", "2.8"),
+}
+
+
+def valid_indicators() -> list[str]:
+    """Every name economics_data accepts, in a stable documented order."""
+    return (
+        list(INDICATOR_TICKERS)
+        + list(FRED_PROXIES)
+        + list(STATIC_INDICATORS)
+    )
+
+
+def resolve_indicator(name: str) -> tuple[str, str] | None:
+    """Map a caller-supplied indicator name to ``(kind, key)``.
+
+    Returns None when the name matches nothing — which is the caller's cue to
+    report it rather than drop it. Lookup is case-insensitive and strips
+    surrounding whitespace: an LLM writing the acronym as "CPI" is asking for
+    the same series as "cpi", and silently failing that is the single most
+    likely way to trigger the empty-result confusion this catalogue exists to
+    prevent.
+    """
+    key = (name or "").strip().lower()
+    if key in INDICATOR_TICKERS:
+        return ("market", key)
+    if key in FRED_PROXIES:
+        return ("proxy", key)
+    if key in STATIC_INDICATORS:
+        return ("static", key)
+    return None
+
+
+# ---------------------------------------------------------------------------
+# Price-frame hygiene
+# ---------------------------------------------------------------------------
+#
+# yfinance emit
```

---

### Incident Patch 7: `5f35156a` (2026-08-31)
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

### Incident Patch 8: `433c0d94` (2026-08-31)
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

### Incident Patch 9: `e009a48e` (2026-08-30)
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

### Incident Patch 10: `925c293a` (2026-08-21)
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

### Incident Patch 11: `25d41a7b` (2026-08-17)
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

**File**: `fincept-qt/src/services/options/FiiDiiService.h` (modified, +2/-3)
```diff
@@ -2,9 +2,8 @@
 // FiiDiiService — DataHub Producer for `fno:fii_dii:daily`.
 //
 // On `refresh()` (called by the hub scheduler when a subscriber wants fresh
-// data), the service runs scripts/fii_dii_scraper.py via PythonRunner,
-// upserts the result into `fii_dii_daily`, then publishes the last
-// `kPublishWindow` days as `QVector<FiiDiiDay>` on the topic.
+// data), the service upserts the result into `fii_dii_daily`, then publishes
+// the last `kPublishWindow` days as `QVector<FiiDiiDay>` on the topic.
 //
 // Cadence
 // ───────
```

**File**: `fincept-qt/src/services/options/FiiDiiTypes.h` (modified, +1/-2)
```diff
@@ -2,8 +2,7 @@
 // FiiDiiTypes — daily institutional flows.
 //
 // One row per trading day. Source: NSE cash-market FII/DII end-of-day
-// publication (scripts/fii_dii_scraper.py). All values in Indian Rupees,
-// Crore units (1 Crore = 10⁷ ₹).
+// publication. All values in Indian Rupees, Crore units (1 Crore = 10⁷ ₹).
 
 #include <QMetaType>
 #include <QString>
```

**File**: `fincept-qt/src/trading/BrokerRegistry.cpp` (modified, +4/-2)
```diff
@@ -18,6 +18,7 @@
 #include "trading/brokers/iifl/IIFLBroker.h"
 #include "trading/brokers/kotak/KotakBroker.h"
 #include "trading/brokers/metaapi/MetaApiBroker.h"
+#include "trading/brokers/tickerall/TickerAllBroker.h"
 #include "trading/brokers/motilal/MotilalBroker.h"
 #include "trading/brokers/paytm/PaytmBroker.h"
 #include "trading/brokers/samco/SamcoBroker.h"
@@ -141,8 +142,9 @@ void BrokerRegistry::register_all() {
     // EU brokers
     brokers_["saxobank"] = std::make_unique<SaxoBankBroker>();
 
-    // MetaAPI-bridged
-    brokers_["metatrader4"] = std::make_unique<MetaApiBroker>();
+    // Hosted MetaTrader bridges — no local terminal required
+    brokers_["metatrader4"] = std::make_unique<MetaApiBroker>();   // via metaapi.cloud
+    brokers_["metatrader5"] = std::make_unique<TickerAllBroker>(); // via tickerall.com
 
     LOG_INFO("BrokerRegistry", QString("Registered %1 brokers").arg(brokers_.size()));
 }
```

---

### Incident Patch 12: `9b860f35` (2026-07-25)
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
           if [ ! -f "${OUTPUT}" ]; then
             PRODUCED=$(find . -maxdepth 1 -name "*.AppImage" | head -1)
@@ -2328,6 +2385,13 @@ jobs:
           MAC_URL=$(gh release view "${TAG}" --json assets \
             --jq '.assets[] | select(.name | test("\\.dmg$|macos.*setup")) | .url' \
             | head -1)
+          # Native Linux packages — Fedora/RHEL users have no apt (#192).
+          DEB_URL=$(gh release view "${TAG}" --json assets \
+            --jq '.assets[] | select(.name | test("\\.deb$")) | .url' \
+            | head -1)
+          RPM_URL=$(gh release view "${TAG}" --json assets \
+            --jq '.assets[] | select(.name | test("\\.rpm$")) | .url' \
+            | head -1)
 
           # Fallback: if browser_download_url not available via .url, try .browserDownloadUrl
           [ -z "$WIN_URL" ] && WIN_URL=$(gh release view "${TAG}" --json assets \
@@ -2339,22 +2403,34 @@ jobs:
           [ -z "$MAC_URL" ] && MAC_URL=$(gh release view "${TAG}" --json assets \
             -
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
+                const double span = (y->max() - y->min()) * factor;
+                y->setRange(mid - span / 2.0, mid + span / 2.0);
+            }
+        } else {
+            const QPointF anchor = chart()->mapToValue(e->position());
+            host_->zoom_time(factor, static_cast<qint64>(anchor.x()));
         }
         e->accept();
     }
 
   private:
     CryptoChart* host_ = nullptr;
+    bool dragging_ = false;
+    QPoint drag_pos_;
 };
 
 // ── CryptoChart ─────────────────────────────────────────────────────────────
@@ -223,6 +274,8 @@ CryptoChart::CryptoChart(QWidget* parent) : QWidget(parent) {
     series_->setIncreasingColor(QColor(colors::POSITIVE()));
     series_->setDecreasingColor(QColor(colors::NEGATIVE()));
     series_->setBodyWidth(0.78);
+    series_->setMaximumColumnWidth(kMaxCandlePx);
+    series_->setMinimumColumnWidth(kMinCandlePx);
     series_->setPen(QPen(Qt::NoPen)); // no outline on body
     series_->setCapsVisible(false);
     chart_->addSeries(series_);
@@ -38
```

**File**: `fincept-qt/src/screens/crypto_trading/CryptoChart.h` (modified, +16/-0)
```diff
@@ -4,6 +4,7 @@
 
 #include "trading/TradingTypes.h"
 #include "ui/charts/ChartOverlayManager.h"
+#include "ui/charts/TimeAxisNavigator.h"
 
 #include <QEvent>
 #include <QPushButton>
@@ -58,6 +59,15 @@ class CryptoChart : public QWidget {
     void on_hover_position(const QPointF& chart_value_pos, const QPoint& view_pos);
     void on_hover_leave();
 
+    // ── User-driven time navigation (#338) ────────────────────────────────
+    // Wheel zooms around the cursor, left-drag pans, double-click returns to
+    // auto-follow. While the user window is active the live candle stream no
+    // longer re-fits the time axis.
+    void zoom_time(double factor, qint64 anchor_ms);
+    void pan_time_pixels(int dx);
+    void reset_view();
+    void apply_view_range();
+
     HoverChartView* chart_view_ = nullptr;
     QChart* chart_ = nullptr;
     QCandlestickSeries* series_ = nullptr;
@@ -91,6 +101,12 @@ class CryptoChart : public QWidget {
 
     QVector<trading::Candle> candles_;
     static constexpr int MAX_VISIBLE = 120;
+    // Never fit the time axis tighter than this many slots. Qt sizes a candle
+    // body from the slot width in DOMAIN units, so a data-fitted axis holding
+    // 3 live candles inflates each body to a third of the plot (#338).
+    static constexpr int MIN_VISIBLE_SLOTS = 40;
+
+    fincept::ui::TimeAxisNavigator nav_;
 
     // Axis range cache (padded values actually applied to the axis)
     double last_min_price_ = -1;
```

**File**: `fincept-qt/src/screens/crypto_trading/CryptoTradingScreen.h` (modified, +10/-1)
```diff
@@ -93,7 +93,9 @@ class CryptoTradingScreen : public QWidget, public IStatefulScreen, public IGrou
     bool is_perp_market() const;
     void update_futures_visibility();
 
-    void async_fetch_candles(const QString& symbol, const QString& timeframe);
+    // `attempt` drives the retry backoff for an empty OHLCV response (#338) —
+    // callers always start at 0.
+    void async_fetch_candles(const QString& symbol, const QString& timeframe, int attempt = 0);
     void async_fetch_live_positions();
     void async_fetch_live_orders();
     void async_fetch_live_balance();
@@ -150,6 +152,13 @@ class CryptoTradingScreen : public QWidget, public IStatefulScreen, public IGrou
     QString portfolio_id_;
     trading::PtPortfolio portfolio_;
 
+    // "<symbol>|<timeframe>" the chart currently holds history for. Lets an
+    // empty OHLCV response keep a good chart instead of wiping it, while still
+    // clearing content that belongs to a symbol the user has left (#338).
+    QString chart_symbol_;
+    static constexpr int CANDLE_FETCH_MAX_ATTEMPTS = 3;
+    static constexpr int CANDLE_FETCH_RETRY_MS = 2000;
+
     // Async fetch guards
     std::atomic<bool> candles_fetching_{false};
     std::atomic<int> live_inflight_{0}; // counts async_fetch_live_* tasks still running
```

**File**: `fincept-qt/src/screens/crypto_trading/CryptoTradingScreen_AsyncFetch.cpp` (modified, +48/-4)
```diff
@@ -31,6 +31,7 @@
 #include <QSplitter>
 #include <QStringListModel>
 #include <QStyle>
+#include <QTimer>
 #include <QVBoxLayout>
 #include <QtConcurrent/QtConcurrent>
 
@@ -39,21 +40,64 @@ namespace fincept::screens {
 using namespace fincept::trading;
 using namespace fincept::screens::crypto;
 
-void CryptoTradingScreen::async_fetch_candles(const QString& symbol, const QString& timeframe) {
+void CryptoTradingScreen::async_fetch_candles(const QString& symbol, const QString& timeframe, int attempt) {
     if (candles_fetching_.exchange(true))
         return;
     QPointer<CryptoTradingScreen> self = this;
-    (void)QtConcurrent::run([self, symbol, timeframe]() {
+    (void)QtConcurrent::run([self, symbol, timeframe, attempt]() {
         auto candles = ExchangeService::instance().fetch_ohlcv(symbol, timeframe, OHLCV_FETCH_COUNT);
         if (!self)
             return;
         self->candles_fetching_ = false;
         QMetaObject::invokeMethod(
             self,
-            [self, candles]() {
+            [self, candles, symbol, timeframe, attempt]() {
                 if (!self)
                     return;
-                self->chart_->set_candles(candles);
+                // The user may have moved on while the REST call was in flight.
+                if (self->selected_symbol_ != symbol || self->chart_->current_timeframe() != timeframe)
+                    return;
+
+                if (!candles.isEmpty()) {
+                    self->chart_->set_candles(candles);
+                    self->chart_symbol_ = symbol + QLatin1Char('|') + timeframe;
+                    return;
+                }
+
+                // Empty result — the daemon errored, rate-limited, or the
+                // market has no history. Pushing it into the chart wipes the
+                // history and leaves the user watching WS bars trickle in one
+                // per minute, each drawn as a giant block (#338). Keep what we
+                // have, and only clear when the stale content belongs to a
+                // different symbol/timeframe.
+                const QString key = symbol + QLatin1Char('|') + timeframe;
+                if (self->chart_symbol_ != key) {
+                    self->chart_->clear();
+                    self->chart_symbol_.clear();
+                }
+                LOG_WARN("CryptoTrading", QString("fetch_ohlcv returned no candles for %1 %2 (attempt %3/%4)")
+                                              .arg(symbol, timeframe)
+                                              .arg(attempt + 1)
+                                              .arg(CANDLE_FETCH_MAX_ATTEMPTS));
+
+                if (attempt + 1 < CANDLE_FETCH_MAX_ATTEMPTS) {
+                    // The first fetch races the daemon's exchange handshake on
+                    // a cold start; back off and try again rather than leaving
+                    // the chart permanently empty.
+                    const int delay_ms = CANDLE_FETCH_RETRY_MS * (attempt + 1);
+                    QTimer::singleShot(delay_ms, self, [self, symbol, timeframe, attempt]() {
+                        if (!self || self->selected_symbol_ != symbol)
+                            return;
+                        if (self->chart_->current_timeframe() != timeframe)
+                            return;
+                        self->async_fetch_candles(symbol, timeframe, attempt + 1);
+                    });
+                } else {
+                    LOG_ERROR("CryptoTrading",
+                              QString("no OHLCV history for %1 %2 after %3 attempts — chart is live-only")
+                                  .arg(symbol, timeframe)
+                                  .arg(CANDLE_FETCH_MAX_ATTEMPTS));
+                }
             },
             Qt::QueuedConnection);
     });
```

---

### Incident Patch 13: `d2af7396` (2026-07-25)
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

### Incident Patch 14: `41ee551e` (2026-07-25)
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
+    QString username = auth::sanitize_input(username_->text()).toLower();
     QString cc = country_code_->text().trimmed();
     if (!cc.isEmpty() && !cc.startsWith('+'))
         cc = '+' + cc;
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

---

### Incident Patch 15: `c4ea0dad` (2026-07-25)
**Commit Message**: Merge pull request #361 from Sujallukhi04/fix/asset-dialog-dropdown

Fix asset search dropdown overlap, clipping, and vertical scrollbar

**File**: `fincept-qt/src/screens/portfolio/PortfolioDialogs.cpp` (modified, +30/-8)
```diff
@@ -5,6 +5,7 @@
 #include "services/markets/MarketSearchService.h"
 #include "ui/theme/Theme.h"
 
+#include <QApplication>
 #include <QDate>
 #include <QDateEdit>
 #include <QEvent>
@@ -306,24 +307,38 @@ AddAssetDialog::AddAssetDialog(QWidget* parent) : QDialog(parent) {
 
     layout->addLayout(btn_layout);
 
-    // ── Search dropdown (floats over the dialog, parented to this) ────────────
     search_frame_ = new QFrame(this);
+    search_frame_->setWindowFlags(Qt::Tool | Qt::FramelessWindowHint | Qt::NoDropShadowWindowHint);
+    search_frame_->setAttribute(Qt::WA_ShowWithoutActivating);
     search_frame_->setObjectName("assetSearchFrame");
     search_frame_->setStyleSheet(
         QString("QFrame#assetSearchFrame { background:%1; border:1px solid %2; border-top:none; }")
             .arg(ui::colors::BG_SURFACE(), ui::colors::BORDER_MED()));
     search_frame_->hide();
 
+    // Hide dropdown when app loses focus
+    connect(qApp, &QApplication::focusChanged, this, [this](QWidget*, QWidget* now) {
+        if (search_frame_->isVisible()) {
+            if (!now || (now != symbol_edit_ && !search_frame_->isAncestorOf(now) && now != search_list_)) {
+                search_frame_->hide();
+            }
+        }
+    });
+
     auto* frame_layout = new QVBoxLayout(search_frame_);
     frame_layout->setContentsMargins(0, 0, 0, 0);
     frame_layout->setSpacing(0);
 
     search_list_ = new QListWidget(search_frame_);
-    search_list_->setStyleSheet(QString("QListWidget { background:transparent; border:none; outline:none; }"
+    search_list_->setStyleSheet(QString("QListWidget { background:%1; border:none; outline:none; }"
                                         "QListWidget::item { padding:0; border:none; background:transparent; }"
-                                        "QListWidget::item:selected { background:%1; border-left:3px solid %2; }")
-                                    .arg(ui::colors::BORDER_DIM(), ui::colors::AMBER()));
+                                        "QListWidget::item:selected { background:%2; border-left:3px solid %3; }"
+                                        "QScrollBar:vertical { background:%1; width:6px; margin:0; }"
+                                        "QScrollBar::handle:vertical { background:%2; border-radius:3px; min-height:15px; }"
+                                        "QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height:0; }")
+                                    .arg(ui::colors::BG_SURFACE(), ui::colors::BORDER_DIM(), ui::colors::AMBER()));
     search_list_->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
+    search_list_->setVerticalScrollBarPolicy(Qt::ScrollBarAsNeeded);
     search_list_->setCursor(Qt::PointingHandCursor);
     frame_layout->addWidget(search_list_);
 
@@ -384,7 +399,7 @@ void AddAssetDialog::show_results(const QList<fincept::services::MarketSearchSer
     if (results.isEmpty()) {
         auto* item = new QListWidgetItem(search_list_);
         item->setFlags(item->flags() & ~Qt::ItemIsSelectable);
-        auto* row = new QWidget(this);
+        auto* row = new QWidget(search_list_);
         row->setStyleSheet("background:transparent;");
         auto* rl = new QHBoxLayout(row);
         rl->setContentsMargins(10, 6, 10, 6);
@@ -423,7 +438,7 @@ void AddAssetDialog::show_results(const QList<fincept::services::MarketSearchSer
         auto* item = new QListWidgetItem(search_list_);
         item->setData(Qt::UserRole, yf_sym);
 
-        auto* row = new QWidget(this);
+        auto* row = new QWidget(search_list_);
         row->setStyleSheet("background:transparent;");
         auto* hl = new QHBoxLayout(row);
         hl->setContentsMargins(10, 4, 10, 4);
@@ -483,9 +498,9 @@ void AddAssetDialog::select_result(const QString& sym) {
 
 void AddAssetDialog::position_dropdown() {
     // Place the dropdown directly below the symbol_edit_ row
-    const QPoint origin = symbol_edit_->mapTo(this, QPoint(0, symbol_edit_->height()));
+    const QPoint origin = symbol_edit_->mapToGlobal(QPoint(0, symbol_edit_->height()));
     const int w = symbol_edit_->width() + 60; // a bit wider to show exchange column
-    const int rows = std::min(search_list_->count(), kAssetSearchLimit);
+    const int rows = std::min(search_list_->count(), 6);
     const int h = rows * 30 + 2;
     search_frame_->setGeometry(origin.x(), origin.y(), w, h);
 }
@@ -526,6 +541,13 @@ void AddAssetDialog::changeEvent(QEvent* event) {
     QDialog::changeEvent(event);
 }
 
+void AddAssetDialog::moveEvent(QMoveEvent* event) {
+    QDialog::moveEvent(event);
+    if (search_frame_ && search_frame_->isVisible()) {
+        position_dropdown();
+    }
+}
+
 void AddAssetDialog::retranslateUi() {
     setWindowTitle(tr("Add Asset"));
     if (title_label_)
```

**File**: `fincept-qt/src/screens/portfolio/PortfolioDialogs.h` (modified, +2/-0)
```diff
@@ -14,6 +14,7 @@
 #include <QListWidget>
 #include <QPushButton>
 #include <QRadioButton>
+#include <QMoveEvent>
 #include <QString>
 #include <QTimer>
 
@@ -80,6 +81,7 @@ class AddAssetDialog : public QDialog {
   protected:
     bool eventFilter(QObject* obj, QEvent* event) override;
     void changeEvent(QEvent* event) override;
+    void moveEvent(QMoveEvent* event) override;
 
   private:
     void retranslateUi();
```

#### Recent Merged Pull Requests:
- **PR #396** (2026-10-01): fix(algo): seed sma_series/ema_series past a NaN prefix (@LudwigJMarx)
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
