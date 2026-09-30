# Forensic Learning Record (Deep Inspection): Canner/WrenAI

> **Canonical Artifact**: `07_PROJECT_LEARNING/canner-wrenai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Canner/WrenAI](https://github.com/Canner/WrenAI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:17:31.253Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Canner/WrenAI`
- **Description**: GenBI (Generative BI) for AI agents, an open-source, governed text-to-SQL through an open context layer that turns natural-language questions into trusted dashboards, charts, and SQL across 20+ data sources, such as BigQuery, Snowflake, PostgreSQL, ClickHouse, Amazon Redshift, Databricks and more.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 17793 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/wren-core-base/manifest-macro/src/lib.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

use quote::quote;
use syn::{parse_macro_input, LitBool};

/// This macro generates a struct for `Manifest`
/// If python_binding is true, it will generate a `pyclass` attribute
#[proc_macro]
pub fn manifest(python_binding: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(python_binding as LitBool);
    let python_binding = if input.value {
        quote! {
            #[pyclass]
        }
    } else {
        quote! {}
    };

    let expanded = quote! {
        #python_binding
        #[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Hash, Clone)]
        #[serde(rename_all = "camelCase")]
        pub struct Manifest {
            #[serde(default = "default_layout_version")]
            pub layout_version: u32,
            pub catalog: String,
            pub schema: String,
            #[serde(default)]
            pub models: Vec<Arc<Model>>,
            #[serde(default)]
            pub relationships: Vec<Arc<Relationship>>,
            #[serde(default)]
            pub views: Vec<Arc<View>>,
            #[serde(default)]
            pub data_source: Option<DataSource>,
            #[serde(default)]
            pub cubes: Vec<Arc<Cube>>,
        }

        fn default_layout_version() -> u32 {
            1
        }
    };
    proc_macro::TokenStream::from(expanded)
}

/// This macro generates an enum for `DataSource`
/// If python_binding is true, it will generate a `pyclass` attribute
#[proc_macro]
pub fn data_source(python_binding: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(python_binding as LitBool);
    let python_binding = if input.value {
        quote! {
            #[pyclass(eq, eq_int)]
        }
    } else {
        quote! {}
    };

    let expanded = quote! {
        #python_binding
        #[derive(Serialize, Deserialize, Debug, Default, PartialEq, Eq, Hash, Clone, Copy)]
        #[serde(rename_all = "UPPERCASE")]
        pub enum DataSource {
            #[serde(alias = "bigquery")]
            BigQuery,
            #[serde(alias = "clickhouse")]
            Clickhouse,
            #[serde(alias = "canner")]
            Canner,
            #[serde(alias = "trino")]
            Trino,
            #[serde(alias = "mssql")]
            MSSQL,
            #[serde(alias = "mysql")]
            MySQL,
            #[serde(alias = "doris")]
            Doris,
            #[serde(alias = "postgres")]
            Postgres,
            #[serde(alias = "snowflake")]
            Snowflake,
            #[default]
            #[serde(alias = "datafusion")]
            Datafusion,
            #[serde(alias = "duckdb")]
            DuckDB,
            #[serde(alias = "local_file")]
            LocalFile,
            #[serde(alias = "s3_file")]
            S3File,
            #[serde(alias = "gcs_file")]
            GcsFile,
            #[serde(alias = "minio_file")]
            MinioFile,
            #[serde(alias = "oracle")]
            Oracle,
            #[serde(alias = "athena")]
            Athena,
            #[serde(alias = "redshift")]
            Redshift,
            #[serde(alias = "databricks")]
            Databricks,
            #[serde(alias = "spark")]
            Spark,
        }
    };
    proc_macro::TokenStream::from(expanded)
}

/// This macro generates a struct for `Model`
/// If python_binding is true, it will generate a `pyclass` attribute
#[proc_macro]
pub fn model(python_binding: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(python_binding as LitBool);
    let python_binding = if input.value {
        quote! {
            #[pyclass]
        }
    } else {
        quote! {}
    };

    let expanded = quote! {
        #python_binding
        #[serde_as]
        #[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Hash, Clone)]
        #[serde(rename_all = "camelCase")]
        pub struct Model {
            pub name: String,
            #[serde(default)]
            pub ref_sql: Option<String>,
            #[serde(default)]
            pub base_object: Option<String>,
            #[serde(default, with = "table_reference")]
            pub table_reference: Option<String>,
            pub columns: Vec<Arc<Column>>,
            #[serde(default)]
            pub primary_key: Option<PrimaryKey>,
            #[serde(default, with = "bool_from_int")]
            pub cached: bool,
            #[serde(default)]
            pub refresh_time: Option<String>,
            #[serde(default)]
            pub row_level_access_controls: Vec<Arc<RowLevelAccessControl>>,
            #[serde(default)]
            pub dialect: Option<DataSource>,
        }
    };
    proc_macro::TokenStream::from(expanded)
}

/// This macro generates a struct for `Column`
/// If python_binding is true, it will generate a `pyclass` attribute
#[proc_macro]
pub fn column(python_binding: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(python_binding as LitBool);
    let python_binding = if input.value {
        quote! {
            #[pyclass]
        }
    } else {
        quote! {}
    };

    let expanded = quote! {
        #python_binding
        #[serde_as]
        #[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Hash)]
        #[serde(rename_all = "camelCase")]
        pub struct Column {
            pub name: String,
            pub r#type: String,
            #[serde(default)]
            pub relationship: Option<String>,
            #[serde(default, with = "bool_from_int")]
            pub is_calculated: bool,
            #[serde(default, with = "bool_from_int")]
            pub not_null: bool,
            #[serde_as(as = "NoneAsEmptyString")]
            #[serde(default)]
            pub expression: Option<String>,
            #[serde(default, with = "bool_from_int")]
            pub is_hidden: bool,
            pub column_level_access_control: Option<Arc<ColumnLevelAccessControl>>,
        }
    };
    proc_macro::TokenStream::from(expanded)
}

/// This macro generates a struct for `Relationship`
/// If python_binding is true, it will generate a `pyclass` attribute
#[proc_macro]
pub fn relationship(python_binding: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(python_binding as LitBool);
    let python_binding = if input.value {
        quote! {
            #[pyclass]
        }
    } else {
        quote! {}
    };

    let expanded = quote! {
        #python_binding
        #[serde_as]
        #[derive(Serialize, Deserialize, Debug, Hash, PartialEq, Eq)]
        #[serde(rename_all = "camelCase")]
        pub struct Relationship {
            pub name: String,
            pub models: Vec<String>,
            pub join_type: JoinType,
            pub condition: String,
        }
    };
    proc_macro::TokenStream::from(expanded)
}

/// This macro generates an enum for `JoinType`
/// If python_binding is true, it will generate a `pyclass` attribute
#[proc_macro]
pub fn join_type(python_binding: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(python_binding as LitBool);
    let python_binding = if input.va
```

### Core Architecture Module: `core/wren-core-base/src/lib.rs`
```
pub mod mdl;

```

### Core Architecture Module: `core/wren-core-base/src/mdl/cls.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
use crate::mdl::manifest::{ColumnLevelAccessControl, NormalizedExpr, NormalizedExprType};
use crate::mdl::ColumnLevelOperator;
use std::fmt::{Display, Formatter};
use std::str::FromStr;

impl ColumnLevelAccessControl {
    /// Evaluate the input against the column level access control.
    /// If the type of the input is different from the type of the value, the result is always false except for NOT_EQUALS.
    pub fn eval(&self, input: &str) -> bool {
        let input_expr = NormalizedExpr::new(input);
        match self.operator {
            ColumnLevelOperator::Equals => input_expr.eq(&self.threshold),
            ColumnLevelOperator::NotEquals => input_expr.neq(&self.threshold),
            ColumnLevelOperator::GreaterThan => input_expr.gt(&self.threshold),
            ColumnLevelOperator::LessThan => input_expr.lt(&self.threshold),
            ColumnLevelOperator::GreaterThanOrEquals => input_expr.gte(&self.threshold),
            ColumnLevelOperator::LessThanOrEquals => input_expr.lte(&self.threshold),
        }
    }
}

impl NormalizedExpr {
    pub fn new(expr: &str) -> Self {
        assert!(!expr.is_empty(), "expr is null or empty");

        if Self::is_string(expr) {
            NormalizedExpr {
                value: expr[1..expr.len() - 1].to_string(),
                data_type: NormalizedExprType::String,
            }
        } else {
            NormalizedExpr {
                value: expr.to_string(),
                data_type: NormalizedExprType::Numeric,
            }
        }
    }

    fn is_string(expr: &str) -> bool {
        expr.starts_with("'") && expr.ends_with("'")
    }

    fn eq(&self, other: &Self) -> bool {
        if self.data_type != other.data_type {
            return false;
        }
        self.value == other.value
    }

    fn neq(&self, other: &Self) -> bool {
        !self.eq(other)
    }

    fn gt(&self, other: &Self) -> bool {
        if self.data_type != other.data_type {
            return false;
        }
        match self.data_type {
            NormalizedExprType::String => self.value > other.value,
            NormalizedExprType::Numeric => {
                self.value.parse::<f64>().unwrap() > other.value.parse::<f64>().unwrap()
            }
        }
    }

    fn lt(&self, other: &Self) -> bool {
        if self.data_type != other.data_type {
            return false;
        }
        match self.data_type {
            NormalizedExprType::String => self.value < other.value,
            NormalizedExprType::Numeric => {
                self.value.parse::<f64>().unwrap() < other.value.parse::<f64>().unwrap()
            }
        }
    }

    fn gte(&self, other: &Self) -> bool {
        self.gt(other) || self.eq(other)
    }

    fn lte(&self, other: &Self) -> bool {
        self.lt(other) || self.eq(other)
    }
}

impl Display for NormalizedExpr {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self.data_type {
            NormalizedExprType::String => write!(f, "'{}'", self.value),
            NormalizedExprType::Numeric => write!(f, "{}", self.value),
        }
    }
}

impl FromStr for NormalizedExpr {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(NormalizedExpr::new(s))
    }
}

#[cfg(test)]
mod test {
    use crate::mdl::manifest::ColumnLevelAccessControl;
    use crate::mdl::{ColumnLevelOperator, NormalizedExpr, SessionProperty};

    #[test]
    #[should_panic(expected = "expr is null or empty")]
    fn test_normalized_expr_with_empty_str() {
        NormalizedExpr::new("");
    }

    fn clac(operator: ColumnLevelOperator, threshold: &str) -> ColumnLevelAccessControl {
        ColumnLevelAccessControl {
            name: "test".to_string(),
            required_properties: vec![SessionProperty::new("p".to_string(), true, None)],
            operator,
            threshold: NormalizedExpr::new(threshold),
        }
    }

    #[test]
    fn test_clac_eval_numeric() {
        assert!(clac(ColumnLevelOperator::Equals, "1").eval("1"));
        assert!(clac(ColumnLevelOperator::NotEquals, "1").eval("2"));
        assert!(clac(ColumnLevelOperator::GreaterThan, "1").eval("2"));
        assert!(clac(ColumnLevelOperator::LessThan, "1").eval("-1"));
        assert!(clac(ColumnLevelOperator::GreaterThanOrEquals, "1").eval("1"));
        assert!(clac(ColumnLevelOperator::LessThanOrEquals, "1").eval("1"));
    }

    #[test]
    fn test_clac_eval_string() {
        assert!(clac(ColumnLevelOperator::Equals, "'b'").eval("'b'"));
        assert!(clac(ColumnLevelOperator::NotEquals, "'b'").eval("'B'"));
        assert!(clac(ColumnLevelOperator::GreaterThan, "'b'").eval("'c'"));
        assert!(clac(ColumnLevelOperator::LessThan, "'b'").eval("'a'"));
        assert!(clac(ColumnLevelOperator::GreaterThanOrEquals, "'b'").eval("'b'"));
        assert!(clac(ColumnLevelOperator::LessThanOrEquals, "'b'").eval("'b'"));
    }

    #[test]
    fn test_clac_eval_type_mismatch() {
        // mismatched types: always false except NotEquals
        assert!(!clac(ColumnLevelOperator::Equals, "1").eval("'1'"));
        assert!(clac(ColumnLevelOperator::NotEquals, "1").eval("'1'"));
        assert!(!clac(ColumnLevelOperator::GreaterThan, "1").eval("'1'"));
        assert!(!clac(ColumnLevelOperator::LessThan, "1").eval("'1'"));
        assert!(!clac(ColumnLevelOperator::GreaterThanOrEquals, "1").eval("'1'"));
        assert!(!clac(ColumnLevelOperator::LessThanOrEquals, "1").eval("'1'"));
    }
}

```

### Core Architecture Module: `core/wren-core-base/src/mdl/manifest.rs`
```
use std::error::Error;
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
use std::fmt::Display;
use std::str::FromStr;
use std::sync::Arc;

#[cfg(not(feature = "python-binding"))]
mod manifest_impl {
    use crate::mdl::manifest::bool_from_int;
    use crate::mdl::manifest::table_reference;
    use crate::mdl::manifest::PrimaryKey;
    use manifest_macro::{
        column, column_level_access_control, column_level_operator, cube, cube_dimension,
        data_source, join_type, manifest, measure, model, normalized_expr, normalized_expr_type,
        relationship, row_level_access_control, session_property, time_dimension, view,
    };
    use serde::{Deserialize, Serialize};
    use serde_with::serde_as;
    use serde_with::DeserializeFromStr;
    use serde_with::NoneAsEmptyString;
    use serde_with::SerializeDisplay;
    use std::sync::Arc;
    manifest!(false);
    data_source!(false);
    model!(false);
    column!(false);
    relationship!(false);
    view!(false);
    join_type!(false);
    measure!(false);
    cube_dimension!(false);
    time_dimension!(false);
    cube!(false);
    row_level_access_control!(false);
    column_level_access_control!(false);
    session_property!(false);
    normalized_expr!(false);
    normalized_expr_type!(false);
    column_level_operator!(false);
}

#[cfg(feature = "python-binding")]
mod manifest_impl {
    use crate::mdl::manifest::bool_from_int;
    use crate::mdl::manifest::table_reference;
    use crate::mdl::manifest::PrimaryKey;
    use manifest_macro::{
        column, column_level_access_control, column_level_operator, cube, cube_dimension,
        data_source, join_type, manifest, measure, model, normalized_expr, normalized_expr_type,
        relationship, row_level_access_control, session_property, time_dimension, view,
    };
    use pyo3::pyclass;
    use serde::{Deserialize, Serialize};
    use serde_with::serde_as;
    use serde_with::DeserializeFromStr;
    use serde_with::NoneAsEmptyString;
    use serde_with::SerializeDisplay;
    use std::sync::Arc;

    data_source!(true);
    model!(true);
    column!(true);
    relationship!(true);
    view!(true);
    join_type!(true);
    measure!(true);
    cube_dimension!(true);
    time_dimension!(true);
    cube!(true);
    manifest!(true);
    row_level_access_control!(true);
    column_level_access_control!(true);
    session_property!(true);
    normalized_expr!(true);
    normalized_expr_type!(true);
    column_level_operator!(true);
}

pub use crate::mdl::manifest::manifest_impl::*;

