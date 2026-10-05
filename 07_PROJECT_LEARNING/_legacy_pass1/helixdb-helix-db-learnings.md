# Forensic Learning Record (Deep Inspection): HelixDB/helix-db

> **Canonical Artifact**: `07_PROJECT_LEARNING/helixdb-helix-db-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HelixDB/helix-db](https://github.com/HelixDB/helix-db))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:47:16.908Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HelixDB/helix-db`
- **Description**: HelixDB is an OLTP graph database with native vector and full-text search built in Rust on Object Storage.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 6106 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bindings/uniffi-bindgen/src/bin/go.rs`
```
fn main() -> anyhow::Result<()> {
    uniffi_bindgen_go::main()
}

```

### Core Architecture Module: `bindings/uniffi-bindgen/src/bin/node.rs`
```
fn main() -> anyhow::Result<()> {
    uniffi_bindgen_node_js::run()
}

```

### Core Architecture Module: `bindings/uniffi/scripts/finalize-node-package.mjs`
```
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [packageDirectoryArgument] = process.argv.slice(2);
if (packageDirectoryArgument === undefined) {
  throw new Error(
    "usage: node finalize-node-package.mjs <generated-package-directory>",
  );
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const bindingsDirectory = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(bindingsDirectory, "../..");
const packageDirectory = resolve(packageDirectoryArgument);
const packagePath = resolve(packageDirectory, "package.json");
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));

if (packageJson.name !== "@helix-db/helix-db-embedded") {
  throw new Error(
    `unexpected generated package name: ${String(packageJson.name)}`,
  );
}

Object.assign(packageJson, {
  version: "0.3.3",
  description:
    "Embedded HelixDB runtime and native graph algorithms for the HelixDB JavaScript SDK",
  license: "Apache-2.0",
  homepage: "https://github.com/HelixDB/helix-db",
  repository: {
    type: "git",
    url: "git+https://github.com/HelixDB/helix-db.git",
    directory: "bindings/uniffi",
  },
  bugs: {
    url: "https://github.com/HelixDB/helix-db/issues",
  },
  keywords: ["helixdb", "graph", "vector", "database", "embedded"],
  engines: {
    node: ">=20.0.0",
  },
  types: "./index.d.ts",
  exports: {
    ".": {
      types: "./index.d.ts",
      import: "./index.js",
      default: "./index.js",
    },
  },
  files: ["*.js", "*.d.ts", "runtime", "prebuilds", "README.md", "LICENSE"],
  dependencies: {
    koffi: "3.0.2",
  },
  publishConfig: {
    access: "public",
  },
});

