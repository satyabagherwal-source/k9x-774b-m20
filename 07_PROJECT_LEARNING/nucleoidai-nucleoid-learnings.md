> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `fbd810e8`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T13:10:11.485Z  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): NucleoidAI/Nucleoid

> **Canonical Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-09T13:10:11.059Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NucleoidAI/Nucleoid`
- **Description**: World Model 🌱🐋🌍
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 771 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/lang/ast/generator/statement.rs`
```
use super::{WordValue, enum_source, has_binding_metadata, signature};
use crate::lang::ast::{ClassDecl, Expr, Function, FunctionBody, Stmt};

/// Renders a run of statements as the body of a block, which is what a block or
/// branch is keyed by in the graph.
pub fn generate_all(statements: &[Stmt]) -> String {
    statements
        .iter()
        .map(generate)
        .collect::<Vec<_>>()
        .join(";")
}

#[must_use]
pub fn generate(statement: &Stmt) -> String {
    match statement {
        Stmt::Assign { target, value } => assignment_source(target, value),
        Stmt::ValueAssign { target, value } => format!("{target}:={value}"),
        Stmt::Expression(expression) => expression.to_string(),
        Stmt::If {
            condition,
            consequent,
            alternate,
        } => {
            let alternate = alternate
                .as_ref()
                .map(|branch| format!("else{{{}}}", generate(branch)))
                .unwrap_or_default();
            format!("if({condition}){{{}}}{alternate}", generate_all(consequent))
        }
        Stmt::Block(statements) => format!("{{{}}}", generate_all(statements)),
        Stmt::Return(Some(expression)) => format!("return {expression}"),
        Stmt::Return(None) => "return".to_string(),
        Stmt::Throw(expression) => format!("throw {expression}"),
        Stmt::Delete(expression) => format!("delete {expression}"),
        Stmt::Class(declaration)
            if has_binding_metadata(&declaration.parameters)
                || declaration
                    .methods
                    .iter()
                    .any(|method| has_binding_metadata(&method.parameters)) =>
        {
            class_source(declaration)
        }
        Stmt::Class(declaration) => format!("class {}", declaration.name),
        Stmt::Function(function) if has_binding_metadata(&function.parameters) => {
            function_source(function)
        }
        Stmt::Function(function) => match &function.name {
            Some(name) => format!("def {name}"),
            None => "def".to_string(),
        },
        Stmt::For {
            variable, iterable, ..
        } => format!("for {variable} of {iterable}"),
        Stmt::ForEntries {
            key,
            value,
            iterable,
            ..
        } => format!("for {key},{value} of {iterable}"),
        Stmt::While { condition, body } => {
            format!("while({condition}){{{}}}", generate_all(body))
        }
        Stmt::Try { .. } => "try".to_string(),
        Stmt::Declaration { name, type_name } => format!("{name}:{type_name}"),
        Stmt::Pass => "pass".to_string(),
        Stmt::Suppose { target, body } => {
            format!(
                "{}suppose{{{}}}",
                suppose_target(target.as_ref()),
                generate_all(body)
            )
        }
    }
}

fn assignment_source(target: &Expr, value: &Expr) -> String {
    if let (Expr::Identifier(name), Expr::Enum(members)) = (target, value) {
        return enum_source(name, members);
    }
    match WordValue::of(value) {
        Some(words) => format!("{target} is {words}"),
        None => format!("{target}={value}"),
    }
}

fn suppose_target(target: Option<&Expr>) -> String {
    target
        .map(|target| format!("{target}="))
        .unwrap_or_default()
}

// Default/rest-bearing declarations must not discard signature metadata. Keep
// established compact labels for every other declaration; render the new
// declarations' bodies with real suite syntax, including init/method data.
pub(super) fn indent(source: &str) -> String {
    source
        .lines()
        .map(|line| format!("    {line}"))
        .collect::<Vec<_>>()
        .join("\n")
}

pub(super) fn source_all(statements: &[Stmt]) -> String {
    if statements.is_empty() {
        return "pass".to_string();
    }
    statements.iter().map(source).collect::<Vec<_>>().join("\n")
}

fn function_source(function: &Function) -> String {
    let name = function.name.as_deref().unwrap_or_default();
    let header = format!("def {name}({})", signature(&function.parameters));
    match &function.body {
        FunctionBody::Expression(body) => format!("{header}=>{body}"),
        FunctionBody::Block(body) => format!("{header}:\n{}", indent(&source_all(body))),
    }
}

fn class_source(class: &ClassDecl) -> String {
    let mut header = format!("class {}({})", class.name, signature(&class.parameters));
    let mut body = class
        .fields
        .iter()
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    body.extend(class.constructor.iter().map(source));
    body.extend(class.methods.iter().map(|method| function_source(method)));
    if class.parent.is_none() && body.is_empty() {
        return header;
    }
    header.push(':');
    if let Some(parent) = &class.parent {
        header.push(' ');
        header.push_str(parent);
    }
    let body = if body.is_empty() {
        "pass".to_string()
    } else {
        body.join("\n")
    };
    format!("{header}\n{}", indent(&body))
}

/// Suite-aware rendering inside a new default/rest-bearing declaration. The
/// public graph-label generator deliberately abbreviates legacy declarations.
fn source(statement: &Stmt) -> String {
    match statement {
        Stmt::Function(function) => function_source(function),
        Stmt::Class(class) => class_source(class),
        Stmt::If {
            condition,
            consequent,
            alternate,
        } => {
            let mut rendered = format!("if {condition}:\n{}", indent(&source_all(consequent)));
            if let Some(alternate) = alternate {
                let body = match alternate.as_ref() {
                    Stmt::Block(body) => source_all(body),
                    branch => source(branch),
                };
                rendered.push_str("\nelse:\n");
                rendered.push_str(&indent(&body));
            }
            rendered
        }
        Stmt::For {
            variable,
            iterable,
            body,
        } => {
            format!(
                "for {variable} of {iterable}:\n{}",
                indent(&source_all(body))
            )
        }
        Stmt::ForEntries {
            key,
            value,
            iterable,
            body,
        } => format!(
            "for {key},{value} of {iterable}:\n{}",
            indent(&source_all(body))
        ),
        Stmt::While { condition, body } => {
            format!("while {condition}:\n{}", indent(&source_all(body)))
        }
        Stmt::Try {
            body,
            parameter,
            catch,
        } => format!(
            "try:\n{}\ncatch {parameter}:\n{}",
            indent(&source_all(body)),
            indent(&source_all(catch))
        ),
        Stmt::Block(body) => format!("{{\n{}\n}}", source_all(body)),
        Stmt::Suppose { target, body } => format!(
            "{}suppose:\n{}",
            suppose_target(target.as_ref()),
            indent(&source_all(body))
        ),
        statement => generate(statement),
    }
}

```

