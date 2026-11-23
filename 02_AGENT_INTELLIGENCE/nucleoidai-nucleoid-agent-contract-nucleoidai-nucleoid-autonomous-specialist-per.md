# Agent Contract: Agent Contract: NucleoidAI/Nucleoid Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "NucleoidAI/Nucleoid",
  "source_url": "https://github.com/NucleoidAI/Nucleoid",
  "source_version": "5779103e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T13:23:40.387Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nucleoidai-nucleoid",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid) (Revision: `5779103e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T13:23:40.387Z`  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `nucleoidai-nucleoid-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
# Forensic Learning Record (Deep Inspection): NucleoidAI/Nucleoid

> **Canonical Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-23T13:23:39.381Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NucleoidAI/Nucleoid`
- **Description**: Logic Language for World Models 🌱🐋🌍
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 772 stars

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
        Stmt::While { condition, body } => loop_key("while", condition, body),
        Stmt::Repeat { count, body } => loop_key("repeat", count, body),
        Stmt::RepeatUntil { body, condition } => until_key(body, condition),
        Stmt::Try { .. } | Stmt::TryFinally { .. } => "try".to_string(),
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

fn loop_key(word: &str, header: &Expr, body: &[Stmt]) -> String {
    format!("{word}({header}){{{}}}", generate_all(body))
}

fn loop_suite(word: &str, header: &Expr, body: &[Stmt]) -> String {
    format!("{word} {header}:\n{}", indent(&source_all(body)))
}

fn until_key(body: &[Stmt], condition: &Expr) -> String {
    format!("repeat{{{}}}until({condition})", generate_all(body))
}

fn until_suite(body: &[Stmt], condition: &Expr) -> String {
    format!("repeat:\n{}\nuntil {condition}", indent(&source_all(body)))
}

fn try_suite(body: &[Stmt], parameter: &str, catch: &[Stmt]) -> String {
    format!(
        "try:\n{}\ncatch {parameter}:\n{}",
        indent(&source_all(body)),
        indent(&source_all(catch))
    )
}

fn finally_suite(attempt: &str, finally: &[Stmt]) -> String {
    format!("{attempt}\nfinally:\n{}", indent(&source_all(finally)))
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
        Stmt::While { condition, body } => loop_suite("while", condition, body),
        Stmt::Repeat { count, body } => loop_suite("repeat", count, body),
        Stmt::RepeatUntil { body, condition } => until_suite(body, condition),
        Stmt::Try {
            body,
            parameter,
            catch,
        } => try_suite(body, parameter, catch),
        Stmt::TryFinally {
            body,
            parameter,
            catch,
            finally,
        } => finally_suite(&try_suite(body, parameter, catch), finally),
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

    /// Shares the existing body parser with conditional, exception and implicit
    /// iterator suites already qualified for colon omission by real indentation.
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

        if self.starts_repeat_until() {
            return self.repeat_until_statement();
        }

        if let Some(count) = self.repeat_count() {
            let body = self.suite()?;
            return Ok(Stmt::Repeat { count, body });
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
        if se
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

export async function declarations({ train }) {
  milestone.inferring_declarations();

  const {
    result: { class_declaration, declarations, output_canvas },
  } = await llm.generate({
    grammar: true,
    messages: [
      {
        role: "user",
        content: `
          query:
          ${JSON.stringify({
            ...train,
            class_declaration: "<CLASS_DECLARATION>",
            declarations: "<DECLARATIONS>",
            output_canvas: "<OUTPUT_CANVAS>",
          })}
          json_format:
          {
            "result": {
              "class_declaration": <CLASS_DECLARATION>,
              "declarations": <DECLARATIONS>,
              "output_canvas": <OUTPUT_CANVAS>
            }
          }
        `,
      },
    ],
  });

  milestone.declarations_inferred({
    declarations: [class_declaration, ...declarations],
    output_canvas,
  });

  return { class_declaration, declarations, output_canvas };
}

export async function instances({ train, pair_number }) {
  const [{ input_matrix, output_matrix }] = train.dataset;

  milestone.segmenting_training_objects({
    pair_number,
    input_matrix,
    output_matrix,
  });

  const { result: instances } = await llm.generate({
    grammar: true,
    messages: [
      {
        role: "user",
        content: `
          query:
          ${JSON.stringify({
            ...train,
            dataset: train.dataset.map((dataset) => ({
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
            "result": [{
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

export async function value({ instance_name, train, input_matrix, instance }) {
  milestone.constructing_instance({ instance_name });

  instance.instance_name = instance_name;

  const { x, y, width, height, volume } = Matrix.measure(
    instance.input_instance_matrix
  );

  const orientation = await object.orientation({ train, instance });

  const implementation = await object.implementation({
    train,
    instance,
    x,
    y,
    width,
    height,
    orientation,
    volume,
  });

  milestone.evaluating_rules({ instance_name });

  const canvas_width: number = input_matrix[0].length;
  const canvas_height: number = input_matrix.length;
  const input_value = await nucleoid.run(
    [
      `canvas_width = ${canvas_width}`,
      `canvas_height = ${canvas_height}`,
      train.class_declaration,
      implementation,
    ].join("\n\n")
  );

  milestone.instance_constructed({
    instance_name,
    input_instance_matrix: instance.input_instance_matrix,
    output_instance_matrix: instance.output_instance_matrix,
    implementation,
    input_value,
  });

  instance.implementation = implementation;
  instance.input_value = input_value;
}

export async function state(train) {
  const objects = [];

  for (const dataset of train.dataset) {
    const implementations = dataset.instances.map(
      ({ implementation }) => implementation
    );

    const canvas_width: number = dataset.input_matrix[0].length;
    const canvas_height: number = dataset.input_matrix.length;
    const obj_list = await nucleoid.run(
      [
        `canvas_width = ${canvas_width}`,
        `canvas_height = ${canvas_height}`,
        train.class_declaration,
        ...train.declarations,
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

  milestone.state({ phase: "analysis", objects: objects });
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
import object from "./object.ts";

// Genesis puzzle_id: 3aa6fb7a
export async function start(puzzle_id: string = "3aa6fb7a") {
  const { arc_train, test_input_matrix, test_output_matrix } =
    await arc_dataset.load(puzzle_id);

  const train = {
    dataset: arc_train.map(({ input, output }) => ({
      input_matrix: input,
      output_matrix: output,
      instances: undefined,
    })),
    class_declaration: undefined,
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

  const { class_declaration, declarations, output_canvas } =
    await analyzer.declarations({
      train,
    });

  train.class_declaration = class_declaration;
  train.declarations = declarations;
  train.output_canvas = output_canvas;

  for (const [index, dataset] of train.dataset.entries()) {
    const { instances } = await analyzer.instances({
      pair_number: index + 1,
      train: { ...train, dataset: [dataset] },
    });

    for (const instance of instances) {
      await analyzer.value({
        instance_name: next_instance_name(),
        train,
        input_matrix: dataset.input_matrix,
        instance,
      });
    }

    dataset.instances = instances;
  }

  await analyzer.state(train);

  milestone.synthesizing_training_dataset();

  await synthesizer.synthesize({ train });

  milestone.visualization();

  const { instances } = await visualizer.instances({
    train,
    test_input_matrix,
  });

  let result_matrix = Array.from({ length: test_input_matrix.length }, () =>
    Array(test_input_matrix[0].length).fill(0)
  );

  const input_instances = [];

  for (const { input_instance_matrix } of instances) {
    const instance_name: string = next_instance_name();

    const { implementation, input_value } = await visualizer.value({
      train,
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

  await object.state({
    class_declaration,
    declarations,
    input_matrix: test_input_matrix,
    input_instances,
  });

  for (const input_instance of input_instances) {
    const { output_instance_matrix } = await visualizer.output_instance_matrix({
      phase: "visualization",
      test_input_matrix,
      train,
      instance: input_instance,
    });

    input_instance.output_instance_matrix = output_instance_matrix;

    result_matrix = Matrix.merge(result_matrix, output_instance_matrix);
  }

  milestone.test_output_composed({ instances: input_instances });

  result_matrix = Matrix.canvas(result_matrix, output_canvas);

  milestone.comparison({ test_output_matrix, result_matrix });

  const difference: number = Matrix.difference(
    result_matrix,
    test_output_matrix
  );

  milestone.summary({ difference, duration: performance.now() - startedAt });

  const debug = {
    puzzle_id,
    train,
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

### Incident Patch 1: `5779103e` (2026-11-23)
**Commit Message**: NUC 136 Unknown Constructor Arguments as Properties

Accepted on the user-requested basis. The user asked for this feature
directly ("Automatically accept unknown argument in constructor in all
constructor types"), and the frozen candidate meets all three hard
criteria.

A constructor-call label that names no parameter of the effective
constructor no longer raises TypeError("Unknown constructor argument
..."). It binds like one more parameter and is assigned as
this.<name> = <name> once the constructor's statements finish, normally
or with return. This holds on every constructor route, super(...)
included. Duplicate, positional-after-label and rest-label errors stay.

The user accepted three things in advance:
- 22-Nov-2026: the one compatibility break.
- 23-Nov-2026: the NUC 51 spec byte-seal update that migrating its
  spec case entails.
- 23-Nov-2026: assigning labels after a return.
The 14 assertions that pinned the unknown-name error move to the new
reading of the same calls. The NUC lists each one with its
consequences.

Independent evaluator: policy decision Rejected, solely because the
core gate flags that authorized migration, the case "Nucleoid validates
constructor names

**File**: `README.md` (modified, +25/-0)
```diff
@@ -3024,6 +3024,31 @@ assert([file.draft, file.table], [false, false])
   JavaScript and Python spellings remain available.
 - See the [root contract](nucleoid.spec.md#rust-string-boundary-method-aliases).
 
+## Unknown constructor arguments as properties
+
+**Unknown constructor arguments become live properties**
+
+```nuc
+class Product(name):
+    this.name = name
+$Product.total = $Product.price * $Product.quantity
+item = Product(name="pen", price=2, quantity=3)
+assert(item, {"id": "item", "name": "pen", "price": 2, "quantity": 3, "total": 6})
+item.quantity = 5
+assert(item.total, 10)
+item.total
+# return: 10
+```
+
+- [NUC 136](docs/nuc-0136.md) turns a constructor label that names no
+  parameter into a property: the call acts as if the constructor declared
+  the name and assigned `this.<name> = <name>` after its own statements.
+  The class declares only what its constructor uses, and the class-level
+  rule reads `price` and `quantity` like any other property.
+- Positional calls, declared labels and the binding errors for repeated
+  labels are unchanged. See the
+  [root contract](nucleoid.spec.md#unknown-constructor-arguments-as-properties).
+
 ## Benchmark
 
 This is the comparation our sample order app in Nucleoid IDE against MySQL and Postgres with using Express.js and Sequelize libraries.
```

**File**: `dataset/nucleoid.spec.jsonl` (modified, +9/-1)
```diff
@@ -416,7 +416,7 @@
 {"id":"spec-0416","description":"Nucleoid forwards named arguments to opted-in parent constructors","code":"class Parent(a, b):\n    this.a = a\n    this.b = b\nclass Child(first, second): Parent\n    super(b=second, a=first)\nchild = Child(1, 2)\nassert(child, {\"id\": \"child\", \"a\": 1, \"b\": 2})","return":null}
 {"id":"spec-0417","description":"Nucleoid constructs students with positional and named arguments","code":"class Student(name):\n    this.name = name\npositional = Student(\"Can\")\nnamed = Student(name=\"Can\")\nassert(positional.name, \"Can\")\nassert(named.name, \"Can\")","return":null}
 {"id":"spec-0418","description":"Nucleoid mixes positional and named constructor arguments","code":"class Student(name, age):\n    this.name = name\n    this.age = age\nordered = Student(name=\"Can\", age=20)\nreordered = Student(age=20, name=\"Can\")\nmixed = Student(\"Can\", age=20)\nassert(ordered, {\"id\": \"ordered\", \"name\": \"Can\", \"age\": 20})\nassert(reordered, {\"id\": \"reordered\", \"name\": \"Can\", \"age\": 20})\nassert(mixed, {\"id\": \"mixed\", \"name\": \"Can\", \"age\": 20})","return":null}
-{"id":"spec-0419","description":"Nucleoid validates constructor names without caller assignments","code":"class Student(name, age):\n    this.name = name\n    this.age = age\nname = \"Before\"\nstudent = Student(name=\"Can\", age=20)\nassert(name, \"Before\")\nassert(student.name, \"Can\")\ntry:\n    Student(nmae=\"Can\", age=20)\ncatch error:\n    assert(error, TypeError(\"Unknown constructor argument 'nmae' for Student\"))\ntry:\n    Student(\"Can\", name=\"Other\", age=20)\ncatch error:\n    assert(error, TypeError(\"Duplicate constructor argument 'name' for Student\"))","return":null}
+{"id":"spec-0419","description":"Nucleoid validates constructor names without caller assignments","code":"class Student(name, age):\n    this.name = name\n    this.age = age\nname = \"Before\"\nstudent = Student(name=\"Can\", age=20)\nassert(name, \"Before\")\nassert(student.name, \"Can\")\nmisspelled = Student(nmae=\"Can\", age=20)\nassert(misspelled, {\"id\": \"misspelled\", \"name\": null, \"age\": 20, \"nmae\": \"Can\"})\ntry:\n    Student(\"Can\", name=\"Other\", age=20)\ncatch error:\n    assert(error, TypeError(\"Duplicate constructor argument 'name' for Student\"))","return":null}
 {"id":"spec-0420","description":"Nucleoid preserves ordinary function argument assignments","code":"'use imperative'\ndef pair(a, b):\n    return [a, b]\na = 0\nb = 0\nresult = pair(b=2, a=1)\nassert(result, [2, 1])\nassert(a, 1)\nassert(b, 2)","return":null}
 {"id":"spec-0421","description":"Nucleoid filters reasoning selections by stated and derived state","code":"seed = 2\nmiddle = seed + 3\nresult = middle * 2\nfacts = result |> why |> stated\nconclusions = result |> why |> derived\nassert(facts.map(step => step.node), [\"seed\"])\nassert(facts[0].holds, 2)\nassert(facts[0].from, [])\nassert(conclusions.map(step => step.node), [\"result\", \"middle\"])\nassert(conclusions[0].holds, 10)\nassert(conclusions[0].from, [\"middle\"])\nassert(conclusions[0].state, \"derived\")","return":null}
 {"id":"spec-0422","description":"Nucleoid keeps reasoning state filters live through equal valued rewrites","code":"seed = 1\nvalue = seed + 1\nfacts = value |> why |> stated\nconclusions = value |> why |> derived\nassert(facts.map(step => step.node), [\"seed\"])\nassert(conclusions.map(step => step.node), [\"value\"])\nvalue = 2\nassert(facts.map(step => step.node), [\"value\"])\nassert(conclusions, [])\nvalue = seed + 1\nseed = 3\nassert(facts.map(step => step.node), [\"seed\"])\nassert(facts[0].holds, 3)\nassert(conclusions.map(step => step.node), [\"value\"])\nassert(conclusions[0].holds, 4)","return":null}
@@ -859,3 +859,11 @@
 {"id":"spec-0859","description":"Nucleoid collects and selects live class populations","code":"class Item(name, score):\n    this.name = name\n    this.score = score\nlimit = 5\nnames = Item.collect(item -> item.name)\nchosen = Item.select(item -> item.score >= limit)\nassert([names, chosen], [[], []])\nfirst = Item(\"one\", 4)\nsecond = Item(\"two\", 8)\nassert(names, [\"one\", \"two\"])\nassert(chosen, [second])\nfirst.score = 9\nlimit = 8\nassert(chosen, [first, second])\nthird = Item(\"three\", 2)\nassert(names, [\"one\", \"two\", \"three\"])\nassert(Item.collect(item -> item.score), Item.map(item -> item.score))\nassert(Item.select(item -> item.score), Item.filter(item -> item.score))\ndelete third.name\ndelete third.score\ndelete third\nassert(names, [\"one\", \"two\"])\nassert(chosen, [first, second])\nclass Group(items):\n    this.items = items\n$Group.names = $Group.items.select(item -> item.score >= limit).collect(item -> item.name)\ngroup = Group([first, second])\nassert(group.names, [\"one\", \"two\"])\nsecond.score = 1\nassert([chosen, group.names], [[first], [\"one\"]])\nnames","return":"[\"one\",\"two\"]"}
 {"id":"spec-0860","description":"Nucleoid preserves collection alias er
```

**File**: `dataset/nucleoid.synth.136.jsonl` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+{"id":"synth-136-0001","description":"An unknown constructor label becomes a property, as if the class declared it and assigned it last","code":"class Shape(type):\n    this.type = type\nshape1 = Shape(type=\"SQUARE\", color=\"RED\")\nassert(shape1, {\"id\": \"shape1\", \"type\": \"SQUARE\", \"color\": \"RED\"})\n[shape1.type, shape1.color]","return":"[\"SQUARE\",\"RED\"]"}
+{"id":"synth-136-0002","description":"A class without parameters or a body keeps every labeled attribute of its instances","code":"class Point\norigin = Point(x=0, y=0)\ncorner = Point(x=3, y=4)\nassert(origin, {\"id\": \"origin\", \"x\": 0, \"y\": 0})\nPoint.map(point -> point.x + point.y)","return":"[0,7]"}
+{"id":"synth-136-0003","description":"Unknown labels are assigned once the constructor statements finish, so a label replaces what the body set, even after a return","code":"class Lamp(room):\n    this.room = room\n    this.watts = 40\n    if room == \"attic\":\n        return\n    this.lit = true\nhall = Lamp(room=\"hall\")\ndesk = Lamp(room=\"desk\", watts=60, color=\"WARM\")\nattic = Lamp(room=\"attic\", watts=25)\nassert(hall, {\"id\": \"hall\", \"room\": \"hall\", \"watts\": 40, \"lit\": true})\nassert(attic, {\"id\": \"attic\", \"room\": \"attic\", \"watts\": 25})\n[desk.watts, desk.color, desk.lit]","return":"[60,\"WARM\",true]"}
+{"id":"synth-136-0004","description":"A bodyless subclass passes unknown labels to the inherited constructor, and super forwards its own","code":"class Animal(name):\n    this.name = name\nclass Dog: Animal\n    pass\nclass Puppy(age): Animal\n    super(name=\"Rex\", sound=\"yip\")\n    this.age = age\nfido = Dog(name=\"Fido\", sound=\"woof\")\nrex = Puppy(age=1, toy=\"ball\")\nassert(fido, {\"id\": \"fido\", \"name\": \"Fido\", \"sound\": \"woof\"})\n[rex.name, rex.sound, rex.age, rex.toy]","return":"[\"Rex\",\"yip\",1,\"ball\"]"}
+{"id":"synth-136-0005","description":"Adopted init signatures, with a block or an expression body, take unknown labels after their declared parameters","code":"class Account:\n    def init(owner):\n        this.owner = owner\nclass Badge:\n    def init(name) => this.name = name\naccount = Account(owner=\"Ada\", currency=\"EUR\")\nbadge = Badge(name=\"Ada\", rank=\"Captain\")\nassert(account, {\"id\": \"account\", \"owner\": \"Ada\", \"currency\": \"EUR\"})\nassert(badge, {\"id\": \"badge\", \"name\": \"Ada\", \"rank\": \"Captain\"})\n[account.currency, badge.rank]","return":"[\"EUR\",\"Captain\"]"}
+{"id":"synth-136-0006","description":"Class-level rules read properties from unknown labels and follow their changes","code":"class Order(item):\n    this.item = item\n$Order.total = $Order.price * $Order.count\norder = Order(item=\"tea\", price=4, count=2)\nassert(order.total, 8)\norder.count = 5\norder.total","return":"20"}
+{"id":"synth-136-0007","description":"Unknown label values are snapshots and never assign caller variables","code":"class Note\ncolor = \"BLUE\"\ntag = \"draft\"\nnote = Note(color=\"RED\", label=tag)\ntag = \"final\"\nassert([note.color, note.label, color], [\"RED\", \"draft\", \"BLUE\"])\nnote.label","return":"\"draft\""}
+{"id":"synth-136-0008","description":"A repeated unknown label is rejected before any value runs, and a failing value builds nothing","code":"class Shape(type):\n    this.type = type\nevents = {count: 0}\nduplicate = \"\"\ntry:\n    Shape(color=(events.count=1), color=\"BLUE\")\ncatch error:\n    duplicate = error\nmissed = \"\"\ntry:\n    Shape(type=\"SQUARE\", color=missing)\ncatch error:\n    missed = error\n[duplicate, missed, events.count, Shape.length]","return":"[\"TypeError: Duplicate constructor argument 'color' for Shape\",\"ReferenceError: missing is not defined\",0,0]"}
```

**File**: `docs/README.md` (modified, +51/-7)
```diff
@@ -1189,8 +1189,11 @@ class Shape:
 - The values remain constructor snapshots, not new reactive relationships.
   Binding validation precedes all RHS evaluation, including `.value` reads.
 - `class Point` can adopt an ordinary `def init(x, y):` body and parameter
-  list. Named binding adds no automatic fields or defaults; scalar defaults
-  have their own [bounded contract](#literal-parameter-defaults).
+  list. Binding a declared parameter by name adds no automatic fields or
+  defaults; a label that names no parameter becomes a property, as
+  [Unknown constructor arguments as properties](#unknown-constructor-arguments-as-properties)
+  describes, and scalar defaults have their own
+  [bounded contract](#literal-parameter-defaults).
 - Named shared class-rule construction also sees the declaration caller's
   parameters; legacy positional shared construction keeps its existing scope.
 - Inheritance uses the nearest nonempty constructor body's signature; a child
@@ -1201,9 +1204,9 @@ class Shape:
   Compound and member assignments remain positional. Functions, methods,
   built-ins and direct `init` calls keep assignment-expression behavior.
   Class aliases gain no construction route.
-- Duplicate bindings (including positional plus named), unknown labels, and
-  positional arguments after labels raise explicit `TypeError`s before
-  value effects or instance creation. Star headers raise the ordinary
+- Duplicate bindings (including positional plus named) and positional
+  arguments after labels raise explicit `TypeError`s before value effects or
+  instance creation. Star headers raise the ordinary
   parameter `SyntaxError`; existing transactions still restore partial
   construction and graph/class state on failure.
 - This is the exact paired `Nucleoid constructs an object with named parameters`
@@ -1221,6 +1224,47 @@ assert(point, {"id": "point", "x": 3, "y": 4})
   [default named constructors](../nucleoid.spec.md#default-named-constructors)
   section; [NUC 47](nuc-0047.md) records this isolated candidate revision.
 
+### Unknown constructor arguments as properties
+
+```
+class Shape(type):
+    this.type = type
+shape1 = Shape(type="SQUARE", color="RED")
+assert(shape1, {"id": "shape1", "type": "SQUARE", "color": "RED"})
+shape1.color
+```
+
+- A constructor label that names no parameter of the effective constructor
+  becomes a property ([NUC 136](nuc-0136.md)). The call acts as if that
+  constructor declared the name as one more parameter and its statements
+  were followed by `this.<name> = <name>`, so `shape1` is the instance that
+  `class Shape(type, color):` with `this.type = type` and
+  `this.color = color` would build.
+- Every constructor takes such labels: bodyless and parameterless headers,
+  inherited constructors, `super(...)`, adopted `def init` and
+  `def __init__(self, ...)`, initializing parameters, defaults, rest
+  parameters, `new`, nested and collection instances, shared class rules
+  and `is` assignments.
+- The assignments run after the constructor's own statements, so the
+  statements can read the name and a label replaces a property they set.
+  They run however the statements end, after an early `return` too, so an
+  expression-bodied `def init(...) => value` keeps its labels; that is the
+  one deliberate difference from the written-out spelling. A failing
+  statement still rolls back the whole instance.
+- Values are snapshots evaluated once in source order, labels never assign
+  caller variables, and class-level rules still apply after construction.
+- Positional values never fill these labels. A repeated label, a positional
+  argument after a label and a label naming a rest parameter still raise
+  their `TypeError`s before any value runs. A misspelled label is no longer
+  an error: it becomes a property of its own.
+- Functions, methods, built-ins and direct `init` calls keep their
+  assignment-expression arguments, and no syntax is added.
+- This is the exact
+  `Nucleoid builds an instance from unknown constructor arguments` example
+  in `tests/reference.md`. The authoritative
+  [root section](../nucleoid.spec.md#unknown-constructor-arguments-as-properties)
+  and its eight appended entries define the behavior.
+
 ### Initializing constructor parameters
 
 - A constructor parameter written `this.name` or `self.name` declares the
@@ -2111,7 +2155,7 @@ Normative detail: [exit-controlled repeat-until loops](../nucleoid.spec.md#exit-
 - The effective literal initializes the fresh Scope slot at version zero.
   Functions, aliases, callbacks, methods and function Values share binding;
   positional/named/mixed/inherited constructors and `super` use the selected
-  signature without changing strict labels, evaluation order, single
+  signature without changing label validation, evaluation order, single
   evaluation, receiver capture or parent/class-resolution timing.
 - Live redefinition and rollback retain their existing State/graph boundary.
   Frozen/
```

**File**: `docs/examples.md` (modified, +27/-0)
```diff
@@ -4550,6 +4550,33 @@ selected
   not Rust pattern overloads. See [NUC 132](nuc-0132.md) and the
   [root contract](../nucleoid.spec.md#rust-string-boundary-method-aliases).
 
+## Unknown constructor arguments as properties
+
+**Unknown constructor arguments describe a fleet's vehicles**
+
+```nuc
+class Vehicle(plate):
+    this.plate = plate
+$Vehicle.heavy = $Vehicle.weight > 3500
+van = Vehicle(plate="V1", weight=2800, color="WHITE")
+truck = Vehicle(plate="T1", weight=7200)
+heavy = Vehicle.filter(vehicle -> vehicle.heavy).map(vehicle -> vehicle.plate)
+assert(heavy, ["T1"])
+assert([van.color, truck.color], ["WHITE", null])
+van.weight = 4000
+assert(heavy, ["V1", "T1"])
+heavy
+# return: ["V1","T1"]
+```
+
+- Each vehicle carries the attributes its caller names, though the class
+  declares only `plate`; the class-level rule and the live selection read
+  `weight` like any property and follow its changes.
+- A label that names no parameter becomes a property after the
+  constructor's statements, as [NUC 136](nuc-0136.md) and the
+  [root contract](../nucleoid.spec.md#unknown-constructor-arguments-as-properties)
+  define. A vehicle built without a `color` label has none.
+
 ## Copyright
 
 Copyright 2020 Nucleoid
```

**File**: `docs/nuc-0000.md` (modified, +2/-2)
```diff
@@ -101,7 +101,7 @@ Created: 31-Jul-2026
 | [119](nuc-0119.md) | Finally Clauses for Try Statements | Accepted |
 | [126](nuc-0126.md) | Exit-Controlled Repeat-Until Loops | Accepted |
 | [130](nuc-0130.md) | Loop-Local Iterator Exits | Rejected: existing corpus-count test fails (1,246 expected; 1,252 actual) |
-| [136](nuc-0136.md) | Unknown Constructor Arguments as Properties | Draft |
+| [136](nuc-0136.md) | Unknown Constructor Arguments as Properties | Accepted |
 
 ### Utility enhancement
 
@@ -328,7 +328,7 @@ Created: 31-Jul-2026
 | [133](nuc-0133.md) | Edge Lists of Reasoning Selections | Standards Track | Reasoning enhancement | Accepted |
 | [134](nuc-0134.md) | Ruby Collection Method Aliases | Standards Track | Language compatibility | Accepted |
 | [135](nuc-0135.md) | Kotlin Negated Membership Operator | Standards Track | Language compatibility | Draft |
-| [136](nuc-0136.md) | Unknown Constructor Arguments as Properties | Standards Track | Runtime features | Draft |
+| [136](nuc-0136.md) | Unknown Constructor Arguments as Properties | Standards Track | Runtime features | Accepted |
 | [137](nuc-0137.md) | Floating-Point Absolute Value Alias | Standards Track | Language compatibility | Accepted |
 | [138](nuc-0138.md) | Reactive Secant | Standards Track | Utility enhancement | Draft |
 
```

**File**: `docs/nuc-0136.md` (modified, +583/-11)
```diff
@@ -4,11 +4,11 @@
 NUC: 136
 Title: Unknown Constructor Arguments as Properties
 Author: Can Mingir <canmingir@gmail.com>
-Status: Draft
+Status: Accepted
 Type: Standards Track
 Category: Runtime features
 Created: 22-Nov-2026
-Requires: 14, 47, 54, 74, 78, 87, 107
+Requires: 14, 47, 54, 74, 78, 87, 93, 95, 107
 ```
 
 ## Abstract
@@ -22,7 +22,11 @@ Requires: 14, 47, 54, 74, 78, 87, 107
   `shape1 = Shape(type='SQUARE', color='RED')` builds the instance that
   `class Shape(type, color):` with the body `this.type = type` and
   `this.color = color` builds:
-  `{"id": "shape1", "type": "SQUARE", "color": "RED"}`.
+  `{"id": "shape1", "type": "SQUARE", "color": "RED"}`. The one deliberate
+  difference from that spelling, which the user decided, is that the
+  assignments run however the constructor's statements end, after an early
+  `return` too, so an expression-bodied `def init(...) => value` keeps its
+  labels.
 - Every constructor route takes unknown labels: class headers with or
   without a body or a parameter list, a parent named after a colon or with
   `extends` ([NUC 78](nuc-0078.md)), inherited constructors, adopted
@@ -43,14 +47,26 @@ Requires: 14, 47, 54, 74, 78, 87, 107
   raised that `TypeError` before evaluating any argument, now evaluates its
   values once in source order and builds the instance. The 14 existing
   assertions that pin exactly that error move to the new reading, keeping
-  their case identities, and this NUC lists each one: the specification
-  case `Nucleoid validates constructor names without caller assignments`
-  and assertions in `tests/named_constructors.rs`, with its CLI fixture
-  `tests/fixtures/named-constructors-invalid.nuc`,
+  their case identities, and this NUC lists each one under
+  [Compatibility](#compatibility), with the direct consequences of the same
+  calls, the byte seal of the rewritten specification case among them: the
+  specification case
+  `Nucleoid validates constructor names without caller assignments` and
+  assertions in `tests/named_constructors.rs`, with its CLI fixture
+  `tests/fixtures/named-constructors-invalid.nuc`, which is unchanged,
   `tests/initializing_parameters.rs`, `tests/self_parameters.rs`,
   `tests/rest_parameters.rs`, `tests/literal_parameter_defaults.rs` and
   `tests/item_words.rs`. That break alone fails no hard criterion; any
   other break or test edit still does.
+- **Outcome: Accepted**, on the user-requested basis: the frozen candidate
+  met all three hard criteria in the independent evaluation and again on
+  the integrated tree. The independent evaluator's policy decision was
+  Rejected, solely because the deterministic core gate flags the migration
+  the user authorized, the specification case
+  `Nucleoid validates constructor names without caller assignments`, as an
+  invalid legacy case on replay and as changed assertions in its migrated
+  copy. Token comparison was skipped as a single-proposal request; see
+  [Evaluation](#evaluation).
 
 ## Motivation
 
@@ -78,19 +94,575 @@ Requires: 14, 47, 54, 74, 78, 87, 107
 
 ## Rationale
 
-- Pending: the proposer completes this section.
+- **The user's equivalence, taken literally.** An unknown label is one more
+  parameter of the effective constructor, followed by
+  `this.<name> = <name>`. Every observable then comes from the accepted
+  behavior of that written-out spelling: property order, snapshots,
+  dependencies, `why` rules, graph keys, transactions, rollback and
+  class-level rules. No second way of writing properties is added.
+- **The parsed statement, not a copy of it.** Each assignment is the
+  statement an initializing parameter `this.<name>` lowers to
+  ([NUC 87](nuc-0087.md)), the tree the parser builds for
+  `this.color = color`, so it explains, renders, depends and rolls back as
+  the written statement does.
+- **After the constructor's statements.** The user's spelling writes
+  `this.color = color` last. The statements can read the label as a
+  parameter, and a caller's label replaces a value the statements set, the
+  usual reason to pass a value the constructor does not declare.
+- **However the statements end.** Taken literally, the written-out spelling
+  would skip the assignments after a `return`, including the one an
+  expression-bodied `def init(...) => value` lowers to, so such a
+  constructor would accept a label and drop it. The user decided on
+  23-Nov-2026 that every constructor keeps its labels: the assignments run
+  once the statements finish, normally or with a `return`. This is the one
+  deliberate difference from the written-out spelling. A failing statement
+  still skips them and rolls back the whole instance.
+- **Per call, not per class.** Only the call that passes a label gets its
+  property; the class's signature, its other instances and later calls are
+  unchanged. The unknown names come after every declared parameter and any
+  rest formal and bind only by label, so positional values never reach

```

**File**: `nucleoid.spec.md` (modified, +228/-19)
```diff
@@ -2893,15 +2893,19 @@ statement positions; caught values and transaction recovery are unchanged.
   ordinary-call function/local shadowing differences remain unchanged.
 - For calls containing labels, validate the entire binding plan before any
   argument effects or `.value` reads. Positional arguments fill successive
-  declared slots and must precede all labels. Reject the first unknown name,
-  repeated binding (including positional plus named), or positional argument
-  following a named argument, in source order.
+  declared slots and must precede all labels. Reject the first repeated
+  binding (including positional plus named) or positional argument following
+  a named argument, in source order. A label that names no parameter is not
+  rejected; it binds as
+  [Unknown constructor arguments as properties](#unknown-constructor-arguments-as-properties)
+  specifies.
 - Evaluate supplied values exactly once in source order in the caller's
   scope, then bind them in declaration order. Omitted parameters without
-  literal defaults retain `null`; named binding itself adds no defaults or
-  automatic property assignments. Literal defaults are specified separately.
-  Surplus positional values are still evaluated and ignored. Existing
-  duplicate formal names and purely positional binding are not redesigned.
+  literal defaults retain `null`; binding a declared parameter by name adds
+  no defaults or automatic property assignments. Literal defaults are
+  specified separately. Surplus positional values are still evaluated and
+  ignored. Existing duplicate formal names and purely positional binding are
+  not redesigned.
 - Use the nearest nonempty constructor body's signature, including adopted
   `def init` signatures and inherited constructors. An empty child header
   cannot replace that effective signature. Constructor scopes, receivers,
@@ -2936,9 +2940,9 @@ statement positions; caught values and transaction recovery are unchanged.
 - A constructor header star raises the ordinary parameter diagnostic
   `SyntaxError("Expected a parameter but found '*'")`; no star form is
   retained. Other parameter/suite diagnostics and source positions remain.
-- An unknown label raises
-  `TypeError("Unknown constructor argument '<name>' for <class>")`.
-  A repeated binding raises
+- An unknown label raises no error; it becomes a property as
+  [Unknown constructor arguments as properties](#unknown-constructor-arguments-as-properties)
+  specifies. A repeated binding raises
   `TypeError("Duplicate constructor argument '<name>' for <class>")`.
   A positional argument after a label raises
   `TypeError("Positional constructor argument after named arguments for <class>")`.
@@ -2948,7 +2952,96 @@ statement positions; caught values and transaction recovery are unchanged.
   count limit, dependency, project version or ARC change is introduced.
 - The eight historical constructor entries and four new pre-executed Student
   and ordinary-function counterparts below protect all canonical assertions,
-  expected returns, case identities and executed assertion coverage.
+  expected returns, case identities and executed assertion coverage. Under
+  the break that [NUC 136](docs/nuc-0136.md) records, the misspelled-label
+  assertion of `Nucleoid validates constructor names without caller assignments`
+  now asserts the instance that the call builds.
+
+## Unknown constructor arguments as properties
+
+- An unknown label is a constructor-call label that names no parameter of
+  the effective constructor, the one
+  [Default named constructors](#default-named-constructors) selects: the
+  nearest nonempty constructor of the class or an ancestor, with adopted
+  `def init(...)` and `def __init__(self, ...)` signatures. A label that
+  names only a parameter of a bodyless subclass header is unknown too.
+- An unknown label raises no error. The call acts as if the effective
+  constructor declared the label's name as one more parameter, after its
+  declared parameters in label source order, and its statements were
+  followed by `this.<name> = <name>` for each unknown label in source order.
+  After `class Shape(type):` with the body `this.type = type`,
+  `shape1 = Shape(type="SQUARE", color="RED")` builds the instance that
+  `class Shape(type, color):` with the body `this.type = type` and
+  `this.color = color` builds: `{"id": "shape1", "type": "SQUARE", "color": "RED"}`.
+- The whole call is still validated before any value runs. A repeated label,
+  an unknown one included, raises
+  `TypeError("Duplicate constructor argument '<name>' for <class>")`, and a
+  positional argument after a label and a label naming a rest formal keep
+  their `TypeError`s. Only the unknown-name rejection is gone.
+- Values still run once, in source order, in the caller's scope. Declared
+  parameters bind as before. Each unknown label's value is bound to its name
+  in the constructor scope after the declared parameters and any rest
+
```

---

### Incident Patch 2: `a7160446` (2026-11-23)
**Commit Message**: Resume NUC 136 Unknown Constructor Arguments as Properties

Renews the claim of NUC 136, still in progress in the session that
allocated it (allocation 870bc76b at 2026-11-22T16:01:50-05:00, 13h39m
ago). The candidate is prepared and awaiting its Rust improvement pass
and independent evaluation. This empty commit records no outcome.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>



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

## X. NUC 136 Unknown Constructor Arguments as Properties

**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5779103e`: NUC 136 Unknown Constructor Arguments as Properties. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
## Unknown constructor arguments as properties

**Unknown constructor arguments become live properties**

```nuc
class Product(name):
    this.name = name
$Product.total = $Product.price * $Product.quantity
item = Product(name="pen", price=2, quantity=3)
assert(item, {"id": "item", "name": "pen", "price": 2, "quantity": 3, "total": 6})
item.quantity = 5
assert(item.total, 10)
item.total
# return: 10
```

- [NUC 136](docs/nuc-0136.md) turns a constructor label that names no
  parameter into a property: the call acts as if the constructor declared
  the name and assigned `this.<name> = <name>` after its own statements.
  The class declares only what its constructor uses, and the class-level
  rule reads `price` and `quantity` like any other property.
- Positional calls, declared labels and the binding errors for repeated
  labels are unchanged. See the
  [root contract](nucleoid.spec.md#unknown-constructor-arguments-as-properties).

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5779103e` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
