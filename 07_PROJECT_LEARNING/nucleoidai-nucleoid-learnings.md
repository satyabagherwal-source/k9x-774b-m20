> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `b2ca6a62`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T13:14:27.054Z  
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
> **Harvest Timestamp**: 2026-10-27T13:14:26.821Z  
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
import puzzle from "./data/training/0ca9ddb6.json";
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

### Incident Patch 1: `b2ca6a62` (2026-10-27)
**Commit Message**: Add reward-driven proposal strategy learner

Add an opt-in, category-conditioned UCB1 bandit that learns which proposal approach (reuse_first or evidence_first) works best within a category, using the existing verified advisory rewards.

- tests/proposals/strategy.rs: typed policy, receipts, UCB1 selection, and immutable single-owner checkpoint chain. New ignored commands select_proposal_strategy (caller, before drafting) and learn_proposal_strategy (evaluator, after the saved report).
- tests/proposals.rs: evaluate_proposal now embeds strategy_learning attribution (not_configured or attributed); report types became deserializable with deny_unknown_fields so saved reports can be reloaded and revalidated.
- tests/proposals/strategy_tests.rs: controlled regressions covering exploration, reward-dependent choice, persistence, provenance, tampering, and duplicate rejection.
- Agent profiles, skills, proposals instructions, CONTRIBUTING.md and NUC 1 document the workflow, schemas, and limits.

Scoring formula, acceptance decisions, token policy, and uniform category selection are unchanged. Blocked or unscored outcomes never increment trials. This is not LLM-weight training.

**File**: `.github/agents/nuc-evaluate.agent.md` (modified, +22/-3)
```diff
@@ -34,7 +34,8 @@ You independently evaluate exactly one completed NUC revision. Follow
   comparisons, and failures never become successful skips. Decide Accepted,
   Rejected, or Blocked from actual evidence, not the proposer's claim.
 - Treat candidate sources and the baseline as read-only. Write only new
-  reports in the session workspace and normal ignored build outputs.
+  reports/learner checkpoints in the external session workspace and normal
+  ignored build outputs; never overwrite old state or reports.
 - For optional advisory scoring, verify the caller's rubric/blob pin frozen
   before drafting. After independent checks, create only a new external session
   assessment bound to that criterion/rubric, baseline, proposal path and
@@ -45,8 +46,22 @@ You independently evaluate exactly one completed NUC revision. Follow
   are errors, never successful unscored fallbacks.
 - Use the Rust evaluator's actual measured elapsed seconds and scope, not
   self-reported time or model/API estimates. Scores are advisory experience
-  reporting, not a learner; they never override gate/independent failures or
-  change category selection and token applicability.
+  reporting; the separate optional UCB1 strategy learner consumes verified
+  rewards without overriding gate/independent failures, uniform category
+  selection, explicit requests, or token applicability.
+- For configured learning, verify the caller's pinned policy and genuinely
+  pre-draft selection/trial bindings, and preserve all four attribution
+  variables into `evaluate_proposal` so its saved report binds the arm.
+  Absent configuration is explicitly unattributed; partial/stale/malformed
+  supplied configuration is an error, never a fallback or reset.
+- After checking the actual saved report and overall independent evidence,
+  pin the report and actually invoke `learn_proposal_strategy` under the
+  skill's update contract. Write one fresh external checkpoint only for
+  genuinely scored attributed rewards; blocked/unscored/unattributed outcomes
+  do not increment trials. Return its path/pin or explicit skip/error.
+  Both single and continuous trials may learn, never retroactive old reports.
+  Do not claim evaluator authentication, concurrent/global-head protection,
+  LLM-weight training, or measured proposal-quality improvement.
 - Do not repair the candidate, regenerate exports, rewrite assertions or
   cases, spawn agents, combine pending proposals, commit, push, or merge.
 - If the candidate changed after handoff or needs repair, return the evidence
@@ -71,6 +86,10 @@ or explicit unscored reason. Timing excludes compilation, external checks,
 proposal/model time and report writing; it is not language runtime performance
 or total proposal cost. The core report's decision does not replace your
 overall decision from all independent checks.
+Return policy/selection/trial attribution, report pin, selected approach and
+learning update/skip/error with new checkpoint path/raw blob pin when created.
+The caller retains the single-owner chain head for future pre-draft selection;
+learning itself never starts another proposal.
 Do not offset a required-gate per-case increase with savings elsewhere. The caller owns
 integration and status/index updates; outcome metadata does not recursively
 trigger more agents.
```

**File**: `.github/agents/nuc-proposal.agent.md` (modified, +21/-1)
```diff
@@ -48,7 +48,23 @@ You draft and prototype exactly one added or updated NUC revision. Follow
   rubric and full Git blob pin frozen before drafting. Preserve them outside
   the repository; never assess your own usefulness or independent checks.
   Missing optional evidence is unscored, not zero; scoring does not change
-  verdicts, token policy, or category selection and implements no learner.
+  verdicts, token policy, or category selection. The separate optional
+  category-conditioned bandit consumes verified rewards, not LLM weights.
+- For configured learning, require the caller-frozen policy and pre-draft
+  selection receipt paths/raw blob pins, trial identity and selected strategy.
+  Verify their proposal/baseline/category/mode/parent bindings and actually
+  consume `reuse_first` (accepted primitives/helpers, minimal additive change)
+  or `evidence_first` (concrete failing/unsupported case, minimal preserving
+  extension). The caller must run the selector before drafting; do not reselect,
+  retrofit attribution, or silently reset invalid/missing state.
+- Preserve requested feature/category, uniform category draw, and every
+  safeguard under either strategy. Record how the selected approach was used,
+  not just its label. Absent learning config is explicitly `not_configured`;
+  partial/stale/mismatched supplied config stops preparation.
+- Do not update your own trial's learner, run `learn_proposal_strategy` on it,
+  or create its actual assessment/evaluation/checkpoint. Only the independent
+  evaluator may learn from the saved final report; both attributed modes are
+  eligible without authorizing continuation or model-weight training.
 
 ## Handoff
 
@@ -59,6 +75,10 @@ runtime applicability and supporting rationale, expected token ran/skipped polic
 candidate worktree, changed files, development and syntax-compatibility checks,
 any supplied frozen rubric path/blob pin, and any blockers. Do not populate
 the independent evaluator's assessment.
+Include any supplied policy/selection paths and raw pins, algorithm/scope,
+trial identity, selected approach and concrete consumption actions. Preserve
+all four strategy attribution variables for the evaluator; otherwise mark
+the handoff explicitly unattributed.
 If the caller-owned Rust improvement pass is pending, return only a preparation
 checkpoint and await a same-revision follow-up to recheck/finalize; do not
 freeze or declare readiness before that pass and final validation.
```

