# Forensic Learning Record (Deep Inspection): Automattic/harper

> **Canonical Artifact**: `07_PROJECT_LEARNING/automattic-harper-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Automattic/harper](https://github.com/Automattic/harper))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:22:58.522Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Automattic/harper`
- **Description**: Offline, privacy-first grammar checker. Fast, open-source, Rust-powered
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 16166 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `fuzz/fuzz_targets/fuzz_harper_core_markdown.rs`
```
#![no_main]

use harper_core::parsers::{Markdown, MarkdownOptions, StrParser};
use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &str| {
    let opts = MarkdownOptions::default();
    let parser = Markdown::new(opts);
    let _res = parser.parse_str(data);
});

```

### Core Architecture Module: `harper-core/benches/parse_essay.rs`
```
use criterion::{Criterion, criterion_group, criterion_main};
use harper_core::linting::{LintGroup, Linter};
use harper_core::spell::FstDictionary;
use harper_core::{Dialect, Document};
use std::hint::black_box;

static ESSAY: &str = include_str!("./essay.md");

fn parse_essay(c: &mut Criterion) {
    c.bench_function("parse_essay", |b| {
        b.iter(|| Document::new_markdown_default_curated(black_box(ESSAY)));
    });
}

fn lint_essay(c: &mut Criterion) {
    let dictionary = FstDictionary::curated();
    let mut lint_set = LintGroup::new_curated(dictionary, Dialect::American);
    let document = Document::new_markdown_default_curated(black_box(ESSAY));

    c.bench_function("lint_essay", |b| {
        b.iter(|| lint_set.lint(&document));
    });
}

fn lint_essay_uncached(c: &mut Criterion) {
    c.bench_function("lint_essay_uncached", |b| {
        b.iter(|| {
            let dictionary = FstDictionary::curated();
            let mut lint_set = LintGroup::new_curated(dictionary.clone(), Dialect::American);
            let document = Document::new_markdown_default(black_box(ESSAY), &dictionary);
            lint_set.lint(&document)
        })
    });
}

pub fn criterion_benchmark(c: &mut Criterion) {
    parse_essay(c);
    lint_essay(c);
    lint_essay_uncached(c);
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);

```

### Core Architecture Module: `harper-core/benches/spellcheck.rs`
```
use criterion::{
    BenchmarkGroup, Criterion, Throughput, criterion_group, criterion_main, measurement::WallTime,
};
use harper_core::spell::{Dictionary, FstDictionary, MergedDictionary, suggest_correct_spelling};
use std::hint::black_box;

static ESSAY: &str = include_str!("./essay.md");

// misspelled_words/: one word per line, no comments or markup.
// Distribution mirrors natural text to avoid skewing results:
// - Mostly edit distance 1-2 (common typos), a few distance 3
// - Mix of short, medium, and long words
// The essay.md bench covers realistic prose;
// these lists complement it with realistic misspelling patterns.
static MISSPELLED_MIXED: &str = include_str!("./misspelled_words/mixed.md");
static MISSPELLED_LOWERCASE: &str = include_str!("./misspelled_words/lowercase.md");
static MISSPELLED_CAPITALIZED: &str = include_str!("./misspelled_words/capitalized.md");

// Shared with alloc_profile.rs (../examples/) and the WASM harness
// (../../harper-wasm/benches/wasm_bench.js) so numbers stay comparable across tools.
const MAX_EDIT_DISTANCE: u8 = 3;
const MAX_RESULTS: usize = 200;

type WordList = Vec<Vec<char>>;
type WordCase<'a> = (&'static str, &'a [Vec<char>]);

/// Pulls words out of the essay sample.
///
/// This gives the benchmark a realistic prose word stream while trimming
/// punctuation so we measure spell-check work, not punctuation noise.
fn essay_words() -> WordList {
    ESSAY
        .split_whitespace()
        .map(|w| w.trim_matches(|c: char| !c.is_alphabetic()))
        .filter(|w| !w.is_empty())
        .map(|w| w.chars().collect())
        .collect()
}

/// Loads a word list from a static string (one word per line).
fn load_word_list(source: &str) -> WordList {
    source
        .lines()
        .filter(|l| !l.is_empty())
        .map(|w| w.chars().collect())
        .collect()
}

/// Returns the shared typo cases used by multiple benchmark groups.
///
/// Keeping this in one place makes it easier to add, remove, or rename cases
/// without updating each benchmark group by hand.
fn typo_cases<'a>(
    mixed: &'a WordList,
    lowercase: &'a WordList,
    capitalized: &'a WordList,
) -> [WordCase<'a>; 3] {
    [
        ("misspelled_mixed", mixed.as_slice()),
        ("misspelled_lowercase", lowercase.as_slice()),
        ("misspelled_capitalized", capitalized.as_slice()),
    ]
}

/// Tells Criterion how many words a benchmark case processes.
///
/// This makes the output easier to read because results are tied to the number
/// of words handled, not just to one pass over a particular file.
fn set_word_throughput(group: &mut BenchmarkGroup<'_, WallTime>, words: &[Vec<char>]) {
    group.throughput(Throughput::Elements(words.len() as u64));
}

/// Benchmarks a spell-check operation on a word list.
///
/// This contains the shared benchmark loop used by all spell-check cases. It
/// also adds up result counts so the compiler cannot treat returned values as
/// unused and optimize too aggressively.
fn bench_word_list<F>(
    group: &mut BenchmarkGroup<'_, WallTime>,
    name: &str,
    words: &[Vec<char>],
    mut run: F,
) where
    F: FnMut(&[char]) -> usize,
{
    set_word_throughput(group, words);
    group.bench_function(name, |b| {
        b.iter(|| {
            let mut total_matches = 0usize;
            for word in words {
                total_matches += run(black_box(word.as_slice()));
            }
            total_matches
        });
    });
}

/// Benchmarks direct `FstDictionary::fuzzy_match` calls on a word list.
///
/// This is the most direct way to measure changes in the FST spell-check path.
fn bench_fuzzy_match(group: &mut BenchmarkGroup<'_, WallTime>, name: &str, words: &[Vec<char>]) {
    let dict = FstDictionary::curated();

    bench_word_list(group, name, words, |word| {
        black_box(dict.fuzzy_match(word, MAX_EDIT_DISTANCE, MAX_RESULTS)).len()
    });
}

/// Benchmarks `suggest_correct_spelling` on a word list.
///
/// This measures the higher-level suggestion path on top of `fuzzy_match`,
/// including result ordering, so we can see whether the lower-level win still
/// shows up after the extra suggestion work.
fn bench_suggest_correct_spelling(
    group: &mut BenchmarkGroup<'_, WallTime>,
    name: &str,
    words: &[Vec<char>],
) {
    let dict = FstDictionary::curated();

    bench_word_list(group, name, words, |word| {
        black_box(suggest_correct_spelling(
            word,
            MAX_RESULTS,
            MAX_EDIT_DISTANCE,
            &*dict,
        ))
        .len()
    });
}

/// Benchmarks fuzzy matching through a single-child `MergedDictionary`.
///
/// This checks the extra wrapper layer around the underlying dictionary call.
/// It is intentionally a single-child setup, so it measures wrapper cost more
/// than realistic merged-dictionary behavior.
fn bench_fuzzy_match_merged_dict_single_child(
    group: &mut BenchmarkGroup<'_, WallTime>,
    name: &str,
    words: &[Vec<char>],
) {
    let dict = FstDictionary::curated();
    let mut merged = MergedDictionary::new();
    merged.add_dictionary(dict);

    bench_word_list(group, name, words, |word| {
        black_box(merged.fuzzy_match(word, MAX_EDIT_DISTANCE, MAX_RESULTS)).len()
    });
}

/// Registers the spell-check benchmarks and word-list splits.
///
/// The mixed typo benchmarks keep continuity with older results, while the
/// lowercase and capitalized versions make the case-based effect easier to see
/// instead of averaging it away. Each group also reports throughput in words,
/// which makes the output easier to compare if the input lists change later.
pub fn criterion_benchmark(c: &mut Criterion) {
    let essay = essay_words();
    let misspelled_mixed = load_word_list(MISSPELLED_MIXED);
    let misspelled_lowercase = load_word_list(MISSPELLED_LOWERCASE);
    let misspelled_capitalized = load_word_list(MISSPELLED_CAPITALIZED);
    let cases = typo_cases(
        &misspelled_mixed,
        &misspelled_lowercase,
        &misspelled_capitalized,
    );

    let mut fuzzy_match_group = c.benchmark_group("fuzzy_match");
    bench_fuzzy_match(&mut fuzzy_match_group, "essay", &essay);
    for &(name, words) in &cases {
        bench_fuzzy_match(&mut fuzzy_match_group, name, words);
    }
    fuzzy_match_group.finish();

    let mut suggest_group = c.benchmark_group("suggest_correct_spelling");
    for &(name, words) in &cases {
        bench_suggest_correct_spelling(&mut suggest_group, name, words);
    }
    suggest_group.finish();

    let mut merged_group = c.benchmark_group("fuzzy_match_merged_dict_single_child");
    for &(name, words) in &cases {
        bench_fuzzy_match_merged_dict_single_child(&mut merged_group, name, words);
    }
    merged_group.finish();
}

criterion_group!(benches, criterion_benchmark);
criterion_main!(benches);

```

### Core Architecture Module: `harper-core/examples/alloc_profile.rs`
```
//! Counts heap allocations made by `fuzzy_match` across the benchmark word lists.
//! Allocation is relatively more expensive in WASM than on native, so reducing
//! allocs/word helps spell-check latency on lower-end devices.
//!
//! Run with: `cargo run --example alloc_profile -p harper-core --release`

use std::alloc::{GlobalAlloc, Layout, System};
use std::hint::black_box;
use std::sync::atomic::{AtomicUsize, Ordering};

use harper_core::spell::{Dictionary, FstDictionary};

struct CountingAllocator {
    alloc_count: AtomicUsize,
    dealloc_count: AtomicUsize,
}

impl CountingAllocator {
    fn reset(&self) {
        self.alloc_count.store(0, Ordering::Relaxed);
        self.dealloc_count.store(0, Ordering::Relaxed);
    }

    fn alloc_count(&self) -> usize {
        self.alloc_count.load(Ordering::Relaxed)
    }

    fn dealloc_count(&self) -> usize {
        self.dealloc_count.load(Ordering::Relaxed)
    }
}

unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        self.alloc_count.fetch_add(1, Ordering::Relaxed);
        unsafe { System.alloc(layout) }
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        self.dealloc_count.fetch_add(1, Ordering::Relaxed);
        unsafe { System.dealloc(ptr, layout) }
    }
}

#[global_allocator]
static ALLOC: CountingAllocator = CountingAllocator {
    alloc_count: AtomicUsize::new(0),
    dealloc_count: AtomicUsize::new(0),
};

// Values duplicated across the WASM harness (harper-wasm/benches/wasm_bench.js)
// and the criterion bench (benches/spellcheck.rs) so numbers stay comparable.
const MAX_EDIT_DISTANCE: u8 = 3;
const MAX_RESULTS: usize = 200;

// Shared with the criterion bench (../benches/spellcheck.rs) to keep numbers comparable.
static MISSPELLED_MIXED: &str = include_str!("../benches/misspelled_words/mixed.md");
static MISSPELLED_LOWERCASE: &str = include_str!("../benches/misspelled_words/lowercase.md");
static MISSPELLED_CAPITALIZED: &str = include_str!("../benches/misspelled_words/capitalized.md");

fn load_word_list(source: &str) -> Vec<Vec<char>> {
    source
        .lines()
        .filter(|l| !l.is_empty())
        .map(|w| w.chars().collect())
        .collect()
}

fn profile_word_list(name: &str, words: &[Vec<char>], dict: &FstDictionary) {
    ALLOC.reset();

    for word in words {
        black_box(dict.fuzzy_match(black_box(word.as_slice()), MAX_EDIT_DISTANCE, MAX_RESULTS));
    }

    let allocs = ALLOC.alloc_count();
    let deallocs = ALLOC.dealloc_count();
    let net = allocs as i64 - deallocs as i64;
    let word_count = words.len();

    println!("{name}:");
    println!("  words:          {word_count}");
    println!("  allocs:         {allocs}");
    println!("  deallocs:       {deallocs}");
    println!("  net:            {net:+}");
    println!("  allocs/word:    {:.1}", allocs as f64 / word_count as f64);
    println!();
}

fn main() {
    // Initialize dictionary before resetting counters so startup allocs are excluded.
    let dict = FstDictionary::curated();
    // Warm the AUTOMATON_BUILDERS thread_local so its init allocs aren't counted
    // against the first measured case.
    let _ = black_box(dict.fuzzy_match(&['w', 'a', 'r', 'm'], MAX_EDIT_DISTANCE, MAX_RESULTS));

    let mixed = load_word_list(MISSPELLED_MIXED);
    let lowercase = load_word_list(MISSPELLED_LOWERCASE);
    let capitalized = load_word_list(MISSPELLED_CAPITALIZED);

    let cases = [
        ("misspelled_mixed", mixed.as_slice()),
        ("misspelled_lowercase", lowercase.as_slice()),
        ("misspelled_capitalized", capitalized.as_slice()),
    ];

    println!("--- fuzzy_match allocation profile ---");
    println!("max_edit_distance: {MAX_EDIT_DISTANCE}, max_results: {MAX_RESULTS}");
    println!();

    for (name, words) in cases {
        profile_word_list(name, words, &*dict);
    }
}

```

### Core Architecture Module: `harper-core/expr_linter_skeleton.rs`
```
use crate::{
    Lint, Token, TokenStringExt,
    expr::{Expr, SequenceExpr},
    linting::{ExprLinter, LintKind, Suggestion, debug::format_lint_match, expr_linter::Chunk},
};

pub struct ExprLinterSkeleton {
    expr: SequenceExpr,
}

impl Default for ExprLinterSkeleton {
    fn default() -> Self {
        Self {
            expr: SequenceExpr::any_capitalization_of("erorr"),
        }
    }
}

impl ExprLinter for ExprLinterSkeleton {
    type Unit = Chunk;

    fn match_to_lint_with_context(
        &self,
        matched_tokens: &[Token],
        source: &[char],
        context: Option<(&[Token], &[Token])>,
    ) -> Option<Lint> {
        eprintln!("🚨 {}", format_lint_match(matched_tokens, context, source));
        let span = matched_tokens.span()?;
        let lint_kind = LintKind::Miscellaneous;
        let suggestions = vec![Suggestion::replace_with_match_case_str(
            "correction",
            span.get_content(source),
        )];
        let message = "Fix this erorr".to_owned();
        Some(Lint {
            span,
            lint_kind,
            suggestions,
            message,
            ..Default::default()
        })
    }

    fn expr(&self) -> &dyn Expr {
        &self.expr
    }

    fn description(&self) -> &str {
        "A linter skeleton for contributors to copy into `harper_core/src/linting/` and rename."
    }
}

#[cfg(test)]
mod tests {
    use crate::linting::tests::assert_suggestion_result;

    use super::ExprLinterSkeleton;

    #[test]
    fn test_skeleton() {
        assert_suggestion_result("erorr", ExprLinterSkeleton::default(), "correction");
    }
}

```

