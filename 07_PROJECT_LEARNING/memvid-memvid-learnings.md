# Forensic Learning Record (Deep Inspection): memvid/memvid

> **Canonical Artifact**: `07_PROJECT_LEARNING/memvid-memvid-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/memvid/memvid](https://github.com/memvid/memvid))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:47:42.347Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `memvid/memvid`
- **Description**: Memory layer for AI Agents. Replace complex RAG pipelines with a serverless, single-file memory layer. Give your agents instant retrieval and long-term memory.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 16573 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/enrich/engine.rs`
```
//! Enrichment engine trait and context types.
//!
//! The `EnrichmentEngine` trait defines the interface that all enrichment
//! engines must implement. Each engine processes frames and produces
//! structured memory cards.

use crate::error::Result;
use crate::types::{FrameId, MemoryCard};

/// Context provided to enrichment engines during processing.
#[derive(Debug, Clone)]
pub struct EnrichmentContext {
    /// The frame ID being processed.
    pub frame_id: FrameId,
    /// The frame's URI (e.g., "<mv2://session-1/msg-5>").
    pub uri: String,
    /// The frame's text content.
    pub text: String,
    /// The frame's title (if any).
    pub title: Option<String>,
    /// The frame's timestamp (Unix seconds).
    pub timestamp: i64,
    /// Optional metadata from the frame.
    pub metadata: Option<String>,
}

impl EnrichmentContext {
    /// Create a new enrichment context.
    #[must_use]
    pub fn new(
        frame_id: FrameId,
        uri: String,
        text: String,
        title: Option<String>,
        timestamp: i64,
        metadata: Option<String>,
    ) -> Self {
        Self {
            frame_id,
            uri,
            text,
            title,
            timestamp,
            metadata,
        }
    }
}

/// Result of running an enrichment engine on a frame.
#[derive(Debug, Clone, Default)]
pub struct EnrichmentResult {
    /// Memory cards extracted from the frame.
    pub cards: Vec<MemoryCard>,
    /// Whether the engine successfully processed the frame.
    /// Even if no cards were extracted, this can be true.
    pub success: bool,
    /// Optional error message if processing failed.
    pub error: Option<String>,
}

impl EnrichmentResult {
    /// Create a successful result with cards.
    #[must_use]
    pub fn success(cards: Vec<MemoryCard>) -> Self {
        Self {
            cards,
            success: true,
            error: None,
        }
    }

    /// Create an empty successful result (no cards extracted).
    #[must_use]
    pub fn empty() -> Self {
        Self {
            cards: Vec::new(),
            success: true,
            error: None,
        }
    }

    /// Create a failed result.
    #[must_use]
    pub fn failed(error: impl Into<String>) -> Self {
        Self {
            cards: Vec::new(),
            success: false,
            error: Some(error.into()),
        }
    }
}

/// Trait for enrichment engines that process frames and extract memory cards.
///
/// Engines are identified by a kind (e.g., "rules", "llm:phi-3.5-mini") and
/// a version string. The combination allows tracking which frames have been
/// processed by which engine versions.
///
/// # Example
///
/// ```ignore
/// use memvid_core::enrich::{EnrichmentEngine, EnrichmentContext, EnrichmentResult};
///
/// struct MyEngine;
///
/// impl EnrichmentEngine for MyEngine {
///     fn kind(&self) -> &str { "my-engine" }
///     fn version(&self) -> &str { "1.0.0" }
///
///     fn enrich(&self, ctx: &EnrichmentContext) -> EnrichmentResult {
///         // Extract memory cards from ctx.text
///         EnrichmentResult::empty()
///     }
/// }
/// ```
pub trait EnrichmentEngine: Send + Sync {
    /// Return the engine kind identifier (e.g., "rules", "llm:phi-3.5-mini").
    fn kind(&self) -> &str;

    /// Return the engine version string (e.g., "1.0.0").
    fn version(&self) -> &str;

    /// Process a frame and extract memory cards.
    ///
    /// The engine receives the frame's text content and metadata via the
    /// `EnrichmentContext` and should return any extracted memory cards.
    fn enrich(&self, ctx: &EnrichmentContext) -> EnrichmentResult;

    /// Initialize the engine (e.g., load models).
    ///
    /// This is called once before processing begins. Engines that need
    /// to load models or other resources should do so here.
    fn init(&mut self) -> Result<()> {
        Ok(())
    }

    /// Check if the engine is ready for processing.
    ///
    /// Returns true if `init()` has been called and the engine is ready.
    fn is_ready(&self) -> bool {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestEngine;

    impl EnrichmentEngine for TestEngine {
        fn kind(&self) -> &'static str {
            "test"
        }
        fn version(&self) -> &'static str {
            "1.0.0"
        }
        fn enrich(&self, _ctx: &EnrichmentContext) -> EnrichmentResult {
            EnrichmentResult::empty()
        }
    }

    #[test]
    fn test_enrichment_context() {
        let ctx = EnrichmentContext::new(
            42,
            "mv2://test/msg-1".to_string(),
            "Hello, I work at Anthropic.".to_string(),
            Some("Test".to_string()),
            1700000000,
            None,
        );
        assert_eq!(ctx.frame_id, 42);
        assert_eq!(ctx.uri, "mv2://test/msg-1");
    }

    #[test]
    fn test_enrichment_result() {
        let success = EnrichmentResult::success(vec![]);
        assert!(success.success);
        assert!(success.error.is_none());

        let empty = EnrichmentResult::empty();
        assert!(empty.success);
        assert!(empty.cards.is_empty());

        let failed = EnrichmentResult::failed("test error");
        assert!(!failed.success);
        assert_eq!(failed.error, Some("test error".to_string()));
    }

    #[test]
    fn test_engine_trait() {
        let engine = TestEngine;
        assert_eq!(engine.kind(), "test");
        assert_eq!(engine.version(), "1.0.0");
        assert!(engine.is_ready());
    }
}

```

### Core Architecture Module: `src/enrichment_worker.rs`
```
//! Background enrichment worker for progressive ingestion.
//!
//! Processes frames in the enrichment queue asynchronously:
//! - Re-extracts full text for skim extractions
//! - Generates embeddings with batching and checkpointing
//! - Updates Tantivy index with enriched content
//! - Marks frames as Enriched when complete

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use crate::error::Result;
use crate::types::{EnrichmentTask, FrameId, VecEmbedder};

/// Configuration for the enrichment worker.
#[derive(Debug, Clone)]
pub struct EnrichmentWorkerConfig {
    /// Batch size for embedding generation.
    pub embedding_batch_size: usize,
    /// Checkpoint interval (persist progress every N embeddings).
    pub checkpoint_interval: usize,
    /// Delay between processing tasks (to avoid blocking writers).
    pub task_delay_ms: u64,
    /// Maximum time to spend on a single task before yielding.
    pub max_task_time_ms: u64,
}

impl Default for EnrichmentWorkerConfig {
    fn default() -> Self {
        Self {
            embedding_batch_size: 32,
            checkpoint_interval: 100,
            task_delay_ms: 50,
            max_task_time_ms: 5000,
        }
    }
}

/// Statistics for the enrichment worker.
#[derive(Debug, Clone, Default)]
pub struct EnrichmentWorkerStats {
    /// Total frames processed.
    pub frames_processed: u64,
    /// Total embeddings generated.
    pub embeddings_generated: u64,
    /// Total re-extractions performed.
    pub re_extractions: u64,
    /// Total errors encountered.
    pub errors: u64,
    /// Current queue depth.
    pub queue_depth: usize,
    /// Whether worker is currently running.
    pub is_running: bool,
}

/// Handle for controlling the background enrichment worker.
pub struct EnrichmentWorkerHandle {
    /// Signal to stop the worker.
    stop_signal: Arc<AtomicBool>,
    /// Counter for frames processed.
    frames_processed: Arc<AtomicU64>,
    /// Counter for embeddings generated.
    embeddings_generated: Arc<AtomicU64>,
    /// Counter for re-extractions.
    re_extractions: Arc<AtomicU64>,
    /// Counter for errors.
    errors: Arc<AtomicU64>,
    /// Running state.
    is_running: Arc<AtomicBool>,
}

