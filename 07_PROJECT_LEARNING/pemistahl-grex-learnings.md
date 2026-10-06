# Forensic Learning Record (Deep Inspection): pemistahl/grex

> **Canonical Artifact**: `07_PROJECT_LEARNING/pemistahl-grex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pemistahl/grex](https://github.com/pemistahl/grex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:53:03.014Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pemistahl/grex`
- **Description**: A command-line tool and Rust library with Python bindings for generating regular expressions from user-provided test cases
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 8210 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benches/benchmark.rs`
```
/*
 * Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

use criterion::{criterion_group, criterion_main, Criterion};
use grex::RegExpBuilder;
use itertools::Itertools;
use std::fs::File;
use std::io::Read;

fn load_test_cases() -> Vec<String> {
    let mut f = File::open("./benches/testcases.txt").expect("Test cases could not be loaded");
    let mut s = String::new();
    f.read_to_string(&mut s).unwrap();
    s.split("\n")
        .map(|test_case| test_case.to_string())
        .collect_vec()
}

fn benchmark_grex_with_default_settings(c: &mut Criterion) {
    let test_cases = load_test_cases();
    c.bench_function("grex with default settings", |bencher| {
        bencher.iter(|| RegExpBuilder::from(&test_cases).build())
    });
}

fn benchmark_grex_with_conversion_of_repetitions(c: &mut Criterion) {
    let test_cases = load_test_cases();
    c.bench_function("grex with conversion of repetitions", |bencher| {
        bencher.iter(|| {
            RegExpBuilder::from(&test_cases)
                .with_conversion_of_repetitions()
                .build()
        })
    });
}

fn benchmark_grex_with_conversion_of_digits(c: &mut Criterion) {
    let test_cases = load_test_cases();
    c.bench_function("grex with conversion of digits", |bencher| {
        bencher.iter(|| {
            RegExpBuilder::from(&test_cases)
                .with_conversion_of_digits()
                .build()
        })
    });
}

fn benchmark_grex_with_conversion_of_non_digits(c: &mut Criterion) {
    let test_cases = load_test_cases();
    c.bench_function("grex with conversion of non-digits", |bencher| {
        bencher.iter(|| {
            RegExpBuilder::from(&test_cases)
                .with_conversion_of_non_digits()
                .build()
        })
    });
}

fn benchmark_grex_with_conversion_of_words(c: &mut Criterion) {
    let test_cases = load_test_cases();
    c.bench_function("grex with conversion of words", |bencher| {
        bencher.iter(|| {
            RegExpBuilder::from(&test_cases)
                .with_conversion_of_words()
                .build()
        })
    });
}

fn benchmark_grex_with_conversion_of_non_words(c: &mut Criterion) {
    let test_cases = load_test_cases();
    c.bench_function("grex with conversion of non-words", |bencher| {
        bencher.iter(|| {
            RegExpBuilder::from(&test_cases)
                .with_conversion_of_non_words()
                .build()
        })
    });
}

fn benchmark_grex_with_conversion_of_whitespace(c: &mut Criterion) {
    let test_cases = load_test_cases();
    c.bench_function("grex with conversion of whitespace", |bencher| {
        bencher.iter(|| {
            RegExpBuilder::from(&test_cases)
                .with_conversion_of_whitespace()
                .build()
        })
    });
}

fn benchmark_grex_with_conversion_of_non_whitespace(c: &mut Criterion) {
    let test_cases = load_test_cases();
    c.bench_function("grex with conversion of non-whitespace", |bencher| {
        bencher.iter(|| {
            RegExpBuilder::from(&test_cases)
                .with_conversion_of_non_whitespace()
                .build()
        })
    });
}

fn benchmark_grex_with_case_insensitive_matching(c: &mut Criterion) {
    let test_cases = load_test_cases();
    c.bench_function("grex with case-insensitive matching", |bencher| {
        bencher.iter(|| {
            RegExpBuilder::from(&test_cases)
                .with_case_insensitive_matching()
                .build()
        })
    });
}

fn benchmark_grex_with_verbose_mode(c: &mut Criterion) {
    let test_cases = load_test_cases();
    c.bench_function("grex with verbose mode", |bencher| {
        bencher.iter(|| RegExpBuilder::from(&test_cases).with_verbose_mode().build())
    });
}

criterion_group!(
    benches,
    benchmark_grex_with_default_settings,
    benchmark_grex_with_conversion_of_repetitions,
    benchmark_grex_with_conversion_of_digits,
    benchmark_grex_with_conversion_of_non_digits,
    benchmark_grex_with_conversion_of_words,
    benchmark_grex_with_conversion_of_non_words,
    benchmark_grex_with_conversion_of_whitespace,
    benchmark_grex_with_conversion_of_non_whitespace,
    benchmark_grex_with_case_insensitive_matching,
    benchmark_grex_with_verbose_mode
);

criterion_main!(benches);

```

### Core Architecture Module: `src/char_range.rs`
```
/*
 * Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/// A lightweight replacement for unic_char_range::CharRange
/// Represents a closed range of Unicode characters
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct CharRange {
    start: char,
    end: char,
}

impl CharRange {
    /// Creates a closed character range from start to end (inclusive)
    pub(crate) fn closed(start: char, end: char) -> Self {
        Self { start, end }
    }

    /// Checks if the given character is within this range
    pub(crate) fn contains(&self, c: char) -> bool {
        c >= self.start && c <= self.end
    }

    /// Returns an iterator over all valid Unicode scalar values
    /// This includes U+0000 to U+D7FF and U+E000 to U+10FFFF
    /// (excludes surrogate code points U+D800 to U+DFFF)
    pub(crate) fn all() -> CharRangeIter {
        CharRangeIter {
            current: '\0',
            done: false,
        }
    }
}

/// Iterator over all valid Unicode scalar values
pub(crate) struct CharRangeIter {
    current: char,
    done: bool,
}

impl Iterator for CharRangeIter {
    type Item = char;

    fn next(&mut self) -> Option<Self::Item> {
        if self.done {
            return None;
        }

        let result = self.current;

        // Get the next valid Unicode scalar value
        let mut next_code_point = self.current as u32 + 1;

        // Skip over surrogate code points (U+D800 to U+DFFF) and find next valid char
        loop {
            if next_code_point > 0x10FFFF {
                // We've reached the end of valid Unicode code points
                self.done = true;
                break;
            }

            match char::from_u32(next_code_point) {
                Some(next_char) => {
                    self.current = next_char;
                    break;
                }
                None => {
                    // Invalid code point (likely surrogate), skip to next
                    next_code_point += 1;
                }
            }
        }

        Some(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_char_range_contains() {
        let range = CharRange::closed('a', 'z');
        assert!(range.contains('a'));
        assert!(range.contains('m'));
        assert!(range.contains('z'));
        assert!(!range.contains('A'));
        assert!(!range.contains('0'));
    }

    #[test]
    fn test_char_range_all() {
        let all_chars: Vec<char> = CharRange::all().take(10).collect();
        assert_eq!(all_chars[0], '\0');
        assert_eq!(all_chars.len(), 10);
    }

    #[test]
    fn test_char_range_all_count() {
        // Valid Unicode scalar values: 0x110000 total code points - 0x800 surrogates = 0x10F800
        let count = CharRange::all().count();
        assert_eq!(count, 0x10F800);
    }
}

```

### Core Architecture Module: `src/cluster.rs`
```
/*
 * Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

use crate::char_range::CharRange;
use crate::config::RegExpConfig;
use crate::grapheme::Grapheme;
use crate::unicode_tables::{DECIMAL_NUMBER, WHITE_SPACE, WORD};
use itertools::Itertools;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::ops::Range;
use std::sync::LazyLock;
use unicode_general_category::GeneralCategory as GC;
use unicode_segmentation::UnicodeSegmentation;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct GraphemeCluster<'a> {
    graphemes: Vec<Grapheme>,
    config: &'a RegExpConfig,
}

impl<'a> GraphemeCluster<'a> {
    pub(crate) fn from(s: &str, config: &'a RegExpConfig) -> Self {
        Self {
            graphemes: UnicodeSegmentation::graphemes(s, true)
                .flat_map(|it| {
                    let contains_backslash = it.chars().count() == 2 && it.contains('\\');
                    let contains_combining_mark_or_unassigned_chars = it.chars().any(|c| {
                        let category = unicode_general_category::get_general_category(c);
                        matches!(
                            category,
                            // Mark categories
                            GC::NonspacingMark | GC::SpacingMark | GC::EnclosingMark |
                            // Other categories
                            GC::Control | GC::Format | GC::Surrogate | GC::PrivateUse | GC::Unassigned
                        )
                    });

                    if contains_backslash || contains_combining_mark_or_unassigned_chars {
                        it.chars()
                            .map(|c| {
                                Grapheme::from(
                                    &c.to_string(),
                                    config.is_capturing_group_enabled,
                                    config.is_output_colorized,
                                    config.is_verbose_mode_enabled,
                                )
                            })
                            .collect_vec()
                    } else {
                        vec![Grapheme::from(
                            it,
                            config.is_capturing_group_enabled,
                            config.is_output_colorized,
                            config.is_verbose_mode_enabled,
                        )]
                    }
                })
                .collect_vec(),
            config,
        }
    }

    pub(crate) fn from_graphemes(graphemes: Vec<Grapheme>, config: &'a RegExpConfig) -> Self {
        Self { graphemes, config }
    }

    pub(crate) fn new(grapheme: Grapheme, config: &'a RegExpConfig) -> Self {
        Self {
            graphemes: vec![grapheme],
            config,
        }
    }

    pub(crate) fn convert_to_char_classes(&mut self) {
        let is_digit_converted = self.config.is_digit_converted;
        let is_non_digit_converted = self.config.is_non_digit_converted;
        let is_space_converted = self.config.is_space_converted;
        let is_non_space_converted = self.config.is_non_space_converted;
        let is_word_converted = self.config.is_word_converted;
        let is_non_word_converted = self.config.is_non_word_converted;

        for grapheme in self.graphemes.iter_mut() {
            grapheme.chars = grapheme
                .chars
                .iter()
                .map(|it| {
                    it.chars()
                        .map(|c| {
                            if is_digit_converted && is_digit(c) {
                                "\\d".to_string()
                            } else if is_word_converted && is_word(c) {
                                "\\w".to_string()
                            } else if is_space_converted && is_space(c) {
                                "\\s".to_string()
                            } else if is_non_digit_converted && !is_digit(c) {
                                "\\D".to_string()
                            } else if is_non_word_converted && !is_word(c) {
                                "\\W".to_string()
                            } else if is_non_space_converted && !is_space(c) {
                                "\\S".to_string()
                            } else {
                                c.to_string()
                            }
                        })
                        .join("")
                })
                .collect_vec();
        }
    }

    pub(crate) fn convert_repetitions(&mut self) {
        let mut repetitions = vec![];
        convert_repetitions(self.graphemes(), repetitions.as_mut(), self.config);
        if !repetitions.is_empty() {
            self.graphemes = repetitions;
        }
    }

    pub(crate) fn merge(
        first: &GraphemeCluster,
        second: &GraphemeCluster,
        config: &'a RegExpConfig,
    ) -> Self {
        let mut graphemes = vec![];
        graphemes.extend_from_slice(&first.graphemes);
        graphemes.extend_from_slice(&second.graphemes);
        Self { graphemes, config }
    }

    pub(crate) fn graphemes(&self) -> &Vec<Grapheme> {
        &self.graphemes
    }

    pub(crate) fn graphemes_mut(&mut self) -> &mut Vec<Grapheme> {
        &mut self.graphemes
    }

    pub(crate) fn size(&self) -> usize {
        self.graphemes.len()
    }

    pub(crate) fn char_count(&self, is_non_ascii_char_escaped: bool) -> usize {
        self.graphemes
            .iter()
            .map(|it| it.char_count(is_non_ascii_char_escaped))
            .sum()
    }

    pub(crate) fn is_empty(&self) -> bool {
        self.graphemes.is_empty()
    }
}

fn is_digit(c: char) -> bool {
    static VALID_NUMERIC_CHARS: LazyLock<Vec<CharRange>> =
        LazyLock::new(|| convert_chars_to_range(DECIMAL_NUMBER));
    VALID_NUMERIC_CHARS.iter().any(|range| range.contains(c))
}

fn is_word(c: char) -> bool {
    static VALID_ALPHANUMERIC_CHARS: LazyLock<Vec<CharRange>> =
        LazyLock::new(|| convert_chars_to_range(WORD));
    VALID_ALPHANUMERIC_CHARS
        .iter()
        .any(|range| range.contains(c))
}

fn is_space(c: char) -> bool {
    static VALID_SPACE_CHARS: LazyLock<Vec<CharRange>> =
        LazyLock::new(|| convert_chars_to_range(WHITE_SPACE));
    VALID_SPACE_CHARS.iter().any(|range| range.contains(c))
}

fn convert_repetitions(
    graphemes: &[Grapheme],
    repetitions: &mut Vec<Grapheme>,
    config: &RegExpConfig,
) {
    let repeated_substrings = collect_repeated_substrings(graphemes);
    let ranges_of_repetitions = create_ranges_of_repetitions(repeated_substrings, config);
    let coalesced_repetitions = coalesce_repetitions(ranges_of_repetitions);
    replace_graphemes_with_repetitions(coalesced_repetitions, graphemes, repetitions, config)
}

fn collect_repeated_substrings(graphemes: &[Grapheme]) -> HashMap<Vec<String>, Vec<usize>> {
    let mut map = HashMap::new();

    for i in 0..graphemes.len() {
        let suffix = &graphemes[i..];
        for j in 1..=graphemes.len() / 2 {
            if suffix.len() >= j {
                let prefix = suffix[..j].iter().map(|it| it.value()).collect_vec();
                let indices = map.entry(prefix).or_insert_with(Vec::new);
                indices.push(i);
            }
        }
    }
    map
}

fn create_ranges_of_repetitions(
    repeated_substrings: HashMap<Vec<String>, Vec<usize>>,
    config: &RegExpConfig,
) -> Vec<(Range<usize>, Vec<String>)> {
    let mut repetitions = Vec::<(Range<usize>, Vec<String>)>::new();

    for (prefix_length, group) in &repeated_substrings
        .iter()
        .filter(|&(prefix, indices)| {
            indices
                .iter()
                .tuple_windows()
                .all(|(first, second)| (second - first) >= prefix.len())
        })
        .sorted_by_key(|&(prefix, _)| prefix.len())
        .rev()
        .chunk_by(|&(prefix, _)| prefix.len())
    {
        for (prefix, indices) in group.sorted_by_key(|&(_, indices)| indices[0]) {
            indices
                .iter()
                .map(|it| *it..it + prefix_length)
                .coalesce(|x, y| {
                    if x.end == y.start {
                        Ok(x.start..y.end)
                    } else {
                        Err((x, y))
                    }
                })
                .filter(|range| {
                    let count = ((range.end - range.start) / prefix_length) as u32;
                    count > config.minimum_repetitions
                })
                .for_each(|range| repetitions.push((range, prefix.clone())));
        }
    }
    repetitions
}

fn coalesce_repetitions(
    ranges_of_repetitions: Vec<(Range<usize>, Vec<String>)>,
) -> Vec<(Range<usize>, Vec<String>)> {
    ranges_of_repetitions
        .iter()
        .sorted_by(|&(first_range, _), &(second_range, _)| {
            match second_range.end.cmp(&first_range.end) {
                Ordering::Equal => first_range.start.cmp(&second_range.start),
                other => other,
            }
        })
        .coalesce(|first_tup, second_tup| {
            let first_range = &first_tup.0;
            let second_range = &second_tup.0;

            if (first_range.contains(&second_range.start)
                || first_range.contains(&second_range.end))
                && second_range.end != first_range.start
            {
                Ok(first_tup)
            } else {
                Err((first_tup, s
```

### Core Architecture Module: `src/component.rs`
```
/*
 * Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

use crate::quantifier::Quantifier;
use std::fmt::{Display, Formatter, Result};

pub(crate) enum Component {
    CapturedLeftParenthesis,
    CapturedParenthesizedExpression(String, bool, bool),
    Caret(bool),
    CharClass(String),
    DollarSign(bool),
    Hyphen,
    IgnoreCaseFlag,
    IgnoreCaseAndVerboseModeFlag,
    LeftBracket,
    Pipe,
    Quantifier(Quantifier, bool),
    Repetition(u32, bool),
    RepetitionRange(u32, u32, bool),
    RightBracket,
    RightParenthesis,
    UncapturedLeftParenthesis,
    UncapturedParenthesizedExpression(String, bool, bool),
    VerboseModeFlag,
}

impl Component {
    pub(crate) fn to_repr(&self, is_output_colorized: bool) -> String {
        match is_output_colorized {
            true => self.to_colored_string(false),
            false => self.to_string(),
        }
    }

    pub(crate) fn to_colored_string(&self, is_escaped: bool) -> String {
        match self {
            Component::CapturedLeftParenthesis => Self::green_bold(&self.to_string(), is_escaped),
            Component::CapturedParenthesizedExpression(
                expr,
                is_verbose_mode_enabled,
                has_final_line_break,
            ) => {
                if *is_verbose_mode_enabled {
                    if *has_final_line_break {
                        format!(
                            "\n{}\n{}\n{}\n",
                            Component::CapturedLeftParenthesis.to_colored_string(is_escaped),
                            expr,
                            Component::RightParenthesis.to_colored_string(is_escaped)
                        )
                    } else {
                        format!(
                            "\n{}\n{}\n{}",
                            Component::CapturedLeftParenthesis.to_colored_string(is_escaped),
                            expr,
                            Component::RightParenthesis.to_colored_string(is_escaped)
                        )
                    }
                } else {
                    format!(
                        "{}{}{}",
                        Component::CapturedLeftParenthesis.to_colored_string(is_escaped),
                        expr,
                        Component::RightParenthesis.to_colored_string(is_escaped)
                    )
                }
            }
            Component::Caret(is_verbose_mode_enabled) => {
                if *is_verbose_mode_enabled {
                    format!(
                        "{}\n",
                        Self::yellow_bold(&Component::Caret(false).to_string(), is_escaped)
                    )
                } else {
                    Self::yellow_bold(&self.to_string(), is_escaped)
                }
            }
            Component::CharClass(value) => Self::black_on_bright_yellow(value, is_escaped),
            Component::DollarSign(is_verbose_mode_enabled) => {
                if *is_verbose_mode_enabled {
                    format!(
                        "\n{}",
                        Self::yellow_bold(&Component::DollarSign(false).to_string(), is_escaped)
                    )
                } else {
                    Self::yellow_bold(&self.to_string(), is_escaped)
                }
            }
            Component::Hyphen => Self::cyan_bold(&self.to_string(), is_escaped),
            Component::IgnoreCaseFlag => {
                Self::bright_yellow_on_black(&self.to_string(), is_escaped)
            }
            Component::IgnoreCaseAndVerboseModeFlag => {
                format!("{}\n", Self::bright_yellow_on_black("(?ix)", is_escaped))
            }
            Component::LeftBracket => Self::cyan_bold(&self.to_string(), is_escaped),
            Component::Pipe => Self::red_bold(&self.to_string(), is_escaped),
            Component::Quantifier(quantifier, is_verbose_mode_enabled) => {
                if *is_verbose_mode_enabled {
                    format!(
                        "{}\n",
                        Self::purple_bold(&quantifier.to_string(), is_escaped)
                    )
                } else {
                    Self::purple_bold(&self.to_string(), is_escaped)
                }
            }
            Component::Repetition(num, is_verbose_mode_enabled) => {
                if *is_verbose_mode_enabled {
                    format!(
                        "{}\n",
                        Self::white_on_bright_blue(
                            &Component::Repetition(*num, false).to_string(),
                            is_escaped
                        )
                    )
                } else {
                    Self::white_on_bright_blue(&self.to_string(), is_escaped)
                }
            }
            Component::RepetitionRange(min, max, is_verbose_mode_enabled) => {
                if *is_verbose_mode_enabled {
                    format!(
                        "{}\n",
                        Self::white_on_bright_blue(
                            &Component::RepetitionRange(*min, *max, false).to_string(),
                            is_escaped
                        )
                    )
                } else {
                    Self::white_on_bright_blue(&self.to_string(), is_escaped)
                }
            }
            Component::RightBracket => Self::cyan_bold(&self.to_string(), is_escaped),
            Component::RightParenthesis => Self::green_bold(&self.to_string(), is_escaped),
            Component::UncapturedLeftParenthesis => Self::green_bold(&self.to_string(), is_escaped),
            Component::UncapturedParenthesizedExpression(
                expr,
                is_verbose_mode_enabled,
                has_final_line_break,
            ) => {
                if *is_verbose_mode_enabled {
                    if *has_final_line_break {
                        format!(
                            "\n{}\n{}\n{}\n",
                            Component::UncapturedLeftParenthesis.to_colored_string(is_escaped),
                            expr,
                            Component::RightParenthesis.to_colored_string(is_escaped)
                        )
                    } else {
                        format!(
                            "\n{}\n{}\n{}",
                            Component::UncapturedLeftParenthesis.to_colored_string(is_escaped),
                            expr,
                            Component::RightParenthesis.to_colored_string(is_escaped)
                        )
                    }
                } else {
                    format!(
                        "{}{}{}",
                        Component::UncapturedLeftParenthesis.to_colored_string(is_escaped),
                        expr,
                        Component::RightParenthesis.to_colored_string(is_escaped)
                    )
                }
            }
            Component::VerboseModeFlag => {
                format!("{}\n", Self::bright_yellow_on_black("(?x)", is_escaped))
            }
        }
    }

    fn black_on_bright_yellow(value: &str, is_escaped: bool) -> String {
        Self::color_code("103;30", value, is_escaped)
    }

    fn bright_yellow_on_black(value: &str, is_escaped: bool) -> String {
        Self::color_code("40;93", value, is_escaped)
    }

    fn cyan_bold(value: &str, is_escaped: bool) -> String {
        Self::color_code("1;36", value, is_escaped)
    }

    fn green_bold(value: &str, is_escaped: bool) -> String {
        Self::color_code("1;32", value, is_escaped)
    }

    fn purple_bold(value: &str, is_escaped: bool) -> String {
        Self::color_code("1;35", value, is_escaped)
    }

    fn red_bold(value: &str, is_escaped: bool) -> String {
        Self::color_code("1;31", value, is_escaped)
    }

    fn white_on_bright_blue(value: &str, is_escaped: bool) -> String {
        Self::color_code("104;37", value, is_escaped)
    }

    fn yellow_bold(value: &str, is_escaped: bool) -> String {
        Self::color_code("1;33", value, is_escaped)
    }

    fn color_code(code: &str, value: &str, is_escaped: bool) -> String {
        if is_escaped {
            format!("\u{1b}\\[{}m\\{}\u{1b}\\[0m", code, value)
        } else {
            format!("\u{1b}[{}m{}\u{1b}[0m", code, value)
        }
    }
}

impl Display for Component {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        write!(
            f,
            "{}",
            match self {
                Component::CapturedLeftParenthesis => "(".to_string(),
                Component::CapturedParenthesizedExpression(
                    expr,
                    is_verbose_mode_enabled,
                    has_final_line_break,
                ) =>
                    if *is_verbose_mode_enabled {
                        if *has_final_line_break {
                            format!(
                                "\n{}\n{}\n{}\n",
                                Component::CapturedLeftParenthesis,
                                expr,
                                Component::RightParenthesis
                            )
                        } else {
                            format!(
                                "\n{}\n{}\n{}",
                                Component::CapturedLeftParenthesis,
                                expr,
                                Component::RightParenthesis
                            )
 
```

### Core Architecture Module: `src/config.rs`
```
/*
 * Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#[derive(Clone, Debug, Hash, Ord, PartialOrd, Eq, PartialEq)]
pub(crate) struct RegExpConfig {
    pub(crate) minimum_repetitions: u32,
    pub(crate) minimum_substring_length: u32,
    pub(crate) is_digit_converted: bool,
    pub(crate) is_non_digit_converted: bool,
    pub(crate) is_space_converted: bool,
    pub(crate) is_non_space_converted: bool,
    pub(crate) is_word_converted: bool,
    pub(crate) is_non_word_converted: bool,
    pub(crate) is_repetition_converted: bool,
    pub(crate) is_case_insensitive_matching: bool,
    pub(crate) is_capturing_group_enabled: bool,
    pub(crate) is_non_ascii_char_escaped: bool,
    pub(crate) is_astral_code_point_converted_to_surrogate: bool,
    pub(crate) is_verbose_mode_enabled: bool,
    pub(crate) is_start_anchor_disabled: bool,
    pub(crate) is_end_anchor_disabled: bool,
    pub(crate) is_output_colorized: bool,
}

impl RegExpConfig {
    pub(crate) fn new() -> Self {
        Self {
            minimum_repetitions: 1,
            minimum_substring_length: 1,
            is_digit_converted: false,
            is_non_digit_converted: false,
            is_space_converted: false,
            is_non_space_converted: false,
            is_word_converted: false,
            is_non_word_converted: false,
            is_repetition_converted: false,
            is_case_insensitive_matching: false,
            is_capturing_group_enabled: false,
            is_non_ascii_char_escaped: false,
            is_astral_code_point_converted_to_surrogate: false,
            is_verbose_mode_enabled: false,
            is_start_anchor_disabled: false,
            is_end_anchor_disabled: false,
            is_output_colorized: false,
        }
    }

    pub(crate) fn is_char_class_feature_enabled(&self) -> bool {
        self.is_digit_converted
            || self.is_non_digit_converted
            || self.is_space_converted
            || self.is_non_space_converted
            || self.is_word_converted
            || self.is_non_word_converted
            || self.is_case_insensitive_matching
            || self.is_capturing_group_enabled
    }
}

```

### Core Architecture Module: `src/dfa.rs`
```
/*
 * Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

use crate::cluster::GraphemeCluster;
use crate::config::RegExpConfig;
use crate::grapheme::Grapheme;
use itertools::Itertools;
use petgraph::graph::NodeIndex;
use petgraph::stable_graph::{Edges, StableGraph};
use petgraph::visit::Dfs;
use petgraph::{Directed, Direction};
use std::cmp::{max, min};
use std::collections::{BTreeSet, HashMap, HashSet};

type State = NodeIndex<u32>;
type StateLabel = String;
type EdgeLabel = Grapheme;

pub(crate) struct Dfa<'a> {
    alphabet: BTreeSet<Grapheme>,
    graph: StableGraph<StateLabel, EdgeLabel>,
    initial_state: State,
    final_state_indices: HashSet<usize>,
    config: &'a RegExpConfig,
}

impl<'a> Dfa<'a> {
    pub(crate) fn from(
        grapheme_clusters: &[GraphemeCluster],
        is_minimized: bool,
        config: &'a RegExpConfig,
    ) -> Self {
        let mut dfa = Self::new(config);
        for cluster in grapheme_clusters {
            dfa.insert(cluster);
        }
        if is_minimized {
            dfa.minimize();
        }
        dfa
    }

    pub(crate) fn state_count(&self) -> usize {
        self.graph.node_count()
    }

    pub(crate) fn states_in_depth_first_order(&self) -> Vec<State> {
        let mut depth_first_search = Dfs::new(&self.graph, self.initial_state);
        let mut states = vec![];
        while let Some(state) = depth_first_search.next(&self.graph) {
            states.push(state);
        }
        states
    }

    pub(crate) fn outgoing_edges(&self, state: State) -> Edges<'_, Grapheme, Directed> {
        self.graph.edges_directed(state, Direction::Outgoing)
    }

    pub(crate) fn is_final_state(&self, state: State) -> bool {
        self.final_state_indices.contains(&state.index())
    }

    fn new(config: &'a RegExpConfig) -> Self {
        let mut graph = StableGraph::new();
        let initial_state = graph.add_node("".to_string());
        Self {
            alphabet: BTreeSet::new(),
            graph,
            initial_state,
            final_state_indices: HashSet::new(),
            config,
        }
    }

    fn insert(&mut self, cluster: &GraphemeCluster) {
        let mut current_state = self.initial_state;

        for grapheme in cluster.graphemes() {
            self.alphabet.insert(grapheme.clone());
            current_state = self.return_next_state(current_state, grapheme);
        }
        self.final_state_indices.insert(current_state.index());
    }

    fn return_next_state(&mut self, current_state: State, edge_label: &Grapheme) -> State {
        match self.find_next_state(current_state, edge_label) {
            Some(next_state) => next_state,
            None => self.add_new_state(current_state, edge_label),
        }
    }

    fn find_next_state(&mut self, current_state: State, grapheme: &Grapheme) -> Option<State> {
        for next_state in self.graph.neighbors(current_state) {
            let edge_idx = self.graph.find_edge(current_state, next_state).unwrap();
            let current_grapheme = self.graph.edge_weight(edge_idx).unwrap();

            if current_grapheme.value() != grapheme.value() {
                continue;
            }

            if current_grapheme.maximum() == grapheme.maximum() - 1 {
                let min = min(current_grapheme.minimum(), grapheme.minimum());
                let max = max(current_grapheme.maximum(), grapheme.maximum());
                let new_grapheme = Grapheme::new(
                    grapheme.chars().clone(),
                    min,
                    max,
                    self.config.is_capturing_group_enabled,
                    self.config.is_output_colorized,
                    self.config.is_verbose_mode_enabled,
                );
                self.graph
                    .update_edge(current_state, next_state, new_grapheme);
                return Some(next_state);
            } else if current_grapheme.maximum() == grapheme.maximum() {
                return Some(next_state);
            }
        }
        None
    }

    fn add_new_state(&mut self, current_state: State, edge_label: &Grapheme) -> State {
        let next_state = self.graph.add_node("".to_string());
        self.graph
            .add_edge(current_state, next_state, edge_label.clone());
        next_state
    }

    #[allow(clippy::many_single_char_names)]
    fn minimize(&mut self) {
        let mut p = self.get_initial_partition();
        let mut w = p.iter().cloned().collect_vec();

        while !w.is_empty() {
            let a = w.drain(0..1).next().unwrap();

            for edge_label in self.alphabet.iter() {
                let x = self.get_parent_states(&a, edge_label);
                let mut replacements = vec![];
                let mut is_replacement_needed = true;
                let mut start_idx = 0;

                while is_replacement_needed {
                    for (idx, y) in p.iter().enumerate().skip(start_idx) {
                        if x.intersection(y).count() == 0 || y.difference(&x).count() == 0 {
                            is_replacement_needed = false;
                            continue;
                        }

                        let i = x.intersection(y).copied().collect::<HashSet<State>>();
                        let d = y.difference(&x).copied().collect::<HashSet<State>>();

                        is_replacement_needed = true;
                        start_idx = idx;

                        replacements.push((y.clone(), i, d));

                        break;
                    }

                    if is_replacement_needed {
                        let (_, i, d) = replacements.last().unwrap();

                        p.remove(start_idx);
                        p.insert(start_idx, i.clone());
                        p.insert(start_idx + 1, d.clone());
                    }
                }

                for (y, i, d) in replacements {
                    if w.contains(&y) {
                        let idx = w.iter().position(|it| it == &y).unwrap();
                        w.remove(idx);
                        w.push(i);
                        w.push(d);
                    } else if i.len() <= d.len() {
                        w.push(i);
                    } else {
                        w.push(d);
                    }
                }
            }
        }

        self.recreate_graph(p.iter().filter(|&it| !it.is_empty()).collect_vec());
    }

    fn get_initial_partition(&self) -> Vec<HashSet<State>> {
        let (final_states, non_final_states): (HashSet<State>, HashSet<State>) = self
            .graph
            .node_indices()
            .partition(|&state| !self.final_state_indices.contains(&state.index()));

        vec![final_states, non_final_states]
    }

    fn get_parent_states(&self, a: &HashSet<State>, label: &Grapheme) -> HashSet<State> {
        let mut x = HashSet::new();

        for &state in a {
            let direct_parent_states = self.graph.neighbors_directed(state, Direction::Incoming);
            for parent_state in direct_parent_states {
                let edge = self.graph.find_edge(parent_state, state).unwrap();
                let grapheme = self.graph.edge_weight(edge).unwrap();
                if grapheme.value() == label.value()
                    && (grapheme.maximum() == label.maximum()
                        || grapheme.minimum() == label.minimum())
                {
                    x.insert(parent_state);
                    break;
                }
            }
        }
        x
    }

    fn recreate_graph(&mut self, p: Vec<&HashSet<State>>) {
        let mut graph = StableGraph::<StateLabel, EdgeLabel>::new();
        let mut final_state_indices = HashSet::new();
        let mut state_mappings = HashMap::new();
        let mut new_initial_state: Option<NodeIndex> = None;

        for equivalence_class in p.iter() {
            let new_state = graph.add_node("".to_string());

            for old_state in equivalence_class.iter() {
                if self.initial_state == *old_state {
                    new_initial_state = Some(new_state);
                }
                state_mappings.insert(*old_state, new_state);
            }
        }

        for equivalence_class in p.iter() {
            let old_source_state = *equivalence_class.iter().next().unwrap();
            let new_source_state = state_mappings.get(&old_source_state).unwrap();

            for old_target_state in self.graph.neighbors(old_source_state) {
                let edge = self
                    .graph
                    .find_edge(old_source_state, old_target_state)
                    .unwrap();

                let grapheme = self.graph.edge_weight(edge).unwrap().clone();
                let new_target_state = state_mappings.get(&old_target_state).unwrap();

                graph.add_edge(*new_source_state, *new_target_state, grapheme.clone());

                if self.final_state_indices.contains(&old_target_state.index()) {
                    final_state_indices.insert(new_target_state.index());
                }
            }
        }
        self.initial_state = new_initial_state.unwrap();
        self.final_state_indices = final_state_indices;
        self.graph = graph;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_count() {
        let config = RegExpConfig::new();
        let mut dfa = D
```

### Core Architecture Module: `src/expression.rs`
```
/*
 * Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

use crate::cluster::GraphemeCluster;
use crate::config::RegExpConfig;
use crate::dfa::Dfa;
use crate::grapheme::Grapheme;
use crate::quantifier::Quantifier;
use crate::substring::Substring;
use itertools::EitherOrBoth::Both;
use itertools::Itertools;
use ndarray::{Array1, Array2};
use petgraph::prelude::EdgeRef;
use std::cmp::Reverse;
use std::collections::BTreeSet;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum Expression<'a> {
    Alternation(Vec<Expression<'a>>, bool, bool, bool),
    CharacterClass(BTreeSet<char>, bool),
    Concatenation(Box<Expression<'a>>, Box<Expression<'a>>, bool, bool, bool),
    Literal(GraphemeCluster<'a>, bool, bool),
    Repetition(Box<Expression<'a>>, Quantifier, bool, bool, bool),
}

impl<'a> Expression<'a> {
    pub(crate) fn from(dfa: Dfa, config: &'a RegExpConfig) -> Self {
        let states = dfa.states_in_depth_first_order();
        let state_count = dfa.state_count();

        let mut a = Array2::<Option<Expression>>::default((state_count, state_count));
        let mut b = Array1::<Option<Expression>>::default(state_count);

        for (i, state) in states.iter().enumerate() {
            if dfa.is_final_state(*state) {
                b[i] = Some(Expression::new_literal(
                    GraphemeCluster::from("", config),
                    config,
                ));
            }

            for edge in dfa.outgoing_edges(*state) {
                let literal = Expression::new_literal(
                    GraphemeCluster::new(edge.weight().clone(), config),
                    config,
                );
                let j = states.iter().position(|&it| it == edge.target()).unwrap();

                a[(i, j)] = if a[(i, j)].is_some() {
                    Self::union(&a[(i, j)], &Some(literal), config)
                } else {
                    Some(literal)
                }
            }
        }

        for n in (0..state_count).rev() {
            if a[(n, n)].is_some() {
                b[n] = Self::concatenate(
                    &Self::repeat_zero_or_more_times(&a[(n, n)], config),
                    &b[n],
                    config,
                );
                for j in 0..n {
                    a[(n, j)] = Self::concatenate(
                        &Self::repeat_zero_or_more_times(&a[(n, n)], config),
                        &a[(n, j)],
                        config,
                    );
                }
            }

            for i in 0..n {
                if a[(i, n)].is_some() {
                    b[i] =
                        Self::union(&b[i], &Self::concatenate(&a[(i, n)], &b[n], config), config);
                    for j in 0..n {
                        a[(i, j)] = Self::union(
                            &a[(i, j)],
                            &Self::concatenate(&a[(i, n)], &a[(n, j)], config),
                            config,
                        );
                    }
                }
            }
        }

        if !b.is_empty() && b[0].is_some() {
            b[0].as_ref().unwrap().clone()
        } else {
            Expression::new_literal(GraphemeCluster::from("", config), config)
        }
    }

    pub(crate) fn new_alternation(exprs: Vec<Expression<'a>>, config: &RegExpConfig) -> Self {
        let mut options: Vec<Expression> = vec![];
        Self::flatten_alternations(&mut options, exprs);
        options.sort_by_key(|option| Reverse(option.len()));
        Expression::Alternation(
            options,
            config.is_capturing_group_enabled,
            config.is_output_colorized,
            config.is_verbose_mode_enabled,
        )
    }

    fn new_character_class(
        first_char_set: BTreeSet<char>,
        second_char_set: BTreeSet<char>,
        config: &RegExpConfig,
    ) -> Self {
        let union_set = first_char_set.union(&second_char_set).copied().collect();
        Expression::CharacterClass(union_set, config.is_output_colorized)
    }

    fn new_concatenation(
        expr1: Expression<'a>,
        expr2: Expression<'a>,
        config: &RegExpConfig,
    ) -> Self {
        Expression::Concatenation(
            Box::from(expr1),
            Box::from(expr2),
            config.is_capturing_group_enabled,
            config.is_output_colorized,
            config.is_verbose_mode_enabled,
        )
    }

    pub(crate) fn new_literal(cluster: GraphemeCluster<'a>, config: &RegExpConfig) -> Self {
        Expression::Literal(
            cluster,
            config.is_non_ascii_char_escaped,
            config.is_astral_code_point_converted_to_surrogate,
        )
    }

    fn new_repetition(expr: Expression<'a>, quantifier: Quantifier, config: &RegExpConfig) -> Self {
        Expression::Repetition(
            Box::from(expr),
            quantifier,
            config.is_capturing_group_enabled,
            config.is_output_colorized,
            config.is_verbose_mode_enabled,
        )
    }

    fn is_empty(&self) -> bool {
        match self {
            Expression::Literal(cluster, _, _) => cluster.is_empty(),
            _ => false,
        }
    }

    pub(crate) fn is_single_codepoint(&self) -> bool {
        match self {
            Expression::CharacterClass(_, _) => true,
            Expression::Literal(cluster, is_non_ascii_char_escaped, _) => {
                cluster.char_count(*is_non_ascii_char_escaped) == 1
                    && cluster.graphemes().first().unwrap().maximum() == 1
            }
            _ => false,
        }
    }

    fn len(&self) -> usize {
        match self {
            Expression::Alternation(options, _, _, _) => options.first().unwrap().len(),
            Expression::CharacterClass(_, _) => 1,
            Expression::Concatenation(expr1, expr2, _, _, _) => expr1.len() + expr2.len(),
            Expression::Literal(cluster, _, _) => cluster.size(),
            Expression::Repetition(expr, _, _, _, _) => expr.len(),
        }
    }

    pub(crate) fn precedence(&self) -> u8 {
        match self {
            Expression::Alternation(_, _, _, _) | Expression::CharacterClass(_, _) => 1,
            Expression::Concatenation(_, _, _, _, _) | Expression::Literal(_, _, _) => 2,
            Expression::Repetition(_, _, _, _, _) => 3,
        }
    }

    pub(crate) fn remove_substring(&mut self, substring: &Substring, length: usize) {
        match self {
            Expression::Concatenation(expr1, expr2, _, _, _) => match substring {
                Substring::Prefix => {
                    if let Expression::Literal(_, _, _) = **expr1 {
                        expr1.remove_substring(substring, length)
                    }
                }
                Substring::Suffix => {
                    if let Expression::Literal(_, _, _) = **expr2 {
                        expr2.remove_substring(substring, length)
                    }
                }
            },
            Expression::Literal(cluster, _, _) => match substring {
                Substring::Prefix => {
                    cluster.graphemes_mut().drain(..length);
                }
                Substring::Suffix => {
                    let graphemes = cluster.graphemes_mut();
                    graphemes.drain(graphemes.len() - length..);
                }
            },
            _ => (),
        }
    }

    pub(crate) fn value(&self, substring: Option<&Substring>) -> Option<Vec<Grapheme>> {
        match self {
            Expression::Concatenation(expr1, expr2, _, _, _) => match substring {
                Some(value) => match value {
                    Substring::Prefix => expr1.value(None),
                    Substring::Suffix => expr2.value(None),
                },
                None => None,
            },
            Expression::Literal(cluster, _, _) => Some(cluster.graphemes().clone()),
            _ => None,
        }
    }

    fn repeat_zero_or_more_times(
        expr: &Option<Expression<'a>>,
        config: &'a RegExpConfig,
    ) -> Option<Expression<'a>> {
        expr.as_ref()
            .map(|value| Expression::new_repetition(value.clone(), Quantifier::KleeneStar, config))
    }

    fn concatenate(
        a: &Option<Expression<'a>>,
        b: &Option<Expression<'a>>,
        config: &'a RegExpConfig,
    ) -> Option<Expression<'a>> {
        if a.is_none() || b.is_none() {
            return None;
        }

        let expr1 = a.as_ref().unwrap();
        let expr2 = b.as_ref().unwrap();

        if expr1.is_empty() {
            return b.clone();
        }
        if expr2.is_empty() {
            return a.clone();
        }

        if let (Expression::Literal(graphemes_a, _, _), Expression::Literal(graphemes_b, _, _)) =
            (&expr1, &expr2)
        {
            return Some(Expression::new_literal(
                GraphemeCluster::merge(graphemes_a, graphemes_b, config),
                config,
            ));
        }

        if let (
            Expression::Literal(graphemes_a, _, _),
            Expression::Concatenation(first, second, _, _, _),
        ) = (&expr1, &expr2)
        {
            if let Expression::Literal(graphemes_first, _, _) = &**first {
                let literal = Expression::new_literal(
                    GraphemeCluster::merge(graphemes_a, graphemes_first, config),
                    config,
                );
                return Some(Expression::
```

### Core Architecture Module: `src/format.rs`
```
/*
 * Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

use crate::char_range::CharRange;
use crate::cluster::GraphemeCluster;
use crate::component::Component;
use crate::expression::Expression;
use crate::quantifier::Quantifier;
use itertools::Itertools;
use std::collections::BTreeSet;
use std::fmt::{Display, Formatter, Result};

impl Display for Expression<'_> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        match self {
            Expression::Alternation(
                options,
                is_capturing_group_enabled,
                is_output_colorized,
                is_verbose_mode_enabled,
            ) => format_alternation(
                f,
                self,
                options,
                *is_capturing_group_enabled,
                *is_output_colorized,
                *is_verbose_mode_enabled,
            ),
            Expression::CharacterClass(char_set, is_output_colorized) => {
                format_character_class(f, char_set, *is_output_colorized)
            }
            Expression::Concatenation(
                expr1,
                expr2,
                is_capturing_group_enabled,
                is_output_colorized,
                is_verbose_mode_enabled,
            ) => format_concatenation(
                f,
                self,
                expr1,
                expr2,
                *is_capturing_group_enabled,
                *is_output_colorized,
                *is_verbose_mode_enabled,
            ),
            Expression::Literal(
                cluster,
                is_non_ascii_char_escaped,
                is_astral_code_point_converted_to_surrogate,
            ) => format_literal(
                f,
                cluster,
                *is_non_ascii_char_escaped,
                *is_astral_code_point_converted_to_surrogate,
            ),
            Expression::Repetition(
                expr,
                quantifier,
                is_capturing_group_enabled,
                is_output_colorized,
                is_verbose_mode_enabled,
            ) => format_repetition(
                f,
                self,
                expr,
                quantifier,
                *is_capturing_group_enabled,
                *is_output_colorized,
                *is_verbose_mode_enabled,
            ),
        }
    }
}

fn get_codepoint_position(c: char) -> usize {
    CharRange::all().position(|it| it == c).unwrap()
}

fn format_alternation(
    f: &mut Formatter<'_>,
    expr: &Expression,
    options: &[Expression],
    is_capturing_group_enabled: bool,
    is_output_colorized: bool,
    is_verbose_mode_enabled: bool,
) -> Result {
    let pipe_component = Component::Pipe.to_repr(is_output_colorized);
    let disjunction_operator = if is_verbose_mode_enabled {
        format!("\n{}\n", pipe_component)
    } else {
        pipe_component
    };
    let alternation_str = options
        .iter()
        .map(|option| {
            if option.precedence() < expr.precedence() && !option.is_single_codepoint() {
                if is_capturing_group_enabled {
                    Component::CapturedParenthesizedExpression(
                        option.to_string(),
                        is_verbose_mode_enabled,
                        true,
                    )
                    .to_repr(is_output_colorized)
                } else {
                    Component::UncapturedParenthesizedExpression(
                        option.to_string(),
                        is_verbose_mode_enabled,
                        true,
                    )
                    .to_repr(is_output_colorized)
                }
            } else {
                format!("{}", option)
            }
        })
        .join(&disjunction_operator);

    write!(f, "{}", alternation_str)
}

fn format_character_class(
    f: &mut Formatter<'_>,
    char_set: &BTreeSet<char>,
    is_output_colorized: bool,
) -> Result {
    let chars_to_escape = ['[', ']', '\\', '-', '^', '$'];
    let escaped_char_set = char_set
        .iter()
        .map(|c| {
            if chars_to_escape.contains(c) {
                format!("{}{}", "\\", c)
            } else if c == &'\n' {
                "\\n".to_string()
            } else if c == &'\r' {
                "\\r".to_string()
            } else if c == &'\t' {
                "\\t".to_string()
            } else {
                c.to_string()
            }
        })
        .collect_vec();
    let char_positions = char_set
        .iter()
        .map(|&it| get_codepoint_position(it))
        .collect_vec();

    let mut subsets = vec![];
    let mut subset = vec![];

    for ((first_c, first_pos), (second_c, second_pos)) in
        escaped_char_set.iter().zip(char_positions).tuple_windows()
    {
        if subset.is_empty() {
            subset.push(first_c);
        }
        if second_pos == first_pos + 1 {
            subset.push(second_c);
        } else {
            subsets.push(subset);
            subset = vec![second_c];
        }
    }

    subsets.push(subset);

    let mut char_class_strs = vec![];

    for subset in subsets.iter() {
        if subset.len() <= 2 {
            for c in subset.iter() {
                char_class_strs.push((*c).to_string());
            }
        } else {
            char_class_strs.push(format!(
                "{}{}{}",
                subset.first().unwrap(),
                Component::Hyphen.to_repr(is_output_colorized),
                subset.last().unwrap()
            ));
        }
    }

    write!(
        f,
        "{}{}{}",
        Component::LeftBracket.to_repr(is_output_colorized),
        char_class_strs.join(""),
        Component::RightBracket.to_repr(is_output_colorized)
    )
}

fn format_concatenation(
    f: &mut Formatter<'_>,
    expr: &Expression,
    expr1: &Expression,
    expr2: &Expression,
    is_capturing_group_enabled: bool,
    is_output_colorized: bool,
    is_verbose_mode_enabled: bool,
) -> Result {
    let expr_strs = [expr1, expr2]
        .iter()
        .map(|&it| {
            if it.precedence() < expr.precedence() && !it.is_single_codepoint() {
                if is_capturing_group_enabled {
                    Component::CapturedParenthesizedExpression(
                        it.to_string(),
                        is_verbose_mode_enabled,
                        true,
                    )
                    .to_repr(is_output_colorized)
                } else {
                    Component::UncapturedParenthesizedExpression(
                        it.to_string(),
                        is_verbose_mode_enabled,
                        true,
                    )
                    .to_repr(is_output_colorized)
                }
            } else {
                format!("{}", it)
            }
        })
        .collect_vec();

    write!(
        f,
        "{}{}",
        expr_strs.first().unwrap(),
        expr_strs.last().unwrap()
    )
}

fn format_literal(
    f: &mut Formatter<'_>,
    cluster: &GraphemeCluster,
    is_non_ascii_char_escaped: bool,
    is_astral_code_point_converted_to_surrogate: bool,
) -> Result {
    let literal_str = cluster
        .graphemes()
        .iter()
        .cloned()
        .map(|mut grapheme| {
            if grapheme.has_repetitions() {
                grapheme
                    .repetitions_mut()
                    .iter_mut()
                    .for_each(|repeated_grapheme| {
                        repeated_grapheme.escape_regexp_symbols(
                            is_non_ascii_char_escaped,
                            is_astral_code_point_converted_to_surrogate,
                        );
                    });
            } else {
                grapheme.escape_regexp_symbols(
                    is_non_ascii_char_escaped,
                    is_astral_code_point_converted_to_surrogate,
                );
            }
            grapheme.to_string()
        })
        .join("");

    write!(f, "{}", literal_str)
}

fn format_repetition(
    f: &mut Formatter<'_>,
    expr: &Expression,
    expr1: &Expression,
    quantifier: &Quantifier,
    is_capturing_group_enabled: bool,
    is_output_colorized: bool,
    is_verbose_mode_enabled: bool,
) -> Result {
    if expr1.precedence() < expr.precedence() && !expr1.is_single_codepoint() {
        if is_capturing_group_enabled {
            write!(
                f,
                "{}{}",
                Component::CapturedParenthesizedExpression(
                    expr1.to_string(),
                    is_verbose_mode_enabled,
                    false
                )
                .to_repr(is_output_colorized),
                Component::Quantifier(quantifier.clone(), is_verbose_mode_enabled)
                    .to_repr(is_output_colorized)
            )
        } else {
            write!(
                f,
                "{}{}",
                Component::UncapturedParenthesizedExpression(
                    expr1.to_string(),
                    is_verbose_mode_enabled,
                    false
                )
                .to_repr(is_output_colorized),
                Component::Quantifier(quantifier.clone(), is_verbose_mode_enabled)
                    .to_repr(is_output_colorized)
            )
        }
    } else {
        write!(
            f,
            "{}{}",
            expr1,
            Component::Quantifier(
```

### Core Architecture Module: `src/grapheme.rs`
```
/*
 * Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

use crate::component::Component;
use itertools::Itertools;
use std::fmt::{Display, Formatter, Result};

const CHARS_TO_ESCAPE: [&str; 14] = [
    "(", ")", "[", "]", "{", "}", "+", "*", "-", ".", "?", "|", "^", "$",
];

const CHAR_CLASSES: [&str; 6] = ["\\d", "\\s", "\\w", "\\D", "\\S", "\\W"];

#[derive(Clone, Debug, Hash, Ord, PartialOrd, Eq, PartialEq)]
pub(crate) struct Grapheme {
    pub(crate) chars: Vec<String>,
    pub(crate) repetitions: Vec<Grapheme>,
    min: u32,
    max: u32,
    is_capturing_group_enabled: bool,
    is_output_colorized: bool,
    is_verbose_mode_enabled: bool,
}

impl Grapheme {
    pub(crate) fn from(
        s: &str,
        is_capturing_group_enabled: bool,
        is_output_colorized: bool,
        is_verbose_mode_enabled: bool,
    ) -> Self {
        Self {
            chars: vec![s.to_string()],
            repetitions: vec![],
            min: 1,
            max: 1,
            is_capturing_group_enabled,
            is_output_colorized,
            is_verbose_mode_enabled,
        }
    }

    pub(crate) fn new(
        chars: Vec<String>,
        min: u32,
        max: u32,
        is_capturing_group_enabled: bool,
        is_output_colorized: bool,
        is_verbose_mode_enabled: bool,
    ) -> Self {
        Self {
            chars,
            repetitions: vec![],
            min,
            max,
            is_capturing_group_enabled,
            is_output_colorized,
            is_verbose_mode_enabled,
        }
    }

    pub(crate) fn value(&self) -> String {
        self.chars.join("")
    }

    pub(crate) fn chars(&self) -> &Vec<String> {
        &self.chars
    }

    pub(crate) fn chars_mut(&mut self) -> &mut Vec<String> {
        &mut self.chars
    }

    pub(crate) fn has_repetitions(&self) -> bool {
        !self.repetitions.is_empty()
    }

    pub(crate) fn repetitions_mut(&mut self) -> &mut Vec<Grapheme> {
        &mut self.repetitions
    }

    pub(crate) fn minimum(&self) -> u32 {
        self.min
    }

    pub(crate) fn maximum(&self) -> u32 {
        self.max
    }

    pub(crate) fn char_count(&self, is_non_ascii_char_escaped: bool) -> usize {
        if is_non_ascii_char_escaped {
            self.chars
                .iter()
                .map(|it| it.chars().map(|c| self.escape(c, false)).join(""))
                .join("")
                .chars()
                .count()
        } else {
            self.chars.iter().map(|it| it.chars().count()).sum()
        }
    }

    pub(crate) fn escape_non_ascii_chars(&mut self, use_surrogate_pairs: bool) {
        self.chars = self
            .chars
            .iter()
            .map(|it| {
                it.chars()
                    .map(|c| self.escape(c, use_surrogate_pairs))
                    .join("")
            })
            .collect_vec();
    }

    pub(crate) fn escape_regexp_symbols(
        &mut self,
        is_non_ascii_char_escaped: bool,
        is_astral_code_point_converted_to_surrogate: bool,
    ) {
        let characters = self.chars_mut();

        #[allow(clippy::needless_range_loop)]
        for i in 0..characters.len() {
            let mut character = characters[i].clone();

            for char_to_escape in CHARS_TO_ESCAPE.iter() {
                character =
                    character.replace(char_to_escape, &format!("{}{}", "\\", char_to_escape));
            }

            character = character
                .replace('\n', "\\n")
                .replace('\r', "\\r")
                .replace('\t', "\\t");

            if character == "\\" {
                character = "\\\\".to_string();
            }

            characters[i] = character;
        }

        if is_non_ascii_char_escaped {
            self.escape_non_ascii_chars(is_astral_code_point_converted_to_surrogate);
        }
    }

    fn escape(&self, c: char, use_surrogate_pairs: bool) -> String {
        if c.is_ascii() {
            c.to_string()
        } else if use_surrogate_pairs && ('\u{10000}'..'\u{10ffff}').contains(&c) {
            self.convert_to_surrogate_pair(c)
        } else {
            c.escape_unicode().to_string()
        }
    }

    fn convert_to_surrogate_pair(&self, c: char) -> String {
        c.encode_utf16(&mut [0; 2])
            .iter()
            .map(|it| format!("\\u{{{:x}}}", it))
            .join("")
    }
}

impl Display for Grapheme {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        let is_single_char = self.char_count(false) == 1
            || (self.chars.len() == 1 && self.chars[0].matches('\\').count() == 1);
        let is_range = self.min < self.max;
        let is_repetition = self.min > 1;
        let mut value = if self.repetitions.is_empty() {
            self.value()
        } else {
            self.repetitions.iter().map(|it| it.to_string()).join("")
        };
        value = Component::CharClass(value.clone())
            .to_repr(self.is_output_colorized && CHAR_CLASSES.contains(&&*value));

        if !is_range && is_repetition && is_single_char {
            write!(
                f,
                "{}{}",
                value,
                Component::Repetition(self.min, false).to_repr(self.is_output_colorized)
            )
        } else if !is_range && is_repetition && !is_single_char {
            write!(
                f,
                "{}{}",
                if self.is_capturing_group_enabled {
                    Component::CapturedParenthesizedExpression(
                        value,
                        self.is_verbose_mode_enabled,
                        false,
                    )
                    .to_repr(self.is_output_colorized)
                } else {
                    Component::UncapturedParenthesizedExpression(
                        value,
                        self.is_verbose_mode_enabled,
                        false,
                    )
                    .to_repr(self.is_output_colorized)
                },
                Component::Repetition(self.min, self.is_verbose_mode_enabled)
                    .to_repr(self.is_output_colorized)
            )
        } else if is_range && is_single_char {
            write!(
                f,
                "{}{}",
                value,
                Component::RepetitionRange(self.min, self.max, false)
                    .to_repr(self.is_output_colorized)
            )
        } else if is_range && !is_single_char {
            write!(
                f,
                "{}{}",
                if self.is_capturing_group_enabled {
                    Component::CapturedParenthesizedExpression(
                        value,
                        self.is_verbose_mode_enabled,
                        false,
                    )
                    .to_repr(self.is_output_colorized)
                } else {
                    Component::UncapturedParenthesizedExpression(
                        value,
                        self.is_verbose_mode_enabled,
                        false,
                    )
                    .to_repr(self.is_output_colorized)
                },
                Component::RepetitionRange(self.min, self.max, self.is_verbose_mode_enabled)
                    .to_repr(self.is_output_colorized)
            )
        } else {
            write!(f, "{}", value)
        }
    }
}

```

### Core Architecture Module: `src/lib.rs`
```
/*
 * Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

//! ## 1. What does this tool do?
//!
//! *grex* is a library as well as a command-line utility that is meant to simplify the often
//! complicated and tedious task of creating regular expressions. It does so by automatically
//! generating a single regular expression from user-provided test cases. The resulting
//! expression is guaranteed to match the test cases which it was generated from.
//!
//! This project has started as a Rust port of the JavaScript tool
//! [*regexgen*](https://github.com/devongovett/regexgen) written by
//! [Devon Govett](https://github.com/devongovett). Although a lot of further useful features
//! could be added to it, its development was apparently ceased several years ago. The plan
//! is now to add these new features to *grex* as Rust really shines when it comes to
//! command-line tools. *grex* offers all features that *regexgen* provides, and more.
//!
//! The philosophy of this project is to generate the most specific regular expression
//! possible by default which exactly matches the given input only and nothing else.
//! With the use of command-line flags (in the CLI tool) or preprocessing methods
//! (in the library), more generalized expressions can be created.
//!
//! The produced expressions are [Perl-compatible regular expressions](https://www.pcre.org)
//! which are also compatible with the regular expression parser in Rust's
//! [*regex crate*](https://crates.io/crates/regex).
//! Other regular expression parsers or respective libraries from other programming languages
//! have not been tested so far, but they ought to be mostly compatible as well.
//!
//! ## 2. Do I still need to learn to write regexes then?
//!
//! **Definitely, yes!** Using the standard settings, *grex* produces a regular expression that
//! is guaranteed to match only the test cases given as input and nothing else. This has been
//! verified by [property tests](https://github.com/pemistahl/grex/blob/main/tests/property_tests.rs).
//! However, if the conversion to shorthand character classes such as `\w` is enabled, the
//! resulting regex matches a much wider scope of test cases. Knowledge about the consequences of
//! this conversion is essential for finding a correct regular expression for your business domain.
//!
//! *grex* uses an algorithm that tries to find the shortest possible regex for the given test cases.
//! Very often though, the resulting expression is still longer or more complex than it needs to be.
//! In such cases, a more compact or elegant regex can be created only by hand.
//! Also, every regular expression engine has different built-in optimizations.
//! *grex* does not know anything about those and therefore cannot optimize its regexes
//! for a specific engine.
//!
//! **So, please learn how to write regular expressions!** The currently best use case for *grex*
//! is to find an initial correct regex which should be inspected by hand if further optimizations
//! are possible.
//!
//! ## 3. Current features
//!
//! - literals
//! - character classes
//! - detection of common prefixes and suffixes
//! - detection of repeated substrings and conversion to `{min,max}` quantifier notation
//! - alternation using `|` operator
//! - optionality using `?` quantifier
//! - escaping of non-ascii characters, with optional conversion of astral code points to surrogate pairs
//! - case-sensitive or case-insensitive matching
//! - capturing or non-capturing groups
//! - optional anchors `^` and `$`
//! - fully compliant to [Unicode Standard 15.0](https://unicode.org/versions/Unicode15.0.0)
//! - fully compatible with [*regex* crate 1.9.0+](https://crates.io/crates/regex)
//! - correctly handles graphemes consisting of multiple Unicode symbols
//! - reads input strings from the command-line or from a file
//! - produces more readable expressions indented on multiple using optional verbose mode
//!
//! ## 4. How to use?
//!
//! The code snippets below show how to use the public api.
//!
//! For [more detailed examples](https://github.com/pemistahl/grex/tree/main#53-examples), please
//! take a look at the project's readme file on GitHub.
//!
//! ### 4.1 Default settings
//!
//! Test cases are passed either from a collection via [`RegExpBuilder::from()`]
//! or from a file via [`RegExpBuilder::from_file()`].
//!
//! ```
//! use grex::RegExpBuilder;
//!
//! let regexp = RegExpBuilder::from(&["a", "aa", "aaa"]).build();
//! assert_eq!(regexp, "^a(?:aa?)?$");
//! ```
//!
//! ### 4.2 Convert to character classes
//!
//! ```
//! use grex::RegExpBuilder;
//!
//! let regexp = RegExpBuilder::from(&["a", "aa", "123"])
//!     .with_conversion_of_digits()
//!     .with_conversion_of_words()
//!     .build();
//! assert_eq!(regexp, "^(?:\\d\\d\\d|\\w(?:\\w)?)$");
//! ```
//!
//! ### 4.3 Convert repeated substrings
//!
//! ```
//! use grex::RegExpBuilder;
//!
//! let regexp = RegExpBuilder::from(&["aa", "bcbc", "defdefdef"])
//!     .with_conversion_of_repetitions()
//!     .build();
//! assert_eq!(regexp, "^(?:a{2}|(?:bc){2}|(?:def){3})$");
//! ```
//!
//! By default, *grex* converts each substring this way which is at least a single character long
//! and which is subsequently repeated at least once. You can customize these two parameters
//! if you like.
//!
//! In the following example, the test case `aa` is not converted to `a{2}` because the repeated
//! substring `a` has a length of 1, but the minimum substring length has been set to 2.
//!
//! ```
//! use grex::RegExpBuilder;
//!
//! let regexp = RegExpBuilder::from(&["aa", "bcbc", "defdefdef"])
//!     .with_conversion_of_repetitions()
//!     .with_minimum_substring_length(2)
//!     .build();
//! assert_eq!(regexp, "^(?:aa|(?:bc){2}|(?:def){3})$");
//! ```
//!
//! Setting a minimum number of 2 repetitions in the next example, only the test case `defdefdef`
//! will be converted because it is the only one that is repeated twice.
//!
//! ```
//! use grex::RegExpBuilder;
//!
//! let regexp = RegExpBuilder::from(&["aa", "bcbc", "defdefdef"])
//!     .with_conversion_of_repetitions()
//!     .with_minimum_repetitions(2)
//!     .build();
//! assert_eq!(regexp, "^(?:bcbc|aa|(?:def){3})$");
//! ```
//!
//! ### 4.4 Escape non-ascii characters
//!
//! ```
//! use grex::RegExpBuilder;
//!
//! let regexp = RegExpBuilder::from(&["You smell like 💩."])
//!     .with_escaping_of_non_ascii_chars(false)
//!     .build();
//! assert_eq!(regexp, "^You smell like \\u{1f4a9}\\.$");
//! ```
//!
//! Old versions of JavaScript do not support unicode escape sequences for
//! the astral code planes (range `U+010000` to `U+10FFFF`). In order to
//! support these symbols in JavaScript regular expressions, the conversion
//! to surrogate pairs is necessary. More information on that matter can be
//! found [here](https://mathiasbynens.be/notes/javascript-unicode).
//!
//! ```
//! use grex::RegExpBuilder;
//!
//! let regexp = RegExpBuilder::from(&["You smell like 💩."])
//!     .with_escaping_of_non_ascii_chars(true)
//!     .build();
//! assert_eq!(regexp, "^You smell like \\u{d83d}\\u{dca9}\\.$");
//! ```
//!
//! ### 4.5 Case-insensitive matching
//!
//! The regular expressions that *grex* generates are case-sensitive by default.
//! Case-insensitive matching can be enabled like so:
//!
//! ```
//! use grex::RegExpBuilder;
//!
//! let regexp = RegExpBuilder::from(&["big", "BIGGER"])
//!     .with_case_insensitive_matching()
//!     .build();
//! assert_eq!(regexp, "(?i)^big(?:ger)?$");
//! ```
//!
//! ### 4.6 Capturing Groups
//!
//! Non-capturing groups are used by default.
//! Extending the previous example, you can switch to capturing groups instead.
//!
//! ```
//! use grex::RegExpBuilder;
//!
//! let regexp = RegExpBuilder::from(&["big", "BIGGER"])
//!     .with_case_insensitive_matching()
//!     .with_capturing_groups()
//!     .build();
//! assert_eq!(regexp, "(?i)^big(ger)?$");
//! ```
//!
//! ### 4.7 Verbose mode
//!
//! If you find the generated regular expression hard to read, you can enable verbose mode.
//! The expression is then put on multiple lines and indented to make it more pleasant to the eyes.
//!
//! ```
//! use grex::RegExpBuilder;
//! use indoc::indoc;
//!
//! let regexp = RegExpBuilder::from(&["a", "b", "bcd"])
//!     .with_verbose_mode()
//!     .build();
//!
//! assert_eq!(regexp, indoc!(
//!     r#"
//!     (?x)
//!     ^
//!       (?:
//!         b
//!         (?:
//!           cd
//!         )?
//!         |
//!         a
//!       )
//!     $"#
//! ));
//! ```
//!
//! ### 4.8 Disable anchors
//!
//! By default, the anchors `^` and `$` are put around every generated regular expression in order
//! to ensure that it matches only the test cases given as input. Often enough, however, it is
//! desired to use the generated pattern as part of a larger one. For this purpose, the anchors
//! can be disabled, either separately or both of them.
//!
//! ```
//! use grex::RegExpBuilder;
//!
//! let regexp = RegExpBuilder::from(&["a", "aa", "aaa"])
//!     .without_anchors()
//!     .build();
//! assert_eq!(regexp, "a(?:aa?)?");
//! ```
//!
//! ### 5. How does it work?
//!
//! 1. A [deterministic finite automaton](https://en.wikipedia.org/wiki/Deterministic_finite_automaton) (DFA)
//!    is created from the input strings.
//!
//! 2. The number of states and transitions between states in the DFA is reduced by applying
//!    [Hopcroft
```

### Core Architecture Module: `src/macros.rs`
```
/*
 * Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

macro_rules! btreeset {
    ( $( $value: expr ),* ) => {{
        let mut set = std::collections::BTreeSet::new();
        $( set.insert($value); )*
        set
    }};
}

```

### Core Architecture Module: `src/main.rs`
```
/*
 * Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#[cfg(not(target_family = "wasm"))]
mod cli {
    use clap::ArgAction;
    use clap::Parser;
    use grex::RegExpBuilder;
    use itertools::Itertools;
    use std::io::{stdin, BufRead, Error, ErrorKind, IsTerminal, Read};
    use std::path::PathBuf;

    #[derive(Parser)]
    #[command(
        author = "© 2019-today Peter M. Stahl <pemistahl@gmail.com>",
        about = "Licensed under the Apache License, Version 2.0\n\
                 Downloadable from https://crates.io/crates/grex\n\
                 Source code at https://github.com/pemistahl/grex\n\n\
                 grex generates regular expressions from user-provided test cases.",
        version,
        override_usage = "grex [OPTIONS] {INPUT...|--file <FILE>}",
        help_template = "{name} {version}\n{author}\n{about}\n\n{usage-heading} {usage}\n\n{all-args}",
        disable_help_flag = true,
        disable_version_flag = true
    )]
    pub(crate) struct Cli {
        // --------------------
        // INPUT
        // --------------------
        /// One or more test cases separated by blank space
        ///
        /// Use a hyphen `-` to read test cases from standard input.
        ///
        /// Conflicts with --file.
        #[arg(
            value_name = "INPUT",
            allow_hyphen_values = true,
            required_unless_present = "file",
            conflicts_with = "file",
            help_heading = "Input",
            display_order = 1
        )]
        input: Vec<String>,

        /// Reads test cases on separate lines from a file.
        ///
        /// Lines may be ended with either a newline `\n` or a carriage return with a line feed `\r\n`.
        /// The final line ending is optional.
        ///
        /// Use a hyphen `-` to read the filename from standard input.
        ///
        /// Conflicts with INPUT...
        #[arg(
            name = "file",
            value_name = "FILE",
            short,
            long,
            required_unless_present = "input",
            help_heading = "Input",
            display_order = 2
        )]
        file_path: Option<PathBuf>,

        // --------------------
        // DIGIT OPTIONS
        // --------------------
        /// Converts any Unicode decimal digit to \d.
        ///
        /// Takes precedence over --words if both are set.
        /// Decimal digits are converted to \d, remaining word characters to \w.
        ///
        /// Takes precedence over --non-spaces if both are set.
        /// Decimal digits are converted to \d, remaining non-space characters to \S.
        #[arg(name = "digits", short, long, help_heading = "Digit Options")]
        is_digit_converted: bool,

        /// Converts any character which is not a Unicode decimal digit to \D.
        ///
        /// Takes precedence over --non-words if both are set.
        /// Non-digits which are also non-word characters are converted to \D.
        ///
        /// Takes precedence over --non-spaces if both are set.
        /// Non-digits which are also non-space characters are converted to \D.
        #[arg(name = "non-digits", short = 'D', long, help_heading = "Digit Options")]
        is_non_digit_converted: bool,

        // --------------------
        // WHITESPACE OPTIONS
        // --------------------
        /// Converts any Unicode whitespace character to \s.
        ///
        /// Takes precedence over --non-digits if both are set.
        /// Whitespace is converted to \s, remaining non-digits to \D.
        ///
        /// Takes precedence over --non-words if both are set.
        /// Whitespace is converted to \s, remaining non-word characters to \W.
        #[arg(name = "spaces", short, long, help_heading = "Whitespace Options")]
        is_space_converted: bool,

        /// Converts any character which is not a Unicode whitespace character to \S
        #[arg(
            name = "non-spaces",
            short = 'S',
            long,
            help_heading = "Whitespace Options"
        )]
        is_non_space_converted: bool,

        // --------------------
        // WORD OPTIONS
        // --------------------
        /// Converts any Unicode word character to \w.
        ///
        /// Takes precedence over --non-digits if both are set.
        /// Word characters are converted to \w, remaining non-digits to \D.
        ///
        /// Takes precedence over --non-spaces if both are set.
        /// Word characters are converted to \w, remaining non-whitespace to \S.
        #[arg(name = "words", short, long, help_heading = "Word Options")]
        is_word_converted: bool,

        /// Converts any character which is not a Unicode word character to \W.
        ///
        /// Takes precedence over --non-spaces if both are set.
        /// Non-word characters which are also non-whitespace are converted to \W.
        #[arg(name = "non-words", short = 'W', long, help_heading = "Word Options")]
        is_non_word_converted: bool,

        // --------------------
        // ESCAPING OPTIONS
        // --------------------
        /// Replaces all non-ASCII characters with unicode escape sequences.
        #[arg(name = "escape", short, long, help_heading = "Escaping Options")]
        is_non_ascii_char_escaped: bool,

        /// Converts astral code points to surrogate pairs if --escape is set.
        #[arg(
            name = "with-surrogates",
            long,
            requires = "escape",
            help_heading = "Escaping Options"
        )]
        is_astral_code_point_converted_to_surrogate: bool,

        // --------------------
        // REPETITION OPTIONS
        // --------------------
        /// Detects repeated non-overlapping substrings and converts them to {min,max} quantifier notation.
        #[arg(
            name = "repetitions",
            short,
            long,
            help_heading = "Repetition Options",
            display_order = 1
        )]
        is_repetition_converted: bool,

        /// Specifies the minimum quantity of substring repetitions to be converted if --repetitions is set.
        #[arg(
            name = "min-repetitions",
            value_name = "QUANTITY",
            long,
            default_value_t = 1,
            value_parser = repetition_options_parser,
            help_heading = "Repetition Options"
        )]
        minimum_repetitions: u32,

        /// Specifies the minimum length a repeated substring must have
        /// in order to be converted if --repetitions is set.
        #[arg(
            name = "min-substring-length",
            value_name = "LENGTH",
            long,
            default_value_t = 1,
            value_parser = repetition_options_parser,
            help_heading = "Repetition Options"
        )]
        minimum_substring_length: u32,

        // --------------------
        // ANCHOR OPTIONS
        // --------------------
        /// Removes the caret anchor `^` from the resulting regular expression.
        ///
        /// By default, the caret anchor is added to every generated regular expression
        /// which guarantees that the expression matches the test cases
        /// given as input only at the start of a string.
        ///
        /// This flag removes the anchor, thereby allowing to match the test cases
        /// also when they do not occur at the start of a string.
        #[arg(name = "no-start-anchor", long, help_heading = "Anchor Options")]
        is_caret_anchor_disabled: bool,

        /// Removes the dollar sign anchor `$` from the resulting regular expression.
        ///
        /// By default, the dollar sign anchor is added to every generated regular expression
        /// which guarantees that the expression matches the test cases given as input
        /// only at the end of a string.
        ///
        /// This flag removes the anchor, thereby allowing to match the test cases
        /// also when they do not occur at the end of a string.
        #[arg(name = "no-end-anchor", long, help_heading = "Anchor Options")]
        is_dollar_sign_anchor_disabled: bool,

        /// Removes the caret and dollar sign anchors from the resulting regular expression.
        ///
        /// By default, anchors are added to every generated regular expression
        /// which guarantees that the expression exactly matches only the test cases given as input
        /// and nothing else.
        ///
        /// This flag removes the anchors, thereby allowing to match the test cases
        /// also when they occur within a larger string that contains other content as well.
        #[arg(name = "no-anchors", long, help_heading = "Anchor Options")]
        are_anchors_disabled: bool,

        // --------------------
        // DISPLAY OPTIONS
        // --------------------
        /// Produces a nicer-looking regular expression in verbose mode.
        #[arg(
            name = "verbose",
            short = 'x',
            long,
            help_heading = "Display Options",
            display_order = 1
        )]
        is_verbose_mode_enabled: bool,

        /// Provides syntax highlighting for the resulting regular expression.
        #[arg(name = "colorize", short, long, help_heading = "Display Options")]
        is_output_colorized: bool,

        // ---------------------
        // MISCELLANEOUS OPTIONS
        // ---------
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #36** (2021-08-19): **Inserting a character breaks repetition detection (sometimes)**
  *Symptoms*: I have been looking for a way to find repeated substrings. I think I can parse grex results to find repetitions, and given that my strings are rather short, I could then compare group contents to find non-contiguous repetitions.  I did some quick tests and I may have chanced upon a problem:  * `grex -dsr -c 'heeelooo world lalala lalala foo foo xalxalxal xalxalxal'`    gives `^he{3}lo{3}\sworld(?:\s(?:la){3}){2}(?:\sfo{2}){2}(?:\s(?:xal){3}){2}$`    * `grex -dsr -c 'heeelooo world lalala lalala foo foo xalxalxal i xalxalxal'`    gives `^he{3}lo{3}\sworld\s(?:(?:la){3}\s){2}(?:fo{2}\s){2}(?:xal){3}\si\s(?:xal){3}$`    * `grex -dsr -c 'heeelooo world lalala k lalala foo foo xalxalxal i xalxalxal'`    gives `^he{3}lo{3}\sworld\slalala\sk\slalala\s(?:fo{2}\s){2}(?:xal){3}\si\s(?:xal){3}$`    In the last probe, neither of the two `lalala` was detected as repetitious when a `k` was inserted, although `xalxalxal` was treated as expected. Any thoughts?
  **Post-Mortem & Fix Analysis**:
  > more minimally:  ```sh grex -dsr -c 'xalxalxal i xalxalxal'      ^(?:xal){3}\si\s(?:xal){3}$ grex -dsr -c 'xalxalxal xalxalxal'        ^xalxalxal\sxalxalxal$ grex -dsr -c 'foo xalxalxal xalxalxal'                           ^fo{2}(?:\s(?:xal){3}){2}$ ```  
  > Thank you @loveencounterflow for the report. I will evaluate this problem some time in the future but I cannot tell you when exactly. I will let you know.
  > I've finally fixed this issue @loveencounterflow. Perhaps you want to try it again yourself. I think it's safe now.

- **Issue #33** (2021-03-29): **Problem install win7  scoop install grex**
  *Symptoms*: Perhaps this is not a GREX error. I decided to inform, since I had to transfer the file to ... \scoop\shims \  ![image](https://user-images.githubusercontent.com/18010682/112845080-21752780-90ad-11eb-89b7-c1a06b560a81.png)   
  **Post-Mortem & Fix Analysis**:
  > I'm sorry @AlexandrDragunkin, that was actually my fault. There is a bug in the GitHub release workflow which I will fix later. I've manually fixed the zip distribution file for Windows now, so please try again installing it using scoop.  Please report if it works. I will then close this issue. Thank you.
  > Boom! ![image](https://user-images.githubusercontent.com/18010682/112850748-f7266880-90b2-11eb-83ae-b7a0e7373340.png)  
  > Does Scoop save the hash value of the previous zip file in some kind of cache? If so, can you perhaps delete this cache somehow? I think it should work then. In case of doubt, please ask the Scoop guys. I don't have a Windows PC for testing and  no other idea at the moment.

- **Issue #22** (2020-04-06): **Problem with common substring detection**
  *Symptoms*: There is a bug in the common substring detection algorithm causing union operations to be applied where optionality expressions would be more appropriate. The resulting regex is not incorrect but more complex than necessary. Examples:  <table> <tr> <td><strong>Test Cases</strong></td> <td><strong>Expected</strong></td> <td><strong>Actual</strong></td> </tr> <tr> <td><code>ac abc</code></td> <td><code>^ab?c$</code></td> <td><code>^a(bc|c)$</code></td> </tr> <tr> <td><code>abc abxyc</code></td> <td><code>^ab(xy)?c$</code></td> <td><code>^ab(xyc|c)$</code></td> </tr> </table> 

- **Issue #12** (2020-02-16): **Input starting with a hyphen results in an error**
  *Symptoms*: As title says:  ``` % grex "- Input starting with a hyphen"  error: Found argument '- ' which wasn't expected, or isn't valid in this context  USAGE:     grex [FLAGS] <INPUT>... --file <FILE>  For more information try --help ```
  **Post-Mortem & Fix Analysis**:
  > Hi @ozgurgunes, thank you for letting me know about this issue.   I've just found out that, strictly speaking, this is not a bug in _grex_ but a configuration issue in the underlying command-line argument parser [_clap_](https://github.com/clap-rs/clap). It disallows leading hyphens in argument values by default which leads to your error. [This setting can be changed](https://docs.rs/clap/latest/clap/enum.AppSettings.html#variant.AllowLeadingHyphen), so it should be easy to solve this problem. I will fix it for the next release.

- **Issue #9** (2020-01-12): **Nondeterministic results for --convert-repetitions**
  *Symptoms*: ```console $ git describe v0.3.1 $ ./target/debug/grex -r "AAAAAA" ^A{6}$ $ ./target/debug/grex -r "AAAAAA" thread 'main' panicked at 'assertion failed: end <= len', <::core::macros::panic macros>:3:10 note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace. $ ./target/debug/grex -r "AAAAAA" thread 'main' panicked at 'assertion failed: end <= len', <::core::macros::panic macros>:3:10 note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace. $ ./target/debug/grex -r "AAAAAA" ^A{6}$ $ ./target/debug/grex -r "AAAAAA" ^(AA){4}A$ $ ./target/debug/grex -r "AAAAAA" ^(AAA){2}$ ```   <details> <summary> backtrace for reference </summary>  ```  ⋊> ~/_/_/grex $ ./target/debug/grex -r "AAAAAA" thread 'main' panicked at 'assertion failed: end <= len', <::core::macros::panic macros>:3:10 stack backtrace:    0: backtrace::backtrace::libunwind::trace              at /cargo/registry/src/github.com-1ecc6299db9ec823/backtrace-0.3.40/src/backtrace/libunwind.rs:88    1: backtrace::backtrace::trace_unsynchronized              at /cargo/registry/src/github.com-1ecc6299db9ec823/backtrace-0.3.40/src/backtrace/mod.rs:66    2: std::sys_common::backtrace::_print_fmt              at src/libstd/sys_common/backtrace.rs:77    3: <std::sys_common::backtrace::_print::DisplayBacktrace as core::fmt::Display>::fmt              at src/libstd/sys_common/backtrace.rs:59    4: core::fmt::write              at src/libcore/fmt/mod.rs:105
  **Post-Mortem & Fix Analysis**:
  > Thanks for your bug report @Mrmaxmeier. It is just in time because I'm currently finishing version 0.3.2 which fixes these problems. Please try the new version. Closed.

- **Issue #5** (2020-01-06): **Character escaping gets confused when the input string contains a unicode-escape symbol itself.**
  *Symptoms*: Examples found by the code in #4:  - `"\u{70f}["` - `"\u{110cd}("`  These are all passed through as-is but that's not valid.  ~~Worth noting that `"\u{110cd}"` and similar get passed through as well, which is a syntactically valid regex but will not match the input string.~~ Nope, that was just me misunderstanding how unicode escapes work.  - `\u{600}*` also is passed through as is, which is syntactically valid but will not match itself.
  **Post-Mortem & Fix Analysis**:
  > Thanks, @christophebiocca. I will deal with these bugs when I write my own property tests.
  > FWIW from looking over the code trying to pin down/fix the problem, it seems the root cause is that `Grapheme`s sometimes contain escaped strings, and sometimes don't, which makes doing the right thing difficult.  A design that would cut down on these kinds of bugs would be to do no escaping until the very final step. A dedicated trait ("ToRegexString") with a single method that takes all of the configuration parameters (`escape` and `with-surrogates`) at that time seems most likely to work.
  > This has been fixed in version 0.3.1. Closed.

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

### Incident Patch 1: `5f803774` (2025-11-14)
**Commit Message**: Try to fix Rust targets on Windows

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -109,7 +109,7 @@ jobs:
 
     strategy:
       matrix:
-        target: [ x86_64, x86, aarch64 ]
+        target: [ x86_64, aarch64 ]
         linux: [ auto, musllinux_1_2 ]
 
     steps:
@@ -138,7 +138,7 @@ jobs:
 
     strategy:
       matrix:
-        target: [ x64, x86 ]
+        target: [ x86_64, aarch64 ]
 
     steps:
       - name: Check out repository
```

---

### Incident Patch 2: `c06fc8b1` (2025-09-12)
**Commit Message**: Fix Clippy warnings

**File**: `src/dfa.rs` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ impl<'a> Dfa<'a> {
         states
     }
 
-    pub(crate) fn outgoing_edges(&self, state: State) -> Edges<Grapheme, Directed> {
+    pub(crate) fn outgoing_edges(&self, state: State) -> Edges<'_, Grapheme, Directed> {
         self.graph.edges_directed(state, Direction::Outgoing)
     }
 
```

**File**: `src/lib.rs` (modified, +4/-4)
```diff
@@ -252,14 +252,14 @@
 //! ### 5. How does it work?
 //!
 //! 1. A [deterministic finite automaton](https://en.wikipedia.org/wiki/Deterministic_finite_automaton) (DFA)
-//! is created from the input strings.
+//!    is created from the input strings.
 //!
 //! 2. The number of states and transitions between states in the DFA is reduced by applying
-//! [Hopcroft's DFA minimization algorithm](https://en.wikipedia.org/wiki/DFA_minimization#Hopcroft.27s_algorithm).
+//!    [Hopcroft's DFA minimization algorithm](https://en.wikipedia.org/wiki/DFA_minimization#Hopcroft.27s_algorithm).
 //!
 //! 3. The minimized DFA is expressed as a system of linear equations which are solved with
-//! [Brzozowski's algebraic method](http://cs.stackexchange.com/questions/2016/how-to-convert-finite-automata-to-regular-expressions#2392),
-//! resulting in the final regular expression.
+//!    [Brzozowski's algebraic method](http://cs.stackexchange.com/questions/2016/how-to-convert-finite-automata-to-regular-expressions#2392),
+//!    resulting in the final regular expression.
 
 #[macro_use]
 mod macros;
```

---

### Incident Patch 3: `f4b33224` (2024-03-15)
**Commit Message**: Allow to build musl linux wheels

**File**: `.github/workflows/release.yml` (modified, +3/-21)
```diff
@@ -110,29 +110,24 @@ jobs:
     strategy:
       matrix:
         target: [ x86_64, x86, aarch64 ]
+        linux: [ auto, musllinux_1_2 ]
 
     steps:
       - name: Check out repository
         uses: actions/checkout@v4
 
-      - name: Set up Python
-        uses: actions/setup-python@v5
-        with:
-          python-version: '3.12'
-          cache: 'pip'
-
       - name: Build wheels
         uses: PyO3/maturin-action@v1
         with:
           target: ${{ matrix.target }}
           args: --release --out dist -i 3.8 3.9 3.10 3.11 3.12 pypy3.8 pypy3.9 pypy3.10
           sccache: 'true'
-          manylinux: auto
+          manylinux: ${{ matrix.linux }}
 
       - name: Upload wheels
         uses: actions/upload-artifact@v4
         with:
-          name: linux-${{ matrix.target }}-wheels
+          name: linux-${{ matrix.linux }}-${{ matrix.target }}-wheels
           path: dist
 
   python-windows-release-build:
@@ -149,13 +144,6 @@ jobs:
       - name: Check out repository
         uses: actions/checkout@v4
 
-      - name: Set up Python
-        uses: actions/setup-python@v5
-        with:
-          python-version: '3.12'
-          architecture: ${{ matrix.target }}
-          cache: 'pip'
-
       - name: Build wheels
         uses: PyO3/maturin-action@v1
         with:
@@ -183,12 +171,6 @@ jobs:
       - name: Check out repository
         uses: actions/checkout@v4
 
-      - name: Set up Python
-        uses: actions/setup-python@v5
-        with:
-          python-version: '3.12'
-          cache: 'pip'
-
       - name: Build wheels
         uses: PyO3/maturin-action@v1
         with:
```

---

### Incident Patch 4: `3c4d5d9c` (2024-03-06)
**Commit Message**: Try to cross-compile for MUSL Linux

**File**: `.cargo/config.toml` (removed, +0/-17)
```diff
@@ -1,17 +0,0 @@
-#
-# Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-# http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-
-[target.aarch64-unknown-linux-gnu]
-linker = "aarch64-linux-gnu-gcc"
```

**File**: `.github/workflows/release.yml` (modified, +14/-21)
```diff
@@ -27,14 +27,13 @@ jobs:
     runs-on: ${{ matrix.os }}
 
     strategy:
-      fail-fast: false
       matrix:
         os: [ubuntu-latest, macos-latest, windows-latest]
         include:
           - os: ubuntu-latest
             name: Rust Release Build on Linux
-            x86_64-target: x86_64-unknown-linux-gnu
-            aarch64-target: aarch64-unknown-linux-gnu
+            x86_64-target: x86_64-unknown-linux-musl
+            aarch64-target: aarch64-unknown-linux-musl
 
           - os: macos-latest
             name: Rust Release Build on MacOS
@@ -50,21 +49,17 @@ jobs:
       - name: Check out repository
         uses: actions/checkout@v4
 
-      - name: Install gcc-aarch64-linux-gnu
-        if: ${{ matrix.os == 'ubuntu-latest' }}
-        run: sudo apt-get install gcc-aarch64-linux-gnu
-
-      - name: Add rustup x86_64 target
-        run: rustup target add ${{ matrix.x86_64-target }}
-
-      - name: Add rustup aarch64 target
-        run: rustup target add ${{ matrix.aarch64-target }}
-
       - name: Build x86_64 target in release mode
-        run: cargo build --release --target ${{ matrix.x86_64-target }} --locked
+        uses: houseabsolute/actions-rust-cross@v0
+        with:
+          target: ${{ matrix.x86_64-target }}
+          args: '--release --locked'
 
       - name: Build aarch64 target in release mode
-        run: cargo build --release --target ${{ matrix.aarch64-target }} --locked
+        uses: houseabsolute/actions-rust-cross@v0
+        with:
+          target: ${{ matrix.aarch64-target }}
+          args: '--release --locked'
 
       - name: Get latest release version number
         id: get_version
@@ -102,7 +97,7 @@ jobs:
         with:
           repo_token: ${{ secrets.GITHUB_TOKEN }}
           tag: ${{ github.ref }}
-          release_name: grex ${{ steps.get_version.outputs.version }}
+          release_name: grex ${{ steps.get_version.outputs.version-without-v }}
           file_glob: true
           file: target/*/release/grex-${{ steps.get_version.outputs.version }}-*.{zip,tar.gz}
 