### Core Architecture Module: `harper-core/expr_linter_skeleton_commented.rs`
```
use crate::{
    // EDIT You won't need `TokenStringExt` unless you need a span covering multiple tokens.
    Lint,
    Token,
    TokenStringExt,
    // EDIT `SequenceExpr` is the most versatile `Expr` but you can use any `Expr` or `Pattern`
    expr::{Expr, SequenceExpr},
    // EDIT `expr_linter::Chunk` is a run of tokens between commas and is the default.
    // EDIT But if you want to match a pattern containing commas, use `Sentence` instead.
    linting::{ExprLinter, LintKind, Suggestion, debug::format_lint_match, expr_linter::Chunk},
};

// EDIT rename this struct for your new linter
pub struct ExprLinterSkeleton {
    // EDIT `SequenceExpr` is the most versatile `Expr` but you can use any `Expr` or `Pattern`
    expr: SequenceExpr,
}

// EDIT If your linter doesn't need access to the dictionary and doesn't depend on the dialect
// EDIT   then just use `default()` as the only constructor.
// EDIT If you need dictionary or dialect access, use `impl ExprLinterSkeleton` and `fn new()`
// EDIT   instead of `impl Default for ExprLinterSkeleton` and `fn default()`
impl Default for ExprLinterSkeleton {
    fn default() -> Self {
        Self {
            // EDIT `SequenceExpr` is the most versatile `Expr` but you can use any `Expr` or `Pattern`.
            // EDIT `SequenceExpr` has many many useful methods from which you can build fairly complex
            // EDIT   expressions
            expr: SequenceExpr::any_capitalization_of("erorr"),
        }
    }
}

impl ExprLinter for ExprLinterSkeleton {
    type Unit = Chunk;

    // EDIT If you don't need the context before or after the matched tokens
    // EDIT   then use the simpler `fn match_to_lint()` instead.
    // EDIT There are some methods in `expr_linter` to help checking for words
    // EDIT   and punctuation in the "before" or "after" contexts.
    fn match_to_lint_with_context(
        &self,
        // NOTE Whitespace also uses a `Token`. What out for LLMs and agents that
        // NOTE   assume `Token`s are always words. "Hello World" is actually three
        // NOTE   tokens and "World" is `matched_tokens[2]`, not `[1]` as your LLM might assume.
        matched_tokens: &[Token],
        source: &[char],
        context: Option<(&[Token], &[Token])>,
    ) -> Option<Lint> {
        // EDIT A debug printf here while developing is very handy for verifying
        // EDIT   that your `Expr` above is matching what you expect
        // EDIT   make sure you remove this before committing
        eprintln!("🚨 {}", format_lint_match(matched_tokens, context, source));

        // EDIT Place your custom linter logic here.
        // EDIT If your `Expr` can sometimes match

        // EDIT `span` is the range of tokens that you will modify (or insert after).
        // EDIT It is also the range that will be underlined etc.
        // EDIT Each `Token` has a `.span` or you get get a `Span` of a slice of `Token`s
        // EDIT   using `.span()` from `TokenStringExt`.
        // EDIT Note that every `Suggestion` for a single `Lint` must use the same span.
        // EDIT This is important if you are correcting a phrase by suggesting one change
        // EDIT   to one word, or a different change to a different word. In this case
        // EDIT   your `span` will need to cover at least both of those words.
        let span = matched_tokens.span()?;

        // EDIT Look in `harper-core/src/linting/lint_kind.rs` for the lint kinds available
        // EDIT   with their descriptions to help you decide which is appropriate.
        let lint_kind = LintKind::Miscellaneous;

        // EDIT It may not be practical to suggest a correction. In such cases, use `vec![]`.
        // EDIT Otherwise you can offer one or several suggestions. Each suggestion must
        // EDIT   operate on the same `Span`. You can replace the `Span`, remove the `Span`,
        // EDIT   or insert after the `Span`. When replacing text you will normally want to
        // EDIT   maintain how it used uppercase vs lowercase letter. So `replace_with_match_case`.
        // EDIT In that case you need to pass the `template` as well as the new `value`.
        // EDIT To get the template, you pass the original text as a `&[char]` slice.
        // EDIT It's worth keeping in mind that though there are some helper functions that
        // EDIT   work with `String` or `&str` or string literals, most of this infrastructure
        // EDIT   natively works with `Vec<char>` or `&[char]`.
        let suggestions = vec![Suggestion::replace_with_match_case_str(
            "correction",
            span.get_content(source),
        )];

        // EDIT You can return different messages depending on what the problem is and what
        // EDIT   the suggestions are.
        // EDIT If it's not possible to be 100% sure that only real mistakes are flagged
        // EDIT   and there's a likelihood of some non-mistakes being flagged as false positives
        // EDIT   your message should allow for both possibilities.
        // EDIT Likewise, if two or more suggestions are very different, as happens with
        // EDIT   confusable words, it's a good idea to guide the user with concise definitions.
        let message = "Fix this erorr".to_owned();

        // EDIT You can return different `Lint`s from different places in your logic.
        Some(Lint {
            span,
            lint_kind,
            suggestions,
            message,
            // EDIT `priority` is not that well defined yet. Feel free to use `..Default::default`
            // EDIT   for now. Note that if you do, you mustn't use a trailing comma.
            ..Default::default()
        })
    }

    fn expr(&self) -> &dyn Expr {
        &self.expr
    }

    fn description(&self) -> &str {
        "A linter skeleton for contributors to copy into `harper_core/src/linting/` and rename."
    }
}

#[cfg(test)]
mod tests {
    // EDIT There's a bunch more useful assertions for unit tests in `linting::tests`.
    use crate::linting::tests::assert_suggestion_result;

    use super::ExprLinterSkeleton;

    #[test]
    fn test_skeleton() {
        assert_suggestion_result("erorr", ExprLinterSkeleton::default(), "correction");
    }
}

```

### Core Architecture Module: `harper-core/src/case.rs`
```
use std::borrow::Borrow;

use smallvec::SmallVec;

use crate::{CharString, char_string::CHAR_STRING_INLINE_SIZE};

/// Apply the casing of `template` to `target`.
///
/// If `template` is shorter than `target`, the casing of the last character of `template` will be reused for
/// the rest of the string.
///
/// If `template` is empty, all characters will be lowercased.
#[must_use]
pub fn copy_casing(
    template: impl IntoIterator<Item = impl Borrow<char>>,
    target: impl IntoIterator<Item = impl Borrow<char>>,
) -> CharString {
    target
        .into_iter()
        .scan(
            (template.into_iter().get_casing(), Case::Lower),
            |(template, prev_case), c| {
                // Skip non-alphabetic characters in `target` without advancing `template`.
                if c.borrow().is_alphabetic()
                    && let Some(template_case) = template.next()
                {
                    *prev_case = template_case;
                };
                Some(prev_case.apply_to(*c.borrow()))
            },
        )
        .flatten()
        .collect()
}

/// Represents the casing of a character.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Case {
    Upper,
    Lower,
}

impl Case {
    /// Apply the casing to a provided character.
    ///
    /// This essentially calls [`char::to_uppercase()`] or [`char::to_lowercase()`] depending on
    /// the state of `self`. Similarly to those functions, it returns an iterator of the resulting
    /// character(s).
    pub fn apply_to(&self, char: char) -> impl Iterator<Item = char> + use<> {
        match self {
            Self::Upper => char.to_uppercase().collect::<SmallVec<[char; 2]>>(),
            Self::Lower => char.to_lowercase().collect::<SmallVec<[char; 2]>>(),
        }
        .into_iter()
    }
}

impl TryFrom<char> for Case {
    type Error = ();

    /// Try to get the casing from the given character.
    ///
    /// This fails if the character is neither uppercase nor lowercase.
    fn try_from(value: char) -> Result<Self, Self::Error> {
        if value.is_uppercase() {
            Ok(Self::Upper)
        } else if value.is_lowercase() {
            Ok(Self::Lower)
        } else {
            Err(())
        }
    }
}

// TODO: maybe move this functionality to CharStringExt if and when CharStringExt can be
// generalized to work with char iterators.
pub trait CaseIterExt {
    fn get_casing(self) -> impl Iterator<Item = Case>;
    fn get_casing_unfiltered(self) -> SmallVec<[Option<Case>; CHAR_STRING_INLINE_SIZE]>;
}
impl<I: IntoIterator<Item = T>, T: Borrow<char>> CaseIterExt for I {
    /// Get an iterator of [`Case`] from a collection of characters. Note that this will not
    /// include cases for characters that are neither uppercase nor lowercase.
    fn get_casing(self) -> impl Iterator<Item = Case> {
        self.into_iter()
            .filter_map(|char| (*char.borrow()).try_into().ok())
    }

    /// Get casing for the provided string. Unlike [`Self::get_casing`], the output will always
    /// be the same length as the input string. If a character is neither uppercase nor lowercase,
    /// its corresponding case will be `None`.
    fn get_casing_unfiltered(self) -> SmallVec<[Option<Case>; CHAR_STRING_INLINE_SIZE]> {
        self.into_iter()
            .map(|c| Case::try_from(*c.borrow()).ok())
            .collect()
    }
}

```

### Core Architecture Module: `harper-core/src/char_ext.rs`
```
use unicode_script::{Script, UnicodeScript};
use unicode_width::UnicodeWidthChar;

use crate::Punctuation;

mod private {
    pub trait Sealed {}

    impl Sealed for char {}
}

pub trait CharExt: private::Sealed {
    fn is_cjk(&self) -> bool;
    /// Whether a character can be a component of an English word.
    fn is_english_lingual(&self) -> bool;
    fn is_emoji(&self) -> bool;
    fn is_punctuation(&self) -> bool;
    /// Whether the character is an (English) vowel.
    ///
    /// Checks whether the character is in the set (A, E, I, O, U); case-insensitive.
    fn is_vowel(&self) -> bool;
    fn normalized(&self) -> Self;
}

impl CharExt for char {
    fn is_english_lingual(&self) -> bool {
        !self.is_whitespace()
            && !self.is_numeric()
            && !self.is_emoji()
            && matches!(self.width(), Some(1..))
            && !self.is_punctuation()
            && self.is_alphabetic()
            && !self.is_cjk()
            && self.script() == Script::Latin
    }

    fn normalized(&self) -> Self {
        match self {
            '\u{2018}' | '\u{2019}' | '\u{02BC}' | '\u{FF07}' => '\'',
            '\u{201C}' | '\u{201D}' | '\u{FF02}' => '"',
            '\u{2013}' | '\u{2014}' | '\u{2212}' | '\u{FF0D}' => '-',
            _ => *self,
        }
    }

    fn is_emoji(&self) -> bool {
        let Some(block) = unicode_blocks::find_unicode_block(*self) else {
            return false;
        };

        let blocks = [
            unicode_blocks::SPECIALS,
            unicode_blocks::EMOTICONS,
            unicode_blocks::MISCELLANEOUS_SYMBOLS,
            unicode_blocks::VARIATION_SELECTORS,
            unicode_blocks::SUPPLEMENTAL_SYMBOLS_AND_PICTOGRAPHS,
        ];

        blocks.contains(&block)
    }

    fn is_cjk(&self) -> bool {
        let Some(block) = unicode_blocks::find_unicode_block(*self) else {
            return false;
        };

        let blocks = [
            unicode_blocks::CJK_UNIFIED_IDEOGRAPHS,
            unicode_blocks::CJK_UNIFIED_IDEOGRAPHS_EXTENSION_A,
            unicode_blocks::CJK_UNIFIED_IDEOGRAPHS_EXTENSION_B,
            unicode_blocks::CJK_UNIFIED_IDEOGRAPHS_EXTENSION_C,
            unicode_blocks::CJK_UNIFIED_IDEOGRAPHS_EXTENSION_D,
            unicode_blocks::CJK_UNIFIED_IDEOGRAPHS_EXTENSION_E,
            unicode_blocks::CJK_UNIFIED_IDEOGRAPHS_EXTENSION_F,
            unicode_blocks::CJK_UNIFIED_IDEOGRAPHS_EXTENSION_G,
            unicode_blocks::CJK_UNIFIED_IDEOGRAPHS_EXTENSION_H,
            unicode_blocks::CJK_UNIFIED_IDEOGRAPHS_EXTENSION_I,
            unicode_blocks::HANGUL_JAMO,
            unicode_blocks::HANGUL_SYLLABLES,
            unicode_blocks::HANGUL_JAMO_EXTENDED_A,
            unicode_blocks::HANGUL_JAMO_EXTENDED_B,
            unicode_blocks::HANGUL_COMPATIBILITY_JAMO,
            unicode_blocks::CJK_SYMBOLS_AND_PUNCTUATION,
            unicode_blocks::CJK_STROKES,
            unicode_blocks::CJK_COMPATIBILITY,
            unicode_blocks::CJK_COMPATIBILITY_FORMS,
            unicode_blocks::CJK_COMPATIBILITY_IDEOGRAPHS,
            unicode_blocks::CJK_COMPATIBILITY_IDEOGRAPHS_SUPPLEMENT,
            unicode_blocks::CJK_RADICALS_SUPPLEMENT,
            unicode_blocks::ENCLOSED_CJK_LETTERS_AND_MONTHS,
            unicode_blocks::HIRAGANA,
        ];

        blocks.contains(&block)
    }

    fn is_punctuation(&self) -> bool {
        Punctuation::from_char(*self).is_some()
    }

    fn is_vowel(&self) -> bool {
        matches!(self.to_ascii_lowercase(), 'a' | 'e' | 'i' | 'o' | 'u')
    }
}

#[cfg(test)]
mod tests {
    use super::CharExt;

    #[test]
    fn cjk_is_not_english_lingual() {
        assert!(!'世'.is_english_lingual())
    }
}

```

