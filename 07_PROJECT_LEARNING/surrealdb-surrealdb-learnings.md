> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/surrealdb-surrealdb-learnings.md`  
> **Source**: github ([https://github.com/surrealdb/surrealdb](https://github.com/surrealdb/surrealdb))  
> **Source Version**: `18971ffb`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T05:45:38.537Z  
> **Learning ID**: `learn-github-surrealdb-surrealdb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): surrealdb/surrealdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/surrealdb-surrealdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/surrealdb/surrealdb](https://github.com/surrealdb/surrealdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T05:45:38.529Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `surrealdb/surrealdb`
- **Description**: A scalable, distributed, collaborative, document-graph database, for the realtime web
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 33203 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `surrealdb/common/src/error/source/render/char_buffer.rs`
```
use std::fmt::{Arguments, Write};
use std::io;

#[derive(Clone, Copy, Eq, PartialEq, Hash, Default, Debug)]
pub enum Color {
	#[default]
	Default,
	Red,
	Green,
	Blue,
	Yellow,
}

#[derive(Clone, Copy, Eq, PartialEq, Hash, Default, Debug)]
pub enum Styling {
	#[default]
	Plain,
	Italic,
	Bold,
	BoldItalic,
}

#[derive(Clone, Copy, Eq, PartialEq, Hash, Default, Debug)]
pub struct DisplayChar {
	pub color: Color,
	pub style: Styling,
	pub char: char,
}

/// A buffer of styled characters.
///
/// Can be written into and displayed, both styled and unstyled as required.
pub struct CharBuffer {
	lines: Vec<Vec<DisplayChar>>,
}

impl Default for CharBuffer {
	fn default() -> Self {
		CharBuffer::new()
	}
}

impl CharBuffer {
	/// Create a new char buffer.
	pub fn new() -> Self {
		CharBuffer {
			lines: vec![Vec::new()],
		}
	}

	/// Create a char buffer which just contains the contents of the given string, without styling.
	pub fn from_plain_string(str: &str) -> Self {
		let mut res = Self::new();
		res.push_str(str, Default::default(), Default::default());
		res
	}

	/// Add a string to the end of the buffer with the given styling.
	pub fn push_str(&mut self, s: &str, color: Color, style: Styling) {
		for c in s.chars() {
			self.push_char(c, color, style);
		}
	}

	//Add a character to the end of the buffer with the given styling.
	pub fn push_char(&mut self, c: char, color: Color, style: Styling) {
		if c == '\n' {
			self.lines.push(Vec::new());
			return;
		}

		let Some(last) = self.lines.last_mut() else {
			unreachable!()
		};
		last.push(DisplayChar {
			color,
			style,
			char: c,
		});
	}

	/// Create a writer for pushing strings into the char buffer.
	pub fn writer<'a>(&'a mut self) -> CharBufferWriter<'a> {
		CharBufferWriter {
			indent: 0,
			color: Default::default(),
			style: Default::default(),
			buffer: self,
		}
	}

	/// Convert the char buffer to a plain string.
	pub fn write_to_string(&self) -> String {
		let mut res = String::new();
		for l in self.lines.iter() {
			for c in l.iter() {
				res.push(c.char);
			}
			res.push('\n');
		}
		res
	}

	/// Write the string to a writer, with all ansii styling.
	pub fn write_styled<W>(&self, out: &mut W) -> io::Result<()>
	where
		W: io::Write,
	{
		let mut color = Color::default();
		let mut style = Styling::default();
		let mut encode_buffer = [0u8; 4];
		for l in self.lines.iter() {
			for c in l.iter() {
				if c.char.is_whitespace() {
					out.write_all(c.char.encode_utf8(&mut encode_buffer).as_bytes())?;
					continue;
				}

				if c.color != color {
					match c.color {
						Color::Default => {
							out.write_all(b"\x1b[m")?;
							style = Styling::Plain;
						}
						Color::Red => {
							out.write_all(b"\x1b[31m")?;
						}
						Color::Green => {
							out.write_all(b"\x1b[32m")?;
						}
						Color::Yellow => {
							out.write_all(b"\x1b[33m")?;
						}
						Color::Blue => {
							out.write_all(b"\x1b[34m")?;
						}
					}
					color = c.color;
				}

				match (style, c.style) {
					(Styling::Plain, Styling::Bold) => {
						out.write_all(b"\x1b[1m")?;
					}
					(Styling::Plain, Styling::BoldItalic) => {
						out.write_all(b"\x1b[1m")?;
						out.write_all(b"\x1b[3m")?;
					}
					(Styling::Plain, Styling::Italic) => {
						out.write_all(b"\x1b[3m")?;
					}
					(Styling::Italic, Styling::Plain) => {
						out.write_all(b"\x1b[23m")?;
					}
					(Styling::Italic, Styling::Bold) => {
						out.write_all(b"\x1b[23m")?;
						out.write_all(b"\x1b[1m")?;
					}
					(Styling::Italic, Styling::BoldItalic) => {
						out.write_all(b"\x1b[1m")?;
					}
					(Styling::Bold, Styling::Plain) => {
						out.write_all(b"\x1b[22m")?;
					}
					(Styling::Bold, Styling::Italic) => {
						out.write_all(b"\x1b[22m")?;
						out.write_all(b"\x1b[3m")?;
					}
					(Styling::Bold, Styling::BoldItalic) => {
						out.write_all(b"\x1b[3m")?;
					}
					(Styling::BoldItalic, Styling::Plain) => {
						out.write_all(b"\x1b[22m")?;
						out.write_all(b"\x1b[23m")?;
					}
					(Styling::BoldItalic, Styling::Italic) => {
						out.write_all(b"\x1b[22m")?;
					}
					(Styling::BoldItalic, Styling::Bold) => {
						out.write_all(b"\x1b[23m")?;
					}
					_ => {}
				}
				style = c.style;

				out.write_all(c.char.encode_utf8(&mut encode_buffer).as_bytes())?;
			}
			out.write_all(b"\n")?;
		}
		out.write_all(b"\x1b[m\x1b[22m\x1b[23m")?;
		Ok(())
	}
}

pub struct CharBufferWriter<'a> {
	color: Color,
	style: Styling,
	indent: usize,
	buffer: &'a mut CharBuffer,
}

impl<'a> CharBufferWriter<'a> {
	/// Set the color of text tfor the writer.
	pub fn color(&mut self, c: Color) -> &mut Self {
		self.color = c;
		self
	}

	/// Set the style of text tfor the writer.
	pub fn style(&mut self, style: Styling) -> &mut Self {
		self.style = style;
		self
	}

	/// Set the indentation for the text for the writer.
	pub fn indent(&mut self, indent: usize) -> &mut Self {
		self.indent = indent;
		self
	}

	/// Push a formatting args into the writer, unlike `write_fmt` this doesn't return an `Result`.
	pub fn push_fmt(&mut self, args: Arguments) -> &mut Self {
		self.write_fmt(args).expect("writing into a char buffer cannot fail");
		self
	}

	/// Push a string into the writer, unlike `write_str` this doesn't return an `Result`.
	pub fn push_str(&mut self, s: &str) -> &mut Self {
		for (idx, s) in s.split("\n").enumerate() {
			if idx != 0 {
				self.buffer.push_char('\n', self.color, self.style);
			}
			if s.is_empty() {
				continue;
			}

			let Some(last) = self.buffer.lines.last() else {
				unreachable!()
			};

			if last.is_empty() {
				for _ in 0..self.indent {
					self.buffer.push_char(' ', self.color, self.style);
				}
			}
			self.buffer.push_str(s, self.color, self.style);
		}
		self
	}

	/// Push a string into the writer, unlike `write_str` this doesn't return an `Result`.
	pub fn push_char(&mut self, c: char) -> &mut Self {
		if c == '\n' {
			self.buffer.push_char(c, self.color, self.style);
		} else {
			let Some(last) = self.buffer.lines.last() else {
				unreachable!()
			};

			if last.is_empty() {
				for _ in 0..self.indent {
					self.buffer.push_char(' ', self.color, self.style);
				}
			}
			self.buffer.push_char(c, self.color, self.style);
		}
		self
	}
}

impl Write for CharBufferWriter<'_> {
	fn write_str(&mut self, s: &str) -> std::fmt::Result {
		self.push_str(s);
		Ok(())
	}
}

```

### Core Architecture Module: `surrealdb/common/src/error/source/render/format.rs`
```
use super::char_buffer::{CharBuffer, Color, Styling};
use crate::error::source::{AnnotationKind, Diagnostic, Level, Snippet};

#[derive(Clone, Copy, Eq, PartialEq, Ord, PartialOrd, Debug)]
pub struct Loc {
	pub line: usize,
	pub column: usize,
}

impl Loc {
	pub fn from_offset_in_str(s: &str, offset: usize) -> Self {
		let mut line = 0;
		let mut start_line = 0;
		for (idx, _) in s.match_indices("\n") {
			line += 1;
			if offset <= idx {
				line -= 1;
				break;
			}
			start_line = idx + 1;
		}

		let mut col = 0;
		for (i, c) in s[start_line..].char_indices() {
			// Handle tab length.
			col += if c == '\t' {
				4
			} else {
				1
			};
			if offset - start_line <= i {
				col -= 1;
				break;
			}
		}

		Loc {
			line,
			column: col,
		}
	}
}

pub fn render_string(g: &Diagnostic<'_>) -> String {
	render_char_buffer(g).write_to_string()
}

pub fn render_char_buffer(g: &Diagnostic<'_>) -> CharBuffer {
	let primary_group = g.groups.first().expect("Diagnostic must atleast have a single group");

	let mut buffer = CharBuffer::new();

	let color = match primary_group.level {
		Level::Error => Color::Red,
		Level::Warning => Color::Yellow,
	};

	buffer
		.writer()
		.color(color)
		.style(Styling::Bold)
		.push_str("Error")
		.color(Color::Default)
		.style(Styling::Bold)
		.push_str(": ")
		.push_str(primary_group.title.as_ref())
		.push_str("\n");

	for e in primary_group.elements.iter() {
		render_element(&mut buffer, e, color);
	}

	buffer
}

fn render_element(buf: &mut CharBuffer, elem: &Snippet, line_color: Color) {
	let Some(source) = elem.source.as_ref() else {
		return;
	};

	let largest_offset =
		elem.annotations.iter().map(|x| x.span.end as usize).max().unwrap_or_default();

	let largest_loc = Loc::from_offset_in_str(source, largest_offset);
	let line_number_char_n = (largest_loc.line + 1).ilog10() + 1;
	let line_n_indent = line_number_char_n as usize + 1;

	let Some(prime) = elem.annotations.iter().find(|e| e.kind == AnnotationKind::Primary) else {
		return;
	};

	let prime_loc = Loc::from_offset_in_str(source, prime.span.start as usize);

	let mut anns = elem
		.annotations
		.iter()
		.map(|x| {
			(
				x,
				Loc::from_offset_in_str(source, x.span.start as usize),
				Loc::from_offset_in_str(source, x.span.end as usize),
			)
		})
		.collect::<Vec<_>>();

	anns.sort_unstable_by(|a, b| a.1.line.cmp(&b.1.line).then_with(|| a.0.kind.cmp(&b.0.kind)));

	buf.writer()
		.indent(line_n_indent)
		.color(line_color)
		.push_str("|>")
		.color(Color::Default)
		.push_fmt(format_args!(
			" {}:{}:{}\n",
			elem.origin.as_ref().unwrap_or("???"),
			prime_loc.line + 1,
			prime_loc.column + 1
		))
		.color(line_color)
		.push_str("|\n");

	let mut last_line = None;
	for (ann, start, end) in anns {
		if let Some(last_line) = last_line
			&& last_line != start.line
			&& last_line + 1 != start.line
		{
			buf.writer()
				.indent(line_n_indent)
				.color(line_color)
				.push_str("| ")
				.color(Color::Default)
				.push_str("...\n");
		}

		let line_n = start.line + 1;
		let line_char_n = line_n.ilog10() + 1;
		for _ in 0..(line_n_indent as u32 - line_char_n - 1) {
			buf.writer().push_str(" ");
		}

		let line = source.lines().nth(start.line).unwrap_or("INVALID LINE");

		let mut writer = buf.writer();
		writer
			.push_fmt(format_args!("{line_n} "))
			.color(line_color)
			.push_str("| ")
			.color(Color::Default);

		for c in line.chars() {
			if c == '\t' {
				// Tabs are replaced with 4 spaces to ensure consistent formatting.
				writer.push_char(' ');
				writer.push_char(' ');
				writer.push_char(' ');
				writer.push_char(' ');
			} else {
				writer.push_char(c);
			}
		}

		buf.writer().indent(line_n_indent).color(line_color).push_str("\n| ");

		for _ in 0..start.column {
			buf.writer().push_str(" ");
		}

		let underline_color = if AnnotationKind::Primary == ann.kind {
			line_color
		} else {
			Color::Blue
		};

		let underline_char = if AnnotationKind::Primary == ann.kind {
			"^"
		} else {
			"-"
		};

		if end.line == start.line {
			for _ in 0..end.column.saturating_sub(start.column).max(1) {
				buf.writer().color(underline_color).push_str(underline_char);
			}
			buf.writer().color(underline_color).push_str(" ");
		} else {
			buf.writer().color(underline_color).push_str(underline_char).push_str("... ");
		}
		if let Some(x) = ann.label.as_ref() {
			buf.writer().style(Styling::Italic).push_str(x);
		}
		buf.writer().push_str("\n");

		last_line = Some(start.line)
	}
}

```

### Core Architecture Module: `surrealdb/common/src/error/source/render/mod.rs`
```
use super::Diagnostic;

mod char_buffer;
mod format;

pub use char_buffer::CharBuffer;

impl Diagnostic<'_> {
	pub fn render_string(&self) -> String {
		format::render_string(self)
	}

	pub fn render_char_buffer(&self) -> CharBuffer {
		format::render_char_buffer(self)
	}
}

```

### Core Architecture Module: `surrealdb/core/benches/allocator.rs`
```
#![allow(clippy::unwrap_used)]
//! Comprehensive benchmark for allocation tracking strategies
//!
//! This benchmark compares three different implementations:
//! 1. AtomicAllocator - Simple global atomic counter (baseline)
//! 2. PerThreadAllocator - Per-thread nodes with parking_lot::Mutex
//! 3. LockFreeAllocator - Lock-free with batched updates
//!
//! Benchmark scenarios:
//! - Single-threaded: Sequential alloc/dealloc operations
//! - Multi-threaded: Scalability with 1-256 threads
//! - Usage queries: Query latency with 1-1000 active threads
//! - High contention: 128 threads allocating simultaneously
//! - Mixed workload: Concurrent allocations + usage queries

use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::{Cell, RefCell};
use std::hint::black_box;
use std::ptr::null_mut;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicPtr, AtomicUsize, Ordering};
use std::time::Duration;

use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};
use parking_lot::Mutex;
use rayon::iter::{IntoParallelIterator, ParallelIterator};

/// Trait for benchmarking different allocator tracking strategies
trait BenchAllocator: Send + Sync {
	fn alloc(&self, size: usize);
	fn dealloc(&self, size: usize);
	fn current_usage(&self) -> usize;
}

// ============================================================================
// Implementation 0: No-Op Allocator (Baseline)
// ============================================================================

struct NoOpAllocator;

impl NoOpAllocator {
	fn new() -> Self {
		Self
	}
}

impl BenchAllocator for NoOpAllocator {
	#[inline(always)]
	fn alloc(&self, _size: usize) {
		// No-op: measure cost of just the function call
	}

	#[inline(always)]
	fn dealloc(&self, _size: usize) {
		// No-op: measure cost of just the function call
	}

	fn current_usage(&self) -> usize {
		0
	}
}

// ============================================================================
// Implementation 1: Simple Atomic Counter
// ============================================================================

struct AtomicAllocator {
	total_bytes: AtomicUsize,
}

impl AtomicAllocator {
	fn new() -> Self {
		Self {
			total_bytes: AtomicUsize::new(0),
		}
	}
}

impl BenchAllocator for AtomicAllocator {
	#[inline(always)]
	fn alloc(&self, size: usize) {
		self.total_bytes.fetch_add(size, Ordering::Relaxed);
	}

	#[inline(always)]
	fn dealloc(&self, size: usize) {
		self.total_bytes.fetch_sub(size, Ordering::Relaxed);
	}

	fn current_usage(&self) -> usize {
		self.total_bytes.load(Ordering::Relaxed)
	}
}

// ============================================================================
// Implementation 2: Per-Thread Counter with Global Linked List
// ============================================================================

struct ThreadCounterNode {
	next: AtomicPtr<ThreadCounterNode>,
	counter: AtomicUsize,
}

struct PerThreadAllocator {
	node_layout: Layout,
	global_list_head: AtomicPtr<ThreadCounterNode>,
	global_list_lock: Mutex<()>,
}

impl PerThreadAllocator {
	fn new() -> Self {
		Self {
			node_layout: Layout::new::<ThreadCounterNode>(),
			global_list_head: AtomicPtr::new(null_mut()),
			global_list_lock: Mutex::new(()),
		}
	}

	fn get_thread_node(&self) -> *mut ThreadCounterNode {
		thread_local! {
			static THREAD_NODE: RefCell<*mut ThreadCounterNode> = const { RefCell::new(null_mut()) };
		}

		THREAD_NODE.with(|cell| {
			let mut node_ptr = *cell.borrow();
			if node_ptr.is_null() {
				// Allocate a new node for this thread
				let node_raw = unsafe { System.alloc(self.node_layout) } as *mut ThreadCounterNode;
				if node_raw.is_null() {
					panic!("Failed to allocate ThreadCounterNode");
				}

				// Initialize the newly allocated memory
				unsafe {
					node_raw.write(ThreadCounterNode {
						next: AtomicPtr::new(null_mut()),
						counter: AtomicUsize::new(0),
					});
				}

				// Insert this thread's node into the global list
				{
					let _guard = self.global_list_lock.lock();
					let head = self.global_list_head.load(Ordering::Relaxed);
					unsafe {
						(*node_raw).next.store(head, Ordering::Relaxed);
					}
					self.global_list_head.store(node_raw, Ordering::Relaxed);
				}

				*cell.borrow_mut() = node_raw;
				node_ptr = node_raw;
			}
			node_ptr
		})
	}
}

impl BenchAllocator for PerThreadAllocator {
	#[inline(always)]
	fn alloc(&self, size: usize) {
		let node = self.get_thread_node();
		unsafe {
			(*node).counter.fetch_add(size, Ordering::Relaxed);
		}
	}

	#[inline(always)]
	fn dealloc(&self, size: usize) {
		let node = self.get_thread_node();
		unsafe {
			(*node).counter.fetch_sub(size, Ordering::Relaxed);
		}
	}

	fn current_usage(&self) -> usize {
		let mut total = 0;

		let _guard = self.global_list_lock.lock();
		let mut current = self.global_list_head.load(Ordering::Relaxed);

		while !current.is_null() {
			unsafe {
				total += (*current).counter.load(Ordering::Relaxed);
				current = (*current).next.load(Ordering::Relaxed);
			}
		}

		total
	}
}

// ============================================================================
// Implementation 3: Lock-Free Batched Tracking (matches actual TrackAlloc)
// ============================================================================

/// Batch threshold - flush to global every 12KB of delta
const BATCH_THRESHOLD: i64 = 12 * 1024;

/// Per-thread state for batched updates
struct LockFreeThreadState {
	local_bytes: Cell<i64>,
	global_bytes: Cell<*const AtomicI64>,
}

impl LockFreeThreadState {
	const fn new() -> Self {
		Self {
			local_bytes: Cell::new(0),
			global_bytes: Cell::new(std::ptr::null()),
		}
	}

	fn flush_to_global(&self) {
		let delta = self.local_bytes.get();
		if delta != 0 {
			let global_ptr = self.global_bytes.get();
			if !global_ptr.is_null() {
				unsafe {
					(*global_ptr).fetch_add(delta, Ordering::Relaxed);
				}
			}
			self.local_bytes.set(0);
		}
	}
}

struct LockFreeAllocator {
	global_total_bytes: AtomicI64,
}

impl LockFreeAllocator {
	fn new() -> Arc<Self> {
		Arc::new(Self {
			global_total_bytes: AtomicI64::new(0),
		})
	}

	// Mirrors the actual TrackAlloc::add() implementation
	#[inline(always)]
	fn add(&self, size: usize) {
		thread_local! {
			static THREAD_STATE: LockFreeThreadState = const { LockFreeThreadState::new() };
			static RECURSION_DEPTH: Cell<u32> = const { Cell::new(0) };
		}

		const MAX_DEPTH: u32 = 3;

		let depth = RECURSION_DEPTH.with(|d| {
			let current = d.get();
			if current >= MAX_DEPTH {
				return MAX_DEPTH;
			}
			d.set(current + 1);
			current
		});

		if depth >= MAX_DEPTH {
			return;
		}

		let global_ptr = &self.global_total_bytes as *const AtomicI64;
		THREAD_STATE.with(|state| {
			// Initialize pointer on first use
			if state.global_bytes.get().is_null() {
				state.global_bytes.set(global_ptr);
			}

			let bytes = state.local_bytes.get() + size as i64;
			state.local_bytes.set(bytes);
			if bytes >= BATCH_THRESHOLD {
				state.flush_to_global();
			}
		});

		RECURSION_DEPTH.with(|d| d.set(d.get().saturating_sub(1)));
	}

	// Mirrors the actual TrackAlloc::sub() implementation
	#[inline(always)]
	fn sub(&self, size: usize) {
		thread_local! {
			static THREAD_STATE: LockFreeThreadState = const { LockFreeThreadState::new() };
			static RECURSION_DEPTH: Cell<u32> = const { Cell::new(0) };
		}

		const MAX_DEPTH: u32 = 3;

		let depth = RECURSION_DEPTH.with(|d| {
			let current = d.get();
			if current >= MAX_DEPTH {
				return MAX_DEPTH;
			}
			d.set(current + 1);
			current
		});

		if depth >= MAX_DEPTH {
			return;
		}

		let global_ptr = &self.global_total_bytes as *const AtomicI64;
		THREAD_STATE.with(|state| {
			// Initialize pointer on first use
			if state.global_bytes.get().is_null() {
				state.global_bytes.set(global_ptr);
			}

			let bytes = state.local_bytes.get() - size as i64;
			state.local_bytes.set(bytes);
			if bytes <= -BATCH_THRESHOLD {
				state.flush_to_global();
			}
		});

		RECURSION_DEPTH.with(|d| d.set(d.get().saturating_sub(1)));
	}
}

impl BenchAllocator for LockFreeAllocator {
	#[inline(always)]
	fn alloc(&self, size: usize) {
		self.add(size);
	}

	#[inline(always)]
	fn dealloc(&self, size: usize) {
		self.sub(size);
	}

	fn current_usage(&self) -> usize {
		self.global_total_bytes.load(Ordering::Relaxed).max(0) as usize
	}
}

// ============================================================================
// Benchmark 1: Single-threaded Performance
// ============================================================================

fn bench_single_threaded(c: &mut Criterion) {
	let mut group = c.benchmark_group("single_threaded");
	group.throughput(Throughput::Elements(1_000_000));

	group.bench_function("noop_alloc_dealloc", |b| {
		let allocator = NoOpAllocator::new();
		b.iter(|| {
			for i in 0..1_000_000 {
				allocator.alloc(black_box(i % 1024));
				allocator.dealloc(black_box(i % 1024));
			}
		});
	});

	group.bench_function("atomic_alloc_dealloc", |b| {
		let allocator = AtomicAllocator::new();
		b.iter(|| {
			for i in 0..1_000_000 {
				allocator.alloc(black_box(i % 1024));
				allocator.dealloc(black_box(i % 1024));
			}
		});
	});

	group.bench_function("perthread_alloc_dealloc", |b| {
		let allocator = PerThreadAllocator::new();
		b.iter(|| {
			for i in 0..1_000_000 {
				allocator.alloc(black_box(i % 1024));
				allocator.dealloc(black_box(i % 1024));
			}
		});
	});

	group.bench_function("lockfree_alloc_dealloc", |b| {
		let allocator = LockFreeAllocator::new();
		b.iter(|| {
			for i in 0..1_000_000 {
				allocator.alloc(black_box(i % 1024));
				allocator.dealloc(black_box(i % 1024));
			}
		});
	});

	group.finish();
}

// ============================================================================
// Benchmark 2: Multi-threaded Alloc/Dealloc
// ============================================================================

fn bench_multi_threaded(c: &mut Criterion) {
	let mut group = c.benchmark_group("multi_threaded");
	group.mea
```

### Core Architecture Module: `surrealdb/core/benches/common/mod.rs`
```
//! Common utilities for benchmarks
//!
//! This module provides shared infrastructure for all benchmark files including:

use surrealdb_core::dbs::{Capabilities, Session};
use surrealdb_core::kvs::Datastore;
use tokio::runtime::Runtime;

/// Create a new multithreaded Tokio runtime for benchmarks
pub fn create_runtime() -> Runtime {
	tokio::runtime::Builder::new_multi_thread().enable_all().build().unwrap()
}

/// Helper to run async code synchronously (for setup only)
#[allow(dead_code)]
pub fn block_on<T>(future: impl std::future::Future<Output = T>) -> T {
	create_runtime().block_on(future)
}

/// Macro for executing a benchmark query
///
/// Usage:
/// ```ignore
/// execute!(&dbs, &ses, "SELECT * FROM {table};");
/// ```
#[macro_export]
macro_rules! query {
	($dbs: expr, $ses: expr, $($fmt:tt)*) => {
		std::hint::black_box($dbs.execute(&format!($($fmt)*), $ses, None).await).unwrap()
	};
}

/// Macro for executing a benchmark query
///
/// Usage:
/// ```ignore
/// execute!(&dbs, &ses, "SELECT * FROM {table};");
/// ```
#[macro_export]
macro_rules! execute {
	($dbs: expr, $ses: expr, $($fmt:tt)*) => {
		$crate::common::block_on(async {
			std::hint::black_box($dbs.execute(&format!($($fmt)*), $ses, None).await).unwrap()
		})
	};
}

/// Macro for configuring and executing an async benchmark query
///
/// Usage:
/// ```ignore
/// bench!(group, benchmark_name, &dbs, &ses, "SELECT * FROM {table};");
/// bench!(group, benchmark_name, &dbs, &ses, throughput: 10, "SELECT * FROM table WHERE {condition};");
/// bench!(group, benchmark_name, &dbs, &ses, expected: |result| result.is_ok(), "SELECT * FROM {table};");
/// bench!(group, benchmark_name, &dbs, &ses, throughput: 10, expected: |result| result.len() == 1, "SELECT * FROM {table};");
/// ```
#[macro_export]
macro_rules! bench {
	// Variant with both `throughput` and `expected` parameters
	($group: expr, $name: ident, $dbs: expr, $ses: expr, throughput: $throughput:expr, expected: $expected:expr, $($fmt:tt)*) => {
		// Format the query
		let query = format!($($fmt)*);
		// Configure throughput for the benchmark using provided value
		$group.throughput(criterion::Throughput::Elements($throughput));
		// Benchmark the query with the given name
		$group.bench_function(stringify!($name), |b| {
			// Create a multithreaded runtime for async benchmarking
			let runtime = $crate::common::create_runtime();
			// Run an initial query for validation
			let result: surrealdb_types::Value = execute!($dbs, $ses, $($fmt)*).remove(0).result.unwrap();
			// Validate the result against the expected expression
			let check: fn(&surrealdb_types::Value) -> bool = $expected;
			assert!(check(&result), "Result did not match expected value: {result:?}");
			// Iterate over the benchmark
			b.to_async(&runtime).iter(|| async {
				std::hint::black_box($dbs.execute(&query, $ses, None).await).unwrap()
			})
		});
	};
	// Variant with only `throughput` parameter
	($group: expr, $name: ident, $dbs: expr, $ses: expr, throughput: $throughput:expr, $($fmt:tt)*) => {
		// Format the query
		let query = format!($($fmt)*);
		// Configure throughput for the benchmark using provided value
		$group.throughput(criterion::Throughput::Elements($throughput));
		// Benchmark the query with the given name
		$group.bench_function(stringify!($name), |b| {
			// Create a multithreaded runtime for async benchmarking
			let runtime = $crate::common::create_runtime();
			// Iterate over the benchmark
			b.to_async(&runtime).iter(|| async {
				std::hint::black_box($dbs.execute(&query, $ses, None).await).unwrap()
			})
		});
	};
	// Variant with only `expected` parameter
	($group: expr, $name: ident, $dbs: expr, $ses: expr, expected: $expected:expr, $($fmt:tt)*) => {
		$crate::bench!($group, $name, $dbs, $ses, throughput: 1, expected: $expected, $($fmt)*);
	};
	// Default variant: original behaviour
	($group: expr, $name: ident, $dbs: expr, $ses: expr, $($fmt:tt)*) => {
		$crate::bench!($group, $name, $dbs, $ses, throughput: 1, $($fmt)*);
	};
}

/// Helper function to setup a datastore
///
/// Usage:
/// ```ignore
/// let (dbs, ses) = setup_datastore().await;
/// ```
#[allow(dead_code)]
pub async fn setup_datastore() -> (Datastore, Session) {
	// Setup the in-memory datastore
	let dbs = Datastore::builder()
		.with_capabilities(Capabilities::all())
		.build_with_path("memory")
		.await
		.unwrap();
	// Setup a root-level datastore session
	let ses = Session::owner().with_ns("test").with_db("test");
	// Specify the test namespace and database
	dbs.execute("USE NAMESPACE test DATABASE test", &ses, None).await.unwrap();
	// Return the datastore and session
	(dbs, ses)
}

/// Helper function to setup a datastore with a query
///
/// Usage:
/// ```ignore
/// let (dbs, ses) = setup_datastore_with_query("CREATE person:tobie;").await;
/// ```
#[allow(dead_code)]
pub async fn setup_datastore_with_query(query: &str) -> (Datastore, Session) {
	// Setup the in-memory datastore
	let dbs = Datastore::builder()
		.with_capabilities(Capabilities::all())
		.build_with_path("memory")
		.await
		.unwrap();
	// Setup a root-level datastore session
	let ses = Session::owner().with_ns("test").with_db("test");
	// Specify the test namespace and database
	dbs.execute("USE NAMESPACE test DATABASE test", &ses, None).await.unwrap();
	// Load data using executor (setup phase, not benchmarked)
	dbs.execute(query, &ses, None).await.unwrap();
	// Return the datastore and session
	(dbs, ses)
}

/// Helper function to setup a datastore with fake records
///
/// Usage:
/// ```ignore
/// let (dbs, ses) = setup_datastore_with_records(100_000).await;
/// ```
#[allow(dead_code)]
pub async fn setup_datastore_with_records(count: u64) -> (Datastore, Session) {
	// Setup the in-memory datastore
	let dbs = Datastore::builder()
		.with_capabilities(Capabilities::all())
		.build_with_path("memory")
		.await
		.unwrap();
	// Enable all datastore capabilities
	// Setup a root-level datastore session
	let ses = Session::owner().with_ns("test").with_db("test");
	// Specify the test namespace and database
	dbs.execute("USE NAMESPACE test DATABASE test", &ses, None).await.unwrap();
	// Load data using executor (setup phase, not benchmarked)
	if count > 0 {
		let mut setup = String::new();
		for i in 0..count {
			setup.push_str(&format!(
				r#"CREATE item:{i} SET
					name = 'Item {i}',
					level = {},
					active = {},
					stats = {{
						score: {},
						rank: {},
						details: {{
							created: true,
							verified: {}
						}}
					}};
				"#,
				1 + (i % 100),
				i % 2 == 0,
				i % 100,
				i % 10,
				i % 3 == 0
			));
		}
		dbs.execute(&setup, &ses, None).await.unwrap();
	}
	// Return the datastore and session
	(dbs, ses)
}

```

### Core Architecture Module: `surrealdb/core/benches/executor.rs`
```
#![allow(clippy::unwrap_used)]
#![recursion_limit = "256"]

mod common;

use common::{block_on, setup_datastore, setup_datastore_with_query, setup_datastore_with_records};
use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};
use surrealdb_core::syn::value;

