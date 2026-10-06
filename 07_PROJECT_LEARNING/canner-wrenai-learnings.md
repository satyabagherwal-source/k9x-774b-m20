# Forensic Learning Record (Deep Inspection): Canner/WrenAI

> **Canonical Artifact**: `07_PROJECT_LEARNING/canner-wrenai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Canner/WrenAI](https://github.com/Canner/WrenAI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:14:57.922Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Canner/WrenAI`
- **Description**: GenBI (Generative BI) for AI agents, an open-source, governed text-to-SQL through an open context layer that turns natural-language questions into trusted dashboards, charts, and SQL across 20+ data sources, such as BigQuery, Snowflake, PostgreSQL, ClickHouse, Amazon Redshift, Databricks and more.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 17800 stars

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
    let python_binding = if input.value {
        quote! {
            #[pyclass(eq, eq_int)]
        }
    } else {
        quote! {}
    };

    let expanded = quote! {
        #python_binding
        #[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Hash, Clone, Copy)]
        #[serde(rename_all = "SCREAMING_SNAKE_CASE")]
        pub enum JoinType {
            #[serde(alias = "one_to_one")]
            OneToOne,
            #[serde(alias = "one_to_many")]
            OneToMany,
            #[serde(alias = "many_to_one")]
            ManyToOne,
            #[serde(alias = "many_to_many")]
            ManyToMany,
        }
    };
    proc_macro::TokenStream::from(expanded)
}