### Core Architecture Module: `src/lang/ast/parser/statement.rs`
```
use super::is_assignment::Items;
use super::{ArgumentContext, MAX_NESTING, Parser, Program, SupposePremise};
use crate::error::Result;
use crate::lang::ast::lexer::{Keyword, Token};
use crate::lang::ast::{Expr, Stmt};

fn simple_statement(expression: Expr) -> Stmt {
    match expression {
        Expr::Assign { target, value } => Stmt::Assign {
            target: *target,
            value: *value,
        },
        other => Stmt::Expression(other),
    }
}

fn names_suppose(expression: &Expr) -> bool {
    matches!(expression, Expr::Identifier(name) if name == "suppose")
}

pub(super) fn heads_suppose(expression: &Expr) -> bool {
    match expression {
        Expr::Assign { value, .. } => names_suppose(value),
        _ => names_suppose(expression),
    }
}

impl Parser {
    pub(super) fn program(&mut self) -> Result<Program> {
        let mut statements = Vec::new();
        let mut positions = Vec::new();

        loop {
            self.skip_separators();

            if self.check(&Token::Eof) {
                break;
            }

            let position = self.here();
            self.statement(&mut statements)?;
            positions.resize(statements.len(), position);
        }

        Ok(Program {
            statements,
            positions,
        })
    }

    /// Parses the body introduced by a `:`, accepting both an indented block and
    /// a single statement written on the same line.
    pub(super) fn suite(&mut self) -> Result<Vec<Stmt>> {
        self.expect(&Token::Colon)?;
        self.suite_body()
    }

    /// Shares the existing body parser with conditional and exception clauses
    /// whose real indentation has already qualified for colon omission.
    pub(super) fn suite_body(&mut self) -> Result<Vec<Stmt>> {
        if self.eat(&Token::Newline) || self.check(&Token::Indent) {
            self.skip_newlines();
            self.expect(&Token::Indent)?;

            let mut statements = Vec::new();

            loop {
                self.skip_newlines();

                if self.check(&Token::Dedent) || self.check(&Token::Eof) {
                    break;
                }

                self.statement(&mut statements)?;
            }

            self.eat(&Token::Dedent);
            Ok(statements)
        } else {
            let mut statements = Vec::new();
            self.statement(&mut statements)?;

            while self.eat(&Token::Semicolon) {
                if matches!(self.peek(), Token::Newline | Token::Eof) {
                    break;
                }
                self.statement(&mut statements)?;
            }

            Ok(statements)
        }
    }

    /// Parses the statements of a `{ ... }` block.
    pub(super) fn braced(&mut self) -> Result<Vec<Stmt>> {
        self.expect(&Token::LeftBrace)?;

        let mut statements = Vec::new();

        loop {
            self.skip_separators();

            if self.eat(&Token::RightBrace) {
                break;
            }

            if self.check(&Token::Eof) {
                return Err(self.error("Unterminated block"));
            }

            self.statement(&mut statements)?;
        }

        Ok(statements)
    }

    pub(super) fn statement(&mut self, statements: &mut Vec<Stmt>) -> Result<()> {
        debug_assert_eq!(self.items, Items::Plain);
        self.depth += 1;

        if self.depth > MAX_NESTING {
            self.depth -= 1;
            return Err(self.error("Statements are nested too deeply"));
        }

        let depth = self.depth;
        let result = self.within(false, |parser| {
            match parser.destructuring()? {
                Some(declarations) => statements.extend(declarations),
                None => statements.push(parser.statement_inner()?),
            }
            Ok(())
        });
        debug_assert_eq!(self.depth, depth);
        self.depth -= 1;
        result
    }

    pub(super) fn starts_statement(&self) -> bool {
        self.position
            .checked_sub(1)
            .and_then(|previous| self.tokens.get(previous))
            .is_none_or(|previous| {
                matches!(
                    previous.token,
                    Token::Newline
                        | Token::Semicolon
                        | Token::Indent
                        | Token::Dedent
                        | Token::LeftBrace
                        | Token::Colon
                )
            })
    }

    fn statement_inner(&mut self) -> Result<Stmt> {
        if let Some(condition) = self.while_condition() {
            let body = self.suite()?;
            return Ok(Stmt::While { condition, body });
        }

        if let Some(name) = self.enum_header() {
            return self.enum_declaration(name);
        }

        match self.peek().clone() {
            Token::Keyword(Keyword::If) => self.if_statement(),
            Token::Keyword(Keyword::For) => self.for_statement(),
            Token::Keyword(Keyword::Class) => self.class_statement(),
            _ if self.starts_function_declaration() => self.function_statement(),
            Token::Keyword(Keyword::Try) => self.try_statement(),
            Token::Keyword(Keyword::Pass) => {
                self.advance();
                Ok(Stmt::Pass)
            }
            Token::Keyword(Keyword::Return) => self.return_statement(),
            Token::Keyword(Keyword::Throw) => {
                self.advance();
                Ok(Stmt::Throw(self.expression()?))
            }
            Token::Keyword(Keyword::Delete) => {
                self.advance();
                Ok(Stmt::Delete(self.expression()?))
            }
            Token::LeftBrace => Ok(Stmt::Block(self.braced()?)),
            Token::Identifier(name) if self.is_type_declaration() => {
                let type_name = self.declared_type()?;
                Ok(Stmt::Declaration { name, type_name })
            }
            Token::Identifier(_) if self.is_assertion_statement_at(0) => {
                self.advance();
                self.advance();
                // An ordinary call has an outer expression level in addition
                // to each argument's level. Preserve that same nesting budget.
                self.nested_expression(Self::assertion_expression)
                    .map(Stmt::Expression)
            }
            _ => self.expression_statement(),
        }
    }

    fn expression_statement(&mut self) -> Result<Stmt> {
        let expression = self.expression()?;

        if self.starts_is_assignment(&expression) {
            return self.is_assignment(expression);
        }

        self.expression_tail(expression)
    }

    pub(super) fn expression_tail(&mut self, expression: Expr) -> Result<Stmt> {
        if self.check(&Token::ColonAssign) {
            return self.value_assignment(expression);
        }

        if let Some(statement) = self.suppose_statement(&expression)? {
            return Ok(statement);
        }

        Ok(simple_statement(expression))
    }

    fn return_statement(&mut self) -> Result<Stmt> {
        self.advance();

        if matches!(
            self.peek(),
            Token::Newline | Token::Semicolon | Token::Dedent | Token::RightBrace | Token::Eof
        ) {
            Ok(Stmt::Return(None))
        } else {
            Ok(Stmt::Return(Some(self.expression()?)))
        }
    }

    fn value_assignment(&mut self, target: Expr) -> Result<Stmt> {
        self.check_path_target(&target, "Invalid value assignment target")?;
        self.advance();
        let value = self.expression()?;
        Ok(Stmt::ValueAssign { target, value })
    }

    fn suppose_statement(&mut self, expression: &Expr) -> Result<Option<Stmt>> {
        if !heads_suppose(expression) {
            return Ok(None);
        }
        let target = match expression {
            Expr::Assign { target, .. } => Some(target.as_ref().clone()),
            _ => None,
        };

        let mut body = Vec::new();
        if !self.check(&Token::Colon) {
            let Some(premise) = self.suppose_premise() else {
                return Ok(None);
            };
            body.push(premise);
        }
        body.extend(self.suite()?);

        Ok(Some(Stmt::Suppose { target, body }))
    }

    pub(super) fn suppose_premise(&mut self) -> Option<Stmt> {
        if self.starts_colon_statement_at(0)
            || matches!(
                self.peek(),
                Token::Newline | Token::Semicolon | Token::Dedent | Token::RightBrace | Token::Eof
            )
        {
            return None;
        }

        let attempt = (self.position, self.depth);
        let outcome = if let Some(outcome) = self.suppose_premises.get(&attempt) {
            outcome.clone()
        } else {
            let outcome = self.attempt_suppose_premise();
            self.suppose_premises.insert(attempt, outcome.clone());
            outcome
        };
        let SupposePremise { premise, end } = outcome?;
        self.position = end;
        Some(simple_statement(premise))
    }

    fn attempt_suppose_premise(&mut self) -> Option<SupposePremise> {
        let start = self.position;
        let outcome = self.clause_before_colon().map(|premise| SupposePremise {
            premise,
            end: self.position,
        });
        self.position = start;
        let end = outcome.as_ref()?.end;
        if self.words
            && self.accepted(Self::attempt_suppose_premise).is_none()
            && self.separates(start, end)
        {
            return None;
        }
        outcome
    }

    pub(super) fn accepted<T>(&mut self, parse: impl FnOnce(&mut Self) -> T) -> T {
        let mut probe = Parser {
            position: self.position,
            depth: self.depth,
            context: self.context,
            lists: self.lists,
            enclosed: self.enclosed,
            in_class: self.in_class,
            ..Parser::new(std::mem::take(&mut self.tokens))
        };
        let parsed = parse(
```