### Core Architecture Module: `harper-core/src/char_string.rs`
```
use crate::char_ext::CharExt;
use std::borrow::Cow;
use std::iter::Iterator;

use smallvec::SmallVec;

// TODO: remove this when `SmallVec` allows retrieving this value in a const context.
pub(crate) const CHAR_STRING_INLINE_SIZE: usize = 16;

/// A char sequence that improves cache locality.
/// Most English words are fewer than 12 characters.
pub type CharString = SmallVec<[char; CHAR_STRING_INLINE_SIZE]>;

mod private {
    pub trait Sealed {}

    impl Sealed for [char] {}
}

/// Extensions to character sequences that make them easier to wrangle.
pub trait CharStringExt: private::Sealed {
    /// Convert all characters to lowercase, returning a new owned vector if any changes were made.
    fn to_lower(&'_ self) -> Cow<'_, [char]>;

    /// Normalize the character sequence according to the dictionary's standard character set.
    fn normalized(&'_ self) -> Cow<'_, [char]>;

    /// Convert the character sequence to a String.
    fn to_string(&self) -> String;

    /// Case-insensitive comparison with a character slice, assuming the right-hand side is lowercase ASCII.
    /// Only normalizes the left side to lowercase and avoids allocations.
    fn eq_ch(&self, other: &[char]) -> bool;

    /// Case-insensitive comparison with a string slice, assuming the right-hand side is lowercase ASCII.
    /// Only normalizes the left side to lowercase and avoids allocations.
    fn eq_str(&self, other: &str) -> bool;

    /// Case-insensitive comparison with any of a list of string slices, assuming the right-hand side is lowercase ASCII.
    /// Only normalizes the left side to lowercase and avoids allocations.
    fn eq_any_ignore_ascii_case_str(&self, others: &[&str]) -> bool;

    /// Case-insensitive comparison with any of a list of character slices, assuming the right-hand side is lowercase ASCII.
    /// Only normalizes the left side to lowercase and avoids allocations.
    fn eq_any_ignore_ascii_case_chars(&self, others: &[&[char]]) -> bool;

    /// Case-insensitive check if the string starts with the given ASCII prefix.
    /// The prefix is assumed to be lowercase.
    fn starts_with_ignore_ascii_case_str(&self, prefix: &str) -> bool;

    /// Case-insensitive check if the string starts with any of the given ASCII prefixes.
    /// The prefixes are assumed to be lowercase.
    fn starts_with_any_ignore_ascii_case_str(&self, prefixes: &[&str]) -> bool;

    /// Case-insensitive check if the string ends with the given ASCII suffix.
    /// The suffix is assumed to be lowercase.
    fn ends_with_ignore_ascii_case_chars(&self, suffix: &[char]) -> bool;

    /// Case-insensitive check if the string ends with the given ASCII suffix.
    /// The suffix is assumed to be lowercase.
    fn ends_with_ignore_ascii_case_str(&self, suffix: &str) -> bool;

    /// Case-insensitive check if the string ends with any of the given ASCII suffixes.
    /// The suffixes are assumed to be lowercase.
    fn ends_with_any_ignore_ascii_case_chars(&self, suffixes: &[&[char]]) -> bool;

    /// Check if the string contains any vowels
    fn contains_vowel(&self) -> bool;

    /// Strip a prefix from the string, case-insensitively
    fn strip_prefix_ignore_ascii_case_chars(&self, prefix: &[char]) -> Option<&[char]>;
}

impl CharStringExt for [char] {
    fn to_lower(&'_ self) -> Cow<'_, [char]> {
        if self.iter().all(|c| c.is_lowercase()) {
            return Cow::Borrowed(self);
        }

        let mut out = CharString::with_capacity(self.len());

        out.extend(self.iter().flat_map(|v| v.to_lowercase()));

        Cow::Owned(out.to_vec())
    }

    fn to_string(&self) -> String {
        self.iter().collect()
    }

    /// Convert a given character sequence to the standard character set
    /// the dictionary is in.
    fn normalized(&'_ self) -> Cow<'_, [char]> {
        if self.as_ref().iter().any(|c| c.normalized() != *c) {
            Cow::Owned(
                self.as_ref()
                    .iter()
                    .copied()
                    .map(|c| c.normalized())
                    .collect(),
            )
        } else {
            Cow::Borrowed(self)
        }
    }

    fn eq_str(&self, other: &str) -> bool {
        // Assert that the right-hand side is all-lowercase as required
        debug_assert!(
            other
                .chars()
                .all(|c| c.is_ascii_lowercase() || !c.is_ascii_alphabetic()),
            "eq_str requires right-hand side to be lowercase ASCII, but got: {:?}",
            other
        );

        let mut chit = self.iter();
        let mut strit = other.chars();

        loop {
            let (c, s) = (chit.next(), strit.next());
            match (c, s) {
                (Some(c), Some(s)) => {
                    if c.to_ascii_lowercase() != s {
                        return false;
                    }
                }
                (None, None) => return true,
                _ => return false,
            }
        }
    }

    fn eq_ch(&self, other: &[char]) -> bool {
        // Assert that the right-hand side is all-lowercase as required
        debug_assert!(
            other
                .iter()
                .all(|c| c.is_ascii_lowercase() || !c.is_ascii_alphabetic()),
            "eq_ch requires right-hand side to be lowercase ASCII, but got: {:?}",
            other
        );

        self.len() == other.len()
            && self
                .iter()
                .zip(other.iter())
                .all(|(a, b)| a.to_ascii_lowercase() == *b)
    }

    fn eq_any_ignore_ascii_case_str(&self, others: &[&str]) -> bool {
        others.iter().any(|str| self.eq_str(str))
    }

    fn eq_any_ignore_ascii_case_chars(&self, others: &[&[char]]) -> bool {
        others.iter().any(|chars| self.eq_ch(chars))
    }

    fn starts_with_ignore_ascii_case_str(&self, prefix: &str) -> bool {
        let prefix_len = prefix.chars().count();
        if self.len() < prefix_len {
            return false;
        }
        self.iter()
            .take(prefix_len)
            .zip(prefix.chars())
            .all(|(a, b)| a.to_ascii_lowercase() == b)
    }

    fn starts_with_any_ignore_ascii_case_str(&self, prefixes: &[&str]) -> bool {
        prefixes
            .iter()
            .any(|prefix| self.starts_with_ignore_ascii_case_str(prefix))
    }

    fn ends_with_ignore_ascii_case_str(&self, suffix: &str) -> bool {
        let suffix_len = suffix.chars().count();
        if self.len() < suffix_len {
            return false;
        }
        self.iter()
            .rev()
            .take(suffix_len)
            .rev()
            .zip(suffix.chars())
            .all(|(a, b)| a.to_ascii_lowercase() == b)
    }

    fn ends_with_ignore_ascii_case_chars(&self, suffix: &[char]) -> bool {
        let suffix_len = suffix.len();
        if self.len() < suffix_len {
            return false;
        }
        self.iter()
            .rev()
            .take(suffix_len)
            .rev()
            .zip(suffix.iter())
            .all(|(a, b)| a.to_ascii_lowercase() == *b)
    }

    fn ends_with_any_ignore_ascii_case_chars(&self, suffixes: &[&[char]]) -> bool {
        suffixes
            .iter()
            .any(|suffix| self.ends_with_ignore_ascii_case_chars(suffix))
    }

    fn contains_vowel(&self) -> bool {
        self.iter().any(|c| c.is_vowel())
    }

    fn strip_prefix_ignore_ascii_case_chars(&self, prefix: &[char]) -> Option<&[char]> {
        (self.len() >= prefix.len()
            && self
                .iter()
                .zip(prefix)
                .all(|(a, b)| a.eq_ignore_ascii_case(b)))
        .then_some(&self[prefix.len()..])
    }
}

macro_rules! char_string {
    ($string:literal) => {{
        use crate::char_string::CharString;

        $string.chars().collect::<CharString>()
    }};
}

pub(crate) use char_string;

#[cfg(test)]
mod tests {
    use super::CharStringExt;

    #[test]
    fn eq_ignore_ascii_case_chars_matches_lowercase() {
        assert!(['H', 'e', 'l', 'l', 'o'].eq_ch(&['h', 'e', 'l', 'l', 'o']));
    }

    #[test]
    fn eq_ignore_ascii_case_chars_does_not_match_different_word() {
        assert!(!['H', 'e', 'l', 'l', 'o'].eq_ch(&['w', 'o', 'r', 'l', 'd']));
    }

    #[test]
    fn eq_ignore_ascii_case_str_matches_lowercase() {
        assert!(['H', 'e', 'l', 'l', 'o'].eq_str("hello"));
    }

    #[test]
    fn eq_ignore_ascii_case_str_does_not_match_different_word() {
        assert!(!['H', 'e', 'l', 'l', 'o'].eq_str("world"));
    }

    #[test]
    fn ends_with_ignore_ascii_case_chars_matches_suffix() {
        assert!(['H', 'e', 'l', 'l', 'o'].ends_with_ignore_ascii_case_chars(&['l', 'o']));
    }

    #[test]
    fn ends_with_ignore_ascii_case_chars_does_not_match_different_suffix() {
        assert!(
            !['H', 'e', 'l', 'l', 'o']
                .ends_with_ignore_ascii_case_chars(&['w', 'o', 'r', 'l', 'd'])
        );
    }

    #[test]
    fn ends_with_ignore_ascii_case_str_matches_suffix() {
        assert!(['H', 'e', 'l', 'l', 'o'].ends_with_ignore_ascii_case_str("lo"));
    }

    #[test]
    fn ends_with_ignore_ascii_case_str_does_not_match_different_suffix() {
        assert!(!['H', 'e', 'l', 'l', 'o'].ends_with_ignore_ascii_case_str("world"));
    }

    #[test]
    fn differs_only_by_length_1() {
        assert!(!['b', 'b'].eq_str("b"));
    }

    #[test]
    fn differs_only_by_length_2() {
        assert!(!['c'].eq_str("cc"));
    }

    #[test]
    #[should_panic]
    fn right_side_must_be_all_lowercase_str() {
        assert!(['c'].eq_str("C"))
    }

    #[test]
    #[should_panic]
    fn right_side_must_be_all_lowercase_ch() {
        assert!(['c'].eq_ch(&['C']))
    }
}

```

### Core Architecture Module: `harper-core/src/currency.rs`
```
use is_macro::Is;
use serde::{Deserialize, Serialize};

use crate::Number;

/// A national or international currency
#[derive(Debug, Is, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Hash)]
pub enum Currency {
    // $
    Dollar,
    // ¢
    Cent,
    // €
    Euro,
    // ₽
    Ruble,
    // ₺
    Lira,
    // £
    Pound,
    // ¥
    Yen,
    // ฿
    Baht,
    // ₩
    Won,
    // ₭,
    Kip,
    // ₹
    Rupee,
}

impl Currency {
    pub fn from_char(c: char) -> Option<Self> {
        let cur = match c {
            '$' => Self::Dollar,
            '¢' => Self::Cent,
            '€' => Self::Euro,
            '₽' => Self::Ruble,
            '₺' => Self::Lira,
            '£' => Self::Pound,
            '¥' => Self::Yen,
            '฿' => Self::Baht,
            '₩' => Self::Won,
            '₭' => Self::Kip,
            '₹' => Self::Rupee,
            _ => return None,
        };

        Some(cur)
    }

    pub fn to_char(&self) -> char {
        match self {
            Self::Dollar => '$',
            Self::Cent => '¢',
            Self::Euro => '€',
            Self::Ruble => '₽',
            Self::Lira => '₺',
            Self::Pound => '£',
            Self::Yen => '¥',
            Self::Baht => '฿',
            Self::Won => '₩',
            Self::Kip => '₭',
            Self::Rupee => '₹',
        }
    }

    /// Format an amount of the specific currency.
    pub fn format_amount(&self, amount: &Number) -> String {
        let c = self.to_char();

        let amount = amount.to_string();

        match self {
            Currency::Dollar => format!("{c}{amount}"),
            Currency::Cent => format!("{amount}{c}"),
            Currency::Euro => format!("{c}{amount}"),
            Currency::Ruble => format!("{amount} {c}"),
            Currency::Lira => format!("{amount} {c}"),
            Currency::Pound => format!("{c}{amount}"),
            Currency::Yen => format!("{c} {amount}"),
            Currency::Baht => format!("{amount} {c}"),
            Currency::Won => format!("{c} {amount}"),
            Currency::Kip => format!("{c}{amount}"),
            Currency::Rupee => format!("{c}{amount}"),
        }
    }
}

```

### Core Architecture Module: `harper-core/src/dict_word_metadata.rs`
```
use harper_brill::UPOS;
use is_macro::Is;
use itertools::Itertools;
use paste::paste;
use serde::{Deserialize, Serialize};
use smallvec::SmallVec;
use strum::{EnumCount as _, VariantArray as _};
use strum_macros::{Display, EnumCount, EnumIter, EnumString, VariantArray};

use std::convert::TryFrom;

use crate::dict_word_metadata_orthography::OrthFlags;
use crate::spell::WordId;
use crate::{Document, TokenKind, TokenStringExt};

/// This represents a "lexeme" or "headword" which is case-folded but affix-expanded.
/// So not only lemmata but also inflected forms are stored here, with "horn" and "horns" each
/// having their own lexeme, but "Ivy" and "ivy" sharing the same lexeme.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize, PartialOrd, Hash)]
pub struct DictWordMetadata {
    /// The main parts of speech which have extra data.
    pub noun: Option<NounData>,
    pub pronoun: Option<PronounData>,
    pub verb: Option<VerbData>,
    pub adjective: Option<AdjectiveData>,
    pub adverb: Option<AdverbData>,
    pub conjunction: Option<ConjunctionData>,
    pub determiner: Option<DeterminerData>,
    pub affix: Option<AffixData>,
    /// Parts of speech which don't have extra data.
    /// Whether the word is a [preposition](https://www.merriam-webster.com/dictionary/preposition).
    #[serde(default = "default_false")]
    pub preposition: bool,
    /// Whether the word is an offensive word.
    pub swear: Option<bool>,
    /// Whether the word is an abbreviation of any kind.
    pub abbreviation: Option<bool>,
    /// The dialects this word belongs to.
    /// If no dialects are defined, it can be assumed that the word is
    /// valid in all dialects of English.
    #[serde(default = "default_default")]
    pub dialects: DialectFlags,
    /// Orthographic information: letter case, spaces, hyphens, etc.
    #[serde(default = "OrthFlags::empty")]
    pub orth_info: OrthFlags,
    /// Whether the word is considered especially common.
    #[serde(default = "default_false")]
    pub common: bool,
    #[serde(default = "default_none")]
    pub derived_from: Option<WordId>,
    /// Generated by a chunker. Declares whether the word is a member of a nominal phrase. Using
    /// this should be preferred over the similarly named `Pattern`.
    ///
    /// For more details, see [the announcement blog post](https://elijahpotter.dev/articles/training_a_chunker_with_burn).
    pub np_member: Option<bool>,
    /// Generated by a POS tagger. Declares what it inferred the word's part of speech to be.
    pub pos_tag: Option<UPOS>,
}

/// Needed for `serde`
fn default_false() -> bool {
    false
}

/// Needed for `serde`
fn default_none<T>() -> Option<T> {
    None
}

/// Needed for `serde`
fn default_default<T: Default>() -> T {
    T::default()
}

macro_rules! generate_metadata_queries {
    ($($category:ident has $($sub:ident),*).*) => {
        paste! {
            pub fn is_likely_homograph(&self) -> bool {
                [self.is_determiner(), self.preposition, $(
                    self.[< is_ $category >](),
                )*].iter().map(|b| *b as u8).sum::<u8>() > 1
            }

            /// How different is this word from another?
            pub fn difference(&self, other: &Self) -> u32 {
                [
                    $(
                        Self::[< is_ $category >],
                        $(
                            Self::[< is_ $sub _ $category >],
                            Self::[< is_non_ $sub _ $category >],
                        )*
                    )*
                ]
                .iter()
                .fold(0, |acc, func| acc + (func(self) ^ func(other)) as u32)
            }

            $(
                #[doc = concat!("Checks if the word is definitely a ", stringify!($category), ".")]
                pub fn [< is_ $category >](&self) -> bool {
                    self.$category.is_some()
                }

                $(
                    #[doc = concat!("Checks if the word is definitely a ", stringify!($category), " and more specifically is labeled as (a) ", stringify!($sub), ".")]
                    pub fn [< is_ $sub _ $category >](&self) -> bool {
                        matches!(
                            self.$category,
                            Some([< $category:camel Data >]{
                                [< is_ $sub >]: Some(true),
                                ..
                            })
                        ) }

                    #[doc = concat!("Checks if the word is definitely a ", stringify!($category), " and more specifically is labeled as __not__ (a) ", stringify!($sub), ".")]
                    pub fn [< is_non_ $sub _ $category >](&self) -> bool {
                        matches!(
                            self.$category,
                            Some([< $category:camel Data >]{
                                [< is_ $sub >]: None | Some(false),
                                ..
                            })
                        )
                    }
                )*
            )*
        }
    };
}

impl DictWordMetadata {
    /// If there is only one possible interpretation of the metadata, infer its UPOS tag.
    pub fn infer_pos_tag(&self) -> Option<UPOS> {
        // If an explicit POS tag exists, return it immediately.
        if let Some(pos) = self.pos_tag {
            return Some(pos);
        }

        // Collect all possible POS tags from metadata
        let mut candidates = SmallVec::<[UPOS; 14]>::with_capacity(14);

        if self.is_proper_noun() {
            candidates.push(UPOS::PROPN);
        }

        if self.is_pronoun() {
            candidates.push(UPOS::PRON);
        }
        if self.is_noun() {
            candidates.push(UPOS::NOUN);
        }
        if self.is_verb() {
            // Distinguish auxiliary verbs
            if let Some(data) = &self.verb {
                if data.is_auxiliary == Some(true) {
                    candidates.push(UPOS::AUX);
                } else {
                    candidates.push(UPOS::VERB);
                }
            } else {
                candidates.push(UPOS::VERB);
            }
        }
        if self.is_adjective() {
            candidates.push(UPOS::ADJ);
        }
        if self.is_adverb() {
            candidates.push(UPOS::ADV);
        }
        if self.is_conjunction() {
            candidates.push(UPOS::CCONJ);
        }
        if self.is_determiner() {
            candidates.push(UPOS::DET);
        }
        if self.preposition {
            candidates.push(UPOS::ADP);
        }

        // Remove duplicates
        candidates.sort();
        candidates.dedup();

        candidates.into_iter().exactly_one().ok()
    }

    /// Produce a copy of `self` with the known properties of `other` set.
    pub fn or(&self, other: &Self) -> Self {
        let mut clone = self.clone();
        clone.merge(other);
        clone
    }

    /// Given a UPOS tag, discard any metadata that would disagree with the given POS tag.
    /// For example, if the metadata suggests a word could either be a noun or an adjective, and we
    /// provide a [`UPOS::NOUN`], this function will remove the adjective data.
    ///
    /// Additionally, if the metadata does not currently declare the potential of the word to be
    /// the specific POS, it becomes so. That means if we provide a [`UPOS::ADJ`] to the function
    /// for a metadata whose `Self::adjective = None`, it will become `Some`.
    pub fn enforce_pos_exclusivity(&mut self, pos: &UPOS) {
        use UPOS::*;
        match pos {
            NOUN => {
                if let Some(noun) = self.noun {
                    self.noun = Some(NounData {
                        is_proper: Some(false),
                        ..noun
                    })
                } else {
                    self.noun = Some(NounData {
                        is_proper: Some(false),
                        is_singular: None,
                        is_plural: None,
                        is_countable: None,
                        is_mass: None,
                        is_possessive: None,
                    })
                }

                self.pronoun = None;
                self.verb = None;
                self.adjective = None;
                self.adverb = None;
                self.conjunction = None;
                self.determiner = None;
                self.affix = None;
                self.preposition = false;
            }
            PROPN => {
                if let Some(noun) = self.noun {
                    self.noun = Some(NounData {
                        is_proper: Some(true),
                        ..noun
                    })
                } else {
                    self.noun = Some(NounData {
                        is_proper: Some(true),
                        is_singular: None,
                        is_plural: None,
                        is_countable: None,
                        is_mass: None,
                        is_possessive: None,
                    })
                }

                self.pronoun = None;
                self.verb = None;
                self.adjective = None;
                self.adverb = None;
                self.conjunction = None;
                self.determiner = None;
                self.affix = None;
                self.preposition = false;
            }
            PRON => {
                if self.pronoun.is_none() {
                    self.pronoun = Some(PronounData::default())
                }

                self.noun = None;
                self.verb = None;
                self.adjective = None;
                self.adverb = None;
                self.conjunction = None;
                self.determiner = None;
                self.affix = None;
                self.preposition = false;
            }
            VERB => {
                if let Some(verb) = self.verb {
                   
```

