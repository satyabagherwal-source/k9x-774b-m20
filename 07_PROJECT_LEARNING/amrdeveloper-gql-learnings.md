# Forensic Learning Record (Deep Inspection): AmrDeveloper/GQL

> **Canonical Artifact**: `07_PROJECT_LEARNING/amrdeveloper-gql-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AmrDeveloper/GQL](https://github.com/AmrDeveloper/GQL))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:18:38.621Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AmrDeveloper/GQL`
- **Description**: GitQL is a extensible SQL-like query language and SDK to perform queries on various data sources such .git files with supports of most of SQL features such as grouping, ordering and aggregation and window functions and allow customization like user-defined types and functions
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3514 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/benchmarks.rs`
```
use std::hint::black_box;

use criterion::Criterion;
use criterion::criterion_group;
use criterion::criterion_main;
use gitql_parser::tokenizer::Tokenizer;

const QUERY_100_CHAR: &str = "SELECT name, COUNT(name) FROM commits GROUP BY name, author_email ORDER BY commit_num DESC LIMIT 100";

fn tokenizer_100_char_benchmark(c: &mut Criterion) {
    c.bench_function("Tokenizer 100 Char", |b| {
        b.iter(|| Tokenizer::tokenize(black_box(QUERY_100_CHAR)))
    });
}

fn tokenizer_100k_char_benchmark(c: &mut Criterion) {
    let query_100k_char = QUERY_100_CHAR.repeat(100_000 / 100);
    c.bench_function("Tokenizer 100K Char", |b| {
        b.iter(|| Tokenizer::tokenize(black_box(&query_100k_char)))
    });
}

fn tokenizer_1m_char_benchmark(c: &mut Criterion) {
    let query_100k_char = QUERY_100_CHAR.repeat(1_000_000 / 100);
    c.bench_function("Tokenizer 1M Char", |b| {
        b.iter(|| Tokenizer::tokenize(black_box(&query_100k_char)))
    });
}

fn tokenizer_10m_char_benchmark(c: &mut Criterion) {
    let query_100k_char = QUERY_100_CHAR.repeat(10_000_000 / 100);
    c.bench_function("Tokenizer 10M Char", |b| {
        b.iter(|| Tokenizer::tokenize(black_box(&query_100k_char)))
    });
}

criterion_group! {
   name = benches;
   config = Criterion::default().significance_level(0.1).sample_size(10);
   targets =
   // Tokenizer
   tokenizer_100_char_benchmark,
   tokenizer_100k_char_benchmark,
   tokenizer_1m_char_benchmark,
   tokenizer_10m_char_benchmark
}

criterion_main!(benches);

```

### Core Architecture Module: `crates/gitql-ast/src/expression.rs`
```
use std::any::Any;

use dyn_clone::DynClone;

use super::types::array::ArrayType;
use super::types::boolean::BoolType;
use super::types::integer::IntType;
use super::types::null::NullType;
use super::types::text::TextType;
use super::types::DataType;

use crate::interval::Interval;
use crate::operator::ArithmeticOperator;
use crate::operator::BinaryBitwiseOperator;
use crate::operator::BinaryLogicalOperator;
use crate::operator::ComparisonOperator;
use crate::operator::GroupComparisonOperator;
use crate::operator::PrefixUnaryOperator;
use crate::types::float::FloatType;
use crate::types::interval::IntervalType;
use crate::types::row::RowType;

#[derive(PartialEq)]
pub enum ExprKind {
    Assignment,
    String,
    Symbol,
    Array,
    GlobalVariable,
    Number,
    Boolean,
    Interval,
    PrefixUnary,
    Index,
    Slice,
    Arithmetic,
    Comparison,
    GroupComparison,
    Contains,
    ContainedBy,
    Like,
    Regex,
    Glob,
    Logical,
    Bitwise,
    Call,
    BenchmarkCall,
    Between,
    Case,
    In,
    IsNull,
    Null,
    Cast,
    Column,
    Row,
    MemberAccess,
}

dyn_clone::clone_trait_object!(Expr);

pub trait Expr: DynClone {
    fn kind(&self) -> ExprKind;
    fn expr_type(&self) -> Box<dyn DataType>;
    fn as_any(&self) -> &dyn Any;
}

impl dyn Expr {
    pub fn is_const(&self) -> bool {
        matches!(
            self.kind(),
            ExprKind::Number | ExprKind::Boolean | ExprKind::String | ExprKind::Null
        )
    }
}

#[derive(Clone)]
pub struct AssignmentExpr {
    pub symbol: String,
    pub value: Box<dyn Expr>,
}

impl Expr for AssignmentExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::Assignment
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        self.value.expr_type()
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone)]
pub struct StringExpr {
    pub value: String,
}

impl Expr for StringExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::String
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        Box::new(TextType)
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(PartialEq, Clone)]
pub enum SymbolFlag {
    AggregationReference,
    WindowReference,
    None,
}

#[derive(Clone)]
pub struct SymbolExpr {
    pub value: String,
    pub expr_type: Box<dyn DataType>,
    pub flag: SymbolFlag,
}

impl Expr for SymbolExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::Symbol
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        self.expr_type.clone()
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone)]
pub struct ArrayExpr {
    pub values: Vec<Box<dyn Expr>>,
    pub element_type: Box<dyn DataType>,
}

impl Expr for ArrayExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::Array
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        Box::new(ArrayType::new(self.element_type.clone()))
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone)]
pub struct GlobalVariableExpr {
    pub name: String,
    pub result_type: Box<dyn DataType>,
}

impl Expr for GlobalVariableExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::GlobalVariable
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        self.result_type.clone()
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone, PartialEq)]
pub enum Number {
    Int(i64),
    Float(f64),
}

#[derive(Clone)]
pub struct NumberExpr {
    pub value: Number,
}

impl NumberExpr {
    pub fn int(int_value: i64) -> Self {
        NumberExpr {
            value: Number::Int(int_value),
        }
    }

