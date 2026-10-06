# Forensic Learning Record (Deep Inspection): gluesql/gluesql

> **Canonical Artifact**: `07_PROJECT_LEARNING/gluesql-gluesql-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gluesql/gluesql](https://github.com/gluesql/gluesql))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:49:38.861Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gluesql/gluesql`
- **Description**: GlueSQL is quite sticky. It sticks to anything.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3132 stars

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

### Core Architecture Module: `core/src/data/function.rs`
```
use {
    crate::ast::{Expr, OperateFunctionArg},
    serde::{Deserialize, Serialize},
};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct CustomFunction {
    pub func_name: String,
    pub args: Vec<OperateFunctionArg>,
    pub body: Expr,
}

impl CustomFunction {
    pub fn to_str(&self) -> String {
        let name = &self.func_name;
        let args = self
            .args
            .iter()
            .map(|arg| format!("{}: {}", arg.name, arg.data_type))
            .collect::<Vec<String>>()
            .join(", ");
        format!("{name}({args})")
    }
}

```

### Core Architecture Module: `core/src/data/interval.rs`
```
mod error;
mod primitive;
mod string;

pub use error::IntervalError;
use {
    super::Value,
    crate::{ast::DateTimeField, result::Result},
    chrono::{Datelike, Duration, NaiveDate, NaiveDateTime, NaiveTime, Timelike},
    core::str::FromStr,
    rust_decimal::{Decimal, prelude::ToPrimitive},
    serde::{Deserialize, Serialize},
    std::{cmp::Ordering, fmt::Debug},
};

/// Represents a time interval, which can be either in months or microseconds.
///
/// The [`Interval`] type is divided into two variants: [`Interval::Month`] and [`Interval::Microsecond`].
/// This distinction is made because the conversion between months and days is not consistent.
/// While a year can be clearly calculated as 12 months in the solar calendar,
/// a month can vary in the number of days (28, 30, or 31 days).
///
/// To ensure precise calculations and comparisons, intervals are represented in the smallest
/// unambiguous units: `Month` for month-based intervals and `Microsecond` for microsecond-based intervals.
/// Comparisons are only allowed within the same unit type to avoid ambiguity.
///
/// For more details on how comparisons are implemented, refer to the [`Interval::partial_cmp`] trait.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Interval {
    Month(i32),
    Microsecond(i64),
}

impl PartialOrd<Interval> for Interval {
    fn partial_cmp(&self, other: &Interval) -> Option<Ordering> {
        match (self, other) {
            (Interval::Month(l), Interval::Month(r)) => Some(l.cmp(r)),
            (Interval::Microsecond(l), Interval::Microsecond(r)) => Some(l.cmp(r)),
            _ => None,
        }
    }
}

const SECOND: i64 = 1_000_000;
const MINUTE: i64 = 60 * SECOND;
const HOUR: i64 = 3600 * SECOND;
const DAY: i64 = 24 * HOUR;

impl Interval {
    #[must_use]
    pub fn unary_minus(&self) -> Self {
        match self {
            Interval::Month(v) => Interval::Month(-v),
            Interval::Microsecond(v) => Interval::Microsecond(-v),
        }
    }

    pub fn add(&self, other: &Interval) -> Result<Self> {
        use Interval::*;

        match (self, other) {
            (Month(l), Month(r)) => Ok(Month(l + r)),
            (Microsecond(l), Microsecond(r)) => Ok(Microsecond(l + r)),
            _ => Err(IntervalError::AddBetweenYearToMonthAndHourToSecond.into()),
        }
    }

    pub fn subtract(&self, other: &Interval) -> Result<Self> {
        use Interval::*;

        match (self, other) {
            (Month(l), Month(r)) => Ok(Month(l - r)),
            (Microsecond(l), Microsecond(r)) => Ok(Microsecond(l - r)),
            _ => Err(IntervalError::SubtractBetweenYearToMonthAndHourToSecond.into()),
        }
    }

    pub fn add_date(&self, date: &NaiveDate) -> Result<NaiveDateTime> {
        self.add_timestamp(
            &date
                .and_hms_opt(0, 0, 0)
                .ok_or_else(|| IntervalError::FailedToParseTime(date.to_string()))?,
        )
    }

    pub fn subtract_from_date(&self, date: &NaiveDate) -> Result<NaiveDateTime> {
        self.subtract_from_timestamp(
            &date
                .and_hms_opt(0, 0, 0)
                .ok_or_else(|| IntervalError::FailedToParseTime(date.to_string()))?,
        )
    }

    pub fn add_timestamp(&self, timestamp: &NaiveDateTime) -> Result<NaiveDateTime> {
        match self {
            Interval::Month(n) => {
                let month = timestamp.month() as i32 + n;

                let year = timestamp.year() + month / 12;
                let month = month % 12;

                timestamp
                    .with_year(year)
                    .and_then(|d| d.with_month(month as u32))
                    .ok_or_else(|| IntervalError::DateOverflow { year, month }.into())
            }
            Interval::Microsecond(n) => Ok(*timestamp + Duration::microseconds(*n)),
        }
    }

    pub fn subtract_from_timestamp(&self, timestamp: &NaiveDateTime) -> Result<NaiveDateTime> {
        match self {
            Interval::Month(n) => {
                let months = timestamp.year() * 12 + timestamp.month() as i32 - n;

                let year = months / 12;
                let month = months % 12;

                timestamp
                    .with_year(year)
                    .and_then(|d| d.with_month(month as u32))
                    .ok_or_else(|| IntervalError::DateOverflow { year, month }.into())
            }
            Interval::Microsecond(n) => Ok(*timestamp - Duration::microseconds(*n)),
        }
    }

    pub fn add_time(&self, time: &NaiveTime) -> Result<NaiveTime> {
        match self {
            Interval::Month(_) => Err(IntervalError::AddYearOrMonthToTime {
                time: *time,
                interval: *self,
            }
            .into()),
            Interval::Microsecond(n) => Ok(*time + Duration::microseconds(*n)),
        }
    }

    pub fn subtract_from_time(&self, time: &NaiveTime) -> Result<NaiveTime> {
        match self {
            Interval::Month(_) => Err(IntervalError::SubtractYearOrMonthToTime {
                time: *time,
                interval: *self,
            }
            .into()),
            Interval::Microsecond(n) => Ok(*time - Duration::microseconds(*n)),
        }
    }

    pub fn years(years: i32) -> Self {
        Interval::Month(12 * years)
    }

    pub fn months(months: i32) -> Self {
        Interval::Month(months)
    }

    pub fn extract(&self, field: &DateTimeField) -> Result<Value> {
        let value = match (field, *self) {
            (DateTimeField::Year, Interval::Month(i)) => i64::from(i) / 12,
            (DateTimeField::Month, Interval::Month(i)) => i64::from(i),
            (DateTimeField::Day, Interval::Microsecond(i)) => i / DAY,
            (DateTimeField::Hour, Interval::Microsecond(i)) => i / HOUR,
            (DateTimeField::Minute, Interval::Microsecond(i)) => i / MINUTE,
            (DateTimeField::Second, Interval::Microsecond(i)) => i / SECOND,
            _ => {
                return Err(IntervalError::FailedToExtract.into());
            }
        };

        Ok(Value::I64(value))
    }

    pub fn days(days: i32) -> Self {
        Interval::Microsecond(i64::from(days) * DAY)
    }

    pub fn hours(hours: i32) -> Self {
        Interval::Microsecond(i64::from(hours) * HOUR)
    }

    pub fn minutes(minutes: i32) -> Self {
        Interval::Microsecond(i64::from(minutes) * MINUTE)
    }

    pub fn seconds(seconds: i64) -> Self {
        Interval::Microsecond(seconds * SECOND)
    }

    pub fn milliseconds(milliseconds: i64) -> Self {
        Interval::Microsecond(milliseconds * 1_000)
    }

    pub fn microseconds(microseconds: i64) -> Self {
        Interval::Microsecond(microseconds)
    }

    pub fn try_from_str(
        value: &str,
        leading_field: Option<DateTimeField>,
        last_field: Option<DateTimeField>,
    ) -> Result<Self> {
        use DateTimeField::*;

        let value = value.trim_matches('\'');

        let sign = if value.get(0..1) == Some("-") { -1 } else { 1 };

        let parse_integer = |v: &str| {
            v.parse::<i32>()
                .map_err(|_| IntervalError::FailedToParseInteger(value.to_owned()).into())
        };

        let parse_decimal = |duration: i64| {
            let parsed = Decimal::from_str(value)
                .map_err(|_| IntervalError::FailedToParseDecimal(value.to_owned()))?;

            (parsed * Decimal::from(duration))
                .to_i64()
                .ok_or_else(|| IntervalError::FailedToParseDecimal(value.to_owned()).into())
                .map(Interval::Microsecond)
        };

        let parse_time = |v: &str| {
            let sign = if v.get(0..1) == Some("-") { -1 } else { 1 };
            let v = v.trim_start_matches('-');
            let time = NaiveTime::from_str(v)
                .map_err(|_| IntervalError::FailedToParseTime(value.to_owned()))?;

            let msec = i64::from(time.hour()) * HOUR
                + i64::from(time.minute()) * MINUTE
                + i64::from(time.second()) * SECOND
                + i64::from(time.nanosecond()) / 1000;

            Ok(Interval::Microsecond(i64::from(sign) * msec))
        };

        match (leading_field, last_field) {
            (Some(Year), None) => parse_integer(value).map(Interval::years),
            (Some(Month), None) => parse_integer(value).map(Interval::months),
            (Some(Day), None) => parse_decimal(DAY),
            (Some(Hour), None) => parse_decimal(HOUR),
            (Some(Minute), None) => parse_decimal(MINUTE),
            (Some(Second), None) => parse_decimal(SECOND),
            (Some(Year), Some(Month)) => {
                let nums = value
                    .trim_start_matches('-')
                    .split('-')
                    .map(parse_integer)
                    .collect::<Result<Vec<_>>>()?;

                match (nums.first(), nums.get(1)) {
                    (Some(years), Some(months)) => {
                        Ok(Interval::months(sign * (12 * years + months)))
                    }
                    _ => Err(IntervalError::FailedToParseYearToMonth(value.to_owned()).into()),
                }
            }
            (Some(Day), Some(Hour)) => {
                let nums = value
                    .trim_start_matches('-')
                    .split(' ')
                    .map(parse_integer)
                    .collect::<Result<Vec<_>>>()?;

                match (nums.first(), nums.get(1)) {
                    (Some(days), Some(hours)) => Ok(Interval::hours(sign * (24 * days + hours))),
                    _ => Err(IntervalError::FailedToParseDayToHour(value.to_owned()).into()),
                }
            }
            (Some(Day), Some(Minute)) => {
                let nums = value.trim_start_matches('-').split(' ').collect::<Vec<_>>();

                match (nums.first(), nums.get(1)) {
                    (Some(days), Some(time)) => {
                        let days = par
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2011** (2026-09-28): **DELETE with multiple tables in FROM deletes from the first table only and reports success**
  *Symptoms*: ## Summary  `DELETE FROM T1, T2 WHERE ...` is accepted, but translation keeps only the first table and discards the rest. The statement reports a successful delete while the remaining tables are untouched.  This is a silent wrong result — nothing in the output indicates that part of the statement was ignored.  ## Reproduction  ```sql CREATE TABLE T1 (a INTEGER); CREATE TABLE T2 (a INTEGER); INSERT INTO T1 VALUES (1); INSERT INTO T2 VALUES (1);  DELETE FROM T1, T2 WHERE a = 1; -- "1 row deleted"  SELECT * FROM T1; -- | a | --            <- deleted  SELECT * FROM T2; -- | a | -- |---| -- | 1 |      <- still there ```  ## Expected behavior  | Statement | Expected | Today | |---|---|---| | `DELETE FROM T1, T2 WHERE a = 1` | `Translate.UnsupportedDeleteOption` | deletes from `T1` only, reports `1 row deleted` | | `DELETE FROM T1, T1 WHERE a = 1` | `Translate.UnsupportedDeleteOption` | deletes from `T1`, reports `1 row deleted` | | `DELETE FROM T1 WHERE a = 1` | deletes from `T1` | unchanged |  ## Root cause  `core/src/translate.rs:178-182`:  ```rust let table_name = from     .iter()     .map(translate_table_with_join)     .next()                                    // first entry only, rest discarded     .ok_or(TranslateError::UnreachableEmptyTable)??; ```  `from` is a `Vec<TableWithJoins>`. `.next()` takes the head and drops the tail without inspecting it.  This is the same failure shape as #2002, where `columns.first()` silently narrowed a composite `FOREIGN KEY` to its first col

- **Issue #2009** (2026-09-27): **Statements in a batched `execute` are planned against the schema from before the batch**
  *Symptoms*: ## Summary  `Glue::execute` plans every statement before executing any of them, so a statement is planned against the schema as it was before the batch started. Any DDL earlier in the same call is invisible to the planner.  Schema-dependent planner passes then silently no-op, and the executor receives a plan whose invariants were never established.  ## Reproduction  Each case is issued twice: once as a single `Glue::execute` call, once as one call per statement.  | SQL | One statement per call | Batched in one call | |---|---|---| | `CREATE TABLE S; INSERT INTO S VALUES ('{"a": 1}'); SELECT a FROM S;` | returns `a = 1` | ❌ `evaluate: identifier not found: a` | | `CREATE TABLE X (id INTEGER); CREATE TABLE Y (id INTEGER); INSERT INTO X VALUES (1); INSERT INTO Y VALUES (1); SELECT id FROM X JOIN Y ON X.id = Y.id;` | ❌ `planner: column reference id is ambiguous, please specify the table name` | returns `id = 1` | | `CREATE TABLE T (a INTEGER PRIMARY KEY); INSERT INTO T VALUES (1); SELECT a FROM T;` | returns `a = 1` | returns `a = 1` |  Case 1 rejects valid SQL. Case 2 accepts invalid SQL and returns a result. Case 3 is unaffected — no schema-dependent pass is load-bearing for it.  ## Root cause  `core/src/glue.rs:70-77`:  ```rust pub fn execute_with_params(...) -> Result<Vec<Payload>> {     let statements = self.plan_with_params(sql, params)?;   // every statement planned here     let mut payloads = Vec::<Payload>::new();     for statement in &statements {         let payload = 

- **Issue #1942** (2026-07-14): **Qualified primary-key predicate on joined relation is applied to the first FROM relation**
  *Symptoms*: Hello! First of all, thank you for building and maintaining GlueSQL :)  I believe I found a query correctness bug in primary-key planning. If the issue and proposed direction below make sense, would you be open to me submitting a PR to address it?  My plan would be to add regression tests and implement a correctness-first fix that skips PK optimization when a qualified predicate targets a joined relation, preserving the original WHERE condition.  ## Reproduction  Tested with GlueSQL `0.19.0` and `SledStorage`.  ```sql CREATE TABLE projects (     id INTEGER PRIMARY KEY,     name TEXT NOT NULL );  CREATE TABLE tasks (     id INTEGER PRIMARY KEY,     project_id INTEGER,     done BOOLEAN NOT NULL );  INSERT INTO projects VALUES (1, 'P1'); INSERT INTO tasks VALUES     (1, 1, FALSE),     (2, 1, FALSE);  SELECT t.id FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.id = 1   AND t.done = FALSE; ```  Expected:  ```text id 1 2 ```  Actual:  ```text id 1 ```  Reversing the relation order returns both rows.  ## Cause  The PK planner drops the qualifier from `p.id`, finds an `id` primary key in the combined JOIN context, and attaches `PrimaryKey(1)` to the first relation (`tasks`).  The resulting plan incorrectly contains:  ```text Primary Key Lookup [tasks, key=1] ```  As a result, only `tasks.id = 1` is fetched, and the row with `tasks.id = 2` never reaches the JOIN.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. I confirmed the original reproduction on the current `main`, including with `MemoryStorage`, so this is not specific to `SledStorage`.  I also found several related cases caused by the same planner behavior.  ### 1. Different primary-key names  ```sql CREATE TABLE projects (     id INTEGER PRIMARY KEY,     name TEXT NOT NULL );  CREATE TABLE tasks (     task_id INTEGER PRIMARY KEY,     project_id INTEGER,     done BOOLEAN NOT NULL );  INSERT INTO projects VALUES (1, 'P1'); INSERT INTO tasks VALUES     (101, 1, FALSE),     (102, 1, FALSE);  SELECT t.task_id FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.id = 1   AND t.done = FALSE; ```  Expected:  ```text 101 102 ```  Actual:  ```text No rows returned ```  This shows that the problem is not limited to both relations having a primary key named `id`.  The planner recognizes `projects.id = 1` as a primary-key predicate, but then applies the lookup to the first relation as if it were `tasks.task_

- **Issue #1919** (2026-05-30): **Keep primary key access path in index planner**
  *Symptoms*: ## Problem  When a query combines a **primary key equality predicate** with a **secondary index equality predicate** via `AND`, the primary key predicate is silently dropped, returning extra rows:  ```sql CREATE TABLE T (id INTEGER PRIMARY KEY, name TEXT); CREATE INDEX idx_name ON T (name); INSERT INTO T VALUES (1, 'x'), (2, 'x'), (3, 'y');  SELECT id FROM T WHERE id = 1 AND name = 'x'; -- expected: [1] -- actual:   [1, 2]   ← the `id = 1` condition is ignored ```  This affects the **sled** storage (the only storage that runs `plan_index`). It is not a regression — `main` reproduces it as well.  ## Cause  The planner pipeline runs `plan_primary_key` before `plan_index` (`storages/sled-storage/src/planner.rs`):  1. `plan_primary_key` moves `id = 1` out of the selection into a `PrimaryKey` access path, leaving `name = 'x'` as the selection. 2. `plan_index`'s **selection** branch (`core/src/plan/index.rs`) lacked the `index.is_none()` guard that its **order-by** branch already has. It therefore matched the remaining `name = 'x'`, overwrote the `PrimaryKey` access path with the `idx_name` `NonClustered` index, and dropped the leftover selection — losing the `id = 1` predicate entirely.  Two passes were writing to the same `index` slot, and only the first pass guarded against an already-chosen access path.  ## Fix  Add the `index: None` guard to the selection branch so an access path chosen by an earlier pass is preserved, mirroring the existing order-by branch. When an access pat
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro  **Run ID**: `5b5ec26a-9b3b-4f84-b4d1-9ad5a4aa6df1`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between a7d9c3bb4c53075fc26efbe7bb0fe4fd04ddb7ce and befb7cd37867588abc3965e8eecfed0fae26f6e7.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `core/src/plan/index.rs`  </details>  <details> <summary>🚧 Files skipped from review as they are similar to previous changes (1)</summary>  * core/src/plan/index.rs  </details>  </details>  --- <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The index planner now only applies a secondary index when the t
  > ## [Codecov](https://app.codecov.io/gh/gluesql/gluesql/pull/1919?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql) Report :x: Patch coverage is `95.00000%` with `1 line` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 98.18%. Comparing base ([`6058f70`](https://app.codecov.io/gh/gluesql/gluesql/commit/6058f70fb4e2fb14350c231da00d5a8e6c7ae498?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)) to head ([`8981d4e`](https://app.codecov.io/gh/gluesql/gluesql/commit/8981d4e8cf2ce8edc8550ea3c9defad9bf355e83?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)). :warning: Report is 2 commits behind head on main.  | [Files with missing lines](https://app.codecov.io/gh/gluesql/gluesql/pull/1919?dropdown=coverage&src=pr&el=tree&
  > ### GlueSQL Coverage Report  - **Commit:** `8981d4e8cf2ce8edc8550ea3c9defad9bf355e83` - **Timestamp:** `2026-05-30T091042Z` - **Report:** [View report](https://gluesql.org/coverage/?path=pr/1919/2026-05-30T091042Z.8981d4e8cf2ce8edc8550ea3c9defad9bf355e83.lcov.info.xz)

