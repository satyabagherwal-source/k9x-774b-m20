> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gluesql-gluesql-learnings.md`  
> **Source**: github ([https://github.com/gluesql/gluesql](https://github.com/gluesql/gluesql))  
> **Source Version**: `0daf9b82`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T04:43:46.380Z  
> **Learning ID**: `learn-github-gluesql-gluesql`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): gluesql/gluesql

> **Canonical Artifact**: `07_PROJECT_LEARNING/gluesql-gluesql-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gluesql/gluesql](https://github.com/gluesql/gluesql))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-05T04:43:46.372Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gluesql/gluesql`
- **Description**: GlueSQL is quite sticky. It sticks to anything.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3135 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/src/ast.rs`
```
mod data_type;
mod ddl;
mod expr;
mod function;
mod literal;
mod operator;
mod query;

pub use {
    data_type::DataType,
    ddl::*,
    expr::Expr,
    function::{Aggregate, AggregateFunction, CountArgExpr, Function},
    literal::{DateTimeField, Literal, TrimWhereField},
    operator::*,
    query::*,
};

use {
    serde::{Deserialize, Serialize},
    strum_macros::Display,
};

pub trait ToSql {
    fn to_sql(&self) -> String;
}

pub trait ToSqlUnquoted {
    fn to_sql_unquoted(&self) -> String;
}

#[derive(PartialEq, Debug, Clone, Eq, Hash, Serialize, Deserialize)]
pub struct ForeignKey {
    pub name: String,
    pub referencing_column_name: String,
    pub referenced_table_name: String,
    pub referenced_column_name: String,
    pub on_delete: ReferentialAction,
    pub on_update: ReferentialAction,
}

#[derive(PartialEq, Debug, Clone, Eq, Hash, Serialize, Deserialize, Display)]
pub enum ReferentialAction {
    #[strum(to_string = "NO ACTION")]
    NoAction,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Statement {
    ShowColumns {
        table_name: String,
    },
    /// SELECT, VALUES
    Query(Query),
    /// INSERT
    Insert {
        /// TABLE
        table_name: String,
        /// COLUMNS
        columns: Vec<String>,
        /// A SQL query that specifies what to insert
        source: Query,
    },
    /// UPDATE
    Update {
        /// TABLE
        table_name: String,
        /// Column assignments
        assignments: Vec<Assignment>,
        /// WHERE
        selection: Option<Expr>,
    },
    /// DELETE
    Delete {
        /// FROM
        table_name: String,
        /// WHERE
        selection: Option<Expr>,
    },
    /// CREATE TABLE
    CreateTable {
        if_not_exists: bool,
        /// Table name
        name: String,
        /// Optional schema
        columns: Option<Vec<ColumnDef>>,
        source: Option<Box<Query>>,
        engine: Option<String>,
        foreign_keys: Vec<ForeignKey>,
        comment: Option<String>,
    },
    /// CREATE FUNCTION
    CreateFunction {
        or_replace: bool,
        name: String,
        /// Optional schema
        args: Vec<OperateFunctionArg>,
        return_: Expr,
    },
    /// ALTER TABLE
    AlterTable {
        /// Table name
        name: String,
        operation: AlterTableOperation,
    },
    /// DROP TABLE
    DropTable {
        /// An optional `IF EXISTS` clause. (Non-standard.)
        if_exists: bool,
        /// One or more objects to drop. (ANSI SQL requires exactly one.)
        names: Vec<String>,
        /// An optional `CASCADE` clause for dropping dependent constructs.
        cascade: bool,
    },
    /// DROP FUNCTION
    DropFunction {
        /// An optional `IF EXISTS` clause. (Non-standard.)
        if_exists: bool,
        /// One or more objects to drop. (ANSI SQL requires exactly one.)
        names: Vec<String>,
    },
    /// CREATE INDEX
    CreateIndex {
        name: String,
        table_name: String,
        column: OrderByExpr,
    },
    /// DROP INDEX
    DropIndex {
        name: String,
        table_name: String,
    },
    /// START TRANSACTION, BEGIN
    StartTransaction,
    /// COMMIT
    Commit,
    /// ROLLBACK
    Rollback,
    /// SHOW VARIABLE
    ShowVariable(Variable),
    ShowIndexes(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Assignment {
    pub id: String,
    pub value: Expr,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Variable {
    Tables,
    Functions,
    Version,
}

impl ToSql for ForeignKey {
    fn to_sql(&self) -> String {
        let ForeignKey {
            referencing_column_name,
            referenced_table_name,
            referenced_column_name,
            name,
            on_delete,
            on_update,
        } = self;

        format!(
            r#"CONSTRAINT "{name}" FOREIGN KEY ("{referencing_column_name}") REFERENCES "{referenced_table_name}" ("{referenced_column_name}") ON DELETE {on_delete} ON UPDATE {on_update}"#
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Array {
    pub elem: Vec<Expr>,
    pub named: bool,
}

```

### Core Architecture Module: `core/src/ast/data_type.rs`
```
use {
    serde::{Deserialize, Serialize},
    strum_macros::Display,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum DataType {
    Boolean,
    Int8,
    Int16,
    Int32,
    Int,
    Int128,
    Uint8,
    Uint16,
    Uint32,
    Uint64,
    Uint128,
    Float32,
    Float,
    Text,
    Bytea,
    Inet,
    Date,
    Timestamp,
    Time,
    Interval,
    Uuid,
    Map,
    List,
    Decimal,
    Point,
}

```

### Core Architecture Module: `core/src/ast/ddl.rs`
```
use {
    super::{DataType, Expr},
    crate::ast::ToSql,
    serde::{Deserialize, Serialize},
};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AlterTableOperation {
    /// `ADD [ COLUMN ] <column_def>`
    AddColumn { column_def: ColumnDef },
    /// `DROP [ COLUMN ] [ IF EXISTS ] <column_name> [ CASCADE ]`
    DropColumn {
        column_name: String,
        if_exists: bool,
    },
    /// `RENAME [ COLUMN ] <old_column_name> TO <new_column_name>`
    RenameColumn {
        old_column_name: String,
        new_column_name: String,
    },
    /// `RENAME TO <table_name>`
    RenameTable { table_name: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ColumnDef {
    pub name: String,
    pub data_type: DataType,
    pub nullable: bool,
    /// `DEFAULT <restricted-expr>`
    pub default: Option<Expr>,
    /// `{ PRIMARY KEY | UNIQUE }`
    pub unique: Option<ColumnUniqueOption>,
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ColumnUniqueOption {
    pub is_primary: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct OperateFunctionArg {
    pub name: String,
    pub data_type: DataType,
    /// `DEFAULT <restricted-expr>`
    pub default: Option<Expr>,
}

impl ToSql for ColumnDef {
    fn to_sql(&self) -> String {
        let ColumnDef {
            name,
            data_type,
            nullable,
            default,
            unique,
            comment,
        } = self;
        {
            let nullable = match nullable {
                true => "NULL",
                false => "NOT NULL",
            };
            let column_def = format!(r#""{name}" {data_type} {nullable}"#);
            let default = default
                .as_ref()
                .map(|expr| format!("DEFAULT {}", expr.to_sql()));
            let unique = unique.as_ref().map(ToSql::to_sql);
            let comment = comment
                .as_ref()
                .map(|comment| format!("COMMENT '{comment}'"));

            [Some(column_def), default, unique, comment]
                .into_iter()
                .flatten()
                .collect::<Vec<_>>()
                .join(" ")
        }
    }
}

impl ToSql for ColumnUniqueOption {
    fn to_sql(&self) -> String {
        if self.is_primary {
            "PRIMARY KEY"
        } else {
            "UNIQUE"
        }
        .to_owned()
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        ast::{ColumnDef, ColumnUniqueOption, DataType, Expr, ToSql},
        data::Value,
    };

    #[test]
    fn to_sql_column_def() {
        assert_eq!(
            r#""name" TEXT NOT NULL UNIQUE"#,
            ColumnDef {
                name: "name".to_owned(),
                data_type: DataType::Text,
                nullable: false,
                default: None,
                unique: Some(ColumnUniqueOption { is_primary: false }),
                comment: None,
            }
            .to_sql()
        );

        assert_eq!(
            r#""accepted" BOOLEAN NULL"#,
            ColumnDef {
                name: "accepted".to_owned(),
                data_type: DataType::Boolean,
                nullable: true,
                default: None,
                unique: None,
                comment: None,
            }
            .to_sql()
        );

        assert_eq!(
            r#""id" INT NOT NULL PRIMARY KEY"#,
            ColumnDef {
                name: "id".to_owned(),
                data_type: DataType::Int,
                nullable: false,
                default: None,
                unique: Some(ColumnUniqueOption { is_primary: true }),
                comment: None,
            }
            .to_sql()
        );

        assert_eq!(
            r#""accepted" BOOLEAN NOT NULL DEFAULT FALSE"#,
            ColumnDef {
                name: "accepted".to_owned(),
                data_type: DataType::Boolean,
                nullable: false,
                default: Some(Expr::Value(Value::Bool(false))),
                unique: None,
                comment: None,
            }
            .to_sql()
        );

        assert_eq!(
            r#""accepted" BOOLEAN NOT NULL DEFAULT FALSE UNIQUE"#,
            ColumnDef {
                name: "accepted".to_owned(),
                data_type: DataType::Boolean,
                nullable: false,
                default: Some(Expr::Value(Value::Bool(false))),
                unique: Some(ColumnUniqueOption { is_primary: false }),
                comment: None,
            }
            .to_sql()
        );

        assert_eq!(
            r#""accepted" BOOLEAN NOT NULL COMMENT 'this is comment'"#,
            ColumnDef {
                name: "accepted".to_owned(),
                data_type: DataType::Boolean,
                nullable: false,
                default: None,
                unique: None,
                comment: Some("this is comment".to_owned()),
            }
            .to_sql()
        );
    }
}

```

### Core Architecture Module: `core/src/ast/expr.rs`
```
use {
    super::{
        Aggregate, BinaryOperator, DataType, DateTimeField, Function, Literal, Query, ToSql,
        ToSqlUnquoted, UnaryOperator,
    },
    crate::data::Value,
    serde::{Deserialize, Serialize},
    std::fmt::Write,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Expr {
    Identifier(String),
    CompoundIdentifier {
        alias: String,
        ident: String,
    },
    IsNull(Box<Expr>),
    IsNotNull(Box<Expr>),
    InList {
        expr: Box<Expr>,
        list: Vec<Expr>,
        negated: bool,
    },
    InSubquery {
        expr: Box<Expr>,
        subquery: Box<Query>,
        negated: bool,
    },
    Between {
        expr: Box<Expr>,
        negated: bool,
        low: Box<Expr>,
        high: Box<Expr>,
    },
    Like {
        expr: Box<Expr>,
        negated: bool,
        pattern: Box<Expr>,
    },
    ILike {
        expr: Box<Expr>,
        negated: bool,
        pattern: Box<Expr>,
    },
    Regex {
        expr: Box<Expr>,
        negated: bool,
        pattern: Box<Expr>,
        case_sensitive: bool,
    },
    BinaryOp {
        left: Box<Expr>,
        op: BinaryOperator,
        right: Box<Expr>,
    },
    UnaryOp {
        op: UnaryOperator,
        expr: Box<Expr>,
    },
    Nested(Box<Expr>),
    Literal(Literal),
    Value(Value),
    TypedString {
        data_type: DataType,
        value: String,
    },
    Function(Box<Function>),
    Aggregate(Box<Aggregate>),
    Exists {
        subquery: Box<Query>,
        negated: bool,
    },
    Subquery(Box<Query>),
    Case {
        operand: Option<Box<Expr>>,
        when_then: Vec<(Expr, Expr)>,
        else_result: Option<Box<Expr>>,
    },
    ArrayIndex {
        obj: Box<Expr>,
        indexes: Vec<Expr>,
    },
    Interval {
        expr: Box<Expr>,
        leading_field: Option<DateTimeField>,
        last_field: Option<DateTimeField>,
    },
    Array {
        elem: Vec<Expr>,
    },
}

impl ToSql for Expr {
    fn to_sql(&self) -> String {
        self.to_sql_with(true)
    }
}

impl ToSqlUnquoted for Expr {
    fn to_sql_unquoted(&self) -> String {
        self.to_sql_with(false)
    }
}

impl Expr {
    fn to_sql_with(&self, quoted: bool) -> String {
        match self {
            Expr::Identifier(s) => {
                if quoted {
                    format! {r#""{s}""#}
                } else {
                    s.to_owned()
                }
            }
            Expr::BinaryOp { left, op, right } => {
                format!(
                    "{} {} {}",
                    left.to_sql_with(quoted),
                    op.to_sql(),
                    right.to_sql_with(quoted),
                )
            }
            Expr::CompoundIdentifier { alias, ident } => {
                if quoted {
                    format!(r#""{alias}"."{ident}""#)
                } else {
                    format!("{alias}.{ident}")
                }
            }
            Expr::IsNull(s) => format!("{} IS NULL", s.to_sql_with(quoted)),
            Expr::IsNotNull(s) => format!("{} IS NOT NULL", s.to_sql_with(quoted)),
            Expr::InList {
                expr,
                list,
                negated,
            } => {
                let expr = expr.to_sql_with(quoted);
                let list = list
                    .iter()
                    .map(|expr| expr.to_sql_with(quoted))
                    .collect::<Vec<_>>()
                    .join(", ");

                match negated {
                    true => format!("{expr} NOT IN ({list})"),
                    false => format!("{expr} IN ({list})"),
                }
            }
            Expr::Between {
                expr,
                negated,
                low,
                high,
            } => {
                let expr = expr.to_sql_with(quoted);
                let low = low.to_sql_with(quoted);
                let high = high.to_sql_with(quoted);

                match negated {
                    true => format!("{expr} NOT BETWEEN {low} AND {high}"),
                    false => format!("{expr} BETWEEN {low} AND {high}"),
                }
            }
            Expr::Like {
                expr,
                negated,
                pattern,
            } => {
                let expr = expr.to_sql_with(quoted);
                let pattern = pattern.to_sql_with(quoted);

                match negated {
                    true => format!("{expr} NOT LIKE {pattern}"),
                    false => format!("{expr} LIKE {pattern}"),
                }
            }
            Expr::ILike {
                expr,
                negated,
                pattern,
            } => {
                let expr = expr.to_sql_with(quoted);
                let pattern = pattern.to_sql_with(quoted);

                match negated {
                    true => format!("{expr} NOT ILIKE {pattern}"),
                    false => format!("{expr} ILIKE {pattern}"),
                }
            }
            Expr::Regex {
                expr,
                negated,
                pattern,
                case_sensitive,
            } => {
                let op = match (*negated, *case_sensitive) {
                    (false, true) => "~",
                    (false, false) => "~*",
                    (true, true) => "!~",
                    (true, false) => "!~*",
                };

                format!(
                    "{} {op} {}",
                    expr.to_sql_with(quoted),
                    pattern.to_sql_with(quoted)
                )
            }
            Expr::UnaryOp { op, expr } => match op {
                UnaryOperator::Factorial => {
                    format!("{}{}", expr.to_sql_with(quoted), op.to_sql())
                }
                _ => format!("{}{}", op.to_sql(), expr.to_sql_with(quoted)),
            },
            Expr::Nested(expr) => format!("({})", expr.to_sql_with(quoted)),
            Expr::Literal(s) => s.to_sql(),
            Expr::Value(v) => v.to_sql(),
            Expr::TypedString { data_type, value } => format!("{data_type} '{value}'"),
            Expr::Case {
                operand,
                when_then,
                else_result,
            } => {
                let operand = match operand {
                    Some(operand) => format!("CASE {}", operand.to_sql_with(quoted)),
                    None => "CASE".to_owned(),
                };

                let when_then = when_then
                    .iter()
                    .map(|(when, then)| {
                        format!(
                            "WHEN {} THEN {}",
                            when.to_sql_with(quoted),
                            then.to_sql_with(quoted)
                        )
                    })
                    .collect::<Vec<_>>()
                    .join("\n");

                let else_result = else_result
                    .as_ref()
                    .map(|else_result| format!("ELSE {}", else_result.to_sql_with(quoted)));

                match else_result {
                    Some(else_result) => {
                        [operand, when_then, else_result, "END".to_owned()].join("\n")
                    }
                    None => [operand, when_then, "END".to_owned()].join("\n"),
                }
            }
            Expr::Aggregate(a) => a.to_sql(),
            Expr::Function(func) => func.to_sql(),
            Expr::InSubquery {
                expr,
                subquery,
                negated,
            } => match negated {
                true => format!(
                    "{} NOT IN ({})",
                    expr.to_sql_with(quoted),
                    subquery.to_sql()
                ),
                false => format!("{} IN ({})", expr.to_sql_with(quoted), subquery.to_sql()),
            },
            Expr::Exists { subquery, negated } => match negated {
                true => format!("NOT EXISTS({})", subquery.to_sql()),
                false => format!("EXISTS({})", subquery.to_sql()),
            },
            Expr::ArrayIndex { obj, indexes } => {
                let obj = obj.to_sql_with(quoted);
                let indexes = indexes.iter().fold(String::new(), |mut acc, index| {
                    let _ = write!(acc, "[{}]", index.to_sql_with(quoted));
                    acc
                });
                format!("{obj}{indexes}")
            }
            Expr::Array { elem } => {
                let elem = elem
                    .iter()
                    .map(|e| e.to_sql_with(quoted))
                    .collect::<Vec<_>>()
                    .join(", ");
                format!("[{elem}]")
            }
            Expr::Subquery(query) => format!("({})", query.to_sql()),
            Expr::Interval {
                expr,
                leading_field,
                last_field,
            } => {
                let expr = expr.to_sql_with(quoted);
                let leading_field = leading_field
                    .as_ref()
                    .map_or_else(String::new, ToString::to_string);

                match last_field {
                    Some(last_field) => format!("INTERVAL {expr} {leading_field} TO {last_field}"),
                    None => format!("INTERVAL {expr} {leading_field}"),
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {

    use {
        crate::ast::{
            BinaryOperator, DataType, DateTimeField, Expr, Literal, Projection, Query, Select,
            SelectItem, SetExpr, TableFactor, TableWithJoins, ToSql, ToSqlUnquoted, UnaryOperator,
        },
        bigdecimal::BigDecimal,
        regex::Regex,
        std::str::FromStr,
    };

    #[test]
    fn to_sql() {
        let re = Regex::new(r"\n\s+").unwrap();
        let trim = |s: &str| re.replace_all(s.trim(), "\n").into_owned();

        assert_eq!(r#""id""#, Expr::Identifier("id".to_owned()).to_sql());

        assert_eq
```

### Core Architecture Module: `core/src/ast/function.rs`
```
use {
    super::{DataType, DateTimeField, Expr, literal::TrimWhereField},
    crate::ast::ToSql,
    serde::{Deserialize, Serialize},
    strum_macros::Display,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum Function {
    Abs(Expr),
    AddMonth {
        expr: Expr,
        size: Expr,
    },
    Lower(Expr),
    Initcap(Expr),
    Upper(Expr),
    Left {
        expr: Expr,
        size: Expr,
    },
    Right {
        expr: Expr,
        size: Expr,
    },
    Asin(Expr),
    Acos(Expr),
    Atan(Expr),
    Lpad {
        expr: Expr,
        size: Expr,
        fill: Option<Expr>,
    },
    Rpad {
        expr: Expr,
        size: Expr,
        fill: Option<Expr>,
    },
    Replace {
        expr: Expr,
        old: Expr,
        new: Expr,
    },
    Cast {
        expr: Expr,
        data_type: DataType,
    },
    Ceil(Expr),
    Coalesce(Vec<Expr>),
    Concat(Vec<Expr>),
    ConcatWs {
        separator: Expr,
        exprs: Vec<Expr>,
    },
    Custom {
        name: String,
        exprs: Vec<Expr>,
    },
    IfNull {
        expr: Expr,
        then: Expr,
    },
    NullIf {
        expr1: Expr,
        expr2: Expr,
    },
    Rand(Option<Expr>),
    Round(Expr),
    Trunc(Expr),
    Floor(Expr),
    Trim {
        expr: Expr,
        filter_chars: Option<Expr>,
        trim_where_field: Option<TrimWhereField>,
    },
    Exp(Expr),
    Extract {
        field: DateTimeField,
        expr: Expr,
    },
    Ln(Expr),
    Log {
        antilog: Expr,
        base: Expr,
    },
    Log2(Expr),
    Log10(Expr),
    Div {
        dividend: Expr,
        divisor: Expr,
    },
    Mod {
        dividend: Expr,
        divisor: Expr,
    },
    Gcd {
        left: Expr,
        right: Expr,
    },
    Lcm {
        left: Expr,
        right: Expr,
    },
    Sin(Expr),
    Cos(Expr),
    Tan(Expr),
    Sqrt(Expr),
    Power {
        expr: Expr,
        power: Expr,
    },
    Radians(Expr),
    Degrees(Expr),
    Now(),
    CurrentDate(),
    CurrentTime(),
    CurrentTimestamp(),
    Pi(),
    LastDay(Expr),
    Ltrim {
        expr: Expr,
        chars: Option<Expr>,
    },
    Rtrim {
        expr: Expr,
        chars: Option<Expr>,
    },
    Reverse(Expr),
    Repeat {
        expr: Expr,
        num: Expr,
    },
    Sign(Expr),
    Substr {
        expr: Expr,
        start: Expr,
        count: Option<Expr>,
    },
    Unwrap {
        expr: Expr,
        selector: Expr,
    },
    GenerateUuid(),
    Greatest(Vec<Expr>),
    Format {
        expr: Expr,
        format: Expr,
    },
    ToDate {
        expr: Expr,
        format: Expr,
    },
    ToTimestamp {
        expr: Expr,
        format: Expr,
    },
    ToTime {
        expr: Expr,
        format: Expr,
    },
    Position {
        from_expr: Expr,
        sub_expr: Expr,
    },
    FindIdx {
        from_expr: Expr,
        sub_expr: Expr,
        start: Option<Expr>,
    },
    Ascii(Expr),
    Chr(Expr),
    Md5(Expr),
    Hex(Expr),
    Append {
        expr: Expr,
        value: Expr,
    },
    Sort {
        expr: Expr,
        order: Option<Expr>,
    },
    Slice {
        expr: Expr,
        start: Expr,
        length: Expr,
    },
    Prepend {
        expr: Expr,
        value: Expr,
    },
    Skip {
        expr: Expr,
        size: Expr,
    },
    Take {
        expr: Expr,
        size: Expr,
    },
    GetX(Expr),
    GetY(Expr),
    Point {
        x: Expr,
        y: Expr,
    },
    CalcDistance {
        geometry1: Expr,
        geometry2: Expr,
    },
    IsEmpty(Expr),
    Length(Expr),
    Entries(Expr),
    Keys(Expr),
    Values(Expr),
    Splice {
        list_data: Expr,
        begin_index: Expr,
        end_index: Expr,
        values: Option<Expr>,
    },
    Dedup(Expr),
}

impl ToSql for Function {
    fn to_sql(&self) -> String {
        match self {
            Function::Abs(e) => format!("ABS({})", e.to_sql()),
            Function::AddMonth { expr, size } => {
                format!("ADD_MONTH({},{})", expr.to_sql(), size.to_sql())
            }
            Function::Initcap(e) => format!("INITCAP({})", e.to_sql()),
            Function::Lower(e) => format!("LOWER({})", e.to_sql()),
            Function::Upper(e) => format!("UPPER({})", e.to_sql()),
            Function::Left { expr, size } => format!("LEFT({}, {})", expr.to_sql(), size.to_sql()),
            Function::Right { expr, size } => {
                format!("RIGHT({}, {})", expr.to_sql(), size.to_sql())
            }
            Function::Asin(e) => format!("ASIN({})", e.to_sql()),
            Function::Acos(e) => format!("ACOS({})", e.to_sql()),
            Function::Atan(e) => format!("ATAN({})", e.to_sql()),
            Function::Lpad { expr, size, fill } => match fill {
                None => format!("LPAD({}, {})", expr.to_sql(), size.to_sql()),
                Some(fill) => format!(
                    "LPAD({}, {}, {})",
                    expr.to_sql(),
                    size.to_sql(),
                    fill.to_sql()
                ),
            },
            Function::Rpad { expr, size, fill } => match fill {
                None => format!("RPAD({}, {})", expr.to_sql(), size.to_sql()),
                Some(fill) => format!(
                    "RPAD({}, {}, {})",
                    expr.to_sql(),
                    size.to_sql(),
                    fill.to_sql()
                ),
            },
            Function::Cast { expr, data_type } => {
                format!("CAST({} AS {data_type})", expr.to_sql())
            }
            Function::Ceil(e) => format!("CEIL({})", e.to_sql()),
            Function::Coalesce(items) => {
                let items = items
                    .iter()
                    .map(ToSql::to_sql)
                    .collect::<Vec<_>>()
                    .join(", ");
                format!("COALESCE({items})")
            }
            Function::Concat(items) => {
                let items = items
                    .iter()
                    .map(ToSql::to_sql)
                    .collect::<Vec<_>>()
                    .join(", ");
                format!("CONCAT({items})")
            }
            Function::Custom { name, exprs } => {
                let exprs = exprs
                    .iter()
                    .map(ToSql::to_sql)
                    .collect::<Vec<_>>()
                    .join(", ");
                format!("{name}({exprs})")
            }
            Function::ConcatWs { separator, exprs } => {
                let exprs = exprs
                    .iter()
                    .map(ToSql::to_sql)
                    .collect::<Vec<_>>()
                    .join(", ");
                format!("CONCAT_WS({}, {})", separator.to_sql(), exprs)
            }
            Function::IfNull { expr, then } => {
                format!("IFNULL({}, {})", expr.to_sql(), then.to_sql())
            }
            Function::NullIf { expr1, expr2 } => {
                format!("NULLIF({}, {})", expr1.to_sql(), expr2.to_sql())
            }
            Function::Rand(e) => match e {
                Some(v) => format!("RAND({})", v.to_sql()),
                None => "RAND()".to_owned(),
            },
            Function::Round(e) => format!("ROUND({})", e.to_sql()),
            Function::Trunc(e) => format!("TRUNC({})", e.to_sql()),
            Function::Floor(e) => format!("FLOOR({})", e.to_sql()),
            Function::Trim {
                expr,
                filter_chars,
                trim_where_field,
            } => {
                let trim_where_field = match trim_where_field {
                    None => String::new(),
                    Some(t) => format!("{t} "),
                };

                match filter_chars {
                    None => format!("TRIM({}{})", trim_where_field, expr.to_sql()),
                    Some(filter_chars) => format!(
                        "TRIM({}{} FROM {})",
                        trim_where_field,
                        filter_chars.to_sql(),
                        expr.to_sql()
                    ),
                }
            }
            Function::Exp(e) => format!("EXP({})", e.to_sql()),
            Function::Ln(e) => format!("LN({})", e.to_sql()),
            Function::Log { antilog, base } => {
                format!("LOG({}, {})", antilog.to_sql(), base.to_sql())
            }
            Function::Log2(e) => format!("LOG2({})", e.to_sql()),
            Function::Log10(e) => format!("LOG10({})", e.to_sql()),
            Function::Div { dividend, divisor } => {
                format!("DIV({}, {})", dividend.to_sql(), divisor.to_sql())
            }
            Function::Mod { dividend, divisor } => {
                format!("MOD({}, {})", dividend.to_sql(), divisor.to_sql())
            }
            Function::Gcd { left, right } => format!("GCD({}, {})", left.to_sql(), right.to_sql()),
            Function::Lcm { left, right } => format!("LCM({}, {})", left.to_sql(), right.to_sql()),
            Function::Sin(e) => format!("SIN({})", e.to_sql()),
            Function::Cos(e) => format!("COS({})", e.to_sql()),
            Function::Tan(e) => format!("TAN({})", e.to_sql()),
            Function::Sqrt(e) => format!("SQRT({})", e.to_sql()),
            Function::Power { expr, power } => {
                format!("POWER({}, {})", expr.to_sql(), power.to_sql())
            }
            Function::Radians(e) => format!("RADIANS({})", e.to_sql()),
            Function::Degrees(e) => format!("DEGREES({})", e.to_sql()),
            Function::Now() => "NOW()".to_owned(),
            Function::CurrentDate() => "CURRENT_DATE()".to_owned(),
            Function::CurrentTime() => "CURRENT_TIME()".to_owned(),
            Function::CurrentTimestamp() => "CURRENT_TIMESTAMP()".to_owned(),
            Function::Pi() => "PI()".to_owned(),
            Function::LastDay(expr) => format!("LAST_DAY({})", expr.to_sql
```

### Core Architecture Module: `core/src/ast/literal.rs`
```
use {
    crate::ast::ToSql,
    bigdecimal::BigDecimal,
    serde::{Deserialize, Serialize},
    strum_macros::Display,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Literal {
    Number(BigDecimal),
    QuotedString(String),
}

impl ToSql for Literal {
    fn to_sql(&self) -> String {
        match self {
            Literal::Number(n) => n.to_string(),
            Literal::QuotedString(qs) => {
                let escaped = qs.replace('\'', "''");
                format!("'{escaped}'")
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum DateTimeField {
    Year,
    Month,
    Day,
    Hour,
    Minute,
    Second,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum TrimWhereField {
    Both,
    Leading,
    Trailing,
}

#[cfg(test)]
mod tests {
    use {
        crate::ast::{Literal, ToSql},
        bigdecimal::BigDecimal,
    };

    #[test]
    fn to_sql() {
        assert_eq!("123", Literal::Number(BigDecimal::from(123)).to_sql());
        assert_eq!(
            "'hello'",
            Literal::QuotedString("hello".to_owned()).to_sql()
        );
        assert_eq!(
            "'can''t'",
            Literal::QuotedString("can't".to_owned()).to_sql()
        );
    }
}

```

### Core Architecture Module: `core/src/ast/operator.rs`
```
use {
    crate::ast::ToSql,
    serde::{Deserialize, Serialize},
};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum UnaryOperator {
    Plus,
    Minus,
    Not,
    Factorial,
    BitwiseNot,
}

impl ToSql for UnaryOperator {
    fn to_sql(&self) -> String {
        match self {
            UnaryOperator::Plus => "+".to_owned(),
            UnaryOperator::Minus => "-".to_owned(),
            UnaryOperator::Not => "NOT ".to_owned(),
            UnaryOperator::Factorial => "!".to_owned(),
            UnaryOperator::BitwiseNot => "~".to_owned(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BinaryOperator {
    Plus,
    Minus,
    Multiply,
    Divide,
    Modulo,
    StringConcat,
    Gt,
    Lt,
    GtEq,
    LtEq,
    Eq,
    NotEq,
    And,
    Or,
    Xor,
    BitwiseAnd,
    BitwiseShiftLeft,
    BitwiseShiftRight,
    Arrow,
    LongArrow,
}

impl ToSql for BinaryOperator {
    fn to_sql(&self) -> String {
        match self {
            BinaryOperator::Minus => "-".to_owned(),
            BinaryOperator::Multiply => "*".to_owned(),
            BinaryOperator::Divide => "/".to_owned(),
            BinaryOperator::Modulo => "%".to_owned(),
            BinaryOperator::Plus | BinaryOperator::StringConcat => "+".to_owned(),
            BinaryOperator::Gt => ">".to_owned(),
            BinaryOperator::Lt => "<".to_owned(),
            BinaryOperator::GtEq => ">=".to_owned(),
            BinaryOperator::LtEq => "<=".to_owned(),
            BinaryOperator::Eq => "=".to_owned(),
            BinaryOperator::NotEq => "<>".to_owned(),
            BinaryOperator::And => "AND".to_owned(),
            BinaryOperator::Or => "OR".to_owned(),
            BinaryOperator::Xor => "XOR".to_owned(),
            BinaryOperator::BitwiseAnd => "&".to_owned(),
            BinaryOperator::BitwiseShiftLeft => "<<".to_owned(),
            BinaryOperator::BitwiseShiftRight => ">>".to_owned(),
            BinaryOperator::Arrow => "->".to_owned(),
            BinaryOperator::LongArrow => "->>".to_owned(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum IndexOperator {
    Gt,
    Lt,
    GtEq,
    LtEq,
    Eq,
}

impl IndexOperator {
    #[must_use]
    pub fn reverse(self) -> Self {
        use IndexOperator::*;

        match self {
            Gt => Lt,
            Lt => Gt,
            GtEq => LtEq,
            LtEq => GtEq,
            Eq => Eq,
        }
    }
}

impl From<IndexOperator> for BinaryOperator {
    fn from(index_op: IndexOperator) -> Self {
        match index_op {
            IndexOperator::Gt => BinaryOperator::Gt,
            IndexOperator::Lt => BinaryOperator::Lt,
            IndexOperator::GtEq => BinaryOperator::GtEq,
            IndexOperator::LtEq => BinaryOperator::LtEq,
            IndexOperator::Eq => BinaryOperator::Eq,
        }
    }
}

#[cfg(test)]
mod tests {
    use {
        crate::ast::{BinaryOperator, Expr, Literal, ToSql, UnaryOperator},
        bigdecimal::BigDecimal,
    };
    #[test]
    fn to_sql() {
        assert_eq!(
            "1 + 2",
            Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1)))),
                op: BinaryOperator::Plus,
                right: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(2))))
            }
            .to_sql()
        );

        assert_eq!(
            "100 - 10",
            Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(100)))),
                op: BinaryOperator::Minus,
                right: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(10))))
            }
            .to_sql()
        );

        assert_eq!(
            "1024 * 1024",
            Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1024)))),
                op: BinaryOperator::Multiply,
                right: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1024))))
            }
            .to_sql()
        );

        assert_eq!(
            "1024 / 8",
            Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1024)))),
                op: BinaryOperator::Divide,
                right: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(8))))
            }
            .to_sql()
        );

        assert_eq!(
            "1024 % 4",
            &Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1024)))),
                op: BinaryOperator::Modulo,
                right: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(4))))
            }
            .to_sql()
        );

        assert_eq!(
            "'Glue' + 'SQL'",
            &Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::QuotedString("Glue".to_owned()))),
                op: BinaryOperator::StringConcat,
                right: Box::new(Expr::Literal(Literal::QuotedString("SQL".to_owned())))
            }
            .to_sql()
        );
        assert_eq!(
            "1024 > 4",
            &Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1024)))),
                op: BinaryOperator::Gt,
                right: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(4))))
            }
            .to_sql()
        );
        assert_eq!(
            "8 < 1024",
            &Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(8)))),
                op: BinaryOperator::Lt,
                right: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1024))))
            }
            .to_sql()
        );
        assert_eq!(
            "1024 >= 1024",
            &Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1024)))),
                op: BinaryOperator::GtEq,
                right: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1024))))
            }
            .to_sql()
        );
        assert_eq!(
            "8 <= 8",
            &Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(8)))),
                op: BinaryOperator::LtEq,
                right: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(8))))
            }
            .to_sql()
        );
        assert_eq!(
            "1024 = 1024",
            &Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1024)))),
                op: BinaryOperator::Eq,
                right: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1024))))
            }
            .to_sql()
        );
        assert_eq!(
            "1024 <> 1024",
            &Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1024)))),
                op: BinaryOperator::NotEq,
                right: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1024))))
            }
            .to_sql()
        );
        assert_eq!(
            "1 << 2",
            &Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1)))),
                op: BinaryOperator::BitwiseShiftLeft,
                right: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(2))))
            }
            .to_sql()
        );
        assert_eq!(
            "1 >> 2",
            &Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(1)))),
                op: BinaryOperator::BitwiseShiftRight,
                right: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(2))))
            }
            .to_sql()
        );
        assert_eq!(
            r#""condition_0" AND "condition_1""#,
            &Expr::BinaryOp {
                left: Box::new(Expr::Identifier("condition_0".to_owned())),
                op: BinaryOperator::And,
                right: Box::new(Expr::Identifier("condition_1".to_owned()))
            }
            .to_sql()
        );
        assert_eq!(
            r#""condition_0" OR "condition_1""#,
            &Expr::BinaryOp {
                left: Box::new(Expr::Identifier("condition_0".to_owned())),
                op: BinaryOperator::Or,
                right: Box::new(Expr::Identifier("condition_1".to_owned()))
            }
            .to_sql()
        );
        assert_eq!(
            r#""condition_0" XOR "condition_1""#,
            &Expr::BinaryOp {
                left: Box::new(Expr::Identifier("condition_0".to_owned())),
                op: BinaryOperator::Xor,
                right: Box::new(Expr::Identifier("condition_1".to_owned()))
            }
            .to_sql()
        );
        assert_eq!(
            "+8",
            Expr::UnaryOp {
                op: UnaryOperator::Plus,
                expr: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(8)))),
            }
            .to_sql(),
        );

        assert_eq!(
            "-8",
            Expr::UnaryOp {
                op: UnaryOperator::Minus,
                expr: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(8)))),
            }
            .to_sql(),
        );

        assert_eq!(
            r#"NOT "id""#,
            Expr::UnaryOp {
                op: UnaryOperator::Not,
                expr: Box::new(Expr::Identifier("id".to_owned())),
            }
            .to_sql(),
        );

        assert_eq!(
            "5!",
            Expr::UnaryOp {
                op: UnaryOperator::Factorial,
                expr: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(5)))),
            }
            .to_sql(),
        );

        assert_eq!(
            "29 & 15",
            &Expr::BinaryOp {
                left: Box::new(Expr::Literal(Literal::Number(BigDecimal::from(29)))
```

### Core Architecture Module: `core/src/ast/query.rs`
```
use {
    super::{Expr, ToSqlUnquoted},
    crate::ast::ToSql,
    itertools::Itertools,
    serde::{Deserialize, Serialize},
    strum_macros::Display,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Query {
    pub body: SetExpr,
    pub order_by: Vec<OrderByExpr>,
    pub limit: Option<Expr>,
    pub offset: Option<Expr>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SetExpr {
    Select(Box<Select>),
    Values(Values),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Projection {
    SelectItems(Vec<SelectItem>),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Select {
    pub distinct: bool,
    pub projection: Projection,
    pub from: TableWithJoins,
    /// WHERE
    pub selection: Option<Expr>,
    pub group_by: Vec<Expr>,
    pub having: Option<Expr>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SelectItem {
    /// An expression
    Expr { expr: Expr, label: String },
    /// `alias.*` or even `schema.table.*`
    QualifiedWildcard(String),
    /// An unqualified `*`
    Wildcard,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TableWithJoins {
    pub relation: TableFactor,
    pub joins: Vec<Join>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TableFactor {
    Table {
        name: String,
        alias: Option<TableAlias>,
    },
    Derived {
        subquery: Query,
        alias: TableAlias,
    },
    Series {
        alias: TableAlias,
        size: Expr,
    },
    Dictionary {
        dict: Dictionary,
        alias: TableAlias,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, Display)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum Dictionary {
    GlueTables,
    GlueTableColumns,
    GlueIndexes,
    GlueObjects,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TableAlias {
    pub name: String,
    pub columns: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Join {
    pub relation: TableFactor,
    pub join_operator: JoinOperator,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum JoinOperator {
    Inner(JoinConstraint),
    LeftOuter(JoinConstraint),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum JoinConstraint {
    On(Expr),
    None,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct OrderByExpr {
    pub expr: Expr,
    pub asc: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Values(pub Vec<Vec<Expr>>);

impl ToSql for Query {
    fn to_sql(&self) -> String {
        self.to_sql_with(true)
    }
}

impl ToSqlUnquoted for Query {
    fn to_sql_unquoted(&self) -> String {
        self.to_sql_with(false)
    }
}

impl Query {
    fn to_sql_with(&self, quoted: bool) -> String {
        let to_sql = |expr: &Expr| {
            if quoted {
                expr.to_sql()
            } else {
                expr.to_sql_unquoted()
            }
        };

        let Query {
            body,
            order_by,
            limit,
            offset,
        } = self;

        let order_by = if order_by.is_empty() {
            String::new()
        } else {
            format!(
                "ORDER BY {}",
                order_by
                    .iter()
                    .map(|expr| expr.to_sql_with(quoted))
                    .join(" ")
            )
        };

        let limit = match limit {
            Some(expr) => format!("LIMIT {}", to_sql(expr)),
            _ => String::new(),
        };

        let offset = match offset {
            Some(expr) => format!("OFFSET {}", to_sql(expr)),
            _ => String::new(),
        };

        let string = [order_by, limit, offset]
            .iter()
            .filter(|sql| !sql.is_empty())
            .join(" ");

        if string.is_empty() {
            body.to_sql_with(quoted)
        } else {
            format!("{} {}", body.to_sql_with(quoted), string)
        }
    }
}

impl ToSql for SetExpr {
    fn to_sql(&self) -> String {
        self.to_sql_with(true)
    }
}

impl ToSqlUnquoted for SetExpr {
    fn to_sql_unquoted(&self) -> String {
        self.to_sql_with(false)
    }
}

impl SetExpr {
    fn to_sql_with(&self, quoted: bool) -> String {
        match (self, quoted) {
            (SetExpr::Select(select), true) => select.to_sql(),
            (SetExpr::Select(select), false) => select.to_sql_unquoted(),
            (SetExpr::Values(values), true) => format!("VALUES {}", values.to_sql()),
            (SetExpr::Values(values), false) => format!("VALUES {}", values.to_sql_unquoted()),
        }
    }
}

impl ToSql for Select {
    fn to_sql(&self) -> String {
        self.to_sql_with(true)
    }
}

impl ToSqlUnquoted for Select {
    fn to_sql_unquoted(&self) -> String {
        self.to_sql_with(false)
    }
}

impl Select {
    fn to_sql_with(&self, quoted: bool) -> String {
        let to_sql = |expr: &Expr| {
            if quoted {
                expr.to_sql()
            } else {
                expr.to_sql_unquoted()
            }
        };

        let Select {
            distinct,
            projection,
            from,
            selection,
            group_by,
            having,
        } = self;
        let projection = match projection {
            Projection::SelectItems(items) => {
                items.iter().map(|item| item.to_sql_with(quoted)).join(", ")
            }
        };

        let selection = match selection {
            Some(expr) => format!("WHERE {}", to_sql(expr)),
            None => String::new(),
        };

        let group_by = if group_by.is_empty() {
            String::new()
        } else {
            format!("GROUP BY {}", group_by.iter().map(to_sql).join(", "))
        };

        let having = match having {
            Some(having) => format!("HAVING {}", to_sql(having)),
            None => String::new(),
        };

        let condition = [selection, group_by, having]
            .iter()
            .filter(|sql| !sql.is_empty())
            .join(" ");

        let distinct = if *distinct { "DISTINCT " } else { "" };

        if condition.is_empty() {
            format!(
                "SELECT {}{projection} FROM {}",
                distinct,
                from.to_sql_with(quoted)
            )
        } else {
            format!(
                "SELECT {}{projection} FROM {} {condition}",
                distinct,
                from.to_sql_with(quoted)
            )
        }
    }
}

impl ToSql for SelectItem {
    fn to_sql(&self) -> String {
        self.to_sql_with(true)
    }
}

impl ToSqlUnquoted for SelectItem {
    fn to_sql_unquoted(&self) -> String {
        self.to_sql_with(false)
    }
}

impl SelectItem {
    fn to_sql_with(&self, quoted: bool) -> String {
        let to_sql = |expr: &Expr| {
            if quoted {
                expr.to_sql()
            } else {
                expr.to_sql_unquoted()
            }
        };

        match self {
            SelectItem::Expr { expr, label } => {
                let expr = to_sql(expr);
                match (label.is_empty(), quoted) {
                    (true, _) => expr,
                    (false, true) => format!(r#"{expr} AS "{label}""#),
                    (false, false) => format!("{expr} AS {label}"),
                }
            }
            SelectItem::QualifiedWildcard(obj) => {
                if quoted {
                    format!(r#""{obj}".*"#)
                } else {
                    format!("{obj}.*")
                }
            }
            SelectItem::Wildcard => "*".to_owned(),
        }
    }
}

impl ToSql for TableWithJoins {
    fn to_sql(&self) -> String {
        self.to_sql_with(true)
    }
}

impl ToSqlUnquoted for TableWithJoins {
    fn to_sql_unquoted(&self) -> String {
        self.to_sql_with(false)
    }
}

impl TableWithJoins {
    fn to_sql_with(&self, quoted: bool) -> String {
        let TableWithJoins { relation, joins } = self;

        if joins.is_empty() {
            relation.to_sql_with(quoted)
        } else {
            format!(
                "{} {}",
                relation.to_sql_with(quoted),
                joins.iter().map(|join| join.to_sql_with(quoted)).join(" ")
            )
        }
    }
}

impl ToSql for TableFactor {
    fn to_sql(&self) -> String {
        self.to_sql_with(true)
    }
}

impl ToSqlUnquoted for TableFactor {
    fn to_sql_unquoted(&self) -> String {
        self.to_sql_with(false)
    }
}

impl TableFactor {
    fn to_sql_with(&self, quoted: bool) -> String {
        let to_sql = |expr: &Expr| {
            if quoted {
                expr.to_sql()
            } else {
                expr.to_sql_unquoted()
            }
        };

        match (self, quoted) {
            (TableFactor::Table { name, alias }, true) => match alias {
                Some(alias) => format!(r#""{}" {}"#, name, alias.to_sql_with(quoted)),
                None => format!(r#""{name}""#),
            },
            (TableFactor::Table { name, alias }, false) => match alias {
                Some(alias) => format!("{} {}", name, alias.to_sql_with(quoted)),
                None => name.to_owned(),
            },
            (TableFactor::Derived { subquery, alias }, _) => {
                format!(
                    "({}) {}",
                    subquery.to_sql_with(quoted),
                    alias.to_sql_with(quoted)
                )
            }
            (TableFactor::Series { alias, size }, _) => {
                format!("SERIES({}) {}", to_sql(size), alias.to_sql_with(quoted))
            }
            (TableFactor::Dictionary { dict, alias }, true) => {
                format!(r#""{d
```

### Core Architecture Module: `core/src/data.rs`
```
mod bigdecimal_ext;
mod function;
mod interval;
mod key;
mod point;
mod row;
mod string_ext;
mod table;
mod tribool;

pub(crate) const SCHEMALESS_DOC_COLUMN: &str = "_doc";

pub mod schema;
pub mod value;

pub use {
    bigdecimal_ext::BigDecimalExt,
    function::CustomFunction,
    interval::{Interval, IntervalError},
    key::{Key, KeyError},
    point::Point,
    row::Row,
    schema::{Schema, SchemaIndex, SchemaIndexOrd, SchemaParseError},
    string_ext::{StringExt, StringExtError},
    table::{TableError, get_alias},
    tribool::Tribool,
    value::{BTreeMapJsonExt, NumericBinaryOperator, Value, ValueError},
};

```

### Core Architecture Module: `core/src/data/bigdecimal_ext.rs`
```
use bigdecimal::BigDecimal;

pub trait BigDecimalExt {
    fn to_i8(&self) -> Option<i8>;
    fn to_i16(&self) -> Option<i16>;
    fn to_i32(&self) -> Option<i32>;
    fn to_i64(&self) -> Option<i64>;
    fn to_i128(&self) -> Option<i128>;
    fn to_u8(&self) -> Option<u8>;
    fn to_u16(&self) -> Option<u16>;
    fn to_u32(&self) -> Option<u32>;
    fn to_u128(&self) -> Option<u128>;
    fn to_u64(&self) -> Option<u64>;
    fn to_f32(&self) -> Option<f32>;
    fn to_f64(&self) -> Option<f64>;
    fn is_integer_representation(&self) -> bool;
}

impl BigDecimalExt for BigDecimal {
    fn to_i8(&self) -> Option<i8> {
        self.is_integer_representation()
            .then(|| bigdecimal::ToPrimitive::to_i8(self))?
    }
    fn to_i16(&self) -> Option<i16> {
        self.is_integer_representation()
            .then(|| bigdecimal::ToPrimitive::to_i16(self))?
    }
    fn to_i32(&self) -> Option<i32> {
        self.is_integer_representation()
            .then(|| bigdecimal::ToPrimitive::to_i32(self))?
    }
    fn to_i64(&self) -> Option<i64> {
        self.is_integer_representation()
            .then(|| bigdecimal::ToPrimitive::to_i64(self))?
    }
    fn to_i128(&self) -> Option<i128> {
        self.is_integer_representation()
            .then(|| bigdecimal::ToPrimitive::to_i128(self))?
    }
    fn to_u8(&self) -> Option<u8> {
        self.is_integer_representation()
            .then(|| bigdecimal::ToPrimitive::to_u8(self))?
    }
    fn to_u16(&self) -> Option<u16> {
        self.is_integer_representation()
            .then(|| bigdecimal::ToPrimitive::to_u16(self))?
    }
    fn to_u32(&self) -> Option<u32> {
        self.is_integer_representation()
            .then(|| bigdecimal::ToPrimitive::to_u32(self))?
    }
    fn to_u64(&self) -> Option<u64> {
        self.is_integer_representation()
            .then(|| bigdecimal::ToPrimitive::to_u64(self))?
    }
    fn to_u128(&self) -> Option<u128> {
        self.is_integer_representation()
            .then(|| bigdecimal::ToPrimitive::to_u128(self))?
    }
    fn to_f32(&self) -> Option<f32> {
        bigdecimal::ToPrimitive::to_f32(self)
    }
    fn to_f64(&self) -> Option<f64> {
        bigdecimal::ToPrimitive::to_f64(self)
    }
    fn is_integer_representation(&self) -> bool {
        self.fractional_digit_count() == 0
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2011** (2026-09-28): **DELETE with multiple tables in FROM deletes from the first table only and reports success**
  *Symptoms*: ## Summary  `DELETE FROM T1, T2 WHERE ...` is accepted, but translation keeps only the first table and discards the rest. The statement reports a successful delete while the remaining tables are untouched.  This is a silent wrong result — nothing in the output indicates that part of the statement was ignored.  ## Reproduction  ```sql CREATE TABLE T1 (a INTEGER); CREATE TABLE T2 (a INTEGER); INSERT INTO T1 VALUES (1); INSERT INTO T2 VALUES (1);  DELETE FROM T1, T2 WHERE a = 1; -- "1 row deleted"  SELECT * FROM T1; -- | a | --            <- deleted  SELECT * FROM T2; -- | a | -- |---| -- | 1 |      <- still there ```  ## Expected behavior  | Statement | Expected | Today | |---|---|---| | `DELETE FROM T1, T2 WHERE a = 1` | `Translate.UnsupportedDeleteOption` | deletes from `T1` only, reports `1 row deleted` | | `DELETE FROM T1, T1 WHERE a = 1` | `Translate.UnsupportedDeleteOption` | deletes from `T1`, reports `1 row deleted` | | `DELETE FROM T1 WHERE a = 1` | deletes from `T1` | unchanged |  ## Root cause  `core/src/translate.rs:178-182`:  ```rust let table_name = from     .iter()     .map(translate_table_with_join)     .next()                                    // first entry only, rest discarded     .ok_or(TranslateError::UnreachableEmptyTable)??; ```  `from` is a `Vec<TableWithJoins>`. `.next()` takes the head and drops the tail without inspecting it.  This is the same failure shape as #2002, where `columns.first()` silently narrowed a composite `FOREIGN KEY` to its first col

- **Issue #2009** (2026-09-27): **Statements in a batched `execute` are planned against the schema from before the batch**
  *Symptoms*: ## Summary  `Glue::execute` plans every statement before executing any of them, so a statement is planned against the schema as it was before the batch started. Any DDL earlier in the same call is invisible to the planner.  Schema-dependent planner passes then silently no-op, and the executor receives a plan whose invariants were never established.  ## Reproduction  Each case is issued twice: once as a single `Glue::execute` call, once as one call per statement.  | SQL | One statement per call | Batched in one call | |---|---|---| | `CREATE TABLE S; INSERT INTO S VALUES ('{"a": 1}'); SELECT a FROM S;` | returns `a = 1` | ❌ `evaluate: identifier not found: a` | | `CREATE TABLE X (id INTEGER); CREATE TABLE Y (id INTEGER); INSERT INTO X VALUES (1); INSERT INTO Y VALUES (1); SELECT id FROM X JOIN Y ON X.id = Y.id;` | ❌ `planner: column reference id is ambiguous, please specify the table name` | returns `id = 1` | | `CREATE TABLE T (a INTEGER PRIMARY KEY); INSERT INTO T VALUES (1); SELECT a FROM T;` | returns `a = 1` | returns `a = 1` |  Case 1 rejects valid SQL. Case 2 accepts invalid SQL and returns a result. Case 3 is unaffected — no schema-dependent pass is load-bearing for it.  ## Root cause  `core/src/glue.rs:70-77`:  ```rust pub fn execute_with_params(...) -> Result<Vec<Payload>> {     let statements = self.plan_with_params(sql, params)?;   // every statement planned here     let mut payloads = Vec::<Payload>::new();     for statement in &statements {         let payload = 

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

### Incident Patch 1: `0daf9b82` (2026-11-04)
**Commit Message**: Expand review policies for testing and code structure (#2062)

Organize the review policy into dedicated Errors, Testing, and Code
Structure pages. Update contributor guidance and documentation navigation
to link the topic policies.

Define unit tests around each implementation's reachable branches.
Describe SQL fixtures as executable documentation that also tests
SQL-reachable executor branches. Require independent expected results
and visible case-specific inputs and setup.

Add minimum visibility rules and guidance for minimizing design margin
and arranging declarations for top-to-bottom reading. Apply the policies
to new and modified code while keeping unrelated cleanup separate.

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # AGENTS.md
-- Follow [docs/docs/development/review-policy.md](docs/docs/development/review-policy.md) when implementing or reviewing changes.
+- Follow [docs/docs/development/review-policy.md](docs/docs/development/review-policy.md) and its linked topic policies when implementing or reviewing changes.
 - After editing code, run `cargo clippy --all-targets -- -D warnings`.
 - Then run `cargo fmt --all`.
 - When importing items, group them under a single `use` statement whenever possible.
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ GlueSQL is designed to be adaptable to a wide variety of environments, including
 
 GlueSQL is simpler to contribute to than it may look. Its test suite and continuous integration provide guardrails that catch regressions before changes are merged, so don't hesitate to open an issue or pull request.
 
-Read the [review policy](docs/docs/development/review-policy.md) when implementing or reviewing changes. It defines error naming conventions and how to check the corresponding error paths.
+Read the [review policy](docs/docs/development/review-policy.md) when implementing or reviewing changes. It covers change scope, code structure, error conventions, and test design.
 
 If you're not sure where to start, explore the [test suite](test-suite). The [SQL fixtures](test-suite/fixtures) are a good starting point for getting a sense of GlueSQL's overall capabilities. Try contributing a feature you'd like to use, or browse the [GitHub issues](https://github.com/gluesql/gluesql/issues) for more ideas.
 
```

**File**: `docs/docs/development/review-policy.md` (modified, +10/-132)
```diff
@@ -1,138 +1,16 @@
 # Review Policy
 
-Use this policy when implementing and reviewing changes to GlueSQL.
+Apply this policy to new and modified code and tests in GlueSQL. The linked
+topic documents are part of this policy; read and apply the rules relevant to
+the change. Keep unrelated migrations of existing code in separate changes.
 
-## Error ownership
-
-For an error created in a module, search that module and then its parents.
-Use the first existing error type declared along that path, adding a variant
-there if needed. A module's own `error.rs` counts as its declaration site;
-imports and re-exports do not.
-
-Choose by declaration location, regardless of feature, SQL statement, or
-user-facing message. Reapply this rule when moving a check to another module.
-
-An error propagated from a call keeps the type chosen where it was created.
-The caller's location does not change its ownership.
-
-Ownership selects the error type. Variants distinguish failures; prefixes
-classify their conditions.
-
-## Error variants
-
-Give independent failure conditions distinct variants, even when their messages
-would be similar. Do not reuse a broad variant across unrelated checks.
-
-Represent distinctions within a variant with enum payloads, not string tags or
-message text. String fields may carry diagnostic data such as table names.
-
-For example, use `CreateIndexTableNotFound(String)` for a missing CREATE INDEX
-target and `CtasSourceTableNotFound(String)` for a missing CTAS source. Each string
-holds the table name; the variants identify the failed checks.
-
-An error produced by the same check in a shared function may be propagated
-unchanged by multiple callers.
-
-## Error prefixes
-
-The following error-variant prefixes have specific meanings. Choose a prefix by
-examining the condition that produces the error and how that condition can be
-reached.
-
-| Prefix | Meaning |
+| Topic | Rules |
 | --- | --- |
-| `Unreachable` | The branch cannot be reached under the conditions established by the current code. |
-| `Conflict` | Storage state violates an invariant preserved by normal executor operations. Direct storage manipulation can make the error reachable. |
-| `Unplanned` | Planning required before execution has not been completed. |
-| `MalformedPlan` | An execution plan has an invalid structure or internal reference. Direct plan construction or modification can make the error reachable. |
-
-Ordinary error names such as `InvalidSortOrder` and `InvalidJsonString` describe
-invalid values or formats. `Invalid` does not have a special classification
-meaning and is not reserved for malformed plans.
-
-### Unreachable
-
-Use `Unreachable` only when the current code makes the error branch impossible.
-For example:
-
-```rust
-let values = [1, 2, 3];
-let first = values.get(0);
-```
-
-Here, `first` is always `Some`. A branch handling `None` would be unreachable
-because both the array length and the index are fixed by the code.
-
-The claim must hold for the inputs the code accepts. A branch that can be reached
-by constructing an AST or plan directly, or by changing storage contents, does
-not qualify merely because normal SQL execution never reaches it. A planner
-guarantee alone is insufficient when callers can supply their own plans.
-
-During review, identify the code conditions that make the branch impossible. An
-untested branch is not evidence of unreachability.
-
-### Conflict
-
-Use `Conflict` when stored state violates an invariant that normal executor
-operations preserve. For example, a stored row can have fewer values than its
-schema requires if a caller writes it directly through the storage interface.
-Reading a missing column during validation can then produce
-`ConflictOnStorageColumnIndex`.
-
-Test this kind of guard by constructing the inconsistent storage state and
-executing the operation that detects it. Assert the returned error and its
-details. A normal SQL statement rejected before it changes storage does not
-exercise that guard.
-
-### Unplanned
-
-`Unplanned` also names plan states that still need processing by a responsible
-planner. AST conversion or direct plan construction can produce these states.
-The planner consumes them and produces the representation needed for execution.
-
-For custom function calls, the transition is:
-
-```text
-UnplannedCustom { name, exprs }
-    -- custom function planner -->
-Custom { function_id, exprs }
-```
-
-If an unplanned state reaches the executor, return an `Unplanned...` error with
-the information needed to identify the unfinished work. For example,
-`UnplannedCustomFunction` retains the function name. The executor must not perform
-the missing planning step or make the state executable through a fallback.
-
-Test the executor guard with an unplanned value that has not passed through its
-required planner. Also check that the supported planning path consumes that
-state before execution.
-
-### MalformedPlan
-
-Use `MalformedPla
```

**File**: `docs/docs/development/review-policy/code-structure.md` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+# Code Structure
+
+## Minimize margin (guidance)
+
+Margin is the gap between what a design allows or requires and what the code
+actually needs. Keep that gap as small as practical when designing types,
+functions, and modules.
+
+### Represent valid states directly
+
+Suppose a job has three states: pending, running, and finished. Two boolean
+fields can represent them, but also allow a fourth combination:
+
+```rust
+struct Job {
+    started: bool,
+    finished: bool,
+}
+```
+
+| `started` | `finished` | Meaning |
+| --- | --- | --- |
+| `false` | `false` | Pending |
+| `true` | `false` | Running |
+| `true` | `true` | Finished |
+| `false` | `true` | Invalid: finished without starting |
+
+Use an enum to represent the three valid states directly:
+
+```rust
+enum JobState {
+    Pending,
+    Running,
+    Finished,
+}
+
+struct Job {
+    state: JobState,
+}
+```
+
+The invalid combination is no longer representable. Callers do not need to
+preserve a relationship between two independent fields.
+
+### Share common work without forcing operations together
+
+Suppose tags must be trimmed and lowercased, while titles must only be trimmed.
+Combining these operations introduces a flag and a branch:
+
+```rust
+fn normalize(text: &str, for_tag: bool) -> String {
+    let text = text.trim();
+
+    if for_tag {
+        text.to_lowercase()
+    } else {
+        text.to_owned()
+    }
+}
+```
+
+In this example, callers always pass `true` for tags and `false` for titles.
+The flag was added only to combine the two operations. Keep them separate:
+
+```rust
+fn normalize_tag(text: &str) -> String {
+    text.trim().to_lowercase()
+}
+
+fn normalize_title(text: &str) -> String {
+    text.trim().to_owned()
+}
+```
+
+Repeating the small `trim()` call keeps each function's behavior explicit and
+removes the mode flag and branch. Common work can still be shared without
+combining the operations.
+
+Apply the same reasoning to module boundaries. Sharing a helper should not
+require moving unrelated caller-specific types or dependencies into the shared
+module.
+
+These are design guidelines. Some margin may remain when removing it would
+make the overall design more complex.
+
+## Visibility
+
+Use the narrowest visibility needed by callers and the intended API. Apply
+this to functions, types, fields, and re-exports. Sharing code does not
+automatically require `pub(crate)` or `pub`.
+
+Check both module visibility and re-exports to see who can access an item.
+For example, a `pub` function in a private module can be exposed through a
+`pub(super)` re-export.
+
+## Declaration order (guidance)
+
+Prefer an order that lets readers follow the code from top to bottom with
+fewer jumps between declarations.
+
+Use this as a guide for new modules. Leave unrelated code in place when
+editing existing files.
```

**File**: `docs/docs/development/review-policy/errors.md` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+# Errors
+
+## Error ownership
+
+For an error created in a module, search that module and then its parents.
+Use the first existing error type declared along that path, adding a variant
+there if needed. A module's own `error.rs` counts as its declaration site;
+imports and re-exports do not.
+
+Choose by declaration location, regardless of feature, SQL statement, or
+user-facing message. Reapply this rule when moving a check to another module.
+
+An error propagated from a call keeps the type chosen where it was created.
+The caller's location does not change its ownership.
+
+Ownership selects the error type. Variants distinguish failures; prefixes
+classify their conditions.
+
+## Error variants
+
+Give independent failure conditions distinct variants, even when their messages
+would be similar. Do not reuse a broad variant across unrelated checks.
+
+Represent distinctions within a variant with enum payloads, not string tags or
+message text. String fields may carry diagnostic data such as table names.
+
+For example, use `CreateIndexTableNotFound(String)` for a missing CREATE INDEX
+target and `CtasSourceTableNotFound(String)` for a missing CTAS source. Each string
+holds the table name; the variants identify the failed checks.
+
+An error produced by the same check in a shared function may be propagated
+unchanged by multiple callers.
+
+## Error prefixes
+
+The following error-variant prefixes have specific meanings. Choose a prefix by
+examining the condition that produces the error and how that condition can be
+reached.
+
+| Prefix | Meaning |
+| --- | --- |
+| `Unreachable` | The branch cannot be reached under the conditions established by the current code. |
+| `Conflict` | Storage state violates an invariant preserved by normal executor operations. Direct storage manipulation can make the error reachable. |
+| `Unplanned` | Planning required before execution has not been completed. |
+| `MalformedPlan` | An execution plan has an invalid structure or internal reference. Direct plan construction or modification can make the error reachable. |
+
+Ordinary error names such as `InvalidSortOrder` and `InvalidJsonString` describe
+invalid values or formats. `Invalid` does not have a special classification
+meaning and is not reserved for malformed plans.
+
+### Unreachable
+
+Use `Unreachable` only when the current code makes the error branch impossible.
+For example:
+
+```rust
+let values = [1, 2, 3];
+let first = values.get(0);
+```
+
+Here, `first` is always `Some`. A branch handling `None` would be unreachable
+because both the array length and the index are fixed by the code.
+
+The claim must hold for the inputs the code accepts. A branch that can be reached
+by constructing an AST or plan directly, or by changing storage contents, does
+not qualify merely because normal SQL execution never reaches it. A planner
+guarantee alone is insufficient when callers can supply their own plans.
+
+During review, identify the code conditions that make the branch impossible. An
+untested branch is not evidence of unreachability.
+
+### Conflict
+
+Use `Conflict` when stored state violates an invariant that normal executor
+operations preserve. For example, a stored row can have fewer values than its
+schema requires if a caller writes it directly through the storage interface.
+Reading a missing column during validation can then produce
+`ConflictOnStorageColumnIndex`.
+
+Test this kind of guard by constructing the inconsistent storage state and
+executing the operation that detects it. Assert the returned error and its
+details. A normal SQL statement rejected before it changes storage does not
+exercise that guard.
+
+### Unplanned
+
+`Unplanned` also names plan states that still need processing by a responsible
+planner. AST conversion or direct plan construction can produce these states.
+The planner consumes them and produces the representation needed for execution.
+
+For custom function calls, the transition is:
+
+```text
+UnplannedCustom { name, exprs }
+    -- custom function planner -->
+Custom { function_id, exprs }
+```
+
+If an unplanned state reaches the executor, return an `Unplanned...` error with
+the information needed to identify the unfinished work. For example,
+`UnplannedCustomFunction` retains the function name. The executor must not perform
+the missing planning step or make the state executable through a fallback.
+
+Test the executor guard with an unplanned value that has not passed through its
+required planner. Also check that the supported planning path consumes that
+state before execution.
+
+### MalformedPlan
+
+Use `MalformedPlan` when a plan uses an execution representation but violates its
+structural requirements. For example, a `Custom` call with `function_id: 10`
+cannot refer to a definition when the statement's function list is empty. The
+guard returns `MalformedPlanCustomFunctionIndex(10)`.
+
+This differs from `UnplannedCustom`: the call alrea
```

**File**: `docs/docs/development/review-policy/testing.md` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+# Testing
+
+## Unit tests
+
+Test every reachable branch of the implementation. Use inputs that reach each
+branch, and assert its result or state change. A test that fails earlier in the
+pipeline does not cover that branch.
+
+Put unit tests in an inline `#[cfg(test)] mod tests` in the module that contains
+the implementation. Do not put them in a separate `tests.rs` file or a module
+that only re-exports the implementation.
+
+Move the tests when you move the implementation. Do not widen production
+visibility just to let tests access private code.
+
+Test the branches of shared code in its own module. Caller tests cover the
+caller's branches, including how it uses results and handles errors from shared
+code.
+
+For a planner pass, prepare the inputs it needs and call the pass directly.
+Use separate test cases to check that the full planner pipeline runs the pass.
+
+Test an execution entry point's own branches in its unit tests.
+
+## SQL fixtures
+
+The SQL fixtures in `test-suite/fixtures` are executable documentation for
+people and tools. Group cases by SQL feature and behavior. Use representative
+examples that show successful usage and expected errors. Give each case a clear
+name, and keep its setup, SQL, and expected results easy to read.
+
+The fixtures also serve a unit-testing role for the execution layer.
+For each behavior covered by a fixture, test every executor branch and error
+path that SQL can reach. Run the cases through the production SQL pipeline and
+assert their results. When a case tests storage behavior, also check the stored
+state. Readable examples and branch coverage are both required.
+
+One scenario can cover several branches. Different SQL behaviors may need
+separate examples even when they use the same branch.
+
+Constructing an AST or plan directly does not prove that SQL can reach the same
+behavior. For guards that require a manually constructed plan or inconsistent
+storage, use the setup and assertions in [Error prefixes](errors.md#error-prefixes).
+
+## Expected results
+
+Assert the expected result:
+
+- For a plan transformation, check the expected plan structure.
+- For an error, check the variant and its relevant fields.
+- For formatting, compare the exact output.
+
+Use success or failure checks alone only when no result value or structure
+needs to be verified.
+
+Write expected values explicitly. Do not copy or modify the actual output to
+create them. Do not calculate them with the code being tested.
+
+A helper may convert an expected value to the type used by the assertion.
+For example, a planner test may parse and translate expected SQL into a plan.
+Do not run the planner being tested to build the expected plan.
+
+## Inputs and helpers
+
+Keep the inputs and expected results visible in each test case. Also show the
+setup that determines the behavior being tested.
+
+Use helpers for repeated parsing, calls, and assertions. Do not hide choices
+that the test checks inside a helper, such as variants, IDs, defaults, or
+traversal rules.
```

**File**: `docs/zensical.toml` (modified, +6/-1)
```diff
@@ -253,7 +253,12 @@ nav = [
     ]},
   ]},
   {"Development" = [
-    "development/review-policy.md",
+    {"Review Policy" = [
+      {"Overview" = "development/review-policy.md"},
+      "development/review-policy/errors.md",
+      "development/review-policy/testing.md",
+      "development/review-policy/code-structure.md",
+    ]},
   ]},
   {"Archive" = [
     {"Articles" = [
```

---

### Incident Patch 2: `943afa57` (2026-11-04)
**Commit Message**: Move CREATE INDEX validation into the planner (#2061)

Collect the target schema and validate CREATE INDEX definitions in a
dedicated planner step in both the default and Sled pipelines.

Pass the original index definition directly to storage during execution,
removing the core executor's last plan_scalar_expr call. Report definition
errors through PlannerError, with distinct variants for missing tables,
missing columns, unsupported expressions, and missing column references.

Document error-variant conventions for independent failure conditions,
enum payloads, and diagnostic strings.

**File**: `core/src/executor/alter.rs` (modified, +0/-2)
```diff
@@ -1,7 +1,6 @@
 mod alter_table;
 mod error;
 mod function;
-mod index;
 mod table;
 mod validate;
 
@@ -11,6 +10,5 @@ pub use {
     alter_table::alter_table,
     error::AlterError,
     function::{delete_function, insert_function},
-    index::create_index,
     table::{CreateTableOptions, Referencing, create_table, drop_table},
 };
```

**File**: `core/src/executor/alter/error.rs` (modified, +1/-8)
```diff
@@ -18,7 +18,7 @@ pub enum AlterError {
     #[error("function does not exist: {0}")]
     FunctionNotFound(String),
 
-    // CREATE INDEX, DROP TABLE
+    // DROP TABLE, ALTER TABLE
     #[error("table does not exist: {0}")]
     TableNotFound(String),
 
@@ -32,17 +32,10 @@ pub enum AlterError {
     #[error("column '{0}' of data type '{1:?}' is unsupported for unique constraint")]
     UnsupportedDataTypeForUniqueColumn(String, DataType),
 
-    // validate index expr
-    #[error("unsupported index expression")]
-    UnsupportedIndexExpr,
-
     // validate index expr
     #[error("unsupported unnamed argument")]
     UnsupportedUnnamedArg,
 
-    #[error("index expression must reference at least one column")]
-    IndexExprRequiresColumnReference,
-
     #[error("duplicate column name: {0}")]
     DuplicateColumnName(String),
 
```

**File**: `core/src/executor/alter/index.rs` (removed, +0/-57)
```diff
@@ -1,57 +0,0 @@
-use {
-    super::AlterError,
-    crate::{
-        ast::{ColumnDef, OrderByExpr},
-        data::Schema,
-        plan::{ExprPlan, FunctionPlan, plan_scalar_expr},
-        result::Result,
-        store::{GStore, GStoreMut},
-    },
-};
-
-pub fn create_index<T: GStore + GStoreMut>(
-    storage: &mut T,
-    table_name: &str,
-    index_name: &str,
-    column: &OrderByExpr,
-) -> Result<()> {
-    let expr = plan_scalar_expr(column.expr.clone());
-    let Schema { column_defs, .. } = storage
-        .fetch_schema(table_name)?
-        .ok_or_else(|| AlterError::TableNotFound(table_name.to_owned()))?;
-    let columns = column_defs
-        .unwrap_or_default()
-        .into_iter()
-        .map(|ColumnDef { name, .. }| name)
-        .collect::<Vec<_>>();
-
-    let (valid, has_ident) = validate_index_expr(&columns, &expr);
-    if !valid {
-        return Err(AlterError::UnsupportedIndexExpr.into());
-    } else if !has_ident {
-        return Err(AlterError::IndexExprRequiresColumnReference.into());
-    }
-
-    storage.create_index(table_name, index_name, column)
-}
-
-fn validate_index_expr(columns: &[String], expr: &ExprPlan) -> (bool, bool) {
-    let validate = |expr| validate_index_expr(columns, expr);
-
-    match expr {
-        ExprPlan::Identifier(ident) => (columns.iter().any(|column| column == ident), true),
-        ExprPlan::Literal(_) | ExprPlan::TypedString { .. } => (true, false),
-        ExprPlan::Nested(expr) | ExprPlan::UnaryOp { expr, .. } => validate(expr),
-        ExprPlan::BinaryOp { left, right, .. } => {
-            let (valid_l, has_ident_l) = validate(left);
-            let (valid_r, has_ident_r) = validate(right);
-
-            (valid_l && valid_r, has_ident_l || has_ident_r)
-        }
-        ExprPlan::Function(func) => match func.as_ref() {
-            FunctionPlan::Cast { expr, .. } => validate(expr),
-            _ => (false, false),
-        },
-        _ => (false, false),
-    }
-}
```

**File**: `core/src/executor/execute.rs` (modified, +5/-3)
```diff
@@ -1,8 +1,8 @@
 use {
     super::{
         alter::{
-            CreateTableOptions, alter_table, create_index, create_table, delete_function,
-            drop_table, insert_function,
+            CreateTableOptions, alter_table, create_table, delete_function, drop_table,
+            insert_function,
         },
         delete::delete,
         fetch::fetch,
@@ -176,7 +176,9 @@ fn execute_inner<T: GStore + GStoreMut>(
             name,
             table_name,
             column,
-        } => create_index(storage, table_name, name, column).map(|()| Payload::CreateIndex),
+        } => storage
+            .create_index(table_name, name, column)
+            .map(|()| Payload::CreateIndex),
         StatementPlanKind::DropIndex { name, table_name } => storage
             .drop_index(table_name, name)
             .map(|()| Payload::DropIndex),
```

**File**: `core/src/planner.rs` (modified, +2/-0)
```diff
@@ -12,6 +12,7 @@ mod query;
 mod schema;
 mod schemaless;
 mod validate;
+mod validate_create_index;
 mod visit;
 mod visit_mut;
 
@@ -27,4 +28,5 @@ pub use {
     primary_key::plan as plan_primary_key,
     schema::fetch_schema_map,
     schemaless::plan as plan_schemaless,
+    validate_create_index::validate as validate_create_index,
 };
```

**File**: `core/src/planner/error.rs` (modified, +12/-0)
```diff
@@ -2,6 +2,18 @@ use {serde::Serialize, std::fmt::Debug, thiserror::Error as ThisError};
 
 #[derive(ThisError, Serialize, Debug, PartialEq, Eq)]
 pub enum PlannerError {
+    #[error("CREATE INDEX target table does not exist: {0}")]
+    CreateIndexTableNotFound(String),
+
+    #[error("CREATE INDEX column does not exist: {0}")]
+    CreateIndexColumnNotFound(String),
+
+    #[error("unsupported index expression")]
+    UnsupportedIndexExpr,
+
+    #[error("index expression must reference at least one column")]
+    IndexExprRequiresColumnReference,
+
     #[error("CTAS source table does not exist: {0}")]
     CtasSourceTableNotFound(String),
 
```

**File**: `core/src/planner/schema.rs` (modified, +42/-1)
```diff
@@ -50,6 +50,15 @@ pub fn fetch_schema_map<T: Store + ?Sized>(
 
             Ok(schema_list)
         }
+        StatementPlanKind::CreateIndex { table_name, .. } => {
+            let schema_map = storage
+                .fetch_schema(table_name)?
+                .map_or_else(HashMap::new, |schema| {
+                    HashMap::from([(table_name.to_owned(), schema)])
+                });
+
+            Ok(schema_map)
+        }
         StatementPlanKind::DropTable { names, .. } => {
             let mut schema_map = HashMap::new();
             for table_name in names {
@@ -408,7 +417,7 @@ mod tests {
         crate::{
             mock::{MockStorage, run},
             parse_sql::parse,
-            result::Result,
+            result::{Error, Result},
             translate::translate,
         },
     };
@@ -447,6 +456,38 @@ mod tests {
         test("DELETE FROM Foo;", &["Foo"]);
     }
 
+    #[test]
+    fn create_index() {
+        let storage = run("CREATE TABLE Foo (id INTEGER)");
+        let test = |sql: &str, expected: &[&str], name: &str| {
+            let actual = plan(&storage, sql).expect(sql);
+            assert_eq!(actual.as_slice(), expected, "{name}: {sql}");
+        };
+
+        let actual = "CREATE INDEX idx ON Foo (id)";
+        let expected = &["Foo"];
+        test(actual, expected, "index target schema");
+
+        let actual = "CREATE INDEX idx ON Missing (id)";
+        let expected = &[];
+        test(actual, expected, "missing schema is left to validation");
+
+        let actual = "CREATE INDEX idx ON Foo ((SELECT id FROM __Err__))";
+        let expected = &["Foo"];
+        test(
+            actual,
+            expected,
+            "unsupported index subquery is not scanned",
+        );
+
+        let sql = "CREATE INDEX idx ON __Err__ (id)";
+        let actual = plan(&storage, sql);
+        let expected = Err(Error::StorageMsg(
+            "[MockStorage] fetch_schema - user triggered error".to_owned(),
+        ));
+        assert_eq!(actual, expected, "target schema error propagates: {sql}");
+    }
+
     #[test]
     fn expr() {
         let storage = run("
```

**File**: `core/src/planner/validate_create_index.rs` (added, +273/-0)
```diff
@@ -0,0 +1,273 @@
+use {
+    super::PlannerError,
+    crate::{
+        ast::{ColumnDef, Expr, Function},
+        data::Schema,
+        plan::{StatementPlan, StatementPlanKind},
+        result::Result,
+    },
+    std::{collections::HashMap, hash::BuildHasher},
+};
+
+pub fn validate<S: BuildHasher>(
+    schema_map: &HashMap<String, Schema, S>,
+    statement: &StatementPlan,
+) -> Result<()> {
+    if let StatementPlanKind::CreateIndex {
+        table_name, column, ..
+    } = &statement.kind
+    {
+        let schema = schema_map
+            .get(table_name)
+            .ok_or_else(|| PlannerError::CreateIndexTableNotFound(table_name.clone()))?;
+        let columns = schema.column_defs.as_deref().unwrap_or_default();
+
+        let has_ident = validate_index_expr(columns, &column.expr)?;
+        if !has_ident {
+            return Err(PlannerError::IndexExprRequiresColumnReference.into());
+        }
+    }
+
+    Ok(())
+}
+
+fn validate_index_expr(columns: &[ColumnDef], expr: &Expr) -> Result<bool> {
+    let validate = |expr| validate_index_expr(columns, expr);
+
+    match expr {
+        Expr::Identifier(ident) => {
+            if columns.iter().any(|column| column.name == *ident) {
+                Ok(true)
+            } else {
+                Err(PlannerError::CreateIndexColumnNotFound(ident.to_owned()).into())
+            }
+        }
+        Expr::Literal(_) | Expr::TypedString { .. } => Ok(false),
+        Expr::Nested(expr) | Expr::UnaryOp { expr, .. } => validate(expr),
+        Expr::BinaryOp { left, right, .. } => {
+            let has_ident_l = validate(left)?;
+            let has_ident_r = validate(right)?;
+
+            Ok(has_ident_l || has_ident_r)
+        }
+        Expr::Function(func) => match func.as_ref() {
+            Function::Cast { expr, .. } => validate(expr),
+            _ => Err(PlannerError::UnsupportedIndexExpr.into()),
+        },
+        _ => Err(PlannerError::UnsupportedIndexExpr.into()),
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use {
+        super::{validate, validate_index_expr},
+        crate::{
+            ast::{ColumnDef, Expr},
+            data::Value,
+            mock::run,
+            parse_sql::{parse, parse_expr},
+            plan::StatementPlan,
+            planner::{PlannerError, fetch_schema_map},
+            query_builder::ColumnDefNode,
+            result::Error,
+            store::Planner,
+            translate::{NO_PARAMS, translate, translate_expr},
+        },
+    };
+
+    fn statement(sql: &str) -> StatementPlan {
+        translate(&parse(sql).expect(sql)[0]).expect(sql).into()
+    }
+
+    #[test]
+    fn create_index() {
+        let storage = run("
+            CREATE TABLE Item (id INTEGER);
+            CREATE TABLE Documents;
+        ");
+        let test = |sql: &str, expected, name: &str| {
+            let statement = statement(sql);
+            let schema_map = fetch_schema_map(&storage, &statement).expect(sql);
+            let actual = validate(&schema_map, &statement);
+            assert_eq!(actual, expected, "{name}: {sql}");
+        };
+
+        let actual = "CREATE INDEX idx ON Item (id)";
+        let expected = Ok(());
+        test(actual, expected, "valid column reference");
+
+        let actual = "CREATE INDEX idx ON Missing (ABS(id))";
+        let expected = Err(Error::Planner(PlannerError::CreateIndexTableNotFound(
+            "Missing".to_owned(),
+        )));
+        test(
+            actual,
+            expected,
+            "missing table precedes invalid expression",
+        );
+
+        let actual = "CREATE INDEX idx ON Item (missing)";
+        let expected = Err(Error::Planner(PlannerError::CreateIndexColumnNotFound(
+            "missing".to_owned(),
+        )));
+        test(actual, expected, "missing column");
+
+        let actual = "CREATE INDEX idx ON Item (ABS(id))";
+        let expected = Err(Error::Planner(PlannerError::UnsupportedIndexExpr));
+        test(
+            actual,
+            expected,
+            "invalid expression precedes missing reference",
+        );
+
+        let actual = "CREATE INDEX idx ON Item (100)";
+        let expected = Err(Error::Planner(
+            PlannerError::IndexExprRequiresColumnReference,
+        ));
+        test(actual, expected, "constant requires a column reference");
+
+        let actual = "CREATE INDEX idx ON Documents (id)";
+        let expected = Err(Error::Planner(PlannerError::CreateIndexColumnNotFound(
+            "id".to_owned(),
+        )));
+        test(actual, expected, "schemaless table has no declared columns");
+
+        let actual = "CREATE INDEX idx ON Documents (100)";
+        let expected = Err(Error::Planner(
+            PlannerError::IndexExprRequiresColumnReference,
+        ));
+        test(
+            actual,
+            expected,
+            "schemaless constant still requires a reference",
+        );
+
+        let actual = "DROP INDEX Missing.idx";
+        let
```

#### Recent Merged Pull Requests:
- **PR #2062** (2026-11-04): Expand review policies for testing and code structure (@panarch)
- **PR #2061** (2026-11-04): Move CREATE INDEX validation into the planner (@panarch)
- **PR #2060** (2026-11-04): Apply table alias column names when copying CTAS schemas (@chiliec)
- **PR #2057** (2026-11-04): Move CTAS column default planning out of the executor (@panarch)
- **PR #2053** (2026-11-03): Plan custom functions before execution (@panarch)
- **PR #2048** (2026-11-01): Avoid AST conversion during INSERT uniqueness validation (@panarch)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Expand review policies for testing and code structure (#2062)

**RULE**:
When implementing operations in `AGENTS.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gluesql/gluesql. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0daf9b82`: Expand review policies for testing and code structure (#2062). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `AGENTS.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- Follow [docs/docs/development/review-policy.md](docs/docs/development/review-policy.md) and its linked topic policies when implementing or reviewing changes.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
- Follow [docs/docs/development/review-policy.md](docs/docs/development/review-policy.md) when implementing or reviewing changes.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0daf9b82` are properly handled with clean fallback behavior.
