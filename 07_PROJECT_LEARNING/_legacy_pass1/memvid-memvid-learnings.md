# Forensic Learning Record (Deep Inspection): memvid/memvid

> **Canonical Artifact**: `07_PROJECT_LEARNING/memvid-memvid-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/memvid/memvid](https://github.com/memvid/memvid))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:00:42.614Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `memvid/memvid`
- **Description**: Memory layer for AI Agents. Replace complex RAG pipelines with a serverless, single-file memory layer. Give your agents instant retrieval and long-term memory.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 16567 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

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
        println!("   - Has CLIP index: {}", st
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

### Core Architecture Module: `examples/openai_embedding.rs`
```
//! Example demonstrating OpenAI API embedding usage.
//!
//! This example shows how to:
//! - Create an OpenAI embedder with default configuration
//! - Generate embeddings using the API
//! - Compute cosine similarity between embeddings
//! - Use different models (small, large, ada)
//!
//! ## Prerequisites
//!
//! Set your OpenAI API key:
//! ```bash
//! export OPENAI_API_KEY="sk-..."
//! ```
//!
//! ## Run
//!
//! ```bash
//! cargo run --example openai_embedding --features api_embed
//! ```

use memvid_core::Result;

#[cfg(feature = "api_embed")]
use memvid_core::api_embed::{OpenAIConfig, OpenAIEmbedder};
#[cfg(feature = "api_embed")]
use memvid_core::types::embedding::EmbeddingProvider;

/// Compute cosine similarity between two vectors
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    assert_eq!(a.len(), b.len(), "Vectors must have same length");

    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a > 0.0 && norm_b > 0.0 {
        dot_product / (norm_a * norm_b)
    } else {
        0.0
    }
}

#[cfg(feature = "api_embed")]
fn main() -> Result<()> {
    println!("=== OpenAI Embedding Example ===\n");

    // Check if API key is set
    if std::env::var("OPENAI_API_KEY").is_err() {
        eprintln!("Error: OPENAI_API_KEY environment variable not set.");
        eprintln!("Please set it with: export OPENAI_API_KEY=\"sk-...\"");
        std::process::exit(1);
    }

    // Create embedder with default config (text-embedding-3-small, 1536 dimensions)
    println!("Creating OpenAI embedder (text-embedding-3-small)...");
    let config = OpenAIConfig::default();
    let embedder = OpenAIEmbedder::new(config)?;

    println!("Model: {}", embedder.model());
    println!("Kind: {}", embedder.kind());
    println!("Dimensions: {}", embedder.dimension());
    println!("Ready: {}\n", embedder.is_ready());

    // Example 1: Single text embedding
    println!("--- Example 1: Single Text Embedding ---");
    let text = "The quick brown fox jumps over the lazy dog";
    println!("Embedding text: \"{}\"", text);

    let embedding = embedder.embed_text(text)?;
    println!("Generated embedding of dimension {}\n", embedding.len());

    // Example 2: Semantic similarity
    println!("--- Example 2: Semantic Similarity ---");
    let text1 = "Machine learning and artificial intelligence";
    let text2 = "Deep neural networks for AI applications";
    let text3 = "The history of ancient Rome";

    let emb1 = embedder.embed_text(text1)?;
    let emb2 = embedder.embed_text(text2)?;
    let emb3 = embedder.embed_text(text3)?;

    println!("Text 1: \"{}\"", text1);
    println!("Text 2: \"{}\"", text2);
    println!("Text 3: \"{}\"", text3);
    println!();

    let sim_1_2 = cosine_similarity(&emb1, &emb2);
    let sim_1_3 = cosine_similarity(&emb1, &emb3);
    let sim_2_3 = cosine_similarity(&emb2, &emb3);

    println!("Similarity (1 ↔ 2): {:.4}", sim_1_2);
    println!("Similarity (1 ↔ 3): {:.4}", sim_1_3);
    println!("Similarity (2 ↔ 3): {:.4}", sim_2_3);

    if sim_1_2 > sim_1_3 {
        println!("\n✓ Related texts (1 & 2) have higher similarity than unrelated (1 & 3)!");
    }
    println!();

    // Example 3: Batch processing
    println!("--- Example 3: Batch Processing ---");
    let documents = vec![
        "Python programming language",
        "JavaScript web development",
        "Rust systems programming",
        "Italian cooking recipes",
    ];

    println!("Processing {} documents in batch...", documents.len());
    let batch_embeddings = embedder.embed_batch(&documents)?;
    println!(
        "✓ Generated {} embeddings of dimension {}\n",
        batch_embeddings.len(),
        batch_embeddings.first().map(|e| e.len()).unwrap_or(0)
    );

    // Find most similar pair
    let mut max_sim = 0.0;
    let mut max_pair = (0, 0);

    for i in 0..batch_embeddings.len() {
        for j in (i + 1)..batch_embeddings.len() {
            let sim = cosine_similarity(&batch_embeddings[i], &batch_embeddings[j]);
            if sim > max_sim {
                max_sim = sim;
                max_pair = (i, j);
            }
        }
    }

    println!("Most similar pair (similarity: {:.4}):", max_sim);
    println!("  [{}] \"{}\"", max_pair.0, documents[max_pair.0]);
    println!("  [{}] \"{}\"\n", max_pair.1, documents[max_pair.1]);

    // Example 4: Available models
    println!("--- Example 4: Available Models ---");
    println!("OpenAI embedding models:");
    println!("  - text-embedding-3-small (1536d) - Default, fastest, cheapest");
    println!("  - text-embedding-3-large (3072d) - Highest quality");
    println!("  - text-embedding-ada-002 (1536d) - Legacy model");
    println!();
    println!("To use a different model:");
    println!("  let config = OpenAIConfig::large();");
    println!("  let embedder = OpenAIEmbedder::new(config)?;");
    println!();

    println!("=== Example Complete ===");
    println!("\nKey takeaways:");
    println!("✓ API embeddings require OPENAI_API_KEY environment variable");
    println!("✓ text-embedding-3-small is fast and cost-effective");
    println!("✓ Batch processing reduces API calls for multiple texts");
    println!("✓ Similar texts have higher cosine similarity scores");

    Ok(())
}

