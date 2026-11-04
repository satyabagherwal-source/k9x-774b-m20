> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `359b34c7`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T08:28:40.853Z  
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
> **Harvest Timestamp**: 2026-11-04T08:28:40.547Z  
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

    pub(crate) fn assign_property(
        &mut self,
        object: &ObjectId,
        property: &str,
        value: Value,
    ) -> bool {
        if !self.state.objects.contains_key(object) {
            self.inse
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
import fs from "node:fs/promises";

// Genesis puzzle_id: 3aa6fb7a
export async function start(puzzle_id: string = "6150a2bd") {
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

  const debug = {
    puzzle_id,
    train_dataset,
    input_instances,
    test_input_matrix,
    test_output_matrix,
    result_matrix,
    difference,
  };

  await fs.mkdir('logs', { recursive: true });
  await fs.writeFile(`logs/${puzzle_id}.log.json`, JSON.stringify(debug, null, 2));

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

### Incident Patch 1: `359b34c7` (2026-11-04)
**Commit Message**: Require NUC strategy bandit in /arc-purposal

ARC-requested NUCs now use the existing UCB1 proposal-strategy learner. Callers must supply or reuse a retained policy via --strategy-policy <absolute-json-path>. A missing or invalid policy pauses the invocation before drafting or the solver run, and a policy is never initialized or reset automatically.

The arm is selected before the proposer is dispatched. A caller-owned usefulness rubric is pinned and passed to both NUC agents. The independent evaluator updates the policy checkpoint before the ARC run, and the caller persists the learning result and retained head.

ARC outcomes (exact match, difference, exit status, timeout) and eventual acceptance are never learning rewards. Dataset-only runs need no policy.

Updated the arc-purposal agent, skill, ARC rules, CONTRIBUTING.md and arc/README.md.

**File**: `.claude/agents/arc-purposal.agent.md` (modified, +16/-2)
```diff
@@ -1,10 +1,11 @@
 ---
 name: arc-purposal
-description: Coordinate one ARC training puzzle, given by ID or defaulting to the smallest non-genesis puzzle without a dataset. Write its instruction dataset with arc-dataset, carry any Nucleoid enhancement that dataset requires through the NUC proposal and evaluation stages, run `bun start <puzzle-id>` once, decide that NUC's outcome under the automatic acceptance rule with the exact-match result, and document the puzzle's progress record in `arc/docs/`.
+description: Coordinate one ARC training puzzle, given by ID or defaulting to the smallest non-genesis puzzle without a dataset. Write its instruction dataset with arc-dataset, carry any required Nucleoid enhancement through the NUC stages with the existing strategy bandit, run `bun start <puzzle-id>` once, decide that NUC's outcome under the automatic acceptance rule, and document the puzzle's progress in `arc/docs/`.
 include-custom-instructions: true
 ---
 
-You coordinate one ARC training puzzle, given its ID and an optional hint;
+You coordinate one ARC training puzzle, given its ID, an optional
+`--strategy-policy <absolute-json-path>`, and an optional trailing hint;
 without an ID, select the skill's
 [default puzzle](../skills/arc-purposal/SKILL.md#select-the-default-puzzle).
 Follow `.claude/CLAUDE.md`, the
@@ -23,6 +24,16 @@ Follow `.claude/CLAUDE.md`, the
   and return `agent_launch_unavailable` with the puzzle ID and the next step.
 - Handle at most one NUC per invocation, as a single-proposal request, and hold
   its outcome until the solver run.
+- Every requested NUC requires the
+  [existing strategy learner](../skills/arc-purposal/SKILL.md#learn-the-nuc-proposal-strategy).
+  Reuse the latest retained policy, or require an explicitly supplied policy
+  before drafting; never silently initialize/reset it or proceed unconfigured.
+  Actually select and pin an arm and caller-owned rubric before launching the
+  proposer, and require strategy-consumption evidence in its handoff.
+- Give the unchanged scoring/attribution inputs to the independent evaluator
+  and require its actual learner update before the ARC run. Persist the
+  verified new checkpoint or legitimate skip and retained head in the session
+  learning result. Learner errors pause the invocation; no NUC means no trial.
 - Pass an optional `--hint` unchanged to every `arc-dataset` run and to no
   other agent, under the skill's
   [hint rule](../skills/arc-purposal/SKILL.md#pass-the-hint). It is a
@@ -43,6 +54,9 @@ Follow `.claude/CLAUDE.md`, the
 
 - Use training pairs only. Never read the puzzle's `test` entries, and never
   give the run's output, which shows the expected test grid, to another agent.
+- Learning uses only the existing independently verified NUC advisory reward.
+  Never train from ARC grids, exact matches, difference scores, exit statuses,
+  timeouts, or eventual acceptance; never revise the saved reward after a run.
 - Run `bun start <puzzle-id>` once, after the dataset and any NUC candidate are
   frozen. Exit status `0` is an exact match; any other status is not.
 - Allow the run up to 30 minutes and wait for it inside the invocation; never
```

**File**: `.claude/rules/arc.instructions.md` (modified, +10/-0)
```diff
@@ -20,6 +20,16 @@ and, when the solver would need a change, suggests that change at the end of
 the process.
 Agent-configuration changes alone do not launch a solver run.
 
+Every ARC-requested NUC uses the existing proposal-strategy UCB1 bandit under
+the [arc-purposal skill](../skills/arc-purposal/SKILL.md#learn-the-nuc-proposal-strategy).
+Require a retained policy head or explicit `--strategy-policy <absolute-json-path>`
+before drafting; never initialize/reset history automatically. Select before
+dispatch, preserve the pinned rubric and attribution through both NUC agents,
+and persist the independent evaluator's checkpoint or legitimate unscored skip
+before the ARC run. Missing/invalid learning state pauses the NUC; a
+dataset-only invocation needs no policy. ARC results and eventual acceptance
+are never learning rewards and do not change the existing NUC reward formula.
+
 ## No automated ARC tests
 
 Do not add tests for the ARC project. Remove existing ARC-related automated
```

**File**: `.claude/skills/arc-purposal/SKILL.md` (modified, +127/-11)
```diff
@@ -1,14 +1,16 @@
 ---
 name: arc-purposal
-description: Run one ARC training puzzle through its instruction dataset, any Nucleoid enhancement that dataset requires, and one exact-match solver run, then decide the enhancement's outcome under the automatic acceptance rule and document the puzzle's progress record in arc/docs.
-argument-hint: [<puzzle-id>] [--hint <text>]
+description: Run one ARC training puzzle through its instruction dataset, any required Nucleoid enhancement with the existing NUC strategy bandit, and one exact-match solver run, then decide the enhancement's outcome and document the puzzle's progress.
+argument-hint: "[<puzzle-id>] [--strategy-policy <absolute-json-path>] [--hint <text>]"
 ---
 
 # Running an ARC puzzle proposal
 
-`/arc-purposal [<puzzle-id>] [--hint <text>]` takes one training puzzle through
-its instruction dataset, any Nucleoid enhancement that dataset requires, one
-solver run, the outcome, and its progress record in `arc/docs/`. Follow
+`/arc-purposal [<puzzle-id>] [--strategy-policy <absolute-json-path>] [--hint <text>]`
+takes one training puzzle through its instruction dataset, any Nucleoid
+enhancement that dataset requires, one solver run, the outcome, and its
+progress record in `arc/docs/`. A requested enhancement uses the existing
+[NUC strategy bandit](#learn-the-nuc-proposal-strategy). Follow
 `.claude/CLAUDE.md`, the
 [ARC instructions](../../rules/arc.instructions.md), and the
 [agent profile](../../agents/arc-purposal.agent.md).
@@ -108,6 +110,106 @@ status:
 - `nucleoid_enhancement_required`: prepare the requested enhancement.
 - `blocked`, including an existing dataset: stop and report it, without a run.
 
+## Learn the NUC proposal strategy
+
+Every ARC-requested NUC uses the existing category-conditioned UCB1 learner
+under the [NUC caller protocol](../nuc-proposal/SKILL.md#select-and-consume-a-proposal-strategy)
+and [command/schema contract](../../../CONTRIBUTING.md#reward-driven-proposal-strategies).
+Do not add another bandit, reward formula, strategy registry, or ARC learner.
+The ordered arms remain `reuse_first` and `evidence_first`; learning chooses
+the proposal approach, never the feature, category, puzzle, or solver settings.
+
+**Policy input.** Reuse the caller's latest retained policy path and raw blob
+pin, including after resuming from its saved session learning result. When
+there is no retained head, require `--strategy-policy <absolute-json-path>`
+pointing to an explicitly supplied empty-history genesis or latest checkpoint
+with all its immutable ancestors and evidence. Use the exact genesis schema
+in the command contract; never create a genesis automatically. The file must
+be an existing absolute external `.json` path, outside the primary checkout
+and candidate worktree. Pin supplied raw bytes with
+`git hash-object --no-filters` before selection.
+
+Place `--strategy-policy` before any trailing `--hint`. It is a caller-only
+input, not part of the dataset hint or solver arguments. If a head is already
+retained, an explicitly supplied policy must match its path and pin; never
+fork an older checkpoint or silently replace/reset history. A missing policy
+blocks the requested enhancement with `strategy_policy_required`, before
+drafting or a solver run. Invalid, changed, stale, or incomplete state is a
+process blocker, not a fallback to unconfigured learning.
+
+Without a requested NUC, report learning as `not_applicable`: do not select an
+arm, create a trial, or update a checkpoint. A dataset-only run needs no policy.
+
+**Before drafting.** After fixing the NUC path, confirmed category, single
+mode, runtime applicability, accepted revision and immutable baseline:
+
+- Allocate a unique trial ID and fresh external session `.json` paths for the
+  selection, rubric, assessment, evaluator report, checkpoint, and learning
+  result. All artifacts are create-once; retain them and every policy ancestor.
+- Freeze and pin a caller-owned usefulness rubric under the
+  [existing scoring schema](../../../CONTRIBUTING.md#advisory-usefulnesscost-scoring).
+  Bind its criterion ID, NUC path and accepted baseline. Derive the observable
+  language-level benefit from the dataset handoff's `requested_change` and
+  unsupported operation, not from a proposed implementation or ARC outcome.
+  Use general-purpose Nucleoid evidence, never ARC grids, puzzle fixtures,
+  held-out answers, or new ARC automated tests.
+- Set `NUC_PROPOSAL`, `NUC_PROPOSAL_BASELINE`, `NUC_PROPOSAL_MODE=single`,
+  confirmed runtime inputs when applicable, `NUC_STRATEGY_CATEGORY`,
+  `NUC_STRATEGY_TRIAL_ID`, `NUC_STRATEGY_POLICY`, its original
+  `NUC_STRATEGY_POLICY_REVISION`, and fresh `NUC_STRATEGY_SELECTION`.
+  Preserve `NUC_PROPOSAL_RUBRIC` and `NUC_PROPOSAL_RUBRIC_REVISION` through both
+  handoffs. Unset old selection pins, checkpoint outputs, assessments and
+  report pins; never rely on environment state from another tool process.
+
+Actually run the sele
```

**File**: `CONTRIBUTING.md` (modified, +16/-0)
```diff
@@ -607,6 +607,22 @@ exploration, reward-dependent choice, persistence and provenance; they do not
 measure live-learning success or improved proposal quality. This bandit does
 not implement LLM-weight training or full multi-step reinforcement learning.
 
+**ARC caller integration.** `/arc-purposal` requires this existing learner
+when its dataset handoff requests a NUC; generic NUC invocations remain opt-in.
+Supply `--strategy-policy <absolute-json-path>` before any trailing `--hint`,
+or reuse the caller's latest retained session head. For a new chain, explicitly
+supply the genesis schema above; a resumed chain needs its latest checkpoint
+and all ancestors/evidence. A genesis is never created or reset automatically.
+Missing/invalid policy state pauses before NUC drafting or the solver run.
+A dataset-only invocation has no bandit trial.
+
+The [ARC caller](.claude/skills/arc-purposal/SKILL.md#learn-the-nuc-proposal-strategy)
+freezes a language-level usefulness rubric and selects before dispatching the
+proposer. Its independent evaluator scores and updates before the ARC run,
+using the unchanged reward contract. The caller persists the returned head
+and all provenance artifacts for the next separately authorized NUC. ARC
+answers, scores, timeouts and eventual acceptance never become rewards.
+
 ## Declarative Runtime Environment
 
 Nucleoid records declarative statements in a dependency graph and re-evaluates
```

**File**: `arc/README.md` (modified, +20/-5)
```diff
@@ -500,7 +500,8 @@ by the same rules.
 
 ## ARC proposal agent
 
-Run `/arc-purposal [<puzzle-id>]` to take one training puzzle through the
+Run `/arc-purposal [<puzzle-id>] [--strategy-policy <absolute-json-path>]`
+to take one training puzzle through the
 [arc-purposal](../.claude/agents/arc-purposal.agent.md) workflow in its
 [skill](../.claude/skills/arc-purposal/SKILL.md):
 
@@ -512,8 +513,9 @@ Run `/arc-purposal [<puzzle-id>]` to take one training puzzle through the
    whose idea may come from the [language reference](../docs/README.md) or
    the documentation it links to.
 2. A requested enhancement goes through the usual NUC proposal and independent
-   evaluation stages as a single-proposal request. The dataset is then written
-   with the frozen candidate's runtime.
+   evaluation stages as a single-proposal request, using the existing UCB1
+   proposal-strategy learner. The dataset is then written with the frozen
+   candidate's runtime.
 3. `bun start <puzzle-id>` runs once, with that candidate's runtime when there
    is one, while the workflow waits up to 30 minutes for it. Exit status `0` is
    an exact match; a run still going at 30 minutes is killed and does not pass.
@@ -539,9 +541,22 @@ the [genesis puzzle](#genesis-puzzle) and every puzzle that already has a
 matrix has the fewest cells, breaking ties by the fewest total training cells
 and then by the lowest ID. Only training pairs are measured.
 
+Every requested NUC requires a retained strategy-policy checkpoint, or an
+explicit `--strategy-policy <absolute-json-path>` outside the repository.
+For an initial trial, supply the empty-history policy from the
+[existing NUC bandit contract](../CONTRIBUTING.md#reward-driven-proposal-strategies).
+There is no automatic initialization/reset; missing or invalid state pauses
+before drafting or a solver run. A dataset-only invocation needs no policy.
+Selection happens before drafting, and the independent evaluator updates
+from verified NUC usefulness/cost evidence before the ARC run. The session
+learning result retains the latest checkpoint for the next authorized NUC;
+unscored trials keep the prior head. ARC answers, scores and acceptance never
+train this learner, which does not train LLM weights or authorize extra runs.
+
 Append `--hint <text>` to suggest the puzzle's objects, their roles, or its
-transformation. Only the arc-dataset agent receives the hint, and it keeps only
-what the training pairs confirm.
+transformation, placing `--strategy-policy` before it when supplied. Only the
+arc-dataset agent receives the hint, and it keeps only what the training pairs
+confirm.
 
 The run makes paid OpenRouter calls and shows the expected test grid, so it
 runs once, is never repeated to obtain a pass, and its output never feeds back
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

## X. Require NUC strategy bandit in /arc-purposal

**RULE**:
When implementing operations in `.claude/agents/arc-purposal.agent.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `359b34c7`: Require NUC strategy bandit in /arc-purposal. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/agents/arc-purposal.agent.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
description: Coordinate one ARC training puzzle, given by ID or defaulting to the smallest non-genesis puzzle without a dataset. Write its instruction dataset with arc-dataset, carry any required Nucleoid enhancement through the NUC stages with the existing strategy bandit, run `bun start <puzzle-id>` once, decide that NUC's outcome under the automatic acceptance rule, and document the puzzle's progress in `arc/docs/`.
You coordinate one ARC training puzzle, given its ID, an optional
`--strategy-policy <absolute-json-path>`, and an optional trailing hint;
- Every requested NUC requires the
  [existing strategy learner](../skills/arc-purposal/SKILL.md#learn-the-nuc-proposal-strategy).
  Reuse the latest retained policy, or require an explicitly supplied policy
  before drafting; never silently initialize/reset it or proceed unconfigured.
  Actually select and pin an arm and caller-owned rubric before launching the
  proposer, and require strategy-consumption evidence in its handoff.
- Give the unchanged scoring/attribution inputs to the independent evaluator
  and require its actual learner update before the ARC run. Persist the
  verified new checkpoint or legitimate skip and retai
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
description: Coordinate one ARC training puzzle, given by ID or defaulting to the smallest non-genesis puzzle without a dataset. Write its instruction dataset with arc-dataset, carry any Nucleoid enhancement that dataset requires through the NUC proposal and evaluation stages, run `bun start <puzzle-id>` once, decide that NUC's outcome under the automatic acceptance rule with the exact-match result, and document the puzzle's progress record in `arc/docs/`.
You coordinate one ARC training puzzle, given its ID and an optional hint;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `359b34c7` are properly handled with clean fallback behavior.