/// The primary key of a [Model]. A model may declare either a single column
/// (`"primaryKey": "id"`) or a composite key (`"primaryKey": ["a", "b"]`).
/// The `#[serde(untagged)]` representation keeps the legacy single-string form
/// fully backward compatible.
#[derive(serde::Serialize, serde::Deserialize, Debug, PartialEq, Eq, Hash, Clone)]
#[serde(untagged)]
pub enum PrimaryKey {
    Single(String),
    Composite(Vec<String>),
}

impl PrimaryKey {
    /// All primary key columns in declaration order.
    pub fn columns(&self) -> Vec<&str> {
        match self {
            PrimaryKey::Single(s) => vec![s.as_str()],
            PrimaryKey::Composite(v) => v.iter().map(String::as_str).collect(),
        }
    }
}

pub const MAX_SUPPORTED_LAYOUT_VERSION: u32 = 4;

impl Manifest {
    pub fn validate_layout_version(&self) -> Result<(), LayoutVersionError> {
        if self.layout_version > MAX_SUPPORTED_LAYOUT_VERSION {
            Err(LayoutVersionError {
                manifest_version: self.layout_version,
                max_supported: MAX_SUPPORTED_LAYOUT_VERSION,
            })
        } else {
            Ok(())
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LayoutVersionError {
    pub manifest_version: u32,
    pub max_supported: u32,
}

impl Display for LayoutVersionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "This manifest requires layout version {}, but this engine only supports up to {}",
            self.manifest_version, self.max_supported
        )
    }
}

impl Error for LayoutVersionError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedDataSourceError {
    pub message: String,
}

impl ParsedDataSourceError {
    pub fn new(msg: &str) -> ParsedDataSourceError {
        ParsedDataSourceError {
            message: msg.to_string(),
        }
    }
}

impl Display for ParsedDataSourceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ParsedDataSourceError: {}", self.message)
    }
}

impl Error for ParsedDataSourceError {
    #[allow(deprecated)]
    fn description(&self) -> &str {
        &self.message
    }
}

impl Display for DataSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DataSource::BigQuery => write!(f, "BIGQUERY"),
            DataSource::Clickhouse => write!(f, "CLICKHOUSE"),
            DataSource::Canner => write!(f, "CANNER"),
            DataSource::Trino => write!(f, "TRINO"),
            DataSource::MSSQL => write!(f, "MSSQL"),
            DataSource::MySQL => write!(f, "MYSQL"),
            DataSource::Doris => write!(f, "DORIS"),
            DataSource::Postgres => write!(f, "POSTGRES"),
            DataSource::Snowflake => write!(f, "SNOWFLAKE"),
            DataSource::Datafusion => write!(f, "DATAFUSION"),
            DataSource::DuckDB => write!(f, "DUCKDB"),
            DataSource::LocalFile => write!(f, "LOCAL_FILE"),
            DataSource::S3File => write!(f, "S3_FILE"),
            DataSource::GcsFile => write!(f, "GCS_FILE"),
            DataSource::MinioFile => write!(f, "MINIO_FILE"),
            DataSource::Oracle => write!(f, "ORACLE"),
            DataSource::Athena => write!(f, "ATHENA"),
            DataSource::Redshift => write!(f, "REDSHIFT"),
            DataSource::Databricks => write!(f, "DATABRICKS"),
            DataSource::Spark => write!(f, "SPARK"),
        }
    }
}

impl FromStr for DataSource {
    type Err = ParsedDataSourceError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "BIGQUERY" => Ok(DataSource::BigQuery),
            "CLICKHOUSE" => Ok(DataSource::Clickhouse),
            "CANNER" => Ok(DataSource::Canner),
            "TRINO" => Ok(DataSource::Trino),
            "MSSQL" => Ok(DataSource::MSSQL),
            "MYSQL" => Ok(DataSource::MySQL),
            "DORIS" => Ok(DataSource::Doris),
            "POSTGRES" => Ok(DataSource::Postgres),
            "SNOWFLAKE" => Ok(DataSource::Snowflake),
            "DATAFUSION" => Ok(DataSource::Datafusion),
            "DUCKDB" => Ok(DataSource::DuckDB),
            "LOCAL_FILE" => Ok(DataSource::LocalFile),
            "S3_FILE" => Ok(DataSource::S3File),
            "GCS_FILE" => Ok(DataSource::GcsFile),
            "MINIO_FILE" => Ok(DataSource::MinioFile),
            "ORACLE" => Ok(DataSource::Oracle),
            "ATHENA" => Ok(DataSource::Athena),
            "REDSHIFT" => Ok(DataSource::Redshift),
            "DATABRICKS" => Ok(DataSource::Databricks),
            "SPARK" => Ok(DataSource::Spark),
            _
```

### Core Architecture Module: `core/wren-core-base/src/mdl/migration.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

use crate::mdl::manifest::MAX_SUPPORTED_LAYOUT_VERSION;
use serde_json::Value;
use std::fmt;

#[derive(Debug)]
pub enum MigrationError {
    Json(serde_json::Error),
    UnsupportedTargetVersion { target: u32, max: u32 },
}

impl fmt::Display for MigrationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MigrationError::Json(e) => write!(f, "JSON error during migration: {e}"),
            MigrationError::UnsupportedTargetVersion { target, max } => write!(
                f,
                "Cannot migrate to layout version {target}: maximum supported version is {max}"
            ),
        }
    }
}

impl std::error::Error for MigrationError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            MigrationError::Json(e) => Some(e),
            MigrationError::UnsupportedTargetVersion { .. } => None,
        }
    }
}

impl From<serde_json::Error> for MigrationError {
    fn from(e: serde_json::Error) -> Self {
        MigrationError::Json(e)
    }
}

/// Migrate a manifest JSON string to the specified target layout version.
///
/// Applies migration steps sequentially (1→2, 2→3, ...).
/// Returns the input unchanged if already at or above the target version.
pub fn migrate_manifest(
    manifest_json: &str,
    target_version: u32,
) -> Result<String, MigrationError> {
    if target_version > MAX_SUPPORTED_LAYOUT_VERSION {
        return Err(MigrationError::UnsupportedTargetVersion {
            target: target_version,
            max: MAX_SUPPORTED_LAYOUT_VERSION,
        });
    }

    let mut value: Value = serde_json::from_str(manifest_json)?;
    let current = value
        .get("layoutVersion")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as u32;

    if current >= target_version {
        return Ok(manifest_json.to_string());
    }

    for version in current..target_version {
        match version {
            1 => migrate_v1_to_v2(&mut value),
            2 => migrate_v2_to_v3(&mut value),
            3 => migrate_v3_to_v4(&mut value),
            _ => {
                return Err(MigrationError::UnsupportedTargetVersion {
                    target: target_version,
                    max: MAX_SUPPORTED_LAYOUT_VERSION,
                });
            }
        }
    }

    value["layoutVersion"] = serde_json::json!(target_version);
    Ok(serde_json::to_string(&value)?)
}

/// v1→v2: No data transformation needed.
/// The `dialect` field on Model and View is optional and defaults to null.
fn migrate_v1_to_v2(_value: &mut Value) {
    // No-op: `dialect` is Option<DataSource> with serde(default),
    // so existing manifests deserialize correctly without changes.
}

/// v2→v3: No data transformation needed.
/// `primaryKey` accepts a composite array in addition to a single string;
/// existing single-string primary keys remain valid.
fn migrate_v2_to_v3(_value: &mut Value) {
    // No-op: `primaryKey` is an untagged `string | array` enum, so existing
    // single-column manifests deserialize correctly without changes.
}

/// v3→v4: No data transformation needed.
/// Adds optional annotation fields (manifest-level `description` + `properties`,
/// `model.uniqueKeys`, and `description` + `properties` on cube
/// measure/cubeDimension/timeDimension) and widens `column.properties` value
/// types to match model/relationship/view.
fn migrate_v3_to_v4(_value: &mut Value) {
    // No-op: every v4 change is an additive optional field (or a validation
    // widening), so existing manifests deserialize and validate unchanged.
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrate_v1_to_v2() {
        let v1_json = r#"{"catalog":"wren","schema":"public","models":[]}"#;
        let result = migrate_manifest(v1_json, 2).unwrap();
        let value: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(value["layoutVersion"], 2);
    }

    #[test]
    fn test_migrate_v2_to_v3() {
        let v2_json = r#"{"layoutVersion":2,"catalog":"wren","schema":"public","models":[]}"#;
        let result = migrate_manifest(v2_json, 3).unwrap();
        let value: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(value["layoutVersion"], 3);
    }

    #[test]
    fn test_migrate_v3_to_v4() {
        let v3_json = r#"{"layoutVersion":3,"catalog":"wren","schema":"public","models":[]}"#;
        let result = migrate_manifest(v3_json, 4).unwrap();
        let value: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(value["layoutVersion"], 4);
    }

    #[test]
    fn test_migrate_v1_to_v3_preserves_composite_pk() {
        let v1_json = r#"{"catalog":"wren","schema":"public","models":[{"name":"partsupp","columns":[],"primaryKey":["ps_partkey","ps_suppkey"]}]}"#;
        let result = migrate_manifest(v1_json, 3).unwrap();
        let value: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(value["layoutVersion"], 3);
        assert_eq!(
            value["models"][0]["primaryKey"],
            serde_json::json!(["ps_partkey", "ps_suppkey"])
        );
    }

    #[test]
    fn test_migrate_already_at_target() {
        let v2_json = r#"{"layoutVersion":2,"catalog":"wren","schema":"public","models":[]}"#;
        let result = migrate_manifest(v2_json, 2).unwrap();
        assert_eq!(result, v2_json);
    }

    #[test]
    fn test_migrate_above_target() {
        let v2_json = r#"{"layoutVersion":2,"catalog":"wren","schema":"public","models":[]}"#;
        let result = migrate_manifest(v2_json, 1).unwrap();
        assert_eq!(result, v2_json);
    }

    #[test]
    fn test_migrate_unsupported_target() {
        let v1_json = r#"{"catalog":"wren","schema":"public","models":[]}"#;
        let result = migrate_manifest(v1_json, 99);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("99"));
    }

    #[test]
    fn test_migrate_idempotent() {
        let v1_json = r#"{"catalog":"wren","schema":"public","models":[]}"#;
        let first = migrate_manifest(v1_json, 2).unwrap();
        let second = migrate_manifest(&first, 2).unwrap();
        assert_eq!(first, second);
    }

    #[test]
    fn test_migrate_preserves_existing_fields() {
        let v1_json = r#"{"catalog":"test","schema":"myschema","models":[{"name":"m1","columns":[],"tableReference":null}],"dataSource":"BIGQUERY"}"#;
        let result = migrate_manifest(v1_json, 2).unwrap();
        let value: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(value["catalog"], "test");
        assert_eq!(value["schema"], "myschema");
        assert_eq!(value["dataSource"], "BIGQUERY");
        assert_eq!(value["models"][0]["name"], "m1");
        assert_eq!(value["layoutVersion"], 2);
    }

    #[test]
    fn test_migrate_invalid_json() {
        let result = migrate_manifest("not json", 2);
        assert!(result.is_err());
    }
}

```

### Core Architecture Module: `core/wren-core-base/src/mdl/mod.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

pub mod builder;
pub mod cls;
pub mod manifest;
pub mod migration;
mod py_method;
mod utils;

pub use builder::*;
pub use manifest::*;

```

### Core Architecture Module: `core/wren-core-base/src/mdl/py_method.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

#[cfg(feature = "python-binding")]
mod manifest_python_impl {
    use crate::mdl::manifest::{
        Cube, CubeDimension, Manifest, Measure, Model, RowLevelAccessControl, SessionProperty,
        TimeDimension,
    };
    use crate::mdl::DataSource;
    use pyo3::{pymethods, PyResult};
    use std::sync::Arc;

    #[pymethods]
    impl Manifest {
        #[getter]
        fn layout_version(&self) -> PyResult<u32> {
            Ok(self.layout_version)
        }

        #[getter]
        fn catalog(&self) -> PyResult<String> {
            Ok(self.catalog.clone())
        }

        #[getter]
        fn schema(&self) -> PyResult<String> {
            Ok(self.schema.clone())
        }

        #[getter]
        fn models(&self) -> PyResult<Vec<Model>> {
            Ok(self
                .models
                .iter()
                .map(|m| Arc::unwrap_or_clone(Arc::clone(m)))
                .collect())
        }

        #[getter]
        fn cubes(&self) -> PyResult<Vec<Cube>> {
            Ok(self
                .cubes
                .iter()
                .map(|c| Arc::unwrap_or_clone(Arc::clone(c)))
                .collect())
        }

        #[getter]
        fn data_source(&self) -> PyResult<Option<DataSource>> {
            Ok(self.data_source)
        }

        fn get_model(&self, name: &str) -> PyResult<Option<Model>> {
            let model = self
                .models
                .iter()
                .find(|m| m.name == name)
                .cloned()
                .map(Arc::unwrap_or_clone);
            Ok(model)
        }

        fn get_cube(&self, name: &str) -> PyResult<Option<Cube>> {
            let cube = self
                .cubes
                .iter()
                .find(|c| c.name == name)
                .cloned()
                .map(Arc::unwrap_or_clone);
            Ok(cube)
        }
    }

    #[pymethods]
    impl Cube {
        #[getter]
        fn get_name(&self) -> PyResult<String> {
            Ok(self.name.clone())
        }

        #[getter]
        fn base_object(&self) -> PyResult<String> {
            Ok(self.base_object.clone())
        }

        #[getter]
        fn measures(&self) -> PyResult<Vec<Measure>> {
            Ok(self
                .measures
                .iter()
                .map(|m| Arc::unwrap_or_clone(Arc::clone(m)))
                .collect())
        }

        #[getter]
        fn dimensions(&self) -> PyResult<Vec<CubeDimension>> {
            Ok(self
                .dimensions
                .iter()
                .map(|d| Arc::unwrap_or_clone(Arc::clone(d)))
                .collect())
        }

        #[getter]
        fn time_dimensions(&self) -> PyResult<Vec<TimeDimension>> {
            Ok(self
                .time_dimensions
                .iter()
                .map(|td| Arc::unwrap_or_clone(Arc::clone(td)))
                .collect())
        }

        #[getter]
        fn hierarchies(&self) -> PyResult<std::collections::BTreeMap<String, Vec<String>>> {
            Ok(self.hierarchies.clone())
        }
    }

    #[pymethods]
    impl Measure {
        #[getter]
        fn get_name(&self) -> PyResult<String> {
            Ok(self.name.clone())
        }

        #[getter]
        fn expression(&self) -> PyResult<String> {
            Ok(self.expression.clone())
        }

        #[getter]
        fn r#type(&self) -> PyResult<String> {
            Ok(self.r#type.clone())
        }
    }

    #[pymethods]
    impl CubeDimension {
        #[getter]
        fn get_name(&self) -> PyResult<String> {
            Ok(self.name.clone())
        }

        #[getter]
        fn expression(&self) -> PyResult<String> {
            Ok(self.expression.clone())
        }

        #[getter]
        fn r#type(&self) -> PyResult<String> {
            Ok(self.r#type.clone())
        }
    }

    #[pymethods]
    impl TimeDimension {
        #[getter]
        fn get_name(&self) -> PyResult<String> {
            Ok(self.name.clone())
        }

        #[getter]
        fn expression(&self) -> PyResult<String> {
            Ok(self.expression.clone())
        }