#[cfg(not(feature = "api_embed"))]
fn main() {
    eprintln!("This example requires the 'api_embed' feature.");
    eprintln!("Run with: cargo run --example openai_embedding --features api_embed");
    std::process::exit(1);
}

```

### Core Architecture Module: `examples/pdf_ingestion.rs`
```
//! PDF ingestion example demonstrating how to ingest and search PDF documents.
//!
//! This example demonstrates PDF text extraction, chunking, and semantic search.
//!
//! Run with:
//! ```bash
//! cargo run --example pdf_ingestion -- /path/to/pdf
//! ```

use std::env;
use std::path::PathBuf;
use tempfile::tempdir;

use memvid_core::{Memvid, PutOptions, Result, SearchRequest};

fn main() -> Result<()> {
    // Get PDF path from args
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: cargo run --example pdf_ingestion -- /path/to/pdf");
        eprintln!("\nExample:");
        eprintln!("  cargo run --example pdf_ingestion -- examples/1706.03762v7.pdf");
        return Ok(());
    }

    let pdf_path = PathBuf::from(&args[1]);

    if !pdf_path.exists() {
        eprintln!("ERROR: PDF file not found at {:?}", pdf_path);
        eprintln!("Usage: cargo run --example pdf_ingestion -- /path/to/pdf");
        return Ok(());
    }

    // Create a temporary directory for our memory file
    let dir = tempdir().expect("failed to create temp dir");
    let mv2_path: PathBuf = dir.path().join("paper.mv2");

    println!("=== Memvid PDF Ingestion Example ===\n");

    // ========================================
    // 1. CREATE a new memory file
    // ========================================
    println!("1. Creating memory file...");
    let mut mem = Memvid::create(&mv2_path)?;
    println!("   Memory created at {:?}\n", mv2_path);

    // ========================================
    // 2. INGEST the PDF file
    // ========================================
    println!("2. Ingesting PDF: {:?}", pdf_path);

    // Read the PDF file
    let pdf_bytes = std::fs::read(&pdf_path)?;
    println!("   PDF size: {} bytes", pdf_bytes.len());

    // Put the PDF with metadata
    // Extract filename for title
    let title = pdf_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("PDF Document")
        .to_string();

    let options = PutOptions::builder()
        .title(&title)
        .uri(format!(
            "mv2://pdfs/{}",
            pdf_path.file_name().unwrap_or_default().to_string_lossy()
        ))
        .build();

    let frame_id = mem.put_bytes_with_options(&pdf_bytes, options)?;
    println!("   Ingested as frame: {}", frame_id);

    // Commit changes
    mem.commit()?;
    println!("   Committed successfully!\n");

    // ========================================
    // 3. CHECK memory statistics
    // ========================================
    println!("3. Memory statistics:");
    let stats = mem.stats()?;
    println!("   Frame count: {}", stats.frame_count);
    println!("   Has lexical index: {}", stats.has_lex_index);
    println!();

    // ========================================
    // 4. SEARCH the ingested PDF
    // ========================================
    println!("4. Searching the paper...\n");

    // Search for "attention"
    let queries = [
        "attention mechanism",
        "transformer architecture",
        "self-attention",
        "encoder decoder",
        "positional encoding",
    ];

    for query in queries {
        let request = SearchRequest {
            query: query.to_string(),
            top_k: 3,
            snippet_chars: 150,
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
        println!("   Query: '{}'", query);
        println!(
            "   Hits: {} ({}ms)",
            response.total_hits, response.elapsed_ms
        );

        for (i, hit) in response.hits.iter().take(2).enumerate() {
            let snippet = hit
                .text
                .chars()
                .take(100)
                .collect::<String>()
                .replace('\n', " ");
            println!("   {}. {}...", i + 1, snippet);
        }
        println!();
    }

    // ========================================
    // 5. VERIFY file integrity
    // ========================================
    println!("5. Verifying file integrity...");
    drop(mem);
    let report = Memvid::verify(&mv2_path, false)?;
    println!("   Status: {:?}", report.overall_status);
    println!();

    println!("=== PDF ingestion example completed! ===");

    Ok(())
}

