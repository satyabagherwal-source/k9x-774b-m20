# Forensic Learning Record (Deep Inspection): crate-ci/typos

> **Canonical Artifact**: `07_PROJECT_LEARNING/crate-ci-typos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/crate-ci/typos](https://github.com/crate-ci/typos))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:49:24.857Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `crate-ci/typos`
- **Description**: Source code spell checker
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 4173 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/varcon-core/src/borrowed.rs`
```
#[derive(Copy, Clone, PartialEq, Eq, Hash, Debug)]
pub struct Cluster {
    pub header: &'static str,
    pub verified: bool,
    pub level: usize,
    pub entries: &'static [Entry],
    pub notes: &'static [&'static str],
}

impl Cluster {
    pub fn into_owned(self) -> crate::Cluster {
        crate::Cluster {
            header: self.header.to_owned(),
            verified: self.verified,
            level: self.level,
            entries: self.entries.iter().map(|s| s.into_owned()).collect(),
            notes: self.notes.iter().map(|s| (*s).to_owned()).collect(),
        }
    }
}

#[derive(Copy, Clone, PartialEq, Eq, Hash, Debug)]
pub struct Entry {
    pub variants: &'static [Variant],
    pub pos: Option<crate::Pos>,
    pub archaic: bool,
    pub description: Option<&'static str>,
    pub note: Option<&'static str>,
    pub comment: Option<&'static str>,
}

impl Entry {
    pub fn into_owned(self) -> crate::Entry {
        crate::Entry {
            variants: self.variants.iter().map(|v| v.into_owned()).collect(),
            pos: self.pos,
            archaic: self.archaic,
            description: self.description.map(|s| s.to_owned()),
            note: self.note.map(|s| s.to_owned()),
            comment: self.comment.map(|s| s.to_owned()),
        }
    }
}

#[derive(Copy, Clone, PartialEq, Eq, Hash, Debug)]
pub struct Variant {
    pub types: &'static [crate::Type],
    pub word: &'static str,
}

impl Variant {
    pub fn into_owned(self) -> crate::Variant {
        crate::Variant {
            types: self.types.to_vec(),
            word: self.word.to_owned(),
        }
    }
}

```

### Core Architecture Module: `crates/varcon-core/src/lib.rs`
```
#![cfg_attr(docsrs, feature(doc_cfg))]
#![warn(clippy::print_stderr)]
#![warn(clippy::print_stdout)]

pub mod borrowed;

#[cfg(feature = "parser")]
mod parser;

#[cfg(feature = "parser")]
pub use crate::parser::ClusterIter;
#[cfg(feature = "parser")]
pub use crate::parser::ParseError;

#[derive(Clone, PartialEq, Eq, Hash, Debug)]
pub struct Cluster {
    pub header: String,
    pub verified: bool,
    pub level: usize,
    pub entries: Vec<Entry>,
    pub notes: Vec<String>,
}

impl Cluster {
    pub fn infer(&mut self) {
        for entry in self.entries.iter_mut() {
            entry.infer();
        }
    }
}

#[derive(Clone, PartialEq, Eq, Hash, Debug)]
pub struct Entry {
    pub variants: Vec<Variant>,
    pub pos: Option<Pos>,
    pub archaic: bool,
    pub description: Option<String>,
    pub note: Option<String>,
    pub comment: Option<String>,
}

impl Entry {
    pub fn infer(&mut self) {
        imply(
            &mut self.variants,
            Category::BritishIse,
            Category::BritishIze,
        );
        imply(&mut self.variants, Category::BritishIze, Category::Canadian);
        imply(
            &mut self.variants,
            Category::BritishIse,
            Category::Australian,
        );
    }
}

fn imply(variants: &mut [Variant], required: Category, missing: Category) {
    let missing_exists = variants
        .iter()
        .any(|v| v.types.iter().any(|t| t.category == missing));
    if missing_exists {
        return;
    }

    for variant in variants.iter_mut() {
        let types: Vec<_> = variant
            .types
            .iter()
            .filter(|t| t.category == required)
            .cloned()
            .map(|mut t| {
                t.category = missing;
                t
            })
            .collect();
        variant.types.extend(types);
    }
}

#[derive(Clone, PartialEq, Eq, Hash, Debug)]
pub struct Variant {
    pub types: Vec<Type>,
    pub word: String,
}

#[derive(Copy, Clone, PartialEq, Eq, Hash, Debug)]
pub struct Type {
    pub category: Category,
    pub tag: Option<Tag>,
    pub num: Option<usize>,
}

#[cfg_attr(feature = "flags", enumflags2::bitflags)]
#[derive(Copy, Clone, PartialEq, Eq, Hash, Debug)]
#[repr(u8)]
pub enum Category {
    American = 0x01,
    BritishIse = 0x02,
    BritishIze = 0x04,
    Canadian = 0x08,
    Australian = 0x10,
    Other = 0x20,
}

#[cfg(feature = "flags")]
pub type CategorySet = enumflags2::BitFlags<Category>;

#[cfg_attr(feature = "flags", enumflags2::bitflags)]
#[derive(Copy, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
#[repr(u8)]
pub enum Tag {
    Eq = 0x01,
    Variant = 0x02,
    Seldom = 0x04,
    Possible = 0x08,
    Improper = 0x10,
}

#[cfg(feature = "flags")]
pub type TagSet = enumflags2::BitFlags<Tag>;

#[cfg_attr(feature = "flags", enumflags2::bitflags)]
#[derive(Copy, Clone, PartialEq, Eq, Hash, Debug)]
#[repr(u8)]
pub enum Pos {
    Noun = 0x01,
    Verb = 0x02,
    Adjective = 0x04,
    Adverb = 0x08,
    AdjectiveOrAdverb = 0x10,
    Interjection = 0x20,
    Preposition = 0x40,
}

#[cfg(feature = "flags")]
pub type PosSet = enumflags2::BitFlags<Pos>;

```

### Core Architecture Module: `crates/varcon-core/src/parser.rs`
```
use winnow::ascii::space1;
use winnow::combinator::alt;
use winnow::combinator::cut_err;
use winnow::combinator::delimited;
use winnow::combinator::opt;
use winnow::combinator::preceded;
use winnow::combinator::terminated;
use winnow::combinator::trace;
use winnow::prelude::*;
use winnow::token::one_of;

use crate::{Category, Cluster, Entry, Pos, Tag, Type, Variant};

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct ClusterIter<'i> {
    input: &'i str,
}

impl<'i> ClusterIter<'i> {
    pub fn new(input: &'i str) -> Self {
        Self { input }
    }
}

impl Iterator for ClusterIter<'_> {
    type Item = Cluster;

    fn next(&mut self) -> Option<Cluster> {
        self.input = self.input.trim_start();
        Cluster::parse_.parse_next(&mut self.input).ok()
    }
}

#[cfg(test)]
mod test_cluster_iter {
    use super::*;

    use snapbox::ToDebug;
    use snapbox::assert_data_eq;
    use snapbox::str;

    #[test]
    fn test_single() {
        let actual = ClusterIter::new(
            "# acknowledgment <verified> (level 35)
A Cv: acknowledgment / Av B C: acknowledgement
A Cv: acknowledgments / Av B C: acknowledgements
A Cv: acknowledgment's / Av B C: acknowledgement's

",
        );
        assert_data_eq!(
            actual.collect::<Vec<_>>().to_debug(),
            str![[r#"
[
    Cluster {
        header: "acknowledgment ",
        verified: true,
        level: 35,
        entries: [
            Entry {
                variants: [
                    Variant {
                        types: [
                            Type {
                                category: American,
                                tag: None,
                                num: None,
                            },
                            Type {
                                category: Canadian,
                                tag: Some(
                                    Variant,
                                ),
                                num: None,
                            },
                        ],
                        word: "acknowledgment",
                    },
                    Variant {
                        types: [
                            Type {
                                category: American,
                                tag: Some(
                                    Variant,
                                ),
                                num: None,
                            },
                            Type {
                                category: BritishIse,
                                tag: None,
                                num: None,
                            },
                            Type {
                                category: Canadian,
                                tag: None,
                                num: None,
                            },
                        ],
                        word: "acknowledgement",
                    },
                ],
                pos: None,
                archaic: false,
                description: None,
                note: None,
                comment: None,
            },
            Entry {
                variants: [
                    Variant {
                        types: [
                            Type {
                                category: American,
                                tag: None,
                                num: None,
                            },
                            Type {
                                category: Canadian,
                                tag: Some(
                                    Variant,
                                ),
                                num: None,
                            },
                        ],
                        word: "acknowledgments",
                    },
                    Variant {
                        types: [
                            Type {
                                category: American,
                                tag: Some(
                                    Variant,
                                ),
                                num: None,
                            },
                            Type {
                                category: BritishIse,
                                tag: None,
                                num: None,
                            },
                            Type {
                                category: Canadian,
                                tag: None,
                                num: None,
                            },
                        ],
                        word: "acknowledgements",
                    },
                ],
                pos: None,
                archaic: false,
                description: None,
                note: None,
                comment: None,
            },
            Entry {
                variants: [
                    Variant {
                        types: [
                            Type {
                                category: American,
                                tag: None,
                                num: None,
                            },
                            Type {
                                category: Canadian,
                                tag: Some(
                                    Variant,
                                ),
                                num: None,
                            },
                        ],
                        word: "acknowledgment's",
                    },
                    Variant {
                        types: [
                            Type {
                                category: American,
                                tag: Some(
                                    Variant,
                                ),
                                num: None,
                            },
                            Type {
                                category: BritishIse,
                                tag: None,
                                num: None,
                            },
                            Type {
                                category: Canadian,
                                tag: None,
                                num: None,
                            },
                        ],
                        word: "acknowledgement's",
                    },
                ],
                pos: None,
                archaic: false,
                description: None,
                note: None,
                comment: None,
            },
        ],
        notes: [],
    },
]

"#]]
        );
    }

    #[test]
    fn test_multiple() {
        let actual = ClusterIter::new(
            "# acknowledgment <verified> (level 35)
A Cv: acknowledgment / Av B C: acknowledgement
A Cv: acknowledgments / Av B C: acknowledgements
A Cv: acknowledgment's / Av B C: acknowledgement's

# acknowledgment <verified> (level 35)
A Cv: acknowledgment / Av B C: acknowledgement
A Cv: acknowledgments / Av B C: acknowledgements
A Cv: acknowledgment's / Av B C: acknowledgement's

",
        );
        assert_data_eq!(
            actual.collect::<Vec<_>>().to_debug(),
            str![[r#"
[
    Cluster {
        header: "acknowledgment ",
        verified: true,
        level: 35,
        entries: [
            Entry {
                variants: [
                    Variant {
                        types: [
                            Type {
                                category: American,
                                tag: None,
                                num: None,
                            },
                            Type {
                                category: Canadian,
                                tag: Some(
                                    Variant,
                                ),
                                num: None,
                            },
                        ],
                        word: "acknowledgment",
                    },
                    Variant {
                        types: [
                            Type {
                                category: American,
                                tag: Some(
                                    Variant,
                                ),
                                num: None,
                            },
                            Type {
                                category: BritishIse,
                                tag: None,
                                num: None,
                            },
                            Type {
                                category: Canadian,
                                tag: None,
                                num: None,
                            },
                        ],
                        word: "acknowledgement",
                    },
                ],
                pos: None,
                archaic: false,
                description: None,
                note: None,
                comment: None,
            },
            Entry {
                variants: [
                    Variant {
                        types: [
                            Type {
                                category: American,
                                tag: None,
                                num: None,
                            },
                            Type {
                                category: Canadian,
                                tag: Some(
                                    Variant,
                                ),
                                num: None,
                            },
                        ],
                        word: "acknowledgments",
                    },
                    Variant {
                        types: [
                            Type {
                                category: American,
                  
```

