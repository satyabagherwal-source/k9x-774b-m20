# Forensic Learning Record (Deep Inspection): Qovery/Replibyte

> **Canonical Artifact**: `07_PROJECT_LEARNING/qovery-replibyte-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Qovery/Replibyte](https://github.com/Qovery/Replibyte))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:16:44.825Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Qovery/Replibyte`
- **Description**: Seed your development database with real data ⚡️
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 4415 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `db/mongodb/init-mongo.js`
```
db.createUser({
    user: 'root',
    pwd: 'password',
    roles: [
        {
            role: 'readWrite',
            db: 'test',
        },
    ],
});

db = new Mongo().getDB("test");

db.createCollection('users', { capped: false });
db.createCollection('states', { capped: false });
db.createCollection('cars', { capped: false });

for (let i = 0; i < 10; i++) {
    db.users.insertOne({
        name: 'user' + i,
        age: i,
    });
    db.states.insertOne({
        name: 'state' + i,
        number: i,
    });
    db.cars.insertOne({
        model: 'car' + i,
        year: 2010 + i,
    });
}
```

### Core Architecture Module: `dump-parser/src/errors.rs`
```
use std::io::ErrorKind;

#[derive(Debug)]
pub enum Error {
    DumpFile(DumpFileError),
}

#[derive(Debug)]
pub enum DumpFileError {
    DoesNotExist,
    ReadError(std::io::Error),
    MalFormatted,
}

impl From<DumpFileError> for std::io::Error {
    fn from(err: DumpFileError) -> Self {
        std::io::Error::new(ErrorKind::Other, format!("{:?}", err))
    }
}

```

### Core Architecture Module: `dump-parser/src/lib.rs`
```
use std::io::{BufReader, Read};

use crate::errors::DumpFileError;

pub mod errors;
pub mod mongodb;
pub mod mysql;
pub mod postgres;
pub mod utils;

#[derive(Debug, PartialOrd, PartialEq, Ord, Eq)]
pub enum Type {
    Postgres,
    Mysql,
}

pub trait LogicalDatabase<'a, T>
where
    T: Table,
{
    fn name(&self) -> &str;
    fn tables(&self) -> Result<Vec<T>, DumpFileError>;
}

pub trait Table {
    fn rows(&self) -> &'static Vec<Row>;
}

#[derive(Debug, Hash, Eq, PartialEq)]
pub struct Row {
    columns: Vec<Column>,
}

#[derive(Debug, Hash, Eq, PartialEq)]
pub struct Column {
    name: String,
    value: Vec<u8>,
}

pub trait Database<'a, LD, T>
where
    LD: LogicalDatabase<'a, T>,
    T: Table,
{
    fn database_type(&self) -> Type;
    /// list logical databases available
    fn databases<R: Read>(&self, dump_reader: BufReader<R>) -> Result<Vec<LD>, DumpFileError>;
    /// find a logical database by name
    fn get_database<S: Into<&'a str>, R: Read>(
        &self,
        name: S,
        dump_reader: BufReader<R>,
    ) -> Result<Option<LD>, DumpFileError> {
        let databases = self.databases(dump_reader)?;

        let db_name = name.into();
        for db in databases {
            if db.name() == db_name {
                return Ok(Some(db));
            }
        }

        Ok(None)
    }
}

```

### Core Architecture Module: `dump-parser/src/mongodb/mod.rs`
```
use bson::Document;
use crc::crc64;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufReader, Error, ErrorKind, Read};

/// Four bytes that are always present at the beginning of the archive.
const MAGIC_BYTES: [u8; 4] = [0x6d, 0xe2, 0x99, 0x81];

/// Seperator bytes, found mostly between different data blocks.
const SEPERATOR_BYTES: [u8; 4] = [0xFF, 0xFF, 0xFF, 0xFF];
/// Mongo archive header document.
///
/// Found immediately after the magic number in the archive, before any Metadata documents.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Header {
    pub concurrent_collections: i32,
    pub version: String,
    pub server_version: String,
    pub tool_version: String,
}
/// Mongo archive collection metadata document.
///
/// there is one Metadata document per collection that will be in the archive.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub db: String,
    pub collection: String,
    pub metadata: String,
    pub size: i32,
    pub r#type: String,
}
/// Mongo archive namespace document.
///
/// namespaces are found in the archive before any data blocks, and also after them,
/// and are used as headers or footers for data blocks.
///
/// if namespace.eof is true, then the namespace is a header, otherwise it is a footer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Namespace {
    pub db: String,
    pub collection: String,
    #[serde(rename = "EOF")]
    pub eof: bool,
    #[serde(rename = "CRC")]
    pub crc: i64,
}

// Prefixes are "<db_name>.<collection_name>"
pub type Prefix = String;
pub type Collection = Vec<Document>;
pub type PrefixedCollections = HashMap<Prefix, Collection>;
/// # Archive
/// reference: https://github.com/mongodb/mongo-tools-common/blob/v4.2/archive/archive.go
///
/// mongodump/mongorestore "archives" are binary files with the following structure:
///  ```
/// // +-----------------------+                                                       
/// // |      magic bytes      |                                                       
/// // +-----------------------+                                                       
/// // |      header Bson      |
/// // +-----------------------+
/// // |    metadata Bson 0    |
/// // +-----------------------+
/// // |    metadata Bson 1    |
/// // +-----------------------+
/// //            ...
/// // +-----------------------+
/// // |    metadata Bson x    |  - x is the number of collections in the database
/// // +-----------------------+
/// // |    seperator bytes    |
/// // +-----------------------+
/// // |======= BLOCK 0 =======|  - each block represents a single collection.
/// // |-----------------------|
/// // |    namespace Bson     |  - contains the collection name and an EOF marker (see reference)
/// // |-----------------------|
/// // |         data          |  - 0 or more of the actual documents in the collection.
/// // |-----------------------|
/// // |    seperator bytes    |
/// // +-----------------------+
/// //            ...
/// // +-----------------------+
/// // |======= BLOCK x =======|  - x is the number of collections in the database
/// // |-----------------------|
/// // |    namespace Bson     |
/// // |-----------------------|
/// // |         data          |  
/// // +-----------------------+
/// // |    seperator bytes    |
/// // +-----------------------+
/// ```
#[derive(Debug, Clone)]
pub struct Archive {
    header: Header,
    metadata_docs: Vec<Metadata>,
    namespace_docs: Vec<Namespace>,
    prefixed_collections: PrefixedCollections, // prefix is <db_name>.<collection_name>
}
impl Archive {
    pub fn from_reader<R: Read>(mut reader: BufReader<R>) -> Result<Archive, Error> {
        let mut buf: [u8; 4] = [0; 4];
        let mut num_blocks = 0;
        let mut vec_eofs = Vec::with_capacity(num_blocks * 2);
        let mut metadata_docs = vec![];
        let mut namespace_docs = vec![];
        let mut prefixed_collections = HashMap::new();

        // read magic bytes
        reader.read_exact(&mut buf)?;
        if buf != MAGIC_BYTES {
            return Err(Error::new(
                ErrorKind::InvalidData,
                "Stream or file does not appear to be a mongodump archive",
            ));
        }

        // read namespace header
        let header: Header = bson::from_reader(&mut reader)
            .map_err(|e| Error::new(ErrorKind::InvalidData, format!("{}", e)))?;

        // read metadata headers and seperator (seperator is read when while let fails for the 1st time)
        while let Ok(collection_metadata_doc) = bson::from_reader(&mut reader) {
            let metadata_doc = Metadata::from(collection_metadata_doc);
            metadata_docs.push(metadata_doc);
            num_blocks += 1;
        }

        if num_blocks > 0 {
            // read blocks
            loop {
                // read namespace header
                let namespace_doc: Namespace = bson::from_reader(&mut reader).map_err(|err| {
                    Error::new(
                        ErrorKind::Other,
                        format!("Error reading block header: {}", err),
                    )
                })?;
                namespace_docs.push(namespace_doc.clone()); // TODO can we avoid cloning here?
                vec_eofs.push(namespace_doc.eof);
                // read block data
                let mut collection_docs = vec![];
                while let Ok(collection_doc) = Document::from_reader(&mut reader) {
                    collection_docs.push(collection_doc.clone());
                }
                if !namespace_doc.eof {
                    // if this namespace was a footer (eof == true), that would mean the collection just ended
                    prefixed_collections.insert(
                        format!("{}.{}", namespace_doc.db, namespace_doc.collection),
                        collection_docs,
                    );
                }
                // when we've seen as much EOFs as there are blocks, we're done.
                if vec_eofs.iter().filter(|&&eof| eof).count() == num_blocks {
                    break;
                }
            }
        }
        Ok(Archive {
            header,
            metadata_docs,
            namespace_docs,
            prefixed_collections,
        })
    }

    pub fn alter_docs<F>(&mut self, alter_fn: F)
    where
        F: FnOnce(&mut PrefixedCollections),
    {
        alter_fn(&mut self.prefixed_collections);
    }