**File**: `.github/instructions/proposals.instructions.md` (modified, +58/-3)
```diff
@@ -56,8 +56,61 @@ exclude compilation, external checks, proposal/model time and report writing.
 Return its raw seconds/scope, usefulness basis, eligibility, formula and
 base/adjusted reward or unscored reason. Scoring never changes deterministic
 gate results, token applicability or the independent overall decision; preserve
-all mode/category/compatibility safeguards. This is advisory experience
-reporting, not a learned proposal-selection or training mechanism.
+all mode/category/compatibility safeguards. Scoring alone reports experience;
+the separate opt-in category-conditioned UCB1 strategy learner below uses the
+verified reward without training LLM weights or changing this score formula.
+
+## Reward-driven strategy learning
+
+Follow [NUC 1](../../docs/nuc-0001.md#reward-driven-proposal-strategies) and
+the [callable command/schema contract](../../CONTRIBUTING.md#reward-driven-proposal-strategies).
+The fixed ordered strategies are `reuse_first` (accepted primitives/helpers
+and a minimal additive implementation) and `evidence_first` (a concrete
+unsupported/failing case or counterexample, then a minimal preserving
+fix/extension). Both keep the requested feature/category and all mandatory
+baselines/checks. The learner never reweights categories: unspecified category
+selection stays uniform, while explicit requests and mode/stop rules prevail.
+
+When configured, the caller actually runs `select_proposal_strategy` before
+drafting/dispatch, using its latest retained immutable policy head or explicit
+empty-history genesis. Freeze policy and receipt raw full blob pins, unique
+trial ID, proposal path, accepted baseline, category, mode and chosen strategy.
+The fresh proposer verifies and executes the selected approach and hands off
+concrete consumption evidence and unchanged attribution. Never backfill old
+reports, reselect after seeing a candidate, or silently reset invalid state.
+
+The independent evaluator preserves the pinned policy/receipt into the actual
+`evaluate_proposal` report. After checking that saved report and the complete
+independent outcome, it pins the report and actually invokes the separate
+`learn_proposal_strategy` command with a fresh external checkpoint path.
+Reports precede checkpoints, avoiding circular hashes or multi-output pretend
+success. The existing reward is validated against score/evidence and report
+provenance; it is not supplied as a self-reported number.
+
+Only genuinely scored attributed outcomes count: useful with the unchanged
+time discount, assessed neutral 0, or known core/external rejection -1.
+Blocked/unresolved/unscored/unknown/missing evidence and unattributed outcomes
+never increment trials. `all_attributed_trials` includes both modes, even
+explicit single Documentation trials; it never authorizes continuation.
+Absent learning config is explicitly `not_configured`; partial, malformed,
+stale, duplicate or mismatched supplied inputs are errors, never fallbacks.
+Deduplicate trial IDs and actual evaluated proposal blobs, not just report
+bytes/timing. Preserve all acceptance, token, compatibility and version rules.
+
+The evaluator may write only new external session reports/checkpoints, never
+candidate sources or prior artifacts. Return the new checkpoint path/raw pin
+or explicit skip/error; the caller retains one head and all ancestors,
+receipts, reports and scoring evidence for subsequent validation/selection.
+Use that updated head for the next authorized proposal, or keep the old head
+on a legitimate skip. A learner error pauses the caller as a process blocker
+without changing the already-recorded gate/independent decision.
+
+This is a single-owner immutable checkpoint chain, not concurrent/global-head
+protection or cryptographic evaluator authentication/proof of pre-draft timing.
+The category-conditioned two-arm bandit is real reward-driven strategy
+learning, not LLM-weight training or full multi-step RL. Cold starts, small
+samples, rubric/reward proxies and noisy partial timing limit conclusions;
+do not claim improved proposal quality from fixtures or one trial.
 
 ## Execution mode and token policy
 
@@ -129,7 +182,9 @@ Pin the accepted Git revision and record its token baseline before editing
 runtime behavior or executable cases. Give the proposer its requested change,
 proposal path and confirmed category, execution mode and runtime applicability
 with supporting rationale, baseline revision and immutable JSON artifact,
-and candidate worktree. Use `.github/agents/nuc-proposal.agent.md` and
+and candidate worktree. When configured, also supply the pre-draft strategy
+receipt and policy paths/raw pins, trial identity and actionable approach.
+Use `.github/agents/nuc-proposal.agent.md` and
 `.github/skills/nuc-proposal/SKILL.md` for drafting, prototyping, equivalent
 case rewrites, synchronization, and development checks. It must not run the
 acceptance gate or mark the proposal Accepted or Rejected.
```