// ============================================================================
// Benchmark: SELECT from objects and arrays
// ============================================================================

fn bench_value_select(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("select_value");
	// Setup the datastore with no data
	let (dbs, ses) = block_on(setup_datastore());

	bench!(
		group,
		select_from_object,
		&dbs,
		&ses,
		throughput: 1,
		expected: |result| result.as_array().unwrap().len() == 1,
		"SELECT * FROM {{ id: 1, name: 'test', value: 42 }};"
	);

	bench!(
		group,
		select_from_array_small,
		&dbs,
		&ses,
		throughput: 1_000,
		expected: |result| result.as_array().unwrap().len() == 1_000,
		"SELECT * FROM [{}];",
		(1..=1_000).map(|n| n.to_string()).collect::<Vec<_>>().join(", ")
	);

	bench!(
		group,
		select_from_array_large,
		&dbs,
		&ses,
		throughput: 10_000,
		expected: |result| result.as_array().unwrap().len() == 10_000,
		"SELECT * FROM [{}];",
		(1..=10_000).map(|n| n.to_string()).collect::<Vec<_>>().join(", ")
	);

	bench!(
		group,
		select_from_array_objects_small,
		&dbs,
		&ses,
		throughput: 1_000,
		expected: |result| result.as_array().unwrap().len() == 1_000,
		"SELECT * FROM [{}];",
		(1..=1_000)
			.map(|n| format!("{{ id: {n}, name: 'item_{n}' }}"))
			.collect::<Vec<_>>()
			.join(", ")
	);

	bench!(
		group,
		select_from_array_objects_large,
		&dbs,
		&ses,
		throughput: 10_000,
		expected: |result| result.as_array().unwrap().len() == 10_000,
		"SELECT * FROM [{}];",
		(1..=10_000)
			.map(|n| format!("{{ id: {n}, name: 'item_{n}' }}"))
			.collect::<Vec<_>>()
			.join(", ")
	);

	group.finish();
}