### Core Architecture Module: `crates/codespell-dict/src/dict_codegen.rs`
```
// This file is @generated crates/codespell-dict/tests/codegen.rs

pub static WORD_DICTIONARY: dictgen::OrderedMap<dictgen::InsensitiveStr<'static>, &[&str]> =
    dictgen::OrderedMap {
        keys: &[
            dictgen::InsensitiveStr::Ascii("1nd"),
            dictgen::InsensitiveStr::Ascii("2rd"),
            dictgen::InsensitiveStr::Ascii("2st"),
            dictgen::InsensitiveStr::Ascii("3nd"),
            dictgen::InsensitiveStr::Ascii("3rt"),
            dictgen::InsensitiveStr::Ascii("3st"),
            dictgen::InsensitiveStr::Ascii("4rd"),
            dictgen::InsensitiveStr::Ascii("__attribyte__"),
            dictgen::InsensitiveStr::Ascii("__cpluspus"),
            dictgen::InsensitiveStr::Ascii("__cpusplus"),
            dictgen::InsensitiveStr::Ascii("a-diaerers"),
            dictgen::InsensitiveStr::Ascii("aaccess"),
            dictgen::InsensitiveStr::Ascii("aaccessibility"),
            dictgen::InsensitiveStr::Ascii("aaccession"),
            dictgen::InsensitiveStr::Ascii("aache"),
            dictgen::InsensitiveStr::Ascii("aack"),
            dictgen::InsensitiveStr::Ascii("aactual"),
            dictgen::InsensitiveStr::Ascii("aactually"),
            dictgen::InsensitiveStr::Ascii("aadd"),
            dictgen::InsensitiveStr::Ascii("aadded"),
            dictgen::InsensitiveStr::Ascii("aadding"),
            dictgen::InsensitiveStr::Ascii("aafter"),
            dictgen::InsensitiveStr::Ascii("aagain"),
            dictgen::InsensitiveStr::Ascii("aaggregation"),
            dictgen::InsensitiveStr::Ascii("aand"),
            dictgen::InsensitiveStr::Ascii("aanother"),
            dictgen::InsensitiveStr::Ascii("aapply"),
            dictgen::InsensitiveStr::Ascii("aaproximate"),
            dictgen::InsensitiveStr::Ascii("aaproximated"),
            dictgen::InsensitiveStr::Ascii("aaproximately"),
            dictgen::InsensitiveStr::Ascii("aaproximates"),
            dictgen::InsensitiveStr::Ascii("aaproximating"),
            dictgen::InsensitiveStr::Ascii("aaproximation"),
            dictgen::InsensitiveStr::Ascii("aaproximations"),
            dictgen::InsensitiveStr::Ascii("aare"),
            dictgen::InsensitiveStr::Ascii("aas"),
            dictgen::InsensitiveStr::Ascii("aassign"),
            dictgen::InsensitiveStr::Ascii("aassignment"),
            dictgen::InsensitiveStr::Ascii("aassignments"),
            dictgen::InsensitiveStr::Ascii("aassociated"),
            dictgen::InsensitiveStr::Ascii("aassumed"),
            dictgen::InsensitiveStr::Ascii("aautomatic"),
            dictgen::InsensitiveStr::Ascii("aautomatically"),
            dictgen::InsensitiveStr::Ascii("abailable"),
            dictgen::InsensitiveStr::Ascii("abanden"),
            dictgen::InsensitiveStr::Ascii("abandenment"),
            dictgen::InsensitiveStr::Ascii("abandining"),
            dictgen::InsensitiveStr::Ascii("abandomnent"),
            dictgen::InsensitiveStr::Ascii("abandond"),
            dictgen::InsensitiveStr::Ascii("abandonde"),
            dictgen::InsensitiveStr::Ascii("abandonded"),
            dictgen::InsensitiveStr::Ascii("abandonding"),
            dictgen::InsensitiveStr::Ascii("abandondment"),
            dictgen::InsensitiveStr::Ascii("abandonds"),
            dictgen::InsensitiveStr::Ascii("abandone"),
            dictgen::InsensitiveStr::Ascii("abandones"),
            dictgen::InsensitiveStr::Ascii("abandonig"),
            dictgen::InsensitiveStr::Ascii("abandonin"),
            dictgen::InsensitiveStr::Ascii("abandonne"),
            dictgen::InsensitiveStr::Ascii("abandonned"),
            dictgen::InsensitiveStr::Ascii("abandonnent"),
            dictgen::InsensitiveStr::Ascii("abandonning"),
            dictgen::InsensitiveStr::Ascii("abanond"),
            dictgen::InsensitiveStr::Ascii("abanonded"),
            dictgen::InsensitiveStr::Ascii("abanonding"),
            dictgen::InsensitiveStr::Ascii("abanondment"),
            dictgen::InsensitiveStr::Ascii("abanonds"),
            dictgen::InsensitiveStr::Ascii("abasin"),
            dictgen::InsensitiveStr::Ascii("abbbreviated"),
            dictgen::InsensitiveStr::Ascii("abberation"),
            dictgen::InsensitiveStr::Ascii("abberations"),
            dictgen::InsensitiveStr::Ascii("abberivate"),
            dictgen::InsensitiveStr::Ascii("abberivated"),
            dictgen::InsensitiveStr::Ascii("abberivates"),
            dictgen::InsensitiveStr::Ascii("abberivation"),
            dictgen::InsensitiveStr::Ascii("abberivations"),
            dictgen::InsensitiveStr::Ascii("abberration"),
            dictgen::InsensitiveStr::Ascii("abberrations"),
            dictgen::InsensitiveStr::Ascii("abberviation"),
            dictgen::InsensitiveStr::Ascii("abberviations"),
            dictgen::InsensitiveStr::Ascii("abbilities"),
            dictgen::InsensitiveStr::Ascii("abbility"),
            dictgen::InsensitiveStr::Ascii("abbort"),
            dictgen::InsensitiveStr::Ascii("abborted"),
            dictgen::InsensitiveStr::Ascii("abborting"),
            dictgen::InsensitiveStr::Ascii("abborts"),
            dictgen::InsensitiveStr::Ascii("abbout"),
            dictgen::InsensitiveStr::Ascii("abbouts"),
            dictgen::InsensitiveStr::Ascii("abbreivate"),
            dictgen::InsensitiveStr::Ascii("abbreivated"),
            dictgen::InsensitiveStr::Ascii("abbreivates"),
            dictgen::InsensitiveStr::Ascii("abbreivating"),
            dictgen::InsensitiveStr::Ascii("abbreivation"),
            dictgen::InsensitiveStr::Ascii("abbreivations"),
            dictgen::InsensitiveStr::Ascii("abbrevate"),
            dictgen::InsensitiveStr::Ascii("abbrevated"),
            dictgen::InsensitiveStr::Ascii("abbrevates"),
            dictgen::InsensitiveStr::Ascii("abbrevating"),
            dictgen::InsensitiveStr::Ascii("abbrevation"),
            dictgen::InsensitiveStr::Ascii("abbrevations"),
            dictgen::InsensitiveStr::Ascii("abbreveation"),
            dictgen::InsensitiveStr::Ascii("abbreveations"),
            dictgen::InsensitiveStr::Ascii("abbreviatin"),
            dictgen::InsensitiveStr::Ascii("abbreviatins"),
            dictgen::InsensitiveStr::Ascii("abbreviato"),
            dictgen::InsensitiveStr::Ascii("abbreviaton"),
            dictgen::InsensitiveStr::Ascii("abbreviatons"),
            dictgen::InsensitiveStr::Ascii("abbrievate"),
            dictgen::InsensitiveStr::Ascii("abbrievated"),
            dictgen::InsensitiveStr::Ascii("abbrievates"),
            dictgen::InsensitiveStr::Ascii("abbrievating"),
            dictgen::InsensitiveStr::Ascii("abbrievation"),
            dictgen::InsensitiveStr::Ascii("abbrievations"),
            dictgen::InsensitiveStr::Ascii("abbriviate"),
            dictgen::InsensitiveStr::Ascii("abbriviated"),
            dictgen::InsensitiveStr::Ascii("abbriviates"),
            dictgen::InsensitiveStr::Ascii("abbriviating"),
            dictgen::InsensitiveStr::Ascii("abbriviation"),
            dictgen::InsensitiveStr::Ascii("abbriviations"),
            dictgen::InsensitiveStr::Ascii("abbrviate"),
            dictgen::InsensitiveStr::Ascii("abbrviated"),
            dictgen::InsensitiveStr::Ascii("abbrviates"),
            dictgen::InsensitiveStr::Ascii("abbrviating"),
            dictgen::InsensitiveStr::Ascii("abbrviation"),
            dictgen::InsensitiveStr::Ascii("abbrviations"),
            dictgen::InsensitiveStr::Ascii("abcense"),
            dictgen::InsensitiveStr::Ascii("abck"),
            dictgen::InsensitiveStr::Ascii("abd"),
            dictgen::InsensitiveStr::Ascii("abdominable"),
            dictgen::InsensitiveStr::Ascii("abdomine"),
            dictgen::InsensitiveStr::Ascii("abdomnial"),
            dictgen::InsensitiveStr::Ascii("abdonimal"),
            dictgen::InsensitiveStr::Ascii("abductin"),
            dictgen::InsensitiveStr::Ascii("aberation"),
            dictgen::InsensitiveStr::Ascii("abigious"),
            dictgen::InsensitiveStr::Ascii("abigiously"),
            dictgen::InsensitiveStr::Ascii("abiguity"),
            dictgen::InsensitiveStr::Ascii("abiguous"),
            dictgen::InsensitiveStr::Ascii("abiguously"),
            dictgen::InsensitiveStr::Ascii("abilites"),
            dictgen::InsensitiveStr::Ascii("abilitiy"),
            dictgen::InsensitiveStr::Ascii("abilityes"),
            dictgen::InsensitiveStr::Ascii("abillities"),
            dictgen::InsensitiveStr::Ascii("abillity"),
            dictgen::InsensitiveStr::Ascii("abilties"),
            dictgen::InsensitiveStr::Ascii("abiltiy"),
            dictgen::InsensitiveStr::Ascii("abilty"),
            dictgen::InsensitiveStr::Ascii("abiove"),
            dictgen::InsensitiveStr::Ascii("abiss"),
            dictgen::InsensitiveStr::Ascii("abitrarily"),
            dictgen::InsensitiveStr::Ascii("abitrary"),
            dictgen::InsensitiveStr::Ascii("abitrate"),
            dictgen::InsensitiveStr::Ascii("abitration"),
            dictgen::InsensitiveStr::Ascii("abiut"),
            dictgen::InsensitiveStr::Ascii("abizmal"),
            dictgen::InsensitiveStr::Ascii("abl"),
            dictgen::InsensitiveStr::Ascii("abliities"),
            dictgen::InsensitiveStr::Ascii("abliity"),
            dictgen::InsensitiveStr::Ascii("ablities"),
            dictgen::InsensitiveStr::Ascii("ablity"),
            dictgen::InsensitiveStr::Ascii("abnd"),
            dictgen::InsensitiveStr::Ascii("abnoramlly"),
            dictgen::InsensitiveStr::Ascii("abnormalty"),
            dictgen::InsensitiveStr::Ascii("abnormaly"),
            dictgen::InsensitiveStr::Ascii("abnornally"),
            dictgen::InsensitiveStr::Ascii("abnove"),
            dictgen::InsensitiveStr::Ascii("abnrormal"),
            dictgen::InsensitiveStr::Ascii("aboce"),
            dictgen::InsensitiveStr::Ascii("abodmen"),
            dictgen::InsensitiveStr::Ascii("abodminal"),
            dictgen::InsensitiveStr::Ascii("aboiut"),
            dictgen::InsensitiveStr::Ascii
```

