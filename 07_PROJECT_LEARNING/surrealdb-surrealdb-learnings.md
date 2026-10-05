# Forensic Learning Record (Deep Inspection): surrealdb/surrealdb

> **Canonical Artifact**: `07_PROJECT_LEARNING/surrealdb-surrealdb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/surrealdb/surrealdb](https://github.com/surrealdb/surrealdb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:18:31.853Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `surrealdb/surrealdb`
- **Description**: A scalable, distributed, collaborative, document-graph database, for the realtime web
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 33103 stars

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

### Core Architecture Module: `surrealdb/core/src/api/err.rs`
```
use http::StatusCode;
use surrealdb_types::{Error as TypesError, SerializationError};
use thiserror::Error;

use crate::expr::Bytesize;

#[derive(Error, Debug)]
pub enum ApiError {
	#[error("Invalid request body: Expected data frame but received another frame type")]
	InvalidRequestBody,

	#[error("Invalid request body: The body exceeded the max payload size of {0}")]
	RequestBodyTooLarge(Bytesize),

	#[error("Failed to decode the request body")]
	BodyDecodeFailure,

	#[error("Failed to encode the response body")]
	BodyEncodeFailure,

	#[error("Invalid API response: {0}")]
	InvalidApiResponse(String),

	#[error("Invalid Accept or Content-Type header")]
	InvalidFormat,

	#[error("Missing Accept or Content-Type header")]
	MissingFormat,

	#[error("An unreachable error occurred: {0}")]
	Unreachable(String),

	// Status code errors
	#[error("Invalid HTTP status code: {0}. Must be between 100 and 599")]
	InvalidStatusCode(i64),

	// Header errors
	#[error("Invalid header name: {0}")]
	InvalidHeaderName(String),

	#[error("Invalid header value for {name}: {value}")]
	InvalidHeaderValue {
		name: String,
		value: String,
	},

	#[error("Header value contains invalid characters: {0}")]
	HeaderInjectionAttempt(String),

	// Content type errors
	#[error("Missing required Content-Type header")]
	MissingContentType,

	#[error("Unsupported Content-Type: {0}")]
	UnsupportedContentType(String),

	#[error("Expected Content-Type to be {0}")]
	InvalidContentType(String),

	#[error("No output strategy was possible for this API request")]
	NoOutputStrategy,

	// Request/Response errors
	#[error("Invalid request body: Expected {expected} but received {actual}")]
	InvalidRequestBodyType {
		expected: String,
		actual: String,
	},

	#[error("Failed to parse request in middleware: {middleware}")]
	MiddlewareRequestParseFailure {
		middleware: String,
	},

	#[error("Failed to resolve middleware function: {function}")]
	MiddlewareFunctionNotFound {
		function: String,
	},

	#[error("Failed to parse request in final action handler")]
	FinalActionRequestParseFailure,

	// Body parsing errors
	#[error("Request body must be binary data")]
	RequestBodyNotBinary,

	#[error("Permission denied: You are not allowed to access this resource")]
	PermissionDenied,

	#[error("Not found")]
	NotFound,
}

impl ApiError {
	pub fn status_code(&self) -> StatusCode {
		match self {
			Self::InvalidRequestBody => StatusCode::BAD_REQUEST,
			Self::RequestBodyTooLarge(_) => StatusCode::PAYLOAD_TOO_LARGE,
			Self::BodyDecodeFailure => StatusCode::BAD_REQUEST,
			Self::BodyEncodeFailure => StatusCode::INTERNAL_SERVER_ERROR,
			Self::InvalidApiResponse(_) => StatusCode::INTERNAL_SERVER_ERROR,
			Self::InvalidFormat => StatusCode::BAD_REQUEST,
			Self::MissingFormat => StatusCode::BAD_REQUEST,
			Self::Unreachable(_) => StatusCode::INTERNAL_SERVER_ERROR,
			Self::InvalidStatusCode(_) => StatusCode::BAD_REQUEST,
			Self::InvalidHeaderName(_) => StatusCode::BAD_REQUEST,
			Self::InvalidHeaderValue {
				..
			} => StatusCode::BAD_REQUEST,
			Self::HeaderInjectionAttempt(_) => StatusCode::BAD_REQUEST,
			Self::MissingContentType => StatusCode::BAD_REQUEST,
			Self::UnsupportedContentType(_) => StatusCode::UNSUPPORTED_MEDIA_TYPE,
			Self::InvalidContentType(_) => StatusCode::BAD_REQUEST,
			Self::NoOutputStrategy => StatusCode::NOT_ACCEPTABLE,
			Self::InvalidRequestBodyType {
				..
			} => StatusCode::BAD_REQUEST,
			Self::MiddlewareRequestParseFailure {
				..
			} => StatusCode::BAD_REQUEST,
			Self::MiddlewareFunctionNotFound {
				..
			} => StatusCode::INTERNAL_SERVER_ERROR,
			Self::FinalActionRequestParseFailure => StatusCode::BAD_REQUEST,
			Self::RequestBodyNotBinary => StatusCode::BAD_REQUEST,
			Self::PermissionDenied => StatusCode::FORBIDDEN,
			Self::NotFound => StatusCode::NOT_FOUND,
		}
	}

	pub(crate) fn to_types_error(&self) -> TypesError {
		let msg = self.to_string();
		match &self {
			Self::NotFound => TypesError::not_found(msg, None),
			Self::PermissionDenied => TypesError::not_allowed(msg, None),
			Self::BodyDecodeFailure | Self::InvalidApiResponse(_) => {
				TypesError::serialization(msg, SerializationError::Deserialization)
			}
			Self::BodyEncodeFailure => {
				TypesError::serialization(msg, SerializationError::Serialization)
			}
			Self::MiddlewareFunctionNotFound {
				..
			} => TypesError::configuration(msg, None),
			Self::MiddlewareRequestParseFailure {
				..
			}
			| Self::FinalActionRequestParseFailure
			| Self::InvalidRequestBody
			| Self::InvalidFormat
			| Self::MissingFormat
			| Self::InvalidStatusCode(_)
			| Self::InvalidHeaderName(_)
			| Self::InvalidHeaderValue {
				..
			}
			| Self::HeaderInjectionAttempt(_)
			| Self::MissingContentType
			| Self::InvalidContentType(_)
			| Self::InvalidRequestBodyType {
				..
			}
			| Self::RequestBodyNotBinary
			| Self::RequestBodyTooLarge(_)
			| Self::NoOutputStrategy
			| Self::UnsupportedContentType(_) => TypesError::validation(msg, None),
			_ => TypesError::internal(msg),
		}
	}

	pub fn into_types_error(self) -> TypesError {
		self.to_types_error()
	}
}

```

### Core Architecture Module: `surrealdb/core/src/api/invocation.rs`
```
use std::sync::Arc;

use anyhow::Result;
use http::HeaderValue;
use reblessive::TreeStack;
use reblessive::tree::Stk;
use tracing::{debug, error, trace};

use super::response::ApiResponse;
use crate::api::X_SURREAL_REQUEST_ID;
use crate::api::err::ApiError;
use crate::api::request::ApiRequest;
use crate::catalog::providers::DatabaseProvider;
use crate::catalog::{ApiDefinition, MiddlewareDefinition, Permission};
use crate::ctx::{Context, FrozenContext};
use crate::dbs::Options;
use crate::doc::CursorDoc;
use crate::expr::{Expr, FlowResultExt as _};
use crate::fnc::args::{Any, FromArgs, FromPublic};
use crate::iam::{Action, AuthLimit};
use crate::syn::function_with_capabilities;
use crate::val::{Closure, Value};

/// Processes an API request through the middleware chain and executes the handler.
///
/// This function orchestrates the entire API request lifecycle:
/// 1. Finds the appropriate handler based on HTTP method
/// 2. Collects middleware from database-level, route-level, and method-level configs
/// 3. Builds a middleware chain in execution order
/// 4. Executes the middleware chain with the final handler
/// 5. Returns an [`ApiResponse`]; no handler or permission denied yield 404/403 responses.
///
/// # Arguments
/// * `ctx` - The frozen context containing database and transaction information
/// * `opt` - Database options including permissions
/// * `api` - The API definition containing path, handlers, and middleware configuration
/// * `req` - The incoming API request with method, headers, body, params, etc.
///
/// # Returns
/// * `Ok(response)` - Processed request; includes 404/403 when no handler or permission denied
/// * `Err(e)` - Error during processing (e.g. middleware or handler failure)
pub async fn process_api_request(
	ctx: &FrozenContext,
	opt: &Options,
	api: &ApiDefinition,
	req: ApiRequest,
) -> Result<ApiResponse> {
	let mut stack = TreeStack::new();
	stack.enter(|stk| process_api_request_with_stack(stk, ctx, opt, api, req)).finish().await
}

/// Internal version of `process_api_request` that uses an existing stack.
///
/// This function is used internally when a stack is already available,
/// avoiding the overhead of creating a new stack.
///
/// # Arguments
/// * `stk` - The existing reblessive stack for async execution
/// * `ctx` - The frozen context containing database and transaction information
/// * `opt` - Database options including permissions
/// * `api` - The API definition containing path, handlers, and middleware configuration
/// * `req` - The incoming API request with method, headers, body, params, etc.
///
/// # Returns
/// * `Ok(response)` - Processed request; 404/403 when no handler or permission denied
/// * `Err(e)` - Error during processing (e.g. middleware or handler failure)
pub async fn process_api_request_with_stack(
	stk: &mut Stk,
	ctx: &FrozenContext,
	opt: &Options,
	api: &ApiDefinition,
	req: ApiRequest,
) -> Result<ApiResponse> {
	// Tenant-boundary enforcement. The API handler ultimately runs with
	// permissions disabled, so reaching it for a namespace/database the caller
	// is not authenticated for is a cross-tenant authorization bypass. The
	// selected ns/db can be steered by caller-controlled input — the URL path
	// on the HTTP route, or session headers / `USE` for `api::invoke` — so the
	// authenticated level is the only trustworthy scope. Both entry points
	// converge here, making this the authoritative gate (GHSA-848m-r628-vrxw).
	let (ns_name, db_name) = opt.ns_db()?;
	if !opt.auth.can_access_ns_db(ns_name, db_name) {
		trace!(
			request_id = %req.request_id,
			"API request denied: selected namespace/database is outside the authenticated session scope"
		);
		return Ok(ApiResponse::from_error(ApiError::PermissionDenied, req.request_id.clone()));
	}

	// `DefineApiStatement::compute` rejects duplicate methods across `FOR`
	// clauses and `AlterApiStatement::compute` strips a method from any
	// pre-existing action before adding a new one for it, so at most one
	// stored action contains a given `ApiMethod`. `find` is the right matcher.
	let method_action = api.actions.iter().find(|x| x.methods.contains(&req.method));

	let (action_expr, method_config) = match (method_action, &api.fallback) {
		(Some(x), _) => (x.action.clone(), Some(&x.config)),
		(None, Some(x)) => (x.clone(), None),
		// nothing to do, just return
		_ => {
			trace!(
				request_id = %req.request_id,
				method = ?req.method,
				"No matching handler or fallback for API request"
			);
			let res = ApiResponse::from_error(ApiError::NotFound, req.request_id.clone());
			return Ok(res);
		}
	};

	let (ns, db) = ctx.expect_ns_db_ids(opt).await?;
	let global_entry = ctx.tx().get_db_config(ns, db, "api", None).await?;
	let global = global_entry.as_ref().map(|v| v.try_as_api()).transpose()?;

	// Check permissions
	if ctx.check_perms(opt, Action::Edit)? {
		let permissions: Vec<&Permission> = method_config
			.map(|config| &config.permissions)
			.into_iter()
			.chain(std::iter::once(&api.config.permissions))
			.chain(global.as_ref().map(|config| &config.permissions))
			.collect();

		// Iterate through permissions and process them
		for permission in permissions {
			match permission {
				Permission::None => {
					trace!(
						request_id = %req.request_id,
						"API request denied by PERMISSIONS NONE"
					);
					let res =
						ApiResponse::from_error(ApiError::PermissionDenied, req.request_id.clone());
					return Ok(res);
				}
				Permission::Full => (),
				Permission::Specific(e) => {
					// Disable permission recursion and block side effects
					let opt = &opt.new_for_permission_predicate();
					// Process the PERMISSION clause
					if !stk
						.run(|stk| e.compute(stk, ctx, opt, None))
						.await
						.catch_return()?
						.is_truthy()
					{
						trace!(
							request_id = %req.request_id,
							"API request denied by PERMISSIONS WHERE clause"
						);
						let res = ApiResponse::from_error(
							ApiError::PermissionDenied,
							req.request_id.clone(),
						);
						return Ok(res);
					}
				}
			}
		}
	}

	let middleware: Vec<_> = global
		.into_iter()
		.flat_map(|cfg| cfg.middleware.iter().cloned())
		.chain(api.config.middleware.iter().cloned())
		.chain(method_config.into_iter().flat_map(|config| config.middleware.iter().cloned()))
		.collect();

	// Create the final action closure (end of the middleware chain)
	let final_action = create_final_action_closure(req.request_id.clone(), action_expr);

	// Build the middleware chain backwards, wrapping each middleware around the previous closure
	let middleware_len = middleware.len();
	let next = middleware.iter().rev().enumerate().fold(final_action, |next, (idx, def)| {
		// is_initial is true for the first middleware in execution order (furthest from action)
		// When reversed, the last index is the first middleware
		let is_initial = idx == middleware_len.saturating_sub(1);
		create_middleware_closure(req.request_id.clone(), def.clone(), next, is_initial)
	});

	// APIs run without permissions & limit auth
	let opt = AuthLimit::try_from(&api.auth_limit)?.limit_opt(opt);
	let opt = opt.new_with_perms(false);

	debug!(
		request_id = %req.request_id,
		middleware_count = middleware.len(),
		"Executing API middleware chain"
	);
	let mut res: ApiResponse =
		next.invoke(stk, ctx, &opt, None, vec![req.into()]).await?.try_into()?;

	// Ensure X-Surreal-Request-ID is present in final response headers (from res.request_id)
	res.ensure_request_id_header();

	Ok(res)
}

/// Creates a closure that executes the final API action handler.
///
/// This closure is the end of the middleware chain and directly executes
/// the action expression with the request in the context.
///
/// # Arguments
/// * `action_expr` - The expression to execute as the final action
fn create_final_action_closure(request_id: String, action_expr: Expr) -> Closure {
	Closure::Builtin(Arc::new(
		move |stk: &mut Stk,
		      ctx: &FrozenContext,
		      opt: &Options,
		      doc: Option<&CursorDoc>,
		      args: Any| {
			// Extract request argument
			let (FromPublic(mut req),): (FromPublic<ApiRequest>,) =
				match FromArgs::from_args("", args.0) {
					Ok(v) => v,
					Err(_e) => {
						return Box::pin(std::future::ready(Err(
							ApiError::FinalActionRequestParseFailure.into(),
						)));
					}
				};

			// Enforce request ID in request headers & object (prevent user modification)
			req.request_id.clone_from(&request_id);
			if !request_id.is_empty() {
				let _ = req.headers.insert(
					X_SURREAL_REQUEST_ID,
					HeaderValue::from_str(&request_id)
						.unwrap_or_else(|_| HeaderValue::from_static("unknown")),
				);
			}

			// Update context
			let mut ctx_isolated = Context::new_isolated(ctx);
			ctx_isolated.add_value("request", Arc::new(req.into()));
			let ctx_frozen = ctx_isolated.freeze();

			// Clone required values
			let action_expr = action_expr.clone();
			let request_id = request_id.clone();
			// Execute
			Box::pin(stk.run(async move |stk| {
				// Computed result
				let res = action_expr.compute(stk, &ctx_frozen, opt, doc).await.catch_return();

				// Convert to ApiResponse; set request_id from request for all responses
				let mut res = match res {
					Ok(res) => ApiResponse::try_from(res)
						.unwrap_or_else(|e| ApiResponse::from_error(e, request_id.clone())),
					Err(e) => ApiResponse::from_error(e, request_id.clone()),
				};
				res.request_id.clone_from(&request_id);
				res.ensure_request_id_header();

				Ok(Value::from(res))
			}))
		},
	))
}

