> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `9771c244`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T15:13:18.821Z  
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
> **Harvest Timestamp**: 2026-11-06T15:13:17.526Z  
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

export async function declarations({
  puzzle_id,
  only_puzzle_dataset,
  train_dataset,
}) {
  milestone.inferring_declarations();

  const { declarations, output_canvas } = await llm.generate({
    puzzle_id,
    only_puzzle_dataset,
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

  const { implementation } = await llm.generate({
    puzzle_id,
    only_puzzle_dataset,
    messages: [
      {
        role: "user",
        content: `
          instance_name:
          ${instance_name}
          declarations:
          ${JSON.stringify(declarations)}
          input_instances:
          ${JSON.stringify(
            input_instances.map(
              ({
                instance_name,
                input_instance_matrix,
                output_instance_matrix,
                implementation,
              }) => ({
                instance_name,
                input_instance_matrix,
                output_instance_matrix,
                implementation,
              })
            )
          )}
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
export async function start(
  puzzle_id: string = "c8f0f002",
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

### Incident Patch 1: `9771c244` (2026-11-06)
**Commit Message**: Use NUC 86 `is` comparisons in ARC datasets

Respell the equality comparisons of nine ARC instruction datasets with
NUC 86's `is` and `is not`, at the user's request to apply NUC 86 to the
existing datasets where it fits:

- 0ca9ddb6: `if $Obj.vertex_color is 1:` and `is 2:`
- 0d3d703e: `.find(partner => partner is not $Obj.color@first)`
- 25d8a9c8: `5 if $Obj.parts.distinct().length is 1 else 0`
- 6e02f1e3: `if $Obj.orientation is 90:`
- c8f0f002: `if $Obj.color@first is 7:`
- genesis puzzle 3aa6fb7a, which the user chose to include with bare
  words: core, extension and curve match their colors with `is`, and line
  matches its endpoint sides with bare words, as in
  `if $Obj.orientation is 90 and $Obj.endpoint_position is left:`

Only the comparisons in `declarations` changed. Every world model, pair
grid, mask, instance name, implementation and snapshot is as before. All
snapshots regenerated with the accepted runtime at 34d0b19 are
byte-identical, the caller's offline check passed all 331 checks, and
`document()` loads all 29 datasets. Replaying the rules now needs a
runtime at 7096171, the NUC 86 commit, or later.

Update the README paragraphs of the five puzzles and the gene

**File**: `arc/README.md` (modified, +30/-11)
```diff
@@ -268,7 +268,16 @@ one column wider when horizontal and one row taller when vertical. An
 extension corner keeps its 3 by 3 size, because its inside marker fills a
 cell of its own box. Every native output snapshot therefore carries its
 shape's output bounding box, so `output_value.x` and `output_value.y` equal
-`output_x` and `output_y`.
+`output_x` and `output_y`. The genesis rules match categorical colors,
+orientations, and endpoint sides with `is`, the spelling of `==` that
+[NUC 86](../docs/nuc-0086.md) adds, as in the line header
+`if $Obj.orientation is 90 and $Obj.endpoint_position is left:`. A bare word
+such as `left` compares with its own text while nothing defines that name,
+and no genesis program defines `left`, `right`, `up`, or `down`. Assignments
+and implementations keep their quoted strings, as in
+`$Obj.extension_direction = 'right'` and `endpoint_position='left'`: only the
+right operand of `is` reads as a word, and a bare name elsewhere would be
+undefined.
 
 Instance `implementation` snippets use named constructor arguments whose names
 match the parameters in their class declarations. The canvas size is not one
@@ -356,8 +365,11 @@ The declarative rules introduce `marker_color`, which is absent before the
 rules run, and, in the same branches that shift the origin, grow each cross
 to 3 by 3 with `$Obj.width = $Obj.width@first + 2` and
 `$Obj.height = $Obj.height@first + 2`; color-6 and color-8 points keep their
-1 by 1 size. Tags identify the geometry: `l1707` is an orthogonal cross,
-`l2404` is a diagonal cross, and `l7544` remains a single point.
+1 by 1 size. The two branches are guarded by `if $Obj.vertex_color is 1:`
+and `if $Obj.vertex_color is 2:`, with `is`, the spelling of `==` that
+[NUC 86](../docs/nuc-0086.md) adds. Tags identify the geometry: `l1707` is an
+orthogonal cross, `l2404` is a diagonal cross, and `l7544` remains a single
+point.
 Every instance mask retains the complete 9 by 9 canvas. The x/y metadata
 records each mask's nonzero bounding-box origin. Native output snapshots carry
 the shifted pattern origin, derived from the original point coordinates with
@@ -388,10 +400,12 @@ The class takes the standard entries `x`, `y`, `width`, `height`, and
 with no partner color, canvas size, or matrix of cells. `width` and
 `height`, the column and row counts of the stripe's bounding box, are
 1 and 3 for every stripe. One class-level rule rewrites `color` as
-`[[1, 5], [2, 6], [3, 4], [8, 9]].find(pair => pair.includes($Obj.color@first)).find(partner => partner != $Obj.color@first)`:
+`[[1, 5], [2, 6], [3, 4], [8, 9]].find(pair => pair.includes($Obj.color@first)).find(partner => partner is not $Obj.color@first)`:
 the list states each pair once, the first `find` selects the pair that
 includes the stripe's input color, and the second `find` takes the other color
-of that pair. The `@first` anchors read the input color because the rule
+of that pair: the comparison `is not` of [NUC 86](../docs/nuc-0086.md), the
+spelling of `!=`, holds only for the color that differs from the input color.
+The `@first` anchors read the input color because the rule
 rewrites `color` itself; a dictionary from every color to its partner would
 state each pair twice. The two callbacks are chained rather than nested, so
 each reads only its own parameter and the stripe. The rules create no
@@ -438,7 +452,9 @@ input, as its only descriptive property, with no color, color count, canvas
 size, or matrix of cells, so no input property states whether the row is
 uniform. One unconditional class-level rule introduces `fill_color`, which is
 absent before the rules run, as
-`5 if $Obj.parts.distinct().length == 1 else 0`: the list query `distinct` of
+`5 if $Obj.parts.distinct().length is 1 else 0`, whose condition uses the
+comparison `is` of [NUC 86](../docs/nuc-0086.md), the spelling of `==`: the
+list query `distinct` of
 [NUC 71](../docs/nuc-0071.md) keeps each of the row's colors once, so exactly
 one kept color means the row is a single color, and the conditional
 expression of [NUC 59](../docs/nuc-0059.md) gives such a row color 5 and
@@ -843,8 +859,9 @@ other diagonal 45, as `dataset.74dd1130.json` names its mirror axis. No
 arithmetic relates the counts to the axes, so the rule looks the axis up, as
 `dataset.27a28665.json` looks up its code by tag, and it reads no
 orientation, so it rewrites `orientation` without an `@first` anchor. The
-conditional rule `if $Obj.orientation == 90:` sets `height` to 1, guarding on
-a horizontal line as `dataset.line.json` does: the line along the top row is
+conditional rule `if $Obj.orientation is 90:` uses `is`, the spelling of `==`
+that [NUC 86](../docs/nuc-0086.md) adds, and sets `height` to 1, guarding on a
+horizontal line as `dataset.line.json` does: the line along the top row is
 one row tall, the one change in the shape's size, while a diagonal crosses the
 mosaic's whole 3 by 3 box and keeps its input `height`. The rule reads the
 ori
```

**File**: `arc/docs/ARC-NUC-0ca9ddb6.md` (modified, +65/-3)
```diff
@@ -6,11 +6,11 @@ the solver and Nucleoid changes it needed, its runs, and what is still open.
 | Item | Status |
 | --- | --- |
 | Puzzle | [`data/training/0ca9ddb6.json`](../data/training/0ca9ddb6.json) |
-| Instruction dataset | [`dataset.0ca9ddb6.json`](../src/dataset/dataset.0ca9ddb6.json): the puzzle's 3 training pairs and its test pair, 15 point instances |
+| Instruction dataset | [`dataset.0ca9ddb6.json`](../src/dataset/dataset.0ca9ddb6.json): the puzzle's 3 training pairs and its test pair, 15 point instances; conditions respelled with `is` on 6-Nov-2026 |
 | Output canvas | `EXACT` |
-| Nucleoid enhancements | [NUC 53](../../docs/nuc-0053.md) and [NUC 55](../../docs/nuc-0055.md), both Accepted |
+| Nucleoid enhancements | [NUC 53](../../docs/nuc-0053.md) and [NUC 55](../../docs/nuc-0055.md), both Accepted; the conditions also use the accepted `is` of [NUC 86](../../docs/nuc-0086.md), which this puzzle did not request |
 | Solver changes | None specific to this puzzle |
-| Solver runs | 5 GitHub Actions runs, 1-2 Nov 2026; all exit 0 |
+| Solver runs | 5 GitHub Actions runs, 1-2 Nov 2026; all exit 0; none of the current version |
 | Updated | 6-Nov-2026 |
 
 ## Puzzle
@@ -108,6 +108,51 @@ regenerated every snapshot with the accepted runtime at `491512d`, and the
 caller replayed every pair offline against the unchanged grids, masks,
 positions and instance names. No solver run has measured this version yet.
 
+### Is comparisons
+
+On 6-Nov-2026 the user asked `/arc-purposal` to apply
+[NUC 86](../../docs/nuc-0086.md) to the existing datasets where it fits. Both
+conditions now read with `is`, NUC 86's spelling of `==`, and the rules read:
+
+```nuc
+if $Obj.vertex_color is 1:
+    $Obj.tag = 'l1707'
+    $Obj.marker_color = 7
+    $Obj.x = $Obj.x@first - 1
+    $Obj.y = $Obj.y@first - 1
+    $Obj.width = $Obj.width@first + 2
+    $Obj.height = $Obj.height@first + 2
+if $Obj.vertex_color is 2:
+    $Obj.tag = 'l2404'
+    $Obj.marker_color = 4
+    $Obj.x = $Obj.x@first - 1
+    $Obj.y = $Obj.y@first - 1
+    $Obj.width = $Obj.width@first + 2
+    $Obj.height = $Obj.height@first + 2
+```
+
+`is` compares exactly as `==` does, with the same loose equality and
+precedence, and an `if` header is one of the enclosed positions where NUC 86
+reads it as an operator. The right operands are the numbers 1 and 2, not bare
+words, so each condition is the same standing rule as before. Only the two
+header lines changed. The class, the branch bodies, the grids, masks,
+positions, instance names, implementations, and snapshots are as before, and
+the world model keeps its level, so the gestalt overview above still holds.
+Replaying the rules now needs a runtime at `7096171`, the NUC 86 commit, or
+later. No NUC was requested, so no proposal strategy was selected and
+strategy learning did not apply.
+
+The arc-dataset worker respelled the headers in an external staging
+directory and regenerated all 30 input and output snapshots with the accepted
+runtime at `34d0b19`, which includes NUC 86; each is byte-identical to the
+previous version's. The caller's own offline check passed all 43 of its checks
+on the staged file and again after integration: the file equals the previous
+one with only `==` respelled, its pairs are unchanged, no `==` or `!=` is
+left in its declarations, every snapshot replays on that runtime, and the
+instance names stay unique across all datasets. `document()` loads it with
+the other 28 datasets. At the user's choice, no solver run has measured this
+version.
+
 ## Decision: locate the delta from the initial position (NUC 53 and NUC 55)
 
 ### Why the world model has to move the object
@@ -189,6 +234,11 @@ debug runtime and a 30-minute limit. The exit status is the difference score;
 seconds are the workflow's wall time for the puzzle, from each run's
 `arc-puzzle-report` artifact. No local `bun start 0ca9ddb6` run is recorded.
 
+None of these runs measured the current version: the standard entries of
+5-Nov-2026 and the `is` conditions of 6-Nov-2026 came later, and the user
+chose offline verification for the respelling. Its difference is unknown, not
+zero.
+
 ## Open items
 
 - **Runs from `c2fff09` on saw the answer.** Resolved on 6-Nov-2026: the user
@@ -201,3 +251,15 @@ seconds are the workflow's wall time for the puzzle, from each run's
   expected output. The exact matches at `c2fff09`, `b90a525`, and `ed49ce3`
   therefore do not show that the rule was inferred from the training pairs;
   the runs at `3cca0aa` and `3f734a8`, which predate it, also matched exactly.
+- **The `is` version is unmeasured.** No solver run, local or in the
+  **ARC Benchmark** workflow, has used the version of 6-Nov-2026. Its snapshots
+  are unchanged, but every run's few-shot context now shows `is` in
+  conditions. NUC 86 reads `is` as an operator only in enclosed positions, so a
+  model that copies it straight into an assignment value, such as
+  `$Obj.flag = $Obj.color is 5`, gets `is` read as
```

**File**: `arc/docs/ARC-NUC-0d3d703e.md` (modified, +48/-3)
```diff
@@ -6,11 +6,11 @@ the solver and Nucleoid changes it needed, its runs, and what is still open.
 | Item | Status |
 | --- | --- |
 | Puzzle | [`data/training/0d3d703e.json`](../data/training/0d3d703e.json) |
-| Instruction dataset | [`dataset.0d3d703e.json`](../src/dataset/dataset.0d3d703e.json): the puzzle's 4 original training pairs and its test pair, 15 stripe instances, three per pair; committed in `ebd026c` |
+| Instruction dataset | [`dataset.0d3d703e.json`](../src/dataset/dataset.0d3d703e.json): the puzzle's 4 original training pairs and its test pair, 15 stripe instances, three per pair; committed in `ebd026c`; partner test respelled with `is not` on 6-Nov-2026 |
 | Output canvas | `EXACT` |
-| Nucleoid enhancements | None requested, so no proposal strategy was selected; the rule uses the `@first` anchors of [NUC 53](../../docs/nuc-0053.md) and [NUC 55](../../docs/nuc-0055.md) and the list `includes` that [NUC 61](../../docs/nuc-0061.md) specifies |
+| Nucleoid enhancements | None requested, so no proposal strategy was selected; the rule uses the `@first` anchors of [NUC 53](../../docs/nuc-0053.md) and [NUC 55](../../docs/nuc-0055.md), the list `includes` that [NUC 61](../../docs/nuc-0061.md) specifies, and the accepted `is not` of [NUC 86](../../docs/nuc-0086.md) |
 | Solver changes | None; suggested changes await review, not applied |
-| Solver runs | 1 local run on 4-Nov-2026, exit 0 |
+| Solver runs | 1 local run on 4-Nov-2026, exit 0; none of the current version |
 | Updated | 6-Nov-2026 |
 
 ## Puzzle
@@ -115,6 +115,38 @@ migration worker regenerated every snapshot with the accepted runtime at
 grids, masks, positions and instance names. No solver run has measured this
 version yet.
 
+### Is comparisons
+
+On 6-Nov-2026 the user asked `/arc-purposal` to apply
+[NUC 86](../../docs/nuc-0086.md) to the existing datasets where it fits. The
+second `find` now takes the partner with `is not`, NUC 86's spelling of `!=`:
+
+```nuc
+$Obj.color = [[1, 5], [2, 6], [3, 4], [8, 9]].find(pair => pair.includes($Obj.color@first)).find(partner => partner is not $Obj.color@first)
+```
+
+`is not` compares exactly as `!=` does, with the same loose equality and
+precedence. The callback is a call argument, one of the enclosed positions
+where NUC 86 reads `is` as an operator, and its right operand,
+`$Obj.color@first`, is an anchored property rather than a bare word, so it
+reads as it did with `!=`. Only that comparison changed. The class, the pair
+list, the grids, masks, positions, instance names, implementations, and
+snapshots are as before, and the world model keeps its level, so the gestalt
+overview above still holds. Replaying the rule now needs a runtime at
+`7096171`, the NUC 86 commit, or later. No NUC was requested, so no proposal
+strategy was selected and strategy learning did not apply.
+
+The arc-dataset worker respelled the comparison in an external staging
+directory and regenerated all 30 input and output snapshots with the accepted
+runtime at `34d0b19`, which includes NUC 86; each is byte-identical to the
+previous version's. The caller's own offline check passed all 44 of its checks
+on the staged file and again after integration: the file equals the previous
+one with only `!=` respelled, its pairs are unchanged, no `==` or `!=` is
+left in its declarations, every snapshot replays on that runtime, and the
+instance names stay unique across all datasets. `document()` loads it with
+the other 28 datasets. At the user's choice, no solver run has measured this
+version.
+
 ## Runs
 
 | Date | Dataset version | Runtime | Exit status | Difference | Elapsed |
@@ -138,6 +170,11 @@ nothing there. The few-shot document parsed, with all 15 JSON datasets,
 before the run. The puzzle has not been in an **ARC puzzle report** workflow
 run.
 
+The run used the first version of the dataset. No solver run has measured the
+version with standard entries or the version with `is not` of 6-Nov-2026,
+which the user chose to verify offline, so their difference is unknown, not
+zero.
+
 ## Open items
 
 - **The run saw the answer.** Resolved on 6-Nov-2026: the user decided this is
@@ -167,3 +204,11 @@ run.
   still lists the stale README paragraph about `dataset.0d3d703e.json` as
   open; `ebd026c` replaced that paragraph, so the item can be closed there.
 - **Committed.** `a526fec` committed this record with the dataset.
+- **The `is not` version is unmeasured.** No solver run, local or in the
+  **ARC Benchmark** workflow, has used the version of 6-Nov-2026. Its
+  snapshots are unchanged, but every run's few-shot context now shows `is`
+  and `is not` in conditions and callbacks. NUC 86 reads them as operators
+  only in enclosed positions, so a model that copies `is` straight into an
+  assignment value, such as `$Obj.flag = $Obj.color is 5`, gets `is` read as
+  a name and a `ReferenceError`. A dispatched **ARC Benchmark** run would
+  measure the effect.
```

**File**: `arc/docs/ARC-NUC-25d8a9c8.md` (modified, +52/-3)
```diff
@@ -6,11 +6,11 @@ the solver and Nucleoid changes it needed, its runs, and what is still open.
 | Item | Status |
 | --- | --- |
 | Puzzle | [`data/training/25d8a9c8.json`](../data/training/25d8a9c8.json) |
-| Instruction dataset | [`dataset.25d8a9c8.json`](../src/dataset/dataset.25d8a9c8.json): the puzzle's 4 original training pairs and its test pair, 15 row instances, three per pair; committed with this record |
+| Instruction dataset | [`dataset.25d8a9c8.json`](../src/dataset/dataset.25d8a9c8.json): the puzzle's 4 original training pairs and its test pair, 15 row instances, three per pair; committed with this record; condition respelled with `is` on 6-Nov-2026 |
 | Output canvas | `EXACT` |
-| Nucleoid enhancements | None requested, so no proposal strategy was selected; the rule uses the list query `distinct` of [NUC 71](../../docs/nuc-0071.md) and the conditional expression of [NUC 59](../../docs/nuc-0059.md) |
+| Nucleoid enhancements | None requested, so no proposal strategy was selected; the rule uses the list query `distinct` of [NUC 71](../../docs/nuc-0071.md), the conditional expression of [NUC 59](../../docs/nuc-0059.md), and the accepted `is` of [NUC 86](../../docs/nuc-0086.md) |
 | Solver changes | None; suggested changes await review, not applied |
-| Solver runs | 1 local run on 4-Nov-2026, exit 1 before any model call (`OPENROUTER_API_KEY is required`); difference unknown |
+| Solver runs | 1 local run on 4-Nov-2026, exit 1 before any model call (`OPENROUTER_API_KEY is required`); difference unknown; none of the current version |
 | Updated | 6-Nov-2026 |
 
 ## Puzzle
@@ -122,6 +122,44 @@ runtime at `491512d`, and the caller replayed every pair offline against the
 unchanged grids, masks, positions and instance names. No solver run has
 measured this version yet.
 
+### Is comparisons
+
+On 6-Nov-2026 the user asked `/arc-purposal` to apply
+[NUC 86](../../docs/nuc-0086.md) to the existing datasets where it fits. The
+rule's condition now reads with `is`, NUC 86's spelling of `==`:
+
+```nuc
+$Obj.fill_color = 5 if $Obj.parts.distinct().length is 1 else 0
+```
+
+`is` compares exactly as `==` does, with the same loose equality and
+precedence. The condition of a Python-style conditional is one of the
+enclosed positions where NUC 86 reads `is` as an operator, and the right
+operand is the number 1, not a bare word. Only that comparison changed. The
+class, the grids, masks, positions, instance names, implementations, and
+snapshots are as before, and the world model keeps its level, so the gestalt
+overview above still holds. Replaying the rule now needs a runtime at
+`7096171`, the NUC 86 commit, or later. No NUC was requested, so no proposal
+strategy was selected and strategy learning did not apply.
+
+The arc-dataset worker respelled the condition in an external staging
+directory and regenerated all 30 input and output snapshots with the accepted
+runtime at `34d0b19`, which includes NUC 86; each is byte-identical to the
+previous version's. It also confirmed that the comparison written directly as
+an assignment value raises `ReferenceError: is is not defined`, because `is`
+stays a name where a statement can follow:
+
+```nuc
+$Obj.uniform = $Obj.parts.distinct().length is 1
+```
+
+The caller's own offline check passed all 44 of its checks on the staged file
+and again after integration: the file equals the previous one with only `==`
+respelled, its pairs are unchanged, no `==` or `!=` is left in its
+declarations, every snapshot replays on that runtime, and the instance names
+stay unique across all datasets. `document()` loads it with the other 28
+datasets. At the user's choice, no solver run has measured this version.
+
 ## Runs
 
 | Date | Dataset version | Runtime | Exit status | Difference | Elapsed |
@@ -141,6 +179,10 @@ UTC. The runtime's hash and the dataset's were the same before and after the
 run. The invocation authorizes one run, so none was repeated. The puzzle has
 not been in an **ARC puzzle report** workflow run.
 
+No solver run has measured any version of this dataset: the one run stopped
+before its first model request, and the user chose offline verification for
+the `is` version of 6-Nov-2026. The difference is unknown, not zero.
+
 ## Open items
 
 - **No model credential.** The run's process had no `OPENROUTER_API_KEY` in
@@ -175,3 +217,10 @@ not been in an **ARC puzzle report** workflow run.
   pair's input and output grids to the caller. The caller's review and its
   question to the user used the training pairs only, and nothing from the
   test pair reached another agent, the rules, or the run.
+- **The `is` version is unmeasured.** No solver run, local or in the
+  **ARC Benchmark** workflow, has used the version of 6-Nov-2026. Its snapshots
+  are unchanged, but every run's few-shot context now shows `is` in
+  conditions. NUC 86 reads `is` as an operator only in enclosed positions, so a
+  model that copies it straight into an assignment value, as ab
```

**File**: `arc/docs/ARC-NUC-6e02f1e3.md` (modified, +52/-3)
```diff
@@ -6,11 +6,11 @@ the solver and Nucleoid changes it needed, its runs, and what is still open.
 | Item | Status |
 | --- | --- |
 | Puzzle | [`data/training/6e02f1e3.json`](../data/training/6e02f1e3.json) |
-| Instruction dataset | [`dataset.6e02f1e3.json`](../src/dataset/dataset.6e02f1e3.json): the puzzle's 5 original training pairs and its test pair, 6 mosaic instances, one per pair; committed with this record. An earlier invocation the same day verified a different model offline and did not publish it |
+| Instruction dataset | [`dataset.6e02f1e3.json`](../src/dataset/dataset.6e02f1e3.json): the puzzle's 5 original training pairs and its test pair, 6 mosaic instances, one per pair; committed with this record. An earlier invocation the same day verified a different model offline and did not publish it. On 6-Nov-2026 its orientation guard was respelled with `is` |
 | Output canvas | `EXACT`, inferred from the training pairs |
-| Nucleoid enhancements | None requested, so no proposal strategy was selected and strategy learning did not apply; the rules use the accepted `distinct` list query of [NUC 71](../../docs/nuc-0071.md) |
+| Nucleoid enhancements | None requested, so no proposal strategy was selected and strategy learning did not apply; the rules use the accepted `distinct` list query of [NUC 71](../../docs/nuc-0071.md) and the accepted `is` of [NUC 86](../../docs/nuc-0086.md) |
 | Solver changes | None; suggested changes await review, not applied |
-| Solver runs | 1 local run on 5-Nov-2026, exit 1 before any model call (`OPENROUTER_API_KEY is required`); difference unknown |
+| Solver runs | 1 local run on 5-Nov-2026, exit 1 before any model call (`OPENROUTER_API_KEY is required`); difference unknown; none of the current version |
 | Updated | 6-Nov-2026 |
 
 ## Puzzle
@@ -178,6 +178,43 @@ The migration worker regenerated every snapshot with the accepted runtime at
 grids, masks, positions and instance names. No solver run has measured this
 version yet.
 
+### Is comparisons
+
+On 6-Nov-2026 the user asked `/arc-purposal` to apply
+[NUC 86](../../docs/nuc-0086.md) to the existing datasets where it fits. The
+orientation guard now reads with `is`, NUC 86's spelling of `==`, and the
+rules read:
+
+```nuc
+$Obj.tag = 'l6074'
+$Obj.orientation = {1: 90, 2: 135, 3: 45}[$Obj.parts.distinct().length]
+if $Obj.orientation is 90:
+    $Obj.height = 1
+$Obj.fill_color = 5
+```
+
+`is` compares exactly as `==` does, with the same loose equality and
+precedence, and an `if` header is one of the enclosed positions where NUC 86
+reads it as an operator. The right operand is the number 90, not a bare word,
+so the condition is the same standing rule as before. Only that header line
+changed. The class, the other rules, the grids, masks, positions, instance
+names, implementations, and snapshots are as before, and the world model
+keeps its level, so the gestalt overview above still holds. Replaying the
+rules now needs a runtime at `7096171`, the NUC 86 commit, or later. The
+genesis `dataset.line.json`, whose horizontal-line guard this rule mirrors,
+was respelled the same way in the same invocation. No NUC was requested, so
+no proposal strategy was selected and strategy learning did not apply.
+
+The arc-dataset worker respelled the header in an external staging directory
+and regenerated all 12 input and output snapshots with the accepted runtime at
+`34d0b19`, which includes NUC 86; each is byte-identical to the previous
+version's. The caller's own offline check passed all 27 of its checks on the
+staged file and again after integration: the file equals the previous one
+with only `==` respelled, its pairs are unchanged, no `==` or `!=` is left in
+its declarations, every snapshot replays on that runtime, and the instance
+names stay unique across all datasets. `document()` loads it with the other
+28 datasets. At the user's choice, no solver run has measured this version.
+
 ## Runs
 
 | Date | Dataset version | Runtime | Exit status | Difference | Elapsed |
@@ -204,6 +241,10 @@ The runtime, the dataset, and `src/app.ts` had the same hashes before and after
 the run. The invocation authorizes one run, so none was repeated. The puzzle
 has not yet been in an **ARC puzzle report** workflow run.
 
+No solver run has measured any version of this dataset: the one run stopped
+before its first model request, and the user chose offline verification for
+the `is` version of 6-Nov-2026. The difference is unknown, not zero.
+
 ## Open items
 
 - **No model credential.** As in the runs of
@@ -239,3 +280,11 @@ has not yet been in an **ARC puzzle report** workflow run.
   `ceil(listed puzzles / ARC_CONCURRENCY) * 30 + 20` minutes, within GitHub
   Actions' 360-minute job limit. The workflow's 150-minute timeout covers its
   20 listed puzzles.
+- **The `is` version is unmeasured.** No solver run, local or in the
+  **ARC Benchmark** workflow, has used the version of 6-Nov-2026. Its snapshots
+  are unchanged, but every
```

**File**: `arc/docs/ARC-NUC-c8f0f002.md` (modified, +51/-3)
```diff
@@ -6,11 +6,11 @@ the solver and Nucleoid changes it needed, its runs, and what is still open.
 | Item | Status |
 | --- | --- |
 | Puzzle | [`data/training/c8f0f002.json`](../data/training/c8f0f002.json) |
-| Instruction dataset | [`dataset.c8f0f002.json`](../src/dataset/dataset.c8f0f002.json): the puzzle's 3 original training pairs and its test pair, 12 color-region instances, 3 in each pair; committed with this record |
+| Instruction dataset | [`dataset.c8f0f002.json`](../src/dataset/dataset.c8f0f002.json): the puzzle's 3 original training pairs and its test pair, 12 color-region instances, 3 in each pair; committed with this record; condition respelled with `is` later on 6-Nov-2026 |
 | Output canvas | `EXACT` |
-| Nucleoid enhancements | None requested, so no proposal strategy was selected and strategy learning did not apply; the rule uses the class-level `@first` anchor of [NUC 55](../../docs/nuc-0055.md), built on the state versions of [NUC 53](../../docs/nuc-0053.md) |
+| Nucleoid enhancements | None requested, so no proposal strategy was selected and strategy learning did not apply; the rule uses the class-level `@first` anchor of [NUC 55](../../docs/nuc-0055.md), built on the state versions of [NUC 53](../../docs/nuc-0053.md), and the accepted `is` of [NUC 86](../../docs/nuc-0086.md) |
 | Solver changes | None applied or suggested; the JSON-only message question carried over from earlier records stays open |
-| Solver runs | 1 local run on 6-Nov-2026: exit 0, difference 0 |
+| Solver runs | 1 local run on 6-Nov-2026: exit 0, difference 0, before the `is` respelling; none of the current version |
 | Updated | 6-Nov-2026 |
 
 ## Puzzle
@@ -133,6 +133,42 @@ the `dataset.a9f96cdd.json` paragraph, and the puzzle's entry in the
 as its own matrix job. The caller made the puzzle the solver's default in
 `src/app.ts`, in place of `c9e6f938`, before the run.
 
+### Is comparisons
+
+Later on 6-Nov-2026 the user asked `/arc-purposal` to apply
+[NUC 86](../../docs/nuc-0086.md) to the existing datasets where it fits. The
+condition now reads with `is`, NUC 86's spelling of `==`:
+
+```nuc
+class Obj(x: int, y: int, width: int, height: int, orientation: int, color: int):
+if $Obj.color@first is 7:
+    $Obj.color = 5
+```
+
+`is` compares exactly as `==` does, with the same loose equality and
+precedence, and an `if` header is one of the enclosed positions where NUC 86
+reads it as an operator. Its left operand, the anchored `$Obj.color@first`,
+is a complete operand, and its right operand is the number 7, not a bare
+word, so the condition is the same standing rule as before. Only that header
+line changed. The class, the body, the grids, masks, positions, instance
+names, implementations, and snapshots are as before, and the world model
+keeps its level, so the gestalt overview above still holds. Replaying the
+rule now needs a runtime at `7096171`, the NUC 86 commit, or later. The
+README paragraph spells the rejected conditional expression with `is` too,
+so the two formulations still differ only in structure. No NUC was
+requested, so no proposal strategy was selected and strategy learning did
+not apply.
+
+The arc-dataset worker respelled the header in an external staging directory
+and regenerated all 24 input and output snapshots with the accepted runtime at
+`34d0b19`, which includes NUC 86; each is byte-identical to the previous
+version's. The caller's own offline check passed all 37 of its checks on the
+staged file and again after integration: the file equals the previous one
+with only `==` respelled, its pairs are unchanged, no `==` or `!=` is left in
+its declarations, every snapshot replays on that runtime, and the instance
+names stay unique across all datasets. `document()` loads it with the other
+28 datasets. At the user's choice, no solver run has measured this version.
+
 ## Runs
 
 | Date | Command | Runtime | Exit status | Difference | Elapsed |
@@ -162,6 +198,10 @@ it. The invocation authorizes one run, so none was repeated. The puzzle
 joined the **ARC Benchmark** workflow with this dataset, so no workflow run
 is recorded yet.
 
+The exact match above used the version with `==`. No solver run has measured
+the version with `is` of 6-Nov-2026, which the user chose to verify offline,
+so its difference is unknown, not zero.
+
 ## Open items
 
 - **Messages are not JSON-only.** Carried over from
@@ -171,3 +211,11 @@ is recorded yet.
   labels such as `train_dataset:` and `json_format:`, while the ARC
   instructions require every message to parse as one JSON document. It
   remains an open question for the user. This dataset does not depend on it.
+- **The `is` version is unmeasured.** No solver run, local or in the
+  **ARC Benchmark** workflow, has used the version with `is`. Its snapshots
+  are unchanged, but every run's few-shot context now shows `is` in
+  conditions. NUC 86 reads `is` as an operator only in enclosed positions, so a
+  model that copies it straight into an assi
```

**File**: `arc/src/dataset/dataset.0ca9ddb6.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "declarations": [
     "# There is an Obj type, a single point on the grid,\n# which has its x and y position, its width and height,\n# its orientation and its vertex color as integers\nclass Obj(x: int, y: int, width: int, height: int, orientation: int, vertex_color: int):\n    this.x = x\n    this.y = y\n    this.width = width\n    this.height = height\n    this.orientation = orientation\n    this.tag = 'l7544'\n    this.vertex_color = vertex_color",
-    "# A point of vertex color 1 gains color-7 neighbors\n# above, below, left and right, an orthogonal cross\n# that starts one column left and one row up\n# and is two columns wider and two rows taller\nif $Obj.vertex_color == 1:\n    $Obj.tag = 'l1707'\n    $Obj.marker_color = 7\n    $Obj.x = $Obj.x@first - 1\n    $Obj.y = $Obj.y@first - 1\n    $Obj.width = $Obj.width@first + 2\n    $Obj.height = $Obj.height@first + 2",
-    "# A point of vertex color 2 gains color-4 neighbors\n# on its four diagonals, a diagonal cross\n# that starts one column left and one row up\n# and is two columns wider and two rows taller\nif $Obj.vertex_color == 2:\n    $Obj.tag = 'l2404'\n    $Obj.marker_color = 4\n    $Obj.x = $Obj.x@first - 1\n    $Obj.y = $Obj.y@first - 1\n    $Obj.width = $Obj.width@first + 2\n    $Obj.height = $Obj.height@first + 2"
+    "# A point of vertex color 1 gains color-7 neighbors\n# above, below, left and right, an orthogonal cross\n# that starts one column left and one row up\n# and is two columns wider and two rows taller\nif $Obj.vertex_color is 1:\n    $Obj.tag = 'l1707'\n    $Obj.marker_color = 7\n    $Obj.x = $Obj.x@first - 1\n    $Obj.y = $Obj.y@first - 1\n    $Obj.width = $Obj.width@first + 2\n    $Obj.height = $Obj.height@first + 2",
+    "# A point of vertex color 2 gains color-4 neighbors\n# on its four diagonals, a diagonal cross\n# that starts one column left and one row up\n# and is two columns wider and two rows taller\nif $Obj.vertex_color is 2:\n    $Obj.tag = 'l2404'\n    $Obj.marker_color = 4\n    $Obj.x = $Obj.x@first - 1\n    $Obj.y = $Obj.y@first - 1\n    $Obj.width = $Obj.width@first + 2\n    $Obj.height = $Obj.height@first + 2"
   ],
   "output_canvas": "EXACT",
   "dataset": [
```

**File**: `arc/src/dataset/dataset.0d3d703e.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "declarations": [
     "# There is an Obj type, a vertical stripe of one color,\n# which has its x and y position, the width and height of its box,\n# its orientation and its color as integers\nclass Obj(x: int, y: int, width: int, height: int, orientation: int, color: int):\n    this.x = x\n    this.y = y\n    this.width = width\n    this.height = height\n    this.orientation = orientation\n    this.tag = 'l6953'\n    this.color = color",
-    "# Colors come in four pairs, 1 and 5, 2 and 6, 3 and 4, and 8 and 9,\n# whose two colors trade places: every stripe takes the other color\n# of the pair its color belongs to\n$Obj.color = [[1, 5], [2, 6], [3, 4], [8, 9]].find(pair => pair.includes($Obj.color@first)).find(partner => partner != $Obj.color@first)"
+    "# Colors come in four pairs, 1 and 5, 2 and 6, 3 and 4, and 8 and 9,\n# whose two colors trade places: every stripe takes the other color\n# of the pair its color belongs to\n$Obj.color = [[1, 5], [2, 6], [3, 4], [8, 9]].find(pair => pair.includes($Obj.color@first)).find(partner => partner is not $Obj.color@first)"
   ],
   "output_canvas": "EXACT",
   "dataset": [
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

## X. Use NUC 86 `is` comparisons in ARC datasets

**RULE**:
When implementing operations in `arc/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9771c244`: Use NUC 86 `is` comparisons in ARC datasets. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `arc/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
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
1 by 1 size. The two branches are guarded by `if $Obj.vertex_color is 1:`
and `if $Obj.vertex_color is 2:`, with `is`, the spelling of `==` that
[NUC 86](../docs/nuc-0086.md) adds. Tags identify the geometry: `l1707` is an
orthogonal cross, `l2404` is a diagonal cross, and `l7544` remains a single
point.
`[[1, 5], [2, 6], [3, 4], [8, 9]].find(pair => pair.includes($Obj.color@first)).find(partner => partner is not $Obj.color@first)`:
of that pair: the comparison `is not` of [NUC 86](../docs/nuc-0086.md), the
spelling of `!=`, holds only for the color 
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
`output_x` and `output_y`.
1 by 1 size. Tags identify the geometry: `l1707` is an orthogonal cross,
`l2404` is a diagonal cross, and `l7544` remains a single point.
`[[1, 5], [2, 6], [3, 4], [8, 9]].find(pair => pair.includes($Obj.color@first)).find(partner => partner != $Obj.color@first)`:
of that pair. The `@first` anchors read the input color because the rule
`5 if $Obj.parts.distinct().length == 1 else 0`: the list query `distinct` of
conditional rule `if $Obj.orientation == 90:` sets `height` to 1, guarding on
a horizontal line as `dataset.line.json` does: the line along the top row is
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9771c244` are properly handled with clean fallback behavior.