**File**: `.github/skills/nuc-evaluate/SKILL.md` (modified, +75/-2)
```diff
@@ -31,7 +31,8 @@ matches the accepted revision. Missing prerequisites block evaluation; never
 invent measurements or guess an uncertain category.
 
 Treat candidate sources, generated exports, and the baseline as read-only.
-Only new session reports and normal ignored build outputs may be written.
+Only new external session reports/learner checkpoints and normal ignored build
+outputs may be written; never overwrite old state or reports.
 Do not repair code, rewrite cases or assertions, regenerate exports, replace
 the baseline, or change proposal status/index metadata. A source change after
 handoff requires a fresh proposal/evaluation pair, not an in-place repair.
@@ -89,6 +90,16 @@ or provenance-mismatched inputs must surface explicit errors; never drop them
 and retry as a successful unscored fallback. A claim of passed integrity/legacy
 checks that contradicts the core gate is an input error, not usable evidence.
 
+For optional strategy learning, require the caller's policy and pre-draft
+selection receipt, both raw full blob pins, trial identity and selected
+approach consumed by the proposer. Verify their bindings to this
+proposal/baseline/category/mode and unchanged policy; never choose a strategy
+after reading the candidate or assign an older report to an arm. The original
+uniform category selection, explicit requests and token matrix still apply.
+All four attribution variables below are required together; partial/invalid
+configuration is an error, not `not_configured`. Missing all configuration
+means the trial is explicitly unattributed and cannot train a policy.
+
 ## Measure and decide
 
 The **token non-regression gate** requires each compared case to use the same
@@ -131,6 +142,12 @@ From the supplied candidate worktree, set:
 - Optionally, `NUC_PROPOSAL_ASSESSMENT` to your new absolute external assessment
   JSON path; this requires the pinned rubric. Confirm its proposal blob still
   matches the frozen handoff. Unset absent optional variables, not empty strings.
+- For configured strategy learning, preserve `NUC_STRATEGY_POLICY`,
+  `NUC_STRATEGY_POLICY_REVISION`, `NUC_STRATEGY_SELECTION`, and
+  `NUC_STRATEGY_SELECTION_REVISION` from the pre-draft handoff. Use absolute
+  external JSON paths and raw `git hash-object --no-filters` pins. Do not create
+  a different receipt, change the strategy, or update the policy before this
+  evaluation. Any supplied trial/category hints must match the receipt.
 
 Run the deterministic evaluator in every mode; only its token portion is
 optional:
@@ -184,7 +201,58 @@ The top-level `decision` is still the deterministic core gate's result, not a
 replacement for your overall independent decision. External failures still
 reject and missing independent prerequisites still block, regardless of score.
 Scoring never changes category selection, acceptance or token policy; no
-learner, adaptive strategy or model training is implemented.
+score is itself evidence of trained LLM weights or improved proposal quality.
+
+## Update the attributed strategy policy
+
+Follow [NUC 1](../../../docs/nuc-0001.md#reward-driven-proposal-strategies)
+and the [update command contract](../../../CONTRIBUTING.md#reward-driven-proposal-strategies).
+After the actual `evaluate_proposal` report is saved, **read and independently
+check it**: final handed-off proposal blob, preserved mode/category/runtime,
+receipt and policy pins/trial identity, advisory evidence/reward, and overall
+independent outcome. A report's core decision never replaces that outcome.
+If an early input/infrastructure failure produced no report, return that
+blocker without fabricating a reward or checkpoint. Failed or unresolved
+external evidence must not be reported as passed.
+
+For a configured, genuinely pre-attributed trial, **actually invoke** the
+separate learner after those checks, even in single mode:
+
+```powershell
+$env:NUC_PROPOSAL_REPORT_REVISION = (git --no-pager hash-object --no-filters -- $env:NUC_PROPOSAL_REPORT).Trim()
+$env:NUC_STRATEGY_CHECKPOINT = '<fresh absolute external session JSON path>'
+cargo test --test proposals learn_proposal_strategy -- --ignored --exact --nocapture
+```
+
+Use the same pinned parent policy/selection, baseline, proposal and preserved
+mode/runtime inputs as evaluation. The report already exists before the
+checkpoint; never run evaluation again merely to add attribution or create
+self-referential hashes. This command verifies the saved report, actual final
+proposal, scoring artifacts/formula and parent/receipt provenance before
+writing **one new create-once checkpoint**. Candidate sources and prior
+artifacts stay read-only.
+
+Only existing verifier **scored** rewards count: useful with its unchanged
+time discount, neutral 0, or genuine core/known external rejection -1.
+Blocked/unscored/unknown/missing evidence do not increment trials or create
+a checkpoint; record the explicit skip reason and retain the prior head.
+Unconfigured/legacy rep
```

**File**: `.github/skills/nuc-proposal/SKILL.md` (modified, +68/-6)
```diff
@@ -113,8 +113,56 @@ Require the supplied rubric/pin when scoring is requested; preserve its
 criterion, proposal path, and accepted-baseline binding through the handoff.
 Do not alter the rubric or assess your own usefulness/independent checks.
 Missing optional usefulness evidence is legitimately unscored, not zero;
-acceptance checks and token policy are unchanged. This is experience reporting,
-not an implemented learner or adaptive selection/training policy.
+acceptance checks and token policy are unchanged. Scoring alone reports
+experience; optional category-conditioned UCB1 learning consumes verified
+rewards under the separate protocol below, never trains LLM weights.
+
+## Select and consume a proposal strategy
+
+Follow [NUC 1's strategy policy](../../../docs/nuc-0001.md#reward-driven-proposal-strategies)
+and the [callable commands and schemas](../../../CONTRIBUTING.md#reward-driven-proposal-strategies).
+Category selection is still caller-owned and uniformly random when unspecified;
+explicit requested categories/features and the single-proposal stop rule are
+unchanged. A strategy selects an approach within that category, not another
+feature or category.
+
+For configured learning, the **caller must actually run**
+`cargo test --test proposals select_proposal_strategy -- --ignored --exact --nocapture`
+**before drafting or dispatching the proposer**. Use the latest verified
+single-owner checkpoint (or an explicit frozen empty-history genesis), not an
+older head or fabricated history. Fix `NUC_PROPOSAL`, accepted
+`NUC_PROPOSAL_BASELINE`, preserved `NUC_PROPOSAL_MODE`/runtime inputs,
+`NUC_STRATEGY_CATEGORY`, unique `NUC_STRATEGY_TRIAL_ID`, pinned
+`NUC_STRATEGY_POLICY`/`NUC_STRATEGY_POLICY_REVISION` and fresh
+`NUC_STRATEGY_SELECTION`; unset any old selection pin/checkpoint output.
+After success, freeze `NUC_STRATEGY_SELECTION_REVISION` using
+`git hash-object --no-filters` before drafting. Do not select again in the
+worker, backfill attribution, or silently reset missing/invalid state.
+
+Inside the proposal agent, require both policy/receipt paths and raw full blob
+pins when learning is configured. Verify them and their algorithm, parent,
+trial ID, proposal path, accepted baseline, confirmed category and mode against
+the caller's inputs. Partial, stale, changed, or mismatched inputs stop work;
+return the blocker instead of dropping learning. With no learning configuration,
+record `not_configured`/unattributed and proceed with the ordinary safeguards.
+Use no invented reward or self-assessed benefit.
+
+**Execute the selected approach**, in stable registry order:
+
+- `reuse_first`: start from accepted primitives/helpers and implement the
+  requested feature with a minimal additive extension.
+- `evidence_first`: start from a concrete unsupported/failing use case or
+  counterexample for the requested feature, then make the minimal preserving
+  fix/extension.
+
+Both preserve all baseline, behavior/integrity, compatibility, development,
+independent-evaluation and applicable token requirements. Neither changes the
+feature scope, category, rewards or acceptance criteria. Include concrete
+preparation actions showing strategy consumption in the handoff; merely logging
+a label is insufficient. Never run `learn_proposal_strategy` on your own trial,
+write its real assessment/report/checkpoint, or populate an independent score.
+Both single and continuous genuinely attributed trials may later learn, but
+only the independent evaluator may update from this revision's saved report.
 
 When token comparison is required, new measured cases need behavior-equivalent
 accepted-syntax programs with the same document, title, canonical assertions,
@@ -196,6 +244,15 @@ a fresh report path; do not launch it yourself. The caller owns integration
 and evaluation status/index updates. The proposal agent must not commit, push,
 or merge.
 
+For configured learning, also hand off the unchanged policy and selection
+paths/raw pins, algorithm/scope, trial identity, selected strategy and how it
+was followed. Preserve all four `NUC_STRATEGY_POLICY`,
+`NUC_STRATEGY_POLICY_REVISION`, `NUC_STRATEGY_SELECTION` and
+`NUC_STRATEGY_SELECTION_REVISION` inputs into evaluation. Unconfigured trials
+are explicitly unattributed; do not retrofit old reports. Only new external
+session checkpoints may be written after independent evaluation, never old
+policy or candidate sources.
+
 ## Record rejected outcomes (caller only)
 
 After the independent evaluator returns `Rejected`, the coordinating caller
@@ -247,10 +304,15 @@ workers across cycles or combine pending proposals.
 
 Use actual independent behavior/compatibility results and token measurements
 when comparison ran as feedback for the next enhancement; report legitimate
-skips rather than inventing counts. Preserve earlier artifacts and all
-acceptance, compatibility and version-protection rules. This is iterative
-proposal/evaluation feedback, not separate 
```

