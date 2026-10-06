# Forensic Learning Record (Deep Inspection): AmrDeveloper/GQL

> **Canonical Artifact**: `07_PROJECT_LEARNING/amrdeveloper-gql-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AmrDeveloper/GQL](https://github.com/AmrDeveloper/GQL))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:21:50.110Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AmrDeveloper/GQL`
- **Description**: GitQL is a extensible SQL-like query language and SDK to perform queries on various data sources such .git files with supports of most of SQL features such as grouping, ordering and aggregation and window functions and allow customization like user-defined types and functions
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3512 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `crates/gitql-core/src/combinations_generator.rs`
```
/// Return a list of all non empty and unique combinations
pub fn generate_list_of_all_combinations(n: usize) -> Vec<Vec<usize>> {
    let mut result = Vec::with_capacity((2 << n) - 1);
    let mut current = Vec::with_capacity(n);
    generate_indices_combination(n, 0, &mut current, &mut result);
    result
}

fn generate_indices_combination(
    n: usize,
    start: usize,
    current: &mut Vec<usize>,
    result: &mut Vec<Vec<usize>>,
) {
    if !current.is_empty() {
        result.push(current.clone());
    }

    for i in start..n {
        current.push(i);
        generate_indices_combination(n, i + 1, current, result);
        current.pop();
    }
}

```

### Core Architecture Module: `crates/gitql-core/src/environment.rs`
```
use std::collections::HashMap;

use gitql_ast::types::DataType;

use crate::schema::Schema;
use crate::signature::AggregationFunction;
use crate::signature::Signature;
use crate::signature::StandardFunction;
use crate::signature::WindowFunction;
use crate::types_table::TypesTable;
use crate::values::Value;

/// Environment that track schema, functions, scopes and types
/// to be used in different places in the query engine
pub struct Environment {
    /// Data schema information contains table, fields names and types
    pub schema: Schema,

    /// Standard function signatures
    pub std_signatures: HashMap<&'static str, Signature>,

    /// Standard function references
    pub std_functions: HashMap<&'static str, StandardFunction>,

    /// Aggregation function signatures
    pub aggregation_signatures: HashMap<&'static str, Signature>,

    /// Aggregation function references
    pub aggregation_functions: HashMap<&'static str, AggregationFunction>,

    /// Window function signatures
    pub window_signatures: HashMap<&'static str, Signature>,

    /// Window function references
    pub window_functions: HashMap<&'static str, WindowFunction>,

    /// All Global Variables values that can life for this program session
    pub globals: HashMap<String, Box<dyn Value>>,

    /// All Global Variables Types that can life for this program session
    pub globals_types: HashMap<String, Box<dyn DataType>>,

    /// Local variables types in the current scope, later will be multi layer scopes
    pub scopes: HashMap<String, Box<dyn DataType>>,

    /// A Table of DataTypes mapped to their original names or aliases
    pub types_table: TypesTable,
}

impl Environment {
    /// Create new [`Environment`] instance with Data Schema
    pub fn new(schema: Schema) -> Self {
        Self {
            schema,
            std_signatures: HashMap::default(),
            std_functions: HashMap::default(),
            aggregation_signatures: HashMap::default(),
            aggregation_functions: HashMap::default(),
            window_signatures: HashMap::default(),
            window_functions: HashMap::default(),
            globals: HashMap::default(),
            globals_types: HashMap::default(),
            scopes: HashMap::default(),
            types_table: TypesTable::new(),
        }
    }

    /// Register standard functions signatures and references
    pub fn with_standard_functions(
        &mut self,
        signatures: &HashMap<&'static str, Signature>,
        functions: &HashMap<&'static str, StandardFunction>,
    ) {
        self.std_signatures.extend(signatures.to_owned());
        self.std_functions.extend(functions.to_owned());
    }

    /// Register aggregation functions signatures and references
    pub fn with_aggregation_functions(
        &mut self,
        signatures: &HashMap<&'static str, Signature>,
        aggregation: &HashMap<&'static str, AggregationFunction>,
    ) {
        self.aggregation_signatures.extend(signatures.to_owned());
        self.aggregation_functions.extend(aggregation.to_owned());
    }

    /// Register Window functions signatures and references
    pub fn with_window_functions(
        &mut self,
        signatures: &HashMap<&'static str, Signature>,
        window: &HashMap<&'static str, WindowFunction>,
    ) {
        self.window_signatures.extend(signatures.to_owned());
        self.window_functions.extend(window.to_owned());
    }

    /// Register new Modified Types table
    pub fn with_types_table(&mut self, types_table: TypesTable) {
        self.types_table = types_table
    }

    /// Return true if this name is a valid standard function
    pub fn is_std_function(&self, str: &str) -> bool {
        self.std_functions.contains_key(str)
    }

    /// Return Standard function signature by name
    pub fn std_signature(&self, str: &str) -> Option<&Signature> {
        self.std_signatures.get(str)
    }

    /// Return Standard function reference by name
    pub fn std_function(&self, str: &str) -> Option<&StandardFunction> {
        self.std_functions.get(str)
    }

    /// Return true if this name is a valid aggregation function
    pub fn is_aggregation_function(&self, str: &str) -> bool {
        self.aggregation_signatures.contains_key(str)
    }

    /// Return Aggregation function signature by name
    pub fn aggregation_signature(&self, str: &str) -> Option<&Signature> {
        self.aggregation_signatures.get(str)
    }

    /// Return Aggregation function reference by name
    pub fn aggregation_function(&self, str: &str) -> Option<&AggregationFunction> {
        self.aggregation_functions.get(str)
    }

    /// Return true if this name is a valid Window function
    pub fn is_window_function(&self, str: &str) -> bool {
        self.window_functions.contains_key(str)
    }

    /// Return Window function signature by name
    pub fn window_function_signature(&self, str: &str) -> Option<&Signature> {
        self.window_signatures.get(str)
    }

    /// Return Window function reference by name
    pub fn window_function(&self, str: &str) -> Option<&WindowFunction> {
        self.window_functions.get(str)
    }

    /// Define in the current scope
    pub fn define(&mut self, str: String, data_type: Box<dyn DataType>) {
        self.scopes.insert(str, data_type);
    }

    /// Define in the global scope
    pub fn define_global(&mut self, str: String, data_type: Box<dyn DataType>) {
        self.globals_types.insert(str, data_type);
    }

    /// Returns true if local or global scopes has contains field
    pub fn contains(&self, str: &String) -> bool {
        self.scopes.contains_key(str) || self.globals_types.contains_key(str)
    }

    /// Resolve Global or Local type using symbol name
    #[allow(clippy::borrowed_box)]
    pub fn resolve_type(&self, str: &String) -> Option<&Box<dyn DataType>> {
        if str.starts_with('@') {
            return self.globals_types.get(str);
        }
        self.scopes.get(str)
    }

    /// Clear all locals scopes and only save globals
    pub fn clear_session(&mut self) {
        self.scopes.clear()
    }
}

```

