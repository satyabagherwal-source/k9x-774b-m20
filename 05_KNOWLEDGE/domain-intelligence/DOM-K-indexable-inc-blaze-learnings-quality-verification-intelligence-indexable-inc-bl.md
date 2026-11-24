# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: indexable-inc-blaze-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "indexable-inc-blaze-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T16:54:51.513Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-indexable-inc-blaze-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [indexable-inc-blaze-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T16:54:51.513Z`  
> **Learning ID**: `LEARN-EVO-indexable-inc-blaze-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), H (Technical Construction Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), F (Design Intelligence), B (Product Intelligence), L (Deployment & Operations Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 86%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from indexable-inc-blaze-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/indexable-inc-blaze-learnings.md`  
> **Source**: github ([https://github.com/indexable-inc/blaze](https://github.com/indexable-inc/blaze))  
> **Source Version**: `06036d58`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T16:54:32.755Z  
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
> **Harvest Timestamp**: 2026-11-24T16:54:32.555Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `indexable-inc/blaze`
- **Description**: Incremental rust builds up to 92x faster than cargo/rustc. Backed by Y Combinator (F26).
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 2512 stars

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
use blaze_hash::{BuildKeyHasher, Map, MapOpts, hash_map::Entry as HashEntry};
use blaze_ids::{ContentId, crc32c};
use blaze_mem::Kept;
use blaze_own::Share;
use blaze_keyed::{
    kind::{Namespace, ReservedTag, Tag, TagReach, reach_of},
    store::{ALIGN, ENTRY, FOOTER, HEADER, Holder, Put, RowRefused, SEGMENT_MOST, SegmentId, StoreError, StoreFile, TwoValues},
};

use super::bloom::{BLOOM_ALLOC, BloomBuilder, BloomIndex, BloomMapped, BloomRef};
use super::format::{
    self, Entry, FORMAT, HEAD_LEN, HeadRead, Lease, LostKind, LostMark, Manifest, NEVER, OFFSET_MOST, Retired,
    Root, SLOT_AT, Segment, Slot, aligned, record_crc,
};
use super::verified::{Boot, Checks, Unverified, Verified};
use super::lent::two_values;
use crate::{Corrupt, Key};

/// The lazy open's reads: [`Plain::find`], [`Plain::map_all`], the probe order.
mod probe;
pub use probe::{Found, Probe, Probes};

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
pub const GRACE_NS: u64 = 10 * 60 * 1_000_000_000;

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

/// Default maximum byte budget for a developer's global store (32 GiB).
pub const DEFAULT_MAX_STORE_BYTES: u64 = 32 << 30;

/// Minimum sensible non-zero store byte budget enforced at the CLI/env edge (1 GiB).
pub const MIN_MAX_STORE_BYTES: u64 = 1 << 30;

/// Soft/high watermark percentage of the byte budget (85%): root-LRU eviction begins once
/// committed segment bytes and reachable live bytes exceed this watermark.
pub const WATERMARK_HIGH_PCT: u64 = 85;

/// Low watermark percentage of the byte budget (75%): root-LRU eviction expires oldest roots
/// down toward this watermark for hysteresis, preventing thrashing on every command.
pub const WATERMARK_LOW_PCT: u64 = 75;

/// Computes `pct`% of `cap_bytes` using exact integer arithmetic with zero narrowing casts.
/// `u64::MAX` (unlimited) remains `u64::MAX`; tiny test caps under 100 bytes return `cap_bytes`.
pub const fn watermark_bytes(cap_bytes: u64, pct: u64) -> u64 {
    if cap_bytes == u64::MAX || cap_bytes < 100 {
        return cap_bytes;
    }
    (cap_bytes / 100).saturating_mul(pct).saturating_add((cap_bytes % 100).saturating_mul(pct) / 100)
}

/// How long a running command's lease ([`format::Lease`]) lasts past its last commit: a
/// process that dies holding one is let go of this long after, by the clock the flips pass in.
pub const LEASE_NS: u64 = 60 * 60 * 1_000_000_000;

/// The bytes of segments one [`Liveness::Reached`] slice looks at for their live share, from
/// a place that moves with each generation: what bounds a slice's reading of indexes.
pub const SWEEP_BYTES: u64 = 2 * SLICE_BYTES;

/// How many times one commit carries forward records its roots name whose segment a slice
/// replaced since the command read it ([`Plain::carried`]), before
/// [`StoreError::SweptUnder`] stops it (rule 18: a retry has a count). Why 3: a round is owed
/// only when another process's slice flipped between this commit's read and its flip, and a
/// carried record lies in a segment of this commit's, which no slice can have planned on;
/// what can still go is a record of ANOTHER segment this commit reuses, swept by a second
/// slice landing in the next few milliseconds (each command folds at most one slice, after
/// its answer, from a place that moves with the generation). One round is the expected case,
/// two is two commands' slices meeting one commit, and a third means cleanup lands faster
/// than one commit can flip: that is a store being swept by many processes at once, named
/// by the refusal rather than chased. The rounds cost at most 3 x the carried bytes.
pub const CARRY_ROUNDS: u32 = 3;

/// The tiers' floor `B`: tier 0 holds segments under `B * G` (4 MiB), tier `t >= 1` those of
/// `[B * G^t, B * G^(t+1))`. Why 1 MiB: the small commits of an edit loop (a cleanup commit's
/// records and roots) share tier 0 and are merged at most 4 MiB at a time (the amortisation's
/// `B` a commit, [`Tiers`]); a smaller floor adds a
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
                && !self.dropped.contains(&seg.id)
           
```

### Core Architecture Module: `crates/blaze-cli/src/engine_answer.rs`
```
//! `engine-check`'s stored answer (engine.md E6, the incremental half): the engine's answer and
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
/// checkout from [`BASES_ROOT`] / [`BASES
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
//! The `Bodies` stage of `blaze engine-check` (engine.md E5/E6, "The design" 4): every body of
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
//! THE RUNS: the bodies of one member cut into runs of at most [`RUN`], each run a task of one
//! bstd scope; a run opens its own `Records` over the shared bytes (`Records` opens lazily
//! through `RefCell`s: never shared between threads, view.rs), and every body of the run is
//! checked over one `Tables` with its own recorder (task.rs). The stretch memoizes the IDs
//! of distinct questions over those tables. A panic fails its body alone (rule 20).
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

use blaze_drive::cells::Cell;
use blaze_drive::key::ABSENT;
use blaze_drive::{Input, Key, Kind, Locate, Name};
use blaze_core::SharedSet;
use blaze_engine::{Buffer, CellDigests, CellId, Done, Phase, Planned, SVec, Stage, Stands, Task, View};
use blaze_id::ItemKey;
use blaze_ids::{ContentId, Hasher};
use blaze_ladder::front2::buckets::{ImplShelf, ImplShelfOpts, TableSet};
use blaze_ladder::front2::heads::NeedsMet;
use blaze_ladder::front2::project_records::{BodySource, Listing, index_outlined_by_chain, list_files_with};
use blaze_ladder::front2::source::NamesSource;
use blaze_ladder::front2::tables::cost::{Cost, Gauge};
use blaze_ladder::front2::heads::Want;
use blaze_ladder::front2::tables::head::{CellFailure, ConstValues, FreezeError, NotTheirs, SeededHeads, SeededHeadsOpts, cell_id as head_cell_id};
use blaze_ladder::front2::tables::recorder::{PlacedCell, Recorder, RecorderOpts, TableRead};
use blaze_ladder::front2::tables::seeds::{HeadSeed, RequestSeedOpts, SeedError};
use blaze_ladder::front2::tables::task::{BodyFrame, ReadIds, ReadKeyer, Said as Line, SaidWhat, TaskError, WorkBytes, check_body_item};
use blaze_ladder::front2::tables::view::{Tables, TablesOpts};
use blaze_own::{SharedAlloc, Vec};
use blaze_scope::crate_env::EnvLent;
use blaze_scope::items_record::ItemsRecord;
use blaze_world::crate_list::CrateGraph;
use bstd::clock::Clock;
use bstd::cx::Cx;
use bstd::fs::{Dir, ReadWrite};
use bstd::mem::Frame;
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

/// The most bodies one run checks: a run opens its own records once, and its frame holds every
/// body's lowering until the run ends (a body's frame is the records' lifetime in `check_body`,
/// so it cannot be reset per body yet: see the report's brief), so runs are short.
const RUN: usize = 32;

/// The most predicted cost one run checks, in bytes of its bodies' text (D167 (a): work at item
/// grain, a batch sized by predicted cost and capped, never grouped by origin). A run of short
/// entries ends at [`RUN`] entries or at this; an entry whose bodies are predicted past it (one
/// `storable_nested_arrays!()` call: 704 bodies) is cut into slices of at most this, each its own
/// run on its own worker, joined into the entry's one result after the join ([`join_slices`]);
/// a body predicted past it alone is a slice alone. The predictor is each body's text length,
/// known at plan time from the items record's rows with no text read ([`text_bytes`]); a cap by
/// body COUNT (64) left one slice of 64 bodies at 4,693 ms, 73 ms a body against a mean of 12
/// (profile score-c1725wave42). The cap in ms is this times the measured ms a byte, which the
/// profile's `bodies cost:` line prints each run from the slices it ran (the fit is what states
/// it; 48 KiB is chosen from no fit yet: UNSURE until that line is read).
const SLICE_BYTES: u64 = 48 << 10;

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
    outline: &blaze_file_items::Outline<'_>,
    file: u32,
    key: ItemKey,
    g: blaze_own::Alloc<'static>,
) -> u32 {
    use blaze_scope::resolve::At;
    let len = match items.identity(key) {
        Ok(Some(id)) => match id.at {
            Some(At::File(at)) if at == file => outline.items().get(id.outline.0 as usize).map_or(0, |entry| entry.range.len()),
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
    lens.sort_unstable_by_key(|member| member.0);
    lens
}

/// A run's frame: its records' decoded parts and its bodies' lowerings (reserved, not touched).
const BODIES_FRAME: usize = 1 << 30;

/// The domain of the out of a body no crate of the graph holds.
const OWNERLESS_DOMAIN: &str = "blaze-cli engine bodies ownerless 1";

/// The domain of the ve
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
use blaze_drive::view::{UnitView, ViewKey, ViewPlan, at_view};
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
    Refused { why: &'stati
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

/// Why the store did not hand a body's typed record over: names the body's check and the key.
#[derive(Debug)]
pub(crate) enum TypedReadError {
    /// The command's store refused the get of `key` (its facts record or its typed record).
    Store { body: Name, key: Key, why: blaze_cas::plain::LentError },
    /// The body's run facts record, which names the typed record, did not read: what refused it.
    Facts { body: Name, what: &'static str },
    /// The facts name a typed record the store does not hold: a record lost, never a cue to
    /// check the body again (rule 3).
    Missing { body: Name, key: Key },
}

impl fmt::Display for TypedReadError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TypedReadError::Store { body, key, why } => write!(f, "{body:?}: its record {key:?} could not be read: {why} (rule: engine_body_record.rs)"),
            TypedReadError::Facts { body, what } => write!(f, "{body:?}: its run facts record, which names its typed record, could not be read: {what} (engine_body_facts.rs, engine_body_record.rs)"),
            TypedReadError::Missing { body, key } => write!(f, "{body:?}: its run facts name the typed record {key:?}, which the store does not hold (rule 3: engine_body_record.rs)"),
        }
    }
}

impl core::error::Error for TypedReadError {}

/// What the run's typed reader is made of besides the body ids: the parent hands it the ids at
/// the
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

### Incident Patch 1: `382168c3` (2026-11-24)
**Commit Message**: fix(sota,lir,build): canonicalize non-RPO blocks before SOTA regalloc and preserve unsizable generic struct tail order (#2406)

1. Bug 1 (crypto_bigint::Uint::<4>::from_be_slice infinite loop):
   - Add O(V+E) hot-first dominator-respecting RPO canonicalizer `coldsplit::reorder_blocks_rpo`
     (zero-copy fast path when already dominator-ordered) and preserve dominator order in
     `coldsplit::partition_cold_blocks`.
   - Call `reorder_blocks_rpo` at the end of `run_sroa_thread_cleanup` (where `thread_jumps` can
     fold loop entry into a higher-indexed body block, making `header > latch`) and at the entry
     of `isel::emit_sota_a64_with_abi` (remapping IPRA `call_clobbers`) and `x86_64::emit_sota_x64`
     so linear-interval RPO register allocation and back-edge analyses never misallocate across
     inverted blocks.
   - Add unit tests in `coldsplit.rs` and hardware execution regression tests in `sota/tests.rs`.

2. Bug 2 (tempo-transaction-pool compound_policy_sub_policy_matches_eviction_check capacity overflow):
   - In `blaze-build/src/layout.rs`, detect generic structs whose unsubstituted last field may
     undergo structural `Unsize` coercion (`struct_tail_may_unsize`, 

**File**: `crates/blaze-build/src/layout.rs` (modified, +75/-13)
```diff
@@ -853,6 +853,66 @@ enum Order {
     Increasing,
 }
 
+/// Whether `adt`'s last field (in its unsubstituted definition) can be unsized via a structural
+/// `Unsize` coercion (`&S<SizedTail> -> &S<UnsizedTail>`, e.g. `PolymorphicIter<[MaybeUninit<T>; N]>`
+/// -> `PolymorphicIter<[MaybeUninit<T>]>`, `ArcInner<T>`, `Mutex<T>`, `UnsafeCell<T>`).
+///
+/// Rust requires unsizing a struct to preserve the byte offsets of every field preceding the tail,
+/// so a potentially-unsized tail field must stay last even when monomorphized with a sized,
+/// higher-alignment type (such as `u128` or `[MaybeUninit<(u64, BlobParams)>; 2]`).
+fn struct_tail_may_unsize<'a>(adt: &Adt<'a>, facts: &'a dyn LayoutFacts) -> bool {
+    if adt.generics == 0 {
+        return false;
+    }
+    let [variant] = adt.variants else { return false };
+    let Some(last) = adt.fields.get(variant.fields.range()).and_then(|fs| fs.last()) else {
+        return false;
+    };
+    ty_may_unsize(last.ty, adt.types, facts, 16)
+}
+
+fn ty_may_unsize<'a>(mut ty: PTy, mut tys: blaze_typeck::PTys<'a>, facts: &'a dyn LayoutFacts, mut budget: u8) -> bool {
+    loop {
+        if budget == 0 {
+            return true;
+        }
+        budget -= 1;
+        let Ok(node) = tys.node(ty) else { return true };
+        match node {
+            PNode::Param(_)
+            | PNode::Alias { .. }
+            | PNode::Slice(_)
+            | PNode::Str
+            | PNode::Dynamic(_)
+            | PNode::Foreign(_) => return true,
+            PNode::Adt(inner_key, inner_args) => {
+                let Some(inner) = facts.adt(inner_key) else { return true };
+                if inner.kind != AdtKind::Struct {
+                    return false;
+                }
+                let [v] = inner.variants else { return false };
+                let Some(last) = inner.fields.get(v.fields.range()).and_then(|fs| fs.last()) else {
+                    return false;
+                };
+                match inner.types.node(last.ty) {
+                    Ok(PNode::Param(p)) => {
+                        let Ok(args) = tys.list(inner_args) else { return true };
+                        let Ok(pi) = usize::try_from(p) else { return true };
+                        let Some(&arg) = args.get(pi) else { return true };
+                        ty = arg;
+                    }
+                    Ok(_) => {
+                        ty = last.ty;
+                        tys = inner.types;
+                    }
+                    Err(_) => return true,
+                }
+            }
+            _ => return false,
+        }
+    }
+}
+
 /// A struct-like layout before it is a row.
 struct Uni {
     call_ty: Option<PTy>,
@@ -1507,7 +1567,7 @@ impl<A: Allocator + Clone> Layouts<A> {
                 }
             }
             PNode::Tuple(_) | PNode::Record(..) | PNode::Closure { .. } => {
-                let u = self.univariant(parts, Order::Decreasing, ReprAttrs::RUST, 0, 0, cx.scratch)?;
+                let u = self.univariant(parts, Order::Decreasing, ReprAttrs::RUST, 0, 0, false, cx.scratch)?;
                 self.struct_row(t, u)
             }
             PNode::Union(_) => {
@@ -1530,7 +1590,7 @@ impl<A: Allocator + Clone> Layouts<A> {
                 }
                 if let [only] = parts {
                     let inner = *self.get(self.done(*only).ok_or(Refusal::Malformed("a union member not laid out"))?);
-                    let u = self.univariant(parts, Order::Decreasing, ReprAttrs::RUST, 0, 0, cx.scratch)?;
+                    let u = self.univariant(parts, Order::Decreasing, ReprAttrs::RUST, 0, 0, false, cx.scratch)?;
                     let mut row = self.struct_row(t, u);
                     row.call_ty = inner.call_ty;
                     row.variants = Variants::Single { index: 0 };
@@ -1558,7 +1618,7 @@ impl<A: Allocator + Clone> Layouts<A> {
                     Ok(None) => return Err(Refusal::Unsupported("a coroutine whose state the world did not answer")),
                     Ok(Some(state)) => state,
                 };
-                let u = self.univariant(parts, Order::Decreasing, ReprAttrs::RUST, 0, 0, cx.scratch)?;
+                let u = self.univariant(parts, Order::Decreasing, ReprAttrs::RUST, 0, 0, false, cx.scratch)?;
                 if u64::from(state.size) < u.size || state.align < u.align || u64::from(state.tag_offset) < u.size {
                     return Err(Refusal::Malformed("a coroutine's state smaller than its upvars"));
                 }
@@ -1664,7 +1724,7 @@ impl<A: Allocator + Clone> Layouts<A> {
     /// Fields `parts` (by declaration) placed in `order` from offset `start`, the alignment at
     /// least `min_align`, with `attrs`' packing and alignment. A sized result's size is rounded
     /// up to the alignment; an unsized one's is its tail's offset, unrounded.
-    fn univariant(&mut self, parts: &[PTy], order: Order, attrs: ReprAttrs, start: u64, min_align: u8, scratch: Alloc<'_>
```

**File**: `crates/blaze-build/src/layout/simd.rs` (modified, +1/-1)
```diff
@@ -122,7 +122,7 @@ impl<A: Allocator + Clone> Layouts<A> {
         // field is never under-aligned by it (its alignment divides the vector's).
         let vector_align = align.trailing_zeros() as u8;
         let raised = ReprAttrs { packed: None, align: Some(attrs.align.map_or(vector_align, |a| a.max(vector_align))), ..attrs };
-        let mut u = self.univariant(fields, Order::Declaration, raised, 0, 0, cx.scratch)?;
+        let mut u = self.univariant(fields, Order::Declaration, raised, 0, 0, false, cx.scratch)?;
         // Without `repr(align)`, the struct's size is the rule's: the array rounded up to the
         // vector alignment.
         if attrs.align.is_none() && u.size != size {
```

**File**: `crates/blaze-build/src/layout/tests.rs` (modified, +44/-0)
```diff
@@ -1041,3 +1041,47 @@ fn record_and_union_layouts() {
         assert_eq!(permits(check, ty, &mut ls, &mut cx).unwrap(), want, "{check:?} of union type {}", ty.0);
     }
 }
+
+/// Regression test for structural `Unsize` prefix-offset preservation (`core::array::iter::PolymorphicIter`):
+/// a generic struct whose last field may be unsized (`struct S<T: ?Sized> { alive: (u64, u64), data: T }`)
+/// must keep its tail field last even when instantiated with a higher-alignment sized type (such as
+/// `[u128; 2]`, align 16) so `&S<[u128; 2]>` and `&S<[u128]>` place `alive` at the exact same offset.
+#[test]
+fn unsizable_generic_tail_preserves_prefix_offsets_when_instantiated_with_high_align_sized_type() {
+    let mut w = World::default();
+    let mut g = G::new();
+    let h = blaze_own::testing::heap();
+    let mut ls = Layouts::new_in(h.alloc());
+
+    // `struct Poly<DATA: ?Sized> { start: u64, end: u64, data: DATA }`
+    let poly = w.strukt(1, &[F::Leaf(U64), F::Leaf(U64), F::P(0)], ReprAttrs::RUST);
+    // Nested wrapper: `struct Outer<T: ?Sized> { tag: u8, inner: Poly<T> }`
+    let outer = w.strukt(1, &[F::Leaf(U8), F::AdtP(poly, 0)], ReprAttrs::RUST);
+
+    let u128_ty = g.n(PNode::Uint(UintTy::U128));
+    let usize_ty = g.n(PNode::Uint(UintTy::Usize));
+    let two = g.n(PNode::ConstValue { ty: usize_ty, bits: 2 });
+    let arr_u128 = g.n(PNode::Array(u128_ty, two));
+    let slice_u128 = g.n(PNode::Slice(u128_ty));
+
+    let poly_sized_ty = g.adt(poly, &[arr_u128]);
+    let poly_unsized_ty = g.adt(poly, &[slice_u128]);
+    let poly_sized = lay(&w, &mut g, &mut ls, poly_sized_ty).unwrap();
+    let poly_unsized = lay(&w, &mut g, &mut ls, poly_unsized_ty).unwrap();
+
+    assert_eq!(ls.field_offset(poly_sized, 0), Some(0), "start stays at 0 in sized Poly<[u128; 2]>");
+    assert_eq!(ls.field_offset(poly_sized, 1), Some(8), "end stays at 8 in sized Poly<[u128; 2]>");
+    assert_eq!(ls.field_offset(poly_sized, 2), Some(16), "data stays last at 16 in sized Poly<[u128; 2]>");
+    assert_eq!(ls.field_offset(poly_sized, 0), ls.field_offset(poly_unsized, 0));
+    assert_eq!(ls.field_offset(poly_sized, 1), ls.field_offset(poly_unsized, 1));
+    assert_eq!(ls.field_offset(poly_sized, 2), ls.field_offset(poly_unsized, 2));
+
+    let outer_sized_ty = g.adt(outer, &[arr_u128]);
+    let outer_unsized_ty = g.adt(outer, &[slice_u128]);
+    let outer_sized = lay(&w, &mut g, &mut ls, outer_sized_ty).unwrap();
+    let outer_unsized = lay(&w, &mut g, &mut ls, outer_unsized_ty).unwrap();
+    assert_eq!(ls.field_offset(outer_sized, 0), Some(0), "tag stays at 0 in sized Outer<[u128; 2]>");
+    assert_eq!(ls.field_offset(outer_sized, 1), Some(16), "inner stays last at 16 in sized Outer<[u128; 2]>");
+    assert_eq!(ls.field_offset(outer_sized, 0), ls.field_offset(outer_unsized, 0));
+    assert_eq!(ls.field_offset(outer_sized, 1), ls.field_offset(outer_unsized, 1));
+}
```

**File**: `crates/blaze-emit/src/sota/isel.rs` (modified, +13/-0)
```diff
@@ -2071,6 +2071,19 @@ pub(crate) fn emit_sota_a64_with_abi<'a>(
     let os = if is_macos { crate::Os::MacOs } else { crate::Os::Linux };
     check_subset(&view, has_lse, os)?;
 
+    // Canonicalize into dominator-respecting RPO order before fusion, loop-depth analysis, and
+    // linear-interval register allocation (`regalloc` requires `def_block <= use_block` for all
+    // reachable blocks and `target <= src` for all natural loop back-edges).
+    let rpo_owned = blaze_lir::coldsplit::reorder_blocks_rpo(view, alloc).ok().flatten();
+    let view = rpo_owned.as_ref().map_or(view, |r| r.func.view());
+    let call_clobbers = |new_inst: usize| -> CallClobbers {
+        let orig = rpo_owned
+            .as_ref()
+            .and_then(|r| r.old_inst_of_new.get(new_inst).copied())
+            .unwrap_or(new_inst);
+        call_clobbers(orig)
+    };
+
     let len = view.len();
     let blocks = view.blocks();
     let tail_calls = if preserve_all_cold {
```

**File**: `crates/blaze-emit/src/sota/mod.rs` (modified, +5/-1)
```diff
@@ -46,7 +46,7 @@ use blaze_lir::{
     amac::{AmacOpts, interleave_amac_loops},
     bce::eliminate_redundant_checks,
     bce_hoist::{BceHoistOpts, hoist_loop_bounds_checks},
-    coldsplit::partition_cold_blocks,
+    coldsplit::{partition_cold_blocks, reorder_blocks_rpo},
     egraph::{RegBudget, sota_optimize_fixpoint},
     gemm::{GemmOpts, optimize_gemm_loops},
     ifconv::if_convert,
@@ -216,6 +216,10 @@ fn run_sroa_thread_cleanup<'a>(
     if let Ok(f) = coalesce_cfg(v, alloc) {
         cur = Some(f);
     }
+    let v = cur.as_ref().map_or(input, |f| f.view());
+    if let Ok(Some(rpo)) = reorder_blocks_rpo(v, alloc) {
+        cur = Some(rpo.func);
+    }
     cur.filter(|f| verify(f.view()).is_ok())
 }
 
```

**File**: `crates/blaze-emit/src/sota/tests.rs` (modified, +136/-0)
```diff
@@ -2326,4 +2326,140 @@ mod std_readiness_tests {
         // SAFETY: `func` has signature `extern "C" fn(u64) -> u64`.
         assert_eq!(unsafe { exec.as_fn::<extern "C" fn(u64) -> u64>() }(5), 45);
     }
+
+    /// Regression test for the `crypto_bigint::Uint::<4>::from_be_slice` infinite loop:
+    /// when `thread_jumps` folds a loop entry directly into a higher-indexed body block,
+    /// the resulting CFG is valid SSA but non-RPO (`header > latch`). Both the full SOTA
+    /// pipeline and direct `emit_sota_a64` must canonicalize to dominator-first RPO before
+    /// linear-interval register allocation so values defined in `header` and used in `latch`
+    /// never get clobbered.
+    #[cfg(all(target_arch = "aarch64", target_os = "macos"))]
+    #[test]
+    fn sota_non_rpo_uadd_overflow_loop_matches_evaluator_on_hardware() {
+        let alloc = test_alloc();
+        // 1. Original slot-based checked-add loop (`while j < 4 { buf = j; j += 1; }`).
+        let func = {
+            let mut b = Builder::<Alloc<'static>, Full>::new_in(64, alloc);
+            let sig = b.sig(Conv::C, Variadic::No, &[], &[Param::of(Ty::I64)]);
+            b.set_signature(sig);
+            let [entry, header, body, trap_blk, cont, exit] =
+                [(); 6].map(|_| b.create_block(BlockKind::Normal));
+
+            b.begin(entry);
+            let s_buf = b.slot(8, 3, SlotKind::Named);
+            let s_j = b.slot(8, 3, SlotKind::Named);
+            let p_buf = b.slot_addr(s_buf);
+            let p_j = b.slot_addr(s_j);
+            let zero = b.iconst(Ty::I64, 0);
+            b.store(Flags::NONE, zero, p_buf, 0, MemAttrs::aligned(3));
+            b.store(Flags::NONE, zero, p_j, 0, MemAttrs::aligned(3));
+            b.jump((header, &[]));
+
+            b.begin(header);
+            let j0 = b.load(Ty::I64, Flags::NONE, p_j, 0, MemAttrs::aligned(3));
+            let four = b.iconst(Ty::I64, 4);
+            let cond = b.icmp(IntCond::Ult, j0, four);
+            b.br(Flags::NONE, cond, (body, &[]), (exit, &[]));
+
+            b.begin(body);
+            let j1 = b.load(Ty::I64, Flags::NONE, p_j, 0, MemAttrs::aligned(3));
+            b.store(Flags::NONE, j1, p_buf, 0, MemAttrs::aligned(3));
+            let j2 = b.load(Ty::I64, Flags::NONE, p_j, 0, MemAttrs::aligned(3));
+            let one = b.iconst(Ty::I64, 1);
+            let pair = b.overflow(Op::UaddOverflow, j2, one);
+            let nj = b.project(pair, 0);
+            let ovf = b.project(pair, 1);
+            b.br(Flags::NONE, ovf, (trap_blk, &[]), (cont, &[]));
+
+            b.begin(trap_blk);
+            b.trap(1);
+
+            b.begin(cont);
+            b.store(Flags::NONE, nj, p_j, 0, MemAttrs::aligned(3));
+            b.jump((header, &[]));
+
+            b.begin(exit);
+            let res = b.load(Ty::I64, Flags::NONE, p_buf, 0, MemAttrs::aligned(3));
+            b.ret(&[res]);
+            b.finish_checked().unwrap()
+        };
+
+        assert!(matches!(
+            eval::run_in(func.view(), &[], 10_000, alloc).unwrap(),
+            Outcome::Returned(ref v) if v.as_slice() == [Val::Int(3)]
+        ));
+        let pre = crate::sota::run_sroa_thread_cleanup(func.view(), alloc);
+        let mid_in = pre.as_ref().map_or(func.view(), |f| f.view());
+        let opt = blaze_lir::egraph::sota_optimize_fixpoint(
+            mid_in,
+            blaze_lir::egraph::RegBudget::AARCH64,
+            3,
+            |_| 1,
+            alloc,
+        )
+        .unwrap();
+        let late = crate::sota::run_sota_loop_and_late_passes(
+            opt.func.view(),
+            MAC_ARM64,
+            blaze_lir::egraph::RegBudget::AARCH64,
+            true,
+            Some(blaze_lir::superopt::SuperoptOpts::apple_silicon()),
+            alloc,
+        );
+        let emitted = crate::sota::isel::emit_sota_a64(
+            late.view(),
+            &NoNames,
+            crate::sota::CallMode::GotSlot,
+            MAC_ARM64.features,
+            true,
+            alloc,
+        )
+        .unwrap();
+        let (exec, _) = load_exec(emitted);
+        let f_ptr: extern "C" fn() -> u64 = unsafe { exec.as_fn() };
+        assert_eq!(f_ptr(), 3);
+
+        // 2. Direct non-RPO SSA LIR (latch block 1 before dominating header block 2) emitted
+        //    directly via `emit_sota_a64` without mid-end passes.
+        let non_rpo_src = "\
+func ptr64 sig s0 attrs [] features \"\"
+type t0 = {i64, i1}
+sig s0 = c () -> (i64)
+block0 normal:
+  v0 = iconst i64 0
+  v1 = iconst i64 4
+  v2 = iconst i64 1
+  jump block2(v0)
+block1 normal:
+  v4 = icmp i1 ult, v8, v1
+  br v4, block2(v8), block4()
+block2 normal:
+  v6 = param i64
+  v7 = uadd_overflow t0 v6, v2
+  v8 = project i64 v7, 0
+  v9 = project i1 v7, 1
+  br v9, block3(), block1()
+block3 normal:
+  trap 1
+block4 normal:
+  return (v6)
+";
+        let non_rpo = blaze_lir::parse::parse(non_rpo_src).expect("parses non-RPO LIR");
+        assert!(
+            bl
```

**File**: `crates/blaze-emit/src/sota/x86_64.rs` (modified, +4/-0)
```diff
@@ -823,6 +823,10 @@ pub(crate) fn emit_sota_x64<'a>(
     let has_avx512 = features & blaze_tier::Machine::AVX512 != 0;
     check_x64_subset(&view, has_fma, has_avx2, has_avx512)?;
 
+    // Canonicalize into dominator-respecting RPO order before linear-interval register allocation.
+    let rpo_owned = blaze_lir::coldsplit::reorder_blocks_rpo(view, alloc).ok().flatten();
+    let view = rpo_owned.as_ref().map_or(view, |r| r.func.view());
+
     let len = view.len();
     let uses_sdot_ymm = has_avx2
         && (0..len).any(|i| {
```

**File**: `crates/blaze-lir/src/simplify/coldsplit.rs` (modified, +284/-3)
```diff
@@ -42,6 +42,15 @@ pub struct ColdSplitOutput<A: Allocator> {
     pub stats: ColdSplitStats,
 }
 
+/// Output of [`reorder_blocks_rpo`] when the input CFG was not already dominator-ordered.
+#[derive(Debug)]
+pub struct RpoOrderOutput<A: Allocator> {
+    pub func: Func<A>,
+    /// Maps each instruction index in `func` back to its original instruction index in the input
+    /// view (useful for remapping per-callsite tables such as IPRA `call_clobbers`).
+    pub old_inst_of_new: Vec<usize, A>,
+}
+
 #[inline]
 fn to_idx(v: u32) -> usize {
     usize::try_from(v).unwrap_or(usize::MAX)
@@ -358,22 +367,29 @@ pub fn partition_cold_blocks<A: Allocator + Copy>(
 
     // Step 3: Build partitioned layout order: all hot blocks in original relative order
     // (entry block `0` always first), followed by all cold blocks in original relative order.
+    // If that order is not dominator-respecting (every reachable non-entry block must have at
+    // least one reachable predecessor placed strictly earlier), fall back to hot-first DFS RPO
+    // so downstream linear-interval register allocation and back-edge analyses remain sound.
     let mut order: Vec<usize, A> = Vec::with_capacity_in(blocks, alloc);
-    let mut out_is_cold: Vec<bool, A> = Vec::with_capacity_in(blocks, alloc);
     for b in 0..blocks {
         if !at(&cold, b, false) {
             order.push(b);
-            out_is_cold.push(false);
         }
     }
     let mut cold_count = 0u32;
     for b in 0..blocks {
         if at(&cold, b, false) {
             order.push(b);
-            out_is_cold.push(true);
             cold_count += 1;
         }
     }
+    if !is_order_dominator_valid(blocks, &succs, &order, alloc) {
+        order = compute_hot_first_rpo(blocks, &succs, &cold, alloc);
+    }
+    let mut out_is_cold: Vec<bool, A> = Vec::with_capacity_in(blocks, alloc);
+    for &old_b in order.iter() {
+        out_is_cold.push(at(&cold, old_b, false));
+    }
 
     let mut new_block = filled(blocks, NONE, &alloc);
     let mut new_inst = filled(len, NONE, &alloc);
@@ -446,6 +462,209 @@ pub fn partition_cold_blocks<A: Allocator + Copy>(
     Ok(ColdSplitOutput { func, is_cold: out_is_cold, stats })
 }
 
+/// Checks whether `order` (a permutation of `0..blocks` with `order[0] == 0`) is dominator-ordered:
+/// every reachable block `b != 0` has at least one reachable predecessor placed strictly earlier
+/// in `order`, and every reachable block precedes any unreachable block.
+///
+/// Proof: if `u` strictly dominates reachable `v` with `pos[v] < pos[u]`, let `w` be the block
+/// strictly dominated by `u` with minimum `pos[w]`; its reachable predecessor `p` with
+/// `pos[p] < pos[w]` must also be dominated by `u` (and `p != u` since `pos[p] < pos[w] < pos[u]`),
+/// contradicting minimality of `w`.
+fn is_order_dominator_valid<A: Allocator + Copy>(
+    blocks: usize,
+    succs: &[Vec<u32, A>],
+    order: &[usize],
+    alloc: A,
+) -> bool {
+    if blocks <= 1 {
+        return true;
+    }
+    if order.first().copied() != Some(0) || order.len() != blocks {
+        return false;
+    }
+    let mut pos = filled(blocks, NONE, &alloc);
+    for (p, &b) in order.iter().enumerate() {
+        set_at(&mut pos, b, u32_of(p));
+    }
+    // Mark blocks reachable from entry block `0` via iterative DFS.
+    let mut reachable = filled(blocks, false, &alloc);
+    let mut stack: Vec<usize, A> = Vec::with_capacity_in(blocks, alloc);
+    set_at(&mut reachable, 0, true);
+    stack.push(0);
+    while let Some(b) = stack.pop() {
+        if let Some(sb) = succs.get(b) {
+            for &s in sb.iter() {
+                let si = to_idx(s);
+                if !at(&reachable, si, true) {
+                    set_at(&mut reachable, si, true);
+                    stack.push(si);
+                }
+            }
+        }
+    }
+    let mut has_earlier_pred = filled(blocks, false, &alloc);
+    set_at(&mut has_earlier_pred, 0, true);
+    for b in 0..blocks {
+        if !at(&reachable, b, false) {
+            continue;
+        }
+        let pb = at(&pos, b, NONE);
+        if let Some(sb) = succs.get(b) {
+            for &s in sb.iter() {
+                let si = to_idx(s);
+                if pb < at(&pos, si, 0) {
+                    set_at(&mut has_earlier_pred, si, true);
+                }
+            }
+        }
+    }
+    for b in 1..blocks {
+        if at(&reachable, b, false) && !at(&has_earlier_pred, b, false) {
+            return false;
+        }
+    }
+    true
+}
+
+/// Computes a deterministic, iterative hot-first Reverse Post-Order (RPO) over `0..blocks`.
+///
+/// Cold successors are explored first in post-order so they land last in RPO while strictly
+/// preserving dominator-before-dominated ordering for all reachable blocks (and any unreachable
+/// components appended at the tail).
+fn compute_hot_first_rpo<A: Allocator + Copy>(
+    blocks: usize,
+    succs: &[Vec<u32, A>],
+    is_cold: &[bool],
+    allo
```

---

### Incident Patch 2: `66cb28b3` (2026-11-24)
**Commit Message**: fix(emit): eliminate >8 MiB stack-frame overflow & 68s emit blowup on large functions (#2400)

Root causes in blaze-emit:
1. SOTA (sota/isel.rs) laid out all LIR stack slots disjointly without lifetime
   coloring; functions with >32 KiB of raw temp slots (e.g. syn::ty::parsing::ambig_ty
   with 39,880 B across 344 temp + 163 named slots) left max_spill_slots = 0,
   triggering OutOfSpillSlots and falling back to the Reference tier.
2. Reference (pass.rs) allocated 16 bytes per SSA instruction unconditionally
   (600,259 * 16 = 9.6 MiB in ambig_ty), overflowing the 8 MiB macOS main stack
   on the very first call and emitting 13.42 MiB of code.
3. Functions >1 MiB also exceeded ARM64 +/-1 MiB imm19 conditional-branch / adr
   reach in SOTA.
4. Three O(B^2)/O(N^2) loops burned ~68 s emitting large syn/serde/clap functions:
   sota/release_opts.rs::compute_block_order, per-Switch/Unreachable
   blaze_lir::verify::sole_switch_default scans in isel.rs/pass.rs, and linear
   scans over busy/call/back-edge tables in sota/regalloc.rs.

Fixes:
- Add pass/frame.rs providing:
  * pack_slots: sound forward may-addressed LIR stack-slot lifetime coloring
    shared by SOTA and Reference (proven

**File**: `crates/blaze-emit/src/pass.rs` (modified, +49/-50)
```diff
@@ -23,6 +23,7 @@ pub(crate) mod atomic;
 mod bulk;
 mod float;
 mod float_width;
+pub(crate) mod frame;
 mod int;
 pub(crate) mod probe;
 /// Branches and PC-relative references past a short field's reach: islands and long forms.
@@ -132,11 +133,15 @@ struct Pass<'a, 'c, A: Allocator> {
     data_index: Vec<u32, Global>,
     /// The data rows `data_addr` reaches, in the order they are placed.
     placed: Vec<u32, Global>,
+    /// Per value, the offset from `sp` of its cell (`NONE` for `Ty::NONE` instructions).
+    cell_at: blaze_own::AVec<'c, u32>,
+    /// Total bytes occupied by all cells (past the last cell's end).
+    cells_end: u64,
     /// Per stack slot, its offset from `sp`.
-    slot_at: Vec<u32, Global>,
+    slot_at: blaze_own::AVec<'c, u32>,
     /// Per value, the offset from `sp` of the third word of a wide pair (lib.rs, "Pairs": an
     /// `i128` and a narrow integer, 24 bytes, past its 16-byte cell); `NONE` for any other.
-    wide_pair_at: Vec<u32, Global>,
+    wide_pair_at: blaze_own::AVec<'c, u32>,
     /// Where the staging words of a block's arguments start, from `sp`.
     staging_at: u32,
     /// The most staging words an edge took.
@@ -148,6 +153,8 @@ struct Pass<'a, 'c, A: Allocator> {
     most_align: u64,
     /// Where each landing block's `sp` restore starts (pass/stack.rs), patched with the frame.
     sp_fixes: Vec<u32, Global>,
+    /// Per block, its sole empty-arg `Op::Switch` default terminator (`NONE` otherwise).
+    sole_switch_default: blaze_own::AVec<'c, u32>,
     /// The block being lowered.
     block: Block,
     /// The short fields still to be placed in reach, and the islands' rows (pass/reach.rs).
@@ -179,43 +186,17 @@ pub(crate) fn run<A: Allocator>(
     check_sig(view, isa, view.sigs[view.head.sig as usize], sig.params, sig.rets)
         .map_err(|why| EmitError::Signature { why })?;
 
-    // The frame: a 16-byte cell per value, then the third word of each wide pair (in 16-byte
-    // steps, so every cell stays 16-aligned), then each slot at its alignment, then the
-    // staging words; `sp` aligned to the most any slot asks.
-    let cells = view.len() as u64 * 16;
-    let mut at = cells;
-    let mut wide_pair_at = Vec::with_capacity_in(view.len(), Global);
-    for value in 0..view.len() {
-        match wide::is_wide_pair(view, view.ty(Value(value as u32))) {
-            true => {
-                wide_pair_at.push(at as u32);
-                at += 16;
-                if at >= FRAME_LIMIT {
-                    return Err(EmitError::TooLarge { what: "the frame (16 MiB)" });
-                }
-            }
-            false => wide_pair_at.push(NONE),
-        }
-    }
-    let mut most_align: u64 = 16;
-    let mut slot_at = Vec::with_capacity_in(view.slots.len(), Global);
-    for slot in view.slots {
-        if slot.align > MOST_SLOT_ALIGN {
-            return Err(EmitError::TooLarge { what: "a stack slot's alignment (past 4 KiB)" });
-        }
-        let align = 1u64 << slot.align;
-        most_align = most_align.max(align);
-        at = at.next_multiple_of(align);
-        slot_at.push(at as u32);
-        at += u64::from(slot.size);
-        if at >= FRAME_LIMIT {
-            return Err(EmitError::TooLarge { what: "the frame (16 MiB)" });
-        }
-    }
-    let staging_at = at.next_multiple_of(8);
+    // The frame: lifetime-colored value cells (8/16/32 bytes by size class; 0 bytes for `Ty::NONE`),
+    // then lifetime-colored LIR stack slots at their alignment, then the staging words; `sp`
+    // aligned to the most any slot asks (pass/frame.rs).
+    let cells = frame::layout_cells(view, scratch)?;
+    let slots = frame::pack_slots(view, cells.end, scratch)?;
+    let staging_at = slots.end.next_multiple_of(8);
     if staging_at >= FRAME_LIMIT {
         return Err(EmitError::TooLarge { what: "the frame (16 MiB)" });
     }
+    let most_align = slots.most_align;
+    let sole_switch_default = frame::sole_switch_defaults(view, scratch);
 
     let mut block_at = Vec::with_capacity_in(view.blocks(), Global);
     block_at.resize(view.blocks(), NONE);
@@ -241,14 +222,17 @@ pub(crate) fn run<A: Allocator>(
         block_at,
         ref_literal,
         data_index,
+        cell_at: cells.cell_at,
+        cells_end: cells.end,
         placed: Vec::new_in(Global),
-        slot_at,
-        wide_pair_at,
+        slot_at: slots.slot_at,
+        wide_pair_at: cells.wide_pair_at,
         staging_at: staging_at as u32,
         staging: 0,
         record,
         most_align,
         sp_fixes: Vec::new_in(Global),
+        sole_switch_default,
         block: Block(0),
         far: reach::Far::new(reach, view, scratch),
     };
@@ -619,21 +603,30 @@ impl<A: Allocator> Pass<'_, '_, A> {
     /// nothing writes `x9`. Any other `unreachable` is `Unknown`, never a guess.
     fn held_at_unreachable(&self, inst: usize) -> blaze_code::record::Held {
         let first = self.view.block(self.block).start == inst;
- 
```

**File**: `crates/blaze-emit/src/pass/asm.rs` (modified, +2/-2)
```diff
@@ -267,7 +267,7 @@ impl<A: Allocator> Pass<'_, '_, A> {
             let Some(v) = p.input else { continue };
             let ty = view.ty(v);
             let bits = bits_of(self.width(ty), ty).map_err(|why| unsupported(inst, op, why))?;
-            let off = v.0 * 16;
+            let off = self.cell_of(v.index());
             match (p.bank, bits) {
                 (Bank::X, Some(_)) => self.asm_word(true, p.reg, off, far),
                 (Bank::X, None) => return Err(unsupported(inst, op, "an `i128` or `f128` `asm!` operand in a general register")),
@@ -305,7 +305,7 @@ impl<A: Allocator> Pass<'_, '_, A> {
         for p in placed.iter().flatten() {
             let Some(member) = p.member else { continue };
             let (ty, off) = match pair {
-                None => (result, inst as u32 * 16),
+                None => (result, self.cell_of(inst)),
                 Some(tys) => (tys[member as usize], self.value_word_at(inst, member)),
             };
             let bits = bits_of(self.width(ty), ty).map_err(|why| unsupported(inst, op, why))?;
```

**File**: `crates/blaze-emit/src/pass/atomic.rs` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@ impl<A: Allocator> Pass<'_, '_, A> {
                 self.put(enc::cmp(X12, X10));
                 self.put(enc::cset(X13, Cond::Eq));
                 self.st(X12, inst);
-                self.st_sp(X13, inst as u32 * 16 + 8);
+                self.st_sp(X13, self.cell_of(inst) + 8);
             }
         }
         Ok(())
```

**File**: `crates/blaze-emit/src/pass/float_width.rs` (modified, +2/-2)
```diff
@@ -139,7 +139,7 @@ impl<A: Allocator> Pass<'_, '_, A> {
                 self.put(enc::umov_h0(X9, v));
                 self.st(X9, inst);
             }
-            FloatWidth::Quad => self.q_cell(false, v, inst as u32 * 16),
+            FloatWidth::Quad => self.q_cell(false, v, self.cell_of(inst)),
         }
     }
 
@@ -151,7 +151,7 @@ impl<A: Allocator> Pass<'_, '_, A> {
                 self.ld(X9, value);
                 self.put(enc::fmov_to_s(v, X9));
             }
-            FloatWidth::Quad => self.q_cell(true, v, value.0 * 16),
+            FloatWidth::Quad => self.q_cell(true, v, self.cell_of(value.index())),
         }
     }
 
```

**File**: `crates/blaze-emit/src/pass/frame.rs` (added, +1046/-0)
```diff
@@ -0,0 +1,1046 @@
+//! Frame layout for `pass.rs` (Reference tier) and shared LIR stack-slot lifetime coloring
+//! (reused by `sota/isel.rs`, rule 30: one concept, one home).
+//!
+//! # Why this exists
+//!
+//! Without cell and slot coloring, a function with N LIR instructions and S stack slots gets a
+//! frame of `16 * N + sum(slot.size)`: `syn::ty::parsing::ambig_ty` (~600k instructions, ~500
+//! slots) produced a >9.2 MiB stack frame (overflowing macOS's 8 MiB main stack on its first
+//! call) and 13.4 MiB of code because every cell past 32 KiB needed 3 instructions per access.
+//!
+//! # Two independent, strictly bounded, deterministic colorings
+//!
+//! 1. **SSA value cell coloring ([`layout_cells`])**:
+//!    - Instructions with `Ty::NONE` get no cell (0 bytes).
+//!    - Value-producing instructions get exact size/alignment classes: 8 bytes (8-aligned) for
+//!      <=64-bit scalars, 16 bytes (16-aligned) for `i128`, `f128`, 2-word pairs, and `asm!`
+//!      operands/results (which may use 16-byte `ldr q`/`str q`), and 32 bytes (16-aligned,
+//!      holding the 3 words of a wide `{i128, iN}` pair).
+//!    - Live intervals `[lo, hi]` (inclusive) are computed in O(N + E): block-local non-`Param`
+//!      values keep exact `[v, last_use(v)]`; cross-block values and block parameters extend over
+//!      every overlapping merged back-edge connected component (100% sound on arbitrary CFGs,
+//!      including irreducible loops, switches, invokes, landing pads, and unreachable blocks).
+//!    - Linear scan with counting-sort by `lo`, a binary min-heap of active intervals ordered by
+//!      `hi`, and O(1) per-class free lists runs in O(N log K) where K is peak live values.
+//!
+//! 2. **LIR stack-slot lifetime coloring ([`pack_slots`])**:
+//!    - Forward may-addressed dataflow over the CFG, matching LIR's `SlotLive`/`SlotDead`
+//!      semantics (`blaze-lir/src/eval.rs`, `coroutine_overlap.rs`), and hardened against mid-end
+//!      `SlotAddr` hoisting/GVN (`blaze-lir/src/simplify/egraph.rs`): a slot becomes live at
+//!      `SlotLive` and at every non-address-arithmetic instruction that consumes a pointer
+//!      derived from `SlotAddr(slot)` (`PtrAdd`/`Freeze`/`PtrWithAddr` propagate provenance), and
+//!      becomes dead at `SlotDead(slot)` unless its pointer entered a block `Param` or `Select`.
+//!    - Slots in disjoint `if/else` or `match` arms never conflict even without `SlotDead`, and
+//!      sequential temporaries bounded by `SlotDead` share stack bytes.
+//!    - Greedy placement in deterministic `(Reverse(size), Reverse(align), slot_idx)` order.
+
+use core::alloc::Allocator;
+use core::cmp::Reverse;
+
+use blaze_lir::{
+    Block, Op, Scalar, Ty, Value, View,
+    func::NONE,
+    op::{Layout, Word, walk},
+};
+use blaze_own::Vec;
+
+use super::{FRAME_LIMIT, MOST_SLOT_ALIGN, float_width::FloatWidth, wide};
+use crate::EmitError;
+
+/// Maximum `blocks * words` bitset entries allocated during slot conflict analysis (32 MiB cap,
+/// rule 18: bounded memory even on pathological inputs).
+const MAX_SLOT_BITSET_WORDS: usize = 4_000_000;
+
+#[inline]
+fn idx(n: u32) -> usize {
+    usize::try_from(n).unwrap_or(usize::MAX)
+}
+
+#[inline]
+fn u32_of(n: usize) -> u32 {
+    u32::try_from(n).unwrap_or(u32::MAX)
+}
+
+#[inline]
+fn u32_of_u64(n: u64) -> u32 {
+    u32::try_from(n).unwrap_or(u32::MAX)
+}
+
+#[inline]
+fn get_u32(s: &[u32], i: usize) -> u32 {
+    s.get(i).copied().unwrap_or(NONE)
+}
+
+#[inline]
+fn set_u32(s: &mut [u32], i: usize, v: u32) {
+    if let Some(slot) = s.get_mut(i) {
+        *slot = v;
+    }
+}
+
+#[inline]
+fn filled<T: Copy, A: Allocator>(len: usize, val: T, alloc: A) -> Vec<T, A> {
+    let mut v = Vec::with_capacity_in(len, alloc);
+    for _ in 0..len {
+        v.push(val);
+    }
+    v
+}
+
+/// Cell size/alignment class for one LIR instruction in `pass.rs`.
+#[derive(Clone, Copy, PartialEq, Eq, Debug)]
+#[repr(u8)]
+enum CellClass {
+    /// `Ty::NONE`: no cell allocated.
+    None = 0,
+    /// Single 64-bit word (8 bytes, 8-aligned).
+    W8 = 1,
+    /// Two 64-bit words or 16-byte vector/quad (16 bytes, 16-aligned).
+    W16 = 2,
+    /// Three 64-bit words for a wide `{i128, iN}` pair (32-byte stride, 16-aligned).
+    W24 = 3,
+}
+
+/// Compact cell layout produced by [`layout_cells`] for `pass.rs`.
+pub(crate) struct CellLayout<A: Allocator> {
+    /// Per instruction, byte offset from `sp` of its cell (`NONE` for `Ty::NONE` instructions).
+    pub(crate) cell_at: Vec<u32, A>,
+    /// Per instruction, byte offset from `sp` of a wide pair's third word (`NONE` otherwise).
+    pub(crate) wide_pair_at: Vec<u32, A>,
+    /// Total bytes occupied by all cells (multiple of 8).
+    pub(crate) end: u64,
+}
+
+/// Compact LIR stack-slot layout produced by [`pack_slots`].
+pub(crate) struct SlotLayout<A: Allocator> {
+    /// Per stack slot `0..view.slots.len()`, byte offset from `sp`.
+    pub(crate) slot_at: Vec<u32, A>,
+    /// Hig
```

**File**: `crates/blaze-emit/src/pass/int.rs` (modified, +1/-1)
```diff
@@ -207,7 +207,7 @@ impl<A: Allocator> Pass<'_, '_, A> {
         }
         self.narrow(X11, width);
         self.st(X11, inst);
-        self.st_sp(X12, inst as u32 * 16 + 8);
+        self.st_sp(X12, self.cell_of(inst) + 8);
         Ok(())
     }
 
```

**File**: `crates/blaze-emit/src/pass/stack.rs` (modified, +4/-3)
```diff
@@ -145,10 +145,11 @@ impl<A: Allocator> Pass<'_, '_, A> {
         let from = 16 + slot.at;
         let from = i32::try_from(from).map_err(|_| EmitError::TooLarge { what: "a stacked parameter's offset" })?;
         if bits == 128 {
+            let off = self.cell_of(inst);
             self.mem(true, Size::X, X9, FP, from);
-            self.st_sp(X9, inst as u32 * 16);
+            self.st_sp(X9, off);
             self.mem(true, Size::X, X9, FP, from + 8);
-            self.st_sp(X9, inst as u32 * 16 + 8);
+            self.st_sp(X9, off + 8);
             return Ok(());
         }
         self.mem(true, size_of_bytes(slot.bytes), X9, FP, from);
@@ -204,7 +205,7 @@ impl<A: Allocator> Pass<'_, '_, A> {
                 self.st_sp_sized(Size::X, X9, at);
                 continue;
             }
-            let cell = arg.value.0 * 16 + area;
+            let cell = self.cell_of(arg.value.index()) + area;
             if bytes == 16 {
                 self.ld_sp(X9, cell);
                 self.st_sp_sized(Size::X, X9, at);
```

**File**: `crates/blaze-emit/src/pass/variadic.rs` (modified, +2/-2)
```diff
@@ -172,7 +172,7 @@ impl<A: Allocator> Pass<'_, '_, A> {
         }
         let base = named_end.next_multiple_of(8);
         let area = (base + area_of(slots)).next_multiple_of(16);
-        if area >= super::stack::MOST_AREA || view.len() as u64 * 16 + u64::from(area) >= super::FRAME_LIMIT {
+        if area >= super::stack::MOST_AREA || self.cells_end + u64::from(area) >= super::FRAME_LIMIT {
             return Err(EmitError::TooLarge { what: "a call's stacked arguments (1 MiB, and every cell below 16 MiB while they are open)" });
         }
         // The registers, while every cell is still at its own offset.
@@ -201,7 +201,7 @@ impl<A: Allocator> Pass<'_, '_, A> {
                 // zero-extended to 64 bits (lib.rs, "Values"); the callee's `va_arg` of an `int`
                 // reads the slot's low 4 bytes (little-endian), of a `long`, a pointer or a
                 // `double` all 8.
-                self.ld_sp(X9, value.0 * 16 + area);
+                self.ld_sp(X9, self.cell_of(value.index()) + area);
                 self.st_sp_sized(Size::X, X9, base + offset);
             }
         }
```

---

### Incident Patch 3: `0ea4c294` (2026-11-24)
**Commit Message**: fix(blaze-ladder): resolve txpool FutureWitness, ObjectTrait NeedConst, and lazy ImplsOf round cap (#2394)

1. FutureWitness (stalled async auto-trait goals in check_body + witness state recipes):
   - check_body_keyed now defers stalled async auto-trait goals (Stalls::Decide) when
     count is None and decides them on each async block's exact witness interior via
     borrows::witness_and_decide, matching ProjectWorld::check / check_borrows.
     Non-Send futures still fail with E0277 diagnostics; clean checks clear done.stalled.
   - coroutine_recipes::recipes_of now lowers via lower_async_witness + AsyncWitness::state_recipe
     (matching exact_interior.rs) so region-lowering gaps do not block state recipe creation.

2. ObjectTrait NeedConst (program::object_tables):
   - object_tables now ensures Want::Head and Want::Members through ensure_trait_want,
     evaluating Why::NeedConst via check::eval_len up to MOST_ADT_LENS (e.g. BlobStore::get_cells
     const-sized array/alias types).

3. Lazy instance resolution ImplsOf round cap (run/make_one.rs):
   - Replaced the bare MOST_ROUNDS (256) retry cap in run_instance_loop, verify_rows, and
     make_static with progress-gated As

**File**: `crates/blaze-ladder/src/code_reads.rs` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ pub const TERM_NODES: usize = 1 << 16;
 pub const READS_CAP: usize = 1 << 20;
 
 /// What a row asked (the module doc's list). The byte is the question's first.
-#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
+#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
 #[repr(u8)]
 pub enum ReadKind {
     Adt = 1,
```

**File**: `crates/blaze-ladder/src/front2/body_reads.rs` (modified, +47/-2)
```diff
@@ -29,7 +29,7 @@ use blaze_typeck as tc;
 use blaze_typeck::{ItemKey, ReadList};
 
 use super::body::Body;
-use super::check::{BodyScope, CheckFail, Records, check_rounds};
+use super::check::{BodyScope, CheckFail, Records};
 use super::source::NamesSource;
 
 const READS_DOMAIN: &str = "blaze-ladder checked body read list 1";
@@ -425,7 +425,12 @@ pub(crate) fn check_body_keyed<'n, S: NamesSource<'n>>(
     root_keys: Option<&mut std::vec::Vec<u64, Global>>,
 ) -> Result<tc::Checked<'static>, CheckFail> {
     r.store.provisional_used.borrow_mut().clear();
-    let mut done = check_rounds(r, body, scope, count, asked, root_keys)?;
+    // Defer auto-trait goals on async futures whose superset interior fails, then decide them on
+    // each async block's exact witness interior (stalled_goals.rs, borrows.rs `witness_and_decide`),
+    // matching `ProjectWorld::check` and `ProjectWorld::check_borrows`. `check_counted` has no
+    // deferring entry and keeps `Stalls::Gap`.
+    let stalls = if count.is_none() { super::stalled_goals::Stalls::Decide } else { super::stalled_goals::Stalls::Gap };
+    let mut done = super::check::check_rounds_as(r, body, scope, count, asked, stalls, root_keys)?;
     let scratch = r.store.tys.alloc();
     let owner = body.typeck.owner;
     let mut used_provisional = false;
@@ -441,6 +446,46 @@ pub(crate) fn check_body_keyed<'n, S: NamesSource<'n>>(
     }
     // Its opaques' hidden types, for an auto trait asked by another body (front2 opaque_auto.rs).
     super::opaque_auto::file(r, body, &done)?;
+    if !done.stalled.is_empty() {
+        let mut decision_reads: AVec<'_, super::reads::Read> = AVec::new_in(scratch);
+        let at = body.typeck.expr_ranges.get(body.typeck.root.ix()).copied().unwrap_or(tc::Range { start: 0, end: 0 });
+        match super::borrows::witness_and_decide(r, body, &done, &mut decision_reads, scratch) {
+            super::stalled_goals::Decision::Nothing | super::stalled_goals::Decision::Proved => {
+                done.stalled.clear();
+            }
+            super::stalled_goals::Decision::Findings(found) => {
+                let diags = found
+                    .into_iter()
+                    .map(|d| (tc::DiagCode::Unsatisfied, tc::Range { start: d.start, end: d.end }, d.text.as_str().into()))
+                    .collect();
+                return Err(super::check::said(r, owner, diags, scratch));
+            }
+            super::stalled_goals::Decision::Gaps(gaps) => {
+                return Err(CheckFail::Gap { owner, gaps });
+            }
+            super::stalled_goals::Decision::Refused(super::project::Refused::Check(fail)) => {
+                return Err(fail);
+            }
+            super::stalled_goals::Decision::Refused(_) => {
+                return Err(CheckFail::Check {
+                    owner,
+                    error: tc::CheckError::FutureWitness {
+                        reason: "deciding the stalled auto-trait goals of an async body refused",
+                        at,
+                    },
+                });
+            }
+            super::stalled_goals::Decision::Reads(_) => {
+                return Err(CheckFail::Check {
+                    owner,
+                    error: tc::CheckError::FutureWitness {
+                        reason: "deciding the stalled auto-trait goals of an async body failed to record its read list",
+                        at,
+                    },
+                });
+            }
+        }
+    }
     let filed = done.file_out();
     // A check that read a provisional impl header during constant evaluation does not file its
     // read-list digest: once the impl's associated types finish, subsequent checks read the
```

**File**: `crates/blaze-ladder/src/front2/borrows.rs` (modified, +1/-1)
```diff
@@ -3000,7 +3000,7 @@ fn gap_words<'n, S: NamesSource<'n>>(r: &Records<'_, 'n, S>, callee: tc::ItemKey
 /// `FutureWitness` by `decide_stalled_goals`, never a pass (rule 3).
 pub(super) fn witness_and_decide<'n, 'a, S: NamesSource<'n>>(
     r: &mut Records<'_, 'n, S>,
-    body: &Body<'n>,
+    body: &Body<'_>,
     done: &tc::Checked<'_>,
     reads: &mut AVec<'a, Read>,
     alloc: Alloc<'a>,
```

**File**: `crates/blaze-ladder/src/front2/check.rs` (modified, +1/-18)
```diff
@@ -210,23 +210,6 @@ pub fn check_body_metered<'n, S: NamesSource<'n>>(
     super::body_reads::check_body_keyed(r, body, scope, Some((tally, clock)), None, Some(root_keys))
 }
 
-/// The check loop itself: `body` checked round by round, leaving in `asked` what a check that
-/// did NOT end in a clean `Checked` asked of the world (front2 reads.rs: every body has a read
-/// list): the read list of a run that finished but is returned as a failure (diagnostics, or a
-/// gap answered as missing), and the questions of the last round that ended in a need. A clean
-/// check's list is still in its `Checked`: only [`check_body_asked`] and [`check_body_filed`]
-/// (front2 body_reads.rs) call this, and each files the list out before the `Checked` is kept.
-pub(crate) fn check_rounds<'n, S: NamesSource<'n>>(
-    r: &mut Records<'_, 'n, S>,
-    body: &Body<'_>,
-    scope: &BodyScope<'_>,
-    count: Option<(&mut tc::Tally, &dyn tc::Clock)>,
-    asked: Option<&mut super::reads::Asked<'_>>,
-    root_keys: Option<&mut Vec<u64, Global>>,
-) -> Result<tc::Checked<'static>, CheckFail> {
-    check_rounds_as(r, body, scope, count, asked, super::stalled_goals::Stalls::Gap, root_keys)
-}
-
 /// The E0412s and E0405s of `owner`'s OWN signature (its head's [`super::type_miss::HeadMiss`]es, in the
 /// store the head was made in or one filed from its record), as findings of its body's check:
 /// item-relative in the fn's text, as its body's own misses are. A caller's check never asks
@@ -238,7 +221,7 @@ fn signature_misses<'r, 'n, S: NamesSource<'n>>(r: &'r Records<'_, 'n, S>, owner
 
 /// The body `owner` finished with the findings `diags`: each filed where its tokens came from,
 /// before it leaves the task that made it (drive.md, ruled 20:57), in `alloc` (the store's).
-fn said<'n, S: NamesSource<'n>>(r: &Records<'_, 'n, S>, owner: ItemKey, diags: Vec<(tc::DiagCode, tc::Range, Box<str>), Global>, alloc: blaze_own::Alloc<'_>) -> CheckFail {
+pub(super) fn said<'n, S: NamesSource<'n>>(r: &Records<'_, 'n, S>, owner: ItemKey, diags: Vec<(tc::DiagCode, tc::Range, Box<str>), Global>, alloc: blaze_own::Alloc<'_>) -> CheckFail {
     let lib = r.keys.library_in(r.names, owner);
     // A member of a trait or an impl has no library key (keys.rs `library_in`): it is placed by
     // its container's, its text found in the container's (expansion_origin.rs
```

**File**: `crates/blaze-ladder/src/front2/coroutine_recipes.rs` (modified, +6/-3)
```diff
@@ -11,8 +11,8 @@
 use std::alloc::Global;
 use std::vec::Vec;
 
-use blaze_flow_lower::state_recipe::{StateRecipe, state_recipe};
-use blaze_flow_lower::{Refusal, lower_async};
+use blaze_flow_lower::state_recipe::StateRecipe;
+use blaze_flow_lower::{Refusal, lower_async_witness};
 use blaze_own::Alloc;
 use blaze_typeck as tc;
 
@@ -49,7 +49,10 @@ pub fn recipes_of<'n, S: NamesSource<'n>>(
     let tys = body.tys.view(&r.store.tys)?;
     let view = body.typeck.view(tys);
     for (ordinal, block) in blaze_build::coroutines_in(&view) {
-        let recipe = lower_async(&view, done, block, &nested, alloc).and_then(|lowered| state_recipe(&view, &lowered, Global));
+        // The WITNESS lowering (`one_call::Erased`), matching `exact_interior.rs`: what the state
+        // stores needs no region, so a region refusal of the borrow lowering never leaves an async
+        // block without its state recipe.
+        let recipe = lower_async_witness(&view, done, block, &nested, alloc).and_then(|w| w.state_recipe(&view, Global));
         rows.push((owner, ordinal, recipe));
     }
     Ok(())
```

**File**: `crates/blaze-ladder/src/front2/program.rs` (modified, +103/-2)
```diff
@@ -547,6 +547,43 @@ fn dyn_principals<'v>(views: impl Iterator<Item = PTys<'v>>) -> Vec<ItemKey, Glo
 }
 
 /// Each trait of `asked` not yet in `tables`, with every supertrait under it, made into
+/// Why ensuring a trait's head or members for [`object_tables`] failed.
+enum TraitWantError {
+    Const { key: LibKey, error: super::consts::ConstFail },
+    Head(super::heads::HeadError),
+}
+
+impl core::fmt::Display for TraitWantError {
+    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
+        match self {
+            TraitWantError::Const { key, error } => write!(f, "the constant {key:x} its head names: {error:?}"),
+            TraitWantError::Head(e) => write!(f, "{e:?}"),
+        }
+    }
+}
+
+/// Ensures a trait head or member table (`Want::Head` or `Want::Members`), evaluating any
+/// constants its signature types name (`Why::NeedConst`, e.g. array lengths or const generic
+/// arguments in method signatures such as `BlobStore::get_cells`) up to [`MOST_ADT_LENS`] times.
+fn ensure_trait_want<'n, S: super::source::NamesSource<'n>>(
+    r: &mut Records<'_, 'n, S>,
+    want: super::heads::Want,
+) -> Result<(), TraitWantError> {
+    let mut lens = 0;
+    loop {
+        match r.store.ensure(r.names, r.keys, want) {
+            Err(super::heads::HeadError::Item(_, Why::NeedConst(c, _))) if lens < MOST_ADT_LENS => {
+                lens += 1;
+                if let Err(error) = super::check::eval_len(r, c) {
+                    return Err(TraitWantError::Const { key: c, error });
+                }
+            }
+            Err(e) => return Err(TraitWantError::Head(e)),
+            Ok(()) => return Ok(()),
+        }
+    }
+}
+
 /// `tables` (the whole program passes an empty map once; the lazy program its own map, per
 /// body, so a trait is made once per command).
 fn object_tables<'n, S: super::source::NamesSource<'n>>(
@@ -568,8 +605,8 @@ fn object_tables<'n, S: super::source::NamesSource<'n>>(
                 return Err(String::from("more traits under its objects than the most one program's objects reach"));
             }
             let lib = r.keys.library_in(r.names, k).ok_or_else(|| String::from("no library key"))?;
-            r.store.ensure(r.names, r.keys, super::heads::Want::Head(lib)).map_err(|e| format!("its head: {e:?}"))?;
-            r.store.ensure(r.names, r.keys, super::heads::Want::Members(lib)).map_err(|e| format!("its members: {e:?}"))?;
+            ensure_trait_want(r, super::heads::Want::Head(lib)).map_err(|e| format!("its head: {e}"))?;
+            ensure_trait_want(r, super::heads::Want::Members(lib)).map_err(|e| format!("its members: {e}"))?;
             let head = r.store.maps.traits.get(&lib).ok_or_else(|| String::from("made, but no head filed under its key"))?;
             let supers_written = r.store.maps.supers.get(&lib).ok_or_else(|| String::from("made, but no supertraits filed under its key"))?;
             let view = r.store.tys.view();
@@ -2324,3 +2361,67 @@ impl blaze_build::type_name::TypeNames for Front2Program<'_> {
         super::type_name::variant_name(self.front.names, &self.front.keys, adt, variant, out)
     }
 }
+
+#[cfg(test)]
+mod object_const_tests {
+    use super::lazy::LazyProgram;
+    use crate::crates::{Inputs, UserCrate};
+    use crate::front2::keys::checker_of;
+    use crate::front2::stalled_goals::tests::fixture_toolchain;
+    use crate::refusal::SourceFile;
+    use crate::seam::FrontEnd;
+
+    /// `object_tables` must evaluate const expressions inside trait member signatures (such as
+    /// `BlobStore::get_cells` returning a fixed-size `[u8; BYTES_PER_CELL]` alias) instead of
+    /// refusing with `NeedConst`.
+    #[test]
+    fn object_trait_evaluates_const_lengths_in_trait_members() {
+        const SOURCE: &str = r#"
+const BYTES: usize = 32;
+type Cell = [u8; BYTES];
+
+pub trait BlobLike {
+    fn get_cell(&self) -> Cell;
+}
+
+struct Dummy;
+impl BlobLike for Dummy {
+    fn get_cell(&self) -> Cell {
+        [0u8; BYTES]
+    }
+}
+
+fn read(store: &dyn BlobLike) -> usize {
+    store.get_cell().len()
+}
+
+fn main() {
+    let d = Dummy;
+    let _ = read(&d);
+}
+"#;
+        let alloc = blaze_own::testing::heap().alloc();
+        let tc = fixture_toolchain();
+        let files = [("/obj_const/src/main.rs".to_owned(), SOURCE.to_owned())];
+        let user = UserCrate {
+            name: "obj_const", dir: "/obj_const/", root: "/obj_const/src/main.rs", files: &files,
+            edition: edition::PackageEdition::of_manifest("2024").expect("Rust 2024"), panic: blaze_build::Panic::Unwind,
+        };
+        let frame = blaze_mem::Frame::new(blaze_mem::tag::Tag::Infer).expect("fixture frame");
+        let erased = blaze_own::Erased::new(&frame);
+        let inputs = Inputs::new(&user, &tc).expect("fixture crate");
+        let crates = inputs.crates();
+        let names = inputs.resolve(&crates, erased.bump()).expect("fixture names");
+        let sources = [SourceFile 
```

**File**: `crates/blaze-ladder/src/front2/stalled_goals.rs` (modified, +83/-4)
```diff
@@ -283,7 +283,7 @@ impl<'a> Decision<'a> {
 /// rows pushed into `reads` (the module doc).
 pub fn decide_stalled_goals<'n, 'a, S: NamesSource<'n>>(
     r: &mut Records<'_, 'n, S>,
-    body: &Body<'n>,
+    body: &Body<'_>,
     done: &tc::Checked<'_>,
     interiors: &AsyncInteriors<'a>,
     reads: &mut AVec<'a, Read>,
@@ -584,7 +584,7 @@ impl AsyncInteriors<'_> {
 }
 
 #[cfg(test)]
-mod tests {
+pub(crate) mod tests {
     use blaze_own::AVec;
     use blaze_typeck as tc;
 
@@ -593,6 +593,11 @@ mod tests {
     use crate::front2::project::{BodyRef, ProjectWorld};
     use crate::refusal::SourceFile;
 
+    pub(crate) fn fixture_toolchain() -> Toolchain {
+        let home = std::env::var("HOME").expect("HOME");
+        Toolchain::open(&mut DirShelf::new(format!("{home}/.blaze/v2/toolchain"))).expect("fixture toolchain")
+    }
+
     /// WHEN an async block's interior is exact: its witness was lowered (blaze-flow-lower
     /// `lower_async_witness`) and kept ([`AsyncInteriors::keep`]), or the check's own record is
     /// already complete (`CoroutineWitness::Complete`); another fn's future is exact only by
@@ -620,8 +625,7 @@ fn local_send() {
 fn main() {}
 "#;
         let alloc = blaze_own::testing::heap().alloc();
-        let home = std::env::var("HOME").expect("HOME");
-        let tc = Toolchain::open(&mut DirShelf::new(format!("{home}/.blaze/v2/toolchain"))).expect("fixture toolchain");
+        let tc = fixture_toolchain();
         let files = [("/refused/src/main.rs".to_owned(), SOURCE.to_owned())];
         let user = UserCrate {
             name: "refused", dir: "/refused/", root: "/refused/src/main.rs", files: &files,
@@ -670,4 +674,79 @@ fn main() {}
         let shown = format!("{:?}", verdict.refused);
         assert!(shown.contains(PLANTED), "the refusal names the witness: {shown}");
     }
+
+    /// `check_body` (`LazyProgram::check_one` — the `blaze run`/`blaze test` path) must decide
+    /// stalled async `Send` goals on their exact witness interior rather than refusing with
+    /// `INTERIOR_GAP`, while still rejecting a future that genuinely holds `!Send` across an
+    /// `.await` with E0277.
+    #[test]
+    fn check_body_decides_stalled_async_send_and_rejects_rc_across_await() {
+        use crate::front2::keys::checker_of;
+        use crate::front2::program::lazy::LazyProgram;
+        use crate::seam::FrontEnd;
+
+        const SEND_OK: &str = r#"
+use std::future::Future;
+use std::pin::Pin;
+use std::rc::Rc;
+
+fn accept(_: Pin<Box<dyn Future<Output = ()> + Send>>) {}
+
+fn main() {
+    let fut: Pin<Box<dyn Future<Output = ()> + Send>> = Box::pin(async move {
+        let local = Rc::new(1u8);
+        drop(local);
+        async {}.await;
+    });
+    accept(fut);
+}
+"#;
+        const NOT_SEND: &str = r#"
+use std::future::Future;
+use std::pin::Pin;
+use std::rc::Rc;
+
+fn accept(_: Pin<Box<dyn Future<Output = ()> + Send>>) {}
+
+fn main() {
+    let fut: Pin<Box<dyn Future<Output = ()> + Send>> = Box::pin(async move {
+        let local = Rc::new(1u8);
+        async {}.await;
+        drop(local);
+    });
+    accept(fut);
+}
+"#;
+        let alloc = blaze_own::testing::heap().alloc();
+        let tc = fixture_toolchain();
+        let check_main = |name: &'static str, source: &'static str| {
+            let dir = format!("/{name}/");
+            let root = format!("/{name}/src/main.rs");
+            let files = [(root.clone(), source.to_owned())];
+            let user = UserCrate {
+                name, dir: &dir, root: &root, files: &files,
+                edition: edition::PackageEdition::of_manifest("2024").expect("Rust 2024"), panic: blaze_build::Panic::Unwind,
+            };
+            let frame = blaze_mem::Frame::new(blaze_mem::tag::Tag::Infer).expect("fixture frame");
+            let erased = blaze_own::Erased::new(&frame);
+            let inputs = Inputs::new(&user, &tc).expect("fixture crate");
+            let crates = inputs.crates();
+            let names = inputs.resolve(&crates, erased.bump()).expect("fixture names");
+            let sources = [SourceFile { path: "src/main.rs", text: source }];
+            let main_key = names
+                .items(0)
+                .find_map(|(item, _, _)| (names.item_text(item).and_then(|t| t.name) == Some("main")).then_some(checker_of(item)))
+                .expect("fixture `main`");
+            let mut lazy = LazyProgram::new(&names, &frame, &sources, Some(main_key), alloc).expect("lazy program");
+            lazy.check_one(main_key).map(|_| ())
+        };
+
+        check_main("stalled_ok", SEND_OK).expect("dropped-before-await Rc must check clean via LazyProgram::check_one");
+        let err = check_main("stalled_err", NOT_SEND).expect_err("held-across-await Rc must be rejected by LazyProgram::check_one");
+        let shown = format!("{err:?}");
+        assert!(
+            shown.contains("E0277") && shown.contains("Send"),
+            "expected E0277 Send diagnostic 
```

**File**: `crates/blaze-ladder/src/run/make_one.rs` (modified, +104/-19)
```diff
@@ -979,12 +979,11 @@ fn run_instance_loop<'a, P: FrontEnd, T: Typing<P>>(
     // projection paths passed). The same ask-again as the build's: the program makes what the
     // worlds asked (`FrontEnd::make_asked`) and the constants are pulled again; bounded by the
     // same count (rule 18), and nothing made is the `Missing` itself.
-    let mut pulled = 0u32;
+    let mut pulled = AskProgress::new_in(alloc);
     loop {
         match pull_constants(program, state, build_i, build_instance) {
             Ok(()) => break,
-            Err(e) if asks_again(&e) && pulled < crate::front2::check::MOST_ROUNDS => {
-                pulled += 1;
+            Err(e) if asks_again(&e) && pulled.allow(&e) => {
                 if !program.make_asked(build_i)? {
                     return Err(e);
                 }
@@ -999,16 +998,15 @@ fn run_instance_loop<'a, P: FrontEnd, T: Typing<P>>(
     // An instance-time question that met an answer no check made (`Missing`): the program
     // makes what its worlds asked (`FrontEnd::make_asked`) and the instance is built again,
     // as build_from's step is; bounded (rule 18), and nothing made is the `Missing` itself.
-    let mut asked = 0u32;
+    let mut asked = AskProgress::new_in(alloc);
     loop {
         let MakerState { checked, tables, work, .. } = &mut *state;
         let t = tables.take().ok_or_else(|| tables_gone(tabled))?;
         let bodies = Bodies { checked: &checked[..], closures: t.closures, coroutines: t.coroutines, const_at: t.const_at, overflow: work.overflow, ub: work.ub, panic: work.panic, alloc: work.alloc };
         let step = build_one(&*program, &bodies, work, build_i, build_instance, sink);
         *tables = Some(Tables { closures: bodies.closures, coroutines: bodies.coroutines, const_at: bodies.const_at });
         let step = match step {
-            Err(e) if asks_again(&e) && asked < crate::front2::check::MOST_ROUNDS => {
-                asked += 1;
+            Err(e) if asks_again(&e) && asked.allow(&e) => {
                 if program.make_asked(build_i)? {
                     continue;
                 }
@@ -1049,8 +1047,7 @@ fn run_instance_loop<'a, P: FrontEnd, T: Typing<P>>(
             // (`FrontEnd::object_table`) and the instance built again, so its bytes never
             // depend on which body was checked before it (D194); bounded by the same count,
             // and nothing made is the `NoTrait` itself.
-            Err(e) if let Some(t) = object_missing(&e) && asked < crate::front2::check::MOST_ROUNDS => {
-                asked += 1;
+            Err(e) if let Some(t) = object_missing(&e) && asked.allow(&e) => {
                 if program.object_table(t)? {
                     continue;
                 }
@@ -1089,6 +1086,65 @@ fn run_instance_loop<'a, P: FrontEnd, T: Typing<P>>(
     Ok(())
 }
 
+/// What an `asks_again` / `object_missing` retry round stopped on, for [`AskProgress`].
+#[derive(Clone, Copy, PartialEq, Eq, Hash)]
+enum AskKey {
+    Question(blaze_typeck::Question),
+    Adt(ItemKey),
+    Object(ItemKey),
+    Row(ReadKind, ItemKey),
+}
+
+fn ask_key(e: &RunError) -> Option<AskKey> {
+    match e {
+        RunError::Build { error: BuildError::Select(blaze_typeck::ResolveError::Missing(q)), .. }
+        | RunError::Resolve { error: blaze_typeck::ResolveError::Missing(q), .. } => Some(AskKey::Question(*q)),
+        RunError::Build { error: BuildError::NoAdt { adt }, .. } | RunError::NoAdt { adt, .. } => Some(AskKey::Adt(*adt)),
+        _ => object_missing(e).map(AskKey::Object),
+    }
+}
+
+/// Consecutive rounds without a new distinct missing fact before stopping once past `MOST_ROUNDS`.
+const MOST_ASK_STALLED: u32 = 64;
+
+/// Progress-gated round bound for instance-level `make_asked` / `object_table` retry loops
+/// (rule 18, matching `front2/check.rs`'s `MOST_PROGRESS_ROUNDS`): cold lazy builds of large
+/// bodies read from typed records can legitimately fill >`MOST_ROUNDS` distinct `ImplsOf` /
+/// `Adt` / `ObjectTrait` records across retries, while a stuck loop repeating the same missing
+/// fact still stops at `MOST_ROUNDS`.
+struct AskProgress<'a> {
+    rounds: u32,
+    stalled: u32,
+    seen: blaze_hash::HashSet<AskKey, Alloc<'a>>,
+}
+
+impl<'a> AskProgress<'a> {
+    fn new_in(alloc: Alloc<'a>) -> Self {
+        Self { rounds: 0, stalled: 0, seen: blaze_hash::HashSet::new_in(alloc) }
+    }
+
+    fn allow(&mut self, e: &RunError) -> bool {
+        self.allow_key(ask_key(e))
+    }
+
+    fn allow_key(&mut self, key: Option<AskKey>) -> bool {
+        if self.rounds >= crate::front2::check::MOST_PROGRESS_ROUNDS {
+            return false;
+        }
+        let fresh = key.is_some_and(|k| self.seen.insert(k));
+        if fresh {
+            self.stalled = 0;
+        } else {
+            self.stalled += 1;
+        }
+        if self.rounds >= crate::front2::check::MOST_ROUNDS && self.stalled >= MOST_ASK_STALLED {
+            return false;
+        }
+        
```

#### Recent Merged Pull Requests:
- **PR #2418** (2026-11-24): fix(sota): prevent GprPairSpill self-slot collision (s0 == s1) and spilled mul_overflow scratch clobber (@andrewgazelka)
- **PR #2417** (2026-11-24): fix(ladder,typeck,borrow): evaluate coroutine LAYOUT in consteval and fix OneRule/GenericSelf selection & reflexive projections (@andrewgazelka)
- **PR #2416** (2026-11-24): blaze-ecs/ui/site: SwiftUI ECS primitives, Flecs 4.2 ecs_scene!, and 100% ECS-driven Rust GPU Slug OG card (@andrewgazelka)
- **PR #2415** (2026-11-24): fix(ladder,typeck): resolve deferred method/path anon-const args and GAT const params on type params/Self (@andrewgazelka)
- **PR #2414** (2026-11-24): perf(blaze-build): emit Op::Memcpy/Memmove for aggregate copies instead of recursive enum switch trees (@andrewgazelka)
- **PR #2413** (2026-11-24): fix(blaze-site): polish inline SVG icons across WebGPU and ECS HTML projection (@andrewgazelka)

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

## X. sota,lir,build): canonicalize non-RPO blocks before SOTA regalloc and preserve u

**RULE**:
When implementing operations in `crates/blaze-build/src/layout.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in indexable-inc/blaze. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `382168c3`: sota,lir,build): canonicalize non-RPO blocks before SOTA regalloc and preserve unsizable generic struct tail order. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/blaze-build/src/layout.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Whether `adt`'s last field (in its unsubstituted definition) can be unsized via a structural
/// `Unsize` coercion (`&S<SizedTail> -> &S<UnsizedTail>`, e.g. `PolymorphicIter<[MaybeUninit<T>; N]>`
/// -> `PolymorphicIter<[MaybeUninit<T>]>`, `ArcInner<T>`, `Mutex<T>`, `UnsafeCell<T>`).
///
/// Rust requires unsizing a struct to preserve the byte offsets of every field preceding the tail,
/// so a potentially-unsized tail field must stay last even when monomorphized with a sized,
/// higher-alignment type (such as `u128` or `[MaybeUninit<(u64, BlobParams)>; 2]`).
fn struct_tail_may_unsize<'a>(adt: &Adt<'a>, facts: &'a dyn LayoutFacts) -> bool {
    if adt.generics == 0 {
        return false;
    }
    let [variant] = adt.variants else { return false };
    let Some(last) = adt.fields.get(variant.fields.range()).and_then(|fs| fs.last()) else {
        return false;
    };
    ty_may_unsize(last.ty, adt.types, facts, 16)
}

fn ty_may_unsize<'a>(mut ty: PTy, mut tys: blaze_typeck::PTys<'a>, facts: &'a dyn LayoutFacts, mut budget: u8) -> bool {
    loop {
        if budget == 0 {
            return true;
        }
        budget -= 1;
        let Ok(node) = tys.node(ty) else { return
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                let u = self.univariant(parts, Order::Decreasing, ReprAttrs::RUST, 0, 0, cx.scratch)?;
                    let u = self.univariant(parts, Order::Decreasing, ReprAttrs::RUST, 0, 0, cx.scratch)?;
                let u = self.univariant(parts, Order::Decreasing, ReprAttrs::RUST, 0, 0, cx.scratch)?;
    fn univariant(&mut self, parts: &[PTy], order: Order, attrs: ReprAttrs, start: u64, min_align: u8, scratch: Alloc<'_>
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `382168c3` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
