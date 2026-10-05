# Forensic Learning Record (Deep Inspection): kcl-lang/kcl

> **Canonical Artifact**: `07_PROJECT_LEARNING/kcl-lang-kcl-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kcl-lang/kcl](https://github.com/kcl-lang/kcl))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:38:30.200Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kcl-lang/kcl`
- **Description**: KCL Core and API
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2420 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `3rdparty/serde_yaml/src/de.rs`
```
use crate::error::{self, Error, ErrorImpl};
use crate::libyaml::error::Mark;
use crate::libyaml::parser::{MappingStart, Scalar, ScalarStyle, SequenceStart};
use crate::libyaml::tag::Tag;
use crate::loader::{Document, Loader};
use crate::path::Path;
use serde::de::value::StrDeserializer;
use serde::de::{
    self, Deserialize, DeserializeOwned, DeserializeSeed, Expected, IgnoredAny, Unexpected, Visitor,
};
use std::fmt;
use std::io;
use std::mem;
use std::num::ParseIntError;
use std::str;
use std::sync::Arc;

type Result<T, E = Error> = std::result::Result<T, E>;

/// A structure that deserializes YAML into Rust values.
///
/// # Examples
///
/// Deserializing a single document:
///
/// ```
/// use anyhow::Result;
/// use serde::Deserialize;
/// use serde_yaml::Value;
///
/// fn main() -> Result<()> {
///     let input = "k: 107\n";
///     let de = serde_yaml::Deserializer::from_str(input);
///     let value = Value::deserialize(de)?;
///     println!("{:?}", value);
///     Ok(())
/// }
/// ```
///
/// Deserializing multi-doc YAML:
///
/// ```
/// use anyhow::Result;
/// use serde::Deserialize;
/// use serde_yaml::Value;
///
/// fn main() -> Result<()> {
///     let input = "---\nk: 107\n...\n---\nj: 106\n";
///
///     for document in serde_yaml::Deserializer::from_str(input) {
///         let value = Value::deserialize(document)?;
///         println!("{:?}", value);
///     }
///
///     Ok(())
/// }
/// ```
pub struct Deserializer<'de> {
    progress: Progress<'de>,
}

pub(crate) enum Progress<'de> {
    Str(&'de str),
    Slice(&'de [u8]),
    Read(Box<dyn io::Read + 'de>),
    Iterable(Loader<'de>),
    Document(Document<'de>),
    Fail(Arc<ErrorImpl>),
}

impl<'de> Deserializer<'de> {
    /// Creates a YAML deserializer from a `&str`.
    pub fn from_str(s: &'de str) -> Self {
        let progress = Progress::Str(s);
        Deserializer { progress }
    }

    /// Creates a YAML deserializer from a `&[u8]`.
    pub fn from_slice(v: &'de [u8]) -> Self {
        let progress = Progress::Slice(v);
        Deserializer { progress }
    }

    /// Creates a YAML deserializer from an `io::Read`.
    ///
    /// Reader-based deserializers do not support deserializing borrowed types
    /// like `&str`, since the `std::io::Read` trait has no non-copying methods
    /// -- everything it does involves copying bytes out of the data source.
    pub fn from_reader<R>(rdr: R) -> Self
    where
        R: io::Read + 'de,
    {
        let progress = Progress::Read(Box::new(rdr));
        Deserializer { progress }
    }

    fn de<T>(
        self,
        f: impl for<'document> FnOnce(&mut DeserializerFromEvents<'de, 'document>) -> Result<T>,
    ) -> Result<T> {
        let mut pos = 0;
        let mut jumpcount = 0;

        match self.progress {
            Progress::Iterable(_) => return Err(error::new(ErrorImpl::MoreThanOneDocument)),
            Progress::Document(document) => {
                let t = f(&mut DeserializerFromEvents {
                    document: &document,
                    pos: &mut pos,
                    jumpcount: &mut jumpcount,
                    path: Path::Root,
                    remaining_depth: 128,
                    current_enum: None,
                })?;
                if let Some(parse_error) = document.error {
                    return Err(error::shared(parse_error));
                }
                return Ok(t);
            }
            _ => {}
        }

        let mut loader = Loader::new(self.progress)?;
        let document = match loader.next_document() {
            Some(document) => document,
            None => return Err(error::new(ErrorImpl::EndOfStream)),
        };
        let t = f(&mut DeserializerFromEvents {
            document: &document,
            pos: &mut pos,
            jumpcount: &mut jumpcount,
            path: Path::Root,
            remaining_depth: 128,
            current_enum: None,
        })?;
        if let Some(parse_error) = document.error {
            return Err(error::shared(parse_error));
        }
        if loader.next_document().is_none() {
            Ok(t)
        } else {
            Err(error::new(ErrorImpl::MoreThanOneDocument))
        }
    }
}

impl<'de> Iterator for Deserializer<'de> {
    type Item = Self;

    fn next(&mut self) -> Option<Self> {
        match &mut self.progress {
            Progress::Iterable(loader) => {
                let document = loader.next_document()?;
                return Some(Deserializer {
                    progress: Progress::Document(document),
                });
            }
            Progress::Document(_) => return None,
            Progress::Fail(err) => {
                return Some(Deserializer {
                    progress: Progress::Fail(Arc::clone(err)),
                });
            }
            _ => {}
        }

        let dummy = Progress::Str("");
        let input = mem::replace(&mut self.progress, dummy);
        match Loader::new(input) {
            Ok(loader) => {
                self.progress = Progress::Iterable(loader);
                self.next()
            }
            Err(err) => {
                let fail = err.shared();
                self.progress = Progress::Fail(Arc::clone(&fail));
                Some(Deserializer {
                    progress: Progress::Fail(fail),
                })
            }
        }
    }
}

impl<'de> de::Deserializer<'de> for Deserializer<'de> {
    type Error = Error;

    fn deserialize_any<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_any(visitor))
    }

    fn deserialize_bool<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_bool(visitor))
    }

    fn deserialize_i8<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_i8(visitor))
    }

    fn deserialize_i16<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_i16(visitor))
    }

    fn deserialize_i32<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_i32(visitor))
    }

    fn deserialize_i64<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_i64(visitor))
    }

    fn deserialize_i128<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_i128(visitor))
    }

    fn deserialize_u8<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_u8(visitor))
    }

    fn deserialize_u16<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_u16(visitor))
    }

    fn deserialize_u32<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_u32(visitor))
    }

    fn deserialize_u64<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_u64(visitor))
    }

    fn deserialize_u128<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_u128(visitor))
    }

    fn deserialize_f32<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_f32(visitor))
    }

    fn deserialize_f64<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_f64(visitor))
    }

    fn deserialize_char<V>(self, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        self.de(|state| state.deserialize_char(visitor))
    
```

### Core Architecture Module: `3rdparty/serde_yaml/src/error.rs`
```
use crate::libyaml::{emitter, error as libyaml};
use crate::path::Path;
use serde::{de, ser};
use std::error::Error as StdError;
use std::fmt::{self, Debug, Display};
use std::io;
use std::result;
use std::string;
use std::sync::Arc;

/// An error that happened serializing or deserializing YAML data.
pub struct Error(Box<ErrorImpl>);

/// Alias for a `Result` with the error type `serde_yaml::Error`.
pub type Result<T> = result::Result<T, Error>;

#[derive(Debug)]
pub(crate) enum ErrorImpl {
    Message(String, Option<Pos>),

    Libyaml(libyaml::Error),
    Io(io::Error),
    FromUtf8(string::FromUtf8Error),

    EndOfStream,
    MoreThanOneDocument,
    RecursionLimitExceeded(libyaml::Mark),
    RepetitionLimitExceeded,
    BytesUnsupported,
    UnknownAnchor(libyaml::Mark),
    SerializeNestedEnum,
    ScalarInMerge,
    TaggedInMerge,
    ScalarInMergeElement,
    SequenceInMergeElement,
    EmptyTag,
    FailedToParseNumber,

    Shared(Arc<ErrorImpl>),
}

#[derive(Debug)]
pub(crate) struct Pos {
    mark: libyaml::Mark,
    path: String,
}

/// The input location that an error occured.
#[derive(Debug)]
pub struct Location {
    index: usize,
    line: usize,
    column: usize,
}

impl Location {
    /// The byte index of the error
    pub fn index(&self) -> usize {
        self.index
    }

    /// The line of the error
    pub fn line(&self) -> usize {
        self.line
    }

    /// The column of the error
    pub fn column(&self) -> usize {
        self.column
    }

    // This is to keep decoupled with the yaml crate
    #[doc(hidden)]
    fn from_mark(mark: libyaml::Mark) -> Self {
        Location {
            index: mark.index() as usize,
            // `line` and `column` returned from libyaml are 0-indexed but all error messages add +1 to this value
            line: mark.line() as usize + 1,
            column: mark.column() as usize + 1,
        }
    }
}

impl Error {
    /// Returns the Location from the error if one exists.
    ///
    /// Not all types of errors have a location so this can return `None`.
    ///
    /// # Examples
    ///
    /// ```
    /// # use serde_yaml::{Value, Error};
    /// #
    /// // The `@` character as the first character makes this invalid yaml
    /// let invalid_yaml: Result<Value, Error> = serde_yaml::from_str("@invalid_yaml");
    ///
    /// let location = invalid_yaml.unwrap_err().location().unwrap();
    ///
    /// assert_eq!(location.line(), 1);
    /// assert_eq!(location.column(), 1);
    /// ```
    pub fn location(&self) -> Option<Location> {
        self.0.location()
    }
}

pub(crate) fn new(inner: ErrorImpl) -> Error {
    Error(Box::new(inner))
}

pub(crate) fn shared(shared: Arc<ErrorImpl>) -> Error {
    Error(Box::new(ErrorImpl::Shared(shared)))
}

pub(crate) fn fix_mark(mut error: Error, mark: libyaml::Mark, path: Path) -> Error {
    if let ErrorImpl::Message(_, none @ None) = error.0.as_mut() {
        *none = Some(Pos {
            mark,
            path: path.to_string(),
        });
    }
    error
}

impl Error {
    pub(crate) fn shared(self) -> Arc<ErrorImpl> {
        if let ErrorImpl::Shared(err) = *self.0 {
            err
        } else {
            Arc::from(self.0)
        }
    }
}

impl From<libyaml::Error> for Error {
    fn from(err: libyaml::Error) -> Self {
        Error(Box::new(ErrorImpl::Libyaml(err)))
    }
}

impl From<emitter::Error> for Error {
    fn from(err: emitter::Error) -> Self {
        match err {
            emitter::Error::Libyaml(err) => Self::from(err),
            emitter::Error::Io(err) => new(ErrorImpl::Io(err)),
        }
    }
}

impl StdError for Error {
    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        self.0.source()
    }
}

impl Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        self.0.display(f)
    }
}

// Remove two layers of verbosity from the debug representation. Humans often
// end up seeing this representation because it is what unwrap() shows.
impl Debug for Error {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        self.0.debug(f)
    }
}

impl ser::Error for Error {
    fn custom<T: Display>(msg: T) -> Self {
        Error(Box::new(ErrorImpl::Message(msg.to_string(), None)))
    }
}

impl de::Error for Error {
    fn custom<T: Display>(msg: T) -> Self {
        Error(Box::new(ErrorImpl::Message(msg.to_string(), None)))
    }
}

impl ErrorImpl {
    fn location(&self) -> Option<Location> {
        self.mark().map(Location::from_mark)
    }

    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        match self {
            ErrorImpl::Io(err) => err.source(),
            ErrorImpl::FromUtf8(err) => err.source(),
            ErrorImpl::Shared(err) => err.source(),
            _ => None,
        }
    }

    fn mark(&self) -> Option<libyaml::Mark> {
        match self {
            ErrorImpl::Message(_, Some(Pos { mark, path: _ }))
            | ErrorImpl::RecursionLimitExceeded(mark)
            | ErrorImpl::UnknownAnchor(mark) => Some(*mark),
            ErrorImpl::Libyaml(err) => Some(err.mark()),
            ErrorImpl::Shared(err) => err.mark(),
            _ => None,
        }
    }

    fn message_no_mark(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ErrorImpl::Message(msg, None) => f.write_str(msg),
            ErrorImpl::Message(msg, Some(Pos { mark: _, path })) => {
                if path != "." {
                    write!(f, "{}: ", path)?;
                }
                f.write_str(msg)
            }
            ErrorImpl::Libyaml(_) => unreachable!(),
            ErrorImpl::Io(err) => Display::fmt(err, f),
            ErrorImpl::FromUtf8(err) => Display::fmt(err, f),
            ErrorImpl::EndOfStream => f.write_str("EOF while parsing a value"),
            ErrorImpl::MoreThanOneDocument => f.write_str(
                "deserializing from YAML containing more than one document is not supported",
            ),
            ErrorImpl::RecursionLimitExceeded(_mark) => f.write_str("recursion limit exceeded"),
            ErrorImpl::RepetitionLimitExceeded => f.write_str("repetition limit exceeded"),
            ErrorImpl::BytesUnsupported => {
                f.write_str("serialization and deserialization of bytes in YAML is not implemented")
            }
            ErrorImpl::UnknownAnchor(_mark) => f.write_str("unknown anchor"),
            ErrorImpl::SerializeNestedEnum => {
                f.write_str("serializing nested enums in YAML is not supported yet")
            }
            ErrorImpl::ScalarInMerge => {
                f.write_str("expected a mapping or list of mappings for merging, but found scalar")
            }
            ErrorImpl::TaggedInMerge => f.write_str("unexpected tagged value in merge"),
            ErrorImpl::ScalarInMergeElement => {
                f.write_str("expected a mapping for merging, but found scalar")
            }
            ErrorImpl::SequenceInMergeElement => {
                f.write_str("expected a mapping for merging, but found sequence")
            }
            ErrorImpl::EmptyTag => f.write_str("empty YAML tag is not allowed"),
            ErrorImpl::FailedToParseNumber => f.write_str("failed to parse YAML number"),
            ErrorImpl::Shared(_) => unreachable!(),
        }
    }

    fn display(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ErrorImpl::Libyaml(err) => Display::fmt(err, f),
            ErrorImpl::Shared(err) => err.display(f),
            _ => {
                self.message_no_mark(f)?;
                if let Some(mark) = self.mark() {
                    if mark.line() != 0 || mark.column() != 0 {
                        write!(f, " at {}", mark)?;
                    }
                }
                Ok(())
            }
        }
    }

    fn debug(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            ErrorImpl::Libyaml(err) => Debug::fmt(err, f),
      
```

### Core Architecture Module: `3rdparty/serde_yaml/src/lib.rs`
```
//! [![github]](https://github.com/dtolnay/serde-yaml)&ensp;[![crates-io]](https://crates.io/crates/serde-yaml)&ensp;[![docs-rs]](https://docs.rs/serde-yaml)
//!
//! [github]: https://img.shields.io/badge/github-8da0cb?style=for-the-badge&labelColor=555555&logo=github
//! [crates-io]: https://img.shields.io/badge/crates.io-fc8d62?style=for-the-badge&labelColor=555555&logo=rust
//! [docs-rs]: https://img.shields.io/badge/docs.rs-66c2a5?style=for-the-badge&labelColor=555555&logo=docs.rs
//!
//! <br>
//!
//! Rust library for using the [Serde] serialization framework with data in
//! [YAML] file format. _(This project is no longer maintained.)_
//!
//! [Serde]: https://github.com/serde-rs/serde
//! [YAML]: https://yaml.org/
//!
//! # Examples
//!
//! ```
//! use std::collections::BTreeMap;
//!
//! fn main() -> Result<(), serde_yaml::Error> {
//!     // You have some type.
//!     let mut map = BTreeMap::new();
//!     map.insert("x".to_string(), 1.0);
//!     map.insert("y".to_string(), 2.0);
//!
//!     // Serialize it to a YAML string.
//!     // 'y' is quoted to avoid ambiguity in parsers that might read it as `true`.
//!     let yaml = serde_yaml::to_string(&map)?;
//!     assert_eq!(yaml, "x: 1.0\n'y': 2.0\n");
//!
//!     // Deserialize it back to a Rust type.
//!     let deserialized_map: BTreeMap<String, f64> = serde_yaml::from_str(&yaml)?;
//!     assert_eq!(map, deserialized_map);
//!     Ok(())
//! }
//! ```
//!
//! ## Using Serde derive
//!
//! It can also be used with Serde's derive macros to handle structs and enums
//! defined in your program.
//!
//! Structs serialize in the obvious way:
//!
//! ```
//! # use serde_derive::{Serialize, Deserialize};
//! # use serde::Deserialize as _;
//! # use serde::Serialize as _;
//!
//! #[derive(Serialize, Deserialize, PartialEq, Debug)]
//! struct Point {
//!     x: f64,
//!     y: f64,
//! }
//!
//! fn main() -> Result<(), serde_yaml::Error> {
//!     let point = Point { x: 1.0, y: 2.0 };
//!
//!     let yaml = serde_yaml::to_string(&point)?;
//!     assert_eq!(yaml, "x: 1.0\n'y': 2.0\n");
//!
//!     let deserialized_point: Point = serde_yaml::from_str(&yaml)?;
//!     assert_eq!(point, deserialized_point);
//!     Ok(())
//! }
//! ```
//!
//! Enums serialize using YAML's `!tag` syntax to identify the variant name.
//!
//! ```
//! # use serde_derive::{Serialize, Deserialize};
//! # use serde::Deserialize as _;
//! # use serde::Serialize as _;
//!
//! #[derive(Serialize, Deserialize, PartialEq, Debug)]
//! enum Enum {
//!     Unit,
//!     Newtype(usize),
//!     Tuple(usize, usize, usize),
//!     Struct { x: f64, y: f64 },
//! }
//!
//! fn main() -> Result<(), serde_yaml::Error> {
//!     let yaml = "
//!         - !Newtype 1
//!         - !Tuple [0, 0, 0]
//!         - !Struct {x: 1.0, y: 2.0}
//!     ";
//!     let values: Vec<Enum> = serde_yaml::from_str(yaml).unwrap();
//!     assert_eq!(values[0], Enum::Newtype(1));
//!     assert_eq!(values[1], Enum::Tuple(0, 0, 0));
//!     assert_eq!(values[2], Enum::Struct { x: 1.0, y: 2.0 });
//!
//!     // The last two in YAML's block style instead:
//!     let yaml = "
//!         - !Tuple
//!           - 0
//!           - 0
//!           - 0
//!         - !Struct
//!           x: 1.0
//!           y: 2.0
//!     ";
//!     let values: Vec<Enum> = serde_yaml::from_str(yaml).unwrap();
//!     assert_eq!(values[0], Enum::Tuple(0, 0, 0));
//!     assert_eq!(values[1], Enum::Struct { x: 1.0, y: 2.0 });
//!
//!     // Variants with no data can be written using !Tag or just the string name.
//!     let yaml = "
//!         - Unit  # serialization produces this one
//!         - !Unit
//!     ";
//!     let values: Vec<Enum> = serde_yaml::from_str(yaml).unwrap();
//!     assert_eq!(values[0], Enum::Unit);
//!     assert_eq!(values[1], Enum::Unit);
//!
//!     Ok(())
//! }
//! ```

#![doc(html_root_url = "https://docs.rs/serde_yaml/0.9.34+deprecated")]
#![deny(missing_docs, unsafe_op_in_unsafe_fn)]
// Suppressed clippy_pedantic lints
#![allow(
    // buggy
    clippy::iter_not_returning_iterator, // https://github.com/rust-lang/rust-clippy/issues/8285
    clippy::ptr_arg, // https://github.com/rust-lang/rust-clippy/issues/9218
    clippy::question_mark, // https://github.com/rust-lang/rust-clippy/issues/7859
    // private Deserializer::next
    clippy::should_implement_trait,
    // things are often more readable this way
    clippy::cast_lossless,
    clippy::checked_conversions,
    clippy::if_not_else,
    clippy::manual_assert,
    clippy::match_like_matches_macro,
    clippy::match_same_arms,
    clippy::module_name_repetitions,
    clippy::needless_pass_by_value,
    clippy::redundant_else,
    clippy::single_match_else,
    // code is acceptable
    clippy::blocks_in_conditions,
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    clippy::cast_precision_loss,
    clippy::cast_sign_loss,
    clippy::derive_partial_eq_without_eq,
    clippy::derived_hash_with_manual_eq,
    clippy::doc_markdown,
    clippy::items_after_statements,
    clippy::let_underscore_untyped,
    clippy::manual_map,
    clippy::missing_panics_doc,
    clippy::never_loop,
    clippy::return_self_not_must_use,
    clippy::too_many_lines,
    clippy::uninlined_format_args,
    clippy::unsafe_removed_from_name,
    clippy::wildcard_in_or_patterns,
    // noisy
    clippy::missing_errors_doc,
    clippy::must_use_candidate,
)]