// ============================================================================
// Benchmark: SELECT by ID
// ============================================================================

fn bench_record_select(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("select_record");
	// Setup the datastore with a query
	let (dbs, ses) = block_on(setup_datastore_with_query(
		"CREATE item:test SET name = 'Tobie', age = 30, email = 'test@example.com';",
	));

	bench!(
		group,
		select_by_id,
		&dbs,
		&ses,
		throughput: 1,
		expected: |result| result.as_array().unwrap().len() == 1,
		"SELECT * FROM item:test;"
	);

	bench!(
		group,
		select_by_id_where,
		&dbs,
		&ses,
		throughput: 1,
		expected: |result| result.as_array().unwrap().len() == 1,
		"SELECT * FROM item:test WHERE age > 25;"
	);

	bench!(
		group,
		select_by_id_projection,
		&dbs,
		&ses,
		throughput: 1,
		expected: |result| result.as_array().unwrap().len() == 1,
		"SELECT name, age FROM item:test;"
	);

	group.finish();
}

// ============================================================================
// Benchmark: SELECT from various size tables
// ============================================================================

fn bench_table_select(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("select_table_all");

	for count in [1, 10, 100, 1_000, 10_000] {
		// Configure throughput for the benchmark
		group.throughput(Throughput::Elements(count));
		// Benchmark the query with the given parameter
		group.bench_with_input(BenchmarkId::from_parameter(count), &count, |b, &cnt| {
			// Setup the datastore with the given number of records
			let (dbs, ses) = block_on(setup_datastore_with_records(cnt));
			// Create a multithreaded runtime for async benchmarking
			let runtime = common::create_runtime();
			// Run a query to ensure the correct result is returned
			let mut res = execute!(&dbs, &ses, "SELECT * FROM item;");
			// Get the length of the first result
			let len = res.remove(0).result.unwrap().as_array().unwrap().len();
			// Ensure the correct number of records were returned
			assert_eq!(len, cnt as usize, "Expected {cnt} records, got {len}");
			// Benchmark the query with the given parameter
			b.to_async(&runtime).iter(|| async { query!(&dbs, &ses, "SELECT * FROM item;") });
		});
	}

	group.finish();
}