    pub fn into_bytes(mut self) -> Result<Vec<u8>, Error> {
        let mut new_crc64_checksums: HashMap<Prefix, i64> = HashMap::new();
        let mut buf = Vec::new();
        buf.extend_from_slice(&MAGIC_BYTES);
        bson::to_document(&self.header)
            .unwrap()
            .to_writer(&mut buf)
            .map_err(|err| {
                Error::new(
                    ErrorKind::Other,
                    format!("Error writing namespace header: {}", err),
                )
            })?;
        for metadata_doc in &self.metadata_docs {
            bson::to_document(&metadata_doc)
                .unwrap()
                .to_writer(&mut buf)
                .map_err(|err| {
                    Error::new(
                        ErrorKind::Other,
                        format!("Error writing metadata doc: {}", err),
                    )
                })?;
        }
        buf.extend_from_slice(&SEPERATOR_BYTES);
        for namespace_doc in &mut self.namespace_docs {
            if !namespace_doc.eof {
                // then this is a collection header
                bson::to_document(&namespace_doc)
                    .unwrap()
                    .to_writer(&mut buf)
                    .map_err(|err| {
                        Error::new(
                            ErrorKind::Other,
                            format!("Error writing block header: {}", err),
                        )
                    })?;
            }
```

### Core Architecture Module: `dump-parser/src/mysql/mod.rs`
```
use std::fmt;
use std::iter::Peekable;
use std::str::Chars;

use crate::mysql::Keyword::{
    Add, Alter, Constraint, Copy, Create, Database, Foreign, From, Insert, Into as KeywordInto,
    Key, NoKeyword, Not, Null, Primary, References, Table,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Token {
    /// An end-of-file marker, not a real token
    EOF,
    /// A signed numeric literal
    Number(String, bool),
    /// TABLE instruction
    Word(Word),
    /// Whitespace (space, tab, etc)
    Whitespace(Whitespace),
    /// A character that could not be tokenized
    Char(char),
    /// Single quoted string: i.e: 'string'
    SingleQuotedString(String),
    /// "National" string literal: i.e: N'string'
    NationalStringLiteral(String),
    /// Hexadecimal string literal: i.e.: X'deadbeef'
    HexStringLiteral(String),
    /// Comma
    Comma,
    /// Double equals sign `==`
    DoubleEq,
    /// Equality operator `=`
    Eq,
    /// Not Equals operator `<>` (or `!=` in some dialects)
    Neq,
    /// Less Than operator `<`
    Lt,
    /// Greater Than operator `>`
    Gt,
    /// Less Than Or Equals operator `<=`
    LtEq,
    /// Greater Than Or Equals operator `>=`
    GtEq,
    /// Spaceship operator <=>
    Spaceship,
    /// Plus operator `+`
    Plus,
    /// Minus operator `-`
    Minus,
    /// Multiplication operator `*`
    Mul,
    /// Division operator `/`
    Div,
    /// Modulo Operator `%`
    Mod,
    /// String concatenation `||`
    StringConcat,
    /// Left parenthesis `(`
    LParen,
    /// Right parenthesis `)`
    RParen,
    /// Period (used for compound identifiers or projections into nested types)
    Period,
    /// Colon `:`
    Colon,
    /// DoubleColon `::` (used for casting in postgresql)
    DoubleColon,
    /// SemiColon `;` used as separator for COPY and payload
    SemiColon,
    /// Backslash `\` used in terminating the COPY payload with `\.`
    Backslash,
    /// Left bracket `[`
    LBracket,
    /// Right bracket `]`
    RBracket,
    /// Ampersand `&`
    Ampersand,
    /// Pipe `|`
    Pipe,
    /// Caret `^`
    Caret,
    /// Left brace `{`
    LBrace,
    /// Right brace `}`
    RBrace,
    /// Right Arrow `=>`
    RArrow,
    /// Sharp `#` used for PostgreSQL Bitwise XOR operator
    Sharp,
    /// Tilde `~` used for PostgreSQL Bitwise NOT operator or case sensitive match regular expression operator
    Tilde,
    /// `~*` , a case insensitive match regular expression operator in PostgreSQL
    TildeAsterisk,
    /// `!~` , a case sensitive not match regular expression operator in PostgreSQL
    ExclamationMarkTilde,
    /// `!~*` , a case insensitive not match regular expression operator in PostgreSQL
    ExclamationMarkTildeAsterisk,
    /// `<<`, a bitwise shift left operator in PostgreSQL
    ShiftLeft,
    /// `>>`, a bitwise shift right operator in PostgreSQL
    ShiftRight,
    /// Exclamation Mark `!` used for PostgreSQL factorial operator
    ExclamationMark,
    /// Double Exclamation Mark `!!` used for PostgreSQL prefix factorial operator
    DoubleExclamationMark,
    /// AtSign `@` used for PostgreSQL abs operator
    AtSign,
    /// `?` or `$` , a prepared statement arg placeholder
    Placeholder(String),
}

impl Token {
    pub fn make_keyword(keyword: &str) -> Self {
        Token::make_word(keyword, None)
    }

    pub fn make_word(word: &str, quote_style: Option<char>) -> Self {
        let word_uppercase = word.to_uppercase();
        Token::Word(Word {
            value: word.to_string(),
            quote_style,
            keyword: if quote_style == None {
                match word_uppercase.as_str() {
                    "ALTER" => Alter,
                    "CREATE" => Create,
                    "INSERT" => Insert,
                    "INTO" => KeywordInto,
                    "COPY" => Copy,
                    "DATABASE" => Database,
                    "TABLE" => Table,
                    "FROM" => From,
                    "NOT" => Not,
                    "NULL" => Null,
                    "ADD" => Add,
                    "CONSTRAINT" => Constraint,
                    "PRIMARY" => Primary,
                    "FOREIGN" => Foreign,
                    "REFERENCES" => References,
                    "KEY" => Key,
                    _ => NoKeyword,
                }
            } else {
                Keyword::NoKeyword
            },
        })
    }
}

/// A keyword (like SELECT) or an optionally quoted SQL identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Word {
    /// The value of the token, without the enclosing quotes, and with the
    /// escape sequences (if any) processed.
    /// TODO: escapes are not handled
    pub value: String,
    /// An identifier can be "quoted" (&lt;delimited identifier> in ANSI parlance).
    /// The standard and most implementations allow using double quotes for this,
    /// but some implementations support other quoting styles as well (e.g. \[MS SQL])
    pub quote_style: Option<char>,
    /// If the word was not quoted and it matched one of the known keywords,
    /// this will have one of the values from dialect::keywords, otherwise empty
    pub keyword: Keyword,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Keyword {
    Create,
    Alter,
    Insert,
    Into,
    Copy,
    Database,
    Table,
    From,
    Not,
    Null,
    Add,
    Constraint,
    Primary,
    Foreign,
    References,
    Key,
    NoKeyword,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Whitespace {
    Space,
    Newline,
    Tab,
    SingleLineComment { comment: String, prefix: String },
    MultiLineComment(String),
}

/// Tokenizer error
#[derive(Debug, PartialEq)]
pub struct TokenizerError {
    pub message: String,
    pub line: u64,
    pub col: u64,
}

impl fmt::Display for TokenizerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{} at Line: {}, Column {}",
            self.message, self.line, self.col
        )
    }
}

/// SQL Tokenizer
pub struct Tokenizer<'a> {
    query: &'a str,
    line: u64,
    col: u64,
}

impl<'a> Tokenizer<'a> {
    /// Create a new DUMP SQL tokenizer for the specified DUMP SQL statement
    pub fn new<S: Into<&'a str>>(query: S) -> Self {
        Self {
            query: query.into(),
            line: 1,
            col: 1,
        }
    }

    /// Tokenize the statement and produce a vector of tokens
    pub fn tokenize(&mut self) -> Result<Vec<Token>, TokenizerError> {
        let mut peekable = self.query.chars().peekable();

        let mut tokens: Vec<Token> = vec![];

        while let Some(token) = self.next_token(&mut peekable)? {
            match &token {
                Token::Whitespace(Whitespace::Newline) => {
                    self.line += 1;
                    self.col = 1;
                }

                Token::Whitespace(Whitespace::Tab) => self.col += 4,
                _ => self.col += 1,
            }

            tokens.push(token);
        }

        Ok(tokens)
    }