### Core Architecture Module: `crates/gitql-core/src/lib.rs`
```
pub mod combinations_generator;
pub mod environment;
pub mod object;
pub mod schema;
pub mod signature;
pub mod types_table;
pub mod values;

// Export IndexMap type
pub use indexmap;

```

### Core Architecture Module: `crates/gitql-core/src/object.rs`
```
use super::values::Value;

/// In memory representation of the list of [`Value`] in one Row
#[derive(Clone, Default)]
pub struct Row {
    pub values: Vec<Box<dyn Value>>,
}

/// In memory representation of the Rows of one [`Group`]
#[derive(Clone, Default)]
pub struct Group {
    pub rows: Vec<Row>,
}

impl Group {
    /// Returns true of this group has no rows
    pub fn is_empty(&self) -> bool {
        self.rows.is_empty()
    }

    /// Returns the number of rows in this group
    pub fn len(&self) -> usize {
        self.rows.len()
    }
}

/// In memory representation of the GitQL Object which has titles and groups
#[derive(Default)]
pub struct GitQLObject {
    pub titles: Vec<String>,
    pub groups: Vec<Group>,
}

impl GitQLObject {
    /// Flat the list of current groups into one main group
    pub fn flat(&mut self) {
        let mut rows: Vec<Row> = vec![];
        for group in &mut self.groups {
            rows.append(&mut group.rows);
        }

        self.groups.clear();
        self.groups.push(Group { rows })
    }

    /// Returns true of there is no groups
    pub fn is_empty(&self) -> bool {
        self.groups.is_empty()
    }

    /// Returns the number of groups in this Object
    pub fn len(&self) -> usize {
        self.groups.len()
    }
}

```