- **Issue #1798** (2025-09-24): **Fix macros dev dependency cycle**
  *Symptoms*: ## Summary - replace the macro crate's dev-dependency on gluesql with gluesql-core + gluesql_memory_storage to remove the publish blocker - add dynamic crate path resolution via proc-macro-crate so the derive works in all consumers - update macro integration and compile-fail tests to use the new imports  ## Testing - cargo clippy --all-targets -- -D warnings - cargo fmt --all - cargo test -p gluesql-macros   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  - New Features   - Derive macros now auto-detect the GlueSQL core path, working seamlessly with either gluesql or gluesql-core setups.   - Improved compatibility with the memory storage backend.   - Clearer compile-time errors when the GlueSQL crate cannot be located.  - Tests   - Expanded compile-time coverage and updated test imports to reflect the new crate layout.  - Chores   - Aligned dev-dependencies with workspace resolution and added a compile-time testing tool.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- walkthrough_start -->  ## Walkthrough The macros crate now dynamically resolves the gluesql crate path during macro expansion, replacing hard-coded paths. Dependencies and dev-dependencies were adjusted to use workspace crates and add trybuild. Tests were updated to import macros from gluesql_macros and core types from gluesql_core, with minor path/type alias adjustments.  ## Changes | Cohort / File(s) | Summary | | --- | --- | | **Build & deps**<br>`macros/Cargo.toml` | Added `proc-macro-crate` dependency; switched dev-deps to `gluesql_core.workspace = true` and `gluesql_memory_storage.workspace = true`; added `trybuild = "1"`. | | **Macro implementation**<br>`macros/src/lib.rs` | Added dynamic crate resolver `resolve_gluesql_crate()` using `proc-macro-crate`; propagated resolved path through codegen; changed impl and references from `::gluesql::core::...` to `#gluesql_crate::...`; updated `match_expected(...)
  > ## [Codecov](https://app.codecov.io/gh/gluesql/gluesql/pull/1798?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql) Report :x: Patch coverage is `70.58824%` with `10 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 97.95%. Comparing base ([`723b064`](https://app.codecov.io/gh/gluesql/gluesql/commit/723b06463e005cb44e8760468b9d3f7d17621410?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)) to head ([`a50a86d`](https://app.codecov.io/gh/gluesql/gluesql/commit/a50a86d45f0f8e9f361b92406a851adf0a53ef85?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)). :warning: Report is 1 commits behind head on main.  | [Files with missing lines](https://app.codecov.io/gh/gluesql/gluesql/pull/1798?dropdown=coverage&src=pr&el=tre
  > ### GlueSQL Coverage Report  - **Commit:** `a50a86d45f0f8e9f361b92406a851adf0a53ef85` - **Timestamp:** `2025-09-24T142726Z` - **Report:** [View report](https://gluesql.org/coverage/?path=pr/1798/2025-09-24T142726Z.a50a86d45f0f8e9f361b92406a851adf0a53ef85.lcov.info.xz)

- **Issue #1773** (2025-09-07): **Fix publish-coverage action - artifact download & PR comment**
  *Symptoms*: Summary - Download coverage artifact by run-id with explicit github-token (v4 requirement across runs) - Extract to path=coverage so file is at ./coverage/lcov.info.xz deterministically - Use PAT (secrets.GLUESQL_ORG) for commenting on PR to avoid GITHUB_TOKEN write limitations in some contexts - Keep workflow_dispatch for manual testing (run_id/pr_number/commit_sha/artifact_name)  Why - Fixes intermittent/consistent failures where artifact existed but actions/download-artifact@v4 could not fetch by name without token - Removes path ambiguity that caused cp to fail - Ensures comment step works reliably regardless of workflow permission settings  Notes - No code changes to Rust; CI-only update - Manual verification done on a dedicated branch; this PR contains the minimal, cleaned changes  <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  * **Chores**   * Improved the code coverage publishing workflow by tightening permissions and adding proper authentication.   * Corrected artifact handling so coverage reports are reliably retrieved and linked in pull requests. <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- walkthrough_start -->  ## Walkthrough Adjusts the publish-coverage GitHub Actions workflow: changes the artifact download path to `coverage/`, supplies `github-token` inputs for the artifact download and PR comment steps, and documents the expected artifact location `./coverage/lcov.info.xz`.  ## Changes | Cohort / File(s) | Summary | | --- | --- | | **GitHub Actions: Publish Coverage**<br>`.github/workflows/publish-coverage.yml` | Removed `issues: write` permission; set download path to `coverage/`; added `github-token: ${{ secrets.GITHUB_TOKEN }}` to the Download coverage artifact step and `github-token: ${{ secrets.GLUESQL_ORG }}` to the PR comment step; added comment noting artifact at `./coverage/lcov.info.xz`. |  ## Sequence Diagram(s) ```mermaid sequenceDiagram   autonumber   actor Dev as Developer (PR)   participant GH as GitHub Actions   participant Art as Artifacts   participant PR as PR Comment Actio
  > ## Pull Request Test Coverage Report for [Build 17528152533](https://coveralls.io/builds/75424209)   ### Details  * **0** of **0**   changed or added relevant lines in **0** files are covered. * No unchanged relevant lines lost coverage. * Overall coverage remained the same at **97.843%**  ---    |  Totals | [![Coverage Status](https://coveralls.io/builds/75424209/badge)](https://coveralls.io/builds/75424209) | | :-- | --: | | Change from base [Build 17526152671](https://coveralls.io/builds/75423486): |  0.0% | | Covered Lines: | 36515 | | Relevant Lines: | 37320 |  --- ##### 💛  - [Coveralls](https://coveralls.io) 
  > ### Coverage Report  - **Commit:** `60fcd41acd65bba746310e7b1b9dda7941beba32` - **Timestamp:** `2025-09-07T120040Z` - **Report:** [View report](https://gluesql.org/coverage/?path=pr/1773/2025-09-07T120040Z.60fcd41acd65bba746310e7b1b9dda7941beba32.lcov.info.xz)

- **Issue #1761** (2025-09-03): **Fix coverage workflow artifact name**
  *Symptoms*: ## Summary - fix coverage workflow branch name sanitization for artifact upload  ## Testing - `cargo clippy --all-targets -- -D warnings` - `cargo fmt --all` - `cargo test -p gluesql-core --lib`   ------ https://chatgpt.com/codex/tasks/task_e_68b7e704f8b4832abf5bf8ab5f0b215d  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Chores**   * Updated coverage workflow to standardize branch-name formatting during CI.   * Switched coverage artifact naming to use the standardized branch name.   * Result: more consistent, predictable artifact names across branches.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- walkthrough_start -->  ## Walkthrough Adds a new “Sanitize branch name” step to the coverage workflow to compute and export SANITIZED_BRANCH_NAME from BRANCH_NAME by replacing '/' with '-'. Updates the coverage artifact name to reference env.SANITIZED_BRANCH_NAME instead of using an inline replace() expression.  ## Changes | Cohort / File(s) | Summary | |---|---| | **Coverage workflow updates**<br>`.github/workflows/coverage.yml` | Introduces a step that writes SANITIZED_BRANCH_NAME to GITHUB_ENV; replaces inline replace(env.BRANCH_NAME, '/', '-') in artifact naming with env.SANITIZED_BRANCH_NAME. |  ## Sequence Diagram(s) ```mermaid sequenceDiagram     participant Dev as Developer     participant GH as GitHub Actions     participant WF as Coverage Workflow     participant Steps as Steps      Dev->>GH: Push / PR triggers     GH->>WF: Start workflow     WF->>Steps: Set BRANCH_NAME env     Note over Steps: New st
  > ## [Codecov](https://app.codecov.io/gh/gluesql/gluesql/pull/1761?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 97.85%. Comparing base ([`8ea90be`](https://app.codecov.io/gh/gluesql/gluesql/commit/8ea90be80e08712372a5ce1b2018755bffc49243?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)) to head ([`b0e52b6`](https://app.codecov.io/gh/gluesql/gluesql/commit/b0e52b62d1a4803f56e64de340c0c0f7149be384?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)). :warning: Report is 2 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##             main 

- **Issue #1718** (2025-08-08): **fix(storage-idb): "Arc::try_unwrap failed" on multiple connections**
  *Symptoms*: The `on_upgrade_needed` callback for IndexedDB open requests was holding a reference to an `Arc`, which was not being released when the `IdbStorage` instance was dropped. This caused `Arc::try_unwrap` to fail when a new `IdbStorage` instance was created with the same namespace.  This commit fixes the issue by replacing the `Arc::try_unwrap` logic with a safer approach that locks the mutex and takes the error value. This avoids the panic while still correctly handling errors from the callback.  A test case has been added to reproduce the issue and verify the fix.  Fixes #1717  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Bug Fixes**   * Improved error handling for IndexedDB operations to ensure more reliable error extraction and messaging.  * **Tests**   * Added a new test to verify that multiple storage instances can be created with the same namespace.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- walkthrough_start -->  ## Walkthrough  The error extraction logic in the IndexedDB storage implementation was refactored to avoid using `Arc::try_unwrap` and instead directly lock and access the error via `Mutex`. Additionally, a new asynchronous test was added to verify that multiple storage instances with the same namespace can be created sequentially.  ## Changes  | Cohort / File(s)                                            | Change Summary                                                                                   | |-------------------------------------------------------------|--------------------------------------------------------------------------------------------------| | **Error Handling Refactor**<br> `storages/idb-storage/src/lib.rs`      | Refactored error extraction after awaiting IndexedDB open request: replaced `Arc::try_unwrap` with direct `Mutex` locking and `take()`, updated error mes
  > ## [Codecov](https://app.codecov.io/gh/gluesql/gluesql/pull/1718?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 97.94%. Comparing base ([`df18e72`](https://app.codecov.io/gh/gluesql/gluesql/commit/df18e7224e4ffac8d3453ef071990d46d964b943?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)) to head ([`d885dbb`](https://app.codecov.io/gh/gluesql/gluesql/commit/d885dbb10d5f140d76d777957da2e0b6026affed?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=gluesql)). :warning: Report is 1 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##             main 
  > ## Pull Request Test Coverage Report for [Build 16802841146](https://coveralls.io/builds/74990826)   ### Details  * **0** of **0**   changed or added relevant lines in **0** files are covered. * No unchanged relevant lines lost coverage. * Overall coverage remained the same at **97.889%**  ---    |  Totals | [![Coverage Status](https://coveralls.io/builds/74990826/badge)](https://coveralls.io/builds/74990826) | | :-- | --: | | Change from base [Build 16793946915](https://coveralls.io/builds/74984952): |  0.0% | | Covered Lines: | 39748 | | Relevant Lines: | 40605 |  --- ##### 💛  - [Coveralls](https://coveralls.io) 

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

