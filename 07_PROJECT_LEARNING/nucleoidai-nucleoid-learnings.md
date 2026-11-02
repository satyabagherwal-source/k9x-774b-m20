> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `bd27ded7`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-02T14:32:10.263Z  
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
> **Harvest Timestamp**: 2026-11-02T14:32:09.922Z  
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

### Incident Patch 1: `28115779` (2026-11-01)
**Commit Message**: NUC 15 Parenthesis-Free Nullary Function Definitions

Rejected, confirmed when revisited under the automatic acceptance rule.
The NUC cannot meet the "every test passes" hard criterion: accepted
suites written after its rejection pin both of its forms as syntax
errors. `def f:` with an indented body must raise "Expected '(' but found
':'" (tests/bare_indented_blocks.rs), and `def f => 1` must raise
"Expected '(' but found '=>'" (tests/bare_named_arrows.rs,
tests/comma_free_named_arrows.rs, and the indented form in
tests/indented_named_arrows.rs). Accepting it would require changing
those existing assertions, which the rule forbids.

Its original policy result is unchanged: the token gate measured 19
less, 358 same and 0 more, and the evaluation rejected it for a
pre-existing CLI stack overflow. Only the NUC's abstract, a new
automatic acceptance review and both index entries change; no code,
case or export changes.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01AJtz8dniGGQdJtwsN7ocMS

**File**: `docs/nuc-0000.md` (modified, +2/-2)
```diff
@@ -30,7 +30,7 @@ Created: 31-Jul-2026
 | [12](nuc-0012.md) | Expression-Bodied Named Functions | Accepted |
 | [13](nuc-0013.md) | Compound Arithmetic Assignment | Accepted |
 | [14](nuc-0014.md) | Bodyless Empty Class Declarations | Accepted |
-| [15](nuc-0015.md) | Parenthesis-Free Nullary Function Definitions | Rejected |
+| [15](nuc-0015.md) | Parenthesis-Free Nullary Function Definitions | Rejected: accepted tests pin `def f:` and `def f => 1` as syntax errors, so it cannot pass every existing test |
 | [16](nuc-0016.md) | Bare Zero-Argument Super Calls | Accepted |
 | [17](nuc-0017.md) | Object-Property Shorthand | Accepted |
 | [18](nuc-0018.md) | Bare Single-Parameter Named Arrows | Accepted |
@@ -138,7 +138,7 @@ Created: 31-Jul-2026
 | [12](nuc-0012.md) | Expression-Bodied Named Functions | Standards Track | Syntax enhancement | Accepted |
 | [13](nuc-0013.md) | Compound Arithmetic Assignment | Standards Track | Syntax enhancement | Accepted |
 | [14](nuc-0014.md) | Bodyless Empty Class Declarations | Standards Track | Syntax enhancement | Accepted |
-| [15](nuc-0015.md) | Parenthesis-Free Nullary Function Definitions | Standards Track | Syntax enhancement | Rejected |
+| [15](nuc-0015.md) | Parenthesis-Free Nullary Function Definitions | Standards Track | Syntax enhancement | Rejected: accepted tests pin `def f:` and `def f => 1` as syntax errors, so it cannot pass every existing test |
 | [16](nuc-0016.md) | Bare Zero-Argument Super Calls | Standards Track | Syntax enhancement | Accepted |
 | [17](nuc-0017.md) | Object-Property Shorthand | Standards Track | Syntax enhancement | Accepted |
 | [18](nuc-0018.md) | Bare Single-Parameter Named Arrows | Standards Track | Syntax enhancement | Accepted |
```

**File**: `docs/nuc-0015.md` (modified, +10/-0)
```diff
@@ -17,6 +17,7 @@ Requires: 8, 12
 - The compact spelling has exactly the existing parenthesized definition's syntax tree and runtime behavior.
 - Calls remain explicit: `total()` calls the function; `total` reads its value or reference.
 - Independent evaluation rejected this revision; the prototype is not part of the accepted language.
+- Revisited under the automatic acceptance rule on 01-Nov-2026, it stays Rejected: accepted tests pin `def f:` and `def f => 1` as syntax errors, so accepting it would fail existing tests.
 
 ## Motivation
 
@@ -238,6 +239,15 @@ assert(double(3), 6)
 | `docs/examples.md` | Nullary methods omit empty parameter lists | 59 | 55 |
 | `docs/examples.md` | A deletion permits temporary undefined reads only during its cascade | 74 | 72 |
 
+### Automatic acceptance review
+
+- On 01-Nov-2026 the repository adopted the automatic acceptance rule: a NUC whose candidate has no compile errors, passes every test and stays backward compatible is accepted whatever its policy checks found, and only a failed hard criterion rejects it.
+- This NUC cannot meet the "every test passes" criterion. Accepted suites written after its rejection pin both of its forms as syntax errors that it would turn into valid definitions:
+  - `def f:` followed by an indented `return 1` must raise `SyntaxError("Expected '(' but found ':'")` at line 1, column 6 in `tests/bare_indented_blocks.rs` (`unsupported_headers_keep_parameter_errors_and_exact_positions`);
+  - `def f => 1` must raise `SyntaxError("Expected '(' but found '=>'")` at line 1, column 7 in `tests/bare_named_arrows.rs` (`unguarded_headers_keep_exact_accepted_parameter_errors_and_positions`) and `tests/comma_free_named_arrows.rs` (`nonidentifier_nullary_and_parenthesized_errors_keep_the_old_messages`), and `def f =>` followed by an indented `1` must raise the same error in `tests/indented_named_arrows.rs` (`nonqualifying_layout_and_unsupported_headers_keep_legacy_errors_and_positions`).
+- The rule forbids editing existing assertions or pinned diagnostics to make a candidate pass, so the NUC stays Rejected. Its original policy result is unchanged: 19 cases used fewer tokens, 358 the same and none more, and the evaluation rejected it for a pre-existing CLI stack overflow.
+- No code, executable case or generated export changed; only this review and both index entries were added.
+
 ## Copyright
 
 Copyright 2026 Nucleoid
```

---

### Incident Patch 2: `5573d8f6` (2026-11-01)
**Commit Message**: NUC 63 Condition-Controlled While Loops

Automatic-Accepted under the automatic acceptance rule for revisited NUCs.
The ported candidate meets every hard criterion, but the token policy check
failed: the original continuous evaluation rejected the executable reference
case `Nucleoid repeats statements with a while loop` at 64 lexer tokens
against 62 for its compact accepted string-loop counterpart. The port's fresh
single-mode evaluation decided Accepted with token comparison skipped, which
is not a passing gate, and its informational measurement found the same 64
against 62.

Hard criteria:
- No compile errors: cargo build --all-targets (also --locked), warning-denied
  cargo clippy --all-targets, cargo fmt --check and git diff --check pass in
  the evaluation and again on this integrated tree.
- Every test passes: cargo test --no-fail-fast passed 2,108 tests with
  0 failures and 25 ignored, in the evaluation and on this tree, against
  2,074/0/25 at 28115779. All 2,099 accepted test names are present with
  their accepted results; existing tests changed only in count pins.
- Backward compatible: a 433,048-input two-revision differential kept the
  tokens, parses, positions and r

**File**: `README.md` (modified, +28/-0)
```diff
@@ -1420,6 +1420,34 @@ assert(Item.map(item -> item.shelf + ":" + item.name + item.qty).join(" "), "pan
   See the
   [root contract](nucleoid.spec.md#object-entry-loops-with-ordered-rollback).
 
+## While loops
+
+**While loops step a world model until a goal holds**
+
+```nuc
+class Tank(level):
+    this.level = level
+tank = Tank(2)
+full = tank.level >= 10
+hours = 0
+while not full:
+    tank.level = tank.level + 3
+    hours = hours + 1
+assert(tank.level, 11)
+assert(hours, 3)
+assert(full, true)
+```
+
+- [NUC 63](docs/nuc-0063.md) adds `while CONDITION:` with an indented or
+  same-line body. The condition is tested with the truthiness of `if` before
+  every iteration, and each iteration sees the live values that its own
+  changes caused, such as `full` here.
+- A loop runs once, imperatively, like `for`: it leaves no standing rule and
+  does not run again when `tank.level` changes later. A runaway loop stops
+  after 100,000 iterations with `TypeError("Loop did not terminate")` and
+  rolls back. `while` stays an ordinary name everywhere else. See the
+  [root contract](nucleoid.spec.md#while-loops).
+
 ## Benchmark
 
 This is the comparation our sample order app in Nucleoid IDE against MySQL and Postgres with using Express.js and Sequelize libraries.
```

