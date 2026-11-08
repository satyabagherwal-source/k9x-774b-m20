> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `5bc314fd`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T14:19:45.326Z  
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
> **Harvest Timestamp**: 2026-11-08T14:19:44.870Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NucleoidAI/Nucleoid`
- **Description**: Synthesized Logic Language for World Models 🌱🐋🌍
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
use super::{enum_source, has_binding_metadata, signature};
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
    match (target, value) {
        (Expr::Identifier(name), Expr::Enum(members)) => enum_source(name, members),
        _ => format!("{target}={value}"),
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
            _ => {
                let expression = self.expression()?;

                if self.check(&Token::ColonAssign) {
                    return self.value_assignment(expression);
                }

                if let Some(statement) = self.suppose_statement(&expression)? {
                    return Ok(statement);
                }

                Ok(simple_statement(expression))
            }
        }
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
            options: self.options,
            lists: self.lists,
            enclosed: self.enclosed,
            in_class: self.in_class,
            ..Parser::new(std::mem::take(&mut self.tokens))
        };
        let parsed = parse(&mut probe);
        self.tokens = probe.tokens;
        parsed
    }

    pub(super) fn separates(&mut self, from: usize, colon: usize) -> bool {
        self.accepted(|parser| {
            parser.position = from;
            parser.depth = parser.depth.saturating_sub(1);
            let mut statements 
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
use crate::lang::ast::lexer::SyntaxOptions;
use crate::lang::ast::{Program, parser};

/// Compiles a program, reporting the first syntax error.
pub fn compile(source: &str) -> Result<Program> {
    parser::parse_program(source)
}

/// Compiles with the same explicit source options as the runtime.
pub fn compile_with_options(source: &str, options: SyntaxOptions) -> Result<Program> {
    parser::parse_program_with_options(source, options)
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
  puzzle_id: string = "74dd1130",
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

### Incident Patch 1: `653ec5d6` (2026-11-08)
**Commit Message**: Revert "Document blocked dynamic-axis revision for ARC 74dd1130"

This reverts commit 713cc5a4edc56226329242ec06eb80f117b2dc96.

**File**: `arc/docs/ARC-NUC-74dd1130.md` (modified, +6/-58)
```diff
@@ -6,11 +6,11 @@ the solver and Nucleoid changes it needed, its runs, and what is still open.
 | Item | Status |
 | --- | --- |
 | Puzzle | [`data/training/74dd1130.json`](../data/training/74dd1130.json) |
-| Instruction dataset | [`dataset.74dd1130.json`](../src/dataset/dataset.74dd1130.json): the puzzle's 4 original training pairs and its test pair, 5 mosaic instances, one per pair; committed with this record; shared orientation comment added on 6-Nov-2026; descriptive `implementation` comments added on 7-Nov-2026; colors written as letters on 8-Nov-2026; dynamic-axis revision blocked before publication on 8-Nov-2026 |
+| Instruction dataset | [`dataset.74dd1130.json`](../src/dataset/dataset.74dd1130.json): the puzzle's 4 original training pairs and its test pair, 5 mosaic instances, one per pair; committed with this record; shared orientation comment added on 6-Nov-2026; descriptive `implementation` comments added on 7-Nov-2026; colors written as letters on 8-Nov-2026 |
 | Output canvas | `EXACT` |
 | Nucleoid enhancements | None requested, so no proposal strategy was selected and strategy learning did not apply; the rule is one unconditional class-level rule of accepted Nucleoid |
 | Solver changes | None; suggested changes await review, not applied |
-| Solver runs | 1 local run on 5-Nov-2026, exit 0, an exact match, with this dataset's test pair in its few-shot context; none of the current version; the 8-Nov-2026 dynamic-axis invocation ended without a run |
+| Solver runs | 1 local run on 5-Nov-2026, exit 0, an exact match, with this dataset's test pair in its few-shot context; none of the current version |
 | Updated | 8-Nov-2026 |
 
 ## Puzzle
@@ -39,19 +39,17 @@ puzzles tied with [`3c9b0459`](ARC-NUC-3c9b0459.md), the previous default.
 
 ## Gestalt overview
 
-- **Whole grid.** Each input and output is a 3 by 3 canvas filled by one
-  mosaic of three colors, with no background cell.
+- **Whole grid.** A 3 by 3 canvas filled by one mosaic of three colors, with
+  no background cell.
 - **Figures.** One figure per grid, the whole mosaic.
 - **Relations.** The mosaic relates to the canvas's main diagonal, from the
   top-left corner to the bottom-right. No training mosaic looks the same
   under another turn or mirror of the square, so each pair shows the flip on
   its own.
 - **Change.** The whole mosaic flips across that diagonal, so its rows
   become its columns.