        #[getter]
        fn r#type(&self) -> PyResult<String> {
            Ok(self.r#type.clone())
        }
    }

    #[pymethods]
    impl Model {
        #[getter]
        fn get_name(&self) -> PyResult<String> {
            Ok(self.name.clone())
        }
    }

    #[pymethods]
    impl SessionProperty {
        #[new]
        #[pyo3(signature = (name, required = false, default_expr = None))]
        pub fn new(name: String, required: bool, default_expr: Option<String>) -> Self {
            Self {
                normalized_name: name.to_lowercase(),
                name,
                required,
                default_expr,
            }
        }
    }

    #[pymethods]
    impl RowLevelAccessControl {
        #[new]
        #[pyo3(signature = (name, condition, required_properties = vec![]))]
        fn new(name: String, condition: String, required_properties: Vec<SessionProperty>) -> Self {
            Self {
                name,
                condition,
                required_properties,
            }
        }
    }
}

```

### Core Architecture Module: `core/wren-core-base/src/mdl/utils.rs`
```
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

use std::borrow::Cow;

use sqlparser::{ast::Ident, dialect::GenericDialect, parser::Parser};

pub(crate) fn parse_identifiers(s: &str) -> Result<Vec<Ident>, sqlparser::parser::ParserError> {
    let dialect = GenericDialect;
    let mut parser = Parser::new(&dialect).try_with_sql(s)?;
    let idents = parser.parse_multipart_identifier()?;
    Ok(idents)
}

pub(crate) fn parse_identifiers_normalized(
    s: &str,
    ignore_case: bool,
) -> Result<Vec<String>, sqlparser::parser::ParserError> {
    parse_identifiers(s).map(|v| {
        v.into_iter()
            .map(|id| match id.quote_style {
                Some(_) => id.value,
                None if ignore_case => id.value,
                _ => id.value.to_ascii_lowercase(),
            })
            .collect::<Vec<_>>()
    })
}

pub fn quote_identifier(s: &str) -> Cow<'_, str> {
    if needs_quotes(s) {
        Cow::Owned(format!("\"{}\"", s.replace('"', "\"\"")))
    } else {
        Cow::Borrowed(s)
    }
}

