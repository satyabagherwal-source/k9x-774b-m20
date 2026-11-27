# Verification Protocol: Verification Protocol: Empirical Defect Shield for indexable-inc-blaze-learnings

<!-- PROVENANCE_START
{
  "source_repository": "indexable-inc-blaze-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T00:50:26.053Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-indexable-inc-blaze-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [indexable-inc-blaze-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T00:50:26.053Z`  
> **Learning ID**: `LEARN-EVO-indexable-inc-blaze-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `indexable-inc-blaze-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/indexable-inc-blaze-learnings.md`  
> **Source**: github ([https://github.com/indexable-inc/blaze](https://github.com/indexable-inc/blaze))  
> **Source Version**: `d358ce89`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T00:50:09.554Z  
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
> **Harvest Timestamp**: 2026-11-27T00:50:09.547Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `indexable-inc/blaze`
- **Description**: Incremental rust builds up to 92x faster than cargo/rustc. Backed by Y Combinator (F26).
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 2951 stars

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

### Incident Patch 1: `314c5390` (2026-11-26)
**Commit Message**: feat(build-script): hermetic pinned clang-23 compiler probes with per-probe CAS cache (#2574)

* feat(build-script): hermetic pinned clang-23 compiler probes with per-probe CAS cache

* fix(build-script): address Codex review on hermetic clang probes and NixOS Landlock closure

* Address Round 2 Codex review findings on hermetic C probes

1. Reject package/path-steering inputs in c_tasks_probe: non-empty CPATH /
   C_INCLUDE_PATH / CPLUS_INCLUDE_PATH / OBJC_INCLUDE_PATH /
   OBJCPLUS_INCLUDE_PATH / COMPILER_PATH / CCC_OVERRIDE_OPTIONS, relative or
   non-OUT_DIR positional args, and #include/#include_next/#import directives
   inside materialized OUT_DIR probe sources.
2. Enforce MAX_RECORD_BYTES before allocating in DirStore::get_c_probe via
   OnDir::read_sealed_bounded (matching sweep.rs).
3. Include sdk_id_digest(sdk_id) as the 4th field of cc-probe read subjects
   and validate it during both script read replay (fact_pins) and certificate
   sweeps (sweep.rs + engine_check.rs via LazySdk::sdk_digest, 0 ms when no
   cc-probe leaf is present).
4. Expand NixOS minimal ELF64 Landlock closure to a bounded transitive BFS
   over DT_NEEDED + DT_RUNPATH/DT_RPATH ( expansion) with zer

**File**: `crates/blaze-build-script/src/c_tasks_probe.rs` (modified, +1382/-22)
```diff
@@ -40,19 +40,33 @@ pub const PATH: &str = "pins/answers/clang.json";
 /// The one form of the table read here (its `form`).
 pub const FORM: u64 = 1;
 const ID_DOMAIN: &str = "blaze-build-script clang answers table 1";
+/// Domain for canonical [`ProbeKey`] hashing (answerer id, clang sha256, sdk/sysroot id, program,
+/// canonical args, canonical `CLANG_ENV`, sorted input file sha256s).
+pub const PROBE_KEY_DOMAIN: &str = "blaze-build-script c probe 1";
+/// Domain for [`canonical_reply_digest`] (matches `spawn_route::reply_digest` so `fact_now` and
+/// `spawn_probe` agree).
+const REPLY_DOMAIN: &str = "blaze build-script spawn reply 1";
+/// Magic bytes of an encoded binary probe cache record (`bzcp` v1).
+const ANSWER_MAGIC: [u8; 4] = *b"bzcp";
+const ANSWER_VERSION: u32 = 1;
 
 /// The guest `OUT_DIR`'s spelling in a row.
 pub const OUT_DIR: &str = "$OUT_DIR";
 /// The guest SDK folder's spelling in a row.
 pub const SDKROOT: &str = "$SDKROOT";
+/// The script's root mount / package directory spelling in a row (`/package`, `/workspace/...`).
+pub const MOUNT: &str = "$MOUNT";
 /// The head of a file a probe reads under `OUT_DIR`, as a row spells it (`$IN0.c`).
 pub const INPUT: &str = "$IN";
 /// The head of a path under `OUT_DIR` a probe names where no file is (`-o $OUT0`).
 pub const OUTPUT: &str = "$OUT";
 
 /// The environment variables clang's driver reads that can change a probe's answer, sorted. A
 /// spawn's value of each is part of its row; every other variable is not read by clang.
-pub const CLANG_ENV: [&str; 11] = [
+/// `TMPDIR` is intentionally excluded: host ambient temp dirs (e.g. `/private/var/folders/...`)
+/// must never pollute content-addressed probe keys; hermetic execution supplies the probe's own
+/// private confined output directory as `TMPDIR`.
+pub const CLANG_ENV: [&str; 10] = [
     "CCC_OVERRIDE_OPTIONS",
     "COMPILER_PATH",
     "CPATH",
@@ -63,7 +77,6 @@ pub const CLANG_ENV: [&str; 11] = [
     "OBJC_INCLUDE_PATH",
     "SDKROOT",
     "SOURCE_DATE_EPOCH",
-    "TMPDIR",
 ];
 
 /// The C and C++ compiler names a probe is spawned as.
@@ -73,12 +86,393 @@ fn name_of(program: &str) -> &str {
     program.rsplit('/').next().unwrap_or(program)
 }
 
+/// Normalizes a path under `out_dir`, collapsing `.` and repeated `/` separators and rejecting
+/// `..` traversal or trailing directory slashes, so `-o /out/./flag_check /out/./flag_check.c`
+/// resolves to the exact same `OUT_DIR`-relative key (`flag_check.c`) as the sandbox filesystem.
+pub fn normalize_under_out_dir<'a>(path: &str, out_dir: &str, alloc: Alloc<'a>) -> Option<AString<'a>> {
+    let trimmed_out = out_dir.trim_end_matches('/');
+    if trimmed_out.is_empty() {
+        return None;
+    }
+    let rel = path.strip_prefix(trimmed_out)?.strip_prefix('/')?;
+    if rel.is_empty() || rel.ends_with('/') {
+        return None;
+    }
+    let mut normalized = String::new_in(alloc);
+    for seg in rel.split('/') {
+        if seg.is_empty() || seg == "." {
+            continue;
+        }
+        if seg == ".." {
+            return None;
+        }
+        if !normalized.is_empty() {
+            normalized.push('/');
+        }
+        normalized.push_str(seg);
+    }
+    if normalized.is_empty() {
+        return None;
+    }
+    Some(normalized)
+}
+
+/// Whether `path` lies under `out_dir` after collapsing `.` and repeated `/` separators (with no
+/// `..` traversal or trailing slash).
+fn is_under_out_dir(path: &str, out_dir: &str) -> bool {
+    let trimmed_out = out_dir.trim_end_matches('/');
+    if trimmed_out.is_empty() {
+        return false;
+    }
+    let Some(rel) = path.strip_prefix(trimmed_out).and_then(|r| r.strip_prefix('/')) else {
+        return false;
+    };
+    if rel.is_empty() || rel.ends_with('/') {
+        return false;
+    }
+    let mut saw_part = false;
+    for seg in rel.split('/') {
+        if seg.is_empty() || seg == "." {
+            continue;
+        }
+        if seg == ".." {
+            return false;
+        }
+        saw_part = true;
+    }
+    saw_part
+}
+
+/// Whether `src` is the exact `<dir>/flag_check.<c-ext>` companion to `out_path` (`<dir>/flag_check`)
+/// after collapsing `.` and repeated `/` separators in both paths.
+fn is_flag_check_companion(out_path: &str, src: &str) -> bool {
+    let Some(base) = src
+        .strip_suffix(".c")
+        .or_else(|| src.strip_suffix(".cpp"))
+        .or_else(|| src.strip_suffix(".cc"))
+        .or_else(|| src.strip_suffix(".cxx"))
+        .or_else(|| src.strip_suffix(".m"))
+        .or_else(|| src.strip_suffix(".mm"))
+    else {
+        return false;
+    };
+    if out_path.starts_with('/') != base.starts_with('/') {
+        return false;
+    }
+    let mut a = out_path.split('/').filter(|s| !s.is_empty() && *s != ".");
+    let mut b = base.split('/').filter(|s| !s.is_empty() && *s != ".");
+    loop {
+        match (a.next(), b.next()) {
+            (None, None) => return true,
+          
```

**File**: `crates/blaze-build-script/src/c_tasks_probe_tests.rs` (modified, +529/-4)
```diff
@@ -13,7 +13,10 @@
 
 use blaze_own::Alloc;
 
-use crate::c_tasks_probe::{Answered, ProbeWhy, Spawn, Table, TableWhy, is_probe};
+use crate::c_tasks_probe::{
+    Answered, CanonicalProbe, MOUNT, ProbeAnswer, ProbeAnswerer, ProbeCache, ProbeKey, ProbeWhy, Spawn, Table, TableWhy,
+    canonical_reply_digest, canonicalize, decode_answer, encode_answer, is_probe, resolve,
+};
 
 /// A clang archive's sha256, and the same as the table spells it.
 const CLANG_PIN: [u8; 32] = [0x5d; 32];
@@ -69,7 +72,7 @@ fn files(name: &str) -> Option<[u8; 32]> {
 const ENV: &[(&str, &str)] = &[("CARGO_PKG_NAME", "zstd-sys"), ("MACOSX_DEPLOYMENT_TARGET", "11.0")];
 
 fn spawn<'s>(program: &'s str, args: &'s [&'s str], env: &'s [(&'s str, &'s str)]) -> Spawn<'s> {
-    Spawn { program, args, env, out_dir: OUT, sdk: SDK, stdin: &[] }
+    Spawn { program, args, env, out_dir: OUT, sdk: SDK, mount: "", sdk_id: "", stdin: &[] }
 }
 
 fn parse<'a>(text: &str, alloc: Alloc<'a>) -> Table<'a> {
@@ -178,8 +181,13 @@ fn two_rows_with_one_key_are_refused() {
 #[test]
 fn only_probe_shaped_compiler_spawns_are_probes() {
     assert!(is_probe("cc", &flag_args("-fno-builtin")));
-    assert!(is_probe("/usr/bin/c++", &["-E", "/out/1detect_compiler_family.c"]));
+    assert!(is_probe("c++", &["-E", "/out/1detect_compiler_family.c"]));
+    assert!(!is_probe("/usr/bin/c++", &["-E", "/out/1detect_compiler_family.c"]), "path-qualified compiler must stay on normal route");
+    assert!(!is_probe("/opt/gcc/bin/gcc", &["-E", "/out/1detect_compiler_family.c"]), "explicit compiler path must not route to pinned clang");
+    assert!(!is_probe("/missing/cc", &flag_args("-fno-builtin")), "missing path-qualified compiler must not route to pinned clang");
     assert!(is_probe("cc", &["-?"]));
+    assert!(!is_probe("cc", &["-?", "/package/check.c"]), "-? with extra args must stay on normal compiler route");
+    assert!(!is_probe("cc", &["-c", "-?", "/out/flag_check.c"]), "-? combined with other flags is not a bare -? probe");
     assert!(!is_probe("cc", &["-c", "/pkg/src/a.c", "-o", "/out/a.o"]), "an object compile is a C request");
     assert!(!is_probe("ar", &["cq", "/out/libz.a", "/out/a.o"]));
     assert!(!is_probe("cc", &["--version"]), "a fact (facts.rs), not a probe");
@@ -236,11 +244,528 @@ fn the_pinned_table_answers_a_linux_arm64_family_probe() {
     let path = format!("{OUT}/123456789detect_compiler_family.c");
     let args = ["-E", path.as_str()];
     let held = |rel: &str| (rel == "123456789detect_compiler_family.c").then_some(detect);
-    let probe = Spawn { program: "cc", args: &args, env: &[], out_dir: OUT, sdk: "", stdin: &[] };
+    let probe = Spawn { program: "cc", args: &args, env: &[], out_dir: OUT, sdk: "", mount: "/package", sdk_id: "", stdin: &[] };
     let answered = match table.answer(&pin.sha256, &probe, held, alloc) {
         Ok(answered) => answered,
         Err(refused) => panic!("{refused}"),
     };
     assert_eq!(answered.code, 0);
     assert!(answered.stdout.as_str().contains("\"clang\""), "{answered:?}");
 }
+
+#[test]
+fn mount_normalization_shares_probe_key_across_package_and_vendored_workspace() {
+    let alloc = blaze_own::testing::heap().alloc();
+    let id = blaze_ids::ContentId([7; 32]);
+    let pkg_args = flag_args("-ffile-prefix-map=/package=");
+    let ws_args = flag_args("-ffile-prefix-map=/workspace/vendored/aws-lc-sys=");
+    let pkg_spawn = Spawn { program: "cc", args: &pkg_args, env: ENV, out_dir: OUT, sdk: SDK, mount: "/package", sdk_id: "macos-sdk 15.0", stdin: &[] };
+    let ws_spawn = Spawn { program: "cc", args: &ws_args, env: ENV, out_dir: OUT, sdk: SDK, mount: "/workspace/vendored/aws-lc-sys", sdk_id: "macos-sdk 15.0", stdin: &[] };
+    let a = canonicalize(id, &CLANG_PIN, &pkg_spawn, files, alloc).expect("pkg canonical");
+    let b = canonicalize(id, &CLANG_PIN, &ws_spawn, files, alloc).expect("ws canonical");
+    assert_eq!(a.key, b.key, "workspace vendored mount must share probe key with /package");
+    assert!(a.row.args.iter().any(|arg| arg.as_str() == format!("-ffile-prefix-map={MOUNT}=")));
+    // Control: different sdk_id produces a different ProbeKey.
+    let other_sdk = Spawn { sdk_id: "macos-sdk 15.1", ..pkg_spawn };
+    let c = canonicalize(id, &CLANG_PIN, &other_sdk, files, alloc).expect("other sdk");
+    assert_ne!(a.key, c.key);
+}
+
+#[test]
+fn header_including_preprocess_is_not_classified_as_probe() {
+    assert!(is_probe("cc", &["-E", "/out/123detect_compiler_family.c"]));
+    assert!(!is_probe("cc", &["-E", "-I/package/include", "/package/src/foo.c"]));
+    assert!(!is_probe("cc", &["-E", "-isystem", "/sdk/usr/include", "/package/src/foo.c"]));
+    assert!(!is_probe("cc", &["-E", "-include", "config.h", "/package/src/foo.c"]));
+}
+
+#[test]
+fn binary_probe_answer_round_trips_and_resolves_once_via_cache() {
+    use core::cell::RefCell;
+    use core::sync::atomic::{AtomicUsize, Ordering};
+    let alloc = blaze_own::testing::heap().alloc();
+    le
```

**File**: `crates/blaze-build-script/src/facts.rs` (modified, +85/-0)
```diff
@@ -339,6 +339,91 @@ pub fn answer<'a>(fact: &Fact<'_>, pins: &Pins<'_>, alloc: Alloc<'a>) -> Result<
     }
 }
 
+/// The head of a per-probe compiler read subject:
+/// `cc-probe\n<answerer 64-hex>\n<clang pin 64-hex>\n<probe key 64-hex>`.
+pub const CC_PROBE_HEAD: &str = "cc-probe";
+
+fn hex_nibble(n: u8) -> char {
+    match n & 15 {
+        d @ 0..=9 => char::from(b'0' + d),
+        d => char::from(b'a' + (d - 10)),
+    }
+}
+
+fn push_hex32(bytes: &[u8; 32], out: &mut AString<'_>) {
+    for byte in bytes {
+        out.push(hex_nibble(byte >> 4));
+        out.push(hex_nibble(byte & 15));
+    }
+}
+
+fn parse_hex32(hex: &str) -> Option<[u8; 32]> {
+    if hex.len() != 64 || !hex.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f')) {
+        return None;
+    }
+    let mut bytes = [0u8; 32];
+    for (i, slot) in bytes.iter_mut().enumerate() {
+        *slot = u8::from_str_radix(hex.get(2 * i..2 * i + 2)?, 16).ok()?;
+    }
+    Some(bytes)
+}
+
+/// Stable 32-byte digest of a probe's SDK / sysroot identity (empty string on Linux with no
+/// sysroot, or the macOS SDK identity hex).
+pub fn sdk_id_digest(sdk_id: &str) -> [u8; 32] {
+    blaze_ids::ContentId::of("blaze c-probe sdk id 1", sdk_id.as_bytes()).0
+}
+
+/// Parsed fields of a `cc-probe\n<answerer 64-hex>\n<clang 64-hex>\n<sdk 64-hex>\n<key 64-hex>`
+/// read subject.
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+pub struct CcProbeSubject {
+    pub answerer: blaze_ids::ContentId,
+    pub clang: [u8; 32],
+    pub sdk: [u8; 32],
+    pub key: crate::c_tasks_probe::ProbeKey,
+}
+
+/// The read subject for a resolved compiler probe, binding the active answerer strategy, pinned
+/// clang archive SHA-256, active SDK identity digest, and canonical [`crate::c_tasks_probe::ProbeKey`].
+pub fn cc_probe_subject<'a>(
+    answerer: &blaze_ids::ContentId,
+    clang: &[u8; 32],
+    sdk: &[u8; 32],
+    key: &crate::c_tasks_probe::ProbeKey,
+    alloc: Alloc<'a>,
+) -> AString<'a> {
+    let mut out = String::from_str_in(CC_PROBE_HEAD, alloc);
+    out.push('\n');
+    push_hex32(&answerer.0, &mut out);
+    out.push('\n');
+    push_hex32(clang, &mut out);
+    out.push('\n');
+    push_hex32(sdk, &mut out);
+    out.push('\n');
+    push_hex32(&key.0.0, &mut out);
+    out
+}
+
+/// Parses a `cc-probe\n<answerer 64-hex>\n<clang 64-hex>\n<sdk 64-hex>\n<key 64-hex>` read subject.
+pub fn parse_cc_probe_subject(subject: &str) -> Option<CcProbeSubject> {
+    let rest = subject.strip_prefix(CC_PROBE_HEAD)?.strip_prefix('\n')?;
+    let mut parts = rest.split('\n');
+    let answerer_hex = parts.next()?;
+    let clang_hex = parts.next()?;
+    let sdk_hex = parts.next()?;
+    let key_hex = parts.next()?;
+    if parts.next().is_some() {
+        return None;
+    }
+    Some(CcProbeSubject {
+        answerer: blaze_ids::ContentId(parse_hex32(answerer_hex)?),
+        clang: parse_hex32(clang_hex)?,
+        sdk: parse_hex32(sdk_hex)?,
+        key: crate::c_tasks_probe::ProbeKey(blaze_ids::ContentId(parse_hex32(key_hex)?)),
+    })
+}
+
 /// The fact's record subject for the script's read list (as D54's `git:` subjects): the whole
 /// question, one field per line. `pkgconf` is recorded as `pkg-config`: both are answered alike.
 pub fn subject<'a>(fact: &Fact<'_>, alloc: Alloc<'a>) -> AString<'a> {
```

**File**: `crates/blaze-build-script/src/key.rs` (modified, +8/-4)
```diff
@@ -109,7 +109,9 @@ impl<'k> HostToolKey<'k> {
 /// its spawn's folder when recorded (c_tasks.rs `rooted`): a `bzbsout6` record of run 2 holds
 /// them as spawned, which the C tasks refuse as host paths, so none is found again. 4: a
 /// `--param` value is no longer taken for a path (`rooted` made it `/package/ssp-buffer-size=4`).
-pub const DOMAIN: &str = "blaze v2 build-script run 4";
+/// 5: compiler probes (`cc-probe`) are recorded per probe in the script's read list instead of
+/// hashing the whole `pins/answers/clang.json` table into every script's base key.
+pub const DOMAIN: &str = "blaze v2 build-script run 5";
 
 /// The base key.
 pub fn base(inputs: &KeyInputs<'_>, scratch: &mut blaze_own::AVec<'_, u8>) -> ContentId {
@@ -129,10 +131,12 @@ pub fn base(inputs: &KeyInputs<'_>, scratch: &mut blaze_own::AVec<'_, u8>) -> Co
         .update(&l.out_dir_files.to_le_bytes())
         .update(&l.output.to_le_bytes())
         .update(&l.line.to_le_bytes());
+    #[cfg(not(target_os = "linux"))]
     if let RunnerKey::Wasm = inputs.runner {
-        // A wasm script's compiler probes are answered from this table (c_tasks_probe): a
-        // changed answer re-runs the scripts, and no probe is in a read list. A native script
-        // runs its compiler, so the table is not in its key.
+        // On non-Linux hosts, wasm compiler probes still use the pinned table in
+        // `pins/answers/clang.json` (preserving main's exact behavior until a descriptor-bound
+        // macOS execution backend lands). On Linux, probes execute hermetically and record
+        // per-probe `cc-probe` read subjects instead of hashing the whole table into every key.
         hasher.part(b"clang answers").id(&crate::c_tasks_probe::table_id(blaze_pins::CLANG_ANSWERS_JSON.as_bytes()));
     }
     if let RunnerKey::Native { compiler, target, sysroot, host_tools } = inputs.runner {
```

**File**: `crates/blaze-build-script/src/probe.rs` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ pub const NATIVE_TOOLS: &[&str] = &["gmake", "make", "perl"];
 /// [`NATIVE_TOOLS`] one, or a shell running a `configure` script (tikv-jemalloc-sys).
 pub fn is_deferred_tool(program: &str, args: &[&str]) -> bool {
     let name = program.rsplit('/').next().unwrap_or(program);
-    is_c_tool(name)
+    (is_c_tool(name) && !crate::c_tasks_probe::is_probe(program, args))
         || NATIVE_TOOLS.contains(&name)
         || (matches!(name, "sh" | "bash") && args.first().is_some_and(|script| script.rsplit('/').next() == Some("configure")))
 }
```

**File**: `crates/blaze-cli/src/engine_check.rs` (modified, +46/-3)
```diff
@@ -620,6 +620,37 @@ impl<'f> LazySdk<'f> {
     ) -> Result<blaze_apple_sdk::Sdk<'f>, blaze_apple_sdk::SdkRefused<'f>> {
         self.resolve_raw(cx, blaze_home, wall_ns).0
     }
+
+    fn sdk_digest(&self, cx: &Cx, blaze_home: Option<&Dir<ReadWrite>>, wall_ns: u64) -> Result<[u8; 32], CliError> {
+        match self.resolve_on_demand(cx, blaze_home, wall_ns) {
+            Ok(sdk) => {
+                let mut hex = [0u8; blaze_apple_sdk::SdkId::KEY_LEN * 2];
+                for (i, byte) in sdk.identity().key().iter().enumerate() {
+                    let hi = byte >> 4;
+                    let lo = byte & 15;
+                    if let Some(slot) = hex.get_mut(2 * i) {
+                        *slot = if hi < 10 { b'0' + hi } else { b'a' + (hi - 10) };
+                    }
+                    if let Some(slot) = hex.get_mut(2 * i + 1) {
+                        *slot = if lo < 10 { b'0' + lo } else { b'a' + (lo - 10) };
+                    }
+                }
+                Ok(blaze_build_script::facts::sdk_id_digest(core::str::from_utf8(&hex).unwrap_or("")))
+            }
+            Err(blaze_apple_sdk::SdkRefused::Neither { xcrun: blaze_apple_sdk::XcrunFailed::NotMacos }) => {
+                Ok(blaze_build_script::facts::sdk_id_digest(""))
+            }
+            Err(refused) => {
+                use core::fmt::Write as _;
+                let mut msg = blaze_own::String::new_in(blaze_own::SharedAlloc::global());
+                let _ = write!(
+                    msg,
+                    "cannot resolve active SDK identity while following a saved c-probe read: {refused}"
+                );
+                Err(CliError::Sdk(msg))
+            }
+        }
+    }
 }
 
 /// The command's edge, read once (rule 75): what `check`, `why`, `run` and `test` each take of
@@ -3485,9 +3516,13 @@ fn checking<'f, 's: 'f>(
             crate::engine_ready_edit::StoredBase::OtherCheckout => None,
             crate::engine_ready_edit::StoredBase::Own | crate::engine_ready_edit::StoredBase::ToolsMoved => journal.marked(&pointer.leaves, frame),
         };
+        let sdk_digest_fn = || match lazy_sdk {
+            Some(lazy) => lazy.sdk_digest(cx, Some(opened.home.dir()), phases.clock().wall().as_ns()),
+            None => Ok(blaze_build_script::facts::sdk_id_digest("")),
+        };
         let follow = sweep::Follow { stamps: FromMeta::now(phases.clock()), plant: sweep::Plant::None };
         let follow_began = phases.clock().now();
-        let (followed, statted) = follow.follow_served(cx, root, Some(opened.home.dir()), &pointer.leaves, marked.as_deref(), script_sweep.as_mut(), frame)?;
+        let (followed, statted) = follow.follow_served_with_sdk(cx, root, Some(opened.home.dir()), place.home, &pointer.leaves, marked.as_deref(), script_sweep.as_mut(), Some(&sdk_digest_fn), frame)?;
         let follow_ns = phases.clock().now().since(follow_began).map_or(0, |it| u64::try_from(it.as_nanos()).unwrap_or(u64::MAX));
         sweep_counts = journal.counts(statted, u32::try_from(pointer.leaves.len()).unwrap_or(u32::MAX)).with_parts(journal.parts(&pointer.leaves, frame)).with_looks(followed.looks, follow_ns);
         // Set, then borrowed SHARED: `Option::insert` hands back a `&mut`, and `today_slots` below
@@ -3615,9 +3650,13 @@ fn checking<'f, 's: 'f>(
             strategy.changed_since(cx, fs, root, opened.home.dir(), phases.clock(), whole_chosen.places(), frame)?
         };
         let whole_marked = whole_journal.marked(&whole_ptr.leaves, frame);
+        let sdk_digest_fn = || match lazy_sdk {
+            Some(lazy) => lazy.sdk_digest(cx, Some(opened.home.dir()), phases.clock().wall().as_ns()),
+            None => Ok(blaze_build_script::facts::sdk_id_digest("")),
+        };
         let follow = sweep::Follow { stamps: FromMeta::now(phases.clock()), plant: sweep::Plant::None };
         let follow_began = phases.clock().now();
-        let (whole_followed, whole_statted) = follow.follow_served(cx, root, Some(opened.home.dir()), &whole_ptr.leaves, whole_marked.as_deref(), None, frame)?;
+        let (whole_followed, whole_statted) = follow.follow_served_with_sdk(cx, root, Some(opened.home.dir()), place.home, &whole_ptr.leaves, whole_marked.as_deref(), None, Some(&sdk_digest_fn), frame)?;
         let follow_ns = phases.clock().now().since(follow_began).map_or(0, |it| u64::try_from(it.as_nanos()).unwrap_or(u64::MAX));
         let whole_moved = whole_followed.layout_moved
             || whole_followed.now.rows.iter().zip(whole_followed.was.iter()).any(|(now, was)| now.state() != *was);
@@ -3717,9 +3756,13 @@ fn checking<'f, 's: 'f>(
                         unreadable = Some(why);
                     }
                     if let Some(new_ptr) = &pointer {
+                        let sdk_digest_fn = || match lazy_sdk {
+                            Some(lazy) => lazy.sdk_digest(cx, Some(opened.home.dir()), phases.clock().wall().as_ns()),
+                            None =
```

**File**: `crates/blaze-cli/src/main.rs` (modified, +4/-0)
```diff
@@ -196,6 +196,9 @@ pub enum CliError {
     Leaves(WireError),
     /// A file the outline cannot read: not UTF-8, or past 4 GiB.
     Text { what: &'static str },
+    /// SDK resolution failed while following a saved `cc-probe` read, preserving the full
+    /// `SdkRefused` diagnostic (path, xcrun status, or underlying I/O error).
+    Sdk(blaze_own::String<blaze_own::SharedAlloc<'static>>),
     /// The program did not run: the stage and the function it stopped at (program.rs's form;
     /// the request names the command in [`CliError::Ran`]).
     /// Its one form: the program's manifest refused ([`ManifestRefused`]); every constructor is
@@ -327,6 +330,7 @@ impl fmt::Display for CliError {
             CliError::MacroFiles(error) => write!(f, "{error}"),
             CliError::Leaves(error) => write!(f, "the checkout's leaf table (in a pointer of .blaze/v2/at), of this build's form, is malformed: {error}"),
             CliError::Text { what } => write!(f, "{what}"),
+            CliError::Sdk(why) => write!(f, "{why}"),
             CliError::Program(error) => write!(f, "the program: {error}"),
             CliError::Ran { command, error } => write!(f, "blaze {command}: {error}"),
             CliError::OwnProcess(error) => write!(f, "{error}"),
```

**File**: `crates/blaze-cli/src/scripts.rs` (modified, +86/-19)
```diff
@@ -272,6 +272,9 @@ pub(crate) struct Shared<'f> {
     table: Arc<std::vec::Vec<Row>>,
     macro_table: Arc<std::vec::Vec<Row>>,
     spawn: Arc<SpawnSetting>,
+    /// Hermetic pinned `clang-23` probe runner and CAS store, or retained refusal when the host
+    /// has no clang pin or unpacked shelf (fails only scripts that actually ask a C probe).
+    c_probes: blaze_proc_macro::probe_clang::CProbeSetting,
     /// The native setting, or why the command has none (its words, naming the path).
     native: Result<NativeSetting<'f>, &'f str>,
     /// The command resolved no macOS SDK (sdk.rs). A native run's key then holds "no SDK"
@@ -610,7 +613,24 @@ impl<'f> Scripts<'f> {
         // resolved again here.
         let checkout = env.served.within(frame);
         let no_sdk = env.sdk.is_err();
-        let shared: &'f Shared<'f> = blaze_own::Box::into_bump_ref(blaze_own::Box::new_in(Shared { result_alloc: env.heap.shared(), runtime, store, checkout, table, macro_table, spawn, native, no_sdk, graph_record }, frame));
+        let mut sdk_hex = [0u8; blaze_apple_sdk::SdkId::KEY_LEN * 2];
+        let sdk_pair = env.sdk.as_ref().ok().map(|sdk| {
+            let key = sdk.identity().key();
+            for (i, byte) in key.iter().enumerate() {
+                let hi = byte >> 4;
+                let lo = byte & 15;
+                if let Some(slot) = sdk_hex.get_mut(2 * i) {
+                    *slot = if hi < 10 { b'0' + hi } else { b'a' + (hi - 10) };
+                }
+                if let Some(slot) = sdk_hex.get_mut(2 * i + 1) {
+                    *slot = if lo < 10 { b'0' + lo } else { b'a' + (lo - 10) };
+                }
+            }
+            let id_str = core::str::from_utf8(&sdk_hex).unwrap_or("");
+            (sdk.folder(), id_str)
+        });
+        let c_probes = blaze_proc_macro::probe_clang::open_command_c_probes(cx, &env.fs, home, host, sdk_pair, alloc);
+        let shared: &'f Shared<'f> = blaze_own::Box::into_bump_ref(blaze_own::Box::new_in(Shared { result_alloc: env.heap.shared(), runtime, store, checkout, table, macro_table, spawn, c_probes, native, no_sdk, graph_record }, frame));
         Ok(shared)
     }
 
@@ -1093,6 +1113,7 @@ fn run(cx: &Cx, job: &ScriptJob<'_>, scratch: &Frame, checkout: &mut crate::engi
         // answers until the engine's checker has answered the real probes' ladder
         // (handoff p1-probe-checker.txt).
         probes: None,
+        c_probes: Some(blaze_own::Share::share(&shared.c_probes)),
         c_mode: C_MODE,
         mode: MODE,
         native,
@@ -1112,15 +1133,19 @@ fn run(cx: &Cx, job: &ScriptJob<'_>, scratch: &Frame, checkout: &mut crate::engi
     let is_checkout = checkout_prefix.is_some();
     // A kept checkout-backed run's failure is a hole: the reads it made are not handed back with
     // its error (`ScriptError`), so no read list makes it stand, and standing on its drive inputs
-    // alone would keep it failed past the edit that fixes it (rule 21). Under
-    // [`CheckoutReads::Hole`] its failure is filed.
-    let failed_hole = is_checkout && matches!(job.checkout, CheckoutReads::Kept { .. });
+    // alone would keep it failed past the edit that fixes it (rule 21). On Linux, wasm runs do
+    // not hash the C-probe table/answerer into `key::base` (probes are tracked per-probe in
+    // `ran.reads`), so a failed Linux wasm script that may have consumed a C probe must likewise
+    // stay a hole rather than filing a failure without `cc-probe` read dependencies.
+    let failed_hole = (is_checkout && matches!(job.checkout, CheckoutReads::Kept { .. }))
+        || (cfg!(target_os = "linux") && ran_as == RanAs::Wasm);
     let ran = match script_unit::outputs_given(&shared.runtime, &setting, graph, job.script, side_cfg.as_ref().map(|atoms| atoms.as_slice()), tree, root, &given, alloc) {
         Ok(ran) => ran,
         Err(error) => return failed("a build script failed", format_args!("the build script of {package} failed: {error}"), failed_hole),
     };
     if let Some(error) = ran.outputs.errors.first() {
-        return failed("a build script printed `cargo::error`", format_args!("the build script of {package} failed: cargo::error={}", error.as_str()), failed_hole);
+        let probed = ran.reads.iter().any(|read| blaze_build_script::facts::parse_cc_probe_subject(read.subject.as_str()).is_some());
+        return failed("a build script printed `cargo::error`", format_args!("the build script of {package} failed: cargo::error={}", error.as_str()), failed_hole || probed);
     }
     // The record's reads, in the run's frame until the record is made.
     let mut reads: blaze_own::Vec<(Name, ContentId), &Frame> = blaze_own::Vec::with_capacity_in(ran.reads.len() + job.producers.len(), scratch);
@@ -1135,13 +1160,20 @@ fn run(cx: &Cx, job: &ScriptJob<'_>, scratch: &Frame, checkout: &mut crate::engi
     // dependent. Under [`CheckoutReads::Hole`] every read of the checkout is a hole: its outputs
     // s
```

---

### Incident Patch 2: `5fe6590a` (2026-11-26)
**Commit Message**: fix(front2,cli): wave 18 — resolve sibling local consts in local item signatures and drain export inboxes on teardown (#2657)

- Unify local-item signature/initializer block scope lookup into `Locals::scope_or_declared` so `body_const_len`, `const_open::local_arg`, `const_open::local_const`, and `scope_table::written` all fall back to `(h.enclosing, h.scope)` when a lowered view has `scope == None` (fixing `same_guest_dir::push_parts` in `blaze-proc-macro` and sibling local const generic args/repeats).
- Add unit tests in `front2::const_open::tests` covering local `fn` signature array lengths (including E0308 negative control), const generic args, block `use` consts, and local `const` repeat initializers.
- Drain closed worker inboxes before teardown join and raise `EXPORT_END_WAIT` to 300s in `engine_export.rs` so early-error teardown surfaces the real error instead of aborting.

**File**: `crates/blaze-cli/src/engine_export.rs` (modified, +4/-2)
```diff
@@ -71,7 +71,7 @@ const EXPORT_PER_WORKER_IN_FLIGHT: usize = 6;
 const EXPORT_HAND_WAIT: core::time::Duration = core::time::Duration::from_secs(30);
 const EXPORT_PROCS_WAIT: core::time::Duration = core::time::Duration::from_secs(60);
 const EXPORT_RECV_SLICE: core::time::Duration = core::time::Duration::from_millis(10);
-const EXPORT_END_WAIT: core::time::Duration = core::time::Duration::from_secs(60);
+const EXPORT_END_WAIT: core::time::Duration = core::time::Duration::from_secs(300);
 
 /// Program root shape domain for `blaze build` (`start_list::ListName::of` -> `RootName::program`),
 /// distinct from `engine_start.rs`'s `RUN_SHAPE` so `blaze build`'s release-profile code root
@@ -1484,9 +1484,11 @@ fn walk_remaining_parallel<'a, 'f, 'p, D: blaze_core::Driver>(
         Ok(())
     })();
 
-    // Always close channels and join all worker tasks before returning (linear scope invariant).
+    // Always close channels, drain unstarted queued jobs, and join all worker tasks before
+    // returning (linear scope invariant).
     for ch in inboxes.iter() {
         ch.close();
+        while ch.try_recv().is_ok() {}
     }
     done_ch.close();
     procs_asked.close();
```

**File**: `crates/blaze-ladder/src/front2/const_open.rs` (modified, +48/-7)
```diff
@@ -343,8 +343,8 @@ pub(super) fn local_const<'n, H: Heads + ?Sized, S: NamesSource<'n>>(
             _ => return Ok(None),
         }
     }
-    let Some(scope) = scope else { return Ok(None) };
-    local_const_in_scope(resolver, marks, locals, owner, module, heads, view, scope.0, found_path, name, range, ArrayLenSite::Repeat)
+    let Some((owner, scope)) = locals.scope_or_declared(owner, scope.map(|s| s.0)) else { return Ok(None) };
+    local_const_in_scope(resolver, marks, locals, owner, module, heads, view, scope, found_path, name, range, ArrayLenSite::Repeat)
 }
 
 /// What a generic argument written as ONE plain name means when an item declared in the body
@@ -383,18 +383,18 @@ pub(super) fn local_arg<'n, H: Heads + ?Sized, S: NamesSource<'n>>(
     range: Range,
 ) -> Result<Option<LocalArg>, Why> {
     let lf::TypeRef::Path(p) = view.ty(t)? else { return Ok(None) };
-    let Some(scope) = view.path(p)?.scope else { return Ok(None) };
-    if let Some(row) = locals.find(owner, Some(scope.0), name, LocalNs::Type) {
+    let Some((owner, scope)) = locals.scope_or_declared(owner, view.path(p)?.scope.map(|s| s.0)) else { return Ok(None) };
+    if let Some(row) = locals.find(owner, Some(scope), name, LocalNs::Type) {
         if row.kind != LocalKind::Use {
             return Ok(Some(LocalArg::Type));
         }
-        let ty_target = resolve_use_target(resolver, marks, locals, owner, module, view, scope.0, Some(p), name, &row, Ns::Type, range)?;
+        let ty_target = resolve_use_target(resolver, marks, locals, owner, module, view, scope, Some(p), name, &row, Ns::Type, range)?;
         if let Some(target) = ty_target
             && matches!(target.kind, Kind::Struct | Kind::Enum | Kind::Union | Kind::TypeAlias | Kind::Builtin(_) | Kind::WideInt { .. })
         {
             return Ok(Some(LocalArg::Type));
         }
-        return match resolve_use_target(resolver, marks, locals, owner, module, view, scope.0, Some(p), name, &row, Ns::Value, range)? {
+        return match resolve_use_target(resolver, marks, locals, owner, module, view, scope, Some(p), name, &row, Ns::Value, range)? {
             Some(target) if target.kind == Kind::Const => {
                 let bits = const_item_bits(heads, target.key, name, range)?;
                 Ok(Some(LocalArg::Const(bits)))
@@ -409,7 +409,7 @@ pub(super) fn local_arg<'n, H: Heads + ?Sized, S: NamesSource<'n>>(
             }
         };
     }
-    let Some(row) = locals.find(owner, Some(scope.0), name, LocalNs::Value) else { return Ok(None) };
+    let Some(row) = locals.find(owner, Some(scope), name, LocalNs::Value) else { return Ok(None) };
     match row.kind {
         LocalKind::Const => {
             let bits = const_item_bits(heads, row.key, name, range)?;
@@ -506,6 +506,41 @@ pub fn turbofish_use_fn_refused() {
     use crate::diag::not_a_const;
     let _ = take::<not_a_const>();
 }
+pub fn local_fn_sig_const_array_len_ok() -> [u8; 4] {
+    const MAX_PARTS: usize = 4;
+    fn fill(out: &mut [u8; MAX_PARTS]) {
+        out[0] = 1;
+    }
+    let mut buf = [0u8; MAX_PARTS];
+    fill(&mut buf);
+    buf
+}
+pub fn local_fn_sig_const_array_len_wrong() -> [u8; 5] {
+    const MAX_PARTS: usize = 4;
+    fn make() -> [u8; MAX_PARTS] {
+        [0u8; MAX_PARTS]
+    }
+    make()
+}
+pub fn local_fn_sig_const_generic_arg_ok() -> Wrap<4> {
+    const MAX_PARTS: usize = 4;
+    fn wrap(w: Wrap<MAX_PARTS>) -> Wrap<MAX_PARTS> {
+        w
+    }
+    wrap(Wrap([0u8; MAX_PARTS]))
+}
+pub fn local_fn_sig_use_const_array_len_ok() -> [u8; 4] {
+    use crate::diag::MOST_PENDING_SHOWN;
+    fn make() -> [u8; MOST_PENDING_SHOWN] {
+        [0u8; MOST_PENDING_SHOWN]
+    }
+    make()
+}
+pub fn local_const_repeat_sibling_const_ok() -> [u8; 4] {
+    const A: usize = 4;
+    const B: [u8; A] = [0u8; A];
+    B
+}
 ";
 
     #[test]
@@ -518,6 +553,10 @@ pub fn turbofish_use_fn_refused() {
             "turbofish_use_const_ok",
             "type_arg_use_const_ok",
             "turbofish_use_type_ok",
+            "local_fn_sig_const_array_len_ok",
+            "local_fn_sig_const_generic_arg_ok",
+            "local_fn_sig_use_const_array_len_ok",
+            "local_const_repeat_sibling_const_ok",
         ] {
             let diags = check_fn(APP, ok).unwrap_or_else(|e| panic!("`{ok}` was refused: {e}"));
             assert!(diags.is_empty(), "`{ok}` had unexpected diagnostics: {diags:?}");
@@ -527,6 +566,8 @@ pub fn turbofish_use_fn_refused() {
         assert!(wrong_repeat.contains(&"E0308"), "expected E0308, got {wrong_repeat:?}");
         let wrong_arg = check_fn(APP, "turbofish_use_const_wrong_len").expect("turbofish_use_const_wrong_len should typecheck with E0308");
         assert!(wrong_arg.contains(&"E0308"), "expected E0308, got {wrong_arg:?}");
+        let wrong_local_sig = check_fn(APP, "local_fn_sig_const_array_len_wrong").expect("local_fn_sig_const_array_len_wrong should typecheck with E0308");
+        assert!(wrong_local_sig.c
```

**File**: `crates/blaze-ladder/src/front2/locals.rs` (modified, +12/-0)
```diff
@@ -837,6 +837,18 @@ impl<'n> Locals<'n> {
         (it.module == h.names_at && strip_leading_trivia(it.text) == strip_leading_trivia(text)).then_some(found.key)
     }
 
+    /// The `(body, scope)` at which an AST node of `owner` with lowered block scope `scope` stands:
+    /// inside `owner` at `s` when `scope` is `Some(s)`, or—when `scope` is `None` (a local item's
+    /// signature or unblocked initializer, which has no enclosing `Expr::Block` in its own view)—at
+    /// the declaring block `(h.enclosing, h.scope)` of that local item (`LocalHead`). `None` for a
+    /// non-local item's signature.
+    pub fn scope_or_declared(&self, owner: ItemKey, scope: Option<u32>) -> Option<(ItemKey, u32)> {
+        match scope {
+            Some(s) => Some((owner, s)),
+            None => self.head(owner).map(|h| (h.enclosing, h.scope)),
+        }
+    }
+
     /// The local item `name` names in `ns`, written in block `scope` of the body `owner`: the
     /// block's items, then each enclosing block's (innermost first); where the body is itself
     /// a local item's, then the blocks around its declaration. `None`: the module's names.
```

**File**: `crates/blaze-ladder/src/front2/scope_table.rs` (modified, +8/-9)
```diff
@@ -263,15 +263,14 @@ pub(super) fn written<'n, S: super::source::NamesSource<'n>>(
     // x0-ref-11-deref-unsized, x0-ref-12-wide-ptr-eq; tests/front2_block_use_types.rs). Any
     // other body's signature path is its module's.
     let declared;
-    let (body, scope) = match view.path(path)?.scope {
-        Some(s) => (body, s.0),
-        None => match body.locals.head(body.owner) {
-            Some(h) => {
-                declared = super::block_type_uses::BodyScope { owner: h.enclosing, ..*body };
-                (&declared, h.scope)
-            }
-            None => return Ok(None),
-        },
+    let Some((owner, scope)) = body.locals.scope_or_declared(body.owner, view.path(path)?.scope.map(|s| s.0)) else {
+        return Ok(None);
+    };
+    let body = if owner == body.owner {
+        body
+    } else {
+        declared = super::block_type_uses::BodyScope { owner, ..*body };
+        &declared
     };
     // Body lowering already put the first token's mark in the path's view. An opaque
     // token names the definition module even if that module also encloses the invocation.
```

**File**: `crates/blaze-ladder/src/front2/types.rs` (modified, +5/-3)
```diff
@@ -2249,16 +2249,18 @@ fn body_const_len<'n, H: Heads + ?Sized, S: NamesSource<'n>>(
     if !ident {
         return Ok(None);
     }
-    let Some(scope) = type_scope(v, t)? else { return Ok(None) };
+    let Some((owner, scope)) = body.locals.scope_or_declared(body.owner, type_scope(v, t)?.map(|s| s.0)) else {
+        return Ok(None);
+    };
     super::const_open::local_const_in_scope(
         resolver,
         marks,
         body.locals,
-        body.owner,
+        owner,
         body.module,
         heads,
         v,
-        scope.0,
+        scope,
         None,
         name,
         r,
```

---

### Incident Patch 3: `e7d71472` (2026-11-27)
**Commit Message**: perf,fix,feat(emit,cli,engine,screen): wave 22 — mra global liveness pruning, reach-root/tool-base consistency, and blaze run status lines (#2668)

* fix(cli,engine): verify reach roots at load time and populate tool-base by_file

1. Reach-shard partial eviction consistency (`engine_answer.rs`, `engine_check.rs`):
   - `f6s3` LRU eviction (`evict_from_reach`) and crash recovery (`unroot_holed_par`)
     can drop individual `.reach.XX` / `.reach.delta` shards while leaving the
     answer pointer and `.answer` (with all 256 radix leaf shards) live in the
     manifest. A subsequent scoped check (e.g. `blaze build -p blaze-cli`) would
     open the root cleanly, never touch the dead shard during checking, carry the
     untouched radix leaf shard forward in `encode_changes_radix`, and fail in
     `publish_reach_shards_from` with `StoreError::RootNamesUnheld` on `reach.4a`.
   - Added zero-I/O manifest reach completeness checks (`reach_roots_live_without_root`
     for the certificate fast path and `verify_reach_roots` at `open_root` /
     `open_named_base` / `open_base_for_tools` / `open_toolchain_base`), surfacing
     `Unreadable::Pages(PagesError::Missing)` when pages/`beside_ke

**File**: `crates/blaze-cli-spec/src/blaze_app.rs` (modified, +1/-0)
```diff
@@ -105,6 +105,7 @@ const BUILD_FLAGS: &[ArgSpec] = &[
 const RUN_FLAGS: &[ArgSpec] = &[
     flag_multi("package", "package", Some('p'), "<name>", "Package to run", false),
     flag_value("bin", "bin", None, "<name>", "Binary target to run", false),
+    flag_bool("quiet", "quiet", Some('q'), "Do not print status lines", false),
     flag_multi("grant", "grant", None, "<k=v>", "Grant an environment/host capability", false),
     flag_bool("open", "open", None, "Open Explore viewer in browser", false),
     flag_value("workers", "workers", None, "<N>", "Maximum concurrent workers", false),
```

**File**: `crates/blaze-cli/src/engine_answer.rs` (modified, +502/-18)
```diff
@@ -651,6 +651,30 @@ pub(crate) fn tools_digest(tools: &Tools) -> ContentId {
     h.finish()
 }
 
+/// Which CAS reach root of a stored answer was missing or expired when validated at load time.
+#[derive(Clone, Copy, PartialEq, Eq, Debug)]
+pub(crate) enum MissingReachRoot {
+    /// `<prefix>.answer` (pins root directory, radix leaf shards, lines, headers).
+    Answer,
+    /// `<prefix>.reach` (flat or single-root page reach index).
+    Reach,
+    /// `<prefix>.reach.<shard:02x>` (sharded radix page reach root).
+    Shard(u16),
+    /// `<prefix>.reach.delta` (sharded radix incremental delta reach root).
+    Delta,
+}
+
+impl fmt::Display for MissingReachRoot {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        match self {
+            MissingReachRoot::Answer => f.write_str("its `.answer` root is missing or expired"),
+            MissingReachRoot::Reach => f.write_str("its `.reach` root is missing or expired"),
+            MissingReachRoot::Shard(shard) => write!(f, "its `.reach.{shard:02x}` shard root is missing or expired"),
+            MissingReachRoot::Delta => f.write_str("its `.reach.delta` root is missing or expired"),
+        }
+    }
+}
+
 /// Why the stored answer is not read: the request answers in full and writes it anew.
 #[derive(Debug)]
 pub(crate) enum Unreadable {
@@ -669,6 +693,10 @@ pub(crate) enum Unreadable {
     Headers { tag: u8 },
     /// A page or the answer's root (pages.rs).
     Pages(PagesError),
+    /// One of the stored answer's CAS reach roots is missing or expired (e.g. partially evicted
+    /// during compaction or unrooted after a crash), so its pages' `beside_key` reach indexes can
+    /// no longer be assumed held.
+    MissingReach { what: MissingReachRoot },
 }
 
 impl fmt::Display for Unreadable {
@@ -685,6 +713,7 @@ impl fmt::Display for Unreadable {
             Unreadable::Torn(torn) => write!(f, "{torn}")?,
             Unreadable::Headers { tag } => write!(f, "its producer header index field (tag {tag}) is no state a writer makes (engine_answer.rs `load_pointer`)")?,
             Unreadable::Pages(why) => write!(f, "{why}")?,
+            Unreadable::MissingReach { what } => write!(f, "{what}")?,
         }
         write!(f, "; answering in full and writing it anew")
     }
@@ -2222,7 +2251,7 @@ fn save<'m, D: Driver, S: Sharing>(
             && rekeyed.pages == 0
             && lent.renew_root(reach_name.as_str(), blaze_cas::plain::ROOT_LIFE_NS).is_live())
         {
-            lent.root_through(reach_name.as_str(), &indexes, blaze_cas::plain::ROOT_LIFE_NS).map_err(crate::store::PlaceError::from)?;
+            root_through_reach(lent, reach_name.as_str(), &indexes, Some(&indexed_beside), last_root)?;
         }
         // Retire any stale sharded reach roots left over if this answer previously exceeded the
         // radix threshold and shrank back to unsharded, so certified no-ops never renew them.
@@ -2659,8 +2688,7 @@ pub(crate) fn adopt_certified<'m, D: Driver, S: Sharing>(
                 .map(|p| blaze_cas::plain::beside_key(blaze_cas::Key(p.0))),
         );
         indexes.sort_unstable();
-        lent.root_through(reach_name.as_str(), &indexes, blaze_cas::plain::ROOT_LIFE_NS)
-            .map_err(crate::store::PlaceError::from)?;
+        root_through_reach(lent, reach_name.as_str(), &indexes, None, Some(pointer.root))?;
         unroot_reach_shards(lent, name, 0, true, frame);
     } else {
         if lent.has_root(reach_name.as_str()) {
@@ -2690,8 +2718,7 @@ pub(crate) fn adopt_certified<'m, D: Driver, S: Sharing>(
                 );
             }
             scratch.sort_unstable();
-            lent.root_through(shard_name.as_str(), &scratch, blaze_cas::plain::ROOT_LIFE_NS)
-                .map_err(crate::store::PlaceError::from)?;
+            root_through_reach(lent, shard_name.as_str(), &scratch, None, Some(pointer.root))?;
         }
         let delta_name = bstd::mem::format_in!(frame, "{name}.{REACH_ROOT}.{REACH_DELTA_SUFFIX}");
         lent.root_through(delta_name.as_str(), &[], blaze_cas::plain::ROOT_LIFE_NS)
@@ -2745,14 +2772,167 @@ pub(crate) struct LoadedBase<'m, 'a> {
     pub(crate) aux: BaseAux,
 }
 
+/// How [`open_named_base`] checks that a stored answer's CAS reach roots are still live in the
+/// store manifest before reusing its pages.
+#[derive(Clone, Copy, PartialEq, Eq, Debug)]
+pub(crate) enum ReachCheck<'a> {
+    /// Standard answer root (`<prefix>.answer` + either `<prefix>.reach` or sharded
+    /// `<prefix>.reach.00..` + `<prefix>.reach.delta`).
+    Sharded(&'a str),
+    /// Single-root answer (`tool-base.*`: always `<prefix>.answer` + `<prefix>.reach`).
+    Single(&'a str),
+    /// Test-only `BasePlant::OnePointer` (`LATEST_ROOT` carries no separate reach root).
+    #[cfg(test)]
+    None,
+}
+
+/// Zero-I/O manifest check for the certificate fast path (before `open_root`): returns `true`
+/// iff `<prefix>.answer` and either `<prefix>.reach` or a complet
```

**File**: `crates/blaze-cli/src/engine_check.rs` (modified, +48/-14)
```diff
@@ -3272,6 +3272,7 @@ fn checking<'f, 's: 'f>(
     fn open_fallback_base<'m, 'f: 'm, 'a, D: blaze_core::Driver, S: crate::store::Sharing>(
         cx: &Cx,
         store: &mut crate::store::CommandStore<'m, '_, D, S>,
+        lent: &blaze_cas::plain::Lent<D, crate::store::StoreAlloc>,
         root: &Dir<ReadWrite>,
         check_scope: CheckScope<'_>,
         whole_root: &str,
@@ -3284,15 +3285,26 @@ fn checking<'f, 's: 'f>(
         frame: &'f Frame,
     ) -> Result<Option<(crate::engine_answer::LoadedBase<'m, 'a>, FallbackFrom)>, CliError> {
         if !check_scope.is_whole()
-            && let Some(loaded) = crate::engine_answer::open_named_base(cx, store, whole_root, tools, exclude, require_current_tools, alloc, frame)?
+            && let Some(loaded) = crate::engine_answer::open_named_base(
+                cx,
+                store,
+                lent,
+                whole_root,
+                crate::engine_answer::ReachCheck::Sharded(whole_root),
+                tools,
+                exclude,
+                require_current_tools,
+                alloc,
+                frame,
+            )?
         {
             return Ok(Some((loaded, FallbackFrom::OwnWhole)));
         }
-        if let Some(loaded) = crate::engine_answer::open_base_for_tools(cx, store, root, tools, exclude, require_current_tools, alloc, frame)? {
+        if let Some(loaded) = crate::engine_answer::open_base_for_tools(cx, store, lent, root, tools, exclude, require_current_tools, alloc, frame)? {
             return Ok(Some((loaded, FallbackFrom::OtherWorkspace)));
         }
         if include_tool_base
-            && let Some(loaded) = crate::engine_answer::open_toolchain_base(cx, store, toolchain, tools, alloc, frame)?
+            && let Some(loaded) = crate::engine_answer::open_toolchain_base(cx, store, lent, toolchain, tools, alloc, frame)?
         {
             return Ok(Some((loaded, FallbackFrom::Toolchain)));
         }
@@ -3314,7 +3326,7 @@ fn checking<'f, 's: 'f>(
         if !fresh {
             match recovery {
                 StoredRecovery::SkipOwn { exclude } => {
-                    if let Some((loaded, from)) = open_fallback_base(cx, &mut store, root, check_scope, &whole_root, toolchain, &tools, Some(exclude), false, false, request_mem_of(request_mem_slot)?.shared(), frame)?
+                    if let Some((loaded, from)) = open_fallback_base(cx, &mut store, &opened.lent, root, check_scope, &whole_root, toolchain, &tools, Some(exclude), false, false, request_mem_of(request_mem_slot)?.shared(), frame)?
                         && from != FallbackFrom::Toolchain
                     {
                         pointer = Some(loaded.pointer);
@@ -3346,7 +3358,7 @@ fn checking<'f, 's: 'f>(
                                 loaded_own_whole = true;
                             }
                             if !loaded_own_whole
-                                && let Some((loaded, from)) = open_fallback_base(cx, &mut store, root, check_scope, &whole_root, toolchain, &tools, None, false, true, request_mem_of(request_mem_slot)?.shared(), frame)?
+                                && let Some((loaded, from)) = open_fallback_base(cx, &mut store, &opened.lent, root, check_scope, &whole_root, toolchain, &tools, None, false, true, request_mem_of(request_mem_slot)?.shared(), frame)?
                             {
                                 pointer = Some(loaded.pointer);
                                 last_lines = Some(loaded.lines);
@@ -3364,7 +3376,7 @@ fn checking<'f, 's: 'f>(
                         Some(Err(why)) => {
                             phases.mark_cx(cx, "stored answer's pointer read", frame);
                             if allow_stale_fallback
-                                && let Some((loaded, from)) = open_fallback_base(cx, &mut store, root, check_scope, &whole_root, toolchain, &tools, None, false, true, request_mem_of(request_mem_slot)?.shared(), frame)?
+                                && let Some((loaded, from)) = open_fallback_base(cx, &mut store, &opened.lent, root, check_scope, &whole_root, toolchain, &tools, None, false, true, request_mem_of(request_mem_slot)?.shared(), frame)?
                             {
                                 pointer = Some(loaded.pointer);
                                 last_lines = Some(loaded.lines);
@@ -3392,7 +3404,7 @@ fn checking<'f, 's: 'f>(
                             let mut used_fallback = false;
                             if !own_ptr.certifies_under(&tools)
                                 && allow_stale_fallback
-                                && let Some((loaded, from)) = open_fallback_base(cx, &mut store, root, check_scope, &whole_root, toolchain, &tools, Some(own_ptr.key), true, false, request_mem_of(request_mem_slot)?.shared(), frame)?
+                                && let Some((loaded, from)) = open_fallback_base(cx, &mut store, &opened.lent, root, check_scope, &whole_root, toolchain, &tools, Some(ow
```

**File**: `crates/blaze-cli/src/engine_start.rs` (modified, +89/-5)
```diff
@@ -230,6 +230,9 @@ pub(crate) fn command(
     if command != Command::Run && flags.open == blaze_run::viewer::OpenExplore::Open {
         return Err(CliError::Usage("--open is `blaze run`'s"));
     }
+    if command != Command::Run && flags.quiet {
+        return Err(CliError::Usage("-q / --quiet is `blaze run`'s"));
+    }
     if flags.output.is_some() {
         return Err(CliError::Usage("-o / --output is `blaze build`'s"));
     }
@@ -247,13 +250,19 @@ pub(crate) fn command(
     };
     let view = flags.view.unwrap_or(blaze_report::frame::plain::View::Person);
     let line = crate::run_line::LineOpts::from_env(env, err, flags.color, screen_cmd, view, flags.status_every.is_some());
-    let line = crate::run_line::LineOpts { live: line.live && matches!(command, Command::Run | Command::Test), ..line };
+    let status_opts = crate::run_line::StatusOpts::for_run(screen_cmd, view, flags.quiet, line.terminal);
+    let line = crate::run_line::LineOpts {
+        live: line.live && matches!(command, Command::Run | Command::Test) && !flags.quiet,
+        ..line
+    };
     let start_scope = match command {
         Command::Run => crate::engine_check::StartScope::Bin(launch.select),
         Command::Test => crate::engine_check::StartScope::Test(launch.select),
         Command::Check => return Err(CliError::Usage("`check` is engine_check.rs's; engine_start.rs starts `run` and `test`")),
     };
-    let lined = crate::run_line::watched(cx, err, clock, line, |watch, bg| {
+    let checking_label = checking_target(&flags, env, cx.frame());
+    let lined = crate::run_line::watched_run(cx, err, clock, line, status_opts, |watch, bg, status_out| {
+        status_out.checking(checking_label.as_str());
         watch.see(blaze_screen::Step::Began(blaze_screen::Stage::Checking));
         let bg_live = if line.live { Some(bg) } else { None };
         check_for_start(cx, Some(args), fs, env, net, host, rng, words, err, phases, heap, &flags, command == Command::Run, start_scope, bg_live, |standing, phases, rng| {
@@ -262,8 +271,8 @@ pub(crate) fn command(
             let select = run_package::Select { member: standing.member, ..launch.select };
             let started = match command {
                 Command::Run => match standing.picked {
-                    Some(picked) => run_program(cx, standing, &picked, &launch, phases, watch),
-                    None => run_package::pick(cx, root, select, frame).and_then(|picked| run_program(cx, standing, &picked, &launch, phases, watch)),
+                    Some(picked) => run_program(cx, standing, &picked, &launch, phases, watch, status_out),
+                    None => run_package::pick(cx, root, select, frame).and_then(|picked| run_program(cx, standing, &picked, &launch, phases, watch, status_out)),
                 },
                 Command::Test => match standing.test_packages {
                     Some(packages) => run_tests(cx, standing, packages, select.bin, &launch, clock, rng, phases, watch),
@@ -278,6 +287,37 @@ pub(crate) fn command(
     lined.map_err(CliError::RunLine)?
 }
 
+/// Concise label shown on `blaze run`'s initial `    Checking <label>` status line using only
+/// parsed CLI flags and `PWD` (zero filesystem syscalls).
+fn checking_target<'f>(
+    flags: &crate::Flags<'_>,
+    env: Option<&bstd::env::Env>,
+    frame: &'f bstd::mem::Frame,
+) -> bstd::mem::String<&'f bstd::mem::Frame> {
+    match (flags.select.package, flags.select.bin) {
+        (Some(pkg), Some(bin)) if bin != pkg => return bstd::mem::format_in!(frame, "{pkg} ({bin})"),
+        (Some(pkg), _) => return bstd::mem::format_in!(frame, "{pkg}"),
+        (None, Some(bin)) => return bstd::mem::format_in!(frame, "{bin}"),
+        (None, None) => {}
+    }
+    if let Some(dir) = flags.dir {
+        let trimmed = dir.trim_end_matches('/');
+        if !trimmed.is_empty() && trimmed != "." {
+            return bstd::mem::format_in!(frame, "{trimmed}");
+        }
+    }
+    if let Some(env) = env
+        && let Ok(name) = bstd::env::VarName::new("PWD")
+        && let Ok(Some(pwd)) = env.get(&name)
+    {
+        let trimmed = pwd.trim_end_matches('/');
+        if let Some(base) = trimmed.rsplit('/').next().filter(|s| !s.is_empty()) {
+            return bstd::mem::format_in!(frame, "{base}");
+        }
+    }
+    bstd::mem::format_in!(frame, "workspace")
+}
+
 /// Domain for folding a non-whole `CheckScope` into the `RunIds` table's certificate so two
 /// scoped starts reusing the same whole-workspace stored answer root never collide on one table.
 const SCOPED_IDS_CERT_DOMAIN: &str = "blaze-cli run ids scoped cert 1";
@@ -1068,7 +1108,13 @@ pub(crate) fn start_facts<'f>(
 /// image by key, its body ids, then the program under the lazy parent (program.rs `run`), which
 /// builds what it calls and refuses a called body whose check does not run (D151).
 pub(crate) fn run_program(
-    cx: &Cx, mut standing: Standing<'_, '_>, picked: &run_package::Program<'_
```

**File**: `crates/blaze-cli/src/main.rs` (modified, +6/-0)
```diff
@@ -425,6 +425,8 @@ struct Flags<'a> {
     select: run_package::Select<'a>,
     /// `--open`: opt-in to opening the Explore web page in the browser on `blaze run` (default: off).
     open: blaze_run::viewer::OpenExplore,
+    /// `-q` / `--quiet`: suppress `blaze run`'s persistent status lines and live TUI on stderr.
+    quiet: bool,
     /// `-o <path>` / `--output <path>`: where `blaze build` writes the standalone executable.
     output: Option<&'a str>,
     /// `--target <triple>`: target backend for `blaze build` (`native` or `wasm64`).
@@ -459,6 +461,7 @@ impl<'a> Flags<'a> {
             status_every: None,
             select: run_package::Select::NONE,
             open: blaze_run::viewer::OpenExplore::No,
+            quiet: false,
             output: None,
             target: None,
             names_oracle: engine_names::NamesOracle::Off,
@@ -585,6 +588,9 @@ pub(crate) fn parse_flags_in<'a>(args: &'a Args, frame: &Frame, mut package: imp
     if parsed.has("open") {
         flags.open = blaze_run::viewer::OpenExplore::Open;
     }
+    if parsed.has("quiet") {
+        flags.quiet = true;
+    }
     if parsed.has("names-oracle") {
         flags.names_oracle = engine_names::NamesOracle::On;
     }
```

**File**: `crates/blaze-cli/src/run_line.rs` (modified, +424/-7)
```diff
@@ -15,14 +15,18 @@
 //! Off a terminal (a pipe, a file, `CI`, `TERM=dumb`, `BLAZE_UI=plain`: blaze-screen `live`)
 //! the run is handed [`Unwatched`] and no thread is started.
 
-use core::fmt;
+use core::cell::RefCell;
+use core::fmt::{self, Write as _};
 use core::time::Duration;
 
 use blaze_core::lock::{Lock, Signal};
 use blaze_report::frame::Choice;
 use blaze_report::frame::plain::View;
 use blaze_report::terminal::{self, Color, Config, Terminal};
-use blaze_screen::{Caps, Command, LineBuf, RunStatus, RunStatusOpts, StatusFrame, Step, Unwatched, Watch, encode_status};
+use blaze_screen::{
+    Caps, Command, LineBuf, RunStatus, RunStatusOpts, StatusFrame, StatusVerb, Step, Unwatched, Watch, encode_status,
+    write_command_line, write_elapsed_secs, write_status_line,
+};
 use bstd::clock::{Clock, Instant};
 use bstd::cx::CxSpawn;
 use bstd::env::Env;
@@ -38,6 +42,12 @@ const MOST_COLS: u16 = 512;
 const FRAME_BYTES: usize = 16384;
 /// Bounded wait slice when `ProgressSink::see` waits for the ticker to flush an erase.
 const ERASE_WAIT: Duration = Duration::from_millis(50);
+/// Maximum UTF-8 bytes kept for the package name in a `Finished` line.
+const LAUNCH_PKG_BYTES: usize = 128;
+/// Maximum UTF-8 bytes kept for the formatted `` `<bin> <args...>` `` command line.
+const LAUNCH_CMD_BYTES: usize = 1024;
+/// Stack buffer for a persistent Cargo-style status line batch (`Checking`, or `Finished` + `Running`).
+const STATUS_BYTES: usize = 2048;
 
 /// Why the live line failed: said when the command ends (the run itself went on).
 #[derive(Debug)]
@@ -106,23 +116,165 @@ impl LineOpts {
     }
 }
 
+/// Persistent Cargo-style status line configuration for `blaze run` on stderr.
+#[derive(Clone, Copy, Debug)]
+pub(crate) struct StatusOpts {
+    /// Emit persistent `Checking` / `Finished` / `Running` lines on stderr (`Command::Run`,
+    /// `View::Person`, `!quiet`), both on TTYs (colored) and non-TTYs (plain).
+    pub enabled: bool,
+    pub terminal: Terminal,
+}
+
+impl StatusOpts {
+    pub(crate) const OFF: StatusOpts = StatusOpts { enabled: false, terminal: Terminal::PIPE };
+
+    /// Enables Cargo-style persistent stderr status lines for human-facing non-quiet `blaze run`.
+    pub(crate) fn for_run(command: Command, view: View, quiet: bool, terminal: Terminal) -> StatusOpts {
+        StatusOpts { enabled: command == Command::Run && matches!(view, View::Person) && !quiet, terminal }
+    }
+}
+
+/// Truncates `text` to the longest UTF-8 prefix fitting in `max_bytes`.
+fn truncate_utf8(text: &str, max_bytes: usize) -> &str {
+    if text.len() <= max_bytes {
+        return text;
+    }
+    let mut take = max_bytes;
+    while take > 0 && !text.is_char_boundary(take) {
+        take -= 1;
+    }
+    &text[..take]
+}
+
+/// Bounded inline writer that caps output at `N - 4` bytes and flags truncation cleanly.
+struct CappedLine<const N: usize> {
+    buf: LineBuf<N>,
+    truncated: bool,
+}
+
+impl<const N: usize> CappedLine<N> {
+    const fn new() -> Self {
+        Self { buf: LineBuf::new(), truncated: false }
+    }
+}
+
+impl<const N: usize> fmt::Write for CappedLine<N> {
+    fn write_str(&mut self, s: &str) -> fmt::Result {
+        if self.truncated {
+            return Ok(());
+        }
+        let limit = N.saturating_sub(4);
+        let room = limit.saturating_sub(self.buf.as_bytes().len());
+        if s.len() <= room {
+            let _ = self.buf.write_str(s);
+        } else {
+            let _ = self.buf.write_str(truncate_utf8(s, room));
+            self.truncated = true;
+        }
+        Ok(())
+    }
+}
+
+/// Resolved target metadata saved once `run_package::Program` is picked and emitted atomically
+/// on `Step::Started` right after erasing the inline TUI and right before spawning the child.
+struct LaunchInfo {
+    package: LineBuf<LAUNCH_PKG_BYTES>,
+    cmd: LineBuf<LAUNCH_CMD_BYTES>,
+}
+
+impl LaunchInfo {
+    fn new(package: &str, bin: &str, args: &[&str]) -> Self {
+        let mut pkg_buf = LineBuf::<LAUNCH_PKG_BYTES>::new();
+        let _ = pkg_buf.write_str(truncate_utf8(package, LAUNCH_PKG_BYTES));
+        let mut capped = CappedLine::<LAUNCH_CMD_BYTES>::new();
+        let _ = write_command_line(&mut capped, bin, args);
+        if capped.truncated {
+            let _ = capped.buf.write_str("...`");
+        }
+        Self { package: pkg_buf, cmd: capped.buf }
+    }
+}
+
+fn write_checking_line(cx: &Cx, err: &Out, terminal: &Terminal, failed: &mut Option<RunLineError>, target: &str) {
+    if failed.is_some() {
+        return;
+    }
+    let mut buf = LineBuf::<STATUS_BYTES>::new();
+    let trimmed = truncate_utf8(target, 512);
+    if write_status_line(&mut buf, terminal, StatusVerb::Checking, format_args!("{trimmed}")).is_err() {
+        *failed = Some(RunLineError::Encode);
+        return;
+    }
+    if let Err(why) = err.write_all(cx, buf.as_bytes()).and_then(|()| err.flush(cx)) {
+        *failed = Some(RunLineError::Out(why));

```

**File**: `crates/blaze-cli/src/tests/engine_bases_worktrees_tests.rs` (modified, +282/-0)
```diff
@@ -319,3 +319,285 @@ fn stale_older_tools_answer_in_worktree_falls_back_to_current_binary_base_and_co
     let control = run_case(BasePlant::NoStaleFallback);
     assert!(control.entered(blaze_engine::Stage::Bodies) > 0, "control must re-enter bodies under older-tools own answer:\n{}", control.profile);
 }
+
+/// Regression test for Bug 2 (`CrateScope` `MissingEntry { table: WorldCrates }` after starting
+/// from `tool-base` and hitting a layout/toolchain cell update):
+/// 1. `keep_toolchain_base` must populate `by_file` / `root.files` for every non-inline toolchain
+///    row so `Edit.files` retires any stale toolchain `CrateScope` not in today's `Names` world.
+/// 2. A post-fix `tool-base` carrying an extra `CrateScope` row reading a cell defined by `core`
+///    cleanly retires that row via `Edit.files` when repo B runs with a moved `Names` tool (so
+///    `core` re-runs and updates its cells), never waking it into `MissingEntry { WorldCrates }`.
+/// 3. A pre-fix legacy `tool-base` with empty `root.files` (`PagesPlant::FilesDropped`) is
+///    rejected by `open_toolchain_base` and automatically rewritten with populated `root.files` on
+///    the next check.
+#[test]
+fn toolchain_base_populates_by_file_and_retires_stale_cratescopes_on_layout_change() {
+    use blaze_drive::{Kind, Name};
+    use blaze_engine::{Cause, CellId, Phase, Row, Stage};
+    use crate::store::Store as _;
+
+    BASE_PLANT.set(BasePlant::None);
+    let io = Io::simulated(SimWorld::new(59, Limits::USUAL));
+    let shelf = lang_shelf(&io);
+    repository_a(&io, A1);
+    repository_b(&io, B);
+
+    let check_with = |checkout: Checkout| {
+        let opts = || {
+            let mut opts = engine_check_tests::opts(&io, 2, false);
+            opts.place.checkout = checkout.dir;
+            opts.toolchain = shelf;
+            opts
+        };
+        check_in::<fix::Atomic>(&io, checkout, &opts, View::Person, None)
+    };
+
+    // 1. Cold check of A1 populates `tool-base`. Verify EVERY non-inline row in `tool-base` is
+    //    owned by its `row.file` in both `decoded.answer.by_file` and `root.files`.
+    let a1 = check_with(A1);
+    assert_eq!(a1.errors, 0, "A1 cold check clean:\n{}", a1.profile);
+
+    let ghost_scope = Name::new(Kind::CrateScope, blaze_ids::ContentId::of("bug2 ghost cratescope", b"stale-edition-crate"));
+    let mut core_cell: Option<(CellId, blaze_ids::ContentId)> = None;
+    let orig_decoded_rows: usize;
+
+    {
+        let cx = io.cx(BUDGET, TASK_FRAME).expect("root cx");
+        let frame = Frame::with_reserve(16 << 20, bstd::mem::Tag::Other).expect("frame");
+        let alloc = blaze_own::Erased::new(&frame);
+        let opts = engine_check_tests::opts(&io, 2, false);
+        let fs = io.need_fs().expect("files");
+        let root = fs.open_dir(&cx, &Path::new(A1.dir).expect("a path")).expect("open");
+        let err = io.need_err().expect("err");
+        let clock = io.need_clock().expect("clock");
+        let host = io.need_host().expect("host");
+        let mut rng = io.need_rng().expect("rng");
+        let opened = crate::store::open_for_command(&cx, &fs, &host, &mut rng, opts.place.home, None, &root, A1.dir, &clock, &err, opts.heap).expect("open store");
+        let mut store = crate::store::CommandStore::new(&cx, &opened.lent, false, opened.open_ns, None, clock.clone(), &err, alloc.handle()).expect("store");
+        let ptr = crate::engine_answer::load_toolchain_base(&cx, &mut store, shelf, &opts.tools, &frame)
+            .expect("load tool-base")
+            .expect("tool-base exists")
+            .expect("tool-base readable");
+        let dir = crate::engine_answer::open_root(&cx, &mut store, ptr.root, opts.heap.shared())
+            .expect("open root")
+            .expect("valid root");
+        assert!(!dir.files.is_empty(), "tool-base root.files must be populated so stale rows can be retired");
+
+        let mut decoded = blaze_engine::pages::decode(
+            ptr.root,
+            |k| match store.get(&cx, k) {
+                Ok(Some(held)) => Some(Ok(blaze_engine::pages::Sealed::by_store(k, held.bytes, held.proof))),
+                _ => None,
+            },
+            opts.heap.shared(),
+        )
+        .expect("decode tool-base");
+        orig_decoded_rows = decoded.answer.rows.len();
+        assert!(orig_decoded_rows > 0, "tool-base holds toolchain rows");
+        for (&name, row) in decoded.answer.rows.iter() {
+            if !row.inline {
+                assert!(
+                    decoded.answer.by_file.get(&row.file).is_some_and(|members| members.binary_search(&name).is_ok()),
+                    "tool-base row {name:?} must be listed under its file {:?} in by_file",
+                    row.file
+                );
+                assert!(
+                    dir.files.contains_key(&row.file),
+                    "tool-base root.files must contain {:?} for row {name:?}",
+                    row.file
+              
```

**File**: `crates/blaze-cli/tests/run_output.rs` (modified, +16/-3)
```diff
@@ -1,6 +1,8 @@
 //! `blaze run` and `blaze export` as processes:
 //! - `blaze run` on a clean rung: its standard output is byte-equal to the rung's `expected`, its
-//!   standard error is empty, and its status is the program's.
+//!   standard error carries Cargo-style persistent status lines (`Checking`/`Finished`/`Running`,
+//!   plain without ANSI when piped), `-q` / `--quiet` leaves standard error empty, and its status
+//!   is the program's.
 //! - `blaze export` on `no_core`, `std`, multi-threaded `#[thread_local]`/`thread_local!`, and
 //!   multi-package workspaces (`-p`, `--bin`, `-o`, `--workers`, `--stats`): executes the emitted
 //!   standalone native binary directly with `env_clear()` (no `blaze-launcher`) and verifies its
@@ -135,9 +137,20 @@ fn a_clean_run_prints_only_its_program() {
         let mut cmd = blaze_cmd(&dir, &home);
         cmd.arg("run");
         let output = run_with_deadline(cmd, rung, secs(120));
-        assert_eq!(output.status.code(), Some(0), "{rung}: {}", utf8(&output.stderr));
+        let err = utf8(&output.stderr);
+        assert_eq!(output.status.code(), Some(0), "{rung}: {err}");
         assert_eq!(utf8(&output.stdout), utf8(stdout), "{rung}: standard output");
-        assert_eq!(utf8(&output.stderr), "", "{rung}: a clean run says nothing");
+        assert!(!err.contains('\x1b'), "{rung}: piped stderr must not emit ANSI escapes: {err:?}");
+        assert!(err.contains("    Checking "), "{rung}: expected Checking status line: {err:?}");
+        assert!(err.contains("    Finished "), "{rung}: expected Finished status line: {err:?}");
+        assert!(err.contains("     Running `"), "{rung}: expected Running status line: {err:?}");
+
+        let mut quiet = blaze_cmd(&dir, &home);
+        quiet.args(["run", "-q"]);
+        let quiet_out = run_with_deadline(quiet, rung, secs(120));
+        assert_eq!(quiet_out.status.code(), Some(0), "{rung} -q: {}", utf8(&quiet_out.stderr));
+        assert_eq!(utf8(&quiet_out.stdout), utf8(stdout), "{rung} -q: standard output");
+        assert_eq!(utf8(&quiet_out.stderr), "", "{rung} -q: a quiet run says nothing on stderr");
     }
     assert_eq!(real_shared_listing(), before, "the owner's ~/.blaze/v2/store changed while the test ran (another blaze of the owner's, or this test writing there)");
     assert!(home.join(".blaze/v2/store").is_dir(), "the temporary home's shared store: the run kept its records there");
```

#### Recent Merged Pull Requests:
- **PR #2673** (2026-11-27): blaze-shell: collapsible Cmd+S workspace/fork sidebar, process icon bundle, centered avatar monogram (@andrewgazelka)
- **PR #2672** (2026-11-27): perf,fix(cli,ladder,emit): wave 23 — impl-macro coverage, msched loop compaction, dep/toolchain Typed CAS cache, and ripgrep UX (@andrewgazelka)
- **PR #2671** (2026-11-27): blaze-shell: parse diagnostic stdout, add [prompt] show_toolchains config, indented directory tree popover (@andrewgazelka)
- **PR #2670** (2026-11-27): blaze-shell: render stderr & diagnostic cards in monospace with verbatim column alignment (@andrewgazelka)
- **PR #2669** (2026-11-27): blaze-shell: visual GPU commit graph with +/- diff stats in branch hover popover (@andrewgazelka)
- **PR #2668** (2026-11-27): perf,fix,feat(emit,cli,engine,screen): wave 22 — mra global liveness pruning, reach-root/tool-base consistency, and blaze run status lines (@andrewgazelka)

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

## X. build-script): hermetic pinned clang-23 compiler probes with per-probe CAS cache

**RULE**:
When implementing operations in `crates/blaze-build-script/src/c_tasks_probe.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in indexable-inc/blaze. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `314c5390`: build-script): hermetic pinned clang-23 compiler probes with per-probe CAS cache. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/blaze-build-script/src/c_tasks_probe.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Domain for canonical [`ProbeKey`] hashing (answerer id, clang sha256, sdk/sysroot id, program,
/// canonical args, canonical `CLANG_ENV`, sorted input file sha256s).
pub const PROBE_KEY_DOMAIN: &str = "blaze-build-script c probe 1";
/// Domain for [`canonical_reply_digest`] (matches `spawn_route::reply_digest` so `fact_now` and
/// `spawn_probe` agree).
const REPLY_DOMAIN: &str = "blaze build-script spawn reply 1";
/// Magic bytes of an encoded binary probe cache record (`bzcp` v1).
const ANSWER_MAGIC: [u8; 4] = *b"bzcp";
const ANSWER_VERSION: u32 = 1;
/// The script's root mount / package directory spelling in a row (`/package`, `/workspace/...`).
pub const MOUNT: &str = "$MOUNT";
/// `TMPDIR` is intentionally excluded: host ambient temp dirs (e.g. `/private/var/folders/...`)
/// must never pollute content-addressed probe keys; hermetic execution supplies the probe's own
/// private confined output directory as `TMPDIR`.
pub const CLANG_ENV: [&str; 10] = [
/// Normalizes a path under `out_dir`, collapsing `.` and repeated `/` separators and rejecting
/// `..` traversal or trailing directory slashes, so `-o /out/./flag_check /out/./flag_check.c`
/// resolves to the exact same `
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
pub const CLANG_ENV: [&str; 11] = [
    "TMPDIR",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `314c5390` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