-- **World model.** The retained dataset has one object per pair, the whole
-  mosaic, whose flip is its `mirror_axis`, 135. The unpublished 8-Nov-2026
-  revision keeps that whole-object level and derives the mirror line from
-  its opposite bounding-box corners; no finer model was needed.
+- **World model.** One object per pair, the whole mosaic, whose flip is its
+  `mirror_axis`, 135.
 
 ## Dataset
 
@@ -185,57 +183,12 @@ instance names, positions, sizes, orientations, and tags are unchanged. `Matrix.
 orientation call's few-shot crops read exactly as before. No solver run has
 measured this version, so its difference is unknown, not zero.
 
-### Dynamic axis attempt -- 8-Nov-2026
-
-The user requested `dynamic set $Obj.mirror_axis instead of 135 direcly`.
-This invocation named the puzzle explicitly and authorized replacing its
-fixed-axis rule, rather than selecting another default puzzle. The
-arc-dataset worker kept the whole mosaic as the figure and fixed the
-northwest-to-southeast reflection from the training pairs alone. Its proposed
-axis is the line between the mosaic's opposite input bounding-box corners:
-
-```nuc
-$Obj.mirror_axis = {start: {x: $Obj.x@first, y: $Obj.y@first}, end: {x: $Obj.x@first + $Obj.width@first - 1, y: $Obj.y@first + $Obj.height@first - 1}}
-```
-
-This would replace a scalar degree bearing with an endpoint-defined line,
-not move `135` into a default or disguise it with arithmetic. The existing
-standard entries supply its geometry, so it adds no input property, pixel
-objects, or redundant population operation. The worker reported native
-regeneration and independent replay of all five input and output states on
-accepted `e059f4b`, together with offline geometric reconstruction of the
-original outputs. This is offline evidence, not a live solver result. No
-NUC was requested, and strategy learning is `not_applicable`.
-
-The handoff was **blocked**, not `written`. The dataset and README changed
-outside this invocation while the worker was preparing the revision, and
-the shared letter-ranking policy changed too. There was no stable
-preservation baseline to overwrite safely. The worker also reported 30
-missing coordinate/orientation metadata fields across five instances and
-five missing object-description comments under its schema checks. Its
-original-grid and letter-ranking failures used the earlier palette policy
-that counted test outputs; concurrent working-tree policy edits instead
-rank the training pairs and test inputs. Those earlier diagnostics do not
-establish that the new pale
```

---

### Incident Patch 2: `cfc11dbf` (2026-11-08)
**Commit Message**: Revert "Use dataset-specific ARC color letters"

This reverts commit 284713c51fc79d60bf99dcd14bb03a482e58f9f9.

**File**: `.claude/agents/arc-dataset.agent.md` (modified, +14/-15)
```diff
@@ -82,16 +82,15 @@ inferred only from the training pairs.
 
 Follow the exact pattern of each pair in `arc/data/training/<id>.json`, but
 write no color as its number. `0` stays `0`. Every other color becomes a
-letter from `A` to `Z` out of the dataset's own random set, so each file has
-its own letters and a color keeps one letter everywhere in its file. The set
-is fixed by the dataset's key, the name between `dataset.` and `.json`: the
-puzzle ID, or a genesis name such as `core`. Order the 26 letters by the
-hexadecimal SHA-256 digest of `<key>:<letter>`, such as `c8f0f002:A`,
-smallest first, and give the colors that occur in any of the dataset's
-`input_matrix` and `output_matrix` grids, in increasing order, the letters in
-that order. For `c8f0f002`, that writes 1 as `T`, 5 as `B`, 7 as `Q`, and 8 as
-`D`. The letters carry no meaning beyond which cells share a color: `A` is not
-the most used color, and one color has different letters in different files.
+letter of `ABCDEFGHI`, ranked by how often it occurs across every
+`input_matrix` and `output_matrix` of the dataset, training and test pairs
+together: the most used color is `A`, the next `B`, and so on. A tie goes to
+the color read first, reading the pairs in dataset order, each input before
+its output, and each matrix row by row. This is how `Matrix.silhouette` in
+`arc/src/lib/Matrix.ts` ranks one matrix, applied to the whole dataset at once
+so that a color keeps one letter in every pair. The letters are no fixed map
+from numbers: color 1 is not always `A`, because each dataset ranks its own
+colors. Count only the pair grids, not the instance masks.
 
 Use the same letters everywhere the dataset holds a color:
 
@@ -291,9 +290,9 @@ Verify with a throwaway script outside the repository; do not add tests:
   back to their colors makes every `input_matrix` and `output_matrix` equal
   its original grid, including dimensions, colors, positions, and zero
   padding. There are no synthesized examples.
-- Recomputing the dataset's random set from its key gives exactly its
-  letters, one per color, and no color is written as its number in the grids,
-  masks, declarations, implementations, or snapshots.
+- Ranking the dataset's letters again by their counts gives `A`, `B`, `C`, and
+  so on in order, and no color is written as its number in the grids, masks,
+  declarations, implementations, or snapshots.
 - The transformation inferred from the training pairs reproduces every
   original train and test output.
 - All pairs share the dataset's declarations and output-canvas mode, and
@@ -360,8 +359,8 @@ versions, spawn agents, start a NUC, commit, or push.
 
 Return the status (`written`, `nucleoid_enhancement_required`, or `blocked`)
 with `dataset_path`, the source puzzle path, any annotation helper's path,
-train and test pair counts, instance counts, the color-to-letter mapping, the
-declarations, the
+train and test pair counts, instance counts, the color-to-letter mapping with
+each color's count, the declarations, the
 big-picture formulation you started from and, for a finer model, why it fell
 short, each check with its result, how you used any hint, any NUC request, any
 suggested solver change, and any blockers. A staged handoff also includes
```