### Core Architecture Module: `crates/gitql-core/src/schema.rs`
```
use std::collections::HashMap;

use gitql_ast::types::DataType;

/// A Representation of the Schema of the data including columns, tables and types
pub struct Schema {
    pub tables_fields_names: HashMap<&'static str, Vec<&'static str>>,
    pub tables_fields_types: HashMap<&'static str, Box<dyn DataType>>,
}

```

### Core Architecture Module: `crates/gitql-core/src/signature.rs`
```
use super::values::Value;

use gitql_ast::types::DataType;

/// Standard function accept array of values and return single [`Value`]
pub type StandardFunction = fn(&[Box<dyn Value>]) -> Box<dyn Value>;

/// Aggregation function accept a selected row values for each row in group and return single [`Value`]
///
/// [`Vec<Vec<Value>>`] represent the selected values from each row in group
///
/// For Example if we have three rows in group and select name and email from each one
///
/// [[name, email], [name, email], [name, email]]
///
/// This implementation allow aggregation function to accept more than one parameter,
/// and also accept any Expression not only field name
///
pub type AggregationFunction = fn(&[Vec<Box<dyn Value>>]) -> Box<dyn Value>;

/// Window function  a selected row values for each row in a specific frame and return single [`Value`]
///
/// [`Vec<Vec<Value>>`] represent the selected values from each row in frame of rows
///
/// For Example if we have three rows in frame of row and select name and email from each one
///
/// [[name, email], [name, email], [name, email]]
///
/// This implementation allow Window` function to accept more than one parameter,
/// and also accept any Expression not only field name
///
pub type WindowFunction = fn(&[Vec<Box<dyn Value>>]) -> Vec<Box<dyn Value>>;

/// Signature struct is a representation of function type
///
/// Function type in GitQL used to track parameters and return type for now
/// but later can track parameter names to allow pass parameter by name and improve error messages
///
/// GitQL Function Signature has some rules to follow
///
/// Rules:
/// - Parameters must contains 0 or 1 [`VarargsType`] parameter type only.
/// - [`VarargsType`] must be the last parameter.
/// - You can add 0 or more [`DataType::Optional`] parameters.
/// - [`OptionalType`] parameters must be at the end but also before [`VarargsType`] if exists.
///
/// The return type can be a static [`DataType`] such as Int, Float or Dynamic
/// so you can return a dynamic type depending on parameters.
#[derive(Clone)]
pub struct Signature {
    pub parameters: Vec<Box<dyn DataType>>,
    pub return_type: Box<dyn DataType>,
}

impl Signature {
    /// Create Instance of [`Signature`] with parameters and return type
    pub fn new(parameters: Vec<Box<dyn DataType>>, return_type: Box<dyn DataType>) -> Self {
        Signature {
            parameters,
            return_type,
        }
    }

    /// Create Instance of [`Signature`] with return type and zero parameters
    pub fn with_return(return_type: Box<dyn DataType>) -> Self {
        Signature {
            parameters: Vec::default(),
            return_type,
        }
    }

    /// Add list of parameters to the [`Signature`]
    pub fn add_parameters(mut self, mut parameters: Vec<Box<dyn DataType>>) -> Self {
        self.parameters.append(&mut parameters);
        self
    }

    /// Add parameter to the [`Signature`]
    pub fn add_parameter(mut self, parameter: Box<dyn DataType>) -> Self {
        self.parameters.push(parameter);
        self
    }
}

```

### Core Architecture Module: `crates/gitql-core/src/types_table.rs`
```
use std::collections::HashMap;

use gitql_ast::types::boolean::BoolType;
use gitql_ast::types::date::DateType;
use gitql_ast::types::datetime::DateTimeType;
use gitql_ast::types::float::FloatType;
use gitql_ast::types::integer::IntType;
use gitql_ast::types::interval::IntervalType;
use gitql_ast::types::text::TextType;
use gitql_ast::types::time::TimeType;
use gitql_ast::types::DataType;

/// Map of Types and Names to be used in type parser
pub struct TypesTable {
    /// Collection of type names mapped to actual types
    types_map: HashMap<&'static str, Box<dyn DataType>>,
}

impl Default for TypesTable {
    fn default() -> Self {
        Self::new()
    }
}

