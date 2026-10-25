> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md`  
> **Source**: github ([https://github.com/NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid))  
> **Source Version**: `63ada8be`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T14:03:30.432Z  
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
> **Harvest Timestamp**: 2026-10-25T14:03:30.427Z  
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
import * as responseFormat from "./lib/response_format";

export async function declarations({
  train_dataset,
}: {
  train_dataset: {
    dataset: {
      input_matrix: number[][];
      output_matrix: number[][];
      instances: {
        instance_name: string;
        input_instance_matrix: number[][];
        output_instance_matrix: number[][];
        implementation: string;
        input_value: object;
        output_value: object;
      }[];
    }[];
  };
}) {
  terminal.step("Inferring declarations");

  const { declarations } = await llm.generate<{ declarations: string[] }>({
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          train_dataset,
        }),
      },
    ],
    response_format: responseFormat.create("analyzer_declarations", {
      declarations: {
        type: "array",
        minItems: 1,
        items: responseFormat.code,
      },
    }),
  });

  terminal.code("Declarations", declarations);

  return { declarations };
}

export async function instances({
  declarations,
  input_matrix,
  output_matrix,
}: {
  declarations: string[];
  input_matrix: number[][];
  output_matrix: number[][];
}) {
  terminal.step("Segmenting training objects");

  const { instances } = await llm.generate<{
    instances: {
      input_instance_matrix: number[][];
      output_instance_matrix: number[][];
    }[];
  }>({
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          declarations,
          input_matrix,
          output_matrix,
        }),
      },
    ],
    response_format: responseFormat.create("analyzer_instances", {
      instances: {
        type: "array",
        items: responseFormat.object({
          input_instance_matrix: responseFormat.grid(
            input_matrix.length,
            input_matrix[0].length
          ),
          output_instance_matrix: responseFormat.grid(
            output_matrix.length,
            output_matrix[0].length
          ),
        }),
      },
    }),
  });

  instances.forEach((instance, index: number) => {
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
}: {
  instance_name: string;
  declarations: string[];
  input_instance_matrix: number[][];
  output_instance_matrix: number[][];
}) {
  terminal.step(`Constructing ${instance_name}`);

  const { implementation } = await llm.generate<{ implementation: string }>({
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          instance_name,
          declarations,
          input_instance_matrix,
          output_instance_matrix,
        }),
      },
    ],
    response_format: responseFormat.create("analyzer_value", {
      implementation: responseFormat.code,
    }),
  });

  terminal.step("Evaluating declarative rules");
  const input_value = nucleoid.snapshot(
    await nucleoid.run([declarations[0], implementation].join("\n\n"))
  );
  const output_value = nucleoid.snapshot(
    await nucleoid.run([...declarations, implementation].join("\n\n"))
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
// 0ca9ddb6

const {
  train,
  test: [{ input: test_input_matrix, output: test_output_matrix }],
} = puzzle;

const training_input: {
  dataset: {
    input_matrix: number[][];
    output_matrix: number[][];
    instances: {
      instance_name: string;
      input_instance_matrix: number[][];
      output_instance_matrix: number[][];
      implementation: string;
      input_value: { [property: string]: unknown };
      output_value: { [property: string]: unknown };
    }[];
  }[];
} = {
  dataset: train.map(({ input, output }) => ({
    input_matrix: input,
    output_matrix: output,
    instances: [],
  })),
};

export async function start() {
  const startedAt: number = performance.now();
  terminal.header({ version: await nucleoid.version() });
  terminal.puzzle({ train, testInput: test_input_matrix });
  terminal.section(
    1,
    "Analyze",
    "Infer reusable objects and transformation rules"
  );

  let instance_index: number = 0;

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
      const instance_name: string = `obj${String(instance_index++).padStart(
        12,
        "0"
      )}`;

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

  let test_index: number = 0;

  let result_matrix: number[][] = Array.from(
    { length: test_output_matrix.length },
    () => Array<number>(test_output_matrix[0].length).fill(0)
  );

  const input_instances: {
    input_value: { [property: string]: unknown };
    input_instance_matrix: number[][];
    output_value: { [property: string]: unknown };
    output_instance_matrix: number[][];
  }[] = [];

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

export function document(): unknown[] {
  const files = readdirSync(__dirname, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.json$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (files.length === 0) {
    throw new Error(`No JSON instruction datasets found in ${__dirname}`);
  }

  const datasets = files.map((file: string): unknown => {
    const source: string = readFileSync(join(__dirname, file), "utf8");

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

### Core Architecture Module: `arc/src/lib/Matrix.ts`
```
export function crop(matrix: number[][]): number[][] {
  return locate(matrix).matrix;
}

