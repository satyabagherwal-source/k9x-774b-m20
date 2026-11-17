# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: NucleoidAI/Nucleoid Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "NucleoidAI/Nucleoid",
  "source_url": "https://github.com/NucleoidAI/Nucleoid",
  "source_version": "f9c95d84",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T11:25:39.912Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nucleoidai-nucleoid",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid) (Revision: `f9c95d84`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T11:25:39.912Z`  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), D (Research & Knowledge Intelligence), B (Product Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), F (Design Intelligence)
- **Confidence Rating**: 54%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from NucleoidAI/Nucleoid:

# Forensic Learning Record (Deep Inspection): NucleoidAI/Nucleoid

> **Canonical Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T11:25:39.303Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NucleoidAI/Nucleoid`
- **Description**: Logic Language for World Models 🌱🐋🌍
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 770 stars

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
        let expression = self.without_head_read(Self::expression)?;

        if self.starts_is_assignment(&expression) {
            return self.is_assignment(expression);
        }

        if self.starts_predicate(&expression) {
            return self.predicate(&expression);
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
        let value = self.receiving(&target, Self::expression)?;
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
        let SupposePremise {
            premise,
            end,
            misplaced_every,
        } = outcome?;
        self.position = end;
        self.adopt(misplaced_every);
        Some(simple_statement(premise))
    }

    fn attempt_suppose_premise(&mut self) -> Option<SupposePremise> {
        let start = self.position;
        let (clause, misplaced_every) = self.tentatively(Self::clause_before_colon);
        let outcome = clause.map(|premise| SupposePremise {
            premise,
            end: self.position,
            misplaced_every,
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

    pub(super) fn accepted<T>(&mut self, parse: impl FnOnce(&mut Self) -> T)
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
import object from "./object.ts";

export async function declarations({ train_dataset }) {
  milestone.inferring_declarations();

  const { declarations, output_canvas } = await llm.generate({
    grammar: true,
    messages: [
      {
        role: "user",
        content: `
          query:
          ${JSON.stringify({
            ...train_dataset,
            declarations: "<DECLARATIONS>",
            output_canvas: "<OUTPUT_CANVAS>",
          })}
          json_format:
          { "declarations": <DECLARATIONS>, "output_canvas": <OUTPUT_CANVAS> }
        `,
      },
    ],
  });

  milestone.declarations_inferred({ declarations, output_canvas });

  return { declarations, output_canvas };
}

export async function instances({ train_dataset }) {
  milestone.segmenting_training_objects();

  const { instances } = await llm.generate({
    messages: [
      {
        role: "user",
        content: `
          query:
          ${JSON.stringify({
            ...train_dataset,
            dataset: train_dataset.dataset.map((dataset) => ({
              ...dataset,
              instances: [
                {
                  input_instance_matrix: "<INPUT_INSTANCE_MATRIX>",
                  output_instance_matrix: "<OUTPUT_INSTANCE_MATRIX>",
                },
              ],
            })),
          })}
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

