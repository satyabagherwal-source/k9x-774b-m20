# Architecture Decision Record: ADR: Subsystem Boundary & Modular Decoupling in indexable-inc-blaze-learnings

<!-- PROVENANCE_START
{
  "source_repository": "indexable-inc-blaze-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T01:00:40.157Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-indexable-inc-blaze-learnings",
  "canonical_classification": "architecture_decision"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [indexable-inc-blaze-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T01:00:40.157Z`  
> **Learning ID**: `LEARN-EVO-indexable-inc-blaze-learnings`


## Status
**ACCEPTED** (Empirically verified from indexable-inc-blaze-learnings)

## Context
During deep inspection of indexable-inc-blaze-learnings, modular boundaries, performance characteristics, and concurrency constraints required explicit architectural trade-off analysis.

## Decision
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/indexable-inc-blaze-learnings.md`  
> **Source**: github ([https://github.com/indexable-inc/blaze](https://github.com/indexable-inc/blaze))  
> **Source Version**: `aa3ad7aa`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T01:00:29.426Z  
> **Learning ID**: `learn-github-indexable-inc-blaze`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): indexable-inc/blaze

> **Canonical Artifact**: `07_PROJECT_LEARNING/indexable-inc-blaze-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/indexable-inc/blaze](https://github.com/indexable-inc/blaze))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T01:00:29.219Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `indexable-inc/blaze`
- **Description**: Incremental rust builds up to 92x faster than cargo/rustc. Backed by Y Combinator (F26).
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 2997 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/blaze-blake3/src/engine.rs`
```
//! The one seam every strategy of the crate is chosen at (rule 78), chosen by the caller once and
//! passed in (rule 75): how a lone block is compressed ([`Single`]), how many chunks, parents or
//! short inputs go side by side ([`Degree`]), how a batch of two runs ([`Pair`]), and which
//! vector instructions the wide code may use
//! ([`Isa`], a proof that the CPU has them). Every [`Engine`] computes the same bytes, BLAKE3's;
//! `tests/engines.rs` holds each one to the official crate at every length to five chunks and
//! one byte, one shot and streamed in drawn pieces, in every mode.
//!
//! The entries that take no engine (`hash`, `Hasher::new`, `hash_many`, ...) run
//! [`Engine::detected`]: the defaults below on this CPU, unchanged from before the seam
//! existed. On aarch64 that is a constant; on x86-64 it reads [`crate::cpu`]'s process-wide
//! cache of CPUID, the one ambient read left in the crate (D170 moves it to blaze-sys, which
//! will make the value once and hand it in).

/// How one block is compressed where only one is ready: a chunk hashed alone, a chunk's last
/// block, a lone parent, the root, every input of at most a chunk hashed by itself.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Single {
    /// The sixteen state words in sixteen general registers, each half-round's four G
    /// functions side by side on the core's integer units (`crate::compress`). The default.
    Scalar,
    /// The state as four rows of four `u32` lanes (`core::simd::u32x4`): a round is the column
    /// step on whole rows, the diagonal turned into columns by rotating rows 1 to 3 by one, two
    /// and three lanes, the diagonal step, and the turn undone (`crate::rows`). What the
    /// official crate runs on SSE4.1 and AVX-512; on NEON it has no such form.
    Rows,
}

/// How many independent compressions run side by side: whole chunks of one input, parents of
/// one tree level, or short inputs of `hash_many`. A batch narrower than the degree runs at the
/// narrowest power of two that holds it (three chunks at four lanes, the fourth lane idle).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Degree {
    /// One at a time, by [`Single`]: no lanes.
    One,
    /// Two lanes: half a NEON or SSE register a word.
    Two,
    /// Four lanes: one NEON or SSE register a word.
    Four,
    /// Eight lanes: one AVX2 register a word, or two NEON registers interleaved.
    Eight,
    /// Sixteen lanes: one AVX-512 register a word, or four NEON registers.
    Sixteen,
}

impl Degree {
    /// Every degree, narrowest first: what the tests and the cost table run.
    pub const ALL: [Degree; 5] = [Degree::One, Degree::Two, Degree::Four, Degree::Eight, Degree::Sixteen];

    /// The lanes this degree runs.
    pub const fn lanes(self) -> usize {
        match self {
            Degree::One => 1,
            Degree::Two => 2,
            Degree::Four => 4,
            Degree::Eight => 8,
            Degree::Sixteen => 16,
        }
    }
}

/// How a batch exactly two wide runs, where the degree is two or more: two chunks of one input
/// (a 2 KiB input, or a subtree's last two), two parents of one level (the last level below a
/// root of four chunks). Wider batches always run in lanes.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Pair {
    /// Two `core::simd` lanes: half a NEON or SSE register a word. The default on x86-64
    /// ([`Isa::default_pair`]).
    Lanes,
    /// Two scalar compressions in general registers, step for step (`crate::pair`): eight
    /// independent chains a half-round on the integer units, one `ror` a rotation.
    Interleaved,
}

impl Pair {
    /// Both forms: what the tests and the cost table run.
    pub const ALL: [Pair; 2] = [Pair::Lanes, Pair::Interleaved];
}

/// The vector instructions the wide code may use, and the proof that this CPU has them: a value
/// other than [`Isa::BASELINE`] is made only by an `unsafe` constructor whose caller promised
/// the feature, or by [`Isa::detected`] after CPUID said so.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct Isa {
    pub(crate) kind: IsaKind,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub(crate) enum IsaKind {
    /// The target's baseline: NEON on aarch64, SSE2 on x86-64.
    Baseline,
    /// x86-64's AVX2: the lanes compiled inside `#[target_feature(enable = "avx2")]` functions.
    #[cfg(target_arch = "x86_64")]
    Avx2,
    /// x86-64's AVX-512F: the lanes compiled inside `#[target_feature(enable = "avx512f")]`.
    #[cfg(target_arch = "x86_64")]
    Avx512,
}

impl Isa {
    /// The target's baseline vectors, on every CPU of the target.
    pub const BASELINE: Isa = Isa { kind: IsaKind::Baseline };

    /// AVX2's 256-bit vectors.
    ///
    /// # Safety
    ///
    /// The CPU this value is used on has AVX2 and the OS saves its registers (for example,
    /// `is_x86_feature_detected!("avx2")` said so): every function given this value may run
    /// AVX2 instructions.
    #[cfg(target_arch = "x86_64")]
    #[allow(unsafe_code, reason = "a constructor whose contract is the CPU's AVX2")]
    pub const unsafe fn avx2_unchecked() -> Isa {
        Isa { kind: IsaKind::Avx2 }
    }

    /// AVX-512F's 512-bit vectors.
    ///
    /// # Safety
    ///
    /// The CPU this value is used on has AVX-512F and AVX2 and the OS saves their registers:
    /// every function given this value may run AVX-512F and AVX2 instructions.
    #[cfg(target_arch = "x86_64")]
    #[allow(unsafe_code, reason = "a constructor whose contract is the CPU's AVX-512F")]
    pub const unsafe fn avx512_unchecked() -> Isa {
        Isa { kind: IsaKind::Avx512 }
    }

    /// The widest this CPU has, by [`crate::cpu`]: AVX-512F, else AVX2, else the baseline. On
    /// aarch64 the baseline, a constant.
    pub fn detected() -> Isa {
        #[cfg(target_arch = "x86_64")]
        {
            use crate::cpu;
            // AVX-512F's CPUs all have AVX2 (every one Intel and AMD made), and the OS check of
            // `cpu` covers both register files.
            if cpu::has(cpu::Feature::Avx512f) && cpu::has(cpu::Feature::Avx2) {
                return Isa { kind: IsaKind::Avx512 };
            }
            if cpu::has(cpu::Feature::Avx2) {
                return Isa { kind: IsaKind::Avx2 };
            }
        }
        Isa::BASELINE
    }

    /// The instructions' name, for reports.
    pub const fn name(self) -> &'static str {
        match self.kind {
            IsaKind::Baseline => {
                if cfg!(target_arch = "aarch64") {
                    "neon"
                } else if cfg!(target_arch = "x86_64") {
                    "sse2"
                } else {
                    "baseline"
                }
            }
            #[cfg(target_arch = "x86_64")]
            IsaKind::Avx2 => "avx2",
            #[cfg(target_arch = "x86_64")]
            IsaKind::Avx512 => "avx512f",
        }
    }

    /// The degree the crate's entries run with these instructions: 16 lanes on AVX-512F, else
    /// 8 (one AVX2 register a word, two NEON or SSE2 ones). On the owner's M5 Max a block a lane
    /// took 25.1 ns at 4 lanes, 16.0 at 8 and 14.3 at 16 (blaze-int-1112-notes/nightly-probes/
    /// blake3_lanes.rs); `examples/cost.rs` prints MB/s by degree so the default per CPU is a
    /// measured choice, and it stays this until that table says otherwise.
    ///
    /// That table on the owner's M5 Max, 2026-11-20 22:13 (machine at load 14; notes
    /// rounds/wave-1119/t34/blake3-cost.txt), MB/s at 8 against 16 lanes on NEON: 3306 and 3314
    /// at 8 KiB, 3482 and 3755 at 64 KiB, 3470 and 3638 at 16 MiB, and equal below 8 KiB: so
    /// NEON runs 16. SSE2 has no such table yet and stays at 8.
    pub const fn default_degree(self) -> Degree {
        match self.kind {
            IsaKind::Baseline => {
                if cfg!(target_arch = "aarch64") {
                    Degree::Sixteen
                } else {
                    Degree::Eight
                }
            }
            #[cfg(target_arch = "x86_64")]
            IsaKind::Avx2 => Degree::Eight,
            #[cfg(target_arch = "x86_64")]
            IsaKind::Avx512 => Degree::Sixteen,
        }
    }

    /// How the crate's entries run a batch two wide with these instructions. The same table:
    /// a 2 KiB input (two chunks) ran at 1138 MB/s in two NEON lanes and 1602 interleaved in
    /// general registers (the official crate: 1329), with every other size within 2%: so NEON
    /// interleaves. The x86-64 forms have no such table yet and stay in lanes.
    pub const fn default_pair(self) -> Pair {
        match self.kind {
            IsaKind::Baseline => {
                if cfg!(target_arch = "aarch64") {
                    Pair::Interleaved
                } else {
                    Pair::Lanes
                }
            }
            #[cfg(target_arch = "x86_64")]
            IsaKind::Avx2 | IsaKind::Avx512 => Pair::Lanes,
        }
    }
}

/// What an [`Engine`] is made of: every choice named, none defaulted (rule 83).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct EngineOpts {
    pub single: Single,
    pub degree: Degree,
    pub pair: Pair,
    pub isa: Isa,
}

/// The strategies a hash runs by: made once by the caller, passed to every `*_on` entry and
/// kept by a [`crate::Hasher`] for its life.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Engine {
    pub(crate) single: Single,
    pub(crate) degree: Degree,
    pub(crate) pair: Pair,
    pub(crate) isa: Isa,
}

impl Engine {
    /// One block at a time, by the scalar compression, on every target: the twin every other
    /// engine is tested against.
    pub const SCALAR: Engine =
        Engine { single: Single::Scalar, degree: Degree::One, pair: Pair::Lanes, isa: Isa::BASELINE };

    pub const fn new(opts: EngineOpts) -> Engine {
        Engine { single: opts.single, degree: opts.degree, pair: opts.pair, 
```

### Core Architecture Module: `crates/blaze-c/src/render.rs`
```
//! A declaration record to Rust text: the form the expansion pipeline takes (it lexes the text,
//! `blaze_expand::tokens::lex`), deterministic (the record's order, nothing else), with every
//! declaration it leaves out, or renders only in part, as a [`Finding`].
//!
//! The choices, and why:
//! - `pub mod NAME { .. }` with the lints of C's naming allowed inside it: C names are kept as
//!   written, so a reader searches the header and the Rust for one name.
//! - Functions and data in `unsafe extern "ABI" { .. }` blocks, one a calling convention, each
//!   item `pub unsafe fn` / `pub unsafe static`: a call into C is unsafe, and the block says so.
//!   `#[link_name]` where the symbol is not the name; `"\u{1}"` before a literal symbol (an asm
//!   label), which no platform prefix is added to. `#[link(name = ..)]` from `link`.
//! - Every C scalar by its `::core::ffi` name (`c_long`, not `i64`), and every Rust primitive by
//!   `::core::primitive` (a header's `typedef int bool;` would otherwise shadow `bool`); a
//!   static assert per scalar kind that `core`'s size is the record's, so a record for one target
//!   cannot compile silently for another.
//! - A struct or union as `#[repr(C)]` (with `packed(N)` or `align(N)` where the front end's
//!   layout needs them), its fields at the front end's offsets (explicit `__pad_N` bytes where
//!   `repr(C)` alone would place a field earlier), and a static assert of its size, its alignment
//!   and each field's offset. A layout `repr(C)` cannot reproduce is the record's bytes,
//!   `__bytes: [u8; SIZE]` at its alignment, and a finding.
//! - A bitfield as its storage unit (`__bitfield_N`, the unsigned integer of the unit's size)
//!   and two accessors (`x()`, `set_x()`), with the target's bit order.
//! - An enum as `#[repr(transparent)] pub struct E(pub UNDERLYING)` with an associated const a
//!   constant: C's enums are integers (any value is a valid `E`), which a Rust `enum` is not.
//!   An anonymous enum's constants are module constants of its underlying type.
//! - An opaque (declared, never defined) struct as a zero-sized struct with a private field
//!   and a `PhantomData<(*mut u8, PhantomPinned)>`: it cannot be built, moved out of a pointer,
//!   sent or shared, only pointed at.
//! - A pointer to a function as `Option<unsafe extern "ABI" fn(..) -> R>`: C's function
//!   pointers are nullable, and `Option` of a fn pointer is a pointer.
//! - A keyword as a raw identifier (`r#type`); a name not even a raw identifier can spell is a
//!   finding ([`Unexpressed::ReservedName`]): a declaration is dropped, a field renamed
//!   `__field_N` and a parameter written `_`.
//! - C++ parts of the record (namespaces, overloads, methods, bases, a relocation fact other
//!   than trivially copyable, references, may-throw) are not rendered yet: each a finding of
//!   its own cause (`Cpp*`), never a silent skip.
//! - What the import's own unit holds ([`UnitKey`]) in `unsafe extern` blocks of their own, with
//!   no `#[link]` (the unit is the import's, not the library's), each item bound to the unit's
//!   symbol for it by `#[link_name]`: a function the headers define with internal or inline
//!   linkage as a normal `pub unsafe fn` (its thunk); a header-local variable as
//!   `pub safe fn NAME() -> *mut T`, its address (no `static mut`: the variable's one
//!   instance is the unit's, and a raw pointer is the one honest handle on data that C code
//!   writes behind Rust's back); a `macro_fn` as a `pub unsafe fn` (its wrapper).
//! - A macro naming a variable's address (`#define Py_None (&_Py_NoneStruct)`) as a safe
//!   `pub fn NAME() -> *mut T`: a raw pointer to a static is safe to make, and a function, not
//!   a `const`, because a static's address is not a constant on every target (an extern
//!   static's is a relocation, and Rust refuses a `const` that reads one).
//! - A macro naming a table's slot (`#define PyArray_Type (*(PyTypeObject *)PyArray_API[2])`)
//!   as a `pub unsafe fn` that loads the table, checks it is not null (naming the table) and
//!   returns the entry as the macro's pointer type; a function slot as a `pub unsafe fn` of the
//!   function's own parameters that calls the entry, so C's `PyArray_GetNDArrayCVersion()` is
//!   Rust's too. Unsafe, never safe: the table is null until the library's import call has
//!   filled it (numpy's `import_array()`), and only the header vouches for the entry's type.
//!   Its doc says so under `# Safety`.

use blaze_hash::{FixedState, Map, MapOpts};
use blaze_own::{AString, AVec, Alloc, String, Vec, format_into};

use crate::finding::Finding;
use crate::grammar::{MacroType, Request};
use crate::key::UnitKey;
use crate::model::{
    Conv, DeclKind, FloatKind, FnAttrs, FnRow, IntKind, Linkage, MOST_DEPTH, MacroRow, MethodKind, Quals,
    RecordKind, Relocation, TypeRow, Unexpressed, VarAttrs, VarRow, join, tag, value,
};
use crate::view::{DeclsView, ViewError};
use crate::{NONE, at, narrow};

/// Why a record cannot be rendered at all (a declaration that cannot is a finding instead).
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum RenderError {
    View(ViewError),
    /// More declarations than a row index holds.
    TooLarge,
    /// A declaration that rendered when its dependencies settled failed on the final pass: a
    /// bug of this module, named by its table and row.
    Unsettled { kind: DeclKind, row: u32, cause: Unexpressed },
    /// A `macro_fn` of the request that cannot be what it asks for, by its index in the
    /// request's (sorted) `macro_fns`: the program asked for it by name, so it is refused, not
    /// left out as a finding.
    MacroFn { index: u32, fault: MacroFnFault },
}

/// Why a `macro_fn` is refused.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MacroFnFault {
    /// The headers have no function-like macro of the name.
    NoSuchMacro,
    /// The macro is one no function has the meaning of ([`Unexpressed::MacroIsFragment`],
    /// [`Unexpressed::MacroPastesOrAssigns`]), by the front end's cause.
    NotAFunction(Unexpressed),
    /// The headers declare a function of the name: it is the macro's meaning, and it renders.
    IsAFunction,
    /// The named type is not a `core::ffi` scalar or a type the module renders (by value, one
    /// whose layout is exact): `part` is the parameter's index, [`NONE`] for the result.
    UnknownType { part: u32 },
    /// The rendering has no unit to ask for the wrapper in (see [`UnitKey`]).
    NoUnit,
    /// Another rendered declaration has the name.
    NameClash,
}

/// A rendered module and its findings.
pub struct Rendered<'a> {
    pub rust: AString<'a>,
    pub findings: AVec<'a, Finding>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Status {
    Keep,
    Drop(Unexpressed),
}

/// A rendering failure inside a declaration: the cause, and the part (field or parameter)
/// it is at, [`NONE`] for the whole.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
struct Fail {
    cause: Unexpressed,
    part: u32,
}

fn fail(cause: Unexpressed) -> Fail {
    Fail { cause, part: NONE }
}

const STRICT: &[&str] = &[
    "as", "break", "const", "continue", "else", "enum", "extern", "false", "fn", "for", "if", "impl", "in", "let",
    "loop", "match", "mod", "move", "mut", "pub", "ref", "return", "static", "struct", "trait", "true", "type",
    "unsafe", "use", "where", "while", "async", "await", "dyn", "abstract", "become", "box", "do", "final", "macro",
    "override", "priv", "typeof", "unsized", "virtual", "yield", "try", "gen",
];

const UNSPELLABLE: &[&str] = &["self", "Self", "super", "crate", "_"];

/// `name` as a Rust identifier into `out`: raw for a keyword, refused for a name no identifier
/// spells.
fn ident(out: &mut AString<'_>, name: &str) -> Result<(), Fail> {
    if UNSPELLABLE.contains(&name) {
        return Err(fail(Unexpressed::ReservedName));
    }
    if STRICT.contains(&name) {
        out.push_str("r#");
    }
    out.push_str(name);
    Ok(())
}

fn round_up(n: u64, align: u64) -> u64 {
    match align {
        0 | 1 => n,
        a => n.div_ceil(a) * a,
    }
}

/// The unsigned primitive of a storage unit's size.
fn unsigned_of(size: u32) -> Option<(&'static str, &'static str, u32)> {
    match size {
        1 => Some(("u8", "i8", 8)),
        2 => Some(("u16", "i16", 16)),
        4 => Some(("u32", "i32", 32)),
        8 => Some(("u64", "i64", 64)),
        16 => Some(("u128", "i128", 128)),
        _ => None,
    }
}

fn c_int_name(kind: IntKind) -> &'static str {
    match kind {
        IntKind::Char => "::core::ffi::c_char",
        IntKind::SChar => "::core::ffi::c_schar",
        IntKind::UChar => "::core::ffi::c_uchar",
        IntKind::Short => "::core::ffi::c_short",
        IntKind::UShort => "::core::ffi::c_ushort",
        IntKind::Int => "::core::ffi::c_int",
        IntKind::UInt => "::core::ffi::c_uint",
        IntKind::Long => "::core::ffi::c_long",
        IntKind::ULong => "::core::ffi::c_ulong",
        IntKind::LongLong => "::core::ffi::c_longlong",
        IntKind::ULongLong => "::core::ffi::c_ulonglong",
        IntKind::Int128 => "::core::primitive::i128",
        IntKind::UInt128 => "::core::primitive::u128",
    }
}

fn abi_name(conv: Conv) -> Result<&'static str, Fail> {
    match conv {
        Conv::C => Ok("C"),
        Conv::Win64 => Ok("win64"),
        Conv::SysV64 => Ok("sysv64"),
        Conv::Stdcall => Ok("stdcall"),
        Conv::Fastcall => Ok("fastcall"),
        Conv::Thiscall => Ok("thiscall"),
        Conv::Aapcs => Ok("aapcs"),
        Conv::Vectorcall => Err(fail(Unexpressed::UnstableConvention)),
    }
}

/// How a record is written.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Form {
    /// Declared, never defined.
    Opaque,
    /// Its fields, as the front end laid them out; `exact` when no byte was added that the C
    /// type does not have (so passing it by value is classified as C classifies it).
    Fields { exact: bool },
   
```

### Core Architecture Module: `crates/blaze-cas/src/plain/core.rs`
```
//! The plain store's state machine ([`super`] has the layout and the costs): opening (the
//! head and the manifest; a segment mapped at its first probe, an unsealed segment of another
//! boot checked whole at its first hit: `probe.rs`),
//! reads in place with no lock and no shared write, puts into per-worker [`Batch`]es, the
//! commit (one segment written without a lock, then the flip under the one lock), and
//! compaction: pruning and sweeping in bounded slices, and the size-tiered merge whose one
//! invariant ([`Tiers`]: no tier over `K` segments after a cleanup, so a namespace of `S` bytes
//! names at most [`segments_most`]`(S)`) the simulation checks after every cleanup. Beside it
//! the merge's ONE bound on memory, [`merge_holds_most`]`(k)`: whatever the tier and however
//! many records, a compaction's copy holds at most [`MERGE_BUFFER`] (8 MiB) of records in
//! flight, ONE [`INDEX_CHUNK`] (1 MiB) of its index, and [`CURSOR_BYTES`] for each of its `k`
//! inputs (a cursor over the input's mapped sorted run, and its place in the merge's heap),
//! `k` the slice's rows: at most [`MERGE_INPUTS_MOST`] (26) for a namespace that kept the
//! tier invariant, so 9 MiB and under 1.2 KiB. No merge's output passes the segment cap
//! ([`Tiers`], THE CAP), and no manifest names a row its open would refuse (`format::Row`). Nothing of it grows with the records: the copy is a
//! k-way merge of the inputs' runs, its records found in key order one at a time, its payloads
//! and then its index streamed into a temporary file, renamed to its digest's name before the
//! sync and the flip (`Plain::stream_segment`). The simulated driver checks the records and
//! the index in flight on every compaction's writes, and the core what it built at once.
//! Three walks of the merge (count, payloads, index) because the digest hashes the header
//! first; one walk needs format 3 (`H(payloads) ‖ H(run) ‖ header ‖ footer head`): decided
//! 2026-11-20 to take it with the per-worker writer (D159), so one format bump, not two. It
//! owns no IO: it hands back [`Effect`]s and takes their
//! [`Completion`]s, so the simulation runs this very code (`super::tests`), and
//! [`super::Driven`] carries the effects out on a real driver.

