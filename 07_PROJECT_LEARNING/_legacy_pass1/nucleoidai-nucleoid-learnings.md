# Forensic Learning Record (Deep Inspection): NucleoidAI/Nucleoid

> **Canonical Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:16:16.701Z  
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

### Core Architecture Module: `ref/src/state.js`
```
/* eslint-disable no-unused-vars */
/* eslint-disable no-eval */
const $ = {
  classes: [],
};
const state = $;
const _transaction = require("./transaction");
const { $: $graph } = require("./graph");
const { event } = require("./event");
const _ = require("lodash");
const { v4: uuid } = require("uuid");
const REFERENCE = require("./nuc/REFERENCE");
const serialize = require("./lib/serialize");

global.require = require;

function assign(scope, variable, evaluation, json = true) {
  let value;

  if (json) {
    value = serialize(eval(`(${evaluation})`), "state");
  } else {
    value = evaluation.toString();
  }

  return _transaction.register(`state.${variable}`, value);
}

function call(scope, fn, args = []) {
  const exec = `state.${fn}(${args.join(",")})`;
  return eval(exec);
}

function expression(scope, evaluation) {
  return eval(`(${evaluation.value})`);
}

function del(scope, variable) {
  return eval(`delete state.${variable}`);
}

module.exports.throw = (scope, exception) => eval(`throw ${exception}`);

function clear() {
  for (let property in $) {
    delete $[property];
  }

  $["classes"] = [];
}

module.exports.$ = $;
module.exports.assign = assign;
module.exports.call = call;
module.exports.expression = expression;
module.exports.clear = clear;
module.exports.delete = del;

```

### Core Architecture Module: `ref/src/statement.js`
```
const ESTree = require("./lang/estree/parser");

function compile(string) {
  return ESTree.parse(string);
}

module.exports.compile = compile;

```

### Core Architecture Module: `src/state.rs`
```
use indexmap::IndexMap;
use std::fmt;
use std::sync::Arc;

use crate::lang::ast::{Expr, Function, Parameter, Stmt};
use crate::lang::estree::generator::generate_all;
use crate::runtime::Runtime;
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
    pub fn property(class: &str, property: &str) -> Self {
        DeclarationKey(format!("${class}.{property}"))
    }

    /// `if(this.age>18)`.
    pub fn conditional(condition: &Expr) -> Self {
        DeclarationKey(format!("if({condition})"))
    }

    /// A block of statements, keyed by their source.
    pub fn block(statements: &[Stmt]) -> Self {
        DeclarationKey(format!("block({})", generate_all(statements)))
    }

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

    pub fn declarations_in_order(&self) -> Vec<Declaration> {
        let mut declarations: Vec<Declaration> = self.declarations.values().cloned().collect();
        declarations.sort_by_key(|declaration| declaration.sequence);
        declarations
    }
}

/// Everything the runtime holds: top-level variables, objects and classes.
///
/// `ref/src/state.js` exports its `$` for anything to reach into; the maps are
/// private here so that the only way to change them is the recorded writes
/// below, and the only way to change them *without* recording is
/// [`Transaction::rollback`](crate::transaction::Transaction::rollback) putting
/// a before-image back.
#[derive(Debug, Clone, Default)]
pub struct State {
    variables: IndexMap<String, Value>,
    objects: IndexMap<ObjectId, ObjectData>,
    classes: IndexMap<String, ClassData>,
    functions: IndexMap<String, Arc<Function>>,
}

impl State {
    pub fn new() -> Self {
        State::default()
    }

    pub fn variable(&self, name: &str) -> Option<&Value> {
        self.variables.get(name)
    }

    pub fn has_variable(&self, name: &str) -> bool {
        self.variables.contains_key(name)
    }

    pub fn has_object(&self, id: &ObjectId) -> bool {
        self.objects.contains_key(id)
    }

    pub fn function(&self, name: &str) -> Option<&Arc<Function>> {
        self.functions.get(name)
    }

    pub fn has_function(&self, name: &str) -> bool {
        self.functions.contains_key(name)
    }

    pub fn has_class(&self, name: &str) -> bool {
        self.classes.contains_key(name)
    }

    /// How many classes are defined. `Class.length` reads this.
    pub fn class_count(&self) -> usize {
        self.classes.len()
    }

    pub fn object(&self, id: &ObjectId) -> Option<&ObjectData> {
        self.objects.get(id)
    }

    pub fn object_mut(&mut self, id: &ObjectId) -> Option<&mut ObjectData> {
        self.objects.get_mut(id)
    }

    pub fn property(&self, id: &ObjectId, property: &str) -> Option<&Value> {
        self.objects
            .get(id)
            .and_then(|object| object.properties.get(property))
    }

    pub fn class(&self, name: &str) -> Option<&ClassData> {
        self.classes.get(name)
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

    pub(crate) fn restore_object(&mut self, id: ObjectId, before: Option<ObjectData>) {
        match before {
            Some(data) => self.objects.insert(id, data),
            None => self.objects.shift_remove(&id),
        };
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
    }
}

/// Every write to the state.
///
/// `state.assign` in `ref/src/state.js` records the before-image and performs
/// the write in one step, through `transaction.register`. The same holds here,
/// and it is the reason these are methods rather than field access: a write
/// that forgot to record first would be invisible until some later `throw`
/// rolled back to a state that had quietly lost it. Recording and writing are
/// never two statements a caller has to remember to pair.
///
/// `ref` needs only one `assign` because JavaScript works out from the path
/// whether it names a variable or a property; they are separate here because
/// the graph keys them differently.
///
/// `state.expression`, `state.call` and `state.throw` have no counterpart â€”
/// they are `eval` wrappers, and nothing here evaluates by handing text to
/// another language.
impl Runtime {
    pub(crate) fn assign(&mut self, name: &str, value: Value) {
        let before = self.state.variables.get(name).cloned();
        self.transaction.record_variable(name, before);
        self.state.variables.insert(name.to_string(), value);
    }

    pub(crate) fn assign_property(&mut self, object: &ObjectId, property: &str, value: Value) {
        if !self.state.objects.contains_key(object) {
            self.insert_object(object.clone(), ObjectData::new(None));
        }

        let before = self.state.property(object, property).cloned();
        self.transaction.record_property(object, property, before);

        if let Some(data) = self.state.object_mut(object) {
            data.properties.insert(property.to_string(), value);
        }
    }

    /// `state.delete` for a top-level name, reporting what was there.
    pub(crate) fn remove_variable(&mut self, name: &str) -> Option<Value> {
        let before = self.state.variables.get(name).cloned();
        self.transaction.record_variable(name, before.clone());
        self.state.variables.shift_remove(name);
        before
    }

    /// `state.delete` for a property.
    pub(crate) fn remove_property(&mut self, object: &ObjectId, property: &str) -> Option<Value> {
        let before = self.state.property(object, property).cloned();
        self.transaction
            .record_property(object, property, before.clone());

        if let Some(data) = self.state.object_mut(object) {
            data.properties.shift_remove(property);
        }

        before
    }

    pub(crate) fn insert_object(&mut self, id: ObjectId, data: ObjectData) {
        if self.transaction.needs_object(&id) {
            let before = self.state.objects.get(&id).cloned();
            self.transaction.record_object(&id, before);
        }

        self.state.objects.insert(id, data);
    }

    pub(crate) fn remove_object(&mut self, id: &ObjectId) -> Option<ObjectData> {
        let before = self.state.objects.get(id).cloned();
        self.transaction.record_object(id, before.clone());
        self.state.objects.shift_remove(id);
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
            let before = self.state.classes.get(name).cloned
```

### Core Architecture Module: `src/statement.rs`
```
//! Source text to statements. Mirrors `ref/src/statement.js`, which is likewise
//! the one place the rest of the runtime reaches the parser through.

use crate::error::Result;
use crate::lang::estree::parser::{self, Program};

/// Compiles a program, reporting the first syntax error.
pub fn compile(source: &str) -> Result<Program> {
    parser::parse_program(source)
}

```

### Core Architecture Module: `examples/_snippet.rs`
```
use nucleoid::Runtime;

fn main() {
    let mut runtime = Runtime::new();

    let source = "a = 1\nb = a + 2\na = 3\nassert(b, 5)\n";

    runtime.run(source).unwrap();

    println!("b = {}", runtime.run("b").unwrap());
    println!("assertions run: {}", runtime.assertions_run());

    let failures = runtime.take_assertions();

    for failure in &failures {
        println!(
            "assertion failed: expected {}, got {}",
            failure.expected, failure.actual
        );
    }

    println!("{}", if failures.is_empty() { "ok" } else { "FAILED" });
}

```

### Core Architecture Module: `examples/dependencies.rs`
```
//! Shows what makes Nucleoid declarative: statements are kept, not just run.
//!
//! Run with `cargo run --example dependencies`.

use nucleoid::Runtime;

fn main() {
    let mut runtime = Runtime::new();

    // An assignment states a relationship that the runtime maintains.
    runtime.run("celsius = 100").unwrap();
    runtime.run("fahrenheit = celsius * 9 / 5 + 32").unwrap();

    println!("celsius 100 -> {}", read(&mut runtime, "fahrenheit"));

    // Changing what it reads brings the relationship up to date.
    runtime.run("celsius = 37").unwrap();
    println!("celsius  37 -> {}", read(&mut runtime, "fahrenheit"));

    // The same holds for types and their instances.
    runtime
        .run(
            "class Sensor(name: str):\n    this.name = name\n\
             \n\
             $Sensor.label = \"sensor:\" + $Sensor.name\n",
        )
        .unwrap();

    runtime.run("kitchen = Sensor(\"kitchen\")").unwrap();
    println!("label      -> {}", read(&mut runtime, "kitchen.label"));

    // A rule declared on the type applies to instances made later, too.
    runtime.run("hallway = Sensor(\"hallway\")").unwrap();
    println!("label      -> {}", read(&mut runtime, "hallway.label"));
}

fn read(runtime: &mut Runtime, source: &str) -> String {
    runtime
        .run(source)
        .map(|value| value.to_string())
        .unwrap_or_else(|error| error.to_string())
}

```

### Core Architecture Module: `examples/scaling.rs`
```
//! Measures how the runtime scales, so the cost of the dependency graph is a
//! known quantity rather than an assumption.
//!
//! Run with `cargo run --release --example scaling`.
//!
//! Each workload is run at doubling sizes. The ratio column is the time against
//! the previous size: about 2 is linear, about 4 is quadratic.

use std::time::{Duration, Instant};

use nucleoid::Runtime;

fn main() {
    report("chain of dependent variables", &[100, 200, 400, 800], chain);
    report("fan-out from one variable", &[100, 200, 400, 800], fan_out);
    report(
        "instances of a plain type",
        &[100, 200, 400, 800],
        instances,
    );
    report("instances under a class rule", &[100, 200, 400, 800], ruled);
    report(
        "reassignment through a chain",
        &[50, 100, 200, 400],
        resettle,
    );
    report("try blocks", &[25, 50, 100, 200], guarded);
}

fn report(name: &str, sizes: &[usize], workload: fn(usize) -> Duration) {
    println!("\n{name}");
    println!("{:>8}  {:>12}  {:>8}", "n", "time", "ratio");

    let mut previous: Option<Duration> = None;

    for &size in sizes {
        let elapsed = workload(size);

        let ratio = match previous {
            Some(previous) if previous.as_secs_f64() > 0.0 => {
                format!("{:.1}x", elapsed.as_secs_f64() / previous.as_secs_f64())
            }
            _ => "-".to_string(),
        };

        println!("{size:>8}  {:>12}  {ratio:>8}", format!("{elapsed:.2?}"));
        previous = Some(elapsed);
    }
}

/// `v0 = 1`, then `v1 = v0 + 1`, `v2 = v1 + 1`, ... Each assignment adds one
/// link, and every change has to walk the whole chain.
fn chain(size: usize) -> Duration {
    let mut source = String::from("v0 = 1\n");

    for index in 1..size {
        source.push_str(&format!("v{index} = v{} + 1\n", index - 1));
    }

    time(&source)
}

/// One variable that many others read.
fn fan_out(size: usize) -> Duration {
    let mut source = String::from("base = 1\n");

    for index in 0..size {
        source.push_str(&format!("out{index} = base + {index}\n"));
    }

    time(&source)
}

fn instances(size: usize) -> Duration {
    let mut source = String::from("class Item:\n    pass\n\n");

    for index in 0..size {
        source.push_str(&format!("item{index} = Item()\n"));
    }

    time(&source)
}

/// The same, with a rule that every instance has to be given.
fn ruled(size: usize) -> Duration {
    let mut source = String::from("class Item(code: str):\n    this.code = code\n\n");
    source.push_str("$Item.label = \"item:\" + $Item.code\n\n");

    for index in 0..size {
        source.push_str(&format!("item{index} = Item(\"{index}\")\n"));
    }

    time(&source)
}

/// Builds a chain, then changes its head, which re-evaluates everything.
fn resettle(size: usize) -> Duration {
    let mut runtime = Runtime::new();
    let mut source = String::from("v0 = 1\n");

    for index in 1..size {
        source.push_str(&format!("v{index} = v{} + 1\n", index - 1));
    }

    runtime.run(&source).expect("chain should build");

    let start = Instant::now();
    runtime.run("v0 = 2").expect("head should reassign");
    start.elapsed()
}

/// Every `try` has to be able to undo whatever its body did.
fn guarded(size: usize) -> Duration {
    let mut source = String::from("guard = 0\n");

    for index in 0..size {
        source.push_str(&format!(
            "try:\n    step{index} = guard + {index}\ncatch error:\n    pass\n"
        ));
    }

    time(&source)
}

fn time(source: &str) -> Duration {
    let mut runtime = Runtime::new();
    let start = Instant::now();

    runtime
        .run(source)
        .unwrap_or_else(|error| panic!("workload failed: {error}"));

    start.elapsed()
}

```

### Core Architecture Module: `ref/arc/server.js`
```
require("dotenv").config();

const app = require("./src/app");

app();

```