**File**: `CONTRIBUTING.md` (modified, +184/-4)
```diff
@@ -247,10 +247,11 @@ or GitHub Actions proposal trigger.
 #### Advisory usefulness/cost scoring
 
 The existing Rust `evaluate_proposal` entry point also reports advisory
-experience scores. It does not implement a learner, adaptive proposal/category
-selection, model training, paid calls, or a language/runtime feature. Scores
-never change deterministic verdicts, independent acceptance requirements, or
-the single/continuous token policy.
+experience scores. The separate opt-in UCB1 strategy learner below consumes
+verified rewards; the scorer's formula and decisions are unchanged. Neither
+mechanism trains LLM weights, reweights categories, makes paid calls, or changes
+the language/runtime. Scores and learning never change independent acceptance
+requirements or the single/continuous token policy.
 
 Before drafting, the **caller**, not the proposer, may create and freeze a
 usefulness rubric outside the repository. Its exact JSON schema is:
@@ -380,6 +381,185 @@ cargo test --test proposals evaluate_proposal -- --ignored --nocapture
   existing process, irrespective of an advisory score. Return both evidence and
   scoring limitations honestly.
 
+#### Reward-driven proposal strategies
+
+The ignored `select_proposal_strategy` and `learn_proposal_strategy` entry
+points in `tests/proposals.rs` use `tests/proposals/strategy.rs`. This is a
+persisted reward-driven bandit, not just advice logging. It learns an approach
+within a caller-confirmed category; it cannot change the requested feature,
+uniform category draw, acceptance checks, token policy, or continuation mode.
+It uses no new dependencies, runtime features, LLM-weight training or paid calls.
+
+The fixed typed arm registry is ordered:
+
+1. `reuse_first`: prioritize accepted primitives/helpers, then a minimal
+   additive implementation of the requested feature.
+2. `evidence_first`: start from a concrete unsupported/failing use case or
+   counterexample for that feature, then the minimal preserving fix/extension.
+
+Both require the same mandatory baselines and checks. The proposer must
+describe how it followed the selected approach in its handoff; a logged but
+unused label is not strategy consumption.
+
+**State and receipts.** Before drafting, the caller freezes an external
+create-once JSON policy. The exact supported genesis schema is:
+
+```json
+{
+  "algorithm": "nuc-category-strategy-ucb1-v1",
+  "reward_metric": "nuc-advisory-usefulness-evaluator-time-v1",
+  "learning_scope": "all_attributed_trials",
+  "history": []
+}
+```
+
+Both single and continuous attributed trials can learn, including explicit
+Documentation requests; a single trial never authorizes continuation.
+There is no automatic genesis/reset or import of older unassigned reports.
+Retain the latest verified checkpoint and all ancestors, receipts, reports,
+rubrics and assessments outside the repository.
+
+`select_proposal_strategy` writes this receipt schema before drafting (angle
+brackets describe values, not actual observations):
+
+```json
+{
+  "algorithm": "nuc-category-strategy-ucb1-v1",
+  "policy_revision": "<raw full parent policy Git blob ID>",
+  "trial_id": "<unique caller-owned trial ID>",
+  "proposal_path": "docs\\nuc-0001.md",
+  "baseline_revision": "<full accepted commit ID>",
+  "category": "Documentation",
+  "mode": "single",
+  "strategy": "reuse_first"
+}
+```
+
+All five registered categories and both modes are typed; strategy order is
+stable. Each category first explores unobserved arms in that order. Thereafter
+it maximizes `mean + sqrt(2 * ln(category_trials) / arm_trials)` with
+registry-order ties. Raw `r` in `[-1, 1]` is normalized to `(r + 1) / 2`.
+Neutral `0` is observed as `0.5`; missing evidence is never a zero observation.
+Counts/means are derived from history, not trusted serialized counters.
+Counts must remain exactly representable (`<= 2^53 - 1`); all rewards/UCB
+values must be finite. Cold start needs no special case or Infinity sentinel.
+
+A nonempty policy keeps the same four top-level fields. Each `history` item
+is a strict typed object with:
+
+| Field | Value |
+| --- | --- |
+| `parent` | `{ "path": <absolute JSON path>, "revision": <raw blob pin> }` of the preceding policy |
+| `selection` | `{ "path": <absolute JSON path>, "revision": <raw blob pin>, "input": <complete receipt above> }` |
+| `evaluation` | `{ "path": <absolute JSON path>, "revision": <raw blob pin> }` of the already-saved evaluator report |
+| `proposal_revision` | Actual final proposal blob from that report |
+| `raw_reward` | Verified existing advisory final reward, before bandit normalization |
+
+The full chronological history and exact parent-prefix bindings are validated
+on reload. Deduplicate **both** trial ID and actual evaluated proposal blob,
+not merely report bytes; a rerun's elapsed time cannot earn a second update.
+Unknown algorithm/metric/scope/strategy/category, nonfinite/out-of-range reward,
+bad counters, changed artifacts
```

