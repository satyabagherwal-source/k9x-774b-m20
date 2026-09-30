# Forensic Learning Record (Deep Inspection): NVIDIA/skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/nvidia-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NVIDIA/skills](https://github.com/NVIDIA/skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:06:23.436Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA/skills`
- **Description**: Agent Skills for NVIDIA products — install into Claude Code, Codex, and other coding agents to run Physical AI, robotics, simulation, CUDA, and RAG workflows end to end.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3490 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/accelerated-computing-cudf/evals/files/cudf-apply-udf/code/generate_data.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Generate synthetic insurance claims data for UDF processing."""

import os
import numpy as np
import pandas as pd

SEED = 42
N_ROWS = 40_000


def generate():
    if os.path.exists("claims.csv"):
        return

    rng = np.random.default_rng(SEED)

    policy_types = ["auto", "home", "health", "life", "travel"]
    risk_levels = ["low", "medium", "high"]
    regions = ["northeast", "southeast", "midwest", "west", "pacific"]

    df = pd.DataFrame({
        "claim_id": range(N_ROWS),
        "policy_type": rng.choice(policy_types, N_ROWS),
        "risk_level": rng.choice(risk_levels, N_ROWS, p=[0.5, 0.35, 0.15]),
        "region": rng.choice(regions, N_ROWS),
        "age": rng.integers(18, 85, N_ROWS),
        "claim_amount": np.round(rng.exponential(5000, N_ROWS), 2),
        "deductible": np.round(rng.choice([250, 500, 1000, 2000, 5000], N_ROWS).astype(float), 2),
        "premium_monthly": np.round(rng.uniform(50, 800, N_ROWS), 2),
        "years_as_customer": rng.integers(0, 30, N_ROWS),
        "num_prior_claims": rng.integers(0, 10, N_ROWS),
        "credit_score": rng.integers(300, 850, N_ROWS),
        "property_value": np.round(rng.uniform(50_000, 1_000_000, N_ROWS), 2),
    })

    df.to_csv("claims.csv", index=False)
    print(f"Generated {len(df)} insurance claims -> claims.csv")


if __name__ == "__main__":
    generate()

```

### Core Architecture Module: `skills/accelerated-computing-cudf/evals/files/cudf-apply-udf/code/udf_pipeline.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""UDF-heavy processing pipeline on insurance claims data.

Uses apply(), applymap(), and custom functions for row-wise and
element-wise transformations on a pandas DataFrame.
"""

import numpy as np
import pandas as pd

from generate_data import generate


def load_data():
    generate()
    df = pd.read_csv("claims.csv")
    print(f"Loaded {len(df)} claims")
    return df


# --- Row-wise UDFs used with apply(axis=1) ---

def calculate_risk_score(row):
    """Complex row-wise risk scoring function."""
    base_score = 50

    # Age factor
    if row["age"] < 25:
        base_score += 15
    elif row["age"] > 65:
        base_score += 10
    else:
        base_score -= 5

    # Claims history
    base_score += row["num_prior_claims"] * 8

    # Credit score factor
    if row["credit_score"] >= 750:
        base_score -= 20
    elif row["credit_score"] >= 650:
        base_score -= 10
    elif row["credit_score"] < 550:
        base_score += 15

    # Risk level multiplier
    if row["risk_level"] == "high":
        base_score *= 1.5
    elif row["risk_level"] == "medium":
        base_score *= 1.2

    # Loyalty discount
    if row["years_as_customer"] > 10:
        base_score *= 0.85
    elif row["years_as_customer"] > 5:
        base_score *= 0.92

    return round(base_score, 2)


def calculate_payout(row):
    """Calculate adjusted payout amount based on multiple conditions."""
    amount = row["claim_amount"]
    deductible = row["deductible"]

    net = max(0, amount - deductible)

    # Cap by policy type
    caps = {"auto": 50_000, "home": 200_000, "health": 100_000,
            "life": 500_000, "travel": 10_000}
    cap = caps.get(row["policy_type"], 50_000)
    net = min(net, cap)

    # Loyalty bonus: extra 5% for long-term customers
    if row["years_as_customer"] > 15:
        net *= 1.05

    # High-risk penalty: reduce by 10%
    if row["risk_level"] == "high" and row["num_prior_claims"] > 5:
        net *= 0.90

    return round(net, 2)


def classify_claim_tier(row):
    """Classify claim into processing tier based on multiple factors."""
    amount = row["claim_amount"]
    risk = row["risk_level"]
    priors = row["num_prior_claims"]

    if amount > 20_000 or (risk == "high" and priors > 3):
        return "tier_3_manual"
    elif amount > 5_000 or (risk == "medium" and priors > 2):
        return "tier_2_review"
    else:
        return "tier_1_auto"


# --- Column-wise UDFs ---

def normalize_score(series):
    """Min-max normalize a numeric series."""
    return (series - series.min()) / (series.max() - series.min())


def winsorize(series, lower=0.05, upper=0.95):
    """Clip values at the given percentiles."""
    lo = series.quantile(lower)
    hi = series.quantile(upper)
    return series.clip(lo, hi)


# --- Element-wise UDF ---

def format_currency(val):
    """Format a numeric value as currency string."""
    if pd.isna(val):
        return "$0.00"
    return f"${val:,.2f}"


def credit_bucket(val):
    """Bucket a credit score into a category."""
    if val >= 750:
        return "excellent"
    elif val >= 700:
        return "good"
    elif val >= 650:
        return "fair"
    elif val >= 550:
        return "poor"
    else:
        return "very_poor"