impl TypesTable {
    /// Create new Instance of [`TypesTable`] with SQL primitives types registered
    pub fn new() -> Self {
        let mut types_table = TypesTable {
            types_map: HashMap::default(),
        };
        register_primitives_types(&mut types_table.types_map);
        types_table
    }

    /// Create new Instance of [`TypesTable`] with empty map
    pub fn empty() -> Self {
        TypesTable {
            types_map: HashMap::default(),
        }
    }

    /// Register DataType to a new name and return optional if it success or not
    pub fn register(
        &mut self,
        name: &'static str,
        data_type: Box<dyn DataType>,
    ) -> Option<Box<dyn DataType>> {
        self.types_map.insert(name, data_type)
    }

    /// Lookup at the types map by name and return DataType if registered or None if not found
    pub fn lookup(&self, name: &str) -> Option<Box<dyn DataType>> {
        self.types_map.get(&name).cloned()
    }

    /// Return Reference to the current type map
    pub fn types_map(&self) -> &HashMap<&'static str, Box<dyn DataType>> {
        &self.types_map
    }

    /// Returns true if the map contains no elements.
    pub fn is_empty(&self) -> bool {
        self.types_map.is_empty()
    }

    /// Return the length of types map
    pub fn len(&self) -> usize {
        self.types_map.len()
    }
}

/// Register the common predefined Types in SQL with their common aliases
fn register_primitives_types(types_map: &mut HashMap<&'static str, Box<dyn DataType>>) {
    // SQL Data Types
    types_map.insert("integer", Box::new(IntType));
    types_map.insert("real", Box::new(FloatType));
    types_map.insert("boolean", Box::new(BoolType));
    types_map.insert("text", Box::new(TextType));
    types_map.insert("date", Box::new(DateType));
    types_map.insert("time", Box::new(TimeType));
    types_map.insert("datetime", Box::new(DateTimeType));
    types_map.insert("interval", Box::new(IntervalType));

    // SQL Type Aliases
    types_map.insert("int", Box::new(IntType));
    types_map.insert("float", Box::new(FloatType));
    types_map.insert("bool", Box::new(BoolType));
}

```

### Core Architecture Module: `crates/gitql-core/src/values/array.rs`
```
use std::any::Any;
use std::cmp::Ordering;

use gitql_ast::types::array::ArrayType;
use gitql_ast::types::DataType;

use super::base::Value;
use super::boolean::BoolValue;
use super::integer::IntValue;

#[derive(Clone)]
pub struct ArrayValue {
    pub values: Vec<Box<dyn Value>>,
    pub base_type: Box<dyn DataType>,
}

impl ArrayValue {
    pub fn new(values: Vec<Box<dyn Value>>, base_type: Box<dyn DataType>) -> Self {
        ArrayValue { values, base_type }
    }

    pub fn empty(base_type: Box<dyn DataType>) -> Self {
        ArrayValue {
            values: Vec::default(),
            base_type,
        }
    }

    pub fn add_element(mut self, element: Box<dyn Value>) -> Self {
        self.values.push(element);
        self
    }
}

impl Value for ArrayValue {
    fn literal(&self) -> String {
        let mut str = String::new();
        let elements = &self.values;
        if elements.is_empty() {
            return "[]".to_string();
        }

        str += "[";
        for (pos, element) in elements.iter().enumerate() {
            str += &element.literal();
            if pos + 1 != elements.len() {
                str += ", ";
            }
        }
        str += "]";
        str
    }

    fn equals(&self, other: &Box<dyn Value>) -> bool {
        if let Some(other_array) = other.as_any().downcast_ref::<ArrayValue>() {
            if !self.base_type.equals(&other_array.base_type) {
                return false;
            }

            let self_values = &self.values;
            let other_values = &other_array.values;
            if self.values.len() != other_values.len() {
                return false;
            }

            for i in 0..self.values.len() {
                if !self_values[i].equals(&other_values[i]) {
                    return false;
                }
            }
        }
        false
    }

    fn compare(&self, _other: &Box<dyn Value>) -> Option<Ordering> {
        None
    }

    fn data_type(&self) -> Box<dyn DataType> {
        Box::new(ArrayType {
            base: self.base_type.clone(),
        })
    }

    fn as_any(&self) -> &dyn Any {
        self
    }