### Core Architecture Module: `harper-core/src/dict_word_metadata_orthography.rs`
```
use crate::CharStringExt;
use crate::char_ext::CharExt;
use serde::{Deserialize, Serialize};

/// Orthography information.
pub enum Orthography {
    /// Every char that is a letter is lowercase.
    Lowercase = 1 << 0,
    /// First char is uppercase, the rest is lowercase (but multi-word?)
    Titlecase = 1 << 1,
    /// Every char that is a letter is uppercase (including single-letter uppercase)
    AllCaps = 1 << 2,
    /// Starts with a lowercase letter but also contains uppercase letters.
    LowerCamel = 1 << 3,
    /// Starts with an uppercase letter but also contains lowercase letters. (Superset of Titlecase.)
    UpperCamel = 1 << 4,
    /// Contains at least one space.
    Multiword = 1 << 5,
    /// Contains at least one hyphen.
    Hyphenated = 1 << 6,
    /// Contains an apostrophe, so it's a possessive or a contraction.
    Apostrophe = 1 << 7,
    /// Could be Roman numerals.
    RomanNumerals = 1 << 8,
}

/// The underlying type used for OrthographyFlags.
/// At the time of writing, this is currently a `u8`. If we want to define more than 8 orthographic
/// properties in the future, we will need to switch this to a larger type.
type OrthographyFlagsUnderlyingType = u16;

bitflags::bitflags! {
    /// A collection of bit flags used to represent orthographic properties of a word.
    ///
    /// This is generally used to allow a word (or similar) to be tagged with multiple orthographic
    /// properties.
    #[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, PartialOrd, Serialize)]
    pub struct OrthFlags: OrthographyFlagsUnderlyingType {
        const LOWERCASE = Orthography::Lowercase as OrthographyFlagsUnderlyingType;
        const TITLECASE = Orthography::Titlecase as OrthographyFlagsUnderlyingType;
        const ALLCAPS = Orthography::AllCaps as OrthographyFlagsUnderlyingType;
        const LOWER_CAMEL = Orthography::LowerCamel as OrthographyFlagsUnderlyingType;
        const UPPER_CAMEL = Orthography::UpperCamel as OrthographyFlagsUnderlyingType;
        const MULTIWORD = Orthography::Multiword as OrthographyFlagsUnderlyingType;
        const HYPHENATED = Orthography::Hyphenated as OrthographyFlagsUnderlyingType;
        const APOSTROPHE = Orthography::Apostrophe as OrthographyFlagsUnderlyingType;
        const ROMAN_NUMERALS = Orthography::RomanNumerals as OrthographyFlagsUnderlyingType;
    }
}
impl Default for OrthFlags {
    fn default() -> Self {
        Self::empty()
    }
}

impl OrthFlags {
    /// Construct orthography flags for a given sequence of letters.
    pub fn from_letters(letters: &[char]) -> Self {
        let mut ortho_flags = Self::default();
        let mut all_lower = true;
        let mut all_upper = true;
        let mut first_is_upper = false;
        let mut first_is_lower = false;
        let mut saw_upper_after_first = false;
        let mut saw_lower_after_first = false;
        let mut is_first_char = true;
        let mut upper_to_lower = false;
        let mut lower_to_upper = false;
        let letter_count = letters.iter().filter(|c| c.is_english_lingual()).count();

        for &c in letters {
            if c == ' ' {
                ortho_flags |= Self::MULTIWORD;
                continue;
            }

            if c == '-' {
                ortho_flags |= Self::HYPHENATED;
                continue;
            }

            if c.normalized() == '\'' {
                ortho_flags |= Self::APOSTROPHE;
                continue;
            }

            if !c.is_english_lingual() {
                continue;
            }

            if c.is_lowercase() {
                all_upper = false;
                if is_first_char {
                    first_is_lower = true;
                } else {
                    saw_lower_after_first = true;
                    if upper_to_lower {
                        lower_to_upper = true;
                    }
                    upper_to_lower = true;
                }
            } else if c.is_uppercase() {
                all_lower = false;
                if is_first_char {
                    first_is_upper = true;
                } else {
                    saw_upper_after_first = true;
                    if lower_to_upper {
                        upper_to_lower = true;
                    }
                    lower_to_upper = true;
                }
            } else {
                first_is_upper = false;
                first_is_lower = false;
                upper_to_lower = false;
                lower_to_upper = false;
            }
            is_first_char = false;
        }

        if letter_count > 0 {
            if all_lower {
                ortho_flags |= Self::LOWERCASE;
            }
            if all_upper {
                ortho_flags |= Self::ALLCAPS;
            }
            if letter_count > 1 && first_is_upper && !saw_upper_after_first {
                ortho_flags |= Self::TITLECASE;
            }
            if first_is_lower && saw_upper_after_first {
                ortho_flags |= Self::LOWER_CAMEL;
            }
            if first_is_upper && saw_lower_after_first && saw_upper_after_first {
                ortho_flags |= Self::UPPER_CAMEL;
            }
        }

        if looks_like_roman_numerals(letters) && is_really_roman_numerals(&letters.to_lower()) {
            ortho_flags |= Self::ROMAN_NUMERALS;
        }

        ortho_flags
    }
}

fn looks_like_roman_numerals(word: &[char]) -> bool {
    let mut is_roman = false;
    let first_char_upper;

    if let Some((&first, rest)) = word.split_first()
        && "mdclxvi".contains(first.to_ascii_lowercase())
    {
        first_char_upper = first.is_uppercase();

        for &c in rest {
            if !"mdclxvi".contains(c.to_ascii_lowercase()) || c.is_uppercase() != first_char_upper {
                return false;
            }
        }
        is_roman = true;
    }
    is_roman
}

fn is_really_roman_numerals(word: &[char]) -> bool {
    let s: String = word.iter().collect();
    let mut chars = s.chars().peekable();

    let mut m_count = 0;
    while m_count < 4 && chars.peek() == Some(&'m') {
        chars.next();
        m_count += 1;
    }

    if !check_roman_group(&mut chars, 'c', 'd', 'm') {
        return false;
    }

    if !check_roman_group(&mut chars, 'x', 'l', 'c') {
        return false;
    }

    if !check_roman_group(&mut chars, 'i', 'v', 'x') {
        return false;
    }

    if chars.next().is_some() {
        return false;
    }

    true
}

fn check_roman_group<I: Iterator<Item = char>>(
    chars: &mut std::iter::Peekable<I>,
    one: char,
    five: char,
    ten: char,
) -> bool {
    match chars.peek() {
        Some(&c) if c == one => {
            chars.next();
            match chars.peek() {
                Some(&next) if next == ten || next == five => {
                    chars.next();
                    true
                }
                _ => {
                    let mut count = 0;
                    while count < 2 && chars.peek() == Some(&one) {
                        chars.next();
                        count += 1;
                    }
                    true
                }
            }
        }
        Some(&c) if c == five => {
            chars.next();
            let mut count = 0;
            while count < 3 && chars.peek() == Some(&one) {
                chars.next();
                count += 1;
            }
            true
        }
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use crate::CharString;
    use crate::dict_word_metadata::tests::md;
    use crate::dict_word_metadata_orthography::OrthFlags;

    fn orth_flags(s: &str) -> OrthFlags {
        let letters: CharString = s.chars().collect();
        OrthFlags::from_letters(&letters)
    }

    #[test]
    fn test_lowercase_flags() {
        let flags = orth_flags("hello");
        assert!(flags.contains(OrthFlags::LOWERCASE));
        assert!(!flags.contains(OrthFlags::TITLECASE));
        assert!(!flags.contains(OrthFlags::ALLCAPS));
        assert!(!flags.contains(OrthFlags::LOWER_CAMEL));
        assert!(!flags.contains(OrthFlags::UPPER_CAMEL));

        let flags = orth_flags("hello123");
        assert!(flags.contains(OrthFlags::LOWERCASE));
    }

    #[test]
    fn test_titlecase_flags() {
        let flags = orth_flags("Hello");
        assert!(!flags.contains(OrthFlags::LOWERCASE));
        assert!(flags.contains(OrthFlags::TITLECASE));
        assert!(!flags.contains(OrthFlags::ALLCAPS));
        assert!(!flags.contains(OrthFlags::LOWER_CAMEL));
        assert!(!flags.contains(OrthFlags::UPPER_CAMEL));

        assert!(orth_flags("World").contains(OrthFlags::TITLECASE));
        assert!(orth_flags("Something").contains(OrthFlags::TITLECASE));
        assert!(!orth_flags("McDonald").contains(OrthFlags::TITLECASE));
        assert!(!orth_flags("O'Reilly").contains(OrthFlags::TITLECASE));
        assert!(!orth_flags("A").contains(OrthFlags::TITLECASE));
    }

    #[test]
    fn test_allcaps_flags() {
        let flags = orth_flags("HELLO");
        assert!(!flags.contains(OrthFlags::LOWERCASE));
        assert!(!flags.contains(OrthFlags::TITLECASE));
        assert!(flags.contains(OrthFlags::ALLCAPS));
        assert!(!flags.contains(OrthFlags::LOWER_CAMEL));
        assert!(!flags.contains(OrthFlags::UPPER_CAMEL));

        assert!(orth_flags("NASA").contains(OrthFlags::ALLCAPS));
        assert!(orth_flags("I").contains(OrthFlags::ALLCAPS));
    }

    #[test]
    fn test_lower_camel_flags() {
        let flags = orth_flags("helloWorld");
        assert!(!flags.contains(OrthFlags::LOWERCASE));
        assert!(!flags.contains(OrthFlags::TITLECASE));
        assert!(!flags.contains(OrthFlags::ALLCAPS));
        assert!(flags.contains(OrthFlags::LOWER_CAMEL));
        assert!(!flags.contains(OrthFlags::UPPER_CAMEL));

        assert!(orth_flags("getHTTPResponse").contains(OrthFlags::LOWER_CAMEL));
        assert!(orth_flags("eBay").contains(OrthFlags::LOWE
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4479** (2026-09-30): **British "e.g." breaks `OxfordComma` rule.**
  *Symptoms*: **Describe the bug** When correctly using "e.g." surrounded with commas, and following that directly with a singular "or/and" conjunction, Harper mistakenly flags that there should be an Oxford comma inside the conjunction.  **To Reproduce** 1. Construct a sentence with "MAJOR SENTENCE, e.g., NOUN or NOUN". 2. See "OxfordComma: An Oxford comma is necessary here." flag after the first noun in the conjunction. Example sentence: "Memory is used for different tasks in embedded systems, e.g., storage or communication with sensors and actuators."  **Expected behavior** The sentence should not be flagged, as "e.g." is not part of a listed conjunction.  **Screenshots** In Neovim: <img width="1286" height="51" alt="Image" src="https://github.com/user-attachments/assets/daa7e164-fbe0-4cd0-aa67-bc8b73247083" />  Using the Firefox addon and on writewithharper.com: <img width="1035" height="296" alt="Image" src="https://github.com/user-attachments/assets/a5a8b289-a97e-484f-a2fa-a219975f3a53" />  **Platform** The bug appears at least in the Neovim LS integration, the Firefox addon, or on the "writewithharper.com" preview.
  **Post-Mortem & Fix Analysis**:
  > The bug also appears when starting the sentence with "E.g.," directly, e.g., "E.g., storage or communication with sensors and actuators." This is not really a valid sentence to begin with, but it should be flagged too though, and not with the `OxfordComma` flag!
  > Thanks!

- **Issue #4471** (2026-09-28): **"Trilemma" flagged for Spell Check when it is correct**
  *Symptoms*: **What got flagged?** The word "trilemma" got flagged with `Harper(SpellCheck)` with the message, "Did you mean `dilemma`?".  **Why is this incorrect?** These are both words. A dilemma is between two alternatives, a trilemma is between three.  | Dictionary | Entry | |--------|--------| | American Heritage | [trilemma](https://ahdictionary.com/word/search.html?q=trilemma) | | Cambridge | [trilemma](https://dictionary.cambridge.org/dictionary/english/trilemma) | | Collins | [trilemma](https://www.collinsdictionary.com/dictionary/english/trilemma) | | Merriam-Webster | [trilemma](https://www.merriam-webster.com/dictionary/trilemma) | | Oxford English | [trilemma](https://www.oed.com/search/dictionary/?scope=Entries&q=trilemma) |   **Example of correct usage:**  **2018** - "We confirm the **trilemma** that an AC protocol can only achieve two out of the following three properties: strong anonymity (i.e., anonymity up to a negligible chance), low bandwidth overhead, and low latency overhead." *Das, Debajyoti, Sebastian Meiser, Esfandiar Mohammadi, and Aniket Kate. “[Anonymity Trilemma: Strong Anonymity, Low Bandwidth Overhead, Low Latency - Choose Two.](https://doi.org/10.1109/SP.2018.00011)” 2018 IEEE Symposium on Security and Privacy (SP), May 2018*  See also: Metcalf, Allan A. [Predicting New Words: The Secrets of Their Success](https://books.google.com/books?id=ACsetPyuv8YC&q=trilemma&pg=PA-106). Houghton Mifflin Harcourt, 2004, p. 106

- **Issue #4470** (2026-09-29): **"Surveilled" flagged for Spell Check when it is correct**
  *Symptoms*: **What got flagged?** The word "surveilled" got flagged with `Harper(SpellCheck)` with the message, "Did you mean `surveiled`?".  **Why is this incorrect?** The word "surveilled" is definitely a real word. There are a few websites which claim "surveiled" is the American spelling, but even if we accept that as true[1], this would still be incorrect because Harper makes this suggestion on both American *and* British English. It should definitely *not* be marking "surveilled" as incorrectly spelt, and I would even argue it *should* mark "surveiled" as incorrect, instead suggesting "surveilled".  [1]: Which I don't, as far as I am concerned "surveilled" is the correct spelling in American English and "surveiled" is just flat out wrong, which the built in spellcheck for Firefox agrees with (which I know because I am currently using it).  | Dictionary | "surveilled" or "surveilled"? | |--------|--------| | American Heritage Dictionary | [surveilled](https://ahdictionary.com/word/search.html?q=surveilled) | | Merriam-Webster | [surveilled](https://www.merriam-webster.com/dictionary/surveilled) | | Dictionary.com | [surveilled](https://www.dictionary.com/browse/surveil?mismatchType=uncategorized-inflected-form&q=surveilled) | | Collins | [surveilled](https://www.collinsdictionary.com/us/dictionary/english/surveil) | | Oxford English | [surveilled](https://www.oed.com/dictionary/surveilled_adj?tab=factsheet#123624825100), [but maybe both?](https://www.oed.com/search/dictionary/?scope=
  **Post-Mortem & Fix Analysis**:
  > Thanks! This is a really great way to do issues for words missing from the dictionary. I wouldn't bother with dictionary.com though as it's a secondary source that draws on one or more of the other, primary source, online dictionaries. The others in the list are perfect links.
  > > Thanks! This is a really great way to do issues for words missing from the dictionary. I wouldn't bother with dictionary.com though as it's a secondary source that draws on one or more of the other, primary source, online dictionaries. The others in the list are perfect links.  Yes, sorry. I added Dictionary.com before I discovered [the helpful comment you left here](https://github.com/Automattic/harper/issues/4395#issuecomment-5695334111) and didn't bother to remove it since it was already there.  Maybe something like this should be an issue template for missing words/dictionary issues specifically? Having it pre-filled with known "dictionary authorities" would be helpful, I think.
  > > > Thanks! This is a really great way to do issues for words missing from the dictionary. I wouldn't bother with dictionary.com though as it's a secondary source that draws on one or more of the other, primary source, online dictionaries. The others in the list are perfect links. >  > Yes, sorry. I added Dictionary.com before I discovered [the helpful comment you left here](https://github.com/Automattic/harper/issues/4395#issuecomment-5695334111) and didn't bother to remove it since it was already there. >  > Maybe something like this should be an issue template for missing words/dictionary issues specifically? Having it pre-filled with known "dictionary authorities" would be helpful, I think.  That's a decent idea. I just accidentally edited your post too sorry because I spotted a grammar mistake in my comment and wasn't even aware I was able to edit somebody else's comments. I looked and couldn't see a way to revert it.

- **Issue #4435** (2026-09-30): **False positive: `ItsContraction`**
  *Symptoms*: **What got flagged?** "I spent more effort in its reading than he did in its creation." The first "its" gets flagged as an `ItsContraction` error. The second "its" is unflagged as expected.  **Why is this incorrect?** "its" is the correct form to use before "reading" in this case.  **Example of correct usage:** See flagged sentence.

- **Issue #4420** (2026-09-21): **Cant Update**
  *Symptoms*: Basically the new Harper update doesnt work on obsidian, maybe the manifest is the problem?  I think its this one?  https://github.com/Automattic/harper-obsidian-plugin/commit/de5b305b94d83ac62b61ae81c1106092aa3876bf
  **Post-Mortem & Fix Analysis**:
  > It is even worse:  You cannot currently install Harper from the Obsidian plugin registry, as it points to 2.11.0, which either does not exist or has problems.  Hopefully this will get fixed soon.
  > I've the same problems. I cannot update and I cannot re-install.
  > The Obisidian Harper plugin entry seems to have been removed from the official registry, I do not see it there anymore.  This fixes the problem of showing buggy updates (installed plugin versions will stay as is).  But this obviously prohibits (re-)installing via plugin registry.

- **Issue #4412** (2026-09-26): **`OneOfTheSingular` wrongly flags "one of the latter"**
  *Symptoms*: <img width="338" height="257" alt="Image" src="https://github.com/user-attachments/assets/4678d054-5061-45b3-a91b-685870b1c12e" />  > ...erties, and others asked him to come give talks. One of the latter was Jeanne Russell, who lives with her husband, Ron, on Ver...  In this case `latter` should be added as a special exception to the general rule.

- **Issue #4389** (2026-09-15): **False positive: "defo" flagged as a wrong negative of "info"**
  *Symptoms*: <img width="501" height="207" alt="Image" src="https://github.com/user-attachments/assets/54c21e1e-2750-473b-a1a3-980db6166246" />  `WrongNegative` flags the Australian slang abbreviation "defo" meaning "definitely" and suggests replacing it with "info".

- **Issue #4388** (2026-09-29): **False positive: "we humans" gets `PronounVerbAgreement` flag**
  *Symptoms*: **What got flagged?** "We humans"  "humans" is highlighted as `PronounVerbAgreement` error.  **Why is this incorrect?** "We humans" is common and idiomatic English.  **Example of correct usage:** "We humans are naturally curious."
  **Post-Mortem & Fix Analysis**:
  > Hmm. Odd that "human" is marked as a verb. Removing `/V` might be a sufficient move to fix it. It's listed as a rare verb in Wiktionary:  <img width="1069" height="205" alt="Image" src="https://github.com/user-attachments/assets/75b286ee-658a-4fe5-bfe9-237ba09fd7ab" />  Even the OED doesn't list it as a verb:  <img width="520" height="259" alt="Image" src="https://github.com/user-attachments/assets/f69fa2b1-5d7c-4789-93c0-03920bf1479f" />  I'll remove the `/V` flag in the upcoming dictionary curation PR.

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

### Incident Patch 1: `88c53331` (2026-10-01)
**Commit Message**: build(deps): bump bitflags from 2.13.1 to 2.13.2 (#4498)

Bumps [bitflags](https://github.com/bitflags/bitflags) from 2.13.1 to 2.13.2.
- [Release notes](https://github.com/bitflags/bitflags/releases)
- [Changelog](https://github.com/bitflags/bitflags/blob/main/CHANGELOG.md)
- [Commits](https://github.com/bitflags/bitflags/compare/2.13.1...2.13.2)

---
updated-dependencies:
- dependency-name: bitflags
  dependency-version: 2.13.2
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +24/-24)
```diff
@@ -210,7 +210,7 @@ version = "0.71.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "5f58bf3d7db68cfbac37cfc485a8d711e87e064c3d0fe0435b92f7a407f9d6b3"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "cexpr",
  "clang-sys",
  "itertools 0.13.0",