### Core Architecture Module: `crates/codespell-dict/src/lib.rs`
```
#![cfg_attr(docsrs, feature(doc_cfg))]
#![warn(clippy::print_stderr)]
#![warn(clippy::print_stdout)]

mod dict_codegen;

pub use crate::dict_codegen::*;

```

### Core Architecture Module: `crates/dictgen/src/aho_corasick.rs`
```
pub use ::aho_corasick::Anchored;
pub use ::aho_corasick::Input;
pub use ::aho_corasick::MatchKind;
pub use ::aho_corasick::StartKind;
pub use ::aho_corasick::automaton::Automaton;
pub use ::aho_corasick::dfa::Builder;
pub use ::aho_corasick::dfa::DFA;

#[cfg(feature = "codegen")]
pub struct AhoCorasickGen<'g> {
    pub(crate) r#gen: crate::DictGen<'g>,
}

#[cfg(feature = "codegen")]
impl AhoCorasickGen<'_> {
    pub fn write<W: std::io::Write, V: std::fmt::Display>(
        &self,
        file: &mut W,
        data: impl Iterator<Item = (impl AsRef<str>, V)>,
    ) -> Result<(), std::io::Error> {
        let mut data: Vec<_> = data.collect();
        data.sort_unstable_by_key(|v| unicase::UniCase::new(v.0.as_ref().to_owned()));

        let name = self.r#gen.name;
        let value_type = self.r#gen.value_type;

        writeln!(file, "pub struct {name} {{")?;
        writeln!(file, "    dfa: dictgen::aho_corasick::DFA,")?;
        writeln!(
            file,
            "    unicode: &'static dictgen::OrderedMap<dictgen::InsensitiveStr<'static>, {value_type}>,"
        )?;
        writeln!(file, "}}")?;
        writeln!(file)?;
        writeln!(file, "impl {name} {{")?;
        writeln!(file, "    pub fn new() -> Self {{")?;
        writeln!(
            file,
            "        static NEEDLES: &'static [&'static [u8]] = &["
        )?;
        for (key, _value) in data.iter().filter(|(k, _)| k.as_ref().is_ascii()) {
            let key = key.as_ref();
            writeln!(file, "            b{key:?},")?;
        }
        writeln!(file, "        ];")?;
        writeln!(
            file,
            "        let dfa = dictgen::aho_corasick::Builder::new()"
        )?;
        writeln!(
            file,
            "            .match_kind(dictgen::aho_corasick::MatchKind::LeftmostLongest)"
        )?;
        writeln!(
            file,
            "            .start_kind(dictgen::aho_corasick::StartKind::Anchored)"
        )?;
        writeln!(file, "            .ascii_case_insensitive(true)")?;
        writeln!(file, "            .build(NEEDLES)")?;
        writeln!(file, "            .unwrap();")?;
        crate::DictGen::new()
            .name("UNICODE_TABLE")
            .value_type(value_type)
            .ordered_map()
            .write(
                file,
                data.iter()
                    .filter(|(k, _)| !k.as_ref().is_ascii())
                    .map(|(k, v)| (k.as_ref(), v)),
            )?;
        writeln!(file)?;
        writeln!(file, "        Self {{")?;
        writeln!(file, "            dfa,")?;
        writeln!(file, "            unicode: &UNICODE_TABLE,")?;
        writeln!(file, "        }}")?;
        writeln!(file, "    }}")?;
        writeln!(file)?;
        writeln!(
            file,
            "    pub fn find(&self, word: &'_ unicase::UniCase<&str>) -> Option<&'static {value_type}> {{"
        )?;
        writeln!(
            file,
            "        static PATTERNID_MAP: &'static [{value_type}] = &["
        )?;
        for (_key, value) in data.iter().filter(|(k, _)| k.as_ref().is_ascii()) {
            writeln!(file, "            {value},")?;
        }
        writeln!(file, "        ];")?;
        writeln!(file, "        if word.is_ascii() {{")?;
        writeln!(
            file,
            "            use dictgen::aho_corasick::Automaton as _;"
        )?;
        writeln!(
            file,
            "            let input = dictgen::aho_corasick::Input::new(word.into_inner().as_bytes()).anchored(dictgen::aho_corasick::Anchored::Yes);"
        )?;
        writeln!(
            file,
            "            let mat = self.dfa.try_find(&input).unwrap()?;"
        )?;
        writeln!(
            file,
            "            if mat.end() == word.into_inner().len() {{"
        )?;
        writeln!(file, "                return None;")?;
        writeln!(file, "            }}")?;
        writeln!(file, "            Some(&PATTERNID_MAP[mat.pattern()])")?;
        writeln!(file, "        }} else {{")?;
        writeln!(file, "            self.unicode.find(word)")?;
        writeln!(file, "        }}")?;
        writeln!(file, "    }}")?;
        writeln!(file, "}}")?;

        Ok(())
    }
}

```

### Core Architecture Module: `crates/dictgen/src/gen.rs`
```
#[cfg(feature = "codegen")]
pub struct DictGen<'g> {
    pub(crate) name: &'g str,
    pub(crate) value_type: &'g str,
}

impl DictGen<'static> {
    pub fn new() -> Self {
        Self {
            name: "DICT",
            value_type: "&'static str",
        }
    }
}

impl<'g> DictGen<'g> {
    pub fn name<'n>(self, name: &'n str) -> DictGen<'n>
    where
        'g: 'n,
    {
        DictGen {
            name,
            value_type: self.value_type,
        }
    }

    pub fn value_type<'t>(self, value_type: &'t str) -> DictGen<'t>
    where
        'g: 't,
    {
        DictGen {
            name: self.name,
            value_type,
        }
    }

    #[cfg(feature = "map")]
    pub fn map(self) -> crate::MapGen<'g> {
        crate::MapGen {
            r#gen: self,
            unicode: true,
            unicase: true,
        }
    }

    pub fn ordered_map(self) -> crate::OrderedMapGen<'g> {
        crate::OrderedMapGen {
            r#gen: self,
            unicode: true,
            unicase: true,
        }
    }

    pub fn trie(self) -> crate::TrieGen<'g> {
        crate::TrieGen {
            r#gen: self,
            limit: 64,
        }
    }

    pub fn r#match(self) -> crate::MatchGen<'g> {
        crate::MatchGen { r#gen: self }
    }

    #[cfg(feature = "aho-corasick")]
    pub fn aho_corasick(self) -> crate::AhoCorasickGen<'g> {
        crate::AhoCorasickGen { r#gen: self }
    }
}

impl Default for DictGen<'static> {
    fn default() -> Self {
        Self::new()
    }
}

```

### Core Architecture Module: `crates/dictgen/src/insensitive.rs`
```
/// `UniCase` look-alike that avoids const-fn so large tables don't OOM
#[derive(Copy, Clone)]
pub enum InsensitiveStr<'s> {
    Unicode(&'s str),
    Ascii(&'s str),
}

impl<'s> InsensitiveStr<'s> {
    pub fn convert(self) -> unicase::UniCase<&'s str> {
        match self {
            InsensitiveStr::Unicode(s) => unicase::UniCase::unicode(s),
            InsensitiveStr::Ascii(s) => unicase::UniCase::ascii(s),
        }
    }

    pub fn into_inner(self) -> &'s str {
        match self {
            InsensitiveStr::Unicode(s) | InsensitiveStr::Ascii(s) => s,
        }
    }

    pub fn is_empty(self) -> bool {
        match self {
            InsensitiveStr::Unicode(s) | InsensitiveStr::Ascii(s) => s.is_empty(),
        }
    }

    pub fn len(self) -> usize {
        match self {
            InsensitiveStr::Unicode(s) | InsensitiveStr::Ascii(s) => s.len(),
        }
    }
}

impl<'s> From<unicase::UniCase<&'s str>> for InsensitiveStr<'s> {
    fn from(other: unicase::UniCase<&'s str>) -> Self {
        if other.is_ascii() {
            InsensitiveStr::Ascii(other.into_inner())
        } else {
            InsensitiveStr::Unicode(other.into_inner())
        }
    }
}

impl<'s2> PartialEq<InsensitiveStr<'s2>> for InsensitiveStr<'_> {
    #[inline]
    fn eq(&self, other: &InsensitiveStr<'s2>) -> bool {
        self.convert() == other.convert()
    }
}

impl Eq for InsensitiveStr<'_> {}

impl PartialOrd for InsensitiveStr<'_> {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for InsensitiveStr<'_> {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.convert().cmp(&other.convert())
    }
}

impl core::hash::Hash for InsensitiveStr<'_> {
    #[inline]
    fn hash<H: core::hash::Hasher>(&self, hasher: &mut H) {
        self.convert().hash(hasher);
    }
}

impl core::fmt::Debug for InsensitiveStr<'_> {
    #[inline]
    fn fmt(&self, fmt: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        core::fmt::Debug::fmt(self.into_inner(), fmt)
    }
}

impl core::fmt::Display for InsensitiveStr<'_> {
    #[inline]
    fn fmt(&self, fmt: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        core::fmt::Display::fmt(self.into_inner(), fmt)
    }
}

#[cfg(feature = "map")]
impl phf_shared::PhfHash for InsensitiveStr<'_> {
    #[inline]
    fn phf_hash<H: core::hash::Hasher>(&self, state: &mut H) {
        core::hash::Hash::hash(self, state);
    }
}

#[cfg(feature = "map")]
impl phf_shared::FmtConst for InsensitiveStr<'_> {
    fn fmt_const(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            InsensitiveStr::Ascii(_) => f.write_str("dictgen::InsensitiveStr::Ascii(")?,
            InsensitiveStr::Unicode(_) => {
                f.write_str("dictgen::InsensitiveStr::Unicode(")?;
            }
        }

        self.into_inner().fmt_const(f)?;
        f.write_str(")")
    }
}

#[cfg(feature = "map")]
impl<'b, 'a: 'b> phf_shared::PhfBorrow<InsensitiveStr<'b>> for InsensitiveStr<'a> {
    fn borrow(&self) -> &InsensitiveStr<'b> {
        self
    }
}

/// `UniCase` look-alike that avoids const-fn so large tables don't OOM
#[derive(Copy, Clone)]
pub struct InsensitiveAscii<'s>(pub &'s str);

impl<'s> InsensitiveAscii<'s> {
    pub fn convert(self) -> unicase::Ascii<&'s str> {
        unicase::Ascii::new(self.0)
    }

    pub fn into_inner(self) -> &'s str {
        self.0
    }

    pub fn is_empty(self) -> bool {
        self.0.is_empty()
    }

    pub fn len(self) -> usize {
        self.0.len()
    }
}

impl<'s> From<unicase::Ascii<&'s str>> for InsensitiveAscii<'s> {
    fn from(other: unicase::Ascii<&'s str>) -> Self {
        Self(other.into_inner())
    }
}

impl<'s2> PartialEq<InsensitiveAscii<'s2>> for InsensitiveAscii<'_> {
    #[inline]
    fn eq(&self, other: &InsensitiveAscii<'s2>) -> bool {
        self.convert() == other.convert()
    }
}

impl Eq for InsensitiveAscii<'_> {}

impl PartialOrd for InsensitiveAscii<'_> {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for InsensitiveAscii<'_> {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.convert().cmp(&other.convert())
    }
}

impl core::hash::Hash for InsensitiveAscii<'_> {
    #[inline]
    fn hash<H: core::hash::Hasher>(&self, hasher: &mut H) {
        self.convert().hash(hasher);
    }
}

impl core::fmt::Debug for InsensitiveAscii<'_> {
    #[inline]
    fn fmt(&self, fmt: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        core::fmt::Debug::fmt(self.into_inner(), fmt)
    }
}

impl core::fmt::Display for InsensitiveAscii<'_> {
    #[inline]
    fn fmt(&self, fmt: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        core::fmt::Display::fmt(self.into_inner(), fmt)
    }
}

#[cfg(feature = "map")]
impl phf_shared::PhfHash for InsensitiveAscii<'_> {
    #[inline]
    fn phf_hash<H: core::hash::Hasher>(&self, state: &mut H) {
        core::hash::Hash::hash(self, state);
    }
}

#[cfg(feature = "map")]
impl phf_shared::FmtConst for InsensitiveAscii<'_> {
    fn fmt_const(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("dictgen::InsensitiveAscii(")?;
        self.into_inner().fmt_const(f)?;
        f.write_str(")")
    }
}

#[cfg(feature = "map")]
impl<'b, 'a: 'b> phf_shared::PhfBorrow<InsensitiveAscii<'b>> for InsensitiveAscii<'a> {
    fn borrow(&self) -> &InsensitiveAscii<'b> {
        self
    }
}

```