    /// Get the next token or return None
    fn next_token(&self, chars: &mut Peekable<Chars<'_>>) -> Result<Option<Token>, TokenizerError> {
        //println!("next_token: {:?}", chars.peek());
        match chars.peek() {
            Some(&ch) => match ch {
                ' ' => self.consume_and_return(chars, Token::Whitespace(Whitespace::Space)),
                '\t' => self.consume_and_return(chars, Token::Whitespace(Whitespace::Tab)),
                '\n' => self.consume_and_return(chars, Token::Whitespace(Whitespace::Newline)),
                '\r' => {
                    // Emit a single Whitespace::Newline token for \r and \r\n
                    chars.next();
                    if let Some('\n') = chars.peek() {
                        chars.next();
                    }
                    Ok(Some(Token::Whitespace(Whitespace::Newline)))
                }
                'N' => {
       
```

### Core Architecture Module: `dump-parser/src/postgres/mod.rs`
```
use std::fmt;
use std::iter::Peekable;
use std::str::Chars;

use crate::postgres::Keyword::{
    Add, Alter, Constraint, Copy, Create, Database, Foreign, From, Function, Insert,
    Into as KeywordInto, Key, NoKeyword, Not, Null, Only, Primary, References, Replace, Table,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Token {
    /// An end-of-file marker, not a real token
    EOF,
    /// An unsigned numeric literal (numeric string, is_long)
    Number(String, bool),
    /// TABLE instruction
    Word(Word),
    /// Whitespace (space, tab, etc)
    Whitespace(Whitespace),
    /// A character that could not be tokenized
    Char(char),
    /// Single quoted string: i.e: 'string'
    SingleQuotedString(String),
    /// "National" string literal: i.e: N'string'
    NationalStringLiteral(String),
    /// Hexadecimal string literal: i.e.: X'deadbeef'
    HexStringLiteral(String),
    /// Comma
    Comma,
    /// Double equals sign `==`
    DoubleEq,
    /// Equality operator `=`
    Eq,
    /// Not Equals operator `<>` (or `!=` in some dialects)
    Neq,
    /// Less Than operator `<`
    Lt,
    /// Greater Than operator `>`
    Gt,
    /// Less Than Or Equals operator `<=`
    LtEq,
    /// Greater Than Or Equals operator `>=`
    GtEq,
    /// Spaceship operator <=>
    Spaceship,
    /// Plus operator `+`
    Plus,
    /// Minus operator `-`
    Minus,
    /// Multiplication operator `*`
    Mul,
    /// Division operator `/`
    Div,
    /// Modulo Operator `%`
    Mod,
    /// String concatenation `||`
    StringConcat,
    /// Left parenthesis `(`
    LParen,
    /// Right parenthesis `)`
    RParen,
    /// Period (used for compound identifiers or projections into nested types)
    Period,
    /// Colon `:`
    Colon,
    /// DoubleColon `::` (used for casting in postgresql)
    DoubleColon,
    /// SemiColon `;` used as separator for COPY and payload
    SemiColon,
    /// Backslash `\` used in terminating the COPY payload with `\.`
    Backslash,
    /// Left bracket `[`
    LBracket,
    /// Right bracket `]`
    RBracket,
    /// Ampersand `&`
    Ampersand,
    /// Pipe `|`
    Pipe,
    /// Caret `^`
    Caret,
    /// Left brace `{`
    LBrace,
    /// Right brace `}`
    RBrace,
    /// Right Arrow `=>`
    RArrow,
    /// Sharp `#` used for PostgreSQL Bitwise XOR operator
    Sharp,
    /// Tilde `~` used for PostgreSQL Bitwise NOT operator or case sensitive match regular expression operator
    Tilde,
    /// `~*` , a case insensitive match regular expression operator in PostgreSQL
    TildeAsterisk,
    /// `!~` , a case sensitive not match regular expression operator in PostgreSQL
    ExclamationMarkTilde,
    /// `!~*` , a case insensitive not match regular expression operator in PostgreSQL
    ExclamationMarkTildeAsterisk,
    /// `<<`, a bitwise shift left operator in PostgreSQL
    ShiftLeft,
    /// `>>`, a bitwise shift right operator in PostgreSQL
    ShiftRight,
    /// Exclamation Mark `!` used for PostgreSQL factorial operator
    ExclamationMark,
    /// Double Exclamation Mark `!!` used for PostgreSQL prefix factorial operator
    DoubleExclamationMark,
    /// AtSign `@` used for PostgreSQL abs operator
    AtSign,
    /// `|/`, a square root math operator in PostgreSQL
    PGSquareRoot,
    /// `||/` , a cube root math operator in PostgreSQL
    PGCubeRoot,
    /// `?` or `$` , a prepared statement arg placeholder
    Placeholder(String),
}

impl Token {
    pub fn make_keyword(keyword: &str) -> Self {
        Token::make_word(keyword, None)
    }

    pub fn make_word(word: &str, quote_style: Option<char>) -> Self {
        let word_uppercase = word.to_uppercase();
        Token::Word(Word {
            value: word.to_string(),
            quote_style,
            keyword: if quote_style == None {
                match word_uppercase.as_str() {
                    "ALTER" => Alter,
                    "CREATE" => Create,
                    "REPLACE" => Replace,
                    "INSERT" => Insert,
                    "ONLY" => Only,
                    "INTO" => KeywordInto,
                    "COPY" => Copy,
                    "DATABASE" => Database,
                    "TABLE" => Table,
                    "FROM" => From,
                    "NOT" => Not,
                    "NULL" => Null,
                    "ADD" => Add,
                    "CONSTRAINT" => Constraint,
                    "PRIMARY" => Primary,
                    "FOREIGN" => Foreign,
                    "REFERENCES" => References,
                    "KEY" => Key,
                    "FUNCTION" => Function,
                    _ => NoKeyword,
                }
            } else {
                Keyword::NoKeyword
            },
        })
    }
}

/// A keyword (like SELECT) or an optionally quoted SQL identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Word {
    /// The value of the token, without the enclosing quotes, and with the
    /// escape sequences (if any) processed.
    /// TODO: escapes are not handled
    pub value: String,
    /// An identifier can be "quoted" (&lt;delimited identifier> in ANSI parlance).
    /// The standard and most implementations allow using double quotes for this,
    /// but some implementations support other quoting styles as well (e.g. \[MS SQL])
    pub quote_style: Option<char>,
    /// If the word was not quoted and it matched one of the known keywords,
    /// this will have one of the values from dialect::keywords, otherwise empty
    pub keyword: Keyword,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Keyword {
    Create,
    Replace,
    Alter,
    Only,
    Insert,
    Into,
    Copy,
    Database,
    Table,
    From,
    Not,
    Null,
    Add,
    Constraint,
    Primary,
    Foreign,
    References,
    Key,
    Function,
    NoKeyword,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Whitespace {
    Space,
    Newline,
    Tab,
    SingleLineComment { comment: String, prefix: String },
    MultiLineComment(String),
}

/// Tokenizer error
#[derive(Debug, PartialEq)]
pub struct TokenizerError {
    pub message: String,
    pub line: u64,
    pub col: u64,
}

impl fmt::Display for TokenizerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{} at Line: {}, Column {}",
            self.message, self.line, self.col
        )
    }
}

/// SQL Tokenizer
pub struct Tokenizer<'a> {
    query: &'a str,
    line: u64,
    col: u64,
}

impl<'a> Tokenizer<'a> {
    /// Create a new DUMP SQL tokenizer for the specified DUMP SQL statement
    pub fn new<S: Into<&'a str>>(query: S) -> Self {
        Self {
            query: query.into(),
            line: 1,
            col: 1,
        }
    }

    /// Tokenize the statement and produce a vector of tokens
    pub fn tokenize(&mut self) -> Result<Vec<Token>, TokenizerError> {
        let mut peekable = self.query.chars().peekable();

        let mut tokens: Vec<Token> = vec![];

        while let Some(token) = self.next_token(&mut peekable)? {
            match &token {
                Token::Whitespace(Whitespace::Newline) => {
                    self.line += 1;
                    self.col = 1;
                }

                Token::Whitespace(Whitespace::Tab) => self.col += 4,
                _ => self.col += 1,
            }

            tokens.push(token);
        }

        Ok(tokens)
    }

    /// Get the next token or return None
    fn next_token(&self, chars: &mut Peekable<Chars<'_>>) -> Result<Option<Token>, TokenizerError> {
        //println!("next_token: {:?}", chars.peek());
        match chars.peek() {
            Some(&ch) => match ch {
                ' ' => self.consume_and_return(chars, Token::Whitespace(Whitespace::Space)),
                '\t' => self.consume_and_return(chars, Token::Whitespace(Whitespace::Tab)),
                '\n' => self.consume_and_return(chars, Token::Whitespace(Whitespace::Newline)),
           
```

### Core Architecture Module: `dump-parser/src/utils.rs`
```
use crate::DumpFileError;
use crate::DumpFileError::ReadError;
use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::str;

const COMMENT_CHARS: &str = "--";

pub enum ListQueryResult {
    Continue,
    Break,
}

/// read dump file and callback query function with each valid query inside the dump file
pub fn list_sql_queries_from_dump_file<'a, S, F>(
    dump_file_path: S,
    query: F,
) -> Result<(), DumpFileError>
where
    S: Into<&'a str>,
    F: FnMut(&str) -> ListQueryResult,
{
    let file = match File::open(dump_file_path.into()) {
        Ok(file) => file,
        Err(_) => return Err(DumpFileError::DoesNotExist),
    };

    let reader = BufReader::new(file);
    list_sql_queries_from_dump_reader(reader, query)
}

/// read dump and callback query function with each valid query inside the dump
pub fn list_sql_queries_from_dump_reader<R, F>(
    mut dump_reader: BufReader<R>,
    mut query: F,
) -> Result<(), DumpFileError>
where
    R: Read,
    F: FnMut(&str) -> ListQueryResult,
{
    let mut count_empty_lines = 0;
    let mut buf_bytes: Vec<u8> = Vec::new();
    let mut line_buf_bytes: Vec<u8> = Vec::new();

    loop {
        let bytes = dump_reader.read_until(b'\n', &mut line_buf_bytes);
        let total_bytes = match bytes {
            Ok(bytes) => bytes,
            Err(err) => return Err(ReadError(err)),
        };

        let last_real_char_idx = if buf_bytes.len() > 1 {
            buf_bytes.len() - 2
        } else if buf_bytes.len() == 1 {
            1
        } else {
            0
        };

        // check end of line is a ';' char - it would mean it's the end of the query
        let is_last_line_buf_bytes_by_end_of_query = match line_buf_bytes.get(last_real_char_idx) {
            Some(byte) => *byte == b';',
            None => false,
        };

        let mut query_res = ListQueryResult::Continue;

        buf_bytes.append(&mut line_buf_bytes);

        if total_bytes <= 1 || is_last_line_buf_bytes_by_end_of_query {
            let mut buf_bytes_to_keep: Vec<u8> = Vec::new();

            if buf_bytes.len() > 1 {
                let query_str = match str::from_utf8(buf_bytes.as_slice()) {
                    Ok(t) => t,
                    Err(e) => continue
                };

                for statement in list_statements(query_str) {
                    match statement {
                        Statement::NewLine => {
                            query("\n");
                        }
                        Statement::CommentLine(comment_statement) => {
                            query(comment_statement.statement);
                        }
                        Statement::Query(sql_statement) => {
                            if sql_statement.valid {
                                query(sql_statement.statement);
                            } else {
                                // the query is not complete, so keep it for the next iteration
                                buf_bytes_to_keep
                                    .extend_from_slice(sql_statement.statement.as_bytes());
                            }
                        }
                    }
                }
            }

            let _ = buf_bytes.clear();
            buf_bytes.extend_from_slice(buf_bytes_to_keep.as_slice());
            count_empty_lines += 1;
        } else {
            count_empty_lines = 0;
        }

        // 49 is an empirical number -
        // not too large to avoid looping too much time, and not too small to avoid wrong end of query
        if count_empty_lines > 49 {
            // EOF?
            break;
        }

        match query_res {
            ListQueryResult::Continue => {}
            ListQueryResult::Break => break,
        }
    }

    Ok(())
}

/// Decodes a hex string to a byte `Vec`.
/// #### example:
///
/// ```rust
/// # use dump_parser::utils::decode_hex;
/// let bytes = decode_hex("0123456789ABCDEF");
/// assert_eq!(bytes, Ok(vec![0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF]));
/// ```
pub fn decode_hex(s: &str) -> Result<Vec<u8>, std::num::ParseIntError> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16))
        .collect()
}

enum Statement<'a> {
    NewLine,
    CommentLine(CommentStatement<'a>),
    Query(QueryStatement<'a>),
}

struct CommentStatement<'a> {
    start_index: usize,
    end_index: usize,
    statement: &'a str,
}

struct QueryStatement<'a> {
    valid: bool,
    start_index: usize,
    end_index: usize,
    statement: &'a str,
}

/// Lightweight function to parse and validate the SQL statement AST.
/// This function can be executed thousands of time per second.
/// It must be fast enough. That's why it does not validate the grammar,
/// but just the structure of a SQL query and return the list of SQL statements with their index
fn list_statements(query: &str) -> Vec<Statement> {
    let mut sql_statements = vec![];
    let mut stack = vec![];

    let mut is_statement_complete = true;
    let mut is_comment_line = false;
    let mut is_partial_comment_line = false;
    let mut start_index = 0usize;
    let mut previous_chars_are_whitespaces = true;
    let query_bytes = query.as_bytes();
    for (idx, byte_char) in query.bytes().enumerate() {
        let next_idx = idx + 1;

        match byte_char {
            char if is_comment_line && char == b'\n' => {
                sql_statements.push(Statement::CommentLine(CommentStatement {
                    start_index,
                    end_index: idx,
                    statement: &query[start_index..idx],
                }));

                // set start_index to the current index
                start_index = idx + 1;
                stack.clear();
                is_statement_complete = true;
                is_comment_line = false;
                previous_chars_are_whitespaces = true;
            }
            b'\'' if !is_comment_line && !is_partial_comment_line => {
                if stack.get(0) == Some(&b'\'') {
                    if (query.len() > next_idx) && &query[next_idx..next_idx] == "'" {
                        // do nothing because the ' char is escaped via a double ''
                    } else if idx > 0 && query.is_char_boundary(idx-1) && &query[idx-1..idx] == "\\" {
                        // do nothing because the ' char is escaped via a backslash
                    } else {
                        let _ = stack.remove(0);
                    }
                } else {
                    stack.insert(0, byte_char);
                }
                is_statement_complete = false;
                is_comment_line = false;
                previous_chars_are_whitespaces = false;
            }
            b'(' if !is_comment_line
                && !is_partial_comment_line
                && stack.get(0) != Some(&b'\'') =>
            {
                stack.insert(0, byte_char);
                is_statement_complete = false;
                is_comment_line = false;
                previous_chars_are_whitespaces = false;
            }
            b')' if !is_comment_line && !is_partial_comment_line => {
                if stack.get(0) == Some(&b'(') {
                    let _ = stack.remove(0);
                } else if stack.get(0) != Some(&b'\'') {
                    stack.insert(0, byte_char);
                }

                is_statement_complete = false;
                is_comment_line = false;
                previous_chars_are_whitespaces = false;
            }
            b'-' if !is_comment_line
                && previous_chars_are_whitespaces
                && is_statement_complete
                && next_idx < query_bytes.len() && query_bytes[next_idx] == b'-' =>
            {
                // comment
                is_comment_line = true;
                previous_chars_are_whitespaces = false;
            }
            // use grapheme instead of code points or bytes?
            b'-' if !is_statement_complet
```

### Core Architecture Module: `replibyte/src/cli.rs`
```
use std::path::PathBuf;

use clap::{Args, Parser, Subcommand};

/// Replibyte is a tool to seed your databases with your production data while keeping sensitive data safe, just pass `-h`
#[derive(Parser, Debug)]
#[clap(version, about, long_about = None)]
#[clap(propagate_version = true)]
pub struct CLI {
    /// Replibyte configuration file
    #[clap(short, long, parse(from_os_str), value_name = "configuration file")]
    pub config: PathBuf,
    #[clap(subcommand)]
    pub sub_commands: SubCommand,
    /// disable telemetry
    #[clap(short, long)]
    pub no_telemetry: bool,
}

/// sub commands
#[derive(Subcommand, Debug)]
pub enum SubCommand {
    /// all dump commands
    #[clap(subcommand)]
    Dump(DumpCommand),
    /// all source commands
    #[clap(subcommand)]
    Source(SourceCommand),
    /// all transformer commands
    #[clap(subcommand)]
    Transformer(TransformerCommand),
}

/// all dump commands
#[derive(Subcommand, Debug)]
pub enum DumpCommand {
    /// list available dumps
    List,
    /// launch dump -- use `-h` to show all the options
    Create(DumpCreateArgs),
    /// all restore commands
    #[clap(subcommand)]
    Restore(RestoreCommand),
    /// delete a dump from the defined datastore
    Delete(DumpDeleteArgs),
}

/// all transformer commands
#[derive(Subcommand, Debug)]
pub enum TransformerCommand {
    /// list available transformers
    List,
}

/// all restore commands
#[derive(Subcommand, Debug)]
pub enum RestoreCommand {
    /// Restore dump inside a local Docker container
    Local(RestoreLocalArgs),
    /// Restore dump inside the configured destination
    Remote(RestoreArgs),
}

/// all restore commands
#[derive(Args, Debug)]
pub struct RestoreArgs {
    /// restore dump -- set `latest` or `<dump name>` - use `dump list` command to list all dumps available
    #[clap(short, long, value_name = "[latest | dump name]")]
    pub value: String,
    /// stream output on stdout
    #[clap(short, long)]
    pub output: bool,
}

/// restore dump in a local Docker container
#[derive(Args, Debug)]
pub struct RestoreLocalArgs {
    /// restore dump -- set `latest` or `<dump name>` - use `dump list` command to list all dumps available
    #[clap(short, long, value_name = "[latest | dump name]")]
    pub value: String,
    /// stream output on stdout
    #[clap(short, long)]
    pub output: bool,
    /// Docker image tag for the container to spawn
    #[clap(short, long)]
    pub tag: Option<String>,
    /// Docker container port to map on the host
    #[clap(short, long)]
    pub port: Option<u16>,
    /// Remove the Docker container on Ctrl-c
    #[clap(short, long)]
    pub remove: bool,
    /// Docker image type
    #[clap(short, long, value_name = "[postgresql | mysql | mongodb]")]
    pub image: Option<String>,
}

/// all dump run commands
#[derive(Args, Debug)]
pub struct DumpCreateArgs {
    #[clap(name = "source_type", short, long, value_name = "[postgresql | mysql | mongodb]", possible_values = &["postgresql", "mysql", "mongodb"], requires = "input")]
    /// database source type to import
    pub source_type: Option<String>,
    /// import dump from stdin
    #[clap(name = "input", short, long, requires = "source_type")]
    pub input: bool,
    #[clap(short, long, parse(from_os_str), value_name = "dump file")]
    /// dump file
    pub file: Option<PathBuf>,
    /// dump name
    #[clap(short, long)]
    pub name: Option<String>,
}

#[derive(Args, Debug)]
#[clap(group = clap::ArgGroup::new("delete-mode").multiple(false))]
pub struct DumpDeleteArgs {
    /// Name of the dump to delete
    #[clap(group = "delete-mode")]
    pub dump: Option<String>,
    /// Remove all dumps older than the specified number of days. Example: `14d` for deleting dumps older than 14 days
    #[clap(long, group = "delete-mode")]
    pub older_than: Option<String>,
    /// Keep only the last N dumps
    #[clap(long, group = "delete-mode")]
    pub keep_last: Option<usize>,
}

/// all source commands
#[derive(Subcommand, Debug)]
pub enum SourceCommand {
    /// Show the database schema. When used with MongoDB, the schema will be probabilistic and returned as a JSON document
    Schema,
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #200** (2022-07-28): **Replibyte appears "stuck" during export from Postgres**
  *Symptoms*: Repost of my [Discord message](https://discord.com/channels/688766934917185556/952516115039408168/999727830898311260)  Hey all. We're trying to use `replibyte` to scrub some data, but unfortunately it appears to be getting stuck (for lack of a better word). I've run it under `strace`, and it looks like there are a bunch of read syscalls going on up until the point where it gets stuck. Happy to provide any other information that would be helpful to debugging this!   We're running version 0.9.3, dumping from a postgres database and trying to upload to S3 for context.  Also, the CPU is pinned to max and the memory usage is constant after the point where it gets stuck
  **Post-Mortem & Fix Analysis**:
  > Hi @zovt , thank you for reporting this issue. Do you have a dump with your syscalls? Can you provide me your replibyte config yaml to see which options you use? Thank you.
  > config: ``` source:   connection_uri: <snip>   transformers:     - database: <snip>       table: <snip>       columns:         - name: email           transformer_name: email         - name: phone_number           transformer_name: phone-number         - name: <snip>           transformer_name: random     - database: <snip>       table: <snip>       columns:         - name: email           transformer_name: email         - name: phone_number           transformer_name: phone-number datastore:   aws:     bucket: <snip>     region: <snip>     credentials:       secret_access_key: <snip>       access_key_id: <snip>  ```  [syscalls.log](https://github.com/Qovery/Replibyte/files/9162851/syscalls.log)  I've snipped out the strings from the `read` calls, but the big block at the bottom look like data from a psql dump.  I invoked replibyte like this: `strace -o syscalls.log replibyte -c replibyte.conf dump create`
  > Do you have some details on your database? Size? Number of tables? 

- **Issue #190** (2022-08-06): **Unexpected EOF while in a multi-line comment**
  *Symptoms*: I am getting the following error :   ``` failing query: '/* FOR EACH ROW BEGIN   IF NEW.createdAt IS NULL THEN     SET NEW.createdAt = NOW();' thread 'main' panicked at 'TokenizerError { message: "Unexpected EOF while in a multi-line comment", line: 1, col: 1 }', dump-parser/src/mysql/mod.rs:708:13 stack backtrace: ⠁    0:        0x101ac7072 - <std::sys_common::backtrace::_print::DisplayBacktrace as core::fmt::Display>::fmt::h4cae82d438451481    1:        0x101aee6bb - core::fmt::write::hb68c3045179d0cad    2:        0x101abebce - std::io::Write::write_fmt::haf84c797e63d79f0    3:        0x101ac9990 - std::panicking::default_hook::{{closure}}::he18137441e51da1f    4:        0x101ac9676 - std::panicking::default_hook::ha3efe84526f027fa    5:        0x101aca0ed - std::panicking::rust_panic_with_hook::h429a7ddefa5f0258    6:        0x101ac9e13 - std::panicking::begin_panic_handler::{{closure}}::h9b033a6b15b84a74    7:        0x101ac7507 - std::sys_common::backtrace::__rust_end_short_backtrace::hcdd3bec8e0e38aa6    8:        0x101ac9ada - _rust_begin_unwind    9:        0x101b4e763 - core::panicking::panic_fmt::hf7d6e5207e013f69   10:        0x1015196cb - dump_parser::mysql::get_tokens_from_query_str::hcd45d94ce6efca1c   11:        0x100ef0d2c - replibyte::source::mysql::read_and_transform::{{closure}}::he6272ec724e78e22   12:        0x100ee7578 - dump_parser::utils::list_sql_queries_from_dump_reader::h8dd3cdf032548fbb   13:        0x100e63819 - replibyte:
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this issue. I am going to take a look ASAP 
  > @manibatra can you show me your replibyte conf yaml? 
  > Sure thing :  ``` source:   transformers:     - database: management       table: cluster       columns:         - name: token           transformer_name: random datastore:   local_disk:     dir: /Users/mani/ ```

- **Issue #186** (2022-07-21): **Unterminated string literal**
  *Symptoms*: I seem to be getting the following error :   ``` thread 'main' panicked at 'TokenizerError { message: "Unterminated string literal", line: 13, col: 19 }', dump-parser/src/mysql/mod.rs:708:13 stack backtrace: ⠁    0:        0x1023d7072 - <std::sys_common::backtrace::_print::DisplayBacktrace as core::fmt::Display>::fmt::h4cae82d438451481    1:        0x1023fe6bb - core::fmt::write::hb68c3045179d0cad    2:        0x1023cebce - std::io::Write::write_fmt::haf84c797e63d79f0    3:        0x1023d9990 - std::panicking::default_hook::{{closure}}::he18137441e51da1f    4:        0x1023d9676 - std::panicking::default_hook::ha3efe84526f027fa    5:        0x1023da0ed - std::panicking::rust_panic_with_hook::h429a7ddefa5f0258    6:        0x1023d9e13 - std::panicking::begin_panic_handler::{{closure}}::h9b033a6b15b84a74    7:        0x1023d7507 - std::sys_common::backtrace::__rust_end_short_backtrace::hcdd3bec8e0e38aa6    8:        0x1023d9ada - _rust_begin_unwind    9:        0x10245e763 - core::panicking::panic_fmt::hf7d6e5207e013f69   10:        0x101e296cb - dump_parser::mysql::get_tokens_from_query_str::hcd45d94ce6efca1c   11:        0x101800d2c - replibyte::source::mysql::read_and_transform::{{closure}}::he6272ec724e78e22   12:        0x1017f7578 - dump_parser::utils::list_sql_queries_from_dump_reader::h8dd3cdf032548fbb   13:        0x101773819 - replibyte::source::mysql::read_and_transform::hae51fcd666d8fbfe   14:        0x101778286 - <replibyte::tasks::full_dump::Fu
  **Post-Mortem & Fix Analysis**:
  > It's definitely a bug. Thanks for reporting it. I am going to provide a fix 
  > I had passed this issue with release v.0.8.0. Tried with the latest 3 releases and they have the same issue.

- **Issue #174** (2022-07-20): **Transformers don't work with tables containing uppercase letters**
  *Symptoms*: Hi   Transformers are not working correctly with tables containing uppercase characters (in my case a table named **User**).  When I renamed the table to **user**, it worked perfectly.  Is there a solution to make uppercase table names work on transformers ?  The conf.yaml file I used is:  ```yaml source:   connection_uri: $DATABASE_SOURCE_URL   transformers:     - database: public       table: User       columns:         - name: name           transformer_name: random         - name: email           transformer_name: email datastore:   aws:     bucket: $BUCKET_NAME     region: $S3_REGION     credentials:       access_key_id: $ACCESS_KEY_ID       secret_access_key: $AWS_SECRET_ACCESS_KEY destination:   connection_uri: $DATABASE_DESTINATION_URL ```
  **Post-Mortem & Fix Analysis**:
  > Can you give more details on which database do you use? 
  > Hi @evoxmusic. I have tested and this problem is only in PostgreSQL. This is because PostgreSQL requires wrap table names in quotes if they contain uppercase characters. A simple solution to the problem is to wrap the table name in quotes (as in the screenshot), in which case I can reflect this behavior in the documentation. ![Screenshot_20220716_210613](https://user-images.githubusercontent.com/33448939/179367013-bb7fbf86-d239-47e3-b157-ae9332006f2a.png)
  > A more complex solution is to implement automatic quotes when creating a dump for PostgreSQL.

- **Issue #166** (2022-07-21): **Error on dump: "Unterminated string literal"**
  *Symptoms*: Hi, I'm using replibyte with Postgres and GCP. When I run `replibyte dump create`, the script panics with the error: > thread 'main' panicked at 'TokenizerError { message: "Unterminated string literal", line: 9, col: 64 }', dump-parser/src/postgres/mod.rs:761:13  I previously saw this issue before, but it was fixed here: https://github.com/Qovery/Replibyte/issues/94. I was able to create a dump after that, but now I'm seeing the error again.  Happy to provide the specific failing query over email!
  **Post-Mortem & Fix Analysis**:
  > Hi @ederski , to be sure it's (or not) a regression, can you share with me the part of your dump that is failing here? 
  > @evoxmusic Sent you a DM :)
  > HI @ederski , I looked at your query failing and it is another query that is failing to be correctly parsed by our Tokenizer. I am going. to try to reproduce it and provide a fix. I keep you posted

- **Issue #158** (2022-06-25): **[BUG]TokenizerError  message: "Unterminated string literal"  when dump mysql**
  *Symptoms*: **Replibyte version is 0.8.6.**  ``` ⠲ [00:00:00] [>---------------------------------------------------------------------------------------------------] 3.93KiB/100.00MiB (1h) failing query: ' CREATE TABLE `alert_source` (   `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'id',   `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '' COMMENT '',   `code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '' COMMENT 'Code/loki label',   `enabled` tinyint unsigned NOT NULL DEFAULT '0' COMMENT '',   `token` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '' COMMENT ',   `source_fields` json DEFAULT NULL COMMENT '',   `company_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '' COMMENT '公司ID',   `created_on` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '',   `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '' COMMENT '',   `modified_on` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '',   `modified_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT '' COMMENT 'Id',   PRIMARY KEY (`id`),   UNIQUE KEY `idx_token` (`token`) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='';' thread 'main' panicked at 'TokenizerError { message: "Unterminated string literal", line: 16, col: 19 }', dump-pars
  **Post-Mortem & Fix Analysis**:
  > Hi @koolay , can you give me the complete SQL query to reproduce the error on my end and provide a fix? Thx
  > I think I am getting the same error, just on postgres  ``` thread 'main' panicked at 'TokenizerError { message: "Unterminated string literal", line: 469, col: 100 }', dump-parser/src/postgres/mod.rs:761:13 ⠒ [00:00:12] [>-----------------------------------------------------------------------] 756.56KiB/100.00MiB (27m)    0: rust_begin_unwind              at /rustc/7737e0b5c4103216d6fd8cf941b7ab9bdbaace7c/library/std/src/panicking.rs:584:5    1: core::panicking::panic_fmt              at /rustc/7737e0b5c4103216d6fd8cf941b7ab9bdbaace7c/library/core/src/panicking.rs:143:14    2: dump_parser::postgres::get_tokens_from_query_str    3: replibyte::source::postgres::read_and_transform::{{closure}}    4: dump_parser::utils::list_sql_queries_from_dump_reader    5: <replibyte::source::postgres::Postgres as replibyte::source::Source>::read    6: <replibyte::tasks::full_dump::FullDumpTask<S> as replibyte::tasks::Task>::run    7: replibyte::commands::dump::run    8: replibyte::main n
  > @koolay @marcoacierno can you give me the complete query that make crashing replibyte? It will help to reproduce it and provide a fix 🙏🏽 

- **Issue #136** (2022-06-02): **Failed to parse mysql with "Unterminated string literal"**
  *Symptoms*: `Unterminated string literal`  ``` failing query: ' CREATE TABLE `contact` (   `id` char(36) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '',   `account` varchar(20) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '',   `name` varchar(30) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '姓名',   `mobile` varchar(15) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '',   `email` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '' COMMENT '',   `wx_app_id` char(36) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '',   `created_on` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '',   `created_by` char(36) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '',   `updated_on` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '',   `updated_by` char(36) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '' COMMENT '',   PRIMARY KEY (`id`) USING BTREE,   UNIQUE KEY `account` (`account`) USING BTREE ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='';' thread 'main' panicked at 'TokenizerError { message: "Unterminated string literal", line: 15, col: 23 }', dump-parser/src/mysql/mod.rs:697:13 ```
  **Post-Mortem & Fix Analysis**:
  > As best I can tell, this happens when replibyte hits a value that has a semicolon in it, based on my current issues.
  > It is about the keyword of `comment`.
  > Hi, thanks for reporting. I will take a look ASAP (this weekend hopefully)

- **Issue #135** (2022-06-25): **MongoDB can not connect to shards or SSL Atlas**
  *Symptoms*: The [MongoDB connection string URI](https://www.mongodb.com/docs/manual/reference/connection-string/) is a format that defines connections between applications and MongoDB instances. MongoDB utilities parse the connection string URI using the Golang [mongo-driver/x/mongo/driver/connstring](https://pkg.go.dev/go.mongodb.org/mongo-driver/x/mongo/driver/connstring) library.  **Observed behavior**  The connection string URI is parsed manually (`--username=`, `--password=`, `--host=`) instead of passing it on to the mongodump utility. This creates several problems.  - Users can not connect to a MongoDB replicated cluster, as the `--host` parameter expects a single node. - Users can not connect to a MongoDB node that uses SSL, as the `--ssl` flag needs to be set.  **Expected behavior**  Pass the connection string URI to the mongodumb utility as is using the `uri=` parameter and do not parse the connection string URI manually.
  **Post-Mortem & Fix Analysis**:
  > Hi @diceride , can you confirm it's all good for you?
  > I close this issue - feel free to re-open it if it's not the case :)

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

### Incident Patch 1: `1476dd7c` (2023-08-20)
**Commit Message**: fix: handle multi-byte chars on redacted transformer (#279)

**File**: `replibyte/src/transformer/redacted.rs` (modified, +13/-1)
```diff
@@ -84,7 +84,7 @@ impl Transformer for RedactedTransformer {
                     len if len > 3 => {
                         format!(
                             "{}{}",
-                            &value[0..3],
+                            value.chars().take(3).collect::<String>(),
                             self.options
                                 .character
                                 .to_string()
@@ -118,6 +118,18 @@ mod tests {
         assert_eq!(transformed_value.to_owned(), "424**********")
     }
 
+    #[test]
+    fn redact_with_multi_byte_char() {
+        let transformer = get_transformer();
+        let column = Column::StringValue(
+            "multi_byte_column".to_string(),
+            "🦀ë池cd".to_string(),
+        );
+        let transformed_column = transformer.transform(column);
+        let transformed_value = transformed_column.string_value().unwrap();
+        assert_eq!(transformed_value.to_owned(), "🦀ë池**********")
+    }
+
     #[test]
     fn strings_lower_than_3_chars_remains_visible() {
         let transformer = get_transformer();
```

---

### Incident Patch 2: `7fe0609a` (2022-11-15)
**Commit Message**: fix: Add utf-8 parsing error handling (#236)

* fix: Add utf-8 parsing error handling

Utf-8 parse errors affect users, and given the choice between panicking and skipping a query, the latter seems like the better option.

* Remove warning logger

**File**: `dump-parser/src/utils.rs` (modified, +4/-1)
```diff
@@ -71,7 +71,10 @@ where
             let mut buf_bytes_to_keep: Vec<u8> = Vec::new();
 
             if buf_bytes.len() > 1 {
-                let query_str = str::from_utf8(buf_bytes.as_slice()).unwrap(); // FIXME remove unwrap
+                let query_str = match str::from_utf8(buf_bytes.as_slice()) {
+                    Ok(t) => t,
+                    Err(e) => continue
+                };
 
                 for statement in list_statements(query_str) {
                     match statement {
```

---

### Incident Patch 3: `8a918eb9` (2022-09-01)
**Commit Message**: fix(docs): add credentials item to Configuration page (#222)

**File**: `website/docs/getting-started/configuration.md` (modified, +6/-4)
```diff
@@ -14,8 +14,9 @@ datastore:
   aws:
     bucket: $BUCKET_NAME
     region: $S3_REGION
-    access_key_id: $ACCESS_KEY_ID
-    secret_access_key: $AWS_SECRET_ACCESS_KEY
+    credentials:
+      access_key_id: $ACCESS_KEY_ID
+      secret_access_key: $AWS_SECRET_ACCESS_KEY
 destination:
   connection_uri: postgres://user:password@host:port/db # you can use $DATABASE_URL
 ```
@@ -121,8 +122,9 @@ datastore:
   aws:
     bucket: $BUCKET_NAME
     region: $S3_REGION
-    access_key_id: $ACCESS_KEY_ID
-    secret_access_key: $AWS_SECRET_ACCESS_KEY
+    credentials:
+      access_key_id: $ACCESS_KEY_ID
+      secret_access_key: $AWS_SECRET_ACCESS_KEY
 destination:
   connection_uri: postgres://user:password@host:port/db # you can use $DATABASE_URL
 ```
```

---

### Incident Patch 4: `fa3c1965` (2022-08-31)
**Commit Message**: fix: exit code 0 when some error return (#221)

**File**: `replibyte/src/main.rs` (modified, +5/-0)
```diff
@@ -99,8 +99,10 @@ fn main() {
         let _ = telemetry_client.capture_command(&telemetry_config, sub_commands, &env_args, None);
     }
 
+    let mut exit_code = 0;
     if let Err(err) = run(config, &sub_commands) {
         eprintln!("{}", err);
+        exit_code = 1;
     }
 
     if let Some(telemetry_client) = &telemetry_client {
@@ -111,6 +113,9 @@ fn main() {
             Some(epoch_millis() - start_exec_time),
         );
     }
+    if exit_code != 0 {
+         std::process::exit(exit_code);
+    }
 }
 
 fn run(config: Config, sub_commands: &SubCommand) -> anyhow::Result<()> {
```

---

### Incident Patch 5: `3c5aaf2b` (2022-08-13)
**Commit Message**: fix: typo (#213)

**File**: `dump-parser/src/mysql/mod.rs` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ use crate::mysql::Keyword::{
 pub enum Token {
     /// An end-of-file marker, not a real token
     EOF,
-    /// An signed numeric literal
+    /// A signed numeric literal
     Number(String, bool),
     /// TABLE instruction
     Word(Word),
```

---

### Incident Patch 6: `270a232d` (2022-07-28)
**Commit Message**: Fix/numeric parsing (#205)

* fix incorrect handling in postgres numeric

* fix parsing negative numbers (#204)

**File**: `dump-parser/src/mysql/mod.rs` (modified, +82/-39)
```diff
@@ -11,7 +11,7 @@ use crate::mysql::Keyword::{
 pub enum Token {
     /// An end-of-file marker, not a real token
     EOF,
-    /// An unsigned numeric literal
+    /// An signed numeric literal
     Number(String, bool),
     /// TABLE instruction
     Word(Word),
@@ -320,39 +320,7 @@ impl<'a> Tokenizer<'a> {
                     Ok(Some(Token::SingleQuotedString(s)))
                 }
                 // numbers and period
-                '0'..='9' | '.' => {
-                    let mut s = peeking_take_while(chars, |ch| matches!(ch, '0'..='9'));
-
-                    // match binary literal that starts with 0x
-                    if s == "0" && chars.peek() == Some(&'x') {
-                        chars.next();
-                        let s2 = peeking_take_while(
-                            chars,
-                            |ch| matches!(ch, '0'..='9' | 'A'..='F' | 'a'..='f'),
-                        );
-                        return Ok(Some(Token::HexStringLiteral(s2)));
-                    }
-
-                    // match one period
-                    if let Some('.') = chars.peek() {
-                        s.push('.');
-                        chars.next();
-                    }
-                    s += &peeking_take_while(chars, |ch| matches!(ch, '0'..='9'));
-
-                    // No number -> Token::Period
-                    if s == "." {
-                        return Ok(Some(Token::Period));
-                    }
-
-                    let long = if chars.peek() == Some(&'L') {
-                        chars.next();
-                        true
-                    } else {
-                        false
-                    };
-                    Ok(Some(Token::Number(s, long)))
-                }
+                '0'..='9' | '.' => self.tokenize_number_literal(chars, None),
                 // punctuation
                 '(' => self.consume_and_return(chars, Token::LParen),
                 ')' => self.consume_and_return(chars, Token::RParen),
@@ -369,6 +337,8 @@ impl<'a> Tokenizer<'a> {
                                 comment,
                             })))
                         }
+                        // This is still not exhaustive as "SELECT - 1 as test" in postgres would return a numeric -1.
+                        Some('0'..='9') => self.tokenize_number_literal(chars, Some('-')),
                         // a regular '-' operator
                         _ => Ok(Some(Token::Minus)),
                     }
@@ -384,7 +354,15 @@ impl<'a> Tokenizer<'a> {
                         _ => Ok(Some(Token::Div)),
                     }
                 }
-                '+' => self.consume_and_return(chars, Token::Plus),
+                '+' => {
+                    chars.next(); // consume the '+'
+                    match chars.peek() {
+                        // This is still not exhaustive as "SELECT + 1 as test" in postgres would return a numeric 1.
+                        Some('0'..='9') => self.tokenize_number_literal(chars, Some('+')),
+                        // a regular '-' operator
+                        _ => Ok(Some(Token::Plus)),
+                    }
+                }
                 '*' => self.consume_and_return(chars, Token::Mul),
                 '%' => self.consume_and_return(chars, Token::Mod),
                 '=' => {
@@ -531,6 +509,51 @@ impl<'a> Tokenizer<'a> {
         self.tokenizer_error("Unterminated string literal")
     }
 
+    // Read a signed number literal
+    fn tokenize_number_literal(
+        &self,
+        chars: &mut Peekable<Chars<'_>>,
+        sign: Option<char>
+    ) -> Result<Option<Token>, TokenizerError> {
+        let mut s = match sign {
+            Some(ch) if ch == '+' || ch == '-' => {
+                String::from(ch) + &peeking_take_while(chars, |ch| matches!(ch, '0'..='9'))
+            }
+            Some(_) => panic!("invalid sign"),
+            None => peeking_take_while(chars, |ch| matches!(ch, '0'..='9'))
```

**File**: `dump-parser/src/postgres/mod.rs` (modified, +85/-37)
```diff
@@ -11,7 +11,7 @@ use crate::postgres::Keyword::{
 pub enum Token {
     /// An end-of-file marker, not a real token
     EOF,
-    /// An unsigned numeric literal
+    /// An unsigned numeric literal (numeric string, is_long)
     Number(String, bool),
     /// TABLE instruction
     Word(Word),
@@ -330,39 +330,7 @@ impl<'a> Tokenizer<'a> {
                     Ok(Some(Token::SingleQuotedString(s)))
                 }
                 // numbers and period
-                '0'..='9' | '.' => {
-                    let mut s = peeking_take_while(chars, |ch| matches!(ch, '0'..='9'));
-
-                    // match binary literal that starts with 0x
-                    if s == "0" && chars.peek() == Some(&'x') {
-                        chars.next();
-                        let s2 = peeking_take_while(
-                            chars,
-                            |ch| matches!(ch, '0'..='9' | 'A'..='F' | 'a'..='f'),
-                        );
-                        return Ok(Some(Token::HexStringLiteral(s2)));
-                    }
-
-                    // match one period
-                    if let Some('.') = chars.peek() {
-                        s.push('.');
-                        chars.next();
-                    }
-                    s += &peeking_take_while(chars, |ch| matches!(ch, '0'..='9'));
-
-                    // No number -> Token::Period
-                    if s == "." {
-                        return Ok(Some(Token::Period));
-                    }
-
-                    let long = if chars.peek() == Some(&'L') {
-                        chars.next();
-                        true
-                    } else {
-                        false
-                    };
-                    Ok(Some(Token::Number(s, long)))
-                }
+                '0'..='9' | '.' => self.tokenize_number_literal(chars, None),
                 // punctuation
                 '(' => self.consume_and_return(chars, Token::LParen),
                 ')' => self.consume_and_return(chars, Token::RParen),
@@ -379,6 +347,8 @@ impl<'a> Tokenizer<'a> {
                                 comment,
                             })))
                         }
+                        // This is still not exhaustive as "SELECT - 1 as test" in postgres would return a numeric -1.
+                        Some('0'..='9') => self.tokenize_number_literal(chars, Some('-')),
                         // a regular '-' operator
                         _ => Ok(Some(Token::Minus)),
                     }
@@ -394,7 +364,15 @@ impl<'a> Tokenizer<'a> {
                         _ => Ok(Some(Token::Div)),
                     }
                 }
-                '+' => self.consume_and_return(chars, Token::Plus),
+                '+' => {
+                    chars.next(); // consume the '+'
+                    match chars.peek() {
+                        // This is still not exhaustive as "SELECT + 1 as test" in postgres would return a numeric 1.
+                        Some('0'..='9') => self.tokenize_number_literal(chars, Some('+')),
+                        // a regular '-' operator
+                        _ => Ok(Some(Token::Plus)),
+                    }
+                }
                 '*' => self.consume_and_return(chars, Token::Mul),
                 '%' => self.consume_and_return(chars, Token::Mod),
                 '|' => {
@@ -558,6 +536,51 @@ impl<'a> Tokenizer<'a> {
         self.tokenizer_error("Unterminated string literal")
     }
 
+    // Read a signed number literal
+    fn tokenize_number_literal(
+        &self,
+        chars: &mut Peekable<Chars<'_>>,
+        sign: Option<char>
+    ) -> Result<Option<Token>, TokenizerError> {
+        let mut s = match sign {
+            Some(ch) if ch == '+' || ch == '-' => {
+                String::from(ch) + &peeking_take_while(chars, |ch| matches!(ch, '0'..='9'))
+            }
+            Some(_) => panic!("invalid sign"),
+            None => peeking_take_while(chars
```

**File**: `replibyte/src/source/mysql.rs` (modified, +2/-1)
```diff
@@ -202,7 +202,8 @@ fn transform_columns(
     // R Paren      -> position X?
     let column_names = get_column_names_from_insert_into_query(&tokens);
     let column_values = get_column_values_from_insert_into_query(&tokens);
-
+    assert_eq!(column_names.len(), column_values.len(), "Column names do not match values: got {} names and {} values", column_names.len(), column_values.len());
+    
     let mut original_columns = vec![];
     let mut columns = vec![];
 
```

**File**: `replibyte/src/source/postgres.rs` (modified, +1/-0)
```diff
@@ -296,6 +296,7 @@ fn transform_columns(
     // R Paren      -> position X?
     let column_names = get_column_names_from_insert_into_query(&tokens);
     let column_values = get_column_values_from_insert_into_query(&tokens);
+    assert_eq!(column_names.len(), column_values.len(), "Column names do not match values: got {} names and {} values", column_names.len(), column_values.len());
 
     let mut original_columns = vec![];
     let mut columns = vec![];
```

---

### Incident Patch 7: `252aee72` (2022-07-28)
**Commit Message**: Fixes a number of sql parser bugs (#203)

* fix mysql and postgres single quoted string tokenezation

* fix statement parsing with double dashes in a quoted string

* fix performance issues when query contains multibyte utf8 characters

**File**: `dump-parser/src/mysql/mod.rs` (modified, +19/-29)
```diff
@@ -503,34 +503,24 @@ impl<'a> Tokenizer<'a> {
         chars: &mut Peekable<Chars<'_>>,
     ) -> Result<String, TokenizerError> {
         let mut s = String::new();
-        chars.next(); // consume the opening quote
+        let quote_char = chars.next().expect("opening quote character"); // consume the opening quote
 
+        // MySQL escape sequances - https://dev.mysql.com/doc/refman/5.6/en/string-literals.html#character-escape-sequences
         // slash escaping is specific to some dialect
-        let mut is_escaped = false;
         while let Some(&ch) = chars.peek() {
             match ch {
-                '\'' | '`' => {
+                '\\' => {
+                    // next char is escaped
                     chars.next(); // consume
-
-                    if let Some(next_char) = chars.peek() {
-                        if ch != '`'
-                            && *next_char != ')'
-                            && *next_char != ','
-                            && *next_char != ';'
-                            && *next_char != '\n'
-                        {
-                            is_escaped = true;
-                            s.push(ch);
-                        } else {
-                            return Ok(s);
-                        }
-                    }
-
-                    if !is_escaped {
-                        chars.next(); // consume
-                        s.push(ch);
+                    s.push(ch);
+                    if let Some(next_char) = chars.next() {
+                        s.push(next_char);
                     }
                 }
+                b if b == quote_char => {
+                    chars.next(); // consume
+                    return Ok(s);
+                }
                 _ => {
                     chars.next(); // consume
                     s.push(ch);
@@ -739,17 +729,17 @@ mod tests {
     #[test]
     fn test_tokenize_single_quoted_string() {
         // single quoted strings must end with a commar or a closing parenthese.
-        let q = "'People\'sRepublic',";
+        let q = "'People\\'sRepublic',";
         let tokenizer = Tokenizer::new(q);
         let mut chars = q.chars().peekable();
         let single_quoted_string = tokenizer.tokenize_single_quoted_string(&mut chars).unwrap();
-        assert_eq!(single_quoted_string, "People\'sRepublic".to_string());
+        assert_eq!(single_quoted_string, "People\\'sRepublic".to_string());
 
-        let q = "'People\'sRepublic')";
+        let q = "'People\\'sRepublic')";
         let tokenizer = Tokenizer::new(q);
         let mut chars = q.chars().peekable();
         let single_quoted_string = tokenizer.tokenize_single_quoted_string(&mut chars).unwrap();
-        assert_eq!(single_quoted_string, "People\'sRepublic".to_string());
+        assert_eq!(single_quoted_string, "People\\'sRepublic".to_string());
     }
 
     #[test]
@@ -880,7 +870,7 @@ CREATE TABLE `customer_store` (
 
     #[test]
     fn tokenize_insert_into_with_special_chars() {
-        let q = "INSERT INTO `country` VALUES ('CHN','China','Asia','Eastern Asia',9572900.00,-1523,1277558000,71.4,982268.00,917719.00,'Zhongquo','People\'sRepublic','Jiang Zemin',1891,'CN');";
+        let q = "INSERT INTO `country` VALUES ('CHN','China','Asia','Eastern Asia',9572900.00,-1523,1277558000,71.4,982268.00,917719.00,'Zhongquo','People\\'sRepublic','Jiang Zemin',1891,'CN');";
 
         let mut tokenizer = Tokenizer::new(q);
         let tokens_result = tokenizer.tokenize();
@@ -919,7 +909,7 @@ CREATE TABLE `customer_store` (
             Token::Comma,
             Token::SingleQuotedString("Zhongquo".to_string()),
             Token::Comma,
-            Token::SingleQuotedString("People\'sRepublic".to_string()),
+            Token::SingleQuotedString("People\\'sRepublic".to_string()),
             Token::Comma,
             Token::SingleQuotedString("Jiang Zemin".to_string()),
             Token::Comma,
@@ -963,7 +953,7 @@ VALUES (1,'Stanfor
```

**File**: `dump-parser/src/postgres/mod.rs` (modified, +13/-11)
```diff
@@ -530,20 +530,22 @@ impl<'a> Tokenizer<'a> {
         let mut s = String::new();
         chars.next(); // consume the opening quote
 
-        // slash escaping is specific to some dialect
-        let mut is_escaped = false;
+        // PostgreSQL - https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-BACKSLASH-TABLE
+        // in postgres quotes are escaped with ''
         while let Some(&ch) = chars.peek() {
             match ch {
                 '\'' => {
-                    chars.next(); // consume
-                    if is_escaped {
-                        s.push(ch);
-                        is_escaped = false;
-                    } else if chars.peek().map(|c| *c == '\'').unwrap_or(false) {
-                        s.push(ch);
-                        chars.next();
-                    } else {
-                        return Ok(s);
+                    chars.next(); // consume '
+                    match chars.peek() {
+                        // escaped
+                        Some('\'') => {
+                            chars.next(); // consume second '
+                            s.push('\'');
+                            s.push('\'');
+                        }
+                        _ => {
+                            return Ok(s);
+                        }
                     }
                 }
                 _ => {
```

**File**: `dump-parser/src/utils.rs` (modified, +23/-22)
```diff
@@ -159,31 +159,12 @@ fn list_statements(query: &str) -> Vec<Statement> {
     let mut sql_statements = vec![];
     let mut stack = vec![];
 
-    let is_next_char_comment = if query.find("--").is_some() {
-        // it means there is comments in this query string
-        let x: Box<dyn Fn(usize) -> bool> = if query.len() == query.chars().count() {
-            Box::new(|next_idx: usize| {
-                query.len() > next_idx && &query[next_idx..next_idx + 1] == "-"
-            })
-        } else {
-            // very low performance ... chars().nth(idx) is O(n)
-            Box::new(|next_idx: usize| {
-                query.len() > next_idx && query.chars().nth(next_idx) == Some('-')
-            })
-        };
-
-        x
-    // check if query contains multiple bytes utf-8 chars
-    } else {
-        let x: Box<dyn Fn(usize) -> bool> = Box::new(|_: usize| false);
-        x
-    };
-
     let mut is_statement_complete = true;
     let mut is_comment_line = false;
     let mut is_partial_comment_line = false;
     let mut start_index = 0usize;
     let mut previous_chars_are_whitespaces = true;
+    let query_bytes = query.as_bytes();
     for (idx, byte_char) in query.bytes().enumerate() {
         let next_idx = idx + 1;
 
@@ -241,14 +222,17 @@ fn list_statements(query: &str) -> Vec<Statement> {
             b'-' if !is_comment_line
                 && previous_chars_are_whitespaces
                 && is_statement_complete
-                && is_next_char_comment(next_idx) =>
+                && next_idx < query_bytes.len() && query_bytes[next_idx] == b'-' =>
             {
                 // comment
                 is_comment_line = true;
                 previous_chars_are_whitespaces = false;
             }
             // use grapheme instead of code points or bytes?
-            b'-' if !is_statement_complete && is_next_char_comment(next_idx) => {
+            b'-' if !is_statement_complete 
+                && next_idx < query_bytes.len() && query_bytes[next_idx] == b'-'
+                && stack.get(0) != Some(&b'\'') =>
+            {
                 // comment
                 is_partial_comment_line = true;
                 previous_chars_are_whitespaces = false;
@@ -403,6 +387,23 @@ Etiam augue augue, bibendum et molestie non, finibus non nulla. Etiam quis rhonc
             }
         }
 
+        let s = list_statements(
+            "INSERT INTO public.toto (first_name, last_name) VALUES ('jo--hn', 'd;--oe');",
+        );
+        assert_eq!(s.len(), 1);
+
+        match s.get(0).unwrap() {
+            Statement::NewLine => {
+                assert!(false);
+            }
+            Statement::CommentLine(_) => {
+                assert!(false);
+            }
+            Statement::Query(s) => {
+                assert!(s.valid);
+            }
+        }
+
         let s = list_statements(
             "INSERT INTO public.toto (first_name, last_name) VALUES ('john', 'doe'",
         );
```

---

### Incident Patch 8: `e68a5fc6` (2022-07-21)
**Commit Message**: Fix mysql tokenize error (#198)

* wip: fix mysql tokenize error

* Release v0.9.4 (#199)

Signed-off-by: Romaric Philogène <rphilogene@qovery.com>

* update Cargo.lock

* fix: mysql tokenize error

**File**: `dump-parser/src/mysql/mod.rs` (modified, +11/-4)
```diff
@@ -513,7 +513,11 @@ impl<'a> Tokenizer<'a> {
                     chars.next(); // consume
 
                     if let Some(next_char) = chars.peek() {
-                        if ch != '`' && *next_char != ')' && *next_char != ',' && *next_char != ';'
+                        if ch != '`'
+                            && *next_char != ')'
+                            && *next_char != ','
+                            && *next_char != ';'
+                            && *next_char != '\n'
                         {
                             is_escaped = true;
                             s.push(ch);
@@ -728,8 +732,8 @@ pub fn trim_pre_whitespaces(tokens: Vec<Token>) -> Vec<Token> {
 mod tests {
     use crate::mysql::{
         get_column_names_from_insert_into_query, get_column_values_from_insert_into_query,
-        get_tokens_from_query_str, match_keyword_at_position, trim_pre_whitespaces, Token,
-        Tokenizer, Whitespace, get_single_quoted_string_value_at_position,
+        get_single_quoted_string_value_at_position, get_tokens_from_query_str,
+        match_keyword_at_position, trim_pre_whitespaces, Token, Tokenizer, Whitespace,
     };
 
     #[test]
@@ -1039,7 +1043,10 @@ VALUES ('Romaric', true);
         assert_eq!(tokens_result.is_ok(), true);
 
         let tokens = trim_pre_whitespaces(tokens_result.unwrap());
-        assert_eq!("customers", get_single_quoted_string_value_at_position(&tokens, 4).unwrap());
+        assert_eq!(
+            "customers",
+            get_single_quoted_string_value_at_position(&tokens, 4).unwrap()
+        );
         assert!(get_single_quoted_string_value_at_position(&tokens, 0).is_none());
     }
 }
```

**File**: `replibyte/src/source/mysql.rs` (modified, +21/-0)
```diff
@@ -492,4 +492,25 @@ CONSTRAINT `city_ibfk_1` FOREIGN KEY (`CountryCode`) REFERENCES `country` (`Code
         };
         assert_eq!(get_row_type(&tokens), expected_row_type);
     }
+
+    #[test]
+    fn test_create_table_without_comma_at_the_end_of_the_last_property() {
+        let q = "CREATE TABLE `test` (
+ `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
+ `withDefault` tinyint(1) NOT NULL DEFAULT '0',
+) ENGINE=InnoDB DEFAULT CHARSET=latin1;";
+
+        let mut tokenizer = Tokenizer::new(q);
+        let tokens = tokenizer.tokenize().unwrap();
+        assert_eq!(is_create_table_statement(&tokens), true);
+
+        let q = "CREATE TABLE `test` (
+ `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
+ `withDefault` tinyint(1) NOT NULL DEFAULT '0'
+) ENGINE=InnoDB DEFAULT CHARSET=latin1;";
+
+        let mut tokenizer = Tokenizer::new(q);
+        let tokens = tokenizer.tokenize().unwrap();
+        assert_eq!(is_create_table_statement(&tokens), true);
+    }
 }
```

---

### Incident Patch 9: `c32fc3b4` (2022-07-21)
**Commit Message**: fix(mysql): prevent panic when table has comment (#172)

**File**: `dump-parser/src/mysql/mod.rs` (modified, +12/-3)
```diff
@@ -513,7 +513,8 @@ impl<'a> Tokenizer<'a> {
                     chars.next(); // consume
 
                     if let Some(next_char) = chars.peek() {
-                        if ch != '`' && *next_char != ')' && *next_char != ',' {
+                        if ch != '`' && *next_char != ')' && *next_char != ',' && *next_char != ';'
+                        {
                             is_escaped = true;
                             s.push(ch);
                         } else {
@@ -751,10 +752,10 @@ mod tests {
     fn tokenizer_for_create_table_query() {
         let q = r"
 CREATE TABLE `customer_store` (
-  `store_id` int NOT NULL,
+  `store_id` int NOT NULL COMMENT 'Field sample comment',
   `customer_id` int NOT NULL,
   KEY `customer_store_store_id_customer_id_index` (`store_id`,`customer_id`)
-) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
+) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Table sample comment';";
 
         let mut tokenizer = Tokenizer::new(q);
         let tokens_result = tokenizer.tokenize();
@@ -779,6 +780,10 @@ CREATE TABLE `customer_store` (
             Token::make_word("NOT", None),
             Token::Whitespace(Whitespace::Space),
             Token::make_keyword("NULL"),
+            Token::Whitespace(Whitespace::Space),
+            Token::make_keyword("COMMENT"),
+            Token::Whitespace(Whitespace::Space),
+            Token::SingleQuotedString("Field sample comment".to_string()),
             Token::Comma,
             Token::Whitespace(Whitespace::Newline),
             Token::Whitespace(Whitespace::Space),
@@ -819,6 +824,10 @@ CREATE TABLE `customer_store` (
             Token::make_keyword("COLLATE"),
             Token::Eq,
             Token::make_keyword("utf8mb4_unicode_ci"),
+            Token::Whitespace(Whitespace::Space),
+            Token::make_keyword("COMMENT"),
+            Token::Eq,
+            Token::SingleQuotedString("Table sample comment".to_string()),
             Token::SemiColon,
         ];
 
```

---

### Incident Patch 10: `19ecf1b4` (2022-07-21)
**Commit Message**: Fix escape quote check (#182)

* Fix escape quote check

* Add test

* Restore original logic

* Handle unicode correctly

**File**: `dump-parser/src/utils.rs` (modified, +20/-1)
```diff
@@ -205,7 +205,9 @@ fn list_statements(query: &str) -> Vec<Statement> {
             b'\'' if !is_comment_line && !is_partial_comment_line => {
                 if stack.get(0) == Some(&b'\'') {
                     if (query.len() > next_idx) && &query[next_idx..next_idx] == "'" {
-                        // do nothing because the ' char is escaped
+                        // do nothing because the ' char is escaped via a double ''
+                    } else if idx > 0 && query.is_char_boundary(idx-1) && &query[idx-1..idx] == "\\" {
+                        // do nothing because the ' char is escaped via a backslash
                     } else {
                         let _ = stack.remove(0);
                     }
@@ -505,6 +507,23 @@ Etiam augue augue, bibendum et molestie non, finibus non nulla. Etiam quis rhonc
             }
         }
 
+        let s = list_statements(
+            "INSERT INTO public.toto (first_name, last_name) VALUES ('jo\\'hn', 'doe');",
+        );
+        assert_eq!(s.len(), 1);
+
+        match s.get(0).unwrap() {
+            Statement::NewLine => {
+                assert!(false);
+            }
+            Statement::CommentLine(_) => {
+                assert!(false);
+            }
+            Statement::Query(s) => {
+                assert!(s.valid);
+            }
+        }
+
         let s = list_statements(
             "INSERT INTO public.toto (first_name, last_name, description) VALUES\
                 ('jo''hn', 'doe', 'wadawdw'';awdawd; awd;awdawdaw rm -rf ;dawd;');",
```

#### Recent Merged Pull Requests:
- **PR #301** (closed): Potential doc fix? (@jensenbox)
- **PR #291** (2024-05-04): Parse passwords with special chars correctly (@pm-trey)
- **PR #288** (closed): fix: handle scientific notation literal numbers (@gaetan-welow)
- **PR #282** (closed): feat: add buffer size parameter (@emilsivervik)
- **PR #279** (2023-08-20): fix: handle multi-byte chars on redacted transformer (@pepoviola)
- **PR #238** (2022-11-18): Correct filename (@sondrelg)
- **PR #236** (2022-11-15): fix: Add utf-8 parsing error handling (@sondrelg)
- **PR #229** (2022-10-14): Release v0.10.0 (@evoxmusic)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