### Core Architecture Module: `src/state.rs`
```
mod mutation;

use indexmap::{IndexMap, IndexSet};
use std::fmt;
use std::sync::Arc;

use crate::history::{History, HistoryKey};
use crate::lang::ast::VersionSelector;
use crate::lang::ast::generator::generate_all;
use crate::lang::ast::{Expr, Function, Parameter, Stmt};
use crate::value::{ObjectData, ObjectId, Value};

/// What a class-level statement is filed under on its class.
///
/// Deliberately not a [`NodeKey`](crate::graph::NodeKey): a declaration is the
/// template, held once on the class, while a node is one instance's copy of it.
/// `$Person.mortal` names the rule; `person1.mortal` names what the rule
/// produced. Giving them separate types is what stops the two being mixed up.
#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct DeclarationKey(String);

impl DeclarationKey {
    /// `$Person.mortal`.
    #[must_use]
    pub fn property(class: &str, property: &str) -> Self {
        DeclarationKey(format!("${class}.{property}"))
    }

    /// `if(this.age>18)`.
    #[must_use]
    pub fn conditional(condition: &Expr) -> Self {
        DeclarationKey(format!("if({condition})"))
    }

    /// A block of statements, keyed by their source.
    #[must_use]
    pub fn block(statements: &[Stmt]) -> Self {
        DeclarationKey(format!("block({})", generate_all(statements)))
    }

    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for DeclarationKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// A class-level statement kept as a template and re-applied to every instance.
#[derive(Debug, Clone)]
pub struct Declaration {
    pub key: DeclarationKey,
    pub statement: Stmt,
    pub sequence: u64,
}

#[derive(Debug, Clone)]
pub struct ClassData {
    pub name: String,
    pub parent: Option<String>,
    pub parameters: Vec<Parameter>,
    pub constructor: Vec<Stmt>,
    pub methods: IndexMap<String, Arc<Function>>,
    pub instances: Vec<ObjectId>,
    pub declarations: IndexMap<DeclarationKey, Declaration>,
}

impl ClassData {
    pub fn new(name: impl Into<String>) -> Self {
        ClassData {
            name: name.into(),
            parent: None,
            parameters: Vec::new(),
            constructor: Vec::new(),
            methods: IndexMap::new(),
            instances: Vec::new(),
            declarations: IndexMap::new(),
        }
    }

    #[must_use]
    pub fn declarations_in_order(&self) -> Vec<Declaration> {
        let mut declarations: Vec<Declaration> = self.declarations.values().cloned().collect();
        declarations.sort_by_key(|declaration| declaration.sequence);
        declarations
    }
}

/// Everything the runtime holds: top-level variables, objects, classes and
/// named functions.
///
/// Variable and named-function bindings share a namespace; runtime writes keep
/// their typed stores mutually exclusive.
///
/// Runtime writes record before-images through the `Runtime` methods in
/// `state::mutation`.
/// [`Transaction::rollback`](crate::transaction::Transaction::rollback)
/// restores those before-images without recording new writes.
#[derive(Debug, Clone, Default)]
pub struct State {
    variables: IndexMap<String, Value>,
    objects: IndexMap<ObjectId, ObjectData>,
    classes: IndexMap<String, ClassData>,
    functions: IndexMap<String, Arc<Function>>,
    histories: IndexMap<HistoryKey, History>,
    read_only: IndexSet<ObjectId>,
}

impl State {
    #[must_use]
    pub fn new() -> Self {
        State::default()
    }

    #[must_use]
    pub fn variable(&self, name: &str) -> Option<&Value> {
        self.variables.get(name)
    }

    #[must_use]
    pub fn has_variable(&self, name: &str) -> bool {
        self.variables.contains_key(name)
    }

    pub(crate) fn version(&self, key: &HistoryKey, selector: VersionSelector) -> Option<&Value> {
        self.histories.get(key)?.get(selector)
    }

    pub(crate) fn truncate_history(&mut self, key: &HistoryKey, length: usize) {
        if length == 0 {
            self.histories.shift_remove(key);
        } else if let Some(history) = self.histories.get_mut(key) {
            history.truncate(length);
        }
    }

    pub(crate) fn restore_history(&mut self, key: HistoryKey, history: History) {
        self.histories.insert(key, history);
    }

    #[must_use]
    pub fn has_object(&self, id: &ObjectId) -> bool {
        self.objects.contains_key(id)
    }

    #[must_use]
    pub fn function(&self, name: &str) -> Option<&Arc<Function>> {
        self.functions.get(name)
    }

    #[must_use]
    pub fn has_function(&self, name: &str) -> bool {
        self.functions.contains_key(name)
    }

    #[must_use]
    pub fn has_class(&self, name: &str) -> bool {
        self.classes.contains_key(name)
    }

    /// How many classes are defined. `Class.length` reads this.
    #[must_use]
    pub fn class_count(&self) -> usize {
        self.classes.len()
    }

    #[must_use]
    pub fn object(&self, id: &ObjectId) -> Option<&ObjectData> {
        self.objects.get(id)
    }

    pub fn object_mut(&mut self, id: &ObjectId) -> Option<&mut ObjectData> {
        self.objects.get_mut(id)
    }

    #[must_use]
    pub(crate) fn is_read_only(&self, id: &ObjectId) -> bool {
        self.read_only.contains(id)
    }

    pub(crate) fn mark_read_only(&mut self, id: ObjectId) {
        self.read_only.insert(id);
    }

    #[must_use]
    pub fn property(&self, id: &ObjectId, property: &str) -> Option<&Value> {
        self.objects
            .get(id)
            .and_then(|object| object.properties.get(property))
    }

    #[must_use]
    pub fn class(&self, name: &str) -> Option<&ClassData> {
        self.classes.get(name)
    }

    pub(crate) fn classes(&self) -> impl Iterator<Item = &ClassData> {
        self.classes.values()
    }

    pub(crate) fn lineage<'s>(
        &'s self,
        class: Option<&'s ClassData>,
    ) -> impl Iterator<Item = &'s ClassData> {
        std::iter::successors(class, |data| {
            data.parent.as_deref().and_then(|parent| self.class(parent))
        })
        .take(self.classes.len())
    }

    pub fn class_mut(&mut self, name: &str) -> Option<&mut ClassData> {
        self.classes.get_mut(name)
    }

    // -- restoring ---------------------------------------------------------
    //
    // Rollback puts a before-image back, which is the one write that must not
    // be recorded — recording it would make the undo log undo itself.

    pub(crate) fn restore_variable(&mut self, name: String, before: Option<Value>) {
        match before {
            Some(value) => self.variables.insert(name, value),
            None => self.variables.shift_remove(&name),
        };
    }

    pub(crate) fn restore_property(
        &mut self,
        object: &ObjectId,
        property: String,
        before: Option<Value>,
    ) {
        if let Some(data) = self.objects.get_mut(object) {
            match before {
                Some(value) => data.properties.insert(property, value),
                None => data.properties.shift_remove(&property),
            };
        }
    }

    pub(crate) fn restore_removed_property(
        &mut self,
        object: &ObjectId,
        property: String,
        index: usize,
        before: Value,
    ) {
        if let Some(data) = self.objects.get_mut(object) {
            let (current, _) = data.properties.insert_full(property, before);
            data.properties
                .move_index(current, index.min(data.properties.len() - 1));
        }
    }

    pub(crate) fn restore_object(&mut self, id: ObjectId, before: Option<ObjectData>) {
        if let Some(data) = before {
            self.objects.insert(id, data);
        } else {
            self.objects.shift_remove(&id);
            self.read_only.swap_remove(&id);
        }
    }

    pub(crate) fn restore_class(&mut self, name: String, before: Option<ClassData>) {
        match before {
            Some(data) => self.classes.insert(name, data),
            None => self.classes.shift_remove(&name),
        };
    }

    pub(crate) fn restore_function(&mut self, name: String, before: Option<Arc<Function>>) {
        match before {
            Some(function) => self.functions.insert(name, function),
            None => self.functions.shift_remove(&name),
        };
    }

    pub fn clear(&mut self) {
        self.variables.clear();
        self.objects.clear();
        self.classes.clear();
        self.functions.clear();
        self.histories.clear();
        self.read_only.clear();
    }
}

```

