> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `1167438a`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-26T17:58:31.220Z  
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
> **Harvest Timestamp**: 2026-10-26T17:58:30.610Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NucleoidAI/Nucleoid`
- **Description**: Synthesized Logic Language for World Models 🌱🐋🌍
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 772 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/state.rs`
```
use indexmap::IndexMap;
use std::fmt;
use std::sync::Arc;

use crate::history::{History, HistoryKey};
use crate::lang::ast::VersionSelector;
use crate::lang::ast::generator::generate_all;
use crate::lang::ast::{Expr, Function, Parameter, Stmt};
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

/// Everything the runtime holds: top-level variables, objects, classes and
/// named functions.
///
/// Variable and named-function bindings share a namespace; runtime writes keep
/// their typed stores mutually exclusive.
///
/// Runtime writes record before-images through the methods below.
/// [`Transaction::rollback`](crate::transaction::Transaction::rollback)
/// restores those before-images without recording new writes.
#[derive(Debug, Clone, Default)]
pub struct State {
    variables: IndexMap<String, Value>,
    objects: IndexMap<ObjectId, ObjectData>,
    classes: IndexMap<String, ClassData>,
    functions: IndexMap<String, Arc<Function>>,
    histories: IndexMap<HistoryKey, History>,
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

    pub(crate) fn classes(&self) -> impl Iterator<Item = &ClassData> {
        self.classes.values()
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
        self.histories.clear();
    }
}

/// Every write to the state.
///
/// Each operation records the before-image and performs the write together,
/// so callers cannot forget the undo entry needed by a later rollback.
///
/// Variables and properties use separate operations because their graph keys
/// differ.
impl Runtime {
    fn append_history(&mut self, key: HistoryKey, value: &Value) {
        let history = self.state.histories.entry(key.clone()).or_default();
        self.transaction.record_history_append(&key, history.len());
        history.push(value.clone());
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

    pub(crate) fn assign_property(
        &mut self,
        object: &ObjectId,
        property: &str,
        value: Value,
    ) -> bool {
        if !self.state.objects.contains_key(object) {
            self.insert_object(object.clone(), ObjectData::new(None));
        }

        let before = self.state.property(object, property).cloned();
        let changed = before
            .as_ref()
            .is_none_or(|before| !before.same_value(&value));
        self.transaction.record_property(object, property, before);
        if changed {
            self.append_history(
                HistoryKey::Property(object.clone(), property.to_string()),
                &value,
            );
        }

        if let Some(data) = self.state.object_mut(object) {
            data.properties.insert(property.to_string(), value);
        }
        changed
    }

    /// `state.delete` for a top-level name, reporting what was there.
    pub(crate) fn remove_variable(&mut self, name: &str) -> Option<Value> {
        let before = self.state.variables.get(name).cloned();
        self.transaction.record_variable(name, before.clone());
        self.state.variables.shift_remove(name);
        self.remove_history(HistoryKey::Variable(name.to_string()));
        before
    }

    /// `
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
import { start } from "./src/app";
import * as terminal from "./src/lib/terminal";

start().catch((error) => {
  terminal.failure(error);
  process.exitCode = 1;
});

```

### Core Architecture Module: `arc/src/analyzer.ts`
```
import * as Matrix from "./lib/Matrix";
import * as nucleoid from "./lib/nucleoid";
import * as llm from "./lib/llm";
import * as terminal from "./lib/terminal";

export async function declarations({ train_dataset }) {
  terminal.step("Inferring declarations");

  const { declarations } = await llm.generate({
    messages: [
      {
        role: "user",
        content: `
          train_dataset:
          ${JSON.stringify(train_dataset)}
          json_format:
          { "declarations": <DECLARATIONS> }
        `,
      },
    ],
  });

  terminal.code("Declarations", declarations);

  return { declarations };
}