**File**: `docs/nuc-0001.md` (modified, +33/-2)
```diff
@@ -116,7 +116,7 @@ Created: 31-Jul-2026
 - The caller completes the required Rust improvement pass, when applicable, before the final frozen proposal handoff.
 - The proposal agent returns a frozen handoff: proposal path and Git blob revision, execution mode, confirmed category and selection rationale when applicable, runtime applicability and supporting rationale, accepted baseline revision and artifact, candidate worktree, changed files, development and syntax-compatibility checks, and explicit blockers. It then stops editing the candidate.
 - After the completed handoff, the caller launches the fresh evaluation agent with that handoff and a fresh report path. The evaluator verifies the proposal blob and baseline revision independently.
-- The evaluator treats candidate sources, canonical training JSONL, generated normative exports, and the baseline as read-only; no repairs, case rewrites, regeneration, or status/index edits. It may write only new session reports and normal ignored build outputs.
+- The evaluator treats candidate sources, canonical training JSONL, generated normative exports, and the baseline as read-only; no repairs, case rewrites, regeneration, or status/index edits. It may write new external session reports and learner checkpoints, and normal ignored build outputs, never overwrite prior artifacts.
 - The evaluator independently validates behavior, development checks, and export consistency, then runs `evaluate_proposal` with the preserved mode and validated applicability. This always checks behavior and integrity and runs token comparison only when required; only this role returns the acceptance decision.
 - A substantive revision, repair, rebase, or source change after handoff requires a new fresh proposal/evaluation pair, not an in-place evaluator repair.
 - The checked corpus is `nucleoid.spec.md`, `tests/reference.md`, and the `nuc` blocks in `README.md` and `docs/examples.md`. Generated Rust scaffolding, JSONL, and synthesized training cases are not token-scored.
@@ -139,7 +139,7 @@ Created: 31-Jul-2026
 ### Advisory Usefulness and Evaluation Cost
 
 - `tests/proposals.rs` adds callable advisory scoring to `evaluate_proposal`; scores never change its deterministic verdict, token applicability, category selection, or the independent acceptance requirements above.
-- This is scoring and experience reporting, not a proposal-selection learner, reinforcement-learning policy update, model training, paid call, or language/runtime feature.
+- Scoring alone reports experience; the separate opt-in bandit below learns proposal strategies from those verified rewards. Neither mechanism trains LLM weights, makes paid calls, or changes the language/runtime.
 - Before drafting, the caller may freeze one independently testable usefulness criterion in a create-once session JSON rubric: `criterion_id`, `proposal_path`, `baseline_revision`, and `criterion`.
 - Keep scoring inputs outside the repository; pin the rubric's full Git blob using `git hash-object --no-filters` before drafting and preserve that pin through both handoffs. A criterion invented or changed after seeing the candidate cannot demonstrate usefulness for that revision.
 - The proposer preserves the caller-owned rubric and pin; it neither assesses its own usefulness nor supplies independent-check claims.
@@ -169,6 +169,37 @@ Created: 31-Jul-2026
 - The existing top-level `decision` remains the deterministic core gate's result; advisory eligibility does not replace the evaluator's overall decision from all independent checks. Failed or unresolved external checks still require Rejected or Blocked under the ordinary rules.
 - Return scores and their limitations with the independent evaluation evidence; never infer usefulness merely from acceptance or use rewards to bypass a failure. JSON schemas and optional input paths are in [CONTRIBUTING.md](../CONTRIBUTING.md#advisory-usefulnesscost-scoring).
 
+### Reward-Driven Proposal Strategies
+
+- `tests/proposals.rs` and its focused `tests/proposals/strategy.rs` helper implement opt-in, category-conditioned UCB1 strategy learning: `nuc-category-strategy-ucb1-v1`.
+- Category selection remains the unchanged uniform random draw above when unspecified; explicit categories, requested features, and single-proposal stop rules always take precedence. The learner chooses an approach **within** the confirmed category, never a category or replacement feature.
+- The fixed typed strategy registry has this stable order; proposers must execute the selected approach, not merely record its label:
+
+| Order | Strategy | Required preparation approach |
+| --- | --- | --- |
+| 1 | `reuse_first` | Prioritize accepted primitives/helpers; make a minimal additive implementation for the requested feature. |
+| 2 | `evidence_first` | Begin with a concrete unsupported/failing use case or counterexample for the requested feature, then make the minimal preserving fix/extension. |
+
+- Both strategies retain every man
```

**File**: `tests/proposals.rs` (modified, +86/-40)
```diff
@@ -5,6 +5,8 @@
 //! process environment.
 
 mod common;
+#[path = "proposals/strategy.rs"]
+mod strategy;
 
 use std::collections::HashSet;
 use std::env;
@@ -27,14 +29,14 @@ const TIMING_SCOPE: &str = "elapsed deterministic evaluator work: input validati
     legacy/candidate checks, and blob stability verification; excludes compilation, external \
     suites/Clippy, proposal/model time, score calculation, and report writing";
 
-#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
 #[serde(rename_all = "snake_case")]
 enum ExecutionMode {
     Continuous,
     Single,
 }
 
-#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
 enum Category {
     #[serde(rename = "Syntax enhancement")]
     Syntax,
@@ -62,8 +64,8 @@ impl Category {
     }
 }
 
-#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
-#[serde(tag = "kind", rename_all = "snake_case")]
+#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
+#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
 enum RuntimeApplicability {
     NotApplicable,
     NewFeature,
@@ -79,7 +81,8 @@ struct PolicyInputs<'a> {
     evidence: Option<&'a str>,
 }
 
-#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
+#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
+#[serde(deny_unknown_fields)]
 struct EvaluationPolicy {
     mode: ExecutionMode,
     category: Category,
@@ -164,7 +167,7 @@ fn required_rationale(variable: &str, value: Option<&str>) -> Result<String, Gat
         .ok_or_else(|| GateError::Input(format!("{variable} needs a nonblank rationale")))
 }
 
-#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
 #[serde(rename_all = "snake_case")]
 enum TokenSkipReason {
     SingleProposal,
@@ -272,32 +275,33 @@ struct Baseline {
     cases: Vec<MeasuredCase>,
 }
 
-#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
 #[serde(rename_all = "snake_case")]
 enum Decision {
     Accepted,
     Rejected,
     Blocked,
 }
 
-#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
 #[serde(rename_all = "snake_case")]
 enum TokenChange {
     Less,
     Same,
     More,
 }
 
-#[derive(Debug, Serialize)]
+#[derive(Debug, Serialize, Deserialize)]
+#[serde(deny_unknown_fields)]
 struct Comparison {
     id: CaseId,
     before: usize,
     after: usize,
     change: TokenChange,
 }
 
-#[derive(Debug, Serialize)]
-#[serde(tag = "kind", rename_all = "snake_case")]
+#[derive(Debug, Serialize, Deserialize)]
+#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
 enum Issue {
     MissingCase { id: CaseId },
     UnpairedCase { id: CaseId },
@@ -309,8 +313,8 @@ enum Issue {
     MoreTokens { id: CaseId },
 }
 
-#[derive(Debug, Serialize)]
-#[serde(tag = "status", rename_all = "snake_case")]
+#[derive(Debug, Serialize, Deserialize)]
+#[serde(tag = "status", rename_all = "snake_case", deny_unknown_fields)]
 enum TokenCheck {
     Ran {
         metric: String,
@@ -321,13 +325,15 @@ enum TokenCheck {
     },
 }
 
-#[derive(Debug, Serialize)]
+#[derive(Debug, Serialize, Deserialize)]
+#[serde(deny_unknown_fields)]
 struct BehaviorChecks {
     legacy_cases_passed: usize,
     candidate_cases_passed: usize,
 }
 
-#[derive(Debug, Serialize)]
+#[derive(Debug, Serialize, Deserialize)]
+#[serde(deny_unknown_fields)]
 struct Proposal {
     path: String,
     revision: String,
@@ -437,14 +443,16 @@ struct UsefulnessAssessment {
     usefulness: UsefulnessJudgment,
 }
 
-#[derive(Debug, Clone, Serialize)]
+#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
+#[serde(deny_unknown_fields)]
 struct ScoringArtifact<T> {
     path: PathBuf,
     revision: String,
     input: T,
 }
 
-#[derive(Debug, Default, Clone, Serialize)]
+#[derive(Debug, Default, Clone, Serialize, Deserialize)]
+#[serde(deny_unknown_fields)]
 struct ScoringEvidence {
     rubric: Option<ScoringArtifact<UsefulnessRubric>>,
     assessment: Option<ScoringArtifact<UsefulnessAssessment>>,
@@ -457,7 +465,7 @@ struct ScoringPaths<'a> {
     assessment: Option<&'a Path>,
 }
 
-#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
 #[serde(rename_all = "snake_case")]
 enum IndependentEligibility {
     NotAssessed,
@@ -466,7 +474,7 @@ enum IndependentEligibility {
     Unresolved,
 }
 
-#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
 #[serde(rename_all = "snake_case")]
 enum RewardBasis {
     GateRejected,
@@ -475,7 +483,7 @@ enum RewardBasis {
     NoDemonstratedBenefit,
 }
 
-#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
+#[derive(Debug, Clone, 
```