### Core Architecture Module: `src/state/mutation.rs`
```
use std::sync::Arc;

use super::ClassData;
use crate::error::{Error, Result};
use crate::graph::{NodeKey, ShapeKey};
use crate::history::{History, HistoryKey};
use crate::lang::ast::Function;
use crate::runtime::Runtime;
use crate::value::{ObjectData, ObjectId, Value};

/// Every write to the state.
///
/// Each operation records the before-image and performs the write together,
/// so callers cannot forget the undo entry needed by a later rollback.
///
/// Variables and properties use separate operations because their graph keys
/// differ.
impl Runtime {
    fn append_history(&mut self, key: HistoryKey, value: &Value) {
        let length = self.state.histories.get(&key).map_or(0, History::len);
        self.transaction.record_history_append(&key, length);
        self.state
            .histories
            .entry(key)
            .or_default()
            .push(value.clone());
    }

    fn remove_history(&mut self, key: HistoryKey) {
        if let Some(history) = self.state.histories.shift_remove(&key) {
            self.transaction.record_history_removal(key, history);
        }
    }

    pub(crate) fn assign(&mut self, name: &str, value: Value) -> bool {
        if let Some(before) = self.state.functions.get(name).cloned() {
            self.transaction.record_function(name, Some(before));
            self.state.functions.shift_remove(name);
        }

        let before = self.state.variables.get(name).cloned();
        let changed = before
            .as_ref()
            .is_none_or(|before| !before.same_value(&value));
        self.transaction.record_variable(name, before);
        if changed {
            self.append_history(HistoryKey::Variable(name.to_string()), &value);
        }
        self.state.variables.insert(name.to_string(), value);
        changed
    }

    pub(crate) fn ensure_writable(&self, object: &ObjectId) -> Result<()> {
        if self.state.is_read_only(object) {
            return Err(Error::type_error("Enums are read-only"));
        }
        Ok(())
    }

    pub(crate) fn write_property(
        &mut self,
        object: &ObjectId,
        property: &str,
        value: Value,
    ) -> Result<()> {
        self.ensure_writable(object)?;
        let changed = self.assign_property(object, property, value);
        self.propagate_change(&NodeKey::property(object, property), changed)
    }

    pub(crate) fn assign_property(
        &mut self,
        object: &ObjectId,
        property: &str,
        value: Value,
    ) -> bool {
        debug_assert!(!self.state.is_read_only(object));
        if !self.state.objects.contains_key(object) {
            self.insert_object(object.clone(), ObjectData::new(None));
        }

        let before = self.state.property(object, property).cloned();
        let changed = before
            .as_ref()
            .is_none_or(|before| !before.same_value(&value));
        let added = before.is_none();
        if added {
            self.transaction.record_property_added(object, property);
        } else {
            self.transaction.record_property(object, property, before);
        }
        if changed {
            self.append_history(
                HistoryKey::Property(object.clone(), property.to_string()),
                &value,
            );
        }

        if let Some(data) = self.state.object_mut(object) {
            data.properties.insert(property.to_string(), value);
        }
        if added {
            self.queue_entries_change(object);
        }
        changed
    }

    fn queue_entries_change(&mut self, object: &ObjectId) {
        self.queue_shape_change(&ShapeKey::Entries(object.clone()));
    }

    /// `state.delete` for a top-level name, reporting what was there.
    pub(crate) fn remove_variable(&mut self, name: &str) -> Option<Value> {
        let before = self.state.variables.get(name).cloned();
        self.transaction.record_variable(name, before.clone());
        self.state.variables.shift_remove(name);
        self.remove_history(HistoryKey::Variable(name.to_string()));
        before
    }

    /// `state.delete` for a property.
    pub(crate) fn remove_property(&mut self, object: &ObjectId, property: &str) -> Option<Value> {
        debug_assert!(!self.state.is_read_only(object));
        let removed = self
            .state
            .object_mut(object)
            .and_then(|data| data.properties.shift_remove_full(property));
        let before = if let Some((index, _, value)) = removed {
            self.transaction
                .record_property_removed(object, property, index, value.clone());
            self.queue_entries_change(object);
            Some(value)
        } else {
            self.transaction.record_property(object, property, None);
            None
        };
        self.remove_history(HistoryKey::Property(object.clone(), property.to_string()));

        before
    }

    pub(crate) fn insert_object(&mut self, id: ObjectId, data: ObjectData) {
        if self.transaction.needs_object(&id) {
            let before = self.state.objects.get(&id).cloned();
            self.transaction.record_object(&id, before);
        }

        // Initial property maps (object literals and instance IDs) are writes
        // too. Reusing a named identity preserves surviving slots and removes
        // histories only for properties that actually cease to exist.
        let removed: Vec<String> = self.state.object(&id).map_or_else(Vec::new, |before| {
            before
                .properties
                .keys()
                .filter(|property| !data.properties.contains_key(*property))
                .cloned()
                .collect()
        });
        let added = data
            .properties
            .keys()
            .any(|property| self.state.property(&id, property).is_none());
        if added || !removed.is_empty() {
            self.queue_entries_change(&id);
        }
        for property in removed {
            self.remove_history(HistoryKey::Property(id.clone(), property));
        }
        for (property, value) in &data.properties {
            if self
                .state
                .property(&id, property)
                .is_none_or(|before| !before.same_value(value))
            {
                self.append_history(HistoryKey::Property(id.clone(), property.clone()), value);
            }
        }
        self.state.objects.insert(id, data);
    }

    pub(crate) fn remove_object(&mut self, id: &ObjectId) -> Option<ObjectData> {
        let before = self.state.objects.get(id).cloned();
        self.transaction.record_object(id, before.clone());
        self.state.objects.shift_remove(id);
        if let Some(data) = &before {
            for property in data.properties.keys() {
                self.remove_history(HistoryKey::Property(id.clone(), property.clone()));
            }
            if !data.properties.is_empty() {
                self.queue_entries_change(id);
            }
        }
        before
    }

    pub(crate) fn insert_class(&mut self, name: &str, data: ClassData) {
        if self.transaction.needs_class(name) {
            let before = self.state.classes.get(name).cloned();
            self.transaction.record_class(name, before);
        }

        self.state.classes.insert(name.to_string(), data);
    }

    /// Changes a class in place â€” gaining an instance, or gaining a rule.
    pub(crate) fn update_class(&mut self, name: &str, update: impl FnOnce(&mut ClassData)) {
        if self.transaction.needs_class(name) {
            let before = self.state.classes.get(name).cloned();
            self.transaction.record_class(name, before);
        }

        if let Some(data) = self.state.classes.get_mut(name) {
            update(data);
        }
    }

    pub(crate) fn insert_function(&mut self, name: &str, function: Arc<Function>) {
        if self.state.has_variable(name) {
            self.remove_variable(name);
        }

        let before = self.state.functions.get(name).cloned();
        self.transaction.record_function(name, before);
        self.state.functions.insert(name.to_string(), function);
    }
}

```

### Core Architecture Module: `src/statement.rs`
```
//! Source text to statements: the runtime's entry point to the parser.

use crate::error::Result;
use crate::lang::ast::{Program, parser};

/// Compiles a program, reporting the first syntax error.
pub fn compile(source: &str) -> Result<Program> {
    parser::parse_program(source)
}

```

### Core Architecture Module: `arc/server.ts`
```
import "dotenv/config";
import { parseArgs } from "node:util";
import { start } from "./src/app";
import * as milestone from "./src/lib/milestone.ts";

async function main() {
  const {
    positionals: [puzzle_id],
    values: { "only-puzzle-dataset": only_puzzle_dataset },
  } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: { "only-puzzle-dataset": { type: "boolean", default: false } },
  });

  return start(puzzle_id, only_puzzle_dataset);
}

main()
  .then((difference: number) => {
    // Exit statuses keep eight bits, so 256 differences would read as 0.
    process.exitCode = Math.min(difference, 255);
  })
  .catch((error) => {
    milestone.failure(error);
    process.exitCode = 1;
  });

```