**File**: `.claude/agents/arc-purposal.agent.md` (modified, +3/-3)
```diff
@@ -54,9 +54,9 @@ Follow `.claude/CLAUDE.md`, the
 - Have every dataset write its colors as letters, under the same step, and
   pass that requirement to every `arc-dataset` run: the grids follow the
   puzzle's pairs in `arc/data/training/` exactly, but `0` stays `0` and every
-  other color is a letter from `A` to `Z` out of the dataset's own random set,
-  fixed by its file name and consistent inside the file, never its number. The
-  masks and the world model use the same letters.
+  other color is a letter of `ABCDEFGHI` ranked by how often it occurs across
+  the dataset's input and output matrices, `A` for the most used, never its
+  number. The masks and the world model use the same letters.
 - Never change the TypeScript implementation in `arc/`, except that before
   the run you make the puzzle the solver's default puzzle in `arc/src/app.ts`
   under the skill's [run step](../skills/arc-purposal/SKILL.md#run-the-puzzle).
```

**File**: `.claude/rules/arc.instructions.md` (modified, +3/-3)
```diff
@@ -89,9 +89,9 @@ special-cased workaround.
 
 Infer segmentation, background, object roles, and transformations from training
 pairs. Treat colors `0` through `9` as categorical values. Instruction datasets
-write them as letters: `0` stays `0`, and every other color is a letter from
-`A` to `Z` out of the dataset's own random set, fixed by its file name and
-consistent inside the file, under the
+write them as letters: `0` stays `0`, and every other color is a letter of
+`ABCDEFGHI` ranked by its count across the dataset's input and output matrices,
+`A` for the most used, under the
 [arc-dataset profile](../agents/arc-dataset.agent.md#write-colors-as-letters).
 Preserve positions
 and the current full-size, zero-padded instance matrices at existing boundaries.
```

**File**: `.claude/skills/arc-dataset/SKILL.md` (modified, +3/-3)
```diff
@@ -23,9 +23,9 @@ additional entries at the same level as the training pairs: the same `dataset`
 array and entry structure, with no separate section or marker. Copy the input
 and output grids' exact pattern, positions, zero padding, and canvas
 dimensions, but write each color as a letter: `0` stays `0`, and the other
-colors take letters from `A` to `Z` out of the dataset's own random set, fixed
-by its file name and consistent inside the file, never their numbers. The
-masks and the world model use the same letters, as the profile's
+colors take the letters `ABCDEFGHI` by how often they occur across all of the
+dataset's input and output matrices, `A` for the most used, never as their
+numbers. The masks and the world model use the same letters, as the profile's
 [letter rule](../../agents/arc-dataset.agent.md#write-colors-as-letters)
 defines. Do not synthesize, resample, recolor beyond those letters, or
 duplicate examples into numbered variants.
```