/// Creates a closure that executes a middleware function.
///
/// This closure wraps the next middleware/handler in the chain and calls
/// the middleware function with the request and next closure.
///
/// # Arguments
/// * `def` - The middleware definition
/// * `next` - The next closure in the chain
/// * `is_initial` - Whether this is the initial middleware (furthest from action)
fn create_middleware_closure(
	request_id: String,
	def
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7554** (2026-10-01): **panicked at surrealdb/kvs-rocksdb/src/owned_tx.rs**
  *Symptoms*: ### What component does this affect?  SurrealDB Server  ### Describe the bug  Performing an update it crashes the server completely.  ``` Sep 30 14:05:53 db surreal[1774558]: thread 'surrealdb-worker' (1774566) panicked at surrealdb/kvs-rocksdb/src/owned_tx.rs:217:13: Sep 30 14:05:53 db surreal[1774558]: Cursor alive while trying to rollback transaction ```  ### Steps to reproduce  1. Create database (see seed data) 2. Run query (see query)   ```surql -- SEED DATA -- Synthetic legacy tenant data. Run only in a disposable SurrealDB 3.3.0 database. DEFINE NAMESPACE repro; DEFINE DATABASE repro; DEFINE TABLE chat_conversation SCHEMALESS; DEFINE TABLE dashboard_contribution SCHEMALESS; DEFINE TABLE dashboard_total SCHEMALESS; DEFINE TABLE script_migration SCHEMALESS;  FOR $number IN [1, 2, 3, 4, 5, 6] {     CREATE type::record('chat_conversation', string::concat('legacy_', <string>$number)) CONTENT {         title: string::concat('Synthetic conversation ', <string>$number),         created_at: time::now()     }; };  -- A conversation update refreshes its derived dashboard row in the same transaction. -- The refresh reads the source table while the outer UPDATE cursor is active. DEFINE FUNCTION fn::dashboard_refresh($source: record) {     LET $key = type::record('dashboard_contribution', crypto::sha256(<string>$source));     LET $row = SELECT * FROM ONLY $source;     LET $previous = SELECT * FROM ONLY $key;     UPSERT $key SET source = $source, kind = 'chats', site = $row.site,   
  **Post-Mortem & Fix Analysis**:
  > @ssttuu This closing means it is solved in a new release?

- **Issue #7539** (2026-10-05): **Bug: index on an array field gives `acl = x` two answers (count 1, rows none), and `CONTAINS`/`CONTAINSANY` never use it**
  *Symptoms*: ### What component does this affect?  SurrealDB Server  ### Describe the bug  With a standard index on an `array<string>` field, the same equality predicate returns different answers depending on the plan:  - `SELECT count() … WHERE acl = 'a' GROUP ALL` is planned as `IndexCountScan` and returns **1**. The index holds one entry per element, so it counts the record whose array contains `'a'`. - `SELECT … WHERE acl = 'a'` is planned as `IndexScan` on the same index and returns **no rows**, which matches comparing the whole array with a string. - Without the index, the count is **0**.  So adding an index changes a query's result, and the count and the rows it counts disagree. `acl = 'a' OR acl = 'c'` behaves like the row query (`UnionIndexScan`, no rows).  Separately, the membership operators that match what the index stores, `CONTAINS` and `CONTAINSANY`, are always planned as a `TableScan` and never use the index. In practice, an index on an array field can't speed up membership queries, but it can change what an equality or count returns.  Seen on 3.2.4 and unchanged on 3.3.0.  ### Steps to reproduce  ```surql DEFINE TABLE r SCHEMAFULL; DEFINE FIELD acl ON r TYPE array<string>; DEFINE INDEX r_acl ON r FIELDS acl; CREATE r:1 SET acl = ['a', 'b']; CREATE r:2 SET acl = ['c'];  SELECT count() FROM r WHERE acl = 'a' GROUP ALL;   -- [{ count: 1 }]   IndexCountScan SELECT VALUE id FROM r WHERE acl = 'a';            -- []               IndexScan r_acl = 'a' SELECT VALUE id FROM r WHER
  **Post-Mortem & Fix Analysis**:
  > Thanks for the clear report. It reproduces as described, and the problem is a bit wider than the count.  **What's going on.** When a record's value is an array, a b-tree index on a plain column (`FIELDS acl`) stores one entry per element, the same keys as `FIELDS acl.*`. The query planner only treated `*` columns as holding elements, so for a plain column it assumed each entry was the whole value. That gives wrong answers wherever the per-element entries are read as whole values:  - `count() … WHERE acl = 'a'` counts the `'a'` entry of `['a', 'b']`, although `['a', 'b'] = 'a'` is false. The row query is right only because each fetched record is re-checked. - `WHERE acl = ['a', 'b']` looks up a key that was never written and returns no rows. - Range predicates (`acl > 'a'`) can return a record once per matching element, and can miss records whose elements are all out of range even though the whole array compares in range (arrays sort after strings). - `ORDER BY acl` can follow index ent

- **Issue #7538** (2026-09-25): **Bug: HTTP /import closes the connection after an early 400 without `Connection: close`, breaking keep-alive clients**
  *Symptoms*: ### Describe the bug  When `POST /import` rejects a request early (before reading the whole body) and the body is large, SurrealDB answers `400 Bad Request` and then closes the TCP connection **without** sending `Connection: close`. HTTP/1.1 keep-alive clients (e.g. Bun's / Node's `fetch`) put that socket back in their pool and the *next* request on it fails with an error like `The socket connection was closed unexpectedly`.  With a small body the connection stays open, so the behaviour depends on body size (we saw the switch somewhere between 10 KB and 100 KB).  ### Steps to reproduce  Standalone script (Bun; only needs the `surreal` binary on PATH). It sends a raw HTTP/1.1 request so the response headers and connection state are visible; the body is refused at its first statement because it doesn't start with `OPTION IMPORT;`:  ```ts import { connect } from "node:net"; const port = 40000 + Math.floor(Math.random() * 20000); const proc = Bun.spawn(["surreal", "start", "--user", "root", "--pass", "root", "--bind", `127.0.0.1:${port}`, "--log", "warn", `surrealkv://./kv-${port}`], { stdout: "ignore", stderr: "ignore" }); for (let i = 0; i < 100; i++) { try { await fetch(`http://127.0.0.1:${port}/health`); break; } catch { await Bun.sleep(50); } } const auth = "Basic " + btoa("root:root"); await fetch(`http://127.0.0.1:${port}/sql`, { method: "POST", headers: { authorization: auth, accept: "application/json" }, body: "DEFINE NAMESPACE n; USE NS n; DEFINE DATABASE d;" });  funct

- **Issue #7537** (2026-10-05): **Bug: `@@` with a non-constant operand (record field, subquery, `$auth`) errors alone and is silently dropped in an `AND` with another `@@`**
  *Symptoms*: ### What component does this affect?  SurrealDB Server  ### Describe the bug  A full-text match whose right-hand operand is an expression that reads a record or an object parameter, such as `$auth.principals`, `user:alice.name`, a subquery or `$session.ns`, is not resolved before index planning:  1. **On its own**, the query fails with `There was no suitable index supporting the expression: …`, even though a full-text index exists on the field. The same failure occurs next to a KNN operator (`<|k, ef|>`), so the operand cannot be used as a vector pre-filter either. 2. **In an `AND` with a second `@@`**, the query succeeds but the condition is **silently dropped**: rows that don't match it are returned (see `doc:1` below). This returns wrong results without an error.  A literal string, a function of literals (`array::join(['g1', 'g2'], ' ')`), or the same expression bound first with `LET $q = …` all work correctly.  We hit this compiling a per-user ACL pre-filter for hybrid search (`acl_text @2,OR@ array::join($auth.principals, ' ')`, to get 3.3's pre-filtered KNN for record users). Row permissions still applied in our case, but the dropped condition could return unauthorised rows wherever the `@@` condition is the only filter.  ### Steps to reproduce  As root, in `surreal sql` against `surreal start -u root -p root memory`:  ```surql DEFINE TABLE user SCHEMAFULL; DEFINE FIELD principals ON user TYPE array<string>; CREATE user:alice SET principals = ['g1', 'g2'];  DEFINE TABLE

- **Issue #7534** (2026-09-30): **UPDATE/DELETE silently match nothing when WHERE uses IN on the leading field of a compound index (SELECT finds the rows)**
  *Symptoms*: ### What component does this affect?  SurrealDB Server  ### Describe the bug  On a table with a COMPOUND index whose leading field is a record link, `UPDATE` and `DELETE` with `WHERE <leading field> IN $list` silently match nothing, while `SELECT` with the exact same condition returns the row. No error, no warning: the statement 'succeeds' and changes nothing.  - Equality on the same field (`WHERE owner = owner:o`) works. - With a single-column index on the same field, or with no index, everything works. - On a real table we also saw the same with a record-link path in the condition (`WHERE session.uuid = $u`, where `session` leads a compound index `session, file`), but we could not yet reduce that one to a minimal case.  Impact for us: a cleanup `DELETE` 'succeeded' without deleting anything and left about 4,400 orphan rows over two days.  Possibly the same root cause as #7443 (compound-index bounds built with `prefix_ids_end`; that PR also touches `IndexEqualIterator` / `UniqueEqualIterator`), but its tests only cover range operators, not `IN` in `UPDATE`/`DELETE`.  ### Steps to reproduce  Run against an in-memory instance (`surreal start memory`, then `surreal sql`):  ```surql DEFINE TABLE owner SCHEMALESS; DEFINE TABLE item SCHEMALESS; DEFINE INDEX item_owner_file ON item FIELDS owner, file UNIQUE;  CREATE owner:o SET name = 'x'; CREATE item:i SET owner = owner:o, file = 'f', n = 1; LET $l = [owner:o];  SELECT id FROM item WHERE owner IN $l;                     -- [{ id: 

- **Issue #7524** (2026-09-28): **Bug: DEFINE INDEX on a sub-field of a nullable object (`null | { ... }`) fails on SCHEMAFULL tables**
  *Symptoms*: ### Describe the bug  On a `SCHEMAFULL` table, `DEFINE INDEX` rejects a sub-field path when the parent field's type is a union that includes `null`, such as `null | { city: string }`. The same path is accepted when the union includes `none` instead (`option<{ city: string }>`).  There is no workaround that keeps `null`: defining the sub-field explicitly is rejected as a type mismatch with the parent.  This affects every index kind (standard, `UNIQUE`, `FULLTEXT`, `HNSW`, `DISKANN`). Nullable objects are common when records are written from JSON clients, where a missing object is serialized as `null`, and such a field can't be switched to `option<...>` because `option<...>` rejects `NULL`.  ### Steps to reproduce  ```surql DEFINE TABLE person SCHEMAFULL; DEFINE FIELD address ON person TYPE null | { city: string } DEFAULT NULL;  DEFINE INDEX person_city ON person FIELDS address.city; -- Error: The field 'address.city' does not exist  DEFINE FIELD address.city ON person TYPE string; -- Error: Cannot set field `address.city` with type `string` as it mismatched --        with field `address` with type `null | { city: string }`  -- With `none` instead of `null` the index is accepted: DEFINE FIELD OVERWRITE address ON person TYPE option<{ city: string }>; DEFINE INDEX person_city ON person FIELDS address.city; -- OK  -- but `option<...>` doesn't accept NULL values: CREATE person:2 SET address = NULL; -- Error: Couldn't coerce value for field `address` of `person:2`: --        Expect

- **Issue #7522** (2026-10-02): **CSOAI — SurrealDB AI governance multi-model**
  *Symptoms*: Withdrawn. No action is requested from this project.

- **Issue #7521** (2026-09-19): **Fix KILLED notifications being dropped by the WebSocket client.**
  *Symptoms*: ## What is the motivation?  A live query killed over WebSocket never tells its subscriber, so the stream stays open and silent forever.  `DbResult::from_value` decodes a live notification's action with a hand-written match that knows only three of the five `Action` variants ([`response.rs:121`](https://github.com/surrealdb/surrealdb/blob/main/surrealdb/core/src/rpc/response.rs#L121)):  ```rust let action = match action_str.as_str() {     "CREATE" => PublicAction::Create,     "UPDATE" => PublicAction::Update,     "DELETE" => PublicAction::Delete,     _ => return Err(TypesError::internal(format!("Invalid action: {}", action_str))), }; ```  The encoder directly above it hand-rolls nothing — `into_value` writes `v.action.into_value()`, the derived `SurrealValue` impl, which serialises all five variants. So the server sends `KILLED` correctly and the client rejects its own wire format.  The failure is completely silent. A rejected frame goes to `handle_parse_error` in the WebSocket client, which routes deserialization errors to the pending request that caused them — but a notification carries no request id, so the `if let Value::Number(Number::Int(id_num)) = id` arm ([`ws/mod.rs:365`](https://github.com/surrealdb/surrealdb/blob/main/surrealdb/src/engine/remote/ws/mod.rs#L365)) simply does not match, and the frame is discarded with no log line and no error. Nothing anywhere reports that a notification was thrown away.  Consequences, in order of severi
  **Post-Mortem & Fix Analysis**:
  > Closing as I'm turning this into a combined PR.

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

### Incident Patch 1: `18971ffb` (2026-09-04)
**Commit Message**: Fix mem KV put after delete in same transaction (#7368)

Co-authored-by: Rushmore Mushambi <[REDACTED_EMAIL]>

**File**: `language-tests/tests/reproductions/7322_reinsert_deleted_record_in_function.surql` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+/**
+[env]
+namespace = true
+database = true
+auth = { level = "owner" }
+
+[test]
+reason = "A custom function can delete a record and insert the same id again"
+issue = 7322
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "[{ id: t7322:1 }]"
+
+[[test.results]]
+value = "[{ id: t7322:1 }]"
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "[{ id: rel7322:1, in: in7322:1, out: out7322:1 }]"
+
+[[test.results]]
+value = "[{ id: rel7322:1, in: in7322:1, out: out7322:1 }]"
+*/
+
+DEFINE TABLE OVERWRITE t7322;
+
+DEFINE FUNCTION OVERWRITE fn::re_add_record_7322() {
+	DELETE t7322:1;
+	INSERT INTO t7322 { id: 1 };
+};
+
+fn::re_add_record_7322();
+fn::re_add_record_7322();
+
+DEFINE TABLE OVERWRITE rel7322 TYPE RELATION;
+
+DEFINE FUNCTION OVERWRITE fn::re_add_relation_7322() {
+	DELETE rel7322:1;
+	RELATE in7322:1 -> rel7322:1 -> out7322:1;
+};
+
+fn::re_add_relation_7322();
+fn::re_add_relation_7322();
```

**File**: `language-tests/tests/reproductions/7323_reinsert_deleted_record_in_transaction.surql` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+/**
+[env]
+namespace = true
+database = true
+auth = { level = "owner" }
+
+[test]
+reason = "A transaction can delete a record and insert the same id again"
+issue = 7323
+
+[[test.results]]
+value = "[{ id: no_tx7323:1 }]"
+
+[[test.results]]
+value = "[{ id: no_tx7323:1 }]"
+
+[[test.results]]
+value = "[{ id: no_tx7323:1 }]"
+
+[[test.results]]
+value = "[{ id: no_tx7323:1 }]"
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "[{ id: tx7323:1 }]"
+
+[[test.results]]
+value = "[{ id: tx7323:1 }]"
+
+[[test.results]]
+value = "[{ id: tx7323:1 }]"
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "[{ id: rel_tx7323:1, in: in_tx7323:1, out: out_tx7323:1 }]"
+
+[[test.results]]
+value = "[{ id: rel_tx7323:1, in: in_tx7323:1, out: out_tx7323:1 }]"
+
+[[test.results]]
+value = "[{ id: rel_tx7323:1, in: in_tx7323:1, out: out_tx7323:1 }]"
+
+[[test.results]]
+value = "NONE"
+*/
+
+INSERT INTO no_tx7323 { id: 1 };
+DELETE no_tx7323:1 RETURN BEFORE;
+INSERT INTO no_tx7323 { id: 1 };
+DELETE no_tx7323:1 RETURN BEFORE;
+
+BEGIN;
+INSERT INTO tx7323 { id: 1 };
+DELETE tx7323:1 RETURN BEFORE;
+INSERT INTO tx7323 { id: 1 };
+COMMIT;
+
+DEFINE TABLE OVERWRITE rel_tx7323 TYPE RELATION;
+
+BEGIN;
+RELATE in_tx7323:1 -> rel_tx7323:1 -> out_tx7323:1;
+DELETE rel_tx7323:1 RETURN BEFORE;
+RELATE in_tx7323:1 -> rel_tx7323:1 -> out_tx7323:1;
+COMMIT;
```

**File**: `surrealdb/core/src/kvs/mem/mod.rs` (modified, +6/-1)
```diff
@@ -336,7 +336,12 @@ impl Transactable for Transaction {
 			// Load the inner transaction
 			let mut inner = self.inner.write().await;
 			// Set the key if empty
-			inner.put(key, val)?;
+			// `put` checks the base store directly and would reject a key deleted
+			// earlier in this transaction; the current view must decide existence.
+			match inner.get(&key)? {
+				None => inner.set(key, val)?,
+				_ => return Err(Error::TransactionKeyAlreadyExists),
+			}
 			// Return result
 			Ok(())
 		})
```

**File**: `surrealdb/core/src/kvs/tests/raw.rs` (modified, +26/-0)
```diff
@@ -97,6 +97,26 @@ pub async fn put(new_ds: impl CreateDs) {
 	tx.cancel().await.unwrap();
 }
 
+pub async fn put_after_delete(new_ds: impl CreateDs) {
+	// Create a new datastore
+	let node_id = Uuid::parse_str("025a7ced-a8ac-40c9-bd15-3400b714dacc").unwrap();
+	let (ds, _) = new_ds.create_ds(node_id).await;
+	// Create a writeable transaction
+	let tx = ds.transaction(Write, Optimistic).await.unwrap();
+	tx.put(&"test", &"one".as_bytes().to_vec()).await.unwrap();
+	tx.commit().await.unwrap();
+	// Create a writeable transaction
+	let tx = ds.transaction(Write, Optimistic).await.unwrap();
+	tx.del(&"test").await.unwrap();
+	tx.put(&"test", &"two".as_bytes().to_vec()).await.unwrap();
+	tx.commit().await.unwrap();
+	// Create a readonly transaction
+	let tx = ds.transaction(Read, Optimistic).await.unwrap();
+	let val = tx.get(&"test", None).await.unwrap();
+	assert!(matches!(val.as_deref(), Some(b"two")));
+	tx.cancel().await.unwrap();
+}
+
 pub async fn putc(new_ds: impl CreateDs) {
 	// Create a new datastore
 	let node_id = Uuid::parse_str("705bb520-bc2b-4d52-8e64-d1214397e408").unwrap();
@@ -1175,6 +1195,12 @@ macro_rules! define_tests {
 			super::raw::put($new_ds).await;
 		}
 
+		#[tokio::test]
+		#[serial_test::serial]
+		async fn put_after_delete() {
+			super::raw::put_after_delete($new_ds).await;
+		}
+
 		#[tokio::test]
 		#[serial_test::serial]
 		async fn putc() {
```

**File**: `surrealdb/tests/api_integration/basic.rs` (modified, +15/-0)
```diff
@@ -1831,6 +1831,21 @@ pub async fn client_side_transactions(new_db: impl CreateDb) {
 	let users: Vec<User> = db.select("user").await.unwrap();
 	assert_eq!(users.len(), 3); // John, Alice, Bob
 
+	// Test 4: Reinsert the same record id after deleting it in a transaction
+	let id = Resource::from(("tx_reinsert", "same"));
+	let _: Value = db.insert(id.clone()).await.unwrap();
+	let _: Value = db.delete(id.clone()).await.unwrap();
+	let _: Value = db.insert(id.clone()).await.unwrap();
+	let _: Value = db.delete(id.clone()).await.unwrap();
+
+	let txn = db.begin().await.unwrap();
+	let _: Value = txn.insert(id.clone()).await.unwrap();
+	let _: Value = txn.delete(id.clone()).await.unwrap();
+	let _: Value = txn.insert(id).await.unwrap();
+	let db = txn.commit().await.unwrap();
+	let records: Vec<Value> = db.select("tx_reinsert").await.unwrap();
+	assert_eq!(records.len(), 1);
+
 	drop(permit);
 }
 
```

---

### Incident Patch 2: `1a2ebca5` (2026-08-28)
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

### Incident Patch 3: `fd89dbe6` (2026-07-01)
**Commit Message**: feat(language-tests): extend graph bench suite with larger-scale and hub-skewed datasets (#529)

**File**: `language-tests/README.md` (modified, +7/-1)
```diff
@@ -206,6 +206,8 @@ util/                                # import-only datasets (never run on their
   records-100.surql / records-1000.surql       # small row counts for batch CRUD
   graph-sparse-5000.surql            # 5k person nodes + ~2 `knows` edges each (sparse)
   graph-dense-5000.surql             # 5k person nodes + ~10 `knows` edges each (dense)
+  graph-sparse-50000.surql           # 50k person nodes + ~2 `knows` edges each (large, uniform degree)
+  graph-hub-50000.surql              # 50k person nodes; 20 fixed hubs w/ 250 edges, rest w/ 2 (degree-skewed)
   embeddings-hnsw-5000.surql         # 5k 8-d vectors + HNSW index
   embeddings-diskann-5000.surql      # 5k 8-d vectors + DiskANN index
   embeddings-flat-5000.surql         # 5k 8-d vectors, no index (brute-force KNN)
@@ -225,7 +227,11 @@ scans/
 fulltext/                            # BM25 search: single / multi-AND / multi-OR (`@@`)
 graph/                               # 1-/2-hop (+ counts), filtered, mid-path filter, inbound,
                                      #   bidirectional, recursive, path-collect, shortest-path traversals
-                                     #   (each runs against BOTH the sparse and dense graph)
+                                     #   (each runs against BOTH the sparse and dense graph; two_hop and
+                                     #   shortest_path also carry a `large` arm against graph-sparse-50000)
+                                     #   plus deep_recursion (6 hops), hub_fanout (250-edge hub node,
+                                     #   graph-hub-50000 only), and traverse_aggregate (math::mean over
+                                     #   a traversed neighbour set)
 vector/                              # KNN: HNSW vs DiskANN vs brute-force
 references/                          # record references: reverse (`<~`) traversal/count/filtered, FETCH single + array
 mutate/                              # UPDATE/DELETE … WHERE, batch UPSERT, explicit transaction
```

**File**: `language-tests/tests/bench/graph/deep_recursion.surql` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+/**
+[bench]
+reason = "Deeper bounded recursive traversal (up to 6 hops) from one node — the existing `recursive`/`path_collect` benches cap at 3 hops, well short of where BFS frontier growth (especially on the dense graph) starts to dominate"
+run = true
+rebuild = false
+datasets = { sparse = "bench/util/graph-sparse-5000.surql", dense = "bench/util/graph-dense-5000.surql" }
+warmup = "2s"
+sample-size = 50
+measurement-time = "20s"
+
+[test]
+run = false
+*/
+
+person:1.{..6+collect}->knows->person;
```

**File**: `language-tests/tests/bench/graph/hub_fanout.surql` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+/**
+[bench]
+reason = "One-hop fan-out from a high-degree hub node (250 edges), isolating per-edge traversal cost at real-world-skewed degree instead of the uniform low-degree neighbourhoods in graph-sparse/dense"
+run = true
+rebuild = false
+datasets = { hub = "bench/util/graph-hub-50000.surql" }
+warmup = "2s"
+sample-size = 50
+measurement-time = "20s"
+
+[test]
+run = false
+*/
+
+SELECT ->knows->person AS friends, count(->knows) AS degree FROM person:1;
```

**File**: `language-tests/tests/bench/graph/shortest_path.surql` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 reason = "Shortest path (<=8 hops) between two nodes"
 run = true
 rebuild = false
-datasets = { sparse = "bench/util/graph-sparse-5000.surql", dense = "bench/util/graph-dense-5000.surql" }
+datasets = { sparse = "bench/util/graph-sparse-5000.surql", dense = "bench/util/graph-dense-5000.surql", large = "bench/util/graph-sparse-50000.surql" }
 warmup = "2s"
 sample-size = 50
 measurement-time = "20s"
```

**File**: `language-tests/tests/bench/graph/traverse_aggregate.surql` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+/**
+[bench]
+reason = "One-hop traversal feeding an aggregate function (math::mean) over the neighbour set, rather than just counting or projecting it"
+run = true
+rebuild = false
+datasets = { sparse = "bench/util/graph-sparse-5000.surql", dense = "bench/util/graph-dense-5000.surql" }
+warmup = "2s"
+sample-size = 50
+measurement-time = "20s"
+
+[test]
+run = false
+*/
+
+SELECT count(->knows) AS degree, math::mean(->knows->person.age) AS avg_friend_age FROM person LIMIT 1000;
```

**File**: `language-tests/tests/bench/graph/two_hop.surql` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 reason = "Two-hop graph traversal from 1000 nodes"
 run = true
 rebuild = false
-datasets = { sparse = "bench/util/graph-sparse-5000.surql", dense = "bench/util/graph-dense-5000.surql" }
+datasets = { sparse = "bench/util/graph-sparse-5000.surql", dense = "bench/util/graph-dense-5000.surql", large = "bench/util/graph-sparse-50000.surql" }
 warmup = "2s"
 sample-size = 50
 measurement-time = "20s"
```

**File**: `language-tests/tests/bench/util/graph-hub-50000.surql` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+/**
+# Hub-skewed graph dataset: 50000 `person` nodes where 20 designated hubs
+# (`person:1`..`person:20`) each have 250 outgoing `knows` edges and the
+# remaining 49980 nodes have 2, mimicking the degree skew of a real social
+# graph. `graph-sparse-5000` / `graph-dense-5000` vary degree *uniformly*
+# across the whole graph, which never stresses a single-node, high-fan-out
+# traversal — that's what the `graph/hub_fanout` bench (querying `person:1`
+# directly) needs. Hub ids are fixed (not random) so the bench target is
+# reproducible across runs. Built with RELATE so the graph adjacency keys
+# exist. `run = false`.
+
+[test]
+run = false
+
+[[test.results]]
+value = "'OK'"
+*/
+
+{
+	DEFINE TABLE person SCHEMALESS;
+
+	CREATE |person:1..50000| SET
+		name = rand::string(12),
+		age = rand::int(18, 80)
+	RETURN NONE;
+
+	FOR $p IN (SELECT VALUE id FROM person) {
+		LET $degree = IF record::id($p) <= 20 { 250 } ELSE { 2 };
+		FOR $_ IN array::range(0, $degree) {
+			LET $t = type::record('person', rand::int(1, 50000));
+			RELATE $p->knows->$t;
+		};
+	};
+
+	RETURN 'OK';
+}
```

**File**: `language-tests/tests/bench/util/graph-sparse-50000.surql` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+/**
+# Larger-scale sparse graph dataset: 50000 `person` nodes, each with ~2 random
+# `knows` edges (same shape as `graph-sparse-5000`, 10x the node count). Used as
+# the `large` arm of the two-hop / shortest-path benches to see how multi-hop
+# traversal cost changes with graph *size* rather than degree — `graph-dense-5000`
+# already covers the degree axis at the small scale. Built with RELATE so the
+# graph adjacency keys exist. `run = false`.
+
+[test]
+run = false
+
+[[test.results]]
+value = "'OK'"
+*/
+
+{
+	DEFINE TABLE person SCHEMALESS;
+
+	CREATE |person:1..50000| SET
+		name = rand::string(12),
+		age = rand::int(18, 80)
+	RETURN NONE;
+
+	FOR $p IN (SELECT VALUE id FROM person) {
+		LET $a = type::record('person', rand::int(1, 50000));
+		LET $b = type::record('person', rand::int(1, 50000));
+		RELATE $p->knows->$a;
+		RELATE $p->knows->$b;
+	};
+
+	RETURN 'OK';
+}
```

---

### Incident Patch 4: `5642cb8d` (2026-07-01)
**Commit Message**: Add --quick flag to benchmark scripts for fast coarse-grained testing (#530)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `scripts/bench/bench.sh` (modified, +2/-0)
```diff
@@ -32,12 +32,14 @@ Usage:
 Options:
   --profile          record a samply flamegraph instead of measuring timing
   --save             persist this run as the new baseline (measure mode only)
+  --quick            fast, coarse pass: shrinks every timing knob ~10x
   --dataset <name>   for a matrix scan, restrict to one variant (e.g. indexed, unindexed)
   --backend <name>   storage backend (default: mem)
 
 Examples:
   cargo make bench -- scans/count
   cargo make bench -- scans/count --save
+  cargo make bench -- scans/count --quick
   cargo make bench -- scans/where_integer_in_many_full --profile --dataset indexed
 EOF
 }
```

**File**: `scripts/bench/measure.sh` (modified, +8/-3)
```diff
@@ -9,12 +9,15 @@
 # optimisation loop. Within ~1-3% of full-LTO release on hot loops.
 #
 # Usage:
-#   scripts/bench/measure.sh <bench-filter> [--backend mem] [--save] [--out-dir DIR]
+#   scripts/bench/measure.sh <bench-filter> [--backend mem] [--save] [--quick] [--dataset NAME] [--out-dir DIR]
 #
 #   --save   Persist this run as the new baseline in the comparison datastore
 #            (passes `--save` to `bench run`). Omit for a dry comparison against
 #            the existing baseline.
 #
+#   --quick  Fast, coarse pass: shrinks every timing knob ~10x (passes `--quick`
+#            to `bench run`). Catches large regressions, not small drift.
+#
 # The comparison block is produced by the harness itself
 # (language-tests/src/cmd/bench/run.rs): it prints "Performance has improved" /
 # "regressed" / "within noise threshold" / "No change in performance detected"
@@ -28,20 +31,22 @@ set -euo pipefail
 if [[ "${1:-}" == "--" ]]; then shift; fi
 
 if [[ $# -lt 1 ]]; then
-	echo "usage: $0 <bench-filter> [--backend mem] [--save] [--dataset NAME] [--out-dir DIR]" >&2
+	echo "usage: $0 <bench-filter> [--backend mem] [--save] [--quick] [--dataset NAME] [--out-dir DIR]" >&2
 	exit 2
 fi
 
 FILTER="$1"; shift
 BACKEND="mem"
 SAVE=""
+QUICK=""
 DATASET=()
 OUT_DIR="./target/bench-profile"
 
 while [[ $# -gt 0 ]]; do
 	case "$1" in
 		--backend) BACKEND="$2"; shift 2 ;;
 		--save) SAVE="--save"; shift ;;
+		--quick) QUICK="--quick"; shift ;;
 		--dataset) DATASET=(--dataset "$2"); shift 2 ;;
 		--out-dir) OUT_DIR="$2"; shift 2 ;;
 		*) echo "unknown arg: $1" >&2; exit 2 ;;