    fn index_op(&self, index: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        if let Some(index) = index.as_any().downcast_ref::<IntValue>() {
            if (index.value < 1) || (index.value as usize > self.values.len()) {
                return Err("Array Index must be between 1 and length of Array".to_string());
            }

            let array_index = (index.value - 1) as usize;
            return Ok(self.values[array_index].clone());
        }
        Err("Unexpected Array Index type".to_string())
    }

    fn slice_op(
        &self,
        start: &Option<Box<dyn Value>>,
        end: &Option<Box<dyn Value>>,
    ) -> Result<Box<dyn Value>, String> {
        if start.is_none() && end.is_none() {
            return Ok(Box::new(self.clone()));
        }

        let mut start_index: usize = 0;

        if start.is_some() {
            if let Some(start_value) = start.clone().unwrap().as_any().downcast_ref::<IntValue>() {
                if start_value.value < 1 || start_value.value >= self.values.len() as i64 {
                    return Err("Slice start must be between 1 and length of Array".to_string());
                }
                start_index = start_value.value as usize;
            }
        }

        let mut end_index: usize = self.values.len();
        if end.is_some() {
            if let Some(end_value) = end.clone().unwrap().as_any().downcast_ref::<IntValue>() {
                if end_value.value < start_index as i64
                    || end_value.value > self.values.len() as i64
                {
                    return Err("Slice end must be between start and length of Array".to_string());
                }
                end_index = end_value.value as usize;
            }
        }

        let slice = self.values[start_index..end_index].to_vec();
        Ok(Box::new(ArrayValue {
            values: slice,
            base_type: self.base_type.clone(),
        }))
    }

    fn logical_or_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        if let Some(other_array) = other.as_any().downcast_ref::<ArrayValue>() {
            for value in self.values.iter() {
                for other_value in other_array.values.iter() {
                    if value.equals(other_value) {
                        return Ok(Box::new(BoolValue { value: true }));
                    }
                }
            }
            return Ok(Box::new(BoolValue::new_false()));
        }
        Err("Unexpected Array overlap type".to_string())
    }

    fn contains_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        for value in self.values.iter() {
            if value.equals(other) {
                return Ok(Box::new(BoolValue { value: true }));
            }
        }

        Ok(Box::new(BoolValue::new_false()))
    }
}

```

### Core Architecture Module: `crates/gitql-core/src/values/base.rs`
```
use std::any::Any;
use std::cmp::Ordering;
use std::fmt;

use dyn_clone::DynClone;
use gitql_ast::operator::GroupComparisonOperator;
use gitql_ast::types::DataType;
use gitql_ast::Interval;

use super::array::ArrayValue;
use super::boolean::BoolValue;
use super::composite::CompositeValue;
use super::date::DateValue;
use super::datetime::DateTimeValue;
use super::float::FloatValue;
use super::integer::IntValue;
use super::interval::IntervalValue;
use super::null::NullValue;
use super::range::RangeValue;
use super::text::TextValue;
use super::time::TimeValue;

dyn_clone::clone_trait_object!(Value);

/// The in memory representation of the Values in the GitQL query engine
pub trait Value: DynClone {
    /// Return the literal representation for this [`Value`]
    fn literal(&self) -> String;

    /// Return if other [`Value`] is equal or not to current value
    #[allow(clippy::borrowed_box)]
    fn equals(&self, other: &Box<dyn Value>) -> bool;

    /// Return the order between [`Value`] and the current value,
    /// or None if they can't be ordered
    #[allow(clippy::borrowed_box)]
    fn compare(&self, other: &Box<dyn Value>) -> Option<Ordering>;

    /// Return the [`DataType`] for the current [`Value`]
    fn data_type(&self) -> Box<dyn DataType>;

    /// Return the current value as dynamic [`Any`]
    fn as_any(&self) -> &dyn Any;