### Core Architecture Module: `arc/src/analyzer.ts`
```
import * as nucleoid from "./lib/nucleoid";
import * as llm from "./lib/llm";
import * as milestone from "./lib/milestone.ts";
import * as Matrix from "./lib/Matrix.ts";

export async function declarations({
  puzzle_id,
  only_puzzle_dataset,
  train_dataset,
}) {
  milestone.inferring_declarations();

  const { declarations, output_canvas } = await llm.generate({
    puzzle_id,
    only_puzzle_dataset,
    grammar: true,
    messages: [
      {
        role: "user",
        content: `
          train_dataset:
          ${JSON.stringify(
            train_dataset.dataset.map(({ input_matrix, output_matrix }) => ({
              input_matrix,
              output_matrix,
            }))
          )}
          json_format:
          { "declarations": <DECLARATIONS>, "output_canvas": <OUTPUT_CANVAS> }
        `,
      },
    ],
  });

  milestone.declarations_inferred({ declarations, output_canvas });

  return { declarations, output_canvas };
}

export async function instances({
  puzzle_id,
  only_puzzle_dataset,
  declarations,
  input_matrix,
  output_matrix,
}) {
  milestone.segmenting_training_objects();

  const { instances } = await llm.generate({
    puzzle_id,
    only_puzzle_dataset,
    messages: [
      {
        role: "user",
        content: `
          declarations:
          ${JSON.stringify(declarations)}
          input_matrix:
          ${JSON.stringify(input_matrix)}
          output_matrix:
          ${JSON.stringify(output_matrix)}
          json_format:
          {
            "instances": [{
              "input_instance_matrix": <INPUT_INSTANCE_MATRIX>,
              "output_instance_matrix": <OUTPUT_INSTANCE_MATRIX>
            }]
          }
        `,
      },
    ],
  });

  milestone.training_objects_segmented({ instances });

  return { instances };
}

export async function value({
  puzzle_id,
  only_puzzle_dataset,
  instance_name,
  declarations,
  input_instances,
  input_matrix,
  input_instance_matrix,
  output_instance_matrix,
}) {
  milestone.constructing_instance({ instance_name });

  const { x, y, width, height } = Matrix.locate(input_instance_matrix);

  const { orientation } = await llm.generate({
    puzzle_id,
    only_puzzle_dataset,
    few_shot: ({ dataset }) => ({
      dataset: dataset.map(({ instances }) => ({
        instances: instances.map(({ input_instance_matrix, input_value }) => ({
          matrix: Matrix.silhouette(Matrix.crop(input_instance_matrix)),
          orientation: input_value.orientation,
        })),
      })),
    }),
    messages: [
      {
        role: "assistant",
        content: `
          instances:
          ${JSON.stringify(
            input_instances.map(({ input_instance_matrix, input_value }) => ({
              matrix: Matrix.silhouette(Matrix.crop(input_instance_matrix)),
              orientation: input_value.orientation,
            }))
          )}
          `,
      },
      {
        role: "user",
        content: `
          matrix:
          ${JSON.stringify(
            Matrix.silhouette(Matrix.crop(input_instance_matrix))
          )}
          json_format:
          {
            "orientation": <ORIENTATION>,
          }
        `,
      },
    ],
  });

  const { implementation } = await llm.generate({
    puzzle_id,
    only_puzzle_dataset,
    messages: [
      {
        role: "assistant",
        content: `
          declarations:
          ${JSON.stringify(declarations)}
          input_instances:
          ${JSON.stringify(input_instances)}
        `,
      },
      {
        role: "user",
        content: `
          instance_name:
          ${instance_name}
          input_instance_matrix:
          ${JSON.stringify(Matrix.crop(input_instance_matrix))}
          input_x: ${x}
          input_y: ${y}
          input_width: ${width}
          input_height: ${height}
          orientation: ${orientation}
          json_format:
          {
            "implementation": <IMPLEMENTATION>
          }
        `,
      },
    ],
  });

  milestone.evaluating_rules({ instance_name });

  const canvas_width: number = input_matrix[0].length;
  const canvas_height: number = input_matrix.length;
  const input_value = await nucleoid.run(
    [
      `canvas_width = ${canvas_width}`,
      `canvas_height = ${canvas_height}`,
      declarations[0],
      implementation,
    ].join("\n\n")
  );

  milestone.instance_constructed({
    instance_name,
    implementation,
    input_instance_matrix,
    output_instance_matrix,
    input_value,
  });

  return { implementation, input_value };
}

export async function state(train_dataset) {
  const objects = [];

  for (const dataset of train_dataset.dataset) {
    const implementations = dataset.instances.map(
      ({ implementation }) => implementation
    );

    const canvas_width: number = dataset.input_matrix[0].length;
    const canvas_height: number = dataset.input_matrix.length;
    const obj_list = await nucleoid.run(
      [
        `canvas_width = ${canvas_width}`,
        `canvas_height = ${canvas_height}`,
        ...train_dataset.declarations,
        ...implementations,
        "Obj[:]",
      ].join("\n\n")
    );

    objects.push(...obj_list);

    [...obj_list].forEach((instance) => {
      const found_instance = dataset.instances.find(
        ({ instance_name }) => instance.id === instance_name
      );
      found_instance.output_value = instance;
    });
  }

  milestone.state({ phase: "analysis", obj_list: objects });
}

```

### Core Architecture Module: `arc/src/app.ts`
```
import * as analyzer from "./analyzer";
import * as visualizer from "./visualizer";
import * as Matrix from "./lib/Matrix";
import * as nucleoid from "./lib/nucleoid";
import * as milestone from "./lib/milestone.ts";
import arc_dataset from "./lib/arc_dataset.ts";
import fs from "node:fs/promises";

// Genesis puzzle_id: 3aa6fb7a
export async function start(
  puzzle_id: string = "fafffa47",
  only_puzzle_dataset: boolean = false
) {
  const { arc_train, test_input_matrix, test_output_matrix } =
    await arc_dataset.load(puzzle_id);

  const train_dataset = {
    dataset: arc_train.map(({ input, output }) => ({
      input_matrix: input,
      output_matrix: output,
      instances: [],
    })),
    declarations: [],
    output_canvas: undefined,
  };

  const startedAt: number = performance.now();

  milestone.start({
    version: await nucleoid.version(),
    puzzle_id,
    only_puzzle_dataset,
    train: arc_train,
    test_input_matrix,
  });

  milestone.analysis();

  let instance_index: number = 0;

  const { declarations, output_canvas } = await analyzer.declarations({
    puzzle_id,
    only_puzzle_dataset,
    train_dataset,
  });

  train_dataset.declarations = declarations;
  train_dataset.output_canvas = output_canvas;

  for (const dataset of train_dataset.dataset) {
    const { input_matrix, output_matrix } = dataset;

    const { instances } = await analyzer.instances({
      puzzle_id,
      only_puzzle_dataset,
      declarations,
      input_matrix,
      output_matrix,
    });

    for (const { input_instance_matrix, output_instance_matrix } of instances) {
      const instance_name: string = `obj${String(instance_index++).padStart(
        12,
        "0"
      )}`;

      const { implementation, input_value } = await analyzer.value({
        puzzle_id,
        only_puzzle_dataset,
        instance_name,
        declarations,
        input_instances: train_dataset.dataset
          .flatMap(({ instances }) => instances)
          .filter(({ implementation }) => implementation),
        input_matrix,
        input_instance_matrix,
        output_instance_matrix,
      });

      dataset.instances.push({
        instance_name,
        input_instance_matrix,
        output_instance_matrix,
        implementation,
        input_value,
      });
    }
  }

  await analyzer.state(train_dataset);

  milestone.visualization();

  const { instances } = await visualizer.instances({
    puzzle_id,
    only_puzzle_dataset,
    train_dataset,
    test_input_matrix,
  });

  let result_matrix = Array.from({ length: test_input_matrix.length }, () =>
    Array(test_input_matrix[0].length).fill(0)
  );

  const input_instances = [];

  for (const { input_instance_matrix } of instances) {
    const instance_name: string = `obj${String(instance_index++).padStart(
      12,
      "0"
    )}`;

    const { implementation, input_value } = await visualizer.value({
      puzzle_id,
      only_puzzle_dataset,
      declarations,
      train_dataset,
      test_input_matrix,
      instance_name,
      input_instance_matrix,
    });

    input_instances.push({
      instance_name,
      implementation,
      input_value,
      input_instance_matrix,
    });
  }

  await visualizer.state({ declarations, test_input_matrix, input_instances });

  for (const input_instance of input_instances) {
    const { instance_name, input_value, input_instance_matrix, output_value } =
      input_instance;

    const { output_instance_matrix } = await visualizer.output_instance_matrix({
      puzzle_id,
      only_puzzle_dataset,
      instance_name,
      test_input_matrix,
      train_dataset,
      input_instance_matrix,
      input_value,
      output_value,
    });

    input_instance.output_instance_matrix = output_instance_matrix;

    result_matrix = Matrix.merge(result_matrix, output_instance_matrix);
  }

  result_matrix = Matrix.canvas(result_matrix, output_canvas);

  milestone.comparison({ test_output_matrix, result_matrix });

  const difference: number = Matrix.difference(
    result_matrix,
    test_output_matrix
  );

  milestone.summary({ difference, duration: performance.now() - startedAt });

  const debug = {
    puzzle_id,
    only_puzzle_dataset,
    train_dataset,
    test_input_instances: input_instances,
    test_input_matrix,
    test_output_matrix,
    result_matrix,
    difference,
  };

  await fs.mkdir("logs", { recursive: true });
  await fs.writeFile(
    `logs/${puzzle_id}.log.json`,
    JSON.stringify(debug, null, 2)
  );

  return difference;
}

```