### Incident Patch 1: `42a4b418` (2026-09-30)
**Commit Message**: Update JavaScript getting started guide for OPFS entry points (#2045)

Remove the IndexedDB storage and `loadIndexedDB` examples, which no
longer exist in the gluesql package, and document the `gluesql/opfs`
and `gluesql/opfs/shared` entry points along with their browser
requirements.

Also fix the broken INSERT statements in the existing examples.

**File**: `docs/docs/getting-started/javascript-web.md` (modified, +105/-10)
```diff
@@ -26,6 +26,16 @@ In your `package.json`, it will be added to the dependencies list as follows:
 }
 ```
 
+## Choosing an Entry Point
+
+The `gluesql` package provides three browser entry points. Pick the one that matches where your data should live:
+
+| Entry point | Storage | Persistence |
+| --- | --- | --- |
+| `gluesql` | `memory`, `localStorage`, `sessionStorage` | Memory is lost on reload; Web Storage follows the browser's storage rules |
+| `gluesql/opfs` | OPFS file | Survives reloads and browser restarts, one tab at a time |
+| `gluesql/opfs/shared` | OPFS file, shared across tabs | Survives reloads and browser restarts, safe to open in many tabs when Web Locks and `BroadcastChannel` are available |
+
 ## Usage
 
 GlueSQL can be used in different environments. Here we will look at how to use it with JavaScript modules, Webpack, and Rollup.
@@ -36,20 +46,21 @@ In an HTML file, you can use GlueSQL by importing it with a script tag:
 
 ```html
 <script type="module">
-  import { gluesql } from 'gluesql';
+  import { gluesql } from 'https://cdn.jsdelivr.net/npm/gluesql/gluesql.js';
 
   async function main() {
     const db = await gluesql();
-    await db.loadIndexedDB();
 
     const result = await db.query(`
-      CREATE TABLE Foo (id INTEGER) ENGINE = memory;
-      INSERT INTO Foo (1, 'glue'), (2, 'sql');
+      CREATE TABLE Foo (id INTEGER, name TEXT) ENGINE = memory;
+      INSERT INTO Foo VALUES (1, 'glue'), (2, 'sql');
       SELECT * FROM Foo;
     `);
 
     console.log(result);
-   }
+  }
+
+  main();
 </script>
 ```
 
@@ -62,10 +73,9 @@ import { gluesql } from 'gluesql';
 
 async function run() {
   const db = await gluesql();
-  await db.loadIndexedDB();
 
   const result = await db.query(`
-    CREATE TABLE Foo (id INTEGER) ENGINE = memory;
+    CREATE TABLE Foo (id INTEGER, name TEXT) ENGINE = memory;
     INSERT INTO Foo VALUES (1, 'glue'), (2, 'sql');
     SELECT * FROM Foo;
   `);
@@ -116,17 +126,102 @@ Now, you can use GlueSQL in your Rollup project as you would in any other JavaSc
 
 ## Supported Storage Engines
 
-GlueSQL supports four storage types: In-Memory Storage, Local Storage, Session Storage, and IndexedDB. 
+The main `gluesql` entry point supports three storage types: In-Memory Storage, Local Storage, and Session Storage.
 
 You can specify the storage type when creating a table using the `ENGINE` clause:
 
 - For In-Memory Storage: `ENGINE = memory`
 - For Local Storage: `ENGINE = localStorage`
 - For Session Storage: `ENGINE = sessionStorage`
-- For IndexedDB: `ENGINE = indexedDB`
 
 For example:
 
 ```sql
 CREATE TABLE Foo (id INTEGER) ENGINE = memory;
-```
\ No newline at end of file
+```
+
+Tables stored in different engines can be joined in a single query.
+
+When the `ENGINE` clause is omitted, the default engine is used. The default engine is `memory` initially, and you can change it with `setDefaultEngine`:
+
+```javascript
+db.setDefaultEngine('localStorage');
+```
+
+Web Storage is limited to a few megabytes per origin. For larger or long-lived data, use the OPFS entry point.
+
+## Persistent Storage with OPFS
+
+The `gluesql/opfs` entry point stores the database as a file in the [Origin Private File System (OPFS)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system). Data survives page reloads and browser restarts.
+
+GlueSQL and its storage run inside a Dedicated Worker, which keeps queries off the main thread. The `gluesql()` function returns a proxy whose `query` method sends SQL to the worker and returns a `Promise`.
+
+```javascript
+import { gluesql } from 'gluesql/opfs';
+
+const db = gluesql();
+
+await db.query(`
+  CREATE TABLE IF NOT EXISTS User (id INTEGER, name TEXT);
+  INSERT INTO User VALUES (1, 'glue');
+`);
+
+// The data is still there after a reload.
+const [{ rows }] = await db.query('SELECT * FROM User;');
+```
+
+Unlike the main entry point, `gluesql()` here does not need to be awaited. OPFS is the only storage in this entry point, so the `ENGINE` clause and `setDefaultEngine` do not apply.
+
+Use the `namespace` option to keep separate databases, each stored in its own file. When it is omitted, the `gluesql` namespace is used.
+
+```javascript
+const app1 = gluesql({ namespace: 'app1' });
+const app2 = gluesql({ namespace: 'app2' });
+```
+
+Call `terminate()` to stop the worker. Queries that are still pending are rejected.
+
+```javascript
+db.terminate();
+```
+
+### Worker Location
+
+The entry point loads `gluesql.opfs.worker.js` relative to its own module URL, and the worker loads its WebAssembly from the `dist_opfs/` directory next to it. When the package files are served from your own origin, no extra configuration is needed.
+
+Browsers only allow workers from the same origin, so the OPFS entry points cannot be loaded directly from a third-party CDN. If you serve the worker from a different path, copy `dist_opfs/` next to it and pass its URL:
+
+```javascript
+const db = gluesql({ work
```

---

### Incident Patch 2: `b95f7691` (2026-09-28)
**Commit Message**: Fix repeated IF NOT EXISTS CTAS inserts (#2044)

When the target table already exists, return before executing the CTAS
source query so rerunning the statement does not append duplicate rows.

**File**: `core/src/executor/alter/table.rs` (modified, +4/-0)
```diff
@@ -41,6 +41,10 @@ pub fn create_table<T: GStore + GStoreMut>(
         comment,
     }: CreateTableOptions<'_>,
 ) -> Result<()> {
+    if if_not_exists && source.is_some() && storage.fetch_schema(target_table_name)?.is_some() {
+        return Ok(());
+    }
+
     let mut selected_source_rows = None;
     let target_columns_defs = match source.as_deref() {
         Some(source_query) => match query::output_body(source_query) {
```

**File**: `test-suite/fixtures/alter/create_table.sql` (modified, +21/-0)
```diff
@@ -198,6 +198,27 @@ CREATE TABLE TargetTableWithData AS SELECT * FROM CreateTable2
 -- @expect: error Alter.TableAlreadyExists
 -- @json: "TargetTableWithData"
 
+CREATE TABLE IfNotExistsSource (snack TEXT)
+-- @expect: payload Create
+
+INSERT INTO IfNotExistsSource VALUES ('cookie'), ('chips')
+-- @expect: payload Insert
+-- @json: 2
+
+CREATE TABLE IF NOT EXISTS TargetTableIfNotExists AS SELECT * FROM IfNotExistsSource
+-- @expect: payload Create
+
+-- @name: CTAS IF NOT EXISTS leaves an existing table unchanged
+CREATE TABLE IF NOT EXISTS TargetTableIfNotExists AS SELECT * FROM IfNotExistsSource
+-- @expect: payload Create
+
+SELECT * FROM TargetTableIfNotExists
+-- @expect:
+-- | snack: Str |
+-- | ---------- |
+-- | "cookie"   |
+-- | "chips"    |
+
 CREATE TABLE TargetTableWithData2 AS SELECT * FROM NonExistentTable
 -- @expect: error Alter.CtasSourceTableNotFound
 -- @json: "NonExistentTable"
```

---

### Incident Patch 3: `030ac3f0` (2026-09-27)
**Commit Message**: Remove Clone requirement from ToGlueRow derive (#1981)

* Remove Clone requirement from ToGlueRow derive
* Cover ToGlueRow parameter conversions

**File**: `core/src/query_builder/insert.rs` (modified, +4/-4)
```diff
@@ -164,7 +164,7 @@ mod tests {
         },
         result::Error,
         row_conversion::ToGlueRow,
-        translate::{IntoParamLiteral, ParamLiteral, TranslateError},
+        translate::{IntoParamLiteral, ParamLiteral, ToParamLiteral, TranslateError},
     };
 
     #[test]
@@ -262,9 +262,9 @@ mod tests {
 
         fn to_glue_row(&self) -> Vec<ParamLiteral> {
             vec![
-                self.id.into_param_literal(),
-                self.name.clone().into_param_literal(),
-                self.in_stock.into_param_literal(),
+                self.id.to_param_literal(),
+                self.name.to_param_literal(),
+                self.in_stock.to_param_literal(),
             ]
         }
     }
```

**File**: `core/src/translate.rs` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ pub use self::{
         QueryOption, SelectOption, TransactionOption, TranslateError, UpdateOption,
     },
     expr::{translate_expr, translate_order_by_expr},
-    param::{IntoParamLiteral, ParamLiteral},
+    param::{IntoParamLiteral, ParamLiteral, ToParamLiteral},
     query::{alias_or_name, translate_query, translate_select_item},
 };
 
```

**File**: `core/src/translate/param.rs` (modified, +128/-4)
```diff
@@ -29,25 +29,42 @@ pub trait IntoParamLiteral {
     fn into_param_literal(self) -> ParamLiteral;
 }
 
+pub trait ToParamLiteral {
+    /// Converts a borrowed value into an owned [`ParamLiteral`].
+    fn to_param_literal(&self) -> ParamLiteral;
+}
+
 impl IntoParamLiteral for ParamLiteral {
     fn into_param_literal(self) -> ParamLiteral {
         self
     }
 }
 
-macro_rules! impl_into_param_literal {
+impl ToParamLiteral for ParamLiteral {
+    fn to_param_literal(&self) -> ParamLiteral {
+        self.clone()
+    }
+}
+
+macro_rules! impl_param_literal_copy {
     ($($rust_ty:ty => $value_variant:ident),+ $(,)?) => {
         $(
             impl IntoParamLiteral for $rust_ty {
                 fn into_param_literal(self) -> ParamLiteral {
                     ParamLiteral(Value::$value_variant(self))
                 }
             }
+
+            impl ToParamLiteral for $rust_ty {
+                fn to_param_literal(&self) -> ParamLiteral {
+                    ParamLiteral(Value::$value_variant(*self))
+                }
+            }
         )+
     };
 }
 
-impl_into_param_literal!(
+impl_param_literal_copy!(
     bool => Bool,
     i8 => I8,
     i16 => I16,
@@ -62,8 +79,6 @@ impl_into_param_literal!(
     f32 => F32,
     f64 => F64,
     Decimal => Decimal,
-    String => Str,
-    Vec<u8> => Bytea,
     IpAddr => Inet,
     NaiveDate => Date,
     NaiveTime => Time,
@@ -72,37 +87,91 @@ impl_into_param_literal!(
     Interval => Interval,
 );
 
+impl IntoParamLiteral for String {
+    fn into_param_literal(self) -> ParamLiteral {
+        ParamLiteral(Value::Str(self))
+    }
+}
+
+impl ToParamLiteral for String {
+    fn to_param_literal(&self) -> ParamLiteral {
+        ParamLiteral(Value::Str(self.clone()))
+    }
+}
+
+impl IntoParamLiteral for Vec<u8> {
+    fn into_param_literal(self) -> ParamLiteral {
+        ParamLiteral(Value::Bytea(self))
+    }
+}
+
+impl ToParamLiteral for Vec<u8> {
+    fn to_param_literal(&self) -> ParamLiteral {
+        ParamLiteral(Value::Bytea(self.clone()))
+    }
+}
+
 // Types that need conversion
 impl IntoParamLiteral for isize {
     fn into_param_literal(self) -> ParamLiteral {
         ParamLiteral(Value::I64(self as i64))
     }
 }
 
+impl ToParamLiteral for isize {
+    fn to_param_literal(&self) -> ParamLiteral {
+        ParamLiteral(Value::I64(*self as i64))
+    }
+}
+
 impl IntoParamLiteral for usize {
     fn into_param_literal(self) -> ParamLiteral {
         ParamLiteral(Value::U64(self as u64))
     }
 }
 
+impl ToParamLiteral for usize {
+    fn to_param_literal(&self) -> ParamLiteral {
+        ParamLiteral(Value::U64(*self as u64))
+    }
+}
+
 impl IntoParamLiteral for &str {
     fn into_param_literal(self) -> ParamLiteral {
         ParamLiteral(Value::Str(self.to_owned()))
     }
 }
 
+impl ToParamLiteral for &str {
+    fn to_param_literal(&self) -> ParamLiteral {
+        ParamLiteral(Value::Str((*self).to_owned()))
+    }
+}
+
 impl IntoParamLiteral for &[u8] {
     fn into_param_literal(self) -> ParamLiteral {
         ParamLiteral(Value::Bytea(self.to_vec()))
     }
 }
 
+impl ToParamLiteral for &[u8] {
+    fn to_param_literal(&self) -> ParamLiteral {
+        ParamLiteral(Value::Bytea(self.to_vec()))
+    }
+}
+
 impl IntoParamLiteral for Uuid {
     fn into_param_literal(self) -> ParamLiteral {
         ParamLiteral(Value::Uuid(self.as_u128()))
     }
 }
 
+impl ToParamLiteral for Uuid {
+    fn to_param_literal(&self) -> ParamLiteral {
+        ParamLiteral(Value::Uuid(self.as_u128()))
+    }
+}
+
 impl<T> IntoParamLiteral for Option<T>
 where
     T: IntoParamLiteral,
@@ -115,6 +184,18 @@ where
     }
 }
 
+impl<T> ToParamLiteral for Option<T>
+where
+    T: ToParamLiteral,
+{
+    fn to_param_literal(&self) -> ParamLiteral {
+        match self {
+            Some(value) => value.to_param_literal(),
+            None => ParamLiteral::null(),
+        }
+    }
+}
+
 #[macro_export]
 macro_rules! params {
     ($($expr:expr),* $(,)?) => {
@@ -141,8 +222,10 @@ mod tests {
     fn accepts_param_literal() {
         let literal = ParamLiteral::null();
         let converted = literal.clone().into_param_literal();
+        let borrowed = literal.to_param_literal();
         assert!(matches!(literal.into_expr(), Expr::Value(Value::Null)));
         assert!(matches!(converted.into_expr(), Expr::Value(Value::Null)));
+        assert!(matches!(borrowed.into_expr(), Expr::Value(Value::Null)));
     }
 
     #[test]
@@ -214,6 +297,47 @@ mod tests {
         assert_eq!(expr, Expr::Value(Value::Null));
     }
 
+    #[test]
+    fn converts_borrowed_non_clone_option() {
+        struct NonClone(i64);
+
+        impl ToParamLiteral for NonClone {
+            fn to_param_literal(&self) -> ParamLiteral {
+                self.0.to_param_literal()
+            }
+        }
+
+        let value = Some(NonClone(7));
+        let expr = value.to_param_literal().into_expr();
+
+        assert_eq!(expr, Expr::Value(Value::I64(7)));
+  
```

**File**: `macros/src/to_glue_row.rs` (modified, +25/-6)
```diff
@@ -1,7 +1,7 @@
 use {
     crate::{parse_glue_rename, resolve_gluesql_crate},
     quote::quote,
-    syn::{Data, DeriveInput, Fields, spanned::Spanned},
+    syn::{Data, DeriveInput, Fields, parse_quote, spanned::Spanned},
 };
 
 pub(crate) fn expand_to_glue_row(
@@ -32,11 +32,13 @@ pub(crate) fn expand_to_glue_row(
 
     let mut seen_columns: Vec<String> = Vec::new();
     let mut column_names = Vec::new();
+    let mut field_types = Vec::new();
     let mut field_literals = Vec::new();
 
     for field in &fields {
         let field_ident = field.ident.clone().expect("named field");
         let field_name_literal = field_ident.to_string();
+        field_types.push(field.ty.clone());
 
         let mut rename: Option<String> = None;
         for attr in &field.attrs {
@@ -59,14 +61,23 @@ pub(crate) fn expand_to_glue_row(
         column_names.push(quote! { #column_name });
 
         field_literals.push(quote! {
-            #gluesql_crate::translate::IntoParamLiteral::into_param_literal(
-                ::core::clone::Clone::clone(&self.#field_ident)
+            #gluesql_crate::translate::ToParamLiteral::to_param_literal(
+                &self.#field_ident
             )
         });
     }
 
     let columns_len = column_names.len();
-    let (impl_generics, ty_generics, where_clause) = input.generics.split_for_impl();
+    let mut generics = input.generics;
+    if !field_types.is_empty() {
+        let where_clause = generics.make_where_clause();
+        for field_type in field_types {
+            where_clause.predicates.push(parse_quote! {
+                #field_type: #gluesql_crate::translate::ToParamLiteral
+            });
+        }
+    }
+    let (impl_generics, ty_generics, where_clause) = generics.split_for_impl();
 
     let expanded = quote! {
         impl #impl_generics #gluesql_crate::row_conversion::ToGlueRow for #ident #ty_generics #where_clause {
@@ -154,7 +165,7 @@ mod tests {
         let di: syn::DeriveInput = parse_quote! {
             struct Record<'a, T>
             where
-                T: Clone + crate::translate::IntoParamLiteral,
+                T: 'a,
             {
                 name: &'a str,
                 value: T,
@@ -163,6 +174,14 @@ mod tests {
         let ts = expand_to_glue_row(di).expect("expand ok").to_string();
         assert!(ts.contains("impl < 'a , T >"));
         assert!(ts.contains("ToGlueRow for Record < 'a , T >"));
-        assert!(ts.contains("where T : Clone + crate :: translate :: IntoParamLiteral"));
+        assert!(ts.contains("where T : 'a"));
+        assert!(
+            ts.contains("& 'a str : :: gluesql_core :: translate :: ToParamLiteral"),
+            "{ts}"
+        );
+        assert!(
+            ts.contains("T : :: gluesql_core :: translate :: ToParamLiteral"),
+            "{ts}"
+        );
     }
 }
```

**File**: `macros/tests/compile-fail/to_glue_row_missing_bounds.stderr` (modified, +21/-23)
```diff
@@ -1,23 +1,21 @@
-error[E0277]: the trait bound `T: Clone` is not satisfied
- --> tests/compile-fail/to_glue_row_missing_bounds.rs:8:10
-  |
-8 | #[derive(ToGlueRow)]
-  |          ^^^^^^^^^ the trait `Clone` is not implemented for `T`
-  |
-  = note: this error originates in the derive macro `ToGlueRow` (in Nightly builds, run with -Z macro-backtrace for more info)
-help: consider restricting type parameter `T` with trait `Clone`
-  |
-9 | struct Record<T: std::clone::Clone> {
-  |                +++++++++++++++++++
-
-error[E0277]: the trait bound `T: IntoParamLiteral` is not satisfied
- --> tests/compile-fail/to_glue_row_missing_bounds.rs:8:10
-  |
-8 | #[derive(ToGlueRow)]
-  |          ^^^^^^^^^ the trait `IntoParamLiteral` is not implemented for `T`
-  |
-  = note: this error originates in the derive macro `ToGlueRow` (in Nightly builds, run with -Z macro-backtrace for more info)
-help: consider restricting type parameter `T` with trait `IntoParamLiteral`
-  |
-9 | struct Record<T: gluesql_core::translate::IntoParamLiteral> {
-  |                +++++++++++++++++++++++++++++++++++++++++++
+error[E0599]: the method `to_glue_row` exists for struct `Record<NotConvertible>`, but its trait bounds were not satisfied
+  --> tests/compile-fail/to_glue_row_missing_bounds.rs:17:17
+   |
+ 6 | struct NotConvertible;
+   | --------------------- doesn't satisfy `NotConvertible: ToParamLiteral`
+...
+ 9 | struct Record<T> {
+   | ---------------- method `to_glue_row` not found for this struct because it doesn't satisfy `Record<NotConvertible>: ToGlueRow`
+...
+17 |     let _ = rec.to_glue_row();
+   |                 ^^^^^^^^^^^ method cannot be called on `Record<NotConvertible>` due to unsatisfied trait bounds
+   |
+   = note: trait bound `NotConvertible: ToParamLiteral` was not satisfied
+note: the trait `ToParamLiteral` must be implemented
+  --> $WORKSPACE/core/src/translate/param.rs
+   |
+   | pub trait ToParamLiteral {
+   | ^^^^^^^^^^^^^^^^^^^^^^^^
+   = help: items from traits can only be used if the trait is implemented and in scope
+   = note: the following trait defines an item `to_glue_row`, perhaps you need to implement it:
+           candidate #1: `ToGlueRow`
```

**File**: `macros/tests/runtime_ok_to_glue_row.rs` (modified, +31/-12)
```diff
@@ -1,5 +1,10 @@
 use {
-    gluesql_core::{ast::Expr, data::Value, row_conversion::ToGlueRow, translate::ParamLiteral},
+    gluesql_core::{
+        ast::Expr,
+        data::Value,
+        row_conversion::ToGlueRow,
+        translate::{ParamLiteral, ToParamLiteral},
+    },
     gluesql_macros::{FromGlueRow, ToGlueRow},
 };
 
@@ -12,6 +17,15 @@ struct Item {
     in_stock: Option<bool>,
 }
 
+#[derive(ToGlueRow)]
+struct Empty {}
+
+#[test]
+fn to_glue_row_supports_empty_structs() {
+    assert!(Empty::glue_columns().is_empty());
+    assert!(Empty {}.to_glue_row().is_empty());
+}
+
 #[test]
 fn glue_columns_honors_rename() {
     assert_eq!(
@@ -118,21 +132,29 @@ fn values_from_round_trip_with_memory_storage() {
 }
 
 #[derive(ToGlueRow)]
-struct GenericRecord<'a, T>
-where
-    T: Clone + gluesql_core::translate::IntoParamLiteral,
-{
+struct GenericRecord<'a, T> {
     name: &'a str,
-    value: T,
+    value: Option<T>,
+}
+
+struct NonCloneParam(i64);
+
+impl ToParamLiteral for NonCloneParam {
+    fn to_param_literal(&self) -> ParamLiteral {
+        self.0.to_param_literal()
+    }
 }
 
 #[test]
 fn to_glue_row_supports_generics_and_lifetimes() {
     let rec = GenericRecord {
         name: "test",
-        value: 42_i64,
+        value: Some(NonCloneParam(42)),
     };
-    assert_eq!(GenericRecord::<i64>::glue_columns(), &["name", "value"]);
+    assert_eq!(
+        GenericRecord::<NonCloneParam>::glue_columns(),
+        &["name", "value"]
+    );
     let exprs = rec
         .to_glue_row()
         .into_iter()
@@ -148,10 +170,7 @@ fn to_glue_row_supports_generics_and_lifetimes() {
 }
 
 #[derive(ToGlueRow)]
-struct ConstGenericRecord<T, const N: usize>
-where
-    T: Clone + gluesql_core::translate::IntoParamLiteral,
-{
+struct ConstGenericRecord<T, const N: usize> {
     tag: String,
     payload: T,
 }
```

---

### Incident Patch 4: `90516c8d` (2026-09-27)
**Commit Message**: Restore docs.rs builds after nightly Rust API removals (#2022)

docs.rs builds GlueSQL with all features enabled on nightly Rust.
rustix 0.37.28 relied on internal rustc layout attributes, while the
DOCS_RS path in proc-macro2 1.0.92 used unstable proc_macro APIs.
The current nightly removed those interfaces, so these dependency
versions could no longer compile.

Switch MongoDB from `sync` to `tokio-sync` to preserve its synchronous
API without pulling in the async-std and rustix 0.37 dependency chain.
Refresh proc-macro2 to a version compatible with the current nightly.

**File**: `Cargo.lock` (modified, +9/-465)
```diff
@@ -181,211 +181,6 @@ dependencies = [
  "num",
 ]
 
-[[package]]
-name = "async-attributes"
-version = "1.1.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a3203e79f4dd9bdda415ed03cf14dae5a2bf775c683a00f94e9cd1faf0f596e5"
-dependencies = [
- "quote",
- "syn 1.0.109",
-]
-
-[[package]]
-name = "async-channel"
-version = "1.9.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "81953c529336010edd6d8e358f886d9581267795c61b19475b71314bffa46d35"
-dependencies = [
- "concurrent-queue",
- "event-listener 2.5.3",
- "futures-core",
-]
-
-[[package]]
-name = "async-channel"
-version = "2.5.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "924ed96dd52d1b75e9c1a3e6275715fd320f5f9439fb5a4a11fa51f4221158d2"
-dependencies = [
- "concurrent-queue",
- "event-listener-strategy",
- "futures-core",
- "pin-project-lite",
-]
-
-[[package]]
-name = "async-executor"
-version = "1.5.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6fa3dc5f2a8564f07759c008b9109dc0d39de92a88d5588b8a5036d286383afb"
-dependencies = [
- "async-lock 2.8.0",
- "async-task",
- "concurrent-queue",
- "fastrand 1.9.0",
- "futures-lite 1.13.0",
- "slab",
-]
-
-[[package]]
-name = "async-global-executor"
-version = "2.3.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f1b6f5d7df27bd294849f8eec66ecfc63d11814df7a4f5d74168a2394467b776"
-dependencies = [
- "async-channel 1.9.0",
- "async-executor",
- "async-io 1.13.0",
- "async-lock 2.8.0",
- "blocking",
- "futures-lite 1.13.0",
- "once_cell",
-]
-
-[[package]]
-name = "async-io"
-version = "1.13.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0fc5b45d93ef0529756f812ca52e44c221b35341892d3dcc34132ac02f3dd2af"
-dependencies = [
- "async-lock 2.8.0",
- "autocfg",
- "cfg-if",
- "concurrent-queue",
- "futures-lite 1.13.0",
- "log",
- "parking",
- "polling 2.8.0",
- "rustix 0.37.28",
- "slab",
- "socket2 0.4.10",
- "waker-fn",
-]
-
-[[package]]
-name = "async-io"
-version = "2.4.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "43a2b323ccce0a1d90b449fd71f2a06ca7faa7c54c2751f06c9bd851fc061059"
-dependencies = [
- "async-lock 3.4.2",
- "cfg-if",
- "concurrent-queue",
- "futures-io",
- "futures-lite 2.6.1",
- "parking",
- "polling 3.7.4",
- "rustix 0.38.34",
- "slab",
- "tracing",
- "windows-sys 0.59.0",
-]
-
-[[package]]
-name = "async-lock"
-version = "2.8.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "287272293e9d8c41773cec55e365490fe034813a2f172f502d6ddcf75b2f582b"
-dependencies = [
- "event-listener 2.5.3",
-]
-
-[[package]]
-name = "async-lock"
-version = "3.4.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "290f7f2596bd5b78a9fec8088ccd89180d7f9f55b94b0576823bbbdc72ee8311"
-dependencies = [
- "event-listener 5.4.1",
- "event-listener-strategy",
- "pin-project-lite",
-]
-
-[[package]]
-name = "async-process"
-version = "1.8.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ea6438ba0a08d81529c69b36700fa2f95837bfe3e776ab39cde9c14d9149da88"
-dependencies = [
- "async-io 1.13.0",
- "async-lock 2.8.0",
- "async-signal",
- "blocking",
- "cfg-if",
- "event-listener 3.1.0",
- "futures-lite 1.13.0",
- "rustix 0.38.34",
- "windows-sys 0.48.0",
-]
-
-[[package]]
-name = "async-signal"
-version = "0.2.10"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "637e00349800c0bdf8bfc21ebbc0b6524abea702b0da4168ac00d070d0c0b9f3"
-dependencies = [
- "async-io 2.4.0",
- "async-lock 3.4.2",
- "atomic-waker",
- "cfg-if",
- "futures-core",
- "futures-io",
- "rustix 0.38.34",
- "signal-hook-registry",
- "slab",
- "windows-sys 0.59.0",
-]
-
-[[package]]
-name = "async-std"
-version = "1.12.0"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "62565bb4402e926b29953c785397c6dc0391b7b446e45008b0049eb43cec6f5d"
-dependencies = [
- "async-attributes",
- "async-channel 1.9.0",
- "async-global-executor",
- "async-io 1.13.0",
- "async-lock 2.8.0",
- "async-process",
- "crossbeam-utils",
- "futures-channel",
- "futures-core",
- "futures-io",
- "futures-lite 1.13.0",
- "gloo-timers",
- "kv-log-macro",
- "log",
- "memchr",
- "once_cell",
- "pin-project-lite",
- "pin-utils",
- "slab",
- "wasm-bindgen-futures",
-]
-
-[[package]]
-name = "async-std-resolver"
-version = "0.21.2"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0f2f8a4a203be3325981310ab243a28e6e4ea55b6519bffce05d41ab60e09ad8"
-dependencies = [
- "async-std",
- "async-trait",
- "futures-io",
- "futures-util",
- "pin-utils",
- "socket2 0.4.10",
- "trust-dns-resolver",
-]
-
-[[package]]
-name = "async-task"
-version = "4.7.1"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "8b75356056920673b02621b35afd0f7dda9306d03c79a30f5c56c44cf256e3de"
-
 [[package]]
 name = "
```

**File**: `storages/mongo-storage/Cargo.toml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ documentation.workspace = true
 gluesql-core.workspace = true
 
 thiserror = "1.0"
-mongodb = { version = "2.5.0", default-features = false, features = ["sync"] }
+mongodb = { version = "2.5.0", default-features = false, features = ["tokio-sync"] }
 bson = { version = "2.6.1", features = ["chrono-0_4"] }
 chrono = { version = "0.4.26", features = ["serde", "wasmbind"] }
 strum_macros = "0.24"
```

---

### Incident Patch 5: `ab43b1a8` (2026-09-20)
**Commit Message**: Improve README and storage guidance (#2029)

Refocus the README on a concise project overview and easier onboarding.

- clarify GlueSQL's positioning as an embeddable multi-model SQL engine
- add installation guidance for Rust, JavaScript, and browser usage
- replace detailed storage descriptions with a use-case-oriented overview
- streamline SQL, Query Builder, schema flexibility, custom storage, and contribution sections
- move detailed guidance to the documentation where appropriate

**File**: `README.md` (modified, +59/-94)
```diff
@@ -7,51 +7,72 @@
 [![Chat](https://img.shields.io/discord/780298017940176946?logo=discord&logoColor=white)](https://discord.gg/C6TDEgzDzY)
 [![Coverage Status](https://coveralls.io/repos/github/gluesql/gluesql/badge.svg?branch=main)](https://coveralls.io/github/gluesql/gluesql?branch=main)
 
-## Multi-Model Database Engine as a Library
+## An Embeddable Multi-Model SQL Engine
 
-GlueSQL is a Rust library for SQL databases that includes a parser ([sqlparser-rs](https://github.com/sqlparser-rs/sqlparser-rs)), an execution layer, and a variety of storage options, both persistent and non-persistent, all in one package. It is a versatile tool for developers, supporting both SQL and Query Builder. GlueSQL can handle structured and unstructured data, making it suitable for a wide range of use cases. It is portable and can be used with various storage types, including log files and read-write capable storage. GlueSQL is designed to be extensible and supports custom planners, making it a powerful tool for developers who need SQL support for their databases or services.
+GlueSQL is an embeddable, multi-model SQL database engine written in Rust.
+It combines SQL with the flexibility to work across different data models and storage environments.
+It is also available for JavaScript applications in the browser and Node.js.
 
-For more information on how to use GlueSQL, please refer to the [**official documentation website**](https://gluesql.org/docs). The documentation provides detailed information on how to install and use GlueSQL, as well as examples and tutorials on how to create custom storage systems and perform SQL operations.
+## Why GlueSQL?
 
-"We offer a service where the GlueSQL team can implement and maintain your custom storage, especially beneficial for NoSQL databases with their own query planner and execution layer. We welcome any services wishing to support SQL and GlueSQL query interfaces. For more details, please refer to [**here**](#gluesql-custom-storage-let-us-handle-it-for-you)."
+GlueSQL is quite sticky: it brings SQL to your application's storage. Use a provided storage backend or implement a custom adapter to query existing data without moving it into a separate database. GlueSQL handles SQL parsing, planning, and execution.
 
-If you're interested in learning more about GlueSQL, we recommend the following blog articles for a deeper dive into its capabilities and benefits:
+- **Choose a storage backend:** use in-memory storage, embedded databases, local files, or external databases.
+- **Work with flexible data:** query schema-defined and schemaless tables together, including MAP and LIST values.
+- **Choose a query interface:** write SQL or compose queries with the Rust Query Builder, both backed by the same engine.
 
-1. [Breaking the Boundary between SQL and NoSQL Database](https://gluesql.org/docs/dev/articles/breaking-the-boundary-between-sql-and-nosql)
-2. [Revolutionizing Databases by Unifying Query Interfaces](https://gluesql.org/docs/dev/articles/revolutionizing-databases-by-unifying-query-interfaces)
-3. [Test-Driven Documentation - Automating User Manual Creation](https://gluesql.org/docs/dev/articles/test-driven-documentation)
+[Explore the documentation →](https://gluesql.org/docs)
 
-## Supporting SQL and Query Builder
+## Installation
 
-GlueSQL supports both SQL and Query Builder. Unlike ORMs that generate SQL strings, GlueSQL's Query Builder constructs execution-facing statement plans directly while still allowing explicit AST outputs where they are needed. This keeps access to GlueSQL-specific query features without routing every query through SQL text generation.
+### Rust
 
-### [Rust Example](./pkg/rust/examples/hello_world.rs)
+```bash
+cargo add gluesql
+```
 
-- example: [pkg/rust/examples/hello_world.rs](./pkg/rust/examples/hello_world.rs)
+### JavaScript
 
-```rust
-#[derive(gluesql::FromGlueRow)]
-struct Row {
-    id: i64,
-    name: String,
-}
-
-let storage = MemoryStorage::default();
-let mut glue = Glue::new(storage);
-
-let rows = glue
-    .execute("SELECT id, name FROM Foo;")
-    .rows_as::<Row>()
-    .unwrap();
+```bash
+npm install gluesql
+```
+
+### Browser (CDN)
+
+```js
+import { gluesql } from 'https://cdn.jsdelivr.net/npm/gluesql/gluesql.js';
 ```
 
-### SQL Example
+For more JS library information, check out the [gluesql-js repository](https://github.com/gluesql/gluesql-js).
+
+## Supported Reference Storages
+
+GlueSQL provides reference storage implementations for in-memory data, embedded databases, local files, and external databases. Use the table below to choose a storage for your use case.
+
+| Use case | Recommended storage |
+| --- | --- |
+| Persistent embedded database | [Redb](https://gluesql.org/docs/0.20.0/storages/supported-storages/redb-storage/) |
+| Existing MongoDB or Redis data | [Mongo](https://gluesql.org/docs/0.20.0/storages/supported-storages/mongo-storage/) or [Redis](https://gluesql.org/docs/0.20.0/storages/supported-storag
```

---

### Incident Patch 6: `44de3ca8` (2026-08-17)
**Commit Message**: Skip NULL values in non-COUNT aggregates (#1990)

SQL eliminates NULL before applying a set function, but SUM, MIN, MAX,
AVG, VARIANCE, and STDEV fed every evaluated value straight into the
accumulator. A single NULL therefore poisoned SUM/AVG/VARIANCE/STDEV
through Value::add, and a NULL in the first row of a group became a
sticky initial value for MIN/MAX because Value::Null.evaluate_cmp
returns None. COUNT was already correct.

Return early from State::accumulate for NULL inputs to every aggregate
but COUNT, so the invariant lives in one place and AggrValue never sees
NULL. Groups with no non-NULL input keep an empty slot and already
export empty_value, which is Null for these aggregates.

The aggregate fixtures encoded the old behavior as expected output, so
sum, avg, variance, stdev, and expr are updated to the standard results,
and a new null fixture covers leading NULLs, all-NULL columns, DISTINCT,
and per-group elimination.

**File**: `core/src/executor/query/aggregation/state.rs` (modified, +7/-0)
```diff
@@ -391,6 +391,13 @@ impl<'a, T: GStore> State<'a, T> {
             }
         };
 
+        // SQL eliminates NULL before applying a set function, so every aggregate but
+        // COUNT ignores NULL inputs entirely. Groups that see nothing but NULL keep an
+        // empty slot and fall back to `empty_value` on export.
+        if value.is_null() && !matches!(aggregate.func, AggregateFunctionPlan::Count(_)) {
+            return Ok(());
+        }
+
         let group = self
             .groups
             .get_mut(group_index)
```

**File**: `test-suite/fixtures/aggregate/avg.sql` (modified, +6/-6)
```diff
@@ -16,9 +16,9 @@ INSERT INTO Item (id, quantity, age, total) VALUES
 
 SELECT AVG(age) FROM Item
 -- @expect:
--- | AVG(age) |
--- | -------- |
--- | NULL     |
+-- | AVG(age): F64   |
+-- | --------------- |
+-- | 34.666666666667 |
 
 SELECT AVG(id), AVG(quantity) FROM Item
 -- @expect:
@@ -34,6 +34,6 @@ SELECT AVG(DISTINCT id) FROM Item
 
 SELECT AVG(DISTINCT age) FROM Item
 -- @expect:
--- | AVG(DISTINCT age) |
--- | ----------------- |
--- | NULL              |
+-- | AVG(DISTINCT age): F64 |
+-- | ---------------------- |
+-- | 34.666666666667        |
```

**File**: `test-suite/fixtures/aggregate/expr.sql` (modified, +1/-1)
```diff
@@ -47,4 +47,4 @@ SELECT SUM(age) IS NULL AS test FROM Item;
 -- @expect:
 -- | test: Bool |
 -- | ---------- |
--- | true       |
+-- | false      |
```

**File**: `test-suite/fixtures/aggregate/null.sql` (added, +107/-0)
```diff
@@ -0,0 +1,107 @@
+CREATE TABLE Item (
+    id INTEGER,
+    val INTEGER NULL
+);
+-- @expect: ok
+
+INSERT INTO Item (id, val) VALUES
+    (1, NULL),
+    (2,    5),
+    (3, NULL),
+    (4,    3);
+-- @expect: ok
+
+-- @name: SUM skips NULL in the first row
+SELECT SUM(val) FROM Item
+-- @expect:
+-- | SUM(val): I64 |
+-- | ------------- |
+-- | 8             |
+
+-- @name: AVG divides by the number of non-NULL rows
+SELECT AVG(val) FROM Item
+-- @expect:
+-- | AVG(val): F64 |
+-- | ------------- |
+-- | 4.0           |
+
+-- @name: MIN skips a leading NULL instead of keeping it
+SELECT MIN(val) FROM Item
+-- @expect:
+-- | MIN(val): I64 |
+-- | ------------- |
+-- | 3             |
+
+-- @name: MAX skips a leading NULL instead of keeping it
+SELECT MAX(val) FROM Item
+-- @expect:
+-- | MAX(val): I64 |
+-- | ------------- |
+-- | 5             |
+
+-- @name: VARIANCE skips NULL
+SELECT VARIANCE(val) FROM Item
+-- @expect:
+-- | VARIANCE(val): F64 |
+-- | ------------------ |
+-- | 1.0                |
+
+-- @name: STDEV skips NULL
+SELECT STDEV(val) FROM Item
+-- @expect:
+-- | STDEV(val): F64 |
+-- | --------------- |
+-- | 1.0             |
+
+-- @name: COUNT keeps counting NULL rows only for the wildcard form
+SELECT COUNT(val), COUNT(*) FROM Item
+-- @expect:
+-- | COUNT(val): I64 | COUNT(*): I64 |
+-- | --------------- | ------------- |
+-- | 2               | 4             |
+
+-- @name: DISTINCT aggregates skip NULL as well
+SELECT SUM(DISTINCT val), MIN(DISTINCT val), MAX(DISTINCT val) FROM Item
+-- @expect:
+-- | SUM(DISTINCT val): I64 | MIN(DISTINCT val): I64 | MAX(DISTINCT val): I64 |
+-- | ---------------------- | ---------------------- | ---------------------- |
+-- | 8                      | 3                      | 5                      |
+
+CREATE TABLE AllNull (val INTEGER NULL);
+-- @expect: ok
+
+INSERT INTO AllNull VALUES (NULL), (NULL);
+-- @expect: ok
+
+-- @name: an all-NULL column aggregates to NULL
+SELECT SUM(val), MIN(val), MAX(val), AVG(val), VARIANCE(val), STDEV(val) FROM AllNull
+-- @expect:
+-- | SUM(val) | MIN(val) | MAX(val) | AVG(val) | VARIANCE(val) | STDEV(val) |
+-- | -------- | -------- | -------- | -------- | ------------- | ---------- |
+-- | NULL     | NULL     | NULL     | NULL     | NULL          | NULL       |
+
+-- @name: an all-NULL column still counts rows
+SELECT COUNT(val), COUNT(*) FROM AllNull
+-- @expect:
+-- | COUNT(val): I64 | COUNT(*): I64 |
+-- | --------------- | ------------- |
+-- | 0               | 2             |
+
+CREATE TABLE Grouped (city TEXT, val INTEGER NULL);
+-- @expect: ok
+
+INSERT INTO Grouped VALUES
+    ('Seoul', NULL),
+    ('Seoul',   10),
+    ('Busan', NULL),
+    ('Seoul',    2),
+    ('Busan', NULL);
+-- @expect: ok
+
+-- @name: NULL elimination applies per group
+SELECT city, SUM(val), MIN(val), COUNT(val) FROM Grouped GROUP BY city
+-- @expect:
+-- | city: Str | SUM(val) | MIN(val) | COUNT(val): I64 |
+-- | --------- | -------- | -------- | --------------- |
+-- | "Seoul"   | I64(12)  | I64(2)   | 2               |
+-- | "Busan"   | NULL     | NULL     | 0               |
```

**File**: `test-suite/fixtures/aggregate/stdev.sql` (modified, +6/-6)
```diff
@@ -16,9 +16,9 @@ INSERT INTO Item (id, quantity, age, total) VALUES
 
 SELECT STDEV(age) FROM Item
 -- @expect:
--- | STDEV(age) |
--- | ---------- |
--- | NULL       |
+-- | STDEV(age): F64 |
+-- | --------------- |
+-- | 39.262648351271 |
 
 SELECT STDEV(total) FROM Item
 -- @expect:
@@ -34,6 +34,6 @@ SELECT STDEV(DISTINCT id) FROM Item
 
 SELECT STDEV(DISTINCT age) FROM Item
 -- @expect:
--- | STDEV(DISTINCT age) |
--- | ------------------- |
--- | NULL                |
+-- | STDEV(DISTINCT age): F64 |
+-- | ------------------------ |
+-- | 39.262648351271          |
```

**File**: `test-suite/fixtures/aggregate/sum.sql` (modified, +6/-6)
```diff
@@ -16,9 +16,9 @@ INSERT INTO Item (id, quantity, age, total) VALUES
 
 SELECT SUM(age) FROM Item
 -- @expect:
--- | SUM(age) |
--- | -------- |
--- | NULL     |
+-- | SUM(age): I64 |
+-- | ------------- |
+-- | 104           |
 
 SELECT SUM(id), SUM(quantity) FROM Item
 -- @expect:
@@ -64,9 +64,9 @@ SELECT SUM(DISTINCT id) FROM Item
 
 SELECT SUM(DISTINCT age) FROM Item
 -- @expect:
--- | SUM(DISTINCT age) |
--- | ----------------- |
--- | NULL              |
+-- | SUM(DISTINCT age): I64 |
+-- | ---------------------- |
+-- | 104                    |
 
 CREATE TABLE EmptyItem (id INTEGER NULL);
 -- @expect: ok
```

**File**: `test-suite/fixtures/aggregate/variance.sql` (modified, +6/-6)
```diff
@@ -18,9 +18,9 @@ INSERT INTO Item (id, quantity, age, total) VALUES
 
 SELECT VARIANCE(age) FROM Item
 -- @expect:
--- | VARIANCE(age) |
--- | ------------- |
--- | NULL          |
+-- | VARIANCE(age): F64 |
+-- | ------------------ |
+-- | 1609.2             |
 
 SELECT VARIANCE(id), VARIANCE(quantity) FROM Item
 -- @expect:
@@ -36,9 +36,9 @@ SELECT VARIANCE(DISTINCT id) FROM Item
 
 SELECT VARIANCE(DISTINCT age) FROM Item
 -- @expect:
--- | VARIANCE(DISTINCT age) |
--- | ---------------------- |
--- | NULL                   |
+-- | VARIANCE(DISTINCT age): F64 |
+-- | --------------------------- |
+-- | 1541.555555555556           |
 
 SELECT VARIANCE(quantity), VARIANCE(DISTINCT quantity) FROM Item
 -- @expect:
```

**File**: `test-suite/src/lib.rs` (modified, +1/-0)
```diff
@@ -165,6 +165,7 @@ macro_rules! generate_store_tests {
         sql_case!(aggregate::having);
         sql_case!(aggregate::max);
         sql_case!(aggregate::min);
+        sql_case!(aggregate::null);
         sql_case!(aggregate::stdev);
         sql_case!(aggregate::sum);
         sql_case!(aggregate::variance);
```

---

### Incident Patch 7: `bc185d81` (2026-08-04)
**Commit Message**: Fix schema dependency scanning for ORDER BY expressions (#1982)

Scan every ORDER BY expression when collecting query schema dependencies.

This ensures tables referenced only by scalar subqueries in ORDER BY are included in the schema map. Add regression coverage for single and multiple ordering expressions.

**File**: `core/src/plan/schema.rs` (modified, +27/-2)
```diff
@@ -97,27 +97,36 @@ fn scan_query<T: Store + ?Sized>(
 ) -> Result<HashMap<String, Schema>> {
     let QueryPlan {
         body,
+        order_by,
         limit,
         offset,
-        ..
     } = query;
 
     let schema_list = match body {
         SetExprPlan::Select(select) => scan_select(storage, select)?,
         SetExprPlan::Values(_) => HashMap::new(),
     };
 
+    let order_by = order_by
+        .iter()
+        .map(|order_by| scan_expr(storage, &order_by.expr))
+        .collect::<Result<Vec<HashMap<String, Schema>>>>()?
+        .into_iter()
+        .flatten();
+
     let schema_list = match (limit, offset) {
         (Some(limit), Some(offset)) => schema_list
             .into_iter()
+            .chain(order_by)
             .chain(scan_expr(storage, limit)?)
             .chain(scan_expr(storage, offset)?)
             .collect(),
         (Some(expr), None) | (None, Some(expr)) => schema_list
             .into_iter()
+            .chain(order_by)
             .chain(scan_expr(storage, expr)?)
             .collect(),
-        (None, None) => schema_list,
+        (None, None) => schema_list.into_iter().chain(order_by).collect(),
     };
 
     Ok(schema_list)
@@ -351,6 +360,22 @@ mod tests {
         ",
             &["Bar", "Foo"],
         );
+        test(
+            "
+            SELECT *
+            FROM Foo
+            ORDER BY (SELECT id FROM Bar LIMIT 1);
+        ",
+            &["Bar", "Foo"],
+        );
+        test(
+            "
+            SELECT *
+            FROM Foo
+            ORDER BY id + 1, (SELECT id FROM Bar LIMIT 1);
+        ",
+            &["Bar", "Foo"],
+        );
 
         // PlanExpr::QueryAndExpr
         test(
```

---

### Incident Patch 8: `a155abde` (2026-07-25)
**Commit Message**: Fix CompositeStorage rollback delegation (#1963)

Delegate CompositeStorage::rollback() to rollback() on each inner storage instead of commit(), preventing failed operations from being committed.

**File**: `storages/composite-storage/src/transaction.rs` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ impl Transaction for CompositeStorage {
 
     fn rollback(&mut self) -> Result<()> {
         for storage in self.storages.values_mut() {
-            storage.commit()?;
+            storage.rollback()?;
         }
 
         Ok(())
```

---

### Incident Patch 9: `545aa039` (2026-07-19)
**Commit Message**: Add `ToGlueRow` derive macro and `values_from` insert builder (#1948)

Define `ToGlueRow` to derive column metadata and row conversion from structs.
Add `values_from` to support struct-based insertion in the query builder, replacing column expressions.
Update error handling to enforce non-empty `values_from` inputs.
Expand tests to validate struct-based insertion via `values_from`.
Document struct-based insertion support and field renaming.

**File**: `core/src/query_builder/error.rs` (modified, +6/-0)
```diff
@@ -15,4 +15,10 @@ pub enum QueryBuilderError {
         "projection expression label cannot be derived from a plan-only expression; use an explicit alias"
     )]
     ProjectionLabelRequiresAlias,
+
+    #[error("values_from requires at least one row")]
+    ValuesFromRequiresRows,
+
+    #[error("values_from row has {found} values but {expected} columns are declared")]
+    ValuesFromColumnCountMismatch { expected: usize, found: usize },
 }
```

**File**: `core/src/query_builder/insert.rs` (modified, +157/-3)
```diff
@@ -1,6 +1,7 @@
 use {
-    super::{Build, ColumnList, ExprList, QueryNode},
-    crate::{plan::StatementPlan, result::Result},
+    super::{Build, ColumnList, ExprList, ExprNode, QueryBuilderError, QueryNode},
+    crate::{plan::StatementPlan, result::Result, row_conversion::ToGlueRow},
+    std::borrow::Cow,
 };
 
 #[derive(Clone, Debug)]
@@ -38,6 +39,40 @@ impl InsertNode {
             source: query.into(),
         }
     }
+
+    /// Builds VALUES rows from [`ToGlueRow`] structs. Columns are always set
+    /// from the struct metadata, replacing any set beforehand.
+    pub fn values_from<'a, T: ToGlueRow>(self, rows: &[T]) -> Result<InsertSourceNode<'a>> {
+        if rows.is_empty() {
+            return Err(QueryBuilderError::ValuesFromRequiresRows.into());
+        }
+
+        let columns = T::glue_columns().to_vec();
+        let values = rows
+            .iter()
+            .map(|row| {
+                let literals = row.to_glue_row();
+                if literals.len() != columns.len() {
+                    return Err(QueryBuilderError::ValuesFromColumnCountMismatch {
+                        expected: columns.len(),
+                        found: literals.len(),
+                    }
+                    .into());
+                }
+
+                Ok(literals
+                    .into_iter()
+                    .map(|literal| ExprNode::Expr(Cow::Owned(literal.into_expr())))
+                    .collect::<Vec<_>>()
+                    .into())
+            })
+            .collect::<Result<_>>()?;
+
+        Ok(InsertSourceNode {
+            insert_node: self.columns(columns),
+            source: QueryNode::Values(values),
+        })
+    }
 }
 
 #[derive(Clone, Debug)]
@@ -63,7 +98,13 @@ impl Build for InsertSourceNode<'_> {
 
 #[cfg(test)]
 mod tests {
-    use crate::query_builder::{Build, num, table, test};
+    use crate::{
+        data::Value,
+        query_builder::{Build, QueryBuilderError, num, table, test, value},
+        result::Error,
+        row_conversion::ToGlueRow,
+        translate::{IntoParamLiteral, ParamLiteral},
+    };
 
     #[test]
     fn insert() {
@@ -94,4 +135,117 @@ mod tests {
         let expected = r"INSERT INTO Foo SELECT id, name FROM Bar LIMIT 10";
         test(&actual, expected);
     }
+
+    struct Item {
+        id: i64,
+        name: String,
+        in_stock: Option<bool>,
+    }
+
+    impl ToGlueRow for Item {
+        fn glue_columns() -> &'static [&'static str] {
+            static COLUMNS: [&str; 3] = ["id", "title", "in_stock"];
+            &COLUMNS
+        }
+
+        fn to_glue_row(&self) -> Vec<ParamLiteral> {
+            vec![
+                self.id.into_param_literal(),
+                self.name.clone().into_param_literal(),
+                self.in_stock.into_param_literal(),
+            ]
+        }
+    }
+
+    #[test]
+    fn insert_values_from() {
+        let items = vec![
+            Item {
+                id: 1,
+                name: "glue".to_owned(),
+                in_stock: Some(true),
+            },
+            Item {
+                id: 2,
+                name: "sql".to_owned(),
+                in_stock: None,
+            },
+        ];
+
+        let actual = table("Foo")
+            .insert()
+            .values_from(&items)
+            .and_then(Build::build);
+        let expected = table("Foo")
+            .insert()
+            .columns(vec!["id", "title", "in_stock"])
+            .values(vec![
+                vec![
+                    value(Value::I64(1)),
+                    value(Value::Str("glue".to_owned())),
+                    value(Value::Bool(true)),
+                ],
+                vec![
+                    value(Value::I64(2)),
+                    value(Value::Str("sql".to_owned())),
+                    value(Value::Null),
+                ],
+            ])
+            .build();
+        pretty_assertions::assert_eq!(actual, expected);
+    }
+
+    #[test]
+    fn insert_values_from_replaces_columns() {
+        let items = vec![Item {
+            id: 7,
+            name: "hi".to_owned(),
+            in_stock: None,
+        }];
+
+        let actual = table("Foo")
+            .insert()
+            .columns("ignored, also_ignored")
+            .values_from(&items)
+            .and_then(Build::build);
+        let expected = table("Foo")
+            .insert()
+            .values_from(&items)
+            .and_then(Build::build);
+        pretty_assertions::assert_eq!(actual, expected);
+    }
+
+    #[test]
+    fn insert_values_from_requires_rows() {
+        let actual = table("Foo").insert().values_from::<Item>(&[]).map(|_| ());
+        let expected = Err(Error::QueryBuilder(
+            QueryBuilderError::ValuesFromRequiresRows,
+        ));
+        pretty_assertions::assert_eq!(actual, expected);
+    }
+
+    #[test]
+    fn insert_values_from_rejects_column_count_mismatch() {
+        struct Mismatched;
+
+        impl ToGlueRow f
```

**File**: `core/src/row_conversion.rs` (modified, +5/-0)
```diff
@@ -51,6 +51,11 @@ pub trait FromGlueRow: Sized {
     ) -> Result<Self, RowConversionError>;
 }
 
+pub trait ToGlueRow {
+    fn glue_columns() -> &'static [&'static str];
+    fn to_glue_row(&self) -> Vec<crate::translate::ParamLiteral>;
+}
+
 pub trait SelectExt {
     fn rows_as<T: FromGlueRow>(self) -> Result<Vec<T>, RowConversionError>;
     fn one_as<T: FromGlueRow>(self) -> Result<T, RowConversionError>;
```

**File**: `docs/docs/query-builder/statements/data-manipulation/inserting-data.md` (modified, +30/-0)
```diff
@@ -51,3 +51,33 @@ test(actual, expected);
 ```
 
 This code inserts data into the table `Bar` using the `SELECT` statement on the table `Foo`. The `project` method is used to specify the columns `id` and `name` as the source data.
+
+## Insert from Structs
+
+If you derive `ToGlueRow` on a struct, you can insert struct values directly with the `values_from` method — no manual field-to-expression mapping required. Columns are set automatically from the struct fields, and `#[glue(rename = "...")]` lets a field map to a different column name. `Option` fields convert `None` to `NULL`.
+
+```rust
+use gluesql::ToGlueRow;
+
+#[derive(ToGlueRow)]
+struct Item {
+    id: i64,
+    #[glue(rename = "name")]
+    title: String,
+    rate: Option<f64>, // None -> NULL
+}
+
+let items = vec![
+    Item { id: 4, title: "Fish".to_owned(), rate: Some(0.2) },
+    Item { id: 5, title: "Bread".to_owned(), rate: None },
+];
+
+let actual = table("Foo")
+    .insert()
+    .values_from(&items)?
+    .execute(glue);
+let expected = Ok(Payload::Insert(2));
+test(actual, expected);
+```
+
+`values_from` returns an error if the given slice is empty, and it always sets the insert columns from the struct metadata so the columns stay aligned with the generated values.
```

**File**: `macros/src/lib.rs` (modified, +11/-0)
```diff
@@ -8,6 +8,8 @@ use {
     },
 };
 
+mod to_glue_row;
+
 fn resolve_gluesql_crate() -> Result<syn::Path, syn::Error> {
     if std::env::var("CARGO_PKG_NAME")
         .map(|name| name == "gluesql")
@@ -191,6 +193,15 @@ pub fn derive_from_glue_row(input: TokenStream) -> TokenStream {
     }
 }
 
+#[proc_macro_derive(ToGlueRow, attributes(glue))]
+pub fn derive_to_glue_row(input: TokenStream) -> TokenStream {
+    let input = parse_macro_input!(input as DeriveInput);
+    match to_glue_row::expand_to_glue_row(input) {
+        Ok(ts) => TokenStream::from(ts),
+        Err(e) => e.to_compile_error().into(),
+    }
+}
+
 fn parse_glue_rename(attr: &Attribute) -> Option<Result<Option<String>, syn::Error>> {
     if !attr.path().is_ident("glue") {
         return None;
```

**File**: `macros/src/to_glue_row.rs` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+use {
+    crate::{parse_glue_rename, resolve_gluesql_crate},
+    quote::quote,
+    syn::{Data, DeriveInput, Fields, spanned::Spanned},
+};
+
+pub(crate) fn expand_to_glue_row(
+    input: DeriveInput,
+) -> Result<proc_macro2::TokenStream, syn::Error> {
+    let input_span = input.span();
+
+    let gluesql_crate_path = resolve_gluesql_crate()?;
+    let gluesql_crate = quote! { #gluesql_crate_path };
+
+    let ident = input.ident.clone();
+    let Data::Struct(data) = input.data else {
+        return Err(syn::Error::new(
+            input_span,
+            "ToGlueRow can only be derived for structs",
+        ));
+    };
+
+    let fields = match data.fields {
+        Fields::Named(f) => f.named,
+        _ => {
+            return Err(syn::Error::new(
+                input_span,
+                "ToGlueRow supports only named fields",
+            ));
+        }
+    };
+
+    let mut seen_columns: Vec<String> = Vec::new();
+    let mut column_names = Vec::new();
+    let mut field_literals = Vec::new();
+
+    for field in &fields {
+        let field_ident = field.ident.clone().expect("named field");
+        let field_name_literal = field_ident.to_string();
+
+        let mut rename: Option<String> = None;
+        for attr in &field.attrs {
+            if let Some(res) = parse_glue_rename(attr) {
+                match res {
+                    Ok(Some(name)) => rename = Some(name),
+                    Ok(None) => {}
+                    Err(e) => return Err(e),
+                }
+            }
+        }
+        let column_name = rename.unwrap_or_else(|| field_name_literal.clone());
+        if seen_columns.contains(&column_name) {
+            return Err(syn::Error::new(
+                field.span(),
+                format!("duplicate column name `{column_name}`"),
+            ));
+        }
+        seen_columns.push(column_name.clone());
+        column_names.push(quote! { #column_name });
+
+        field_literals.push(quote! {
+            #gluesql_crate::translate::IntoParamLiteral::into_param_literal(
+                ::core::clone::Clone::clone(&self.#field_ident)
+            )
+        });
+    }
+
+    let columns_len = column_names.len();
+
+    let expanded = quote! {
+        impl #gluesql_crate::row_conversion::ToGlueRow for #ident {
+            fn glue_columns() -> &'static [&'static str] {
+                static COLUMNS: [&str; #columns_len] = [ #(#column_names),* ];
+                &COLUMNS
+            }
+
+            fn to_glue_row(&self) -> ::std::vec::Vec<#gluesql_crate::translate::ParamLiteral> {
+                ::std::vec![ #(#field_literals),* ]
+            }
+        }
+    };
+
+    Ok(expanded)
+}
+
+#[cfg(test)]
+mod tests {
+    use super::expand_to_glue_row;
+    use syn::parse_quote;
+
+    #[test]
+    fn non_struct_input_returns_error() {
+        let di: syn::DeriveInput = parse_quote! {
+            enum E { A }
+        };
+        let err = expand_to_glue_row(di).unwrap_err();
+        assert!(
+            err.to_string()
+                .contains("ToGlueRow can only be derived for structs")
+        );
+    }
+
+    #[test]
+    fn non_named_fields_struct_returns_error() {
+        let di: syn::DeriveInput = parse_quote! {
+            struct T(i32);
+        };
+        let err = expand_to_glue_row(di).unwrap_err();
+        assert!(
+            err.to_string()
+                .contains("ToGlueRow supports only named fields")
+        );
+    }
+
+    #[test]
+    fn glue_rename_ok_some_and_ok_none() {
+        let di: syn::DeriveInput = parse_quote! {
+            struct S {
+                #[glue(rename = "col")] a: i64,
+                #[glue(other = "x")] b: String,
+            }
+        };
+        let _ = expand_to_glue_row(di).expect("expand ok");
+    }
+
+    #[test]
+    fn duplicate_column_name_returns_error() {
+        let di: syn::DeriveInput = parse_quote! {
+            struct S {
+                value: i64,
+                #[glue(rename = "value")]
+                previous_value: i64,
+            }
+        };
+        let err = expand_to_glue_row(di).unwrap_err();
+        assert!(err.to_string().contains("duplicate column name `value`"));
+    }
+
+    #[test]
+    fn glue_rename_wrong_literal_type() {
+        let di: syn::DeriveInput = parse_quote! {
+            struct S { #[glue(rename = 123)] a: i64 }
+        };
+        let err = expand_to_glue_row(di).unwrap_err();
+        assert!(
+            err.to_string()
+                .contains("expected string literal for rename")
+        );
+    }
+}
```

**File**: `macros/tests/compile-fail/to_glue_row_duplicate_column.rs` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+use gluesql_macros::ToGlueRow;
+
+#[derive(ToGlueRow)]
+struct T {
+    value: i64,
+    #[glue(rename = "value")]
+    previous_value: i64,
+}
```

**File**: `macros/tests/compile-fail/to_glue_row_duplicate_column.stderr` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+error: duplicate column name `value`
+ --> tests/compile-fail/to_glue_row_duplicate_column.rs:6:5
+  |
+6 |     #[glue(rename = "value")]
+  |     ^
+
+error[E0601]: `main` function not found in crate `$CRATE`
+ --> tests/compile-fail/to_glue_row_duplicate_column.rs:8:2
+  |
+8 | }
+  |  ^ consider adding a `main` function to `$DIR/tests/compile-fail/to_glue_row_duplicate_column.rs`
```

---

### Incident Patch 10: `1a7118d2` (2026-07-19)
**Commit Message**: Migrate SQL test cases to file fixtures (#1941)

Migrate SQL-driven test-suite cases from Rust test bodies to embedded .sql fixture files.

The fixture runner executes each file sequentially against the same storage and compares results through readable SQL comments.
Query builder tests and direct storage API tests remain in Rust, while ordinary SQL, index, transaction, alter table, dictionary, and metadata cases now use a consistent fixture path.

**File**: `Cargo.lock` (modified, +22/-0)
```diff
@@ -1589,8 +1589,11 @@ dependencies = [
  "chrono",
  "gluesql-core",
  "hex",
+ "include_dir",
+ "paste",
  "pretty_assertions",
  "rust_decimal",
+ "serde",
  "serde_json",
  "uuid",
 ]
@@ -1782,6 +1785,25 @@ dependencies = [
  "version_check",
 ]
 
+[[package]]
+name = "include_dir"
+version = "0.7.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "923d117408f1e49d914f1a379a309cffe4f18c05cf4e3d12e613a15fc81bd0dd"
+dependencies = [
+ "include_dir_macros",
+]
+
+[[package]]
+name = "include_dir_macros"
+version = "0.7.4"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7cab85a7ed0bd5f0e76d93846e0147172bed2e2d3f859bcc33a8d9699cad1a75"
+dependencies = [
+ "proc-macro2",
+ "quote",
+]
+
 [[package]]
 name = "indexmap"
 version = "1.9.3"
```

**File**: `core/src/executor/evaluate/function.rs` (modified, +1/-1)
```diff
@@ -387,7 +387,7 @@ pub fn ifnull<'a>(expr: Evaluated<'a>, then: Evaluated<'a>) -> ControlFlow<Evalu
 }
 
 pub fn nullif<'a>(expr1: Evaluated<'a>, expr2: &Evaluated<'a>) -> ControlFlow<Evaluated<'a>> {
-    Continue(if &expr1 == expr2 {
+    Continue(if expr1.evaluate_eq(expr2).is_true() {
         Evaluated::Value(Cow::Owned(Value::Null))
     } else {
         expr1
```

**File**: `test-suite/Cargo.toml` (modified, +3/-0)
```diff
@@ -14,8 +14,11 @@ bigdecimal = "0.4.10"
 chrono = "0.4.31"
 rust_decimal = "1"
 hex = "0.4"
+include_dir = "0.7"
+paste = "1"
 serde_json = "1.0.91"
 pretty_assertions = "1"
+serde = "1"
 
 [target.'cfg(target_arch = "wasm32")'.dependencies.uuid]
 version = "1"
```

**File**: `test-suite/fixtures/aggregate/avg.sql` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+CREATE TABLE Item (
+    id INTEGER,
+    quantity INTEGER,
+    age INTEGER NULL,
+    total INTEGER
+);
+-- @expect: ok
+
+INSERT INTO Item (id, quantity, age, total) VALUES
+    (1, 10,   11, 1),
+    (2,  0,   90, 2),
+    (3,  9, NULL, 3),
+    (4,  3,    3, 1),
+    (5, 25, NULL, 1);
+-- @expect: ok
+
+SELECT AVG(age) FROM Item
+-- @expect:
+-- | AVG(age) |
+-- | -------- |
+-- | NULL     |
+
+SELECT AVG(id), AVG(quantity) FROM Item
+-- @expect:
+-- | AVG(id): F64 | AVG(quantity): F64 |
+-- | ------------ | ------------------ |
+-- | 3.0          | 9.4                |
+
+SELECT AVG(DISTINCT id) FROM Item
+-- @expect:
+-- | AVG(DISTINCT id): F64 |
+-- | --------------------- |
+-- | 3.0                   |
+
+SELECT AVG(DISTINCT age) FROM Item
+-- @expect:
+-- | AVG(DISTINCT age) |
+-- | ----------------- |
+-- | NULL              |
```

**File**: `test-suite/fixtures/aggregate/count.sql` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+CREATE TABLE Item (
+    id INTEGER,
+    quantity INTEGER NULL,
+    age INTEGER NULL,
+    total INTEGER
+);
+-- @expect: ok
+
+INSERT INTO Item (id, quantity, age, total) VALUES
+    (1, NULL,   11, 1),
+    (2,  0,   90, 2),
+    (3,  9, NULL, 3),
+    (4,  3,    3, 1),
+    (5, 25, NULL, 1),
+    (6, 15,   11, 2),
+    (7, 20,   90, 1),
+    (1, NULL, 11, 1);
+-- @expect: ok
+
+SELECT COUNT(*) FROM Item;
+-- @expect:
+-- | COUNT(*): I64 |
+-- | ------------- |
+-- | 8             |
+
+SELECT COUNT(age), COUNT(quantity) FROM Item;
+-- @expect:
+-- | COUNT(age): I64 | COUNT(quantity): I64 |
+-- | --------------- | -------------------- |
+-- | 6               | 6                    |
+
+SELECT COUNT(NULL);
+-- @expect:
+-- | COUNT(NULL): I64 |
+-- | ---------------- |
+-- | 0                |
+
+SELECT COUNT(DISTINCT id) FROM Item
+-- @expect:
+-- | COUNT(DISTINCT id): I64 |
+-- | ----------------------- |
+-- | 7                       |
+
+SELECT COUNT(DISTINCT age) FROM Item
+-- @expect:
+-- | COUNT(DISTINCT age): I64 |
+-- | ------------------------ |
+-- | 3                        |
+
+SELECT COUNT(age), COUNT(DISTINCT age) FROM Item
+-- @expect:
+-- | COUNT(age): I64 | COUNT(DISTINCT age): I64 |
+-- | --------------- | ------------------------ |
+-- | 6               | 3                        |
+
+SELECT COUNT(DISTINCT *) FROM Item
+-- @expect:
+-- | COUNT(DISTINCT *): I64 |
+-- | ---------------------- |
+-- | 7                      |
+
+CREATE TABLE EmptyItem (id INTEGER NULL);
+-- @expect: ok
+
+SELECT COUNT(*) FROM EmptyItem;
+-- @expect:
+-- | COUNT(*): I64 |
+-- | ------------- |
+-- | 0             |
+
+SELECT COUNT(id) FROM EmptyItem;
+-- @expect:
+-- | COUNT(id): I64 |
+-- | -------------- |
+-- | 0              |
```

**File**: `test-suite/fixtures/aggregate/error.sql` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+CREATE TABLE Item (
+    id INTEGER,
+    quantity INTEGER,
+    age INTEGER NULL,
+    total INTEGER
+);
+-- @expect: ok
+
+INSERT INTO Item (id, quantity, age, total) VALUES
+    (1, 10,   11, 1),
+    (2,  0,   90, 2),
+    (3,  9, NULL, 3),
+    (4,  3,    3, 1),
+    (5, 25, NULL, 1);
+-- @expect: ok
+
+SELECT SUM(num) FROM Item;
+-- @expect: error Evaluate.IdentifierNotFound
+-- @json: "num"
+
+SELECT COUNT(Foo.*) FROM Item;
+-- @expect: error Translate.QualifiedWildcardInCountNotSupported
+-- @json: "Foo.*"
+
+SELECT SUM(*) FROM Item;
+-- @expect: error Translate.WildcardFunctionArgNotAccepted
```

**File**: `test-suite/fixtures/aggregate/expr.sql` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+CREATE TABLE Item (
+    id INTEGER,
+    quantity INTEGER,
+    age INTEGER NULL,
+    total INTEGER
+);
+-- @expect: ok
+
+INSERT INTO Item (id, quantity, age, total) VALUES
+    (1, 10,   11, 1),
+    (2,  0,   90, 2),
+    (3,  9, NULL, 3),
+    (4,  3,    3, 1),
+    (5, 25, NULL, 1);
+-- @expect: ok
+
+-- @name: BETWEEN with aggregates
+SELECT SUM(quantity) BETWEEN MIN(quantity) AND MAX(quantity) AS test FROM Item;
+-- @expect:
+-- | test: Bool |
+-- | ---------- |
+-- | false      |
+
+-- @name: CASE comparing aggregates
+SELECT CASE SUM(quantity) WHEN MIN(quantity) THEN MAX(id) ELSE COUNT(id) END AS test FROM Item;
+-- @expect:
+-- | test: I64 |
+-- | --------- |
+-- | 5         |
+
+-- @name: CASE WHEN with aggregate condition
+SELECT CASE WHEN SUM(quantity) > 30 THEN MAX(id) ELSE MIN(id) END AS test FROM Item;
+-- @expect:
+-- | test: I64 |
+-- | --------- |
+-- | 5         |
+
+-- @name: wrapped aggregate inside scalar function
+SELECT COALESCE(COUNT(*), 0) AS test FROM Item;
+-- @expect:
+-- | test: I64 |
+-- | --------- |
+-- | 5         |
+
+-- @name: aggregate inside is null predicate
+SELECT SUM(age) IS NULL AS test FROM Item;
+-- @expect:
+-- | test: Bool |
+-- | ---------- |
+-- | true       |
```

**File**: `test-suite/fixtures/aggregate/group_by.sql` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+CREATE TABLE Item (
+    id INTEGER,
+    quantity INTEGER NULL,
+    city TEXT,
+    ratio FLOAT
+);
+-- @expect: ok
+
+INSERT INTO Item (id, quantity, city, ratio) VALUES
+    (1,   10,   'Seoul',  0.2),
+    (2,    0,   'Dhaka', 6.11),
+    (3, NULL, 'Beijing',  1.1),
+    (3,   30, 'Daejeon',  0.2),
+    (4,   11,   'Seoul',  1.1),
+    (5,   24, 'Seattle', 6.11);
+-- @expect: ok
+
+SELECT id, COUNT(*) FROM Item GROUP BY id
+-- @expect:
+-- | id: I64 | COUNT(*): I64 |
+-- | ------- | ------------- |
+-- | 1       | 1             |
+-- | 2       | 1             |
+-- | 3       | 2             |
+-- | 4       | 1             |
+-- | 5       | 1             |
+
+SELECT id FROM Item GROUP BY id
+-- @expect:
+-- | id: I64 |
+-- | ------- |
+-- | 1       |
+-- | 2       |
+-- | 3       |
+-- | 4       |
+-- | 5       |
+
+SELECT SUM(quantity), COUNT(*), city FROM Item GROUP BY city
+-- @expect:
+-- | SUM(quantity): I64 | COUNT(*): I64 | city: Str |
+-- | ------------------ | ------------- | --------- |
+-- | 21                 | 2             | "Seoul"   |
+-- | 0                  | 1             | "Dhaka"   |
+-- | NULL               | 1             | "Beijing" |
+-- | 30                 | 1             | "Daejeon" |
+-- | 24                 | 1             | "Seattle" |
+
+SELECT id, city FROM Item GROUP BY city
+-- @expect:
+-- | id: I64 | city: Str |
+-- | ------- | --------- |
+-- | 1       | "Seoul"   |
+-- | 2       | "Dhaka"   |
+-- | 3       | "Beijing" |
+-- | 3       | "Daejeon" |
+-- | 5       | "Seattle" |
+
+SELECT ratio, COUNT(*) FROM Item GROUP BY ratio
+-- @expect:
+-- | ratio: F64 | COUNT(*): I64 |
+-- | ---------- | ------------- |
+-- | 0.2        | 2             |
+-- | 6.11       | 2             |
+-- | 1.1        | 2             |
+
+SELECT ratio FROM Item GROUP BY id, city
+-- @expect:
+-- | ratio: F64 |
+-- | ---------- |
+-- | 0.2        |
+-- | 6.11       |
+-- | 1.1        |
+-- | 0.2        |
+-- | 1.1        |
+-- | 6.11       |
+
+SELECT id, ratio FROM Item GROUP BY id, city HAVING ratio > 6
+-- @expect:
+-- | id: I64 | ratio: F64 |
+-- | ------- | ---------- |
+-- | 2       | 6.11       |
+-- | 5       | 6.11       |
+
+SELECT SUM(quantity), COUNT(*), city FROM Item GROUP BY city HAVING COUNT(*) > 1
+-- @expect:
+-- | SUM(quantity): I64 | COUNT(*): I64 | city: Str |
+-- | ------------------ | ------------- | --------- |
+-- | 21                 | 2             | "Seoul"   |
+
+SELECT city FROM Item GROUP BY city HAVING COALESCE(COUNT(*), 0) > 1
+-- @expect:
+-- | city: Str |
+-- | --------- |
+-- | "Seoul"   |
+
+CREATE TABLE Sub (id INTEGER);
+-- @expect: ok
+
+INSERT INTO Sub VALUES (101), (102), (103), (104), (105);
+-- @expect: ok
+
+-- @name: HAVING - nested select context handling edge case
+SELECT id
+FROM Sub
+WHERE (id - 100) IN (
+    SELECT id
+    FROM Item
+    GROUP BY id
+    HAVING id <= 3
+)
+-- @expect:
+-- | id: I64 |
+-- | ------- |
+-- | 101     |
+-- | 102     |
+-- | 103     |
```

---

### Incident Patch 11: `75eeef42` (2026-07-14)
**Commit Message**: Fix primary key predicate planning for joins (#1943)

Restrict primary key lookup optimization to predicates that can be safely bound to the first FROM relation.

Move lookup eligibility out of the shared planner context into a planner-local candidate.
Resolve relation and positional column aliases, reject ambiguous joined-column matches,
and preserve the original WHERE predicate when a primary key access path cannot be installed safely.

Add planner unit coverage for qualified and unqualified predicates, different primary key names,
missing primary keys, alias conflicts, multiple joins, and left outer joins.

**File**: `core/src/plan/context.rs` (modified, +1/-24)
```diff
@@ -4,7 +4,6 @@ pub enum Context<'a> {
     Data {
         alias: String,
         columns: Vec<&'a str>,
-        primary_key: Option<&'a str>,
         next: Option<Rc<Context<'a>>>,
     },
     Bridge {
@@ -14,16 +13,10 @@ pub enum Context<'a> {
 }
 
 impl<'a> Context<'a> {
-    pub fn new(
-        alias: String,
-        columns: Vec<&'a str>,
-        primary_key: Option<&'a str>,
-        next: Option<Rc<Context<'a>>>,
-    ) -> Self {
+    pub fn new(alias: String, columns: Vec<&'a str>, next: Option<Rc<Context<'a>>>) -> Self {
         Context::Data {
             alias,
             columns,
-            primary_key,
             next,
         }
     }
@@ -77,20 +70,4 @@ impl<'a> Context<'a> {
             }
         }
     }
-
-    pub fn contains_primary_key(&self, target_column: &str) -> bool {
-        match self {
-            Self::Data {
-                primary_key: Some(primary_key),
-                ..
-            } if primary_key == &target_column => true,
-            Self::Data { next, .. } => next
-                .as_ref()
-                .is_some_and(|next| next.contains_primary_key(target_column)),
-            Self::Bridge { left, right } => {
-                left.contains_primary_key(target_column)
-                    || right.contains_primary_key(target_column)
-            }
-        }
-    }
 }
```

**File**: `core/src/plan/expr/evaluable.rs` (modified, +2/-4)
```diff
@@ -172,18 +172,16 @@ mod tests {
     #[test]
     fn evaluable() {
         let context = {
-            let left_child = Context::new("Empty".to_owned(), Vec::new(), None, None);
+            let left_child = Context::new("Empty".to_owned(), Vec::new(), None);
             let left = Context::new(
                 "Foo".to_owned(),
                 vec!["id", "name"],
-                None,
                 Some(Rc::new(left_child)),
             );
-            let right_child = Context::new("Src".to_owned(), Vec::new(), None, None);
+            let right_child = Context::new("Src".to_owned(), Vec::new(), None);
             let right = Context::new(
                 "Bar".to_owned(),
                 vec!["id", "rate"],
-                None,
                 Some(Rc::new(right_child)),
             );
 
```

**File**: `core/src/plan/planner.rs` (modified, +2/-13)
```diff
@@ -1,7 +1,7 @@
 use {
     super::context::Context,
     crate::{
-        ast::{ColumnDef, ColumnUniqueOption},
+        ast::ColumnDef,
         data::Schema,
         plan::{ExprPlan, FunctionPlan, QueryPlan, TableAliasPlan, TableFactorPlan},
     },
@@ -227,18 +227,7 @@ pub trait Planner<'a> {
             .map(|ColumnDef { name, .. }| name.as_str())
             .collect::<Vec<_>>();
 
-        let primary_key = column_defs
-            .iter()
-            .find_map(|ColumnDef { name, unique, .. }| {
-                (unique == &Some(ColumnUniqueOption { is_primary: true })).then_some(name.as_str())
-            });
-
-        let context = Context::new(
-            alias.unwrap_or_else(|| name.to_owned()),
-            columns,
-            primary_key,
-            next,
-        );
+        let context = Context::new(alias.unwrap_or_else(|| name.to_owned()), columns, next);
         Some(Rc::new(context))
     }
 }
```

**File**: `core/src/plan/primary_key.rs` (modified, +256/-28)
```diff
@@ -1,4 +1,5 @@
 use {
+    self::lookup::PrimaryKeyLookupCandidate,
     super::{context::Context, planner::Planner},
     crate::{
         ast::BinaryOperator,
@@ -11,6 +12,8 @@ use {
     std::{collections::HashMap, hash::BuildHasher, rc::Rc},
 };
 
+mod lookup;
+
 pub fn plan<S: BuildHasher>(
     schema_map: &HashMap<String, Schema, S>,
     statement: StatementPlan,
@@ -60,18 +63,26 @@ enum PrimaryKey {
 
 impl<'a, S: BuildHasher> PrimaryKeyPlanner<'a, S> {
     fn select(&self, outer_context: Option<Rc<Context<'a>>>, select: SelectPlan) -> SelectPlan {
-        let current_context = self.update_context(None, &select.from.relation);
+        let first_relation_context = self.update_context(None, &select.from.relation);
+        let lookup_candidate = PrimaryKeyLookupCandidate::new(self.schema_map, &select.from);
         let current_context = select
             .from
             .joins
             .iter()
-            .fold(current_context, |context, join| {
+            .fold(first_relation_context, |context, join| {
                 self.update_context(context, &join.relation)
             });
 
         let (index, selection) = select
             .selection
-            .map(|expr| self.expr(outer_context, current_context, expr))
+            .map(|expr| {
+                self.expr(
+                    outer_context,
+                    current_context,
+                    lookup_candidate.as_ref(),
+                    expr,
+                )
+            })
             .map_or((None, None), |primary_key| match primary_key {
                 PrimaryKey::Found { index_item, expr } => (Some(index_item), expr),
                 PrimaryKey::NotFound(expr) => (None, Some(expr)),
@@ -105,19 +116,9 @@ impl<'a, S: BuildHasher> PrimaryKeyPlanner<'a, S> {
         &self,
         outer_context: Option<Rc<Context<'a>>>,
         current_context: Option<Rc<Context<'a>>>,
+        lookup_candidate: Option<&PrimaryKeyLookupCandidate>,
         expr: ExprPlan,
     ) -> PrimaryKey {
-        let check_primary_key = |key: &ExprPlan| {
-            let (ExprPlan::Identifier(key) | ExprPlan::CompoundIdentifier { ident: key, .. }) = key
-            else {
-                return false;
-            };
-
-            current_context
-                .as_ref()
-                .is_some_and(|context| context.contains_primary_key(key))
-        };
-
         match expr {
             ExprPlan::BinaryOp {
                 left: key,
@@ -128,8 +129,7 @@ impl<'a, S: BuildHasher> PrimaryKeyPlanner<'a, S> {
                 left: value,
                 op: BinaryOperator::Eq,
                 right: key,
-            } if check_primary_key(key.as_ref())
-                && check_evaluable(current_context.as_ref().map(Rc::clone), &key)
+            } if lookup_candidate.is_some_and(|candidate| candidate.contains(key.as_ref()))
                 && check_evaluable(None, &value) =>
             {
                 let index_item = IndexItemPlan::PrimaryKey(*value);
@@ -147,6 +147,7 @@ impl<'a, S: BuildHasher> PrimaryKeyPlanner<'a, S> {
                 let primary_key = self.expr(
                     outer_context.as_ref().map(Rc::clone),
                     current_context.as_ref().map(Rc::clone),
+                    lookup_candidate,
                     *left,
                 );
 
@@ -169,7 +170,7 @@ impl<'a, S: BuildHasher> PrimaryKeyPlanner<'a, S> {
                     PrimaryKey::NotFound(expr) => expr,
                 };
 
-                match self.expr(outer_context, current_context, *right) {
+                match self.expr(outer_context, current_context, lookup_candidate, *right) {
                     PrimaryKey::Found { index_item, expr } => {
                         let expr = match expr {
                             Some(right) => ExprPlan::BinaryOp {
@@ -196,16 +197,18 @@ impl<'a, S: BuildHasher> PrimaryKeyPlanner<'a, S> {
                     }
                 }
             }
-            ExprPlan::Nested(expr) => match self.expr(outer_context, current_context, *expr) {
-                PrimaryKey::Found { index_item, expr } => {
-                    let expr = expr.map(Box::new).map(ExprPlan::Nested);
+            ExprPlan::Nested(expr) => {
+                match self.expr(outer_context, current_context, lookup_candidate, *expr) {
+                    PrimaryKey::Found { index_item, expr } => {
+                        let expr = expr.map(Box::new).map(ExprPlan::Nested);
 
-                    PrimaryKey::Found { index_item, expr }
-                }
-                PrimaryKey::NotFound(expr) => {
-                    PrimaryKey::NotFound(ExprPlan::Nested(Box::new(expr)))
+                        PrimaryKey::Found { index_item, expr }
+                    }
+                    PrimaryKey::NotFound(expr) => {
+                        PrimaryKey::NotFound(ExprPlan::Nested(Box::new(expr)))
+                    }
                 }
-            },
+            }
             _ => {
      
```

**File**: `core/src/plan/primary_key/lookup.rs` (added, +407/-0)
```diff
@@ -0,0 +1,407 @@
+use {
+    crate::{
+        ast::{ColumnDef, ColumnUniqueOption},
+        data::Schema,
+        plan::{ExprPlan, JoinOperatorPlan, TableAliasPlan, TableFactorPlan, TableWithJoinsPlan},
+    },
+    std::{collections::HashMap, hash::BuildHasher},
+};
+
+pub(super) struct PrimaryKeyLookupCandidate {
+    target: PrimaryKeyLookupTarget,
+    joined_relations: Vec<JoinedRelation>,
+}
+
+impl PrimaryKeyLookupCandidate {
+    pub(super) fn new<S: BuildHasher>(
+        schema_map: &HashMap<String, Schema, S>,
+        from: &TableWithJoinsPlan,
+    ) -> Option<Self> {
+        from.joins
+            .iter()
+            .for_each(|join| validate_join_operator(&join.join_operator));
+
+        let target = PrimaryKeyLookupTarget::new(schema_map, &from.relation)?;
+        let joined_relations = from
+            .joins
+            .iter()
+            .map(|join| JoinedRelation::new(schema_map, &join.relation))
+            .collect();
+
+        Some(Self {
+            target,
+            joined_relations,
+        })
+    }
+
+    pub(super) fn contains(&self, key: &ExprPlan) -> bool {
+        match key {
+            ExprPlan::Identifier(column) => {
+                self.target.primary_key_column == *column
+                    && self
+                        .joined_relations
+                        .iter()
+                        .all(|relation| !relation.contains_column(column))
+            }
+            ExprPlan::CompoundIdentifier { alias, ident } => {
+                self.target.matches(alias, ident)
+                    && self
+                        .joined_relations
+                        .iter()
+                        .all(|relation| !relation.contains_aliased_column(alias, ident))
+            }
+            _ => false,
+        }
+    }
+}
+
+fn validate_join_operator(join_operator: &JoinOperatorPlan) {
+    // Keep this exhaustive so new join types require an explicit lookup-safety decision.
+    match join_operator {
+        JoinOperatorPlan::Inner(_) | JoinOperatorPlan::LeftOuter(_) => {}
+    }
+}
+
+struct PrimaryKeyLookupTarget {
+    alias: String,
+    primary_key_column: String,
+}
+
+impl PrimaryKeyLookupTarget {
+    fn new<S: BuildHasher>(
+        schema_map: &HashMap<String, Schema, S>,
+        relation: &TableFactorPlan,
+    ) -> Option<Self> {
+        let TableFactorPlan::Table {
+            name,
+            alias,
+            index: None,
+        } = relation
+        else {
+            return None;
+        };
+        let column_defs = schema_map.get(name)?.column_defs.as_ref()?;
+        let primary_key_index = column_defs.iter().position(|ColumnDef { unique, .. }| {
+            unique == &Some(ColumnUniqueOption { is_primary: true })
+        })?;
+        let columns = effective_columns(column_defs, alias.as_ref())?;
+        let primary_key_column = columns.get(primary_key_index)?;
+        if columns
+            .iter()
+            .position(|column| column == primary_key_column)
+            != Some(primary_key_index)
+        {
+            return None;
+        }
+
+        Some(Self {
+            alias: relation.alias_name().to_owned(),
+            primary_key_column: primary_key_column.clone(),
+        })
+    }
+
+    fn matches(&self, alias: &str, column: &str) -> bool {
+        self.alias == alias && self.primary_key_column == column
+    }
+}
+
+struct JoinedRelation {
+    alias: String,
+    columns: RelationColumns,
+}
+
+impl JoinedRelation {
+    fn new<S: BuildHasher>(
+        schema_map: &HashMap<String, Schema, S>,
+        relation: &TableFactorPlan,
+    ) -> Self {
+        let columns = match relation {
+            TableFactorPlan::Table { name, alias, .. } => schema_map
+                .get(name)
+                .and_then(|schema| schema.column_defs.as_deref())
+                .and_then(|column_defs| effective_columns(column_defs, alias.as_ref()))
+                .map_or(RelationColumns::Unknown, RelationColumns::Known),
+            TableFactorPlan::Derived { .. }
+            | TableFactorPlan::Series { .. }
+            | TableFactorPlan::Dictionary { .. } => RelationColumns::Unknown,
+        };
+
+        Self {
+            alias: relation.alias_name().to_owned(),
+            columns,
+        }
+    }
+
+    fn contains_column(&self, target: &str) -> bool {
+        match &self.columns {
+            RelationColumns::Known(columns) => columns.iter().any(|column| column == target),
+            RelationColumns::Unknown => true,
+        }
+    }
+
+    fn contains_aliased_column(&self, target_alias: &str, target_column: &str) -> bool {
+        self.alias == target_alias && self.contains_column(target_column)
+    }
+}
+
+enum RelationColumns {
+    Known(Vec<String>),
+    Unknown,
+}
+
+fn effective_columns(
+    column_defs: &[ColumnDef],
+    alias: Option<&TableAliasPlan>,
+) -> Option<Vec<String>> {
+    let mut columns = column_defs
+        .iter()
+        .map(|column_def| c
```

---

### Incident Patch 12: `9bb7c77a` (2026-07-13)
**Commit Message**: Update Rust getting started guide (#1940)

Updated Rust installation examples to use GlueSQL version 0.19.0.
Expanded the list of available storage features, including Parquet, CSV, MongoDB, Redis, file-system, Git, and composite storage options.

**File**: `docs/docs/getting-started/rust.md` (modified, +8/-2)
```diff
@@ -8,7 +8,7 @@ To install and use GlueSQL in your Rust project, you'll first need to add it as
 
 ```toml
 [dependencies]
-gluesql = "0.16"
+gluesql = "0.19.0"
 ```
 
 By default, all available storage features are included with GlueSQL. Here's a list of the available features:
@@ -18,13 +18,19 @@ By default, all available storage features are included with GlueSQL. Here's a l
 - `gluesql_memory_storage` - Simple in-memory storage
 - `gluesql-shared-memory-storage` - A wrapper around memory-storage for easy use in multi-threaded environments
 - `gluesql-json-storage` - Storage that allows you to analyze and modify JSON or JSONL files using SQL
+- `gluesql-parquet-storage` - Storage for querying Parquet files
+- `gluesql-csv-storage` - Storage for querying CSV files
 - `gluesql-composite-storage` - A storage feature that enables joining and processing data from multiple storage types simultaneously
+- `gluesql-mongo-storage` - Storage backed by MongoDB
+- `gluesql-redis-storage` - Storage backed by Redis
+- `gluesql-file-storage` - Storage backed by files on the local filesystem
+- `gluesql-git-storage` - Git-backed storage with version history
 
 If you don't need all the default storage features, you can disable them and select only the ones you require. To do this, update your `Cargo.toml` file with the following lines:
 
 ```toml
 [dependencies.gluesql]
-version = "0.16"
+version = "0.19.0"
 default-features = false
 features = ["gluesql_memory_storage", "gluesql-json-storage"]
 ```
```

---

### Incident Patch 13: `ad0f9c35` (2026-06-23)
**Commit Message**: Fix outdated Rust docs examples for sync execution (#1934)

This updates README, Query Builder, custom storage, and supported storage examples to use the current sync Rust APIs while keeping JavaScript and Web async examples unchanged.

**File**: `README.md` (modified, +1/-3)
```diff
@@ -41,7 +41,6 @@ let mut glue = Glue::new(storage);
 
 let rows = glue
     .execute("SELECT id, name FROM Foo;")
-    .await
     .rows_as::<Row>()
     .unwrap();
 ```
@@ -62,8 +61,7 @@ table("Foo")
     // Filter by price using Query Builder methods
     .filter(col("price").gt(100))
     .project("id, name")
-    .execute(&mut glue)
-    .await;
+    .execute(&mut glue);
 ```
 
 ## Supporting Structured and Unstructured Data with Schema Flexibility
```

**File**: `docs/docs/articles/breaking-the-boundary-between-sql-and-nosql.md` (modified, +4/-7)
```diff
@@ -41,22 +41,20 @@ table("Glue")
     .create_table()
     .add_column("id INTEGER")
     .add_column("name TEXT")
-    .execute(glue)
+    .execute(glue);
 
 table("Glue")
     .insert()
     .values(vec![
         vec![num(1), text("hello")],
         vec![num(2), text("gluesql")],
     ])
-    .execute(glue)
-    .await;
+    .execute(glue);
 
 table("Glue")
     .select()
     .filter(col("id").eq(1))
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 Let's reconsider the implicit distinction between SQL and NoSQL. GlueSQL indeed supports SQL, but it also officially develops and offers its own query builder. This query builder is not a secondary tool for SQL. While most SQL query builder libraries ultimately generate SQL strings, GlueSQL's builder directly creates execution-facing statement plans, with explicit AST outputs still available where needed. Hence, we call it the Query Builder. This means SQL and the Query Builder are two equally supported interfaces in GlueSQL.
@@ -70,8 +68,7 @@ table("Glue")
     .filter(col("id").eq(1))
     // 2.
     .filter("id = 1")
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 Because GlueSQL already supports SQL, not only can you use the custom interface in the Query Builder, but you can also use familiar SQL syntax in part. Whether you use `col("id").eq(1)` or `"id = 1"`, you can use it in the way you prefer. The Query Builder interface, although initially unfamiliar, allows a gradual migration similar to writing SQL for your convenience.
```

**File**: `docs/docs/index.md` (modified, +1/-2)
```diff
@@ -39,8 +39,7 @@ table("Foo")
     // Filter by price using Query Builder methods
     .filter(col("price").gt(100))
     .project("id, name")
-    .execute(glue)
-    .await;
+    .execute(&mut glue);
 ```
 
 ## Supporting Structured and Unstructured Data with Schema Flexibility
```

**File**: `docs/docs/query-builder/expressions/pattern-matching.md` (modified, +4/-8)
```diff
@@ -21,8 +21,7 @@ let actual = table("Category")
             .like(text("D%"))
             .or(col("name").like(text("M___"))),
     )
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 In this example, the query will return all rows from the `Category` table where the `name` column starts with "D" or where the `name` is exactly four characters long and starts with "M".
@@ -41,8 +40,7 @@ let actual = table("Category")
             .ilike(text("D%"))
             .or(col("name").ilike(text("M___"))),
     )
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 In this example, the query will return all rows from the `Category` table where the `name` column starts with "D" or "d", or where the `name` is exactly four characters long and starts with "M" or "m".
@@ -61,8 +59,7 @@ let actual = table("Category")
             .not_like(text("D%"))
             .and(col("name").not_like(text("M___"))),
     )
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 In this example, the query will return all rows from the `Category` table where the `name` column does not start with "D" and the `name` is not exactly four characters long and does not start with "M".
@@ -81,8 +78,7 @@ let actual = table("Category")
             .not_ilike(text("D%"))
             .and(col("name").not_ilike(text("M___"))),
     )
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 In this example, the query will return all rows from the `Category` table where the `name` column does not start with "D" or "d", and the `name` is not exactly four characters long and does not start with "M" or "m".
```

**File**: `docs/docs/query-builder/functions/date-&-time/conversion.md` (modified, +3/-6)
```diff
@@ -17,8 +17,7 @@ let actual = table("Visitor")
     .project("name")
     .project(col("visit_date").to_date("'%Y-%m-%d'"))  // Method 1: Calling the to_date method on a column
     .project(to_date("visit_date", "'%Y-%m-%d'"))  // Method 2: Using the to_date function directly
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 ## Time Conversion - to_time
@@ -34,8 +33,7 @@ let actual = table("Visitor")
     .project("name")
     .project(col("visit_time").to_time("'%H:%M:%S'"))  // Method 1: Calling the to_time method on a column
     .project(to_time("visit_time", "'%H:%M:%S'"))  // Method 2: Using the to_time function directly
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 ## Timestamp Conversion - to_timestamp
@@ -51,6 +49,5 @@ let actual = table("Visitor")
     .project("name")
     .project(col("visit_time_stamp").to_timestamp("'%Y-%m-%d %H:%M:%S'"))  // Method 1: Calling the to_timestamp method on a column
     .project(to_timestamp("visit_time_stamp", "'%Y-%m-%d %H:%M:%S'"))  // Method 2: Using the to_timestamp function directly
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
```

**File**: `docs/docs/query-builder/functions/date-&-time/current-date-and-time.md` (modified, +2/-4)
```diff
@@ -11,8 +11,7 @@ let actual = table("Record")
     .select()
     .filter(col("time_stamp").gt(now()))  // select rows where "time_stamp" is later than current time
     .project("id, time_stamp")
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 In the above example, the `filter` method uses `now` to select rows where the "time_stamp" column is later than the current time.
@@ -27,7 +26,6 @@ let actual = table("Record")
         "2, NOW()",  // Inserts the current time
         "3, '9999-12-31T23:59:40.364832862'",
     ])
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 In the example above, the "time_stamp" column for the row with id 2 is set to the current time at the moment of insertion.
```

**File**: `docs/docs/query-builder/functions/date-&-time/formatting.md` (modified, +3/-6)
```diff
@@ -15,8 +15,7 @@ let actual = table("Visitor")
     .project("visit_date")
     .project(col("visit_date").format(text("%Y-%m")))  // Formats the visit_date to the year-month format
     .project(format(col("visit_date"), text("%m")))  // Formats the visit_date to the month format
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 ## Formatting Time
@@ -30,8 +29,7 @@ let actual = table("Visitor")
     .project("visit_time")
     .project(col("visit_time").format(text("%H:%M:%S")))  // Formats the visit_time to the hour-minute-second format
     .project(format(col("visit_time"), text("%M:%S")))  // Formats the visit_time to the minute-second format
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 ## Formatting Timestamp
@@ -45,7 +43,6 @@ let actual = table("Visitor")
     .project("visit_timestamp")
     .project(col("visit_timestamp").format(text("%Y-%m-%d %H:%M:%S")))  // Formats the visit_timestamp to the year-month-date hour-minute-second format
     .project(format(col("visit_timestamp"), text("%Y-%m-%d %H:%M:%S")))  // Formats the visit_timestamp to the year-month-date hour-minute-second format
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
```

**File**: `docs/docs/query-builder/functions/math/basic-arithmetic.md` (modified, +5/-10)
```diff
@@ -15,8 +15,7 @@ let actual = values(vec!["0, 0", "1, -3", "2, 4", "3, -29"])
     .project("column1")
     .project(abs("column2"))  // Takes the absolute value of column2
     .project(col("column2").abs())  // Takes the absolute value of column2
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 ## Division - DIV
@@ -29,8 +28,7 @@ let actual = table("Number")
     .project("id")
     .project(divide("number", 3))  // Divides the number by 3
     .project(divide(col("number"), 3))  // Divides the number by 3
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 ## Modulo - MOD
@@ -43,8 +41,7 @@ let actual = table("Number")
     .project("id")
     .project(modulo("number", 4))  // Gets the remainder of number divided by 4
     .project(modulo(col("number"), 4))  // Gets the remainder of number divided by 4
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 ## Greatest Common Divisor - GCD
@@ -57,8 +54,7 @@ let actual = table("Number")
     .project("id")
     .project(gcd("number", 12))  // Gets the GCD of number and 12
     .project(gcd(col("number"), 12))  // Gets the GCD of number and 12
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
 
 ## Least Common Multiple - LCM
@@ -71,6 +67,5 @@ let actual = table("Number")
     .project("id")
     .project(lcm("number", 3))  // Gets the LCM of number and 3
     .project(lcm(col("number"), 3))  // Gets the LCM of number and 3
-    .execute(glue)
-    .await;
+    .execute(glue);
 ```
```

---

### Incident Patch 14: `1fcca767` (2026-06-21)
**Commit Message**: Rename ast_builder API to query_builder (#1933)

Replace public ast_builder module paths with query_builder.
Rename builder error types and result variants to QueryBuilder.
Update tests, examples, docs paths, and docs wording for StatementPlan output.

**File**: `.github/workflows/rust.yml` (modified, +1/-1)
```diff
@@ -137,5 +137,5 @@ jobs:
           cargo run --package gluesql --example memory_storage_usage
           cargo run --package gluesql --example sled_multi_threaded
           cargo run --package gluesql --example using_config
-          cargo run --package gluesql --example hello_ast_builder
+          cargo run --package gluesql --example hello_query_builder
           cargo run --package gluesql --example parameter_binding
```

**File**: `README.md` (modified, +7/-7)
```diff
@@ -9,7 +9,7 @@
 
 ## Multi-Model Database Engine as a Library
 
-GlueSQL is a Rust library for SQL databases that includes a parser ([sqlparser-rs](https://github.com/sqlparser-rs/sqlparser-rs)), an execution layer, and a variety of storage options, both persistent and non-persistent, all in one package. It is a versatile tool for developers, supporting both SQL and its own query builder (AST Builder). GlueSQL can handle structured and unstructured data, making it suitable for a wide range of use cases. It is portable and can be used with various storage types, including log files and read-write capable storage. GlueSQL is designed to be extensible and supports custom planners, making it a powerful tool for developers who need SQL support for their databases or services.
+GlueSQL is a Rust library for SQL databases that includes a parser ([sqlparser-rs](https://github.com/sqlparser-rs/sqlparser-rs)), an execution layer, and a variety of storage options, both persistent and non-persistent, all in one package. It is a versatile tool for developers, supporting both SQL and Query Builder. GlueSQL can handle structured and unstructured data, making it suitable for a wide range of use cases. It is portable and can be used with various storage types, including log files and read-write capable storage. GlueSQL is designed to be extensible and supports custom planners, making it a powerful tool for developers who need SQL support for their databases or services.
 
 For more information on how to use GlueSQL, please refer to the [**official documentation website**](https://gluesql.org/docs). The documentation provides detailed information on how to install and use GlueSQL, as well as examples and tutorials on how to create custom storage systems and perform SQL operations.
 
@@ -21,9 +21,9 @@ If you're interested in learning more about GlueSQL, we recommend the following
 2. [Revolutionizing Databases by Unifying Query Interfaces](https://gluesql.org/docs/dev/articles/revolutionizing-databases-by-unifying-query-interfaces)
 3. [Test-Driven Documentation - Automating User Manual Creation](https://gluesql.org/docs/dev/articles/test-driven-documentation)
 
-## Supporting SQL and AST Builder
+## Supporting SQL and Query Builder
 
-GlueSQL supports both SQL and its own query builder (AST Builder). Unlike other ORMs, GlueSQL's AST Builder allows developers to build queries directly with GlueSQL's AST, enabling the use of all of GlueSQL's features. This is why we named it AST Builder instead of Query Builder.
+GlueSQL supports both SQL and Query Builder. Unlike ORMs that generate SQL strings, GlueSQL's Query Builder constructs execution-facing statement plans directly while still allowing explicit AST outputs where they are needed. This keeps access to GlueSQL-specific query features without routing every query through SQL text generation.
 
 ### [Rust Example](./pkg/rust/examples/hello_world.rs)
 
@@ -52,14 +52,14 @@ let rows = glue
 SELECT id, name FROM Foo WHERE name = 'Lemon' AND price > 100
 ```
 
-### AST Builder Example
+### Query Builder Example
 
 ```rust
 table("Foo")
     .select()
     // Filter by name using a SQL string
     .filter("name = 'Lemon'")
-    // Filter by price using AST Builder methods
+    // Filter by price using Query Builder methods
     .filter(col("price").gt(100))
     .project("id, name")
     .execute(&mut glue)
@@ -113,7 +113,7 @@ Redb Storage leverages the [redb](https://docs.rs/redb) embedded database for pe
 
 ### JSON Storage
 
-With GlueSQL, you can use JSONL or JSON files as a database that supports SQL and AST Builder, making it a powerful option for developers who need to work with JSON data. JSON Storage is a storage system that uses two types of files: a schema file (optional) and a data file. The schema file is written in Standard SQL and stores the structure of the table, while the data file contains the actual data and supports two file formats: `*.json` and `*.jsonl`. JSON Storage supports all DML features, but is particularly specialized for SELECT and INSERT.
+With GlueSQL, you can use JSONL or JSON files as a database that supports SQL and Query Builder, making it a powerful option for developers who need to work with JSON data. JSON Storage is a storage system that uses two types of files: a schema file (optional) and a data file. The schema file is written in Standard SQL and stores the structure of the table, while the data file contains the actual data and supports two file formats: `*.json` and `*.jsonl`. JSON Storage supports all DML features, but is particularly specialized for SELECT and INSERT.
 
 ### CSV Storage
 
@@ -150,7 +150,7 @@ If you want to support additional features, such as schema changes, transactions
 
 To make it even easier to develop custom storages, GlueSQL provides a Test Suite that allows you to test your storage implementation against a set of standard SQL queries. This ensures that your storage system is compatible with GlueSQL and can ha
```

**File**: `core/src/lib.rs` (modified, +1/-1)
```diff
@@ -8,11 +8,11 @@ mod mock;
 mod result;
 
 pub mod ast;
-pub mod ast_builder;
 pub mod data;
 pub mod executor;
 pub mod parse_sql;
 pub mod plan;
+pub mod query_builder;
 pub mod row_conversion;
 pub mod store;
 pub mod translate;
```

**File**: `core/src/plan/index.rs` (modified, +3/-3)
```diff
@@ -442,12 +442,12 @@ mod tests {
     use {
         super::plan,
         crate::{
-            ast_builder::{
-                Build, col, exists, nested, non_clustered, null, num, primary_key, table, text,
-            },
             mock::{MockStorage, run},
             parse_sql::parse,
             plan::{StatementPlan, fetch_schema_map},
+            query_builder::{
+                Build, col, exists, nested, non_clustered, null, num, primary_key, table, text,
+            },
             result::{Error, Result},
             translate::translate,
         },
```

**File**: `core/src/plan/join.rs` (modified, +1/-1)
```diff
@@ -362,10 +362,10 @@ mod tests {
         super::plan,
         crate::{
             ast::DateTimeField,
-            ast_builder::{Build, QueryNode, col, exists, num, subquery, table},
             mock::{MockStorage, run},
             parse_sql::parse,
             plan::{StatementPlan, fetch_schema_map},
+            query_builder::{Build, QueryNode, col, exists, num, subquery, table},
             translate::translate,
         },
     };
```

**File**: `core/src/plan/primary_key.rs` (modified, +1/-1)
```diff
@@ -225,10 +225,10 @@ mod tests {
                 BinaryOperator, Expr, Join, JoinConstraint, JoinOperator, Literal, Projection,
                 Query, Select, SelectItem, SetExpr, Statement, TableFactor, TableWithJoins, Values,
             },
-            ast_builder::{Build, col, primary_key, table},
             mock::{MockStorage, run},
             parse_sql::{parse, parse_expr},
             plan::{StatementPlan, fetch_schema_map},
+            query_builder::{Build, col, primary_key, table},
             translate::{NO_PARAMS, translate, translate_expr},
         },
     };
```

**File**: `core/src/query_builder.rs` (renamed, +6/-4)
```diff
@@ -55,7 +55,7 @@ pub use {
     data_type::DataTypeNode,
     delete::DeleteNode,
     drop_table::DropTableNode,
-    error::AstBuilderError,
+    error::QueryBuilderError,
     execute::Execute,
     expr_list::ExprList,
     expr_with_alias::ExprWithAliasNode,
@@ -91,7 +91,7 @@ fn test(actual: &crate::result::Result<crate::plan::StatementPlan>, expected: &s
 }
 
 #[cfg(test)]
-fn test_expr(actual: crate::ast_builder::ExprNode, expected: &str) {
+fn test_expr(actual: crate::query_builder::ExprNode, expected: &str) {
     use crate::{
         parse_sql::parse_expr,
         plan::ExprPlan,
@@ -106,7 +106,7 @@ fn test_expr(actual: crate::ast_builder::ExprNode, expected: &str) {
 }
 
 #[cfg(test)]
-fn test_query(actual: crate::ast_builder::QueryNode, expected: &str) {
+fn test_query(actual: crate::query_builder::QueryNode, expected: &str) {
     use crate::{
         parse_sql::parse_query,
         plan::QueryPlan,
@@ -123,7 +123,9 @@ fn test_query(actual: crate::ast_builder::QueryNode, expected: &str) {
 #[cfg(test)]
 fn test_query_builder<T>(actual: T, expected: &str)
 where
-    T: crate::ast_builder::select::BuildQuery + crate::ast_builder::select::BuildQueryPlan + Clone,
+    T: crate::query_builder::select::BuildQuery
+        + crate::query_builder::select::BuildQueryPlan
+        + Clone,
 {
     use crate::{
         parse_sql::parse_query,
```

**File**: `core/src/query_builder/alter_table.rs` (renamed, +2/-2)
```diff
@@ -2,8 +2,8 @@ use {
     super::Build,
     crate::{
         ast::{AlterTableOperation, Statement},
-        ast_builder::ColumnDefNode,
         plan::StatementPlan,
+        query_builder::ColumnDefNode,
         result::Result,
     },
 };
@@ -139,7 +139,7 @@ impl Build for RenameTableNode {
 
 #[cfg(test)]
 mod tests {
-    use crate::ast_builder::{Build, table, test};
+    use crate::query_builder::{Build, table, test};
 
     #[test]
     fn alter_table() {
```

---

### Incident Patch 15: `d85a61c2` (2026-06-21)
**Commit Message**: Add AST builder ORDER BY asc/desc support (#1882)

**File**: `core/src/ast_builder/expr.rs` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@ mod exists;
 mod is_null;
 mod like;
 mod nested;
+mod order_by;
 mod unary_op;
 
 pub mod aggregate;
```

**File**: `core/src/ast_builder/expr/order_by.rs` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+use {super::ExprNode, crate::ast_builder::OrderByExprNode};
+
+impl<'a> ExprNode<'a> {
+    #[must_use]
+    pub fn asc(self) -> OrderByExprNode<'a> {
+        OrderByExprNode::Expr {
+            expr: self,
+            asc: Some(true),
+        }
+    }
+
+    #[must_use]
+    pub fn desc(self) -> OrderByExprNode<'a> {
+        OrderByExprNode::Expr {
+            expr: self,
+            asc: Some(false),
+        }
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use {
+        crate::{
+            ast_builder::{OrderByExprNode, col},
+            parse_sql::parse_order_by_expr,
+            translate::{NO_PARAMS, translate_order_by_expr},
+        },
+        pretty_assertions::assert_eq,
+    };
+
+    fn test(actual: OrderByExprNode, expected: &str) {
+        let parsed = &parse_order_by_expr(expected).expect(expected);
+        let expected = translate_order_by_expr(parsed, NO_PARAMS);
+        assert_eq!(actual.build_order_by_expr(), expected);
+    }
+
+    #[test]
+    fn order_by() {
+        let actual = col("foo").asc();
+        let expected = "foo ASC";
+        test(actual, expected);
+
+        let actual = col("foo").desc();
+        let expected = "foo DESC";
+        test(actual, expected);
+    }
+}
```

**File**: `core/src/ast_builder/index.rs` (modified, +7/-1)
```diff
@@ -57,7 +57,7 @@ impl Build for DropIndexNode {
 
 #[cfg(test)]
 mod tests {
-    use crate::ast_builder::{Build, table, test};
+    use crate::ast_builder::{Build, col, table, test};
 
     #[test]
     fn create_index() {
@@ -68,6 +68,12 @@ mod tests {
         let actual = table("Foo").create_index("nameIndex", "name desc").build();
         let expected = "CREATE INDEX nameIndex ON Foo (name Desc)";
         test(&actual, expected);
+
+        let actual = table("Foo")
+            .create_index("nameIndex", col("name").desc())
+            .build();
+        let expected = "CREATE INDEX nameIndex ON Foo (name DESC)";
+        test(&actual, expected);
     }
 
     #[test]
```

**File**: `core/src/ast_builder/order_by_expr.rs` (modified, +27/-9)
```diff
@@ -12,7 +12,10 @@ use {
 #[derive(Clone, Debug)]
 pub enum OrderByExprNode<'a> {
     Text(String),
-    Expr(ExprNode<'a>),
+    Expr {
+        expr: ExprNode<'a>,
+        asc: Option<bool>,
+    },
 }
 
 impl From<&str> for OrderByExprNode<'_> {
@@ -23,7 +26,10 @@ impl From<&str> for OrderByExprNode<'_> {
 
 impl<'a> From<ExprNode<'a>> for OrderByExprNode<'a> {
     fn from(expr_node: ExprNode<'a>) -> Self {
-        Self::Expr(expr_node)
+        Self::Expr {
+            expr: expr_node,
+            asc: None,
+        }
     }
 }
 
@@ -33,10 +39,10 @@ impl OrderByExprNode<'_> {
             OrderByExprNode::Text(expr) => {
                 parse_order_by_expr(expr).and_then(|op| translate_order_by_expr(&op, NO_PARAMS))
             }
-            OrderByExprNode::Expr(expr_node) => {
-                let expr = expr_node.build_expr()?;
+            OrderByExprNode::Expr { expr, asc } => {
+                let expr = expr.build_expr()?;
 
-                Ok(OrderByExpr { expr, asc: None })
+                Ok(OrderByExpr { expr, asc })
             }
         }
     }
@@ -45,10 +51,10 @@ impl OrderByExprNode<'_> {
         match self {
             OrderByExprNode::Text(expr) => parse_order_by_expr(expr)
                 .and_then(|op| translate_order_by_expr(&op, NO_PARAMS).map(Into::into)),
-            OrderByExprNode::Expr(expr_node) => {
-                let expr = expr_node.build_expr_plan()?;
+            OrderByExprNode::Expr { expr, asc } => {
+                let expr = expr.build_expr_plan()?;
 
-                Ok(OrderByExprPlan { expr, asc: None })
+                Ok(OrderByExprPlan { expr, asc })
             }
         }
     }
@@ -58,7 +64,7 @@ impl OrderByExprNode<'_> {
 mod tests {
     use {
         crate::{
-            ast_builder::OrderByExprNode,
+            ast_builder::{OrderByExprNode, col},
             parse_sql::parse_order_by_expr,
             plan::OrderByExprPlan,
             translate::{NO_PARAMS, translate_order_by_expr},
@@ -85,5 +91,17 @@ mod tests {
         let actual = OrderByExprNode::Text("foo desc".into());
         let expected = "foo DESC";
         test(actual, expected);
+
+        let actual = OrderByExprNode::from(col("foo"));
+        let expected = "foo";
+        test(actual, expected);
+
+        let actual = col("foo").asc();
+        let expected = "foo ASC";
+        test(actual, expected);
+
+        let actual = col("foo").desc();
+        let expected = "foo DESC";
+        test(actual, expected);
     }
 }
```

**File**: `core/src/ast_builder/order_by_expr_list.rs` (modified, +45/-0)
```diff
@@ -27,6 +27,18 @@ impl From<Vec<&str>> for OrderByExprList<'_> {
     }
 }
 
+impl<'a> From<OrderByExprNode<'a>> for OrderByExprList<'a> {
+    fn from(expr: OrderByExprNode<'a>) -> Self {
+        OrderByExprList::OrderByExprs(vec![expr])
+    }
+}
+
+impl<'a> From<Vec<OrderByExprNode<'a>>> for OrderByExprList<'a> {
+    fn from(exprs: Vec<OrderByExprNode<'a>>) -> Self {
+        OrderByExprList::OrderByExprs(exprs)
+    }
+}
+
 impl<'a> From<ExprNode<'a>> for OrderByExprList<'a> {
     fn from(expr_node: ExprNode<'a>) -> Self {
         OrderByExprList::OrderByExprs(vec![expr_node.into()])
@@ -60,3 +72,36 @@ impl OrderByExprList<'_> {
         }
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use {
+        crate::{
+            ast::OrderByExpr,
+            ast_builder::{OrderByExprList, col},
+            parse_sql::parse_order_by_exprs,
+            result::Result,
+            translate::{NO_PARAMS, translate_order_by_expr},
+        },
+        pretty_assertions::assert_eq,
+    };
+
+    fn expected(exprs: &str) -> Result<Vec<OrderByExpr>> {
+        parse_order_by_exprs(exprs)?
+            .iter()
+            .map(|expr| translate_order_by_expr(expr, NO_PARAMS))
+            .collect::<Result<Vec<_>>>()
+    }
+
+    #[test]
+    fn order_by_expr_list() {
+        let actual = OrderByExprList::from(col("foo"));
+        assert_eq!(actual.build_order_by_exprs(), expected("foo"));
+
+        let actual = OrderByExprList::from(col("foo").desc());
+        assert_eq!(actual.build_order_by_exprs(), expected("foo DESC"));
+
+        let actual = OrderByExprList::from(vec![col("foo").desc(), col("bar").asc()]);
+        assert_eq!(actual.build_order_by_exprs(), expected("foo DESC, bar ASC"));
+    }
+}
```

**File**: `core/src/ast_builder/select/order_by.rs` (modified, +22/-0)
```diff
@@ -227,6 +227,28 @@ mod tests {
         ";
         test_query_builder(actual, expected);
 
+        // typed order by (single expression) -> build
+        let actual = table("Item")
+            .select()
+            .project("name, price")
+            .order_by(col("price").desc());
+        let expected = "
+            SELECT name, price FROM Item
+            ORDER BY price DESC
+        ";
+        test_query_builder(actual, expected);
+
+        // typed order by (multiple expressions) -> build
+        let actual = table("Item")
+            .select()
+            .project("name, price")
+            .order_by(vec![col("price").desc(), col("name").asc()]);
+        let expected = "
+            SELECT name, price FROM Item
+            ORDER BY price DESC, name ASC
+        ";
+        test_query_builder(actual, expected);
+
         // filter node -> order by node -> build
         let actual = table("Foo")
             .select()
```

**File**: `docs/docs/ast-builder/statements/querying/fetching-data-from-storage.md` (modified, +12/-1)
```diff
@@ -91,6 +91,17 @@ let actual = table("Item")
     .await;
 ```
 
+You can also use typed expression helpers:
+
+```rust
+let actual = table("Item")
+    .select()
+    .project("name, price")
+    .order_by(col("price").desc())
+    .execute(glue)
+    .await;
+```
+
 ## Pagination (OFFSET, LIMIT)
 
 You can paginate the results of a SELECT query using the `offset()` and `limit()` methods.
@@ -104,4 +115,4 @@ let actual = table("Item")
     .limit(2)
     .execute(glue)
     .await;
-```
\ No newline at end of file
+```
```

#### Recent Merged Pull Requests:
- **PR #2045** (2026-09-30): Update JavaScript getting started guide for OPFS entry points (@juhee200)
- **PR #2044** (2026-09-28): Make IF NOT EXISTS CTAS a no-op for existing tables (@zmrdltl)
- **PR #2043** (2026-09-28): Avoid planning defaults during foreign key validation (@zmrdltl)
- **PR #2042** (2026-09-27): Remove unused sqlparser serde feature (@zmrdltl)
- **PR #2039** (2026-09-28): Reject DELETE with multiple tables in FROM (@chiliec)
- **PR #2038** (2026-09-27): Plan column defaults before execution (@panarch)
- **PR #2036** (2026-09-27): Make `GLUE_OBJECTS` metadata columns dynamic (@zmrdltl)
- **PR #2031** (2026-09-27): Test batched `Glue::execute` planning against earlier DDL (@sweetpark)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