@@ -247,9 +247,9 @@ checksum = "bef38d45163c2f1dde094a7dfd33ccf595c92905c8f8f4fdc18d06fb1037718a"
 
 [[package]]
 name = "bitflags"
-version = "2.13.1"
+version = "2.13.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b588b76d00fde79687d7646a9b5bdf3cc0f655e0bbd080335a95d7e96f3587da"
+checksum = "3ded4057c258ba199e2d26386d3af3780957ecaee6c4ef4041c6b4b8b97c0b06"
 dependencies = [
  "serde_core",
 ]
@@ -1030,7 +1030,7 @@ version = "0.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "3d44a101f213f6c4cdc1853d4b78aef6db6bdfa3468798cc1d9912f4735013eb"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "core-foundation",
  "libc",
 ]
@@ -1262,7 +1262,7 @@ version = "0.8.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "0ffc10af538ee74535cda260e581f5a177c243803dd30b698934a515f0114b55"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "bytemuck",
  "cubecl-common",
  "cubecl-ir",
@@ -2524,7 +2524,7 @@ version = "0.6.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "45cf04b2726f02df5508c6de726acdc90cdf97ac771a9a0ffd8ba10a6e696bf9"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "gpu-alloc-types",
 ]
 
@@ -2534,7 +2534,7 @@ version = "0.3.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "b2bbed164dd10ed526c2e4fe3e721ca4a71c61730e5aafac6844b417b3227058"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
 ]
 
 [[package]]
@@ -2555,7 +2555,7 @@ version = "0.3.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "b89c83349105e3732062a895becfc71a8f921bb71ecbbdd8ff99263e3b53a0ca"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "gpu-descriptor-types",
  "hashbrown 0.15.5",
 ]
@@ -2566,7 +2566,7 @@ version = "0.2.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "fdf242682df893b86f33a73828fb09ca4b2d3bb6cc95249707fc684d27484b91"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
 ]
 
 [[package]]
@@ -2697,7 +2697,7 @@ name = "harper-core"
 version = "2.12.0"
 dependencies = [
  "ammonia",
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "blanket",
  "boxcar",
  "cached",
@@ -3641,7 +3641,7 @@ version = "0.32.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "00c15a6f673ff72ddcc22394663290f870fb224c1bfce55734a75c414150e605"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "block",
  "core-graphics-types",
  "foreign-types",
@@ -3691,7 +3691,7 @@ checksum = "916cbc7cb27db60be930a4e2da243cf4bc39569195f22fd8ee419cd31d5b662c"
 dependencies = [
  "arrayvec",
  "bit-set",
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "cfg-if",
  "cfg_aliases",
  "codespan-reporting",
@@ -3888,7 +3888,7 @@ version = "0.3.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "2a180dd8642fa45cdb7dd721cd4c11b1cadd4929ce112ebd8b9f5803cc79d536"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
 ]
 
 [[package]]
@@ -4171,7 +4171,7 @@ version = "0.13.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "e9f068eba8e7071c5f9511831b44f32c740d5adf574e990f946ddb53db2f314e"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "getopts",
  "memchr",
  "pulldown-cmark-escape",
@@ -4402,7 +4402,7 @@ version = "11.6.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "498cd0dc59d73224351ee52a95fee0f1a617a2eae0e7d9d720cc622c73a54186"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
 ]
 
 [[package]]
@@ -4449,7 +4449,7 @@ version = "0.5.18"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ed2bf2547551a7053d6fdfafda3f938979645c44812fbfcda098faae3f1a362d"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
 ]
 
 [[package]]
@@ -4666,7 +4666,7 @@ version = "1.1.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "b6fe4565b9518b83ef4f91bb47ce29620ca828bd32cb7e408f0062e9930ba190"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
  "errno",
  "libc",
  "linux-raw-sys",
@@ -4996,7 +4996,7 @@ version = "0.3.0+sdk-1.3.268.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "eda41003dc44290527a59b13432d4a0379379fa074b70174882adfbdfd917844"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",
 ]
 
 [[package]]
@@ -5152,7 +5152,7 @@ version = "0.6.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "01198a2debb237c62b6826ec7081082d951f46dbb64b0e8c7649a452230d1dfc"
 dependencies = [
- "bitflags 2.13.1",
+ "bitflags 2.13.2",

```

---

### Incident Patch 2: `0759a1b6` (2026-09-30)
**Commit Message**: fix(harper-core): keep possessive its unflagged after prepositions (#4437)

* fix(harper-core): keep possessive "its" unflagged after prepositions

`ItsContraction` flagged phrases like "in its reading" when the gerund was
tagged as a verb and the following word was neither a noun nor an auxiliary.
A possessive `its` introduced by a preposition is part of a noun phrase, so
skip the lint in that context while keeping strong predicative verbs such as
"its been" and "its got" flagged.

Fixes #4435

* fix(core): use token metadata for its preposition check

---------

Co-authored-by: Elijah Potter <[REDACTED_EMAIL]>

**File**: `harper-core/src/linting/its_contraction/general.rs` (modified, +20/-2)
```diff
@@ -54,7 +54,11 @@ impl Linter for General {
                 self.expr
                     .iter_matches(chunk, source)
                     .filter_map(|match_span| {
-                        self.match_to_lint(&chunk[match_span.start..], source)
+                        let preceding_token = chunk[..match_span.start]
+                            .iter()
+                            .rev()
+                            .find(|tok| !tok.kind.is_whitespace());
+                        self.match_to_lint(&chunk[match_span.start..], preceding_token, source)
                     }),
             );
         }
@@ -68,7 +72,12 @@ impl Linter for General {
 }
 
 impl General {
-    fn match_to_lint(&self, toks: &[Token], source: &[char]) -> Option<Lint> {
+    fn match_to_lint(
+        &self,
+        toks: &[Token],
+        preceding_token: Option<&Token>,
+        source: &[char],
+    ) -> Option<Lint> {
         let offender = toks.first()?;
         let offender_chars = offender.get_ch(source);
 
@@ -115,6 +124,15 @@ impl General {
             "had", "been", "got", "called", "named", "known", "termed", "titled",
         ];
 
+        // A possessive `its` introduced by a preposition is part of a noun phrase, even
+        // when the next word is tagged as a verb: "in its reading", "of its making".
+        if modifier.kind.is_upos(UPOS::VERB)
+            && !strong_predicative_verbs.contains(&modifier_lower.as_str())
+            && preceding_token.is_some_and(|tok| tok.kind.is_preposition())
+        {
+            return None;
+        }
+
         let should_consider = if exact_contraction_words.contains(&modifier_lower.as_str())
             || determiner_like_words.contains(&modifier_lower.as_str())
         {
```

**File**: `harper-core/src/linting/its_contraction/mod.rs` (modified, +24/-0)
```diff
@@ -462,4 +462,28 @@ mod tests {
     fn allows_its_starting_level() {
         assert_no_lints("Reduce the tracker to its starting level.", test_linter());
     }
+
+    #[test]
+    fn issue_4435() {
+        assert_no_lints(
+            "I spent more effort in its reading than he did in its creation.",
+            test_linter(),
+        );
+    }
+
+    #[test]
+    fn allows_its_gerund_after_preposition() {
+        assert_no_lints(
+            "The value comes from its measuring of the output.",
+            test_linter(),
+        );
+    }
+
+    #[test]
+    fn allows_its_gerund_after_unlisted_preposition() {
+        assert_no_lints(
+            "I spent more effort during its reading than he did during its creation.",
+            test_linter(),
+        );
+    }
 }
```

---

### Incident Patch 3: `342383dc` (2026-09-30)
**Commit Message**: fix(dict): remove noun flag from e.g. to prevent OxfordComma false positives (#4479) (#4480)

* fix(dict): remove noun flag from e.g. to prevent OxfordComma false positives (#4479)

* chore(tests): refresh POS-tag snapshot after e.g. dictionary change

Dropping the noun flag from `e.g.` re-tags it from NSg to the
abbreviation tag W?, which is the expected consequence of the
dictionary fix in this branch. Only the two `e.g.` occurrences in
tests/text/tagged/Computer science.md change.

Regenerated with `cd harper-core && cargo test -- test_pos_tagger
test_most_lints`, run twice as the snapshot test rewrites on mismatch
before asserting. Full harper-core suite passes: 6594 unit + 34 + 6
integration tests, 0 failures.

---------

Co-authored-by: Yi-111-a <41898262+github-actions[bot]@users.noreply.github.com>
Co-authored-by: Andrew Dunbar <[REDACTED_EMAIL]>

**File**: `harper-core/dictionary.dict` (modified, +1/-1)
```diff
@@ -22742,7 +22742,7 @@ e-book/NgS
 e-commerce/Nmg
 e'en/
 e'er/
-e.g./~4N
+e.g./4~
 eBay/OgV
 eMusic/g
 eSIM/NgS
```

**File**: `harper-core/src/linting/oxford_commas/no_oxford_comma.rs` (modified, +9/-0)
```diff
@@ -163,4 +163,13 @@ mod tests {
             "One, two and three. But four, five and six.",
         );
     }
+
+    #[test]
+    fn allow_eg_conjunction() {
+        assert_lint_count(
+            "Memory is used for different tasks in embedded systems, e.g., storage or communication with sensors and actuators.",
+            NoOxfordComma::default(),
+            0,
+        );
+    }
 }
```

**File**: `harper-core/src/linting/oxford_commas/oxford_comma.rs` (modified, +18/-0)
```diff
@@ -220,4 +220,22 @@ mod tests {
             "One, two, and three. But four, five, and six.",
         );
     }
+
+    #[test]
+    fn allow_eg_conjunction() {
+        assert_lint_count(
+            "Memory is used for different tasks in embedded systems, e.g., storage or communication with sensors and actuators.",
+            OxfordComma::default(),
+            0,
+        );
+    }
+
+    #[test]
+    fn eg_with_three_items_requires_oxford_comma() {
+        assert_suggestion_result(
+            "Tasks in embedded systems, e.g., storage, sensing or communication.",
+            OxfordComma::default(),
+            "Tasks in embedded systems, e.g., storage, sensing, or communication.",
+        );
+    }
 }