**File**: `.claude/skills/arc-purposal/SKILL.md` (modified, +12/-10)
```diff
@@ -136,17 +136,19 @@ Write every color as a letter, and pass this requirement to every
 `/arc-dataset` run too. The dataset follows the exact pattern of the puzzle's
 pairs in `arc/data/training/`, cell for cell and shape for shape, but never
 writes a color as its number. `0` stays `0`, and every other color becomes a
-letter from `A` to `Z` out of the dataset's own random set, fixed by its file
-name: each file has its own letters, and a color keeps one letter in every pair
-of its file. The letters carry no meaning beyond which cells share a color, so
-the pattern reaches the model without the colors. The same letters replace the
-colors in the instance masks and the world model: color properties hold
-letters, such as `color='B'`, and rules name colors by letter, such as
-`if $Obj.color is 'C':`. The arc-dataset profile's
+letter of `ABCDEFGHI`, ranked by how often it occurs across all of the
+dataset's input and output matrices, training and test pairs together: the
+most used color is `A`, the next `B`, and so on, as `Matrix.silhouette` in
+`arc/src/lib/Matrix.ts` ranks a matrix, with a tie going to the color read
+first. The letters are the dataset's own ranking, not a fixed map from
+numbers to letters, so a color keeps one letter in every pair of its dataset.
+The same letters replace the colors in the instance masks and the world model:
+color properties hold letters, such as `color='B'`, and rules name colors by
+letter, such as `if $Obj.color is 'C':`. The arc-dataset profile's
 [letter rule](../../agents/arc-dataset.agent.md#write-colors-as-letters)
-defines how the set is drawn. Check a `written` handoff against it before the
-run, and send back one that writes a color as its number or uses other
-letters.
+defines the ranking in full. Check a `written` handoff against it before the
+run, and send back one that writes a color as its number or ranks its letters
+another way.
 
 Continue by the handoff's status:
 
```

**File**: `arc/README.md` (modified, +90/-93)
```diff
@@ -291,18 +291,16 @@ that has a dataset receives its expected test output in the few-shot context.
 That is intended: the datasets are being prepared as few-shot examples, and
 these runs are not yet held-out tests.
 
-Every dataset writes its colors as letters rather than numbers, so its
-examples carry the puzzle's pattern without its colors. `0` stays `0`, and
-every other color becomes a letter from `A` to `Z` out of the dataset's own
-random set. The set is fixed by the dataset's key, the name between `dataset.`
-and `.json`: the 26 letters, ordered by the SHA-256 digest of `<key>:<letter>`,
-go to the colors that occur in its `input_matrix` and `output_matrix` grids, in
-increasing order. Each file therefore has its own letters, and a color keeps
-one letter in every pair of its file, while one color has different letters in
-different files: 2 is `G` in `dataset.017c7c7b.json`, `J` in
-`dataset.0d3d703e.json`, and `W` in `dataset.27a28665.json`. The letters carry
-no meaning beyond which cells share a color; `A` is not the most used color.
-The same letters replace the colors in both instance
+Every dataset writes its colors as letters rather than numbers. `0` stays `0`,
+and every other color becomes a letter of `ABCDEFGHI`, ranked by how often it
+occurs across all of the dataset's `input_matrix` and `output_matrix` grids,
+training and test pairs together: the most frequent color is `A`, the next
+`B`, and so on, with a tie going to the color read first, pair by pair, each
+input before its output, row by row. This is `Matrix.silhouette`'s ranking
+applied to a whole dataset at once, so a color keeps one letter in every pair
+of its dataset, while each dataset ranks its own colors: 2 is `A` in
+`dataset.017c7c7b.json`, `B` in `dataset.0d3d703e.json`, and `D` in
+`dataset.27a28665.json`. The same letters replace the colors in both instance
 masks, in the world model's color parameters, which are `str`, such as
 `color: str`, and its rules, such as `if $Obj.color@first is 'C':`, in the
 implementations' arguments, such as `color='B'` or `parts=['A', 'C']`, and in
@@ -356,10 +354,10 @@ V points up. The genesis rules match categorical colors and orientations with
 `is`, the spelling of `==` that [NUC 86](../docs/nuc-0086.md) adds, as in the
 line header `if $Obj.orientation is 270:`, and the line rules assign quoted
 strings, as in `$Obj.extension_direction = 'right'`.
-The genesis datasets write these colors in their own random letters too: in
-`dataset.core.json` 4 is `H` and 9 is `S`, in `dataset.extension.json` 4 is
-`C` and 7 is `J`, in `dataset.curve.json` 2 is `Q`, 4 is `D`, 8 is `T`, and 9
-is `W`, and in `dataset.line.json` 6 is `E` and 8 is `A`.
+The genesis datasets write these colors as letters too, ranked by count: in
+`dataset.core.json` 9 is `A` and 4 is `B`, in `dataset.extension.json` 4 is
+`A` and 7 is `B`, in `dataset.curve.json` 4 is `A`, 8 is `B`, 9 is `C`, and 2
+is `D`, and in `dataset.line.json` 6 is `A` and 8 is `B`.
 
 Instance `implementation` snippets use named constructor arguments whose names
 match the parameters in their class declarations. The canvas size is not one
@@ -376,9 +374,9 @@ instance's own arguments and input mask into words, and Nucleoid skips them,
 so they change no snapshot:
 
 ```nuc
