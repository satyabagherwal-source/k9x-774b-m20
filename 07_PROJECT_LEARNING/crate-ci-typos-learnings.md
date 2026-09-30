# Forensic Learning Record (Deep Inspection): crate-ci/typos

> **Canonical Artifact**: `07_PROJECT_LEARNING/crate-ci-typos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/crate-ci/typos](https://github.com/crate-ci/typos))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:23:30.287Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `crate-ci/typos`
- **Description**: Source code spell checker
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 4164 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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
            dictgen::InsensitiveStr::Ascii("abi
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #1621** (2026-09-25): **fix(cli): Don't panic on non-ASCII corrections in Title/Upper case**
  *Symptoms*: <!-- Thanks for helping out! -->  ### What does this PR try to solve?  I have German text sections which gets corrected by `typos` using a custom toml-config. But I get panics for uppercase umlauts (for example "Ol" -> "Öl" (german word for oil):  ``` thread 'main' (3501281) panicked at crates/typos-cli/src/dict.rs:195:18: end byte index 1 is not a char boundary; it is inside 'Ö' (bytes 0..2 of string) note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace [1]    3501281 abort (core dumped)  cargo run -q -p typos-cli --manifest-path ~/Projects/typos /Cargo.toml -- -w ```   This PR fixes this :) I think this change is not major enough to have an issue beforehand.   <details>  <summary>Full crash log</summary>  ``` name = "typos-cli" operating_system = "Linux (Arch Linux rolling) [x86_64]" crate_version = "1.50.0" explanation = """ Panic occurred in file 'crates/typos-cli/src/dict.rs' at line 195 """ cause = "end byte index 1 is not a char boundary; it is inside 'Ö' (bytes 0..2 of string)" method = "Panic" backtrace = """    0:     0x55c80d9003ea - human_panic[810360d8be467654]::panic::setup_panic::<typos[a7722dcf4 6a3b270]::main::{closure#0}>::{closure#0}    1:     0x55c80dab6caf - std[5d98751fec7814e2]::panicking::panic_with_hook    2:     0x55c80dac6f51 - std[5d98751fec7814e2]::panicking::panic_handler::{closure#0}    3:     0x55c80dac6f09 - std[5d98751fec7814e2]::sys::backtrace::__rust_end_short_backtrace:: <std[5d9
  **Post-Mortem & Fix Analysis**:
  > Some of those CI failures are from another PR that accidentally slipped through. Fixing in #1625
  > Thanks!
  > > Thanks!  Thank you for the review and suggestions! Really appreciate it 😊

- **Issue #1620** (2026-09-19): **chore(ci): Clean up test action**
  *Symptoms*: ### What does this PR try to solve?  ### Notes to reviewers  LLM involvement: none 

- **Issue #1619** (2026-09-19): **chore: Fix merge conflict in rust-next workflow**
  *Symptoms*: ### What does this PR try to solve?  Just removing a committed merge conflict.  LLM involvement: my robobuddy Codex CLI 

- **Issue #1618** (2026-09-18): **chore: Update from _rust template**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > You are seeing this message because GitHub Code Scanning has recently been set up for this repository, or this pull request contains the workflow file for the Code Scanning tool.  ### What Enabling Code Scanning Means:  - The 'Security' tab will display more code scanning analysis results (e.g., for the default branch). - Depending on your configuration and choice of analysis tool, future pull requests will be annotated with code scanning analysis results. - You will be able to see the analysis results for the pull request's branch on this [overview](/crate-ci/typos/security/code-scanning?query=pr%3A1618+is%3Aopen) once the scans have completed and the checks have passed.  For more information about GitHub Code Scanning, check out [the documentation](https://docs.github.com/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning). 

- **Issue #1617** (2026-09-12): **fix(cli): Don't panic when canonicalize fails mid-walk**
  *Symptoms*: Takes @chatman-media's fix from #1577 and restructures it per your review: the test lands first, passing on `master` via `should_panic`, so the fix shows up as a test diff.  ## Cause  `walk_entry` canonicalizes each entry's path before looking up its policy. When that fails the error goes through `report_result`, which reports it and then falls back to `Default::default()`. For a `PathBuf` that is the empty path, which `ConfigEngine` never saw during the walk, so the `policy()` call right after it aborts the process. A release build hits the `expect`, a debug build trips the `debug_assert!` on `path.is_absolute()` just above it, which is why the panic text differs between the two.  ## Repro  A directory that is readable but not searchable. `ignore` lists the child, `canonicalize` on it fails with `EACCES`. Deterministic, single threaded, no `sudo`.  ```console $ mkdir -p repro/dir $ echo 'hello wrold' > repro/dir/a.txt $ chmod 444 repro/dir $ cd repro && typos ```  1.50.1:  ```console error: Permission denied (os error 13)   ─▸ ./dir/a.txt typos-cli had a problem and crashed. To help us diagnose the problem you can send us a crash report. [...] exit: 134 ```  With this PR:  ```console error: Permission denied (os error 13)   ─▸ ./dir/a.txt exit: 1 ```  The error still reports. Only the abort is gone.  #1577 assumed `ignore` catches permission denied first. That holds for an unreadable directory, not a readable non-searchable one: `readdir` succeeds, the entry reaches `walk_en
  **Post-Mortem & Fix Analysis**:
  > Let me know if you prefer this addressed in another way. I just did a revert and re-apply with your proposed changes instead of re-writing history with a force push.
  > Our contrib guide asks for atomic commits that reflect how they should be reviewed and merged and now how they were developed. Please rewrite your history.
  > > Our contrib guide asks for atomic commits that reflect how they should be reviewed and merged and now how they were developed. Please rewrite your history.  Adjusted accordingly.

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

Co-authored-by: Alexander Kireev <ak.chatman.media@gmail.com>
Signed-off-by: Amir Zarrinkafsh <3339418+nightah@users.noreply.github.com>

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

### Incident Patch 7: `79e6746d` (2026-09-01)
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

### Incident Patch 8: `5956a261` (2026-08-28)
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

### Incident Patch 9: `e7a4e8ad` (2026-08-27)
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

### Incident Patch 10: `50a73522` (2026-08-09)
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

#### Recent Merged Pull Requests:
- **PR #1625** (2026-09-25): chore(ci): Update maturin (@epage)
- **PR #1623** (closed): Treat deleted/missing files as skippable IO errors instead of panicking (@00200200)
- **PR #1622** (closed): Skip files that disappear between walk and read (@00200200)
- **PR #1621** (2026-09-25): fix(cli): Don't panic on non-ASCII corrections in Title/Upper case (@antonkesy)
- **PR #1620** (2026-09-19): chore(ci): Clean up test action (@epage)
- **PR #1619** (2026-09-19): chore: Fix merge conflict in rust-next workflow (@szepeviktor)
- **PR #1618** (2026-09-18): chore: Update from _rust template (@epage)
- **PR #1617** (2026-09-12): fix(cli): Don't panic when canonicalize fails mid-walk (@nightah)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