def process_claims(df):
    """Apply all UDFs to the claims DataFrame."""

    # Row-wise apply (the expensive operations)
    print("Computing risk scores (row-wise apply)...")
    df["risk_score"] = df.apply(calculate_risk_score, axis=1)

    print("Computing payouts (row-wise apply)...")
    df["payout"] = df.apply(calculate_payout, axis=1)

    print("Classifying claims (row-wise apply)...")
    df["claim_tier"] = df.apply(classify_claim_tier, axis=1)

    # Column-wise UDFs
    print("Normalizing and winsorizing...")
    df["risk_score_norm"] = normalize_score(df["risk_score"])
    df["claim_amount_winsorized"] = winsorize(df["claim_amount"])
    df["premium_norm"] = normalize_score(df["premium_monthly"])

    # Element-wise apply (applymap-style via apply on columns)
    print("Formatting and bucketing...")
    df["credit_bucket"] = df["credit_score"].apply(credit_bucket)
    df["payout_formatted"] = df["payout"].apply(format_currency)

    # Element-wise on multiple numeric columns
    numeric_cols = ["claim_amount", "deductible", "premium_monthly", "property_value"]
    formatted = df[numeric_cols].applymap(format_currency)
    for col in numeric_cols:
        df[f"{col}_fmt"] = formatted[col]

    return df


def summarize(df):
    """Summarize processed claims."""
    print(f"\nProcessed {len(df)} claims")
    print(f"Risk score stats: mean={df['risk_score'].mean():.1f}, "
          f"std={df['risk_score'].std():.1f}")
    print(f"Total payouts: ${df['payout'].sum():,.2f}")

    tier_counts = df["claim_tier"].value_counts()
    print(f"\nClaim tiers:\n{tier_counts}")

    credit_dist = df["credit_bucket"].value_counts()
    print(f"\nCredit distribution:\n{credit_dist}")

    by_type = df.groupby("policy_type").agg(
        avg_risk=("risk_score", "mean"),
        total_payout=("payout", "sum"),
        claim_count=("claim_id", "count"),
    ).round(2)
    print(f"\nBy policy type:\n{by_type}")


def main():
    df = load_data()
    df = process_claims(df)
    summarize(df)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/accelerated-computing-cudf/evals/files/cudf-csv-etl/code/etl_pipeline.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""CSV ETL pipeline: read, filter, compute, groupby, write parquet.

Reads sales.csv, filters to completed orders, adds computed columns
(revenue, discounted_revenue, age_group), runs a groupby aggregation
by region and product, and writes the summary to parquet.
"""

import numpy as np
import pandas as pd

from generate_data import generate


def load_data():
    generate()
    df = pd.read_csv("sales.csv")
    print(f"Loaded {len(df)} rows from sales.csv")
    return df


def filter_completed(df):
    """Keep only completed orders with quantity >= 2."""
    mask = (df["status"] == "completed") & (df["quantity"] >= 2)
    filtered = df[mask].copy()
    print(f"Filtered to {len(filtered)} completed orders")
    return filtered


def add_computed_columns(df):
    """Add revenue, discounted revenue, and age group columns."""
    df["revenue"] = df["quantity"] * df["unit_price"]
    df["discounted_revenue"] = df["revenue"] * (1 - df["discount_pct"])

    bins = [0, 25, 35, 50, 65, 100]
    labels = ["18-25", "26-35", "36-50", "51-65", "65+"]
    df["age_group"] = pd.cut(df["customer_age"], bins=bins, labels=labels)

    df["high_value"] = (df["discounted_revenue"] > 500).astype(int)
    print(f"Added computed columns; {df['high_value'].sum()} high-value orders")
    return df


def aggregate_by_region_product(df):
    """Groupby region + product, compute summary statistics."""
    summary = (
        df.groupby(["region", "product"])
        .agg(
            total_revenue=("revenue", "sum"),
            total_discounted=("discounted_revenue", "sum"),
            order_count=("order_id", "count"),
            avg_quantity=("quantity", "mean"),
            avg_unit_price=("unit_price", "mean"),
            high_value_count=("high_value", "sum"),
        )
        .reset_index()
    )
    summary["avg_discount_impact"] = (
        1 - summary["total_discounted"] / summary["total_revenue"]
    )
    summary = summary.sort_values("total_revenue", ascending=False)
    print(f"Aggregated into {len(summary)} region-product groups")
    return summary


def write_output(summary):
    """Write the summary to a parquet file."""
    summary.to_parquet("sales_summary.parquet", index=False)
    print("Wrote sales_summary.parquet")


def main():
    df = load_data()
    df = filter_completed(df)
    df = add_computed_columns(df)
    summary = aggregate_by_region_product(df)
    write_output(summary)

    print("\nTop 5 region-product combos by revenue:")
    print(summary.head(5).to_string(index=False))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/accelerated-computing-cudf/evals/files/cudf-csv-etl/code/generate_data.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Generate a synthetic sales CSV for the ETL pipeline."""

import os
import numpy as np
import pandas as pd

SEED = 42
N_ROWS = 50_000


def generate():
    if os.path.exists("sales.csv"):
        return

    rng = np.random.default_rng(SEED)

    regions = ["North", "South", "East", "West"]
    products = ["Widget", "Gadget", "Doohickey", "Thingamajig", "Whatchamacallit"]
    statuses = ["completed", "pending", "returned", "cancelled"]

    df = pd.DataFrame({
        "order_id": range(N_ROWS),
        "region": rng.choice(regions, N_ROWS),
        "product": rng.choice(products, N_ROWS),
        "quantity": rng.integers(1, 50, N_ROWS),
        "unit_price": np.round(rng.uniform(5.0, 500.0, N_ROWS), 2),
        "discount_pct": np.round(rng.uniform(0.0, 0.3, N_ROWS), 3),
        "status": rng.choice(statuses, N_ROWS, p=[0.7, 0.1, 0.1, 0.1]),
        "customer_age": rng.integers(18, 80, N_ROWS),
    })

    df.to_csv("sales.csv", index=False)
    print(f"Generated {len(df)} rows -> sales.csv")