```

**File**: `harper-core/tests/text/tagged/Computer science.md` (modified, +2/-2)
```diff
@@ -257,9 +257,9 @@
 > been   suggested . In        Europe , terms   derived from contracted translations of the
 # VLPp/B VP/J      . NPr/J/R/P NPr+   . NPl/V3+ VP/J    P    VP/J       NPl          P  D+
 > expression " automatic information " ( e.g. " informazione automatica " in        Italian )
-# N🅪Sg+      . NSg/J+    Nᴹ+         . . NSg  . ?            ?          . NPr/J/R/P N🅪Sg/J  .
+# N🅪Sg+      . NSg/J+    Nᴹ+         . . W?   . ?            ?          . NPr/J/R/P N🅪Sg/J  .
 > or    " information and  mathematics " are often used , e.g. informatique ( French      ) ,
-# NPr/C . Nᴹ          VB/C Nᴹ+         . VLB R     VP/J . NSg  ?            . NPr🅪Sg/VB/J . .
+# NPr/C . Nᴹ          VB/C Nᴹ+         . VLB R     VP/J . W?   ?            . NPr🅪Sg/VB/J . .
 > Informatik ( German   ) , informatica ( Italian , Dutch     ) , informática ( Spanish ,
 # ?          . NPr🅪Sg/J . . ?           . N🅪Sg/J  . NPrᴹ/VB/J . . ?           . NPrᴹ/J  .
 > Portuguese ) , informatika ( Slavic languages and  Hungarian ) or    pliroforiki