impl EnrichmentWorkerHandle {
    /// Create a new worker handle.
    #[must_use]
    pub fn new() -> Self {
        Self {
            stop_signal: Arc::new(AtomicBool::new(false)),
            frames_processed: Arc::new(AtomicU64::new(0)),
            embeddings_generated: Arc::new(AtomicU64::new(0)),
            re_extractions: Arc::new(AtomicU64::new(0)),
            errors: Arc::new(AtomicU64::new(0)),
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Signal the worker to stop.
    pub fn stop(&self) {
        self.stop_signal.store(true, Ordering::SeqCst);
    }

    /// Check if stop was requested.
    #[must_use]
    pub fn should_stop(&self) -> bool {
        self.stop_signal.load(Ordering::SeqCst)
    }

    /// Check if worker is currently running.
    #[must_use]
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    /// Get current statistics.
    #[must_use]
    pub fn stats(&self) -> EnrichmentWorkerStats {
        EnrichmentWorkerStats {
            frames_processed: self.frames_processed.load(Ordering::Relaxed),
            embeddings_generated: self.embeddings_generated.load(Ordering::Relaxed),
            re_extractions: self.re_extractions.load(Ordering::Relaxed),
            errors: self.errors.load(Ordering::Relaxed),
            queue_depth: 0, // Will be updated by caller
            is_running: self.is_running.load(Ordering::Relaxed),
        }
    }

    /// Increment frames processed counter.
    pub(crate) fn inc_frames_processed(&self) {
        self.frames_processed.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment embeddings generated counter.
    pub(crate) fn inc_embeddings(&self, count: u64) {
        self.embeddings_generated
            .fetch_add(count, Ordering::Relaxed);
    }

    /// Increment re-extractions counter.
    pub(crate) fn inc_re_extractions(&self) {
        self.re_extractions.fetch_add(1, Ordering::Relaxed);
    }

    /// Increment errors counter.
    pub(crate) fn inc_errors(&self) {
        self.errors.fetch_add(1, Ordering::Relaxed);
    }

    /// Set running state.
    pub(crate) fn set_running(&self, running: bool) {
        self.is_running.store(running, Ordering::SeqCst);
    }

    /// Clone the handle for sharing with the worker thread.
    #[must_use]
    pub fn clone_handle(&self) -> Self {
        Self {
            stop_signal: Arc::clone(&self.stop_signal),
            frames_processed: Arc::clone(&self.frames_processed),
            embeddings_generated: Arc::clone(&self.embeddings_generated),
            re_extractions: Arc::clone(&self.re_extractions),
            errors: Arc::clone(&self.errors),
            is_running: Arc::clone(&self.is_running),
        }
    }
}

impl Default for EnrichmentWorkerHandle {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of processing a single enrichment task.
#[derive(Debug)]
pub struct TaskResult {
    /// Frame ID that was processed.
    pub frame_id: FrameId,
    /// Whether full re-extraction was performed.
    pub re_extracted: bool,
    /// Number of embeddings generated.
    pub embeddings_generated: usize,
    /// Time spent processing.
    pub elapsed_ms: u64,
    /// Error if processing failed.
    pub error: Option<String>,
}

/// Batched embedding generator for efficient embedding creation.
///
/// Collects text chunks and generates embeddings in batches to minimize
/// API calls and improve throughput.
pub struct EmbeddingBatcher<E: VecEmbedder> {
    /// The embedder to use for generating embeddings.
    embedder: E,
    /// Batch size for embedding generation.
    batch_size: usize,
    /// Pending texts to embed.
    pending_texts: Vec<(FrameId, String)>,
    /// Generated embeddings ready to store.
    ready_embeddings: Vec<(FrameId, Vec<f32>)>,
}

impl<E: VecEmbedder> EmbeddingBatcher<E> {
    /// Create a new embedding batcher.
    pub fn new(embedder: E, batch_size: usize) -> Self {
        Self {
            embedder,
            batch_size: batch_size.max(1),
            pending_texts: Vec::new(),
            ready_embeddings: Vec::new(),
        }
    }

    /// Add a frame's text for embedding.
    pub fn add(&mut self, frame_id: FrameId, text: String) {
        self.pending_texts.push((frame_id, text));
    }

    /// Get the number of pending texts.
    pub fn pending_count(&self) -> usize {
        self.pending_texts.len()
    }

    /// Get the number of ready embeddings.
    pub fn ready_count(&self) -> usize {
        self.ready_embeddings.len()
    }

    /// Check if a batch is ready to process.
    pub fn should_flush(&self) -> bool {
        self.pending_texts.len() >= self.batch_size
    }

    /// Process pending texts and generate embeddings.
    ///
    /// Returns the number of embeddings generated.
    pub fn flush(&mut self) -> Result<usize> {
        if self.pending_texts.is_empty() {
            return Ok(0);
        }

        // Take all pending texts
        let pending: Vec<_> = std::mem::take(&mut self.pending_texts);
        let count = pending.len();

        // Extract texts for batch embedding
        let texts: Vec<&str> = pending.iter().map(|(_, text)| text.as_str()).collect();

        // Generate embeddings in batch
        let embeddings = self.embedder.embed_chunks(&texts)?;

        // Store results
        for ((frame_id, _), embedding) in pending.into_iter().zip(embeddings.into_iter()) {
            self.ready_embeddings.push((frame_id, embedding));
        }

        Ok(count)
    }

    /// Take all ready embeddings.
    pub fn take_embeddings(&mut self) -> Vec<(FrameId, Vec<f32>)> {
        std::mem::take(&mut self.ready_embeddings)
    }

    /// Get embedding dimension from the embedder.
    pub fn dimension(&self) -> usize {
        self.embedder.embedding_dimension()
    }
}

/// Enrichment task processor (stateless, operates on Memvid instance).
pub struct EnrichmentProcessor {
    /// Worker configuration.
    pub config: EnrichmentWorkerConfig,
}

impl EnrichmentProcessor {
    /// Create a new enrichment processor.
    #[must_use]
    pub fn new(config: EnrichmentWorkerConfig) -> Self {
        Self { config }
    }

    /// Process a single enrichment task.
    ///
    /// This method:
    /// 1. Reads the frame from the memory
    /// 2. If frame needs re-extraction (skim), performs full extraction
    /// 3. If frame needs embeddings, generates them with batching
    /// 4. Updates the Tantivy index
    /// 5. Returns the result
    ///
    /// The caller is responsible for:
    /// - Acquiring write lock on the memory
    /// - Updating the enrichment queue
    /// - Persisting changes
    pub fn process_task<F, E, R>(
        &self,
        task: &EnrichmentTask,
        read_frame: F,
        extract_full: E,
        update_index: R,
    ) -> TaskResult
    where
        F: FnOnce(FrameId) -> Option<(String, bool, bool)>, // (text, is_skim, needs_embedding)
        E: FnOnce(FrameId) -> Result<String>,               // Full extraction
        R: FnOnce(FrameId, &str) -> Result<()>,             // Update index
    {
        let start = Instant::now();
        let mut result = TaskResult {
            frame_id: task.frame_id,
            re_extracted: false,
            embeddings_generated: 0,
            elapsed_ms: 0,
            error: None,
        };

        // Read current frame state
        let (text, is_skim, _needs_embedding) = if let Some(data) = read_frame(task.frame_id) {
            data
        } else {
            result.error = Some("Frame not found".to_string());
            result.elapsed_ms = start.elapsed().as_millis().try_into().unwrap_or(u64::MAX);
            return result
```

### Core Architecture Module: `src/memvid/lifecycle.rs`
```
//! Lifecycle management for creating and opening `.mv2` memories.
//!
//! Responsibilities:
//! - Enforce single-file invariant (no sidecars) and take OS locks.
//! - Bootstrap headers, internal WAL, and TOC on create, and recover them on open.
//! - Validate TOC/footer layout, recover the latest valid footer when needed.
//! - Wire up index state (lex/vector/time) without mutating payload bytes.

use std::convert::TryInto;
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom};
use std::panic;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

use crate::constants::{MAGIC, SPEC_VERSION, WAL_OFFSET, WAL_SIZE_TINY};
use crate::error::{MemvidError, Result};
use crate::footer::{FooterSlice, find_last_valid_footer};
use crate::io::header::HeaderCodec;
#[cfg(feature = "parallel_segments")]
use crate::io::manifest_wal::ManifestWal;
use crate::io::wal::EmbeddedWal;
use crate::lock::{FileLock, LockMode};
#[cfg(feature = "lex")]
use crate::search::{EmbeddedLexStorage, TantivyEngine};
#[cfg(feature = "temporal_track")]
use crate::types::FrameId;
#[cfg(feature = "parallel_segments")]
use crate::types::IndexSegmentRef;
use crate::types::{
    FrameStatus, Header, IndexManifests, LogicMesh, MemoriesTrack, PutManyOpts, SchemaRegistry,
    SegmentCatalog, SketchTrack, TicketRef, Tier, Toc, VectorCompression,
};
#[cfg(feature = "temporal_track")]
use crate::{TemporalTrack, temporal_track_read};
use crate::{lex::LexIndex, vec::VecIndex};
use blake3::Hasher;
use memmap2::Mmap;

const DEFAULT_LOCK_TIMEOUT_MS: u64 = 250;
const DEFAULT_HEARTBEAT_MS: u64 = 2_000;
const DEFAULT_STALE_GRACE_MS: u64 = 10_000;

/// Primary handle for interacting with a `.mv2` memory file.
///
/// Holds the file descriptor, lock, header, TOC, and in-memory index state. Mutations
/// append to the embedded WAL and are materialized at commit time to keep the layout deterministic.
pub struct Memvid {
    pub(crate) file: File,
    pub(crate) path: PathBuf,
    pub(crate) lock: FileLock,
    pub(crate) read_only: bool,
    pub(crate) header: Header,
    pub(crate) toc: Toc,
    pub(crate) wal: EmbeddedWal,
    /// Number of frame inserts appended to WAL but not yet materialized into `toc.frames`.
    ///
    /// This lets frontends predict stable frame IDs before an explicit commit.
    pub(crate) pending_frame_inserts: u64,
    pub(crate) data_end: u64,
    /// Cached end of the payload region (max of payload_offset + payload_length across all frames).
    /// Updated incrementally on frame insert to avoid O(n) scans.
    pub(crate) cached_payload_end: u64,
    pub(crate) generation: u64,
    pub(crate) lock_settings: LockSettings,
    pub(crate) lex_enabled: bool,
    pub(crate) lex_index: Option<LexIndex>,
    #[cfg(feature = "lex")]
    #[allow(dead_code)]
    pub(crate) lex_storage: Arc<RwLock<EmbeddedLexStorage>>,
    pub(crate) vec_enabled: bool,
    pub(crate) vec_compression: VectorCompression,
    pub(crate) vec_model: Option<String>,
    pub(crate) vec_index: Option<VecIndex>,
    /// CLIP visual embeddings index (separate from vec due to different dimensions)
    pub(crate) clip_enabled: bool,
    pub(crate) clip_index: Option<crate::clip::ClipIndex>,
    pub(crate) dirty: bool,
    #[cfg(feature = "lex")]
    pub(crate) tantivy: Option<TantivyEngine>,
    #[cfg(feature = "lex")]
    pub(crate) tantivy_dirty: bool,
    #[cfg(feature = "temporal_track")]
    pub(crate) temporal_track: Option<TemporalTrack>,
    #[cfg(feature = "parallel_segments")]
    pub(crate) manifest_wal: Option<ManifestWal>,
    /// In-memory track for structured memory cards.
    pub(crate) memories_track: MemoriesTrack,
    /// In-memory Logic-Mesh graph for entity-relationship traversal.
    pub(crate) logic_mesh: LogicMesh,
    /// In-memory sketch track for fast candidate generation.
    pub(crate) sketch_track: SketchTrack,
    /// Schema registry for predicate validation.
    pub(crate) schema_registry: SchemaRegistry,
    /// Whether to enforce strict schema validation on card insert.
    pub(crate) schema_strict: bool,
    /// Active batch mode options (set by `begin_batch`, cleared by `end_batch`).
    pub(crate) batch_opts: Option<PutManyOpts>,
    /// Active replay session being recorded (if any).
    #[cfg(feature = "replay")]
    pub(crate) active_session: Option<crate::replay::ActiveSession>,
    /// Completed sessions stored in memory (until persisted to file).
    #[cfg(feature = "replay")]
    pub(crate) completed_sessions: Vec<crate::replay::ReplaySession>,
}

/// Controls read-only open behaviour for `.mv2` memories.
#[derive(Debug, Clone, Copy, Default)]
pub struct OpenReadOptions {
    pub allow_repair: bool,
}

#[derive(Debug, Clone)]
pub struct LockSettings {
    pub timeout_ms: u64,
    pub heartbeat_ms: u64,
    pub stale_grace_ms: u64,
    pub force_stale: bool,
    pub command: Option<String>,
}

impl Default for LockSettings {
    fn default() -> Self {
        Self {
            timeout_ms: DEFAULT_LOCK_TIMEOUT_MS,
            heartbeat_ms: DEFAULT_HEARTBEAT_MS,
            stale_grace_ms: DEFAULT_STALE_GRACE_MS,
            force_stale: false,
            command: None,
        }
    }
}

impl Memvid {
    /// Create a new, empty `.mv2` file with an embedded WAL and empty TOC.
    /// The file is locked exclusively for the lifetime of the handle.
    pub fn create<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path_ref = path.as_ref();
        ensure_single_file(path_ref)?;

        OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(true)
            .open(path_ref)?;
        let (mut file, lock) = FileLock::open_and_lock(path_ref)?;

        let header = Header {
            magic: MAGIC,
            version: SPEC_VERSION,
            footer_offset: WAL_OFFSET + WAL_SIZE_TINY,
            wal_offset: WAL_OFFSET,
            wal_size: WAL_SIZE_TINY,
            wal_checkpoint_pos: 0,
            wal_sequence: 0,
            toc_checksum: [0u8; 32],
        };

        let mut toc = empty_toc();
        // If lex feature is enabled, set the catalog flag immediately
        #[cfg(feature = "lex")]
        {
            toc.segment_catalog.lex_enabled = true;
        }
        file.set_len(header.footer_offset)?;
        HeaderCodec::write(&mut file, &header)?;

        let wal = EmbeddedWal::open(&file, &header)?;
        let data_end = header.footer_offset;
        #[cfg(feature = "lex")]
        let lex_storage = Arc::new(RwLock::new(EmbeddedLexStorage::new()));
        #[cfg(feature = "parallel_segments")]
        let manifest_wal = ManifestWal::open(manifest_wal_path(path_ref))?;
        #[cfg(feature = "parallel_segments")]
        let manifest_wal_entries = manifest_wal.replay()?;

        // No frames yet, so payload region ends at WAL boundary
        let cached_payload_end = header.wal_offset + header.wal_size;

        let mut memvid = Self {
            file,
            path: path_ref.to_path_buf(),
            lock,
            read_only: false,
            header,
            toc,
            wal,
            pending_frame_inserts: 0,
            data_end,
            cached_payload_end,
            generation: 0,
            lock_settings: LockSettings::default(),
            lex_enabled: cfg!(feature = "lex"), // Enable by default if feature is enabled
            lex_index: None,
            #[cfg(feature = "lex")]
            lex_storage,
            vec_enabled: cfg!(feature = "vec"), // Enable by default if feature is enabled
            vec_compression: VectorCompression::None,
            vec_model: None,
            vec_index: None,
            clip_enabled: cfg!(feature = "clip"), // Enable by default if feature is enabled
            clip_index: None,
            dirty: false,
            #[cfg(feature = "lex")]
            tantivy: None,
            #[cfg(feature = "lex")]
            tantivy_dirty: false,
            #[cfg(feature = "temporal_track")]
            temporal_track: None,
            #[cfg(feature = "parallel_segments")]
            manifest_wal: Some(manifest_wal),
            memories_track: MemoriesTrack::new(),
            logic_mesh: LogicMesh::new(),
            sketch_track: SketchTrack::default(),
            schema_registry: SchemaRegistry::new(),
            schema_strict: false,
            batch_opts: None,
            #[cfg(feature = "replay")]
            active_session: None,
            #[cfg(feature = "replay")]
            completed_sessions: Vec::new(),
        };

        #[cfg(feature = "lex")]
        memvid.init_tantivy()?;

        #[cfg(feature = "parallel_segments")]
        memvid.load_manifest_segments(manifest_wal_entries);

        memvid.bootstrap_segment_catalog();

        // Create empty manifests for enabled indexes so they persist across open/close
        let empty_offset = memvid.data_end;
        let empty_checksum = *b"\xe3\xb0\xc4\x42\x98\xfc\x1c\x14\x9a\xfb\xf4\xc8\x99\x6f\xb9\x24\
                                \x27\xae\x41\xe4\x64\x9b\x93\x4c\xa4\x95\x99\x1b\x78\x52\xb8\x55";

        #[cfg(feature = "lex")]
        if memvid.lex_enabled && memvid.toc.indexes.lex.is_none() {
            memvid.toc.indexes.lex = Some(crate::types::LexIndexManifest {
                doc_count: 0,
                generation: 0,
                bytes_offset: empty_offset,
                bytes_length: 0,
                checksum: empty_checksum,
            });
        }

        #[cfg(feature = "vec")]
        if memvid.vec_enabled && memvid.toc.indexes.vec.is_none() {
            memvid.toc.indexes.vec = Some(crate::types::VecIndexManifest {
                vector_count: 0,
                dimension: 0,
                bytes_offset: empty_offset,
                bytes_length: 0,
                checksum: empty_checksum,
                compression_mode: memvid.vec_compression.clone(),
                model: memvid.vec_model.clone(),
            });
        }

        memvid.rewrit
```

### Core Architecture Module: `src/memvid/workers.rs`
```
#![cfg(feature = "parallel_segments")]

use std::{
    any::Any,
    collections::HashMap,
    io::Cursor,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::Instant,
};

use crossbeam_channel::{Receiver, Sender, bounded};
use tracing::debug;

use super::{
    builder::BuildOpts,
    planner::{PlannerMessage, SegmentPlan},
    segments::{LexSegmentArtifact, TimeSegmentArtifact, VecSegmentArtifact},
};
use crate::{
    MemvidError, Result, TimeIndexEntry, time_index_append,
    types::{SegmentSpan, SegmentStats},
};

/// Minimum number of vectors required to use Product Quantization.
/// Below this threshold, we fall back to uncompressed vectors.
/// PQ requires training k-means on many vectors to learn good codebooks.
const MIN_VECTORS_FOR_PQ: usize = 100;

/// Drives segment-building work by fanning `SegmentPlan`s across worker threads.
pub(crate) struct SegmentWorkerPool {
    threads: usize,
    queue_depth: usize,
    opts: BuildOpts,
}

#[derive(Debug)]
pub(crate) struct SegmentArtifact<T> {
    pub artifact: T,
    pub stats: SegmentStats,
}

#[derive(Debug)]
pub(crate) struct SegmentResult {
    pub plan_index: usize,
    pub span: Option<SegmentSpan>,
    pub lex: Option<SegmentArtifact<LexSegmentArtifact>>,
    pub vec: Option<SegmentArtifact<VecSegmentArtifact>>,
    pub time: Option<SegmentArtifact<TimeSegmentArtifact>>,
}

enum WorkerMessage {
    Result(SegmentResult),
    Error(MemvidError),
}

impl SegmentWorkerPool {
    pub fn new(opts: &BuildOpts) -> Self {
        Self {
            threads: opts.threads.max(1),
            queue_depth: opts.queue_depth.max(1),
            opts: opts.clone(),
        }
    }

    pub fn execute(&self, plans: Vec<SegmentPlan>) -> Result<Vec<SegmentResult>> {
        let plan_count = plans.len();
        if plan_count == 0 {
            return Ok(Vec::new());
        }

        let (plan_tx, plan_rx) = bounded(self.queue_depth);
        let (result_tx, result_rx) = bounded(self.queue_depth);
        let cancel_flag = Arc::new(AtomicBool::new(false));

        let mut handles = Vec::with_capacity(self.threads);
        for worker_id in 0..self.threads {
            let rx = plan_rx.clone();
            let tx = result_tx.clone();
            let cancel = cancel_flag.clone();
            let opts = self.opts.clone();
            handles.push(thread::spawn(move || {
                worker_loop(worker_id, rx, tx, cancel, opts)
            }));
        }
        drop(result_tx);

        for (plan_index, plan) in plans.into_iter().enumerate() {
            if cancel_flag.load(Ordering::SeqCst) {
                break;
            }
            if plan_tx
                .send(PlannerMessage::Plan { plan_index, plan })
                .is_err()
            {
                cancel_flag.store(true, Ordering::SeqCst);
                break;
            }
        }
        for _ in 0..self.threads {
            let _ = plan_tx.send(PlannerMessage::Shutdown);
        }
        drop(plan_tx);

        let mut results = Vec::with_capacity(plan_count);
        let mut worker_error: Option<MemvidError> = None;
        while results.len() < plan_count {
            match result_rx.recv() {
                Ok(WorkerMessage::Result(result)) => {
                    results.push(result);
                }
                Ok(WorkerMessage::Error(err)) => {
                    worker_error = Some(err);
                    cancel_flag.store(true, Ordering::SeqCst);
                    break;
                }
                Err(_) => {
                    if worker_error.is_none() {
                        worker_error = Some(MemvidError::CheckpointFailed {
                            reason: "worker channel closed unexpectedly".into(),
                        });
                    }
                    break;
                }
            }
        }

        for handle in handles {
            if let Err(panic) = handle.join() {
                if worker_error.is_none() {
                    worker_error = Some(MemvidError::CheckpointFailed {
                        reason: format!(
                            "parallel segment worker panicked: {}",
                            panic_payload(&panic)
                        ),
                    });
                }
            }
        }

        if worker_error.is_none() && results.len() != plan_count {
            worker_error = Some(MemvidError::CheckpointFailed {
                reason: format!(
                    "expected {plan_count} segment results, received {}",
                    results.len()
                ),
            });
        }

        if let Some(err) = worker_error {
            return Err(err);
        }

        results.sort_by_key(|result| result.plan_index);
        Ok(results)
    }
}

fn worker_loop(
    worker_id: usize,
    plan_rx: Receiver<PlannerMessage>,
    result_tx: Sender<WorkerMessage>,
    cancel: Arc<AtomicBool>,
    opts: BuildOpts,
) {
    while !cancel.load(Ordering::SeqCst) {
        match plan_rx.recv() {
            Ok(PlannerMessage::Plan { plan_index, plan }) => {
                debug!(
                    worker_id,
                    plan_index,
                    chunks = plan.chunks.len(),
                    tokens = plan.estimated_tokens,
                    pages = plan.estimated_pages,
                    "segment worker building artifacts"
                );
                match build_segment(plan_index, plan, &opts) {
                    Ok(result) => {
                        if result_tx.send(WorkerMessage::Result(result)).is_err() {
                            cancel.store(true, Ordering::SeqCst);
                            break;
                        }
                    }
                    Err(err) => {
                        let _ = result_tx.send(WorkerMessage::Error(err));
                        cancel.store(true, Ordering::SeqCst);
                        break;
                    }
                }
            }
            Ok(PlannerMessage::Shutdown) | Err(_) => break,
        }
    }
}

fn build_segment(plan_index: usize, plan: SegmentPlan, opts: &BuildOpts) -> Result<SegmentResult> {
    let span = span_from_plan(plan_index, &plan);
    let lex = build_lex_artifact(plan_index, &plan)?;
    let vec = build_vec_artifact(plan_index, &plan, opts)?;
    let time = build_time_artifact(plan_index, &plan)?;
    Ok(SegmentResult {
        plan_index,
        span,
        lex,
        vec,
        time,
    })
}

fn build_lex_artifact(
    _plan_index: usize,
    plan: &SegmentPlan,
) -> Result<Option<SegmentArtifact<LexSegmentArtifact>>> {
    if plan.chunks.is_empty() {
        return Ok(None);
    }
    let mut builder = crate::lex::LexIndexBuilder::new();
    let mut docs_added = 0usize;
    let tags = HashMap::new();
    let start = Instant::now();
    for chunk in &plan.chunks {
        if chunk.text.trim().is_empty() {
            continue;
        }
        docs_added += 1;
        let uri = format!("memvid://frame/{}", chunk.frame_id);
        builder.add_document(chunk.frame_id, &uri, None, &chunk.text, &tags);
    }
    if docs_added == 0 {
        return Ok(None);
    }
    let artifact = builder.finish()?;
    if artifact.doc_count == 0 {
        return Ok(None);
    }
    let artifact = LexSegmentArtifact {
        bytes: artifact.bytes,
        doc_count: artifact.doc_count,
        checksum: artifact.checksum,
    };
    let stats = SegmentStats {
        doc_count: artifact.doc_count,
        vector_count: 0,
        time_entries: 0,
        bytes_uncompressed: artifact.bytes.len() as u64,
        build_micros: start.elapsed().as_micros() as u64,
    };
    Ok(Some(SegmentArtifact { artifact, stats }))
}

fn build_vec_artifact(
    _plan_index: usize,
    plan: &SegmentPlan,
    opts: &BuildOpts,
) -> Result<Option<SegmentArtifact<VecSegmentArtifact>>> {
    use crate::types::VectorCompression;
    use tracing::info;

    if plan.chunks.is_empty() {
        info!("build_vec_artifact: plan.chunks is empty, returning None");
        return Ok(None);
    }

    let start = Instant::now();

    // Count non-empty vectors
    let non_empty_count = plan
        .chunks
        .iter()
        .filter(|chunk| chunk.embedding.as_ref().map_or(false, |e| !e.is_empty()))
        .count();

    info!(
        chunks = plan.chunks.len(),
        non_empty_count, "build_vec_artifact: checking embeddings in plan"
    );

    // Determine effective compression: use uncompressed if below PQ threshold
    let effective_compression = match &opts.vec_compression {
        VectorCompression::Pq96 if non_empty_count < MIN_VECTORS_FOR_PQ => {
            // Fall back to uncompressed for small vector counts
            VectorCompression::None
        }
        other => other.clone(),
    };

    match effective_compression {
        VectorCompression::None => {
            // Uncompressed path - use regular VecIndexBuilder
            let mut builder = crate::vec::VecIndexBuilder::new();
            let mut vectors = 0usize;
            let mut dimension = 0u32;

            for chunk in &plan.chunks {
                let Some(embedding) = chunk.embedding.as_ref() else {
                    continue;
                };
                if embedding.is_empty() {
                    continue;
                }
                dimension = dimension.max(embedding.len() as u32);
                vectors += 1;
                builder.add_document(chunk.frame_id, embedding.clone());
            }

            if vectors == 0 {
                return Ok(None);
            }

            let artifact = builder.finish()?;
            if artifact.vector_count == 0 {
                return Ok(None);
            }

            let final_dimension = if artifact.dimension == 0 {
                dimension
            } else {
                artifact.dimension
            };

            let artifact = VecSegmentArtifact {
 
```

### Core Architecture Module: `src/replay/engine.rs`
```
//! Replay execution engine for time-travel debugging.
//!
//! The replay engine can execute recorded sessions deterministically,
//! compare results with original recordings, and support checkpoint-based
//! partial replay.

use super::types::{ActionType, ReplaySession};
use crate::MemvidError;
use crate::error::Result;
use crate::memvid::lifecycle::Memvid;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use uuid::Uuid;

/// Result of replaying a single action.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionReplayResult {
    /// Sequence number of the action
    pub sequence: u64,
    /// Whether the replay matched the original
    pub matched: bool,
    /// Description of any differences
    pub diff: Option<String>,
    /// Duration of the replay in milliseconds
    pub duration_ms: u64,
    /// Original action type
    pub action_type: String,
}

/// Summary of a full session replay.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayResult {
    /// Session that was replayed
    pub session_id: Uuid,
    /// Total actions replayed
    pub total_actions: usize,
    /// Actions that matched their recorded state
    pub matched_actions: usize,
    /// Actions that differed from recorded state
    pub mismatched_actions: usize,
    /// Actions that were skipped
    pub skipped_actions: usize,
    /// Detailed results per action
    pub action_results: Vec<ActionReplayResult>,
    /// Total replay duration in milliseconds
    pub total_duration_ms: u64,
    /// Checkpoint used as starting point (if any)
    pub from_checkpoint: Option<u64>,
}

impl ReplayResult {
    /// Check if the replay was successful (all actions matched).
    #[must_use]
    pub fn is_success(&self) -> bool {
        self.mismatched_actions == 0
    }

    /// Get the match rate as a percentage.
    #[must_use]
    pub fn match_rate(&self) -> f64 {
        if self.total_actions == 0 {
            100.0
        } else {
            (self.matched_actions as f64 / self.total_actions as f64) * 100.0
        }
    }
}

/// Configuration for replay execution.
#[derive(Debug, Clone)]
pub struct ReplayExecutionConfig {
    /// Skip put actions (useful for read-only replay)
    pub skip_puts: bool,
    /// Skip find actions
    pub skip_finds: bool,
    /// Skip ask actions (useful when LLM not available)
    pub skip_asks: bool,
    /// Stop on first mismatch
    pub stop_on_mismatch: bool,
    /// Verbose logging
    pub verbose: bool,
    /// Override top-k for find actions (None = use original values)
    /// Higher values reveal documents that may have been missed
    pub top_k: Option<usize>,
    /// Use adaptive retrieval based on score distribution
    pub adaptive: bool,
    /// Minimum relevancy score for adaptive mode (0.0-1.0)
    pub min_relevancy: f32,
    /// AUDIT MODE: Use frozen retrieval for ASK actions
    /// When true, ASK actions use recorded frame IDs instead of re-executing search
    pub audit_mode: bool,
    /// Override model for audit replay (format: "provider:model")
    /// When set, re-executes LLM call with frozen context using this model
    pub use_model: Option<String>,
    /// Generate diff report comparing original vs new answers
    pub generate_diff: bool,
}

impl Default for ReplayExecutionConfig {
    fn default() -> Self {
        Self {
            skip_puts: false,
            skip_finds: false,
            skip_asks: false,
            stop_on_mismatch: false,
            verbose: false,
            top_k: None,
            adaptive: false,
            min_relevancy: 0.5,
            audit_mode: false,
            use_model: None,
            generate_diff: false,
        }
    }
}

/// The replay engine executes recorded sessions.
pub struct ReplayEngine<'a> {
    /// The memory file to replay against
    mem: &'a mut Memvid,
    /// Configuration for replay
    config: ReplayExecutionConfig,
}

impl<'a> ReplayEngine<'a> {
    /// Create a new replay engine.
    pub fn new(mem: &'a mut Memvid, config: ReplayExecutionConfig) -> Self {
        Self { mem, config }
    }

    /// Replay a full session from the beginning.
    pub fn replay_session(&mut self, session: &ReplaySession) -> Result<ReplayResult> {
        self.replay_session_from(session, None)
    }

    /// Replay a session starting from a specific checkpoint.
    pub fn replay_session_from(
        &mut self,
        session: &ReplaySession,
        from_checkpoint: Option<u64>,
    ) -> Result<ReplayResult> {
        let start_time = Instant::now();
        let mut result = ReplayResult {
            session_id: session.session_id,
            total_actions: 0,
            matched_actions: 0,
            mismatched_actions: 0,
            skipped_actions: 0,
            action_results: Vec::new(),
            total_duration_ms: 0,
            from_checkpoint,
        };

        // Determine starting sequence
        let start_sequence = if let Some(checkpoint_id) = from_checkpoint {
            let checkpoint = session
                .checkpoints
                .iter()
                .find(|c| c.id == checkpoint_id)
                .ok_or_else(|| MemvidError::InvalidQuery {
                    reason: format!("Checkpoint {checkpoint_id} not found in session"),
                })?;
            checkpoint.at_sequence
        } else {
            0
        };

        // Filter actions to replay
        let actions_to_replay: Vec<_> = session
            .actions
            .iter()
            .filter(|a| a.sequence >= start_sequence)
            .collect();

        result.total_actions = actions_to_replay.len();

        for action in actions_to_replay {
            let action_start = Instant::now();
            let mut action_result = ActionReplayResult {
                sequence: action.sequence,
                matched: false,
                diff: None,
                duration_ms: 0,
                action_type: action.action_type.name().to_string(),
            };

            match &action.action_type {
                ActionType::Put { frame_id } => {
                    if self.config.skip_puts {
                        result.skipped_actions += 1;
                        action_result.diff = Some("skipped".to_string());
                    } else {
                        // Put actions can't be replayed deterministically (they create new frame IDs)
                        // The frame_id recorded is the WAL sequence, not the frame index
                        // Just verify that frames exist (we can't verify the exact ID)
                        let frame_count = self.mem.toc.frames.len();
                        if frame_count > 0 {
                            action_result.matched = true;
                            action_result.diff = Some(format!(
                                "Put verified (seq {frame_id}, {frame_count} frames total)"
                            ));
                            result.matched_actions += 1;
                        } else {
                            action_result.matched = false;
                            action_result.diff = Some("No frames found".to_string());
                            result.mismatched_actions += 1;
                        }
                    }
                }

                ActionType::Find {
                    query,
                    mode: _,
                    result_count,
                } => {
                    if self.config.skip_finds {
                        result.skipped_actions += 1;
                        action_result.diff = Some("skipped".to_string());
                    } else {
                        // Determine the top_k to use:
                        // 1. Use config override if specified (for time-travel analysis)
                        // 2. Otherwise use the original value to verify consistency
                        let replay_top_k = self.config.top_k.unwrap_or(*result_count);

                        // Re-execute the search using the search() API which handles
                        // both lex-only and hybrid search modes
                        let search_request = crate::types::SearchRequest {
                            query: query.clone(),
                            top_k: replay_top_k,
                            snippet_chars: 120,
                            uri: None,
                            scope: None,
                            cursor: None,
                            #[cfg(feature = "temporal_track")]
                            temporal: None,
                            as_of_frame: None,
                            as_of_ts: None,
                            no_sketch: false,
                            acl_context: None,
                            acl_enforcement_mode: crate::types::AclEnforcementMode::Audit,
                        };
                        match self.mem.search(search_request) {
                            Ok(response) => {
                                let replay_count = if self.config.adaptive {
                                    // Adaptive mode: count only results above min_relevancy
                                    response
                                        .hits
                                        .iter()
                                        .filter(|h| {
                                            h.score.unwrap_or(0.0) >= self.config.min_relevancy
                                        })
                                        .count()
                                } else {
                                    response.hits.len()
                                };

                                // If we're using a custom top_k, show analysis instead of mismatch
                                if self.config.top_k.is_some() && replay_count != *result_count {
                                    // Build document details string - always show what was found
                                    l
```

### Core Architecture Module: `src/search/tantivy/engine.rs`
```
use super::query;
use super::schema::{build_schema, initialise_tokenizer};
use super::util::to_search_value;
use crate::search::parser::ParsedQuery;
use crate::types::{Frame, FrameId};
use crate::{MemvidError, Result};
use blake3::{Hasher, hash};
use tantivy::collector::TopDocs;
use tantivy::indexer::IndexWriter;
use tantivy::schema::{Field, OwnedValue, Schema, TantivyDocument};
use tantivy::{Index, IndexReader, Term, doc};
use tempfile::TempDir;

/// Tantivy-backed search index used when the `lex` feature is enabled.
///
/// Field order is load-bearing for `Drop`: Rust drops struct fields in
/// declaration order, so `work_dir` (the temporary directory backing the
/// index) **must remain the last field**. The `index`, `reader`, and
/// `index_writer` all keep file handles and lock files open inside that
/// directory; if the `TempDir` were dropped first, its directory removal
/// would fail on platforms that refuse to delete files with open handles
/// (notably Windows), silently leaking one working directory per discarded
/// engine. See https://github.com/memvid/memvid/issues/215.
pub struct TantivyEngine {
    pub(super) index: Index,
    pub(super) _schema: Schema,
    pub(super) content: Field,
    pub(super) tags: Field,
    pub(super) labels: Field,
    pub(super) track: Field,
    pub(super) timestamp: Field,
    pub(super) uri: Field,
    pub(super) frame_id: Field,
    pub(super) index_writer: Option<IndexWriter>,
    pub(super) reader: IndexReader,
    pub(super) tokenizer: Option<String>,
    // MUST be the last field — see the type-level comment above.
    pub(super) work_dir: TempDir,
}

impl Drop for TantivyEngine {
    fn drop(&mut self) {
        // Release the exclusive writer (and its `.tantivy-writer.lock`) before
        // the `work_dir` TempDir is removed during normal field drop. Without
        // this the writer lock can still be held when the directory removal
        // runs, leaking the working directory on Windows. See issue #215.
        if let Some(writer) = self.index_writer.take() {
            drop(writer);
        }
    }
}

/// Search hit returned from Tantivy queries.
pub struct TantivyDocHit {
    pub frame_id: u64,
    pub score: f32,
    #[allow(dead_code)] // Content preserved for debugging; evaluation uses frame metadata
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct TantivySnapshot {
    pub doc_count: u64,
    pub checksum: [u8; 32],
    pub segments: Vec<TantivySegmentBlob>,
}

#[derive(Debug, Clone)]
pub struct TantivySegmentBlob {
    pub path: String,
    pub bytes: Vec<u8>,
    pub checksum: [u8; 32],
}

impl TantivyEngine {
    pub fn create() -> Result<Self> {
        let dir = TempDir::new().map_err(|err| MemvidError::Tantivy {
            reason: format!("failed to allocate Tantivy work directory: {err}"),
        })?;
        let schema = build_schema();
        let index = Index::create_in_dir(dir.path(), schema.clone()).map_err(|err| {
            MemvidError::Tantivy {
                reason: err.to_string(),
            }
        })?;
        initialise_tokenizer(&index);
        Self::from_parts(dir, index, schema)
    }

    pub fn open_from_dir(dir: TempDir) -> Result<Self> {
        let index = Index::open_in_dir(dir.path()).map_err(|err| MemvidError::Tantivy {
            reason: err.to_string(),
        })?;
        initialise_tokenizer(&index);
        let schema = index.schema();
        Self::from_parts(dir, index, schema)
    }

    fn from_parts(dir: TempDir, index: Index, schema: Schema) -> Result<Self> {
        let content = schema
            .get_field("content")
            .map_err(|err| MemvidError::Tantivy {
                reason: err.to_string(),
            })?;
        let tags = schema
            .get_field("tags")
            .map_err(|err| MemvidError::Tantivy {
                reason: err.to_string(),
            })?;
        let labels = schema
            .get_field("labels")
            .map_err(|err| MemvidError::Tantivy {
                reason: err.to_string(),
            })?;
        let track = schema
            .get_field("track")
            .map_err(|err| MemvidError::Tantivy {
                reason: err.to_string(),
            })?;
        let timestamp = schema
            .get_field("timestamp")
            .map_err(|err| MemvidError::Tantivy {
                reason: err.to_string(),
            })?;
        let uri = schema
            .get_field("uri")
            .map_err(|err| MemvidError::Tantivy {
                reason: err.to_string(),
            })?;
        let frame_id = schema
            .get_field("frame_id")
            .map_err(|err| MemvidError::Tantivy {
                reason: err.to_string(),
            })?;

        let writer = index
            .writer(50_000_000)
            .map_err(|err| MemvidError::Tantivy {
                reason: err.to_string(),
            })?;
        let reader = index.reader().map_err(|err| MemvidError::Tantivy {
            reason: err.to_string(),
        })?;

        Ok(Self {
            work_dir: dir,
            index,
            _schema: schema,
            content,
            tags,
            labels,
            track,
            timestamp,
            uri,
            frame_id,
            index_writer: Some(writer),
            reader,
            tokenizer: Some("memvid_default".to_string()),
        })
    }

    fn take_writer(&mut self) -> Result<IndexWriter> {
        self.index_writer.take().ok_or(MemvidError::Tantivy {
            reason: "tantivy index writer unavailable".into(),
        })
    }

    fn writer_mut(&mut self) -> Result<&mut IndexWriter> {
        self.index_writer.as_mut().ok_or(MemvidError::Tantivy {
            reason: "tantivy index writer unavailable".into(),
        })
    }

    fn create_writer(&self) -> Result<IndexWriter> {
        // Use single thread for deterministic index generation
        self.index
            .writer_with_num_threads(1, 50_000_000)
            .map_err(|err| MemvidError::Tantivy {
                reason: err.to_string(),
            })
    }

    pub fn add_frame(&mut self, frame: &Frame, content: &str) -> Result<()> {
        if content.trim().is_empty() {
            return Ok(());
        }
        let mut document = doc!(
            self.content => content,
            self.timestamp => frame.timestamp,
            self.frame_id => frame.id,
        );
        for tag in &frame.tags {
            document.add_text(self.tags, to_search_value(tag));
        }
        for label in &frame.labels {
            document.add_text(self.labels, to_search_value(label));
        }
        if let Some(track) = &frame.track {
            document.add_text(self.track, to_search_value(track));
        }
        if let Some(uri) = &frame.uri {
            document.add_text(self.uri, to_search_value(uri));
        }
        self.writer_mut()?
            .add_document(document)
            .map_err(|err| MemvidError::Tantivy {
                reason: err.to_string(),
            })?;
        Ok(())
    }

    pub fn delete_frame(&mut self, frame_id: FrameId) -> Result<()> {
        let term = Term::from_field_u64(self.frame_id, frame_id);
        if let Some(writer) = self.index_writer.as_mut() {
            writer.delete_term(term);
        }
        Ok(())
    }

    pub fn commit(&mut self) -> Result<()> {
        let mut writer = self.take_writer()?;
        writer.commit().map_err(|err| MemvidError::Tantivy {
            reason: err.to_string(),
        })?;
        writer
            .wait_merging_threads()
            .map_err(|err| MemvidError::Tantivy {
                reason: err.to_string(),
            })?;
        self.index_writer = Some(self.create_writer()?);
        self.reader.reload().map_err(|err| MemvidError::Tantivy {
            reason: err.to_string(),
        })?;
        Ok(())
    }

    /// Soft commit that makes documents searchable immediately without waiting for merge.
    /// Used for instant indexing during progressive ingestion (Phase 1).
    /// This is faster than full `commit()` but leaves segments unmerged.
    pub fn soft_commit(&mut self) -> Result<()> {
        let writer = self.writer_mut()?;
        writer.commit().map_err(|err| MemvidError::Tantivy {
            reason: err.to_string(),
        })?;
        // Don't wait for merge threads - let them run in background
        // Reload reader to make new documents searchable immediately
        self.reader.reload().map_err(|err| MemvidError::Tantivy {
            reason: err.to_string(),
        })?;
        Ok(())
    }

    /// Add frame and make it searchable immediately via soft commit.
    /// Returns Ok(true) if the frame was indexed, Ok(false) if skipped (empty content).
    #[allow(dead_code)]
    pub fn add_frame_immediate(&mut self, frame: &Frame, content: &str) -> Result<bool> {
        if content.trim().is_empty() {
            return Ok(false);
        }
        self.add_frame(frame, content)?;
        self.soft_commit()?;
        Ok(true)
    }

    pub fn reset(&mut self) -> Result<()> {
        let mut writer = self.take_writer()?;
        writer
            .delete_all_documents()
            .map_err(|err| MemvidError::Tantivy {
                reason: err.to_string(),
            })?;
        writer.commit().map_err(|err| MemvidError::Tantivy {
            reason: err.to_string(),
        })?;
        writer
            .wait_merging_threads()
            .map_err(|err| MemvidError::Tantivy {
                reason: err.to_string(),
            })?;
        self.index_writer = Some(self.create_writer()?);
        self.reader.reload().map_err(|err| MemvidError::Tantivy {
            reason: err.to_string(),
        })?;
        Ok(())
    }

    pub fn search_documents(
        &self,
        parsed: &ParsedQuery,
        uri_filter: Option<&str>,
        scope_filter: Option<&str>,
        frame_filter: Option<&[u64]>,
        limit: usize,
    ) -> Result<Vec<T
```

### Core Architecture Module: `src/search/tantivy/util.rs`
```
// Safe unwrap: single-element vector pop after length == 1 check.
#![allow(clippy::unwrap_used)]
use tantivy::query::{AllQuery, BooleanQuery, Occur, Query};

pub(super) fn to_search_value(value: &str) -> String {
    value.to_ascii_lowercase()
}

pub(super) fn combine_should_queries(mut queries: Vec<Box<dyn Query>>) -> Box<dyn Query> {
    match queries.len() {
        0 => Box::new(AllQuery),
        1 => queries.pop().unwrap(),
        _ => Box::new(BooleanQuery::new(
            queries
                .into_iter()
                .map(|query| (Occur::Should, query))
                .collect(),
        )),
    }
}

```

### Core Architecture Module: `benches/search_precision_benchmark.rs`
```
//! Search precision benchmarks for implicit AND operator change.
//!
//! This benchmark suite measures the performance impact of changing the implicit
//! query operator from OR to AND. It verifies that the precision improvement
//! (33% → 100%) comes with no query latency regression.
//!
//! # Benchmarks
//!
//! - `query_two_words`: Measures latency for simple two-word queries
//! - `precision_calculation`: Measures precision metrics and filtering overhead
//! - `result_count`: Measures result set size impact
//!
//! # Running
//!
//! ```bash
//! cargo bench --bench search_precision_benchmark --features lex
//! ```

use criterion::{Criterion, criterion_group, criterion_main};
use memvid_core::{Memvid, PutOptions, SearchRequest};
use std::time::Instant;

/// Setup test corpus
fn setup_corpus(size: usize) -> std::path::PathBuf {
    let temp_file = std::env::temp_dir().join(format!("bench_{}.mv2", size));
    let _ = std::fs::remove_file(&temp_file);

    let mut mem = Memvid::create(&temp_file).unwrap();

    let topics = [
        "machine learning neural networks",
        "python programming development",
        "machine learning with python",
        "rust systems programming",
        "web development javascript",
    ];

    for i in 0..size {
        let content = format!("Document {} about {}", i, topics[i % topics.len()]);
        mem.put_bytes_with_options(
            content.as_bytes(),
            PutOptions::builder().title(format!("Doc {}", i)).build(),
        )
        .unwrap();

        if (i + 1) % 100 == 0 {
            mem.commit().unwrap();
        }
    }
    mem.commit().unwrap();
    temp_file
}

fn bench_query_latency(c: &mut Criterion) {
    let corpus_path = setup_corpus(1000);

    c.bench_function("query_two_words", |b| {
        b.iter_custom(|iters| {
            let mut total = std::time::Duration::ZERO;
            for _ in 0..iters {
                let mut mem = Memvid::open(&corpus_path).unwrap(); // FIX: mut
                let start = Instant::now();
                let _results = mem
                    .search(SearchRequest {
                        query: "machine learning".to_string(),
                        top_k: 10,
                        snippet_chars: 200,
                        uri: None,
                        scope: None,
                        cursor: None,
                        #[cfg(feature = "temporal_track")]
                        temporal: None,
                        as_of_frame: None,
                        as_of_ts: None,
                        no_sketch: false,
                        acl_context: None,
                        acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
                    })
                    .unwrap();
                total += start.elapsed();
            }
            total
        });
    });

    std::fs::remove_file(&corpus_path).ok();
}

fn bench_precision(c: &mut Criterion) {
    let corpus_path = setup_corpus(1000);

    c.bench_function("precision_calculation", |b| {
        b.iter_custom(|iters| {
            let mut total = std::time::Duration::ZERO;
            for _ in 0..iters {
                let mut mem = Memvid::open(&corpus_path).unwrap(); // FIX: mut
                let start = Instant::now();
                let results = mem
                    .search(SearchRequest {
                        query: "machine python".to_string(),
                        top_k: 100,
                        snippet_chars: 200,
                        uri: None,
                        scope: None,
                        cursor: None,
                        #[cfg(feature = "temporal_track")]
                        temporal: None,
                        as_of_frame: None,
                        as_of_ts: None,
                        no_sketch: false,
                        acl_context: None,
                        acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
                    })
                    .unwrap();

                let _relevant = results
                    .hits
                    .iter()
                    .filter(|hit| {
                        let text = hit.text.to_lowercase();
                        text.contains("machine") && text.contains("python")
                    })
                    .count();

                total += start.elapsed();
            }
            total
        });
    });

    std::fs::remove_file(&corpus_path).ok();
}

fn bench_result_count(c: &mut Criterion) {
    let corpus_path = setup_corpus(1000);

    c.bench_function("result_count", |b| {
        b.iter_custom(|iters| {
            let mut total = std::time::Duration::ZERO;
            for _ in 0..iters {
                let mut mem = Memvid::open(&corpus_path).unwrap(); // FIX: mut
                let start = Instant::now();
                let results = mem
                    .search(SearchRequest {
                        query: "machine learning".to_string(),
                        top_k: 100,
                        snippet_chars: 200,
                        uri: None,
                        scope: None,
                        cursor: None,
                        #[cfg(feature = "temporal_track")]
                        temporal: None,
                        as_of_frame: None,
                        as_of_ts: None,
                        no_sketch: false,
                        acl_context: None,
                        acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
                    })
                    .unwrap();
                let _count = results.hits.len();
                total += start.elapsed();
            }
            total
        });
    });

    std::fs::remove_file(&corpus_path).ok();
}

criterion_group!(
    benches,
    bench_query_latency,
    bench_precision,
    bench_result_count
);
criterion_main!(benches);

```

### Core Architecture Module: `benches/vec_search_benchmark.rs`
```
use criterion::{Criterion, black_box, criterion_group, criterion_main};
use memvid_core::types::FrameId;
use memvid_core::vec::{VecDocument, VecIndex, VecIndexBuilder};

fn generate_vectors(count: usize, dim: usize) -> Vec<Vec<f32>> {
    let mut vectors = Vec::with_capacity(count);
    for _ in 0..count {
        let mut vec = Vec::with_capacity(dim);
        for _ in 0..dim {
            vec.push(fastrand::f32());
        }
        vectors.push(vec);
    }
    vectors
}

fn bench_search_10k(c: &mut Criterion) {
    let count = 10_000;
    let dim = 128; // Smaller dimension for faster setup in benchmarks
    let vectors = generate_vectors(count, dim);
    let query = generate_vectors(1, dim).pop().unwrap();

    // Build HNSW Index (via Builder which triggers HNSW for > 1000)
    let mut builder = VecIndexBuilder::new();
    for (i, vec) in vectors.iter().enumerate() {
        builder.add_document(i as FrameId, vec.clone());
    }
    let artifact = builder.finish().expect("finish hnsw");
    let hnsw_index = VecIndex::decode(&artifact.bytes).expect("decode hnsw");

    // Build Brute Force Index (Force Uncompressed)
    let documents: Vec<VecDocument> = vectors
        .iter()
        .enumerate()
        .map(|(i, vec)| VecDocument {
            frame_id: i as FrameId,
            embedding: vec.clone(),
        })
        .collect();
    let brute_index = VecIndex::Uncompressed { documents };

    let mut group = c.benchmark_group("search_10k");

    group.bench_function("hnsw", |b| {
        b.iter(|| {
            hnsw_index.search(black_box(&query), black_box(10));
        })
    });

    group.bench_function("brute_force", |b| {
        b.iter(|| {
            brute_index.search(black_box(&query), black_box(10));
        })
    });

    group.finish();
}

fn bench_search_50k(c: &mut Criterion) {
    let count = 50_000;
    let dim = 128;
    let vectors = generate_vectors(count, dim);
    let query = generate_vectors(1, dim).pop().unwrap();

    let mut builder = VecIndexBuilder::new();
    for (i, vec) in vectors.iter().enumerate() {
        builder.add_document(i as FrameId, vec.clone());
    }
    let artifact = builder.finish().expect("finish hnsw");
    let hnsw_index = VecIndex::decode(&artifact.bytes).expect("decode hnsw");

    let documents: Vec<VecDocument> = vectors
        .iter()
        .enumerate()
        .map(|(i, vec)| VecDocument {
            frame_id: i as FrameId,
            embedding: vec.clone(),
        })
        .collect();
    let brute_index = VecIndex::Uncompressed { documents };

    let mut group = c.benchmark_group("search_50k");

    group.bench_function("hnsw", |b| {
        b.iter(|| {
            hnsw_index.search(black_box(&query), black_box(10));
        })
    });

    group.bench_function("brute_force", |b| {
        b.iter(|| {
            brute_index.search(black_box(&query), black_box(10));
        })
    });

    group.finish();
}

fn bench_search_100k(c: &mut Criterion) {
    let count = 100_000;
    let dim = 128;
    let vectors = generate_vectors(count, dim);
    let query = generate_vectors(1, dim).pop().unwrap();

    let mut builder = VecIndexBuilder::new();
    for (i, vec) in vectors.iter().enumerate() {
        builder.add_document(i as FrameId, vec.clone());
    }
    let artifact = builder.finish().expect("finish hnsw");
    let hnsw_index = VecIndex::decode(&artifact.bytes).expect("decode hnsw");

    let documents: Vec<VecDocument> = vectors
        .iter()
        .enumerate()
        .map(|(i, vec)| VecDocument {
            frame_id: i as FrameId,
            embedding: vec.clone(),
        })
        .collect();
    let brute_index = VecIndex::Uncompressed { documents };

    let mut group = c.benchmark_group("search_100k");

    group.bench_function("hnsw", |b| {
        b.iter(|| {
            let _ = hnsw_index.search(black_box(&query), black_box(10));
        })
    });

    group.bench_function("brute_force", |b| {
        b.iter(|| {
            let _ = brute_index.search(black_box(&query), black_box(10));
        })
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_search_10k,
    bench_search_50k,
    bench_search_100k
);
criterion_main!(benches);

```

### Core Architecture Module: `examples/basic_usage.rs`
```
//! Basic usage example demonstrating create, put, find, and timeline operations.
//!
//! Run with: cargo run --example basic_usage

use std::path::PathBuf;
use tempfile::tempdir;

use memvid_core::{Memvid, PutOptions, Result, SearchRequest, TimelineQuery};

fn main() -> Result<()> {
    // Create a temporary directory for our example
    let dir = tempdir().expect("failed to create temp dir");
    let path: PathBuf = dir.path().join("example.mv2");

    println!("=== Memvid Core Basic Usage Example ===\n");

    // ========================================
    // 1. CREATE a new memory file
    // ========================================
    println!("1. Creating memory file at {:?}", path);
    let mut mem = Memvid::create(&path)?;
    println!("   Memory created successfully!\n");

    // ========================================
    // 2. PUT documents into the memory
    // ========================================
    println!("2. Adding documents to memory...");

    // Simple put with just bytes
    let seq1 = mem.put_bytes(b"Hello, Memvid! This is a simple text document.")?;
    println!("   Added document 1, sequence: {}", seq1);

    // Put with options (title, URI, tags)
    let options = PutOptions::builder()
        .title("Getting Started Guide")
        .uri("mv2://docs/getting-started.md")
        .tag("category", "documentation")
        .tag("version", "2.0")
        .build();
    let seq2 = mem.put_bytes_with_options(
        b"This guide covers the basics of using Memvid for AI memory storage.",
        options,
    )?;
    println!("   Added document 2 (with metadata), sequence: {}", seq2);

    // Add more documents
    let options = PutOptions::builder()
        .title("API Reference")
        .uri("mv2://docs/api-reference.md")
        .tag("category", "documentation")
        .build();
    mem.put_bytes_with_options(
        b"The Memvid API provides methods for create, put, find, and timeline operations.",
        options,
    )?;

    let options = PutOptions::builder()
        .title("FAQ")
        .uri("mv2://docs/faq.md")
        .tag("category", "support")
        .build();
    mem.put_bytes_with_options(
        b"Frequently asked questions about Memvid memory files and search.",
        options,
    )?;

    // Commit changes to persist them
    mem.commit()?;
    println!("   Committed all changes\n");

    // ========================================
    // 3. STATS - Check memory statistics
    // ========================================
    println!("3. Memory statistics:");
    let stats = mem.stats()?;
    println!("   Frame count: {}", stats.frame_count);
    println!("   Has lexical index: {}", stats.has_lex_index);
    println!("   Has vector index: {}", stats.has_vec_index);
    println!("   Has time index: {}", stats.has_time_index);
    println!();

    // ========================================
    // 4. FIND - Search for documents
    // ========================================
    println!("4. Searching for documents...");

    // Search for "memvid"
    let request = SearchRequest {
        query: "memvid".to_string(),
        top_k: 10,
        snippet_chars: 200,
        uri: None,
        scope: None,
        cursor: None,
        #[cfg(feature = "temporal_track")]
        temporal: None,
        as_of_frame: None,
        as_of_ts: None,
        no_sketch: false,
        acl_context: None,
        acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
    };
    let response = mem.search(request)?;
    println!("   Query: 'memvid'");
    println!("   Total hits: {}", response.total_hits);
    println!("   Elapsed: {}ms", response.elapsed_ms);
    for hit in &response.hits {
        let title = hit.title.as_deref().unwrap_or("Untitled");
        let score = hit.score.unwrap_or(0.0);
        println!("   - [{}] {} (score: {:.3})", hit.frame_id, title, score);
        println!(
            "     Snippet: {}...",
            &hit.text.chars().take(60).collect::<String>()
        );
    }
    println!();

    // Search within a scope
    let request = SearchRequest {
        query: "documentation".to_string(),
        top_k: 10,
        snippet_chars: 100,
        uri: None,
        scope: Some("mv2://docs/".to_string()),
        cursor: None,
        #[cfg(feature = "temporal_track")]
        temporal: None,
        as_of_frame: None,
        as_of_ts: None,
        no_sketch: false,
        acl_context: None,
        acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
    };
    let response = mem.search(request)?;
    println!("   Query: 'documentation' (scope: mv2://docs/)");
    println!("   Total hits: {}", response.total_hits);
    println!();

    // ========================================
    // 5. TIMELINE - Browse documents chronologically
    // ========================================
    println!("5. Timeline (chronological view):");
    let timeline = mem.timeline(TimelineQuery::default())?;
    for entry in &timeline {
        let uri = entry.uri.as_deref().unwrap_or("(no uri)");
        println!(
            "   [{}] {} - {}",
            entry.frame_id,
            uri,
            entry.preview.chars().take(40).collect::<String>()
        );
    }
    println!();

    // ========================================
    // 6. REOPEN - Close and reopen the memory
    // ========================================
    println!("6. Closing and reopening memory...");
    drop(mem);

    let reopened = Memvid::open(&path)?;
    let stats = reopened.stats()?;
    println!("   Reopened successfully!");
    println!("   Frame count after reopen: {}", stats.frame_count);
    println!();

    // ========================================
    // 7. VERIFY - Check file integrity
    // ========================================
    println!("7. Verifying file integrity...");
    drop(reopened); // Close the memory before verifying
    let report = Memvid::verify(&path, false)?;
    println!("   Verification status: {:?}", report.overall_status);
    println!();

    println!("=== Example completed successfully! ===");

    Ok(())
}

```

### Core Architecture Module: `examples/clip_visual_search.rs`
```
//! CLIP Visual Search Example
//!
//! Demonstrates using CLIP embeddings to search PDF pages and images
//! using natural language queries.
//!
//! Run with:
//! ```bash
//! cargo run --example clip_visual_search --features clip,pdfium -- /path/to/pdf
//! ```
//!
//! Prerequisites:
//! 1. Download the MobileCLIP-S2 ONNX models:
//!    ```bash
//!    mkdir -p ~/.local/share/memvid/models
//!    curl -L 'https://huggingface.co/Xenova/mobileclip_s2/resolve/main/onnx/vision_model_int8.onnx' \
//!         -o ~/.local/share/memvid/models/mobileclip-s2_vision.onnx
//!    curl -L 'https://huggingface.co/Xenova/mobileclip_s2/resolve/main/onnx/text_model_int8.onnx' \
//!         -o ~/.local/share/memvid/models/mobileclip-s2_text.onnx
//!    ```
//!
//! 2. For PDF page rendering, install pdfium:
//!    - macOS: `brew install nicbarker/pdfium/pdfium-mac-arm64` or `pdfium-mac-x64`
//!    - Linux: Download from https://github.com/nicbarker/pdfium-builds/releases

fn main() -> memvid_core::Result<()> {
    #[cfg(not(feature = "clip"))]
    {
        eprintln!("This example requires the 'clip' feature.");
        eprintln!("Run with: cargo run --example clip_visual_search --features clip");
        Ok(())
    }

    #[cfg(feature = "clip")]
    {
        use memvid_core::clip::{ClipConfig, ClipIndex, ClipIndexBuilder, ClipModel};
        use std::env;
        use std::path::PathBuf;
        use tempfile::tempdir;

        println!("=== CLIP Visual Search Example ===\n");

        // Get PDF path from args or use default
        let args: Vec<String> = env::args().collect();
        let pdf_path = if args.len() > 1 {
            PathBuf::from(&args[1])
        } else {
            // Default to the SP Global Impact Report if no path provided
            PathBuf::from(
                "/Users/olow/Desktop/memvid-org/brickfield/sp-global-impact-report-2024.pdf",
            )
        };

        if !pdf_path.exists() {
            eprintln!("PDF not found: {}", pdf_path.display());
            eprintln!(
                "Usage: cargo run --example clip_visual_search --features clip,pdfium -- /path/to/pdf"
            );
            return Ok(());
        }

        println!("PDF: {}", pdf_path.display());

        // Initialize CLIP model
        println!("\n1. Loading CLIP model...");
        let config = ClipConfig::default();
        println!("   Model: {}", config.model_name);
        println!("   Models dir: {}", config.models_dir.display());

        let clip = match ClipModel::new(config) {
            Ok(model) => {
                println!("   Model initialized (lazy loading)");
                model
            }
            Err(e) => {
                eprintln!("   Failed to initialize CLIP: {}", e);
                eprintln!("\n   Make sure to download the models first:");
                eprintln!("   mkdir -p ~/.local/share/memvid/models");
                eprintln!(
                    "   curl -L 'https://huggingface.co/Xenova/mobileclip_s2/resolve/main/onnx/vision_model_int8.onnx' \\"
                );
                eprintln!("        -o ~/.local/share/memvid/models/mobileclip-s2_vision.onnx");
                return Ok(());
            }
        };

        // For this demo, we'll create synthetic embeddings since PDF rendering
        // requires pdfium which may not be available
        println!("\n2. Building CLIP index with sample embeddings...");

        let mut builder = ClipIndexBuilder::new();

        // Simulate embeddings for 10 "pages" with different visual concepts
        // In real usage, you would:
        // 1. Render each PDF page to an image
        // 2. Pass the image to clip.encode_image(&image)
        // 3. Store the embedding with the page's frame_id

        let sample_concepts: Vec<(&str, Vec<f32>)> = vec![
            // These would be real embeddings from actual images in production
            (
                "charts and graphs",
                random_embedding(clip.dims() as usize, 1),
            ),
            (
                "sustainability report cover",
                random_embedding(clip.dims() as usize, 2),
            ),
            (
                "ESG metrics table",
                random_embedding(clip.dims() as usize, 3),
            ),
            (
                "environmental impact diagram",
                random_embedding(clip.dims() as usize, 4),
            ),
            (
                "carbon emissions chart",
                random_embedding(clip.dims() as usize, 5),
            ),
            (
                "renewable energy infographic",
                random_embedding(clip.dims() as usize, 6),
            ),
            (
                "corporate governance structure",
                random_embedding(clip.dims() as usize, 7),
            ),
            (
                "diversity statistics",
                random_embedding(clip.dims() as usize, 8),
            ),
            (
                "supply chain map",
                random_embedding(clip.dims() as usize, 9),
            ),
            (
                "financial highlights",
                random_embedding(clip.dims() as usize, 10),
            ),
        ];

        for (i, (concept, embedding)) in sample_concepts.iter().enumerate() {
            builder.add_document(i as u64, Some(i as u32), embedding.clone());
            println!("   Added page {} ({})", i + 1, concept);
        }

        let artifact = builder.finish()?;
        println!(
            "\n   Index built: {} vectors, {} dimensions",
            artifact.vector_count, artifact.dimension
        );

        // Decode the index for searching
        let index = ClipIndex::decode(&artifact.bytes)?;

        // Demonstrate text-to-image search
        println!("\n3. Searching with natural language queries...\n");

        // Try encoding a text query
        println!("   Encoding query: 'sustainability charts'");
        match clip.encode_text("sustainability charts") {
            Ok(query_embedding) => {
                println!("   Query embedding: {} dimensions", query_embedding.len());

                let hits = index.search(&query_embedding, 3);
                println!("\n   Top 3 matches:");
                for (rank, hit) in hits.iter().enumerate() {
                    let concept = sample_concepts
                        .get(hit.frame_id as usize)
                        .map(|(c, _)| *c)
                        .unwrap_or("unknown");
                    println!(
                        "   {}. Page {} ({}) - distance: {:.4}",
                        rank + 1,
                        hit.frame_id + 1,
                        concept,
                        hit.distance
                    );
                }
            }
            Err(e) => {
                eprintln!("   Failed to encode text (model not loaded): {}", e);
                eprintln!("   Make sure the text model ONNX file is downloaded.");
            }
        }

        // Demo with Memvid integration
        println!("\n4. Creating Memvid memory with CLIP support...");

        let dir = tempdir().expect("failed to create temp dir");
        let path = dir.path().join("clip_demo.mv2");

        let mut mem = memvid_core::Memvid::create(&path)?;

        // Enable CLIP index
        mem.enable_clip()?;
        println!("   CLIP index enabled");

        // Add some sample documents
        let options = memvid_core::PutOptions::builder()
            .title("SP Global Impact Report 2024 - Page 1")
            .uri("mv2://reports/sp-global/page-1")
            .build();
        mem.put_bytes_with_options(
            b"This page contains sustainability charts and ESG metrics.",
            options,
        )?;

        mem.commit()?;
        println!("   Added sample document");

        let stats = mem.stats()?;
        println!("\n   Memory stats:");
        println!("   - Frames: {}", stats.frame_count);
        println!("   - Has CLIP index: {}", stats.has_clip_index);

        // Search CLIP index (would use pre-computed query embedding in production)
        // Since we haven't added actual CLIP embeddings to the memory,
        // the search would return empty results - this is just to show the API

        println!("\n=== Example completed successfully! ===");
        println!("\nTo use CLIP in production:");
        println!("1. During ingestion: Generate CLIP embeddings for images/PDF pages");
        println!("2. Store embeddings in the CLIP index alongside text content");
        println!("3. At query time: Encode the text query with clip.encode_text()");
        println!("4. Search the CLIP index with mem.search_clip(&query_embedding, limit)");

        Ok(())
    }
}

/// Generate a pseudo-random embedding for demo purposes
/// In production, use clip.encode_image() on actual images
#[cfg(feature = "clip")]
fn random_embedding(dims: usize, seed: u64) -> Vec<f32> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    let mut embedding = Vec::with_capacity(dims);

    for i in 0..dims {
        (seed, i).hash(&mut hasher);
        let hash = hasher.finish();
        // Generate pseudo-random float between -1 and 1
        let val = ((hash as f32) / (u64::MAX as f32)) * 2.0 - 1.0;
        embedding.push(val);
        hasher = DefaultHasher::new();
    }

    // L2 normalize
    let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 1e-10 {
        for v in &mut embedding {
            *v /= norm;
        }
    }

    embedding
}

```

### Core Architecture Module: `examples/generate_performance_report.rs`
```
//! Generate visual performance comparison report
//!
//! Run with: cargo run --example generate_performance_report --features lex

use memvid_core::{Memvid, PutOptions, SearchRequest};
use std::time::Instant;

fn main() -> memvid_core::Result<()> {
    println!("=== Search Precision Performance Report ===\n");

    // Create test corpus
    println!("Setting up test corpus (1000 documents)...");
    let temp_file = "/tmp/perf_test.mv2";
    let _ = std::fs::remove_file(temp_file);

    let mut mem = Memvid::create(temp_file)?;

    // Add 1000 documents with controlled distribution
    for i in 0..1000 {
        let topic = match i % 5 {
            0 => ("machine learning", "neural networks"),
            1 => ("python programming", "software development"),
            2 => ("machine learning with python", "data science"),
            3 => ("rust systems programming", "memory safety"),
            _ => ("web development", "javascript frameworks"),
        };

        let content = format!(
            "Document {} about {}. This article covers {} in depth.",
            i, topic.0, topic.1
        );

        mem.put_bytes_with_options(
            content.as_bytes(),
            PutOptions::builder()
                .title(format!("Doc {} - {}", i, topic.0))
                .build(),
        )?;

        if (i + 1) % 100 == 0 {
            mem.commit()?;
        }
    }
    mem.commit()?;
    println!("✓ Corpus ready\n");

    // Test queries
    let test_queries = vec![
        ("machine python", "Both terms"),
        ("machine learning python", "Three terms"),
        ("python programming development", "Three terms"),
        ("rust memory safety", "Two terms"),
    ];

    println!("┌─────────────────────────────────────────────────────────────────────┐");
    println!("│                  QUERY PERFORMANCE METRICS                          │");
    println!("├─────────────────────────────────────────────────────────────────────┤");

    for (query, desc) in &test_queries {
        // Warm up
        for _ in 0..10 {
            let _ = mem.search(SearchRequest {
                query: query.to_string(),
                top_k: 100,
                snippet_chars: 200,
                uri: None,
                scope: None,
                cursor: None,
                #[cfg(feature = "temporal_track")]
                temporal: None,
                as_of_frame: None,
                as_of_ts: None,
                no_sketch: false,
                acl_context: None,
                acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
            })?;
        }

        // Measure
        let iterations = 100;
        let start = Instant::now();

        let mut total_results = 0;
        let mut total_relevant = 0;

        for _ in 0..iterations {
            let results = mem.search(SearchRequest {
                query: query.to_string(),
                top_k: 100,
                snippet_chars: 200,
                uri: None,
                scope: None,
                cursor: None,
                #[cfg(feature = "temporal_track")]
                temporal: None,
                as_of_frame: None,
                as_of_ts: None,
                no_sketch: false,
                acl_context: None,
                acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
            })?;

            let terms: Vec<&str> = query.split_whitespace().collect();
            let relevant = results
                .hits
                .iter()
                .filter(|hit| {
                    let text = hit.text.to_lowercase();
                    terms.iter().all(|term| text.contains(term))
                })
                .count();

            total_results += results.hits.len();
            total_relevant += relevant;
        }

        let elapsed = start.elapsed();
        let avg_latency_us = elapsed.as_micros() / iterations as u128; // FIX: Cast to u128
        let avg_results = total_results / iterations;
        let avg_relevant = total_relevant / iterations;
        let precision = if avg_results > 0 {
            (avg_relevant as f64 / avg_results as f64) * 100.0
        } else {
            0.0
        };

        println!("│");
        println!("│ Query: \"{}\" ({})", query, desc);
        println!("│   Latency:     {:.2}ms", avg_latency_us as f64 / 1000.0);
        println!("│   Results:     {} docs", avg_results);
        println!("│   Relevant:    {} docs", avg_relevant);
        println!("│   Precision:   {:.1}%", precision);
        println!("│   Memory:      ~{} KB", (avg_results * 3).max(1));
    }

    println!("└─────────────────────────────────────────────────────────────────────┘");

    // Comparison with hypothetical OR behavior
    println!("\n┌─────────────────────────────────────────────────────────────────────┐");
    println!("│              COMPARISON: AND vs OR (Estimated)                      │");
    println!("├─────────────────────────────────────────────────────────────────────┤");
    println!("│");
    println!("│ Query: \"machine python\"");
    println!("│");
    println!("│   WITH AND (Current):        │   WITH OR (Previous):");
    println!("│   • Results: ~5-8 docs       │   • Results: ~80-120 docs");
    println!("│   • Precision: 100%          │   • Precision: ~6-8%");
    println!("│   • Memory: ~20 KB           │   • Memory: ~300 KB");
    println!("│   • Processing: 6-10ms       │   • Processing: 96-144ms");
    println!("│");
    println!("│   IMPROVEMENT:                                                       ");
    println!("│   ✓ 15x better precision (6% → 100%)                                 ");
    println!("│   ✓ 93% less memory (300KB → 20KB)                                   ");
    println!("│   ✓ 93% faster processing (120ms → 8ms)                              ");
    println!("│   ✓ No query latency regression (~1.2ms)                             ");
    println!("│");
    println!("└─────────────────────────────────────────────────────────────────────┘");

    std::fs::remove_file(temp_file)?;

    Ok(())
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #222** (2026-05-27): **TypeError: 'dict' object cannot be converted to 'PyString' when calling mem.put()**
  *Symptoms*: Hello, I am testing the code provided in the official documentation, but every time I execute it, I get the following error: gao.pdf: 'dict' object cannot be converted to 'PyString'. The documentation URL is: https://docs.memvid.com/examples/knowledge-base.
  **Post-Mortem & Fix Analysis**:
  > Fixed in the Python SDK. `put()` again accepts the documented single payload-dict form — `mem.put({"title": ..., "text": ..., "metadata": {...}})` — alongside the keyword form. The wrapper now detects a `Mapping` as the first positional argument and unpacks it, so the docs.memvid.com/examples/knowledge-base example works again. Shipping in the next `memvid-sdk` release.

- **Issue #215** (2026-05-27): **[BUG] Tantivy working directories leaked to %TEMP% on every `put()` call, never cleaned up**
  *Symptoms*: ## Bug: Tantivy working directories leaked to %TEMP% on every `put()` call, never cleaned up  **SDK version:** `memvid-sdk` (latest as of 2026-03-19) **Platform:** Windows 11, Python 3.10+ **Reproducible:** Yes — deterministic, every `put()` call  ---  ### Description  Every call to `mem.put()` creates a new temporary directory under `%TEMP%` (or whatever `TEMP`/`TMP` points to). These directories are never deleted — not on `seal()`, not on process exit, not on GC. They accumulate indefinitely.  In a conversational agent workload with moderate write frequency (~5–10 `put()` calls per conversation turn), **515 orphan directories accumulated in 4 days** on a single machine.  ---  ### Reproducer  ```python import os, tempfile, memvid_sdk as mv  tmp_before = set(os.listdir(tempfile.gettempdir()))  mem = mv.create("test.mv2") for i in range(5):     mem.put(f"Title {i}", "label", {}, text=f"Content {i}") mem.seal() os.remove("test.mv2")  tmp_after = set(os.listdir(tempfile.gettempdir())) new_dirs = tmp_after - tmp_before print(f"{len(new_dirs)} new temp dirs after 5 put() calls:") for d in sorted(new_dirs):     print(f"  {d}") ```  **Expected:** 0 new temp directories after `seal()`. **Actual:** 5 new `.tmp*` directories remain, one per `put()` call.  ---  ### Orphan directory contents  Each leaked directory contains:  ``` .tmpXXXXXXXX/     .managed.json          # always: ["meta.json"]     .tantivy-meta.lock     .tantivy-writer.lock     meta.json              # Tantivy schema, "se
  **Post-Mortem & Fix Analysis**:
  > **Follow-up: corrected orphan taxonomy and updated workaround fingerprint**  After running a diagnostic pass against the accumulated directories, the original workaround criteria in this report are partially incorrect. Posting a correction so any fix implemented here covers the full set.  ---  ### Two orphan types exist, not one  I originally described orphans as always having `"segments": []` and no segment data files. That is only true for one of two types:  **Type A — empty index** (original description, correct): ``` .tmpXXXXXX/     .managed.json       →  ["meta.json"]     .tantivy-meta.lock     .tantivy-writer.lock     meta.json           →  segments=0, opstamp=0 ``` Size ~1.8 KB. Tantivy initialised the dir, wrote nothing, abandoned it.  **Type B — written index** (not described in original report): ``` .tmpXXXXXX/     .managed.json       →  ["uuid.fast", "uuid.idx", ..., "meta.json", ...]     .tantivy-meta.lock     .tantivy-writer.lock     <uuid>.fast     <uuid>.fieldnorm     <u
  > Fixed in **memvid-core 2.0.140**.  `TantivyEngine` declared its `TempDir` as the first field, so on drop the directory was removed *before* the index/reader/writer released their open handles and lock files — which silently fails on Windows, leaking one working dir per discarded engine (a fresh engine is built on every commit's index rebuild ≈ every `put()`). The `TempDir` now drops last and the index writer is released first, so per-`put` working directories are cleaned up. Thanks for the thorough fingerprint and repro.  Release: https://github.com/memvid/memvid/releases/tag/v2.0.140

- **Issue #214** (2026-05-27): **[BUG]**
  *Symptoms*: ## Bug Description A clear and concise description of the bug.  ## Steps to Reproduce 1. 2. 3.  ## Expected Behavior What you expected to happen.  ## Actual Behavior What actually happened.  ## Environment - **OS**: [e.g., macOS 14.0, Ubuntu 22.04, Windows 11] - **Rust Version**: [e.g., 1.85.0] - **Memvid Version**: [e.g., 2.0.0] - **Features Enabled**: [e.g., lex, vec, clip]  ## Minimal Reproducible Example ```rust // Code to reproduce the issue ```  ## Error Output ``` // Paste any error messages or stack traces here ```  ## Additional Context Any other context about the problem (screenshots, logs, etc.)  ## Checklist - [ ] I have searched existing issues for duplicates - [ ] I have tested with the latest version - [ ] I can reproduce this consistently 
  **Post-Mortem & Fix Analysis**:
  > Closing as not actionable — the report is the unfilled bug template with no description, steps, environment, or reproducible example. If you're hitting a real issue, please open a new issue (or comment here to reopen) with a minimal reproducible example, the memvid version, and the error output. Thanks!

- **Issue #210** (2026-05-27): **[BUG]**
  *Symptoms*: ## Bug Description A clear and concise description of the bug.  ## Steps to Reproduce 1. 2. 3.  ## Expected Behavior What you expected to happen.  ## Actual Behavior What actually happened.  ## Environment - **OS**: [e.g., macOS 14.0, Ubuntu 22.04, Windows 11] - **Rust Version**: [e.g., 1.85.0] - **Memvid Version**: [e.g., 2.0.0] - **Features Enabled**: [e.g., lex, vec, clip]  ## Minimal Reproducible Example ```rust // Code to reproduce the issue ```  ## Error Output ``` // Paste any error messages or stack traces here ```  ## Additional Context Any other context about the problem (screenshots, logs, etc.)  ## Checklist - [ ] I have searched existing issues for duplicates - [ ] I have tested with the latest version - [ ] I can reproduce this consistently 
  **Post-Mortem & Fix Analysis**:
  > @mateenahmad5211-maker can you describe the issue you are getting? Thank you 
  > Closing as not actionable — the report is the unfilled bug template with no description, steps, environment, or reproducible example. If you're hitting a real issue, please open a new issue (or comment here to reopen) with a minimal reproducible example, the memvid version, and the error output. Thanks!

- **Issue #204** (2026-03-14): **[BUG]**
  *Symptoms*: ## Bug: `Memvid.commit()` raises `AttributeError` on `_MemvidCore` — method defined but not implemented  **Package:** `memvid-sdk`   **Tested version:** latest (March 2026)   **Python:** 3.12   **OS:** Windows 11    ---  ### Summary  `Memvid.commit()` is a public method on the `Memvid` wrapper class and appears in `dir()` output, giving the reasonable expectation that it flushes pending writes to disk. Calling it raises:  ``` AttributeError: 'memvid_sdk._MemvidCore' object has no attribute 'commit' ```  The wrapper method exists; the internal delegation target does not. The failure is silent at the wrapper level until the internal call is reached, making it hard to diagnose — especially since `put()` itself succeeds and returns a valid `frame_id`, giving the appearance that the write completed.  ---  ### Minimal Reproduction  ```python import memvid_sdk  mv = memvid_sdk.create("test.mv2", enable_lex=True, enable_vec=False) fid = mv.put(text="hello world", title="test", auto_tag=False, extract_dates=False) print(f"put() OK, frame_id: {fid}")  # succeeds, returns int  mv.commit()  # AttributeError: '_MemvidCore' object has no attribute 'commit' ```  ---  ### Observed Behaviour (full probe output)  Exhaustive method probe on a live `Memvid` instance confirms `commit` is present on the wrapper but fails on delegation:  ``` Type: <class 'memvid_sdk.Memvid'> MRO: ['Memvid', 'object']  put() OK -> frame_id: 0 commit() -> FAILED: 'memvid_sdk._MemvidCore' object has no attribute 'comm
  **Post-Mortem & Fix Analysis**:
  > @Zombie-Dude this is fixed on release 2.0.159. Thank you

- **Issue #201** (2026-03-04): **[BUG] Lexical index not enabled in wrapper despite identical enable/commit sequence (works in raw test)**
  *Symptoms*: ## Bug Description  When using a wrapper that holds a `Memvid` inside a `tokio::sync::Mutex` and enables the lexical index while holding the lock, searches fail with zero hits or the error `"Lexical index is not enabled"`. A minimal raw test that performs the same steps passes.  ## Steps to Reproduce  1. Clone the minimal repro repository:    ```bash    git clone https://github.com/elcoosp/memvid-wrapper-bug-repro    cd memvid-wrapper-bug-repro    ```  2. Run the tests:    ```bash    cargo test -- --nocapture    ```  3. Observe that:    - `test_raw_with_mutex_passes` passes    - `test_wrapper_fails` fails with the described errors  ## Expected Behavior  Both tests should pass – the wrapper should behave identically to the raw test.  ## Actual Behavior  - `test_raw_with_mutex_passes` ✅ passes - `test_wrapper_fails` ❌ fails with:   - Plain‑text search returns zero hits, or   - Tag search panics with `Internal("Search failed: Lexical index is not enabled")`  ## Environment  - **OS**: macOS Tahoe 26.2 - **Rust Version**: v1.93.0-nightly - **Memvid Version**: 2.0 - **Features Enabled**: lex  ## Minimal Reproducible Example  [https://github.com/elcoosp/memvid-wrapper-bug-repro](https://github.com/elcoosp/memvid-wrapper-bug-repro)  ## Error Output  ``` thread 'test_wrapper_fails' panicked at src/main.rs:XXX:62: called `Result::unwrap()` on an `Err` value: Internal("Search failed: Lexical index is not enabled") ```  Or for plain‑text search: ``` thread 'test_wrapper_fails' panicked a
  **Post-Mortem & Fix Analysis**:
  > @elcoosp this is fixed on 2.0.158 release
  > I tested on `2.0.138` and got the same failing test, also tried to do only one `enable_lex` call at creation and same result.

- **Issue #192** (2026-02-03): **[Python SDK] ImportError: cannot allocate memory in static TLS block on Linux/Docker**
  *Symptoms*: ## Description  The Python SDK (`memvid-sdk`) fails to load on Linux (both ARM64 and AMD64) when running inside Docker containers, with the following error:  ``` ImportError: /usr/local/lib/python3.x/site-packages/memvid_sdk/_lib.abi3.so: cannot allocate memory in static TLS block ```  The same SDK works perfectly on macOS (both Intel and Apple Silicon).  ## Root Cause Analysis  After extensive debugging, I found that `_lib.abi3.so` is compiled with the `STATIC_TLS` flag:  ```bash $ readelf -d /usr/local/lib/python3.9/site-packages/memvid_sdk/_lib.abi3.so | grep FLAGS  0x000000000000001e (FLAGS)              BIND_NOW STATIC_TLS ```  This indicates the library was built with `-ftls-model=initial-exec`, which requires static TLS allocation at load time. Linux glibc has limited static TLS space, and when Python + other libraries consume most of it, `memvid_sdk` cannot be loaded.  ## Environment  - **OS**: Linux (Debian/Ubuntu-based Docker images) - **Architectures tested**: ARM64 (aarch64), AMD64 (x86_64) - **Python versions tested**: 3.9, 3.11, 3.12 - **memvid-sdk version**: 2.0.x (latest) - **Works on**: macOS (dyld handles TLS differently)  ## Attempted Workarounds (all failed)  | Approach | Result | |----------|--------| | `GLIBC_TUNABLES=glibc.rtld.optional_static_tls=...` | No effect | | `LD_PRELOAD` the .so first | Symbol lookup errors (C++ deps) | | Lazy import (load on first request) | Error deferred to first request | | Subprocess isolation | Subprocess also fails | | 
  **Post-Mortem & Fix Analysis**:
  > Thanks, we will fix it ASAP.
  > Thanks for reporting this. We tested on the environment you mentioned and didn’t see the issue on our side. For now, we’re closing this issue, but we’ll improve the SDK TLS handling to avoid this in the future.

- **Issue #174** (2026-01-24): **[BUG] cargo fmt --check fails in CI due to formatting differences**
  *Symptoms*: ## Description  The CI **Lint** job is failing on `cargo fmt --all -- --check` due to formatting differences in several files. The failures are purely stylistic and appear to be caused by code not being formatted with `cargo fmt`.  This blocks CI even though tests pass on all platforms.  ### CI Error  ``` Run cargo fmt --all -- --check Error: Process completed with exit code 1. ```  ### Affected Files  * `src/lex.rs` * `src/replay/types.rs`  ### Summary of Formatting Issues  The diffs are all `rustfmt`-related changes, including:  * Single-line vs multi-line `assert!` / `assert_eq!` * Multi-line `format!` and `eprintln!` calls * Trailing whitespace removal * Doc comment cleanup (`///` spacing) * Blank line normalization  Example:  ```diff - assert!( -     matches[0].score > 0.0, -     "Match should have a positive score" - ); + assert!(matches[0].score > 0.0, "Match should have a positive score"); ```  ```diff - ///  + /// ```  ### Expected Behavior  CI should pass after code is formatted according to `rustfmt`.  ### How to Fix  Run the following locally and commit the result:  ```bash cargo fmt --all ```  Then push the formatted changes.  ### Notes  * No logic changes are involved * This is purely a formatting issue enforced by CI * Consider adding a pre-commit hook or editor auto-format to prevent future occurrences
  **Post-Mortem & Fix Analysis**:
  > ##   Proposal: Fix All Clippy Errors Hi @sharafdin  I noticed that running `cargo clippy` currently reports ~1,825 errors/warnings. I'd like to volunteer to fix these systematically. ### Current Clippy Status The main categories of issues are: - `non_std_lazy_statics` (~1700+) - `once_cell::Lazy` → `std::sync::LazyLock` - `missing_errors_doc` / `missing_panics_doc` - Documentation gaps - `cast_*` issues - Type casting safety concerns - `unwrap_used` - Using `.unwrap()` instead of proper error handling - Various style issues (`needless_continue`, `redundant_field_names`, etc.) ### Proposed Approach I can tackle this in **multiple smaller PRs** grouped by category: 1. **PR 1**: Easy fixes (`needless_continue`, `redundant_field_names`, `duplicated_attributes`) 2. **PR 2**: `once_cell::Lazy` → `std::sync::LazyLock` migration 3. **PR 3**: Documentation fixes (`missing_errors_doc`, `missing_panics_doc`, `doc_markdown`) 4. **PR 4**: Cast safety improvements 5. **PR 5**: Remaining miscellaneou
  > > ## Proposal: Fix All Clippy Errors > Hi [@sharafdin](https://github.com/sharafdin) I noticed that running `cargo clippy` currently reports ~1,825 errors/warnings. I'd like to volunteer to fix these systematically. >  > ### Current Clippy Status > The main categories of issues are: >  > * `non_std_lazy_statics` (~1700+) - `once_cell::Lazy` → `std::sync::LazyLock` > * `missing_errors_doc` / `missing_panics_doc` - Documentation gaps > * `cast_*` issues - Type casting safety concerns > * `unwrap_used` - Using `.unwrap()` instead of proper error handling > * Various style issues (`needless_continue`, `redundant_field_names`, etc.) >  > ### Proposed Approach > I can tackle this in **multiple smaller PRs** grouped by category: >  > 1. **PR 1**: Easy fixes (`needless_continue`, `redundant_field_names`, `duplicated_attributes`) > 2. **PR 2**: `once_cell::Lazy` → `std::sync::LazyLock` migration > 3. **PR 3**: Documentation fixes (`missing_errors_doc`, `missing_panics_doc`, `doc_markdown`) > 4.
  > hey @sharafdin  could you please review this ? done as per instructions 

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

### Incident Patch 1: `e18fe554` (2026-05-27)
**Commit Message**: v2.0.140: fix WAL corruption after region growth (#230) and Tantivy temp-dir leak (#215)

- #230: refresh cached_payload_end after WAL growth so rebuild_indexes no
  longer seeks into the grown WAL region and overwrites record payloads
  (was surfacing as "wal record checksum mismatch").
- #215: make TantivyEngine drop its TempDir last and release the index
  writer first, so per-put working directories are cleaned up instead of
  leaking into the system temp dir (notably on Windows).
- add commit_per_put_survives_wal_growth regression test.

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "memvid-core"
-version = "2.0.139"
+version = "2.0.140"
 edition = "2024"
 rust-version = "1.85.0"
 license = "Apache-2.0"
```

**File**: `src/memvid/mutation.rs` (modified, +20/-6)
```diff
@@ -607,9 +607,7 @@ impl Memvid {
 
         self.shift_data_for_wal_growth(delta)?;
         self.header.wal_size = new_size;
-        self.header.footer_offset = self.header.footer_offset.saturating_add(delta);
-        self.data_end = self.data_end.saturating_add(delta);
-        self.adjust_offsets_after_wal_growth(delta);
+        self.apply_wal_growth_offsets(delta);
 
         let catalog_end = self.catalog_data_end();
         self.header.footer_offset = catalog_end
@@ -659,6 +657,24 @@ impl Memvid {
         Ok(())
     }
 
+    fn apply_wal_growth_offsets(&mut self, delta: u64) {
+        if delta == 0 {
+            return;
+        }
+
+        self.header.footer_offset = self.header.footer_offset.saturating_add(delta);
+        self.data_end = self.data_end.saturating_add(delta);
+        // `cached_payload_end` mirrors `data_end` / footer positioning. After
+        // `shift_data_for_wal_growth` every byte past the old WAL boundary
+        // moved right by `delta`, so the cached payload boundary must also
+        // advance. Forgetting this caused `rebuild_indexes` (which seeks to
+        // `payload_region_end()`) to write embedded indexes back into the
+        // grown portion of the WAL region, corrupting WAL record payloads.
+        // See https://github.com/memvid/memvid/issues/230.
+        self.cached_payload_end = self.cached_payload_end.saturating_add(delta);
+        self.adjust_offsets_after_wal_growth(delta);
+    }
+
     fn adjust_offsets_after_wal_growth(&mut self, delta: u64) {
         if delta == 0 {
             return;
@@ -801,9 +817,7 @@ impl Memvid {
 
         self.shift_data_for_wal_growth(delta)?;
         self.header.wal_size = target;
-        self.header.footer_offset = self.header.footer_offset.saturating_add(delta);
-        self.data_end = self.data_end.saturating_add(delta);
-        self.adjust_offsets_after_wal_growth(delta);
+        self.apply_wal_growth_offsets(delta);
 
         let catalog_end = self.catalog_data_end();
         self.header.footer_offset = catalog_end
```

**File**: `src/search/tantivy/engine.rs` (modified, +23/-1)
```diff
@@ -12,8 +12,16 @@ use tantivy::{Index, IndexReader, Term, doc};
 use tempfile::TempDir;
 
 /// Tantivy-backed search index used when the `lex` feature is enabled.
+///
+/// Field order is load-bearing for `Drop`: Rust drops struct fields in
+/// declaration order, so `work_dir` (the temporary directory backing the
+/// index) **must remain the last field**. The `index`, `reader`, and
+/// `index_writer` all keep file handles and lock files open inside that
+/// directory; if the `TempDir` were dropped first, its directory removal
+/// would fail on platforms that refuse to delete files with open handles
+/// (notably Windows), silently leaking one working directory per discarded
+/// engine. See https://github.com/memvid/memvid/issues/215.
 pub struct TantivyEngine {
-    pub(super) work_dir: TempDir,
     pub(super) index: Index,
     pub(super) _schema: Schema,
     pub(super) content: Field,
@@ -26,6 +34,20 @@ pub struct TantivyEngine {
     pub(super) index_writer: Option<IndexWriter>,
     pub(super) reader: IndexReader,
     pub(super) tokenizer: Option<String>,
+    // MUST be the last field — see the type-level comment above.
+    pub(super) work_dir: TempDir,
+}
+
+impl Drop for TantivyEngine {
+    fn drop(&mut self) {
+        // Release the exclusive writer (and its `.tantivy-writer.lock`) before
+        // the `work_dir` TempDir is removed during normal field drop. Without
+        // this the writer lock can still be held when the directory removal
+        // runs, leaking the working directory on Windows. See issue #215.
+        if let Some(writer) = self.index_writer.take() {
+            drop(writer);
+        }
+    }
 }
 
 /// Search hit returned from Tantivy queries.
```

**File**: `tests/mutation.rs` (modified, +83/-1)
```diff
@@ -3,11 +3,23 @@
 
 use memvid_core::{
     EmbeddingIdentitySummary, MEMVID_EMBEDDING_MODEL_KEY, MEMVID_EMBEDDING_PROVIDER_KEY, Memvid,
-    MemvidError, PutOptions, TimelineQuery,
+    MemvidError, PutOptions, TimelineQuery, constants::HEADER_SIZE, io::header::HeaderCodec,
 };
+use std::fs::File;
+use std::io::Read;
 use std::num::NonZeroU64;
+use std::path::Path;
 use tempfile::TempDir;
 
+fn read_wal_size(path: &Path) -> u64 {
+    let mut header_bytes = [0u8; HEADER_SIZE];
+    File::open(path)
+        .unwrap()
+        .read_exact(&mut header_bytes)
+        .unwrap();
+    HeaderCodec::decode(&header_bytes).unwrap().wal_size
+}
+
 /// Test basic put operation with bytes.
 #[test]
 fn put_bytes_basic() {
@@ -434,3 +446,73 @@ fn timeline_iteration() {
 
     assert_eq!(entries.len(), 3, "Should have 3 timeline entries");
 }
+
+/// Regression test for memvid/memvid#230 — sustained commit-per-put workloads
+/// that span multiple WAL growth cycles must keep the embedded WAL intact.
+///
+/// Before the fix, `grow_wal_region` / `ensure_wal_capacity` updated
+/// `header.footer_offset` and `self.data_end` after shifting the data region
+/// but left the cached `payload_region_end()` value stale. The next call to
+/// `rebuild_indexes` then sought to that pre-growth offset (which now lies
+/// inside the grown WAL region) and overwrote WAL record payloads, producing
+/// `Embedded WAL is corrupted at offset N: wal record checksum mismatch` on
+/// the following commit.
+#[test]
+fn commit_per_put_survives_wal_growth() {
+    let dir = TempDir::new().unwrap();
+    let path = dir.path().join("wal_growth.mv2");
+
+    let mut mem = Memvid::create(&path).unwrap();
+    let initial_wal_size = read_wal_size(&path);
+    let mut max_wal_size = initial_wal_size;
+
+    // Use text-indexable payloads of varying length so each commit drives the
+    // full Tantivy rebuild path (`rebuild_indexes` → `flush_tantivy`) that
+    // seeks to `payload_region_end()`. The mix of sizes ensures multiple
+    // WAL growth cycles occur across the run.
+    let words: &[&str] = &[
+        "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india",
+        "juliet", "kilo", "lima", "mike", "november", "oscar", "papa", "quebec", "romeo", "sierra",
+        "tango", "uniform", "victor", "whiskey", "x-ray", "yankee", "zulu",
+    ];
+
+    for i in 0..60u32 {
+        // Build a ~1-3 KiB text body so commits exercise variable-size WAL
+        // entries similar to the upstream repro.
+        let body_len = 256usize + ((i as usize * 137) % 1024);
+        let mut body = String::with_capacity(body_len * 8);
+        let mut idx = i as usize;
+        while body.len() < body_len {
+            body.push_str(words[idx % words.len()]);
+            body.push(' ');
+            idx = idx.wrapping_add(1);
+        }
+        let opts = PutOptions {
+            uri: Some(format!("mv2://wal-growth/doc-{i}")),
+            title: Some(format!("doc-{i}")),
+            search_text: Some(body.clone()),
+            ..Default::default()
+        };
+        mem.put_bytes_with_options(body.as_bytes(), opts)
+            .unwrap_or_else(|e| panic!("put #{i} failed: {e}"));
+        mem.commit()
+            .unwrap_or_else(|e| panic!("commit #{i} failed: {e}"));
+        max_wal_size = max_wal_size.max(read_wal_size(&path));
+    }
+
+    assert!(
+        max_wal_size > initial_wal_size,
+        "test must exercise WAL growth (initial={initial_wal_size}, max={max_wal_size})"
+    );
+
+    drop(mem);
+
+    // Reopening forces a full WAL scan; checksum verification will fire here
+    // if any record payload was clobbered by a stale-offset index write.
+    let reopened = Memvid::open_read_only(&path).unwrap();
+    assert_eq!(
+        reopened.stats().unwrap().frame_count,
+        60,
+        "all puts should be durable after WAL growth"
+    );
+}
```

---

### Incident Patch 2: `92b0ec8a` (2026-03-14)
**Commit Message**: fix: clippy pedantic — use let-else, allow trivially_copy_pass_by_ref

**File**: `src/memvid/search/fallback.rs` (modified, +15/-21)
```diff
@@ -46,19 +46,16 @@ pub(super) fn search_with_lex_fallback(
                 continue;
             }
         }
-        let frame_meta = match usize::try_from(matched.frame_id)
+        let Some(frame_meta) = usize::try_from(matched.frame_id)
             .ok()
             .and_then(|idx| memvid.toc.frames.get(idx))
-        {
-            Some(f) => f,
-            None => {
-                tracing::warn!(
-                    frame_id = matched.frame_id,
-                    "skipping search hit with stale frame_id"
-                );
-                stale_skips = stale_skips.saturating_add(1);
-                continue;
-            }
+        else {
+            tracing::warn!(
+                frame_id = matched.frame_id,
+                "skipping search hit with stale frame_id"
+            );
+            stale_skips = stale_skips.saturating_add(1);
+            continue;
         };
         let content_lower = matched.content.to_ascii_lowercase();
         let ctx = EvaluationContext {
@@ -95,20 +92,17 @@ pub(super) fn search_with_lex_fallback(
     let mut hits = Vec::new();
     let mut produced = 0usize;
     for (matched, slices) in evaluated {
-        let frame_meta = match memvid
+        let Some(frame_meta) = memvid
             .toc
             .frames
             .get(usize::try_from(matched.frame_id).unwrap_or(usize::MAX))
             .cloned()
-        {
-            Some(f) => f,
-            None => {
-                tracing::warn!(
-                    frame_id = matched.frame_id,
-                    "skipping stale frame_id in snippet assembly"
-                );
-                continue;
-            }
+        else {
+            tracing::warn!(
+                frame_id = matched.frame_id,
+                "skipping stale frame_id in snippet assembly"
+            );
+            continue;
         };
         let canonical = memvid.frame_content(&frame_meta)?;
         let canonical_limit = frame_meta.canonical_length.map_or_else(
```

**File**: `src/memvid/search/tantivy.rs` (modified, +15/-21)
```diff
@@ -121,21 +121,18 @@ pub(super) fn try_tantivy_search(
     let mut evaluated = Vec::new();
     let mut stale_skips = 0u32;
     for hit in search_hits {
-        let frame_meta = match memvid
+        let Some(frame_meta) = memvid
             .toc
             .frames
             .get(usize::try_from(hit.frame_id).unwrap_or(usize::MAX))
             .cloned()
-        {
-            Some(f) => f,
-            None => {
-                tracing::warn!(
-                    frame_id = hit.frame_id,
-                    "skipping search hit with stale frame_id"
-                );
-                stale_skips = stale_skips.saturating_add(1);
-                continue;
-            }
+        else {
+            tracing::warn!(
+                frame_id = hit.frame_id,
+                "skipping search hit with stale frame_id"
+            );
+            stale_skips = stale_skips.saturating_add(1);
+            continue;
         };
         if let Some(uri_expected) = uri_filter {
             if !uri_matches(frame_meta.uri.as_deref(), uri_expected) {
@@ -283,20 +280,17 @@ pub(super) fn try_tantivy_search(
         if hits.len() == effective_top_k && produced >= offset {
             break;
         }
-        let frame_meta = match memvid
+        let Some(frame_meta) = memvid
             .toc
             .frames
             .get(usize::try_from(hit.frame_id).unwrap_or(usize::MAX))
             .cloned()
-        {
-            Some(f) => f,
-            None => {
-                tracing::warn!(
-                    frame_id = hit.frame_id,
-                    "skipping stale frame_id in snippet assembly"
-                );
-                continue;
-            }
+        else {
+            tracing::warn!(
+                frame_id = hit.frame_id,
+                "skipping stale frame_id in snippet assembly"
+            );
+            continue;
         };
         let uri = frame_meta
             .uri
```

**File**: `src/memvid/timeline.rs` (modified, +8/-10)
```diff
@@ -95,19 +95,17 @@ pub(crate) fn build_timeline(
     #[cfg(feature = "temporal_track")]
     let temporal_track_snapshot = memvid.temporal_track_ref()?.cloned();
     for entry in entries.into_iter().take(limit) {
-        let frame = match memvid
+        let Some(frame) = memvid
             .toc
             .frames
             .get(usize::try_from(entry.frame_id).unwrap_or(usize::MAX))
-        {
-            Some(f) => f.clone(),
-            None => {
-                tracing::warn!(
-                    frame_id = entry.frame_id,
-                    "skipping time index entry with out-of-range frame id"
-                );
-                continue;
-            }
+            .cloned()
+        else {
+            tracing::warn!(
+                frame_id = entry.frame_id,
+                "skipping time index entry with out-of-range frame id"
+            );
+            continue;
         };
         if frame.status != FrameStatus::Active {
             continue;
```

**File**: `src/types/search.rs` (modified, +2/-1)
```diff
@@ -195,6 +195,7 @@ pub struct SearchResponse {
     pub stale_index_skips: u32,
 }
 
-fn is_zero(v: &u32) -> bool {
+#[allow(clippy::trivially_copy_pass_by_ref)]
+const fn is_zero(v: &u32) -> bool {
     *v == 0
 }
```

---

### Incident Patch 3: `11a18fdd` (2026-03-14)
**Commit Message**: fmt: fix formatting

**File**: `src/memvid/search/api.rs` (modified, +1/-3)
```diff
@@ -22,9 +22,7 @@ impl Memvid {
             #[cfg(feature = "lex")]
             {
                 // If index exists on disk but not in memory, load it
-                if self.lex_index.is_none()
-                    && crate::memvid::lifecycle::has_lex_index(&self.toc)
-                {
+                if self.lex_index.is_none() && crate::memvid::lifecycle::has_lex_index(&self.toc) {
                     self.load_lex_index_from_manifest()?;
                 }
                 // Ensure Tantivy engine is running even if lex was already enabled
```

**File**: `src/memvid/search/fallback.rs` (modified, +8/-2)
```diff
@@ -52,7 +52,10 @@ pub(super) fn search_with_lex_fallback(
         {
             Some(f) => f,
             None => {
-                tracing::warn!(frame_id = matched.frame_id, "skipping search hit with stale frame_id");
+                tracing::warn!(
+                    frame_id = matched.frame_id,
+                    "skipping search hit with stale frame_id"
+                );
                 stale_skips = stale_skips.saturating_add(1);
                 continue;
             }
@@ -100,7 +103,10 @@ pub(super) fn search_with_lex_fallback(
         {
             Some(f) => f,
             None => {
-                tracing::warn!(frame_id = matched.frame_id, "skipping stale frame_id in snippet assembly");
+                tracing::warn!(
+                    frame_id = matched.frame_id,
+                    "skipping stale frame_id in snippet assembly"
+                );
                 continue;
             }
         };
```

**File**: `src/memvid/search/helpers.rs` (modified, +4/-1)
```diff
@@ -351,7 +351,10 @@ pub(crate) fn attach_temporal_metadata(memvid: &mut Memvid, hits: &mut [SearchHi
                                 canonical_cache.insert(frame_id, content);
                             }
                             None => {
-                                tracing::warn!(frame_id, "skipping temporal text for stale frame_id");
+                                tracing::warn!(
+                                    frame_id,
+                                    "skipping temporal text for stale frame_id"
+                                );
                             }
                         }
                     }
```

**File**: `src/memvid/search/tantivy.rs` (modified, +9/-3)
```diff
@@ -6,6 +6,7 @@ use super::helpers::attach_temporal_metadata;
 use super::helpers::{
     build_context, collect_token_occurrences, parse_cursor, timestamp_to_rfc3339,
 };
+use crate::Result;
 use crate::lex::compute_snippet_slices;
 use crate::memvid::frame::ChunkInfo;
 use crate::memvid::lifecycle::Memvid;
@@ -14,7 +15,6 @@ use crate::types::{
     FrameId, SearchEngineKind, SearchHit, SearchHitMetadata, SearchParams, SearchRequest,
     SearchResponse,
 };
-use crate::Result;
 use log::warn;
 use std::collections::HashSet;
 use std::time::Instant;
@@ -129,7 +129,10 @@ pub(super) fn try_tantivy_search(
         {
             Some(f) => f,
             None => {
-                tracing::warn!(frame_id = hit.frame_id, "skipping search hit with stale frame_id");
+                tracing::warn!(
+                    frame_id = hit.frame_id,
+                    "skipping search hit with stale frame_id"
+                );
                 stale_skips = stale_skips.saturating_add(1);
                 continue;
             }
@@ -288,7 +291,10 @@ pub(super) fn try_tantivy_search(
         {
             Some(f) => f,
             None => {
-                tracing::warn!(frame_id = hit.frame_id, "skipping stale frame_id in snippet assembly");
+                tracing::warn!(
+                    frame_id = hit.frame_id,
+                    "skipping stale frame_id in snippet assembly"
+                );
                 continue;
             }
         };
```

**File**: `src/memvid/timeline.rs` (modified, +5/-2)
```diff
@@ -1,5 +1,6 @@
 //! Timeline assembly helpers for `Memvid`.
 
+use crate::Result;
 use crate::io::time_index::{TimeIndexEntry, read_track as time_index_read};
 use crate::memvid::lifecycle::Memvid;
 #[cfg(feature = "temporal_track")]
@@ -10,7 +11,6 @@ use crate::types::{
     SearchHitTemporal, SearchHitTemporalAnchor, SearchHitTemporalMention, TemporalFilter,
     TemporalTrack,
 };
-use crate::Result;
 #[cfg(feature = "temporal_track")]
 use std::collections::HashSet;
 use std::num::NonZeroU64;
@@ -102,7 +102,10 @@ pub(crate) fn build_timeline(
         {
             Some(f) => f.clone(),
             None => {
-                tracing::warn!(frame_id = entry.frame_id, "skipping time index entry with out-of-range frame id");
+                tracing::warn!(
+                    frame_id = entry.frame_id,
+                    "skipping time index entry with out-of-range frame id"
+                );
                 continue;
             }
         };
```

**File**: `src/tests_lex_flag.rs` (modified, +2/-6)
```diff
@@ -120,9 +120,7 @@ mod tests {
                 let mut mem = wrapper.lock().unwrap();
                 let opts = PutOptions::builder()
                     .uri("mv2://test/login".to_string())
-                    .search_text(
-                        "user clicked login button on the authentication page".to_string(),
-                    )
+                    .search_text("user clicked login button on the authentication page".to_string())
                     .build();
                 mem.put_bytes_with_options(b"login event data", opts)
                     .unwrap();
@@ -185,9 +183,7 @@ mod tests {
 
             let opts = PutOptions::builder()
                 .uri("mv2://test/login".to_string())
-                .search_text(
-                    "user clicked login button on the authentication page".to_string(),
-                )
+                .search_text("user clicked login button on the authentication page".to_string())
                 .build();
             mem.put_bytes_with_options(b"login event data", opts)
                 .unwrap();
```

---

### Incident Patch 4: `a79dfddc` (2026-03-13)
**Commit Message**: v2.0.139: Fix MV005 — graceful handling of stale frame_ids in all search paths

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "memvid-core"
-version = "2.0.137"
+version = "2.0.139"
 edition = "2024"
 rust-version = "1.85.0"
 license = "Apache-2.0"
```

**File**: `src/memvid/ask.rs` (modified, +2/-0)
```diff
@@ -576,6 +576,7 @@ impl Memvid {
                     snippet_chars: request.snippet_chars,
                     cursor: search_request.cursor.clone(),
                 },
+                stale_index_skips: 0,
             });
         }
 
@@ -659,6 +660,7 @@ impl Memvid {
                 snippet_chars: request.snippet_chars,
                 cursor: search_request.cursor.clone(),
             },
+            stale_index_skips: 0,
         })
     }
 }
```

**File**: `src/memvid/search/api.rs` (modified, +2/-0)
```diff
@@ -362,6 +362,7 @@ impl Memvid {
                 context: build_context(&[]),
                 next_cursor: None,
                 engine: SearchEngineKind::Hybrid,
+                stale_index_skips: 0,
             });
         }
 
@@ -466,6 +467,7 @@ impl Memvid {
             context,
             next_cursor: None,
             engine: SearchEngineKind::Hybrid,
+            stale_index_skips: 0,
         })
     }
 
```

**File**: `src/memvid/search/fallback.rs` (modified, +21/-8)
```diff
@@ -39,18 +39,24 @@ pub(super) fn search_with_lex_fallback(
     let max_snippets_per_doc = request.top_k.max(1);
 
     let mut evaluated = Vec::new();
+    let mut stale_skips = 0u32;
     for matched in &matches {
         if let Some(filter) = candidate_filter {
             if !filter.contains(&matched.frame_id) {
                 continue;
             }
         }
-        let frame_meta = usize::try_from(matched.frame_id)
+        let frame_meta = match usize::try_from(matched.frame_id)
             .ok()
             .and_then(|idx| memvid.toc.frames.get(idx))
-            .ok_or(MemvidError::InvalidTimeIndex {
-                reason: "frame id out of range".into(),
-            })?;
+        {
+            Some(f) => f,
+            None => {
+                tracing::warn!(frame_id = matched.frame_id, "skipping search hit with stale frame_id");
+                stale_skips = stale_skips.saturating_add(1);
+                continue;
+            }
+        };
         let content_lower = matched.content.to_ascii_lowercase();
         let ctx = EvaluationContext {
             frame: frame_meta,
@@ -86,14 +92,18 @@ pub(super) fn search_with_lex_fallback(
     let mut hits = Vec::new();
     let mut produced = 0usize;
     for (matched, slices) in evaluated {
-        let frame_meta = memvid
+        let frame_meta = match memvid
             .toc
             .frames
             .get(usize::try_from(matched.frame_id).unwrap_or(usize::MAX))
             .cloned()
-            .ok_or(MemvidError::InvalidTimeIndex {
-                reason: "frame id out of range".into(),
-            })?;
+        {
+            Some(f) => f,
+            None => {
+                tracing::warn!(frame_id = matched.frame_id, "skipping stale frame_id in snippet assembly");
+                continue;
+            }
+        };
         let canonical = memvid.frame_content(&frame_meta)?;
         let canonical_limit = frame_meta.canonical_length.map_or_else(
             || canonical.len(),
@@ -200,6 +210,7 @@ pub(super) fn search_with_lex_fallback(
         context,
         next_cursor,
         engine: SearchEngineKind::LexFallback,
+        stale_index_skips: stale_skips,
     })
 }
 
@@ -250,6 +261,7 @@ pub(super) fn search_with_filters_only(
             context: build_context(&[]),
             next_cursor: None,
             engine: SearchEngineKind::LexFallback,
+            stale_index_skips: 0,
         });
     }
 
@@ -322,5 +334,6 @@ pub(super) fn search_with_filters_only(
         context,
         next_cursor,
         engine: SearchEngineKind::LexFallback,
+        stale_index_skips: 0,
     })
 }
```

**File**: `src/memvid/search/helpers.rs` (modified, +10/-7)
```diff
@@ -33,6 +33,7 @@ pub(super) fn empty_search_response(
         context: String::new(),
         next_cursor: None,
         engine,
+        stale_index_skips: 0,
     }
 }
 
@@ -344,13 +345,15 @@ pub(crate) fn attach_temporal_metadata(memvid: &mut Memvid, hits: &mut [SearchHi
 
                 let text = if mention_end > mention_start {
                     if !canonical_cache.contains_key(&frame_id) {
-                        let frame = memvid.toc.frames.get(frame_id as usize).cloned().ok_or(
-                            MemvidError::InvalidTimeIndex {
-                                reason: "frame id out of range".into(),
-                            },
-                        )?;
-                        let content = memvid.frame_content(&frame)?;
-                        canonical_cache.insert(frame_id, content);
+                        match memvid.toc.frames.get(frame_id as usize).cloned() {
+                            Some(frame) => {
+                                let content = memvid.frame_content(&frame)?;
+                                canonical_cache.insert(frame_id, content);
+                            }
+                            None => {
+                                tracing::warn!(frame_id, "skipping temporal text for stale frame_id");
+                            }
+                        }
                     }
                     canonical_cache.get(&frame_id).and_then(|content| {
                         if mention_end <= content.len() {
```

**File**: `src/memvid/search/tantivy.rs` (modified, +20/-9)
```diff
@@ -14,7 +14,7 @@ use crate::types::{
     FrameId, SearchEngineKind, SearchHit, SearchHitMetadata, SearchParams, SearchRequest,
     SearchResponse,
 };
-use crate::{MemvidError, Result};
+use crate::Result;
 use log::warn;
 use std::collections::HashSet;
 use std::time::Instant;
@@ -119,15 +119,21 @@ pub(super) fn try_tantivy_search(
     let snippet_window = request.snippet_chars.max(80);
     let max_snippets_per_doc = request.top_k.max(1);
     let mut evaluated = Vec::new();
+    let mut stale_skips = 0u32;
     for hit in search_hits {
-        let frame_meta = memvid
+        let frame_meta = match memvid
             .toc
             .frames
             .get(usize::try_from(hit.frame_id).unwrap_or(usize::MAX))
             .cloned()
-            .ok_or(MemvidError::InvalidTimeIndex {
-                reason: "frame id out of range".into(),
-            })?;
+        {
+            Some(f) => f,
+            None => {
+                tracing::warn!(frame_id = hit.frame_id, "skipping search hit with stale frame_id");
+                stale_skips = stale_skips.saturating_add(1);
+                continue;
+            }
+        };
         if let Some(uri_expected) = uri_filter {
             if !uri_matches(frame_meta.uri.as_deref(), uri_expected) {
                 continue;
@@ -274,14 +280,18 @@ pub(super) fn try_tantivy_search(
         if hits.len() == effective_top_k && produced >= offset {
             break;
         }
-        let frame_meta = memvid
+        let frame_meta = match memvid
             .toc
             .frames
             .get(usize::try_from(hit.frame_id).unwrap_or(usize::MAX))
             .cloned()
-            .ok_or(MemvidError::InvalidTimeIndex {
-                reason: "frame id out of range".into(),
-            })?;
+        {
+            Some(f) => f,
+            None => {
+                tracing::warn!(frame_id = hit.frame_id, "skipping stale frame_id in snippet assembly");
+                continue;
+            }
+        };
         let uri = frame_meta
             .uri
             .clone()
@@ -373,6 +383,7 @@ pub(super) fn try_tantivy_search(
         context,
         next_cursor,
         engine: SearchEngineKind::Tantivy,
+        stale_index_skips: stale_skips,
     }))
 }
 
```

**File**: `src/reader/mod.rs` (modified, +3/-3)
```diff
@@ -6,9 +6,9 @@ mod pdf;
 mod pptx;
 mod xls;
 mod xlsx;
-pub(crate) mod xlsx_chunker;
-pub(crate) mod xlsx_ooxml;
-pub(crate) mod xlsx_table_detect;
+pub mod xlsx_chunker;
+pub mod xlsx_ooxml;
+pub mod xlsx_table_detect;
 
 use serde_json::Value;
 
```

**File**: `src/reader/xlsx_ooxml.rs` (modified, +5/-5)
```diff
@@ -324,7 +324,7 @@ fn parse_workbook_sheet_names(xml: &str) -> Vec<String> {
             {
                 for attr in e.attributes().flatten() {
                     if attr.key.as_ref() == b"name" {
-                        if let Ok(val) = attr.unescape_value() {
+                        if let Ok(val) = attr.decode_and_unescape_value(&reader) {
                             names.push(val.to_string());
                         }
                     }
@@ -364,12 +364,12 @@ fn parse_styles_xml(xml: &str, metadata: &mut OoxmlMetadata) {
                         for attr in e.attributes().flatten() {
                             match attr.key.as_ref() {
                                 b"numFmtId" => {
-                                    if let Ok(v) = attr.unescape_value() {
+                                    if let Ok(v) = attr.decode_and_unescape_value(&reader) {
                                         fmt_id = v.parse::<u32>().ok();
                                     }
                                 }
                                 b"formatCode" => {
-                                    if let Ok(v) = attr.unescape_value() {
+                                    if let Ok(v) = attr.decode_and_unescape_value(&reader) {
                                         fmt_code = Some(v.to_string());
                                     }
                                 }
@@ -384,7 +384,7 @@ fn parse_styles_xml(xml: &str, metadata: &mut OoxmlMetadata) {
                         let mut num_fmt_id = 0u32;
                         for attr in e.attributes().flatten() {
                             if attr.key.as_ref() == b"numFmtId" {
-                                if let Ok(v) = attr.unescape_value() {
+                                if let Ok(v) = attr.decode_and_unescape_value(&reader) {
                                     num_fmt_id = v.parse::<u32>().unwrap_or(0);
                                 }
                             }
@@ -425,7 +425,7 @@ fn parse_merge_cells_xml(xml: &str) -> Vec<MergedRegion> {
             {
                 for attr in e.attributes().flatten() {
                     if attr.key.as_ref() == b"ref" {
-                        if let Ok(val) = attr.unescape_value() {
+                        if let Ok(val) = attr.decode_and_unescape_value(&reader) {
                             if let Some(((tr, lc), (br, rc))) = parse_range_ref(&val) {
                                 regions.push(MergedRegion {
                                     top_row: tr,
```

---

### Incident Patch 5: `e35546ff` (2026-03-03)
**Commit Message**: fix: expose lex_enabled/vec_enabled in stats and auto-detect vec on reopen, gracefully skip out-of-range frame ids in timeline (#194, #196)

**File**: `src/memvid/mutation.rs` (modified, +3/-0)
```diff
@@ -429,6 +429,7 @@ impl Memvid {
         let original_data_end = self.data_end;
         let original_generation = self.generation;
         let original_dirty = self.dirty;
+        let original_lex_enabled = self.lex_enabled;
         #[cfg(feature = "lex")]
         let original_tantivy_dirty = self.tantivy_dirty;
 
@@ -462,6 +463,7 @@ impl Memvid {
                         self.data_end = original_data_end;
                         self.generation = original_generation;
                         self.dirty = original_dirty;
+                        self.lex_enabled = original_lex_enabled;
                         #[cfg(feature = "lex")]
                         {
                             self.tantivy_dirty = original_tantivy_dirty;
@@ -483,6 +485,7 @@ impl Memvid {
                 self.data_end = original_data_end;
                 self.generation = original_generation;
                 self.dirty = original_dirty;
+                self.lex_enabled = original_lex_enabled;
                 #[cfg(feature = "lex")]
                 {
                     self.tantivy_dirty = original_tantivy_dirty;
```

**File**: `src/memvid/search/api.rs` (modified, +12/-3)
```diff
@@ -19,10 +19,19 @@ impl Memvid {
     pub fn enable_lex(&mut self) -> Result<()> {
         self.ensure_writable()?;
         if self.lex_enabled {
-            // If index exists on disk but not in memory, load it
             #[cfg(feature = "lex")]
-            if self.lex_index.is_none() && crate::memvid::lifecycle::has_lex_index(&self.toc) {
-                self.load_lex_index_from_manifest()?;
+            {
+                // If index exists on disk but not in memory, load it
+                if self.lex_index.is_none()
+                    && crate::memvid::lifecycle::has_lex_index(&self.toc)
+                {
+                    self.load_lex_index_from_manifest()?;
+                }
+                // Ensure Tantivy engine is running even if lex was already enabled
+                // (e.g. create() set lex_enabled=true but tantivy may have been lost)
+                if self.tantivy.is_none() {
+                    self.init_tantivy()?;
+                }
             }
             return Ok(());
         }
```

**File**: `src/memvid/search/mod.rs` (modified, +7/-0)
```diff
@@ -48,6 +48,13 @@ impl Memvid {
             return Err(MemvidError::LexNotEnabled);
         }
 
+        // Lazy-init Tantivy if lex is enabled but engine is missing.
+        // This can happen when a wrapper re-enables lex on an already-enabled
+        // instance, or after a staging-lock rollback lost the engine reference.
+        if self.tantivy.is_none() {
+            self.init_tantivy()?;
+        }
+
         let start_time = Instant::now();
         // parse_query can return structured tokens; we only keep non-empty, lower-cased terms.
         let parsed = crate::search::parse_query(&request.query)?;
```

**File**: `src/memvid/ticket.rs` (modified, +2/-0)
```diff
@@ -117,6 +117,8 @@ impl Memvid {
             time_index_bytes,
             vector_count,
             clip_image_count,
+            lex_enabled: self.lex_enabled,
+            vec_enabled: self.vec_enabled,
         })
     }
 
```

**File**: `src/memvid/timeline.rs` (modified, +9/-6)
```diff
@@ -10,7 +10,7 @@ use crate::types::{
     SearchHitTemporal, SearchHitTemporalAnchor, SearchHitTemporalMention, TemporalFilter,
     TemporalTrack,
 };
-use crate::{MemvidError, Result};
+use crate::Result;
 #[cfg(feature = "temporal_track")]
 use std::collections::HashSet;
 use std::num::NonZeroU64;
@@ -95,14 +95,17 @@ pub(crate) fn build_timeline(
     #[cfg(feature = "temporal_track")]
     let temporal_track_snapshot = memvid.temporal_track_ref()?.cloned();
     for entry in entries.into_iter().take(limit) {
-        let frame = memvid
+        let frame = match memvid
             .toc
             .frames
             .get(usize::try_from(entry.frame_id).unwrap_or(usize::MAX))
-            .ok_or(MemvidError::InvalidTimeIndex {
-                reason: "frame id out of range".into(),
-            })?
-            .clone();
+        {
+            Some(f) => f.clone(),
+            None => {
+                tracing::warn!(frame_id = entry.frame_id, "skipping time index entry with out-of-range frame id");
+                continue;
+            }
+        };
         if frame.status != FrameStatus::Active {
             continue;
         }
```

**File**: `src/tests_lex_flag.rs` (modified, +130/-0)
```diff
@@ -1,6 +1,7 @@
 #[cfg(test)]
 mod tests {
     use crate::{Memvid, PutOptions, SearchRequest, run_serial_test};
+    use std::sync::Mutex;
     use tempfile::NamedTempFile;
 
     #[test]
@@ -87,4 +88,133 @@ mod tests {
             }
         });
     }
+
+    /// Regression test for GitHub issue #201:
+    /// Lexical index not enabled when Memvid is wrapped in a Mutex.
+    /// The wrapper pattern acquires the lock, performs an operation, releases
+    /// the lock — mimicking the typical tokio::sync::Mutex usage in async code.
+    #[test]
+    #[cfg(not(target_os = "windows"))]
+    fn test_lex_works_through_mutex_wrapper() {
+        run_serial_test(|| {
+            let temp = NamedTempFile::new().unwrap();
+            let path = temp.path();
+
+            // Wrap Memvid in a Mutex, exactly like an async wrapper would
+            let wrapper = Mutex::new(Memvid::create(path).unwrap());
+
+            // Step 1: enable_lex while holding the lock, then release
+            {
+                let mut mem = wrapper.lock().unwrap();
+                mem.enable_lex().unwrap();
+            }
+
+            // Step 2: commit while holding the lock (separate acquisition)
+            {
+                let mut mem = wrapper.lock().unwrap();
+                mem.commit().unwrap();
+            }
+
+            // Step 3: put data while holding the lock
+            {
+                let mut mem = wrapper.lock().unwrap();
+                let opts = PutOptions::builder()
+                    .uri("mv2://test/login".to_string())
+                    .search_text(
+                        "user clicked login button on the authentication page".to_string(),
+                    )
+                    .build();
+                mem.put_bytes_with_options(b"login event data", opts)
+                    .unwrap();
+            }
+
+            // Step 4: commit while holding the lock
+            {
+                let mut mem = wrapper.lock().unwrap();
+                mem.commit().unwrap();
+            }
+
+            // Step 5: search while holding the lock — this was failing in #201
+            {
+                let mut mem = wrapper.lock().unwrap();
+                let resp = mem
+                    .search(SearchRequest {
+                        query: "login".into(),
+                        top_k: 10,
+                        snippet_chars: 200,
+                        uri: None,
+                        scope: None,
+                        cursor: None,
+                        #[cfg(feature = "temporal_track")]
+                        temporal: None,
+                        as_of_frame: None,
+                        as_of_ts: None,
+                        no_sketch: false,
+                        acl_context: None,
+                        acl_enforcement_mode: crate::types::AclEnforcementMode::Audit,
+                    })
+                    .expect("search must succeed through mutex wrapper");
+
+                assert!(
+                    !resp.hits.is_empty(),
+                    "Should find the frame with 'login' in the message"
+                );
+            }
+
+            // Step 6: search_lex uses the legacy LexIndex, which may not be
+            // populated when only Tantivy is active. Verify it doesn't panic.
+            {
+                let mut mem = wrapper.lock().unwrap();
+                let _ = mem.search_lex("login", 10);
+                // Result may be Ok (if legacy index was built) or Err (if only Tantivy).
+                // The important thing is it doesn't panic.
+            }
+        });
+    }
+
+    /// Regression test for #201: enable_lex, put, commit, search — all in one lock scope.
+    #[test]
+    #[cfg(not(target_os = "windows"))]
+    fn test_lex_works_single_scope() {
+        run_serial_test(|| {
+            let temp = NamedTempFile::new().unwrap();
+            let path = temp.path();
+
+            let mut mem = Memvid::create(path).unwrap();
+            mem.enable_lex().unwrap();
+
+            let opts = PutOptions::builder()
+                .uri("mv2://test/login".to_string())
+                .search_text(
+                    "user clicked login button on the authentication page".to_string(),
+                )
+                .build();
+            mem.put_bytes_with_options(b"login event data", opts)
+                .unwrap();
+            mem.commit().unwrap();
+
+            let resp = mem
+                .search(SearchRequest {
+                    query: "login".into(),
+                    top_k: 10,
+                    snippet_chars: 200,
+                    uri: None,
+                    scope: None,
+                    cursor: None,
+                    #[cfg(feature = "temporal_track")]
+                    temporal: None,
+                    as_of_frame: None,
+                    as_of_ts: None,
+                    no_sketch: false,
+                    acl_context: None,
+                    acl_enforc
```

**File**: `src/types/frame.rs` (modified, +6/-0)
```diff
@@ -136,6 +136,12 @@ pub struct Stats {
     /// Number of CLIP visual embeddings (images/PDF pages)
     #[serde(default)]
     pub clip_image_count: u64,
+    /// Whether the lex (full-text) search engine is enabled at runtime.
+    #[serde(default)]
+    pub lex_enabled: bool,
+    /// Whether the vec (vector/semantic) search engine is enabled at runtime.
+    #[serde(default)]
+    pub vec_enabled: bool,
 }
 
 /// Entry returned by `timeline` queries, carrying a lightweight preview.
```

---

### Incident Patch 6: `7be69c6a` (2026-02-15)
**Commit Message**: Skip xlsx_structured tests when arden.xlsx fixture is absent (CI)

**File**: `tests/xlsx_structured.rs` (modified, +42/-20)
```diff
@@ -13,8 +13,21 @@ use tempfile::TempDir;
 
 const ARDEN_PATH: &str = "/Users/olow/Desktop/memvid-org/arden.xlsx";
 
-fn load_arden() -> Vec<u8> {
-    std::fs::read(ARDEN_PATH).expect("arden.xlsx must exist at the expected path")
+/// Load the test fixture. Returns `None` when the file is not present (CI).
+fn try_load_arden() -> Option<Vec<u8>> {
+    std::fs::read(ARDEN_PATH).ok()
+}
+
+macro_rules! require_arden {
+    () => {
+        match try_load_arden() {
+            Some(bytes) => bytes,
+            None => {
+                eprintln!("SKIP: arden.xlsx not found at {ARDEN_PATH}");
+                return;
+            }
+        }
+    };
 }
 
 // ---------------------------------------------------------------------------
@@ -23,7 +36,7 @@ fn load_arden() -> Vec<u8> {
 
 #[test]
 fn structured_extraction_completes_under_5s() {
-    let bytes = load_arden();
+    let bytes = require_arden!();
     let start = Instant::now();
     let result = XlsxReader::extract_structured(&bytes).expect("extraction must succeed");
     let elapsed = start.elapsed();
@@ -45,7 +58,7 @@ fn structured_extraction_completes_under_5s() {
 
 #[test]
 fn detects_multiple_tables_across_sheets() {
-    let bytes = load_arden();
+    let bytes = require_arden!();
     let result = XlsxReader::extract_structured(&bytes).unwrap();
 
     // 19 sheets — should detect at least several tables
@@ -72,7 +85,7 @@ fn detects_multiple_tables_across_sheets() {
 
 #[test]
 fn chunks_have_header_context() {
-    let bytes = load_arden();
+    let bytes = require_arden!();
     let result = XlsxReader::extract_structured(&bytes).unwrap();
 
     assert!(
@@ -104,7 +117,7 @@ fn chunks_have_header_context() {
 
 #[test]
 fn chunks_respect_row_boundaries() {
-    let bytes = load_arden();
+    let bytes = require_arden!();
     let result = XlsxReader::extract_structured(&bytes).unwrap();
 
     for chunk in &result.chunks.chunks {
@@ -128,7 +141,7 @@ fn chunks_respect_row_boundaries() {
 
 #[test]
 fn chunk_sizes_near_target() {
-    let bytes = load_arden();
+    let bytes = require_arden!();
     let opts = XlsxChunkingOptions {
         max_chars: 1200,
         max_chunks: 500,
@@ -163,7 +176,7 @@ fn chunk_sizes_near_target() {
 
 #[test]
 fn merged_regions_detected() {
-    let bytes = load_arden();
+    let bytes = require_arden!();
     let result = XlsxReader::extract_structured(&bytes).unwrap();
 
     let total_merged: usize = result
@@ -183,7 +196,7 @@ fn merged_regions_detected() {
 
 #[test]
 fn number_formats_parsed() {
-    let bytes = load_arden();
+    let bytes = require_arden!();
     let result = XlsxReader::extract_structured(&bytes).unwrap();
 
     println!("Number format entries: {}", result.metadata.num_fmts.len());
@@ -202,7 +215,7 @@ fn number_formats_parsed() {
 
 #[test]
 fn flat_text_contains_key_data() {
-    let bytes = load_arden();
+    let bytes = require_arden!();
     let result = XlsxReader::extract_structured(&bytes).unwrap();
 
     let text = &result.text;
@@ -234,11 +247,11 @@ fn flat_text_contains_key_data() {
 // ---------------------------------------------------------------------------
 
 /// Ingest the XLSX into a Memvid file and return the path + temp dir (to keep alive).
-fn ingest_arden() -> (std::path::PathBuf, TempDir) {
+/// Returns `None` when arden.xlsx is not available (CI).
+fn ingest_arden() -> Option<(std::path::PathBuf, TempDir)> {
+    let bytes = try_load_arden()?;
     let dir = TempDir::new().unwrap();
     let mv2_path = dir.path().join("arden.mv2");
-
-    let bytes = load_arden();
     let result = XlsxReader::extract_structured(&bytes).unwrap();
 
     let mut mem = Memvid::create(&mv2_path).unwrap();
@@ -260,7 +273,7 @@ fn ingest_arden() -> (std::path::PathBuf, TempDir) {
     }
 
     mem.commit().unwrap();
-    (mv2_path, dir)
+    Some((mv2_path, dir))
 }
 
 fn search_arden(mem: &mut Memvid, query: &str, top_k: usize) -> Vec<memvid_core::SearchHit> {
@@ -286,7 +299,10 @@ fn search_arden(mem: &mut Memvid, query: &str, top_k: usize) -> Vec<memvid_core:
 #[test]
 #[cfg(feature = "lex")]
 fn ingest_and_search_units() {
-    let (path, _dir) = ingest_arden();
+    let Some((path, _dir)) = ingest_arden() else {
+        eprintln!("SKIP");
+        return;
+    };
     let mut mem = Memvid::open_read_only(&path).unwrap();
 
     // Search for unit count — the file has 248 multifamily units
@@ -312,7 +328,10 @@ fn ingest_and_search_units() {
 #[test]
 #[cfg(feature = "lex")]
 fn ingest_and_search_financial_terms() {
-    let (path, _dir) = ingest_arden();
+    let Some((path, _dir)) = ingest_arden() else {
+        eprintln!("SKIP");
+        return;
+    };
     let mut mem = Memvid::open_read_only(&path).unwrap();
 
     // The file contains construction costs, debt service, NOI, etc.
@@ -343,7 +362,10 @@ fn ingest_and_search_financial_terms() {
 #[test]
 #[cfg(feature = "lex")]
 fn search_hits_contain_header_context() {
-    let (path, _dir) = ingest_arden();
+    let Some
```

---

### Incident Patch 7: `223b93d2` (2026-02-15)
**Commit Message**: Fix clippy and dead-code lints in xlsx extraction pipeline

**File**: `src/reader/xlsx.rs` (modified, +3/-1)
```diff
@@ -40,7 +40,7 @@ impl XlsxReader {
                 reason: format!("failed to read xlsx workbook: {err}").into(),
             })?;
 
-        let sheet_names: Vec<String> = workbook.sheet_names().to_vec();
+        let sheet_names: Vec<String> = workbook.sheet_names().clone();
         let mut grids = Vec::new();
 
         for sheet_name in &sheet_names {
@@ -49,7 +49,9 @@ impl XlsxReader {
             };
 
             let mut grid = SheetGrid::new(sheet_name.clone());
+            #[allow(clippy::cast_possible_truncation)]
             let num_rows = range.height() as u32;
+            #[allow(clippy::cast_possible_truncation)]
             let num_cols = range.width() as u32;
 
             for row in range.rows() {
```

**File**: `src/reader/xlsx_table_detect.rs` (modified, +1/-0)
```diff
@@ -496,6 +496,7 @@ fn infer_column_types(
 
 /// Propagate merged cell values into a grid.
 /// The top-left cell's value is copied to all cells in the merged region.
+#[allow(dead_code)]
 pub fn propagate_merged_cells(grid: &mut SheetGrid, merged_regions: &[MergedRegion]) {
     for region in merged_regions {
         // Get the top-left cell value
```

---

### Incident Patch 8: `64bbd32d` (2026-02-15)
**Commit Message**: Fix rustfmt formatting in xlsx_chunker, xlsx_ooxml, and xlsx.rs

**File**: `src/lib.rs` (modified, +2/-2)
```diff
@@ -184,8 +184,8 @@ pub use models::{
     ModelVerifyOptions, verify_model_dir, verify_models,
 };
 pub use reader::{
-    DetectedTable, DocumentFormat, DocumentReader, PassthroughReader, PdfReader,
-    ReaderDiagnostics, ReaderHint, ReaderOutput, ReaderRegistry, XlsxChunkingOptions, XlsxReader,
+    DetectedTable, DocumentFormat, DocumentReader, PassthroughReader, PdfReader, ReaderDiagnostics,
+    ReaderHint, ReaderOutput, ReaderRegistry, XlsxChunkingOptions, XlsxReader,
 };
 pub use signature::{
     parse_ed25519_public_key_base64, verify_model_manifest, verify_ticket_signature,
```

**File**: `src/reader/mod.rs` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ pub use passthrough::PassthroughReader;
 pub use pdf::PdfReader;
 pub use pptx::PptxReader;
 pub use xls::XlsReader;
-pub use xlsx::{XlsxReader, XlsxStructuredResult, XlsxStructuredDiagnostics};
+pub use xlsx::{XlsxReader, XlsxStructuredDiagnostics, XlsxStructuredResult};
 pub use xlsx_chunker::XlsxChunkingOptions;
 pub use xlsx_table_detect::DetectedTable;
 
```

**File**: `src/reader/xlsx.rs` (modified, +5/-9)
```diff
@@ -2,14 +2,13 @@ use std::io::Cursor;
 
 use calamine::{DataType, Reader as CalamineReader, Xlsx};
 
-use crate::{
-    DocumentFormat, DocumentReader, PassthroughReader, ReaderDiagnostics, ReaderHint, ReaderOutput,
-    Result,
-    types::structure::ChunkingResult,
-};
 use super::xlsx_chunker::{XlsxChunkingOptions, chunk_workbook, generate_flat_text};
 use super::xlsx_ooxml::{OoxmlMetadata, parse_ooxml_metadata};
 use super::xlsx_table_detect::{CellValue, DetectedTable, SheetGrid, detect_tables};
+use crate::{
+    DocumentFormat, DocumentReader, PassthroughReader, ReaderDiagnostics, ReaderHint, ReaderOutput,
+    Result, types::structure::ChunkingResult,
+};
 
 /// Result of the structured XLSX extraction pipeline.
 pub struct XlsxStructuredResult {
@@ -111,10 +110,7 @@ impl XlsxReader {
 
             let tables = detect_tables(grid, &sheet_ooxml_tables, &sheet_merged);
             if tables.is_empty() {
-                warnings.push(format!(
-                    "No tables detected in sheet '{}'",
-                    grid.sheet_name
-                ));
+                warnings.push(format!("No tables detected in sheet '{}'", grid.sheet_name));
             }
             all_tables.extend(tables);
         }
```

**File**: `src/reader/xlsx_chunker.rs` (modified, +11/-16)
```diff
@@ -9,8 +9,10 @@
 
 use crate::types::structure::{ChunkingResult, StructuredChunk};
 
+use super::xlsx_ooxml::{
+    NumFmtKind, OoxmlMetadata, excel_serial_to_iso, format_currency, format_percentage,
+};
 use super::xlsx_table_detect::{CellValue, DetectedTable, SheetGrid};
-use super::xlsx_ooxml::{NumFmtKind, OoxmlMetadata, excel_serial_to_iso, format_currency, format_percentage};
 
 /// Default target chunk size in characters.
 const DEFAULT_MAX_CHUNK_CHARS: usize = 1200;
@@ -93,10 +95,7 @@ fn format_row_with_headers(
         }
 
         let col_offset = (col - first_col) as usize;
-        let header = headers
-            .get(col_offset)
-            .filter(|h| !h.is_empty())
-            .cloned();
+        let header = headers.get(col_offset).filter(|h| !h.is_empty()).cloned();
 
         if let Some(h) = header {
             parts.push(format!("{h}: {formatted}"));
@@ -115,7 +114,11 @@ fn build_context_prefix(sheet_name: &str, table_name: &str) -> String {
 
 /// Build a header line: `Header1 | Header2 | Header3`
 fn build_header_line(headers: &[String]) -> String {
-    let nonempty: Vec<&str> = headers.iter().map(String::as_str).filter(|h| !h.is_empty()).collect();
+    let nonempty: Vec<&str> = headers
+        .iter()
+        .map(String::as_str)
+        .filter(|h| !h.is_empty())
+        .collect();
     if nonempty.is_empty() {
         String::new()
     } else {
@@ -369,11 +372,7 @@ mod tests {
             "Sheet1",
         );
         let metadata = OoxmlMetadata::default();
-        let headers = vec![
-            "Name".to_string(),
-            "Age".to_string(),
-            "City".to_string(),
-        ];
+        let headers = vec!["Name".to_string(), "Age".to_string(), "City".to_string()];
 
         let result = format_row_with_headers(&grid, 0, &headers, 0, 2, &metadata);
         assert_eq!(result, "Name: Alice | Age: 30 | City: Austin");
@@ -390,11 +389,7 @@ mod tests {
             "Sheet1",
         );
         let metadata = OoxmlMetadata::default();
-        let headers = vec![
-            "Name".to_string(),
-            "Age".to_string(),
-            "City".to_string(),
-        ];
+        let headers = vec!["Name".to_string(), "Age".to_string(), "City".to_string()];
 
         let result = format_row_with_headers(&grid, 0, &headers, 0, 2, &metadata);
         assert_eq!(result, "Name: Alice | City: Austin");
```

**File**: `src/reader/xlsx_ooxml.rs` (modified, +4/-11)
```diff
@@ -13,8 +13,8 @@
 use std::collections::HashMap;
 use std::io::{Cursor, Read};
 
-use quick_xml::events::Event;
 use quick_xml::Reader as XmlReader;
+use quick_xml::events::Event;
 use serde::{Deserialize, Serialize};
 use zip::ZipArchive;
 
@@ -252,9 +252,7 @@ pub fn parse_ooxml_metadata(xlsx_bytes: &[u8]) -> Result<OoxmlMetadata> {
         if let Ok(sheet_xml) = read_zip_entry(&mut archive, zip_path) {
             let regions = parse_merge_cells_xml(&sheet_xml);
             if !regions.is_empty() {
-                metadata
-                    .merged_regions
-                    .insert(sheet_name.clone(), regions);
+                metadata.merged_regions.insert(sheet_name.clone(), regions);
             }
         }
     }
@@ -318,9 +316,7 @@ fn parse_workbook_sheet_names(xml: &str) -> Vec<String> {
 
     loop {
         match reader.read_event_into(&mut buf) {
-            Ok(Event::Start(ref e) | Event::Empty(ref e))
-                if e.name().as_ref() == b"sheets" =>
-            {
+            Ok(Event::Start(ref e) | Event::Empty(ref e)) if e.name().as_ref() == b"sheets" => {
                 in_sheets = true;
             }
             Ok(Event::Start(ref e) | Event::Empty(ref e))
@@ -601,10 +597,7 @@ mod tests {
     fn test_format_currency() {
         assert_eq!(format_currency(10.5, "$#,##0.00"), "$10.50");
         assert_eq!(format_currency(-10.5, "$#,##0.00"), "-$10.50");
-        assert_eq!(
-            format_currency(10.5, "\u{20ac}#,##0.00"),
-            "\u{20ac}10.50"
-        );
+        assert_eq!(format_currency(10.5, "\u{20ac}#,##0.00"), "\u{20ac}10.50");
     }
 
     #[test]
```

**File**: `src/reader/xlsx_table_detect.rs` (modified, +11/-3)
```diff
@@ -175,8 +175,13 @@ pub fn detect_tables(
     // Phase 1: Use OOXML table definitions for this sheet
     for tdef in ooxml_tables {
         if tdef.sheet_name == grid.sheet_name {
-            let column_types =
-                infer_column_types(grid, tdef.first_row + 1, tdef.last_row, tdef.first_col, tdef.last_col);
+            let column_types = infer_column_types(
+                grid,
+                tdef.first_row + 1,
+                tdef.last_row,
+                tdef.first_col,
+                tdef.last_col,
+            );
             tables.push(DetectedTable {
                 name: tdef.name.clone(),
                 sheet_name: grid.sheet_name.clone(),
@@ -209,7 +214,10 @@ pub fn detect_tables(
         let column_types = infer_column_types(grid, first_data_row, end_row, start_col, end_col);
 
         // Boost confidence if column types are consistent
-        let type_boost = if column_types.iter().filter(|t| **t != ColumnType::Mixed && **t != ColumnType::Empty).count()
+        let type_boost = if column_types
+            .iter()
+            .filter(|t| **t != ColumnType::Mixed && **t != ColumnType::Empty)
+            .count()
             > column_types.len() / 2
         {
             0.15
```

**File**: `tests/xlsx_structured.rs` (modified, +33/-35)
```diff
@@ -32,7 +32,10 @@ fn structured_extraction_completes_under_5s() {
     println!("Flat text length: {} chars", result.text.len());
     println!("Tables detected: {}", result.tables.len());
     println!("Chunks produced: {}", result.chunks.chunks.len());
-    println!("Diagnostics warnings: {}", result.diagnostics.warnings.len());
+    println!(
+        "Diagnostics warnings: {}",
+        result.diagnostics.warnings.len()
+    );
 
     assert!(
         elapsed.as_secs() < 5,
@@ -53,8 +56,11 @@ fn detects_multiple_tables_across_sheets() {
     );
 
     // Collect unique sheet names
-    let sheet_names: std::collections::HashSet<&str> =
-        result.tables.iter().map(|t| t.sheet_name.as_str()).collect();
+    let sheet_names: std::collections::HashSet<&str> = result
+        .tables
+        .iter()
+        .map(|t| t.sheet_name.as_str())
+        .collect();
     println!("Sheets with tables: {sheet_names:?}");
 
     assert!(
@@ -160,7 +166,12 @@ fn merged_regions_detected() {
     let bytes = load_arden();
     let result = XlsxReader::extract_structured(&bytes).unwrap();
 
-    let total_merged: usize = result.metadata.merged_regions.values().map(|v| v.len()).sum();
+    let total_merged: usize = result
+        .metadata
+        .merged_regions
+        .values()
+        .map(|v| v.len())
+        .sum();
     println!("Total merged regions: {total_merged}");
 
     // A complex real-estate pro forma with 19 sheets should have many merged cells
@@ -175,14 +186,8 @@ fn number_formats_parsed() {
     let bytes = load_arden();
     let result = XlsxReader::extract_structured(&bytes).unwrap();
 
-    println!(
-        "Number format entries: {}",
-        result.metadata.num_fmts.len()
-    );
-    println!(
-        "Cell XF entries: {}",
-        result.metadata.cell_xfs.len()
-    );
+    println!("Number format entries: {}", result.metadata.num_fmts.len());
+    println!("Cell XF entries: {}", result.metadata.cell_xfs.len());
 
     // Financial workbook should have custom number formats
     assert!(
@@ -212,8 +217,8 @@ fn flat_text_contains_key_data() {
 
     // The file is a real estate deal for "TRG Apartments" in SLC, UT
     let key_terms = [
-        "sheet:",         // Should have sheet labels
-        "248",            // 248 units
+        "sheet:", // Should have sheet labels
+        "248",    // 248 units
     ];
 
     for term in &key_terms {
@@ -258,11 +263,7 @@ fn ingest_arden() -> (std::path::PathBuf, TempDir) {
     (mv2_path, dir)
 }
 
-fn search_arden(
-    mem: &mut Memvid,
-    query: &str,
-    top_k: usize,
-) -> Vec<memvid_core::SearchHit> {
+fn search_arden(mem: &mut Memvid, query: &str, top_k: usize) -> Vec<memvid_core::SearchHit> {
     mem.search(SearchRequest {
         query: query.to_string(),
         top_k,
@@ -291,10 +292,7 @@ fn ingest_and_search_units() {
     // Search for unit count — the file has 248 multifamily units
     let hits = search_arden(&mut mem, "248 units", 5);
 
-    println!(
-        "Query '248 units' — {} hits",
-        hits.len()
-    );
+    println!("Query '248 units' — {} hits", hits.len());
     for (i, h) in hits.iter().enumerate() {
         println!(
             "  [{i}] score={:.3} uri={} text={:.120}",
@@ -318,13 +316,7 @@ fn ingest_and_search_financial_terms() {
     let mut mem = Memvid::open_read_only(&path).unwrap();
 
     // The file contains construction costs, debt service, NOI, etc.
-    let queries = [
-        "construction",
-        "debt",
-        "occupancy",
-        "revenue",
-        "lease",
-    ];
+    let queries = ["construction", "debt", "occupancy", "revenue", "lease"];
 
     let mut found_count = 0;
     for query in &queries {
@@ -362,9 +354,9 @@ fn search_hits_contain_header_context() {
     }
 
     // Check that hit text contains structured context (sheet/table prefix or header:value pairs)
-    let has_context = hits.iter().any(|h| {
-        h.text.contains("[Sheet:") || h.text.contains(':')
-    });
+    let has_context = hits
+        .iter()
+        .any(|h| h.text.contains("[Sheet:") || h.text.contains(':'));
 
     assert!(
         has_context,
@@ -421,12 +413,18 @@ fn full_pipeline_timing() {
 
     println!("=== Full Pipeline Timing ===");
     println!("  XLSX extraction:  {extraction_time:?}");
-    println!("  Memvid ingest:    {ingest_time:?}  ({} chunks)", result.chunks.chunks.len());
+    println!(
+        "  Memvid ingest:    {ingest_time:?}  ({} chunks)",
+        result.chunks.chunks.len()
+    );
     println!("  Search query:     {search_time:?}  ({} hits)", hits.len());
     println!("  TOTAL:            {total:?}");
     println!("  Tables detected:  {}", result.tables.len());
     println!("  Flat text chars:  {}", result.text.len());
-    println!("  MV2 file size:    {} KB", std::fs::metadata(&mv2_path).unwrap().len() / 1024);
+    println!(
+        "  MV2 file size:    {} KB",
+        std::fs::metadata(&mv2_path).unwrap().len() / 1024
+    );
 
     // In r
```

---

### Incident Patch 9: `f8075346` (2026-02-07)
**Commit Message**: fix: resolve clippy pedantic lints and add missing VecIndexManifest model field

**File**: `src/memvid/mutation.rs` (modified, +3/-1)
```diff
@@ -2147,7 +2147,9 @@ impl Memvid {
                     let max_payload = crate::memvid::search::max_index_payload();
                     let mut prepared_docs: Vec<(Frame, String)> = Vec::new();
                     for &frame_id in inserted_frame_ids {
-                        let Ok(idx) = usize::try_from(frame_id) else { continue };
+                        let Ok(idx) = usize::try_from(frame_id) else {
+                            continue;
+                        };
                         let frame = match self.toc.frames.get(idx) {
                             Some(f) => f.clone(),
                             None => continue,
```

---

### Incident Patch 10: `c84da0bb` (2026-02-06)
**Commit Message**: fix: clippy linting error

**File**: `src/memvid/acl.rs` (modified, +10/-10)
```diff
@@ -9,24 +9,24 @@ use crate::{MemvidError, Result};
 
 #[derive(Debug, Clone, Default)]
 pub(crate) struct AclFilterStats {
-    pub allowed_count: usize,
-    pub denied_count: usize,
-    pub cross_tenant_denied_count: usize,
-    pub missing_metadata_count: usize,
+    pub allowed: usize,
+    pub denied: usize,
+    pub cross_tenant_denied: usize,
+    pub missing_metadata: usize,
 }
 
 impl AclFilterStats {
     fn record(&mut self, decision: AclDecision) {
         if decision.allowed {
-            self.allowed_count += 1;
+            self.allowed += 1;
             return;
         }
-        self.denied_count += 1;
+        self.denied += 1;
         if decision.cross_tenant_denied {
-            self.cross_tenant_denied_count += 1;
+            self.cross_tenant_denied += 1;
         }
         if decision.missing_metadata_denied {
-            self.missing_metadata_count += 1;
+            self.missing_metadata += 1;
         }
     }
 }
@@ -107,7 +107,7 @@ impl Memvid {
 
         let mut stats = AclFilterStats::default();
         if normalized_context.is_none() {
-            stats.allowed_count = hits.len();
+            stats.allowed = hits.len();
             return Ok(stats);
         }
 
@@ -186,7 +186,7 @@ fn evaluate_acl_metadata(
 
     let parsed = match parse_acl_metadata(metadata) {
         Ok(parsed) => parsed,
-        Err(_) => return AclDecision::deny_missing_metadata(),
+        Err(()) => return AclDecision::deny_missing_metadata(),
     };
 
     if parsed.tenant_id != context.tenant_id {
```

**File**: `src/memvid/builder.rs` (modified, +1/-0)
```diff
@@ -280,6 +280,7 @@ impl Memvid {
                 bytes_length: 0,
                 checksum: empty_checksum,
                 compression_mode: self.vec_compression.clone(),
+                model: None,
             });
         }
         if let Some(manifest) = self.toc.indexes.vec.as_mut() {
```

**File**: `src/memvid/lifecycle.rs` (modified, +1/-0)
```diff
@@ -255,6 +255,7 @@ impl Memvid {
                 bytes_length: 0,
                 checksum: empty_checksum,
                 compression_mode: memvid.vec_compression.clone(),
+                model: memvid.vec_model.clone(),
             });
         }
 
```

**File**: `src/memvid/mutation.rs` (modified, +2/-1)
```diff
@@ -2147,7 +2147,8 @@ impl Memvid {
                     let max_payload = crate::memvid::search::max_index_payload();
                     let mut prepared_docs: Vec<(Frame, String)> = Vec::new();
                     for &frame_id in inserted_frame_ids {
-                        let frame = match self.toc.frames.get(frame_id as usize) {
+                        let Ok(idx) = usize::try_from(frame_id) else { continue };
+                        let frame = match self.toc.frames.get(idx) {
                             Some(f) => f.clone(),
                             None => continue,
                         };
```

---

### Incident Patch 11: `4e04ed82` (2026-02-06)
**Commit Message**: Add frame-level ACL and enforcement plumbing across search/ask/replay with robustness fixes, tests, and benchmark/example updates.

**File**: `.gitignore` (modified, +3/-1)
```diff
@@ -42,4 +42,6 @@ vector_embedding.txt
 models/
 *.DS_Store
 
-issue_overview.md
\ No newline at end of file
+issue_overview.md
+
+feature_100x_memvid.md
\ No newline at end of file
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "memvid-core"
-version = "2.0.135"
+version = "2.0.136"
 edition = "2024"
 rust-version = "1.85.0"
 license = "Apache-2.0"
```

**File**: `benches/search_precision_benchmark.rs` (modified, +6/-0)
```diff
@@ -73,6 +73,8 @@ fn bench_query_latency(c: &mut Criterion) {
                         as_of_frame: None,
                         as_of_ts: None,
                         no_sketch: false,
+                        acl_context: None,
+                        acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
                     })
                     .unwrap();
                 total += start.elapsed();
@@ -106,6 +108,8 @@ fn bench_precision(c: &mut Criterion) {
                         as_of_frame: None,
                         as_of_ts: None,
                         no_sketch: false,
+                        acl_context: None,
+                        acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
                     })
                     .unwrap();
 
@@ -149,6 +153,8 @@ fn bench_result_count(c: &mut Criterion) {
                         as_of_frame: None,
                         as_of_ts: None,
                         no_sketch: false,
+                        acl_context: None,
+                        acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
                     })
                     .unwrap();
                 let _count = results.hits.len();
```

**File**: `examples/basic_usage.rs` (modified, +4/-0)
```diff
@@ -97,6 +97,8 @@ fn main() -> Result<()> {
         as_of_frame: None,
         as_of_ts: None,
         no_sketch: false,
+        acl_context: None,
+        acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
     };
     let response = mem.search(request)?;
     println!("   Query: 'memvid'");
@@ -126,6 +128,8 @@ fn main() -> Result<()> {
         as_of_frame: None,
         as_of_ts: None,
         no_sketch: false,
+        acl_context: None,
+        acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
     };
     let response = mem.search(request)?;
     println!("   Query: 'documentation' (scope: mv2://docs/)");
```

**File**: `examples/generate_performance_report.rs` (modified, +4/-0)
```diff
@@ -71,6 +71,8 @@ fn main() -> memvid_core::Result<()> {
                 as_of_frame: None,
                 as_of_ts: None,
                 no_sketch: false,
+                acl_context: None,
+                acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
             })?;
         }
 
@@ -94,6 +96,8 @@ fn main() -> memvid_core::Result<()> {
                 as_of_frame: None,
                 as_of_ts: None,
                 no_sketch: false,
+                acl_context: None,
+                acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
             })?;
 
             let terms: Vec<&str> = query.split_whitespace().collect();
```

**File**: `examples/pdf_ingestion.rs` (modified, +2/-0)
```diff
@@ -112,6 +112,8 @@ fn main() -> Result<()> {
             as_of_frame: None,
             as_of_ts: None,
             no_sketch: false,
+            acl_context: None,
+            acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
         };
 
         let response = mem.search(request)?;
```

**File**: `examples/test_implicit_or_bug.rs` (modified, +2/-0)
```diff
@@ -53,6 +53,8 @@ fn main() -> memvid_core::Result<()> {
         as_of_frame: None,
         as_of_ts: None,
         no_sketch: false,
+        acl_context: None,
+        acl_enforcement_mode: memvid_core::types::AclEnforcementMode::Audit,
     })?;
 
     println!("ACTUAL RESULTS: {} documents found", results.hits.len());
```

**File**: `src/graph_search.rs` (modified, +4/-0)
```diff
@@ -327,6 +327,8 @@ pub fn hybrid_search(memvid: &mut Memvid, plan: &QueryPlan) -> Result<Vec<Hybrid
                 as_of_frame: None,
                 as_of_ts: None,
                 no_sketch: false,
+                acl_context: None,
+                acl_enforcement_mode: crate::types::AclEnforcementMode::Audit,
             };
             let response = memvid.search(request)?;
             Ok(response
@@ -391,6 +393,8 @@ pub fn hybrid_search(memvid: &mut Memvid, plan: &QueryPlan) -> Result<Vec<Hybrid
                     as_of_frame: None,
                     as_of_ts: None,
                     no_sketch: false,
+                    acl_context: None,
+                    acl_enforcement_mode: crate::types::AclEnforcementMode::Audit,
                 };
                 let response = memvid.search(request)?;
                 return Ok(response
```

---

### Incident Patch 12: `582556db` (2026-01-27)
**Commit Message**: Fix: run cargo fmt on clip.rs and text_embed.rs

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `src/clip.rs` (modified, +8/-3)
```diff
@@ -38,9 +38,9 @@ use crate::{MemvidError, Result, types::FrameId};
 
 #[cfg(all(feature = "clip", target_os = "macos"))]
 mod stderr_suppress {
-    use std::os::unix::io::{AsRawFd, RawFd};
     use std::fs::File;
     use std::io;
+    use std::os::unix::io::{AsRawFd, RawFd};
 
     pub struct StderrSuppressor {
         original_stderr: RawFd,
@@ -60,7 +60,10 @@ mod stderr_suppress {
                 unsafe { libc::close(original_stderr) };
                 return Err(io::Error::last_os_error());
             }
-            Ok(Self { original_stderr, dev_null })
+            Ok(Self {
+                original_stderr,
+                dev_null,
+            })
         }
     }
 
@@ -78,7 +81,9 @@ mod stderr_suppress {
 mod stderr_suppress {
     pub struct StderrSuppressor;
     impl StderrSuppressor {
-        pub fn new() -> std::io::Result<Self> { Ok(Self) }
+        pub fn new() -> std::io::Result<Self> {
+            Ok(Self)
+        }
     }
 }
 
```

**File**: `src/text_embed.rs` (modified, +1/-1)
```diff
@@ -48,9 +48,9 @@ use tokenizers::{
 
 #[cfg(target_os = "macos")]
 mod stderr_suppress {
-    use std::os::unix::io::{AsRawFd, FromRawFd, RawFd};
     use std::fs::File;
     use std::io;
+    use std::os::unix::io::{AsRawFd, FromRawFd, RawFd};
 
     pub struct StderrSuppressor {
         original_stderr: RawFd,
```

---

### Incident Patch 13: `5e5673b3` (2026-01-27)
**Commit Message**: Fix CI: move target-specific deps section after main dependencies

The [target.'cfg(target_os = "macos")'.dependencies] section was placed
in the middle of the main dependencies, causing all subsequent deps
(tantivy, wide, etc.) to be parsed as macOS-only. This made the lex
and simd features fail on Linux/Windows.

Move the target-specific section to after all main dependencies.

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `Cargo.toml` (modified, +4/-5)
```diff
@@ -56,11 +56,6 @@ same-file = "1.0"
 fs-err = "3.2"
 atomic-write-file = "0.3"
 dirs-next = "2.0"
-
-# Platform-specific: libc for stderr suppression on macOS
-[target.'cfg(target_os = "macos")'.dependencies]
-libc = "0.2"
-
 smallvec = { version = "1.13", features = ["serde", "union", "const_generics", "write"] }
 tantivy = { version = "0.25.0", optional = true, default-features = false, features = ["mmap"] }
 ort = { version = "=2.0.0-rc.10", optional = true }
@@ -97,6 +92,10 @@ space = { version = "0.17", optional = true }
 # HTTP client for API-based embedding providers (OpenAI, etc.)
 reqwest = { version = "0.12", optional = true, default-features = false, features = ["blocking", "json", "rustls-tls"] }
 
+# Platform-specific: libc for stderr suppression on macOS
+[target.'cfg(target_os = "macos")'.dependencies]
+libc = "0.2"
+
 [features]
 default = ["lex", "pdf_extract", "simd"]
 # pdf_oxide disabled - cff-parser panics on ligature fonts (uniFB01/uniFB02)
```

---

### Incident Patch 14: `cbe2f3ef` (2026-01-27)
**Commit Message**: Commit Cargo.lock for reproducible CI builds

Cargo's dependency resolution was not including tantivy and wide
on Ubuntu CI despite the lex and simd features being enabled.
This appears to be a Cargo bug or edge case with optional dependencies.

Committing Cargo.lock ensures consistent dependency resolution
across all CI runners.

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `.gitignore` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ doc.mv2
 
 /target
 **/*.rs.bk
-Cargo.lock
+# Cargo.lock - now committed for reproducible CI builds
 .idea
 
 
```

---

### Incident Patch 15: `9b7f5a62` (2026-01-27)
**Commit Message**: Fix CI: use Cargo.toml hash for cache key instead of missing Cargo.lock

The previous cache key used hashFiles('**/Cargo.lock') but Cargo.lock is
gitignored in this library repo. This caused the cache to have an empty
hash suffix, restoring stale dependencies that didn't include tantivy,
wide, and other optional deps that were added recently.

Using Cargo.toml hash ensures the cache invalidates when dependencies change.

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ jobs:
             ~/.cargo/registry/cache/
             ~/.cargo/git/db/
             target/
-          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
+          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.toml') }}
 
       - name: Build
         run: cargo build --verbose
```

#### Recent Merged Pull Requests:
- **PR #235** (closed): fix(core): use pure blake3 for cross builds (@jrepp)
- **PR #224** (closed): feat: optional Lore Context backend for cross-session memory retrieval (@zhushuanbao-dot)
- **PR #206** (2026-03-16): docs(i18n): refresh Spanish README sections (@nestorfernando3)
- **PR #200** (closed): feat: Add TIAMAT remote cloud memory backend (@toxfox69)
- **PR #193** (2026-02-07): (docs): translate README.md into Simplified Chinese #104 (@nightire)
- **PR #188** (2026-01-29): feat: enforce vector index model consistency (@0x-pankaj)
- **PR #187** (2026-01-27): feat: fix symspell_cleanup data corruption and add dictionary downloa… (@0x-pankaj)
- **PR #186** (2026-01-25): fix(tests): add Windows delay for Tantivy file handle release (@0x-pankaj)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