pub use crate::de::{from_reader, from_slice, from_str, Deserializer};
pub use crate::error::{Error, Location, Result};
pub use crate::ser::{to_string, to_writer, Serializer};
#[doc(inline)]
pub use crate::value::{from_value, to_value, Index, Number, Sequence, Value};

#[doc(inline)]
pub use crate::mapping::Mapping;

mod de;
mod error;
mod libyaml;
mod loader;
pub mod mapping;
mod number;
mod path;
mod ser;
pub mod value;
pub mod with;

// Prevent downstream code from implementing the Index trait.
mod private {
    pub trait Sealed {}
    impl Sealed for usize {}
    impl Sealed for str {}
    impl Sealed for String {}
    impl Sealed for crate::Value {}
    impl<T> Sealed for &T where T: ?Sized + Sealed {}
}

```

### Core Architecture Module: `3rdparty/serde_yaml/src/libyaml/cstr.rs`
```
use std::fmt::{self, Debug, Display, Write as _};
use std::marker::PhantomData;
use std::ptr::NonNull;
use std::slice;
use std::str;

#[derive(Copy, Clone)]
pub(crate) struct CStr<'a> {
    ptr: NonNull<u8>,
    marker: PhantomData<&'a [u8]>,
}

unsafe impl<'a> Send for CStr<'a> {}
unsafe impl<'a> Sync for CStr<'a> {}

impl<'a> CStr<'a> {
    pub fn from_bytes_with_nul(bytes: &'static [u8]) -> Self {
        assert_eq!(bytes.last(), Some(&b'\0'));
        let ptr = NonNull::from(bytes).cast();
        unsafe { Self::from_ptr(ptr) }
    }

    pub unsafe fn from_ptr(ptr: NonNull<i8>) -> Self {
        CStr {
            ptr: ptr.cast(),
            marker: PhantomData,
        }
    }

    pub fn len(self) -> usize {
        let start = self.ptr.as_ptr();
        let mut end = start;
        unsafe {
            while *end != 0 {
                end = end.add(1);
            }
            end.offset_from(start) as usize
        }
    }

    pub fn to_bytes(self) -> &'a [u8] {
        let len = self.len();
        unsafe { slice::from_raw_parts(self.ptr.as_ptr(), len) }
    }
}

impl<'a> Display for CStr<'a> {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        let ptr = self.ptr.as_ptr();
        let len = self.len();
        let bytes = unsafe { slice::from_raw_parts(ptr, len) };
        display_lossy(bytes, formatter)
    }
}

impl<'a> Debug for CStr<'a> {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        let ptr = self.ptr.as_ptr();
        let len = self.len();
        let bytes = unsafe { slice::from_raw_parts(ptr, len) };
        debug_lossy(bytes, formatter)
    }
}

fn display_lossy(mut bytes: &[u8], formatter: &mut fmt::Formatter) -> fmt::Result {
    loop {
        match str::from_utf8(bytes) {
            Ok(valid) => return formatter.write_str(valid),
            Err(utf8_error) => {
                let valid_up_to = utf8_error.valid_up_to();
                let valid = unsafe { str::from_utf8_unchecked(&bytes[..valid_up_to]) };
                formatter.write_str(valid)?;
                formatter.write_char(char::REPLACEMENT_CHARACTER)?;
                if let Some(error_len) = utf8_error.error_len() {
                    bytes = &bytes[valid_up_to + error_len..];
                } else {
                    return Ok(());
                }
            }
        }
    }
}

pub(crate) fn debug_lossy(mut bytes: &[u8], formatter: &mut fmt::Formatter) -> fmt::Result {
    formatter.write_char('"')?;

    while !bytes.is_empty() {
        let from_utf8_result = str::from_utf8(bytes);
        let valid = match from_utf8_result {
            Ok(valid) => valid,
            Err(utf8_error) => {
                let valid_up_to = utf8_error.valid_up_to();
                unsafe { str::from_utf8_unchecked(&bytes[..valid_up_to]) }
            }
        };

        let mut written = 0;
        for (i, ch) in valid.char_indices() {
            let esc = ch.escape_debug();
            if esc.len() != 1 && ch != '\'' {
                formatter.write_str(&valid[written..i])?;
                for ch in esc {
                    formatter.write_char(ch)?;
                }
                written = i + ch.len_utf8();
            }
        }
        formatter.write_str(&valid[written..])?;

        match from_utf8_result {
            Ok(_valid) => break,
            Err(utf8_error) => {
                let end_of_broken = if let Some(error_len) = utf8_error.error_len() {
                    valid.len() + error_len
                } else {
                    bytes.len()
                };
                for b in &bytes[valid.len()..end_of_broken] {
                    write!(formatter, "\\x{:02x}", b)?;
                }
                bytes = &bytes[end_of_broken..];
            }
        }
    }

    formatter.write_char('"')
}

```

### Core Architecture Module: `3rdparty/serde_yaml/src/libyaml/emitter.rs`
```
use crate::libyaml;
use crate::libyaml::util::Owned;
use std::ffi::c_void;
use std::io;
use std::mem::{self, MaybeUninit};
use std::ptr::{self, addr_of_mut};
use std::slice;
use unsafe_libyaml as sys;

#[derive(Debug)]
pub(crate) enum Error {
    Libyaml(libyaml::error::Error),
    Io(io::Error),
}

pub(crate) struct Emitter<'a> {
    pin: Owned<EmitterPinned<'a>>,
}

struct EmitterPinned<'a> {
    sys: sys::yaml_emitter_t,
    write: Box<dyn io::Write + 'a>,
    write_error: Option<io::Error>,
}

#[derive(Debug)]
pub(crate) enum Event<'a> {
    StreamStart,
    StreamEnd,
    DocumentStart,
    DocumentEnd,
    Scalar(Scalar<'a>),
    SequenceStart(Sequence),
    SequenceEnd,
    MappingStart(Mapping),
    MappingEnd,
}

#[derive(Debug)]
pub(crate) struct Scalar<'a> {
    pub tag: Option<String>,
    pub value: &'a str,
    pub style: ScalarStyle,
}

#[derive(Debug)]
pub(crate) enum ScalarStyle {
    Any,
    Plain,
    SingleQuoted,
    Literal,
}

#[derive(Debug)]
pub(crate) struct Sequence {
    pub tag: Option<String>,
}

#[derive(Debug)]
pub(crate) struct Mapping {
    pub tag: Option<String>,
}

impl<'a> Emitter<'a> {
    pub fn new(write: Box<dyn io::Write + 'a>) -> Emitter<'a> {
        let owned = Owned::<EmitterPinned>::new_uninit();
        let pin = unsafe {
            let emitter = addr_of_mut!((*owned.ptr).sys);
            if sys::yaml_emitter_initialize(emitter).fail {
                panic!("malloc error: {}", libyaml::Error::emit_error(emitter));
            }
            sys::yaml_emitter_set_unicode(emitter, true);
            sys::yaml_emitter_set_width(emitter, -1);
            addr_of_mut!((*owned.ptr).write).write(write);
            addr_of_mut!((*owned.ptr).write_error).write(None);
            sys::yaml_emitter_set_output(emitter, write_handler, owned.ptr.cast());
            Owned::assume_init(owned)
        };
        Emitter { pin }
    }

    pub fn emit(&mut self, event: Event) -> Result<(), Error> {
        let mut sys_event = MaybeUninit::<sys::yaml_event_t>::uninit();
        let sys_event = sys_event.as_mut_ptr();
        unsafe {
            let emitter = addr_of_mut!((*self.pin.ptr).sys);
            let initialize_status = match event {
                Event::StreamStart => {
                    sys::yaml_stream_start_event_initialize(sys_event, sys::YAML_UTF8_ENCODING)
                }
                Event::StreamEnd => sys::yaml_stream_end_event_initialize(sys_event),
                Event::DocumentStart => {
                    let version_directive = ptr::null_mut();
                    let tag_directives_start = ptr::null_mut();
                    let tag_directives_end = ptr::null_mut();
                    let implicit = true;
                    sys::yaml_document_start_event_initialize(
                        sys_event,
                        version_directive,
                        tag_directives_start,
                        tag_directives_end,
                        implicit,
                    )
                }
                Event::DocumentEnd => {
                    let implicit = true;
                    sys::yaml_document_end_event_initialize(sys_event, implicit)
                }
                Event::Scalar(mut scalar) => {
                    let anchor = ptr::null();
                    let tag = scalar.tag.as_mut().map_or_else(ptr::null, |tag| {
                        tag.push('\0');
                        tag.as_ptr()
                    });
                    let value = scalar.value.as_ptr();
                    let length = scalar.value.len() as i32;
                    let plain_implicit = tag.is_null();
                    let quoted_implicit = tag.is_null();
                    let style = match scalar.style {
                        ScalarStyle::Any => sys::YAML_ANY_SCALAR_STYLE,
                        ScalarStyle::Plain => sys::YAML_PLAIN_SCALAR_STYLE,
                        ScalarStyle::SingleQuoted => sys::YAML_SINGLE_QUOTED_SCALAR_STYLE,
                        ScalarStyle::Literal => sys::YAML_LITERAL_SCALAR_STYLE,
                    };
                    sys::yaml_scalar_event_initialize(
                        sys_event,
                        anchor,
                        tag,
                        value,
                        length,
                        plain_implicit,
                        quoted_implicit,
                        style,
                    )
                }
                Event::SequenceStart(mut sequence) => {
                    let anchor = ptr::null();
                    let tag = sequence.tag.as_mut().map_or_else(ptr::null, |tag| {
                        tag.push('\0');
                        tag.as_ptr()
                    });
                    let implicit = tag.is_null();
                    let style = sys::YAML_ANY_SEQUENCE_STYLE;
                    sys::yaml_sequence_start_event_initialize(
                        sys_event, anchor, tag, implicit, style,
                    )
                }
                Event::SequenceEnd => sys::yaml_sequence_end_event_initialize(sys_event),
                Event::MappingStart(mut mapping) => {
                    let anchor = ptr::null();
                    let tag = mapping.tag.as_mut().map_or_else(ptr::null, |tag| {
                        tag.push('\0');
                        tag.as_ptr()
                    });
                    let implicit = tag.is_null();
                    let style = sys::YAML_ANY_MAPPING_STYLE;
                    sys::yaml_mapping_start_event_initialize(
                        sys_event, anchor, tag, implicit, style,
                    )
                }
                Event::MappingEnd => sys::yaml_mapping_end_event_initialize(sys_event),
            };
            if initialize_status.fail {
                return Err(Error::Libyaml(libyaml::Error::emit_error(emitter)));
            }
            if sys::yaml_emitter_emit(emitter, sys_event).fail {
                return Err(self.error());
            }
        }
        Ok(())
    }

    pub fn flush(&mut self) -> Result<(), Error> {
        unsafe {
            let emitter = addr_of_mut!((*self.pin.ptr).sys);
            if sys::yaml_emitter_flush(emitter).fail {
                return Err(self.error());
            }
        }
        Ok(())
    }

    pub fn into_inner(self) -> Box<dyn io::Write + 'a> {
        let sink = Box::new(io::sink());
        unsafe { mem::replace(&mut (*self.pin.ptr).write, sink) }
    }

    fn error(&mut self) -> Error {
        let emitter = unsafe { &mut *self.pin.ptr };
        if let Some(write_error) = emitter.write_error.take() {
            Error::Io(write_error)
        } else {
            Error::Libyaml(unsafe { libyaml::Error::emit_error(&emitter.sys) })
        }
    }
}