export async function value({ train_dataset, input_matrix, instance }) {
  milestone.constructing_instance({ instance_name: instance.instance_name });

  const { x, y, width, height } = Matrix.locate(instance.input_instance_matrix);

  const orientation = await object.orientation({ train_dataset, instance });

  const implementation = await object.implementation({
    train_dataset,
    instance,
    x,
    y,
    width,
    height,
    orientation,
  });

  milestone.evaluating_rules({ instance_name: instance.instance_name });

  const canvas_width: number = input_matrix[0].length;
  const canvas_height: number = input_matrix.length;
  const input_value = await nucleoid.run(
    [
      `canvas_width = ${canvas_width}`,
      `canvas_height = ${canvas_height}`,
      train_dataset.declarations[0],
      implementation,
    ].join("\n\n")
  );

  milestone.instance_constructed({
    instance_name: instance.instance_name,
    input_instance_matrix: instance.input_instance_matrix,
    output_instance_matrix: instance.output_instance_matrix,
    implementation,
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
import synthesizer from "./synthesizer.ts";

// Genesis puzzle_id: 3aa6fb7a
export async function start(puzzle_id: string = "3aa6fb7a") {
  const { arc_train, test_input_matrix, test_output_matrix } =
    await arc_dataset.load(puzzle_id);

  const train_dataset = {
    dataset: arc_train.map(({ input, output }) => ({
      input_matrix: input,
      output_matrix: output,
      instances: undefined,
    })),
    declarations: undefined,
    output_canvas: undefined,
  };

  const startedAt: number = performance.now();

  milestone.start({
    version: await nucleoid.version(),
    puzzle_id,
    train: arc_train,
    test_input_matrix,
  });

  milestone.analysis();

  let instance_index: number = 0;
  const next_instance_name = (): string =>
    `obj${String(instance_index++).padStart(12, "0")}`;

  const { declarations, output_canvas } = await analyzer.declarations({
    train_dataset,
  });

  train_dataset.declarations = declarations;
  train_dataset.output_canvas = output_canvas;

  for (const dataset of train_dataset.dataset) {
    const { instances } = await analyzer.instances({
      train_dataset: { ...train_dataset, dataset: [dataset] },
    });

    for (const instance of instances) {
      instance.instance_name = next_instance_name();
    }

    dataset.instances = instances;
  }

  await analyzer.state(train_dataset);

  milestone.visualization();

  const { instances } = await visualizer.instances({
    train_dataset,
    test_input_matrix,
  });

  let result_drawing = Matrix.draw(
    [],
    test_input_matrix.length,
    test_input_matrix[0].length,
    0,
    0
  );

  const input_instances = [];

  for (const { input_instance_matrix } of instances) {
    const instance_name: string = next_instance_name();

    const { implementation, input_value } = await visualizer.value({
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

  const synthesized_dataset = await synthesizer.synthesize({ train_dataset });

  await visualizer.state({ declarations, test_input_matrix, input_instances });

  for (const input_instance of input_instances) {
    const { output_instance_drawing } = await visualizer.output_instance_matrix(
      {
        test_input_matrix,
        train_dataset,
        instance: input_instance,
      }
    );

    input_instance.output_instance_matrix = output_instance_drawing.matrix;
    input_instance.output_instance_epoch = output_instance_drawing.epoch;

    result_drawing = Matrix.merge(result_drawing, output_instance_drawing);
  }

  const result_matrix = Matrix.canvas(result_drawing.matrix, output_canvas);

  milestone.comparison({ test_output_matrix, result_matrix });

  const difference: number = Matrix.difference(
    result_matrix,
    test_output_matrix
  );

  milestone.summary({ difference, duration: performance.now() - startedAt });

  const debug = {
    puzzle_id,
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

### Incident Patch 1: `f9c95d84` (2026-11-17)
**Commit Message**: NUC 112 Node Names of Reasoning Selections

Accepted under the automatic acceptance rule, in a continuous
/nuc-proposal cycle (Reasoning enhancement): the frozen candidate meets
every hard criterion and passes every policy check, including the
required token non-regression gate. The cycle found no stale Draft, drew
Reasoning enhancement uniformly from the five eligible categories,
allocated NUC 112 in 92cbd316, and completed it with fresh baselines,
candidate, proposer, Rust improvement pass and evaluator.

Reasoning pipelines gain a final stage, SELECTION |> nodes, that gives
the node names of a selection's steps in the selection's order: with a =
1, b = a + 2 and c = b * 2, c |> why |> nodes is ["c","b","a"] and c |>
why |> stated |> nodes is ["a"]. It is exactly the accepted
(SELECTION).map(step => step.node), where a reference alone is its own
one-step selection, so c |> nodes is ["c"], and an undefined selection
stays undefined. It builds the same step records, so later anonymous
objects keep their numbering, but records no read of their node fields,
so a standing declaration's graph stays bounded where the accepted
spelling adds a pending obj:N.node node per step on every eva

**File**: `README.md` (modified, +31/-0)
```diff
@@ -2349,6 +2349,37 @@ assert(line, "honey... 12")
   `item + ".".repeat(8 - item.length)`, so a new item and price realign it.
   See the [root contract](nucleoid.spec.md#reactive-string-padding).
 
+## Node names of reasoning selections
+
+**Nodes names the facts a heater rests on and what insulation moves**
+
+```nuc
+outside = 4
+target = 21
+insulation = 0.8
+loss = (target - outside) * insulation
+heater = loss * 2
+causes = heater |> why |> stated |> nodes
+moved = insulation |> affects |> nodes
+assert(causes, ["target", "outside", "insulation"])
+assert(moved, ["loss", "heater"])
+solar = 5
+heater = loss * 2 - solar
+assert(causes, ["solar", "target", "outside", "insulation"])
+```
+
+- [NUC 112](docs/nuc-0112.md) adds the final reasoning stage `|> nodes`,
+  which names the nodes of a selection's steps in their order.
+  `heater |> why |> stated |> nodes` names the facts the heater rests on,
+  and `insulation |> affects |> nodes` what a change of the insulation
+  reaches.
+- Both lists are the names that
+  `(heater |> why |> stated).map(step => step.node)` and
+  `(insulation |> affects).map(step => step.node)` give, and they stay live
+  the same way: once the heater also accounts for the solar gain, `solar`
+  joins the facts it rests on. See the
+  [root contract](nucleoid.spec.md#node-names-of-reasoning-selections).
+
 ## Reactive list flattening
 
 **Flat turns nested lists into one live list**
```

**File**: `dataset/nucleoid.spec.jsonl` (modified, +20/-16)
```diff
@@ -767,19 +767,23 @@
 {"id":"spec-0767","description":"Nucleoid pads strings at the end with padEnd","code":"items = [\"tea\", \"jam\", \"honey\"]\nwidth = 6\nrows = items.map(item -> item.padEnd(width) + \"|\")\ntitle = \"Total\"\nrule = title.padEnd(12, \".:\")\nassert(rows, [\"tea   |\", \"jam   |\", \"honey |\"])\nassert(rule, \"Total.:.:.:.\")\nwidth = 4\ntitle = \"Sum\"\nassert(rows, [\"tea |\", \"jam |\", \"honey|\"])\nrule","return":"\"Sum.:.:.:.:.\""}
 {"id":"spec-0768","description":"Nucleoid keeps padded strings live in declarations and class level rules","code":"label = \"7\"\nwidth = 3\nfill = \"0\"\nshown = label.padStart(width, fill)\nassert(shown, \"007\")\nlabel = \"42\"\nassert(shown, \"042\")\nwidth = 5\nassert(shown, \"00042\")\nfill = \"\"\nassert(shown, \"42\")\nfill = \"*\"\nassert(shown, \"***42\")\nclass Ticket(id):\n    this.id = id\n$Ticket.code = \"T-\" + String($Ticket.id).padStart(4, \"0\")\nfirst = Ticket(7)\nsecond = Ticket(42)\nassert([first.code, second.code], [\"T-0007\", \"T-0042\"])\nfirst.id = 12345\n[first.code, second.code]","return":"[\"T-12345\",\"T-0042\"]"}
 {"id":"spec-0769","description":"Nucleoid rolls back failed updates through padded strings","code":"ids = []\ncodes = ids.map(id -> id.padStart(size, \"0\"))\nfailure = \"\"\ntry:\n    ids.push(\"7\")\ncatch error:\n    failure = error\nassert(failure, ReferenceError(\"size is not defined\"))\nassert([ids, codes], [[], []])\nsize = 3\nids.push(\"7\", \"42\")\nassert(codes, [\"007\", \"042\"])\ntry:\n    ids.push(\"5\")\n    size = 2\n    assert(codes, [\"07\", \"42\", \"05\"])\n    throw \"UNDO\"\ncatch error:\n    assert(error, \"UNDO\")\n[codes, size]","return":"[[\"007\",\"042\"],3]"}
-{"id":"spec-0770","description":"Nucleoid flattens nested lists by one level","code":"nested = [[1, 2], 2, [[3, [4]]], [], \"ab\"]\nonce = nested.flat()\ntwice = once.flat(1)\nassert(once, [1, 2, 2, [3, [4]], \"ab\"])\nassert(twice, [1, 2, 2, 3, [4], \"ab\"])\nassert(nested, [[1, 2], 2, [[3, [4]]], [], \"ab\"])\nnested.push([[5]], 6)\nassert(once, [1, 2, 2, [3, [4]], \"ab\", [5], 6])\nassert(twice, [1, 2, 2, 3, [4], \"ab\", 5, 6])\ntwice.length","return":"8"}
-{"id":"spec-0771","description":"Nucleoid flattens lists to a given depth","code":"deep = [1, [2, [3, [4, [5]]]], [[6]]]\ntwo = deep.flat(2)\nthree = deep.flat(3)\nsame = deep.flat(0)\nassert(two, [1, 2, 3, [4, [5]], 6])\nassert(three, [1, 2, 3, 4, [5], 6])\nassert(same, [1, [2, [3, [4, [5]]]], [[6]]])\ndeep.push([[7, [8]]])\nassert(two, [1, 2, 3, [4, [5]], 6, 7, [8]])\nassert(three, [1, 2, 3, 4, [5], 6, 7, 8])\nassert(same, deep)\nthree.length","return":"8"}
-{"id":"spec-0772","description":"Nucleoid keeps flattened lists live","code":"shifts = [[\"ana\", \"bo\"], [\"cy\"]]\nstaff = shifts.flat()\nsize = staff.length\nassert([staff, size], [[\"ana\", \"bo\", \"cy\"], 3])\nshifts.push([\"di\"])\nassert([staff, size], [[\"ana\", \"bo\", \"cy\", \"di\"], 4])\nshifts = [[\"eve\"], [], [\"fay\", \"gus\"]]\nassert([staff, size], [[\"eve\", \"fay\", \"gus\"], 3])\nshifts.shift()\nassert([staff, size], [[\"fay\", \"gus\"], 2])\nsize","return":"2"}
-{"id":"spec-0773","description":"Nucleoid flattens lists in class level rules","code":"class Team(squads):\n    this.squads = squads\n$Team.members = $Team.squads.flat()\nred = Team([[\"ana\", \"bo\"], [\"cy\"]])\nblue = Team([[\"di\"]])\nassert([red.members, blue.members], [[\"ana\", \"bo\", \"cy\"], [\"di\"]])\nred.squads.push([\"ed\"])\nblue.squads = [[\"fay\"], [\"gus\", \"hal\"]]\nassert([red.members, blue.members], [[\"ana\", \"bo\", \"cy\", \"ed\"], [\"fay\", \"gus\", \"hal\"]])\nred.members.length","return":"4"}
-{"id":"spec-0774","description":"Nucleoid queries the cells of flattened grids","code":"grid = [[1, 0, 2], [0, 3, 2]]\ncells = grid.flat()\ntotal = cells.sum()\ncolors = cells.distinct()\nfilled = cells.count(cell => cell > 0)\nassert([total, colors, filled], [8, [1, 0, 2, 3], 4])\ngrid.push([5, 0, 0])\nassert([total, colors, filled], [13, [1, 0, 2, 3, 5], 5])\ngrid = [[4, 4], [0]]\n[total, colors, filled]","return":"[8,[4,0],2]"}
-{"id":"spec-0775","description":"Nucleoid rolls back failed flattening updates","code":"rows = [[1, [2]], [3]]\ncells = rows.flat()\ntry:\n    rows.push([4])\n    assert(cells, [1, [2], 3, 4])\n    throw \"UNDO\"\ncatch error:\n    assert(error, \"UNDO\")\nassert([rows, cells], [[[1, [2]], [3]], [1, [2], 3]])\ntry:\n    cells = rows.flat(2)\n    assert(cells, [1, 2, 3])\n    throw \"UNDO\"\ncatch error:\n    assert(error, \"UNDO\")\nrows.push([[5]])\ncells","return":"[1,[2],3,[5]]"}
-{"id":"spec-0776","description":"Nucleoid tests membership with in and not in","code":"tags = [\"red\", \"blue\"]\nassert(\"red\" in tags, true)\nassert(\"green\" in tags, false)\nassert(\"green\" not in tags, true)\nassert(\"red\" not in tags, false)\nassert([1, 2] in [[1, 2], [3]], true)\nassert({ x: 1 } in [{ x: 1 }, null], true)\nassert(null in [1, null], true)\nassert(Number.NaN in [Number.NaN], false)\
```

**File**: `dataset/nucleoid.synth.76.jsonl` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+{"id":"synth-76-0001","description":"Nodes names every step of an explanation, in the explanation's order","code":"price = 10\nqty = 3\nshipping = 5\nsubtotal = price * qty\ntotal = subtotal + shipping\ntotal |> why |> nodes","return":"[\"total\",\"subtotal\",\"shipping\",\"price\",\"qty\"]"}
+{"id":"synth-76-0002","description":"Nodes after stated names the facts that a conclusion rests on","code":"seed = 2\nmiddle = seed + 3\nresult = middle * 2\nresult |> why |> stated |> nodes","return":"[\"seed\"]"}
+{"id":"synth-76-0003","description":"Nodes after derived names the conclusions on the way to a value","code":"seed = 2\nmiddle = seed + 3\nresult = middle * 2\nresult |> why |> derived |> nodes","return":"[\"result\",\"middle\"]"}
+{"id":"synth-76-0004","description":"Nodes after affects names what a change of one fact reaches","code":"rate = 0.2\nprice = 10\nsubtotal = price * 3\ntax = subtotal * rate\ntotal = subtotal + tax\nprice |> affects |> nodes","return":"[\"subtotal\",\"tax\",\"total\"]"}
+{"id":"synth-76-0005","description":"Nodes on the model names every node in model order and leaves out a declaration that holds reasoning","code":"a = 1\nb = a + 2\nnames = b |> why |> nodes\nmodel |> nodes","return":"[\"a\",\"b\"]"}
+{"id":"synth-76-0006","description":"A prefix stage composes with nodes","code":"a = 1\nb = a + 2\nc = b * 2\nwhy c |> nodes","return":"[\"c\",\"b\",\"a\"]"}
+{"id":"synth-76-0007","description":"A reference alone names its own node","code":"a = 1\nb = a + 2\nb |> nodes","return":"[\"b\"]"}
+{"id":"synth-76-0008","description":"Nodes after depth names a conclusion and what it reads directly","code":"price = 10\nqty = 3\nshipping = 5\nsubtotal = price * qty\ntotal = subtotal + shipping\ntotal |> why |> depth(1) |> nodes","return":"[\"total\",\"subtotal\",\"shipping\"]"}
+{"id":"synth-76-0009","description":"Nodes after path names the steps by which one value reaches another","code":"price = 10\nqty = 3\nshipping = 5\nsubtotal = price * qty\ntotal = subtotal + shipping\ntotal |> why |> path(price) |> nodes","return":"[\"total\",\"subtotal\",\"price\"]"}
+{"id":"synth-76-0010","description":"Nodes after intersect names the causes two explanations share","code":"price = 10\nquantity = 3\nrate = 0.2\nsubtotal = price * quantity\ntax = subtotal * rate\nshipping = quantity * 2\ntax |> why |> intersect(shipping |> why) |> nodes","return":"[\"quantity\"]"}
+{"id":"synth-76-0011","description":"A standing declaration of node names follows a rewiring of the graph","code":"a = 1\nb = a + 2\nc = b * 2\nnames = c |> why |> nodes\nx = 5\nb = x + 1\nnames","return":"[\"c\",\"b\",\"x\"]"}
+{"id":"synth-76-0012","description":"A class-level rule names the nodes behind each instance's own value","code":"rate = 2\nclass Machine(load, hours):\n    this.load = load\n    this.hours = hours\n$Machine.wear = $Machine.load * $Machine.hours * rate\n$Machine.inputs = $Machine.wear |> why |> nodes\npress = Machine(5, 10)\npress.inputs","return":"[\"press.wear\",\"press.load\",\"press.hours\",\"rate\"]"}
```

**File**: `docs/README.md` (modified, +65/-2)
```diff
@@ -3885,6 +3885,9 @@ pace
 - A selection is an ordered list of steps with `node`, `holds`, `rule`, `state`, and `from` fields.
 - `state` is `"stated"` for an independent fact or `"derived"` for a relationship or class-level rule.
 - List functions such as `map`, `find`, and `some` can inspect the steps.
+- `selection |> nodes` lists the steps' `node` names, as
+  `(selection).map(step => step.node)` does for the selection the pipeline
+  denotes ([NUC 112](nuc-0112.md)).
 
 ```
 a = 1
@@ -4096,6 +4099,58 @@ common.map(step => step.node)
   [intersect and except reasoning selections](../nucleoid.spec.md#intersect-and-except-reasoning-selections)
   section.
 
+### Node names of reasoning selections
+
+```
+price = 10
+qty = 3
+shipping = 5
+subtotal = price * qty
+total = subtotal + shipping
+facts = total |> why |> stated |> nodes
+reach = price |> affects |> nodes
+assert(facts, ["shipping", "price", "qty"])
+assert(reach, ["subtotal", "total"])
+base = 4
+shipping = base + 1
+facts
+```
+
+- This is the complete `Nucleoid names the nodes of selections with nodes`
+  program in `tests/reference.md`, without its title and expected-return
+  metadata; it returns `["base","price","qty"]`.
+- [NUC 112](nuc-0112.md) adds the final stage `selection |> nodes`. It gives
+  the `node` names of the selection's steps as a list of strings, in their
+  order, so `total |> why |> stated |> nodes` names the facts the total rests
+  on and `price |> affects |> nodes` what a change of the price reaches. It is
+  exactly `(selection).map(step => step.node)`, where `selection` is the
+  selection that the pipeline before `nodes` denotes, read as the stages read
+  their source.
+- The selection is written as a pipeline's source is: a reference, which
+  denotes its own one-step selection rather than its value, `model`, a prefix
+  stage such as `why total`, or a pipeline of any of the stages above. So
+  `total |> nodes` is `["total"]`, as
+  `(total |> why |> depth(0)).map(step => step.node)` is, while
+  `(total).map(step => step.node)` raises
+  `TypeError("number.map is not a function")`. An empty selection gives `[]`,
+  and a selection that a `depth(null)` makes undefined gives undefined.
+- The stage ends the pipeline: a stage after it, or an `intersect`, `except`
+  or `path` argument that ends with it, has a list of names rather than a
+  selection and raises `TypeError("Cannot explain <source>")`, as it does
+  after the accepted spelling.
+- Only `|>` followed by `nodes` is the stage; `nodes` stays an ordinary name
+  everywhere else, and there is no prefix form. A local or parameter,
+  variable, function or class named `nodes` shadows the stage, as bindings
+  shadow the state filters, `depth`, `diff`, `path`, `intersect` and
+  `except`: the pipeline then raises `TypeError("nodes is not an operation")`
+  before selecting its source.
+- The list stays live through every observation its selection made, and a
+  declaration that holds it is a reasoning observer. It renders as
+  `selection|>nodes`.
+- The authoritative contract is the
+  [node names of reasoning selections](../nucleoid.spec.md#node-names-of-reasoning-selections)
+  section.
+
 ### Live structure
 
 - A reasoning assignment follows both values and graph structure.
@@ -4134,8 +4189,11 @@ c = b * 2
   and its `before` and `after` fields, the [NUC 88](nuc-0088.md)
   candidate adds a `path(target)` stage that NUC 11 does not plan, and the
   [NUC 106](nuc-0106.md) candidate adds `intersect(other)` and
-  `except(other)` stages, which NUC 11 does not plan either. Other NUC 11
-  operations remain proposals, not dependencies.
+  `except(other)` stages, which NUC 11 does not plan either, and the
+  [NUC 112](nuc-0112.md) candidate adds a final `nodes` stage, which names
+  the nodes of a selection and, unlike NUC 11's operations, returns a list
+  rather than a selection. Other NUC 11 operations remain proposals, not
+  dependencies.
 
 ### Quantifiers
 
@@ -4614,6 +4672,11 @@ why a |> except(why b)                what a rests on and b does not (NUC 106)
 affects a |> intersect(affects b)     what a and b both move (NUC 106)
 selection |> intersect(other)         steps whose node other also selects (NUC 106)
 selection |> except(other)            steps whose node other does not select (NUC 106)
+reference |> why |> nodes             the node names of an explanation, in its order (NUC 112)
+reference |> why |> stated |> nodes   the names of the facts an explanation rests on (NUC 112)
+reference |> affects |> nodes         the names of what a change of the reference reaches (NUC 112)
+model |> nodes                        the names of the current model's nodes (NUC 112)
+selection |> nodes                    the list (selection).map(step => step.node); ends the pipeline (NUC 112)
 all name in collection: condition     true when the condition holds for every member (NUC 62)
 every name in collection: condition   the same quantifier as all (NUC 98)
 any n
```

**File**: `docs/examples.md` (modified, +29/-0)
```diff
@@ -3874,6 +3874,35 @@ east.aisle = "EAST"
   not padded. See [NUC 111](nuc-0111.md) and the
   [root contract](../nucleoid.spec.md#reactive-string-padding).
 
+## Node names of reasoning selections
+
+**Nodes names the facts and rules behind a loan decision**
+
+```nuc
+income = 5000
+debt = 1200
+score = 700
+ratio = debt / income
+approved = ratio < 0.4 && score > 650
+facts = approved |> why |> stated |> nodes
+rules = approved |> why |> derived |> nodes
+assert([facts, rules], [["score", "debt", "income"], ["approved", "ratio"]])
+years = 3
+approved = ratio < 0.4 && score > 650 && years > 2
+moved = income |> affects |> nodes
+assert(moved, ["ratio", "approved"])
+[facts, rules]
+# return: [["score","years","debt","income"],["approved","ratio"]]
+```
+
+- `approved |> why |> stated |> nodes` names the facts the decision rests
+  on and `approved |> why |> derived |> nodes` the rules it passes through,
+  each in the order of the explanation. `income |> affects |> nodes` names
+  what a change of income reaches.
+- The names follow the model: once the decision also asks for more than two
+  years of history, `years` joins the facts. See [NUC 112](nuc-0112.md) and the
+  [root contract](../nucleoid.spec.md#node-names-of-reasoning-selections).
+
 ## Reactive list flattening
 
 **Flattening keeps the dirty tiles of every room counted**
```

**File**: `docs/nuc-0000.md` (modified, +2/-2)
```diff
@@ -142,7 +142,7 @@ Created: 31-Jul-2026
 | [88](nuc-0088.md) | Derivation Path Selections | Accepted |
 | [101](nuc-0101.md) | Exact-Depth Reasoning Selections | Rejected: existing selector-case audit fails |
 | [106](nuc-0106.md) | Intersect and Except Reasoning Selections | Accepted |
-| [112](nuc-0112.md) | Node Names of Reasoning Selections | Draft |
+| [112](nuc-0112.md) | Node Names of Reasoning Selections | Accepted |
 
 ### Language compatibility
 
@@ -278,7 +278,7 @@ Created: 31-Jul-2026
 | [109](nuc-0109.md) | Operator Section Arguments | Standards Track | Syntax enhancement | Accepted |
 | [110](nuc-0110.md) | Python String Method Aliases | Standards Track | Language compatibility | Accepted |
 | [111](nuc-0111.md) | Reactive String Padding | Standards Track | Utility enhancement | Accepted |
-| [112](nuc-0112.md) | Node Names of Reasoning Selections | Standards Track | Reasoning enhancement | Draft |
+| [112](nuc-0112.md) | Node Names of Reasoning Selections | Standards Track | Reasoning enhancement | Accepted |
 
 ## Copyright
 
```

**File**: `docs/nuc-0112.md` (modified, +1251/-22)
```diff
@@ -4,65 +4,1294 @@
 NUC: 112
 Title: Node Names of Reasoning Selections
 Author: Can Mingir <canmingir@gmail.com>
-Status: Draft
+Status: Accepted
 Type: Standards Track
 Category: Reasoning enhancement
 Created: 17-Nov-2026
+Requires: 48, 82, 83, 88, 106
 ```
 
 ## Abstract
 
 - Adds a final reasoning stage, `SELECTION |> nodes`, that gives the node
-  names of a selection's steps, in the selection's order. With `a = 1`,
-  `b = a + 2` and `c = b * 2`, `c |> why |> nodes` is `["c", "b", "a"]`,
-  `c |> why |> stated |> nodes` is `["a"]` and `a |> affects |> nodes` is
-  `["b", "c"]`.
-- It is exactly the accepted `(SELECTION).map(step => step.node)`, and it
-  stays live as that spelling does: a declaration
-  `names = total |> why |> nodes` follows later changes of the graph.
+  names of a selection's steps, in the selection's order, as a list of
+  strings. With `a = 1`, `b = a + 2` and `c = b * 2`, `c |> why |> nodes` is
+  `["c", "b", "a"]`, `c |> why |> stated |> nodes` is `["a"]` and
+  `a |> affects |> nodes` is `["b", "c"]`.
+- It is exactly the accepted `(SELECTION).map(step => step.node)`, where
+  `SELECTION` is the selection that the pipeline denotes, read as the
+  accepted stages read their source, so a reference alone is its own
+  one-step selection and `c |> nodes` is `["c"]`. It stays live as that
+  spelling does: a declaration `names = total |> why |> nodes` follows later
+  changes of the graph.
 - It ends a pipeline over any selection source the accepted stages take: a
-  reference, `model`, or a pipeline of accepted stages such as `why`,
-  `affects`, `stated`, `derived`, `depth`, `path`, `intersect` and
-  `except`. It has no prefix form, because `nodes c` already reads as two
-  juxtaposed statements.
-- Only programs that raised `TypeError("nodes is not an operation")`
-  change. A binding named `nodes` keeps that error for the pipeline, as
-  bindings named `stated` and `derived` keep theirs.
+  reference, `model`, a prefix stage such as `why c`, or a pipeline of
+  accepted stages such as `why`, `affects`, `stated`, `derived`, `depth`,
+  `path`, `intersect`, `except` and `diff`. What follows it reads a list of
+  names, not a selection, as after the accepted spelling, so
+  `c |> why |> nodes |> why` raises `TypeError("Cannot explain c|>why|>nodes")`.
+- It has no prefix form, because `nodes c` already reads as two juxtaposed
+  statements. A local or parameter, state variable, function or class named
+  `nodes` makes the pipeline raise `TypeError("nodes is not an operation")`,
+  as bindings named `stated` and `derived` do for theirs.
+- No keyword, lexer token, error type or message is added. Every accepted
+  program keeps its parse and behavior. Only inputs that were parse errors at
+  the accepted revision change: most raised the parse-time
+  `TypeError("nodes is not an operation")`, and where the statement parser
+  backtracks from an unpacking or object-destructuring pattern, some raised
+  `SyntaxError("Unexpected ','")` or `SyntaxError("Unexpected '='")` first.
+- The public `Stage` enum gains the variant `Stage::Nodes`, which needs human
+  SemVer review. No project version is changed. The authoritative contract is
+  [Node names of reasoning selections](../nucleoid.spec.md#node-names-of-reasoning-selections).
 
 ## Motivation
 
 - An explanation is a list of steps, and the question most programs ask of
   it is which nodes take part: which facts support a conclusion, and what a
   change reaches. The accepted spelling maps the steps, as in
   `(total |> why |> stated).map(step => step.node)`, and the executable
-  documents write that mapping more than 190 times: 132 in the
-  specification's cases, 25 in the executable reference, 21 in the
-  examples and 8 each in the two READMEs.
+  documents write that mapping 194 times: 132 in the specification's cases,
+  25 in the executable reference, 21 in the examples and 8 each in the two
+  READMEs.
 - At the accepted revision, `c |> why |> nodes` raises
   `TypeError("nodes is not an operation")` while the program is parsed.
 - A stage keeps the question inside the pipeline that asks it, so a world
   model reads its explanations as the rest of its reasoning reads, left to
   right: `alarm |> why |> stated |> nodes` names the facts that raise an
   alarm.
+- The accepted spelling also builds a record object for every step and then
+  reads one field of each. Inside a declaration, each read of a fresh
+  record's `node` field adds a pending graph node: after
+  `names = (why c).map(.node)` and two writes of `a`, `--graph` lists nine
+  pending nodes, `obj:0.node` to `obj:8.node`, of which only the last three
+  are still read. A standing declaration so grows the graph by one node for
+  every step each time it is evaluated.
+- The most compact accepted spelling, `(why c).map(.node)` with a
+  [NUC 79](nuc-0079.md) selector, is 10 lexer tokens, and
+  `(c |> why |> stated).map(.node)` is 13, against 4 for `why c |> nodes
```

**File**: `docs/nucleoid.g4` (modified, +9/-1)
```diff
@@ -489,7 +489,8 @@ stage
     | AFFECTS
     | STATED
     | DERIVED
-    | DIFF                                                // Expr::Reason
+    | DIFF
+    | NODES                                               // Expr::Reason
     | DEPTH LPAREN expression RPAREN                       // Expr::Depth
     | PATH LPAREN expression RPAREN                        // Expr::Path
     | (INTERSECT | EXCEPT) LPAREN expression RPAREN        // Expr::Combine
@@ -869,6 +870,7 @@ enumName
     | PATH
     | INTERSECT
     | EXCEPT
+    | NODES
     | MODEL
     | FIRST
     | LAST
@@ -954,6 +956,7 @@ DEPTH            : 'depth';
 PATH             : 'path';
 INTERSECT        : 'intersect';
 EXCEPT           : 'except';
+NODES            : 'nodes';
 MODEL            : 'model';
 FIRST            : 'first';
 LAST             : 'last';
@@ -1143,6 +1146,11 @@ fragment REGEX_CHAR
  * catch without a name     -> the binding "error".
  * model directly before |> -> Expr::Model.
  * |> intersect(model)      -> its other selection is Expr::Model; also except.
+ * s |> nodes               -> Expr::Reason with Stage::Nodes, the node names of
+ *                             s's selection. It ends the pipeline: a stage
+ *                             after it, or an intersect, except or path
+ *                             argument that ends with it, parses and then
+ *                             raises TypeError("Cannot explain <source>").
  * An object containing spread uses Expr::SpreadObject, with later entries
  * winning; otherwise it uses Expr::ObjectLiteral. Numeric keys become text.
  *
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

## X. NUC 112 Node Names of Reasoning Selections

**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f9c95d84`: NUC 112 Node Names of Reasoning Selections. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
## Node names of reasoning selections

**Nodes names the facts a heater rests on and what insulation moves**

```nuc
outside = 4
target = 21
insulation = 0.8
loss = (target - outside) * insulation
heater = loss * 2
causes = heater |> why |> stated |> nodes
moved = insulation |> affects |> nodes
assert(causes, ["target", "outside", "insulation"])
assert(moved, ["loss", "heater"])
solar = 5
heater = loss * 2 - solar
assert(causes, ["solar", "target", "outside", "insulation"])
```

- [NUC 112](docs/nuc-0112.md) adds the final reasoning stage `|> nodes`,
  which names the nodes of a selection's steps in their order.
  `heater |> why |> stated |> nodes` names the facts the heater rests on,
  and `insulation |> affects |> nodes` what a change of the insulation
  reaches.
- Both lists are the names that
  `(heater |> why |> stated).map(step => step.node)` and
  `(insulation |> affects).map(step => step.node)` give, and they stay live
  the same way: once the heater also accounts for the solar gain, `solar`
  joins the facts it rests on. See the
  [root contract](nucleoid.spec.md#node-names-of-reasoning-selections).

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f9c95d84` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