export function locate(matrix: number[][]): {
  matrix: number[][];
  x: number;
  y: number;
} {
  const rows: number = matrix.length;
  const cols: number = matrix[0]?.length ?? 0;
  let top = rows;
  let bottom = -1;
  let left = cols;
  let right = -1;

  for (let y = 0; y < rows; y++) {
    const row = matrix[y];
    if (row.length !== cols) {
      throw new Error("Matrix must be rectangular for cropping");
    }
    for (let x = 0; x < cols; x++) {
      const value: number = row[x];
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

export function pad(
  matrix: number[][],
  rows: number,
  cols: number,
  left: number,
  top: number
): number[][] {
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
  const sourceRows: number = matrix.length;
  const sourceCols: number = matrix[0]?.length ?? 0;
  const paddedRows = Math.max(rows, top + sourceRows);
  const paddedCols = Math.max(cols, left + sourceCols);
  if (!Number.isSafeInteger(paddedRows) || !Number.isSafeInteger(paddedCols)) {
    throw new Error("Expanded padding dimensions must be safe integers");
  }
  const result = Array.from({ length: paddedRows }, () =>
    Array.from({ length: paddedCols }, () => 0)
  );

  for (let y = 0; y < sourceRows; y++) {
    const row = matrix[y];
    if (row.length !== sourceCols) {
      throw new Error("Matrix must be rectangular for padding");
    }
    for (let x = 0; x < sourceCols; x++) {
      const value: number = row[x];
      if (!Number.isFinite(value)) {
        throw new Error("Matrix must contain finite numbers for padding");
      }
      result[y + top][x + left] = value;
    }
  }

  return result;
}

export function merge(...matrices: number[][][]): number[][] {
  if (matrices.length === 0) {
    throw new Error("At least one matrix is required for merging");
  }
  const numRows = Math.max(...matrices.map((matrix): number => matrix.length));
  const numCols = Math.max(
    ...matrices.map((matrix): number => matrix[0]?.length ?? 0)
  );

  const result = Array.from({ length: numRows }, () =>
    Array.from({ length: numCols }, () => 0)
  );

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

export function difference(matrix1: number[][], matrix2: number[][]): number {
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

export function toString(matrix: number[][]): void {
  matrix.forEach((row) => {
    console.debug(`[${row.join(",")}]`);
  });
}

```

### Core Architecture Module: `arc/src/lib/Zoom.ts`
```
export function focus(matrix: number[][]): {
  x_position: number;
  y_position: number;
  object_matrix: number[][];
} {
  const rows: number = matrix.length;
  const cols: number = matrix[0].length;

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

export function enlarge(
  matrix: {
    x_position: number;
    y_position: number;
    object_matrix: number[][];
  },
  rows: number,
  cols: number
): number[][] {
  const { x_position: xOffset, y_position: yOffset, object_matrix } = matrix;

  const originalArray = Array.from({ length: rows }, () =>
    Array<number>(cols).fill(0)
  );

  for (let i = 0; i < object_matrix.length; i++) {
    for (let j = 0; j < object_matrix[i].length; j++) {
      originalArray[yOffset + i][xOffset + j] = object_matrix[i][j];
    }
  }

  return originalArray;
}

```

### Core Architecture Module: `arc/src/lib/json.ts`
```
export function isObject(value: unknown): value is {
  [property: string]: unknown;
} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

### Incident Patch 1: `63ada8be` (2026-10-25)
**Commit Message**: Add NUC categories and selection policy

Introduce a proposal category registry and classify existing NUCs in their headers and indexes. Update proposal and evaluation workflows to confirm uncertain classifications, review proposals when categories are added, and select unspecified enhancements uniformly from eligible categories.

**File**: `.github/agents/nuc-evaluate.agent.md` (modified, +10/-4)
```diff
@@ -10,8 +10,12 @@ You independently evaluate exactly one completed NUC revision. Follow
 ## Scope
 
 - Require the proposal agent's completed handoff, including the proposal path
-  and Git blob revision, accepted Git revision, immutable baseline JSON
-  artifact, candidate worktree, and a fresh report artifact path.
+  and Git blob revision, confirmed category, accepted Git revision, immutable
+  baseline JSON artifact, candidate worktree, and a fresh report artifact path.
+- Verify the proposal's `Category` header against the handoff and registry.
+  Return uncertainty about category additions, selections, updates, or
+  assignments to the caller, who asks the user for confirmation; do not
+  assign or change a category during evaluation.
 - Use a fresh context, separate from the proposal agent; never evaluate your
   own proposal work.
 - Run independent behavior checks and the `evaluate_proposal` gate. Decide
@@ -24,12 +28,14 @@ You independently evaluate exactly one completed NUC revision. Follow
   to the caller; a revised candidate requires a fresh proposal/evaluation pair.
 - During continuous cycles, do not ask questions or request confirmation.
   Return missing prerequisites or other blockers explicitly without inventing
-  inputs; the caller owns outcome recording and non-interactive continuation
+  inputs; the caller owns category clarification with the user, outcome
+  recording, and continuation
   under the skill's [continuous-cycle handoff](../skills/nuc-evaluate/SKILL.md#continuous-cycle-handoff-caller-only).
 
 ## Result
 
-Return the proposal and baseline revisions, decision, report path, independent
+Return the proposal and baseline revisions, confirmed category, decision,
+report path, independent
 checks, counts of `less`/`same`/`more` cases, and every increased, missing,
 unpaired, or invalid case with its before/after counts or explicit reason.
 Do not offset a per-case increase with savings elsewhere. The caller owns
```

**File**: `.github/agents/nuc-proposal.agent.md` (modified, +13/-4)
```diff
@@ -1,6 +1,6 @@
 ---
 name: nuc-proposal
-description: Draft and prototype one NUC syntax or runtime-feature revision, preserving existing behavior and baseline cases for a separate evaluation agent.
+description: Draft and prototype one categorized NUC revision, preserving existing behavior and baseline cases for a separate evaluation agent.
 ---
 
 You draft and prototype exactly one added or updated NUC revision. Follow
@@ -11,8 +11,17 @@ You draft and prototype exactly one added or updated NUC revision. Follow
 
 - Follow the caller-owned [enhancement selection rule](../skills/nuc-proposal/SKILL.md#select-an-unspecified-enhancement);
   do not redraw the selected category.
-- Require the proposal path and requested change, accepted Git revision,
-  immutable baseline JSON artifact, and isolated candidate worktree.
+- Require the proposal path, confirmed category and requested change,
+  accepted Git revision, immutable baseline JSON artifact, and isolated
+  candidate worktree.
+- Write the confirmed `Category` header using the
+  [classification rule](../skills/nuc-proposal/SKILL.md#classify-every-proposal).
+  Return uncertainty about category additions, selections, updates, or
+  proposal assignments to the caller, who asks the user for confirmation
+  before proceeding; do not guess or invent a category.
+- When a category is added, the caller reviews all existing NUCs and supplies
+  any required reclassification as a separate revision per proposal. Preserve
+  unaffected categories, types, statuses, and historical outcomes.
 - Always preserve accepted syntax and its behavior under the skill's
   [syntax compatibility rule](../skills/nuc-proposal/SKILL.md#preserve-syntax-compatibility);
   verify unchanged legacy forms alongside candidate forms.
@@ -29,7 +38,7 @@ You draft and prototype exactly one added or updated NUC revision. Follow
 ## Handoff
 
 Return the proposal path and Git blob revision, baseline revision and artifact
-path, selected enhancement category and selection rationale when applicable,
+path, confirmed proposal category and selection rationale when applicable,
 candidate worktree, changed files, development and syntax-compatibility checks,
 and any blockers.
 Declare the candidate ready for independent evaluation only when its inputs
```

**File**: `.github/instructions/proposals.instructions.md` (modified, +31/-24)
```diff
@@ -27,24 +27,29 @@ another case cannot offset an increase. Missing baselines block acceptance.
 Keep reports in the session workspace and do not apply rejected candidates.
 Evaluation outcome metadata does not recursively trigger another agent.
 
-## All-around enhancement selection
-
-When choosing unspecified enhancements, develop the language as a whole rather
-than repeatedly extending one narrow niche. Review recent NUCs and unmet needs
-across logic and reasoning, reactive dependencies, functions and scope, control
-flow, collections and strings, data modeling, and diagnostics.
-
-Prioritize distinct user value and broader expressiveness while weighing API
-complexity.
-Do not repeatedly favor math helpers or closely related utility variants merely
-because they are easy to implement, baseline, or shorten in measured examples.
-Math remains eligible when it addresses a clear need; token savings alone do
-not establish feature priority. Record the selection rationale in the handoff.
+## Enhancement selection
+
+Every NUC, including existing and rejected proposals, has one `Category`
+header from the extensible
+[category registry](../../docs/nuc-0001.md#proposal-categories).
+Keep its category and index entries consistent without changing its `Type`
+or status. Only the user adds categories or resolves uncertainty. Whenever a
+category is added, selected, or updated, the caller must ask the user for
+confirmation before proceeding if its meaning, automatic-selection eligibility,
+or proposal assignments are unclear, including during continuous cycles.
+
+Every category addition also triggers a review of all existing NUCs across
+every status. Reclassify proposals that fit the new category more accurately,
+ask about uncertain moves, and synchronize their headers and both NUC indexes.
+Preserve unaffected categories, types, statuses, and historical outcomes;
+the normal independent proposal/evaluation requirements still apply.
 
 Follow the caller-owned
 [selection rule](../skills/nuc-proposal/SKILL.md#select-an-unspecified-enhancement).
-Breadth guides feature choice within the existing 50/50 syntax/runtime draw;
-it does not authorize redraws, fixed rotations, or weaker acceptance checks.
+Unspecified enhancements use equal random selection across the registry's
+eligible categories, currently Syntax enhancement, Runtime features, Utility
+enhancement, and Reasoning enhancement. Documentation is classified but is
+not automatically selected for a language enhancement.
 Explicit feature/category requests still take precedence.
 
 ## Detailed proposal workflow
@@ -61,8 +66,8 @@ executable cases can demonstrate equal token usage.
 
 Pin the accepted Git revision and record its token baseline before editing
 runtime behavior or executable cases. Give the proposer its requested change,
-proposal path, baseline revision and immutable JSON artifact, and candidate
-worktree. Use `.github/agents/nuc-proposal.agent.md` and
+proposal path and confirmed category, baseline revision and immutable JSON
+artifact, and candidate worktree. Use `.github/agents/nuc-proposal.agent.md` and
 `.github/skills/nuc-proposal/SKILL.md` for drafting, prototyping, equivalent
 case rewrites, synchronization, and development checks. It must not run the
 acceptance gate or mark the proposal Accepted or Rejected.
@@ -125,13 +130,15 @@ Only the caller continues; workers stop at their handoffs. This does not
 recursively reevaluate the completed NUC's outcome metadata. Stop or pause
 under the conditions defined by the skill rather than bypassing a blocker.
 
-Continuous cycles, including those coordinated through `/nuc-evaluate`, are
-non-interactive. Neither the caller nor workers ask questions or request
-confirmation to record an outcome or start the next NUC. Use the existing
-selection rules and verified inputs; a rejection is not a reason to interrupt
-continuation. If a required input cannot be obtained or another blocking
-condition occurs, report it and pause without asking a question. Never invent
-baselines, bypass checks or required tool approvals, or ignore a user stop.
+Continuous cycles, including those coordinated through `/nuc-evaluate`, do not
+request confirmation to record an outcome or start the next NUC. An uncertain
+category addition, selection, or update is the exception: workers return it
+to the caller, who asks the user for confirmation before proceeding.
+Use the existing selection rules and verified inputs;
+a rejection is not a reason to interrupt continuation. For other missing
+prerequisites or blockers, report them and pause without asking a question.
+Never invent baselines, bypass checks or required tool approvals, or ignore
+a user stop.
 
 This is a Copilot-session policy, not a filesystem watcher or GitHub Actions
 trigger. Do not claim that an edit outside a Copilot session launched an agent.
```

**File**: `.github/skills/nuc-evaluate/SKILL.md` (modified, +15/-8)
```diff
@@ -18,9 +18,12 @@ Evaluate exactly one completed revision, independently of the proposal agent.
 
 Require the proposal path and handed-off Git blob revision, accepted baseline
 Git revision and immutable JSON artifact, candidate worktree, and fresh report
-artifact path in the session workspace. Confirm that the current proposal blob
-matches the handoff and the baseline matches the accepted revision. Missing
-prerequisites block evaluation; never invent measurements.
+artifact path in the session workspace. Require the confirmed proposal
+category and verify that its header matches the handoff and
+[category registry](../../../docs/nuc-0001.md#proposal-categories).
+Confirm that the current proposal blob matches the handoff and the baseline
+matches the accepted revision. Missing prerequisites block evaluation; never
+invent measurements or guess an uncertain category.
 
 Treat candidate sources, generated exports, and the baseline as read-only.
 Only new session reports and normal ignored build outputs may be written.
@@ -82,7 +85,8 @@ handoff. If no report was produced, state that and the actual error explicitly.
 
 ## Return the evidence
 
-Return the proposal and baseline revisions, decision, report path, independent
+Return the proposal and baseline revisions, confirmed category, decision,
+report path, independent
 checks including syntax compatibility, counts of `less`/`same`/`more`, and each
 increased, missing, unpaired, invalid or syntax-incompatible case with its
 before/after counts or reason. Keep the candidate and baseline unchanged.
@@ -105,8 +109,11 @@ unstaged work. Baselines and reports remain in the session workspace.
 
 After recording the outcome, follow the
 [continuous-cycle rule](../nuc-proposal/SKILL.md#continue-with-the-next-nuc-caller-only)
-without asking questions or requesting confirmation. Neither caller nor
-workers prompt for choices during continuous cycles; use the existing rules
-and verified inputs. A missing prerequisite or other blocker pauses the
-cycle with an explicit report, not a question or invented measurement.
+without requesting confirmation to record outcomes or continue. For uncertain
+category additions, selections, updates, or assignments, workers return the
+question to the caller, who asks the user for confirmation under the proposal skill's
+[classification rule](../nuc-proposal/SKILL.md#classify-every-proposal).
+Otherwise use the existing rules and verified inputs; a missing prerequisite
+or other blocker pauses the cycle with an explicit report, not a question
+or invented measurement.
 Required tool approvals and user stop/pause instructions still apply.
```

**File**: `.github/skills/nuc-proposal/SKILL.md` (modified, +54/-42)
```diff
@@ -1,6 +1,6 @@
 ---
 name: nuc-proposal
-description: Draft or revise a Nucleoid NUC and prototype syntax improvements or runtime features. Use for proposal preparation, not acceptance evaluation.
+description: Draft or revise a Nucleoid NUC and prototype its changes. Use for proposal preparation, not acceptance evaluation.
 ---
 
 # Preparing a NUC proposal
@@ -13,52 +13,62 @@ agent. Inside that agent, execute the steps below; do not spawn another agent.
 Follow `.github/copilot-instructions.md` and `docs/nuc-0001.md`.
 Work on exactly one proposal revision in the caller's isolated candidate.
 
+## Classify every proposal
+
+Give every new and existing NUC exactly one `Category` header from the
+[proposal category registry](../../../docs/nuc-0001.md#proposal-categories),
+including Draft, Accepted, Rejected, Active, and Superseded documents.
+Category describes the proposal's purpose; it does not replace `Type` or
+change its status.
+
+Use the user's explicit classification when supplied. Whenever a category is
+added, selected, or updated, the coordinating caller must ask the user for
+confirmation if anything is uncertain, including its meaning, automatic-selection
+eligibility, or which proposals belong to it. Ask before proceeding, not after
+guessing. Workers return the question to the caller. This clarification also
+applies during continuous cycles.
+
+The user may add categories in the future. Every category addition requires
+reviewing all existing NUCs, across every status, and reclassifying proposals
+that fit the new category more accurately. Keep unaffected classifications,
+`Type`, `Status`, and historical outcomes unchanged. Synchronize the registry,
+affected proposal headers, and both category and numerical indexes through the
+normal proposal/evaluation process. Ask for confirmation on uncertain moves;
+do not invent categories or retain stale classifications without review.
+
 ## Select an unspecified enhancement
 
 When asked to choose a language enhancement without a specific feature or
-category, the coordinating caller makes one unbiased random draw:
-
-- **50% language syntax improvement:** simplify syntax or reduce lexer tokens
-  while preserving behavior.
-- **50% new language runtime feature:** add a runtime capability while
-  preserving existing behavior.
-
-Use a tool-backed draw, such as `Get-Random -Minimum 0 -Maximum 2`, with `0`
-selecting syntax improvement and `1` selecting a runtime feature. Choose one
-bounded enhancement in that category; do not redraw to favor a preferred
-category or substitute deterministic alternation for randomness.
-
-Within the selected category, pursue all-around language development:
-
-- Review the current specification and recent NUCs to identify unmet needs and
-  avoid repeatedly extending the same narrow feature family.
-- Consider gaps across logic and reasoning, reactive dependencies, functions
-  and scope, control flow, collections and strings, data modeling, and
-  diagnostics. Prefer underrepresented areas when user value is comparable.
-- Weigh distinct user value, broader expressiveness, and API complexity.
-  Do not repeatedly choose math helpers or other closely related utility
-  variants merely for easy implementation, baselines, or token savings.
-- Keep math eligible when it fills a clear gap. Broaden coverage without a
-  math ban, fixed rotation, quota, or category redraw; preserve every
-  compatibility and acceptance requirement.
+category, the coordinating caller makes one unbiased random draw with equal
+probability across the registry's automatically selectable enhancement
+categories. The current four enhancement categories each have a 25% chance;
+`Documentation` is not part of this automatic language-enhancement draw.
+
+Read the current registry before drawing; do not hard-code its size or retain
+the former 50/50 syntax/runtime split. For example, populate `$categories`
+from the eligible registry entries and use
+`Get-Random -Minimum 0 -Maximum $categories.Count` to select an index.
+Choose one bounded enhancement in that category; do not redraw to favor a
+preferred category or substitute deterministic alternation for randomness.
 
 Select before recording baselines or delegating preparation. Supply the
-selected category, requested change, and a brief selection rationale explaining
-the unmet need and fit with recent coverage to the proposal agent, which must
-not redraw. Include the category and rationale in its handoff. Explicit
+selected category, requested change, and a brief selection rationale to the
+proposal agent, which must not redraw. Include the category and rationale in
+its handoff and write the same category in the proposal header. Explicit
 feature/category requests take precedence, and process or documentation-only
 revisions are not randomized.
 
-Runtime features retain the same baseline and acceptance requirements. New
+Every category retains the same baseline and acceptance requirement
```

**File**: `CONTRIBUTING.md` (modified, +10/-0)
```diff
@@ -109,6 +109,16 @@ and [evaluation skill](.github/skills/nuc-evaluate/SKILL.md), with separate
 profiles in `.github/agents/`. The caller starts both stages; neither agent
 delegates to the other. See [NUC 1](docs/nuc-0001.md#proposal-evaluation).
 
+Every NUC has one `Category` header from the extensible
+[proposal category registry](docs/nuc-0001.md#proposal-categories), separate
+from its `Type` and `Status`. Whenever a category is added, selected, or updated,
+ask the user for confirmation before proceeding if its meaning, eligibility,
+or proposal assignments are uncertain. Every category addition requires
+reviewing all existing proposals and updating those that fit the new category
+more accurately, with synchronized category and numerical indexes. Unspecified
+enhancements use an equal random draw across the currently eligible categories;
+Documentation is not part of that draw.
+
 The gate measures each case from the specification and executable reference,
 README, and examples. It uses Nucleoid lexer tokens, including `Newline`,
 `Indent`, and `Dedent`, excluding `Eof`; it does not measure LLM tokens,
```

**File**: `docs/nuc-0000.md` (modified, +93/-77)
```diff
@@ -6,6 +6,7 @@ Title: Index of NUC Documents
 Author: Can Mingir <canmingir@gmail.com>
 Status: Active
 Type: Informational
+Category: Documentation
 Created: 31-Jul-2026
 ```
 
@@ -22,27 +23,10 @@ Created: 31-Jul-2026
 
 ## Index by Category
 
-### Meta-NUCs (NUCs about NUCs)
+### Syntax enhancement
 
 | NUC | Title | Status |
 | --- | --- | --- |
-| [0](nuc-0000.md) | Index of NUC Documents | Active |
-| [1](nuc-0001.md) | NUC Purpose and Guidelines | Active |
-
-### Language Reference
-
-| NUC | Title | Status |
-| --- | --- | --- |
-| [2](nuc-0002.md) | Variables and Declarative Assignment | Draft |
-| [3](nuc-0003.md) | Types and Instances | Draft |
-| [4](nuc-0004.md) | Properties | Draft |
-| [5](nuc-0005.md) | Class-Level Rules | Draft |
-| [6](nuc-0006.md) | Blocks and Scope | Draft |
-| [7](nuc-0007.md) | Control Flow | Draft |
-| [8](nuc-0008.md) | Functions | Accepted |
-| [9](nuc-0009.md) | Transactions and Error Handling | Draft |
-| [10](nuc-0010.md) | Standard Built-in Objects | Draft |
-| [11](nuc-0011.md) | Reasoning Operations | Draft |
 | [12](nuc-0012.md) | Expression-Bodied Named Functions | Accepted |
 | [13](nuc-0013.md) | Compound Arithmetic Assignment | Accepted |
 | [14](nuc-0014.md) | Bodyless Empty Class Declarations | Accepted |
@@ -52,9 +36,6 @@ Created: 31-Jul-2026
 | [18](nuc-0018.md) | Bare Single-Parameter Named Arrows | Accepted |
 | [19](nuc-0019.md) | Bare Single-Parameter Indented Block Definitions | Accepted |
 | [20](nuc-0020.md) | Bare Typed Single-Parameter Named Arrows | Accepted |
-| [21](nuc-0021.md) | Reactive Numeric Clamping | Accepted |
-| [22](nuc-0022.md) | Reactive Numeric Interpolation | Accepted |
-| [23](nuc-0023.md) | Reactive Unit-Interval Saturation | Accepted |
 | [24](nuc-0024.md) | Bare Typed Single-Parameter Indented Block Definitions | Accepted |
 | [26](nuc-0026.md) | Logical Compound Assignment | Accepted |
 | [27](nuc-0027.md) | Bare Multiple-Parameter Named Arrows | Accepted |
@@ -63,73 +44,108 @@ Created: 31-Jul-2026
 | [30](nuc-0030.md) | Bare Typed Multiple-Parameter Indented Blocks | Accepted |
 | [31](nuc-0031.md) | Implicit Iterator Indented Loops | Accepted |
 | [32](nuc-0032.md) | Indented Named Arrow Expressions | Accepted |
-| [33](nuc-0033.md) | Reactive Cubic Smoothstep | Accepted |
 | [34](nuc-0034.md) | Colon-Free Indented Else Suites | Accepted |
-| [35](nuc-0035.md) | Reactive Quintic Smootherstep | Accepted |
-| [36](nuc-0036.md) | Reactive Fractional Part | Accepted |
 | [37](nuc-0037.md) | Comma-Free Bare Named Arrows | Accepted |
-| [38](nuc-0038.md) | Reactive Inverse Interpolation | Accepted |
-| [39](nuc-0039.md) | Reactive Range Remapping | Accepted |
 | [40](nuc-0040.md) | Comma-Free Bare Indented Blocks | Accepted |
-| [41](nuc-0041.md) | Reactive Flat Mapping | Accepted |
-| [42](nuc-0042.md) | Reactive Literal String Replacement | Accepted |
 | [43](nuc-0043.md) | Direct Conditional Alternatives | Accepted |
 | [44](nuc-0044.md) | Comma-Free Explicit Object Properties | Accepted |
 | [45](nuc-0045.md) | Colon-Led Assertion Statements | Accepted |
 | [46](nuc-0046.md) | Colon-Free Indented Exception Suites | Accepted |
+
+### Runtime features
+
+| NUC | Title | Status |
+| --- | --- | --- |
+| [2](nuc-0002.md) | Variables and Declarative Assignment | Draft |
+| [3](nuc-0003.md) | Types and Instances | Draft |
+| [4](nuc-0004.md) | Properties | Draft |
+| [6](nuc-0006.md) | Blocks and Scope | Draft |
+| [7](nuc-0007.md) | Control Flow | Draft |
+| [8](nuc-0008.md) | Functions | Accepted |
+| [9](nuc-0009.md) | Transactions and Error Handling | Draft |
 | [47](nuc-0047.md) | Default Named Constructors | Accepted |
 
+### Utility enhancement
+
+| NUC | Title | Status |
+| --- | --- | --- |
+| [10](nuc-0010.md) | Standard Built-in Objects | Draft |
+| [21](nuc-0021.md) | Reactive Numeric Clamping | Accepted |
+| [22](nuc-0022.md) | Reactive Numeric Interpolation | Accepted |
+| [23](nuc-0023.md) | Reactive Unit-Interval Saturation | Accepted |
+| [33](nuc-0033.md) | Reactive Cubic Smoothstep | Accepted |
+| [35](nuc-0035.md) | Reactive Quintic Smootherstep | Accepted |
+| [36](nuc-0036.md) | Reactive Fractional Part | Accepted |
+| [38](nuc-0038.md) | Reactive Inverse Interpolation | Accepted |
+| [39](nuc-0039.md) | Reactive Range Remapping | Accepted |
+| [41](nuc-0041.md) | Reactive Flat Mapping | Accepted |
+| [42](nuc-0042.md) | Reactive Literal String Replacement | Accepted |
+
+### Reasoning enhancement
+
+| NUC | Title | Status |
+| --- | --- | --- |
+| [5](nuc-0005.md) | Class-Level Rules | Draft |
+| [11](nuc-0011.md) | Reasoning Operations | Draft |
+
+### Documentation
+
+| NUC | Title | Status |
+| --- | --- | --- |
+| [0](nuc-0000.md) | Index of NUC Documents | Active |
+| [1](nuc-0001.md) | NUC Purpose and Guidelines | Active |
+
 ## Numerical Index
 
-| NUC | Title | Type | Status |
-| --- | --- | --- | --- |
-| [0](nuc-0000.md) | Index of NUC Documents | Informational | Active |
-| [1](nuc-0001.md) |
```

**File**: `docs/nuc-0001.md` (modified, +38/-1)
```diff
@@ -6,6 +6,7 @@ Title: NUC Purpose and Guidelines
 Author: Can Mingir <canmingir@gmail.com>
 Status: Active
 Type: Process
+Category: Documentation
 Created: 31-Jul-2026
 ```
 
@@ -36,6 +37,39 @@ Created: 31-Jul-2026
 - **Informational** -- a design issue, index, or guidelines. Revisions still undergo proposal evaluation. NUC 0.
 - **Process** -- a process around Nucleoid, or a change to one. This document.
 
+## Proposal Categories
+
+- This table is the authoritative category registry; `Category` labels one primary purpose, independently of `Type` and `Status`.
+
+| Category | Purpose | Eligible for automatic selection |
+| --- | --- | --- |
+| Syntax enhancement | Grammar, spellings, and source forms. | Yes |
+| Runtime features | Core execution, data modeling, scope, control flow, and transactions. | Yes |
+| Utility enhancement | Standard built-in helpers, including math, collections, and strings. | Yes |
+| Reasoning enhancement | Logic rules, inference, graph queries, and explanations. | Yes |
+| Documentation | Indexes, guidelines, reference documentation, and development processes. | No |
+
+- Every existing and future NUC must have exactly one registered `Category` header, including Draft, Accepted, Rejected, Active, and Superseded proposals.
+- Classify the NUC's overall primary purpose, not merely its latest edit; a metadata-only revision does not make a language proposal Documentation.
+- NUC 0 and NUC 1 use Documentation.
+- Only the user may add categories and specify their automatic-selection eligibility; keep this registry, affected proposal headers, and both category and numerical indexes synchronized.
+- Every category addition requires the coordinating caller to review all existing NUCs across every status and update proposals that fit the new category more accurately.
+- Each NUC changed by that review requires its own revision under the ordinary independent proposal/evaluation process; preserve unaffected categories and every proposal's `Type`, `Status`, and historical evaluation outcomes.
+- Use the user's confirmed classifications; preserve clear assignments unless the category-addition review warrants a more accurate fit.
+- Whenever a category is added, selected, or updated, the coordinating caller must ask the user for confirmation before proceeding if anything is uncertain, including its meaning, automatic-selection eligibility, or proposal placement; workers return the question to the caller rather than guessing.
+- This category-confirmation requirement is the explicit exception during otherwise non-confirming continuous proposal cycles; only the caller asks the user.
+
+### Selecting an Unspecified Enhancement
+
+- Explicit feature or category requests take precedence; documentation and process work are not randomly selected as language enhancements.
+- When no feature or category is specified for a language enhancement, the caller reads the current registry and makes one tool-backed, unbiased random draw with equal probability across all currently eligible categories.
+- Derive the eligible set and its size from the registry, without a hard-coded category count; future user-added eligible categories join the same uniform draw.
+- With the current four eligible categories, each has a 25% chance; do not retain the former 50/50 syntax/runtime split.
+- For example, populate `$categories` from the registry's Yes entries and select one index with `Get-Random -Minimum 0 -Maximum $categories.Count`.
+- Draw before recording baselines or delegating preparation, then choose one bounded enhancement within the selected category; do not redraw to favor a category or substitute deterministic alternation for randomness.
+- The caller supplies the selected category, requested change, and selection rationale to the proposal worker; the worker uses that selection without redrawing.
+- All categories retain the same baseline, syntax-compatibility, development-check, and independent acceptance requirements; classification never bypasses a safeguard.
+
 ## NUC Status
 
 - **Draft** -- under development, subject to change.
@@ -54,11 +88,13 @@ Created: 31-Jul-2026
 - Pin an accepted Git revision and record its immutable baseline before changing runtime behavior or executable cases. Do not assume a revision containing the candidate is an accepted baseline.
 - Prepare and evaluate each revision in an isolated candidate worktree. Dependencies must already be accepted; do not combine pending proposals. Concurrent revisions that rewrite shared files need separate worktrees.
 - The proposal agent drafts and prototypes one revision, implementing candidate runtime support and rewriting equivalent executable source cases where necessary. Process-only changes need no runtime or corpus rewrite or artificial new cases.
+- Preserve previously accepted syntax and its parsing and runtime semantics; new forms are additive and optional, never replacements that break legacy programs.
+- Verify unchanged accepted-sy
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

## X. Add NUC categories and selection policy

**RULE**:
When implementing operations in `.github/agents/nuc-evaluate.agent.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `63ada8be`: Add NUC categories and selection policy. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/agents/nuc-evaluate.agent.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  and Git blob revision, confirmed category, accepted Git revision, immutable
  baseline JSON artifact, candidate worktree, and a fresh report artifact path.
- Verify the proposal's `Category` header against the handoff and registry.
  Return uncertainty about category additions, selections, updates, or
  assignments to the caller, who asks the user for confirmation; do not
  assign or change a category during evaluation.
  inputs; the caller owns category clarification with the user, outcome
  recording, and continuation
Return the proposal and baseline revisions, confirmed category, decision,
report path, independent
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
  and Git blob revision, accepted Git revision, immutable baseline JSON
  artifact, candidate worktree, and a fresh report artifact path.
  inputs; the caller owns outcome recording and non-interactive continuation
Return the proposal and baseline revisions, decision, report path, independent
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `63ada8be` are properly handled with clean fallback behavior.