unsafe fn write_handler(data: *mut c_void, buffer: *mut u8, size: u64) -> i32 {
    let data = data.cast::<EmitterPinned>();
    match io::Write::write_all(unsafe { &mut *(*data).write }, unsafe {
        slice::from_raw_parts(buffer, size as usize)
    }) {
        Ok(()) => 1,
        Err(err) => {
            unsafe {
                (*data).write_error = Some(err);
            }
            0
        }
    }
}

impl<'a> Drop for EmitterPinned<'a> {
    fn drop(&mut self) {
        unsafe { sys::yaml_emitter_delete(&mut self.sys) }
    }
}

```

### Core Architecture Module: `3rdparty/serde_yaml/src/libyaml/error.rs`
```
use crate::libyaml::cstr::CStr;
use std::fmt::{self, Debug, Display};
use std::mem::MaybeUninit;
use std::ptr::NonNull;
use unsafe_libyaml as sys;

pub(crate) type Result<T> = std::result::Result<T, Error>;

pub(crate) struct Error {
    kind: sys::yaml_error_type_t,
    problem: CStr<'static>,
    problem_offset: u64,
    problem_mark: Mark,
    context: Option<CStr<'static>>,
    context_mark: Mark,
}

impl Error {
    pub unsafe fn parse_error(parser: *const sys::yaml_parser_t) -> Self {
        Error {
            kind: unsafe { (&(*parser)).error },
            problem: match NonNull::new(unsafe { (&(*parser)).problem as *mut _ }) {
                Some(problem) => unsafe { CStr::from_ptr(problem) },
                None => CStr::from_bytes_with_nul(b"libyaml parser failed but there is no error\0"),
            },
            problem_offset: unsafe { (&(*parser)).problem_offset },
            problem_mark: Mark {
                sys: unsafe { (&(*parser)).problem_mark },
            },
            context: match NonNull::new(unsafe { (&(*parser)).context as *mut _ }) {
                Some(context) => Some(unsafe { CStr::from_ptr(context) }),
                None => None,
            },
            context_mark: Mark {
                sys: unsafe { (&(*parser)).context_mark },
            },
        }
    }

    pub unsafe fn emit_error(emitter: *const sys::yaml_emitter_t) -> Self {
        Error {
            kind: unsafe { (&(*emitter)).error },
            problem: match NonNull::new(unsafe { (&(*emitter)).problem as *mut _ }) {
                Some(problem) => unsafe { CStr::from_ptr(problem) },
                None => {
                    CStr::from_bytes_with_nul(b"libyaml emitter failed but there is no error\0")
                }
            },
            problem_offset: 0,
            problem_mark: Mark {
                sys: unsafe { MaybeUninit::<sys::yaml_mark_t>::zeroed().assume_init() },
            },
            context: None,
            context_mark: Mark {
                sys: unsafe { MaybeUninit::<sys::yaml_mark_t>::zeroed().assume_init() },
            },
        }
    }

    pub fn mark(&self) -> Mark {
        self.problem_mark
    }
}

impl Display for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        write!(formatter, "{}", self.problem)?;
        if self.problem_mark.sys.line != 0 || self.problem_mark.sys.column != 0 {
            write!(formatter, " at {}", self.problem_mark)?;
        } else if self.problem_offset != 0 {
            write!(formatter, " at position {}", self.problem_offset)?;
        }
        if let Some(context) = &self.context {
            write!(formatter, ", {}", context)?;
            if (self.context_mark.sys.line != 0 || self.context_mark.sys.column != 0)
                && (self.context_mark.sys.line != self.problem_mark.sys.line
                    || self.context_mark.sys.column != self.problem_mark.sys.column)
            {
                write!(formatter, " at {}", self.context_mark)?;
            }
        }
        Ok(())
    }
}

impl Debug for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        let mut formatter = formatter.debug_struct("Error");
        if let Some(kind) = match self.kind {
            sys::YAML_MEMORY_ERROR => Some("MEMORY"),
            sys::YAML_READER_ERROR => Some("READER"),
            sys::YAML_SCANNER_ERROR => Some("SCANNER"),
            sys::YAML_PARSER_ERROR => Some("PARSER"),
            sys::YAML_COMPOSER_ERROR => Some("COMPOSER"),
            sys::YAML_WRITER_ERROR => Some("WRITER"),
            sys::YAML_EMITTER_ERROR => Some("EMITTER"),
            _ => None,
        } {
            formatter.field("kind", &format_args!("{}", kind));
        }
        formatter.field("problem", &self.problem);
        if self.problem_mark.sys.line != 0 || self.problem_mark.sys.column != 0 {
            formatter.field("problem_mark", &self.problem_mark);
        } else if self.problem_offset != 0 {
            formatter.field("problem_offset", &self.problem_offset);
        }
        if let Some(context) = &self.context {
            formatter.field("context", context);
            if self.context_mark.sys.line != 0 || self.context_mark.sys.column != 0 {
                formatter.field("context_mark", &self.context_mark);
            }
        }
        formatter.finish()
    }
}

#[derive(Copy, Clone)]
pub(crate) struct Mark {
    pub(super) sys: sys::yaml_mark_t,
}

impl Mark {
    pub fn index(&self) -> u64 {
        self.sys.index
    }

    pub fn line(&self) -> u64 {
        self.sys.line
    }

    pub fn column(&self) -> u64 {
        self.sys.column
    }
}

impl Display for Mark {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        if self.sys.line != 0 || self.sys.column != 0 {
            write!(
                formatter,
                "line {} column {}",
                self.sys.line + 1,
                self.sys.column + 1,
            )
        } else {
            write!(formatter, "position {}", self.sys.index)
        }
    }
}

impl Debug for Mark {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        let mut formatter = formatter.debug_struct("Mark");
        if self.sys.line != 0 || self.sys.column != 0 {
            formatter.field("line", &(self.sys.line + 1));
            formatter.field("column", &(self.sys.column + 1));
        } else {
            formatter.field("index", &self.sys.index);
        }
        formatter.finish()
    }
}

```

### Core Architecture Module: `3rdparty/serde_yaml/src/libyaml/mod.rs`
```
mod cstr;
pub mod emitter;
pub mod error;
pub mod parser;
pub mod tag;
mod util;

use self::error::Error;

```

### Core Architecture Module: `3rdparty/serde_yaml/src/libyaml/parser.rs`
```
use crate::libyaml::cstr::{self, CStr};
use crate::libyaml::error::{Error, Mark, Result};
use crate::libyaml::tag::Tag;
use crate::libyaml::util::Owned;
use std::borrow::Cow;
use std::fmt::{self, Debug};
use std::mem::MaybeUninit;
use std::ptr::{addr_of_mut, NonNull};
use std::slice;
use unsafe_libyaml as sys;

pub(crate) struct Parser<'input> {
    pin: Owned<ParserPinned<'input>>,
}

struct ParserPinned<'input> {
    sys: sys::yaml_parser_t,
    input: Cow<'input, [u8]>,
}

#[derive(Debug)]
pub(crate) enum Event<'input> {
    StreamStart,
    StreamEnd,
    DocumentStart,
    DocumentEnd,
    Alias(Anchor),
    Scalar(Scalar<'input>),
    SequenceStart(SequenceStart),
    SequenceEnd,
    MappingStart(MappingStart),
    MappingEnd,
}

pub(crate) struct Scalar<'input> {
    pub anchor: Option<Anchor>,
    pub tag: Option<Tag>,
    pub value: Box<[u8]>,
    pub style: ScalarStyle,
    pub repr: Option<&'input [u8]>,
}

#[derive(Debug)]
pub(crate) struct SequenceStart {
    pub anchor: Option<Anchor>,
    pub tag: Option<Tag>,
}

#[derive(Debug)]
pub(crate) struct MappingStart {
    pub anchor: Option<Anchor>,
    pub tag: Option<Tag>,
}

#[derive(Ord, PartialOrd, Eq, PartialEq)]
pub(crate) struct Anchor(Box<[u8]>);

#[derive(Copy, Clone, PartialEq, Eq, Debug)]
pub(crate) enum ScalarStyle {
    Plain,
    SingleQuoted,
    DoubleQuoted,
    Literal,
    Folded,
}

impl<'input> Parser<'input> {
    pub fn new(input: Cow<'input, [u8]>) -> Parser<'input> {
        let owned = Owned::<ParserPinned>::new_uninit();
        let pin = unsafe {
            let parser = addr_of_mut!((*owned.ptr).sys);
            if sys::yaml_parser_initialize(parser).fail {
                panic!("malloc error: {}", Error::parse_error(parser));
            }
            sys::yaml_parser_set_encoding(parser, sys::YAML_UTF8_ENCODING);
            sys::yaml_parser_set_input_string(parser, input.as_ptr(), input.len() as u64);
            addr_of_mut!((*owned.ptr).input).write(input);
            Owned::assume_init(owned)
        };
        Parser { pin }
    }

    pub fn next(&mut self) -> Result<(Event<'input>, Mark)> {
        let mut event = MaybeUninit::<sys::yaml_event_t>::uninit();
        unsafe {
            let parser = addr_of_mut!((*self.pin.ptr).sys);
            if (&(*parser)).error != sys::YAML_NO_ERROR {
                return Err(Error::parse_error(parser));
            }
            let event = event.as_mut_ptr();
            if sys::yaml_parser_parse(parser, event).fail {
                return Err(Error::parse_error(parser));
            }
            let ret = convert_event(&*event, &(*self.pin.ptr).input);
            let mark = Mark {
                sys: (*event).start_mark,
            };
            sys::yaml_event_delete(event);
            Ok((ret, mark))
        }
    }
}

unsafe fn convert_event<'input>(
    sys: &sys::yaml_event_t,
    input: &Cow<'input, [u8]>,
) -> Event<'input> {
    match sys.type_ {
        sys::YAML_STREAM_START_EVENT => Event::StreamStart,
        sys::YAML_STREAM_END_EVENT => Event::StreamEnd,
        sys::YAML_DOCUMENT_START_EVENT => Event::DocumentStart,
        sys::YAML_DOCUMENT_END_EVENT => Event::DocumentEnd,
        sys::YAML_ALIAS_EVENT => {
            Event::Alias(unsafe { optional_anchor(sys.data.alias.anchor) }.unwrap())
        }
        sys::YAML_SCALAR_EVENT => Event::Scalar(Scalar {
            anchor: unsafe { optional_anchor(sys.data.scalar.anchor) },
            tag: unsafe { optional_tag(sys.data.scalar.tag) },
            value: Box::from(unsafe {
                slice::from_raw_parts(sys.data.scalar.value, sys.data.scalar.length as usize)
            }),
            style: match unsafe { sys.data.scalar.style } {
                sys::YAML_PLAIN_SCALAR_STYLE => ScalarStyle::Plain,
                sys::YAML_SINGLE_QUOTED_SCALAR_STYLE => ScalarStyle::SingleQuoted,
                sys::YAML_DOUBLE_QUOTED_SCALAR_STYLE => ScalarStyle::DoubleQuoted,
                sys::YAML_LITERAL_SCALAR_STYLE => ScalarStyle::Literal,
                sys::YAML_FOLDED_SCALAR_STYLE => ScalarStyle::Folded,
                sys::YAML_ANY_SCALAR_STYLE | _ => unreachable!(),
            },
            repr: if let Cow::Borrowed(input) = input {
                Some(&input[sys.start_mark.index as usize..sys.end_mark.index as usize])
            } else {
                None
            },
        }),
        sys::YAML_SEQUENCE_START_EVENT => Event::SequenceStart(SequenceStart {
            anchor: unsafe { optional_anchor(sys.data.sequence_start.anchor) },
            tag: unsafe { optional_tag(sys.data.sequence_start.tag) },
        }),
        sys::YAML_SEQUENCE_END_EVENT => Event::SequenceEnd,
        sys::YAML_MAPPING_START_EVENT => Event::MappingStart(MappingStart {
            anchor: unsafe { optional_anchor(sys.data.mapping_start.anchor) },
            tag: unsafe { optional_tag(sys.data.mapping_start.tag) },
        }),
        sys::YAML_MAPPING_END_EVENT => Event::MappingEnd,
        sys::YAML_NO_EVENT => unreachable!(),
        _ => unimplemented!(),
    }
}

unsafe fn optional_anchor(anchor: *const u8) -> Option<Anchor> {
    let ptr = NonNull::new(anchor as *mut i8)?;
    let cstr = unsafe { CStr::from_ptr(ptr) };
    Some(Anchor(Box::from(cstr.to_bytes())))
}

unsafe fn optional_tag(tag: *const u8) -> Option<Tag> {
    let ptr = NonNull::new(tag as *mut i8)?;
    let cstr = unsafe { CStr::from_ptr(ptr) };
    Some(Tag(Box::from(cstr.to_bytes())))
}

impl<'input> Debug for Scalar<'input> {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        let Scalar {
            anchor,
            tag,
            value,
            style,
            repr: _,
        } = self;

        struct LossySlice<'a>(&'a [u8]);

        impl<'a> Debug for LossySlice<'a> {
            fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                cstr::debug_lossy(self.0, formatter)
            }
        }

        formatter
            .debug_struct("Scalar")
            .field("anchor", anchor)
            .field("tag", tag)
            .field("value", &LossySlice(value))
            .field("style", style)
            .finish()
    }
}

impl Debug for Anchor {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        cstr::debug_lossy(&self.0, formatter)
    }
}