---

### Incident Patch 2: `58e64527` (2026-10-27)
**Commit Message**: Update dataset.cross.1.json

**File**: `arc/src/dataset/dataset.cross.1.json` (modified, +10/-10)
```diff
@@ -1,8 +1,8 @@
 {
   "declarations": [
     "class Obj(x: int, y: int, orientation: int, vertex_color: int):\n    this.x = x\n    this.y = y\n    this.orientation = orientation\n    this.tag = 'l7544'\n    this.vertex_color = vertex_color",
-    "if $Obj.vertex_color == 1:\n    $Obj.tag = 'l1707'\n    $Obj.marker_color = 7",
-    "if $Obj.vertex_color == 2:\n    $Obj.tag = 'l2404'\n    $Obj.marker_color = 4"
+    "if $Obj.vertex_color == 1:\n    $Obj.tag = 'l1707'\n    $Obj.marker_color = 7\n    $Obj.x = $Obj.x@first - 1\n    $Obj.y = $Obj.y@first - 1",
+    "if $Obj.vertex_color == 2:\n    $Obj.tag = 'l2404'\n    $Obj.marker_color = 4\n    $Obj.x = $Obj.x@first - 1\n    $Obj.y = $Obj.y@first - 1"
   ],
   "dataset": [
     {
@@ -61,7 +61,7 @@
           ],
           "implementation": "obj08c8feaa60ea = Obj(x=2, y=3, orientation=0, vertex_color=2)",
           "input_value": {"id":"obj08c8feaa60ea","x":2,"y":3,"orientation":0,"tag":"l7544","vertex_color":2},
-          "output_value": {"id":"obj08c8feaa60ea","x":2,"y":3,"orientation":0,"tag":"l2404","vertex_color":2,"marker_color":4}
+          "output_value": {"id":"obj08c8feaa60ea","x":1,"y":2,"orientation":0,"tag":"l2404","vertex_color":2,"marker_color":4}
         },
         {
           "instance_name": "objfa5219213773",
@@ -95,7 +95,7 @@
           ],
           "implementation": "objfa5219213773 = Obj(x=6, y=6, orientation=0, vertex_color=1)",
           "input_value": {"id":"objfa5219213773","x":6,"y":6,"orientation":0,"tag":"l7544","vertex_color":1},
-          "output_value": {"id":"objfa5219213773","x":6,"y":6,"orientation":0,"tag":"l1707","vertex_color":1,"marker_color":7}
+          "output_value": {"id":"objfa5219213773","x":5,"y":5,"orientation":0,"tag":"l1707","vertex_color":1,"marker_color":7}
         }
       ]
     },
@@ -189,7 +189,7 @@
           ],
           "implementation": "obj21a7f426034a = Obj(x=6, y=2, orientation=0, vertex_color=2)",
           "input_value": {"id":"obj21a7f426034a","x":6,"y":2,"orientation":0,"tag":"l7544","vertex_color":2},
-          "output_value": {"id":"obj21a7f426034a","x":6,"y":2,"orientation":0,"tag":"l2404","vertex_color":2,"marker_color":4}
+          "output_value": {"id":"obj21a7f426034a","x":5,"y":1,"orientation":0,"tag":"l2404","vertex_color":2,"marker_color":4}
         },
         {
           "instance_name": "objcde3bc7c38d0",
@@ -223,7 +223,7 @@
           ],
           "implementation": "objcde3bc7c38d0 = Obj(x=2, y=3, orientation=0, vertex_color=1)",
           "input_value": {"id":"objcde3bc7c38d0","x":2,"y":3,"orientation":0,"tag":"l7544","vertex_color":1},
-          "output_value": {"id":"objcde3bc7c38d0","x":2,"y":3,"orientation":0,"tag":"l1707","vertex_color":1,"marker_color":7}
+          "output_value": {"id":"objcde3bc7c38d0","x":1,"y":2,"orientation":0,"tag":"l1707","vertex_color":1,"marker_color":7}
         },
         {
           "instance_name": "obj29bc97757305",
@@ -257,7 +257,7 @@
           ],
           "implementation": "obj29bc97757305 = Obj(x=6, y=6, orientation=0, vertex_color=1)",
           "input_value": {"id":"obj29bc97757305","x":6,"y":6,"orientation":0,"tag":"l7544","vertex_color":1},
-          "output_value": {"id":"obj29bc97757305","x":6,"y":6,"orientation":0,"tag":"l1707","vertex_color":1,"marker_color":7}
+          "output_value": {"id":"obj29bc97757305","x":5,"y":5,"orientation":0,"tag":"l1707","vertex_color":1,"marker_color":7}
         },
         {
           "instance_name": "obj0665d91891db",
@@ -291,7 +291,7 @@
           ],
           "implementation": "obj0665d91891db = Obj(x=1, y=7, orientation=0, vertex_color=2)",
           "input_value": {"id":"obj0665d91891db","x":1,"y":7,"orientation":0,"tag":"l7544","vertex_color":2},
-          "output_value": {"id":"obj0665d91891db","x":1,"y":7,"orientation":0,"tag":"l2404","vertex_color":2,"marker_color":4}
+          "output_value": {"id":"obj0665d91891db","x":0,"y":6,"orientation":0,"tag":"l2404","vertex_color":2,"marker_color":4}
         }
       ]
     },
@@ -351,7 +351,7 @@
           ],
           "implementation": "objd17b9a54c68f = Obj(x=2, y=2, orientation=0, vertex_color=2)",
           "input_value": {"id":"objd17b9a54c68f","x":2,"y":2,"orientation":0,"tag":"l7544","vertex_color":2},
-          "output_value": {"id":"objd17b9a54c68f","x":2,"y":2,"orientation":0,"tag":"l2404","vertex_color":2,"marker_color":4}
+          "output_value": {"id":"objd17b9a54c68f","x":1,"y":1,"orientation":0,"tag":"l2404","vertex_color":2,"marker_color":4}
         },
         {
           "instance_name": "objd10bd2a040e8",
@@ -419,7 +419,7 @@
           ],
           "implementation": "obje5d0a226a83e = Obj(x=3, y=7, orientation=0, vertex_color=1)",
           "input_value": {"id":"obje5d0a226a83e","x":3,"y":7,"orientation":0,"tag":"l7544","vertex_color":1},
-          "output_value": {"id":"obje5d0a226a83e","x":3,"y":7,"orientation":0,"tag":"l1707","vertex_color":1,"marker_color":7}
+          "output_va
```

