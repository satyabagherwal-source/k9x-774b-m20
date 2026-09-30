# Forensic Learning Record (Deep Inspection): tensorchord/pgvecto.rs

> **Canonical Artifact**: `07_PROJECT_LEARNING/tensorchord-pgvecto.rs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tensorchord/pgvecto.rs](https://github.com/tensorchord/pgvecto.rs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:32:05.520Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tensorchord/pgvecto.rs`
- **Description**: Scalable, Low-latency and Hybrid-enabled Vector Search in Postgres. Revolutionize Vector Search, not Database.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2189 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/base/src/aligned.rs`
```
#[derive(Debug, Clone, Copy)]
#[repr(C, align(16))]
pub struct Aligned16<T>(pub T);

#[derive(Debug, Clone, Copy)]
#[repr(C, align(32))]
pub struct Aligned32<T>(pub T);

```

### Core Architecture Module: `crates/base/src/always_equal.rs`
```
use serde::{Deserialize, Serialize};
use std::{cmp::Ordering, hash::Hash};

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[repr(transparent)]
#[serde(transparent)]
pub struct AlwaysEqual<T>(pub T);

impl<T> PartialEq for AlwaysEqual<T> {
    fn eq(&self, _: &Self) -> bool {
        true
    }
}

impl<T> Eq for AlwaysEqual<T> {}

impl<T> PartialOrd for AlwaysEqual<T> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl<T> Ord for AlwaysEqual<T> {
    fn cmp(&self, _: &Self) -> Ordering {
        Ordering::Equal
    }
}

impl<T> Hash for AlwaysEqual<T> {
    fn hash<H: std::hash::Hasher>(&self, _: &mut H) {}
}

```

### Core Architecture Module: `crates/base/src/index.rs`
```
use crate::distance::*;
use crate::vector::*;
use base_macros::Alter;
use serde::{Deserialize, Serialize};
use std::num::NonZeroU128;
use thiserror::Error;
use validator::{Validate, ValidationError};

#[must_use]
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum CreateError {
    #[error("Invalid index options: {reason}.")]
    InvalidIndexOptions { reason: String },
}

#[must_use]
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum DropError {
    #[error("Index not found.")]
    NotExist,
}

#[must_use]
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum FlushError {
    #[error("Index not found.")]
    NotExist,
}

#[must_use]
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum InsertError {
    #[error("Index not found.")]
    NotExist,
    #[error("Invalid vector.")]
    InvalidVector,
}

#[must_use]
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum DeleteError {
    #[error("Index not found.")]
    NotExist,
}

#[must_use]
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum VbaseError {
    #[error("Index not found.")]
    NotExist,
    #[error("Invalid vector.")]
    InvalidVector,
    #[error("Invalid search options.")]
    InvalidSearchOptions { reason: String },
}

#[must_use]
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum ListError {
    #[error("Index not found.")]
    NotExist,
}

#[must_use]
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum StatError {
    #[error("Index not found.")]
    NotExist,
}

#[must_use]
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum AlterError {
    #[error("Index not found.")]
    NotExist,
    #[error("Key {key} not found.")]
    KeyNotExists { key: String },
    #[error("Invalid index options: {reason}.")]
    InvalidIndexOptions { reason: String },
}

#[must_use]
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum StopError {
    #[error("Index not found.")]
    NotExist,
}

#[must_use]
#[derive(Debug, Clone, Error, Serialize, Deserialize)]
pub enum StartError {
    #[error("Index not found.")]
    NotExist,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(deny_unknown_fields)]
#[validate(schema(function = "IndexOptions::validate_self"))]
pub struct IndexOptions {
    #[validate(nested)]
    pub vector: VectorOptions,
    #[validate(nested)]
    pub indexing: IndexingOptions,
}