### Core Architecture Module: `crates/dictgen/src/lib.rs`
```
#![cfg_attr(docsrs, feature(doc_cfg))]
#![warn(clippy::print_stderr)]
#![warn(clippy::print_stdout)]

#[cfg(feature = "aho-corasick")]
pub mod aho_corasick;
#[cfg(feature = "codegen")]
mod r#gen;
mod insensitive;
#[cfg(feature = "map")]
mod map;
#[cfg(feature = "codegen")]
mod r#match;
mod ordered_map;
mod trie;

#[cfg(feature = "aho-corasick")]
#[cfg(feature = "codegen")]
pub use aho_corasick::AhoCorasickGen;
#[cfg(feature = "codegen")]
pub use r#gen::*;
pub use insensitive::*;
#[cfg(feature = "map")]
pub use map::*;
#[cfg(feature = "codegen")]
pub use r#match::*;
pub use ordered_map::*;
pub use trie::*;

```

### Core Architecture Module: `crates/dictgen/src/map.rs`
```
#[cfg(feature = "codegen")]
pub struct MapGen<'g> {
    pub(crate) r#gen: crate::DictGen<'g>,
    pub(crate) unicase: bool,
    pub(crate) unicode: bool,
}

#[cfg(feature = "codegen")]
impl MapGen<'_> {
    pub fn unicase(mut self, yes: bool) -> Self {
        self.unicase = yes;
        self
    }

    pub fn unicode(mut self, yes: bool) -> Self {
        self.unicode = yes;
        self
    }

    pub fn write<W: std::io::Write, V: std::fmt::Display>(
        &self,
        file: &mut W,
        data: impl Iterator<Item = (impl AsRef<str>, V)>,
    ) -> Result<(), std::io::Error> {
        let mut data: Vec<_> = data.collect();
        data.sort_unstable_by_key(|v| unicase::UniCase::new(v.0.as_ref().to_owned()));

        let name = self.r#gen.name;
        let key_type = self.key_type();
        let value_type = self.r#gen.value_type;

        let mut smallest = usize::MAX;
        let mut largest = usize::MIN;
        for (key, _) in data.iter() {
            let key = key.as_ref();
            smallest = std::cmp::min(smallest, key.len());
            largest = std::cmp::max(largest, key.len());
        }
        if largest == 0 {
            smallest = 0;
        }

        writeln!(
            file,
            "pub static {name}: dictgen::Map<{key_type}, {value_type}> = dictgen::Map {{"
        )?;

        match (self.unicase, self.unicode) {
            (true, true) => {
                let mut builder = phf_codegen::Map::new();
                let data = data
                    .iter()
                    .map(|(key, value)| {
                        let key = key.as_ref();
                        (
                            if key.is_ascii() {
                                crate::InsensitiveStr::Ascii(key)
                            } else {
                                crate::InsensitiveStr::Unicode(key)
                            },
                            value.to_string(),
                        )
                    })
                    .collect::<Vec<_>>();
                for (key, value) in data.iter() {
                    builder.entry(key, value.as_str());
                }
                let builder = builder.build();
                writeln!(file, "    map: {builder},")?;
            }
            (true, false) => {
                let mut builder = phf_codegen::Map::new();
                let data = data
                    .iter()
                    .map(|(key, value)| (crate::InsensitiveAscii(key.as_ref()), value.to_string()))
                    .collect::<Vec<_>>();
                for (key, value) in data.iter() {
                    builder.entry(key, value.as_str());
                }
                let builder = builder.build();
                writeln!(file, "    map: {builder},")?;
            }
            (false, _) => {
                let mut builder = phf_codegen::Map::new();
                let data = data
                    .iter()
                    .map(|(key, value)| (key, value.to_string()))
                    .collect::<Vec<_>>();
                for (key, value) in data.iter() {
                    builder.entry(key.as_ref(), value.as_str());
                }
                let builder = builder.build();
                writeln!(file, "    map: {builder},")?;
            }
        }

        writeln!(file, "    range: {smallest}..={largest},")?;
        writeln!(file, "}};")?;

        Ok(())
    }

    fn key_type(&self) -> &'static str {
        match (self.unicase, self.unicode) {
            (true, true) => "dictgen::InsensitiveStr<'static>",
            (true, false) => "dictgen::InsensitiveAscii<'static>",
            (false, _) => "&'static str",
        }
    }
}

pub struct Map<K: 'static, V: 'static> {
    pub map: phf::Map<K, V>,
    pub range: std::ops::RangeInclusive<usize>,
}

impl<V> Map<crate::InsensitiveStr<'_>, V> {
    #[inline]
    pub fn find(&self, word: &'_ unicase::UniCase<&str>) -> Option<&V> {
        if self.range.contains(&word.len()) {
            self.map.get(&(*word).into())
        } else {
            None
        }
    }
}

impl<V> Map<crate::InsensitiveAscii<'_>, V> {
    #[inline]
    pub fn find(&self, word: &'_ unicase::Ascii<&str>) -> Option<&V> {
        if self.range.contains(&word.len()) {
            self.map.get(&(*word).into())
        } else {
            None
        }
    }
}

impl<V> Map<&str, V> {
    #[inline]
    pub fn find(&self, word: &'_ &str) -> Option<&V> {
        if self.range.contains(&word.len()) {
            self.map.get(word)
        } else {
            None
        }
    }
}

```

### Core Architecture Module: `crates/dictgen/src/match.rs`
```
#[cfg(feature = "codegen")]
pub struct MatchGen<'g> {
    pub(crate) r#gen: crate::DictGen<'g>,
}

#[cfg(feature = "codegen")]
impl MatchGen<'_> {
    pub fn write<W: std::io::Write, V: std::fmt::Display>(
        &self,
        file: &mut W,
        data: impl Iterator<Item = (impl AsRef<str>, V)>,
    ) -> Result<(), std::io::Error> {
        let mut data: Vec<_> = data.collect();
        data.sort_unstable_by_key(|v| unicase::UniCase::new(v.0.as_ref().to_owned()));

        let name = self.r#gen.name;
        let value_type = self.r#gen.value_type;

        writeln!(file, "pub struct {name};")?;
        writeln!(file, "impl {name} {{")?;
        writeln!(
            file,
            "    pub fn find(&self, word: &&str) -> Option<&'static {value_type}> {{"
        )?;
        writeln!(file, "        match *word {{")?;
        for (key, value) in data.iter() {
            let key = key.as_ref();
            writeln!(file, "            {key:?} => Some(&{value}.as_slice()),")?;
        }
        writeln!(file, "            _ => None,")?;
        writeln!(file, "        }}")?;
        writeln!(file, "    }}")?;
        writeln!(file, "}}")?;

        Ok(())
    }
}

```