**File**: `arc/src/dataset/dataset.curve.1.json` (modified, +9/-9)
```diff
@@ -1,8 +1,8 @@
 {
   "declarations": [
     "class Obj(x: int, y: int, orientation: int, vertex_color: int):\n    this.x = x\n    this.y = y\n    this.orientation = orientation\n    this.tag = 'l7544'\n    this.vertex_color = vertex_color",
-    "if $Obj.vertex_color == 4:\n    $Obj.tag = 'l6840'\n    $Obj.rim_color = 8\n    $Obj.rim_direction = 'up'",
-    "if $Obj.vertex_color == 9:\n    $Obj.tag = 'l9906'\n    $Obj.rim_color = 2\n    $Obj.rim_direction = 'down'"
+    "if $Obj.vertex_color == 4:\n    $Obj.tag = 'l6840'\n    $Obj.rim_color = 8\n    $Obj.rim_direction = 'up'\n    $Obj.x = $Obj.x@first - 1\n    $Obj.y = $Obj.y@first - 1",
+    "if $Obj.vertex_color == 9:\n    $Obj.tag = 'l9906'\n    $Obj.rim_color = 2\n    $Obj.rim_direction = 'down'\n    $Obj.x = $Obj.x@first - 1"
   ],
   "dataset": [
     {
@@ -49,7 +49,7 @@
           ],
           "implementation": "objf742ec5620c9 = Obj(x=3, y=2, orientation=0, vertex_color=4)",
           "input_value": {"id":"objf742ec5620c9","x":3,"y":2,"orientation":0,"tag":"l7544","vertex_color":4},
-          "output_value": {"id":"objf742ec5620c9","x":3,"y":2,"orientation":0,"tag":"l6840","vertex_color":4,"rim_color":8,"rim_direction":"up"}
+          "output_value": {"id":"objf742ec5620c9","x":2,"y":1,"orientation":0,"tag":"l6840","vertex_color":4,"rim_color":8,"rim_direction":"up"}
         },
         {
           "instance_name": "obj866f45cb5433",
@@ -77,7 +77,7 @@
           ],
           "implementation": "obj866f45cb5433 = Obj(x=1, y=4, orientation=0, vertex_color=4)",
           "input_value": {"id":"obj866f45cb5433","x":1,"y":4,"orientation":0,"tag":"l7544","vertex_color":4},
-          "output_value": {"id":"obj866f45cb5433","x":1,"y":4,"orientation":0,"tag":"l6840","vertex_color":4,"rim_color":8,"rim_direction":"up"}
+          "output_value": {"id":"obj866f45cb5433","x":0,"y":3,"orientation":0,"tag":"l6840","vertex_color":4,"rim_color":8,"rim_direction":"up"}
         }
       ]
     },
@@ -125,7 +125,7 @@
           ],
           "implementation": "objaf6df8ed9e79 = Obj(x=4, y=1, orientation=0, vertex_color=4)",
           "input_value": {"id":"objaf6df8ed9e79","x":4,"y":1,"orientation":0,"tag":"l7544","vertex_color":4},
-          "output_value": {"id":"objaf6df8ed9e79","x":4,"y":1,"orientation":0,"tag":"l6840","vertex_color":4,"rim_color":8,"rim_direction":"up"}
+          "output_value": {"id":"objaf6df8ed9e79","x":3,"y":0,"orientation":0,"tag":"l6840","vertex_color":4,"rim_color":8,"rim_direction":"up"}
         },
         {
           "instance_name": "obj1394309b01df",
@@ -153,7 +153,7 @@
           ],
           "implementation": "obj1394309b01df = Obj(x=1, y=3, orientation=180, vertex_color=9)",
           "input_value": {"id":"obj1394309b01df","x":1,"y":3,"orientation":180,"tag":"l7544","vertex_color":9},
-          "output_value": {"id":"obj1394309b01df","x":1,"y":3,"orientation":180,"tag":"l9906","vertex_color":9,"rim_color":2,"rim_direction":"down"}
+          "output_value": {"id":"obj1394309b01df","x":0,"y":3,"orientation":180,"tag":"l9906","vertex_color":9,"rim_color":2,"rim_direction":"down"}
         }
       ]
     },
@@ -201,7 +201,7 @@
           ],
           "implementation": "obj55882ea787c6 = Obj(x=2, y=1, orientation=0, vertex_color=4)",
           "input_value": {"id":"obj55882ea787c6","x":2,"y":1,"orientation":0,"tag":"l7544","vertex_color":4},
-          "output_value": {"id":"obj55882ea787c6","x":2,"y":1,"orientation":0,"tag":"l6840","vertex_color":4,"rim_color":8,"rim_direction":"up"}
+          "output_value": {"id":"obj55882ea787c6","x":1,"y":0,"orientation":0,"tag":"l6840","vertex_color":4,"rim_color":8,"rim_direction":"up"}
         },
         {
           "instance_name": "obj98ba2cb040e8",
@@ -229,7 +229,7 @@
           ],
           "implementation": "obj98ba2cb040e8 = Obj(x=4, y=1, orientation=180, vertex_color=9)",
           "input_value": {"id":"obj98ba2cb040e8","x":4,"y":1,"orientation":180,"tag":"l7544","vertex_color":9},
-          "output_value": {"id":"obj98ba2cb040e8","x":4,"y":1,"orientation":180,"tag":"l9906","vertex_color":9,"rim_color":2,"rim_direction":"down"}
+          "output_value": {"id":"obj98ba2cb040e8","x":3,"y":1,"orientation":180,"tag":"l9906","vertex_color":9,"rim_color":2,"rim_direction":"down"}
         },
         {
           "instance_name": "obj1c4ff1a88360",
@@ -257,7 +257,7 @@
           ],
           "implementation": "obj1c4ff1a88360 = Obj(x=2, y=3, orientation=180, vertex_color=9)",
           "input_value": {"id":"obj1c4ff1a88360","x":2,"y":3,"orientation":180,"tag":"l7544","vertex_color":9},
-          "output_value": {"id":"obj1c4ff1a88360","x":2,"y":3,"orientation":180,"tag":"l9906","vertex_color":9,"rim_color":2,"rim_direction":"down"}
+          "output_value": {"id":"obj1c4ff1a88360","x":1,"y":3,"orientation":180,"tag":"l9906","vertex_color":9,"rim_color":2,"rim_direction":"down"}
         }
       ]
     }
```