#![blaze::sans_io]
#![deny(blaze::sans_io_core)]

// The process heap only where bytes cross into blaze-core's effects, which own process-heap
// vectors (`Effect::Append { bytes: Vec<u8> }`): a batch's payloads, a segment's pieces, a
// manifest's encoding. Everything else the store keeps is in the caller's `A` (rule 75).
use std::alloc::Allocator;
use std::{
    alloc::Global,
    collections::{BTreeMap, BTreeSet},
    time::Duration,
};

use blaze_core::{Completion, Done, Effect, Extent, FileName, LockMode, Tag as EffectTag};
/// Effect queue passed into `Plain` state transitions.
pub(super) type EffectList = Vec<Effect>;
type EffectBuf<E> = Vec<Effect, E>;
type LaidVec<A> = Vec<Laid<A>, A>;
type PieceVec<A> = Vec<(u64, Vec<u8>), A>;
type ReusedVec<A> = Vec<(u64, ContentId), A>;
type EntryVec<'a, A> = Vec<Entry, &'a A>;
use blaze_hash::{BuildKeyHasher, Map, MapOpts, hash_map::Entry as HashEntry};
use blaze_ids::{ContentId, crc32c};
use blaze_mem::Kept;
use blaze_own::Share;
use blaze_keyed::{
    kind::{Namespace, ReservedTag, Tag, TagReach, reach_of},
    store::{ALIGN, ENTRY, FOOTER, HEADER, Holder, Put, RowRefused, SEGMENT_MOST, SegmentId, StoreError, StoreFile, TwoValues},
};

use super::bloom::{BLOOM_ALLOC, BloomBuilder, BloomIndex, BloomMapped, BloomRef, ROOT_BITS_PER_KEY, root_bloom_digest};
use super::format::{
    self, Entry, FORMAT, HEAD_LEN, HeadRead, Lease, LostKind, LostMark, Manifest, NEVER, OFFSET_MOST, Retired,
    Root, SLOT_AT, Segment, Slot, aligned, record_crc,
};
use super::par::{Par, Serial};
use super::verified::{Boot, Checks, Unverified, Verified};
use super::lent::two_values;
use crate::{Corrupt, Key};

/// The lazy open's reads: [`Plain::find`], [`Plain::map_all`], the probe order.
mod probe;
pub use probe::{Found, Probe, Probes};

/// Minimum unique candidate entries in one commit namespace before parallelizing `TwoValues`
/// verification probes against prior committed segments via [`Par::for_each_mut_chunks`].
const PAR_TWO_VALUES_MIN_KEYS: usize = 32;

/// Bits per key for segment Bloom filters (matches `bloom::BITS_PER_KEY`).
const SEGMENT_BLOOM_BITS_PER_KEY: u64 = 12;

/// Minimum keys in a Bloom filter before using parallel [`BloomBuilder::build_par_from`].
const PAR_BLOOM_MIN_KEYS: usize = 4096;

/// Outcome of checking one unique candidate commit entry against prior committed segments.
#[derive(Clone, Copy)]
enum CommittedCheck {
    /// Not yet committed (or a replaceable pointer); lay out into the new segment.
    Keep,
    /// Already committed with identical tag, length, and CRC; omit from the new segment.
    SkipSame,
    /// Clashes with a committed record at `(map_idx, kept_entry)`.
    Conflict(usize, Entry),
}

/// Builds a framed segment Bloom filter from a sorted `ENTRY`-byte `run`, using
/// [`BloomBuilder::build_par_from`] when large and `par.workers() > 1`.
fn bloom_from_run_par<P: Par, B: Allocator + Copy>(
    run: &[u8],
    digest: &ContentId,
    par: &P,
    alloc: B,
) -> blaze_own::Vec<u8, Kept> {
    let count = run.len() / ENTRY;
    if par.workers() <= 1 || count < PAR_BLOOM_MIN_KEYS {
        return BloomBuilder::from_run(run, digest);
    }
    BloomBuilder::build_par_from(
        count,
        |i| {
            let at = i.saturating_mul(ENTRY);
            run.get(at..at.saturating_add(32))
                .and_then(|slice| <[u8; 32]>::try_from(slice).ok())
                .unwrap_or([0u8; 32])
        },
        SEGMENT_BLOOM_BITS_PER_KEY,
        digest,
        par,
        alloc,
    )
}

// The store's own tags are blaze-keyed's reservations ([`ReservedTag`], the one registry):
// - a root's record ([`ReservedTag::Root`]): a root's sorted keys, always under
//   [`Namespace::LOCAL`];
// - a POINTER ([`ReservedTag::Pointer`]): a record whose key is a name and whose payload is the
//   32-byte key of another record, its target ([`super::Lent::point`]). The one record a newer
//   commit may REPLACE: two values under one name are the old and the new, never refused, and
//   the value in the newest row of the manifest holding the name is the pointer's
//   ([`Plain::find_newest`]). Every other tag keeps the two-values refusal (rule 21). A pointer
//   lives in [`Namespace::LOCAL`] only; compaction keeps only its newest value;
// - an INDEX ([`ReservedTag::Index`], [`Plain::index`]): sorted 32-byte keys under
//   [`Namespace::LOCAL`], keyed by its bytes. It keeps nothing by itself; reached through an
//   indexed root, it and every key it holds are live. One level: an index naming an index
//   keeps the inner index's record, not what that holds;
// - an indexed root's record ([`ReservedTag::IndexedRoot`], [`Plain::root_through`]): sorted
//   keys, each an index. A slice reads a root's record anyway; what its tag is to reach
//   ([`reach_of`]) says whether to follow it, and a record followed must be an index by tag.

/// A pointer's payload: its target's key.
pub const POINTER_LEN: usize = 32;

/// The most keys one index holds (128 MiB of keys): a program reaching more is refused by
/// name ([`StoreError::IndexOver`]), never cut.
pub const INDEX_KEYS_MOST: usize = 1 << 22;

/// The most indexes one indexed root names.
pub const ROOT_INDEXES_MOST: usize = 1 << 16;

/// The most records one plain root names directly (as many as an indexed root names indexes):
/// each is looked for when the root is set (super::driven `Driven::root_names_held`, D200), so
/// a set past it goes through an index ([`Plain::root_through`]). Over it is refused by name
/// ([`StoreError::IndexOver`]), never cut.
pub const ROOT_KEYS_MOST: usize = ROOT_INDEXES_MOST;

/// The tags a store asks with: `tags .. tags + TAGS`.
pub const TAGS: u64 = 1 << 40;

/// A file no generation names is unlinked this long after it left the last manifest that
/// named it (or was found named by none): the bound on how long a process may take from
/// reading the head to mapping what it names, and on a commit from starting its segment to
/// its flip (half of it: [`Plain::commit`]). Mappings outlive an unlink, so a process that
/// mapped a file keeps reading it whatever happens after.
pub const GRACE_NS: u64 = 60 * 1_000_000_000;

/// Records no root names are kept for this many generations after the one that put them
/// ([`Liveness::Everything`]; a [`Liveness::Reached`] store keeps what a lease keeps instead).
pub const WINDOW: u64 = 16;

/// How long a checkout's root keeps what it names after it was last set
/// ([`Plain::root_for`]): a checkout not built for this long lets go of its records, and the
/// slices after reclaim them.
pub const ROOT_LIFE_NS: u64 = 14 * DAY_NS;

/// A root set again with the same key is written again (one flip) only when less than its
/// life less this is left: a checkout built a hundred times a day touches its root once.
pub const TOUCH_NS: u64 = DAY_NS;

const DAY_NS: u64 = 24 * 60 * 60 * 1_000_000_000;

/// Default maximum byte budget for a developer's global store (12 GiB).
pub const DEFAULT_MAX_STORE_BYTES: u64 = 12 << 30;

/// Minimum segment file length (64 MiB) above which under-budget compaction sweeps once >25%
/// dead (`live * 4 < file_len * 3`), so multi-GiB segments with hundreds of MiB of dead records
/// compact instead of waiting for >50% dead.
const LARGE_SEGMENT_SWEEP_MIN_BYTES: u64 = 64 << 20;

/// Under-budget dead-segment sweep threshold: large segments (`>= 64 MiB`) sweep once >25% dead
/// (`live * 4 < file_len * 3`), while smaller segments sweep once >50% dead (`live * 2 < file_len`).
#[inline]
fn should_sweep_under_budget(live_bytes: u64, file_len: u64) -> bool {
    if file_len >= LARGE_SEGMENT_SWEEP_MIN_BYTES {
        live_bytes.saturating_mul(4) < file_len.saturating_mul(3)
    } else {
        live_bytes.sat
```

### Core Architecture Module: `crates/blaze-cas/src/plain/core/probe.rs`
```
//! The lazy open's reads (drive.md, "The store under the command", point 7; D114 piece 3, with
//! the coordinator's three answers of 2026-11-16).
//!
//! The open reads the head and its manifest and maps NO segment. A segment is mapped at the
//! first probe that reaches it ([`Plain::find`]): one `Effect::Map` for that one row, its proof
//! made as the eager open made it (this boot's row, or a sealed row: no byte read), except an
//! unsealed segment of an earlier boot (the crash tail). That one is mapped and its length
//! compared with its row, then PARKED: its index is searched before the proof, only to decide
//! whether the one full check (`Verified::check`) is due, and the check runs whole at its FIRST
//! HIT, once a boot (recorded for the boot by the next flip, as the open's check was). A miss
//! in a parked run is a miss: its records count as lost until checked, and a key that matches
//! out of torn bytes is a 2^-256 event, never served unchecked.
//!
//! WHO CALLS WHAT. The main thread's gets go through [`Plain::find`] (in the command:
//! `Driven::get`): the nothing-changed command maps the one or two segments its certificate and
//! leaf table lie in, and no more. Pool tasks read through the lock-free handle (handle.rs),
//! which cannot map, so [`Plain::map_all`] is asked once, when the request's first pool task
//! is about to start (the certificate missed): every row mapped, every parked row checked
//! (a pool miss would recompute what the segment holds, which costs more than hashing it).
//! From then on the store is WHOLE (`eager`): every later generation is mapped as the eager open
//! mapped it, and the `&self` reads ([`Plain::get`], [`Plain::locate`]) answer for every row.
//! A commit, a compaction slice and a scrub need a whole store; `Driven` asks [`Plain::map_all`]
//! before each.
//!
//! PROBE ORDER (answer Q1): one order, largest segment (by records) first, ties newest first.
//! A root is a NAME in the newest manifest, never a segment probe, and records are keyed by
//! content (two values under one key are refused), so the order cannot change an answer, only
//! how many probes a get makes. Computed once a generation ([`Plain::order_view`]).
//!
//! THE GRACE. A file retired by another process's compaction is unlinked [`GRACE_NS`] after
//! its retirement, and a generation read at the open names rows retired after it; a mapping
//! outlives an unlink, a map asked after it does not. So a map is asked within [`GRACE_NS`] of
//! the open or refused by name ([`StoreError::Lost`]): never a lost row taken for a power cut's.
//! A short command cannot reach it. A long-lived holder (the `blaze run` parent, any helper)
//! calls [`Plain::map_all`] once its child has started, off the path to `main`, and re-opens
//! the head whenever it needs a record committed after its own open.

#![blaze::sans_io]
#![deny(blaze::sans_io_core)]

use std::alloc::Allocator;

use blaze_core::Effect;
use blaze_own::Share;
use blaze_keyed::{
    kind::{Namespace, ReservedTag, Tag},
    store::StoreError,
};

use super::super::format::{Entry, LostKind};
use super::super::par::{Par, Serial};
use super::super::verified::{Unverified, Verified};
use super::{GRACE_NS, Got, Phase, Placed, Plain, Plant, Then};
use crate::Key;

/// Why a map asked late is refused ([`StoreError::Lost`]'s words).
const LATE_MAP: &str = "named by the generation this process opened, and its first probe came more than the grace period after the open: another process's compaction may have unlinked it since; a command maps every segment (Driven::map_all) before its first pool task";

/// What one call of [`Plain::find`] came to.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Probe {
    /// Found: its bytes are [`Plain::got`]'s.
    Hit(Found),
    /// No namespace asked holds the key: every row of theirs was probed (mapped, or parked and
    /// missed) and nothing held uncommitted answers.
    Absent,
    /// The next row in probe order is not mapped: one `Effect::Map` was pushed for it alone.
    /// Run the effects, hand the completion to [`Plain::complete`], and ask again.
    Map,
}

/// A record found by [`Plain::find`]: read it with [`Plain::got`]. A mapped segment's place is
/// valid for the life of the store (maps are never removed); a record held uncommitted is found
/// again by its key, held or (after a commit) in the segment the commit wrote.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Found {
    key: Key,
    tag: Tag,
    namespace: Namespace,
    at: At,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum At {
    Held,
    Mapped { map: usize, entry: Entry },
}

impl Found {
    pub fn key(&self) -> Key {
        self.key
    }

    pub fn tag(&self) -> Tag {
        self.tag
    }

    pub fn namespace(&self) -> Namespace {
        self.namespace
    }
}

/// What the gets of one process probed, for `--stats` ("probes per get: mean, most").
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct Probes {
    /// Gets asked through [`Plain::find`] to an answer ([`Plain::count_get`]).
    pub gets: u64,
    /// Runs probed by them, mapped or parked.
    pub probes: u64,
    /// The most runs one get probed.
    pub most: u32,
}

impl<A: Allocator + Clone> Plain<A> {
    /// The open, for a process that reads through the lock-free handle from its start (the
    /// handle's own open, a push of whole segments, the eager DST): every segment the
    /// generation names mapped at the open, an earlier boot's unsealed segment checked there,
    /// and every later generation mapped whole. The command's open is [`Plain::open`] (lazy).
    pub fn open_whole(&mut self, effects: &mut Vec<Effect>) {
        self.eager = true;
        self.open(effects);
    }

    /// Whether every row is mapped (and every parked row checked) from now on: after
    /// [`Plain::map_all`] or [`Plain::open_whole`].
    pub fn whole(&self) -> bool {
        self.eager
    }

    /// `(segments mapped, segments named)` of this generation's local rows, for `--stats`
    /// ("segments mapped N of M named"). A parked row counts as mapped; a lost one as neither.
    pub fn mapped_of_named(&self) -> (u32, u32) {
        let mut mapped = 0u32;
        let mut named = 0u32;
        for seg in self.manifest.segments.iter().filter(|it| it.local && !self.dropped.contains(&it.id)) {
            named += 1;
            if self.by_id.contains_key(&seg.id) || self.unchecked.contains_key(&seg.id) {
                mapped += 1;
            }
        }
        (mapped, named)
    }

    /// What this process's gets probed.
    pub fn probes(&self) -> Probes {
        self.probes
    }

    /// One get ended (an answer, hit or absent): `before` is [`Probes::probes`] as it began.
    pub fn count_get(&mut self, before: u64) {
        let this = self.probes.probes.saturating_sub(before);
        self.probes.gets += 1;
        self.probes.most = self.probes.most.max(u32::try_from(this).unwrap_or(u32::MAX));
    }

    /// The probe order of this generation: its local rows not lost, largest (records) first,
    /// ties newest (a later row) first. Called whenever a generation is adopted.
    pub(super) fn order_view(&mut self) {
        let segs = &self.manifest.segments;
        let dropped = &self.dropped;
        self.view.clear();
        self.view.extend((0..segs.len()).filter(|&row| segs[row].local && !dropped.contains(&segs[row].id)));
        self.view.sort_unstable_by(|&a, &b| segs[b].count.cmp(&segs[a].count).then(b.cmp(&a)));
        self.last_hit = None;
    }

    /// The mapped segment of `row`, when it is mapped, proved and not lost.
    pub(crate) fn mapped_row(&self, row: usize) -> Option<usize> {
        let seg = &self.manifest.segments[row];
        if self.dropped.contains(&seg.id) {
            return None;
        }
        self.by_id.get(&seg.id).copied()
    }

    /// [`Plain::find`] in [`super::PlainConfig::reads`], in their order.
    pub fn find_read(&mut self, key: &Key, now_ns: u64, effects: &mut Vec<Effect>) -> Result<Probe, StoreError> {
        // Moved out and back (no allocation): `find` takes `&mut self` and the namespaces.
        // An empty vector in the store's allocator holds no block (`new_in` does not allocate).
        let reads = std::mem::replace(&mut self.cfg.reads, Vec::new_in(self.alloc.clone()));
        let out = self.find(&reads, key, now_ns, effects);
        self.cfg.reads = reads;
        out
    }

    /// The record under `key` in `spaces` (asked in their order: in each, what this process
    /// holds uncommitted, then already-mapped rows, then an optional creation-generation hint,
    /// then remaining unmapped rows in probe order with verified Bloom filtering), mapping at
    /// most ONE segment a call: see the module's docs. The store must be ready (not mid-commit).
    pub fn find(&mut self, spaces: &[Namespace], key: &Key, now_ns: u64, effects: &mut Vec<Effect>) -> Result<Probe, StoreError> {
        if let Some(why) = &self.broken {
            return Err(why.clone());
        }
        if !self.ready() {
            return Err(StoreError::Busy { phase: self.what() });
        }
        let hint_gen = self.hint_gen;
        let every = self.plant() == Plant::IgnoresNamespace;
        for space in spaces {
            if let Some((_, entry)) = self.held_in(*space, key) {
                return Ok(Probe::Hit(Found { key: *key, tag: entry.tag, namespace: *space, at: At::Held }));
            }
            // Pass 1: probe already-mapped segments first (zero syscalls / zero mmaps), starting
            // with the most recently hit segment for intra-commit locality (root -> pointer -> lines).
            let mut tried_last: Option<usize> = None;
            if let Some(last_row) = self.last_hit
                && let Some(seg) = self.manifest.segments.get(last_row).copied()
                && seg.local
                && (every || seg.namespace == *space)
                && !self
```

### Core Architecture Module: `crates/blaze-cli/src/engine_answer.rs`
```
//! `engine-check`'s stored answer (end-state.md D157, the incremental half): the engine's answer and
//! causes as pages (blaze-engine pages.rs), the leaf table of what the request read (sweep.rs
//! `Leaves`), and a sealed pointer naming both (seal.rs), under one root of the store per
//! checkout ([`root_name`]).
//!
//! THE TOOLS are not in the root's name: the answer is one per checkout whichever blaze wrote it.
//! Every row's key holds its own kind's producer (blaze-engine `Tools::key`), and each file's
//! plan digest holds every kind's (pages.rs `plan_digest`), so a request under other tools reads
//! the same answer: a file whose plan digest moved is in its edit, a task whose key moved is
//! entered, and the rest stand by their keys and reads (a moved names solver enters the names,
//! and a body whose scopes came out the same is not entered). Only the certificate, which reads
//! no row, needs the tools: the pointer keeps their digest ([`tools_digest`]), and it stands on
//! equal tools alone. Before (BEL6), the root hashed the tools, so every new blaze build (every
//! producer that moved) started from no answer and entered every task: a whole check of tempo
//! per new binary.
//!
//! Each changed page gets a CAS reach index containing its key, row payloads, and the
//! expansion records its names rows own. The checkout pins the sealed pointer alone,
//! and `<name>.pages` pins the root, printed lines and all live page indexes. The store's
//! generation flip publishes both roots together (pages_sim.rs).
//!
//! The read, before any work: the root name's one key is the sealed pointer; the sweep
//! follows its leaf table; nothing moved, nothing owed and no findings kept is the certificate,
//! from the pointer and the printed lines' record (engine_lines.rs, one get), no page read.
//! Else [`open_root`] reads the directory. [`Stored`] authenticates a page on its first
//! lookup. All consumers share that page's proof for the rest of the request. A refused
//! page stops the edit. A pointer of an older form is reported and rebuilt (rule 26).
//!
//! ```text
//! the root name   engine.<16 hex of H(checkout)>
//! it names        the sealed pointer's key; `<it>.pages` reaches the root, lines and page
//!                 indexes, with their payloads
//! sealed pointer  seal.rs form: last = "BEL8" | answer root key [32] | lines key [32] |
//!                 files u32 | printed u8 (bit 0 names checked, 1 bodies whole, 2 every
//!                 printed line is in the lines record) | findings u32 | owed u32 (the
//!                 certificate's facts) | tools digest [32] | headers u8 (0 current, 1
//!                 absent) | since u64 | 128 x producer header shard key [32] (all zero when
//!                 absent) | the journal's places; leaves = the BCL table
//! ```
//!
//! BEL6 had no tools digest: its root's name held the tools. A BEL6 pointer is an old home's
//! answer, reported and rebuilt ([`Unreadable::Older`]).
//!
//! BEL4 named pages without stored reverse-reader runs or page-local payload reach indexes.
//! BEL5 named 128 shard keys and no state: it could not say that the `Ready` driver's commit
//! (D187: pages alone, no shard read or written) left the shards behind the pages, so a BEL5
//! pointer is an old home's answer, reported and rebuilt ([`Unreadable::Older`]), never read
//! as BEL6 (the form is the pointer's place, D160: the magic is checked before any byte).

use core::fmt;
use core::fmt::Write as _;
use std::sync::OnceLock;

use blaze_cas::plain::Snapshot;
use blaze_core::Driver;
use blaze_drive::{Key, Name};
use blaze_engine::{StoredPages, Tools};
use blaze_engine::pages::{self, Header, HeaderPages, Headers, HeadersPlant, IndexedHeaders, Kept, PagesError, Root, Sealed, VerifiedPage, Writer};

/// The store's proof that a held record's bytes are its key's (rule 74): what the pages take
/// in place of hashing each page at its open (blaze-engine pages.rs, "Checked once").
impl pages::StoreProof for crate::store::plain_place::Checked<'_> {}
use blaze_ids::ContentId;
use blaze_own::SharedAlloc;
use bstd::Cx;
use bstd::mem::Frame;

use crate::store::{CommandStore, Sharing, Store as _};
use crate::sweep::{Leaves, Rows};
use crate::{CliError, seal};

/// The pointer's form inside its seal.
/// BEL8: a file's lint row is ONE (engine_lints.rs, sparse rows: its units' keys in its record,
/// no row a unit); a BEL7 answer's unit rows are an old home's, reported and rebuilt.
pub(crate) const POINTER_MAGIC: &[u8; 4] = b"BEL8";
/// The magic, the answer's root, the lines record's key, then the [`Facts`]: files u32, printed
/// u8, findings u32, owed u32; then the tools' digest ([`tools_digest`]). The header index's
/// state ([`Headers`]) follows: its tag, its `since`, then every shard's key; then the
/// journal's places, of their own length.
const TOOLS_AT: usize = 4 + 32 + 32 + 4 + 1 + 4 + 4;
const HEADERS_AT: usize = TOOLS_AT + 32;
const SHARDS_AT: usize = HEADERS_AT + 1 + 8;
const POINTER_BYTES: usize = SHARDS_AT + 32 * HeaderPages::COUNT;
const HEADERS_CURRENT: u8 = 0;
const HEADERS_ABSENT: u8 = 1;
const POINTER_DOMAIN: &str = "blaze-cli engine-check pointer";

/// Formats an answer root name from `prefix` and `input` under the checkout root domain.
fn root_name_with<'f>(prefix: &str, input: &[u8], frame: &'f Frame) -> blaze_own::String<&'f Frame> {
    let id = ContentId::of("blaze-cli engine-check root 2", input);
    let mut name = blaze_own::String::new_in(frame);
    name.push_str(prefix);
    // A home made before the root stopped hashing the tools holds its answers under names no
    // request asks for again: dead roots, whose records the store's cleanup takes when their
    // pins expire, `ROOT_LIFE_NS` after their last renewal (store/plain_place.rs `pin`).
    // Nothing reads or migrates them (AGENTS.md: an old home's
    // answer is rebuilt, never migrated).
    for byte in &id.0[..8] {
        // A frame string's write fails only when the frame is full: the name is then short and
        // names no root, so the request answers in full.
        let _ = write!(name, "{byte:02x}");
    }
    name
}

/// The root the checkout's stored answer hangs from, whichever tools wrote it (the module's doc,
/// "THE TOOLS"; a machine's path is hashed here alone: a root is local, never shared).
pub(crate) fn root_name<'f>(checkout: &str, frame: &'f Frame) -> blaze_own::String<&'f Frame> {
    root_name_with("engine.", checkout.as_bytes(), frame)
}