### Core Architecture Module: `crates/dictgen/src/ordered_map.rs`
```
#[cfg(feature = "codegen")]
pub struct OrderedMapGen<'g> {
    pub(crate) r#gen: crate::DictGen<'g>,
    pub(crate) unicase: bool,
    pub(crate) unicode: bool,
}

#[cfg(feature = "codegen")]
impl OrderedMapGen<'_> {
    pub fn unicase(mut self, yes: bool) -> Self {
        self.unicase = yes;
        self
    }

    pub fn unicode(mut self, yes: bool) -> Self {
        self.unicode = yes;
        self
    }

    pub fn write<W: std::io::Write, V: std::fmt::Display>(
        &self,
        file: &mut W,
        data: impl Iterator<Item = (impl AsRef<str>, V)>,
    ) -> Result<(), std::io::Error> {
        let mut data: Vec<_> = data.collect();
        data.sort_unstable_by_key(|v| unicase::UniCase::new(v.0.as_ref().to_owned()));

        let name = self.r#gen.name;
        let key_type = self.key_type();
        let value_type = self.r#gen.value_type;

        let mut smallest = usize::MAX;
        let mut largest = usize::MIN;

        writeln!(
            file,
            "pub static {name}: dictgen::OrderedMap<{key_type}, {value_type}> = dictgen::OrderedMap {{"
        )?;
        writeln!(file, "    keys: &[")?;
        for (key, _value) in data.iter() {
            let key = key.as_ref();
            smallest = std::cmp::min(smallest, key.len());
            largest = std::cmp::max(largest, key.len());

            let key = self.key_new(key);

            writeln!(file, "      {key},")?;
        }
        if largest == 0 {
            smallest = 0;
        }
        writeln!(file, "    ],")?;
        writeln!(file, "    values: &[")?;
        for (_key, value) in data.iter() {
            writeln!(file, "      {value},")?;
        }
        writeln!(file, "    ],")?;
        writeln!(file, "    range: {smallest}..={largest},")?;
        writeln!(file, "}};")?;

        Ok(())
    }

    fn key_type(&self) -> &'static str {
        match (self.unicase, self.unicode) {
            (true, true) => "dictgen::InsensitiveStr<'static>",
            (true, false) => "dictgen::InsensitiveAscii<'static>",
            (false, _) => "&'static str",
        }
    }

    fn key_new(&self, key: &str) -> String {
        match (self.unicase, self.unicode) {
            (true, true) => {
                if key.is_ascii() {
                    format!("dictgen::InsensitiveStr::Ascii({key:?})")
                } else {
                    format!("dictgen::InsensitiveStr::Unicode({key:?})")
                }
            }
            (true, false) => format!("dictgen::InsensitiveAscii({key:?})"),
            (false, _) => format!("{key:?}"),
        }
    }
}

pub struct OrderedMap<K: 'static, V: 'static> {
    pub keys: &'static [K],
    pub values: &'static [V],
    pub range: core::ops::RangeInclusive<usize>,
}

impl<V> OrderedMap<crate::InsensitiveStr<'_>, V> {
    #[inline]
    pub fn find(&self, word: &'_ unicase::UniCase<&str>) -> Option<&'static V> {
        if self.range.contains(&word.len()) {
            self.keys
                .binary_search_by_key(word, |key| key.convert())
                .map(|i| &self.values[i])
                .ok()
        } else {
            None
        }
    }
}

impl<V> OrderedMap<crate::InsensitiveAscii<'_>, V> {
    #[inline]
    pub fn find(&self, word: &'_ unicase::Ascii<&str>) -> Option<&'static V> {
        if self.range.contains(&word.len()) {
            self.keys
                .binary_search_by_key(word, |key| key.convert())
                .map(|i| &self.values[i])
                .ok()
        } else {
            None
        }
    }
}

impl<V> OrderedMap<&str, V> {
    #[inline]
    pub fn find(&self, word: &'_ &str) -> Option<&'static V> {
        if self.range.contains(&word.len()) {
            self.keys.binary_search(word).map(|i| &self.values[i]).ok()
        } else {
            None
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1632** (2026-10-05): **`SELEC` should be `SELECT` fires on `SELECTs`**
  *Symptoms*: ### Please complete the following tasks  - [x] I have searched the [open](https://github.com/crate-ci/typos/issues?q=is%3Aissue%20state%3Aopen%20label%3AA-dict) and [rejected](https://github.com/crate-ci/typos/issues?q=is%3Aissue%20state%3Aclosed%20label%3AA-dict) issues  ### Valid word  SELECTs  ### Incorrect correction  SELEC gets picked up, even though it's not even there.  ### Justification  SELEC is not there at all.  SELECTs is valid plural for SELECT (in the sense of SQL query).  ### Notes  It's case-sensitive, and appears to be tripped up by `Ts` at the end.  <img width="286" height="237" alt="Image" src="https://github.com/user-attachments/assets/4a95edfc-f8c8-479f-8b1b-48683f155b64" />  Input:  ``` SELECTs selectS selecTS selecTs SELECts SeLeCTs sElEcTs selects SELECTS SELECT select ```  Interestingly, it didn't pick up `SELECts`, which is a typo.
  **Post-Mortem & Fix Analysis**:
  > The root cause is the same as #745, closing in favor of that.

- **Issue #1631** (2026-10-04): **chore(deps): Update Rust Stable to v1.99**
  *Symptoms*: This PR contains the following updates:  | Package | Update | Change | |---|---|---| | [STABLE](https://redirect.github.com/rust-lang/rust) | minor | `1.98` → `1.99` |  ---  ### Release Notes  <details> <summary>rust-lang/rust (STABLE)</summary>  ### [`v1.99`](https://redirect.github.com/rust-lang/rust/blob/HEAD/RELEASES.md#Version-1990-2026-10-01)  [Compare Source](https://redirect.github.com/rust-lang/rust/compare/1.98.0...1.99.0)  \==========================  <a id="1.99.0-Language"></a>  ## Language  - [Add allow-by-default `raw_borrows_via_references` lint that checks for references that decay immediately into raw borrows](https://redirect.github.com/rust-lang/rust/pull/138230) - [Extend `unconditional_panic` lint to function calls that panic when the chunks/windows size is zero](https://redirect.github.com/rust-lang/rust/pull/153563) - [Stabilize C-variadic function definitions](https://redirect.github.com/rust-lang/rust/pull/155697) - [Stabilize the ability to use `#[unsafe(naked)]` functions to define C-variadic functions (`#![feature(c_variadic_naked_functions)]`).](https://redirect.github.com/rust-lang/rust/pull/159746) - [Trait methods are now resolved on an adjusted never type (producing a FCW)](https://redirect.github.com/rust-lang/rust/pull/156047) - [Coerce from inference variables to trait objects if the inference variable is related via subtyping to a type that is known to be `Sized`](https://redirect.github.com/rust-lang/rust/pull/157820) - [Stabilize `#[my_