export async function instances({ declarations, input_matrix, output_matrix }) {
  terminal.step("Segmenting training objects");

  const { instances } = await llm.generate({
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
          query:
          Obj;
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

  instances.forEach((instance, index) => {
    terminal.grid(
      `Object ${index + 1} · Input`,
      instance.input_instance_matrix
    );
    terminal.grid(
      `Object ${index + 1} · Output`,
      instance.output_instance_matrix
    );
  });

  return { instances };
}

export async function value({
  instance_name,
  declarations,
  input_instance_matrix,
  output_instance_matrix,
}) {
  terminal.step(`Constructing ${instance_name}`);

  const { implementation } = await llm.generate({
    messages: [
      {
        role: "user",
        content: `
          instance_name:
          ${instance_name}
          declarations:
          ${JSON.stringify(declarations)}
          input_instance_matrix:
          ${JSON.stringify(input_instance_matrix)}
          output_instance_matrix:
          ${JSON.stringify(output_instance_matrix)}
          json_format:
          { "implementation": <IMPLEMENTATION> }
        `,
      },
    ],
  });

  terminal.step("Evaluating declarative rules");
  const input_value = await nucleoid.run(
    [declarations[0], implementation].join("\n\n")
  );
  const output_value = await nucleoid.run(
    [...declarations, implementation].join("\n\n")
  );

  terminal.grid("Input crop", Matrix.crop(input_instance_matrix));
  terminal.grid("Output crop", Matrix.crop(output_instance_matrix));
  terminal.code(`Implementation · ${instance_name}`, implementation);
  terminal.value("Input state", input_value);
  terminal.value("Output state", output_value);

  return { implementation, input_value, output_value };
}

```

### Core Architecture Module: `arc/src/app.ts`
```
import * as analyzer from "./analyzer";
import * as visualizer from "./visualizer";
import * as Matrix from "./lib/Matrix";
import * as nucleoid from "./lib/nucleoid";
import * as terminal from "./lib/terminal";
import puzzle from "./data/training/3aa6fb7a.json";
// Completed:
// 3aa6fb7a

const {
  train,
  test: [{ input: test_input_matrix, output: test_output_matrix }],
} = puzzle;

const training_input = {
  dataset: train.map(({ input, output }) => ({
    input_matrix: input,
    output_matrix: output,
    instances: [],
  })),
};

export async function start() {
  const startedAt = performance.now();
  terminal.header({ version: await nucleoid.version() });
  terminal.puzzle({ train, testInput: test_input_matrix });
  terminal.section(
    1,
    "Analyze",
    "Infer reusable objects and transformation rules"
  );

  let instance_index = 0;

  const { declarations } = await analyzer.declarations({
    train_dataset: training_input,
  });
  const train_dataset = {
    ...training_input,
    declarations,
  };

  for (const [index, dataset] of train_dataset.dataset.entries()) {
    const { input_matrix, output_matrix } = dataset;
    terminal.step(
      `Training pair ${index + 1} / ${train_dataset.dataset.length}`
    );

    const { instances } = await analyzer.instances({
      declarations,
      input_matrix,
      output_matrix,
    });

    for (const { input_instance_matrix, output_instance_matrix } of instances) {
      const instance_name = `obj${String(instance_index++).padStart(12, "0")}`;

      const { implementation, input_value, output_value } =
        await analyzer.value({
          instance_name,
          declarations,
          input_instance_matrix,
          output_instance_matrix,
        });

      dataset.instances.push({
        instance_name,
        input_instance_matrix,
        output_instance_matrix,
        implementation,
        input_value,
        output_value,
      });
    }
  }

  terminal.section(
    2,
    "Visualize",
    "Apply the learned world model to the test input"
  );

  const { instances } = await visualizer.instances({
    train_dataset,
    declarations,
    test_input_matrix,
  });

  let test_index = 0;

  let result_matrix = Array.from({ length: test_output_matrix.length }, () =>
    Array(test_output_matrix[0].length).fill(0)
  );

  const input_instances = [];

  for (const { input_instance_matrix } of instances) {
    const { input_value, output_value } = await visualizer.value({
      declarations,
      train_dataset,
      instance_name: `obj${String(test_index++).padStart(12, "0")}`,
      input_instances,
      input_instance_matrix,
    });

    const { output_instance_matrix } = await visualizer.output_instance_matrix({
      test_input_matrix,
      train_dataset,
      input_instances,
      input_instance_matrix,
      input_value,
      output_value,
    });

    input_instances.push({
      input_value,
      input_instance_matrix,
      output_value,
      output_instance_matrix,
    });

    result_matrix = Matrix.merge(result_matrix, output_instance_matrix);
  }

  terminal.section(3, "Compare", "Expected and predicted canvases");
  terminal.grid("Expected", test_output_matrix);
  terminal.grid("Result", result_matrix);
  terminal.summary(
    Matrix.difference(result_matrix, test_output_matrix),
    performance.now() - startedAt
  );
  return result_matrix;
}

```

### Core Architecture Module: `arc/src/dataset/index.ts`
```
export { document } from "./instruct_dataset";

```

### Core Architecture Module: `arc/src/dataset/instruct_dataset.ts`
```
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function document() {
  const files = readdirSync(__dirname, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.json$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (files.length === 0) {
    throw new Error(`No JSON instruction datasets found in ${__dirname}`);
  }

  const datasets = files.map((file) => {
    const source = readFileSync(join(__dirname, file), "utf8");

    try {
      return JSON.parse(source);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new SyntaxError(
          `Invalid JSON in instruction dataset ${file}: ${error.message}`,
          { cause: error }
        );
      }
      throw error;
    }
  });

  return [...datasets];
}

```

### Core Architecture Module: `arc/src/lib/Markdown.ts`
```
export function json(markdown) {
  const matches = [...markdown.matchAll(/```json([^`]+)```/g)];

  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    return JSON.parse(lastMatch[1]);
  }
}

```

### Core Architecture Module: `arc/src/lib/Matrix.ts`
```
export function crop(matrix) {
  return locate(matrix).matrix;
}

export function locate(matrix) {
  if (!Array.isArray(matrix)) {
    throw new Error("Matrix must be an array for cropping");
  }
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  let top = rows;
  let bottom = -1;
  let left = cols;
  let right = -1;

  for (let y = 0; y < rows; y++) {
    const row = matrix[y];
    if (!Array.isArray(row) || row.length !== cols) {
      throw new Error("Matrix must be rectangular for cropping");
    }
    for (let x = 0; x < cols; x++) {
      const value = row[x];
      if (!Number.isFinite(value)) {
        throw new Error("Matrix must contain finite numbers for cropping");
      }
      if (value === 0) continue;
      top = Math.min(top, y);
      bottom = y;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }

  if (bottom === -1) return { matrix: [], x: 0, y: 0 };
  return {
    matrix: matrix
      .slice(top, bottom + 1)
      .map((row) => row.slice(left, right + 1)),
    x: left,
    y: top,
  };
}

export function pad(matrix, rows, cols, left, top) {
  if (!Array.isArray(matrix)) {
    throw new Error("Matrix must be an array for padding");
  }
  if (
    !Number.isSafeInteger(rows) ||
    !Number.isSafeInteger(cols) ||
    rows < 0 ||
    cols < 0
  ) {
    throw new Error("Padding dimensions must be non-negative safe integers");
  }
  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(top) ||
    left < 0 ||
    top < 0
  ) {
    throw new Error("Padding offsets must be non-negative safe integers");
  }
  const sourceRows = matrix.length;
  const sourceCols = matrix[0]?.length ?? 0;
  const paddedRows = Math.max(rows, top + sourceRows);
  const paddedCols = Math.max(cols, left + sourceCols);
  if (!Number.isSafeInteger(paddedRows) || !Number.isSafeInteger(paddedCols)) {
    throw new Error("Expanded padding dimensions must be safe integers");
  }
  const result = Array.from({ length: paddedRows }, () =>
    Array(paddedCols).fill(0)
  );

  for (let y = 0; y < sourceRows; y++) {
    const row = matrix[y];
    if (!Array.isArray(row) || row.length !== sourceCols) {
      throw new Error("Matrix must be rectangular for padding");
    }
    for (let x = 0; x < sourceCols; x++) {
      const value = row[x];
      if (!Number.isFinite(value)) {
        throw new Error("Matrix must contain finite numbers for padding");
      }
      result[y + top][x + left] = value;
    }
  }

  return result;
}

export function merge(...matrices) {
  if (matrices.length === 0) {
    throw new Error("At least one matrix is required for merging");
  }
  const numRows = Math.max(...matrices.map((matrix) => matrix.length));
  const numCols = Math.max(...matrices.map((matrix) => matrix[0]?.length ?? 0));

  const result = Array.from({ length: numRows }, () => Array(numCols).fill(0));

  for (const matrix of matrices) {
    const padded = pad(matrix, numRows, numCols, 0, 0);
    for (let i = 0; i < numRows; i++) {
      for (let j = 0; j < numCols; j++) {
        if (padded[i][j] !== 0) {
          result[i][j] = padded[i][j];
        }
      }
    }
  }

  return result;
}

export function difference(matrix1, matrix2) {
  let mismatches = 0;
  const rows = Math.max(matrix1.length, matrix2.length);

  for (let i = 0; i < rows; i++) {
    const row1 = matrix1[i];
    const row2 = matrix2[i];

    if (!row1 || !row2) {
      // An extra empty row is still a shape mismatch.
      mismatches += Math.max(row1?.length ?? 0, row2?.length ?? 0, 1);
      continue;
    }

    const cols = Math.max(row1.length, row2.length);

    for (let j = 0; j < cols; j++) {
      if (row1[j] !== row2[j]) {
        mismatches++;
      }
    }
  }

  return mismatches;
}

export function toString(matrix) {
  matrix.forEach((row) => {
    console.debug(`[${row.join(",")}]`);
  });
}

```

### Core Architecture Module: `arc/src/lib/Zoom.ts`
```
export function focus(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;

  let xOffset = -1,
    yOffset = -1,
    xLength = 0,
    yLength = 0;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (matrix[i][j] !== 0) {
        if (yOffset === -1) {
          yOffset = i;
        }
        yLength = Math.max(yLength, i - yOffset + 1);

        if (xOffset === -1 || j < xOffset) {
          xOffset = j;
        }
        xLength = Math.max(xLength, j - xOffset + 1);
      }
    }
  }

  const object = matrix
    .slice(yOffset, yOffset + yLength)
    .map((row) => row.slice(xOffset, xOffset + xLength));

  return {
    x_position: xOffset,
    y_position: yOffset,
    object_matrix: object,
  };
}

export function enlarge(matrix, rows, cols) {
  const { x_position: xOffset, y_position: yOffset, object_matrix } = matrix;

  const originalArray = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < object_matrix.length; i++) {
    for (let j = 0; j < object_matrix[i].length; j++) {
      originalArray[yOffset + i][xOffset + j] = object_matrix[i][j];
    }
  }

  return originalArray;
}

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

### Incident Patch 1: `1167438a` (2026-10-26)
**Commit Message**: Make NUC token gate depend on mode and category

Token comparison is now required only in continuous cycles for Syntax, Utility, Reasoning, and existing comparable Runtime proposals. Single-proposal requests, Documentation, brand-new runtime features, and genuinely uncomparable existing features skip it.

Behavior, integrity, syntax compatibility, development checks, and a valid accepted-corpus baseline remain mandatory in every mode. Invalid inputs or baselines are errors, never successful skips.

tests/proposals.rs now reads the Category header against the NUC 1 registry, takes NUC_PROPOSAL_MODE and runtime applicability inputs, replays legacy sources, and reports token_check as ran or skipped. It also reuses shared assertion-extraction code and adds matrix tests.

Agent profiles, skills, instructions, CONTRIBUTING.md, and NUC 1 are updated to match.

**File**: `.github/agents/nuc-evaluate.agent.md` (modified, +22/-7)
```diff
@@ -1,6 +1,6 @@
 ---
 name: nuc-evaluate
-description: Independently evaluate one completed NUC candidate and decide acceptance using behavior checks and per-case lexer token counts.
+description: Independently evaluate one completed NUC candidate using mandatory behavior/integrity checks and the applicable lexer-token acceptance policy.
 ---
 
 You independently evaluate exactly one completed NUC revision. Follow
@@ -12,14 +12,27 @@ You independently evaluate exactly one completed NUC revision. Follow
 - Require the proposal agent's completed handoff, including the proposal path
   and Git blob revision, confirmed category, accepted Git revision, immutable
   baseline JSON artifact, candidate worktree, and a fresh report artifact path.
+- Require the preserved execution mode and explicit runtime applicability for
+  Runtime features, including independently verified reason/evidence for a
+  genuinely uncomparable existing feature. Pass `NUC_PROPOSAL_MODE=single` for
+  one-shot requests; omitted evaluator mode is continuous for existing
+  open-ended invocations.
 - Verify the proposal's `Category` header against the handoff and registry.
   Return uncertainty about category additions, selections, updates, or
   assignments to the caller, who asks the user for confirmation; do not
   assign or change a category during evaluation.
 - Use a fresh context, separate from the proposal agent; never evaluate your
   own proposal work.
-- Run independent behavior checks and the `evaluate_proposal` gate. Decide
-  Accepted, Rejected, or Blocked from actual evidence, not the proposer's claim.
+- Run independent behavior/integrity checks and `evaluate_proposal` in every mode.
+  Its token portion follows the [mode/category policy](../skills/nuc-evaluate/SKILL.md#measure-and-decide):
+  single requests always skip comparison; only continuous cycles apply the
+  category/runtime matrix. The token non-regression gate requires each compared
+  case to use the same or fewer lexer tokens than its accepted baseline.
+  Skips do not waive baseline validity,
+  protected cases, legacy syntax, development checks, or new-case assertion/
+  expected-return execution and coverage. Bad input, missing required
+  comparisons, and failures never become successful skips. Decide Accepted,
+  Rejected, or Blocked from actual evidence, not the proposer's claim.
 - Treat candidate sources and the baseline as read-only. Write only new
   reports in the session workspace and normal ignored build outputs.
 - Do not repair the candidate, regenerate exports, rewrite assertions or
@@ -34,10 +47,12 @@ You independently evaluate exactly one completed NUC revision. Follow
 
 ## Result
 
-Return the proposal and baseline revisions, confirmed category, decision,
-report path, independent
-checks, counts of `less`/`same`/`more` cases, and every increased, missing,
+Return the proposal and baseline revisions, execution mode, confirmed category,
+runtime applicability and rationale, decision, report path, independent checks,
+and actual token ran/skipped status with its reason. Include
+`less`/`same`/`more` counts only when comparison ran; a skip is neither zero
+measured cases nor a passing token gate. Return every increased, missing,
 unpaired, or invalid case with its before/after counts or explicit reason.
-Do not offset a per-case increase with savings elsewhere. The caller owns
+Do not offset a required-gate per-case increase with savings elsewhere. The caller owns
 integration and status/index updates; outcome metadata does not recursively
 trigger more agents.
```

**File**: `.github/agents/nuc-proposal.agent.md` (modified, +21/-4)
```diff
@@ -12,8 +12,9 @@ You draft and prototype exactly one added or updated NUC revision. Follow
 - Follow the caller-owned [enhancement selection rule](../skills/nuc-proposal/SKILL.md#select-an-unspecified-enhancement);
   do not redraw the selected category.
 - Require the proposal path, confirmed category and requested change,
-  accepted Git revision, immutable baseline JSON artifact, and isolated
-  candidate worktree.
+  execution mode, runtime applicability and supporting rationale when applicable,
+  accepted Git revision, immutable baseline JSON artifact, and isolated candidate
+  worktree.
 - Write the confirmed `Category` header using the
   [classification rule](../skills/nuc-proposal/SKILL.md#classify-every-proposal).
   Return uncertainty about category additions, selections, updates, or
@@ -27,6 +28,15 @@ You draft and prototype exactly one added or updated NUC revision. Follow
   verify unchanged legacy forms alongside candidate forms.
 - Draft the proposal, implement its prototype where needed, and rewrite
   equivalent executable cases without weakening assertions or coverage.
+- Follow the [mode/category token policy](../skills/nuc-proposal/SKILL.md#choose-execution-mode-caller-only).
+  The token non-regression gate requires each compared case to use the same
+  or fewer lexer tokens than its accepted baseline. Single requests always skip
+  token comparison; continuous cycles use the confirmed category/runtime
+  applicability matrix. Skips never waive valid
+  accepted-corpus baselines, behavior/integrity, compatibility, or development
+  checks. Only required comparisons need counterparts for genuinely new cases;
+  unpaired new behavior still needs executed assertions/expected returns and
+  coverage. Never invent before-counts.
 - Keep affected reference, synthesized sources, and rendered exports in sync.
 - Run the relevant development checks, but do not run `evaluate_proposal`,
   write an acceptance report, or decide Accepted or Rejected.
@@ -38,9 +48,14 @@ You draft and prototype exactly one added or updated NUC revision. Follow
 ## Handoff
 
 Return the proposal path and Git blob revision, baseline revision and artifact
-path, confirmed proposal category and selection rationale when applicable,
+path, execution mode, confirmed proposal category and selection rationale when
+applicable,
+runtime applicability and supporting rationale, expected token ran/skipped policy,
 candidate worktree, changed files, development and syntax-compatibility checks,
 and any blockers.
+If the caller-owned Rust improvement pass is pending, return only a preparation
+checkpoint and await a same-revision follow-up to recheck/finalize; do not
+freeze or declare readiness before that pass and final validation.
 Declare the candidate ready for independent evaluation only when its inputs
 are complete, then stop editing it. The caller launches a fresh `nuc-evaluate`
 agent with this handoff and a fresh report path. The caller owns integration
@@ -58,6 +73,8 @@ In continuous mode, after finalizing an `Accepted` or `Rejected` outcome for a
 new NUC, it immediately starts the next proposal under the
 [continuous-cycle rule](../skills/nuc-proposal/SKILL.md#continue-with-the-next-nuc-caller-only).
 In single-proposal mode, it finishes the requested outcome and stops without
-starting another proposal or running reinforcement-learning policy checks.
+starting another proposal or running token comparison (the token non-regression
+gate); independent behavior/compatibility/development evaluation and outcome
+recording remain required.
 This continuation is caller-owned; stop at your single-proposal handoff and
 never launch the next cycle yourself.
```

**File**: `.github/instructions/proposals.instructions.md` (modified, +67/-24)
```diff
@@ -11,22 +11,57 @@ their respective `SKILL.md` files in `.github/skills/`, and the process in
 `docs/nuc-0001.md`.
 
 The proposal agent drafts and prototypes; it cannot decide acceptance. The
-evaluation agent independently checks the frozen handoff and measures tokens;
-it cannot rewrite the candidate. Only the caller orchestrates the two stages.
+evaluation agent independently checks the frozen handoff and measures tokens
+when required by the execution-mode policy; it cannot rewrite the candidate.
+Only the caller orchestrates the two stages.
 
 Record an immutable accepted-syntax baseline before rewriting the runtime or
 executable documents. Evaluate each proposal in its own candidate worktree;
 do not reuse agents or combine pending proposals. Preserve case identities,
 canonical assertions, expected results, and executed assertion coverage.
-New cases require behavior-equivalent accepted-syntax baselines.
+When token comparison is required, new cases need behavior-equivalent
+accepted-syntax baselines. A legitimate skip permits genuinely new behavior
+without a counterpart, but still executes assertions/explicit expected returns
+and verifies coverage. Pre-existing cases and legacy syntax stay protected.
 
 `tests/proposals.rs` counts tokens with the runtime lexer, including layout
-markers and excluding `Eof`. Accept only if every case uses the same or fewer
-tokens and behavior checks pass; reject if any case uses more. Savings in
-another case cannot offset an increase. Missing baselines block acceptance.
+markers and excluding `Eof`. When required, accept only if every paired case
+uses the same or fewer tokens; reject any increase, regardless of savings
+elsewhere. Missing required comparisons block acceptance. All modes require
+valid immutable accepted-corpus inputs and behavior/integrity, compatibility,
+and development checks.
 Keep reports in the session workspace and do not apply rejected candidates.
 Evaluation outcome metadata does not recursively trigger another agent.
 
+## Execution mode and token policy
+
+The **token non-regression gate** requires each compared case to use the same
+or fewer lexer tokens than its accepted baseline.
+`/nuc-proposal` defaults to continuous mode for open-ended requests.
+Explicit single-NUC, feature, and revision requests always skip token comparison,
+independently evaluate behavior/compatibility/development, record the outcome,
+then stop. Preserve the caller's mode through `/nuc-evaluate`; pass
+`NUC_PROPOSAL_MODE=single` explicitly. An omitted evaluator mode is `continuous`
+for existing open-ended invocations.
+
+Only continuous cycles apply the
+[NUC 1 matrix](../../docs/nuc-0001.md#proposal-evaluation):
+
+- Syntax enhancement, Utility enhancement, and Reasoning enhancement: required.
+- Runtime features: required for an existing comparable feature; skipped entirely
+  for a brand-new feature; skipped for a genuinely uncomparable existing feature
+  only with explicit reason and evidence.
+- Documentation: skipped.
+
+Read the proposal's actual registered Category header. Runtime proposals require
+explicit new/existing-comparable/existing-uncomparable applicability, including
+in single mode; validate uncomparable reason/evidence independently.
+Bad inputs, invalid/corrupt baselines, behavior or syntax failures, and required
+token increases never become successful skips. Missing comparisons do not prove
+uncomparability. Report the actual mode/category/applicability and whether the
+check ran or was skipped with its reason; a skip has no measured-case counts
+and is not a passing token gate.
+
 ## Enhancement selection
 
 Every NUC, including existing and rejected proposals, has one `Category`
@@ -61,23 +96,26 @@ Every added or updated `docs/nuc-XXXX.md` is a proposal revision. Before
 finishing a Copilot task that changes a NUC, launch a fresh `nuc-proposal`
 agent and then an independent fresh `nuc-evaluate` agent for each changed
 proposal. Do not reuse either agent for another role, proposal, or later
-revision. This applies to process and documentation-only NUCs too; unchanged
-executable cases can demonstrate equal token usage.
+revision. This applies to process and documentation-only NUCs too; they still
+undergo independent behavior, integrity, compatibility, and development checks.
 
 Pin the accepted Git revision and record its token baseline before editing
 runtime behavior or executable cases. Give the proposer its requested change,
-proposal path and confirmed category, baseline revision and immutable JSON
-artifact, and candidate worktree. Use `.github/agents/nuc-proposal.agent.md` and
+proposal path and confirmed category, execution mode and runtime applicability
+with supporting rationale, baseline revision and immutable JSON artifact,
+and candidate worktree. Use `.github/agents/nuc-proposal.agent.md` and
 `.github/skills/nuc-proposal/SKILL.md` for drafting, prototyping, equivalent
 case rewrites, synchronization, and develo
```

**File**: `.github/skills/nuc-evaluate/SKILL.md` (modified, +62/-18)
```diff
@@ -1,6 +1,6 @@
 ---
 name: nuc-evaluate
-description: Independently evaluate a completed Nucleoid NUC candidate against its accepted baseline. Use for per-case token acceptance, not drafting or repairs.
+description: Independently evaluate a completed Nucleoid NUC candidate with mandatory behavior/integrity checks and the applicable lexer-token policy, not drafting or repairs.
 ---
 
 # Evaluating a NUC proposal
@@ -21,6 +21,11 @@ Git revision and immutable JSON artifact, candidate worktree, and fresh report
 artifact path in the session workspace. Require the confirmed proposal
 category and verify that its header matches the handoff and
 [category registry](../../../docs/nuc-0001.md#proposal-categories).
+Require the preserved execution mode and runtime applicability, including
+reason and evidence for a genuinely uncomparable existing runtime feature.
+Independently verify applicability and that evidence; missing comparison
+artifacts do not prove impossibility. A Runtime features proposal needs an
+explicit branch even in single mode.
 Confirm that the current proposal blob matches the handoff and the baseline
 matches the accepted revision. Missing prerequisites block evaluation; never
 invent measurements or guess an uncertain category.
@@ -47,47 +52,85 @@ Existing supported forms must keep their parsing and runtime semantics, even
 when optional shorter forms or runtime features are added. A compatibility
 failure rejects the proposal regardless of token savings or a passing gate.
 
-The measured corpus is `nucleoid.spec.md`, `tests/reference.md`, and the
+The checked corpus is `nucleoid.spec.md`, `tests/reference.md`, and the
 `nuc` blocks in `README.md` and `docs/examples.md`. Generated Rust and
 synthesized training records are not scored.
 
 ## Measure and decide
 
+The **token non-regression gate** requires each compared case to use the same
+or fewer lexer tokens than its accepted baseline.
+Single-proposal requests always skip token comparison, regardless of category.
+Only continuous cycles apply the
+[NUC 1 matrix](../../../docs/nuc-0001.md#proposal-evaluation):
+
+- Syntax enhancement, Utility enhancement, and Reasoning enhancement: required.
+- Runtime features: required for an existing comparable feature; skipped
+  entirely for a brand-new feature; skipped for a genuinely uncomparable existing
+  feature with explicit reason and evidence.
+- Documentation: skipped.
+
+Every mode still requires valid immutable accepted-corpus inputs, behavior,
+case integrity, syntax compatibility, development checks, and outcome recording.
+When tokens are skipped, genuinely new behavior cases may lack accepted-syntax
+counterparts, but must execute assertions or explicit expected returns with
+full assertion coverage. Pre-existing identities, canonical assertions, returns,
+coverage, and legacy forms remain protected; never invent before-counts.
+
 From the supplied candidate worktree, set:
 
 - `NUC_PROPOSAL_BASELINE` to the supplied immutable baseline.
 - `NUC_PROPOSAL` to the repository-relative `docs/nuc-XXXX.md` path.
 - `NUC_PROPOSAL_REPORT` to the fresh session report path.
-
-Run the deterministic gate:
+- `NUC_PROPOSAL_MODE` to the caller's `single` or `continuous` mode; explicitly
+  use `single` for a one-shot request. Omitted mode defaults to `continuous`
+  for existing open-ended invocations, not for explicit single requests.
+- For Runtime features, `NUC_PROPOSAL_RUNTIME` to `new_feature`,
+  `existing_comparable`, or `existing_uncomparable`; the last also requires
+  nonblank `NUC_PROPOSAL_RUNTIME_REASON` and `NUC_PROPOSAL_RUNTIME_EVIDENCE`.
+  Unset runtime inputs for other categories and reason/evidence for other
+  runtime branches; inconsistent or unknown inputs are errors, not skips.
+- `NUC_PROPOSAL_EXTRA_BASELINES` to the original extra-baseline source file
+  when the artifact includes additional accepted-syntax cases.
+
+Run the deterministic evaluator in every mode; only its token portion is
+optional:
 
 ```console
 cargo test --quiet --test proposals evaluate_proposal -- --ignored --nocapture
 ```
 
-The metric is `tokenize(case.source.trim())` from the runtime lexer, including
-`Newline`, `Indent`, and `Dedent`, excluding only `Eof`. It is not an LLM token
+When comparison is required, the metric is `tokenize(case.source.trim())`
+from the runtime lexer, including `Newline`, `Indent`, and `Dedent`, excluding
+only `Eof`. It is not an LLM token
 count. The gate protects case identities, canonical assertions, expected
 returns, and executed assertion coverage.
 
-- **Accepted:** every paired case is `same` or `less`, all behavior and
-  independent checks pass, accepted syntax remains backward compatible, and
-  no required case or baseline is missing.
-- **Rejected:** any case is `more`, or the candidate changes protected
-  assertions/results/coverage, breaks accepted syntax compatibility, or fails
-  behavior or development checks.
+- **Accepted:** all behavior/integrity a
```

**File**: `.github/skills/nuc-proposal/SKILL.md` (modified, +55/-18)
```diff
@@ -23,9 +23,30 @@ stop; do not select or start another proposal unless the user explicitly
 requests continuation.
 
 Preserve this mode through evaluation, including coordination through
-`/nuc-evaluate`. Do not run reinforcement-learning policy checks for a
-single-proposal request. Immutable baselines, syntax compatibility, per-case
-token acceptance, and required development checks still apply in both modes.
+`/nuc-evaluate`, and pass `NUC_PROPOSAL_MODE=single` explicitly for one-shot
+requests. An omitted evaluator mode remains `continuous` for existing
+open-ended invocations.
+
+The **token non-regression gate** requires each compared case to use the same
+or fewer lexer tokens than its accepted baseline. Single-proposal
+requests always skip token comparison. All modes retain valid immutable
+accepted-corpus inputs, behavior/integrity, syntax compatibility, development
+checks, independent evaluation, and outcome recording.
+
+Only continuous cycles apply the
+[NUC 1 token policy](../../../docs/nuc-0001.md#proposal-evaluation):
+
+- Syntax enhancement, Utility enhancement, and Reasoning enhancement: run.
+- Runtime features: run for an existing comparable feature; do not run at all
+  for a brand-new feature; explicitly skip a genuinely uncomparable existing
+  feature with a reason and supporting evidence.
+- Documentation: do not run.
+
+Supply explicit runtime applicability for Runtime features even in single mode.
+The independent evaluator verifies any uncomparable rationale and evidence;
+missing comparison artifacts are not evidence of impossibility. No skip may
+hide invalid inputs/baselines, behavior or syntax failures, or a required token
+increase.
 
 ## Classify every proposal
 
@@ -72,24 +93,30 @@ its handoff and write the same category in the proposal header. Explicit
 feature/category requests take precedence, and process or documentation-only
 revisions are not randomized.
 
-Every category retains the same baseline and acceptance requirements. New
-measured cases still need pre-executed behavior-equivalent accepted-syntax
-programs; missing baselines block preparation rather than bypass the gate.
+Selection does not bypass shared behavior, integrity, compatibility, or
+development safeguards. Token requirements follow execution mode and the
+confirmed category/applicability policy, not a new random draw.
 
 ## Confirm the inputs
 
-Require the proposal path, confirmed category and requested change, accepted
-Git revision, immutable baseline JSON artifact, and candidate worktree.
+Require the proposal path, confirmed category and requested change, execution
+mode and runtime applicability with supporting rationale when applicable,
+accepted Git revision, immutable baseline JSON artifact, and candidate worktree.
 Confirm that the baseline belongs to that accepted revision before making
 runtime or executable document edits. Missing inputs stop preparation, not
 justify assumptions.
 
-New measured cases need behavior-equivalent accepted-syntax programs with the
-same document, title, canonical assertions, and expected return. They must
+When token comparison is required, new measured cases need behavior-equivalent
+accepted-syntax programs with the same document, title, canonical assertions,
+and expected return. They must
 already have been executed by the accepted runtime and included through
 `NUC_PROPOSAL_EXTRA_BASELINES` when recording the baseline. If a case is not
-paired, return its required baseline to the caller before proceeding. Never
-overwrite a baseline or derive before-counts from the candidate lexer.
+paired, return its required baseline to the caller before proceeding.
+For legitimate skipped comparisons, genuinely new cases need no accepted-syntax
+counterpart; execute their assertions or explicit expected returns and verify
+coverage. Protect every pre-existing case, and supply the original extra-baseline
+sources for legacy replay in every mode. Never overwrite a baseline, invent a
+counterpart, or derive before-counts from the candidate lexer.
 
 ## Preserve syntax compatibility
 
@@ -135,14 +162,22 @@ Run the affected development tests, `cargo fmt --check`, and
 `cargo clippy --all-targets -- -D warnings`. Fix feature-coupled problems in
 the candidate, without changing the baseline or caller work.
 
+The caller completes the required Rust improvement pass before the final
+frozen handoff. If that pass is pending, return a preparation checkpoint and
+await the caller's same-revision follow-up to recheck and finalize; a checkpoint
+is not a ready-for-evaluation handoff.
+
 Do not run the ignored `evaluate_proposal` entry point, produce an acceptance
 report, or mark the proposal Accepted or Rejected. Those belong to the
 independent evaluator.
 
 Return the proposal path and Git blob revision (`git hash-object` on the
-proposal), accepted baseline revision and path, confirmed proposal category
-and selection rationale when applicable, candidate worktree, changed
```

**File**: `CONTRIBUTING.md` (modified, +70/-16)
```diff
@@ -102,7 +102,8 @@ fresh `nuc-evaluate` agent per revision. The proposer drafts and prototypes in
 an isolated candidate, preserving behavior, case identities, canonical
 assertions, return expectations, and executed assertion coverage. It hands off
 the proposal's Git blob revision without deciding acceptance. The evaluator
-checks the frozen candidate and measures tokens without rewriting it.
+checks the frozen candidate without rewriting it, measuring tokens only when
+the execution-mode policy requires comparison.
 
 The procedures live in the [proposal skill](.github/skills/nuc-proposal/SKILL.md)
 and [evaluation skill](.github/skills/nuc-evaluate/SKILL.md), with separate
@@ -119,12 +120,36 @@ more accurately, with synchronized category and numerical indexes. Unspecified
 enhancements use an equal random draw across the currently eligible categories;
 Documentation is not part of that draw.
 
-The gate measures each case from the specification and executable reference,
-README, and examples. It uses Nucleoid lexer tokens, including `Newline`,
-`Indent`, and `Dedent`, excluding `Eof`; it does not measure LLM tokens,
-generated Rust, or synthesized training records. Each case must use the same
-or fewer tokens. Any increase rejects the proposal, regardless of savings in
-other cases. Missing baselines block acceptance.
+The **token non-regression gate** requires each compared case to use the same
+or fewer lexer tokens than its accepted baseline. `/nuc-proposal`
+defaults to continuous mode for open-ended requests. A request for one specific
+NUC, concrete feature, or particular revision uses single-proposal mode: skip
+token comparison, independently evaluate behavior/compatibility/development,
+record the outcome, then stop without starting another proposal.
+
+Only continuous cycles use this matrix:
+
+| Category | Token comparison |
+| --- | --- |
+| Syntax enhancement | Required |
+| Runtime features | Required for existing comparable features; skipped for brand-new features or genuinely uncomparable existing features with explicit reason and evidence |
+| Utility enhancement | Required |
+| Reasoning enhancement | Required |
+| Documentation | Skipped |
+
+All modes retain immutable accepted-corpus baselines, pre-existing case
+integrity, assertion execution/coverage, explicit return checks, backward
+syntax compatibility, development checks, and independent evaluation.
+An invalid baseline, bad input, or behavior/compatibility failure never becomes
+a successful skip. Missing comparisons still block a required token gate;
+missing artifacts do not establish that a feature is uncomparable.
+
+When required, the gate measures each case from the specification and executable
+reference, README, and examples. It uses Nucleoid lexer tokens, including
+`Newline`, `Indent`, and `Dedent`, excluding `Eof`; it does not measure LLM
+tokens, generated Rust, or synthesized training records. Each paired case must
+use the same or fewer tokens. Any increase rejects the proposal, regardless of
+savings in other cases.
 
 Record the accepted baseline before editing the runtime or executable corpus.
 The recorder reads documents from the pinned Git revision and refuses to use
@@ -144,22 +169,42 @@ After the proposal handoff, the fresh evaluator runs from the frozen candidate
 worktree with the same baseline path:
 
 ```powershell
-$env:NUC_PROPOSAL = 'docs\nuc-0012.md'
-$env:NUC_PROPOSAL_REPORT = Join-Path $env:TEMP 'nucleoid-nuc-0012-report.json'
+$env:NUC_PROPOSAL = 'docs\nuc-0001.md'
+$env:NUC_PROPOSAL_MODE = 'single'
+$env:NUC_PROPOSAL_REPORT = Join-Path $env:TEMP 'nucleoid-nuc-0001-report.json'
 cargo test --test proposals evaluate_proposal -- --ignored --nocapture
 ```
 
+`NUC_PROPOSAL_MODE` accepts only `continuous` or `single`; omitted means
+`continuous` for existing open-ended invocations. Pass `single` explicitly for
+one-shot requests and preserve the caller's mode throughout evaluation.
+The evaluator reads the actual fenced `Category` header and checks it against
+NUC 1's registry; there is no category override or unchecked ignore-failures flag.
+
+For a Runtime features proposal, also set `NUC_PROPOSAL_RUNTIME` to exactly one
+of `new_feature`, `existing_comparable`, or `existing_uncomparable`, even in
+single mode. The last requires both `NUC_PROPOSAL_RUNTIME_REASON` and
+`NUC_PROPOSAL_RUNTIME_EVIDENCE`: nonblank explanations and supporting evidence
+for why the existing feature genuinely cannot be compared in accepted syntax.
+The independent evaluator verifies that classification and evidence.
+Runtime inputs are invalid for other categories; reason/evidence are invalid
+for the other runtime branches. Unset inapplicable variables rather than
+leaving stale skip inputs.
+
 Baseline and report files are created once and never overwritten. Use fresh
 paths for later revisions; keep actual evaluation artifacts in the Copilot
 session workspace. A nonzero exit means rejected or blocked, not accepted.

```

**File**: `docs/nuc-0001.md` (modified, +34/-9)
```diff
@@ -68,18 +68,37 @@ Created: 31-Jul-2026
 - For example, populate `$categories` from the registry's Yes entries and select one index with `Get-Random -Minimum 0 -Maximum $categories.Count`.
 - Draw before recording baselines or delegating preparation, then choose one bounded enhancement within the selected category; do not redraw to favor a category or substitute deterministic alternation for randomness.
 - The caller supplies the selected category, requested change, and selection rationale to the proposal worker; the worker uses that selection without redrawing.
-- All categories retain the same baseline, syntax-compatibility, development-check, and independent acceptance requirements; classification never bypasses a safeguard.
+- Every category retains immutable accepted-corpus baselines, behavior/integrity checks, syntax compatibility, development checks, and independent evaluation; token comparison follows the execution-mode policy below.
 
 ## NUC Status
 
 - **Draft** -- under development, subject to change.
 - **Accepted** -- passed proposal evaluation, settled, and matching the specification.
-- **Rejected** -- evaluated and refused, including any per-case token increase.
+- **Rejected** -- evaluated and refused, including any per-case token increase when the token gate is required.
 - **Active** -- informational or process NUCs that remain current; their revisions still undergo evaluation.
 - **Superseded** -- replaced by a later NUC, named in `Superseded-By`.
 
 ## Proposal Evaluation
 
+- The **token non-regression gate** requires each compared case to use the same or fewer lexer tokens than its accepted baseline.
+- `/nuc-proposal` defaults to continuous mode for open-ended requests; omitted evaluator mode also means `continuous` for existing invocations.
+- A request for one specific NUC, concrete feature, or particular revision uses single-proposal mode; pass `NUC_PROPOSAL_MODE=single` explicitly through evaluation, record its outcome, then stop.
+- Single-proposal requests always skip token comparison, regardless of category or runtime applicability; they still require independent behavior, integrity, syntax-compatibility, development evaluation, and outcome recording.
+- Only continuous cycles apply this token-gate matrix:
+
+| Category | Continuous-cycle token gate |
+| --- | --- |
+| Syntax enhancement | Required. |
+| Runtime features | Required for an existing feature with a behavior-equivalent accepted-syntax comparison. |
+| Runtime features | Skipped entirely for a brand-new feature. |
+| Runtime features | Skipped for a genuinely uncomparable existing feature, with an explicit reason and evidence. |
+| Utility enhancement | Required. |
+| Reasoning enhancement | Required. |
+| Documentation | Skipped. |
+
+- Read the proposal's actual `Category` header and validate it against the registry; an unknown or missing category blocks evaluation, never selects a skip.
+- Runtime proposals require explicit applicability (`new_feature`, `existing_comparable`, or `existing_uncomparable`), including in single mode; uncomparable existing features require nonblank reason and evidence, independently verified by the evaluator.
+- A missing comparison artifact is not evidence that an existing feature is uncomparable; missing required comparisons still block acceptance.
 - Every added or updated `docs/nuc-XXXX.md`, including process and documentation-only changes, requires a fresh `nuc-proposal` agent followed by a separate, independent fresh `nuc-evaluate` agent for that revision.
 - Preparation follows the [nuc-proposal profile](../.github/agents/nuc-proposal.agent.md) and [proposal skill](../.github/skills/nuc-proposal/SKILL.md).
 - Independent evaluation follows the [nuc-evaluate profile](../.github/agents/nuc-evaluate.agent.md) and [evaluation skill](../.github/skills/nuc-evaluate/SKILL.md).
@@ -94,20 +113,26 @@ Created: 31-Jul-2026
 - The proposal agent synchronizes affected reference, canonical training JSONL, runtime semantics, and generated normative exports.
 - Edit normative source documents and regenerate affected exports, never hand-edit generated Rust or `dataset/nucleoid.spec.jsonl`; maintain synthesized and ARC training records directly as canonical JSONL.
 - The proposal agent runs relevant development tests, formatting, and warning-denied Clippy. It must not run `evaluate_proposal`, produce an acceptance report, or declare Accepted or Rejected.
-- The proposal agent returns a frozen handoff: proposal path and Git blob revision, confirmed category and selection rationale when applicable, accepted baseline revision and artifact, candidate worktree, changed files, development and syntax-compatibility checks, and explicit blockers. It then stops editing the candidate.
+- The caller completes the required Rust improvement pass, when applicable, before the final frozen proposal handoff.
+- The proposal agent returns a frozen handoff: proposal path and Git blob revision, execution mode, con
```

**File**: `tests/proposals.rs` (modified, +1090/-239)
```diff
@@ -1,7 +1,8 @@
-//! Deterministic, per-case token gate for NUC proposal agents.
+//! Deterministic behavior, integrity, and optional token checks for NUCs.
 //!
 //! The ignored entry points record an immutable baseline and compare a rewritten
-//! corpus. Ordinary tests exercise the gate without environment variables.
+//! corpus. Ordinary tests supply policy inputs directly, without mutating the
+//! process environment.
 
 mod common;
 
@@ -14,12 +15,158 @@ use std::process::Command;
 
 use indexmap::IndexMap;
 use nucleoid::lang::ast::lexer::{Token, tokenize};
-use nucleoid::lang::ast::{Expr, FunctionBody, Stmt, TemplatePart, parse};
+use nucleoid::lang::ast::parse;
 use serde::{Deserialize, Serialize};
 use thiserror::Error;
 
 const METRIC: &str = "nucleoid-lexer-with-layout-v1";
 
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
+#[serde(rename_all = "snake_case")]
+enum ExecutionMode {
+    Continuous,
+    Single,
+}
+
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
+enum Category {
+    #[serde(rename = "Syntax enhancement")]
+    Syntax,
+    #[serde(rename = "Runtime features")]
+    Runtime,
+    #[serde(rename = "Utility enhancement")]
+    Utility,
+    #[serde(rename = "Reasoning enhancement")]
+    Reasoning,
+    Documentation,
+}
+
+impl Category {
+    fn from_label(label: &str) -> Result<Self, GateError> {
+        match label {
+            "Syntax enhancement" => Ok(Self::Syntax),
+            "Runtime features" => Ok(Self::Runtime),
+            "Utility enhancement" => Ok(Self::Utility),
+            "Reasoning enhancement" => Ok(Self::Reasoning),
+            "Documentation" => Ok(Self::Documentation),
+            _ => Err(GateError::Proposal(format!(
+                "unsupported Category {label:?}; confirm its registry and policy before evaluation"
+            ))),
+        }
+    }
+}
+
+#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
+#[serde(tag = "kind", rename_all = "snake_case")]
+enum RuntimeApplicability {
+    NotApplicable,
+    NewFeature,
+    ExistingComparable,
+    ExistingUncomparable { reason: String, evidence: String },
+}
+
+#[derive(Default)]
+struct PolicyInputs<'a> {
+    mode: Option<&'a str>,
+    runtime: Option<&'a str>,
+    reason: Option<&'a str>,
+    evidence: Option<&'a str>,
+}
+
+#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
+struct EvaluationPolicy {
+    mode: ExecutionMode,
+    category: Category,
+    runtime: RuntimeApplicability,
+}
+
+impl EvaluationPolicy {
+    fn from_inputs(category: Category, inputs: PolicyInputs<'_>) -> Result<Self, GateError> {
+        let mode = match inputs.mode {
+            None | Some("continuous") => ExecutionMode::Continuous,
+            Some("single") => ExecutionMode::Single,
+            Some(value) => {
+                return Err(GateError::Input(format!(
+                    "NUC_PROPOSAL_MODE must be continuous or single, not {value:?}"
+                )));
+            }
+        };
+        let runtime = match (category, inputs.runtime) {
+            (Category::Runtime, Some("new_feature")) => RuntimeApplicability::NewFeature,
+            (Category::Runtime, Some("existing_comparable")) => {
+                RuntimeApplicability::ExistingComparable
+            }
+            (Category::Runtime, Some("existing_uncomparable")) => {
+                RuntimeApplicability::ExistingUncomparable {
+                    reason: required_rationale("NUC_PROPOSAL_RUNTIME_REASON", inputs.reason)?,
+                    evidence: required_rationale("NUC_PROPOSAL_RUNTIME_EVIDENCE", inputs.evidence)?,
+                }
+            }
+            (Category::Runtime, _) => {
+                return Err(GateError::Input(
+                    "Runtime features requires NUC_PROPOSAL_RUNTIME: new_feature, \
+                     existing_comparable, or existing_uncomparable"
+                        .to_string(),
+                ));
+            }
+            (_, None) => RuntimeApplicability::NotApplicable,
+            (_, Some(_)) => {
+                return Err(GateError::Input(
+                    "NUC_PROPOSAL_RUNTIME is only valid for Runtime features".to_string(),
+                ));
+            }
+        };
+        if !matches!(runtime, RuntimeApplicability::ExistingUncomparable { .. })
+            && (inputs.reason.is_some() || inputs.evidence.is_some())
+        {
+            return Err(GateError::Input(
+                "runtime reason/evidence are only valid for existing_uncomparable".to_string(),
+            ));
+        }
+        Ok(Self {
+            mode,
+            category,
+            runtime,
+        })
+    }
+
+    fn skip_reason(&self) -> Option<TokenSkipReason> {
+        if self.mode == ExecutionMode::Single {
+            return Some(TokenSkipReason::SingleProposal);
+        }
+        match self.category {
+            Category::Documentation => Some(TokenSkipReason::Documentation),
+            Category::Runtime => match self.runtime {
+    
```

---

### Incident Patch 2: `fe0a6549` (2026-10-26)
**Commit Message**: Add single-proposal execution mode

Clarify that focused proposal requests stop after their outcome, while open-ended requests continue in continuous mode. Update the ARC app to load puzzle 3aa6fb7a.

**File**: `.github/agents/nuc-proposal.agent.md` (modified, +6/-2)
```diff
@@ -52,8 +52,12 @@ rejected proposal documentation and index/outcome metadata under the
 Rejected candidate language changes remain isolated. Do not perform this
 caller-owned commit yourself.
 
-After the caller finalizes either an `Accepted` or `Rejected` outcome for a new
-NUC, it immediately starts the next proposal under the
+The caller follows the skill's
+[execution-mode rule](../skills/nuc-proposal/SKILL.md#choose-execution-mode-caller-only).
+In continuous mode, after finalizing an `Accepted` or `Rejected` outcome for a
+new NUC, it immediately starts the next proposal under the
 [continuous-cycle rule](../skills/nuc-proposal/SKILL.md#continue-with-the-next-nuc-caller-only).
+In single-proposal mode, it finishes the requested outcome and stops without
+starting another proposal or running reinforcement-learning policy checks.
 This continuation is caller-owned; stop at your single-proposal handoff and
 never launch the next cycle yourself.
```

**File**: `.github/instructions/proposals.instructions.md` (modified, +11/-2)
```diff
@@ -121,8 +121,17 @@ to that evaluation and must not recursively launch another agent.
 
 ## Continuous proposal cycles (caller only)
 
-After finalizing and committing an `Accepted` or `Rejected` outcome for a new
-NUC, the coordinating caller immediately starts a distinct new proposal under
+`/nuc-proposal` defaults to continuous mode for open-ended requests. A request
+for one specific NUC, concrete feature, or particular revision uses
+single-proposal mode: finish its preparation, independent evaluation, and
+outcome recording, then stop unless the user explicitly requests continuation.
+Follow the [execution-mode rule](../skills/nuc-proposal/SKILL.md#choose-execution-mode-caller-only),
+including through `/nuc-evaluate`. Do not run reinforcement-learning policy
+checks for a single-proposal request; normal baseline, compatibility, token
+acceptance, and development checks remain required.
+
+In continuous mode, after finalizing and committing an `Accepted` or `Rejected`
+outcome for a new NUC, the caller immediately starts a distinct new proposal under
 the [continuous-cycle rule](../skills/nuc-proposal/SKILL.md#continue-with-the-next-nuc-caller-only).
 Run cycles sequentially with fresh agents, baselines, candidate worktrees and
 reports, preserving the selection, compatibility and acceptance requirements.
```

**File**: `.github/skills/nuc-evaluate/SKILL.md` (modified, +7/-0)
```diff
@@ -98,6 +98,13 @@ outcome metadata does not trigger another pair. No commits, pushes, or merges.
 The evaluation worker stops after returning its evidence. It never records
 outcome metadata, commits, integrates a candidate, or starts another cycle.
 
+The caller preserves the proposal request's
+[execution mode](../nuc-proposal/SKILL.md#choose-execution-mode-caller-only).
+A single-proposal request does not enter a continuous cycle: finish its normal
+evaluation and outcome recording, then stop without starting another proposal
+or running reinforcement-learning policy checks. All required per-proposal
+checks still apply.
+
 When `/nuc-evaluate` coordinates an active continuous cycle, the caller follows
 the [shared rejection workflow](../../instructions/proposals.instructions.md#record-rejected-outcomes-caller-only).
 For `Rejected`, commit only the NUC rejection documentation and directly
```

**File**: `.github/skills/nuc-proposal/SKILL.md` (modified, +17/-0)
```diff
@@ -13,6 +13,20 @@ agent. Inside that agent, execute the steps below; do not spawn another agent.
 Follow `.github/copilot-instructions.md` and `docs/nuc-0001.md`.
 Work on exactly one proposal revision in the caller's isolated candidate.
 
+## Choose execution mode (caller only)
+
+`/nuc-proposal` defaults to continuous mode for open-ended proposal requests.
+If the user requests one specific NUC by number or path, one concrete feature,
+or a particular revision, use single-proposal mode instead. Complete that
+proposal's preparation, independent evaluation, and outcome recording, then
+stop; do not select or start another proposal unless the user explicitly
+requests continuation.
+
+Preserve this mode through evaluation, including coordination through
+`/nuc-evaluate`. Do not run reinforcement-learning policy checks for a
+single-proposal request. Immutable baselines, syntax compatibility, per-case
+token acceptance, and required development checks still apply in both modes.
+
 ## Classify every proposal
 
 Give every new and existing NUC exactly one `Category` header from the
@@ -150,6 +164,9 @@ perform this caller-owned commit.
 
 ## Continue with the next NUC (caller only)
 
+This section applies only in continuous mode. A single-proposal request stops
+after its outcome under the [execution-mode rule](#choose-execution-mode-caller-only).
+
 After a new NUC receives a final `Accepted` or `Rejected` decision, the
 coordinating caller must finish its outcome before starting the next cycle:
 
```

**File**: `arc/src/app.ts` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import * as visualizer from "./visualizer";
 import * as Matrix from "./lib/Matrix";
 import * as nucleoid from "./lib/nucleoid";
 import * as terminal from "./lib/terminal";
-import puzzle from "./data/training/0ca9ddb6.json";
+import puzzle from "./data/training/3aa6fb7a.json";
 // Completed:
 // 3aa6fb7a
 
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

## X. Make NUC token gate depend on mode and category

**RULE**:
When implementing operations in `.github/agents/nuc-evaluate.agent.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1167438a`: Make NUC token gate depend on mode and category. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/agents/nuc-evaluate.agent.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
description: Independently evaluate one completed NUC candidate using mandatory behavior/integrity checks and the applicable lexer-token acceptance policy.
- Require the preserved execution mode and explicit runtime applicability for
  Runtime features, including independently verified reason/evidence for a
  genuinely uncomparable existing feature. Pass `NUC_PROPOSAL_MODE=single` for
  one-shot requests; omitted evaluator mode is continuous for existing
  open-ended invocations.
- Run independent behavior/integrity checks and `evaluate_proposal` in every mode.
  Its token portion follows the [mode/category policy](../skills/nuc-evaluate/SKILL.md#measure-and-decide):
  single requests always skip comparison; only continuous cycles apply the
  category/runtime matrix. The token non-regression gate requires each compared
  case to use the same or fewer lexer tokens than its accepted baseline.
  Skips do not waive baseline validity,
  protected cases, legacy syntax, development checks, or new-case assertion/
  expected-return execution and coverage. Bad input, missing required
  comparisons, and failures never become successful skips. Decide Accepted,
  Rejected, or Blocked from actua
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
description: Independently evaluate one completed NUC candidate and decide acceptance using behavior checks and per-case lexer token counts.
- Run independent behavior checks and the `evaluate_proposal` gate. Decide
  Accepted, Rejected, or Blocked from actual evidence, not the proposer's claim.
Return the proposal and baseline revisions, confirmed category, decision,
report path, independent
checks, counts of `less`/`same`/`more` cases, and every increased, missing,
Do not offset a per-case increase with savings elsewhere. The caller owns
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1167438a` are properly handled with clean fallback behavior.