    pub fn float(int_value: f64) -> Self {
        NumberExpr {
            value: Number::Float(int_value),
        }
    }
}

impl Expr for NumberExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::Number
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        match self.value {
            Number::Int(_) => Box::new(IntType),
            Number::Float(_) => Box::new(FloatType),
        }
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone)]
pub struct IntervalExpr {
    pub interval: Interval,
}

impl IntervalExpr {
    pub fn new(interval: Interval) -> Self {
        IntervalExpr { interval }
    }
}

impl Expr for IntervalExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::Interval
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        Box::new(IntervalType)
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone)]
pub struct BooleanExpr {
    pub is_true: bool,
}

impl Expr for BooleanExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::Boolean
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        Box::new(BoolType)
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone)]
pub struct UnaryExpr {
    pub right: Box<dyn Expr>,
    pub operator: PrefixUnaryOperator,
    pub result_type: Box<dyn DataType>,
}

impl Expr for UnaryExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::PrefixUnary
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        self.result_type.clone()
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone)]
pub struct IndexExpr {
    pub collection: Box<dyn Expr>,
    pub element_type: Box<dyn DataType>,
    pub index: Box<dyn Expr>,
    pub result_type: Box<dyn DataType>,
}

impl Expr for IndexExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::Index
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        self.result_type.clone()
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone)]
pub struct SliceExpr {
    pub collection: Box<dyn Expr>,
    pub start: Option<Box<dyn Expr>>,
    pub end: Option<Box<dyn Expr>>,
    pub result_type: Box<dyn DataType>,
}

impl Expr for SliceExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::Slice
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        self.result_type.clone()
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone)]
pub struct ArithmeticExpr {
    pub left: Box<dyn Expr>,
    pub operator: ArithmeticOperator,
    pub right: Box<dyn Expr>,
    pub result_type: Box<dyn DataType>,
}

impl Expr for ArithmeticExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::Arithmetic
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        self.result_type.clone()
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone)]
pub struct ComparisonExpr {
    pub left: Box<dyn Expr>,
    pub operator: ComparisonOperator,
    pub right: Box<dyn Expr>,
}

impl Expr for ComparisonExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::Comparison
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        if self.operator == ComparisonOperator::NullSafeEqual {
            Box::new(IntType)
        } else {
            Box::new(BoolType)
        }
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone)]
pub struct GroupComparisonExpr {
    pub left: Box<dyn Expr>,
    pub comparison_operator: ComparisonOperator,
    pub group_operator: GroupComparisonOperator,
    pub right: Box<dyn Expr>,
}

impl Expr for GroupComparisonExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::GroupComparison
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        if self.comparison_operator == ComparisonOperator::NullSafeEqual {
            Box::new(IntType)
        } else {
            Box::new(BoolType)
        }
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone)]
pub struct ContainsExpr {
    pub left: Box<dyn Expr>,
    pub right: Box<dyn Expr>,
}

impl Expr for ContainsExpr {
    fn kind(&self) -> ExprKind {
        ExprKind::Contains
    }