/// Whether `name` is the checkout's own root (`checkout_root`) or one of its auxiliary / scoped
/// roots (`<checkout_root>.*`), so `blaze clean` can discard this checkout's cached answers
/// without touching any other checkout or shared store data.
pub(crate) fn is_checkout_root(name: &str, checkout_root: &str) -> bool {
    name == checkout_root
        || (name.starts_with(checkout_root) && name.as_bytes().get(checkout_root.len()) == Some(&b'.'))
}

/// The root a check of `scope` hangs from: equal to [`root_name`] for whole-workspace checks, and
/// a disjoint `"<root_name>.s.<hex>"` root for scoped `blaze test` / `blaze run` / `blaze export`
/// requests so scoped checks never overwrite the whole-workspace answer while still supporting
/// certificate hits, incremental edits, and per-checkout cleanup (`blaze clean`).
pub(crate) fn scoped_root_name<'f>(checkout: &str, scope: crate::engine_check::CheckScope<'_>, frame: &'f Frame) -> blaze_own::String<&'f Frame> {
    match scope {
        crate::engine_check::CheckScope::Whole => root_name(checkout, frame),
        crate::engine_check::CheckScope::Test { packages, bin, bin_roots } => {
            let mut key = blaze_own::Vec::new_in(frame);
            let push_part = |buf: &mut blaze_own::Vec<u8, &'f Frame>, bytes: &[u8]| {
                let len = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
                buf.extend_from_slice(&len.to_le_bytes());
                buf.extend_from_slice(bytes);
            };
            push_part(&mut key, checkout.as_bytes());
            push_part(&mut key, b"test");
            let pkg_count = u64::try_from(packages.len()).unwrap_or(u64::MAX);
            key.extend_from_slice(&pkg_count.to_le_bytes());
            for package in packages {
                push_part(&mut key, package.as_bytes());
            }
            match bin {
                Some(name) => {
                    key.push(1);
                    push_part(&mut key, name.as_bytes());
                }
                None => key.push(0),
            }
            let root_count = u64::try_from(bin_roots.len()).unwrap_or(u64::MAX);
            key.extend_from_slice(&root_count.to_le_bytes());
            for root in bin_roots {
                push_part(&mut key, root.as_bytes());
            }
            let prefix = bstd::mem::format_in!(frame, "{}.s.", root_name(checkout, frame).as_str());
            root_name_with(prefix.as_str(), key.as_slice(), frame)
        }
        crate::engine_check::CheckScope::Bin { package, root } => {
            let mut key = blaze_own::Vec::new_in(frame);
            let push_part = |buf: &mut blaze_own::Vec<u8, &'f Frame>, bytes: &[u8]| {
                let len = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
                buf.extend_from_slice(&len.to_le_bytes());
                buf.extend_from_slice(bytes);
            };
            push_part(&mut key, checkout.as_bytes());
            push_part(&mut key, b"bin");
            push_part(&mut key, package.as_bytes());
            push_part(&mut key, root.as_bytes());
            let prefix = bstd::mem::format_in!(frame, "{}.s.", root_name(checkout, frame).as_str());
            root_name_with(prefix.as_str(), key.as_slice(), frame)
        }
    }
}

/// Unroots every stored answer root (whole-workspace, scoped, reach, journal, grains, members,
/// scripts, view) belonging to `checkout` from `lent`, and removes any pointer owned by this
/// checkout from [`BASES_ROOT`] / [`
```

### Core Architecture Module: `crates/blaze-cli/src/engine_answer_rows.rs`
```
//! `engine-check`'s stored answer in blaze-answer's form (runtime.md, "The answer's stored form",
//! F0; the switch is D5), behind the seam blaze-engine last.rs states, beside the page form
//! (engine_answer.rs), not yet switched on. Both forms answer the seam: [`RowsAnswer`] over the
//! segments read in place, [`PagesAnswer`] over the page form's loaded [`Kept`], so the switch is
//! one type parameter (rule 78).
//!
//! ```text
//! names           engine.<16 hex>.<64 hex>.rows   the root's key alone (engine_answer.rs `root_name`,
//!                                                 then `tools_digest`: [`root_names`])
//!                 engine.<16 hex>.<64 hex>.rows.segments   an indexed root of the live segments, lines and row payloads
//!                 engine.tree.<64 hex of H(tree digest, every kind's tool)>   and its `.segments`:
//!                 the same keys, so a second worktree at the same tree finds the answer
//! the root        blaze-answer's root bytes, under the key of its bytes ([`root_key`])
//! a segment       its bytes, under its `SegmentRef::id` (the digest of its bytes)
//! the summary     files u32 | printed u8 (bit 0 names checked, 1 bodies whole, 2 replayable) |
//!                 findings u32 | owed u32: the certificate's facts, as the page form's pointer
//! ```
//!
//! A root's keys are a set to the store, not an order (engine_answer.rs `save`), so the root's
//! key is alone under its name and the segments are kept under a second.
//!
//! The write ([`write_effects`]): every new segment, then the root, then the four pins, in that
//! order, all before the store's one commit after the answer. The commit makes them visible at
//! once (the store's generation flip, blaze-cas plain): a crash before it leaves the last root
//! and its segments as they were, because a segment is immutable and no write here deletes one.
//! The order alone, without the flip, already never pins a root whose segment is not put: the
//! cut test in engine_answer_rows_tests.rs cuts the writes at every point.
//!
//! The read: [`load_root`] (the name's one key, the root's bytes), [`certified`] (the root alone:
//! no segment read), then [`load_rows`] (the segments mapped where the store holds them). One
//! that cannot be read is [`RowsUnreadable`]: a note says which and why, and the request answers
//! in full and writes the answer anew (a stated path, rule 3); a root of another form is an old
//! home's, reported and rebuilt (rule 26).
//!
//! The engine over this form: `Engine<RowsAnswer>`'s finish folds the request's writes into a
//! [`RowsFolded`] (blaze-engine overlay.rs `Fold`); the command then hands it what only the
//! request's end knows ([`Close`]: the tree, what it printed, the lines record, each row's record
//! key) and [`RowsFolded::commit`] writes the next answer's segments, each row the request put at
//! the serial blaze-engine's `Generations` gives it. A file's plan, the owed tasks and cells and
//! the rows with findings are each read from their own column (blaze-answer kinds 5 to 8), so no
//! question walks the rows (engine_answer_columns_tests.rs counts them).
#![cfg_attr(not(test), expect(dead_code, reason = "the rows form waits on the switch (runtime.md D5); its tests use it today"))]

use core::fmt;
use core::sync::atomic::{AtomicU64, Ordering};

use blaze_answer::{
    AnswerError, AnswerView, CellDigest, CellNo, Commit, DEFINE_BYTES, Effects, Flags, LinesKey, MAX_READS_PER_ROW, Plant, ROW_COLD_BYTES, ROW_FIXED_BYTES, RowIn, RowView, RunWriter, SegmentKind,
    RootView, SegmentRef, Serial, TaskId, TreeDigest, Write, has_findings,
};
use blaze_core::Driver;
use blaze_drive::cells::Cell;
use blaze_drive::key::ABSENT;
use blaze_drive::{Key, Name};
use blaze_engine::last::{Found, LastAnswer, LastError, LastRow, NextAnswer, NextRow, ReadOf, Touched};
use blaze_engine::pages::Kept;
use blaze_engine::{Answer, CellId, EngineError, Fold, Phase, Planned, Row, Stage, Tools, Work};
use blaze_ids::ContentId;
use blaze_own::{AVec, Alloc, SharedAlloc, Vec};
use bstd::Cx;
use bstd::mem::Frame;

use crate::CliError;
use crate::engine_answer::{Facts, Printed};
use crate::store::{CommandStore, Sharing, Store as _};

/// The domain of a root's store key: the digest of its bytes.
const ROOT_DOMAIN: &str = "blaze-cli engine answer rows root";
const TREE_DOMAIN: &str = "blaze-cli engine answer tree";

/// The summary's bytes: files u32, printed u8, findings u32, owed u32.
pub(crate) const SUMMARY_BYTES: usize = 4 + 1 + 4 + 4;

/// One binary search's probes at the cap of a segment (2^22 rows: 22 steps of a u32).
const PROBE_BYTES: u64 = 4 * 22;
/// A name's search in one dictionary: its filter's three words and 22 steps of an index and a
/// 33-byte name.
const NAME_PROBE_BYTES: u64 = 3 * 8 + 22 * (4 + 33);
/// A cell's search in one dictionary: its filter and 22 steps of an index, a definer and a cell.
const CELL_PROBE_BYTES: u64 = 3 * 8 + 22 * (4 + 4 + 16);
/// A row's fixed and cold fields.
const ROW_BYTES: u64 = (ROW_FIXED_BYTES + ROW_COLD_BYTES) as u64;
/// A read, at most: the widest a read list packs one (32 bits).
const READ_BYTES_MOST: u64 = 4;

/// The certificate's facts as the root's summary.
pub(crate) fn summary(facts: &Facts) -> [u8; SUMMARY_BYTES] {
    let mut out = [0u8; SUMMARY_BYTES];
    out[0..4].copy_from_slice(&facts.files.to_le_bytes());
    let printed = facts.printed;
    out[4] = u8::from(printed.names) | u8::from(printed.bodies_whole) << 1 | u8::from(printed.replayable) << 2;
    out[5..9].copy_from_slice(&facts.findings.to_le_bytes());
    out[9..13].copy_from_slice(&facts.owed.to_le_bytes());
    out
}

fn word(bytes: &[u8], at: usize) -> u32 {
    u32::from_le_bytes([bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]])
}

/// The facts a summary holds; `None`: not a summary of this form.
fn facts_of(bytes: &[u8]) -> Option<Facts> {
    if bytes.len() != SUMMARY_BYTES || bytes[4] > 7 {
        return None;
    }
    let printed = Printed { names: bytes[4] & 1 != 0, bodies_whole: bytes[4] & 2 != 0, replayable: bytes[4] & 4 != 0 };
    Some(Facts { files: word(bytes, 0), printed, findings: word(bytes, 5), owed: word(bytes, 9) })
}

/// The store key of a root's bytes.
pub(crate) fn root_key(bytes: &[u8]) -> Key {
    Key(ContentId::of(ROOT_DOMAIN, bytes))
}

/// The four names a rows answer hangs from: the checkout's (its root, its segments) and the
/// tree's (the same two, by the tree's digest).
pub(crate) struct RootNames<'f> {
    pub(crate) checkout: blaze_own::String<&'f Frame>,
    pub(crate) checkout_segments: blaze_own::String<&'f Frame>,
    pub(crate) tree: blaze_own::String<&'f Frame>,
    pub(crate) tree_segments: blaze_own::String<&'f Frame>,
}

/// The names of the checkout's rows answer for `tools`, and of the answer of the tree `tree`.
/// A checkout's name is local (its path is hashed in, engine_answer.rs `root_name`); the tree's
/// holds only the tree's digest and the tools (rule 25). The page form's root no longer holds
/// the tools (its pointer does, engine_answer.rs "THE TOOLS"); this form's [`certified`] reads
/// no tools, so its checkout names keep them: the tools' digest after `.rows`.
pub(crate) fn root_names<'f>(checkout: &str, tools: &Tools, tree: &TreeDigest, frame: &'f Frame) -> RootNames<'f> {
    let checkout_root = crate::engine_answer::root_name(checkout, frame);
    let pages = bstd::mem::format_in!(frame, "{}.{:x}", checkout_root.as_str(), crate::engine_answer::tools_digest(tools));
    let mut input = blaze_ids::Hasher::new(TREE_DOMAIN);
    input.update(&tree.0);
    for tool in tools.0.iter() {
        input.id(&tool.0);
    }
    let tree_name = bstd::mem::format_in!(frame, "engine.tree.{:x}", input.finish());
    RootNames {
        checkout: bstd::mem::format_in!(frame, "{}.rows", pages.as_str()),
        checkout_segments: bstd::mem::format_in!(frame, "{}.rows.segments", pages.as_str()),
        tree_segments: bstd::mem::format_in!(frame, "{}.segments", tree_name.as_str()),
        tree: tree_name,
    }
}

/// Why the stored rows answer is not read: the request answers in full and writes it anew.
#[derive(Debug)]
pub(crate) enum RowsUnreadable {
    /// The name holds other than one key (its root's).
    Names { bytes: usize },
    /// A record the name names is not in the store.
    Missing { key: Key },
    /// The bytes under the named key do not authenticate as that root.
    RootDigest { expected: Key, found: Key },
    /// The root or a segment (blaze-answer), or the seam's reading of a row.
    Answer(LastError),
    /// The root's summary is not this form's.
    Summary { bytes: usize },
}

impl fmt::Display for RowsUnreadable {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if let RowsUnreadable::Answer(LastError::Answer(AnswerError::Format { .. })) = self {
            return write!(f, "the stored engine answer is an old home's answer (another form of blaze-answer's root), rebuilt (rule 26)");
        }
        write!(f, "the stored engine answer's rows are not read (engine_answer_rows.rs `load_rows`): ")?;
        match self {
            RowsUnreadable::Names { bytes } => write!(f, "its name holds {bytes} bytes, not its root's one key")?,
            RowsUnreadable::Missing { key } => write!(f, "{key:?}, which its name names, is not in the store")?,
            RowsUnreadable::RootDigest { expected, found } => write!(f, "the named root {expected:?} has digest {found:?}")?,
            RowsUnreadable::Answer(why) => write!(f, "{why}")?,
            RowsUnreadable::Summary { bytes } => write!(f, "its root's summary is {bytes} bytes, not the certificate's {SUMMARY_BYTES}")?,
        }
        write!(f, "; answering in full and writing them anew")
    }
}

/// The root the checkout's name names, as stored.
pub(crate) struct RowsRoot<'m> {
    pub(crate) key: Key,
    directory: RootView<'m>,
    facts: Facts,
}

impl<'m> RowsRoot<'m> {
    pub(crate) fn open(key: Key, bytes: &'m [u8]
```

### Core Architecture Module: `crates/blaze-cli/src/engine_bodies.rs`
```
//! The `Bodies` stage of `blaze engine-check` (end-state.md D157): every body of
//! the workspace's files type-checked and borrow-checked as ITS OWN engine task, entered once, on
//! the pool, by `check_body_reads` (front2 tables/task.rs) over the read-only view.
//!
//! THE PLAN, from text: one `BodyCheck` task per body part of each file's outline (work.rs
//! `outline_file`: one part per entry with a body of its own, and per entry a macro takes), its
//! name and source the outline's (`body_name`, `body_source`: the item's text), so the task's
//! key is known before any phase runs ([`plan`]).
//!
//! THE PHASE, on the coordinator first (a constant per member crate, never a step per body):
//! the crate list (the `UnitGraph` record), its trees, and for each member crate its check scope
//! (blaze-world check_scope.rs: the one rule of which crates a body sees), each scope crate's
//! names and items records read from the store as the Names stage put them, and the member's
//! files (its items record's file rows) matched to the planner's outlines. Each body of an owed
//! file is then matched to its item key through that file's listing (front2 project_records.rs
//! `list_files_with`, `index_by_chain`): the item key is what `check_body` finds a body by. What
//! the rest of a member's listing was for (the bodies a macro wrote, of blocks, and the note of
//! those no entry covers) is the member's listing row (engine_member_rows.rs), read by key; a
//! member none of whose files is owed is not opened.
//!
//! THE RUNS: entered bodies are scheduled as LPT (largest-first) work-stealing items across long-
//! lived pool workers; each worker keeps its current member's stretch frame (`BODIES_FRAME`) and
//! `Records` alive across consecutive stolen items of the same member group (`Records` opens lazily
//! through `RefCell`s: never shared between threads, view.rs), resetting its per-body scratch frame
//! (`BODY_SCRATCH`, trimmed to `SCRATCH_KEEP`) between bodies. The stretch memoizes the IDs of
//! distinct questions over those tables. A panic fails its body alone (rule 20). Results are
//! reassembled in exact original order before merging (rule 25).
//!
//! WHAT A BODY READS, as the engine keys its readers: the view records names, lang, head and
//! impl-bucket cells. A crate's `ImplBucket` cell is read as read: the Heads stage defines it
//! (engine_heads.rs), or states its absence (no impl of the crate in that bucket). Until the
//! Names stage defines cells finer than its record's one whole cell (E4's wiring), the other
//! reads are WIDENED to a cell some phase defines ([`widen`]): a `CrateScope` cell to that
//! record's whole cell, the whole graph's bucket fact (made from the names records) to every
//! scope crate's. A `Signature` read of a member's head is the cell of the head task of the
//! entry that covers it (engine_heads.rs `Owners::place`; the body still makes the heads it
//! needs in its own store, task.rs), so a signature edit enters exactly the bodies whose head
//! read moved; a dependency's head, or one a macro wrote, is its crate's names record whole.
//! Settled names and impl tables share the graph's cell (engine_scope_reads.rs). Raw read
//! keys stay in the recorder until distinct, and only final row IDs need the engine's digests.

use core::convert::Infallible;
use core::num::NonZeroU32;
use core::sync::atomic::{AtomicUsize, Ordering};

use blaze_drive::cells::Cell;
use blaze_drive::key::ABSENT;
use blaze_drive::{Input, Key, Kind, Locate, Name};
use blaze_core::SharedSet;
use blaze_engine::{Buffer, CellDigests, CellId, Done, Phase, Planned, SVec, Stage, Stands, Task, View};
use blaze_id::ItemKey;
use blaze_ids::{ContentId, Hasher};
use blaze_ladder::front2::buckets::{ImplShelf, ImplShelfOpts, TableSet};
use blaze_ladder::front2::heads::NeedsMet;
use blaze_ladder::front2::project_records::{BodySource, index_outlined_by_chain, index_view_by_chain};
use blaze_ladder::front2::source::NamesSource;
use blaze_ladder::front2::tables::cost::{Cost, Gauge};
use blaze_ladder::front2::heads::Want;
use blaze_ladder::front2::tables::head::{CellFailure, ConstValues, FreezeError, NotTheirs, SeededHeads, SeededHeadsOpts, cell_id as head_cell_id};
use blaze_ladder::front2::tables::recorder::{PlacedCell, Recorder, RecorderOpts, TableRead};
use blaze_ladder::front2::tables::seeds::{HeadSeed, RequestSeedOpts, SeedError};
use blaze_ladder::front2::tables::task::{BodyFrame, ReadIds, ReadKeyer, Said as Line, SaidWhat, StretchStore, StretchStoreOpts, TaskError, WorkBytes, check_body_item};
use blaze_ladder::front2::tables::view::{Tables, TablesOpts};
use blaze_own::{SharedAlloc, Vec};
use blaze_scope::crate_env::EnvLent;
use blaze_scope::items_record::ItemsRecord;
use blaze_world::crate_list::CrateGraph;
use bstd::clock::Clock;
use bstd::cx::Cx;
use bstd::fs::{Dir, ReadWrite};
use bstd::mem::Frame;
use bstd::sync::CachePadded;
use bstd::task::Class;
use std::alloc::Global;

use crate::CliError;
use crate::body_types::Kept;
use crate::engine_body_plan::{BodyClaim, BodyIs, FileClaim, FileIs, Reach, TaskRow};
use blaze_drive::view::{Production, ViewKey, ViewPlan, at_view};
use crate::engine_check::EngineCheckError;
use crate::engine_head_notes::{Cause, RootKind, Step, leak, root_cause};
use crate::engine_memory::InStretch;
use crate::engine_members_record::{EveryMember, SetupInputs, StandingMembers};
use crate::engine_names::NamesInputs;
use crate::engine_records::EngineRecords;
use crate::engine_scope_reads::ReadGrains;
use crate::engine_tasks::{Outlined, WHOLE};
use crate::fetch::FetchEnv;
use crate::run_names::Crate;
use crate::store::StoreSnapshot;
use crate::work;

/// Where the rule that refuses a body on this path is.
const RULE: &str = "engine_bodies.rs";

/// Threshold in predicted bytes above which a body is always scheduled as its own single-body
/// work item in the dynamic LPT work-stealing queue (so no two medium/heavy bodies can ever
/// serialize on one core).
const SINGLE_BODY_BYTES: u64 = 1024;

/// Maximum number of consecutive tiny bodies (`< SINGLE_BODY_BYTES`) of the same member group
/// grouped into one tiny work-stealing batch, and the predicted byte cap on such a batch.
const TINY_BATCH_MAX: usize = 4;
const TINY_BATCH_BYTES: u64 = 1024;

/// Bodies with predicted cost at or above this threshold are ordered by exact descending cost
/// (strict LPT) in the work-stealing queue; smaller items are quantized into 512-byte tiers so
/// same-group, same-file items stay contiguous for worker-local stretch and cache reuse.
const LPT_EXACT_BYTES: u64 = 4 << 10;

/// The most predicted cost one macro-expansion slice checks, in bytes of its bodies' text (D167
/// (a): work at item grain, sized by predicted cost and capped, never grouped by origin). An entry
/// of multiple macro-written bodies predicted past this (e.g. one `storable_nested_arrays!()`
/// call: 704 bodies) is cut into slices of at most this, each its own work-stealing item joined
/// back into the entry's one result after the phase ([`join_slices`]); a body predicted past it
/// alone is a slice alone. Sized to 4 KiB so dense macro expansions scale across 18–128 cores
/// without creating a tail straggler.
const SLICE_BYTES: u64 = 4 << 10;

/// A body's least predicted cost: what checking any body costs beside its text (its stretch's
/// questions, its row), so a slice of many tiny bodies is still cut.
const MIN_BODY_BYTES: u32 = 256;

/// A body's predicted cost (D167 (a)): its text's length in bytes, from its crate's items record
/// alone (no text read): an item a macro wrote by its row's span, an item of `file` by its
/// outline entry's range, a member (an impl's or trait's that a macro wrote) by its member row's
/// span ([`member_lens`], made once a member crate when first asked). Never less than
/// [`MIN_BODY_BYTES`]; a body no row places costs that least.
fn text_bytes(
    items: &ItemsRecord<'_>,
    members: &mut Option<Vec<(ItemKey, u32), blaze_own::Alloc<'static>>>,
    item_len: impl Fn(blaze_surface::ItemIndex) -> u32,
    file: u32,
    key: ItemKey,
    g: blaze_own::Alloc<'static>,
) -> u32 {
    use blaze_scope::resolve::At;
    let len = match items.identity(key) {
        Ok(Some(id)) => match id.at {
            Some(At::File(at)) if at == file => item_len(id.outline),
            Some(At::Expansion(_)) => items.item(key).ok().flatten().and_then(|row| row.text).map_or(0, |span| span.len),
            _ => 0,
        },
        _ => {
            let lens = members.get_or_insert_with(|| member_lens(items, g));
            lens.binary_search_by_key(&key, |member| member.0).map_or(0, |at| lens[at].1)
        }
    };
    len.max(MIN_BODY_BYTES)
}

/// Bodies `from..to` of an entry predicted, summed ([`text_bytes`]); a body with no cost listed
/// (none should be: `groups` makes one a key) is predicted at the least.
fn predicted(costs: &[u32], from: usize, to: usize) -> u64 {
    (from..to).map(|at| u64::from(costs.get(at).copied().unwrap_or(MIN_BODY_BYTES))).sum()
}

/// Each member of an impl or trait a macro wrote, by key, with its text's length (its member
/// row's span), sorted by key: rows alone, no text read. A row that does not read is left out
/// (its body then costs [`MIN_BODY_BYTES`]; its check reads the row again and says why).
fn member_lens(items: &ItemsRecord<'_>, g: blaze_own::Alloc<'static>) -> Vec<(ItemKey, u32), blaze_own::Alloc<'static>> {
    use blaze_scope::resolve::At;
    let mut lens = Vec::new_in(g);
    for i in 0..items.items() {
        let Ok(Some(id)) = items.identity_at(i) else { continue };
        if !matches!(id.kind, blaze_surface::ItemKind::Impl | blaze_surface::ItemKind::Trait) || !matches!(id.at, Some(At::Expansion(_))) {
            continue;
        }
        let Ok(Some(members)) = items.members(id.key) else { continue };
        for member in members.iter().flatten() {
            lens.push((member.key, member.text.map_or(0, |span| span.len)));
        }
    }
    lens
```

### Core Architecture Module: `crates/blaze-cli/src/engine_body_facts.rs`
```
//! A BODY'S RUN FACTS, kept as a record (run.md, "Run and test read the engine's answer", E1).
//!
//! The Bodies stage keeps nothing of a body but its row (a key, reads, the verdict digest), and
//! `run` and `test` need three more facts of each body: whether it is clean (its class), and
//! which items its check covers (what `work::body_payload` holds for the old request). They are
//! one small record a `BodyCheck` task, put beside its row (engine_check.rs, the Bodies put), and
//! this file is the one home of its bytes (rule 30): [`write`], the one reader [`read`] that
//! checks every length and order once (rule 74), and the one rule that gives a class from a
//! task's findings' rules ([`class_of`]), which `run_ids.rs` `verdict` asks too.
//!
//! The record holds a body's CLASS, never its findings' text: the findings are in the lines
//! record alone (rule 30). Its out is the row's verdict digest, so it moves with the row and
//! invalidates nothing of its own.
//!
//! Form 3 adds THE TYPED RECORD'S KEY (engine_body_record.rs `typed_key`, the key of that
//! record's bytes): how `run` finds a clean body's checked columns. The typed record is keyed by
//! its bytes because a clean body's verdict digest does not move with every column it holds
//! (engine_body_record.rs, THE KEY); this record, keyed by its own bytes too (engine_check.rs,
//! the Bodies put), moves with it.
//!
//! ```text
//! payload  "BRF2" | form u16 = 3 | tag u8 | 0 u8 | errors u32 | rule u16 | 0 u16 | count u32 | count * key [16] | typed
//! tag      0 clean (errors 0, rule 0) | 1 errors (errors >= 1, rule: the first error's rule)
//!          | 2 untyped (errors 0, rule: the not-typed rule) | 3 typed (errors 0, rule: the
//!          borrow-not-checked rule)
//! key      a covered item's checker key, `blaze_typeck::ItemKey` as 16 big-endian bytes, as
//!          `work::body_payload` holds them; sorted, strictly ascending (one each)
//! typed    0 u8 (no typed record) | 1 u8, then the typed record's store key [32]
//! ```
//!
//! Little-endian numbers, every unused byte zero: the bytes are a function of (class, covered
//! set, typed key) alone (rule 25), so two builders of one answer write equal bytes.

use core::alloc::Allocator;

use blaze_own::Vec;

/// The payload's first four bytes: another form's are refused.
const MAGIC: [u8; 4] = *b"BRF2";

/// The form number after the magic. Form 3: the typed record's key after the covered keys.
const FORM: u16 = 3;

/// The mark after the covered keys: no typed record, or its 32-byte store key after it.
const NO_TYPED: u8 = 0;
const TYPED_AT: u8 = 1;

/// A store key's bytes.
const STORE_KEY: usize = 32;

/// The head's bytes: everything before the keys.
const HEAD: usize = 20;

/// One covered key's bytes.
const KEY: usize = 16;

const CLEAN: u8 = 0;
const ERRORS: u8 = 1;
const UNTYPED: u8 = 2;
const TYPED: u8 = 3;

/// What a body's check came to, as `run` needs it: the only class a program may call into is
/// `Clean`.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum Class {
    /// Checked whole, no error.
    Clean,
    /// Checked, `errors` findings that are errors (at least one, by its type: a record saying
    /// none is refused by [`read`] as [`BodyFactsError::NoErrors`]); the rule of the first.
    Errors { errors: core::num::NonZeroU32, first: u16 },
    /// Types checked whole, no error; the borrow check refused or not run: the rule of the note
    /// that says so (`BORROWS_NOT_CHECKED`). Borrows never change what a body does.
    Typed { rule: u16 },
    /// Refused, panicked, or its types not checked to the end: the rule that says so
    /// (`TYPES_NOT_CHECKED`, or `NOT_RUN` for a refusal, a panic or a body no check ran).
    Untyped { rule: u16 },
}

/// A body's run facts as [`read`] gives them: the class and the covered items' keys in place.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) struct BodyFacts<'a> {
    pub(crate) class: Class,
    /// The checker keys of the items the task covers (16 big-endian bytes each, the form
    /// `work::body_payload` holds), sorted, one each.
    pub(crate) covers: &'a [[u8; KEY]],
    /// The store key of the body's typed record (engine_body_record.rs `typed_key`): `None`
    /// when its check kept none (findings, stalled goals, not checked whole).
    pub(crate) typed: Option<blaze_drive::Key>,
}