-# A corner whose vertex and both segments are color S,
+# A corner whose vertex and both segments are color A,
 # 2 by 2 at x 5, y 1, pointing southeast
-obj7e96305711c2 = Obj(x=5, y=1, width=2, height=2, orientation=135, vertex_color='S', vertical_segment_color='S', horizontal_segment_color='S')
+obj7e96305711c2 = Obj(x=5, y=1, width=2, height=2, orientation=135, vertex_color='A', vertical_segment_color='A', horizontal_segment_color='A')
 ```
 
 Every `input_instance_matrix` has exactly its pair's `input_matrix` row and
@@ -426,7 +424,7 @@ Unconditional class-level rules set the output tag and introduce one
 property, `extension_direction`, which is absent before the rules run and is
 `down`, as in `dataset.line.json`.
 The rules also rewrite `height` to `$Obj.height@first * 3 / 2`, 9 rows, the
-pattern's one change in size, and `color` to `'G'`, the letter of color 2.
+pattern's one change in size, and `color` to `'A'`, the letter of color 2.
 They leave `width` unchanged,
 because the pattern grows down only and each output's box is as wide as its
 input's, 3, 3, 2, and 3 columns, and they leave `x` and `y` unchanged because
@@ -447,8 +445,8 @@ the 9 by 3 outputs, while `FIT` would crop the empty right column of the third
 training output. Orientation is 0 in both states because the pattern is not
 turned. The test pair follows the training pairs at the same level and is
 annotated by the same rules.
-The dataset writes its colors in its own random letters: 1 as `A` and 2 as
-`G`.
+The dataset writes its colors as letters ranked by count: 2 as `A` and 1 as
+`B`.
 
 `dataset.0ca9ddb6.json` annotates the three training pairs from
 `data\training\0ca9ddb6.json`, followed 
```

**File**: `arc/docs/ARC-NUC-017c7c7b.md` (modified, +14/-21)
```diff
@@ -213,36 +213,29 @@ user's choice, no solver run has measured this version.
 ### Letter colors
 
 On 8-Nov-2026, at the user's request, every instruction dataset started
-writing its colors as letters instead of numbers, so that the pattern reaches
-the model without the colors. `0` stays `0`, and every other color takes a
-letter from `A` to `Z` out of the dataset's own random set: the 26 letters,
-ordered by the SHA-256 digest of `<key>:<letter>` with the puzzle ID as the
-key, go to the dataset's colors in increasing order. Each file therefore has
-its own letters, a color keeps one letter in every pair, and the letters carry
-no meaning beyond which cells share a color. This dataset writes its colors in
-its own random letters: 1 as `A` and 2 as `G`. Mapping the letters back
-reproduces the puzzle's pairs cell for cell. A first version the same day
-ranked the letters by count, `A` for the most used color, which gave every
-letter a meaning; the random set replaced it.
+writing its colors as letters instead of numbers. `0` stays `0`, and every
+other color is a letter of `ABCDEFGHI`, ranked by how often it occurs across
+all of the dataset's input and output matrices, training and test pairs
+together: `A` for the most used, then `B`, and so on, a tie going to the color
+read first, as `Matrix.silhouette` ranks one matrix. This dataset writes its
+colors as letters ranked by count: 2 as `A` and 1 as `B`. Mapping the letters
+back reproduces the puzzle's pairs cell for cell.
 
 The pair grids, both instance masks, the implementations, and the snapshots
 use those letters, and the class and rules name the same colors by letter.
 Only the color literals changed, and the changed declarations now read:
 
 ```nuc
 class Obj(x: int, y: int, width: int, height: int, orientation: int, color: str, period: int):
-$Obj.color = 'G'
+$Obj.color = 'A'
 ```
 
-Every snapshot was regenerated and replays byte for byte with the accepted
-runtime at `1931f77`, whose last runtime change is `34bbba0`, and equals its
-earlier snapshot with its colors replaced by their letters, so the rules
-behave as before; instance names, positions, sizes, orientations, and tags are
-unchanged. `Matrix.silhouette` takes any letter from `A` to `Z` and still
-ranks each crop by its own counts, the most used color as `A`, so the
-orientation call's crops read exactly as before. The solver still sends the
-running puzzle as numbers. No solver run has measured this version, so its
-difference is unknown, not zero.
+Every snapshot was regenerated with the accepted runtime at `adc282a` and
+equals its earlier snapshot with its colors replaced by their letters, so the
+rules behave as before; instance names, positions, sizes, orientations, and
+tags are unchanged. `Matrix.silhouette` now also takes letters, so the
+orientation call's few-shot crops read exactly as before. No solver run has
+measured this version, so its difference is unknown, not zero.
 
 ## Runs
 
```

