# Forensic Learning Record (Deep Inspection): open-metadata/OpenMetadata

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-metadata-openmetadata-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-metadata/OpenMetadata](https://github.com/open-metadata/OpenMetadata))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:17:51.263Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-metadata/OpenMetadata`
- **Description**: The Open Context Layer for Data and AI ,  OpenMetadata is the open platform for building trusted data context and business semantics for humans, AI assistants, and agents.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 15379 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ingestion/src/airflow_provider_openmetadata/hooks/openmetadata.py`
```
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
This hook allows storing the connection to
an OpenMetadata server and use it for your
operators.
"""

from typing import Any

from airflow.hooks.base import BaseHook
from airflow.models import Connection

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.security.ssl.validateSSLClientConfig import (
    ValidateSslClientConfig,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def get_connection_password(conn: Connection) -> str:
    """
    Get password from Airflow Connection in a version-compatible way.

    In Airflow 2.x: Use conn.get_password()
    In Airflow 3.x: Use conn.password directly
    """
    if hasattr(conn, "get_password"):
        return conn.get_password()
    return conn.password


def get_connection_extra(conn: Connection) -> dict:
    """
    Get extra config from Airflow Connection in a version-compatible way.

    In Airflow 2.x: Use conn.extra_dejson if conn.get_extra() else {}
    In Airflow 3.x: Use conn.extra_dejson directly (get_extra() method removed)
    """
    if hasattr(conn, "get_extra"):
        return conn.extra_dejson if conn.get_extra() else {}
    return conn.extra_dejson or {}


class OpenMetadataHook(BaseHook):
    """
    Airflow hook to store and use an `OpenMetadataConnection`
    """

    conn_name_attr: str = "openmetadata_conn_id"
    default_conn_name = "openmetadata_default"
    conn_type = "openmetadata"
    hook_name = "OpenMetadata"

    def __init__(self, openmetadata_conn_id: str = default_conn_name) -> None:
        super().__init__()
        self.openmetadata_conn_id = openmetadata_conn_id
        # Add defaults
        self.default_schema = "http"
        self.default_port = 8585
        self.default_verify_ssl = VerifySSL.no_ssl
        self.default_ssl_config = None

    def get_conn(self) -> OpenMetadataConnection:
        conn: Connection = self.get_connection(self.openmetadata_conn_id)
        jwt_token = get_connection_password(conn)
        if not jwt_token:
            raise ValueError("JWT Token should be informed.")

        if not conn.host:
            raise ValueError("Host should be informed.")

        port = conn.port if conn.port else self.default_port
        schema = conn.schema if conn.schema else self.default_schema

        extra = get_connection_extra(conn)
        verify_ssl = extra.get("verifySSL") or self.default_verify_ssl
        ssl_config = (
            ValidateSslClientConfig(caCertificate=extra["sslConfig"])
            if extra.get("sslConfig")
            else self.default_ssl_config
        )

        om_conn = OpenMetadataConnection(
            hostPort=f"{schema}://{conn.host}:{port}/api",
            authProvider=AuthProvider.openmetadata,
            securityConfig=OpenMetadataJWTClientConfig(jwtToken=jwt_token),
            verifySSL=verify_ssl,
            sslConfig=ssl_config,
        )

        return om_conn  # noqa: RET504

    def test_connection(self):
        """Test that we can instantiate the ometa client with the given connection"""
        try:
            OpenMetadata(self.get_conn())
            return True, "Connection successful"  # noqa: TRY300
        except Exception as err:
            return False, str(err)

    @staticmethod
    def get_ui_field_behaviour() -> dict[str, Any]:
        """Returns custom field behaviour"""
        return {
            "hidden_fields": ["login"],
            "relabeling": {"password": "JWT Token"},
        }

```

### Core Architecture Module: `ingestion/src/metadata/core/__init__.py`
```
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

```

### Core Architecture Module: `ingestion/src/metadata/core/connections/__init__.py`
```
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

```

### Core Architecture Module: `ingestion/src/metadata/core/connections/lifetime.py`
```
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
The reference a collaborator holds to a client it does not own.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Generic, TypeVar

if TYPE_CHECKING:
    from collections.abc import Callable

C = TypeVar("C")


class Borrowed(Generic[C]):
    """A client someone else owns: read it, never build it, never close it.

    Reading ``client`` delegates to the owner, which builds it once on first read.
    Carries no config and no teardown, so a holder can do neither.
    """

    __slots__ = ("_read",)

    def __init__(self, read: Callable[[], C]) -> None:
        self._read = read

    @property
    def client(self) -> C:
        return self._read()

    @classmethod
    def of(cls, client: C) -> Borrowed[C]:
        """A handle over an already-built client. For tests and fakes."""
        return cls(lambda: client)

```

### Core Architecture Module: `ingestion/src/metadata/data_quality/runner/core.py`
```
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Main class to run data tests
"""

from metadata.data_quality.interface.test_suite_interface import TestSuiteInterface
from metadata.generated.schema.tests.testCase import TestCase
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class DataTestsRunner:
    """class to execute the test validation"""

    def __init__(self, test_runner_interface: TestSuiteInterface):
        self.test_runner_interface = test_runner_interface

    def run_and_handle(self, test_case: TestCase):
        """run and handle test case validation"""
        logger.info(
            f"Executing test case {test_case.name.root} "
            f"for entity {self.test_runner_interface.table_entity.fullyQualifiedName.root}"
        )
        result = self.test_runner_interface.run_test_case(
            test_case,
        )

        return result  # noqa: RET504

```

### Core Architecture Module: `ingestion/src/metadata/data_quality/validations/impact_score.py`
```
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Impact Score Calculation for Dimensional Test Results

This module provides SQLAlchemy expressions for calculating impact scores in dimensional
data quality queries. The impact score identifies which dimensions reveal the most
significant data quality issues by combining failure rate severity with data volume.

Impact Score Formula:
    impact = failure_rate² × volume_factor × sample_weight / 1.5

Formula Components Explained:

    1. failure_rate² (Quadratic Severity):
       - Squares the failure rate to emphasize high failure percentages
       - 10% failure → 0.01, 50% failure → 0.25, 90% failure → 0.81
       - Makes high failure rates disproportionately important

    2. volume_factor (Tiered Linear Scaling):
       - Uses conditional tiers instead of logarithm for database compatibility
       - SQLite and other databases may not have log functions available by default
       - Approximates logarithmic behavior with diminishing returns:
         * < 10 rows → 0.25
         * < 100 rows → 0.50
         * < 1,000 rows → 0.75
         * < 10,000 rows → 1.00
         * < 100,000 rows → 1.25
         * ≥ 100,000 rows → 1.50

    3. sample_weight = min(1.0, total/100) (Sample Size Credibility):
       - Reduces impact for very small samples that may not be statistically significant
       - Ramps from 0 to 1 as sample size grows to 100 rows
       - Prevents single-row outliers from having high impact scores

    4. Division by 1.5 (Normalization):
       - Normalizes scores to approximately 0-1 range
       - Based on maximum realistic values: 1.0 × 1.5 × 1.0 = 1.5

Why This Formula:
    - Balances failure severity with data volume to find truly impactful issues
    - Prevents both tiny samples and massive datasets from skewing results
    - Provides intuitive scoring where higher scores mean more urgent issues
    - Works consistently across tables of different sizes

Example Scores:
    - 1 row, 1 failed (100%): 0.025 (low - unreliable single sample)
    - 100 rows, 90 failed (90%): 0.405 (medium - concerning pattern)
    - 10,000 rows, 9,000 failed (90%): 0.810 (high - major issue at scale)
    - 10,000 rows, 1,000 failed (10%): 0.010 (low - minor issue despite volume)
"""  # noqa: RUF002

from typing import TYPE_CHECKING

from sqlalchemy import Float, case, func
from sqlalchemy.sql.expression import ClauseElement

from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

if TYPE_CHECKING:
    pass  # noqa: TC005

# Configuration constants
DEFAULT_SAMPLE_WEIGHT_THRESHOLD = 100.0  # Samples needed for full weight
DEFAULT_NORMALIZATION_FACTOR = 1.5  # Divisor to normalize scores to ~0-1 range
DEFAULT_TOP_DIMENSIONS = 5  # Number of top dimensions to show before grouping as "Others"
MAX_TOP_DIMENSIONS = 50

# Volume factor tiers for the impact score formula
VOLUME_FACTOR_TIERS = [
    (10, 0.25),  # < 10 rows
    (100, 0.50),  # < 100 rows
    (1000, 0.75),  # < 1,000 rows
    (10000, 1.00),  # < 10,000 rows
    (100000, 1.25),  # < 100,000 rows
]
VOLUME_FACTOR_MAX = 1.50  # >= 100,000 rows


def get_volume_factor(total_count: float) -> float:
    """
    Calculate the volume factor for a given row count.

    This function returns the appropriate volume factor based on
    the tiered thresholds defined in VOLUME_FACTOR_TIERS.

    Args:
        total_count: Number of total rows

    Returns:
        float: Volume factor value between 0.25 and 1.50
    """
    for threshold, factor in VOLUME_FACTOR_TIERS:
        if total_count < threshold:
            return factor
    return VOLUME_FACTOR_MAX


def get_volume_factor_expression(total_count: ClauseElement) -> ClauseElement:
    """
    Generate SQLAlchemy expression for volume factor calculation.

    Creates a CASE statement that implements the tiered volume factor.

    Args:
        total_count: SQLAlchemy expression for total row count

    Returns:
        SQLAlchemy CASE expression for volume factor
    """
    conditions = []
    for threshold, factor in VOLUME_FACTOR_TIERS:
        conditions.append((total_count < threshold, factor))

    return case(*conditions, else_=VOLUME_FACTOR_MAX)


def get_impact_score_expression(
    failed_count: ClauseElement,
    total_count: ClauseElement,
    sample_weight_threshold: float = DEFAULT_SAMPLE_WEIGHT_THRESHOLD,
    normalization_factor: float = DEFAULT_NORMALIZATION_FACTOR,
) -> ClauseElement:
    """
    Generate SQLAlchemy expression for calculating impact score in dimensional queries.

    The impact score identifies dimensions with high variance in data quality by
    combining failure rate severity with data volume. SQLAlchemy handles database-specific
    function translations (e.g., LEAST/MIN, LOG/LN).

    Args:
        failed_count: SQLAlchemy expression for number of failed rows
        total_count: SQLAlchemy expression for total number of rows
        sample_weight_threshold: Number of samples needed for full weight (default: 100)
        normalization_factor: Divisor to normalize scores to 0-1 range (default: 1.5)

    Returns:
        SQLAlchemy expression that calculates impact score (0-1 range)

    Example SQL:
        CASE
            WHEN (failure_rate² * volume_factor * sample_weight / 1.5) > 1.0 THEN 1.0
            WHEN (failure_rate² * volume_factor * sample_weight / 1.5) < 0.0 THEN 0.0
            ELSE (failure_rate² * volume_factor * sample_weight / 1.5)
        END

    Where volume_factor is a tiered value based on total rows for database compatibility
    """
    # Calculate failure rate with safe division
    failure_rate = case((total_count > 0, func.cast(failed_count, Float) / total_count), else_=0.0)

    # Square the failure rate to emphasize high failure percentages
    # 50% failure -> 0.25, 90% failure -> 0.81
    failure_severity = failure_rate * failure_rate

    # Volume factor using tiered linear scaling
    # Approximates logarithmic behavior without requiring database log functions
    # This ensures compatibility with all databases including SQLite
    volume_factor = get_volume_factor_expression(total_count)

    # Sample weight to reduce noise from tiny samples
    # Ramps from 0 to 1 as sample size goes from 0 to threshold
    # Using case instead of least for database compatibility
    sample_weight_raw = func.cast(total_count, Float) / sample_weight_threshold
    sample_weight = case((sample_weight_raw < 1.0, sample_weight_raw), else_=1.0)

    # Combine all factors
    raw_impact = failure_severity * volume_factor * sample_weight

    # Normalize to approximately 0-1 range
    # Max theoretical value: 1.0 (failure²) × 1.5 (max volume tier) × 1.0 (sample) = 1.5  # noqa: RUF003
    # Divide by normalization_factor (1.5) to normalize to 0-1 range
    normalized_impact = raw_impact / normalization_factor

    # Ensure final score is between 0 and 1 using case expressions for compatibility
    return case(
        (normalized_impact < 0.0, 0.0),
        (normalized_impact > 1.0, 1.0),
        else_=normalized_impact,
    )


def calculate_impact_score_pandas(
    df_grouped,
    failed_column: str = "failed_count",
    total_column: str = "total_count",
    sample_weight_threshold: float = DEFAULT_SAMPLE_WEIGHT_THRESHOLD,
    normalization_factor: float = DEFAULT_NORMALIZATION_FACTOR,
):
    """
    Calculate impact scores for a pandas DataFrame with grouped dimension results.

    This function adds an 'impact_score' column to a DataFrame that contains
    aggregated results by dimension. It uses the same formula as the SQLAlchemy
    version but with pandas/numpy operations.

    Args:
        df_grouped: Pandas DataFrame with dimension results
        failed_column: Name of column containing failed counts
        total_column: Name of column containing total counts
        sample_weight_threshold: Threshold for full sample weight
        normalization_factor: Normalization divisor

    Returns:
        DataFrame with added 'impact_score' column

    Example:
        >>> import pandas as pd
        >>> import numpy as np
        >>> df = pd.DataFrame({
        ...     'dimension': ['USA', 'EU', 'Asia'],
        ...     'failed_count': [9000, 500, 10],
        ...     'total_count': [10000, 1000, 100]
        ... })
        >>> df_with_scores = calculate_impact_score_pandas(df)
        >>> print(df_with_scores[['dimension', 'impact_score']])
           dimension  impact_score
        0        USA         0.810
        1         EU         0.188
        2       Asia         0.005
    """
    import numpy as np

    # Create a copy to avoid modifying original
    df = df_grouped.copy()

    # Calculate failure rate
    df["failure_rate"] = np.where(df[total_column] > 0, df[failed_column] / df[total_column], 0.0)

    # Square the failure rate
    df["failure_severity"] = df["failure_rate"] ** 2

    # Tiered volume factor using the helper function
    df["volume_factor"] = df[total_column].apply(get_volume_factor)

    # Sample weight
    df["sample_weight"] = np.minimum(1.0, df[total_column] / sample_weight_threshold)

    # Calculate raw impact
    df["raw_impact"] = df["failure_severity"] * df["volume_factor"] * df["sample_weight"]

    # Normalize to 0-1 range
    df["impact_score"] = np.minimum(1.0, np.maximum(0.0, df["raw_impact"] / normalization_factor))

    # Clean up intermediate columns
    df.drop(
        columns=[
     
```

### Core Architecture Module: `ingestion/src/metadata/data_quality/validations/utils.py`
```
"""
Data quality validation utility functions.
"""

from collections.abc import Callable
from typing import Any, TypeVar
from urllib.parse import quote

from jinja2 import StrictUndefined, TemplateSyntaxError, UndefinedError
from jinja2.exceptions import SecurityError
from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy.engine import URL

from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

T = TypeVar("T", bound=Callable)
R = TypeVar("R")

# Characters that terminate the userinfo (or the whole authority) while data-diff parses the URI.
# They must stay percent-encoded even though data-diff will not decode them back.
USERNAME_RESERVED_CHARACTERS = ":/?#"


def get_test_case_param_value(
    test_case_param_vals: list[TestCaseParameterValue],
    name: str,
    type_: T,
    default: R | None = None,
    pre_processor: Callable | None = None,
) -> R | T | None:
    """Return a test case parameter value with the appropriate type casting for the test case definition.

    Args:
        test_case_param_vals: list of test case parameter values
        type_ (Union[float, int, str]): type for the value
        name (str): column name
        default (_type_, optional): Default value to return if column is not found
        pre_processor: pre processor function/type to use against the value before casting to type_
    """
    value = next((param.value for param in test_case_param_vals if param.name == name), None)

    if not value:
        return default if default is not None else None

    if not pre_processor:
        return type_(value)

    pre_processed_value = pre_processor(value)
    return type_(pre_processed_value)


def get_bool_test_case_param(
    test_case_param_vals: list[TestCaseParameterValue],
    name: str,
) -> R | T | None:
    """Return a test case parameter value as a boolean. Boolean values are always False by default.

    Args:
        test_case_param_vals: list of test case parameter values
        name (str): column name
    """
    str_val: str = get_test_case_param_value(test_case_param_vals, name, str, None)
    if str_val is None:
        return False
    return str_val.lower() == "true"


def _encode_username_for_data_diff(username: str) -> str:
    """Percent-encode only what data-diff's URI parser needs to locate the userinfo boundaries."""
    return "".join(f"%{ord(char):02X}" if char in USERNAME_RESERVED_CHARACTERS else char for char in username)


def render_url_for_data_diff(url: URL) -> str:
    """Render `url` so that data-diff reads back the values it was built from.

    `URL.render_as_string` percent-encodes the username, but data-diff only decodes the password
    (`CustomParseResult`), the host and the query string when it parses a URI. An encoded username
    therefore reaches the driver still encoded, and `user@corp.com` tries to authenticate as
    `user%40corp.com`. We hand data-diff the decoded username and keep the password encoded, so that
    every component survives exactly one encode/decode round trip.
    """
    if url.username is None:
        return url.render_as_string(hide_password=False)

    userinfo = _encode_username_for_data_diff(url.username)
    if userinfo != url.username:
        logger.warning(
            "[Data Diff]: The username contains characters reserved by the connection URI (%s). "
            "data-diff does not decode them, so authentication may fail.",
            ", ".join(sorted(set(url.username) & set(USERNAME_RESERVED_CHARACTERS))),
        )
    if url.password is not None:
        userinfo += f":{quote(str(url.password), safe=' +')}"

    authority = URL.create(
        drivername=url.drivername,
        host=url.host,
        port=url.port,
        database=url.database,
        query=url.query,
    ).render_as_string(hide_password=False)
    scheme, _, rest = authority.partition("://")
    return f"{scheme}://{userinfo}@{rest}"


def casefold_if_string(value: Any) -> Any:
    """Case fold the value if it is a string.

    Args:
        value (Any): value to case fold
    Returns:
        Any: case folded value
    """
    return value.casefold() if isinstance(value, str) else value


def render_sql_expression(sql_template: str, params: dict[str, str]) -> str:
    """Render a Rule Library SQL expression, raising ``ValueError`` on any template error.

    The expression is user-authored, so it is rendered sandboxed: a plain Template
    lets it reach Python internals and run code on the ingestion worker.
    """
    try:
        return SandboxedEnvironment(undefined=StrictUndefined).from_string(sql_template).render(**params)
    except TemplateSyntaxError as e:
        raise ValueError(f"Invalid Jinja2 syntax in SQL expression: {e.message}") from e
    except SecurityError as e:
        raise ValueError(f"Unsafe operation in SQL expression: {e}") from e
    except UndefinedError as e:
        raise ValueError(
            f"Undefined variable in SQL expression: {e.message}. Available parameters: {list(params.keys())}"
        ) from e

```

### Core Architecture Module: `ingestion/src/metadata/entity_resolution/engine.py`
```
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""FQN entity resolution with state owned by one execution run."""

import re
from dataclasses import dataclass
from enum import Enum
from threading import Lock
from typing import Generic, TypeVar

from cachetools import LRUCache

from metadata.ingestion.models.entity_interface import EntityInterface
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.utils import fqn

T = TypeVar("T", bound=EntityInterface)


class FqnLookupMode(str, Enum):
    EXACT = "exact"
    CASE_INSENSITIVE_EXACT = "case_insensitive_exact"
    WILDCARD = "wildcard"


@dataclass(frozen=True)
class FqnCandidate:
    value: str
    mode: FqnLookupMode


@dataclass(frozen=True)
class ResolutionTier:
    candidates: tuple[FqnCandidate, ...]


@dataclass(frozen=True)
class EntityResolutionPlan(Generic[T]):
    entity_type: type[T]
    tiers: tuple[ResolutionTier, ...]
    fields: tuple[str, ...] = ()
    include: str | None = None
    max_candidates_per_lookup: int = 10

    def __post_init__(self):
        object.__setattr__(self, "fields", tuple(sorted(set(self.fields))))
        if self.max_candidates_per_lookup < 1:
            raise ValueError("Candidate limit must be positive")
        if self.include not in (None, "non-deleted", "deleted", "all"):
            raise ValueError("Unsupported include policy")
        for tier in self.tiers:
            for candidate in tier.candidates:
                if not candidate.value or not isinstance(candidate.mode, FqnLookupMode):
                    raise ValueError("A candidate requires an FQN and lookup mode")
                if self.include in ("deleted", "all") and candidate.mode != FqnLookupMode.EXACT:
                    raise ValueError("Search-assisted resolution supports active entities only")


class EntityResolver:
    """Resolve borrowed read-only entities; the owner closes after its work finishes."""

    def __init__(self, metadata: OpenMetadata, cache_capacity: int = 512, max_plan_candidates: int = 100):
        if cache_capacity < 1 or max_plan_candidates < 1:
            raise ValueError("Resolver capacities must be positive")
        self._metadata = metadata
        self._max_plan_candidates = max_plan_candidates
        self._cache = LRUCache(maxsize=cache_capacity)
        self._lock = Lock()
        self._closed = False

    def resolve(self, plan: EntityResolutionPlan[T]) -> tuple[T, ...]:
        """Return the first nonempty tier; do not cache empty results or failures."""
        with self._lock:
            self._ensure_open()
            if sum(len(tier.candidates) for tier in plan.tiers) > self._max_plan_candidates:
                raise ValueError("Too many candidates in resolution plan")
            if plan in self._cache:
                return self._cache[plan]

        result = ()
        for tier in plan.tiers:
            entities = {}
            for candidate in tier.candidates:
                for entity in self._lookup(plan, candidate):
                    entities[model_str(entity.id)] = entity
            if entities:
                result = tuple(
                    sorted(
                        entities.values(),
                        key=lambda entity: (model_str(entity.fullyQualifiedName), model_str(entity.id)),
                    )
                )
                break

        with self._lock:
            self._ensure_open()
            if result:
                self._cache[plan] = result
        return result

    def _lookup(self, plan: EntityResolutionPlan[T], candidate: FqnCandidate) -> list[T]:
        if candidate.mode == FqnLookupMode.EXACT:
            names = (candidate.value,)
        else:
            found = self._metadata.search_fqn_candidates(
                entity_type=plan.entity_type,
                value=candidate.value,
                wildcard=candidate.mode == FqnLookupMode.WILDCARD,
                size=plan.max_candidates_per_lookup + 1,
            )
            if found.total > plan.max_candidates_per_lookup or len(found.fqns) > plan.max_candidates_per_lookup:
                raise ValueError("FQN candidate search exceeds the configured limit")
            if not found.total_is_exact or found.total != len(found.fqns):
                raise ValueError("Incomplete FQN candidate search")
            names = found.fqns

        result = []
        for name in dict.fromkeys(names):
            if not _matches(candidate, name):
                continue
            entity = self._metadata.get_by_name(
                entity=plan.entity_type, fqn=name, fields=list(plan.fields), include=plan.include
            )
            if entity is None:
                continue
            if model_str(entity.fullyQualifiedName) != name:
                continue
            deleted = bool(entity.deleted)
            if (plan.include in (None, "non-deleted") and deleted) or (plan.include == "deleted" and not deleted):
                continue
            result.append(entity)
        return result

    def close(self) -> None:
        """Clear owned state and reject future resolution without closing the client."""
        with self._lock:
            self._closed = True
            self._cache.clear()

    def _ensure_open(self) -> None:
        if self._closed:
            raise RuntimeError("EntityResolver is closed")


def _matches(candidate: FqnCandidate, name: str) -> bool:
    if candidate.mode == FqnLookupMode.EXACT:
        return candidate.value == name
    if candidate.mode == FqnLookupMode.CASE_INSENSITIVE_EXACT:
        return candidate.value.lower() == name.lower()
    patterns = fqn.split_raw_name(candidate.value)
    parts = fqn.split_raw_name(name)
    if len(patterns) != len(parts):
        return False
    return all(
        re.fullmatch(_wildcard_pattern(pattern.lower()), part.lower(), flags=re.DOTALL)
        for pattern, part in zip(patterns, parts, strict=True)
    )


def _wildcard_pattern(value: str) -> str:
    pattern = []
    chars = iter(value)
    for char in chars:
        if char == "\\":
            pattern.append(re.escape(next(chars, "\\")))
        elif char == "*":
            pattern.append(".*")
        elif char == "?":
            pattern.append(".")
        else:
            pattern.append(re.escape(char))
    return "".join(pattern)

```

### Core Architecture Module: `ingestion/src/metadata/great_expectations/utils/ometa_config_handler.py`
```
#  Copyright 2022 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Utility functions to create open metadata connections from yaml file
"""

import os
import traceback
from typing import Any

import yaml
from jinja2 import Environment, FileSystemLoader, TemplateNotFound, select_autoescape

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.utils.logger import great_expectations_logger

logger = great_expectations_logger()


def env(key: str) -> Any | None:
    """Render environment variable from jinja template

    Args:
        key: environment variable key

    Returns:
        Any
    """
    return os.getenv(key)


def create_jinja_environment(template_path: str) -> Environment:
    """Create jinja environment and register environment variable reading function

    Args:
        template_path: path to the folder holding the template
    """

    environment = Environment(loader=FileSystemLoader(template_path), autoescape=select_autoescape())
    environment.globals["env"] = env

    return environment


def render_template(environment: Environment, template_file: str = "config.yml") -> str:
    """Render tenmplate file

    Args:
        template_file: name of the template file

    Returns:
        str
    """
    file_type = os.path.splitext(template_file)  # noqa: PTH122
    if file_type[1] not in {".yaml", ".yml"}:
        raise TypeError(f"Unsupported file type: {file_type}. Type should be `.yaml` or `.yml`")

    try:
        tmplt = environment.get_template(template_file)
        return tmplt.render()
    except TemplateNotFound as err:
        logger.debug(traceback.format_exc())
        logger.warning(f"Template file at {template_file} not found: {err}")
        try:
            tmplt = environment.get_template("config.yaml")
            return tmplt.render()
        except TemplateNotFound as exc:
            raise TemplateNotFound(f"Config file at {environment.loader.searchpath} not found") from exc


def create_ometa_connection_obj(config: str) -> OpenMetadataConnection:
    """Create OpenMetadata connection"""
    return OpenMetadataConnection.model_validate(yaml.safe_load(config))

```

### Core Architecture Module: `ingestion/src/metadata/ingestion/connections/engine_strategy.py`
```
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Engine-building strategy for database connectors.

A database connector selects one strategy per authentication mode; the strategy
builds the SQLAlchemy engine and releases whatever it created. Most modes hold
only the engine, so ``close()`` defaults to disposing it; a mode with an
auxiliary resource (e.g. a GCP CloudSQL ``Connector``) extends ``close()``.

This base is shared across database connectors. Connector-specific strategies
live in the connector's module for now; strategies reused across connectors
(Azure AD, CloudSQL) are expected to graduate here as connectors adopt them.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Generic, TypeVar

if TYPE_CHECKING:
    from sqlalchemy.engine import Engine

ConnectionConfig = TypeVar("ConnectionConfig")


class EngineStrategy(ABC, Generic[ConnectionConfig]):
    """Builds and tears down the engine for one auth mode of a database connector."""

    def __init__(self, connection: ConnectionConfig) -> None:
        self._connection = connection
        self._engine: Engine | None = None

    @abstractmethod
    def build(self) -> Engine:
        """Build the engine, storing it on ``self._engine`` for ``close()``."""

    def close(self) -> None:
        if self._engine is not None:
            self._engine.dispose()
            self._engine = None

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #34679** (2026-10-05): **Test case details page shows wrong data in the last-run banner, result history chart and version page**
  *Symptoms*: ### Affected module  UI (Data Quality: test case details page)  ### Describe the bug  Validation of the new test case details page, after #34218, #34219 and #34313 merged, found seven places where the page shows wrong or missing data. All seven are in the UI. The API returns the right values.  1. **The last-run banner never shows RESULT / EXPECTED for real runs.** The banner pairs the run's result with the test parameter of the same name. Ingestion never gives them the same name: `tableRowCountToEqual` reports `rowCount` against the parameter `value`. So the block never appears for failed or successful runs. The same mismatch hides it for between-values, custom SQL and uniqueness tests. The run details card on the same page shows the right values. 2. **The result history chart drops the expectation line when every run is far from it.** The y axis covers only the runs, and ECharts does not draw a reference line outside the axis. A run of 110 rows against an expected 10,000 draws an axis of 110–120, with no `Expected 10,000` line and no label. 3. **The allowed-range band is wrong for decimal bounds.** The band parses its bounds with `parseInt`. So `columnValueMeanToBeBetween` with 0.5–1.5 draws a 0–1 band, and every passing run appears to be above the range. 4. **The allowed-range band is missing when the test has a third parameter.** The band takes the first two parameters by position, and only when there are exactly two. `tableRowCountToBeBetween` with 12–34 and a `threshold`

- **Issue #34675** (2026-10-05): **Settings updates can be served stale for 3 minutes, and three IT races fail the merge queue**
  *Symptoms*: ### Affected module  Backend  ### Describe the bug  PR #34025 was removed from the merge queue three times (2026-10-04 13:52, 2026-10-05 07:34 and 10:11 UTC) by integration-test failures that do not involve its changes. They come from four separate causes.  **1. A settings update can be ignored for up to 3 minutes (production bug).** `DataProductResourceIT.test_deleteOneDomainForMultiDomainDataProduct_preservesDataProductUntilLastDomain` (MySQL lane, run 37289828453) disabled the *Multiple Domains are not allowed* rule, then failed its update with `Rule [Multiple Domains are not allowed] validation failed`. - `SettingsCache` is a Guava `LoadingCache`, and Guava ignores `invalidate()` for a key whose load is still running. - A rule evaluation that read `entityRulesSettings` just before the update committed therefore stored the old rules, and every read served them until the 3-minute expiry. - The server log shows exactly one `Loaded Setting entityRulesSettings` between the settings PUT and the failing PATCH. - In production the same race makes any settings change (entity rules, search settings, auth configuration) take effect up to 3 minutes late.  **2. `UnitOfWorkRollbackIT.aUnitThatSwallowsItsDeadlockIsReplayedWholeInsteadOfCommittedInPart` fails on Postgres** with `expected: <[1, 2]> but was: <[1, 3]>`. Seen in runs 37013253106 (PG+OpenSearch, 2026-10-02) and 37289828140 (PG+ES+Redis, 2026-10-05). - Postgres wakes the deadlock winner but does not grant it the row the victim

- **Issue #34656** (2026-10-05): **Lineage edge loses its SQL query when a column on either table is renamed or deleted**
  *Symptoms*: ### Affected module  Lineage  ### Describe the bug  Renaming or deleting a column on a table rewrites the column lineage of every lineage edge on that table. It also replaces each rewritten edge's stored `sqlQuery` with the table's own `schemaDefinition`: `null` for a regular table, the view DDL for a view (`LineageRepository.updateColumnLineage`, since #22106).  Only the stored edge in `entity_relationship` is changed. The search index keeps the original query, so the loss shows up later:  - after a reindex, which rebuilds `upstreamLineage` from the stored edge, the edge has no query; - the lineage map's edge drawer loads the stored edge (`GET /v1/lineage/getLineageEdge/{fromId}/{toId}`), so it shows "No query available" straight away.  The query stays lost until lineage ingestion sends it again.  ### To Reproduce  1. Create tables `src` (columns `a`, `b`) and `tgt` (column `c`). 2. `PUT /v1/lineage` an edge `src → tgt` with a `sqlQuery` and column lineage `[src.a, src.b] → tgt.c`. 3. Update `src` to drop column `b`. 4. `GET /v1/lineage/getLineageEdge/{srcId}/{tgtId}`: the column lineage is correctly `[src.a] → tgt.c`, but `sqlQuery` is gone. 5. Reindex `tgt` (`POST /v1/search/reindexEntities`): its `upstreamLineage` edge no longer carries the query.  A case-only rename of a column on either table (`c` → `C`) drops the query the same way.  ### Expected behavior  A column rename or delete rewrites the edge's column mappings only. The edge's SQL query is kept.  ### OpenMetadat

- **Issue #34564** (2026-10-05): **Semantic Search not working with SEARCH_METADATA MCP Tool**
  *Symptoms*: ### Affected module  Search / Discovery  ### Describe the bug  I have set up latest OpenMetaData version 2.0.1 with a docker container, elasticSearch as a backend is running.  SEMANTIC_SEARCH_ENABLED is set to true. I configured an embedding model that is hosted with liteLLM and the Health status says its fine. I have reindexed everything. the SEMANTIC_SEARCH tool returns tables (but it does not return columns whose metadata description is relevant) when given a multi-word query, so I assume SEMANTIC_SEARCH correctly uses the search on embeddings. I need to get relevant columns, which is why I switched to SEARCH_METADATA MCP Tool, but the latter only returns results when the query is a single word, maybe indicating that the tool only performs keyword search. Documentation is a little confusing across versions, so I would like to ask if this is a bug (SEARCH_METADATA should be enhanced by semantic search and return results upon multi word queries but it does not), or whether this behaviour is intended (only SEMANTIC_SEARCH uses embeddings but does not search for matching columns). The whole issue does not produce any errors or exceptions, it is just that for multi-word queries, the returned result of SEARCH_METADATA is empty.  ### To Reproduce  from ai_sdk import AISdk, AISdkConfig from ai_sdk.mcp.models import MCPTool   AI_SDK_HOST = "http://localhost:8585/"  # default local endpoint when OMD is running in a docker container AI_SDK_TOKEN = "YOUR_TOKEN"  def main():      clien
  **Post-Mortem & Fix Analysis**:
  > @MMLangner Thanks for the detailed report.    - This is expected behavior, not a bug. search_metadata is keyword search only. It doesn't use embeddings, even with semantic search turned on.   - Long questions return nothing because most of the words have to show up in the same field (like one description). Short keyword queries work better, e.g. customer email instead of a full sentence.   - semantic_search uses embeddings, but it returns tables, not individual columns. Column names and descriptions are part of the table's embedding, so the right table should show up.   - For columns: use semantic_search to find the table, then search_metadata with entityType: tableColumn and a few keywords.    The tool description says the query is "natural language" and gets "automatically converted", which is misleading. We'll fix that.

- **Issue #34548** (2026-10-04): **Column-name context misses valid identifiers and promotes unrelated numeric values**
  *Symptoms*: ## Affected module  Ingestion Framework  ## Describe the bug  Several default PII recognizers rely heavily on the column name to turn a value match into a surviving result. With a matching context word, a weak match can be raised to `1.0`; without it, the same value can fall below the recognizer's configured `0.60` cutoff. For broad numeric patterns, context can also promote an unrelated operational value to strong identifier evidence.  At OpenMetadata commit `ba688d605830bb3d287ab65e8096b3b4724ce198`, the following cases were reproduced with fixed post-sampling values:  | Column | Value | Observed intended-recognizer result | | --- | --- | --- | | `direct_phone` | `+1 202-555-0146` | `PHONE_NUMBER` at `1.0` | | `direct_contact` | Same number | No surviving `PHONE_NUMBER` result; an unrelated `UK_NHS` match can still produce a tag | | `card_cvv` | `123` | CVV recognizer result at `1.0` | | `verification_code` | `123` | No surviving CVV result | | `customer_bank_account` | `1234567890` | `US_BANK_NUMBER` at `1.0` | | `bank_batch_number` | Same digits, used as a batch ID | Incorrect `US_BANK_NUMBER` result at `1.0` | | `bank_routing_number` | `021000021` | Correct `ABA_ROUTING_NUMBER` result and incorrect `US_BANK_NUMBER` result |  US driver's license, ITIN, SSN, UK NINO, and Singapore NRIC/FIN also have tested valid-looking values that pass with matching column context but lose their intended result under `record_code`. Whether each family should require context needs a decisi
  **Post-Mortem & Fix Analysis**:
  > Superseded by #34384, which now consolidates document score reachability, column-context scoring, and competing-identifier decisions. The phone, CVV, bank-account and identifier-context cases and acceptance criteria from this issue are retained there. Shared context normalization remains in #34561.

- **Issue #34417** (2026-10-02): **canmatrix 1.3.0 breaks `import asammdf`, failing MF4 reads and the Python unit tests on main, 2.0 and 1.13**
  *Symptoms*: **Affected module:** Ingestion Framework  ### Describe the bug  Since 2026-10-01 around 15:15 UTC, the `Unit Tests & Static Checks` job of `py-tests` fails on unrelated PRs, on the 2.0 and 1.13 release lines, and in the merge queue. The same five MF4 reader tests fail every time:  ``` FAILED tests/unit/test_mf4_reader.py::test_local_mf4_reading_with_installed_asammdf FAILED tests/unit/test_mf4_reader.py::TestMF4DataFrameReader::test_azure_mf4_reading FAILED tests/unit/test_mf4_reader.py::TestMF4DataFrameReader::test_gcs_mf4_reading FAILED tests/unit/test_mf4_reader.py::TestMF4DataFrameReader::test_local_mf4_reading FAILED tests/unit/test_mf4_reader.py::TestMF4DataFrameReader::test_s3_mf4_reading ```  Each one fails while importing asammdf:  ``` asammdf/blocks/types.py:24: in <module>     DbcFileType = tuple[StrPath | CanMatrix, int] E   TypeError: unsupported operand type(s) for |: 'types.UnionType' and 'module' ```  Nothing in this repository changed. canmatrix 1.3.0 was published to PyPI on 2026-10-01 at 15:06 UTC. It moved each class into its own submodule, so `from canmatrix import CanMatrix` now returns the `canmatrix.CanMatrix` module instead of the class. asammdf builds a type alias from that name at import time, so `import asammdf` raises. asammdf requires `canmatrix[arxml,dbc]>=1.2` with no upper bound and our dependencies do not constrain canmatrix, so every fresh install resolves 1.3.0. The latest asammdf (8.8.27) has the same import, so moving asammdf does not hel

- **Issue #34371** (2026-10-01): **Snowflake profiler: overflow fallback re-runs SUM when the metric registry is subclassed**
  *Symptoms*: ### Affected module Ingestion — profiler (Snowflake)  ### Describe the bug When `SUM`/`STDDEV_POP` on a large `NUMBER(38,x)` column overflows, Snowflake raises `100046 (22003): Number out of representable range`. `SnowflakeProfilerInterface` catches it, logs `Computing metrics without sum for <table>.<column>`, and retries through `SQAProfilerInterface._compute_static_metrics_wo_sum`, which is supposed to drop `Sum`, `StdDev` and `Mean`.  That filter uses class identity (`metric not in {Sum, StdDev, Mean}`). The `MetricRegistry` is dependency-injected, and a registry that provides subclasses of these metrics (e.g. `class MySum(Sum)`) is never matched. The retry then re-runs the identical overflowing query, and the column loses its entire profile (count, nulls, min, max, …) and is reported as a profiler failure.  ### To Reproduce 1. Create a Snowflake table with a `NUMBER(38,0)` column whose values sum past 38 digits (e.g. three rows of `9e37`). 2. Run the profiler with a `MetricRegistry` whose `sum`/`stddev`/`mean` entries are subclasses of the OSS metric classes. 3. The column profile fails with `100046 Number out of representable range`, and the "without sum" retry SQL still contains `SUM(...)`, `avg(...)` and `STDDEV_POP(...)`.  ### Expected behavior The overflow retry drops sum/mean/stddev for any registry, and the remaining column metrics are still computed.  ### Version - OpenMetadata: 2.0.x (main) - Ingestion: 2.0.x

- **Issue #34369** (2026-10-01): **Bound the clause cost of search queries: field-less query_string and search-time ngram analysis exceed max_clause_count**
  *Symptoms*: ## Summary  Some search endpoints send user text to OpenSearch in a shape whose cost grows with the size of the index mapping and with the length of the input. When that cost passes OpenSearch's `indices.query.bool.max_clause_count` (1024 by default), the search fails with `too_many_nested_clauses`. On multi-index aliases such as `dataAsset` and `all`, the search returns HTTP 200 with shards silently dropped. This has broken search several times since 2025. Each fix either raised the limit or patched the one query path that broke, so it keeps coming back whenever a mapping gains a field.  This issue explains why it happens and fixes the two endpoints that broke. #34380 bounds the cost on every other path, so the next mapping change cannot reintroduce it.  ## Where this comes from  - **Collate 2.0 nightly, 1 Oct 2026** ([run](https://github.com/open-metadata/openmetadata-collate/actions/runs/36798191264)). Four `SearchRelevancyIT` tests failed with HTTP 500 from `/v1/search/nlq/query` and `/v1/search/aggregate` on `table_search_index`:   `too_many_nested_clauses: Query contains too many nested clauses; maxClauseCount is set to 1024` - **Trigger:** the 2.0 backport of Table.aliases (#33415, merged 30 Sep) added `aliases`, `aliases.keyword` and `aliases.ngram` to the table mapping ([mapping](https://github.com/open-metadata/OpenMetadata/blob/2f33604228be21c77fc61ffaabc908f5bfcef6e2/openmetadata-spec/src/main/resources/elasticsearch/en/table_index_mapping.json#L671)). Nothing is 

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

### Incident Patch 1: `ef1d5bdb` (2026-10-06)
**Commit Message**: Fixes #34614: Support Link and PDF learning resource types (#34615)

* Fixes #34614: Support Link and PDF learning resource types

Learning resources could only be Storylane walkthroughs or videos, so
admins had no way to point users at their own guidance documents.

- Add Link and PDF to resourceType. A Link opens its URL in a new tab
  from the learning drawer and the admin preview. A PDF is embedded in
  the resource player, with an Open in New Tab link for hosts that
  block framing. The frame is not sandboxed because browsers disable
  their PDF viewer inside sandboxed frames.
- Reject non-http(s) URLs for Link and PDF, so a javascript: or data:
  URL can't run in the app's origin.
- Record resourceType changes in the updater. A PUT that changed only
  the type was silently dropped.
- Move the type badges into core-components icons-custom and render
  them through one ResourceTypeIcon with an accessible label.

* Use a Set for read-time learning resource types

Addresses SonarCloud typescript:S7776 on #34615: membership checks on a
fixed list read better as Set.has().

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/LearningResourceIT.java` (modified, +92/-0)
```diff
@@ -22,6 +22,7 @@
 import org.openmetadata.schema.entity.learning.LearningResourceContext;
 import org.openmetadata.schema.entity.learning.LearningResourceSource;
 import org.openmetadata.schema.type.EntityHistory;
+import org.openmetadata.sdk.exceptions.InvalidRequestException;
 import org.openmetadata.sdk.models.ListParams;
 import org.openmetadata.sdk.models.ListResponse;
 import org.openmetadata.sdk.services.learning.LearningResourceService;
@@ -269,6 +270,25 @@ void post_learningResourceAllTypes_200_OK(TestNamespace ns) {
     }
   }
 
+  @Test
+  void post_linkAndPdfWithNonWebUrl_400(TestNamespace ns) {
+    List<CreateLearningResource.ResourceType> webOnlyTypes =
+        List.of(CreateLearningResource.ResourceType.LINK, CreateLearningResource.ResourceType.PDF);
+    List<String> nonWebUrls = List.of("javascript:alert(1)", "ftp://files.example.com/guide.pdf");
+
+    for (CreateLearningResource.ResourceType type : webOnlyTypes) {
+      for (String url : nonWebUrls) {
+        CreateLearningResource request = newTypedRequest(ns, "non-web-url", type, url);
+
+        InvalidRequestException error =
+            assertThrows(InvalidRequestException.class, () -> createEntity(request));
+        assertTrue(
+            error.getMessage().contains("requires an http or https URL"),
+            "Expected " + url + " to be rejected for " + type.value() + ", got: " + error);
+      }
+    }
+  }
+
   // ===================================================================
   // DIFFICULTY TESTS
   // ===================================================================
@@ -390,6 +410,29 @@ void put_statusOnlyChange_recordsChangeDescription(TestNamespace ns) {
         "Should have at least 3 versions: create + 2 status updates");
   }
 
+  @Test
+  void put_resourceTypeOnlyChange_persistsAfterGet(TestNamespace ns) {
+    CreateLearningResource request =
+        newTypedRequest(
+            ns,
+            "type-only-update",
+            CreateLearningResource.ResourceType.VIDEO,
+            "https://example.com/type-only-update");
+    LearningResource resource = createEntity(request);
+
+    request.withResourceType(CreateLearningResource.ResourceType.LINK);
+    getLearningResourceService().put(request);
+
+    LearningResource fetched = getEntity(resource.getId().toString());
+    assertEquals(
+        CreateLearningResource.ResourceType.LINK.value(),
+        fetched.getResourceType().value(),
+        "Resource type should persist after a type-only PUT update");
+    assertTrue(
+        fetched.getVersion() > resource.getVersion(),
+        "Version should be incremented after resource type change");
+  }
+
   // ===================================================================
   // CONTEXT TESTS
   // ===================================================================
@@ -821,6 +864,44 @@ void test_listFilterByResourceType_multiValue(TestNamespace ns) {
                 }));
   }
 
+  @Test
+  void test_listFilterByResourceType_linkAndPdf(TestNamespace ns) {
+    LearningResource link =
+        createEntity(
+            newTypedRequest(
+                ns,
+                "rt-link",
+                CreateLearningResource.ResourceType.LINK,
+                "https://example.com/rt-link"));
+    LearningResource pdf =
+        createEntity(
+            newTypedRequest(
+                ns,
+                "rt-pdf",
+                CreateLearningResource.ResourceType.PDF,
+                "https://example.com/rt-guide.pdf"));
+    createEntity(
+        newTypedRequest(
+            ns,
+            "rt-video-excluded",
+            CreateLearningResource.ResourceType.VIDEO,
+            "https://example.com/rt-video-excluded"));
+
+    ListResponse<LearningResource> response =
+        listEntities(new ListParams().setLimit(100).addFilter("resourceType", "Link,PDF"));
+
+    List<String> webOnlyTypes =
+        List.of(
+            CreateLearningResource.ResourceType.LINK.value(),
+            CreateLearningResource.ResourceType.PDF.value());
+    List<String> returnedNames =
+        response.getData().stream().map(LearningResource::getName).toList();
+    assertTrue(returnedNames.containsAll(List.of(link.getName(), pdf.getName())));
+    assertTrue(
+        response.getData().stream()
+            .allMatch(r -> webOnlyTypes.contains(r.getResourceType().value())));
+  }
+
   @Test
   void test_listFilterByStatus_single(TestNamespace ns) {
     createEntity(
@@ -1218,4 +1299,15 @@ void test_listFilterCombined(TestNamespace ns) {
   private LearningResourceService getLearningResourceService() {
     return new LearningResourceService(SdkClients.adminClient().getHttpClient());
   }
+
+  private CreateLearningResource newTypedRequest(
+      TestNamespace ns, String name, CreateLearningResource.ResourceType type, String url) {
+    return new CreateLearningResource()
+        .withName(ns.prefix(name + "-" + type.value().toLowerCase()))
+        .withDescription(type.value() + " resource")
```

**File**: `openmetadata-service/LEARNING_RESOURCES_DESIGN.md` (modified, +19/-3)
```diff
@@ -30,7 +30,7 @@ The Learning Resources system provides contextual, in-product learning materials
 
 - **User-Initiated:** Resources only appear when users click the lightbulb (💡) icon - no automatic inline display
 - **Contextual:** Resources are matched to specific pages (glossary, domain, data products, etc.) and optional component IDs
-- **Multi-Format:** Supports Articles (markdown), Videos (YouTube/Vimeo), and Interactive Demos (Storylane)
+- **Multi-Format:** Supports Articles (markdown), Videos (YouTube/Vimeo), Interactive Demos (Storylane), Links to external guidance, and PDFs
 - **Simple:** No progress tracking, no badges, no gamification - just content delivery
 - **Admin-Managed:** Full CRUD interface for creating and managing learning resources
 
@@ -86,11 +86,12 @@ The Learning Resources system provides contextual, in-product learning materials
 2. **Sees lightbulb (💡) icon** in page header with badge count (e.g., "3")
 3. **Clicks lightbulb** → Side drawer opens from right
 4. **Sees list** of relevant learning resources (filtered by page context)
-5. **Clicks a resource** → Full modal opens with content player
+5. **Clicks a resource** → Full modal opens with content player (a Link opens in a new browser tab instead)
 6. **Views content:**
    - Article: Markdown rendered with full formatting
    - Video: YouTube/Vimeo embedded player
    - Storylane: Interactive demo iframe
+   - PDF: Embedded in an iframe, with an "Open in New Tab" fallback for hosts that block embedding
 7. **Closes modal** when done
 8. **Can access** other resources from drawer
 
@@ -114,7 +115,7 @@ The Learning Resources system provides contextual, in-product learning materials
 - `name` (required): Unique identifier (e.g., "Intro_GlossaryBasics")
 - `displayName`: Human-readable title
 - `description`: Brief summary
-- `resourceType`: `Article` | `Video` | `Storylane`
+- `resourceType`: `Article` | `Video` | `Storylane` | `Link` | `PDF` (`Link` and `PDF` require an `http`/`https` URL)
 - `categories`: Array of categories (Discovery, DataGovernance, DataQuality, Administration, Observability)
 - `difficulty`: `Intro` | `Intermediate` | `Advanced`
 - `source`:
@@ -287,9 +288,12 @@ switch (resource.resourceType) {
   case 'Video':     return <VideoPlayer resource={resource} />;
   case 'Storylane': return <StorylaneTour resource={resource} />;
   case 'Article':   return <ArticleViewer resource={resource} />;
+  case 'PDF':       return <PdfViewer resource={resource} />;
 }
 ```
 
+`Link` resources never reach the player: the learning drawer and the admin preview open their URL in a new tab.
+
 #### 4. VideoPlayer (YouTube/Vimeo)
 
 **File:** `src/components/Learning/ResourcePlayer/VideoPlayer.component.tsx`
@@ -336,6 +340,18 @@ switch (resource.resourceType) {
 - No truncation (`enableSeeMoreVariant={false}`)
 - Full markdown support (headers, lists, code blocks, links, etc.)
 
+#### 6a. PdfViewer (PDF Documents)
+
+**File:** `src/components/Learning/ResourcePlayer/PdfViewer.tsx`
+
+**Purpose:** Displays a PDF hosted at an `http`/`https` URL
+
+**Features:**
+- Embeds the PDF in an iframe using the browser's built-in PDF viewer
+- The iframe is not sandboxed, because browsers disable their PDF viewer inside sandboxed frames
+- "Open in New Tab" link for document hosts that block embedding (`X-Frame-Options` / `frame-ancestors`)
+- Renders nothing embeddable for non-web URLs
+
 #### 7. LearningResourceCard
 
 **File:** `src/components/Learning/LearningResourceCard/LearningResourceCard.component.tsx`
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/LearningResourceRepository.java` (modified, +28/-0)
```diff
@@ -16,14 +16,18 @@
 import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
 import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
 
+import java.net.URI;
 import java.util.ArrayList;
 import java.util.Arrays;
+import java.util.EnumSet;
 import java.util.HashSet;
 import java.util.LinkedHashSet;
 import java.util.List;
+import java.util.Locale;
 import java.util.Set;
 import lombok.extern.slf4j.Slf4j;
 import org.apache.commons.lang3.StringUtils;
+import org.openmetadata.schema.api.learning.CreateLearningResource.ResourceType;
 import org.openmetadata.schema.api.learning.ResourceCategory;
 import org.openmetadata.schema.entity.learning.LearningResource;
 import org.openmetadata.schema.entity.learning.LearningResourceContext;
@@ -44,6 +48,11 @@ public class LearningResourceRepository extends EntityRepository<LearningResourc
   private static final String UPDATE_FIELDS =
       "owners,reviewers,tags,contexts,categories,difficulty,source,estimatedDuration,status";
   private static final String PATCH_FIELDS = UPDATE_FIELDS;
+  // The UI opens Link URLs in a new tab and frames PDF URLs, so other schemes (javascript:, data:)
+  // would run in the product's origin.
+  private static final Set<ResourceType> WEB_URL_ONLY_TYPES =
+      EnumSet.of(ResourceType.LINK, ResourceType.PDF);
+  private static final Set<String> WEB_URL_SCHEMES = Set.of("http", "https");
 
   public LearningResourceRepository() {
     super(
@@ -133,6 +142,7 @@ public void setFullyQualifiedName(LearningResource entity) {
   @Override
   public void prepare(LearningResource entity, boolean update) {
     validateSource(entity.getSource());
+    validateSourceUrlScheme(entity);
     ensureCategories(entity);
     validateContexts(entity.getContexts());
     validateDuration(entity.getEstimatedDuration());
@@ -173,6 +183,20 @@ private void validateSource(LearningResourceSource source) {
     }
   }
 
+  private void validateSourceUrlScheme(LearningResource entity) {
+    if (WEB_URL_ONLY_TYPES.contains(entity.getResourceType())
+        && !isWebUrl(entity.getSource().getUrl())) {
+      throw BadRequestException.of(
+          "Learning resource of type '%s' requires an http or https URL"
+              .formatted(entity.getResourceType().value()));
+    }
+  }
+
+  private static boolean isWebUrl(URI url) {
+    String scheme = url.getScheme();
+    return scheme != null && WEB_URL_SCHEMES.contains(scheme.toLowerCase(Locale.ROOT));
+  }
+
   private void ensureCategories(LearningResource entity) {
     List<ResourceCategory> categories = entity.getCategories();
     if (nullOrEmpty(categories)) {
@@ -411,6 +435,10 @@ class LearningResourceUpdater extends EntityUpdater {
 
     @Override
     public void entitySpecificUpdate(boolean consolidatingChanges) {
+      compareAndUpdate(
+          "resourceType",
+          () ->
+              recordChange("resourceType", original.getResourceType(), updated.getResourceType()));
       compareAndUpdate("categories", this::run);
       compareAndUpdate(
           "contexts",
```

**File**: `openmetadata-spec/src/main/resources/json/schema/entity/learning/learningResource.json` (modified, +6/-4)
```diff
@@ -2,19 +2,21 @@
   "$id": "https://open-metadata.org/schema/entity/learning/learningResource.json",
   "$schema": "https://json-schema.org/draft/2020-12/schema",
   "title": "LearningResource",
-  "description": "A learning resource such as an in-product tutorial, Storylane walkthrough, or expert video contextualized for product surfaces.",
+  "description": "A learning resource such as an in-product tutorial, Storylane walkthrough, expert video, or link to external guidance, contextualized for product surfaces.",
   "$comment": "@om-entity-type",
   "type": "object",
   "javaType": "org.openmetadata.schema.entity.learning.LearningResource",
   "javaInterfaces": ["org.openmetadata.schema.EntityInterface"],
   "definitions": {
     "resourceType": {
-      "description": "Kind of learning asset represented.",
+      "description": "Kind of learning asset represented. A Link opens its URL in a new browser tab; a PDF is displayed in the resource player.",
       "type": "string",
       "enum": [
         "Storylane",
         "Video",
-        "Article"
+        "Article",
+        "Link",
+        "PDF"
       ]
     },
     "resourceCategory": {
@@ -48,7 +50,7 @@
           "type": "string"
         },
         "url": {
-          "description": "Canonical URL.",
+          "description": "Canonical URL. Link and PDF resources require an http or https URL.",
           "type": "string",
           "format": "uri"
         },
```

**File**: `openmetadata-ui-core-components/src/main/resources/ui/icons-custom/learning-link.svg` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
+<path d="M2 4C2 1.79086 3.79086 0 6 0H12L18 6V16C18 18.2091 16.2091 20 14 20H6C3.79086 20 2 18.2091 2 16V4Z" fill="#079455"/>
+<path opacity="0.3" d="M12 0L18 6H16C13.7909 6 12 4.20914 12 2V0Z" fill="white"/>
+<path transform="translate(6 8) scale(0.3333)" d="M12.708 18.364L11.293 19.778A5 5 0 1 1 4.223 12.708L5.636 11.293M18.364 12.707L19.779 11.293A5 5 0 0 0 12.708 4.222L11.293 5.636M8.5 15.5L15.5 8.5" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
+</svg>
```

**File**: `openmetadata-ui-core-components/src/main/resources/ui/icons-custom/learning-pdf.svg` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
+<path d="M2 4C2 1.79086 3.79086 0 6 0H12L18 6V16C18 18.2091 16.2091 20 14 20H6C3.79086 20 2 18.2091 2 16V4Z" fill="#E04F16"/>
+<path opacity="0.3" d="M12 0L18 6H16C13.7909 6 12 4.20914 12 2V0Z" fill="white"/>
+<path transform="translate(10 12.5) scale(0.52) translate(-14.115 -26.365)" d="M4.8323 30V22.7273H7.70162C8.25323 22.7273 8.72316 22.8326 9.11142 23.0433C9.49967 23.2517 9.7956 23.5417 9.9992 23.9134C10.2052 24.2827 10.3082 24.7088 10.3082 25.1918C10.3082 25.6747 10.204 26.1009 9.99565 26.4702C9.78732 26.8395 9.48547 27.1271 9.09011 27.3331C8.69712 27.5391 8.22127 27.642 7.66255 27.642H5.83372V26.4098H7.41397C7.7099 26.4098 7.95375 26.3589 8.14551 26.2571C8.33964 26.1529 8.48405 26.0097 8.57875 25.8274C8.67581 25.6428 8.72434 25.4309 8.72434 25.1918C8.72434 24.9503 8.67581 24.7396 8.57875 24.5597C8.48405 24.3774 8.33964 24.2365 8.14551 24.1371C7.95138 24.0353 7.70517 23.9844 7.40687 23.9844H6.36994V30H4.8323ZM13.885 30H11.3069V22.7273H13.9063C14.6379 22.7273 15.2676 22.8729 15.7955 23.1641C16.3235 23.4529 16.7295 23.8684 17.0136 24.4105C17.3 24.9527 17.4433 25.6013 17.4433 26.3565C17.4433 27.1141 17.3 27.7652 17.0136 28.3097C16.7295 28.8542 16.3211 29.272 15.7884 29.5632C15.2581 29.8544 14.6237 30 13.885 30ZM12.8445 28.6825H13.8211C14.2757 28.6825 14.658 28.602 14.9681 28.4411C15.2806 28.2777 15.515 28.0256 15.6713 27.6847C15.8299 27.3414 15.9092 26.8987 15.9092 26.3565C15.9092 25.8191 15.8299 25.38 15.6713 25.0391C15.515 24.6982 15.2818 24.4472 14.9717 24.2862C14.6615 24.1252 14.2792 24.0447 13.8247 24.0447H12.8445V28.6825ZM18.5823 30V22.7273H23.3976V23.995H20.1199V25.728H23.078V26.9957H20.1199V30H18.5823Z" fill="white"/>
+</svg>
```

**File**: `openmetadata-ui-core-components/src/main/resources/ui/src/icons/LearningLink.tsx` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+/*
+ *  Copyright 2025 Collate.
+ *  Licensed under the Apache License, Version 2.0 (the "License");
+ *  you may not use this file except in compliance with the License.
+ *  You may obtain a copy of the License at
+ *  http://www.apache.org/licenses/LICENSE-2.0
+ *  Unless required by applicable law or agreed to in writing, software
+ *  distributed under the License is distributed on an "AS IS" BASIS,
+ *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ *  See the License for the specific language governing permissions and
+ *  limitations under the License.
+ */
+import * as React from 'react';
+import type { SVGProps, FC } from 'react';
+interface Props extends SVGProps<SVGSVGElement> {
+  color?: string;
+  size?: number;
+}
+
+export const LearningLink: FC<Props> = ({
+  size = 24,
+  color: _color = 'currentColor',
+  ...props
+}) => (
+  <svg
+    aria-hidden="true"
+    fill="none"
+    height={size}
+    viewBox="0 0 20 20"
+    width={size}
+    {...props}>
+    <path
+      d="M2 4a4 4 0 0 1 4-4h6l6 6v10a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"
+      fill="#079455"
+    />
+    <path d="m12 0 6 6h-2a4 4 0 0 1-4-4z" fill="#fff" opacity={0.3} />
+    <path
+      d="m10.236 14.12-.472.472a1.666 1.666 0 1 1-2.356-2.356l.47-.472m4.243.471.471-.471a1.666 1.666 0 0 0-2.356-2.357l-.472.471m-.93 3.288 2.332-2.333"
+      stroke="#fff"
+      strokeLinecap="round"
+      strokeLinejoin="round"
+    />
+  </svg>
+);
+LearningLink.displayName = 'LearningLink';
```

**File**: `openmetadata-ui-core-components/src/main/resources/ui/src/icons/LearningPdf.tsx` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+/*
+ *  Copyright 2025 Collate.
+ *  Licensed under the Apache License, Version 2.0 (the "License");
+ *  you may not use this file except in compliance with the License.
+ *  You may obtain a copy of the License at
+ *  http://www.apache.org/licenses/LICENSE-2.0
+ *  Unless required by applicable law or agreed to in writing, software
+ *  distributed under the License is distributed on an "AS IS" BASIS,
+ *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ *  See the License for the specific language governing permissions and
+ *  limitations under the License.
+ */
+import * as React from 'react';
+import type { SVGProps, FC } from 'react';
+interface Props extends SVGProps<SVGSVGElement> {
+  color?: string;
+  size?: number;
+}
+
+export const LearningPdf: FC<Props> = ({
+  size = 24,
+  color: _color = 'currentColor',
+  ...props
+}) => (
+  <svg
+    aria-hidden="true"
+    fill="none"
+    height={size}
+    viewBox="0 0 20 20"
+    width={size}
+    {...props}>
+    <path
+      d="M2 4a4 4 0 0 1 4-4h6l6 6v10a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"
+      fill="#E04F16"
+    />
+    <path d="m12 0 6 6h-2a4 4 0 0 1-4-4z" fill="#fff" opacity={0.3} />
+    <path
+      d="M5.173 14.39v-3.782h1.492q.43 0 .733.165.303.162.462.452.16.288.16.665t-.162.665a1.1 1.1 0 0 1-.47.448q-.308.162-.743.161h-.951v-.64h.821q.231 0 .38-.08a.53.53 0 0 0 .226-.224.7.7 0 0 0 .076-.33.7.7 0 0 0-.076-.329.5.5 0 0 0-.225-.22.8.8 0 0 0-.384-.079h-.54v3.128zm4.707 0H8.54v-3.782h1.35q.57 0 .983.228.412.225.633.648.224.423.224 1.012 0 .59-.224 1.015-.221.424-.637.652-.413.227-.99.227m-.54-.685h.507q.355 0 .597-.125a.8.8 0 0 0 .365-.394q.124-.267.124-.69 0-.42-.124-.685a.8.8 0 0 0-.364-.392 1.3 1.3 0 0 0-.596-.126h-.51zm2.983.685v-3.782h2.504v.66h-1.704v.9h1.538v.66h-1.538v1.562z"
+      fill="#fff"
+    />
+  </svg>
+);
+LearningPdf.displayName = 'LearningPdf';
```

---

### Incident Patch 2: `0328cf73` (2026-10-05)
**Commit Message**: fix(lineage): keep an edge's SQL when a column rename or delete rewrites its column lineage (#34657)

LineageRepository.updateColumnLineage replaced the stored sqlQuery of every
lineage edge whose column mappings it rewrote with the table's own
schemaDefinition: null for a plain table, the view DDL for a view. Only the
relationship row was written. Search kept the original SQL, since the column
reconcile script rewrites column FQNs only, so the query disappeared from the
lineage edge after the next reindex. The lineage map, which loads the edge
drawer from the stored edge, showed no query at all.

Column renames and deletes now rewrite the column mappings only.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/TableResourceIT.java` (modified, +195/-7)
```diff
@@ -4352,13 +4352,157 @@ void test_renamedAndDeletedColumnsInSamePatchPropagateInSearch(TestNamespace ns)
     }
   }
 
+  // #34656: rewriting an edge's column mappings for a column delete must keep the edge's
+  // SQL. Reindex rebuilds upstreamLineage from the stored edge, so a query lost here vanishes from
+  // search only after the next reindex.
+  @Test
+  void test_deletedColumnKeepsLineageSqlQuery(TestNamespace ns) throws Exception {
+    OpenMetadataClient client = SdkClients.adminClient();
+    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
+    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
+    Table source =
+        client
+            .tables()
+            .create(
+                new CreateTable()
+                    .withName(ns.prefix("sql_keep_src"))
+                    .withDatabaseSchema(schema.getFullyQualifiedName())
+                    .withColumns(
+                        List.of(
+                            ColumnBuilder.of("keep_col", "BIGINT").build(),
+                            ColumnBuilder.of("drop_col", "BIGINT").build())));
+    Table target =
+        client
+            .tables()
+            .create(
+                new CreateTable()
+                    .withName(ns.prefix("sql_keep_tgt"))
+                    .withDatabaseSchema(schema.getFullyQualifiedName())
+                    .withColumns(List.of(ColumnBuilder.of("tgt_col", "BIGINT").build())));
+    String keepColFqn = source.getFullyQualifiedName() + ".keep_col";
+    String dropColFqn = source.getFullyQualifiedName() + ".drop_col";
+    String sqlQuery = "INSERT INTO sql_keep_tgt SELECT keep_col + drop_col FROM sql_keep_src";
+    addLineage(
+        client,
+        source,
+        target,
+        new LineageDetails()
+            .withSqlQuery(sqlQuery)
+            .withColumnsLineage(
+                List.of(
+                    new ColumnLineage()
+                        .withFromColumns(List.of(keepColFqn, dropColFqn))
+                        .withToColumn(target.getFullyQualifiedName() + ".tgt_col"))));
+
+    try (Rest5Client searchClient = TestSuiteBootstrap.createSearchClient()) {
+      Awaitility.await("Wait for column lineage to be indexed in search")
+          .atMost(Duration.ofSeconds(30))
+          .pollInterval(Duration.ofSeconds(2))
+          .ignoreExceptions()
+          .until(
+              () ->
+                  getUpstreamLineageFromIndex(searchClient, target.getId().toString())
+                      .contains(dropColFqn));
+
+      source.setColumns(List.of(ColumnBuilder.of("keep_col", "BIGINT").build()));
+      client.tables().update(source.getId().toString(), source);
+
+      // Settle the deferred search flush first, so no live write lands after the reindex below.
+      Awaitility.await("Wait for deleted column lineage to be removed from search")
+          .atMost(Duration.ofSeconds(30))
+          .pollInterval(Duration.ofSeconds(2))
+          .ignoreExceptions()
+          .until(
+              () ->
+                  !getUpstreamLineageFromIndex(searchClient, target.getId().toString())
+                      .contains(dropColFqn));
+
+      JsonNode live = readDocumentSource(searchClient, tableDocPath(target));
+      assertEquals(sqlQuery, resolveLineageSqlQuery(live));
+
+      JsonNode reindexed = reindexAndReadSource(client, searchClient, target);
+      assertEquals(1, reindexed.path("upstreamLineage").size());
+      assertEquals(sqlQuery, resolveLineageSqlQuery(reindexed));
+
+      JsonNode storedEdge = getStoredLineageEdge(client, source, target);
+      assertEquals(
+          JsonUtils.valueToTree(List.of(keepColFqn)),
+          storedEdge.at("/columnsLineage/0/fromColumns"));
+      assertEquals(sqlQuery, storedEdge.path("sqlQuery").asText(null));
+    }
+  }
+
+  // #34656: the rename leg, on the downstream side of the edge. A case-only rename populates
+  // the rename map (see test_renamedColumnLineagePropagatesInSearch).
+  @Test
+  void test_renamedColumnKeepsLineageSqlQuery(TestNamespace ns) throws Exception {
+    OpenMetadataClient client = SdkClients.adminClient();
+    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
+    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
+    Table source =
+        client
+            .tables()
+            .create(
+                new CreateTable()
+                    .withName(ns.prefix("sql_ren_src"))
+                    .withDatabaseSchema(schema.getFullyQualifiedName())
+                    .withColumns(List.of(ColumnBuilder.of("src_col", "BIGINT").build())));
+    Table target =
+        client
+            .tables()
+            .create(
+                new CreateTable()
+                    .withName(ns.prefix("sql_ren_tgt"))
+                    .withDatabaseSchema(schema.getFullyQualifiedName())
+                    .withColumns(List.of(ColumnBuilder.of("tgt_col", "BIGINT"
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/LineageRepository.java` (modified, +3/-8)
```diff
@@ -1762,11 +1762,7 @@ private void getDownstreamLineage(
 
   @Transaction
   public void updateColumnLineage(
-      UUID tableId,
-      Map<String, String> renamed,
-      List<String> deleted,
-      String schemaDefinition,
-      String updatedBy) {
+      UUID tableId, Map<String, String> renamed, List<String> deleted, String updatedBy) {
     if ((renamed == null || renamed.isEmpty()) && (deleted == null || deleted.isEmpty())) {
       return;
     }
@@ -1777,10 +1773,10 @@ public void updateColumnLineage(
     List<CollectionDAO.EntityRelationshipObject> lineageRows = new ArrayList<>();
     List<String> tableIdList = List.of(tableId.toString());
 
-    // Table is upstream
+    // Table is downstream
     lineageRows.addAll(
         dao.relationshipDAO().findFromBatch(tableIdList, Relationship.UPSTREAM.ordinal()));
-    // Table is downstream
+    // Table is upstream
     lineageRows.addAll(
         dao.relationshipDAO()
             .findToBatch(tableIdList, Relationship.UPSTREAM.ordinal(), Entity.TABLE, Entity.TABLE));
@@ -1790,7 +1786,6 @@ public void updateColumnLineage(
         LineageDetails details = JsonUtils.readValue(row.getJson(), LineageDetails.class);
         boolean rowModified = rewriteColumnMappings(details, fqnRenameMap, deletedFqns);
         if (rowModified) {
-          details.setSqlQuery(schemaDefinition);
           details.setUpdatedAt(System.currentTimeMillis());
           details.setUpdatedBy(updatedBy);
           // UPSERT the updated lineage JSON back into the relationship table
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/TableRepository.java` (modified, +1/-5)
```diff
@@ -2434,11 +2434,7 @@ protected void handleColumnLineageUpdates(
         LineageRepository lineageRepository = Entity.getLineageRepository();
         if (lineageRepository != null) {
           lineageRepository.updateColumnLineage(
-              updated.getId(),
-              originalUpdatedColumnFqnMap,
-              deletedColumns,
-              updated.getSchemaDefinition(),
-              updated.getUpdatedBy());
+              updated.getId(), originalUpdatedColumnFqnMap, deletedColumns, updated.getUpdatedBy());
         }
         List<String> deletedColumnFqns = List.copyOf(deletedColumns);
         HashMap<String, String> renamedColumnFqns = new HashMap<>(originalUpdatedColumnFqnMap);
```

---

### Incident Patch 3: `b2d4e024` (2026-10-05)
**Commit Message**: Fixes #23002: Add createdAt/createdBy creation audit and show table creation time (#34025)

* feat(entity): add createdAt/createdBy creation audit fields (#23002)

Add OpenMetadata-internal creation audit, the counterpart to updatedAt/updatedBy, on 15 entities
(12 data assets plus user, team and role).

- Schemas declare createdAt/createdBy and implement a new CreationAudited interface. The accessors
  cannot live on EntityInterface: Task already declares a required createdBy of type
  EntityReference.
- EntityRepository stamps them in the three create funnels (createNewEntity, createManyEntities,
  createManyEntitiesForImport) and carries them from the stored entity in every update path, so
  PUT and PATCH cannot move them.
- A 2.1.0 data migration backfills existing rows from the oldest entity_extension version and falls
  back to the row's own updatedAt/updatedBy when there is no history. Idempotent on MySQL and
  Postgres.
- Search mappings index createdAt (epoch_millis) and createdBy (keyword).
- The Table header shows the source creation time that connectors already write to
  lifeCycle.created (BigQuery, Snowflake, Redshift).

* chore(playwright): auto-refresh impact-map.gen

**File**: `.github/playwright/impact-map.generated.json` (modified, +7/-1)
```diff
@@ -778,6 +778,7 @@
         "playwright/e2e/Pages/ODCSImportExport.spec.ts",
         "playwright/e2e/Pages/ODCSImportExportPermissions.spec.ts",
         "playwright/e2e/Pages/TableAliases.spec.ts",
+        "playwright/e2e/Pages/TableCreationTime.spec.ts",
         "playwright/e2e/Pages/TestSuite.spec.ts",
         "playwright/e2e/Pages/TestSuiteDetailsPage.spec.ts",
         "playwright/e2e/Pages/UserCreationWithPersona.spec.ts"
@@ -1725,6 +1726,7 @@
         "playwright/e2e/Pages/ODCSImportExportPermissions.spec.ts",
         "playwright/e2e/Pages/SearchSettings.spec.ts",
         "playwright/e2e/Pages/TableAliases.spec.ts",
+        "playwright/e2e/Pages/TableCreationTime.spec.ts",
         "playwright/e2e/Pages/TagPageRightPanel.spec.ts",
         "playwright/e2e/Pages/Tags.spec.ts",
         "playwright/e2e/Pages/TaskComments.spec.ts",
@@ -3036,6 +3038,7 @@
         "playwright/e2e/Pages/SearchSettings.spec.ts",
         "playwright/e2e/Pages/ServiceEntity.spec.ts",
         "playwright/e2e/Pages/TableAliases.spec.ts",
+        "playwright/e2e/Pages/TableCreationTime.spec.ts",
         "playwright/e2e/Pages/Tag.spec.ts",
         "playwright/e2e/Pages/TagPageRightPanel.spec.ts",
         "playwright/e2e/Pages/TaskFormSettings.spec.ts",
@@ -3514,6 +3517,7 @@
         "playwright/e2e/Pages/ServiceListing.spec.ts",
         "playwright/e2e/Pages/SubDomainPagination.spec.ts",
         "playwright/e2e/Pages/TableAliases.spec.ts",
+        "playwright/e2e/Pages/TableCreationTime.spec.ts",
         "playwright/e2e/Pages/Tag.spec.ts",
         "playwright/e2e/Pages/TagPageRightPanel.spec.ts",
         "playwright/e2e/Pages/Tags.spec.ts",
@@ -5717,7 +5721,8 @@
         "playwright/e2e/Pages/DataContracts.spec.ts",
         "playwright/e2e/Pages/DataContractsSemanticRules.spec.ts",
         "playwright/e2e/Pages/ExplorePageRightPanel_KnowledgeCenter.spec.ts",
-        "playwright/e2e/Pages/IngestionLogStreamLive.spec.ts"
+        "playwright/e2e/Pages/IngestionLogStreamLive.spec.ts",
+        "playwright/e2e/Pages/TableCreationTime.spec.ts"
       ]
     },
     {
@@ -11086,6 +11091,7 @@
         "playwright/e2e/Pages/ServiceListing.spec.ts",
         "playwright/e2e/Pages/SubDomainPagination.spec.ts",
         "playwright/e2e/Pages/TableAliases.spec.ts",
+        "playwright/e2e/Pages/TableCreationTime.spec.ts",
         "playwright/e2e/Pages/Tag.spec.ts",
         "playwright/e2e/Pages/TagPageRightPanel.spec.ts",
         "playwright/e2e/Pages/Tags.spec.ts",
```

**File**: `ingestion/src/metadata/ingestion/source/database/life_cycle_query_mixin.py` (modified, +21/-11)
```diff
@@ -95,10 +95,16 @@ def life_cycle_query_dict(self, query: str) -> dict[str, list[LifeCycleQueryByTa
         return queries_dict
 
     @staticmethod
-    def _build_access_details(value: datetime | None) -> AccessDetails:
-        """Convert a source timestamp into an AccessDetails, defaulting to the minimum date."""
-        source_datetime = value if value else datetime.min
-        timestamp_value = datetime_to_timestamp(source_datetime, milliseconds=True)
+    def _build_access_details(value: datetime | None) -> AccessDetails | None:
+        """
+        Convert a source timestamp into an AccessDetails, or None when the source reported none.
+
+        A missing timestamp must stay missing: substituting a placeholder date stores a fabricated
+        value that clients cannot tell apart from a real one.
+        """
+        if value is None:
+            return None
+        timestamp_value = datetime_to_timestamp(value, milliseconds=True)
         return AccessDetails(timestamp=Timestamp(timestamp_value))  # pyright: ignore[reportCallIssue]
 
     def get_life_cycle_data(self, entity: type[Entity], entity_name: str, entity_fqn: str, query: str):
@@ -108,13 +114,17 @@ def get_life_cycle_data(self, entity: type[Entity], entity_name: str, entity_fqn
         try:
             life_cycle_data = self.life_cycle_query_dict(query=query).get(entity_name)
             if life_cycle_data:
-                life_cycle = LifeCycle(  # pyright: ignore[reportCallIssue]
-                    created=self._build_access_details(life_cycle_data.created_at)  # pyright: ignore[reportAttributeAccessIssue]
-                )
-                if life_cycle_data.updated_at:  # pyright: ignore[reportAttributeAccessIssue]
-                    life_cycle.updated = self._build_access_details(life_cycle_data.updated_at)  # pyright: ignore[reportAttributeAccessIssue]
-
-                yield Either(right=OMetaLifeCycleData(entity=entity, entity_fqn=entity_fqn, life_cycle=life_cycle))
+                created = self._build_access_details(life_cycle_data.created_at)  # pyright: ignore[reportAttributeAccessIssue]
+                updated = self._build_access_details(life_cycle_data.updated_at)  # pyright: ignore[reportAttributeAccessIssue]
+                # The server keeps each stored aspect when the incoming one is empty or older, so a
+                # record with neither would be a no-op patch. Placeholder `created` values written by
+                # earlier runs are removed by the 2.1.0 data migration, not by ingestion.
+                if created is not None or updated is not None:
+                    life_cycle = LifeCycle(created=created, updated=updated)  # pyright: ignore[reportCallIssue]
+                    yield Either(
+                        left=None,
+                        right=OMetaLifeCycleData(entity=entity, entity_fqn=entity_fqn, life_cycle=life_cycle),
+                    )
         except Exception as exc:
             yield Either(
                 left=StackTraceError(
```

**File**: `ingestion/tests/unit/topology/database/test_life_cycle_query_mixin.py` (modified, +17/-0)
```diff
@@ -86,3 +86,20 @@ def test_updated_absent_keeps_created_only(self):
         life_cycle = results[0].right.life_cycle
         assert life_cycle.created.timestamp.root == datetime_to_timestamp(CREATED_AT, milliseconds=True)
         assert life_cycle.updated is None
+
+    def test_missing_created_is_not_replaced_by_placeholder(self):
+        life_cycle_data = LifeCycleQueryByTable(table_name=TABLE_NAME, created_at=None, updated_at=UPDATED_AT)
+
+        results = _run_get_life_cycle_data(life_cycle_data)
+
+        assert len(results) == 1
+        life_cycle = results[0].right.life_cycle
+        assert life_cycle.created is None
+        assert life_cycle.updated.timestamp.root == datetime_to_timestamp(UPDATED_AT, milliseconds=True)
+
+    def test_row_without_timestamps_yields_nothing(self):
+        life_cycle_data = LifeCycleQueryByTable(table_name=TABLE_NAME)
+
+        results = _run_get_life_cycle_data(life_cycle_data)
+
+        assert results == []
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/BaseEntityIT.java` (modified, +68/-0)
```diff
@@ -35,6 +35,7 @@
 import org.openmetadata.it.util.TestNamespace;
 import org.openmetadata.it.util.TestNamespaceExtension;
 import org.openmetadata.it.util.UpdateType;
+import org.openmetadata.schema.CreationAudited;
 import org.openmetadata.schema.EntityInterface;
 import org.openmetadata.schema.api.domains.CreateDataProduct;
 import org.openmetadata.schema.api.governance.EntityLifecycleStages;
@@ -187,6 +188,8 @@ protected String getResourcePath() {
   protected boolean supportsEmptyDescription = true;
   protected boolean supportsNameLengthValidation = true;
   protected boolean supportsBulkAPI = false; // Override in subclasses that support bulk API
+  // Set true in subclasses whose entity schema declares createdAt/createdBy (see issue #23002).
+  protected boolean supportsCreationAudit = false;
   protected boolean supportsSearchIndex = true; // Override in subclasses that don't support search
   // Set true in subclasses whose list endpoint accepts `?sortBy=updatedAt&sortOrder=desc` and
   // routes to EntityRepository.listFromSearchWithOffset. Used by the follower-regression test
@@ -687,6 +690,71 @@ void put_entityUpdateWithNoChange_200(TestNamespace ns) {
         originalVersion, updated.getVersion(), 0.001, "Version should not change for no-op update");
   }
 
+  // ===================================================================
+  // CREATION AUDIT TESTS (createdAt / createdBy — issue #23002)
+  // ===================================================================
+
+  /** Test: a newly created entity is stamped with createdAt/createdBy matching updatedAt/updatedBy. */
+  @Test
+  void post_entityCreationAuditIsStamped_200(TestNamespace ns) {
+    if (!supportsCreationAudit) return;
+
+    T created = createEntity(createMinimalRequest(ns));
+    CreationAudited audit = creationAudit(created);
+
+    assertNotNull(audit.getCreatedAt(), "createdAt should be set on create");
+    assertNotNull(audit.getCreatedBy(), "createdBy should be set on create");
+    assertEquals(
+        created.getUpdatedAt(), audit.getCreatedAt(), "createdAt should equal updatedAt on create");
+    assertEquals(
+        created.getUpdatedBy(), audit.getCreatedBy(), "createdBy should equal updatedBy on create");
+
+    CreationAudited fetched = creationAudit(getEntity(created.getId().toString()));
+    assertEquals(audit.getCreatedAt(), fetched.getCreatedAt(), "createdAt should round-trip");
+    assertEquals(audit.getCreatedBy(), fetched.getCreatedBy(), "createdBy should round-trip");
+  }
+
+  private CreationAudited creationAudit(T entity) {
+    if (entity instanceof CreationAudited audited) {
+      return audited;
+    }
+    throw new AssertionError(
+        entity.getClass().getSimpleName()
+            + " sets supportsCreationAudit but does not implement CreationAudited");
+  }
+
+  /**
+   * Test: creation audit is immutable. A PATCH that changes the entity — and deliberately tries to
+   * rewrite createdAt/createdBy — must leave both untouched while updatedAt moves forward.
+   */
+  @Test
+  void patch_entityCreationAuditIsImmutable_200(TestNamespace ns) {
+    if (!supportsCreationAudit || !supportsPatch) return;
+
+    T created = createEntity(createMinimalRequest(ns));
+    CreationAudited audit = creationAudit(created);
+    Long originalCreatedAt = audit.getCreatedAt();
+    String originalCreatedBy = audit.getCreatedBy();
+    assertNotNull(originalCreatedAt, "createdAt should be set on create");
+
+    created.setDescription("Creation audit immutability check");
+    audit.setCreatedAt(1L);
+    audit.setCreatedBy("someone-else");
+
+    T updated = patchEntity(created.getId().toString(), created);
+    CreationAudited updatedAudit = creationAudit(updated);
+
+    assertEquals(originalCreatedAt, updatedAudit.getCreatedAt(), "PATCH must not change createdAt");
+    assertEquals(originalCreatedBy, updatedAudit.getCreatedBy(), "PATCH must not change createdBy");
+    assertTrue(
+        updated.getUpdatedAt() >= originalCreatedAt,
+        "updatedAt should move forward while createdAt stays put");
+
+    CreationAudited fetched = creationAudit(getEntity(created.getId().toString()));
+    assertEquals(originalCreatedAt, fetched.getCreatedAt(), "createdAt should survive a re-read");
+    assertEquals(originalCreatedBy, fetched.getCreatedBy(), "createdBy should survive a re-read");
+  }
+
   // ===================================================================
   // DELETE RESTORE TESTS
   // ===================================================================
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/ChartResourceIT.java` (modified, +1/-0)
```diff
@@ -42,6 +42,7 @@ public class ChartResourceIT extends BaseEntityIT<Chart, CreateChart> {
 
   {
     supportsLifeCycle = true;
+    supportsCreationAudit = true;
     supportsListHistoryByTimestamp = true;
     supportsBulkAPI = true;
     supportsDataContract = true;
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/ContainerResourceIT.java` (modified, +1/-0)
```diff
@@ -62,6 +62,7 @@ public class ContainerResourceIT extends BaseEntityIT<Container, CreateContainer
 
   {
     supportsLifeCycle = true;
+    supportsCreationAudit = true;
     supportsListHistoryByTimestamp = true;
     supportsBulkAPI = true;
     supportsDataContract = true;
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/CreationAuditMigrationIT.java` (added, +247/-0)
```diff
@@ -0,0 +1,247 @@
+package org.openmetadata.it.tests;
+
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertNotNull;
+import static org.junit.jupiter.api.Assertions.assertNull;
+
+import java.util.UUID;
+import java.util.concurrent.atomic.AtomicInteger;
+import org.jdbi.v3.core.Handle;
+import org.jdbi.v3.core.Jdbi;
+import org.junit.jupiter.api.Test;
+import org.junit.jupiter.api.extension.ExtendWith;
+import org.junit.jupiter.api.parallel.Execution;
+import org.junit.jupiter.api.parallel.ExecutionMode;
+import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
+import org.openmetadata.it.factories.DatabaseServiceTestFactory;
+import org.openmetadata.it.factories.TableTestFactory;
+import org.openmetadata.it.util.SdkClients;
+import org.openmetadata.it.util.TestNamespace;
+import org.openmetadata.it.util.TestNamespaceExtension;
+import org.openmetadata.schema.entity.data.Database;
+import org.openmetadata.schema.entity.data.DatabaseSchema;
+import org.openmetadata.schema.entity.data.Table;
+import org.openmetadata.schema.entity.services.DatabaseService;
+import org.openmetadata.sdk.fluent.DatabaseSchemas;
+import org.openmetadata.sdk.fluent.Databases;
+import org.openmetadata.service.jdbi3.MigrationDAO;
+import org.openmetadata.service.jdbi3.locator.ConnectionType;
+import org.openmetadata.service.migration.utils.DataMigrationStep;
+import org.openmetadata.service.migration.utils.v210.CreationAuditMigration;
+
+/**
+ * Exercises the 2.1.0 creation-audit backfill against the real database in both dialects.
+ *
+ * <p>Rows created before 2.1.0 have no {@code createdAt}/{@code createdBy}. These tests recreate
+ * that state by stripping the fields from the stored JSON, then assert the migration recovers the
+ * values from version history and falls back to the entity's own timestamps when no history exists.
+ */
+// The backfill rewrites every table_entity row that is missing createdAt, so two of these tests
+// running at once would each repopulate the row the other just stripped. They must not interleave.
+@Execution(ExecutionMode.SAME_THREAD)
+@ExtendWith(TestNamespaceExtension.class)
+class CreationAuditMigrationIT {
+
+  private static final String TABLE_ENTITY = "table_entity";
+
+  @Test
+  void backfillRecoversCreationAuditFromOldestVersion(TestNamespace ns) throws Exception {
+    Table table = createTableWithVersionHistory(ns, "creation-audit-history");
+    long expectedCreatedAt = oldestVersionUpdatedAt(table.getId());
+    String expectedCreatedBy = oldestVersionUpdatedBy(table.getId());
+
+    stripCreationAudit(table.getId());
+    assertNull(readCreatedAt(table.getId()), "precondition: createdAt removed from stored row");
+
+    runBackfill();
+
+    assertEquals(
+        expectedCreatedAt,
+        readCreatedAt(table.getId()),
+        "createdAt should come from the oldest stored version");
+    assertEquals(
+        expectedCreatedBy,
+        readCreatedBy(table.getId()),
+        "createdBy should come from the oldest stored version");
+  }
+
+  @Test
+  void backfillFallsBackToCurrentStateWhenVersionHistoryIsMissing(TestNamespace ns)
+      throws Exception {
+    Table table = createTableWithVersionHistory(ns, "creation-audit-nohistory");
+    long currentUpdatedAt = readUpdatedAt(table.getId());
+    String currentUpdatedBy = readUpdatedBy(table.getId());
+
+    deleteVersionHistory(table.getId());
+    stripCreationAudit(table.getId());
+
+    runBackfill();
+
+    assertEquals(
+        currentUpdatedAt,
+        readCreatedAt(table.getId()),
+        "createdAt should fall back to the entity's own updatedAt");
+    assertEquals(
+        currentUpdatedBy,
+        readCreatedBy(table.getId()),
+        "createdBy should fall back to the entity's own updatedBy");
+  }
+
+  @Test
+  void backfillIsIdempotentAndLeavesExistingValuesAlone(TestNamespace ns) throws Exception {
+    Table table = createTableWithVersionHistory(ns, "creation-audit-idempotent");
+    Long createdAtAfterCreate = readCreatedAt(table.getId());
+    assertNotNull(createdAtAfterCreate, "a newly created table is already stamped");
+
+    runBackfill();
+    runBackfill();
+
+    assertEquals(
+        createdAtAfterCreate,
+        readCreatedAt(table.getId()),
+        "re-running the backfill must not move an already-populated createdAt");
+  }
+
+  /**
+   * The suite's bootstrap ran the real migration workflow, so this step already recorded its
+   * marker. A later re-run of 2.1.0, which any change to a v210 helper triggers, must skip it.
+   */
+  @Test
+  void upgradeRecordedTheBackfillSoAReRunSkipsIt() {
+    MigrationDAO migrationDAO = jdbi().onDemand(MigrationDAO.class);
+    AtomicInteger runs = new AtomicInteger();
+
+    DataMigrationStep.runOnce(
+        migrationDAO, "2.1.0", CreationAuditMigration.STEP_NAME, runs::incrementAndGet);
+
+    assertEquals(
+        0,
+        runs.get(),
+        "the upgrade already ran the backfill, so
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/DashboardDataModelResourceIT.java` (modified, +1/-0)
```diff
@@ -61,6 +61,7 @@ public class DashboardDataModelResourceIT
 
   {
     supportsLifeCycle = true;
+    supportsCreationAudit = true;
     supportsListHistoryByTimestamp = true;
     supportsBulkAPI = true;
     supportsDataContract = true;
```

---

### Incident Patch 4: `c1de8feb` (2026-10-05)
**Commit Message**: Fixes 27548: Create OpenLineage tables only under mapped services and report the rest (#34574)

* Fixes 27548: Create OpenLineage tables only under mapped services and report the rest

OpenLineageEntityResolver auto-created missing Pipelines and Tables through
repository.create(null, entity), which skips the create mapper that stamps
updatedAt and updatedBy. Both entity tables declare those as NOT NULL
generated columns, so the insert failed on Postgres and on MySQL alike (MySQL
checks VIRTUAL generated columns at insert, even with sql_mode=''). The
resolver logged the error and returned null, and the API still answered 200,
so auto-create never worked on either database.

Rather than restore that behavior, follow #28860 with tighter rules:

- A missing table is created only when its namespace maps to a database
  service through namespaceToServiceMapping (exact match, then longest
  prefix), and only with the columns its schema facet carries. A missing
  database and schema are created with it. Everything goes through the REST
  create mappers, so audit fields and validation match an API create, and
  columns are validated before anything is written.
- Pipelines are never created.

**File**: `ingestion/tests/integration/airflow/test_openlineage_lineage.py` (modified, +24/-8)
```diff
@@ -166,13 +166,13 @@ def ensure_ol_settings():
     assert resp.status_code == 200, f"Failed to set OL settings: {resp.text}"
 
 
-def _send_ol_event(
+def _post_ol_event(
     job_namespace: str,
     job_name: str,
     inputs: list,
     outputs: list,
     run_id: str = None,  # noqa: RUF013
-) -> dict:
+) -> requests.Response:
     event = {
         "eventType": "COMPLETE",
         "eventTime": "2026-03-23T12:00:00Z",
@@ -183,7 +183,17 @@ def _send_ol_event(
         "inputs": inputs,
         "outputs": outputs,
     }
-    resp = requests.post(OL_ENDPOINT, headers=AUTH_HEADERS, json=event, timeout=10)
+    return requests.post(OL_ENDPOINT, headers=AUTH_HEADERS, json=event, timeout=10)
+
+
+def _send_ol_event(
+    job_namespace: str,
+    job_name: str,
+    inputs: list,
+    outputs: list,
+    run_id: str = None,  # noqa: RUF013
+) -> dict:
+    resp = _post_ol_event(job_namespace, job_name, inputs, outputs, run_id)
     assert resp.status_code == 200, f"OL endpoint returned {resp.status_code}: {resp.text}"
     return resp.json()
 
@@ -221,13 +231,16 @@ def ol_lineage_result(ensure_ol_settings, ol_entities):
     deadline = time.monotonic() + 120
     result = {}
     while time.monotonic() < deadline:
-        result = _send_ol_event(
+        # Until the tables resolve, the event is rejected with 400 and the datasets it could not
+        # resolve, so keep retrying rather than asserting on the first answer.
+        resp = _post_ol_event(
             job_namespace="airflow_e2e_lineage",
             job_name="sample_transform",
             inputs=[_dataset(SOURCE_TABLE)],
             outputs=[_dataset(TARGET_TABLE)],
         )
-        if result.get("lineageEdgesCreated", 0) > 0:
+        result = resp.json()
+        if resp.status_code == 200 and result.get("lineageEdgesCreated", 0) > 0:
             return result
         time.sleep(5)
 
@@ -290,15 +303,18 @@ def test_lineage_references_existing_pipeline(self, metadata, ensure_ol_settings
         assert pipeline_ref["type"] == "pipeline"
         assert PIPELINE_NAME in pipeline_ref.get("fullyQualifiedName", "")
 
-    def test_no_edges_for_nonexistent_tables(self, ensure_ol_settings):
-        """OL events with unknown table names should create 0 edges."""
-        result = _send_ol_event(
+    def test_rejects_event_whose_tables_do_not_resolve(self, ensure_ol_settings):
+        """An event whose datasets match no table, under an unmapped namespace, is rejected."""
+        resp = _post_ol_event(
             job_namespace="test",
             job_name="unknown_job",
             inputs=[{"namespace": "nonexistent_service", "name": "fake_schema.fake_table"}],
             outputs=[{"namespace": "nonexistent_service", "name": "fake_schema.fake_output"}],
         )
+        assert resp.status_code == 400, resp.text
+        result = resp.json()
         assert result["lineageEdgesCreated"] == 0
+        assert {dataset["reason"] for dataset in result["unresolvedDatasets"]} == {"namespaceNotMapped"}
 
     def test_no_edges_for_empty_inputs_outputs(self, ensure_ol_settings):
         """OL events with no inputs/outputs should create 0 edges."""
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/OpenLineageLineageResolutionIT.java` (modified, +622/-27)
```diff
@@ -15,6 +15,8 @@
 
 import static org.junit.jupiter.api.Assertions.assertEquals;
 import static org.junit.jupiter.api.Assertions.assertNotNull;
+import static org.junit.jupiter.api.Assertions.assertNull;
+import static org.junit.jupiter.api.Assertions.assertThrows;
 import static org.junit.jupiter.api.Assertions.assertTrue;
 
 import com.fasterxml.jackson.databind.JsonNode;
@@ -25,27 +27,44 @@
 import java.util.List;
 import java.util.Map;
 import java.util.UUID;
+import java.util.concurrent.Callable;
 import org.awaitility.Awaitility;
 import org.junit.jupiter.api.BeforeAll;
 import org.junit.jupiter.api.MethodOrderer;
 import org.junit.jupiter.api.Order;
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.api.TestMethodOrder;
 import org.junit.jupiter.api.extension.ExtendWith;
+import org.junit.jupiter.api.function.Executable;
 import org.junit.jupiter.api.parallel.Execution;
 import org.junit.jupiter.api.parallel.ExecutionMode;
 import org.junit.jupiter.api.parallel.ResourceAccessMode;
 import org.junit.jupiter.api.parallel.ResourceLock;
+import org.openmetadata.it.factories.PipelineServiceTestFactory;
 import org.openmetadata.it.util.SdkClients;
 import org.openmetadata.it.util.SharedResourceLocks;
 import org.openmetadata.it.util.TestNamespace;
 import org.openmetadata.it.util.TestNamespaceExtension;
+import org.openmetadata.schema.EntityInterface;
+import org.openmetadata.schema.api.data.CreatePipeline;
+import org.openmetadata.schema.api.policies.CreatePolicy;
+import org.openmetadata.schema.api.teams.CreateRole;
+import org.openmetadata.schema.api.teams.CreateUser;
 import org.openmetadata.schema.entity.data.Database;
 import org.openmetadata.schema.entity.data.DatabaseSchema;
+import org.openmetadata.schema.entity.data.Pipeline;
 import org.openmetadata.schema.entity.data.Table;
+import org.openmetadata.schema.entity.policies.Policy;
+import org.openmetadata.schema.entity.policies.accessControl.Rule;
 import org.openmetadata.schema.entity.services.DatabaseService;
+import org.openmetadata.schema.entity.services.PipelineService;
+import org.openmetadata.schema.entity.teams.Role;
 import org.openmetadata.schema.type.Column;
 import org.openmetadata.schema.type.ColumnDataType;
+import org.openmetadata.schema.type.MetadataOperation;
+import org.openmetadata.sdk.client.OpenMetadataClient;
+import org.openmetadata.sdk.exceptions.InvalidRequestException;
+import org.openmetadata.sdk.exceptions.OpenMetadataException;
 import org.openmetadata.sdk.fluent.DatabaseSchemas;
 import org.openmetadata.sdk.fluent.DatabaseServices;
 import org.openmetadata.sdk.fluent.Databases;
@@ -55,6 +74,7 @@
 import org.openmetadata.sdk.fluent.wrappers.FluentTable;
 import org.openmetadata.sdk.network.HttpMethod;
 import org.openmetadata.sdk.network.RequestOptions;
+import org.openmetadata.service.Entity;
 
 /**
  * Integration tests for OpenLineage → lineage resolution.
@@ -77,6 +97,11 @@ public class OpenLineageLineageResolutionIT {
           new Column().withName("id").withDataType(ColumnDataType.BIGINT),
           new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255));
 
+  private static final String EVENT_TIME = "2024-01-15T10:00:00Z";
+  private static final long EVENT_TIME_MS = 1705312800000L;
+  private static final List<Map<String, Object>> FIELDS =
+      List.of(Map.of("name", "id", "type", "bigint"), Map.of("name", "name", "type", "string"));
+
   private static String srcFqn;
   private static String tgtFqn;
   private static String serviceName;
@@ -207,20 +232,23 @@ void testStartEventDoesNotCreateEdges(TestNamespace ns) throws Exception {
 
   @Test
   @Order(5)
-  void testUnresolvableDatasetsCreateNoEdges(TestNamespace ns) throws Exception {
-    String response =
-        OpenLineage.event()
-            .withEventType("COMPLETE")
-            .withEventTime(Instant.now().toString())
-            .withJob(ns.prefix("unknown_job"), ns.prefix("namespace"))
-            .withRun(UUID.randomUUID().toString())
-            .addInput("nonexistent_schema.nonexistent_table", "nonexistent_service")
-            .addOutput("nonexistent_schema.nonexistent_output", "nonexistent_service")
-            .send();
+  void testUnresolvableDatasetsAreRejected(TestNamespace ns) throws Exception {
+    JsonNode response =
+        sendExpectingRejection(
+            OpenLineage.event()
+                .withEventType("COMPLETE")
+                .withEventTime(Instant.now().toString())
+                .withJob(ns.prefix("unknown_job"), ns.prefix("namespace"))
+                .withRun(UUID.randomUUID().toString())
+                .addInput("nonexistent_schema.nonexistent_table", "nonexistent_service")
+                .addOutput("nonexistent_schema.nonexistent_output", "nonexistent_service"));
 
-    JsonNode json = MAPPER.readTree(response);
     assertEquals(
-        0, json.get("lineageEdgesCreated").asInt(), "Unresolvable datasets should create 0 edges");
+        0, response.g
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/OpenLineageResourceIT.java` (modified, +84/-60)
```diff
@@ -2,8 +2,11 @@
 
 import static org.junit.jupiter.api.Assertions.assertEquals;
 import static org.junit.jupiter.api.Assertions.assertNotNull;
+import static org.junit.jupiter.api.Assertions.assertThrows;
 import static org.junit.jupiter.api.Assertions.assertTrue;
 
+import com.fasterxml.jackson.databind.JsonNode;
+import com.fasterxml.jackson.databind.ObjectMapper;
 import java.time.Instant;
 import java.util.ArrayList;
 import java.util.HashMap;
@@ -18,6 +21,7 @@
 import org.openmetadata.it.util.SdkClients;
 import org.openmetadata.it.util.TestNamespace;
 import org.openmetadata.it.util.TestNamespaceExtension;
+import org.openmetadata.sdk.exceptions.InvalidRequestException;
 import org.openmetadata.sdk.fluent.OpenLineage;
 
 /**
@@ -34,6 +38,8 @@
 @ExtendWith(TestNamespaceExtension.class)
 public class OpenLineageResourceIT {
 
+  private static final ObjectMapper MAPPER = new ObjectMapper();
+
   @BeforeAll
   static void setup() {
     OpenLineage.setDefaultClient(SdkClients.adminClient());
@@ -97,18 +103,18 @@ void testSendEventWithInputsOutputs(TestNamespace ns) throws Exception {
     String namespace = ns.prefix("namespace");
     String runId = UUID.randomUUID().toString();
 
-    String response =
-        OpenLineage.event()
-            .withEventType("COMPLETE")
-            .withEventTime(Instant.now().toString())
-            .withJob(jobName, namespace)
-            .withRun(runId)
-            .addInput("input_dataset_1", ns.prefix("input_ns"))
-            .addInput("input_dataset_2", ns.prefix("input_ns"))
-            .addOutput("output_dataset", ns.prefix("output_ns"))
-            .send();
-
-    assertNotNull(response);
+    JsonNode rejection =
+        sendExpectingRejection(
+            OpenLineage.event()
+                .withEventType("COMPLETE")
+                .withEventTime(Instant.now().toString())
+                .withJob(jobName, namespace)
+                .withRun(runId)
+                .addInput("input_dataset_1", ns.prefix("input_ns"))
+                .addInput("input_dataset_2", ns.prefix("input_ns"))
+                .addOutput("output_dataset", ns.prefix("output_ns")));
+
+    assertRejectedAsUnparsable(rejection, 3);
   }
 
   @Test
@@ -147,17 +153,17 @@ void testSendEventWithDetailedDatasets(TestNamespace ns) throws Exception {
     outputDataset.put("name", "detailed_output");
     outputDataset.put("namespace", ns.prefix("detailed_ns"));
 
-    String response =
-        OpenLineage.event()
-            .withEventType("COMPLETE")
-            .withEventTime(Instant.now().toString())
-            .withJob(jobName, namespace)
-            .withRun(runId)
-            .addInput(inputDataset)
-            .addOutput(outputDataset)
-            .send();
-
-    assertNotNull(response);
+    JsonNode rejection =
+        sendExpectingRejection(
+            OpenLineage.event()
+                .withEventType("COMPLETE")
+                .withEventTime(Instant.now().toString())
+                .withJob(jobName, namespace)
+                .withRun(runId)
+                .addInput(inputDataset)
+                .addOutput(outputDataset));
+
+    assertRejectedAsUnparsable(rejection, 2);
   }
 
   @Test
@@ -326,19 +332,19 @@ void testEventWithMultipleInputs(TestNamespace ns) throws Exception {
     String namespace = ns.prefix("namespace");
     String runId = UUID.randomUUID().toString();
 
-    String response =
-        OpenLineage.event()
-            .withEventType("COMPLETE")
-            .withEventTime(Instant.now().toString())
-            .withJob(jobName, namespace)
-            .withRun(runId)
-            .addInput("input_1", ns.prefix("input_ns"))
-            .addInput("input_2", ns.prefix("input_ns"))
-            .addInput("input_3", ns.prefix("input_ns"))
-            .addOutput("output", ns.prefix("output_ns"))
-            .send();
-
-    assertNotNull(response);
+    JsonNode rejection =
+        sendExpectingRejection(
+            OpenLineage.event()
+                .withEventType("COMPLETE")
+                .withEventTime(Instant.now().toString())
+                .withJob(jobName, namespace)
+                .withRun(runId)
+                .addInput("input_1", ns.prefix("input_ns"))
+                .addInput("input_2", ns.prefix("input_ns"))
+                .addInput("input_3", ns.prefix("input_ns"))
+                .addOutput("output", ns.prefix("output_ns")));
+
+    assertRejectedAsUnparsable(rejection, 4);
   }
 
   @Test
@@ -347,19 +353,19 @@ void testEventWithMultipleOutputs(TestNamespace ns) throws Exception {
     String namespace = ns.prefix("namespace");
     String runId = UUID.randomUUID().toString();
 
-    String response =
-        OpenLineage.event()
-            .withEventType("COMPLETE")
-            .withEventTime(Instant.now().toString())
-            .withJob(jobName, namespace)
-            .withRun(runId)
-            .addInput("input", ns.prefix("input_ns"))
-            .addOutput("output_1", ns.prefix("output
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/openlineage/OpenLineageColumnMapper.java` (added, +163/-0)
```diff
@@ -0,0 +1,163 @@
+/*
+ *  Copyright 2021 Collate
+ *  Licensed under the Apache License, Version 2.0 (the "License");
+ *  you may not use this file except in compliance with the License.
+ *  You may obtain a copy of the License at
+ *  http://www.apache.org/licenses/LICENSE-2.0
+ *  Unless required by applicable law or agreed to in writing, software
+ *  distributed under the License is distributed on an "AS IS" BASIS,
+ *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ *  See the License for the specific language governing permissions and
+ *  limitations under the License.
+ */
+
+package org.openmetadata.service.openlineage;
+
+import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
+
+import java.util.ArrayList;
+import java.util.Arrays;
+import java.util.HashMap;
+import java.util.List;
+import java.util.Locale;
+import java.util.Map;
+import java.util.regex.Matcher;
+import java.util.regex.Pattern;
+import java.util.stream.Collectors;
+import org.openmetadata.schema.api.lineage.openlineage.DatasetFacets;
+import org.openmetadata.schema.api.lineage.openlineage.SchemaFacet;
+import org.openmetadata.schema.api.lineage.openlineage.SchemaField;
+import org.openmetadata.schema.type.Column;
+import org.openmetadata.schema.type.ColumnDataType;
+
+/**
+ * Turns OpenLineage schema-facet fields into columns that pass the same validation as a REST table
+ * create. Sized types that arrive without a size fall back to their unsized family, arrays carry an
+ * element type, and structs carry empty children because the facet does not describe nesting. The
+ * raw type is kept as the display type, so nothing the producer sent is lost.
+ */
+final class OpenLineageColumnMapper {
+
+  private static final Pattern TYPE_SIZE = Pattern.compile("\\(\\s*(\\d+)");
+  private static final Pattern ARRAY_ELEMENT = Pattern.compile("^array\\s*<\\s*([a-z0-9_ ]+)");
+  private static final Pattern WHITESPACE = Pattern.compile("\\s+");
+
+  /** Spellings that Spark, Postgres and other producers emit for an OpenMetadata type. */
+  private static final Map<String, ColumnDataType> PRODUCER_TYPE_ALIASES =
+      Map.ofEntries(
+          Map.entry("integer", ColumnDataType.INT),
+          Map.entry("int2", ColumnDataType.SMALLINT),
+          Map.entry("int4", ColumnDataType.INT),
+          Map.entry("int8", ColumnDataType.BIGINT),
+          Map.entry("short", ColumnDataType.SMALLINT),
+          Map.entry("byte", ColumnDataType.TINYINT),
+          Map.entry("long", ColumnDataType.BIGINT),
+          Map.entry("real", ColumnDataType.FLOAT),
+          Map.entry("float4", ColumnDataType.FLOAT),
+          Map.entry("float8", ColumnDataType.DOUBLE),
+          Map.entry("double precision", ColumnDataType.DOUBLE),
+          Map.entry("bool", ColumnDataType.BOOLEAN),
+          Map.entry("character varying", ColumnDataType.VARCHAR),
+          Map.entry("character", ColumnDataType.CHAR),
+          Map.entry("nvarchar", ColumnDataType.VARCHAR),
+          Map.entry("varchar2", ColumnDataType.VARCHAR),
+          Map.entry("nchar", ColumnDataType.CHAR),
+          Map.entry("timestamp without time zone", ColumnDataType.TIMESTAMP),
+          Map.entry("timestamp with time zone", ColumnDataType.TIMESTAMPZ),
+          Map.entry("timestamptz", ColumnDataType.TIMESTAMPZ),
+          Map.entry("timestamp_ntz", ColumnDataType.TIMESTAMP),
+          Map.entry("timestamp_ltz", ColumnDataType.TIMESTAMPZ),
+          Map.entry("timestamp_tz", ColumnDataType.TIMESTAMPZ),
+          Map.entry("time without time zone", ColumnDataType.TIME),
+          Map.entry("time with time zone", ColumnDataType.TIME),
+          Map.entry("jsonb", ColumnDataType.JSON));
+
+  private static final Map<String, ColumnDataType> TYPES_BY_NAME = buildTypesByName();
+
+  private OpenLineageColumnMapper() {}
+
+  static List<Column> toColumns(DatasetFacets facets) {
+    SchemaFacet schema = facets != null ? facets.getSchema() : null;
+    List<Column> columns = new ArrayList<>();
+    if (schema != null && !nullOrEmpty(schema.getFields())) {
+      schema.getFields().forEach(field -> columns.add(toColumn(field)));
+    }
+    return columns;
+  }
+
+  static Column toColumn(SchemaField field) {
+    String rawType = field.getType() == null ? "" : field.getType().trim();
+    Column column = new Column().withName(field.getName()).withDescription(field.getDescription());
+    if (!rawType.isEmpty()) {
+      column.setDataTypeDisplay(rawType);
+    }
+    applyDataType(column, rawType.toLowerCase(Locale.ROOT));
+    return column;
+  }
+
+  static ColumnDataType toDataType(String lowerCaseType) {
+    return TYPES_BY_NAME.getOrDefault(baseTypeName(lowerCaseType), ColumnDataType.UNKNOWN);
+  }
+
+  private static void applyDataType(Column column, String lowerCaseType) {
+    ColumnDataType dataType = toDataType(lowerCaseType);
+    Integer size = sizeOf(lowerCaseType);
+    switch (dataType) {
+      case CHAR, VARCHAR -> applySi
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/openlineage/OpenLineageEntityCreator.java` (added, +336/-0)
```diff
@@ -0,0 +1,336 @@
+/*
+ *  Copyright 2021 Collate
+ *  Licensed under the Apache License, Version 2.0 (the "License");
+ *  you may not use this file except in compliance with the License.
+ *  You may obtain a copy of the License at
+ *  http://www.apache.org/licenses/LICENSE-2.0
+ *  Unless required by applicable law or agreed to in writing, software
+ *  distributed under the License is distributed on an "AS IS" BASIS,
+ *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ *  See the License for the specific language governing permissions and
+ *  limitations under the License.
+ */
+
+package org.openmetadata.service.openlineage;
+
+import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
+import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.CREATE_NOT_ALLOWED;
+import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.INVALID_ENTITY;
+import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.MISSING_COLUMNS;
+import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.MISSING_DATABASE;
+import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.SERVICE_NOT_FOUND;
+import static org.openmetadata.service.openlineage.OpenLineageResolution.resolved;
+import static org.openmetadata.service.openlineage.OpenLineageResolution.unresolved;
+
+import java.util.ArrayDeque;
+import java.util.ArrayList;
+import java.util.Deque;
+import java.util.List;
+import java.util.Objects;
+import java.util.UUID;
+import java.util.function.Supplier;
+import java.util.stream.Collectors;
+import lombok.extern.slf4j.Slf4j;
+import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
+import org.openmetadata.schema.EntityInterface;
+import org.openmetadata.schema.api.data.CreateDatabase;
+import org.openmetadata.schema.api.data.CreateDatabaseSchema;
+import org.openmetadata.schema.api.data.CreateTable;
+import org.openmetadata.schema.api.lineage.openlineage.DatasetFacets;
+import org.openmetadata.schema.api.lineage.openlineage.DocumentationFacet;
+import org.openmetadata.schema.api.lineage.openlineage.Owner;
+import org.openmetadata.schema.api.lineage.openlineage.OwnershipFacet;
+import org.openmetadata.schema.entity.data.Database;
+import org.openmetadata.schema.entity.data.DatabaseSchema;
+import org.openmetadata.schema.entity.data.Table;
+import org.openmetadata.schema.entity.services.DatabaseService;
+import org.openmetadata.schema.entity.teams.User;
+import org.openmetadata.schema.type.Column;
+import org.openmetadata.schema.type.EntityReference;
+import org.openmetadata.schema.type.Include;
+import org.openmetadata.service.Entity;
+import org.openmetadata.service.exception.EntityNotFoundException;
+import org.openmetadata.service.exception.LimitsException;
+import org.openmetadata.service.jdbi3.EntityRepository;
+import org.openmetadata.service.jdbi3.ListFilter;
+import org.openmetadata.service.resources.databases.DatabaseMapper;
+import org.openmetadata.service.resources.databases.DatabaseSchemaMapper;
+import org.openmetadata.service.resources.databases.DatabaseUtil;
+import org.openmetadata.service.resources.databases.TableMapper;
+import org.openmetadata.service.security.AuthorizationException;
+import org.openmetadata.service.util.FullyQualifiedName;
+
+/**
+ * Creates the table an OpenLineage dataset names, together with any missing database and schema,
+ * under the database service its namespace is mapped to. Each entity is authorized and built the
+ * way a REST create by the same caller would be, so an event can create nothing its caller could
+ * not create directly. A table is only created when the event carries its columns, and a refusal at
+ * any level takes back what that table's creation already wrote, so no empty shell is left behind.
+ */
+@Slf4j
+public class OpenLineageEntityCreator {
+
+  private static final String SERVICE_FILTER = "service";
+
+  /**
+   * Checks that the caller may create an entity, as a REST create by the same caller is checked.
+   * Throws {@link AuthorizationException} when a policy denies it, or {@link LimitsException} when a
+   * plan limit does.
+   */
+  @FunctionalInterface
+  public interface CreateAuthorization {
+    void authorize(String entityType, EntityInterface entity);
+  }
+
+  /** Without a caller there is nobody to authorize a create against, so nothing is created. */
+  private static final CreateAuthorization NO_CALLER =
+      (entityType, entity) -> {
+        throw new AuthorizationException(
+            String.format("No caller to authorize creating %s %s", entityType, entity.getName()));
+      };
+
+  private record CreatedEntity(String entityType, UUID id, String fullyQualifiedName) {}
+
+  /** Where a missing table goes. {@code database} is null when the dataset name omits it. */
+  public record TableLocation(String service, String database, String schema, String table) {}
+
+  private record TableDraf
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/openlineage/OpenLineageEntityResolver.java` (modified, +164/-340)
```diff
@@ -14,35 +14,35 @@
 package org.openmetadata.service.openlineage;
 
 import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
+import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.CREATION_DISABLED;
+import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.NAMESPACE_NOT_MAPPED;
+import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.NOT_FOUND;
+import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.PIPELINE_NOT_FOUND;
+import static org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason.UNPARSABLE_NAME;
 import static org.openmetadata.schema.type.Include.NON_DELETED;
+import static org.openmetadata.service.openlineage.OpenLineageResolution.resolved;
+import static org.openmetadata.service.openlineage.OpenLineageResolution.unresolved;
 
-import java.util.ArrayList;
 import java.util.List;
 import java.util.Map;
+import java.util.Optional;
 import java.util.concurrent.ConcurrentHashMap;
 import java.util.stream.Collectors;
 import lombok.extern.slf4j.Slf4j;
 import org.openmetadata.schema.api.lineage.openlineage.DatasetFacets;
 import org.openmetadata.schema.api.lineage.openlineage.DatasourceFacet;
-import org.openmetadata.schema.api.lineage.openlineage.DocumentationFacet;
 import org.openmetadata.schema.api.lineage.openlineage.OpenLineageInputDataset;
 import org.openmetadata.schema.api.lineage.openlineage.OpenLineageOutputDataset;
-import org.openmetadata.schema.api.lineage.openlineage.Owner;
-import org.openmetadata.schema.api.lineage.openlineage.OwnershipFacet;
-import org.openmetadata.schema.api.lineage.openlineage.SchemaFacet;
-import org.openmetadata.schema.api.lineage.openlineage.SchemaField;
 import org.openmetadata.schema.entity.data.Container;
-import org.openmetadata.schema.entity.data.Pipeline;
 import org.openmetadata.schema.entity.data.Table;
-import org.openmetadata.schema.type.Column;
-import org.openmetadata.schema.type.ColumnDataType;
 import org.openmetadata.schema.type.EntityReference;
 import org.openmetadata.schema.type.Include;
 import org.openmetadata.service.Entity;
 import org.openmetadata.service.exception.EntityNotFoundException;
 import org.openmetadata.service.jdbi3.EntityRepository;
 import org.openmetadata.service.jdbi3.ListFilter;
 import org.openmetadata.service.openlineage.OpenLineageDatasetNameNormalizer.DatasetCandidate;
+import org.openmetadata.service.openlineage.OpenLineageEntityCreator.TableLocation;
 import org.openmetadata.service.util.LikeEscape;
 
 @Slf4j
@@ -55,20 +55,34 @@ public class OpenLineageEntityResolver {
   private final Map<String, EntityReference> containerCache = new ConcurrentHashMap<>();
   private final boolean autoCreateEntities;
   private final String defaultPipelineService;
-  private final Map<String, String> namespaceToServiceMapping;
+  private final OpenLineageNamespaceMapping namespaceMapping;
+  private final OpenLineageEntityCreator entityCreator;
 
   public OpenLineageEntityResolver(boolean autoCreateEntities, String defaultPipelineService) {
     this(autoCreateEntities, defaultPipelineService, null);
   }
 
+  /** Resolves only: with no caller to authorize creates against, nothing is ever created. */
   public OpenLineageEntityResolver(
       boolean autoCreateEntities,
       String defaultPipelineService,
       Map<String, String> namespaceToServiceMapping) {
+    this(
+        autoCreateEntities,
+        defaultPipelineService,
+        namespaceToServiceMapping,
+        OpenLineageEntityCreator.withoutCaller());
+  }
+
+  public OpenLineageEntityResolver(
+      boolean autoCreateEntities,
+      String defaultPipelineService,
+      Map<String, String> namespaceToServiceMapping,
+      OpenLineageEntityCreator entityCreator) {
     this.autoCreateEntities = autoCreateEntities;
     this.defaultPipelineService = defaultPipelineService;
-    this.namespaceToServiceMapping =
-        namespaceToServiceMapping != null ? namespaceToServiceMapping : Map.of();
+    this.namespaceMapping = new OpenLineageNamespaceMapping(namespaceToServiceMapping);
+    this.entityCreator = entityCreator;
   }
 
   public EntityReference resolveTable(OpenLineageInputDataset dataset) {
@@ -110,32 +124,114 @@ private EntityReference resolveTableInternal(
     }
   }
 
-  public EntityReference resolveOrCreateTable(OpenLineageInputDataset dataset, String updatedBy) {
-    EntityReference ref = resolveTable(dataset);
-    if (ref != null) {
-      return ref;
-    }
+  public OpenLineageResolution resolveDataset(OpenLineageInputDataset dataset, String updatedBy) {
+    return resolveDataset(
+        dataset.getNamespace(), dataset.getName(), dataset.getFacets(), updatedBy);
+  }
 
-    if (!autoCreateEntities) {
-      LOG.debug("Auto-create disabled, skipping table creation for: {}", dataset.getName());
-      return null;
-    }
+  public OpenLineageResolution resolveDataset(OpenLineageOutputDataset dataset, String updatedBy) {
+   
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/openlineage/OpenLineageEventPlan.java` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+/*
+ *  Copyright 2021 Collate
+ *  Licensed under the Apache License, Version 2.0 (the "License");
+ *  you may not use this file except in compliance with the License.
+ *  You may obtain a copy of the License at
+ *  http://www.apache.org/licenses/LICENSE-2.0
+ *  Unless required by applicable law or agreed to in writing, software
+ *  distributed under the License is distributed on an "AS IS" BASIS,
+ *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ *  See the License for the specific language governing permissions and
+ *  limitations under the License.
+ */
+
+package org.openmetadata.service.openlineage;
+
+import java.util.List;
+import org.openmetadata.schema.api.lineage.AddLineage;
+import org.openmetadata.schema.api.lineage.openlineage.UnresolvedEntity;
+
+/**
+ * What one OpenLineage event turns into: the lineage edges to write, plus the datasets and job that
+ * could not be resolved. A skipped event (filtered type, or no inputs or outputs) plans nothing and
+ * is not an error.
+ */
+public record OpenLineageEventPlan(
+    boolean skipped,
+    List<AddLineage> lineageRequests,
+    List<UnresolvedEntity> unresolvedDatasets,
+    List<UnresolvedEntity> unresolvedJobs) {
+
+  public OpenLineageEventPlan {
+    lineageRequests = List.copyOf(lineageRequests);
+    unresolvedDatasets = List.copyOf(unresolvedDatasets);
+    unresolvedJobs = List.copyOf(unresolvedJobs);
+  }
+
+  public static OpenLineageEventPlan skippedEvent() {
+    return new OpenLineageEventPlan(true, List.of(), List.of(), List.of());
+  }
+}
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/openlineage/OpenLineageMapper.java` (modified, +162/-108)
```diff
@@ -17,12 +17,13 @@
 
 import java.time.Instant;
 import java.util.ArrayList;
-import java.util.Collections;
 import java.util.Date;
 import java.util.HashMap;
+import java.util.LinkedHashMap;
 import java.util.List;
 import java.util.Map;
 import java.util.Set;
+import java.util.function.Function;
 import java.util.stream.Collectors;
 import lombok.extern.slf4j.Slf4j;
 import org.openmetadata.schema.api.lineage.AddLineage;
@@ -37,8 +38,10 @@
 import org.openmetadata.schema.api.lineage.openlineage.OpenLineageRun;
 import org.openmetadata.schema.api.lineage.openlineage.OpenLineageRunEvent;
 import org.openmetadata.schema.api.lineage.openlineage.OutputDatasetFacets;
+import org.openmetadata.schema.api.lineage.openlineage.ParentJobFacet;
 import org.openmetadata.schema.api.lineage.openlineage.ParentRunFacet;
 import org.openmetadata.schema.api.lineage.openlineage.RunFacets;
+import org.openmetadata.schema.api.lineage.openlineage.UnresolvedEntity;
 import org.openmetadata.schema.configuration.OpenLineageEventType;
 import org.openmetadata.schema.configuration.OpenLineageSettings;
 import org.openmetadata.schema.type.ColumnLineage;
@@ -51,6 +54,13 @@ public class OpenLineageMapper {
 
   private static final String OPEN_LINEAGE_USER = "openlineage";
 
+  /** Namespace and name, the identity OpenLineage gives every dataset and job. */
+  private record OpenLineageName(String namespace, String name) {}
+
+  /** What every edge of one event shares. */
+  private record EdgeDetails(
+      String description, EntityReference pipeline, String sqlQuery, long eventTimeMs) {}
+
   private final OpenLineageEntityResolver entityResolver;
   private final Set<String> allowedEventTypes;
 
@@ -73,92 +83,119 @@ public OpenLineageMapper(OpenLineageEntityResolver entityResolver, OpenLineageSe
     }
   }
 
-  public List<AddLineage> mapRunEvent(OpenLineageRunEvent event, String updatedBy) {
-    if (event == null) {
-      return Collections.emptyList();
-    }
+  public OpenLineageEventPlan mapRunEvent(OpenLineageRunEvent event, String updatedBy) {
+    return isProcessable(event) ? planEvent(event, updatedBy) : OpenLineageEventPlan.skippedEvent();
+  }
 
-    if (!shouldProcessEvent(event)) {
-      LOG.debug(
-          "Skipping OpenLineage event with type: {}",
-          event.getEventType() != null ? event.getEventType().value() : "null");
-      return Collections.emptyList();
+  private boolean isProcessable(OpenLineageRunEvent event) {
+    boolean processable =
+        event != null
+            && shouldProcessEvent(event)
+            && !nullOrEmpty(event.getInputs())
+            && !nullOrEmpty(event.getOutputs());
+    if (!processable) {
+      LOG.debug("Skipping OpenLineage event: filtered event type, or no inputs or outputs");
     }
+    return processable;
+  }
 
-    List<OpenLineageInputDataset> inputs = event.getInputs();
-    List<OpenLineageOutputDataset> outputs = event.getOutputs();
+  /**
+   * Resolves every dataset once, then writes an edge for each input/output pair whose ends both
+   * resolved. The datasets and job that did not resolve are kept for the response.
+   */
+  private OpenLineageEventPlan planEvent(OpenLineageRunEvent event, String updatedBy) {
+    Map<String, UnresolvedEntity> unresolvedDatasets = new LinkedHashMap<>();
+    Map<OpenLineageInputDataset, EntityReference> inputs =
+        resolveDatasets(
+            event.getInputs(),
+            input -> entityResolver.resolveDataset(input, updatedBy),
+            input -> new OpenLineageName(input.getNamespace(), input.getName()),
+            unresolvedDatasets);
+    Map<OpenLineageOutputDataset, EntityReference> outputs =
+        resolveDatasets(
+            event.getOutputs(),
+            output -> entityResolver.resolveDataset(output, updatedBy),
+            output -> new OpenLineageName(output.getNamespace(), output.getName()),
+            unresolvedDatasets);
+    List<UnresolvedEntity> unresolvedJobs = new ArrayList<>();
+    EdgeDetails details = edgeDetails(event, resolvePipeline(event, unresolvedJobs));
+    return new OpenLineageEventPlan(
+        false,
+        buildEdges(details, inputs, outputs),
+        List.copyOf(unresolvedDatasets.values()),
+        unresolvedJobs);
+  }
 
-    if (nullOrEmpty(inputs) || nullOrEmpty(outputs)) {
-      LOG.debug("Skipping OpenLineage event with no inputs or outputs");
-      return Collections.emptyList();
+  private static <D> Map<D, EntityReference> resolveDatasets(
+      List<D> datasets,
+      Function<D, OpenLineageResolution> resolve,
+      Function<D, OpenLineageName> nameOf,
+      Map<String, UnresolvedEntity> unresolved) {
+    Map<D, EntityReference> resolvedDatasets = new LinkedHashMap<>();
+    for (D dataset : datasets) {
+      OpenLineageName name = nameOf.apply(dataset);
+      switch (resolve.apply(dataset)) {
+        case OpenLineageResolution.Resolved resolved -> resolvedDatasets.put(
+            dataset, resolved.entity());
+        cas
```

---

### Incident Patch 5: `3434f5ac` (2026-10-05)
**Commit Message**: Fixes 22530: index container direct-child listings by parent FQN hash (#33795)

* Fixes 22530: index container direct-child listings by parent FQN hash

Listing a container's children resolved "exactly one segment below this FQN"
with `fqnHash LIKE '<parent>.%' AND fqnHash NOT LIKE '<parent>.%.%'`. Those
select the right rows, but neither predicate is an indexable equality, so the
listing's `ORDER BY name, id LIMIT n` made idx_storage_container_entity_
deleted_name_id -- which already supplies that order -- the cheapest plan on
both MySQL and PostgreSQL, and the query scanned container rows until the page
filled. A container near the root of a deep tree has a large subtree but few
direct children, so the scan ran to the end of the table: the cost was
O(containers in the deployment), not O(children returned), and both the page
and count queries paid it on every render. The service root listing
(?root=true) had the same shape and the same problem.

Add a generated `parentFqnHash` column -- the row's own fqnHash minus its last
segment -- plus (parentFqnHash, deleted, name, id), turning both listings into
indexed equalities. Generated rather than application-maintained so it cannot
dri

**File**: `bootstrap/sql/migrations/native/2.1.0/mysql/schemaChanges.sql` (modified, +64/-0)
```diff
@@ -569,6 +569,70 @@ PREPARE announcement_type_default_stmt FROM @announcement_type_default_ddl;
 EXECUTE announcement_type_default_stmt;
 DEALLOCATE PREPARE announcement_type_default_stmt;
 
+-- Direct-child container listings (issue #22530). "Children of <fqn>" was expressed as
+-- `fqnHash LIKE '<parent>.%' AND fqnHash NOT LIKE '<parent>.%.%'`. Neither predicate is an
+-- indexable equality, so with the listing's `ORDER BY name, id LIMIT n` the optimizer prefers
+-- idx_storage_container_entity_deleted_name_id -- which already delivers that order -- and
+-- scans container rows until the page fills. A container near the root of a deep tree has few
+-- direct children, so the scan runs to completion: cost is O(containers in the deployment),
+-- not O(direct children). Measured on a 14-level, 10k-container S3 tree whose root has one
+-- direct child: 10,376 rows scanned / 90ms, rising to 50,376 rows / 169ms once unrelated
+-- containers were added -- while the answer stayed a single row.
+--
+-- parentFqnHash materialises the fqnHash prefix above the last segment, turning the listing
+-- into an index equality. Derived by stripping the final '.'-separated segment rather than a
+-- fixed 33-character suffix, so it holds regardless of hash width. VIRTUAL keeps the ALTER
+-- metadata-only (no table rebuild); the index below materialises the value.
+--
+-- Both statements are guarded so a re-run is a no-op, like the rest of this file. The
+-- prepared-statement names are unique on purpose: the runner records each statement by
+-- (version, hash of its text) and skips text it has already run, so a second block reusing
+-- `PREPARE stmt FROM @ddl; EXECUTE stmt;` would be skipped rather than executed.
+SET @container_parent_fqn_hash_column_ddl = (
+  SELECT IF(
+    EXISTS (
+      SELECT 1
+      FROM information_schema.columns
+      WHERE table_schema = DATABASE()
+        AND table_name = 'storage_container_entity'
+        AND column_name = 'parentFqnHash'
+    ),
+    'SELECT 1',
+    'ALTER TABLE storage_container_entity ADD COLUMN parentFqnHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN LOCATE(''.'', REVERSE(fqnHash)) = 0 THEN '''' ELSE LEFT(fqnHash, CHAR_LENGTH(fqnHash) - LOCATE(''.'', REVERSE(fqnHash))) END) VIRTUAL'
+  )
+);
+PREPARE container_parent_fqn_hash_column_stmt FROM @container_parent_fqn_hash_column_ddl;
+EXECUTE container_parent_fqn_hash_column_stmt;
+DEALLOCATE PREPARE container_parent_fqn_hash_column_stmt;
+
+-- (parentFqnHash, deleted) answers the filter; (name, id) supplies the listing's sort order,
+-- so the common non-deleted page needs neither a filesort nor a row lookup per candidate.
+-- Column order deviates from the table_entity/stored_procedure_entity precedent in 1.10.0,
+-- which leads with `deleted`: the container listing's `include` is tri-state, and on
+-- include=ALL there is no `deleted` predicate at all, which would strand a deleted-leading
+-- index. Leading with parentFqnHash keeps the equality usable in all three include modes.
+--
+-- No CONCURRENTLY equivalent is needed here (and MySQL has none): InnoDB builds a secondary
+-- index with ALGORITHM=INPLACE and permits concurrent DML, and the VIRTUAL column add above
+-- is metadata-only, so neither statement blocks traffic. The PostgreSQL companion has to
+-- build CONCURRENTLY and still pays an ACCESS EXCLUSIVE table rewrite for its STORED column.
+SET @container_parent_children_index_ddl = (
+  SELECT IF(
+    EXISTS (
+      SELECT 1
+      FROM information_schema.statistics
+      WHERE table_schema = DATABASE()
+        AND table_name = 'storage_container_entity'
+        AND index_name = 'idx_storage_container_entity_parent_children'
+    ),
+    'SELECT 1',
+    'ALTER TABLE storage_container_entity ADD INDEX idx_storage_container_entity_parent_children (parentFqnHash, deleted, name, id)'
+  )
+);
+PREPARE container_parent_children_index_stmt FROM @container_parent_children_index_ddl;
+EXECUTE container_parent_children_index_stmt;
+DEALLOCATE PREPARE container_parent_children_index_stmt;
+
 -- Flowable schema upgrades run after this migration and inherit the database default. Existing
 -- ACT_* tables are aligned to the same collation by FlowableCharsetMigration.
 ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

**File**: `bootstrap/sql/migrations/native/2.1.0/postgres/schemaChanges.sql` (modified, +47/-0)
```diff
@@ -451,3 +451,50 @@ BEGIN
     CREATE INDEX idx_announcement_type ON announcement_entity (type);
   END IF;
 END $$;
+
+-- Direct-child container listings (issue #22530). See the MySQL companion for the measured
+-- numbers; PostgreSQL picks the same losing plan for the same reason -- the listing's
+-- `ORDER BY name, id LIMIT n` makes idx_storage_container_entity_deleted_name_id look free,
+-- and idx_storage_container_entity_fqnhash_pattern (which can serve the prefix LIKE as a
+-- range) is never chosen. On the same 50k-container fixture the children page read 19,995
+-- shared buffers to return one row, and the count query fell back to a Seq Scan.
+--
+-- parentFqnHash materialises the fqnHash prefix above the last segment, turning the listing
+-- into an index equality. Derived by stripping the final '.'-separated segment rather than a
+-- fixed 33-character suffix, so it holds regardless of hash width. STORED because PostgreSQL
+-- has no VIRTUAL generated columns; strpos/reverse/left are immutable, as generation requires.
+ALTER TABLE storage_container_entity
+  ADD COLUMN IF NOT EXISTS parentFqnHash VARCHAR(768)
+  GENERATED ALWAYS AS (
+    CASE
+      WHEN strpos(fqnHash, '.') = 0 THEN ''
+      ELSE left(fqnHash, length(fqnHash) - strpos(reverse(fqnHash), '.'))
+    END
+  ) STORED;
+
+-- (parentFqnHash, deleted) answers the filter; (name, id) supplies the listing's sort order,
+-- so the common non-deleted page needs neither a sort nor a heap fetch per candidate.
+-- Column order deviates from the table_entity/stored_procedure_entity precedent in 1.10.0,
+-- which leads with `deleted`: the container listing's `include` is tri-state, and on
+-- include=ALL there is no `deleted` predicate at all, which would strand a deleted-leading
+-- index. Leading with parentFqnHash keeps the equality usable in all three include modes.
+--
+-- Built CONCURRENTLY so the index build takes no write lock, matching the 1.11.0
+-- idx_tag_usage_* and 1.13.0 *_fqnhash_pattern pattern. Each statement runs outside an
+-- implicit transaction, which the native migration runner supports.
+--
+-- This removes the smaller half of the blocking window: on a 580k-row / 674MB
+-- storage_container_entity the index build is ~1.8s under SHARE UPDATE EXCLUSIVE, while the
+-- ADD COLUMN above holds ACCESS EXCLUSIVE for ~10.5s to rewrite the table. 1.11.0 accepted
+-- that same trade-off when it added generated columns to tag_usage. An expression index over
+-- the same CASE would avoid the rewrite entirely (identical 110MB index, same build time),
+-- but every listing query would have to repeat the expression byte-for-byte -- including the
+-- root-listing SQL that is currently dialect-neutral -- so it is not worth the divergence
+-- unless the rewrite proves unacceptable in practice.
+--
+-- OPERATOR NOTE: an interrupted CONCURRENTLY build leaves an INVALID index behind, and the
+-- runner keys statements by SQL-text hash so it will not self-heal on retry. Detection and
+-- recovery are the same as the runbook in 1.13.0/postgres/schemaChanges.sql: DROP INDEX the
+-- invalid entry, then re-run the migration.
+CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_storage_container_entity_parent_children
+  ON storage_container_entity (parentFqnHash, deleted, name, id);
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/ContainerResourceIT.java` (modified, +249/-10)
```diff
@@ -21,6 +21,7 @@
 import org.junit.jupiter.api.parallel.ResourceLock;
 import org.junit.jupiter.api.parallel.Resources;
 import org.openmetadata.it.bootstrap.SharedEntities;
+import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
 import org.openmetadata.it.factories.StorageServiceTestFactory;
 import org.openmetadata.it.util.SdkClients;
 import org.openmetadata.it.util.TestNamespace;
@@ -44,6 +45,7 @@
 import org.openmetadata.service.Entity;
 import org.openmetadata.service.jdbi3.CollectionDAO;
 import org.openmetadata.service.jdbi3.ContainerRepository;
+import org.openmetadata.service.util.FullyQualifiedName;
 
 /**
  * Integration tests for Container entity operations.
@@ -1336,7 +1338,8 @@ private Container createChild(
    * (see {@link org.openmetadata.service.jdbi3.EntityRepository#processDeletionBatch}).
    * We simulate that exact state here by deleting the relationship row directly and
    * assert the root listing now excludes the orphan via the FQN-depth predicate
-   * ({@code fqnHash NOT LIKE :serviceHashChild}).
+   * ({@code parentFqnHash LIKE :serviceHashExact}), which is derived from the FQN rather
+   * than from entity_relationship.
    */
   @Test
   void test_rootListingExcludesOrphanedChild(TestNamespace ns) {
@@ -1444,7 +1447,7 @@ void test_recursiveHardDelete_largeBatch_leavesNoOrphans(TestNamespace ns) {
    * relied on the parent CONTAINS edge being present on every non-root container; orphans
    * and bulk-imported leaves missing that edge would surface at the service root with a
    * deeply-nested FQN, contradicting the breadcrumb the UI shows on click. The FQN-depth
-   * predicate ({@code fqnHash NOT LIKE :serviceHashChild}) makes the FQN itself the source
+   * predicate ({@code parentFqnHash LIKE :serviceHashExact}) makes the FQN itself the source
    * of truth. This test exercises the depth check at three levels (root, child, grandchild)
    * to guard against regressions in either direction (over-filtering or under-filtering).
    */
@@ -1482,11 +1485,12 @@ void test_rootListing_excludesContainersBelowFirstLevel(TestNamespace ns) {
   /**
    * {@code ?root=true} without {@code ?service=} must succeed: it returns every direct
    * child of any service across the whole tenant. The depth predicate
-   * ({@code fqnHash NOT LIKE :serviceHashChild}) needs the bind to be present even in
+   * ({@code parentFqnHash LIKE :serviceHashExact}) needs the bind to be present even in
    * this case, but {@link org.openmetadata.service.jdbi3.ListFilter#getServiceCondition}
    * only adds it when {@code ?service=} is present — the
-   * {@code ContainerDAO.rootListingParams} default ({@code '%.%.%'}) is what makes the
-   * SQL runnable here.
+   * {@code ContainerDAO.rootListingParams} default ({@code '%'}) is what makes the SQL
+   * runnable here, leaving the companion {@code parentFqnHash NOT LIKE '%.%'} to keep only
+   * containers whose parent is a bare service hash.
    *
    * <p>Regression guard for the "GET /containers?root=true (no service) crashes with a
    * missing-named-parameter error" bug. Also verifies the depth check still excludes
@@ -1598,8 +1602,8 @@ void test_rootListing_respectsIncludeFlag(TestNamespace ns) {
    * The {@code /containers/name/{fqn}/children} endpoint must list direct children only —
    * grandchildren stay hidden. The previous entity_relationship implementation got this
    * right when the parent CONTAINS edges existed. The FQN-depth implementation gets it
-   * right by construction (a grandchild has two more segments than the parent and so is
-   * excluded by {@code fqnHash NOT LIKE :parentHashChild}).
+   * right by construction: a grandchild's {@code parentFqnHash} is its own parent's hash,
+   * not this container's, so it cannot match the listing's equality.
    */
   @Test
   void test_listChildren_excludesGrandchildren(TestNamespace ns) throws Exception {
@@ -1800,7 +1804,7 @@ void test_listChildren_filterByQuery_escapesLikeWildcards(TestNamespace ns) thro
    * deleted flag, never recurses.
    *
    * <p>Both the direct-children-only depth predicate
-   * ({@code fqnHash NOT LIKE :parentHashChild}) and the include filter contribute to
+   * ({@code parentFqnHash = :parentHash}) and the include filter contribute to
    * this guarantee; a regression that drops the depth check while keeping the include
    * check would silently start surfacing deleted descendants from deeper levels at
    * ancestor /children listings.
@@ -1873,8 +1877,8 @@ private void assertChildren(
    * <p>This is the per-level dual of {@link #test_rootListing_excludesContainersBelowFirstLevel}.
    * The depth check is mathematical (a fqnHash exactly one MD5 segment below the parent
    * has exactly one extra '.' separator), so it should hold uniformly at every depth;
-   * a regression at level N (e.g. a planner choosing the wrong index, or someone
-   * computing parentHashChild from the wrong prefix) would only surface in this kind of
+   * a regre
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/ContainerRepository.java` (modified, +18/-16)
```diff
@@ -633,13 +633,18 @@ public ResultList<Container> listChildren(
    * </ul>
    *
    * <p>The FQN-depth approach asks the right question — "which rows have an FQN that is
-   * exactly one level below this prefix?" — and answers it with a single indexed range
-   * scan against {@code idx_storage_container_entity_fqnhash_pattern}. The parent UUID is
+   * exactly one level below this prefix?" — and answers it as an equality against the
+   * generated {@code parentFqnHash} column (the row's own fqnHash minus its last segment),
+   * served by {@code idx_storage_container_entity_parent_children}. The parent UUID is
    * never needed; the parent doesn't even have to exist for its descendants to be
-   * discoverable. Because each FQN segment hashes to a fixed-width MD5, "exactly one
-   * segment below" is expressible as {@code fqnHash LIKE :parentHash AND fqnHash NOT LIKE
-   * :parentHashChild}, where {@code :parentHash} is {@code <hash>.%} and
-   * {@code :parentHashChild} is {@code <hash>.%.%}.
+   * discoverable.
+   *
+   * <p>The depth test used to be spelled {@code fqnHash LIKE '<hash>.%' AND fqnHash NOT
+   * LIKE '<hash>.%.%'}. That selects the same rows but gives the planner no indexable
+   * equality, so the {@code ORDER BY name, id LIMIT n} below won on cost and both engines
+   * scanned container rows until the page filled — O(containers in the deployment) per
+   * listing, worst exactly where it hurts most: a container near the root of a deep tree,
+   * with a large subtree but few direct children (#22530).
    *
    * <p>{@code search} narrows the page to children whose name contains the given substring
    * (case-insensitive). Empty / null disables the filter — the caller passes the raw text
@@ -672,9 +677,7 @@ public ResultList<Container> listChildren(
     // latency budget in prod we can tell which step (depth query / count / service
     // restore) was responsible. The parent-lookup phase from the previous
     // entity_relationship-based implementation is gone — the FQN is enough.
-    String parentHashRaw = FullyQualifiedName.buildHash(parentFQN);
-    String parentHash = parentHashRaw + Entity.SEPARATOR + "%";
-    String parentHashChild = parentHashRaw + Entity.SEPARATOR + "%" + Entity.SEPARATOR + "%";
+    String parentHash = FullyQualifiedName.buildHash(parentFQN);
     String includeBind = includeToBindString(safeInclude);
     CollectionDAO.ContainerDAO containerDAO = (CollectionDAO.ContainerDAO) dao;
 
@@ -683,14 +686,12 @@ public ResultList<Container> listChildren(
       try (var ignored = RequestLatencyContext.phase("listChildrenPage")) {
         children =
             containerDAO.listDirectChildSummariesByParentHash(
-                parentHash, parentHashChild, nameLike, includeBind, safeLimit, safeOffset);
+                parentHash, nameLike, includeBind, safeLimit, safeOffset);
       }
 
       int total;
       try (var ignored = RequestLatencyContext.phase("listChildrenCount")) {
-        total =
-            containerDAO.countDirectChildrenByParentHash(
-                parentHash, parentHashChild, nameLike, includeBind);
+        total = containerDAO.countDirectChildrenByParentHash(parentHash, nameLike, includeBind);
       }
 
       if (children.isEmpty()) {
@@ -751,9 +752,10 @@ private static String buildNameLikeBind(String search) {
    * deleted predicate on this bind via a three-branch OR chain
    * ({@code :includeDeleted = 'ALL' OR (:includeDeleted = 'DELETED' AND deleted = TRUE)
    * OR (:includeDeleted = 'NON_DELETED' AND deleted = FALSE)}) rather than three
-   * separate query templates — the underlying access path is identical, the index range
-   * scan on {@code fqnHash} runs once, and the per-row deleted predicate is evaluated
-   * post-index in all three modes.
+   * separate query templates — the underlying access path is identical in all three modes:
+   * the {@code parentFqnHash} equality drives the index, and {@code deleted} is the index's
+   * next column, so NON_DELETED and DELETED narrow the same lookup while ALL reads the
+   * parent's whole entry range.
    */
   private static String includeToBindString(Include include) {
     return switch (include) {
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/DataAssetServiceDAOs.java` (modified, +43/-28)
```diff
@@ -314,18 +314,19 @@ default int listCount(ListFilter filter) {
 
     /**
      * Build the bind map the listRoot SQL expects. The depth predicate
-     * ({@code fqnHash NOT LIKE :serviceHashChild}) needs the {@code serviceHashChild}
+     * ({@code parentFqnHash LIKE :serviceHashExact}) needs the {@code serviceHashExact}
      * bind to be set on every call, but {@link ListFilter#getServiceCondition} only
      * adds it when {@code ?service=} is present. For the {@code ?root=true} case
      * <em>without</em> a service filter — "all root containers across all services" —
-     * we default the bind to {@code %.%.%}, which excludes any fqnHash with two or more
-     * separators (everything strictly below the immediate level). Index usage is naturally
-     * weaker here since the prefix LIKE is also absent, but no-service root listings are
-     * rare and the result is at most one row per service.
+     * we default the bind to {@code %}, so the companion
+     * {@code parentFqnHash NOT LIKE '%.%'} carries the whole test on its own: a parent
+     * hash with no separator is a bare service hash, which is exactly what a root
+     * container has. That branch cannot use the index (the pattern is open-ended), but
+     * no-service root listings are rare and return at most one row per service.
      */
     private static java.util.Map<String, Object> rootListingParams(ListFilter filter) {
       java.util.Map<String, Object> params = new java.util.HashMap<>(filter.getQueryParams());
-      params.putIfAbsent("serviceHashChild", "%.%.%");
+      params.putIfAbsent("serviceHashExact", "%");
       return params;
     }
 
@@ -346,13 +347,17 @@ private static java.util.Map<String, Object> rootListingParams(ListFilter filter
     //      query 1-2s on a service with hundreds of thousands of containers.
     //
     // The FQN is the canonical hierarchy in OpenMetadata (it's set unconditionally at write
-    // time and is what the breadcrumb UI consumes). `fqnHash` is built by joining
-    // fixed-width MD5 segments with '.', so depth follows from the count of separators —
-    // a direct child of the service has a fqnHash matching `<serviceHash>.<32hex>` and
-    // contains no further '.'. We express "not a direct child" as `fqnHash LIKE
-    // <serviceHash>.%.%` and reject those rows. ListFilter.getFqnPrefixCondition binds
-    // both `:serviceHash` (already used by the prefix LIKE in <sqlCondition>) and
-    // `:serviceHashChild` (the `.%.%` companion) so the SQL just plugs them in.
+    // time and is what the breadcrumb UI consumes). A root container is one whose parent is
+    // the service itself, which the generated `parentFqnHash` column states directly:
+    // `parentFqnHash LIKE :serviceHashExact` (a wildcard-free pattern, so an index lookup)
+    // paired with `parentFqnHash NOT LIKE '%.%'` to keep the no-service case correct.
+    // ListFilter.getFqnPrefixCondition binds both `:serviceHash` (used by the prefix LIKE
+    // in <sqlCondition>) and `:serviceHashExact`, so the SQL just plugs them in.
+    //
+    // This replaces `fqnHash NOT LIKE '<serviceHash>.%.%'`, which selected the same rows
+    // but gave the planner no indexable predicate — so the cursor's ORDER BY won on cost
+    // and the listing scanned container rows instead (#22530). On a 50k-container fixture
+    // the count query went from 235ms to 0.009ms.
     // Deferred join: resolve the page index-only on (name, id) in the derived table, then fetch
     // c.json by primary key for only the paged rows, so the json blob never enters the filesort.
     @SqlQuery(
@@ -361,7 +366,7 @@ private static java.util.Map<String, Object> rootListingParams(ListFilter filter
                 + "INNER JOIN ("
                 + "SELECT ce.id FROM <table> ce "
                 + "<sqlCondition> AND "
-                + "ce.fqnHash NOT LIKE :serviceHashChild AND "
+                + "ce.parentFqnHash LIKE :serviceHashExact AND ce.parentFqnHash NOT LIKE '%.%' AND "
                 + "(name < :beforeName OR (name = :beforeName AND id < :beforeId)) "
                 + "ORDER BY name DESC, id DESC "
                 + "LIMIT :limit"
@@ -381,7 +386,7 @@ List<String> listRootBefore(
                 + "INNER JOIN ("
                 + "SELECT ce.id FROM <table> ce "
                 + "<sqlCondition> AND "
-                + "ce.fqnHash NOT LIKE :serviceHashChild AND "
+                + "ce.parentFqnHash LIKE :serviceHashExact AND ce.parentFqnHash NOT LIKE '%.%' AND "
                 + "(name > :afterName OR (name = :afterName AND id > :afterId)) "
                 + "ORDER BY name, id "
                 + "LIMIT :limit"
@@ -398,12 +403,14 @@ List<String> listRootAfter(
     @ConnectionAwareSqlQuery(
         value =
             "SELECT count(<nameHashColumn>) FROM <table> ce "
-                + "<sqlCondition> AND ce.fqnHash NOT LIKE :serviceHashChild",
+                + "<sqlCondition> AND ce.parentFqnHash LIKE :serviceHashEx
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/ListFilter.java` (modified, +8/-8)
```diff
@@ -1485,15 +1485,15 @@ private String getTestSuiteTypeCondition(String tableName) {
   }
 
   private String getFqnPrefixCondition(String tableName, String fqnPrefix, String paramName) {
-    String prefix = FullyQualifiedName.buildHash(fqnPrefix) + Entity.SEPARATOR;
+    String hash = FullyQualifiedName.buildHash(fqnPrefix);
+    String prefix = hash + Entity.SEPARATOR;
     queryParams.put(paramName + "Hash", prefix + "%");
-    // Companion bind for "exclude descendants below the immediate level" — used by listings
-    // that need direct children only (e.g. ContainerDAO root listings, ContainerRepository
-    // listChildren). fqnHash uses fixed-width MD5 segments joined by '.', so a fqnHash that
-    // matches `<prefix>.%.%` has at least two segments below the prefix and is therefore not
-    // a direct child. Always bound — most queries don't reference it; the cost is one map
-    // entry. Avoids threading an extra param through every listing site.
-    queryParams.put(paramName + "HashChild", prefix + "%.%");
+    // Companion bind for "direct children of this prefix only" — used by listings that need
+    // the immediate level (e.g. ContainerDAO root listings). Matched against the generated
+    // `parentFqnHash` column, so the depth test is an indexed equality rather than a
+    // negated LIKE the planner can't use. Always bound — most queries don't reference it;
+    // the cost is one map entry. Avoids threading an extra param through every listing site.
+    queryParams.put(paramName + "HashExact", hash);
     return tableName == null
         ? String.format("fqnHash LIKE :%s", paramName + "Hash")
         : String.format("%s.fqnHash LIKE :%s", tableName, paramName + "Hash");
```

**File**: `openmetadata-service/src/test/java/org/openmetadata/service/jdbi3/ContainerChildrenQueryShapeTest.java` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+package org.openmetadata.service.jdbi3;
+
+import static org.junit.jupiter.api.Assertions.assertFalse;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+
+import java.lang.reflect.Method;
+import java.util.Arrays;
+import java.util.List;
+import java.util.stream.Collectors;
+import org.jdbi.v3.sqlobject.statement.SqlQuery;
+import org.junit.jupiter.api.Test;
+import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
+import org.openmetadata.service.jdbi3.locator.ConnectionType;
+
+/**
+ * Pins the access path of the container direct-children listings (#22530) — both
+ * {@code /containers/name/{fqn}/children} and the service root listing
+ * ({@code /containers?root=true}).
+ *
+ * <p>The listing used to select children with {@code fqnHash LIKE '<parent>.%' AND fqnHash NOT
+ * LIKE '<parent>.%.%'}. That returns the right rows, but neither predicate is an indexable
+ * equality, so the listing's {@code ORDER BY name, id LIMIT n} steered MySQL and PostgreSQL
+ * alike onto the {@code (deleted, name, id)} index — which already supplies that order — and
+ * they scanned container rows until the page filled. For a container near the root of a deep
+ * tree (large subtree, few direct children) the scan ran to the end of the table, making the
+ * cost O(containers in the deployment) rather than O(children returned).
+ *
+ * <p>Both spellings return identical rows, so no behavioural test can tell them apart — a
+ * revert would show up only as latency in production. These assertions are therefore on the
+ * declared SQL itself: the depth test must stay an equality against the generated
+ * {@code parentFqnHash} column, and the scanning form must not come back.
+ */
+class ContainerChildrenQueryShapeTest {
+
+  private static final List<String> CHILDREN_QUERY_METHODS =
+      List.of("listDirectChildSummariesByParentHash", "countDirectChildrenByParentHash");
+
+  private static final List<String> ROOT_LISTING_METHODS =
+      List.of("listRootBefore", "listRootAfter", "listRootCount");
+
+  @Test
+  void childrenQueries_matchParentByIndexedEquality() {
+    forEachChildrenQuery(
+        (method, connectionType, sql) ->
+            assertTrue(
+                sql.contains("parentFqnHash = :parentHash"),
+                method
+                    + " ("
+                    + connectionType
+                    + ") must select direct children by equality on parentFqnHash so"
+                    + " idx_storage_container_entity_parent_children can serve it. SQL: "
+                    + sql));
+  }
+
+  @Test
+  void childrenQueries_doNotScanTheSubtreeWithLikePredicates() {
+    forEachChildrenQuery(
+        (method, connectionType, sql) -> {
+          assertFalse(
+              sql.contains("fqnHash LIKE :parentHash"),
+              method
+                  + " ("
+                  + connectionType
+                  + ") reintroduces the un-indexable prefix LIKE that caused #22530. SQL: "
+                  + sql);
+          assertFalse(
+              sql.contains("NOT LIKE :parentHashChild"),
+              method
+                  + " ("
+                  + connectionType
+                  + ") reintroduces the depth exclusion that forced a row scan. SQL: "
+                  + sql);
+        });
+  }
+
+  /**
+   * The service root listing ({@code ?root=true}) answers the same question one level up —
+   * "which containers sit directly under this service" — and regressed the same way, for the
+   * same reason: {@code fqnHash NOT LIKE '<serviceHash>.%.%'} is not indexable, so the
+   * cursor's {@code ORDER BY name, id LIMIT n} won on cost and the listing scanned. It is
+   * now a wildcard-free {@code LIKE} against {@code parentFqnHash}, which both engines
+   * degenerate to an index lookup.
+   */
+  @Test
+  void rootListingQueries_matchServiceByIndexedParentHash() {
+    for (String methodName : ROOT_LISTING_METHODS) {
+      Method method = findMethod(methodName);
+      for (String sql : declaredSql(method)) {
+        assertTrue(
+            sql.contains("ce.parentFqnHash LIKE :serviceHashExact"),
+            methodName
+                + " must select service-root containers via parentFqnHash so"
+                + " idx_storage_container_entity_parent_children can serve it. SQL: "
+                + sql);
+        assertFalse(
+            sql.contains("fqnHash NOT LIKE :serviceHashChild"),
+            methodName
+                + " reintroduces the un-indexable depth exclusion that caused #22530. SQL: "
+                + sql);
+      }
+    }
+  }
+
+  /**
+   * Every engine variant of {@code method}'s SQL. {@code listRootBefore}/{@code listRootAfter}
+   * are plain {@link SqlQuery} (one dialect-neutral statement);
+   * {@code listRootCount} is {@link ConnectionAwareSqlQuery} (one per engine).
+   */
+  private List<String> declaredSql(Method method) {
+    List<String> sql =
+        Arrays.stream(method.getAnnotationsByType(Connectio
```

**File**: `openmetadata-service/src/test/java/org/openmetadata/service/jdbi3/ListFilterTest.java` (modified, +25/-20)
```diff
@@ -296,15 +296,17 @@ void test_serverIdConditionAppliesWhenServerIdParamPresent() {
    * `?service=` filtering must bind two related patterns:
    *   - {@code :serviceHash} for "any descendant of the service" — used by every
    *     service-filtered listing's WHERE clause via getFqnPrefixCondition.
-   *   - {@code :serviceHashChild} for "any descendant strictly below the immediate
-   *     level" — used by the root listing to negate descendants and keep only
+   *   - {@code :serviceHashExact} for "the service itself as a parent" — matched against
+   *     the generated {@code parentFqnHash} column by the root listing to keep only
    *     direct children.
    *
-   * Both binds must reflect the same MD5 prefix, only differing in the LIKE pattern's
-   * tail. This is the contract that ContainerDAO.listRoot{Before,After,Count} relies on.
+   * Both binds must reflect the same MD5 prefix; only the trailing LIKE pattern differs.
+   * This is the contract that ContainerDAO.listRoot{Before,After,Count} relies on — and
+   * {@code serviceHashExact} carries no wildcard precisely so the planner can serve it
+   * from idx_storage_container_entity_parent_children (#22530).
    */
   @Test
-  void test_getServiceCondition_bindsBothPrefixAndChildDepthPatterns() {
+  void test_getServiceCondition_bindsBothPrefixAndExactParentPatterns() {
     ListFilter filter = new ListFilter();
     filter.addQueryParam("service", "aws_s3");
 
@@ -314,20 +316,23 @@ void test_getServiceCondition_bindsBothPrefixAndChildDepthPatterns() {
         "WHERE clause should reference the service prefix LIKE bind. Got: " + condition);
 
     String hashLike = (String) filter.getQueryParams().get("serviceHash");
-    String hashLikeChild = (String) filter.getQueryParams().get("serviceHashChild");
+    String hashExact = (String) filter.getQueryParams().get("serviceHashExact");
     assertNotNull(hashLike, "serviceHash bind must be set when service is filtered");
-    assertNotNull(hashLikeChild, "serviceHashChild bind must be set for depth-aware listings");
+    assertNotNull(hashExact, "serviceHashExact bind must be set for depth-aware listings");
 
-    // Both binds share the same hashed prefix; only the LIKE-pattern tail differs.
     // In ContainerDAO.listRoot* the SQL uses them as:
-    //   fqnHash LIKE     :serviceHash       -- '<hash>.%'   matches all descendants
-    //   fqnHash NOT LIKE :serviceHashChild  -- '<hash>.%.%' rejects depth >= 2
-    // so the combination keeps only direct children (depth = 1).
+    //   fqnHash       LIKE :serviceHash       -- '<hash>.%' matches all descendants
+    //   parentFqnHash LIKE :serviceHashExact  -- '<hash>'   keeps only direct children
     int prefixEnd = hashLike.indexOf('%');
     assertTrue(prefixEnd > 0, "serviceHash should be of form '<hash>.%', got: " + hashLike);
     String prefix = hashLike.substring(0, prefixEnd);
     assertEquals(prefix + "%", hashLike);
-    assertEquals(prefix + "%.%", hashLikeChild);
+    assertEquals(prefix.substring(0, prefix.length() - 1), hashExact);
+    assertFalse(
+        hashExact.contains("%") || hashExact.contains("_"),
+        "serviceHashExact must stay wildcard-free so the LIKE degenerates to an indexable"
+            + " equality. Got: "
+            + hashExact);
   }
 
   /**
@@ -345,9 +350,9 @@ void test_getServiceCondition_dottedServiceNameUsesSingleHashedSegment() {
     filter.getCondition("storage_container_entity");
 
     String hashLike = (String) filter.getQueryParams().get("serviceHash");
-    String hashLikeChild = (String) filter.getQueryParams().get("serviceHashChild");
+    String hashExact = (String) filter.getQueryParams().get("serviceHashExact");
     assertNotNull(hashLike);
-    assertNotNull(hashLikeChild);
+    assertNotNull(hashExact);
 
     // The MD5 of a single quoted segment is 32 hex chars; with the trailing ".%" suffix
     // the prefix bind is exactly 34 chars. Two-segment-or-more service names would
@@ -356,14 +361,14 @@ void test_getServiceCondition_dottedServiceNameUsesSingleHashedSegment() {
     int prefixEnd = hashLike.indexOf('%');
     assertEquals(34, prefixEnd + 1, "Dotted service name should hash to exactly one segment");
 
-    // The child bind must mirror this: same 33-char hashed prefix + ".%.%".
-    int childPrefixEnd = hashLikeChild.indexOf('%');
-    assertEquals(prefixEnd, childPrefixEnd, "Both binds must share the same prefix length");
+    // The exact bind must mirror this: the same single 32-char hashed segment, no suffix.
+    assertEquals(32, hashExact.length(), "Dotted service name should hash to one 32-char segment");
+    assertEquals(hashLike.substring(0, 32), hashExact, "Both binds must share the same hash");
   }
 
   /**
    * {@code ?root=true} without {@code ?service=} must not bind {@code :serviceHash}
-   * either — confirming that the depth bind {@code :serviceHashChild} the
+   * either — confirming that the depth bind {@code :serviceHashExact} the
    * {@co
```

---

### Incident Patch 6: `d055d7d6` (2026-10-05)
**Commit Message**: Fixes #14601: Health-check pooled LDAP connections and show the directory on the Health Check page (#34649)

* Fixes #14601: Health-check pooled LDAP connections so a dropped one cannot stall login

The LDAP lookup pool used the SDK's default health check, which never probes a
connection. When a firewall or load balancer silently drops an idle pooled
connection, the next login's user search waits out the SDK's five-minute search
response timeout, and the login retry can repeat that on another dead connection.

- Probe each pooled connection with a root DSE read before checkout, every 60 s
  in the background, and after a connection error; a connection that stays
  silent for 5 s is replaced. The background probe also keeps idle connections
  alive through load balancer and firewall idle timeouts.
- Retry a search once on a fresh connection when its connection turns out dead.
- Open pool connections through the same openConnection path as the password
  check and Test Login, and close the socket when the lookup bind is rejected.
- Close the handlers a security reload replaces, so their LDAP pools stop
  probing the directory once the provider is no longer LDAP.

Co-Authored-By: Clau

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/SystemResourceIT.java` (modified, +3/-0)
```diff
@@ -203,6 +203,9 @@ void test_getSystemStatus() throws Exception {
 
     Boolean migrationsPassed = migrations.get("passed").asBoolean();
     assertTrue(migrationsPassed, "Database migrations should have passed");
+    assertFalse(
+        statusNode.has("LDAP"),
+        "The status reports on an LDAP directory only when LDAP is the login provider");
   }
 
   @Test
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/OpenMetadataApplication.java` (modified, +40/-1)
```diff
@@ -16,6 +16,7 @@
 import static org.openmetadata.service.util.jdbi.JdbiUtils.createAndSetupJDBI;
 
 import com.fasterxml.jackson.databind.SerializationFeature;
+import com.google.common.annotations.VisibleForTesting;
 import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
 import io.dropwizard.configuration.SubstitutingSourceProvider;
 import io.dropwizard.core.Application;
@@ -947,9 +948,12 @@ private void validateConfiguration(OpenMetadataApplicationConfig catalogConfig)
 
   public void reinitializeAuthSystem(
       OpenMetadataApplicationConfig config, Environment environment) {
+    MutableServletContextHandler contextHandler = environment.getApplicationContext();
+    AuthServeletHandler previousHandler =
+        AuthServeletHandlerRegistry.getHandler(contextHandler.getServletContext());
+    AuthenticatorHandler previousAuthenticator = authenticatorHandler;
     try {
       LOG.info("Starting authentication system reinitialization");
-      MutableServletContextHandler contextHandler = environment.getApplicationContext();
       SessionService sessionService =
           AuthServeletHandlerRegistry.getSessionService(contextHandler.getServletContext());
       if (sessionService == null) {
@@ -993,6 +997,41 @@ public void reinitializeAuthSystem(
       // Trigger rollback in AuthenticationConfigurationManager
       // Rollback is handled internally by SecurityConfigurationManager
       throw new RuntimeException("Authentication system reinitialization failed", e);
+    } finally {
+      closeReplacedAuthHandlers(
+          previousHandler,
+          AuthServeletHandlerRegistry.getHandler(contextHandler.getServletContext()),
+          previousAuthenticator,
+          authenticatorHandler);
+    }
+  }
+
+  /**
+   * Closes the handlers a security reload swapped out, including when the reload failed after the
+   * swap: nothing routes to them any more, and an LDAP one would otherwise keep its pool probing
+   * the directory it was built for. A handler the reload never replaced is still serving logins
+   * and stays open. Every reload builds new instances, so identity tells the two apart.
+   */
+  @VisibleForTesting
+  static void closeReplacedAuthHandlers(
+      AuthServeletHandler previousHandler,
+      AuthServeletHandler currentHandler,
+      AuthenticatorHandler previousAuthenticator,
+      AuthenticatorHandler currentAuthenticator) {
+    if (previousHandler != currentHandler) {
+      closeQuietly(previousHandler::close);
+    }
+    if (previousAuthenticator != currentAuthenticator) {
+      closeQuietly(previousAuthenticator::close);
+    }
+  }
+
+  /** A failed close must neither hide the reload's own error nor fail a reload that worked. */
+  private static void closeQuietly(Runnable close) {
+    try {
+      close.run();
+    } catch (RuntimeException e) {
+      LOG.warn("Could not close an auth handler replaced by a security reload", e);
     }
   }
 
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/SystemRepository.java` (modified, +20/-0)
```diff
@@ -116,7 +116,9 @@
 import org.openmetadata.service.security.JwtFilter;
 import org.openmetadata.service.security.SecurityUtil;
 import org.openmetadata.service.security.TokenValidityResolver;
+import org.openmetadata.service.security.auth.LdapDirectoryValidation;
 import org.openmetadata.service.security.auth.LoginAttemptCache;
+import org.openmetadata.service.security.auth.SecurityConfigurationManager;
 import org.openmetadata.service.security.auth.validator.Auth0Validator;
 import org.openmetadata.service.security.auth.validator.AzureAuthValidator;
 import org.openmetadata.service.security.auth.validator.CognitoAuthValidator;
@@ -147,6 +149,7 @@ public class SystemRepository {
   public static final String INTERNAL_SERVER_ERROR_WITH_REASON = "Internal Server Error. Reason :";
   private static final String VECTOR_EMBEDDING_INDEX_KEY = "vectorEmbedding";
   private static final String REINDEX_STATUS_VALIDATION_KEY = "Search Reindex Status";
+  private static final String LDAP_VALIDATION_KEY = "LDAP";
   private final SystemDAO dao;
   private final MigrationValidationClient migrationValidationClient;
 
@@ -156,6 +159,7 @@ private enum ValidationStepDescription {
     PIPELINE_SERVICE_CLIENT("Validate that the pipeline service client is available."),
     JWT_TOKEN("Validate that the ingestion-bot JWT token can be properly decoded."),
     MIGRATION("Validate that all the necessary migrations have been properly executed."),
+    LDAP("Validate that the login LDAP directory is reachable and accepts the lookup account."),
     SEARCH_REINDEX(
         "Validate that every deployed search index was built from the current index mapping "
             + "(i.e. no reindex is pending).");
@@ -739,6 +743,8 @@ public ValidationResponse validateSystem(
       validation.setLogStorage(logStorageValidation);
     }
 
+    addLdapValidation(validation, SecurityConfigurationManager.getCurrentAuthConfig());
+
     if (Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
       validation.setAdditionalProperty(
           "Semantic Search", getEmbeddingsValidation(applicationConfig));
@@ -878,6 +884,20 @@ private void deleteProbeQuietly(AssetService assetService, Asset probe) {
   public void addExtraValidations(
       OpenMetadataApplicationConfig applicationConfig, ValidationResponse validation) {}
 
+  /** Only an LDAP login depends on the directory, so only then does the status report on it. */
+  @VisibleForTesting
+  static void addLdapValidation(
+      ValidationResponse validation, AuthenticationConfiguration authConfig) {
+    if (authConfig != null
+        && authConfig.getProvider() == AuthProvider.LDAP
+        && authConfig.getLdapConfiguration() != null) {
+      validation.setAdditionalProperty(
+          LDAP_VALIDATION_KEY,
+          LdapDirectoryValidation.validate(authConfig.getLdapConfiguration())
+              .withDescription(ValidationStepDescription.LDAP.key));
+    }
+  }
+
   @VisibleForTesting
   StepValidation getEmbeddingsValidation(OpenMetadataApplicationConfig applicationConfig) {
     StepValidation embeddingsValidation = new StepValidation();
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/security/AuthServeletHandler.java` (modified, +3/-0)
```diff
@@ -11,4 +11,7 @@ public interface AuthServeletHandler {
   void handleCallback(HttpServletRequest req, HttpServletResponse resp);
 
   void handleRefresh(HttpServletRequest req, HttpServletResponse resp);
+
+  /** Releases what this handler holds, once a security reload has replaced it. */
+  default void close() {}
 }
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/security/auth/AuthenticatorHandler.java` (modified, +3/-0)
```diff
@@ -38,6 +38,9 @@ default void reload(OpenMetadataApplicationConfig config) {
     init(config);
   }
 
+  /** Releases what {@link #init} acquired, once a security reload has replaced this handler. */
+  default void close() {}
+
   JwtResponse loginUser(LoginRequest loginRequest) throws IOException, TemplateException;
 
   void checkIfLoginBlocked(String userName);
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/security/auth/LdapAuthServletHandler.java` (modified, +5/-0)
```diff
@@ -237,6 +237,11 @@ public void handleLogout(HttpServletRequest req, HttpServletResponse resp) {
     }
   }
 
+  @Override
+  public void close() {
+    authenticator.close();
+  }
+
   private LoginRequest parseLoginRequest(HttpServletRequest req) throws IOException {
     if ("POST".equalsIgnoreCase(req.getMethod())) {
       StringBuilder sb = new StringBuilder();
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/security/auth/LdapAuthenticator.java` (modified, +66/-28)
```diff
@@ -20,9 +20,11 @@
 import com.unboundid.ldap.sdk.Attribute;
 import com.unboundid.ldap.sdk.BindResult;
 import com.unboundid.ldap.sdk.Filter;
+import com.unboundid.ldap.sdk.GetEntryLDAPConnectionPoolHealthCheck;
 import com.unboundid.ldap.sdk.LDAPConnection;
 import com.unboundid.ldap.sdk.LDAPConnectionOptions;
 import com.unboundid.ldap.sdk.LDAPConnectionPool;
+import com.unboundid.ldap.sdk.LDAPConnectionPoolHealthCheck;
 import com.unboundid.ldap.sdk.LDAPException;
 import com.unboundid.ldap.sdk.ResultCode;
 import com.unboundid.ldap.sdk.SearchRequest;
@@ -85,6 +87,12 @@
 public class LdapAuthenticator implements AuthenticatorHandler {
   static final String AD_RECURSIVE_GROUP_MATCHING_RULE = "1.2.840.113556.1.4.1941";
   static final String LDAP_ERR_MSG = "[LDAP] Issue in creating a LookUp Connection ";
+  private static final String ROOT_DSE = "";
+  // Below the idle timeout of common load balancers and firewalls, so the background probe also
+  // keeps them from silently dropping pooled connections that sit idle between logins.
+  private static final long POOL_HEALTH_CHECK_INTERVAL_MILLIS = 60_000L;
+  private static final long POOL_HEALTH_CHECK_TIMEOUT_MILLIS = 5_000L;
+  private static final int DIRECTORY_TIMEOUT_MILLIS = 5_000;
   private static final int MAX_RETRIES = 3;
   private static final int BASE_DELAY_MS = 500;
   private static final String DEFAULT_EMAIL_ATTRIBUTE = "mail";
@@ -101,7 +109,7 @@ public void init(OpenMetadataApplicationConfig config) {
     if (SecurityConfigurationManager.getCurrentAuthConfig().getProvider().equals(AuthProvider.LDAP)
         && SecurityConfigurationManager.getCurrentAuthConfig().getLdapConfiguration() != null) {
       ldapLookupConnectionPool =
-          getLdapConnectionPool(
+          createLookupConnectionPool(
               SecurityConfigurationManager.getCurrentAuthConfig().getLdapConfiguration());
     } else {
       throw new IllegalStateException("Invalid or Missing Ldap Configuration.");
@@ -115,38 +123,60 @@ public void init(OpenMetadataApplicationConfig config) {
         SecurityConfigurationManager.getCurrentAuthConfig().getEnableSelfSignup();
   }
 
-  private LDAPConnectionPool getLdapConnectionPool(LdapConfiguration ldapConfiguration) {
-    LDAPConnectionPool connectionPool;
+  static LDAPConnectionPool createLookupConnectionPool(LdapConfiguration ldapConfiguration) {
     try {
-      if (Boolean.TRUE.equals(ldapConfiguration.getSslEnabled())) {
-        LDAPConnectionOptions connectionOptions = new LDAPConnectionOptions();
-        LdapUtil ldapUtil = new LdapUtil();
-        SSLUtil sslUtil =
-            new SSLUtil(ldapUtil.getLdapSSLConnection(ldapConfiguration, connectionOptions));
-        LDAPConnection connection =
-            new LDAPConnection(
-                sslUtil.createSSLSocketFactory(),
-                connectionOptions,
-                ldapConfiguration.getHost(),
-                ldapConfiguration.getPort(),
-                ldapConfiguration.getDnAdminPrincipal(),
-                ldapConfiguration.getDnAdminPassword());
-        // Use the connection here.
-        connectionPool = new LDAPConnectionPool(connection, ldapConfiguration.getMaxPoolSize());
-      } else {
-        LDAPConnection conn =
-            new LDAPConnection(
-                ldapConfiguration.getHost(),
-                ldapConfiguration.getPort(),
-                ldapConfiguration.getDnAdminPrincipal(),
-                ldapConfiguration.getDnAdminPassword());
-        connectionPool = new LDAPConnectionPool(conn, ldapConfiguration.getMaxPoolSize());
-      }
+      LDAPConnectionPool connectionPool =
+          new LDAPConnectionPool(
+              openLookupConnection(ldapConfiguration), ldapConfiguration.getMaxPoolSize());
+      connectionPool.setHealthCheck(rootDseHealthCheck());
+      connectionPool.setHealthCheckIntervalMillis(POOL_HEALTH_CHECK_INTERVAL_MILLIS);
+      connectionPool.setRetryFailedOperationsDueToInvalidConnections(true);
+      return connectionPool;
     } catch (LDAPException | GeneralSecurityException e) {
       LOG.error("[LDAP] Issue in creating a LookUp Connection", e);
       throw new IllegalStateException(LDAP_ERR_MSG, e);
     }
-    return connectionPool;
+  }
+
+  private static LDAPConnection openLookupConnection(LdapConfiguration ldapConfiguration)
+      throws LDAPException, GeneralSecurityException {
+    LDAPConnection connection = openConnection(ldapConfiguration, new LDAPConnectionOptions());
+    try {
+      connection.bind(
+          ldapConfiguration.getDnAdminPrincipal(), ldapConfiguration.getDnAdminPassword());
+    } catch (LDAPException e) {
+      connection.close();
+      throw e;
+    }
+    return connection;
+  }
+
+  /**
+   * Reads the root DSE to prove a pooled connection still gets answers: before each checkout, on
+   * every background pass, and after an error that may have broken it. A connection that stays
+   * silent past the timeout is replaced instead of sta
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/security/auth/LdapDirectoryValidation.java` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+/*
+ *  Copyright 2026 Collate.
+ *  Licensed under the Apache License, Version 2.0 (the "License");
+ *  you may not use this file except in compliance with the License.
+ *  You may obtain a copy of the License at
+ *  http://www.apache.org/licenses/LICENSE-2.0
+ *  Unless required by applicable law or agreed to in writing, software
+ *  distributed under the License is distributed on an "AS IS" BASIS,
+ *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ *  See the License for the specific language governing permissions and
+ *  limitations under the License.
+ */
+package org.openmetadata.service.security.auth;
+
+import com.unboundid.ldap.sdk.LDAPConnection;
+import com.unboundid.ldap.sdk.LDAPException;
+import java.security.GeneralSecurityException;
+import org.apache.commons.lang3.exception.ExceptionUtils;
+import org.openmetadata.schema.auth.LdapConfiguration;
+import org.openmetadata.schema.system.StepValidation;
+
+/**
+ * The LDAP entry of the system status, shown on the Health Check page. It reaches the directory the
+ * way login does, binds as the lookup account and reads the user base DN, and names the step that
+ * failed.
+ */
+public final class LdapDirectoryValidation {
+  private static final String NO_ATTRIBUTES = "1.1";
+
+  private LdapDirectoryValidation() {}
+
+  public static StepValidation validate(LdapConfiguration ldap) {
+    try (LDAPConnection connection =
+        LdapAuthenticator.openConnection(ldap, LdapAuthenticator.boundedConnectionOptions())) {
+      return validateLookupAccount(connection, ldap);
+    } catch (LDAPException | GeneralSecurityException e) {
+      return failed(
+          String.format(
+              "Could not connect to %s:%s: %s", ldap.getHost(), ldap.getPort(), reasonOf(e)));
+    }
+  }
+
+  private static StepValidation validateLookupAccount(
+      LDAPConnection connection, LdapConfiguration ldap) {
+    try {
+      connection.bind(ldap.getDnAdminPrincipal(), ldap.getDnAdminPassword());
+    } catch (LDAPException e) {
+      return failed(
+          String.format(
+              "The directory rejected the lookup account '%s': %s",
+              ldap.getDnAdminPrincipal(), reasonOf(e)));
+    }
+    return validateUserBaseDn(connection, ldap);
+  }
+
+  private static StepValidation validateUserBaseDn(
+      LDAPConnection connection, LdapConfiguration ldap) {
+    try {
+      return connection.getEntry(ldap.getUserBaseDN(), NO_ATTRIBUTES) == null
+          ? failed(
+              String.format(
+                  "The user base DN '%s' does not exist or the lookup account cannot read it",
+                  ldap.getUserBaseDN()))
+          : passed(ldap);
+    } catch (LDAPException e) {
+      return failed(
+          String.format(
+              "Could not read the user base DN '%s': %s", ldap.getUserBaseDN(), reasonOf(e)));
+    }
+  }
+
+  private static StepValidation passed(LdapConfiguration ldap) {
+    return new StepValidation()
+        .withPassed(Boolean.TRUE)
+        .withMessage(
+            String.format(
+                "Connected to %s:%s, bound as the lookup account and read the user base DN '%s'",
+                ldap.getHost(), ldap.getPort(), ldap.getUserBaseDN()));
+  }
+
+  private static StepValidation failed(String message) {
+    return new StepValidation().withPassed(Boolean.FALSE).withMessage(message);
+  }
+
+  /** The SDK wraps the useful reason, such as "Connection refused", in layers of its own text. */
+  private static String reasonOf(Exception e) {
+    return TestLoginService.rootMessage(ExceptionUtils.getRootCause(e));
+  }
+}
```

---

### Incident Patch 7: `8773b0e8` (2026-10-05)
**Commit Message**: Fixes #34679: test case details page fixes from post-merge validation (#34655)

* fix(dq): read the last-run banner's expectation from the test's bounds

The banner's RESULT / EXPECTED block paired the run's result with the
test parameter of the same name. Ingestion never names them alike: a
row count test reports `rowCount` against the parameter `value`, so the
block never showed for real runs. The unit and e2e fixtures used shapes
ingestion never produces, which hid it.

The banner now reads Found and Expected through the run details card's
helpers (getFoundValue, getRunExpectation, formatExpectation), so the
two always agree. It takes the test case instead of its parameters, and
both pages' memos depend on the test case.

* fix(dq): let the last-run banner's right side widen for a long comparison

A range test with large numbers (1,500,000 / 1,000,000 – 2,000,000) is
wider than the banner's 320 px right side, and the comparison, which
does not wrap, spilled over the run's reason. The right side is now at
least 320 px rather than exactly 320 px, so it widens and the reason
truncates before it. Normal values keep the 320 px right side aligned
with the rail.

* fix(dq): keep the ex

**File**: `.github/playwright/impact-map.generated.json` (modified, +0/-24)
```diff
@@ -12173,14 +12173,6 @@
         "playwright/e2e/Pages/TasksUIFlow.spec.ts"
       ]
     },
-    {
-      "sources": [
-        "openmetadata-ui/src/main/resources/ui/src/pages/TasksPage/shared/DiffView/DiffView.tsx"
-      ],
-      "specs": [
-        "playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts"
-      ]
-    },
     {
       "sources": [
         "openmetadata-ui/src/main/resources/ui/src/pages/TasksPage/shared/DiffViewNew.tsx"
@@ -12189,14 +12181,6 @@
         "playwright/e2e/Pages/GlossaryImportExport.spec.ts"
       ]
     },
-    {
-      "sources": [
-        "openmetadata-ui/src/main/resources/ui/src/pages/TasksPage/shared/TagsDiffView.tsx"
-      ],
-      "specs": [
-        "playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts"
-      ]
-    },
     {
       "sources": [
         "openmetadata-ui/src/main/resources/ui/src/pages/TeamsPage/AddTeamForm.tsx"
@@ -12292,14 +12276,6 @@
         "playwright/e2e/Features/DataAssetRulesDisabled.spec.ts"
       ]
     },
-    {
-      "sources": [
-        "openmetadata-ui/src/main/resources/ui/src/utils/EntityDiffUtils.tsx"
-      ],
-      "specs": [
-        "playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts"
-      ]
-    },
     {
       "sources": [
         "openmetadata-ui/src/main/resources/ui/src/utils/EntityDisplayPureUtils.tsx"
```

**File**: `openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/DataQuality/DataQuality.spec.ts` (modified, +4/-4)
```diff
@@ -890,9 +890,9 @@ test.describe(
         await failedRunTable.addTestCaseResult(apiContext, testCaseFqn, {
           result: failureResult,
           testCaseStatus: 'Failed',
-          testResultValue: [
-            { name: 'minValue', predictedValue: '1', value: '0' },
-          ],
+          // Named as ingestion names it, not after a parameter, so the banner
+          // must read the expectation from the test's bounds.
+          testResultValue: [{ name: 'rowCount', value: '0' }],
           timestamp: failedTimestamp,
         });
         await waitForIncidentToBeIndexed(
@@ -933,7 +933,7 @@ test.describe(
           banner.getByTestId('test-case-result-expected')
         ).toContainText('Result / Expected');
         await expect(banner.getByTestId('test-case-result-value')).toHaveText(
-          '0 / 1'
+          '0 / 1 – 100'
         );
         await expect(banner.getByTestId('test-case-last-run-time')).toHaveText(
           customFormatDateTime(failedTimestamp, 'MMM d, yyyy, h:mm a')
```

**File**: `openmetadata-ui/src/main/resources/ui/playwright/e2e/VersionPages/TestCaseVersionPage.spec.ts` (modified, +10/-12)
```diff
@@ -167,19 +167,17 @@ test.describe('TestCase Version Page', () => {
 
       await page.getByTestId('version-button').click();
 
-      await expect(
-        page.getByTestId('minValue').getByTestId('diff-removed')
-      ).toHaveText('12');
-      await expect(
-        page.getByTestId('minValue').getByTestId('diff-added')
-      ).toHaveText('20');
+      const minValueRow = page.getByTestId('configuration-parameter-minValue');
+      const maxValueRow = page.getByTestId('configuration-parameter-maxValue');
 
-      await expect(
-        page.getByTestId('maxValue').getByTestId('diff-removed')
-      ).toHaveText('34');
-      await expect(
-        page.getByTestId('maxValue').getByTestId('diff-added')
-      ).toHaveText('40');
+      await expect(minValueRow.getByTestId('diff-removed')).toHaveText('12');
+      await expect(minValueRow.getByTestId('diff-added')).toHaveText('20');
+      await expect(maxValueRow.getByTestId('diff-removed')).toHaveText('34');
+      await expect(maxValueRow.getByTestId('diff-added')).toHaveText('40');
+
+      // Each change reads whole: a character diff glued the digits together.
+      await expect(minValueRow).toContainText('12 → 20');
+      await expect(maxValueRow).toContainText('34 → 40');
     });
   });
 });
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/DataQuality/IncidentManager/IncidentManagerPageHeader/TestCaseLastRunBanner.component.tsx` (modified, +5/-5)
```diff
@@ -38,7 +38,7 @@ const TestCaseLastRunBanner = ({
   incidentTask,
   nextRunTimestamp,
   onAcknowledge,
-  parameterValues,
+  testCase,
   testCaseResult,
   testCaseStatus: authoritativeTestCaseStatus,
   testCaseStatusData,
@@ -80,7 +80,7 @@ const TestCaseLastRunBanner = ({
     );
   }
 
-  const { result, testResultValue, timestamp } = testCaseResult;
+  const { result, timestamp } = testCaseResult;
   const config = STATUS_CONFIG[testCaseStatus];
   const description = getRunDescription(
     result,
@@ -89,8 +89,8 @@ const TestCaseLastRunBanner = ({
   );
   const incidentLink = getIncidentLink(taskLinkInfo, testCaseStatus);
   const metricSummary = getMetricSummary(
-    parameterValues,
-    testResultValue,
+    testCase,
+    testCaseResult,
     testCaseStatus
   );
   const incidentTitle = incidentTask
@@ -127,7 +127,7 @@ const TestCaseLastRunBanner = ({
       }
       rightSection={
         <div
-          className="tw:flex tw:shrink-0 tw:items-stretch tw:justify-end tw:gap-6 tw:lg:w-80"
+          className="tw:flex tw:shrink-0 tw:items-stretch tw:justify-end tw:gap-6 tw:lg:min-w-80"
           data-testid="test-case-last-run-right-section">
           <ResultExpected
             config={config}
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/DataQuality/IncidentManager/IncidentManagerPageHeader/TestCaseLastRunBanner.interface.ts` (modified, +2/-2)
```diff
@@ -14,7 +14,7 @@
 import type { ReactNode } from 'react';
 import type { Task } from '../../../../generated/entity/tasks/task';
 import type {
-  TestCaseParameterValue,
+  TestCase,
   TestCaseResolutionStatus,
   TestCaseResult,
   TestCaseStatus,
@@ -31,7 +31,7 @@ export interface TestCaseLastRunBannerProps {
   incidentTask: Task | null;
   nextRunTimestamp?: number;
   onAcknowledge?: () => Promise<void>;
-  parameterValues?: TestCaseParameterValue[];
+  testCase?: TestCase;
   testCaseResult?: TestCaseResult;
   testCaseStatus?: TestCaseStatus;
   testCaseStatusData?: TestCaseResolutionStatus;
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/DataQuality/IncidentManager/IncidentManagerPageHeader/TestCaseLastRunBanner.test.tsx` (modified, +76/-14)
```diff
@@ -15,11 +15,14 @@ import { act, fireEvent, render, screen } from '@testing-library/react';
 import { useNavigate } from 'react-router-dom';
 import {
   TestCaseStatus,
+  type TestCase,
+  type TestCaseParameterValue,
   type TestCaseResolutionStatus,
   type TestCaseResult,
 } from '../../../../generated/tests/testCase';
 import {
   MOCK_TASK_DATA,
+  MOCK_TEST_CASE_DATA,
   MOCK_TEST_CASE_RESOLUTION_STATUS,
 } from '../../../../mocks/TestCase.mock';
 import TestCaseLastRunBanner from './TestCaseLastRunBanner.component';
@@ -48,10 +51,25 @@ const TEXT_XS_CLASS = 'tw:text-xs';
 const INCIDENT_PATH =
   '/test-case/sample_data.ecommerce_db.shopify.dim_address.table_column_count_between/issues';
 
+const testCaseWith = (
+  definitionName: string,
+  parameterValues: TestCaseParameterValue[]
+) =>
+  ({
+    ...MOCK_TEST_CASE_DATA,
+    parameterValues,
+    testDefinition: {
+      ...MOCK_TEST_CASE_DATA.testDefinition,
+      name: definitionName,
+    },
+  } as TestCase);
+
 const defaultProps: TestCaseLastRunBannerProps = {
   incidentTask: MOCK_TASK_DATA[1],
-  parameterValues: [{ name: 'rowCount', value: '1000' }],
   taskLinkInfo: { label: '#9', path: INCIDENT_PATH },
+  testCase: testCaseWith('tableRowCountToEqual', [
+    { name: 'value', value: '1000' },
+  ]),
   testCaseStatusData:
     MOCK_TEST_CASE_RESOLUTION_STATUS[1] as TestCaseResolutionStatus,
 };
@@ -130,7 +148,7 @@ describe('TestCaseLastRunBanner', () => {
       );
       expect(
         screen.getByTestId('test-case-last-run-right-section')
-      ).toHaveClass('tw:justify-end', 'tw:lg:w-80');
+      ).toHaveClass('tw:justify-end', 'tw:lg:min-w-80');
       expect(screen.getByText(result)).toHaveClass(TEXT_XS_CLASS);
       expect(
         screen.getByTestId('test-case-run-description')
@@ -246,35 +264,79 @@ describe('TestCaseLastRunBanner', () => {
     ).not.toHaveTextContent('label.failed');
   });
 
-  it('uses the matching test parameter when the result omits its predicted value', () => {
+  // Real result names differ from their parameters' (`rowCount` against
+  // `value`), which is why the comparison is read from the test's bounds.
+  it.each<[string, TestCase, TestCaseResult['testResultValue'], string]>([
+    [
+      'a row count with its expected value',
+      testCaseWith('tableRowCountToEqual', [{ name: 'value', value: '10000' }]),
+      [{ name: 'rowCount', value: '110' }],
+      '110 / 10,000',
+    ],
+    [
+      'a row count with its allowed range',
+      testCaseWith('tableRowCountToBeBetween', [
+        { name: 'minValue', value: '12' },
+        { name: 'maxValue', value: '34' },
+      ]),
+      [{ name: 'rowCount', value: '25' }],
+      '25 / 12 – 34',
+    ],
+    [
+      'a null count with the zero its definition implies',
+      testCaseWith('columnValuesToBeNotNull', []),
+      [{ name: 'nullCount', value: '5' }],
+      '5 / 0',
+    ],
+  ])('compares %s', (_, testCase, testResultValue, expectedText) => {
     renderBanner({
-      parameterValues: [
-        { name: 'rowCount', value: '10000' },
-        { name: 'columnName', value: 'customer_id' },
-      ],
+      testCase,
       testCaseResult: {
-        result: 'Found 110 rows vs. the expected 10,000',
         testCaseStatus: TestCaseStatus.Failed,
-        testResultValue: [{ name: 'rowCount', value: '110' }],
+        testResultValue,
         timestamp: TEST_CASE_RESULT_TIMESTAMP,
       },
       testCaseStatus: TestCaseStatus.Failed,
     });
 
-    expect(screen.getByTestId(RESULT_EXPECTED_TEST_ID)).toHaveTextContent(
-      '110 / 10,000'
+    expect(screen.getByTestId('test-case-result-value')).toHaveTextContent(
+      expectedText
     );
   });
 
-  it('does not pair a result with an unrelated test parameter', () => {
+  it.each<[string, TestCase | undefined, TestCaseResult['testResultValue']]>([
+    [
+      'the test case has not loaded yet',
+      undefined,
+      [{ name: 'rowCount', value: '110' }],
+    ],
+    [
+      'the test states no expectation',
+      testCaseWith('columnValuesToMatchRegex', [
+        { name: 'regex', value: '^[0-9]+$' },
+      ]),
+      [{ name: 'likeCount', value: '5' }],
+    ],
+    [
+      'the run measured more than one value',
+      testCaseWith('columnValuesToBeBetween', [
+        { name: 'minValue', value: '1' },
+        { name: 'maxValue', value: '3489' },
+      ]),
+      [
+        { name: 'min', value: '1' },
+        { name: 'max', value: '3489' },
+      ],
+    ],
+  ])('hides the comparison when %s', (_, testCase, testResultValue) => {
     const result = 'Found 5 rows';
 
     renderBanner({
-      parameterValues: [{ name: 'columnName', value: 'customer_id' }],
+      testCase,
       testCaseResult: {
         result,
         testCaseStatus: TestCaseStatus.Failed,
-        testResultValue: [{ name: 'rowCount', value: '5' }],
+        testResultValue,
         timestamp: TEST_CASE_RESULT_TIMESTAMP,
       },
       testCaseStatus: TestCaseStatus.Failed,
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/DataQuality/IncidentManager/IncidentManagerPageHeader/TestCaseLastRunBanner.utils.ts` (modified, +38/-23)
```diff
@@ -11,9 +11,22 @@
  *  limitations under the License.
  */
 
-import { TestCaseStatus } from '../../../../generated/tests/testCase';
+import { isUndefined } from 'lodash';
+import {
+  TestCase,
+  TestCaseResult,
+  TestCaseStatus,
+} from '../../../../generated/tests/testCase';
+import { toFiniteNumber } from '../../../../utils/DataQuality/TestSummaryGraphUtils';
 import { convertMillisecondsToHumanReadableFormat } from '../../../../utils/date-time/DateTimeUtils';
 import { getNameFromFQN } from '../../../../utils/FqnUtils';
+import { NO_VALUE } from '../../../Database/Profiler/TestSummary/TestSummary.constants';
+import { formatNumber } from '../../../Database/Profiler/TestSummary/TestSummary.utils';
+import {
+  formatExpectation,
+  getFoundValue,
+  getRunExpectation,
+} from '../RunDetailsCard/RunDetailsCard.utils';
 import {
   INCIDENT_RUN_STATUSES,
   INCIDENT_STATUS_CONFIG,
@@ -22,18 +35,21 @@ import {
 import type { TestCaseLastRunBannerProps } from './TestCaseLastRunBanner.interface';
 import type { TaskLinkInfo } from './useTestCaseIncidentHeader';
 
-type TestResultValues = NonNullable<
-  TestCaseLastRunBannerProps['testCaseResult']
->['testResultValue'];
+const getExpectedText = (
+  testCase: TestCase | undefined,
+  testCaseResult: TestCaseResult
+) => {
+  const predicted = toFiniteNumber(
+    testCaseResult.testResultValue?.[0]?.predictedValue
+  );
 
-const formatMetricValue = (value?: string) => {
-  if (!value) {
-    return undefined;
+  if (!isUndefined(predicted)) {
+    return formatNumber(predicted);
   }
 
-  const numericValue = Number(value);
-
-  return Number.isFinite(numericValue) ? numericValue.toLocaleString() : value;
+  return testCase
+    ? formatExpectation(getRunExpectation(testCase, testCaseResult))
+    : NO_VALUE;
 };
 
 export const getRunDescription = (
@@ -49,27 +65,26 @@ export const getIncidentLink = (
   testCaseStatus: TestCaseStatus
 ) => (INCIDENT_RUN_STATUSES.has(testCaseStatus) ? taskLinkInfo : null);
 
+/**
+ * The latest run's RESULT / EXPECTED pair, read through the run details card's
+ * helpers so the two cannot disagree. A result is rarely named like its
+ * parameter (`rowCount` against `value`), so there is no name lookup.
+ */
 export const getMetricSummary = (
-  parameterValues: TestCaseLastRunBannerProps['parameterValues'],
-  testResultValue: TestResultValues,
+  testCase: TestCase | undefined,
+  testCaseResult: TestCaseResult,
   testCaseStatus: TestCaseStatus
 ) => {
-  const metric = testResultValue?.[0];
-  const resultValue = formatMetricValue(metric?.value);
-  const matchingParameter = parameterValues?.find(
-    ({ name }) => name === metric?.name
-  );
-  const expectedValue = formatMetricValue(
-    metric?.predictedValue ?? matchingParameter?.value
-  );
+  const found = getFoundValue(testCaseResult);
+  const expectedValue = getExpectedText(testCase, testCaseResult);
 
   return {
     expectedValue,
-    resultValue,
+    resultValue: isUndefined(found) ? undefined : formatNumber(found),
     show:
       METRIC_RUN_STATUSES.has(testCaseStatus) &&
-      resultValue !== undefined &&
-      expectedValue !== undefined,
+      !isUndefined(found) &&
+      expectedValue !== NO_VALUE,
   };
 };
 
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/DataQuality/IncidentManager/TestCaseResultTab/TestCaseConfigurationCard/TestCaseConfigurationCard.tsx` (modified, +5/-8)
```diff
@@ -11,6 +11,7 @@
  *  limitations under the License.
  */
 import { Box, Card, Typography } from '@openmetadata/ui-core-components';
+import type { ReactNode } from 'react';
 import { useTranslation } from 'react-i18next';
 import { ReactComponent as StarIcon } from '../../../../../assets/svg/ic-suggestions.svg';
 import { EditIconButton } from '../../../../common/IconButtons/EditIconButton';
@@ -88,7 +89,7 @@ function ConfigurationSql({ value }: Readonly<{ value: string }>) {
  * which cannot shrink below max-content, so the row overflowed and the card's
  * `overflow-hidden` clipped it — and it made a non-interactive value focusable.
  */
-function ConfigurationValue({ value }: Readonly<{ value: string }>) {
+function ConfigurationValue({ value }: Readonly<{ value: ReactNode }>) {
   return (
     <span className="tw:min-w-0 tw:break-words tw:text-right tw:font-mono tw:text-xs tw:font-semibold tw:text-primary">
       {value}
@@ -118,11 +119,7 @@ function ParameterRows({
             className="tw:shrink-0 tw:text-xs tw:text-tertiary">
             {row.label}
           </Typography>
-          {typeof row.value === 'string' ? (
-            <ConfigurationValue value={row.value} />
-          ) : (
-            row.value
-          )}
+          <ConfigurationValue value={row.value} />
         </Box>
       ))}
     </div>
@@ -240,13 +237,13 @@ const TestCaseConfigurationCard = ({
         </div>
 
         <div className="tw:flex tw:flex-col tw:gap-2.5">
+          {hasParameterRows && <ParameterRows rows={parameterRows} />}
+          {isDynamicAssertion && <DynamicAssertionCallout />}
           {hasVersionDiff && (
             <div data-testid="configuration-version-diff">
               {versionParameterDiff}
             </div>
           )}
-          {hasParameterRows && <ParameterRows rows={parameterRows} />}
-          {isDynamicAssertion && <DynamicAssertionCallout />}
           {hasSql &&
             withSqlParams.map((param) => (
               <ConfigurationSql key={param.name} value={param.value ?? ''} />
```

---

### Incident Patch 8: `fe732806` (2026-10-05)
**Commit Message**: Fixes #34675: Serve settings updates on the next read and deflake three merge-queue ITs (#34676)

* test(it): replay the deadlock loser only after the winner commits

Postgres wakes the winner of a deadlock but does not grant it the row the
loser released. When the loser's replay reached that row first it locked
it again and deadlocked the winner a second time, so the loser ran three
times instead of two. The replay now waits for the winner's commit.

Part of #34675.

* test(it): give each AppOperationPermissionsIT request its own connection

The class shared one JDK HttpClient across its concurrent tests. A POST
that went out on a pooled connection the server had already closed failed
with "HTTP/1.1 header parser received no bytes", because the JDK client
retries that case only for GET and HEAD.

Part of #34675.

* test(it): record a thread dump and the lock picture when the server stalls

The parallel lane has wedged with async deletes that never finish:
statements that need the rows they hold time out on MySQL and hang on
Postgres, and the server log names only the waiters. When queued async
database work stops completing, or a transaction stays open, for three
minutes, the watc

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/bootstrap/ServerStallWatchdog.java` (added, +340/-0)
```diff
@@ -0,0 +1,340 @@
+/*
+ *  Copyright 2026 Collate
+ *  Licensed under the Apache License, Version 2.0 (the "License");
+ *  you may not use this file except in compliance with the License.
+ *  You may obtain a copy of the License at
+ *  http://www.apache.org/licenses/LICENSE-2.0
+ *  Unless required by applicable law or agreed to in writing, software
+ *  distributed under the License is distributed on an "AS IS" BASIS,
+ *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ *  See the License for the specific language governing permissions and
+ *  limitations under the License.
+ */
+package org.openmetadata.it.bootstrap;
+
+import com.sun.management.HotSpotDiagnosticMXBean;
+import io.micrometer.core.instrument.Measurement;
+import io.micrometer.core.instrument.Meter;
+import io.micrometer.core.instrument.Metrics;
+import java.io.IOException;
+import java.lang.management.ManagementFactory;
+import java.nio.file.Files;
+import java.nio.file.Path;
+import java.sql.Connection;
+import java.sql.DriverManager;
+import java.sql.ResultSet;
+import java.sql.ResultSetMetaData;
+import java.sql.SQLException;
+import java.sql.Statement;
+import java.time.Clock;
+import java.time.Duration;
+import java.time.Instant;
+import java.util.List;
+import java.util.Optional;
+import java.util.concurrent.Executors;
+import java.util.concurrent.ScheduledExecutorService;
+import java.util.concurrent.TimeUnit;
+import java.util.function.Supplier;
+import java.util.stream.Collectors;
+import java.util.stream.Stream;
+import java.util.stream.StreamSupport;
+import org.slf4j.Logger;
+import org.slf4j.LoggerFactory;
+
+/**
+ * Records what the embedded server was doing when it stopped making progress.
+ *
+ * <p>The parallel lane has wedged with asynchronous deletes that never finished: their database
+ * permits stayed taken, new work queued behind them, and statements that needed the rows they held
+ * waited until MySQL gave up after 50 seconds, or forever on Postgres. The server log names only
+ * the waiters. When queued asynchronous database work stops completing, or a database transaction
+ * stays open, for longer than the threshold, this writes the open transactions and lock waits as
+ * the database sees them, and a dump of every JVM thread including virtual threads, into the CI
+ * diagnostics directory that the workflow uploads.
+ */
+final class ServerStallWatchdog implements AutoCloseable {
+  private static final Logger LOG = LoggerFactory.getLogger(ServerStallWatchdog.class);
+  static final int MAX_REPORTS = 3;
+  private static final Duration CHECK_INTERVAL = Duration.ofSeconds(30);
+  private static final String SUBMITTED_TASKS = "async.operations.db.submitted";
+  private static final String ACTIVE_TASKS = "async.operations.db.active";
+  private static final String QUEUED_TASKS = "async.operations.db.queued";
+  private static final String OPERATION_TAG = "operation";
+
+  private final DatabaseProbe database;
+  private final Supplier<AsyncBacklog> backlogSampler;
+  private final Path reportDirectory;
+  private final Duration threshold;
+  private final Clock clock;
+  private final ScheduledExecutorService scheduler =
+      Executors.newSingleThreadScheduledExecutor(
+          Thread.ofPlatform().name("server-stall-watchdog").daemon().factory());
+  private long completedAtLastProgress;
+  private Instant lastProgress;
+  private Instant lastReport = Instant.EPOCH;
+  private int reports;
+
+  ServerStallWatchdog(
+      final DatabaseProbe database,
+      final Supplier<AsyncBacklog> backlogSampler,
+      final Path reportDirectory,
+      final Duration threshold,
+      final Clock clock) {
+    this.database = database;
+    this.backlogSampler = backlogSampler;
+    this.reportDirectory = reportDirectory;
+    this.threshold = threshold;
+    this.clock = clock;
+    this.completedAtLastProgress = backlogSampler.get().completed();
+    this.lastProgress = clock.instant();
+  }
+
+  static ServerStallWatchdog forEmbeddedServer(
+      final DatabaseProbe database, final Path reportDirectory, final Duration threshold) {
+    return new ServerStallWatchdog(
+        database, AsyncBacklog::fromServerMetrics, reportDirectory, threshold, Clock.systemUTC());
+  }
+
+  void start() {
+    final long seconds = CHECK_INTERVAL.toSeconds();
+    scheduler.scheduleWithFixedDelay(this::checkSafely, seconds, seconds, TimeUnit.SECONDS);
+  }
+
+  @Override
+  public void close() {
+    scheduler.shutdownNow();
+  }
+
+  /** A check that throws would cancel every later run of the schedule, so none may escape. */
+  private void checkSafely() {
+    try {
+      check();
+    } catch (SQLException | IOException | RuntimeException e) {
+      LOG.warn("Server stall watchdog check failed", e);
+    }
+  }
+
+  void check() throws SQLException, IOException {
+    final AsyncBacklog backlog = backlogSampler.get();
+    final Instant now = clock.instant();
+    recordProgress(backlog, now);
+  
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/bootstrap/ServerStallWatchdogTest.java` (added, +149/-0)
```diff
@@ -0,0 +1,149 @@
+package org.openmetadata.it.bootstrap;
+
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+
+import java.io.IOException;
+import java.nio.file.Files;
+import java.nio.file.Path;
+import java.sql.SQLException;
+import java.time.Clock;
+import java.time.Duration;
+import java.time.Instant;
+import java.time.ZoneId;
+import java.time.ZoneOffset;
+import java.util.List;
+import java.util.concurrent.atomic.AtomicLong;
+import java.util.stream.Stream;
+import org.junit.jupiter.api.Test;
+import org.junit.jupiter.api.io.TempDir;
+import org.openmetadata.it.bootstrap.ServerStallWatchdog.AsyncBacklog;
+import org.openmetadata.it.bootstrap.ServerStallWatchdog.DatabaseProbe;
+
+class ServerStallWatchdogTest {
+  private static final Duration THRESHOLD = Duration.ofMinutes(3);
+  private static final Duration CHECK_INTERVAL = Duration.ofSeconds(30);
+  private static final String DATABASE_STATE = "== innodb_trx\ntrx_id=42 | trx_state=RUNNING";
+
+  @TempDir Path reports;
+
+  private final MutableClock clock = new MutableClock();
+  private final AtomicLong completed = new AtomicLong();
+  private final AtomicLong queued = new AtomicLong();
+  private Duration oldestTransaction = Duration.ZERO;
+
+  @Test
+  void reportsOnceQueuedAsyncWorkHasNotCompletedForTheThreshold() throws Exception {
+    queued.set(26);
+    ServerStallWatchdog watchdog = watchdog();
+
+    checkEvery(CHECK_INTERVAL, THRESHOLD.minus(CHECK_INTERVAL), watchdog);
+    assertEquals(List.of(), reportFiles(), "a backlog younger than the threshold is not a stall");
+
+    checkEvery(CHECK_INTERVAL, CHECK_INTERVAL, watchdog);
+    assertEquals(List.of("server-stall-1-threads.json", "server-stall-1.txt"), reportFiles());
+    String summary = Files.readString(reports.resolve("server-stall-1.txt"));
+    assertTrue(summary.contains("no queued async database task completed for 180s"), summary);
+    assertTrue(summary.contains(DATABASE_STATE), summary);
+    assertTrue(
+        Files.readString(reports.resolve("server-stall-1-threads.json")).contains("threadDump"),
+        "the thread dump must be written");
+  }
+
+  @Test
+  void staysQuietWhileQueuedWorkKeepsCompleting() throws Exception {
+    queued.set(400);
+    ServerStallWatchdog watchdog = watchdog();
+
+    for (int check = 0; check < 20; check++) {
+      completed.addAndGet(5);
+      clock.advance(CHECK_INTERVAL);
+      watchdog.check();
+    }
+
+    assertEquals(List.of(), reportFiles());
+  }
+
+  @Test
+  void reportsATransactionOpenForTheThresholdWithNothingQueued() throws Exception {
+    oldestTransaction = THRESHOLD;
+    ServerStallWatchdog watchdog = watchdog();
+
+    clock.advance(CHECK_INTERVAL);
+    watchdog.check();
+
+    String summary = Files.readString(reports.resolve("server-stall-1.txt"));
+    assertTrue(summary.contains("a database transaction has been open for 180s"), summary);
+  }
+
+  @Test
+  void writesAtMostThreeReportsOneThresholdApart() throws Exception {
+    queued.set(26);
+    ServerStallWatchdog watchdog = watchdog();
+
+    checkEvery(CHECK_INTERVAL, Duration.ofMinutes(30), watchdog);
+
+    assertEquals(2 * ServerStallWatchdog.MAX_REPORTS, reportFiles().size());
+    assertTrue(Files.exists(reports.resolve("server-stall-3.txt")));
+  }
+
+  private ServerStallWatchdog watchdog() {
+    return new ServerStallWatchdog(
+        new StubDatabase(),
+        () -> new AsyncBacklog(completed.get() + queued.get(), 0, queued.get(), "stub"),
+        reports,
+        THRESHOLD,
+        clock);
+  }
+
+  private void checkEvery(Duration interval, Duration total, ServerStallWatchdog watchdog)
+      throws SQLException, IOException {
+    for (Duration elapsed = Duration.ZERO;
+        elapsed.compareTo(total) < 0;
+        elapsed = elapsed.plus(interval)) {
+      clock.advance(interval);
+      watchdog.check();
+    }
+  }
+
+  private List<String> reportFiles() throws IOException {
+    try (Stream<Path> files = Files.list(reports)) {
+      return files.map(file -> file.getFileName().toString()).sorted().toList();
+    }
+  }
+
+  private final class StubDatabase implements DatabaseProbe {
+    @Override
+    public Duration oldestOpenTransaction() {
+      return oldestTransaction;
+    }
+
+    @Override
+    public String describe() {
+      return DATABASE_STATE;
+    }
+  }
+
+  private static final class MutableClock extends Clock {
+    private Instant now = Instant.parse("2026-10-05T06:43:28Z");
+
+    void advance(Duration duration) {
+      now = now.plus(duration);
+    }
+
+    @Override
+    public ZoneId getZone() {
+      return ZoneOffset.UTC;
+    }
+
+    @Override
+    public Clock withZone(ZoneId zone) {
+      return this;
+    }
+
+    @Override
+    public Instant instant() {
+      return now;
+    }
+  }
+}
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/bootstrap/TestSuiteBootstrap.java` (modified, +25/-0)
```diff
@@ -163,6 +163,7 @@ public class TestSuiteBootstrap implements LauncherSessionListener {
   private static DropwizardAppExtension<OpenMetadataApplicationConfig> APP;
   private static final List<DropwizardAppExtension<OpenMetadataApplicationConfig>> ADDITIONAL_APPS =
       java.util.Collections.synchronizedList(new ArrayList<>());
+  private static ServerStallWatchdog STALL_WATCHDOG;
   private static Jdbi jdbi;
 
   private static String searchHost;
@@ -243,6 +244,7 @@ public void launcherSessionOpened(LauncherSession session) {
 
       SharedEntities.initialize(SdkClients.adminClient());
       excludeGlossaryStatusFixturesFromApproval();
+      startStallWatchdog();
 
     } catch (Exception e) {
       LOG.error("Failed to start test infrastructure", e);
@@ -275,6 +277,26 @@ private static void excludeGlossaryStatusFixturesFromApproval() {
             patch);
   }
 
+  /** Leaves a wedged lane a thread dump and the database's lock picture to be diagnosed from. */
+  private static void startStallWatchdog() {
+    STALL_WATCHDOG =
+        ServerStallWatchdog.forEmbeddedServer(
+            stallProbe(),
+            Path.of(System.getProperty("integrationTests.diagnosticsDir", "target/ci-diagnostics")),
+            Duration.ofSeconds(Long.getLong("integrationTests.stallThresholdSeconds", 180)));
+    STALL_WATCHDOG.start();
+  }
+
+  private static ServerStallWatchdog.DatabaseProbe stallProbe() {
+    return "mysql".equalsIgnoreCase(databaseType)
+        ? ServerStallWatchdog.DatabaseProbe.mysql(
+            DATABASE_CONTAINER.getJdbcUrl(), DATABASE_CONTAINER.getPassword())
+        : ServerStallWatchdog.DatabaseProbe.postgres(
+            DATABASE_CONTAINER.getJdbcUrl(),
+            DATABASE_CONTAINER.getUsername(),
+            DATABASE_CONTAINER.getPassword());
+  }
+
   @Override
   public void launcherSessionClosed(LauncherSession session) {
     if (isEmbeddedBootstrapDisabled()) {
@@ -903,6 +925,9 @@ private static void configureRdf(OpenMetadataApplicationConfig config) {
   }
 
   private void cleanup() {
+    if (STALL_WATCHDOG != null) {
+      STALL_WATCHDOG.close();
+    }
     try {
       if (SharedEntities.isInitialized()) {
         SharedEntities.cleanup(SdkClients.adminClient());
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/AppOperationPermissionsIT.java` (modified, +22/-10)
```diff
@@ -2,6 +2,7 @@
 
 import static org.junit.jupiter.api.Assertions.assertEquals;
 
+import java.io.IOException;
 import java.net.URI;
 import java.net.http.HttpClient;
 import java.net.http.HttpRequest;
@@ -42,7 +43,6 @@
 @ExtendWith(TestNamespaceExtension.class)
 public class AppOperationPermissionsIT {
 
-  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
   private static final String APP_NAME = "SearchIndexingApplication";
 
   // dataConsumer JWT tests hit SubjectCache.getUserContext during authorization; if that user
@@ -63,7 +63,7 @@ void test_triggerApp_noAuth_returns401(TestNamespace ns) throws Exception {
             .POST(HttpRequest.BodyPublishers.ofString("{}"))
             .build();
 
-    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
+    HttpResponse<String> response = send(request);
 
     assertEquals(401, response.statusCode(), "Request without auth should return 401");
   }
@@ -86,7 +86,7 @@ void test_deployApp_noAuth_returns401(TestNamespace ns) throws Exception {
             .POST(HttpRequest.BodyPublishers.noBody())
             .build();
 
-    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
+    HttpResponse<String> response = send(request);
 
     assertEquals(401, response.statusCode(), "Request without auth should return 401");
   }
@@ -109,7 +109,7 @@ void test_stopApp_noAuth_returns401(TestNamespace ns) throws Exception {
             .POST(HttpRequest.BodyPublishers.noBody())
             .build();
 
-    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
+    HttpResponse<String> response = send(request);
 
     assertEquals(401, response.statusCode(), "Request without auth should return 401");
   }
@@ -132,7 +132,7 @@ void test_scheduleApp_noAuth_returns401(TestNamespace ns) throws Exception {
             .POST(HttpRequest.BodyPublishers.noBody())
             .build();
 
-    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
+    HttpResponse<String> response = send(request);
 
     assertEquals(401, response.statusCode(), "Request without auth should return 401");
   }
@@ -155,7 +155,7 @@ void test_configureApp_noAuth_returns401(TestNamespace ns) throws Exception {
             .POST(HttpRequest.BodyPublishers.noBody())
             .build();
 
-    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
+    HttpResponse<String> response = send(request);
 
     assertEquals(401, response.statusCode(), "Request without auth should return 401");
   }
@@ -242,7 +242,7 @@ void test_readEndpoints_noAuth_returns401(TestNamespace ns) throws Exception {
             .GET()
             .build();
 
-    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
+    HttpResponse<String> response = send(request);
 
     assertEquals(401, response.statusCode(), "Request without auth should return 401");
   }
@@ -287,7 +287,7 @@ private HttpResponse<String> patchWithToken(String path, String body, String tok
             .method("PATCH", HttpRequest.BodyPublishers.ofString(body))
             .build();
 
-    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
+    return send(request);
   }
 
   private HttpResponse<String> getWithToken(String path, String token) throws Exception {
@@ -298,7 +298,7 @@ private HttpResponse<String> getWithToken(String path, String token) throws Exce
             .GET()
             .build();
 
-    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
+    return send(request);
   }
 
   private static String getDataConsumerToken() {
@@ -323,6 +323,18 @@ private HttpResponse<String> postWithToken(String path, String body, String toke
       builder.POST(HttpRequest.BodyPublishers.noBody());
     }
 
-    return HTTP_CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
+    return send(builder.build());
+  }
+
+  /**
+   * Each request gets its own connection. A shared client hands the next test a pooled kept-alive
+   * connection, and when the server has already closed it the request fails before any response
+   * arrives; the JDK retries that only for GET and HEAD, so one of these POSTs fails outright.
+   */
+  private static HttpResponse<String> send(HttpRequest request)
+      throws IOException, InterruptedException {
+    try (HttpClient client = HttpClient.newHttpClient()) {
+      return client.send(request, HttpResponse.BodyHandlers.ofString());
+    }
   }
 }
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/UnitOfWorkRollbackIT.java` (modified, +25/-3)
```diff
@@ -23,6 +23,7 @@
 import java.util.Set;
 import java.util.UUID;
 import java.util.concurrent.BrokenBarrierException;
+import java.util.concurrent.CountDownLatch;
 import java.util.concurrent.CyclicBarrier;
 import java.util.concurrent.ExecutorService;
 import java.util.concurrent.Executors;
@@ -71,10 +72,13 @@ static void dropRows() {
   @Test
   void aUnitThatSwallowsItsDeadlockIsReplayedWholeInsteadOfCommittedInPart() throws Exception {
     CyclicBarrier bothHoldOneRow = new CyclicBarrier(2);
+    CountDownLatch winnerCommitted = new CountDownLatch(1);
     ExecutorService workers = Executors.newFixedThreadPool(2);
     try {
-      Future<Integer> left = workers.submit(() -> runUnit("left", "right", bothHoldOneRow));
-      Future<Integer> right = workers.submit(() -> runUnit("right", "left", bothHoldOneRow));
+      Future<Integer> left =
+          workers.submit(() -> runUnit("left", "right", bothHoldOneRow, winnerCommitted));
+      Future<Integer> right =
+          workers.submit(() -> runUnit("right", "left", bothHoldOneRow, winnerCommitted));
       List<Integer> attempts = List.of(left.get(2, MINUTES), right.get(2, MINUTES));
 
       assertEquals(
@@ -103,12 +107,18 @@ void aLockWaitTimeoutLeavesTheRestOfTheUnitToCommit() throws SQLException {
     assertEquals(Set.of("timeout-before", "timeout-after"), markers("timeout-%"));
   }
 
-  private static int runUnit(String first, String second, CyclicBarrier barrier) {
+  private static int runUnit(
+      String first, String second, CyclicBarrier barrier, CountDownLatch winnerCommitted) {
     AtomicInteger attempts = new AtomicInteger();
     repository()
         .executeInTransaction(
             () -> {
               boolean firstAttempt = attempts.incrementAndGet() == 1;
+              if (!firstAttempt) {
+                // Postgres wakes the winner but does not grant it the row, so a replay that gets
+                // there first locks the row again and deadlocks the winner a second time.
+                await(winnerCommitted);
+              }
               jdbi()
                   .useHandle(
                       handle -> {
@@ -122,6 +132,7 @@ private static int runUnit(String first, String second, CyclicBarrier barrier) {
                       });
               return null;
             });
+    winnerCommitted.countDown();
     return attempts.get();
   }
 
@@ -181,6 +192,17 @@ private static void await(CyclicBarrier barrier) {
     }
   }
 
+  private static void await(CountDownLatch winnerCommitted) {
+    try {
+      if (!winnerCommitted.await(1, MINUTES)) {
+        throw new IllegalStateException("the winning unit must commit before the loser replays");
+      }
+    } catch (InterruptedException e) {
+      Thread.currentThread().interrupt();
+      throw new IllegalStateException("interrupted while the winning unit committed", e);
+    }
+  }
+
   private static Set<String> markers(String pattern) {
     return jdbi()
         .withHandle(
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/resources/settings/SettingsCache.java` (modified, +50/-8)
```diff
@@ -41,7 +41,9 @@
 import java.util.HashMap;
 import java.util.List;
 import java.util.Map;
+import java.util.concurrent.ExecutionException;
 import java.util.concurrent.TimeUnit;
+import java.util.concurrent.atomic.AtomicLong;
 import javax.annotation.CheckForNull;
 import lombok.NonNull;
 import lombok.extern.slf4j.Slf4j;
@@ -88,12 +90,30 @@
 @Slf4j
 public class SettingsCache {
   private static volatile boolean initialized = false;
-  protected static final LoadingCache<String, Settings> CACHE =
+
+  /**
+   * Counts invalidations. Guava ignores invalidate() for a key whose load is still running, so a
+   * load that read a setting just before an update committed would cache the old value until it
+   * expires. Each cached value records the count its load started from, and a read reloads a value
+   * loaded before the latest invalidation.
+   */
+  private static final AtomicLong INVALIDATIONS = new AtomicLong();
+
+  private static final int MAX_STALE_RELOADS = 3;
+
+  protected static final LoadingCache<String, LoadedSettings> CACHE =
       CacheBuilder.newBuilder()
           .maximumSize(1000)
           .expireAfterWrite(3, TimeUnit.MINUTES)
           .build(new SettingsLoader());
 
+  /** A cached setting and the invalidation count its load started from. */
+  record LoadedSettings(Settings settings, long invalidationsAtLoad) {
+    boolean predatesTheLatestInvalidation() {
+      return invalidationsAtLoad < INVALIDATIONS.get();
+    }
+  }
+
   private SettingsCache() {
     // Private constructor for singleton
   }
@@ -588,7 +608,7 @@ private static GlossaryTermRelationType createRelationType(
 
   public static <T> T getSetting(SettingsType settingName, Class<T> clazz) {
     try {
-      Object configValue = CACHE.get(settingName.toString()).getConfigValue();
+      Object configValue = currentSettings(settingName.toString()).getConfigValue();
       return JsonUtils.convertValue(configValue, clazz);
     } catch (Exception ex) {
       LOG.error("Failed to fetch Settings . Setting {}", settingName, ex);
@@ -600,7 +620,7 @@ public static <T> T getSettingOrDefault(
       SettingsType settingName, T defaultValue, Class<T> clazz) {
     T result = defaultValue;
     try {
-      Object configValue = CACHE.get(settingName.toString()).getConfigValue();
+      Object configValue = currentSettings(settingName.toString()).getConfigValue();
       result = JsonUtils.convertValue(configValue, clazz);
     } catch (CacheLoader.InvalidCacheLoadException ex) {
       // The loader returns null for a setting that was never configured. Serving the caller's
@@ -612,13 +632,26 @@ public static <T> T getSettingOrDefault(
     return result;
   }
 
+  private static Settings currentSettings(String settingsName) throws ExecutionException {
+    LoadedSettings loaded = CACHE.get(settingsName);
+    for (int reload = 0;
+        reload < MAX_STALE_RELOADS && loaded.predatesTheLatestInvalidation();
+        reload++) {
+      CACHE.invalidate(settingsName);
+      loaded = CACHE.get(settingsName);
+    }
+    return loaded.settings();
+  }
+
   public static void cleanUp() {
+    INVALIDATIONS.incrementAndGet();
     CACHE.invalidateAll();
     initialized = false;
   }
 
   public static void invalidateSettings(String settingsName) {
     try {
+      INVALIDATIONS.incrementAndGet();
       CACHE.invalidate(settingsName);
       // If search settings are being invalidated, also invalidate the values derived from them
       if (SEARCH_SETTINGS.toString().equals(settingsName)) {
@@ -643,7 +676,7 @@ private static SmtpSettings getDefaultSmtpSettings() {
   @SuppressWarnings("unchecked")
   public static Map<String, Float> getAggregatedSearchFields() {
     try {
-      Settings aggregatedFields = CACHE.get(SEARCH_SETTINGS_AGGREGATED_FIELDS);
+      Settings aggregatedFields = currentSettings(SEARCH_SETTINGS_AGGREGATED_FIELDS);
       return (Map<String, Float>) aggregatedFields.getConfigValue();
     } catch (Exception ex) {
       LOG.error("Failed to fetch aggregated search fields", ex);
@@ -693,8 +726,8 @@ private static Settings computeAggregatedSearchFields() {
    */
   public static boolean isColumnIndexingEnabled() {
     try {
-      return (Boolean) CACHE.getUnchecked(SEARCH_SETTINGS_COLUMN_INDEXING).getConfigValue();
-    } catch (UncheckedExecutionException ex) {
+      return (Boolean) currentSettings(SEARCH_SETTINGS_COLUMN_INDEXING).getConfigValue();
+    } catch (ExecutionException | UncheckedExecutionException ex) {
       LOG.warn("Failed to read the column indexing flag, treating it as enabled", ex);
       return true;
     }
@@ -723,9 +756,18 @@ private static Settings computeColumnIndexingEnabled() {
   // Special key for caching the column indexing flag
   public static final String SEARCH_SETTINGS_COLUMN_INDEXING = "SEARCH_SETTINGS_COLUMN_INDEXING";
 
-  static class SettingsLoader extends CacheLoader<String, Settings> {
+  static class SettingsLoader extends CacheLoader<String, LoadedSet
```

**File**: `openmetadata-service/src/test/java/org/openmetadata/service/resources/settings/SettingsCacheDefaultCaseTest.java` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ void testDefaultCaseWithNonNullResult() throws Exception {
 
       SettingsCache.CACHE.invalidate(key);
 
-      Settings result = SettingsCache.CACHE.get(key);
+      Settings result = SettingsCache.CACHE.get(key).settings();
 
       assertNotNull(result);
     }
```

**File**: `openmetadata-service/src/test/java/org/openmetadata/service/resources/settings/SettingsCacheInvalidationTest.java` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+package org.openmetadata.service.resources.settings;
+
+import static org.junit.jupiter.api.Assertions.assertFalse;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+import static org.mockito.Mockito.mock;
+import static org.mockito.Mockito.mockStatic;
+import static org.mockito.Mockito.times;
+import static org.mockito.Mockito.verify;
+import static org.mockito.Mockito.when;
+
+import java.util.List;
+import java.util.concurrent.atomic.AtomicBoolean;
+import java.util.concurrent.atomic.AtomicReference;
+import org.junit.jupiter.api.AfterEach;
+import org.junit.jupiter.api.BeforeEach;
+import org.junit.jupiter.api.Test;
+import org.mockito.MockedStatic;
+import org.openmetadata.schema.configuration.EntityRulesSettings;
+import org.openmetadata.schema.settings.Settings;
+import org.openmetadata.schema.settings.SettingsType;
+import org.openmetadata.schema.type.SemanticsRule;
+import org.openmetadata.service.Entity;
+import org.openmetadata.service.jdbi3.SystemRepository;
+
+class SettingsCacheInvalidationTest {
+  private static final String RULES_KEY = SettingsType.ENTITY_RULES_SETTINGS.toString();
+  private static final String MULTI_DOMAIN_RULE = "Multiple Domains are not allowed";
+
+  private final AtomicReference<Settings> storedRules = new AtomicReference<>(rules(true));
+  private final AtomicBoolean updateCommitted = new AtomicBoolean();
+  private SystemRepository systemRepository;
+  private MockedStatic<Entity> entity;
+
+  @BeforeEach
+  void serveTheRulesFromAMockedRepository() {
+    systemRepository = mock(SystemRepository.class);
+    entity = mockStatic(Entity.class);
+    entity.when(Entity::getSystemRepository).thenReturn(systemRepository);
+    SettingsCache.invalidateSettings(RULES_KEY);
+  }
+
+  @AfterEach
+  void forgetTheCachedRules() {
+    SettingsCache.invalidateSettings(RULES_KEY);
+    entity.close();
+  }
+
+  @Test
+  void anUpdateCommittedWhileTheRulesAreLoadingIsServedByTheNextRead() {
+    when(systemRepository.getConfigWithKey(RULES_KEY))
+        .thenAnswer(invocation -> readWhileTheUpdateCommits());
+
+    // This read loads the rules while the update commits, so it may return either version.
+    SettingsCache.getSetting(SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class);
+
+    assertFalse(isMultiDomainRuleEnabled(), "a read after the update must see it");
+  }
+
+  @Test
+  void aSettingReadWithADefaultAlsoSeesTheCommittedUpdate() {
+    when(systemRepository.getConfigWithKey(RULES_KEY))
+        .thenAnswer(invocation -> readWhileTheUpdateCommits());
+
+    SettingsCache.getSetting(SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class);
+    EntityRulesSettings rules =
+        SettingsCache.getSettingOrDefault(
+            SettingsType.ENTITY_RULES_SETTINGS,
+            new EntityRulesSettings(),
+            EntityRulesSettings.class);
+
+    assertFalse(isMultiDomainRuleEnabled(rules), "a read after the update must see it");
+  }
+
+  @Test
+  void rulesLoadedAfterTheLastUpdateAreServedFromTheCache() {
+    when(systemRepository.getConfigWithKey(RULES_KEY)).thenReturn(rules(true));
+
+    assertTrue(isMultiDomainRuleEnabled());
+    assertTrue(isMultiDomainRuleEnabled());
+
+    verify(systemRepository, times(1)).getConfigWithKey(RULES_KEY);
+  }
+
+  /** Reads the stored rules, then commits the update and invalidates before the load returns. */
+  private Settings readWhileTheUpdateCommits() {
+    Settings read = storedRules.get();
+    if (updateCommitted.compareAndSet(false, true)) {
+      storedRules.set(rules(false));
+      SettingsCache.invalidateSettings(RULES_KEY);
+    }
+    return read;
+  }
+
+  private static boolean isMultiDomainRuleEnabled() {
+    return isMultiDomainRuleEnabled(
+        SettingsCache.getSetting(SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class));
+  }
+
+  private static boolean isMultiDomainRuleEnabled(EntityRulesSettings rules) {
+    return rules.getEntitySemantics().stream()
+        .filter(rule -> MULTI_DOMAIN_RULE.equals(rule.getName()))
+        .anyMatch(SemanticsRule::getEnabled);
+  }
+
+  private static Settings rules(boolean multiDomainRuleEnabled) {
+    SemanticsRule multiDomainRule =
+        new SemanticsRule()
+            .withName(MULTI_DOMAIN_RULE)
+            .withDescription("An entity belongs to at most one domain")
+            .withRule("{\"<=\":[{\"length\":{\"var\":\"domains\"}},1]}")
+            .withEnabled(multiDomainRuleEnabled);
+    return new Settings()
+        .withConfigType(SettingsType.ENTITY_RULES_SETTINGS)
+        .withConfigValue(new EntityRulesSettings().withEntitySemantics(List.of(multiDomainRule)));
+  }
+}
```

---

### Incident Patch 9: `7609c8ce` (2026-10-05)
**Commit Message**: Fixes #34207: Keep table DQ indicator visible while an incident is open (#34555)

* feat(ui): keep table DQ indicator visible while an incident is open

The table header DQ icon only reflected the latest test run, so it
disappeared as soon as a failing test passed even if its incident was
still unresolved. It now has three states: red for a currently failing
test, amber for an unresolved incident on a passing test, and amber with
an upstream badge for an upstream failure. The tooltip names the reason
and summarises multiple conditions; the icon links to the matching tab.

* fix(ui): fetch only open incidents for the table DQ indicator

Without a status filter, latest=true returned Resolved incidents too, and
they could fill the 100-row page and push out an open one, hiding the
amber state. Filter to New/Ack/Assigned on the server instead.

* fix(ui): keep DQ indicator colour on hover and focus

antd's global a:hover / a:focus colour overrode the link's text colour,
turning the red/amber icon primary blue. Put the colour on the svg.

* feat(ui): match DQ indicator card to the design prototype

Replace the dark tooltip with a core HoverCard that follows the prototype:
featured-icon h

**File**: `openmetadata-ui-core-components/src/main/resources/ui/icons-custom/data-quality-alarm-upstream.svg` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
+<path d="M3.38672 14.6252V10.8383C3.38672 8.04965 5.64732 5.78906 8.43592 5.78906C10.3569 5.78906 12.0273 6.86178 12.8808 8.44086" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
+<path d="M2.125 14.6211H7.66914" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
+<path d="M8.4375 2V3.89345" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
+<path d="M14.1147 4.52734L13.168 5.47407" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
+<path d="M2.75781 4.52734L3.70454 5.47407" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
+<path d="M8.4375 8.3125V10.8371M8.4375 12.6604H8.44381" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
+<path d="M14.1176 18.0009C16.1932 18.0009 17.8759 16.3182 17.8759 14.2426C17.8759 12.167 16.1932 10.4844 14.1176 10.4844C12.042 10.4844 10.3594 12.167 10.3594 14.2426C10.3594 16.3182 12.042 18.0009 14.1176 18.0009Z" fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
+<path d="M14.1163 12.7422V15.7488M12.8359 14.0225L14.1163 12.7422L15.3966 14.0225" stroke="white" stroke-linecap="round" stroke-linejoin="round"/>
+</svg>
```

**File**: `openmetadata-ui-core-components/src/main/resources/ui/icons/data-quality-alarm.svg` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
+<path d="M16 17.4995V12.9997C16 9.68614 13.3137 7 10 7C6.68629 7 4 9.68614 4 12.9997V17.4995" stroke="#D92D21" stroke-width="1.3"/>
+<path d="M2.5 17.5H17.5" stroke="#D92D21" stroke-width="1.3" stroke-linecap="round"/>
+<path d="M10 2.5V4.74989" stroke="#D92D21" stroke-width="1.3" stroke-linecap="round"/>
+<path d="M16.75 5.5L15.625 6.62495" stroke="#D92D21" stroke-width="1.3" stroke-linecap="round"/>
+<path d="M3.25 5.5L4.375 6.62495" stroke="#D92D21" stroke-width="1.3" stroke-linecap="round"/>
+<path d="M10 10V12.9999M10 15.1664H10.0075" stroke="#D92D21" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
+</svg>
```

**File**: `openmetadata-ui-core-components/src/main/resources/ui/src/icons/DataQualityAlarm.tsx` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+/*
+ *  Copyright 2025 Collate.
+ *  Licensed under the Apache License, Version 2.0 (the "License");
+ *  you may not use this file except in compliance with the License.
+ *  You may obtain a copy of the License at
+ *  http://www.apache.org/licenses/LICENSE-2.0
+ *  Unless required by applicable law or agreed to in writing, software
+ *  distributed under the License is distributed on an "AS IS" BASIS,
+ *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ *  See the License for the specific language governing permissions and
+ *  limitations under the License.
+ */
+import * as React from 'react';
+import type { SVGProps, FC } from 'react';
+interface Props extends SVGProps<SVGSVGElement> {
+  color?: string;
+  size?: number;
+}
+
+export const DataQualityAlarm: FC<Props> = ({
+  size = 24,
+  color = 'currentColor',
+  ...props
+}) => (
+  <svg
+    aria-hidden="true"
+    fill="none"
+    height={size}
+    stroke={color}
+    strokeLinecap="round"
+    strokeLinejoin="round"
+    viewBox="0 0 20 20"
+    width={size}
+    {...props}>
+    <path
+      d="M16 17.5V13a6 6 0 0 0-12 0v4.5m-1.5 0h15M10 2.5v2.25m6.75.75-1.125 1.125M3.25 5.5l1.125 1.125M10 10v3m0 2.166h.008"
+      stroke="currentColor"
+      strokeWidth={1.3}
+    />
+  </svg>
+);
+DataQualityAlarm.displayName = 'DataQualityAlarm';
```

**File**: `openmetadata-ui-core-components/src/main/resources/ui/src/icons/DataQualityAlarmUpstream.tsx` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+/*
+ *  Copyright 2025 Collate.
+ *  Licensed under the Apache License, Version 2.0 (the "License");
+ *  you may not use this file except in compliance with the License.
+ *  You may obtain a copy of the License at
+ *  http://www.apache.org/licenses/LICENSE-2.0
+ *  Unless required by applicable law or agreed to in writing, software
+ *  distributed under the License is distributed on an "AS IS" BASIS,
+ *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ *  See the License for the specific language governing permissions and
+ *  limitations under the License.
+ */
+import * as React from 'react';
+import type { SVGProps, FC } from 'react';
+interface Props extends SVGProps<SVGSVGElement> {
+  color?: string;
+  size?: number;
+}
+
+export const DataQualityAlarmUpstream: FC<Props> = ({
+  size = 24,
+  color: _color = 'currentColor',
+  ...props
+}) => (
+  <svg
+    aria-hidden="true"
+    fill="none"
+    height={size}
+    viewBox="0 0 20 20"
+    width={size}
+    {...props}>
+    <path
+      d="M3.387 14.625v-3.787a5.05 5.05 0 0 1 9.494-2.397m-10.756 6.18h5.544M8.438 2v1.893m5.677.634-.947.947m-10.41-.947.947.947"
+      stroke="currentColor"
+      strokeLinecap="round"
+      strokeWidth={1.3}
+    />
+    <path
+      d="M8.438 8.313v2.524m0 1.823h.006"
+      stroke="currentColor"
+      strokeLinecap="round"
+      strokeLinejoin="round"
+      strokeWidth={1.3}
+    />
+    <path
+      d="M14.118 18a3.758 3.758 0 1 0 0-7.516 3.758 3.758 0 0 0 0 7.517"
+      fill="currentColor"
+      stroke="currentColor"
+      strokeLinecap="round"
+      strokeLinejoin="round"
+      strokeWidth={1.3}
+    />
+    <path
+      d="M14.116 12.742v3.007m-1.28-1.726 1.28-1.28 1.28 1.28"
+      stroke="#fff"
+      strokeLinecap="round"
+      strokeLinejoin="round"
+    />
+  </svg>
+);
+DataQualityAlarmUpstream.displayName = 'DataQualityAlarmUpstream';
```

**File**: `openmetadata-ui-core-components/src/main/resources/ui/src/icons/index.ts` (modified, +2/-0)
```diff
@@ -118,6 +118,7 @@ export { DataContract } from './DataContract';
 export { DataContracts } from './DataContracts';
 export { DataHealthScore } from './DataHealthScore';
 export { DataObservability } from './DataObservability';
+export { DataQualityAlarm } from './DataQualityAlarm';
 export { DataQuality } from './DataQuality';
 export { Data } from './Data';
 export { Database01 } from './Database01';
@@ -401,6 +402,7 @@ export { ZoomIn } from './ZoomIn';
 export { ZoomOut } from './ZoomOut';
 export { AppLayout } from './AppLayout';
 export { Bronze } from './Bronze';
+export { DataQualityAlarmUpstream } from './DataQualityAlarmUpstream';
 export { Gold } from './Gold';
 export { None } from './None';
 export { Silver } from './Silver';
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/DataQuality/DataQualityIndicator/DataQualityIndicator.test.tsx` (added, +173/-0)
```diff
@@ -0,0 +1,173 @@
+/*
+ *  Copyright 2026 Collate.
+ *  Licensed under the Apache License, Version 2.0 (the "License");
+ *  you may not use this file except in compliance with the License.
+ *  You may obtain a copy of the License at
+ *  http://www.apache.org/licenses/LICENSE-2.0
+ *  Unless required by applicable law or agreed to in writing, software
+ *  distributed under the License is distributed on an "AS IS" BASIS,
+ *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ *  See the License for the specific language governing permissions and
+ *  limitations under the License.
+ */
+import { act, fireEvent, render, screen } from '@testing-library/react';
+import { MemoryRouter } from 'react-router-dom';
+import {
+  TestCaseResolutionStatus,
+  TestCaseResolutionStatusTypes,
+} from '../../../generated/tests/testCaseResolutionStatus';
+import { DataQualityIndicator } from './DataQualityIndicator';
+import { DataQualityIndicatorCounts } from './DataQualityIndicator.types';
+import {
+  countUnresolvedIncidents,
+  EMPTY_DQ_INDICATOR_COUNTS,
+} from './DataQualityIndicator.utils';
+
+const TABLE_FQN = 'svc.db.schema.orders';
+
+const renderIndicator = (counts: Partial<DataQualityIndicatorCounts>) =>
+  render(
+    <MemoryRouter>
+      <DataQualityIndicator
+        counts={{ ...EMPTY_DQ_INDICATOR_COUNTS, ...counts }}
+        tableFqn={TABLE_FQN}
+      />
+    </MemoryRouter>
+  );
+
+const incident = (testCaseId: string, status: TestCaseResolutionStatusTypes) =>
+  ({
+    testCaseReference: { id: testCaseId, type: 'testCase' },
+    testCaseResolutionStatusType: status,
+  } as TestCaseResolutionStatus);
+
+describe('DataQualityIndicator', () => {
+  beforeEach(() => {
+    jest.useFakeTimers();
+    // Establish pointer modality so react-aria accepts hover events.
+    fireEvent.mouseMove(document);
+  });
+
+  afterEach(() => {
+    jest.useRealTimers();
+  });
+
+  const openCard = () => {
+    const trigger = screen.getByTestId('dq-indicator').parentElement;
+
+    fireEvent.mouseEnter(trigger as HTMLElement, { pointerType: 'mouse' });
+    act(() => {
+      jest.advanceTimersByTime(300);
+    });
+  };
+
+  it('renders nothing when there are no failures, incidents or upstream issues', () => {
+    renderIndicator({});
+
+    expect(screen.queryByTestId('dq-indicator')).not.toBeInTheDocument();
+  });
+
+  it('shows the red failing state and links to the data quality tab', () => {
+    renderIndicator({ failingTests: 2 });
+
+    const indicator = screen.getByTestId('dq-indicator');
+
+    expect(indicator).toHaveAttribute('data-level', 'failing');
+    expect(screen.getByTestId('dq-indicator-icon')).toHaveClass(
+      'tw:text-fg-error-primary'
+    );
+    expect(indicator.getAttribute('href')).toContain('profiler/data-quality');
+
+    openCard();
+
+    expect(
+      screen.getByText('label.data-quality-test-failing')
+    ).toBeInTheDocument();
+    expect(
+      screen.getByText('message.dq-failing-tests-description-plural')
+    ).toBeInTheDocument();
+    expect(screen.getByTestId('dq-indicator-action')).toHaveTextContent(
+      'label.view-failing-test-plural'
+    );
+  });
+
+  it('stays visible in amber while an incident is open even if tests pass', () => {
+    renderIndicator({ unresolvedIncidents: 1 });
+
+    const indicator = screen.getByTestId('dq-indicator');
+
+    expect(indicator).toHaveAttribute('data-level', 'incident');
+    expect(screen.getByTestId('dq-indicator-icon')).toHaveClass(
+      'tw:text-fg-warning-primary'
+    );
+    expect(
+      screen.queryByTestId('dq-indicator-upstream-icon')
+    ).not.toBeInTheDocument();
+
+    openCard();
+
+    expect(
+      screen.getByText('message.dq-incident-open-tests-passing')
+    ).toBeInTheDocument();
+
+    const action = screen.getByTestId('dq-indicator-action');
+
+    expect(action).toHaveTextContent('label.view-incident');
+    expect(action.getAttribute('href')).toContain('profiler/incidents');
+  });
+
+  it('shows amber with the upstream badge and links to lineage for upstream-only issues', () => {
+    renderIndicator({ upstreamIssues: 1 });
+
+    const indicator = screen.getByTestId('dq-indicator');
+
+    expect(indicator).toHaveAttribute('data-level', 'upstream');
+    expect(
+      screen.getByTestId('dq-indicator-upstream-icon')
+    ).toBeInTheDocument();
+    expect(indicator.getAttribute('href')).toContain('lineage');
+
+    openCard();
+
+    expect(screen.getByTestId('dq-indicator-action')).toHaveTextContent(
+      'label.view-upstream-issue'
+    );
+  });
+
+  it('summarises multiple conditions under the highest-priority level', () => {
+    renderIndicator({
+      failingTests: 1,
+      unresolvedIncidents: 2,
+      upstreamIssues: 1,
+    });
+
+    const indicator = screen.getByTestId('dq-indicator');
+
+    expect(indicator).toHaveAttribute('data-level', 'failing');
+    expect(indicator).toHaveAttribute(
+      'aria-label',
+      'label.data-quality-needs
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/DataQuality/DataQualityIndicator/DataQualityIndicator.tsx` (added, +265/-0)
```diff
@@ -0,0 +1,265 @@
+/*
+ *  Copyright 2026 Collate.
+ *  Licensed under the Apache License, Version 2.0 (the "License");
+ *  you may not use this file except in compliance with the License.
+ *  You may obtain a copy of the License at
+ *  http://www.apache.org/licenses/LICENSE-2.0
+ *  Unless required by applicable law or agreed to in writing, software
+ *  distributed under the License is distributed on an "AS IS" BASIS,
+ *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ *  See the License for the specific language governing permissions and
+ *  limitations under the License.
+ */
+import {
+  Divider,
+  FeaturedIcon,
+  HoverCard,
+  Typography,
+} from '@openmetadata/ui-core-components';
+import {
+  ArrowRight,
+  ArrowUp,
+  DataQualityAlarm,
+  DataQualityAlarmUpstream,
+  XCircle,
+} from '@openmetadata/ui-core-components/icons';
+import QueryString from 'qs';
+import { ReactNode } from 'react';
+import { useTranslation } from 'react-i18next';
+import { Link } from 'react-router-dom';
+import { EntityTabs, EntityType } from '../../../enums/entity.enum';
+import { LineageLayer } from '../../../generated/configuration/lineageSettings';
+import { Transi18next } from '../../../utils/i18next/LocalUtil';
+import { getEntityDetailsPath } from '../../../utils/RouterUtils';
+import { ProfilerTabPath } from '../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
+import {
+  DataQualityIndicatorCounts,
+  DataQualityIndicatorLevel,
+  DataQualityIndicatorProps,
+} from './DataQualityIndicator.types';
+import {
+  getDataQualityIndicatorLevel,
+  hasMultipleDataQualityConditions,
+} from './DataQualityIndicator.utils';
+
+const UpstreamBadge = ({ className }: { className: string }) => (
+  <span
+    aria-hidden
+    className={`tw:grid tw:place-items-center tw:rounded-full tw:bg-warning-solid tw:text-fg-white ${className}`}>
+    <ArrowUp className="tw:size-2.5" />
+  </span>
+);
+
+const pluralKey = (key: string, count: number) =>
+  count === 1 ? key : `${key}-plural`;
+
+const TONE_CLASSES = {
+  error: {
+    icon: 'tw:text-fg-error-primary',
+    trigger: 'tw:hover:bg-error-primary',
+  },
+  warning: {
+    icon: 'tw:text-fg-warning-primary',
+    trigger: 'tw:hover:bg-warning-primary',
+  },
+} as const;
+
+const ConditionList = ({ counts }: { counts: DataQualityIndicatorCounts }) => {
+  const rows = [
+    {
+      count: counts.failingTests,
+      icon: <XCircle className="tw:size-4 tw:text-fg-error-primary" />,
+      i18nKey: 'message.dq-failing-tests-count',
+    },
+    {
+      count: counts.unresolvedIncidents,
+      icon: (
+        <DataQualityAlarm className="tw:text-fg-warning-primary" size={16} />
+      ),
+      i18nKey: 'message.dq-unresolved-incidents-count',
+    },
+    {
+      count: counts.upstreamIssues,
+      icon: <UpstreamBadge className="tw:size-4" />,
+      i18nKey: 'message.dq-upstream-issues-count',
+    },
+  ].filter((row) => row.count > 0);
+
+  return (
+    <ul className="tw:flex tw:flex-col tw:gap-2">
+      {rows.map((row) => (
+        <li
+          className="tw:flex tw:items-center tw:gap-2.5 tw:text-sm tw:text-secondary"
+          key={row.i18nKey}>
+          <span className="tw:grid tw:size-5 tw:shrink-0 tw:place-items-center">
+            {row.icon}
+          </span>
+          <span>
+            <Transi18next
+              i18nKey={pluralKey(row.i18nKey, row.count)}
+              renderElement={
+                <strong className="tw:font-semibold tw:text-primary" />
+              }
+              values={{ count: row.count }}
+            />
+          </span>
+        </li>
+      ))}
+    </ul>
+  );
+};
+
+interface IndicatorContent {
+  isList: boolean;
+  title: string;
+  description: ReactNode;
+  actionLabel: string;
+  to: string | { pathname: string; search: string };
+}
+
+const useIndicatorContent = (
+  level: DataQualityIndicatorLevel,
+  counts: DataQualityIndicatorCounts,
+  tableFqn: string
+): IndicatorContent | null => {
+  const { t } = useTranslation();
+
+  if (level === 'none') {
+    return null;
+  }
+
+  const profilerPath = (subTab: ProfilerTabPath) =>
+    getEntityDetailsPath(
+      EntityType.TABLE,
+      tableFqn,
+      EntityTabs.PROFILER,
+      subTab
+    );
+
+  if (hasMultipleDataQualityConditions(counts)) {
+    return {
+      isList: true,
+      title: t('label.data-quality-needs-attention'),
+      description: <ConditionList counts={counts} />,
+      actionLabel: t('label.view-data-quality'),
+      to: profilerPath(ProfilerTabPath.DATA_QUALITY),
+    };
+  }
+
+  if (level === 'failing') {
+    return {
+      isList: false,
+      title: t('label.data-quality-test-failing'),
+      description: t(
+        pluralKey('message.dq-failing-tests-description', counts.failingTests),
+        { count: counts.failingTests }
+      ),
+      actionLabel: t(pluralKey('label.view-failing-test', counts.failingTests)),
+      to: profilerPath(ProfilerTabPath.DATA
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/DataQuality/DataQualityIndicator/DataQualityIndicator.types.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+/*
+ *  Copyright 2026 Collate.
+ *  Licensed under the Apache License, Version 2.0 (the "License");
+ *  you may not use this file except in compliance with the License.
+ *  You may obtain a copy of the License at
+ *  http://www.apache.org/licenses/LICENSE-2.0
+ *  Unless required by applicable law or agreed to in writing, software
+ *  distributed under the License is distributed on an "AS IS" BASIS,
+ *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ *  See the License for the specific language governing permissions and
+ *  limitations under the License.
+ */
+export interface DataQualityIndicatorCounts {
+  failingTests: number;
+  unresolvedIncidents: number;
+  upstreamIssues: number;
+}
+
+export type DataQualityIndicatorLevel =
+  | 'failing'
+  | 'incident'
+  | 'upstream'
+  | 'none';
+
+export interface DataQualityIndicatorProps {
+  counts: DataQualityIndicatorCounts;
+  tableFqn: string;
+}
```

---

### Incident Patch 10: `fd054753` (2026-10-05)
**Commit Message**: Fixes #34394: Add memory lifecycle and status filtering (#34647)

* feat(memory): enforce lifecycle and disputes

* feat(memory): inherit anchor domain on create

* fix(memory): gate anchored REST reads

Entity memories about restricted assets were visible through direct REST
reads. Check ViewBasic on the anchor for non-owners.

Search still relies on domain inheritance and search RBAC; asset policies
are not evaluated per result.

* fix(memory): gate MCP pill reads by anchor

The by-name Company Context lookup omitted primaryEntity, so an anchored
memory appeared unanchored to the visibility check. Fetch the decision
fields before projecting the pill.

Query search remains governed by search RBAC and inherited domains.

* fix(memory): guard history and retain list cursors

History endpoints exposed earlier versions without checking the current
memory's visibility. Check the current memory before serving either
history endpoint.

Keep paging cursors when hidden memories are filtered from a list page
so callers can reach later visible rows.

* feat(memory): index lifecycle and retain anchors

Map supersession and dispute fields in every search locale and request
the relationship fie

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/ContextMemoryAnchorIT.java` (added, +443/-0)
```diff
@@ -0,0 +1,443 @@
+package org.openmetadata.it.tests;
+
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertFalse;
+import static org.junit.jupiter.api.Assertions.assertNotNull;
+import static org.junit.jupiter.api.Assertions.assertThrows;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
+
+import java.time.Duration;
+import java.util.ArrayList;
+import java.util.List;
+import java.util.UUID;
+import org.awaitility.Awaitility;
+import org.junit.jupiter.api.Test;
+import org.junit.jupiter.api.extension.ExtendWith;
+import org.junit.jupiter.api.parallel.Execution;
+import org.junit.jupiter.api.parallel.ExecutionMode;
+import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
+import org.openmetadata.it.factories.ShortStackFactory;
+import org.openmetadata.it.util.SdkClients;
+import org.openmetadata.it.util.TestNamespace;
+import org.openmetadata.it.util.TestNamespaceExtension;
+import org.openmetadata.schema.api.context.CreateContextMemory;
+import org.openmetadata.schema.api.data.CreateContextFile;
+import org.openmetadata.schema.api.data.CreateTable;
+import org.openmetadata.schema.api.domains.CreateDomain;
+import org.openmetadata.schema.api.policies.CreatePolicy;
+import org.openmetadata.schema.api.teams.CreateRole;
+import org.openmetadata.schema.api.teams.CreateUser;
+import org.openmetadata.schema.entity.context.ContextMemory;
+import org.openmetadata.schema.entity.context.ContextMemorySourceType;
+import org.openmetadata.schema.entity.context.MemoryShareConfig;
+import org.openmetadata.schema.entity.context.MemoryVisibility;
+import org.openmetadata.schema.entity.data.ContextFile;
+import org.openmetadata.schema.entity.data.DatabaseSchema;
+import org.openmetadata.schema.entity.data.Table;
+import org.openmetadata.schema.entity.domains.Domain;
+import org.openmetadata.schema.entity.policies.Policy;
+import org.openmetadata.schema.entity.policies.accessControl.Rule;
+import org.openmetadata.schema.entity.teams.Role;
+import org.openmetadata.schema.entity.teams.User;
+import org.openmetadata.schema.type.Column;
+import org.openmetadata.schema.type.ColumnDataType;
+import org.openmetadata.schema.type.EntityReference;
+import org.openmetadata.schema.type.MetadataOperation;
+import org.openmetadata.schema.utils.JsonUtils;
+import org.openmetadata.sdk.client.OpenMetadataClient;
+import org.openmetadata.sdk.exceptions.ForbiddenException;
+import org.openmetadata.sdk.models.ListParams;
+import org.openmetadata.sdk.models.ListResponse;
+import org.openmetadata.sdk.services.context.ContextMemoryService;
+import org.openmetadata.service.Entity;
+
+/** A memory anchored to an asset takes the asset's governance: its domain on create, its readers on read. */
+@Execution(ExecutionMode.CONCURRENT)
+@ExtendWith(TestNamespaceExtension.class)
+public class ContextMemoryAnchorIT {
+
+  @Test
+  void anAnchoredMemoryWithoutDomains_takesTheAnchorsDomain(TestNamespace ns) {
+    Domain domain = createDomain(ns, "sales");
+    Table anchor = tableInDomain(ns, domain);
+
+    ContextMemory memory =
+        adminMemories()
+            .create(
+                entityMemory(ns, "in-domain").withPrimaryEntity(ref(Entity.TABLE, anchor.getId())));
+
+    assertEquals(List.of(domain.getId()), domainIds(memory));
+  }
+
+  @Test
+  void explicitDomains_winOverTheAnchors(TestNamespace ns) {
+    Table anchor = tableInDomain(ns, createDomain(ns, "sales"));
+    Domain own = createDomain(ns, "finance");
+
+    ContextMemory memory =
+        adminMemories()
+            .create(
+                entityMemory(ns, "own-domain")
+                    .withPrimaryEntity(ref(Entity.TABLE, anchor.getId()))
+                    .withDomains(List.of(own.getFullyQualifiedName())));
+
+    assertEquals(List.of(own.getId()), domainIds(memory));
+  }
+
+  @Test
+  void aMultiDomainAnchor_isNotCopied(TestNamespace ns) {
+    List<String> twoDomains =
+        List.of(
+            createDomain(ns, "first").getFullyQualifiedName(),
+            createDomain(ns, "second").getFullyQualifiedName());
+    User anchor = createUser(ns, null, twoDomains);
+
+    ContextMemory memory =
+        adminMemories()
+            .create(
+                entityMemory(ns, "multi-domain")
+                    .withPrimaryEntity(ref(Entity.USER, anchor.getId())));
+
+    assertTrue(
+        domainIds(memory).isEmpty(),
+        "two domains would break 'Multiple Domains are not allowed' on every later PATCH");
+  }
+
+  @Test
+  void getAndGetByName_hideAMemoryWhoseAnchorTheCallerCannotView(TestNamespace ns) {
+    Table anchor = ShortStackFactory.table(ns);
+    ContextMemory anchored =
+        adminMemories()
+            .create(
+                entityMemory(ns, "anchored").withPrimaryEntity(ref(Entity.TABLE, anchor.getId())));
+    ContextMemoryService reader = memoriesAs(createUser(ns, null, null));
+    Cont
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/ContextMemoryIT.java` (modified, +17/-0)
```diff
@@ -31,6 +31,7 @@
 import org.openmetadata.schema.type.EntityReference;
 import org.openmetadata.schema.type.EntityStatus;
 import org.openmetadata.sdk.client.OpenMetadataClient;
+import org.openmetadata.sdk.exceptions.ForbiddenException;
 import org.openmetadata.sdk.exceptions.InvalidRequestException;
 import org.openmetadata.sdk.fluent.Users;
 import org.openmetadata.sdk.models.ListParams;
@@ -487,6 +488,22 @@ void get_publicContextMemoryWithoutAssetByAnotherUser_200_OK(TestNamespace ns) {
     assertEquals(memory.getId(), otherUserService.get(memory.getId().toString()).getId());
   }
 
+  @Test
+  void versions_ofAnotherUsersPrivateMemory_areForbidden(TestNamespace ns) {
+    ContextMemory memory =
+        createEntity(
+            memoryWithVisibility(ns, "private-history", MemoryVisibility.PRIVATE)
+                .withOwners(List.of(testUser1Ref())));
+    ContextMemoryService owner = new ContextMemoryService(SdkClients.user1Client().getHttpClient());
+    ContextMemoryService other = new ContextMemoryService(SdkClients.user2Client().getHttpClient());
+    String id = memory.getId().toString();
+
+    assertFalse(owner.getVersionList(memory.getId()).getVersions().isEmpty());
+    assertEquals(memory.getId(), owner.getVersion(id, memory.getVersion()).getId());
+    assertThrows(ForbiddenException.class, () -> other.getVersionList(memory.getId()));
+    assertThrows(ForbiddenException.class, () -> other.getVersion(id, memory.getVersion()));
+  }
+
   /**
    * The ContextCenter serves its listing from search whenever it passes a query, filter, sort or
    * offset — which it always does. Restricted memories must therefore reach the search index and be
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/ContextMemoryLifecycleIT.java` (added, +452/-0)
```diff
@@ -0,0 +1,452 @@
+package org.openmetadata.it.tests;
+
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertFalse;
+import static org.junit.jupiter.api.Assertions.assertNull;
+import static org.junit.jupiter.api.Assertions.assertThrows;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
+
+import com.fasterxml.jackson.databind.JsonNode;
+import java.time.Duration;
+import java.util.List;
+import java.util.Set;
+import java.util.UUID;
+import java.util.stream.Collectors;
+import java.util.stream.Stream;
+import org.awaitility.Awaitility;
+import org.junit.jupiter.api.Test;
+import org.junit.jupiter.api.extension.ExtendWith;
+import org.junit.jupiter.api.parallel.Execution;
+import org.junit.jupiter.api.parallel.ExecutionMode;
+import org.openmetadata.it.bootstrap.SharedEntities;
+import org.openmetadata.it.util.SdkClients;
+import org.openmetadata.it.util.TestNamespace;
+import org.openmetadata.it.util.TestNamespaceExtension;
+import org.openmetadata.schema.api.context.CreateContextMemory;
+import org.openmetadata.schema.entity.context.ContextMemory;
+import org.openmetadata.schema.entity.context.ContextMemorySourceType;
+import org.openmetadata.schema.entity.context.ContextMemoryType;
+import org.openmetadata.schema.entity.context.MemoryShareConfig;
+import org.openmetadata.schema.entity.context.MemoryVisibility;
+import org.openmetadata.schema.type.ChangeDescription;
+import org.openmetadata.schema.type.EntityStatus;
+import org.openmetadata.schema.type.FieldChange;
+import org.openmetadata.schema.utils.JsonUtils;
+import org.openmetadata.sdk.exceptions.InvalidRequestException;
+import org.openmetadata.sdk.models.ListParams;
+import org.openmetadata.sdk.services.context.ContextMemoryService;
+import org.openmetadata.service.Entity;
+
+/**
+ * Lifecycle of a context memory over the REST API. A memory is patched at most once per principal
+ * unless a test is about in-session consolidation, so versions are never merged under a test.
+ */
+@Execution(ExecutionMode.CONCURRENT)
+@ExtendWith(TestNamespaceExtension.class)
+public class ContextMemoryLifecycleIT {
+
+  private static final String SUPERSEDE =
+      """
+      [{"op":"replace","path":"/entityStatus","value":"Deprecated"},
+       {"op":"add","path":"/supersededBy","value":{"id":"%s","type":"%s"}},
+       {"op":"add","path":"/statusReason","value":"%s"}]""";
+
+  private static final String ADD_DISPUTE =
+      """
+      [{"op":"add","path":"/disputes","value":[{"memory":{"id":"%s","type":"contextMemory"},\
+      "reason":"%s","detectedAt":1700000000000}]}]""";
+
+  @Test
+  void superseding_storesTheSuccessorAndTheOwnersRestoreClearsIt(TestNamespace ns) {
+    ContextMemory keeper = admin().create(memory(ns, "keeper"));
+    ContextMemory duplicate =
+        admin().create(memory(ns, "duplicate").withOwners(List.of(SharedEntities.get().USER1_REF)));
+
+    ContextMemory superseded =
+        admin().patch(idOf(duplicate), supersede(keeper, "Same fact as the keeper"));
+
+    assertEquals(EntityStatus.DEPRECATED, superseded.getEntityStatus());
+    assertEquals(keeper.getName(), superseded.getSupersededBy().getName(), "stored resolved");
+    assertEquals("Same fact as the keeper", superseded.getStatusReason());
+    assertTrue(
+        changedFields(superseded)
+            .containsAll(Set.of("entityStatus", "supersededBy", "statusReason")));
+
+    ContextMemory restored = user1().patch(idOf(duplicate), status(EntityStatus.APPROVED));
+
+    assertEquals(EntityStatus.APPROVED, restored.getEntityStatus());
+    assertNull(restored.getSupersededBy(), "leaving Deprecated clears supersededBy");
+    assertNull(restored.getStatusReason(), "a status change without a reason drops the stale one");
+    ContextMemory previous = admin().getVersion(idOf(duplicate), superseded.getVersion());
+    assertEquals(keeper.getId(), previous.getSupersededBy().getId(), "history keeps the successor");
+  }
+
+  @Test
+  void superseding_withoutASuccessor_isRejected(TestNamespace ns) {
+    ContextMemory memory = admin().create(memory(ns, "no-successor"));
+
+    InvalidRequestException error =
+        assertThrows(
+            InvalidRequestException.class,
+            () -> admin().patch(idOf(memory), status(EntityStatus.DEPRECATED)));
+
+    assertTrue(error.getMessage().contains("requires supersededBy"));
+  }
+
+  @Test
+  void aSuccessor_mustBeAnotherLiveContextMemory(TestNamespace ns) {
+    ContextMemory memory = admin().create(memory(ns, "bad-successor"));
+    ContextMemory deleted = admin().create(memory(ns, "deleted-keeper"));
+    admin().delete(idOf(deleted));
+    UUID userId = SharedEntities.get().USER1.getId();
+
+    assertThrows(
+        InvalidRequestException.class,
+        () -> admin().patch(idOf(memory), supersede(memory, "self")));
+    assertThrows(
+        InvalidRequestException.class,
+     
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/OntologyChangeSetIT.java` (modified, +100/-7)
```diff
@@ -49,6 +49,7 @@
 import org.openmetadata.schema.entity.data.Glossary;
 import org.openmetadata.schema.entity.data.GlossaryTerm;
 import org.openmetadata.schema.entity.data.OntologyChangeSet;
+import org.openmetadata.schema.type.EntityStatus;
 import org.openmetadata.schema.type.OntologyAttribute;
 import org.openmetadata.schema.type.OntologyAttributeDataType;
 import org.openmetadata.schema.type.OntologyChangeOperation;
@@ -59,6 +60,7 @@
 import org.openmetadata.schema.type.OntologyChangeSetState;
 import org.openmetadata.schema.type.OntologyEditLeaseToken;
 import org.openmetadata.schema.type.OntologyEditLock;
+import org.openmetadata.schema.utils.JsonUtils;
 import org.openmetadata.sdk.client.OpenMetadataClient;
 import org.openmetadata.sdk.exceptions.OpenMetadataException;
 import org.openmetadata.sdk.network.HttpMethod;
@@ -197,6 +199,64 @@ void appliedTermAppearsOnItsSourceMemory(TestNamespace ns) {
                 OntologyMemoryProposalStatus.class)
             .getProposals()
             .isEmpty());
+
+    memories.patch(
+        memory.getId().toString(),
+        JsonUtils.readTree(
+            "[{\"op\":\"replace\",\"path\":\"/entityStatus\",\"value\":\"Rejected\"}]"));
+    assertEquals(
+        Set.of(memory.getId()), client.glossaryTerms().get(termId.toString()).getSourceMemoryIds());
+    assertEquals(
+        List.of(termId),
+        memories.get(memory.getId().toString(), "derivedEntities").getDerivedEntities().stream()
+            .map(ref -> ref.getId())
+            .toList());
+  }
+
+  @Test
+  void cannotApplyAProposalAfterItsSourceMemoryIsRejected(TestNamespace ns) {
+    OpenMetadataClient client = SdkClients.adminClient();
+    ContextMemoryService memories = new ContextMemoryService(client.getHttpClient());
+    ContextMemory memory =
+        ns.trackRoot(
+            "contextMemory",
+            memories.create(
+                new CreateContextMemory()
+                    .withName(ns.prefix("retiredSource"))
+                    .withQuestion("What is the canonical orders table?")
+                    .withAnswer("sales.orders is canonical.")));
+    Glossary glossary = GlossaryTestFactory.createSimple(ns);
+    UUID termId = UUID.randomUUID();
+    OntologyChangeOperation operation =
+        new OntologyChangeOperation()
+            .withId(UUID.randomUUID())
+            .withOperationType(OntologyChangeOperationType.CREATE_TERM)
+            .withTerm(
+                new GlossaryTerm()
+                    .withId(termId)
+                    .withName(ns.prefix("ordersTable"))
+                    .withDescription("Canonical orders table")
+                    .withGlossary(glossary.getEntityReference())
+                    .withVersion(0.1))
+            .withSourceMemoryIds(Set.of(memory.getId()))
+            .withState(OntologyChangeOperationState.ACTIVE);
+    OntologyChangeSet changeSet = createChangeSet(client, glossary, operation, ns);
+    memories.patch(
+        memory.getId().toString(),
+        JsonUtils.readTree(
+            "[{\"op\":\"replace\",\"path\":\"/entityStatus\",\"value\":\"Rejected\"}]"));
+    OntologyEditLeaseToken lease = acquire(client, changeSet, ns.prefix("retiredSourceEditor"));
+
+    assertThrows(
+        OpenMetadataException.class,
+        () ->
+            client
+                .ontologyChangeSets()
+                .apply(changeSet.getId(), new ApplyOntologyChangeSet().withLease(lease)));
+    assertEquals(
+        OntologyChangeSetState.DRAFT,
+        client.ontologyChangeSets().get(changeSet.getId()).getState());
+    assertEquals(EntityStatus.REJECTED, memories.get(memory.getId().toString()).getEntityStatus());
   }
 
   @Test
@@ -340,24 +400,57 @@ void applyFailsInsteadOfOverwritingATermThatAlreadyExists(TestNamespace ns) {
   }
 
   @Test
-  void appliesADraftWhoseSourceMemoryWasDeleted(TestNamespace ns) {
+  void appliesAProposalThatAnotherApprovedSourceStillGrounds(TestNamespace ns) {
     OpenMetadataClient client = SdkClients.adminClient();
     ContextMemoryService memories = new ContextMemoryService(client.getHttpClient());
-    ContextMemory memory = memories.create(memoryRequest(ns.prefix("deletedSourceMemory")));
+    ContextMemory rejected =
+        ns.trackRoot(
+            "contextMemory", memories.create(memoryRequest(ns.prefix("rejectedCoSource"))));
+    ContextMemory approved =
+        ns.trackRoot(
+            "contextMemory", memories.create(memoryRequest(ns.prefix("approvedCoSource"))));
     Glossary glossary = GlossaryTestFactory.createSimple(ns);
     UUID termId = UUID.randomUUID();
-    OntologyChangeSet changeSet =
-        createChangeSet(client, glossary, termFromMemory(glossary, termId, memory, ns), ns);
-    memories.delete(memory.getId().toString(), Map.of("hardDelete", "true"));
-    OntologyEditLeaseToken lease = acquire(client, changeSet, ns.prefix("orphanEditor"));
+    OntologyChangeOperation operation =
+        termFromMemory(glossary, termId, rejected, ns)
+  
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/mcp/McpContextMemoryVisibilityIT.java` (modified, +99/-0)
```diff
@@ -9,6 +9,7 @@
 import org.junit.jupiter.api.BeforeAll;
 import org.junit.jupiter.api.Test;
 import org.openmetadata.it.auth.JwtAuthProvider;
+import org.openmetadata.schema.entity.data.Table;
 import org.openmetadata.service.Entity;
 
 /**
@@ -21,21 +22,28 @@ class McpContextMemoryVisibilityIT extends McpTestBase {
 
   private static final String SECRET_ANSWER = "the-forecast-is-locked-to-its-owner";
   private static final String SHARED_PILL_ANSWER = "the-pill-body-is-for-its-principals";
+  private static final String ANCHORED_ANSWER = "the-orders-total-is-for-table-readers";
+  private static final String ANCHORED_PILL_ANSWER = "the-orders-pill-is-for-table-readers";
 
   private static String memoryFqn;
   private static String memoryId;
   private static String sharedPillFqn;
+  private static String anchoredMemoryFqn;
+  private static String anchoredPillFqn;
   private static String ownerToken;
   private static String intruderToken;
+  private static String blockedToken;
 
   @BeforeAll
   static void setup() throws Exception {
     initAuth();
     String suffix = UUID.randomUUID().toString().substring(0, 8);
     JsonNode owner = createUser("mcp_vis_owner_" + suffix);
     JsonNode intruder = createUser("mcp_vis_intruder_" + suffix);
+    JsonNode blocked = createUserWithRole("mcp_vis_blocked_" + suffix, denyTableViewRoleId(suffix));
     ownerToken = bearerFor(owner);
     intruderToken = bearerFor(intruder);
+    blockedToken = bearerFor(blocked);
 
     JsonNode memory =
         post(
@@ -57,6 +65,13 @@ static void setup() throws Exception {
     memoryFqn = memory.get("fullyQualifiedName").asText();
     memoryId = memory.get("id").asText();
     sharedPillFqn = createSharedPill(suffix, owner);
+
+    Table anchor = createServiceDatabaseSchemaTable("mcp_vis_" + suffix);
+    anchoredMemoryFqn =
+        createAnchoredMemory("mcp_vis_anchored_" + suffix, anchor, ANCHORED_ANSWER, "Manual");
+    anchoredPillFqn =
+        createAnchoredMemory(
+            "mcp_vis_anchored_pill_" + suffix, anchor, ANCHORED_PILL_ANSWER, "FileExtraction");
   }
 
   /**
@@ -97,6 +112,29 @@ private static String createSharedPill(String suffix, JsonNode sharedPrincipal)
     return pill.get("fullyQualifiedName").asText();
   }
 
+  /** An org-wide (Entity) memory about a table, readable only by the table's readers. */
+  private static String createAnchoredMemory(
+      String name, Table anchor, String answer, String sourceType) throws Exception {
+    JsonNode memory =
+        post(
+            "contextCenter/memories",
+            Map.of(
+                "name",
+                name,
+                "question",
+                "What is the orders total?",
+                "answer",
+                answer,
+                "sourceType",
+                sourceType,
+                "primaryEntity",
+                Map.of("id", anchor.getId().toString(), "type", Entity.TABLE),
+                "shareConfig",
+                Map.of("visibility", "Entity")),
+            JsonNode.class);
+    return memory.get("fullyQualifiedName").asText();
+  }
+
   @Test
   void plainRead_deniesAnotherUsersPrivateMemory() throws Exception {
     Map<String, Object> call =
@@ -172,11 +210,72 @@ void patch_deniesAnotherUsersPrivateMemory() throws Exception {
     assertThat(unchanged.path("description").asText()).isEqualTo("MCP visibility IT");
   }
 
+  /** The intruder keeps DataConsumer's table access, so they are the barrier the blocked user is not. */
+  @Test
+  void plainRead_deniesAnEntityMemoryAboutATableTheCallerCannotView() throws Exception {
+    Map<String, Object> call =
+        McpTestUtils.createGetEntityToolCall(Entity.CONTEXT_MEMORY, anchoredMemoryFqn);
+
+    assertThat(executeMcpRequest(call, intruderToken).toString()).contains(ANCHORED_ANSWER);
+
+    JsonNode denied = executeMcpRequest(call, blockedToken);
+    assertThat(denied.toString()).doesNotContain(ANCHORED_ANSWER);
+    assertThat(denied.path("result").path("isError").asBoolean(false)).isTrue();
+  }
+
+  @Test
+  void companyContextByName_withholdsAPillAboutATableTheCallerCannotView() throws Exception {
+    Map<String, Object> call =
+        McpTestUtils.createToolCallRequest("company_context", Map.of("fqn", anchoredPillFqn));
+
+    assertThat(executeMcpRequest(call, intruderToken).toString()).contains(ANCHORED_PILL_ANSWER);
+
+    JsonNode withheld = executeMcpRequest(call, blockedToken);
+    assertThat(withheld.toString()).doesNotContain(ANCHORED_PILL_ANSWER);
+    assertThat(withheld.toString()).contains("not a shared Company Context knowledge pill");
+  }
+
   private static JsonNode createUser(String name) throws Exception {
     return post(
         "users", Map.of("name", name, "email", name + "@test.openmetadata.org"), JsonNode.class);
   }
 
+  private static JsonNode createUserWithRole(String name, String roleId) throws Exception {
+    return post(
+        "users",
+        Map.of("name", name, "email", name + "@test.o
```

**File**: `openmetadata-mcp/src/main/java/org/openmetadata/mcp/tools/CompanyContextTool.java` (modified, +8/-1)
```diff
@@ -17,6 +17,7 @@
 import org.openmetadata.schema.entity.context.ContextMemory;
 import org.openmetadata.schema.entity.context.ContextMemorySourceType;
 import org.openmetadata.schema.entity.context.MemoryVisibility;
+import org.openmetadata.schema.type.EntityStatus;
 import org.openmetadata.service.Entity;
 import org.openmetadata.service.exception.EntityNotFoundException;
 import org.openmetadata.service.limits.Limits;
@@ -53,6 +54,7 @@ public class CompanyContextTool implements McpTool {
 
   private static final String NOT_A_SHARED_PILL_ERROR =
       "Requested entity is not a shared Company Context knowledge pill";
+  private static final String PILL_FIELDS = "sourceFile,tags,domains";
 
   @Override
   public Map<String, Object> execute(
@@ -122,7 +124,10 @@ private static ContextMemory fetchPill(String fqn) {
     String normalizedFqn = FullyQualifiedName.quoteName(fqn);
     LOG.debug("Getting company context pill: {} (normalized fqn: {})", fqn, normalizedFqn);
     return Entity.getEntityByName(
-        Entity.CONTEXT_MEMORY, normalizedFqn, "sourceFile,owners,tags,domains", null);
+        Entity.CONTEXT_MEMORY,
+        normalizedFqn,
+        ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, PILL_FIELDS),
+        null);
   }
 
   /**
@@ -136,6 +141,7 @@ private static ContextMemory fetchPill(String fqn) {
   private static boolean isExposablePill(
       ContextMemory memory, CatalogSecurityContext securityContext) {
     return memory.getSourceType() == ContextMemorySourceType.FILE_EXTRACTION
+        && memory.getEntityStatus() == EntityStatus.APPROVED
         && !ContextMemoryVisibility.filterByVisibility(List.of(memory), securityContext).isEmpty();
   }
 
@@ -214,6 +220,7 @@ private static Map<String, List<String>> searchFilters() {
     filters.put("entityType", List.of(Entity.CONTEXT_MEMORY));
     filters.put("sourceType", List.of(ContextMemorySourceType.FILE_EXTRACTION.value()));
     filters.put("visibility", List.of(MemoryVisibility.SHARED.value()));
+    filters.put("entityStatus", List.of(EntityStatus.APPROVED.value()));
     return filters;
   }
 
```

**File**: `openmetadata-mcp/src/main/java/org/openmetadata/mcp/tools/GetEntityTool.java` (modified, +22/-10)
```diff
@@ -400,23 +400,35 @@ private static void authorizeKnowledge(IncludeContext ctx) {
 
   private static Object knowledgeContent(IncludeContext ctx) {
     String query = ctx.options().query();
+    List<String> found =
+        query != null && !query.isBlank() && vectorSearchEnabled()
+            ? passages(ctx, query)
+            : List.of();
     Object rendered;
-    if (query != null && !query.isBlank() && vectorSearchEnabled()) {
-      rendered = passages(ctx, query);
-    } else {
+    if (found.isEmpty()) {
       String body = AIContextBuilder.fullContentOf(ctx.entity());
       rendered = renderText(ctx, body == null ? "" : body);
+    } else {
+      rendered =
+          ctx.options().asJson()
+              ? Map.of("passages", found)
+              : renderText(ctx, String.join("\n\n---\n\n", found));
     }
     return rendered;
   }
 
-  private static Object passages(IncludeContext ctx, String query) {
-    List<String> found =
-        OpenSearchVectorService.getInstance()
-            .searchChunksByParent(ctx.entity().getId().toString(), query, ctx.options().passages());
-    return ctx.options().asJson()
-        ? Map.of("passages", found)
-        : renderText(ctx, String.join("\n\n---\n\n", found));
+  /**
+   * The entity read is already authorized, so its chunks are searched as the caller. Search can
+   * still withhold every chunk (an anchored or retired memory, or a body not chunked yet); the
+   * caller then gets the full body rather than nothing.
+   */
+  private static List<String> passages(IncludeContext ctx, String query) {
+    return OpenSearchVectorService.getInstance()
+        .searchChunksByParent(
+            ctx.entity().getId().toString(),
+            query,
+            ctx.options().passages(),
+            getSubjectContext(ctx.securityContext()));
   }
 
   private static Object renderText(IncludeContext ctx, String text) {
```

**File**: `openmetadata-mcp/src/test/java/org/openmetadata/mcp/tools/CompanyContextToolTest.java` (modified, +28/-2)
```diff
@@ -12,6 +12,7 @@
 import static org.mockito.ArgumentMatchers.eq;
 import static org.mockito.ArgumentMatchers.isNull;
 import static org.mockito.Mockito.doThrow;
+import static org.mockito.Mockito.lenient;
 import static org.mockito.Mockito.mock;
 import static org.mockito.Mockito.mockStatic;
 import static org.mockito.Mockito.verify;
@@ -38,6 +39,7 @@
 import org.openmetadata.schema.entity.context.MemoryVisibility;
 import org.openmetadata.schema.entity.teams.User;
 import org.openmetadata.schema.type.EntityReference;
+import org.openmetadata.schema.type.EntityStatus;
 import org.openmetadata.service.Entity;
 import org.openmetadata.service.exception.EntityNotFoundException;
 import org.openmetadata.service.jdbi3.ContextMemoryRepository;
@@ -217,6 +219,7 @@ void searchIsScopedToPillsAndCarriesTheCallersIdentity() throws Exception {
       assertEquals(subjectContext, subject.getValue());
       assertEquals(List.of("FileExtraction"), filters.getValue().get("sourceType"));
       assertEquals(List.of("Shared"), filters.getValue().get("visibility"));
+      assertEquals(List.of("Approved"), filters.getValue().get("entityStatus"));
     }
   }
 
@@ -284,6 +287,27 @@ void sharedFilePillIsProjectedToAPrincipalItIsSharedWith() throws Exception {
     assertEquals("A", result.get("answer"));
   }
 
+  @Test
+  void supersededFilePillIsNotReturnedByName() throws Exception {
+    stubMemory(
+        "pill-fqn",
+        sharedWith(
+            memory("pill-fqn", ContextMemorySourceType.FILE_EXTRACTION, MemoryVisibility.SHARED)
+                .withEntityStatus(EntityStatus.DEPRECATED),
+            "bob"));
+    CatalogSecurityContext securityContext = securityContextFor("bob");
+
+    Map<String, Object> result =
+        withSubject(
+            securityContext,
+            "bob",
+            () -> tool.execute(mock(Authorizer.class), securityContext, Map.of("fqn", "pill-fqn")));
+
+    assertEquals(
+        "Requested entity is not a shared Company Context knowledge pill", result.get("error"));
+    assertFalse(result.containsKey("answer"));
+  }
+
   /**
    * Shared means shared with someone: the pill's own shareConfig names the principals, and the
    * search half of this tool already filters on them. Reading by name must answer the same
@@ -398,11 +422,12 @@ private ContextMemory sharedWith(ContextMemory memory, String userName) {
     return memory;
   }
 
+  // Lenient: a pill rejected before the visibility check never reads the caller.
   private CatalogSecurityContext securityContextFor(String userName) {
     Principal principal = mock(Principal.class);
-    when(principal.getName()).thenReturn(userName);
+    lenient().when(principal.getName()).thenReturn(userName);
     CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
-    when(securityContext.getUserPrincipal()).thenReturn(principal);
+    lenient().when(securityContext.getUserPrincipal()).thenReturn(principal);
     return securityContext;
   }
 
@@ -423,6 +448,7 @@ private ContextMemory memory(
         .withFullyQualifiedName(fqn)
         .withQuestion("Q")
         .withAnswer("A")
+        .withEntityStatus(EntityStatus.APPROVED)
         .withSourceType(sourceType)
         .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
   }
```

---

### Incident Patch 11: `3a5d4604` (2026-10-05)
**Commit Message**: Fixes #34636: Inbox on the standard page shell, plus Inbox and My Data dark mode (#34637)

* fix(ui): dark mode for the Inbox and My Data pages

- Activity feed message card hovered to `bg-white`, so in dark the hovered
  row turned into a white box with unreadable light text. Hover to
  `bg-surface` (white in light, raised in dark).
- My Data stat cards sat on `bg-primary`, darker than the page in dark;
  use `bg-surface` like Explore's panels. FeaturedIcon's gray/light theme
  switches to a solid gray block in dark, so keep the gray-blue tint with
  dark variants (the utility scale flips per theme).
- My Data asset list container is raised (`bg-surface`) with its divider
  on `border-secondary` in dark, matching Explore's results column.
- User avatars (ProfilePicture, core OwnerChip) were painted with inline
  light HSL that cannot follow the theme, leaving pale 92%-light bubbles on
  dark surfaces. The hue now travels as a CSS variable and classes choose
  the lightness per theme; light reproduces the original HSL exactly and
  dark draws a deep tint, light glyph and a ring in the same hue.

Light mode is pixel-identical on /inbox/activity, /inbox/tasks and
/my-data.

* fix(ui)

**File**: `openmetadata-ui-core-components/src/main/resources/ui/src/components/application/owner/owner-chip.tsx` (modified, +15/-6)
```diff
@@ -10,7 +10,7 @@
  *  See the License for the specific language governing permissions and
  *  limitations under the License.
  */
-import type { ReactElement, ReactNode } from 'react';
+import type { CSSProperties, ReactElement, ReactNode } from 'react';
 import { User01 as OwnersIcon } from '../../../icons/User01';
 import { Teams as TeamsIcon } from '../../../icons/Teams';
 import { cx } from '@/utils/cx';
@@ -29,6 +29,16 @@ const nameToHue = (name: string): number => {
   return Math.abs(hash) % 360;
 };
 
+// Light reproduces the original 92%/40% HSL tint exactly; dark uses a deep
+// tint with a light glyph, and a ring in the same hue.
+const USER_AVATAR_CLASSES = [
+  'tw:bg-[hsl(var(--avatar-hue)_100%_92%)]',
+  'tw:text-[hsl(var(--avatar-hue)_70%_40%)]',
+  'tw:dark:bg-[hsl(var(--avatar-hue)_40%_22%)]',
+  'tw:dark:text-[hsl(var(--avatar-hue)_85%_78%)]',
+  'tw:dark:border-[hsl(var(--avatar-hue)_45%_38%)]',
+].join(' ');
+
 const avatarSizeMap: Record<number, AvatarProps['size']> = {
   16: 'xxs',
   18: 'xxs',
@@ -59,19 +69,18 @@ export const OwnerChip = ({
   const nameStr =
     typeof displayName === 'string' ? displayName : owner.name ?? '';
   const hue = nameToHue(nameStr);
+  // Inline colours cannot follow the theme, so a user's hue travels as a CSS
+  // variable and USER_AVATAR_CLASSES pick the lightness per theme.
   const avatarStyle = isTeam
     ? {
         backgroundColor: 'var(--tw-color-utility-gray-200)',
       }
-    : {
-        backgroundColor: `hsl(${hue}, 100%, 92%)`,
-        color: `hsl(${hue}, 70%, 40%)`,
-      };
+    : ({ '--avatar-hue': hue } as CSSProperties);
 
   const avatar = (
     <Avatar
       alt={typeof displayName === 'string' ? displayName : owner.name}
-      className={isTeam ? 'tw:opacity-60' : undefined}
+      className={isTeam ? 'tw:opacity-60' : USER_AVATAR_CLASSES}
       contrastBorder={!isTeam}
       initials={
         typeof displayName === 'string' && !isTeam
```

**File**: `openmetadata-ui/src/main/resources/ui/playwright/browser-tests/reactions.spec.ts` (modified, +1/-3)
```diff
@@ -92,10 +92,9 @@ test('every reaction can be selected and removed through the animated product po
     });
   });
   await page.goto('http://reactions.test/', { waitUntil: 'domcontentloaded' });
-  await page.addStyleTag({ path: 'node_modules/antd/dist/antd.css' });
   await page.addStyleTag({
     content:
-      '.ant-popover-feed-reactions .ant-popover-inner-content {display:flex; gap:8px} .ant-btn-popover-reaction {font-size:20px} .ant-zoom-big-appear,.ant-zoom-big-enter,.ant-zoom-big-leave {animation-duration:0.4s !important}',
+      '@keyframes zoom-in { from { transform: scale(0.2) } } [data-testid="feed-reactions-popover"][data-entering] { animation: zoom-in 0.4s }',
   });
   page.on('pageerror', (error) => {
     throw error;
@@ -160,7 +159,6 @@ test('an existing reaction remains usable after completion and a rejected update
   await page.goto('http://reactions.test/?existing', {
     waitUntil: 'domcontentloaded',
   });
-  await page.addStyleTag({ path: 'node_modules/antd/dist/antd.css' });
   await page.addScriptTag({ content: await bundle });
   const button = page.getByTestId('emoji-button');
   await expect(button).toHaveText(/1$/);
```

**File**: `openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/ContextCenterArticles.spec.ts` (modified, +4/-1)
```diff
@@ -1426,7 +1426,10 @@ test.describe('Context Center Articles', () => {
               `/api/v1/conversations/${createdConversation.id}/reaction/rocket`
             ) && response.request().method() === 'PUT'
       );
-      await page.locator('[title="rocket"]:visible').click();
+      await page
+        .getByTestId('feed-reactions-popover')
+        .getByRole('button', { name: 'rocket', exact: true })
+        .click();
       await reactionResponse;
       await mainMessage.getByTestId('emoji-button').hover();
       await expect(
```

**File**: `openmetadata-ui/src/main/resources/ui/playwright/utils/activityFeed.ts` (modified, +12/-12)
```diff
@@ -114,21 +114,21 @@ export const waitForReactionResponse = (page: Page, reaction: string) =>
 /**
  * Click a reaction inside the feed-reactions popover.
  *
- * rc-motion plays the popover's zoom-big entry over several frames, and
- * Playwright's two-frame stability check can land inside a lull in that
- * transform: it then presses coordinates the popover has already moved on
- * from, the press hits dead space, and no reaction request is ever sent — so
- * the caller's hoisted waitForResponse waits out the whole test. rc-motion
- * strips the `-appear`/`-enter` classes on `animationend`, which makes their
- * absence the deterministic "the popover has settled" signal.
+ * The popover animates in over several frames, and Playwright's two-frame
+ * stability check can land inside a lull in that transform: it then presses
+ * coordinates the popover has already moved on from, the press hits dead
+ * space, and no reaction request is ever sent — so the caller's hoisted
+ * waitForResponse waits out the whole test. react-aria removes
+ * `data-entering` once the entry animation ends, which makes its absence the
+ * deterministic "the popover has settled" signal.
  */
 export const clickFeedReaction = async (page: Page, reaction: string) => {
-  const popup = page.locator('.ant-popover-feed-reactions:visible');
+  const popup = page.getByTestId('feed-reactions-popover');
   await expect(popup).toBeVisible();
-  await expect(popup).not.toHaveClass(/ant-zoom-big-(appear|enter|leave)/);
+  await expect(popup).not.toHaveAttribute('data-entering');
 
   await popup
-    .locator(`[data-testid="reaction-button"][title="${reaction}"]`)
+    .locator(`[data-testid="reaction-button"][aria-label="${reaction}"]`)
     .click();
 };
 
@@ -149,9 +149,9 @@ export const reactOnFeedCard = async (page: Page, message: Locator) => {
 
     await addReactionButton.click();
 
-    const popup = page.locator('.ant-popover-feed-reactions:visible');
+    const popup = page.getByTestId('feed-reactions-popover');
     await expect(popup).toBeVisible();
-    await expect(popup).not.toHaveClass(/ant-zoom-big-(appear|enter|leave)/);
+    await expect(popup).not.toHaveAttribute('data-entering');
 
     const reactionResponse = waitForReactionResponse(page, reaction);
     await popup.getByRole('button', { name: reaction, exact: true }).click();
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/ActivityFeed/Reactions/Emoji.tsx` (modified, +15/-20)
```diff
@@ -12,7 +12,7 @@
  */
 
 import '@github/g-emoji-element';
-import { Button, Popover } from 'antd';
+import { Button, HoverCard } from '@openmetadata/ui-core-components';
 import classNames from 'classnames';
 import { createElement, FC, useMemo, useState } from 'react';
 import { useTranslation } from 'react-i18next';
@@ -40,7 +40,6 @@ const Emoji: FC<EmojiProps> = ({
   const { t } = useTranslation();
   const { currentUser } = useApplicationStore();
   const [isUpdating, setIsUpdating] = useState(false);
-  const [visible, setVisible] = useState(false);
 
   const reactionObject = useMemo(
     () => REACTION_LIST.find((value) => value.reaction === reaction),
@@ -103,35 +102,31 @@ const Emoji: FC<EmojiProps> = ({
   );
 
   return (
-    <Popover
-      content={popoverContent}
+    <HoverCard
+      className="tw:p-3"
+      content={popoverContent()}
       key={reaction}
-      open={visible}
-      trigger="hover"
-      zIndex={9999}
-      onOpenChange={setVisible}>
+      placement="top">
       <Button
         className={classNames(
-          'ant-btn-reaction m-r-xss flex-center transparent',
-          {
-            'ant-btn-isReacted': isReacted,
-          }
+          'tw:h-[22px] tw:gap-1 tw:rounded-md! tw:px-2! tw:py-0!',
+          isReacted
+            ? 'tw:text-brand-secondary tw:after:outline-brand'
+            : 'tw:text-secondary'
         )}
+        color="secondary"
         data-testid="emoji-button"
-        disabled={isUpdating}
-        key={reaction}
-        shape="round"
-        size="small"
-        onClick={handleEmojiOnClick}
-        onMouseOver={() => setVisible(true)}>
+        isDisabled={isUpdating}
+        size="xs"
+        onClick={handleEmojiOnClick}>
         {element}
-        <span className="text-xs m-l-xs self-center" data-testid="emoji-count">
+        <span className="tw:ml-1 tw:text-xs" data-testid="emoji-count">
           {reactionList.length.toLocaleString('en-US', {
             useGrouping: false,
           })}
         </span>
       </Button>
-    </Popover>
+    </HoverCard>
   );
 };
 
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/ActivityFeed/Reactions/Reaction.tsx` (modified, +5/-5)
```diff
@@ -12,7 +12,7 @@
  */
 
 import '@github/g-emoji-element';
-import { Button } from 'antd';
+import { Button } from '@openmetadata/ui-core-components';
 import classNames from 'classnames';
 import { createElement, FC } from 'react';
 import { ReactionOperation } from '../../../enums/reactions.enum';
@@ -64,13 +64,13 @@ const Reaction: FC<ReactionProps> = ({
   return (
     <Button
       aria-label={reaction.reaction}
-      className={classNames('ant-btn-popover-reaction', {
-        'ant-btn-popover-isReacted': isReacted,
+      className={classNames('tw:px-1! tw:py-0.5! tw:text-md', {
+        'tw:bg-brand-primary': isReacted,
       })}
+      color="tertiary"
       data-testid="reaction-button"
-      size="small"
+      size="xs"
       title={reaction.reaction}
-      type="text"
       onClick={handleOnClick}>
       {element}
     </Button>
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/ActivityFeed/Reactions/Reactions.tsx` (modified, +25/-25)
```diff
@@ -12,9 +12,13 @@
  */
 
 import '@github/g-emoji-element';
-import { Button, Popover } from 'antd';
+import {
+  Button,
+  Popover,
+  PopoverTrigger,
+} from '@openmetadata/ui-core-components';
 import { groupBy } from 'lodash';
-import { FC, useState } from 'react';
+import { FC, MouseEvent, useState } from 'react';
 import { useTranslation } from 'react-i18next';
 import { ReactComponent as AddReactionIcon } from '../../../assets/svg/ic-add-emoji.svg';
 import {
@@ -29,7 +33,6 @@ import {
 import { useApplicationStore } from '../../../hooks/useApplicationStore';
 import Emoji from './Emoji';
 import Reaction from './Reaction';
-import './reactions.less';
 
 interface ReactionsProps {
   reactions: ReactionProp[];
@@ -48,10 +51,6 @@ const Reactions: FC<ReactionsProps> = ({ reactions, onReactionSelect }) => {
     setVisible(false);
   };
 
-  const handleVisibleChange = (newVisible: boolean) => {
-    setVisible(newVisible);
-  };
-
   /**
    *
    * @param reactionType
@@ -98,31 +97,32 @@ const Reactions: FC<ReactionsProps> = ({ reactions, onReactionSelect }) => {
   });
 
   return (
-    <div className="d-flex items-center" data-testid="feed-reaction-container">
+    <div
+      className="tw:inline-flex tw:items-center tw:gap-2"
+      data-testid="feed-reaction-container">
       {emojis}
-      <Popover
-        arrowPointAtCenter
-        align={{ targetOffset: [0, -10] }}
-        content={reactionList}
-        open={visible}
-        overlayClassName="ant-popover-feed-reactions"
-        placement="topLeft"
-        trigger="click"
-        zIndex={9999}
-        onOpenChange={handleVisibleChange}>
+      <PopoverTrigger isOpen={visible} onOpenChange={setVisible}>
         <Button
-          className="flex-center p-0"
+          aria-label={t('label.add-entity', {
+            entity: t('label.reaction-lowercase-plural'),
+          })}
+          className="tw:size-[22px] tw:rounded-md! tw:p-[3px]!"
+          color="tertiary"
           data-testid="add-reactions"
-          icon={<AddReactionIcon height={16} />}
-          shape="circle"
-          size="small"
+          iconLeading={<AddReactionIcon data-icon height={16} width={16} />}
+          size="xs"
           title={t('label.add-entity', {
             entity: t('label.reaction-lowercase-plural'),
           })}
-          type="text"
-          onClick={(e) => e.stopPropagation()}
+          onClick={(e: MouseEvent) => e.stopPropagation()}
         />
-      </Popover>
+        <Popover
+          containerClassName="tw:flex tw:gap-2 tw:p-1"
+          data-testid="feed-reactions-popover"
+          placement="top start">
+          {reactionList}
+        </Popover>
+      </PopoverTrigger>
     </div>
   );
 };
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/ActivityFeed/Reactions/reactions.less` (removed, +0/-73)
```diff
@@ -1,73 +0,0 @@
-/*
- *  Copyright 2023 Collate.
- *  Licensed under the Apache License, Version 2.0 (the "License");
- *  you may not use this file except in compliance with the License.
- *  You may obtain a copy of the License at
- *  http://www.apache.org/licenses/LICENSE-2.0
- *  Unless required by applicable law or agreed to in writing, software
- *  distributed under the License is distributed on an "AS IS" BASIS,
- *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
- *  See the License for the specific language governing permissions and
- *  limitations under the License.
- */
-@import '../../../styles/variables.less';
-
-/* Reaction CSS Start */
-.ant-btn-add-reactions:hover,
-.ant-btn-add-reactions:focus {
-  color: @primary-color;
-  border-color: @primary-color;
-}
-
-.ant-btn-reaction.ant-btn-sm {
-  padding: var(--om-space-4) var(--om-space-6);
-}
-
-.ant-popover-feed-reactions {
-  .ant-popover-inner-content {
-    padding: var(--om-space-4);
-    display: flex;
-    gap: var(--om-space-8);
-  }
-  .ant-btn-reaction {
-    background: transparent;
-    border: 1px solid var(--om-legacy-color-117-117-117-0-2);
-    padding: var(--om-space-4) var(--om-space-6);
-  }
-  .ant-btn-reaction,
-  .ant-btn-popover-reaction {
-    height: auto;
-    padding: 0 var(--om-space-4);
-    font-size: var(--om-font-size-md);
-    background-color: transparent;
-  }
-
-  .ant-btn-popover-reaction:hover,
-  .ant-btn-popover-isReacted,
-  .ant-btn-popover-isReacted:hover {
-    background-color: @primary-1;
-  }
-
-  .ant-btn-reaction:hover {
-    color: @primary-color;
-    background-color: transparent;
-    border-color: @primary-color;
-  }
-}
-
-.ant-btn.ant-btn-reaction.ant-btn-isReacted {
-  color: @primary-color;
-  border-color: @primary-color;
-  background-color: transparent;
-  padding: var(--om-space-4) var(--om-space-6);
-  &:hover {
-    background-color: transparent;
-  }
-}
-.ant-btn-round.ant-btn-sm {
-  background-color: transparent;
-  padding: var(--om-space-4) var(--om-space-6) !important;
-  &:hover {
-    background-color: transparent;
-  }
-}
```

---

### Incident Patch 12: `be50947a` (2026-10-05)
**Commit Message**: Fixes #34668: Run the app-run recovery ITs one test at a time (#34669)

* Fixes #34668: Run the app-run recovery ITs one test at a time

On MySQL the interrupt UPDATE scans apps_extension_time_series by timestamp,
so concurrent tests sharing the same small timestamps deadlocked against a
sibling test's cleanup DELETE. RdfIndexRunRecovery retries on the deadlock,
but the test asserted before the retry and saw the run still running.

* Keep the two app-run recovery ITs from running at the same time

RdfIndexRunRecoveryIT also runs in the parallel lane, next to
AppRunInterruptionIT. Both use the same small run timestamps, so the same
deadlock could happen between the two classes. Share a resource lock.

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/AppRunInterruptionIT.java` (modified, +8/-1)
```diff
@@ -12,6 +12,8 @@
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.api.parallel.Execution;
 import org.junit.jupiter.api.parallel.ExecutionMode;
+import org.junit.jupiter.api.parallel.ResourceLock;
+import org.openmetadata.it.util.SharedResourceLocks;
 import org.openmetadata.schema.entity.app.AppExtension;
 import org.openmetadata.schema.entity.app.AppRunRecord;
 import org.openmetadata.schema.entity.app.FailureContext;
@@ -25,8 +27,13 @@
  * A run that ends without reporting its own status must still say why, on MySQL and Postgres. Every
  * record here belongs to an app name no real app uses, so the concurrent tests sharing this
  * database never see them.
+ *
+ * <p>These tests, and those of the other class sharing {@link SharedResourceLocks#APP_RUN_RECORDS},
+ * run one at a time: they share the same small run timestamps, and on MySQL the interrupt UPDATE
+ * scans by timestamp, so a concurrent test's cleanup DELETE can deadlock it.
  */
-@Execution(ExecutionMode.CONCURRENT)
+@Execution(ExecutionMode.SAME_THREAD)
+@ResourceLock(SharedResourceLocks.APP_RUN_RECORDS)
 public class AppRunInterruptionIT {
   private static final String STATUS = AppExtension.ExtensionType.STATUS.toString();
 
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/RdfIndexRunRecoveryIT.java` (modified, +8/-1)
```diff
@@ -26,6 +26,8 @@
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.api.parallel.Execution;
 import org.junit.jupiter.api.parallel.ExecutionMode;
+import org.junit.jupiter.api.parallel.ResourceLock;
+import org.openmetadata.it.util.SharedResourceLocks;
 import org.openmetadata.schema.entity.app.AppExtension;
 import org.openmetadata.schema.entity.app.AppRunRecord;
 import org.openmetadata.schema.utils.JsonUtils;
@@ -40,8 +42,13 @@
  * still executing elsewhere, on MySQL and Postgres. Each test uses its own app name and lock key,
  * so real runs and the concurrent tests sharing this database are unaffected. The recheck a live
  * run schedules is run by hand, so no test waits for a lock to expire.
+ *
+ * <p>These tests, and those of the other class sharing {@link SharedResourceLocks#APP_RUN_RECORDS},
+ * run one at a time: they share the same small run timestamps, and on MySQL the interrupt UPDATE
+ * scans by timestamp, so a concurrent test's cleanup DELETE can deadlock it.
  */
-@Execution(ExecutionMode.CONCURRENT)
+@Execution(ExecutionMode.SAME_THREAD)
+@ResourceLock(SharedResourceLocks.APP_RUN_RECORDS)
 public class RdfIndexRunRecoveryIT {
   private static final String STATUS = AppExtension.ExtensionType.STATUS.toString();
   private static final long STARTUP = 2_000L;
```

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/util/SharedResourceLocks.java` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 package org.openmetadata.it.util;
 
 public final class SharedResourceLocks {
+  public static final String APP_RUN_RECORDS = "appRunRecords";
   public static final String GLOSSARY_TERM_RELATION_SETTINGS = "glossaryTermRelationSettings";
   public static final String OPEN_LINEAGE_SETTINGS = "openLineageSettings";
   public static final String SEARCH_SETTINGS = "searchSettings";
```

---

### Incident Patch 13: `475d7597` (2026-10-05)
**Commit Message**: Fixes #34662: stop bot bulk PUTs blanking fields the source doesn't send (#34663)

* Fixes #34662: never let a bot bulk PUT blank fields the source doesn't send

With overrideMetadata=true, an empty description or displayName and an
omitted certification overwrote stored values. tableConstraints had no
bot guard at all, so any bot PUT without constraints removed them,
override or not. Override now replaces a stored value only when the
source supplies one; constraints on dropped columns are still cleaned up.

* Move table-constraint ITs above the helpers section

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/BulkOverrideMetadataIT.java` (modified, +152/-1)
```diff
@@ -2,6 +2,7 @@
 
 import static org.junit.jupiter.api.Assertions.assertEquals;
 import static org.junit.jupiter.api.Assertions.assertNotNull;
+import static org.junit.jupiter.api.Assertions.assertTrue;
 
 import com.fasterxml.jackson.databind.ObjectMapper;
 import java.net.URI;
@@ -27,8 +28,10 @@
 import org.openmetadata.schema.entity.data.DatabaseSchema;
 import org.openmetadata.schema.entity.data.Table;
 import org.openmetadata.schema.entity.services.DatabaseService;
+import org.openmetadata.schema.type.AssetCertification;
 import org.openmetadata.schema.type.Column;
 import org.openmetadata.schema.type.ColumnDataType;
+import org.openmetadata.schema.type.TableConstraint;
 import org.openmetadata.schema.type.TagLabel;
 
 /**
@@ -46,6 +49,7 @@ public class BulkOverrideMetadataIT {
 
   private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
   private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
+  private static final String CERTIFICATION_GOLD = "Certification.Gold";
 
   @Test
   void test_botCannotOverwriteDescription_withoutOverride(TestNamespace ns) throws Exception {
@@ -81,6 +85,23 @@ void test_botOverwritesDescription_withOverride(TestNamespace ns) throws Excepti
         "overrideMetadata=true lets a bot PUT overwrite the description");
   }
 
+  @Test
+  void test_overrideDoesNotBlankDescription(TestNamespace ns) throws Exception {
+    String schemaFqn = setupSchema(ns);
+    String botToken = BulkApi.botToken();
+    CreateTable original = table(ns, schemaFqn, "ovr_desc_blank", "curated description", "hash-v1");
+    BulkApi.upsert("tables", List.of(original), false, botToken);
+
+    String fqn = schemaFqn + "." + original.getName();
+    CreateTable changed = table(ns, schemaFqn, "ovr_desc_blank", null, "hash-v2");
+    BulkApi.upsert("tables", List.of(changed), true, botToken);
+
+    assertEquals(
+        "curated description",
+        getTable(fqn).getDescription(),
+        "overrideMetadata=true must not blank a description when none is supplied");
+  }
+
   @Test
   void test_overrideMetadata_disablesSourceHashFastPath(TestNamespace ns) throws Exception {
     String schemaFqn = setupSchema(ns);
@@ -120,6 +141,63 @@ void test_botCannotOverwriteDisplayName_withoutOverride(TestNamespace ns) throws
         "a bot PUT must not overwrite a non-empty displayName without overrideMetadata");
   }
 
+  @Test
+  void test_botOverwritesDisplayName_withOverride(TestNamespace ns) throws Exception {
+    String schemaFqn = setupSchema(ns);
+    String botToken = BulkApi.botToken();
+    CreateTable original = table(ns, schemaFqn, "ovr_dn_on", "desc", "hash-v1");
+    original.setDisplayName("Curated Display Name");
+    BulkApi.upsert("tables", List.of(original), false, botToken);
+
+    String fqn = schemaFqn + "." + original.getName();
+    CreateTable changed = table(ns, schemaFqn, "ovr_dn_on", "desc", "hash-v2");
+    changed.setDisplayName("Connector Display Name");
+    BulkApi.upsert("tables", List.of(changed), true, botToken);
+
+    assertEquals(
+        "Connector Display Name",
+        getTable(fqn).getDisplayName(),
+        "overrideMetadata=true lets a bot PUT overwrite the displayName");
+  }
+
+  @Test
+  void test_overrideDoesNotBlankDisplayName(TestNamespace ns) throws Exception {
+    String schemaFqn = setupSchema(ns);
+    String botToken = BulkApi.botToken();
+    CreateTable original = table(ns, schemaFqn, "ovr_dn_blank", "desc", "hash-v1");
+    original.setDisplayName("Curated Display Name");
+    BulkApi.upsert("tables", List.of(original), false, botToken);
+
+    String fqn = schemaFqn + "." + original.getName();
+    CreateTable changed = table(ns, schemaFqn, "ovr_dn_blank", "desc", "hash-v2");
+    BulkApi.upsert("tables", List.of(changed), true, botToken);
+
+    assertEquals(
+        "Curated Display Name",
+        getTable(fqn).getDisplayName(),
+        "overrideMetadata=true must not blank a displayName when none is supplied");
+  }
+
+  @Test
+  void test_overrideDoesNotRemoveCertificationWhenNoneSupplied(TestNamespace ns) throws Exception {
+    String schemaFqn = setupSchema(ns);
+    String botToken = BulkApi.botToken();
+    CreateTable original = table(ns, schemaFqn, "ovr_cert_blank", "desc", "hash-v1");
+    original.setCertification(goldCertification());
+    BulkApi.upsert("tables", List.of(original), false, botToken);
+
+    String fqn = schemaFqn + "." + original.getName();
+    assertNotNull(getTable(fqn).getCertification(), "test setup failed to certify the table");
+
+    CreateTable changed = table(ns, schemaFqn, "ovr_cert_blank", "desc", "hash-v2");
+    BulkApi.upsert("tables", List.of(changed), true, botToken);
+
+    AssetCertification certification = getTable(fqn).getCertification();
+    assertNotNull(
+        certification, "overrideMetadata=true must not remove a certification when none is sent");
+    assertEquals(CERTIFICATION_GOLD, certification.getTagLabel().getTagFQN());
+  }
+
   @Test
   void t
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/EntityRepository.java` (modified, +8/-6)
```diff
@@ -9905,10 +9905,12 @@ private void updateDescription() {
       if (operation.isPut()
           && !nullOrEmpty(original.getDescription())
           && updatedByBot()
-          && !overrideMetadata) {
+          && (!overrideMetadata || nullOrEmpty(updated.getDescription()))) {
         // Revert change to non-empty description if it is being updated by a bot
         // This is to prevent bots from overwriting the description. Description need to be
-        // updated with a PATCH request, or via the bulk path with overrideMetadata=true
+        // updated with a PATCH request, or via the bulk path with overrideMetadata=true. Even
+        // then an empty value never blanks it: a source with no comment omits the field, and an
+        // override run must not read that absence as "delete the description".
         updated.setDescription(original.getDescription());
         return;
       }
@@ -9945,11 +9947,11 @@ private void updateDisplayName() {
       // authorizes with the coarse EDIT_ALL operation, which does not intersect that field-level
       // deny, so re-apply it here. Bots the policy allows - for example the SCIM bot syncing
       // identity attributes through the repository - fall through and update it. A bulk force-sync
-      // (overrideMetadata=true) also bypasses this guard.
+      // (overrideMetadata=true) also bypasses this guard, unless it would blank the displayName.
       boolean preserveUserDisplayName =
           updatedByBot()
               && !nullOrEmpty(original.getDisplayName())
-              && !overrideMetadata
+              && (!overrideMetadata || nullOrEmpty(updated.getDisplayName()))
               && !Objects.equals(original.getDisplayName(), updated.getDisplayName())
               && updatingBotDeniedOperation(MetadataOperation.EDIT_DISPLAY_NAME);
       if (preserveUserDisplayName) {
@@ -10557,11 +10559,11 @@ private void updateCertification() {
       if (operation.isPut()
           && !nullOrEmpty(original.getCertification())
           && updatedByBot()
-          && !overrideMetadata) {
+          && (!overrideMetadata || updatedCertification == null)) {
         // Revert change to non-empty certification if it is being updated by a bot, matching the
         // guard on description/owners: a stored value wins over anything a scheduled re-sync
         // sends. Certification can still be updated with a PATCH request, or via the bulk path
-        // with overrideMetadata=true.
+        // with overrideMetadata=true when the request carries one.
         updated.setCertification(original.getCertification());
         return;
       }
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/TableRepository.java` (modified, +9/-0)
```diff
@@ -2347,6 +2347,15 @@ private void updateAliases(Table origTable, Table updatedTable) {
     }
 
     private void updateTableConstraints(Table origTable, Table updatedTable, Operation operation) {
+      // Many sources (e.g. Trino) never report constraints, so a bot PUT without any must not
+      // read that absence as "delete them" and wipe user-curated ones. Constraints on columns the
+      // source dropped are still cleaned up below.
+      if (operation.isPut()
+          && updatedByBot()
+          && nullOrEmpty(updatedTable.getTableConstraints())
+          && !nullOrEmpty(origTable.getTableConstraints())) {
+        updatedTable.setTableConstraints(new ArrayList<>(origTable.getTableConstraints()));
+      }
       // Detect columns that were removed (exist in original but not in updated).
       // This also handles null column entries produced by JSON patch operations.
       Set<String> removedColumns = detectRemovedColumns(origTable, updatedTable);
```

**File**: `openmetadata-service/src/test/java/org/openmetadata/service/jdbi3/EntityRepositoryCertificationTest.java` (modified, +5/-2)
```diff
@@ -223,8 +223,10 @@ void updateCertificationBotPutWithOverrideMetadataAppliesExplicitCertification()
   }
 
   @Test
-  void updateCertificationBotPutOmittingCertificationWithOverrideMetadataClearsIt()
+  void updateCertificationBotPutOmittingCertificationWithOverrideMetadataPreservesIt()
       throws Exception {
+    // Most connectors never send a certification, so reading its absence as "clear" would wipe
+    // every curated certification on each override run.
     registerBotUser("ingestion-bot");
     TagLabel origLabel = new TagLabel().withTagFQN("Certification.Gold");
     AssetCertification origCert = new AssetCertification().withTagLabel(origLabel);
@@ -238,7 +240,8 @@ void updateCertificationBotPutOmittingCertificationWithOverrideMetadataClearsIt(
 
     invokeUpdateCertification(updater);
 
-    assertNull(updated.getCertification());
+    assertNotNull(updated.getCertification());
+    assertEquals("Certification.Gold", updated.getCertification().getTagLabel().getTagFQN());
   }
 
   @Test
```

---

### Incident Patch 14: `cc5d1f6b` (2026-10-05)
**Commit Message**: Fixes #34557: Add a Search Settings toggle to turn column indexing off (#34571)

* Fixes #34557: Add a Search Settings toggle to turn column indexing off

Adds globalSettings.enableColumnIndexing (default true) and a toggle in
Settings > Preferences > Search Settings. Turning it off stops writing
column docs, both live and during reindex, and deletes
column_search_index. Turning it on creates the index if it is missing.

While it is off, the missing index cannot fail other work:
- Startup, CLI and reindex skip it.
- Table child fan-out and the Explore entity-type counts leave it out.
- Column-only searches return an empty result.

Also fixes SearchRepository.deleteIndex for a canonical name that is an
alias over a rebuilt index. Elasticsearch reports the alias as existing
but rejects a delete through it, so the alias targets are resolved first.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Branch the column indexing toggle on its current state

SonarCloud flagged the handler on two counts: it used its boolean
parameter to choose between two actions (S2301), and it left the
enable-path save promise floating (S9383). The toggle is controlled, so
the current setting already s

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/search/ColumnIndexingToggleIT.java` (added, +160/-0)
```diff
@@ -0,0 +1,160 @@
+package org.openmetadata.it.tests.search;
+
+import static org.assertj.core.api.Assertions.assertThat;
+
+import com.fasterxml.jackson.databind.JsonNode;
+import java.net.URLEncoder;
+import java.nio.charset.StandardCharsets;
+import java.time.Duration;
+import java.util.ArrayList;
+import java.util.List;
+import org.awaitility.Awaitility;
+import org.junit.jupiter.api.Assumptions;
+import org.junit.jupiter.api.BeforeAll;
+import org.junit.jupiter.api.Test;
+import org.junit.jupiter.api.extension.ExtendWith;
+import org.junit.jupiter.api.parallel.Isolated;
+import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
+import org.openmetadata.it.search.IndexAliasInspector;
+import org.openmetadata.it.search.ReindexHelpers;
+import org.openmetadata.it.search.RelevancyFixtures;
+import org.openmetadata.it.search.SearchAssertions;
+import org.openmetadata.it.search.SearchClient;
+import org.openmetadata.it.search.SearchQueryHelper;
+import org.openmetadata.it.search.SearchSettingsTestHelper;
+import org.openmetadata.it.server.ServerHandle;
+import org.openmetadata.it.util.OssTestServer;
+import org.openmetadata.it.util.TestNamespace;
+import org.openmetadata.it.util.TestNamespaceExtension;
+import org.openmetadata.schema.api.search.SearchSettings;
+import org.openmetadata.schema.entity.data.DatabaseSchema;
+import org.openmetadata.schema.entity.data.Table;
+import org.openmetadata.schema.utils.JsonUtils;
+import org.openmetadata.sdk.network.HttpMethod;
+import org.openmetadata.service.Entity;
+
+/**
+ * Exercises the Settings &gt; Search column indexing toggle against a live engine. Turning it off
+ * deletes the column index, and tables keep indexing and column searches keep answering without
+ * it. Turning it back on recreates the index, and new tables get their column documents again.
+ *
+ * <p>Mutates the global SearchSettings and deletes a shared index, so it is {@link Isolated} and
+ * lives with the other server-global search ITs in the serial search-it lane.
+ */
+@Isolated
+@ExtendWith(TestNamespaceExtension.class)
+class ColumnIndexingToggleIT {
+
+  private static final Duration TIMEOUT = ReindexHelpers.searchPropagationTimeout();
+  private static final Duration POLL = Duration.ofSeconds(2);
+
+  private static ServerHandle server;
+  private static IndexAliasInspector indices;
+  private static SearchAssertions search;
+  private static SearchClient engine;
+
+  @BeforeAll
+  static void setup() {
+    server = OssTestServer.defaultHandle();
+    indices = new IndexAliasInspector(server);
+    search = new SearchAssertions(server);
+    engine = new SearchClient(server);
+  }
+
+  @Test
+  void turningColumnIndexingOffDeletesTheIndexAndTurningItOnBringsItBack(final TestNamespace ns) {
+    // Another replica keeps the old setting for up to the settings-cache TTL, and a column write
+    // from it in that window would recreate the index this test expects to stay deleted.
+    Assumptions.assumeTrue(
+        !OssTestServer.isExternalMode(), "Needs a single server to see the setting change at once");
+    final String columnIndex = indices.indexNameFor(Entity.TABLE_COLUMN);
+    final String columnAlias = indices.aliasFor(Entity.TABLE_COLUMN);
+    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
+    final String marker = RelevancyFixtures.uniqueToken("colidx");
+
+    try {
+      setColumnIndexing(false);
+      assertThat(search.indexExists(columnIndex)).isFalse();
+      assertThat(search.indexExists(columnAlias)).isFalse();
+
+      final Table createdWhileOff = createTable(schema, marker + "off", marker);
+      assertThat(search.indexExists(columnIndex))
+          .as("indexing a table must not bring the column index back")
+          .isFalse();
+      assertThat(SearchQueryHelper.probeIndex(server, Entity.TABLE_COLUMN, 10).totalHits())
+          .isZero();
+      assertThat(countedEntityTypes(marker))
+          .contains(Entity.TABLE)
+          .doesNotContain(Entity.TABLE_COLUMN);
+      assertThat(reindexStatusMessage())
+          .as("the Health page must not ask for a reindex to restore a turned-off index")
+          .isNotBlank()
+          .doesNotContain(Entity.TABLE_COLUMN);
+
+      setColumnIndexing(true);
+      assertThat(search.indexExists(columnIndex)).isTrue();
+
+      final Table createdWhileOn = createTable(schema, marker + "on", marker);
+      Awaitility.await("column docs of " + createdWhileOn.getName())
+          .atMost(TIMEOUT)
+          .pollInterval(POLL)
+          .ignoreExceptions()
+          .untilAsserted(() -> assertThat(columnDocCount(columnIndex, createdWhileOn)).isOne());
+      assertThat(columnDocCount(columnIndex, createdWhileOff)).isZero();
+    } finally {
+      SearchSettingsTestHelper.resetSettings(server);
+    }
+  }
+
+  private static void setColumnIndexing(final boolean enabled) {
+    final SearchSettings settings =
+        SearchSettingsTestHelper.copyOf(SearchSettingsTestHelper.cur
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/OpenMetadataApplication.java` (modified, +3/-0)
```diff
@@ -720,6 +720,9 @@ protected void initializeCoreSearchInfrastructure(OpenMetadataApplicationConfig
     }
 
     int createdIndexCount = searchRepository.createMissingIndexes();
+    // Drops a column index left behind while column indexing was off, e.g. one a server with a
+    // stale settings cache recreated by writing to it.
+    searchRepository.reconcileColumnIndex();
     searchRepository.createOrUpdateIndexTemplates(createdIndexCount);
 
     LOG.info("Core search infrastructure initialization completed");
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/apps/bundles/searchIndex/DistributedIndexingStrategy.java` (modified, +3/-1)
```diff
@@ -438,7 +438,9 @@ Stats initializeTotalRecords(Set<String> entities) {
       stats.getEntityStats().getAdditionalProperties().put(entityType, entityStats);
     }
 
-    if (entities.contains(Entity.TABLE) && !entities.contains(Entity.TABLE_COLUMN)) {
+    if (entities.contains(Entity.TABLE)
+        && !entities.contains(Entity.TABLE_COLUMN)
+        && searchRepository.isColumnIndexingEnabled()) {
       StepStats columnEntityStats = new StepStats();
       columnEntityStats.setTotalRecords(0);
       columnEntityStats.setSuccessRecords(0);
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/apps/bundles/searchIndex/ElasticSearchBulkSink.java` (modified, +1/-1)
```diff
@@ -391,7 +391,7 @@ public void write(List<?> entities, Map<String, Object> contextData) throws Exce
         // Index columns asynchronously when processing table entities. Each submission is gated by
         // a semaphore so a fast reader cannot pin an unbounded number of Table entities in the
         // shared doc-build queue (see submitColumnIndexTask).
-        if (Entity.TABLE.equals(entityType)) {
+        if (Entity.TABLE.equals(entityType) && searchRepository.isColumnIndexingEnabled()) {
           for (EntityInterface entity : entityInterfaces) {
             submitColumnIndexTask(entity, reindexContext);
           }
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/apps/bundles/searchIndex/OpenSearchBulkSink.java` (modified, +1/-1)
```diff
@@ -409,7 +409,7 @@ public void write(List<?> entities, Map<String, Object> contextData) throws Exce
         // Index columns asynchronously when processing table entities. Each submission is gated by
         // a semaphore so a fast reader cannot pin an unbounded number of Table entities in the
         // shared doc-build queue (see submitColumnIndexTask).
-        if (Entity.TABLE.equals(entityType)) {
+        if (Entity.TABLE.equals(entityType) && searchRepository.isColumnIndexingEnabled()) {
           for (EntityInterface entity : entityInterfaces) {
             submitColumnIndexTask(entity, reindexContext);
           }
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/apps/bundles/searchIndex/SearchIndexMetrics.java` (modified, +3/-1)
```diff
@@ -16,6 +16,7 @@
 import io.micrometer.core.instrument.Gauge;
 import io.micrometer.core.instrument.MeterRegistry;
 import java.util.ArrayList;
+import java.util.HashMap;
 import java.util.HashSet;
 import java.util.List;
 import java.util.Map;
@@ -108,7 +109,8 @@ public void refreshStats() {
       int rebuildIndices = cleaner.countRebuildIndices(indexStats);
       int orphanedIndices = cleaner.countOrphanedIndices(indexStats);
 
-      Map<String, IndexMapping> indexMap = searchRepository.getEntityIndexMap();
+      Map<String, IndexMapping> indexMap = new HashMap<>(searchRepository.getEntityIndexMap());
+      indexMap.keySet().removeIf(searchRepository::isIndexDisabled);
       int expectedIndices = indexMap.size();
       int missingIndices = countMissingIndices(indexMap, indexStats);
 
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/SystemRepository.java` (modified, +8/-1)
```diff
@@ -483,6 +483,10 @@ private void postUpdate(SettingsType settingsType) {
     if (settingsType == SettingsType.LOGIN_CONFIGURATION) {
       LoginAttemptCache.updateLoginConfiguration();
     }
+
+    if (settingsType == SettingsType.SEARCH_SETTINGS && Entity.getSearchRepository() != null) {
+      Entity.getSearchRepository().reconcileColumnIndex();
+    }
   }
 
   public void updateSetting(Settings setting) {
@@ -1303,7 +1307,8 @@ List<String> findMissingIndexes(SearchRepository searchRepository) {
     try {
       Map<String, IndexMapping> indexMap = searchRepository.getEntityIndexMap();
       for (Map.Entry<String, IndexMapping> entry : indexMap.entrySet()) {
-        if (!semanticSearchEnabled && VECTOR_EMBEDDING_INDEX_KEY.equals(entry.getKey())) {
+        if ((!semanticSearchEnabled && VECTOR_EMBEDDING_INDEX_KEY.equals(entry.getKey()))
+            || searchRepository.isIndexDisabled(entry.getKey())) {
           continue;
         }
         if (!searchRepository.indexExists(entry.getValue())) {
@@ -1378,6 +1383,8 @@ static Set<String> existingTrackedIndexes(
     if (!searchRepository.isVectorEmbeddingEnabled()) {
       existingIndexes.remove(VECTOR_EMBEDDING_INDEX_KEY);
     }
+    // A turned-off index is absent, so comparing its stored mapping hash would report false drift.
+    existingIndexes.removeIf(searchRepository::isIndexDisabled);
     return existingIndexes;
   }
 
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/resources/search/SearchResource.java` (modified, +3/-1)
```diff
@@ -45,6 +45,7 @@
 import jakarta.ws.rs.core.UriInfo;
 import java.io.IOException;
 import java.util.ArrayList;
+import java.util.HashMap;
 import java.util.List;
 import java.util.Map;
 import java.util.UUID;
@@ -1272,7 +1273,8 @@ public Response getSearchStats(@Context SecurityContext securityContext) throws
     response.setIsSearchIndexingRunning(isSearchIndexingRunning());
 
     Map<String, org.openmetadata.search.IndexMapping> indexMap =
-        searchRepository.getEntityIndexMap();
+        new HashMap<>(searchRepository.getEntityIndexMap());
+    indexMap.keySet().removeIf(searchRepository::isIndexDisabled);
     List<String> missingIndexes = new java.util.ArrayList<>();
     for (Map.Entry<String, org.openmetadata.search.IndexMapping> entry : indexMap.entrySet()) {
       if (!searchRepository.indexExists(entry.getValue())) {
```

---

### Incident Patch 15: `b55bb90f` (2026-10-05)
**Commit Message**: chore(ui): fail lint on unused eslint-disable directives (#34665)

Remove the blanket /* eslint-disable */ from reactColumnResize.mock.js.
It suppresses nothing since the config turned off no-require-imports for
src/test/unit/mocks/**, and a blanket directive would silently hide any
problem added to the file later.

Set linterOptions.reportUnusedDisableDirectives to 'error' so a directive
left stale by a fix fails lint instead of warning.

**File**: `openmetadata-ui/src/main/resources/ui/eslint.config.mjs` (modified, +6/-0)
```diff
@@ -57,6 +57,12 @@ export default [
     ],
   },
 
+  // A disable directive that suppresses nothing silently hides whatever is added
+  // under it later, so fail lint and make the fix that left it stale delete it too.
+  {
+    linterOptions: { reportUnusedDisableDirectives: 'error' },
+  },
+
   // Base config for JavaScript and TypeScript files
   {
     files: ['src/**/*.{js,jsx,ts,tsx}'],
```

**File**: `openmetadata-ui/src/main/resources/ui/src/test/unit/mocks/reactColumnResize.mock.js` (modified, +0/-1)
```diff
@@ -11,7 +11,6 @@
  *  limitations under the License.
  */
 
-/* eslint-disable */
 const React = require('react');
 module.exports = {
   useAntdColumnResize: jest.fn().mockImplementation((hookDataFunction) => {
```

#### Recent Merged Pull Requests:
- **PR #34685** (2026-10-05): backport(2.0): What's New version display (#34654) + full breadcrumb on asset-card nav (#34621) (@Rohit0301)
- **PR #34681** (closed): feat(ui): let downstream builds add sections to the profile Notification panel (@Rohit0301)
- **PR #34680** (2026-10-05): Split multi-nested domain E2E into parallel tests; tighten glossary nav spacing (@karanh37)
- **PR #34676** (2026-10-05): Fixes #34675: Serve settings updates on the next read and deflake three merge-queue ITs (@mohityadav766)
- **PR #34671** (2026-10-05): [2.0] Fixes #34662: stop bot bulk PUTs blanking fields the source doesn't send (@ulixius9)
- **PR #34669** (2026-10-05): Fixes #34668: Run the app-run recovery ITs one test at a time (@sonika-shah)
- **PR #34667** (2026-10-05): fix(ui): close an open FilterSelect when its trigger is pressed again (@harsh-vador)
- **PR #34665** (2026-10-05): chore(ui): fail lint on unused eslint-disable directives (@Vansh0310)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