```

---

### Incident Patch 4: `92aac9cd` (2026-09-30)
**Commit Message**: build(deps): bump clap from 4.6.6 to 4.6.7 (#4497)

Bumps [clap](https://github.com/clap-rs/clap) from 4.6.6 to 4.6.7.
- [Release notes](https://github.com/clap-rs/clap/releases)
- [Changelog](https://github.com/clap-rs/clap/blob/main/CHANGELOG.md)
- [Commits](https://github.com/clap-rs/clap/compare/clap_complete-v4.6.6...clap_complete-v4.6.7)

---
updated-dependencies:
- dependency-name: clap
  dependency-version: 4.6.7
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +6/-6)
```diff
@@ -858,19 +858,19 @@ dependencies = [
 
 [[package]]
 name = "clap"
-version = "4.6.6"
+version = "4.6.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "473c7e07f409a8d772161724aa8db6a765a2532a70f9667eeb7b49d3d02fbdca"
+checksum = "aa8876b300ab35ba921adea3dfd70157a46249b33f95c9084ae5709785478946"
 dependencies = [
  "clap_builder",
  "clap_derive",
 ]
 
 [[package]]
 name = "clap_builder"
-version = "4.6.6"
+version = "4.6.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7b48fea5a88e9ae728a2dcbedbfc0e730f7d60da42e1cb049a83c9fb8b789889"
+checksum = "ec0797fb7aeb1406c84efac526901f7ec3ead2124f946b494e72879d4b54704d"
 dependencies = [
  "anstream",
  "anstyle",
@@ -889,9 +889,9 @@ dependencies = [
 
 [[package]]
 name = "clap_derive"
-version = "4.6.4"
+version = "4.6.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "d012d2b9d65aca7f18f4d9878a045bc17899bba951561ba5ec3c2ba1eed9a061"
+checksum = "f9c751b79415d4e559e3d1fcf128e09e720eb673a06d26cf6f392d37d75b66e0"
 dependencies = [
  "heck",
  "proc-macro2",
```

---

### Incident Patch 5: `be2e4939` (2026-09-29)
**Commit Message**: feat: add a debug printf to the linter asserts using `cfg!(debug_assertions)` (#4354)

* feat: add a debug printf to the linter asserts using `cfg!(debug_assertions)`

* Merge branch 'worse-comes-to-worse' of https://github.com/hippietrail/harper into worse-comes-to-worse

**File**: `harper-core/src/linting/mod.rs` (modified, +2/-0)
```diff
@@ -765,6 +765,8 @@ pub mod tests {
                 eprintln!("⚠️  Input and expected are both '{needle}' - is the test correct?");
             }
             return true;
+        } else if cfg!(debug_assertions) {
+            eprintln!(" 🔎 Checking... \"{text}\"");
         }
 
         // Lint current text and try each suggestion branch
```

---

### Incident Patch 6: `0f09eada` (2026-09-28)
**Commit Message**: fix: rename `is_verb_regular_past_form()` to `is_verb_preterite_and_participle_form()` (#4461)

Whether a verb is regular and whether the preterite and past participle are identical in form are orthogonal: "buy", "bought", "have bought", "buys", "buying" for instance is irregular but "bought" still is used for both the preterite and past participle forms.

Add a bunch of doc comments, which should bring up useful tips in editors for programmings cycling through function name completions, to help them avoid choosing the wrong one.

**File**: `harper-core/src/dict_word_metadata.rs` (modified, +61/-10)
```diff
@@ -380,6 +380,9 @@ impl DictWordMetadata {
         }
     }
 
+    // Generates boolean query methods for word metadata fields.
+    //
+    // Note: `singular` and `countable` default to true and are skipped here.
     generate_metadata_queries!(
         // Singular and countable default to true, so their metadata queries are not generated.
         noun has proper, plural, mass, possessive.
@@ -395,10 +398,12 @@ impl DictWordMetadata {
 
     // Pronoun metadata queries
 
+    /// Returns the grammatical person for personal pronouns.
     pub fn get_person(&self) -> Option<Person> {
         self.pronoun.as_ref().and_then(|p| p.person)
     }
 
+    /// Checks if the pronoun is both first-person and plural (we/us).
     pub fn is_first_person_plural_pronoun(&self) -> bool {
         matches!(
             self.pronoun,
@@ -410,6 +415,7 @@ impl DictWordMetadata {
         )
     }
 
+    /// Checks if the pronoun is both first-person and singular (I/me).
     pub fn is_first_person_singular_pronoun(&self) -> bool {
         matches!(
             self.pronoun,
@@ -421,6 +427,7 @@ impl DictWordMetadata {
         )
     }
 
+    /// Checks if the pronoun is both third-person and plural (they/them).
     pub fn is_third_person_plural_pronoun(&self) -> bool {
         matches!(
             self.pronoun,
@@ -432,6 +439,7 @@ impl DictWordMetadata {
         )
     }
 
+    /// Checks if the pronoun is both third-person and singular (he/him/she/her/it).
     pub fn is_third_person_singular_pronoun(&self) -> bool {
         matches!(
             self.pronoun,
@@ -443,6 +451,7 @@ impl DictWordMetadata {
         )
     }
 
+    /// Checks if the pronoun is third-person (he/him/she/her/it/they/them).
     pub fn is_third_person_pronoun(&self) -> bool {
         matches!(
             self.pronoun,
@@ -453,6 +462,7 @@ impl DictWordMetadata {
         )
     }
 
+    /// Checks if the pronoun is second-person (you).
     pub fn is_second_person_pronoun(&self) -> bool {
         matches!(
             self.pronoun,
@@ -463,7 +473,7 @@ impl DictWordMetadata {
         )
     }
 
-    // Lemma is default if no verb form is specified in the dictionary
+    /// Lemma is default if no verb form is specified in the dictionary
     pub fn is_verb_lemma(&self) -> bool {
         if let Some(verb) = self.verb {
             if let Some(forms) = verb.verb_forms {
@@ -475,35 +485,51 @@ impl DictWordMetadata {
         false
     }
 
+    /// WARNING! This is intended for regular verb past form used for both preterite and past participle.
+    /// WARNING! But for now it's a bit fuzzy and may be missing from some regular verbs and may be
+    /// WARNING! misapplied to some irregular verbs that happen to have the same form for preterite and
+    /// WARNING! past participle such as "bought", "caught",
     pub fn is_verb_past_form(&self) -> bool {
         self.verb.is_some_and(|v| {
             v.verb_forms
                 .is_some_and(|vf| vf.contains(VerbFormFlags::PAST))
         })
     }
 
-    pub fn is_verb_regular_past_form(&self) -> bool {
+    /// WARNING! This method was formerly named `is_verb_regular_past_form` and seems to have been an
+    /// WARNING! attempt to make a new method that achieved what `is_verb_past_form` above was intended
+    /// WARNING! to to achieve. But it fell into the trap mentioned above of assuming that only regular
+    /// WARNING! verbs had the same form for preterite and past participle, overlooking "bought", "caught", etc.
+    pub fn is_verb_preterite_and_participle_form(&self) -> bool {
         self.verb.is_some_and(|v| {
             v.verb_forms.is_some_and(|vf| {
                 vf.contains(VerbFormFlags::PRETERITE) && vf.contains(VerbFormFlags::PAST_PARTICIPLE)
             })
         })
     }
 
+    /// Checks if the verb is a simple past form, technically known as the "preterite" form.
+    /// WARNING! This should be working for irregular verbs but may not be working for regular verbs.
+    /// WARNING! e.g., it is more likely to match `ate` than `walked` for now.
     pub fn is_verb_simple_past_form(&self) -> bool {
         self.verb.is_some_and(|v| {
             v.verb_forms
                 .is_some_and(|vf| vf.contains(VerbFormFlags::PRETERITE))
         })
     }
 
+    /// Checks if the verb is a past participle form.
+    /// WARNING! This should be working for irregular verbs but may not be working for regular verbs.
+    /// WARNING! e.g., it is more likely to match `eaten` than `walked` for now.
     pub fn is_verb_past_participle_form(&self) -> bool {
         self.verb.is_some_and(|v| {
             v.verb_forms
                 .is_some_and(|vf| vf.contains(VerbFormFlags::PAST_PARTICIPLE))
         })
     }
 
+    /// Checks if the verb is only the simple past aka preterite form and not also marked as
+    /// `past` or `past participle`.
     pub fn is_verb_simple_past_only(&self) -> bool {
         self.verb.is_some_and(|v| {
             v.verb_f
```

**File**: `harper-core/src/token_kind.rs` (modified, +2/-2)
```diff
@@ -101,7 +101,7 @@ impl TokenKind {
         is_linking_verb,
         is_verb_lemma,
         is_verb_past_form,
-        is_verb_regular_past_form,
+        is_verb_preterite_and_participle_form,
         is_verb_simple_past_form,
         is_verb_past_participle_form,
         is_verb_simple_past_only,
@@ -480,7 +480,7 @@ mod tests {
     fn thought_is_regular_past_form() {
         let doc = Document::new_plain_english_curated("thought");
         let tk = &doc.tokens().next().unwrap().kind;
-        assert!(tk.is_verb_regular_past_form());
+        assert!(tk.is_verb_preterite_and_participle_form());
     }
 
     #[test]
```

---

### Incident Patch 7: `7b64cdff` (2026-09-28)
**Commit Message**: fix(chrome-ext): fix several Google Docs problems (#4484)

* fix(chrome-ext): brute-force docs

* fix(chrome-ext): zooming behavior in Docs

* chore(chrome-ext): disable Google Docs tests

Since they cannot work in CI

**File**: `packages/chrome-plugin/public/google-docs-bridge.js` (modified, +3/-14)
```diff
@@ -145,7 +145,7 @@ import { GoogleDocsBridgeRequestHandler } from './google-docs-bridge-request-han
 
 	function getAnnotatedTextApi() {
 		return typeof window._docs_annotate_getAnnotatedText === 'function'
-			? window._docs_annotate_getAnnotatedText
+			? () => window._docs_annotate_getAnnotatedText(window._docs_annotate_canvas_by_ext)
 			: null;
 	}
 
@@ -672,16 +672,15 @@ import { GoogleDocsBridgeRequestHandler } from './google-docs-bridge-request-han
 		const rawStart = normalizedToRawOffset(rawText, resolvedRange.start);
 		const rawEnd = normalizedToRawOffset(rawText, resolvedRange.end);
 
-		annotated.setSelection(rawStart, rawEnd);
-
 		const iframe = document.querySelector(TEXT_EVENT_IFRAME_SELECTOR);
 		const targetDocument = iframe?.contentDocument;
-		const target = targetDocument?.activeElement;
+		const target = targetDocument?.querySelector('[contenteditable="true"]');
 		if (!target) {
 			return { kind: 'replaceText', applied: false };
 		}
 
 		target.focus?.();
+		annotated.setSelection(rawStart, rawEnd);
 
 		const expectedNextText =
 			currentText.slice(0, resolvedRange.start) +
@@ -693,16 +692,6 @@ import { GoogleDocsBridgeRequestHandler } from './google-docs-bridge-request-han
 			return normalizeGoogleDocsText(nextAnnotated?.getText?.()) === expectedNextText;
 		};
 
-		if (targetDocument?.execCommand?.('insertText', false, replacementText)) {
-			await new Promise((resolve) => setTimeout(resolve, 0));
-			if (await didApplyReplacement()) {
-				queueMicrotask(() => {
-					void syncText();
-				});
-				return { kind: 'replaceText', applied: true };
-			}
-		}
-
 		const dataTransfer = new DataTransfer();
 		dataTransfer.setData('text/plain', replacementText);
 		target.dispatchEvent(
```

**File**: `packages/chrome-plugin/src/contentScript/googleDocs.ts` (modified, +10/-9)
```diff
@@ -55,7 +55,6 @@ export function createGoogleDocsBridgeSync(fw: LintFramework): () => Promise<voi
 	let bridgeAttached = false;
 	let syncInFlight = false;
 	let syncPending = false;
-	let syncingClearTimer: number | null = null;
 	let lastCloneSignature = '';
 	let injectedMainWorldBridge = false;
 
@@ -193,6 +192,13 @@ export function createGoogleDocsBridgeSync(fw: LintFramework): () => Promise<voi
 		const fontCss = segment.rectNode.getAttribute('data-font-css');
 		if (fontCss) {
 			span.style.font = fontCss;
+			// Docs zooms the SVG, but data-font-css remains in unscaled SVG units.
+			// The mirror uses screen-space geometry, so its font must use the same scale.
+			const svgWidth = segment.rectNode.width.baseVal.value;
+			const fontSize = Number.parseFloat(span.style.fontSize);
+			if (svgWidth > 0 && Number.isFinite(fontSize)) {
+				span.style.fontSize = `${fontSize * (segment.rect.width / svgWidth)}px`;
+			}
 		}
 
 		return span;
@@ -535,10 +541,6 @@ export function createGoogleDocsBridgeSync(fw: LintFramework): () => Promise<voi
 			}
 
 			const target = ensureTarget(editor);
-			if (syncingClearTimer != null) {
-				window.clearTimeout(syncingClearTimer);
-				syncingClearTimer = null;
-			}
 			editor.setAttribute(GOOGLE_DOCS_SYNCING_ATTR, 'true');
 
 			const changed = applySnapshot(target, buildSnapshot(editor));
@@ -555,10 +557,9 @@ export function createGoogleDocsBridgeSync(fw: LintFramework): () => Promise<voi
 		} finally {
 			const editor = document.querySelector(GOOGLE_DOCS_EDITOR_SELECTOR);
 			if (editor instanceof HTMLElement) {
-				syncingClearTimer = window.setTimeout(() => {
-					editor.removeAttribute(GOOGLE_DOCS_SYNCING_ATTR);
-					syncingClearTimer = null;
-				}, 150);
+				// Snapshot replacement is complete before the queued animation-frame render.
+				// Keeping this flag set delays that render until an unrelated later update.
+				editor.removeAttribute(GOOGLE_DOCS_SYNCING_ATTR);
 			}
 
 			syncInFlight = false;
```

**File**: `packages/chrome-plugin/tests/google_docs.spec.ts` (modified, +81/-11)
```diff
@@ -1,5 +1,6 @@
 import type { Page } from '@playwright/test';
 import { expect, test } from './fixtures';
+import { getBackground } from './testUtils';
 
 type MockGoogleDocsRect = {
 	label: string;
@@ -369,7 +370,6 @@ function buildMockGoogleDocsHtml(rects: MockGoogleDocsRect[]): string {
 				height: 240px;
 				margin: 32px auto;
 				background: white;
-				border: 1px solid #d1d5db;
 			}
 
 			svg {
@@ -429,16 +429,21 @@ async function installMockGoogleDocsGeometry(
 						getSelection: () => Array<{ start: number; end: number }>;
 					}>;
 				}
-			)._docs_annotate_getAnnotatedText = async () => ({
-				getText: () =>
-					(
-						window as Window & {
-							__harperMockGoogleDocsText?: string;
-						}
-					).__harperMockGoogleDocsText ?? '',
-				setSelection: () => {},
-				getSelection: () => [{ start: 0, end: 0 }],
-			});
+			)._docs_annotate_getAnnotatedText = async (extensionId?: string) => {
+				if (!extensionId) {
+					throw new Error('Google Docs requires an extension identifier');
+				}
+				return {
+					getText: () =>
+						(
+							window as Window & {
+								__harperMockGoogleDocsText?: string;
+							}
+						).__harperMockGoogleDocsText ?? '',
+					setSelection: () => {},
+					getSelection: () => [{ start: 0, end: 0 }],
+				};
+			};
 		},
 		{ pageText: annotatedText },
 	);
@@ -477,6 +482,71 @@ async function getBridgeSource(page: Page) {
 }
 
 test.describe('Google Docs support', () => {
+	test('scales highlight offsets and widths with Google Docs zoom', async ({ page }) => {
+		await openMockGoogleDocsPage(page, [
+			{
+				label: 'This is an test.',
+				left: 48,
+				top: 48,
+				width: 144,
+				height: 18,
+				fontCss: '16px Arial',
+			},
+		]);
+		const highlight = page.locator('#harper-highlight').first();
+		await highlight.waitFor({ state: 'visible' });
+		const baseline = (await highlight.boundingBox())!;
+		const rect = page.locator('rect[aria-label]').first();
+		const baselineRect = (await rect.boundingBox())!;
+
+		for (const scale of [1.5, 0.75, 2, 1]) {
+			await page.locator('svg').evaluate((svg, scale) => {
+				svg.style.transformOrigin = '0 0';
+				svg.style.transform = `scale(${scale})`;
+			}, scale);
+			await expect
+				.poll(async () => {
+					const box = await highlight.boundingBox();
+					const source = await rect.boundingBox();
+					if (!box || !source) return Number.POSITIVE_INFINITY;
+					return Math.max(
+						Math.abs(box.width - baseline.width * scale),
+						Math.abs(box.x - source.x - (baseline.x - baselineRect.x) * scale),
+					);
+				})
+				.toBeLessThan(1);
+		}
+	});
+
+	test('lints the logical text across positioned formatting spans', async ({ page, context }) => {
+		const background = await getBackground(context);
+		await background.evaluate(() => {
+			const state = globalThis as typeof globalThis & { googleDocsLintTexts: string[] };
+			state.googleDocsLintTexts = [];
+			chrome.runtime.onMessage.addListener((request) => {
+				if (request.kind === 'lint' && request.domain === 'docs.google.com') {
+					state.googleDocsLintTexts.push(request.text);
+				}
+			});
+		});
+
+		await openMockGoogleDocsPage(
+			page,
+			ITALIC_SHIFTED_RECTS.map((rect) => ({ ...rect, label: rect.label.trimEnd() })),
+			'This is an test.',
+		);
+		await expect.poll(() => getBridgeSource(page)).toBe('logical');
+		await expect
+			.poll(() =>
+				background.evaluate(
+					() =>
+						(globalThis as typeof globalThis & { googleDocsLintTexts: string[] })
+							.googleDocsLintTexts,
+				),
+			)
+			.toContain('This is an test.');
+	});
+
 	test('Google Docs restores spaces around formatted inline words', async ({ page }) => {
 		await openMockGoogleDocsPage(page, FORMATTED_WORD_GAP_RECTS, 'not smart enough.');
 
```

**File**: `packages/lint-framework/src/lint/LintFramework.ts` (modified, +5/-0)
```diff
@@ -1,5 +1,6 @@
 import type { LintOptions } from 'harper.js';
 import { closestBox, type IgnorableLintBox } from './Box';
+import { isGoogleDocsTarget } from './computeLintBoxes/googleDocsUtilities';
 import computeLintBoxes from './computeLintBoxes/index';
 import { isHeading, isVisible } from './domUtils';
 import { getCaretPosition, getCMRoot } from './editorUtils';
@@ -335,6 +336,10 @@ export default class LintFramework {
 			const lineElements = (target as HTMLElement).querySelectorAll<HTMLElement>('.cm-line');
 			const lines = Array.from(lineElements).map((el) => el.textContent);
 			text = lines.reduce((acc: string, x: string | null) => `${acc}${x ?? ''}\n`, '');
+		} else if (target instanceof HTMLElement && isGoogleDocsTarget(target)) {
+			// The mirror already contains logical whitespace. innerText inserts line breaks
+			// between its positioned spans, splitting sentences at formatting boundaries.
+			text = target.textContent;
 		} else {
 			text =
 				target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement
```

---

### Incident Patch 8: `b8278ff3` (2026-09-28)
**Commit Message**: fix(chrome-ext): fix test setup to avoid race conditions (#4485)

**File**: `packages/chrome-plugin/tests/editor_content.spec.ts` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+import { expect, test } from '@playwright/test';
+import { replaceEditorContent } from './testUtils';
+
+for (const tag of ['input', 'textarea']) {
+	test(`Ensure \`replaceEditorContent\` fills \`${tag}\` without allowing intermediate text to be linted.`, async ({
+		page,
+	}) => {
+		await page.setContent(`<${tag}></${tag}><output></output>`);
+		await page.evaluate(() => {
+			const values: string[] = [];
+			document.addEventListener('input', (event) => {
+				values.push((event.target as HTMLInputElement).value);
+				document.querySelector('output')!.textContent = JSON.stringify(values);
+			});
+		});
+
+		const text = 'This is a mistaek.';
+		await replaceEditorContent(page.locator(tag), text);
+		await expect(page.locator(tag)).toHaveValue(text);
+		// The prefix "This is a m" has a different lint from the completed sentence.
+		await expect(page.locator('output')).toHaveText(JSON.stringify([text]));
+	});
+}
```

**File**: `packages/chrome-plugin/tests/review_banner.spec.ts` (modified, +13/-1)
```diff
@@ -23,13 +23,25 @@ test.describe('review banner', () => {
 		const extensionId = background.url().split('/')[2];
 
 		const popupUrl = `chrome-extension://${extensionId}/popup.html`;
-		await page.goto(popupUrl);
+
+		// Let startup finish writing the installation date before replacing it.
+		await expect
+			.poll(
+				() =>
+					background.evaluate(async () => {
+						const { installedOn } = await chrome.storage.local.get('installedOn');
+						return typeof installedOn === 'string';
+					}),
+				{ timeout: 30000 },
+			)
+			.toBe(true);
 
 		await background.evaluate(() =>
 			chrome.storage.local.set({
 				installedOn: new Date(Date.now() - 15 * 86400000).toISOString(),
 			}),
 		);
+		await page.goto(popupUrl);
 
 		await page.getByText("Let's start writing").click();
 
```

**File**: `packages/chrome-plugin/tests/testUtils.ts` (modified, +9/-2)
```diff
@@ -71,6 +71,13 @@ export function getDraftEditor(page: Page): Locator {
 
 /** Replace the content of a text editor. */
 export async function replaceEditorContent(editorEl: Locator, text: string, softBreaks = false) {
+	// Seed form controls in one update so popup tests cannot click lints for partial words.
+	// Rich editors still need their keyboard-driven editing behavior.
+	if (await isFormElement(editorEl)) {
+		await editorEl.fill(text);
+		return;
+	}
+
 	await editorEl.selectText();
 	await editorEl.press('Backspace');
 
@@ -292,8 +299,8 @@ export async function testCanIgnoreSuggestion(
 		const testText = 'This is a mistaek.';
 		await replaceEditorContent(editor, testText);
 
-		// Ensure the test text produces only the spelling lint we intend to ignore.
-		await expect(getHarperHighlights(page)).toHaveCount(1);
+		// test.slow() does not extend assertion timeouts during linter startup.
+		await expect(getHarperHighlights(page)).toHaveCount(1, { timeout: 30000 });
 
 		// Open the popup for the highlight and click Ignore.
 		const opened = await clickHarperHighlight(page);
```

---

### Incident Patch 9: `f41bec48` (2026-09-26)
**Commit Message**: fix(core): stop SplitWords treating short non-anchor words as split anchors (#4212)

* fix(core): stop SplitWords treating short non-anchor words as split anchors

SplitWords' should_defer_to_spellcheck() is meant to prefer a strong
single-word spelling correction over a compound-word split, except when
the split includes a genuine function-word "anchor" (preposition,
determiner, conjunction, pronoun, or adverb) such as "at" in "atall".

is_anchor_split() fell back to treating *any* word of length <= 2 as
an anchor, regardless of its part of speech. That's too broad: it also
matches short interjections/fragments that happen to be in the
dictionary, like "ha" and "um". As a result, "havent" (missing
apostrophe) was split into "ha" + "vent" ("ha vent") instead of
deferring to SpellCheck's correct "haven't" suggestion, even in a
nounish context like "they havent reviewed it yet." (#4130).

Fix: is_anchor_split() now only checks tagged part-of-speech metadata
(preposition/determiner/conjunction/pronoun/adverb) and drops the
length-based fallback. Real short anchors like "at"/"of" are still
covered because they're already tagged as prepositions in the curated
dictionary, so `atall` -> `

**File**: `harper-comments/tests/language_support.rs` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ create_test!(ignore_comments.ps1, 1);
 
 // Zig tests - covering //, ///, and //! comments
 create_test!(clean.zig, 0);
-create_test!(dirty.zig, 5);
+create_test!(dirty.zig, 4);
 
 // These are to make sure nothing crashes.
 create_test!(empty.js, 0);
```

**File**: `harper-core/src/linting/split_words.rs` (modified, +21/-3)
```diff
@@ -117,7 +117,7 @@ impl ExprLinter for SplitWords {
                 continue;
             }
 
-            if is_anchor_split(&cand_meta, candidate) || is_anchor_split(&rem_meta, remainder) {
+            if is_anchor_split(&cand_meta) || is_anchor_split(&rem_meta) {
                 has_anchor_split = true;
             }
 
@@ -169,13 +169,14 @@ impl ExprLinter for SplitWords {
     }
 }
 
-fn is_anchor_split(meta: &crate::DictWordMetadata, word: &[char]) -> bool {
+/// Only tagged function words anchor splits; short non-function words like
+/// "ha" must not block spelling corrections such as `havent` → `haven't`.
+fn is_anchor_split(meta: &crate::DictWordMetadata) -> bool {
     meta.preposition
         || meta.is_determiner()
         || meta.is_conjunction()
         || meta.is_pronoun()
         || meta.is_adverb()
-        || word.len() <= 2
 }
 
 fn should_defer_to_spellcheck(
@@ -292,6 +293,23 @@ mod tests {
         assert_no_lints("I love this extention!", SplitWords::default());
     }
 
+    /// Regression: `havent` should defer to SpellCheck's `haven't` suggestion,
+    /// not split into `ha vent` (issue #4130).
+    #[test]
+    fn issue_4130_defers_havent_to_spellcheck() {
+        assert_no_lints("They havent reviewed it yet.", SplitWords::default());
+    }
+
+    /// Genuine short anchors like `at` should still produce splits.
+    #[test]
+    fn issue_4130_does_not_regress_real_short_anchors() {
+        assert_suggestion_result(
+            "don't seem to support symbolic links atall.",
+            SplitWords::default(),
+            "don't seem to support symbolic links at all.",
+        );
+    }
+
     #[test]
     fn corrects_doesthe() {
         assert_suggestion_result("doesthe", SplitWords::default(), "does the");
```

**File**: `harper-core/tests/text/linters/Alice's Adventures in Wonderland.snap.yml` (modified, +0/-19)
```diff
@@ -1070,15 +1070,6 @@ Suggest:
 
 
 
-Lint:    Typo (31 priority)
-Message: |
-     668 | “Sure, it’s an arm, yer honour!” (He pronounced it “arrum.”)
-         |                                                     ^~~~~ `arrum` should probably be written as `arr um`.
-Suggest:
-  - Replace with: “arr um”
-
-
-
 Lint:    Regionalism (127 priority)
 Message: |
      681 | thought Alice. “I wonder what they’ll do next! As for pulling me out of the
@@ -3212,16 +3203,6 @@ Suggest:
 
 
 
-Lint:    Typo (31 priority)
-Message: |
-    2490 | > beautiful Soup? Beau—ootiful Soo—oop! Beau—ootiful Soo—oop! Soo—oop of the
-    2491 | > e—e—evening, Beautiful, beauti—FUL SOUP!”
-         |                           ^~~~~~ `beauti` should probably be written as `beau ti`.
-Suggest:
-  - Replace with: “beau ti”
-
-
-
 Lint:    Spelling (63 priority)
 Message: |
     2490 | > beautiful Soup? Beau—ootiful Soo—oop! Beau—ootiful Soo—oop! Soo—oop of the
```

**File**: `harper-core/tests/text/linters/The Great Gatsby.snap.yml` (modified, +0/-20)
```diff
@@ -3475,16 +3475,6 @@ Suggest:
 
 
 
-Lint:    Typo (31 priority)
-Message: |
-    2319 | That was nineteen-seventeen. By the next year I had a few beaux myself, and I
-         |                                                           ^~~~~ `beaux` should probably be written as `be aux`.
-    2320 | began to play in tournaments, so I didn’t see Daisy very often. She went with a
-Suggest:
-  - Replace with: “be aux”
-
-
-
 Lint:    Spelling (63 priority)
 Message: |
     2329 | By the next autumn she was gay again, gay as ever. She had a début after the
@@ -3784,16 +3774,6 @@ Suggest:
 
 
 
-Lint:    Typo (31 priority)
-Message: |
-    2607 | Clay’s “Economics,” starting at the Finnish tread that shook the kitchen floor,
-    2608 | and peering toward the bleared windows from time to time as if a series of
-         |                        ^~~~~~~ `bleared` should probably be written as `bl eared`.
-Suggest:
-  - Replace with: “bl eared”
-
-
-
 Lint:    Style (31 priority)
 Message: |
     2629 | The exhilarating ripple of her voice was a wild tonic in the rain. I had to
```

---

### Incident Patch 10: `b3f6bd06` (2026-09-26)
**Commit Message**: fix(desktop): the weird macOS icon problem (#4457)

Co-authored-by: Elijah Potter <[REDACTED_EMAIL]>
Co-authored-by: Andrew Dunbar <[REDACTED_EMAIL]>



---

### Incident Patch 11: `a043f30d` (2026-09-26)
**Commit Message**: fix: typo 'than' correct to 'that' (#4466)

Fixes #4464

**File**: `harper-core/src/linting/more_adjective.rs` (modified, +1/-1)
```diff
@@ -176,7 +176,7 @@ impl<D: Dictionary> ExprLinter for MoreAdjective<D> {
     }
 
     fn description(&self) -> &str {
-        "Looks for comparative adjective constructions with `more` than could use inflected forms."
+        "Looks for comparative adjective constructions with `more` that could use inflected forms."
     }
 }
 
```

---

### Incident Patch 12: `db1c30e6` (2026-09-26)
**Commit Message**: fix(linting): stop OneOfTheSingular flagging 'one of the latter/former' (#4463)

`latter` and `former` are substantivised adjectives, not singular nouns,
so `one of the latter` has nothing to pluralise. Harper read them as
singular nouns and suggested `lattests`/`formers`.

Both already sit in the same exception class as `few` and `first`, which
the linter excludes, so this extends that list rather than changing the
noun-phrase matching.

Closes #4412

Co-authored-by: Yi-111-a <[REDACTED_EMAIL]>

**File**: `harper-core/src/linting/one_of_the_singular.rs` (modified, +19/-1)
```diff
@@ -25,7 +25,9 @@ impl SeqExprExt for SequenceExpr {
                 && !t.kind.is_preposition() // "in" etc.
                 && !t.kind.is_pronoun() // "who" etc.
                 && !t.get_ch(s)
-                    .eq_any_ignore_ascii_case_str(&["ah", "few", "first", "said", "uh"])
+                    .eq_any_ignore_ascii_case_str(&[
+                        "ah", "few", "first", "former", "latter", "said", "uh",
+                    ])
         })
     }
 }
@@ -292,4 +294,20 @@ mod tests {
             OneOfTheSingular::new(FstDictionary::curated()),
         );
     }
+
+    #[test]
+    fn dont_flag_one_of_the_latter() {
+        assert_no_lints(
+            "He asked a few friends and others asked him to come give talks. One of the latter was Jeanne Russell, who lives with her husband, Ron.",
+            OneOfTheSingular::new(FstDictionary::curated()),
+        );
+    }
+
+    #[test]
+    fn dont_flag_one_of_the_former() {
+        assert_no_lints(
+            "One of the former has to stay behind to lock up, so let them go first.",
+            OneOfTheSingular::new(FstDictionary::curated()),
+        );
+    }
 }
```

---

### Incident Patch 13: `edd375f5` (2026-09-24)
**Commit Message**: fix(missing_to): avoid false positive on participial verbs in prepositional phrases (#4204)

* fix(missing_to): avoid false positive on participial verbs in prepositional phrases

* fix(missing_to): use is_verb_progressive_form on token kind instead of string suffix

* fix(missing_to): refine preposition scanning for coordinated noun phrases

---------

Co-authored-by: vjymisal0 <[REDACTED_EMAIL]>

**File**: `harper-core/src/linting/missing_to.rs` (modified, +153/-1)
```diff
@@ -225,6 +225,125 @@ impl MissingTo {
 
         false
     }
+
+    fn preposition_or_determiner_within_four(
+        context: Option<(&[Token], &[Token])>,
+        source: &[char],
+        controller_span_start: usize,
+    ) -> bool {
+        if let Some((before, _)) = context {
+            let mut words_checked = 0;
+            for tok in before.iter().rev() {
+                if tok.kind.is_space() || tok.kind.is_newline() {
+                    continue;
+                }
+                words_checked += 1;
+                if words_checked > 4 {
+                    break;
+                }
+
+                if tok.kind.is_punctuation() {
+                    break;
+                }
+
+                let word = tok.get_str(source).to_lowercase();
+                let word = word.as_str();
+
+                if tok.kind.is_upos(UPOS::ADP)
+                    || matches!(
+                        word,
+                        "of" | "for"
+                            | "in"
+                            | "with"
+                            | "without"
+                            | "during"
+                            | "after"
+                            | "before"
+                            | "by"
+                            | "about"
+                            | "against"
+                            | "from"
+                            | "on"
+                            | "at"
+                            | "into"
+                            | "through"
+                    )
+                {
+                    return true;
+                }
+
+                if words_checked == 1
+                    && (tok.kind.is_determiner()
+                        || matches!(
+                            word,
+                            "a" | "an" | "the" | "this" | "that" | "these" | "those"
+                        ))
+                {
+                    return true;
+                }
+
+                if tok.kind.is_conjunction()
+                    || matches!(word, "and" | "or" | "but" | "nor")
+                    || tok.kind.is_verb_progressive_form()
+                    || tok.kind.is_noun()
+                    || tok.kind.is_adjective()
+                {
+                    continue;
+                }
+
+                if tok.kind.is_verb() {
+                    break;
+                }
+            }
+            return false;
+        }
+
+        let mut scan_cursor = controller_span_start;
+
+        for _ in 0..4 {
+            let Some((word, start)) = Self::previous_word_with_span(source, scan_cursor) else {
+                break;
+            };
+            let word = word.as_str();
+
+            if matches!(word, "and" | "or" | "but" | "nor") {
+                scan_cursor = start;
+                continue;
+            }
+
+            if matches!(
+                word,
+                "a" | "an"
+                    | "the"
+                    | "this"
+                    | "that"
+                    | "these"
+                    | "those"
+                    | "of"
+                    | "for"
+                    | "in"
+                    | "with"
+                    | "without"
+                    | "during"
+                    | "after"
+                    | "before"
+                    | "by"
+                    | "about"
+                    | "against"
+                    | "from"
+                    | "on"
+                    | "at"
+                    | "into"
+                    | "through"
+            ) {
+                return true;
+            }
+
+            scan_cursor = start;
+        }
+
+        false
+    }
 }
 
 impl Default for MissingTo {
@@ -299,7 +418,9 @@ impl ExprLinter for MissingTo {
         let controller_text_ends_with_d_or_en =
             controller_text.ends_with('d') || controller_text.ends_with("en");
 
-        if previous_word == Some("of") && controller_text_ends_with_d_or_en {
+        if controller_text_ends_with_d_or_en
+            && Self::preposition_or_determiner_within_four(context, source, span.start)
+        {
             return None;
         }
 
@@ -730,4 +851,35 @@ mod tests {
             test_linter(),
         );
     }
+
+    #[test]
+    fn no_lint_attempted_murder() {
+        assert_no_lints(
+            "You’re under arrest for racketeering and attempted murder of Alek Suvor.",
+            test_linter(),
+        );
+    }
+
+    #[test]
+    fn no_lint_attempted_robbery() {
+        assert_no_lints("He was convicted of attempted robbery.", test_linter());
+    }
+
+    #[test]
+    fn inserts_to_after_attempted() {
+        assert_suggestion_result(
+            "They attempted solve the problem without assistance.",
+            test_linter(),
+            "They attempted to solve the problem without assistance.",
+        );
+    }
+
+    #[test]
+    fn inserts_to_after_attempted_with_preceding_thing() {
+        assert_suggestion_result(
+    
```

---

### Incident Patch 14: `07ecdf58` (2026-09-24)
**Commit Message**: fix: missing static analysis from some projects (#4451)

* fix: missing use of static analysis

* fix: all type errors allowed by previous lack of static analysis

**File**: `justfile` (modified, +9/-1)
```diff
@@ -475,7 +475,15 @@ check-js: build-harperjs build-lint-framework build-components build-harper-edit
   pnpm install
   pnpm check
 
-  # Needed because Svelte has special linters
+  cd "{{justfile_directory()}}/packages/chrome-plugin"
+  pnpm check
+
+  cd "{{justfile_directory()}}/packages/components"
+  pnpm check
+
+  cd "{{justfile_directory()}}/packages/harper-editor"
+  pnpm check
+
   cd "{{justfile_directory()}}/packages/web"
   ENABLE_ADMIN_ROUTES=false pnpm check
 
```

**File**: `packages/chrome-plugin/package.json` (modified, +5/-0)
```diff
@@ -18,6 +18,10 @@
 	"scripts": {
 		"dev": "vite",
 		"build": "vite build -l warn",
+		"check": "pnpm check:typescript && pnpm check:config && pnpm check:svelte",
+		"check:typescript": "tsc --noEmit --project tsconfig.json",
+		"check:config": "tsc --noEmit --project tsconfig.node.json",
+		"check:svelte": "svelte-check --tsconfig ./tsconfig.json",
 		"preview": "vite preview",
 		"zip-for-chrome": "TARGET_BROWSER=chrome npm run build && node src/zip.js harper-chrome-plugin.zip",
 		"zip-for-firefox": "TARGET_BROWSER=firefox npm run build && node src/zip.js harper-firefox-plugin.zip",
@@ -39,6 +43,7 @@
 		"playwright-webextext": "^0.0.5",
 		"rollup-plugin-copy": "^3.5.0",
 		"svelte": "^5.0.0",
+		"svelte-check": "^4.3.3",
 		"svelte-preprocess": "^6.0.0",
 		"tailwindcss": "^4.1.4",
 		"tslib": "^2.6.2",
```

**File**: `packages/chrome-plugin/src/background/index.ts` (modified, +4/-2)
```diff
@@ -434,7 +434,7 @@ async function handleGetDefaultStatus(): Promise<GetDefaultStatusResponse> {
 }
 
 async function handleGetEnabledDomains(): Promise<GetEnabledDomainsResponse> {
-	const all = await chrome.storage.local.get(null as any);
+	const all = await chrome.storage.local.get(null);
 	const prefix = formatDomainKey(''); // yields 'domainStatus '
 	const domains = Object.entries(all)
 		.filter(([k, v]) => typeof v === 'boolean' && v === true && k.startsWith(prefix))
@@ -525,6 +525,8 @@ async function handleSetHotkey(req: SetHotkeyRequest): Promise<UnitResponse> {
 		key: req.hotkey.key,
 	};
 	await setHotkey(hotkey);
+
+	return createUnitResponse();
 }
 
 async function handleOpenReportError(
@@ -788,7 +790,7 @@ async function getStoredDomainStatus(domain: string): Promise<boolean | undefine
 }
 
 /** Check if Harper has been enabled for a given domain. */
-async function enabledForDomain(domain: string): Promise<boolean | null> {
+async function enabledForDomain(domain: string): Promise<boolean> {
 	const stored = await getStoredDomainStatus(domain);
 	if (stored !== undefined) {
 		return stored;
```

**File**: `packages/chrome-plugin/src/manifest.ts` (modified, +2/-1)
```diff
@@ -1,7 +1,6 @@
 import { defineManifest } from '@crxjs/vite-plugin';
 import packageData from '../package.json';
 
-//@ts-expect-error
 const isDev = process.env.NODE_ENV == 'development';
 
 /**
@@ -70,6 +69,8 @@ export default defineManifest({
 			matches: ['<all_urls>'],
 			all_frames: true,
 			match_about_blank: true,
+			// CRXJS's manifest types do not include this Chromium manifest option.
+			// @ts-expect-error Valid for Manifest V3 content scripts.
 			match_origin_as_fallback: true,
 			js: ['src/contentScript/index.ts'],
 			run_at: 'document_idle',
```

**File**: `packages/chrome-plugin/src/options/StructuredRuleSettings.svelte` (modified, +4/-4)
```diff
@@ -67,7 +67,7 @@ function configValueToString(value: boolean | undefined | null): string {
 	}
 }
 
-function configStringToValue(str: string): boolean | undefined | null {
+function configStringToValue(str: string): boolean | null {
 	switch (str) {
 		case 'enable':
 			return true;
@@ -327,7 +327,7 @@ $: {
 								size="md"
 								title={`Set all rules in the ${node.label} category to their default, on, or off state.`}
 								value={node.state === 'mixed' ? 'default' : node.state}
-								onchange={(event) => updateGroup(node.ruleNames, (event.target as HTMLSelectElement).value)}
+								onchange={(event: Event) => updateGroup(node.ruleNames, (event.target as HTMLSelectElement).value)}
 							>
 								<option value="default">{node.state === 'mixed' ? '⚙️ Default (mixed)' : '⚙️ Default'}</option>
 								<option value="enable">✅ On</option>
@@ -362,7 +362,7 @@ $: {
 						size="md"
 						title={node.title}
 						value={node.value}
-						onchange={(event) => {
+						onchange={(event: Event) => {
 							const nextConfig: LintConfig = { ...lintConfig };
 							nextConfig[node.name] = configStringToValue(
 								(event.target as HTMLSelectElement).value,
@@ -384,7 +384,7 @@ $: {
 					size="md"
 					title={node.title}
 					value={node.value}
-					onchange={(event) => updateOneOfMany(node.setting, (event.target as HTMLSelectElement).value)}
+					onchange={(event: Event) => updateOneOfMany(node.setting, (event.target as HTMLSelectElement).value)}
 				>
 					{#each node.options as option}
 						<option value={option.value}>{option.label}</option>
```

**File**: `packages/chrome-plugin/src/popup/Popup.svelte` (modified, +2/-2)
```diff
@@ -71,12 +71,12 @@ function openUpdateHelpPage() {
           popupState = main();
        }}><Fa icon={faArrowLeft}/></Button>
     {:else}
-      <div onclick={openUpdateHelpPage}>
+      <button type="button" class="cursor-pointer" onclick={openUpdateHelpPage}>
         {#if versionMismatch}
           <span class="ml-1" title={`Newer version available: ${latestVersion ?? ''}. Click to find out more.`}>⚠️</span>
         {/if}
         <span class="text-sm font-mono">{version}</span>
-      </div>
+      </button>
     {/if}
   </header>
 
```

**File**: `packages/chrome-plugin/src/theme.ts` (modified, +1/-5)
```diff
@@ -21,9 +21,5 @@ export function setupTheme() {
 		applyDarkTheme(event.matches);
 	};
 
-	if ('addEventListener' in mediaQuery) {
-		mediaQuery.addEventListener('change', listener);
-	} else {
-		mediaQuery.addListener(listener);
-	}
+	mediaQuery.addEventListener('change', listener);
 }
```

**File**: `packages/chrome-plugin/tsconfig.json` (modified, +2/-7)
```diff
@@ -11,16 +11,11 @@
 		"strict": true,
 		"forceConsistentCasingInFileNames": true,
 		"module": "ESNext",
-		"moduleResolution": "Node",
+		"moduleResolution": "bundler",
 		"resolveJsonModule": true,
 		"isolatedModules": true,
 		"noEmit": true,
 		"jsx": "react-jsx"
 	},
-	"include": ["src"],
-	"references": [
-		{
-			"path": "./tsconfig.node.json"
-		}
-	]
+	"include": ["src"]
 }
```

---

### Incident Patch 15: `2cb9598b` (2026-09-24)
**Commit Message**: feat: warn when a linter test has the same text for the error and the fix (#4433)

**File**: `harper-core/src/linting/mod.rs` (modified, +5/-0)
```diff
@@ -758,6 +758,11 @@ pub mod tests {
 
         // Check if we've reached the expected result
         if text == needle {
+            // When tests are made via cut & paste it's easy to miss editing some of the corrections
+            // and the test will silently pass
+            if depth == 0 {
+                eprintln!("⚠️  Input and expected are both '{needle}' - is the test correct?");
+            }
             return true;
         }
 
```

#### Recent Merged Pull Requests:
- **PR #4535** (2026-10-05): chore: dictionary curation (@hippietrail)
- **PR #4526** (2026-10-04): feat: life time, trade off→lifetime, tradeoff (@hippietrail)
- **PR #4524** (2026-10-03): chore: add strive/strove/striven to `irregular_verbs.json` (@hippietrail)
- **PR #4523** (2026-10-05): feat: detect mixing up `descend` and `descent` (@hippietrail)
- **PR #4519** (2026-10-01): feat: comfortable of→comfortable with (@hippietrail)
- **PR #4517** (2026-10-04): feat: add `no_parallel` switch to `harper-cli lint` (@hippietrail)
- **PR #4516** (2026-10-01): feat: hallucinization→hallucination (@hippietrail)
- **PR #4515** (2026-10-01): feat: seize control over→seize control of (@hippietrail)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