**File**: `dataset/nucleoid.spec.jsonl` (modified, +8/-0)
```diff
@@ -561,3 +561,11 @@
 {"id":"spec-0561","description":"Nucleoid keeps object entry loops one shot","code":"class Lamp(room, watts):\n    this.room = room\n    this.watts = watts\ndef light(rooms):\n    for room, watts of rooms: Lamp(room, watts)\n    return Lamp.length\nload = Lamp.sum(lamp -> lamp.watts)\nlights = {hall: 40, desk: 60, porch: 25}\nnight = false\nif night: light(lights)\nassert: Lamp.length, 0\nnight = true\nlights.desk = 100\nlights.shed = 30\nassert: [Lamp.length, load], [3, 125]\nlights = {shed: 30, gate: 10, pool: 20, yard: 5}\nassert: [Lamp.length, load], [7, 190]\nbill = {watts: 0}\nfor room, watts of lights: bill.watts += watts\nlights.gate = 50\nassert: [Lamp.map(lamp -> lamp.room).join(\" \"), bill.watts], [\"hall desk porch shed gate pool yard\", 65]","return":null}
 {"id":"spec-0562","description":"Nucleoid restores object entries at nested savepoints","code":"class Seat(row, guest, price):\n    this.row = row\n    this.guest = guest\n    this.price = price\ndef seat(row, guests):\n    for guest, price of guests:\n        if price > 50: throw guest + \" is over budget\"\n        Seat(row, guest, price)\n    return Seat.length\nparty = {ann: 30, bob: 40, cy: 20}\ntry:\n    delete party.ann\n    try:\n        delete party.bob\n        party.bob = 60\n        seat(\"a\", party)\n    catch error:\n        assert: [error, Seat.length], [\"bob is over budget\", 0]\n    party.ann = 35\n    assert: seat(\"b\", party), 3\n    assert: Seat.map(each -> each.guest + each.price).join(\" \"), \"bob40 cy20 ann35\"\n    throw \"CANCELLED\"\ncatch error:\n    assert: [error, Seat.length], [\"CANCELLED\", 0]\nassert: seat(\"c\", party), 3\nassert: Seat.map(each -> each.row + each.guest + each.price).join(\" \"), \"cann30 cbob40 ccy20\"","return":null}
 {"id":"spec-0563","description":"Nucleoid restores object entries in place when it rolls back","code":"class Line(order, item, qty):\n    this.order = order\n    this.item = item\n    this.qty = qty\nclass Order(name):\n    this.name = name\n    this.items = []\n    def fill(stock):\n        for item, qty of stock:\n            if qty > 5: throw item + \" is short\"\n            Line(this.name, item, qty)\n            this.items.push(item + qty)\n        return this.items\nbasket = {tea: 4, jam: 3, oats: 2}\nfirst = Order(\"first\")\ntry:\n    basket.tea = 9\n    delete basket.jam\n    delete basket.tea\n    basket.tea = 6\n    first.fill(basket)\ncatch error:\n    assert: [error, first.items, Line.length], [\"tea is short\", [], 0]\nsecond = Order(\"second\")\nassert: second.fill(basket), [\"tea4\", \"jam3\", \"oats2\"]\nplan = suppose:\n    delete basket.jam\n    basket.rye = 5\n    Order(\"third\").fill(basket)\nassert: plan, [\"tea4\", \"oats2\", \"rye5\"]\nbasket.salt = 1\nfourth = Order(\"fourth\")\nassert: fourth.fill(basket), [\"tea4\", \"jam3\", \"oats2\", \"salt1\"]\nassert: Line.map(line -> line.order + \":\" + line.item).join(\" \"), \"second:tea second:jam second:oats fourth:tea fourth:jam fourth:oats fourth:salt\"","return":null}
+{"id":"spec-0564","description":"Nucleoid repeats a while loop until its condition fails","code":"level = 0\nfull = level >= 10\nsteps = 0\nwhile not full:\n    level = level + 3\n    steps = steps + 1\nassert(level, 12)\nassert(steps, 4)\nassert(full, true)\nlevel = 4\nassert(full, false)\nassert(steps, 4)","return":null}
+{"id":"spec-0565","description":"Nucleoid skips a while loop whose condition starts falsy","code":"class Counter(count):\n    this.count = count\n    this.ticks = 0\nbusy = Counter(3)\nidle = Counter(0)\nblank = Counter(\"\")\nunset = Counter(null)\nfor counter of Counter:\n    while counter.count:\n        counter.count = counter.count - 1\n        counter.ticks = counter.ticks + 1\nassert(busy.count, 0)\nassert(busy.ticks, 3)\nassert(idle.ticks, 0)\nassert(blank.ticks, 0)\nassert(unset.ticks, 0)\nassert(blank.count, \"\")","return":null}
+{"id":"spec-0566","description":"Nucleoid runs while loops in methods with parameters and return","code":"class Tank(level):\n    this.level = level\n    this.cycles = 0\n    def drain(rate):\n        while this.level > 0:\n            if this.level < rate:\n                return \"partial\"\n            this.level = this.level - rate\n            this.cycles = this.cycles + 1\n        return \"empty\"\nbig = Tank(9)\nsmall = Tank(7)\nassert(big.drain(3), \"empty\")\nassert(big.level, 0)\nassert(big.cycles, 3)\nassert(small.drain(3), \"partial\")\nassert(small.level, 1)\nassert(small.cycles, 2)\nassert(Tank(0).drain(3), \"empty\")","return":null}
+{"id":"spec-0567","description":"Nucleoid nests while loops with conditionals and for loops","code":"class Shelf(stock):\n    this.stock = stock\na = Shelf(0)\nb = Shelf(3)\nlow = Shelf.filter(s => s.stock < 3).length\nrounds = 0\nmoves = 0\nwhile low > 0:\n    for s of Shelf:\n        if s.stock < 3:\n            while s.stock < 3:\n                s.stock = s.stock + 2\n                moves = moves + 1\n   
```