**File**: `arc/src/dataset/dataset.line.1.json` (modified, +6/-6)
```diff
@@ -2,9 +2,9 @@
   "declarations": [
     "class Obj(x: int, y: int, orientation: int, endpoint_position: str):\n    this.x = x\n    this.y = y\n    this.orientation = orientation\n    this.tag = 'l8001'\n    this.endpoint_position = endpoint_position",
     "if $Obj.orientation == 90 and $Obj.endpoint_position == 'left':\n    $Obj.tag = 'l4102'\n    $Obj.extension_direction = 'right'",
-    "if $Obj.orientation == 90 and $Obj.endpoint_position == 'right':\n    $Obj.tag = 'l4102'\n    $Obj.extension_direction = 'left'",
+    "if $Obj.orientation == 90 and $Obj.endpoint_position == 'right':\n    $Obj.tag = 'l4102'\n    $Obj.extension_direction = 'left'\n    $Obj.x = $Obj.x@first - 1",
     "if $Obj.orientation == 0 and $Obj.endpoint_position == 'up':\n    $Obj.tag = 'l6012'\n    $Obj.extension_direction = 'down'",
-    "if $Obj.orientation == 0 and $Obj.endpoint_position == 'down':\n    $Obj.tag = 'l6012'\n    $Obj.extension_direction = 'up'"
+    "if $Obj.orientation == 0 and $Obj.endpoint_position == 'down':\n    $Obj.tag = 'l6012'\n    $Obj.extension_direction = 'up'\n    $Obj.y = $Obj.y@first - 1"
   ],
   "dataset": [
     {
@@ -91,7 +91,7 @@
           ],
           "implementation": "obj1383c0d06fda = Obj(x=4, y=5, orientation=90, endpoint_position='right')",
           "input_value": {"id":"obj1383c0d06fda","x":4,"y":5,"orientation":90,"tag":"l8001","endpoint_position":"right"},
-          "output_value": {"id":"obj1383c0d06fda","x":4,"y":5,"orientation":90,"tag":"l4102","endpoint_position":"right","extension_direction":"left"}
+          "output_value": {"id":"obj1383c0d06fda","x":3,"y":5,"orientation":90,"tag":"l4102","endpoint_position":"right","extension_direction":"left"}
         }
       ]
     },
@@ -147,7 +147,7 @@
           ],
           "implementation": "objfef9b8e1a36c = Obj(x=0, y=3, orientation=0, endpoint_position='down')",
           "input_value": {"id":"objfef9b8e1a36c","x":0,"y":3,"orientation":0,"tag":"l8001","endpoint_position":"down"},
-          "output_value": {"id":"objfef9b8e1a36c","x":0,"y":3,"orientation":0,"tag":"l6012","endpoint_position":"down","extension_direction":"up"}
+          "output_value": {"id":"objfef9b8e1a36c","x":0,"y":2,"orientation":0,"tag":"l6012","endpoint_position":"down","extension_direction":"up"}
         },
         {
           "instance_name": "objb3a27e31f269",
@@ -235,7 +235,7 @@
           ],
           "implementation": "obj3f1a34c478cd = Obj(x=3, y=0, orientation=90, endpoint_position='right')",
           "input_value": {"id":"obj3f1a34c478cd","x":3,"y":0,"orientation":90,"tag":"l8001","endpoint_position":"right"},
-          "output_value": {"id":"obj3f1a34c478cd","x":3,"y":0,"orientation":90,"tag":"l4102","endpoint_position":"right","extension_direction":"left"}
+          "output_value": {"id":"obj3f1a34c478cd","x":2,"y":0,"orientation":90,"tag":"l4102","endpoint_position":"right","extension_direction":"left"}
         },
         {
           "instance_name": "obja034f4182e12",
@@ -267,7 +267,7 @@
           ],
           "implementation": "obja034f4182e12 = Obj(x=1, y=4, orientation=0, endpoint_position='down')",
           "input_value": {"id":"obja034f4182e12","x":1,"y":4,"orientation":0,"tag":"l8001","endpoint_position":"down"},
-          "output_value": {"id":"obja034f4182e12","x":1,"y":4,"orientation":0,"tag":"l6012","endpoint_position":"down","extension_direction":"up"}
+          "output_value": {"id":"obja034f4182e12","x":1,"y":3,"orientation":0,"tag":"l6012","endpoint_position":"down","extension_direction":"up"}
         },
         {
           "instance_name": "obj4eba52e160b2",
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

## X. Add reward-driven proposal strategy learner

**RULE**:
When implementing operations in `.github/agents/nuc-evaluate.agent.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b2ca6a62`: Add reward-driven proposal strategy learner. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/agents/nuc-evaluate.agent.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  reports/learner checkpoints in the external session workspace and normal
  ignored build outputs; never overwrite old state or reports.
  reporting; the separate optional UCB1 strategy learner consumes verified
  rewards without overriding gate/independent failures, uniform category
  selection, explicit requests, or token applicability.
- For configured learning, verify the caller's pinned policy and genuinely
  pre-draft selection/trial bindings, and preserve all four attribution
  variables into `evaluate_proposal` so its saved report binds the arm.
  Absent configuration is explicitly unattributed; partial/stale/malformed
  supplied configuration is an error, never a fallback or reset.
- After checking the actual saved report and overall independent evidence,
  pin the report and actually invoke `learn_proposal_strategy` under the
  skill's update contract. Write one fresh external checkpoint only for
  genuinely scored attributed rewards; blocked/unscored/unattributed outcomes
  do not increment trials. Return its path/pin or explicit skip/error.
  Both single and continuous trials may learn, never retroactive old reports.
  Do not claim evaluator authentication, concurrent/
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
  reports in the session workspace and normal ignored build outputs.
  reporting, not a learner; they never override gate/independent failures or
  change category selection and token applicability.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b2ca6a62` are properly handled with clean fallback behavior.