await Promise.all([
  writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`),
  copyFile(
    resolve(bindingsDirectory, "README.node.md"),
    resolve(packageDirectory, "README.md"),
  ),
  copyFile(
    resolve(repositoryRoot, "LICENSE"),
    resolve(packageDirectory, "LICENSE"),
  ),
]);

```

### Core Architecture Module: `bindings/uniffi/smoke-node.mjs`
```
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  Client,
  IndexSpec,
  Projection,
  PropertyValue,
  SourcePredicate,
  VectorDistanceMetric,
  g,
  readBatch,
  writeBatch,
} from "@helix-db/helix-db";

const DATABASE = "node-package-disk-smoke";
const NODE_COUNT = 100;
const EDGE_COUNT = 200;
const BATCH_SIZE = 25;
const VECTOR_RESULT_COUNT = 1;
const VECTOR_SCORE_TOLERANCE = 1e-6;
const root = await mkdtemp(join(tmpdir(), "helixdb-node-package-smoke-"));
const source = { kind: "disk", root, database: DATABASE };

try {
  const writer = await Client.embedded(source);
  const nodeIds = [];
  try {
    const indexNames = [
      "node_equality",
      "node_range",
      "edge_equality",
      "edge_range",
      "node_text",
      "edge_text",
      "node_vector",
      "edge_vector",
    ];
    const indexResponse = await execute(
      writer,
      writeBatch()
        .varAs(
          "node_equality",
          g().createIndexIfNotExists(
            IndexSpec.nodeEquality("Document", "category"),
          ),
        )
        .varAs(
          "node_range",
          g().createIndexIfNotExists(IndexSpec.nodeRange("Document", "rank")),
        )
        .varAs(
          "edge_equality",
          g().createIndexIfNotExists(
            IndexSpec.edgeEquality("REFERENCES", "kind"),
          ),
        )
        .varAs(
          "edge_range",
          g().createIndexIfNotExists(
            IndexSpec.edgeRange("REFERENCES", "weight"),
          ),
        )
        .varAs(
          "node_text",
          g().createIndexIfNotExists(IndexSpec.nodeText("Document", "body")),
        )
        .varAs(
          "edge_text",
          g().createIndexIfNotExists(IndexSpec.edgeText("REFERENCES", "note")),
        )
        .varAs(
          "node_vector",
          g().createIndexIfNotExists(
            IndexSpec.nodeVector(
              "Document",
              "embedding",
              4,
              VectorDistanceMetric.Cosine,
            ),
          ),
        )
        .varAs(
          "edge_vector",
          g().createIndexIfNotExists(
            IndexSpec.edgeVector(
              "REFERENCES",
              "embedding",
              4,
              VectorDistanceMetric.Cosine,
            ),
          ),
        )
        .returning(indexNames),
      "create_package_smoke_indexes",
    );
    for (const name of indexNames) {
      await awaitIndexOperation(writer, indexResponse[name]);
    }

    for (let start = 0; start < NODE_COUNT; start += BATCH_SIZE) {
      let batch = writeBatch();
      const names = [];
      for (
        let index = start;
        index < Math.min(start + BATCH_SIZE, NODE_COUNT);
        index += 1
      ) {
        const name = `document_${index}`;
        const category = ["science", "history", "engineering", "literature"][
          index % 4
        ];
        const body =
          index % 10 === 0
            ? `Helix graph database vector search document ${index}`
            : index % 2 === 0
              ? `Distributed graph storage and indexing document ${index}`
              : `Transactional database systems document ${index}`;
        batch = batch.varAs(
          name,
          g()
            .addN("Document", {
              body,
              category,
              doc_id: `doc-${String(index).padStart(3, "0")}`,
              embedding: PropertyValue.f32Array(oneHot(index)),
              rank: BigInt(index),
            })
            .valueMap(["$id"]),
        );
        names.push(name);
      }
      const response = await execute(
        writer,
        batch.returning(names),
        `insert_package_smoke_nodes_${start}`,
      );
      for (const name of names) {
        const row = Array.isArray(response[name])
          ? response[name][0]
          : response[name];
        assert.notEqual(
          row?.$id,
          undefined,
          `${name} should return its node ID`,
        );
        nodeIds.push(row.$id);
      }
    }

    for (let index = 0; index < NODE_COUNT; index += 1) {
      await execute(
        writer,
        writeBatch()
          .varAs(
            `reference_${index}`,
            g()
              .n(nodeIds[index])
              .addE("REFERENCES", nodeIds[(index + 1) % NODE_COUNT], {
                embedding: PropertyValue.f32Array(oneHot(index)),
                kind: index % 2 === 0 ? "citation" : "reference",
                note:
                  index % 10 === 0
                    ? "helix graph connection"
                    : "database relation",
                weight: BigInt(index),
              }),
          )
          .returning([]),
        `insert_package_smoke_reference_edge_${index}`,
      );
      await execute(
        writer,
        writeBatch()
          .varAs(
            `similar_${index}`,
            g()
              .n(nodeIds[index])
              .addE("REFERENCES", nodeIds[(index + 7) % NODE_COUNT], {
                embedding: PropertyValue.f32Array(oneHot(index + 1)),
                kind: "similar",
                note:
                  index % 10 === 0
                    ? "semantic vector neighbor"
                    : "related document",
                weight: BigInt(100 + index),
              }),
          )
          .returning([]),
        `insert_package_smoke_similar_edge_${index}`,
      );
    }
  } finally {
    await writer.close();
  }

  const reader = await Client.embeddedReader(source);
  try {
    const response = await execute(
      reader,
      readBatch()
        .varAs("node_count", g().nWithLabel("Document").count())
        .varAs("edge_count", g().eWithLabel("REFERENCES").count())
        .varAs(
          "node_equality",
          g()
            .nWithLabelWhere(
              "Document",
              SourcePredicate.eq("category", "science"),
            )
            .count(),
        )
        .varAs(
          "node_range",
          g()
            .nWithLabelWhere("Document", SourcePredicate.gte("rank", 90n))
            .count(),
        )
        .varAs(
          "edge_equality",
          g()
            .eWithLabelWhere(
              "REFERENCES",
              SourcePredicate.eq("kind", "citation"),
            )
            .count(),
        )
        .varAs(
          "edge_range",
          g()
            .eWithLabelWhere("REFERENCES", SourcePredicate.gte("weight", 190n))
            .count(),
        )
        .varAs(
          "node_text",
          g()
            .textSearchNodes("Document", "body", "helix graph", 10)
            .valueMap(["doc_id", "$distance"]),
        )
        .varAs(
          "edge_text",
          g()
            .textSearchEdges("REFERENCES", "note", "helix graph", 10)
            .edgeProperties(),
        )
        .returning([
          "node_count",
          "edge_count",
          "node_equality",
          "node_range",
          "edge_equality",
          "edge_range",
          "node_text",
          "edge_text",
        ]),
      "search_package_smoke_indexes_after_reopen",
    );
    assert.equal(Number(response.node_count), NODE_COUNT);
    assert.equal(Number(response.edge_count), EDGE_COUNT);
    assert.equal(Number(response.node_equality), 25);
    assert.equal(Number(response.node_range), 10);
    assert.equal(Number(response.edge_equality), 50);
    assert.equal(Number(response.edge_range), 10);
    assert.equal(response.node_text.length, 10);
    assert.equal(response.edge_text.length, 10);

    for (let dimension = 0; dimension < 4; dimension += 1) {
      const query = oneHot(dimension);
      const vectorResponse = await execute(
        reader,
        readBatch()
          .varAs(
            "nodes",
            g()
              .vectorSearchNodes(
                "Document",
                "embedding",
                query,
                VECTOR_RESULT_COUNT,
 
```

### Core Architecture Module: `bindings/uniffi/smoke.py`
```
"""Installed-wheel smoke test for the embedded Python runtime."""

from __future__ import annotations

import importlib.metadata

import helixdb_uniffi
from helixdb import (
    Client,
    FoundPath,
    GraphSelection,
    IdentitySelection,
    InMemory,
    NodeRef,
    QueryRequest,
    g,
    write_batch,
)


assert importlib.metadata.version("helix-db") == "0.3.4"
assert importlib.metadata.version("helix-db-embedded") == "0.3.3"
for name in (
    "HelixDb",
    "HelixDbSource",
    "NativeGraph",
    "NativeGraphLoadSpec",
    "graph_from_query_response",
):
    assert hasattr(helixdb_uniffi, name), name

client = Client.embedded(InMemory("python-wheel-smoke"))
try:
    request = QueryRequest.write(
        write_batch()
        .var_as("alice", g().add_n("WheelUser", {"externalId": "alice"}))
        .var_as("bob", g().add_n("WheelUser", {"externalId": "bob"}))
        .var_as(
            "follows",
            g().n(NodeRef.var("alice")).add_e("FOLLOWS", NodeRef.var("bob")),
        )
        .returning(["alice", "bob", "follows"])
    )
    response = client.query(request)
    assert set(response) == {"alice", "bob", "follows"}

    graph = client.graph(
        GraphSelection(
            node_traversal=g().n_with_label("WheelUser"),
            edge_traversal=g().e_with_label("FOLLOWS"),
            kind="digraph",
            node_identity=IdentitySelection.scalar_property("externalId"),
        )
    )
    assert graph.node_count == 2
    assert graph.edge_count == 1
    assert graph.successors("alice") == ("bob",)
    path = graph.shortest_path("alice", "bob", direction="out")
    assert isinstance(path, FoundPath)
    assert path.node_ids == ("alice", "bob")
finally:
    client.close()

```

### Core Architecture Module: `bindings/uniffi/src/bin/uniffi_bindgen.rs`
```
fn main() {
    uniffi::uniffi_bindgen_main()
}

```

### Core Architecture Module: `bindings/uniffi/src/error.rs`
```
//! Stable UniFFI error categories for database failures.
//!
//! This module is the contract boundary between detailed Rust database errors
//! and the smaller error vocabulary exposed to foreign-language callers.
//! Configuration and request mistakes remain actionable to the caller, while
//! corrupt persisted vector rows and fail-closed lifecycle cutover states are
//! reported as internal failures. Query planning failures surface as `Planner`
//! and keep the planner's own error code.

use db::encoding::error::EncodingError;
use db::error::HelixDbError;
use helix_ast::error_code;
use thiserror::Error;

/// Error type returned by the HelixDB UniFFI bindings.
#[derive(Debug, Error, uniffi::Error)]
pub enum HelixError {
    /// Invalid configuration.
    #[error("{msg}")]
    InvalidConfig { error: String, msg: String },

    /// Invalid request body or API usage.
    #[error("{msg}")]
    InvalidRequest { error: String, msg: String },

    /// Query planning failed.
    #[error("{msg}")]
    Planner { error: String, msg: String },

    /// Storage failed.
    #[error("{msg}")]
    Storage { error: String, msg: String },

    /// Transaction failed.
    #[error("{msg}")]
    Transaction { error: String, msg: String },

    /// Internal failure.
    #[error("{msg}")]
    Internal { error: String, msg: String },
}

impl From<HelixDbError> for HelixError {
    /// Classifies a detailed database error without exposing Rust-only payload types.
    ///
    /// The original display message is retained for diagnostics. The category
    /// distinguishes caller-correctable vector configuration/input and active-text
    /// admission failures from invalid stored vector rows, which indicate an internal invariant
    /// violation rather than malformed foreign-language API usage. Retryable
    /// request-view changes remain transaction failures so foreign callers can
    /// apply the same retry policy as a storage transaction conflict.
    fn from(error: HelixDbError) -> Self {
        let error_code = error.error_code().to_string();
        let msg = error.to_string();
        if error.is_invalid_input() {
            return Self::InvalidRequest {
                error: error_code,
                msg,
            };
        }
        match error {
            HelixDbError::Config(_)
            | HelixDbError::InvalidVectorConfig(_)
            | HelixDbError::IndexDefinitionConflict { .. } => Self::InvalidConfig {
                error: error_code,
                msg,
            },
            HelixDbError::Planner(_) => Self::Planner {
                error: error_code,
                msg,
            },
            HelixDbError::Query(_)
            | HelixDbError::InvalidQueryJson(_)
            | HelixDbError::Encoding(EncodingError::InvalidTenantId(_))
            | HelixDbError::IndexBusy { .. }
            | HelixDbError::IndexOperationNotFound { .. }
            | HelixDbError::IndexOperationNotAbortable { .. }
            | HelixDbError::ActiveTextMutationLimitExceeded { .. }
            | HelixDbError::InvalidIndexSourceData { .. }
            | HelixDbError::SecondaryIndexValue(_)
            | HelixDbError::SecondaryLifecycleSteppingRequiresDisabledMode
            | HelixDbError::MigrationSteppingRequiresDisabledMode => Self::InvalidRequest {
                error: error_code,
                msg,
            },
            HelixDbError::WriterModeRequired { .. } | HelixDbError::ReaderModeRequired { .. } => {
                Self::InvalidRequest {
                    error: error_code,
                    msg,
                }
            }
            HelixDbError::TransactionConflict(_)
            | HelixDbError::RequestReadViewChanged
            | HelixDbError::StaleIndexGeneration { .. } => Self::Transaction {
                error: error_code,
                msg,
            },
            HelixDbError::Storage(_)
            | HelixDbError::ObjectStore(_)
            | HelixDbError::DatabaseClosed => Self::Storage {
                error: error_code,
                msg,
            },
            HelixDbError::Encoding(_)
            | HelixDbError::InvalidNodeId(_)
            | HelixDbError::NodeNotFound(_)
            | HelixDbError::EdgeNotFound { .. }
            | HelixDbError::IndexAlreadyExists(_)
            | HelixDbError::IndexNotFound(_)
            | HelixDbError::UniqueConstraintViolation { .. }
            | HelixDbError::UnsupportedUniqueIndexValueType { .. }
            | HelixDbError::InvalidDimension { .. }
            | HelixDbError::InvalidVectorComponent { .. }
            | HelixDbError::VectorComponentMagnitudeExceeded { .. }
            | HelixDbError::ZeroNormCosineVector
            | HelixDbError::InvalidVectorItem(_)
            | HelixDbError::IndexLifecycleUnavailable { .. }
            | HelixDbError::InvalidIndexV2Model(_)
            | HelixDbError::WriterFencedCommitOutcomeUnknown
            | HelixDbError::MigrationRequired { .. }
            | HelixDbError::WriterMigrationRequired { .. }
            | HelixDbError::UnsupportedIndexStorageVersion { .. }
            | HelixDbError::IdentifierExhausted(_)
            | HelixDbError::IdentifierAllocationFailed { .. }
            | HelixDbError::IndexCatalogCorruption(_)
            | HelixDbError::LegacyZeroNormCosineVector { .. }
            | HelixDbError::QueryDeadlineExceeded
            | HelixDbError::QueryCancelledByReaderRetirement
            | HelixDbError::InvariantViolation(_) => Self::Internal {
                error: error_code,
                msg,
            },
        }
    }
}

impl From<tokio::task::JoinError> for HelixError {
    /// Converts a failed binding-runtime task without unwinding across FFI.
    fn from(error: tokio::task::JoinError) -> Self {
        Self::Internal {
            error: error_code::QueryErrorCode::InternalError.to_string(),
            msg: format!("embedded runtime task failed: {error}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use db::error::SecondaryIndexValueError;
    use db::search::vector::{VectorConfigError, VectorDistanceMetric, VectorItemDecodeError};

    use super::*;

    #[test]
    fn vector_errors_preserve_caller_vs_storage_ownership() {
        assert!(matches!(
            HelixError::from(HelixDbError::InvalidVectorConfig(
                VectorConfigError::EmptyIndexName
            )),
            HelixError::InvalidConfig { .. }
        ));
        assert!(matches!(
            HelixError::from(HelixDbError::InvalidDimension {
                expected: 3,
                got: 2,
            }),
            HelixError::InvalidRequest { .. }
        ));
        assert!(matches!(
            HelixError::from(HelixDbError::InvalidVectorComponent { index: 0 }),
            HelixError::InvalidRequest { .. }
        ));
        assert!(matches!(
            HelixError::from(HelixDbError::VectorComponentMagnitudeExceeded {
                metric: VectorDistanceMetric::Euclidean,
                dimension: 3,
                component_index: 1,
                observed_magnitude: 4.0,
                inclusive_maximum: 3.0,
            }),
            HelixError::InvalidRequest { .. }
        ));
        assert!(matches!(
            HelixError::from(HelixDbError::ZeroNormCosineVector),
            HelixError::InvalidRequest { .. }
        ));
        assert!(matches!(
            HelixError::from(HelixDbError::InvalidVectorItem(
                VectorItemDecodeError::HeaderMismatch
            )),
            HelixError::Internal { .. }
        ));
    }

    #[test]
    fn request_read_view_changes_are_retryable_transaction_failures() {
        assert!(matches!(
            HelixError::from(HelixDbError::RequestReadViewChanged),
            HelixError::Transaction { .. }
        ));
    }

    #[test]
    fn query_deadlines_do_not_expand_the_stable_binding_error_contract() {
        assert!(matches!(
            HelixError::from(HelixDbError::QueryDeadlineExceeded),
       
```

### Core Architecture Module: `bindings/uniffi/src/graph.rs`
```
//! FFI-safe façade over the storage-independent Rust graph crate.

use std::collections::{BTreeMap, BTreeSet};
use std::num::NonZeroUsize;
use std::sync::Arc;

use helix_graph_algorithms as core;
use thiserror::Error;

/// Errors returned by native graph loading and algorithms.
#[derive(Debug, Error, uniffi::Error)]
pub enum NativeGraphError {
    /// The normal query response did not match the graph projection contract.
    #[error("{message}")]
    InvalidResponse { message: String },
    /// A configured node or edge limit proved the selection incomplete.
    #[error("graph selection exceeded the {kind} safety limit of {limit}")]
    IncompleteSelection { kind: String, limit: u64 },
    /// External node identities were not unique.
    #[error("duplicate external node identity: {identity}")]
    DuplicateIdentity { identity: String },
    /// Graph metadata selection returned more than one row.
    #[error("graph metadata selection returned {count} rows; expected at most one")]
    MultipleGraphMetadataRows { count: u64 },
    /// A requested node or edge was not loaded.
    #[error("{message}")]
    UnknownEntity { message: String },
    /// An algorithm option was invalid at the FFI boundary.
    #[error("{message}")]
    InvalidOption { message: String },
    /// The underlying normal Helix query failed.
    #[error("{message}")]
    Query { message: String },
    /// Graph topology validation failed.
    #[error("{message}")]
    InvalidGraph { message: String },
}

impl NativeGraphError {
    fn invalid(message: impl Into<String>) -> Self {
        Self::InvalidOption {
            message: message.into(),
        }
    }
}

impl From<core::GraphError> for NativeGraphError {
    fn from(error: core::GraphError) -> Self {
        let message = error.to_string();
        match error {
            core::GraphError::UnknownNode(_) | core::GraphError::UnknownEdge(_) => {
                Self::UnknownEntity { message }
            }
            core::GraphError::InvalidOption(_) => Self::InvalidOption { message },
            core::GraphError::EmptyEdgeId
            | core::GraphError::DuplicateNode(_)
            | core::GraphError::DuplicateEdge(_)
            | core::GraphError::MissingEndpoint { .. }
            | core::GraphError::InvalidWeight { .. }
            | core::GraphError::InvalidExternalId(_)
            | core::GraphError::ParallelEdge { .. }
            | core::GraphError::RelabelCollision { .. }
            | core::GraphError::KindMismatch
            | core::GraphError::ConflictingEdge { .. }
            | core::GraphError::EdgeIdentityExhausted { .. } => Self::InvalidGraph { message },
        }
    }
}

impl From<core::loader::GraphLoadError> for NativeGraphError {
    fn from(error: core::loader::GraphLoadError) -> Self {
        match error {
            core::loader::GraphLoadError::InvalidResponse(message) => {
                Self::InvalidResponse { message }
            }
            invalid @ core::loader::GraphLoadError::InvalidRow { .. } => Self::InvalidResponse {
                message: invalid.to_string(),
            },
            core::loader::GraphLoadError::IncompleteSelection { kind, limit } => {
                Self::IncompleteSelection {
                    kind: kind.to_string(),
                    limit: u64::try_from(limit).expect("usize fits in u64"),
                }
            }
            core::loader::GraphLoadError::DuplicateExternalIdentity(identity) => {
                Self::DuplicateIdentity {
                    identity: identity.to_string(),
                }
            }
            core::loader::GraphLoadError::MultipleGraphMetadataRows { count } => {
                Self::MultipleGraphMetadataRows {
                    count: u64::try_from(count).expect("usize fits in u64"),
                }
            }
            core::loader::GraphLoadError::Graph(error) => error.into(),
        }
    }
}

/// Declared graph topology contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum NativeGraphKind {
    Graph,
    DiGraph,
    MultiGraph,
    MultiDiGraph,
}

impl From<NativeGraphKind> for core::GraphKind {
    fn from(kind: NativeGraphKind) -> Self {
        match kind {
            NativeGraphKind::Graph => Self::Graph,
            NativeGraphKind::DiGraph => Self::DiGraph,
            NativeGraphKind::MultiGraph => Self::MultiGraph,
            NativeGraphKind::MultiDiGraph => Self::MultiDiGraph,
        }
    }
}

/// JSON representation used for a projected external identity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, uniffi::Enum)]
pub enum NativeIdentityEncoding {
    Scalar,
    Tagged,
}

/// Canonically tagged external identity bytes.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct NativeExternalId {
    pub encoded: Vec<u8>,
}

/// Canonically encoded structural edge identity.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct NativeEdgeId {
    pub encoded: Vec<u8>,
}

/// Response-validation metadata supplied by an SDK graph selection.
#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeGraphLoadSpec {
    /// Declared graph topology contract.
    pub kind: NativeGraphKind,
    /// Projected node identity representation.
    pub node_identity: NativeIdentityEncoding,
    /// Optional projected Graphify key representation.
    pub edge_key_identity: Option<NativeIdentityEncoding>,
    /// Maximum complete node result size.
    pub node_limit: Option<u64>,
    /// Maximum complete edge result size.
    pub edge_limit: Option<u64>,
}

/// Immutable node record. Attributes remain lazy JSON bytes.
#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeGraphNode {
    /// External node identity.
    pub id: NativeExternalId,
    /// Optional Helix label.
    pub label: Option<String>,
    /// Selected properties encoded as one JSON object.
    pub attributes_json: Vec<u8>,
}

/// Immutable edge record. Attributes remain lazy JSON bytes.
#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeGraphEdge {
    /// Stable Helix edge identity.
    pub id: NativeEdgeId,
    /// Optional Graphify multigraph key.
    pub graphify_key: Option<NativeExternalId>,
    /// Stored source external node identity.
    pub source: NativeExternalId,
    /// Stored target external node identity.
    pub target: NativeExternalId,
    /// Optional Helix label.
    pub label: Option<String>,
    /// Optional algorithm weight.
    pub weight: Option<f64>,
    /// Selected properties encoded as one JSON object.
    pub attributes_json: Vec<u8>,
}

/// Exact, sampled, or Graphify-compatible automatic Brandes mode.
#[derive(Debug, Clone, uniffi::Enum)]
pub enum NativeBetweennessMode {
    /// Use every node as a source.
    Exact,
    /// Use a deterministic unique source sample.
    Sampled { sample_count: u64, seed: u64 },
    /// Select exact/sample mode from graph size.
    Auto {
        exact_through: u64,
        sample_count: u64,
        seed: u64,
    },
}

/// Brandes algorithm options.
#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeBetweennessOptions {
    /// Source-selection mode.
    pub mode: NativeBetweennessMode,
    /// Apply NetworkX-compatible normalization.
    pub normalized: bool,
    /// Include endpoints for node centrality.
    pub endpoints: bool,
    /// Use the selected edge weight rather than unit costs.
    pub weighted: bool,
}

/// One node centrality score.
#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeNodeScore {
    pub node_id: NativeExternalId,
    pub score: f64,
}

/// One stable edge centrality score.
#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeEdgeScore {
    pub edge_id: NativeEdgeId,
    pub graphify_key: Option<NativeExternalId>,
    pub source: NativeExternalId,
    pub target: NativeExternalId,
    pub score: f64,
}

/// Bounded simple cycle.
#[derive(Debug, Clone, uniffi::Record)]
pub struct NativeCycle {
    pub node_ids: Vec<NativeExternalId>,
    pub edge_
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #944** (2026-07-08): **[Bug]: helix update installs wrong version**
  *Symptoms*: ### What happened?  ```bash PS C:\web projects\my-helix-app> helix update    Updating 'CLI'   ✓ Checked for updates (v3.0.6 -> v3.0.7)   ⠸ Downloading and installing   ✓ Downloaded and installed  Updated 'CLI' successfully ────────────────────────────────   • Note: Please restart your terminal to use the new version PS C:\web projects\my-helix-app> helix --version Helix CLI 3.0.6 PS C:\web projects\my-helix-app> helix update    Updating 'CLI'   ✓ Checked for updates (v3.0.6 -> v3.0.7)   ⠼ Downloading and installing   ✓ Downloaded and installed  Updated 'CLI' successfully ────────────────────────────────   • Note: Please restart your terminal to use the new version PS C:\web projects\my-helix-app> helix --version Helix CLI 3.0.6 PS C:\web projects\my-helix-app>  ```  ### Steps to reproduce  1. Start helix update locally in Windows... 2. Run `helix update` 3. The version installed is still 3.06, not 3.07.  ### Version  3.06 ---> trying to upgrade  ### Environment  Self-hosted  ### Relevant log output  ```shell  ```  ### Additional context  It does look like `  ⠼ Downloading and installing` was never resolved.  _No response_
  **Post-Mortem & Fix Analysis**:
  > Ah I think this will just be the cargo package version. You will be using the 3.0.7 binary but that binary's cargo version hasn't been updated to 3.0.7 and has been left as 3.0.6 will update to 3.0.8 for the next one 
  > Ok, I think there is a `node` detection bug in 3.06...  ```bash PS C:\web projects\my-helix-app> helix --version Helix CLI 3.0.6 PS C:\web projects\my-helix-app> helix query dev -e 'readBatch().returning([])' error: Node.js is required to run TypeScript queries     = help: install Node.js 20+ to use -e/--ts/--ts-file, or pass JSON with --json/--file PS C:\web projects\my-helix-app> node -v                                                          v24.12.0 PS C:\web projects\my-helix-app>  ``` Any work arounds in the mean time?  J
  > This link has wrong version too? Anywhere to properly download `3.07`?  https://github.com/HelixDB/helix-db/releases/download/v3.0.7/helix-x86_64-pc-windows-msvc.exe  J

- **Issue #876** (2026-03-05): **[Bug]: helix init clears .gitignore**
  *Symptoms*: ### What happened?  After running `helix init`, .gitignore is wiped and overwritten when really this should be an additive procedure  ### Steps to reproduce  Run `helix init` in a folder with a non-empty `.gitignore`  ### Version  2.3.0  ### Environment  Self-hosted  ### Relevant log output  ```shell  ```  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > fixing 

- **Issue #864** (2026-03-08): **[Bug]: UpsertN ignores and overwrites default values.**
  *Symptoms*: ### What happened?  Given an example schema where the created_at property should have a default value: ``` N::EmailAddress {     UNIQUE INDEX email_address: String,     created_at: Date DEFAULT NOW, }  E::EmailAddressOneTimePassword UNIQUE {     From: EmailAddress,     To: OneTimePassword, }  N::OneTimePassword {     UNIQUE INDEX hash: String,     expires_at: Date,     created_at: Date DEFAULT NOW, } ```  And a query that upserts the email_address if it does not exist: ``` QUERY UpsertEmailOneTimePassword(email: String, hash: String, expires_at: Date) =>     existing <- N<EmailAddress>::WHERE(_::{email_address}::EQ(email))     email_address <- existing::UpsertN({email_address: email})     DROP email_address::Out<EmailAddressOneTimePassword>     one_time_password <- AddN<OneTimePassword>({         hash: hash,         expires_at: expires_at,     })     email_one_time_password <- AddE<EmailAddressOneTimePassword>::From(email_address)::To(one_time_password)     RETURN email_address, one_time_password ```  Calling this query will execute and return the response with the email_address `created_at` property, which is expected to have a default in insert, with null. ``` 2026-02-15T05:18:13.260373Z  INFO helix_db::helix_gateway::gateway: Response query=UpsertEmailOneTimePassword response={"email_address":{"email_address":"test@test.com","label":"EmailAddress","id":"1f10a1fb-9742-6d2d-9910-010203040506","created_at":null},"one_time_password":{"expires_at":"2026-02-15T05:23:12.012+00:00
  **Post-Mortem & Fix Analysis**:
  > on this!
  > found fix, implementing now

- **Issue #835** (2026-01-29): **BUG: Variable bindings and map variables not appearing in inline RETURN objects**
  *Symptoms*: # Variable bindings and map variables not appearing in inline RETURN objects  ## Summary  When returning inline objects from queries, variable bindings and map iteration variables are not included in the response, even when explicitly specified in the RETURN statement.  ## Reproduction  ### Schema ``` N::User {     INDEX username: String,     INDEX phone_number: String,     INDEX email: String,     name: String,     pfp_url: String,     is_admin: Boolean DEFAULT false,     is_verified: Boolean DEFAULT false,     is_onboarded: Boolean DEFAULT false,     created_at: Date DEFAULT NOW,     updated_at: Date DEFAULT NOW, }  E::UserToUserFollow {     From: User,     To: User,     Properties: {         since: Date DEFAULT NOW,     } } ```  ### Issue 1: Variable bindings missing from inline RETURN objects  **Query:** ```helix QUERY GetUserWithFollowers (user_id: ID) =>     user <- N<User>(user_id)     followers <- user::In<UserToUserFollow>::RANGE(0, 50)::{id, username}     follower_count <- user::In<UserToUserFollow>::COUNT     RETURN {         user: user,         follower_count: follower_count,         followers: followers     } ```  **Expected response:** ```json {   "user": { "id": "...", "username": "user_1", ... },   "follower_count": 19,   "followers": [{ "id": "...", "username": "user_2" }, ...] } ```  **Actual response:** ```json {   "user": { "id": "...", "username": "user_1", ... },   "followers": [{ "id": "...", "username": "...", "email": "...", ... }] } ```  **Problems:*

- **Issue #818** (2026-01-23): **bug (hql): rust generation failure - error[E0308]: mismatched types**
  *Symptoms*: ## Environment - Helix CLI version: 2.2.4 - OS: macos  ## Error Output ``` failed to solve: process "/bin/sh -c cargo build --features dev --package helix-container" did not complete successfully: exit code: 101  #0 building with "desktop-linux" instance using docker driver  #1 [app internal] load build definition from Dockerfile #1 transferring dockerfile: 1.54kB done #1 DONE 0.0s  #2 [app internal] load metadata for docker.io/lukemathwalker/cargo-chef:latest-rust-1.88 #2 ...  #3 [app internal] load metadata for docker.io/library/debian:bookworm-slim #3 DONE 0.8s  #2 [app internal] load metadata for docker.io/lukemathwalker/cargo-chef:latest-rust-1.88 #2 DONE 0.8s  #4 [app internal] load .dockerignore #4 transferring context: 2B done #4 DONE 0.0s  #5 [app stage-3 1/5] FROM docker.io/library/debian:bookworm-slim@sha256:56ff6d36d4eb3db13a741b342ec466f121480b5edded42e4b7ee850ce7a418ee #5 resolve docker.io/library/debian:bookworm-slim@sha256:56ff6d36d4eb3db13a741b342ec466f121480b5edded42e4b7ee850ce7a418ee 0.0s done #5 DONE 0.0s  #6 [app chef 1/5] FROM docker.io/lukemathwalker/cargo-chef:latest-rust-1.88@sha256:50ae19f263d8a4bed1769c22ac929497ac9fa1d7fbc7288c277fa2f07f0aa85c #6 resolve docker.io/lukemathwalker/cargo-chef:latest-rust-1.88@sha256:50ae19f263d8a4bed1769c22ac929497ac9fa1d7fbc7288c277fa2f07f0aa85c 0.0s done #6 DONE 0.0s  #7 [app internal] load build context #7 transferring context: 159.73kB 0.0s done #7 DONE 0.1s  #8 [app chef 2/5] WORKDIR /build #8 CACHED  #9 [app che
  **Post-Mortem & Fix Analysis**:
  > on it

- **Issue #813** (2026-01-19): **bug (hql): rust generation failure - error[E0425]: cannot find value `val` in this scope**
  *Symptoms*: ## Environment - Helix CLI version: 2.2.2 - OS: macos  ## Error Output ``` failed to solve: process "/bin/sh -c cargo build  --package helix-container" did not complete successfully: exit code: 101  #0 building with "desktop-linux" instance using docker driver  #1 [app internal] load build definition from Dockerfile #1 transferring dockerfile: 1.51kB done #1 DONE 0.0s  #2 [app internal] load metadata for docker.io/lukemathwalker/cargo-chef:latest-rust-1.88 #2 ...  #3 [app internal] load metadata for docker.io/library/debian:bookworm-slim #3 DONE 0.8s  #2 [app internal] load metadata for docker.io/lukemathwalker/cargo-chef:latest-rust-1.88 #2 DONE 0.8s  #4 [app internal] load .dockerignore #4 transferring context: 2B done #4 DONE 0.0s  #5 [app chef 1/5] FROM docker.io/lukemathwalker/cargo-chef:latest-rust-1.88@sha256:50ae19f263d8a4bed1769c22ac929497ac9fa1d7fbc7288c277fa2f07f0aa85c #5 resolve docker.io/lukemathwalker/cargo-chef:latest-rust-1.88@sha256:50ae19f263d8a4bed1769c22ac929497ac9fa1d7fbc7288c277fa2f07f0aa85c 0.0s done #5 DONE 0.0s  #6 [app stage-3 1/5] FROM docker.io/library/debian:bookworm-slim@sha256:56ff6d36d4eb3db13a741b342ec466f121480b5edded42e4b7ee850ce7a418ee #6 resolve docker.io/library/debian:bookworm-slim@sha256:56ff6d36d4eb3db13a741b342ec466f121480b5edded42e4b7ee850ce7a418ee 0.0s done #6 DONE 0.0s  #7 [app internal] load build context #7 transferring context: 151.01kB 0.0s done #7 DONE 0.0s  #8 [app chef 3/5] RUN apt-get update && apt-get install -y     pkg-co

- **Issue #804** (2026-01-14): **[Bug]: Parse error when using  ::WHERE(_.distance::GT(min_score)) after SearchV in query chain**
  *Symptoms*: ### What happened?  I basically testing this query https://docs.helix-db.com/documentation/hql/rerankers/rerank-rrf#combining-with-other-operations  and i get this error after running helix check  ```cmd > helix check [CHECK] Checking all instances [CHECK] Checking instance 'dev' [SYNTAX] Validating query syntax... Parse error: Parse error:   --> 83:18    | 83 |         ::WHERE(_.distance::GT(min_score))    |                  ^---    | ```  ### Steps to reproduce  QUERY AdvancedSearch(query_vec: [F64], min_score: F64) =>     results <- SearchV<Document>(query_vec, 200)         ::WHERE(_.distance::GT(min_score))  // Filter first         ::RerankRRF()                        // Then rerank         ::RANGE(0, 20)                       // Finally limit     RETURN results  run helix check  ### Version  2.2.1  ### Environment  Self-hosted  ### Relevant log output  ```shell  ```  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > this is because you're doing   `_.distance`  it should be  `::WHERE(_::{distance}::GT(min_score))`

- **Issue #801** (2026-01-19): **HNSW vector search returns 'no entry point found' after storing vectors**
  *Symptoms*: ## Bug Description  After storing vectors in HelixDB and attempting to perform vector similarity search, the search fails with:  ``` {"error":"Vector error: no entry point found for hnsw index","code":"GRAPH_ERROR"} ```  This occurs even after successfully storing hundreds of vectors. The HNSW index appears to not be initialized or the entry point is not being set.  ## Environment  - **Helix Version**: v2.2.0 - **OS**: Linux (Arch Linux 6.17.9) - **Docker**: Yes (local deployment via `helix push dev`) - **Python Client**: helix-py  ## Steps to Reproduce  1. Initialize fresh HelixDB instance: ```bash helix stop dev rm -rf .helix/.volumes/dev helix push dev ```  2. Define vector schema in `schema.hx`: ``` V::ChunkVector {     model_name: String,     embedding_dim: U32, } ```  3. Define search query in `queries.hx`: ``` SearchSimilar(query_vec: [F32], top_k: U64) =>     MATCH (v:ChunkVector)     WHERE v.embedding <COSINE_SIMILARITY> $query_vec     RETURN v     ORDER BY SCORE DESC     LIMIT $top_k ```  4. Store vectors via Python client (651 vectors with 1536 dimensions from OpenAI embeddings)  5. Attempt vector search: ```python from helix import Client client = Client(local=True, port=6969) results = client.run(SearchSimilar(query_vec=[...], top_k=3)) ```  ## Expected Behavior  Vector search should return the top-k most similar vectors.  ## Actual Behavior  Search fails with HTTP 500: ```json {"error":"Vector error: no entry point found for hnsw index","code":"GRAPH_ERROR"} ```
  **Post-Mortem & Fix Analysis**:
  > Looking into this now
  > this hql query is not valid? are you sure you are running this:<br><br>SearchSimilar(query_vec: \[F32\], top_k: U64) =>     MATCH (v:ChunkVector)     WHERE v.embedding <COSINE_SIMILARITY> $query_vec     RETURN v     ORDER BY SCORE DESC     LIMIT $top_k
  > Apologies, I included incorrect query syntax in my initial report. Here's the actual query from our `queries.hx`:  ```hql QUERY SearchSimilar(query_vec: [F64], top_k: U32) =>     results <- SearchV<ChunkVector>(query_vec, top_k)     RETURN results ```  And the vector type definition in `schema.hx`:  ```hql V::ChunkVector {     model_name: String,     embedding_dim: U32, } ```  The Python code calling this:  ```python from src.storage.queries import SearchSimilarChunks # ...  results = self.client.run(SearchSimilarChunks(query_vec=query_embedding, top_k=top_k)) ```  The error occurs when calling `SearchV<ChunkVector>` after storing vectors. Is there something wrong with how we're using `SearchV`?

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

### Incident Patch 1: `41eaad67` (2026-09-30)
**Commit Message**: fix(docs): hand off visitors opened from the context menu

Opening a HelixDB link in a new tab from the context menu fires neither
click nor auxclick, so that visit arrived without the reader's Databuddy
IDs. Also hand off on contextmenu, and restore each link once the browser
has taken it so the page never keeps the IDs for a later copy or share.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `docs/databuddy.js` (modified, +6/-0)
```diff
@@ -55,9 +55,15 @@
     if (!anonId) return;
     url.searchParams.set("anonId", anonId);
     if (sessionId) url.searchParams.set("sessionId", sessionId);
+    const original = anchor.getAttribute("href");
     anchor.href = url.toString();
+    // The browser has taken the link by the time this runs, so restore it and
+    // leave no IDs in the page for a later copy or share.
+    window.setTimeout(() => anchor.setAttribute("href", original), 0);
   }
 
   document.addEventListener("click", handOff, true);
   document.addEventListener("auxclick", handOff, true);
+  // "Open in new tab" from the context menu fires neither click event.
+  document.addEventListener("contextmenu", handOff, true);
 })();
```

---

### Incident Patch 2: `468914ef` (2026-09-30)
**Commit Message**: ci: fix the DB production coverage job (#1149)

The `DB production thresholds` job has failed on every PR since 09-27.
This makes it pass again. Verified by running the job's own checks
against a full production-coverage report of this branch, and they pass.

**Root cause:** the last coverage refresh (696ebf0e0) measured line
numbers on `4c3df18d0`. It was then rebased onto the 09-27 vector
commits without re-measuring. That left 67 exclusions and 135
dispositions pointing at the wrong lines. The job stopped at that first
check, so nobody saw that 23 new vector lines had no disposition, or
that two scopes had regressed.

```text
main (before)                              this PR
stale exclusions        67  ─ remap ─▶      0
stale dispositions     135  ─ remap ─▶      0
undisposed vector lines 225 ─ remap ─▶     23 ─ tests + 4 exclusions ─▶ 0
```

**Changes**
1. **Remap.** Every entry is mapped from `4c3df18d0` to `main` through
`git diff`. 341 of 344 land exactly on uncovered lines. The other three
sat on rewritten code: two were closing braces that are gone, and one
moved to a platform-gated `u64`→`usize` conversion, which is now
excluded.
2. **Tests** for the paths the 09-27 comm

**File**: `crates/db/src/search/vector/cache/hydration.rs` (modified, +0/-211)
```diff
@@ -406,13 +406,7 @@ mod tests {
     }
 
     use bytes::Bytes;
-    use futures::stream::BoxStream;
     use slatedb::object_store::memory::InMemory;
-    use slatedb::object_store::{
-        path::Path, CopyOptions, GetOptions, GetResult, ListResult, MultipartUpload, ObjectMeta,
-        ObjectStore, PutMultipartOptions, PutOptions, PutPayload, PutResult,
-        Result as ObjectStoreResult,
-    };
     use slatedb::{Db, IsolationLevel};
 
     use super::*;
@@ -1064,211 +1058,6 @@ mod tests {
         assert_eq!(advance.await, 7);
     }
 
-    /// How the gated object store treats reads of compacted SSTs.
-    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
-    enum SstReads {
-        Open,
-        Held,
-    }
-
-    /// In-memory object store that can hold reads of compacted SSTs, so a
-    /// reader load stays in flight while the reader replays newer WAL.
-    #[derive(Debug)]
-    struct GatedSstStore {
-        inner: InMemory,
-        reads: watch::Sender<SstReads>,
-        /// Counts compacted SST reads that found the gate held.
-        held_reads: watch::Sender<usize>,
-    }
-
-    impl std::fmt::Display for GatedSstStore {
-        fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
-            formatter.write_str("gated-sst-memory")
-        }
-    }
-
-    #[async_trait::async_trait]
-    impl ObjectStore for GatedSstStore {
-        async fn put_opts(
-            &self,
-            location: &Path,
-            payload: PutPayload,
-            options: PutOptions,
-        ) -> ObjectStoreResult<PutResult> {
-            self.inner.put_opts(location, payload, options).await
-        }
-
-        async fn put_multipart_opts(
-            &self,
-            location: &Path,
-            options: PutMultipartOptions,
-        ) -> ObjectStoreResult<Box<dyn MultipartUpload>> {
-            self.inner.put_multipart_opts(location, options).await
-        }
-
-        async fn get_opts(
-            &self,
-            location: &Path,
-            options: GetOptions,
-        ) -> ObjectStoreResult<GetResult> {
-            if location.as_ref().contains("/compacted/") {
-                let mut reads = self.reads.subscribe();
-                if *reads.borrow_and_update() == SstReads::Held {
-                    self.held_reads.send_modify(|held| *held += 1);
-                }
-                reads
-                    .wait_for(|reads| *reads == SstReads::Open)
-                    .await
-                    .expect("the gate outlives its store");
-            }
-            self.inner.get_opts(location, options).await
-        }
-
-        fn delete_stream(
-            &self,
-            locations: BoxStream<'static, ObjectStoreResult<Path>>,
-        ) -> BoxStream<'static, ObjectStoreResult<Path>> {
-            self.inner.delete_stream(locations)
-        }
-
-        fn list(&self, prefix: Option<&Path>) -> BoxStream<'static, ObjectStoreResult<ObjectMeta>> {
-            self.inner.list(prefix)
-        }
-
-        async fn list_with_delimiter(
-            &self,
-            prefix: Option<&Path>,
-        ) -> ObjectStoreResult<ListResult> {
-            self.inner.list_with_delimiter(prefix).await
-        }
-
-        async fn copy_opts(
-            &self,
-            from: &Path,
-            to: &Path,
-            options: CopyOptions,
-        ) -> ObjectStoreResult<()> {
-            self.inner.copy_opts(from, to, options).await
-        }
-    }
-
-    #[tokio::test]
-    async fn reader_drops_only_the_load_it_outruns_and_loads_later_targets_fresh() {
-        let path = "vector-cache-reader-outrun";
-        let gate = Arc::new(GatedSstStore {
-            inner: InMemory::new(),
-            reads: watch::Sender::new(SstReads::Open),
-            held_reads: watch::Sender::new(0),
-        });
-        let object_store: Arc<dyn ObjectStore> = Arc::clone(&gate) as Arc<dyn ObjectStore>;
-        let db = Db::builder(path, Arc::clone(&object_store))
-   
```

**File**: `crates/db/tests/production_support/vector/hydration.rs` (modified, +251/-0)
```diff
@@ -1083,10 +1083,261 @@ async fn run_idle_refresh_contracts() {
     db.close().await.unwrap();
 }
 
+/// How the gated object store treats reads of compacted SSTs.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+enum SstReads {
+    Open,
+    Held,
+}
+
+/// In-memory object store that can hold reads of compacted SSTs, so a
+/// reader load stays in flight while the reader replays newer WAL.
+#[derive(Debug)]
+struct GatedSstStore {
+    inner: InMemory,
+    reads: watch::Sender<SstReads>,
+    /// Counts compacted SST reads that found the gate held.
+    held_reads: watch::Sender<usize>,
+}
+
+impl std::fmt::Display for GatedSstStore {
+    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        formatter.write_str("gated-sst-memory")
+    }
+}
+
+#[async_trait::async_trait]
+impl ObjectStore for GatedSstStore {
+    async fn put_opts(
+        &self,
+        location: &Path,
+        payload: PutPayload,
+        options: PutOptions,
+    ) -> ObjectStoreResult<PutResult> {
+        self.inner.put_opts(location, payload, options).await
+    }
+
+    async fn put_multipart_opts(
+        &self,
+        location: &Path,
+        options: PutMultipartOptions,
+    ) -> ObjectStoreResult<Box<dyn MultipartUpload>> {
+        self.inner.put_multipart_opts(location, options).await
+    }
+
+    async fn get_opts(&self, location: &Path, options: GetOptions) -> ObjectStoreResult<GetResult> {
+        if location.as_ref().contains("/compacted/") {
+            let mut reads = self.reads.subscribe();
+            if *reads.borrow_and_update() == SstReads::Held {
+                self.held_reads.send_modify(|held| *held += 1);
+            }
+            reads
+                .wait_for(|reads| *reads == SstReads::Open)
+                .await
+                .expect("the gate outlives its store");
+        }
+        self.inner.get_opts(location, options).await
+    }
+
+    fn delete_stream(
+        &self,
+        locations: BoxStream<'static, ObjectStoreResult<Path>>,
+    ) -> BoxStream<'static, ObjectStoreResult<Path>> {
+        self.inner.delete_stream(locations)
+    }
+
+    fn list(&self, prefix: Option<&Path>) -> BoxStream<'static, ObjectStoreResult<ObjectMeta>> {
+        self.inner.list(prefix)
+    }
+
+    async fn list_with_delimiter(&self, prefix: Option<&Path>) -> ObjectStoreResult<ListResult> {
+        self.inner.list_with_delimiter(prefix).await
+    }
+
+    async fn copy_opts(
+        &self,
+        from: &Path,
+        to: &Path,
+        options: CopyOptions,
+    ) -> ObjectStoreResult<()> {
+        self.inner.copy_opts(from, to, options).await
+    }
+}
+
+/// Proves a reader drops only the load it outruns: while one target's load
+/// waits on a held compacted-SST read, the reader replays newer WAL, so that
+/// load publishes nothing and the next target loads from a fresh snapshot.
+async fn run_reader_outrun_contracts() {
+    let path = "vector-cache-reader-outrun";
+    let gate = Arc::new(GatedSstStore {
+        inner: InMemory::new(),
+        reads: watch::Sender::new(SstReads::Open),
+        held_reads: watch::Sender::new(0),
+    });
+    let object_store: Arc<dyn ObjectStore> = Arc::clone(&gate) as Arc<dyn ObjectStore>;
+    let db = Db::builder(path, Arc::clone(&object_store))
+        .build()
+        .await
+        .unwrap();
+    let scope = DataScope::LegacyUnscoped;
+    let (outrun, outrun_handle) = active_vector(scope, 7, 71, false);
+    let (fresh, fresh_handle) = active_vector(scope, 8, 81, false);
+    let transaction = db.begin(IsolationLevel::Snapshot).await.unwrap();
+    transaction
+        .put(
+            upper_vector_key(scope, 71, 1),
+            Bytes::from_static(b"outrun"),
+        )
+        .unwrap();
+    transaction
+        .put(upper_vector_key(scope, 81, 1), Bytes::from_static(b"fresh"))
+        .unwrap();
+    transaction.commit().await.unwrap();
+    // Both rows live only in a compacted SST, so each load reads throu
```

**File**: `crates/db/tests/production_support/vector/memory_registry.rs` (modified, +2/-0)
```diff
@@ -428,6 +428,8 @@ pub(crate) async fn run() {
     run_retention_contracts().await;
     run_commit_fence_contracts().await;
     run_commit_outcome_contracts().await;
+    // A registry that never saw the identity's scope has nothing to forget.
+    assert!(!VectorCacheRegistry::default().forget_validated_closed(&validated(1)));
     let first = VectorCacheIdentity::from_validated(&validated(1));
     let same = VectorCacheIdentity::from_validated(&validated(1));
     let successor = VectorCacheIdentity::from_validated(&validated(2));
```

**File**: `crates/db/tests/production_support/vector/mutation.rs` (modified, +16/-0)
```diff
@@ -1228,6 +1228,22 @@ async fn run_build_session_limit_contract<D: Distance>() {
     dirty_session.enforce_limits(&measured).unwrap();
     assert_eq!(dirty_session.neighbor_count(), 1);
     assert_eq!(dirty_session.stats().dirty_neighbor_flushes(), 1);
+
+    // A retained session holds only clean rows, so shrinking it evicts
+    // without a transaction.
+    let retained_identity = session_identity(DataScope::LegacyUnscoped, 43);
+    let mut retained =
+        VectorBuildSession::<D>::with_test_limits(NonZeroU64::new(1 << 20).unwrap(), 8, 8, 8);
+    let mut retained_cache = retained.take_cache(&retained_identity, 8, 4).unwrap();
+    retained_cache.install_loaded_neighbor(
+        MutationOpCache::<D>::node_row_id(0, 20),
+        NeighborRowValue::KnownAbsent,
+    );
+    retained.restore_cache(retained_identity, retained_cache);
+    assert_eq!(retained.neighbor_count(), 1);
+    retained.shrink_to(0).unwrap();
+    assert_eq!(retained.neighbor_count(), 0);
+    assert_eq!(retained.stats().dirty_neighbor_flushes(), 0);
 }
 
 async fn run_build_session_flush_recovery_contract<D: Distance>() {
```

**File**: `crates/db/tests/production_support/vector/storage.rs` (modified, +49/-0)
```diff
@@ -2097,6 +2097,54 @@ async fn run_read_fault_contracts() {
 }
 
 /// Exercises scoped keys, typed row codecs, opaque tokens, and lane cleanup.
+/// Proves the concurrent batch policy returns the same rows, in caller order,
+/// as one `multi_get` when a batch spans several chunks and waves.
+async fn run_batch_read_contracts() {
+    let db = Db::open("production-vector-batch-reads", Arc::new(InMemory::new()))
+        .await
+        .unwrap();
+    let keyspace = VectorRowKeyspace::new(
+        "production-vector-batch-reads".into(),
+        DataScope::LegacyUnscoped,
+    );
+    let batch_len = CONCURRENT_MULTI_GET_CHUNK_KEYS * CONCURRENT_MULTI_GET_MAX_CHUNKS + 5;
+    let present = |node_id: NodeId| !node_id.is_multiple_of(3);
+    let transaction = db.begin(IsolationLevel::Snapshot).await.unwrap();
+    (1..=batch_len as NodeId)
+        .filter(|node_id| present(*node_id))
+        .for_each(|node_id| {
+            transaction
+                .put(
+                    keyspace.key(VectorKey::SimHash(VectorSimHashKey::new(
+                        keyspace.index_id(),
+                        node_id,
+                    ))),
+                    encode_simhash(node_id),
+                )
+                .unwrap();
+        });
+    transaction.commit().await.unwrap();
+
+    // Descending order is the opposite of physical key order.
+    let node_ids = (1..=batch_len as NodeId).rev().collect::<Vec<_>>();
+    let expected = node_ids
+        .iter()
+        .map(|node_id| match present(*node_id) {
+            true => SimHashRow::Present(SimHash::from_bits(*node_id)),
+            false => SimHashRow::Missing,
+        })
+        .collect::<Vec<_>>();
+    for batch_reads in [VectorBatchReads::Single, VectorBatchReads::Concurrent] {
+        let keyspace = keyspace.clone().with_batch_reads(batch_reads);
+        let rows = VectorRows::new(&db, &keyspace)
+            .simhash_rows(&node_ids)
+            .await
+            .unwrap();
+        assert_eq!(rows, expected, "{batch_reads:?}");
+    }
+    db.close().await.unwrap();
+}
+
 pub(crate) async fn run() {
     run_legacy_validation_codec_contracts();
     run_legacy_migration_read_contracts().await;
@@ -2106,6 +2154,7 @@ pub(crate) async fn run() {
     run_legacy_validation_entry_point_contracts().await;
     run_keyspace_contracts();
     run_row_contracts().await;
+    run_batch_read_contracts().await;
     run_corruption_contracts().await;
     run_read_fault_contracts().await;
 }
```

---

### Incident Patch 3: `fda3e5e6` (2026-09-29)
**Commit Message**: Merge remote-tracking branch 'origin/main' into fix-stale-vector-coverage-exclusions

# Conflicts:
#	scripts/db-production-coverage-baselines.json

**File**: `.github/workflows/cloud-launch-pr.yml` (modified, +0/-47)
```diff
@@ -13,7 +13,6 @@ on:
       - "crates/planner/**"
       - "crates/server/**"
       - "scripts/**"
-      - "tools/hyperscale-migration-parity/**"
   workflow_dispatch:
 
 permissions:
@@ -42,7 +41,6 @@ jobs:
       - run: python3 scripts/validate-cargo-target-references.py
       - run: cargo fmt --all -- --check
       - run: cargo clippy --workspace -- -D warnings
-      - run: cargo check -p db --features migration-parity
       - run: cargo test --workspace --doc
 
   workspace-tests:
@@ -89,48 +87,3 @@ jobs:
           cargo test -p helix-cli --test api_contracts
           query_command_preserves_the_shared_transport_corpus -- --exact
       - run: scripts/planner-normalized-corpus.sh
-
-  migration-parity-dev:
-    name: Legacy migration parity (dev)
-    if: >-
-      github.event_name == 'workflow_dispatch' ||
-      github.event.pull_request.head.repo.full_name == github.repository
-    runs-on: ubuntu-24.04-arm
-    timeout-minutes: 45
-    env:
-      HELIX_HYPERSCALE_REPO: ${{ github.workspace }}/helix-hyperscale
-    steps:
-      - uses: actions/checkout@v6
-        with:
-          path: helix-proper
-          persist-credentials: false
-      - name: Create read-only Hyperscale token
-        id: hyperscale-token
-        uses: actions/create-github-app-token@v3
-        with:
-          client-id: ${{ vars.HELIX_CI_READ_APP_CLIENT_ID }}
-          private-key: ${{ secrets.HELIX_CI_READ_APP_PRIVATE_KEY }}
-          owner: HelixDB
-          repositories: helix-hyperscale
-          permission-contents: read
-      - uses: actions/checkout@v6
-        with:
-          repository: HelixDB/helix-hyperscale
-          ref: e5bac15b020c9acac1649c44b58a2cf16dd1f874
-          path: helix-hyperscale
-          token: ${{ steps.hyperscale-token.outputs.token }}
-          persist-credentials: false
-      - uses: dtolnay/rust-toolchain@1.97.1
-      - uses: Swatinem/rust-cache@v2
-        with:
-          workspaces: helix-proper
-      - run: scripts/run-migration-parity.sh dev
-        working-directory: helix-proper
-        env:
-          MIGRATION_PARITY_REPORT_DIR: ${{ runner.temp }}/migration-parity-reports
-      - if: always()
-        uses: actions/upload-artifact@v4
-        with:
-          name: migration-parity-dev
-          path: ${{ runner.temp }}/migration-parity-reports/dev.json
-          if-no-files-found: error
```

**File**: `crates/db/Cargo.toml` (modified, +0/-3)
```diff
@@ -67,7 +67,6 @@ reqwest = "0.13.3"
 
 [features]
 default = []
-migration-parity = []
 index-lifecycle-testing = []
 test-util = ["tokio/test-util"]
 future-vector-codecs = []
@@ -135,7 +134,6 @@ required-features = ["production-coverage"]
 name = "production_migration_contracts"
 required-features = [
     "production-coverage",
-    "migration-parity",
     "index-lifecycle-testing",
 ]
 
@@ -147,7 +145,6 @@ required-features = ["production-coverage"]
 name = "production_text_correctness_regressions"
 required-features = [
     "production-coverage",
-    "migration-parity",
     "index-lifecycle-testing",
 ]
 
```

**File**: `crates/db/src/encoding/v1/keys/mod.rs` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ pub(crate) mod metadata {
     pub(crate) use crate::encoding::v2::keys::metadata::*;
     #[deprecated(note = "use encoding::v2::legacy::index_catalog::catalog_scan_prefix")]
     pub(crate) use crate::encoding::v2::legacy::index_catalog::catalog_scan_prefix as dynamic_index_prefix_scoped;
-    #[cfg(any(test, feature = "migration-parity", feature = "production-coverage"))]
+    #[cfg(any(test, feature = "production-coverage"))]
     #[deprecated(note = "use encoding::v2::legacy::index_catalog::catalog_storage_key")]
     pub(crate) use crate::encoding::v2::legacy::index_catalog::catalog_storage_key as dynamic_index_storage_key_scoped;
     #[deprecated(note = "use encoding::v2::legacy::text::storage_keys")]
```

**File**: `crates/db/src/encoding/v2/keys/graph.rs` (modified, +3/-3)
```diff
@@ -56,7 +56,7 @@ impl AdjacencyKey {
         Ok(Self::new(read_u64(slice, PREFIX_LEN)?))
     }
 
-    #[cfg(any(test, feature = "migration-parity"))]
+    #[cfg(any(test, feature = "production-coverage"))]
     pub(crate) const fn node_id(&self) -> NodeId {
         self.node_id
     }
@@ -201,12 +201,12 @@ impl EdgePairIndexKey {
         ))
     }
 
-    #[cfg(any(test, feature = "migration-parity"))]
+    #[cfg(any(test, feature = "production-coverage"))]
     pub(crate) const fn from(&self) -> NodeId {
         self.from
     }
 
-    #[cfg(any(test, feature = "migration-parity"))]
+    #[cfg(any(test, feature = "production-coverage"))]
     pub(crate) const fn to(&self) -> NodeId {
         self.to
     }
```

**File**: `crates/db/src/encoding/v2/legacy/index_catalog.rs` (modified, +2/-2)
```diff
@@ -197,15 +197,15 @@ pub(crate) fn catalog_scan_prefix(scope: DataScope) -> Bytes {
     data_metadata_key(scope, DYNAMIC_INDEX_PREFIX)
 }
 
-#[cfg(any(test, feature = "migration-parity", feature = "production-coverage"))]
+#[cfg(any(test, feature = "production-coverage"))]
 pub(crate) fn catalog_storage_key(scope: DataScope, encoded_identity: &[u8]) -> Bytes {
     let mut name = Vec::with_capacity(DYNAMIC_INDEX_PREFIX.len() + encoded_identity.len());
     name.extend_from_slice(DYNAMIC_INDEX_PREFIX);
     name.extend_from_slice(encoded_identity);
     data_metadata_key(scope, &name)
 }
 
-#[cfg(any(test, feature = "migration-parity", feature = "production-coverage"))]
+#[cfg(any(test, feature = "production-coverage"))]
 pub(crate) fn encode_row_for_contract(
     scope: DataScope,
     identity: &LegacyDynamicIndexKey,
```

---

### Incident Patch 4: `c32b2cf1` (2026-09-29)
**Commit Message**: fix(db,planner): address membership review findings

- Pruning flattens conjunctions it leaves nested, so a residual that is
  itself a conjunction still fuses into index membership instead of
  falling back to a per-row filter.
- Ordered intersections fold their filters into one bitmap before the
  range driver again, so disjoint filters skip the range scan.
- Concurrent set-child reads beyond one per set draw on one budget shared
  by every step context of a request, so parallel steps cannot multiply
  in-flight index reads.
- Membership pricing charges other-label rows that evaluate the whole
  predicate under the Evaluate policy.
- Row filters compute the record prefetch flag once per predicate, not per
  row.
- The production oracle checks label-scoped membership against a true
  per-row filter again.
- Document the per-frame and huge-label costs of always resolving sets.

**File**: `crates/db/src/execution/interpreter/access.rs` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ mod secondary_set;
 
 pub(in crate::execution::interpreter) use search::SearchReadLimit;
 pub(in crate::execution::interpreter) use secondary_set::{
-    intersection, union, PARALLEL_INDEX_READS,
+    intersection, union, SharedIndexReads, PARALLEL_INDEX_READS,
 };
 
 #[cfg(any(test, feature = "production-coverage"))]
```

**File**: `crates/db/src/execution/interpreter/access/secondary_set.rs` (modified, +105/-24)
```diff
@@ -13,8 +13,23 @@
 //! children it reads at once, and `width * floor(reads / width) <= reads`, so a
 //! `Union` nested in an `Intersect` cannot multiply the concurrency. An ordered
 //! range driver still runs only after all of its filters are resolved.
+//!
+//! Every child read beyond the first of a composite also takes one of the
+//! request's [`SharedIndexReads`], which every step context of the request
+//! shares, parallel steps included. A composite that finds none free reads
+//! its children one at a time, as it did before reads were concurrent. So one
+//! request keeps at most
+//!
+//! ```text
+//! concurrent resolves + PARALLEL_INDEX_READS - 1
+//! ```
+//!
+//! index reads in flight, where a concurrent resolve is one set read by one
+//! step at a time (a membership with an `Evaluate` policy counts twice: its
+//! set and its label bitmap). A lone set still reaches the full per-set bound.
 
 use core::num::NonZeroUsize;
+use core::sync::atomic::{AtomicUsize, Ordering};
 
 use futures::future::BoxFuture;
 use futures::{future, stream, FutureExt, Stream, StreamExt, TryStreamExt};
@@ -32,6 +47,47 @@ use crate::error::Result;
 pub(in crate::execution::interpreter) const PARALLEL_INDEX_READS: NonZeroUsize =
     helix_planner::cost::MAX_PARALLEL_KV_READS;
 
+/// Concurrent child reads one request may add beyond one read per set it is
+/// resolving, shared by every step context of the request.
+///
+/// A composite takes what is free when it starts reading and returns it when
+/// its read ends; taking never waits, so no set can block on another.
+#[derive(Debug)]
+pub(in crate::execution::interpreter) struct SharedIndexReads(AtomicUsize);
+
+impl Default for SharedIndexReads {
+    fn default() -> Self {
+        Self(AtomicUsize::new(PARALLEL_INDEX_READS.get() - 1))
+    }
+}
+
+impl SharedIndexReads {
+    /// Take up to `wanted` extra reads, as many as are free now.
+    fn take(&self, wanted: usize) -> ExtraIndexReads<'_> {
+        let (Ok(free) | Err(free)) =
+            self.0
+                .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |free| {
+                    Some(free - free.min(wanted))
+                });
+        ExtraIndexReads {
+            pool: self,
+            taken: free.min(wanted),
+        }
+    }
+}
+
+/// Extra reads one composite holds until its read ends.
+struct ExtraIndexReads<'a> {
+    pool: &'a SharedIndexReads,
+    taken: usize,
+}
+
+impl Drop for ExtraIndexReads<'_> {
+    fn drop(&mut self) {
+        self.pool.0.fetch_add(self.taken, Ordering::SeqCst);
+    }
+}
+
 /// Intersect `children` in the order they arrive.
 ///
 /// The first error ends the fold and is returned. No children intersect to
@@ -119,20 +175,29 @@ impl<'db> ExecutionContext<'db> {
     /// At most `width = min(children, reads)` children are read at once, and
     /// each child gets `reads / width` (at least 1) of the budget for its own
     /// children. A nested set therefore never keeps more than `reads` leaf
-    /// reads in flight at any depth. Results, and so the first error, arrive in
-    /// plan order. Later children may already be in flight, and they are
-    /// dropped when an earlier child fails.
+    /// reads in flight at any depth. Every child beyond the first also needs
+    /// one of the request's [`SharedIndexReads`], taken once when the stream
+    /// is created, so a busy request narrows `width`, down to one child at a
+    /// time. Results, and so the first error, arrive in plan order. Later
+    /// children may already be in flight, and they are dropped when an
+    /// earlier child fails.
     pub(in crate::execution::interpreter) fn read_children<'a, C: ?Sized + 'a, T: 'a>(
         &'a self,
         children: Vec<&'a C>,
         reads: NonZeroUsize,
         read: impl Fn(&'a C, NonZeroUsize) -> BoxFuture<'a, Result<T>> + 'a,
     ) -> impl Stream<Item = Result<T>> + 'a {
         // `buffered(0)` would never poll a child, so an empty list keeps width 1.
- 
```

**File**: `crates/db/src/execution/interpreter/access/tests/secondary_indexes.rs` (modified, +86/-0)
```diff
@@ -3661,6 +3661,63 @@ async fn set_children_are_read_concurrently_up_to_the_bound() {
     assert_eq!(peak.load(Ordering::SeqCst), 2);
 }
 
+#[tokio::test]
+async fn disjoint_ordered_filters_skip_the_range_driver() {
+    use std::sync::atomic::Ordering;
+
+    let (db, _) = concurrent_set_fixture("access-ordered-disjoint-filters").await;
+    let mut context = ExecutionContext::new(&db, context::ParamBindings::default());
+    context.enable_request_read_view().await.unwrap();
+    let ordered = |filters: Vec<exec::ExecNodeSecondarySetPlan>| {
+        exec::ExecNodeSecondarySetPlan::OrderedIntersect {
+            driver: exec::ExecNodeSecondaryRangePlan {
+                iteration: helix_planner::ir::RangeScanIteration::Forward,
+                index: catalog::NodeRangeIndexMeta::new(test_support::name(
+                    "node_range:User:rank:asc",
+                )),
+                key: catalog::ScopedPropertyDirectionKey::try_new(
+                    "User",
+                    "rank",
+                    helix_ast::index::RangeIndexDirection::Asc,
+                )
+                .unwrap(),
+                range: ir::IndexRange::All,
+            },
+            filters: ir::AtLeast::<_, 1>::try_from_vec(filters).unwrap(),
+        }
+    };
+
+    // `paused` and `gold` each match a user, but never the same one.
+    let disjoint = ordered(vec![
+        user_equality("node_eq:User:status", "status", "paused"),
+        user_equality("node_eq:User:tier", "tier", "gold"),
+    ]);
+    assert_eq!(
+        context
+            .node_secondary_set_ids(&disjoint, None)
+            .await
+            .unwrap(),
+        Vec::<u64>::new()
+    );
+    assert_eq!(context.range_reads.entries.load(Ordering::Relaxed), 0);
+
+    // Overlapping filters still drive the range in order.
+    let overlapping = ordered(vec![
+        user_equality("node_eq:User:status", "status", "active"),
+        user_equality("node_eq:User:tier", "tier", "gold"),
+    ]);
+    assert_eq!(
+        context
+            .node_secondary_set_ids(&overlapping, None)
+            .await
+            .unwrap()
+            .len(),
+        2
+    );
+    assert!(context.range_reads.entries.load(Ordering::Relaxed) > 0);
+    context.close_request_read_view().unwrap();
+}
+
 #[tokio::test(start_paused = true)]
 async fn read_children_yields_results_and_the_first_error_in_plan_order() {
     use futures::{FutureExt, TryStreamExt};
@@ -3766,6 +3823,35 @@ async fn nested_sets_never_exceed_the_read_budget() {
     }
 }
 
+/// Sets resolved at once, by one step or by parallel steps sharing the
+/// request's pool, add at most `PARALLEL_INDEX_READS - 1` reads beyond one
+/// each, and the pool refills when they finish.
+#[tokio::test(start_paused = true)]
+async fn concurrent_sets_share_one_request_read_budget() {
+    let db = test_support::open_db("access-read-children-request-budget").await;
+    let context = ExecutionContext::new(&db, context::ParamBindings::default());
+    let wide = ReadTree::Set((0..20).map(|_| ReadTree::Leaf).collect());
+    let reads = crate::execution::interpreter::access::PARALLEL_INDEX_READS;
+    let live = LiveLeaves::default();
+    futures::try_join!(
+        read_tree(&context, &wide, reads, &live),
+        read_tree(&context, &wide, reads, &live),
+        read_tree(&context, &wide, reads, &live),
+    )
+    .unwrap();
+    assert_eq!(
+        live.peak.load(std::sync::atomic::Ordering::SeqCst),
+        reads.get() + 2
+    );
+
+    let live = LiveLeaves::default();
+    read_tree(&context, &wide, reads, &live).await.unwrap();
+    assert_eq!(
+        live.peak.load(std::sync::atomic::Ordering::SeqCst),
+        reads.get()
+    );
+}
+
 #[tokio::test]
 async fn set_errors_surface_in_plan_order_and_empty_children_do_not_short_circuit() {
     let (db, _) = concurrent_set_fixture("access-concurrent-secondary-errors").await;
```

**File**: `crates/db/src/execution/interpreter/pull/source.rs` (modified, +6/-6)
```diff
@@ -281,32 +281,32 @@ impl<'a> Source<'a> {
             Plan::Access(A::Node(N::SecondarySet {
                 set: exec::ExecNodeSecondarySetPlan::OrderedIntersect { driver, filters },
             })) => {
-                let membership = ctx
-                    .node_secondary_filter_bitmaps(filters, access::PARALLEL_INDEX_READS)
+                let allowed = ctx
+                    .node_secondary_filter_intersection(filters, access::PARALLEL_INDEX_READS)
                     .await?;
                 self.open_range(
                     ctx,
                     K::NodeProperty,
                     &driver.key,
                     &driver.range,
                     driver.iteration,
-                    membership,
+                    vec![allowed],
                 )
                 .await
             }
             Plan::Access(A::Edge(E::SecondarySet {
                 set: exec::ExecEdgeSecondarySetPlan::OrderedIntersect { driver, filters },
             })) => {
-                let membership = ctx
-                    .edge_secondary_filter_bitmaps(filters, access::PARALLEL_INDEX_READS)
+                let allowed = ctx
+                    .edge_secondary_filter_intersection(filters, access::PARALLEL_INDEX_READS)
                     .await?;
                 self.open_range(
                     ctx,
                     K::EdgeEndpoints,
                     &driver.key,
                     &driver.range,
                     driver.iteration,
-                    membership,
+                    vec![allowed],
                 )
                 .await
             }
```

**File**: `crates/db/src/execution/interpreter/runtime_context.rs` (modified, +4/-0)
```diff
@@ -285,6 +285,9 @@ pub(in crate::execution::interpreter) struct ExecutionContext<'db> {
         crate::execution_control::ExecutionControl,
     /// Index memberships resolved in the current request state.
     pub(in crate::execution::interpreter) prepared_memberships: super::stream::PreparedMemberships,
+    /// Concurrent secondary-set child reads shared by every step context of
+    /// the request.
+    pub(in crate::execution::interpreter) shared_index_reads: Arc<super::access::SharedIndexReads>,
     #[cfg(test)]
     pub(in crate::execution::interpreter) projection_reads: Arc<ProjectionReadCounters>,
     #[cfg(test)]
@@ -359,6 +362,7 @@ impl<'db> ExecutionContext<'db> {
             row_mode_max_rows: row_mode::RowModeMaxRowsSetting::default(),
             execution_control,
             prepared_memberships: super::stream::PreparedMemberships::default(),
+            shared_index_reads: Arc::default(),
             #[cfg(test)]
             projection_reads: Arc::new(ProjectionReadCounters::default()),
             #[cfg(test)]
```

---

### Incident Patch 5: `54d4a504` (2026-09-29)
**Commit Message**: feat(planner): every eligible node-stream filter becomes index membership, with no cost race

An indexed filter must never be decided by reading records row by row, but
membership was only an exploration alternative priced against the per-row
filter, so short or bounded streams, statistics, or an exhausted exploration
budget kept the per-row filter.

index_membership_filter now returns one membership with the unindexed, null
and range conjuncts fused in as its residual. When no single index set
answers the predicate, a finite `$label` domain in its conjuncts (label-only
filters, label-scoped but unindexed filters) becomes a `$label` bitmap
membership within the union branch limit.

The membership rule rewrites every eligible filter in one application,
including streams of unknown element kind and a leading unscoped filter over
a label-less node source (point IDs, parameters, variables, all-node scans),
also as a lone AccessFilter. It is now a required rewrite: the eight
implementation rules for the expression kinds it matches refuse any
expression membership_rewrite would change. A pre-exploration normalisation
could not guarantee this, because exploration keeps creating new pipeli

**File**: `crates/db/src/query_service/index_membership_tests.rs` (modified, +216/-47)
```diff
@@ -1,8 +1,10 @@
 //! End-to-end post-expansion index membership through `HelixDB::query`.
 //!
 //! Every query compares the membership plan with the same data served by a
-//! database without the index, which keeps the per-row filter plan. Narrow
-//! and wide traversals alike resolve the index set on their first node row.
+//! database without the index, which keeps the per-row filter, or decides a
+//! label-scoped filter from the `$label` bitmap and evaluates the rest per
+//! row. Narrow and wide traversals alike resolve the set on their first node
+//! row.
 
 use helix_ast::{batch, expr, graph, index, query, traversal, value};
 use helix_planner::{context, exec, planning};
@@ -247,6 +249,21 @@ fn membership_steps(plan: &exec::ExecutablePlan) -> usize {
         .count()
 }
 
+/// Membership steps whose set `plan` reads from secondary indexes rather than
+/// `$label` bitmaps.
+fn index_set_memberships(plan: &exec::ExecutablePlan) -> usize {
+    plan.steps()
+        .iter()
+        .filter(|step| {
+            matches!(
+                &step.op,
+                exec::ExecOp::IndexMembership { plan }
+                    if matches!(plan.set, exec::ExecNodeMembershipSet::Index { .. })
+            )
+        })
+        .count()
+}
+
 #[tokio::test]
 async fn post_expansion_membership_matches_the_per_row_filter_end_to_end() {
     let scope = DataScope::LegacyUnscoped;
@@ -277,83 +294,95 @@ async fn post_expansion_membership_matches_the_per_row_filter_end_to_end() {
             vec!["nw3", "nw9", "nw15"],
             true,
         ),
-        // A range set would verify the label's whole range, so ranges keep
-        // the per-row filter.
+        // A range set would verify the label's whole range, so a range is
+        // never read from its index.
         (
             expr::Predicate::gte("uid", "a2"),
             vec!["a2", "a3", "n1", "n2"],
             WIDE.to_vec(),
             false,
         ),
-        // A missing property equals null, so null keeps the per-row filter.
+        // A missing property equals null, so null is never read from an
+        // index either.
         (
             expr::Predicate::eq("kind", value::PropertyValue::Null),
             vec!["a3"],
             Vec::new(),
             false,
         ),
     ] {
-        // `Group.uid` and `Item.uid` are not indexed, so both sources are
-        // label scans that keep the unknown-scan estimate without statistics,
-        // past one record batch. Unscoped or scoped to `Attribute`, the
-        // predicate plans membership whenever an index answers it; the
-        // unscoped one still evaluates `Note` rows per row after the wide
-        // stream resolves its set.
+        // Unscoped, the predicate plans membership whenever an index answers
+        // it, and `Note` rows still evaluate it per row. Scoped to
+        // `Attribute`, it always plans membership: a predicate no index
+        // answers reads the `Attribute` label bitmap and evaluates only its
+        // nodes, with or without a catalog index.
         let attributes = |uids: &[&'static str]| {
             uids.iter()
                 .copied()
                 .filter(|uid| uid.starts_with('a'))
                 .collect::<Vec<_>>()
         };
-        for (predicate, narrow_uids, wide_uids, planned) in [
+        for (predicate, narrow_uids, wide_uids, planned, label_set) in [
             (
                 unscoped.clone(),
                 narrow_uids.clone(),
                 wide_uids.clone(),
                 answered,
+                false,
             ),
             (
                 attribute(unscoped),
                 attributes(&narrow_uids),
                 attributes(&wide_uids),
-                answered,
+                true,
+                true,
             ),
         ] {
             // Both streams read the set their membership plans.
-            for (read, expected, resolves) in [
-                (
-           
```

**File**: `crates/db/tests/production_contracts.rs` (modified, +16/-8)
```diff
@@ -6752,6 +6752,15 @@ async fn public_query_boundary_answers_post_expansion_filters_with_index_members
     };
     let is_membership =
         |step: &exec::ExecStep| matches!(step.op, exec::ExecOp::IndexMembership { .. });
+    // Without a catalog a label-scoped filter still reads the `$label` bitmap,
+    // but never a secondary index.
+    let is_index_set_membership = |step: &exec::ExecStep| {
+        matches!(
+            &step.op,
+            exec::ExecOp::IndexMembership { plan }
+                if matches!(plan.set, exec::ExecNodeMembershipSet::Index { .. })
+        )
+    };
     let bind = |name: &str, value: PropertyValue| {
         context::ParamBindings::default().with_value(
             ir::NonEmptyString::new(name).expect("parameter name is non-empty"),
@@ -6929,12 +6938,11 @@ async fn public_query_boundary_answers_post_expansion_filters_with_index_members
             false,
         ),
     ] {
-        // Production planning has no statistics, so the label scan behind
-        // every checked shape keeps the unknown-scan estimate, past one
-        // record batch. Membership then amortizes its set reads whether the
-        // predicate is unscoped, evaluating rows of other labels, or scoped
-        // to `Attribute`, rejecting them, whenever an index answers one of
-        // its conjuncts.
+        // An unscoped predicate plans membership, evaluating rows of other
+        // labels, whenever an index answers one of its conjuncts. Scoped to
+        // `Attribute` it always plans membership and rejects other labels:
+        // a predicate no index answers reads the `Attribute` label bitmap
+        // and evaluates only that label's nodes.
         // A nested conjunction would hide its conjuncts from the index split.
         let conjuncts = if let Predicate::And { predicates } = &unscoped {
             predicates.clone()
@@ -6952,7 +6960,7 @@ async fn public_query_boundary_answers_post_expansion_filters_with_index_members
             .filter(|uid| uid.starts_with('a'))
             .collect::<Vec<_>>();
         for (predicate, expected, planned) in
-            [(unscoped, expected, indexed), (scoped, attributes, indexed)]
+            [(unscoped, expected, indexed), (scoped, attributes, true)]
         {
             let filtered = |group: &str| {
                 traversal::g()
@@ -6989,7 +6997,7 @@ async fn public_query_boundary_answers_post_expansion_filters_with_index_members
                     planning::plan_read_batch(&read, &without_catalog).unwrap_or_else(|error| {
                         panic!("{predicate:?} plans without the catalog: {error}")
                     });
-                assert!(!per_row.steps().iter().any(is_membership));
+                assert!(!per_row.steps().iter().any(is_index_set_membership));
                 let membership_rows = db
                     .execute(&membership, params.clone())
                     .await
```

**File**: `crates/planner/src/cost/mod.rs` (modified, +2/-2)
```diff
@@ -11,8 +11,8 @@ mod vector;
 
 pub use profile::{StorageCostProfile, StorageCostProfileOverrides};
 pub use units::{
-    ByteEstimate, EstimatedRows, EstimatedRowsAtMost, LatencyEstimate, MembershipStream,
-    RecordBatchRows, Selectivity, UniqueEqualityRows, MAX_PARALLEL_KV_READS, RECORD_BATCH_ROWS,
+    ByteEstimate, EstimatedRows, EstimatedRowsAtMost, LatencyEstimate, Selectivity,
+    UniqueEqualityRows, MAX_PARALLEL_KV_READS, RECORD_BATCH_ROWS,
 };
 pub use vector::CostVector;
 
```

**File**: `crates/planner/src/cost/profile/formulas.rs` (modified, +39/-89)
```diff
@@ -2,7 +2,6 @@
 
 use helix_ast::expr::Predicate;
 
-use crate::cost::{MembershipStream, RECORD_BATCH_ROWS};
 use crate::properties::{KeyLocality, PositiveUsize};
 
 use super::{
@@ -286,109 +285,60 @@ impl StorageCostProfile {
             .serial(self.predicate_eval(rows))
     }
 
-    /// Cost a row-preserving node index membership filter by what the interpreter
-    /// does for `stream`.
+    /// Cost a row-preserving node index membership filter.
     ///
-    /// The interpreter evaluates a stream of at most [`RECORD_BATCH_ROWS`] node
-    /// rows row by row, exactly like the per-row filter over `predicate`, and
-    /// never reads the set. Past one batch it reads the secondary set once per
-    /// request, concurrently with the `label_domain` bitmap for an unscoped
-    /// predicate, probes it once per row, and evaluates only rows of other labels.
-    ///
-    /// Row by row, membership does the work of
-    /// [`residual_filter`](Self::residual_filter) over `predicate`, the price of
-    /// the filter it replaces, so both sides of the choice count the same blob
-    /// reads and predicate leaves.
-    ///
-    /// * Within one batch, or an empty stream: the filter's work plus the set
-    ///   read. Membership can only match the filter there, so it never wins.
-    /// * An unbounded stream estimated within one batch: the filter's work less
-    ///   one predicate-leaf evaluation. At the estimate both plans do the same
-    ///   work, but only the membership stops reading records if the stream
-    ///   outgrows the estimate. The credit is the smallest unit of that work: it
-    ///   settles this tie under every profile, since it always lowers the CPU
-    ///   units, and never outweighs a record read, such as the second read of a
-    ///   kept row by a residual filter behind the membership.
-    /// * Past one batch: the set reads plus one probe per row. An unscoped
-    ///   predicate rewrites only when exactly one label's index answers it, so its
-    ///   rows are priced as that label's. A row of another label costs one probe
-    ///   more than the filter, after reads made at most once per request.
+    /// The interpreter reads `set` once per request, concurrently with the
+    /// `label_domain` bitmap when outside-label nodes need it, probes the set
+    /// once per stream row, and evaluates `residual` only for the `matches`
+    /// rows the set keeps, never for more than the `rows` it sees. Rows the
+    /// set cannot decide are priced as label rows, since an unscoped predicate
+    /// uses an index set only when one label answers it.
     ///
     /// ```
     /// use helix_ast::expr::Predicate;
-    /// use helix_planner::cost::{
-    ///     EstimatedRows, MembershipStream, RecordBatchRows, StorageCostProfile,
-    /// };
+    /// use helix_planner::cost::{EstimatedRows, StorageCostProfile};
     /// let profile = StorageCostProfile::default();
-    /// let set = profile.bitmap_equality_lookup(EstimatedRows::rows(10));
-    /// let label = profile.bitmap_equality_lookup(EstimatedRows::rows(1_000));
-    /// let kind = Predicate::eq("kind", "B");
-    /// let f = |n| profile.residual_filter(&kind, EstimatedRows::rows(n));
-    /// let unbounded = |n| MembershipStream::MayExceedOneBatch(EstimatedRows::rows(n));
-    ///
-    /// for label_domain in [None, Some(label)] {
-    ///     // An unbounded stream estimated within one batch: one leaf evaluation less.
-    ///     let cost = profile.index_membership_filter(&kind, set, label_domain, unbounded(10));
-    ///     assert_eq!(
-    ///         cost.latency.as_micros(),
-    ///         f(10).latency.as_micros() - profile.cpu_predicate_eval.as_micros()
-    ///     );
-    ///     assert_eq!(cost.object_reads, 10);
-    ///     assert_eq!(cost.cpu_units + 1, f(10).cpu_units);
-    ///
-    ///     // A stream proven to fit in one batch, or an empty one, keeps the filter.
-    ///     let bounded = MembershipStream::WithinOneBatch(Re
```

**File**: `crates/planner/src/cost/profile/residual.rs` (modified, +3/-18)
```diff
@@ -138,29 +138,14 @@ impl StorageCostProfile {
     /// assert_eq!(cost.latency.as_micros(), 120);
     /// ```
     pub fn residual_filter(&self, predicate: &Predicate, rows: EstimatedRows) -> CostVector {
-        self.residual_filter_less_leaves(predicate, rows, 0)
-    }
-
-    /// [`Self::residual_filter`] less `credited` predicate-leaf evaluations,
-    /// never below the blob reads.
-    pub(super) fn residual_filter_less_leaves(
-        &self,
-        predicate: &Predicate,
-        rows: EstimatedRows,
-        credited: u64,
-    ) -> CostVector {
         let mut evaluation = Evaluation::default();
         evaluation.predicate(predicate);
         self.authoritative_verification(EstimatedRows::rows(
             rows.as_rows().saturating_mul(evaluation.reads.len() as u64),
         ))
-        .serial(
-            self.predicate_eval(EstimatedRows::rows(
-                rows.as_rows()
-                    .saturating_mul(evaluation.atoms)
-                    .saturating_sub(credited),
-            )),
-        )
+        .serial(self.predicate_eval(EstimatedRows::rows(
+            rows.as_rows().saturating_mul(evaluation.atoms),
+        )))
     }
 }
 
```

---

### Incident Patch 6: `0dd9335d` (2026-09-29)
**Commit Message**: chore: remove UNIQUE_EQUALITY_FIX_PLAN.md (#1147)

Removes the leftover planning doc from the repo root. The work it
describes already shipped in 8edef32a7 ("Batch unique equality unions
with snapshot verification").

```diff
 helix-db/
 ├── crates/
 ├── docs/
-├── UNIQUE_EQUALITY_FIX_PLAN.md
 └── ...
```

No code changes.

**File**: `UNIQUE_EQUALITY_FIX_PLAN.md` (removed, +0/-79)
```diff
@@ -1,79 +0,0 @@
-# Unique equality membership regression
-
-The serial cost of a unique equality union exceeds the default label-scan cost
-at four values. Production has no label cardinality statistics, so selective
-membership queries scan large labels.
-
-## Scope and contract
-
-- Lower same-index, finite, indexed unique literals into one typed owner batch.
-- Resolve the active generation and tenant scope from the request snapshot.
-- Read owner keys with `multi_get`; verify every returned owner against the
-  authoritative graph in that same snapshot. Missing owners are misses; stale
-  or malformed owners fail closed. Do not alter persisted formats or writes.
-- Charge batch reads and authoritative verification in both cost paths.
-- Preserve null/NaN classification, numeric equality, set deduplication, range
-  ordering, and configured union limits. Keep non-unique batching unchanged.
-
-## Validation
-
-1. Reproduce the failing four-value plan before implementation.
-2. Test empty/populated statistics, literal/bound parameters, duplicate values,
-   nested labels, union bounds, and small labels where a scan is appropriate.
-3. Test batch results, missing/corrupt owners, snapshot/tenant boundaries,
-   canonical numeric equality, and cancellation using local fixtures.
-4. Run workspace tests, doc tests, coverage, formatting, and strict Clippy.
-5. Build and test the full local image, compare synthetic membership queries
-   with the released image, and inspect plans as well as timings.
-
-No production access, push, deployment, or image publication is part of this work.
-
-## Implemented
-
-`UniqueUnion` holds one typed unique index, one scoped key, and at least two
-indexed literals. Lowering emits it only when all children share that identity.
-Both cost paths charge a real owner `multi_get`, authoritative graph checks,
-and the set operation. The executor uses the existing request catalog/read view;
-it does not reload a newer generation or bypass verification.
-
-The configured union limit remains unchanged (64 distinct values by default).
-Null/non-reflexive classification and mixed-index unions retain their existing
-execution paths. No stored bytes, index formats, writes, CRDs, or cluster settings
-change. No rebuild of existing indexes is required.
-
-## Local validation results
-
-- The pre-fix regression failed at four values with empty statistics.
-- 1,265 planner tests passed, including literals/bound parameters, duplicates,
-  nested label predicates, missing/populated statistics, small labels, and limits.
-- Full workspace tests and doc tests passed: 3,931 reported passes, 11 existing
-  ignored tests. All 23 final focused unique-index tests also passed.
-- Strict workspace/all-target Clippy and formatting checks passed.
-- LLVM coverage exercised planner and database suites. The set cost and equality
-  leaf contract files reached 100% line coverage in the planner run. The new
-  unique-owner batch helper reached 64/64 covered executable lines, including
-  failed/truncated reads, malformed/stale owners, and invalid value/lane checks.
-- Native Linux ARM64 baseline and candidate server images built locally. Image
-  metadata/secret checks, memory/disk restart tests, concurrent membership,
-  configuration rejection, and graceful shutdown passed.
-- The stock Compose S3 fixture could not pull its pinned MinIO images. A separate
-  disposable cached-MinIO test passed seed/read, stop/restart, and replacement by
-  the final image, preserving all indexed results. This is not a pass of the
-  blocked Compose command itself.
-- Matched 100,000-row images: affected five-hit membership was about 300 ms before
-  and 1.2 ms after; 64 distinct values were about 334 ms before and 2 ms after.
-  Every response was checked against the fixture oracle. These are local synthetic
-  measurements, not a production latency promise. Lists above the configured
-  union bound still use the existing fallback.
-
-The image ben
```

---

### Incident Patch 7: `eb16a919` (2026-09-29)
**Commit Message**: chore: remove UNIQUE_EQUALITY_FIX_PLAN.md

**File**: `UNIQUE_EQUALITY_FIX_PLAN.md` (removed, +0/-79)
```diff
@@ -1,79 +0,0 @@
-# Unique equality membership regression
-
-The serial cost of a unique equality union exceeds the default label-scan cost
-at four values. Production has no label cardinality statistics, so selective
-membership queries scan large labels.
-
-## Scope and contract
-
-- Lower same-index, finite, indexed unique literals into one typed owner batch.
-- Resolve the active generation and tenant scope from the request snapshot.
-- Read owner keys with `multi_get`; verify every returned owner against the
-  authoritative graph in that same snapshot. Missing owners are misses; stale
-  or malformed owners fail closed. Do not alter persisted formats or writes.
-- Charge batch reads and authoritative verification in both cost paths.
-- Preserve null/NaN classification, numeric equality, set deduplication, range
-  ordering, and configured union limits. Keep non-unique batching unchanged.
-
-## Validation
-
-1. Reproduce the failing four-value plan before implementation.
-2. Test empty/populated statistics, literal/bound parameters, duplicate values,
-   nested labels, union bounds, and small labels where a scan is appropriate.
-3. Test batch results, missing/corrupt owners, snapshot/tenant boundaries,
-   canonical numeric equality, and cancellation using local fixtures.
-4. Run workspace tests, doc tests, coverage, formatting, and strict Clippy.
-5. Build and test the full local image, compare synthetic membership queries
-   with the released image, and inspect plans as well as timings.
-
-No production access, push, deployment, or image publication is part of this work.
-
-## Implemented
-
-`UniqueUnion` holds one typed unique index, one scoped key, and at least two
-indexed literals. Lowering emits it only when all children share that identity.
-Both cost paths charge a real owner `multi_get`, authoritative graph checks,
-and the set operation. The executor uses the existing request catalog/read view;
-it does not reload a newer generation or bypass verification.
-
-The configured union limit remains unchanged (64 distinct values by default).
-Null/non-reflexive classification and mixed-index unions retain their existing
-execution paths. No stored bytes, index formats, writes, CRDs, or cluster settings
-change. No rebuild of existing indexes is required.
-
-## Local validation results
-
-- The pre-fix regression failed at four values with empty statistics.
-- 1,265 planner tests passed, including literals/bound parameters, duplicates,
-  nested label predicates, missing/populated statistics, small labels, and limits.
-- Full workspace tests and doc tests passed: 3,931 reported passes, 11 existing
-  ignored tests. All 23 final focused unique-index tests also passed.
-- Strict workspace/all-target Clippy and formatting checks passed.
-- LLVM coverage exercised planner and database suites. The set cost and equality
-  leaf contract files reached 100% line coverage in the planner run. The new
-  unique-owner batch helper reached 64/64 covered executable lines, including
-  failed/truncated reads, malformed/stale owners, and invalid value/lane checks.
-- Native Linux ARM64 baseline and candidate server images built locally. Image
-  metadata/secret checks, memory/disk restart tests, concurrent membership,
-  configuration rejection, and graceful shutdown passed.
-- The stock Compose S3 fixture could not pull its pinned MinIO images. A separate
-  disposable cached-MinIO test passed seed/read, stop/restart, and replacement by
-  the final image, preserving all indexed results. This is not a pass of the
-  blocked Compose command itself.
-- Matched 100,000-row images: affected five-hit membership was about 300 ms before
-  and 1.2 ms after; 64 distinct values were about 334 ms before and 2 ms after.
-  Every response was checked against the fixture oracle. These are local synthetic
-  measurements, not a production latency promise. Lists above the configured
-  union bound still use the existing fallback.
-
-The image ben
```

---

### Incident Patch 8: `cec2f058` (2026-09-29)
**Commit Message**: docs: fix stale SDK claims for writer-only, database selection, and bytes params (#1144)

Fixes three stale documentation claims found while verifying SDK APIs.

## Changes

- **Writer-only reads** (`helix-cloud/operate/guarantees.mdx`): replaced
the nonexistent Python `writer_only(true)` with
`QueryBuilder.writer_only()` or `Client.execute(request,
writer_only=True)`, and named TS `writerOnly()` and Go
`helix.WriterOnly()` explicitly. Verified against the published
`helix-db` 0.3.4 wheel.
- **`X-Helix-Database-Id`** (`query-guides/http-api.mdx`,
`start-here/working-with-enterprise.mdx`): the TypeScript SDK exposes
`client.withDatabaseId(...)` since `@helix-db/helix-db` 3.2.0 (absent in
3.1.0). Published Python, Rust, and Go SDKs still do not expose it. Go
has `WithDatabaseID` on `main` only, not in `sdks/go/v0.3.1`, so no
unreleased support is claimed.
- **Bytes parameters** (`query-guides/parameters.mdx`): removed the
reference to an "SDK byte request encoder". No SDK has one; every SDK
(Python, TypeScript, Go, Rust) rejects bytes parameters with
`UnsupportedBytesParameter`.
- Regenerated `llms-full.txt` (`llms.txt` unchanged).

## Verification

- `node scripts/check-docs.mjs` pa

**File**: `docs/database/helix-cloud/operate/guarantees.mdx` (modified, +3/-2)
```diff
@@ -56,8 +56,9 @@ temporarily lag.
 
 Use a writer-only server request when a separate request requires read-after-write:
 
-Set `writerOnly()` / `writer_only(true)` / the equivalent Go request option before
-sending the read.
+Call `writerOnly()` on the TypeScript request builder, `writer_only()` on the Python
+`QueryBuilder` (or pass `writer_only=True` to `Client.execute`), or pass
+`helix.WriterOnly()` to Go `Client.Exec` before sending the read.
 
 Embedded writer handles execute against their local writer. Embedded reader handles
 are read-only and refresh according to the underlying reader lifecycle.
```

**File**: `docs/database/helix-cloud/start-here/working-with-enterprise.mdx` (modified, +4/-3)
```diff
@@ -60,9 +60,10 @@ client = Client(
 These SDK examples target a database-specific cluster-mode gateway URL. Such an
 endpoint authenticates the API key but rejects `X-Helix-Database-Id` and
 `X-Helix-Tenant-Id`. A GA shared gateway instead requires
-`X-Helix-Database-Id`; the current public SDK request builders do not expose
-that selection header, so use the direct HTTP contract for GA shared-gateway
-requests.
+`X-Helix-Database-Id`. The TypeScript SDK (`@helix-db/helix-db` 3.2.0 and
+later) sends it after `client.withDatabaseId("<database-id>")`. The published
+Python, Rust, and Go SDKs do not expose that selection header, so use the
+direct HTTP contract for GA shared-gateway requests from those languages.
 
 Each client sends the same operation-tree request body:
 
```

**File**: `docs/database/helix-db/query-guides/http-api.mdx` (modified, +5/-4)
```diff
@@ -57,10 +57,11 @@ cluster-mode gateway URLs require the API key but reject both database and
 tenant selection headers. Use the endpoint mode shown in the dashboard; do not
 copy headers between the two modes.
 
-The current public SDK request builders set bearer authentication and execution
-headers but do not expose the GA database-selection header. Use them with a
-database-specific cluster gateway URL, or use direct HTTP for a GA shared
-gateway.
+The TypeScript SDK (`@helix-db/helix-db` 3.2.0 and later) sends
+`X-Helix-Database-Id` after `client.withDatabaseId("<database-id>")`. The
+published Python, Rust, and Go SDKs do not expose the GA database-selection
+header; use them with a database-specific cluster gateway URL, or use direct
+HTTP for a GA shared gateway.
 
 Create or rotate the cluster key in the Helix Cloud dashboard. Do not put keys
 in source control, agent instructions, `llms.txt`, or catalog manifests.
```

**File**: `docs/database/helix-db/query-guides/parameters.mdx` (modified, +3/-1)
```diff
@@ -169,7 +169,9 @@ request = query.to_query_request(
 - generic property `value`
 - typed objects and arrays
 
-JSON cannot represent a bytes parameter directly; use an SDK's byte request encoder.
+Query JSON cannot represent bytes, and no SDK provides a byte request encoder. Every SDK rejects a
+bytes parameter with an `UnsupportedBytesParameter` error when it serializes the request, so bytes
+parameters cannot currently be sent to `POST /v2/query`.
 
 In Go, `ParamDateTime` and typed `date_time` parameters accept `helix.DateTime`, `time.Time`, an
 RFC3339 string, or an `int`/`int64` epoch-millisecond value. The SDK normalizes each value to UTC
```

**File**: `docs/llms-full.txt` (modified, +15/-10)
```diff
@@ -3523,7 +3523,9 @@ request = query.to_query_request(
 - generic property `value`
 - typed objects and arrays
 
-JSON cannot represent a bytes parameter directly; use an SDK's byte request encoder.
+Query JSON cannot represent bytes, and no SDK provides a byte request encoder. Every SDK rejects a
+bytes parameter with an `UnsupportedBytesParameter` error when it serializes the request, so bytes
+parameters cannot currently be sent to `POST /v2/query`.
 
 In Go, `ParamDateTime` and typed `date_time` parameters accept `helix.DateTime`, `time.Time`, an
 RFC3339 string, or an `int`/`int64` epoch-millisecond value. The SDK normalizes each value to UTC
@@ -4748,10 +4750,11 @@ cluster-mode gateway URLs require the API key but reject both database and
 tenant selection headers. Use the endpoint mode shown in the dashboard; do not
 copy headers between the two modes.
 
-The current public SDK request builders set bearer authentication and execution
-headers but do not expose the GA database-selection header. Use them with a
-database-specific cluster gateway URL, or use direct HTTP for a GA shared
-gateway.
+The TypeScript SDK (`@helix-db/helix-db` 3.2.0 and later) sends
+`X-Helix-Database-Id` after `client.withDatabaseId("<database-id>")`. The
+published Python, Rust, and Go SDKs do not expose the GA database-selection
+header; use them with a database-specific cluster gateway URL, or use direct
+HTTP for a GA shared gateway.
 
 Create or rotate the cluster key in the Helix Cloud dashboard. Do not put keys
 in source control, agent instructions, `llms.txt`, or catalog manifests.
@@ -5386,9 +5389,10 @@ client = Client(
 These SDK examples target a database-specific cluster-mode gateway URL. Such an
 endpoint authenticates the API key but rejects `X-Helix-Database-Id` and
 `X-Helix-Tenant-Id`. A GA shared gateway instead requires
-`X-Helix-Database-Id`; the current public SDK request builders do not expose
-that selection header, so use the direct HTTP contract for GA shared-gateway
-requests.
+`X-Helix-Database-Id`. The TypeScript SDK (`@helix-db/helix-db` 3.2.0 and
+later) sends it after `client.withDatabaseId("<database-id>")`. The published
+Python, Rust, and Go SDKs do not expose that selection header, so use the
+direct HTTP contract for GA shared-gateway requests from those languages.
 
 Each client sends the same operation-tree request body:
 
@@ -6051,8 +6055,9 @@ temporarily lag.
 
 Use a writer-only server request when a separate request requires read-after-write:
 
-Set `writerOnly()` / `writer_only(true)` / the equivalent Go request option before
-sending the read.
+Call `writerOnly()` on the TypeScript request builder, `writer_only()` on the Python
+`QueryBuilder` (or pass `writer_only=True` to `Client.execute`), or pass
+`helix.WriterOnly()` to Go `Client.Exec` before sending the read.
 
 Embedded writer handles execute against their local writer. Embedded reader handles
 are read-only and refresh according to the underlying reader lifecycle.
```

---

### Incident Patch 9: `f0d1b554` (2026-09-28)
**Commit Message**: fix(planner): retain equality index seeds with residual filters (#1125)

With default statistics, four or five indexed equalities can select an
unbounded label scan because the optimizer compares only
scan-plus-filter and full intersection. Add individual equality-index
seeds with the remaining predicates preserved as residual filters.

```diff
 indexed conjunction
   scan → residual filters
   full index intersection
+  one equality index → remaining residual filters
```

Consider at most one seed per usable equality, without enumerating
predicate subsets. Prune equivalent seeds only when both cost and
estimated rows are dominated, so downstream sorting retains valid
choices. Charge property-blob fetching and each residual predicate leaf,
while preserving serial index-read costs. Scans and full intersections
still compete. No stored-data format or public query API changes.

**Measured tradeoff: the scan cliff is fixed, but default statistics can
select a broad seed and regress skewed two/three-equality queries.
Review this before an engine-pin rollout.**

| Synthetic case | Main p50 | Candidate p50 |
| --- | ---: | ---: |
| 50,000 rows, 4 equalities | 870.68 ms | 2.16 ms |
| 50,00

**File**: `crates/db/src/query_service/index_membership_tests.rs` (modified, +204/-0)
```diff
@@ -355,6 +355,210 @@ async fn post_expansion_membership_matches_the_per_row_filter_end_to_end() {
     unindexed.close().await.unwrap();
 }
 
+#[test]
+fn equality_seed_residual_with_post_expansion_membership_matches_the_per_row_filter() {
+    // Directly executed plans and public queries in one future exceed the
+    // default test stack in debug builds, so run on a dedicated stack.
+    std::thread::Builder::new()
+        .name("membership-e2e-seed".to_owned())
+        .stack_size(16 * 1024 * 1024)
+        .spawn(|| {
+            tokio::runtime::Builder::new_current_thread()
+                .enable_all()
+                .build()
+                .expect("membership seed test runtime builds")
+                .block_on(
+                    equality_seed_residual_with_post_expansion_membership_matches_the_per_row_filter_contract(),
+                );
+        })
+        .expect("membership seed test thread starts")
+        .join()
+        .expect("membership seed test thread completes");
+}
+
+/// An `Item` conjunction seeded by one equality index keeps the other as a
+/// per-row residual ahead of the expansions, and the post-expansion filter
+/// planned as index membership returns the per-row filter's rows.
+async fn equality_seed_residual_with_post_expansion_membership_matches_the_per_row_filter_contract()
+{
+    let scope = DataScope::LegacyUnscoped;
+    let indexed = seeded("membership-e2e-seed-indexed", scope, true).await;
+    for property in ["uid", "kind"] {
+        create_index(
+            &indexed,
+            scope,
+            index::IndexSpec::node_equality("Item", property),
+        )
+        .await;
+    }
+    let unindexed = seeded("membership-e2e-seed-unindexed", scope, false).await;
+    // `iw` and `ih` are both `hub` items, and `ih` links two B-valued
+    // attributes. Whichever `Item` equality seeds the source, its residual
+    // must drop the other hub.
+    for db in [&indexed, &unindexed] {
+        db.query_scoped(
+            query::QueryRequest::write(
+                batch::write_batch()
+                    .var_as(
+                        "iw",
+                        traversal::g()
+                            .n_with_label_where("Item", expr::Predicate::eq("uid", "iw"))
+                            .set_property("kind", "hub"),
+                    )
+                    .var_as("ih", node("Item", "ih", Some("hub")))
+                    .var_as(
+                        "a1",
+                        traversal::g()
+                            .n_with_label_where("Attribute", expr::Predicate::eq("uid", "a1")),
+                    )
+                    .var_as(
+                        "a4",
+                        traversal::g()
+                            .n_with_label_where("Attribute", expr::Predicate::eq("uid", "a4")),
+                    )
+                    .var_as("ih_a1", edge("ih", "HAS_ATTRIBUTE", "a1"))
+                    .var_as("ih_a4", edge("ih", "HAS_ATTRIBUTE", "a4")),
+            ),
+            scope,
+        )
+        .await
+        .unwrap();
+    }
+    let hub = |item: &str, kind: &str| {
+        traversal::g()
+            .n_with_label_where(
+                "Item",
+                expr::Predicate::and(vec![
+                    expr::Predicate::eq("uid", item),
+                    expr::Predicate::eq("kind", kind),
+                ]),
+            )
+            .out(Some("HAS_ATTRIBUTE"))
+            .in_(Some("HAS_ATTRIBUTE"))
+            .out(Some("HAS_ATTRIBUTE"))
+            .where_(attribute(expr::Predicate::eq("kind", "B")))
+    };
+    // Production planning has no statistics, so the expanded stream is an
+    // unbounded estimate within one record batch and the post-expansion
+    // filter plans membership, which reads its set only once the stream
+    // outgrows one batch. Statistics that make `uid` a selective seed over
+    // millions of `hub` items make the expanded stream large enough to pay
+    
```

**File**: `crates/db/src/query_service/selective_equality_tests.rs` (modified, +123/-102)
```diff
@@ -299,7 +299,7 @@ async fn selective_equality_preserves_tenant_snapshot_and_churn_results() {
     let scopes = ["00000000000000000000000001", "00000000000000000000000002"]
         .map(|id| DataScope::Tenant(TenantId::from_ulid_str(id).unwrap()));
     for (scope_index, scope) in scopes.into_iter().enumerate() {
-        for property in ["tenant", "type", "deleted"] {
+        for property in ["tenant", "type", "deleted", "zone", "category"] {
             for spec in [
                 index::IndexSpec::node_equality("Resource", property),
                 index::IndexSpec::edge_equality("Resource", property),
@@ -360,6 +360,8 @@ async fn selective_equality_preserves_tenant_snapshot_and_churn_results() {
                     value::PropertyInput::from(if ordinal % 2 == 0 { "pod" } else { "service" }),
                 ),
                 ("deleted", value::PropertyInput::from(ordinal % 5 == 0)),
+                ("zone", value::PropertyInput::from("zone-a")),
+                ("category", value::PropertyInput::from("synthetic")),
                 (
                     "ordinal",
                     value::PropertyInput::from(ordinal + scope_index as i64 * 100),
@@ -425,6 +427,10 @@ async fn selective_equality_preserves_tenant_snapshot_and_churn_results() {
         expr::Predicate::eq("tenant", "one"),
         expr::Predicate::eq("type", "pod"),
         expr::Predicate::eq_param("deleted", "deleted"),
+        expr::Predicate::and(vec![
+            expr::Predicate::eq("zone", "zone-a"),
+            expr::Predicate::eq("category", "synthetic"),
+        ]),
     ]);
     let params = context::ParamBindings::default().with_value(
         helix_planner::ir::NonEmptyString::new("deleted").unwrap(),
@@ -449,114 +455,129 @@ async fn selective_equality_preserves_tenant_snapshot_and_churn_results() {
                 )
                 .returning(["result"]),
         ] {
-            let prepared = db
-                .planner_context_scoped_prepared(params.clone(), scope)
-                .await
-                .unwrap();
-            assert_eq!(prepared.context().stats, context::StatsSnapshot::default());
-            let (plan, diagnostics) =
-                planning::plan_read_batch_with_diagnostics(&read, prepared.context())
-                    .unwrap()
-                    .into_parts();
-            assert!(diagnostics
-                .insights
-                .iter()
-                .all(|insight| !matches!(insight, diagnostics::PlannerInsight::UnboundedScan(_))));
-            // Advance storage after planning. The prepared read must retain the
-            // original graph and bitmap snapshot, including all four matches.
-            let literal = expr::Predicate::and(vec![
-                expr::Predicate::eq("tenant", "one"),
-                expr::Predicate::eq("type", "pod"),
-                expr::Predicate::eq("deleted", true),
-            ]);
-            db.query_scoped(
-                query::QueryRequest::write(
-                    batch::write_batch()
-                        .var_as(
-                            "nodes",
-                            traversal::g()
-                                .n_with_label_where("Resource", literal.clone())
-                                .set_property("deleted", false),
+            for stale_statistics in [false, true] {
+                let prepared = db
+                    .planner_context_scoped_prepared(params.clone(), scope)
+                    .await
+                    .unwrap();
+                assert_eq!(prepared.context().stats, context::StatsSnapshot::default());
+                let mut planner_context = prepared.context().clone();
+                if stale_statistics {
+                    for property in ["tenant", "type", "deleted", "zone", "category"] {
+                        let key = helix_planner::catalog::ScopedPropertyKey::try_new(
+                            "Resource", property,
                         )
-             
```

**File**: `crates/planner/src/cost/profile.rs` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ mod defaults;
 mod formulas;
 mod overrides;
 mod parallel;
+mod residual;
 
 use serde::{Deserialize, Serialize};
 
```

**File**: `crates/planner/src/cost/profile/formulas.rs` (modified, +45/-25)
```diff
@@ -1,5 +1,7 @@
 //! Cost formulas derived from `StorageCostProfile`.
 
+use helix_ast::expr::Predicate;
+
 use crate::cost::{MembershipStream, RECORD_BATCH_ROWS};
 use crate::properties::{KeyLocality, PositiveUsize};
 
@@ -288,65 +290,85 @@ impl StorageCostProfile {
     /// does for `stream`.
     ///
     /// The interpreter evaluates a stream of at most [`RECORD_BATCH_ROWS`] node
-    /// rows row by row, exactly like the per-row filter, and never reads the set.
-    /// Past one batch it reads the secondary set once per request, concurrently
-    /// with the `label_domain` bitmap for an unscoped predicate, probes it once per
-    /// row, and evaluates only rows of other labels.
+    /// rows row by row, exactly like the per-row filter over `predicate`, and
+    /// never reads the set. Past one batch it reads the secondary set once per
+    /// request, concurrently with the `label_domain` bitmap for an unscoped
+    /// predicate, probes it once per row, and evaluates only rows of other labels.
+    ///
+    /// Row by row, membership does the work of
+    /// [`residual_filter`](Self::residual_filter) over `predicate`, the price of
+    /// the filter it replaces, so both sides of the choice count the same blob
+    /// reads and predicate leaves.
     ///
     /// * Within one batch, or an empty stream: the filter's work plus the set
     ///   read. Membership can only match the filter there, so it never wins.
     /// * An unbounded stream estimated within one batch: the filter's work less
-    ///   one record read. At the estimate both plans do the same work, but only
-    ///   the membership stops reading records if the stream outgrows the
-    ///   estimate. The credit is the smallest unit of that work, so it settles
-    ///   this tie under every profile without outweighing a real cost difference.
+    ///   one predicate-leaf evaluation. At the estimate both plans do the same
+    ///   work, but only the membership stops reading records if the stream
+    ///   outgrows the estimate. The credit is the smallest unit of that work: it
+    ///   settles this tie under every profile, since it always lowers the CPU
+    ///   units, and never outweighs a record read, such as the second read of a
+    ///   kept row by a residual filter behind the membership.
     /// * Past one batch: the set reads plus one probe per row. An unscoped
     ///   predicate rewrites only when exactly one label's index answers it, so its
     ///   rows are priced as that label's. A row of another label costs one probe
     ///   more than the filter, after reads made at most once per request.
     ///
     /// ```
+    /// use helix_ast::expr::Predicate;
     /// use helix_planner::cost::{
     ///     EstimatedRows, MembershipStream, RecordBatchRows, StorageCostProfile,
     /// };
     /// let profile = StorageCostProfile::default();
     /// let set = profile.bitmap_equality_lookup(EstimatedRows::rows(10));
     /// let label = profile.bitmap_equality_lookup(EstimatedRows::rows(1_000));
-    /// let f = |n| profile.stored_predicate_filter(EstimatedRows::rows(n));
+    /// let kind = Predicate::eq("kind", "B");
+    /// let f = |n| profile.residual_filter(&kind, EstimatedRows::rows(n));
     /// let unbounded = |n| MembershipStream::MayExceedOneBatch(EstimatedRows::rows(n));
     ///
     /// for label_domain in [None, Some(label)] {
-    ///     // An unbounded stream estimated within one batch: one record read less.
-    ///     let cost = profile.index_membership_filter(set, label_domain, unbounded(10));
+    ///     // An unbounded stream estimated within one batch: one leaf evaluation less.
+    ///     let cost = profile.index_membership_filter(&kind, set, label_domain, unbounded(10));
     ///     assert_eq!(
     ///         cost.latency.as_micros(),
-    ///         f(10).latency.as_micros() - profile.authoritative_verify_per_id.as_micros()
+    ///         f(10).latency.as_micros() - profile.cpu_predicate_eval.as_micr
```

**File**: `crates/planner/src/cost/profile/residual.rs` (added, +322/-0)
```diff
@@ -0,0 +1,322 @@
+//! Residual evaluation mirrors the interpreter's per-filter value resolver.
+
+use std::collections::BTreeSet;
+
+use helix_ast::expr::{Expr, Predicate};
+
+use super::{CostVector, EstimatedRows, StorageCostProfile};
+
+#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
+enum GraphRead {
+    CurrentProperties,
+    EdgeEndpoints,
+    FromProperties,
+    ToProperties,
+}
+
+#[derive(Default)]
+struct Evaluation {
+    atoms: u64,
+    reads: BTreeSet<GraphRead>,
+}
+
+impl Evaluation {
+    fn property(&mut self, property: &str) {
+        match property {
+            "$id" | "$score" | "$distance" => {}
+            "$from" | "$to" | "$from.$id" | "$to.$id" => {
+                self.reads.insert(GraphRead::EdgeEndpoints);
+            }
+            property if property.starts_with("$from.") => {
+                self.reads.insert(GraphRead::EdgeEndpoints);
+                self.reads.insert(GraphRead::FromProperties);
+            }
+            property if property.starts_with("$to.") => {
+                self.reads.insert(GraphRead::EdgeEndpoints);
+                self.reads.insert(GraphRead::ToProperties);
+            }
+            _ => {
+                self.reads.insert(GraphRead::CurrentProperties);
+            }
+        }
+    }
+
+    fn expr(&mut self, expr: &Expr) {
+        match expr {
+            Expr::Property(property) => self.property(property),
+            Expr::Add { left, right }
+            | Expr::Sub { left, right }
+            | Expr::Mul { left, right }
+            | Expr::Div { left, right }
+            | Expr::Mod { left, right } => {
+                self.expr(left);
+                self.expr(right);
+            }
+            Expr::Neg { expr } => self.expr(expr),
+            Expr::Case {
+                when_then,
+                else_expr,
+            } => {
+                for branch in when_then {
+                    self.predicate(&branch.when);
+                    self.expr(&branch.then);
+                }
+                else_expr.iter().for_each(|expr| self.expr(expr));
+            }
+            Expr::Id | Expr::Timestamp | Expr::DateTimeNow | Expr::Constant(_) | Expr::Param(_) => {
+            }
+        }
+    }
+
+    fn predicate(&mut self, predicate: &Predicate) {
+        match predicate {
+            Predicate::And { predicates } | Predicate::Or { predicates } => {
+                for predicate in predicates {
+                    self.predicate(predicate);
+                }
+                return;
+            }
+            Predicate::Not { predicate } => {
+                self.predicate(predicate);
+                return;
+            }
+            Predicate::Eq { left, right }
+            | Predicate::Neq { left, right }
+            | Predicate::Gt { left, right }
+            | Predicate::Gte { left, right }
+            | Predicate::Lt { left, right }
+            | Predicate::Lte { left, right }
+            | Predicate::Compare { left, right, .. }
+            | Predicate::StartsWith {
+                value: left,
+                prefix: right,
+            }
+            | Predicate::EndsWith {
+                value: left,
+                suffix: right,
+            }
+            | Predicate::Contains {
+                value: left,
+                substring: right,
+            }
+            | Predicate::IsIn {
+                value: left,
+                values: right,
+            } => {
+                self.expr(left);
+                self.expr(right);
+            }
+            Predicate::Between { value, min, max } => {
+                self.expr(value);
+                self.expr(min);
+                self.expr(max);
+            }
+            Predicate::HasKey { property }
+            | Predicate::IsNull { property }
+            | Predicate::IsNotNull { property } => self.property(property),
+        }
+        self.atoms = self.atoms.saturating_add(1);
+    }
+}
+
+impl StorageCostProfi
```

---

### Incident Patch 10: `6785c184` (2026-09-28)
**Commit Message**: fix(planner): price membership row by row with the residual formula

After the merge, the Filter a membership replaces is priced by
residual_filter, which charges each property blob once per row and every
predicate leaf, while membership's within-one-batch price still came from
stored_predicate_filter, which charges one leaf. The two sides of the
choice no longer counted the same work. Behind a unique source (one row,
unbounded), default profile:

- Label-scoped membership plus a `title` residual cost 1 + 11 = 12 us
  against the whole filter's 13 us and won, although it reads the kept
  record twice where the filter reads it once.
- One-leaf membership plus the same residual and the whole filter both
  came to 12 us, one object read and 3 CPU units: an exact tie left to
  the plan digest.
- On a stream proven to fit one batch, a predicate with enough leaves
  (about 21 at 256 rows against a single-lookup set) made the set read
  that never happens look cheaper than the filter.

index_membership_filter now takes the membership predicate and prices its
row-by-row work with the same residual formula as the filter. The credit
that settles the unbounded within-one-batch tie becomes one

**File**: `crates/planner/src/cost/profile/formulas.rs` (modified, +45/-25)
```diff
@@ -1,5 +1,7 @@
 //! Cost formulas derived from `StorageCostProfile`.
 
+use helix_ast::expr::Predicate;
+
 use crate::cost::{MembershipStream, RECORD_BATCH_ROWS};
 use crate::properties::{KeyLocality, PositiveUsize};
 
@@ -288,65 +290,85 @@ impl StorageCostProfile {
     /// does for `stream`.
     ///
     /// The interpreter evaluates a stream of at most [`RECORD_BATCH_ROWS`] node
-    /// rows row by row, exactly like the per-row filter, and never reads the set.
-    /// Past one batch it reads the secondary set once per request, concurrently
-    /// with the `label_domain` bitmap for an unscoped predicate, probes it once per
-    /// row, and evaluates only rows of other labels.
+    /// rows row by row, exactly like the per-row filter over `predicate`, and
+    /// never reads the set. Past one batch it reads the secondary set once per
+    /// request, concurrently with the `label_domain` bitmap for an unscoped
+    /// predicate, probes it once per row, and evaluates only rows of other labels.
+    ///
+    /// Row by row, membership does the work of
+    /// [`residual_filter`](Self::residual_filter) over `predicate`, the price of
+    /// the filter it replaces, so both sides of the choice count the same blob
+    /// reads and predicate leaves.
     ///
     /// * Within one batch, or an empty stream: the filter's work plus the set
     ///   read. Membership can only match the filter there, so it never wins.
     /// * An unbounded stream estimated within one batch: the filter's work less
-    ///   one record read. At the estimate both plans do the same work, but only
-    ///   the membership stops reading records if the stream outgrows the
-    ///   estimate. The credit is the smallest unit of that work, so it settles
-    ///   this tie under every profile without outweighing a real cost difference.
+    ///   one predicate-leaf evaluation. At the estimate both plans do the same
+    ///   work, but only the membership stops reading records if the stream
+    ///   outgrows the estimate. The credit is the smallest unit of that work: it
+    ///   settles this tie under every profile, since it always lowers the CPU
+    ///   units, and never outweighs a record read, such as the second read of a
+    ///   kept row by a residual filter behind the membership.
     /// * Past one batch: the set reads plus one probe per row. An unscoped
     ///   predicate rewrites only when exactly one label's index answers it, so its
     ///   rows are priced as that label's. A row of another label costs one probe
     ///   more than the filter, after reads made at most once per request.
     ///
     /// ```
+    /// use helix_ast::expr::Predicate;
     /// use helix_planner::cost::{
     ///     EstimatedRows, MembershipStream, RecordBatchRows, StorageCostProfile,
     /// };
     /// let profile = StorageCostProfile::default();
     /// let set = profile.bitmap_equality_lookup(EstimatedRows::rows(10));
     /// let label = profile.bitmap_equality_lookup(EstimatedRows::rows(1_000));
-    /// let f = |n| profile.stored_predicate_filter(EstimatedRows::rows(n));
+    /// let kind = Predicate::eq("kind", "B");
+    /// let f = |n| profile.residual_filter(&kind, EstimatedRows::rows(n));
     /// let unbounded = |n| MembershipStream::MayExceedOneBatch(EstimatedRows::rows(n));
     ///
     /// for label_domain in [None, Some(label)] {
-    ///     // An unbounded stream estimated within one batch: one record read less.
-    ///     let cost = profile.index_membership_filter(set, label_domain, unbounded(10));
+    ///     // An unbounded stream estimated within one batch: one leaf evaluation less.
+    ///     let cost = profile.index_membership_filter(&kind, set, label_domain, unbounded(10));
     ///     assert_eq!(
     ///         cost.latency.as_micros(),
-    ///         f(10).latency.as_micros() - profile.authoritative_verify_per_id.as_micros()
+    ///         f(10).latency.as_micros() - profile.cpu_predicate_eval.as_micr
```

**File**: `crates/planner/src/cost/profile/residual.rs` (modified, +18/-3)
```diff
@@ -138,14 +138,29 @@ impl StorageCostProfile {
     /// assert_eq!(cost.latency.as_micros(), 120);
     /// ```
     pub fn residual_filter(&self, predicate: &Predicate, rows: EstimatedRows) -> CostVector {
+        self.residual_filter_less_leaves(predicate, rows, 0)
+    }
+
+    /// [`Self::residual_filter`] less `credited` predicate-leaf evaluations,
+    /// never below the blob reads.
+    pub(super) fn residual_filter_less_leaves(
+        &self,
+        predicate: &Predicate,
+        rows: EstimatedRows,
+        credited: u64,
+    ) -> CostVector {
         let mut evaluation = Evaluation::default();
         evaluation.predicate(predicate);
         self.authoritative_verification(EstimatedRows::rows(
             rows.as_rows().saturating_mul(evaluation.reads.len() as u64),
         ))
-        .serial(self.predicate_eval(EstimatedRows::rows(
-            rows.as_rows().saturating_mul(evaluation.atoms),
-        )))
+        .serial(
+            self.predicate_eval(EstimatedRows::rows(
+                rows.as_rows()
+                    .saturating_mul(evaluation.atoms)
+                    .saturating_sub(credited),
+            )),
+        )
     }
 }
 
```

**File**: `crates/planner/src/cost/tests.rs` (modified, +57/-19)
```diff
@@ -410,29 +410,67 @@ fn membership_price_never_ties_the_per_row_filter() {
             ..StorageCostProfile::default()
         },
     ];
-    let key = |cost: CostVector| (cost.latency, cost.object_reads);
+    // Membership predicates with one leaf, two as a label-scoped predicate, and
+    // many. Each is priced against the per-row filter over the same predicate.
+    let kind = helix_ast::expr::Predicate::eq("kind", "B");
+    let predicates = [
+        kind.clone(),
+        helix_ast::expr::Predicate::and(vec![
+            helix_ast::expr::Predicate::eq("$label", "Attribute"),
+            kind,
+        ]),
+        helix_ast::expr::Predicate::or(
+            (0..32)
+                .map(|value| helix_ast::expr::Predicate::eq("kind", value))
+                .collect(),
+        ),
+    ];
+    // An unindexed conjunct stays a residual filter behind the membership.
+    let residual = helix_ast::expr::Predicate::contains("title", "x");
     for profile in &profiles {
         let set = profile.bitmap_equality_lookup(EstimatedRows::rows(10));
         let label = profile.bitmap_equality_lookup(EstimatedRows::rows(1_000));
-        for count in 0..=RECORD_BATCH_ROWS {
-            let rows = EstimatedRows::rows(count);
-            let filter = key(profile.stored_predicate_filter(rows));
-            for label_domain in [None, Some(label)] {
-                let unbounded = key(profile.index_membership_filter(
-                    set,
-                    label_domain,
-                    MembershipStream::MayExceedOneBatch(rows),
-                ));
-                let bounded = key(profile.index_membership_filter(
-                    set,
-                    label_domain,
-                    MembershipStream::WithinOneBatch(RecordBatchRows::at_most(count)),
-                ));
-                match count {
-                    0 => assert!(unbounded > filter, "{profile:?} rows {count}"),
-                    _ => assert!(unbounded < filter, "{profile:?} rows {count}"),
+        for predicate in &predicates {
+            let whole = helix_ast::expr::Predicate::and(vec![predicate.clone(), residual.clone()]);
+            for count in 0..=RECORD_BATCH_ROWS {
+                let rows = EstimatedRows::rows(count);
+                let filter = crate::optimizer::cost_key(profile.residual_filter(predicate, rows));
+                for label_domain in [None, Some(label)] {
+                    let unbounded = profile.index_membership_filter(
+                        predicate,
+                        set,
+                        label_domain,
+                        MembershipStream::MayExceedOneBatch(rows),
+                    );
+                    let bounded = crate::optimizer::cost_key(profile.index_membership_filter(
+                        predicate,
+                        set,
+                        label_domain,
+                        MembershipStream::WithinOneBatch(RecordBatchRows::at_most(count)),
+                    ));
+                    match count {
+                        0 => assert!(
+                            crate::optimizer::cost_key(unbounded) > filter,
+                            "{profile:?} {predicate:?} rows {count}"
+                        ),
+                        _ => assert!(
+                            crate::optimizer::cost_key(unbounded) < filter,
+                            "{profile:?} {predicate:?} rows {count}"
+                        ),
+                    }
+                    assert!(bounded > filter, "{profile:?} {predicate:?} rows {count}");
+
+                    // When the set keeps every row, the residual reads each kept
+                    // record a second time, which outweighs the membership's
+                    // credit even at a single row: the whole predicate stays
+                    // one per-row filter.
+                    assert!(
+                        crate::optimizer::cost_key(
+                            unbound
```

**File**: `crates/planner/src/exec/selected/lowering/access/pipeline.rs` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ impl ExecutableDagBuilder<'_> {
                 delivered: filtered_delivered_properties(delivered),
                 // Lowering has no statistics; selection already priced the set.
                 cost: self.profile.index_membership_filter(
+                    plan.predicate().as_ref(),
                     self.profile
                         .bitmap_equality_lookup(self.profile.default_equality_index_rows),
                     match plan.outside_label() {
```

**File**: `crates/planner/src/planning/tests/optimizer/index_membership.rs` (modified, +51/-2)
```diff
@@ -870,6 +870,54 @@ fn partial_conjunctions_within_one_batch_keep_the_filter() {
     );
 }
 
+#[test]
+fn partial_conjunctions_behind_a_unique_source_keep_the_filter() {
+    // A unique source proves one row and its expansions keep that estimate.
+    // Every leaf of a predicate is priced on both sides of the choice, so at
+    // one row the residual's second record read is the only difference, and
+    // the membership's one-leaf credit never outweighs it.
+    let mut unique = ctx(membership_indexes());
+    unique.indexes.node_eq.insert(
+        ScopedPropertyKey::try_new("Group", "name").unwrap(),
+        NodeEqualityIndexMeta::try_new("group-name")
+            .unwrap()
+            .with_uniqueness(IndexUniqueness::Unique),
+    );
+    let title = Predicate::contains("title", "x");
+    for (decided, partial) in [
+        (
+            Predicate::eq("kind", "B"),
+            Predicate::and(vec![Predicate::eq("kind", "B"), title.clone()]),
+        ),
+        (
+            Predicate::and(vec![
+                Predicate::eq("$label", "Attribute"),
+                Predicate::eq("kind", "B"),
+            ]),
+            Predicate::and(vec![
+                Predicate::eq("$label", "Attribute"),
+                Predicate::eq("kind", "B"),
+                title.clone(),
+            ]),
+        ),
+    ] {
+        // Membership alone still wins by its credit, whatever its leaf count.
+        let plan = executable_traversal(
+            attributes_where(decided.clone()).values(vec!["kind"]),
+            unique.clone(),
+        );
+        assert_eq!(only_membership(&plan).predicate.predicate(), &decided);
+        assert!(filter_predicates(&plan).is_empty(), "{:#?}", plan.steps());
+
+        let plan = executable_traversal(
+            attributes_where(partial.clone()).values(vec!["kind"]),
+            unique.clone(),
+        );
+        assert!(memberships(&plan).is_empty(), "{:#?}", plan.steps());
+        assert_eq!(filter_predicates(&plan), [&partial]);
+    }
+}
+
 #[test]
 fn equality_seed_residual_stays_a_filter_under_a_count_with_membership() {
     // Count cursors price their operators at the unknown-input default, so
@@ -923,8 +971,9 @@ fn equality_seed_residual_stays_a_filter_under_a_count_with_membership() {
 #[test]
 fn statistics_price_membership_by_what_the_runtime_reads() {
     // 300 rows past one batch pay the set reads (6,400 or 5,360 us) above the
-    // filter's 3,300 us; 5,000 rows amortize them; no statistics keeps the
-    // unbounded point-source estimate within one batch.
+    // filter's 3,300 or 3,600 us (one or two predicate leaves); 5,000 rows
+    // amortize them; no statistics keeps the unbounded point-source estimate
+    // within one batch.
     for (group_rows, chooses_membership) in [(Some(300), false), (Some(5_000), true), (None, true)]
     {
         let planner_ctx = group_rows.map_or(ctx(membership_indexes()), |rows| {
```

#### Recent Merged Pull Requests:
- **PR #1153** (2026-09-30): feat(docs): track docs visits with Databuddy (@xav-db)
- **PR #1152** (2026-09-30): chore(deps): bump the npm_and_yarn group across 2 directories with 4 updates (@dependabot[bot])
- **PR #1151** (2026-09-30): Release CLI 3.4.1 and Docker v0.0.8 (@xav-db)
- **PR #1150** (2026-09-30): perf(planner,db): always use indexes for filters after expansions and read index sets concurrently (@xav-db)
- **PR #1149** (2026-09-30): ci: fix the DB production coverage job (@xav-db)
- **PR #1148** (2026-09-29): chore: remove Hyperscale migration parity harness (@xav-db)
- **PR #1147** (2026-09-29): chore: remove UNIQUE_EQUALITY_FIX_PLAN.md (@xav-db)
- **PR #1146** (2026-09-28): Release CLI 3.4.0 and Docker v0.0.7 (@xav-db)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
