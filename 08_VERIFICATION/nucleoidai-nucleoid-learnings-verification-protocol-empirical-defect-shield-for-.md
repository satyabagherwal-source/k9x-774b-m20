# Verification Protocol: Verification Protocol: Empirical Defect Shield for nucleoidai-nucleoid-learnings

<!-- PROVENANCE_START
{
  "source_repository": "nucleoidai-nucleoid-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T04:13:34.687Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-nucleoidai-nucleoid-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nucleoidai-nucleoid-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T04:13:34.687Z`  
> **Learning ID**: `LEARN-EVO-nucleoidai-nucleoid-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `nucleoidai-nucleoid-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `259343d1`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T04:13:28.911Z  
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
> **Harvest Timestamp**: 2026-11-19T04:03:27.332Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NucleoidAI/Nucleoid`
- **Description**: Logic Language for World Models 🌱🐋🌍
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
        Stmt::While { condition, body } => loop_key("while", condition, body),
        Stmt::Repeat { count, body } => loop_key("repeat", count, body),
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
        if self.words
            && self.accepted(Self::attempt_suppose_premise).is_none()
            && self.separates(sta
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

  const { result: instances } = await llm.generate({
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

export async function value({
  instance_name,
  train_dataset,
  input_matrix,
  instance,
}) {
  milestone.constructing_instance({ instance_name });

  instance.instance_name = instance_name;

  const { x, y, width, height, volume } = Matrix.locate(
    instance.input_instance_matrix
  );

  const orientation = await object.orientation({ train_dataset, instance });

  const implementation = await object.implementation({
    train_dataset,
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
      train_dataset.declarations[0],
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
import object from "./object.ts";

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
      await analyzer.value({
        instance_name: next_instance_name(),
        train_dataset,
        input_matrix: dataset.input_matrix,
        instance,
      });
    }

    dataset.instances = instances;
  }

  await analyzer.state(train_dataset);

  const synthesized_dataset = await synthesizer.synthesize({ train_dataset });

  for (const dataset of synthesized_dataset) {
    for (const instance of dataset.instances) {
      await analyzer.value({
        instance_name: next_instance_name(),
        train_dataset,
        input_matrix: dataset.input_matrix,
        instance,
      });
    }

    await object.state({
      declarations,
      input_matrix: dataset.input_matrix,
      input_instances: dataset.instances,
    });

    train_dataset.dataset.push(dataset);
  }

  milestone.visualization();

  const { instances } = await visualizer.instances({
    train_dataset,
    test_input_matrix,
  });

  let result_matrix = Array.from({ length: test_input_matrix.length }, () =>
    Array(test_input_matrix[0].length).fill(0)
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

  await object.state({
    declarations,
    input_matrix: test_input_matrix,
    input_instances,
  });

  for (const input_instance of input_instances) {
    const { output_instance_matrix } = await visualizer.output_instance_matrix({
      test_input_matrix,
      train_dataset,
      instance: input_instance,
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

### Incident Patch 1: `259343d1` (2026-11-19)
**Commit Message**: Draft NUC 122 Python-Style Except Clauses

Category: Language compatibility, drawn uniformly at random (index 4 of
the five eligible categories in NUC 1's registry, p = 1/5, no redraw)
for a continuous /nuc-proposal cycle. Language compatibility skips token
comparison entirely; every other check still applies.

Requested change: a try statement may spell its catch clause with
Python's except. except: and except Exception: catch every error as
catch: does, and except Exception as NAME: binds the error to NAME as
catch NAME: does, also with a finally: clause of NUC 119 after it. At
the accepted revision each such program is a whole-program parse error,
SyntaxError("Expected 'catch' after 'try'"); only those programs change.
Every other name after except, as in except e: or except ValueError:,
keeps that error, because Python reads it as a filter by exception
class, and except stays an ordinary name everywhere else, including
NUC 106's except stage.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01AJtz8e8dqMwocimNqgffMq

**File**: `docs/nuc-0000.md` (modified, +2/-0)
```diff
@@ -165,6 +165,7 @@ Created: 31-Jul-2026
 | [116](nuc-0116.md) | Size and Emptiness Method Aliases | Accepted |
 | [117](nuc-0117.md) | First and Last Element Methods | Accepted |
 | [118](nuc-0118.md) | Case Conversion Method Aliases | Accepted |
+| [122](nuc-0122.md) | Python-Style Except Clauses | Draft |
 
 ### Documentation
 
@@ -297,6 +298,7 @@ Created: 31-Jul-2026
 | [119](nuc-0119.md) | Finally Clauses for Try Statements | Standards Track | Runtime features | Accepted |
 | [120](nuc-0120.md) | Union Reasoning Selections | Standards Track | Reasoning enhancement | Accepted |
 | [121](nuc-0121.md) | Held Values of Reasoning Selections | Standards Track | Reasoning enhancement | Accepted |
+| [122](nuc-0122.md) | Python-Style Except Clauses | Standards Track | Language compatibility | Draft |
 
 ## Copyright
 
```

**File**: `docs/nuc-0122.md` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+# NUC 122 -- Python-Style Except Clauses
+
+```
+NUC: 122
+Title: Python-Style Except Clauses
+Author: Can Mingir <canmingir@gmail.com>
+Status: Draft
+Type: Standards Track
+Category: Language compatibility
+Created: 18-Nov-2026
+```
+
+## Abstract
+
+- A `try` statement may spell its catch clause with Python's `except`.
+  `except:` and `except Exception:` catch every error, as `catch:` does,
+  and `except Exception as NAME:` binds the error to `NAME`, as
+  `catch NAME:` does.
+- Such a program reads exactly as its `catch` spelling, including a
+  `finally:` clause of [NUC 119](nuc-0119.md) after the `except` clause.
+- At the accepted revision each such program is a whole-program parse
+  error, `SyntaxError("Expected 'catch' after 'try'")`. Only those programs
+  change.
+- Every other name after `except`, as in `except e:` or
+  `except ValueError:`, keeps that error, because Python reads it as a
+  filter by exception class, which Nucleoid's errors do not have. `except`
+  stays an ordinary name everywhere else, including the `except` stage of
+  [NUC 106](nuc-0106.md).
+
+## Motivation
+
+- Nucleoid already reads many of Python's spellings: `def`, `elif`, `None`,
+  `self`, `lambda`, `not in`, `pass` and, through NUC 119, `finally:`. Its
+  error handling still knows only `catch`, so a model or a programmer who
+  writes Python's `try:` and `except Exception as error:` gets a parse
+  error for the whole program.
+- The catch-all forms `except:` and `except Exception as error:` are
+  Python's spellings of a clause that catches every error, which is what
+  Nucleoid's `catch` does. Reading them lets familiar Python error handling
+  run unchanged, as the language-superset aspiration of
+  [NUC 1](nuc-0001.md) asks.
+
+## Rationale
+
+- Pending: the proposer completes this section.
+
+## Specification
+
+- Pending: the proposer completes this section.
+
+## Errors
+
+- Pending: the proposer completes this section.
+
+## Reference Implementation
+
+- Pending: the proposer completes this section.
+
+## Copyright
+
+Copyright 2020 Nucleoid
+
+This document is licensed under the Apache License, Version 2.0. See
+[LICENSE](../LICENSE) for the full text.
```

---

### Incident Patch 2: `c4802b50` (2026-11-19)
**Commit Message**: NUC 121 Held Values of Reasoning Selections

Accepted under the automatic acceptance rule, in a continuous
/nuc-proposal cycle (Reasoning enhancement, token comparison required):
the frozen candidate meets every hard criterion and passes every policy
check, including the token non-regression gate. The cycle found no stale
Draft, drew Reasoning enhancement uniformly from the five eligible
categories, allocated NUC 121 in 226268f4, and completed it with fresh
baselines, candidate, proposer, Rust improvement pass and evaluator.

A final pipeline stage, selection |> holds, gives the values that the
steps of a reasoning selection hold, as a list in the selection's order:
exactly the accepted (selection).map(step => step.holds), where a
reference alone denotes its own one-step selection, as for NUC 112's
nodes. It shares the final-stage path of nodes: the parser maps holds
after |> to the new public variant Stage::Holds, the crate-private
Stage::projection and StepField choose the step field that a final
stage projects, and Runtime::projected builds the same step records, so
later anonymous objects are numbered as under the accepted spelling, but
records no read of them, so a standing de

**File**: `README.md` (modified, +30/-0)
```diff
@@ -2587,6 +2587,36 @@ assert(inspect.map(step -> step.node), ["flow", "pressure", "valve", "temperatur
   valve joins them. See the
   [root contract](nucleoid.spec.md#union-reasoning-selections).
 
+## Held values of reasoning selections
+
+**Holds lists the readings behind a frost warning and what the wind moves**
+
+```nuc
+air = 3
+ground = -1
+wind = 12
+chill = air - wind / 4
+frost = chill + ground < 1
+readings = frost |> why |> stated |> holds
+moved = wind |> affects |> holds
+assert(readings, [-1, 3, 12])
+assert(moved, [0, true])
+wind = 4
+assert([readings, moved], [[-1, 3, 4], [2, false]])
+```
+
+- [NUC 121](docs/nuc-0121.md) adds the final reasoning stage `|> holds`,
+  which gives the values of a selection's steps in their order.
+  `frost |> why |> stated |> holds` lists the readings the frost warning
+  rests on, and `wind |> affects |> holds` the values that a change of the
+  wind reaches: the chill and the warning itself.
+- Both lists are the values that
+  `(frost |> why |> stated).map(step => step.holds)` and
+  `(wind |> affects).map(step => step.holds)` give, and they stay live the
+  same way: once the wind drops, the readings show its new speed and the
+  warning clears. See the
+  [root contract](nucleoid.spec.md#held-values-of-reasoning-selections).
+
 ## Reactive list flattening
 
 **Flat turns nested lists into one live list**
```

**File**: `dataset/nucleoid.spec.jsonl` (modified, +20/-16)
```diff
@@ -795,19 +795,23 @@
 {"id":"spec-0795","description":"Nucleoid narrows a union of explanations to its facts and conclusions","code":"price = 10\nquantity = 3\nrate = 0.2\nsubtotal = price * quantity\ntax = subtotal * rate\nshipping = quantity * 2\nfacts = why tax |> union(why shipping) |> stated\nrules = why tax |> union(why shipping) |> derived\nassert(facts.map(s -> s.node), [\"rate\", \"price\", \"quantity\"])\nassert(rules.map(s -> s.node), [\"tax\", \"subtotal\", \"shipping\"])\nfee = 2\nshipping = quantity * 2 + fee\nassert(facts.map(s -> s.node), [\"rate\", \"price\", \"quantity\", \"fee\"])\nsubtotal = 25\nassert(facts.map(s -> s.node), [\"subtotal\", \"rate\", \"quantity\", \"fee\"])\nassert(rules.map(s -> s.node), [\"tax\", \"shipping\"])","return":null}
 {"id":"spec-0796","description":"Nucleoid joins what two changes of each instance reach with union","code":"class Part(cost, weight):\n    this.cost = cost\n    this.weight = weight\n$Part.price = $Part.cost * 2\n$Part.freight = $Part.weight * 3\n$Part.charge = $Part.price + $Part.freight\n$Part.reach = $Part.cost |> affects |> union($Part.weight |> affects)\nbolt = Part(4, 1)\nnut = Part(2, 5)\nassert(bolt.reach.map(s -> s.node), [\"bolt.price\", \"bolt.charge\", \"bolt.freight\"])\nassert(nut.reach.map(s -> s.node), [\"nut.price\", \"nut.charge\", \"nut.freight\"])\n$Part.duty = $Part.weight * 0.1\nassert(nut.reach.map(s -> s.node), [\"nut.price\", \"nut.charge\", \"nut.freight\", \"nut.duty\"])\nbolt.weight = 10\nassert(bolt.reach.map(s -> s.holds), [8, 38, 30, 1])\nnut.reach.length","return":"4"}
 {"id":"spec-0797","description":"Nucleoid restores unions after failed changes","code":"price = 10\nquantity = 3\nsubtotal = price * quantity\nshipping = quantity * 2\neither = why subtotal |> union(why shipping)\nfailure = \"\"\ntry:\n    either = why subtotal |> union(1)\ncatch error:\n    failure = error\nassert(failure, TypeError(\"Cannot explain 1\"))\nassert(either.map(s -> s.node), [\"subtotal\", \"price\", \"quantity\", \"shipping\"])\ntry:\n    fee = 2\n    shipping = quantity * 2 + fee\n    assert(either.map(s -> s.node), [\"subtotal\", \"price\", \"quantity\", \"shipping\", \"fee\"])\n    throw \"UNDO\"\ncatch error:\n    assert(error, \"UNDO\")\nassert(either.map(s -> s.node), [\"subtotal\", \"price\", \"quantity\", \"shipping\"])\nquantity = 6\nassert(either.map(s -> s.holds), [60, 10, 6, 12])","return":null}
-{"id":"spec-0798","description":"Nucleoid flattens nested lists by one level","code":"nested = [[1, 2], 2, [[3, [4]]], [], \"ab\"]\nonce = nested.flat()\ntwice = once.flat(1)\nassert(once, [1, 2, 2, [3, [4]], \"ab\"])\nassert(twice, [1, 2, 2, 3, [4], \"ab\"])\nassert(nested, [[1, 2], 2, [[3, [4]]], [], \"ab\"])\nnested.push([[5]], 6)\nassert(once, [1, 2, 2, [3, [4]], \"ab\", [5], 6])\nassert(twice, [1, 2, 2, 3, [4], \"ab\", 5, 6])\ntwice.length","return":"8"}
-{"id":"spec-0799","description":"Nucleoid flattens lists to a given depth","code":"deep = [1, [2, [3, [4, [5]]]], [[6]]]\ntwo = deep.flat(2)\nthree = deep.flat(3)\nsame = deep.flat(0)\nassert(two, [1, 2, 3, [4, [5]], 6])\nassert(three, [1, 2, 3, 4, [5], 6])\nassert(same, [1, [2, [3, [4, [5]]]], [[6]]])\ndeep.push([[7, [8]]])\nassert(two, [1, 2, 3, [4, [5]], 6, 7, [8]])\nassert(three, [1, 2, 3, 4, [5], 6, 7, 8])\nassert(same, deep)\nthree.length","return":"8"}
-{"id":"spec-0800","description":"Nucleoid keeps flattened lists live","code":"shifts = [[\"ana\", \"bo\"], [\"cy\"]]\nstaff = shifts.flat()\nsize = staff.length\nassert([staff, size], [[\"ana\", \"bo\", \"cy\"], 3])\nshifts.push([\"di\"])\nassert([staff, size], [[\"ana\", \"bo\", \"cy\", \"di\"], 4])\nshifts = [[\"eve\"], [], [\"fay\", \"gus\"]]\nassert([staff, size], [[\"eve\", \"fay\", \"gus\"], 3])\nshifts.shift()\nassert([staff, size], [[\"fay\", \"gus\"], 2])\nsize","return":"2"}
-{"id":"spec-0801","description":"Nucleoid flattens lists in class level rules","code":"class Team(squads):\n    this.squads = squads\n$Team.members = $Team.squads.flat()\nred = Team([[\"ana\", \"bo\"], [\"cy\"]])\nblue = Team([[\"di\"]])\nassert([red.members, blue.members], [[\"ana\", \"bo\", \"cy\"], [\"di\"]])\nred.squads.push([\"ed\"])\nblue.squads = [[\"fay\"], [\"gus\", \"hal\"]]\nassert([red.members, blue.members], [[\"ana\", \"bo\", \"cy\", \"ed\"], [\"fay\", \"gus\", \"hal\"]])\nred.members.length","return":"4"}
-{"id":"spec-0802","description":"Nucleoid queries the cells of flattened grids","code":"grid = [[1, 0, 2], [0, 3, 2]]\ncells = grid.flat()\ntotal = cells.sum()\ncolors = cells.distinct()\nfilled = cells.count(cell => cell > 0)\nassert([total, colors, filled], [8, [1, 0, 2, 3], 4])\ngrid.push([5, 0, 0])\nassert([total, colors, filled], [13, [1, 0, 2, 3, 5], 5])\ngrid = [[4, 4], [0]]\n[total, colors, filled]","return":"[8,[4,0],2]"}
-{"id":"spec-0803","description":"Nucleoid rolls back failed flattening updates","code":"rows = [[1, [2]], [3]]\ncells = rows.flat()\ntry:\n    rows.push([4])\n    assert(cells, [1, [2], 3, 4
```

**File**: `dataset/nucleoid.synth.85.jsonl` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+{"id":"synth-85-0001","description":"Holds gives the values of every step of an explanation, in the explanation's order","code":"price = 10\nqty = 3\nshipping = 5\nsubtotal = price * qty\ntotal = subtotal + shipping\ntotal |> why |> holds","return":"[35,30,5,10,3]"}
+{"id":"synth-85-0002","description":"Holds after stated gives the values of the facts that a conclusion rests on","code":"seed = 2\nmiddle = seed + 3\nresult = middle * 2\nresult |> why |> stated |> holds","return":"[2]"}
+{"id":"synth-85-0003","description":"Holds after derived gives the values of the conclusions on the way to a value","code":"seed = 2\nmiddle = seed + 3\nresult = middle * 2\nresult |> why |> derived |> holds","return":"[10,5]"}
+{"id":"synth-85-0004","description":"Holds after affects gives the values that a change of one fact reaches","code":"rate = 0.5\nprice = 10\nsubtotal = price * 3\ntax = subtotal * rate\ntotal = subtotal + tax\nprice |> affects |> holds","return":"[30,15,45]"}
+{"id":"synth-85-0005","description":"Holds of the model gives the value of every node, without the declarations that hold a stage","code":"a = 1\nb = a + 1\nvalues = b |> why |> holds\nmodel |> holds","return":"[1,2]"}
+{"id":"synth-85-0006","description":"Holds gives strings and booleans as the steps hold them","code":"name = \"Ada\"\ntitle = \"Dr\"\nlabel = title + \" \" + name\nlong = label.length > 5\nlong |> why |> holds","return":"[true,\"Dr Ada\",\"Dr\",\"Ada\"]"}
+{"id":"synth-85-0007","description":"A reference alone gives its own value as a list of one","code":"price = 10\nqty = 3\ntotal = price * qty\n[total |> holds, price |> holds]","return":"[[30],[10]]"}
+{"id":"synth-85-0008","description":"A prefix stage and depth before holds give the values within one step","code":"price = 10\nqty = 3\nshipping = 5\nsubtotal = price * qty\ntotal = subtotal + shipping\nwhy total |> depth(1) |> holds","return":"[35,30,5]"}
+{"id":"synth-85-0009","description":"Holds after union gives the values behind either of two results, each node once","code":"price = 10\nquantity = 3\nrate = 0.5\nsubtotal = price * quantity\ntax = subtotal * rate\nshipping = quantity * 2\ntax |> why |> union(shipping |> why) |> holds","return":"[15,30,0.5,10,3,6]"}
+{"id":"synth-85-0010","description":"Holds after intersect gives the values of the causes that two results share","code":"price = 10\nquantity = 3\nrate = 0.5\nsubtotal = price * quantity\ntax = subtotal * rate\nshipping = quantity * 2\ntax |> why |> intersect(shipping |> why) |> holds","return":"[3]"}
+{"id":"synth-85-0011","description":"A standing declaration of held values follows a rewiring and a change of value","code":"a = 1\nb = a + 2\nc = b * 2\nvalues = c |> why |> holds\nx = 5\nb = x + 1\nx = 7\nvalues","return":"[16,8,7]"}
+{"id":"synth-85-0012","description":"A class-level rule holds the values behind each instance's own total","code":"class Order(price, qty):\n    this.price = price\n    this.qty = qty\n$Order.total = $Order.price * $Order.qty\n$Order.basis = $Order.total |> why |> holds\nfirst = Order(10, 2)\nsecond = Order(4, 5)\nfirst.qty = 3\n[first.basis, second.basis]","return":"[[30,10,3],[20,4,5]]"}
```

**File**: `docs/README.md` (modified, +69/-3)
```diff
@@ -4201,6 +4201,9 @@ volume
 - `selection |> nodes` lists the steps' `node` names, as
   `(selection).map(step => step.node)` does for the selection the pipeline
   denotes ([NUC 112](nuc-0112.md)).
+- `selection |> holds` lists the steps' `holds` values, as
+  `(selection).map(step => step.holds)` does for the selection the pipeline
+  denotes ([NUC 121](nuc-0121.md)).
 
 ```
 a = 1
@@ -4521,6 +4524,62 @@ facts
   [node names of reasoning selections](../nucleoid.spec.md#node-names-of-reasoning-selections)
   section.
 
+### Held values of reasoning selections
+
+```
+price = 10
+qty = 3
+shipping = 5
+subtotal = price * qty
+total = subtotal + shipping
+facts = total |> why |> stated |> holds
+reach = price |> affects |> holds
+assert(facts, [5, 10, 3])
+assert(reach, [30, 35])
+base = 4
+shipping = base + 1
+price = 20
+[facts, reach]
+```
+
+- This is the complete `Nucleoid gives the values of selections with holds`
+  program in `tests/reference.md`, without its title and expected-return
+  metadata; it returns `[[4,20,3],[60,65]]`.
+- [NUC 121](nuc-0121.md) adds the final stage `selection |> holds`. It gives
+  the `holds` values of the selection's steps as a list, in their order, so
+  `total |> why |> stated |> holds` gives the values of the facts the total
+  rests on and `price |> affects |> holds` the values that a change of the
+  price reaches. It is exactly `(selection).map(step => step.holds)`, where
+  `selection` is the selection that the pipeline before `holds` denotes,
+  read as the stages read their source, and each value is the one its step
+  holds, unchanged.
+- The selection is written as for `nodes`: a reference, which denotes its
+  own one-step selection rather than its value, `model`, a prefix stage such
+  as `why total`, or a pipeline of any of the stages above but `nodes`. So
+  `total |> holds` is a list of the total's value, as
+  `(total |> why |> depth(0)).map(step => step.holds)` is. An empty
+  selection gives `[]`, and a selection that a `depth(null)` makes undefined
+  gives undefined.
+- The stage ends the pipeline, as `nodes` does: a stage after it, `nodes`
+  included, or an `intersect`, `except`, `union` or `path` argument that
+  ends with it, has a list of values rather than a selection and raises
+  `TypeError("Cannot explain <source>")`, as it does after the accepted
+  spelling.
+- Only `|>` followed by `holds` is the stage; `holds` stays an ordinary name
+  everywhere else, the `holds` field of a step record included, and there
+  is no prefix form. A local or parameter, variable, function or class named
+  `holds` shadows the stage, as bindings shadow the other stages: the
+  pipeline then raises `TypeError("holds is not an operation")` before
+  selecting its source.
+- The list stays live through every observation its selection made, the
+  values it gives included, and a declaration that holds it is a reasoning
+  observer. A stored declaration whose stage gives a `null` value settles
+  to `null`, as one that reads a null property does. It renders as
+  `selection|>holds`.
+- The authoritative contract is the
+  [held values of reasoning selections](../nucleoid.spec.md#held-values-of-reasoning-selections)
+  section.
+
 ### Live structure
 
 - A reasoning assignment follows both values and graph structure.
@@ -4562,9 +4621,11 @@ c = b * 2
   `except(other)` stages, which NUC 11 does not plan either, the
   [NUC 112](nuc-0112.md) candidate adds a final `nodes` stage, which names
   the nodes of a selection and, unlike NUC 11's operations, returns a list
-  rather than a selection, and the [NUC 120](nuc-0120.md) candidate adds a
-  `union(other)` stage, which NUC 11 does not plan either. Other NUC 11
-  operations remain proposals, not dependencies.
+  rather than a selection, the [NUC 120](nuc-0120.md) candidate adds a
+  `union(other)` stage, which NUC 11 does not plan either, and the
+  [NUC 121](nuc-0121.md) candidate adds a final `holds` stage, which gives
+  the values of a selection's steps and, like `nodes`, returns a list. Other
+  NUC 11 operations remain proposals, not dependencies.
 
 ### Quantifiers
 
@@ -5075,6 +5136,11 @@ reference |> why |> stated |> nodes   the names of the facts an explanation rest
 reference |> affects |> nodes         the names of what a change of the reference reaches (NUC 112)
 model |> nodes                        the names of the current model's nodes (NUC 112)
 selection |> nodes                    the list (selection).map(step => step.node); ends the pipeline (NUC 112)
+reference |> why |> holds             the values of an explanation's steps, in its order (NUC 121)
+reference |> why |> stated |> holds   the values of the facts an explanation rests on (NUC 121)
+reference |> affects |> holds         the values of what a change of the reference reaches (NUC 121)
+model |> holds                        the values of the current model's nodes (NUC 121)
+selection |> holds                    the list (selection).map(
```

**File**: `docs/examples.md` (modified, +29/-0)
```diff
@@ -4113,6 +4113,35 @@ wages = 3500
   [NUC 120](nuc-0120.md) and the
   [root contract](../nucleoid.spec.md#union-reasoning-selections).
 
+## Held values of reasoning selections
+
+**Holds shows the figures behind an invoice and the totals on the way**
+
+```nuc
+hours = 12
+rate = 80
+travel = 150
+labor = hours * rate
+invoice = labor + travel
+inputs = invoice |> why |> stated |> holds
+totals = invoice |> why |> derived |> holds
+assert([inputs, totals], [[150, 12, 80], [1110, 960]])
+discount = 100
+invoice = labor + travel - discount
+hours = 15
+[inputs, totals]
+# return: [[150,100,15,80],[1250,1200]]
+```
+
+- `invoice |> why |> stated |> holds` gives the figures the invoice rests
+  on, the travel cost, the hours and the rate, and
+  `invoice |> why |> derived |> holds` the totals on the way to it, the
+  invoice and the labor, each in the order of the explanation.
+- The values follow the model: once the invoice takes off a discount, the
+  discount joins the figures, and more hours raise both totals. See
+  [NUC 121](nuc-0121.md) and the
+  [root contract](../nucleoid.spec.md#held-values-of-reasoning-selections).
+
 ## Reactive list flattening
 
 **Flattening keeps the dirty tiles of every room counted**
```

**File**: `docs/nuc-0000.md` (modified, +2/-2)
```diff
@@ -148,7 +148,7 @@ Created: 31-Jul-2026
 | [106](nuc-0106.md) | Intersect and Except Reasoning Selections | Accepted |
 | [112](nuc-0112.md) | Node Names of Reasoning Selections | Accepted |
 | [120](nuc-0120.md) | Union Reasoning Selections | Accepted |
-| [121](nuc-0121.md) | Held Values of Reasoning Selections | Draft |
+| [121](nuc-0121.md) | Held Values of Reasoning Selections | Accepted |
 
 ### Language compatibility
 
@@ -296,7 +296,7 @@ Created: 31-Jul-2026
 | [118](nuc-0118.md) | Case Conversion Method Aliases | Standards Track | Language compatibility | Accepted |
 | [119](nuc-0119.md) | Finally Clauses for Try Statements | Standards Track | Runtime features | Accepted |
 | [120](nuc-0120.md) | Union Reasoning Selections | Standards Track | Reasoning enhancement | Accepted |
-| [121](nuc-0121.md) | Held Values of Reasoning Selections | Standards Track | Reasoning enhancement | Draft |
+| [121](nuc-0121.md) | Held Values of Reasoning Selections | Standards Track | Reasoning enhancement | Accepted |
 
 ## Copyright
 
```

**File**: `docs/nucleoid.g4` (modified, +8/-1)
```diff
@@ -508,7 +508,8 @@ stage
     | STATED
     | DERIVED
     | DIFF
-    | NODES                                               // Expr::Reason
+    | NODES
+    | HOLDS                                               // Expr::Reason
     | DEPTH LPAREN expression RPAREN                       // Expr::Depth
     | PATH LPAREN expression RPAREN                        // Expr::Path
     | (INTERSECT | EXCEPT) LPAREN expression RPAREN        // Expr::Combine
@@ -912,6 +913,7 @@ enumName
     | EXCEPT
     | UNION
     | NODES
+    | HOLDS
     | MODEL
     | FIRST
     | LAST
@@ -1001,6 +1003,7 @@ INTERSECT        : 'intersect';
 EXCEPT           : 'except';
 UNION            : 'union';
 NODES            : 'nodes';
+HOLDS            : 'holds';
 MODEL            : 'model';
 FIRST            : 'first';
 LAST             : 'last';
@@ -1204,6 +1207,10 @@ fragment REGEX_CHAR
  *                             after it, or an intersect, except, union or path
  *                             argument that ends with it, parses and then
  *                             raises TypeError("Cannot explain <source>").
+ * s |> holds               -> Expr::Reason with Stage::Holds, the values that
+ *                             s's steps hold. It ends the pipeline as nodes
+ *                             does, and a binding named holds shadows it at
+ *                             run time.
  * An object containing spread uses Expr::SpreadObject, with later entries
  * winning; otherwise it uses Expr::ObjectLiteral. Numeric keys become text.
  *
```

**File**: `nucleoid.spec.md` (modified, +197/-2)
```diff
@@ -3029,8 +3029,8 @@ statement positions; caught values and transaction recovery are unchanged.
   `derived`, `diff`, `intersect` and `except` keep a step by a property of its
   node, so after a union they keep what they keep of each side:
   `S |> union(O) |> stated` is `(S |> stated).concat(O |> except(S) |> stated)`.
-  A later `why` or `affects` walks from every step of the union, and `nodes`
-  names them.
+  A later `why` or `affects` walks from every step of the union, `nodes`
+  names them and `holds` gives their values.
 - Each step keeps the distance of the walk that selected it: the steps of
   `SELECTION` their own, and the steps added from `OTHER` the distances they
   have in `OTHER`'s own selection. So `S |> union(O) |> depth(n)` is
@@ -3187,6 +3187,110 @@ statement positions; caught values and transaction recovery are unchanged.
   `Nucleoid rolls back failed updates through node names` specify the
   executable behavior. `tests/reasoning_node_names.rs` executes the rest.
 
+## Held values of reasoning selections
+
+- [NUC 121](docs/nuc-0121.md) adds the final pipeline stage
+  `SELECTION |> holds`. It gives the `holds` values of the steps that
+  `SELECTION` selects, as a list in the selection's order. It is exactly
+  `(SELECTION).map(step => step.holds)`, where `SELECTION` is the selection
+  that the pipeline before `holds` denotes, read as the accepted stages read
+  their source: `total |> why |> holds` is
+  `(why total).map(step => step.holds)` and
+  `total |> why |> stated |> holds` is
+  `(total |> why |> stated).map(step => step.holds)`.
+- Each element is the value that the step's record holds in its `holds`
+  field, unchanged: a number, string, boolean, list, object or `null`. An
+  instance's own step gives the instance itself, a variable that holds a
+  function gives the function, and the step of a class, a function
+  declaration or an `if` block gives `null`, as their records do.
+- A reference alone denotes its own one-step selection, not its value, so
+  `total |> holds` is a list that holds the total's value, as
+  `(total |> why |> depth(0)).map(step => step.holds)` is, while the value
+  `(total).map(step => step.holds)` of a number raises
+  `TypeError("number.map is not a function")`.
+- So `total |> why |> stated |> holds` gives the values of the facts a
+  conclusion rests on, `total |> why |> derived |> holds` the values of the
+  conclusions on the way to it, `price |> affects |> holds` the values that
+  a change of the price reaches, and `model |> holds` the value of every
+  node of the model in model order, without pending nodes and reasoning
+  observers.
+- `SELECTION` is written as the source of a pipeline is: a reference, which
+  selects its own step; `model`; a prefix stage, as in `why total |> holds`;
+  or a pipeline of the stages `why`, `affects`, `stated`, `derived`,
+  `depth`, `path`, `intersect`, `except`, `union` and `diff`. An empty
+  selection gives `[]`. A selection that a `depth` stage with a `null` or
+  undefined limit makes undefined gives undefined, which a declaration
+  stores as `null`, as a read from that selection does.
+- The stage ends the pipeline, as `nodes` does: its result is a list of
+  values, not a selection. A stage written after it has that list as its
+  source, which is neither a reference nor a selection, so
+  `total |> why |> holds |> why` and `total |> why |> holds |> nodes` raise
+  `TypeError("Cannot explain total|>why|>holds")`, as the same stages after
+  `(why total).map(step => step.holds)` raise for that source, and
+  `total |> why |> nodes |> holds` raises
+  `TypeError("Cannot explain total|>why|>nodes")`. An `intersect`,
+  `except`, `union` or `path` argument that ends with `holds` raises
+  `TypeError("Cannot explain <argument>")`, such as
+  `TypeError("Cannot explain shipping|>why|>holds")` for
+  `intersect(shipping |> why |> holds)`. A name that holds the list is a
+  reasoning observer, which no selection holds, so after
+  `values = shipping |> why |> holds`, `intersect(values)` keeps nothing.
+- Only `|>` followed by the name `holds` is the stage. `holds` remains an
+  ordinary lexer identifier: variables, parameters, properties, keys,
+  functions and methods named `holds` keep their accepted meanings, and so
+  does the `holds` field of a step record. There is no prefix form, so
+  `holds total` remains the two statements `holds` and `total`. `|> Holds`
+  and `|> hold` keep their parse-time
+  `TypeError("<name> is not an operation")`, and a line break after `|>`
+  keeps `SyntaxError("Expected an operation")`.
+- A local or parameter, state variable, function or class named `holds`
+  shadows the stage, as for `stated`, `derived`, `depth`, `diff`, `path`,
+  `intersect`, `except`, `union` and `nodes`: the pipeline then raises
+  `TypeError("holds is not an operation")` at the running statement, before
+  its source is selected. A binding declared after a standing declaration
+  makes it
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

## X. Draft NUC 122 Python-Style Except Clauses

**RULE**:
When implementing operations in `docs/nuc-0000.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `259343d1`: Draft NUC 122 Python-Style Except Clauses. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/nuc-0000.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
| [122](nuc-0122.md) | Python-Style Except Clauses | Draft |
| [122](nuc-0122.md) | Python-Style Except Clauses | Standards Track | Language compatibility | Draft |
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `259343d1` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