@@ -58,7 +63,7 @@ LOG="$ROOT/$OUT_DIR/$SLUG.measure.txt"
 FEATURES="bench"; [ "$BACKEND" = "rocksdb" ] && FEATURES="bench,backend-rocksdb"
 
 # shellcheck disable=SC2086
-cargo run --profile profiling --features "$FEATURES" -- bench run --backend "$BACKEND" $SAVE ${DATASET[@]+"${DATASET[@]}"} "$FILTER" \
+cargo run --profile profiling --features "$FEATURES" -- bench run --backend "$BACKEND" $SAVE $QUICK ${DATASET[@]+"${DATASET[@]}"} "$FILTER" \
 	2>&1 | tee "$LOG"
 
 echo ""
```

**File**: `scripts/bench/profile.sh` (modified, +3/-2)
```diff
@@ -13,7 +13,7 @@
 # uses `dtrace`, which is SIP-restricted on macOS).
 #
 # Usage:
-#   scripts/bench/profile.sh <bench-filter> [--backend mem] [--dataset NAME] [--out-dir DIR]
+#   scripts/bench/profile.sh <bench-filter> [--backend mem] [--quick] [--dataset NAME] [--out-dir DIR]
 #
 #   <bench-filter>  Substring matched against the bench file path. Must select
 #                   exactly one bench. For a matrix scan that runs both dataset
@@ -33,7 +33,7 @@ set -euo pipefail
 if [[ "${1:-}" == "--" ]]; then shift; fi
 
 if [[ $# -lt 1 ]]; then
-	echo "usage: $0 <bench-filter> [--backend mem] [--dataset NAME] [--out-dir DIR]" >&2
+	echo "usage: $0 <bench-filter> [--backend mem] [--quick] [--dataset NAME] [--out-dir DIR]" >&2
 	exit 2
 fi
 
@@ -46,6 +46,7 @@ while [[ $# -gt 0 ]]; do
 	case "$1" in
 		--backend) BACKEND="$2"; shift 2 ;;
 		--out-dir) OUT_DIR="$2"; shift 2 ;;
+		--quick) EXTRA+=(--quick); shift ;;
 		--dataset) EXTRA+=(--dataset "$2"); shift 2 ;;
 		*) echo "unknown arg: $1" >&2; exit 2 ;;
 	esac