@@ -137,7 +132,7 @@ jobs:
       - name: Upload wheels
         uses: actions/upload-artifact@v4
         with:
-          name: wheels
+          name: linux-${{ matrix.target }}-wheels
           path: dist
 
   python-windows-release-build:
@@ -171,7 +166,7 @@ jobs:
       - name: Upload wheels
         uses: actions/upload-artifact@v4
         with:
-          name: wheels
+          name: windows-${{ matrix.target }}-wheels
           path: dist
 
   python-macos-release-build:
@@ -204,7 +199,7 @@ jobs:
       - name: Upload wheels
         uses: actions/upload-artifact@v4
         with:
-          name: wheels
+          name: macos-${{ matrix.target }}-wheels
           path: dist
 
   python-release-upload:
@@ -216,8 +211,6 @@ jobs:
     steps:
       - name: Download wheels from previous jobs
         uses: actions/download-artifact@v4
-        with:
-          name: wheels
 
       - name: Upload to PyPI
         uses: PyO3/maturin-action@v1
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -18,8 +18,8 @@
   [![pypi](https://img.shields.io/badge/PYPI-v1.0.1-blue?logo=PyPI&logoColor=yellow)](https://pypi.org/project/grex)
   [![license](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
 
-  [![Linux 64-bit Download](https://img.shields.io/badge/Linux%2064bit%20Download-v1.4.5-blue?logo=Linux)](https://github.com/pemistahl/grex/releases/download/v1.4.5/grex-v1.4.5-x86_64-unknown-linux-gnu.tar.gz)
-  [![Linux ARM64 Download](https://img.shields.io/badge/Linux%20ARM64%20Download-v1.4.5-blue?logo=Linux)](https://github.com/pemistahl/grex/releases/download/v1.4.5/grex-v1.4.5-aarch64-unknown-linux-gnu.tar.gz)  
+  [![Linux 64-bit Download](https://img.shields.io/badge/Linux%2064bit%20Download-v1.4.5-blue?logo=Linux)](https://github.com/pemistahl/grex/releases/download/v1.4.5/grex-v1.4.5-x86_64-unknown-linux-musl.tar.gz)
+  [![Linux ARM64 Download](https://img.shields.io/badge/Linux%20ARM64%20Download-v1.4.5-blue?logo=Linux)](https://github.com/pemistahl/grex/releases/download/v1.4.5/grex-v1.4.5-aarch64-unknown-linux-musl.tar.gz)  
   
   [![MacOS 64-bit Download](https://img.shields.io/badge/macOS%2064bit%20Download-v1.4.5-blue?logo=Apple)](https://github.com/pemistahl/grex/releases/download/v1.4.5/grex-v1.4.5-x86_64-apple-darwin.tar.gz)
   [![MacOS ARM64 Download](https://img.shields.io/badge/macOS%20ARM64%20Download-v1.4.5-blue?logo=Apple)](https://github.com/pemistahl/grex/releases/download/v1.4.5/grex-v1.4.5-aarch64-apple-darwin.tar.gz)
```

**File**: `RELEASE_NOTES.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-## grex 1.4.5 (released on 05 Mar 2024)
+## grex 1.4.5 (released on 06 Mar 2024)
 
 ### Improvements
 
```

---

### Incident Patch 5: `c2ccc734` (2024-03-05)
**Commit Message**: Try to fix build for ARM64 Linux

**File**: `.cargo/config.toml` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+#
+# Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+# http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either expressed or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+[target.aarch64-unknown-linux-gnu]
+linker = "aarch64-linux-gnu-gcc"
```

**File**: `.github/workflows/release.yml` (modified, +6/-2)
```diff
@@ -33,8 +33,8 @@ jobs:
         include:
           - os: ubuntu-latest
             name: Rust Release Build on Linux
-            x86_64-target: x86_64-unknown-linux-musl
-            aarch64-target: aarch64-unknown-linux-musl
+            x86_64-target: x86_64-unknown-linux-gnu
+            aarch64-target: aarch64-unknown-linux-gnu
 
           - os: macos-latest
             name: Rust Release Build on MacOS
@@ -50,6 +50,10 @@ jobs:
       - name: Check out repository
         uses: actions/checkout@v4
 
+      - name: Install gcc-aarch64-linux-gnu
+        if: ${{ matrix.os == 'ubuntu-latest' }}
+        run: sudo apt-get install gcc-aarch64-linux-gnu
+
       - name: Add rustup x86_64 target
         run: rustup target add ${{ matrix.x86_64-target }}
 
```

**File**: `.github/workflows/rust-build.yml` (modified, +0/-4)
```diff
@@ -67,10 +67,6 @@ jobs:
       - name: Add rustup target
         run: rustup target add ${{ matrix.target }}
 
-      - name: Install MUSL tools for Linux
-        if: ${{ matrix.os == 'ubuntu-latest' }}
-        run: sudo apt-get install musl-tools libssl-dev
-
       - name: Store or retrieve cargo caches
         uses: actions/cache@v4
         with:
```

**File**: `Cargo.toml` (modified, +1/-4)
```diff
@@ -1,3 +1,4 @@
+#
 # Copyright © 2019-today Peter M. Stahl pemistahl@gmail.com
 #
 # Licensed under the Apache License, Version 2.0 (the "License");
@@ -62,10 +63,6 @@ tempfile = "3.10.1"
 [target.'cfg(target_family = "wasm")'.dev-dependencies]
 wasm-bindgen-test = "0.3.42"
 
-[target.aarch64-unknown-linux-musl]
-linker = "aarch64-linux-gnu-gcc"
-rustflags = ["-C", "target-feature=+crt-static", "-C", "link-arg=-lgcc"]
-
 [features]
 default = ["cli"]
 cli = ["clap"]
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -18,8 +18,8 @@
   [![pypi](https://img.shields.io/badge/PYPI-v1.0.1-blue?logo=PyPI&logoColor=yellow)](https://pypi.org/project/grex)
   [![license](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
 
-  [![Linux 64-bit Download](https://img.shields.io/badge/Linux%2064bit%20Download-v1.4.5-blue?logo=Linux)](https://github.com/pemistahl/grex/releases/download/v1.4.5/grex-v1.4.5-x86_64-unknown-linux-musl.tar.gz)
-  [![Linux ARM64 Download](https://img.shields.io/badge/Linux%20ARM64%20Download-v1.4.5-blue?logo=Linux)](https://github.com/pemistahl/grex/releases/download/v1.4.5/grex-v1.4.5-aarch64-unknown-linux-musl.tar.gz)  
+  [![Linux 64-bit Download](https://img.shields.io/badge/Linux%2064bit%20Download-v1.4.5-blue?logo=Linux)](https://github.com/pemistahl/grex/releases/download/v1.4.5/grex-v1.4.5-x86_64-unknown-linux-gnu.tar.gz)
+  [![Linux ARM64 Download](https://img.shields.io/badge/Linux%20ARM64%20Download-v1.4.5-blue?logo=Linux)](https://github.com/pemistahl/grex/releases/download/v1.4.5/grex-v1.4.5-aarch64-unknown-linux-gnu.tar.gz)  
   
   [![MacOS 64-bit Download](https://img.shields.io/badge/macOS%2064bit%20Download-v1.4.5-blue?logo=Apple)](https://github.com/pemistahl/grex/releases/download/v1.4.5/grex-v1.4.5-x86_64-apple-darwin.tar.gz)
   [![MacOS ARM64 Download](https://img.shields.io/badge/macOS%20ARM64%20Download-v1.4.5-blue?logo=Apple)](https://github.com/pemistahl/grex/releases/download/v1.4.5/grex-v1.4.5-aarch64-apple-darwin.tar.gz)
```

---

### Incident Patch 6: `e6a9eadf` (2024-02-22)
**Commit Message**: Refactor Rust build workflow

**File**: `.github/workflows/rust-build.yml` (modified, +18/-22)
```diff
@@ -67,26 +67,10 @@ jobs:
       - name: Add rustup target
         run: rustup target add ${{ matrix.target }}
 
-      - name: Install apt packages
+      - name: Install MUSL tools for Linux
         if: ${{ matrix.os == 'ubuntu-latest' }}
         run: sudo apt-get install musl-tools libssl-dev
 
-      # needed to fix file corruption of cache
-      # https://github.com/actions/cache/issues/403
-      - name: Install GNU tar
-        if: ${{ matrix.os == 'macos-latest' }}
-        run: |
-          brew install gnu-tar
-          echo "/usr/local/opt/gnu-tar/libexec/gnubin" >> $GITHUB_PATH
-
-      - name: Install wasm-pack
-        if: ${{ matrix.os == 'macos-latest' }}
-        run: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
-
-      - name: Enable Safari web driver
-        if: ${{ matrix.os == 'macos-latest' }}
-        run: sudo safaridriver --enable
-
       - name: Store or retrieve cargo caches
         uses: actions/cache@v4
         with:
@@ -101,23 +85,35 @@ jobs:
       - name: Build target in debug mode
         run: cargo build --target ${{ matrix.target }} --locked
 
-      - name: Test default target in debug mode
+      - name: Test target in debug mode
         run: cargo test --target ${{ matrix.target }}
 
+  wasm-build:
+    name: WASM Build
+    needs: rust-build
+
+    runs-on: macos-latest
+
+    steps:
+      - name: Check out repository
+        uses: actions/checkout@v4
+
+      - name: Install wasm-pack
+        run: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
+
+      - name: Enable Safari web driver
+        run: sudo safaridriver --enable
+
       - name: Run WASM integration tests on NodeJS
-        if: ${{ matrix.os == 'macos-latest' }}
         run: wasm-pack test --node -- --no-default-features
 
       - name: Run WASM integration tests in Chrome
-        if: ${{ matrix.os == 'macos-latest' }}
         run: wasm-pack test --headless --chrome -- --no-default-features
 
       - name: Run WASM integration tests in Firefox
-        if: ${{ matrix.os == 'macos-latest' }}
         run: wasm-pack test --headless --firefox -- --no-default-features
 
       - name: Run WASM integration tests in Safari
-        if: ${{ matrix.os == 'macos-latest' }}
         run: wasm-pack test --headless --safari -- --no-default-features
 
   coverage-report:
```

---

### Incident Patch 7: `a90ecef6` (2024-02-19)
**Commit Message**: Fix codecov report upload

**File**: `.github/workflows/rust-build.yml` (modified, +5/-1)
```diff
@@ -136,9 +136,13 @@ jobs:
         uses: actions/checkout@v4
 
       - name: Generate coverage report
-        run: cargo +nightly tarpaulin --lib --ignore-config --ignore-panics --ignore-tests --exclude-files src/python.rs src/main.rs src/wasm.rs --verbose --timeout 900 --out xml
+        run: cargo +nightly tarpaulin --ignore-config --ignore-panics --ignore-tests --exclude-files src/python.rs src/main.rs src/wasm.rs --verbose --timeout 900 --out xml
+
+      - name: Workaround for codecov/feedback#263
+        run: git config --global --add safe.directory "$GITHUB_WORKSPACE"
 
       - name: Upload coverage report
         uses: codecov/codecov-action@v4
         with:
           token: ${{ secrets.CODECOV_TOKEN }}
+          fail_ci_if_error: true
```

---

### Incident Patch 8: `8fa4fbcb` (2024-02-08)
**Commit Message**: Fix case-insensitive regex generation for special characters

**File**: `src/regexp.rs` (modified, +16/-3)
```diff
@@ -32,7 +32,7 @@ pub struct RegExp<'a> {
 impl<'a> RegExp<'a> {
     pub(crate) fn from(test_cases: &'a mut Vec<String>, config: &'a RegExpConfig) -> Self {
         if config.is_case_insensitive_matching {
-            Self::convert_to_lowercase(test_cases);
+            Self::convert_for_case_insensitive_matching(test_cases);
         }
         Self::sort(test_cases);
         let grapheme_clusters = Self::grapheme_clusters(test_cases, config);
@@ -68,8 +68,21 @@ impl<'a> RegExp<'a> {
         Self { ast, config }
     }
 
-    fn convert_to_lowercase(test_cases: &mut Vec<String>) {
-        *test_cases = test_cases.iter().map(|it| it.to_lowercase()).collect_vec();
+    fn convert_for_case_insensitive_matching(test_cases: &mut Vec<String>) {
+        // Convert only those test cases to lowercase if
+        // they keep their original number of characters.
+        // Otherwise, "İ" -> "i\u{307}" would not match "İ".
+        *test_cases = test_cases
+            .iter()
+            .map(|it| {
+                let lower_test_case = it.to_lowercase();
+                if lower_test_case.chars().count() == it.chars().count() {
+                    lower_test_case
+                } else {
+                    it.to_string()
+                }
+            })
+            .collect_vec();
     }
 
     fn convert_expr_to_regex(expr: &Expression, config: &RegExpConfig) -> Regex {
```

**File**: `tests/lib_integration_tests.rs` (modified, +9/-0)
```diff
@@ -111,6 +111,7 @@ mod no_conversion {
         }
 
         #[rstest(test_cases, expected_output,
+            case(vec!["İ"], "(?i)^İ$"),
             case(vec!["ABC", "abc", "AbC", "aBc"], "(?i)^abc$"),
             case(vec!["ABC", "zBC", "abc", "AbC", "aBc"], "(?i)^[az]bc$"),
             case(vec!["Ä@Ö€Ü", "ä@ö€ü", "Ä@ö€Ü", "ä@Ö€ü"], "(?i)^ä@ö€ü$"),
@@ -318,6 +319,13 @@ mod no_conversion {
         }
 
         #[rstest(test_cases, expected_output,
+            case(vec!["İ"], indoc!(
+                r#"
+                (?ix)
+                ^
+                  İ
+                $"#
+            )),
             case(vec!["ABC", "abc", "AbC", "aBc"], indoc!(
                 r#"
                 (?ix)
@@ -437,6 +445,7 @@ mod no_conversion {
         }
 
         #[rstest(test_cases, expected_output,
+            case(vec!["İ", "İİ"], "(?i)^İ{1,2}$"),
             case(vec!["AAAAB", "aaaab", "AaAaB", "aAaAB"], "(?i)^a{4}b$"),
             case(vec!["ÄÖÜäöü@Ö€", "äöüÄöÜ@ö€"], "(?i)^(?:äöü){2}@ö€$"),
         )]
```

#### Recent Merged Pull Requests:
- **PR #348** (closed): Bump actions/upload-artifact from 5 to 6 (@dependabot[bot])
- **PR #347** (closed): Bump actions/download-artifact from 6 to 7 (@dependabot[bot])
- **PR #344** (closed): Bump criterion from 0.7.0 to 0.8.0 (@dependabot[bot])
- **PR #342** (2025-11-21): Bump clap from 4.5.51 to 4.5.53 (@dependabot[bot])
- **PR #341** (2025-11-21): Bump actions/checkout from 5 to 6 (@dependabot[bot])
- **PR #340** (closed): Bump clap from 4.5.51 to 4.5.52 (@dependabot[bot])
- **PR #339** (closed): Bump assert_cmd from 2.0.17 to 2.1.1 (@dependabot[bot])
- **PR #338** (closed): Bump clap from 4.5.49 to 4.5.51 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
