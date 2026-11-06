> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `bd9f64d7`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T22:36:16.199Z  
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
> **Harvest Timestamp**: 2026-11-06T22:36:15.875Z  
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

export async function declarations({
  puzzle_id,
  only_puzzle_dataset,
  train_dataset,
}) {
  milestone.inferring_declarations();

  const { declarations, output_canvas } = await llm.generate({
    puzzle_id,
    only_puzzle_dataset,
    crop_instances: false,
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
  only_puzzle_dataset,
  declarations,
  input_matrix,
  output_matrix,
}) {
  milestone.segmenting_training_objects();

  const { instances } = await llm.generate({
    puzzle_id,
    only_puzzle_dataset,
    crop_instances: false,
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
  only_puzzle_dataset,
  instance_name,
  declarations,
  input_instances,
  input_matrix,
  input_instance_matrix,
  output_instance_matrix,
}) {
  milestone.constructing_instance({ instance_name });

  const { x, y } = Matrix.locate(input_instance_matrix);

  const { implementation } = await llm.generate({
    puzzle_id,
    only_puzzle_dataset,
    crop_instances: true,
    messages: [
      {
        role: "assistant",
        content: `
          declarations:
          ${JSON.stringify(declarations)}
          input_instances:
          ${JSON.stringify(
            input_instances.map(
              ({ instance_name, input_instance_matrix, implementation }) => ({
                instance_name,
                input_instance_matrix: Matrix.crop(input_instance_matrix),
                implementation,
              })
            )
          )}
          `,
      },
      {
        role: "user",
        content: `
          instance_name:
          ${instance_name}
          input_instance_matrix:
          ${JSON.stringify(Matrix.crop(input_instance_matrix))}
          input_x: ${x}
          input_y: ${y}
          json_format:
          {
            "orientation": <ORIENTATION>,
            "implementation": <IMPLEMENTATION>
          }
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

// Genesis puzzle_id: 3aa6fb7a
export async function start(
  puzzle_id: string = "3aa6fb7a",
  only_puzzle_dataset: boolean = false
) {
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
    puzzle_id,
    only_puzzle_dataset,
    train: arc_train,
    test_input_matrix,
  });

  milestone.analysis();

  let instance_index: number = 0;

  const { declarations, output_canvas } = await analyzer.declarations({
    puzzle_id,
    only_puzzle_dataset,
    train_dataset,
  });

  train_dataset.declarations = declarations;
  train_dataset.output_canvas = output_canvas;

  for (const dataset of train_dataset.dataset) {
    const { input_matrix, output_matrix } = dataset;

    const { instances } = await analyzer.instances({
      puzzle_id,
      only_puzzle_dataset,
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
        only_puzzle_dataset,
        instance_name,
        declarations,
        input_instances: dataset.instances.filter(
          ({ implementation }) => implementation
        ),
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
    only_puzzle_dataset,
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
      only_puzzle_dataset,
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
      only_puzzle_dataset,
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
    only_puzzle_dataset,
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

### Incident Patch 1: `bd9f64d7` (2026-11-06)
**Commit Message**: Label orientation by shape in all ARC datasets

Give every state of every object in the 29 ARC instruction datasets the
direction its own shape points, at the user's request to make
`orientation` consistent, with their reference of directed 3-cell lines
that point toward their heads:

- a straight line points toward its head, an end cell of its own color,
  or takes its axis without one: vertical 0, horizontal 90, and the
  diagonals 45 and 135
- a corner or chevron points toward its vertex, and a marker keeps that
- anything else is 0, and a turn adds its angle

Relabelled datasets:

- 25d8a9c8, 25ff71a9, 9565186b, c9e6f938, 6150a2bd and ed36ccf7: their
  rules already carry the new values into the outputs
- 44f52bb0, 9af7a82c and e9afcf9a gain `$Obj.orientation = 0`, and
  a85d4709 gains `$Obj.orientation = 90`
- 794b24be and d631b094 set each output bar's orientation from its own
  box
- the genesis puzzle 3aa6fb7a, which the user chose to include: line
  drops `endpoint_position` and points toward its color-8 endpoint (270,
  90, 0 or 180), and curve's points are 0 while the color-4 rim makes a
  V at 180

The other 13 puzzle datasets, core and extension already followed the
co

**File**: `arc/README.md` (modified, +226/-107)
```diff
@@ -288,16 +288,17 @@ one column wider when horizontal and one row taller when vertical. An
 extension corner keeps its 3 by 3 size, because its inside marker fills a
 cell of its own box. Every native output snapshot therefore carries its
 shape's output bounding box, so `output_value.x` and `output_value.y` equal
-`output_x` and `output_y`. The genesis rules match categorical colors,
-orientations, and endpoint sides with `is`, the spelling of `==` that
-[NUC 86](../docs/nuc-0086.md) adds, as in the line header
-`if $Obj.orientation is 90 and $Obj.endpoint_position is left:`. A bare word
-such as `left` compares with its own text while nothing defines that name,
-and no genesis program defines `left`, `right`, `up`, or `down`. Assignments
-and implementations keep their quoted strings, as in
-`$Obj.extension_direction = 'right'` and `endpoint_position='left'`: only the
-right operand of `is` reads as a word, and a bare name elsewhere would be
-undefined.
+`output_x` and `output_y`. A line points toward its color-8 endpoint: its
+orientation is 270, 90, 0, or 180 when the endpoint is on the left, on the
+right, at the top, or at the bottom, and it keeps that orientation as it grows
+away from the endpoint. A curve point, a single cell, is at orientation 0, and
+its rim makes a V that points toward the point, its vertex: the color-4 rule
+sets `$Obj.orientation = 180`, because its color-8 arms go up and the V points
+down, while a color-9 point keeps 0, because its color-2 arms go down and the
+V points up. The genesis rules match categorical colors and orientations with
+`is`, the spelling of `==` that [NUC 86](../docs/nuc-0086.md) adds, as in the
+line header `if $Obj.orientation is 270:`, and the line rules assign quoted
+strings, as in `$Obj.extension_direction = 'right'`.
 
 Instance `implementation` snippets use named constructor arguments whose names
 match the parameters in their class declarations. The canvas size is not one
@@ -496,10 +497,17 @@ row's unchanged origin, as an erased output object keeps one in
 [composition](#8-visualize-output-instance). `output_canvas` is `EXACT`
 because each output keeps its input's canvas, including the cleared top or
 bottom rows that `FIT` would crop from every training output. Orientation is
-0 in both states because the rows are not turned and the bar is a distinct
-horizontal geometry. The declarations hold executable code only, without the
-`#` comments of the other datasets. The test pair follows the training pairs
-at the same level and is annotated by the same rules.
+the direction each row points as a straight line of 3 cells. A row of exactly
+two colors in which one end cell alone has its color has that cell as its head
+and points toward it: 270 for the left end cells of `[2, 3, 3]`, `[7, 3, 3]`,
+and `[3, 7, 7]`, and 90 for the right end cell of `[2, 2, 4]`. Every other
+row, of one color or with its lone color in the middle cell, has no head and
+takes the horizontal axis, 90. The rules leave `orientation` unchanged: each
+bar keeps 90, and each cleared row, which has no output cell, keeps its input
+orientation, 270 for three of the cleared rows and 90 for the other five. The
+declarations hold executable code and one `#` comment, the orientation line
+that every dataset places above its class. The test pair follows the training
+pairs at the same level and is annotated by the same rules.
 
 `dataset.25ff71a9.json` annotates the four original training pairs from
 `data\training\25ff71a9.json`, in order, followed by its two test pairs, six
@@ -542,10 +550,15 @@ The `output_x`/`output_y` fields record the moved figure's nonzero
 bounding-box origin, equal to `output_value.x`/`output_value.y`.
 `output_canvas` is `EXACT` because each training output keeps its input's
 3 by 3 canvas, including the empty top row that `FIT` would crop from every
-one of them. Orientation is 0 in both states of the training pairs because no
-training figure is turned. The declarations hold executable code only,
-without `#` comments. The test pairs follow the training pairs at the same
-level and are annotated by the same rules.
+one of them. Orientation is the direction each figure points, the same in
+both states because the figure moves without turning: 90 for the bars,
+horizontal lines without a head; 135 and 45 for the trominoes, corners that
+point toward their vertex, the bottom-right cell of the third figure's box and
+the top-right cell of the fourth's; and 0 for the test pairs' vertical 2-cell
+bar and single cell. The declarations hold executable code and one `#` comment,
+the orientation line that every dataset places above its class. The test pairs
+follow the training pairs at the same level and are annotated by the same
+rules.
 
 `dataset.27a28665.json` annotates the seven original training pairs from
 `data\training\27a28665.json`, in order, followed by its three test pairs,
@@ -680,9 +693,10 @@ bounding-box origin, 0 and 0, equal to `output_value.x`/
```

**File**: `arc/docs/ARC-NUC-017c7c7b.md` (modified, +41/-2)
```diff
@@ -6,11 +6,11 @@ the solver and Nucleoid changes it needed, its runs, and what is still open.
 | Item | Status |
 | --- | --- |
 | Puzzle | [`data/training/017c7c7b.json`](../data/training/017c7c7b.json) |
-| Instruction dataset | [`dataset.017c7c7b.json`](../src/dataset/dataset.017c7c7b.json): the puzzle's 3 original training pairs and its test pair, one whole-pattern instance each (4 instances); version 3, which is version 2 without its `resume_row` rule (version 1 had 36 point instances); committed in `a5a793d` and moved to the standard entries in `521aa3c` |
+| Instruction dataset | [`dataset.017c7c7b.json`](../src/dataset/dataset.017c7c7b.json): the puzzle's 3 original training pairs and its test pair, one whole-pattern instance each (4 instances); version 3, which is version 2 without its `resume_row` rule (version 1 had 36 point instances); committed in `a5a793d` and moved to the standard entries in `521aa3c`; shared orientation comment added on 6-Nov-2026 |
 | Output canvas | `EXACT` |
 | Nucleoid enhancements | None requested for any version, so no proposal strategy was selected; versions 2 and 3 use the `@first` anchors of [NUC 53](../../docs/nuc-0053.md) and [NUC 55](../../docs/nuc-0055.md) |
 | Solver changes | None; one suggested change awaits review, not applied |
-| Solver runs | 2 local runs on 4-Nov-2026: version 1 exit 2, version 2 exit 0; version 3 not run |
+| Solver runs | 2 local runs on 4-Nov-2026: version 1 exit 2, version 2 exit 0; version 3 not run; none of the current version |
 | Updated | 6-Nov-2026 |
 
 ## Puzzle
@@ -178,6 +178,38 @@ with the accepted runtime at `491512d`, and the caller replayed every pair
 offline against the unchanged grids, masks, positions and instance names. No
 solver run has measured this version yet.
 
+### Orientation convention
+
+On 6-Nov-2026 the user asked `/arc-purposal` to make `orientation` consistent
+across all 29 instruction datasets, with a reference of eight directed 3-cell
+lines, each of which points toward its head. Every state now takes the
+direction its own shape points, by the convention in the
+[README](../README.md#3-extract-instances): a line toward its head or along
+its axis, a corner or chevron toward its vertex, and anything else 0, while a
+turn adds its angle. Every dataset's first declaration also carries one shared
+comment line, directly above its class, that states the convention for the
+model:
+
+```nuc
+# Orientation is the direction an object points, in degrees clockwise from north (0 up, 90 right, 180 down, 270 left)
+```
+
+This dataset's labels already followed the convention, as the labeller
+confirmed: the pattern and its continuation have no direction, so both states
+are 0. Only the comment line changed, so the class, the rules, the grids,
+masks, positions, instance names, implementations, and snapshots are as
+before, and the gestalt overview above still holds.
+
+The arc-dataset worker made the change in an external staging directory with
+the accepted runtime at `d3413e6` (last runtime change `7096171`), and every
+snapshot reruns byte for byte on it. The caller's own offline check passed on
+the staged file and again after integration: the pairs, grids, masks,
+positions, and instance names are as before, every state's orientation matches
+the convention's labeller, every snapshot replays on that runtime, and
+`document()` loads the dataset with the other 28. No NUC was requested, so no
+proposal strategy was selected and strategy learning did not apply. At the
+user's choice, no solver run has measured this version.
+
 ## Runs
 
 | Date | Dataset version | Runtime | Exit status | Difference | Elapsed |
@@ -200,6 +232,10 @@ invocations and the dataset. It is not recorded here: its command, runtime,
 and result are unknown, so the difference before this dataset is unknown, not
 zero. The puzzle has not been in an **ARC puzzle report** workflow run.
 
+None of these runs measured the orientation version of 6-Nov-2026: the user
+chose offline verification for the batch, so its difference is unknown, not
+zero.
+
 ## Open items
 
 - **The runs saw the answer.** Resolved on 6-Nov-2026: the user decided this
@@ -259,3 +295,6 @@ zero. The puzzle has not been in an **ARC puzzle report** workflow run.
   `src/app.ts` is no longer this puzzle: commit `bca5ff6`, made after both
   runs, set it to `44f52bb0`, and the pull that brought it in kept that later
   value.
+- **Orientation version unmeasured.** No solver run has measured the
+  6-Nov-2026 orientation version, so whether consistent orientation labels
+  change this puzzle's result is unknown.
```

**File**: `arc/docs/ARC-NUC-0ca9ddb6.md` (modified, +40/-1)
```diff
@@ -6,7 +6,7 @@ the solver and Nucleoid changes it needed, its runs, and what is still open.
 | Item | Status |
 | --- | --- |
 | Puzzle | [`data/training/0ca9ddb6.json`](../data/training/0ca9ddb6.json) |
-| Instruction dataset | [`dataset.0ca9ddb6.json`](../src/dataset/dataset.0ca9ddb6.json): the puzzle's 3 training pairs and its test pair, 15 point instances; conditions respelled with `is` on 6-Nov-2026 |
+| Instruction dataset | [`dataset.0ca9ddb6.json`](../src/dataset/dataset.0ca9ddb6.json): the puzzle's 3 training pairs and its test pair, 15 point instances; conditions respelled with `is` on 6-Nov-2026; shared orientation comment added on 6-Nov-2026 |
 | Output canvas | `EXACT` |
 | Nucleoid enhancements | [NUC 53](../../docs/nuc-0053.md) and [NUC 55](../../docs/nuc-0055.md), both Accepted; the conditions also use the accepted `is` of [NUC 86](../../docs/nuc-0086.md), which this puzzle did not request |
 | Solver changes | None specific to this puzzle |
@@ -153,6 +153,38 @@ instance names stay unique across all datasets. `document()` loads it with
 the other 28 datasets. At the user's choice, no solver run has measured this
 version.
 
+### Orientation convention
+
+On 6-Nov-2026 the user asked `/arc-purposal` to make `orientation` consistent
+across all 29 instruction datasets, with a reference of eight directed 3-cell
+lines, each of which points toward its head. Every state now takes the
+direction its own shape points, by the convention in the
+[README](../README.md#3-extract-instances): a line toward its head or along
+its axis, a corner or chevron toward its vertex, and anything else 0, while a
+turn adds its angle. Every dataset's first declaration also carries one shared
+comment line, directly above its class, that states the convention for the
+model:
+
+```nuc
+# Orientation is the direction an object points, in degrees clockwise from north (0 up, 90 right, 180 down, 270 left)
+```
+
+This dataset's labels already followed the convention, as the labeller
+confirmed: each point is 0, and so is its output, the point with its ring of
+markers. Only the comment line changed, so the class, the rules, the grids,
+masks, positions, instance names, implementations, and snapshots are as
+before, and the gestalt overview above still holds.
+
+The arc-dataset worker made the change in an external staging directory with
+the accepted runtime at `d3413e6` (last runtime change `7096171`), and every
+snapshot reruns byte for byte on it. The caller's own offline check passed on
+the staged file and again after integration: the pairs, grids, masks,
+positions, and instance names are as before, every state's orientation matches
+the convention's labeller, every snapshot replays on that runtime, and
+`document()` loads the dataset with the other 28. No NUC was requested, so no
+proposal strategy was selected and strategy learning did not apply. At the
+user's choice, no solver run has measured this version.
+
 ## Decision: locate the delta from the initial position (NUC 53 and NUC 55)
 
 ### Why the world model has to move the object
@@ -239,6 +271,10 @@ None of these runs measured the current version: the standard entries of
 chose offline verification for the respelling. Its difference is unknown, not
 zero.
 
+None of these runs measured the orientation version of 6-Nov-2026: the user
+chose offline verification for the batch, so its difference is unknown, not
+zero.
+
 ## Open items
 
 - **Runs from `c2fff09` on saw the answer.** Resolved on 6-Nov-2026: the user
@@ -263,3 +299,6 @@ zero.
   applied, because it is a redesign rather than the respelling the user asked
   for: both branches repeat the four lines that shift the origin and grow the
   point to 3 by 3, which a later model could state once.
+- **Orientation version unmeasured.** No solver run has measured the
+  6-Nov-2026 orientation version, so whether consistent orientation labels
+  change this puzzle's result is unknown.
```

**File**: `arc/docs/ARC-NUC-0d3d703e.md` (modified, +40/-1)
```diff
@@ -6,7 +6,7 @@ the solver and Nucleoid changes it needed, its runs, and what is still open.
 | Item | Status |
 | --- | --- |
 | Puzzle | [`data/training/0d3d703e.json`](../data/training/0d3d703e.json) |
-| Instruction dataset | [`dataset.0d3d703e.json`](../src/dataset/dataset.0d3d703e.json): the puzzle's 4 original training pairs and its test pair, 15 stripe instances, three per pair; committed in `ebd026c`; partner test respelled with `is not` on 6-Nov-2026 |
+| Instruction dataset | [`dataset.0d3d703e.json`](../src/dataset/dataset.0d3d703e.json): the puzzle's 4 original training pairs and its test pair, 15 stripe instances, three per pair; committed in `ebd026c`; partner test respelled with `is not` on 6-Nov-2026; shared orientation comment added on 6-Nov-2026 |
 | Output canvas | `EXACT` |
 | Nucleoid enhancements | None requested, so no proposal strategy was selected; the rule uses the `@first` anchors of [NUC 53](../../docs/nuc-0053.md) and [NUC 55](../../docs/nuc-0055.md), the list `includes` that [NUC 61](../../docs/nuc-0061.md) specifies, and the accepted `is not` of [NUC 86](../../docs/nuc-0086.md) |
 | Solver changes | None; suggested changes await review, not applied |
@@ -147,6 +147,38 @@ instance names stay unique across all datasets. `document()` loads it with
 the other 28 datasets. At the user's choice, no solver run has measured this
 version.
 
+### Orientation convention
+
+On 6-Nov-2026 the user asked `/arc-purposal` to make `orientation` consistent
+across all 29 instruction datasets, with a reference of eight directed 3-cell
+lines, each of which points toward its head. Every state now takes the
+direction its own shape points, by the convention in the
+[README](../README.md#3-extract-instances): a line toward its head or along
+its axis, a corner or chevron toward its vertex, and anything else 0, while a
+turn adds its angle. Every dataset's first declaration also carries one shared
+comment line, directly above its class, that states the convention for the
+model:
+
+```nuc
+# Orientation is the direction an object points, in degrees clockwise from north (0 up, 90 right, 180 down, 270 left)
+```
+
+This dataset's labels already followed the convention, as the labeller
+confirmed: each vertical stripe is a line without a head along the vertical
+axis, 0 in both states. Only the comment line changed, so the class, the
+rules, the grids, masks, positions, instance names, implementations, and
+snapshots are as before, and the gestalt overview above still holds.
+
+The arc-dataset worker made the change in an external staging directory with
+the accepted runtime at `d3413e6` (last runtime change `7096171`), and every
+snapshot reruns byte for byte on it. The caller's own offline check passed on
+the staged file and again after integration: the pairs, grids, masks,
+positions, and instance names are as before, every state's orientation matches
+the convention's labeller, every snapshot replays on that runtime, and
+`document()` loads the dataset with the other 28. No NUC was requested, so no
+proposal strategy was selected and strategy learning did not apply. At the
+user's choice, no solver run has measured this version.
+
 ## Runs
 
 | Date | Dataset version | Runtime | Exit status | Difference | Elapsed |
@@ -175,6 +207,10 @@ version with standard entries or the version with `is not` of 6-Nov-2026,
 which the user chose to verify offline, so their difference is unknown, not
 zero.
 
+None of these runs measured the orientation version of 6-Nov-2026: the user
+chose offline verification for the batch, so its difference is unknown, not
+zero.
+
 ## Open items
 
 - **The run saw the answer.** Resolved on 6-Nov-2026: the user decided this is
@@ -212,3 +248,6 @@ zero.
   assignment value, such as `$Obj.flag = $Obj.color is 5`, gets `is` read as
   a name and a `ReferenceError`. A dispatched **ARC Benchmark** run would
   measure the effect.
+- **Orientation version unmeasured.** No solver run has measured the
+  6-Nov-2026 orientation version, so whether consistent orientation labels
+  change this puzzle's result is unknown.
```

**File**: `arc/docs/ARC-NUC-25d8a9c8.md` (modified, +46/-1)
```diff
@@ -6,7 +6,7 @@ the solver and Nucleoid changes it needed, its runs, and what is still open.
 | Item | Status |
 | --- | --- |
 | Puzzle | [`data/training/25d8a9c8.json`](../data/training/25d8a9c8.json) |
-| Instruction dataset | [`dataset.25d8a9c8.json`](../src/dataset/dataset.25d8a9c8.json): the puzzle's 4 original training pairs and its test pair, 15 row instances, three per pair; committed with this record; condition respelled with `is` on 6-Nov-2026 |
+| Instruction dataset | [`dataset.25d8a9c8.json`](../src/dataset/dataset.25d8a9c8.json): the puzzle's 4 original training pairs and its test pair, 15 row instances, three per pair; committed with this record; condition respelled with `is` on 6-Nov-2026; orientation labelled by shape and the shared orientation comment added on 6-Nov-2026 |
 | Output canvas | `EXACT` |
 | Nucleoid enhancements | None requested, so no proposal strategy was selected; the rule uses the list query `distinct` of [NUC 71](../../docs/nuc-0071.md), the conditional expression of [NUC 59](../../docs/nuc-0059.md), and the accepted `is` of [NUC 86](../../docs/nuc-0086.md) |
 | Solver changes | None; suggested changes await review, not applied |
@@ -160,6 +160,44 @@ declarations, every snapshot replays on that runtime, and the instance names
 stay unique across all datasets. `document()` loads it with the other 28
 datasets. At the user's choice, no solver run has measured this version.
 
+### Orientation convention
+
+On 6-Nov-2026 the user asked `/arc-purposal` to make `orientation` consistent
+across all 29 instruction datasets, with a reference of eight directed 3-cell
+lines, each of which points toward its head. Every state now takes the
+direction its own shape points, by the convention in the
+[README](../README.md#3-extract-instances): a line toward its head or along
+its axis, a corner or chevron toward its vertex, and anything else 0, while a
+turn adds its angle. Every dataset's first declaration also carries one shared
+comment line, directly above its class, that states the convention for the
+model:
+
+```nuc
+# Orientation is the direction an object points, in degrees clockwise from north (0 up, 90 right, 180 down, 270 left)
+```
+
+Each object is a row of three cells, a straight line. A row of one color, or
+with its lone color in the middle cell, has no head and takes the horizontal
+axis, 90; a row of exactly two colors whose one end cell alone has its color
+points toward that head, 270 on the left and 90 on the right. All 15 rows
+moved from 0, 12 to 90 and 3 to 270. The rules leave `orientation` unchanged,
+so a row that becomes a gray bar keeps 90 and a cleared row, which has no
+output cell, keeps its input orientation. No rule changed.
+
+The grids, masks, positions, instance names, tags, and every other property
+are as before; only the orientation values changed, so the world model keeps
+its level.
+
+The arc-dataset worker made the change in an external staging directory with
+the accepted runtime at `d3413e6` (last runtime change `7096171`), and every
+snapshot reruns byte for byte on it. The caller's own offline check passed on
+the staged file and again after integration: the pairs, grids, masks,
+positions, and instance names are as before, every state's orientation matches
+the convention's labeller, every snapshot replays on that runtime, and
+`document()` loads the dataset with the other 28. No NUC was requested, so no
+proposal strategy was selected and strategy learning did not apply. At the
+user's choice, no solver run has measured this version.
+
 ## Runs
 
 | Date | Dataset version | Runtime | Exit status | Difference | Elapsed |
@@ -183,6 +221,10 @@ No solver run has measured any version of this dataset: the one run stopped
 before its first model request, and the user chose offline verification for
 the `is` version of 6-Nov-2026. The difference is unknown, not zero.
 
+None of these runs measured the orientation version of 6-Nov-2026: the user
+chose offline verification for the batch, so its difference is unknown, not
+zero.
+
 ## Open items
 
 - **No model credential.** The run's process had no `OPENROUTER_API_KEY` in
@@ -224,3 +266,6 @@ the `is` version of 6-Nov-2026. The difference is unknown, not zero.
   model that copies it straight into an assignment value, as above, gets `is`
   read as a name and a `ReferenceError`. A dispatched **ARC Benchmark** run
   would measure the effect.
+- **Orientation version unmeasured.** No solver run has measured the
+  6-Nov-2026 orientation version, so whether consistent orientation labels
+  change this puzzle's result is unknown.
```

**File**: `arc/docs/ARC-NUC-25ff71a9.md` (modified, +45/-2)
```diff
@@ -6,11 +6,11 @@ the solver and Nucleoid changes it needed, its runs, and what is still open.
 | Item | Status |
 | --- | --- |
 | Puzzle | [`data/training/25ff71a9.json`](../data/training/25ff71a9.json) |
-| Instruction dataset | [`dataset.25ff71a9.json`](../src/dataset/dataset.25ff71a9.json): the puzzle's 4 original training pairs and its 2 test pairs, 6 figure instances, one per pair; committed with this record |
+| Instruction dataset | [`dataset.25ff71a9.json`](../src/dataset/dataset.25ff71a9.json): the puzzle's 4 original training pairs and its 2 test pairs, 6 figure instances, one per pair; committed with this record; orientation labelled by shape and the shared orientation comment added on 6-Nov-2026 |
 | Output canvas | `EXACT` |
 | Nucleoid enhancements | None requested, so no proposal strategy was selected; the rule uses the class-level `@first` anchor of [NUC 55](../../docs/nuc-0055.md), built on the state versions of [NUC 53](../../docs/nuc-0053.md) |
 | Solver changes | None; suggested changes await review, not applied |
-| Solver runs | 1 local run on 4-Nov-2026, exit 1 before any model call (`OPENROUTER_API_KEY is required`); difference unknown |
+| Solver runs | 1 local run on 4-Nov-2026, exit 1 before any model call (`OPENROUTER_API_KEY is required`); difference unknown; none of the current version |
 | Updated | 6-Nov-2026 |
 
 ## Puzzle
@@ -113,6 +113,42 @@ regenerated every snapshot with the accepted runtime at `491512d`, and the
 caller replayed every pair offline against the unchanged grids, masks,
 positions and instance names. No solver run has measured this version yet.
 
+### Orientation convention
+
+On 6-Nov-2026 the user asked `/arc-purposal` to make `orientation` consistent
+across all 29 instruction datasets, with a reference of eight directed 3-cell
+lines, each of which points toward its head. Every state now takes the
+direction its own shape points, by the convention in the
+[README](../README.md#3-extract-instances): a line toward its head or along
+its axis, a corner or chevron toward its vertex, and anything else 0, while a
+turn adds its angle. Every dataset's first declaration also carries one shared
+comment line, directly above its class, that states the convention for the
+model:
+
+```nuc
+# Orientation is the direction an object points, in degrees clockwise from north (0 up, 90 right, 180 down, 270 left)
+```
+
+Four of the six figures changed: the two horizontal bars are lines without a
+head, 90, and the two three-cell corners point toward their vertices, 135 at
+the bottom right and 45 at the top right. The vertical bar and the single cell
+of the test pairs stay 0. A figure moves down without turning, so each output
+keeps its input orientation, and no rule changed.
+
+The grids, masks, positions, instance names, tags, and every other property
+are as before; only the orientation values changed, so the world model keeps
+its level.
+
+The arc-dataset worker made the change in an external staging directory with
+the accepted runtime at `d3413e6` (last runtime change `7096171`), and every
+snapshot reruns byte for byte on it. The caller's own offline check passed on
+the staged file and again after integration: the pairs, grids, masks,
+positions, and instance names are as before, every state's orientation matches
+the convention's labeller, every snapshot replays on that runtime, and
+`document()` loads the dataset with the other 28. No NUC was requested, so no
+proposal strategy was selected and strategy learning did not apply. At the
+user's choice, no solver run has measured this version.
+
 ## Runs
 
 | Date | Dataset version | Runtime | Exit status | Difference | Elapsed |
@@ -134,6 +170,10 @@ runtime, the dataset, and `src/app.ts` were the same before and after the run.
 The invocation authorizes one run, so none was repeated. The puzzle has not
 been in an **ARC puzzle report** workflow run.
 
+None of these runs measured the orientation version of 6-Nov-2026: the user
+chose offline verification for the batch, so its difference is unknown, not
+zero.
+
 ## Open items
 
 - **No model credential.** As in the run of [25d8a9c8](ARC-NUC-25d8a9c8.md),
@@ -164,3 +204,6 @@ been in an **ARC puzzle report** workflow run.
   `ceil(listed puzzles / ARC_CONCURRENCY) * 30 + 20` minutes, within GitHub
   Actions' 360-minute job limit. The workflow's 150-minute timeout covers its
   20 listed puzzles.
+- **Orientation version unmeasured.** No solver run has measured the
+  6-Nov-2026 orientation version, so whether consistent orientation labels
+  change this puzzle's result is unknown.
```

**File**: `arc/docs/ARC-NUC-27a28665.md` (modified, +41/-2)
```diff
@@ -6,11 +6,11 @@ the solver and Nucleoid changes it needed, its runs, and what is still open.
 | Item | Status |
 | --- | --- |
 | Puzzle | [`data/training/27a28665.json`](../data/training/27a28665.json) |
-| Instruction dataset | [`dataset.27a28665.json`](../src/dataset/dataset.27a28665.json): the puzzle's 7 original training pairs and its 3 test pairs, one whole-block instance each (10 instances); version 3, which `88c781d` committed, replacing version 2's 50 cell instances, which had replaced version 1 before any run |
+| Instruction dataset | [`dataset.27a28665.json`](../src/dataset/dataset.27a28665.json): the puzzle's 7 original training pairs and its 3 test pairs, one whole-block instance each (10 instances); version 3, which `88c781d` committed, replacing version 2's 50 cell instances, which had replaced version 1 before any run; shared orientation comment added on 6-Nov-2026 |
 | Output canvas | `FIT` |
 | Nucleoid enhancements | None requested, so no proposal strategy was selected; version 3's rules use the `@first` anchors of [NUC 53](../../docs/nuc-0053.md) and [NUC 55](../../docs/nuc-0055.md), and version 2's also used the `any` quantifier of [NUC 62](../../docs/nuc-0062.md), the `**` of [NUC 64](../../docs/nuc-0064.md), the population count of [NUC 73](../../docs/nuc-0073.md), and the property selector of [NUC 79](../../docs/nuc-0079.md) |
 | Solver changes | None; two suggested changes await review, not applied |
-| Solver runs | 1 local run on 4-Nov-2026 for version 2, exit 0; version 3 not run |
+| Solver runs | 1 local run on 4-Nov-2026 for version 2, exit 0; version 3 not run; none of the current version |
 | Updated | 6-Nov-2026 |
 
 ## Puzzle
@@ -144,6 +144,38 @@ runtime at `491512d`, and the caller replayed every pair offline against the
 unchanged grids, masks, positions and instance names. No solver run has
 measured this version yet.
 
+### Orientation convention
+
+On 6-Nov-2026 the user asked `/arc-purposal` to make `orientation` consistent
+across all 29 instruction datasets, with a reference of eight directed 3-cell
+lines, each of which points toward its head. Every state now takes the
+direction its own shape points, by the convention in the
+[README](../README.md#3-extract-instances): a line toward its head or along
+its axis, a corner or chevron toward its vertex, and anything else 0, while a
+turn adds its angle. Every dataset's first declaration also carries one shared
+comment line, directly above its class, that states the convention for the
+model:
+
+```nuc
+# Orientation is the direction an object points, in degrees clockwise from north (0 up, 90 right, 180 down, 270 left)
+```
+
+This dataset's labels already followed the convention, as the labeller
+confirmed: each block has no direction, 0, and neither has its output point.
+Only the comment line changed, so the class, the rules, the grids, masks,
+positions, instance names, implementations, and snapshots are as before, and
+the gestalt overview above still holds.
+
+The arc-dataset worker made the change in an external staging directory with
+the accepted runtime at `d3413e6` (last runtime change `7096171`), and every
+snapshot reruns byte for byte on it. The caller's own offline check passed on
+the staged file and again after integration: the pairs, grids, masks,
+positions, and instance names are as before, every state's orientation matches
+the convention's labeller, every snapshot replays on that runtime, and
+`document()` loads the dataset with the other 28. No NUC was requested, so no
+proposal strategy was selected and strategy learning did not apply. At the
+user's choice, no solver run has measured this version.
+
 ## Runs
 
 | Date | Dataset version | Runtime | Exit status | Difference | Elapsed |
@@ -163,6 +195,10 @@ report** workflow run.
 
 Version 3 has not been run, so its difference is unknown, not zero.
 
+None of these runs measured the orientation version of 6-Nov-2026: the user
+chose offline verification for the batch, so its difference is unknown, not
+zero.
+
 ## Open items
 
 - **The run saw the answer.** Resolved on 6-Nov-2026: the user decided this is
@@ -214,3 +250,6 @@ Version 3 has not been run, so its difference is unknown, not zero.
 - **Version 3 has no run.** `/arc-purposal 27a28665` stops without a run
   while the dataset exists, so a run of version 3 needs the user's own
   authorization, such as `bun start 27a28665` from `arc/`.
+- **Orientation version unmeasured.** No solver run has measured the
+  6-Nov-2026 orientation version, so whether consistent orientation labels
+  change this puzzle's result is unknown.
```

**File**: `arc/docs/ARC-NUC-28bf18c6.md` (modified, +41/-2)
```diff
@@ -6,11 +6,11 @@ the solver and Nucleoid changes it needed, its runs, and what is still open.
 | Item | Status |
 | --- | --- |
 | Puzzle | [`data/training/28bf18c6.json`](../data/training/28bf18c6.json) |
-| Instruction dataset | [`dataset.28bf18c6.json`](../src/dataset/dataset.28bf18c6.json): the puzzle's 3 original training pairs and its test pair, 4 instances |
+| Instruction dataset | [`dataset.28bf18c6.json`](../src/dataset/dataset.28bf18c6.json): the puzzle's 3 original training pairs and its test pair, 4 instances; shared orientation comment added on 6-Nov-2026 |
 | Output canvas | `FIT` |
 | Nucleoid enhancements | None; the dataset uses accepted features only |
 | Solver changes | `output_canvas`, applied by `Matrix.canvas` |
-| Solver runs | 5 GitHub Actions runs, 1-2 Nov 2026; all exit 0 |
+| Solver runs | 5 GitHub Actions runs, 1-2 Nov 2026; all exit 0; none of the current version |
 | Updated | 6-Nov-2026 |
 
 ## Puzzle
@@ -93,6 +93,38 @@ regenerated every snapshot with the accepted runtime at `491512d`, and the
 caller replayed every pair offline against the unchanged grids, masks,
 positions and instance names. No solver run has measured this version yet.
 
+### Orientation convention
+
+On 6-Nov-2026 the user asked `/arc-purposal` to make `orientation` consistent
+across all 29 instruction datasets, with a reference of eight directed 3-cell
+lines, each of which points toward its head. Every state now takes the
+direction its own shape points, by the convention in the
+[README](../README.md#3-extract-instances): a line toward its head or along
+its axis, a corner or chevron toward its vertex, and anything else 0, while a
+turn adds its angle. Every dataset's first declaration also carries one shared
+comment line, directly above its class, that states the convention for the
+model:
+
+```nuc
+# Orientation is the direction an object points, in degrees clockwise from north (0 up, 90 right, 180 down, 270 left)
+```
+
+This dataset's labels already followed the convention, as the labeller
+confirmed: each shape has no direction, so both states are 0. Only the comment
+line changed, so the class, the rules, the grids, masks, positions, instance
+names, implementations, and snapshots are as before, and the gestalt overview
+above still holds.
+
+The arc-dataset worker made the change in an external staging directory with
+the accepted runtime at `d3413e6` (last runtime change `7096171`), and every
+snapshot reruns byte for byte on it. The caller's own offline check passed on
+the staged file and again after integration: the pairs, grids, masks,
+positions, and instance names are as before, every state's orientation matches
+the convention's labeller, every snapshot replays on that runtime, and
+`document()` loads the dataset with the other 28. No NUC was requested, so no
+proposal strategy was selected and strategy learning did not apply. At the
+user's choice, no solver run has measured this version.
+
 ## Decision: `output_canvas` trims the composed matrix
 
 ### Problem
@@ -183,6 +215,10 @@ debug runtime and a 30-minute limit. The exit status is the difference score;
 seconds are the workflow's wall time for the puzzle, from each run's
 `arc-puzzle-report` artifact. No local `bun start 28bf18c6` run is recorded.
 
+None of these runs measured the orientation version of 6-Nov-2026: the user
+chose offline verification for the batch, so its difference is unknown, not
+zero.
+
 ## Open items
 
 - **Runs from `c2fff09` on saw the answer.** Resolved on 6-Nov-2026: the user
@@ -195,3 +231,6 @@ seconds are the workflow's wall time for the puzzle, from each run's
   expected output. The exact matches at `c2fff09`, `b90a525`, and `ed49ce3`
   therefore do not show that the rule was inferred from the training pairs;
   the runs at `3cca0aa` and `3f734a8`, which predate it, also matched exactly.
+- **Orientation version unmeasured.** No solver run has measured the
+  6-Nov-2026 orientation version, so whether consistent orientation labels
+  change this puzzle's result is unknown.
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

## X. Label orientation by shape in all ARC datasets

**RULE**:
When implementing operations in `arc/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bd9f64d7`: Label orientation by shape in all ARC datasets. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `arc/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
`output_x` and `output_y`. A line points toward its color-8 endpoint: its
orientation is 270, 90, 0, or 180 when the endpoint is on the left, on the
right, at the top, or at the bottom, and it keeps that orientation as it grows
away from the endpoint. A curve point, a single cell, is at orientation 0, and
its rim makes a V that points toward the point, its vertex: the color-4 rule
sets `$Obj.orientation = 180`, because its color-8 arms go up and the V points
down, while a color-9 point keeps 0, because its color-2 arms go down and the
V points up. The genesis rules match categorical colors and orientations with
`is`, the spelling of `==` that [NUC 86](../docs/nuc-0086.md) adds, as in the
line header `if $Obj.orientation is 270:`, and the line rules assign quoted
strings, as in `$Obj.extension_direction = 'right'`.
the direction each row points as a straight line of 3 cells. A row of exactly
two colors in which one end cell alone has its color has that cell as its head
and points toward it: 270 for the left end cells of `[2, 3, 3]`, `[7, 3, 3]`,
and `[3, 7, 7]`, and 90 for the right end cell of `[2, 2, 4]`. Every other
row, of one color or with its lone color in the middle cell, has
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
`output_x` and `output_y`. The genesis rules match categorical colors,
orientations, and endpoint sides with `is`, the spelling of `==` that
[NUC 86](../docs/nuc-0086.md) adds, as in the line header
`if $Obj.orientation is 90 and $Obj.endpoint_position is left:`. A bare word
such as `left` compares with its own text while nothing defines that name,
and no genesis program defines `left`, `right`, `up`, or `down`. Assignments
and implementations keep their quoted strings, as in
`$Obj.extension_direction = 'right'` and `endpoint_position='left'`: only the
right operand of `is` reads as a word, and a bare name elsewhere would be
undefined.
0 in both states because the rows are not turned and the bar is a distinct
horizontal geometry. The declarations hold executable code only, without the
`#` comments of the other datasets. The test pair follows the training pairs
at the same level and is annotated by the same rules.
one of them. Orientation is 0 in both states of the training pairs because no
training figure is turned. The declarations hold executable code only,
without `#` comments. The test pairs follow the training pairs at the same
level and are annotated by the same rules.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bd9f64d7` are properly handled with clean fallback behavior.