```

---

### Incident Patch 5: `c7461ac9` (2026-07-01)
**Commit Message**: fix(core): remove redundant clone in legacy_handles (#526)

**File**: `surrealdb/core/src/exec/operators/mutate.rs` (modified, +1/-1)
```diff
@@ -256,7 +256,7 @@ impl ExecOperator for DeleteBinding {
 fn legacy_handles(ctx: &ExecutionContext) -> FlowResult<(Options, FrozenContext)> {
 	let (opt, frozen) =
 		get_legacy_context(ctx).map_err(|e| ControlFlow::Err(anyhow::anyhow!(e)))?;
-	Ok((opt.clone(), frozen))
+	Ok((opt, frozen))
 }
 
 /// Recover the record id of the node/edge bound at `name` via the shared
```

---

### Incident Patch 6: `1e4c3d74` (2026-07-01)
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

### Incident Patch 7: `aabd2e05` (2026-07-01)
**Commit Message**: fix(core): shard DiskANN pending keys, upgrade diskann to 0.54.0 (#427)

Co-authored-by: Tobie Morgan Hitchcock <[REDACTED_EMAIL]>

**File**: `Cargo.lock` (modified, +8/-8)
```diff
@@ -2112,9 +2112,9 @@ dependencies = [
 
 [[package]]
 name = "diskann"
-version = "0.53.0"
+version = "0.54.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "376186e025eb294c22f06236b23417608f1867def159c3a61a5c57788a3e889e"
+checksum = "421c6cf955c6cb1451d36c8a3740ab2a22880265d0fa93d8ea22cbc425c90479"
 dependencies = [
  "anyhow",
  "bytemuck",
@@ -2132,9 +2132,9 @@ dependencies = [
 
 [[package]]
 name = "diskann-utils"
-version = "0.53.0"
+version = "0.54.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7b70289db1b66826fa1ef2b4113bf2f9d0dedc8df983b2b804c38dc1e519e15e"
+checksum = "7cdf7d491910fbff13338e07460c9197a3c172268cfd4d8f8e69e5cec5a256d9"
 dependencies = [
  "bytemuck",
  "cfg-if",
@@ -2149,9 +2149,9 @@ dependencies = [
 
 [[package]]
 name = "diskann-vector"
-version = "0.53.0"
+version = "0.54.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f62c9d81aad6e3df6a026b1bb693dbbcfbee5ea93d9e7a5ff15c31576263bc29"
+checksum = "de1643bbece645f03527ef120bc7dd5e4e40557980dbe52ee51129adfb58a851"
 dependencies = [
  "cfg-if",
  "diskann-wide",
@@ -2160,9 +2160,9 @@ dependencies = [
 
 [[package]]
 name = "diskann-wide"
-version = "0.53.0"
+version = "0.54.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "46fcacef8ea9274969f98499456718f3dcaa5d3d7392b3171079653370fa0b20"
+checksum = "421f02c42e57a2153dc65b66b4b95fe2be56e14bf9f95253b663abcac8521166"
 dependencies = [
  "cfg-if",
  "half",
```

**File**: `Cargo.toml` (modified, +3/-3)
```diff
@@ -122,9 +122,9 @@ clap = "4.6.1"
 dashmap = "6.1.0"
 dialoguer = "0.11"
 deunicode = "1.6.2"
-diskann = { version = "=0.53.0", default-features = false }
-diskann-utils = "=0.53.0"
-diskann-vector = "=0.53.0"
+diskann = { version = "=0.54.0", default-features = false }
+diskann-utils = "=0.54.0"
+diskann-vector = "=0.54.0"
 ext-sort = "^0.1.5"
 fastnum = "0.7.4"
 flatbuffers = { version = "25.12.19", features = ["serde"] }
```

**File**: `language-tests/Cargo.lock` (modified, +13/-13)
```diff
@@ -1150,9 +1150,9 @@ dependencies = [
 
 [[package]]
 name = "diskann"
-version = "0.53.0"
+version = "0.54.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "376186e025eb294c22f06236b23417608f1867def159c3a61a5c57788a3e889e"
+checksum = "421c6cf955c6cb1451d36c8a3740ab2a22880265d0fa93d8ea22cbc425c90479"
 dependencies = [
  "anyhow",
  "bytemuck",
@@ -1170,9 +1170,9 @@ dependencies = [
 
 [[package]]
 name = "diskann-utils"
-version = "0.53.0"
+version = "0.54.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7b70289db1b66826fa1ef2b4113bf2f9d0dedc8df983b2b804c38dc1e519e15e"
+checksum = "7cdf7d491910fbff13338e07460c9197a3c172268cfd4d8f8e69e5cec5a256d9"
 dependencies = [
  "bytemuck",
  "cfg-if",
@@ -1187,9 +1187,9 @@ dependencies = [
 
 [[package]]
 name = "diskann-vector"
-version = "0.53.0"
+version = "0.54.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f62c9d81aad6e3df6a026b1bb693dbbcfbee5ea93d9e7a5ff15c31576263bc29"
+checksum = "de1643bbece645f03527ef120bc7dd5e4e40557980dbe52ee51129adfb58a851"
 dependencies = [
  "cfg-if",
  "diskann-wide",
@@ -1198,9 +1198,9 @@ dependencies = [
 
 [[package]]
 name = "diskann-wide"
-version = "0.53.0"
+version = "0.54.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "46fcacef8ea9274969f98499456718f3dcaa5d3d7392b3171079653370fa0b20"
+checksum = "421f02c42e57a2153dc65b66b4b95fe2be56e14bf9f95253b663abcac8521166"
 dependencies = [
  "cfg-if",
  "half",
@@ -4323,15 +4323,15 @@ checksum = "13c2bddecc57b384dee18652358fb23172facb8a2c51ccc10d74c157bdea3292"
 
 [[package]]
 name = "surrealdb-collections"
-version = "3.2.0-nightly"
+version = "3.3.0-nightly"
 dependencies = [
  "revision 0.28.0",
  "storekey",
 ]
 
 [[package]]
 name = "surrealdb-core"
-version = "3.2.0-nightly"
+version = "3.3.0-nightly"
 dependencies = [
  "addr",
  "affinitypool",
@@ -4479,7 +4479,7 @@ dependencies = [
 
 [[package]]
 name = "surrealdb-strand"
-version = "3.2.0-nightly"
+version = "3.3.0-nightly"
 dependencies = [
  "revision 0.28.0",
  "serde",
@@ -4516,7 +4516,7 @@ dependencies = [
 
 [[package]]
 name = "surrealdb-types"
-version = "3.2.0-nightly"
+version = "3.3.0-nightly"
 dependencies = [
  "anyhow",
  "bytes",
@@ -4541,7 +4541,7 @@ dependencies = [
 
 [[package]]
 name = "surrealdb-types-derive"
-version = "3.2.0-nightly"
+version = "3.3.0-nightly"
 dependencies = [
  "heck 0.4.1",
  "proc-macro2",
```

**File**: `language-tests/tests/reproductions/7337_diskann_pending_shard_scan.surql` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+/**
+[env]
+planner-strategy = ["all-ro"]
+
+[test]
+reason = "Public issue #7337: DiskANN held pending record updates in a single unsharded `!dr` range, so KNN lookups scanned the whole pending set on every query while a write backlog existed. Pending records are now stored under a shard-prefixed `!dw` key and lookup merges per-shard. This exercises the end-to-end pending path: records are inserted (landing in the pending set across several shards) and a KNN query must still return the correct nearest neighbours before background compaction folds them into the graph."
+issue = 7337
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "[{ id: pts:1, point: [10f] }, { id: pts:2, point: [20f] }, { id: pts:3, point: [30f] }, { id: pts:4, point: [40f] }, { id: pts:5, point: [50f] }, { id: pts:6, point: [60f] }, { id: pts:7, point: [70f] }]"
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "[{ distance: 4f, id: pts:4 }, { distance: 6f, id: pts:5 }, { distance: 14f, id: pts:3 }]"
+*/
+
+DEFINE INDEX da_pt ON pts FIELDS point DISKANN DIMENSION 1 DIST EUCLIDEAN TYPE F32;
+INSERT INTO pts [
+	{ id: pts:1, point: [ 10f ] },
+	{ id: pts:2, point: [ 20f ] },
+	{ id: pts:3, point: [ 30f ] },
+	{ id: pts:4, point: [ 40f ] },
+	{ id: pts:5, point: [ 50f ] },
+	{ id: pts:6, point: [ 60f ] },
+	{ id: pts:7, point: [ 70f ] }
+];
+LET $pt = [44f];
+SELECT id, vector::distance::knn() AS distance FROM pts
+	WHERE point <|3,40|> $pt
+	ORDER BY distance;
```

**File**: `supply-chain/config.toml` (modified, +4/-4)
```diff
@@ -454,19 +454,19 @@ version = "0.3.7"
 criteria = "safe-to-deploy"
 
 [[exemptions.diskann]]
-version = "0.53.0"
+version = "0.54.0"
 criteria = "safe-to-deploy"
 
 [[exemptions.diskann-utils]]
-version = "0.53.0"
+version = "0.54.0"
 criteria = "safe-to-deploy"
 
 [[exemptions.diskann-vector]]
-version = "0.53.0"
+version = "0.54.0"
 criteria = "safe-to-deploy"
 
 [[exemptions.diskann-wide]]
-version = "0.53.0"
+version = "0.54.0"
 criteria = "safe-to-deploy"
 
 [[exemptions.doc-comment]]
```

**File**: `surrealdb/core/src/idx/mod.rs` (modified, +40/-3)
```diff
@@ -40,6 +40,10 @@ use crate::key::index::dr::{DiskAnnRecordPending, DiskAnnRecordPendingPrefix};
 #[cfg(diskann)]
 use crate::key::index::ds::Ds;
 use crate::key::index::dv::Dv;
+#[cfg(diskann)]
+use crate::key::index::dw::{DiskAnnRecordPendingShard, DiskAnnRecordPendingShardPrefix};
+#[cfg(diskann)]
+use crate::key::index::dy::Dy;
 use crate::key::index::hd::{Hd, HdRoot};
 use crate::key::index::he::He;
 use crate::key::index::hg::Hg;
@@ -256,25 +260,58 @@ impl IndexKeyBase {
 		Dn::new(self.0.ns, self.0.db, &self.0.tb, self.0.ix, element_id)
 	}
 
-	/// Key storing one shard of the distributed-safe DiskANN pending-state guard.
+	/// Key storing one shard of the legacy DiskANN pending-state guard (tracks `!dr` records).
+	///
+	/// New code never constructs this — the sharded layout uses [`Self::new_dy_key`], and old nodes
+	/// own `!dp`. Retained for tests that simulate a pre-change node and for the legacy on-disk
+	/// family; hence `dead_code` in a non-test build.
 	#[cfg(diskann)]
+	#[allow(dead_code)]
 	fn new_dp_key(&self, shard: u16) -> Dp<'_> {
 		Dp::new(self.0.ns, self.0.db, &self.0.tb, self.0.ix, shard)
 	}
 
+	/// Key storing one shard of the sharded DiskANN pending-state guard (tracks `!dw` records).
+	///
+	/// Separate from `!dp` so a pre-change node's compactor — which only knows `!dp`/`!dr` — cannot
+	/// clear the guard for sharded data it can't see during a mixed-version rolling upgrade.
+	#[cfg(diskann)]
+	fn new_dy_key(&self, shard: u16) -> Dy<'_> {
+		Dy::new(self.0.ns, self.0.db, &self.0.tb, self.0.ix, shard)
+	}
+
 	/// Key mapping an exact serialized vector to its DiskANN document set.
 	#[cfg(diskann)]
 	fn new_dq_key<'a>(&'a self, vec: &'a SerializedVector) -> Dq<'a> {
 		Dq::new(self.0.ns, self.0.db, &self.0.tb, self.0.ix, vec)
 	}
 
-	/// Key storing the pending DiskANN update for one record.
+	/// Key storing one shard's sharded pending DiskANN update (`!dw{shard}{id}`) for one record.
+	///
+	/// `shard` is the writer's pending-state shard (see `pending_state_shard`); prefixing it lets
+	/// compaction drain — and lookup scan — one shard at a time. New writes always use this layout.
+	#[cfg(diskann)]
+	fn new_dw_key<'a>(&'a self, shard: u16, id: &'a RecordIdKey) -> DiskAnnRecordPendingShard<'a> {
+		DiskAnnRecordPendingShard::new(self.0.ns, self.0.db, &self.0.tb, self.0.ix, shard, id)
+	}
+
+	/// Range covering the sharded `!dw` pending updates for one shard.
+	#[cfg(diskann)]
+	fn new_dw_shard_range(&self, shard: u16) -> Result<Range<Key>> {
+		DiskAnnRecordPendingShardPrefix::range(self.0.ns, self.0.db, &self.0.tb, self.0.ix, shard)
+	}
+
+	/// Key storing the legacy unsharded pending DiskANN update for one record.
+	///
+	/// New writes use the sharded `!dw` layout; this legacy key is read and deleted by the write
+	/// path's dual-read fold, and scanned/range-deleted by lookup and compaction, until the legacy
+	/// range drains empty.
 	#[cfg(diskann)]
 	fn new_dr_key<'a>(&'a self, id: &'a RecordIdKey) -> DiskAnnRecordPending<'a> {
 		DiskAnnRecordPending::new(self.0.ns, self.0.db, &self.0.tb, self.0.ix, id)
 	}
 
-	/// Range covering record-keyed DiskANN pending updates.
+	/// Range covering legacy unsharded record-keyed DiskANN pending updates.
 	#[cfg(diskann)]
 	fn new_dr_range(&self) -> Result<Range<Key>> {
 		DiskAnnRecordPendingPrefix::range(self.0.ns, self.0.db, &self.0.tb, self.0.ix)
```

**File**: `surrealdb/core/src/idx/trees/diskann/index.rs` (modified, +1205/-135)
```diff
@@ -1,15 +1,25 @@
 //! DiskANN index orchestration.
 //!
 //! This module connects SurrealDB index writes, background compaction, and KNN lookup to the
-//! KV-backed DiskANN graph provider. User writes append record-keyed pending updates (`!dr`) and
-//! mark the pending-state guard (`!dp`) non-empty. Compaction consumes a bounded pending batch,
-//! mutates the graph/document mappings, and moves `!dp` toward empty only after empty-range
-//! confirmation. Lookup uses `!dp` to skip pending scans only when every compute node can safely
-//! agree that no committed pending keys exist.
+//! KV-backed DiskANN graph provider. User writes append shard-prefixed pending updates (`!dw`) and
+//! mark that shard's sharded pending-state guard (`!dy`) non-empty. Compaction consumes a bounded
+//! pending batch, mutates the graph/document mappings, and advances each drained shard's `!dy`
+//! guard toward empty only after empty-range confirmation. Lookup scans the `!dw` range of every
+//! non-empty `!dy` shard, plus the legacy unsharded `!dr` range unconditionally for the dual-read
+//! migration (a cheap empty probe once that range has drained). The legacy `!dp` guard is owned by
+//! pre-change nodes only.
+//!
+//! Mixed-version note: a pre-change node (one that predates the `!dw`/`!dy` layout) scans only the
+//! legacy `!dr` range, so during a rolling upgrade it cannot see un-compacted `!dw` writes made by
+//! upgraded nodes — a KNN query routed to such a node may briefly omit those records until a new
+//! compactor folds them into the graph (which every version reads) or the upgrade completes. This
+//! is transient and never loses or corrupts data; full read consistency during the upgrade would
+//! require gating `!dw` writes on a cluster storage version, which is intentionally not done here.
 
-use std::collections::VecDeque;
 use std::collections::hash_map::DefaultHasher;
+use std::collections::{HashSet, VecDeque};
 use std::hash::{Hash, Hasher};
+use std::ops::Range;
 use std::sync::Arc;
 
 use ahash::HashMap;
@@ -50,22 +60,18 @@ use crate::idx::{
 	read_compaction_generation,
 };
 use crate::key::index::dr::DiskAnnRecordPending;
-use crate::kvs::{KVValue, Key, Transaction, Val};
+use crate::key::index::dw::DiskAnnRecordPendingShard;
+use crate::kvs::{KVKey, KVValue, Key, Transaction, Val};
 use crate::val::{Number, RecordId, RecordIdKey, Value};
 
 /// Soft per-batch limits for [`DiskAnnIndex::prepare_compaction`]. When either cap fires,
 /// `has_more = true` is set on the [`DiskAnnCompactionPlan`] and the caller is expected to run
 /// another compaction iteration.
 ///
-/// Note (#7318 review followup, C7): while `has_more = true`, [`apply_compaction`] keeps the
-/// `!dp` pending-state shards `NonEmpty` (`should_clear_pending_state = !has_more`). KNN
-/// lookups therefore scan the full `!dr` range on every query for the duration of the backlog
-/// — this is unavoidable today because `!dr` is keyed by `RecordIdKey` directly and there is
-/// no efficient per-shard scan. A proper fix would prefix `!dr` keys with the pending-state
-/// shard id (or maintain a parallel `!dr`-by-shard index) so that `prepare_compaction` can
-/// drain one shard at a time and advance only that shard's `!dp` after a successful commit.
-/// Until then, sustained write load saturates these limits and KNN search pays the
-/// full-range scan on every query.
+/// (#7318 review followup, C7) Pending records are sharded under `!dw{shard}` and guarded per
+/// shard by `!dy`, so compaction drains and advances one shard's guard at a time and lookup scans
+/// only the non-empty shards — bounding KNN's pending work to the active backlog rather than the
+/// whole pending set on every query, which is what the unsharded `!dr` layout used to force.
 const DISKANN_COMPACTION_MAX_PENDING_KEYS: usize = 1024;
 const DISKANN_COMPACTION_MAX_PENDING_BYTES: usize = 16 * 1024 * 1024;
 
@@ -93,7 +99,7 @@ type PendingStateSnapshot = Vec<Option<DiskAnnPendingState>>;
 ///
 /// The plan captures exact pending keys and values so the write phase can delete them with `delc`
 /// before applying graph mutations. It also carries the compaction generation and pending-state
-/// snapshot used to reject stale plans and to clear `!dp` shards conservatively.
+/// snapshot used to reject stale plans and to clear `!dy` shards conservatively.
 pub(crate) struct DiskAnnCompactionPlan {
 	/// Compaction generation observed while preparing the plan.
 	generation: Option<u64>,
@@ -103,6 +109,9 @@ pub(crate) struct DiskAnnCompactionPlan {
 	captured_keys: Vec<CapturedPendingKey>,
 	/// Coalesced graph/document operations derived from captured pending records.
 	pending: Vec<PendingOperation>,
+	/// Shards whose pending range was fully drained this pass and may step toward empty on apply.
+	/// Only populated once the legacy `!dr` range is empty (see [`Self::prepare_compaction`]).
+	cleared_shards: Vec<u16>,
 	/// True when prepare stopped because the bounded batch
```

**File**: `surrealdb/core/src/idx/trees/diskann/mod.rs` (modified, +3/-2)
```diff
@@ -7,8 +7,9 @@
 //!
 //! The persisted graph uses the `!d*` index key families: graph state (`!ds`), element payloads
 //! (`!de`), adjacency nodes (`!dn`), record/document mappings (`!di`/`!dd`), vector/document
-//! mappings (`!dq`/`!dh`), pending operations (`!dr`), compaction generation (`!dg`), and the
-//! distributed-safe pending-state guard (`!dp`).
+//! mappings (`!dq`/`!dh`), sharded pending operations (`!dw`) with their per-shard guard (`!dy`),
+//! compaction generation (`!dg`), and — for the dual-read migration off the pre-sharding layout —
+//! the legacy unsharded pending operations (`!dr`) and their legacy guard (`!dp`).
 
 #[cfg(not(target_family = "wasm"))]
 pub(crate) mod cache;
```

---

### Incident Patch 8: `75b7154f` (2026-07-01)
**Commit Message**: fix(core/api): reject cross-tenant custom API access (GHSA-848m-r628-vrxw) (#439)

**File**: `surrealdb/core/src/api/invocation.rs` (modified, +16/-0)
```diff
@@ -71,6 +71,22 @@ pub async fn process_api_request_with_stack(
 	api: &ApiDefinition,
 	req: ApiRequest,
 ) -> Result<ApiResponse> {
+	// Tenant-boundary enforcement. The API handler ultimately runs with
+	// permissions disabled, so reaching it for a namespace/database the caller
+	// is not authenticated for is a cross-tenant authorization bypass. The
+	// selected ns/db can be steered by caller-controlled input — the URL path
+	// on the HTTP route, or session headers / `USE` for `api::invoke` — so the
+	// authenticated level is the only trustworthy scope. Both entry points
+	// converge here, making this the authoritative gate (GHSA-848m-r628-vrxw).
+	let (ns_name, db_name) = opt.ns_db()?;
+	if !opt.auth.can_access_ns_db(ns_name, db_name) {
+		trace!(
+			request_id = %req.request_id,
+			"API request denied: selected namespace/database is outside the authenticated session scope"
+		);
+		return Ok(ApiResponse::from_error(ApiError::PermissionDenied, req.request_id.clone()));
+	}
+
 	// `DefineApiStatement::compute` rejects duplicate methods across `FOR`
 	// clauses and `AlterApiStatement::compute` strips a method from any
 	// pre-existing action before adding a new one for it, so at most one
```

**File**: `surrealdb/core/src/iam/auth.rs` (modified, +63/-0)
```diff
@@ -65,6 +65,34 @@ impl Auth {
 		matches!(self.level(), Level::Database(n, d) if n.eq(ns) && d.eq(db))
 	}
 
+	/// Check whether the authenticated level is permitted to operate within the
+	/// given namespace and database.
+	///
+	/// This is the tenant-boundary gate for entry points that derive the target
+	/// namespace/database from caller-controlled input — most notably the custom
+	/// API HTTP route `/api/:ns/:db/:endpoint`, whose handlers run with
+	/// permissions disabled. The authenticated [`Level`] is the source of truth;
+	/// the session's *selected* `ns`/`db` are not, because they are overwritten
+	/// from the request before dispatch.
+	///
+	/// - Root principals may act in any namespace/database.
+	/// - Namespace principals are confined to their own namespace (any database).
+	/// - Database and record principals are confined to their exact namespace/database.
+	/// - Anonymous (unauthenticated) sessions carry no tenant identity, so they are left to the
+	///   endpoint's own permission checks.
+	///
+	/// This is purely a namespace/database scope check; it does not replace
+	/// role or `PERMISSIONS` evaluation.
+	pub fn can_access_ns_db(&self, ns: &str, db: &str) -> bool {
+		match self.level() {
+			Level::Root => true,
+			Level::Namespace(n) => n.eq(ns),
+			Level::Database(n, d) => n.eq(ns) && d.eq(db),
+			Level::Record(n, d, _) => n.eq(ns) && d.eq(db),
+			Level::No => true,
+		}
+	}
+
 	/// System Auth helpers
 	///
 	/// These are not stored in the database and are used for internal
@@ -133,3 +161,38 @@ impl Auth {
 		self.actor.has_viewer_role()
 	}
 }
+
+#[cfg(test)]
+mod tests {
+	use super::*;
+
+	#[test]
+	fn can_access_ns_db_enforces_tenant_boundary() {
+		// Root may access any namespace/database.
+		let root = Auth::for_root(Role::Viewer);
+		assert!(root.can_access_ns_db("a", "x"));
+		assert!(root.can_access_ns_db("b", "y"));
+
+		// Namespace principals are confined to their namespace (any database).
+		let ns = Auth::for_ns(Role::Viewer, "a");
+		assert!(ns.can_access_ns_db("a", "x"));
+		assert!(ns.can_access_ns_db("a", "y"));
+		assert!(!ns.can_access_ns_db("b", "x"));
+
+		// Database principals are confined to their exact namespace/database.
+		let db = Auth::for_db(Role::Viewer, "a", "x");
+		assert!(db.can_access_ns_db("a", "x"));
+		assert!(!db.can_access_ns_db("a", "y"));
+		assert!(!db.can_access_ns_db("b", "x"));
+
+		// Record principals are confined to their namespace/database.
+		let rec = Auth::for_record("user:1".to_string(), "a", "x", "ac");
+		assert!(rec.can_access_ns_db("a", "x"));
+		assert!(!rec.can_access_ns_db("a", "y"));
+		assert!(!rec.can_access_ns_db("b", "x"));
+
+		// Anonymous sessions carry no tenant identity; the scope test is
+		// permissive and the endpoint's own permission checks remain the gate.
+		assert!(Auth::default().can_access_ns_db("a", "x"));
+	}
+}
```

**File**: `surrealdb/core/src/kvs/ds.rs` (modified, +16/-0)
```diff
@@ -4305,6 +4305,22 @@ impl Datastore {
 		session: &Session,
 		mut req: ApiRequest,
 	) -> Result<ApiResponse> {
+		// Enforce the tenant boundary before resolving or dispatching anything.
+		// The namespace/database come from caller-controlled input (the
+		// `/api/:ns/:db/:endpoint` URL path) and the HTTP route has already
+		// overwritten the session's selected ns/db with them, so the
+		// authenticated level is the only trustworthy scope. A principal
+		// authenticated for one tenant must not be able to invoke another
+		// tenant's custom API — whose handler runs with permissions disabled
+		// (GHSA-848m-r628-vrxw).
+		if !session.au.can_access_ns_db(ns, db) {
+			debug!(
+				request_id = %req.request_id,
+				"Custom API request denied: URL namespace/database is outside the authenticated session scope"
+			);
+			return Ok(ApiResponse::from_error(ApiError::PermissionDenied, req.request_id.clone()));
+		}
+
 		let tx = Arc::new(self.transaction(TransactionType::Write, LockType::Optimistic).await?);
 
 		let db = tx.ensure_ns_db(None, ns, db).await?;
```

**File**: `surrealdb/core/tests/api_scope.rs` (added, +189/-0)
```diff
@@ -0,0 +1,189 @@
+#![recursion_limit = "256"]
+
+//! Regression coverage for GHSA-848m-r628-vrxw.
+//!
+//! Custom API handlers ultimately run with permissions disabled, so reaching
+//! one for a namespace/database the caller is not authenticated for is a
+//! cross-tenant authorization bypass. The target ns/db can be steered by
+//! caller-controlled input — the URL path on the HTTP route
+//! (`/api/:ns/:db/:endpoint`), or the session's selected ns/db (headers / `USE`)
+//! for the `api::invoke` SQL function. The authenticated level — not the
+//! caller-supplied ns/db — is the source of truth, so a principal scoped to one
+//! tenant must be rejected before another tenant's handler runs.
+
+mod helpers;
+use anyhow::Result;
+use helpers::new_ds;
+use surrealdb_core::api::request::ApiRequest;
+use surrealdb_core::catalog::ApiMethod;
+use surrealdb_core::dbs::Session;
+use surrealdb_core::iam::{Level, Role};
+use surrealdb_core::kvs::Datastore;
+use surrealdb_types::ToSql;
+
+async fn run(dbs: &Datastore, sql: &str, sess: &Session) -> Result<()> {
+	for res in dbs.execute(sql, sess, None).await? {
+		res.result?;
+	}
+	Ok(())
+}
+
+fn get_request() -> ApiRequest {
+	ApiRequest {
+		method: ApiMethod::Get,
+		request_id: "ghsa-848m".to_string(),
+		..Default::default()
+	}
+}
+
+/// Define the victim tenant: a `PERMISSIONS NONE` secret table and a
+/// `PERMISSIONS FULL` custom API that reads it. Returns a root session already
+/// scoped to the victim namespace/database.
+async fn setup_victim_tenant(dbs: &Datastore) -> Result<Session> {
+	let root = Session::owner();
+	run(dbs, "DEFINE NAMESPACE victim_ns", &root).await?;
+	run(dbs, "DEFINE DATABASE victim_db", &root.clone().with_ns("victim_ns")).await?;
+	let victim_admin = root.with_ns("victim_ns").with_db("victim_db");
+	run(
+		dbs,
+		r#"
+			DEFINE TABLE secrets PERMISSIONS NONE;
+			CREATE secrets:one SET flag = 'FLAG_SHOULD_NOT_LEAK';
+			DEFINE API "/leak" FOR get PERMISSIONS FULL THEN {
+				{ status: 200, body: (SELECT VALUE flag FROM secrets) };
+			};
+		"#,
+		&victim_admin,
+	)
+	.await?;
+	Ok(victim_admin)
+}
+
+/// The HTTP custom API route (`invoke_api_handler`) must reject a caller whose
+/// authenticated scope does not cover the URL ns/db, while same-scope,
+/// namespace-scope and root callers keep working.
+#[tokio::test]
+async fn http_route_rejects_cross_tenant_scope() -> Result<()> {
+	// Datastore with auth enabled; the helper pre-creates attacker_ns/attacker_db.
+	let (_, dbs) = new_ds("attacker_ns", "attacker_db", true).await?;
+	let victim_admin = setup_victim_tenant(&dbs).await?;
+
+	// Attacker: only a database Viewer for attacker_ns/attacker_db. The HTTP
+	// route overwrites the session's selected ns/db with the victim scope from
+	// the URL, so replicate that here — the authenticated level stays attacker.
+	let attacker = Session::for_level(
+		Level::Database("attacker_ns".to_string(), "attacker_db".to_string()),
+		Role::Viewer,
+	)
+	.with_ns("victim_ns")
+	.with_db("victim_db");
+
+	let resp =
+		dbs.invoke_api_handler("victim_ns", "victim_db", "leak", &attacker, get_request()).await?;
+	assert_eq!(
+		resp.status.as_u16(),
+		403,
+		"cross-tenant custom API call must be rejected with 403, got {} body {:?}",
+		resp.status,
+		resp.body
+	);
+	assert!(
+		!format!("{:?}", resp.body).contains("FLAG_SHOULD_NOT_LEAK"),
+		"victim secret leaked across the tenant boundary: {:?}",
+		resp.body
+	);
+
+	// A legitimate victim-scope database user still reaches its own API.
+	let victim_user = Session::for_level(
+		Level::Database("victim_ns".to_string(), "victim_db".to_string()),
+		Role::Viewer,
+	)
+	.with_ns("victim_ns")
+	.with_db("victim_db");
+	let resp = dbs
+		.invoke_api_handler("victim_ns", "victim_db", "leak", &victim_user, get_request())
+		.await?;
+	assert_eq!(
+		resp.status.as_u16(),
+		200,
+		"victim-scope call should succeed, got {} body {:?}",
+		resp.status,
+		resp.body
+	);
+
+	// A namespace-scoped principal may reach any database in its namespace.
+	let victim_ns_user =
+		Session::for_level(Level::Namespace("victim_ns".to_string()), Role::Viewer)
+			.with_ns("victim_ns")
+			.with_db("victim_db");
+	let resp = dbs
+		.invoke_api_handler("victim_ns", "victim_db", "leak", &victim_ns_user, get_request())
+		.await?;
+	assert_eq!(
+		resp.status.as_u16(),
+		200,
+		"namespace-scope call should succeed, got {} body {:?}",
+		resp.status,
+		resp.body
+	);
+
+	// Root may invoke any tenant's API.
+	let resp = dbs
+		.invoke_api_handler("victim_ns", "victim_db", "leak", &victim_admin, get_request())
+		.await?;
+	assert_eq!(
+		resp.status.as_u16(),
+		200,
+		"root call should succeed, got {} body {:?}",
+		resp.status,
+		resp.body
+	);
+
+	Ok(())
+}
+
+/// The `api::invoke` SQL function shares the dispatch chokepoint with the HTTP
+/// route. A caller authenticated for one tenant whose session points at another
+/// tenant (as mismatched HTTP headers or `USE` would do) must not be able to run
+//
```

---

### Incident Patch 9: `c39b8a66` (2026-07-01)
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

---

### Incident Patch 10: `30212a12` (2026-07-01)
**Commit Message**: fix(core): enforce JWKS network capabilities at the resolved IP (GHSA-5x4x-2946-qr67) (#440)

**File**: `surrealdb/core/src/http/mod.rs` (modified, +1/-10)
```diff
@@ -8,19 +8,10 @@ use url::Url;
 use crate::cnf::CommonConfig;
 use crate::dbs::capabilities::{NetTarget, Targets};
 
-#[cfg(not(target_family = "wasm"))]
-mod resolve;
-
 pub struct HttpClient {
 	client: Client,
 }
 
-#[cfg(not(target_family = "wasm"))]
-struct NetFilter {
-	allow: Targets<NetTarget>,
-	deny: Targets<NetTarget>,
-}
-
 impl HttpClient {
 	#[cfg(not(target_family = "wasm"))]
 	pub fn new(
@@ -48,9 +39,9 @@ impl HttpClient {
 		use http::header::USER_AGENT;
 		use http::{HeaderMap, HeaderValue};
 		use reqwest::redirect::{Attempt, Policy};
-		use resolve::FilteringResolver;
 
 		use crate::dbs::capabilities::NetTarget;
+		use crate::net::{FilteringResolver, NetFilter};
 
 		let filter = Arc::new(NetFilter {
 			allow,
```

**File**: `surrealdb/core/src/iam/jwks.rs` (modified, +157/-7)
```diff
@@ -290,21 +290,40 @@ fn check_capabilities_url(kvs: &Datastore, url: &str) -> Result<()> {
 // Builds the HTTP client used to fetch JWKS objects.
 //
 // The JWKS path does not depend on the `http` feature, so it cannot reuse the
-// datastore's protected `HttpClient`. To prevent server-side request forgery
-// (SSRF) via redirects, the client installs a redirect policy that re-validates
-// every redirect target against the datastore's network capabilities — the same
-// allow/deny check applied to the original URL by `check_capabilities_url`.
-// Without this, the default `reqwest` client follows up to 10 redirects to
-// arbitrary hosts (e.g. cloud metadata endpoints) that were never authorised.
+// datastore's protected `HttpClient`. Two complementary defences against
+// server-side request forgery (SSRF) are installed here, mirroring the
+// protections applied to the general-purpose HTTP client:
+//
+//  1. A redirect policy re-validates every redirect target host against the datastore's network
+//     capabilities — the same allow/deny check applied to the original URL by
+//     `check_capabilities_url`. Without it, the default `reqwest` client follows up to 10 redirects
+//     to arbitrary hosts (e.g. cloud metadata endpoints) that were never authorised.
+//
+//  2. A capability-aware DNS resolver (`crate::net::FilteringResolver`) re-checks the IP addresses
+//     each hostname resolves to. The host-string check above only inspects the URL text, so an
+//     allow-listed hostname that resolves to a loopback, link-local, cloud-metadata or private
+//     address would otherwise be fetched even though a direct URL to that IP would be denied
+//     (GHSA-5x4x-2946-qr67 — a sibling of the redirect SSRF). The resolver blocks
+//     private/special-use IPs unless they are explicitly allowed, and applies to redirect targets
+//     as well as the original URL.
 #[cfg(not(target_family = "wasm"))]
 fn build_jwks_client(kvs: &Datastore) -> Result<Client> {
 	use reqwest::redirect::Policy;
 
+	use crate::net::{FilteringResolver, NetFilter};
+
 	// Snapshot the capabilities and redirect budget so the policy closure (which
 	// must be `'static + Send + Sync`) does not borrow the datastore.
 	let capabilities = Arc::new(kvs.get_capabilities().clone());
 	let max_redirects = kvs.config().max_http_redirects;
 
+	// Build the DNS-level filter from the same capability snapshot before the
+	// `capabilities` handle is moved into the redirect policy closure below.
+	let filter = Arc::new(NetFilter {
+		allow: capabilities.allow_net.clone(),
+		deny: capabilities.deny_net.clone(),
+	});
+
 	let policy = Policy::custom(move |attempt| {
 		if attempt.previous().len() >= max_redirects {
 			return attempt.stop();
@@ -329,7 +348,10 @@ fn build_jwks_client(kvs: &Datastore) -> Result<Client> {
 		}
 	});
 
-	Ok(Client::builder().redirect(policy).build()?)
+	Ok(Client::builder()
+		.redirect(policy)
+		.dns_resolver(FilteringResolver::from_net_filter(filter))
+		.build()?)
 }
 
 // Attempts to fetch a JWKS object from a remote location and stores it in the
@@ -1070,4 +1092,132 @@ mod tests {
 		// `internal_server` mock is configured with `.expect(0)`: the assertion is
 		// enforced when the server is dropped at the end of the test.
 	}
+
+	// Reproduction for GHSA-5x4x-2946-qr67: SSRF via a JWKS URL whose hostname is
+	// allow-listed but resolves to a private/loopback address.
+	//
+	// `check_capabilities_url` validates only the URL *host string*. Before the
+	// fix, the JWKS client used the default `reqwest` resolver, so an allow-listed
+	// hostname that resolves to loopback was fetched even though a direct URL to
+	// the same loopback IP is rejected. After the fix, the client installs a
+	// capability-aware DNS resolver that re-checks the resolved IP and blocks the
+	// private address, so the internal server is never contacted.
+	#[tokio::test]
+	#[cfg(not(target_family = "wasm"))]
+	async fn test_allowed_hostname_resolving_to_loopback_is_blocked() {
+		// JWKS server on loopback. With the fix it must never be reached via the
+		// allow-listed hostname (`expect(0)` is verified on drop).
+		let mock_server = MockServer::start().await;
+		let jwks_path = format!("{}/jwks.json", random_path());
+		Mock::given(method("GET"))
+			.and(path(&jwks_path))
+			.respond_with(ResponseTemplate::new(200).set_body_json(DEFAULT_JWKS.clone()))
+			.expect(0)
+			.mount(&mock_server)
+			.await;
+		let port = mock_server.address().port();
+
+		// Allow only the *hostname* `localhost`, not the loopback IP it resolves to.
+		let ds = Datastore::builder()
+			.with_capabilities(Capabilities::default().with_network_targets(
+				Targets::<NetTarget>::Some([NetTarget::from_str("localhost").unwrap()].into()),
+			))
+			.build_with_path("memory")
+			.await
+			.unwrap();
+
+		// Negative control: a direct loopback URL is rejected by the host-string
+		// capability check before any connection is attempted.
+		let direct = con
```

**File**: `surrealdb/core/src/lib.rs` (modified, +5/-0)
```diff
@@ -61,6 +61,11 @@ pub mod iam;
 pub mod idx;
 pub mod kvs;
 pub mod mem;
+// Capability-aware networking helpers shared by the outbound HTTP clients
+// (`http` feature) and the JWKS fetch client (`jwks` feature). Not available on
+// WASM, where the clients are built without a custom DNS resolver.
+#[cfg(all(not(target_family = "wasm"), any(feature = "http", feature = "jwks")))]
+mod net;
 pub mod obs;
 pub mod observe;
 pub mod options;
```

**File**: `surrealdb/core/src/net/mod.rs` (renamed, +39/-4)
```diff
@@ -1,3 +1,26 @@
+//! Shared, capability-aware networking helpers for outbound HTTP requests.
+//!
+//! Both outbound clients in the engine must enforce SurrealDB's network
+//! capabilities — the general-purpose protected HTTP client (`crate::http`,
+//! behind the `http` feature) and the JWKS fetch client (`crate::iam::jwks`,
+//! behind the `jwks` feature). Enforcing the allow/deny rules on the requested
+//! hostname *string* alone is not sufficient: an allow-listed hostname can
+//! resolve (or be made to resolve, e.g. via DNS rebinding) to a loopback,
+//! link-local, cloud-metadata or otherwise private address. A direct URL to
+//! that IP would be denied by capabilities, but a host-string check performed
+//! before DNS resolution would let the request through (SSRF).
+//!
+//! To close that gap, this module provides [`FilteringResolver`], a
+//! `reqwest`-compatible DNS resolver that re-checks every resolved IP address
+//! against the configured allow/deny rules and blocks private/special-use
+//! addresses unless they are explicitly allowed. It lives here, rather than in
+//! `crate::http`, so the JWKS path can reuse it without depending on the `http`
+//! feature.
+//!
+//! The entire module is gated to non-WASM targets because it depends on
+//! `tokio`'s system DNS resolver; on WASM the outbound clients are built
+//! without a custom resolver.
+
 use std::error::Error;
 use std::net::IpAddr;
 use std::str::FromStr;
@@ -7,9 +30,15 @@ use ipnet::IpNet;
 use reqwest::dns::{Addrs, Name, Resolve, Resolving};
 use tokio::net::lookup_host;
 
-use super::NetFilter;
 use crate::dbs::capabilities::{NetTarget, Targets};
 
+/// The allow/deny network rules applied to outbound requests, shared between an
+/// outbound client's redirect policy and its [`FilteringResolver`].
+pub(crate) struct NetFilter {
+	pub(crate) allow: Targets<NetTarget>,
+	pub(crate) deny: Targets<NetTarget>,
+}
+
 /// Returns `true` for IP addresses that belong to private, loopback, link-local,
 /// or other special-use ranges defined in the IANA Special-Purpose Address
 /// Registries (RFC 5735 / RFC 6890 / RFC 4193 / RFC 3513).
@@ -35,12 +64,18 @@ fn is_private_ip(ip: IpAddr) -> bool {
 	}
 }
 
-pub struct FilteringResolver {
-	pub filter: Arc<NetFilter>,
+/// A `reqwest` DNS resolver that enforces network capabilities at the IP level.
+///
+/// The hostname is first checked against the allow/deny rules, then resolved,
+/// and finally every resolved address is checked again so that an allow-listed
+/// hostname cannot be used to reach a private/special-use IP that is not itself
+/// explicitly allowed.
+pub(crate) struct FilteringResolver {
+	pub(crate) filter: Arc<NetFilter>,
 }
 
 impl FilteringResolver {
-	pub fn from_net_filter(filter: Arc<NetFilter>) -> Self {
+	pub(crate) fn from_net_filter(filter: Arc<NetFilter>) -> Self {
 		FilteringResolver {
 			filter,
 		}
```

---

### Incident Patch 11: `cd75e949` (2026-07-01)
**Commit Message**: feat(language-tests): add --quick bench mode and PR comparison workflow (#446)

**File**: `.github/scripts/render_bench_comment.py` (added, +162/-0)
```diff
@@ -0,0 +1,162 @@
+#!/usr/bin/env python3
+"""Render the sticky PR comment for the quick language-bench comparison.
+
+Reads the `--json` report emitted by `surrealql-test bench run` and prints a
+markdown comment to stdout. Also used (without `--results`) to render the
+"running" and "failed" states so the same comment is updated in place.
+"""
+
+import argparse
+import json
+import sys
+
+
+def fmt_secs(s: float) -> str:
+    if s < 1e-6:
+        return f"{s * 1e9:.0f} ns"
+    if s < 1e-3:
+        return f"{s * 1e6:.1f} µs"
+    if s < 1.0:
+        return f"{s * 1e3:.2f} ms"
+    return f"{s:.3f} s"
+
+
+def pretty_name(name: str) -> str:
+    # "bench/scans/foo.surql [indexed]" -> "scans/foo [indexed]"
+    variant = ""
+    if name.endswith("]") and " [" in name:
+        name, variant = name[: name.rfind(" [")], name[name.rfind(" ["):]
+    name = name.removeprefix("bench/").removesuffix(".surql")
+    return name + variant
+
+
+VERDICT_RANK = {"regressed": 0, "improved": 1, "within-noise": 2, None: 3}
+VERDICT_EMOJI = {
+    "regressed": "🔴",
+    "improved": "🟢",
+    "within-noise": "⚪",
+    None: "⚫",
+}
+
+
+def render_table(benches: list) -> str:
+    rows = []
+    for b in benches:
+        comp = b.get("comparison")
+        verdict = comp["verdict"] if comp else None
+        # The baseline (main) median only exists when a baseline was found.
+        main_ms = fmt_secs(comp["base_median_secs"]) if comp else "—"
+        change = f"{comp['change_pct']:+.1f}%" if comp else "—"
+        p = f"{comp['p_value']:.2f}" if comp else "—"
+        rows.append(
+            (
+                VERDICT_RANK.get(verdict, 3),
+                # within a rank, biggest absolute change first
+                -(abs(comp["change_pct"]) if comp else 0.0),
+                f"| {VERDICT_EMOJI.get(verdict, '⚫')} `{pretty_name(b['name'])}` "
+                f"| {main_ms} | {fmt_secs(b['median_secs'])} | {change} | {p} |",
+            )
+        )
+    rows.sort(key=lambda r: (r[0], r[1]))
+    header = (
+        "| | Bench | Median (main) | Median (PR) | Δ | p |\n"
+        "|---|---|--:|--:|--:|--:|"
+    )
+    return header + "\n" + "\n".join(r[2] for r in rows)
+
+
+def main() -> int:
+    ap = argparse.ArgumentParser()
+    ap.add_argument(
+        "--status",
+        choices=["instructions", "running", "done", "failed"],
+        required=True,
+    )
+    ap.add_argument("--sha", default="")
+    ap.add_argument("--base", default="main")
+    ap.add_argument("--phase", default="")
+    ap.add_argument("--run-url", default="")
+    ap.add_argument("--results", default="")
+    args = ap.parse_args()
+
+    # Opt-in instructions, posted on PR open before any benchmark has run.
+    if args.status == "instructions":
+        print(
+            "\n".join(
+                [
+                    "## 📊 Benchmark",
+                    "",
+                    f"Add the **`benchmark`** label to this PR to benchmark your "
+                    f"changes and compare them against the latest nightly `{args.base}` "
+                    f"baseline.",
+                    "",
+                    f"- `{args.base}` is benchmarked **nightly** (full run, same runner "
+                    "pool); this PR is compared against that baseline, so only your "
+                    "branch is benchmarked here.",
+                    "- Runs on every push while the label is set; remove the label to "
+                    "stop.",
+                ]
+            )
+        )
+        return 0
+
+    short = args.sha[:9]
+    lines = [f"## 📊 Benchmark — `{short}` vs nightly `{args.base}`", ""]
+
+    if args.status == "running":
+        phase = args.phase or "Starting…"
+        lines.append(f"⏳ **{phase}**")
+    elif args.status == "failed":
+        lines.append("❌ **Benchmark run failed.**")
+        if args.phase:
+            lines.append("")
+            lines.append(f"Last phase: {args.phase}")
+    else:  # done
+        with open(args.results) as f:
+            report = json.load(f)
+        benches = report.get("benches", [])
+        compared = [b for b in benches if b.get("comparison")]
+        reg = [b for b in compared if b["comparison"]["verdict"] == "regressed"]
+        imp = [b for b in compared if b["comparison"]["verdict"] == "improved"]
+        flat = [b for b in compared if b["comparison"]["verdict"] == "within-noise"]
+        nob = [b for b in benches if not b.get("comparison")]
+
+        lines.append(
+            f"🔴 **{len(reg)}** regressed · 🟢 **{len(imp)}** improved · "
+            f"⚪ **{len(flat)}** within noise · ⚫ **{len(nob)}** no baseline "
+            f"(backend `{report.get('backend', '?')}`, {len(benches)} benches)"
+        )
+        lines.append("")
+
+        changed = reg + imp
+        if changed:
+            lines.append("### Significant changes")
+            lines.append(render_table(changed))
+            lines.append("")
+        else:
+            lines.append
```

**File**: `.github/scripts/upsert_pr_comment.sh` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+#!/usr/bin/env bash
+# Create or update a single "sticky" PR comment identified by a hidden marker.
+# Usage: upsert_pr_comment.sh <pr-number> <marker> <body-file>
+#
+# Talks to the GitHub REST API via curl (not the `gh` CLI) so it works on
+# self-hosted runners that don't ship `gh`. Requires curl + jq, and GH_TOKEN +
+# GITHUB_REPOSITORY in the environment.
+set -euo pipefail
+
+PR="$1"
+MARKER="$2"
+BODY_FILE="$3"
+REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY not set}"
+TOKEN="${GH_TOKEN:?GH_TOKEN not set}"
+API="https://api.github.com"
+
+BODY="$(printf '%s\n%s' "$MARKER" "$(cat "$BODY_FILE")")"
+PAYLOAD="$(jq -nc --arg b "$BODY" '{body: $b}')"
+
+AUTH=(
+  -H "Authorization: Bearer $TOKEN"
+  -H "Accept: application/vnd.github+json"
+  -H "X-GitHub-Api-Version: 2022-11-28"
+  -H "Content-Type: application/json"
+)
+
+# Find an existing sticky comment by its marker, paging through all comments.
+ID=""
+page=1
+while :; do
+  resp="$(curl -fsSL "${AUTH[@]}" "$API/repos/$REPO/issues/$PR/comments?per_page=100&page=$page")"
+  [ "$(printf '%s' "$resp" | jq 'length')" -eq 0 ] && break
+  ID="$(printf '%s' "$resp" | jq -r --arg m "$MARKER" 'map(select(.body | startswith($m))) | (.[0].id // empty)')"
+  [ -n "$ID" ] && break
+  page=$((page + 1))
+done
+
+if [ -n "$ID" ]; then
+  printf '%s' "$PAYLOAD" | curl -fsSL -X PATCH "${AUTH[@]}" \
+    "$API/repos/$REPO/issues/comments/$ID" --data-binary @- >/dev/null
+  echo "Updated comment $ID"
+else
+  printf '%s' "$PAYLOAD" | curl -fsSL -X POST "${AUTH[@]}" \
+    "$API/repos/$REPO/issues/$PR/comments" --data-binary @- >/dev/null
+  echo "Created comment"
+fi
```

**File**: `.github/workflows/language-bench-quick.yml` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+name: Language bench (PR)
+
+# Benchmarks a labelled PR and compares it against the latest nightly `main`
+# baseline. On open, every PR gets a sticky comment explaining how to opt in;
+# adding the `benchmark` label benchmarks the PR head and updates that comment,
+# re-running on every push while the label is set.
+#
+# `main` is NOT benchmarked here — it comes from the nightly run (full, same
+# `runner-arm-bench` pool), which `--save`s to the shared bench datastore. This
+# job runs read-only against that store: the harness `fetch_latest`es the `main`
+# baseline and compares this PR's `--quick` run against it. `--quick` trades
+# statistical power for speed (the full suite takes ~2h) — it reliably surfaces
+# large regressions but is too coarse for small drift. So pushes only build and
+# benchmark the PR, and the baseline refreshes whenever nightly re-runs.
+
+on:
+  pull_request:
+    types: [opened, reopened, labeled, synchronize]
+
+concurrency:
+  # One run per PR; a new push cancels the in-flight run so the comment tracks
+  # the latest commit.
+  group: ${{ github.workflow }}-${{ github.event.pull_request.number }}
+  cancel-in-progress: true
+
+defaults:
+  run:
+    shell: bash
+
+permissions:
+  contents: read
+  pull-requests: write
+
+env:
+  GH_TOKEN: ${{ github.token }}
+  MARKER: "<!-- lang-bench-quick -->"
+  RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
+  # sccache → S3 compile cache (read by setup-environment); fail-open if the
+  # backend is unreachable. Same block as ci.yml.
+  SCCACHE_BUCKET: ${{ secrets.AWS_S3_SCCACHE_BUCKET_NAME }}
+  SCCACHE_REGION: us-east-1
+  SCCACHE_S3_KEY_PREFIX: ${{ github.repository }}
+  SCCACHE_IDLE_TIMEOUT: "0"
+  AWS_ACCESS_KEY_ID: ${{ secrets.AMAZON_ACCESS_KEY }}
+  AWS_SECRET_ACCESS_KEY: ${{ secrets.AMAZON_SECRET_KEY }}
+
+jobs:
+  # Post the opt-in instructions on open/reopen when the label isn't set yet.
+  announce:
+    name: Announce
+    runs-on: ubuntu-latest
+    if: >
+      (github.event.action == 'opened' || github.event.action == 'reopened') &&
+      !contains(github.event.pull_request.labels.*.name, 'benchmark')
+    steps:
+      - name: Checkout
+        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
+
+      - name: Post instructions comment
+        run: |
+          python3 .github/scripts/render_bench_comment.py \
+            --status instructions --base "${{ github.event.pull_request.base.ref }}" \
+            > "$RUNNER_TEMP/comment.md"
+          bash .github/scripts/upsert_pr_comment.sh \
+            "${{ github.event.pull_request.number }}" "$MARKER" "$RUNNER_TEMP/comment.md"
+
+  bench:
+    name: Benchmark PR
+    runs-on: runner-arm-bench
+    timeout-minutes: 120
+    # Run when the `benchmark` label is added, and on every push / reopen / open
+    # while the label is present. Adding an unrelated label does not trigger a run.
+    if: >
+      (github.event.action == 'labeled' && github.event.label.name == 'benchmark') ||
+      ((github.event.action == 'synchronize' || github.event.action == 'reopened' || github.event.action == 'opened') &&
+       contains(github.event.pull_request.labels.*.name, 'benchmark'))
+    steps:
+      - name: Checkout PR head
+        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
+        with:
+          # Benchmark the PR's own commit (not the merge ref), so the comparison
+          # is this branch's code vs nightly `main`.
+          ref: ${{ github.event.pull_request.head.sha }}
+
+      - name: Configure paths
+        run: echo "RESULTS=$RUNNER_TEMP/results.json" >> "$GITHUB_ENV"
+
+      - name: Open running comment
+        run: |
+          python3 .github/scripts/render_bench_comment.py \
+            --status running --phase "Building & benchmarking this PR (vs latest nightly \`${{ github.event.pull_request.base.ref }}\`)…" \
+            --sha "${{ github.event.pull_request.head.sha }}" \
+            --base "${{ github.event.pull_request.base.ref }}" --run-url "$RUN_URL" \
+            > "$RUNNER_TEMP/comment.md"
+          bash .github/scripts/upsert_pr_comment.sh \
+            "${{ github.event.pull_request.number }}" "$MARKER" "$RUNNER_TEMP/comment.md"
+
+      - name: Setup environment (toolchain + sccache + cache)
+        uses: ./.github/actions/setup-environment
+        with:
+          workspaces: language-tests
+
+      - name: Build benchmark suite
+        run: cargo build --release --features bench,bench-remote-store --manifest-path language-tests/Cargo.toml
+
+      - name: Benchmark PR head (compare vs nightly main in the shared store)
+        run: |
+          # Read-only against the shared store (NO --save): the harness fetches the
+          # latest `main` measurement (written by the nightly run) and compares this
+          # PR's `--quick` run against it. quiet_system.py mirrors the nightly run's
+          # environment so the tw
```

**File**: `language-tests/README.md` (modified, +40/-2)
```diff
@@ -93,6 +93,12 @@ cargo make bench -- scans/where_integer_in_many_full --profile
 
 # restrict a matrix scan to a single dataset variant (see "dataset matrix" below)
 cargo make bench -- scans/where_integer_in_many_full --dataset indexed
+
+# fast, coarse run: shrinks every timing knob ~10x (see "--quick" below)
+cargo make bench -- scans/count --quick
+
+# write per-bench results + the comparison verdict to a JSON file
+cargo make bench -- scans/count --json results.json
 ```
 
 Benches run **strictly serially** (never in parallel — that would corrupt
@@ -101,6 +107,38 @@ mean / median / std-dev / MAD with confidence intervals, plus a comparison
 against the saved baseline (improved / regressed / within-noise, with a
 p-value).
 
+`--quick` overrides every bench's timing config with much smaller values (250ms
+warmup, 10 samples, 2s measurement, 10s cap) for a fast, low-power local pass: it
+reliably surfaces **large** regressions but is too coarse for few-percent drift.
+
+`--json <path>` writes a machine-readable report — for each bench its median /
+mean times and, when a baseline was found, the baseline's median, percentage
+change, p-value and verdict. Used to render the PR-comparison comment.
+
+`--store-url <ws>` compares against (and, with `--save`, writes to) a remote
+SurrealDB bench datastore instead of the local one. The harness `fetch_latest`es
+the most recent stored measurement per bench and compares the current run against
+it — which is how the PR workflow compares against the nightly `main` baseline.
+Requires the `bench-remote-store` feature.
+
+#### PR comparison (PR vs nightly `main`)
+
+The `Language bench (PR)` GitHub Actions workflow
+([`.github/workflows/language-bench-quick.yml`](../.github/workflows/language-bench-quick.yml))
+manages a single sticky comment on every PR:
+
+1. **On open**, the comment explains how to opt in (add the **`benchmark`** label).
+2. **When the label is added** (and on every push while it's set), it benchmarks
+   **only the PR head** (full run, on the `runner-arm-bench` pool) and compares it,
+   read-only, against the latest `main` baseline in the shared bench datastore.
+
+`main` itself is **not** benchmarked by this workflow — it's benchmarked by the
+[nightly run](../.github/workflows/nightly-bench.yml) (also full, also
+`runner-arm-bench`), which `--save`s `main`'s results to that store. So the
+baseline is full-quality, measured on the same runner pool, and refreshes whenever
+nightly re-runs (or nightly is dispatched manually after a notable change). Remove
+the label to stop.
+
 By default benches run on the in-memory engine. `--backend surrealkv` (always
 available) or `--backend rocksdb` (build with `--features backend-rocksdb`) run
 them on the file-backed engines instead, in a temporary directory that's removed
@@ -291,8 +329,8 @@ flags to `scripts/bench/measure.sh` (timing, the default) or, with `--profile`,
 same arguments, or drive the harness binary yourself:
 
 ```bash
-# run every bench (no filter), or one by path substring; --save/--dataset optional
-cargo run --features bench -- bench run [--save] [--dataset NAME] [--backend mem] [<filter>]
+# run every bench (no filter), or one by path substring; flags are all optional
+cargo run --features bench -- bench run [--save] [--dataset NAME] [--backend mem] [--quick] [--json PATH] [<filter>]
 ```
 
 `scripts/bench/optimise.workflow.js` is a workflow recipe driving an AI
```

**File**: `language-tests/src/cmd/bench/cli.rs` (modified, +2/-0)
```diff
@@ -23,6 +23,8 @@ pub fn cmd() -> Command {
 			)
             .arg(arg!(--path <PATH> "The path to tests directory").default_value("./tests"))
 			.arg(arg!(-s --save "Save the result to the comparison datastore"))
+			.arg(arg!(-q --quick "Run a fast, low-sample comparison (coarse: catches large regressions, not small drift)"))
+			.arg(arg!(--json <PATH> "Write per-bench results and the comparison verdict to a JSON file"))
 		)
 		.subcommand_required(true)
 }
```

**File**: `language-tests/src/cmd/bench/run.rs` (modified, +133/-16)
```diff
@@ -158,6 +158,8 @@ struct CmdConfig<'a> {
 	dataset: Option<&'a String>,
 	backend: Backend,
 	save: bool,
+	quick: bool,
+	json: Option<&'a String>,
 	store: StoreConfig<'a>,
 }
 
@@ -169,18 +171,73 @@ impl<'a> CmdConfig<'a> {
 		let dataset = current.get_one::<String>("dataset");
 		let backend = *current.get_one::<Backend>("backend").unwrap();
 		let save = current.get_flag("save");
+		let quick = current.get_flag("quick");
+		let json = current.get_one::<String>("json");
 
 		Self {
 			path,
 			filter,
 			dataset,
 			backend,
 			save,
+			quick,
+			json,
 			store: StoreConfig::from_matches(parent),
 		}
 	}
 }
 
+/// Classifies a comparison against the baseline into a stable, machine-readable
+/// verdict. Kept in sync with the human-readable summary printed in `run()`:
+/// a difference that isn't statistically significant, or is significant but
+/// inside the noise threshold, is reported as `within-noise`.
+fn comparison_verdict(compare: &ComparisonData) -> &'static str {
+	if compare.p_value >= DEFAULT_SIGNIFICANCE_THRESHOLD {
+		return "within-noise";
+	}
+	let noise = DEFAULT_NOISE_THRESHOLD;
+	if compare.dist_mean.lower_bound < -noise && compare.dist_mean.upper_bound < -noise {
+		"improved"
+	} else if compare.dist_mean.lower_bound > noise && compare.dist_mean.upper_bound > noise {
+		"regressed"
+	} else {
+		"within-noise"
+	}
+}
+
+/// Per-bench comparison against the fetched baseline. Percentages are relative to
+/// the baseline (positive = slower than baseline = regression).
+#[derive(serde::Serialize)]
+struct JsonComparison {
+	/// Median per-iteration time of the baseline (`main`), in seconds.
+	base_median_secs: f64,
+	change_pct: f64,
+	change_lo_pct: f64,
+	change_hi_pct: f64,
+	p_value: f64,
+	verdict: &'static str,
+}
+
+/// One bench's result in the `--json` report. Times are in seconds.
+#[derive(serde::Serialize)]
+struct JsonBench {
+	name: String,
+	median_secs: f64,
+	median_lo_secs: f64,
+	median_hi_secs: f64,
+	mean_secs: f64,
+	comparison: Option<JsonComparison>,
+}
+
+/// The `--json` report: every measured bench plus its comparison (when a baseline
+/// was found in the store). Consumed by the PR-comment renderer in CI.
+#[derive(serde::Serialize)]
+struct JsonReport {
+	quick: bool,
+	backend: String,
+	benches: Vec<JsonBench>,
+}
+
 /// Main subcommand function, runs the actual subcommand.
 pub async fn run(color: ColorMode, parent: &ArgMatches, current: &ArgMatches) -> Result<()> {
 	if cfg!(debug_assertions) {
@@ -399,7 +456,7 @@ pub async fn run(color: ColorMode, parent: &ArgMatches, current: &ArgMatches) ->
 						.enable_all()
 						.build()
 						.unwrap()
-						.block_on(run_group(group, &config, baselines))
+						.block_on(run_group(group, &config, cfg.quick, baselines))
 				})
 				.join()
 		})
@@ -494,7 +551,7 @@ pub async fn run(color: ColorMode, parent: &ArgMatches, current: &ArgMatches) ->
 						.enable_all()
 						.build()
 						.unwrap()
-						.block_on(run_bench(&run, &config, baseline, None))
+						.block_on(run_bench(&run, &config, baseline, cfg.quick, None))
 				})
 				.join()
 		})
@@ -652,6 +709,37 @@ pub async fn run(color: ColorMode, parent: &ArgMatches, current: &ArgMatches) ->
 		}
 	}
 
+	if let Some(json_path) = cfg.json {
+		let benches = measurements
+			.iter()
+			.map(|(name, m, compare)| JsonBench {
+				name: name.clone(),
+				median_secs: m.median.point,
+				median_lo_secs: m.median.lower_bound,
+				median_hi_secs: m.median.upper_bound,
+				mean_secs: m.mean.point,
+				comparison: compare.as_ref().map(|c| JsonComparison {
+					base_median_secs: c.base_median,
+					change_pct: c.dist_mean.point * 100.0,
+					change_lo_pct: c.dist_mean.lower_bound * 100.0,
+					change_hi_pct: c.dist_mean.upper_bound * 100.0,
+					p_value: c.p_value,
+					verdict: comparison_verdict(c),
+				}),
+			})
+			.collect();
+		let report = JsonReport {
+			quick: cfg.quick,
+			backend: cfg.backend.to_string(),
+			benches,
+		};
+		let json =
+			serde_json::to_string_pretty(&report).context("Failed to serialize benchmark JSON")?;
+		std::fs::write(json_path, json)
+			.with_context(|| format!("Failed to write benchmark JSON to {json_path}"))?;
+		println!("Wrote benchmark JSON to {json_path}");
+	}
+
 	for e in load_errors.iter() {
 		e.display(color);
 	}
@@ -895,6 +983,7 @@ enum GroupOutcome {
 async fn run_group(
 	group: &[TestRun<BenchRunConfig>],
 	config: &BenchConfig,
+	quick: bool,
 	baselines: Vec<Option<MeasurementData>>,
 ) -> Result<GroupOutcome> {
 	let token = tokio_util::sync::CancellationToken::new();
@@ -909,7 +998,7 @@ async fn run_group(
 	// `InsufficientSamples`) is returned to `run()` for storing/printing.
 	let mut results = Vec::with_capacity(group.len());
 	for (run, baseline) in group.iter().zip(baselines) {
-		results.push(run_bench(run, config, baseline, Some(dbs.clone())).await?);
+		results.push(run_bench(run, config, baseline, quick, Some(dbs.clone())).await?);
 	}
 
 	Ok(GroupOutcome::Ran(resul
```

**File**: `language-tests/src/cmd/bench/stats/mod.rs` (modified, +4/-0)
```diff
@@ -180,6 +180,9 @@ pub struct ComparisonData {
 	//pub dist_median: Estimate,
 	//pub t: Estimate,
 	pub p_value: f64,
+	/// Median per-iteration time (seconds) of the baseline being compared against,
+	/// so a report can show the baseline's absolute time next to the current run.
+	pub base_median: f64,
 }
 
 impl ComparisonData {
@@ -214,6 +217,7 @@ impl ComparisonData {
 			//dist_median,
 			//t,
 			p_value,
+			base_median: base.median.point,
 		}
 	}
 }
```

---

### Incident Patch 12: `76efe218` (2026-07-01)
**Commit Message**: fix(deps): bump ammonia/anyhow/wasmtime to clear RustSec advisories (#523)

**File**: `Cargo.lock` (modified, +185/-311)
```diff
@@ -138,14 +138,13 @@ checksum = "e9d4ee0d472d1cd2e28c97dfa124b3d8d992e10eb0a035f33f5d12e3a177ba3b"
 
 [[package]]
 name = "ammonia"
-version = "4.1.2"
+version = "4.1.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "17e913097e1a2124b46746c980134e8c954bc17a6a59bb3fde96f088d126dde6"
+checksum = "68b9d3370580a12f4b7a10fdcc18b28942c083ba570e3d954fe59d10951b85a2"
 dependencies = [
  "cssparser",
  "html5ever",
  "maplit",
- "tendril",
  "url",
 ]
 
@@ -200,7 +199,7 @@ version = "1.1.5"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "40c48f72fd53cd289104fc64099abca73db4166ad86ea0b4341abe65af83dadc"
 dependencies = [
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -211,14 +210,14 @@ checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
 name = "anyhow"
-version = "1.0.102"
+version = "1.0.103"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
+checksum = "2a4385e2e34eb35d6b3efe798b9eb88096925d87726c0798709bf56d9ed84af3"
 
 [[package]]
 name = "approx"
@@ -472,7 +471,7 @@ dependencies = [
  "futures-lite",
  "parking",
  "polling",
- "rustix 1.1.4",
+ "rustix",
  "slab",
  "windows-sys 0.61.2",
 ]
@@ -1043,7 +1042,7 @@ dependencies = [
  "cap-primitives",
  "cap-std",
  "io-lifetimes",
- "windows-sys 0.52.0",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -1054,7 +1053,7 @@ checksum = "20a158160765c6a7d0d8c072a53d772e4cb243f38b04bfcf6b4939cfbe7482e7"
 dependencies = [
  "cap-primitives",
  "cap-std",
- "rustix 1.1.4",
+ "rustix",
  "smallvec",
 ]
 
@@ -1070,22 +1069,12 @@ dependencies = [
  "io-lifetimes",
  "ipnet",
  "maybe-owned",
- "rustix 1.1.4",
+ "rustix",
  "rustix-linux-procfs",
- "windows-sys 0.52.0",
+ "windows-sys 0.59.0",
  "winx",
 ]
 
-[[package]]
-name = "cap-rand"
-version = "3.4.5"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d8144c22e24bbcf26ade86cb6501a0916c46b7e4787abdb0045a467eb1645a1d"
-dependencies = [
- "ambient-authority",
- "rand 0.8.6",
-]
-
 [[package]]
 name = "cap-std"
 version = "3.4.5"
@@ -1095,7 +1084,7 @@ dependencies = [
  "cap-primitives",
  "io-extras",
  "io-lifetimes",
- "rustix 1.1.4",
+ "rustix",
 ]
 
 [[package]]
@@ -1108,7 +1097,7 @@ dependencies = [
  "cap-primitives",
  "iana-time-zone",
  "once_cell",
- "rustix 1.1.4",
+ "rustix",
  "winx",
 ]
 
@@ -1491,37 +1480,37 @@ dependencies = [
 
 [[package]]
 name = "cranelift-assembler-x64"
-version = "0.131.3"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3867f7a56768640a79fc660d2f60298251dc6d65b5d1c907706cd1afff024957"
+checksum = "e06aeba2c965fc446d13c56a6ccb2631b78445d7544543dd9a25289977630914"
 dependencies = [
  "cranelift-assembler-x64-meta",
 ]
 
 [[package]]
 name = "cranelift-assembler-x64-meta"
-version = "0.131.3"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a0661d63dcf8fc4a6538c1ee4d523917c5b27e9fce7a4114cdf9e2b30b4043cf"
+checksum = "ee2d2dde4ec1352715595b5cfa6fe2e5b8ebb9da3457b3ee8db0aa2808c069aa"
 dependencies = [
  "cranelift-srcgen",
 ]
 
 [[package]]
 name = "cranelift-bforest"
-version = "0.131.3"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "a8d535b489159ea63e3c40dfbe8d0e12bfb71f2a14845ef2407353e06c5a697c"
+checksum = "03b4982ef9fa54ec9eee841e891e7ddc5434be1250e88de31572e000c888f30b"
 dependencies = [
  "cranelift-entity",
  "wasmtime-internal-core",
 ]
 
 [[package]]
 name = "cranelift-bitset"
-version = "0.131.3"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c3af4f7d421b2354deb01d714266022f38fcdbebc9f5f1ec6d310d3c27286d9e"
+checksum = "529143118c4eeb58c39ecb02319557d512be6c61348486422974ab8e3906b8a8"
 dependencies = [
  "serde",
  "serde_derive",
@@ -1530,9 +1519,9 @@ dependencies = [
 
 [[package]]
 name = "cranelift-codegen"
-version = "0.131.3"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "09fe4c289e67e0221d1705734a57f95e25c289ed0ead7728743ea21285fc4cf1"
+checksum = "b7780677247ad3577e3a6a3ebf43f39b325a11d6393db72b2c9968a910d4d13d"
 dependencies = [
  "bumpalo",
  "cranelift-assembler-x64",
@@ -1544,23 +1533,26 @@ dependencies = [
  "cranelift-entity",
  "cranelift-isle",
  "gimli 0.33.0",
- "hashbrown 0.16.1",
+ "hashbrown 0.17.1",
  "libm",
  "log",
+ "postcard",
  "pulley-interpreter",
  "regalloc2",
  "rustc-hash",
  "serde",
+ "serde_derive",
+ "sha2",
  "smallvec",
  "target-lexicon",
  "wasmtime-internal-core",
 ]
 
 [[package]]
 name = "cranelift-codegen-meta"
-version = "0.131.3"
+version = "0.133.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum
```

**File**: `Cargo.toml` (modified, +2/-2)
```diff
@@ -227,8 +227,8 @@ toml = "0.9.12"
 wasm-encoder = "0.245"
 wasm-opt = "0.116.1"
 wasmparser = "0.245"
-wasmtime = { version = "44.0.3", default-features = false, features = ["async", "cranelift", "winch", "runtime", "std", "wat", "component-model", "parallel-compilation"] }
-wasmtime-wasi = { version = "44.0.3", features = ["p1", "p2"] }
+wasmtime = { version = "46.0.1", default-features = false, features = ["async", "cranelift", "winch", "runtime", "std", "wat", "component-model", "parallel-compilation"] }
+wasmtime-wasi = { version = "46.0.1", features = ["p1", "p2"] }
 wit-bindgen = { version = "0.51", default-features = false, features = ["macros", "realloc"] }
 zstd = { version = "0.13.3", default-features = false }
 
```

**File**: `supply-chain/config.toml` (modified, +9/-25)
```diff
@@ -106,7 +106,7 @@ version = "0.2.2"
 criteria = "safe-to-deploy"
 
 [[exemptions.ammonia]]
-version = "4.1.2"
+version = "4.1.3"
 criteria = "safe-to-deploy"
 
 [[exemptions.approx]]
@@ -581,10 +581,6 @@ criteria = "safe-to-deploy"
 version = "2.0.0"
 criteria = "safe-to-deploy"
 
-[[exemptions.futf]]
-version = "0.1.5"
-criteria = "safe-to-deploy"
-
 [[exemptions.futures]]
 version = "0.3.32"
 criteria = "safe-to-deploy"
@@ -734,7 +730,7 @@ version = "0.5.12"
 criteria = "safe-to-deploy"
 
 [[exemptions.html5ever]]
-version = "0.35.0"
+version = "0.39.0"
 criteria = "safe-to-deploy"
 
 [[exemptions.hyper-rustls]]
@@ -921,16 +917,12 @@ criteria = "safe-to-deploy"
 version = "0.15.7"
 criteria = "safe-to-deploy"
 
-[[exemptions.mac]]
-version = "0.1.1"
+[[exemptions.mach2]]
+version = "0.6.0"
 criteria = "safe-to-deploy"
 
 [[exemptions.markup5ever]]
-version = "0.35.0"
-criteria = "safe-to-deploy"
-
-[[exemptions.match_token]]
-version = "0.35.0"
+version = "0.39.0"
 criteria = "safe-to-deploy"
 
 [[exemptions.matchit]]
@@ -1325,14 +1317,6 @@ criteria = "safe-to-deploy"
 version = "1.7.0"
 criteria = "safe-to-deploy"
 
-[[exemptions.rmp]]
-version = "0.8.15"
-criteria = "safe-to-deploy"
-
-[[exemptions.rmp-serde]]
-version = "1.3.1"
-criteria = "safe-to-deploy"
-
 [[exemptions.roaring]]
 version = "0.11.4"
 criteria = "safe-to-deploy"
@@ -1550,11 +1534,11 @@ version = "0.1.1"
 criteria = "safe-to-deploy"
 
 [[exemptions.string_cache]]
-version = "0.8.9"
+version = "0.9.0"
 criteria = "safe-to-deploy"
 
 [[exemptions.string_cache_codegen]]
-version = "0.5.4"
+version = "0.6.1"
 criteria = "safe-to-deploy"
 
 [[exemptions.symbolic-common]]
@@ -1590,7 +1574,7 @@ version = "3.3.0"
 criteria = "safe-to-deploy"
 
 [[exemptions.tendril]]
-version = "0.4.3"
+version = "0.5.0"
 criteria = "safe-to-deploy"
 
 [[exemptions.terminal_size]]
@@ -1790,7 +1774,7 @@ version = "1.1.0"
 criteria = "safe-to-deploy"
 
 [[exemptions.web_atoms]]
-version = "0.1.3"
+version = "0.2.5"
 criteria = "safe-to-deploy"
 
 [[exemptions.webpki-root-certs]]
```

**File**: `supply-chain/imports.lock` (modified, +124/-186)
```diff
@@ -58,8 +58,8 @@ user-login = "epage"
 user-name = "Ed Page"
 
 [[publisher.anyhow]]
-version = "1.0.102"
-when = "2026-02-20"
+version = "1.0.103"
+when = "2026-06-25"
 user-id = 3618
 user-login = "dtolnay"
 user-name = "David Tolnay"
@@ -217,13 +217,6 @@ user-id = 6825
 user-login = "sunfishcode"
 user-name = "Dan Gohman"
 
-[[publisher.cap-rand]]
-version = "3.4.5"
-when = "2025-10-24"
-user-id = 6825
-user-login = "sunfishcode"
-user-name = "Dan Gohman"
-
 [[publisher.cap-std]]
 version = "3.4.5"
 when = "2025-10-24"
@@ -308,68 +301,68 @@ user-login = "tarcieri"
 user-name = "Tony Arcieri"
 
 [[publisher.cranelift-assembler-x64]]
-version = "0.131.2"
-when = "2026-05-21"
+version = "0.133.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
 
 [[publisher.cranelift-assembler-x64-meta]]
-version = "0.131.2"
-when = "2026-05-21"
+version = "0.133.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
 
 [[publisher.cranelift-bforest]]
-version = "0.131.2"
-when = "2026-05-21"
+version = "0.133.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
 
 [[publisher.cranelift-bitset]]
-version = "0.131.2"
-when = "2026-05-21"
+version = "0.133.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
 
 [[publisher.cranelift-codegen]]
-version = "0.131.2"
-when = "2026-05-21"
+version = "0.133.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
 
 [[publisher.cranelift-codegen-meta]]
-version = "0.131.2"
-when = "2026-05-21"
+version = "0.133.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
 
 [[publisher.cranelift-codegen-shared]]
-version = "0.131.2"
-when = "2026-05-21"
+version = "0.133.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
 
 [[publisher.cranelift-control]]
-version = "0.131.2"
-when = "2026-05-21"
+version = "0.133.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
 
 [[publisher.cranelift-entity]]
-version = "0.131.2"
-when = "2026-05-21"
+version = "0.133.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
 
 [[publisher.cranelift-frontend]]
-version = "0.131.2"
-when = "2026-05-21"
+version = "0.133.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
 
 [[publisher.cranelift-isle]]
-version = "0.131.2"
-when = "2026-05-21"
+version = "0.133.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
 
 [[publisher.cranelift-native]]
-version = "0.131.2"
-when = "2026-05-21"
+version = "0.133.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
 
 [[publisher.cranelift-srcgen]]
-version = "0.131.2"
-when = "2026-05-21"
+version = "0.133.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
 
 [[publisher.cxx]]
@@ -667,27 +660,13 @@ user-id = 3618
 user-login = "dtolnay"
 user-name = "David Tolnay"
 
-[[publisher.linux-raw-sys]]
-version = "0.4.15"
-when = "2025-01-08"
-user-id = 6825
-user-login = "sunfishcode"
-user-name = "Dan Gohman"
-
 [[publisher.linux-raw-sys]]
 version = "0.12.1"
 when = "2025-12-23"
 user-id = 6825
 user-login = "sunfishcode"
 user-name = "Dan Gohman"
 
-[[publisher.mach2]]
-version = "0.4.3"
-when = "2025-06-22"
-user-id = 51017
-user-login = "JohnTitor"
-user-name = "Yuki Okushi"
-
 [[publisher.maplit]]
 version = "1.0.2"
 when = "2019-08-24"
@@ -772,13 +751,6 @@ user-id = 267
 user-login = "tarcieri"
 user-name = "Tony Arcieri"
 
-[[publisher.phf]]
-version = "0.11.3"
-when = "2025-01-06"
-user-id = 51017
-user-login = "JohnTitor"
-user-name = "Yuki Okushi"
-
 [[publisher.phf]]
 version = "0.13.1"
 when = "2025-08-23"
@@ -787,15 +759,8 @@ user-login = "JohnTitor"
 user-name = "Yuki Okushi"
 
 [[publisher.phf_codegen]]
-version = "0.11.3"
-when = "2025-01-06"
-user-id = 51017
-user-login = "JohnTitor"
-user-name = "Yuki Okushi"
-
-[[publisher.phf_generator]]
-version = "0.11.3"
-when = "2025-01-06"
+version = "0.13.1"
+when = "2025-08-23"
 user-id = 51017
 user-login = "JohnTitor"
 user-name = "Yuki Okushi"
@@ -807,27 +772,13 @@ user-id = 51017
 user-login = "JohnTitor"
 user-name = "Yuki Okushi"
 
-[[publisher.phf_macros]]
-version = "0.11.3"
-when = "2025-01-06"
-user-id = 51017
-user-login = "JohnTitor"
-user-name = "Yuki Okushi"
-
 [[publisher.phf_macros]]
 version = "0.13.1"
 when = "2025-08-23"
 user-id = 51017
 user-login = "JohnTitor"
 user-name = "Yuki Okushi"
 
-[[publisher.phf_shared]]
-version = "0.11.3"
-when = "2025-01-06"
-user-id = 51017
-user-login = "JohnTitor"
-user-name = "Yuki Okushi"
-
 [[publisher.phf_shared]]
 version = "0.13.1"
 when = "2025-08-23"
@@ -871,13 +822,13 @@ user-login = "rushmorem"
 user-name = "Rushmore Mushambi"
 
 [[publisher.pulley-interpreter]]
-version = "44.0.2"
-when = "2026-05-21"
+version = "46.0.1"
+when = "2026-06-24"
 trusted-publisher = "github:bytecodealliance/wasmtime"
```

---

### Incident Patch 13: `fee6567b` (2026-07-01)
**Commit Message**: fix(core): resume index builds orphaned by a crashed/expired owner node (#513)

**File**: `surrealdb/core/src/key/root/tl.rs` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ impl Tl {
 			TaskLeaseType::IndexCompaction => 2,
 			TaskLeaseType::EventProcessing => 3,
 			TaskLeaseType::ReclaimTombstones => 4,
+			TaskLeaseType::IndexBuildResume => 5,
 		};
 		Self {
 			__: b'/',
```

**File**: `surrealdb/core/src/kvs/ds.rs` (modified, +113/-0)
```diff
@@ -2173,6 +2173,119 @@ impl Datastore {
 	/// A tuple `(iterations, errors)` where `iterations` is the number of
 	/// compaction batches processed and `errors` is the total number of
 	/// individual index compaction failures across all batches.
+	/// Resume index builds stranded by a crashed or expired owner node.
+	///
+	/// A `CONCURRENTLY` index build runs as a detached task. If its owning node
+	/// dies mid-build, nothing waits on that generation again, so the durable
+	/// build state stays in `Building`/`Closing` and the index reports
+	/// `status: indexing` with a frozen counter indefinitely. This scan adopts
+	/// such builds — once their owner lease has expired — via the existing
+	/// expired-lease takeover (see [`IndexBuilder::resume_stalled`]) and drives
+	/// them to completion.
+	///
+	/// The scan is lease-guarded so a single node runs it per cluster; the
+	/// per-index takeover is additionally CAS-guarded, so correctness does not
+	/// depend on the lease. Enumeration walks the catalog, so cost is
+	/// proportional to the total index count; operators who prefer to recover
+	/// stalled builds manually (with `REBUILD INDEX`) can disable the scan by
+	/// setting its interval to zero.
+	///
+	/// Returns the number of stalled builds adopted this pass.
+	#[instrument(level = "trace", target = "surrealdb::core::kvs::ds", skip(self, canceller))]
+	pub async fn resume_stalled_index_builds(
+		&self,
+		interval: Duration,
+		canceller: CancellationToken,
+	) -> Result<usize> {
+		Self::ensure_not_cancelled(&canceller)?;
+		// Single-node-per-cluster guard. The lease lasts two intervals so an
+		// in-flight scan isn't preempted between ticks.
+		let lh = LeaseHandler::new_with_canceller(
+			self.sequences.clone(),
+			self.id,
+			self.transaction_factory.clone(),
+			TaskLeaseType::IndexBuildResume,
+			interval * 2,
+			canceller.clone(),
+		)?;
+		if !lh.has_lease().await? {
+			return Ok(0);
+		}
+		// Snapshot the (ns, db, table, index) hierarchy in a short read
+		// transaction. Index definitions are cloned out so the per-index
+		// build-state checks below don't hold the catalog transaction open.
+		let mut candidates = Vec::new();
+		{
+			let txn = self.transaction(Read, Optimistic).await?;
+			let res: Result<()> = async {
+				for ns in txn.all_ns(None).await?.iter() {
+					for db in txn.all_db(ns.namespace_id, None).await?.iter() {
+						for tb in txn.all_tb(ns.namespace_id, db.database_id, None).await?.iter() {
+							for ix in txn
+								.all_tb_indexes(ns.namespace_id, db.database_id, &tb.name, None)
+								.await?
+								.iter()
+							{
+								// Indexes pending removal are cleared by the
+								// tombstone reaper, not resumed.
+								if ix.prepare_remove {
+									continue;
+								}
+								candidates.push((
+									ns.namespace_id,
+									ns.name.clone(),
+									db.database_id,
+									db.name.clone(),
+									tb.table_id,
+									Arc::new(ix.clone()),
+								));
+							}
+						}
+					}
+				}
+				Ok(())
+			}
+			.await;
+			let _ = txn.cancel().await;
+			res?;
+		}
+		// Attempt a takeover for each candidate. `resume_stalled` is a cheap
+		// no-op for healthy/online/live builds, so this is safe to call for
+		// every index every pass.
+		let index_builder = &self.index_builder;
+		let mut resumed = 0;
+		for (ns_id, ns_name, db_id, db_name, tb_id, ix) in candidates {
+			Self::ensure_not_cancelled(&canceller)?;
+			lh.try_maintain_lease().await?;
+			let ctx = self.setup_ctx()?.freeze();
+			let opt = self.setup_options(
+				&Session::owner().with_ns(ns_name.as_str()).with_db(db_name.as_str()),
+			);
+			match index_builder
+				.resume_stalled(&ctx, opt, ns_id, db_id, tb_id, Arc::clone(&ix))
+				.await
+			{
+				Ok(true) => {
+					resumed += 1;
+					info!(
+						target: TARGET,
+						"Resuming stalled index build '{}' on table '{}'",
+						ix.name, ix.table_name
+					);
+				}
+				Ok(false) => {}
+				Err(e) => {
+					warn!(
+						target: TARGET,
+						"Failed to resume stalled index build '{}' on table '{}': {e}",
+						ix.name, ix.table_name
+					);
+				}
+			}
+		}
+		Ok(resumed)
+	}
+
 	#[instrument(level = "trace", target = "surrealdb::core::kvs::ds", skip(dbs, canceller))]
 	pub async fn index_compaction(
 		dbs: Arc<Datastore>,
```

**File**: `surrealdb/core/src/kvs/index/builder.rs` (modified, +56/-0)
```diff
@@ -258,6 +258,62 @@ impl IndexBuilder {
 			BuildStart::RemoteOwner(_) => Ok(None),
 		}
 	}
+
+	/// Resume an index build left unfinished by a crashed or expired owner.
+	///
+	/// A `CONCURRENTLY` build is fire-and-forget: the initiating statement
+	/// returns as soon as the builder task is spawned. If the owning node then
+	/// dies mid-build, nothing ever waits on that generation again, so the
+	/// durable `!bs` state is stranded in `Building`/`Closing` and the index
+	/// reports `status: indexing` with a frozen counter indefinitely. This
+	/// performs the same expired-lease takeover the blocking path performs in
+	/// [`Self::wait_for_remote_building`], but proactively, driven by the
+	/// periodic resume scan rather than by a statement that is waiting.
+	///
+	/// Returns `Ok(true)` if this call adopted the generation and spawned a
+	/// resume task. It is a no-op (`Ok(false)`) when the durable state is
+	/// missing, already `Online`/`Error`, still covered by a live owner lease,
+	/// or already being built by a task in this process, so it is safe to call
+	/// for every index on every scan. The takeover is CAS-guarded, so racing
+	/// scans on other cluster nodes resolve to a single winner.
+	pub(crate) async fn resume_stalled(
+		&self,
+		ctx: &FrozenContext,
+		opt: Options,
+		ns: NamespaceId,
+		db: DatabaseId,
+		tb: TableId,
+		ix: Arc<IndexDefinition>,
+	) -> Result<bool> {
+		let key = Arc::new(IndexKey::new(ns, db, &ix.table_name, ix.index_id));
+		// Skip if a builder task for this index is already running locally.
+		if let Some(existing) = self.indexes.read().await.get(&key)
+			&& !existing.is_finished()
+		{
+			return Ok(false);
+		}
+		let building = Arc::new(Building::new(ctx, self.tf.clone(), opt, tb, ix, key)?);
+		// Cheap read-only pre-check: only an unfinished build whose owner lease
+		// has expired is eligible. Healthy indexes and live builds bail out here
+		// without opening a write transaction.
+		let Some(state) = building.read_durable_build_state().await? else {
+			return Ok(false);
+		};
+		if !matches!(state.phase, IndexBuildPhase::Building | IndexBuildPhase::Closing)
+			|| !build_owner_expired(&state, Utc::now())
+		{
+			return Ok(false);
+		}
+		// Claim the expired generation and spawn the resume task. A no-op result
+		// (`None`) means another scanner or a concurrent statement won the race.
+		match building.takeover_expired_build_state().await? {
+			Some(acquired) => {
+				self.start_acquired_building(building, acquired, None).await?;
+				Ok(true)
+			}
+			None => Ok(false),
+		}
+	}
 }
 
 pub(super) struct Building {
```

**File**: `surrealdb/core/src/kvs/index/tests.rs` (modified, +173/-0)
```diff
@@ -1927,6 +1927,179 @@ async fn takeover_preserves_durable_progress_counts() -> Result<()> {
 	Ok(())
 }
 
+/// The periodic resume scan adopts a `CONCURRENTLY` build that a crashed owner
+/// left stranded (expired lease, `Building` phase) and drives it to `Online`,
+/// and is a no-op once the index is healthy again.
+#[tokio::test(flavor = "multi_thread")]
+async fn resume_scan_adopts_stalled_concurrent_build() -> Result<()> {
+	let (ds, session) = new_index_test_ds().await?;
+	execute_all(
+		&ds,
+		&session,
+		"
+			DEFINE TABLE user SCHEMALESS;
+			CREATE user:one SET email = 'one@example.com' RETURN NONE;
+			CREATE user:two SET email = 'two@example.com' RETURN NONE;
+			DEFINE INDEX test ON user FIELDS email;
+			",
+	)
+	.await?;
+
+	let (ns, db, table, ix) = get_table_index(&ds, "user", "test").await?;
+	let ikb = IndexKeyBase::new(ns, db, table.clone(), ix.index_id);
+
+	// Simulate an ungraceful crash mid-build: a `Building` generation whose owner
+	// lease has expired and whose initial scan never completed.
+	let expired = Utc::now() - chrono::Duration::seconds(BUILD_OWNER_LEASE_SECS + 5);
+	let tx = ds.transaction(TransactionType::Write, Optimistic).await?;
+	tx.set(
+		&ikb.new_bs_key(),
+		&IndexBuildState {
+			generation: 2,
+			phase: IndexBuildPhase::Building,
+			owner: Some(Uuid::new_v4()),
+			next_ticket: 0,
+			initial_complete: false,
+			updated_at: expired,
+			owner_heartbeat_at: Some(expired),
+			error: None,
+			report_status: Some(IndexBuildReportStatus::Indexing),
+			initial: Some(0),
+			updated: None,
+			pending: None,
+		},
+	)
+	.await?;
+	tx.commit().await?;
+
+	// The scan should adopt exactly this build.
+	let resumed = ds
+		.resume_stalled_index_builds(
+			Duration::from_secs(30),
+			tokio_util::sync::CancellationToken::new(),
+		)
+		.await?;
+	assert_eq!(resumed, 1, "scan should adopt the stalled build");
+
+	// The adopted build runs asynchronously; wait for it to reach `Online`.
+	let deadline = Instant::now() + Duration::from_secs(30);
+	loop {
+		let state = durable_build_state(&ds, &ikb).await?;
+		if state.phase == IndexBuildPhase::Online {
+			break;
+		}
+		assert!(
+			Instant::now() < deadline,
+			"resumed build did not complete; phase={:?}",
+			state.phase
+		);
+		sleep(Duration::from_millis(100)).await;
+	}
+	let building = index_building_json(&ds, &session, "user", "test").await?;
+	assert_eq!(building.get("status").and_then(|status| status.as_str()), Some("ready"));
+
+	// With the index healthy again, a second scan must be a no-op.
+	let resumed_again = ds
+		.resume_stalled_index_builds(
+			Duration::from_secs(30),
+			tokio_util::sync::CancellationToken::new(),
+		)
+		.await?;
+	assert_eq!(resumed_again, 0, "healthy index must not be re-adopted");
+
+	Ok(())
+}
+
+/// End-to-end check of the *periodic* path: an interval-driven loop calling
+/// `resume_stalled_index_builds` (exactly what `spawn_task_resume_index_builds`
+/// runs) must, on its own, adopt a stalled `CONCURRENTLY` build and drive it to
+/// `Online` — no manual `REBUILD`/`REMOVE`. This pins the behaviour in CI
+/// independently of a live server harness.
+#[tokio::test(flavor = "multi_thread")]
+async fn periodic_task_resumes_stalled_build() -> Result<()> {
+	let (ds, session) = new_index_test_ds().await?;
+	let ds = Arc::new(ds);
+	execute_all(
+		&ds,
+		&session,
+		"
+			DEFINE TABLE user SCHEMALESS;
+			CREATE user:one SET email = 'one@example.com' RETURN NONE;
+			CREATE user:two SET email = 'two@example.com' RETURN NONE;
+			DEFINE INDEX test ON user FIELDS email;
+			",
+	)
+	.await?;
+
+	let (ns, db, table, ix) = get_table_index(&ds, "user", "test").await?;
+	let ikb = IndexKeyBase::new(ns, db, table.clone(), ix.index_id);
+
+	// Strand a `Building` generation with an expired owner lease, as an
+	// ungraceful crash mid-build would leave it.
+	let expired = Utc::now() - chrono::Duration::seconds(BUILD_OWNER_LEASE_SECS + 5);
+	let tx = ds.transaction(TransactionType::Write, Optimistic).await?;
+	tx.set(
+		&ikb.new_bs_key(),
+		&IndexBuildState {
+			generation: 2,
+			phase: IndexBuildPhase::Building,
+			owner: Some(Uuid::new_v4()),
+			next_ticket: 0,
+			initial_complete: false,
+			updated_at: expired,
+			owner_heartbeat_at: Some(expired),
+			error: None,
+			report_status: Some(IndexBuildReportStatus::Indexing),
+			initial: Some(0),
+			updated: None,
+			pending: None,
+		},
+	)
+	.await?;
+	tx.commit().await?;
+
+	// Spawn the periodic resume loop, mirroring `spawn_task_resume_index_builds`:
+	// an interval timer that calls `resume_stalled_index_builds` until cancelled.
+	let canceller = tokio_util::sync::CancellationToken::new();
+	let task = {
+		let ds = Arc::clone(&ds);
+		let canceller = canceller.clone();
+		tokio::spawn(async move {
+			let tick = Duration::from_millis(200);
+			let mut interval = tokio::time::interval(tick);
+			loop {
+				tokio::select! {
+					biased;
+					_ = canceller.cancelled() => break,
+					_ = interval.tick() => 
```

**File**: `surrealdb/core/src/kvs/tasklease.rs` (modified, +2/-0)
```diff
@@ -26,6 +26,8 @@ pub(crate) enum TaskLeaseType {
 	ChangeFeedCleanup,
 	/// Index compaction
 	IndexCompaction,
+	/// Resuming index builds left unfinished by a crashed or expired owner node
+	IndexBuildResume,
 	/// Event processing
 	EventProcessing,
 	/// Background reclaim of tombstoned namespace/database/index data
```

**File**: `surrealdb/core/src/options.rs` (modified, +19/-0)
```diff
@@ -23,6 +23,19 @@ pub struct EngineOptions {
 	///
 	/// Default: 5 seconds
 	pub index_compaction_interval: Duration,
+	/// Interval for resuming index builds stranded by a crashed or expired
+	/// owner node.
+	///
+	/// A `CONCURRENTLY` index build runs as a detached task; if its owning node
+	/// dies mid-build, nothing waits on that generation again, so the durable
+	/// build state is stuck in `Building`/`Closing` and the index reports
+	/// `status: indexing` with a frozen counter indefinitely. This task
+	/// periodically adopts such builds (once their owner lease has expired) and
+	/// drives them to completion. Set to `Duration::ZERO` to disable and recover
+	/// stalled builds manually with `REBUILD INDEX`.
+	///
+	/// Default: 30 seconds
+	pub index_build_resume_interval: Duration,
 	/// Interval for processing queued async events.
 	///
 	/// Default: 5 seconds
@@ -102,6 +115,7 @@ impl Default for EngineOptions {
 			node_membership_cleanup_interval: Duration::from_secs(300),
 			changefeed_gc_interval: Duration::from_secs(30),
 			index_compaction_interval: Duration::from_secs(5),
+			index_build_resume_interval: Duration::from_secs(30),
 			event_processing_interval: Duration::from_secs(5),
 			live_query_router_interval: Duration::from_millis(100),
 			reclaim_interval: Duration::from_secs(60),
@@ -136,6 +150,11 @@ impl EngineOptions {
 		self
 	}
 
+	pub fn with_index_build_resume_interval(mut self, interval: Duration) -> Self {
+		self.index_build_resume_interval = interval;
+		self
+	}
+
 	pub fn with_event_processing_interval(mut self, interval: Duration) -> Self {
 		self.event_processing_interval = interval;
 		self
```

**File**: `surrealdb/server/src/cli/start.rs` (modified, +9/-0)
```diff
@@ -72,6 +72,13 @@ pub struct StartCommandArguments {
 	#[arg(env = "SURREAL_INDEX_COMPACTION_INTERVAL", long = "index-compaction-interval", value_parser = super::validator::duration)]
 	#[arg(default_value = "5s")]
 	index_compaction_interval: Duration,
+	#[arg(
+		help = "The interval at which to resume index builds left unfinished by a crashed node (0 to disable)",
+		help_heading = "Database"
+	)]
+	#[arg(env = "SURREAL_INDEX_BUILD_RESUME_INTERVAL", long = "index-build-resume-interval", value_parser = super::validator::duration)]
+	#[arg(default_value = "30s")]
+	index_build_resume_interval: Duration,
 	#[arg(env = "SURREAL_ASYNC_EVENT_PROCESSING_INTERVAL", long = "async-event-interval", value_parser = super::validator::duration)]
 	#[arg(default_value = "5s")]
 	event_processing_interval: Duration,
@@ -223,6 +230,7 @@ pub async fn init<
 		node_membership_cleanup_interval,
 		changefeed_gc_interval,
 		index_compaction_interval,
+		index_build_resume_interval,
 		event_processing_interval,
 		reclaim_interval,
 		reclaim_grace,
@@ -262,6 +270,7 @@ pub async fn init<
 		.with_node_membership_cleanup_interval(node_membership_cleanup_interval)
 		.with_changefeed_gc_interval(changefeed_gc_interval)
 		.with_index_compaction_interval(index_compaction_interval)
+		.with_index_build_resume_interval(index_build_resume_interval)
 		.with_event_processing_interval(event_processing_interval)
 		.with_reclaim_interval(reclaim_interval)
 		.with_reclaim_grace(reclaim_grace)
```

**File**: `surrealdb/src/engine/tasks.rs` (modified, +42/-2)
```diff
@@ -66,8 +66,9 @@ pub fn init(dbs: Arc<Datastore>, canceller: CancellationToken, opts: &EngineOpti
 	let task7 = spawn_task_tikv_gc(Arc::clone(&dbs), canceller.clone(), opts);
 	let task8 = spawn_task_tikv_lock_cleanup(Arc::clone(&dbs), canceller.clone(), opts);
 	let task9 = spawn_task_reclaim_tombstones(Arc::clone(&dbs), canceller.clone(), opts);
-	let task10 = spawn_task_live_query_router(dbs, canceller, opts);
-	Tasks(vec![task1, task2, task3, task4, task5, task6, task7, task8, task9, task10])
+	let task10 = spawn_task_resume_index_builds(Arc::clone(&dbs), canceller.clone(), opts);
+	let task11 = spawn_task_live_query_router(dbs, canceller, opts);
+	Tasks(vec![task1, task2, task3, task4, task5, task6, task7, task8, task9, task10, task11])
 }
 
 /// Spawns the per-node live-query router task.
@@ -285,6 +286,45 @@ fn spawn_task_index_compaction(
 	}))
 }
 
+/// Spawns the periodic task that resumes stalled index builds.
+///
+/// A `CONCURRENTLY` index build is a detached task, so if its owning node dies
+/// mid-build the durable build state is stranded in `Building`/`Closing` and the
+/// index reports `status: indexing` with a frozen counter forever. This task
+/// periodically adopts such builds (once the owner lease has expired) and drives
+/// them to completion. An interval of `Duration::ZERO` disables it so operators
+/// can recover stalled builds manually with `REBUILD INDEX`.
+fn spawn_task_resume_index_builds(
+	dbs: Arc<Datastore>,
+	canceller: CancellationToken,
+	opts: &EngineOptions,
+) -> Task {
+	let interval = opts.index_build_resume_interval;
+	Box::pin(spawn(async move {
+		if interval.is_zero() {
+			trace!("Index build resume task disabled (interval=0)");
+			return;
+		}
+		trace!("Resuming stalled index builds every {interval:?}");
+		let mut ticker = interval_ticker(interval).await;
+		loop {
+			tokio::select! {
+				biased;
+				_ = canceller.cancelled() => break,
+				Some(_) = ticker.next() => {
+					if let Err(e) = dbs.resume_stalled_index_builds(interval, canceller.clone()).await {
+						if canceller.is_cancelled() {
+							break;
+						}
+						error!("Error resuming stalled index builds: {e}");
+					}
+				}
+			}
+		}
+		trace!("Background task exited: Resuming stalled index builds");
+	}))
+}
+
 /// Spawns the periodic background reclaim of tombstoned data.
 ///
 /// `REMOVE NAMESPACE/DATABASE/INDEX` delete only the catalog definition and
```

---

### Incident Patch 14: `6bd166b4` (2026-06-29)
**Commit Message**: perf(language-tests): shrink rebuild benches to 10k to fix nightly timeout (#515)

**File**: `.github/workflows/nightly-bench.yml` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ jobs:
     name: Nightly benchmark
     runs-on: runner-arm-bench
     if: ${{ github.repository == 'surrealdb/surrealdb-private' }} # Don't run outside the private repo
-    timeout-minutes: 180
+    timeout-minutes: 240
     steps:
       - name: Checkout sources
         uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
```

**File**: `language-tests/tests/bench/changefeed/update_where.surql` (modified, +2/-2)
```diff
@@ -1,9 +1,9 @@
 /**
 [bench]
-reason = "UPDATE ... WHERE over 100k records with the changefeed off vs on vs INCLUDE ORIGINAL — measures changefeed write-amplification (and the pre-image/reverse-diff cost) on the update path"
+reason = "UPDATE ... WHERE over 10k records with the changefeed off vs on vs INCLUDE ORIGINAL — measures changefeed write-amplification (and the pre-image/reverse-diff cost) on the update path"
 run = true
 rebuild = true
-datasets = { off = "bench/util/records-100000.surql", on = "bench/util/records-100000-changefeed.surql", original = "bench/util/records-100000-changefeed-original.surql" }
+datasets = { off = "bench/util/records-10000.surql", on = "bench/util/records-10000-changefeed.surql", original = "bench/util/records-10000-changefeed-original.surql" }
 warmup = "2s"
 sample-size = 10
 measurement-time = "20s"
```

**File**: `language-tests/tests/bench/mutate/delete_where.surql` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 /**
 [env]
-imports = ["bench/util/records-100000.surql"]
+imports = ["bench/util/records-10000.surql"]
 
 [bench]
 reason = "Delete all records matching a predicate"
```

**File**: `language-tests/tests/bench/mutate/update_where.surql` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 /**
 [env]
-imports = ["bench/util/records-100000.surql"]
+imports = ["bench/util/records-10000.surql"]
 
 [bench]
 reason = "Update all records matching an indexed-less predicate"
```

**File**: `language-tests/tests/bench/mutate/upsert_where.surql` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 /**
 [env]
-imports = ["bench/util/records-100000.surql"]
+imports = ["bench/util/records-10000.surql"]
 
 [bench]
 reason = "Upsert all records matching a predicate"
```

**File**: `language-tests/tests/bench/permissions/update_scan.surql` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ auth = { namespace = "test", database = "test", access = "user", rid = "user:ben
 reason = "UPDATE half the table as a record user — measures per-record table UPDATE permission cost (row-level WHERE predicate vs. FULL)"
 run = true
 rebuild = true
-datasets = { full = "bench/util/records-100000-perms-full.surql", where = "bench/util/records-100000-perms-where.surql" }
+datasets = { full = "bench/util/records-10000-perms-full.surql", where = "bench/util/records-10000-perms-where.surql" }
 warmup = "2s"
 sample-size = 50
 measurement-time = "20s"
```

**File**: `language-tests/tests/bench/util/records-10000-changefeed-original.surql` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+/**
+# `records-10000` with a changefeed enabled in INCLUDE ORIGINAL mode (stores the
+# before-image / reverse diff on every update and delete). The heaviest arm of
+# the changefeed update matrix — isolates the cost of computing and storing the
+# pre-image on top of plain changefeed capture. `run = false`.
+
+[env]
+imports = ["./records-10000.surql"]
+
+[test]
+run = false
+
+[[test.results]]
+value = "'OK'"
+*/
+
+{
+	ALTER TABLE record CHANGEFEED 1h INCLUDE ORIGINAL;
+	RETURN 'OK';
+}
```

**File**: `language-tests/tests/bench/util/records-10000-changefeed.surql` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+/**
+# `records-10000` with a changefeed enabled on the `record` table. The `on` arm
+# of the changefeed update matrix — paired with the base `records-10000` (`off`)
+# and `records-10000-changefeed-original` (INCLUDE ORIGINAL). `run = false`.
+
+[env]
+imports = ["./records-10000.surql"]
+
+[test]
+run = false
+
+[[test.results]]
+value = "'OK'"
+*/
+
+{
+	ALTER TABLE record CHANGEFEED 1h;
+	RETURN 'OK';
+}
```

---

### Incident Patch 15: `46a2206e` (2026-06-28)
**Commit Message**: fix(core): make view tables read-only (#511)

**File**: `language-tests/tests/reproductions/7376_view_import_roundtrip.surql` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+/**
+[env]
+namespace = true
+database = true
+
+[test]
+reason = "A database export emits the stored rows of a materialised view as INSERT statements. Re-importing them (under OPTION IMPORT) must still be allowed even though manual writes to a view are otherwise rejected, so the export -> import round-trip keeps working. This guards the `opt.import` exemption in the read-only view check."
+issue = 7376
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "[]"
+
+[[test.results]]
+value = "[]"
+
+[[test.results]]
+value = "[{ id: adults:ada, name: 'Ada' }]"
+*/
+
+-- Replaying an export: OPTION IMPORT skips view maintenance, and the
+-- exported view rows are re-inserted directly.
+OPTION IMPORT;
+DEFINE TABLE person SCHEMALESS;
+DEFINE TABLE adults TYPE ANY AS SELECT name FROM person WHERE age >= 18;
+INSERT INTO person { id: person:ada, name: 'Ada', age: 36 };
+
+-- Under OPTION IMPORT this write to the view table is allowed.
+INSERT INTO adults { id: adults:ada, name: 'Ada' };
+
+-- The imported view row is present.
+SELECT * FROM adults;
```

**File**: `language-tests/tests/reproductions/7376_view_table_read_only.surql` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+/**
+[env]
+namespace = true
+database = true
+
+[test]
+reason = "View tables (DEFINE TABLE ... AS SELECT) are read-only. Their records are computed from the source query and maintained automatically, so manual CREATE / INSERT / UPSERT / UPDATE / DELETE / RELATE against the view must be rejected. Otherwise the view ends up holding a mix of computed and hand-inserted rows."
+issue = 7376
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "[{ age: 36, id: person:ada, name: 'Ada' }]"
+
+[[test.results]]
+value = "[{ age: 12, id: person:bob, name: 'Bob' }]"
+
+[[test.results]]
+value = "NONE"
+
+[[test.results]]
+value = "[{ id: adults:ada, name: 'Ada' }]"
+
+[[test.results]]
+error = "Cannot write to the `adults` table, as it is a view (defined with `AS SELECT`); view tables are read-only and their records are computed from the source query"
+
+[[test.results]]
+error = "Cannot write to the `adults` table, as it is a view (defined with `AS SELECT`); view tables are read-only and their records are computed from the source query"
+
+[[test.results]]
+error = "Cannot write to the `adults` table, as it is a view (defined with `AS SELECT`); view tables are read-only and their records are computed from the source query"
+
+[[test.results]]
+error = "Cannot write to the `adults` table, as it is a view (defined with `AS SELECT`); view tables are read-only and their records are computed from the source query"
+
+[[test.results]]
+error = "Cannot write to the `adults` table, as it is a view (defined with `AS SELECT`); view tables are read-only and their records are computed from the source query"
+
+[[test.results]]
+error = "Cannot write to the `adults` table, as it is a view (defined with `AS SELECT`); view tables are read-only and their records are computed from the source query"
+
+[[test.results]]
+value = "[{ id: adults:ada, name: 'Ada' }]"
+*/
+
+-- Source table with a couple of rows.
+DEFINE TABLE person SCHEMALESS;
+CREATE person:ada SET name = 'Ada', age = 36;
+CREATE person:bob SET name = 'Bob', age = 12;
+
+-- A view projecting only adults from the source table.
+DEFINE TABLE adults TYPE ANY AS SELECT name FROM person WHERE age >= 18;
+
+-- The view is computed from the source: only Ada qualifies.
+SELECT * FROM adults;
+
+-- Every manual write against the view table must be rejected.
+CREATE adults:manual SET name = 'Manual';
+INSERT INTO adults { id: adults:manual2, name: 'Manual2' };
+UPSERT adults:manual SET name = 'Manual';
+UPDATE adults SET name = 'changed';
+DELETE adults;
+RELATE person:ada->adults->person:bob;
+
+-- The view still contains only the computed row.
+SELECT * FROM adults;
```

**File**: `surrealdb/core/src/doc/check.rs` (modified, +36/-0)
```diff
@@ -128,6 +128,42 @@ impl Document {
 		Ok(())
 	}
 
+	/// Checks that the table for this document is not a view
+	/// (`DEFINE TABLE ... AS SELECT`). View tables are read-only:
+	/// their records are computed from the source query and are
+	/// maintained automatically, so manual CREATE / INSERT / UPSERT /
+	/// UPDATE / DELETE / RELATE statements are rejected.
+	///
+	/// Imports are exempt: a database export emits the stored rows of
+	/// a materialised view as `INSERT` statements, so replaying them
+	/// must be allowed. This mirrors the `opt.import` guard in
+	/// [`Self::process_table_views`], which likewise skips view
+	/// maintenance while importing.
+	///
+	/// Call this *after* the table-level permission check in each write
+	/// path (as the sibling [`Self::check_table_type_create`] is), so an
+	/// actor who lacks permission still gets the normal permission
+	/// outcome (e.g. a silent skip) rather than an error that would
+	/// disclose the table is a view.
+	#[inline]
+	pub(super) fn check_table_not_view(&self, opt: &Options) -> Result<()> {
+		// Allow writes to view tables while replaying an export
+		if opt.import {
+			return Ok(());
+		}
+		// Get the table for this document
+		let tb = self.doc_ctx.tb()?;
+		// Ensure the table is not a computed view
+		ensure!(
+			tb.view.is_none(),
+			Error::TableIsView {
+				table: tb.name.to_string(),
+			}
+		);
+		// Carry on
+		Ok(())
+	}
+
 	/// Quick `PERMISSIONS FOR create` preflight that only short-circuits
 	/// `Permission::None`. Used by the create-side of CREATE / UPSERT /
 	/// INSERT / RELATE to bail before computing the data clause when
```

**File**: `surrealdb/core/src/doc/create.rs` (modified, +2/-0)
```diff
@@ -16,6 +16,8 @@ impl Document {
 	) -> Result<Value, IgnoreError> {
 		// Ensure we can write to the table at all
 		self.check_permissions_quick_create(ctx, opt)?;
+		// Reject writes to read-only view tables (after the permission gate)
+		self.check_table_not_view(opt)?;
 		// Ensure any input data is computed
 		self.compute_input_data(stk, ctx, opt, stm).await?;
 		// Set the specified record content
```

**File**: `surrealdb/core/src/doc/delete.rs` (modified, +2/-0)
```diff
@@ -21,6 +21,8 @@ impl Document {
 		// Otherwise a `WHERE THROW ...` could exfiltrate field values
 		// before the permission check rejects the operation.
 		self.check_delete_permissions(stk, ctx, opt, &self.current).await?;
+		// Reject writes to read-only view tables (after the permission gate)
+		self.check_table_not_view(opt)?;
 		// Check if the WHERE condition is truthy
 		self.check_where_condition(stk, ctx, opt, stm.cond()).await?;
 		// Clean up any outgoing references this record holds
```

**File**: `surrealdb/core/src/doc/insert.rs` (modified, +4/-0)
```diff
@@ -111,6 +111,8 @@ impl Document {
 		self.check_table_type_insert()?;
 		// Ensure we can write to the table at all
 		self.check_permissions_quick_create(ctx, opt)?;
+		// Reject writes to read-only view tables (after the permission gate)
+		self.check_table_not_view(opt)?;
 		// Ensure any input data is computed
 		self.compute_input_data(stk, ctx, opt, stm).await?;
 		// Ensure all special fields are valid
@@ -159,6 +161,8 @@ impl Document {
 		// DUPLICATE KEY SET x = THROW ...` could exfiltrate field values
 		// field values before the permission check rejects the operation.
 		self.check_update_permissions(stk, ctx, opt, &self.current).await?;
+		// Reject writes to read-only view tables (after the permission gate)
+		self.check_table_not_view(opt)?;
 		// Ensure any input data is computed
 		self.compute_input_data(stk, ctx, opt, stm).await?;
 		// Ensure all special fields are valid
```

**File**: `surrealdb/core/src/doc/relate.rs` (modified, +4/-0)
```diff
@@ -33,6 +33,8 @@ impl Document {
 	) -> Result<Value, IgnoreError> {
 		// Ensure we can write to the table at all
 		self.check_permissions_quick_create(ctx, opt)?;
+		// Reject writes to read-only view tables (after the permission gate)
+		self.check_table_not_view(opt)?;
 		// Ensure any input data is computed
 		self.compute_input_data(stk, ctx, opt, stm).await?;
 		// Set the specified record content
@@ -95,6 +97,8 @@ impl Document {
 		// Otherwise a `SET x = THROW ...` could exfiltrate field values
 		// before the permission check rejects the operation.
 		self.check_update_permissions(stk, ctx, opt, &self.current).await?;
+		// Reject writes to read-only view tables (after the permission gate)
+		self.check_table_not_view(opt)?;
 		// Ensure any input data is computed
 		self.compute_input_data(stk, ctx, opt, stm).await?;
 		// Ensure all special fields are valid
```

**File**: `surrealdb/core/src/doc/update.rs` (modified, +2/-0)
```diff
@@ -21,6 +21,8 @@ impl Document {
 		// Otherwise a `WHERE THROW ...` / `SET x = THROW ...` could exfiltrate
 		// field values before the permission check rejects the operation.
 		self.check_update_permissions(stk, ctx, opt, &self.current).await?;
+		// Reject writes to read-only view tables (after the permission gate)
+		self.check_table_not_view(opt)?;
 		// Ensure any input data is computed
 		self.compute_input_data(stk, ctx, opt, stm).await?;
 		// Ensure all special fields are valid
```

#### Recent Merged Pull Requests:
- **PR #7521** (closed): Fix KILLED notifications being dropped by the WebSocket client. (@BarronKane)
- **PR #7520** (closed): Carry the owning session id on Killed notifications. (@BarronKane)
- **PR #7517** (closed): fix(tikv): fallback 0 gRPC message size configs to default 4MB (@Tyagiquamar)
- **PR #7515** (closed): perf(core): add Value::pick_cow for borrow-based field access (@Christian-Sidak)
- **PR #7506** (closed): fix: preserve sequence positions in exports (@atirna)
- **PR #7501** (closed): Relax diskann version constraint to allow v0.56.0 (@TLimoges33)
- **PR #7492** (closed): Allow ORDER BY fields not present in SELECT (@Christian-Sidak)
- **PR #7489** (2026-08-28): Commit Cargo.lock for the SDK build-test crates (@rushmorem)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