// ============================================================================
// Benchmark: SELECT table with LIMIT
// ============================================================================

fn bench_table_select_limit(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("select_table_limit");
	// Setup the datastore with 100,000 records
	let (dbs, ses) = block_on(setup_datastore_with_records(100_000));
	// Create a multithreaded runtime for async benchmarking
	let runtime = common::create_runtime();

	for limit in [10, 100, 1000] {
		// Configure throughput for the benchmark
		group.throughput(Throughput::Elements(limit));
		// Benchmark the query with the given parameter
		group.bench_with_input(BenchmarkId::new("limit", limit), &limit, |b, _| {
			b.to_async(&runtime)
				.iter(|| async { query!(&dbs, &ses, "SELECT * FROM item LIMIT {limit};") });
		});
	}

	group.finish();
}

// ============================================================================
// Benchmark: SELECT table with START
// ============================================================================

fn bench_table_select_start(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("select_table_start");
	// Setup the datastore with 100,000 records
	let (dbs, ses) = block_on(setup_datastore_with_records(100_000));
	// Create a multithreaded runtime for async benchmarking
	let runtime = common::create_runtime();

	for start in [100, 5_000, 10_000] {
		// Configure throughput for the benchmark
		group.throughput(Throughput::Elements(100));
		// Benchmark the query with the given parameter
		group.bench_with_input(BenchmarkId::new("start", start), &start, |b, _| {
			b.to_async(&runtime).iter(|| async {
				query!(&dbs, &ses, "SELECT * FROM item START {start} LIMIT 100;")
			})
		});
	}

	group.finish();
}

// ============================================================================
// Benchmark: SELECT table with START and LIMIT
// ============================================================================

fn bench_table_select_start_limit(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("select_table_start_limit");
	// Setup the datastore with 100,000 records
	let (dbs, ses) = block_on(setup_datastore_with_records(100_000));
	// Create a multithreaded runtime for async benchmarking
	let runtime = common::create_runtime();

	for start in [100, 5_000, 10_000] {
		for limit in [10, 100, 1000] {
			// Configure throughput for the benchmark
			group.throughput(Throughput::Elements(limit));
			// Benchmark the query with the given parameter
			group.bench_with_input(
				BenchmarkId::new("start+limit", format!("{start}+{limit}")),
				&(start, limit),
				|b, _| {
					b.to_async(&runtime).iter(|| async {
						query!(&dbs, &ses, "SELECT * FROM item START {start} LIMIT {limit};")
					});
				},
			);
		}
	}

	group.finish();
}

// ============================================================================
// Benchmark: SELECT table with WHERE condition
// ============================================================================

fn bench_table_select_where_condition(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("select_table_where_condition");
	// Setup the datastore with 10,000 records
	let (dbs, ses) = block_on(setup_datastore_with_records(10_000));
	// Create a multithreaded runtime for async benchmarking
	let runtime = common::create_runtime();

	let conditions = [
		("level = 70", "WHERE level = 70 (returning ~100 items)"),
		("level > 95", "WHERE level > 95 (returning ~500 items)"),
		("level > 90", "WHERE level > 90 (returning ~1000 items)"),
	];

	for (condition, explanation) in conditions {
		// Configure throughput for the benchmark
		group.throughput(Throughput::Elements(10_000));
		// Benchmark the query with the given parameter
		group.bench_with_input(
			BenchmarkId::new("where_condition", explanation),
			&condition,
			|b, _| {
				b.to_async(&runtime)
					.iter(|| async { query!(&dbs, &ses, "SELECT * FROM item WHERE {condition};") });
			},
		);
	}

	group.finish();
}

// ============================================================================
// Benchmark: SELECT from table with VALUE
// ============================================================================