if __name__ == "__main__":
    generate()

```

### Core Architecture Module: `skills/accelerated-computing-cudf/evals/files/cudf-groupby-agg/code/generate_data.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Generate synthetic employee performance data."""

import os
import numpy as np
import pandas as pd

SEED = 42
N_EMPLOYEES = 50_000


def generate():
    if os.path.exists("employees.csv"):
        return

    rng = np.random.default_rng(SEED)

    departments = ["Engineering", "Sales", "Marketing", "Finance", "HR", "Operations"]
    levels = ["Junior", "Mid", "Senior", "Lead", "Principal"]
    offices = ["NYC", "SF", "London", "Berlin", "Tokyo", "Sydney"]

    df = pd.DataFrame({
        "employee_id": range(N_EMPLOYEES),
        "department": rng.choice(departments, N_EMPLOYEES),
        "level": rng.choice(levels, N_EMPLOYEES, p=[0.3, 0.3, 0.2, 0.12, 0.08]),
        "office": rng.choice(offices, N_EMPLOYEES),
        "salary": np.round(rng.normal(85_000, 25_000, N_EMPLOYEES).clip(30_000, 300_000), 2),
        "bonus": np.round(rng.exponential(5_000, N_EMPLOYEES), 2),
        "performance_score": np.round(rng.normal(3.5, 0.8, N_EMPLOYEES).clip(1.0, 5.0), 2),
        "years_tenure": rng.integers(0, 25, N_EMPLOYEES),
        "projects_completed": rng.integers(0, 50, N_EMPLOYEES),
        "training_hours": np.round(rng.exponential(20, N_EMPLOYEES), 1),
    })

    df.to_csv("employees.csv", index=False)
    print(f"Generated {len(df)} employee records -> employees.csv")


if __name__ == "__main__":
    generate()

```

### Core Architecture Module: `skills/accelerated-computing-cudf/evals/files/cudf-groupby-agg/code/groupby_analysis.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Complex groupby aggregation and transform pipeline.

Performs department-level, multi-key groupby, named aggregation,
and transform-based feature engineering on employee data.
"""

import numpy as np
import pandas as pd

from generate_data import generate


def load_data():
    generate()
    df = pd.read_csv("employees.csv")
    print(f"Loaded {len(df)} employees")
    return df


def department_summary(df):
    """Basic department-level aggregation with multiple functions."""
    dept = df.groupby("department").agg(
        headcount=("employee_id", "count"),
        avg_salary=("salary", "mean"),
        median_salary=("salary", "median"),
        std_salary=("salary", "std"),
        total_bonus=("bonus", "sum"),
        avg_perf=("performance_score", "mean"),
        unique_levels=("level", "nunique"),
        unique_offices=("office", "nunique"),
        avg_tenure=("years_tenure", "mean"),
        total_projects=("projects_completed", "sum"),
    ).reset_index()
    dept = dept.sort_values("avg_salary", ascending=False)
    print(f"Department summary: {len(dept)} departments")
    return dept


def multi_key_aggregation(df):
    """Groupby on department + level with named aggregation."""
    result = df.groupby(["department", "level"]).agg(
        count=("employee_id", "count"),
        salary_mean=("salary", "mean"),
        salary_min=("salary", "min"),
        salary_max=("salary", "max"),
        salary_sum=("salary", "sum"),
        bonus_mean=("bonus", "mean"),
        perf_mean=("performance_score", "mean"),
        perf_std=("performance_score", "std"),
        tenure_mean=("years_tenure", "mean"),
        projects_sum=("projects_completed", "sum"),
    ).reset_index()
    result["salary_range"] = result["salary_max"] - result["salary_min"]
    print(f"Multi-key aggregation: {len(result)} groups")
    return result


def office_department_crosstab(df):
    """Three-key groupby: department + office + level."""
    cross = df.groupby(["department", "office", "level"]).agg(
        headcount=("employee_id", "count"),
        avg_salary=("salary", "mean"),
        total_training=("training_hours", "sum"),
    ).reset_index()
    print(f"Cross-tab: {len(cross)} groups")
    return cross


def add_transform_features(df):
    """Use groupby transform to add group-relative features."""
    # Department-level transforms
    df["dept_avg_salary"] = df.groupby("department")["salary"].transform("mean")
    df["dept_std_salary"] = df.groupby("department")["salary"].transform("std")
    df["salary_zscore"] = (df["salary"] - df["dept_avg_salary"]) / df["dept_std_salary"]

    # Level-level transforms
    df["level_avg_perf"] = df.groupby("level")["performance_score"].transform("mean")
    df["perf_vs_level"] = df["performance_score"] - df["level_avg_perf"]

    # Department rank by salary
    df["dept_salary_rank"] = df.groupby("department")["salary"].rank(
        method="dense", ascending=False
    )

    # Department + level cumulative count
    df["dept_level_count"] = df.groupby(["department", "level"]).cumcount() + 1

    # Percent of department total
    df["dept_salary_total"] = df.groupby("department")["salary"].transform("sum")
    df["salary_pct_of_dept"] = df["salary"] / df["dept_salary_total"]

    outlier_count = (df["salary_zscore"].abs() > 2).sum()
    print(f"Transform features added; {outlier_count} salary outliers (|z| > 2)")
    return df


def top_performers_per_dept(df):
    """Get top 5 performers per department using groupby + nlargest."""
    top = (
        df.groupby("department")
        .apply(lambda g: g.nlargest(5, "performance_score"))
        .reset_index(drop=True)
    )
    print(f"Top performers: {len(top)} rows")
    return top