impl<'input> Drop for ParserPinned<'input> {
    fn drop(&mut self) {
        unsafe { sys::yaml_parser_delete(&mut self.sys) }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2130** (2026-08-24): **Evaluator regression (0.12.x): sibling-key reads inside a dict literal resolve to Undefined when the dict also contains a lambda-call + merge key**
  *Symptoms*: ## Evaluator regression: sibling-key reads inside a dict literal resolve to Undefined when the dict also contains a lambda-call + merge key  ### Summary  In KCL 0.12.x, evaluating certain expressions inside a dict literal silently (or loudly) resolves to `Undefined` even though the referenced variable is bound. The trigger pattern is a dict literal whose **one key is a lambda call followed by `|` and an override dict**, and whose **sibling key reads an attribute from the surrounding scope** — most commonly `config.X` where `config` is a schema instance.  This is a regression: the same code renders correctly under KCL 0.11.x.  The konfig project (kcl-lang/konfig#36) hit this and had to ship a multi-file workaround; reporting here so it can be fixed at the evaluator.  ### Minimal reproducer (kcl 0.12.8)  ```kcl schema Server:     name: str = "x"     workloadType: str = "Deployment"  MetaBuilder = lambda c -> {str:} {     {         name: c?.name or "default"         labels: c?.labels  # bare optional access, no fallback     } }  config_dict = {     name = "x"     workloadType = "Deployment" }  my_dict = {     metadata = MetaBuilder(config_dict) | {name = "override"}     spec = {         # reading config_dict.workloadType silently returns Undefined         selector = config_dict?.services or config_dict[config_dict.workloadType]     } }  print("spec.selector:", my_dict.spec.selector) ```  Observed (kcl 0.12.8):  ``` spec.selector: Undefined ```  Expected (kcl 0.11.x):  ``` spec.s

- **Issue #2080** (2026-04-07): **Assign by value is not working properly when using different schemas**
  *Symptoms*: ## Bug Report  According to the documentation, [assignments are always by value](https://www.kcl-lang.io/docs/reference/lang/spec/schema#assign-by-value).   However deleting properties from an object after it was assign to a variable, still triggers validation of the original object's schema. In some other cases it will even delete properties from the old schema. I was not able yet, to reproduce the deletion outside of my project.   ### 1. Minimal reproduce step (Required)  ``` schema Foo:     hello: str  schema Bar(Foo):     world: str  testCopyByValue = lambda input: Bar -> Foo {     foo: any = input     foo.world = Undefined      foo }  bar = Bar {     hello = "world"     world = "hello" }   output = testCopyByValue(bar) ``` ### 2. What did you expect to see? (Required) ``` output:    hello: world ```  ### 3. What did you see instead (Required)  ``` EvaluationError   --> /test.k:12:1    | 12 |     foo.world = Undefined    |  attribute 'world' of Bar is required and can't be None or Undefined    | ```  ### 4. What is your KCL components version? (Required)  ``` kcl version 0.12.4 ```
  **Post-Mortem & Fix Analysis**:
  > Amazing, thanks for the fix. Any idea when this is going to be released?  Edit: Right now I am using the workaround that I set the type to `any`.

- **Issue #2072** (2026-08-26): **evaluation is order dependent in local scope (missing attribute)**
  *Symptoms*: # Bug: Lambda evaluation only computes last field when depending on local variables  **Disclaimer:** This issue is the result of human-AI collaboration after searching for the bug cause . I indeed experienced and reproduced the error and provided the code(partially the file is long and contains bunch of colors). The analysis down below was primarily generated by an LLM (DeepSeek) and is speculative - the author does not fully understand the codebase and this analysis may be incorrect. Please verify independently.  ## Description  When defining a lambda that creates a config object with multiple computed fields depending on local variables (defined in the same lambda), only the last field in declaration order appears in the output. Earlier fields are missing entirely.  This works correctly in global scope but fails in lambda/local scope.  ## Reproduction  ```kcl # some types and schemas like Palette ... # Base data structure (validated as correct YAML was indeed output) everforest_src = { 	light = { 		fg = {...},  		bg = { 			hard = {...},  			..other variants 		} 	},  	dark = {..similar to light mode} }  # Schema-validated theme, no errors  # ✅ WORKS - Global scope _mode = "light" _variant = "hard" everforest_light_hard = {     mode = _mode     variant = _variant     fg = everforest_src[mode].fg     bg = everforest_src[mode].bg[variant] } # Result: {mode="light", variant="hard", fg=..., bg=...} - both fields present  # ❌ FAILS - Lambda scope (fg first, bg last) get_palette2 =
  **Post-Mortem & Fix Analysis**:
  > The reproduction is clear and the per-field bisect (swapping `fg`/`bg` order consistently shows only the last field) strongly points to a scope-resolution bug in lambda body compilation rather than a data-dependency cycle. The analysis in the issue correctly isolates `scope.rs`, `lazy.rs`, and `context.rs` as the likely culprits — particularly the interaction between `emit_setters` (which records field setters in `LazyEvalScope`) and `get_variable` (which may use a direct scope lookup path that bypasses lazy forcing for earlier fields). Can you share the minimal reproducer as a standalone `.k` file rather than the theming snippet, so the bug can be isolated in the KCL test harness without the `Palette` schema overhead? A unit test that asserts `len(result.fields) == len(lambda.body.fields)` for a two-field lambda would pin the regression and prevent re-introduction.
  > **Update: False alarm - this was a syntax misunderstanding, not a bug**  After re-reading the docs and testing more carefully, I found the root cause.  I was using: ```kcl func1 = lambda x, y -> any {     a = x     b = y } ```  But KCL treats `{ ... }` as a function body block (like Scala/Rust), not as an implicit return. The last expression is what gets returned - so `func1` returns `b` only.  What I intended and understood (influenced by JavaScript where `() => {a: x, b: y}` is common) was: ```kcl func2 = lambda x, y -> any { 	{ 	    a = x 	    b = y 	} } ``` I mistakenly thought the `-> Type` (`Palette` in my case) part was syntax for a typed dict literal, not the function's return type annotation.  The nested braces `{ { ... } }` create a single expression returning the config object. With this fix applied to my original theming code, both fields appear correctly. No order-dependence, no bug.  **Apologies for the noise! And yes, confirmation bias is real - I framed it so convincing
  > Ah, good catch — lambda blocks returning the last expression rather than all assignments makes sense. Thanks for closing the loop on this.

- **Issue #2059** (2026-02-12): **Relative imports as show in the language tour don't seem to work**
  *Symptoms*: ## Bug Report  Please answer these questions before submitting your issue. Thanks!  ### 1. Minimal reproduce step (Required)  Create a folder structure like is demonstrated in the KCL language tour at https://www.kcl-lang.io/docs/reference/lang/tour#module (note that it's the first example which DOES NOT contain a `kcl.mod` file).  ### 2. What did you expect to see? (Required)  I expected that running `kcl run model/main.k` in the `root` folder or `kcl run main.k` in the `root/model` folder would correctly print the model.   ### 3. What did you see instead (Required)  I get all sorts of error: failed to import errors, various attribute and schemas not defined, etc. It seems to me that relative paths simply don't work as shown (unless there's some kind of flag I have to pass to the CLI command).   ### 4. What is your KCL components version? (Required)  0.12.3
  **Post-Mortem & Fix Analysis**:
  > @Peefy can i work on this?
  > @Peefy ,  I’ve been looking into this and tried to reproduce the error on my machine using v0.12.3, but interestingly, I can't get it to fail—it’s actually working fine for me.  I’ve tried running the files from the root and even from inside the subdirectories, but the relative imports seem to resolve without any issues on my end. I'm curious if this might be down to how different OS environments or shells handle implicit path resolution, especially since we're on the same KCL version.  What do you think we should do here? Since it's hard to pin down why the implicit root discovery is failing for some users but not others, I was thinking the best way forward might be to just update the KCL Tour documentation.  If we add a quick kcl mod init step right before the multi-file examples, it would force an explicit project root and probably save a lot of people from hitting this "failed to import" hurdle. Does that sound like the right move, or is there something else in the path resolution 

- **Issue #2054** (2026-01-27): **builtin类型转换函数int转换16进制时出现coredump**
  *Symptoms*: ## Bug Report  Please answer these questions before submitting your issue. Thanks!  ### 1. Minimal reproduce step (Required) 使用命令行kcl工具编译如下源码文件  print(int("E4",base=16)) 或者print(int("0xe4",base=16))  ### 2. What did you expect to see? (Required) 228  ### 3. What did you see instead (Required) 发生coredump ``` [11:55:59]ci@~/kcl-tool/build/kcl> kcl ../../a.k  thread caused non-unwinding panic. aborting. SIGABRT: abort PC=0x7371e7e1b9fc m=0 sigcode=18446744073709551610 signal arrived during cgo execution  goroutine 1 gp=0xc000002380 m=0 mp=0x4deffc0 [syscall]: runtime.cgocall(0xfd74c0, 0xc0004da5b0)         /opt/buildtools/golang_go-1.24.1/go/src/runtime/cgocall.go:167 +0x4b fp=0xc000836888 sp=0xc000836850 pc=0x47980b github.com/ebitengine/purego.RegisterFunc.func1({0xc00081f780?, 0x5?, 0x5?})         /home/ci/go/pkg/mod/github.com/ebitengine/purego@v0.7.1/func.go:302 +0xc3f fp=0xc000836d08 sp=0xc000836888 pc=0xfd4a3f reflect.callReflect(0xc00087e090, 0xc0008371c0, 0xc000837098, 0xc0008370a0)         /opt/buildtools/golang_go-1.24.1/go/src/reflect/value.go:770 +0x519 fp=0xc000837048 sp=0xc000836d08 pc=0x4b88d9 reflect.callReflect(0xc00087e090, 0xc0008371c0, 0xc000837098, 0xc0008370a0)         <autogenerated>:1 +0x45 fp=0xc000837078 sp=0xc000837048 pc=0x4ca6c5 reflect.makeFuncStub()         /opt/buildtools/golang_go-1.24.1/go/src/reflect/asm_amd64.s:47 +0x6e fp=0xc0008371c0 sp=0xc000837078 pc=0x4c69ce kcl-lang.io/lib/go/native.cApiCall[...](0xc00088b830, {0x243c339, 0x18}, 0x1eb52

- **Issue #2046** (2026-07-19): **Kcl run causes stack overflow**
  *Symptoms*: ## Bug Report  Please answer these questions before submitting your issue. Thanks!  ### Minimal reproduce step (Required)  ```bash cd /tmp git clone https://github.com/kcl-lang/kcl.git cd kcl cargo build ```  running the following gives us the stack overflow:   ```bash user@/t/kcl (main) [2]> /tmp/kcl/_build/dist/linux/core/libkcl run test.k  thread 'main' (79949) has overflowed its stack fatal runtime error: stack overflow, aborting fish: Job 1, '/tmp/kcl/_build/dist/linux/core…' terminated by signal SIGABRT (Abort) ```  with   `test.k` ```kcl test = {   bean: "test" } test ```  being the offending minimal test case identified  the following does not cause an issue:  ```kcl _test = {   bean: "test" } _test ```  ### What is your KCL components version? (Required)  Version: 0.12.3-c020ab3eb4b9179219d6837a57f5d323 Platform: x86_64-unknown-linux-gnu GitCommit: 7a5fabf7fa10f7bea0d6d3aaddc6345d5b13e63f 

- **Issue #2042** (2026-01-09): **KCL grammar parse error**
  *Symptoms*: ## Bug Report  Please answer these questions before submitting your issue. Thanks!  ### 1. Minimal reproduce step (Required)  ``` cd /tmp git clone https://github.com/kcl-lang/kcl.git cd kcl cargo build  /tmp/kcl/_build/dist/linux/core/libkcl run test.k error[E1001]: InvalidSyntax  --> /tmp/kcl/test.k:5:5   | 5 |     {   |     ^ expected one of ["]"] got {   |  error[E1001]: InvalidSyntax  --> /tmp/kcl/test.k:7:5   | 7 |     }   |     ^ expected one of [":", "=", "+="] got newline   |  error[E1001]: InvalidSyntax  --> /tmp/kcl/test.k:8:5   | 8 |     ]   |     ^ expected one of ["identifier", "literal", "(", "[", "{"] got ]   |  error[E1001]: InvalidSyntax  --> /tmp/kcl/test.k:8:5   | 8 |     ]   |     ^ expected one of ["identifier", "literal", "(", "[", "{"] got ]   |  error[E1001]: InvalidSyntax  --> /tmp/kcl/test.k:8:5   | 8 |     ]   |     ^ expected one of [":", "=", "+="] got ]   |  error[E1001]: InvalidSyntax  --> /tmp/kcl/test.k:8:5   | 8 |     ]   |     ^ expected one of ["identifier", "literal", "(", "[", "{"] got newline   |  error[E2A31]: IllegalAttributeError  --> /tmp/kcl/test.k:5:5   | 5 |     {   |     ^ A attribute must be string type, got '{str(name):str(test2)}'   |  ```  the issue happens with the following the following kcl file:   ```test.k {     hi: [{         name: "test"     }     {         name: "test2"     }     ] } ```  but goes away if you run this version:  ```working version  {     hi: [     {         name: "test"     }     {         name: "test

- **Issue #2020** (2025-12-30): **calling lambda from checks always fail that check**
  *Symptoms*: ### 1. Minimal reproduce step (Required) ```kcl _check_uniq = lambda xs -> bool {   isunique(xs) }  schema S1:   elems: [int]    check:     _check_uniq(elems) if elems, "elems of ${elems} MUST be unique"  schema S2:   elems: [int]    check:     isunique(elems) if elems, "elems ${elems} MUST be unique"  s1 = S1 {   elems: [1,2,3] } ``` When trying to validate a YAML file against schema S1, the validation always fails, but the same input file successfully validates against schema S2. I.e ``` # kcl run ./main.k | yq -y '.s1' | kcl vet --format yaml - ./main.k -s S1 EvaluationError  --> /tmp/.tmpodArdm:1:6   | 1 | elems:   |      ^ Instance check failed   |  ---> File validationTempKCLCode.k:9: Check failed on the condition: elems of [1, 2, 3] MUST be unique  # kcl run ./main.k | yq -y '.s1' | kcl vet --format yaml - ./main.k -s S2 Validate success! ```  ### 2. What did you expect to see? (Required) checks with lambda calls should success if input data is valid  ### 3. What did you see instead (Required) checks with lambda calls fails event if the input data is valid  ### 4. What is your KCL components version? (Required) # kcl --version kcl version 0.12.3  The same behavior with kcl 0.11.3

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

### Incident Patch 1: `da013146` (2026-09-29)
**Commit Message**: fix(runtime): self-contained plugin stub on wasm32-unknown-unknown (#2208)

runtime: self-contained plugin stub on wasm32-unknown-unknown

The kcl_plugin_invoke_json_wasm import only makes sense when there's a
host to fill it in - wasmtime in akua's render worker, or any WASI
host. On wasm32-unknown-unknown (e.g. a JS-loaded SDK bundle) there is
no host, so the extern becomes an unresolved env.* import that every
JS loader stumbles over.

Gate the extern to target_os = "wasi" and provide a self-contained
stub on the non-WASI path. The stub returns a __kcl_PanicInfo__
envelope pointing users at the CLI, so Packages that try to call
helm.template / kustomize.build / pkg.render in the SDK bundle surface
a clean diagnostic instead of a silent misevaluation.

Verified against a temporary `uuid` "js" feature addition (kcl's own
separate, pre-existing wasm32-unknown-unknown gap, tracked
independently and not part of this patch - the consuming crate closes
it via Cargo feature unification, see akuapkg's
docs/spikes/kcl-wasm-feasibility.md) - kcl-runtime alone checks clean
for wasm32-unknown-unknown with that gap closed.

Originally landed as akua-dev/kcl@5b214696 on the akua-wasm32 branch;

**File**: `crates/runtime/src/stdlib/plugin.rs` (modified, +25/-1)
```diff
@@ -116,7 +116,13 @@ pub unsafe extern "C-unwind" fn kcl_plugin_invoke_json(
     }
 }
 
-#[cfg(target_arch = "wasm32")]
+// `wasm32-wasip1` expects a wasmtime host (or any WASI host) to link
+// `kcl_plugin_invoke_json_wasm` at instantiation - that's how akua's
+// render worker ferries plugin callouts back to host handlers. On
+// `wasm32-unknown-unknown` (e.g. a JS-loaded SDK bundle) there is no
+// host, so the extern would leave an unresolved `env.*` import that
+// every JS loader stumbles over.
+#[cfg(all(target_arch = "wasm32", target_os = "wasi"))]
 unsafe extern "C-unwind" {
     pub fn kcl_plugin_invoke_json_wasm(
         method: *const c_char,
@@ -125,6 +131,24 @@ unsafe extern "C-unwind" {
     ) -> *const c_char;
 }
 
+/// Self-contained no-op stub for `wasm32-unknown-unknown`, where there
+/// is no host to link the real `kcl_plugin_invoke_json_wasm` extern.
+/// Callers that need plugins stick with `wasm32-wasip1` + a wasmtime
+/// host.
+#[cfg(all(target_arch = "wasm32", not(target_os = "wasi")))]
+pub unsafe fn kcl_plugin_invoke_json_wasm(
+    _method: *const c_char,
+    _args: *const c_char,
+    _kwargs: *const c_char,
+) -> *const c_char {
+    // `__kcl_PanicInfo__` shape - KCL's plugin-invoke glue treats this
+    // response as a runtime panic, so Packages that call a plugin
+    // surface a clean evaluator error with the message below rather
+    // than a silent misevaluation.
+    c"{\"__kcl_PanicInfo__\":\"plugin callouts are not available in this KCL build (wasm32-unknown-unknown) - use a wasmtime-hosted build for helm.template / kustomize.build / pkg.render\"}"
+        .as_ptr() as *const c_char
+}
+
 #[cfg(all(test, not(target_arch = "wasm32")))]
 mod tests {
     use super::*;
```

---

### Incident Patch 2: `d2b50eb8` (2026-09-29)
**Commit Message**: fix(lsp): wasm32 shim for Url::from_file_path / to_file_path (#2207)

LSP: wasm32 shim for Url::from_file_path

The url crate's from_file_path is gated on cfg(any(unix, windows)) and
doesn't exist on wasm32-unknown-unknown. The LSP uses it to build
file:// URIs for diagnostic locations; without the helper,
kcl-language-server (and therefore kcl-api, which depends on it
unconditionally) fails to compile for targets without a filesystem.

Provide util::url_from_file_path that forwards to Url::from_file_path
on native and parses file://${path} via Url::parse on wasm32 - LSP
responses carry the same URL shape either way. Swap production call
sites to the helper; the two Url::from_file_path calls in
quick_fix.rs's own test module stay on the native API since tests
never run on wasm32.

Unblocks embedding KCL via wasm32-unknown-unknown for a JS-loaded SDK
bundle (akua's Phase 4B - not yet built in this repo, but the crate
must still compile for that target since kcl-api pulls in
kcl-language-server unconditionally, not behind a feature flag).

Originally landed as akua-dev/kcl@29dda76e on the akua-wasm32 branch;
from_lsp.rs and to_lsp.rs applied unchanged, util.rs rebased onto
upstream's

**File**: `crates/tools/src/LSP/src/from_lsp.rs` (modified, +4/-2)
```diff
@@ -5,10 +5,12 @@ use kcl_utils::path::PathPrefix;
 use lsp_types::{Position, Url};
 use ra_ap_vfs::AbsPathBuf;
 
+use crate::util::url_to_file_path;
+
 /// Converts the specified `uri` to an absolute path. Returns an error if the url could not be
 /// converted to an absolute path.
 pub(crate) fn abs_path(uri: &Url) -> anyhow::Result<AbsPathBuf> {
-    uri.to_file_path()
+    url_to_file_path(uri)
         .ok()
         .and_then(|path| AbsPathBuf::try_from(path).ok())
         .ok_or_else(|| anyhow::anyhow!("invalid uri: {}", uri))
@@ -51,7 +53,7 @@ pub(crate) fn text_range(text: &str, range: lsp_types::Range) -> Range<usize> {
 /// Converts the specified `url` to a utf8 encoded file path string. Returns an error if the url could not be
 /// converted to a valid utf8 encoded file path string.
 pub(crate) fn file_path_from_url(url: &Url) -> anyhow::Result<String> {
-    url.to_file_path()
+    url_to_file_path(url)
         .ok()
         .and_then(|path| {
             path.to_str()
```

**File**: `crates/tools/src/LSP/src/to_lsp.rs` (modified, +7/-5)
```diff
@@ -8,6 +8,8 @@ use kcl_utils::path::PathPrefix;
 use lsp_types::*;
 use serde_json::json;
 
+use crate::util::url_from_file_path;
+
 use std::{
     path::{Component, Path, Prefix},
     str::FromStr,
@@ -25,7 +27,7 @@ pub fn lsp_pos(pos: &KCLPos) -> Position {
 /// Convert start and pos format to lsp location.
 /// The position of the location in lsp protocol is different with position in ast node whose line number is 1 based.
 pub fn lsp_location(file_path: String, start: &KCLPos, end: &KCLPos) -> Option<Location> {
-    let uri = Url::from_file_path(file_path).ok()?;
+    let uri = url_from_file_path(file_path).ok()?;
     Some(Location {
         uri,
         range: Range {
@@ -69,7 +71,7 @@ pub fn kcl_msg_to_lsp_diags(
         Some(
             related_msg
                 .iter()
-                .filter_map(|m| match Url::from_file_path(m.range.0.filename.clone()) {
+                .filter_map(|m| match url_from_file_path(m.range.0.filename.clone()) {
                     Ok(uri) => Some(DiagnosticRelatedInformation {
                         location: Location {
                             uri,
@@ -183,7 +185,7 @@ pub(crate) fn url_from_path(path: impl AsRef<Path>) -> anyhow::Result<Url> {
 /// Returns a `Url` object from a given path, will lowercase drive letters if present.
 /// This will only happen when processing Windows paths.
 ///
-/// When processing non-windows path, this is essentially do the same as `Url::from_file_path`.
+/// When processing non-windows path, this is essentially do the same as `url_from_file_path`.
 pub(crate) fn url_from_path_with_drive_lowercasing(path: impl AsRef<Path>) -> anyhow::Result<Url> {
     let component_has_windows_drive = path.as_ref().components().any(|comp| {
         if let Component::Prefix(c) = comp {
@@ -197,7 +199,7 @@ pub(crate) fn url_from_path_with_drive_lowercasing(path: impl AsRef<Path>) -> an
 
     // VSCode expects drive letters to be lowercased, whereas rust will uppercase the drive letters.
     if component_has_windows_drive {
-        let url_original = Url::from_file_path(&path).map_err(|_| {
+        let url_original = url_from_file_path(&path).map_err(|_| {
             anyhow::anyhow!("can't convert path to url: {}", path.as_ref().display())
         })?;
 
@@ -214,7 +216,7 @@ pub(crate) fn url_from_path_with_drive_lowercasing(path: impl AsRef<Path>) -> an
             .map_err(|e| anyhow::anyhow!("Url from str ParseError: {}", e))?;
         Ok(url)
     } else {
-        Ok(Url::from_file_path(&path).map_err(|_| {
+        Ok(url_from_file_path(&path).map_err(|_| {
             anyhow::anyhow!("can't convert path to url: {}", path.as_ref().display())
         })?)
     }
```

**File**: `crates/tools/src/LSP/src/util.rs` (modified, +33/-1)
```diff
@@ -18,6 +18,38 @@ use serde::{Serialize, de::DeserializeOwned};
 use std::fs;
 use std::path::{Path, PathBuf};
 
+/// `Url::from_file_path` is `cfg(any(unix, windows))` in the `url`
+/// crate - unavailable on `wasm32-unknown-unknown`. The LSP only
+/// needs a `file://` URL for a path, so on wasm32 we build one via
+/// `Url::parse`. No Windows-drive handling on wasm32 since that
+/// target has no filesystem anyway.
+pub(crate) fn url_from_file_path<P: AsRef<Path>>(path: P) -> Result<Url, ()> {
+    #[cfg(not(target_arch = "wasm32"))]
+    {
+        Url::from_file_path(path)
+    }
+    #[cfg(target_arch = "wasm32")]
+    {
+        let p = path.as_ref().to_string_lossy();
+        Url::parse(&format!("file://{p}")).map_err(|_| ())
+    }
+}
+
+/// Inverse of [`url_from_file_path`]. Same story: `to_file_path` is
+/// `cfg(any(unix, windows))` on `url`. On wasm32 we strip the
+/// `file://` prefix and return the remainder as a `PathBuf`.
+pub(crate) fn url_to_file_path(url: &Url) -> Result<PathBuf, ()> {
+    #[cfg(not(target_arch = "wasm32"))]
+    {
+        url.to_file_path()
+    }
+    #[cfg(target_arch = "wasm32")]
+    {
+        let s = url.as_str();
+        s.strip_prefix("file://").map(PathBuf::from).ok_or(())
+    }
+}
+
 /// Deserializes a `T` from a json value.
 pub(crate) fn from_json<T: DeserializeOwned>(
     what: &'static str,
@@ -73,7 +105,7 @@ pub(crate) fn load_files_code_from_vfs(
     let mut res = vec![];
     let vfs = &mut vfs.read();
     for file in files {
-        let url = Url::from_file_path(file)
+        let url = url_from_file_path(file)
             .map_err(|_| anyhow::anyhow!("can't convert file to url: {}", file))?;
         let path = from_lsp::abs_path(&url)?;
         match vfs.file_id(&path.clone().into()) {
```

---

### Incident Patch 3: `931e6a98` (2026-09-26)
**Commit Message**: fix(api): use a single service method registry for BuiltinService.ListMethod (#2205)

Signed-off-by: Peefy <peefy@qq.com>
Co-authored-by: Peefy <peefy@qq.com>

**File**: `crates/api/src/service/capi.rs` (modified, +13/-3)
```diff
@@ -203,7 +203,17 @@ pub unsafe extern "C-unwind" fn kcl_service_call_with_length(
 }
 
 pub(crate) fn kcl_get_service_fn_ptr_by_name(name: &str) -> u64 {
-    match name {
+    lookup_service_fn_ptr(name).unwrap_or_else(|| panic!("unknown method name : {name}"))
+}
+
+/// Look up the native FFI function pointer for a service method name.
+///
+/// Returns `None` for unknown names instead of panicking so the registry
+/// consistency against [`SERVICE_METHODS`](crate::service::SERVICE_METHODS)
+/// can be unit-tested; [`kcl_get_service_fn_ptr_by_name`] wraps this with
+/// the panicking behavior the C ABI expects.
+pub(crate) fn lookup_service_fn_ptr(name: &str) -> Option<u64> {
+    Some(match name {
         "KclService.Ping" => ping as *const () as u64,
         "KclService.GetVersion" => get_version as *const () as u64,
         "KclService.ParseFile" => parse_file as *const () as u64,
@@ -230,8 +240,8 @@ pub(crate) fn kcl_get_service_fn_ptr_by_name(name: &str) -> u64 {
         // both services share the same PingArgs/PingResult message types.
         "BuiltinService.Ping" => ping as *const () as u64,
         "BuiltinService.ListMethod" => list_method as *const () as u64,
-        _ => panic!("unknown method name : {name}"),
-    }
+        _ => return None,
+    })
 }
 
 /// ping is used to test whether kcl service is successfully imported
```

**File**: `crates/api/src/service/jsonrpc.rs` (modified, +26/-24)
```diff
@@ -1,4 +1,5 @@
 use crate::gpyrpc::*;
+use crate::service::SERVICE_METHODS;
 use crate::service::service_impl::KclServiceImpl;
 use core::fmt::Display;
 use jsonrpc_stdio_server::ServerBuilder;
@@ -244,30 +245,10 @@ fn register_builtin_service(io: &mut IoHandler) {
     });
     io.add_sync_method("BuiltinService.ListMethod", |_params: Params| {
         let result = ListMethodResult {
-            method_name_list: vec![
-                "KclService.Ping".to_owned(),
-                "KclService.GetVersion".to_owned(),
-                "KclService.ParseFile".to_owned(),
-                "KclService.ParseProgram".to_owned(),
-                "KclService.ExecProgram".to_owned(),
-                "KclService.BuildProgram".to_owned(),
-                "KclService.ExecArtifact".to_owned(),
-                "KclService.OverrideFile".to_owned(),
-                "KclService.GetSchemaType".to_owned(),
-                "KclService.GetFullSchemaType".to_owned(),
-                "KclService.GetSchemaTypeMapping".to_owned(),
-                "KclService.FormatCode".to_owned(),
-                "KclService.FormatPath".to_owned(),
-                "KclService.LintPath".to_owned(),
-                "KclService.ValidateCode".to_owned(),
-                "KclService.LoadSettingsFiles".to_owned(),
-                "KclService.Rename".to_owned(),
-                "KclService.RenameCode".to_owned(),
-                "KclService.Test".to_owned(),
-                "KclService.UpdateDependencies".to_owned(),
-                "BuiltinService.Ping".to_owned(),
-                "BuiltinService.PingListMethod".to_owned(),
-            ],
+            method_name_list: SERVICE_METHODS
+                .iter()
+                .map(|name| name.to_string())
+                .collect(),
         };
         serde_json::to_value(result).map_err(|e| Error {
             code: ErrorCode::from(KCL_SERVER_ERROR_CODE),
@@ -276,3 +257,24 @@ fn register_builtin_service(io: &mut IoHandler) {
         })
     });
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    /// The JSON-RPC `BuiltinService.ListMethod` response must advertise
+    /// exactly the shared registry.
+    #[test]
+    fn builtin_list_method_matches_registry() {
+        let mut io = IoHandler::default();
+        register_builtin_service(&mut io);
+        let request =
+            r#"{"jsonrpc":"2.0","method":"BuiltinService.ListMethod","params":{},"id":1}"#;
+        let response = io
+            .handle_request_sync(request)
+            .expect("BuiltinService.ListMethod should be registered");
+        let response: serde_json::Value = serde_json::from_str(&response).unwrap();
+        let expected = serde_json::json!({ "method_name_list": SERVICE_METHODS });
+        assert_eq!(response["result"], expected);
+    }
+}
```

**File**: `crates/api/src/service/mod.rs` (modified, +82/-0)
```diff
@@ -9,3 +9,85 @@ pub(crate) mod ty;
 pub(crate) mod util;
 
 pub use service_impl::KclServiceImpl;
+
+/// Single source of truth for the KCL service method registry.
+///
+/// Every name advertised by `BuiltinService.ListMethod` must be dispatchable
+/// through the native FFI table ([`capi::lookup_service_fn_ptr`]) and
+/// registered on the JSON-RPC server, and vice versa. The order follows the
+/// `KclService` RPC declaration order in `spec.proto` — methods that were
+/// removed from the spec (`BuildProgram`, `ExecArtifact`, ...) are
+/// intentionally absent — followed by the `BuiltinService` methods.
+pub(crate) const SERVICE_METHODS: &[&str] = &[
+    "KclService.Ping",
+    "KclService.GetVersion",
+    "KclService.ParseProgram",
+    "KclService.ParseFile",
+    "KclService.LoadPackage",
+    "KclService.ListOptions",
+    "KclService.ListVariables",
+    "KclService.ExecProgram",
+    "KclService.OverrideFile",
+    "KclService.GetSchemaTypeMapping",
+    "KclService.GetSchemaTypeMappingUnderPath",
+    "KclService.FormatCode",
+    "KclService.FormatPath",
+    "KclService.LintPath",
+    "KclService.ValidateCode",
+    "KclService.LoadSettingsFiles",
+    "KclService.Rename",
+    "KclService.RenameCode",
+    "KclService.Test",
+    "KclService.UpdateDependencies",
+    "BuiltinService.Ping",
+    "BuiltinService.ListMethod",
+];
+
+#[cfg(test)]
+mod tests {
+    use super::SERVICE_METHODS;
+    use crate::service::capi::lookup_service_fn_ptr;
+    use crate::service::service_impl::KclServiceImpl;
+
+    /// Every method advertised by `BuiltinService.ListMethod` must have a
+    /// native FFI entry so callers can actually invoke it.
+    #[test]
+    fn advertised_methods_are_dispatchable() {
+        for name in SERVICE_METHODS {
+            assert!(
+                lookup_service_fn_ptr(name).is_some(),
+                "advertised method {name} is missing from the native dispatch table"
+            );
+        }
+        assert!(lookup_service_fn_ptr("KclService.DoesNotExist").is_none());
+    }
+
+    /// `KclServiceImpl::list_method` must return exactly the registry.
+    #[test]
+    fn list_method_matches_registry() {
+        let serv = KclServiceImpl::default();
+        let result = serv.list_method(&Default::default()).unwrap();
+        let expected: Vec<String> = SERVICE_METHODS
+            .iter()
+            .map(|name| name.to_string())
+            .collect();
+        assert_eq!(result.method_name_list, expected);
+    }
+
+    /// Methods removed from the spec must not creep back into the registry.
+    #[test]
+    fn registry_excludes_removed_methods() {
+        for removed in [
+            "KclService.BuildProgram",
+            "KclService.ExecArtifact",
+            "KclService.ListDepFiles",
+            "KclService.GetSchemaType",
+            "KclService.GetFullSchemaType",
+        ] {
+            assert!(
+                !SERVICE_METHODS.contains(&removed),
+                "registry still advertises removed method {removed}"
+            );
+        }
+    }
+}
```

**File**: `crates/api/src/service/service_impl.rs` (modified, +9/-29)
```diff
@@ -37,6 +37,7 @@ use kcl_tools::vet::validator::ValidateOption;
 use kcl_tools::vet::validator::validate;
 use tempfile::NamedTempFile;
 
+use super::SERVICE_METHODS;
 use super::into::*;
 use super::ty::kcl_schema_ty_to_pb_ty;
 use super::util::{transform_exec_para, transform_str_para};
@@ -331,37 +332,16 @@ impl KclServiceImpl {
     }
 
     /// ListMethod KclService, return the list of KCL service method names
-    /// available in the underlying runtime. Mirrors the JSON-RPC
-    /// `BuiltinService.ListMethod` registration so the C ABI dispatch table
-    /// stays in sync with what callers see over JSON-RPC.
+    /// available in the underlying runtime. The list is sourced from the
+    /// shared [`SERVICE_METHODS`](crate::service::SERVICE_METHODS) registry
+    /// so it stays in sync with the C ABI dispatch table and the JSON-RPC
+    /// `BuiltinService.ListMethod` registration.
     pub fn list_method(&self, _args: &ListMethodArgs) -> anyhow::Result<ListMethodResult> {
         Ok(ListMethodResult {
-            method_name_list: vec![
-                "KclService.Ping".to_owned(),
-                "KclService.GetVersion".to_owned(),
-                "KclService.ParseFile".to_owned(),
-                "KclService.ParseProgram".to_owned(),
-                "KclService.LoadPackage".to_owned(),
-                "KclService.ListOptions".to_owned(),
-                "KclService.ListVariables".to_owned(),
-                "KclService.ExecProgram".to_owned(),
-                "KclService.BuildProgram".to_owned(),
-                "KclService.ExecArtifact".to_owned(),
-                "KclService.OverrideFile".to_owned(),
-                "KclService.GetSchemaTypeMapping".to_owned(),
-                "KclService.GetSchemaTypeMappingUnderPath".to_owned(),
-                "KclService.FormatCode".to_owned(),
-                "KclService.FormatPath".to_owned(),
-                "KclService.LintPath".to_owned(),
-                "KclService.ValidateCode".to_owned(),
-                "KclService.LoadSettingsFiles".to_owned(),
-                "KclService.Rename".to_owned(),
-                "KclService.RenameCode".to_owned(),
-                "KclService.Test".to_owned(),
-                "KclService.UpdateDependencies".to_owned(),
-                "BuiltinService.Ping".to_owned(),
-                "BuiltinService.ListMethod".to_owned(),
-            ],
+            method_name_list: SERVICE_METHODS
+                .iter()
+                .map(|name| name.to_string())
+                .collect(),
         })
     }
 
```

---

### Incident Patch 4: `dccc38ec` (2026-09-26)
**Commit Message**: fix(api): make ValidateCode, Rename and UpdateDependencies work on WASI/wasm32 (#2203)

The wasm32-wasip1 build of KclService had three sandbox-related defects:

- ValidateCode panicked because NamedTempFile::new() calls
  std::env::temp_dir(), which panics with "no filesystem on wasm" on
  wasip1. With panic=abort that traps and destroys the whole WASI
  instance. Create the temporary data file in the sandbox working
  directory instead on wasm32 so ValidateCode works.
- UpdateDependencies was compiled out on wasm32, so the C API dispatcher
  panicked with "unknown method name" (another instance-killing trap).
  Register the method on all targets and return a graceful error on
  wasm32: the WASI sandbox has no network or subprocess support to
  download KCL modules.
- Rename failed with "operation not supported" because
  std::fs::canonicalize is unsupported on wasip1. Fall back to a lexical
  path normalization (resolving . and .. against the sandbox working
  directory, no symlink resolution) on wasm32 so Rename works on
  sandbox files.

Also report check/assert runtime errors gracefully on wasm32. The
evaluator signals failing schema check blocks, rules and assert
statements b

**File**: `crates/api/src/service/capi.rs` (modified, +0/-2)
```diff
@@ -225,7 +225,6 @@ pub(crate) fn kcl_get_service_fn_ptr_by_name(name: &str) -> u64 {
         "KclService.Rename" => rename as *const () as u64,
         "KclService.RenameCode" => rename_code as *const () as u64,
         "KclService.Test" => test as *const () as u64,
-        #[cfg(not(target_arch = "wasm32"))]
         "KclService.UpdateDependencies" => update_dependencies as *const () as u64,
         // BuiltinService.Ping reuses the KclService.Ping implementation —
         // both services share the same PingArgs/PingResult message types.
@@ -652,7 +651,6 @@ pub(crate) fn test(
     call!(serv, args, args_len, result_len, TestArgs, test)
 }
 
-#[cfg(not(target_arch = "wasm32"))]
 /// Service for the dependencies updating
 /// calling information.
 ///
```

**File**: `crates/api/src/service/service_impl.rs` (modified, +55/-3)
```diff
@@ -1171,7 +1171,13 @@ impl KclServiceImpl {
     /// assert_eq!(result.success, true);
     /// ```
     pub fn validate_code(&self, args: &ValidateCodeArgs) -> anyhow::Result<ValidateCodeResult> {
+        // WASI has no temporary directory (`std::env::temp_dir` panics on
+        // wasm32-wasip1), so the data file is created inside the sandbox
+        // working directory instead. The file is removed when `file` drops.
+        #[cfg(not(target_arch = "wasm32"))]
         let mut file = NamedTempFile::new()?;
+        #[cfg(target_arch = "wasm32")]
+        let mut file = NamedTempFile::new_in(".")?;
         let file_path = if args.datafile.is_empty() {
             // Write some test data to the first handle.
             file.write_all(args.data.as_bytes())?;
@@ -1277,14 +1283,13 @@ impl KclServiceImpl {
     /// # fs::remove_file(path.clone()).unwrap();
     /// ```
     pub fn rename(&self, args: &RenameArgs) -> anyhow::Result<RenameResult> {
-        let pkg_root = PathBuf::from(args.package_root.clone())
-            .canonicalize()?
+        let pkg_root = normalize_path(&PathBuf::from(args.package_root.clone()))?
             .display()
             .to_string();
         let symbol_path = args.symbol_path.clone();
         let mut file_paths = vec![];
         for path in args.file_paths.iter() {
-            file_paths.push(PathBuf::from(path).canonicalize()?.display().to_string());
+            file_paths.push(normalize_path(&PathBuf::from(path))?.display().to_string());
         }
         let new_name = args.new_name.clone();
         Ok(RenameResult {
@@ -1447,6 +1452,53 @@ impl KclServiceImpl {
                 .collect(),
         })
     }
+
+    #[cfg(target_arch = "wasm32")]
+    /// update_dependencies is unavailable on WASM/WASI: resolving module
+    /// dependencies requires network access and git subprocesses, which the
+    /// WASI sandbox does not provide. This returns a graceful error (instead
+    /// of the dispatcher panicking on the unknown method name) so the WASM
+    /// instance stays usable.
+    pub fn update_dependencies(
+        &self,
+        _args: &UpdateDependenciesArgs,
+    ) -> anyhow::Result<UpdateDependenciesResult> {
+        anyhow::bail!(
+            "updating dependencies is not supported in the WASM build: the WASI sandbox has no network access or subprocess support to download KCL modules"
+        )
+    }
+}
+
+/// Normalize a path for the rename service.
+///
+/// On native targets this is `fs::canonicalize` (resolving symlinks). On
+/// WASM/WASI `fs::canonicalize` is unsupported, so fall back to a lexical
+/// normalization that resolves `.` and `..` segments against the sandbox
+/// working directory without touching the filesystem (WASI preview1 has no
+/// path resolution against symlinks anyway).
+#[cfg(not(target_arch = "wasm32"))]
+fn normalize_path(path: &std::path::Path) -> anyhow::Result<PathBuf> {
+    Ok(path.canonicalize()?)
+}
+
+#[cfg(target_arch = "wasm32")]
+fn normalize_path(path: &std::path::Path) -> anyhow::Result<PathBuf> {
+    use std::path::Component;
+    let mut normalized = if path.is_absolute() {
+        PathBuf::new()
+    } else {
+        std::env::current_dir()?
+    };
+    for component in path.components() {
+        match component {
+            Component::CurDir => {}
+            Component::ParentDir => {
+                normalized.pop();
+            }
+            other => normalized.push(other.as_os_str()),
+        }
+    }
+    Ok(normalized)
 }
 
 #[cfg(test)]
```

**File**: `crates/evaluator/src/lib.rs` (modified, +7/-0)
```diff
@@ -222,6 +222,13 @@ impl<'ctx> Evaluator<'ctx> {
         let modules = self.program.get_modules_for_pkg(kcl_ast::MAIN_PKG);
         self.init_scope(kcl_ast::MAIN_PKG);
         self.compile_ast_modules(&modules);
+        // On wasm32, runtime errors from check/assert blocks are recorded
+        // into the context instead of panicking (panic=abort would trap the
+        // whole WASI instance); bail out with the recorded error here.
+        #[cfg(target_arch = "wasm32")]
+        if let Some(info) = self.runtime_ctx.borrow().get_panic_info_json_string() {
+            return Err(anyhow::anyhow!(info));
+        }
         Ok(self.plan_globals_to_string())
     }
 
```

**File**: `crates/evaluator/src/node.rs` (modified, +17/-2)
```diff
@@ -269,9 +269,24 @@ impl<'ctx> TypedResultWalker<'ctx> for Evaluator<'ctx> {
             };
             if !assert_result.is_truthy() {
                 let mut ctx = self.runtime_ctx.borrow_mut();
-                ctx.set_err_type(&RuntimeErrorType::AssertionError);
                 let msg = msg.as_str();
-                panic!("{}", msg);
+                // On wasm32, record the error instead of panicking: the
+                // build uses panic=abort, so a panic would trap and destroy
+                // the whole WASI instance. The evaluator bails out after
+                // the run finishes.
+                #[cfg(target_arch = "wasm32")]
+                {
+                    if !ctx.has_panic_info() {
+                        ctx.record_runtime_error_message(msg.to_string());
+                    }
+                    ctx.set_err_type(&RuntimeErrorType::AssertionError);
+                    return;
+                }
+                #[cfg(not(target_arch = "wasm32"))]
+                {
+                    ctx.set_err_type(&RuntimeErrorType::AssertionError);
+                    panic!("{}", msg);
+                }
             }
         };
         if let Some(if_cond) = &assert_stmt.if_cond {
```

**File**: `crates/evaluator/src/rule.rs` (modified, +15/-0)
```diff
@@ -142,8 +142,23 @@ pub fn rule_check(
     }
     // Call self check function
     for check_expr in &ctx.borrow().node.checks {
+        #[cfg(not(target_arch = "wasm32"))]
         s.walk_check_expr(&check_expr.node)
             .expect(kcl_error::RUNTIME_ERROR_MSG);
+        // On wasm32 a panic would trap the whole WASI instance (the build
+        // uses panic=abort); record the error instead and let the evaluator
+        // bail out with it after the run finishes.
+        #[cfg(target_arch = "wasm32")]
+        if let Err(err) = s.walk_check_expr(&check_expr.node) {
+            let mut runtime_ctx = s.runtime_ctx.borrow_mut();
+            if !runtime_ctx.has_panic_info() {
+                runtime_ctx.record_runtime_error_message(format!(
+                    "{}: {}",
+                    kcl_error::RUNTIME_ERROR_MSG,
+                    err
+                ));
+            }
+        }
     }
     ctx.borrow().value.clone()
 }
```

---

### Incident Patch 5: `8613484e` (2026-09-26)
**Commit Message**: fix(runtime): scope file.* builtin operations to the current module root (#2189)

* fix(runtime): scope file.* builtin operations to the current module root

The `file.read`, `file.write`, `file.glob`, and related builtins accepted
arbitrary user-supplied paths, which let a KCL module reach outside its
own directory (e.g. via `../../../etc/passwd`). Now every path-taking
function is resolved relative to the current module's directory and a
panic is raised if the resolved path escapes via `..`.

This mirrors Kustomize's `--load-restrictor` and keeps KCL packages
self-contained, an explicit ask from kcl-lang/kcl#1886. The check is
based on the currently-executing source file in `panic_info.kcl_file`,
falling back to the runtime `workdir` for synthetic contexts.

Users who genuinely need to reach outside their package (e.g. tooling
that consumes system-wide fixtures) can opt out by setting
`KCL_FILE_SCOPE=off` (or `0`/`false`/`no`).

* Scope-check helper + 5 unit tests in `crates/runtime/src/file/utils.rs`
* `module_root` / `scope_or_panic` helpers and per-function call sites
  in `crates/runtime/src/file/mod.rs`
* Five stderr.golden files updated to reflect that scoped paths are
  no

**File**: `crates/runtime/src/file/mod.rs` (modified, +87/-18)
```diff
@@ -6,6 +6,50 @@ use crate::*;
 use glob::glob;
 use std::io::Write;
 use std::path::Path;
+use utils::{resolve_scoped_path, scope_enabled};
+
+/// Return the directory that should be treated as the root for `file.*`
+/// operations issued from this context — i.e. the directory containing the
+/// KCL source file currently being executed. Falls back to the runtime
+/// `workdir` when the current file is not set (which can happen for some
+/// synthetic/test contexts); in that case scope checks still apply, just
+/// with a different root.
+///
+/// Returns `None` if neither is available, in which case the caller should
+/// skip the scope check (the path is returned as-is).
+fn module_root(ctx: &crate::Context) -> Option<std::path::PathBuf> {
+    let file = ctx.panic_info.kcl_file.trim();
+    if !file.is_empty()
+        && let Some(parent) = std::path::Path::new(file).parent()
+        && !parent.as_os_str().is_empty()
+    {
+        return Some(parent.to_path_buf());
+    }
+    let workdir = ctx.workdir.trim();
+    if !workdir.is_empty() {
+        return Some(std::path::PathBuf::from(workdir));
+    }
+    None
+}
+
+/// Resolve `user_path` against the module root, panicking with a clear
+/// scope error if the path would escape the root. Skips the check when no
+/// module root can be determined (we'd rather let the underlying I/O fail
+/// than over-restrict on synthetic contexts) or when the user has opted
+/// out via `KCL_FILE_SCOPE=off`.
+fn scope_or_panic(ctx: &crate::Context, user_path: &str) -> std::path::PathBuf {
+    if !scope_enabled() {
+        return std::path::PathBuf::from(user_path);
+    }
+    let Some(root) = module_root(ctx) else {
+        return std::path::PathBuf::from(user_path);
+    };
+    let (resolved, err) = resolve_scoped_path(&root, user_path);
+    if let Err(msg) = err {
+        panic!("{}", msg);
+    }
+    resolved
+}
 
 /// # Safety
 /// The caller must ensure that `ctx`, `args`, and `kwargs` are valid pointers
@@ -20,8 +64,9 @@ pub unsafe extern "C-unwind" fn kcl_file_read(
     let ctx = unsafe { mut_ptr_as_ref(ctx) };
 
     if let Some(x) = get_call_arg_str(args, kwargs, 0, Some("filepath")) {
+        let x = scope_or_panic(ctx, &x);
         let contents = fs::read_to_string(&x)
-            .unwrap_or_else(|e| panic!("failed to access the file '{}': {}", x, e));
+            .unwrap_or_else(|e| panic!("failed to access the file '{}': {}", x.display(), e));
 
         let s = ValueRef::str(contents.as_ref());
         return s.into_raw(ctx);
@@ -50,8 +95,9 @@ pub unsafe extern "C-unwind" fn kcl_file_readbase64(
     let ctx = unsafe { mut_ptr_as_ref(ctx) };
 
     if let Some(x) = get_call_arg_str(args, kwargs, 0, Some("filepath")) {
-        let bytes =
-            fs::read(&x).unwrap_or_else(|e| panic!("failed to access the file '{}': {}", x, e));
+        let x = scope_or_panic(ctx, &x);
+        let bytes = fs::read(&x)
+            .unwrap_or_else(|e| panic!("failed to access the file '{}': {}", x.display(), e));
         // Use the fully-qualified path so we don't collide with the
         // local `kcl_runtime::base64` re-export that the runtime ships.
         let encoded = ::base64::encode(&bytes);
@@ -77,8 +123,17 @@ pub unsafe extern "C-unwind" fn kcl_file_glob(
     let pattern = get_call_arg_str(args, kwargs, 0, Some("pattern"))
         .expect("glob() takes exactly one argument (0 given)");
 
+    // Resolve the pattern against the module root first so that it cannot
+    // escape the package directory; glob the scoped form (this also makes
+    // relative patterns resolve against the module root rather than the
+    // process working directory).
+    let scoped_pattern = scope_or_panic(ctx, &pattern);
+    let scoped_pattern = scoped_pattern.to_str().unwrap_or(&pattern);
+
     let mut matched_paths = vec![];
-    for entry in glob(&pattern).unwrap_or_else(|e| panic!("Failed to read glob pattern: {}", e)) {
+    for entry in
+        glob(scoped_patter
```

**File**: `crates/runtime/src/file/utils.rs` (modified, +294/-1)
```diff
@@ -1,4 +1,7 @@
-use std::{fs, path::Path};
+use std::{
+    fs,
+    path::{Component, Path, PathBuf},
+};
 
 pub(crate) fn copy_directory(src: &Path, dst: &Path) -> std::io::Result<()> {
     if !dst.exists() {
@@ -17,3 +20,293 @@ pub(crate) fn copy_directory(src: &Path, dst: &Path) -> std::io::Result<()> {
     }
     Ok(())
 }
+
+/// Resolve `user_path` against the module root derived from
+/// `module_root` and return the canonicalized absolute path. Relative paths
+/// are joined onto the canonical root; absolute paths are only accepted when
+/// they lie inside the root (compared after canonicalization, so symlinks
+/// pointing outside the root are rejected as well). Paths that would escape
+/// — via `..` or by targeting a location outside the root — come back with
+/// an error. If `module_root` itself cannot be canonicalized, the path is
+/// returned unchanged with `Ok(())` so callers can still surface a regular
+/// filesystem error (instead of a scope error) and avoid masking real bugs.
+///
+/// Set the env var `KCL_FILE_SCOPE=off` (or the literal value `"0"`,
+/// `"false"`, `"no"`) to bypass the scope check entirely — useful for
+/// ad-hoc scripts and existing tests that intentionally reach outside
+/// their package directory. See kcl-lang/kcl#1886 for context.
+pub(crate) fn resolve_scoped_path<P: AsRef<Path>>(
+    module_root: P,
+    user_path: &str,
+) -> (PathBuf, Result<(), String>) {
+    let module_root = module_root.as_ref();
+
+    // Allow opting out of the scope check.
+    if let Some(value) = std::env::var_os("KCL_FILE_SCOPE") {
+        let value = value.to_string_lossy().to_ascii_lowercase();
+        if matches!(value.as_str(), "off" | "0" | "false" | "no") {
+            return (PathBuf::from(user_path), Ok(()));
+        }
+    }
+
+    // Reject obvious traversal attempts up-front so we don't depend on the
+    // target existing (the caller's `fs::*` call will surface that error
+    // itself). This check is purely syntactic and deliberately runs before
+    // any filesystem access: `canonicalize` on the module root can fail
+    // transiently (observed on the Windows CI runners for freshly created
+    // directories), and a traversal attempt must not slip through just
+    // because the root could not be canonicalized. It is also load-bearing
+    // on Windows, where a `..` inside an otherwise verbatim path is treated
+    // literally by the filesystem.
+    if path_has_parent_ref(Path::new(user_path)) {
+        return (
+            PathBuf::from(user_path),
+            Err(format!(
+                "path '{}' escapes module root '{}'",
+                user_path,
+                module_root.display()
+            )),
+        );
+    }
+
+    let canonical_root = match fs::canonicalize(module_root) {
+        Ok(p) => p,
+        Err(_) => return (PathBuf::from(user_path), Ok(())),
+    };
+
+    let candidate = Path::new(user_path);
+    let candidate = if candidate.is_absolute() {
+        candidate.to_path_buf()
+    } else {
+        canonical_root.join(candidate)
+    };
+
+    // Absolute paths (and relative paths routed through a symlink that
+    // points outside the root) must not escape either. Compare
+    // canonicalized forms so symlink components are resolved before the
+    // check; paths that don't exist yet are canonicalized through their
+    // nearest existing ancestor so writes to new files still get checked.
+    if !path_within_root(&candidate, &canonical_root) {
+        return (
+            candidate,
+            Err(format!(
+                "path '{}' escapes module root '{}'",
+                user_path,
+                canonical_root.display()
+            )),
+        );
+    }
+
+    (candidate, Ok(()))
+}
+
+/// Canonicalize `p`, falling back to the nearest existing ancestor for paths
+/// that do not exist yet (writes to new files), re-appending the missing
+/// trailing components. Returns `None` only when no ancestor can be
+/// cano
```

**File**: `tests/grammar/builtins/file/cp/stderr.golden` (modified, +1/-1)
```diff
@@ -2,5 +2,5 @@ error[E3M38]: EvaluationError
  --> ${CWD}/main.k:3:1
   |
 3 | file.cp("source.txt", "destination.txt")
-  |  Failed to copy from 'source.txt' to 'destination.txt': No such file or directory (os error 2)
+  |  Failed to copy from '${CWD}/source.txt' to '${CWD}/destination.txt': No such file or directory (os error 2)
   |
\ No newline at end of file
```

**File**: `tests/grammar/builtins/file/delete/stderr.golden` (modified, +1/-1)
```diff
@@ -2,5 +2,5 @@ error[E3M38]: EvaluationError
  --> ${CWD}/main.k:3:1
   |
 3 | file.delete("test_dir")
-  |  failed to delete 'test_dir': No such file or directory (os error 2)
+  |  failed to delete '${CWD}/test_dir': No such file or directory (os error 2)
   |
\ No newline at end of file
```

**File**: `tests/grammar/builtins/file/load_file_invalid/stderr.golden` (modified, +1/-1)
```diff
@@ -1 +1 @@
-failed to access the file 'not_exist.txt': No such file or directory
\ No newline at end of file
+failed to access the file '${CWD}/not_exist.txt': No such file or directory
\ No newline at end of file
```

---

### Incident Patch 6: `93d3035a` (2026-09-25)
**Commit Message**: feat(sema): enforce `_\`-prefixed top-level declarations as module-private (#1576) (#2193)

* feat(sema): enforce `_`-prefixed top-level declarations as module-private (#1576)

Top-level declarations prefixed with `_` are now rejected when referenced
from a different package, formalizing the existing convention that was
previously only honored at the JSON/YAML output layer (`show_hidden`,
`ignore_private`) and the config-merge layer (`is_private_field`).

Same-package references still resolve, so a file can use its own
helpers without ceremony. Schema attributes named `_foo` remain
inheritance-visible because they go through `schema_load_attr`, not
this branch.

A new test case (`test_resolve_program_private_cross_pkg_fail`) covers
the rejection; existing tests are unaffected.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
Signed-off-by: Peefy <xpf6677@163.com>

* style: apply cargo fmt

Signed-off-by: Peefy <xpf6677@163.com>

* fix(sema): unwrap resolve_program() result in private-member test (post #2191)

Signed-off-by: Peefy <xpf6677@163.com>

* test(tools): drop cross-package _b reference from lint fixture

The lint test data referenced import_test.b._b, which the new

**File**: `crates/sema/src/resolver/attr.rs` (modified, +16/-0)
```diff
@@ -2,6 +2,7 @@ use std::sync::Arc;
 
 use crate::builtin::system_module::{UNITS, UNITS_NUMBER_MULTIPLIER, get_system_module_members};
 use crate::builtin::{STRING_MEMBER_FUNCTIONS, get_system_member_function_ty};
+use crate::info::is_private_field;
 use crate::resolver::Resolver;
 use crate::ty::TypeKind::Schema;
 use crate::ty::{
@@ -101,6 +102,21 @@ impl<'ctx> Resolver<'_> {
                                     self.handler
                                             .add_compile_error(&format!("can not import the attribute '{}' from the module '{}'", attr, module_ty.pkgpath), range.clone());
                                 }
+                                // Enforce `_`-prefixed top-level declarations as
+                                // module-private (kcl-lang/kcl#1576). The error
+                                // is recorded but resolution continues so the
+                                // rest of the program still gets a type (Any)
+                                // and downstream symbol registration is not
+                                // short-circuited.
+                                if is_private_field(attr) && module_ty.pkgpath != self.ctx.pkgpath {
+                                    self.handler.add_compile_error(
+                                        &format!(
+                                            "cannot reference private member '{}' from module '{}'",
+                                            attr, module_ty.pkgpath
+                                        ),
+                                        range.clone(),
+                                    );
+                                }
                                 (true, v.borrow().ty.clone())
                             }
                             None => (false, self.any_ty()),
```

**File**: `crates/sema/src/resolver/test_fail_data/cross_pkg_private/file1.k` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+_internal = 42
+public_api = "ok"
\ No newline at end of file
```

**File**: `crates/sema/src/resolver/test_fail_data/cross_pkg_private/file2.k` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+import .file1
+
+leak = file1._internal
+use_public = file1.public_api
\ No newline at end of file
```

**File**: `crates/sema/src/resolver/tests.rs` (modified, +23/-0)
```diff
@@ -275,6 +275,29 @@ fn test_resolve_program_cycle_reference_fail() {
     }
 }
 
+#[test]
+fn test_resolve_program_private_cross_pkg_fail() {
+    // kcl-lang/kcl#1576: top-level declarations prefixed with `_` are
+    // module-private and must not be referenced from another package.
+    let sess = Arc::new(ParseSession::default());
+    let mut program = load_program(
+        sess.clone(),
+        &["./src/resolver/test_fail_data/cross_pkg_private/file2.k"],
+        None,
+        None,
+    )
+    .unwrap()
+    .program;
+    let scope = resolve_program(&mut program).unwrap();
+    let diagnostics = &scope.handler.diagnostics;
+    assert!(
+        diagnostics.iter().any(|d| d.messages[0]
+            .message
+            .contains("cannot reference private member '_internal' from module 'file1'")),
+        "expected the private-member diagnostic, got {diagnostics:?}"
+    );
+}
+
 #[test]
 fn test_record_used_module() {
     let sess = Arc::new(ParseSession::default());
```

**File**: `crates/tools/src/lint/test_data/import_test/b.k` (modified, +1/-1)
```diff
@@ -1 +1 @@
-_b = 1
\ No newline at end of file
+value = 1
\ No newline at end of file
```

---

### Incident Patch 7: `3414a84a` (2026-09-25)
**Commit Message**: refactor(sema): convert panic/expect sites to Result for graceful error handling (#2191)

* refactor(sema): convert panic/expect sites to Result for graceful error handling

Convert panic/expect/unwrap sites throughout the resolver pipeline to
return Result or record diagnostics, so a missing module, a poisoned
lock, or an inconsistent scope lookup no longer aborts the whole
compile. Runtime and evaluator panics are intentionally left untouched
since those are the KCL VM error-throwing mechanism.

Resolver methods with Handler access (global.rs, ty.rs) now record
the invariant violation as a `Handler::add_panic_info` diagnostic
and fall back to a usable span instead of panicking inside an
unwrapping expression.

Free functions that walk the program (pre_process_program,
type_func_erasure_pass, type_alias_pass, fix_rel_import_path_with_file)
now return `anyhow::Result<()>`. This cascades through the public
`resolve_program` / `resolve_program_with_opts` APIs which now return
`anyhow::Result<ProgramScope>`. All call sites have been updated:

- `runner`, `loader`, `query`, `tools/lint`, `tools/LSP/{compile,rename}`
  propagate via `?` or convert the error to a diagnostic so the LSP
  

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -84,3 +84,4 @@ _a.out_*.*
 
 # KCL mod lock file
 !.mod.lock
+.vercel
```

**File**: `crates/api/src/service/jsonrpc.rs` (modified, +15/-3)
```diff
@@ -49,7 +49,11 @@ where
     E: Display,
 {
     match val {
-        Ok(val) => Ok(serde_json::to_value(val).unwrap()),
+        Ok(val) => serde_json::to_value(val).map_err(|e| Error {
+            code: ErrorCode::from(KCL_SERVER_ERROR_CODE),
+            message: format!("failed to serialize result: {e}"),
+            data: None,
+        }),
         Err(err) => Err(Error {
             code: ErrorCode::from(KCL_SERVER_ERROR_CODE),
             message: err.to_string(),
@@ -232,7 +236,11 @@ fn register_builtin_service(io: &mut IoHandler) {
     io.add_sync_method("BuiltinService.Ping", |params: Params| {
         let args: PingArgs = params.parse()?;
         let result = PingResult { value: args.value };
-        Ok(serde_json::to_value(result).unwrap())
+        serde_json::to_value(result).map_err(|e| Error {
+            code: ErrorCode::from(KCL_SERVER_ERROR_CODE),
+            message: format!("failed to serialize ping result: {e}"),
+            data: None,
+        })
     });
     io.add_sync_method("BuiltinService.ListMethod", |_params: Params| {
         let result = ListMethodResult {
@@ -261,6 +269,10 @@ fn register_builtin_service(io: &mut IoHandler) {
                 "BuiltinService.PingListMethod".to_owned(),
             ],
         };
-        Ok(serde_json::to_value(result).unwrap())
+        serde_json::to_value(result).map_err(|e| Error {
+            code: ErrorCode::from(KCL_SERVER_ERROR_CODE),
+            message: format!("failed to serialize list-method result: {e}"),
+            data: None,
+        })
     });
 }
```

**File**: `crates/ast/src/ast.rs` (modified, +17/-2)
```diff
@@ -401,10 +401,25 @@ impl From<Program> for SerializeProgram {
                         modules
                             .iter()
                             .map(|m| {
+                                // The `From<Program>` impl cannot return a
+                                // `Result`, so true invariant violations
+                                // (poisoned lock or module missing from
+                                // `modules`) have to panic. Surface them
+                                // with the standard "report a bug" prefix
+                                // so they're easy to triage from bug
+                                // reports.
                                 val.get_module(m)
-                                    .expect("Failed to acquire module lock")
+                                    .expect(
+                                        "Internal error, please report a bug to us: \
+                                         failed to acquire module lock while serializing \
+                                         program",
+                                    )
                                     .unwrap_or_else(|| {
-                                        panic!("module {:?} not found in program", m)
+                                        panic!(
+                                            "Internal error, please report a bug to us: \
+                                             module {:?} not found in program while serializing",
+                                            m
+                                        )
                                     })
                                     .clone()
                             })
```

**File**: `crates/cli/src/main.rs` (modified, +9/-1)
```diff
@@ -14,7 +14,15 @@ unsafe extern "C-unwind" {
 fn main() -> ExitCode {
     // create a vector of zero terminated strings
     let args = std::env::args()
-        .map(|arg| CString::new(arg).unwrap())
+        .map(|arg| {
+            CString::new(arg).unwrap_or_else(|err| {
+                // argv containing an interior NUL byte is unrecoverable
+                // (libkcl_main takes raw C strings), so report and exit with
+                // a generic non-zero status instead of panicking.
+                eprintln!("kcl: invalid CLI argument (contains NUL byte): {err}");
+                CString::new("kcl").expect("static literal contains no NUL byte")
+            })
+        })
         .collect::<Vec<CString>>();
     // convert the strings to raw pointers
     let c_args = args
```

**File**: `crates/driver/src/client/git.rs` (modified, +6/-6)
```diff
@@ -29,8 +29,8 @@ pub(crate) fn cmd_clone_git_repo_to(
         bail!(
             "Failed to clone Git repository {}: stdout: {} stderr: {}",
             url,
-            String::from_utf8(output.stdout).unwrap(),
-            String::from_utf8(output.stderr).unwrap()
+            String::from_utf8_lossy(&output.stdout),
+            String::from_utf8_lossy(&output.stderr)
         );
     }
     if let Some(tag_name) = tag {
@@ -42,8 +42,8 @@ pub(crate) fn cmd_clone_git_repo_to(
             bail!(
                 "Failed to checkout Git tag {}: stdout: {} stderr: {}",
                 tag_name,
-                String::from_utf8(output.stdout).unwrap(),
-                String::from_utf8(output.stderr).unwrap()
+                String::from_utf8_lossy(&output.stdout),
+                String::from_utf8_lossy(&output.stderr)
             );
         }
     } else if let Some(commit_hash) = commit {
@@ -55,8 +55,8 @@ pub(crate) fn cmd_clone_git_repo_to(
             bail!(
                 "Failed to checkout Git commit {}: stdout: {} stderr: {}",
                 commit_hash,
-                String::from_utf8(output.stdout).unwrap(),
-                String::from_utf8(output.stderr).unwrap()
+                String::from_utf8_lossy(&output.stdout),
+                String::from_utf8_lossy(&output.stderr)
             )
         }
     }
```

---

### Incident Patch 8: `14a9c7c5` (2026-09-25)
**Commit Message**: fix(config): sanitize hyphens in LockDependency::gen_filename (#2188)

The OCI and Git URL branches of `gen_filename` returned the last path
segment verbatim, so a dependency whose registry or repo name contained
`-` (e.g. `oci://ghcr.io/some-org/hello-world`) ended up on disk as
`hello-world/`. KCL identifiers reject `-`, so the package could not be
imported — see kcl-lang/modules#281 — and the user had to clone the
package locally and rename the directory by hand.

Unify all three branches behind a `sanitize` closure that replaces `-`
with `_`, matching the behaviour the `name` fallback already had, and
add a regression test that exercises every branch.

Co-authored-by: Peefy <peefy@qq.com>
Co-authored-by: Claude Opus 4.6 <noreply@anthropic.com>

**File**: `crates/config/src/modfile.rs` (modified, +10/-3)
```diff
@@ -117,14 +117,21 @@ pub struct LockDependency {
 
 impl LockDependency {
     pub fn gen_filename(&self) -> String {
+        // KCL identifiers do not allow `-`, so the on-disk package name and the
+        // import path derived from it must use `_` instead. Apply the
+        // normalization on every branch (git, oci, and the name fallback) so
+        // that packages whose registry or repo name contains `-` can still be
+        // resolved and imported consistently. See kcl-lang/modules#281.
+        let sanitize = |s: &str| s.replace('-', "_");
+
         if let Some(git_url) = &self.url
             && let Ok(parsed_url) = Url::parse(git_url)
             && let Some(last_segment) = parsed_url
                 .path_segments()
                 .and_then(|mut segments| segments.next_back())
         {
             let trimmed_segment = last_segment.trim_end_matches(".git");
-            return trimmed_segment.to_string();
+            return sanitize(trimmed_segment);
         }
 
         if let Some(oci_repo) = &self.repo
@@ -133,10 +140,10 @@ impl LockDependency {
                 .path_segments()
                 .and_then(|mut segments| segments.next_back())
         {
-            return last_segment.to_string();
+            return sanitize(last_segment);
         }
 
-        self.name.replace('-', "_")
+        sanitize(&self.name)
     }
 }
 
```

**File**: `crates/config/src/tests.rs` (modified, +77/-1)
```diff
@@ -9,7 +9,7 @@ use std::{
 
 use crate::{
     cache::{CacheOption, load_pkg_cache, save_pkg_cache},
-    modfile::{KCL_PKG_PATH, get_vendor_home},
+    modfile::{KCL_PKG_PATH, LockDependency, get_vendor_home},
 };
 
 #[test]
@@ -76,3 +76,79 @@ fn test_pkg_cache() {
         Some("test_data".to_string())
     )
 }
+
+/// Regression test for kcl-lang/modules#281: importing an OCI / Git package
+/// whose repo or dependency name contains `-` previously failed because
+/// `gen_filename` returned the unsanitized last URL segment. KCL identifiers
+/// disallow `-`, so the on-disk filename must use `_` instead — same as the
+/// `name` fallback branch.
+#[test]
+fn test_gen_filename_sanitizes_hyphens() {
+    // OCI repo with a hyphen in the last segment.
+    let dep = LockDependency {
+        name: "ignored".to_string(),
+        full_name: None,
+        version: None,
+        sum: None,
+        reg: Some("ghcr.io".to_string()),
+        repo: Some("oci://ghcr.io/some-org/hello-world".to_string()),
+        oci_tag: None,
+        url: None,
+        branch: None,
+        commit: None,
+        git_tag: None,
+        path: None,
+    };
+    assert_eq!(dep.gen_filename(), "hello_world");
+
+    // Git URL with a hyphen in the last segment and a `.git` suffix.
+    let dep = LockDependency {
+        name: "ignored".to_string(),
+        full_name: None,
+        version: None,
+        sum: None,
+        reg: None,
+        repo: None,
+        oci_tag: None,
+        url: Some("https://github.com/some-org/hello-world.git".to_string()),
+        branch: None,
+        commit: None,
+        git_tag: None,
+        path: None,
+    };
+    assert_eq!(dep.gen_filename(), "hello_world");
+
+    // No URL/repo → fall back to `name`.
+    let dep = LockDependency {
+        name: "hello-world".to_string(),
+        full_name: None,
+        version: None,
+        sum: None,
+        reg: None,
+        repo: None,
+        oci_tag: None,
+        url: None,
+        branch: None,
+        commit: None,
+        git_tag: None,
+        path: None,
+    };
+    assert_eq!(dep.gen_filename(), "hello_world");
+
+    // Names without hyphens must be unchanged on every branch.
+    let dep = LockDependency {
+        name: "hello_world".to_string(),
+        full_name: None,
+        version: None,
+        sum: None,
+        reg: Some("ghcr.io".to_string()),
+        repo: Some("oci://ghcr.io/some-org/hello_world".to_string()),
+        oci_tag: None,
+        url: None,
+        branch: None,
+        commit: None,
+        git_tag: None,
+        path: None,
+    };
+    assert_eq!(dep.gen_filename(), "hello_world");
+}
```

---

### Incident Patch 9: `e5cbe209` (2026-09-25)
**Commit Message**: ci(release): fix zigbuild output subpath and Windows MSVC linker

Two fixes uncovered by the v0.13.0 dry-run:

- Linux gnu zigbuild: cargo-zigbuild uses the target name without the
  GLIBC version suffix as the output directory, so
  `target/x86_64-unknown-linux-gnu.2.17/release/libkcl.so` does not
  exist — the file actually lives under
  `target/x86_64-unknown-linux-gnu/release/libkcl.so`. Split the matrix
  into `lib_target` (passed to cargo, keeps the `.2.17` GLIBC hint) and
  `lib_subpath` (used in the cp source path). Musl targets, which have
  no GLIBC suffix, set both fields to the same value.

- Windows MSVC: `ilammy/msvc-dev-cmd@v1` exposes MSVC paths via
  GITHUB_PATH, but on `shell: bash` the runner's Git Bash resolves
  `link.exe` against `/usr/bin/link.exe` (GNU coreutils' link command)
  before MSVC's link.exe. Switch all Windows build / package steps to
  `shell: pwsh` so the linker resolution matches `windows.yaml`. As a
  bonus, package Windows artifacts as `.zip` instead of `.tar.gz` since
  that's the idiomatic format on Windows.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

**File**: `.github/workflows/release.yaml` (modified, +55/-14)
```diff
@@ -20,13 +20,15 @@ jobs:
             os: ubuntu-latest
             lib_build: zigbuild
             lib_target: x86_64-unknown-linux-gnu.2.17
+            lib_subpath: x86_64-unknown-linux-gnu
             lib_name: libkcl.so
             lsp_build: native
             lsp_bin: kcl-language-server
           - target: linux-arm64
             os: ubuntu-22.04-arm
             lib_build: zigbuild
             lib_target: aarch64-unknown-linux-gnu.2.17
+            lib_subpath: aarch64-unknown-linux-gnu
             lib_name: libkcl.so
             lsp_build: native
             lsp_bin: kcl-language-server
@@ -35,12 +37,14 @@ jobs:
             os: ubuntu-latest
             lib_build: zigbuild
             lib_target: x86_64-unknown-linux-musl
+            lib_subpath: x86_64-unknown-linux-musl
             lib_name: libkcl.a
             lsp_build: none
           - target: linux-musl-arm64
             os: ubuntu-22.04-arm
             lib_build: zigbuild
             lib_target: aarch64-unknown-linux-musl
+            lib_subpath: aarch64-unknown-linux-musl
             lib_name: libkcl.a
             lsp_build: none
           # macOS
@@ -69,7 +73,7 @@ jobs:
           - target: wasm32-wasip1
             os: ubuntu-latest
             lib_build: wasm
-            lib_target: wasm32-wasip1
+            lib_subpath: wasm32-wasip1
             lib_name: kcl.wasm
             lsp_build: none
     runs-on: ${{ matrix.os }}
@@ -104,16 +108,24 @@ jobs:
         run: |
           cargo zigbuild --target ${{ matrix.lib_target }} -r -p kcl-lib
           mkdir -p release/lib
-          cp -f target/${{ matrix.lib_target }}/release/${{ matrix.lib_name }} release/lib/
+          cp -f target/${{ matrix.lib_subpath }}/release/${{ matrix.lib_name }} release/lib/
 
-      - name: "Build kcl-lib (native: macOS / Windows)"
-        if: matrix.lib_build == 'native'
+      - name: "Build kcl-lib (native: macOS)"
+        if: matrix.lib_build == 'native' && matrix.os != 'windows-latest'
         shell: bash
         run: |
           cargo build --release -p kcl-lib
           mkdir -p release/lib
           cp -f target/release/${{ matrix.lib_name }} release/lib/
 
+      - name: "Build kcl-lib (native: Windows MSVC)"
+        if: matrix.lib_build == 'native' && matrix.os == 'windows-latest'
+        shell: pwsh
+        run: |
+          cargo build --release -p kcl-lib
+          New-Item -ItemType Directory -Force -Path release/lib | Out-Null
+          Copy-Item -Force "target/release/${{ matrix.lib_name }}" release/lib/
+
       - name: Build kcl-lib (WASM)
         if: matrix.lib_build == 'wasm'
         shell: bash
@@ -124,47 +136,76 @@ jobs:
           mkdir -p release/lib
           cp -f target/wasm32-wasip1/release/${{ matrix.lib_name }} release/lib/
 
-      - name: Build kcl-language-server
-        if: matrix.lsp_build == 'native'
+      - name: Build kcl-language-server (Linux / macOS)
+        if: matrix.lsp_build == 'native' && matrix.os != 'windows-latest'
         shell: bash
         run: |
           cargo build --release --manifest-path crates/tools/src/LSP/Cargo.toml
           mkdir -p release/language-server
           cp -f target/release/${{ matrix.lsp_bin }} release/language-server/
 
-      - name: Package kcl-lib
+      - name: Build kcl-language-server (Windows)
+        if: matrix.lsp_build == 'native' && matrix.os == 'windows-latest'
+        shell: pwsh
+        run: |
+          cargo build --release --manifest-path crates/tools/src/LSP/Cargo.toml
+          New-Item -ItemType Directory -Force -Path release/language-server | Out-Null
+          Copy-Item -Force "target/release/${{ matrix.lsp_bin }}" release/language-server/
+
+      - name: Package kcl-lib (Linux / macOS / WASM)
+        if: matrix.os != 'windows-latest'
         shell: bash
         run: |
           TAG="${{ github.ref_name }}"
           cd release/lib
           tar -czvf "../../kcl-lib-${TAG}-${{ matrix.target }}.tar.gz" .
        
```

---

### Incident Patch 10: `3c9816f7` (2026-09-22)
**Commit Message**: feat(lsp): walk up to find kcl.mod/kcl.yaml/kcl.work workspace (fixes #1510) (#2185)

The previous lookup logic only checked the file's immediate parent directory
for `kcl.mod`/`kcl.yaml`, so opening a nested file in a sub-package that
lives below a `kcl.mod` in an ancestor directory produced the wrong
compilation workspace.

* Add `lookup_compile_unit_path_bounded`, `lookup_workspace_bounded`,
  `lookup_compile_workspace_bounded`, and `lookup_compile_workspaces_bounded`
  in `crates/driver/src/lib.rs` that walk upwards until they find a
  `kcl.work`/`kcl.mod`/`kcl.yaml` or hit `max_root` (defaults to the
  filesystem root).
* `kcl.mod` is only treated as a compile-unit root when it has a
  `[package]` section or `[profile].entries`, so legacy `[module]`-only
  manifests no longer hijack the lookup.
* `kcl.work` files are expanded into one workspace per entry, each looked
  up through the same bounded walk so a sub-package keeps its parent
  context when it has no config of its own.
* LSP:
  - `workspace_folders` now falls back to a synthetic folder derived from
    `root_uri` so the bounded lookup still has a sane `max_root` when the
    client only sends a single root URI.
  - `i

**File**: `crates/driver/src/lib.rs` (modified, +353/-99)
```diff
@@ -26,89 +26,225 @@ use std::{
 use toolchain::{Metadata, Toolchain, fill_pkg_maps_for_k_file};
 use walkdir::WalkDir;
 
-/// Get compile workspace(files and options) from a single file input.
-/// 1. Lookup entry files in kcl.yaml
-/// 2. Lookup entry files in kcl.mod
-/// 3. If not found, consider the path or folder where the file is
-///    located as the compilation entry point
-pub fn lookup_compile_workspace(
+fn default_compile_unit_res(
     tool: &dyn Toolchain,
     file: &str,
     load_pkg: bool,
 ) -> CompileUnitOptions {
-    fn default_res(tool: &dyn Toolchain, file: &str, load_pkg: bool) -> CompileUnitOptions {
-        let mut default_res: CompileUnitOptions = (vec![], None, None);
-        let mut load_opt = kcl_parser::LoadProgramOptions::default();
-        let metadata = fill_pkg_maps_for_k_file(tool, file.into(), &mut load_opt).unwrap_or(None);
-        let path = Path::new(file);
-        if let Some(ext) = path.extension() {
-            if load_pkg {
-                if let Some(parent) = path.parent()
-                    && let Ok(files) = get_kcl_files(parent, false)
-                {
-                    default_res = (files, Some(load_opt), metadata);
-                }
-            } else if ext == KCL_FILE_EXTENSION && path.is_file() {
-                default_res = (vec![file.to_string()], Some(load_opt), metadata);
+    let mut default_res: CompileUnitOptions = (vec![], None, None);
+    let mut load_opt = kcl_parser::LoadProgramOptions::default();
+    let metadata = fill_pkg_maps_for_k_file(tool, file.into(), &mut load_opt).unwrap_or(None);
+    let path = Path::new(file);
+    if let Some(ext) = path.extension() {
+        if load_pkg {
+            if let Some(parent) = path.parent()
+                && let Ok(files) = get_kcl_files(parent, false)
+            {
+                default_res = (files, Some(load_opt), metadata);
             }
+        } else if ext == KCL_FILE_EXTENSION && path.is_file() {
+            default_res = (vec![file.to_string()], Some(load_opt), metadata);
         }
-        default_res
     }
+    default_res
+}
 
-    match lookup_compile_unit_path(file) {
-        Ok(CompileUnitPath::SettingFile(dir)) => {
-            let settings_files = lookup_setting_files(&dir);
-            let files = if settings_files.is_empty() {
-                default_res(tool, file, load_pkg).0.to_vec()
-            } else {
-                vec![]
+fn lookup_setting_file_compile_unit(
+    tool: &dyn Toolchain,
+    file: &str,
+    load_pkg: bool,
+    dir: &Path,
+) -> CompileUnitOptions {
+    let settings_files = lookup_setting_files(dir);
+    let files = if settings_files.is_empty() {
+        default_compile_unit_res(tool, file, load_pkg).0.to_vec()
+    } else {
+        vec![]
+    };
+    let files: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
+    let settings_files: Vec<&str> = settings_files.iter().map(|f| f.to_str().unwrap()).collect();
+    match build_settings_pathbuf(&files, Some(settings_files), None) {
+        Ok(setting_buf) => {
+            let setting = setting_buf.settings();
+            let files = setting.input();
+
+            let work_dir = setting_buf
+                .path()
+                .clone()
+                .map(|p| p.to_string_lossy().to_string())
+                .unwrap_or_default();
+
+            let mut load_opt = kcl_parser::LoadProgramOptions {
+                work_dir: work_dir.clone(),
+                ..Default::default()
             };
-            let files: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
-            let settings_files: Vec<&str> =
-                settings_files.iter().map(|f| f.to_str().unwrap()).collect();
-            match build_settings_pathbuf(&files, Some(settings_files), None) {
-                Ok(setting_buf) => {
-                    let setting = setting_buf.settings();
-                    let files = setting.input();
-
-                    let work_dir = setting_buf
- 
```

**File**: `crates/driver/src/test_data/lookup_walkup/kcl_work_proj/a/main.k` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+main = "work_a"
```

**File**: `crates/driver/src/test_data/lookup_walkup/kcl_work_proj/a/sub/b.k` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+b = "b"
```

**File**: `crates/driver/src/test_data/lookup_walkup/kcl_work_proj/kcl.work` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+workspace ./a
```

**File**: `crates/driver/src/test_data/lookup_walkup/konfig_like/base/pkg1/a.k` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+a = "a"
```

#### Recent Merged Pull Requests:
- **PR #2208** (2026-09-29): fix(runtime): self-contained plugin stub on wasm32-unknown-unknown (@robinbraemer)
- **PR #2207** (2026-09-29): fix(lsp): wasm32 shim for Url::from_file_path / to_file_path (@robinbraemer)
- **PR #2205** (2026-09-26): fix(api): use a single service method registry for BuiltinService.ListMethod (@Peefy)
- **PR #2204** (2026-09-26): feat(api): add sourcemap_output to ExecProgramArgs for Source Map v3 requests (@Peefy)
- **PR #2203** (2026-09-26): fix(api): make ValidateCode, Rename and UpdateDependencies work on WASI/wasm32 (@Peefy)
- **PR #2202** (2026-09-25): ci(release): zigbuild kcl-language-server for older glibc (@Peefy)
- **PR #2201** (2026-09-25): feat(api): register Ping/ListMethod builtins; drop unused ListDepFiles RPC (@Peefy)
- **PR #2200** (closed): feat(lib): expose universal kcl_call dispatcher for WASM host (@Peefy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