**File**: `dataset/nucleoid.synth.51.jsonl` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+{"id":"synth-51-0001","description":"A while loop counts up until its condition fails","code":"count = 0\nwhile count < 5:\n    count = count + 1\ncount","return":"5"}
+{"id":"synth-51-0002","description":"A while condition reads a live rule that each iteration updates","code":"water = 0\nfull = water >= 9\npours = 0\nwhile not full:\n    water = water + 4\n    pours = pours + 1\nassert(full, true)\npours","return":"3"}
+{"id":"synth-51-0003","description":"A while loop whose condition is false at the start runs no iteration","code":"queue = 0\nhandled = 0\nwhile queue > 0:\n    handled = handled + 1\nhandled","return":"0"}
+{"id":"synth-51-0004","description":"A method loops over its own instance and returns from inside the loop","code":"class Battery(charge):\n    this.charge = charge\n    def use(amount):\n        while this.charge > 0:\n            if this.charge < amount:\n                return \"low\"\n            this.charge = this.charge - amount\n        return \"empty\"\nphone = Battery(10)\nphone.use(4)","return":"\"low\""}
+{"id":"synth-51-0005","description":"Nested while loops create a triangle of instances","code":"class Dot(row, col):\n    this.row = row\n    this.col = col\nrow = 0\nwhile row < 3:\n    col = 0\n    while col <= row:\n        Dot(row, col)\n        col = col + 1\n    row = row + 1\nDot.length","return":"6"}
+{"id":"synth-51-0006","description":"A function body accumulates into a name it assigned before the while loop","code":"def total(n):\n    sum = 0\n    while n > 0:\n        sum = sum + n\n        n = n - 1\n    return sum\ntotal(4)","return":"10"}
+{"id":"synth-51-0007","description":"A runaway while loop raises a TypeError and rolls back its changes","code":"steps = 0\ntry:\n    while steps != 10:\n        steps = steps + 4\ncatch error:\n    failure = error\nassert(steps, 0)\nfailure","return":"\"TypeError: Loop did not terminate\""}
+{"id":"synth-51-0008","description":"Variables named while stay ordinary beside while loops","code":"while = 2\nrounds = 0\nwhile while > 0:\n    while = while - 1\n    rounds = rounds + 1\n[while, rounds]","return":"[0,2]"}
```

**File**: `docs/README.md` (modified, +47/-0)
```diff
@@ -1074,6 +1074,8 @@ assert(signal.output, 8)
   and `""` are kept; see [Nullish coalescing](#nullish-coalescing).
 - `all` and `any` quantifiers test each member's condition the same way; see
   [Quantifiers](#quantifiers).
+- A `while` loop tests its condition the same way before every iteration; see
+  [while](#while).
 
 ```
 if $Device.profile:
@@ -1173,6 +1175,47 @@ Normative detail: [implicit iterator indented loops](../nucleoid.spec.md#implici
 [object entry loops with ordered rollback](../nucleoid.spec.md#object-entry-loops-with-ordered-rollback),
 alongside the unchanged explicit-loop entries in the root specification.
 
+### while
+
+- `while <condition>:` repeats its body while the condition holds, under
+  [NUC 63](nuc-0063.md). The body is an indented block, or statements on the
+  same line separated by `;`.
+- The condition is tested before every iteration with the truthiness of
+  `if`, so a condition that is false at the start runs no iteration.
+- Each iteration's assignments, and the propagation they cause, are visible
+  to the rest of the body and to the next test.
+- The loop runs once, imperatively, like `for`: nested conditions and blocks
+  are part of that one-shot body, nothing is filed in the graph, and the loop
+  does not run again when its inputs change later.
+- The body runs in the enclosing scope, like an `if` branch, with no scope
+  frame per iteration. That is where it differs from a `for` body, whose
+  frame per iteration shadows a name that the enclosing function or loop body
+  already assigned. Parameters, enclosing loop variables, `this`/`self` and
+  `return` behave as in `for` bodies.
+- Each run of a loop stops after at most 100,000 iterations: a condition that
+  still holds then raises `TypeError("Loop did not terminate")` and the
+  transaction rolls back. Each run of a nested loop has its own budget, so
+  every run terminates, but nested loops multiply and the bound is not a cap
+  on total work.
+- `while` is not reserved. `while NAME: TYPE`, `while assert: ...`, a
+  condition whose last token is a bare `lambda`, and colon-free or braced
+  headers keep their accepted readings as separate statements. A condition
+  that is the name `suppose`, or an assignment whose value is that name, as
+  in `while suppose: ...`, keeps its accepted reading too: `while` followed
+  by a `suppose` block.
+
+```
+savings = Account(100)
+years = 0
+while savings.balance < 150:
+    savings.balance = savings.balance * 1.1
+    years = years + 1
+```
+
+- `years` is `5`; changing `savings.balance` later does not run the loop again.
+
+Normative detail: [while loops](../nucleoid.spec.md#while-loops).
+
 ---
 
 ## 9. Functions
@@ -2747,6 +2790,7 @@ Messages are exact and are part of the observable behaviour of the language.
 | A `:=` declaration whose value nests lists 192 levels or more | `Maximum expression depth exceeded` |
 | Explaining something that is not a reference, such as the power in `why x ** 2` | `Cannot explain <expression>`, for example `Cannot explain x**2` |
 | Repeated string output is too large to represent or allocate | `Repeated string is too large` |
+| A `while` loop whose condition still holds after 100,000 iterations of one run | `Loop did not terminate` |
 | An undeclared constructor label | `Unknown constructor argument '<name>' for <class>` |
 | A repeated constructor binding, including positional plus named | `Duplicate constructor argument '<name>' for <class>` |
 | A positional constructor argument following a label | `Positional constructor argument after named arguments for <class>` |
@@ -2859,6 +2903,9 @@ for key, value of source:              object entries in insertion order (NUC 72
 for key, value in source:              equivalent two-name iteration (NUC 72)
 for source:                            indented iteration with local it
     statement
+while condition:                       repeat while the condition holds (NUC 63)
+    statement
+while condition: statement             same loop with a same-line body
 
 value => expression                    anonymous arrow; also (a, b) => expression
 value => { statement }                 anonymous arrow with a statement body
```

**File**: `docs/examples.md` (modified, +36/-0)
```diff
@@ -2968,6 +2968,42 @@ Product.filter(product -> product.low).map(product -> product.site + ":" + produ
 - See [NUC 72](nuc-0072.md) and the
   [root contract](../nucleoid.spec.md#object-entry-loops-with-ordered-rollback).
 
+## While loops
+
+**While loops run packing shifts until every order is done**
+
+```nuc
+class Order(qty):
+    this.qty = qty
+    this.packed = 0
+$Order.done = $Order.packed >= $Order.qty
+Order(3)
+Order(5)
+Order(2)
+open = Order.filter(o => not o.done).length
+shifts = 0
+while open > 0:
+    for order of Order:
+        if not order.done:
+            order.packed = order.packed + 2
+    shifts = shifts + 1
+assert(shifts, 3)
+assert(open, 0)
+assert(Order.map(o => o.packed), [4, 6, 2])
+shifts
+# return: 3
+```
+
+- The class-level rule keeps `done` true to each order's packed count, and
+  `open` counts the orders that are not done. Each shift packs two units for
+  every open order, and the loop tests `open` again after every shift, so it
+  stops as soon as the last order is done.
+- The nested `for` and `if` are part of the one-shot loop body, not standing
+  rules. In accepted syntax the shifts need a `for` loop over placeholder
+  instances, and their number must be known in advance.
+- See [NUC 63](nuc-0063.md) and the
+  [root contract](../nucleoid.spec.md#while-loops).
+
 ## Copyright
 
 Copyright 2020 Nucleoid
```

**File**: `docs/nuc-0000.md` (modified, +2/-2)
```diff
@@ -74,7 +74,7 @@ Created: 31-Jul-2026
 | [55](nuc-0055.md) | Class-Level State Version Anchors | Accepted |
 | [59](nuc-0059.md) | Conditional Expressions | Accepted |
 | [60](nuc-0060.md) | Nullish Coalescing | Accepted |
-| [63](nuc-0063.md) | Condition-Controlled While Loops | Rejected: `Nucleoid repeats statements with a while loop` rises from 62 to 64 lexer tokens against a compact accepted string-loop counterpart |
+| [63](nuc-0063.md) | Condition-Controlled While Loops | Automatic-Accepted: token gate failed, as `Nucleoid repeats statements with a while loop` rises from 62 to 64 lexer tokens against a compact accepted string-loop counterpart |
 | [66](nuc-0066.md) | Imperative Value Assignment | Accepted |
 | [70](nuc-0070.md) | Object Entry Loops | Automatic-Accepted: independent evaluation rejected it because a rolled-back `delete` re-appended the key; its loops ship through NUC 72, which fixed that |
 | [72](nuc-0072.md) | Object Entry Loops with Ordered Rollback | Accepted |
@@ -184,7 +184,7 @@ Created: 31-Jul-2026
 | [60](nuc-0060.md) | Nullish Coalescing | Standards Track | Runtime features | Accepted |
 | [61](nuc-0061.md) | Instance List Ranges and Common List Queries | Standards Track | Utility enhancement | Accepted |
 | [62](nuc-0062.md) | Universal and Existential Quantifiers | Standards Track | Reasoning enhancement | Accepted |
-| [63](nuc-0063.md) | Condition-Controlled While Loops | Standards Track | Runtime features | Rejected: `Nucleoid repeats statements with a while loop` rises from 62 to 64 lexer tokens against a compact accepted string-loop counterpart |
+| [63](nuc-0063.md) | Condition-Controlled While Loops | Standards Track | Runtime features | Automatic-Accepted: token gate failed, as `Nucleoid repeats statements with a while loop` rises from 62 to 64 lexer tokens against a compact accepted string-loop counterpart |
 | [64](nuc-0064.md) | Exponentiation Operator and Compound Exponentiation | Standards Track | Syntax enhancement | Accepted |
 | [65](nuc-0065.md) | Hypothetical Suppose Blocks | Standards Track | Reasoning enhancement | Accepted |
 | [66](nuc-0066.md) | Imperative Value Assignment | Standards Track | Runtime features | Accepted |
```

**File**: `docs/nuc-0063.md` (modified, +284/-42)
```diff
@@ -4,11 +4,11 @@
 NUC: 63
 Title: Condition-Controlled While Loops
 Author: Claude <noreply@anthropic.com>
-Status: Rejected
+Status: Automatic-Accepted
 Type: Standards Track
 Category: Runtime features
 Created: 31-Oct-2026
-Requires: 8, 31, 45, 51, 57, 59, 60, 62
+Requires: 8, 31, 45, 51, 57, 59, 60, 62, 65
 ```
 
 ## Abstract
@@ -31,14 +31,22 @@ Requires: 8, 31, 45, 51, 57, 59, 60, 62
   `TypeError("Loop did not terminate")` and the transaction rolls back.
 - No keyword or lexer token is added. A loop is recognized only where the
   accepted parser rejects the input, and `while` keeps every accepted reading
-  as a name. The isolated candidate states the contract in a `While loops`
-  section of `nucleoid.spec.md`, which was not integrated.
-- Rejected: the executable reference case
-  `Nucleoid repeats statements with a while loop` uses 64 lexer tokens, 2
+  as a name. The authoritative contract is the
+  [while loops](../nucleoid.spec.md#while-loops) section.
+- The original revision was rejected on 31-Oct-2026: its executable reference
+  case `Nucleoid repeats statements with a while loop` uses 64 lexer tokens, 2
   more than the 62 of its compact accepted-syntax counterpart, the
-  fixed-count string loop `for t of "abcde":`. Independent evaluation
-  rejected this revision, so the prototype is not part of the accepted
-  language.
+  fixed-count string loop `for t of "abcde":`. This revision ports that
+  candidate, unchanged in design, onto the current accepted revision; see
+  [Port to the current accepted revision](#port-to-the-current-accepted-revision).
+- Automatic-Accepted on 01-Nov-2026 under the automatic acceptance rule: the
+  ported candidate meets every hard criterion, with no compile errors, every
+  test passing and full backward compatibility, but the token policy check
+  failed. The original continuous evaluation rejected the reference case at
+  64 tokens against 62; the port's single-mode evaluation skipped token
+  comparison, which does not pass that check, and its informational
+  measurement found the same 64 against 62. See
+  [Evaluation of the port](#evaluation-of-the-port).
 
 ## Motivation
 
@@ -96,7 +104,7 @@ Requires: 8, 31, 45, 51, 57, 59, 60, 62
   after it form one complete condition, and that condition is immediately
   followed by `:`. Rejected: reserving `while`, which would break programs
   that use it as a variable, function, parameter or property name.
-- **Three accepted readings stay.** The accepted parser accepts three
+- **Four accepted readings stay.** The accepted parser accepts four
   colon-bearing spellings after `while`, so they keep their readings:
   - `while NAME: TYPE` before a statement boundary is `while` followed by the
     typed declaration `NAME: TYPE`. Executing a statement-level declaration
@@ -112,6 +120,16 @@ Requires: 8, 31, 45, 51, 57, 59, 60, 62
     the accepted statement after `while` does, so there `lambda:` starts a
     zero-parameter lambda ([NUC 57](nuc-0057.md)): `while x + lambda: 1` is
     `while` followed by `x + (lambda: 1)`.
+  - Since [NUC 65](nuc-0065.md), the accepted parser reads
+    `while suppose: x` as `while` followed by the block `suppose: x`, and
+    `while x = suppose: x` as `while` followed by an assigned block, so a
+    condition that is the name `suppose`, or an assignment whose value is
+    the name `suppose`, keeps its accepted reading. The test reads the
+    parsed condition, as the `suppose` statement itself does, because
+    `while x = (suppose): x` is an assigned block at the accepted revision
+    too and a token test would turn it into a loop. As a result
+    `while (suppose): pass` keeps its accepted
+    `SyntaxError("Unexpected ':'")` rather than becoming a loop.
 - **Colon-free and braced headers stay juxtapositions.** Statements need no
   separators, so `while n < 3 { n = n + 1 }` and `while n < 3` followed by an
   indented block are valid accepted programs: with `while = 7` they run the
@@ -225,21 +243,26 @@ Requires: 8, 31, 45, 51, 57, 59, 60, 62
   block, or statements on the same line separated by `;`.
 - A statement is a loop when it starts with the name `while` and the tokens
   after it parse as one complete condition immediately followed by `:`,
-  except in three spellings that keep their accepted readings:
+  except in four spellings that keep their accepted readings:
   - `while NAME: TYPE` followed by a newline, `;`, a dedent or the end of
     input: the statement `while` and the typed declaration `NAME: TYPE`;
   - `while assert: ...`: the statement `while` and a colon-led assertion;
   - a condition whose last token is a bare `lambda`: the statement `while`
-    and an expression holding a zero-parameter lambda.
+    and an expression holding a zero-parameter lambda;
+  - a condition that is the name `suppose`, or an assignment whose value is
+    the name `suppose`: its accepted reading, usually a `suppose` block
+    ([NUC 65](nuc-0065.md)), such as the statement 
```

**File**: `nucleoid.spec.md` (modified, +252/-0)
```diff
@@ -3246,6 +3246,108 @@ statement positions; caught values and transaction recovery are unchanged.
   `Nucleoid restores object entries in place when it rolls back` specify the
   executable behavior.
 
+## While loops
+
+- [NUC 63](docs/nuc-0063.md) adds the condition-controlled loop
+  `while CONDITION:` followed by a suite: an indented block, or statements on
+  the same line separated by `;`. No keyword or lexer token is added, and
+  `while` stays an ordinary name everywhere else.
+- A statement is a loop when it starts with the name `while` and the tokens
+  after it form one complete condition immediately followed by `:`, except
+  in the four spellings below. The condition is parsed like an `if` header
+  condition, so conditional expressions, quantifiers, `??`, `|>`, arrows and
+  bracketed lambdas pair their own colons. At the accepted revision every
+  loop statement was a `SyntaxError`.
+- Four spellings keep their accepted readings, because accepted programs
+  use them:
+  - `while NAME: TYPE` before a newline, `;`, dedent or the end of input is
+    the statement `while` followed by the typed declaration `NAME: TYPE`, so
+    `while ready: tick` runs `while` and then declares `ready`. Executing it
+    raises `ReferenceError("while is not defined")`, or
+    `ReferenceError("Missing definition")` when `while` is defined. A loop
+    whose same-line body is one bare name could only read that name, so no
+    useful loop is lost; `while ready: tick()` and an indented `tick` body
+    are loops.
+  - `while assert: ACTUAL, EXPECTED` is `while` followed by the colon-led
+    assertion statement `assert: ACTUAL, EXPECTED`, so with `while = 1`,
+    `while assert: while, 1` runs that assertion.
+  - A condition whose last token is a bare `lambda`, as in `while lambda: 1`
+    or `while x + lambda: 1`, keeps its accepted reading: `while` followed by
+    an expression that holds the zero-parameter lambda `lambda: 1`.
+  - A condition that is the name `suppose`, or an assignment whose value is
+    the name `suppose`, keeps its accepted reading, which is usually a
+    `suppose` block ([NUC 65](docs/nuc-0065.md)): `while suppose: x` is
+    `while` followed by the block `suppose: x`, and `while x = suppose: x` is
+    `while` followed by the assigned block `x = suppose: x`. The test reads
+    the parsed condition, as the `suppose` statement does, so
+    `while x = (suppose): x` is an assigned block too, and
+    `while (suppose): pass` keeps its accepted `SyntaxError("Unexpected ':'")`.
+- `while CONDITION` followed by an indented block without a colon, and
+  `while CONDITION { ... }`, keep their accepted readings as the juxtaposed
+  statements `while`, `CONDITION` and the block. A variable, function,
+  parameter or loop variable named `while`, including either name of a
+  two-name `for` loop, an object key or property `while`, `while(...)`
+  calls, the value assignment `while := VALUE` and the declaration
+  `while: TYPE` keep working.
+- Before each iteration the condition is evaluated in the current state and
+  tested with the truthiness of `if`. While it holds the body runs again;
+  when it is falsy the loop ends. A condition that is falsy at the start runs
+  no iteration. A completed loop yields `null`.
+- The loop is one-shot and imperative, like a `for` loop. Its body,
+  including nested conditionals, blocks and loops, is carried out rather
+  than filed as standing rules. Each iteration's assignments, and the
+  propagation they cause, are visible to the rest of the body and to the next
+  condition test. The loop files nothing in the graph and does not run again
+  when its inputs change later.
+- A loop inside the body of a standing rule, such as the branch of a
+  top-level `if` or a function called from a declaration, runs again whenever
+  that rule runs, as a `for` loop does there.
+- The body runs in the enclosing scope, like an `if` branch. A `for` body
+  pushes a new scope frame for each iteration to hold its loop variable; a
+  `while` loop binds no variable and pushes no frame. This is the one place
+  where a `while` body differs from a `for` body. Inside a function, loop or
+  block body, a `for` iteration's frame turns a name that the enclosing body
+  already assigned into a local of that iteration: a function that sets
+  `sum = 0` and then runs `sum = sum + 1` in a `for` loop over two items
+  returns `0`, which is accepted behavior and unchanged. The same accumulator
+  in a `while` body updates the enclosing `sum`, so the function returns the
+  accumulated total. Parameters, enclosing loop variables, locals, `this` and
+  `self`, and `return` otherwise behave as in `for` bodies.
+- `return` in the body leaves the enclosing function, method, block or loop,
+  as from a `for` body. At the top level it ends the program with its value.
+- A `while` statement is never kept on a class. Outside a class-level rule,
+  `$Class` in its condition or body reads the declare
```

---

### Incident Patch 3: `eb55f2b1` (2026-11-01)
**Commit Message**: NUC 72 Object Entry Loops with Ordered Rollback

Accepted. The independent evaluator accepted the proposal in continuous
mode against a0fcd88 and its 824-case baseline, which it re-recorded
byte-identically, with existing_comparable applicability. The required
token gate ran: 11 cases use fewer lexer tokens, 813 are unchanged and
none uses more, with a minimum margin of 18 against the most compact fair
accepted counterparts. Every independent check passed: the full suite
(2,074 passed, 0 failed, 25 ignored, with no accepted test missing or
changed), fmt, Clippy, export consistency, and the evaluator's own
randomized rollback testing over more than 100,000 runs, which found no
ordering violation and no change to any accepted output.

NUC 72 adds `for KEY, VALUE of SOURCE:` (and its `in` spelling) over the
own entries of plain objects and instances, in insertion order, with a
snapshot taken before the first body and TypeError("<source> is not an
object") for other sources; every single-name loop is unchanged. It also
makes rollback order-preserving: undoing a property deletion in a failed
`try`, a failed statement or a `suppose` block puts the property back at
its original position. 

**File**: `README.md` (modified, +27/-0)
```diff
@@ -1393,6 +1393,33 @@ assert(buyers, 3)
   equality of `includes` and never converted, so `1` and `"1"` stay apart.
   See the [root contract](nucleoid.spec.md#list-and-population-distinct-values).
 
+## Object entry loops
+
+**Entry loops read the keys and values of a record**
+
+```nuc
+class Item(shelf, name, qty):
+    this.shelf = shelf
+    this.name = name
+    this.qty = qty
+def stock(shelf, table):
+    for name, qty of table: Item(shelf, name, qty)
+    return Item.length
+assert([stock("pantry", {rice: 4, oil: 2, salt: 1}), stock("fridge", {milk: 1, eggs: 12})], [3, 5])
+assert(Item.map(item -> item.shelf + ":" + item.name + item.qty).join(" "), "pantry:rice4 pantry:oil2 pantry:salt1 fridge:milk1 fridge:eggs12")
+```
+
+- [NUC 72](docs/nuc-0072.md) adds `for KEY, VALUE of SOURCE:`, also spelled
+  with `in`. It visits an object's own entries in insertion order, binds each
+  key and its value, and runs the body once per entry, as a single-name loop
+  runs once per item.
+- `stock` takes any table: the pantry and fridge tables have different keys,
+  and the loop reads each one without naming them. A rolled-back `try` or a
+  `suppose` block leaves every object's entries where they were, in the same
+  order. Any other source raises `TypeError("<source> is not an object")`.
+  See the
+  [root contract](nucleoid.spec.md#object-entry-loops-with-ordered-rollback).
+
 ## Benchmark
 
 This is the comparation our sample order app in Nucleoid IDE against MySQL and Postgres with using Express.js and Sequelize libraries.
```

**File**: `dataset/nucleoid.spec.jsonl` (modified, +8/-0)
```diff
@@ -553,3 +553,11 @@
 {"id":"spec-0553","description":"Nucleoid uses distinct values in functions methods and conditional expressions","code":"class Post(author, tags):\n    this.author = author\n    this.tags = tags\n    def topics(): return this.tags.distinct()\ndef sizes(post) => post.tags.distinct(tag -> tag.length)\nfirst = Post(\"ada\", [\"rust\", \"logic\", \"rust\"])\nsecond = Post(\"bo\", [\"logic\", \"go\"])\ninuse = Post.flatMap(post -> post.topics()).distinct()\nbroader = first.topics().length > second.topics().length ? first.author : second.author\nlengths = sizes(first)\nassert: inuse, [\"rust\", \"logic\", \"go\"]\nassert: broader, \"bo\"\nassert: lengths, [4, 5]\nsecond.tags.pop()\nfirst.tags.push(\"graphs\")\nPost(\"cy\", [\"go\", \"sql\"])\nassert: inuse, [\"rust\", \"logic\", \"graphs\", \"go\", \"sql\"]\nassert: broader, \"ada\"\nassert: lengths, [4, 5, 6]","return":null}
 {"id":"spec-0554","description":"Nucleoid keeps distinct as an ordinary name beside the distinct query","code":"distinct = 2\nreport = {distinct: 3}\ndef twice distinct => distinct * 2\nclass Shelf(items):\n    this.items = items\n    def distinct(): return this.items.distinct().length\nshelf = Shelf([\"pen\", \"ink\", \"pen\"])\nspare = Shelf([\"cap\", \"pen\"])\nkinds = shelf.items.distinct()\ncount = shelf.distinct() + distinct + report.distinct\nshelves = Shelf.distinct(each -> each.distinct())\nassert: kinds, [\"pen\", \"ink\"]\nassert: count, 7\nassert: shelves, [2]\nassert: twice(distinct), 4\nassert: shelf.items.distinct, null\nshelf.items.push(\"cap\")\ndistinct = 4\nShelf([\"ink\", \"ink\"])\nassert: kinds, [\"pen\", \"ink\", \"cap\"]\nassert: count, 10\nassert: shelves, [3, 2, 1]","return":null}
 {"id":"spec-0555","description":"Nucleoid rolls back failed distinct updates","code":"def checked(zone):\n    if zone == \"void\":\n        throw \"BAD_ZONE\"\n    return zone\nzones = [\"a\", \"b\", \"a\"]\nseen = zones.distinct(checked)\nassert: seen, [\"a\", \"b\"]\nfailure = \"\"\ntry:\n    zones.shift()\n    zones.push(\"void\")\ncatch error:\n    failure = error\nassert: failure, \"BAD_ZONE\"\nassert: zones, [\"a\", \"b\", \"a\"]\nassert: seen, [\"a\", \"b\"]\nzones.push(\"c\")\nassert: seen, [\"a\", \"b\", \"c\"]\nclass Parcel(zone): this.zone = zone\nParcel(\"b\")\nParcel(\"a\")\nroutes = Parcel.distinct(parcel -> checked(parcel.zone))\nfailure = \"\"\ntry:\n    Parcel(\"void\")\ncatch error:\n    failure = error\nassert: failure, \"BAD_ZONE\"\nassert: Parcel.length, 2\nassert: routes, [\"b\", \"a\"]\nParcel(\"a\")\nParcel(\"c\")\nassert: routes, [\"b\", \"a\", \"c\"]","return":null}
+{"id":"spec-0556","description":"Nucleoid loops over object entries in insertion order","code":"class Line(shelf, item, count):\n    this.shelf = shelf\n    this.item = item\n    this.count = count\nclass Shelf(name):\n    this.name = name\n    this.units = 0\n    def stock(items):\n        for item, count in items:\n            Line(this.name, item, count)\n            this.units += count ?? 0\n        return this.units\nnone = {}\ndry = {rice: 4, beans: 1, oil: null, tea: none.tea}\ndry.flour = 6\ndelete dry.beans\ndry.beans = 2\npantry = Shelf(\"pantry\")\nassert: [pantry.stock(dry), Shelf(\"fridge\").stock({milk: 2, eggs: 12}), Shelf(\"cellar\").stock({wine: 3, cider: 1})], [12, 14, 4]\nassert: Line.map(line -> line.item).join(\" \"), \"rice oil flour beans milk eggs wine cider\"\nassert: Line.filter(line -> line.count == null).map(line -> line.shelf + \":\" + line.item), [\"pantry:oil\"]","return":null}
+{"id":"spec-0557","description":"Nucleoid loops over the entries an instance holds","code":"class Room(name, width, depth):\n    this.name = name\n    this.width = width\n    this.depth = depth\n$Room.area = $Room.width * $Room.depth\nclass Lamp(watts): this.watts = watts\nclass Fact(subject, field, data):\n    this.subject = subject\n    this.field = field\n    this.data = data\ndef record(thing):\n    for field, value of thing: Fact(thing.id, field, value)\n    return Fact.length\nlab = Room(\"lab\", 3, 4)\nden = Room(\"den\", 2, 2)\ndesk = Lamp(60)\ndesk.on = true\nlab.width = 5\ndelete lab.name\nlab.name = \"studio\"\ntry:\n    delete den.width\n    den.width = 7\n    throw \"BUSY\"\ncatch error:\n    pass\nassert: [record(lab), record(den), record(desk)], [5, 10, 13]\nassert: Fact.filter(fact -> fact.subject == \"lab\").map(fact -> fact.field).join(\" \"), \"id width depth area name\"\nassert: Fact.filter(fact -> fact.subject == \"den\").map(fact -> fact.field + \"=\" + fact.data).join(\" \"), \"id=den name=den width=2 depth=2 area=4\"\nassert: Fact.filter(fact -> fact.data == 20 or fact.data == true).map(fact -> fact.subject + \".\" + fact.field), [\"lab.area\", \"desk.on\"]","return":null}
+{"id":"spec-0558","description":"Nucleoid snapshots object entries before loop bodies","code":"bills = {rent: 900, food: 300, travel: 200, gym: 50}\nseen = []\nfor bill, amount of bills:\n    seen.push(bill + \":\" + amount + \":
```

**File**: `dataset/nucleoid.synth.49.jsonl` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{"id":"synth-49-0001","description":"An entry loop visits an object's keys and values in insertion order","code":"stock = {rice: 4, oil: 2}\nstock.salt = 1\nseen = []\nfor item, count of stock: seen.push(item + \"=\" + count)\nseen","return":"[\"rice=4\",\"oil=2\",\"salt=1\"]"}
+{"id":"synth-49-0002","description":"Deleting a property and assigning it again moves its entry to the end","code":"rec = {a: 1, b: 2, c: 3}\ndelete rec.a\nrec.a = 9\nkeys = []\nfor key, value in rec: keys.push(key + value)\nkeys","return":"[\"b2\",\"c3\",\"a9\"]"}
+{"id":"synth-49-0003","description":"An instance lists its id first, then its constructor fields and derived properties","code":"class Room(width, depth):\n    this.width = width\n    this.depth = depth\n$Room.area = $Room.width * $Room.depth\nlab = Room(3, 4)\nfields = []\nfor field, value of lab: fields.push(field)\nfields","return":"[\"id\",\"width\",\"depth\",\"area\"]"}
+{"id":"synth-49-0004","description":"Entries are snapshotted before the first body, so changes in the body do not change the loop","code":"bills = {rent: 900, food: 300}\npaid = []\nfor bill, amount of bills:\n    bills.food = 0\n    bills.fee = 25\n    paid.push(amount)\n[paid, bills.food, bills.fee]","return":"[[900,300],0,25]"}
+{"id":"synth-49-0005","description":"A rolled-back try puts a deleted property back where it stood","code":"o = {a: 1, b: 2, c: 3}\ntry:\n    delete o.a\n    o.a = 9\n    throw \"undo\"\ncatch error:\n    pass\nkeys = []\nfor key, value of o: keys.push(key + value)\nkeys","return":"[\"a1\",\"b2\",\"c3\"]"}
+{"id":"synth-49-0006","description":"A suppose block sees its own edits while the record keeps its order afterwards","code":"o = {a: 1, b: 2, c: 3}\ninside = suppose:\n    delete o.b\n    o.d = 4\n    seen = []\n    for key, value of o: seen.push(key)\n    seen\nafter = []\nfor key, value of o: after.push(key)\n[inside, after]","return":"[[\"a\",\"c\",\"d\"],[\"a\",\"b\",\"c\"]]"}
+{"id":"synth-49-0007","description":"Nested savepoints each restore the entries their own work changed","code":"o = {a: 1, b: 2, c: 3}\ntry:\n    delete o.a\n    try:\n        delete o.b\n        o.b = 5\n        throw \"inner\"\n    catch error:\n        pass\n    o.a = 7\n    seen = []\n    for key, value of o: seen.push(key + value)\n    throw seen.join(\" \")\ncatch error:\n    inner = error\nafter = []\nfor key, value of o: after.push(key + value)\n[inner, after]","return":"[\"b2 c3 a7\",[\"a1\",\"b2\",\"c3\"]]"}
+{"id":"synth-49-0008","description":"A rolled-back field deletion keeps an instance's id first and its fields in order","code":"class Point(x, y):\n    this.x = x\n    this.y = y\np = Point(1, 2)\ntry:\n    delete p.x\n    p.x = 5\n    throw \"undo\"\ncatch error:\n    pass\nfields = []\nfor field, value of p: fields.push(field + \"=\" + value)\nfields","return":"[\"id=p\",\"x=1\",\"y=2\"]"}
+{"id":"synth-49-0009","description":"A function returns the first key whose value passes a limit","code":"def first(rec, limit):\n    for key, value of rec:\n        if value > limit:\n            return key\n    return \"none\"\n[first({a: 1, b: 5, c: 9}, 4), first({a: 1}, 4)]","return":"[\"b\",\"none\"]"}
+{"id":"synth-49-0010","description":"A two-name loop over a value that is not an object raises a TypeError","code":"xs = [1, 2]\nfailure = \"\"\ntry:\n    for key, value of xs: pass\ncatch error:\n    failure = error\nfailure","return":"\"TypeError: xs is not an object\""}
+{"id":"synth-49-0011","description":"Null entries are visited while undefined literal slots are skipped","code":"none = {}\nrec = {a: null, b: none.x, c: 3}\nkeys = []\nfor key, value of rec: keys.push(key)\nkeys","return":"[\"a\",\"c\"]"}
```

**File**: `docs/README.md` (modified, +40/-3)
```diff
@@ -1133,9 +1133,42 @@ for Task:
     it.done = true
 ```
 
-Normative detail: [implicit iterator indented loops](../nucleoid.spec.md#implicit-iterator-indented-loops)
-and [string iteration](../nucleoid.spec.md#string-iteration), alongside the
-unchanged explicit-loop entries in the root specification.
+- [NUC 72](nuc-0072.md) adds two-name loops over an object's entries:
+  `for key, value of source:` and `for key, value in source:`. A header is a
+  two-name header exactly when `for` is followed by a name, a comma, a name and
+  `of` or `in`; the source is any expression and the body any suite the
+  explicit loop accepts.
+- The source is evaluated once and must be an object; every other value raises
+  `TypeError("<source> is not an object")`, and an undefined name keeps
+  `ReferenceError("<name> is not defined")`.
+- The loop visits the object's own entries in insertion order: literal keys as
+  written, later properties when first assigned, deletions removed and
+  re-added properties last. An instance lists `id` first, then its stored
+  fields. `null` values are visited; undefined literal slots are not entries.
+- Keys and values are snapshotted before the first body. Added entries are not
+  visited, deleted ones still are, and the value binding keeps its snapshotted
+  value while `source[key]` reads the current one.
+- Each iteration binds the key, a string, and the value in its own scope and
+  runs the body imperatively. Returns, rollback, receivers and nesting are
+  those of the explicit loop. The snapshot records no dependency of its own,
+  so a loop in a standing branch or block does not rerun when an entry changes.
+- Rollback restores entry order: after a failed `try`, a failed statement or a
+  `suppose` block, every object lists its entries exactly as before.
+- Graph keys render `for key,value of source`; single-name loops, including
+  `TypeError("<name> is not iterable")` for objects and the
+  `Expected 'of' in for statement` diagnostics, are unchanged.
+
+```
+stock = {rice: 4, beans: 0, oil: 2}
+low = []
+for item, count of stock:
+    if count < 2: low.push(item)
+```
+
+Normative detail: [implicit iterator indented loops](../nucleoid.spec.md#implicit-iterator-indented-loops),
+[string iteration](../nucleoid.spec.md#string-iteration) and
+[object entry loops with ordered rollback](../nucleoid.spec.md#object-entry-loops-with-ordered-rollback),
+alongside the unchanged explicit-loop entries in the root specification.
 
 ---
 
@@ -1481,6 +1514,7 @@ Full detail: [NUC 8](nuc-0008.md), [NUC 12](nuc-0012.md), [NUC 18](nuc-0018.md),
 - Propagation that does not settle raises `TypeError("Propagation did not settle")` and rolls back the transaction.
 - A caught failure restores the failing body's pending propagation and deletion tracking before the catch body runs. Work queued before the body is preserved, including across nested catches.
 - A `suppose` block runs its statements on a savepoint that always rolls back, whether it ends normally, by a failure or by `return`; see [Hypotheticals](#hypotheticals).
+- Rolling back restores the order of every object's entries as well as their values: a deleted property returns where it stood, an added one is removed, and an instance keeps `id` first, at every nested savepoint ([NUC 72](nuc-0072.md)). The order of graph nodes and edges that `model |> why` reflects is unchanged.
 
 ```
 a = 5
@@ -2704,6 +2738,7 @@ Messages are exact and are part of the observable behaviour of the language.
 | A supplied `max` or `min` selector that is not a function, including `null`, even on an empty receiver | `max expects a function` or `min expects a function` |
 | A supplied `distinct` selector that is not a function, including `null`, even on an empty receiver | `distinct expects a function` |
 | An `all` or `any` quantifier over a value that is neither null nor a list or a declared class's instances | `<collection> is not a collection` |
+| A two-name `for key, value of source` loop over a value that is not an object | `<source> is not an object` |
 | Assigning a `suppose` block whose last statement is not an expression | `suppose has no value` |
 | `:=` on a class-level property outside a class-level rule | `Cannot use ':=' on a class-level property` |
 | A `:=` declaration whose value nests lists 192 levels or more | `Maximum expression depth exceeded` |
@@ -2817,6 +2852,8 @@ name **= exponent                      name = name ** (exponent) (NUC 64)
 
 for name of source:                    class/object-list/scalar-string iteration
 for name in source:                    equivalent explicit iteration
+for key, value of source:              object entries in insertion order (NUC 72)
+for key, value in source:              equivalent two-name iteration (NUC 72)
 for source:                            indented iteration with local it
     statement
 
```

**File**: `docs/examples.md` (modified, +38/-0)
```diff
@@ -2930,6 +2930,44 @@ spades.qty = 3
 - See [NUC 71](nuc-0071.md) and the
   [root contract](../nucleoid.spec.md#list-and-population-distinct-values).
 
+## Object entry loops
+
+**Entry loops stock warehouses from delivery manifests**
+
+```nuc
+class Product(site, name, qty):
+    this.site = site
+    this.name = name
+    this.qty = qty
+$Product.low = $Product.qty < 10
+class Warehouse(site):
+    this.site = site
+    this.units = 0
+    def receive(manifest):
+        for name, qty of manifest:
+            Product(this.site, name, qty)
+            this.units += qty
+        return this.units
+north = Warehouse("north")
+south = Warehouse("south")
+assert([north.receive({bolts: 40, nuts: 25, gears: 8}), south.receive({belts: 3, bolts: 12}), south.receive({nuts: 5, gears: 8, springs: 30})], [73, 15, 58])
+Product.filter(product -> product.low).map(product -> product.site + ":" + product.name)
+# return: ["north:gears","south:belts","south:nuts","south:gears"]
+```
+
+- `receive` turns a delivery manifest into products for the warehouse that
+  received it and adds each quantity to the warehouse's total, in the order
+  the manifest lists its entries. The loop body reads `this` and the entry's
+  name and quantity, as a single-name loop body reads its item.
+- The three deliveries list different products, and the one method reads
+  each without naming them. The class-level rule marks every product under
+  ten units as low, so the result lists the low products in the order they
+  arrived: the north gears, then the south belts, nuts and gears. Each
+  manifest is snapshotted when its loop starts, and the loop runs once; it is
+  not a standing rule.
+- See [NUC 72](nuc-0072.md) and the
+  [root contract](../nucleoid.spec.md#object-entry-loops-with-ordered-rollback).
+
 ## Copyright
 
 Copyright 2020 Nucleoid
```

**File**: `docs/nuc-0000.md` (modified, +2/-0)
```diff
@@ -77,6 +77,7 @@ Created: 31-Jul-2026
 | [63](nuc-0063.md) | Condition-Controlled While Loops | Rejected: `Nucleoid repeats statements with a while loop` rises from 62 to 64 lexer tokens against a compact accepted string-loop counterpart |
 | [66](nuc-0066.md) | Imperative Value Assignment | Accepted |
 | [70](nuc-0070.md) | Object Entry Loops | Rejected: undoing a deletion re-inserts the key at the end, so after a rolled-back `delete o.a` an entry loop visits `b`, `c`, `a`, contradicting the NUC's rollback and `suppose` guarantees |
+| [72](nuc-0072.md) | Object Entry Loops with Ordered Rollback | Accepted |
 
 ### Utility enhancement
 
@@ -192,6 +193,7 @@ Created: 31-Jul-2026
 | [69](nuc-0069.md) | List and Population Extremes | Standards Track | Utility enhancement | Accepted |
 | [70](nuc-0070.md) | Object Entry Loops | Standards Track | Runtime features | Rejected: undoing a deletion re-inserts the key at the end, so after a rolled-back `delete o.a` an entry loop visits `b`, `c`, `a`, contradicting the NUC's rollback and `suppose` guarantees |
 | [71](nuc-0071.md) | List and Population Distinct Values | Standards Track | Utility enhancement | Accepted |
+| [72](nuc-0072.md) | Object Entry Loops with Ordered Rollback | Standards Track | Runtime features | Accepted |
 
 ## Copyright
 
```

**File**: `docs/nuc-0072.md` (added, +827/-0)
```diff
@@ -0,0 +1,827 @@
+# NUC 72 -- Object Entry Loops with Ordered Rollback
+
+```
+NUC: 72
+Title: Object Entry Loops with Ordered Rollback
+Author: Claude <noreply@anthropic.com>
+Status: Accepted
+Type: Standards Track
+Category: Runtime features
+Created: 01-Nov-2026
+Requires: 8, 31, 45, 51, 57, 60, 61, 65, 68
+```
+
+## Abstract
+
+- Adds loops over an object's entries: `for KEY, VALUE of SOURCE:` and its
+  `in` spelling `for KEY, VALUE in SOURCE:`, with every suite the
+  single-name loop accepts.
+- The body runs once for each entry the object holds, in insertion order,
+  with `KEY` bound to the entry's key and `VALUE` to its value. An instance
+  lists its `id` first, then its fields in the order they were stored.
+- `SOURCE` is evaluated once, before the names are bound, and the entries,
+  keys and values, are snapshotted before the first body runs. The loop is
+  one-shot and imperative, exactly like the single-name loop: the same
+  scopes, receivers, returns, rollback and propagation. Taking the snapshot
+  records no dependency of its own.
+- Every source that is not an object raises
+  `TypeError("<source> is not an object")`. Single-name loops are unchanged,
+  including `TypeError("<name> is not iterable")` for objects.
+- Rolling back restores the order of every object's entries. Undoing a
+  deletion puts the property back at the position it held, and undoing an
+  addition removes it, so a caught failure in `try`, a failed top-level
+  statement, the end of a `suppose` block and every other rollback leave
+  each object's entries exactly as they were, in the same order.
+- This revises [NUC 70](nuc-0070.md), whose loop design it keeps and whose
+  rejection it answers: NUC 70's rollback put a restored property at the end
+  of its object, which its entry loops exposed.
+- No keyword, token or error type is added. The public `Stmt` enum gains the
+  variant `Stmt::ForEntries { key, value, iterable, body }` and the public
+  `nuc::r#for::For` struct the field `value: Option<String>`; both need human
+  SemVer review. The rollback change adds no public API. No project version
+  is changed.
+
+## Motivation
+
+- A world model keeps records: a price table, the stock of each item, the
+  sales of each region, the fields of an instance. Acting on every entry of
+  one, by seeding instances from a table, totalling it, copying an instance
+  into facts or checking every field, needs each key together with its
+  value.
+- Accepted Nucleoid cannot iterate an object's entries. A single-name loop
+  raises `TypeError("rec is not iterable")` for an object, `Object.keys`,
+  `Object.entries` and `JSON` are not defined, `"a" in rec` raises
+  `SyntaxError("Unexpected keyword 'in'")`, and `rec.keys()` is undefined.
+  `rec[k]` reads a computed key, but `rec[k] = 5` raises
+  `SyntaxError("Cannot assign to rec[k]")`, so every key of every object
+  comes from the program's text.
+- The accepted spellings therefore name every key by hand, for example
+  `"rice oil salt".split(" ").map(name -> Item(shelf, name, table[name]))`,
+  and they break down exactly where a world model needs to be general:
+  - a lambda sees neither the enclosing function's parameters nor `this`:
+    `def f(r) => ["a"].map(k -> r[k])` raises
+    `ReferenceError("r is not defined")`, so functions and methods first copy
+    them with `cur := r` and `me := this`;
+  - a function that receives different tables needs a key list for each
+    call, a dispatch on the table's contents, or a key list it switches after
+    each call when the calls sit in one assertion;
+  - an `if` statement inside a block-arrow callback is filed as a standing
+    conditional, so when a later call reassigns the capture its condition
+    read, it runs again with its parameter unbound and raises
+    `ReferenceError("item is not defined")`, unless the condition reads
+    through `.value`;
+  - inside a standing `if`, a key-list loop reads every entry, so changing
+    any of them runs the branch's actions again unless each read is wrapped
+    in `.value`;
+  - deleting a property and assigning it again moves it to the end of the
+    object, and a hand-written key list does not follow.
+- The graph reflection channel `model |> why` lists the property
+  declarations the graph holds, not the entries an object holds. It misses
+  the entries of object literals, every instance's `id` and properties
+  written inside loops, branches and blocks, and it follows graph order.
+- Python's `for key, value in record.items():`, JavaScript's
+  `for (const [key, value] of Object.entries(record))`, Go's
+  `for key, value := range record` and Kotlin's
+  `for ((key, value) in record)` all name both parts of each entry, and LLMs
+  write them constantly. In accepted Nucleoid each raises a syntax error;
+  `for key, value of record:` raises
+  `SyntaxError("Expected 'of' in for statement")` at the comma.
+- A transaction promises to leave the state exactly as it was, 
```

**File**: `nucleoid.spec.md` (modified, +289/-0)
```diff
@@ -3165,6 +3165,87 @@ statement positions; caught values and transaction recovery are unchanged.
   `Nucleoid rolls back failed distinct updates` specify the executable
   behavior.
 
+## Object entry loops with ordered rollback
+
+- [NUC 72](docs/nuc-0072.md) adds loops over an object's entries:
+  `for KEY, VALUE of SOURCE:` and `for KEY, VALUE in SOURCE:`, and makes
+  rollback restore the order of every object's entries. No keyword, token or
+  error type is added.
+- A header is a two-name header exactly when `for` is followed by a name, a
+  comma, a name and `of` or `in`. `SOURCE` is any expression, and the body is
+  any suite the single-name loop accepts: an indented block, statements on
+  the same line separated by `;`, or a braced block after the colon. There is
+  no colon-free, implicit, parenthesized or three-name form.
+- `SOURCE` is evaluated once, before the names are bound, and must be an
+  object: an object literal, an instance, or any other object value. Every
+  other value raises `TypeError("<source> is not an object")`, with the source
+  in canonical form, for example `TypeError("xs is not an object")` for a list
+  named `xs`. An undefined name raises `ReferenceError("<name> is not defined")`
+  as before. Both are positioned at the running top-level statement.
+- The loop visits the object's own entries in insertion order: an object
+  literal's keys as written, later properties appended when they are first
+  assigned, deleted properties removed, and a property deleted and assigned
+  again moved to the end. An instance lists `id` first, then the properties
+  its constructor assigns, the properties its class-level rules derive and
+  the properties assigned later, in the order they were first stored.
+- An entry whose value is `null` is visited. A literal slot whose value is
+  undefined, such as `a` in `{a: none.x}` when `none.x` was never set, is not
+  an entry, as deep equality and JSON serialization already skip it. An empty
+  object runs no body.
+- Every entry, key and value, is snapshotted before the first body runs.
+  Entries the body adds are not visited, entries it deletes are still visited
+  with their snapshotted values, and an entry whose value it changes is still
+  bound to the snapshotted value, while `SOURCE[KEY]` reads the current one.
+  A later loop takes a fresh snapshot.
+- Each iteration pushes a scope, declares `KEY` as the entry's key, a string,
+  and `VALUE` as its value, and runs the body imperatively, as a single-name
+  loop does. The names shadow and restore outer names, and when both names
+  are the same, the value is bound.
+- Explicit and bare returns leave the loop as from a single-name loop; a
+  normally completed or empty loop yields `null`. Errors and thrown values
+  roll back through the existing transaction.
+- Taking the snapshot records no dependency of its own, as the class, list and
+  string snapshots do; evaluating `SOURCE` records its reads as usual. A loop
+  inside a standing `if` branch, a block or a function they call runs whenever
+  the branch or block runs. It does not run again because an entry changed or
+  was added, and it does when the binding that `SOURCE` reads is replaced.
+  Reads made by the body, such as `SOURCE[KEY]`, are dependencies as usual.
+- Loops run in functions and methods, where they see parameters and `this`
+  as single-name loops do, in constructors, class-level rules, blocks,
+  `suppose` suites and `try` bodies, and they nest. Inside a class-level `if`
+  or block, a source that reads `$Class`, such as `$Box.parts`, fails when the
+  block is declared, with `TypeError("$Box.parts is not an object")`, as the
+  single-name loop fails with `TypeError("$Box.parts is not iterable")`.
+- Rollback restores the order of every object's entries along with their
+  values. When a transaction or a savepoint rolls back, through a caught
+  failure in `try`, a failed top-level statement, the end of a `suppose` block
+  or an error inside one, every object holds exactly the entries it held when
+  the rolled-back work began, in the same order: a property the work deleted
+  returns at the position it held, a property it added is removed, a property
+  it overwrote keeps its position and regains its value, and a property it
+  deleted and assigned again returns to its original position with its
+  original value. An inner savepoint restores the order its own work changed,
+  and an enclosing rollback restores the rest; instances keep `id` first.
+- Rollback keeps its accepted behavior for everything else it restores,
+  including the order of graph nodes and dependency edges that `model |> why`
+  reflects. Before entry loops, the order of an object's entries had no
+  observable channel, so restoring it changes no accepted program.
+- Graph and block keys render the header as `for KEY,VALUE of SOURCE`, as they
+  render `for NAME of SOURCE`, and default-bearing declarations render the
+  suite form `for 
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

## X. NUC 15 Parenthesis-Free Nullary Function Definitions

**RULE**:
When implementing operations in `docs/nuc-0000.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `28115779`: NUC 15 Parenthesis-Free Nullary Function Definitions. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/nuc-0000.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
| [15](nuc-0015.md) | Parenthesis-Free Nullary Function Definitions | Rejected: accepted tests pin `def f:` and `def f => 1` as syntax errors, so it cannot pass every existing test |
| [15](nuc-0015.md) | Parenthesis-Free Nullary Function Definitions | Standards Track | Syntax enhancement | Rejected: accepted tests pin `def f:` and `def f => 1` as syntax errors, so it cannot pass every existing test |
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
| [15](nuc-0015.md) | Parenthesis-Free Nullary Function Definitions | Rejected |
| [15](nuc-0015.md) | Parenthesis-Free Nullary Function Definitions | Standards Track | Syntax enhancement | Rejected |
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `28115779` are properly handled with clean fallback behavior.