def main():
    df = load_data()

    dept_summary = department_summary(df)
    multi_key = multi_key_aggregation(df)
    cross = office_department_crosstab(df)
    df_with_transforms = add_transform_features(df)
    top_perf = top_performers_per_dept(df)

    print(f"\nDepartment summary:\n{dept_summary.to_string(index=False)}")
    print(f"\nSample transformed rows:\n"
          f"{df_with_transforms[['department', 'level', 'salary', 'salary_zscore', 'perf_vs_level', 'dept_salary_rank']].head(10).to_string(index=False)}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/accelerated-computing-cudf/evals/files/cudf-multi-join/code/generate_data.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Generate three related CSVs: orders, customers, products."""

import os
import numpy as np
import pandas as pd

SEED = 42
N_CUSTOMERS = 3_000
N_PRODUCTS = 200
N_ORDERS = 80_000


def generate():
    if os.path.exists("orders.csv"):
        return

    rng = np.random.default_rng(SEED)

    # --- customers ---
    tiers = ["bronze", "silver", "gold", "platinum"]
    customers = pd.DataFrame({
        "customer_id": range(N_CUSTOMERS),
        "customer_name": [f"Cust_{i:05d}" for i in range(N_CUSTOMERS)],
        "tier": rng.choice(tiers, N_CUSTOMERS, p=[0.4, 0.3, 0.2, 0.1]),
        "country": rng.choice(["US", "UK", "DE", "JP", "BR", "IN"], N_CUSTOMERS),
        "credit_limit": np.round(rng.uniform(500, 50_000, N_CUSTOMERS), 2),
    })

    # --- products ---
    categories = ["electronics", "clothing", "food", "tools", "toys"]
    products = pd.DataFrame({
        "product_id": range(N_PRODUCTS),
        "product_name": [f"Prod_{i:04d}" for i in range(N_PRODUCTS)],
        "category": rng.choice(categories, N_PRODUCTS),
        "base_price": np.round(rng.uniform(2.0, 800.0, N_PRODUCTS), 2),
        "weight_kg": np.round(rng.uniform(0.1, 30.0, N_PRODUCTS), 2),
    })

    # --- orders (some customer_ids intentionally out of range to test left join) ---
    orders = pd.DataFrame({
        "order_id": range(N_ORDERS),
        "customer_id": rng.integers(0, N_CUSTOMERS + 200, N_ORDERS),
        "product_id": rng.integers(0, N_PRODUCTS, N_ORDERS),
        "quantity": rng.integers(1, 20, N_ORDERS),
        "order_total": np.round(rng.uniform(5.0, 2000.0, N_ORDERS), 2),
        "channel": rng.choice(["web", "mobile", "store", "phone"], N_ORDERS),
    })

    customers.to_csv("customers.csv", index=False)
    products.to_csv("products.csv", index=False)
    orders.to_csv("orders.csv", index=False)
    print(f"Generated {N_CUSTOMERS} customers, {N_PRODUCTS} products, {N_ORDERS} orders")


if __name__ == "__main__":
    generate()

```

### Core Architecture Module: `skills/accelerated-computing-cudf/evals/files/cudf-multi-join/code/multi_join.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Three-table join pipeline with aggregation.

Joins orders with customers (left join) and products (inner join),
then computes per-customer and per-category summaries.
"""

import numpy as np
import pandas as pd

from generate_data import generate


def load_tables():
    generate()
    orders = pd.read_csv("orders.csv")
    customers = pd.read_csv("customers.csv")
    products = pd.read_csv("products.csv")
    print(f"Loaded orders={len(orders)}, customers={len(customers)}, products={len(products)}")
    return orders, customers, products


def join_tables(orders, customers, products):
    """Left-join orders->customers, then inner-join with products."""
    # Left join: keep all orders even if customer_id is missing
    merged = orders.merge(customers, on="customer_id", how="left")
    print(f"After left join with customers: {len(merged)} rows, "
          f"{merged['customer_name'].isna().sum()} unmatched customers")

    # Inner join: drop orders whose product_id doesn't match
    merged = merged.merge(products, on="product_id", how="inner")
    print(f"After inner join with products: {len(merged)} rows")

    # Computed columns
    merged["line_total"] = merged["quantity"] * merged["base_price"]
    merged["total_weight"] = merged["quantity"] * merged["weight_kg"]
    merged["over_credit"] = (merged["order_total"] > merged["credit_limit"]).fillna(False)

    return merged


def customer_summary(merged):
    """Per-customer aggregation."""
    cust = (
        merged.groupby("customer_id")
        .agg(
            num_orders=("order_id", "count"),
            total_spent=("order_total", "sum"),
            avg_order=("order_total", "mean"),
            unique_products=("product_id", "nunique"),
            total_weight=("total_weight", "sum"),
            times_over_credit=("over_credit", "sum"),
            tier=("tier", "first"),
            country=("country", "first"),
        )
        .reset_index()
        .sort_values("total_spent", ascending=False)
    )
    print(f"Customer summary: {len(cust)} customers")
    return cust


def category_summary(merged):
    """Per-category aggregation."""
    cat = (
        merged.groupby("category")
        .agg(
            num_orders=("order_id", "count"),
            total_revenue=("line_total", "sum"),
            avg_quantity=("quantity", "mean"),
            unique_customers=("customer_id", "nunique"),
            avg_weight=("total_weight", "mean"),
        )
        .reset_index()
        .sort_values("total_revenue", ascending=False)
    )
    print(f"Category summary: {len(cat)} categories")
    return cat


def tier_channel_summary(merged):
    """Cross-tabulation of tier x channel."""
    cross = (
        merged.groupby(["tier", "channel"])
        .agg(
            order_count=("order_id", "count"),
            revenue=("line_total", "sum"),
        )
        .reset_index()
    )
    # Pivot to wide format
    pivot = cross.pivot_table(
        index="tier", columns="channel", values="revenue",
        aggfunc="sum", fill_value=0,
    )
    print(f"Tier-channel pivot:\n{pivot}")
    return cross


def main():
    orders, customers, products = load_tables()
    merged = join_tables(orders, customers, products)

    cust_summary = customer_summary(merged)
    cat_summary = category_summary(merged)
    tier_ch = tier_channel_summary(merged)

    print(f"\nTop 5 customers by spend:\n{cust_summary.head(5).to_string(index=False)}")
    print(f"\nCategory breakdown:\n{cat_summary.to_string(index=False)}")


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #255** (2026-06-09): **VSS SKILL cannot download docker Images**
  *Symptoms*: ### Description  I tried to use the SKILL for VSS-deploy. In the skill, it deploy VSS based on v3.2. While for the VSS repo, the main branch only have v3.1 In branch release/v3.2, 2 docker images cannot be downloaded  <img width="1706" height="226" alt="Image" src="https://github.com/user-attachments/assets/2714ec32-b7cf-4930-9c9a-a97ad6e9bc5f" />  ### Reproduction Steps  install the skills, and Ask agent to deploy vss 3d. I use cursor  ### Affected Skill (if applicable)  _No response_  ### Agent Client  Claude Code CLI  ### Environment  Ubuntu 24.04 Cursor + GPT 5.5  ### Logs / Error Output  ```shell <img width="1706" height="226" alt="Image" src="https://github.com/user-attachments/assets/fc1d41c4-75fe-4087-95a5-e88a099d5b5e" /> ```  ### Checklist  - [x] I confirmed this bug is reproducible - [x] I searched existing issues and this is not a duplicate
  **Post-Mortem & Fix Analysis**:
  > Hi @ly01325, thanks for the detailed repro and screenshots.  One thing on routing: this catalog repo (`NVIDIA/skills`) is a downstream mirror that auto-syncs from each source product repo. The `vss-deploy-*` skills live upstream in `NVIDIA-AI-Blueprints/video-search-and-summarization`. The v3.2 reference and the broken image pulls need to be fixed there, and the catalog will pick up the corrected content on the next sync.  Could you re-file this against `NVIDIA-AI-Blueprints/video-search-and-summarization`? Tagging @zac-wang-nv and @hugoverjus for visibility — the VSS team is actively iterating on these skills today, so this report is well-timed.  Closing here since we can't fix it from the catalog. Happy to re-engage once it's filed upstream.

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

### Incident Patch 1: `f7c8a88e` (2026-09-15)
**Commit Message**: fix(metadata): exempt validation_status from the null-regression guard

SkillEvaluator 1.5.x stopped emitting the "- Validation status: `passed`"
line that aggregate_benchmarks.py reads, so every skill that re-signs adds
one null and the guard refuses to write benchmarks.json.

This blocked Generate Skill Metadata on main from 2026-09-15 18:14Z onward:
the sync that landed 10 BioNeMo KERMT/FoundationPose skills plus a re-signed
nemotron-speech took the count 248 -> 259 and failed on every hourly run,
recorded in #569.

Treated as a migrating field rather than derived from another value. The line
carries exactly one value -- all 96 cards that still emit it say `passed` --
so it distinguishes nothing, and those 96 are precisely the cards last signed
before 1.5.4 (the same set still carrying the internal CI image path). The
field therefore reaches zero on its own as those teams re-sign, and inferring
it from the verdict or the Tier 1 row would assert something the original
line never claimed.

Every other field stays guarded; the drift is still reported as a note.

Signed-off-by: Moshe Abramovitch <moshea@nvidia.com>

**File**: `.github/scripts/aggregate_benchmarks.py` (modified, +20/-1)
```diff
@@ -99,7 +99,26 @@
 #
 # Remove this once SkillEvaluator emits the threshold as a real per-run field
 # and the parser reads it again.
-MIGRATING_FIELDS = {"pass_threshold_pct"}
+#
+# ---
+#
+# validation_status is read from the "- Validation status: `passed`" line that
+# v1/v2 cards carry and SkillEvaluator 1.5.x dropped. It is the same shape of
+# change as pass_threshold_pct above, and it fired on 2026-09-15: the sync that
+# landed 10 BioNeMo KERMT/FoundationPose skills plus a re-signed nemotron-speech
+# took validation_status from 248 to 259 nulls and blocked the regeneration on
+# every hourly run until this exemption.
+#
+# Worth recording why this is not worth deriving from another field: the line
+# carries exactly one value. All 96 cards that still emit it say `passed`, and
+# none has ever said anything else, so it distinguishes nothing. Those 96 are
+# also precisely the 96 cards still carrying the internal CI image path, i.e.
+# the set last signed before 1.5.4 — so the field reaches zero on its own as
+# those teams re-sign, and inferring it from the verdict or the Tier 1 row
+# would assert something the original line never claimed.
+#
+# Remove this once no card emits the line and the field is dropped outright.
+MIGRATING_FIELDS = {"pass_threshold_pct", "validation_status"}
 
 
 def parse_uplift(raw):
```

---

### Incident Patch 2: `d61fde1e` (2026-09-11)
**Commit Message**: physical-ai-neural-reconstruction: fix NRE image tag references

The skill pins NRE as `release_26.04` and the troubleshooting table points
at that value, but the GA channel on NGC publishes the tags 26.04.01, 26.04,
26 and latest — `docker pull nvcr.io/nvidia/nre/nre-ga:release_26.04` fails
with "manifest unknown" even for entitled accounts. Clarify that
`release_26.04` is the release name, list the real tags, and extend the
troubleshooting row so the error is diagnosed correctly.

Verified against https://catalog.ngc.nvidia.com/orgs/nvidia/teams/nre/containers/nre-ga/tags
(26.04.01 published 2026-08-07).

Signed-off-by: ivonajambrecic <ijambrecic@nvidia.com>

**File**: `skills/physical-ai-neural-reconstruction/SKILL.md` (modified, +4/-3)
```diff
@@ -38,7 +38,7 @@ metadata:
         folder: nre/
         upstream: nvcr.io/nvidia/nre/nre-ga
         tools_container: nvcr.io/nvidia/nre/nre-tools-ga
-        release_tag: release_26.04
+        release_tag: "26.04"  # NRE release; NGC image tags are 26.04.01 / 26.04 / 26 / latest (not `release_26.04`)
       - name: asset-harvester
         skill_repo: https://github.com/NVIDIA/asset-harvester
         skill_path: skills/asset-harvester/
@@ -187,7 +187,7 @@ product repo.
 |------|-----------------|--------------|
 | `physical-ai-datasets` | `skills/physical-ai-datasets/` | Catalog and download recipes for every NVIDIA Physical AI dataset on Hugging Face (driving, robotics, manipulation, NuRec scenes, benchmarks). |
 | `ncore` | `skills/ncore/` | Converts any sensor recording to NCore V4 (the format NRE needs), upstream release `2026.04`. Also covers writing a new converter. |
-| `nre` | `skills/nre/` | The Neural Reconstruction Engine itself (`nvcr.io/nvidia/nre/nre-ga`, `nvcr.io/nvidia/nre/nre-tools-ga`, NRE `release_26.04`). Trains, performs carline adaptation, renders (locally, via warm `serve-grpc` + thin Python client / `batch_render_rgb`, or to an external simulator), exports meshes / point clouds / depth, edits actors, evaluates quality. |
+| `nre` | `skills/nre/` | The Neural Reconstruction Engine itself (`nvcr.io/nvidia/nre/nre-ga`, `nvcr.io/nvidia/nre/nre-tools-ga`, NRE 26.04 — image tags `26.04.01` / `26.04` / `latest`). Trains, performs carline adaptation, renders (locally, via warm `serve-grpc` + thin Python client / `batch_render_rgb`, or to an external simulator), exports meshes / point clouds / depth, edits actors, evaluates quality. |
 | `asset-harvester` | [`NVIDIA/asset-harvester`](https://github.com/NVIDIA/asset-harvester) → `skills/asset-harvester/` | Open-source Apache-2.0 pipeline (SparseViewDiT + TokenGS) that extracts individual 3D objects from sparse views in a driving clip and saves them as `.ply` Gaussian splats, optionally emitting `metadata.yaml` for the NuRec handoff. |
 | `nurec-fixer` | `skills/nurec-fixer/` | Standalone NVIDIA **DiffusionHarmonizer** workflow — public successor to the older Fixer / Difix3D+ recipes — that cleans rendered frames, harmonizes inserted actors, evaluates PSNR/LPIPS, and optionally fine-tunes the model. |
 
@@ -283,7 +283,8 @@ Companion files (`references/`, `scripts/`, `assets/`) ship inside
   or fixes on previously rendered frames.
 - Do not invent NRE / NCore / DiffusionHarmonizer commands from
   memory. Re-read the upstream sibling skill — versions move fast
-  (NRE `release_26.04` and NCore `2026.04` are the current pins).
+  (NRE 26.04 — pull `nvcr.io/nvidia/nre/nre-ga:26.04.01` or `:26.04`; the release name
+  `release_26.04` is not a valid image tag — and NCore `2026.04` are the current pins).
 - This router does not deploy infrastructure. Route AKS / OSMO /
   NIM Operator setup to
   `physical-ai-infrastructure-setup-and-resilient-scaling`.
```

**File**: `skills/physical-ai-neural-reconstruction/references/maintenance.md` (modified, +2/-1)
```diff
@@ -15,7 +15,8 @@ sibling skills:
    still match each sibling's frontmatter `metadata:` block:
    - `ncore` — <https://github.com/NVIDIA/ncore>, release `2026.04`
    - `nre` — `nvcr.io/nvidia/nre/nre-ga` +
-     `nvcr.io/nvidia/nre/nre-tools-ga`, NRE `release_26.04`
+     `nvcr.io/nvidia/nre/nre-tools-ga`, NRE 26.04 (image tags `26.04.01` / `26.04` / `latest`;
+     the release name `release_26.04` is not an image tag)
    - `asset-harvester` — <https://github.com/NVIDIA/asset-harvester>,
      `nvidia/asset-harvester` on Hugging Face. The **skill itself** now
      ships from that repo too (`skills/asset-harvester/`).
```

**File**: `skills/physical-ai-neural-reconstruction/references/troubleshooting.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ that skill, not here.
 | `test -f .../.agents/skills/SKILL.md` fails | Wrong upstream path — the index lives at `skills/nurec-index/` | Use the `skills/nurec-index/` path (or the `.agents/skills/` symlink alias) |
 | `403`/`401` pulling `nvidia/PhysicalAI-*` from HF | Gated license not accepted, or `HF_TOKEN` unset / wrong scope | Accept the gated license on Hugging Face, then `hf auth login` with a token that has `read` access |
 | `denied: requested access to the resource is denied` from `nvcr.io/nvidia/nre/*` | Missing or expired NGC key | `docker login nvcr.io` with `$oauthtoken` / `${NGC_CLI_API_KEY:-$NGC_API_KEY}`; rotate at `org.ngc.nvidia.com/setup/api-key` if needed |
-| `manifest unknown` / `not found` pulling an NRE image | Pulling the legacy un-suffixed name or a tag that channel never published | Pull the GA names `nvcr.io/nvidia/nre/nre-ga:latest` and `nvcr.io/nvidia/nre/nre-tools-ga:latest` |
+| `manifest unknown` / `not found` pulling an NRE image | Pulling the legacy un-suffixed name, or a release *name* used as a tag (e.g. `:release_26.04` — the GA channel publishes `26.04.01`, `26.04`, `26`, `latest`) | Pull the GA names with a published tag: `nvcr.io/nvidia/nre/nre-ga:26.04.01` (or `:latest`) and `nvcr.io/nvidia/nre/nre-tools-ga:latest`; list tags on the NGC catalog page for `nvidia/nre/nre-ga` |
 | `--renderer` or `export-custom-rig-trajectory` rejected as unknown | Cached image is older than `26.04` / `26.03` | Pull a `26.04+` GA image; `--image-format jpeg` works on every family, so don't fall back to PNG |
 | NRE refuses to load a clip ("not valid NCore V4") | Recording was not converted | Run the `ncore` skill before invoking `nre` |
 | `serve-grpc` cold-start latency dominates a Python loop | One-shot Docker invocation per render | Use the `nre` warm `serve-grpc` + thin Python client (`batch_render_rgb`) recipe; the warm fast path needs a `26.04+` image |
```

---

### Incident Patch 3: `9db54649` (2026-09-04)
**Commit Message**: Revert "Add NVFlare install example"

This reverts commit 907270bcb5ae959c4874274a385618a91f4b4f1b.

Signed-off-by: Holger Roth <hroth@nvidia.com>

**File**: `components.d/nvflare.yml` (modified, +1/-2)
```diff
@@ -8,8 +8,7 @@ description: >-
   Agent skills for converting training code to federated workflows,
   diagnosing jobs, collecting federated statistics, and running Auto-FL
   with NVIDIA FLARE. Install the complete NVFlare skill set together so
-  each workflow has its required shared references. Run
-  `npx skills add nvidia/skills` to install.
+  each workflow has its required shared references.
 links:
   security: false
 skills:
```

---

### Incident Patch 4: `be5954fc` (2026-09-08)
**Commit Message**: fix(versions): avoid implying checks write removals

Signed-off-by: mosheabr <moshea@nvidia.com>

**File**: `.github/scripts/generate_versions.py` (modified, +2/-2)
```diff
@@ -156,8 +156,8 @@ def main() -> int:
         blocking = blocking_removals(gone, ab.registered_catalog_dirs(REPO_ROOT))
         expected = [name for name in gone if name not in blocking]
         if expected:
-            print(f"note: {len(expected)} deregistered skill(s) removed from "
-                  f"versions.json: {', '.join(expected)}", file=sys.stderr)
+            print(f"note: detected {len(expected)} deregistered skill(s) absent "
+                  f"from generated output: {', '.join(expected)}", file=sys.stderr)
         if blocking and not args.allow_removals:
             print(f"Refusing to write versions.json: {len(blocking)} skill(s) "
                   f"disappeared while still registered in components.d.",
```

**File**: `.github/scripts/tests/test_generate_versions.py` (modified, +28/-0)
```diff
@@ -22,10 +22,14 @@
 """
 
 import base64
+import contextlib
+import io
 import json
 import sys
+import tempfile
 import unittest
 from pathlib import Path
+from unittest import mock
 
 sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
 
@@ -154,6 +158,30 @@ def test_no_removals_is_never_blocking(self):
         self.assertEqual(gv.blocking_removals([], {"kept"}), [])
 
 
+class TestRemovalDiagnostics(unittest.TestCase):
+    def test_check_does_not_claim_a_deregistration_was_written(self):
+        """--check reports intent without implying it changed versions.json."""
+        with tempfile.TemporaryDirectory() as tmp:
+            output = Path(tmp) / "versions.json"
+            output.write_text(json.dumps({"skills": [{"name": "retired"}]}))
+            stderr = io.StringIO()
+            with (
+                mock.patch.object(gv, "OUTPUT", output),
+                mock.patch.object(gv, "build", return_value={"skills": []}),
+                mock.patch.object(gv, "validate"),
+                mock.patch.object(
+                    gv.ab, "registered_catalog_dirs", return_value={"kept"}
+                ),
+                mock.patch.object(sys, "argv", ["generate_versions.py", "--check"]),
+                contextlib.redirect_stderr(stderr),
+            ):
+                self.assertEqual(gv.main(), 1)
+
+            message = stderr.getvalue()
+            self.assertIn("detected 1 deregistered skill(s)", message)
+            self.assertNotIn("removed from versions.json", message)
+
+
 class TestValidate(unittest.TestCase):
     def good(self) -> dict:
         return {
```

---

### Incident Patch 5: `a787533b` (2026-09-08)
**Commit Message**: fix(versions): let a deregistered skill leave versions.json

The removal guard compares a regeneration against the checked-in
versions.json and refuses to write when any skill disappears. That is
right for the case it was built for -- cuopt-multi-objective-exploration
vanishing on 2026-08-03 while still registered -- but it also fires on
the routine case of a team retiring a skill.

It fired today. Isaac for Healthcare deregistered five catheter skills
in c3168ca, the sync pruned them in #538, and the regeneration refused.
The workflow never passes --allow-removals and has no input to set it,
so there is no way to record that a removal was intended. Because this
is the last generation step, the run exits non-zero and the create-PR
step is skipped, stranding metadata.json, skills.sh.json and
benchmarks.json even though those were generated correctly.

It also cannot self-heal: the comparison is against a checked-in file
that can only be updated by the regeneration that keeps failing, so
every subsequent hourly run fails identically and re-comments on the
tracking issue.

Registration separates the two cases exactly. A skill absent from
components.d was retired on purpose; a skill st

**File**: `.github/scripts/generate_versions.py` (modified, +32/-6)
```diff
@@ -37,6 +37,8 @@
 
 import jsonschema
 
+import aggregate_benchmarks as ab
+
 REPO_ROOT = Path(__file__).resolve().parents[2]
 SKILLS_DIR = REPO_ROOT / "skills"
 OUTPUT = REPO_ROOT / "versions.json"
@@ -112,6 +114,24 @@ def removed_skills(new: dict, old: dict) -> list[str]:
                   - {s["name"] for s in new["skills"]})
 
 
+def blocking_removals(gone: list[str], registered: set[str]) -> list[str]:
+    """Removals that must stop the write, given the registered skill set.
+
+    A skill whose components.d entry was dropped is *expected* to leave the
+    output: the sync prunes its directory and versions.json follows. The case
+    this guard exists for is the opposite one -- a skill still registered that
+    vanished anyway, which is how cuopt-multi-objective-exploration
+    disappeared on 2026-08-03. Registration is what separates them.
+
+    An empty ``registered`` means the parse failed rather than that nothing is
+    registered, so nothing is exempt; otherwise a bad parse would silently
+    switch the guard off.
+    """
+    if not registered:
+        return list(gone)
+    return [name for name in gone if name in registered]
+
+
 def serialize(doc: dict) -> str:
     return json.dumps(doc, indent=2, ensure_ascii=False) + "\n"
 
@@ -133,13 +153,19 @@ def main() -> int:
     # rather than a wall — but it must be deliberate.
     if OUTPUT.is_file():
         gone = removed_skills(doc, json.loads(OUTPUT.read_text()))
-        if gone and not args.allow_removals:
-            print(f"Refusing to write versions.json: {len(gone)} skill(s) "
-                  f"disappeared from the output.", file=sys.stderr)
-            for name in gone:
+        blocking = blocking_removals(gone, ab.registered_catalog_dirs(REPO_ROOT))
+        expected = [name for name in gone if name not in blocking]
+        if expected:
+            print(f"note: {len(expected)} deregistered skill(s) removed from "
+                  f"versions.json: {', '.join(expected)}", file=sys.stderr)
+        if blocking and not args.allow_removals:
+            print(f"Refusing to write versions.json: {len(blocking)} skill(s) "
+                  f"disappeared while still registered in components.d.",
+                  file=sys.stderr)
+            for name in blocking:
                 print(f"  - {name}", file=sys.stderr)
-            print("\nIf these were deregistered in components.d, re-run with "
-                  "--allow-removals.", file=sys.stderr)
+            print("\nDrop their components.d entries if the removal is "
+                  "intended, or re-run with --allow-removals.", file=sys.stderr)
             return 1
 
     rendered = serialize(doc)
```

**File**: `.github/scripts/tests/test_generate_versions.py` (modified, +32/-0)
```diff
@@ -15,6 +15,10 @@
   removal detection     A generated file stays schema-valid with one fewer
                         entry, which is how a skill silently vanished from
                         metadata.json on 2026-08-03.
+  removal intent        A team that deregisters a skill in components.d
+                        expects it to leave versions.json; blocking that made
+                        every post-deregistration regeneration fail, so the
+                        guard keys on registration rather than on absence.
 """
 
 import base64
@@ -122,6 +126,34 @@ def test_reports_every_dropped_skill_sorted(self):
         self.assertEqual(gv.removed_skills(new, old), ["a", "b", "c"])
 
 
+class TestBlockingRemovals(unittest.TestCase):
+    """Which removals stop the write.
+
+    Both directions matter. Blocking a deregistered skill wedges the hourly
+    regeneration permanently, because the guard compares against a checked-in
+    file that can then never be updated. Exempting a registered one restores
+    the 2026-08-03 silent-loss bug.
+    """
+
+    def test_deregistered_skill_is_not_blocking(self):
+        self.assertEqual(gv.blocking_removals(["retired"], {"kept"}), [])
+
+    def test_still_registered_skill_is_blocking(self):
+        self.assertEqual(gv.blocking_removals(["kept"], {"kept"}), ["kept"])
+
+    def test_mixed_removals_block_only_the_registered_one(self):
+        self.assertEqual(
+            gv.blocking_removals(["retired", "kept"], {"kept"}), ["kept"])
+
+    def test_empty_registry_blocks_everything(self):
+        """A failed components.d parse must not disable the guard."""
+        self.assertEqual(
+            gv.blocking_removals(["a", "b"], set()), ["a", "b"])
+
+    def test_no_removals_is_never_blocking(self):
+        self.assertEqual(gv.blocking_removals([], {"kept"}), [])
+
+
 class TestValidate(unittest.TestCase):
     def good(self) -> dict:
         return {
```

#### Recent Merged Pull Requests:
- **PR #633** (2026-09-30): Add RFdiffusion NIM to the BioNeMo skill catalog (@ohadmo)
- **PR #632** (2026-09-30): chore(metadata): regenerate metadata.json, skills.sh.json, benchmarks.json, and versions.json (@github-actions[bot])
- **PR #631** (2026-09-30): chore: sync skills (BioNeMo NIMs,Isaac for Healthcare Workflows) (@github-actions[bot])
- **PR #630** (2026-09-30): chore: remove AIQ skills from catalog (@mosheabr)
- **PR #629** (2026-09-30): Add Evo2 NIM to BioNeMo skill catalog (@ohadmo)
- **PR #628** (2026-09-30): chore(metadata): regenerate metadata.json, skills.sh.json, benchmarks.json, and versions.json (@github-actions[bot])
- **PR #627** (2026-09-30): chore: sync skills (BioNeMo NIMs,TAO Toolkit) (@github-actions[bot])
- **PR #626** (2026-09-29): chore(metadata): regenerate metadata.json, skills.sh.json, benchmarks.json, and versions.json (@github-actions[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