### Core Architecture Module: `ref/arc/src/app.js`
```
console.info = (message) => {
  let string = message;

  if (typeof message !== "string") {
    string = JSON.stringify(message);
  }

  if (message === undefined) {
    string = "undefined";
  }

  if (message === null) {
    string = "null";
  }

  process.stdout.write(`\x1b[34m${string}\x1b[0m\n`);
};

console.debug = (message) => {
  let string = message;

  if (typeof message !== "string") {
    string = JSON.stringify(message);
  }
  if (message === undefined) {
    string = "undefined";
  }

  if (message === null) {
    string = "null";
  }

  process.stdout.write(`\x1b[2m${string}\x1b[0m\n`);
};

console.log("🌿 \x1b[32mNucleoid\x1b[0m system is started");
console.log("\x1b[34m🌎 Inspired by Nature\x1b[0m\n");

require.extensions[".md"] = (module, filename) => {
  const fs = require("fs");
  module.exports = fs.readFileSync(filename, "utf8").trim();
};

// ---

const analyzer = require("./lib/analyzer");
const visualizer = require("./lib/visualizer");
const nucleoid = require("./lib/nucleoid");
const Matrix = require("./lib/Matrix");
const { v4: uuid } = require("uuid");
const debug = require("./debug"); // eslint-disable-line no-unused-vars

const {
  train,
  test: [{ input: test_input_matrix, output: test_output_matrix }],
} = require("./data/training/3aa6fb7a.json"); // 0ca9ddb6.json

const train_dataset = {
  dataset: train.map(({ input, output }) => ({
    input_matrix: input,
    output_matrix: output,
    instances: [],
  })),
};

// const train_dataset = require("./debug")._3aa6fb7a.analyzer;

async function start() {
  const train_session_id = uuid();

  const { declarations } = await analyzer.declarations({
    train_dataset,
  });
  train_dataset.declarations = declarations;

  console.log("Creating declarations in Nucleoid...");
  await nucleoid.run(train_session_id, declarations.join("\n"));

  for (const dataset of train_dataset.dataset.reverse()) {
    const { input_matrix, output_matrix } = dataset;

    const { instances } = await analyzer.instances({
      declarations,
      input_matrix,
      output_matrix,
    });

    for (const {
      input_instance,
      output_instance,
      input_object,
      output_object,
    } of instances) {
      const instance_name = `obj${dataset.instances.length}`;

      const { input_code, output_value } = await analyzer.value({
        train_session_id,
        instance_name,
        declarations,
        input_object,
        output_object,
      });

      dataset.instances.push({
        instance_name,
        input_instance,
        output_instance,
        input_object,
        output_object,
        input_code,
        output_value,
      });
    }
  }

  /* Visualizing */

  // console.log("Waiting for 60 seconds due to rate limits...");
  // await new Promise((resolve) => setTimeout(resolve, 60 * 1000));

  const { instances } = await visualizer.instances({
    train_dataset,
    test_input_matrix,
  });

  // const instances = require("./debug")._3aa6fb7a.visualizer;

  const test_session_id = uuid();
  let test_index = 0;

  console.log("Initializing Nucleoid session with declarations...");
  await nucleoid.run(test_session_id, train_dataset.declarations.join("\n"));

  let result_matrix = Array.from({ length: test_output_matrix.length }, () =>
    Array(test_output_matrix[0].length).fill(0)
  );

  for (const { input_object } of instances.reverse()) {
    const { output_value } = await visualizer.value({
      instance_name: `obj${test_index++}`,
      test_session_id,
      train_dataset,
      input_object,
    });

    const { output_instance } = await visualizer.output_instance({
      test_input_matrix,
      result_matrix,
      train_dataset,
      input_object,
      output_value,
    });

    result_matrix = Matrix.merge(result_matrix, output_instance);
  }

  console.debug("Result:");
  Matrix.toString(result_matrix);
  console.debug("Expected:");
  Matrix.toString(test_output_matrix);
  return result_matrix;
}

module.exports = start;

```

### Core Architecture Module: `ref/arc/src/instruct_dataset/index.js`
```
module.exports = require("./instruct_dataset");

```

### Core Architecture Module: `ref/arc/src/instruct_dataset/instruct_dataset.js`
```
const nucleoid = require("./nucleoid.md");
const Zoom = require("../lib/Zoom");
// const arc = require("./arc.md");

const dataset = [
  require("./dataset.core.json"),
  require("./dataset.line.json"),
  require("./dataset.curve.json"),
].map(({ declarations, dataset }) => ({
  declarations,
  dataset: dataset.map(({ input_matrix, output_matrix, instances }) => ({
    input_matrix,
    output_matrix,
    instances: instances.map(
      ({
        instance_name,
        input_code,
        input_instance,
        output_instance,
        output_value,
      }) => ({
        instance_name,
        input_code,
        input_instance,
        input_object: Zoom.focus(input_instance),
        output_object: Zoom.focus(output_instance),
        output_value,
      })
    ),
  })),
}));

// const fs = require("fs");
// fs.writeFileSync(
//   "dataset.jsonl",
//   JSON.stringify({
//     messages: dataset.map((d) => JSON.stringify(d)),
//   })
// );

module.exports.document = () => {
  return `
    ${nucleoid}
    instruct_dataset:
    ${JSON.stringify(dataset)}      
  `;
};

```

### Core Architecture Module: `ref/arc/src/lib/Markdown.js`
```
function json(markdown) {
  const matches = [...markdown.matchAll(/```json([^`]+)```/g)];

  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    return JSON.parse(lastMatch[1]);
  }
}

module.exports = { json };

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #70** (2025-01-09): **Variable Value in Python**
  *Symptoms*: Requested by @Invademars

- **Issue #69** (2025-01-09): **add Python version's first test case**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Moved to https://github.com/NucleoidAI/Nucleoid/pull/70

- **Issue #68** (2024-12-19): **Bump the npm_and_yarn group across 2 directories with 3 updates**
  *Symptoms*: Bumps the npm_and_yarn group with 2 updates in the / directory: [cookie](https://github.com/jshttp/cookie) and [express](https://github.com/expressjs/express). Bumps the npm_and_yarn group with 2 updates in the /arc directory: [cookie](https://github.com/jshttp/cookie) and [express](https://github.com/expressjs/express).  Updates `cookie` from 0.6.0 to 0.7.1 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/jshttp/cookie/releases">cookie's releases</a>.</em></p> <blockquote> <h2>0.7.1</h2> <p><strong>Fixed</strong></p> <ul> <li>Allow leading dot for domain (<a href="https://redirect.github.com/jshttp/cookie/issues/174">#174</a>) <ul> <li>Although not permitted in the spec, some users expect this to work and user agents ignore the leading dot according to spec</li> </ul> </li> <li>Add fast path for <code>serialize</code> without options, use <code>obj.hasOwnProperty</code> when parsing (<a href="https://redirect.github.com/jshttp/cookie/issues/172">#172</a>)</li> </ul> <p><a href="https://github.com/jshttp/cookie/compare/v0.7.0...v0.7.1">https://github.com/jshttp/cookie/compare/v0.7.0...v0.7.1</a></p> <h2>0.7.0</h2> <ul> <li>perf: parse cookies ~10% faster (<a href="https://redirect.github.com/jshttp/cookie/issues/144">#144</a> by <a href="https://github.com/kurtextrem"><code>@​kurtextrem</code></a> and <a href="https://redirect.github.com/jshttp/cookie/issues/170">#170</a>)</li> <li>fix: narrow the validation of cookies to match RFC626
  **Post-Mortem & Fix Analysis**:
  > @dependabot rebase

- **Issue #67** (2024-12-09): **Bump path-to-regexp and express in /arc**
  *Symptoms*: Bumps [path-to-regexp](https://github.com/pillarjs/path-to-regexp) and [express](https://github.com/expressjs/express). These dependencies needed to be updated together. Updates `path-to-regexp` from 0.1.10 to 0.1.12 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/pillarjs/path-to-regexp/releases">path-to-regexp's releases</a>.</em></p> <blockquote> <h2>Fix backtracking (again)</h2> <p><strong>Fixed</strong></p> <ul> <li>Improved backtracking protection for 0.1.x, will break some previously valid paths (see previous advisory: <a href="https://github.com/pillarjs/path-to-regexp/security/advisories/GHSA-9wv6-86v2-598j">https://github.com/pillarjs/path-to-regexp/security/advisories/GHSA-9wv6-86v2-598j</a>)</li> </ul> <p><a href="https://github.com/pillarjs/path-to-regexp/compare/v0.1.11...v0.1.12">https://github.com/pillarjs/path-to-regexp/compare/v0.1.11...v0.1.12</a></p> <h2>Error on bad input</h2> <p><strong>Changed</strong></p> <ul> <li>Add error on bad input values  8f09549</li> </ul> <p><a href="https://github.com/pillarjs/path-to-regexp/compare/v0.1.10...v0.1.11">https://github.com/pillarjs/path-to-regexp/compare/v0.1.10...v0.1.11</a></p> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/pillarjs/path-to-regexp/commit/640e694c6fd971f78268439df9cf44040855e669"><code>640e694</code></a> 0.1.12</li> <li><a href="https://github.com/pillarjs/path-to-regexp/commit/f01c26a013b1889f0c217c64
  **Post-Mortem & Fix Analysis**:
  > Superseded by #68.

- **Issue #66** (2024-12-09): **Bump cookie and express**
  *Symptoms*: Bumps [cookie](https://github.com/jshttp/cookie) to 0.7.1 and updates ancestor dependency [express](https://github.com/expressjs/express). These dependencies need to be updated together.  Updates `cookie` from 0.6.0 to 0.7.1 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/jshttp/cookie/releases">cookie's releases</a>.</em></p> <blockquote> <h2>0.7.1</h2> <p><strong>Fixed</strong></p> <ul> <li>Allow leading dot for domain (<a href="https://redirect.github.com/jshttp/cookie/issues/174">#174</a>) <ul> <li>Although not permitted in the spec, some users expect this to work and user agents ignore the leading dot according to spec</li> </ul> </li> <li>Add fast path for <code>serialize</code> without options, use <code>obj.hasOwnProperty</code> when parsing (<a href="https://redirect.github.com/jshttp/cookie/issues/172">#172</a>)</li> </ul> <p><a href="https://github.com/jshttp/cookie/compare/v0.7.0...v0.7.1">https://github.com/jshttp/cookie/compare/v0.7.0...v0.7.1</a></p> <h2>0.7.0</h2> <ul> <li>perf: parse cookies ~10% faster (<a href="https://redirect.github.com/jshttp/cookie/issues/144">#144</a> by <a href="https://github.com/kurtextrem"><code>@​kurtextrem</code></a> and <a href="https://redirect.github.com/jshttp/cookie/issues/170">#170</a>)</li> <li>fix: narrow the validation of cookies to match RFC6265 (<a href="https://redirect.github.com/jshttp/cookie/issues/167">#167</a> by <a href="https://github.com/bewinsnw"><code>@​bewinsnw</co
  **Post-Mortem & Fix Analysis**:
  > Superseded by #68.

- **Issue #65** (2024-09-16): **Bump path-to-regexp and express**
  *Symptoms*: Bumps [path-to-regexp](https://github.com/pillarjs/path-to-regexp) to 0.1.10 and updates ancestor dependency [express](https://github.com/expressjs/express). These dependencies need to be updated together.  Updates `path-to-regexp` from 0.1.7 to 0.1.10 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/pillarjs/path-to-regexp/releases">path-to-regexp's releases</a>.</em></p> <blockquote> <h2>Backtrack protection</h2> <p><strong>Fixed</strong></p> <ul> <li>Add backtrack protection to parameters  29b96b4 <ul> <li>This will break some edge cases but should improve performance</li> </ul> </li> </ul> <p><a href="https://github.com/pillarjs/path-to-regexp/compare/v0.1.9...v0.1.10">https://github.com/pillarjs/path-to-regexp/compare/v0.1.9...v0.1.10</a></p> <h2>Support non-lookahead regex output</h2> <p><strong>Added</strong></p> <ul> <li>Allow a non-lookahead regex (<a href="https://redirect.github.com/pillarjs/path-to-regexp/issues/312">#312</a>)  c4272e4</li> </ul> <p><a href="https://github.com/component/path-to-regexp/compare/v0.1.8...v0.1.9">https://github.com/component/path-to-regexp/compare/v0.1.8...v0.1.9</a></p> <h2>Support named matching groups in <code>RegExp</code></h2> <p><strong>Added</strong></p> <ul> <li>Add support for named matching groups (<a href="https://redirect.github.com/pillarjs/path-to-regexp/issues/301">#301</a>)  114f62d</li> </ul> <p><a href="https://github.com/pillarjs/path-to-regexp/compare/v0.1.7...v0.1.8">https

- **Issue #64** (2024-09-09): **Bump axios from 1.6.0 to 1.7.4**
  *Symptoms*: Bumps [axios](https://github.com/axios/axios) from 1.6.0 to 1.7.4. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/axios/axios/releases">axios's releases</a>.</em></p> <blockquote> <h2>Release v1.7.4</h2> <h2>Release notes:</h2> <h3>Bug Fixes</h3> <ul> <li><strong>sec:</strong> CVE-2024-39338 (<a href="https://redirect.github.com/axios/axios/issues/6539">#6539</a>) (<a href="https://redirect.github.com/axios/axios/issues/6543">#6543</a>) (<a href="https://github.com/axios/axios/commit/6b6b605eaf73852fb2dae033f1e786155959de3a">6b6b605</a>)</li> <li><strong>sec:</strong> disregard protocol-relative URL to remediate SSRF (<a href="https://redirect.github.com/axios/axios/issues/6539">#6539</a>) (<a href="https://github.com/axios/axios/commit/07a661a2a6b9092c4aa640dcc7f724ec5e65bdda">07a661a</a>)</li> </ul> <h3>Contributors to this release</h3> <ul> <li><!-- raw HTML omitted --> <a href="https://github.com/levpachmanov" title="+47/-11 ([#6543](https://github.com/axios/axios/issues/6543) )">Lev Pachmanov</a></li> <li><!-- raw HTML omitted --> <a href="https://github.com/hainenber" title="+49/-4 ([#6539](https://github.com/axios/axios/issues/6539) )">Đỗ Trọng Hải</a></li> </ul> <h2>Release v1.7.3</h2> <h2>Release notes:</h2> <h3>Bug Fixes</h3> <ul> <li><strong>adapter:</strong> fix progress event emitting; (<a href="https://redirect.github.com/axios/axios/issues/6518">#6518</a>) (<a href="https://github.com/axios/axios/commit/e3c76fc9bdd03a
  **Post-Mortem & Fix Analysis**:
  > @dependabot rebase
  > Looks like this PR is already up-to-date with main! If you'd still like to recreate it from scratch, overwriting any edits, you can request `@dependabot recreate`.
  > @dependabot recreate

- **Issue #61** (2024-09-09): **Bump braces from 3.0.2 to 3.0.3**
  *Symptoms*: Bumps [braces](https://github.com/micromatch/braces) from 3.0.2 to 3.0.3. <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/micromatch/braces/commit/74b2db2938fad48a2ea54a9c8bf27a37a62c350d"><code>74b2db2</code></a> 3.0.3</li> <li><a href="https://github.com/micromatch/braces/commit/88f1429a0f47e1dd3813de35211fc97ffda27f9e"><code>88f1429</code></a> update eslint. lint, fix unit tests.</li> <li><a href="https://github.com/micromatch/braces/commit/415d660c3002d1ab7e63dbf490c9851da80596ff"><code>415d660</code></a> Snyk js braces 6838727 (<a href="https://redirect.github.com/micromatch/braces/issues/40">#40</a>)</li> <li><a href="https://github.com/micromatch/braces/commit/190510f79db1adf21d92798b0bb6fccc1f72c9d6"><code>190510f</code></a> fix tests, skip 1 test in test/braces.expand</li> <li><a href="https://github.com/micromatch/braces/commit/716eb9f12d820b145a831ad678618731927e8856"><code>716eb9f</code></a> readme bump</li> <li><a href="https://github.com/micromatch/braces/commit/a5851e57f45c3431a94d83fc565754bc10f5bbc3"><code>a5851e5</code></a> Merge pull request <a href="https://redirect.github.com/micromatch/braces/issues/37">#37</a> from coderaiser/fix/vulnerability</li> <li><a href="https://github.com/micromatch/braces/commit/2092bd1fb108d2c59bd62e243b70ad98db961538"><code>2092bd1</code></a> feature: braces: add maxSymbols (<a href="https://github.com/micromatch/braces/issues/">https://github.com/micromatch/braces/issues/</a>...</li> <li><a href="ht
  **Post-Mortem & Fix Analysis**:
  > @dependabot rebase

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

### Incident Patch 1: `cd84eafc` (2026-10-04)
**Commit Message**: Fix generated Rust literal rendering

The code generator now emits Rust-safe literal strings for spec assertions, avoiding invalid raw-string escapes when values contain quotes or newlines. This also cleans up generated spec cases to use plain string literals where possible, making the generated tests easier to read and more robust.

**File**: `build.rs` (modified, +8/-4)
```diff
@@ -216,8 +216,8 @@ fn render_records(records: &[Record], module: Option<&str>) -> String {
                 writeln!(
                     generated,
                     "{indent}    assert_eq!(run({}), run({}));",
-                    raw_literal(actual),
-                    raw_literal(&expected)
+                    rust_literal(actual),
+                    rust_literal(&expected)
                 )
                 .unwrap();
             } else {
@@ -245,7 +245,7 @@ fn render_records(records: &[Record], module: Option<&str>) -> String {
                     .unwrap();
                 }
 
-                writeln!(generated, "{indent}    run({});", raw_literal(&statement)).unwrap();
+                writeln!(generated, "{indent}    run({});", rust_literal(&statement)).unwrap();
 
                 for assertion in assertions {
                     writeln!(
@@ -391,7 +391,11 @@ fn without_comments(statement: &str) -> String {
         .to_string()
 }
 
-fn raw_literal(value: &str) -> String {
+fn rust_literal(value: &str) -> String {
+    if !value.contains(['\n', '\r', '"', '\\']) {
+        return format!("{value:?}");
+    }
+
     for hashes in 1.. {
         let marker = format!("\"{}", "#".repeat(hashes));
 
```

---

### Incident Patch 2: `a2e36842` (2026-08-21)
**Commit Message**: Fix title and clean up benchmark section

Corrected the title from 'World Model' to 'World Models' and removed redundant lines in the benchmark section.

**File**: `README.md` (modified, +2/-4)
```diff
@@ -151,7 +151,7 @@ The symbolic component of Neuro-Symbolic AI focuses on logic, rules, and symboli
   <img src=".github/media/neuro-symbolic.png" width="225" alt="Neuro-Symbolic Diagram"/>
 </p>
 
-### World Model: The State Component
+### World Models: The State Component
 
 Neural networks learn and symbolic AI reasons, but reasoning needs something to reason over, and that is the world model: the entities, relationships and rules a system currently holds to be true. In Nucleoid the model is not a passive knowledge base that is read from and written to, it is a logic graph that the runtime keeps true on its own. A rule stated over a type holds for every instance of it, including instances created long afterwards, and a change to any value propagates to everything derived from it, so the model is never left holding a fact together with its own stale consequence.
 
@@ -216,15 +216,13 @@ In short, the main objective of the project is to manage both of data and logic
 
 This is the comparation our sample order app in Nucleoid IDE against MySQL and Postgres with using Express.js and Sequelize libraries.
 
-https://nucleoid.com/ide/sample
-
 <img src="https://cdn.nucleoid.com/media/benchmark.png" alt="Benchmark" width="550"/>
 
 > Performance benchmark happened in t2.micro of AWS EC2 instance and both databases had dedicated servers with <u>no indexes and default configurations</u>.
 
 https://github.com/NucleoidAI/benchmark
 
-This does not necessary mean Nucleoid runtime is faster than MySQL or Postgres, instead databases require constant maintenance by DBA teams with indexing, caching, purging etc. however, Nucleoid tries to solve this problem with managing logic and data internally. As seen in the chart, for applications with average complexity, Nucleoid's performance is close to linear because of on-chain data store, in-memory computing model as well as limiting the IO process.
+As seen in the chart, for applications with average complexity, Nucleoid's performance is close to linear because of on-chain data store, in-memory computing model as well as limiting the IO process.
 
 <br/>
 
```

---

### Incident Patch 3: `49ccdc57` (2026-08-04)
**Commit Message**: Fix table column width attributes in README

**File**: `README.md` (modified, +2/-2)
```diff
@@ -29,8 +29,8 @@ Nucleoid is designed with a minimally tokenized syntax for logic representation
       <th colspan="2">Nucleoid Runtime</th>
     </tr>
     <tr>
-      <th width="50%">🦀 Rust-based</th>
-      <th width="50%">⚡ LLM-based</th>
+      <th width="250">🦀 Rust-based</th>
+      <th width="250">⚡ LLM-based</th>
     </tr>
     <tr>
       <td>
```

---

### Incident Patch 4: `2a495704` (2026-08-02)
**Commit Message**: Add dataset rendering and synth discovery

Expand the synthesized use-case corpus, render it into committed JSONL files under `dataset/`, and add a dedicated test that keeps the published dataset in sync with `nucleoid.spec.md` and `synth/`. `build.rs` now discovers synth documents automatically and generates the shared document list used by both the synth test suite and dataset renderer, reducing manual wiring as new synth sets are added.

**File**: `CLAUDE.md` (modified, +4/-2)
```diff
@@ -29,9 +29,11 @@ Nucleoid is published as open source under Apache-2.0, so everything is public-f
 
 `nucleoid.spec.md` is authoritative. Where `synth/`, `docs/` or `ref/` disagrees with it, the main reference wins.
 
-`nucleoid.spec.md`, `synth/`, `docs/` and the Rust crate (`Cargo.toml`, `src/`) must stay in sync. Every change to one must be propagated to the others as part of the same change.
+`nucleoid.spec.md`, `synth/`, `docs/`, `dataset/` and the Rust crate (`Cargo.toml`, `src/`) must stay in sync. Every change to one must be propagated to the others as part of the same change.
 
-The crate executes them rather than restating them: `tests/spec.rs` runs `nucleoid.spec.md`, `tests/synth.rs` runs `synth/`, `tests/reference.rs` runs `tests/reference.md` (the executable form of `docs/reference.md`), `tests/readme.rs` runs the ```nuc blocks in `README.md`, and `tests/examples.rs` runs those in `docs/examples.md`. Adding a case to any of those documents adds a test, so `cargo test` is the check that the crate and the documents still agree.
+`dataset/` is the Hugging Face publication of `nucleoid.spec.md` and `synth/` as JSONL. It is rendered, never hand-edited: change the documents and regenerate with `UPDATE_DATASET=1 cargo test --test dataset`.
+
+The crate executes them rather than restating them: `tests/spec.rs` runs `nucleoid.spec.md`, `tests/synth.rs` runs `synth/`, `tests/reference.rs` runs `tests/reference.md` (the executable form of `docs/reference.md`), `tests/readme.rs` runs the ```nuc blocks in `README.md`, and `tests/examples.rs` runs those in `docs/examples.md`. `tests/dataset.rs` renders `dataset/` from the documents and fails when the committed JSONL differs. Adding a case to any of those documents adds a test, so `cargo test` is the check that the crate and the documents still agree.
 
 A case whose assertions sit on a branch that is never taken proves nothing, so the suites also compare `Runtime::assertions_run()` against the number of `assert` calls in the source and fail when fewer ran.
 
```

**File**: `Cargo.lock` (modified, +2/-0)
```diff
@@ -171,6 +171,7 @@ dependencies = [
  "indexmap",
  "logos",
  "regex",
+ "serde",
  "serde_json",
  "thiserror",
 ]
@@ -253,6 +254,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "4148590afebada386688f18773da617792bf2ef03ffc1e4cbd2b1d45b023e0ba"
 dependencies = [
  "serde_core",
+ "serde_derive",
 ]
 
 [[package]]
```

**File**: `Cargo.toml` (modified, +5/-0)
```diff
@@ -42,5 +42,10 @@ clap = { version = "4", default-features = false, features = [
     "error-context",
 ] }
 
+[dev-dependencies]
+# Field-ordered serialisation of the dataset records. Only the tooling that
+# renders `dataset/` needs it, so it stays out of the published dependencies.
+serde = { version = "1", features = ["derive"] }
+
 [lints.rust]
 unsafe_code = "forbid"
```

**File**: `build.rs` (modified, +85/-10)
```diff
@@ -27,37 +27,43 @@ enum Format {
 struct Suite {
     output: &'static str,
     format: Format,
-    documents: &'static [(&'static str, &'static str)],
+    source: Source,
+}
+
+/// Where a suite's documents come from.
+enum Source {
+    /// Named one by one, for the suites that have exactly one document.
+    Named(&'static [(&'static str, &'static str)]),
+    /// Every `.md` in a directory, in name order. The synth sets are added to
+    /// in batches, and a batch should not have to be wired in by hand.
+    Directory(&'static str),
 }
 
 const SUITES: &[Suite] = &[
     Suite {
         output: "spec.rs",
         format: Format::Cases,
-        documents: &[("nucleoid", "nucleoid.spec.md")],
+        source: Source::Named(&[("nucleoid", "nucleoid.spec.md")]),
     },
     Suite {
         output: "synth.rs",
         format: Format::Cases,
-        documents: &[
-            ("synth_01", "synth/nucleoid.spec.synth.01.md"),
-            ("synth_02", "synth/nucleoid.spec.synth.02.md"),
-        ],
+        source: Source::Directory("synth"),
     },
     Suite {
         output: "reference.rs",
         format: Format::Cases,
-        documents: &[("reference", "tests/reference.md")],
+        source: Source::Named(&[("reference", "tests/reference.md")]),
     },
     Suite {
         output: "readme.rs",
         format: Format::Snippets,
-        documents: &[("readme", "README.md")],
+        source: Source::Named(&[("readme", "README.md")]),
     },
     Suite {
         output: "examples.rs",
         format: Format::Snippets,
-        documents: &[("examples", "docs/examples.md")],
+        source: Source::Named(&[("examples", "docs/examples.md")]),
     },
 ];
 
@@ -73,7 +79,22 @@ fn main() {
         let mut total = 0;
         let mut modules = String::new();
 
-        for (index, (module, path)) in suite.documents.iter().enumerate() {
+        let documents = match suite.source {
+            Source::Named(documents) => documents
+                .iter()
+                .map(|(module, path)| ((*module).to_string(), (*path).to_string()))
+                .collect(),
+            Source::Directory(directory) => {
+                println!("cargo::rerun-if-changed={directory}");
+                in_directory(directory)
+            }
+        };
+
+        if let Source::Directory(_) = suite.source {
+            write_document_list(&out, &documents);
+        }
+
+        for (index, (module, path)) in documents.iter().enumerate() {
             println!("cargo::rerun-if-changed={path}");
 
             let document = fs::read_to_string(path)
@@ -98,6 +119,60 @@ fn main() {
     }
 }
 
+/// Every `.md` in a directory, as `(module, path)` in name order.
+///
+/// `synth/nucleoid.spec.synth.01.md` becomes the module `synth_01`, so a test
+/// path still says which set the case came from.
+fn in_directory(directory: &str) -> Vec<(String, String)> {
+    let mut documents: Vec<(String, String)> = fs::read_dir(directory)
+        .unwrap_or_else(|error| panic!("{directory} holds the case documents: {error}"))
+        .map(|entry| entry.expect("a directory entry is readable").path())
+        .filter(|path| path.extension().is_some_and(|extension| extension == "md"))
+        .map(|path| {
+            let stem = path
+                .file_stem()
+                .expect("a file has a name")
+                .to_string_lossy()
+                .to_string();
+
+            // `nucleoid.spec.synth.01` is numbered by its last segment.
+            let number = stem.rsplit('.').next().unwrap_or(&stem).to_string();
+
+            (
+                format!("{directory}_{number}"),
+                path.to_string_lossy().replace('\\', "/"),
+            )
+        })
+        .collect();
+
+    documents.sort();
+    documents
+}
+
+/// Writes the list of discovered documents, so the test files can hold them
+/// without naming each one. `include_str!` needs a literal path, which is why
+/// this is generated rather than globbed at test time.
+fn write_document_list(out: &str, documents: &[(String, String)]) {
+    let root = env::var("CARGO_MANIFEST_DIR").expect("cargo sets CARGO_MANIFEST_DIR");
+    let root = root.replace('\\', "/");
+
+    let mut generated = String::from("// @generated by build.rs — do not edit.\n\n");
+    generated.push_str("pub static SYNTH_DOCUMENTS: &[(&str, &str, &str)] = &[\n");
+
+    for (module, path) in documents {
+        writeln!(
+            generated,
+            "    ({module:?}, {path:?}, include_str!(\"{root}/{path}\")),"
+        )
+        .unwrap();
+    }
+
+    generated.push_str("];\n");
+
+    fs::write(Path::new(out).join("synth_documents.rs"), generated)
+        .expect("the generated document list must be writable");
+}
+
 /// The title of every case in a case document, in order.
 ///
 /// Deliberately the same rule as `cases()` in `tests/common/mod.rs`: split the
```

**File**: `dataset/README.md` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+---
+license: apache-2.0
+language:
+  - en
+tags:
+  - nucleoid
+  - logic-programming
+  - declarative
+  - neuro-symbolic
+  - code
+size_categories:
+  - n<1K
+task_categories:
+  - text-generation
+configs:
+  - config_name: default
+    data_files:
+      - split: spec
+        path: spec.jsonl
+      - split: synth
+        path: synth.*.jsonl
+---
+
+# Nucleoid
+
+Nucleoid is a declarative logic programming language for LLMs. A program is a
+set of statements that remain true: an assignment is not an instruction that
+runs once and finishes, it is a relationship the runtime records and maintains.
+
+This dataset is the language's specification and its synthesized use cases as
+JSONL, one record per case. Each record is a complete program with the
+natural-language description of every statement kept as comments, which is what
+makes it a supervised pair: prose in, logic out.
+
+## Splits
+
+| Split | Records | Rendered from |
+| --- | --- | --- |
+| `spec` | 178 | `nucleoid.spec.md` — normative |
+| `synth` | 1007 | `synth/nucleoid.spec.synth.01.md` through `.21.md` — derived, no independent authority |
+
+## Fields
+
+| Field | Type | Description |
+| --- | --- | --- |
+| `id` | string | Stable identifier, prefixed by the document: `spec-0001`, `synth-01-0001` |
+| `source` | string | Path of the document the case was rendered from |
+| `title` | string | The behaviour the case demonstrates |
+| `code` | string | The Nucleoid program |
+| `returns` | string or null | The value the program evaluates to, as the document writes it, when it declares one |
+
+```json
+{
+  "id": "spec-0001",
+  "source": "nucleoid.spec.md",
+  "title": "Nucleoid runs a statement in the state",
+  "code": "# i is 1\ni = 1\n\nassert(i == 1, true)",
+  "returns": null
+}
+```
+
+## Loading
+
+```python
+from datasets import load_dataset
+
+dataset = load_dataset(
+    "json",
+    data_files={"spec": "spec.jsonl", "synth": "synth.*.jsonl"},
+)
+```
+
+Once published to the Hub, load it by its repository id instead.
+
+## How it is built
+
+The records are not written by hand. They are rendered from the documents in
+the [Nucleoid repository](https://github.com/NucleoidAI/Nucleoid), and the test
+suite fails when the committed JSONL is not what those documents render to, so
+the dataset cannot drift from the specification it publishes.
+
+Every `code` in this dataset is a program the language's own test suite runs:
+the assertions in it hold, and each one parses. The comment that titles a case
+in the source document is promoted to the `title` field rather than left in the
+program, so a model trained on this does not learn to write it back.
+
+`nucleoid.spec.md` is normative. The `synth` split is derived from it and has no
+authority of its own; where the two disagree, the specification wins.
+
+## Copyright
+
+Copyright 2020 Nucleoid
+
+This dataset is licensed under the Apache License, Version 2.0.
```

**File**: `dataset/spec.jsonl` (added, +178/-0)
```diff
@@ -0,0 +1,178 @@
+{"id":"spec-0001","source":"nucleoid.spec.md","title":"Nucleoid runs a statement in the state","code":"# i is 1\ni = 1\n\nassert(i == 1, true)","returns":null}
+{"id":"spec-0002","source":"nucleoid.spec.md","title":"Nucleoid runs a expression statement","code":"# j is 1\nj = 1\n\nassert(j + 2, 3)","returns":null}
+{"id":"spec-0003","source":"nucleoid.spec.md","title":"Nucleoid returns value of variable","code":"# k is 1\nk = 1\n\nk","returns":"1"}
+{"id":"spec-0004","source":"nucleoid.spec.md","title":"Nucleoid throws an error if variable is not defined","code":"try:\n    # t is e plus 1\n    t = e + 1\ncatch error:\n    assert(error, ReferenceError(\"e is not defined\"))","returns":null}
+{"id":"spec-0005","source":"nucleoid.spec.md","title":"Nucleoid throws an error inside a block","code":"# k is 99\nk = 99\n\ntry:\n    # if k is greater than or equal to 99, then throw \"INVALID\"\n    if k >= 99:\n        throw \"INVALID\"\ncatch error:\n    assert(error, \"INVALID\")","returns":null}
+{"id":"spec-0006","source":"nucleoid.spec.md","title":"Nucleoid throws an error as a variable","code":"# length is 0.1\nlength = 0.1\n\ntry:\n    # if length is less than 1, then throw length\n    if length < 1:\n        throw length\ncatch error:\n    assert(error, 0.1)\n\ntry:\n    # if length is less than 1.1, then throw 'length'\n    if length < 1.1:\n        throw 'length'\ncatch error:\n    assert(error, \"length\")","returns":null}
+{"id":"spec-0007","source":"nucleoid.spec.md","title":"Nucleoid creates a class with constructor","code":"# There is a Shape type,\n# which has a type as a string\nclass Shape(type: str):\n    this.type = type\n\n# shape1 is a Shape whose type is \"Square\"\nshape1 = Shape(\"Square\")\n\nassert(shape1, { \"id\": \"shape1\", \"type\": \"Square\" })","returns":null}
+{"id":"spec-0008","source":"nucleoid.spec.md","title":"Nucleoid creates a class with a constructor and a typed attribute","code":"# There is a Shape type,\n# which has a type as a string\nclass Shape:\n    type: str\n\n    def init(type: str):\n        this.type = type\n\n# shape1 is a Shape whose type is \"Rectangle\"\nshape1 = Shape(\"Rectangle\")\n\nassert(shape1, { \"id\": \"shape1\", \"type\": \"Rectangle\" })","returns":null}
+{"id":"spec-0009","source":"nucleoid.spec.md","title":"Nucleoid adds an object to the class's object list","code":"# There is a Student type\nclass Student:\n    pass\n\n# user0 is a Student\nuser0 = Student()\n\nassert(Student.find(student => student.id == \"user0\"), { \"id\": \"user0\" })\nassert(Student[\"user0\"], { \"id\": \"user0\" })","returns":null}
+{"id":"spec-0010","source":"nucleoid.spec.md","title":"Nucleoid preserves class and object lists when a class is updated","code":"# There is a User type\nclass User:\n    pass\n\n# There is a User\nUser()\n\nassert(Class.length, 1)\nassert(User.length, 1)\n\n# There is a User type\nclass User:\n    pass\n\nassert(Class.length, 1)\nassert(User.length, 1)\n\n# There is a User\nUser()\n\nassert(Class.length, 1)\nassert(User.length, 2)","returns":null}
+{"id":"spec-0011","source":"nucleoid.spec.md","title":"Nucleoid places an instance in the list of the class when created","code":"# There is a Student type\nclass Student:\n    pass\n\nassert(typeof Student, List)\n\n# student1 is a Student\nstudent1 = Student()\n\nassert(Student.length, 1)","returns":null}
+{"id":"spec-0012","source":"nucleoid.spec.md","title":"Nucleoid creates a class and a subclass","code":"# There is a Person type,\n# which has a name as a string\nclass Person(name: str):\n    this.name = name\n\n# There is a Student type,\n# which is a subtype of Person\n# and has a school as a string\nclass Student: Person\n    def init(name, school):\n        super(name)\n        this.name = name\n        this.school = school\n\n# student1 is a Student,\n# whose name is \"Emma\"\n# and whose school is \"Riverside High\"\nstudent1 = Student(\"Emma\", \"Riverside High\")\n\nassert(student1, { \"id\": \"student1\", \"name\": \"Emma\", \"school\": \"Riverside High\" })","returns":null}
+{"id":"spec-0013","source":"nucleoid.spec.md","title":"Nucleoid runs a class-level property assignment","code":"# There is a Human type,\n# which has a name as a string\nclass Human(name: str):\n    this.name = name\n\n# All humans are mortal\n$Human.mortal = true\n\n# human1 is a Human whose name is \"Socrates\"\nhuman1 = Human(\"Socrates\")\n\nassert(human1.mortal, true)","returns":null}
+{"id":"spec-0014","source":"nucleoid.spec.md","title":"Nucleoid runs a class-level conditional","code":"# There is a Device type,\n# which has a profile as a string\nclass Device(profile: str):\n    this.profile = profile\n\n# Any device that has a profile is active\nif $Device.profile:\n    $Device.active = true\n\n# device1 has no profile\ndevice1 = Device()\n\n# device2 has profile \"PROFILE-1\"\ndevice2 = Device(\"PROFILE-1\")\n\nassert(device1.active, null)\nassert(device2.active, true)","returns":null}
```

**File**: `dataset/synth.01.jsonl` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+{"id":"synth-01-0001","source":"synth/nucleoid.spec.synth.01.md","title":"Nucleoid updates a chain of dependent variables","code":"# meters is 1000\nmeters = 1000\n\n# kilometers is meters divided by 1000\nkilometers = meters / 1000\n\n# miles is kilometers times 0.621371\nmiles = kilometers * 0.621371\n\nassert(kilometers, 1)\nassert(miles, 0.621371)\n\n# meters is 2000\nmeters = 2000\n\nassert(kilometers, 2)\nassert(miles, 1.242742)","returns":null}
+{"id":"synth-01-0002","source":"synth/nucleoid.spec.synth.01.md","title":"Nucleoid assigns a comparison result to a variable","code":"# threshold is 100\nthreshold = 100\n\n# reading is 120\nreading = 120\n\n# alarm is whether reading is greater than threshold\nalarm = reading > threshold\n\nassert(alarm, true)\n\n# reading is 80\nreading = 80\n\nassert(alarm, false)","returns":null}
+{"id":"synth-01-0003","source":"synth/nucleoid.spec.synth.01.md","title":"Nucleoid updates a template literal when its dependency changes","code":"# host is \"localhost\"\nhost = \"localhost\"\n\n# port is 8080\nport = 8080\n\n# url is \"http://\" plus host plus \":\" plus port\nurl = `http://${host}:${port}`\n\nassert(url, \"http://localhost:8080\")\n\n# port is 9090\nport = 9090\n\nassert(url, \"http://localhost:9090\")","returns":null}
+{"id":"synth-01-0004","source":"synth/nucleoid.spec.synth.01.md","title":"Nucleoid evaluates a logical expression with mixed operands","code":"# online is true\nonline = true\n\n# retries is 0\nretries = 0\n\n# healthy is online and whether retries is 0\nhealthy = online and retries == 0\n\nassert(healthy, true)\n\n# retries is 3\nretries = 3\n\nassert(healthy, false)","returns":null}
+{"id":"synth-01-0005","source":"synth/nucleoid.spec.synth.01.md","title":"Nucleoid respects parentheses in an expression","code":"# a is 2\na = 2\n\n# b is 3\nb = 3\n\n# c is 4\nc = 4\n\nassert(a + b * c, 14)\nassert((a + b) * c, 20)","returns":null}
+{"id":"synth-01-0006","source":"synth/nucleoid.spec.synth.01.md","title":"Nucleoid creates a dependency on a string function","code":"# name is \"nucleoid\"\nname = \"nucleoid\"\n\n# initial is the character of name at 0\ninitial = name.charAt(0)\n\n# label is initial plus \"-\" plus name's length\nlabel = initial + \"-\" + name.length\n\nassert(label, \"n-8\")\n\n# name is \"logic\"\nname = \"logic\"\n\nassert(label, \"l-5\")","returns":null}
+{"id":"synth-01-0007","source":"synth/nucleoid.spec.synth.01.md","title":"Nucleoid creates a dependency on a property of an inline object","code":"# config is an object whose retries is 3\nconfig = { \"retries\": 3 }\n\n# budget is config's retries times 100\nbudget = config.retries * 100\n\nassert(budget, 300)\n\n# config is an object whose retries is 5\nconfig = { \"retries\": 5 }\n\nassert(budget, 500)","returns":null}
+{"id":"synth-01-0008","source":"synth/nucleoid.spec.synth.01.md","title":"Nucleoid rolls back dependent variables if an exception is thrown","code":"# limit is 10\nlimit = 10\n\n# double is limit times 2\ndouble = limit * 2\n\nassert(double, 20)\n\n# if double is greater than 40, then throw \"OVER_LIMIT\"\nif double > 40:\n    throw \"OVER_LIMIT\"\n\ntry:\n    # limit is 25\n    limit = 25\ncatch error:\n    assert(error, \"OVER_LIMIT\")\n\nassert(limit, 10)\nassert(double, 20)","returns":null}
+{"id":"synth-01-0009","source":"synth/nucleoid.spec.synth.01.md","title":"Nucleoid detects a circular dependency between properties","code":"# There is a Box type\nclass Box:\n    pass\n\n# box1 is a Box whose width is 10\nbox1 = Box()\nbox1.width = 10\n\n# box1's height is box1's width times 2\nbox1.height = box1.width * 2\n\nassert(box1.height, 20)\n\ntry:\n    # box1's width is box1's height divided by 2\n    box1.width = box1.height / 2\ncatch error:\n    assert(error, TypeError(\"Circular Dependency\"))","returns":null}
+{"id":"synth-01-0010","source":"synth/nucleoid.spec.synth.01.md","title":"Nucleoid throws an error if a variable in a class-level expression is not defined","code":"# There is an Order type\nclass Order:\n    pass\n\ntry:\n    # any order's total is the order's price times taxRate\n    $Order.total = $Order.price * taxRate\ncatch error:\n    assert(error, ReferenceError(\"taxRate is not defined\"))","returns":null}
+{"id":"synth-01-0011","source":"synth/nucleoid.spec.synth.01.md","title":"Nucleoid rejects an unknown function of a standard built-in object","code":"try:\n    # result is the wrong math function\n    result = Math.wrong(1)\ncatch error:\n    assert(error, TypeError(\"Math.wrong is not a function\"))","returns":null}
+{"id":"synth-01-0012","source":"synth/nucleoid.spec.synth.01.md","title":"Nucleoid throws a property as an error","code":"# There is a Limit type\nclass Limit:\n    pass\n\n# limit1 is a Limit whose max is 5\nlimit1 = Limit()\nlimit1.max = 5\n\ntry:\n    # if limit1's max is less than 10, then throw limit1's max\n    if limit1.max < 10:\n        throw limit1.max\ncatch error:\n    assert(error, 5)","
```

**File**: `dataset/synth.02.jsonl` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+{"id":"synth-02-0001","source":"synth/nucleoid.spec.synth.02.md","title":"Nucleoid deletes a class-level property assignment","code":"# There is a Rate type\nclass Rate:\n    pass\n\n# Any rate's percent is the rate's basis divided by 100\n$Rate.percent = $Rate.basis / 100\n\n# rate1 is a Rate whose basis is 250\nrate1 = Rate()\nrate1.basis = 250\n\nassert(rate1.percent, 2.5)\n\n# Any rate's percent is deleted\ndelete $Rate.percent\n\n# rate1's basis is 500\nrate1.basis = 500\n\nassert(rate1.percent, null)\n\n# rate2 is a Rate whose basis is 100\nrate2 = Rate()\nrate2.basis = 100\n\nassert(rate2.percent, null)","returns":null}
+{"id":"synth-02-0002","source":"synth/nucleoid.spec.synth.02.md","title":"Nucleoid detects a circular dependency across three variables","code":"# first is 1\nfirst = 1\n\n# second is first plus 1\nsecond = first + 1\n\n# third is second plus 1\nthird = second + 1\n\nassert(third, 3)\n\ntry:\n    # first is third plus 1\n    first = third + 1\ncatch error:\n    assert(error, TypeError(\"Circular Dependency\"))\n\nassert(first, 1)\nassert(third, 3)","returns":null}
+{"id":"synth-02-0003","source":"synth/nucleoid.spec.synth.02.md","title":"Nucleoid detects a circular dependency between class-level properties","code":"# There is a Box type\nclass Box:\n    pass\n\n# Any box's area is the box's width times the box's height\n$Box.area = $Box.width * $Box.height\n\ntry:\n    # any box's width is the box's area divided by the box's height\n    $Box.width = $Box.area / $Box.height\ncatch error:\n    assert(error, TypeError(\"Circular Dependency\"))\n\n# box1 is a Box whose width is 3 and whose height is 4\nbox1 = Box()\nbox1.width = 3\nbox1.height = 4\n\nassert(box1.area, 12)","returns":null}
+{"id":"synth-02-0004","source":"synth/nucleoid.spec.synth.02.md","title":"Nucleoid updates dependents when a function is redefined","code":"# fee returns amount times 0.1\ndef fee(amount):\n    return amount * 0.1\n\n# base is 200\nbase = 200\n\n# charge is the result of the fee function call with base\ncharge = fee(base)\n\nassert(charge, 20)\n\n# fee returns amount times 0.2\ndef fee(amount):\n    return amount * 0.2\n\nassert(charge, 40)\n\n# base is 300\nbase = 300\n\nassert(charge, 60)","returns":null}
+{"id":"synth-02-0005","source":"synth/nucleoid.spec.synth.02.md","title":"Nucleoid supports a recursive function","code":"# factorial returns 1 if n is less than or equal to 1,\n# else n times the result of the factorial function call with n minus 1\ndef factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\n# number is 5\nnumber = 5\n\n# result is the result of the factorial function call with number\nresult = factorial(number)\n\nassert(result, 120)\n\n# number is 6\nnumber = 6\n\nassert(result, 720)","returns":null}
+{"id":"synth-02-0006","source":"synth/nucleoid.spec.synth.02.md","title":"Nucleoid supports multiple return statements in a function","code":"# sign returns \"POSITIVE\" if n is greater than 0,\n# \"NEGATIVE\" if n is less than 0,\n# else \"ZERO\"\ndef sign(n):\n    if n > 0:\n        return \"POSITIVE\"\n    else if n < 0:\n        return \"NEGATIVE\"\n    return \"ZERO\"\n\n# value is -4\nvalue = -4\n\n# label is the result of the sign function call with value\nlabel = sign(value)\n\nassert(label, \"NEGATIVE\")\n\n# value is 0\nvalue = 0\n\nassert(label, \"ZERO\")\n\n# value is 7\nvalue = 7\n\nassert(label, \"POSITIVE\")","returns":null}
+{"id":"synth-02-0007","source":"synth/nucleoid.spec.synth.02.md","title":"Nucleoid uses the remainder operator in a dependency","code":"# minutes is 135\nminutes = 135\n\n# hours is the floor of minutes divided by 60\nhours = Math.floor(minutes / 60)\n\n# rest is the remainder of minutes divided by 60\nrest = minutes % 60\n\n# duration is hours plus \"h\" plus rest plus \"m\"\nduration = hours + \"h\" + rest + \"m\"\n\nassert(duration, \"2h15m\")\n\n# minutes is 200\nminutes = 200\n\nassert(duration, \"3h20m\")","returns":null}
+{"id":"synth-02-0008","source":"synth/nucleoid.spec.synth.02.md","title":"Nucleoid maps a list into another list as a dependency","code":"# prices is a list of 10, 20 and 30\nprices = [10, 20, 30]\n\n# rate is 2\nrate = 2\n\n# doubled is each price of prices times rate\ndoubled = prices.map(p => p * rate)\n\nassert(doubled.length, 3)\nassert(doubled[2], 60)\n\n# rate is 3\nrate = 3\n\nassert(doubled[2], 90)\n\n# Add 40 to prices\nprices.push(40)\n\nassert(doubled.length, 4)\nassert(doubled[3], 120)","returns":null}
+{"id":"synth-02-0009","source":"synth/nucleoid.spec.synth.02.md","title":"Nucleoid reduces a list into a value as a dependency","code":"# amounts is a list of 5, 10 and 15\namounts = [5, 10, 15]\n\n# total is the sum of amounts\ntotal = amounts.reduce((sum, amount) => sum + amount, 0)\n\nassert(total, 30)\n\n# Add 20 to amounts\namounts.push(20)\n\nassert(total, 50)\n\n# Remove the last item from amounts\namounts.pop()\n\nassert(total, 30)","returns":null}
+{"id":
```

---

### Incident Patch 5: `ee849697` (2026-08-02)
**Commit Message**: Add executable docs examples test suite

Introduces `docs/examples.md` as a full worked-program companion to the reference and wires it into automated testing via new `tests/examples.rs` generation in `build.rs`. Snippet parsing is standardized around fenced `nuc` blocks by moving logic into `tests/common::snippets`, updating README/readme tests/docs references, and adding guards to ensure examples stay aligned with reference sections and remain fully covered by generated tests.

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ Nucleoid is published as open source under Apache-2.0, so everything is public-f
 
 `nucleoid.spec.md`, `synth/`, `docs/` and the Rust crate (`Cargo.toml`, `src/`) must stay in sync. Every change to one must be propagated to the others as part of the same change.
 
-The crate executes them rather than restating them: `tests/spec.rs` runs `nucleoid.spec.md`, `tests/synth.rs` runs `synth/`, `tests/reference.rs` runs `tests/reference.md` (the executable form of `docs/reference.md`), and `tests/readme.rs` runs the ```nucleoid blocks in `README.md`. Adding a case to any of those documents adds a test, so `cargo test` is the check that the crate and the documents still agree.
+The crate executes them rather than restating them: `tests/spec.rs` runs `nucleoid.spec.md`, `tests/synth.rs` runs `synth/`, `tests/reference.rs` runs `tests/reference.md` (the executable form of `docs/reference.md`), `tests/readme.rs` runs the ```nuc blocks in `README.md`, and `tests/examples.rs` runs those in `docs/examples.md`. Adding a case to any of those documents adds a test, so `cargo test` is the check that the crate and the documents still agree.
 
 A case whose assertions sit on a branch that is never taken proves nothing, so the suites also compare `Runtime::assertions_run()` against the number of `assert` calls in the source and fail when fewer ran.
 
```

**File**: `README.md` (modified, +2/-0)
```diff
@@ -52,6 +52,8 @@ assert(socrates.mortal, true)
 
 It is assembled from the NUC documents in [`docs/`](docs), indexed by [NUC 0](docs/nuc-0000.md) with the conventions in [NUC 1](docs/nuc-0001.md). `nucleoid.spec.md` is normative; where the two disagree, the specification wins.
 
+[**docs/examples.md**](docs/examples.md) covers the same ground as complete programs, each one runnable as written.
+
 A Nucleoid program is a set of statements that remain true. An assignment is not an instruction that runs once and finishes, it is a relationship the runtime records and maintains.
 
 **An assignment states a relationship, not a result**
```

**File**: `build.rs` (modified, +8/-3)
```diff
@@ -17,7 +17,7 @@ enum Format {
     /// A fenced block of cases split by `---`, each titled by its first comment
     /// line.
     Cases,
-    /// Prose with fenced `nucleoid` blocks in it, each titled by the bold claim
+    /// Prose with fenced `nuc` blocks in it, each titled by the bold claim
     /// it demonstrates.
     Snippets,
 }
@@ -54,6 +54,11 @@ const SUITES: &[Suite] = &[
         format: Format::Snippets,
         documents: &[("readme", "README.md")],
     },
+    Suite {
+        output: "examples.rs",
+        format: Format::Snippets,
+        documents: &[("examples", "docs/examples.md")],
+    },
 ];
 
 fn main() {
@@ -123,7 +128,7 @@ fn case_titles(document: &str) -> Vec<String> {
         .collect()
 }
 
-/// The title of every fenced `nucleoid` snippet in a prose document.
+/// The title of every fenced `nuc` snippet in a prose document.
 ///
 /// A snippet is titled by the claim it is there to demonstrate — the last bold
 /// line before it. The same rule as `snippets()` in `tests/readme.rs`.
@@ -144,7 +149,7 @@ fn snippet_titles(document: &str) -> Vec<String> {
                 .to_string();
         }
 
-        if line.starts_with("```nucleoid") {
+        if line.starts_with("```nuc") {
             titles.push(if claim.is_empty() {
                 format!("snippet {}", titles.len() + 1)
             } else {
```

**File**: `docs/examples.md` (added, +907/-0)
```diff
@@ -0,0 +1,907 @@
+# Nucleoid Examples
+
+Worked examples of the language, each one a complete program that runs as written.
+
+The sections follow [reference.md](reference.md) one for one, so an example can
+be read next to the behaviour it demonstrates. Every example is taken from
+`nucleoid.spec.md`, which is normative; where this document and the
+specification disagree, the specification wins. See [NUC 0](nuc-0000.md) for the
+index of NUC documents.
+
+The examples are executable. `cargo test --test examples` runs every block on
+this page and checks the assertions in it, so an example that stops being true
+fails the build.
+
+## Contents
+
+1. [Statements and State](#1-statements-and-state)
+2. [Variables](#2-variables)
+3. [Expressions](#3-expressions)
+4. [Types and Instances](#4-types-and-instances)
+5. [Properties](#5-properties)
+6. [Class-Level Rules](#6-class-level-rules)
+7. [Blocks and Scope](#7-blocks-and-scope)
+8. [Control Flow](#8-control-flow)
+9. [Functions](#9-functions)
+10. [Transactions](#10-transactions)
+11. [Built-in Objects](#11-built-in-objects)
+12. [Error Reference](#12-error-reference)
+
+[Syntax Summary](reference.md#13-syntax-summary) is a table of forms rather than
+a behaviour, so it has no example of its own.
+
+---
+
+## 1. Statements and State
+
+**A statement runs against the state, and an expression statement returns its value**
+
+- A statement is run against the state and changes it.
+- An expression statement is evaluated against what the state already holds.
+
+```nuc
+i = 1
+
+assert(i == 1, true)
+
+j = 1
+
+assert(j + 2, 3)
+```
+
+**Statements apply in the order received, and the last one to assign a target holds**
+
+- All five conditionals are standing rules and all are kept.
+- When `any` becomes 4 the first, second and fourth match; the last of them holds.
+
+```nuc
+any = 0
+
+if any > 1:
+    result = 1
+
+if any > 2:
+    result = 2
+
+if any > 3:
+    result = 3
+
+if any > 2:
+    result = 4
+
+if any > 1:
+    result = 5
+
+any = 4
+
+assert(result, 5)
+```
+
+Full detail: [reference.md §1](reference.md#1-statements-and-state), [NUC 2](nuc-0002.md).
+
+---
+
+## 2. Variables
+
+**An assignment states a relationship, and stating it again replaces it**
+
+- `c` is the sum of `a` and `b`, and stays the sum as they change.
+- Assigning `c` again discards the dependency on `a` and records the one on `b`.
+
+```nuc
+a = 1
+b = 2
+c = a + b
+
+assert(c, 3)
+
+a = 2
+
+assert(c, 4)
+
+c = b + 3
+
+assert(c, 5)
+
+b = 4
+
+assert(c, 7)
+```
+
+**A variable that reads itself reads only its value**
+
+- The occurrence on the right is the current value, not a dependency.
+- This is why it is not a cycle.
+
+```nuc
+radius = 10
+radius = radius + 10
+
+assert(radius, 20)
+```
+
+**The value property reads a variable without depending on it**
+
+- `width` is fixed against `goldenRatio` and still follows `altitude`.
+- It is how a relationship is broken deliberately rather than by accident.
+
+```nuc
+goldenRatio = 1.618
+altitude = 10
+width = goldenRatio.value * altitude
+
+assert(width, 16.18)
+
+goldenRatio = 1.62
+
+assert(width, 16.18)
+
+altitude = 100
+
+assert(width, 161.8)
+```
+
+**Deleting a variable clears what depended on it**
+
+- `delete` reports whether anything was removed.
+- The statements that read the name are gone, and using it again is a reference error.
+
+```nuc
+t = 1
+q = t + 1
+
+assert(q, 2)
+assert(delete q, true)
+
+t = 2
+
+try:
+    q
+catch error:
+    assert(error, ReferenceError("q is not defined"))
+```
+
+Full detail: [reference.md §2](reference.md#2-variables), [NUC 2](nuc-0002.md).
+
+---
+
+## 3. Expressions
+
+**A string may be written three ways, and a template interpolates what it reads**
+
+- Single quotes, double quotes and backticks all give a string.
+- `${...}` interpolates, and what it reads is a dependency like any other.
+
+```nuc
+a = 123
+
+assert('New String', "New String")
+assert("New String", "New String")
+assert(`New String`, "New String")
+
+assert(`New ${a} String`, "New 123 String")
+```
+
+**Logical operators have a word spelling and a symbol spelling**
+
+- `and`, `or` and `not` are the same operators as `&&`, `||` and `!`.
+
+```nuc
+condition = false
+
+assert(condition or true, true)
+assert(condition || true, true)
+
+assert(not condition and true, true)
+assert(!condition && true, true)
+```
+
+**A list indexes with brackets**
+
+```nuc
+states = ["NY", "GA", "CT", "MI"]
+
+assert(states[2], "CT")
+```
+
+**Length is a dependency like any other**
+
+- `i1` follows the length of `str1`, and so does the condition below it.
+
+```nuc
+str1 = "ABC"
+i1 = str1.length + 1
+
+assert(i1, 4)
+
+str1 = "ABCD"
+
+assert(i1, 5)
+
+if str1.length > 5:
+    i2 = i1
+
+str1 = "ABCDEF"
+
+assert(i2, 7)
+```
+
+Full detail: [reference.md §3](reference.md#3-expressions), [NUC 10](nuc-0010.md).
+
+---
+
+## 4. Types and Instances
+
+**A type declares its constructor, and instances register themselves**
+
+- `S
```

**File**: `docs/nuc-0000.md` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ Created: 31-Jul-2026
 - NUCs are the documentation for the Nucleoid Language Reference.
 - Format and conventions follow Python Enhancement Proposals; see [NUC 1](nuc-0001.md).
 - [reference.md](reference.md) is the consolidated reference for the website, assembled from these documents.
+- [examples.md](examples.md) is the same ground worked as complete programs, taken from `nucleoid.spec.md`.
 
 ## Index by Category
 
```

**File**: `docs/reference.md` (modified, +4/-0)
```diff
@@ -12,6 +12,10 @@ See [NUC 0](nuc-0000.md) for the index and [NUC 1](nuc-0001.md) for the
 conventions. `nucleoid.spec.md` is normative; where this document and the
 specification disagree, the specification wins.
 
+The entries below are abbreviated to the behaviour they state.
+[examples.md](examples.md) covers the same ground as complete programs, each one
+runnable as written.
+
 ## Contents
 
 1. [Statements and State](#1-statements-and-state)
```

**File**: `examples/_snippet.rs` (modified, +1/-4)
```diff
@@ -19,8 +19,5 @@ fn main() {
         );
     }
 
-    println!(
-        "{}",
-        if failures.is_empty() { "ok" } else { "FAILED" }
-    );
+    println!("{}", if failures.is_empty() { "ok" } else { "FAILED" });
 }
```

**File**: `tests/common/mod.rs` (modified, +57/-0)
```diff
@@ -58,6 +58,63 @@ pub fn cases(document: &str) -> Vec<Case> {
         .collect()
 }
 
+/// Every fenced `nuc` block in a prose document, titled by the bold claim
+/// above it.
+///
+/// Deliberately the same rule as `snippet_titles` in `build.rs`; the two are
+/// checked against each other by the title lookup and by each suite's coverage
+/// test. `name` is the document the blocks came from, for the failure message.
+pub fn snippets(document: &str, name: &str) -> Vec<Case> {
+    let document = document.replace("\r\n", "\n");
+
+    let mut cases: Vec<Case> = Vec::new();
+    let mut claim = String::new();
+    let mut source: Option<String> = None;
+
+    for line in document.lines() {
+        let trimmed = line.trim();
+
+        if let Some(collected) = &mut source {
+            if trimmed.starts_with("```") {
+                let title = if claim.is_empty() {
+                    format!("snippet {}", cases.len() + 1)
+                } else {
+                    claim.clone()
+                };
+
+                cases.push(Case {
+                    title,
+                    source: std::mem::take(collected),
+                    expected: None,
+                });
+
+                source = None;
+            } else {
+                collected.push_str(line);
+                collected.push('\n');
+            }
+
+            continue;
+        }
+
+        if trimmed.len() > 4 && trimmed.starts_with("**") && trimmed.ends_with("**") {
+            claim = trimmed
+                .trim_matches('*')
+                .trim()
+                .trim_end_matches('.')
+                .to_string();
+        }
+
+        if trimmed.starts_with("```nuc") {
+            source = Some(String::new());
+        }
+    }
+
+    assert!(source.is_none(), "unterminated ```nuc block in {name}");
+
+    cases
+}
+
 /// Projects a runtime value into JSON so it can be compared with the literal
 /// written in the spec.
 fn to_json(state: &State, value: &Value) -> serde_json::Value {
```

---

### Incident Patch 6: `ffd31e9f` (2026-08-02)
**Commit Message**: Generate one test per case via build.rs

Replace the monolithic run-all test functions with per-behaviour tests generated by build.rs. Each case in nucleoid.spec.md, synth/, tests/reference.md, and README.md now becomes its own named #[test], matching the ref/ JS suite's it(...) style. Cases are looked up by title at runtime, so mismatches between build.rs and the harness fail loudly. Also documents the contributor workflow in CONTRIBUTING.md.

**File**: `CONTRIBUTING.md` (modified, +65/-0)
```diff
@@ -2,6 +2,71 @@
 
 Thanks to declarative programming, we have a brand-new approach to data and logic. As we are still discovering what we can do with this powerful programming model, please join us with any types of contribution!
 
+## Working on the Rust runtime
+
+This repository holds the Rust implementation. The crate is at the root, and
+`ref/` is the archived JavaScript implementation kept for reference.
+
+```console
+$ cargo test                  # the whole suite
+$ cargo clippy --all-targets -- -D warnings
+$ cargo fmt
+$ cargo run -- program.nuc    # run a file
+$ cargo run                   # or type statements at a prompt
+```
+
+### What lives where
+
+| path | what it is |
+| --- | --- |
+| `nucleoid.spec.md` | what the language does. Authoritative — when anything disagrees with it, it wins |
+| `synth/` | further cases, derived from the specification |
+| `docs/` | the language reference, as NUC documents in the style of a PEP |
+| `docs/reference.md` | prose reference; `tests/reference.md` is its executable form |
+| `src/` | the runtime |
+| `tests/` | the suites that run the documents above |
+| `ref/` | the archived JavaScript implementation — **frozen**, read it but never change it |
+
+### Adding a behaviour
+
+Cases are written in Nucleoid, not in Rust. Add one to `nucleoid.spec.md` —
+title it with a comment, and end it with `assert(...)` or a `# return:` line:
+
+```text
+# Nucleoid keeps a total in step with what it is made of
+
+# subtotal is 10
+subtotal = 10
+
+# total is subtotal plus tax
+total = subtotal * 1.2
+
+assert(total, 12)
+```
+
+`build.rs` turns every case into a test of its own, so there is nothing else to
+edit — `cargo test` will show it by name:
+
+```console
+$ cargo test --test spec keeps_a_total
+test nucleoid::keeps_a_total_in_step_with_what_it_is_made_of ... ok
+```
+
+Two rules the suites enforce, both of which fail the build rather than pass
+quietly:
+
+- **Every case needs a title of its own.** Tests find their case by title, so a
+  repeated title would leave the second case unreachable.
+- **Assertions have to actually run.** A case whose `assert` sits in a `catch`
+  that never fires proves nothing, so the harness compares how many assertions
+  ran against how many the source contains.
+
+### Keeping things in step
+
+`nucleoid.spec.md`, `synth/`, `docs/` and the crate describe the same language,
+and a change to one belongs in the same change as the others. `cargo test` is
+what checks they still agree.
+
 ## Declarative Runtime Environment
 
 Nucleoid is a declarative runtime environment that applies declarative programming at the runtime as rerendering JavaScript statements and creating the graph, so as a result, the declarative runtime system isolates a behavior definition of a program from its technical instructions and executes declarative statements, which represent logical intention without carrying any technical detail.
```

**File**: `build.rs` (added, +264/-0)
```diff
@@ -0,0 +1,264 @@
+//! Turns every case in the language's documents into a named Rust test.
+//!
+//! `ref/src/test/nucleoid.spec.js` writes one `it(...)` per behaviour, so a
+//! failure names the behaviour that broke. The cases here live in the documents
+//! rather than in the test files, so the `it`s are generated from them — which
+//! also keeps the promise in `CLAUDE.md` that adding a case to a document adds
+//! a test, with nothing else to edit.
+
+use std::env;
+use std::fmt::Write as _;
+use std::fs;
+use std::path::Path;
+
+/// How a document holds its cases.
+#[derive(Clone, Copy, PartialEq)]
+enum Format {
+    /// A fenced block of cases split by `---`, each titled by its first comment
+    /// line.
+    Cases,
+    /// Prose with fenced `nucleoid` blocks in it, each titled by the bold claim
+    /// it demonstrates.
+    Snippets,
+}
+
+/// One generated test file, and the documents whose cases go into it. Each
+/// document becomes a module, the way `describe(...)` groups `it`s.
+struct Suite {
+    output: &'static str,
+    format: Format,
+    documents: &'static [(&'static str, &'static str)],
+}
+
+const SUITES: &[Suite] = &[
+    Suite {
+        output: "spec.rs",
+        format: Format::Cases,
+        documents: &[("nucleoid", "nucleoid.spec.md")],
+    },
+    Suite {
+        output: "synth.rs",
+        format: Format::Cases,
+        documents: &[
+            ("synth_01", "synth/nucleoid.spec.synth.01.md"),
+            ("synth_02", "synth/nucleoid.spec.synth.02.md"),
+        ],
+    },
+    Suite {
+        output: "reference.rs",
+        format: Format::Cases,
+        documents: &[("reference", "tests/reference.md")],
+    },
+    Suite {
+        output: "readme.rs",
+        format: Format::Snippets,
+        documents: &[("readme", "README.md")],
+    },
+];
+
+fn main() {
+    println!("cargo::rerun-if-changed=build.rs");
+
+    let out = env::var("OUT_DIR").expect("cargo sets OUT_DIR for build scripts");
+
+    for suite in SUITES {
+        let mut generated = String::new();
+        generated.push_str("// @generated by build.rs — do not edit.\n\n");
+
+        let mut total = 0;
+        let mut modules = String::new();
+
+        for (index, (module, path)) in suite.documents.iter().enumerate() {
+            println!("cargo::rerun-if-changed={path}");
+
+            let document = fs::read_to_string(path)
+                .unwrap_or_else(|error| panic!("{path} states what the language does: {error}"));
+
+            let titles = match suite.format {
+                Format::Cases => case_titles(&document),
+                Format::Snippets => snippet_titles(&document),
+            };
+
+            reject_duplicates(path, &titles);
+
+            total += titles.len();
+            modules.push_str(&module_for(module, index, &titles));
+        }
+
+        writeln!(generated, "pub const GENERATED: usize = {total};\n").unwrap();
+        generated.push_str(&modules);
+
+        fs::write(Path::new(&out).join(suite.output), generated)
+            .expect("the generated tests must be writable");
+    }
+}
+
+/// The title of every case in a case document, in order.
+///
+/// Deliberately the same rule as `cases()` in `tests/common/mod.rs`: split the
+/// fenced block on `---`, and take each case's first comment line as its title.
+/// The two are checked against each other at test time — a generated test looks
+/// its case up by title and fails loudly if it is not there, and the count above
+/// is compared with the count the harness parses.
+fn case_titles(document: &str) -> Vec<String> {
+    let document = document.replace("\r\n", "\n");
+
+    let body = document
+        .split("```")
+        .nth(1)
+        .expect("cases live in one fenced block");
+
+    body.split("\n---\n")
+        .filter(|block| !block.trim().is_empty())
+        .map(|block| {
+            block
+                .lines()
+                .map(str::trim)
+                .find(|line| line.starts_with('#'))
+                .unwrap_or("untitled")
+                .trim_start_matches('#')
+                .trim()
+                .to_string()
+        })
+        .collect()
+}
+
+/// The title of every fenced `nucleoid` snippet in a prose document.
+///
+/// A snippet is titled by the claim it is there to demonstrate — the last bold
+/// line before it. The same rule as `snippets()` in `tests/readme.rs`.
+fn snippet_titles(document: &str) -> Vec<String> {
+    let document = document.replace("\r\n", "\n");
+
+    let mut titles = Vec::new();
+    let mut claim = String::new();
+
+    for line in document.lines() {
+        let line = line.trim();
+
+        if line.len() > 4 && line.starts_with("**") && line.ends_with("**") {
+            claim = line
+                .trim_matches('*')
+                .trim()
+                .trim_end_matches('.')
+                .to_string();
+        }
+
+        if line.starts_with("```nucleoid") {
+            titles.push(if claim.is_empt
```

**File**: `src/lib.rs` (modified, +6/-0)
```diff
@@ -35,6 +35,12 @@
 //! | [`transaction`] | `src/transaction.js` |
 //! | [`runtime`] | `src/runtime.js` |
 //!
+//! Three modules answer to nothing in `ref`, because they are what being typed
+//! costs: [`value`] is the runtime value as a closed enum where `ref` has
+//! whatever JavaScript handed it, [`error`] is the failure as a typed enum
+//! returned through [`Result`] where `ref` throws, and [`builtins`] gathers the
+//! standard objects that `ref` reaches by leaving them to its host.
+//!
 //! `ref` is untyped JavaScript, so its node kinds are classes reached by
 //! dynamic dispatch and its `$CLASS`/`$INSTANCE` variants are subclasses. The
 //! kinds are a closed set, so here they are the [`nuc::Nuc`] and
```

**File**: `tests/common/mod.rs` (modified, +31/-32)
```diff
@@ -170,41 +170,40 @@ pub fn check(case: &Case) -> Result<(), String> {
     Ok(())
 }
 
-/// Runs every case in a document, reporting how many pass.
-pub fn run(name: &str, document: &str) {
-    let cases = cases(document);
-    let mut failures = Vec::new();
-
-    let trace = std::env::var_os("NUCLEOID_TRACE").is_some();
-
-    for case in &cases {
-        if trace {
-            println!("  running {}", case.title);
-        }
-
-        if let Err(reason) = check(case) {
-            failures.push((case.title.clone(), reason));
-        }
-    }
-
-    let passed = cases.len() - failures.len();
-    println!(
-        "
-{name}: {passed}/{} cases pass",
-        cases.len()
+/// Runs the case with this title, for the generated per-behaviour tests.
+///
+/// The case is looked up by title rather than by position, so that `build.rs`
+/// and [`cases`] disagreeing about where one case ends and the next begins
+/// fails loudly here instead of quietly running the wrong source.
+pub fn run_case(documents: &[Vec<Case>], document: usize, title: &str) {
+    let cases = documents
+        .get(document)
+        .unwrap_or_else(|| panic!("no document {document}"));
+
+    let mut matching = cases.iter().filter(|case| case.title == title);
+
+    let case = matching
+        .next()
+        .unwrap_or_else(|| panic!("no case titled {title:?}"));
+
+    // `build.rs` refuses a document with repeated titles, so reaching here
+    // means the two disagree about where cases begin — in which case running
+    // the first match would silently test the wrong source.
+    assert!(
+        matching.next().is_none(),
+        "more than one case titled {title:?}"
     );
 
-    for (title, reason) in &failures {
-        println!(
-            "  FAIL {title}
-       {reason}"
+    if let Err(reason) = check(case) {
+        panic!(
+            "{title}
+  {reason}"
         );
     }
+}
 
-    assert!(
-        failures.is_empty(),
-        "{} of {} {name} cases fail",
-        failures.len(),
-        cases.len()
-    );
+/// How many cases the harness found, to compare with how many tests were
+/// generated for them.
+pub fn total(documents: &[Vec<Case>]) -> usize {
+    documents.iter().map(Vec::len).sum()
 }
```

**File**: `tests/readme.rs` (modified, +71/-44)
```diff
@@ -1,68 +1,95 @@
-//! Runs the Nucleoid snippets in `README.md`.
+//! The Nucleoid snippets in `README.md`, run as one test per claim.
 //!
 //! They are the first thing anyone reads, so they are executed from the file
-//! itself rather than copied here — there is nothing to drift.
+//! itself rather than copied here — there is nothing to drift. Each snippet is
+//! named after the claim it demonstrates, so a failure says which promise the
+//! README is no longer keeping.
+//!
+//! The tests are generated by `build.rs` — see there for why.
 
 mod common;
 
+use std::sync::LazyLock;
+
 const README: &str = include_str!("../README.md");
 
-/// Every ```nucleoid fenced block in the README, in order.
-fn snippets() -> Vec<common::Case> {
-    let mut cases = Vec::new();
-    let mut rest = README;
-    let mut index = 0;
+static DOCUMENTS: LazyLock<Vec<Vec<common::Case>>> = LazyLock::new(|| vec![snippets(README)]);
 
-    while let Some(start) = rest.find("```nucleoid") {
-        let after = &rest[start + "```nucleoid".len()..];
+include!(concat!(env!("OUT_DIR"), "/readme.rs"));
 
-        let Some(end) = after.find("```") else {
-            panic!("unterminated ```nucleoid block in README.md");
-        };
+/// Every fenced `nucleoid` block, titled by the bold claim above it.
+///
+/// The same rule as `snippet_titles` in `build.rs`; the two are checked against
+/// each other by the title lookup and by [`every_snippet_is_covered`].
+fn snippets(document: &str) -> Vec<common::Case> {
+    let document = document.replace("\r\n", "\n");
 
-        index += 1;
-        cases.push(common::Case {
-            title: format!("README snippet {index}"),
-            source: after[..end].to_string(),
-            expected: None,
-        });
+    let mut cases: Vec<common::Case> = Vec::new();
+    let mut claim = String::new();
+    let mut source: Option<String> = None;
 
-        rest = &after[end + 3..];
-    }
+    for line in document.lines() {
+        let trimmed = line.trim();
 
-    cases
-}
+        if let Some(collected) = &mut source {
+            if trimmed.starts_with("```") {
+                let title = if claim.is_empty() {
+                    format!("snippet {}", cases.len() + 1)
+                } else {
+                    claim.clone()
+                };
 
-#[test]
-fn readme_snippets_run() {
-    let cases = snippets();
+                cases.push(common::Case {
+                    title,
+                    source: std::mem::take(collected),
+                    expected: None,
+                });
 
-    assert!(
-        !cases.is_empty(),
-        "README.md should show what the language looks like"
-    );
+                source = None;
+            } else {
+                collected.push_str(line);
+                collected.push('\n');
+            }
 
-    let mut failures = Vec::new();
+            continue;
+        }
+
+        if trimmed.len() > 4 && trimmed.starts_with("**") && trimmed.ends_with("**") {
+            claim = trimmed
+                .trim_matches('*')
+                .trim()
+                .trim_end_matches('.')
+                .to_string();
+        }
 
-    for case in &cases {
-        if let Err(reason) = common::check(case) {
-            failures.push((case.title.clone(), reason));
+        if trimmed.starts_with("```nucleoid") {
+            source = Some(String::new());
         }
     }
 
-    println!(
-        "\nreadme: {}/{} snippets run",
-        cases.len() - failures.len(),
-        cases.len()
+    assert!(
+        source.is_none(),
+        "unterminated ```nucleoid block in README.md"
     );
 
-    for (title, reason) in &failures {
-        println!("  FAIL {title}\n       {reason}");
-    }
+    cases
+}
 
-    assert!(
-        failures.is_empty(),
-        "{} README snippets fail",
-        failures.len()
+/// Runs the snippet with this title. Called by each generated test.
+fn case(document: usize, title: &str) {
+    common::run_case(&DOCUMENTS, document, title);
+}
+
+/// Every snippet in the README has a test of its own, and there is at least one
+/// — the README should show what the language looks like.
+#[test]
+fn every_snippet_is_covered() {
+    let total = common::total(&DOCUMENTS);
+
+    assert!(total > 0, "README.md shows no Nucleoid");
+
+    assert_eq!(
+        total, GENERATED,
+        "build.rs generated {GENERATED} tests for the snippets in README.md"
     );
 }
```

**File**: `tests/reference.rs` (modified, +23/-3)
```diff
@@ -1,8 +1,28 @@
-//! Runs the behaviours stated in `docs/reference.md`, kept executable here.
+//! The behaviours stated in `docs/reference.md`, kept executable here and run
+//! as one test per behaviour.
+//!
+//! The tests are generated by `build.rs` — see there for why.
 
 mod common;
 
+use std::sync::LazyLock;
+
+static DOCUMENTS: LazyLock<Vec<Vec<common::Case>>> =
+    LazyLock::new(|| vec![common::cases(include_str!("reference.md"))]);
+
+include!(concat!(env!("OUT_DIR"), "/reference.rs"));
+
+/// Runs the case with this title. Called by each generated test.
+fn case(document: usize, title: &str) {
+    common::run_case(&DOCUMENTS, document, title);
+}
+
+/// Every case in the document has a test of its own.
 #[test]
-fn reference() {
-    common::run("reference", include_str!("reference.md"));
+fn every_case_is_covered() {
+    assert_eq!(
+        common::total(&DOCUMENTS),
+        GENERATED,
+        "build.rs generated {GENERATED} tests for the cases in tests/reference.md"
+    );
 }
```

**File**: `tests/spec.rs` (modified, +33/-3)
```diff
@@ -1,8 +1,38 @@
-//! Runs `nucleoid.spec.md`, the authoritative description of the language.
+//! `nucleoid.spec.md`, the authoritative description of the language, run as
+//! one test per behaviour.
+//!
+//! The cases are written in Nucleoid rather than in Rust, so the tests that run
+//! them are generated from the document by `build.rs` — see there for why. The
+//! effect is the same as `ref/src/test/nucleoid.spec.js`: every behaviour is
+//! named, reported and filtered on its own.
+//!
+//! ```text
+//! cargo test --test spec                       # every behaviour
+//! cargo test --test spec detects_a_circular    # one of them
+//! cargo test --test spec -- --list             # what there is
+//! ```
 
 mod common;
 
+use std::sync::LazyLock;
+
+static DOCUMENTS: LazyLock<Vec<Vec<common::Case>>> =
+    LazyLock::new(|| vec![common::cases(include_str!("../nucleoid.spec.md"))]);
+
+include!(concat!(env!("OUT_DIR"), "/spec.rs"));
+
+/// Runs the case with this title. Called by each generated test.
+fn case(document: usize, title: &str) {
+    common::run_case(&DOCUMENTS, document, title);
+}
+
+/// Every case in the document has a test of its own. A case that quietly
+/// stopped being run would otherwise look like a passing suite.
 #[test]
-fn spec() {
-    common::run("spec", include_str!("../nucleoid.spec.md"));
+fn every_case_is_covered() {
+    assert_eq!(
+        common::total(&DOCUMENTS),
+        GENERATED,
+        "build.rs generated {GENERATED} tests for the cases in nucleoid.spec.md"
+    );
 }
```

**File**: `tests/synth.rs` (modified, +25/-11)
```diff
@@ -1,19 +1,33 @@
-//! Runs the synthesized use cases, which are derived from `nucleoid.spec.md`.
+//! The synthesized use cases, which are derived from `nucleoid.spec.md`, run as
+//! one test per behaviour.
+//!
+//! Each document is its own module, so a failure says which synth set it came
+//! from. The tests are generated by `build.rs` — see there for why.
 
 mod common;
 
-#[test]
-fn synth_01() {
-    common::run(
-        "synth 01",
-        include_str!("../synth/nucleoid.spec.synth.01.md"),
-    );
+use std::sync::LazyLock;
+
+static DOCUMENTS: LazyLock<Vec<Vec<common::Case>>> = LazyLock::new(|| {
+    vec![
+        common::cases(include_str!("../synth/nucleoid.spec.synth.01.md")),
+        common::cases(include_str!("../synth/nucleoid.spec.synth.02.md")),
+    ]
+});
+
+include!(concat!(env!("OUT_DIR"), "/synth.rs"));
+
+/// Runs the case with this title. Called by each generated test.
+fn case(document: usize, title: &str) {
+    common::run_case(&DOCUMENTS, document, title);
 }
 
+/// Every case in every synth document has a test of its own.
 #[test]
-fn synth_02() {
-    common::run(
-        "synth 02",
-        include_str!("../synth/nucleoid.spec.synth.02.md"),
+fn every_case_is_covered() {
+    assert_eq!(
+        common::total(&DOCUMENTS),
+        GENERATED,
+        "build.rs generated {GENERATED} tests for the cases in synth/"
     );
 }
```

---

### Incident Patch 7: `fed87243` (2026-08-01)
**Commit Message**: Mark script/web files as linguist-vendored

Expand `.gitattributes` with `linguist-vendored` rules for Python, JavaScript, TypeScript, and basic web asset extensions. This hides those files from GitHub Linguist language stats so the repository language breakdown better reflects the core codebase.

**File**: `.gitattributes` (modified, +16/-0)
```diff
@@ -1 +1,17 @@
 * text=auto eol=lf
+
+# Hide Python
+*.py linguist-vendored
+
+# Hide JavaScript
+*.js linguist-vendored
+*.mjs linguist-vendored
+*.cjs linguist-vendored
+
+# Hide TypeScript
+*.ts linguist-vendored
+*.tsx linguist-vendored
+
+# Optional: hide web assets
+*.html linguist-vendored
+*.css linguist-vendored
```

---

### Incident Patch 8: `49916897` (2026-08-01)
**Commit Message**: Add robustness tests, reference suite, and --graph flag

- Add `tests/reference.md` and `tests/reference.rs` as the executable form of `docs/reference.md`
- Add `tests/robustness.rs` covering stack overflow, cycles, malformed input, mutual deps, and rollback
- Add `--graph` CLI flag to print the logic graph after execution
- Guard parser and evaluator against deep nesting/recursion with `MAX_DEPTH`/`MAX_NESTING`
- Replace `propagate_removed` with `cascade_removal`, which uses a `deleted` set so dependents resolve to undefined rather than erroring during deletion
- Add `NodeKind::Display`, `Graph::nodes()`, `Graph::len()`, `Graph::is_empty()`
- Update README with Rust runtime overview and CLAUDE.md with test file convention

**File**: `.github/workflows/rust.yml` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@ on:
   push:
     branches: [rust]
   pull_request:
+    branches: [rust]
 
 jobs:
   check:
```

**File**: `CLAUDE.md` (modified, +2/-0)
```diff
@@ -31,4 +31,6 @@ Nucleoid is published as open source under Apache-2.0, so everything is public-f
 
 `nucleoid.spec.md`, `synth/`, `docs/` and the Rust crate (`Cargo.toml`, `src/`) must stay in sync. Every change to one must be propagated to the others as part of the same change.
 
+The crate executes them rather than restating them: `tests/spec.rs` runs `nucleoid.spec.md`, `tests/synth.rs` runs `synth/`, and `tests/reference.rs` runs `tests/reference.md`, the executable form of `docs/reference.md`. Adding a case to any of those documents adds a test, so `cargo test` is the check that the crate and the documents still agree.
+
 `ref/` is **frozen**. Read it for reference, never modify it.
```

**File**: `README.md` (modified, +62/-0)
```diff
@@ -218,6 +218,68 @@ Learn more at [nucleoid.com/docs/get-started](https://nucleoid.com/docs/get-star
 
 ---
 
+## Rust runtime :crab:
+
+The runtime is being rewritten in Rust as the `nucleoid` crate, against its own
+grammar. `nucleoid.spec.md` is the normative description of the language and is
+executed as the test suite; [`docs/`](docs) is the language reference.
+
+```
+class Sensor(name: str):
+    this.name = name
+
+# Every sensor labels itself
+$Sensor.label = "sensor:" + $Sensor.name
+
+threshold = 30
+
+kitchen = Sensor("kitchen")
+kitchen.reading = 42
+
+# A standing rule, not a one-off comparison
+kitchen.alarm = kitchen.reading > threshold
+```
+
+`kitchen.alarm` is `true`, and stays correct on its own: change `threshold` or
+`kitchen.reading` and it is re-evaluated, because the runtime kept the
+relationship rather than just the result.
+
+Embedded in Rust:
+
+```rust
+use nucleoid::Runtime;
+
+let mut runtime = Runtime::new();
+runtime.run("celsius = 100")?;
+runtime.run("fahrenheit = celsius * 9 / 5 + 32")?;
+runtime.run("celsius = 37")?;
+
+assert_eq!(runtime.run("fahrenheit")?.to_string(), "98.6");
+```
+
+From the terminal:
+
+```bash
+cargo run -- program.nuc          # run a file
+cargo run -- program.nuc --graph  # run it and print the logic graph
+cargo run                         # statements from the terminal
+```
+
+`--graph` prints what the runtime is holding — every tracked statement, what it
+reads, and what it updates:
+
+```
+logic graph (7 nodes)
+  threshold [variable]
+    updates  kitchen.alarm
+  kitchen.label [property]
+    reads    kitchen.name
+  kitchen.alarm [property]
+    reads    kitchen, kitchen.reading, threshold
+```
+
+---
+
 ### Under the hood: Declarative (Logic) Runtime Environment
 
 Nucleoid is an implementation of symbolic AI for declarative (logic) programming at the runtime. As mentioned, the declarative runtime environment manages JavaScript state and stores each transaction in the built-in data store by declaratively rerendering JavaScript statements and building the knowledge graph (base) as well as an execution plan.
```

**File**: `src/eval.rs` (modified, +32/-3)
```diff
@@ -7,12 +7,25 @@ use crate::ast::{BinaryOp, Expr, Function, FunctionBody, LogicalOp, TemplatePart
 use crate::builtins;
 use crate::error::{Error, Result};
 use crate::graph::NodeKey;
-use crate::runtime::{AssertionFailure, Flow, Runtime};
+use crate::runtime::{AssertionFailure, Flow, MAX_DEPTH, Runtime};
 use crate::scope::Scope;
 use crate::value::{ObjectData, ObjectId, Value};
 
 impl Runtime {
     pub(crate) fn evaluate(&mut self, expression: &Expr, scope: &mut Scope) -> Result<Value> {
+        self.depth += 1;
+
+        if self.depth > MAX_DEPTH {
+            self.depth -= 1;
+            return Err(Error::type_error("Maximum expression depth exceeded"));
+        }
+
+        let result = self.evaluate_inner(expression, scope);
+        self.depth -= 1;
+        result
+    }
+
+    fn evaluate_inner(&mut self, expression: &Expr, scope: &mut Scope) -> Result<Value> {
         match expression {
             Expr::Null => Ok(Value::Null),
             Expr::Bool(bool) => Ok(Value::Bool(*bool)),
@@ -234,6 +247,14 @@ impl Runtime {
             return Ok(Value::Class(name.to_string()));
         }
 
+        let key = NodeKey::new(name.to_string());
+
+        if self.deleted.contains(&key) {
+            self.track(key);
+            self.undefined_read = true;
+            return Ok(Value::Undefined);
+        }
+
         Err(Error::not_defined(name))
     }
 
@@ -1042,6 +1063,14 @@ impl Runtime {
     /// Deep equality, which is what `assert` compares with. Objects match on
     /// their contents, and `null` matches a property that was never set.
     pub(crate) fn deep_equal(&self, left: &Value, right: &Value) -> bool {
+        self.equal_within(left, right, 0)
+    }
+
+    fn equal_within(&self, left: &Value, right: &Value, depth: usize) -> bool {
+        if depth > 64 {
+            return false;
+        }
+
         match (left, right) {
             (Value::Undefined | Value::Null, Value::Undefined | Value::Null) => true,
 
@@ -1064,7 +1093,7 @@ impl Runtime {
 
                 left_keys.iter().all(|key| {
                     match (left.properties.get(*key), right.properties.get(*key)) {
-                        (Some(left), Some(right)) => self.deep_equal(left, right),
+                        (Some(left), Some(right)) => self.equal_within(left, right, depth + 1),
                         _ => false,
                     }
                 })
@@ -1075,7 +1104,7 @@ impl Runtime {
                     && left
                         .iter()
                         .zip(right.iter())
-                        .all(|(left, right)| self.deep_equal(left, right))
+                        .all(|(left, right)| self.equal_within(left, right, depth + 1))
             }
 
             (Value::Number(left), Value::Number(right)) => left == right,
```

**File**: `src/graph.rs` (modified, +36/-0)
```diff
@@ -62,6 +62,27 @@ pub enum NodeKind {
     Block,
 }
 
+impl NodeKind {
+    pub fn as_str(self) -> &'static str {
+        match self {
+            NodeKind::Pending => "pending",
+            NodeKind::Variable => "variable",
+            NodeKind::Property => "property",
+            NodeKind::Object => "object",
+            NodeKind::Class => "class",
+            NodeKind::Function => "function",
+            NodeKind::If => "if",
+            NodeKind::Block => "block",
+        }
+    }
+}
+
+impl fmt::Display for NodeKind {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        f.write_str(self.as_str())
+    }
+}
+
 /// A statement filed in the graph, together with the edges that decide when it
 /// is re-evaluated.
 #[derive(Debug, Clone)]
@@ -130,6 +151,21 @@ impl Graph {
         self.nodes.keys()
     }
 
+    /// Every statement filed in the graph, in the order the keys were first
+    /// created. This is the logic graph: what the runtime knows, and what it
+    /// will re-evaluate when something changes.
+    pub fn nodes(&self) -> impl Iterator<Item = &GraphNode> {
+        self.nodes.values()
+    }
+
+    pub fn len(&self) -> usize {
+        self.nodes.len()
+    }
+
+    pub fn is_empty(&self) -> bool {
+        self.nodes.is_empty()
+    }
+
     /// The dependents of a node, ordered by the sequence in which they were
     /// declared. A redeclared statement takes a fresh sequence, so it runs last.
     pub fn dependents_in_order(&self, key: &NodeKey) -> Vec<NodeKey> {
```

**File**: `src/main.rs` (modified, +31/-0)
```diff
@@ -4,6 +4,7 @@ use std::process::ExitCode;
 
 use clap::Parser;
 use nucleoid::Runtime;
+use nucleoid::graph::NodeKey;
 
 #[derive(Parser)]
 #[command(
@@ -14,6 +15,10 @@ use nucleoid::Runtime;
 struct Cli {
     /// A source file to run. Without one, statements are read from the terminal.
     file: Option<PathBuf>,
+
+    /// Print the logic graph after running.
+    #[arg(long)]
+    graph: bool,
 }
 
 fn main() -> ExitCode {
@@ -33,6 +38,11 @@ fn main() -> ExitCode {
             match runtime.run(&source) {
                 Ok(value) => {
                     println!("{value}");
+
+                    if cli.graph {
+                        print_graph(&runtime);
+                    }
+
                     report(&mut runtime)
                 }
                 Err(error) => {
@@ -45,6 +55,27 @@ fn main() -> ExitCode {
     }
 }
 
+/// Prints what the runtime is holding: every statement it tracks and what each
+/// one waits on.
+fn print_graph(runtime: &Runtime) {
+    let graph = &runtime.graph;
+    println!("\nlogic graph ({} nodes)", graph.len());
+
+    for node in graph.nodes() {
+        println!("  {} [{}]", node.key, node.kind);
+
+        if !node.dependencies.is_empty() {
+            let names: Vec<String> = node.dependencies.iter().map(NodeKey::to_string).collect();
+            println!("    reads    {}", names.join(", "));
+        }
+
+        if !node.dependents.is_empty() {
+            let names: Vec<String> = node.dependents.iter().map(NodeKey::to_string).collect();
+            println!("    updates  {}", names.join(", "));
+        }
+    }
+}
+
 fn report(runtime: &mut Runtime) -> ExitCode {
     let failures = runtime.take_assertions();
 
```

**File**: `src/parser.rs` (modified, +32/-0)
```diff
@@ -21,16 +21,22 @@ pub fn parse_expression(source: &str) -> Result<Expr> {
     Ok(expression)
 }
 
+/// How deeply expressions and blocks may nest. Recursive descent uses the
+/// stack, so the limit is what keeps a pathological source from overflowing it.
+const MAX_NESTING: usize = 64;
+
 struct Parser {
     tokens: Vec<Token>,
     position: usize,
+    depth: usize,
 }
 
 impl Parser {
     fn new(tokens: Vec<Token>) -> Self {
         Parser {
             tokens,
             position: 0,
+            depth: 0,
         }
     }
 
@@ -181,6 +187,19 @@ impl Parser {
     }
 
     fn statement(&mut self) -> Result<Stmt> {
+        self.depth += 1;
+
+        if self.depth > MAX_NESTING {
+            self.depth -= 1;
+            return Err(Error::syntax("Statements are nested too deeply"));
+        }
+
+        let result = self.statement_inner();
+        self.depth -= 1;
+        result
+    }
+
+    fn statement_inner(&mut self) -> Result<Stmt> {
         match self.peek().clone() {
             Token::Keyword(Keyword::If) => self.if_statement(),
             Token::Keyword(Keyword::For) => self.for_statement(),
@@ -498,6 +517,19 @@ impl Parser {
     }
 
     fn expression(&mut self) -> Result<Expr> {
+        self.depth += 1;
+
+        if self.depth > MAX_NESTING {
+            self.depth -= 1;
+            return Err(Error::syntax("Expressions are nested too deeply"));
+        }
+
+        let result = self.expression_inner();
+        self.depth -= 1;
+        result
+    }
+
+    fn expression_inner(&mut self) -> Result<Expr> {
         let left = self.logical_or()?;
 
         if self.check(&Token::Assign) {
```

**File**: `src/runtime.rs` (modified, +21/-39)
```diff
@@ -70,6 +70,10 @@ pub struct Runtime {
     /// The instances whose class-level rules are being applied, innermost last.
     /// Functions called from a rule see the same instance for `$Class`.
     pub(crate) instances: Vec<ObjectId>,
+    /// Names being removed. While a deletion propagates, reading one of these
+    /// is undefined rather than an error, so dependents settle to null instead
+    /// of aborting the transaction.
+    pub(crate) deleted: IndexSet<NodeKey>,
 }
 
 impl Default for Runtime {
@@ -78,7 +82,10 @@ impl Default for Runtime {
     }
 }
 
-const MAX_DEPTH: usize = 256;
+/// How deep statements, propagation and expression evaluation may nest before
+/// the runtime gives up. A library cannot rely on the caller's stack, so this
+/// is reported as an error rather than overflowing.
+pub(crate) const MAX_DEPTH: usize = 192;
 
 impl Runtime {
     pub fn new() -> Self {
@@ -94,6 +101,7 @@ impl Runtime {
             imperative: 0,
             undefined_read: false,
             instances: Vec::new(),
+            deleted: IndexSet::new(),
         }
     }
 
@@ -1205,7 +1213,7 @@ impl Runtime {
                 self.transaction.record_variable(name, Some(value));
                 self.state.variables.shift_remove(name);
                 self.remove_node(&key);
-                self.propagate_removed(&key)?;
+                self.cascade_removal(&key)?;
 
                 Ok(Value::Bool(true))
             }
@@ -1237,7 +1245,7 @@ impl Runtime {
 
                 let key = NodeKey::property(&id, property);
                 self.remove_node(&key);
-                self.propagate_removed(&key)?;
+                self.cascade_removal(&key)?;
 
                 Ok(Value::Bool(true))
             }
@@ -1260,6 +1268,8 @@ impl Runtime {
                     self.state.variables.shift_remove(id.as_str());
                 }
 
+                self.cascade_removal(&key)?;
+
                 Ok(Value::Bool(true))
             }
 
@@ -1355,42 +1365,14 @@ impl Runtime {
         }
     }
 
-    /// After a deletion, dependents fall back to null.
-    fn propagate_removed(&mut self, key: &NodeKey) -> Result<()> {
-        let dependents: Vec<NodeKey> = self
-            .graph
-            .keys()
-            .filter(|candidate| {
-                self.graph
-                    .get(candidate)
-                    .map(|node| node.dependencies.contains(key))
-                    .unwrap_or(false)
-            })
-            .cloned()
-            .collect();
-
-        for dependent in dependents {
-            let Some(node) = self.graph.get(&dependent).cloned() else {
-                continue;
-            };
-
-            match node.kind {
-                NodeKind::Variable => {
-                    self.set_variable(dependent.as_str(), Value::Null);
-                }
-                NodeKind::Property => {
-                    if let Some((object, property)) = dependent.split_last() {
-                        let object = ObjectId::from(object);
-                        if self.state.objects.contains_key(&object) {
-                            self.set_property(&object, property, Value::Null);
-                        }
-                    }
-                }
-                _ => {}
-            }
-        }
-
-        Ok(())
+    /// Re-runs everything that read what was just removed. Each dependent finds
+    /// the name undefined, settles to null, and passes that on to its own
+    /// dependents, so a whole chain clears.
+    fn cascade_removal(&mut self, key: &NodeKey) -> Result<()> {
+        self.deleted.insert(key.clone());
+        let result = self.propagate(key);
+        self.deleted.shift_remove(key);
+        result
     }
 }
 
```

---

### Incident Patch 9: `7c14002e` (2026-08-01)
**Commit Message**: Add Rust typing and open source guidelines

Adds guidance on porting ref/'s structure with concrete Rust types (enums, structs, newtypes, typed errors), preferring well-maintained crates over hand-rolled infrastructure, and open source conventions (cargo fmt, clippy, Cargo.toml metadata, semantic versioning).

**File**: `CLAUDE.md` (modified, +8/-0)
```diff
@@ -19,6 +19,14 @@ Build a Rust implementation of Nucleoid. The crate is at the repository root (`C
 
 Use `ref/` for **how** the runtime is built — dependency graph, scope chain, stack, transactions, statement node types. Do not use it for **what** the language does: its error types and built-in names diverge from the spec deliberately.
 
+Port `ref/`'s structure, not its dynamism. `ref/` is untyped JavaScript; the Rust crate must model the same concepts with concrete types — enums for closed sets (node kinds, runtime values, error kinds), dedicated structs for graph nodes, scopes, stack frames and transactions, newtypes for identifiers and node keys, and a typed error enum returned through `Result`. No stringly-typed maps or dynamic catch-all value as the internal representation.
+
+Prefer popular, well-maintained crates over hand-rolled infrastructure — lexing/parsing, error types and diagnostics, graph storage, ordered maps, numerics, serialization, the CLI. Pick the mainstream choice for each slot, one crate per slot, and note why when adding it to `Cargo.toml`. Nucleoid's own runtime semantics stay hand-written, and third-party representations are wrapped in the crate's own types rather than leaking through the interpreter.
+
+## Open source
+
+Nucleoid is published as open source under Apache-2.0, so everything is public-facing and follows mainstream Rust community practice rather than local invention: default `cargo fmt`, `cargo clippy` clean with warnings denied in CI, library in `src/lib.rs` with a thin binary, integration tests in `tests/`, examples in `examples/`, complete `Cargo.toml` metadata (`description`, `license`, `repository`, `readme`, `keywords`, `categories`, `rust-version`) before publishing, and semantic versioning on the public API. When a convention exists, default to it and flag any deliberate divergence.
+
 `nucleoid.spec.md` is authoritative. Where `synth/`, `docs/` or `ref/` disagrees with it, the main reference wins.
 
 `nucleoid.spec.md`, `synth/`, `docs/` and the Rust crate (`Cargo.toml`, `src/`) must stay in sync. Every change to one must be propagated to the others as part of the same change.
```

**File**: `Cargo.lock` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+# This file is automatically @generated by Cargo.
+# It is not intended for manual editing.
+version = 4
+
+[[package]]
+name = "nucleoid"
+version = "0.1.0"
```

---

### Incident Patch 10: `eb37d90c` (2026-07-31)
**Commit Message**: Align spec examples and freeze ref guidance

Updates the language reference and synthesized specs to better match current syntax/style by replacing `elif` with `else if` in examples, removing repeated project metadata headers, and tightening several scenario examples (e.g., typed undefined declaration, multi-branch status/acceptance rules, and wording fixes like `renew`). It also adds explicit guidance in `CLAUDE.md` that `ref/` is read-only reference material and must not be modified.

**File**: `CLAUDE.md` (modified, +2/-0)
```diff
@@ -12,3 +12,5 @@ However, new syntax may be introduced where it is needed to achieve that goal. T
 
 - `nucleoid.spec.md` — runtime behaviours
 - `ref/` — technical reference (the archived JS implementation)
+
+`ref/` is **frozen**. Read it for reference, never modify it.
```

**File**: `nucleoid.spec.md` (modified, +23/-24)
```diff
@@ -1,8 +1,5 @@
 # Nucleoid Language Reference
 
-Project: Nucleoid is a Logic Programming Language for LLMs
-Syntax: Minimum tokenized syntax with flexible grammar, which is a superset of Python, JavaScript/TypeScript, Kotlin, Go, Rust, Java, C# and C/C++.
-
 ```
 
 # Nucleoid runs a statement in the state
@@ -334,7 +331,7 @@ assert(condition, false)
 class Device:
     pass
 
-# Any device's renewal is the device's creation time plus 604800000
+# Any device's renew is the device's creation time plus 604800000
 $Device.renew = $Device.created + 604800000
 
 # device is a Device whose creation time is now
@@ -733,7 +730,7 @@ mass = 10
 # else if g is greater than 3, then weight is mars times mass
 if g > 9:
     weight = earth * mass
-elif g > 3:
+else if g > 3:
     weight = mars * mass
 
 # g is 5
@@ -761,7 +758,7 @@ point = 1
 # else score is fraction times point
 if fraction > 1:
     score = fraction * point * 3
-elif fraction > 0:
+else if fraction > 0:
     score = fraction * point * 2
 else:
     score = fraction * point
@@ -1266,10 +1263,6 @@ assert(depth, 161.8)
 class Account:
     pass
 
-# There is a Balance type
-class Balance:
-    pass
-
 # There is a Currency type
 class Currency:
     pass
@@ -1730,7 +1723,7 @@ try:
     $Chart.plot = Plot()
 catch error:
     assert(error, ReferenceError("Plot is not defined"))
-    
+
 ---
 
 # Nucleoid creates a property assignment before declaration
@@ -2310,7 +2303,7 @@ rate = 22
 # else taxpayer1's tax is taxpayer1's income times rate divided by 100
 if taxpayer1.member > 4:
     taxpayer1.tax = taxpayer1.income * rate / 100 - 2000
-elif taxpayer1.member > 2:
+else if taxpayer1.member > 2:
     taxpayer1.tax = taxpayer1.income * rate / 100 - 1000
 else:
     taxpayer1.tax = taxpayer1.income * rate / 100
@@ -2847,8 +2840,8 @@ assert(alkalis.pop(), element1)
 # Nucleoid rejects a variable declaration without definition
 
 try:
-    # a is declared but not defined
-    a
+    # a is declared as a number but not defined
+    a: int
 catch error:
     assert(error, ReferenceError("Missing definition"))
 
@@ -3468,15 +3461,18 @@ assert(concentration1.formula, "(c1V1+c2V2+c3V3)/(V1+V2+V3)")
 class Storage:
     pass
 
-# normal is "NORMAL", and low is "LOW"
-normal = "NORMAL"; low = "LOW"
+# normal is "NORMAL", low is "LOW", and empty is "EMPTY"
+normal = "NORMAL"; low = "LOW"; empty = "EMPTY"
 
 # If any storage's capacity is greater than 25, then the storage's status is normal,
-# else the storage's status is low
+# else if the storage's capacity is greater than 0, then the storage's status is low,
+# else the storage's status is empty
 if $Storage.capacity > 25:
     $Storage.status = normal
-else:
+else if $Storage.capacity > 0:
     $Storage.status = low
+else:
+    $Storage.status = empty
 
 # storage1 is a Storage
 storage1 = Storage()
@@ -3499,17 +3495,20 @@ assert(storage1.status, "L")
 class Registration:
     pass
 
-# yes is "YES", and no is "NO"
-yes = "YES"; no = "NO"
+# yes is "YES", pending is "PENDING", and no is "NO"
+yes = "YES"; pending = "PENDING"; no = "NO"
 
 # registration1 is a Registration whose available is 0
 registration1 = Registration()
 registration1.available = 0
 
-# If any registration's available is greater than 0, then the registration's accepted is yes,
+# If any registration's available is greater than 10, then the registration's accepted is yes,
+# else if the registration's available is greater than 0, then the registration's accepted is pending,
 # else the registration's accepted is no
-if $Registration.available > 0:
+if $Registration.available > 10:
     $Registration.accepted = yes
+else if $Registration.available > 0:
+    $Registration.accepted = pending
 else:
     $Registration.accepted = no
 
@@ -3535,7 +3534,7 @@ class Capacity:
 # else the capacity's total is the capacity's available plus the capacity's spare times 3
 if $Capacity.spare / $Capacity.available > 0.5:
     $Capacity.total = $Capacity.available + $Capacity.spare
-elif $Capacity.spare / $Capacity.available > 0.1:
+else if $Capacity.spare / $Capacity.available > 0.1:
     $Capacity.total = $Capacity.available + $Capacity.spare * 2
 else:
     $Capacity.total = $Capacity.available + $Capacity.spare * 3
@@ -3576,7 +3575,7 @@ shape1.y = 6
 # else the shape's area is the shape's x times the shape's y
 if $Shape.type == "SQUARE":
     $Shape.area = Math.pow($Shape.x, 2)
-elif $Shape.type == "TRIANGLE":
+else if $Shape.type == "TRIANGLE":
     $Shape.area = $Shape.x * $Shape.y / 2
 else:
     $Shape.area = $Shape.x * $Shape.y
```

**File**: `synth/nucleoid.spec.synth.01.md` (modified, +3/-7)
```diff
@@ -1,9 +1,5 @@
 # Nucleoid Language Reference - Synthesized Use Cases 01
 
-Project: Nucleoid is a Logic Programming Language for LLMs
-Syntax: Minimum tokenized syntax with flexible grammar, which is a superset of Python, JavaScript/TypeScript, Kotlin, Go, Rust, Java, C# and C/C++.
-Source: Synthesized from nucleoid.spec.md, covering behavior combinations not present in the base specification.
-
 ```
 
 # Nucleoid updates a chain of dependent variables
@@ -589,7 +585,7 @@ grade3.score = 60
 # else the grade's letter is "C"
 if $Grade.score > 89:
     $Grade.letter = "A"
-elif $Grade.score > 79:
+else if $Grade.score > 79:
     $Grade.letter = "B"
 else:
     $Grade.letter = "C"
@@ -729,7 +725,7 @@ humidity = 80
 # else advice is "NORMAL"
 if temperature > 35:
     advice = "HEAT"
-elif humidity > 70:
+else if humidity > 70:
     advice = "HUMID"
 else:
     advice = "NORMAL"
@@ -1045,7 +1041,7 @@ package3 = Package(1)
 for package of Package:
     if package.weight > 20:
         package.tier = "HEAVY"
-    elif package.weight > 5:
+    else if package.weight > 5:
         package.tier = "MEDIUM"
     else:
         package.tier = "LIGHT"
```

**File**: `synth/nucleoid.spec.synth.02.md` (modified, +1/-5)
```diff
@@ -1,9 +1,5 @@
 # Nucleoid Language Reference - Synthesized Use Cases 02
 
-Project: Nucleoid is a Logic Programming Language for LLMs
-Syntax: Minimum tokenized syntax with flexible grammar, which is a superset of Python, JavaScript/TypeScript, Kotlin, Go, Rust, Java, C# and C/C++.
-Source: Synthesized from nucleoid.spec.md, covering behavior combinations not present in the base specification or in nucleoid.spec.synth.01.md.
-
 ```
 
 # Nucleoid deletes a class-level property assignment
@@ -144,7 +140,7 @@ assert(result, 720)
 def sign(n):
     if n > 0:
         return "POSITIVE"
-    elif n < 0:
+    else if n < 0:
         return "NEGATIVE"
     return "ZERO"
 
```

---

### Incident Patch 11: `574a4d1b` (2026-07-31)
**Commit Message**: Add CLAUDE.md project guidance

Introduce a new CLAUDE.md with the core Nucleoid project context: language vision, grammar design goal, and key references (`nucleoid.spec.md` and `ref/`) for implementation guidance.

**File**: `CLAUDE.md` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+# Nucleoid
+
+Nucleoid is a next-gen Logic Programming Language focused on LLMs.
+
+## Goal
+
+Design a new grammar with minimum tokenized syntax that stays flexible — a superset of Python, JavaScript/TypeScript, Kotlin, Go, Rust, Java, C# and C/C++.
+
+However, new syntax may be introduced where it is needed to achieve that goal. The superset is a starting point, not a hard constraint.
+
+## References
+
+- `nucleoid.spec.md` — runtime behaviours
+- `ref/` — technical reference (the archived JS implementation)
```

---

### Incident Patch 12: `3966371b` (2026-07-31)
**Commit Message**: Fix spec errors and inconsistencies

Correct multiple issues in nucleoid.spec.md:
- Fix Shape class constructor syntax (remove `self`)
- Fix comment typo: 'prevents' -> 'preserves'
- Replace `classes` with `Class` in assert calls
- Fix variable name typo: `person1` -> `student1`
- Fix missing colon in `multiply` function definition
- Add missing `---` separators
- Fix error types: ReferenceError -> TypeError for delete/circular dependency
- Fix error message wording for 'value' property errors
- Fix `schedule1.run` expected value to `null`
- Fix SyntaxError -> ReferenceError for 'Missing definition'

**File**: `nucleoid.spec.md` (modified, +20/-16)
```diff
@@ -83,7 +83,7 @@ catch error:
 
 # There is a Shape type,
 # which has a type as a string
-class Shape(self, type: str):
+class Shape(type: str):
     this.type = type
 
 # shape1 is a Shape whose type is "Square"
@@ -124,7 +124,7 @@ assert(Student["user0"], { "id": "user0" })
 
 ---
 
-# Nucleoid prevents class and object lists when a class is updated
+# Nucleoid preserves class and object lists when a class is updated
 
 # There is a User type
 class User:
@@ -133,20 +133,20 @@ class User:
 # There is a User
 User()
 
-assert(classes.length, 1)
+assert(Class.length, 1)
 assert(User.length, 1)
 
 # There is a User type
 class User:
     pass
 
-assert(classes.length, 1)
+assert(Class.length, 1)
 assert(User.length, 1)
 
 # There is a User
 User()
 
-assert(classes.length, 1)
+assert(Class.length, 1)
 assert(User.length, 2)
 
 ---
@@ -183,11 +183,11 @@ class Student: Person
         this.school = school
 
 # student1 is a Student,
-# whose name is "Joe"
+# whose name is "Emma"
 # and whose school is "Riverside High".
 student1 = Student("Emma", "Riverside High")
 
-assert(person1, { "id": "student1", "name": "Emma", "school": "Riverside High" })
+assert(student1, { "id": "student1", "name": "Emma", "school": "Riverside High" })
 
 ---
 
@@ -415,7 +415,7 @@ assert(distance1.startingPoint.print, null)
 # Nucleoid calls function in an assignment
 
 # multiply returns the product of two factors
-def multiply(first_factor, second_factor)
+def multiply(first_factor, second_factor):
     product = first_factor * second_factor
     return product
 
@@ -647,6 +647,8 @@ user0 = User()
 
 assert(user0.name, "TEST")
 
+---
+
 # Nucleoid assigns a variable declaratively
 
 # a is 1
@@ -913,7 +915,7 @@ schedule1.script = null
 # schedule1's run is schedule1's expression plus " " plus schedule1's script
 schedule1.run = schedule1.expression + " " + schedule1.script
 
-assert(schedule1.run, "0 */2 * * * null")
+assert(schedule1.run, null)
 
 ---
 
@@ -1060,7 +1062,7 @@ try:
     # number1 is number2 times 10
     number1 = number2 * 10
 catch error:
-    assert(error, ReferenceError("Circular Dependency"))
+    assert(error, TypeError("Circular Dependency"))
 
 ---
 
@@ -1945,7 +1947,7 @@ try:
     # value's value is 2147483647
     value.value = 2147483647
 catch error:
-    assert(error, TypeError("Cannot use 'value' as a name"))
+    assert(error, TypeError("Cannot use 'value' as a property"))
 
 ---
 
@@ -2047,7 +2049,7 @@ assert(interest1.annual, 0)
 
 ---
 
-# Nucleoid rejects value as a name in a block
+# Nucleoid rejects value as a property name in a block
 
 # There is an Alarm type
 class Alarm:
@@ -2061,7 +2063,7 @@ try:
         value.value = "22:00"
     }
 catch error:
-    assert(error, TypeError("Cannot use 'value' in local"))
+    assert(error, TypeError("Cannot use 'value' as a property"))
 
 ---
 
@@ -2446,7 +2448,7 @@ try:
     # channel1 is deleted
     delete channel1
 catch error:
-    assert(error, ReferenceError("Cannot delete object 'channel1'"))
+    assert(error, TypeError("Cannot delete object 'channel1'"))
 
 assert(channel1.frequency, 440)
 
@@ -2480,7 +2482,7 @@ try:
     # shape1 is deleted
     delete shape1
 catch error:
-    assert(error, ReferenceError("Cannot delete object 'shape1'"))
+    assert(error, TypeError("Cannot delete object 'shape1'"))
 
 # shape1's type is deleted
 delete shape1.type
@@ -2550,6 +2552,8 @@ item1.sku = "0000002"
 
 assert(item1.custom, "US0000002")
 
+---
+
 # Nucleoid runs a nested block statement of property
 
 # There is a Figure type
@@ -2846,7 +2850,7 @@ try:
     # a is declared but not defined
     a
 catch error:
-    assert(error, SyntaxError("Missing definition"))
+    assert(error, ReferenceError("Missing definition"))
 
 ---
 
```

---

### Incident Patch 13: `d1b18504` (2024-09-09)
**Commit Message**: Merge pull request #61 from NucleoidAI/dependabot/npm_and_yarn/braces-3.0.3

Bump braces from 3.0.2 to 3.0.3

**File**: `package-lock.json` (modified, +14/-14)
```diff
@@ -422,12 +422,12 @@
       }
     },
     "node_modules/braces": {
-      "version": "3.0.2",
-      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.2.tgz",
-      "integrity": "sha512-b8um+L1RzM3WDSzvhm6gIz1yfTbBt6YTlcEKAvsmqCZZFw46z626lVj9j1yEPW33H5H+lBQpZMP1k8l+78Ha0A==",
+      "version": "3.0.3",
+      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
+      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
       "dev": true,
       "dependencies": {
-        "fill-range": "^7.0.1"
+        "fill-range": "^7.1.1"
       },
       "engines": {
         "node": ">=8"
@@ -1224,9 +1224,9 @@
       }
     },
     "node_modules/fill-range": {
-      "version": "7.0.1",
-      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.0.1.tgz",
-      "integrity": "sha512-qOo9F+dMUmC2Lcb4BbVvnKJxTPjCm+RRpe4gDuGrzkL7mEVl/djYSu2OdQ2Pa302N4oqkSg9ir6jaLWJ2USVpQ==",
+      "version": "7.1.1",
+      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
+      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
       "dev": true,
       "dependencies": {
         "to-regex-range": "^5.0.1"
@@ -3404,12 +3404,12 @@
       }
     },
     "braces": {
-      "version": "3.0.2",
-      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.2.tgz",
-      "integrity": "sha512-b8um+L1RzM3WDSzvhm6gIz1yfTbBt6YTlcEKAvsmqCZZFw46z626lVj9j1yEPW33H5H+lBQpZMP1k8l+78Ha0A==",
+      "version": "3.0.3",
+      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
+      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
       "dev": true,
       "requires": {
-        "fill-range": "^7.0.1"
+        "fill-range": "^7.1.1"
       }
     },
     "browser-stdout": {
@@ -3986,9 +3986,9 @@
       }
     },
     "fill-range": {
-      "version": "7.0.1",
-      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.0.1.tgz",
-      "integrity": "sha512-qOo9F+dMUmC2Lcb4BbVvnKJxTPjCm+RRpe4gDuGrzkL7mEVl/djYSu2OdQ2Pa302N4oqkSg9ir6jaLWJ2USVpQ==",
+      "version": "7.1.1",
+      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
+      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
       "dev": true,
       "requires": {
         "to-regex-range": "^5.0.1"
```

---

### Incident Patch 14: `79093b45` (2024-09-09)
**Commit Message**: Bump braces from 3.0.2 to 3.0.3

Bumps [braces](https://github.com/micromatch/braces) from 3.0.2 to 3.0.3.
- [Changelog](https://github.com/micromatch/braces/blob/master/CHANGELOG.md)
- [Commits](https://github.com/micromatch/braces/compare/3.0.2...3.0.3)

---
updated-dependencies:
- dependency-name: braces
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `package-lock.json` (modified, +14/-14)
```diff
@@ -422,12 +422,12 @@
       }
     },
     "node_modules/braces": {
-      "version": "3.0.2",
-      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.2.tgz",
-      "integrity": "sha512-b8um+L1RzM3WDSzvhm6gIz1yfTbBt6YTlcEKAvsmqCZZFw46z626lVj9j1yEPW33H5H+lBQpZMP1k8l+78Ha0A==",
+      "version": "3.0.3",
+      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
+      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
       "dev": true,
       "dependencies": {
-        "fill-range": "^7.0.1"
+        "fill-range": "^7.1.1"
       },
       "engines": {
         "node": ">=8"
@@ -1224,9 +1224,9 @@
       }
     },
     "node_modules/fill-range": {
-      "version": "7.0.1",
-      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.0.1.tgz",
-      "integrity": "sha512-qOo9F+dMUmC2Lcb4BbVvnKJxTPjCm+RRpe4gDuGrzkL7mEVl/djYSu2OdQ2Pa302N4oqkSg9ir6jaLWJ2USVpQ==",
+      "version": "7.1.1",
+      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
+      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
       "dev": true,
       "dependencies": {
         "to-regex-range": "^5.0.1"
@@ -3404,12 +3404,12 @@
       }
     },
     "braces": {
-      "version": "3.0.2",
-      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.2.tgz",
-      "integrity": "sha512-b8um+L1RzM3WDSzvhm6gIz1yfTbBt6YTlcEKAvsmqCZZFw46z626lVj9j1yEPW33H5H+lBQpZMP1k8l+78Ha0A==",
+      "version": "3.0.3",
+      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
+      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
       "dev": true,
       "requires": {
-        "fill-range": "^7.0.1"
+        "fill-range": "^7.1.1"
       }
     },
     "browser-stdout": {
@@ -3986,9 +3986,9 @@
       }
     },
     "fill-range": {
-      "version": "7.0.1",
-      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.0.1.tgz",
-      "integrity": "sha512-qOo9F+dMUmC2Lcb4BbVvnKJxTPjCm+RRpe4gDuGrzkL7mEVl/djYSu2OdQ2Pa302N4oqkSg9ir6jaLWJ2USVpQ==",
+      "version": "7.1.1",
+      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
+      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
       "dev": true,
       "requires": {
         "to-regex-range": "^5.0.1"
```

---

### Incident Patch 15: `0120f02d` (2024-08-04)
**Commit Message**: Fix width issue in multi lang section

**File**: `README.md` (modified, +1/-3)
```diff
@@ -67,9 +67,7 @@ In Nucleoid's paradigm, there is no segregation between logic and data; instead,
     </tr>
     <tr>
       <td colspan="3">
-        The declarative structure in the runtime makes it possible
-        <br/>
-        to provide multiple language support through JIT compiler.
+        The declarative structure in the runtime makes it possible to provide multiple language support through JIT compiler.
       </td>
     </tr>
   </table>
```

#### Recent Merged Pull Requests:
- **PR #70** (2025-01-09): Variable Value in Python (@canmingir)
- **PR #69** (closed): add Python version's first test case (@gitansh-garg)
- **PR #68** (2024-12-19): Bump the npm_and_yarn group across 2 directories with 3 updates (@dependabot[bot])
- **PR #67** (closed): Bump path-to-regexp and express in /arc (@dependabot[bot])
- **PR #66** (closed): Bump cookie and express (@dependabot[bot])
- **PR #65** (2024-09-16): Bump path-to-regexp and express (@dependabot[bot])
- **PR #64** (2024-09-09): Bump axios from 1.6.0 to 1.7.4 (@dependabot[bot])
- **PR #61** (2024-09-09): Bump braces from 3.0.2 to 3.0.3 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