/// returns true if this identifier needs quotes
fn needs_quotes(s: &str) -> bool {
    let mut chars = s.chars();

    // first char can not be a number unless escaped
    if let Some(first_char) = chars.next() {
        if !(first_char.is_ascii_lowercase() || first_char == '_') {
            return true;
        }
    }

    !chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2763** (2026-09-30): **[Bug] Agent SDKs decode UTF-8 project files with locale encoding on Windows**
  *Symptoms*: ## What happened  wren-langchain and wren-pydantic read target/mdl.json and instructions.md without specifying a text encoding. Python therefore uses the machine's locale encoding.  On a Windows installation where locale.getencoding() returns cp936, UTF-8 model names and project instructions can be decoded into different, still-valid Unicode text. The read succeeds, so there is no exception to point to; the SDK continues with corrupted model names or instructions.  Both SDKs contain the same two locale-dependent reads:  - ProjectMDLSource.load_manifest() reads target/mdl.json. - system_prompt() in wren-langchain, and instructions() in wren-pydantic, read instructions.md.  ## Reproduction  Environment:  - Windows - Python 3.12 - Current main at 90bad8d2 - wren-langchain 0.2.2 / wren-pydantic 0.3.0 - UTF-8 mode disabled - locale.getencoding() returns cp936  ~~~python import json import locale from pathlib import Path  from wren_langchain._providers.mdl_source import ProjectMDLSource  project = Path("encoding-repro") target = project / "target" target.mkdir(parents=True, exist_ok=True)  manifest = {"models": [{"name": "订单📈 café"}]} (target / "mdl.json").write_bytes(     json.dumps(manifest, ensure_ascii=False).encode("utf-8") )  print(locale.getencoding()) print(ProjectMDLSource(project_path=project).load_manifest()) ~~~  Actual output:  ~~~text cp936 {'models': [{'name': '璁㈠崟馃搱 caf茅'}]} ~~~  Expected output:  ~~~text cp936 {'models': [{'name': '订单📈 café'}]} ~~~  Using wren_py

- **Issue #2761** (2026-09-29): **[Bug] transform_sql corrupts string literals containing the MDL catalog/schema prefix**
  *Symptoms*: **Describe the bug**  SessionContext.transform_sql() removes the MDL catalog/schema prefix from string literals when the same text appears in a query.  For an MDL whose catalog is my_catalog and schema is my_schema, the transformer should remove my_catalog.my_schema. from generated table references. It currently removes every occurrence of that text from the serialized SQL, including values and patterns inside expressions.  No exception is raised. The returned SQL is valid, but its meaning has changed.  **To reproduce**  Reproduced with wren-core-py==0.8.0:  ~~~python import base64 import json  from wren_core import SessionContext  manifest = {     "catalog": "my_catalog",     "schema": "my_schema",     "models": [         {             "name": "customer",             "tableReference": {                 "catalog": "",                 "schema": "",                 "table": "customer",             },             "columns": [                 {"name": "c_custkey", "type": "integer"},                 {"name": "c_name", "type": "varchar"},             ],             "primaryKey": "c_custkey",         }     ], }  encoded_manifest = base64.b64encode(     json.dumps(manifest).encode("utf-8") ).decode("utf-8")  ctx = SessionContext(encoded_manifest, None)  sql = """ SELECT     'my_catalog.my_schema.keep' AS marker,     CASE         WHEN c_name LIKE 'my_catalog.my_schema.%'         THEN 'my_catalog.my_schema.match'         ELSE 'my_catalog.my_schema.miss'     END AS category,     c_cust

- **Issue #2669** (2026-08-31): **Bug: PostgresConnector never rolls back after a failed query, poisoning the shared connection for the rest of the process**
  *Symptoms*: ## Bug: PostgresConnector never rolls back after a failed query, poisoning the shared connection for the rest of the process  ### Summary  `wren/connector/postgres.py` opens a single, long-lived `psycopg` connection per `PostgresConnector` instance and never calls `.rollback()` after a failed query. Since `WrenEngine._get_connector()` caches this connector for the engine's lifetime, and `ServeContext.engine` in the MCP server is a single instance shared across the whole server process, **one failing query from any client leaves the shared Postgres connection in an aborted-transaction state for every subsequent query from every client**, until the process is restarted.  ### Version  `wrenai[postgres]==0.13.2` (latest on PyPI at time of filing)  ### Where  - `wren/connector/postgres.py` — `PostgresConnector.__init__` creates one `psycopg.connect(...)` and stores it as `self.connection`. `query()` and `dry_run()` catch exceptions and re-raise as `WrenError`, but never call `self.connection.rollback()`. - `wren/engine.py` — `_get_connector()` caches the connector: `if self._connector is None: self._connector = get_connector(...)`, reused for the lifetime of the `WrenEngine` instance. - `wren/mcp_server.py` — `ServeContext` is documented in-code as "Shared state captured once at startup and used by every tool handler", i.e. one `Engine`/connector for the whole MCP server process.  ### Steps to reproduce  1. Start `wren serve mcp` against a Postgres data source. 2. Call `run_sql` (
  **Post-Mortem & Fix Analysis**:
  > Test trought Claude Code:  ❯ Run this SQL exactly:   SELECT definitely_missing_column FROM bank_transactions;    Called wren  That query failed as expected — definitely_missing_column doesn't exist on bank_transactions. The error came back as:  [GENERIC_USER_ERROR] current transaction is aborted, commands ignored until end of transaction block phase=SQL_EXECUTION  That's a Postgres-style "transaction aborted" message rather than a clean "column does not exist" — it suggests the connection is a shared/pooled session that's now sitting in a broken transaction state (likely left over from the invalid query, and other queries on this same connection may fail until it resets). Let me know if you want me to retry a valid query to confirm the session has recovered.  ✻ Cooked for 11s  ❯ Run this SQL exactly:   SELECT COUNT(*) AS count FROM bank_transactions;Called wrenConfirmed — the session is stuck. This valid, simplrror:[GENERIC_USER_ERROR] current transaction is abortedof transaction block
  > **Confirmed workaround**  Tested this on our end and it resolves the issue: setting `autocommit=True` on the connection avoids the poisoned-transaction state entirely. Since this connector is read-only (`run_sql` / `dry_run` / `query_cube` are all `readOnlyHint=True`), there's no multi-statement transaction to preserve, so autocommit is safe here.  We're patching it at Docker build time (patching the installed `wren/connector/postgres.py` after `pip install`) until this lands upstream:  ```python import wren.connector.postgres as m from pathlib import Path  path = Path(m.__file__) text = path.read_text()  old = "        self._closed = False" new = "        self.connection.autocommit = True\n        self._closed = False"  if old not in text:     raise RuntimeError("Could not patch Wren Postgres connector: anchor line not found") text = text.replace(old, new, 1) path.write_text(text) ```  Verified with: 1. `SELECT nonexistent_column FROM some_table` → fails as expected 2. `SELECT COUNT(*
  > Reproduced the same mechanism independently; confirming your read and adding three observations that narrow where the fix has to live.  > NOTE: AGENT GENERATED FEEDBACK!   **1. The poison is confined to the `SQL_EXECUTION` phase.** Planning-phase failures leave the connection healthy; only execution-stage errors abort the transaction. Step-isolated with a fresh MCP session per probe:  ``` SELECT 1                        -> ok SELECT * FROM no_such_table     -> [INVALID_SQL]  phase=SQL_PLANNING, connection healthy SELECT 2                        -> ok SELECT 1/0                      -> GENERIC_USER_ERROR  phase=SQL_EXECUTION SELECT 3                        -> "current transaction is aborted"  (poisoned) ```  **2. The defensive tool is a vector too.** `dry_run` executes on the backend and poisons exactly like `run_sql`; only `dry_plan` (pure MDL expansion, no connection) is safe. So the recommended "validate, then execute" agent pattern kills the server from the validation step, before a

- **Issue #2658** (2026-09-24): **[Bug] Relationship traversal fails when handle name differs from related model name**
  *Symptoms*: **Describe the bug**  `wren_core.SessionContext.transform_sql()` cannot resolve a relationship path when the relationship-handle column name differs from the related model name.  For example, this documented-style relationship handle fails:  ```yaml - name: customer   type: customers   relationship: orders_customers ```  A query referencing:  ```sql orders.customer.name ```  raises a schema error listing only the scalar columns of `orders`.  Renaming the relationship handle from `customer` to `customers`, so that its `name` exactly matches its `type`, makes relationship traversal work:  ```yaml - name: customers   type: customers   relationship: orders_customers ```  This appears to be the same root cause previously reported in the now-archived `wren-engine` repository:  https://github.com/Canner/wren-engine/issues/1481  The issue remains reproducible with the current Python packages listed below.  **To Reproduce**  1. Define two models, `orders` and `customers`:  ```yaml # models/orders/metadata.yml  name: orders  table_reference:   schema: public   table: orders  primary_key: order_id  columns:   - name: order_id     type: INTEGER     is_primary_key: true    - name: customer_id     type: INTEGER    - name: amount     type: DECIMAL    - name: customer     type: customers     relationship: orders_customers ```  ```yaml # models/customers/metadata.yml  name: customers  table_reference:   schema: public   table: customers  primary_key: customer_id  columns:   - name: customer_i
  **Post-Mortem & Fix Analysis**:
  > This issue is stale because it has been open for 30 days with no activity.
  > This issue was closed because it has been inactive for 14 days since being marked as stale.

- **Issue #2653** (2026-08-09): **wren-core: a modeled join over a broken FK returns the surviving rows with no row-loss signal**
  *Symptoms*: ### Environment  `wrenai` 0.8.0 (`uv tool install wrenai==0.8.0 --with trino --with "psycopg[binary]"`), embedding `wren_core` 0.6.0 · pyarrow 24.0.0 · ibis 12.0.0. `wren --version` → `wrenai 0.8.0`. Queries run through `wren query -s <sql> -m <mdl.json> --connection-file <conn.json>`; plans inspected with `wren dry-plan`. Backend: PostgreSQL 16.14 <or Trino 480>.  > Found by an automated differential sweep I run across semantic query services: > every query is also re-derived directly against the backend and the two results > compared, which is where the "raw PostgreSQL" values below come from. Happy to > re-run any of it against a fix.   <environment block>  ### What happens  When a modeled relationship's referenced rows are missing, the join drops the dangling fact rows and returns a small, clean-looking result with nothing to indicate how much disappeared.  ### Repro  `fact(id, ref_id)` = {(1,10),(2,10),(3,99)}; `dim(id)` = {10}, so `ref_id = 99` dangles. With the relationship modeled:  ```sql SELECT count(*) FROM fact JOIN dim ON fact.ref_id = dim.id -- observed: 2 of 3 rows, no indication the third was dropped ```  On real data, a modeled-relationship join returned **551 rows of 65,332** (99.2% dropped) as a bare `{"n": 551}`; a second modeled join on the same dataset returned 0 rows. The cause was an ordinary ETL artifact — a truncated reference table.  ### Why it's worth tracking  To be explicit about what is and is not wrong: the engine's result matches what the same
  **Post-Mortem & Fix Analysis**:
  > > **Note.** This reply is generated by the automated differential sweep that > produced the original report, and reviewed before posting. Environment and > method below; every figure is re-derived directly against the backend and the > two results compared.  **Retested:** `wrenai` 0.13.2, backend PostgreSQL 16, 2026-08-08. Queries issued through the MCP surface (`run_sql`), plans inspected with `dry_plan`. **Result: still reproduces.**  Shape of the retest: a join through a single relationship declared `MANY_TO_ONE` in the MDL, where the referenced side is incomplete. 58 of the 98 driving rows survived — 41% dropped — returned as a bare count, with nothing in the response to indicate anything had been lost.  Re-derived directly on the backend, the count matches Wren exactly, as the original report expected it would. The point stands as filed: the result is correct for the join, and the engine is the component best placed to notice how much of the driving table disappeared through a rel

- **Issue #2652** (2026-08-09): **wren-core: multi-path joins inflate additive aggregates with no signal in the response**
  *Symptoms*: ### Environment  `wrenai` 0.8.0 (`uv tool install wrenai==0.8.0 --with trino --with "psycopg[binary]"`), embedding `wren_core` 0.6.0 · pyarrow 24.0.0 · ibis 12.0.0. `wren --version` → `wrenai 0.8.0`. Queries run through `wren query -s <sql> -m <mdl.json> --connection-file <conn.json>`; plans inspected with `wren dry-plan`. Backend: PostgreSQL 16.14 <or Trino 480>.  > Found by an automated differential sweep I run across semantic query > services: every query is also re-derived directly against the backend and the > two results compared, which is where the "raw PostgreSQL" values below come > from. Happy to re-run any of it against a fix.   ### What happens  When a plan traverses two or more independent to-many paths relative to an aggregated measure's grain, the fact rows are multiplied and every additive aggregate follows. The response carries no warning, no fan-out indicator and no cardinality information.  ### Repro  `parent(id)` = {1}; `child_a(parent_id)` = {1,1}; `child_b(parent_id)` = {1,1}; `fact(parent_id, v)` = {(1, 10)}, with the relationships declared in the MDL.  ```sql SELECT sum(f.v) FROM fact f JOIN parent p       ON f.parent_id = p.id LEFT JOIN child_a a ON p.id = a.parent_id LEFT JOIN child_b b ON p.id = b.parent_id -- observed: 40 -- expected: 10   (two independent 1:N paths multiply the fact row four times) ```  On real data, a grouped sum across two side-paths returned `3,965,358.7` where the value re-derived directly on the backend is `6,463.8` — **614×*
  **Post-Mortem & Fix Analysis**:
  > > **Note.** This reply is generated by the automated differential sweep that > produced the original report, and reviewed before posting. Environment and > method below; every figure is re-derived directly against the backend and the > two results compared.  **Retested:** `wrenai` 0.13.2, backend PostgreSQL 16, 2026-08-08. Queries issued through the MCP surface (`run_sql`), plans inspected with `dry_plan`. **Result: still reproduces.**  Shape of the retest: one model with two independent to-many relationships, both declared `MANY_TO_ONE` in the MDL, with an additive measure on one of the two paths. Summing that measure across both paths returned 299.6× the value the same sum returns on the single path. The response carried no warning field, no fan-out indicator and no cardinality information.  Re-derived directly on the backend, the figures match Wren exactly. So this remains what the original report said it was: not a computation error, and the MDL already holds the cardinality that m

- **Issue #2651** (2026-08-10): **wren-cli: PostgreSQL NUMERIC decodes as decimal128(38, 9) and truncates past the 9th decimal**
  *Symptoms*: ### Environment  `wrenai` 0.8.0 (`uv tool install wrenai==0.8.0 --with trino --with "psycopg[binary]"`), embedding `wren_core` 0.6.0 · pyarrow 24.0.0 · ibis 12.0.0. `wren --version` → `wrenai 0.8.0`. Queries run through `wren query -s <sql> -m <mdl.json> --connection-file <conn.json>`; plans inspected with `wren dry-plan`. Backend: PostgreSQL 16.14 <or Trino 480>.  > Found by an automated differential sweep I run across semantic query > services: every query is also re-derived directly against the backend and the > two results compared, which is where the "raw PostgreSQL" values below come > from. Happy to re-run any of it against a fix.   ### What happens  Every numeric decode logs:  ``` wren.connector.postgres:_get_pg_decimal_type:94 - Postgres NUMERIC column has no scale metadata; defaulting to decimal128(38, 9) ```  For an unconstrained PostgreSQL `NUMERIC` there is no scale metadata to read, so a default is necessary — but it is applied with no signal to the caller, and nine decimals is a low ceiling for financial and scientific columns. The values returned are wrong past the 9th decimal and look complete.  ### Repro  ```sql -- <col> is an unconstrained NUMERIC column SELECT variance(<col>), stddev(<col>) FROM <table> -- wren query:      103371.211021663      214.335896570 -- raw PostgreSQL:  103371.211021662817   214.335896569810 ```  Casting inside the query pushes the cast down and returns full precision on the same connection:  ```sql SELECT variance(<col>)::text FRO

- **Issue #2650** (2026-08-08): **wren-core: array subscript is off by one — ARRAY[5,6,7][1] returns 6**
  *Symptoms*: ### Environment  `wrenai` 0.8.0 (`uv tool install wrenai==0.8.0 --with trino --with "psycopg[binary]"`), embedding `wren_core` 0.6.0 · pyarrow 24.0.0 · ibis 12.0.0. `wren --version` → `wrenai 0.8.0`. Queries run through `wren query -s <sql> -m <mdl.json> --connection-file <conn.json>`; plans inspected with `wren dry-plan`. Backend: PostgreSQL 16.14 <or Trino 480>.  > Found by an automated differential sweep I run across semantic query > services: every query is also re-derived directly against the backend and the > two results compared, which is where the "raw PostgreSQL" values below come > from. Happy to re-run any of it against a fix.  ### What happens  A literal array subscript is incremented during the rewrite, so element access returns the *next* element. `[0]` returns the first element, which suggests a 0-based↔1-based conversion applied in the wrong direction.  ### Repro  ```sql SELECT ARRAY[5,6,7][1] AS e1, ARRAY[5,6,7][2] AS e2 -- observed:            e1 = 6, e2 = 7 -- raw PostgreSQL:      e1 = 5, e2 = 6 ```  `wren dry-plan` shows the subscript incremented in the emitted SQL: `[1]` becomes `ARRAY[5, 6, 7][2]`.  ### Why it's worth tracking  The blast radius is narrow, but the query executes successfully and returns a plausible value, so nothing signals that the semantics changed between the query as written and the query as executed. Repro is dataset-independent.  ### Possible directions  1. Correct the conversion at the subscript rewrite site (cheapest — the offset 
  **Post-Mortem & Fix Analysis**:
  > re-verified on the current build, no longer reproduces, closing.

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

### Incident Patch 1: `87b438a0` (2026-09-30)
**Commit Message**: fix(sdk): read project artifacts as UTF-8 (#2764)

Co-authored-by: dafyy321-pixel <dafyy321-pixel@users.noreply.github.com>

**File**: `sdk/wren-langchain/src/wren_langchain/_prompt.py` (modified, +1/-1)
```diff
@@ -218,7 +218,7 @@ def _build_instructions_section(project_path: Path) -> str:
     instructions_file = project_path / "instructions.md"
     if not instructions_file.exists():
         return ""
-    body = instructions_file.read_text().strip()
+    body = instructions_file.read_text(encoding="utf-8").strip()
     if not body:
         return ""
     return f"## Project-specific instructions\n\n{body}"
```

**File**: `sdk/wren-langchain/src/wren_langchain/_providers/mdl_source.py` (modified, +10/-6)
```diff
@@ -27,13 +27,17 @@ def load_manifest(self) -> dict[str, Any]:
                 "Run `wren context build` first."
             )
         try:
-            return json.loads(self._mdl_path.read_text())
-        except json.JSONDecodeError as exc:
-            # Normalize malformed manifest into the common init-error contract
-            # so callers don't need to special-case JSON errors.
+            return json.loads(self._mdl_path.read_text(encoding="utf-8"))
+        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
+            if isinstance(exc, json.JSONDecodeError):
+                detail = (
+                    f"is not valid JSON: {exc.msg} (line {exc.lineno}, col {exc.colno})"
+                )
+            else:
+                detail = "is not encoded as UTF-8"
             raise WrenToolkitInitError(
-                f"target/mdl.json at {self._mdl_path} is not valid JSON: {exc.msg} "
-                f"(line {exc.lineno}, col {exc.colno}). "
+                f"target/mdl.json at {self._mdl_path} {detail}. "
+                "The manifest must be UTF-8 encoded. "
                 "Re-run `wren context build` to regenerate it."
             ) from exc
 
```

**File**: `sdk/wren-langchain/tests/conftest.py` (modified, +13/-0)
```diff
@@ -1,5 +1,6 @@
 """Shared pytest fixtures for wren-langchain tests."""
 
+import io
 import json
 
 import pytest
@@ -32,3 +33,15 @@ def fake_active_profile(monkeypatch):
         "wren_langchain._providers.connection.get_active_profile",
         lambda: ("test", {"datasource": "duckdb", "path": ":memory:"}),
     )
+
+
+@pytest.fixture
+def simulate_cp936_default_encoding(monkeypatch):
+    """Make text reads without an encoding behave like a Windows CP936 locale."""
+
+    def apply():
+        monkeypatch.setattr(
+            io, "text_encoding", lambda encoding, stacklevel=2: encoding or "cp936"
+        )
+
+    return apply
```

**File**: `sdk/wren-langchain/tests/unit/test_prompt.py` (modified, +11/-0)
```diff
@@ -72,6 +72,17 @@ def test_system_prompt_appends_project_instructions_when_present(
     assert "Project-specific instructions" in prompt
 
 
+def test_system_prompt_reads_utf8_instructions_with_non_utf8_locale(
+    tmp_project, fake_active_profile, simulate_cp936_default_encoding
+):
+    project_instructions = "Use the 订单📈 café model for revenue questions."
+    (tmp_project / "instructions.md").write_text(project_instructions, encoding="utf-8")
+    toolkit = WrenToolkit.from_project(tmp_project)
+    simulate_cp936_default_encoding()
+
+    assert project_instructions in toolkit.system_prompt()
+
+
 def test_system_prompt_silently_skips_instructions_when_absent(
     tmp_project, fake_active_profile
 ):
```

**File**: `sdk/wren-langchain/tests/unit/test_providers_mdl.py` (modified, +32/-0)
```diff
@@ -20,6 +20,21 @@ def test_project_mdl_source_reads_target_mdl_json(tmp_path):
     assert source.load_manifest() == manifest
 
 
+def test_project_mdl_source_reads_utf8_with_non_utf8_locale(
+    tmp_path, simulate_cp936_default_encoding
+):
+    target = tmp_path / "target"
+    target.mkdir()
+    manifest = {"models": [{"name": "订单📈 café"}]}
+    (target / "mdl.json").write_text(
+        json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
+    )
+    source = ProjectMDLSource(project_path=tmp_path)
+    simulate_cp936_default_encoding()
+
+    assert source.load_manifest() == manifest
+
+
 def test_project_mdl_source_picks_up_file_changes_between_calls(tmp_path):
     """Subsequent load_manifest() calls reflect on-disk changes (read-through)."""
     target = tmp_path / "target"
@@ -56,3 +71,20 @@ def test_project_mdl_source_normalizes_malformed_json_to_init_error(tmp_path):
 
     with pytest.raises(WrenToolkitInitError, match="not valid JSON"):
         source.load_manifest()
+
+
+def test_project_mdl_source_explains_legacy_cp936_manifest(tmp_path):
+    target = tmp_path / "target"
+    target.mkdir()
+    (target / "mdl.json").write_bytes(
+        json.dumps({"models": [{"name": "订单"}]}, ensure_ascii=False).encode("cp936")
+    )
+
+    source = ProjectMDLSource(project_path=tmp_path)
+
+    with pytest.raises(WrenToolkitInitError) as exc_info:
+        source.load_manifest()
+
+    message = str(exc_info.value)
+    assert "UTF-8" in message
+    assert "wren context build" in message
```

---

### Incident Patch 2: `8d254db2` (2026-09-30)
**Commit Message**: fix(wren): write project files as UTF-8 so init/build work on Windows (#2770)

**File**: `core/wren/src/wren/context.py` (modified, +22/-11)
```diff
@@ -363,7 +363,7 @@ def write_project_files(
 
     for file, target in resolved_files:
         target.parent.mkdir(parents=True, exist_ok=True)
-        target.write_text(file.content)
+        target.write_text(file.content, encoding="utf-8")
 
 
 # ── Project discovery ─────────────────────────────────────────────────────
@@ -456,7 +456,8 @@ def save_project_config(project_path: Path, config: dict) -> None:
     (project_path / PROJECT_FILE).write_text(
         yaml.safe_dump(
             ordered, default_flow_style=False, sort_keys=False, allow_unicode=True
-        )
+        ),
+        encoding="utf-8",
     )
 
 
@@ -939,7 +940,9 @@ def save_target(manifest_json: dict, project_path: Path) -> Path:
     target_dir = project_path / _TARGET_DIR
     target_dir.mkdir(parents=True, exist_ok=True)
     out = target_dir / _TARGET_FILE
-    out.write_text(json.dumps(manifest_json, indent=2, ensure_ascii=False))
+    out.write_text(
+        json.dumps(manifest_json, indent=2, ensure_ascii=False), encoding="utf-8"
+    )
     return out
 
 
@@ -1746,9 +1749,11 @@ def create_knowledge_skeleton(project_path: Path) -> list[str]:
             continue
         dest.parent.mkdir(parents=True, exist_ok=True)
         if rel == _KNOWLEDGE_CONFIG_FILE:
-            dest.write_text(f"schema_version: {_KNOWLEDGE_SCHEMA_VERSION}\n")
+            dest.write_text(
+                f"schema_version: {_KNOWLEDGE_SCHEMA_VERSION}\n", encoding="utf-8"
+            )
         else:
-            dest.write_text("")  # .gitkeep
+            dest.write_text("", encoding="utf-8")  # .gitkeep
         created.append(rel)
     return created
 
@@ -1961,7 +1966,10 @@ def apply_upgrade(project_path: Path, result: UpgradeResult) -> None:
     config["schema_version"] = result.to_version
     config_file = project_path / PROJECT_FILE
     config_file.write_text(
-        yaml.dump(config, default_flow_style=False, sort_keys=False, allow_unicode=True)
+        yaml.dump(
+            config, default_flow_style=False, sort_keys=False, allow_unicode=True
+        ),
+        encoding="utf-8",
     )
 
 
@@ -1981,13 +1989,14 @@ def _apply_v1_to_v2(project_path: Path) -> None:
         ref_sql = model.pop("ref_sql", None)
         if ref_sql:
             _resolve_upgrade_file(model_dir, "ref_sql.sql").write_text(
-                ref_sql.strip() + "\n"
+                ref_sql.strip() + "\n", encoding="utf-8"
             )
 
         _resolve_upgrade_file(model_dir, "metadata.yml").write_text(
             yaml.dump(
                 model, default_flow_style=False, sort_keys=False, allow_unicode=True
-            )
+            ),
+            encoding="utf-8",
         )
 
         # Delete old flat file
@@ -2013,15 +2022,17 @@ def _apply_v1_to_v2(project_path: Path) -> None:
                     default_flow_style=False,
                     sort_keys=False,
                     allow_unicode=True,
-                )
+                ),
+                encoding="utf-8",
             )
         elif statement:
             view["statement"] = statement
 
         _resolve_upgrade_file(view_dir, "metadata.yml").write_text(
             yaml.dump(
                 view, default_flow_style=False, sort_keys=False, allow_unicode=True
-            )
+            ),
+            encoding="utf-8",
         )
 
     # Delete old views.yml
@@ -2045,7 +2056,7 @@ def _apply_v1_to_v2(project_path: Path) -> None:
         cube_dir.mkdir(parents=True, exist_ok=True)
 
         _resolve_upgrade_file(cube_dir, "metadata.yml").write_text(
-            yaml.dump(cube, default_flow_style=False, sort_keys=False)
+            yaml.dump(cube, default_flow_style=False, sort_keys=False), encoding="utf-8"
         )
 
         if source_file:
```

**File**: `core/wren/src/wren/context_cli.py` (modified, +18/-10)
```diff
@@ -283,7 +283,7 @@ def init(
         "\n"
         "data_source: postgres  # change to your datasource type\n"
     )
-    project_file.write_text(project_yml)
+    project_file.write_text(project_yml, encoding="utf-8")
 
     # Empty relationships.yml (shared between empty and full scaffold)
     rels = (
@@ -297,7 +297,7 @@ def init(
         "#     join_type: MANY_TO_ONE\n"
         "#     condition: orders.customer_id = customers.customer_id\n"
     )
-    (project_path / "relationships.yml").write_text(rels)
+    (project_path / "relationships.yml").write_text(rels, encoding="utf-8")
 
     # `wren context build` writes target/mdl.json — compiled output, derived
     # from the YAML beside it. Without this, a project pushed to a git remote
@@ -308,7 +308,8 @@ def init(
     gitignore = project_path / ".gitignore"
     if not gitignore.exists():
         gitignore.write_text(
-            "# Compiled MDL — rebuild with `wren context build`\ntarget/\n"
+            "# Compiled MDL — rebuild with `wren context build`\ntarget/\n",
+            encoding="utf-8",
         )
 
     if not empty:
@@ -337,7 +338,8 @@ def init(
             "    properties: {}\n"
             "primary_key: id\n"
             "cached: false\n"
-            "properties: {}\n"
+            "properties: {}\n",
+            encoding="utf-8",
         )
 
         # Scaffold example view
@@ -347,10 +349,11 @@ def init(
             "# Example view — replace with your actual view\n"
             "name: example_view\n"
             "properties:\n"
-            '  description: "An example view"\n'
+            '  description: "An example view"\n',
+            encoding="utf-8",
         )
         (example_view_dir / "sql.yml").write_text(
-            "statement: >\n  SELECT * FROM example LIMIT 100\n"
+            "statement: >\n  SELECT * FROM example LIMIT 100\n", encoding="utf-8"
         )
 
     # ── knowledge/ skeleton (first-class business context) ──
@@ -364,11 +367,12 @@ def init(
     if force or not general_rules.exists():
         general_rules.write_text(
             "# Business rules\n\n"
-            "Add custom rules or guidelines for LLM-based query generation here.\n"
+            "Add custom rules or guidelines for LLM-based query generation here.\n",
+            encoding="utf-8",
         )
 
     # ── AGENTS.md ──
-    (project_path / "AGENTS.md").write_text(_AGENTS_MD_TEMPLATE)
+    (project_path / "AGENTS.md").write_text(_AGENTS_MD_TEMPLATE, encoding="utf-8")
 
     # NL→SQL pairs live in knowledge/sql/ (written by `wren memory store`),
     # so no queries.yml is scaffolded.
@@ -667,7 +671,9 @@ def build(
     if output:
         out_path = Path(output).expanduser()
         out_path.parent.mkdir(parents=True, exist_ok=True)
-        out_path.write_text(json.dumps(manifest_json, indent=2, ensure_ascii=False))
+        out_path.write_text(
+            json.dumps(manifest_json, indent=2, ensure_ascii=False), encoding="utf-8"
+        )
     else:
         out_path = save_target(manifest_json, project_path)
 
@@ -1115,7 +1121,9 @@ def _build_from_osi(
     else:
         out_path = Path.cwd() / "target" / "mdl.json"
     out_path.parent.mkdir(parents=True, exist_ok=True)
-    out_path.write_text(json.dumps(manifest_json, indent=2, ensure_ascii=False))
+    out_path.write_text(
+        json.dumps(manifest_json, indent=2, ensure_ascii=False), encoding="utf-8"
+    )
 
     n_models = len(manifest_json.get("models", []))
     n_rels = len(manifest_json.get("relationships", []))
```

**File**: `core/wren/src/wren/genbi/cli.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ def _resolve_prompt(prompt: str | None, prompt_file: str | None) -> str | None:
         if not p.exists():
             typer.echo(f"Error: prompt file not found: {p}", err=True)
             raise typer.Exit(1)
-        return p.read_text().strip() or None
+        return p.read_text(encoding="utf-8").strip() or None
     if prompt == "-":
         return sys.stdin.read().strip() or None
     return prompt
```

**File**: `core/wren/src/wren/genbi/index.py` (modified, +5/-2)
```diff
@@ -40,7 +40,7 @@ def load_index(project_path: Path) -> dict:
     if not path.exists():
         return {"schema_version": INDEX_SCHEMA_VERSION, "apps": {}}
     try:
-        data = yaml.safe_load(path.read_text())
+        data = yaml.safe_load(path.read_text(encoding="utf-8"))
     except yaml.YAMLError as e:
         raise MalformedIndexError(f"{path} is not valid YAML: {e}") from e
     if data is None:
@@ -74,7 +74,10 @@ def load_index(project_path: Path) -> dict:
 def save_index(project_path: Path, index: dict) -> None:
     path = index_path(project_path)
     path.parent.mkdir(parents=True, exist_ok=True)
-    path.write_text(yaml.safe_dump(index, default_flow_style=False, sort_keys=False))
+    path.write_text(
+        yaml.safe_dump(index, default_flow_style=False, sort_keys=False),
+        encoding="utf-8",
+    )
 
 
 def register_app(project_path: Path, name: str, *, data_mode: str) -> dict:
```

**File**: `core/wren/src/wren/genbi/verify.py` (modified, +2/-2)
```diff
@@ -89,7 +89,7 @@ def _scan_for_secrets(app_dir: Path) -> list[str]:
         if path.suffix.lower() in _UNSCANNABLE_SUFFIXES:
             continue
         try:
-            text = path.read_text(errors="ignore")
+            text = path.read_text(encoding="utf-8", errors="ignore")
         except OSError:
             continue
         for label, pattern in _SECRET_PATTERNS:
@@ -136,7 +136,7 @@ def verify_app(app_dir: Path, *, data_mode: str) -> VerifyResult:
         failures.append("missing mdl.json (copy the compiled MDL into the app)")
     else:
         try:
-            parsed = json.loads(mdl.read_text())
+            parsed = json.loads(mdl.read_text(encoding="utf-8"))
             if not parsed:
                 failures.append("mdl.json is empty")
         except json.JSONDecodeError as e:
```

---

### Incident Patch 3: `7b74af17` (2026-09-29)
**Commit Message**: fix(core): preserve string literals when removing MDL qualifiers (#2762)

Co-authored-by: dafyy321-pixel <dafyy321-pixel@users.noreply.github.com>

**File**: `core/wren-core/core/src/mdl/mod.rs` (modified, +59/-8)
```diff
@@ -21,7 +21,7 @@ use datafusion::execution::{SessionStateBuilder, SessionStateDefaults};
 use datafusion::logical_expr::{AggregateUDF, ScalarUDF, WindowUDF};
 use datafusion::prelude::{SessionConfig, SessionContext};
 use datafusion::sql::parser::DFParser;
-use datafusion::sql::sqlparser::ast::{Expr, ExprWithAlias, Ident};
+use datafusion::sql::sqlparser::ast::{visit_relations_mut, Expr, ExprWithAlias, Ident};
 use datafusion::sql::sqlparser::dialect::dialect_from_str;
 use datafusion::sql::unparser::Unparser;
 use datafusion::sql::TableReference;
@@ -533,13 +533,24 @@ pub async fn transform_sql_with_ctx(
         )]);
     // show the planned sql
     match unparser.plan_to_sql(&analyzed) {
-        Ok(sql) => {
-            // TODO: workaround to remove unnecessary catalog and schema of mdl
-            let replaced = sql
-                .to_string()
-                .replace(analyzed_mdl.wren_mdl().catalog_schema_prefix(), "");
-            info!("wren-core planned SQL: {replaced}");
-            Ok(replaced)
+        Ok(mut sql) => {
+            let wren_mdl = analyzed_mdl.wren_mdl();
+            let _ = visit_relations_mut(&mut sql, |relation| {
+                if relation.0.len() >= 3
+                    && relation.0[0]
+                        .as_ident()
+                        .is_some_and(|ident| ident.value == wren_mdl.catalog())
+                    && relation.0[1]
+                        .as_ident()
+                        .is_some_and(|ident| ident.value == wren_mdl.schema())
+                {
+                    relation.0.drain(..2);
+                }
+                std::ops::ControlFlow::<()>::Continue(())
+            });
+            let sql = sql.to_string();
+            info!("wren-core planned SQL: {sql}");
+            Ok(sql)
         }
         Err(e) => Err(e),
     }
@@ -836,6 +847,46 @@ mod test {
         Ok(())
     }
 
+    #[tokio::test]
+    async fn test_transform_sql_preserves_catalog_schema_prefix_in_string_literals(
+    ) -> Result<()> {
+        let test_data: PathBuf =
+            [env!("CARGO_MANIFEST_DIR"), "tests", "data", "mdl.json"]
+                .iter()
+                .collect();
+        let mdl_json = fs::read_to_string(test_data.as_path())?;
+        let mdl = serde_json::from_str::<Manifest>(&mdl_json).unwrap();
+        let analyzed_mdl = Arc::new(AnalyzedWrenMDL::analyze(
+            mdl,
+            Arc::new(HashMap::default()),
+            Mode::Unparse,
+        )?);
+        let ctx = create_wren_ctx(None, analyzed_mdl.wren_mdl().data_source().as_ref());
+
+        let actual = transform_sql_with_ctx(
+            &ctx,
+            analyzed_mdl,
+            &[],
+            Arc::new(HashMap::new()),
+            "SELECT 'test.test.keep' AS marker, \
+             CASE WHEN c_name LIKE 'test.test.%' \
+             THEN 'test.test.match' ELSE 'test.test.miss' END AS category, \
+             c_custkey FROM test.test.customer",
+        )
+        .await?;
+
+        assert!(actual.contains("'test.test.keep'"), "actual SQL: {actual}");
+        assert!(
+            actual.contains("LIKE 'test.test.%'"),
+            "actual SQL: {actual}"
+        );
+        assert!(actual.contains("'test.test.match'"), "actual SQL: {actual}");
+        assert!(actual.contains("'test.test.miss'"), "actual SQL: {actual}");
+        assert!(!actual.contains("FROM test.test."), "actual SQL: {actual}");
+
+        Ok(())
+    }
+
     #[tokio::test]
     async fn test_access_view() -> Result<()> {
         let test_data: PathBuf =
```

---

### Incident Patch 4: `d26ab6af` (2026-09-24)
**Commit Message**: chore(deps): bump core/wren lockfile to clear open security advisories (#2751)

Signed-off-by: dependabot[bot] <support@github.com>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Jax Liu <liugs963@gmail.com>
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `core/wren/uv.lock` (modified, +126/-90)
```diff
@@ -36,15 +36,15 @@ wheels = [
 
 [[package]]
 name = "anyio"
-version = "4.13.0"
+version = "4.14.2"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "idna" },
     { name = "typing-extensions", marker = "python_full_version < '3.13'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/19/14/2c5dd9f512b66549ae92767a9c7b330ae88e1932ca57876909410251fe13/anyio-4.13.0.tar.gz", hash = "sha256:334b70e641fd2221c1505b3890c69882fe4a2df910cba14d97019b90b24439dc", size = 231622, upload-time = "2026-03-24T12:59:09.671Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/61/cc/a381afa6efea9f496eff839d4a6a1aed3bfafc7b3ab4b0d1b243a12573dd/anyio-4.14.2.tar.gz", hash = "sha256:cfa139f3ed1a23ee8f88a145ddb5ac7605b8bbfd8592baacd7ce3d8bb4313c7f", size = 260176, upload-time = "2026-07-12T20:29:07.082Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/da/42/e921fccf5015463e32a3cf6ee7f980a6ed0f395ceeaa45060b61d86486c2/anyio-4.13.0-py3-none-any.whl", hash = "sha256:08b310f9e24a9594186fd75b4f73f4a4152069e3853f1ed8bfbf58369f4ad708", size = 114353, upload-time = "2026-03-24T12:59:08.246Z" },
+    { url = "https://files.pythonhosted.org/packages/da/35/f2287558c17e29fafc8ef3daf819bb9834061cfa43bff8014f7df7f63bdc/anyio-4.14.2-py3-none-any.whl", hash = "sha256:9f505dda5ac9f0c8309b5e8bd445a8c2bf7246f3ce950121e45ea15bc41d1494", size = 125813, upload-time = "2026-07-12T20:29:05.763Z" },
 ]
 
 [[package]]
@@ -352,58 +352,58 @@ wheels = [
 
 [[package]]
 name = "cryptography"
-version = "49.0.0"
+version = "50.0.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "cffi", marker = "platform_python_implementation != 'PyPy'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/1f/99/d1c90d6041656cc6ee229dc99cd67fd0cd5aec3c5f7d72fffc27cc750054/cryptography-49.0.0.tar.gz", hash = "sha256:f89660a348f4f78a92366240a61404e337586ef7f5909a2fef59ca88ef505493", size = 854345, upload-time = "2026-06-12T20:02:30.512Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/9b/22/adf66990e63584a68dfb50c24f48a125c07b1699899381c8151e63ed458c/cryptography-49.0.0-cp311-abi3-macosx_11_0_arm64.whl", hash = "sha256:966fe0e9c67490071f14c0d2b1cb2dfb3023c5ce39457343931415f08382f2db", size = 4032100, upload-time = "2026-06-12T20:02:32.143Z" },
-    { url = "https://files.pythonhosted.org/packages/09/41/3797cfaf69cae04a13ee78ebd83f0678d9c02b4779d21ce24445326f1a69/cryptography-49.0.0-cp311-abi3-manylinux2014_aarch64.manylinux_2_17_aarch64.whl", hash = "sha256:36d1709f992593689b45bda411498d62c6e365f2ca00b84657d4dadd24de16db", size = 4692978, upload-time = "2026-06-12T20:01:21.305Z" },
-    { url = "https://files.pythonhosted.org/packages/e6/8b/43011f7ebe515a8aa20d61f290a326cd890c2e738e16e59eaff8d9c3a412/cryptography-49.0.0-cp311-abi3-manylinux2014_x86_64.manylinux_2_17_x86_64.whl", hash = "sha256:0e959b578856a3924bc0cbb710fc12c387b9412a951389f3ca61704a9e25f325", size = 4716422, upload-time = "2026-06-12T20:01:48.566Z" },
-    { url = "https://files.pythonhosted.org/packages/4a/91/01ce7303a4579e6d3a6abef01bd322848e9ea7a219adcabc5048b9033571/cryptography-49.0.0-cp311-abi3-manylinux_2_28_aarch64.whl", hash = "sha256:53ecee2e23f7169b6117e99fc8a944e5e50f79e69758a83b52a00cb98ab2b2d2", size = 4700503, upload-time = "2026-06-12T20:02:47.091Z" },
-    { url = "https://files.pythonhosted.org/packages/62/99/a2c95cf8293f07491e9e27c20cc4dcd18176d944e674679adeb1d0173fd6/cryptography-49.0.0-cp311-abi3-manylinux_2_28_ppc64le.whl", hash = "sha256:2eda353d8a27bcbcaa4cbed18994a74ab4d19a2ca897db188ea269ab9b71419b", size = 5309779, upload-time = "2026-06-12T20:02:08.987Z" },
-    { url = "https://files.pythonhosted.org/packages/20/2c/0622f20ff02b2ef32558733443805dc82fd4c275be01b2d19d14676f3a1b/cryptography-49.0.0-cp311-abi3-manylinux_2_28_x86_64.whl", hash = "sha256:2afe9051da7ae7bd5905da5a949280c7d2bb75682e188f650a9d0f2756b834c6", size = 4749683, upload-time = "2026-06-12T20:02:03.3
```

---

### Incident Patch 5: `4d55c52a` (2026-09-23)
**Commit Message**: fix(wren): strip semicolon before trailing comment in strip_trailing_semicolon (#2752)

**File**: `core/wren/src/wren/connector/athena.py` (modified, +3/-3)
```diff
@@ -16,7 +16,7 @@
 
 import pyarrow as pa
 
-from wren.connector.base import ConnectorABC, coerce_limit, strip_trailing_semicolon
+from wren.connector.base import ConnectorABC, coerce_limit
 from wren.model.error import DIALECT_SQL, ErrorCode, ErrorPhase, WrenError
 
 # Athena's DB-API cursor returns Trino-style type names. We delegate the
@@ -303,7 +303,7 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
         # engines can stop early instead of us downloading a full result and
         # slicing in Python. Subquery-wrap + trailing-semicolon strip keeps
         # composition valid for client SQL terminated with ``;``.
-        executed = strip_trailing_semicolon(sql)
+        executed = self._strip(sql)
         if limit is not None:
             # Multiline wrap so a trailing `-- line comment` in the inner SQL
             # is terminated by the newline instead of swallowing the closing
@@ -327,7 +327,7 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
     def dry_run(self, sql: str) -> None:
         try:
             with contextlib.closing(self.connection.cursor()) as cursor:
-                cursor.execute(f"EXPLAIN {strip_trailing_semicolon(sql)}")
+                cursor.execute(f"EXPLAIN {self._strip(sql)}")
         except (WrenError, TimeoutError):
             raise
         except Exception as e:
```

**File**: `core/wren/src/wren/connector/base.py` (modified, +45/-6)
```diff
@@ -4,20 +4,49 @@
 from abc import ABC, abstractmethod
 
 import pyarrow as pa
+from sqlglot import Dialect
+from sqlglot.errors import TokenError
+from sqlglot.tokens import TokenType
 
 _TRAILING_SEMICOLONS_RE = re.compile(r"[;\s]+\Z")
 
 
-def strip_trailing_semicolon(sql: str) -> str:
-    """Strip any trailing ``;`` characters and surrounding whitespace.
+def strip_trailing_semicolon(sql: str, dialect: str | None = None) -> str:
+    """Strip the terminating ``;`` and anything after it (whitespace/comments).
 
     Connectors often subquery-wrap or EXPLAIN user SQL. Engines reject a
     trailing semicolon inside those forms (e.g. ``SELECT * FROM (SELECT 1;)``
-    or ``EXPLAIN SELECT 1;``). Only the *terminating* run of semicolons and
-    whitespace is removed, so semicolons inside string literals
-    (``SELECT 'a;b'``) are preserved.
+    or ``EXPLAIN SELECT 1;``), and a comment after the semicolon defeats an
+    end-anchored strip, leaving the ``;`` inside the wrapped subquery.
+
+    Lexing is delegated to sqlglot's dialect-aware tokenizer rather than a
+    hand-written scanner: which escapes (``\\'``), quote styles (``$$..$$``,
+    backticks, ``[brackets]``, ``q'[..]'``) and comment markers exist is a
+    per-dialect property, and a scanner in this file would have to re-encode
+    it for every connector. Comments attach to the preceding token, so "only
+    comments after the ``;``" needs no special handling — the last token is
+    simply ``SEMICOLON``.
+
+    Only the *terminating* run of semicolons is removed: ``;`` inside string
+    literals (``SELECT 'a;b'``) or inside comments is preserved, and SQL
+    without a trailing semicolon is returned unchanged.
+
+    Raises no error for input the tokenizer cannot lex (an unterminated string
+    or block comment): those fall back to the previous end-anchored behaviour,
+    which is never worse than what this function replaced.
     """
-    return _TRAILING_SEMICOLONS_RE.sub("", sql)
+    try:
+        tokens = Dialect.get_or_raise(dialect).tokenize(sql)
+    except TokenError:
+        # Unterminated string/comment or a form the tokenizer rejects:
+        # degrade to the previous end-anchored strip, never worse than before.
+        return _TRAILING_SEMICOLONS_RE.sub("", sql)
+    cut = None
+    for token in reversed(tokens):
+        if token.token_type is not TokenType.SEMICOLON:
+            break
+        cut = token.start
+    return sql[:cut].rstrip() if cut is not None else sql
 
 
 def coerce_limit(limit: int | None) -> int | None:
@@ -59,6 +88,16 @@ def coerce_limit(limit: int | None) -> int | None:
 
 
 class ConnectorABC(ABC):
+    #: sqlglot dialect name for this connector, assigned by
+    #: ``wren.connector.factory.get_connector`` from the ``DataSource``. Left
+    #: ``None`` for connectors built directly (tests, ad-hoc use), which makes
+    #: ``_strip`` fall back to sqlglot's default dialect.
+    dialect: str | None = None
+
+    def _strip(self, sql: str) -> str:
+        """``strip_trailing_semicolon`` using this connector's dialect."""
+        return strip_trailing_semicolon(sql, self.dialect)
+
     @abstractmethod
     def query(self, sql: str, limit: int | None = None) -> pa.Table:
         pass
```

**File**: `core/wren/src/wren/connector/bigquery.py` (modified, +5/-5)
```diff
@@ -7,7 +7,7 @@
 from wren.connector.base import ConnectorABC, coerce_limit, strip_trailing_semicolon
 
 
-def _apply_limit(sql: str, limit: int) -> str:
+def _apply_limit(sql: str, limit: int, dialect: str | None = None) -> str:
     """Push LIMIT into SQL via outer subquery wrap.
 
     ``max_results`` only caps the page size of job results-reading; it does
@@ -20,7 +20,7 @@ def _apply_limit(sql: str, limit: int) -> str:
     terminated by the newline instead of swallowing the closing paren,
     alias and LIMIT clause (same technique as postgres.py/athena.py).
     """
-    cleaned = strip_trailing_semicolon(sql)
+    cleaned = strip_trailing_semicolon(sql, dialect)
     return f"SELECT * FROM (\n{cleaned}\n) AS _sub LIMIT {limit}"
 
 
@@ -63,16 +63,16 @@ def __init__(self, connection_info):
     def query(self, sql: str, limit: int | None = None) -> pa.Table:
         limit = coerce_limit(limit)
         if limit is not None:
-            sql = _apply_limit(sql, limit)
+            sql = _apply_limit(sql, limit, self.dialect)
         else:
-            sql = strip_trailing_semicolon(sql)
+            sql = self._strip(sql)
         return self.connection.query(sql).result().to_arrow()
 
     def dry_run(self, sql: str) -> None:
         from google.cloud import bigquery  # noqa: PLC0415
 
         self.connection.query(
-            strip_trailing_semicolon(sql),
+            self._strip(sql),
             job_config=bigquery.QueryJobConfig(dry_run=True, use_query_cache=False),
         )
 
```

**File**: `core/wren/src/wren/connector/canner.py` (modified, +3/-3)
```diff
@@ -17,7 +17,7 @@
 import pyarrow as pa
 from loguru import logger
 
-from wren.connector.base import ConnectorABC, coerce_limit, strip_trailing_semicolon
+from wren.connector.base import ConnectorABC, coerce_limit
 from wren.model.error import DIALECT_SQL, ErrorCode, ErrorPhase, WrenError
 
 # Postgres OID → Arrow type. Canner publishes Trino-style values over the
@@ -251,7 +251,7 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
         # empty trailing statements can produce Protocol/syntax noise/door. More
         # importantly we keep composition consistent with the limited path so
         # callers can always end SQL with ``;`` without branching.
-        sql = strip_trailing_semicolon(sql)
+        sql = self._strip(sql)
         if limit is not None:
             sql = f"SELECT * FROM ({sql}) AS _t LIMIT {limit}"
 
@@ -274,7 +274,7 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
     def dry_run(self, sql: str) -> None:
         import psycopg  # noqa: PLC0415
 
-        wrapped = f"SELECT * FROM ({strip_trailing_semicolon(sql)}) AS _t LIMIT 0"
+        wrapped = f"SELECT * FROM ({self._strip(sql)}) AS _t LIMIT 0"
         try:
             with self.connection.cursor() as cursor:
                 cursor.execute(wrapped)
```

**File**: `core/wren/src/wren/connector/clickhouse.py` (modified, +3/-3)
```diff
@@ -20,7 +20,7 @@
 from loguru import logger
 from sqlglot.expressions import DataType
 
-from wren.connector.base import ConnectorABC, coerce_limit, strip_trailing_semicolon
+from wren.connector.base import ConnectorABC, coerce_limit
 from wren.model.error import (
     DIALECT_SQL,
     DatabaseTimeoutError,
@@ -396,7 +396,7 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
         # Strip the terminating run of ``;`` / whitespace before wrapping —
         # ``SELECT * FROM (SELECT 1;) AS _wren_sub LIMIT N`` is invalid SQL.
         # Semicolons inside string literals are preserved.
-        stripped = strip_trailing_semicolon(sql)
+        stripped = self._strip(sql)
         statement = stripped
         if limit is not None:
             statement = f"SELECT * FROM ({stripped}) AS _wren_sub LIMIT {limit}"
@@ -414,7 +414,7 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
         return _build_clickhouse_arrow_table(result)
 
     def dry_run(self, sql: str) -> None:
-        stripped = strip_trailing_semicolon(sql)
+        stripped = self._strip(sql)
         try:
             self.connection.query(f"SELECT * FROM ({stripped}) AS _wren_sub LIMIT 0")
         except _ClickHouseDbError as e:
```

---

### Incident Patch 6: `871118e9` (2026-09-16)
**Commit Message**: fix(wren): detect a SELECT * in any UNION/INTERSECT/EXCEPT branch, not just the first (#2743)

**File**: `core/wren/src/wren/mdl/cte_rewriter.py` (modified, +38/-16)
```diff
@@ -1084,28 +1084,50 @@ def _detect_star_models(
         """Detect models selected via ``*`` before column qualification.
 
         A bare ``SELECT *`` marks all models; ``SELECT t.*`` marks only
-        the referenced model. *alias_to_model* is the case-aware mapping
+        the referenced model. Checks every top-level branch of a
+        UNION/INTERSECT/EXCEPT, not just the first, so a star anywhere in
+        the set operation still routes that model through wren-core's own
+        ``SELECT *`` (letting CLAC control column visibility) instead of an
+        explicit column list. *alias_to_model* is the case-aware mapping
         produced by ``_build_alias_map``.
         """
         star_models: set[str] = set()
-        select = ast.find(exp.Select)
-        if not select:
-            return star_models
-
-        for sel_expr in select.expressions:
-            if isinstance(sel_expr, exp.Star):
-                # Bare * → all models
-                star_models.update(alias_to_model.values())
-            elif isinstance(sel_expr, exp.Column) and isinstance(
-                sel_expr.this, exp.Star
-            ):
-                # table.* → specific model
-                table_ref = sel_expr.table
-                if table_ref and table_ref in alias_to_model:
-                    star_models.add(alias_to_model[table_ref])
+
+        for select in self._iter_top_level_selects(ast):
+            for sel_expr in select.expressions:
+                if isinstance(sel_expr, exp.Star):
+                    # Bare * marks all models
+                    star_models.update(alias_to_model.values())
+                elif isinstance(sel_expr, exp.Column) and isinstance(
+                    sel_expr.this, exp.Star
+                ):
+                    # table.* marks the specific model
+                    table_ref = sel_expr.table
+                    if table_ref and table_ref in alias_to_model:
+                        star_models.add(alias_to_model[table_ref])
 
         return star_models
 
+    @classmethod
+    def _iter_top_level_selects(cls, node: exp.Expression) -> list[exp.Select]:
+        """Yield every top-level SELECT branch of a set-operation chain.
+
+        A plain query is one branch. Recurses through ``UNION``/``INTERSECT``/
+        ``EXCEPT`` (``exp.SetOperation.this``/``.expression``) and through a
+        parenthesized branch (``exp.Subquery``), but does not descend into a
+        branch's own nested subqueries: those are a separate alias_to_model
+        scope, resolved on their own recursive call in ``_collect_model_columns``.
+        """
+        if isinstance(node, exp.Select):
+            return [node]
+        if isinstance(node, exp.SetOperation):
+            return cls._iter_top_level_selects(node.this) + cls._iter_top_level_selects(
+                node.expression
+            )
+        if isinstance(node, exp.Subquery):
+            return cls._iter_top_level_selects(node.this)
+        return []
+
     @staticmethod
     def _collect_user_cte_names(ast: exp.Expression) -> set[str]:
         """Collect all CTE names defined in the user's SQL (all scopes)."""
```

**File**: `core/wren/tests/unit/test_cte_rewriter.py` (modified, +53/-0)
```diff
@@ -113,6 +113,23 @@ def _make_rewriter(
     return CTERewriter(manifest_str, session, data_source, fallback=fallback)
 
 
+class _RecordingSessionContext:
+    """Wraps a real session context, recording every SQL string handed to
+    ``transform_sql`` so a test can see whether a model was sent as a bare
+    ``SELECT *`` (CLAC-controlled) or an explicit column list."""
+
+    def __init__(self, inner):
+        self._inner = inner
+        self.calls: list[str] = []
+
+    def transform_sql(self, sql: str) -> str:
+        self.calls.append(sql)
+        return self._inner.transform_sql(sql)
+
+    def __getattr__(self, name):
+        return getattr(self._inner, name)
+
+
 # ---------------------------------------------------------------------------
 # Helper: parse and check CTE presence
 # ---------------------------------------------------------------------------
@@ -239,6 +256,42 @@ def test_mixed_star_and_explicit_columns(self):
         assert "c_name" in customer_body.lower()
 
 
+class TestUnionStarDetection:
+    """A star anywhere in a UNION/INTERSECT/EXCEPT must route that model
+    through wren-core as ``SELECT *`` (so CLAC controls column visibility),
+    not as an explicit column list, no matter which branch it is in."""
+
+    def test_star_in_second_union_branch_still_routes_through_wren_core(self):
+        rw = _make_rewriter(_SINGLE_MODEL_MANIFEST)
+        rw.session_context = _RecordingSessionContext(rw.session_context)
+        rw.rewrite('SELECT o_orderkey FROM "orders" UNION ALL SELECT * FROM "orders"')
+        assert any(
+            s.strip() == 'SELECT * FROM "orders"' for s in rw.session_context.calls
+        ), (
+            f"expected a bare SELECT * transform_sql call, got: {rw.session_context.calls}"
+        )
+
+    def test_star_in_first_union_branch_still_detected(self):
+        rw = _make_rewriter(_SINGLE_MODEL_MANIFEST)
+        rw.session_context = _RecordingSessionContext(rw.session_context)
+        rw.rewrite('SELECT * FROM "orders" UNION ALL SELECT o_orderkey FROM "orders"')
+        assert any(
+            s.strip() == 'SELECT * FROM "orders"' for s in rw.session_context.calls
+        ), (
+            f"expected a bare SELECT * transform_sql call, got: {rw.session_context.calls}"
+        )
+
+    def test_plain_query_star_still_detected(self):
+        rw = _make_rewriter(_SINGLE_MODEL_MANIFEST)
+        rw.session_context = _RecordingSessionContext(rw.session_context)
+        rw.rewrite('SELECT * FROM "orders"')
+        assert any(
+            s.strip() == 'SELECT * FROM "orders"' for s in rw.session_context.calls
+        ), (
+            f"expected a bare SELECT * transform_sql call, got: {rw.session_context.calls}"
+        )
+
+
 # ---------------------------------------------------------------------------
 # Tests: CTE edge cases
 # ---------------------------------------------------------------------------
```

---

### Incident Patch 7: `1fdd864e` (2026-09-14)
**Commit Message**: fix(wren): oracle, redshift and trino LIMIT wrap breaks on SQL ending in a trailing comment (#2736)

Signed-off-by: Amir Fathi <amirfathi.me@gmail.com>

**File**: `core/wren/src/wren/connector/oracle.py` (modified, +5/-2)
```diff
@@ -184,7 +184,10 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
         # though engines accept multi-statement scripts elsewhere.
         sql = strip_trailing_semicolon(sql)
         if limit is not None:
-            sql = f"SELECT * FROM ({sql}) t WHERE ROWNUM <= {limit}"
+            # Multiline wrap so a trailing `-- line comment` in the inner SQL
+            # is terminated by the newline instead of swallowing the closing
+            # `) t WHERE ROWNUM <= n` (same technique as postgres.py).
+            sql = f"SELECT * FROM (\n{sql}\n) t WHERE ROWNUM <= {limit}"
         try:
             with self.connection.cursor() as cursor:
                 cursor.execute(sql)
@@ -202,7 +205,7 @@ def dry_run(self, sql: str) -> None:
             try:
                 with self.connection.cursor() as cursor:
                     cursor.execute(
-                        f"SELECT * FROM ({strip_trailing_semicolon(sql)}) t "
+                        f"SELECT * FROM (\n{strip_trailing_semicolon(sql)}\n) t "
                         f"WHERE ROWNUM <= 0"
                     )
             except oracledb.DatabaseError as e:
```

**File**: `core/wren/src/wren/connector/redshift.py` (modified, +6/-3)
```diff
@@ -45,12 +45,15 @@ def __init__(self, connection_info: RedshiftConnectionUnion):
 
     def query(self, sql: str, limit: int | None = None) -> pa.Table:
         limit = coerce_limit(limit)
+        stripped = strip_trailing_semicolon(sql)
         if limit is not None:
-            sql = f"SELECT * FROM ({strip_trailing_semicolon(sql)}) AS _q LIMIT {limit}"
+            # Multiline wrap so a trailing line comment in the inner SQL is
+            # terminated by the newline instead of eating the closing paren.
+            sql = f"SELECT * FROM (\n{stripped}\n) AS _q LIMIT {limit}"
         else:
             # Unlimited path also rejects trailing ``;`` for single statements
             # depending on driver/session settings — strip for consistency.
-            sql = strip_trailing_semicolon(sql)
+            sql = stripped
         with closing(self.connection.cursor()) as cursor:
             cursor.execute(sql)
             cols = [desc[0] for desc in cursor.description]
@@ -61,7 +64,7 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
     def dry_run(self, sql: str) -> None:
         with closing(self.connection.cursor()) as cursor:
             cursor.execute(
-                f"SELECT * FROM ({strip_trailing_semicolon(sql)}) AS sub LIMIT 0"
+                f"SELECT * FROM (\n{strip_trailing_semicolon(sql)}\n) AS sub LIMIT 0"
             )
 
     def close(self) -> None:
```

**File**: `core/wren/src/wren/connector/trino.py` (modified, +5/-2)
```diff
@@ -490,7 +490,10 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
         # a clean inner SQL so `;` cannot break the subquery wrap.
         sql = strip_trailing_semicolon(sql)
         if limit is not None:
-            sql = f"SELECT * FROM ({sql}) AS _sub LIMIT {limit}"
+            # Multiline wrap so a trailing `-- line comment` in the inner SQL
+            # is terminated by the newline instead of swallowing the closing
+            # `) AS _sub LIMIT n` (same technique as postgres.py).
+            sql = f"SELECT * FROM (\n{sql}\n) AS _sub LIMIT {limit}"
         try:
             with contextlib.closing(self.connection.cursor()) as cursor:
                 cursor.execute(sql)
@@ -510,7 +513,7 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
     def dry_run(self, sql: str) -> None:
         trino = _import_trino()
 
-        wrapped = f"SELECT * FROM ({strip_trailing_semicolon(sql)}) AS _sub LIMIT 0"
+        wrapped = f"SELECT * FROM (\n{strip_trailing_semicolon(sql)}\n) AS _sub LIMIT 0"
         try:
             with contextlib.closing(self.connection.cursor()) as cursor:
                 cursor.execute(wrapped)
```

**File**: `core/wren/tests/unit/test_oracle_semicolon.py` (modified, +22/-4)
```diff
@@ -45,16 +45,34 @@ def test_query_strips_trailing_semicolon_before_subquery_wrap(monkeypatch) -> No
     )
     connector.query("SELECT 1;", limit=5)
     (sent,), _ = cursor.execute.call_args
-    assert sent == "SELECT * FROM (SELECT 1) t WHERE ROWNUM <= 5"
-    assert ";)" not in sent
+    assert sent == "SELECT * FROM (\nSELECT 1\n) t WHERE ROWNUM <= 5"
+    assert ";\n)" not in sent
 
 
 def test_dry_run_strips_trailing_semicolon() -> None:
     connector, cursor = _make_mock_connector()
     connector.dry_run("SELECT 1;  ")
     (sent,), _ = cursor.execute.call_args
-    assert sent == "SELECT * FROM (SELECT 1) t WHERE ROWNUM <= 0"
-    assert ";)" not in sent
+    assert sent == "SELECT * FROM (\nSELECT 1\n) t WHERE ROWNUM <= 0"
+    assert ";\n)" not in sent
+
+
+def test_query_limit_survives_trailing_line_comment(monkeypatch) -> None:
+    """Trailing `--` must not eat the wrap (same shape as postgres.py #2728)."""
+    connector, cursor = _make_mock_connector()
+    monkeypatch.setattr(
+        oracle_mod, "_build_oracle_arrow_table", lambda c: pa.table({})
+    )
+    connector.query("SELECT 1 AS x -- pick", limit=5)
+    (sent,), _ = cursor.execute.call_args
+    assert sent == "SELECT * FROM (\nSELECT 1 AS x -- pick\n) t WHERE ROWNUM <= 5"
+
+
+def test_dry_run_limit_survives_trailing_line_comment() -> None:
+    connector, cursor = _make_mock_connector()
+    connector.dry_run("SELECT 1 AS x -- pick")
+    (sent,), _ = cursor.execute.call_args
+    assert sent == "SELECT * FROM (\nSELECT 1 AS x -- pick\n) t WHERE ROWNUM <= 0"
 
 
 def test_helper_preserves_semicolon_inside_string_literal() -> None:
```

**File**: `core/wren/tests/unit/test_redshift_semicolon.py` (modified, +19/-4)
```diff
@@ -31,16 +31,31 @@ def test_query_strips_trailing_semicolon_before_subquery_wrap() -> None:
     connector, cursor = _make_mock_connector()
     connector.query("SELECT 1;", limit=5)
     (sent,), _ = cursor.execute.call_args
-    assert sent == "SELECT * FROM (SELECT 1) AS _q LIMIT 5"
-    assert ";)" not in sent
+    assert sent == "SELECT * FROM (\nSELECT 1\n) AS _q LIMIT 5"
+    assert ";\n)" not in sent
 
 
 def test_dry_run_strips_trailing_semicolon() -> None:
     connector, cursor = _make_mock_connector()
     connector.dry_run("SELECT 1;  ")
     (sent,), _ = cursor.execute.call_args
-    assert sent == "SELECT * FROM (SELECT 1) AS sub LIMIT 0"
-    assert ";)" not in sent
+    assert sent == "SELECT * FROM (\nSELECT 1\n) AS sub LIMIT 0"
+    assert ";\n)" not in sent
+
+
+def test_query_limit_survives_trailing_line_comment() -> None:
+    """Trailing `--` must not eat the wrap (same shape as postgres.py #2728)."""
+    connector, cursor = _make_mock_connector()
+    connector.query("SELECT 1 AS x -- pick", limit=5)
+    (sent,), _ = cursor.execute.call_args
+    assert sent == "SELECT * FROM (\nSELECT 1 AS x -- pick\n) AS _q LIMIT 5"
+
+
+def test_dry_run_limit_survives_trailing_line_comment() -> None:
+    connector, cursor = _make_mock_connector()
+    connector.dry_run("SELECT 1 AS x -- pick")
+    (sent,), _ = cursor.execute.call_args
+    assert sent == "SELECT * FROM (\nSELECT 1 AS x -- pick\n) AS sub LIMIT 0"
 
 
 def test_helper_preserves_semicolon_inside_string_literal() -> None:
```

---

### Incident Patch 8: `0be34c04` (2026-09-14)
**Commit Message**: fix(wren): bigquery and duckdb LIMIT wrap breaks on SQL ending in a trailing comment (#2734)

**File**: `core/wren/src/wren/connector/bigquery.py` (modified, +5/-2)
```diff
@@ -15,10 +15,13 @@ def _apply_limit(sql: str, limit: int) -> str:
     (after stripping a trailing semicolon) short-circuits the engine and
     correctly enforces the caller's limit even when *sql* already contains an
     inner ``LIMIT`` (the outer limit always wins / can only reduce rows).
-    Avoids comment-sensitive outer-LIMIT detection heuristics.
+    Avoids comment-sensitive outer-LIMIT detection heuristics. The wrap
+    itself is multiline so a trailing ``-- line comment`` in *sql* is
+    terminated by the newline instead of swallowing the closing paren,
+    alias and LIMIT clause (same technique as postgres.py/athena.py).
     """
     cleaned = strip_trailing_semicolon(sql)
-    return f"SELECT * FROM ({cleaned}) AS _sub LIMIT {limit}"
+    return f"SELECT * FROM (\n{cleaned}\n) AS _sub LIMIT {limit}"
 
 
 _SCOPES = [
```

**File**: `core/wren/src/wren/connector/duckdb.py` (modified, +5/-2)
```diff
@@ -85,7 +85,10 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
         stripped = strip_trailing_semicolon(sql)
         if limit is not None:
             # Subquery wrap rejects an interior terminator after strip.
-            sql = f"SELECT * FROM ({stripped}) AS _q LIMIT {limit}"
+            # Multiline so a trailing `-- line comment` in `stripped` is
+            # terminated by the newline instead of swallowing the closing
+            # `) AS _q LIMIT n` (same technique as postgres.py/athena.py).
+            sql = f"SELECT * FROM (\n{stripped}\n) AS _q LIMIT {limit}"
         else:
             sql = stripped
         return self.connection.execute(sql).fetch_arrow_table()
@@ -102,7 +105,7 @@ def dry_run(self, sql: str) -> None:
         no rows are materialized.
         """
         stripped = strip_trailing_semicolon(sql)
-        self.connection.execute(f"SELECT * FROM ({stripped}) AS _q LIMIT 0")
+        self.connection.execute(f"SELECT * FROM (\n{stripped}\n) AS _q LIMIT 0")
 
     def _attach_database(self, connection_info) -> None:
         """Attach every discovered DuckDB file as a read-only database.
```

**File**: `core/wren/tests/unit/test_bigquery_semicolon.py` (modified, +12/-4)
```diff
@@ -29,8 +29,16 @@ def test_query_pushes_limit_and_strips_semicolon() -> None:
     connector, client = _make_mock_connector()
     connector.query("SELECT 1;", limit=5)
     (sent,), _ = client.query.call_args
-    assert sent == "SELECT * FROM (SELECT 1) AS _sub LIMIT 5"
-    assert ";)" not in sent and not sent.rstrip().endswith(";")
+    assert sent == "SELECT * FROM (\nSELECT 1\n) AS _sub LIMIT 5"
+    assert ";\n)" not in sent and not sent.rstrip().endswith(";")
+
+
+def test_query_limit_survives_trailing_line_comment() -> None:
+    """Trailing `--` must not eat the wrap (same shape as postgres.py #2728)."""
+    connector, client = _make_mock_connector()
+    connector.query("SELECT 1 AS x -- pick", limit=5)
+    (sent,), _ = client.query.call_args
+    assert sent == "SELECT * FROM (\nSELECT 1 AS x -- pick\n) AS _sub LIMIT 5"
 
 
 def test_query_without_limit_still_strips_semicolon() -> None:
@@ -45,7 +53,7 @@ def test_query_with_inner_limit_outer_wrap_still_enforces_caller_limit() -> None
     connector, client = _make_mock_connector()
     connector.query("SELECT 1 LIMIT 100", limit=5)
     (sent,), _ = client.query.call_args
-    assert sent == "SELECT * FROM (SELECT 1 LIMIT 100) AS _sub LIMIT 5"
+    assert sent == "SELECT * FROM (\nSELECT 1 LIMIT 100\n) AS _sub LIMIT 5"
 
 
 def test_dry_run_strips_trailing_semicolon() -> None:
@@ -80,4 +88,4 @@ def __init__(self, dry_run=False, use_query_cache=True):
 
 def test_helper_preserves_literal_semicolon() -> None:
     assert strip_trailing_semicolon("SELECT ';' AS x") == "SELECT ';' AS x"
-    assert _apply_limit("SELECT 1;", 3) == "SELECT * FROM (SELECT 1) AS _sub LIMIT 3"
+    assert _apply_limit("SELECT 1;", 3) == "SELECT * FROM (\nSELECT 1\n) AS _sub LIMIT 3"
```

**File**: `core/wren/tests/unit/test_duckdb_file_listing.py` (modified, +4/-4)
```diff
@@ -95,7 +95,7 @@ def test_query_strips_trailing_semicolon_before_limit_wrap():
     result = connector.query("SELECT 1;", limit=5)
 
     executed = connector.connection.execute.call_args.args[0]
-    assert executed == "SELECT * FROM (SELECT 1) AS _q LIMIT 5"
+    assert executed == "SELECT * FROM (\nSELECT 1\n) AS _q LIMIT 5"
     assert result == "tbl"
 
 
@@ -112,7 +112,7 @@ def test_dry_run_wraps_in_limit_zero_subquery():
     executed = connector.connection.execute.call_args.args[0]
     # The trailing terminator is stripped; the interior ``;`` stays inside the
     # subquery where DuckDB rejects it as a syntax error (no side effects).
-    assert executed == "SELECT * FROM (SELECT 1; DROP TABLE t) AS _q LIMIT 0"
+    assert executed == "SELECT * FROM (\nSELECT 1; DROP TABLE t\n) AS _q LIMIT 0"
 
 
 def test_dry_run_strips_trailing_semicolon():
@@ -122,7 +122,7 @@ def test_dry_run_strips_trailing_semicolon():
     connector.dry_run("SELECT 1;")
 
     executed = connector.connection.execute.call_args.args[0]
-    assert executed == "SELECT * FROM (SELECT 1) AS _q LIMIT 0"
+    assert executed == "SELECT * FROM (\nSELECT 1\n) AS _q LIMIT 0"
 
 
 def test_dry_run_preserves_semicolon_in_string_literal():
@@ -134,4 +134,4 @@ def test_dry_run_preserves_semicolon_in_string_literal():
     connector.dry_run("SELECT ';' AS x")
 
     executed = connector.connection.execute.call_args.args[0]
-    assert executed == "SELECT * FROM (SELECT ';' AS x) AS _q LIMIT 0"
+    assert executed == "SELECT * FROM (\nSELECT ';' AS x\n) AS _q LIMIT 0"
```

**File**: `core/wren/tests/unit/test_duckdb_semicolon_unlimited.py` (modified, +27/-1)
```diff
@@ -34,5 +34,31 @@ def test_limited_query_still_wraps_after_strip():
     connector.query("SELECT 1 AS x;", limit=2)
 
     connector.connection.execute.assert_called_once_with(
-        "SELECT * FROM (SELECT 1 AS x) AS _q LIMIT 2"
+        "SELECT * FROM (\nSELECT 1 AS x\n) AS _q LIMIT 2"
+    )
+
+
+def test_query_limit_survives_trailing_line_comment():
+    """Trailing `--` must not eat the wrap (same shape as postgres.py #2728)."""
+    connector = DuckDBConnector.__new__(DuckDBConnector)
+    connector.connection = MagicMock()
+    connector.connection.execute.return_value.fetch_arrow_table.return_value = (
+        pa.table({"x": [1]})
+    )
+
+    connector.query("SELECT 1 AS x -- pick", limit=2)
+
+    connector.connection.execute.assert_called_once_with(
+        "SELECT * FROM (\nSELECT 1 AS x -- pick\n) AS _q LIMIT 2"
+    )
+
+
+def test_dry_run_survives_trailing_line_comment():
+    connector = DuckDBConnector.__new__(DuckDBConnector)
+    connector.connection = MagicMock()
+
+    connector.dry_run("SELECT 1 AS x -- pick")
+
+    connector.connection.execute.assert_called_once_with(
+        "SELECT * FROM (\nSELECT 1 AS x -- pick\n) AS _q LIMIT 0"
     )
```

---

### Incident Patch 9: `19495eed` (2026-09-09)
**Commit Message**: fix(bigquery): support Application Default Credentials (#2726)

**File**: `core/wren/docs/connections.md` (modified, +6/-0)
```diff
@@ -75,6 +75,12 @@ Both formats are accepted. The CLI auto-flattens the envelope format.
 }
 ```
 
+`credentials` is optional: if omitted, the connector falls back to
+Application Default Credentials (`gcloud auth application-default login`,
+workload identity, or the GCE/Cloud Run metadata server). ADC obtained via
+`gcloud auth application-default login` does not carry the Drive scope;
+BigQuery external tables over Drive/Sheets still need a service account.
+
 ## Snowflake
 
 ```json
```

**File**: `core/wren/src/wren/connector/bigquery.py` (modified, +21/-14)
```diff
@@ -21,26 +21,33 @@ def _apply_limit(sql: str, limit: int) -> str:
     return f"SELECT * FROM ({cleaned}) AS _sub LIMIT {limit}"
 
 
+_SCOPES = [
+    "https://www.googleapis.com/auth/drive",
+    "https://www.googleapis.com/auth/cloud-platform",
+]
+
+
 class BigQueryConnector(ConnectorABC):
     def __init__(self, connection_info):
         from google.cloud import bigquery  # noqa: PLC0415
-        from google.oauth2 import service_account  # noqa: PLC0415
 
         self.connection_info = connection_info
-        credits_json = loads(
-            base64.b64decode(connection_info.credentials.get_secret_value()).decode(
-                "utf-8"
+        if connection_info.credentials:
+            from google.oauth2 import service_account  # noqa: PLC0415
+
+            credits_json = loads(
+                base64.b64decode(connection_info.credentials.get_secret_value()).decode(
+                    "utf-8"
+                )
             )
-        )
-        credentials = service_account.Credentials.from_service_account_info(
-            credits_json
-        )
-        credentials = credentials.with_scopes(
-            [
-                "https://www.googleapis.com/auth/drive",
-                "https://www.googleapis.com/auth/cloud-platform",
-            ]
-        )
+            credentials = service_account.Credentials.from_service_account_info(
+                credits_json
+            )
+            credentials = credentials.with_scopes(_SCOPES)
+        else:
+            import google.auth  # noqa: PLC0415
+
+            credentials, _ = google.auth.default(scopes=_SCOPES)
         client = bigquery.Client(
             credentials=credentials,
             project=connection_info.get_billing_project_id(),
```

**File**: `core/wren/src/wren/model/__init__.py` (modified, +11/-2)
```diff
@@ -38,8 +38,17 @@ def _normalize(value):
 
 
 class BigQueryConnectionInfo(BaseConnectionInfo):
-    credentials: SecretStr = Field(
-        description="Base64 encode `credentials.json`", examples=["eyJ..."]
+    credentials: SecretStr | None = Field(
+        default=None,
+        description=(
+            "Base64 encode `credentials.json`. Omit to use Application Default "
+            "Credentials (gcloud auth application-default login, workload "
+            "identity, or the GCE/Cloud Run metadata server). ADC obtained via "
+            "gcloud auth application-default login does not carry the Drive "
+            "scope; BigQuery external tables over Drive/Sheets still require a "
+            "service account."
+        ),
+        examples=["eyJ..."],
     )
     job_timeout_ms: int | None = Field(default=None)
 
```

**File**: `core/wren/src/wren/model/field_registry.py` (modified, +2/-2)
```diff
@@ -94,14 +94,14 @@ class FieldDef:
         "credentials": {
             "input_type": "file_base64",
             "accept": ".json",
-            "hint": "Upload your GCP service account credentials.json file. It will be base64-encoded automatically.",
+            "hint": "Upload your GCP service account credentials.json file (it will be base64-encoded automatically), or leave blank to use Application Default Credentials.",
         },
     },
     "BigQueryProjectConnectionInfo": {
         "credentials": {
             "input_type": "file_base64",
             "accept": ".json",
-            "hint": "Upload your GCP service account credentials.json file. It will be base64-encoded automatically.",
+            "hint": "Upload your GCP service account credentials.json file (it will be base64-encoded automatically), or leave blank to use Application Default Credentials.",
         },
     },
     "SnowflakeConnectionInfo": {
```

**File**: `core/wren/tests/unit/test_bigquery_adc.py` (added, +175/-0)
```diff
@@ -0,0 +1,175 @@
+"""BigQuery connector: Application Default Credentials fallback.
+
+Stubs ``google.cloud.bigquery``, ``google.oauth2.service_account`` and
+``google.auth`` for the duration of each test, via ``monkeypatch.setitem``
+so a prior real import of ``google`` (e.g. from ``protobuf``/``grpc``, which
+also occupy that namespace package) is overridden rather than left in place
+by ``setdefault``, and is restored afterward. ``BigQueryConnector.__init__``
+imports these lazily, so the stub only needs to be live while a test runs,
+not at collection time. The real ``google-*`` packages are only installed
+under the optional ``bigquery`` extra, which CI's unit-test job does not
+install.
+"""
+
+from __future__ import annotations
+
+import base64
+import sys
+import types
+from unittest.mock import MagicMock
+
+import pytest
+
+pytestmark = pytest.mark.unit
+
+# ---------------------------------------------------------------------------
+# stub google.cloud.bigquery / google.oauth2.service_account / google.auth
+# ---------------------------------------------------------------------------
+
+_client_calls: list[dict] = []
+_service_account_calls: list[dict] = []
+_default_calls: list[dict] = []
+
+_service_account_credentials = MagicMock(name="service_account_credentials")
+_service_account_credentials.with_scopes.return_value = (
+    "scoped-service-account-credentials"
+)
+_adc_credentials = MagicMock(name="adc_credentials")
+
+
+class _FakeQueryJobConfig:
+    def __init__(self, dry_run=False, use_query_cache=True):
+        self.dry_run = dry_run
+        self.use_query_cache = use_query_cache
+        self.job_timeout_ms = None
+
+
+class _FakeClient:
+    def __init__(self, **kwargs):
+        _client_calls.append(kwargs)
+        self.default_query_job_config = None
+
+    def close(self):
+        pass
+
+
+def _fake_from_service_account_info(credits_json):
+    _service_account_calls.append(credits_json)
+    return _service_account_credentials
+
+
+def _fake_default(scopes=None):
+    _default_calls.append({"scopes": scopes})
+    return _adc_credentials, "detected-project"
+
+
+_google_mod = types.ModuleType("google")
+_google_cloud_mod = types.ModuleType("google.cloud")
+_google_cloud_bigquery_mod = types.ModuleType("google.cloud.bigquery")
+_google_cloud_bigquery_mod.Client = _FakeClient
+_google_cloud_bigquery_mod.QueryJobConfig = _FakeQueryJobConfig
+_google_oauth2_mod = types.ModuleType("google.oauth2")
+_google_oauth2_service_account_mod = types.ModuleType("google.oauth2.service_account")
+_google_oauth2_service_account_mod.Credentials = types.SimpleNamespace(
+    from_service_account_info=_fake_from_service_account_info
+)
+_google_auth_mod = types.ModuleType("google.auth")
+_google_auth_mod.default = _fake_default
+
+# `import google.auth` resolves `.auth` as an attribute of "google", so each
+# submodule also needs wiring onto its parent, not just onto sys.modules.
+_google_mod.cloud = _google_cloud_mod
+_google_cloud_mod.bigquery = _google_cloud_bigquery_mod
+_google_mod.oauth2 = _google_oauth2_mod
+_google_oauth2_mod.service_account = _google_oauth2_service_account_mod
+_google_mod.auth = _google_auth_mod
+
+_GOOGLE_STUBS = {
+    "google": _google_mod,
+    "google.cloud": _google_cloud_mod,
+    "google.cloud.bigquery": _google_cloud_bigquery_mod,
+    "google.oauth2": _google_oauth2_mod,
+    "google.oauth2.service_account": _google_oauth2_service_account_mod,
+    "google.auth": _google_auth_mod,
+}
+
+from wren.connector.bigquery import BigQueryConnector  # noqa: E402
+from wren.model import BigQueryDatasetConnectionInfo  # noqa: E402
+
+
+@pytest.fixture(autouse=True)
+def _reset_calls(monkeypatch):
+    for name, module in _GOOGLE_STUBS.items():
+        monkeypatch.setitem(sys.modules, name, module)
+    _client_calls.clear()
+    _service_account_calls.clear()
+    _default_calls.clear()
+    _service_account_credentials.reset_mock(return_value=True, side_effect=True)
+    _service_account
```

---

### Incident Patch 10: `9ff9649f` (2026-09-09)
**Commit Message**: fix(wren): postgres LIMIT pushdown breaks on SQL ending in a trailing comment (#2728)

Signed-off-by: Amir Fathi <amirfathi.me@gmail.com>

**File**: `core/wren/src/wren/connector/postgres.py` (modified, +5/-2)
```diff
@@ -317,7 +317,10 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
         # client-pasted statements match dry_run / limited composition rules.
         sql = strip_trailing_semicolon(sql)
         if limit is not None:
-            sql = f"SELECT * FROM ({sql}) AS _sub LIMIT {limit}"
+            # Multiline wrap so a trailing `-- line comment` in the inner SQL
+            # is terminated by the newline instead of swallowing the closing
+            # `) AS _sub LIMIT n` (same technique as athena.py/snowflake.py).
+            sql = f"SELECT * FROM (\n{sql}\n) AS _sub LIMIT {limit}"
 
         try:
             with self.connection.cursor() as cursor:
@@ -336,7 +339,7 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
             ) from e
 
     def dry_run(self, sql: str) -> None:
-        wrapped = f"SELECT * FROM ({strip_trailing_semicolon(sql)}) AS _sub LIMIT 0"
+        wrapped = f"SELECT * FROM (\n{strip_trailing_semicolon(sql)}\n) AS _sub LIMIT 0"
         try:
             with self.connection.cursor() as cursor:
                 cursor.execute(wrapped)
```

**File**: `core/wren/tests/connectors/test_postgres.py` (modified, +3/-3)
```diff
@@ -461,15 +461,15 @@ def test_query_strips_trailing_semicolon_before_subquery_wrap() -> None:
     connector, cursor = _make_mock_connector()
     connector.query("SELECT 1;", limit=5)
     (sent,), _ = cursor.execute.call_args
-    assert sent == "SELECT * FROM (SELECT 1) AS _sub LIMIT 5"
-    assert ";)" not in sent
+    assert sent == "SELECT * FROM (\nSELECT 1\n) AS _sub LIMIT 5"
+    assert ";\n)" not in sent
 
 
 def test_dry_run_strips_trailing_semicolon() -> None:
     connector, cursor = _make_mock_connector()
     connector.dry_run("SELECT 1;  ")
     (sent,), _ = cursor.execute.call_args
-    assert sent == "SELECT * FROM (SELECT 1) AS _sub LIMIT 0"
+    assert sent == "SELECT * FROM (\nSELECT 1\n) AS _sub LIMIT 0"
 
 
 def test_helper_preserves_semicolon_inside_string_literal() -> None:
```

**File**: `core/wren/tests/unit/test_postgres_semicolon_unlimited.py` (modified, +31/-1)
```diff
@@ -59,5 +59,35 @@ def test_limited_query_wraps_after_strip(monkeypatch):
     connector.query("SELECT 1 AS x;", limit=9)
 
     cursor.execute.assert_called_once_with(
-        "SELECT * FROM (SELECT 1 AS x) AS _sub LIMIT 9"
+        "SELECT * FROM (\nSELECT 1 AS x\n) AS _sub LIMIT 9"
+    )
+
+
+def test_query_limit_survives_trailing_line_comment(monkeypatch):
+    """Trailing `--` must not eat the wrap (same shape as athena.py #2457)."""
+    connector = PostgresConnector.__new__(PostgresConnector)
+    connector.connection = MagicMock()
+    cursor = MagicMock()
+    connector.connection.cursor.return_value.__enter__.return_value = cursor
+    monkeypatch.setattr(
+        postgres_mod, "_build_pg_arrow_table", lambda cur: pa.table({"x": [1]})
+    )
+
+    connector.query("SELECT 1 AS x -- pick", limit=9)
+
+    cursor.execute.assert_called_once_with(
+        "SELECT * FROM (\nSELECT 1 AS x -- pick\n) AS _sub LIMIT 9"
+    )
+
+
+def test_dry_run_limit_survives_trailing_line_comment():
+    connector = PostgresConnector.__new__(PostgresConnector)
+    connector.connection = MagicMock()
+    cursor = MagicMock()
+    connector.connection.cursor.return_value.__enter__.return_value = cursor
+
+    connector.dry_run("SELECT 1 AS x -- pick")
+
+    cursor.execute.assert_called_once_with(
+        "SELECT * FROM (\nSELECT 1 AS x -- pick\n) AS _sub LIMIT 0"
     )
```

#### Recent Merged Pull Requests:
- **PR #2770** (2026-09-30): fix(wren): write project files as UTF-8 so init/build work on Windows (@MohammadHijjawi97)
- **PR #2766** (2026-09-29): deps(core): upgrade DataFusion to 55.1 (@goldmedal)
- **PR #2765** (2026-09-29): test(core): simplify multi-relationship calc-col test to plain #[tokio::test] (@jackjin1997)
- **PR #2764** (2026-09-30): fix(sdk): read project artifacts as UTF-8 (@dafyy321-pixel)
- **PR #2762** (2026-09-29): fix(core): preserve string literals when removing MDL qualifiers (@dafyy321-pixel)
- **PR #2757** (2026-09-23): feat(genbi): support composed components with Warble 0.14 (@goldmedal)
- **PR #2755** (2026-09-24): docs(mdl): correct the relationship-handle traversal claim (@jackjin1997)
- **PR #2753** (2026-09-24): feat(wasm): expose cube orderBy in TypeScript SDK types (#2700) (@FrancescoCastaldi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