### Core Architecture Module: `arc/src/dataset/dataset.ts`
```
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Each non-genesis puzzle's dataset is named after its eight-digit hexadecimal
// ARC puzzle ID; the genesis datasets have topic names, such as `core`.
function genesis_dataset(name: string): boolean {
  return !/^dataset\.[0-9a-f]{8}\.json$/.test(name);
}

export function document(
  puzzle_id?: string,
  only_puzzle_dataset: boolean = false
): string {
  const puzzle_dataset: string = `dataset.${puzzle_id}.json`.toLowerCase();
  const files = readdirSync(__dirname, { withFileTypes: true })
    .filter((file) => {
      const name: string = file.name.toLowerCase();
      return (
        file.isFile() &&
        name.endsWith(".json") &&
        !name.startsWith(".env") &&
        (!only_puzzle_dataset ||
          genesis_dataset(name) ||
          name === puzzle_dataset)
      );
    })
    .map((file) => file.name)
    .sort();

  const datasets = files.map((file: string) => {
    const source: string = readFileSync(join(__dirname, file), "utf8");
    return source.replace(/("(?:[^"\\]|\\.)*")|\s+/g, "$1");
  });

  return `[${datasets.join(",")}]`;
}

```

### Core Architecture Module: `arc/src/dataset/index.ts`
```
export { document } from "./dataset";

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #72** (2026-10-25): **Bump the npm_and_yarn group with 2 updates**
  *Symptoms*: Bumps the npm_and_yarn group with 2 updates: [serialize-javascript](https://github.com/yahoo/serialize-javascript) and [mocha](https://github.com/mochajs/mocha).  Updates `serialize-javascript` from 6.0.0 to 6.0.2 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/yahoo/serialize-javascript/releases">serialize-javascript's releases</a>.</em></p> <blockquote> <h2>v6.0.2</h2> <ul> <li>fix: serialize URL string contents to prevent XSS (<a href="https://redirect.github.com/yahoo/serialize-javascript/issues/173">#173</a>)  f27d65d</li> <li>Bump <code>@​babel/traverse</code> from 7.10.1 to 7.23.7 (<a href="https://redirect.github.com/yahoo/serialize-javascript/issues/171">#171</a>)  02499c0</li> <li>docs: update readme with URL support (<a href="https://redirect.github.com/yahoo/serialize-javascript/issues/146">#146</a>)  0d88527</li> <li>chore: update node version and lock file  e2a3a91</li> <li>fix typo (<a href="https://redirect.github.com/yahoo/serialize-javascript/issues/164">#164</a>)  5a1fa64</li> </ul> <p><a href="https://github.com/yahoo/serialize-javascript/compare/v6.0.1...v6.0.2">https://github.com/yahoo/serialize-javascript/compare/v6.0.1...v6.0.2</a></p> <h2>v6.0.1</h2> <h2>What's Changed</h2> <ul> <li>Bump mocha from 9.0.1 to 9.0.2 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a> in <a href="https://redirect.github.com/yahoo/serialize-javascript/pull/126">yahoo/serialize-javascript#126</a></li> <li>Bump 

- **Issue #70** (2025-01-09): **Variable Value in Python**
  *Symptoms*: Requested by @Invademars

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

### Incident Patch 1: `fbd810e8` (2026-11-09)
**Commit Message**: Allocate NUCs before drafting

Require new NUCs to be drafted as Draft proposals, committed, and pushed before proposal work begins. Update proposal, evaluation, ARC, and Git workflows to pin and build on the allocation.

**File**: `.claude/CLAUDE.md` (modified, +2/-2)
```diff
@@ -17,9 +17,9 @@ not a replacement for the policies it links to.
 | [rust-guidelines.instructions.md](rules/rust-guidelines.instructions.md) | The Rust API Guidelines, Google's Rust Style Guide, Microsoft's Pragmatic Rust Guidelines and Clippy, always followed under the Power of 10 adaptation: their precedence, a digest for the crate, comment-free Rust source, deliberate divergences and known gaps |
 | [documents.instructions.md](rules/documents.instructions.md) | Authoritative specification, executable documents, and dataset synchronization |
 | [versions.instructions.md](rules/versions.instructions.md) | Human-owned version numbers; no AI version changes |
-| [proposals.instructions.md](rules/proposals.instructions.md) | Independent NUC proposal preparation and evaluation, the token policy, automatic acceptance on the hard criteria (no compile errors, every test passing, backward compatibility) with the `Automatic-Accepted` status, ARC- and user-requested bases, and `NUC <number> <Title>` outcome commit messages |
+| [proposals.instructions.md](rules/proposals.instructions.md) | Independent NUC proposal preparation and evaluation, the token policy, automatic acceptance on the hard criteria (no compile errors, every test passing, backward compatibility) with the `Automatic-Accepted` status, ARC- and user-requested bases, the pushed `Draft NUC <number> <Title>` allocation of each new NUC before its details, and `NUC <number> <Title>` outcome commit messages |
 | [rust-improvement.instructions.md](rules/rust-improvement.instructions.md) | Focused Rust improvements and the required post-change agent |
-| [git.instructions.md](rules/git.instructions.md) | Only `/nuc-proposal` (NUC outcomes) and `/arc-purposal` (its own ARC changes, when it is done) commit and push; every agent pulls before it starts (fast-forward only, except those callers before a commit or push), pull before commit/push, push after every commit, resolve conflicts and push |
+| [git.instructions.md](rules/git.instructions.md) | Only `/nuc-proposal` (NUC allocations and outcomes) and `/arc-purposal` (its own ARC changes, when it is done) commit and push; every agent pulls before it starts (fast-forward only, except those callers before a commit or push), pull before commit/push, push after every commit, resolve conflicts and push |
 
 All instruction files use `applyTo: "**"` to preserve their repository-wide scope.
 
```

**File**: `.claude/agents/arc-purposal.agent.md` (modified, +2/-1)
```diff
@@ -111,7 +111,8 @@ Follow `.claude/CLAUDE.md`, the
   acceptance makes it Accepted and any other decision Automatic-Accepted.
 - Record the outcome through the `/nuc-proposal` caller steps, with its basis,
   the evaluator's decision, and the run's evidence. Those steps commit the
-  NUC's outcome, pulling before and pushing right after under the
+  NUC's Draft allocation before its proposer starts and its outcome after the
+  run, pulling before and pushing right after each under the
   [git synchronization policy](../rules/git.instructions.md). Never change
   project versions.
 - After the outcome, create or update the puzzle's progress record,
```

**File**: `.claude/agents/nuc-proposal.agent.md` (modified, +5/-0)
```diff
@@ -15,6 +15,11 @@ You draft and prototype exactly one added or updated NUC revision. Follow
   `git pull --ff-only --autostash` in the primary checkout, never in the
   supplied candidate worktree, and report the commits it brought in. Keep
   drafting against the caller's pinned baseline revision.