fn bench_table_select_expression(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("select_table_expression");
	// Setup the datastore with 10,000 records
	let (dbs, ses) = block_on(setup_datastore_with_records(10_000));

	bench!(
		group,
		select_expression_all,
		&dbs,
		&ses,
		throughput: 10_000,
		expected: |result| result.as_array().unwrap().len() == 10_000,
		"SELECT * FROM item;"
	);

	bench!(
		group,
		select_expression_id,
		&dbs,
		&ses,
		throughput: 10_000,
		expected: |result| result.as_array().unwrap().len() == 10_000,
		"SELECT id FROM item;"
	);

	bench!(
		group,
		select_expression_fields,
		&dbs,
		&ses,
		throughput: 10_000,
		expected: |result| result.as_array().unwrap().len() == 10_000,
		"SELECT id, name, level FROM item;"
	);

	bench!(
		group,
		select_expression_value_field,
		&dbs,
		&ses,
		throughput: 10_000,
		expected: |result| result.as_array().unwrap().len() == 10_000,
		"SELECT VALUE level FROM item;"
	);

	bench!(
		group,
		select_expression_value_nested_field,
		&dbs,
		&ses,
		throughput: 10_000,
		expected: |result| result.as_array().unwrap().len() == 10_000,
		"SELECT VALUE stats.rank FROM item;"
	);

	grou
```

### Core Architecture Module: `surrealdb/core/benches/functions.rs`
```
#![allow(clippy::unwrap_used)]
#![recursion_limit = "256"]

mod common;

use common::{block_on, setup_datastore};
use criterion::{Criterion, criterion_group, criterion_main};

// ============================================================================
// Benchmark: Array functions
// ============================================================================

fn bench_array_functions(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("array_functions");
	// Setup the datastore with no data
	let (dbs, ses) = block_on(setup_datastore());

	bench!(group, array_add, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::add([1, 2, 3], 4);");
	bench!(group, array_all, &dbs, &ses, expected: |result| result.is_bool(), "RETURN array::all([true, true, true]);");
	bench!(group, array_any, &dbs, &ses, expected: |result| result.is_bool(), "RETURN array::any([false, true, false]);");
	bench!(group, array_append, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::append([1, 2, 3], 4);");
	bench!(group, array_at, &dbs, &ses, expected: |result| result.is_number(), "RETURN array::at([1, 2, 3], 1);");
	bench!(group, array_boolean_and, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::boolean_and([true, false, true], [true, true, false]);");
	bench!(group, array_boolean_not, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::boolean_not([true, false, true]);");
	bench!(group, array_boolean_or, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::boolean_or([true, false, true], [false, true, false]);");
	bench!(group, array_boolean_xor, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::boolean_xor([true, false, true], [true, true, false]);");
	bench!(group, array_clump, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::clump([1, 2, 3, 4, 5, 6], 2);");
	bench!(group, array_combine, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::combine([1, 2, 3], [4, 5, 6]);");
	bench!(group, array_complement, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::complement([1, 2, 3, 4], [3, 4, 5, 6]);");
	bench!(group, array_concat, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::concat([1, 2], [3, 4], [5, 6]);");
	bench!(group, array_difference, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::difference([1, 2, 3, 4], [3, 4, 5, 6]);");
	bench!(group, array_distinct, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::distinct([1, 2, 2, 3, 3, 3, 4, 4, 4, 4]);");
	bench!(group, array_fill, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::fill([1, 2, 3, 4, 5], 0);");
	bench!(group, array_filter_index, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::filter_index([1, 2, 3, 4, 5], |$v, $i| $i > 2);");
	bench!(group, array_find_index, &dbs, &ses, expected: |result| result.is_number() || result.is_none(), "RETURN array::find_index([1, 2, 3, 4, 5], |$v| $v > 3);");
	bench!(group, array_first, &dbs, &ses, expected: |result| result.is_number(), "RETURN array::first([1, 2, 3, 4, 5]);");
	bench!(group, array_flatten, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::flatten([[1, 2], [3, 4], [5, 6]]);");
	bench!(group, array_group, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::group([1, 2, 1, 3, 2, 4]);");
	bench!(group, array_insert, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::insert([1, 2, 4, 5], 3, 2);");
	bench!(group, array_intersect, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::intersect([1, 2, 3, 4], [3, 4, 5, 6]);");
	bench!(group, array_is_empty, &dbs, &ses, expected: |result| result.is_bool(), "RETURN array::is_empty([]);");
	bench!(group, array_join, &dbs, &ses, expected: |result| result.is_string(), "RETURN array::join([1, 2, 3], ', ');");
	bench!(group, array_last, &dbs, &ses, expected: |result| result.is_number(), "RETURN array::last([1, 2, 3, 4, 5]);");
	bench!(group, array_len, &dbs, &ses, expected: |result| result.is_number(), "RETURN array::len([1, 2, 3, 4, 5]);");
	bench!(group, array_logical_and, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::logical_and([0, 1, 2, 3], [0, 1, 4, 5]);");
	bench!(group, array_logical_or, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::logical_or([0, 1, 2], [0, 2, 4]);");
	bench!(group, array_logical_xor, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::logical_xor([0, 1, 2, 3], [0, 2, 3, 4]);");
	bench!(group, array_matches, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::matches([1, 2, 3, 4], 3);");
	bench!(group, array_max, &dbs, &ses, expected: |result| result.is_number(), "RETURN array::max([5, 2, 8, 1, 9, 3]);");
	bench!(group, array_min, &dbs, &ses, expected: |result| result.is_number(), "RETURN array::min([5, 2, 8, 1, 9, 3]);");
	bench!(group, array_pop, &dbs, &ses, expected: |result| result.is_number(), "RETURN array::pop([1, 2, 3, 4, 5]);");
	bench!(group, array_prepend, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::prepend([2, 3, 4], 1);");
	bench!(group, array_push, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::push([1, 2, 3], 4);");
	bench!(group, array_range, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::range(1..5);");
	bench!(group, array_remove, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::remove([1, 2, 3, 4, 5], 2);");
	bench!(group, array_repeat, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::repeat(5, 3);");
	bench!(group, array_reverse, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::reverse([1, 2, 3, 4, 5]);");
	bench!(group, array_sequence, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::sequence(0, 10);");
	bench!(group, array_shuffle, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::shuffle([1, 2, 3, 4, 5]);");
	bench!(group, array_slice, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::slice([1, 2, 3, 4, 5], 1, 3);");
	bench!(group, array_sort, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::sort([5, 2, 8, 1, 9, 3]);");
	bench!(group, array_sort_asc, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::sort::asc([5, 2, 8, 1, 9, 3]);");
	bench!(group, array_sort_desc, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::sort::desc([5, 2, 8, 1, 9, 3]);");
	bench!(group, array_sort_lexical, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::sort_lexical(['Álvares', 'senhor', 'Obrigado']);");
	bench!(group, array_sort_natural, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::sort_natural([8, 9, 10, '3', '2.2', '11']);");
	bench!(group, array_sort_natural_lexical, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::sort_natural_lexical(['Obrigado', 'senhor', 'Álvares', 8, 9, 10, '3', '2.2', '11']);");
	bench!(group, array_swap, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::swap([1, 2, 3, 4, 5], 0, 4);");
	bench!(group, array_transpose, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::transpose([[0, 1], [2, 3]]);");
	bench!(group, array_union, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::union([1, 2, 3], [3, 4, 5]);");
	bench!(group, array_windows, &dbs, &ses, expected: |result| result.is_array(), "RETURN array::windows([1, 2, 3, 4], 2);");

	group.finish();
}

// ============================================================================
// Benchmark: Crypto functions
// ============================================================================

fn bench_crypto_functions(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("crypto_functions");
	// Setup the datastore with no data
	let (dbs, ses) = block_on(setup_datastore());

	// Note: Intentionally slow hash functions (argon2, bcrypt, pbkdf2, scrypt) are excluded
	bench!(group, crypto_md5, &dbs, &ses, expected: |result| result.is_string(), "RETURN crypto::md5('hello world');");
	bench!(group, crypto_sha1, &dbs, &ses, expected: |result| result.is_string(), "RETURN crypto::sha1('hello world');");
	bench!(group, crypto_sha256, &dbs, &ses, expected: |result| result.is_string(), "RETURN crypto::sha256('hello world');");
	bench!(group, crypto_sha512, &dbs, &ses, expected: |result| result.is_string(), "RETURN crypto::sha512('hello world');");

	group.finish();
}

// ============================================================================
// Benchmark: Duration functions
// ============================================================================

fn bench_duration_functions(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("duration_functions");
	// Setup the datastore with no data
	let (dbs, ses) = block_on(setup_datastore());

	bench!(group, duration_days, &dbs, &ses, expected: |result| result.is_number(), "RETURN duration::days(2d);");
	bench!(group, duration_from_days, &dbs, &ses, expected: |result| result.is_duration(), "RETURN duration::from_days(7);");
	bench!(group, duration_from_hours, &dbs, &ses, expected: |result| result.is_duration(), "RETURN duration::from_hours(24);");
	bench!(group, duration_from_micros, &dbs, &ses, expected: |result| result.is_duration(), "RETURN duration::from_micros(1000000);");
	bench!(group, duration_from_millis, &dbs, &ses, expected: |result| result.is_duration(), "RETURN duration::from_millis(1000);");
	bench!(group, duration_from_mins, &dbs, &ses, expected: |result| result.is_duration(), "RETURN duration::from_mins(60);");
	bench!(group, duration_from_nanos, &dbs, &ses, expected: |result| result.is_duration(), "RETURN duration::from_nanos(1000000000);");
	bench!(group, duration_from_secs, &dbs, &ses, expected: |result| result.is_duration(), "RETURN duration::from_secs(3600);");
	bench!(group, duration_from_weeks, &dbs, &ses, expected: |result| result.
```

### Core Architecture Module: `surrealdb/core/benches/import_load.rs`
```
#![allow(clippy::unwrap_used)]
#![recursion_limit = "256"]

//! Import load test benchmark.
//!
//! Streams `INSERT INTO person [... 1000 records ...]` statements through
//! `Datastore::import_stream()` to validate correctness and measure throughput.
//!
//! Configure the target data size via the `IMPORT_BENCH_SIZE_GB` environment
//! variable (default: 100 MB).
//!
//! ```bash
//! # Default 100 MB (fast dev cycle)
//! cargo bench --bench import_load
//!
//! # 1 GiB
//! IMPORT_BENCH_SIZE_GB=1 cargo bench --bench import_load
//!
//! # 5 GiB (needs ~16 GB RAM)
//! IMPORT_BENCH_SIZE_GB=5 cargo bench --bench import_load
//! ```

mod common;

use std::time::{Duration, Instant};

use bytes::Bytes;
use common::create_runtime;
use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};
use futures::StreamExt;
use surrealdb_core::dbs::{Capabilities, Session};
use surrealdb_core::kvs::Datastore;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/// Default target size in bytes (100 MB — safe for CI and local dev).
const DEFAULT_SIZE_BYTES: u64 = 100 * 1024 * 1024;

/// Number of records per INSERT statement.
const RECORDS_PER_STATEMENT: usize = 1000;

/// Approximate target size per record in the generated SQL (bytes).
const TARGET_RECORD_SIZE: usize = 700;

/// Read the target size from `IMPORT_BENCH_SIZE_GB`, or fall back to
/// `DEFAULT_SIZE_BYTES`.
fn target_size_bytes() -> u64 {
	std::env::var("IMPORT_BENCH_SIZE_GB")
		.ok()
		.and_then(|s| s.parse::<f64>().ok())
		.map(|gb| (gb * 1024.0 * 1024.0 * 1024.0) as u64)
		.unwrap_or(DEFAULT_SIZE_BYTES)
}

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------

/// Generate a single `INSERT INTO person [...]` statement containing
/// [`RECORDS_PER_STATEMENT`] records.
///
/// Each record is approximately [`TARGET_RECORD_SIZE`] bytes and looks like:
///
/// ```surql
/// { name: 'Person 00042371', email: 'user_00042371@example.com',
///   age: 42, active: true,
///   address: { street: '42371 Main St', city: 'Springfield',
///              state: 'IL', zip: '62701' },
///   bio: 'abcdefghij...(padding)...' }
/// ```
fn generate_insert_statement(statement_index: usize) -> String {
	let mut sql = String::with_capacity(RECORDS_PER_STATEMENT * TARGET_RECORD_SIZE + 256);
	sql.push_str("INSERT INTO person [");

	for i in 0..RECORDS_PER_STATEMENT {
		let global_id = statement_index * RECORDS_PER_STATEMENT + i;
		if i > 0 {
			sql.push_str(", ");
		}

		let base = format!(
			"{{ name: 'Person {global_id:08}', \
			   email: 'user_{global_id:08}@example.com', \
			   age: {age}, \
			   active: {active}, \
			   address: {{ street: '{global_id} Main St', \
			               city: 'Springfield', \
			               state: 'IL', \
			               zip: '62701' }}, \
			   bio: '",
			age = 18 + (global_id % 62),
			active = if global_id.is_multiple_of(2) {
				"true"
			} else {
				"false"
			},
		);
		sql.push_str(&base);

		// Pad the bio field so the total record reaches TARGET_RECORD_SIZE.
		let closing = "' }";
		let current = base.len() + closing.len();
		if current < TARGET_RECORD_SIZE {
			let padding_len = TARGET_RECORD_SIZE - current;
			// Repeating ASCII pattern — no single-quotes or backslashes.
			for (j, _) in (0..padding_len).enumerate() {
				sql.push((b'a' + (j % 26) as u8) as char);
			}
		}
		sql.push_str(closing);
	}

	sql.push_str("];\n");
	sql
}

/// Compute how many INSERT statements are needed to reach `target_bytes`.
fn statements_needed(target_bytes: u64) -> usize {
	let sample = generate_insert_statement(0);
	let stmt_bytes = sample.len() as u64;
	target_bytes.div_ceil(stmt_bytes) as usize
}

// ---------------------------------------------------------------------------
// Benchmark
// ---------------------------------------------------------------------------

fn bench_import_throughput(c: &mut Criterion) {
	let target = target_size_bytes();
	let num_stmts = statements_needed(target);
	let total_records = (num_stmts * RECORDS_PER_STATEMENT) as u64;
	let stmt_bytes = generate_insert_statement(0).len() as u64;
	let approx_bytes = stmt_bytes * num_stmts as u64;

	eprintln!("=== Import Load Benchmark ===");
	eprintln!(
		"  Target size:       {:.2} GiB ({} bytes)",
		target as f64 / (1024.0 * 1024.0 * 1024.0),
		target
	);
	eprintln!("  Statements:        {num_stmts}");
	eprintln!("  Records/statement: {RECORDS_PER_STATEMENT}");
	eprintln!("  Total records:     {total_records}");
	eprintln!("  SQL payload:       {:.2} GiB", approx_bytes as f64 / (1024.0 * 1024.0 * 1024.0));
	eprintln!("  Bytes/statement:   {stmt_bytes}");
	eprintln!("=============================");

	let mut group = c.benchmark_group("import_load");
	group.throughput(Throughput::Bytes(approx_bytes));
	group.sample_size(10);

	// Scale measurement time with data size.
	if target >= 1024 * 1024 * 1024 {
		group.measurement_time(Duration::from_secs(600));
		group.warm_up_time(Duration::from_secs(5));
	} else if target >= 500 * 1024 * 1024 {
		group.measurement_time(Duration::from_secs(120));
		group.warm_up_time(Duration::from_secs(5));
	} else {
		group.measurement_time(Duration::from_secs(60));
	}

	let size_label = if target >= 1024 * 1024 * 1024 {
		format!("{:.1}GiB", target as f64 / (1024.0 * 1024.0 * 1024.0))
	} else {
		format!("{:.0}MB", target as f64 / (1024.0 * 1024.0))
	};

	group.bench_function(BenchmarkId::new("import_stream", &size_label), |b| {
		let runtime = create_runtime();
		b.to_async(&runtime).iter_custom(|iters| async move {
			let mut total_elapsed = Duration::ZERO;

			for iteration in 0..iters {
				// Fresh datastore per iteration so records don't accumulate.
				let dbs = Datastore::builder()
					.with_capabilities(Capabilities::all())
					.build_with_path("memory")
					.await
					.unwrap();
				let ses = Session::owner().with_ns("test").with_db("test");
				dbs.execute("USE NAMESPACE test DATABASE test", &ses, None).await.unwrap();

				// Lazy stream — OPTION IMPORT header followed by one statement at a time.
				let header = futures::stream::once(async {
					Ok::<Bytes, anyhow::Error>(Bytes::from_static(b"OPTION IMPORT;\n"))
				});
				let inserts = futures::stream::iter((0..num_stmts).map(|i| {
					Ok::<Bytes, anyhow::Error>(Bytes::from(generate_insert_statement(i)))
				}));
				let stream = header.chain(inserts);

				let start = Instant::now();
				let results = dbs.import_stream(&ses, stream).await.unwrap();
				let elapsed = start.elapsed();
				total_elapsed += elapsed;

				// Verify no errors.
				let errors: Vec<_> = results.iter().filter(|r| r.result.is_err()).collect();
				assert!(
					errors.is_empty(),
					"Import had {} errors: {:?}",
					errors.len(),
					errors.first().map(|e| &e.result)
				);

				// Verify all records persisted.
				let verify =
					dbs.execute("SELECT count() FROM person GROUP ALL", &ses, None).await.unwrap();
				let count_result = verify[0].result.as_ref().unwrap();

				eprintln!(
					"  [{}/{}] {:.2}s | {:.0} records/sec | {:.2} MiB/sec | count: {:?}",
					iteration + 1,
					iters,
					elapsed.as_secs_f64(),
					total_records as f64 / elapsed.as_secs_f64(),
					(approx_bytes as f64 / (1024.0 * 1024.0)) / elapsed.as_secs_f64(),
					count_result,
				);
			}

			total_elapsed
		});
	});

	group.finish();
}

// ---------------------------------------------------------------------------
// Criterion registration
// ---------------------------------------------------------------------------

criterion_group! {
	name = benches;
	config = Criterion::default();
	targets = bench_import_throughput
}
criterion_main!(benches);

```

### Core Architecture Module: `surrealdb/core/benches/rocksdb_cursor.rs`
```
//! RocksDB-direct cursor benchmarks.
//!
//! The existing `scanner` bench uses the in-memory backend, which is too
//! fast to expose the per-batch lock costs we're trying to optimise.
//! These benches construct a real RocksDB datastore on a temp dir and
//! drive the cursor API directly. Two workloads:
//!
//! * **Nested edge** — open many cursors back-to-back, each over a small prefix (simulates `SELECT
//!   ->knows FROM person`). Measures cursor open + 1-batch advance + drop, repeated N times.
//!   Per-cursor overhead dominates.
//! * **Bulk scan** — one cursor over the entire range. Measures per-batch advance overhead
//!   amortised across many items.

#![allow(clippy::unwrap_used)]

use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};
use surrealdb_core::CommunityComposer;
use surrealdb_core::kvs::Direction::Forward;
use surrealdb_core::kvs::LockType::Optimistic;
use surrealdb_core::kvs::{Datastore, TransactionType, Transactor};
use temp_dir::TempDir;
use tokio::runtime::Runtime;

fn runtime() -> Runtime {
	tokio::runtime::Builder::new_multi_thread().enable_all().build().unwrap()
}

/// Seed a rocksdb-backed datastore with `prefix_count` prefixes, each
/// containing `per_prefix` keys (raw KV, not SurrealQL). Returns the
/// datastore and the temp dir (keep alive for the bench's lifetime).
fn setup(prefix_count: usize, per_prefix: usize) -> (Datastore, TempDir) {
	let tmp = TempDir::new().unwrap();
	let path = format!("rocksdb:{}", tmp.path().to_string_lossy());
	let ds = runtime().block_on(async {
		let ds =
			Datastore::builder().build_with_factory_path(&path, CommunityComposer()).await.unwrap();
		let tx = ds.transaction(TransactionType::Write, Optimistic).await.unwrap();
		// Insert raw bytes via the Transactor (`tx.set` on the typed
		// Transaction wrapper now requires a `KVKey`; we want raw byte
		// keys for the bench, so go one level lower).
		let tr: &Transactor = &tx;
		for p in 0..prefix_count {
			for k in 0..per_prefix {
				let key = format!("p_{p:06}/k_{k:06}");
				tr.set(key.into_bytes(), vec![0u8; 8]).await.unwrap();
			}
		}
		tx.commit().await.unwrap();
		ds
	});
	(ds, tmp)
}

fn prefix_range(prefix: &str) -> std::ops::Range<Vec<u8>> {
	let start = prefix.as_bytes().to_vec();
	let mut end = start.clone();
	end.push(0xff);
	start..end
}

/// Nested edge: N small cursors. Each opens, takes one batch of small
/// size, drops. Per-cursor-open cost dominates — this is the
/// "`SELECT ->knows FROM person` with N outer rows" hot path.
fn bench_nested_edge(c: &mut Criterion) {
	let mut group = c.benchmark_group("rocksdb_nested_edge");
	for prefix_count in [100usize, 1_000, 10_000] {
		// 5 keys per prefix — the user's stated case (5 edges per row).
		let (ds, _tmp) = setup(prefix_count, 5);
		group.throughput(Throughput::Elements(prefix_count as u64));
		group.bench_with_input(
			BenchmarkId::new("open+1batch+drop", prefix_count),
			&prefix_count,
			|b, &prefix_count| {
				let rt = runtime();
				b.to_async(&rt).iter(|| async {
					let tx = ds.transaction(TransactionType::Read, Optimistic).await.unwrap();
					let tr: &Transactor = &tx;
					let mut count = 0u64;
					for p in 0..prefix_count {
						let rng = prefix_range(&format!("p_{p:06}/"));
						let mut cursor =
							tr.open_keys_cursor(rng, Forward, 0u32, None).await.unwrap();
						let batch = cursor.next_batch(10).await.unwrap();
						count += batch.len() as u64;
						drop(cursor);
					}
					assert!(count > 0);
					tx.cancel().await.unwrap();
				});
			},
		);
	}
	group.finish();
}

/// Bulk scan: one cursor, many keys. Amortises per-cursor cost across
/// many batches. Measures per-batch advance cost.
fn bench_bulk_scan(c: &mut Criterion) {
	let mut group = c.benchmark_group("rocksdb_bulk_scan");
	let (ds, _tmp) = setup(1, 1_000_000);
	for count in [100_000u64, 1_000_000] {
		group.throughput(Throughput::Elements(count));
		group.bench_with_input(BenchmarkId::new("next_batch_2000", count), &count, |b, &count| {
			let rt = runtime();
			b.to_async(&rt).iter(|| async {
				let tx = ds.transaction(TransactionType::Read, Optimistic).await.unwrap();
				let tr: &Transactor = &tx;
				let rng = prefix_range("p_000000/");
				let mut cursor = tr.open_keys_cursor(rng, Forward, 0u32, None).await.unwrap();
				let mut total = 0u64;
				while total < count {
					let batch = cursor.next_batch(2000).await.unwrap();
					if batch.is_empty() {
						break;
					}
					total += batch.len() as u64;
				}
				drop(cursor);
				assert_eq!(total, count.min(1_000_000));
				tx.cancel().await.unwrap();
			});
		});
		// `borrowed_iter_2000`: drive the same cursor as `next_batch_2000`
		// but iterate the borrowed `Vec<&[u8]>` directly without copying
		// each key into an owned `Vec<u8>`. With the per-batch allocation
		// now a single `Vec<&[u8]>` (not N `Vec<u8>`s), this should be
		// strictly faster than the legacy owned-batch shape.
		group.bench_with_input(
			BenchmarkId::new("borrowed_iter_2000", count),
			&count,
			|b, &count| {
				let rt = runtime();
				b.to_async(&rt).iter(|| async {
					let tx = ds.transaction(TransactionType::Read, Optimistic).await.unwrap();
					let tr: &Transactor = &tx;
					let rng = prefix_range("p_000000/");
					let mut cursor = tr.open_keys_cursor(rng, Forward, 0u32, None).await.unwrap();
					let mut total = 0u64;
					while total < count {
						let batch = cursor.next_batch(2000).await.unwrap();
						if batch.is_empty() {
							break;
						}
						total += batch.len() as u64;
						for k in &batch {
							std::hint::black_box(k);
						}
					}
					drop(cursor);
					assert_eq!(total, count.min(1_000_000));
					tx.cancel().await.unwrap();
				});
			},
		);
	}
	group.finish();
}

criterion_group!(benches, bench_nested_edge, bench_bulk_scan);
criterion_main!(benches);

```

### Core Architecture Module: `surrealdb/core/benches/statements.rs`
```
#![allow(clippy::unwrap_used)]
#![recursion_limit = "256"]

mod common;

use common::{block_on, setup_datastore, setup_datastore_with_query};
use criterion::{Criterion, criterion_group, criterion_main};

// ============================================================================
// Benchmark: CREATE Statement
// ============================================================================

fn bench_create(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("create");
	// Setup the datastore with no data
	let (dbs, ses) = block_on(setup_datastore());

	bench!(
		group,
		create_simple,
		&dbs,
		&ses,
		"CREATE person SET name = 'Test', age = 30, email = 'test@example.com', scores = [90, 80, 70];"
	);

	bench!(
		group,
		create_merge,
		&dbs,
		&ses,
		"CREATE person MERGE {{ name: 'Test', age: 30, email: 'test@example.com', scores: [90, 80, 70] }};"
	);

	bench!(
		group,
		create_content,
		&dbs,
		&ses,
		"CREATE person CONTENT {{ name: 'Test', age: 30, email: 'test@example.com', scores: [90, 80, 70] }};"
	);

	bench!(
		group,
		create_replace,
		&dbs,
		&ses,
		"CREATE person REPLACE {{ name: 'Test', age: 30, email: 'test@example.com', scores: [90, 80, 70] }};"
	);

	bench!(
		group,
		create_complex,
		&dbs,
		&ses,
		"CREATE person SET name = 'Test', age = 30, email = 'test@example.com', scores = [90, 80, 70], address = {{ street: '123 Main St', city: 'NYC', zip: '10001' }}, hobbies = ['reading', 'coding', 'gaming'];"
	);

	bench!(
		group,
		create_large_string,
		&dbs,
		&ses,
		"CREATE person SET name = 'Test', age = 30, email = 'test@example.com', scores = [90, 80, 70], description = '{}';",
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.".repeat(10_000)
	);

	group.finish();
}

// ============================================================================
// Benchmark: UPSERT Statement
// ============================================================================

fn bench_upsert(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("upsert");
	// Setup the datastore with no data
	let (dbs, ses) = block_on(setup_datastore());

	bench!(
		group,
		upsert_simple,
		&dbs,
		&ses,
		"UPSERT person:test SET name = 'Test', age = 30, email = 'test@example.com', scores = [90, 80, 70];"
	);

	bench!(
		group,
		upsert_merge,
		&dbs,
		&ses,
		"UPSERT person:test MERGE {{ name: 'Test', age: 30, email: 'test@example.com', scores: [90, 80, 70] }};"
	);

	bench!(
		group,
		upsert_content,
		&dbs,
		&ses,
		"UPSERT person:test CONTENT {{ name: 'Test', age: 30, email: 'test@example.com', scores: [90, 80, 70] }};"
	);

	bench!(
		group,
		upsert_replace,
		&dbs,
		&ses,
		"UPSERT person:test REPLACE {{ name: 'Test', age: 30, email: 'test@example.com', scores: [90, 80, 70] }};"
	);

	bench!(group, upsert_computation, &dbs, &ses, "UPSERT person:test SET age = age + 1");

	group.finish();
}

// ============================================================================
// Benchmark: UPDATE Statement
// ============================================================================

fn bench_update(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("update");
	// Setup the datastore with a query
	let (dbs, ses) = block_on(setup_datastore_with_query(
		"CREATE person:test SET name = 'Tobie', age = 30, email = 'test@example.com';",
	));

	bench!(
		group,
		update_simple,
		&dbs,
		&ses,
		"UPDATE person:test SET name = 'Test', age = 30, email = 'test@example.com', scores = [90, 80, 70];"
	);

	bench!(
		group,
		update_merge,
		&dbs,
		&ses,
		"UPDATE person:test MERGE {{ name: 'Test', age: 30, email: 'test@example.com', scores: [90, 80, 70] }};"
	);

	bench!(
		group,
		update_content,
		&dbs,
		&ses,
		"UPDATE person:test CONTENT {{ name: 'Test', age: 30, email: 'test@example.com', scores: [90, 80, 70] }};"
	);

	bench!(
		group,
		update_replace,
		&dbs,
		&ses,
		"UPDATE person:test REPLACE {{ name: 'Test', age: 30, email: 'test@example.com', scores: [90, 80, 70] }};"
	);

	bench!(group, update_computation, &dbs, &ses, "UPDATE person:test SET age = age + 1");

	group.finish();
}

// ============================================================================
// Benchmark: INSERT Statement
// ============================================================================

fn bench_insert(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("insert");
	// Setup the datastore with no data
	let (dbs, ses) = block_on(setup_datastore());

	bench!(
		group,
		insert_values,
		&dbs,
		&ses,
		"INSERT INTO person (name, age, email, scores) VALUES ('Test',30, 'test@example.com', [90, 80, 70]);"
	);

	bench!(
		group,
		insert_object,
		&dbs,
		&ses,
		"INSERT INTO person {{ name: 'Test', age: 30, email: 'test@example.com', scores: [90, 80, 70] }};"
	);

	bench!(
		group,
		insert_with_id,
		&dbs,
		&ses,
		"INSERT INTO person {{ id: person:test, name: 'Test', age: 30, email: 'test@example.com', scores: [90, 80, 70] }};"
	);

	group.finish();
}

// ============================================================================
// Benchmark: RELATE Statement
// ============================================================================

fn bench_relate(c: &mut Criterion) {
	// Create the benchmark group
	let mut group = c.benchmark_group("relate");
	// Setup the datastore with no data
	let (dbs, ses) = block_on(setup_datastore());

	bench!(group, relate_empty, &dbs, &ses, "RELATE person:test->knows->person:other;");

	bench!(
		group,
		relate_simple,
		&dbs,
		&ses,
		"RELATE person:test->knows->person:other SET date = time::now(), weight = 0.8;"
	);

	bench!(
		group,
		relate_merge,
		&dbs,
		&ses,
		"RELATE person:test->knows->person:other MERGE {{ date: time::now(), weight: 0.8 }};"
	);

	bench!(
		group,
		relate_content,
		&dbs,
		&ses,
		"RELATE person:test->knows->person:other CONTENT {{ date: time::now(), weight: 0.8 }};"
	);

	bench!(
		group,
		relate_replace,
		&dbs,
		&ses,
		"RELATE person:test->knows->person:other REPLACE {{ date: time::now(), weight: 0.8 }};"
	);

	group.finish();
}

criterion_group!(
	name = benches;
	config = Criterion::default();
	targets = bench_create,
		bench_upsert,
		bench_update,
		bench_insert,
		bench_relate,
);
criterion_main!(benches);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7587** (2026-10-08): **Update CLI banner**
  *Symptoms*: ## What is the motivation?  Refreshing the CLI banner with colour and updated links.  ## What does this change do?  - adds colour to the CLI banner - simplifies the text - adds the studio.surrealdb.com link for a free cloud instance - remove the "community" link  ## What is your testing strategy?  `cargo run -- help`  <img width="567" height="482" alt="image" src="https://github.com/user-attachments/assets/be72b0fd-36bf-4050-b7c8-b89bfa1553ec" />  `NO_COLOR=1 cargo run -- help`  <img width="570" height="430" alt="image" src="https://github.com/user-attachments/assets/34b84e6c-4d36-4e52-8323-159cba558c93" />  ## Security Considerations  n/a  ## Is this related to any issues?  * [x] No related issues  ## Have you read the Contributing Guidelines?  * [x] I have read the [Contributing Guidelines](https://github.com/surrealdb/surrealdb/blob/main/CONTRIBUTING.md) 
  **Post-Mortem & Fix Analysis**:
  > <!-- lang-bench-quick --> ## 📊 Benchmark  Add the **`benchmark`** label to this PR to benchmark your changes and compare them against the latest nightly `main` baseline.  - `main` is benchmarked **nightly** (full run, same runner pool); this PR is compared against that baseline, so only your branch is benchmarked here. - Runs on every push while the label is set; remove the label to stop.

- **Issue #7579** (2026-10-18): **Bug: Datastore startup scans every process on the host (System::new_all in sys::Environment)**
  *Symptoms*: ### What component does this affect?  SurrealDB Rust SDK  ### Describe the bug  `Environment::default()` in `surrealdb/core/src/sys/mod.rs` creates `sysinfo::System::new_all()`:  https://github.com/surrealdb/surrealdb/blob/18971ffba781a796c0ad3897bb4b82432c241e4c/surrealdb/core/src/sys/mod.rs#L73-L82  That reads every process and thread on the host, and keeps them in memory with an open `/proc/<pid>/stat` file each.  Only SurrealDB's own process is ever used: `refresh()` updates `ProcessesToUpdate::Some(&[self.pid])`, and `cpu_usage()` / `memory_usage()` read `self.sys.process(self.pid)`.  On a busy host this adds about a second, tens of MB and thousands of open files to the first `sys::refresh()` in every process (on `Datastore` bootstrap). It adds up quickly when tests run one process each.  ### Steps to reproduce  With sysinfo 0.37.2 (the version surrealdb-core uses):  ```rust let t = std::time::Instant::now(); let sys = sysinfo::System::new_all(); println!("{:?}, {} processes", t.elapsed(), sys.processes().len()); ```  Time and memory grow with the number of processes and threads on the host. `System::new()` followed by the same `refresh()` holds one entry and takes a few milliseconds.  ### Expected behaviour  Only SurrealDB's own process should be read. `System::new()` is enough: the first `refresh()` adds that pid, and the reported values are the same. #7250 made this change in `kvs/*/cnf.rs`, but `Environment` was missed. I have a one-line PR ready.   ### SurrealDB ver

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

### Incident Patch 1: `1a2ebca5` (2026-08-28)
**Commit Message**: Commit Cargo.lock for the SDK build-test crates (#7489)

**File**: `.gitignore` (modified, +0/-1)
```diff
@@ -41,7 +41,6 @@ Temporary Items
 /lib/cache/
 /lib/store/
 /lib/target/
-/tests/sdk/*/Cargo.lock
 /tests/sdk/*/target
 /.github/scripts/__pycache__/
 
```

---

### Incident Patch 2: `1e4c3d74` (2026-07-01)
**Commit Message**: fix(core): block side effects in PERMISSIONS predicates (GHSA-66r2-5gwj-gxm2) (#438)

**File**: `SECURITY_GUIDE.md` (modified, +9/-1)
```diff
@@ -154,7 +154,15 @@ Flag for detailed review when changes touch:
 - Reference cascade operations (ON DELETE CASCADE, UNSET, CUSTOM) must only modify
   records reachable through explicitly defined REFERENCE relationships.
 - Permission expressions (WHERE clause in PERMISSIONS) must not produce observable
-  side effects (writes, deletes, event triggers).
+  side effects (writes, deletes, event triggers). This is enforced in two layers
+  (GHSA-66r2-5gwj-gxm2): definition-time rejection of clauses that directly contain
+  a data-modifying statement (`Permissions::has_direct_write`, checked in every
+  `DEFINE` that stores permissions), and a runtime guard that rejects any mutating
+  statement reached while a predicate is evaluated. Predicate evaluation always
+  uses `Options::new_for_permission_predicate` (legacy path) or carries
+  `skip_fetch_perms` (streaming path), both of which set `Options::permission_predicate`
+  so `Expr::compute` blocks CREATE/UPDATE/DELETE/RELATE/INSERT/UPSERT and DDL —
+  including writes reached through custom-function bodies.
 - The Auth context within Options must not be mutated by user-controlled operations.
   Only system-internal mechanisms (AuthLimit) may produce derived Options with
   modified auth, and these must never broaden permissions.
```

**File**: `language-tests/tests/reproductions/perm_predicate_runtime_block.surql` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+/**
+[env]
+imports = ["reproductions/perm_predicate_runtime_block_import.surql"]
+auth = { namespace = "test", database = "test", access = "user", rid = "user:test" }
+
+[test]
+reason = "A permission predicate that writes via a custom-function body must be blocked at runtime on both the streaming SELECT path and the legacy UPDATE path, and must not create the row (GHSA-66r2-5gwj-gxm2)."
+
+# 0: SELECT — streaming path. It errors; the exact wording is wrapped
+# differently per planner config ("Failed to check permission: ..."), so only
+# assert that an error occurred.
+[[test.results]]
+error = true
+
+# 1: UPDATE — legacy compute path, stable error wording across configs.
+[[test.results]]
+error = "A PERMISSIONS clause cannot contain a statement that modifies data"
+
+# 2: the predicate's write was blocked, so audit is empty.
+[[test.results]]
+value = "[]"
+*/
+
+-- 0: SELECT triggers the SELECT-permission predicate (streaming path) -> blocked.
+SELECT * FROM victim;
+
+-- 1: UPDATE triggers the UPDATE-permission predicate (legacy path) -> blocked.
+UPDATE victim:1 SET visible = false;
+
+-- 2: the predicate must not have written to `audit`.
+SELECT * FROM audit;
```

**File**: `language-tests/tests/reproductions/perm_predicate_runtime_block_import.surql` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+/**
+[test]
+reason = "Setup for perm_predicate_runtime_block: a function whose body performs a write, referenced from a table's SELECT/UPDATE permission predicate. The DEFINE is accepted because the function call is opaque to the definition-time check, so the runtime guard must block the write when a record user triggers the predicate (GHSA-66r2-5gwj-gxm2)."
+run = false
+*/
+
+-- `audit` is readable so the test can assert that no rows were written; the
+-- permission predicate must not be permitted to write to it.
+DEFINE TABLE audit SCHEMALESS PERMISSIONS FOR select FULL;
+
+-- A read-only-looking predicate: it calls a function whose body performs a
+-- write. The DEFINE is accepted (the call is opaque to `has_direct_write`); the
+-- write must be blocked at runtime by the permission-predicate guard.
+DEFINE FUNCTION fn::side_effect() {
+	CREATE audit SET marker = true;
+	RETURN true;
+} PERMISSIONS FULL;
+
+DEFINE TABLE victim SCHEMALESS
+	PERMISSIONS FOR select, update WHERE fn::side_effect();
+
+DEFINE ACCESS user ON DATABASE TYPE RECORD SIGNIN ( $rid );
+
+CREATE user:test;
+CREATE victim:1 SET visible = true;
```

**File**: `language-tests/tests/reproductions/perm_predicate_side_effect_rejected.surql` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+/**
+[env]
+namespace = true
+database = true
+auth = { level = "owner" }
+
+[test]
+reason = "A side-effecting PERMISSIONS predicate must be rejected at definition time (GHSA-66r2-5gwj-gxm2). Read-only predicates, helper-function calls and read-only subqueries remain valid."
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+error = "Found a non-read-only expression in the PERMISSIONS clause for table `bad`, but a PERMISSIONS clause must not modify data"
+
+[[test.results]]
+error = "Found a non-read-only expression in the PERMISSIONS clause for field `f`, but a PERMISSIONS clause must not modify data"
+
+[[test.results]]
+error = "Found a non-read-only expression in the PERMISSIONS clause for function `fn::bad`, but a PERMISSIONS clause must not modify data"
+
+[[test.results]]
+error = "Found a non-read-only expression in the PERMISSIONS clause for param `bad`, but a PERMISSIONS clause must not modify data"
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "NONE"
+*/
+
+-- 0: control — a read-only table permission predicate is accepted
+DEFINE TABLE ok PERMISSIONS FOR select WHERE published = true;
+
+-- 1: a table permission predicate that performs a direct write is rejected
+DEFINE TABLE bad PERMISSIONS FOR select, update WHERE (CREATE audit SET marker = true) OR true;
+
+-- 2: a field permission predicate that performs a direct write is rejected
+DEFINE FIELD f ON ok TYPE option<number> PERMISSIONS FOR update WHERE (UPDATE ok SET x = 1) OR true;
+
+-- 3: a function permission predicate that performs a direct write is rejected
+DEFINE FUNCTION fn::bad() { RETURN true; } PERMISSIONS WHERE (DELETE ok) OR true;
+
+-- 4: a param permission predicate that performs a direct write is rejected
+DEFINE PARAM $bad VALUE 1 PERMISSIONS WHERE (CREATE audit) OR true;
+
+-- 5: control — a read-only helper function defines fine
+DEFINE FUNCTION fn::is_ok() { RETURN true; } PERMISSIONS FULL;
+
+-- 6: control — calling a function from a permission predicate is allowed (opaque at definition; writes inside it are blocked at runtime)
+DEFINE TABLE okfn PERMISSIONS FOR select WHERE fn::is_ok();
+
+-- 7: control — a read-only subquery in a permission predicate is allowed
+DEFINE TABLE oksub PERMISSIONS FOR select WHERE id IN (SELECT VALUE id FROM ok);
```

**File**: `surrealdb/core/src/api/invocation.rs` (modified, +2/-2)
```diff
@@ -135,8 +135,8 @@ pub async fn process_api_request_with_stack(
 				}
 				Permission::Full => (),
 				Permission::Specific(e) => {
-					// Disable permissions
-					let opt = &opt.new_with_perms(false);
+					// Disable permission recursion and block side effects
+					let opt = &opt.new_for_permission_predicate();
 					// Process the PERMISSION clause
 					if !stk
 						.run(|stk| e.compute(stk, ctx, opt, None))
```

**File**: `surrealdb/core/src/buc/controller.rs` (modified, +2/-2)
```diff
@@ -287,8 +287,8 @@ impl<'a> BucketController<'a> {
 				}
 				Permission::Full => (),
 				Permission::Specific(e) => {
-					// Disable permissions
-					let opt = &self.opt.new_with_perms(false);
+					// Disable permission recursion and block side effects
+					let opt = &self.opt.new_for_permission_predicate();
 
 					// Add $action, $file and $target to context
 					let mut ctx = Context::new_child(self.ctx);
```

**File**: `surrealdb/core/src/catalog/schema/mod.rs` (modified, +18/-0)
```diff
@@ -55,6 +55,15 @@ impl Permission {
 		matches!(self, Self::Specific(_))
 	}
 
+	/// Whether this permission clause directly contains a data-modifying
+	/// statement, which is not allowed (GHSA-66r2-5gwj-gxm2).
+	pub(crate) fn has_direct_write(&self) -> bool {
+		match self {
+			Permission::None | Permission::Full => false,
+			Permission::Specific(e) => e.has_direct_write(),
+		}
+	}
+
 	fn to_sql_definition(&self) -> crate::sql::Permission {
 		match self {
 			Permission::None => crate::sql::Permission::None,
@@ -108,6 +117,15 @@ impl Permissions {
 	pub(crate) fn to_sql_definition(&self) -> crate::sql::Permissions {
 		self.clone().into()
 	}
+
+	/// Whether any of the select/create/update/delete clauses directly contains
+	/// a data-modifying statement (GHSA-66r2-5gwj-gxm2).
+	pub(crate) fn has_direct_write(&self) -> bool {
+		self.select.has_direct_write()
+			|| self.create.has_direct_write()
+			|| self.update.has_direct_write()
+			|| self.delete.has_direct_write()
+	}
 }
 
 impl InfoStructure for Permissions {
```

**File**: `surrealdb/core/src/dbs/options.rs` (modified, +24/-0)
```diff
@@ -33,6 +33,14 @@ pub struct Options {
 	pub(crate) force: Force,
 	/// Should we run permissions checks?
 	pub(crate) perms: bool,
+	/// Are we evaluating a `PERMISSIONS` predicate (WHERE clause)?
+	///
+	/// Permission predicates are computed with `perms` disabled so they don't
+	/// recurse into their own table's gates. While that is in effect, mutating
+	/// statements (CREATE/UPDATE/DELETE/RELATE/INSERT/UPSERT and DDL) must be
+	/// rejected so a predicate cannot produce observable side effects
+	/// (see `SECURITY_GUIDE.md`).
+	pub(crate) permission_predicate: bool,
 	/// Should we process field queries?
 	pub(crate) import: bool,
 	/// The data version as a timestamp
@@ -55,6 +63,7 @@ impl Options {
 			db: None,
 			dive: config.max_computation_depth,
 			perms: true,
+			permission_predicate: false,
 			force: Force::None,
 			import: false,
 			auth: Arc::new(Auth::default()),
@@ -182,6 +191,21 @@ impl Options {
 		}
 	}
 
+	/// Create a new Options object for evaluating a `PERMISSIONS` predicate.
+	///
+	/// Disables permission recursion (like `new_with_perms(false)`) and marks
+	/// the frame as a permission-predicate evaluation, so any attempt to run a
+	/// mutating statement within the predicate is rejected by `Expr::compute`.
+	/// Use this instead of `new_with_perms(false)` at every site that computes
+	/// a stored `Permission::Specific(..)` clause.
+	pub fn new_for_permission_predicate(&self) -> Self {
+		Self {
+			perms: false,
+			permission_predicate: true,
+			..self.clone()
+		}
+	}
+
 	/// Create a new Options object for a subquery
 	pub fn new_with_force(&self, force: Force) -> Self {
 		Self {
```

---

### Incident Patch 3: `c39b8a66` (2026-07-01)
**Commit Message**: fix(surrealml): reject malformed model headers instead of panicking (GHSA-jwr6-6444-28xv) (#437)

**File**: `surrealml/core/src/storage/header/input_dims.rs` (modified, +54/-9)
```diff
@@ -1,6 +1,9 @@
 //! InputDims is a struct that holds the dimensions of the input tensors for the model.
 use std::fmt;
 
+use crate::errors::error::{SurrealError, SurrealErrorStatus};
+use crate::safe_eject;
+
 /// InputDims is a struct that holds the dimensions of the input tensors for the model.
 ///
 /// # Fields
@@ -27,16 +30,30 @@ impl InputDims {
 	/// * `data` - The dimensions as a string.
 	///
 	/// # Returns
-	/// A new `InputDims` struct.
-	pub fn from_string(data: String) -> InputDims {
+	/// A new `InputDims` struct, or a `SurrealError` if the dimensions are malformed.
+	pub fn from_string(data: String) -> Result<InputDims, SurrealError> {
 		if data == *"" {
-			return InputDims::fresh();
+			return Ok(InputDims::fresh());
 		}
-		let dims: Vec<&str> = data.split(",").collect();
-		let dims: Vec<i32> = dims.iter().map(|x| x.parse::<i32>().unwrap()).collect();
-		InputDims {
-			dims: [dims[0], dims[1]],
+		let parts: Vec<&str> = data.split(",").collect();
+		// Reject input that does not contain exactly two dimensions so that the indexing
+		// below cannot panic on attacker-controlled header data.
+		if parts.len() != 2 {
+			return Err(SurrealError::new(
+				format!(
+					"invalid input dimensions '{}': expected 2 comma-separated values, found {}",
+					data,
+					parts.len()
+				),
+				SurrealErrorStatus::BadRequest,
+			));
 		}
+		Ok(InputDims {
+			dims: [
+				safe_eject!(parts[0].parse::<i32>(), SurrealErrorStatus::BadRequest),
+				safe_eject!(parts[1].parse::<i32>(), SurrealErrorStatus::BadRequest),
+			],
+		})
 	}
 }
 
@@ -64,14 +81,42 @@ pub mod tests {
 
 	#[test]
 	fn test_from_string() {
-		let input_dims = InputDims::from_string("1,2".to_string());
+		let input_dims = InputDims::from_string("1,2".to_string()).unwrap();
 		assert_eq!(input_dims.dims[0], 1);
 		assert_eq!(input_dims.dims[1], 2);
 	}
 
 	#[test]
 	fn test_to_string() {
-		let input_dims = InputDims::from_string("1,2".to_string());
+		let input_dims = InputDims::from_string("1,2".to_string()).unwrap();
 		assert_eq!(input_dims.to_string(), "1,2".to_string());
 	}
+
+	#[test]
+	fn test_from_string_empty_is_fresh() {
+		let input_dims = InputDims::from_string("".to_string()).unwrap();
+		assert_eq!(input_dims, InputDims::fresh());
+	}
+
+	// Regression tests for GHSA-jwr6-6444-28xv: malformed dimensions in a `.surml`
+	// header must surface a structured error instead of panicking (the release
+	// profile uses `panic = 'abort'`, so a panic here would crash the server).
+	#[test]
+	fn test_from_string_non_numeric_errors() {
+		// The exact malformed value from the advisory proof-of-concept.
+		let err = InputDims::from_string("bad".to_string()).unwrap_err();
+		assert_eq!(err.status, SurrealErrorStatus::BadRequest);
+	}
+
+	#[test]
+	fn test_from_string_too_few_dims_errors() {
+		let err = InputDims::from_string("1".to_string()).unwrap_err();
+		assert_eq!(err.status, SurrealErrorStatus::BadRequest);
+	}
+
+	#[test]
+	fn test_from_string_too_many_dims_errors() {
+		let err = InputDims::from_string("1,2,3".to_string()).unwrap_err();
+		assert_eq!(err.status, SurrealErrorStatus::BadRequest);
+	}
 }
```

**File**: `surrealml/core/src/storage/header/mod.rs` (modified, +12/-2)
```diff
@@ -188,7 +188,7 @@ impl Header {
 		let description = StringValue::from_string(buffer.get(6).unwrap_or(&"").to_string());
 		let engine = Engine::from_string(buffer.get(7).unwrap_or(&"").to_string());
 		let origin = Origin::from_string(buffer.get(8).unwrap_or(&"").to_string())?;
-		let input_dims = InputDims::from_string(buffer.get(9).unwrap_or(&"").to_string());
+		let input_dims = InputDims::from_string(buffer.get(9).unwrap_or(&"").to_string())?;
 		Ok(Header {
 			keys,
 			normalisers,
@@ -259,7 +259,7 @@ mod tests {
 			Header::delimiter(),
 			Origin::from_string("author=>local".to_string()).unwrap(),
 			Header::delimiter(),
-			InputDims::from_string("1,2".to_string()),
+			InputDims::from_string("1,2".to_string()).unwrap(),
 			Header::delimiter(),
 		)
 	}
@@ -299,6 +299,16 @@ mod tests {
 		assert_eq!(header, Header::fresh());
 	}
 
+	// Regression test for GHSA-jwr6-6444-28xv: the malformed header from the advisory
+	// proof-of-concept (a non-numeric `bad` input-dimensions field) must produce a
+	// structured error instead of panicking the parser.
+	#[test]
+	fn test_from_bytes_malformed_header_does_not_panic() {
+		let header = "//=>//=>//=>//=>m//=>1.2.3//=>desc//=>pytorch//=>author=>local//=>bad//=>";
+		let result = Header::from_bytes(header.as_bytes().to_vec());
+		assert!(result.is_err());
+	}
+
 	#[test]
 	fn test_to_bytes() {
 		let header = Header::from_bytes(generate_bytes()).unwrap();
```

**File**: `surrealml/core/src/storage/header/origin.rs` (modified, +12/-2)
```diff
@@ -3,6 +3,7 @@ use std::fmt;
 
 use super::string_value::StringValue;
 use crate::errors::error::{SurrealError, SurrealErrorStatus};
+use crate::safe_eject_option;
 
 const LOCAL: &str = "local";
 const SURREAL_DB: &str = "surreal_db";
@@ -111,8 +112,10 @@ impl Origin {
 			return Ok(Origin::fresh());
 		}
 		let mut split = origin.split("=>");
-		let author = split.next().unwrap().to_string();
-		let origin = split.next().unwrap().to_string();
+		// Avoid unchecked `unwrap()` on attacker-controlled header data: a malformed
+		// origin field (e.g. one missing the `=>` delimiter) must error, not panic.
+		let author = safe_eject_option!(split.next()).to_string();
+		let origin = safe_eject_option!(split.next()).to_string();
 		Ok(Origin {
 			origin: OriginValue::from_string(origin)?,
 			author: StringValue::from_string(author),
@@ -178,4 +181,11 @@ mod tests {
 		assert_eq!(None, origin.author.value);
 		assert_eq!("local".to_string(), origin.origin.to_string());
 	}
+
+	// Regression test for GHSA-jwr6-6444-28xv: a non-empty origin field without the
+	// `=>` delimiter must error rather than panic on `split.next().unwrap()`.
+	#[test]
+	fn test_from_string_missing_delimiter_errors() {
+		assert!(Origin::from_string("no-delimiter".to_string()).is_err());
+	}
 }
```

**File**: `surrealml/core/src/storage/header/output.rs` (modified, +10/-1)
```diff
@@ -69,7 +69,9 @@ impl Output {
 		let normaliser = safe_eject_option!(buffer.next());
 		let normaliser = match normaliser {
 			"none" => None,
-			_ => Some(NormaliserType::from_string(data).unwrap().0),
+			// Propagate malformed-normaliser errors instead of `unwrap()`-panicking on
+			// attacker-controlled header data.
+			_ => Some(NormaliserType::from_string(data)?.0),
 		};
 		Ok(Output {
 			name,
@@ -151,4 +153,11 @@ pub mod tests {
 		let output = Output::fresh();
 		assert_eq!(output.to_string(), "");
 	}
+
+	// Regression test for GHSA-jwr6-6444-28xv: a malformed normaliser in the output
+	// field must error rather than panic on `NormaliserType::from_string(..).unwrap()`.
+	#[test]
+	fn test_from_string_malformed_normaliser_errors() {
+		assert!(Output::from_string("col=>garbage".to_string()).is_err());
+	}
 }
```

**File**: `surrealml/core/src/storage/surml_file.rs` (modified, +18/-0)
```diff
@@ -214,4 +214,22 @@ mod tests {
 			}
 		}
 	}
+
+	// Regression test for GHSA-jwr6-6444-28xv: a tiny malformed `.surml` upload (the
+	// advisory proof-of-concept) reaches `SurMlFile::from_bytes` from the `/ml/import`
+	// endpoint. It must return a structured error rather than panicking, which on a
+	// release build (`panic = 'abort'`) would terminate the whole server process.
+	#[test]
+	fn test_malformed_surml_does_not_panic() {
+		let header = b"//=>//=>//=>//=>m//=>1.2.3//=>desc//=>pytorch//=>author=>local//=>bad//=>";
+		let mut payload = Vec::new();
+		payload.extend_from_slice(&(header.len() as u32).to_be_bytes());
+		payload.extend_from_slice(header);
+		payload.extend_from_slice(b"model");
+
+		match SurMlFile::from_bytes(payload) {
+			Ok(_) => panic!("malformed surml file should not parse successfully"),
+			Err(error) => assert_eq!(error.status, SurrealErrorStatus::BadRequest),
+		}
+	}
 }
```

#### Recent Merged Pull Requests:
- **PR #7587** (closed): Update CLI banner (@martinschaer)
- **PR #7521** (closed): Fix KILLED notifications being dropped by the WebSocket client. (@BarronKane)
- **PR #7520** (closed): Carry the owning session id on Killed notifications. (@BarronKane)
- **PR #7517** (closed): fix(tikv): fallback 0 gRPC message size configs to default 4MB (@Tyagiquamar)
- **PR #7515** (closed): perf(core): add Value::pick_cow for borrow-based field access (@Christian-Sidak)
- **PR #7506** (closed): fix: preserve sequence positions in exports (@atirna)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