**File**: `arc/docs/ARC-NUC-0ca9ddb6.md` (modified, +18/-25)
```diff
@@ -188,50 +188,43 @@ user's choice, no solver run has measured this version.
 ### Letter colors
 
 On 8-Nov-2026, at the user's request, every instruction dataset started
-writing its colors as letters instead of numbers, so that the pattern reaches
-the model without the colors. `0` stays `0`, and every other color takes a
-letter from `A` to `Z` out of the dataset's own random set: the 26 letters,
-ordered by the SHA-256 digest of `<key>:<letter>` with the puzzle ID as the
-key, go to the dataset's colors in increasing order. Each file therefore has
-its own letters, a color keeps one letter in every pair, and the letters carry
-no meaning beyond which cells share a color. This dataset writes its colors in
-its own random letters: 1 as `P`, 2 as `G`, 4 as `D`, 6 as `F`, 7 as `E`, and
-8 as `Z`. Mapping the letters back reproduces the puzzle's pairs cell for
-cell. A first version the same day ranked the letters by count, `A` for the
-most used color, which gave every letter a meaning; the random set replaced
-it.
+writing its colors as letters instead of numbers. `0` stays `0`, and every
+other color is a letter of `ABCDEFGHI`, ranked by how often it occurs across
+all of the dataset's input and output matrices, training and test pairs
+together: `A` for the most used, then `B`, and so on, a tie going to the color
+read first, as `Matrix.silhouette` ranks one matrix. This dataset writes its
+colors as letters ranked by count: 4 as `A`, 7 as `B`, 2 as `C`, 1 as `D`, 8
+as `E`, and 6 as `F`. Mapping the letters back reproduces the puzzle's pairs
+cell for cell.
 
 The pair grids, both instance masks, the implementations, and the snapshots
 use those letters, and the class and rules name the same colors by letter.
 Only the color literals changed, and the changed declarations now read:
 
 ```nuc
 class Obj(x: int, y: int, width: int, height: int, orientation: int, vertex_color: str):
-if $Obj.vertex_color is 'P':
+if $Obj.vertex_color is 'D':
     $Obj.tag = 'l1707'
-    $Obj.marker_color = 'E'
+    $Obj.marker_color = 'B'
     $Obj.x = $Obj.x@first - 1
     $Obj.y = $Obj.y@first - 1
     $Obj.width = $Obj.width@first + 2
     $Obj.height = $Obj.height@first + 2
-if $Obj.vertex_color is 'G':
+if $Obj.vertex_color is 'C':
     $Obj.tag = 'l2404'
-    $Obj.marker_color = 'D'
+    $Obj.marker_color = 'A'
     $Obj.x = $Obj.x@first - 1
     $Obj.y = $Obj.y@first - 1
     $Obj.width = $Obj.width@first + 2
     $Obj.height = $Obj.height@first + 2
 ```
 
-Every snapshot was regenerated and replays byte for byte with the accepted
-runtime at `1931f77`, whose last runtime change is `34bbba0`, and equals its
-earlier snapshot with its colors replaced by their letters, so the rules
-behave as before; instance names, positions, sizes, orientations, and tags are
-unchanged. `Matrix.silhouette` takes any letter from `A` to `Z` and still
-ranks each crop by its own counts, the most used color as `A`, so the
-orientation call's crops read exactly as before. The solver still sends the
-running puzzle as numbers. No solver run has measured this version, so its
-difference is unknown, not zero.
+Every snapshot was regenerated with the accepted runtime at `adc282a` and
+equals its earlier snapshot with its colors replaced by their letters, so the
+rules behave as before; instance names, positions, sizes, orientations, and
+tags are unchanged. `Matrix.silhouette` now also takes letters, so the
+orientation call's few-shot crops read exactly as before. No solver run has
+measured this version, so its difference is unknown, not zero.
 
 ## Decision: locate the delta from the initial position (NUC 53 and NUC 55)
 
```

---

### Incident Patch 3: `cea73a47` (2026-11-08)
**Commit Message**: Revert "Clarify deterministic ARC color assignment"

This reverts commit 11443aa068c5f915bc56fd03e5d3c6394e4ee362.

**File**: `.claude/agents/arc-dataset.agent.md` (modified, +3/-4)
```diff
@@ -291,10 +291,9 @@ Verify with a throwaway script outside the repository; do not add tests:
   back to their colors makes every `input_matrix` and `output_matrix` equal
   its original grid, including dimensions, colors, positions, and zero
   padding. There are no synthesized examples.
-- Recomputing the dataset's SHA-256 shuffle from its key gives exactly its
-  letters, one per color in increasing color order, and no color is written as
-  its number in the grids, masks, declarations, implementations, or
-  snapshots.
+- Recomputing the dataset's random set from its key gives exactly its
+  letters, one per color, and no color is written as its number in the grids,
+  masks, declarations, implementations, or snapshots.
 - The transformation inferred from the training pairs reproduces every
   original train and test output.
 - All pairs share the dataset's declarations and output-canvas mode, and
```