    /// Perform unary `=` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn add_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `-` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn sub_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `*` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn mul_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `/` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn div_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `%` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn rem_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `^` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn caret_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `|` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn or_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `&` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn and_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `#` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn xor_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `||` or `OR` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn logical_or_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `&&` or `AND` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn logical_and_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `XOR` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn logical_xor_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `<<` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn shl_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `>>` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn shr_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `[I]` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn index_op(&self, index: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `[S:E]` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn slice_op(
        &self,
        start: &Option<Box<dyn Value>>,
        end: &Option<Box<dyn Value>>,
    ) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `=` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn eq_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `= [ALL|ANY|SOME]` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn group_eq_op(
        &self,
        other: &Box<dyn Value>,
        group_op: &GroupComparisonOperator,
    ) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `!=` or `<>` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn bang_eq_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `!= or <> [ALL|ANY|SOME]` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn group_bang_eq_op(
        &self,
        other: &Box<dyn Value>,
        group_op: &GroupComparisonOperator,
    ) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `<=>` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn null_safe_eq_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `<=> [ALL|ANY|SOME]` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn group_null_safe_eq_op(
        &self,
        other: &Box<dyn Value>,
        group_op: &GroupComparisonOperator,
    ) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `>` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn gt_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `> [ALL|ANY|SOME]` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    #[allow(clippy::borrowed_box)]
    fn group_gt_op(
        &self,
        other: &Box<dyn Value>,
        group_op: &GroupComparisonOperator,
    ) -> Result<Box<dyn Value>, String> {
        Err("Unsupported operator for this type".to_string())
    }

    /// Perform unary `>=` operator and return new [`Value`] represent the result or Exception message as [`String`]
    #[allow(unused_variables)]
    
```

### Core Architecture Module: `crates/gitql-core/src/values/boolean.rs`
```
use std::any::Any;
use std::cmp::Ordering;

use gitql_ast::operator::GroupComparisonOperator;
use gitql_ast::types::boolean::BoolType;
use gitql_ast::types::DataType;

use super::base::Value;
use super::integer::IntValue;

#[derive(Clone)]
pub struct BoolValue {
    pub value: bool,
}

impl BoolValue {
    pub fn new(value: bool) -> Self {
        BoolValue { value }
    }

    pub fn new_true() -> Self {
        BoolValue { value: true }
    }

    pub fn new_false() -> Self {
        BoolValue { value: false }
    }
}

impl Value for BoolValue {
    fn literal(&self) -> String {
        self.value.to_string()
    }

    fn equals(&self, other: &Box<dyn Value>) -> bool {
        if let Some(other_bool) = other.as_any().downcast_ref::<BoolValue>() {
            return self.value == other_bool.value;
        }
        false
    }

    fn compare(&self, other: &Box<dyn Value>) -> Option<Ordering> {
        if let Some(other_bool) = other.as_any().downcast_ref::<BoolValue>() {
            return self.value.partial_cmp(&other_bool.value);
        }
        None
    }

    fn data_type(&self) -> Box<dyn DataType> {
        Box::new(BoolType)
    }

    fn as_any(&self) -> &dyn Any {
        self
    }

    fn bang_op(&self) -> Result<Box<dyn Value>, String> {
        Ok(Box::new(BoolValue::new(!self.value)))
    }