/// This macro generates a struct for `Measure` (part of a Cube).
/// If python_binding is true, it will generate a `pyclass` attribute.
#[proc_macro]
pub fn measure(python_binding: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(python_binding as LitBool);
    let python_binding = if input.value {
        quote! { #[pyclass] }
    } else {
        quote! {}
    };

    let expanded = quote! {
        #python_binding
        #[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Hash, Clone)]
        #[serde(rename_all = "camelCase")]
        pub struct Measure {
            pub name: String,
            pub expression: String,
            pub r#type: String,
        }
    };
    proc_macro::TokenStream::from(expanded)
}

/// This macro generates a struct for `CubeDimension` (a grouping attribute in a Cube).
/// If python_binding is true, it will generate a `pyclass` attribute.
#[proc_macro]
pub fn cube_dimension(python_binding: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(python_binding as LitBool);
    let python_binding = if input.value {
        quote! { #[pyclass] }
    } else {
        quote! {}
    };

    let expanded = quote! {
        #python_binding
        #[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Hash, Clone)]
   
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
            _ => Err(ParsedDataSourceError::new(&format!(
                "Unknown data source: {}",
                s
            ))),
        }
    }
}

mod table_reference {
    use serde::{self, Deserialize, Deserializer, Serialize, Serializer};

    use crate::mdl::utils::{parse_identifiers_normalized, quote_identifier};

    #[derive(Deserialize, Serialize, Default)]
    struct TableReference {
        catalog: Option<String>,
        schema: Option<String>,
        table: Option<String>,
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
    where
        D: Deserializer<'de>,
    {
        Ok(Option::deserialize(deserializer)?
            .map(
                |TableReference {
                     catalog,
                     schema,
                     table,
                 }| {
                    [catalog, schema, table]
                        .into_iter()
                        .filter_map(|s| {
                            s.filter(|x| !x.is_empty())
                                .map(|x| quote_identifier(&x).to_string())
                        })
                        .collect::<Vec<_>>()
                        .join(".")
                },
            )
            .filter(|s| !s.is_empty()))
    }

    pub fn serialize<S>(table_ref: &Option<String>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        if let Some(table_ref) = table_ref {
            let parts: Vec<String> =
                parse_identifiers_normalized(table_ref, false).map_err(|e| {
                    serde::ser::Error::custom(format!(
                        "Failed to parse table reference: {table_ref}, error: {e}"
                    ))
                })?;
            if parts.len() > 3 {
                return Err(serde::ser::Error::custom(format!(
                    "Invalid table reference: {table_ref}"
                )));
            }
            let table_ref = if parts.len() == 3 {
              
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

### Core Architecture Module: `core/wren-core-py/src/context.rs`
```
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

use crate::errors::CoreError;
use crate::manifest::to_manifest;
use crate::remote_functions::PyRemoteFunction;
use futures::TryStreamExt;
use log::debug;
use pyo3::types::{PyAnyMethods, PyFrozenSet, PyFrozenSetMethods, PyTuple};
use pyo3::Python;
use pyo3::{pyclass, pymethods, Py, PyAny, PyErr, PyResult};
use std::collections::HashMap;
use std::hash::Hash;
use std::ops::ControlFlow;
use std::str::FromStr;
use std::sync::{Arc, Mutex, PoisonError};
use std::vec;
use tokio::runtime::Runtime;
use wren_core::array::{AsArray, GenericByteArray};
use wren_core::ast::{
    visit_statements_mut, Expr, LimitClause, Statement, Value, ValueWithSpan,
};
use wren_core::datatypes::GenericStringType;
use wren_core::dialect::GenericDialect;
use wren_core::ipc::writer::StreamWriter;
use wren_core::mdl::context::apply_wren_on_ctx;
use wren_core::mdl::function::{
    ByPassAggregateUDF, ByPassScalarUDF, ByPassWindowFunction, FunctionType,
    RemoteFunction,
};
use wren_core::{
    mdl, AggregateUDF, AnalyzedWrenMDL, CsvReadOptions, ParquetReadOptions, ScalarUDF,
    SessionConfig, WindowUDF,
};
use wren_core_base::mdl::DataSource;

/// Process-wide Tokio runtime, recreated lazily after a fork.
///
/// A child inherits this handle but not the runtime's worker threads, so a PID
/// mismatch installs a new runtime. The inherited handle is leaked because
/// dropping it may wait on nonexistent workers. The mutex is released before
/// `block_on`; fork safety requires it to be unlocked when `fork()` occurs.
/// Runtime creation failures are returned as Python errors.
static RUNTIME: Mutex<Option<(u32, Arc<Runtime>)>> = Mutex::new(None);

fn shared_runtime() -> PyResult<Arc<Runtime>> {
    let mut guard = RUNTIME.lock().unwrap_or_else(PoisonError::into_inner);
    match guard.as_ref() {
        Some((pid, rt)) if *pid == std::process::id() => Ok(Arc::clone(rt)),
        _ => {
            let rt = Arc::new(Runtime::new().map_err(CoreError::from)?);
            if let Some(stale) = guard.replace((std::process::id(), Arc::clone(&rt))) {
                std::mem::forget(stale);
            }
            Ok(rt)
        }
    }
}

/// The Python wrapper for the Wren Core session context.
///
/// Calls on one context can run concurrently. Each `transform_sql` applies
/// the MDL onto a private top-level catalog snapshot (see
/// `clone_catalog_list` in wren-core's `mdl::context`), and analyzer rules
/// keep their mutable state per invocation. See the Concurrency section in
/// `README.md` for the supported operation contract. `load_mdl` takes
/// `&mut self`, so PyO3's exclusive borrow rejects overlapping calls on the
/// same context with a `RuntimeError`.
#[pyclass(name = "SessionContext")]
pub struct PySessionContext {
    /// Base context — physical tables are registered here.
    /// Used as the source for `load_mdl()` (two-phase init).
    base_ctx: wren_core::SessionContext,
    ctx: wren_core::SessionContext,
    exec_ctx: wren_core::SessionContext,
    mdl: Arc<AnalyzedWrenMDL>,
    properties: Arc<HashMap<String, Option<String>>>,
}

impl Hash for PySessionContext {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.mdl.hash(state);
    }
}

impl Default for PySessionContext {
    fn default() -> Self {
        let ctx = wren_core::SessionContext::new();
        Self {
            base_ctx: ctx.clone(),
            ctx: ctx.clone(),
            exec_ctx: ctx,
            mdl: Arc::new(AnalyzedWrenMDL::default()),
            properties: Arc::new(HashMap::new()),
        }
    }
}

#[pymethods]
impl PySessionContext {
    /// Create a new session context.
    ///
    /// if `mdl_base64` is provided, the session context will be created with the given MDL. Otherwise, an empty MDL will be created.
    /// if `remote_functions_path` is provided, the session context will be created with the remote functions defined in the CSV file.
    #[new]
    #[pyo3(signature = (mdl_base64=None, remote_functions_path=None, properties=None, data_source=None))]
    pub fn new(
        py: Python<'_>,
        mdl_base64: Option<&str>,
        remote_functions_path: Option<&str>,
        properties: Option<Py<PyAny>>,
        data_source: Option<&str>,
    ) -> PyResult<Self> {
        let runtime = shared_runtime()?;

        let Some(mdl_base64) = mdl_base64 else {
            let data_source = data_source
                .map(|ds| DataSource::from_str(ds).map_err(CoreError::from))
                .transpose()?;
            let config = SessionConfig::default().with_information_schema(true);
            let ctx = wren_core::mdl::create_wren_ctx(Some(config), data_source.as_ref());
            Self::register_function_by_data_source(
                py,
                data_source.as_ref(),
                remote_functions_path,
                &ctx,
            )?;
            return Ok(Self {
                base_ctx: ctx.clone(),
                ctx: ctx.clone(),
                exec_ctx: ctx,
                mdl: Arc::new(AnalyzedWrenMDL::default()),
                properties: Arc::new(HashMap::new()),
            });
        };

        let manifest = to_manifest(mdl_base64)?;

        // If the manifest has a data source, use it.
        // Otherwise, if the data_source parameter is provided, use it.
        // Otherwise, use None.
        let data_source = if let Some(ds) = &manifest.data_source {
            Some(*ds)
        } else if let Some(ds_str) = data_source {
            Some(DataSource::from_str(ds_str).map_err(CoreError::from)?)
        } else {
            None
        };

        let config = SessionConfig::default().with_information_schema(true);
        let ctx = wren_core::mdl::create_wren_ctx(Some(config), data_source.as_ref());

        Self::register_function_by_data_source(
            py,
            data_source.as_ref(),
            remote_functions_path,
            &ctx,
        )?;

        {
            let properties_map = if let Some(obj) = properties {
                let obj = obj.as_ref();
                if obj.is_none(py) {
                    HashMap::new()
                } else {
                    let frozenset = obj.cast_bound::<PyFrozenSet>(py)?;
                    let mut map = HashMap::new();
                    for item in frozenset.iter() {
                        match item.as_any().clone().cast_into::<PyTuple>() {
                            Ok(tuple) => {
                                if tuple.len()? != 2 {
                                    return Err(CoreError::new(
                                        "Properties must be a tuple of (key, value)",
                                    )
                                    .into());
                                }
                                let key = tuple.get_item(0)?.to_string();
                                let value = tuple.get_item(1)?.to_string();
                                map.insert(key, Some(value));
                            }
                            Err(_) => {
                                return Err(CoreError::new(
                                    "Properties must be a tuple of (key, value)",
                                )
                                .into());
                            }
                        }
                    }
                    map
                }
            } else {
                HashMap::new()
            };
            let properties_ref = Arc::new(properties_map);
            match AnalyzedWrenMDL::analyze(
                manifest,
                Arc::clone(&properties_ref),
                mdl::context::Mode::Unparse,
            ) {
                Ok(analyzed_mdl) => {
                    let analyzed_mdl = Arc::new(analyzed_mdl);
                    let unparser_ctx = py
                        .detach(|| {
                            runtime.block_on(apply_wren_on_ctx(
                                &ctx,
                                Arc::clone(&analyzed_mdl),
                                Arc::clone(&properties_ref),
                                mdl::context::Mode::Unparse,
                            ))
                        })
                        .map_err(CoreError::from)?;

                    let exec_ctx = py
                        .detach(|| {
                            runtime.block_on(apply_wren_on_ctx(
                                &ctx,
                                Arc::clone(&analyzed_mdl),
                                Arc::clone(&properties_ref),
                                mdl::context::Mode::LocalRuntime,
                            ))
                        })
                        .map_err(CoreError::from)?;

                    Ok(Self {
                        base_ctx: ctx.clone(),
                        ctx: unparser_ctx,
                        exec_ctx,
                        mdl: analyzed_mdl,
                        properties: properties_ref,
                    })
                }
                Err(e) => Err(CoreError::new(
                    format!("Failed to analyze MDL: {}", e).as_str(),
                )
                .into()),
            }
        }
    }

    /// Transform t
```

### Core Architecture Module: `core/wren-core-py/src/cube.rs`
```
use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use wren_core::mdl::{cube_query_to_sql as cube_query_to_sql_rs, CubeQuery};
use wren_core_base::mdl::manifest::Manifest;

/// Translate a structured CubeQuery (JSON) into a SQL string using the cube
/// definitions in the supplied manifest (JSON).
///
/// Both inputs are JSON strings so the binding stays serde-driven and
/// callers don't need to construct typed Rust objects from Python.
///
/// Raises `ValueError` on bad JSON or on translation errors (unknown
/// cube/measure/dimension, cyclic derived measures, …).
#[pyfunction]
pub fn cube_query_to_sql(cube_query_json: &str, manifest_json: &str) -> PyResult<String> {
    let query: CubeQuery = serde_json::from_str(cube_query_json)
        .map_err(|e| PyValueError::new_err(format!("Invalid CubeQuery JSON: {e}")))?;
    let manifest: Manifest = serde_json::from_str(manifest_json)
        .map_err(|e| PyValueError::new_err(format!("Invalid manifest JSON: {e}")))?;
    cube_query_to_sql_rs(&query, &manifest)
        .map_err(|e| PyValueError::new_err(e.to_string()))
}

```

### Core Architecture Module: `core/wren-core-py/src/errors.rs`
```
use base64::DecodeError;
use pyo3::exceptions::PyException;
use pyo3::PyErr;
use std::num::ParseIntError;
use std::string::FromUtf8Error;
use thiserror::Error;
use wren_core::DataFusionError;
use wren_core::WrenError;
use wren_core_base::mdl::ParsedDataSourceError;

#[derive(Error, Debug, PartialEq)]
#[error("{message}")]
pub struct CoreError {
    message: String,
}

impl CoreError {
    pub fn new(msg: &str) -> CoreError {
        CoreError {
            message: msg.to_string(),
        }
    }
}

impl From<CoreError> for PyErr {
    fn from(err: CoreError) -> Self {
        PyException::new_err(err.to_string())
    }
}

impl From<PyErr> for CoreError {
    fn from(err: PyErr) -> Self {
        CoreError::new(&format!("PyError: {}", &err))
    }
}

impl From<DecodeError> for CoreError {
    fn from(err: DecodeError) -> Self {
        CoreError::new(&format!("Base64 decode error: {}", err))
    }
}

impl From<FromUtf8Error> for CoreError {
    fn from(err: FromUtf8Error) -> Self {
        CoreError::new(&format!("FromUtf8Error: {}", err))
    }
}

impl From<serde_json::Error> for CoreError {
    fn from(err: serde_json::Error) -> Self {
        CoreError::new(&format!("Serde JSON error: {}", err))
    }
}

impl From<DataFusionError> for CoreError {
    fn from(err: DataFusionError) -> Self {
        if let DataFusionError::Context(_, ee) = &err {
            if let DataFusionError::External(we) = ee.as_ref() {
                if let Some(we) = we.downcast_ref::<WrenError>() {
                    return CoreError::new(we.to_string().as_str());
                }
            }
        }
        CoreError::new(err.to_string().as_str())
    }
}

impl From<wren_core::parser::ParserError> for CoreError {
    fn from(err: wren_core::parser::ParserError) -> Self {
        CoreError::new(&format!("Parser error: {}", err))
    }
}

impl From<ParseIntError> for CoreError {
    fn from(err: ParseIntError) -> Self {
        CoreError::new(&format!("ParseIntError: {}", err))
    }
}

impl From<csv::Error> for CoreError {
    fn from(err: csv::Error) -> Self {
        CoreError::new(&format!("CSV error: {}", err))
    }
}

impl From<std::io::Error> for CoreError {
    fn from(err: std::io::Error) -> Self {
        CoreError::new(&format!("IO error: {}", err))
    }
}

impl From<ParsedDataSourceError> for CoreError {
    fn from(err: ParsedDataSourceError) -> Self {
        CoreError::new(&format!("DataSource error: {}", err))
    }
}

```

### Core Architecture Module: `core/wren-core-py/src/extractor.rs`
```
use crate::errors::CoreError;
use crate::manifest::to_manifest;
use datafusion_common::config::Dialect;
use pyo3::{pyclass, pymethods};
use std::collections::hash_map::Entry;
use std::collections::{BTreeSet, HashMap, HashSet};
use std::ops::ControlFlow;
use std::sync::Arc;
use wren_core::ast::{visit_relations, ObjectName};
use wren_core::dialect::GenericDialect;
use wren_core::mdl::manifest::{Cube, Model, Relationship, View};
use wren_core::mdl::WrenMDL;
use wren_core::parser::Parser;
use wren_core_base::mdl::Manifest;

#[pyclass]
#[derive(Clone)]
#[pyo3(name = "ManifestExtractor")]
pub struct PyManifestExtractor {
    mdl: Arc<WrenMDL>,
}

#[pymethods]
impl PyManifestExtractor {
    #[new]
    #[pyo3(signature = (mdl_base64=None))]
    pub fn new(mdl_base64: Option<&str>) -> Result<Self, CoreError> {
        mdl_base64
            .ok_or_else(|| CoreError::new("Expected a valid base64 encoded string for the model definition, but got None."))
            .and_then(to_manifest)
            .map(|manifest| Self {
                mdl: WrenMDL::new_ref(manifest),
            })
    }

    /// parse the given SQL and return the list of used table name.
    pub fn resolve_used_table_names(&self, sql: &str) -> Result<Vec<String>, CoreError> {
        resolve_used_table_names(&self.mdl, sql)
    }

    /// Given a used dataset list, extract manifest by removing unused datasets.
    /// If a model is related to another dataset, both datasets will be kept.
    /// The relationship between of them will be kept as well.
    /// A dataset could be model, view.
    pub fn extract_by(&self, used_datasets: Vec<String>) -> Result<Manifest, CoreError> {
        extract_manifest(&self.mdl, &used_datasets)
    }
}

fn resolve_used_table_names(mdl: &WrenMDL, sql: &str) -> Result<Vec<String>, CoreError> {
    let mut config = wren_core::SessionConfig::new();
    config.options_mut().sql_parser.enable_ident_normalization = false;
    let ctx_state = wren_core::SessionContext::new_with_config(config).state();
    ctx_state
        .sql_to_statement(sql, &Dialect::Generic {})
        .map_err(CoreError::from)
        .and_then(|stmt| {
            ctx_state
                .resolve_table_references(&stmt)
                .map_err(CoreError::from)
        })
        .map(|tables| {
            tables
                .iter()
                .filter(|t| {
                    t.catalog().is_none_or(|catalog| catalog == mdl.catalog())
                        && t.schema().is_none_or(|schema| schema == mdl.schema())
                })
                .map(|t| t.table().to_string())
                .collect()
        })
}

/// Parse a RLAC condition expression and return the model names referenced by
/// subqueries inside it. The condition is parsed with the same `GenericDialect`
/// used by wren-core so session-property placeholders (`@session_id`) are
/// tolerated. Tables qualified with a non-matching catalog/schema are ignored,
/// mirroring `resolve_used_table_names`.
fn resolve_condition_models(mdl: &WrenMDL, condition: &str) -> Vec<String> {
    let dialect = GenericDialect {};
    let expr = match Parser::new(&dialect)
        .try_with_sql(condition)
        .and_then(|mut parser| parser.parse_expr())
    {
        Ok(expr) => expr,
        Err(_) => return vec![],
    };
    let mut tables = Vec::new();
    let _ = visit_relations(&expr, |name: &ObjectName| {
        if let Some(table) = matched_table_name(mdl, name) {
            tables.push(table);
        }
        ControlFlow::<()>::Continue(())
    });
    tables
}

/// Resolve an `ObjectName` against the manifest's catalog/schema, returning the
/// bare table name when it belongs to this manifest.
fn matched_table_name(mdl: &WrenMDL, name: &ObjectName) -> Option<String> {
    let parts: Vec<&str> = name
        .0
        .iter()
        .filter_map(|part| part.as_ident().map(|ident| ident.value.as_str()))
        .collect();
    let (catalog, schema, table) = match parts.as_slice() {
        [table] => (None, None, *table),
        [schema, table] => (None, Some(*schema), *table),
        [catalog, schema, table] => (Some(*catalog), Some(*schema), *table),
        _ => return None,
    };
    let catalog_matches = catalog.is_none_or(|c| c == mdl.catalog());
    let schema_matches = schema.is_none_or(|s| s == mdl.schema());
    (catalog_matches && schema_matches).then(|| table.to_string())
}

fn extract_manifest(
    mdl: &WrenMDL,
    used_datasets: &[String],
) -> Result<Manifest, CoreError> {
    let extracted_models = extract_models(mdl, used_datasets);
    let (used_views, models_of_views) = extract_views(mdl, used_datasets);
    let used_models = [extracted_models, models_of_views]
        .concat()
        .into_iter()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let used_relationships = extract_relationships(mdl, &used_models);
    let used_cubes = extract_cubes(mdl, &used_models, &used_views);
    Ok(Manifest {
        layout_version: mdl.manifest.layout_version,
        catalog: mdl.catalog().to_string(),
        schema: mdl.schema().to_string(),
        models: used_models,
        relationships: used_relationships,
        views: used_views,
        data_source: mdl.data_source(),
        cubes: used_cubes,
    })
}

fn extract_models(mdl: &WrenMDL, used_datasets: &[String]) -> Vec<Arc<Model>> {
    let mut used_set: HashMap<String, usize> =
        used_datasets.iter().map(|s| (s.clone(), 0)).collect();
    let mut stack: Vec<String> = used_datasets.to_vec();
    while let Some(dataset_name) = stack.pop() {
        if let Some(model) = mdl.get_model(&dataset_name) {
            let related_via_relationship = model
                .columns
                .iter()
                .filter_map(|col| {
                    col.relationship
                        .as_ref()
                        .and_then(|rel_name| mdl.get_relationship(rel_name))
                })
                .flat_map(|rel| rel.models.clone());
            // A RLAC condition may reference other models through subqueries
            // (e.g. `id IN (SELECT id FROM other_model)`). Those models must be
            // kept even when the outer SQL doesn't reference them directly,
            // otherwise the RLAC subquery analysis in wren-core fails.
            let related_via_rlac = model
                .row_level_access_controls()
                .iter()
                .flat_map(|rlac| resolve_condition_models(mdl, &rlac.condition));
            related_via_relationship
                .chain(related_via_rlac)
                .for_each(|related| {
                    if let Entry::Vacant(vacant) = used_set.entry(related) {
                        let key = vacant.key().clone();
                        vacant.insert(0);
                        stack.push(key);
                    }
                });
        }
    }
    mdl.models()
        .iter()
        .filter(|model| used_set.contains_key(model.name()))
        .cloned()
        .collect()
}

fn extract_views(
    mdl: &WrenMDL,
    used_datasets: &[String],
) -> (Vec<Arc<View>>, Vec<Arc<Model>>) {
    let used_set: HashSet<&str> = used_datasets.iter().map(String::as_str).collect();
    let models = used_set
        .iter()
        .filter_map(|&dataset_name| {
            mdl.get_view(dataset_name).and_then(|view| {
                resolve_used_table_names(mdl, view.statement.as_str())
                    .ok()
                    .map(|used_tables| extract_models(mdl, &used_tables))
            })
        })
        .flatten()
        .collect::<Vec<_>>();
    let views = mdl
        .views()
        .iter()
        .filter(|view| used_set.contains(view.name()))
        .cloned()
        .collect();

    (views, models)
}

fn extract_relationships(
    mdl: &WrenMDL,
    used_models: &[Arc<Model>],
) -> Vec<Arc<Relationship>> {
    let model_names: Vec<_> = used_models.iter().map(|m| m.name.as_str()).collect();
    mdl.relationships()
        .iter()
        .filter(|rel| rel.models.iter().any(|m| model_names.contains(&m.as_str())))
        .cloned()
        .collect()
}

/// Keep only cubes whose `baseObject` resolves to a model or view that survived
/// extraction. A cube query references the cube's `baseObject` by name (not the
/// cube), so the base model is always pulled in when the cube is queried —
/// dropping orphaned cubes is therefore safe and avoids wren-core failing MDL
/// analysis with "baseObject is not a defined Model or View" when the base
/// model gets pruned (e.g. a query touching only unrelated tables, or a scalar
/// `SELECT 1` that references no model).
fn extract_cubes(
    mdl: &WrenMDL,
    used_models: &[Arc<Model>],
    used_views: &[Arc<View>],
) -> Vec<Arc<Cube>> {
    let mut base_object_names: HashSet<&str> =
        used_models.iter().map(|m| m.name.as_str()).collect();
    base_object_names.extend(used_views.iter().map(|v| v.name.as_str()));
    mdl.manifest
        .cubes
        .iter()
        .filter(|cube| base_object_names.contains(cube.base_object.as_str()))
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use crate::extractor::PyManifestExtractor;
    use crate::manifest::to_json_base64;
    use rstest::{fixture, rstest};
    use std::iter::Iterator;
    use wren_core::mdl::manifest::{DataSource, JoinType};
    use wren_core_base::mdl::builder::{
        ColumnBuilder, CubeBuilder, ManifestBuilder, ModelBuilder, RelationshipBuilder,
        ViewBuilder,
    };

    #[fixture]
    pub fn mdl_base64() -> String {
        let customer = ModelBuilder::new("customer")
            .table_reference("main.customer")
            .column(ColumnBuilder::new("c_custkey", "integer").build())
            .column(
                ColumnBuilder::new("orders", "orders")
                    .relationship("customer_orders")
                    .build(),
            )
            .build();
        let orders = ModelBuilder::new("orders")
            
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

### Incident Patch 1: `a834e21e` (2026-10-05)
**Commit Message**: fix(memory): carry the reindex failure reason out of the watch loop (#2767)

**File**: `core/wren/src/wren/memory/cli.py` (modified, +16/-4)
```diff
@@ -723,13 +723,24 @@ def _reindex() -> None:
     def _on_event(event: str) -> None:
         if event == "change-detected":
             typer.echo("Change detected — reindexing...", err=True)
-        elif event == "reindex-error":
+        elif event == "stopped":
+            typer.echo("Stopped watching.", err=True)
+
+    def _on_error(event: str, exc: BaseException) -> None:
+        if event == "reindex-error":
+            # The reason is the actionable half of this message, and the only
+            # half the event name cannot carry — except for typer.Exit, where
+            # _reindex has already echoed the real error and str(exc) would
+            # only repeat the exit code ("Reindex failed: 1").
+            reason = (
+                ""
+                if isinstance(exc, typer.Exit)
+                else f": {str(exc) or type(exc).__name__}"
+            )
             typer.echo(
-                "Reindex failed; change kept pending, will retry next poll.",
+                f"Reindex failed{reason}; change kept pending, will retry next poll.",
                 err=True,
             )
-        elif event == "stopped":
-            typer.echo("Stopped watching.", err=True)
 
     typer.echo(
         f"Watching {project_path} every {max(interval, 1.0):g}s "
@@ -743,6 +754,7 @@ def _on_event(event: str) -> None:
         max_polls=max_polls,
         reindex_on_start=reindex_on_start,
         on_event=_on_event,
+        on_error=_on_error,
     )
     if max_polls is not None:
         typer.echo(
```

**File**: `core/wren/src/wren/memory/watch.py` (modified, +23/-2)
```diff
@@ -104,6 +104,7 @@ def poll_once(
     reindex: Callable[[], object],
     *,
     on_event: Callable[[str], None] | None = None,
+    on_error: Callable[[str, BaseException], None] | None = None,
 ) -> bool:
     """Run a single poll cycle. Returns True iff a reindex was triggered.
 
@@ -113,6 +114,12 @@ def poll_once(
     pending and is retried on the next poll — a transient reindex failure can
     never silently drop an update. ``on_event`` receives short status strings
     for logging.
+
+    ``on_error`` receives the status string and the exception itself for the
+    reindex failure. ``on_event`` alone cannot tell a user *why* the index
+    stopped updating — the failure message is the actionable part, and it is
+    what every other ``wren memory`` command prints. The exception is still
+    re-raised, so a caller that owns the loop keeps its retry behaviour.
     """
     state.polls += 1
     current = compute_fingerprint(project_path)
@@ -123,10 +130,12 @@ def poll_once(
         on_event("change-detected")
     try:
         reindex()
-    except Exception:  # noqa: BLE001 — surface count, keep change pending for retry
+    except Exception as exc:  # noqa: BLE001 — surface count, keep change pending for retry
         state.errors += 1
         if on_event is not None:
             on_event("reindex-error")
+        if on_error is not None:
+            on_error("reindex-error", exc)
         raise
     # Only advance the baseline after a clean reindex.
     state.fingerprint = current
@@ -146,6 +155,7 @@ def watch_loop(
     max_polls: int | None = None,
     reindex_on_start: bool = False,
     on_event: Callable[[str], None] | None = None,
+    on_error: Callable[[str, BaseException], None] | None = None,
     sleep: Callable[[float], None] = time.sleep,
 ) -> WatchState:
     """Poll ``project_path`` and reindex on change until interrupted.
@@ -160,6 +170,11 @@ def watch_loop(
     reindex_on_start:
         Reindex immediately on startup regardless of change, so the index is
         known-fresh before the first poll interval elapses.
+    on_error:
+        Forwarded to :func:`poll_once`, which reports the reindex exception
+        there. The loop deliberately does not report it a second time when the
+        exception reaches it as a re-raise, so a failing reindex produces one
+        message per attempt rather than two.
     sleep:
         Injectable sleep, so tests can drive the loop without real delays.
     """
@@ -170,7 +185,13 @@ def watch_loop(
     try:
         while max_polls is None or state.polls < max_polls:
             try:
-                poll_once(project_path, state, reindex, on_event=on_event)
+                poll_once(
+                    project_path,
+                    state,
+                    reindex,
+                    on_event=on_event,
+                    on_error=on_error,
+                )
             except Exception:
                 # A transient reindex/poll failure must not kill the watcher.
                 # poll_once keeps the old fingerprint on reindex failure, so
```

**File**: `core/wren/tests/unit/test_memory_watch.py` (modified, +99/-0)
```diff
@@ -200,6 +200,82 @@ def flaky_reindex():
     assert "error" in events
 
 
+# ── failure reporting ──────────────────────────────────────────────────────
+
+
+def test_poll_once_reports_reindex_reason_to_on_error(tmp_path):
+    """``on_event`` can only name the failure; ``on_error`` carries the reason.
+
+    The reason is what a user needs: it is the same message ``wren memory
+    index`` prints, and the watcher is the command left running unattended.
+    """
+    _touch_mdl(tmp_path, '{"v": 1}')
+    reason = RuntimeError("the onnx backend implements mean pooling")
+    seen: list[tuple[str, BaseException]] = []
+
+    def reindex():
+        raise reason
+
+    with pytest.raises(RuntimeError):
+        poll_once(
+            tmp_path,
+            WatchState(fingerprint=""),
+            reindex,
+            on_error=lambda event, exc: seen.append((event, exc)),
+        )
+
+    assert seen == [("reindex-error", reason)]
+
+
+def test_watch_loop_reports_reindex_reason_once_per_attempt(tmp_path):
+    """Each retry explains itself exactly once — no silent loop, no duplicate."""
+    _touch_mdl(tmp_path, '{"v": 1}')
+    messages: list[str] = []
+    attempts: list[int] = []
+
+    def always_fail():
+        attempts.append(1)
+        raise RuntimeError(f"attempt {len(attempts)}: bad embedding config")
+
+    state = watch_loop(
+        tmp_path,
+        always_fail,
+        interval=5.0,
+        max_polls=2,
+        reindex_on_start=True,
+        on_error=lambda event, exc: messages.append(f"{event}: {exc}"),
+        sleep=lambda _s: None,
+    )
+
+    assert state.errors == 2
+    assert messages == [
+        "reindex-error: attempt 1: bad embedding config",
+        "reindex-error: attempt 2: bad embedding config",
+    ]
+
+
+def test_watch_loop_on_event_still_works_without_on_error(tmp_path):
+    """The new callback is opt-in: a one-argument ``on_event`` keeps working."""
+    _touch_mdl(tmp_path, '{"v": 1}')
+    events: list[str] = []
+
+    def always_fail():
+        raise RuntimeError("boom")
+
+    state = watch_loop(
+        tmp_path,
+        always_fail,
+        interval=5.0,
+        max_polls=2,
+        reindex_on_start=True,
+        on_event=events.append,
+        sleep=lambda _s: None,
+    )
+
+    assert state.errors == 2
+    assert "reindex-error" in events
+
+
 def test_watch_loop_reindex_on_start(tmp_path):
     _touch_mdl(tmp_path)
     calls = []
@@ -240,3 +316,26 @@ def test_cli_watch_grep_backend_exits(tmp_path, monkeypatch):
     result = runner.invoke(app, ["memory", "watch", "--max-polls", "1"])
     assert result.exit_code == 1
     assert "grep backend" in result.output
+
+
+def test_cli_watch_truncated_mdl_reports_reason_without_exit_code(
+    tmp_path, monkeypatch
+):
+    """A truncated ``target/mdl.json`` surfaces the parse error, not "1".
+
+    ``_load_manifest`` already echoes the real error and raises ``typer.Exit``;
+    the watcher must not append a redundant exit-code reason ("Reindex failed:
+    1") on top of it.
+    """
+    monkeypatch.setattr(
+        "wren.memory.index_backend.resolve_backend", lambda *_a, **_k: "lancedb"
+    )
+    monkeypatch.setenv("WREN_PROJECT_HOME", str(tmp_path))
+    _touch_mdl(tmp_path, '{"models": [{"name": "or')  # truncated JSON
+    result = runner.invoke(
+        app, ["memory", "watch", "--reindex-on-start", "--max-polls", "1"]
+    )
+    assert result.exit_code == 0
+    assert "invalid JSON" in result.output
+    assert "Reindex failed; change kept pending" in result.output
+    assert "Reindex failed: 1" not in result.output
```

---

### Incident Patch 2: `e65351eb` (2026-10-05)
**Commit Message**: fix(context): keep cubes when importing an MDL with init --from-mdl (#2771)

**File**: `core/wren/src/wren/context.py` (modified, +26/-0)
```diff
@@ -5,6 +5,7 @@
 import json
 import os
 import re
+from collections.abc import Iterable
 from dataclasses import dataclass
 from pathlib import Path, PurePosixPath, PureWindowsPath
 from typing import Any
@@ -261,6 +262,23 @@ def convert_mdl_to_project(mdl_json: dict) -> list[ProjectFile]:
             )
         )
 
+    # ── Cubes ─────────────────────────────────────────────────
+    for i, cube in enumerate(mdl_json.get("cubes", [])):
+        cube_snake = _convert_keys_to_snake(cube)
+        if "name" not in cube_snake:
+            raise ValueError(f"Cube at index {i} is missing required 'name' field")
+        files.append(
+            ProjectFile(
+                relative_path=f"cubes/{cube_snake['name']}/metadata.yml",
+                content=yaml.dump(
+                    cube_snake,
+                    default_flow_style=False,
+                    sort_keys=False,
+                    allow_unicode=True,
+                ),
+            )
+        )
+
     # ── Relationships ─────────────────────────────────────────
     relationships = mdl_json.get("relationships", [])
     if relationships:
@@ -308,17 +326,21 @@ def write_project_files(
     output_dir: Path,
     *,
     force: bool = False,
+    extra_managed_paths: Iterable[str] = (),
 ) -> None:
     """Write project files to disk.
 
     Args:
         files: List of ProjectFile from convert_mdl_to_project().
         output_dir: Target directory.
         force: If False, raise SystemExit if any target file already exists.
+        extra_managed_paths: Additional top-level paths the caller owns; with
+            ``force`` they are removed before writing (e.g. ``"cubes"``).
     """
     output_dir = Path(output_dir)
     root = output_dir.resolve()
     resolved_files: list[tuple[ProjectFile, Path]] = []
+    seen_targets: set[Path] = set()
 
     for file in files:
         target = (output_dir / file.relative_path).resolve()
@@ -328,6 +350,9 @@ def write_project_files(
             raise SystemExit(f"Error: invalid output path: {file.relative_path!r}")
         if target == root:
             raise SystemExit(f"Error: invalid output path: {file.relative_path!r}")
+        if target in seen_targets:
+            raise SystemExit(f"Error: duplicate output path: {file.relative_path!r}")
+        seen_targets.add(target)
         resolved_files.append((file, target))
 
     if force and output_dir.exists():
@@ -340,6 +365,7 @@ def write_project_files(
             "instructions.md",
             "wren_project.yml",
             "AGENTS.md",
+            *extra_managed_paths,
         }
         if any(f.relative_path == "queries.yml" for f in files):
             managed_paths.add("queries.yml")
```

**File**: `core/wren/src/wren/context_cli.py` (modified, +9/-3)
```diff
@@ -232,18 +232,22 @@ def init(
         mdl_json = json.loads(mdl_path.read_text(encoding="utf-8"))
         files = convert_mdl_to_project(mdl_json)
         try:
-            write_project_files(files, project_path, force=force)
+            write_project_files(
+                files, project_path, force=force, extra_managed_paths=("cubes",)
+            )
         except SystemExit as e:
             typer.echo(str(e), err=True)
             raise typer.Exit(1)
 
         model_count = len(mdl_json.get("models", []))
         view_count = len(mdl_json.get("views", []))
         rel_count = len(mdl_json.get("relationships", []))
+        cube_count = len(mdl_json.get("cubes", []))
 
         typer.echo(f"Imported MDL to YAML project at {project_path}/")
         typer.echo(
-            f"  {model_count} models, {view_count} views, {rel_count} relationships"
+            f"  {model_count} models, {view_count} views, {rel_count} relationships, "
+            f"{cube_count} cubes"
         )
         typer.echo("\nNext steps:")
         typer.echo(f"  wren context validate --path {project_path}")
@@ -1060,7 +1064,9 @@ def _init_from_osi(
 
     files = convert_mdl_to_project(mdl_json)
     try:
-        write_project_files(files, project_path, force=force)
+        write_project_files(
+            files, project_path, force=force, extra_managed_paths=("cubes",)
+        )
     except SystemExit as e:
         typer.echo(str(e), err=True)
         raise typer.Exit(1)
```

**File**: `core/wren/tests/unit/test_convert_mdl.py` (modified, +79/-0)
```diff
@@ -310,6 +310,85 @@ def test_convert_then_build_roundtrip(tmp_path: Path):
     assert rel["joinType"] == "MANY_TO_ONE"
 
 
+def test_convert_then_build_roundtrip_keeps_cubes(tmp_path: Path):
+    """Cubes in the imported MDL are written to cubes/ and survive a rebuild."""
+    cube = {
+        "name": "order_metrics",
+        "baseObject": "orders",
+        "measures": [
+            {"name": "revenue", "expression": "SUM(total)", "type": "DECIMAL"}
+        ],
+        "dimensions": [
+            {"name": "customer_id", "expression": "customer_id", "type": "INTEGER"}
+        ],
+        "timeDimensions": [
+            {"name": "ordered_at", "expression": "order_date", "type": "DATE"}
+        ],
+    }
+    files = convert_mdl_to_project({**SAMPLE_MDL, "layoutVersion": 3, "cubes": [cube]})
+    assert "cubes/order_metrics/metadata.yml" in {f.relative_path for f in files}
+    write_project_files(files, tmp_path)
+
+    assert build_json(tmp_path)["cubes"] == [cube]
+
+
+def test_write_project_files_force_removes_stale_cubes(tmp_path: Path):
+    """A forced re-import drops cubes that are not in the new MDL."""
+    cube = {"name": "order_metrics", "baseObject": "orders"}
+    write_project_files(
+        convert_mdl_to_project({**SAMPLE_MDL, "layoutVersion": 3, "cubes": [cube]}),
+        tmp_path,
+    )
+    assert (tmp_path / "cubes" / "order_metrics" / "metadata.yml").exists()
+
+    write_project_files(
+        convert_mdl_to_project({**SAMPLE_MDL, "layoutVersion": 3}),
+        tmp_path,
+        force=True,
+        extra_managed_paths=("cubes",),
+    )
+
+    assert not (tmp_path / "cubes").exists()
+    assert not build_json(tmp_path).get("cubes")
+
+
+def test_write_project_files_force_keeps_unmanaged_cubes(tmp_path: Path):
+    """A forced write that does not claim cubes/ (e.g. dbt import) keeps it."""
+    cube_file = tmp_path / "cubes" / "order_metrics" / "metadata.yml"
+    cube_file.parent.mkdir(parents=True)
+    cube_file.write_text("name: order_metrics")
+
+    write_project_files(
+        [ProjectFile(relative_path="models/orders/metadata.yml", content="new")],
+        tmp_path,
+        force=True,
+    )
+
+    assert cube_file.read_text() == "name: order_metrics"
+    assert (tmp_path / "models" / "orders" / "metadata.yml").read_text() == "new"
+
+
+def test_write_project_files_rejects_duplicate_paths(tmp_path: Path):
+    cube = {"name": "order_metrics", "baseObject": "orders"}
+    files = convert_mdl_to_project(
+        {**SAMPLE_MDL, "layoutVersion": 3, "cubes": [cube, cube]}
+    )
+
+    with pytest.raises(SystemExit) as exc_info:
+        write_project_files(files, tmp_path)
+
+    assert str(exc_info.value) == (
+        "Error: duplicate output path: 'cubes/order_metrics/metadata.yml'"
+    )
+    assert not any(tmp_path.iterdir())
+
+
+def test_convert_cube_missing_name_raises():
+    mdl = {"catalog": "wren", "schema": "public", "cubes": [{"baseObject": "orders"}]}
+    with pytest.raises(ValueError, match="Cube at index 0"):
+        convert_mdl_to_project(mdl)
+
+
 # ── Edge cases ─────────────────────────────────────────────────────────────
 
 
```

---

### Incident Patch 3: `e467c8db` (2026-10-05)
**Commit Message**: fix(core/wren): bump urllib3, pyjwt and sentence-transformers for security advisories (#2787)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `core/wren/pyproject.toml` (modified, +3/-2)
```diff
@@ -41,10 +41,11 @@ dependencies = [
   "requests>=2.33.0",
   "pyasn1>=0.6.3",
   "pyopenssl>=26.0.0",
-  "urllib3>=2.7.0",
+  "urllib3>=2.8.0",
   "lxml>=6.1.0",
   "cryptography>=48.0.1",
   "pygments>=2.20.0",
+  "pyjwt>=2.15.0",
 ]
 
 [project.optional-dependencies]
@@ -60,7 +61,7 @@ redshift = ["redshift_connector"]
 spark = ["pyspark>=3.5"]
 athena = ["pyathena[pandas]>=3"]
 oracle = ["oracledb>=2"]
-memory = ["lancedb>=0.6", "sentence-transformers>=3.0.0"]
+memory = ["lancedb>=0.6", "sentence-transformers>=5.6.0"]
 # Alternative to `memory`, not an addition: same vectors, no torch. Deliberately
 # excluded from `all`, which installs the sentence-transformers backend.
 memory-onnx = [
```

**File**: `core/wren/uv.lock` (modified, +39/-36)
```diff
@@ -411,7 +411,7 @@ name = "cuda-bindings"
 version = "13.2.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "cuda-pathfinder" },
+    { name = "cuda-pathfinder", marker = "sys_platform != 'emscripten' and sys_platform != 'win32'" },
 ]
 wheels = [
     { url = "https://files.pythonhosted.org/packages/e0/a9/3a8241c6e19483ac1f1dcf5c10238205dcb8a6e9d0d4d4709240dff28ff4/cuda_bindings-13.2.0-cp311-cp311-manylinux_2_24_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:721104c603f059780d287969be3d194a18d0cc3b713ed9049065a1107706759d", size = 5730273, upload-time = "2026-03-11T00:12:37.18Z" },
@@ -444,43 +444,43 @@ wheels = [
 
 [package.optional-dependencies]
 cublas = [
-    { name = "nvidia-cublas", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
-    { name = "nvidia-cuda-nvrtc", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cublas", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
+    { name = "nvidia-cuda-nvrtc", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
 ]
 cudart = [
-    { name = "nvidia-cuda-runtime", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cuda-runtime", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
 ]
 cufft = [
-    { name = "nvidia-cufft", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
-    { name = "nvidia-nvjitlink", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cufft", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
+    { name = "nvidia-nvjitlink", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
 ]
 cufile = [
-    { name = "nvidia-cufile", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cufile", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
 ]
 cupti = [
-    { name = "nvidia-cuda-cupti", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cuda-cupti", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
 ]
 curand = [
-    { name = "nvidia-curand", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-curand", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
 ]
 cusolver = [
-    { name = "nvidia-cublas", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
-    { name = "nvidia-cusolver", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
-    { name = "nvidia-cusparse", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
-    { name = "nvidia-nvjitlink", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cublas", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
+    { name = "nvidia-cusolver", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
+    { name = "nvidia-cusparse", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
+    { name = "nvidia-nvjitlink", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
 ]
 cusparse = [
-    { name = "nvidia-cusparse", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
-    { name = "nvidia-nvjitlink", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cusparse", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
+    { name = "nvidia-nvjitlink", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
 ]
 nvjitlink = [
-    { name = "nvidia-nvjitlink", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-nvjitlink", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'li
```

---

### Incident Patch 4: `2cc843fd` (2026-10-02)
**Commit Message**: fix(context): read v2 cube metadata as UTF-8 (#2769)

**File**: `core/wren/src/wren/context.py` (modified, +1/-1)
```diff
@@ -779,7 +779,7 @@ def _load_cubes_v2(project_path: Path) -> list[dict]:
         if not meta_file.exists():
             continue
         try:
-            data = yaml.safe_load(meta_file.read_text())
+            data = yaml.safe_load(meta_file.read_text(encoding="utf-8"))
         except yaml.YAMLError:
             continue
         if isinstance(data, dict):
```

**File**: `core/wren/tests/unit/test_context.py` (modified, +28/-1)
```diff
@@ -1150,7 +1150,7 @@ def _write_cube(tmp_path: Path, name: str, content: str) -> Path:
     cube_dir = tmp_path / "cubes" / name
     cube_dir.mkdir(parents=True)
     cube_file = cube_dir / "metadata.yml"
-    cube_file.write_text(content)
+    cube_file.write_text(content, encoding="utf-8")
     return cube_file
 
 
@@ -1194,6 +1194,33 @@ def test_load_cubes_v2_parses_metadata_yaml(tmp_path):
     assert cubes[0]["measures"][0]["name"] == "revenue"
 
 
+def test_load_cubes_v2_reads_metadata_as_utf8(tmp_path, monkeypatch):
+    """v2 cube metadata must not follow the process locale.
+
+    Sibling loaders pass encoding='utf-8'. This path used to omit it, so a
+    Windows cp936 locale could turn a UTF-8 cube name into different Unicode
+    without raising.
+    """
+    _make_v2_cube_project(tmp_path)
+    _write_cube(
+        tmp_path,
+        "order_metrics",
+        "name: \u8ba2\u5355\U0001f4c8 caf\u00e9\nbase_object: orders\n",
+    )
+    seen: list[str | None] = []
+    real = Path.read_text
+
+    def wrapped(self, *args, **kwargs):
+        if self.name == "metadata.yml":
+            seen.append(kwargs.get("encoding", args[0] if args else None))
+        return real(self, *args, **kwargs)
+
+    monkeypatch.setattr(Path, "read_text", wrapped)
+    cubes = load_cubes(tmp_path)
+    assert seen == ["utf-8"]
+    assert cubes[0]["name"] == "\u8ba2\u5355\U0001f4c8 caf\u00e9"
+
+
 def test_load_cubes_v2_ignores_flat_yaml(tmp_path):
     _make_v2_cube_project(tmp_path)
     cubes_dir = tmp_path / "cubes"
```

---

### Incident Patch 5: `42b4405f` (2026-10-02)
**Commit Message**: docs(guide): stop claiming relationship handles are queryable directly (#2760)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/core/guides/model.md` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ Once you have a baseline, add depth incrementally:
 
 - **Descriptions and business names** on models and columns, which memory uses for retrieval
 - **Calculated fields** for metrics the team agrees on (`revenue = net_total - refunds`)
-- **Relationship columns** so agents can write `orders.customer.first_name` without manual joins
+- **Relationship columns** so calculated fields can pull values from related models without manual joins (see [Relationship columns](/oss/reference/mdl#relationship-columns))
 - **Views** for stable, pre-built query shapes (`completed_orders`, `monthly_revenue`)
 - **Cubes** for governed aggregations (see [Pre-aggregate with cubes](./cubes.md))
 - **Selective column exposure** to keep PII columns invisible to agents. Omit them from the model and they cannot be queried
```

---

### Incident Patch 6: `0e1636ff` (2026-10-01)
**Commit Message**: ci(wren-core-py): publish Linux aarch64 wheels (#2750)

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/publish-wren-core-py.yml` (modified, +38/-1)
```diff
@@ -31,6 +31,8 @@ jobs:
         include:
           - os: ubuntu-latest
             target: x86_64-unknown-linux-gnu
+          - os: ubuntu-24.04-arm
+            target: aarch64-unknown-linux-gnu
           - os: macos-15-intel
             target: x86_64-apple-darwin
           - os: macos-15
@@ -147,9 +149,44 @@ jobs:
           name: sdist
           path: core/wren-core-py/dist/*.tar.gz
 
+  smoke-test:
+    name: Smoke test wheel — ${{ matrix.os }}
+    needs: build-wheels
+    runs-on: ${{ matrix.os }}
+    strategy:
+      fail-fast: false
+      matrix:
+        os:
+          - ubuntu-latest
+          - ubuntu-24.04-arm
+          - macos-15-intel
+          - macos-15
+          - windows-latest
+    steps:
+      - uses: actions/setup-python@v5
+        with:
+          python-version: "3.11"
+      - name: Download wheels
+        uses: actions/download-artifact@v4
+        with:
+          pattern: wheel-*
+          path: dist
+          merge-multiple: true
+      # --no-index means pip can only resolve from the wheels this run built, so
+      # a platform with no matching wheel fails here instead of silently falling
+      # back to the sdist (and a source build) for users.
+      - name: Install wheel
+        shell: bash
+        env:
+          VERSION: ${{ inputs.version }}
+        run: pip install --no-index --find-links dist "wren-core-py==$VERSION"
+      - name: Import wren_core
+        shell: bash
+        run: python -c "import wren_core; print(wren_core.__file__)"
+
   publish:
     name: Publish to ${{ inputs.pypi_target }}
-    needs: [build-wheels, build-sdist]
+    needs: [build-wheels, build-sdist, smoke-test]
     runs-on: ubuntu-latest
     environment:
       name: ${{ inputs.pypi_target }}
```

**File**: `core/wren-core-py/README.md` (modified, +2/-2)
```diff
@@ -13,11 +13,11 @@ pip install wren-core-py
 Requires Python >= 3.11.
 
 Pre-built wheels are available for:
-- Linux x86_64
+- Linux x86_64 / ARM64 (manylinux)
 - macOS x86_64 / ARM64 (Apple Silicon)
 - Windows x86_64
 
-Linux ARM64 wheels are not yet available. To use on that platform, build from source (requires Rust toolchain).
+On any other platform pip falls back to the sdist and builds from source, which requires a Rust toolchain.
 
 ## Quick Start
 
```

---

### Incident Patch 7: `702e17d6` (2026-10-01)
**Commit Message**: fix(wren): make test-unit run the whole unit tree like CI does (#2768)

**File**: `core/wren/justfile` (modified, +9/-1)
```diff
@@ -55,7 +55,15 @@ test:
     uv run --no-sync pytest tests/ -v
 
 test-unit:
-    uv run --no-sync pytest tests/unit/ -v -m "unit and not slow"
+    # Run the whole tests/unit/ tree instead of filtering on `-m unit`: the
+    # marker is opt-in, so an unmarked file contributes nothing here and the
+    # recipe still exits 0. Keep in step with the `unit tests` job in
+    # .github/workflows/wren-ci.yml, which made the same choice for the same
+    # reason. test_memory.py needs the `memory` extra and test_mcp_server.py
+    # needs `mcp`; both have dedicated jobs.
+    uv run --no-sync pytest tests/unit/ -v \
+        --ignore=tests/unit/test_memory.py \
+        --ignore=tests/unit/test_mcp_server.py
 
 test-datafusion:
     uv run --no-sync pytest tests/connectors/test_datafusion.py -v -m datafusion
```

---

### Incident Patch 8: `87b438a0` (2026-09-30)
**Commit Message**: fix(sdk): read project artifacts as UTF-8 (#2764)

Co-authored-by: dafyy321-pixel <[REDACTED_EMAIL]>

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

**File**: `sdk/wren-pydantic/src/wren_pydantic/_instructions.py` (modified, +1/-1)
```diff
@@ -237,7 +237,7 @@ def _build_instructions_section(project_path: Path) -> str:
     instructions_file = project_path / "instructions.md"
     if not instructions_file.exists():
         return ""
-    body = instructions_file.read_text().strip()
+    body = instructions_file.read_text(encoding="utf-8").strip()
     if not body:
         return ""
     return f"## Project-specific instructions\n\n{body}"
```

**File**: `sdk/wren-pydantic/src/wren_pydantic/_providers/mdl_source.py` (modified, +10/-6)
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

**File**: `sdk/wren-pydantic/tests/conftest.py` (modified, +13/-0)
```diff
@@ -1,5 +1,6 @@
 """Shared pytest fixtures for wren-pydantic tests."""
 
+import io
 import json
 
 import pytest
@@ -32,3 +33,15 @@ def fake_active_profile(monkeypatch):
         "wren_pydantic._providers.connection.get_active_profile",
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

---

### Incident Patch 9: `8d254db2` (2026-09-30)
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

**File**: `core/wren/src/wren/skills_content/dlt-connector/scripts/introspect_dlt.py` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@ def write_project(files: dict[str, str], output_dir: Path, *, force: bool = Fals
     for rel_path, content in files.items():
         path = output_dir / rel_path
         path.parent.mkdir(parents=True, exist_ok=True)
-        path.write_text(content)
+        path.write_text(content, encoding="utf-8")
 
 
 # ---------------------------------------------------------------------------
```

**File**: `core/wren/tests/conftest.py` (modified, +22/-0)
```diff
@@ -1,5 +1,7 @@
 """Root pytest configuration for the wren package test suite."""
 
+from pathlib import Path
+
 import pytest
 
 
@@ -32,3 +34,23 @@ def pytest_configure(config: pytest.Config) -> None:
         "slow: slow tests that load a real model / hit real LanceDB "
         "(e.g. cross-model vector-compatibility checks)",
     )
+
+
+@pytest.fixture()
+def cp1252_default_encoding(monkeypatch):
+    """Make Path.read_text/write_text default to cp1252, like Windows does.
+
+    Without an explicit ``encoding=``, pathlib uses the locale encoding, which is
+    a legacy code page on most Windows installs rather than UTF-8.
+    """
+    real_read, real_write = Path.read_text, Path.write_text
+
+    # Path.read_text only takes ``newline`` from Python 3.13 on, so don't pass it.
+    def read_text(self, encoding=None, errors=None):
+        return real_read(self, encoding or "cp1252", errors)
+
+    def write_text(self, data, encoding=None, errors=None, newline=None):
+        return real_write(self, data, encoding or "cp1252", errors, newline)
+
+    monkeypatch.setattr(Path, "read_text", read_text)
+    monkeypatch.setattr(Path, "write_text", write_text)
```

**File**: `core/wren/tests/unit/test_context_cli.py` (modified, +46/-0)
```diff
@@ -241,6 +241,52 @@ def test_init_creates_scaffold(tmp_path):
     assert "ACTUAL database" in model_meta
 
 
+def test_init_then_build_with_non_utf8_default_encoding(
+    tmp_path, cp1252_default_encoding
+):
+    result = runner.invoke(app, ["context", "init", "--path", str(tmp_path)])
+    assert result.exit_code == 0, result.exception
+
+    result = runner.invoke(app, ["context", "build", "--path", str(tmp_path)])
+    assert result.exit_code == 0, result.exception
+    agents_md = (tmp_path / "AGENTS.md").read_bytes().decode("utf-8")
+    assert "→" in agents_md
+
+
+def test_init_from_mdl_then_build_keeps_non_ascii_with_non_utf8_default_encoding(
+    tmp_path, cp1252_default_encoding
+):
+    mdl = {
+        "name": "shop",
+        "catalog": "wren",
+        "schema": "public",
+        "dataSource": "postgres",
+        "models": [
+            {
+                "name": "orders",
+                "tableReference": {"schema": "public", "table": "orders"},
+                "columns": [{"name": "id", "type": "INTEGER"}],
+                "primaryKey": "id",
+                "properties": {"description": "訂單 — café"},
+            }
+        ],
+    }
+    mdl_file = tmp_path / "mdl.json"
+    mdl_file.write_bytes(json.dumps(mdl, ensure_ascii=False).encode("utf-8"))
+    project = tmp_path / "project"
+
+    result = runner.invoke(
+        app,
+        ["context", "init", "--path", str(project), "--from-mdl", str(mdl_file)],
+    )
+    assert result.exit_code == 0, result.exception
+    result = runner.invoke(app, ["context", "build", "--path", str(project)])
+    assert result.exit_code == 0, result.exception
+
+    built = json.loads((project / "target" / "mdl.json").read_bytes().decode("utf-8"))
+    assert built["models"][0]["properties"]["description"] == "訂單 — café"
+
+
 def test_init_refuses_existing(tmp_path):
     (tmp_path / "wren_project.yml").write_text("name: existing\n")
     result = runner.invoke(app, ["context", "init", "--path", str(tmp_path)])
```

---

### Incident Patch 10: `7b74af17` (2026-09-29)
**Commit Message**: fix(core): preserve string literals when removing MDL qualifiers (#2762)

Co-authored-by: dafyy321-pixel <[REDACTED_EMAIL]>

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

### Incident Patch 11: `d26ab6af` (2026-09-24)
**Commit Message**: chore(deps): bump core/wren lockfile to clear open security advisories (#2751)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Jax Liu <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

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
-    { url = "https://files.pythonhosted.org/packages/20/2c/0622f20ff02b2ef32558733443805dc82fd4c275be01b2d19d14676f3a1b/cryptography-49.0.0-cp311-abi3-manylinux_2_28_x86_64.whl", hash = "sha256:2afe9051da7ae7bd5905da5a949280c7d2bb75682e188f650a9d0f2756b834c6", size = 4749683, upload-time = "2026-06-12T20:02:03.335Z" },
-    { url = "https://files.pythonhosted.org/packages/a3/5b/c5246635d5fd3b64e0d45ae10e99fd32fe9676a79915ccfe5a61ba9af1a5/cryptography-49.0.0-cp311-abi3-manylinux_2_31_armv7l.whl", hash = "sha256:0b82e28ee398a386f0807bba7884d30f25218855690f45115831bcce5d90822c", size = 4337874, upload-time = "2026-06-12T20:02:54.323Z" },
-    { url = "https://files.pythonhosted.org/packages/6d/88/05563c7fe2e914e87d1a536d06fe83e66b4e1d95cb593e05aea375531da8/cryptography-49.0.0-cp311-abi3-manylinux_2_34_aarch64.whl", hash = "sha256:ccac2bfebc306b862133e3bb71f3f6ee8bb525240089b2d952e4144b3a6d5da7", size = 4700283, upload-time = "2026-06-12T20:01:34.822Z" },
-    { url = "https://files.pythonhosted.org/packages/c4/b6/d7696e4e890d6ae1469935164c9e5215c557671cb78d6e3f458ccceaa632/cryptography-49.0.0-cp311-abi3-manylinux_2_34_ppc64le.whl", hash = "sha256:d0527ce944105f257f605a827d6ebead966c752038b6e8656abb9c5edee6fc68", size = 5265844, upload-time = "2026-06-12T20:01:24.09Z" },
-    { url = "https://fil
```

---

### Incident Patch 12: `4d55c52a` (2026-09-23)
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

**File**: `core/wren/src/wren/connector/databricks.py` (modified, +3/-5)
```diff
@@ -3,7 +3,7 @@
 import pyarrow as pa
 from loguru import logger
 
-from wren.connector.base import ConnectorABC, strip_trailing_semicolon
+from wren.connector.base import ConnectorABC
 from wren.model import (
     DatabricksConnectionUnion,
     DatabricksServicePrincipalConnectionInfo,
@@ -51,7 +51,7 @@ def credential_provider():
 
     def query(self, sql: str, limit: int | None = None) -> pa.Table:
         # Strip terminating ;/whitespace before execute (matches dry_run).
-        sql = strip_trailing_semicolon(sql)
+        sql = self._strip(sql)
         with closing(self.connection.cursor()) as cursor:
             cursor.execute(sql)
             if limit is not None:
@@ -60,9 +60,7 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
 
     def dry_run(self, sql: str) -> None:
         with closing(self.connection.cursor()) as cursor:
-            cursor.execute(
-                f"SELECT * FROM ({strip_trailing_semicolon(sql)}) AS sub LIMIT 0"
-            )
+            cursor.execute(f"SELECT * FROM ({self._strip(sql)}) AS sub LIMIT 0")
 
     def close(self) -> None:
         try:
```

**File**: `core/wren/src/wren/connector/datafusion.py` (modified, +3/-3)
```diff
@@ -7,7 +7,7 @@
 import pyarrow.ipc as ipc
 from loguru import logger
 
-from wren.connector.base import ConnectorABC, coerce_limit, strip_trailing_semicolon
+from wren.connector.base import ConnectorABC, coerce_limit
 from wren.model import DataFusionConnectionInfo
 from wren.model.error import ErrorCode, WrenError
 
@@ -30,7 +30,7 @@ def __init__(self, connection_info: DataFusionConnectionInfo):
 
     def query(self, sql: str, limit: int | None = None) -> pa.Table:
         limit = coerce_limit(limit)
-        stripped = strip_trailing_semicolon(sql)
+        stripped = self._strip(sql)
         if limit is not None:
             sql = f"SELECT * FROM ({stripped}) AS _q LIMIT {limit}"
         else:
@@ -44,7 +44,7 @@ def dry_run(self, sql: str) -> None:
         # break the LIMIT subquery wrap (``SELECT 1;`` is a multi-statement batch
         # the planner rejects). Strip only the terminating run so ';' inside
         # string literals stays intact — same helper already used by ``query``.
-        self.ctx.dry_run(strip_trailing_semicolon(sql))
+        self.ctx.dry_run(self._strip(sql))
 
     def close(self) -> None:
         pass
```

**File**: `core/wren/src/wren/connector/duckdb.py` (modified, +3/-3)
```diff
@@ -4,7 +4,7 @@
 import pyarrow as pa
 from loguru import logger
 
-from wren.connector.base import ConnectorABC, coerce_limit, strip_trailing_semicolon
+from wren.connector.base import ConnectorABC, coerce_limit
 from wren.model import (
     GcsFileConnectionInfo,
     MinioFileConnectionInfo,
@@ -82,7 +82,7 @@ def query(self, sql: str, limit: int | None = None) -> pa.Table:
         ``SELECT …;`` behaves the same on limited and unlimited paths.
         """
         limit = coerce_limit(limit)
-        stripped = strip_trailing_semicolon(sql)
+        stripped = self._strip(sql)
         if limit is not None:
             # Subquery wrap rejects an interior terminator after strip.
             # Multiline so a trailing `-- line comment` in `stripped` is
@@ -104,7 +104,7 @@ def dry_run(self, sql: str) -> None:
         statement then becomes a natural syntax error inside the subquery, and
         no rows are materialized.
         """
-        stripped = strip_trailing_semicolon(sql)
+        stripped = self._strip(sql)
         self.connection.execute(f"SELECT * FROM (\n{stripped}\n) AS _q LIMIT 0")
 
     def _attach_database(self, connection_info) -> None:
```

---

### Incident Patch 13: `871118e9` (2026-09-16)
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

### Incident Patch 14: `1fdd864e` (2026-09-14)
**Commit Message**: fix(wren): oracle, redshift and trino LIMIT wrap breaks on SQL ending in a trailing comment (#2736)

Signed-off-by: Amir Fathi <[REDACTED_EMAIL]>

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

**File**: `core/wren/tests/unit/test_trino_semicolon_unlimited.py` (modified, +21/-0)
```diff
@@ -40,3 +40,24 @@ def test_query_with_limit_strips_inside_wrap(connector) -> None:
     sent = cursor.execute.call_args[0][0]
     assert "SELECT 1;" not in sent
     assert "LIMIT 5" in sent
+
+
+def test_query_limit_survives_trailing_line_comment(connector) -> None:
+    """Trailing `--` must not eat the wrap (same shape as postgres.py #2728)."""
+    c, _mod = connector
+    cursor = MagicMock()
+    c.connection.cursor.return_value = cursor
+    with patch("wren.connector.trino._build_trino_arrow_table", return_value=pa.table({"x": [1]})):
+        c.query("SELECT 1 AS x -- pick", limit=5)
+    sent = cursor.execute.call_args[0][0]
+    assert sent == "SELECT * FROM (\nSELECT 1 AS x -- pick\n) AS _sub LIMIT 5"
+
+
+def test_dry_run_limit_survives_trailing_line_comment(connector) -> None:
+    c, _mod = connector
+    cursor = MagicMock()
+    c.connection.cursor.return_value = cursor
+    cursor.fetchall.return_value = []
+    c.dry_run("SELECT 1 AS x -- pick")
+    sent = cursor.execute.call_args[0][0]
+    assert sent == "SELECT * FROM (\nSELECT 1 AS x -- pick\n) AS _sub LIMIT 0"
```

---

### Incident Patch 15: `0be34c04` (2026-09-14)
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

#### Recent Merged Pull Requests:
- **PR #2789** (2026-10-05): chore(release): include the version in the wren-rust-core release PR title (@goldmedal)
- **PR #2787** (2026-10-05): fix(core/wren): bump urllib3, pyjwt and sentence-transformers for security advisories (@goldmedal)
- **PR #2786** (closed): fix: scope postgres connections per query and handle dbt model test sorting (@salern0x00)
- **PR #2771** (2026-10-05): fix(context): keep cubes when importing an MDL with init --from-mdl (@MohammadHijjawi97)
- **PR #2770** (2026-09-30): fix(wren): write project files as UTF-8 so init/build work on Windows (@MohammadHijjawi97)
- **PR #2769** (2026-10-02): fix(context): read v2 cube metadata as UTF-8 (@Bartok9)
- **PR #2768** (2026-10-01): fix(wren): make test-unit run the whole unit tree like CI does (@lihongyuan99)
- **PR #2767** (2026-10-05): fix(memory): carry the reindex failure reason out of the watch loop (@lihongyuan99)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