impl BodyFacts<'_> {
    /// The covered checker keys as the old request's payload gives them (`BodyPayload::covered`).
    pub(crate) fn covered(&self) -> impl ExactSizeIterator<Item = blaze_typeck::ItemKey> + '_ {
        self.covers.iter().map(|key| blaze_typeck::ItemKey(u128::from_be_bytes(*key)))
    }
}

/// Why bytes are not a facts record, or why a record cannot be written: each names what.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum BodyFactsError {
    /// Shorter than the head.
    Short { len: usize },
    /// Another form's magic.
    Magic { found: [u8; 4] },
    /// Another form number.
    Form { found: u16 },
    /// A class tag that is none of the three.
    Tag { tag: u8 },
    /// A field the class does not use is not zero.
    Fields { tag: u8 },
    /// An errors class whose error count is zero: no verdict (finding 13).
    NoErrors,
    /// A byte that must be zero is not, at this offset.
    Reserved { at: usize },
    /// The head's key count and the bytes disagree.
    Size { count: u32, len: usize },
    /// The keys are not sorted one each, at this key (the later of the two).
    Unsorted { at: usize },
    /// More keys than the count's 32 bits hold (a write).
    TooMany { count: usize },
    /// The mark after the covered keys is neither "no typed record" nor "its key follows".
    TypedMark { mark: u8 },
}

impl core::fmt::Display for BodyFactsError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            BodyFactsError::Short { len } => write!(f, "a body's run facts of {len} bytes, shorter than their {HEAD}-byte head (engine_body_facts.rs `read`)"),
            BodyFactsError::Magic { found } => write!(f, "a body's run facts of form {found:?}, not {MAGIC:?} (engine_body_facts.rs `read`)"),
            BodyFactsError::Form { found } => write!(f, "a body's run facts of form number {found}, not {FORM} (engine_body_facts.rs `read`)"),
            BodyFactsError::Tag { tag } => write!(f, "a body's run facts of class tag {tag}, none of 0 (clean), 1 (errors), 2 (untyped), 3 (typed) (engine_body_facts.rs `read`)"),
            BodyFactsError::Fields { tag } => write!(f, "a body's run facts of class tag {tag} whose error count or rule is not what the class holds (engine_body_facts.rs `read`)"),
            BodyFactsError::NoErrors => f.write_str("a body's run facts of class tag 1 (errors) with an error count of zero (engine_body_facts.rs `read`)"),
            BodyFactsError::Reserved { at } => write!(f, "a body's run facts whose byte {at} is not zero (engine_body_facts.rs `read`)"),
            BodyFactsError::Size { count, len } => write!(f, "a body's run facts naming {count} covered keys in {len} bytes (engine_body_facts.rs `read`)"),
            BodyFactsError::Unsorted { at } => write!(f, "a body's run facts whose covered keys are not sorted one each at key {at} (engine_body_facts.rs)"),
            BodyFactsError::TooMany { count } => write!(f, "a body covering {count} items, more than a record's 32-bit count holds (engine_body_facts.rs `write`)"),
            BodyFactsError::TypedMark { mark } => write!(f, "a body's run facts whose typed-record mark is {mark}, neither {NO_TYPED} (none) nor {TYPED_AT} (its key follows) (engine_body_facts.rs `read`)"),
        }
    }
}

/// Why the Bodies put could not make a task's facts: each names the body in the caller's error.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum MakeError {
    /// The task was entered and the Bodies stage holds no result for it.
    NotRan,
    /// The merged answer holds no row for it.
    NoRow,
    /// Its bytes cannot be written.
    Bytes(BodyFactsError),
}

impl core::fmt::Display for MakeError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            MakeError::NotRan => f.write_str("the task was entered and the Bodies stage has no result for it, so no run facts can be made (engine_bodies.rs `write_facts`)"),
            MakeError::NoRow => f.write_str("the task was entered and the merged answer has no row for it (engine_check.rs, the Bodies put)"),
            MakeError::Bytes(error) => write!(f, "{error}"),
        }
    }
}

/// Whether a finding of `rule` says the body's types were not checked whole: its types were not
/// checked to the end, or it was not run. Such a body is `Untyped` whatever else it has.
pub(crate) fn is_untyped(rule: u16) -> bool {
    rule == crate::body_types::TYPES_NOT_CHECKED || rule == crate::work::NOT_RUN
}

/// The class the rules of a task's findings give: a rule of the not-typed kind ([`is_untyped`])
/// gives `Untyped`, at the first such; else the rules `crate::every_rule` calls errors are
/// counted, and the first is kept (`Errors`); else `BORROWS_NOT_CHECKED` (types whole, no error,
/// the borrow check refused or not run) gives `Typed`; none is `Clean`. Whether a `Typed` body
/// runs is the reader's (borrows are notes until `BORROWS_ARE_ERRORS`), never this record's.
pub(crate) fn class_of(rules: impl IntoIterator<Item = u16>) -> Class {
    let mut errors = 0u32;
    let mut first = 0u16;
    let mut typed = false;
    for rule in rules {
        if is_untyped(rule) {
            return Class::Untyped { rule };
        }
        if rule == crate::body_types::BORROWS_NOT_CHECKED {
            typed = true;
        }
        if crate::every_rule(rule) {
            if errors == 0 {
                first = rule;
            }
            errors = errors.saturating_add(1);
        }
    }
    if let Some(errors) = core::num::NonZeroU32::new
```

### Core Architecture Module: `crates/blaze-cli/src/engine_body_plan.rs`
```
//! Which unit of a crate checks each body: decided from the units' records alone (lane RP1).
//!
//! A package's units are crates of their own (the crate list's rows: the lib, each bin, the lib's
//! test harness, each integration test), each with its cfg set (blaze-unit-graph resolve.rs
//! `unit_cfg`: `test` on a test harness, `feature = ".."` for each feature on). Which files and
//! items a unit holds is its names task's decision, recorded in its items record (its file rows,
//! and its items under the unit's cfg). The planner outlines files forward from text, cfg-blind
//! (engine_check.rs `plan`): `#[cfg(test)] mod tests;` names `src/tests.rs` for every unit of the
//! crate. Which units REACH a file, and which hold a ROW of a body, is read against what plan time
//! knows of each unit's cfg (engine_plan_cfg.rs, D191's cfg-aware holders: a unit's `test`, in
//! three values): the lib unit with no build script does not reach `src/tests.rs`
//! ([`reached_under`]), and has no row of a `#[cfg(test)]` entry; a test build has none of a
//! `#[cfg(not(test))]` one. What plan time cannot decide keeps every reacher's row, counted.
//!
//! THE RULE (D191: every unit that holds a body checks it). A body's rows are planned from text,
//! one for each member unit whose module tree reaches its file ([`Reach`]) and whose `test` does
//! not cut the body's entry (engine_plan_cfg.rs [`Cut`]), in rank
//! (non-test units first, then the crate list's order): the first keeps the body's plain name
//! (the BASE row, the name a body one unit reaches has always had), each other's row is the name
//! at its view (blaze-drive view.rs `at_view`, the one spelling; [`ViewPlan`] the strategy). Each
//! row is its own unit's alone ([`Holders::decide`]): checked in that unit's world when its
//! records hold the body, else said the way that unit's records say it. A unit's refusal (its
//! records could not be read) refuses its own row; another unit's row of the body is checked.
//! What no unit holds is no unit's body, never a refusal:
//! - a file no unit's items record lists (a `cfg` on its `mod` cut it in every unit): its rows
//!   are no unit's, each with no finding; ONE note for the file, a block of the lines record
//!   under the file's own name with no engine row (so a certificate replays it and no finding
//!   stops one), counted ([`Outside::lines`]);
//! - an entry of a held file no holding unit's records hold (a `cfg` inside the file, or a macro
//!   that replaced it): no unit's body; counted in the plan's line, no note each.
//!
//! A row whose unit does not hold the body (its file's `mod` cut by the unit's cfg, its entry
//! left out: `#[cfg(test)] fn only_in_tests` in the lib's row) is done with no finding and no
//! check: nothing of it is called checked.
//!
//! WHAT A ROW READS (rule 21). A row that is not its unit's body reads its unit's items section's
//! cell (`NameCell::Whole { section: Items }`, which moves when its file rows or items move: a
//! `#[cfg(test)]` taken off `mod tests;` adds the file to the lib unit's rows), or its names
//! record whole when its crate has no cell table ([`Holders::cells`]): the unit that comes to hold
//! the body enters its row again. A checked row reads its own unit's records through the checker,
//! so its unit's losing the body moves those reads. Which units reach a file is the plan's (each
//! row's NAME): a `mod` that moves a reach moves the reached file's plan.

use core::fmt;

use blaze_drive::cells::Cell;
use blaze_drive::key::ABSENT;
use blaze_drive::view::{MemberView, UnitView, ViewKey, ViewPlan, at_view};
use blaze_drive::{Kind, Locate, Name};
use blaze_engine::{CellId, Task, View};
use blaze_ids::ContentId;
use blaze_own::{AVec, Vec};
use blaze_scope::names_cells::{NameCell, Section};
use blaze_world::crate_list::{CrateGraph, CrateList};
use bstd::mem::Frame;
use std::alloc::Global;

use crate::engine_plan_cfg::{Cut, PlanCuts, file_cuts, part_cut};
use crate::engine_tasks::{CELLS, Outlined, WHOLE};
use blaze_expand::Tri;

/// Where the rule is (rule 19).
const RULE: &str = "engine_body_plan.rs";

/// The words of an entry a unit holds the file of, but whose records hold no body at the entry
/// (engine_bodies.rs `groups`): not that unit's body ([`BodyIs::Absent`]), never a refusal.
pub(crate) const ENTRY_ABSENT: &str = "no body of its crate's records is at this entry (a `cfg` left it out, or a macro replaced it)";

/// The refusal of a planned body whose file a unit holds, but whose records' walk of the file
/// listed no entry at its name: a fault of the plan or the records, named (rule 3).
pub(crate) const NO_ENTRY: &str = "its crate's records list no entry with a body at this name, though they hold its file (engine_body_plan.rs `decide`)";

/// The refusal of a row whose unit the plan's reach gives the file, and which made no claim on
/// it while others did: the setup did not visit the unit whose row was entered (engine_bodies.rs
/// `groups`), a fault named (rule 3), read nothing, so owed and entered again.
pub(crate) const NO_CLAIM: &str = "its unit made no claim on its file though the plan's reach gives the unit this file (engine_bodies.rs `groups` did not visit the unit whose row was entered)";

/// The domain of the out of a body no unit holds.
const OUTSIDE_DOMAIN: &str = "blaze-cli engine bodies no unit's 1";

/// The domain of a plan note's block name ([`note_name`]).
const NOTE_DOMAIN: &str = "blaze-cli engine body plan file note 1";

/// The domain of a shared body's row source ([`source_at_views`]).
const VIEWS_DOMAIN: &str = "blaze-cli engine body rows at views 1";

/// The domain of a body's row source folded with its cumulative cfg-attribute chain
/// ([`source_with_cfg`]).
const CFG_SOURCE_DOMAIN: &str = "blaze-cli engine body row cfg 1";

/// Folds the cumulative cfg-attribute chain hash (file `#![cfg]`s + enclosing ancestors' `#[cfg]`s
/// + entry's own `#[cfg]`s) into a body's `source` so editing any enclosing `#[cfg]` moves the
/// body's task key directly without needing `Decision::Absent` to read `Section::Items` (rule 21).
pub(crate) fn source_with_cfg(source: ContentId, cfg: ContentId) -> ContentId {
    let mut h = blaze_ids::Hasher::new(CFG_SOURCE_DOMAIN);
    h.update(&source.0);
    h.update(&cfg.0);
    h.finish()
}

/// The source of each row of a body two units or more reach (D191): its text's source and every
/// such unit's view, in rank. A row's block names the units its body's rows are at
/// (engine_lines.rs `VIEW`, how a finding only some rows hold is printed), so they are inputs of
/// its key (rule 21): a unit that comes to reach the file, or leaves it, enters every row of its
/// bodies again, and a standing row's block never names a stale set. A body one unit reaches
/// keeps its text's source: its row and its output are as before D191.
pub(crate) fn source_at_views(source: ContentId, views: &[ViewKey]) -> ContentId {
    let mut h = blaze_ids::Hasher::new(VIEWS_DOMAIN);
    h.update(&source.0);
    for view in views.iter() {
        h.update(&view.0.0);
    }
    h.finish()
}

/// One unit of the crate list, as a decision reads it.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) struct Unit {
    /// Its `CrateScope` task's name.
    pub(crate) name: Name,
    /// The first 8 bytes of its crate key: whose cells a `NameCell` names.
    pub(crate) prefix: [u8; 8],
    /// Its cfg holds `test` (a test harness): ranked after every unit without.
    pub(crate) test: bool,
}

/// What one unit's records say of one file its module tree reaches.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum FileIs {
    /// Its items record lists the file, and the file's entries were read through its records.
    Held,
    /// Its items record lists no file at the path: a `cfg` on the `mod` cut it in this unit.
    NotHeld,
    /// The unit's records could not say (they did not open, its scope was cut, its file's text
    /// did not read): refused by name.
    Refused(&'static str),
}

/// One unit's word on one file, by the file's name: a claim is made without the file's outline
/// (a standing member's claims are its members record's, engine_members_record.rs), and a
/// decision asks the claims of its task's file by name ([`Holders::decide`]).
#[derive(Clone, Copy, Debug)]
pub(crate) struct FileClaim<'f> {
    /// The file's `FileItems` name.
    pub(crate) file: Name,
    pub(crate) unit: u32,
    pub(crate) is: FileIs,
    /// The cells its refusal is a function of (plan row A8), or, for a held file, those a body
    /// the records do not list is refused on.
    pub(crate) reads: &'f [CellId],
}

/// What one unit's records say of one body (an outline entry) of a file it holds.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum BodyIs {
    /// The records hold it: the unit can check it.
    Held,
    /// The records hold no body at the entry ([`ENTRY_ABSENT`]): not this unit's body.
    Absent,
    /// The records hold it but cannot give it a check, and why.
    Refused(&'static str),
}

impl BodyIs {
    /// A body's word from a refusal's words: [`ENTRY_ABSENT`] is no refusal.
    pub(crate) fn of_refusal(why: &'static str) -> BodyIs {
        if why == ENTRY_ABSENT { BodyIs::Absent } else { BodyIs::Refused(why) }
    }
}

/// One unit's word on one body; `took` is the caller's index of what it found for it.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) struct BodyClaim {
    pub(crate) name: Name,
    pub(crate) unit: u32,
    pub(crate) is: BodyIs,
    pub(crate) took: u32,
}

/// What one unit's row of one body is ([`Holders::decide`]).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum Decision {
    /// No member unit claimed its file (no unit's module tree reaches it).
    Unreached,
    /// The unit's records hold it: the unit checks it (`took`: its claim's index).
    Taken { took: u32, unit: u32 },
    /// The unit's records refused it, or refused its file.
    Refused { 
```

### Core Architecture Module: `crates/blaze-cli/src/engine_body_record.rs`
```
//! A BODY'S KEPT CODE, as a store record (run.md, section R, piece R4; RV3 job 4; D119).
//!
//! The Bodies stage leaves, beside each clean body's facts record (engine_body_facts.rs), its
//! checked generic body in blaze-body's flat form with the portable type table it indexes: the
//! bytes blaze-body kept.rs writes (front2 tables/task.rs `keep_checked` makes them). A run
//! builds a called instance from it (`blaze_body_build::build(kept.verified(), kept.tys(), ..)`)
//! and lowers nothing again. This file is the one home of the record's key, its put and its
//! reader (rule 30).
//!
//! THE KEY IS THE CODE'S, NOT THE VERDICT'S. [`key_of`] hashes the record's bytes under its own
//! form, so it covers every input of the value (rule 21: the body's rows, its table, the
//! lowering's facts as they shaped the rows), and two bodies with one clean verdict (`return 1`,
//! `return 2`) are two keys. The verdict cell (`VERDICT_CELL`) is unchanged: it is what the
//! facts record and the row carry; this key is a separate code input beside it.
//!
//! READ ONCE, IN PLACE. [`read`] takes the record where the store's mapping holds it
//! (`Held::place`, as engine_records.rs reads), checks that its bytes are the key's (a record
//! under another key is refused), and opens it with `blaze_body::kept::open`, whose [`Kept`]
//! carries the body's `Verified` proof: nothing reads it unchecked or checks it twice (rule 74).
//! A record put by this command and not committed yet is not in place, and is refused by name
//! (rule 3: never copied behind the reader's back).

use core::alloc::Allocator;
use core::fmt;

use blaze_body::{Kept, KeptError};
use blaze_drive::{Key, Name};
use bstd::cx::Cx;

use crate::CliError;
use crate::store::Store;

/// The form of a kept body's key: raised with `blaze_body::KEPT_VERSION` or the body's
/// `blaze_body::VERSION`, so a record of another form is never found under a new key.
const KEPT_FORM: &str = "blaze-cli engine kept body key 1";

/// The store key of the kept body record `bytes`: their hash under [`KEPT_FORM`], so equal
/// bytes meet under one key (rule 25) and other bytes never do (rule 21).
pub(crate) fn key_of(bytes: &[u8]) -> Key {
    let mut h = blaze_ids::Hasher::new(KEPT_FORM);
    h.update(&(bytes.len() as u64).to_le_bytes()).update(bytes);
    Key(h.finish())
}

/// Why body `body`'s kept record could not be put or read. Each names the body and the key
/// (rule 19) and says which check refused.
#[derive(Debug)]
pub(crate) enum BodyRecordError {
    /// The store refused the put or the get.
    Store { body: Name, key: Key, why: CliError },
    /// No record is at the key the body's facts name: the store lost a record its answer
    /// names, never a cue to lower the body again (rule 3).
    Missing { body: Name, key: Key },
    /// The record is this command's own put, not yet committed, or not aligned for a read in
    /// place.
    NotInPlace { body: Name, key: Key, why: blaze_cas::plain::NotInPlace },
    /// The bytes at `key` are not the bytes `key` names.
    WrongBytes { body: Name, key: Key, found: Key },
    /// The bytes are not a kept body (blaze-body kept.rs names which check).
    Kept { body: Name, key: Key, why: KeptError },
}

impl fmt::Display for BodyRecordError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BodyRecordError::Store { body, key, why } => write!(f, "{body:?}: its kept body {key:?} could not be put or read: {why} (rule: engine_body_record.rs)"),
            BodyRecordError::Missing { body, key } => write!(f, "{body:?}: its kept body {key:?} is not in the store (rule: engine_body_record.rs)"),
            BodyRecordError::NotInPlace { body, key, why } => write!(f, "{body:?}: its kept body {key:?} is not read in place: {why} (rule: engine_body_record.rs)"),
            BodyRecordError::WrongBytes { body, key, found } => write!(f, "{body:?}: the record at {key:?} is another body's ({found:?}) (rule 21)"),
            BodyRecordError::Kept { body, key, why } => write!(f, "{body:?}: the record at {key:?} is not a kept body: {why:?} (rule: blaze-body kept.rs)"),
        }
    }
}