impl IndexOptions {
    fn validate_self(&self) -> Result<(), ValidationError> {
        match &self.indexing {
            IndexingOptions::Flat(FlatIndexingOptions { quantization }) => {
                if quantization.is_some()
                    && !matches!(self.vector.v, VectorKind::Vecf32 | VectorKind::Vecf16)
                {
                    return Err(ValidationError::new(
                        "quantization is only supported for dense vectors",
                    ));
                }
            }
            IndexingOptions::Ivf(IvfIndexingOptions { quantization, .. }) => {
                if !matches!(self.vector.v, VectorKind::Vecf32 | VectorKind::Vecf16) {
                    return Err(ValidationError::new(
                        "ivf is only supported for dense vectors",
                    ));
                }
                if quantization.is_some()
                    && !matches!(self.vector.v, VectorKind::Vecf32 | VectorKind::Vecf16)
                {
                    return Err(ValidationError::new(
                        "quantization is only supported for dense vectors",
                    ));
                }
            }
            IndexingOptions::Hnsw(HnswIndexingOptions { quantization, .. }) => {
                if quantization.is_some()
                    && !matches!(self.vector.v, VectorKind::Vecf32 | VectorKind::Vecf16)
                {
                    return Err(ValidationError::new(
                        "quantization is only supported for dense vectors",
                    ));
                }
            }
            IndexingOptions::SparseInvertedIndex(_) => {
                if !matches!(self.vector.v, VectorKind::SVecf32) {
                    return Err(ValidationError::new(
                        "sparse_inverted_index is only supported for sparse vectors",
                    ));
                }
                if !matches!(self.vector.d, DistanceKind::Dot) {
                    return Err(ValidationError::new(
                        "sparse_inverted_index is only supported for dot distance",
                    ));
                }
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, Validate, Alter)]
#[serde(deny_unknown_fields)]
pub struct IndexAlterableOptions {
    #[serde(default)]
    #[validate(nested)]
    pub segment: SegmentOptions,
    #[serde(default)]
    #[validate(nested)]
    pub optimizing: OptimizingOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
#[serde(deny_unknown_fields)]
#[validate(schema(function = "Self::validate_self"))]
pub struct VectorOptions {
    #[validate(range(min = 1, max = 1_048_575))]
    #[serde(rename = "dimensions")]
    pub dims: u32,
    #[serde(rename = "vector")]
    pub v: VectorKind,
    #[serde(rename = "distance")]
    pub d: DistanceKind,
}

impl VectorOptions {
    pub fn validate_self(&self) -> Result<(), ValidationError> {
        match (self.v, self.d, self.dims) {
            (VectorKind::Vecf32, DistanceKind::L2, 1..65536) => Ok(()),
            (VectorKind::Vecf32, DistanceKind::Dot, 1..65536) => Ok(()),
            (VectorKind::Vecf16, DistanceKind::L2, 1..65536) => Ok(()),
            (VectorKind::Vecf16, DistanceKind::Dot, 1..65536) => Ok(()),
            (VectorKind::SVecf32, DistanceKind::L2, 1..1048576) => Ok(()),
            (VectorKind::SVecf32, DistanceKind::Dot, 1..1048576) => Ok(()),
            (VectorKind::BVector, DistanceKind::Dot, 1..65536) => Ok(()),
            (VectorKind::BVector, DistanceKind::Hamming, 1..65536) => Ok(()),
            (VectorKind::BVector, DistanceKind::Jaccard, 1..65536) => Ok(()),
            _ => Err(ValidationError::new("not valid vector options")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate, Alter)]
#[serde(deny_unknown_fields)]
pub struct SegmentOptions {
    #[serde(default = "SegmentOptions::default_max_growing_segment_size")]
    #[validate(range(min = 1, max = 4_000_000_000u32))]
    pub max_growing_segment_size: u32,
    #[serde(default = "SegmentOptions::default_max_sealed_segment_size")]
    #[validate(range(min = 1, max = 4_000_000_000u32))]
    pub max_sealed_segment_size: u32,
}

impl SegmentOptions {
    fn default_max_growing_segment_size() -> u32 {
        20_000
    }
    fn default_max_sealed_segment_size() -> u32 {
        4_000_000_000u32
    }
}

impl Default for SegmentOptions {
    fn default() -> Self {
        Self {
            max_growing_segment_size: Self::default_max_growing_segment_size(),
            max_sealed_segment_size: Self::default_max_sealed_segment_size(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate, Alter)]
#[serde(deny_unknown_fields)]
pub struct OptimizingOptions {
    #[serde(default = "OptimizingOptions::default_sealing_secs")]
    #[validate(range(min = 1, max = 86400))]
    pub sealing_secs: u64,
    #[serde(default = "OptimizingOptions::default_sealing_size")]
    #[validate(range(min = 1, max = 4_000_000_000u32))]
    pub sealing_size: u32,
    #[serde(default = "OptimizingOptions::default_optimizing_secs")]
    #[validate(range(min = 1, max = 86400))]
    pub optimizing_secs: u64,
    #[serde(default = "OptimizingOptions::default_optimizing_threads")]
    #[validate(range(min = 1, max = 65535))]
    pub optimizing_threads: u16,
    #[serde(default = "OptimizingOptions::default_delete_threshold")]
    #[validate(range(min = 0.0001, max = 1.0000))]
    pub delete_threshold: f64,
}

impl OptimizingOptions {
    fn default
```

### Core Architecture Module: `crates/base/src/lib.rs`
```
#![feature(avx512_target_feature)]
#![cfg_attr(target_arch = "x86_64", feature(stdarch_x86_avx512))]
#![cfg_attr(target_arch = "x86_64", feature(stdarch_x86_avx512_f16))]
#![allow(clippy::derivable_impls)]
#![allow(clippy::len_without_is_empty)]
#![allow(clippy::len_zero)]
#![allow(clippy::needless_range_loop)]
#![allow(clippy::nonminimal_bool)]

pub mod aligned;
pub mod always_equal;
pub mod distance;
pub mod index;
pub mod operator;
pub mod pod;
pub mod rand;
pub mod scalar;
pub mod search;
pub mod vector;
pub mod worker;

```

### Core Architecture Module: `crates/base/src/operator/bvect_dot.rs`
```
use crate::distance::*;
use crate::operator::*;
use crate::vector::*;

#[derive(Debug, Clone, Copy)]
pub enum BVectorDot {}

impl Operator for BVectorDot {
    type Vector = BVectOwned;

    fn distance(lhs: Borrowed<'_, Self>, rhs: Borrowed<'_, Self>) -> Distance {
        lhs.operator_dot(rhs)
    }
}

```

### Core Architecture Module: `crates/base/src/operator/bvect_hamming.rs`
```
use crate::distance::*;
use crate::operator::*;
use crate::vector::*;

#[derive(Debug, Clone, Copy)]
pub enum BVectorHamming {}

impl Operator for BVectorHamming {
    type Vector = BVectOwned;

    fn distance(lhs: Borrowed<'_, Self>, rhs: Borrowed<'_, Self>) -> Distance {
        lhs.operator_hamming(rhs)
    }
}

```

### Core Architecture Module: `crates/base/src/operator/bvect_jaccard.rs`
```
use crate::distance::*;
use crate::operator::*;
use crate::vector::*;

#[derive(Debug, Clone, Copy)]
pub enum BVectorJaccard {}

impl Operator for BVectorJaccard {
    type Vector = BVectOwned;

    fn distance(lhs: Borrowed<'_, Self>, rhs: Borrowed<'_, Self>) -> Distance {
        lhs.operator_jaccard(rhs)
    }
}

```

### Core Architecture Module: `crates/base/src/operator/mod.rs`
```
mod bvect_dot;
mod bvect_hamming;
mod bvect_jaccard;
mod svect_dot;
mod svect_l2;
mod vect_dot;
mod vect_l2;

pub use bvect_dot::BVectorDot;
pub use bvect_hamming::BVectorHamming;
pub use bvect_jaccard::BVectorJaccard;
pub use svect_dot::SVectDot;
pub use svect_l2::SVectL2;
pub use vect_dot::VectDot;
pub use vect_l2::VectL2;

use crate::distance::*;
use crate::vector::*;

pub trait Operator: Copy + 'static + Send + Sync {
    type Vector: VectorOwned;

    fn distance(lhs: Borrowed<'_, Self>, rhs: Borrowed<'_, Self>) -> Distance;
}

pub type Borrowed<'a, T> = <<T as Operator>::Vector as VectorOwned>::Borrowed<'a>;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #653** (2025-11-25): **Public API try_pod_read_unaligned causes Out-of-Bounds read due to missing length check**
  *Symptoms*: Hello, We are working on a static analysis tool designed to detect unsoundness and safety violations in Rust projects. We discovered a soundness issue in crates/base/src/pod.rs. Location: https://github.com/tensorchord/pgvecto.rs/blob/2b290b34e8ba69104ea2f800fa53328c6ed6c236/crates/base/src/pod.rs#L51 The vulnerability is located in the public function try_pod_read_unaligned: ``` pub fn try_pod_read_unaligned<T: Pod>(bytes: &[u8]) -> T {     unsafe { (bytes.as_ptr() as *const T).read_unaligned() } } ```  Since this function is pub and located in a pub mod, it is exposed to external consumers. Description: The function attempts to read a value of type T from a byte slice &[u8] using ptr::read_unaligned. While read_unaligned handles alignment correctly, it assumes the pointer is valid for std::mem::size_of::<T>() bytes. The function fails to verify that the input slice bytes has enough data to form a T. If bytes.len() < std::mem::size_of::<T>(), calling this function results in an immediate Buffer Over-read, which is Undefined Behavior (UB). As a safe function, it must verify the bounds before performing the unsafe read. Proof of Concept (PoC): We constructed a PoC where we attempt to read a u32 (4 bytes) from a slice containing only 1 byte. ``` use std::mem;  // Mocking the Pod trait definition from the crate pub unsafe trait Pod: Copy {} unsafe impl Pod for u32 {}  // The vulnerable function from crates/base/src/pod.rs pub fn try_pod_read_unaligned<T: Pod>(bytes: &[u8]) -> T 
  **Post-Mortem & Fix Analysis**:
  > same problem for https://github.com/tensorchord/pgvecto.rs/blob/2b290b34e8ba69104ea2f800fa53328c6ed6c236/crates/base/src/pod.rs#L38  and  https://github.com/tensorchord/pgvecto.rs/blob/2b290b34e8ba69104ea2f800fa53328c6ed6c236/crates/base/src/pod.rs#L42  but these are postcondition unsoundness
  > The project is no longer maintained. Existing users are migrating to https://github.com/tensorchord/VectorChord. If you discover any unsoundness there, please open a new issue.

- **Issue #649** (2025-08-19): **Does pgvecto.rs support iterative scan when using WHERE relational filters and LIMIT?**
  *Symptoms*: Hi, I’m currently using pgvecto.rs v0.3.0 and encountered a situation where, on different environments with the same dataset, I executed the same embedding search query using a SQL WHERE relational filter (not distance-based filtering) combined with LIMIT 10.  However, in one of the environments, the query only returned 1 chunk, while in the others, it consistently returned the expected 10 chunks.  I’d like to ask if pgvecto.rs supports something similar to pgvector v0.8.0’s iterative scan feature:  > If too few results from the initial index scan match the filters, the scan will continue until enough matching results are found. (In other words, when the ANN index can’t fulfill the LIMIT, it continues iterating through the HNSW graph until enough matching rows are found.) Ref: - https://www.postgresql.org/about/news/pgvector-080-released-2952/ - https://github.com/pgvector/pgvector/issues/671 - https://github.com/pgvector/pgvector/issues/259#issuecomment-2362500744  Does pgvecto.rs currently support this behavior, or is there a recommended workaround to ensure enough filtered results are returned across environments?  Thanks for your help!
  **Post-Mortem & Fix Analysis**:
  > Increase ef_search should solve your problem, like `SET vectors.hnsw_ef_search=512;`.  We no longer maintain pgvecto.rs now, and recommend user to migrate to VectorChord. It's faster and more stable in performance.  And for iterative scan, pgvecto.rs is the first one introduce it to postgres as VBASE filtering.
  > Thanks for the quick reply! I actually tried setting vectors.hnsw_ef_search = 10000; earlier — it did help, and the number of returned chunks increased from 1 to 3.  Thanks also for clarifying the maintenance status of pgvecto.rs and recommending VectorChord. I’ll take a closer look at it.  Appreciate your help!
  > Another trick is to use other index on your filter condition columns. You can simply do this write `ORDER BY distance + 0` instead of `ORDER BY distance`

- **Issue #644** (2025-03-15): **The extension is upgraded so all index files are outdated.**
  *Symptoms*: **I know i use immich here but the issue pertains to pgvecto.rs** https://pastebin.com/MYCAVpUH I get this error from my immich server when I start it, no errors from my postgres db, I would go to the linked documentation but the documentation website is down. So I went to the upgrading section of your new docs and also tried running these commands within the db: ``` ALTER EXTENSION vectors UPDATE; SELECT pgvectors_upgrade(); ``` Context:  I was on a migration from docker to k8s, I accidentally used regular postgres at 0.15 instead of 0.14 which was what it was prior, and then i tried changing the image to pgvector, I did the wrong version of pg vector until i downgraded and found the right one  Error: https://pastebin.com/Nr4ukMk0 The error is mainly this:  ``` microservices worker error: QueryFailedError: pgvecto.rs: The extension is upgraded so all index files are outdated. ADVICE: Delete all index files. Please read `https://docs.pgvecto.rs/admin/upgrading.html`, stack: QueryFailedError: pgvecto.rs: The extension is upgraded so all index files are outdated. ADVICE: Delete all index files. Please read `https://docs.pgvecto.rs/admin/upgrading.html`     at PostgresQueryRunner.query (/usr/src/app/node_modules/typeorm/driver/postgres/PostgresQueryRunner.js:219:19)     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)     at async AddCLIPEmbeddingIndex1700713994428.up (/usr/src/app/dist/migrations/1700713994428-AddCLIPEmbeddingIndex.js:14:9)     at 
  **Post-Mortem & Fix Analysis**:
  > Nevermind, turns out a few minor fixes, mainly restarting a few of my deployments re-running those commands fixed it (alter and select)

- **Issue #642** (2025-02-26): **docs: update to ghcr in README**
  *Symptoms*: 

- **Issue #641** (2025-02-27): **rootless images still run as root?**
  *Symptoms*: I'm trying to deploy a postgresCluster using Crunchy Postgres Operator with a tensorchord/pgvecto-rs rootless image. When deploying the PostgresCluster resource to my k3s-cluster I get the error "Error: container has runAsNonRoot and image will run as root". I reckon this is due to the CSS RunAsNonRoot: true that is set on the statefulset that is created by the operator.  I've tried two different images so far, pg16-v0.2.1-rootless &  pg17-v0.4.0-rootless and I get the same error on both. Am I missing something or could it be that the rootless images do run as root?
  **Post-Mortem & Fix Analysis**:
  > Can you try https://github.com/tensorchord/cloudnative-pgvecto.rs?
  > Thank you for the tip! I tried tensorchord/cloudnative-pgvecto-rs:17-v0.4.0 and got another, though similar, error:   "Error: container has runAsNonRoot and image has non-numeric user (postgres), cannot verify user is non-root"  I tried to manually play around in the statefulset of the -instance pod, using the cloudnative image. I added "runAsUser:1000" to all places where the image was used. That took me past that initial error but then gave me another seemingly unrelated error, something about "patrini $PATH not being found".  Has any of the images (either cloudnative or pgvecto.rs) successfully been used with crunchy pgo? Tried to google it but didn't find anything.  
  > I have no idea if this helps, but I did very simple new build based on tensorchord/pgvecto.rs:pg17-v0.4.0:  FROM tensorchord/pgvecto-rs:pg17-v0.4.0 USER 999   When I use this image I don't get any of the nonroot errors, but I get the same error I got with the cloudnative-pgvecto.rs image after I tinkerd with the statefulset.  "Error: failed to create containerd task: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "patroni": executable file not found in $PATH: unknown"  I'm really not sure if this is a bug or problem with combining the image with crunchy or if I messed up somewhere. Though it would be really nice to get the pgvecto.rs image to work with the operator for sure. 

- **Issue #640** (2025-02-24): **docs: add 'migrate to vectorchord' in readme**
  *Symptoms*: 

- **Issue #639** (2025-02-24): **chore: fix ghcr release**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > @kemingy thanks for pushing now to ghcr.io too. Would it be possible to push this tag to ghcr too: `tensorchord/pgvecto-rs:pg14-v0.2.0` since this would help users with Immich.  I assume this change was made because of the upcoming rate limit change on DockerHub on 1. April 2025
  > > @kemingy thanks for pushing now to ghcr.io too. Would it be possible to push this tag to ghcr too: `tensorchord/pgvecto-rs:pg14-v0.2.0` since this would help users with Immich. >  > I assume this change was made because of the upcoming rate limit change on DockerHub on 1. April 2025  All the formal releases have been synced to ghcr.
  > @kemingy thanks, I saw that it synced about 10 minutes ago... :) Sorry for the noise and thank you!

- **Issue #638** (2025-02-24): **chore: run rust test on ubuntu 22.04**
  *Symptoms*: 

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

### Incident Patch 1: `8ebab135` (2025-02-24)
**Commit Message**: chore: fix ghcr release (#639)

* test ghcr action

Signed-off-by: Keming <kemingyang@tensorchord.ai>

* fix if

Signed-off-by: Keming <kemingyang@tensorchord.ai>

* fix test

Signed-off-by: Keming <kemingyang@tensorchord.ai>

---------

Signed-off-by: Keming <kemingyang@tensorchord.ai>

**File**: `.github/workflows/release.yml` (modified, +0/-1)
```diff
@@ -174,7 +174,6 @@ jobs:
           username: ${{ secrets.DOCKERIO_USERNAME }}
           password: ${{ secrets.DOCKERIO_TOKEN }}
       - name: Push postgres with pgvecto.rs to Docker Registry
-        if: matrix.rootless == false
         uses: docker/build-push-action@v4
         with:
           context: .
```

---

### Incident Patch 2: `eb9fbaee` (2025-01-17)
**Commit Message**: docs: fix discord and x badge (#632)

Signed-off-by: Keming <kemingyang@tensorchord.ai>

**File**: `README.md` (modified, +2/-2)
```diff
@@ -3,8 +3,8 @@
 </div>
 
 <p align=center>
-<a href="https://discord.gg/KqswhpVgdU"><img alt="discord invitation link" src="https://dcbadge.vercel.app/api/server/KqswhpVgdU?style=flat"></a>
-<a href="https://twitter.com/TensorChord"><img src="https://img.shields.io/twitter/follow/tensorchord?style=social" alt="trackgit-views" /></a>
+<a href="https://discord.gg/KqswhpVgdU"><img alt="discord invitation link" src="https://img.shields.io/discord/974584200327991326?style=flat&logo=discord&cacheSeconds=60"></a>
+<a href="https://twitter.com/TensorChord"><img src="https://img.shields.io/twitter/follow/tensorchord?style=flat&logo=X&cacheSeconds=60" alt="trackgit-views" /></a>
 <a href="https://hub.docker.com/r/tensorchord/pgvecto-rs"><img src="https://img.shields.io/docker/pulls/tensorchord/pgvecto-rs" /></a>
 <a href="https://github.com/tensorchord/pgvecto.rs#contributors-"><img alt="all-contributors" src="https://img.shields.io/github/all-contributors/tensorchord/pgvecto.rs/main"></a>
 </p>
```

---

### Incident Patch 3: `ae115754` (2025-01-01)
**Commit Message**: chore: Fix links (#627)

Signed-off-by: Ce Gao <gaocegege@hotmail.com>

**File**: `README.md` (modified, +12/-12)
```diff
@@ -13,7 +13,7 @@ pgvecto.rs is a Postgres extension that provides vector similarity search functi
 
 ## Comparison with pgvector
 
-Checkout [pgvecto.rs vs pgvector](https://docs.pgvecto.rs/faqs/comparison-pgvector.html) for more details.
+Checkout [pgvecto.rs vs pgvector](https://docs.vectorchord.ai/faqs/comparison-pgvector.html) for more details.
 
 | Feature | pgvecto.rs | pgvector |
 | --- | --- | --- |
@@ -24,19 +24,19 @@ Checkout [pgvecto.rs vs pgvector](https://docs.pgvecto.rs/faqs/comparison-pgvect
 | Indexing | Handles the storage and memory of indexes separately from PostgreSQL | Relies on the native storage engine of PostgreSQL |
 | WAL Support | Provides Write-Ahead Logging (WAL) support for data, index support is working in progress. | Provides Write-Ahead Logging (WAL) support for index and data. |                         |
 
-## [Documentation](https://docs.pgvecto.rs/getting-started/overview.html)
+## [Documentation](https://docs.vectorchord.ai/getting-started/overview.html)
 
 - Getting Started
-  - [Overview](https://docs.pgvecto.rs/getting-started/overview.html)
-  - [Installation](https://docs.pgvecto.rs/getting-started/installation.html)
+  - [Overview](https://docs.vectorchord.ai/getting-started/overview.html)
+  - [Installation](https://docs.vectorchord.ai/getting-started/installation.html)
 - Usage
-  - [Indexing](https://docs.pgvecto.rs/usage/indexing.html)
-  - [Search](https://docs.pgvecto.rs/usage/search.html)
+  - [Indexing](https://docs.vectorchord.ai/usage/indexing.html)
+  - [Search](https://docs.vectorchord.ai/usage/search.html)
 - Administration
-  - [Configuration](https://docs.pgvecto.rs/admin/configuration.html)
-  - [Upgrading from older versions](https://docs.pgvecto.rs/admin/upgrading.html)
+  - [Configuration](https://docs.vectorchord.ai/admin/configuration.html)
+  - [Upgrading from older versions](https://docs.vectorchord.ai/admin/upgrading.html)
 - Developers
-  - [Development Tutorial](https://docs.pgvecto.rs/developers/development.html)
+  - [Development Tutorial](https://docs.vectorchord.ai/developers/development.html)
 
 ## Quick start
 
@@ -119,15 +119,15 @@ SELECT * FROM items ORDER BY embedding <-> '[3,2,1]' LIMIT 5;
 
 ### A simple Question-Answering application
 
-Please check out the [Question-Answering application](https://docs.pgvecto.rs/use-case/question-answering.html) tutorial.
+Please check out the [Question-Answering application](https://docs.vectorchord.ai/use-case/question-answering.html) tutorial.
 
 ### Half-precision floating-point
 
 `vecf16` type is the same with `vector` in anything but the scalar type. It stores 16-bit floating point numbers. If you want to reduce the memory usage to get better performance, you can try to replace `vector` type with `vecf16` type.
 
 ## Roadmap 🗂️
 
-Please check out [ROADMAP](https://docs.pgvecto.rs/community/roadmap.html). Want to jump in? Welcome discussions and contributions!
+Please check out [ROADMAP](https://docs.vectorchord.ai/community/roadmap.html). Want to jump in? Welcome discussions and contributions!
 
 - Chat with us on [💬 Discord](https://discord.gg/KqswhpVgdU)
 - Have a look at [`good first issue 💖`](https://github.com/tensorchord/pgvecto.rs/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue+%E2%9D%A4%EF%B8%8F%22) issues!
@@ -137,7 +137,7 @@ Please check out [ROADMAP](https://docs.pgvecto.rs/community/roadmap.html). Want
 We welcome all kinds of contributions from the open-source community, individuals, and partners.
 
 - Join our [discord community](https://discord.gg/KqswhpVgdU)!
-- To build from the source, please read our [contributing documentation](https://docs.pgvecto.rs/community/contributing.html) and [development tutorial](https://docs.pgvecto.rs/developers/development.html).
+- To build from the source, please read our [contributing documentation](https://docs.vectorchord.ai/community/contributing.html) and [development tutorial](https://docs.vectorchord.ai/developers/development.html).

```

---

### Incident Patch 4: `06e1c768` (2024-11-21)
**Commit Message**: fix: confict typmod for _vectors_cast_array_to_vecf32 (#617)

Signed-off-by: cutecutecat <junyuchen@tensorchord.ai>

**File**: `sql/upgrade/vectors--0.3.0--0.4.0.sql` (modified, +38/-14)
```diff
@@ -907,16 +907,40 @@ IMMUTABLE STRICT PARALLEL SAFE
 LANGUAGE c /* Rust */
 AS 'MODULE_PATHNAME', '_vectors_cast_bvector_to_vecf32_wrapper';
 
--- src/datatype/casts.rs:10
--- vectors::datatype::casts::_vectors_cast_array_to_vecf32
-CREATE OR REPLACE FUNCTION "_vectors_cast_array_to_vecf32"(
-    "array" real[], /* pgrx::datum::array::Array<f32> */
-    "typmod" INT, /* i32 */
-    "_explicit" bool /* bool */
-) RETURNS vector /* vectors::datatype::memory_vecf32::Vecf32Output */
-IMMUTABLE STRICT PARALLEL SAFE
-LANGUAGE c /* Rust */
-AS 'MODULE_PATHNAME', '_vectors_cast_array_to_vecf32_wrapper';
+-- There might be a conflict of `typmod` or `_typmod`
+DO $$
+DECLARE
+    func_arg_2 TEXT;
+BEGIN
+    SELECT parameter_name INTO func_arg_2
+    FROM information_schema.routines
+        LEFT JOIN information_schema.parameters ON routines.specific_name=parameters.specific_name
+    WHERE routines.specific_schema='vectors' AND routines.routine_name='_vectors_cast_array_to_vecf32' AND parameters.ordinal_position=2 
+    ORDER BY routines.routine_name, parameters.ordinal_position;
+    IF func_arg_2 = '_typmod' THEN
+        -- src/datatype/casts.rs:10
+        -- vectors::datatype::casts::_vectors_cast_array_to_vecf32
+        CREATE OR REPLACE FUNCTION "_vectors_cast_array_to_vecf32"(
+            "array" real[], /* pgrx::datum::array::Array<f32> */
+            "_typmod" INT, /* i32 */
+            "_explicit" bool /* bool */
+        ) RETURNS vector /* vectors::datatype::memory_vecf32::Vecf32Output */
+        IMMUTABLE STRICT PARALLEL SAFE
+        LANGUAGE c /* Rust */
+        AS 'MODULE_PATHNAME', '_vectors_cast_array_to_vecf32_wrapper';
+    ELSE
+        -- src/datatype/casts.rs:10
+        -- vectors::datatype::casts::_vectors_cast_array_to_vecf32
+        CREATE OR REPLACE FUNCTION "_vectors_cast_array_to_vecf32"(
+            "array" real[], /* pgrx::datum::array::Array<f32> */
+            "typmod" INT, /* i32 */
+            "_explicit" bool /* bool */
+        ) RETURNS vector /* vectors::datatype::memory_vecf32::Vecf32Output */
+        IMMUTABLE STRICT PARALLEL SAFE
+        LANGUAGE c /* Rust */
+        AS 'MODULE_PATHNAME', '_vectors_cast_array_to_vecf32_wrapper';
+    END IF;
+END $$;
 
 -- src/datatype/subscript_bvector.rs:10
 -- vectors::datatype::subscript_bvector::_vectors_bvector_subscript
@@ -1239,10 +1263,10 @@ DROP FUNCTION _vectors_bvecf32_operator_cosine;
 DO $$
 DECLARE
     depcount_veci8 INT;
-	depcount_in INT;
-	depcount_out INT;
-	depcount_recv INT;
-	depcount_send INT;
+    depcount_in INT;
+    depcount_out INT;
+    depcount_recv INT;
+    depcount_send INT;
 BEGIN
     SELECT COUNT(*) INTO depcount_veci8 FROM pg_depend d WHERE d.refobjid = 'vectors.veci8'::regtype;
     SELECT COUNT(*) INTO depcount_in FROM pg_depend d WHERE d.refobjid = 'vectors._vectors_veci8_in(cstring,oid,integer)'::regprocedure;
```

---

### Incident Patch 5: `cc4776fe` (2024-11-05)
**Commit Message**: fix dockerfile pg version error (#611)

Signed-off-by: xieydd <xieydd@gmail.com>

**File**: `docker/pg-slim/Dockerfile` (modified, +1/-1)
```diff
@@ -118,7 +118,7 @@ COPY --from=tianon/gosu /gosu /usr/local/bin/
 RUN set -eux; \
     echo "unix_socket_directories = '/var/run/postgresql'" >> /usr/lib/postgresql/${PG_MAJOR}/share/postgresql.conf.sample; \
 	sed -ri "s!^#?(listen_addresses)\s*=\s*\S+.*!\1 = '*'!" /usr/lib/postgresql/${PG_MAJOR}/share/postgresql.conf.sample; \
-	grep -F "listen_addresses = '*'" /usr/lib/postgresql/16/share/postgresql.conf.sample
+	grep -F "listen_addresses = '*'" /usr/lib/postgresql/${PG_MAJOR}/share/postgresql.conf.sample
 
 RUN install --verbose --directory --owner postgres --group postgres --mode 3777 /var/run/postgresql
 
```

---

### Incident Patch 6: `1b979897` (2024-11-05)
**Commit Message**: fix docker build ci context error (#610)

Signed-off-by: xieydd <xieydd@gmail.com>

**File**: `.github/workflows/release_enterprise.yml` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ jobs:
       - name: Push postgres with pgvecto.rs enterprise to Docker Registry
         uses: docker/build-push-action@v4
         with:
-          context: .
+          context: ./docker/pg-cnpg
           push: true
           platforms: "linux/${{ matrix.platform }}"
           file: ./docker/pg-cnpg/Dockerfile
```

**File**: `.github/workflows/release_pg_slim.yml` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ jobs:
       - name: Push binary release to Docker Registry
         uses: docker/build-push-action@v4
         with:
-          context: .
+          context: ./docker/pg-slim
           push: true
           platforms: "linux/${{ matrix.platform }}"
           file: ./docker/pg-slim/Dockerfile
```

**File**: `docker/pg-cnpg/Dockerfile` (modified, +2/-2)
```diff
@@ -23,7 +23,7 @@ RUN if [ -z "${PGDATA}" ]; then echo "PGDATA is not set"; exit 1; fi
 
 # Install trunk
 COPY --from=builder /usr/local/cargo/bin/trunk /usr/bin/trunk
-COPY ./requirements.txt .
+COPY requirements.txt .
 
 # Install barman-cloud
 RUN set -xe; \
@@ -171,7 +171,7 @@ RUN git clone https://github.com/EnterpriseDB/pg_failover_slots.git && \
 ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH
 
 # Test trunk
-COPY ./trunk-install.sh /usr/local/bin/
+COPY trunk-install.sh /usr/local/bin/
 
 # Change the uid of postgres to 26
 RUN usermod -u 26 postgres
```

**File**: `docker/pg-slim/Dockerfile` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ RUN install --verbose --directory --owner postgres --group postgres --mode 3777
 RUN install --verbose --directory --owner postgres --group postgres --mode 1777 ${PGDATA}
 
 ENV PATH $PATH:/usr/lib/postgresql/$PG_MAJOR/bin:/usr/local/bin
-COPY ./docker-entrypoint.sh ./docker-ensure-initdb.sh /usr/local/bin/
+COPY docker-entrypoint.sh docker-ensure-initdb.sh /usr/local/bin/
 RUN ln -sT docker-ensure-initdb.sh /usr/local/bin/docker-enforce-initdb.sh
 ENTRYPOINT ["docker-entrypoint.sh"]
 
```

---

### Incident Patch 7: `60cedfa0` (2024-11-04)
**Commit Message**: change requirement fix security issue (#609)

Signed-off-by: xieydd <xieydd@gmail.com>

**File**: `.github/workflows/release_pg_slim.yml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ jobs:
     strategy:
       matrix:
         version: [14, 15, 16, 17]
-        platforms: "amd64,arm64"
+        platform: ["amd64", "arm64"]
     runs-on: ubuntu-latest
     env:
       PG_MAJOR: ${{ matrix.version }}
```

**File**: `docker/pg-cnpg/Dockerfile` (modified, +1/-1)
```diff
@@ -178,4 +178,4 @@ RUN usermod -u 26 postgres
 RUN chown -R postgres:postgres /usr/lib/postgresql/${PG_MAJOR}
 RUN cp /usr/share/postgresql/${PG_MAJOR}/extension/* /usr/lib/postgresql/${PG_MAJOR}/share/extension/
 USER 26
-ENV PATH $PATH:/usr/lib/postgresql/${PG_MAJOR}/bin
\ No newline at end of file
+ENV PATH $PATH:/usr/lib/postgresql/${PG_MAJOR}/bin
```

**File**: `docker/pg-cnpg/requirements.txt` (modified, +436/-387)
```diff
@@ -1,432 +1,484 @@
 #
-# This file is autogenerated by pip-compile with Python 3.8
+# This file is autogenerated by pip-compile with Python 3.11
 # by the following command:
 #
 #    pip-compile --generate-hashes
 #
-argcomplete==3.0.8 \
-    --hash=sha256:b9ca96448e14fa459d7450a4ab5a22bbf9cee4ba7adddf03e65c398b5daeea28 \
-    --hash=sha256:e36fd646839933cbec7941c662ecb65338248667358dd3d968405a4506a60d9b
-azure-core==1.26.4 \
-    --hash=sha256:075fe06b74c3007950dd93d49440c2f3430fd9b4a5a2756ec8c79454afc989c6 \
-    --hash=sha256:d9664b4bc2675d72fba461a285ac43ae33abb2967014a955bf136d9703a2ab3c
+azure-core==1.32.0 \
+    --hash=sha256:22b3c35d6b2dae14990f6c1be2912bf23ffe50b220e708a28ab1bb92b1c730e5 \
+    --hash=sha256:eac191a0efb23bfa83fddf321b27b122b4ec847befa3091fa736a5c32c50d7b4
     # via
     #   azure-identity
     #   azure-storage-blob
-azure-identity==1.13.0 \
-    --hash=sha256:bd700cebb80cd9862098587c29d8677e819beca33c62568ced6d5a8e5e332b82 \
-    --hash=sha256:c931c27301ffa86b07b4dcf574e29da73e3deba9ab5d1fe4f445bb6a3117e260
-azure-storage-blob==12.16.0 \
-    --hash=sha256:43b45f19a518a5c6895632f263b3825ebc23574f25cc84b66e1630a6160e466f \
-    --hash=sha256:91bb192b2a97939c4259c72373bac0f41e30810bbc853d5184f0f45904eacafd
-barman[azure,cloud,google,snappy]==3.5.0 \
-    --hash=sha256:078643961d421a5f54825d3da4bbd04faa94b96a6a0f6cefe23babdc53aff83a \
-    --hash=sha256:bea6885c1efe2e140b640d4b2daec8aff03563a5cee199a73f874ae39fede051
+azure-identity==1.19.0 \
+    --hash=sha256:500144dc18197d7019b81501165d4fa92225f03778f17d7ca8a2a180129a9c83 \
+    --hash=sha256:e3f6558c181692d7509f09de10cca527c7dce426776454fb97df512a46527e81
+azure-storage-blob==12.23.1 \
+    --hash=sha256:1c2238aa841d1545f42714a5017c010366137a44a0605da2d45f770174bfc6b4 \
+    --hash=sha256:a587e54d4e39d2a27bd75109db164ffa2058fe194061e5446c5a89bca918272f
+barman[azure,cloud,google,snappy]==3.11.1 \
+    --hash=sha256:295b9b7e058e064338f66ca0d10e4892e784a2347f06e4a225164995f6114498 \
+    --hash=sha256:4f424f3327cb24fb82d6a29dc1cdf02222b950c447c78273273d6eb76d7ce8d7
     # via -r requirements.in
-boto3==1.26.139 \
-    --hash=sha256:5b61a82f0c1cd006bd109ddf27c93d9b010c4c188fc583ee257ff6f3bb89970d \
-    --hash=sha256:fe19d287bc8ede385e1b9136f135ee8f93eab81404ad1445b1a70cabfe3f7087
-botocore==1.29.139 \
-    --hash=sha256:acc62710bdf11e47f4f26fb290a9082ff00377d7e93a16e1f080f9c789898114 \
-    --hash=sha256:b164af929eb2f1507833718de9eb8811e3adc6943b464c1869e95ac87f3bab88
+boto3==1.35.54 \
+    --hash=sha256:2d5e160b614db55fbee7981001c54476cb827c441cef65b2fcb2c52a62019909 \
+    --hash=sha256:7d9c359bbbc858a60b51c86328db813353c8bd1940212cdbd0a7da835291c2e1
+botocore==1.35.54 \
+    --hash=sha256:131bb59ce59c8a939b31e8e647242d70cf11d32d4529fa4dca01feea1e891a76 \
+    --hash=sha256:9cca1811094b6cdc144c2c063a3ec2db6d7c88194b04d4277cd34fc8e3473aff
     # via
     #   boto3
     #   s3transfer
-cachetools==5.3.0 \
-    --hash=sha256:13dfddc7b8df938c21a940dfa6557ce6e94a2f1cdfa58eb90c805721d58f2c14 \
-    --hash=sha256:429e1a1e845c008ea6c85aa35d4b98b65d6a9763eeef3e37e92728a12d1de9d4
+cachetools==5.5.0 \
+    --hash=sha256:02134e8439cdc2ffb62023ce1debca2944c3f289d66bb17ead3ab3dede74b292 \
+    --hash=sha256:2cc24fb4cbe39633fb7badd9db9ca6295d766d9c2995f245725a46715d050f2a
     # via google-auth
-certifi==2023.5.7 \
-    --hash=sha256:0f0d56dc5a6ad56fd4ba36484d6cc34451e1c6548c61daad8c320169f91eddc7 \
-    --hash=sha256:c6c2e98f5c7869efca1f8916fed228dd91539f9f1b444c314c06eef02980c716
+certifi==2024.8.30 \
+    --hash=sha256:922820b53db7a7257ffbda3f597266d435245903d80737e34f8a45ff3e3230d8 \
+    --hash=sha256:bec941d2aa8195e248a60b31ff9f0558284cf01a52591ceda73ea9afffd69fd9
     # via requests
-cffi==1.15.1 \
-    --hash=sha256:00a9ed42e88df81ffae7a8ab6d9356b371399b91dbdf0c3cb1e84c03a13aceb5 \
-    --hash=sha256:03425bdae262c76aad70202debd780501fabeaca237cdfddc008987c0e0f59ef \
-    --hash=sha256:04ed324bda3cda42b9b695d51bb7d54b680b9719cfab04227cdd1e04e5de3104 \
-  
```

---

### Incident Patch 8: `c6da9392` (2024-10-15)
**Commit Message**: fix: aarch64 release CI (#606)

Signed-off-by: usamoi <usamoi@outlook.com>

**File**: `.github/workflows/psql.yml` (modified, +0/-7)
```diff
@@ -77,13 +77,6 @@ jobs:
             ~/.cargo/registry/cache/
             ~/.cargo/git/db/
           key: ${{ github.job }}-${{ hashFiles('./Cargo.lock') }}-${{ matrix.version }}
-      - name: Set up Clang-16
-        run: |
-          sudo sh -c 'echo "deb http://apt.llvm.org/$(lsb_release -cs)/ llvm-toolchain-$(lsb_release -cs)-16 main" >> /etc/apt/sources.list'
-          wget --quiet -O - https://apt.llvm.org/llvm-snapshot.gpg.key | sudo apt-key add -
-          sudo apt-get update
-          sudo apt-get install -y clang-16
-          sudo update-alternatives --install /usr/bin/clang clang /usr/bin/clang-16 128
       - name: Build
         run: |
           export PGRX_PG_CONFIG_PATH=$(pwd)/vendor/pg${VERSION}_${ARCH}_debian/pg_config/pg_config
```

**File**: `.github/workflows/release.yml` (modified, +5/-8)
```diff
@@ -59,7 +59,11 @@ jobs:
           sudo apt-get update
           sudo apt-get install -y build-essential crossbuild-essential-arm64
           sudo apt-get install -y qemu-user-static
-          echo 'target.aarch64-unknown-linux-gnu.linker = "aarch64-linux-gnu-gcc"' | tee ~/.cargo/config.toml
+          touch ~/.cargo/config.toml
+          echo 'target.aarch64-unknown-linux-gnu.linker = "aarch64-linux-gnu-gcc"' >> ~/.cargo/config.toml
+          echo 'target.aarch64-unknown-linux-gnu.runner = ["qemu-aarch64-static", "-L", "/usr/aarch64-linux-gnu"]' >> ~/.cargo/config.toml
+          rustup target add x86_64-unknown-linux-gnu
+          rustup target add aarch64-unknown-linux-gnu
       - name: Set up Sccache
         uses: mozilla-actions/sccache-action@v0.0.4
       - name: Set up Cache
@@ -71,13 +75,6 @@ jobs:
             ~/.cargo/registry/cache/
             ~/.cargo/git/db/
           key: ${{ github.job }}-${{ hashFiles('./Cargo.lock') }}-${{ matrix.version }}-${{ matrix.arch }}
-      - name: Set up Clang-16
-        run: |
-          sudo sh -c 'echo "deb http://apt.llvm.org/$(lsb_release -cs)/ llvm-toolchain-$(lsb_release -cs)-16 main" >> /etc/apt/sources.list'
-          wget --quiet -O - https://apt.llvm.org/llvm-snapshot.gpg.key | sudo apt-key add -
-          sudo apt-get update
-          sudo apt-get install -y clang-16
-          sudo update-alternatives --install /usr/bin/clang clang /usr/bin/clang-16 128
       - name: Build
         run: |
           export PGRX_PG_CONFIG_PATH=$(pwd)/vendor/pg${VERSION}_${ARCH}_debian/pg_config/pg_config
```

**File**: `.github/workflows/release_enterprise.yml` (modified, +0/-7)
```diff
@@ -73,13 +73,6 @@ jobs:
             ~/.cargo/registry/cache/
             ~/.cargo/git/db/
           key: ${{ github.job }}-${{ hashFiles('./Cargo.lock') }}-${{ matrix.version }}-${{ matrix.arch }}
-      - name: Set up Clang-16
-        run: |
-          sudo sh -c 'echo "deb http://apt.llvm.org/$(lsb_release -cs)/ llvm-toolchain-$(lsb_release -cs)-16 main" >> /etc/apt/sources.list'
-          wget --quiet -O - https://apt.llvm.org/llvm-snapshot.gpg.key | sudo apt-key add -
-          sudo apt-get update
-          sudo apt-get install -y clang-16
-          sudo update-alternatives --install /usr/bin/clang clang /usr/bin/clang-16 128
       - name: Schema
         run: |
           echo -n $PGVECTORS_SCHEMA > .schema
```

**File**: `.github/workflows/rust.yml` (modified, +0/-7)
```diff
@@ -78,13 +78,6 @@ jobs:
             ~/.cargo/registry/cache/
             ~/.cargo/git/db/
           key: ${{ github.job }}-${{ hashFiles('./Cargo.lock') }}-${{ matrix.arch }}
-      - name: Set up Clang-16
-        run: |
-          sudo sh -c 'echo "deb http://apt.llvm.org/$(lsb_release -cs)/ llvm-toolchain-$(lsb_release -cs)-16 main" >> /etc/apt/sources.list'
-          wget --quiet -O - https://apt.llvm.org/llvm-snapshot.gpg.key | sudo apt-key add -
-          sudo apt-get update
-          sudo apt-get install -y clang-16
-          sudo update-alternatives --install /usr/bin/clang clang /usr/bin/clang-16 128
       - name: Clippy
         run: |
           cargo clippy --workspace --exclude pgvectors --exclude pyvectors --target $ARCH-unknown-linux-gnu
```

**File**: `crates/quantization/src/quantize.rs` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ mod mul_add_round {
             // this hint is used to disable loop unrolling
             while std::hint::black_box(n) > 0 {
                 let x = a.read();
-                let v = (k * x + b).round_ties_even() as u8;
+                let v = x.mul_add(k, b).round_ties_even() as u8;
                 r.write(v);
                 n -= 1;
                 a = a.add(1);
```

---

### Incident Patch 9: `b3d32439` (2024-09-24)
**Commit Message**: feat: mark GUC prefix reserved (#599)

Signed-off-by: usamoi <usamoi@outlook.com>

**File**: `src/gucs/embedding.rs` (modified, +15/-3)
```diff
@@ -1,11 +1,23 @@
-use super::guc_string_parse;
 use embedding::OpenAIOptions;
 use pgrx::guc::{GucContext, GucFlags, GucRegistry, GucSetting};
 use std::ffi::CStr;
 
 pub fn openai_options() -> OpenAIOptions {
-    let base_url = guc_string_parse(&OPENAI_BASE_URL, "vectors.openai_base_url");
-    let api_key = guc_string_parse(&OPENAI_API_KEY, "vectors.openai_api_key");
+    use crate::error::*;
+    use pgrx::guc::GucSetting;
+    use std::ffi::CStr;
+    fn parse(target: &'static GucSetting<Option<&'static CStr>>, name: &'static str) -> String {
+        let value = match target.get() {
+            Some(s) => s,
+            None => bad_guc_literal(name, "should not be `NULL`"),
+        };
+        match value.to_str() {
+            Ok(s) => s.to_string(),
+            Err(_e) => bad_guc_literal(name, "should be a valid UTF-8 string"),
+        }
+    }
+    let base_url = parse(&OPENAI_BASE_URL, "vectors.openai_base_url");
+    let api_key = parse(&OPENAI_API_KEY, "vectors.openai_api_key");
     OpenAIOptions { base_url, api_key }
 }
 
```

**File**: `src/gucs/mod.rs` (modified, +4/-18)
```diff
@@ -1,7 +1,3 @@
-use crate::error::*;
-use pgrx::guc::GucSetting;
-use std::ffi::CStr;
-
 pub mod embedding;
 pub mod executing;
 pub mod internal;
@@ -13,19 +9,9 @@ pub unsafe fn init() {
         internal::init();
         executing::init();
         embedding::init();
-    }
-}
-
-fn guc_string_parse(
-    target: &'static GucSetting<Option<&'static CStr>>,
-    name: &'static str,
-) -> String {
-    let value = match target.get() {
-        Some(s) => s,
-        None => bad_guc_literal(name, "should not be `NULL`"),
-    };
-    match value.to_str() {
-        Ok(s) => s.to_string(),
-        Err(_e) => bad_guc_literal(name, "should be a valid UTF-8 string"),
+        #[cfg(feature = "pg14")]
+        pgrx::pg_sys::EmitWarningsOnPlaceholders(c"vectors".as_ptr());
+        #[cfg(any(feature = "pg15", feature = "pg16", feature = "pg17"))]
+        pgrx::pg_sys::MarkGUCPrefixReserved(c"vectors".as_ptr());
     }
 }
```

---

### Incident Patch 10: `22904a69` (2024-09-23)
**Commit Message**: fix: reduce length of directory name (#588)

Signed-off-by: usamoi <usamoi@outlook.com>

**File**: `crates/base/src/search.rs` (modified, +2/-10)
```diff
@@ -9,17 +9,13 @@ use std::fmt::Display;
 
 #[derive(Debug, Clone, Copy, Hash, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
 pub struct Handle {
-    tenant_id: u128,
-    cluster_id: u64,
     database_id: u32,
     index_id: u32,
 }
 
 impl Handle {
-    pub fn new(tenant_id: u128, cluster_id: u64, database_id: u32, index_id: u32) -> Self {
+    pub fn new(database_id: u32, index_id: u32) -> Self {
         Self {
-            tenant_id,
-            cluster_id,
             database_id,
             index_id,
         }
@@ -28,11 +24,7 @@ impl Handle {
 
 impl Display for Handle {
     fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
-        write!(
-            f,
-            "{:032x}{:016x}{:08x}{:08x}",
-            self.tenant_id, self.cluster_id, self.database_id, self.index_id
-        )
+        write!(f, "{:08x}{:08x}", self.database_id, self.index_id)
     }
 }
 
```

**File**: `src/index/utils.rs` (modified, +1/-8)
```diff
@@ -1,16 +1,9 @@
-use crate::utils::cells::PgCell;
 use base::search::*;
 
 pub fn from_oid_to_handle(oid: pgrx::pg_sys::Oid) -> Handle {
-    static SYSTEM_IDENTIFIER: PgCell<u64> = unsafe { PgCell::new(0) };
-    if SYSTEM_IDENTIFIER.get() == 0 {
-        SYSTEM_IDENTIFIER.set(unsafe { pgrx::pg_sys::GetSystemIdentifier() });
-    }
-    let tenant_id = 0_u128;
-    let cluster_id = SYSTEM_IDENTIFIER.get();
     let database_id = unsafe { pgrx::pg_sys::MyDatabaseId.as_u32() };
     let index_id = oid.as_u32();
-    Handle::new(tenant_id, cluster_id, database_id, index_id)
+    Handle::new(database_id, index_id)
 }
 
 pub fn pointer_to_ctid(pointer: Pointer) -> pgrx::pg_sys::ItemPointerData {
```

#### Recent Merged Pull Requests:
- **PR #642** (2025-02-26): docs: update to ghcr in README (@kemingy)
- **PR #640** (2025-02-24): docs: add 'migrate to vectorchord' in readme (@kemingy)
- **PR #639** (2025-02-24): chore: fix ghcr release (@kemingy)
- **PR #638** (2025-02-24): chore: run rust test on ubuntu 22.04 (@kemingy)
- **PR #632** (2025-01-17): chore: fix discord and x badge (@kemingy)
- **PR #630** (closed): feat: Update GitHub Actions to support GitHub Container Registry (@webysther)
- **PR #627** (2025-01-01): chore: Fix links (@gaocegege)
- **PR #625** (2024-12-23): fix: update dependencies (@usamoi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