- **Issue #1629** (2026-10-01): **chore(deps): Update Prek to v0.5.3**
  *Symptoms*: This PR contains the following updates:  | Package | Update | Change | Pending | |---|---|---|---| | [prek](https://redirect.github.com/j178/prek) | patch | `0.5.0` → `0.5.3` | `0.5.4` |  ---  ### Release Notes  <details> <summary>j178/prek (prek)</summary>  ### [`v0.5.3`](https://redirect.github.com/j178/prek/blob/HEAD/CHANGELOG.md#053)  [Compare Source](https://redirect.github.com/j178/prek/compare/v0.5.2...v0.5.3)  Released on 2026-09-13.  ##### Enhancements  - Add PEP 740 attestations for PyPI releases ([#&#8203;2705](https://redirect.github.com/j178/prek/pull/2705)) - Add a `check-jsonc` builtin hook ([#&#8203;2682](https://redirect.github.com/j178/prek/pull/2682)) - Allow disabling automatic uv installation ([#&#8203;2702](https://redirect.github.com/j178/prek/pull/2702))  ##### Bug fixes  - Fix Julia additional dependency specifiers ([#&#8203;2703](https://redirect.github.com/j178/prek/pull/2703)) - Update `granit-parser` to fix YAML flow indentation ([#&#8203;2707](https://redirect.github.com/j178/prek/pull/2707))  ##### Contributors  - [@&#8203;clbarnes](https://redirect.github.com/clbarnes) - [@&#8203;j178](https://redirect.github.com/j178) - [@&#8203;tisonkun](https://redirect.github.com/tisonkun)  ### [`v0.5.2`](https://redirect.github.com/j178/prek/blob/HEAD/CHANGELOG.md#052)  [Compare Source](https://redirect.github.com/j178/prek/compare/v0.5.1...v0.5.2)  Released on 2026-09-03.  ##### Enhancements  - Allow unknown tags by default in `check-yaml` ([#&#8203;2678]

- **Issue #1628** (2026-10-01): **chore(deps): Update compatible**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | |---|---|---|---| | [clap](https://redirect.github.com/clap-rs/clap) | dependencies | patch | `4.6.6` → `4.6.7` | | [encoding_rs](https://docs.rs/encoding_rs/) ([source](https://redirect.github.com/hsivonen/encoding_rs)) | dependencies | patch | `0.8.35` → `0.8.42` | | [indexmap](https://redirect.github.com/indexmap-rs/indexmap) | dev-dependencies | patch | `2.14.1` → `2.14.2` | | [toml](https://redirect.github.com/toml-rs/toml) | dependencies | patch | `1.1.4+spec-1.1.0` → `1.1.6` | | [unicode-ident](https://redirect.github.com/dtolnay/unicode-ident) | dependencies | patch | `1.0.24` → `1.0.26` |  ---  ### Release Notes  <details> <summary>clap-rs/clap (clap)</summary>  ### [`v4.6.7`](https://redirect.github.com/clap-rs/clap/compare/clap_complete-v4.6.6...clap_complete-v4.6.7)  [Compare Source](https://redirect.github.com/clap-rs/clap/compare/v4.6.6...v4.6.7)  </details>  <details> <summary>hsivonen/encoding_rs (encoding_rs)</summary>  ### [`v0.8.42`](https://redirect.github.com/hsivonen/encoding_rs/compare/v0.8.41...v0.8.42)  [Compare Source](https://redirect.github.com/hsivonen/encoding_rs/compare/v0.8.41...v0.8.42)  ### [`v0.8.41`](https://redirect.github.com/hsivonen/encoding_rs/compare/v0.8.40...v0.8.41)  [Compare Source](https://redirect.github.com/hsivonen/encoding_rs/compare/v0.8.40...v0.8.41)  ### [`v0.8.40`](https://redirect.github.com/hsivonen/encoding_rs/compare/v0.8.35...v0.8.40)  [Com

- **Issue #1627** (2026-10-01): **feat(dict): September updates**
  *Symptoms*: ### What does this PR try to solve?  Fixes #1610  ### Notes to reviewers  LLM involvement: none

- **Issue #1625** (2026-09-25): **chore(ci): Update maturin**
  *Symptoms*: ### What does this PR try to solve?    ### Notes to reviewers  LLM involvement: none 

- **Issue #1623** (2026-09-22): **Treat deleted/missing files as skippable IO errors instead of panicking**
  *Symptoms*: ## Summary - Soft-skip `NotFound`/`Interrupted` during canonicalize/read/walk instead of hard-erroring. - Catch panics in `walk_path_parallel` so IO races do not dump human-panic reports.  Fixes #1535
  **Post-Mortem & Fix Analysis**:
  > Closing as duplicate of #1622 (same NotFound skip, parallel agents).

- **Issue #1622** (2026-09-23): **Skip files that disappear between walk and read**
  *Symptoms*: ## Summary - Soft-skip `ErrorKind::NotFound` during path canonicalize and file read - Avoids noisy failures (and crash-adjacent races) when temp files vanish under parallel tools  Related to #1535  ## Test plan - [x] `cargo test -p typos-cli --lib` (51 passed) - [ ] CI green
  **Post-Mortem & Fix Analysis**:
  > >.  (same NotFound skip, parallel agents).  This is in violation of our AI policy

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

### Incident Patch 1: `ee31b061` (2026-09-25)
**Commit Message**: Merge pull request #1621 from antonkesy/fix-case-correct-panic

fix(cli): Don't panic on non-ASCII corrections in Title/Upper case

**File**: `crates/typos-cli/src/dict.rs` (modified, +21/-17)
```diff
@@ -189,26 +189,25 @@ impl typos::Dictionary for BuiltIn {
 fn case_correct(correction: &mut Cow<'_, str>, case: Case) {
     match case {
         Case::Lower | Case::None => (),
-        Case::Title => match correction {
-            Cow::Borrowed(s) => {
-                let mut s = String::from(*s);
-                s[0..1].make_ascii_uppercase();
-                *correction = s.into();
-            }
-            Cow::Owned(s) => {
-                s[0..1].make_ascii_uppercase();
-            }
-        },
-        Case::Upper => match correction {
-            Cow::Borrowed(s) => {
-                let mut s = String::from(*s);
-                s.make_ascii_uppercase();
+        Case::Title => {
+            debug_assert!(!correction.is_empty());
+            if correction.as_bytes()[0].is_ascii() {
+                correction.to_mut()[0..1].make_ascii_uppercase();
+            } else {
+                let mut chars = correction.chars();
+                let mut s = String::with_capacity(correction.len());
+                s.extend(chars.next().unwrap().to_uppercase());
+                s.push_str(chars.as_str());
                 *correction = s.into();
             }
-            Cow::Owned(s) => {
-                s.make_ascii_uppercase();
+        }
+        Case::Upper => {
+            if correction.is_ascii() {
+                correction.to_mut().make_ascii_uppercase();
+            } else {
+                *correction = correction.to_uppercase().into();
             }
-        },
+        }
     }
 }
 
@@ -391,6 +390,11 @@ mod test {
             ("foo", Case::Title, "Foo"),
             ("foo", Case::Upper, "FOO"),
             ("fOo", Case::None, "fOo"),
+            ("3d", Case::Title, "3d"),
+            ("über", Case::Title, "Über"),
+            ("über", Case::Upper, "ÜBER"),
+            ("château", Case::Title, "Château"),
+            ("château", Case::Upper, "CHÂTEAU"),
         ];
         for (correction, case, expected) in cases.iter() {
             let mut actual = Cow::Borrowed(*correction);
```

---

### Incident Patch 2: `d4bd872c` (2026-09-20)
**Commit Message**: fix(cli): Don't panic on non-ASCII corrections

**File**: `crates/typos-cli/src/dict.rs` (modified, +21/-17)
```diff
@@ -189,26 +189,25 @@ impl typos::Dictionary for BuiltIn {
 fn case_correct(correction: &mut Cow<'_, str>, case: Case) {
     match case {
         Case::Lower | Case::None => (),
-        Case::Title => match correction {
-            Cow::Borrowed(s) => {
-                let mut s = String::from(*s);
-                s[0..1].make_ascii_uppercase();
-                *correction = s.into();
-            }
-            Cow::Owned(s) => {
-                s[0..1].make_ascii_uppercase();
-            }
-        },
-        Case::Upper => match correction {
-            Cow::Borrowed(s) => {
-                let mut s = String::from(*s);
-                s.make_ascii_uppercase();
+        Case::Title => {
+            debug_assert!(!correction.is_empty());
+            if correction.as_bytes()[0].is_ascii() {
+                correction.to_mut()[0..1].make_ascii_uppercase();
+            } else {
+                let mut chars = correction.chars();
+                let mut s = String::with_capacity(correction.len());
+                s.extend(chars.next().unwrap().to_uppercase());
+                s.push_str(chars.as_str());
                 *correction = s.into();
             }
-            Cow::Owned(s) => {
-                s.make_ascii_uppercase();
+        }
+        Case::Upper => {
+            if correction.is_ascii() {
+                correction.to_mut().make_ascii_uppercase();
+            } else {
+                *correction = correction.to_uppercase().into();
             }
-        },
+        }
     }
 }
 
@@ -391,6 +390,11 @@ mod test {
             ("foo", Case::Title, "Foo"),
             ("foo", Case::Upper, "FOO"),
             ("fOo", Case::None, "fOo"),
+            ("3d", Case::Title, "3d"),
+            ("über", Case::Title, "Über"),
+            ("über", Case::Upper, "ÜBER"),
+            ("château", Case::Title, "Château"),
+            ("château", Case::Upper, "CHÂTEAU"),
         ];
         for (correction, case, expected) in cases.iter() {
             let mut actual = Cow::Borrowed(*correction);
```

---

### Incident Patch 3: `fb4f6a6b` (2026-09-19)
**Commit Message**: Merge pull request #1619 from szepeviktor/fix-wf

chore: Fix merge conflict in rust-next workflow

**File**: `.github/workflows/rust-next.yml` (modified, +0/-26)
```diff
@@ -11,12 +11,8 @@ env:
   RUST_BACKTRACE: 1
   CARGO_TERM_COLOR: always
   CLICOLOR: 1
-<<<<<<< HEAD
   COLUMNS: 130
-||||||| e4f2b351
-=======
   CARGO_INCREMENTAL: 0
->>>>>>> _rust/main
 
 concurrency:
   group: "${{ github.workflow }}-${{ github.ref }}"
@@ -41,16 +37,6 @@ jobs:
     - name: Checkout repository
       uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
       with:
-<<<<<<< HEAD
-        toolchain: ${{ matrix.rust }}
-        components: rustfmt
-    - uses: Swatinem/rust-cache@v2
-    - uses: taiki-e/install-action@cargo-hack
-||||||| e4f2b351
-        toolchain: ${{ matrix.rust }}
-    - uses: Swatinem/rust-cache@v2
-    - uses: taiki-e/install-action@cargo-hack
-=======
         persist-credentials: false
     - name: Install Rust
       run: rustup update --no-self-update ${{ matrix.rust }} && rustup default ${{ matrix.rust }}
@@ -60,7 +46,6 @@ jobs:
       uses: taiki-e/install-action@37f7c5781271959fb65b6b35224e28652ff2b63d  # v2.87.0
       with:
         tool: cargo-hack
->>>>>>> _rust/main
     - name: Build
       run: cargo test --workspace --no-run
     - name: Test
@@ -77,16 +62,6 @@ jobs:
     - name: Checkout repository
       uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
       with:
-<<<<<<< HEAD
-        toolchain: stable
-        components: rustfmt
-    - uses: Swatinem/rust-cache@v2
-    - uses: taiki-e/install-action@cargo-hack
-||||||| e4f2b351
-        toolchain: stable
-    - uses: Swatinem/rust-cache@v2
-    - uses: taiki-e/install-action@cargo-hack
-=======
         persist-credentials: false
     - name: Install Rust
       run: rustup update --no-self-update stable && rustup default stable
@@ -96,7 +71,6 @@ jobs:
       uses: taiki-e/install-action@37f7c5781271959fb65b6b35224e28652ff2b63d  # v2.87.0
       with:
         tool: cargo-hack
->>>>>>> _rust/main
     - name: Update dependencies
       run: cargo update
     - name: Build
```

---

### Incident Patch 4: `0c7bff0d` (2026-09-19)
**Commit Message**: Fix merge conflict in rust-next workflow

**File**: `.github/workflows/rust-next.yml` (modified, +0/-26)
```diff
@@ -11,12 +11,8 @@ env:
   RUST_BACKTRACE: 1
   CARGO_TERM_COLOR: always
   CLICOLOR: 1
-<<<<<<< HEAD
   COLUMNS: 130
-||||||| e4f2b351
-=======
   CARGO_INCREMENTAL: 0
->>>>>>> _rust/main
 
 concurrency:
   group: "${{ github.workflow }}-${{ github.ref }}"
@@ -41,16 +37,6 @@ jobs:
     - name: Checkout repository
       uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
       with:
-<<<<<<< HEAD
-        toolchain: ${{ matrix.rust }}
-        components: rustfmt
-    - uses: Swatinem/rust-cache@v2
-    - uses: taiki-e/install-action@cargo-hack
-||||||| e4f2b351
-        toolchain: ${{ matrix.rust }}
-    - uses: Swatinem/rust-cache@v2
-    - uses: taiki-e/install-action@cargo-hack
-=======
         persist-credentials: false
     - name: Install Rust
       run: rustup update --no-self-update ${{ matrix.rust }} && rustup default ${{ matrix.rust }}
@@ -60,7 +46,6 @@ jobs:
       uses: taiki-e/install-action@37f7c5781271959fb65b6b35224e28652ff2b63d  # v2.87.0
       with:
         tool: cargo-hack
->>>>>>> _rust/main
     - name: Build
       run: cargo test --workspace --no-run
     - name: Test
@@ -77,16 +62,6 @@ jobs:
     - name: Checkout repository
       uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
       with:
-<<<<<<< HEAD
-        toolchain: stable
-        components: rustfmt
-    - uses: Swatinem/rust-cache@v2
-    - uses: taiki-e/install-action@cargo-hack
-||||||| e4f2b351
-        toolchain: stable
-    - uses: Swatinem/rust-cache@v2
-    - uses: taiki-e/install-action@cargo-hack
-=======
         persist-credentials: false
     - name: Install Rust
       run: rustup update --no-self-update stable && rustup default stable
@@ -96,7 +71,6 @@ jobs:
       uses: taiki-e/install-action@37f7c5781271959fb65b6b35224e28652ff2b63d  # v2.87.0
       with:
         tool: cargo-hack
->>>>>>> _rust/main
     - name: Update dependencies
       run: cargo update
     - name: Build
```

---

### Incident Patch 5: `6edd83eb` (2026-09-12)
**Commit Message**: Merge pull request #1617 from nightah/fix-1444-walk-canonicalize-panic

fix(cli): Don't panic when canonicalize fails mid-walk

**File**: `crates/typos-cli/src/file.rs` (modified, +8/-1)
```diff
@@ -960,7 +960,14 @@ fn walk_entry(
             (path, cwd)
         } else {
             let path = entry.path();
-            let abs_path = report_result(path.canonicalize(), Some(path), reporter)?;
+            let abs_path = match path.canonicalize() {
+                Ok(abs_path) => abs_path,
+                Err(err) => {
+                    report_error(err, Some(path), reporter)?;
+                    // Avoid a failed `engine.policy` lookup
+                    return Ok(());
+                }
+            };
             (path, abs_path)
         };
         let policy = engine.policy(&lookup_path);
```

**File**: `crates/typos-cli/tests/walk_canonicalize.rs` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+//! Regression test for <https://github.com/crate-ci/typos/issues/1444>
+//!
+//! `walk_entry` canonicalizes each entry's path to look up its policy. When that failed,
+//! `report_result` reported the error and then handed back `PathBuf::default()`, an empty
+//! path that is never a key in `ConfigEngine`'s directory map, so the `policy()` call
+//! right after it panicked with `` `walk()` should be called first ``.
+#![cfg(unix)]
+
+struct CollectingReporter {
+    errors: std::sync::Mutex<Vec<String>>,
+}
+
+impl CollectingReporter {
+    fn new() -> Self {
+        Self {
+            errors: std::sync::Mutex::new(Vec::new()),
+        }
+    }
+}
+
+impl typos_cli::report::Report for CollectingReporter {
+    fn report(&self, msg: typos_cli::report::Message<'_>) -> Result<(), std::io::Error> {
+        if msg.is_error() {
+            self.errors.lock().unwrap().push(format!("{msg:?}"));
+        }
+        Ok(())
+    }
+}
+
+#[test]
+fn walk_path_reports_file_removed_mid_walk() {
+    let temp = assert_fs::TempDir::new().unwrap();
+    let vanishing = temp.path().join("vanishing.txt");
+    std::fs::write(&vanishing, b"helllo world\n").unwrap();
+
+    let storage = typos_cli::policy::ConfigStorage::new();
+    let mut engine = typos_cli::policy::ConfigEngine::new(&storage);
+    engine.set_isolated(true);
+    engine.set_overrides(typos_cli::config::Config::default());
+    let cwd = temp.path().canonicalize().unwrap();
+    engine.init_dir(&cwd).unwrap();
+
+    // Remove the file as the walker visits it. `ignore` still yields it as an `Ok` entry,
+    // but the `canonicalize()` in `walk_entry` then fails with `NotFound` -- the same
+    // outcome as a file that a concurrent process removes mid-scan.
+    let mut builder = ignore::WalkBuilder::new(temp.path());
+    let target = vanishing.clone();
+    let removed = std::sync::atomic::AtomicBool::new(false);
+    builder.filter_entry(move |entry| {
+        if entry.path() == target && !removed.swap(true, std::sync::atomic::Ordering::SeqCst) {
+            std::fs::remove_file(&target).unwrap();
+        }
+        true
+    });
+    let reporter = CollectingReporter::new();
+
+    let result = typos_cli::file::walk_path(
+        builder.build(),
+        &typos_cli::file::Typos,
+        &engine,
+        &reporter,
+        false,
+    );
+
+    assert!(
+        result.is_ok(),
+        "walk_path should not surface an ignore::Error: {result:?}"
+    );
+    assert!(
+        !reporter.errors.lock().unwrap().is_empty(),
+        "expected the vanished file's canonicalize() failure to be reported"
+    );
+}
```

---

### Incident Patch 6: `160d7928` (2026-09-11)
**Commit Message**: fix(cli): Don't panic when canonicalize fails mid-walk

`walk_entry` canonicalizes each entry's path to look up its policy, and routes a failure through `report_result`, which reports the error and then substitutes `T::default()` -- for a `PathBuf` that is the empty path. `ConfigEngine` never saw that path during the walk, so the `policy()` call immediately after aborts the process: a debug build trips the `debug_assert!` on `path.is_absolute()`, a release build reaches the `expect` below it.

Skip the entry after reporting the error instead, matching how a walk error is already handled a few lines above. A file removed by another process mid-scan is enough to reach this, so an abort here takes out an otherwise healthy run.

Fixes #1444 and Closes #1577

Co-authored-by: Alexander Kireev <[REDACTED_EMAIL]>
Signed-off-by: Amir Zarrinkafsh <[REDACTED_EMAIL]>

**File**: `crates/typos-cli/src/file.rs` (modified, +8/-1)
```diff
@@ -960,7 +960,14 @@ fn walk_entry(
             (path, cwd)
         } else {
             let path = entry.path();
-            let abs_path = report_result(path.canonicalize(), Some(path), reporter)?;
+            let abs_path = match path.canonicalize() {
+                Ok(abs_path) => abs_path,
+                Err(err) => {
+                    report_error(err, Some(path), reporter)?;
+                    // Avoid a failed `engine.policy` lookup
+                    return Ok(());
+                }
+            };
             (path, abs_path)
         };
         let policy = engine.policy(&lookup_path);
```

**File**: `crates/typos-cli/tests/walk_canonicalize.rs` (modified, +15/-24)
```diff
@@ -1,9 +1,9 @@
 //! Regression test for <https://github.com/crate-ci/typos/issues/1444>
 //!
-//! `walk_entry` canonicalizes each entry's path to look up its policy. When that fails,
-//! `report_result` reports the error and then hands back `PathBuf::default()`, an empty
+//! `walk_entry` canonicalizes each entry's path to look up its policy. When that failed,
+//! `report_result` reported the error and then handed back `PathBuf::default()`, an empty
 //! path that is never a key in `ConfigEngine`'s directory map, so the `policy()` call
-//! right after it panics with `` `walk()` should be called first ``.
+//! right after it panicked with `` `walk()` should be called first ``.
 #![cfg(unix)]
 
 struct CollectingReporter {
@@ -54,27 +54,18 @@ fn walk_path_reports_file_removed_mid_walk() {
     });
     let reporter = CollectingReporter::new();
 
-    let payload = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
-        typos_cli::file::walk_path(
-            builder.build(),
-            &typos_cli::file::Typos,
-            &engine,
-            &reporter,
-            false,
-        )
-    }))
-    .expect_err("walk_path should panic on the failed policy lookup");
-    let message = payload
-        .downcast_ref::<String>()
-        .map(String::as_str)
-        .or_else(|| payload.downcast_ref::<&str>().copied());
-    // `policy()` checks the path with a `debug_assert!` before reaching its `expect`.
-    let expected = if cfg!(debug_assertions) {
-        " is not absolute"
-    } else {
-        "`walk()` should be called first"
-    };
-    assert_eq!(message, Some(expected));
+    let result = typos_cli::file::walk_path(
+        builder.build(),
+        &typos_cli::file::Typos,
+        &engine,
+        &reporter,
+        false,
+    );
+
+    assert!(
+        result.is_ok(),
+        "walk_path should not surface an ignore::Error: {result:?}"
+    );
     assert!(
         !reporter.errors.lock().unwrap().is_empty(),
         "expected the vanished file's canonicalize() failure to be reported"
```

---

### Incident Patch 7: `25761c7b` (2026-09-11)
**Commit Message**: test(cli): Show panic when canonicalize fails mid-walk

Co-authored-by: Alexander Kireev <[REDACTED_EMAIL]>
Signed-off-by: Amir Zarrinkafsh <[REDACTED_EMAIL]>

**File**: `crates/typos-cli/tests/walk_canonicalize.rs` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+//! Regression test for <https://github.com/crate-ci/typos/issues/1444>
+//!
+//! `walk_entry` canonicalizes each entry's path to look up its policy. When that fails,
+//! `report_result` reports the error and then hands back `PathBuf::default()`, an empty
+//! path that is never a key in `ConfigEngine`'s directory map, so the `policy()` call
+//! right after it panics with `` `walk()` should be called first ``.
+#![cfg(unix)]
+
+struct CollectingReporter {
+    errors: std::sync::Mutex<Vec<String>>,
+}
+
+impl CollectingReporter {
+    fn new() -> Self {
+        Self {
+            errors: std::sync::Mutex::new(Vec::new()),
+        }
+    }
+}
+
+impl typos_cli::report::Report for CollectingReporter {
+    fn report(&self, msg: typos_cli::report::Message<'_>) -> Result<(), std::io::Error> {
+        if msg.is_error() {
+            self.errors.lock().unwrap().push(format!("{msg:?}"));
+        }
+        Ok(())
+    }
+}
+
+#[test]
+fn walk_path_reports_file_removed_mid_walk() {
+    let temp = assert_fs::TempDir::new().unwrap();
+    let vanishing = temp.path().join("vanishing.txt");
+    std::fs::write(&vanishing, b"helllo world\n").unwrap();
+
+    let storage = typos_cli::policy::ConfigStorage::new();
+    let mut engine = typos_cli::policy::ConfigEngine::new(&storage);
+    engine.set_isolated(true);
+    engine.set_overrides(typos_cli::config::Config::default());
+    let cwd = temp.path().canonicalize().unwrap();
+    engine.init_dir(&cwd).unwrap();
+
+    // Remove the file as the walker visits it. `ignore` still yields it as an `Ok` entry,
+    // but the `canonicalize()` in `walk_entry` then fails with `NotFound` -- the same
+    // outcome as a file that a concurrent process removes mid-scan.
+    let mut builder = ignore::WalkBuilder::new(temp.path());
+    let target = vanishing.clone();
+    let removed = std::sync::atomic::AtomicBool::new(false);
+    builder.filter_entry(move |entry| {
+        if entry.path() == target && !removed.swap(true, std::sync::atomic::Ordering::SeqCst) {
+            std::fs::remove_file(&target).unwrap();
+        }
+        true
+    });
+    let reporter = CollectingReporter::new();
+
+    let payload = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
+        typos_cli::file::walk_path(
+            builder.build(),
+            &typos_cli::file::Typos,
+            &engine,
+            &reporter,
+            false,
+        )
+    }))
+    .expect_err("walk_path should panic on the failed policy lookup");
+    let message = payload
+        .downcast_ref::<String>()
+        .map(String::as_str)
+        .or_else(|| payload.downcast_ref::<&str>().copied());
+    // `policy()` checks the path with a `debug_assert!` before reaching its `expect`.
+    let expected = if cfg!(debug_assertions) {
+        " is not absolute"
+    } else {
+        "`walk()` should be called first"
+    };
+    assert_eq!(message, Some(expected));
+    assert!(
+        !reporter.errors.lock().unwrap().is_empty(),
+        "expected the vanished file's canonicalize() failure to be reported"
+    );
+}
```

---

### Incident Patch 8: `79e6746d` (2026-09-01)
**Commit Message**: Merge pull request #1608 from nightcityblade/fix/python-asend

fix: allow Python asend identifier

**File**: `crates/typos-cli/src/file_type_specifics.rs` (modified, +1/-0)
```diff
@@ -79,6 +79,7 @@ pub(crate) const TYPE_SPECIFIC_DICTS: &[(&str, StaticDictConfig)] = &[
                 "NDArray",  // numpy.typing.NDArray
                 "EOFError", // std
                 "arange",   // torch.arange, numpy.arange
+                "asend",    // AsyncGenerator.asend
                 "certifi",  // popular package
             ],
             ignore_words: &[],
```

**File**: `crates/typos-cli/tests/cmd/false-positives.in/sample.py` (modified, +4/-0)
```diff
@@ -3,3 +3,7 @@
 from numpy.typing import NDArray  # should work
 
 print(os.O_WRONLY)  # should work
+
+
+async def consume(generator):
+    await generator.asend(None)  # should work
```

---

### Incident Patch 9: `5956a261` (2026-08-28)
**Commit Message**: fix: Allow Python asend identifier

**File**: `crates/typos-cli/src/file_type_specifics.rs` (modified, +1/-0)
```diff
@@ -79,6 +79,7 @@ pub(crate) const TYPE_SPECIFIC_DICTS: &[(&str, StaticDictConfig)] = &[
                 "NDArray",  // numpy.typing.NDArray
                 "EOFError", // std
                 "arange",   // torch.arange, numpy.arange
+                "asend",    // AsyncGenerator.asend
                 "certifi",  // popular package
             ],
             ignore_words: &[],
```

**File**: `crates/typos-cli/tests/cmd/false-positives.toml` (modified, +1/-8)
```diff
@@ -1,11 +1,4 @@
 bin.name = "typos"
 stdin = ""
-stdout = """
-error: `asend` should be `ascend`
-  ╭▸ ./sample.py:9:21
-  │
-9 │     await generator.asend(None)  # should work
-  ╰╴                    ━━━━━
-"""
+stdout = ""
 stderr = ""
-status.code = 2
```

---

### Incident Patch 10: `e7a4e8ad` (2026-08-27)
**Commit Message**: fix(dict): Don't correct the HashiCorp brand name

Fixes #1606

**File**: `crates/typos-cli/src/dict.rs` (modified, +1/-0)
```diff
@@ -55,6 +55,7 @@ impl BuiltIn {
         match ident {
             "O_WRONLY" => Some(Status::Valid),
             "dBA" => Some(Status::Valid),
+            "HashiCorp" => Some(Status::Valid),
             _ => None,
         }
     }
```

**File**: `crates/typos-cli/tests/cmd/false-positives.toml` (modified, +1/-8)
```diff
@@ -1,11 +1,4 @@
 bin.name = "typos"
 stdin = ""
-stdout = """
-error: `Hashi` should be `Hash`
-   ╭▸ ./README.md:11:17
-   │
-11 │ Some talk about HashiCorp
-   ╰╴                ━━━━━
-"""
+stdout = ""
 stderr = ""
-status.code = 2
```

---

### Incident Patch 11: `50a73522` (2026-08-09)
**Commit Message**: fix: Remove lint config for clippy::from_iter_instead_of_collect (#94)

`clippy::from_iter_instead_of_collect` was
[deprecated](https://github.com/rust-lang/rust-clippy/pull/17208) a
couple of months ago, and shows a warning on `beta` (`1.98.0`) when
there is any config set for it:
```
warning: lint `clippy::from_iter_instead_of_collect` has been removed: lint has proved problematic
  |
  = note: requested on the command line with `-W clippy::from_iter_instead_of_collect`
  = note: `#[warn(renamed_and_removed_lints)]` on by default
```

Given that `1.98.0` will be `stable` in a couple of weeks
(`2026-08-20`), I figured it would be a good idea to remove
`from_iter_instead_of_collect` from `[lints.clippy]` early.

**File**: `Cargo.toml` (modified, +0/-1)
```diff
@@ -56,7 +56,6 @@ float_cmp = "warn"
 float_cmp_const = "warn"
 fn_params_excessive_bools = "warn"
 fn_to_numeric_cast_any = "warn"
-from_iter_instead_of_collect = "warn"
 if_same_then_else = "allow"
 implicit_clone = "warn"
 imprecise_flops = "warn"
```

---

### Incident Patch 12: `f1016dff` (2026-08-09)
**Commit Message**: fix: Remove lint config for clippy::from_iter_instead_of_collect

**File**: `Cargo.toml` (modified, +0/-1)
```diff
@@ -56,7 +56,6 @@ float_cmp = "warn"
 float_cmp_const = "warn"
 fn_params_excessive_bools = "warn"
 fn_to_numeric_cast_any = "warn"
-from_iter_instead_of_collect = "warn"
 if_same_then_else = "allow"
 implicit_clone = "warn"
 imprecise_flops = "warn"
```

---

### Incident Patch 13: `5e38bf26` (2026-08-07)
**Commit Message**: Merge pull request #1593 from MsfPablo/fix/readme-absolute-doc-urls-1381

docs: use absolute URLs for docs/ links in README (fixes #1381)

**File**: `README.md` (modified, +11/-11)
```diff
@@ -6,7 +6,7 @@ Finds and corrects spelling mistakes among source code:
 - Fast enough to run on monorepos
 - Low false positives so you can run on PRs
 
-![Screenshot](./docs/screenshot.png)
+![Screenshot](https://github.com/crate-ci/typos/raw/master/docs/screenshot.png)
 
 
 [![Downloads](https://img.shields.io/github/downloads/crate-ci/typos/total.svg)](https://github.com/crate-ci/typos/releases)
@@ -23,16 +23,16 @@ Dual-licensed under [MIT](LICENSE-MIT) or [Apache 2.0](LICENSE-APACHE)
 - [Getting Started](#getting-started)
   - [False Positives](#false-positives)
   - [Integrations](#integrations)
-    - [GitHub Action](docs/github-action.md)
-    - [pre-commit](docs/pre-commit.md)
+    - [GitHub Action](https://github.com/crate-ci/typos/blob/master/docs/github-action.md)
+    - [pre-commit](https://github.com/crate-ci/typos/blob/master/docs/pre-commit.md)
     - [Custom](#custom)
   - [Debugging](#debugging)
-- [Reference](docs/reference.md)
+- [Reference](https://github.com/crate-ci/typos/blob/master/docs/reference.md)
 - [FAQ](#faq)
-- [Comparison with other spell checkers](docs/comparison.md)
+- [Comparison with other spell checkers](https://github.com/crate-ci/typos/blob/master/docs/comparison.md)
 - [Projects using typos](https://github.com/crate-ci/typos/wiki)
 - [Benchmarks](benchsuite/runs)
-- [Design](docs/design.md)
+- [Design](https://github.com/crate-ci/typos/blob/master/docs/design.md)
 - [Contribute](CONTRIBUTING.md)
 - [CHANGELOG](CHANGELOG.md)
 
@@ -79,7 +79,7 @@ If there is any ambiguity (multiple possible corrections), `typos` will just rep
 
 Sometimes, what looks like a typo is intentional, like with people's names, acronyms, or localized content.
 
-To mark a word or an identifier (grouping of words) as valid, add it to your [`_typos.toml`](docs/reference.md) by declaring itself as the valid spelling:
+To mark a word or an identifier (grouping of words) as valid, add it to your [`_typos.toml`](https://github.com/crate-ci/typos/blob/master/docs/reference.md) by declaring itself as the valid spelling:
 ```toml
 [default]
 extend-ignore-identifiers-re = [
@@ -95,7 +95,7 @@ AttributeIDSupressMenu = "AttributeIDSupressMenu"
 # Don't correct the surname "Teh"
 teh = "teh"
 ```
-For more ways to ignore or extend the dictionary with examples, see the [config reference](docs/reference.md).
+For more ways to ignore or extend the dictionary with examples, see the [config reference](https://github.com/crate-ci/typos/blob/master/docs/reference.md).
 
 For cases like localized content, you can disable spell checking of file contents while still checking the file name:
 ```toml
@@ -113,8 +113,8 @@ extend-exclude = ["localized/*.po"]
 
 ### Integrations
 
-- [GitHub Actions](docs/github-action.md)
-- [pre-commit](docs/pre-commit.md)
+- [GitHub Actions](https://github.com/crate-ci/typos/blob/master/docs/github-action.md)
+- [pre-commit](https://github.com/crate-ci/typos/blob/master/docs/pre-commit.md)
 - [🐊Putout Processor](https://github.com/putoutjs/putout-processor-typos)
 - [Visual Studio Code](https://github.com/tekumara/typos-vscode)
 - [typos-lsp (Language Server Protocol server)](https://github.com/tekumara/typos-vscode)
@@ -182,7 +182,7 @@ intent by finding the closest-looking word.  It then has a gauge for when a
 word isn't close enough and assumes you know best.  The user has the
 opportunity to verify these corrections and explicitly allow or reject them.
 
-For more on the trade offs of these approaches, see [Design](docs/design.md).
+For more on the trade offs of these approaches, see [Design](https://github.com/crate-ci/typos/blob/master/docs/design.md).
 
 - To correct it locally, see also our [False Positives documentation](#false-positives).
 - To contribute your correction, see [Contribute](CONTRIBUTING.md)
```

---

### Incident Patch 14: `2846392a` (2026-08-07)
**Commit Message**: docs: use absolute URLs for docs/ links in README (fixes #1381)

crates.io renders the crate README but resolves relative links against
the crate package directory (crates/typos/), so the relative docs/*.md
links 404 on crates.io — e.g. the "config reference" link resolved to
crates/typos/docs/reference.md, which does not exist (the files live at
repo-root docs/). Per the maintainer's direction, convert all relative
docs/ markdown links (and the screenshot image) to absolute GitHub
URLs so they resolve correctly both on GitHub and on crates.io.

Developed with AI assistance and reviewed by the contributor.

**File**: `README.md` (modified, +11/-11)
```diff
@@ -6,7 +6,7 @@ Finds and corrects spelling mistakes among source code:
 - Fast enough to run on monorepos
 - Low false positives so you can run on PRs
 
-![Screenshot](./docs/screenshot.png)
+![Screenshot](https://github.com/crate-ci/typos/raw/master/docs/screenshot.png)
 
 
 [![Downloads](https://img.shields.io/github/downloads/crate-ci/typos/total.svg)](https://github.com/crate-ci/typos/releases)
@@ -23,16 +23,16 @@ Dual-licensed under [MIT](LICENSE-MIT) or [Apache 2.0](LICENSE-APACHE)
 - [Getting Started](#getting-started)
   - [False Positives](#false-positives)
   - [Integrations](#integrations)
-    - [GitHub Action](docs/github-action.md)
-    - [pre-commit](docs/pre-commit.md)
+    - [GitHub Action](https://github.com/crate-ci/typos/blob/master/docs/github-action.md)
+    - [pre-commit](https://github.com/crate-ci/typos/blob/master/docs/pre-commit.md)
     - [Custom](#custom)
   - [Debugging](#debugging)
-- [Reference](docs/reference.md)
+- [Reference](https://github.com/crate-ci/typos/blob/master/docs/reference.md)
 - [FAQ](#faq)
-- [Comparison with other spell checkers](docs/comparison.md)
+- [Comparison with other spell checkers](https://github.com/crate-ci/typos/blob/master/docs/comparison.md)
 - [Projects using typos](https://github.com/crate-ci/typos/wiki)
 - [Benchmarks](benchsuite/runs)
-- [Design](docs/design.md)
+- [Design](https://github.com/crate-ci/typos/blob/master/docs/design.md)
 - [Contribute](CONTRIBUTING.md)
 - [CHANGELOG](CHANGELOG.md)
 
@@ -79,7 +79,7 @@ If there is any ambiguity (multiple possible corrections), `typos` will just rep
 
 Sometimes, what looks like a typo is intentional, like with people's names, acronyms, or localized content.
 
-To mark a word or an identifier (grouping of words) as valid, add it to your [`_typos.toml`](docs/reference.md) by declaring itself as the valid spelling:
+To mark a word or an identifier (grouping of words) as valid, add it to your [`_typos.toml`](https://github.com/crate-ci/typos/blob/master/docs/reference.md) by declaring itself as the valid spelling:
 ```toml
 [default]
 extend-ignore-identifiers-re = [
@@ -95,7 +95,7 @@ AttributeIDSupressMenu = "AttributeIDSupressMenu"
 # Don't correct the surname "Teh"
 teh = "teh"
 ```
-For more ways to ignore or extend the dictionary with examples, see the [config reference](docs/reference.md).
+For more ways to ignore or extend the dictionary with examples, see the [config reference](https://github.com/crate-ci/typos/blob/master/docs/reference.md).
 
 For cases like localized content, you can disable spell checking of file contents while still checking the file name:
 ```toml
@@ -113,8 +113,8 @@ extend-exclude = ["localized/*.po"]
 
 ### Integrations
 
-- [GitHub Actions](docs/github-action.md)
-- [pre-commit](docs/pre-commit.md)
+- [GitHub Actions](https://github.com/crate-ci/typos/blob/master/docs/github-action.md)
+- [pre-commit](https://github.com/crate-ci/typos/blob/master/docs/pre-commit.md)
 - [🐊Putout Processor](https://github.com/putoutjs/putout-processor-typos)
 - [Visual Studio Code](https://github.com/tekumara/typos-vscode)
 - [typos-lsp (Language Server Protocol server)](https://github.com/tekumara/typos-vscode)
@@ -182,7 +182,7 @@ intent by finding the closest-looking word.  It then has a gauge for when a
 word isn't close enough and assumes you know best.  The user has the
 opportunity to verify these corrections and explicitly allow or reject them.
 
-For more on the trade offs of these approaches, see [Design](docs/design.md).
+For more on the trade offs of these approaches, see [Design](https://github.com/crate-ci/typos/blob/master/docs/design.md).
 
 - To correct it locally, see also our [False Positives documentation](#false-positives).
 - To contribute your correction, see [Contribute](CONTRIBUTING.md)
```

---

### Incident Patch 15: `9e6f6e77` (2026-07-10)
**Commit Message**: chore(ci): Leverage CARGO_BUILD_WARNINGS

**File**: `.github/workflows/ci.yml` (modified, +4/-2)
```diff
@@ -137,7 +137,7 @@ jobs:
       uses: Swatinem/rust-cache@c19371144df3bb44fab255c43d04cbc2ab54d1c4 # v2.9.1
     - name: Check documentation
       env:
-        RUSTDOCFLAGS: -D warnings
+        CARGO_BUILD_WARNINGS: deny
       run: cargo doc --workspace --all-features --no-deps --document-private-items --keep-going
   rustfmt:
     name: rustfmt
@@ -190,7 +190,9 @@ jobs:
         sarif_file: clippy-results.sarif
         wait-for-processing: true
     - name: Report status
-      run: cargo clippy --workspace --all-features --all-targets --keep-going -- -D warnings --allow deprecated
+      env:
+        CARGO_BUILD_WARNINGS: deny
+      run: cargo clippy --workspace --all-features --all-targets --keep-going -- --allow deprecated
   coverage:
     name: Coverage
     runs-on: ubuntu-latest
```

#### Recent Merged Pull Requests:
- **PR #1631** (2026-10-04): chore(deps): Update Rust Stable to v1.99 (@renovate[bot])
- **PR #1629** (2026-10-01): chore(deps): Update Prek to v0.5.3 (@renovate[bot])
- **PR #1628** (2026-10-01): chore(deps): Update compatible (@renovate[bot])
- **PR #1627** (2026-10-01): feat(dict): September updates (@epage)
- **PR #1625** (2026-09-25): chore(ci): Update maturin (@epage)
- **PR #1623** (closed): Treat deleted/missing files as skippable IO errors instead of panicking (@00200200)
- **PR #1622** (closed): Skip files that disappear between walk and read (@00200200)
- **PR #1621** (2026-09-25): fix(cli): Don't panic on non-ASCII corrections in Title/Upper case (@antonkesy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