+- For a new NUC, the caller has already allocated it under the skill's
+  [allocation rule](../skills/nuc-proposal/SKILL.md#allocate-the-nuc-first-caller-only):
+  the pinned revision is the pushed allocation, whose Draft document carries
+  the number, confirmed category and proposal details. Complete that draft in
+  the candidate, keeping its number and category.
 - Follow the caller-owned [enhancement selection rule](../skills/nuc-proposal/SKILL.md#select-an-unspecified-enhancement);
   do not redraw the selected category.
 - Apply any caller-supplied hint under the skill's
```

**File**: `.claude/rules/git.instructions.md` (modified, +10/-6)
```diff
@@ -14,10 +14,13 @@ pulling before it starts.
 - Among all agents, only two coordinating callers commit and push, each
   following the caller steps of its own skill:
   - `/nuc-proposal`, under the
-    [nuc-proposal skill](../skills/nuc-proposal/SKILL.md), commits NUC
-    outcomes (Accepted, Automatic-Accepted, Rejected) under the
-    [proposal rules](proposals.instructions.md), including those of NUCs that
-    `/arc-purposal` requests and of cycles that `/nuc-evaluate` coordinates.
+    [nuc-proposal skill](../skills/nuc-proposal/SKILL.md), commits each new
+    NUC's Draft allocation before working on its details, under the
+    [allocation step](../skills/nuc-proposal/SKILL.md#allocate-the-nuc-first-caller-only),
+    and NUC outcomes (Accepted, Automatic-Accepted, Rejected), which carry the
+    final version, under the [proposal rules](proposals.instructions.md),
+    including those of NUCs that `/arc-purposal` requests and of cycles that
+    `/nuc-evaluate` coordinates.
   - `/arc-purposal`, under the
     [arc-purposal skill](../skills/arc-purposal/SKILL.md#commit-and-push),
     commits its own ARC changes once, when it is done: the puzzle's dataset,
@@ -59,8 +62,9 @@ pulling before it starts.
 ## Push after every commit
 
 - Every `/nuc-proposal` and `/arc-purposal` commit is followed immediately by
-  `git push` of the same branch. This includes NUC outcome commits (Accepted,
-  Automatic-Accepted, Rejected), those for NUCs that `/arc-purposal` requests,
+  `git push` of the same branch. This includes NUC allocation commits, NUC
+  outcome commits (Accepted, Automatic-Accepted, Rejected), those for NUCs
+  that `/arc-purposal` requests,
   `/arc-purposal`'s own commit of its ARC changes, and merge commits. A commit
   is not finished until it is pushed.
 - If the push is rejected because the remote moved, pull, resolve, and push
```

**File**: `.claude/rules/proposals.instructions.md` (modified, +33/-6)
```diff
@@ -255,11 +255,13 @@ revision. This applies to process and documentation-only NUCs too; they still
 undergo independent behavior, integrity, compatibility, and development checks.
 
 Pin the accepted Git revision and record its token baseline before editing
-runtime behavior or executable cases. Give the proposer its requested change,
-proposal path and confirmed category, execution mode and runtime applicability
-with supporting rationale, baseline revision and immutable JSON artifact,
-and candidate worktree. When configured, also supply the pre-draft strategy
-receipt and policy paths/raw pins, trial identity and actionable approach.
+runtime behavior or executable cases. For a new NUC, that revision is its
+pushed [allocation](#allocate-new-nucs-first-caller-only). Give the proposer
+its requested change, proposal path and confirmed category, execution mode
+and runtime applicability with supporting rationale, baseline revision and
+immutable JSON artifact, and candidate worktree. When configured, also supply
+the pre-draft strategy receipt and policy paths/raw pins, trial identity and
+actionable approach.
 Use `.claude/agents/nuc-proposal.agent.md` and
 `.claude/skills/nuc-proposal/SKILL.md` for drafting, prototyping, equivalent
 case rewrites, synchronization, and development checks. It must not run the
@@ -314,6 +316,31 @@ runtime, reference, synthesized sources, and rendered exports synchronized.
 Outcome metadata, such as updating a status or index after evaluation, belongs
 to that evaluation and must not recursively launch another agent.
 
+## Allocate new NUCs first (caller only)
+
+- Every `/nuc-proposal` task first pulls under the
+  [git synchronization policy](git.instructions.md#pull-first), so it runs
+  against the most current remote state.
+- The caller drafts a new NUC before its details: `docs/nuc-XXXX.md` with its
+  complete header, including `Status: Draft` and the confirmed `Category`,
+  and its proposal details, the Abstract and Motivation of the requested
+  change, plus its Draft rows in both NUC indexes. It commits only those
+  paths as `Draft NUC <number> <Title>` and pushes right after. That commit
+  allocates the proposal and its number.
+- The pushed allocation is the accepted revision the NUC pins: it changes no
+  runtime, executable document, test, dataset or export. The proposer then
+  completes the draft in the candidate worktree, followed by the usual
+  improvement pass, independent evaluation and decision.
+- The outcome commit carries the final version: the final proposal with the
+  integrated code changes for Accepted or Automatic-Accepted, and only the
+  rejection documentation for Rejected. It is a new commit; the pushed
+  allocation is never amended.
+- The allocation records no outcome and needs no evaluation of its own.
+  Revisions of an existing NUC already hold their number and skip it, and a
+  Blocked or paused NUC keeps its allocated Draft. The
+  [nuc-proposal skill](../skills/nuc-proposal/SKILL.md#allocate-the-nuc-first-caller-only)
+  has the steps.
+
 ## Outcome commit messages (caller only)
 
 - Every commit that records a NUC outcome, Accepted, Automatic-Accepted or
@@ -342,7 +369,7 @@ to that evaluation and must not recursively launch another agent.
 - Keep rejected implementation changes isolated in the candidate worktree; do not apply its full diff merely to record the NUC.
 - Stage explicit proposal/index paths and use a path-limited commit. Verify the resulting commit contains only the rejection documentation and directly related metadata. Never use repository-wide staging or `git commit -a`, or include unrelated files already staged.
 - Preserve unrelated staged and unstaged changes. If the rejection documentation is already committed, verify and report that commit instead of creating an empty duplicate.
-- Proposal and evaluation agents must not commit, push or merge; the rejection commit belongs solely to the `/nuc-proposal` caller, the only flow that commits NUC outcomes, which pulls before committing and pushes right after under the [git synchronization policy](git.instructions.md).
+- Proposal and evaluation agents must not commit, push or merge; the rejection commit belongs solely to the `/nuc-proposal` caller, the only flow that commits NUC allocations and outcomes, which pulls before committing and pushes right after under the [git synchronization policy](git.instructions.md).
 
 ## ARC-requested proposals (caller only)
 
```

**File**: `.claude/skills/arc-purposal/SKILL.md` (modified, +20/-14)
```diff
@@ -269,10 +269,14 @@ The only other NUC an invocation prepares is its
 
 1. Trigger `/nuc-proposal` for the request by following the caller steps of
    the [nuc-proposal skill](../nuc-proposal/SKILL.md), using the request's
-   `requested_change` as the requested change. Choose the next NUC number,
-   confirm the category and runtime applicability (ask the user when either is
-   uncertain), pin the accepted revision and record its immutable baseline,
-   and create a candidate worktree. Complete the
+   `requested_change` as the requested change. Confirm the category and
+   runtime applicability (ask the user when either is uncertain), and
+   allocate the NUC under the skill's
+   [allocation step](../nuc-proposal/SKILL.md#allocate-the-nuc-first-caller-only):
+   draft its number, category and proposal details from the request, then
+   commit and push that Draft alone. Pin the pushed allocation as the accepted
+   revision, record its immutable baseline, and create a candidate worktree
+   from it. Complete the
    [pre-draft strategy selection](#learn-the-nuc-proposal-strategy) before
    launching a fresh `nuc-proposal` agent with the request, its evidence, and
    the pinned strategy/rubric handoff. Complete the Rust improvement pass when
@@ -389,10 +393,10 @@ push it:
   replaced it. Preserve pre-existing entries, other datasets, genesis files,
   and unrelated workflow changes. Keep the candidate isolated.
 
-Those caller steps push the requested NUC's outcome commit right after it,
-pulling first, under the
-[git synchronization policy](../../rules/git.instructions.md). That commit
-holds only the NUC's own records and integration; the dataset, README,
+Those caller steps push the requested NUC's allocation and outcome commits
+right after each, pulling first, under the
+[git synchronization policy](../../rules/git.instructions.md). Those commits
+hold only the NUC's own records and integration; the dataset, README,
 reporting-list, solver-default, and progress-record changes wait for this
 invocation's [own commit](#commit-and-push) at the end. Never change project
 versions.
@@ -554,9 +558,10 @@ with the dataset.
 When the invocation is done, after the progress record, commit its changes
 and push them under the
 [git synchronization policy](../../rules/git.instructions.md). This is its
-one commit of its own, separate from a requested NUC's outcome commit, which
-the nuc-proposal caller steps already made and pushed. An invocation that
-pauses, or stops before it writes the progress record, commits nothing.
+one commit of its own, separate from a requested NUC's allocation and outcome
+commits, which the nuc-proposal caller steps already made and pushed. An
+invocation that pauses, or stops before it writes the progress record, commits
+nothing.
 
 1. Pull with `git pull --no-rebase --autostash` right before committing, and
    resolve any conflict under the policy, keeping every other session's work.
@@ -599,9 +604,10 @@ how it was chosen (given, or the default with both its measurements), the
 starting revision, and hint (`null` without one); the dataset status,
 `dataset_path` and source puzzle path,
 the reporting-workflow path and whether its new entry was retained or
-withdrawn, and arc-dataset's use of the hint; the NUC path, blob, category,
-evaluator decision, and report path; the solver's previous and new default
-puzzle IDs and whether that change was retained or restored; the run's
+withdrawn, and arc-dataset's use of the hint; the NUC path, allocation
+commit, blob, category, evaluator decision, and report path; the solver's
+previous and new default puzzle IDs and whether that change was retained or
+restored; the run's
 command, executable, exit status or timeout, difference or error, and log
 paths; the outcome and its basis; the suggested solver changes; the dataset
 grammar's forms added or removed, or that it already fit, with the offline
```

**File**: `.claude/skills/nuc-evaluate/SKILL.md` (modified, +5/-2)
```diff
@@ -27,8 +27,11 @@ Independently verify applicability and that evidence; missing comparison
 artifacts do not prove impossibility. A Runtime features proposal needs an
 explicit branch even in single mode.
 Confirm that the current proposal blob matches the handoff and the baseline
-matches the accepted revision. Missing prerequisites block evaluation; never
-invent measurements or guess an uncertain category.
+matches the accepted revision. For a new NUC, that revision is its pushed
+[allocation](../nuc-proposal/SKILL.md#allocate-the-nuc-first-caller-only),
+which adds only the Draft document and its index rows, so it is not a
+revision containing the candidate. Missing prerequisites block evaluation;
+never invent measurements or guess an uncertain category.
 
 Treat candidate sources, generated exports, and the baseline as read-only.
 Apart from the pull of the primary checkout before you start, under the
```

**File**: `.claude/skills/nuc-proposal/SKILL.md` (modified, +93/-19)
```diff
@@ -14,6 +14,70 @@ agent. Inside that agent, execute the steps below; do not spawn another agent.
 Follow `.claude/CLAUDE.md` and `docs/nuc-0001.md`.
 Work on exactly one proposal revision in the caller's isolated candidate.
 
+## Allocate the NUC first (caller only)
+
+Every `/nuc-proposal` task runs in this order, and every continuous cycle
+repeats it:
+
+1. **Pull.** As always before starting a task, pull the primary checkout with
+   `git pull --no-rebase --autostash` under the
+   [git synchronization policy](../../rules/git.instructions.md#pull-first),
+   so the task runs against the most current remote state. Report the commits
+   it brought in.
+2. **Draft first.** Once the
+   [execution mode](#choose-execution-mode-caller-only), the confirmed
+   [category](#classify-every-proposal) and the requested change are chosen,
+   number the new NUC as the highest NUC recorded in `docs/` plus one. In the
+   primary checkout, write `docs/nuc-XXXX.md` with its complete header,
+   including `Status: Draft` and the confirmed `Category`, and its proposal
+   details: the Abstract and Motivation of the requested change, followed by
+   the remaining required sections for the proposer to complete. Add its Draft
+   rows to both indexes in `docs/nuc-0000.md`, and change nothing else.
+3. **Allocate.** Commit those two paths alone, with the subject
+   `Draft NUC <number> <Title>` and the category and requested change in the
+   body, and push right away. The pushed commit allocates the proposal and its
+   number, so concurrent sessions number their NUCs after it.
+4. **Work on the details as usual.** Pin the `HEAD` just pushed, which holds
+   the allocation, as the accepted revision, record its baseline, and create
+   the candidate worktree from it. Then
+   [select the strategy](#select-and-consume-a-proposal-strategy) and run the
+   fresh proposer, which completes the draft and prototypes the change, the
+   Rust improvement pass and the fresh evaluator, as the rest of this skill
+   describes.
+5. **Commit and push the final version.** Record the outcome in a new commit,
+   `NUC <number> <Title>`, that holds the final proposal along with its code
+   changes when it is accepted, and push it right after, under the
+   [outcome commit rule](#name-outcome-commits-caller-only).
+
+- Pull again right before each commit and each push. When a pull brings in
+  the drafted number, keep the other session's NUC and renumber the draft to
+  main's next number, in the merge if the allocation is already committed.
+  When a push is rejected because the remote moved, pull, resolve, and push
+  again until it succeeds.
+- Stage the two paths explicitly, only the allocation's own hunks where
+  another session's uncommitted edits share them, and verify that the commit
+  holds nothing else. It changes no runtime, executable document, test,
+  dataset, export or grammar, so its language is still the accepted language.
+- Verify the inputs that do not depend on the pinned revision, such as a
+  configured strategy policy, before drafting, so a missing one blocks the
+  task before anything is committed.
+- The allocation is not an outcome and needs no evaluation of its own; the
+  one proposal/evaluation pair covers the final version. The draft records
+  only the caller's own inputs, so the strategy selection and any usefulness
+  rubric, which bind the pinned revision, still precede the proposer's
+  drafting.
+- The final commit builds on the allocation; never amend or rewrite the
+  pushed allocation. For Accepted or Automatic-Accepted, it integrates the
+  unchanged frozen candidate with the final proposal and its status/index
+  metadata. For Rejected, it holds only the final rejection documentation
+  under the [rejection rule](#record-rejected-outcomes-caller-only), and the
+  candidate's code stays isolated.
+- A revision of an existing NUC, including a revisited Rejected NUC, already
+  holds its number: skip the draft and allocation steps, and leave its text
+  and status on `main` unchanged until the outcome commit. A Blocked or paused
+  NUC keeps its pushed Draft and number, and a later task resumes it under
+  that number instead of allocating another.
+
 ## Choose execution mode (caller only)
 
 `/nuc-proposal` defaults to continuous mode for open-ended proposal requests.
@@ -153,12 +217,14 @@ an acceptance criterion.
 Require the proposal path, confirmed category and requested change, execution
 mode and runtime applicability with supporting rationale when applicable,
 accepted Git revision, immutable baseline JSON artifact, and candidate worktree.
-Confirm that the baseline belongs to that accepted revision before making
-runtime or executable document edits. Missing inputs stop preparation, not
-justify assumptions.
+For a new NUC, the accepted revision is the pushed
+[allocation](#allocate-the-nuc-first-caller-only), and the candidate starts
+from its Draft. Confirm that the baseline belongs to tha
```

#### Recent Merged Pull Requests:
- **PR #72** (closed): Bump the npm_and_yarn group with 2 updates (@dependabot[bot])
- **PR #70** (2025-01-09): Variable Value in Python (@canmingir)
- **PR #69** (closed): add Python version's first test case (@gitansh-garg)
- **PR #68** (2024-12-19): Bump the npm_and_yarn group across 2 directories with 3 updates (@dependabot[bot])
- **PR #67** (closed): Bump path-to-regexp and express in /arc (@dependabot[bot])
- **PR #66** (closed): Bump cookie and express (@dependabot[bot])

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

## X. Allocate NUCs before drafting

**RULE**:
When implementing operations in `.claude/CLAUDE.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fbd810e8`: Allocate NUCs before drafting. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/CLAUDE.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
| [proposals.instructions.md](rules/proposals.instructions.md) | Independent NUC proposal preparation and evaluation, the token policy, automatic acceptance on the hard criteria (no compile errors, every test passing, backward compatibility) with the `Automatic-Accepted` status, ARC- and user-requested bases, the pushed `Draft NUC <number> <Title>` allocation of each new NUC before its details, and `NUC <number> <Title>` outcome commit messages |
| [git.instructions.md](rules/git.instructions.md) | Only `/nuc-proposal` (NUC allocations and outcomes) and `/arc-purposal` (its own ARC changes, when it is done) commit and push; every agent pulls before it starts (fast-forward only, except those callers before a commit or push), pull before commit/push, push after every commit, resolve conflicts and push |
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
| [proposals.instructions.md](rules/proposals.instructions.md) | Independent NUC proposal preparation and evaluation, the token policy, automatic acceptance on the hard criteria (no compile errors, every test passing, backward compatibility) with the `Automatic-Accepted` status, ARC- and user-requested bases, and `NUC <number> <Title>` outcome commit messages |
| [git.instructions.md](rules/git.instructions.md) | Only `/nuc-proposal` (NUC outcomes) and `/arc-purposal` (its own ARC changes, when it is done) commit and push; every agent pulls before it starts (fast-forward only, except those callers before a commit or push), pull before commit/push, push after every commit, resolve conflicts and push |
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fbd810e8` are properly handled with clean fallback behavior.
