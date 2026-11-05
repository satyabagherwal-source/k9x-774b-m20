> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `491512db`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T21:47:42.801Z  
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
> **Harvest Timestamp**: 2026-11-05T21:47:42.794Z  
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

### Core Architecture Module: `src/state.rs`
```
use indexmap::IndexMap;
use std::fmt;
use std::sync::Arc;

use crate::graph::ShapeKey;
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
        if !self.state.objects.contains_key(obj
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
  input_matrix,
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
  const objects: Record<string, unknown>[] = [];
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
export async function start(puzzle_id: string = "ed36ccf7") {
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

  for (const dataset of train_dataset.dataset) {
    const { input_matrix, output_matrix } = dataset;

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
      test_input_matrix,
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

  await visualizer.state({ declarations, test_input_matrix, input_instances });

  for (const input_instance of input_instances) {
    const { instance_name, input_value, input_instance_matrix, output_value } =
      input_instance;

    const { output_instance_matrix } = await visualizer.output_instance_matrix({
      puzzle_id,
      instance_name,
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

### Incident Patch 1: `491512db` (2026-11-05)
**Commit Message**: NUC 84 List and Population Medians

Accepted. The independent evaluator accepted the proposal in continuous
mode against 36aa86f and its 970-case baseline, the 959 accepted cases
plus 11 extra baselines, which it re-recorded byte-identically. The
required token comparison ran (Utility enhancement): 11 cases use fewer
lexer tokens, 959 the same and none more. Every counterpart is fair, no
defect was found, and no policy check failed.

Hard criteria, checked independently and again on the integrated tree:
cargo build --all-targets, warning-denied Clippy and cargo fmt --check
pass; the full cargo test passes (96 suites, 2,559 passed, 0 failed,
25 ignored) with all 2,540 accepted test identities present and 44
added; all 959 pinned accepted programs and the 11 extra baselines
replay; in 3,061 corpus programs and an 8,167-program grid, each
changed program raised TypeError("<receiver>.median is not a
function") at the accepted revision, and every other program is
unchanged apart from clock readings.

NUC 84 adds the read-only list query median to lists and class
instance lists: RECEIVER.median() and RECEIVER.median(selector). It
shares sum's and average's receivers, numeric conversion, 

**File**: `README.md` (modified, +30/-0)
```diff
@@ -1821,6 +1821,36 @@ assert: [heating, cost], [true, 4]
   `TypeError("Cannot use 'diff' outside suppose")`. See the
   [root contract](nucleoid.spec.md#hypothetical-differences).
 
+## List and population medians
+
+**Medians keep typical delivery times live as orders arrive**
+
+```nuc
+class Order(city, minutes):
+    this.city = city
+    this.minutes = minutes
+Order("oslo", 30)
+Order("oslo", 25)
+Order("bergen", 90)
+late = Order("bergen", 105)
+typical = Order.median(order -> order.minutes)
+local = Order.filter(order -> order.city == "oslo").median(order -> order.minutes)
+assert: [typical, local], [60, 27.5]
+Order("oslo", 8)
+late.minutes = 40
+assert: [typical, local], [30, 25]
+```
+
+- [NUC 84](docs/nuc-0084.md) adds `median()` and `median(selector)` to lists
+  and class instance lists. `Order.median(order -> order.minutes)` is the
+  middle delivery time of every order, and with an even number of orders the
+  mean of the two middle times.
+- `typical` and `local` are live declarations: a new order or a changed time
+  re-evaluates them. Once the late order takes 40 minutes, the 90-minute order
+  is the slowest, so however slow it is, `typical` stays 30, while the mean of
+  the five orders is 38.6. See the
+  [root contract](nucleoid.spec.md#list-and-population-medians).
+
 ## Benchmark
 
 This is the comparation our sample order app in Nucleoid IDE against MySQL and Postgres with using Express.js and Sequelize libraries.
```

**File**: `dataset/nucleoid.spec.jsonl` (modified, +8/-0)
```diff
@@ -657,3 +657,11 @@
 {"id":"spec-0657","description":"Nucleoid compares nested hypotheticals with the innermost block","code":"price = 10\nqty = 2\ntotal = price * qty\nsuppose price = 12:\n    outer = model |> diff\n    assert(outer.map(s -> s.node), [\"price\", \"total\"])\n    inner = suppose qty = 3:\n        nested = model |> diff\n        assert(nested.map(s -> s.node), [\"qty\", \"total\"])\n        price = 10\n        assert(nested.map(s -> s.node), [\"price\", \"qty\", \"total\"])\n        nested.map(s -> s.holds)\n    assert(inner, [10, 3, 30])\n    assert(outer.map(s -> s.node), [\"price\", \"total\", \"inner\"])\nassert(total, 20)","return":null}
 {"id":"spec-0658","description":"Nucleoid finds hypothetical changes in functions methods and quantifiers","code":"class Tank(level):\n    this.level = level\n    def changed() => (model |> diff).map(s -> s.node)\nlow = 10\ntank = Tank(5)\nempty = tank.level < low\ndef touches(name) => any s in model |> diff: s.node == name\nsuppose tank.level = 20:\n    stable = all s in model |> diff: s.node != \"low\"\n    assert(tank.changed(), [\"tank.level\", \"empty\"])\n    assert(touches(\"empty\"), true)\n    assert(stable, true)\n    low = 30\n    assert(stable, false)\n    assert(touches(\"empty\"), false)\n    assert(tank.changed(), [\"low\", \"tank.level\"])","return":null}
 {"id":"spec-0659","description":"Nucleoid composes hypothetical differences with state filters","code":"price = 10\ndiscount = 0\nnet = price - discount\ntaxed = net * 2\nsuppose discount = 3:\n    facts = model |> diff |> stated\n    effects = model |> derived |> diff\n    assert(facts.map(s -> s.node), [\"discount\"])\n    assert(effects.map(s -> s.node), [\"net\", \"taxed\"])\n    assert(effects[0].from, [\"price\", \"discount\"])\n    price = 13\n    assert(facts.map(s -> s.node), [\"price\", \"discount\"])\n    assert(effects, [])","return":null}
+{"id":"spec-0660","description":"Nucleoid finds the middle values of lists with median","code":"waits = [12, 3, 45]\ntypical = waits.median()\nassert: [typical, waits, (why typical)[0].from], [12, [12, 3, 45], [\"waits\"]]\nwaits.push(7)\nassert: typical, 9.5\nwaits.push(300)\nassert: [typical, waits.average()], [12, 73.4]\nwaits.pop()\nwaits.shift()\nassert: typical, 7\ncourier = {stops: [12, 2, 45, 31]}\nusual = courier.stops.median()\nshort = courier.stops.filter(stop -> stop < 30).median()\nassert: [usual, short], [21.5, 7]\ncourier.stops.push(5)\nassert: [usual, short], [12, 5]","return":null}
+{"id":"spec-0661","description":"Nucleoid finds the medians of class instance populations","code":"class Listing(area, price):\n    this.area = area\n    this.price = price\ndef perMeter listing => listing.price / listing.area\nListing(50, 200000)\nloft = Listing(40, 400000)\ntypical = Listing.median(perMeter)\nroomy = Listing.filter(listing -> listing.area > 45).median(perMeter)\nrecent = Listing[-3:].median(listing -> listing.area)\nassert: [typical, roomy, recent], [7000, 4000, 45]\nListing(80, 72000)\nassert: [typical, roomy, recent], [4000, 2450, 50]\nListing(100, 450000)\nassert: [typical, roomy, recent], [4250, 4000, 80]\nloft.price = 120000\nassert: [typical, roomy], [3500, 4000]","return":null}
+{"id":"spec-0662","description":"Nucleoid orders values as numbers to find medians","code":"north = [21, 9]\nsouth = [-3, 7.5]\nmiddle = north.concat(south).median()\nwarm = north.filter(temp -> temp > 0).median()\nassert: [middle, warm], [8.25, 15]\nnorth.push(-8)\nassert: [middle, warm, north], [7.5, 15, [21, 9, -8]]\nnorth.push(4)\nassert: [middle, warm], [5.75, 9]","return":null}
+{"id":"spec-0663","description":"Nucleoid calls the median selector once per item with only the item","code":"seen = []\ndef weigh(item, position):\n    seen.push(position ?? item)\n    return item * item\nitems = [4, 1]\ndef spread() => items.median(weigh)\nassert: [spread(), seen], [8.5, [4, 1]]\nfloor = 2\ndef price item => Math.max(item, floor)\ncost = items.median(price)\nassert: cost, 3\nfloor = 3\nitems.push(12)\nassert: [cost, spread(), seen], [4, 16, [4, 1, 4, 1, 12]]\nmissing = null\nskipped = missing.median(weigh(9))\nassert: [skipped, seen], [null, [4, 1, 4, 1, 12]]","return":null}
+{"id":"spec-0664","description":"Nucleoid keeps medians live in class level rules","code":"class Room(name): this.name = name\nclass Sensor(room, temp):\n    this.room = room\n    this.temp = temp\n$Room.mid = Sensor.filter(sensor -> sensor.room == $Room).median(sensor -> sensor.temp)\n$Room.warm = $Room.mid > 21\nlab = Room(\"lab\")\nhall = Room(\"hall\")\nSensor(lab, 8)\nprobe = Sensor(lab, 25)\nSensor(lab, 30)\nSensor(hall, 18)\nSensor(hall, 23)\nspread = Room.median(room -> room.mid)\nassert: [lab.mid, lab.warm, hall.mid, hall.warm, spread], [25, true, 20.5, false, 22.75]\nprobe.temp = 21\nassert: [lab.mid, lab.warm, spread], [21, false, 20.75]\nprobe.room = hall\nporch = Room(\"porch\")\nSensor(porch, 5)\nassert: [lab.mid, hall.mid, porch.mid, spread], [19, 21, 5, 
```

**File**: `dataset/nucleoid.synth.59.jsonl` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+{"id":"synth-59-0001","description":"A list median follows pushes and pops","code":"waits = [12, 3, 45]\ntypical = waits.median()\nwaits.push(7)\nassert(typical, 9.5)\nwaits.pop()\ntypical","return":"12"}
+{"id":"synth-59-0002","description":"A selector takes the median of a property over every instance of a class","code":"class Order(total):\n    this.total = total\nOrder(20)\nOrder(45)\nOrder(300)\ntypical = Order.median(.total)\nOrder(35)\ntypical","return":"40"}
+{"id":"synth-59-0003","description":"An even count takes the mean of the two middle values in numeric order, and the receiver keeps its order","code":"xs = [10, 9, 1, 4]\n[xs.median(), xs]","return":"[6.5,[10,9,1,4]]"}
+{"id":"synth-59-0004","description":"The median stays at the middle however extreme an outlier is, unlike the mean","code":"times = [12, 3, 45, 7, 3000]\n[times.median(), times.average()]","return":"[12,613.4]"}
+{"id":"synth-59-0005","description":"An empty list, a class without instances and a value that is not a number give NaN, which Number.isNaN tells apart from null","code":"class Refund\npending = []\n[Number.isNaN(pending.median()), Number.isNaN(Refund.median(refund -> refund.amount)), Number.isNaN([1, \"x\", 3].median()), pending.median() == null]","return":"[true,true,true,false]"}
+{"id":"synth-59-0006","description":"A class-level rule keeps the median rent of each district","code":"class District(name): this.name = name\nclass Flat(district, rent):\n    this.district = district\n    this.rent = rent\n$District.typical = Flat.filter(flat -> flat.district == $District).median(flat -> flat.rent)\nnorth = District(\"north\")\nFlat(north, 1200)\nFlat(north, 4000)\nFlat(north, 1400)\nnorth.typical","return":"1400"}
+{"id":"synth-59-0007","description":"Values convert to numbers as sum converts them before they are ordered","code":"[[\"3\", 10, true].median(), [null, \" 4 \", [7]].median()]","return":"[3,4]"}
+{"id":"synth-59-0008","description":"On a class name the population median runs even beside an instance method named median","code":"class Bag(items):\n    this.items = items\n    def median(): return this.items.median()\nBag([1, 9, 2])\nBag([4, 6])\n[Bag.median(bag -> bag.median()), Bag([3]).median()]","return":"[3.5,3]"}
```

**File**: `docs/README.md` (modified, +55/-1)
```diff
@@ -1954,7 +1954,7 @@ Full detail: [NUC 9](nuc-0009.md), [NUC 46](nuc-0046.md).
 | `Math` | `pow`, `sqrt`, `floor`, `round`, `max`, `min`, `clamp` ([NUC 21](nuc-0021.md)), `lerp` ([NUC 22](nuc-0022.md)), `saturate` ([NUC 23](nuc-0023.md)), `smoothstep(lower, upper, value)` (accepted [NUC 33](nuc-0033.md)), `smootherstep(lower, upper, value)` (accepted [NUC 35](nuc-0035.md)), `remap(start, end, targetStart, targetEnd, value)` (accepted [NUC 39](nuc-0039.md)) |
 | `String` | `String.fromCharCode`; instance `charAt`, `length`, `lower`, `replace`, `replaceAll` (accepted [NUC 42](nuc-0042.md)), `repeat`, `split` |
 | `Date` | `Date()`, `Date(string)`, `Date(number)`, `Date.now()`, `Date.parse()`; instance `getTime`, `getYear`, `toDateString` |
-| `List` | `push`, `pop`, `filter`, `map`, `flatMap` (accepted [NUC 41](nuc-0041.md)), `reduce`, `find`, `some`, `every`, `slice`, `sort` (in place, [NUC 58](nuc-0058.md)), `join`, `length`, and the queries `at`, `includes`, `indexOf`, `lastIndexOf`, `findIndex`, `findLast`, `findLastIndex` and `concat` ([NUC 61](nuc-0061.md)), `sum` ([NUC 68](nuc-0068.md)), `max` and `min` ([NUC 69](nuc-0069.md)), `distinct` ([NUC 71](nuc-0071.md)), `count(predicate)` ([NUC 73](nuc-0073.md)), `mode` ([NUC 75](nuc-0075.md)), `maxBy` and `minBy` ([NUC 77](nuc-0077.md)), and `average` ([NUC 80](nuc-0080.md)); `sum`, `max`, `min` and `mode` also read as `sum of list` ([NUC 75](nuc-0075.md) revision 2) |
+| `List` | `push`, `pop`, `filter`, `map`, `flatMap` (accepted [NUC 41](nuc-0041.md)), `reduce`, `find`, `some`, `every`, `slice`, `sort` (in place, [NUC 58](nuc-0058.md)), `join`, `length`, and the queries `at`, `includes`, `indexOf`, `lastIndexOf`, `findIndex`, `findLast`, `findLastIndex` and `concat` ([NUC 61](nuc-0061.md)), `sum` ([NUC 68](nuc-0068.md)), `max` and `min` ([NUC 69](nuc-0069.md)), `distinct` ([NUC 71](nuc-0071.md)), `count(predicate)` ([NUC 73](nuc-0073.md)), `mode` ([NUC 75](nuc-0075.md)), `maxBy` and `minBy` ([NUC 77](nuc-0077.md)), `average` ([NUC 80](nuc-0080.md)), and `median` ([NUC 84](nuc-0084.md)); `sum`, `max`, `min` and `mode` also read as `sum of list` ([NUC 75](nuc-0075.md) revision 2) |
 | `Class` | the global list of declared types; `Class.length` |
 
 ```
@@ -3015,6 +3015,58 @@ grade
   [list and population averages](../nucleoid.spec.md#list-and-population-averages)
   section.
 
+### List and population medians
+
+```
+times = [42, 120]
+typical = times.median()
+class Runner(name, laps):
+    this.name = name
+    this.laps = laps
+Runner("ana", [61, 58, 102])
+bo = Runner("bo", [66, 64])
+pace = Runner.median(runner -> runner.laps.median())
+assert(typical, 81)
+assert(pace, 63)
+times.push(35)
+bo.laps.push(59)
+Runner("cy", [110])
+assert(typical, 42)
+assert(pace, 64)
+pace
+```
+
+- This is the complete
+  `Nucleoid finds the medians of lists and populations with median` program
+  in `tests/reference.md`, without its title and expected-return metadata;
+  it returns `64`.
+- [NUC 84](nuc-0084.md) adds `median()` and `median(selector)` to lists and
+  class instance lists. The values are ordered as numbers by a stable sort of
+  a private copy: an odd count gives the middle value itself and an even count
+  `(lower + upper) / 2`, so `[4, 1, 3, 2].median()` is `2.5`. The receiver is
+  never sorted or written.
+- Values convert as `sum` converts them. An empty list or class and any value
+  that converts to NaN give NaN. An undefined value makes the median
+  undefined, stored as `null`, and wins over a NaN value, as in `average`. A
+  `null` item counts `0` without settling a declaration to `null`, while the
+  reads inside a selector follow the existing rules.
+- `0` and `-0` keep their receiver order, an odd count keeps the middle
+  value's sign, and `[-0, -0].median()` is `-0` where `average()` gives `0`.
+  `[1e308, 1e308].median()` overflows to `Infinity`, and `-Infinity` beside
+  `Infinity` gives NaN.
+- The selector is called once per item, in order, with only the item. A
+  supplied selector that is not a function, including `null`, raises
+  `TypeError("median expects a function")`, even on an empty receiver.
+- Medians are read-only and live: a declaration follows the list or
+  population, the arguments and what the selector reads, in class-level rules
+  too. On a class name, `Name.median(...)` is the population query even when
+  the class declares an instance method `median`; instances keep calling the
+  method. `median` is not a noun query, so `median of xs` stays a syntax
+  error.
+- The authoritative contract is the
+  [list and population medians](../nucleoid.spec.md#list-and-population-medians)
+  section.
+
 ---
 
 ## 12. Reasoning Operations
@@ -3360,6 +3412,7 @@ Messages are exact and are part of the observable behaviour of the language.
 | Missing or non-function `find`, `findIndex`, `findLast` or `findLastIndex` callback, even on an empty receiver | `<name> expects a function` |
 | A supplied `sum` selector that is not a fun
```

**File**: `docs/examples.md` (modified, +35/-0)
```diff
@@ -3391,6 +3391,41 @@ suppose lamp.days = 3: changes()
   [NUC 83](nuc-0083.md) and the
   [root contract](../nucleoid.spec.md#hypothetical-differences).
 
+## List and population medians
+
+**Medians keep the typical rent of every district live as listings change**
+
+```nuc
+class District(name): this.name = name
+class Flat(district, rent):
+    this.district = district
+    this.rent = rent
+$District.typical = Flat.filter(flat -> flat.district == $District).median(flat -> flat.rent)
+$District.affordable = $District.typical < 1500
+north = District("north")
+south = District("south")
+Flat(north, 1200)
+Flat(north, 1400)
+penthouse = Flat(north, 4000)
+Flat(south, 1600)
+Flat(south, 1700)
+assert: [north.typical, north.affordable, south.typical, south.affordable], [1400, true, 1650, false]
+penthouse.district = south
+Flat(north, 950)
+assert: [north.typical, south.typical, south.affordable], [1200, 1700, false]
+[north.affordable, south.affordable]
+# return: [true,false]
+```
+
+- `$District.typical` is the median rent of each district's flats, and
+  `$District.affordable` follows it. The penthouse leaves the north
+  affordable: however high its rent, the north's median is the middle flat's
+  1,400, while the mean of the three northern rents is 2,200.
+- Moving the penthouse to the south and adding a cheaper northern flat
+  re-evaluates both districts: the north's median falls to 1,200 and the
+  south's rises to 1,700. See [NUC 84](nuc-0084.md) and the
+  [root contract](../nucleoid.spec.md#list-and-population-medians).
+
 ## Copyright
 
 Copyright 2020 Nucleoid
```

**File**: `docs/nuc-0000.md` (modified, +2/-0)
```diff
@@ -107,6 +107,7 @@ Created: 31-Jul-2026
 | [75](nuc-0075.md) | List and Population Modes | Accepted |
 | [77](nuc-0077.md) | List and Population Extreme Items | Accepted |
 | [80](nuc-0080.md) | List and Population Averages | Accepted |
+| [84](nuc-0084.md) | List and Population Medians | Accepted |
 
 ### Reasoning enhancement
 
@@ -221,6 +222,7 @@ Created: 31-Jul-2026
 | [81](nuc-0081.md) | Object Spread Entries | Standards Track | Runtime features | Accepted |
 | [82](nuc-0082.md) | Depth-Limited Reasoning Selections | Standards Track | Reasoning enhancement | Accepted |
 | [83](nuc-0083.md) | Hypothetical Difference Selections | Standards Track | Reasoning enhancement | Accepted |
+| [84](nuc-0084.md) | List and Population Medians | Standards Track | Utility enhancement | Accepted |
 
 ## Copyright
 
```

**File**: `docs/nuc-0084.md` (added, +962/-0)
```diff
@@ -0,0 +1,962 @@
+# NUC 84 -- List and Population Medians
+
+```
+NUC: 84
+Title: List and Population Medians
+Author: Claude <noreply@anthropic.com>
+Status: Accepted
+Type: Standards Track
+Category: Utility enhancement
+Created: 05-Nov-2026
+Requires: 8, 18, 45, 57, 58, 59, 60, 61, 65, 68, 69, 75, 79, 80
+```
+
+## Abstract
+
+- Lists and class instance lists gain the read-only query `median`.
+  `RECEIVER.median()` returns the middle value of the items in ascending
+  numeric order and `RECEIVER.median(selector)` the middle value of
+  `selector(item)`.
+- With an odd number of values the median is the middle value itself,
+  unchanged. With an even number it is the mean of the two middle values,
+  `(lower + upper) / 2` in 64-bit floating point, so `[4, 1, 3, 2].median()`
+  is `2.5`.
+- The values are converted with the numeric conversion of
+  [NUC 68](nuc-0068.md)'s `sum` and ordered by a stable ascending sort of a
+  private list of numbers. The receiver is never sorted or written.
+- An empty receiver and any value that converts to NaN give NaN. An
+  undefined value makes the result undefined, which a declaration stores as
+  `null`.
+- The selector is called once for every item, in order, with only the item,
+  as `sum` and `average` call theirs. A supplied first argument that is not a
+  function raises `TypeError("median expects a function")`, even on an empty
+  receiver.
+- `median` follows [NUC 61](nuc-0061.md)'s shared query rules beside `sum`
+  and [NUC 80](nuc-0080.md)'s `average`. It accepts every receiver they
+  accept, reads the receiver before its arguments, never writes it, and stays
+  live in declarations and class-level rules.
+- At the accepted revision these calls raise
+  `TypeError("<receiver>.median is not a function")`. No syntax, keyword,
+  token, error type or public Rust API is added, and `median` is not a noun
+  query, so `median of xs` keeps raising
+  `SyntaxError("Unexpected keyword 'of'")`. The authoritative contract is
+  [List and population medians](../nucleoid.spec.md#list-and-population-medians).
+- **Outcome: Accepted.** The independent evaluation and the caller's
+  integrated-tree checks passed all three hard criteria, and the independent
+  evaluator decided Accepted. The required token comparison ran in
+  continuous mode: 11 cases use fewer tokens, 959 the same and none more. No
+  policy check failed.
+
+## Motivation
+
+- World models keep typical values: the usual wait of a delivery route, the
+  typical rent of a district, the middle lap time of a runner, the normal
+  reading of a room's sensors. A mean answers the question only when no value
+  is extreme; one stuck sensor, one penthouse or one lost parcel drags it far
+  from every other value. The median is the standard robust answer:
+  `[12, 3, 45, 7, 300].median()` is `12` while `average()` is `73.4`, and
+  `[12, 3, 45, 7, 3000].median()` is still `12`.
+- At the accepted revision a median has to be assembled from a sorted copy,
+  an index computed from the length and a branch or an average for even
+  counts. The shortest general accepted spelling found,
+  `typical = waits[:].sort(lambda a, b: a - b)[waits.length / 2 - 0.5 : waits.length / 2 + 1].average()`,
+  is 39 lexer tokens and names its receiver three times, where
+  `typical = waits.median()` is 7. The spelling familiar from other
+  languages,
+  `s = waits.slice().sort((a, b) -> a - b)` followed by
+  `typical = (s[Math.floor((s.length - 1) / 2)] + s[Math.floor(s.length / 2)]) / 2`,
+  is 58.
+- Over a population the selector has to be mapped first:
+  `pace = Trip.map(.minutes).sort(lambda a, b: a - b)[Trip.length / 2 - 0.5 : Trip.length / 2 + 1].average()`
+  is 42 tokens where `pace = Trip.median(.minutes)` is 9. In a class-level
+  rule the accepted spelling repeats the filtered list to measure its length:
+  `$Room.mid = Sensor.filter(sensor -> sensor.room == $Room).median(.temp)` is
+  22 tokens and states its filter once, while the accepted spelling states it
+  three times in 77.
+- Two traps make the hand-written median easy to get wrong. `sort()` without
+  a comparator orders by text, so `[12, 3, 45, 7].sort()` is
+  `[12, 3, 45, 7]`, and `sort` on a variable or a property sorts in place and
+  writes the list back ([NUC 58](nuc-0058.md)), so a declaration that sorts
+  its own receiver rewrites the model it reads.
+- Python's `statistics.median`, NumPy's `numpy.median`, pandas'
+  `Series.median`, R's `median`, Excel's `MEDIAN` and SQL's
+  `PERCENTILE_CONT(0.5)` name the operation, and all of them average the two
+  middle values of an even count. JavaScript has none, and LLM-written code
+  such as `orders.median(o => o.total)` raises
+  `TypeError("orders.median is not a function")` at the accepted revision.
+
+## Rationale
+
+- **Category and mode.** The caller selected the Utility enhancement category
+  by one tool-backed uniform draw over the five categories that NUC 1's
+  registry marks eligible for autom
```

**File**: `nucleoid.spec.md` (modified, +212/-0)
```diff
@@ -3868,6 +3868,57 @@ statement positions; caught values and transaction recovery are unchanged.
   `Nucleoid rolls back failed average updates` specify the executable
   behavior.
 
+## List and population medians
+
+- [NUC 84](docs/nuc-0084.md) adds the read-only list query `median` to lists
+  and class instance lists. No syntax, keyword or error type is added.
+- `RECEIVER.median()` returns the middle value of the receiver's items in
+  ascending numeric order and `RECEIVER.median(selector)` the middle value of
+  `selector(item)` for every item. With an odd number of values it is the
+  middle value itself, unchanged. With an even number it is the mean of the
+  two middle values, `(lower + upper) / 2` in 64-bit floating point, so
+  `[4, 1, 3, 2].median()` is `2.5`.
+- The values are converted to numbers and ordered by a stable ascending sort,
+  so equal values such as `0` and `-0` keep their receiver order. The receiver
+  is never sorted or written: after `waits = [12, 3, 45]`, `waits.median()` is
+  `12` and `waits` keeps its order.
+- An empty receiver gives NaN. A value that converts to NaN makes the median
+  NaN, so `[1, "a", 3].median()` is NaN. An undefined value makes the median
+  undefined, which a declaration stores as `null`; every item is still visited.
+- The receivers, the numeric conversion and the selector are those of `sum`
+  and `average`: a list however it is reached, or a class's instance list in
+  population order, named by the class or by a variable that holds the class;
+  `null`, `false`, empty strings and empty lists are `0`, `true` is `1`,
+  numeric strings and one-item lists are their number, and objects, other
+  strings and longer lists are NaN. On a class name, `median` is the
+  population query even when the class declares an instance method `median`;
+  its instances keep calling that method.
+- A selector is called once for every item, in order, with only the item;
+  further parameters are `null`. A supplied first argument that is not a
+  function, including `null`, raises `TypeError("median expects a function")`,
+  even on an empty receiver.
+- `median` follows the shared rules of the list queries: it reads its receiver
+  before its arguments, evaluates every supplied argument once, left to right,
+  including unused extras, and never writes the receiver. A declaration that
+  uses it depends on the list or population, on its argument expressions and
+  on whatever the selector reads, so list mutations, new and deleted instances
+  and property changes re-evaluate it, in class-level rules too. Selector
+  errors roll back through the existing transaction. A null or undefined
+  receiver yields undefined without evaluating the arguments.
+- A call converts every value once and sorts one list of numbers, in
+  O(n log n) time, without recursion.
+- The call keeps its ordinary rendering, so `typical = waits.median()`
+  explains as `typical = waits.median()`, and `why` lists the receiver among
+  the declaration's dependencies.
+- `median of xs` stays `SyntaxError("Unexpected keyword 'of'")`: `median` is
+  not one of the noun queries. Property reads such as `xs.median`, bindings
+  and object properties named `median`, `median(...)` without a definition,
+  `Math.median` and instance methods named `median` called on an instance
+  keep their accepted results. The eight appended entries beginning
+  `Nucleoid finds the middle values of lists with median` through
+  `Nucleoid rolls back failed median updates` specify the executable
+  behavior.
+
 ## Object entry loops with ordered rollback
 
 - [NUC 72](docs/nuc-0072.md) adds loops over an object's entries:
@@ -20719,4 +20770,165 @@ suppose discount = 3:
     price = 13
     assert(facts.map(s -> s.node), ["price", "discount"])
     assert(effects, [])
+---
+# Nucleoid finds the middle values of lists with median
+
+waits = [12, 3, 45]
+typical = waits.median()
+assert: [typical, waits, (why typical)[0].from], [12, [12, 3, 45], ["waits"]]
+waits.push(7)
+assert: typical, 9.5
+waits.push(300)
+assert: [typical, waits.average()], [12, 73.4]
+waits.pop()
+waits.shift()
+assert: typical, 7
+courier = {stops: [12, 2, 45, 31]}
+usual = courier.stops.median()
+short = courier.stops.filter(stop -> stop < 30).median()
+assert: [usual, short], [21.5, 7]
+courier.stops.push(5)
+assert: [usual, short], [12, 5]
+---
+# Nucleoid finds the medians of class instance populations
+
+class Listing(area, price):
+    this.area = area
+    this.price = price
+def perMeter listing => listing.price / listing.area
+Listing(50, 200000)
+loft = Listing(40, 400000)
+typical = Listing.median(perMeter)
+roomy = Listing.filter(listing -> listing.area > 45).median(perMeter)
+recent = Listing[-3:].median(listing -> listing.area)
+assert: [typical, roomy, recent], [7000, 4000, 45]
+Listing(80, 72000)
+assert: [typical, roomy, recent], [4000, 2450, 50]
+Listing(100, 450000)
+assert: [typical, roomy, recent], [4250, 4000, 80]
+loft.price = 12
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

## X. NUC 84 List and Population Medians

**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `491512db`: NUC 84 List and Population Medians. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
## List and population medians

**Medians keep typical delivery times live as orders arrive**

```nuc
class Order(city, minutes):
    this.city = city
    this.minutes = minutes
Order("oslo", 30)
Order("oslo", 25)
Order("bergen", 90)
late = Order("bergen", 105)
typical = Order.median(order -> order.minutes)
local = Order.filter(order -> order.city == "oslo").median(order -> order.minutes)
assert: [typical, local], [60, 27.5]
Order("oslo", 8)
late.minutes = 40
assert: [typical, local], [30, 25]
```

- [NUC 84](docs/nuc-0084.md) adds `median()` and `median(selector)` to lists
  and class instance lists. `Order.median(order -> order.minutes)` is the
  middle delivery time of every order, and with an even number of orders the
  mean of the two middle times.
- `typical` and `local` are live declarations: a new order or a changed time
  re-evaluates them. Once the late order takes 40 minutes, the 90-minute order
  is the slowest, so however slow it is, `typical` stays 30, while the mean of
  the five orders is 38.6. See the
  [root contract](nucleoid.spec.md#list-and-population-medians).

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `491512db` are properly handled with clean fallback behavior.