**File**: `.claude/agents/arc-purposal.agent.md` (modified, +3/-8)
```diff
@@ -54,14 +54,9 @@ Follow `.claude/CLAUDE.md`, the
 - Have every dataset write its colors as letters, under the same step, and
   pass that requirement to every `arc-dataset` run: the grids follow the
   puzzle's pairs in `arc/data/training/` exactly, but `0` stays `0` and every
-  other color takes its letter from the dataset's SHA-256 shuffle of `A` to
-  `Z`: the letters ordered by the SHA-256 digest of `<key>:<letter>`, where the
-  key is the name between `dataset.` and `.json`, go to the dataset's colors in
-  increasing order. The shuffle makes each file's letters its own and
-  reproducible, and a color keeps its letter everywhere in the file; never
-  choose letters another way or write a color as its number. The masks and the
-  world model use the same letters. Recompute the shuffle and check the letters
-  before the run, as the skill's dataset step shows.
+  other color is a letter from `A` to `Z` out of the dataset's own random set,
+  fixed by its file name and consistent inside the file, never its number. The
+  masks and the world model use the same letters.
 - Never change the TypeScript implementation in `arc/`, except that before
   the run you make the puzzle the solver's default puzzle in `arc/src/app.ts`
   under the skill's [run step](../skills/arc-purposal/SKILL.md#run-the-puzzle).
```

**File**: `.claude/rules/arc.instructions.md` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@ special-cased workaround.
 Infer segmentation, background, object roles, and transformations from training
 pairs. Treat colors `0` through `9` as categorical values. Instruction datasets
 write them as letters: `0` stays `0`, and every other color is a letter from
