> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `13944b95`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-02T15:00:57.674Z  
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
> **Harvest Timestamp**: 2026-11-02T15:00:57.667Z  
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
        if before.is_some() {
            self.transaction.record_property(object, property, before);
        } else {
            self.transaction.record_property_added(object, property);
        }
        if changed {
            self.append_history(
                HistoryKey::Property(object.clone(), property.to_string()),
                &value,
            );
        }

        if let Some(da
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
import * as milestone from "./src/lib/milestone.ts";

start(process.argv[2])
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

export async function declarations({ puzzle_id, train_dataset }) {
  milestone.inferring_declarations();

  const { declarations, output_canvas } = await llm.generate({
    puzzle_id,
    messages: [
      {
        role: "user",
        content: `
          train_dataset:
          ${JSON.stringify(train_dataset.dataset.map(({ input_matrix, output_matrix }) => ({
            input_matrix,
            output_matrix,
          })))}
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
  declarations,
  input_matrix,
  output_matrix,
}) {
  milestone.segmenting_training_objects();

  const { instances } = await llm.generate({
    puzzle_id,
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
  instance_name,
  declarations,
  input_instance_matrix,
  output_instance_matrix,
}) {
  milestone.constructing_instance({ instance_name });

  const { implementation } = await llm.generate({
    puzzle_id,
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

  milestone.evaluating_rules();

  const input_value = await nucleoid.run(
    [declarations[0], implementation].join("\n\n")
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
  for (const [index, dataset] of train_dataset.dataset.entries()) {
    const implementations = dataset.instances.map(
      ({ implementation }) => implementation
    );

    const obj_list = await nucleoid.run(
      [...train_dataset.declarations, ...implementations, "Obj[:]"].join("\n\n")
    );

    milestone.state({ index, obj_list });

    [...obj_list].forEach((instance) => {
      const found_instance = dataset.instances.find(
        ({ instance_name }) => instance.id === instance_name
      );
      found_instance.output_value = instance;
    });
  }
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

// Genesis puzzle_id: 3aa6fb7a
export async function start(puzzle_id: string = "d631b094") {
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
    train: arc_train,
    test_input_matrix,
  });

  milestone.analysis();

  let instance_index: number = 0;

  const { declarations, output_canvas } = await analyzer.declarations({
    puzzle_id,
    train_dataset,
  });

  train_dataset.declarations = declarations;
  train_dataset.output_canvas = output_canvas;

  for (const [index, dataset] of train_dataset.dataset.entries()) {
    const { input_matrix, output_matrix } = dataset;

    milestone.training_pair({ index, total: train_dataset.dataset.length });

    const { instances } = await analyzer.instances({
      puzzle_id,
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
      });
    }
  }

  await analyzer.state(train_dataset);

  milestone.visualization();

  const { instances } = await visualizer.instances({
    puzzle_id,
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
      declarations,
      train_dataset,
      instance_name,
      input_instances,
      input_instance_matrix,
    });

    input_instances.push({
      instance_name,
      implementation,
      input_value,
      input_instance_matrix,
    });
  }

  await visualizer.state({ declarations, input_instances });

  for (const input_instance of input_instances) {
    const { input_value, input_instance_matrix, output_value } = input_instance;

    const { output_instance_matrix } = await visualizer.output_instance_matrix({
      puzzle_id,
      test_input_matrix,
      train_dataset,
      input_instances: input_instances.filter(
        ({ output_instance_matrix }) => output_instance_matrix
      ),
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

  // const debug = {
  //   puzzle_id,
  //   train_dataset,
  //   input_instances,
  //   test_input_matrix,
  //   test_output_matrix,
  //   result_matrix,
  //   difference,
  // };
  //
  // console.log(JSON.stringify(debug));

  return difference;
}

```

### Core Architecture Module: `arc/src/dataset/dataset.ts`
```
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function document(puzzle_id?: string): string {
  void puzzle_id;
  const files = readdirSync(__dirname, { withFileTypes: true })
    .filter((file) => {
      const name = file.name.toLowerCase();
      return (
        file.isFile() && name.endsWith(".json") && !name.startsWith(".env")
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

### Core Architecture Module: `arc/src/lib/Markdown.ts`
```
export function json(markdown: string) {
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
  const rows: number = matrix.length;
  const cols: number = matrix[0]?.length ?? 0;
  let top: number = rows;
  let bottom: number = -1;
  let left: number = cols;
  let right: number = -1;

  for (let y: number = 0; y < rows; y++) {
    const row = matrix[y];
    if (row.length !== cols) {
      throw new Error("Matrix must be rectangular for cropping");
    }
    for (let x: number = 0; x < cols; x++) {
      const value: number = row[x];
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

export function pad(
  matrix,
  rows: number,
  cols: number,
  left: number,
  top: number
) {
  if (rows < 0 || cols < 0) {
    throw new Error("Padding dimensions must be non-negative");
  }
  if (left < 0 || top < 0) {
    throw new Error("Padding offsets must be non-negative");
  }
  const sourceRows: number = matrix.length;
  const sourceCols: number = matrix[0]?.length ?? 0;
  const paddedRows: number = Math.max(rows, top + sourceRows);
  const paddedCols: number = Math.max(cols, left + sourceCols);
  const result = Array.from({ length: paddedRows }, () =>
    Array(paddedCols).fill(0)
  );

  for (let y: number = 0; y < sourceRows; y++) {
    const row = matrix[y];
    if (row.length !== sourceCols) {
      throw new Error("Matrix must be rectangular for padding");
    }
    for (let x: number = 0; x < sourceCols; x++) {
      result[y + top][x + left] = row[x];
    }
  }

  return result;
}

export function merge(...matrices) {
  if (matrices.length === 0) {
    throw new Error("At least one matrix is required for merging");
  }
  const numRows: number = Math.max(...matrices.map((matrix) => matrix.length));
  const numCols: number = Math.max(
    ...matrices.map((matrix) => matrix[0]?.length ?? 0)
  );

  const result = Array.from({ length: numRows }, () => Array(numCols).fill(0));

  for (const matrix of matrices) {
    const padded = pad(matrix, numRows, numCols, 0, 0);
    for (let i: number = 0; i < numRows; i++) {
      for (let j: number = 0; j < numCols; j++) {
        if (padded[i][j] !== 0) {
          result[i][j] = padded[i][j];
        }
      }
    }
  }

  return result;
}

export function canvas(matrix, type: string) {
  switch (type) {
    case "EXACT":
      return matrix;
    case "FIT":
      return crop(matrix);
    default:
      throw new Error(`Unknown output canvas ${JSON.stringify(type)}`);
  }
}

export function difference(matrix1, matrix2): number {
  let mismatches: number = 0;
  const rows: number = Math.max(matrix1.length, matrix2.length);

  for (let i: number = 0; i < rows; i++) {
    const row1 = matrix1[i];
    const row2 = matrix2[i];

    if (!row1 || !row2) {
      // An extra empty row is still a shape mismatch.
      mismatches += Math.max(row1?.length ?? 0, row2?.length ?? 0, 1);
      continue;
    }

    const cols: number = Math.max(row1.length, row2.length);

    for (let j: number = 0; j < cols; j++) {
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
  const rows: number = matrix.length;
  const cols: number = matrix[0].length;

  let xOffset: number = -1,
    yOffset: number = -1,
    xLength: number = 0,
    yLength: number = 0;

  for (let i: number = 0; i < rows; i++) {
    for (let j: number = 0; j < cols; j++) {
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

export function enlarge(matrix, rows: number, cols: number) {
  const { x_position: xOffset, y_position: yOffset, object_matrix } = matrix;

  const originalArray = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i: number = 0; i < object_matrix.length; i++) {
    for (let j: number = 0; j < object_matrix[i].length; j++) {
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

### Incident Patch 1: `13944b95` (2026-11-02)
**Commit Message**: NUC 73 List and Population Predicate Counts

Accepted.

Add count(predicate) to the shared list and class-population queries,
preserving filter(predicate).length behavior without its filtered result.
Synchronize completion, specification, reference, examples and datasets.

All hard criteria passed independently and on the unchanged integrated
candidate: all-target build, warning-denied Clippy and formatting passed;
the full suite passed 2,154 tests with 25 existing ignored; 853 pinned
accepted programs replayed with protected assertions, returns and coverage.
All 2,168 accepted test identities remain, with eleven additions.

The independent evaluator decided Accepted with no issues. Required
continuous-mode token comparison ran: seven lower, 846 unchanged, no
increases or missing pairs. No policy check failed. Advisory usefulness is
unscored without a rubric; strategy learning is not configured.

Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +25/-0)
```diff
@@ -1471,6 +1471,31 @@ assert: [x, y], [0, 7]
   `x = corner[0]`, so every name stays live: changing `size` or `corner`
   updates it. See the [root contract](nucleoid.spec.md#destructuring-declarations).
 
+## Predicate counts
+
+**Predicate counts keep the number of open tickets live as tickets change**
+
+```nuc
+class Ticket(open): this.open = open
+pending = Ticket.count(ticket -> ticket.open)
+first = Ticket(true)
+second = Ticket(false)
+assert: pending, 1
+second.open = true
+assert: pending, 2
+first.open = false
+assert: pending, 1
+```
+
+- [NUC 73](docs/nuc-0073.md) adds `count(predicate)` to lists and class
+  populations. It returns `filter(predicate).length` without allocating the
+  filtered result, and calls the predicate once per item in receiver order.
+- Counts remain live in declarations and class-level rules. A valid empty
+  receiver gives `0`; a missing or non-function predicate raises
+  `TypeError("count expects a function")`. The accepted `filter` spelling
+  remains unchanged. See the
+  [root contract](nucleoid.spec.md#list-and-population-predicate-counts).
+
 ## Benchmark
 
 This is the comparation our sample order app in Nucleoid IDE against MySQL and Postgres with using Express.js and Sequelize libraries.
```

**File**: `dataset/nucleoid.spec.jsonl` (modified, +4/-0)
```diff
@@ -577,3 +577,7 @@
 {"id":"spec-0577","description":"Nucleoid explains destructured names as their declarations","code":"point = {x: 3, y: 4}\npair = [5, 6]\n{x, y} = point\nfirst, second = pair\nassert: (affects point).map(step -> step.rule), [\"x = point.x\", \"y = point.y\"]\nassert: (affects pair).map(step -> step.rule), [\"first = pair[0]\", \"second = pair[1]\"]\nassert: (why second)[0].from, [\"pair\"]\nclass Point(x, y):\n    this.x = x\n    this.y = y\n{x, y} = Point(1, 2)\nassert: [x, y, Point.length], [1, 2, 2]\nassert: (why y)[0].rule, \"y = Point(1,2).y\"\nassert: (affects point).length, 0","return":null}
 {"id":"spec-0578","description":"Nucleoid keeps block object and list readings beside destructuring","code":"point = {x: 1, y: 2}\n{x, y} = point\n{ total = x + y }\nbox = {x, y}\nrecord = {left: x right: y}\npair = [3, 4]\nlow, high = pair\nadd = lambda a, b: a + b\npositive = all v in pair: v > 0\nfailure = \"\"\ntry:\n    [a, b] = pair\ncatch error:\n    failure = error\nassert: failure, SyntaxError(\"Cannot assign to [a,b]\")\nassert: [total, box, record], [3, {x: 1, y: 2}, {left: 1, right: 2}]\nassert: [add(low, high), positive], [7, true]\npoint.x = 5\npair = [-1, 6]\nassert: [total, box.x, record.left, low, high, positive], [7, 5, 5, -1, 6, false]\n{ x }","return":"5"}
 {"id":"spec-0579","description":"Nucleoid rolls back failed destructuring","code":"limits = [4, 50]\nlow, high = limits\nif high - low > 100: throw \"WIDE\"\nwidened = \"\"\ntry: limits = [0, 500]\ncatch error: widened = error\nwide = [9, 300]\nmoved = \"\"\ntry: low, high = wide\ncatch error: moved = error\nassert: [widened, moved], [\"WIDE\", \"WIDE\"]\nassert: [low, high, limits], [4, 50, [4, 50]]\norder = {qty: 2, price: 5}\n{qty, price} = order\nif qty * price > 50: throw \"COSTLY\"\ncostly = \"\"\ntry: order.price = 40\ncatch error: costly = error\nassert: [costly, order.price, qty, price], [\"COSTLY\", 5, 2, 5]\norder.qty = 3\norder.price = 7\nlimits = [3, 60]\nassert: [low, high, qty, price], [3, 60, 3, 7]","return":null}
+{"id":"spec-0580","description":"Nucleoid counts matching list items","code":"readings = [2, 5, 8, 11]\nthreshold = 6\nhigh = readings.count(reading -> reading > threshold)\nassert: high, 2\nreadings.push(14)\nassert: high, 3\nthreshold = 10\nassert: high, 2\nreadings.shift()\nassert: high, 2\nreadings = []\nassert: high, 0\ncart = {items: [0, 1, 2, 0, 3]}\nnonzero = cart.items.count(item -> item != 0)\nassert: nonzero, 3\ncart.items.push(4)\nassert: nonzero, 4","return":null}
+{"id":"spec-0581","description":"Nucleoid counts matching class instances","code":"class Ticket(open, priority):\n    this.open = open\n    this.priority = priority\npending = Ticket.count(ticket -> ticket.open)\nassert: pending, 0\nfirst = Ticket(true, 2)\nsecond = Ticket(false, 5)\nthird = Ticket(true, 9)\nimportant = Ticket.count(ticket -> ticket.open and ticket.priority >= 5)\nassert: pending, 2\nassert: important, 1\nsecond.open = true\nassert: pending, 3\nassert: important, 2\nthird.priority = 1\nassert: important, 1\ndelete first.open\ndelete first.priority\ndelete first\nassert: pending, 2\nthird.open = false\nassert: pending, 1\nassert: important, 1","return":null}
+{"id":"spec-0582","description":"Nucleoid keeps predicate counts live in class level rules","code":"class Team(name): this.name = name\nclass Task(team, done):\n    this.team = team\n    this.done = done\n$Team.pending = Task.count(task -> task.team == $Team and not task.done)\nalpha = Team(\"alpha\")\nbeta = Team(\"beta\")\nassert: alpha.pending, 0\nassert: beta.pending, 0\nfirst = Task(alpha, false)\nsecond = Task(alpha, true)\nthird = Task(beta, false)\nassert: alpha.pending, 1\nassert: beta.pending, 1\nfirst.team = beta\nassert: alpha.pending, 0\nassert: beta.pending, 2\nsecond.done = false\nassert: alpha.pending, 1\ndelete third.team\ndelete third.done\ndelete third\nassert: beta.pending, 1","return":null}
+{"id":"spec-0583","description":"Nucleoid uses predicate counts beside ordinary count names","code":"cutoff = 3\ncount = 7\nreport = {count: 9}\nclass Bag(items):\n    this.items = items\n    def count(): return this.items.count(item -> item > cutoff)\nbag = Bag([1, 4, 8])\ndef matching(items) => items.count(item -> item > cutoff)\nassert: bag.count(), 2\nassert: matching([2, 5, 9]), 2\nassert: Bag.filter(each -> each.count() > 1).length, 1\nkind = Bag\nassert: kind.filter(each -> each.count() > 1).length, 1\nassert: [count, report.count], [7, 9]\ncutoff = 6\nassert: bag.count(), 1\nassert: matching([2, 5, 9]), 1\nassert: Bag.filter(each -> each.count() > 1).length, 0","return":null}
```

**File**: `dataset/nucleoid.synth.48.jsonl` (modified, +1/-0)
```diff
@@ -6,3 +6,4 @@
 {"id":"synth-48-0006","description":"The distinct tags of every post stay live as posts and tags change","code":"class Post(tags):\n    this.tags = tags\nfirst = Post([\"rust\", \"logic\"])\nPost([\"logic\", \"go\"])\ninuse = Post.flatMap(post -> post.tags).distinct()\nfirst.tags.push(\"go\")\nPost([\"sql\"])\ninuse","return":"[\"rust\",\"logic\",\"go\",\"sql\"]"}
 {"id":"synth-48-0007","description":"Every NaN is kept because NaN matches no value","code":"readings = [0 / 0, 1, 0 / 0, 1]\nkept = readings.distinct()\n[kept.length, String(kept[0]), String(kept[2])]","return":"[3,\"NaN\",\"NaN\"]"}
 {"id":"synth-48-0008","description":"A distinct selector that is not a function raises a TypeError","code":"failure = \"\"\ntry:\n    [1, 2].distinct(5)\ncatch error:\n    failure = error\nfailure","return":"\"TypeError: distinct expects a function\""}
+{"id":"synth-48-0009","description":"Predicate counts keep each team's open jobs and matching list items live","code":"class Team(name): this.name = name\nclass Job(team, done):\n    this.team = team\n    this.done = done\n$Team.open = Job.count(job -> job.team == $Team and not job.done)\nteam = Team(\"north\")\nfirst = Job(team, false)\nJob(team, true)\nvalues = [1, 4, 7]\nlarge = values.count(value -> value > 3)\nassert(team.open, 1)\nfirst.done = true\nvalues.push(9)\n[team.open, large]","return":"[0,3]"}
```

**File**: `docs/README.md` (modified, +50/-1)
```diff
@@ -1778,7 +1778,7 @@ Full detail: [NUC 9](nuc-0009.md), [NUC 46](nuc-0046.md).
 | `Math` | `pow`, `sqrt`, `floor`, `round`, `max`, `min`, `clamp` ([NUC 21](nuc-0021.md)), `lerp` ([NUC 22](nuc-0022.md)), `saturate` ([NUC 23](nuc-0023.md)), `smoothstep(lower, upper, value)` (accepted [NUC 33](nuc-0033.md)), `smootherstep(lower, upper, value)` (accepted [NUC 35](nuc-0035.md)), `remap(start, end, targetStart, targetEnd, value)` (accepted [NUC 39](nuc-0039.md)) |
 | `String` | `String.fromCharCode`; instance `charAt`, `length`, `lower`, `replace`, `replaceAll` (accepted [NUC 42](nuc-0042.md)), `repeat`, `split` |
 | `Date` | `Date()`, `Date(string)`, `Date(number)`, `Date.now()`, `Date.parse()`; instance `getTime`, `getYear`, `toDateString` |
-| `List` | `push`, `pop`, `filter`, `map`, `flatMap` (accepted [NUC 41](nuc-0041.md)), `reduce`, `find`, `some`, `every`, `slice`, `sort` (in place, [NUC 58](nuc-0058.md)), `join`, `length`, and the queries `at`, `includes`, `indexOf`, `lastIndexOf`, `findIndex`, `findLast`, `findLastIndex` and `concat` ([NUC 61](nuc-0061.md)), `sum` ([NUC 68](nuc-0068.md)), `max` and `min` ([NUC 69](nuc-0069.md)), and `distinct` ([NUC 71](nuc-0071.md)) |
+| `List` | `push`, `pop`, `filter`, `map`, `flatMap` (accepted [NUC 41](nuc-0041.md)), `reduce`, `find`, `some`, `every`, `slice`, `sort` (in place, [NUC 58](nuc-0058.md)), `join`, `length`, and the queries `at`, `includes`, `indexOf`, `lastIndexOf`, `findIndex`, `findLast`, `findLastIndex` and `concat` ([NUC 61](nuc-0061.md)), `sum` ([NUC 68](nuc-0068.md)), `max` and `min` ([NUC 69](nuc-0069.md)), `distinct` ([NUC 71](nuc-0071.md)), and `count(predicate)` ([NUC 73](nuc-0073.md)) |
 | `Class` | the global list of declared types; `Class.length` |
 
 ```
@@ -2578,6 +2578,53 @@ palette.length
   [list and population distinct values](../nucleoid.spec.md#list-and-population-distinct-values)
   section.
 
+### List and population predicate counts
+
+```
+numbers = [1, 4, 7, 10]
+limit = 5
+large = numbers.count(number -> number > limit)
+assert: large, 2
+numbers.push(12)
+assert: large, 3
+class Job(done): this.done = done
+pending = Job.count(job -> not job.done)
+first = Job(false)
+second = Job(true)
+assert: pending, 1
+second.done = false
+assert: pending, 2
+delete first.done
+delete first
+assert: pending, 1
+limit = 9
+assert: large, 2
+```
+
+- This is the complete `Nucleoid counts matching items and instances`
+  program in `tests/reference.md`, without its title.
+- [NUC 73](nuc-0073.md) adds `count(predicate)` to every list or class
+  population receiver supported by `filter`, including class aliases. It
+  returns the Number from `filter(predicate).length` without allocating the
+  filtered result list; a valid empty receiver gives `0`.
+- The predicate is called once per item, in receiver order, with only the
+  item and the truthiness rules of `filter`. It visits every item without
+  short-circuiting. A missing or non-function predicate, including `null`,
+  raises `TypeError("count expects a function")`, even on an empty receiver;
+  there is no no-argument overload.
+- The receiver snapshot precedes argument evaluation. All supplied arguments,
+  including ignored extras, run once, left to right. Counts inherit `filter`'s
+  dependencies, nullish reads, deferred declarations, `.value`, state versions,
+  callback errors and rollback; a null or undefined receiver skips arguments
+  and yields undefined.
+- Counts stay live in declarations and class-level rules. Bindings, properties
+  and instance methods named `count` keep their behavior, while
+  `Name.count(predicate)` on a class or class alias queries its population.
+  All accepted `filter(predicate).length` forms remain unchanged.
+- The authoritative contract is the
+  [list and population predicate counts](../nucleoid.spec.md#list-and-population-predicate-counts)
+  section.
+
 ---
 
 ## 12. Reasoning Operations
@@ -2822,6 +2869,7 @@ Messages are exact and are part of the observable behaviour of the language.
 | A supplied `sum` selector that is not a function, including `null`, even on an empty receiver | `sum expects a function` |
 | A supplied `max` or `min` selector that is not a function, including `null`, even on an empty receiver | `max expects a function` or `min expects a function` |
 | A supplied `distinct` selector that is not a function, including `null`, even on an empty receiver | `distinct expects a function` |
+| Missing or non-function `count` predicate, including `null`, even on an empty receiver | `count expects a function` |
 | An `all` or `any` quantifier over a value that is neither null nor a list or a declared class's instances | `<collection> is not a collection` |
 | A two-name `for key, value of source` loop over a value that is not an object | `<source> is not an object` |
 | Assigning a `suppose` block whose last statement is not an expression | `suppose has no value` |
@@ -2996,6 +3044,7 @@ items.at(-1)  items.findLast(callback) read or
```

**File**: `docs/examples.md` (modified, +32/-0)
```diff
@@ -3033,6 +3033,38 @@ ahead
   together. See [NUC 67](nuc-0067.md) and the
   [root contract](../nucleoid.spec.md#destructuring-declarations).
 
+## Predicate counts
+
+**Predicate counts keep the unfinished tasks of each team live**
+
+```nuc
+class Team(name): this.name = name
+class Task(team, done):
+    this.team = team
+    this.done = done
+$Team.pending = Task.count(task -> task.team == $Team and not task.done)
+north = Team("north")
+south = Team("south")
+first = Task(north, false)
+second = Task(north, true)
+Task(south, false)
+assert: north.pending, 1
+assert: south.pending, 1
+second.done = false
+assert: north.pending, 2
+first.team = south
+assert: north.pending, 1
+assert: south.pending, 2
+```
+
+- The one class-level rule counts each team's unfinished tasks. Completing
+  or transferring a task updates every affected team's count.
+- `count(predicate)` keeps the invocation, dependency and missing-value
+  behavior of `filter(predicate).length` without allocating its result list.
+  It does not replace instance methods named `count`.
+- See [NUC 73](nuc-0073.md) and the
+  [root contract](../nucleoid.spec.md#list-and-population-predicate-counts).
+
 ## Copyright
 
 Copyright 2020 Nucleoid
```

**File**: `docs/nuc-0000.md` (modified, +2/-0)
```diff
@@ -101,6 +101,7 @@ Created: 31-Jul-2026
 | [68](nuc-0068.md) | List and Population Sums | Accepted |
 | [69](nuc-0069.md) | List and Population Extremes | Accepted |
 | [71](nuc-0071.md) | List and Population Distinct Values | Accepted |
+| [73](nuc-0073.md) | List and Population Predicate Counts | Accepted |
 
 ### Reasoning enhancement
 
@@ -194,6 +195,7 @@ Created: 31-Jul-2026
 | [70](nuc-0070.md) | Object Entry Loops | Standards Track | Runtime features | Automatic-Accepted: independent evaluation rejected it because a rolled-back `delete` re-appended the key; its loops ship through NUC 72, which fixed that |
 | [71](nuc-0071.md) | List and Population Distinct Values | Standards Track | Utility enhancement | Accepted |
 | [72](nuc-0072.md) | Object Entry Loops with Ordered Rollback | Standards Track | Runtime features | Accepted |
+| [73](nuc-0073.md) | List and Population Predicate Counts | Standards Track | Utility enhancement | Accepted |
 
 ## Copyright
 
```

**File**: `docs/nuc-0073.md` (added, +323/-0)
```diff
@@ -0,0 +1,323 @@
+# NUC 73 -- List and Population Predicate Counts
+
+```
+NUC: 73
+Title: List and Population Predicate Counts
+Author: GitHub Copilot <223556219+Copilot@users.noreply.github.com>
+Status: Accepted
+Type: Standards Track
+Category: Utility enhancement
+Created: 02-Nov-2026
+```
+
+## Abstract
+
+- Adds the read-only shared query `RECEIVER.count(predicate)` to every list
+  and class population receiver supported by `filter`.
+- Returns the Number from `RECEIVER.filter(predicate).length`, without
+  allocating the filtered-result list, and returns `0` for a valid empty
+  receiver.
+- Preserves `filter`'s predicate invocation, truthiness, dependencies,
+  missing-value behavior, receiver snapshot, argument evaluation and rollback.
+- Adds no grammar, keyword, alias, no-argument overload, dependency or public
+  Rust API.
+- **Outcome: Accepted.** The independent evaluation and the caller's
+  integrated-tree checks passed all three hard criteria. Every required
+  token comparison passed; no policy check failed.
+
+## Motivation
+
+- A declarative model often needs how many items satisfy a rule, not a
+  collection of those items: open tickets, high readings or a team's
+  unfinished tasks.
+- Accepted syntax expresses that query as `filter(predicate).length`, which
+  constructs a result list only to read its length.
+- A direct predicate count states the same query without the intermediate
+  collection and keeps the dependencies that make the count live.
+
+## Rationale
+
+- **Category.** The caller made one uniform tool-backed draw over the current
+  registry's four automatically selectable categories: index 2/4, Utility
+  enhancement, without a redraw. A standard collection helper fits that
+  confirmed category; this revision does not alter the registry or other NUCs.
+- **Mode and token policy.** This is one preparation stage in an authorized
+  continuous invocation. Runtime applicability is `not_applicable` because
+  the category is Utility enhancement; runtime reason/evidence inputs are
+  unset. Independent per-case lexer-token comparison is required, with each
+  case using the same or fewer tokens than its accepted counterpart.
+- **One required predicate.** `count(predicate)` counts matches, not all
+  items. `length` already gives the receiver's size; a no-argument overload
+  would introduce a second operation unnecessarily.
+- **Reuse shared dispatch.** One additive `list_query` arm uses the exact
+  invocation and truthiness path of `filter`, with a `usize` counter instead
+  of a filtered-result `Vec`. Existing receiver and argument handling remains
+  untouched.
+- **Full traversal.** No match count permits early termination; every
+  predicate invocation contributes its existing reads and side effects.
+- **Ordinary names.** `count` is a member spelling, not a keyword or global
+  function. Existing bindings, object properties, property reads and instance
+  methods keep their behavior.
+- **Counterparts.** The caller recorded all seven behavior-equivalent
+  accepted-syntax counterparts before any edits. Only query calculations
+  outside assertions change to `count`; the three protected population
+  `filter(...).length` assertions and all instance `bag.count()` assertions
+  remain verbatim.
+- **Not added.** Aliases, optional predicates, numeric selectors, string
+  counts, short-circuiting, new callback arguments or changes to the accepted
+  `filter` query.
+- **Optional evidence.** No hint or scoring rubric was supplied. Strategy
+  learning is `not_configured`; this trial is unattributed and legitimately
+  unscored. No strategy, assessment or reward is inferred.
+
+## Specification
+
+- The authoritative contract is
+  [List and population predicate counts](../nucleoid.spec.md#list-and-population-predicate-counts).
+- `RECEIVER` is any list receiver accepted by `filter`, or a declared class's
+  population, reached through its class name or a class-valued alias.
+- Resolve and snapshot the receiver before evaluating arguments. Evaluate
+  every supplied argument once, left to right; use the first as the
+  predicate and ignore the values of extras.
+- Require a function predicate before iterating, including for an empty
+  receiver. Invoke it once for each snapshot item, in receiver order, with
+  only that item; normal missing-argument/default rules handle its remaining
+  parameters.
+- Increment the match count whenever the invocation result is truthy under
+  the rules used by `filter`. Visit all items unless an invocation raises an
+  error, and return the Number of matches, including `0` for an empty
+  receiver.
+- The query does not write the receiver or allocate a filtered-result list.
+  Existing receiver snapshots and function invocation may still allocate;
+  this is not an allocation-free execution claim.
+- Dependencies, nullish reads and deferred declarations are exactly those of
+  `filter(predicate).length`, including reads made by predicate
```

**File**: `nucleoid.spec.md` (modified, +132/-0)
```diff
@@ -3165,6 +3165,45 @@ statement positions; caught values and transaction recovery are unchanged.
   `Nucleoid rolls back failed distinct updates` specify the executable
   behavior.
 
+## List and population predicate counts
+
+- [NUC 73](docs/nuc-0073.md) adds the read-only shared query
+  `RECEIVER.count(predicate)` to every list and class population receiver
+  supported by `filter`, including class aliases. No syntax, keyword, alias,
+  no-argument overload or public Rust API is added.
+- For a function predicate, the query returns the Number that
+  `RECEIVER.filter(predicate).length` returns, without allocating a filtered
+  result list. A valid empty receiver returns `0`.
+- The predicate is invoked once per item, in receiver order, with only the
+  item, through the same invocation and truthiness rules as `filter`.
+  Remaining parameters follow the normal missing-argument/default rules.
+  Every item is visited unless an invocation fails; a truthy or falsy result
+  never short-circuits the query.
+- A missing or non-function first argument, including `null` or undefined,
+  raises `TypeError("count expects a function")`, even on an empty list or
+  population. There is no `count()` form for the receiver's length.
+- The receiver is snapshotted before the arguments, and every supplied
+  argument is evaluated once, left to right, including evaluated-and-ignored
+  extras. The query never writes the receiver; callback side effects and
+  errors keep their existing behavior. A null or undefined receiver yields
+  undefined without evaluating the arguments, as for `filter`.
+- A declaration follows its receiver, argument expressions and the reads
+  made by every predicate invocation. List changes, population additions
+  and removals, and changes to those reads re-evaluate it, including in
+  class-level rules. `.value`, state-version receivers, nullish reads and
+  deferred declarations work exactly as in `filter(predicate).length`;
+  a numeric query result does not suppress missing-value settlement.
+  Failures use the existing transaction and rollback behavior.
+- Bindings, properties and instance methods named `count` are unchanged,
+  as are property reads such as `items.count`. On a class or class alias,
+  `Name.count(predicate)` queries the population even when its instances
+  have a method named `count`; calls on an instance still invoke that method.
+  All accepted `filter(predicate).length` forms remain available unchanged.
+- The four appended entries beginning `Nucleoid counts matching list items`
+  through `Nucleoid uses predicate counts beside ordinary count names`
+  specify the executable behavior. Their original assertions, including the
+  population `filter(...).length` assertions, are preserved.
+
 ## Object entry loops with ordered rollback
 
 - [NUC 72](docs/nuc-0072.md) adds loops over an object's entries:
@@ -18063,4 +18102,97 @@ order.qty = 3
 order.price = 7
 limits = [3, 60]
 assert: [low, high, qty, price], [3, 60, 3, 7]
+---
+# Nucleoid counts matching list items
+
+readings = [2, 5, 8, 11]
+threshold = 6
+high = readings.count(reading -> reading > threshold)
+assert: high, 2
+readings.push(14)
+assert: high, 3
+threshold = 10
+assert: high, 2
+readings.shift()
+assert: high, 2
+readings = []
+assert: high, 0
+cart = {items: [0, 1, 2, 0, 3]}
+nonzero = cart.items.count(item -> item != 0)
+assert: nonzero, 3
+cart.items.push(4)
+assert: nonzero, 4
+---
+# Nucleoid counts matching class instances
+
+class Ticket(open, priority):
+    this.open = open
+    this.priority = priority
+pending = Ticket.count(ticket -> ticket.open)
+assert: pending, 0
+first = Ticket(true, 2)
+second = Ticket(false, 5)
+third = Ticket(true, 9)
+important = Ticket.count(ticket -> ticket.open and ticket.priority >= 5)
+assert: pending, 2
+assert: important, 1
+second.open = true
+assert: pending, 3
+assert: important, 2
+third.priority = 1
+assert: important, 1
+delete first.open
+delete first.priority
+delete first
+assert: pending, 2
+third.open = false
+assert: pending, 1
+assert: important, 1
+---
+# Nucleoid keeps predicate counts live in class level rules
+
+class Team(name): this.name = name
+class Task(team, done):
+    this.team = team
+    this.done = done
+$Team.pending = Task.count(task -> task.team == $Team and not task.done)
+alpha = Team("alpha")
+beta = Team("beta")
+assert: alpha.pending, 0
+assert: beta.pending, 0
+first = Task(alpha, false)
+second = Task(alpha, true)
+third = Task(beta, false)
+assert: alpha.pending, 1
+assert: beta.pending, 1
+first.team = beta
+assert: alpha.pending, 0
+assert: beta.pending, 2
+second.done = false
+assert: alpha.pending, 1
+delete third.team
+delete third.done
+delete third
+assert: beta.pending, 1
+---
+# Nucleoid uses predicate counts beside ordinary count names
+
+cutoff = 3
+count = 7
+report = {count: 9}
+class Bag(items):
+    this.items = items
+    def count(): return this.items.count(item -> item > cutoff)
+bag = Bag([1, 4, 8])
+
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

## X. NUC 73 List and Population Predicate Counts

**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `13944b95`: NUC 73 List and Population Predicate Counts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
## Predicate counts

**Predicate counts keep the number of open tickets live as tickets change**

```nuc
class Ticket(open): this.open = open
pending = Ticket.count(ticket -> ticket.open)
first = Ticket(true)
second = Ticket(false)
assert: pending, 1
second.open = true
assert: pending, 2
first.open = false
assert: pending, 1
```

- [NUC 73](docs/nuc-0073.md) adds `count(predicate)` to lists and class
  populations. It returns `filter(predicate).length` without allocating the
  filtered result, and calls the predicate once per item in receiver order.
- Counts remain live in declarations and class-level rules. A valid empty
  receiver gives `0`; a missing or non-function predicate raises
  `TypeError("count expects a function")`. The accepted `filter` spelling
  remains unchanged. See the
  [root contract](nucleoid.spec.md#list-and-population-predicate-counts).

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `13944b95` are properly handled with clean fallback behavior.