    fn logical_or_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        if let Some(other_bool) = other.as_any().downcast_ref::<BoolValue>() {
            return Ok(Box::new(BoolValue::new(self.value || other_bool.value)));
        }
        Err("Unexpected type to perform `||` with".to_string())
    }

    fn logical_and_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        if let Some(other_bool) = other.as_any().downcast_ref::<BoolValue>() {
            return Ok(Box::new(BoolValue::new(self.value && other_bool.value)));
        }
        Err("Unexpected type to perform `&&` with".to_string())
    }

    fn logical_xor_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        if let Some(other_bool) = other.as_any().downcast_ref::<BoolValue>() {
            return Ok(Box::new(BoolValue::new(self.value ^ other_bool.value)));
        }
        Err("Unexpected type to perform `^` with".to_string())
    }

    fn eq_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        if let Some(other_bool) = other.as_any().downcast_ref::<BoolValue>() {
            return Ok(Box::new(BoolValue::new(self.value == other_bool.value)));
        }
        Err("Unexpected type to perform `=` with".to_string())
    }

    fn group_eq_op(
        &self,
        other: &Box<dyn Value>,
        group_op: &GroupComparisonOperator,
    ) -> Result<Box<dyn Value>, String> {
        if other.is_array_of(|element_type| element_type.is_bool()) {
            let elements = &other.as_array().unwrap();
            let mut matches_count = 0;
            for element in elements.iter() {
                if self.value == element.as_bool().unwrap() {
                    matches_count += 1;
                    if GroupComparisonOperator::Any.eq(group_op) {
                        break;
                    }
                }
            }

            let result = match group_op {
                GroupComparisonOperator::All => matches_count == elements.len(),
                GroupComparisonOperator::Any => matches_count > 0,
            };

            return Ok(Box::new(BoolValue::new(result)));
        }
        Err("Unexpected type to perform `=` with".to_string())
    }

    fn bang_eq_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        if let Some(other_bool) = other.as_any().downcast_ref::<BoolValue>() {
            return Ok(Box::new(BoolValue::new(self.value != other_bool.value)));
        }
        Err("Unexpected type to perform `!=` with".to_string())
    }

    fn group_bang_eq_op(
        &self,
        other: &Box<dyn Value>,
        group_op: &GroupComparisonOperator,
    ) -> Result<Box<dyn Value>, String> {
        if other.is_array_of(|element_type| element_type.is_bool()) {
            let elements = &other.as_array().unwrap();
            let mut matches_count = 0;
            for element in elements.iter() {
                if self.value != element.as_bool().unwrap() {
                    matches_count += 1;
                    if GroupComparisonOperator::Any.eq(group_op) {
                        break;
                    }
                }
            }

            let result = match group_op {
                GroupComparisonOperator::All => matches_count == elements.len(),
                GroupComparisonOperator::Any => matches_count > 0,
            };

            return Ok(Box::new(BoolValue::new(result)));
        }
        Err("Unexpected type to perform `!=` with".to_string())
    }

    fn gt_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        if let Some(other_bool) = other.as_any().downcast_ref::<BoolValue>() {
            return Ok(Box::new(BoolValue::new(self.value & !other_bool.value)));
        }
        Err("Unexpected type to perform `>` with".to_string())
    }

    fn group_gt_op(
        &self,
        other: &Box<dyn Value>,
        group_op: &GroupComparisonOperator,
    ) -> Result<Box<dyn Value>, String> {
        if other.is_array_of(|element_type| element_type.is_bool()) {
            let elements = &other.as_array().unwrap();
            let mut matches_count = 0;
            for element in elements.iter() {
                if self.value & !element.as_bool().unwrap() {
                    matches_count += 1;
                    if GroupComparisonOperator::Any.eq(group_op) {
                        break;
                    }
                }
            }

            let result = match group_op {
                GroupComparisonOperator::All => matches_count == elements.len(),
                GroupComparisonOperator::Any => matches_count > 0,
            };

            return Ok(Box::new(BoolValue::new(result)));
        }
        Err("Unexpected type to perform `>` with".to_string())
    }

    fn gte_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        if let Some(other_bool) = other.as_any().downcast_ref::<BoolValue>() {
            return Ok(Box::new(BoolValue::new(self.value >= other_bool.value)));
        }
        Err("Unexpected type to perform `>=` with".to_string())
    }

    fn group_gte_op(
        &self,
        other: &Box<dyn Value>,
        group_op: &GroupComparisonOperator,
    ) -> Result<Box<dyn Value>, String> {
        if other.is_array_of(|element_type| element_type.is_bool()) {
            let elements = &other.as_array().unwrap();
            let mut matches_count = 0;
            for element in elements.iter() {
                if self.value >= element.as_bool().unwrap() {
                    matches_count += 1;
                    if GroupComparisonOperator::Any.eq(group_op) {
                        break;
                    }
                }
            }

            let result = match group_op {
                GroupComparisonOperator::All => matches_count == elements.len(),
                GroupComparisonOperator::Any => matches_count > 0,
            };

            return Ok(Box::new(BoolValue::new(result)));
        }
        Err("Unexpected type to perform `>=` with".to_string())
    }

    fn lt_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        if let Some(other_bool) = other.as_any().downcast_ref::<BoolValue>() {
            return Ok(Box::new(BoolValue::new(!self.value & other_bool.value)));
        }
        Err("Unexpected type to perform `<` with".to_string())
    }

    fn group_lt_op(
        &self,
        other: &Box<dyn Value>,
        group_op: &GroupComparisonOperator,
    ) -> Result<Box<dyn Value>, String> {
        if other.is_array_of(|element_type| element_type.is_bool()) {
            let elements = &other.as_array().unwrap();
            let mut matches_count = 0;
            for element in elements.iter() {
                if !self.value & element.as_bool().unwrap() {
                    matches_count += 1;
                    if GroupComparisonOperator::Any.eq(group_op) {
                        break;
                    }
                }
            }

            let result = match group_op {
                GroupComparisonOperator::All => matches_count == elements.len(),
                GroupComparisonOperator::Any => matches_count > 0,
            };

            return Ok(Box::new(BoolValue::new(result)));
        }
        Err("Unexpected type to perform `<` with".to_string())
    }

    fn lte_op(&self, other: &Box<dyn Value>) -> Result<Box<dyn Value>, String> {
        if let Some(other_bool) = other.as_any().downcast_ref::<BoolValue>() {
            return Ok(Box::new(BoolValue::new(self.value <= other_bool.value)));
        }
        Err("Unexpected type to perform `<=` with".to_string())
    }

    fn group_lte_op(
        &self,
        other: &Box<dyn Value>,
        group_op: &GroupComparisonOperator,
    ) -> Result<Box<dyn Value>, String> {
        if other.is_array_of(|element_type| element_type.is_bool()) {
            let elements = &other.as_array().unwrap();
            let mut matches_count = 0;
            for element in elements.iter() {
                if self.value <= element.as_bool().unwrap() {
                    matches_count += 1;
                    if GroupComparisonOperator::Any.eq(group_op) {
                        break;
                    }
                }
            }

            let result = match group_op {
                GroupComparisonOperator::All => matches_count == elements.len(),
                GroupComparisonOperator::Any => matches_count > 0,
            };

            return Ok(Box::new(BoolValue::new(result)));
        }
        Err("Unexpected type to perform `<=` with".t
```

### Core Architecture Module: `crates/gitql-core/src/values/composite.rs`
```
use std::any::Any;
use std::cmp::Ordering;
use std::collections::HashMap;

use gitql_ast::types::composite::CompositeType;
use gitql_ast::types::DataType;

use indexmap::IndexMap;

use super::base::Value;

#[derive(Clone)]
pub struct CompositeValue {
    pub name: String,
    pub members: IndexMap<String, Box<dyn Value>>,
}

impl CompositeValue {
    pub fn new(name: String, members: IndexMap<String, Box<dyn Value>>) -> Self {
        CompositeValue { name, members }
    }

    pub fn empty(name: String) -> Self {
        CompositeValue {
            name,
            members: IndexMap::default(),
        }
    }

    pub fn add_member(mut self, name: String, value: Box<dyn Value>) -> Self {
        self.members.insert(name, value);
        self
    }
}

impl Value for CompositeValue {
    fn literal(&self) -> String {
        let mut str = String::new();
        let last_position = self.members.len() - 1;
        str += "(";
        for (pos, member) in self.members.iter().enumerate() {
            str += &member.1.literal();
            if pos != last_position {
                str += ", ";
            }
        }
        str += ")";
        str
    }

    fn equals(&self, other: &Box<dyn Value>) -> bool {
        if let Some(other_composite) = other.as_any().downcast_ref::<CompositeValue>() {
            return self.name.eq(&other_composite.name)
                && self.members.eq(&other_composite.members);
        }
        false
    }

    fn compare(&self, _other: &Box<dyn Value>) -> Option<Ordering> {
        None
    }

    fn data_type(&self) -> Box<dyn DataType> {
        let name = self.name.to_string();
        let mut members: HashMap<String, Box<dyn DataType>> = HashMap::new();
        for member in self.members.iter() {
            members.insert(member.0.to_string(), member.1.data_type().clone());
        }
        Box::new(CompositeType::new(name, members))
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
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

### Incident Patch 2: `d87afb05` (2025-11-16)
**Commit Message**: Allow needless_range_loop warning

**File**: `crates/gitql-parser/src/name_similarity.rs` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ fn levenshtein_distance(s1: &str, s2: &str) -> usize {
         vector[0] = i;
     }
 
+    #[allow(clippy::needless_range_loop)]
     for j in 0..vec12_len {
         matrix[0][j] = j;
     }
```

---

### Incident Patch 3: `7288cace` (2025-10-05)
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

### Incident Patch 4: `1a229519` (2025-09-06)
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

### Incident Patch 5: `45f22766` (2025-09-05)
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

### Incident Patch 6: `0983b9a2` (2025-09-05)
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

### Incident Patch 7: `1590aee4` (2025-02-19)
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

### Incident Patch 8: `a98dcb76` (2025-02-09)
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

### Incident Patch 9: `5f768191` (2025-02-09)
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

### Incident Patch 10: `17381fc3` (2025-01-13)
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

### Incident Patch 11: `cb537e4f` (2025-01-13)
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