/// Puts body `body`'s kept record `bytes` under [`key_of`] and files the key beside `owner`,
/// the body's facts record (engine_check.rs, the Bodies put), so a root that keeps the facts
/// keeps the code (store.rs `index_beside`). Equal bytes already held are left as they are.
/// The key, for the facts record to name.
pub(crate) fn put(cx: &Cx, store: &mut dyn Store<'_>, body: Name, owner: Key, bytes: &[u8]) -> Result<Key, BodyRecordError> {
    let key = key_of(bytes);
    let cx = cx.span("engine: a body's kept code put");
    store.put(&cx, key, bytes).map_err(|why| BodyRecordError::Store { body, key, why })?;
    store.index_beside(&cx, owner, &[key]).map_err(|why| BodyRecordError::Store { body, key, why })?;
    Ok(key)
}

/// Body `body`'s kept record at `key`, read in place and opened: its table decoded into
/// `alloc`, its body verified once ([`Kept::verified`]).
pub(crate) fn read<'m, A: Allocator + Copy>(cx: &Cx, store: &mut dyn Store<'m>, body: Name, key: Key, alloc: A) -> Result<Kept<'m, A>, BodyRecordError> {
    let cx = cx.span("engine: a body's kept code read");
    let held = store.get(&cx, key).map_err(|why| BodyRecordError::Store { body, key, why })?;
    let Some(held) = held else { return Err(BodyRecordError::Missing { body, key }) };
    let place = held.place.map_err(|why| BodyRecordError::NotInPlace { body, key, why })?;
    open(body, key, place.bytes(), alloc)
}

/// The kept body in `bytes`, found at `key`: refused when the bytes are not `key`'s, then
/// opened by blaze-body's one reader.
pub(crate) fn open<'b, A: Allocator + Copy>(body: Name, key: Key, bytes: &'b [u8], alloc: A) -> Result<Kept<'b, A>, BodyRecordError> {
    let found = key_of(bytes);
    if found != key {
        return Err(BodyRecordError::WrongBytes { body, key, found });
    }
    blaze_body::kept::open(bytes, alloc).map_err(|why| BodyRecordError::Kept { body, key, why })
}

// ---- THE TYPED RECORD: a body's checked columns (D163 part 2, D159 "one body record") ------
//
// What a run reads in place of checking a body again: blaze-typeck checked_record.rs's record
// of the body's clean `Checked` (`encode`, `decode`). THE KEY (rule 21, revised 2026-11-20):
// the record's OWN BYTES, hashed under [`TYPED_FORM`] ([`typed_key`]), so two values can never
// meet under one key. The first key, (the check's name, the row's `out`), missed an input: a
// clean body's `out` is its verdict's digest, which does not move when an edit adds an
// expression and leaves the verdict clean (`fn two() -> u8 { 2 }` to `{ let _ = 0u8; 2 }`),
// while the record's expression column does; the second command's put was refused with
// `TwoValues { differs_at: 24 }`, the record's `ExprTy` row count (blaze-cli tests, wave-1119
// t26). How a reader finds the key: the body's run facts record names it (engine_body_facts.rs
// `BodyFacts::typed`), and the facts record is keyed by its bytes (engine_check.rs, the Bodies
// put), so the facts record moves with the typed record and an unchanged one is found by its key.
//
// WHICH BODIES HAVE ONE (D197 root 1): every workspace root body whose types `check` found
// clean, whatever its borrows say (front2 tables/task.rs `keeps_typed`). A body of a kind with
// no record yet (a toolchain's or a dependency's body, a fn declared in a body, a body whose
// stalled goals were decided after its record) is the run's own check, named and counted by
// kind ([`StoreTyped`]'s `source`), never a refusal and never a second check of a body that
// has a record.

/// The form of a typed record's key: raised with blaze-typeck's `CHECKED_RECORD_MAGIC`, so a
/// record of another form is never found under a new key. Form 2: the key of the bytes (form 1
/// keyed (check, out), which missed the record's columns; see THE KEY above).
const TYPED_FORM: &str = "blaze-cli engine typed body key 2";

/// The store key of the typed record `bytes`: their length and every byte hashed under
/// [`TYPED_FORM`], so equal records meet under one key (rule 25) and other bytes never do (rule
/// 21). The put (engine_bodies.rs, the Bodies stage) calls it; a reader takes the key from the
/// body's run facts ([`StoreTyped`]).
pub(crate) fn typed_key(bytes: &[u8]) -> Key {
    let mut h = blaze_ids::Hasher::new(TYPED_FORM);
    h.update(&(bytes.len() as u64).to_le_bytes()).update(bytes);
    Key(h.finish())
}

/// Encodes a body's raw `Checked` record bytes through the selective `BZR1` fast-Zstd envelope
/// (`>= 4 KiB` and `< 85%` of raw size -> compressed; small/incompressible -> raw zero-copy) and
/// computes its content key [`typed_key`]. Deterministic across runs (rule 25).
#[allow(dead_code, reason = "called by Bodies stage workers to compress large TypedBody puts")]
pub(crate) fn prepare_typed_in<'a, A: Allocator + Copy>(
    raw: &'a [u8],
    alloc: A,
) -> Result<(Key, crate::store::record_codec::Encoded<'a, A>), crate::store::record_codec::RecordCodecError> {
    let encoded = crate::store::record_codec::encode_selective_in(raw, alloc)?;
    let key = typed_key(encoded.as_slice());
    Ok((key, encoded))
}