```

### Core Architecture Module: `examples/simd_benchmark.rs`
```
//! Benchmark comparing SIMD vs Scalar L2 distance calculations.
//!
//! Run with: `cargo run --example simd_benchmark --features simd --release`

use std::hint::black_box;
use std::time::Instant;

fn main() {
    let num_vectors = 10_000;
    let dims = 384; // Standard embedding dimension
    let num_iterations = 100;

    println!("SIMD vs Scalar L2 Distance Benchmark");
    println!("=====================================");
    println!("Vectors: {}", num_vectors);
    println!("Dimensions: {}", dims);
    println!("Iterations: {}", num_iterations);
    println!();

    // Generate random vectors
    let query: Vec<f32> = (0..dims).map(|i| (i as f32 * 0.001) % 1.0).collect();
    let vectors: Vec<Vec<f32>> = (0..num_vectors)
        .map(|v| (0..dims).map(|i| ((v + i) as f32 * 0.0017) % 1.0).collect())
        .collect();

    // Benchmark SIMD version
    let simd_start = Instant::now();
    let mut simd_sum = 0.0f32;
    for _ in 0..num_iterations {
        for vec in &vectors {
            simd_sum += black_box(l2_distance_simd(black_box(&query), black_box(vec)));
        }
    }
    let simd_elapsed = simd_start.elapsed();
    black_box(simd_sum);

    // Benchmark Scalar version
    let scalar_start = Instant::now();
    let mut scalar_sum = 0.0f32;
    for _ in 0..num_iterations {
        for vec in &vectors {
            scalar_sum += black_box(l2_distance_scalar(black_box(&query), black_box(vec)));
        }
    }
    let scalar_elapsed = scalar_start.elapsed();
    black_box(scalar_sum);

    // Results
    let total_ops = num_vectors * num_iterations;
    let simd_per_op_ns = simd_elapsed.as_nanos() as f64 / total_ops as f64;
    let scalar_per_op_ns = scalar_elapsed.as_nanos() as f64 / total_ops as f64;
    let speedup = scalar_elapsed.as_nanos() as f64 / simd_elapsed.as_nanos() as f64;

    println!("Results:");
    println!("--------");
    println!(
        "SIMD:   {:>8.2}ms total, {:>6.1}ns per distance",
        simd_elapsed.as_secs_f64() * 1000.0,
        simd_per_op_ns
    );
    println!(
        "Scalar: {:>8.2}ms total, {:>6.1}ns per distance",
        scalar_elapsed.as_secs_f64() * 1000.0,
        scalar_per_op_ns
    );
    println!();
    println!("Speedup: {:.2}x", speedup);

    // Verify correctness
    let simd_result = l2_distance_simd(&query, &vectors[0]);
    let scalar_result = l2_distance_scalar(&query, &vectors[0]);
    let diff = (simd_result - scalar_result).abs();
    println!();
    println!("Correctness check:");
    println!("  SIMD result:   {:.8}", simd_result);
    println!("  Scalar result: {:.8}", scalar_result);
    println!("  Difference:    {:.2e} (should be < 1e-5)", diff);
    assert!(diff < 1e-4, "Results differ too much!");
    println!("  ✓ Results match!");
}

/// SIMD L2 distance using the wide crate
#[cfg(feature = "simd")]
fn l2_distance_simd(a: &[f32], b: &[f32]) -> f32 {
    memvid_core::simd::l2_distance_simd(a, b)
}

#[cfg(not(feature = "simd"))]
fn l2_distance_simd(a: &[f32], b: &[f32]) -> f32 {
    l2_distance_scalar(a, b)
}

/// Scalar L2 distance (the OLD implementation)
#[inline(never)]
fn l2_distance_scalar(a: &[f32], b: &[f32]) -> f32 {
    a.iter()
        .zip(b.iter())
        .map(|(x, y)| (x - y).powi(2))
        .sum::<f32>()
        .sqrt()
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
@@ -286,7 +299,10 @@ fn search_arden(
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