    fn expr_type(&self) -> Box<dyn DataType> {
        Box::new(BoolType)
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[derive(Clone)]
pub struct ContainedByExpr {
    pu
```

### Core Architecture Module: `crates/gitql-ast/src/format_checker.rs`
```
/// Check if String literal is matching SQL time format: HH:MM:SS or HH:MM:SS.SSS
pub fn is_valid_time_format(time_str: &str) -> bool {
    // Check length of the string
    if !(8..=12).contains(&time_str.len()) {
        return false;
    }

    // Split the string into hours, minutes, seconds, and optional milliseconds
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() < 3 || parts.len() > 4 {
        return false;
    }

    // Extract hours, minutes, seconds, and optionally milliseconds
    let hours = parts[0].parse::<u32>().ok();
    let minutes = parts[1].parse::<u32>().ok();
    let seconds_parts: Vec<&str> = parts[2].split('.').collect();
    let seconds = seconds_parts[0].parse::<u32>().ok();
    let milliseconds = if seconds_parts.len() == 2 {
        seconds_parts[1].parse::<u32>().ok()
    } else {
        Some(0)
    };

    // Validate the parsed values
    hours.is_some()
        && minutes.is_some()
        && seconds.is_some()
        && milliseconds.is_some()
        && hours.unwrap() < 24
        && minutes.unwrap() < 60
        && seconds.unwrap() < 60
        && milliseconds.unwrap() < 1000
}

/// Check if String literal is matching SQL Date format: YYYY-MM-DD
pub fn is_valid_date_format(date_str: &str) -> bool {
    // Check length of the string
    if date_str.len() != 10 {
        return false;
    }

    // Split the string into year, month, and day
    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() != 3 {
        return false;
    }

    // Extract year, month, and day
    let year = parts[0].parse::<u32>().ok();
    let month = parts[1].parse::<u32>().ok();
    let day = parts[2].parse::<u32>().ok();

    // Validate the parsed values
    year.is_some()
        && month.is_some()
        && day.is_some()
        && year.unwrap() >= 1
        && month.unwrap() >= 1
        && month.unwrap() <= 12
        && day.unwrap() >= 1
        && day.unwrap() <= 31
}

/// Check if String literal is matching SQL Date format: YYYY-MM-DD HH:MM:SS or YYYY-MM-DD HH:MM:SS.SSS
pub fn is_valid_datetime_format(datetime_str: &str) -> bool {
    // Check length of the string
    if !(19..=23).contains(&datetime_str.len()) {
        return false;
    }

    // Split the string into date and time components
    let parts: Vec<&str> = datetime_str.split_whitespace().collect();
    if parts.len() != 2 {
        return false;
    }

    // Check the validity of date and time components
    is_valid_date_format(parts[0]) && is_valid_time_format(parts[1])
}

```

### Core Architecture Module: `crates/gitql-ast/src/interval.rs`
```
use std::cmp::Ordering;
use std::fmt::Display;
use std::fmt::Formatter;
use std::ops::Div;
use std::ops::Mul;

const INTERVAL_MAX_VALUE_I: i64 = 170_000_000;
const INTERVAL_MAX_VALUE_F: f64 = 170_000_000.0;

#[derive(Default, Debug, PartialEq, Clone)]
pub struct Interval {
    pub years: i64,
    pub months: i64,
    pub days: i64,
    pub hours: i64,
    pub minutes: i64,
    pub seconds: f64,
}

impl Interval {
    pub fn add(&self, other: &Interval) -> Result<Interval, String> {
        let mut result = self.clone();
        result.years = interval_value_or_error_i64(result.years + other.years)?;
        result.months = interval_value_or_error_i64(result.months + other.months)?;
        result.days = interval_value_or_error_i64(result.days + other.days)?;
        result.hours = interval_value_or_error_i64(result.hours + other.hours)?;
        result.minutes = interval_value_or_error_i64(result.minutes + other.minutes)?;
        result.seconds = interval_value_or_error_f64(result.seconds + other.seconds)?;
        Ok(result)
    }

    pub fn sub(&self, other: &Interval) -> Result<Interval, String> {
        let mut result = self.clone();
        result.years = interval_value_or_error_i64(result.years - other.years)?;
        result.months = interval_value_or_error_i64(result.months - other.months)?;
        result.days = interval_value_or_error_i64(result.days - other.days)?;
        result.hours = interval_value_or_error_i64(result.hours - other.hours)?;
        result.minutes = interval_value_or_error_i64(result.minutes - other.minutes)?;
        result.seconds = interval_value_or_error_f64(result.seconds - other.seconds)?;
        Ok(result)
    }

    pub fn mul(&self, other: i64) -> Result<Interval, String> {
        let mut result = self.clone();
        result.years = interval_value_or_error_i64(result.years * other)?;
        result.months = interval_value_or_error_i64(result.months * other)?;
        result.days = interval_value_or_error_i64(result.days * other)?;
        result.hours = interval_value_or_error_i64(result.hours * other)?;
        result.minutes = interval_value_or_error_i64(result.minutes * other)?;
        result.seconds = interval_value_or_error_f64(result.seconds.mul(other as f64))?;
        Ok(result)
    }

    pub fn div(&self, other: i64) -> Result<Interval, String> {
        let mut result = self.clone();
        result.years = interval_value_or_error_i64(result.years / other)?;
        result.months = interval_value_or_error_i64(result.months / other)?;
        result.days = interval_value_or_error_i64(result.days / other)?;
        result.hours = interval_value_or_error_i64(result.hours / other)?;
        result.minutes = interval_value_or_error_i64(result.minutes / other)?;
        result.seconds = interval_value_or_error_f64(result.seconds.div(other as f64))?;
        Ok(result)
    }

    pub fn to_seconds(&self) -> i64 {
        let days =
            self.years as f64 * 365.25 + self.months as f64 * (365.25 / 12.0) + self.days as f64;

        let seconds = days * 24.0 * 60.0 * 60.0
            + self.hours as f64 * 60.0 * 60.0
            + self.minutes as f64 * 60.0
            + self.seconds;

        seconds as i64
    }
}

impl PartialOrd for Interval {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        let self_seconds = self.to_seconds();
        let other_seconds = other.to_seconds();
        self_seconds.partial_cmp(&other_seconds)
    }
}

impl Display for Interval {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let mut parts = Vec::new();

        if self.years != 0 {
            parts.push(format!(
                "{} year{}",
                self.years,
                if self.years > 1 { "s" } else { "" }
            ));
        }
        if self.months != 0 {
            parts.push(format!(
                "{} month{}",
                self.months,
                if self.months > 1 { "s" } else { "" }
            ));
        }
        if self.days != 0 {
            parts.push(format!(
                "{} day{}",
                self.days,
                if self.days > 1 { "s" } else { "" }
            ));
        }

        let (mut hours, mut minutes, mut seconds) = (self.hours, self.minutes, self.seconds);
        if hours != 0 || minutes != 0 || seconds != 0f64 {
            let has_minus_sign =
                hours.is_negative() || minutes.is_negative() || seconds.is_sign_negative();
            if has_minus_sign {
                hours = hours.abs();
                minutes = minutes.abs();
                seconds = seconds.abs();
                parts.push(format!("-{hours:02}:{minutes:02}:{seconds:02}"));
            } else {
                parts.push(format!("{hours:02}:{minutes:02}:{seconds:02}"));
            }
        }

        if parts.is_empty() {
            write!(f, "0 seconds")?;
        } else {
            write!(f, "{}", parts.join(" "))?;
        }
        Ok(())
    }
}

fn interval_value_or_error_i64(value: i64) -> Result<i64, String> {
    if (-INTERVAL_MAX_VALUE_I..=INTERVAL_MAX_VALUE_I).contains(&value) {
        return Ok(value);
    }
    Err(format!("Interval value out of range {value}"))
}

fn interval_value_or_error_f64(value: f64) -> Result<f64, String> {
    if (-INTERVAL_MAX_VALUE_F..=INTERVAL_MAX_VALUE_F).contains(&value) {
        return Ok(value);
    }
    Err("Interval value out of range".to_string())
}

```

### Core Architecture Module: `crates/gitql-ast/src/lib.rs`
```
pub mod expression;
pub mod format_checker;
pub mod operator;
pub mod query;
pub mod statement;
pub mod types;

mod interval;
pub use interval::Interval;

```

### Core Architecture Module: `crates/gitql-ast/src/operator.rs`
```
#[derive(Clone, PartialEq)]
pub enum PrefixUnaryOperator {
    Plus,
    Minus,
    Bang,
    Not,
}

#[derive(Clone, PartialEq)]
pub enum ArithmeticOperator {
    Plus,
    Minus,
    Star,
    Slash,
    Modulus,
    Exponentiation,
}

#[derive(Clone, PartialEq)]
pub enum ComparisonOperator {
    Greater,
    GreaterEqual,
    Less,
    LessEqual,
    Equal,
    NotEqual,
    NullSafeEqual,
}

#[derive(Clone, PartialEq)]
pub enum GroupComparisonOperator {
    All,
    Any,
}

#[derive(Clone, PartialEq)]
pub enum BinaryLogicalOperator {
    Or,
    And,
    Xor,
}

#[derive(Clone, PartialEq)]
pub enum BinaryBitwiseOperator {
    Or,
    And,
    Xor,
    RightShift,
    LeftShift,
}

```

### Core Architecture Module: `crates/gitql-ast/src/query.rs`
```
use std::collections::HashMap;

use crate::expression::Expr;
use crate::statement::Statement;

pub enum Query {
    Select(SelectQuery),
    GlobalVariableDecl(GlobalVariableDeclQuery),
    Do(DoQuery),
    DescribeTable(DescribeQuery),
    ShowTables,
}

pub struct SelectQuery {
    pub statements: HashMap<&'static str, Statement>,
    pub alias_table: HashMap<String, String>,
    pub has_aggregation_function: bool,
    pub has_group_by_statement: bool,
    pub hidden_selections: HashMap<String, Vec<String>>,
}

pub struct DoQuery {
    pub exprs: Vec<Box<dyn Expr>>,
}

pub struct DescribeQuery {
    pub table_name: String,
}

pub struct GlobalVariableDeclQuery {
    pub name: String,
    pub value: Box<dyn Expr>,
}

```

### Core Architecture Module: `crates/gitql-ast/src/statement.rs`
```
use std::collections::HashMap;

use crate::expression::Expr;

pub enum Statement {
    Select(SelectStatement),
    Where(WhereStatement),
    Having(HavingStatement),
    Limit(LimitStatement),
    Offset(OffsetStatement),
    OrderBy(OrderByStatement),
    GroupBy(GroupByStatement),
    AggregateFunction(AggregationsStatement),
    WindowFunction(WindowFunctionsStatement),
    Qualify(QualifyStatement),
    Into(IntoStatement),
}

#[derive(Clone)]
pub enum Distinct {
    None,
    DistinctAll,
    DistinctOn(Vec<String>),
}

#[derive(Clone)]
pub struct TableSelection {
    pub table_name: String,
    pub columns_names: Vec<String>,
}

#[derive(Clone, PartialEq)]
pub enum JoinKind {
    Cross,
    Inner,
    Left,
    Right,
    Default,
}

#[derive(Clone)]
pub enum JoinOperand {
    /// Used when JOIN is used first time on query, X JOIN Y,
    OuterAndInner(String, String),
    /// Used for JOIN that used after first time, JOIN Z
    Inner(String),
}

#[derive(Clone)]
pub struct Join {
    pub operand: JoinOperand,
    pub kind: JoinKind,
    pub predicate: Option<Box<dyn Expr>>,
}

#[derive(Clone)]
pub struct SelectStatement {
    pub table_selections: Vec<TableSelection>,
    pub joins: Vec<Join>,
    pub selected_expr_titles: Vec<String>,
    pub selected_expr: Vec<Box<dyn Expr>>,
    pub distinct: Distinct,
}

#[derive(Clone)]
pub struct WhereStatement {
    pub condition: Box<dyn Expr>,
}

#[derive(Clone)]
pub struct HavingStatement {
    pub condition: Box<dyn Expr>,
}

#[derive(Clone)]
pub struct LimitStatement {
    pub count: usize,
}

#[derive(Clone)]
pub struct OffsetStatement {
    pub start: Box<dyn Expr>,
}

#[derive(Clone, PartialEq)]
pub enum SortingOrder {
    Ascending,
    Descending,
}

#[derive(Clone, PartialEq)]
pub enum NullsOrderPolicy {
    NullsFirst,
    NullsLast,
}

#[derive(Clone)]
pub struct OrderByStatement {
    pub arguments: Vec<Box<dyn Expr>>,
    pub sorting_orders: Vec<SortingOrder>,
    pub nulls_order_policies: Vec<NullsOrderPolicy>,
}

#[derive(Clone)]
pub struct GroupByStatement {
    pub values: Vec<Box<dyn Expr>>,
    pub has_with_roll_up: bool,
}

#[derive(Clone)]
pub struct WindowPartitioningClause {
    pub expr: Box<dyn Expr>,
}

#[derive(Clone)]
pub struct WindowOrderingClause {
    pub order_by: OrderByStatement,
}

#[derive(Clone)]
pub struct WindowDefinition {
    pub name: Option<String>,
    pub partitioning_clause: Option<WindowPartitioningClause>,
    pub ordering_clause: Option<WindowOrderingClause>,
}

#[derive(Clone)]
pub enum WindowFunctionKind {
    AggregatedWindowFunction,
    PureWindowFunction,
}

#[derive(Clone)]
pub struct WindowFunction {
    pub function_name: String,
    pub arguments: Vec<Box<dyn Expr>>,
    pub window_definition: WindowDefinition,
    pub kind: WindowFunctionKind,
}

#[derive(Clone)]
pub enum WindowValue {
    Function(WindowFunction),
    Expression(Box<dyn Expr>),
}

#[derive(Clone)]
pub struct WindowFunctionsStatement {
    pub window_values: HashMap<String, WindowValue>,
}

#[derive(Clone)]
pub struct QualifyStatement {
    pub condition: Box<dyn Expr>,
}

#[derive(Clone)]
pub enum AggregateValue {
    Expression(Box<dyn Expr>),
    Function(String, Vec<Box<dyn Expr>>),
}

#[derive(Clone)]
pub struct AggregationsStatement {
    pub aggregations: HashMap<String, AggregateValue>,
}

#[derive(Clone)]
pub struct IntoStatement {
    pub file_path: String,
    pub lines_terminated: String,
    pub fields_terminated: String,
    pub enclosed: String,
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #138** (2025-01-12): **Unable to use datetime comparison in WHERE clause**
  *Symptoms*: **Describe the bug** Unable to run a query with a WHERE clause that uses datetime comparison.  **To Reproduce** With the latest version available in winget (0.33.0), running the following query results in an error being thrown: ` gitql -q 'SELECT commit_id, author_name, datetime FROM commits WHERE datetime > "2024-01-01 00:00:00"'`  Error message: ``` [Error]: Operator `>` can't be performed between types `DateTime` and `Text`   --> Location 1:68    | -> | SELECT commit_id, author_name, datetime FROM commits WHERE datetime > "2024-01-01 00:00:00"    |    | -------------------------------------------------------------------^    | ```  **Expected behavior** Query should run correctly.  **Screenshots** ![gitql_datetime_error](https://github.com/user-attachments/assets/80422b29-798a-40a2-b1b2-3529a39d0331)   **GQL (please complete the following information):**  - Version 0.33.0  **Additional context** The version 0.28.0 works. I was unable to install any version between 0.33.0 and 0.28.0 to pinpoint exactly which version introduced this issue. Environment details: OS: Windows 11 (24H2) Shell: Powershell Terminal: Windows Terminal 
  **Post-Mortem & Fix Analysis**:
  > Hello @gaurakshay,  Thank you for reporting, it's was a small issue in implicit casting, I fixed it, I will double check other operators and release it soon  Thank you, Amr
  > Gitql 0.35.0 is released with the fix, a new table and function for diff  https://github.com/AmrDeveloper/GQL/releases/tag/0.35.0  Thank you

- **Issue #117** (2024-09-16): **output of group by**
  *Symptoms*: **Describe the bug** I expected this query to produce 1 row. The ```nushell ❯ ^gitql -q 'select author_name, count(author_name) AS auth_count from commits group by author_name order by count(author_name)' ╭──────────────────┬────────────╮ │ author_name      ┆ auth_count │ ╞══════════════════╪════════════╡ │ Darren Schroeder ┆ 6          │ ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌┤ │ Darren Schroeder ┆ 6          │ ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌┤ │ Darren Schroeder ┆ 6          │ ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌┤ │ Darren Schroeder ┆ 6          │ ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌┤ │ Darren Schroeder ┆ 6          │ ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┼╌╌╌╌╌╌╌╌╌╌╌╌┤ │ Darren Schroeder ┆ 6          │ ╰──────────────────┴────────────╯ ``` There are indeed 6 commits, but shouldn't group by only show the aggregate of 1? ```nushell ❯ ^gitql -q 'select author_name from commits' ╭──────────────────╮ │ author_name      │ ╞══════════════════╡ │ Darren Schroeder │ ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ │ Darren Schroeder │ ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ │ Darren Schroeder │ ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ │ Darren Schroeder │ ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ │ Darren Schroeder │ ├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤ │ Darren Schroeder │ ╰──────────────────╯ ``` **GQL (please complete the following information):** ❯ ^gitql --version GitQL version 0.27.0 
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting @fdncred,  This is important to handled
  > It fixed now, you can run the query from issue description and get good result,   Thanks for reporting, i will release it next version
  > Thanks. I'm trying to integrate into a nushell plugin and was wondering why my code didn't work. Then I tried your cli and found out the results were the same. 🤣 Thanks for working on this. I'll try and test it in the next day or so.

- **Issue #101** (2024-05-19): **`count()` function no longer works on v0.19.0**
  *Symptoms*: **Describe the bug** Any usage of `count()` results in an error `Function 'count' argument number 0 with type '(some type)' don't match expected type 'Integer'`.  **To Reproduce** Steps to reproduce the behavior: 1. Upgrade to v0.19.0 2. Enter GQL console in any repo 3. Try any `count()`, query, i.e. `select count(commit_id) from commits`  ``` gql > select count(commit_id) from commits [Error]: Function `count` argument number 0 with type `Text` don't match expected type `Integer` => Column 12 to 12,   | 1 | select count(commit_id) from commits   | ------------^   | ```  **Expected behavior** On v0.18.0, this returns the following: ``` gql > select count(commit_id) from commits ╭──────────╮ │ column_2 │ ╞══════════╡ │ 27       │ ╰──────────╯ ```  **Screenshots** N/A (output provided)  **GQL (please complete the following information):**  - v0.19.0 
  **Post-Mortem & Fix Analysis**:
  > Hello @SadMachinesP86,  Thank you so much for fast reporting, it fixed now on `0.19.1`  Thank you, Amr

- **Issue #96** (2024-04-12): **SUBSTRING FromUtf8Error**
  *Symptoms*: **Describe the bug**  Call `SUBSTRING` on CJK chars results in `FromUtf8Error`.   **To Reproduce** Steps to reproduce the behavior:  ```sql SELECT SUBSTRING("这是一个中文句子", 1, 5) AS extract ```  **Expected behavior**  The result should be `这是一个中`.  **GQL (please complete the following information):**  - Version 0.17.0 
  **Post-Mortem & Fix Analysis**:
  > Fixed  ![fixed](https://github.com/AmrDeveloper/GQL/assets/23631699/e738c95f-b577-4784-81c9-583d498817f6)  Thank you for reporting, will be on next release 

- **Issue #75** (2024-01-25): **More than two conditions in WHERE results in an error**
  *Symptoms*: **Describe the bug** More than two conditions in WHERE results in an error.  **To Reproduce** Steps to reproduce the behavior: Execute any statement with more than two conditions in the WHERE section:  ```sql SELECT COUNT(commit_id) FROM commits WHERE datetime >= "2023-01-01 00:00:00" AND email = "myname@mail.com" AND comment like "%merge%" ```  **Expected behavior** The results are returned; all condition are applied.  **Actual behavior** An error: `Unexpected content after the end of 'SELECT' statement`  **Screenshots** ![image](https://github.com/AmrDeveloper/GQL/assets/1544021/742fbbde-5cb3-4ede-ae62-63f13f3373ae)  **GQL (please complete the following information):**  - Version v0.12.0 
  **Post-Mortem & Fix Analysis**:
  > Hello @dropsonic,  Thank you for reporting, i solved it now for AND, OR, XOR  Will do more testing and release it in 0.13.0 next friday  Thanks
  > Fixed and released in `0.13.0`  https://github.com/AmrDeveloper/GQL/releases/tag/0.13.0  Thank you

- **Issue #72** (2024-01-13): **Incorrect expr_type for ArithmeticExpression**
  *Symptoms*: **Describe the bug**  Incorrect expr_type for ArithmeticExpression  **To Reproduce**  ```rust // https://github.com/AmrDeveloper/GQL/blob/master/crates/gitql-ast/src/expression.rs  let express = ArithmeticExpression {             left: Box::new(NumberExpression {                 value: Value::Integer(1),             }),             operator: ArithmeticOperator::Plus,             right: Box::new(NumberExpression {                 value: Value::Float(1.0),             }),  };   let scope = Enviroment {             globals: Default::default(),             globals_types: Default::default(),             scopes: Default::default(), };  let ret = express.expr_type(&scope); assert_eq!(ret.is_float(), true); // fails ```  **Expected behavior**  ```rust assert_eq!(ret.is_float(), true);  // ret is true ```  **GQL (please complete the following information):**  Version 0.11.0  **Screenshots**  <img width="573" alt="expression.rs" src="https://github.com/AmrDeveloper/GQL/assets/49358172/796d0693-7577-4a1b-ac4b-2f6d914e8815"> 
  **Post-Mortem & Fix Analysis**:
  > See: https://github.com/AmrDeveloper/GQL/blob/master/crates/gitql-ast/src/expression.rs  **Incorrect**  ```rust fn expr_type(&self, scope: &Environment) -> DataType {         let lhs = self.left.expr_type(scope);         let rhs = self.left.expr_type(scope);          if lhs.is_int() && rhs.is_int() {             return DataType::Integer;         }          DataType::Float } ```  **Correct**  ```rust let lhs = self.left.expr_type(scope); let rhs = self.right.expr_type(scope); ```
  > Hello @craftslab,  Thank you for reporting it, i fixed it now  Thank you
  > Fixed and released on 0.12.0

- **Issue #71** (2024-01-13): **Incorrect equals for DateTime and Time**
  *Symptoms*: **Describe the bug**  Incorrect equals for DateTime and Time  **To Reproduce**  ```rust // https://github.com/AmrDeveloper/GQL/blob/master/crates/gitql-ast/src/value.rs let value = Value::DateTime(1704890191); let other = Value::DateTime(1704890192); let ret = value.equals(&other); assert_eq!(ret, false); // fails ```  **Expected behavior**  ```rust assert_eq!(ret, false);  // ret is false ```  **GQL (please complete the following information):**  Version 0.11.0  **Screenshots**  <img width="632" alt="screenshots" src="https://github.com/AmrDeveloper/GQL/assets/49358172/b51d9b20-c066-4263-a55c-2fef3c50ad61"> 
  **Post-Mortem & Fix Analysis**:
  > See: https://github.com/AmrDeveloper/GQL/blob/master/crates/gitql-ast/src/value.rs  **Incorrect**  ```rust pub fn equals(&self, other: &Self) -> bool {         if self.data_type() != other.data_type() {             return false;         }          match self.data_type() {             DataType::Any => true,             DataType::Text => self.as_text() == other.as_text(),             DataType::Integer => self.as_int() == other.as_int(),             DataType::Float => self.as_float() == other.as_float(),             DataType::Boolean => self.as_bool() == other.as_bool(),             DataType::DateTime => self.as_date() == other.as_date(),             DataType::Date => self.as_date() == other.as_date(),             DataType::Time => self.as_date() == other.as_date(),             DataType::Undefined => true,             DataType::Null => true,             _ => false,         }     } ```  **Expected**  ```rust DataType::DateTime => self.as_date_time() == other.as
  > Hello @craftslab,  Thank you for reporting, i fixed it now and will release it on `0.12.0` this week  Thank you, Amr Hesham
  > Fixed and released on 0.12.0

- **Issue #58** (2023-12-17): **First time user:  Application crashes on "SELECT * from commits" on a repo with no commits yet**
  *Symptoms*: **Describe the bug** Running `select * from commits` on an empty repo with no commits throws exception.  Note: Installed it for the very first time. Installation:  `scoop install gitql`  **To Reproduce** Steps to reproduce the behavior: 1. Create a folder 2. Do `git init` 3. `gitql` 4. `select * from commits`  **Expected behavior** I am not sure what should be the expected behavior since I am using it for the first time. Generally speaking I would expect it to show 0 commits or at least don't crash!  **Screenshots** ![image](https://github.com/AmrDeveloper/GQL/assets/103200610/ecb2e95a-5697-4d5f-b68f-37a68dd597c2)    **GQL (please complete the following information):** GitQL version 0.10.0  **Additional context** OS: Windows ![image](https://github.com/AmrDeveloper/GQL/assets/103200610/db38170b-d751-4e87-9aa7-3c46b57304e8)   
  **Post-Mortem & Fix Analysis**:
  > Hello @f0restOfHimalayas,  Thank you for reporting, i have fixed it now and will be released on package managers next week.  Thank you, Amr Hesham
  > Thank you @AmrDeveloper 

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

### Incident Patch 1: `ab3ba7b7` (2026-02-01)
**Commit Message**: Fix out of index panic when groups length is zero

**File**: `crates/gitql-engine/src/engine.rs` (modified, +20/-18)
```diff
@@ -124,26 +124,28 @@ fn evaluate_select_query(
     );
 
     let number_of_groups = gitql_object.groups.len();
-    let main_group: &mut Group = &mut gitql_object.groups[0];
-
-    // If there are many groups that mean group by is executed before.
-    // must merge each group into only one element
-    if number_of_groups > 1 {
-        for group in gitql_object.groups.iter_mut() {
-            if group.len() > 1 {
-                group.rows.drain(1..);
+    if number_of_groups > 0 {
+        let main_group: &mut Group = &mut gitql_object.groups[0];
+
+        // If there are many groups that mean group by is executed before.
+        // must merge each group into only one element
+        if number_of_groups > 1 {
+            for group in gitql_object.groups.iter_mut() {
+                if group.len() > 1 {
+                    group.rows.drain(1..);
+                }
             }
+            gitql_object.flat();
+        }
+        // If it a single group but it select only aggregations function,
+        // should return only first element in the group
+        else if number_of_groups == 1
+            && !select_query.has_group_by_statement
+            && select_query.has_aggregation_function
+            && main_group.len() > 1
+        {
+            main_group.rows.drain(1..);
         }
-        gitql_object.flat();
-    }
-    // If it a single group but it select only aggregations function,
-    // should return only first element in the group
-    else if number_of_groups == 1
-        && !select_query.has_group_by_statement
-        && select_query.has_aggregation_function
-        && main_group.len() > 1
-    {
-        main_group.rows.drain(1..);
     }
 
     // Into statement must be executed last after flatted and remove hidden selections
```

---

### Incident Patch 2: `7288cace` (2025-10-05)
**Commit Message**: Fix docs-tests on CI

**File**: `crates/gitql-core/src/schema.rs` (modified, +1/-26)
```diff
@@ -2,32 +2,7 @@ use std::collections::HashMap;
 
 use gitql_ast::types::DataType;
 
-/// A Representation of the Data Schema that constructed the following
-///
-/// [`tables_fields_names`]  is a map of tables and columns names
-///
-/// # Examples
-///
-/// ```
-///
-/// pub static ref TABLES_FIELDS_NAMES: HashMap<&'static str, Vec<&'static str>> = {
-///    let mut map = HashMap::new();
-///    map.insert("refs", vec!["name", "full_name", "type", "repo"]);
-/// }
-///
-/// ```
-///
-/// [`tables_fields_types`] is a map of each column name in general with the expected data type
-///
-/// # Examples
-///
-/// ```
-/// pub static ref TABLES_FIELDS_TYPES: HashMap<&'static str, Box<dyn DataType>> = {
-///    let mut map = HashMap::new();
-///    map.insert("commit_id", Box::new(TextType));
-/// }
-/// ```
-///
+/// A Representation of the Schema of the data including columns, tables and types
 pub struct Schema {
     pub tables_fields_names: HashMap<&'static str, Vec<&'static str>>,
     pub tables_fields_types: HashMap<&'static str, Box<dyn DataType>>,
```

---

### Incident Patch 3: `1a229519` (2025-09-06)
**Commit Message**: Fix statement kind for QualifyStatement

**File**: `crates/gitql-ast/src/statement.rs` (modified, +1/-1)
```diff
@@ -250,7 +250,7 @@ impl Statement for QualifyStatement {
     }
 
     fn kind(&self) -> StatementKind {
-        StatementKind::Where
+        StatementKind::Qualify
     }
 }
 
```

---

### Incident Patch 4: `45f22766` (2025-09-05)
**Commit Message**: Simplify checking for empty enumber with prefix

**File**: `crates/gitql-parser/src/tokenizer.rs` (modified, +3/-12)
```diff
@@ -534,14 +534,11 @@ impl Tokenizer {
 
     fn consume_binary_number(&mut self) -> Result<Token, Box<Diagnostic>> {
         let start_index = self.index;
-        let mut has_digit = false;
-
         while self.has_next() && self.is_current_char_func(|c| c == '_' || c == '0' || c >= '1') {
             self.advance();
-            has_digit = true;
         }
 
-        if !has_digit {
+        if start_index == self.index {
             return Err(
                 Diagnostic::error("Missing digits after the integer base prefix")
                     .add_help("Expect at least one binary digits after the prefix 0b")
@@ -574,15 +571,12 @@ impl Tokenizer {
 
     fn consume_octal_number(&mut self) -> Result<Token, Box<Diagnostic>> {
         let start_index = self.index;
-        let mut has_digit = false;
-
         while self.has_next() && self.is_current_char_func(|c| c == '_' || ('0'..='8').contains(&c))
         {
             self.advance();
-            has_digit = true;
         }
 
-        if !has_digit {
+        if start_index == self.index {
             return Err(
                 Diagnostic::error("Missing digits after the integer base prefix")
                     .add_help("Expect at least one octal digits after the prefix 0o")
@@ -615,14 +609,11 @@ impl Tokenizer {
 
     fn consume_hex_number(&mut self) -> Result<Token, Box<Diagnostic>> {
         let start_index = self.index;
-        let mut has_digit = false;
-
         while self.has_next() && self.is_current_char_func(|c| c == '_' || c.is_ascii_hexdigit()) {
             self.advance();
-            has_digit = true;
         }
 
-        if !has_digit {
+        if start_index == self.index {
             return Err(
                 Diagnostic::error("Missing digits after the integer base prefix")
                     .add_help("Expect at least one hex digits after the prefix 0x")
```

---

### Incident Patch 5: `0983b9a2` (2025-09-05)
**Commit Message**: Fix consuming tokens when parsing numbers

**File**: `crates/gitql-parser/src/parser.rs` (modified, +8/-2)
```diff
@@ -3261,8 +3261,14 @@ fn parse_primary_expression(
     }
 
     match &tokens[*position].kind {
-        TokenKind::Integer(value) => Ok(Box::new(NumberExpr::int(*value))),
-        TokenKind::Float(value) => Ok(Box::new(NumberExpr::float(*value))),
+        TokenKind::Integer(value) => {
+            *position += 1;
+            Ok(Box::new(NumberExpr::int(*value)))
+        }
+        TokenKind::Float(value) => {
+            *position += 1;
+            Ok(Box::new(NumberExpr::float(*value)))
+        }
         TokenKind::Infinity => parse_float_infinity_or_nan_expression(tokens, position),
         TokenKind::NaN => parse_float_infinity_or_nan_expression(tokens, position),
         TokenKind::Symbol(_) => parse_symbol_expression(context, env, tokens, position),
```

---

### Incident Patch 6: `1590aee4` (2025-02-19)
**Commit Message**: Fix parameter name

**File**: `crates/gitql-core/src/environment.rs` (modified, +2/-2)
```diff
@@ -89,10 +89,10 @@ impl Environment {
     pub fn with_window_functions(
         &mut self,
         signatures: &HashMap<&'static str, Signature>,
-        aggregation: &HashMap<&'static str, WindowFunction>,
+        window: &HashMap<&'static str, WindowFunction>,
     ) {
         self.window_signatures.extend(signatures.to_owned());
-        self.window_functions.extend(aggregation.to_owned());
+        self.window_functions.extend(window.to_owned());
     }
 
     /// Register new Modified Types table
```

---

### Incident Patch 7: `a98dcb76` (2025-02-09)
**Commit Message**: Fix type checker case of variant

**File**: `crates/gitql-ast/src/types/base.rs` (modified, +3/-2)
```diff
@@ -20,6 +20,7 @@ use super::range::RangeType;
 use super::text::TextType;
 use super::time::TimeType;
 use super::undefined::UndefType;
+use super::varargs::VarargsType;
 use super::variant::VariantType;
 
 dyn_clone::clone_trait_object!(DataType);
@@ -520,9 +521,9 @@ impl dyn DataType {
         self.as_any().downcast_ref::<OptionType>().is_some()
     }
 
-    /// Return true if this type is [`VariantType`]
+    /// Return true if this type is [`VarargsType`]
     pub fn is_varargs(&self) -> bool {
-        self.as_any().downcast_ref::<VariantType>().is_some()
+        self.as_any().downcast_ref::<VarargsType>().is_some()
     }
 
     /// Return true if this type is [`CompositeType`]
```

**File**: `crates/gitql-std/src/number/mod.rs` (modified, +3/-7)
```diff
@@ -164,14 +164,10 @@ pub fn register_std_number_function_signatures(map: &mut HashMap<&'static str, S
 pub fn numeric_abs(inputs: &[Box<dyn Value>]) -> Box<dyn Value> {
     let input_type = inputs[0].data_type();
     if input_type.is_float() {
-        return Box::new(FloatValue {
-            value: inputs[0].as_float().unwrap().abs(),
-        });
+        let value = inputs[0].as_float().unwrap().abs();
+        return Box::new(FloatValue::new(value));
     }
-
-    Box::new(IntValue {
-        value: inputs[0].as_int().unwrap().abs(),
-    })
+    Box::new(IntValue::new(inputs[0].as_int().unwrap().abs()))
 }
 
 pub fn numeric_pi(_inputs: &[Box<dyn Value>]) -> Box<dyn Value> {
```

---

### Incident Patch 8: `5f768191` (2025-02-09)
**Commit Message**: Fix number of required arguments error message

**File**: `crates/gitql-parser/src/type_checker.rs` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ pub fn check_function_call_arguments(
     if !has_varargs_parameter && arguments_count > parameters_count {
         return Err(Diagnostic::error(&format!(
             "Function `{}` expects `{}` arguments but got `{}`",
-            function_name, arguments_count, parameters_count
+            function_name, parameters_count, arguments_count
         ))
         .with_location(location)
         .as_boxed());
```

---

### Incident Patch 9: `17381fc3` (2025-01-13)
**Commit Message**: Fix parseing interval time

**File**: `README.md` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@ SELECT 1 + 2
 SELECT LEN("Git Query Language")
 SELECT "One" IN ("One", "Two", "Three")
 SELECT "Git Query Language" LIKE "%Query%"
+SELECT INTERVAL '1 year 2 mons 3 days 04:05:06.789'
 
 SET @arr = [1, 2, 3];
 SELECT [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
```

**File**: `crates/gitql-parser/src/parse_interval.rs` (modified, +3/-0)
```diff
@@ -133,6 +133,9 @@ fn parse_interval_literal(
                     }
                 }
             }
+
+            position += 1;
+            continue;
         }
 
         return Err(Diagnostic::error("Invalid input syntax for type interval")
```

---

### Incident Patch 10: `cb537e4f` (2025-01-13)
**Commit Message**: Fix line and column position after consuming single line comment

**File**: `crates/gitql-parser/src/tokenizer.rs` (modified, +2/-0)
```diff
@@ -752,6 +752,8 @@ impl Tokenizer {
 
         // Advance `\n`
         self.advance();
+        self.line_end += 1;
+        self.column_end = 0;
     }
 
     fn ignore_c_style_comment(&mut self) -> Result<(), Box<Diagnostic>> {
```

#### Recent Merged Pull Requests:
- **PR #148** (2026-01-05): Revise setup documentation (@muzimuzhi)
- **PR #133** (2024-12-01): Add PyQL to README as part of tools built using GitQL SDK (@galenseilis)
- **PR #131** (closed): Update summarize-release.py (@galenseilis)
- **PR #130** (2024-11-23): Update setup.md (@galenseilis)
- **PR #118** (2024-09-11): Add LTO to the Release profile (@zamazan4ik)
- **PR #108** (closed): doc: install cmake before gitql on windows (@zishon)
- **PR #92** (2024-03-02): add `weekday` date function #24 (@frectonz)
- **PR #91** (2024-03-01): add `minute` date function #24 (@frectonz)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