/// Why the store did not hand a body's typed record over: names the body's check and the key.
#[derive(Debug)]
pub(crate) enum TypedReadError {
    /// The command's store refused the get of `key` (its facts record or its typed record).
    Store { body: Name, key: Key, why: blaze_cas::plain::LentError },
    /// The read-only store snapshot refused the get of `key` on a code worker.
    Snapshot { body: Name, key: Key, why: blaze_cas::plain::SnapshotError },
    /// The body's run facts record, which names the typed record, did not read: what refused it.
    Facts { body: Name, what: &'static str },
    /// The facts name a typed record the store does not hold: a record lost, never a cue to
    /// check the body again (
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1637** (2026-11-04): **Image key names a source-root file outside the package directory by its absolute path, the image by a relative one**
  *Symptoms*: A dependency image's key and the image disagree on how they name a file of the crate's own source root that lies outside its package directory, so moving the package can break the build.  **Where** - `crates/hir-def/src/deps/key.rs`, `files`: hashes each file of the crate's source root by `Base::portable(path)`. A path under no `Base` marker (package directory, `OUT_DIR`, another absolute path a variable holds) is hashed as the absolute path it is. - `crates/hir-def/src/nameres/frozen.rs`, `Enc::file_name`: names the same file relative to its owner's directory, and `Dec::files` joins that name onto the directory of wherever the package is now.  **How it fails** - It needs a file in the crate's own source root outside its package directory (`Files::include_source` can put one there), and a package that moves while that file keeps its absolute path. - The key does not move (the file's absolute path and content are the same), so the image is served. `Dec::files` then joins the relative name onto the new directory and finds nothing: "not loaded", a hard error that fails the build. - It is loud, never a wrong program (rule 18 holds), so it was deferred from lane keypath (re-review finding K3, 2026-11-02).  **Fix** - One rule for both (rule 26): in `key::files`, hash a path that is under no `Base` marker the way `Enc::file_name` names it (relative to the package directory), or refuse such a file at store (`serve::refusal`) with a typed refusal naming the crate and the file (rule 16

- **Issue #1610** (2026-11-05): **crate key: cover the build-script runs a crate reads (release build-override splits a build.rs package reached from a build script and normal code)**
  *Symptoms*: **What:** a crate's key (`blaze_items::key::crate_key`, crates/blaze-items/src/key.rs) does not cover which build-script runs the crate reads. A release build can then stop on `CrateKeyClash` for a package that is reached both from a build script and from normal code.  **How it happens** (from reading the code, not reproduced yet): - Take a package with a `build.rs` that is used by a build script and by normal code, with the same features. Likely real cases: `libc` reached through `cc[parallel]` -> `jobserver`, or `serde` used by a build script. - Under `--release`, `blaze-manifest/src/profiles.rs:406-409` gives the for-host unit `opt-level = 0`. That is cargo's build-override default. - So there are two units, both `platform: None, macro_wasm: false`, each with its own `RunCustomBuild`. Their `env` (`OUT_DIR`) and their runs differ. - The lowering's dedupe (crates/blaze-lower/src/lib.rs, the `made` lookup: `it.env == env && it.runs == runs`) keeps them as two `Crate`s. - `crate_key` hashes neither the profile, the env nor the runs. `cfg` is equal: opt-level is not a cfg, and `debug_assertions`/`overflow_checks` are the same in release. `built_for` is the same too. - Two crates, one key: `check_crate_keys` refuses the build.  This is a loud refusal, not a silent misbuild, so rule 18 holds. It is still a build blaze cannot do, and cargo can.  **Fix:** make the key cover exactly what makes the lowering keep two crates apart. - Don't add the profile or more `BuiltFor` fields. Un

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

### Incident Patch 1: `4b2cbc1f` (2026-11-28)
**Commit Message**: fix(cli): thread c_probes and facts-only spawn_setting into wasm64 dep build scripts (#2793)

* fix(blaze-cli): thread c_probes and derived-fact spawn pins into wasm64 dep build scripts

Dependency build scripts executed during wasm64 proc-macro / build-script
self-compilation (`wasm64_compile::run_dep_build_script`, e.g. `ring 0.17.14`
under `sqlx-macros 0.9.0`) previously received `c_probes: None` and
`SpawnSetting::off()`, causing C compiler probes (`clang -E ...`) and
derived-fact version probes (`clang --version`) to be refused.

- Extract `scripts::open_c_probes` so normal `Script` tasks and wasm64
  dependency build scripts share the single `open_command_c_probes` / SDK
  identity helper (Rule 30).
- Add `c_probes` and `spawn_setting` fields to `CompileInputs` and lazily
  open them in `ScriptQueue::ensure_compile_inputs` via
  `DepScriptProbes::open` (zero overhead on warm `MacroModule` hits).
- Thread `DepScriptProbes` through all wasm64 self-compilation entry points
  into `run_dep_build_script`, enforcing strictly hermetic derived-fact pins
  (`hvbox_allowed = false`, empty `tools`, `userland = None`) via
  `dep_script_spawn_setting` and sharing `c_probes` via `dep_scrip

**File**: `crates/blaze-cli/src/engine_check.rs` (modified, +293/-18)
```diff
@@ -452,7 +452,7 @@ pub(crate) fn warm_toolchain(
         shown.quiet = true;
         let mut check_opts = opts();
         check_opts.fresh = fresh;
-        let checked = check_live(cx, fs, host, rng, Some(args), net, root, check_opts, &mut shown, phases, out, err, None, Some(&lazy_sdk), None, crate::store::StoreTeardown::Drop)?;
+        let checked = check_live(cx, fs, host, rng, Some(args), net, root, check_opts, &mut shown, phases, out, err, None, Some(&lazy_sdk), None, None, crate::store::StoreTeardown::Drop)?;
         let tc_hex = blaze_toolchain::PINNED.hex();
         out.line(
             cx,
@@ -508,7 +508,7 @@ fn serve(
                     let ran = crate::run_line::watched(cx, err, clock, line, |watch, bg| {
                         watch.see(blaze_screen::Step::Began(blaze_screen::Stage::Checking));
                         let live = line.live.then_some(bg);
-                        let res = check_live(cx, fs, host, rng, Some(args), net, root, opts(), &mut shown, phases, out, err, live, Some(&lazy_sdk), None, crate::store::StoreTeardown::ForgetForExit);
+                        let res = check_live(cx, fs, host, rng, Some(args), net, root, opts(), &mut shown, phases, out, err, live, Some(&lazy_sdk), None, None, crate::store::StoreTeardown::ForgetForExit);
                         watch.see(blaze_screen::Step::Says);
                         res
                     }).map_err(CliError::RunLine)??;
@@ -524,7 +524,7 @@ fn serve(
                     if selectors.is_empty() {
                         selectors.push("all");
                     }
-                    let mut ask = |mut shown| check_live(cx, fs, host, rng, Some(args), net, root, opts(), &mut shown, phases, out, err, None, Some(&lazy_sdk), None, crate::store::StoreTeardown::Drop).map(|checked| (checked, shown));
+                    let mut ask = |mut shown| check_live(cx, fs, host, rng, Some(args), net, root, opts(), &mut shown, phases, out, err, None, Some(&lazy_sdk), None, None, crate::store::StoreTeardown::Drop).map(|checked| (checked, shown));
                     match crate::fix_then_check::<crate::fix::Atomic, Checked>(cx, root, &selectors, (caps, view, shown_root), frame, out, &mut ask)? {
                         crate::Fixed::Refused => None,
                         crate::Fixed::Checked(checked, _) => Some(checked),
@@ -923,9 +923,50 @@ pub(crate) struct Standing<'r, 'm> {
     /// already-opened `~/.blaze` directory so pure-Rust starts pay 0 ms for SDK probing.
     sdk_resolver: &'r dyn Fn(&Cx, Option<&Dir<ReadWrite>>, u64) -> Result<blaze_apple_sdk::Sdk<'r>, blaze_apple_sdk::SdkRefused<'r>>,
     home_dir: Option<&'r Dir<ReadWrite>>,
+    /// Check-time command probes (`SharedCommandProbes`) carried into start-time proc-macro
+    /// runners (`RunProcs`) so `run`/`test`/`export` reuse the exact probe/pin snapshot that
+    /// keyed and produced the `MacroModule` records.
+    probes: &'r crate::scripts::SharedCommandProbes,
+}
+
+/// Borrowed lazy macOS SDK handle handed to start-time proc-macro runners (`RunProcs`) so
+/// `run`/`test`/`export` resolve the exact same SDK identity snapshot as `check` on first
+/// proc-macro demand (0 ms cost on pure-Rust starts) without borrowing `Standing::store`.
+#[derive(Clone, Copy)]
+pub(crate) struct RunSdk<'r> {
+    place_sdk: Result<blaze_apple_sdk::Sdk<'r>, blaze_apple_sdk::SdkRefused<'r>>,
+    resolver: &'r dyn Fn(&Cx, Option<&Dir<ReadWrite>>, u64) -> Result<blaze_apple_sdk::Sdk<'r>, blaze_apple_sdk::SdkRefused<'r>>,
+    home_dir: Option<&'r Dir<ReadWrite>>,
+    wall_ns: u64,
+}
+
+impl<'r> RunSdk<'r> {
+    pub(crate) fn resolve(&self, cx: &Cx) -> Result<blaze_apple_sdk::Sdk<'r>, blaze_apple_sdk::SdkRefused<'r>> {
+        if self.place_sdk.is_ok() {
+            return self.place_sdk;
+        }
+        (self.resolver)(cx, self.home_dir, self.wall_ns)
+    }
 }
 
 impl<'r, 'm> Standing<'r, 'm> {
+    /// Returns a `Copy` lazy SDK handle borrowing only immutable fields of `Standing` so
+    /// start-time `RunProcs` can resolve the exact same macOS SDK snapshot as `check`.
+    pub(crate) fn sdk_for_procs(&self) -> RunSdk<'r> {
+        RunSdk {
+            place_sdk: self.place.sdk,
+            resolver: self.sdk_resolver,
+            home_dir: self.home_dir,
+            wall_ns: self.lent.wall_ns(),
+        }
+    }
+
+    /// Returns the check-time command probe holder (`SharedCommandProbes`) so start-time
+    /// `RunProcs` reuse the exact spawn-pin, C-probe, and probe-identity snapshot from `check`.
+    pub(crate) fn probes_for_procs(&self) -> &'r crate::scripts::SharedCommandProbes {
+        self.probes
+    }
+
     /// Resolves the macOS SDK lazily on first demand (at most once per command via `OnceCell`),
     /// reusing the already-opened `~/.blaze` home directory and caching the result into
     /// `self.place.sdk`.
@@ -1647,6 +1688,7 @@ fn preserve_standing_sibling_names<'a, 'f, 's, 'r>(
     last_lines: Option<&crate::engine_lines::L
```

**File**: `crates/blaze-cli/src/engine_export.rs` (modified, +3/-1)
```diff
@@ -3540,7 +3540,9 @@ fn export_program<'f>(
     let lent = standing.lent;
     let typed = crate::engine_body_record::TypedFrom { cx, lent, records: standing.records(), alloc: heap.alloc() };
     let env = &facts.fetch_env;
-    let inputs = RunProcs { cx, root, snapshot: found.snapshot(), graph: standing.graph, env, frame };
+    let sdk = standing.sdk_for_procs();
+    let probes = standing.probes_for_procs();
+    let inputs = RunProcs { cx, root, snapshot: found.snapshot(), graph: standing.graph, env, sdk, probes, frame };
     let maker_procs = crate::job_texts::MadeOnce::new(|| inputs.make());
     let procs = crate::job_texts::Procs::ByNeed(&maker_procs);
 
```

**File**: `crates/blaze-cli/src/engine_names.rs` (modified, +5/-4)
```diff
@@ -284,6 +284,7 @@ pub(crate) struct Handles<'h, 'f> {
     pub(crate) members: Option<&'h [crate::graph::CheckoutDir]>,
     pub(crate) env: &'h FetchEnv<'h>,
     pub(crate) producers: blaze_ids::producer::Producers,
+    pub(crate) probes: crate::scripts::CommandProbes<'h>,
     pub(crate) side: Option<&'h crate::proc_runner::MacroSide<'h, 'h, 'h>>,
     pub(crate) outlined: &'h [Outlined<'h>],
     pub(crate) workers: core::num::NonZeroU32,
@@ -698,7 +699,7 @@ impl<'f> NamesStage<'f> {
             Ok(made) => made,
             Err(why) => return Err(EngineCheckError::NamesWorld(why).into()),
         };
-        let runner = Self::runner(names, made, handles, frame);
+        let runner = Self::runner(&cx, names, made, handles, frame);
         let world = made.world();
         let crates = world.crates.as_slice();
         let all = world.sysroot;
@@ -927,12 +928,12 @@ impl<'f> NamesStage<'f> {
         Ok(())
     }
 
-    fn runner(names: &Names<'f>, made: &crate::names::NamesWorld<'_>, handles: &Handles<'_, 'f>, frame: &'f Frame) -> Result<Option<&'static crate::proc_runner::ProcRunner<'static>>, &'f str> {
+    fn runner(cx: &Cx, names: &Names<'f>, made: &crate::names::NamesWorld<'_>, handles: &Handles<'_, 'f>, frame: &'f Frame) -> Result<Option<&'static crate::proc_runner::ProcRunner<'static>>, &'f str> {
         if !made.world().crates.iter().any(|c| c.input.implicit.proc_macro) {
             return Ok(None);
         }
         match (names.procs(), handles.side) {
-            (None, Some(side)) => match crate::proc_runner::make(made, *names.list(), side) {
+            (None, Some(side)) => match crate::proc_runner::make(cx, made, *names.list(), side) {
                 Ok(runner) => {
                     names.set_procs(runner);
                     Ok(Some(runner))
@@ -1696,7 +1697,7 @@ impl<'j, 'a: 'j> NamesQueue<'j, 'a> {
             Ok(made) => made,
             Err(why) => return Err(EngineCheckError::NamesWorld(why).into()),
         };
-        let runner = NamesStage::runner(names, made, handles, frame);
+        let runner = NamesStage::runner(cx, names, made, handles, frame);
         let world = made.world();
         let at = names.crate_at(name.subject).ok_or(EngineCheckError::MissingEntry { task: name, table: Table::WorldCrates, key: name })?;
         let columns = *self.columns.get_or_insert_with(|| WorldColumns {
```

**File**: `crates/blaze-cli/src/engine_script_reads.rs` (modified, +2/-1)
```diff
@@ -123,7 +123,8 @@ impl ReadKind {
             | LeafKind::HomeListing
             | LeafKind::MacroFiles
             | LeafKind::MacroFile
-            | LeafKind::MacroFolder => None,
+            | LeafKind::MacroFolder
+            | LeafKind::DepProbes => None,
         }
     }
 
```

**File**: `crates/blaze-cli/src/engine_scripts.rs` (modified, +543/-5)
```diff
@@ -394,6 +394,7 @@ impl<'s> ScriptQueue<'s> {
             members: members.into_bump_slice(),
             producers: handles.producers,
             heap: handles.env.heap,
+            probes: Some(handles.probes),
         };
         self.compile_inputs = Some(built);
         Ok(self.compile_inputs)
@@ -524,6 +525,13 @@ pub(crate) struct ScriptsStage<'f> {
     /// The graph's proc-macro crates with their identities, listed once before dispatching
     /// proc-macro lookups so every lookup and wasm64 self-compile runs concurrently.
     macros: Option<std::sync::Arc<crate::macros::MacroCrates>>,
+    /// Planned dependency-probe identities bound during `plan_dep_probe_tags`:
+    /// - `planned_macro_probes` is keyed by exact `UnitId` for `macros::list` so duplicate
+    ///   proc-macro subjects (distinct feature sets or host-feature sides) each validate against
+    ///   their own unit's planned probe state rather than colliding by subject.
+    /// - `planned_script_probes` is keyed by `MacroModule` subject for build scripts.
+    planned_macro_probes: Vec<(blaze_unit_graph::UnitId, PlannedProbe), &'f Frame>,
+    planned_script_probes: Vec<(ContentId, PlannedProbe), &'f Frame>,
     /// Each planned task's reads, by name, sorted: what its plan hands it.
     reads: Vec<(Name, Vec<Name, &'f Frame>), &'f Frame>,
     runs: Vec<RunPlan<'f>, &'f Frame>,
@@ -648,12 +656,458 @@ pub(crate) fn with_runner<R>(runner: &'static dyn ScriptRunner, work: impl FnOnc
     work()
 }
 
+/// Planned dependency-probe state frozen for one `MacroModule` task during planning, so lookup
+/// and on-miss compilation bind strictly to the planned digest (or report the planned refusal)
+/// instead of silently filing a drifted live result under the planned task key (Rule 21).
+pub(crate) enum PlannedProbe {
+    Digest(crate::wasm64_compile::Hex64),
+    Failed(crate::scripts::ProbeSetupError),
+}
+
+impl PlannedProbe {
+    pub(crate) fn source_hex(&self) -> crate::wasm64_compile::Hex64 {
+        match self {
+            PlannedProbe::Digest(hex) => *hex,
+            PlannedProbe::Failed(err) => crate::wasm64_compile::probe_error_hex(err.kind),
+        }
+    }
+}
+
+/// Sorted `(subject, PlannedProbe)` and per-unit `(UnitId, PlannedProbe)` tables emitted by
+/// [`plan_dep_probe_tags`].
+pub(crate) struct PlannedDepProbes<'f> {
+    /// Per-subject aggregated probe tags for `MacroModule` task keying & ready-wake validation.
+    pub(crate) proc_macros: Vec<(ContentId, PlannedProbe), &'f Frame>,
+    /// Per-unit exact probe tags for `macros::list` (distinguishes duplicate proc-macro subjects
+    /// with distinct feature sets or host-feature sides).
+    pub(crate) proc_macro_units: Vec<(blaze_unit_graph::UnitId, PlannedProbe), &'f Frame>,
+    pub(crate) script_modules: Vec<(ContentId, PlannedProbe), &'f Frame>,
+}
+
+impl<'f> PlannedDepProbes<'f> {
+    pub(crate) fn empty(frame: &'f Frame) -> Self {
+        Self {
+            proc_macros: Vec::new_in(frame),
+            proc_macro_units: Vec::new_in(frame),
+            script_modules: Vec::new_in(frame),
+        }
+    }
+
+    /// Returns the verified 64-hex probe identity when this command planned at least one
+    /// probe-dependent `MacroModule` with a live digest (excluding `PlannedProbe::Failed`),
+    /// or `None` when no unit has a verified dependency-probe digest.
+    pub(crate) fn digest(&self) -> Option<crate::wasm64_compile::Hex64> {
+        for (_, entry) in self.proc_macros.iter().chain(self.script_modules.iter()) {
+            if let PlannedProbe::Digest(hex) = entry {
+                return Some(*hex);
+            }
+        }
+        None
+    }
+
+    /// Returns the 32-byte probe identity recorded as a `LeafKind::DepProbes` certificate leaf
+    /// when this command planned at least one probe-dependent `MacroModule`, or `None` when no
+    /// unit in the workspace has dependency build scripts (zero overhead on unrelated workspaces).
+    pub(crate) fn leaf_id(&self) -> Option<ContentId> {
+        if let Some(hex) = self.digest() {
+            return Some(hex.to_content_id());
+        }
+        self.proc_macros
+            .first()
+            .or_else(|| self.script_modules.first())
+            .map(|(_, entry)| entry.source_hex().to_content_id())
+    }
+}
+
+pub(crate) struct ScopedModuleSets<'f> {
+    pub(crate) script_modules: Vec<ContentId, &'f Frame>,
+    pub(crate) macro_modules: Vec<ContentId, &'f Frame>,
+}
+
+fn scoped_module_sets<'f>(
+    world: &crate::names::Names<'_>,
+    scoped: &crate::engine_check::ScopedUnits,
+    frame: &'f Frame,
+) -> ScopedModuleSets<'f> {
+    use blaze_world::crate_list::CrateGraph as _;
+    let list = world.list();
+    let mut allowed_scripts: Vec<Name, &'f Frame> = Vec::new_in(frame);
+    let mut stack: Vec<Name, &'f Frame> = Vec::new_in(frame);
+    let mut script_modules: Vec<ContentId, &'f Frame> = Vec::new_in(frame);
+    let mut macro_modules: Vec<ContentId, &'f Fram
```

**File**: `crates/blaze-cli/src/engine_start.rs` (modified, +21/-4)
```diff
@@ -147,6 +147,13 @@ pub(crate) struct RunProcs<'n, 'e> {
     /// The answer's `UnitGraph` row (`Standing::graph`).
     pub(crate) graph: blaze_drive::Input,
     pub(crate) env: &'n crate::fetch::FetchEnv<'e>,
+    /// Lazy macOS SDK handle sharing `Standing`'s `OnceCell` resolver so proc-macro dep-probe
+    /// keys match `check` on macOS (0 ms cost when no proc-macro call occurs).
+    pub(crate) sdk: crate::engine_check::RunSdk<'e>,
+    /// Shared command-level C-probe / spawn-pin holder from `check` (`Standing::probes_for_procs`)
+    /// so start-time proc-macro runners reuse the exact probe snapshot that keyed and produced
+    /// the `MacroModule` records.
+    pub(crate) probes: &'e crate::scripts::SharedCommandProbes,
     pub(crate) frame: &'n bstd::mem::Frame,
 }
 
@@ -189,8 +196,14 @@ impl<'n> RunProcs<'n, '_> {
             crate::units::emit_proc_macro_lock_files(cx, self.root, &stamps, proc_macros, lockfile.lock, checkout_dirs, None, &mut rows, frame)
                 .map_err(|error| said(format_args!("no proc-macro runner: macro files: {error}")))?;
         }
-        let side = crate::proc_runner::MacroSide { lock: lockfile, place: crate::macros::Place { home: env.home, checkout: env.checkout, members, rows: &rows }, heap: env.heap };
-        crate::proc_runner::make(world, *names.list(), &side).map_err(|error| said(format_args!("no proc-macro runner: {error} (proc_runner.rs `make`)")))
+        let resolved_sdk = self.sdk.resolve(cx);
+        let side = crate::proc_runner::MacroSide {
+            lock: lockfile,
+            place: crate::macros::Place { home: env.home, checkout: env.checkout, members, rows: &rows },
+            probes: self.probes.with_env(env).with_sdk(resolved_sdk).with_checked_snapshot(),
+            heap: env.heap,
+        };
+        crate::proc_runner::make(cx, world, *names.list(), &side).map_err(|error| said(format_args!("no proc-macro runner: {error} (proc_runner.rs `make`)")))
     }
 }
 
@@ -1211,7 +1224,9 @@ fn run_program_with(
     let typed = crate::engine_body_record::TypedFrom { cx, lent, records: standing.records(), alloc: heap.alloc() };
     let env = &facts.fetch_env;
     // The runner, made at a body's first proc-macro call ([`RunProcs`]; C9).
-    let inputs = RunProcs { cx, root, snapshot: found.snapshot(), graph: standing.graph, env, frame };
+    let sdk = standing.sdk_for_procs();
+    let probes = standing.probes_for_procs();
+    let inputs = RunProcs { cx, root, snapshot: found.snapshot(), graph: standing.graph, env, sdk, probes, frame };
     let maker = crate::job_texts::MadeOnce::new(|| inputs.make());
     let procs = crate::job_texts::Procs::ByNeed(&maker);
     let scope_records = crate::front_load::ScopeRecords::new(found.snapshot(), blaze_world::crate_list::CrateGraph::len(list), heap);
@@ -1591,7 +1606,9 @@ pub(crate) fn run_tests_status(
                 }
                 // One runner for every dirty suite, made at the first proc-macro call any body meets
                 // ([`RunProcs`]; C9). Before `runnable` and `bin_suites`, whose names records borrow it.
-                let inputs = inventory.suites.first().map(|(found, _)| RunProcs { cx, root, snapshot: found.snapshot(), graph: standing.graph, env: &facts.fetch_env, frame });
+                let sdk = standing.sdk_for_procs();
+                let probes = standing.probes_for_procs();
+                let inputs = inventory.suites.first().map(|(found, _)| RunProcs { cx, root, snapshot: found.snapshot(), graph: standing.graph, env: &facts.fetch_env, sdk, probes, frame });
                 let maker = crate::job_texts::MadeOnce::new(|| match &inputs {
                     Some(inputs) => inputs.make(),
                     None => Err("no proc-macro runner: this command has no test suite (engine_start.rs `run_tests`)"),
```

**File**: `crates/blaze-cli/src/journal_sweep.rs` (modified, +3/-3)
```diff
@@ -1052,7 +1052,7 @@ impl<'t> Taken<'t> {
             }
             let part = match row.kind {
                 // No stream replays the home (the module's rule): its listings, on every request.
-                LeafKind::HomeListing => &mut parts.home,
+                LeafKind::HomeListing | LeafKind::DepProbes => &mut parts.home,
                 LeafKind::ScriptGit => &mut parts.git,
                 _ if script_asks && !fact_file => &mut parts.scripts,
                 kind => match unit_of(&views, kind, path) {
@@ -1283,8 +1283,8 @@ impl<'a> Index<'a> {
             // move only with the path or a folder above it; a listing with any entry of it.
             LeafKind::ScriptFile if rel.starts_with(sweep::FACT_MOUNT) => true,
             LeafKind::ScriptFile | LeafKind::ScriptStat => self.touched(rel, plant),
-            // A git fact is read from `.git` files the journal may not see: always followed.
-            LeafKind::ScriptGit => true,
+            // A git fact or host dependency-probe identity lives outside checkout file events: always followed.
+            LeafKind::ScriptGit | LeafKind::DepProbes => true,
             LeafKind::ScriptListing => self.touched(rel, plant) || self.children_of(rel).next().is_some(),
             // Decided by its files' and folders' rows (macro_files.rs `proven`).
             LeafKind::MacroFiles => false,
```

**File**: `crates/blaze-cli/src/macros.rs` (modified, +161/-14)
```diff
@@ -66,9 +66,24 @@ const RULE: &str = "macros.rs";
 /// when the listing moves and never before.
 pub(crate) const MODULE_LISTING: &str = "v2/proc-macro/modules";
 
+/// One resolved proc-macro crate identity plus the frozen dependency-probe identity digest
+/// folded into it (when its `wasm64-blaze-wasip1` closure runs dependency build scripts), so
+/// on-miss self-compilation can revalidate the live answerer before publishing.
+pub struct ListedMacro {
+    pub(crate) identity: MacroIdentity,
+    pub(crate) dep_probes: Option<crate::wasm64_compile::Hex64>,
+}
+
+/// Per-macro identity or probe-setup refusal kept on that crate alone so one dependent
+/// proc-macro's probe failure never aborts unrelated proc-macros in `macros::list` (Rule 20).
+pub enum MacroListFailure {
+    Unidentified(Unidentified),
+    Probes(crate::scripts::ProbeSetupError),
+}
+
 /// The macro crates of this command's graph, each with its module identity or why it has
 /// none: made once a command, at the first `MacroModule` task that runs.
-pub type MacroCrates = std::vec::Vec<(ContentId, Result<MacroIdentity, Unidentified>), Global>;
+pub type MacroCrates = std::vec::Vec<(ContentId, Result<ListedMacro, MacroListFailure>), Global>;
 
 /// Where a command's macro crates are: the home (the module store is under it), the checkout
 /// relative to where blaze was started ("" for there: `FetchEnv::checkout`), each workspace
@@ -164,6 +179,25 @@ pub(crate) fn part_source_with_files(graph_source: ContentId, macro_files_digest
     ContentId::of(SOURCE_DOMAIN, &source)
 }
 
+/// Mixes the dependency build-script probe/pin digest (`probes_hex`) into a proc-macro
+/// `MacroModule` task source so derived-fact pin or live C-probe answerer changes invalidate
+/// the `MacroModule` task itself (rules 21 and 60).
+pub(crate) fn part_source_with_dep_probes(source: ContentId, probes_hex: &str) -> ContentId {
+    let mut buf = [0u8; 97];
+    if let Some(dst) = buf.get_mut(..32) {
+        dst.copy_from_slice(&source.0);
+    }
+    if let Some(tag) = buf.get_mut(32) {
+        *tag = b'P';
+    }
+    let bytes = probes_hex.as_bytes();
+    let take = bytes.len().min(64);
+    if let (Some(dst), Some(src)) = (buf.get_mut(33..33 + take), bytes.get(..take)) {
+        dst.copy_from_slice(src);
+    }
+    ContentId::of(SOURCE_DOMAIN, &buf)
+}
+
 /// Why the macro crates of a command could not be listed.
 #[derive(Debug)]
 pub enum MacrosError {
@@ -173,6 +207,8 @@ pub enum MacrosError {
     NoLock,
     /// The module store could not be listed, or a path crate's files read.
     Procs(blaze_world::procs::ProcsError),
+    /// The command's derived-fact pin setting for dependency build scripts could not be opened.
+    Probes(crate::scripts::ProbeSetupError),
 }
 
 impl core::fmt::Display for MacrosError {
@@ -181,35 +217,134 @@ impl core::fmt::Display for MacrosError {
             MacrosError::Graph(refused) => write!(f, "the unit graph record at byte {}: {}", refused.at, refused.why),
             MacrosError::NoLock => f.write_str("no lock was read this command"),
             MacrosError::Procs(error) => write!(f, "{error}"),
+            MacrosError::Probes(error) => write!(f, "{error}"),
         }
     }
 }
 
 /// Every macro crate of the graph `sections` with its identity, over `lock`, the module
 /// store `modules` (its git folders) and `place` (a member's folder). When `sections.wasm_graph`
 /// is present, folds each proc-macro's resolved `wasm64-blaze-wasip1` dependency closure features
-/// into its module identity (rule 21). The decoded graph is the task's scratch, made over `scratch`.
-pub(crate) fn list(sections: crate::graph_payload::Sections<'_>, lock: &crate::fetch::Lockfile<'_>, modules: &std::path::Path, place: &Place<'_, '_>, scratch: Alloc<'_>) -> Result<MacroCrates, MacrosError> {
+/// into its module identity (rule 21), and when its closure runs dependency build scripts folds
+/// `probes`'s deterministic probe/pin identity digest as well. The decoded graph is the task's
+/// scratch, made over `scratch`.
+pub(crate) fn list(
+    cx: &Cx,
+    sections: crate::graph_payload::Sections<'_>,
+    lock: &crate::fetch::Lockfile<'_>,
+    modules: &std::path::Path,
+    place: &Place<'_, '_>,
+    probes: Option<crate::scripts::CommandProbes<'_>>,
+    planned_probes: Option<&[(blaze_unit_graph::UnitId, crate::engine_scripts::PlannedProbe)]>,
+    scratch: Alloc<'_>,
+) -> Result<MacroCrates, MacrosError> {
     let decoded = blaze_unit_graph::record::decode(sections.graph, scratch).map_err(MacrosError::Graph)?;
     let wasm_decoded = if sections.wasm_graph.is_empty() {
         None
     } else {
         Some(blaze_unit_graph::record::decode(sections.wasm_graph, scratch).map_err(MacrosError::Graph)?)
     };
+    let wasm_graph = wasm_decoded.as_ref().map(|d| &d.graph);
     let locked = LockedPackages::of(lock.lock);
     let folders = git_folders(modules).map_err(MacrosError::Procs)?;
     let mut crates = std::vec:
```

---

### Incident Patch 2: `42235276` (2026-11-27)
**Commit Message**: gate: clear concurrent PR regressions to hit 42/42 pass with zero upward ratchet bumps

- blaze-shell (from #2825):
  - layout.rs: take Alloc<'a> -> blaze_own::AVec in split_git_tree_path, git_status_tree_rows, and push_git_tree_level (allocs signatures 244 -> 241), and replace HoverKind::FileEntry name clone with to_owned (clones 309 -> 308).
- bgit (from #2825):
  - fsmonitor.rs: use Default::default() for the empty BTreeSet arm in record_status_baseline (vec_box 363 -> 362).
- blaze-manifest (from #2826):
  - layout/tests.rs: compare member and path_package iterators directly without std::vec::Vec or std::println! (tests std 101 -> 98, vec_box 166 -> 164).
- blaze-unit-graph (from #2826):
  - resolve.rs: use package.deps.get(e) (stops 72 -> 71) and own(..., self.alloc) instead of .clone() for PathOutsideAnchor fields (clones 55 -> 52).
  - tests.rs: drop std::println! in a_path_dependency_outside_the_anchor_is_named_when_reached (tests std 16 -> 15).
- blaze-ladder (from #2804):
  - lifetimes.rs: rewrite Eliding::quiet_all_bound and Eliding::record_all_inputs to explicit bounded worklists (QuietWork, RecordInputWork) instead of recursive TypeRef::For calls.
  - types.rs: rewrite

**File**: `crates/bgit/src/fsmonitor.rs` (modified, +1/-1)
```diff
@@ -948,7 +948,7 @@ pub(crate) fn record_status_baseline(
     // new baseline is not trusted and the next status scans fully.
     let (concurrent_pending, needs_full) = match (&mon.status_baseline, start_gen) {
         (Some(prev), Some(g)) if mon.generation != g => (prev.pending_paths.clone(), prev.needs_full),
-        (None, Some(g)) if mon.generation != g => (BTreeSet::new(), true),
+        (None, Some(g)) if mon.generation != g => (Default::default(), true),
         _ => (BTreeSet::new(), false),
     };
     mon.status_baseline = Some(StatusBaseline {
```

**File**: `crates/blaze-ladder/src/front2/lifetimes.rs` (modified, +96/-42)
```diff
@@ -893,50 +893,71 @@ impl<'c, 'n, S: NamesSource<'n>> Reader<'c, 'n, S> {
     /// [`Self::quiet_all`] carrying `bound` lifetime hashes from enclosing `for<..>` binders so
     /// bound lifetimes nested inside type arguments (e.g. `for<'a> Tr<&'a u8>`) are recognized as
     /// bound rather than free input lifetimes.
-    fn quiet_all_bound(&mut self, v: &View<'_>, bound: &[u64], mut todo: List<lf::TypeId>, alias_depth: u8) -> Result<bool, LifeRefusal> {
+    fn quiet_all_bound(&mut self, v: &View<'_>, bound: &[u64], todo: List<lf::TypeId>, alias_depth: u8) -> Result<bool, LifeRefusal> {
+        let mut bound_stack: List<u64> = Vec::with_capacity_in(bound.len(), self.alloc);
+        bound_stack.extend_from_slice(bound);
+        let mut work: List<QuietWork> = Vec::with_capacity_in(todo.len(), self.alloc);
+        for &t in todo.iter() {
+            work.push(QuietWork::Ty(t));
+        }
+        let mut sub_todo: List<lf::TypeId> = Vec::new_in(self.alloc);
+        let mut cur_depth = alias_depth;
         let mut steps = 0u32;
-        while let Some(t) = todo.pop() {
+        while let Some(item) = work.pop() {
+            let t = match item {
+                QuietWork::PopBound { prev_len, prev_depth } => {
+                    bound_stack.truncate(prev_len);
+                    cur_depth = prev_depth;
+                    continue;
+                }
+                QuietWork::Ty(t) => t,
+            };
             steps += 1;
             if steps > MOST {
                 return Err(LifeRefusal::Bound);
             }
             match v.ty(t)? {
                 lf::TypeRef::Never | lf::TypeRef::Infer => {}
-                lf::TypeRef::Ref { lifetime: Some(nm), inner, .. } if bound.contains(&v.name(nm)?) => {
-                    todo.push(inner);
+                lf::TypeRef::Ref { lifetime: Some(nm), inner, .. } if bound_stack.contains(&v.name(nm)?) => {
+                    work.push(QuietWork::Ty(inner));
                 }
-                lf::TypeRef::Ptr { inner, .. } | lf::TypeRef::Slice(inner) => todo.push(inner),
-                lf::TypeRef::Array { elem, .. } => todo.push(elem),
-                lf::TypeRef::Pat { base, .. } => todo.push(base),
+                lf::TypeRef::Ptr { inner, .. } | lf::TypeRef::Slice(inner) => work.push(QuietWork::Ty(inner)),
+                lf::TypeRef::Array { elem, .. } => work.push(QuietWork::Ty(elem)),
+                lf::TypeRef::Pat { base, .. } => work.push(QuietWork::Ty(base)),
                 lf::TypeRef::Tuple(l) | lf::TypeRef::Union(l) => {
                     for &i in v.ids(l)? {
-                        todo.push(lf::TypeId(i));
+                        work.push(QuietWork::Ty(lf::TypeId(i)));
                     }
                 }
                 lf::TypeRef::Path(p) => {
-                    if !self.quiet_path_bound(v, p, bound, &mut todo, alias_depth)? {
+                    sub_todo.clear();
+                    if !self.quiet_path_bound(v, p, &bound_stack, &mut sub_todo, cur_depth)? {
                         return Ok(false);
                     }
+                    for &st in sub_todo.iter() {
+                        work.push(QuietWork::Ty(st));
+                    }
                 }
                 lf::TypeRef::Dyn(b) | lf::TypeRef::Impl(b) => {
-                    if !self.quiet_bounds_bound(v, b, false, bound, &mut todo, alias_depth)? {
+                    sub_todo.clear();
+                    if !self.quiet_bounds_bound(v, b, false, &bound_stack, &mut sub_todo, cur_depth)? {
                         return Ok(false);
                     }
+                    for &st in sub_todo.iter() {
+                        work.push(QuietWork::Ty(st));
+                    }
                 }
-                lf::TypeRef::For { binder, inner } if alias_depth < 8 => {
-                    let binder_rows = v.rows(binder)?;
-                    let mut nested: List<u64> = Vec::with_capacity_in(bound.len() + binder_rows.len(), self.alloc);
-                    nested.extend_from_slice(bound);
-                    for &brow in binder_rows {
+                lf::TypeRef::For { binder, inner } if cur_depth < 8 => {
+                    let prev_len = bound_stack.len();
+                    let prev_depth = cur_depth;
+                    for &brow in v.rows(binder)? {
                         if let lf::GenericParam::Lifetime { name, .. } = lf::GenericParam::decode(brow)? {
-                            nested.push(v.name(name)?);
+                            bound_stack.push(v.name(name)?);
                         }
                     }
-                    let mut sub: List<lf::TypeId> = Vec::new_in(self.alloc);
-                    sub.push(inner);
-                    if !self.quiet_all_bound(v, &nested, sub, alias_depth + 1)? {
-                        return Ok(false);
-                    }
+                    cur_depth = cur_depth.saturating_add(1);
+                    work.push(QuietWork::PopBound {
```

**File**: `crates/blaze-ladder/src/front2/types.rs` (modified, +141/-73)
```diff
@@ -1294,23 +1294,23 @@ impl<'b, 'n, H: Heads, S: NamesSource<'n>> Builder<'b, H, S> {
             if s.parenthesized {
                 for &n in v.rows(s.args)? {
                     if let lf::GenericArg::Type(_) = lf::GenericArg::decode(n)? {
-                        out.push(next.next().ok_or(program(format!("a type argument is missing"), r))?);
+                        out.push(next.next().ok_or_else(|| Why::Program("a type argument is missing".into(), r))?);
                     }
                 }
                 if s.ty.is_some() {
-                    out.push(next.next().ok_or(program(format!("a type argument is missing"), r))?);
+                    out.push(next.next().ok_or_else(|| Why::Program("a type argument is missing".into(), r))?);
                 }
                 return Ok(());
             }
             let mut index = 0u32;
             for &n in v.rows(s.args)? {
                 let made = match lf::GenericArg::decode(n)? {
                     lf::GenericArg::Type(t) => match bare_name(v, t)? {
-                        None => next.next().ok_or(program(format!("a type argument is missing"), r))?,
+                        None => next.next().ok_or_else(|| Why::Program("a type argument is missing".into(), r))?,
                         Some(name) => {
                             let param = env.params.iter().find(|(n, _)| *n == Name::of(name)).map(|&(_, i)| i);
                             let is_const = param.is_some_and(|i| env.consts.iter().any(|(c, _)| *c == i));
-                            let lf::TypeRef::Path(tp) = v.ty(t)? else { return Err(program(format!("a one-name argument that is no path"), r)) };
+                            let lf::TypeRef::Path(tp) = v.ty(t)? else { return Err(Why::Program("a one-name argument that is no path".into(), r)) };
                             let ar = place(v, v.type_range(t))?;
                             let allow_bare_trait = self.allows_bare_trait_object_at(env, v, tp, ar)?;
                             // An item the body declares takes part as in a body path's own
@@ -1384,7 +1384,7 @@ impl<'b, 'n, H: Heads, S: NamesSource<'n>> Builder<'b, H, S> {
                         self.const_term(tys, env, text, ar, &want)?
                     }
                     lf::GenericArg::AssocType { args, .. } if args.len == 0 => {
-                        let made = next.next().ok_or(program(format!("a type argument is missing"), r))?;
+                        let made = next.next().ok_or_else(|| Why::Program("a type argument is missing".into(), r))?;
                         out.push(made);
                         continue;
                     }
@@ -1873,7 +1873,8 @@ impl<'b, 'n, H: Heads, S: NamesSource<'n>> Builder<'b, H, S> {
             if self.allows_bare_trait_object_at(env, v, p, r)? {
                 return self.bare_dyn_ty(tys, v, p, segs, found.key, found.kind == Kind::TraitAlias, kids, r);
             }
-            return Err(program(format!("`{shown}` is not a type (trait objects without `dyn` are invalid since Rust 2021: E0782)"), r));
+            let msg = blaze_own::format_in!(tys.alloc(), "`{shown}` is not a type (trait objects without `dyn` are invalid since Rust 2021: E0782)");
+            return Err(Why::Program(msg.as_str().into(), r));
         }
         if segs.last().is_some_and(|s| s.parenthesized) {
             return Err(Why::Unsupported("parenthesized generic arguments (`Fn(A) -> B`)", r));
@@ -2128,16 +2129,20 @@ impl<'b, 'n, H: Heads, S: NamesSource<'n>> Builder<'b, H, S> {
         let head = self.heads.trait_alias(alias).ok_or(Why::Need(alias))?;
         let want = usize::try_from(head.generics).unwrap_or(0).saturating_sub(1);
         let alloc = tys.alloc();
+        let wrong_arity = || {
+            let msg = blaze_own::format_in!(alloc, "a trait alias written with {} type arguments; it takes {want}", given.len());
+            Why::Program(msg.as_str().into(), r)
+        };
         if given.len() == want {
             let mut out = blaze_own::Vec::with_capacity_in(want, alloc);
             out.extend_from_slice(given);
             return Ok(out);
         }
         if given.len() > want {
-            return Err(program(format!("a trait alias written with {} type arguments; it takes {want}", given.len()), r));
+            return Err(wrong_arity());
         }
         let Some(alias_text) = self.resolver.names.signature_text_of(alias) else {
-            return Err(program(format!("a trait alias written with {} type arguments; it takes {want}", given.len()), r));
+            return Err(wrong_arity());
         };
         let marks = super::item_site::item_marks(self.resolver.names, alias, alias_text.text)
             .map_err(|_| Why::Unsupported("trait alias token marks unavailable", r))?;
@@ -2189,7 +2194,7 @@ impl<'b, 'n, H: Heads, S: NamesSource<'n>> Builder<'b, H, S> {
                         alias_builder.const_term(tys, &alias_env, av.text_at(at)?, cr, &|_| Ok(want_ty))?
```

**File**: `crates/blaze-ladder/tests/front2_locals.rs` (modified, +1/-0)
```diff
@@ -364,6 +364,7 @@ pub fn does_not_leak_later_prelude(x: u32) -> Result<u16, core::num::TryFromIntE
 }
 
 mod front2_locals {
+    mod bare_trait_objects;
     mod box_deref_captures;
     mod closure_uncaptured_place_run;
     mod deep_interior_stall;
```

**File**: `crates/blaze-ladder/tests/front2_locals/bare_trait_objects.rs` (renamed, +50/-47)
```diff
@@ -28,7 +28,7 @@ use blaze_surface::{ItemKind, Namespace, PathKind};
 use blaze_unit_graph::implicit;
 use edition::PackageEdition;
 
-const PRELUDE: &str = include_str!("../../blaze-cli/tests/ladder/front2/twin-prelude.rs");
+const PRELUDE: &str = include_str!("../../../blaze-cli/tests/ladder/front2/twin-prelude.rs");
 
 /// Exact `glob 0.3.3` pattern (`impl Error for GlobError { fn cause(&self) -> Option<&Error> }`)
 /// plus broader bare trait object forms: one-name generic arg (`Holder<Error>`), associated type
@@ -258,7 +258,7 @@ fn run_for_edition(edition: &'static str) -> Result<u8, String> {
 
 fn with_minimal(edition: &'static str, f: impl FnOnce(&blaze_scope::resolve::Names<'_>, &[SourceFile<'_>])) {
     let files = [SourceFile { path: "src/main.rs", text: MINIMAL_PROGRAM }];
-    let tc = Toolchain::none(Alloc::global());
+    let tc = Toolchain::none(blaze_own::testing::heap().alloc());
     let new = NewFront { package: "bare_min", edition, shelf: None, overflow: blaze_build::OverflowChecks::On };
     let texts = blaze_ladder::program_texts::ProgramTexts::new(&files, "src/main.rs", new, &tc, blaze_build::Panic::Unwind)
         .unwrap_or_else(|e| panic!("ProgramTexts({edition}): {e}"));
@@ -272,7 +272,7 @@ fn with_minimal(edition: &'static str, f: impl FnOnce(&blaze_scope::resolve::Nam
 fn key_of(names: &blaze_scope::resolve::Names<'_>, ns: Namespace, name: &'static str) -> blaze_typeck::ItemKey {
     let segments: &[&str] = &[name];
     let written = Written { kind: PathKind::Plain, segments };
-    let found = names::path(names, names.root(0), ns, written, Alloc::global()).unwrap_or_else(|e| panic!("`{name}`: {e:?}"));
+    let found = names::path(names, names.root(0), ns, written, blaze_own::testing::heap().alloc()).unwrap_or_else(|e| panic!("`{name}`: {e:?}"));
     checker_of(found.whole(1).unwrap_or_else(|| panic!("`{name}` resolves whole")).key)
 }
 
@@ -317,7 +317,7 @@ fn bare_trait_object_heads_regions_and_lazy_program_succeed_in_2015_and_2018() {
                 blaze_mem::Frame::new(blaze_mem::tag::Tag::Infer).expect("frame"),
                 blaze_mem::Frame::new(blaze_mem::tag::Tag::Infer).expect("frame"),
             );
-            let whole = Front2Program::new(names, &wf, files, Alloc::global())
+            let whole = Front2Program::new(names, &wf, files, blaze_own::testing::heap().alloc())
                 .unwrap_or_else(|e| panic!("Front2Program ({edition}): {e}"));
             let main = key_of(names, Namespace::Values, "main");
             let error_trait = key_of(names, Namespace::Types, "Error");
@@ -332,8 +332,8 @@ fn bare_trait_object_heads_regions_and_lazy_program_succeed_in_2015_and_2018() {
             assert!(lazy.object_trait(error_trait).is_some(), "lazy built object table for Error ({edition})");
 
             // Head regions of `<impl Error for GlobError>::cause` are laid cleanly (no refusal).
-            let mut front = Front2::new(names, &hf, files, Alloc::global()).unwrap_or_else(|e| panic!("front2 ({edition}): {e}"));
-            let mut store = Store::new(front.index.lang("sized"), front.frame, Alloc::global());
+            let mut front = Front2::new(names, &hf, files, blaze_own::testing::heap().alloc()).unwrap_or_else(|e| panic!("front2 ({edition}): {e}"));
+            let mut store = Store::new(front.index.lang("sized"), front.frame, blaze_own::testing::heap().alloc());
             store.ensure(names, &mut front.keys, Want::Impl(impl_lib)).unwrap_or_else(|e| panic!("Want::Impl ({edition}): {e:?}"));
             store
                 .ensure(names, &mut front.keys, Want::MemberFn(impl_lib, cause_key))
@@ -423,7 +423,7 @@ macro_rules! make_bare_fn {
 dep::make_bare_fn!({fn_name});
 "
     );
-    let tc = Toolchain::none(Alloc::global());
+    let tc = Toolchain::none(blaze_own::testing::heap().alloc());
     let cfg = tc.program_cfg(blaze_build::Panic::Unwind);
     let dep_pkg = PackageEdition { syntax: dep_edition, blaze: None };
     let root_pkg = PackageEdition { syntax: root_edition, blaze: None };
@@ -458,8 +458,8 @@ dep::make_bare_fn!({fn_name});
         .unwrap_or_else(|e| panic!("resolve_crates: {e}"));
     let frame = blaze_mem::Frame::new(blaze_mem::tag::Tag::Infer).expect("frame");
     let sources = [SourceFile { path: "src/main.rs", text: &root }];
-    let mut front = Front2::new(&names, &frame, &sources, Alloc::global()).unwrap_or_else(|e| panic!("front2: {e}"));
-    let mut store = Store::new(front.index.lang("sized"), front.frame, Alloc::global());
+    let mut front = Front2::new(&names, &frame, &sources, blaze_own::testing::heap().alloc()).unwrap_or_else(|e| panic!("front2: {e}"));
+    let mut store = Store::new(front.index.lang("sized"), front.frame, blaze_own::testing::heap().alloc());
     let fk = key_of(&names, Namespace::Values, fn_name);
     let lib = front.keys.library_in(&names, fk).unwrap_or_else(|| panic!("lib key of `{fn_name}`"));
     store.ensure(&names, &mut front.keys, Want::Fn(lib)).map_er
```

**File**: `crates/blaze-manifest/src/layout/tests.rs` (modified, +9/-6)
```diff
@@ -467,16 +467,19 @@ b64.workspace = true
     };
     let (units, _) = tree.read_opts("crates/shell", true, true).expect("the nested workspace with its path packages");
     assert_eq!(units.manifests[units.root.0 as usize].as_str(), "crates/shell/Cargo.toml", "the nested workspace is its own root");
-    let members: std::vec::Vec<&str> = units.members.iter().map(|m| m.name.as_str()).collect();
-    assert_eq!(members, ["shell"], "a path package outside the root's folder is no member");
+    assert!(units.members.iter().map(|m| m.name.as_str()).eq(["shell"]), "a path package outside the root's folder is no member");
     match &units.members[0].dependencies[0].source {
         Source::Path(dir) => assert_eq!(dir.as_str(), "crates/bgit"),
         _ => panic!("`../bgit` from crates/shell is the path package at crates/bgit"),
     }
-    let found: std::vec::Vec<(&str, &str, Option<&str>)> =
-        units.path_packages.iter().map(|p| (p.dir.as_str(), p.name.as_str(), p.version.as_ref().map(|v| v.as_str()))).collect();
-    std::println!("path packages: {found:?}");
-    assert_eq!(found, [("crates/b64", "b64", Some("0.0.7")), ("crates/bgit", "bgit", Some("0.0.7"))], "bgit by shell's manifest, b64 through bgit's");
+    assert!(
+        units
+            .path_packages
+            .iter()
+            .map(|p| (p.dir.as_str(), p.name.as_str(), p.version.as_ref().map(|v| v.as_str())))
+            .eq([("crates/b64", "b64", Some("0.0.7")), ("crates/bgit", "bgit", Some("0.0.7"))]),
+        "bgit by shell's manifest, b64 through bgit's"
+    );
     let bgit = units.path_packages.iter().find(|p| p.name.as_str() == "bgit").expect("bgit");
     assert_eq!(bgit.lib.as_ref().map(|lib| lib.root.as_str()), Some("crates/bgit/src/lib.rs"), "anchor-relative, like a member's");
     match &bgit.dependencies[0].source {
```

**File**: `crates/blaze-shell/src/layout.rs` (modified, +27/-22)
```diff
@@ -3044,7 +3044,7 @@ fn layout_table(
             }
             Some(GitStatusTree {
                 name_col: fc,
-                rows: git_status_tree_rows(&entries),
+                rows: git_status_tree_rows(&entries, Alloc::global()),
             })
         }
         _ => None,
@@ -3689,7 +3689,7 @@ fn layout_table(
                                     &block.source,
                                     path,
                                 ),
-                                name: path.clone(),
+                                name: path.to_owned(),
                                 icon: Some(icon_name),
                                 is_dir: true,
                                 git_change: false,
@@ -4614,7 +4614,7 @@ const DATAFRAME_TREE_STEP: f32 = 18.0;
 struct GitStatusTree {
     /// The path column the tree is drawn in.
     name_col: usize,
-    rows: Vec<GitTreeRow>,
+    rows: blaze_own::AVec<'static, GitTreeRow>,
 }
 
 /// One drawn row of a [`GitStatusTree`].
@@ -4665,9 +4665,9 @@ fn is_git_status_table(table: &Table<'_>, name_col: usize) -> bool {
 
 /// Split a repo-relative path into segments; the last keeps a trailing `/` (an untracked
 /// directory as git reports it), and empty segments from doubled slashes are dropped.
-fn split_git_tree_path(path: &str) -> Vec<&str> {
+fn split_git_tree_path<'p, 'a>(path: &'p str, alloc: Alloc<'a>) -> blaze_own::AVec<'a, &'p str> {
     let body = path.strip_suffix('/').unwrap_or(path);
-    let mut segs: Vec<&str> = Vec::new();
+    let mut segs: blaze_own::AVec<'a, &'p str> = blaze_own::AVec::new_in(alloc);
     let mut start = 0usize;
     for (i, b) in body.bytes().enumerate() {
         if b == b'/' {
@@ -4686,27 +4686,31 @@ fn split_git_tree_path(path: &str) -> Vec<&str> {
 /// Lay `(table_row, path)` entries out as a rough `eza --tree` scoped to them: sorted by path
 /// segments, each directory a row above its entries, a directory whose only child is a directory
 /// collapsed into one row (`crates/blaze-shell/src/`), and leaves showing their last segment.
-fn git_status_tree_rows(entries: &[(usize, &str)]) -> Vec<GitTreeRow> {
-    let mut items: Vec<(usize, Vec<&str>)> =
-        entries.iter().map(|&(row, path)| (row, split_git_tree_path(path))).collect();
-    items.sort_by(|a, b| a.1.cmp(&b.1).then(a.0.cmp(&b.0)));
-    let mut out = Vec::with_capacity(items.len() * 2);
-    let mut rails: Vec<bool> = Vec::new();
-    push_git_tree_level(&items, 0, true, &mut rails, &mut out);
+fn git_status_tree_rows<'a>(entries: &[(usize, &str)], alloc: Alloc<'a>) -> blaze_own::AVec<'a, GitTreeRow> {
+    let mut items: blaze_own::AVec<'a, (usize, blaze_own::AVec<'a, &str>)> =
+        blaze_own::AVec::with_capacity_in(entries.len(), alloc);
+    for &(row, path) in entries {
+        items.push((row, split_git_tree_path(path, alloc)));
+    }
+    items.sort_by(|a, b| a.1.as_slice().cmp(b.1.as_slice()).then(a.0.cmp(&b.0)));
+    let mut out = blaze_own::AVec::with_capacity_in(items.len() * 2, alloc);
+    let mut rails: blaze_own::AVec<'a, bool> = blaze_own::AVec::new_in(alloc);
+    push_git_tree_level(&items, 0, true, &mut rails, &mut out, alloc);
     out
 }
 
 /// Emit the rows for `items` (sorted, sharing their first `level` segments). Top-level rows
 /// carry no guides; deeper rows get one `│`/blank per elbowed ancestor in `rails`, then an elbow.
-fn push_git_tree_level(
-    items: &[(usize, Vec<&str>)],
+fn push_git_tree_level<'p, 'a>(
+    items: &[(usize, blaze_own::AVec<'a, &'p str>)],
     level: usize,
     top: bool,
-    rails: &mut Vec<bool>,
-    out: &mut Vec<GitTreeRow>,
+    rails: &mut blaze_own::AVec<'a, bool>,
+    out: &mut blaze_own::AVec<'a, GitTreeRow>,
+    alloc: Alloc<'a>,
 ) {
     // Group into leaves (one item ending here) and directories (items sharing segment `level`).
-    let mut groups: Vec<(usize, usize, bool)> = Vec::new();
+    let mut groups: blaze_own::AVec<'a, (usize, usize, bool)> = blaze_own::AVec::new_in(alloc);
     let mut i = 0usize;
     while i < items.len() {
         let segs = &items[i].1;
@@ -4766,7 +4770,7 @@ fn push_git_tree_level(
         if !top {
             rails.push(!is_last);
         }
-        push_git_tree_level(group, next, false, rails, out);
+        push_git_tree_level(group, next, false, rails, out, alloc);
         if !top {
             rails.pop();
         }
@@ -10944,9 +10948,10 @@ mod tests {
                 leaf: leaf.to_owned(),
             },
         };
+        let alloc = blaze_own::Alloc::global();
         assert_eq!(
-            git_status_tree_rows(&entries),
-            std::vec![
+            git_status_tree_rows(&entries, alloc).as_slice(),
+            [
                 entry("", 3, "README.md"),
                 dir("", "crates/", "crates/"),
                 dir("├── ", "blaze-sh/src/", "crates/blaze-sh/src/"),
@@ -10959,8 +10964,8 @@ mod tests {
         );
         // A single shared chain collapses into one top-level directory row.
```

**File**: `crates/blaze-unit-graph/src/resolve.rs` (modified, +7/-3)
```diff
@@ -351,11 +351,15 @@ impl<'l, 'a> Resolution<'l, 'a> {
     /// [`UnitError::PathOutsideAnchor`]: no source can answer it, so it is never asked for.
     fn locked(&self, id: LockId, package: &Package<'a>, e: usize) -> Result<LockId, UnitError<'a>> {
         let child = self.locked_entry(id, package, e)?;
-        let dep = &package.deps[e];
-        if let DepSource::OutsideAnchor { path } = &dep.source
+        if let Some(dep) = package.deps.get(e)
+            && let DepSource::OutsideAnchor { path } = &dep.source
             && matches!(self.answers.get(child.index()), Some(Answer::Pending))
         {
-            return Err(UnitError::PathOutsideAnchor { package: package.name.clone(), dep: dep.key.clone(), path: path.clone() });
+            return Err(UnitError::PathOutsideAnchor {
+                package: own(package.name.as_str(), self.alloc),
+                dep: own(dep.key.as_str(), self.alloc),
+                path: own(path.as_str(), self.alloc),
+            });
         }
         Ok(child)
     }
```

---

### Incident Patch 3: `c27c8b35` (2026-11-27)
**Commit Message**: fix(scope,ladder): exclude wasm_import_module extern blocks and mismatched arities from export_shim (#2833)

## Summary
Fixes the PR `#2828` wasm64 `export_shim` regression where
`#[link(wasm_import_module = "blaze_seed")]` Wasm host imports
(`wasi_rt::rt::seed::unlink`) were mistakenly bound to same-program
POSIX `#[no_mangle] unlink` wrappers (`call sig mismatch (ll->i) vs
(l->i)`):

- **`blaze-scope` (`ItemsRecord` v20, `WASM_IMPORT = 1 << 7`)**: records
`wasm_import` on `ItemIdentity` for `#[link(wasm_import_module = ...)]`
extern blocks (walking macro expansions), bumps `VERSION` `19 -> 20`
with `previous_items_version_19_is_rejected` + `scripts/layouts.txt`,
and includes `row.wasm_import` in `NameCell::Item`.
- **`blaze-ladder` (`export_shim.rs`, `foreign_locals.rs`, `locals.rs`,
`source.rs`, `tables/{view,task}.rs`)**: excludes both module-level and
body-local `wasm_import_module` extern blocks from `export_shim`, and
verifies `(fixed_param_count, c_variadic)` signature shape match before
binding.

## Verification
- `blaze-scope` (`names_cells` + `previous_items_version`) &
`blaze-ladder` (`front_equal_rules`, 36/36): **all passed**.
- `blaze-cli` (`wasm64_self_compile_e2e`)

**File**: `crates/blaze-ladder/src/front2/export_shim.rs` (modified, +46/-12)
```diff
@@ -57,6 +57,8 @@ pub(crate) fn format_refused<'a>(why: &ExportRefused<'_>, alloc: Alloc<'a>) -> A
 pub struct Declared<'a> {
     pub lib: LibKey,
     pub symbol: AString<'a>,
+    pub params: usize,
+    pub c_variadic: bool,
 }
 
 /// Why a same-program export binding failed.
@@ -187,8 +189,18 @@ pub fn declares<'n, 'a, S: NamesSource<'n>>(
     let Some(raw_name) = raw_name else { return Ok(None) };
     let ident = raw_name.strip_prefix("r#").unwrap_or(raw_name);
     let abi = match local_abi {
-        Some(local) => Some(local),
-        None => names.extern_abi(h.lib).ok_or_else(|| ExportRefused::Unplaced { symbol: own_str(ident, alloc) })?,
+        Some(local) => {
+            if store.locals.foreign(key).is_some_and(|f| f.wasm_import) {
+                return Ok(None);
+            }
+            Some(local)
+        }
+        None => {
+            if names.is_wasm_import(h.lib).unwrap_or(false) {
+                return Ok(None);
+            }
+            names.extern_abi(h.lib).ok_or_else(|| ExportRefused::Unplaced { symbol: own_str(ident, alloc) })?
+        }
     };
     let Some(abi) = abi else { return Ok(None) };
     if abi == super::llvm_intrinsic::ABI {
@@ -207,22 +219,25 @@ pub fn declares<'n, 'a, S: NamesSource<'n>>(
     let attrs_err = || ExportRefused::Attrs { symbol: own_str(ident, alloc) };
     let krate = names.crate_of(h.lib).ok_or_else(attrs_err)?;
     let values_at = super::links::values_key(names, store, h.lib);
+    let params = h.inputs.len();
+    let c_variadic = h.c_variadic;
     match read_decl_attrs(names, krate, values_at, h.text, alloc).map_err(|()| attrs_err())? {
         DeclAttrs::Intrinsic => Ok(None),
-        DeclAttrs::LinkName(symbol) => Ok(Some(Declared { lib: h.lib, symbol })),
-        DeclAttrs::Plain => Ok(Some(Declared { lib: h.lib, symbol: own_str(ident, alloc) })),
+        DeclAttrs::LinkName(symbol) => Ok(Some(Declared { lib: h.lib, symbol, params, c_variadic })),
+        DeclAttrs::Plain => Ok(Some(Declared { lib: h.lib, symbol: own_str(ident, alloc), params, c_variadic })),
     }
 }
 
 /// Checks whether candidate function `key` in `krate` strongly exports `symbol` (i.e. has a body,
-/// is not cfg'd out, is not `#[linkage = "weak"]`, and its effective exported symbol — with
-/// `#[export_name]` taking precedence over `#[no_mangle]` per Reference `[abi.export_name]` —
-/// equals `symbol`).
+/// is not cfg'd out, is not `#[linkage = "weak"]`, matches `sig_shape` when given, and its
+/// effective exported symbol — with `#[export_name]` taking precedence over `#[no_mangle]` per
+/// Reference `[abi.export_name]` — equals `symbol`).
 fn exports_symbol<'n, 'a, S: NamesSource<'n>>(
     names: S,
     krate: usize,
     key: LibKey,
     symbol: &str,
+    sig_shape: Option<(usize, bool)>,
     alloc: Alloc<'a>,
 ) -> Result<bool, ExportRefused<'a>> {
     let unread = || ExportRefused::Unread { symbol: own_str(symbol, alloc), krate };
@@ -237,9 +252,26 @@ fn exports_symbol<'n, 'a, S: NamesSource<'n>>(
     if v.cfg_out() {
         return Ok(false);
     }
-    if v.head.get(head::FLAGS).copied().unwrap_or(0) & blaze_lower::machine::sig::HAS_BODY == 0 {
+    let flags = v.head.get(head::FLAGS).copied().unwrap_or(0);
+    if flags & blaze_lower::machine::sig::HAS_BODY == 0 {
         return Ok(false);
     }
+    if let Some((want_params, want_variadic)) = sig_shape {
+        let def_variadic = flags & blaze_lower::machine::sig::VARIADIC != 0;
+        if def_variadic != want_variadic {
+            return Ok(false);
+        }
+        let mut def_params = 0usize;
+        for &n in v.rows(v.list(head::PARAMS)).map_err(|_| attrs_err())? {
+            let prm = blaze_lower::Param::decode(n).map_err(|_| attrs_err())?;
+            if !prm.variadic {
+                def_params = def_params.saturating_add(1);
+            }
+        }
+        if def_params != want_params {
+            return Ok(false);
+        }
+    }
     let mut no_mangle = false;
     let mut export_name: Option<AString<'a>> = None;
     let mut weak = false;
@@ -321,6 +353,7 @@ pub fn definition_in<'n, 'a, S: NamesSource<'n>>(
     names: S,
     crates: &[usize],
     symbol: &str,
+    sig_shape: Option<(usize, bool)>,
     alloc: Alloc<'a>,
 ) -> Result<Option<LibKey>, ExportRefused<'a>> {
     let mut found: Option<LibKey> = None;
@@ -346,7 +379,7 @@ pub fn definition_in<'n, 'a, S: NamesSource<'n>>(
             return Err(unread());
         }
         for &key in candidates.iter() {
-            if !exports_symbol(names, krate, key, symbol, alloc)? {
+            if !exports_symbol(names, krate, key, symbol, sig_shape, alloc)? {
                 continue;
             }
             // Keep the two smallest keys: the refusal names the same pair in any walk order.
@@ -380,10 +413,11 @@ pub fn definition<'n, 'a, S: NamesSource<'n>>(
     names: S,
     roots: &[usize],
     symbol: &str,
+    sig_shape: Option<(usize, bool)>,
     alloc: Alloc<'a>,
 ) -> R
```

**File**: `crates/blaze-ladder/src/front2/foreign_locals.rs` (modified, +6/-1)
```diff
@@ -49,6 +49,8 @@ pub struct Declared<'t> {
     /// The `safe` qualifier is written ("implicitly unsafe unless the safe function qualifier
     /// is present").
     pub safe: bool,
+    /// Whether the enclosing `extern` block carries `#[link(wasm_import_module = ...)]`.
+    pub wasm_import: bool,
 }
 
 /// What a local foreign item's head and the code builder ask beyond its text: its block's ABI
@@ -61,6 +63,8 @@ pub struct LocalForeign<'n> {
     /// that the library they are calling uses the standard C ABI").
     pub abi: &'n str,
     pub safe: bool,
+    /// Whether the enclosing `extern` block carries `#[link(wasm_import_module = ...)]`.
+    pub wasm_import: bool,
 }
 
 /// Why an `extern` block in a body was not read: each a form refused by name.
@@ -137,6 +141,7 @@ pub fn declared<'t, 'a>(block: &'t str, edition: Edition, cfg: &mut dyn Cfg, all
     let mut top = outline.children(None);
     let (Some((at, item)), None) = (top.next(), top.next()) else { return Err(Refused::NotOneBlock) };
     let ItemDetail::ExternBlock { abi } = item.detail else { return Err(Refused::NotOneBlock) };
+    let wasm_import = blaze_scope::items_record::extern_block_wasm_import(block, &outline, item);
     let abi = match abi {
         None => C_ABI,
         Some(r) => {
@@ -183,7 +188,7 @@ pub fn declared<'t, 'a>(block: &'t str, edition: Edition, cfg: &mut dyn Cfg, all
         let safe = quals.split_whitespace().any(|w| w == "safe");
         let name = slice(text, name)?;
         let name = name.strip_prefix("r#").unwrap_or(name);
-        out.push(Declared { kind, name, text, at: child.range, safe });
+        out.push(Declared { kind, name, text, at: child.range, safe, wasm_import });
     }
     Ok((abi, out))
 }
```

**File**: `crates/blaze-ladder/src/front2/locals.rs` (modified, +1/-1)
```diff
@@ -714,7 +714,7 @@ impl<'n> Locals<'n> {
                         rows.push(Row { scope: s as u32, kind, name: d.name, key, range, path: &[], abs: false, first_mark: None, module: None });
                         let ck = keys.local(key, kind).map_err(HeadError::Key)?;
                         self.heads.insert(ck, LocalHead { lib: key, kind, text: d.text, module: at.module, names_at, enclosing: at.owner, scope: s as u32, range, copied: from.is_none(), marks });
-                        self.foreign.insert(ck, LocalForeign { kind: d.kind, abi, safe: d.safe });
+                        self.foreign.insert(ck, LocalForeign { kind: d.kind, abi, safe: d.safe, wasm_import: d.wasm_import });
                     }
                     continue;
                 }
```

**File**: `crates/blaze-ladder/src/front2/source.rs` (modified, +19/-0)
```diff
@@ -309,6 +309,11 @@ pub trait NamesSource<'n>: Copy {
     /// records such a key is `None` with a gap naming it in the log.
     fn extern_abi(self, key: ItemKey) -> Option<Option<&'n str>>;
 
+    /// Question 10c2: whether foreign item `key` is declared inside an `extern` block carrying
+    /// `#[link(wasm_import_module = ...)]` (a WebAssembly host import, never a same-program Rust
+    /// export). Covered by `NameCell::Item`.
+    fn is_wasm_import(self, key: ItemKey) -> Option<bool>;
+
     /// Question 10d: the value of `attr` (`link_name` or `export_name`) on item `key` when it is
     /// written as a macro call (ring's `#[link_name = concat!(prefix!(), stringify!(f))]`), as
     /// the item's crate's solve expanded it once at the item (blaze-scope attr_values.rs): over
@@ -716,6 +721,14 @@ impl<'n> NamesSource<'n> for &'n Names<'n> {
         blaze_scope::items_record::foreign_abi(krate, at, item, key).ok()
     }
 
+    fn is_wasm_import(self, key: ItemKey) -> Option<bool> {
+        let Some(Place { krate, at, item }) = self.place(key) else { return Some(false) };
+        let krate = *self.crates().get(krate)?;
+        blaze_scope::items_record::foreign_block(krate, at, item, key)
+            .ok()
+            .map(|found| found.is_some_and(|(_, wasm)| wasm))
+    }
+
     fn attr_value(self, key: ItemKey, attr: &'static str) -> Option<Option<RowValue<'n>>> {
         // The rows the crate's solve made (`CrateNames::values`, sorted by item and attribute):
         // the very rows its items record's value table is written from.
@@ -2197,6 +2210,12 @@ impl<'n> NamesSource<'n> for &'n Records<'n> {
         }
     }
 
+    fn is_wasm_import(self, key: ItemKey) -> Option<bool> {
+        let krate = self.items.crate_of(key)?;
+        let record = self.items_of(krate)?;
+        Some(self.read(krate, record.identity(key))?.is_some_and(|row| row.wasm_import))
+    }
+
     /// The crate's items record's value table (blaze-scope items_record/values.rs): one binary
     /// search, no text read, nothing expanded again (rule 77). A refusal comes back as the words
     /// the solve wrote with the record.
```

**File**: `crates/blaze-ladder/src/front2/tables/task.rs` (modified, +1/-0)
```diff
@@ -498,6 +498,7 @@ impl<'n> NamesSource<'n> for DecodeLangSource<'n> {
     fn expansion_text(self, _krate: usize, _call: ItemKey) -> Option<&'n str> { None }
     fn text_marks(self, _krate: usize, _call: ItemKey) -> Result<Option<blaze_scope::crate_roots::TextMarks<'n>>, super::super::item_site::MarksLost> { Ok(None) }
     fn extern_abi(self, _key: ItemKey) -> Option<Option<&'n str>> { None }
+    fn is_wasm_import(self, _key: ItemKey) -> Option<bool> { None }
     fn attr_value(self, _key: ItemKey, _attr: &'static str) -> Option<Option<blaze_scope::attr_values::RowValue<'n>>> { None }
     fn in_sans_io_scope(self, _key: ItemKey, _module: ItemKey) -> bool { false }
     fn kind_of_item(self, _key: ItemKey) -> Option<ItemKind> { None }
```

**File**: `crates/blaze-ladder/src/front2/tables/view.rs` (modified, +5/-0)
```diff
@@ -445,6 +445,11 @@ impl<'n> NamesSource<'n> for Tables<'_, 'n> {
         self.records.extern_abi(key)
     }
 
+    fn is_wasm_import(self, key: ItemKey) -> Option<bool> {
+        self.item(key);
+        self.records.is_wasm_import(key)
+    }
+
     fn kind_of_item(self, key: ItemKey) -> Option<ItemKind> {
         self.item(key);
         self.records.kind_of_item(key)
```

**File**: `crates/blaze-ladder/tests/front_equal_rules.rs` (modified, +114/-0)
```diff
@@ -1173,3 +1173,117 @@ mod b { #[unsafe(export_name = "dup_sym")] pub unsafe extern "C" fn other() -> i
         assert!(wd.contains("dup_sym") && wd.contains("defined twice"), "unexpected refusal detail: {wd}");
     });
 }
+
+#[test]
+fn wasm_import_module_and_mismatched_arity_externs_stay_foreign() {
+    on_checker_stack(|| {
+        let caller: &'static str = r#"#![feature(no_core)]
+#![no_core]
+#[link(wasm_import_module = "blaze_seed")]
+unsafe extern "C" {
+    fn unlink(path: *const u8, len: usize) -> i32;
+    fn same_arity_host(x: i32) -> i32;
+}
+unsafe extern "C" {
+    fn mismatch_arity(a: i32, b: i32) -> i32;
+    fn matched_rt(x: i32) -> i32;
+}
+#[unsafe(no_mangle)]
+pub extern "C" fn main() -> i32 {
+    #[link(wasm_import_module = "wasi_snapshot_preview1")]
+    unsafe extern "C" {
+        fn local_host(x: i32) -> i32;
+    }
+    let p = 0usize as *const u8;
+    unsafe {
+        unlink(p, 0) + same_arity_host(1) + local_host(2) + mismatch_arity(3, 4) + matched_rt(5)
+    }
+}
+"#;
+        let provider: &'static str = r#"#![feature(no_core)]
+#![no_core]
+#[unsafe(no_mangle)]
+pub unsafe extern "C" fn unlink(_path: *const u8) -> i32 { 10 }
+#[unsafe(no_mangle)]
+pub unsafe extern "C" fn same_arity_host(_x: i32) -> i32 { 20 }
+#[unsafe(no_mangle)]
+pub unsafe extern "C" fn local_host(_x: i32) -> i32 { 30 }
+#[unsafe(no_mangle)]
+pub unsafe extern "C" fn mismatch_arity(_a: i32) -> i32 { 40 }
+#[unsafe(no_mangle)]
+pub unsafe extern "C" fn matched_rt(x: i32) -> i32 { x + 50 }
+"#;
+        let frame = Frame::new(blaze_mem::tag::Tag::Infer).expect("fixture frame");
+        let a = blaze_own::testing::heap().alloc();
+        let files = [SourceFile { path: ROOT, text: caller }];
+        let tc = Toolchain::none(a);
+        let new = NewFront { package: "ladder", edition: "2024", shelf: None, overflow: OverflowChecks::Off };
+        let texts = ProgramTexts::new(&files, ROOT, new, &tc, Panic::Unwind).expect("fixture texts");
+        let user = texts.user();
+        let inputs = Inputs::new(&user, &tc).expect("fixture inputs");
+        let app = inputs.crates()[0];
+        let crates = [
+            CrateInput { deps: &[("provider", 1)], ..app },
+            CrateInput {
+                name: "provider",
+                key: CrateItemKey(ContentId::of("wasm import fixture crate", b"provider")),
+                implicit: blaze_unit_graph::implicit(user.edition, &blaze_unit_graph::UnitKind::Lib),
+                root: "/provider/src/lib.rs",
+                shown_from: "/provider",
+                deps: &[],
+                ..app
+            },
+        ];
+        let roots = [(app.root, caller), (crates[1].root, provider)];
+        let names = resolve_crates(&crates, Sysroot::default(), &FixtureFiles(&roots), &Serial, blaze_own::testing::bump()).expect("fixture names");
+        let lib = |krate, name| names.items(krate).map(|(k, _, _)| k).find(|&k| names.name_of(k) == Some(name)).expect("named item");
+        let main = lib(0, "main");
+        let entry = checker_of(main);
+        let decl_unlink = checker_of(lib(0, "unlink"));
+        let decl_same_arity_host = checker_of(lib(0, "same_arity_host"));
+        let decl_mismatch = checker_of(lib(0, "mismatch_arity"));
+        let decl_matched = checker_of(lib(0, "matched_rt"));
+        let def_matched = checker_of(lib(1, "matched_rt"));
+
+        let whole = Front2Program::new(&names, &frame, &files, a).expect("whole program");
+        let log = frame.alloc(Log::new(&["ladder", "provider"], a));
+        let kept = keep(&names, &frame, a);
+        let records = frame.alloc(Records::new(frame.alloc_slice_copy(&[crates[0].key, crates[1].key]), kept, log, &frame, a));
+        let mut lazy = LazyProgram::from_records(records, &frame, &[0], Some(entry), a).expect("lazy program");
+        lazy.decide_start(blaze_ladder::run::special::MakerStart::ByRule).expect("exported main");
+        let (li, checked) = lazy.check_one(entry).expect("lazy check main").expect("main has a body");
+        let wi = whole.entry().expect("whole main");
+
+        let decl_local_host = *checked
+            .callees
+            .column::<1>()
+            .iter()
+            .find(|&&k| k != decl_unlink && k != decl_same_arity_host && k != decl_mismatch && k != decl_matched)
+            .expect("body-local wasm import callee");
+
+        let check_row = |front: &dyn FrontEnd, key, want_kind, want_sym: &str| {
+            let idx = front.fn_index(key).expect("tabled fn");
+            let f = front.function(idx);
+            assert_eq!((f.kind, f.symbol), (want_kind, want_sym));
+        };
+        // Module-level wasm_import_module (both mismatched and identical arity) stay Foreign.
+        check_row(&whole, decl_unlink, FnKind::Foreign, "unlink");
+        check_row(&lazy, decl_unlink, FnKind::Foreign, "unlink");
+        check_row(&whole, decl_same_arity_host, FnKind::Foreign, "same_arity_host");
+        check_row(&lazy, decl
```

**File**: `crates/blaze-scope/src/items_record.rs` (modified, +46/-23)
```diff
@@ -102,7 +102,11 @@ const MAGIC: [u8; 4] = *b"BZIT";
 /// function items whose signature head mentions `no_mangle` or `export_name` so `NameCell::Exports`
 /// and `export_shim` scan only the in-memory `meta` column without opening unrelated files; a
 /// version-18 record is refused the same way.
-const VERSION: u32 = 19;
+/// 20: item flag `WASM_IMPORT` (`1 << 7`) marks foreign items declared inside an `extern` block
+/// carrying `#[link(wasm_import_module = ...)]` so same-program `export_shim` binding never binds
+/// WebAssembly host imports (e.g. `blaze_seed::unlink`) to same-program POSIX `#[no_mangle]`
+/// definitions; a version-19 record is refused the same way.
+const VERSION: u32 = 20;
 const KEY_TAIL: usize = 24;
 const ALIGN: usize = 16;
 const HEADER: usize = 256;
@@ -174,6 +178,8 @@ const SANS_IO: u8 = 1 << 4;
 const EXPORT_NO_MANGLE: u8 = 1 << 5;
 /// Item only: function outside an `extern` block whose signature head mentions `export_name`.
 const EXPORT_NAME: u8 = 1 << 6;
+/// Item only: foreign item declared inside an `extern` block with `#[link(wasm_import_module = ...)]`.
+const WASM_IMPORT: u8 = 1 << 7;
 
 // Impl marks.
 const HAS_TRAIT: u8 = 1;
@@ -443,48 +449,50 @@ fn span_in(base: &str, part: &str) -> Option<(u32, u32)> {
 /// walk/rows.rs `(EXTERN_BLOCK, ABI)`), relative to the block's start (rule 71). A range outside
 /// the text is [`ItemsRecordError::Range`]; a written ABI that is not one quoted string (a raw
 /// string, an escape) is [`ItemsRecordError::ForeignAbi`], never read as "C" (rule 3).
-fn foreign_abi_in_outline<'t>(text: &'t str, outline: &blaze_file_items::Outline<'_>, entry: &blaze_surface::Item, item: ItemKey, krate: CrateItemKey) -> Result<Option<&'t str>, ItemsRecordError> {
+/// Whether the `extern` block `block` in `outline` of `text` carries a non-doc attribute naming
+/// `wasm_import_module` (e.g. `#[link(wasm_import_module = "blaze_seed")]`).
+pub fn extern_block_wasm_import(text: &str, outline: &blaze_file_items::Outline<'_>, block: &blaze_surface::Item) -> bool {
+    outline.attrs(block).iter().any(|attr| {
+        if attr.kind == blaze_surface::AttrKind::Doc {
+            return false;
+        }
+        let start = usize::try_from(block.range.start.saturating_add(attr.range.start)).unwrap_or(usize::MAX);
+        let end = usize::try_from(block.range.start.saturating_add(attr.range.end)).unwrap_or(usize::MAX);
+        text.get(start..end).is_some_and(|written| written.contains("wasm_import_module"))
+    })
+}
+
+fn foreign_block_in_outline<'t>(text: &'t str, outline: &blaze_file_items::Outline<'_>, entry: &blaze_surface::Item, item: ItemKey, krate: CrateItemKey) -> Result<Option<(&'t str, bool)>, ItemsRecordError> {
     let Some(parent) = entry.parent else { return Ok(None) };
     let block = outline.item(parent);
     let ItemDetail::ExternBlock { abi } = block.detail else { return Ok(None) };
-    let Some(r) = abi else { return Ok(Some("C")) };
+    let wasm_import = extern_block_wasm_import(text, outline, block);
+    let Some(r) = abi else { return Ok(Some(("C", wasm_import))) };
     let (start, end) = (block.range.start.saturating_add(r.start), block.range.start.saturating_add(r.end));
     let written = text.get(start as usize..end as usize).ok_or(ItemsRecordError::Range { krate, start, len: end.saturating_sub(start) })?;
     let written = written.trim();
     let written = written.strip_prefix("extern").map_or(written, str::trim_start);
     if written.is_empty() {
-        return Ok(Some("C"));
+        return Ok(Some(("C", wasm_import)));
     }
     match written.strip_prefix('"').and_then(|t| t.strip_suffix('"')) {
-        Some(abi) if !abi.contains(['"', '\\']) => Ok(Some(abi)),
+        Some(abi) if !abi.contains(['"', '\\']) => Ok(Some((abi, wasm_import))),
         _ => Err(ItemsRecordError::ForeignAbi { item }),
     }
 }
 
-/// The ABI of the `extern` block that declares `item` (at `at`, outline entry `idx`) in `names`:
-/// the block's string unquoted as written, `"C"` for a bare `extern` (the Reference,
-/// [items.extern.abi.default]); `None` when no `extern` block declares it. The fact of the item
-/// the names task writes into its row ([`ItemRow::foreign`]), so no reader outlines a text again
-/// to ask it.
-///
-/// Checks `entry`'s direct parent in its own outline first, then — when `entry` is a top-level
-/// item of a macro expansion (`entry.parent.is_none()`, `At::Expansion(call)`) — walks out
-/// through enclosing macro calls (`CallSrc::place`) so items emitted by function-like or
-/// attribute macros inside an `extern` block (e.g. `ring`'s `extern "C" { prefixed_item! { ... } }`,
-/// arbitrarily nested) inherit their enclosing block's ABI.
-///
-/// The one home of the reading (rule 30): the solved names' `extern_abi` (blaze-ladder
-/// front2/source.rs) calls it too, so in-memory `Names` and serialized `Records` answer alike.
-pub fn foreign_abi<'t>(names: &CrateNames<'t>, mut at: At, mut idx: ItemIndex
```

#### Recent Merged Pull Requests:
- **PR #2845** (2026-11-28): fix(ladder,cli): honor wasm64 proc-macro shim export overrides for getenv (@mteacher360)
- **PR #2844** (2026-11-28): test(ladder): forward input token origin for match_ref_mut in transparent_mark_edition (@mteacher360)
- **PR #2843** (2026-11-28): fix(expand,scope,lower): carry local hygiene hash on TextMark for recursive macro_rules! (@mteacher360)
- **PR #2842** (2026-11-28): fix(build): propagate niche-scalar Rust ABI through transparent wrappers (@mteacher360)
- **PR #2841** (2026-11-27): Merge shell-pane-zoom-1127: reword AGENTS.md intro and 14 core rule lines for exact terms (@andrewgazelka)
- **PR #2840** (2026-11-27): fix(expand,scope,lower): thread CallSite.ctx hygiene from call path into macro expansions (@mteacher360)

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

## X. cli): thread c_probes and facts-only spawn_setting into wasm64 dep build scripts

**RULE**:
When implementing operations in `crates/blaze-cli/src/engine_check.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in indexable-inc/blaze. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4b2cbc1f`: cli): thread c_probes and facts-only spawn_setting into wasm64 dep build scripts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/blaze-cli/src/engine_check.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        let checked = check_live(cx, fs, host, rng, Some(args), net, root, check_opts, &mut shown, phases, out, err, None, Some(&lazy_sdk), None, None, crate::store::StoreTeardown::Drop)?;
                        let res = check_live(cx, fs, host, rng, Some(args), net, root, opts(), &mut shown, phases, out, err, live, Some(&lazy_sdk), None, None, crate::store::StoreTeardown::ForgetForExit);
                    let mut ask = |mut shown| check_live(cx, fs, host, rng, Some(args), net, root, opts(), &mut shown, phases, out, err, None, Some(&lazy_sdk), None, None, crate::store::StoreTeardown::Drop).map(|checked| (checked, shown));
    /// Check-time command probes (`SharedCommandProbes`) carried into start-time proc-macro
    /// runners (`RunProcs`) so `run`/`test`/`export` reuse the exact probe/pin snapshot that
    /// keyed and produced the `MacroModule` records.
    probes: &'r crate::scripts::SharedCommandProbes,
}

/// Borrowed lazy macOS SDK handle handed to start-time proc-macro runners (`RunProcs`) so
/// `run`/`test`/`export` resolve the exact same SDK identity snapshot as `check` on first
/// proc-macro demand (0 ms cost on pure-Rust starts) without borrowing `Standing::stor
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        let checked = check_live(cx, fs, host, rng, Some(args), net, root, check_opts, &mut shown, phases, out, err, None, Some(&lazy_sdk), None, crate::store::StoreTeardown::Drop)?;
                        let res = check_live(cx, fs, host, rng, Some(args), net, root, opts(), &mut shown, phases, out, err, live, Some(&lazy_sdk), None, crate::store::StoreTeardown::ForgetForExit);
                    let mut ask = |mut shown| check_live(cx, fs, host, rng, Some(args), net, root, opts(), &mut shown, phases, out, err, None, Some(&lazy_sdk), None, crate::store::StoreTeardown::Drop).map(|checked| (checked, shown));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4b2cbc1f` are properly handled with clean fallback behavior.


## Consequences
- **Positive**: Guarantees modular isolation, deterministic resource reclamation, and clean boundary encapsulation.
- **Negative / Trade-offs**: Requires explicit interface adapters and serialization overhead.
- **Compliance Mandate**: All future subsystem implementations adhering to this pattern must enforce this decision.