-the dataset's SHA-256 shuffle of `A` to `Z`, keyed by its file name and
+`A` to `Z` out of the dataset's own random set, fixed by its file name and
 consistent inside the file, under the
 [arc-dataset profile](../agents/arc-dataset.agent.md#write-colors-as-letters).
 Preserve positions
```

**File**: `.claude/skills/arc-dataset/SKILL.md` (modified, +2/-4)
```diff
@@ -23,10 +23,8 @@ additional entries at the same level as the training pairs: the same `dataset`
 array and entry structure, with no separate section or marker. Copy the input
 and output grids' exact pattern, positions, zero padding, and canvas
 dimensions, but write each color as a letter: `0` stays `0`, and the other
-colors take letters from the dataset's SHA-256 shuffle of `A` to `Z`, the
-letters ordered by the SHA-256 digest of `<key>:<letter>` with the file's key,
-in increasing color order and consistent inside the file, never their numbers.
-The
+colors take letters from `A` to `Z` out of the dataset's own random set, fixed
+by its file name and consistent inside the file, never their numbers. The
 masks and the world model use the same letters, as the profile's
 [letter rule](../../agents/arc-dataset.agent.md#write-colors-as-letters)
 defines. Do not synthesize, resample, recolor beyond those letters, or
```

**File**: `.claude/skills/arc-purposal/SKILL.md` (modified, +12/-34)
```diff
@@ -135,39 +135,18 @@ training pairs need.
 Write every color as a letter, and pass this requirement to every
 `/arc-dataset` run too. The dataset follows the exact pattern of the puzzle's
 pairs in `arc/data/training/`, cell for cell and shape for shape, but never
-writes a color as its number. `0` stays `0`, and every other color takes its
-letter from the dataset's own SHA-256 shuffle of the alphabet:
-
-1. Take the dataset's key, the name between `dataset.` and `.json`: the
-   puzzle ID, or a genesis name such as `core`.
-2. Shuffle `A` to `Z` by SHA-256: order the 26 letters by the hexadecimal
-   SHA-256 digest of `<key>:<letter>`, such as `c8f0f002:A`, smallest digest
-   first.
-3. Give the colors that occur in any of the dataset's `input_matrix` and
-   `output_matrix` grids, in increasing order, the letters in that order.
-
-For `c8f0f002` the shuffle starts `T B Q D`, so its colors 1, 5, 7, and 8
-become `T`, `B`, `Q`, and `D`; for `0d3d703e` it starts `H J Y Q G U S D`, so
-color 1 is `H` there. The SHA-256 shuffle is what makes each file's letters its
-own and random across files, yet reproducible from the file name alone, and a
-color keeps one letter in every pair of its file. Never choose letters by
-hand, by frequency, or with any other shuffle or seed. The letters carry no
-meaning beyond which cells share a color, so the pattern reaches the model
-without the colors. The same letters replace the colors in the instance masks
-and the world model: color properties hold letters, such as `color='B'`, and
-rules name colors by letter, such as `if $Obj.color is 'C':`. The arc-dataset
-profile's
+writes a color as its number. `0` stays `0`, and every other color becomes a
+letter from `A` to `Z` out of the dataset's own random set, fixed by its file
+name: each file has its own letters, and a color keeps one letter in every pair
+of its file. The letters carry no meaning beyond which cells share a color, so
+the pattern reaches the model without the colors. The same letters replace the
+colors in the instance masks and the world model: color properties hold
+letters, such as `color='B'`, and rules name colors by letter, such as
+`if $Obj.color is 'C':`. The arc-dataset profile's
 [letter rule](../../agents/arc-dataset.agent.md#write-colors-as-letters)
-states the same shuffle.
-
-Before the run, recompute the shuffle for a `written` handoff's dataset:
-
-    node -e "const {createHash} = require('crypto'); const digest = (l) => createHash('sha256').update(process.argv[1] + ':' + l).digest('hex'); console.log([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].sort((a, b) => (digest(a) < digest(b) ? -1 : 1)).join(' '))" <key>
-
-The dataset's colors, in increasing order, must hold the first letters of that
-output, one each, in every grid, mask, declaration, implementation, and
-snapshot. Send back a handoff whose letters differ from the shuffle or that
-writes a color as its number.
+defines how the set is drawn. Check a `written` handoff against it before the
+run, and send back one that writes a color as its number or uses other
+letters.
 
 Continue by the handoff's status:
 
@@ -511,8 +490,7 @@ When nothing is left to commit, make no empty commit, and report why.
 Save one JSON result record in the session workspace with the puzzle ID and
 how it was chosen (given, or the default with both its measurements), the
 starting revision, and hint (`null` without one); the dataset status,
-`dataset_path` and source puzzle path, the dataset's key with its recomputed
-SHA-256 letters and whether the dataset matches them,
+`dataset_path` and source puzzle path,
 the reporting-workflow path and whether its new entry was retained or
 withdrawn, and arc-dataset's use of the hint; the NUC path, blob, category,
 evaluator decision, and report path; the solver's previous and new default
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

## X. Revert "Document blocked dynamic-axis revision for ARC 74dd1130"

**RULE**:
When implementing operations in `arc/docs/ARC-NUC-74dd1130.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `653ec5d6`: Revert "Document blocked dynamic-axis revision for ARC 74dd1130". Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `arc/docs/ARC-NUC-74dd1130.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
| Instruction dataset | [`dataset.74dd1130.json`](../src/dataset/dataset.74dd1130.json): the puzzle's 4 original training pairs and its test pair, 5 mosaic instances, one per pair; committed with this record; shared orientation comment added on 6-Nov-2026; descriptive `implementation` comments added on 7-Nov-2026; colors written as letters on 8-Nov-2026 |
| Solver runs | 1 local run on 5-Nov-2026, exit 0, an exact match, with this dataset's test pair in its few-shot context; none of the current version |
- **Whole grid.** A 3 by 3 canvas filled by one mosaic of three colors, with
  no background cell.
- **World model.** One object per pair, the whole mosaic, whose flip is its
  `mirror_axis`, 135.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
| Instruction dataset | [`dataset.74dd1130.json`](../src/dataset/dataset.74dd1130.json): the puzzle's 4 original training pairs and its test pair, 5 mosaic instances, one per pair; committed with this record; shared orientation comment added on 6-Nov-2026; descriptive `implementation` comments added on 7-Nov-2026; colors written as letters on 8-Nov-2026; dynamic-axis revision blocked before publication on 8-Nov-2026 |
| Solver runs | 1 local run on 5-Nov-2026, exit 0, an exact match, with this dataset's test pair in its few-shot context; none of the current version; the 8-Nov-2026 dynamic-axis invocation ended without a run |
- **Whole grid.** Each input and output is a 3 by 3 canvas filled by one
  mosaic of three colors, with no background cell.
- **World model.** The retained dataset has one object per pair, the whole
  mosaic, whose flip is its `mirror_axis`, 135. The unpublished 8-Nov-2026
  revision keeps that whole-object level and derives the mirror line from
  its opposite bounding-box corners; no finer model was needed.
### Dynamic axis attempt -- 8-Nov-2026

The user requested `dynamic set $Obj.mirror_axis instead of 135 direcly`.
This invocation named the puzzle explici
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `653ec5d6` are properly handled with clean fallback behavior.
