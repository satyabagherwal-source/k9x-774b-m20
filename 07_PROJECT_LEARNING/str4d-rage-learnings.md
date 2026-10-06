# Forensic Learning Record (Deep Inspection): str4d/rage

> **Canonical Artifact**: `07_PROJECT_LEARNING/str4d-rage-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/str4d/rage](https://github.com/str4d/rage))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:00:24.000Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `str4d/rage`
- **Description**: A simple, secure and modern file encryption tool (and Rust library) with small explicit keys, no config options, and UNIX-style composability.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3675 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `age-core/src/format.rs`
```
//! Core types and encoding operations used by the age file format.

use base64::{Engine, prelude::BASE64_STANDARD_NO_PAD};
use rand::{
    Rng,
    distr::{Distribution, Uniform},
};
use secrecy::{ExposeSecret, ExposeSecretMut, SecretBox};

/// The prefix identifying an age stanza.
const STANZA_TAG: &str = "-> ";

/// The length of an age file key.
pub const FILE_KEY_BYTES: usize = 16;

/// A file key for encrypting or decrypting an age file.
pub struct FileKey(SecretBox<[u8; FILE_KEY_BYTES]>);

impl FileKey {
    /// Creates a file key using a pre-boxed key.
    pub fn new(file_key: Box<[u8; FILE_KEY_BYTES]>) -> Self {
        Self(SecretBox::new(file_key))
    }

    /// Creates a file key using a function that can initialize the key in-place.
    pub fn init_with_mut(ctr: impl FnOnce(&mut [u8; FILE_KEY_BYTES])) -> Self {
        Self(SecretBox::init_with_mut(ctr))
    }

    /// Same as [`Self::init_with_mut`], but the constructor can be fallible.
    pub fn try_init_with_mut<E>(
        ctr: impl FnOnce(&mut [u8; FILE_KEY_BYTES]) -> Result<(), E>,
    ) -> Result<Self, E> {
        let mut file_key = SecretBox::new(Box::new([0; FILE_KEY_BYTES]));
        ctr(file_key.expose_secret_mut())?;
        Ok(Self(file_key))
    }
}

impl ExposeSecret<[u8; FILE_KEY_BYTES]> for FileKey {
    fn expose_secret(&self) -> &[u8; FILE_KEY_BYTES] {
        self.0.expose_secret()
    }
}

/// A section of the age header that encapsulates the file key as encrypted to a specific
/// recipient.
///
/// This is the reference type; see [`Stanza`] for the owned type.
#[derive(Debug)]
pub struct AgeStanza<'a> {
    /// A tag identifying this stanza type.
    pub tag: &'a str,
    /// Zero or more arguments.
    pub args: Vec<&'a str>,
    /// The body of the stanza, containing a wrapped [`FileKey`].
    ///
    /// Represented as the set of Base64-encoded lines for efficiency (so the caller can
    /// defer the cost of decoding until the structure containing this stanza has been
    /// fully-parsed).
    body: Vec<&'a [u8]>,
}

impl AgeStanza<'_> {
    /// Decodes and returns the body of this stanza.
    pub fn body(&self) -> Vec<u8> {
        // An AgeStanza will always contain at least one chunk.
        let (partial_chunk, full_chunks) = self.body.split_last().unwrap();

        // This is faster than collecting from a flattened iterator.
        let mut data = vec![0; full_chunks.len() * 64 + partial_chunk.len()];
        for (i, chunk) in full_chunks.iter().enumerate() {
            // These chunks are guaranteed to be full by construction.
            data[i * 64..(i + 1) * 64].copy_from_slice(chunk);
        }
        data[full_chunks.len() * 64..].copy_from_slice(partial_chunk);

        // The chunks are guaranteed to contain Base64 characters by construction.
        BASE64_STANDARD_NO_PAD.decode(&data).unwrap()
    }
}

/// A section of the age header that encapsulates the file key as encrypted to a specific
/// recipient.
///
/// This is the owned type; see [`AgeStanza`] for the reference type.
#[derive(Debug, PartialEq, Eq)]
pub struct Stanza {
    /// A tag identifying this stanza type.
    pub tag: String,
    /// Zero or more arguments.
    pub args: Vec<String>,
    /// The body of the stanza, containing a wrapped [`FileKey`].
    pub body: Vec<u8>,
}

impl From<AgeStanza<'_>> for Stanza {
    fn from(stanza: AgeStanza<'_>) -> Self {
        let body = stanza.body();
        Stanza {
            tag: stanza.tag.to_string(),
            args: stanza.args.into_iter().map(|s| s.to_string()).collect(),
            body,
        }
    }
}

/// Checks whether the string is a valid age "arbitrary string" (`1*VCHAR` in ABNF).
pub fn is_arbitrary_string<S: AsRef<str>>(s: &S) -> bool {
    let s = s.as_ref();
    !s.is_empty()
        && s.chars().all(|c| match u8::try_from(c) {
            Ok(u) => (33..=126).contains(&u),
            Err(_) => false,
        })
}

/// Creates a random recipient stanza that exercises the joint in the age v1 format.
///
/// This function is guaranteed to return a valid stanza, but makes no other guarantees
/// about the stanza's fields.
pub fn grease_the_joint() -> Stanza {
    // Generate arbitrary strings between 1 and 9 characters long.
    fn gen_arbitrary_string<R: Rng>(rng: &mut R) -> String {
        let length = Uniform::try_from(1..9).expect("valid").sample(rng);
        Uniform::try_from(33..=126)
            .expect("valid")
            .sample_iter(rng)
            .map(char::from)
            .take(length)
            .collect()
    }

    let mut rng = rand::rng();

    // Add a suffix to the random tag so users know what is going on.
    let tag = format!("{}-grease", gen_arbitrary_string(&mut rng));

    // Between this and the above generation bounds, the first line of the recipient
    // stanza will be between eight and 66 characters.
    let args = (0..Uniform::try_from(0..5).expect("valid").sample(&mut rng))
        .map(|_| gen_arbitrary_string(&mut rng))
        .collect();

    // A length between 0 and 100 bytes exercises the following stanza bodies:
    // - Empty
    // - Single short-line
    // - Single full-line
    // - Two lines, second short
    // - Two lines, both full
    // - Three lines, last short
    let mut body = vec![0; Uniform::try_from(0..100).expect("valid").sample(&mut rng)];
    rng.fill_bytes(&mut body);

    Stanza { tag, args, body }
}

/// Decoding operations for age types.
pub mod read {
    use nom::{
        IResult, Parser,
        branch::alt,
        bytes::streaming::{tag, take_while_m_n, take_while1},
        character::streaming::newline,
        combinator::{map, map_opt, opt, verify},
        multi::{many_till, separated_list1},
        sequence::{pair, preceded, terminated},
    };

    use super::{AgeStanza, STANZA_TAG};

    fn is_base64_char(c: u8) -> bool {
        // Check against the ASCII values of the standard Base64 character set.
        matches!(
            c,
            // A..=Z | a..=z | 0..=9 | + | /
            65..=90 | 97..=122 | 48..=57 | 43 | 47,
        )
    }

    /// Returns true if the byte is one of the specific ASCII values of the standard
    /// Base64 character set which leave trailing bits when they occur as the last
    /// character in an encoding of length 2 mod 4.
    fn base64_has_no_trailing_bits_2(c: &u8) -> bool {
        // With two trailing characters, the last character has up to four trailing bits.
        matches!(
            c,
            // A | Q | g | w
            65 | 81 | 103 | 119,
        )
    }

    /// Returns true if the byte is one of the specific ASCII values of the standard
    /// Base64 character set which leave trailing bits when they occur as the last
    /// character in an encoding of length 3 mod 4.
    fn base64_has_no_trailing_bits_3(c: &u8) -> bool {
        // With three trailing characters, the last character has up to two trailing bits.
        matches!(
            c,
            // A | E | I | M | Q | U | Y | c | g | k | o | s | w | 0 | 4 | 8
            65 | 69 | 73 | 77 | 81 | 85 | 89 | 99 | 103 | 107 | 111 | 115 | 119 | 48 | 52 | 56,
        )
    }

    /// Reads an age "arbitrary string".
    ///
    /// From the age specification:
    /// ```text
    /// ... an arbitrary string is a sequence of ASCII characters with values 33 to 126.
    /// ```
    pub fn arbitrary_string(input: &[u8]) -> IResult<&[u8], &str> {
        map(take_while1(|c| (33..=126).contains(&c)), |bytes| {
            // Safety: ASCII bytes are valid UTF-8
            unsafe { std::str::from_utf8_unchecked(bytes) }
        })
        .parse(input)
    }

    fn wrapped_encoded_data(input: &[u8]) -> IResult<&[u8], Vec<&[u8]>> {
        map(
            many_till(
                // Any body lines before the last MUST be full-length.
                terminated(take_while_m_n(64, 64, is_base64_char), newline),
                // Last body line:
                // - MUST be short (empty if necessary).
                // - MUST be a valid Base64 length (i.e. the length must not be 1 mod 4).
                // - MUST NOT leave trailing bits (if the length is 2 or 3 mod 4).
                verify(
                    terminated(take_while_m_n(0, 63, is_base64_char), newline),
                    |line: &[u8]| match line.len() % 4 {
                        0 => true,
                        1 => false,
                        2 => base64_has_no_trailing_bits_2(line.last().unwrap()),
                        3 => base64_has_no_trailing_bits_3(line.last().unwrap()),
                        // No other cases, but Rust wants an exhaustive match on u8.
                        _ => unreachable!(),
                    },
                ),
            ),
            |(full_chunks, partial_chunk): (Vec<&[u8]>, &[u8])| {
                let mut chunks = full_chunks;
                chunks.push(partial_chunk);
                chunks
            },
        )
        .parse(input)
    }

    fn legacy_wrapped_encoded_data(input: &[u8]) -> IResult<&[u8], Vec<&[u8]>> {
        map_opt(
            separated_list1(newline, take_while1(is_base64_char)),
            |chunks: Vec<&[u8]>| {
                // Enforce that the only chunk allowed to be shorter than 64 characters
                // is the last chunk, and that its length must not be 1 mod 4.
                let (partial_chunk, full_chunks) = chunks.split_last().unwrap();
                if full_chunks.iter().any(|s| s.len() != 64)
                    || partial_chunk.len() > 64
                    || partial_chunk.len() % 4 == 1
                    || (partial_chunk.len() % 4 == 2
                        && !base64_has_no_trailing_bits_2(partial_chunk.last().unwrap()))
                    || (partial_chunk.len() % 4 == 3
                        && !base64_has_no_trailing_bits_3(partial_chunk.last().unwrap()))
                {
                    None
                } else {
                    Some(chunks)
                }
            
```

### Core Architecture Module: `age-core/src/io.rs`
```
//! Common helpers for performing I/O.

use std::io::{self, Read, Stderr, Write};

use io_tee::{TeeReader, TeeWriter};

#[cfg(feature = "plugin")]
use io_tee::{ReadExt, WriteExt};

/// A wrapper around a reader that optionally tees its input to `stderr` for this process.
pub enum DebugReader<R: Read> {
    Off(R),
    On(TeeReader<R, Stderr>),
}

impl<R: Read> DebugReader<R> {
    #[cfg(feature = "plugin")]
    #[cfg_attr(docsrs, doc(cfg(feature = "plugin")))]
    pub(crate) fn new(reader: R, debug_enabled: bool) -> Self {
        if debug_enabled {
            DebugReader::On(reader.tee_dbg())
        } else {
            DebugReader::Off(reader)
        }
    }
}

impl<R: Read> Read for DebugReader<R> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        match self {
            Self::Off(reader) => reader.read(buf),
            Self::On(reader) => reader.read(buf),
        }
    }
}

/// A wrapper around a writer that optionally tees its output to `stderr` for this process.
pub enum DebugWriter<W: Write> {
    Off(W),
    On(TeeWriter<W, Stderr>),
}

impl<W: Write> DebugWriter<W> {
    #[cfg(feature = "plugin")]
    #[cfg_attr(docsrs, doc(cfg(feature = "plugin")))]
    pub(crate) fn new(writer: W, debug_enabled: bool) -> Self {
        if debug_enabled {
            DebugWriter::On(writer.tee_dbg())
        } else {
            DebugWriter::Off(writer)
        }
    }
}

impl<W: Write> Write for DebugWriter<W> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        match self {
            Self::Off(writer) => writer.write(buf),
            Self::On(writer) => writer.write(buf),
        }
    }

    fn flush(&mut self) -> io::Result<()> {
        match self {
            Self::Off(writer) => writer.flush(),
            Self::On(writer) => writer.flush(),
        }
    }
}

```

### Core Architecture Module: `age-core/src/lib.rs`
```
//! This crate contains common structs and functions used across the `age` crates.
//!
//! You are probably looking for the [`age`](https://crates.io/crates/age) crate
//! itself. You should only need to directly depend on this crate if you are
//! implementing a custom recipient type.

#![cfg_attr(docsrs, feature(doc_cfg))]
// Catch documentation errors caused by code changes.
#![deny(rustdoc::broken_intra_doc_links)]

// Re-export crates that are used in our public API.
pub use secrecy;

pub mod format;
pub mod io;
pub mod primitives;

#[cfg(feature = "plugin")]
#[cfg_attr(docsrs, doc(cfg(feature = "plugin")))]
pub mod plugin;

```

### Core Architecture Module: `age-core/src/plugin.rs`
```
//! Common structs and constants for the age plugin system.
//!
//! These are shared between the client implementation in the `age` crate, and the plugin
//! implementations built around the `age-plugin` crate.

use rand::RngExt;
use secrecy::zeroize::Zeroize;
use std::env;
use std::fmt;
use std::io::{self, BufRead, BufReader, Read, Write};
use std::iter;
use std::path::Path;
use std::process::{ChildStdin, ChildStdout, Command, Stdio};

use crate::{
    format::{Stanza, grease_the_joint, read, write},
    io::{DebugReader, DebugWriter},
};

pub const IDENTITY_V1: &str = "identity-v1";
pub const RECIPIENT_V1: &str = "recipient-v1";

const COMMAND_DONE: &str = "done";
const RESPONSE_OK: &str = "ok";
const RESPONSE_FAIL: &str = "fail";
const RESPONSE_UNSUPPORTED: &str = "unsupported";

/// An error within the plugin protocol.
#[derive(Debug)]
pub enum Error {
    Fail,
    Unsupported,
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Fail => write!(f, "General plugin protocol error"),
            Self::Unsupported => write!(f, "Unsupported command"),
        }
    }
}

impl std::error::Error for Error {}

/// Result type for the plugin protocol.
///
/// - The outer error indicates a problem with the IPC transport or state machine; these
///   should result in the state machine being terminated and the connection closed.
/// - The inner error indicates an error within the plugin protocol, that the recipient
///   should explicitly handle.
pub type Result<T> = io::Result<std::result::Result<T, Error>>;

type UnidirResult<A, B, C, D, E> = io::Result<(
    std::result::Result<Vec<A>, Vec<E>>,
    std::result::Result<Vec<B>, Vec<E>>,
    Option<std::result::Result<Vec<C>, Vec<E>>>,
    Option<std::result::Result<Vec<D>, Vec<E>>>,
)>;

/// A connection to a plugin binary.
pub struct Connection<R: Read, W: Write> {
    input: BufReader<R>,
    output: W,
    buffer: String,
    _working_dir: Option<tempfile::TempDir>,
}

impl Connection<DebugReader<ChildStdout>, DebugWriter<ChildStdin>> {
    /// Starts a plugin binary with the given state machine.
    ///
    /// If the `AGEDEBUG` environment variable is set to `plugin`, then all messages sent
    /// to and from the plugin, as well as anything the plugin prints to its `stderr`,
    /// will be printed to the `stderr` of the parent process.
    pub fn open(binary: &Path, state_machine: &str) -> io::Result<Self> {
        let working_dir = tempfile::tempdir()?;
        let debug_enabled = env::var("AGEDEBUG").map(|s| s == "plugin").unwrap_or(false);
        let process = Command::new(binary.canonicalize()?)
            .arg(format!("--age-plugin={state_machine}"))
            .current_dir(working_dir.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(if debug_enabled {
                Stdio::inherit()
            } else {
                Stdio::null()
            })
            .spawn()?;
        let input = BufReader::new(DebugReader::new(
            process.stdout.expect("could open stdout"),
            debug_enabled,
        ));
        let output = DebugWriter::new(process.stdin.expect("could open stdin"), debug_enabled);
        Ok(Connection {
            input,
            output,
            buffer: String::new(),
            _working_dir: Some(working_dir),
        })
    }
}

impl Connection<io::Stdin, io::Stdout> {
    /// Initialise a connection from an age client.
    pub fn accept() -> Self {
        Connection {
            input: BufReader::new(io::stdin()),
            output: io::stdout(),
            buffer: String::new(),
            _working_dir: None,
        }
    }
}

impl<R: Read, W: Write> Connection<R, W> {
    fn send<S: AsRef<str>>(
        &mut self,
        command: &str,
        metadata: &[S],
        data: &[u8],
    ) -> io::Result<()> {
        use cookie_factory::GenError;

        cookie_factory::gen_simple(write::age_stanza(command, metadata, data), &mut self.output)
            .map_err(|e| match e {
                GenError::IoError(e) => e,
                e => io::Error::other(format!("{e}")),
            })
            .and_then(|w| w.flush())
    }

    fn send_stanza<S: AsRef<str>>(
        &mut self,
        command: &str,
        metadata: &[S],
        stanza: &Stanza,
    ) -> io::Result<()> {
        let metadata: Vec<_> = metadata
            .iter()
            .map(|s| s.as_ref())
            .chain(iter::once(stanza.tag.as_str()))
            .chain(stanza.args.iter().map(|s| s.as_str()))
            .collect();

        self.send(command, &metadata, &stanza.body)
    }

    fn receive(&mut self) -> io::Result<Stanza> {
        let (stanza, consumed) = loop {
            match read::age_stanza(self.buffer.as_bytes()) {
                Ok((remainder, r)) => break (r.into(), self.buffer.len() - remainder.len()),
                Err(nom::Err::Incomplete(_)) => {
                    if self.input.read_line(&mut self.buffer)? == 0 {
                        return Err(io::Error::new(
                            io::ErrorKind::UnexpectedEof,
                            "incomplete response",
                        ));
                    };
                }
                Err(_) => {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        "invalid response",
                    ));
                }
            }
        };

        // We are finished with any prior response.
        let remainder = self.buffer.split_off(consumed);
        self.buffer.zeroize();
        self.buffer = remainder;

        Ok(stanza)
    }

    fn grease_gun(&mut self) -> impl Iterator<Item = Stanza> + use<R, W> {
        // Add 5% grease
        let mut rng = rand::rng();
        (0..2).filter_map(move |_| {
            if rng.random_range(0..100) < 5 {
                Some(grease_the_joint())
            } else {
                None
            }
        })
    }

    fn done(&mut self) -> io::Result<()> {
        self.send::<&str>(COMMAND_DONE, &[], &[])
    }

    /// Runs a unidirectional phase as the controller.
    pub fn unidir_send<P: FnOnce(UnidirSend<R, W>) -> io::Result<()>>(
        &mut self,
        phase_steps: P,
    ) -> io::Result<()> {
        phase_steps(UnidirSend(self))?;
        for grease in self.grease_gun() {
            self.send(&grease.tag, &grease.args, &grease.body)?;
        }
        self.done()
    }

    /// Runs a unidirectional phase as the recipient.
    ///
    /// # Arguments
    ///
    /// `command_a`, `command_b`, and (optionally) `command_c` and `command_d` are the
    /// known commands that are expected to be received. All other received commands
    /// (including grease) will be ignored.
    pub fn unidir_receive<A, B, C, D, E, F, G, H, I>(
        &mut self,
        command_a: (&str, F),
        command_b: (&str, G),
        command_c: (Option<&str>, H),
        command_d: (Option<&str>, I),
    ) -> UnidirResult<A, B, C, D, E>
    where
        F: Fn(Stanza) -> std::result::Result<A, E>,
        G: Fn(Stanza) -> std::result::Result<B, E>,
        H: Fn(Stanza) -> std::result::Result<C, E>,
        I: Fn(Stanza) -> std::result::Result<D, E>,
    {
        let mut res_a = Ok(vec![]);
        let mut res_b = Ok(vec![]);
        let mut res_c = Ok(vec![]);
        let mut res_d = Ok(vec![]);

        for stanza in iter::repeat_with(|| self.receive()).take_while(|res| match res {
            Ok(stanza) => stanza.tag != COMMAND_DONE,
            _ => true,
        }) {
            let stanza = stanza?;

            fn validate<T, E>(
                val: std::result::Result<T, E>,
                res: &mut std::result::Result<Vec<T>, Vec<E>>,
            ) {
                // Structurally validate the stanza against this command.
                match val {
                    Ok(a) => {
                        if let Ok(stanzas) = res {
                            stanzas.push(a)
                        }
                    }
                    Err(e) => match res {
                        Ok(_) => *res = Err(vec![e]),
                        Err(errors) => errors.push(e),
                    },
                }
            }

            if stanza.tag.as_str() == command_a.0 {
                validate(command_a.1(stanza), &mut res_a)
            } else if stanza.tag.as_str() == command_b.0 {
                validate(command_b.1(stanza), &mut res_b)
            } else {
                if let Some(tag) = command_c.0 {
                    if stanza.tag.as_str() == tag {
                        validate(command_c.1(stanza), &mut res_c);
                        continue;
                    }
                }
                if let Some(tag) = command_d.0 {
                    if stanza.tag.as_str() == tag {
                        validate(command_d.1(stanza), &mut res_d);
                        continue;
                    }
                }
            }
        }

        Ok((
            res_a,
            res_b,
            command_c.0.map(|_| res_c),
            command_d.0.map(|_| res_d),
        ))
    }

    /// Runs a bidirectional phase as the controller.
    pub fn bidir_send<P: FnOnce(BidirSend<R, W>) -> io::Result<()>>(
        &mut self,
        phase_steps: P,
    ) -> io::Result<()> {
        phase_steps(BidirSend(self))?;
        for grease in self.grease_gun() {
            self.send(&grease.tag, &grease.args, &grease.body)?;
            self.receive()?;
        }
        self.done()
    }

    /// Runs a bidirectional phase as the recipient.
    pub fn bidir_receive<H>(&mut self, commands: &[&str], mut handler: H) -> io::Result<()>
    where
        H: FnMut(Stanza, Reply<R, W>) -> Response,
    {
        loop {
            let stanza = self.receive()?;
            match stanza.tag.as_str() {
                COMMAND_DONE => break Ok(()),
                t if commands.
```

### Core Architecture Module: `age-core/src/primitives.rs`
```
//! Primitive cryptographic operations used across various `age` components.

use core::fmt;

use bech32::primitives::decode::CheckedHrpstring;
use chacha20poly1305::{
    ChaCha20Poly1305,
    aead::{self, Aead, AeadCore, KeyInit, common::typenum::Unsigned},
};
use hkdf::Hkdf;
use sha2::Sha256;

/// `encrypt[key](plaintext)` - encrypts a message with a one-time key.
///
/// ChaCha20-Poly1305 from [RFC 7539] with a zero nonce.
///
/// [RFC 7539]: https://tools.ietf.org/html/rfc7539
pub fn aead_encrypt(key: &[u8; 32], plaintext: &[u8]) -> Vec<u8> {
    let c = ChaCha20Poly1305::new(key.into());
    c.encrypt(&[0; 12].into(), plaintext)
        .expect("we won't overflow the ChaCha20 block counter")
}

/// `decrypt[key](ciphertext)` - decrypts a message of an expected fixed size.
///
/// ChaCha20-Poly1305 from [RFC 7539] with a zero nonce.
///
/// The message size is limited to mitigate multi-key attacks, where a ciphertext can be
/// crafted that decrypts successfully under multiple keys. Short ciphertexts can only
/// target two keys, which has limited impact.
///
/// [RFC 7539]: https://tools.ietf.org/html/rfc7539
pub fn aead_decrypt(
    key: &[u8; 32],
    size: usize,
    ciphertext: &[u8],
) -> Result<Vec<u8>, aead::Error> {
    if ciphertext.len() != size + <ChaCha20Poly1305 as AeadCore>::TagSize::to_usize() {
        return Err(aead::Error);
    }

    let c = ChaCha20Poly1305::new(key.into());
    c.decrypt(&[0; 12].into(), ciphertext)
}

/// `HKDF[salt, label](key, 32)`
///
/// HKDF from [RFC 5869] with SHA-256.
///
/// [RFC 5869]: https://tools.ietf.org/html/rfc5869
pub fn hkdf(salt: &[u8], label: &[u8], ikm: &[u8]) -> [u8; 32] {
    let mut okm = [0; 32];
    Hkdf::<Sha256>::new(Some(salt), ikm)
        .expand(label, &mut okm)
        .expect("okm is the correct length");
    okm
}

/// The bech32 checksum algorithm, defined in [BIP-173].
///
/// This is identical to [`bech32::Bech32`] except it does not enforce the length
/// restriction, allowing for a reduction in error-correcting properties.
///
/// [BIP-173]: <https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki>
#[derive(Copy, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
enum Bech32Long {}
impl bech32::Checksum for Bech32Long {
    type MidstateRepr = u32;
    const CODE_LENGTH: usize = usize::MAX;
    const CHECKSUM_LENGTH: usize = bech32::Bech32::CHECKSUM_LENGTH;
    const GENERATOR_SH: [u32; 5] = bech32::Bech32::GENERATOR_SH;
    const TARGET_RESIDUE: u32 = bech32::Bech32::TARGET_RESIDUE;
}

/// Encodes data as a Bech32-encoded string with the given HRP.
///
/// This implements Bech32 as defined in [BIP-173], except it does not enforce the length
/// restriction, allowing for a reduction in error-correcting properties.
///
/// [BIP-173]: https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki
pub fn bech32_encode(hrp: bech32::Hrp, data: &[u8]) -> String {
    bech32::encode_lower::<Bech32Long>(hrp, data).expect("we don't enforce the Bech32 length limit")
}

/// Encodes data to a format writer as a Bech32-encoded string with the given HRP.
///
/// This implements Bech32 as defined in [BIP-173], except it does not enforce the length
/// restriction, allowing for a reduction in error-correcting properties.
///
/// [BIP-173]: https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki
pub fn bech32_encode_to_fmt(f: &mut impl fmt::Write, hrp: bech32::Hrp, data: &[u8]) -> fmt::Result {
    bech32::encode_lower_to_fmt::<Bech32Long, _>(f, hrp, data).map_err(|e| match e {
        bech32::EncodeError::Fmt(error) => error,
        bech32::EncodeError::TooLong(_) => unreachable!("we don't enforce the Bech32 length limit"),
        _ => panic!("Unexpected error: {e}"),
    })
}

/// Decodes a Bech32-encoded string, checks its HRP, and returns its contained data.
///
/// This implements Bech32 as defined in [BIP-173], except it does not enforce the length
/// restriction, allowing for a reduction in error-correcting properties.
///
/// [BIP-173]: https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki
pub fn bech32_decode<E, F, G, H, T>(
    s: &str,
    parse_err: F,
    hrp_filter: G,
    data_parse: H,
) -> Result<T, E>
where
    F: FnOnce(bech32::primitives::decode::CheckedHrpstringError) -> E,
    G: FnOnce(bech32::Hrp) -> Result<(), E>,
    H: FnOnce(bech32::Hrp, bech32::primitives::decode::ByteIter) -> Result<T, E>,
{
    CheckedHrpstring::new::<Bech32Long>(s)
        .map_err(parse_err)
        .and_then(|parsed| {
            hrp_filter(parsed.hrp()).and_then(|()| data_parse(parsed.hrp(), parsed.byte_iter()))
        })
}

/// `HPKE.SealBase(pk_recip, info, aad = "", plaintext)`
///
/// HPKE from [RFC 9180] with:
/// - KDF: HKDF-SHA256
/// - AEAD: ChaCha20Poly1305
/// - `aad = ""` (empty)
///
/// # Panics
///
/// Panics if the configured `Kem` produces an error. The native age recipient types that
/// use HPKE are configured with parameters that ensure errors either cannot occur or are
/// cryptographically negligible. If you are using this method for an age plugin, ensure
/// that you choose a KEM with equivalent properties.
///
/// [RFC 9180]: https://tools.ietf.org/html/rfc9180
pub fn hpke_seal<Kem: hpke::Kem, R: rand::CryptoRng>(
    pk_recip: &Kem::PublicKey,
    info: &[u8],
    plaintext: &[u8],
    rng: &mut R,
) -> (Kem::EncappedKey, Vec<u8>) {
    hpke::single_shot_seal_with_rng::<hpke::aead::ChaCha20Poly1305, hpke::kdf::HkdfSha256, Kem>(
        &hpke::OpModeS::Base,
        pk_recip,
        info,
        plaintext,
        &[],
        rng,
    )
    .expect("no errors should occur with these HPKE parameters")
}

/// `HPKE.OpenBase(enc, sk_recip, info, aad = "", ciphertext)`
///
/// HPKE from [RFC 9180] with:
/// - KDF: HKDF-SHA256
/// - AEAD: ChaCha20Poly1305
/// - `aad = ""` (empty)
///
/// [RFC 9180]: https://tools.ietf.org/html/rfc9180
pub fn hpke_open<Kem: hpke::Kem>(
    encapped_key: &Kem::EncappedKey,
    sk_recip: &Kem::PrivateKey,
    info: &[u8],
    ciphertext: &[u8],
) -> Result<Vec<u8>, hpke::HpkeError> {
    hpke::single_shot_open::<hpke::aead::ChaCha20Poly1305, hpke::kdf::HkdfSha256, Kem>(
        &hpke::OpModeR::Base,
        sk_recip,
        encapped_key,
        info,
        ciphertext,
        &[],
    )
}

#[cfg(test)]
mod tests {
    use hpke::Kem;
    use rand::{rand_core::UnwrapErr, rngs::SysRng};

    use super::{aead_decrypt, aead_encrypt, bech32_decode, bech32_encode, hpke_open, hpke_seal};

    #[test]
    fn aead_round_trip() {
        let key = [14; 32];
        let plaintext = b"12345678";
        let encrypted = aead_encrypt(&key, plaintext);
        let decrypted = aead_decrypt(&key, plaintext.len(), &encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn bech32_round_trip() {
        let hrp = bech32::Hrp::parse_unchecked("12345678");
        let data = [14; 32];
        let encoded = bech32_encode(hrp, &data);
        let decoded = bech32_decode(
            &encoded,
            |_| (),
            |parsed_hrp| (parsed_hrp == hrp).then_some(()).ok_or(()),
            |_, bytes| Ok(bytes.collect::<Vec<_>>()),
        )
        .unwrap();
        assert_eq!(decoded, data);
    }

    #[test]
    fn hpke_round_trip() {
        type Kem = hpke::kem::DhP256HkdfSha256;
        let mut rng = UnwrapErr(SysRng);

        let (sk_recip, pk_recip) = Kem::gen_keypair_with_rng(&mut rng);

        let info = b"foobar";
        let plaintext = b"12345678";

        let (encapped_key, ciphertext) = hpke_seal::<Kem, _>(&pk_recip, info, plaintext, &mut rng);
        let decrypted = hpke_open::<Kem>(&encapped_key, &sk_recip, info, &ciphertext).unwrap();

        assert_eq!(decrypted, plaintext);
    }
}

```

### Core Architecture Module: `age/src/util.rs`
```
use std::io;

#[cfg(all(any(feature = "armor", feature = "cli-common"), windows))]
pub(crate) const LINE_ENDING: &str = "\r\n";
#[cfg(all(any(feature = "armor", feature = "cli-common"), not(windows)))]
pub(crate) const LINE_ENDING: &str = "\n";

pub(crate) struct LimitedReader<R> {
    inner: R,
    n: usize,
    limit_exceeded: bool,
}
impl<R> LimitedReader<R> {
    pub(crate) fn new(reader: R, n: usize) -> Self {
        Self {
            inner: reader,
            n,
            limit_exceeded: false,
        }
    }

    fn limit_exceeded() -> io::Error {
        io::Error::new(io::ErrorKind::InvalidData, "reader exceeded size limit")
    }
}

impl<R: io::Read> io::Read for LimitedReader<R> {
    fn read(&mut self, mut buf: &mut [u8]) -> io::Result<usize> {
        if buf.is_empty() {
            return Ok(0);
        }

        if self.limit_exceeded {
            return Err(Self::limit_exceeded());
        }

        if self.n == 0 {
            let mut probe = [0];
            if self.inner.read(&mut probe)? == 0 {
                Ok(0)
            } else {
                self.limit_exceeded = true;
                Err(Self::limit_exceeded())
            }
        } else {
            if buf.len() > self.n {
                buf = &mut buf[..self.n];
            }
            let read = self.inner.read(buf)?;
            self.n -= read;
            Ok(read)
        }
    }
}

impl<R: io::BufRead> io::BufRead for LimitedReader<R> {
    fn fill_buf(&mut self) -> io::Result<&[u8]> {
        if self.limit_exceeded {
            return Err(Self::limit_exceeded());
        }

        if self.n == 0 {
            if self.inner.fill_buf()?.is_empty() {
                Ok(&[])
            } else {
                self.limit_exceeded = true;
                Err(Self::limit_exceeded())
            }
        } else {
            let buf = self.inner.fill_buf()?;
            Ok(&buf[..buf.len().min(self.n)])
        }
    }

    fn consume(&mut self, amount: usize) {
        self.n -= amount;
        self.inner.consume(amount);
    }
}

#[cfg(test)]
mod tests {
    use super::LimitedReader;
    use std::io::{self, BufRead, Cursor, Read};

    #[test]
    fn limited_reader_read() {
        for (input, limit) in [(&b"abc"[..], 4), (&b"abc"[..], 3)] {
            let mut output = vec![];
            LimitedReader::new(input, limit)
                .read_to_end(&mut output)
                .unwrap();
            assert_eq!(output, input);
        }

        let mut output = vec![];
        let mut reader = LimitedReader::new(&b"abcd"[..], 3);
        let err = reader.read_to_end(&mut output).unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::InvalidData);
        assert_eq!(output, b"abc");
        assert_eq!(
            reader.read(&mut [0]).unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
    }

    #[test]
    fn limited_reader_bufread() {
        for (input, limit) in [(&b"abc"[..], 4), (&b"abc"[..], 3)] {
            let mut output = vec![];
            LimitedReader::new(Cursor::new(input), limit)
                .read_until(b'\n', &mut output)
                .unwrap();
            assert_eq!(output, input);
        }

        let mut output = vec![];
        let mut reader = LimitedReader::new(Cursor::new(&b"abcd"[..]), 3);
        let err = reader.read_until(b'\n', &mut output).unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::InvalidData);
        assert_eq!(output, b"abc");
        assert_eq!(
            reader.fill_buf().unwrap_err().kind(),
            io::ErrorKind::InvalidData
        );
    }
}

pub(crate) mod read {
    use std::str::FromStr;

    use base64::{Engine, prelude::BASE64_STANDARD_NO_PAD};
    use nom::{ParseTo, Parser, character::complete::digit1, combinator::verify};

    #[cfg(feature = "ssh")]
    use nom::{
        IResult,
        combinator::map_res,
        error::{ErrorKind, make_error},
        multi::separated_list1,
    };

    #[cfg(feature = "ssh")]
    #[cfg_attr(docsrs, doc(cfg(feature = "ssh")))]
    pub(crate) fn encoded_str(
        count: usize,
        engine: impl base64::Engine,
    ) -> impl Fn(&str) -> IResult<&str, Vec<u8>> {
        use nom::bytes::streaming::take;

        // Unpadded encoded length
        let encoded_count = (4 * count).div_ceil(3);

        move |input: &str| {
            let (i, data) = take(encoded_count)(input)?;
            match engine.decode(data) {
                Ok(decoded) => Ok((i, decoded)),
                Err(_) => Err(nom::Err::Failure(make_error(input, ErrorKind::Eof))),
            }
        }
    }

    #[cfg(feature = "ssh")]
    #[cfg_attr(docsrs, doc(cfg(feature = "ssh")))]
    pub(crate) fn str_while_encoded(
        engine: impl base64::Engine,
    ) -> impl Fn(&str) -> IResult<&str, Vec<u8>> {
        use nom::bytes::complete::take_while1;

        move |input: &str| {
            map_res(
                take_while1(|c| {
                    let c = c as u8;
                    // Substitute the character in twice after AA, so that padding
                    // characters will also be detected as a valid if allowed.
                    engine.decode_slice([65, 65, c, c], &mut [0, 0, 0]).is_ok()
                }),
                |data| engine.decode(data),
            )
            .parse(input)
        }
    }

    #[cfg(feature = "ssh")]
    #[cfg_attr(docsrs, doc(cfg(feature = "ssh")))]
    pub(crate) fn wrapped_str_while_encoded(
        engine: impl Engine,
    ) -> impl Fn(&str) -> IResult<&str, Vec<u8>> {
        use nom::{bytes::streaming::take_while1, character::streaming::line_ending};

        move |input: &str| {
            map_res(
                separated_list1(
                    line_ending,
                    take_while1(|c| {
                        let c = c as u8;
                        // Substitute the character in twice after AA, so that padding
                        // characters will also be detected as a valid if allowed.
                        engine.decode_slice([65, 65, c, c], &mut [0, 0, 0]).is_ok()
                    }),
                ),
                |chunks| {
                    let data = chunks.join("");
                    engine.decode(data)
                },
            )
            .parse(input)
        }
    }

    pub(crate) fn base64_arg<A: AsRef<[u8]>, const N: usize, const B: usize>(
        arg: &A,
    ) -> Option<[u8; N]> {
        if N > B {
            return None;
        }

        let mut buf = [0; B];
        match BASE64_STANDARD_NO_PAD.decode_slice(arg, buf.as_mut()) {
            Ok(n) if n == N => Some(buf[..N].try_into().unwrap()),
            _ => None,
        }
    }

    /// Parses a decimal number composed only of digits with no leading zeros.
    pub(crate) fn decimal_digit_arg<T: FromStr>(arg: &str) -> Option<T> {
        verify::<_, _, (), _, _>(digit1, |n: &str| !n.starts_with('0'))
            .parse_complete(arg)
            .ok()
            .and_then(|(_, n)| n.parse_to())
    }
}

pub(crate) mod write {
    use base64::{Engine, prelude::BASE64_STANDARD_NO_PAD};
    use cookie_factory::{SerializeFn, combinator::string};
    use std::io::Write;

    pub(crate) fn encoded_data<W: Write>(data: &[u8]) -> impl SerializeFn<W> + use<W> {
        let encoded = BASE64_STANDARD_NO_PAD.encode(data);
        string(encoded)
    }
}

```

### Core Architecture Module: `age-plugin/examples/age-plugin-unencrypted.rs`
```
use age_core::{
    format::{FileKey, Stanza},
    secrecy::ExposeSecret,
};
use age_plugin::{
    Callbacks, PluginHandler,
    identity::{self, IdentityPluginV1},
    print_new_identity,
    recipient::{self, RecipientPluginV1},
    run_state_machine,
};
use clap::Parser;

use std::collections::{HashMap, HashSet};
use std::convert::Infallible;
use std::env;
use std::io;

const PLUGIN_NAME: &str = "unencrypted";
const RECIPIENT_TAG: &str = PLUGIN_NAME;

fn explode(location: &str) {
    if let Ok(s) = env::var("AGE_EXPLODES") {
        if s == location {
            panic!("Env variable AGE_EXPLODES={location} is set. Boom! 💥");
        }
    }
}

struct FullHandler;

impl PluginHandler for FullHandler {
    type RecipientV1 = RecipientPlugin;
    type IdentityV1 = IdentityPlugin;

    fn recipient_v1(self) -> io::Result<Self::RecipientV1> {
        Ok(RecipientPlugin::new())
    }

    fn identity_v1(self) -> io::Result<Self::IdentityV1> {
        Ok(IdentityPlugin)
    }
}

struct RecipientHandler;

impl PluginHandler for RecipientHandler {
    type RecipientV1 = RecipientPlugin;
    type IdentityV1 = Infallible;

    fn recipient_v1(self) -> io::Result<Self::RecipientV1> {
        Ok(RecipientPlugin::new())
    }
}

struct IdentityHandler;

impl PluginHandler for IdentityHandler {
    type RecipientV1 = Infallible;
    type IdentityV1 = IdentityPlugin;

    fn identity_v1(self) -> io::Result<Self::IdentityV1> {
        Ok(IdentityPlugin)
    }
}

struct RecipientPlugin {
    recipients: Vec<Vec<u8>>,
    identities: Vec<Vec<u8>>,
}

impl RecipientPlugin {
    fn new() -> Self {
        Self {
            recipients: Vec::new(),
            identities: Vec::new(),
        }
    }
}

impl RecipientPluginV1 for RecipientPlugin {
    fn add_recipient(
        &mut self,
        index: usize,
        plugin_name: &str,
        bytes: &[u8],
    ) -> Result<(), recipient::Error> {
        eprintln!("age-plugin-unencrypted: RecipientPluginV1::add_recipient called");
        explode("recipient");
        if plugin_name == PLUGIN_NAME {
            // A real plugin would parse the recipient here.
            self.recipients.push(bytes.to_vec());
            Ok(())
        } else {
            Err(recipient::Error::Recipient {
                index,
                message: "invalid recipient".to_owned(),
            })
        }
    }

    fn add_identity(
        &mut self,
        index: usize,
        plugin_name: &str,
        bytes: &[u8],
    ) -> Result<(), recipient::Error> {
        eprintln!("age-plugin-unencrypted: RecipientPluginV1::add_identity called");
        explode("identity");
        if plugin_name == PLUGIN_NAME {
            // A real plugin would parse the identity.
            self.identities.push(bytes.to_vec());
            Ok(())
        } else {
            Err(recipient::Error::Identity {
                index,
                message: "invalid identity".to_owned(),
            })
        }
    }

    fn labels(&mut self) -> HashSet<String> {
        let mut labels = HashSet::new();
        if let Ok(s) = env::var("AGE_PLUGIN_LABELS") {
            for label in s.split(',') {
                labels.insert(label.into());
            }
        }
        labels
    }

    fn wrap_file_keys(
        &mut self,
        file_keys: Vec<FileKey>,
        mut callbacks: impl Callbacks<recipient::Error>,
    ) -> io::Result<Result<Vec<Vec<Stanza>>, Vec<recipient::Error>>> {
        eprintln!("age-plugin-unencrypted: RecipientPluginV1::wrap_file_keys called");
        explode("wrap");
        // A real plugin would wrap the file key here.
        let _ = callbacks
            .message("This plugin doesn't have any recipient-specific logic. It's unencrypted!")?;
        Ok(Ok(file_keys
            .into_iter()
            .map(|file_key| {
                self.recipients
                    .iter()
                    .chain(&self.identities)
                    .flat_map(|_| {
                        let count = match env::var("AGE_PLUGIN_STANZAS_PER_RECIPIENT") {
                            Ok(n) => n.parse().unwrap_or(1),
                            Err(_) => 1,
                        };
                        (0..count).map(|_| Stanza {
                            tag: RECIPIENT_TAG.to_owned(),
                            args: vec!["does".to_owned(), "nothing".to_owned()],
                            body: file_key.expose_secret().to_vec(),
                        })
                    })
                    .collect()
            })
            .collect()))
    }
}

struct IdentityPlugin;

impl IdentityPluginV1 for IdentityPlugin {
    fn add_identity(
        &mut self,
        index: usize,
        plugin_name: &str,
        _bytes: &[u8],
    ) -> Result<(), identity::Error> {
        eprintln!("age-plugin-unencrypted: IdentityPluginV1::add_identity called");
        explode("identity");
        if plugin_name == PLUGIN_NAME {
            // A real plugin would store the identity.
            Ok(())
        } else {
            Err(identity::Error::Identity {
                index,
                message: "invalid identity".to_owned(),
            })
        }
    }

    fn unwrap_file_keys(
        &mut self,
        files: Vec<Vec<Stanza>>,
        mut callbacks: impl Callbacks<identity::Error>,
    ) -> io::Result<HashMap<usize, Result<FileKey, Vec<identity::Error>>>> {
        eprintln!("age-plugin-unencrypted: IdentityPluginV1::unwrap_file_keys called");
        explode("unwrap");
        let mut file_keys = HashMap::with_capacity(files.len());
        for (file_index, stanzas) in files.into_iter().enumerate() {
            for stanza in stanzas {
                if stanza.tag == RECIPIENT_TAG {
                    // A real plugin would attempt to unwrap the file key with the stored
                    // identities.
                    let _ = callbacks.message("This identity does nothing!")?;
                    file_keys.entry(file_index).or_insert_with(|| {
                        FileKey::try_init_with_mut(|file_key| {
                            if stanza.body.len() == file_key.len() {
                                file_key.copy_from_slice(&stanza.body);
                                Ok(())
                            } else {
                                panic!("File key is wrong length")
                            }
                        })
                    });
                    break;
                }
            }
        }
        Ok(file_keys)
    }
}

#[derive(Debug, Parser)]
struct PluginOptions {
    #[arg(help = "run the given age plugin state machine", long)]
    age_plugin: Option<String>,
}

fn main() -> io::Result<()> {
    let opts = PluginOptions::parse();

    if let Some(state_machine) = opts.age_plugin {
        if let Ok(s) = env::var("AGE_HALF_PLUGIN") {
            match s.as_str() {
                "recipient" => run_state_machine(&state_machine, RecipientHandler),
                "identity" => run_state_machine(&state_machine, IdentityHandler),
                _ => panic!("Env variable AGE_HALF_PLUGIN={s} has unknown value. Boom! 💥"),
            }
        } else {
            run_state_machine(&state_machine, FullHandler)
        }
    } else {
        // A real plugin would generate a new identity here.
        print_new_identity(PLUGIN_NAME, &[], &[]);
        Ok(())
    }
}

```

### Core Architecture Module: `age-plugin/src/identity.rs`
```
//! Identity plugin helpers.

use age_core::{
    format::{FileKey, Stanza},
    plugin::{self, BidirSend, Connection},
    primitives::bech32_decode,
    secrecy::{ExposeSecret, SecretString},
};
use base64::{Engine, prelude::BASE64_STANDARD_NO_PAD};

use std::collections::HashMap;
use std::convert::Infallible;
use std::io;

use crate::{Callbacks, PLUGIN_IDENTITY_PREFIX};

const ADD_IDENTITY: &str = "add-identity";
const RECIPIENT_STANZA: &str = "recipient-stanza";

/// The interface that age implementations will use to interact with an age plugin.
///
/// Implementations of this trait will be used within the [`identity-v1`] state machine.
///
/// [`identity-v1`]: https://c2sp.org/age-plugin#unwrapping-with-identity-v1
pub trait IdentityPluginV1 {
    /// Stores an identity that the user would like to use for decrypting age files.
    ///
    /// `plugin_name` is the name of the binary that resolved to this plugin.
    ///
    /// Returns an error if the identity is unknown or invalid.
    fn add_identity(&mut self, index: usize, plugin_name: &str, bytes: &[u8]) -> Result<(), Error>;

    /// Attempts to unwrap the file keys contained within the given age recipient stanzas,
    /// using identities previously stored via [`add_identity`].
    ///
    /// Returns a `HashMap` containing the unwrapping results for each file:
    ///
    /// - A list of errors, if any stanzas for a file cannot be unwrapped that detectably
    ///   should be unwrappable.
    ///
    /// - A [`FileKey`], if any stanza for a file can be successfully unwrapped.
    ///
    /// Note that if all known and valid stanzas for a given file cannot be unwrapped, and
    /// none are expected to be unwrappable, that file has no entry in the `HashMap`. That
    /// is, file keys that cannot be unwrapped are implicit.
    ///
    /// `callbacks` can be used to interact with the user, to have them take some physical
    /// action or request a secret value.
    ///
    /// [`add_identity`]: IdentityPluginV1::add_identity
    fn unwrap_file_keys(
        &mut self,
        files: Vec<Vec<Stanza>>,
        callbacks: impl Callbacks<Error>,
    ) -> io::Result<HashMap<usize, Result<FileKey, Vec<Error>>>>;
}

impl IdentityPluginV1 for Infallible {
    fn add_identity(&mut self, _: usize, _: &str, _: &[u8]) -> Result<(), Error> {
        // This is never executed.
        Ok(())
    }

    fn unwrap_file_keys(
        &mut self,
        _: Vec<Vec<Stanza>>,
        _: impl Callbacks<Error>,
    ) -> io::Result<HashMap<usize, Result<FileKey, Vec<Error>>>> {
        // This is never executed.
        Ok(HashMap::new())
    }
}

/// The interface that age plugins can use to interact with an age implementation.
struct BidirCallbacks<'a, 'b, R: io::Read, W: io::Write>(&'b mut BidirSend<'a, R, W>);

impl<R: io::Read, W: io::Write> Callbacks<Error> for BidirCallbacks<'_, '_, R, W> {
    /// Shows a message to the user.
    ///
    /// This can be used to prompt the user to take some physical action, such as
    /// inserting a hardware key.
    fn message(&mut self, message: &str) -> plugin::Result<()> {
        self.0
            .send("msg", &[], message.as_bytes())
            .map(|res| res.map(|_| ()))
    }

    fn confirm(
        &mut self,
        message: &str,
        yes_string: &str,
        no_string: Option<&str>,
    ) -> age_core::plugin::Result<bool> {
        let metadata: Vec<_> = Some(yes_string)
            .into_iter()
            .chain(no_string)
            .map(|s| BASE64_STANDARD_NO_PAD.encode(s))
            .collect();
        let metadata: Vec<_> = metadata.iter().map(|s| s.as_str()).collect();

        self.0
            .send("confirm", &metadata, message.as_bytes())
            .and_then(|res| match res {
                Ok(s) => match &s.args[..] {
                    [x] if x == "yes" => Ok(Ok(true)),
                    [x] if x == "no" => Ok(Ok(false)),
                    _ => Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        "Invalid response to confirm command",
                    )),
                },
                Err(e) => Ok(Err(e)),
            })
    }

    fn request_public(&mut self, message: &str) -> plugin::Result<String> {
        self.0
            .send("request-public", &[], message.as_bytes())
            .and_then(|res| match res {
                Ok(s) => String::from_utf8(s.body)
                    .map_err(|_| {
                        io::Error::new(io::ErrorKind::InvalidData, "response is not UTF-8")
                    })
                    .map(Ok),
                Err(e) => Ok(Err(e)),
            })
    }

    /// Requests a secret value from the user, such as a passphrase.
    ///
    /// `message` will be displayed to the user, providing context for the request.
    fn request_secret(&mut self, message: &str) -> plugin::Result<SecretString> {
        self.0
            .send("request-secret", &[], message.as_bytes())
            .and_then(|res| match res {
                Ok(s) => String::from_utf8(s.body)
                    .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "secret is not UTF-8"))
                    .map(|s| Ok(SecretString::from(s))),
                Err(e) => Ok(Err(e)),
            })
    }

    fn error(&mut self, error: Error) -> plugin::Result<()> {
        error.send(self.0).map(|()| Ok(()))
    }
}

/// The kinds of errors that can occur within the identity plugin state machine.
pub enum Error {
    /// An error caused by a specific identity.
    Identity {
        /// The index of the identity.
        index: usize,
        /// The error message.
        message: String,
    },
    /// A general error that occured inside the state machine.
    Internal {
        /// The error message.
        message: String,
    },
    /// An error caused by a specific stanza.
    ///
    /// Note that unknown stanzas MUST be ignored by plugins; this error is only for
    /// stanzas that have a supported tag but are otherwise invalid (indicating an invalid
    /// age file).
    Stanza {
        /// The index of the file containing the stanza.
        file_index: usize,
        /// The index of the stanza within the file.
        stanza_index: usize,
        /// The error message.
        message: String,
    },
}

impl Error {
    fn kind(&self) -> &str {
        match self {
            Error::Identity { .. } => "identity",
            Error::Internal { .. } => "internal",
            Error::Stanza { .. } => "stanza",
        }
    }

    fn message(&self) -> &str {
        match self {
            Error::Identity { message, .. } => message,
            Error::Internal { message } => message,
            Error::Stanza { message, .. } => message,
        }
    }

    fn send<R: io::Read, W: io::Write>(self, phase: &mut BidirSend<R, W>) -> io::Result<()> {
        let index = match self {
            Error::Identity { index, .. } => Some((index.to_string(), None)),
            Error::Internal { .. } => None,
            Error::Stanza {
                file_index,
                stanza_index,
                ..
            } => Some((file_index.to_string(), Some(stanza_index.to_string()))),
        };

        let metadata = match &index {
            Some((file_index, Some(stanza_index))) => vec![self.kind(), file_index, stanza_index],
            Some((index, None)) => vec![self.kind(), index],
            None => vec![self.kind()],
        };

        phase
            .send("error", &metadata, self.message().as_bytes())?
            .unwrap();

        Ok(())
    }
}

/// Runs the identity plugin v1 protocol.
pub(crate) fn run_v1<P: IdentityPluginV1>(mut plugin: P) -> io::Result<()> {
    let mut conn = Connection::accept();

    // Phase 1: receive identities and stanzas
    let (identities, recipient_stanzas) = {
        let (identities, stanzas, _, _) = conn.unidir_receive(
            (ADD_IDENTITY, |s| match (&s.args[..], &s.body[..]) {
                ([identity], []) => Ok(identity.clone()),
                _ => Err(Error::Internal {
                    message: format!(
                        "{ADD_IDENTITY} command must have exactly one metadata argument and no data"
                    ),
                }),
            }),
            (RECIPIENT_STANZA, |mut s| {
                if s.args.len() >= 2 {
                    let file_index = s.args.remove(0);
                    s.tag = s.args.remove(0);
                    file_index
                        .parse::<usize>()
                        .map(|i| (i, s))
                        .map_err(|_| Error::Internal {
                            message: format!(
                                "first metadata argument to {RECIPIENT_STANZA} must be an integer"
                            ),
                        })
                } else {
                    Err(Error::Internal {
                        message: format!(
                            "{RECIPIENT_STANZA} command must have at least two metadata arguments"
                        ),
                    })
                }
            }),
            (None, |_| Ok(())),
            (None, |_| Ok(())),
        )?;

        // Now that we have the full list of identities, parse them as Bech32 and add them
        // to the plugin.
        let identities = identities.and_then(|items| {
            let errors: Vec<_> = items
                .into_iter()
                .enumerate()
                .map(|(index, item)| {
                    bech32_decode(
                        &item,
                        |_| "invalid Bech32 encoding",
                        |hrp| {
                            (hrp.len() > PLUGIN_IDENTITY_PREFIX.len()
                                && hrp.as_str().starts_with(PLUGIN_IDENTITY_PREFIX)
                                && hrp.as_str().ends_with('-'))
                            .then_some(())
                            .ok_or("invalid HRP")
                    
```

### Core Architecture Module: `age-plugin/src/lib.rs`
```
//! This crate provides an API for building age plugins.
//!
//! # Introduction
//!
//! The [age file encryption format] follows the "one well-oiled joint" design philosophy.
//! The mechanism for extensibility (within a particular format version) is the recipient
//! stanzas within the age header: file keys can be wrapped in any number of ways, and age
//! clients are required to ignore stanzas that they do not understand.
//!
//! The core APIs that exercise this mechanism are:
//! - A recipient that wraps a file key and returns a stanza.
//! - An identity that unwraps a stanza and returns a file key.
//!
//! The age plugin system provides a mechanism for exposing these core APIs across process
//! boundaries. It has two main components:
//!
//! - A map from recipients and identities to plugin binaries.
//! - State machines for wrapping and unwrapping file keys.
//!
//! With this composable design, you can implement a recipient or identity that you might
//! use directly with the [`age`] library crate, and also deploy it as a plugin binary for
//! use with clients like [`rage`].
//!
//! [age file encryption format]: https://age-encryption.org/v1
//! [`age`]: https://crates.io/crates/age
//! [`rage`]: https://crates.io/crates/rage
//!
//! # Mapping recipients and identities to plugin binaries
//!
//! age plugins are identified by an arbitrary case-insensitive string `NAME`. This string
//! is used in three places:
//!
//! - Plugin-compatible recipients are encoded using Bech32 with the HRP `age1name`
//!   (lowercase).
//! - Plugin-compatible identities are encoded using Bech32 with the HRP
//!   `AGE-PLUGIN-NAME-` (uppercase).
//! - Plugin binaries (to be started by age clients) are named `age-plugin-name`.
//!
//! Users interact with age clients by providing either recipients for file encryption, or
//! identities for file decryption. When a plugin recipient or identity is provided, the
//! age client searches the `PATH` for a binary with the corresponding plugin name.
//!
//! Recipient stanza types are not required to be correlated to specific plugin names.
//! When decrypting, age clients will pass all recipient stanzas to every connected
//! plugin. Plugins MUST ignore stanzas that they do not know about.
//!
//! A plugin binary may handle multiple recipient or identity types by being present in
//! the `PATH` under multiple names. This can be implemented with symlinks or aliases to
//! the canonical binary.
//!
//! Multiple plugin binaries can support the same recipient and identity types; the first
//! binary found in the `PATH` will be used by age clients. Some Unix OSs support
//! "alternatives", which plugin binaries should leverage if they provide support for a
//! common recipient or identity type.
//!
//! Note that the identity specified by a user doesn't need to point to a specific
//! decryption key, or indeed contain any key material at all. It only needs to contain
//! sufficient information for the plugin to locate the necessary key material.
//!
//! ## Standard age keys
//!
//! A plugin MAY support decrypting files encrypted to native age recipients, by including
//! support for the `x25519` recipient stanza. Such plugins will pick their own name, and
//! users will use identity files containing identities that specify that plugin name.
//!
//! # Example plugin binary
//!
//! The following example uses `clap` to parse CLI arguments, but any argument parsing
//! logic will work as long as it can detect the `--age-plugin=STATE_MACHINE` flag.
//!
//! ```
//! use age_core::format::{FileKey, Stanza};
//! use age_plugin::{
//!     identity::{self, IdentityPluginV1},
//!     print_new_identity,
//!     recipient::{self, RecipientPluginV1},
//!     Callbacks, PluginHandler, run_state_machine,
//! };
//! use clap::Parser;
//!
//! use std::collections::{HashMap, HashSet};
//! use std::io;
//!
//! struct Handler;
//!
//! impl PluginHandler for Handler {
//!     type RecipientV1 = RecipientPlugin;
//!     type IdentityV1 = IdentityPlugin;
//!
//!     fn recipient_v1(self) -> io::Result<Self::RecipientV1> {
//!         Ok(RecipientPlugin)
//!     }
//!
//!     fn identity_v1(self) -> io::Result<Self::IdentityV1> {
//!         Ok(IdentityPlugin)
//!     }
//! }
//!
//! struct RecipientPlugin;
//!
//! impl RecipientPluginV1 for RecipientPlugin {
//!     fn add_recipient(
//!         &mut self,
//!         index: usize,
//!         plugin_name: &str,
//!         bytes: &[u8],
//!     ) -> Result<(), recipient::Error> {
//!         todo!()
//!     }
//!
//!     fn add_identity(
//!         &mut self,
//!         index: usize,
//!         plugin_name: &str,
//!         bytes: &[u8]
//!     ) -> Result<(), recipient::Error> {
//!         todo!()
//!     }
//!
//!     fn labels(&mut self) -> HashSet<String> {
//!         todo!()
//!     }
//!
//!     fn wrap_file_keys(
//!         &mut self,
//!         file_keys: Vec<FileKey>,
//!         mut callbacks: impl Callbacks<recipient::Error>,
//!     ) -> io::Result<Result<Vec<Vec<Stanza>>, Vec<recipient::Error>>> {
//!         todo!()
//!     }
//! }
//!
//! struct IdentityPlugin;
//!
//! impl IdentityPluginV1 for IdentityPlugin {
//!     fn add_identity(
//!         &mut self,
//!         index: usize,
//!         plugin_name: &str,
//!         bytes: &[u8]
//!     ) -> Result<(), identity::Error> {
//!         todo!()
//!     }
//!
//!     fn unwrap_file_keys(
//!         &mut self,
//!         files: Vec<Vec<Stanza>>,
//!         mut callbacks: impl Callbacks<identity::Error>,
//!     ) -> io::Result<HashMap<usize, Result<FileKey, Vec<identity::Error>>>> {
//!         todo!()
//!     }
//! }
//!
//! #[derive(Debug, Parser)]
//! struct PluginOptions {
//!     #[arg(help = "run the given age plugin state machine", long)]
//!     age_plugin: Option<String>,
//! }
//!
//! fn main() -> io::Result<()> {
//!     let opts = PluginOptions::parse();
//!
//!     if let Some(state_machine) = opts.age_plugin {
//!         // The plugin was started by an age client; run the state machine.
//!         run_state_machine(&state_machine, Handler)?;
//!         return Ok(());
//!     }
//!
//!     // Here you can assume the binary is being run directly by a user,
//!     // and perform administrative tasks like generating keys.
//!
//!     Ok(())
//! }
//! ```

#![forbid(unsafe_code)]
// Catch documentation errors caused by code changes.
#![deny(rustdoc::broken_intra_doc_links)]
#![deny(missing_docs)]

use age_core::{
    primitives::bech32_encode,
    secrecy::{SecretString, zeroize::Zeroize},
};
use bech32::Hrp;
use std::io;

pub mod identity;
pub mod recipient;

// Plugin HRPs are age1[name] and AGE-PLUGIN-[NAME]-
const PLUGIN_RECIPIENT_PREFIX: &str = "age1";
const PLUGIN_IDENTITY_PREFIX: &str = "AGE-PLUGIN-";

/// Prints the newly-created identity and corresponding recipient to standard out.
///
/// A "created" time is included in the output, set to the current local time.
pub fn print_new_identity(plugin_name: &str, identity: &[u8], recipient: &[u8]) {
    let mut identity_lower = bech32_encode(
        Hrp::parse_unchecked(&format!("{PLUGIN_IDENTITY_PREFIX}{plugin_name}-")),
        identity,
    );

    println!(
        "# created: {}",
        chrono::Local::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
    );
    println!(
        "# recipient: {}",
        bech32_encode(
            Hrp::parse_unchecked(&format!("{PLUGIN_RECIPIENT_PREFIX}{plugin_name}")),
            recipient,
        )
    );
    println!("{}", identity_lower.to_uppercase());

    identity_lower.zeroize();
}

/// Runs the plugin state machine defined by `state_machine`.
///
/// This should be triggered if the `--age-plugin=state_machine` flag is provided as an
/// argument when starting the plugin.
///
/// # Panics
///
/// The state machine will panic if the `PluginHandler` implementation violates any
/// **MUST** requirements of the [age plugin specification]. Examples include:
/// - Returning fewer stanzas from [`RecipientPluginV1::wrap_file_keys`] than the number
///   of recipients and identities that were provided (instead of returning an error if
///   any could not be encrypted to).
///   - Note that this currently prohibits plugins from automatically deduplicating
///     provided recipients and identities; either duplicate stanzas must be produced, or
///     an error returned. This prohibition might be lifted in a future release.
///
/// [age plugin specification]: https://c2sp.org/age-plugin
/// [`RecipientPluginV1::wrap_file_keys`]: crate::recipient::RecipientPluginV1::wrap_file_keys
pub fn run_state_machine(state_machine: &str, handler: impl PluginHandler) -> io::Result<()> {
    use age_core::plugin::{IDENTITY_V1, RECIPIENT_V1};

    match state_machine {
        RECIPIENT_V1 => recipient::run_v1(handler.recipient_v1()?),
        IDENTITY_V1 => identity::run_v1(handler.identity_v1()?),
        _ => Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "unknown plugin state machine",
        )),
    }
}

/// The interfaces that age implementations will use to interact with an age plugin.
///
/// This trait exists to encapsulate the set of arguments to [`run_state_machine`] that
/// different plugins may want to provide.
///
/// # How to implement this trait
///
/// ## Full plugins
///
/// - Set all associated types to your plugin's implementations.
/// - Override all default methods of the trait.
///
/// ## Recipient-only plugins
///
/// - Set [`PluginHandler::RecipientV1`] to your plugin's implementation.
/// - Override [`PluginHandler::recipient_v1`] to return an instance of your type.
/// - Set [`PluginHandler::IdentityV1`] to [`std::convert::Infallible`].
/// - Don't override [`PluginHandler::identity_v1`].
///
/// ## Identity-only plugins
///
/// - Set [`PluginHandler::RecipientV1`] to [`std::convert::Infallible`].
/// - Don't override [`PluginHandler::recipient_v1`].
/// - Set [`PluginHandler::IdentityV1`] to your plugin's implementation.
/// - Overrid
```

### Core Architecture Module: `age-plugin/src/recipient.rs`
```
//! Recipient plugin helpers.

use age_core::{
    format::{FileKey, Stanza, is_arbitrary_string},
    plugin::{self, BidirSend, Connection},
    primitives::bech32_decode,
    secrecy::SecretString,
};
use base64::{Engine, prelude::BASE64_STANDARD_NO_PAD};

use std::collections::HashSet;
use std::convert::Infallible;
use std::io;

use crate::{Callbacks, PLUGIN_IDENTITY_PREFIX, PLUGIN_RECIPIENT_PREFIX};

const ADD_RECIPIENT: &str = "add-recipient";
const ADD_IDENTITY: &str = "add-identity";
const WRAP_FILE_KEY: &str = "wrap-file-key";
const EXTENSION_LABELS: &str = "extension-labels";
const RECIPIENT_STANZA: &str = "recipient-stanza";
const LABELS: &str = "labels";

/// The interface that age implementations will use to interact with an age plugin.
///
/// Implementations of this trait will be used within the [`recipient-v1`] state machine.
///
/// The trait methods are always called in this order:
/// - [`Self::add_recipient`] / [`Self::add_identity`] (in any order, including
///   potentially interleaved).
/// - [`Self::labels`] (once all recipients and identities have been added).
/// - [`Self::wrap_file_keys`]
///
/// [`recipient-v1`]: https://c2sp.org/age-plugin#wrapping-with-recipient-v1
pub trait RecipientPluginV1 {
    /// Stores a recipient that the user would like to encrypt age files to.
    ///
    /// `plugin_name` is the name of the binary that resolved to this plugin.
    ///
    /// Returns an error if the recipient is unknown or invalid.
    fn add_recipient(&mut self, index: usize, plugin_name: &str, bytes: &[u8])
    -> Result<(), Error>;

    /// Stores an identity that the user would like to encrypt age files to.
    ///
    /// `plugin_name` is the name of the binary that resolved to this plugin.
    ///
    /// Returns an error if the identity is unknown or invalid.
    fn add_identity(&mut self, index: usize, plugin_name: &str, bytes: &[u8]) -> Result<(), Error>;

    /// Returns labels that constrain how the stanzas produced by [`Self::wrap_file_keys`]
    /// may be combined with those from other recipients.
    ///
    /// Encryption will succeed only if every recipient returns the same set of labels.
    /// Subsets or partial overlapping sets are not allowed; all sets must be identical.
    /// Labels are compared exactly, and are case-sensitive.
    ///
    /// Label sets can be used to ensure a recipient is only encrypted to alongside other
    /// recipients with equivalent properties, or to ensure a recipient is always used
    /// alone. A recipient with no particular properties to enforce should return an empty
    /// label set.
    ///
    /// Labels can have any value that is a valid arbitrary string (`1*VCHAR` in ABNF),
    /// but usually take one of several forms:
    ///   - *Common public label* - used by multiple recipients to permit their stanzas to
    ///     be used only together. Examples include:
    ///     - `postquantum` - indicates that the recipient stanzas being generated are
    ///       postquantum-secure, and that they can only be combined with other stanzas
    ///       that are also postquantum-secure.
    ///   - *Common private label* - used by recipients created by the same private entity
    ///     to permit their recipient stanzas to be used only together. For example,
    ///     private recipients used in a corporate environment could all send the same
    ///     private label in order to prevent compliant age clients from simultaneously
    ///     wrapping file keys with other recipients.
    ///   - *Random label* - used by recipients that want to ensure their stanzas are not
    ///     used with any other recipient stanzas. This can be used to produce a file key
    ///     that is only encrypted to a single recipient stanza, for example to preserve
    ///     its authentication properties.
    fn labels(&mut self) -> HashSet<String>;

    /// Wraps each `file_key` to all recipients and identities previously added via
    /// `add_recipient` and `add_identity`.
    ///
    /// Returns a set of stanzas per file key that wrap it to each recipient and identity.
    /// Plugins may return more than one stanza per "actual recipient", e.g. to support
    /// multiple formats, to build group aliases, or to act as a proxy.
    ///
    /// If one or more recipients or identities could not be wrapped to, `Err(_)` **MUST**
    /// be returned.
    ///
    /// `callbacks` can be used to interact with the user, to have them take some physical
    /// action or request a secret value.
    fn wrap_file_keys(
        &mut self,
        file_keys: Vec<FileKey>,
        callbacks: impl Callbacks<Error>,
    ) -> io::Result<Result<Vec<Vec<Stanza>>, Vec<Error>>>;
}

impl RecipientPluginV1 for Infallible {
    fn add_recipient(&mut self, _: usize, _: &str, _: &[u8]) -> Result<(), Error> {
        // This is never executed.
        Ok(())
    }

    fn add_identity(&mut self, _: usize, _: &str, _: &[u8]) -> Result<(), Error> {
        // This is never executed.
        Ok(())
    }

    fn labels(&mut self) -> HashSet<String> {
        // This is never executed.
        HashSet::new()
    }

    fn wrap_file_keys(
        &mut self,
        _: Vec<FileKey>,
        _: impl Callbacks<Error>,
    ) -> io::Result<Result<Vec<Vec<Stanza>>, Vec<Error>>> {
        // This is never executed.
        Ok(Ok(vec![]))
    }
}

/// The interface that age plugins can use to interact with an age implementation.
struct BidirCallbacks<'a, 'b, R: io::Read, W: io::Write>(&'b mut BidirSend<'a, R, W>);

impl<R: io::Read, W: io::Write> Callbacks<Error> for BidirCallbacks<'_, '_, R, W> {
    /// Shows a message to the user.
    ///
    /// This can be used to prompt the user to take some physical action, such as
    /// inserting a hardware key.
    fn message(&mut self, message: &str) -> plugin::Result<()> {
        self.0
            .send("msg", &[], message.as_bytes())
            .map(|res| res.map(|_| ()))
    }

    fn confirm(
        &mut self,
        message: &str,
        yes_string: &str,
        no_string: Option<&str>,
    ) -> age_core::plugin::Result<bool> {
        let metadata: Vec<_> = Some(yes_string)
            .into_iter()
            .chain(no_string)
            .map(|s| BASE64_STANDARD_NO_PAD.encode(s))
            .collect();
        let metadata: Vec<_> = metadata.iter().map(|s| s.as_str()).collect();

        self.0
            .send("confirm", &metadata, message.as_bytes())
            .and_then(|res| match res {
                Ok(s) => match &s.args[..] {
                    [x] if x == "yes" => Ok(Ok(true)),
                    [x] if x == "no" => Ok(Ok(false)),
                    _ => Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        "Invalid response to confirm command",
                    )),
                },
                Err(e) => Ok(Err(e)),
            })
    }

    fn request_public(&mut self, message: &str) -> plugin::Result<String> {
        self.0
            .send("request-public", &[], message.as_bytes())
            .and_then(|res| match res {
                Ok(s) => String::from_utf8(s.body)
                    .map_err(|_| {
                        io::Error::new(io::ErrorKind::InvalidData, "response is not UTF-8")
                    })
                    .map(Ok),
                Err(e) => Ok(Err(e)),
            })
    }

    /// Requests a secret value from the user, such as a passphrase.
    ///
    /// `message` will be displayed to the user, providing context for the request.
    fn request_secret(&mut self, message: &str) -> plugin::Result<SecretString> {
        self.0
            .send("request-secret", &[], message.as_bytes())
            .and_then(|res| match res {
                Ok(s) => String::from_utf8(s.body)
                    .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "secret is not UTF-8"))
                    .map(|s| Ok(SecretString::from(s))),
                Err(e) => Ok(Err(e)),
            })
    }

    fn error(&mut self, error: Error) -> plugin::Result<()> {
        error.send(self.0).map(|()| Ok(()))
    }
}

/// The kinds of errors that can occur within the recipient plugin state machine.
pub enum Error {
    /// An error caused by a specific recipient.
    Recipient {
        /// The index of the recipient.
        index: usize,
        /// The error message.
        message: String,
    },
    /// An error caused by a specific identity.
    Identity {
        /// The index of the identity.
        index: usize,
        /// The error message.
        message: String,
    },
    /// A general error that occured inside the state machine.
    Internal {
        /// The error message.
        message: String,
    },
}

impl Error {
    fn kind(&self) -> &str {
        match self {
            Error::Recipient { .. } => "recipient",
            Error::Identity { .. } => "identity",
            Error::Internal { .. } => "internal",
        }
    }

    fn message(&self) -> &str {
        match self {
            Error::Recipient { message, .. } => message,
            Error::Identity { message, .. } => message,
            Error::Internal { message } => message,
        }
    }

    fn send<R: io::Read, W: io::Write>(self, phase: &mut BidirSend<R, W>) -> io::Result<()> {
        let index = match self {
            Error::Recipient { index, .. } | Error::Identity { index, .. } => {
                Some(index.to_string())
            }
            Error::Internal { .. } => None,
        };

        let metadata = match &index {
            Some(index) => vec![self.kind(), index],
            None => vec![self.kind()],
        };

        phase
            .send("error", &metadata, self.message().as_bytes())?
            .unwrap();

        Ok(())
    }
}

/// Runs the recipient plugin v1 protocol.
pub(crate) fn run_v1<P: RecipientPluginV1>(mut plugin: P) -> io::Result<()> {
    let mut conn = Connection::accept();

    // Phase 1: colle
```

### Core Architecture Module: `age/benches/parser.rs`
```
use age::{Decryptor, Encryptor, x25519};
use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};

#[cfg(unix)]
use pprof::criterion::{Output, PProfProfiler};

use std::io::Write;

fn bench(c: &mut Criterion) {
    let recipients: Vec<_> = (0..10)
        .map(|_| x25519::Identity::generate().to_public())
        .collect();
    let mut group = c.benchmark_group("header");

    for count in 1..10 {
        group.throughput(Throughput::Elements(count as u64));
        group.bench_function(BenchmarkId::new("parse", count), |b| {
            let mut encrypted = vec![];
            let mut output =
                Encryptor::with_recipients(recipients.iter().take(count).map(|r| r as _))
                    .unwrap()
                    .wrap_output(&mut encrypted)
                    .unwrap();
            output.write_all(&[]).unwrap();
            output.finish().unwrap();

            b.iter(|| Decryptor::new_buffered(&encrypted[..]))
        });
    }

    group.finish();
}

#[cfg(unix)]
criterion_group!(
    name = benches;
    config = Criterion::default()
        .with_profiler(PProfProfiler::new(100, Output::Flamegraph(None)));
    targets = bench
);
#[cfg(not(unix))]
criterion_group!(benches, bench);
criterion_main!(benches);

```

### Core Architecture Module: `age/benches/throughput.rs`
```
use age::{Decryptor, Encryptor, x25519};
use criterion::{BenchmarkId, Criterion, Throughput, criterion_group, criterion_main};

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
use criterion_cycles_per_byte::CyclesPerByte;

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
type Criterion_ = Criterion<CyclesPerByte>;

#[cfg(not(any(target_arch = "x86", target_arch = "x86_64")))]
type Criterion_ = Criterion;

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
fn setup_criterion() -> Criterion_ {
    Criterion::default().with_measurement(CyclesPerByte)
}

#[cfg(not(any(target_arch = "x86", target_arch = "x86_64")))]
fn setup_criterion() -> Criterion_ {
    Criterion::default()
}

#[cfg(unix)]
use pprof::criterion::{Output, PProfProfiler};

use std::io::{self, Read, Write};
use std::iter;

const KB: usize = 1024;

fn bench(c: &mut Criterion_) {
    let identity = x25519::Identity::generate();
    let recipient = identity.to_public();
    let mut group = c.benchmark_group("age");

    // Prepare buffers to use in the benchmarks.
    let pt_buf = vec![7u8; 1024 * KB];
    let mut ct_buf = vec![];
    let mut out_buf = vec![0u8; 1024 * KB];

    for &size in &[
        KB,
        4 * KB,
        16 * KB,
        64 * KB,
        128 * KB,
        256 * KB,
        500 * KB,
        1024 * KB,
    ] {
        group.throughput(Throughput::Bytes(size as u64));

        group.bench_function(BenchmarkId::new("encrypt", size), |b| {
            b.iter(|| {
                let mut output = Encryptor::with_recipients(iter::once(&recipient as _))
                    .unwrap()
                    .wrap_output(io::sink())
                    .unwrap();
                output.write_all(&pt_buf[..size]).unwrap();
                output.finish().unwrap();
            })
        });

        group.bench_function(BenchmarkId::new("decrypt", size), |b| {
            let mut output = Encryptor::with_recipients(iter::once(&recipient as _))
                .unwrap()
                .wrap_output(&mut ct_buf)
                .unwrap();
            output.write_all(&pt_buf[..size]).unwrap();
            output.finish().unwrap();

            b.iter(|| {
                let decryptor = Decryptor::new_buffered(&ct_buf[..]).unwrap();
                let mut input = decryptor
                    .decrypt(iter::once(&identity as &dyn age::Identity))
                    .unwrap();
                input.read_exact(&mut out_buf[..size]).unwrap();
            });

            ct_buf.clear();
        });
    }

    group.finish();
}

#[cfg(unix)]
criterion_group!(
    name = benches;
    config = setup_criterion()
        .with_profiler(PProfProfiler::new(100, Output::Flamegraph(None)));
    targets = bench
);
#[cfg(not(unix))]
criterion_group!(
    name = benches;
    config = setup_criterion();
    targets = bench
);
criterion_main!(benches);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #516** (2024-08-23): **age: Fix feature flag combination bugs in `cli_common` module**
  *Symptoms*: Closes #515.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/str4d/rage/pull/516?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Jack+Grigg) Report Attention: Patch coverage is `71.05263%` with `11 lines` in your changes missing coverage. Please review. > Project coverage is 50.74%. Comparing base [(`0cf17d9`)](https://app.codecov.io/gh/str4d/rage/commit/0cf17d916a29738cbc880d3e9a38ad5cdcd3f1f7?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Jack+Grigg) to head [(`7e3c62b`)](https://app.codecov.io/gh/str4d/rage/commit/7e3c62b98b32d536dd5456043bcd86ff937188f8?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=Jack+Grigg).  | [Files](https://app.codecov.io/gh/str4d/rage/pull/516?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term

- **Issue #515** (2024-08-23): **age: Feature cli-common seems to require features plugin and ssh**
  *Symptoms*: Thanks for age(s)!   While compiling age 10.0 (fetched with cargo) works for me with default (empty) features, it fails with   ```features = ["cli-common"]```  8 errors in file ```age-0.10.0/src/cli_common/recipients.rs``` are reported:   The compiler complains about "plugin::" in  https://github.com/str4d/rage/blob/d2c2e895bfdd1fa37429d44776e490a43c0e4cf1/age/src/cli_common/recipients.rs#L50  https://github.com/str4d/rage/blob/d2c2e895bfdd1fa37429d44776e490a43c0e4cf1/age/src/cli_common/recipients.rs#L64  https://github.com/str4d/rage/blob/d2c2e895bfdd1fa37429d44776e490a43c0e4cf1/age/src/cli_common/recipients.rs#L78  https://github.com/str4d/rage/blob/d2c2e895bfdd1fa37429d44776e490a43c0e4cf1/age/src/cli_common/recipients.rs#L122  https://github.com/str4d/rage/blob/d2c2e895bfdd1fa37429d44776e490a43c0e4cf1/age/src/cli_common/recipients.rs#L123  https://github.com/str4d/rage/blob/d2c2e895bfdd1fa37429d44776e490a43c0e4cf1/age/src/cli_common/recipients.rs#L187   about calling the missing function "parse_ssh_recipient"  https://github.com/str4d/rage/blob/d2c2e895bfdd1fa37429d44776e490a43c0e4cf1/age/src/cli_common/recipients.rs#L157   and the use of "ssh::" in  https://github.com/str4d/rage/blob/d2c2e895bfdd1fa37429d44776e490a43c0e4cf1/age/src/cli_common/recipients.rs#L158   As a "work around" ```features = ["cli-common", "plugin", "ssh"]``` compiles. 
  **Post-Mortem & Fix Analysis**:
  > Good catch, thanks! There were a bunch of feature flag combinations here that I was missing due to the features being inherently enabled in the workspace by the `rage` crate.

- **Issue #321** (2022-05-01): **age: Allow ciphertexts that encrypt the empty plaintext**
  *Symptoms*: In str4d/rage#319 we required the last STREAM chunk to be non-empty, as this is generally non-canonical (and can be represented instead by the chunk marked as last being full). The sole exception to this is if the plaintext has length zero, in which case there is no "previous" chunk, and the single empty chunk is the canonical representation.  There generally isn't a good reason to create empty age ciphertexts, as most identities don't provide authentication guarantees, but we've allowed them in the past.
  **Post-Mortem & Fix Analysis**:
  > # [Codecov](https://codecov.io/gh/str4d/rage/pull/321?src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None) Report > Merging [#321](https://codecov.io/gh/str4d/rage/pull/321?src=pr&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None) (c03bdb0) into [main](https://codecov.io/gh/str4d/rage/commit/9e9bd802c160f8bc4b14073ff23360c943272526?el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None) (9e9bd80) will **increase** coverage by `0.06%`. > The diff coverage is `50.00%`.  ```diff @@            Coverage Diff             @@ ##             main     #321      +/-   ## ========================================== + Coverage   35.53%   35.59%   +0.06%      ==========================================   Files          33       33                 Lines        2927     2930       +3      ========================================== + Hits      

- **Issue #163** (2020-12-30): **Fix MAC verification for V1 headers with legacy stanza bodies**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > # [Codecov](https://codecov.io/gh/str4d/rage/pull/163?src=pr&el=h1) Report > Merging [#163](https://codecov.io/gh/str4d/rage/pull/163?src=pr&el=desc) (007f31d) into [master](https://codecov.io/gh/str4d/rage/commit/78e23e45cd9a286a6d164d914d2cf81db47db32a?el=desc) (78e23e4) will **increase** coverage by `0.19%`. > The diff coverage is `63.04%`.  [![Impacted file tree graph](https://codecov.io/gh/str4d/rage/pull/163/graphs/tree.svg?width=650&height=150&src=pr&token=OunHuQWXyd)](https://codecov.io/gh/str4d/rage/pull/163?src=pr&el=tree)  ```diff @@            Coverage Diff             @@ ##           master     #163      +/-   ## ========================================== + Coverage   39.93%   40.13%   +0.19%      ==========================================   Files          25       26       +1        Lines        2061     2153      +92      ========================================== + Hits          823      864      +41      - Misses       1238     1289      +51      ```   | [Impacted File

- **Issue #80** (2020-02-16): **Handle CRLFs when parsing secret keys**
  *Symptoms*: Closes #79.
  **Post-Mortem & Fix Analysis**:
  > # [Codecov](https://codecov.io/gh/str4d/rage/pull/80?src=pr&el=h1) Report > Merging [#80](https://codecov.io/gh/str4d/rage/pull/80?src=pr&el=desc) into [master](https://codecov.io/gh/str4d/rage/commit/84ca61d44ce2c89da8f000a5d46807702aacd5e4?src=pr&el=desc) will **increase** coverage by `0.62%`. > The diff coverage is `97.22%`.  [![Impacted file tree graph](https://codecov.io/gh/str4d/rage/pull/80/graphs/tree.svg?width=650&token=OunHuQWXyd&height=150&src=pr)](https://codecov.io/gh/str4d/rage/pull/80?src=pr&el=tree)  ```diff @@            Coverage Diff             @@ ##           master      #80      +/-   ## ========================================== + Coverage   49.06%   49.69%   +0.62%      ==========================================   Files          23       23                 Lines        1773     1793      +20      ========================================== + Hits          870      891      +21      + Misses        903      902       -1 ```   | [Impacted Files](https://codecov.io/g

- **Issue #79** (2020-02-16): **Cannot read age keys in CRLF files**
  *Symptoms*: ## Environment  * OS: Windows 10 1909 * rage version: 0.3.1  ## What were you trying to do Decrypt a file encrypted with rage using a rage-keygen generated key.  ## What happened rage says the secret key file is invalid  ![image](https://user-images.githubusercontent.com/1091220/74245858-ae92cc80-4cb1-11ea-9640-08c5f406d09a.png)  
  **Post-Mortem & Fix Analysis**:
  > Here's the key I used in plain text for testing. This happens for all keys I generate but passphrases work fine.   ``` # created: 2020-02-11T09:28:21-05:00 # public key: age18e02scpzf4llwcat8avadmt069uwt3wlym22zcgjkgqupgj75vrsyc36g6 AGE-SECRET-KEY-1TPCFMHDWCMWPMMT2RJL78MRWL5UZEGFWX4XPYTQTST07RAW7PAXQF6HA2N ```
  > I figured it out. It's because I piped the key into a file with powershell. Resulting in `\r\n` control sequences in that `test.key` file. If I use the `-o test.key` it outputs the file with just `\n`.  rage should probably trim these off when reading in keys.
  > Thanks for the report! The age format itself is very precise about its canonicity, so the format parser will not accept CRLFs. The key files OTOH have no such requirement, so it makes sense to parse both LF and CRLF there.

- **Issue #78** (2020-02-11): **Docs failed to build**
  *Symptoms*: https://docs.rs/crate/age/0.3.0/builds
  **Post-Mortem & Fix Analysis**:
  > Ugh, I hoped that wouldn't happen. I guess the docs server is using a recent nightly. I'll make a point release to fix.
  > Confirmed fixed: https://docs.rs/age/0.3.1/age/

- **Issue #72** (2020-02-09): **Store artifacts for interoperability tests**
  *Symptoms*: I encountered [an interoperability failure in `rage -> age`](https://github.com/str4d/rage/pull/71/checks?check_run_id=434669251), but because the actual encrypted age files are not saved, I cannot reproduce the failure. The workflow should save copies of all generated keys and files, so that any failure can be reproduced.

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

### Incident Patch 1: `e956b718` (2026-07-14)
**Commit Message**: age: Fix hang in `impl AsyncBufRead for ArmoredReader` on truncated files

Fixes test failures for the following testkit test files:
- empty (async)

**File**: `age/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -13,6 +13,8 @@ to 1.0.0 are beta releases.
 - `age::armor::ArmoredReader`:
   - It now correctly implements the intended strict parsing profile (initially
     implemented in 0.9.0) by rejecting an empty final line.
+  - The async API now correctly rejects some classes of truncated files that
+    previously would cause it to hang.
 
 ## [0.11.4] - 2026-07-13
 ### Fixed
```

**File**: `age/src/primitives/armor.rs` (modified, +4/-0)
```diff
@@ -1082,6 +1082,10 @@ impl<R: AsyncBufRead + Unpin> AsyncBufRead for ArmoredReader<R> {
                     let mut this = self.as_mut().project();
                     let available = loop {
                         let buf = ready!(this.inner.as_mut().poll_fill_buf(cx))?;
+                        if buf.is_empty() {
+                            // Stream has reached EOF.
+                            return Poll::Ready(Ok(&[]));
+                        }
                         if buf.len() >= MIN_ARMOR_LEN {
                             break buf;
                         }
```

**File**: `age/tests/testkit.rs` (modified, +2/-2)
```diff
@@ -339,7 +339,7 @@ fn testkit_buffered(filename: &str) {
 #[test_case("armor_whitespace_line_start")]
 #[test_case("armor_whitespace_outside")]
 #[test_case("armor_wrong_type")]
-// #[test_case("empty")]
+#[test_case("empty")]
 #[test_case("header_crlf")]
 #[test_case("hmac_bad")]
 #[test_case("hmac_extra_space")]
@@ -489,7 +489,7 @@ async fn testkit_async(filename: &str) {
 #[test_case("armor_whitespace_line_start")]
 #[test_case("armor_whitespace_outside")]
 #[test_case("armor_wrong_type")]
-// #[test_case("empty")]
+#[test_case("empty")]
 #[test_case("header_crlf")]
 #[test_case("hmac_bad")]
 #[test_case("hmac_extra_space")]
```

---

### Incident Patch 2: `22798ae4` (2026-07-13)
**Commit Message**: Fix 1.88 clippy lints

These show up because we run clippy checks against both MSRVs.
Fortunately all of them are for 1.85-valid features.

**File**: `age-core/src/format.rs` (modified, +3/-3)
```diff
@@ -526,7 +526,7 @@ xD7o4VEOu1t7KZQ1gDgq2FPzBEeSRqbnqvQEXdLRYy143BxR6oFxsUUJCRB0ErXA
         // should reject this artifact.
         match read::age_stanza(artifact.as_bytes()) {
             Err(nom::Err::Error(e)) => assert_eq!(e.code, ErrorKind::TakeWhileMN),
-            Err(e) => panic!("Unexpected error: {}", e),
+            Err(e) => panic!("Unexpected error: {e}"),
             Ok((rest, stanza)) => {
                 assert_eq!(rest, b"\n");
                 // This is where the fuzzer triggered a panic.
@@ -563,7 +563,7 @@ dy
         // should reject this artifact.
         match read::age_stanza(artifact.as_bytes()) {
             Err(nom::Err::Error(e)) => assert_eq!(e.code, ErrorKind::TakeWhileMN),
-            Err(e) => panic!("Unexpected error: {}", e),
+            Err(e) => panic!("Unexpected error: {e}"),
             Ok((rest, stanza)) => {
                 assert_eq!(rest, b"\n");
                 // This is where the fuzzer triggered a panic.
@@ -599,7 +599,7 @@ ddd
         // should reject this artifact.
         match read::age_stanza(artifact.as_bytes()) {
             Err(nom::Err::Error(e)) => assert_eq!(e.code, ErrorKind::TakeWhileMN),
-            Err(e) => panic!("Unexpected error: {}", e),
+            Err(e) => panic!("Unexpected error: {e}"),
             Ok((rest, stanza)) => {
                 assert_eq!(rest, b"\n");
                 // This is where the fuzzer triggered a panic.
```

**File**: `age-core/src/plugin.rs` (modified, +4/-4)
```diff
@@ -76,7 +76,7 @@ impl Connection<DebugReader<ChildStdout>, DebugWriter<ChildStdin>> {
         let working_dir = tempfile::tempdir()?;
         let debug_enabled = env::var("AGEDEBUG").map(|s| s == "plugin").unwrap_or(false);
         let process = Command::new(binary.canonicalize()?)
-            .arg(format!("--age-plugin={}", state_machine))
+            .arg(format!("--age-plugin={state_machine}"))
             .current_dir(working_dir.path())
             .stdin(Stdio::piped())
             .stdout(Stdio::piped())
@@ -124,7 +124,7 @@ impl<R: Read, W: Write> Connection<R, W> {
         cookie_factory::gen_simple(write::age_stanza(command, metadata, data), &mut self.output)
             .map_err(|e| match e {
                 GenError::IoError(e) => e,
-                e => io::Error::new(io::ErrorKind::Other, format!("{}", e)),
+                e => io::Error::other(format!("{e}")),
             })
             .and_then(|w| w.flush())
     }
@@ -356,7 +356,7 @@ impl<R: Read, W: Write> BidirSend<'_, R, W> {
             RESPONSE_UNSUPPORTED => Ok(Err(Error::Unsupported)),
             tag => Err(io::Error::new(
                 io::ErrorKind::InvalidData,
-                format!("unexpected response: {}", tag),
+                format!("unexpected response: {tag}"),
             )),
         }
     }
@@ -380,7 +380,7 @@ impl<R: Read, W: Write> BidirSend<'_, R, W> {
             RESPONSE_UNSUPPORTED => Ok(Err(Error::Unsupported)),
             tag => Err(io::Error::new(
                 io::ErrorKind::InvalidData,
-                format!("unexpected response: {}", tag),
+                format!("unexpected response: {tag}"),
             )),
         }
     }
```

**File**: `age-plugin/examples/age-plugin-unencrypted.rs` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ const RECIPIENT_TAG: &str = PLUGIN_NAME;
 fn explode(location: &str) {
     if let Ok(s) = env::var("AGE_EXPLODES") {
         if s == location {
-            panic!("Env variable AGE_EXPLODES={} is set. Boom! 💥", location);
+            panic!("Env variable AGE_EXPLODES={location} is set. Boom! 💥");
         }
     }
 }
```

**File**: `age-plugin/src/identity.rs` (modified, +5/-9)
```diff
@@ -227,8 +227,7 @@ pub(crate) fn run_v1<P: IdentityPluginV1>(mut plugin: P) -> io::Result<()> {
                 ([identity], []) => Ok(identity.clone()),
                 _ => Err(Error::Internal {
                     message: format!(
-                        "{} command must have exactly one metadata argument and no data",
-                        ADD_IDENTITY
+                        "{ADD_IDENTITY} command must have exactly one metadata argument and no data"
                     ),
                 }),
             }),
@@ -241,15 +240,13 @@ pub(crate) fn run_v1<P: IdentityPluginV1>(mut plugin: P) -> io::Result<()> {
                         .map(|i| (i, s))
                         .map_err(|_| Error::Internal {
                             message: format!(
-                                "first metadata argument to {} must be an integer",
-                                RECIPIENT_STANZA
+                                "first metadata argument to {RECIPIENT_STANZA} must be an integer"
                             ),
                         })
                 } else {
                     Err(Error::Internal {
                         message: format!(
-                            "{} command must have at least two metadata arguments",
-                            RECIPIENT_STANZA
+                            "{RECIPIENT_STANZA} command must have at least two metadata arguments"
                         ),
                     })
                 }
@@ -313,8 +310,7 @@ pub(crate) fn run_v1<P: IdentityPluginV1>(mut plugin: P) -> io::Result<()> {
                 } else {
                     errors.push(Error::Internal {
                         message: format!(
-                            "{} file indices are not ordered and monotonically increasing",
-                            RECIPIENT_STANZA
+                            "{RECIPIENT_STANZA} file indices are not ordered and monotonically increasing"
                         ),
                     });
                 }
@@ -355,7 +351,7 @@ pub(crate) fn run_v1<P: IdentityPluginV1>(mut plugin: P) -> io::Result<()> {
                     phase
                         .send(
                             "file-key",
-                            &[&format!("{}", file_index)],
+                            &[&format!("{file_index}")],
                             file_key.expose_secret(),
                         )?
                         .unwrap();
```

**File**: `age-plugin/src/lib.rs` (modified, +2/-2)
```diff
@@ -197,7 +197,7 @@ const PLUGIN_IDENTITY_PREFIX: &str = "AGE-PLUGIN-";
 /// A "created" time is included in the output, set to the current local time.
 pub fn print_new_identity(plugin_name: &str, identity: &[u8], recipient: &[u8]) {
     let mut identity_lower = bech32_encode(
-        Hrp::parse_unchecked(&format!("{}{}-", PLUGIN_IDENTITY_PREFIX, plugin_name)),
+        Hrp::parse_unchecked(&format!("{PLUGIN_IDENTITY_PREFIX}{plugin_name}-")),
         identity,
     );
 
@@ -208,7 +208,7 @@ pub fn print_new_identity(plugin_name: &str, identity: &[u8], recipient: &[u8])
     println!(
         "# recipient: {}",
         bech32_encode(
-            Hrp::parse_unchecked(&format!("{}{}", PLUGIN_RECIPIENT_PREFIX, plugin_name)),
+            Hrp::parse_unchecked(&format!("{PLUGIN_RECIPIENT_PREFIX}{plugin_name}")),
             recipient,
         )
     );
```

**File**: `age-plugin/src/recipient.rs` (modified, +5/-8)
```diff
@@ -269,17 +269,15 @@ pub(crate) fn run_v1<P: RecipientPluginV1>(mut plugin: P) -> io::Result<()> {
                 ([recipient], []) => Ok(recipient.clone()),
                 _ => Err(Error::Internal {
                     message: format!(
-                        "{} command must have exactly one metadata argument and no data",
-                        ADD_RECIPIENT
+                        "{ADD_RECIPIENT} command must have exactly one metadata argument and no data"
                     ),
                 }),
             }),
             (ADD_IDENTITY, |s| match (&s.args[..], &s.body[..]) {
                 ([identity], []) => Ok(identity.clone()),
                 _ => Err(Error::Internal {
                     message: format!(
-                        "{} command must have exactly one metadata argument and no data",
-                        ADD_IDENTITY
+                        "{ADD_IDENTITY} command must have exactly one metadata argument and no data"
                     ),
                 }),
             }),
@@ -303,8 +301,7 @@ pub(crate) fn run_v1<P: RecipientPluginV1>(mut plugin: P) -> io::Result<()> {
                 (Ok(r), Ok(i)) if r.is_empty() && i.is_empty() => (
                     Err(vec![Error::Internal {
                         message: format!(
-                            "Need at least one {} or {} command",
-                            ADD_RECIPIENT, ADD_IDENTITY
+                            "Need at least one {ADD_RECIPIENT} or {ADD_IDENTITY} command"
                         ),
                     }]),
                     Err(vec![]),
@@ -313,15 +310,15 @@ pub(crate) fn run_v1<P: RecipientPluginV1>(mut plugin: P) -> io::Result<()> {
             },
             match file_keys.unwrap() {
                 Ok(f) if f.is_empty() => Err(vec![Error::Internal {
-                    message: format!("Need at least one {} command", WRAP_FILE_KEY),
+                    message: format!("Need at least one {WRAP_FILE_KEY} command"),
                 }]),
                 r => r,
             },
             match &labels_supported.unwrap() {
                 Ok(v) if v.is_empty() => Ok(false),
                 Ok(v) if v.len() == 1 => Ok(true),
                 _ => Err(vec![Error::Internal {
-                    message: format!("Received more than one {} command", EXTENSION_LABELS),
+                    message: format!("Received more than one {EXTENSION_LABELS} command"),
                 }]),
             },
         )
```

**File**: `age/src/cli_common.rs` (modified, +4/-4)
```diff
@@ -67,7 +67,7 @@ fn confirm(query: &str, ok: &str, cancel: Option<&str>) -> pinentry::Result<bool
     } else {
         // Fall back to CLI interface.
         let term = console::Term::stderr();
-        let initial = format!("{}: (y/n) ", query);
+        let initial = format!("{query}: (y/n) ");
         loop {
             term.write_str(&initial)?;
             let response = term.read_line()?.to_lowercase();
@@ -126,10 +126,10 @@ pub fn read_secret(
         input.interact()
     } else {
         // Fall back to CLI interface.
-        let passphrase = prompt_password(format!("{}: ", description)).map(SecretString::from)?;
+        let passphrase = prompt_password(format!("{description}: ")).map(SecretString::from)?;
         if let Some(confirm_prompt) = confirm {
             let confirm_passphrase =
-                prompt_password(format!("{}: ", confirm_prompt)).map(SecretString::from)?;
+                prompt_password(format!("{confirm_prompt}: ")).map(SecretString::from)?;
 
             if !bool::from(
                 passphrase
@@ -156,7 +156,7 @@ pub struct UiCallbacks;
 
 impl Callbacks for UiCallbacks {
     fn display_message(&self, message: &str) {
-        eprintln!("{}", message);
+        eprintln!("{message}");
     }
 
     fn confirm(&self, message: &str, yes_string: &str, no_string: Option<&str>) -> Option<bool> {
```

**File**: `age/src/cli_common/error.rs` (modified, +2/-2)
```diff
@@ -83,15 +83,15 @@ impl fmt::Display for ReadError {
                 filename = filename.as_str(),
                 line_number = line_number,
             ),
-            ReadError::Io(e) => write!(f, "{}", e),
+            ReadError::Io(e) => write!(f, "{e}"),
             ReadError::MissingRecipientsFile(filename) => wfl!(
                 f,
                 "err-read-missing-recipients-file",
                 filename = filename.as_str(),
             ),
             ReadError::MultipleStdin => wfl!(f, "err-read-multiple-stdin"),
             #[cfg(feature = "plugin")]
-            ReadError::PluginResolve(e) => write!(f, "{}", e),
+            ReadError::PluginResolve(e) => write!(f, "{e}"),
             #[cfg(feature = "ssh")]
             ReadError::RsaModulusTooLarge => {
                 wfl!(f, "err-read-rsa-modulus-too-large", max_size = 4096)
```

---

### Incident Patch 3: `46acef32` (2026-07-12)
**Commit Message**: Merge pull request #620 from holtrop/fix-italian-language-unit-tests

Fix Italian language unit tests

**File**: `rage/tests/unix_not_apple_android/rage-keygen/help_it.toml` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 bin.name = "rage-keygen"
 args = "--help"
+env.add.LANGUAGE = "it"
 env.add.LC_ALL = "it"
 stdout = """
 Utilizzo: rage-keygen[EXE] [OPTIONS] [INPUT]
```

**File**: `rage/tests/unix_not_apple_android/rage-mount/help_it.toml` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 bin.name = "rage-mount"
 args = "--help"
+env.add.LANGUAGE = "it"
 env.add.LC_ALL = "it"
 stdout = """
 Utilizzo: rage-mount[EXE] [OPTIONS] --types <TIPI> <PERCORSO> <MOUNTPOINT>
```

**File**: `rage/tests/unix_not_apple_android/rage/help_it.toml` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 bin.name = "rage"
 args = "--help"
+env.add.LANGUAGE = "it"
 env.add.LC_ALL = "it"
 stdout = """
 Utilizzo: rage[EXE] [--encrypt] (-r DESTINATARIO | -R PERCORSO)... [-i IDENTITÀ] [-a] [-o OUTPUT] [INPUT]
```

---

### Incident Patch 4: `bf62d259` (2026-05-11)
**Commit Message**: Fix Italian language unit tests

**File**: `rage/tests/unix_not_apple_android/rage-keygen/help_it.toml` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 bin.name = "rage-keygen"
 args = "--help"
+env.add.LANGUAGE = "it"
 env.add.LC_ALL = "it"
 stdout = """
 Utilizzo: rage-keygen[EXE] [OPTIONS] [INPUT]
```

**File**: `rage/tests/unix_not_apple_android/rage-mount/help_it.toml` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 bin.name = "rage-mount"
 args = "--help"
+env.add.LANGUAGE = "it"
 env.add.LC_ALL = "it"
 stdout = """
 Utilizzo: rage-mount[EXE] [OPTIONS] --types <TIPI> <PERCORSO> <MOUNTPOINT>
```

**File**: `rage/tests/unix_not_apple_android/rage/help_it.toml` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 bin.name = "rage"
 args = "--help"
+env.add.LANGUAGE = "it"
 env.add.LC_ALL = "it"
 stdout = """
 Utilizzo: rage[EXE] [--encrypt] (-r DESTINATARIO | -R PERCORSO)... [-i IDENTITÀ] [-a] [-o OUTPUT] [INPUT]
```

---

### Incident Patch 5: `cd2e00d4` (2026-04-21)
**Commit Message**: age: Replace file-key panics with errors in `plugin::IdentityPluginV1`

**File**: `age/CHANGELOG.md` (modified, +6/-2)
```diff
@@ -10,8 +10,12 @@ to 1.0.0 are beta releases.
 
 ## [Unreleased]
 ### Fixed
-- `age::plugin::{RecipientPluginV1, IdentityPluginV1}` no longer panic when a
-  plugin sends an unusually-formatted error in phase 2.
+- `age::plugin`:
+  - `{RecipientPluginV1, IdentityPluginV1}` no longer panic when a plugin sends
+    an unusually-formatted error in phase 2.
+  - `IdentityPluginV1` no longer panics when a plugin violates the specification
+    and returns a file key for a file index that was not provided, or sends more
+    than one file key per file index.
 - `age::ssh::EncryptedKey::decrypt` now returns an error instead of panicking
   when given an empty passphrase.
 - `age::stream::StreamReader` no longer panics in debug mode when seeking on a
```

**File**: `age/src/plugin.rs` (modified, +14/-12)
```diff
@@ -700,18 +700,20 @@ impl<C: Callbacks> IdentityPluginV1<C> {
                     }
                 }
                 CMD_FILE_KEY => {
-                    // We only support a single file.
-                    assert!(command.args[0] == "0");
-                    assert!(file_key.is_none());
-                    file_key = Some(FileKey::try_init_with_mut(|file_key| {
-                        if command.body.len() == file_key.len() {
-                            file_key.copy_from_slice(&command.body);
-                            Ok(())
-                        } else {
-                            Err(DecryptError::DecryptionFailed)
-                        }
-                    }));
-                    reply.ok(None)
+                    // We only requested one file key be unwrapped.
+                    if command.args.len() == 1 && command.args[0] == "0" && file_key.is_none() {
+                        file_key = Some(FileKey::try_init_with_mut(|file_key| {
+                            if command.body.len() == file_key.len() {
+                                file_key.copy_from_slice(&command.body);
+                                Ok(())
+                            } else {
+                                Err(DecryptError::DecryptionFailed)
+                            }
+                        }));
+                        reply.ok(None)
+                    } else {
+                        reply.fail()
+                    }
                 }
                 CMD_ERROR => {
                     if command.args.len() == 2 && command.args[0] == "identity" {
```

---

### Incident Patch 6: `fc4164ff` (2026-04-21)
**Commit Message**: age: Fix panics on weird error formats in plugin responses

**File**: `age/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -10,6 +10,8 @@ to 1.0.0 are beta releases.
 
 ## [Unreleased]
 ### Fixed
+- `age::plugin::{RecipientPluginV1, IdentityPluginV1}` no longer panic when a
+  plugin sends an unusually-formatted error in phase 2.
 - `age::ssh::EncryptedKey::decrypt` now returns an error instead of panicking
   when given an empty passphrase.
 - `age::stream::StreamReader` no longer panics in debug mode when seeking on a
```

**File**: `age/src/error.rs` (modified, +9/-2)
```diff
@@ -9,6 +9,9 @@ use crate::{wfl, wlnfl};
 #[cfg(feature = "plugin")]
 use age_core::format::Stanza;
 
+#[cfg(feature = "plugin")]
+use crate::plugin::CMD_ERROR;
+
 /// Errors returned when converting an identity file to a recipients file.
 #[derive(Debug)]
 pub enum IdentityFileConvertError {
@@ -110,8 +113,12 @@ pub enum PluginError {
 #[cfg(feature = "plugin")]
 impl From<Stanza> for PluginError {
     fn from(mut s: Stanza) -> Self {
-        assert!(s.tag == "error");
-        let kind = s.args.remove(0);
+        assert_eq!(s.tag, CMD_ERROR);
+        let kind = if s.args.is_empty() {
+            "unknown".into()
+        } else {
+            s.args.remove(0)
+        };
         PluginError::Other {
             kind,
             metadata: s.args,
```

**File**: `age/src/plugin.rs` (modified, +38/-17)
```diff
@@ -31,7 +31,7 @@ use crate::{
 const PLUGIN_RECIPIENT_PREFIX: &str = "age1";
 const PLUGIN_IDENTITY_PREFIX: &str = "age-plugin-";
 
-const CMD_ERROR: &str = "error";
+pub(crate) const CMD_ERROR: &str = "error";
 const CMD_RECIPIENT_STANZA: &str = "recipient-stanza";
 const CMD_LABELS: &str = "labels";
 const CMD_MSG: &str = "msg";
@@ -531,18 +531,32 @@ impl<C: Callbacks> crate::Recipient for RecipientPluginV1<C> {
                 }
                 CMD_ERROR => {
                     if command.args.len() == 2 && command.args[0] == "recipient" {
-                        let index: usize = command.args[1].parse().unwrap();
-                        errors.push(PluginError::Recipient {
-                            binary_name: binary_name(&self.recipients[index].name),
-                            recipient: self.recipients[index].recipient.clone(),
-                            message: String::from_utf8_lossy(&command.body).to_string(),
-                        });
+                        if let Some(r) = command.args[1]
+                            .parse()
+                            .ok()
+                            .and_then(|index: usize| self.recipients.get(index))
+                        {
+                            errors.push(PluginError::Recipient {
+                                binary_name: binary_name(&r.name),
+                                recipient: r.recipient.clone(),
+                                message: String::from_utf8_lossy(&command.body).to_string(),
+                            });
+                        } else {
+                            errors.push(PluginError::from(command));
+                        }
                     } else if command.args.len() == 2 && command.args[0] == "identity" {
-                        let index: usize = command.args[1].parse().unwrap();
-                        errors.push(PluginError::Identity {
-                            binary_name: binary_name(&self.identities[index].name),
-                            message: String::from_utf8_lossy(&command.body).to_string(),
-                        });
+                        if let Some(identity) = command.args[1]
+                            .parse()
+                            .ok()
+                            .and_then(|index: usize| self.identities.get(index))
+                        {
+                            errors.push(PluginError::Identity {
+                                binary_name: binary_name(&identity.name),
+                                message: String::from_utf8_lossy(&command.body).to_string(),
+                            });
+                        } else {
+                            errors.push(PluginError::from(command));
+                        }
                     } else {
                         errors.push(PluginError::from(command));
                     }
@@ -701,11 +715,18 @@ impl<C: Callbacks> IdentityPluginV1<C> {
                 }
                 CMD_ERROR => {
                     if command.args.len() == 2 && command.args[0] == "identity" {
-                        let index: usize = command.args[1].parse().unwrap();
-                        errors.push(PluginError::Identity {
-                            binary_name: binary_name(&self.identities[index].name),
-                            message: String::from_utf8_lossy(&command.body).to_string(),
-                        });
+                        if let Some(identity) = command.args[1]
+                            .parse()
+                            .ok()
+                            .and_then(|index: usize| self.identities.get(index))
+                        {
+                            errors.push(PluginError::Identity {
+                                binary_name: binary_name(&identity.name),
+                                message: String::from_utf8_lossy(&command.body).to_string(),
+                            });
+                        } else {
+                            errors.push(PluginError::from(command));
+                        }
                     } else {
                         errors.push(PluginError::from(command));
                     }
```

---

### Incident Patch 7: `4e6ce24e` (2026-04-21)
**Commit Message**: age: Document security implication of `scrypt::Identity::set_max_work_factor`

**File**: `age/src/scrypt.rs` (modified, +7/-0)
```diff
@@ -200,6 +200,13 @@ impl Identity {
     ///
     /// This method must be called before [`Self::unwrap_stanza`] to have an effect.
     ///
+    /// # Security
+    ///
+    /// This sets the bounds on CPU/memory cost. Large values (e.g. > 22) can allow
+    /// attempted decryption of a malicious file that takes hours and tens of GiB of RAM.
+    /// When setting this value in your application, take care to limit it appropriately
+    /// and avoid Denial-of-Service issues.
+    ///
     /// [`Self::unwrap_stanza`]: crate::Identity::unwrap_stanza
     pub fn set_max_work_factor(&mut self, max_log_n: u8) {
         self.max_work_factor = max_log_n;
```

---

### Incident Patch 8: `582247db` (2026-04-21)
**Commit Message**: age: Fix panic in debug mode on truncated ciphertext

In release mode the underflow resulted in a seek beyond the end of the
truncated ciphertext, which is valid and results in a zero-length read
during last-chunk validation (resulting in the intended error).

**File**: `age/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@ to 1.0.0 are beta releases.
 ### Fixed
 - `age::ssh::EncryptedKey::decrypt` now returns an error instead of panicking
   when given an empty passphrase.
+- `age::stream::StreamReader` no longer panics in debug mode when seeking on a
+  ciphertext truncated to just after the nonce (i.e. with zero chunk data).
 
 ## [0.11.2] - 2025-12-07
 ### Fixed
```

**File**: `age/src/primitives/stream.rs` (modified, +50/-3)
```diff
@@ -565,13 +565,22 @@ impl<R: Read + Seek> StreamReader<R> {
                 let num_chunks =
                     (ct_len + (ENCRYPTED_CHUNK_SIZE as u64 - 1)) / ENCRYPTED_CHUNK_SIZE as u64;
 
+                // If we have no ciphertext data then there is no last chunk, which is
+                // invalid.
+                let non_last_chunks = num_chunks.checked_sub(1).ok_or_else(|| {
+                    io::Error::new(
+                        io::ErrorKind::InvalidData,
+                        "Last chunk is invalid, stream might be truncated",
+                    )
+                })?;
+
                 // Authenticate the ciphertext length by checking that we can successfully
                 // decrypt the last chunk _as_ a last chunk.
-                let last_chunk_start = ct_start + ((num_chunks - 1) * ENCRYPTED_CHUNK_SIZE as u64);
+                let last_chunk_start = ct_start + (non_last_chunks * ENCRYPTED_CHUNK_SIZE as u64);
                 let mut last_chunk = Vec::with_capacity((ct_end - last_chunk_start) as usize);
                 self.inner.seek(SeekFrom::Start(last_chunk_start))?;
                 self.inner.read_to_end(&mut last_chunk)?;
-                self.stream.nonce.set_counter(num_chunks - 1);
+                self.stream.nonce.set_counter(non_last_chunks);
                 self.stream.decrypt_chunk(&last_chunk, true).map_err(|_| {
                     io::Error::new(
                         io::ErrorKind::InvalidData,
@@ -679,7 +688,7 @@ mod tests {
     use age_core::secrecy::ExposeSecret;
     use std::io::{self, Cursor, Read, Seek, SeekFrom, Write};
 
-    use super::{PayloadKey, Stream, CHUNK_SIZE};
+    use super::{PayloadKey, Stream, CHUNK_SIZE, TAG_SIZE};
 
     #[cfg(feature = "async")]
     use futures::{
@@ -1019,6 +1028,44 @@ mod tests {
         }
     }
 
+    #[test]
+    fn seek_from_end_with_empty_fails_on_truncation() {
+        // The empty plaintext means we should encrypt to a single chunk.
+        let plaintext: Vec<u8> = b"".to_vec();
+
+        // Encrypt the plaintext just like the example code in the docs.
+        let mut encrypted = vec![];
+        {
+            let mut w = Stream::encrypt(PayloadKey([7; 32].into()), &mut encrypted);
+            w.write_all(&plaintext).unwrap();
+            w.finish().unwrap();
+        };
+        assert_eq!(encrypted.len(), TAG_SIZE);
+
+        // Every truncated length should result in an error.
+        for i in 0..TAG_SIZE {
+            let truncated_ciphertext = &encrypted[..i];
+            let mut truncated_reader = Stream::decrypt(
+                PayloadKey([7; 32].into()),
+                Cursor::new(truncated_ciphertext),
+            );
+            match truncated_reader.seek(SeekFrom::End(0)) {
+                Err(e) => {
+                    assert_eq!(e.kind(), io::ErrorKind::InvalidData);
+                    assert_eq!(
+                        &e.to_string(),
+                        "Last chunk is invalid, stream might be truncated",
+                    );
+                }
+                Ok(_) => panic!("This is a security issue."),
+            }
+        }
+
+        // Decrypting without truncation should show an empty file.
+        let mut reader = Stream::decrypt(PayloadKey([7; 32].into()), Cursor::new(encrypted));
+        assert_eq!(reader.len().unwrap(), 0);
+    }
+
     #[test]
     fn seek_from_end_with_exact_chunk() {
         let plaintext: Vec<u8> = vec![42; 65536];
```

---

### Incident Patch 9: `1ff02de7` (2026-04-21)
**Commit Message**: age: Return error instead of panicking on empty passphrase

**File**: `age/CHANGELOG.md` (modified, +3/-0)
```diff
@@ -9,6 +9,9 @@ and this project adheres to Rust's notion of
 to 1.0.0 are beta releases.
 
 ## [Unreleased]
+### Fixed
+- `age::ssh::EncryptedKey::decrypt` now returns an error instead of panicking
+  when given an empty passphrase.
 
 ## [0.11.2] - 2025-12-07
 ### Fixed
```

**File**: `age/src/ssh.rs` (modified, +27/-18)
```diff
@@ -76,9 +76,9 @@ impl OpenSshCipher {
     ) -> Result<Vec<u8>, DecryptError> {
         match self {
             OpenSshCipher::Aes256Cbc => decrypt::aes_cbc::<Aes256CbcDec>(kdf, p, ct),
-            OpenSshCipher::Aes128Ctr => Ok(decrypt::aes_ctr::<Aes128Ctr>(kdf, p, ct)),
-            OpenSshCipher::Aes192Ctr => Ok(decrypt::aes_ctr::<Aes192Ctr>(kdf, p, ct)),
-            OpenSshCipher::Aes256Ctr => Ok(decrypt::aes_ctr::<Aes256Ctr>(kdf, p, ct)),
+            OpenSshCipher::Aes128Ctr => decrypt::aes_ctr::<Aes128Ctr>(kdf, p, ct),
+            OpenSshCipher::Aes192Ctr => decrypt::aes_ctr::<Aes192Ctr>(kdf, p, ct),
+            OpenSshCipher::Aes256Ctr => decrypt::aes_ctr::<Aes256Ctr>(kdf, p, ct),
             OpenSshCipher::Aes256Gcm => decrypt::aes_gcm::<Aes256Gcm>(kdf, p, ct),
         }
     }
@@ -91,13 +91,15 @@ enum OpenSshKdf {
 }
 
 impl OpenSshKdf {
-    fn derive(&self, passphrase: SecretString, out_len: usize) -> Vec<u8> {
+    fn derive(&self, passphrase: SecretString, out_len: usize) -> Option<Vec<u8>> {
         match self {
             OpenSshKdf::Bcrypt { salt, rounds } => {
                 let mut output = vec![0; out_len];
                 bcrypt_pbkdf(passphrase.expose_secret(), salt, *rounds, &mut output)
-                    .expect("parameters are valid");
-                output
+                    // The only error that can occur is if `passphrase` is empty. All
+                    // other errors are prevented by construction.
+                    .ok()
+                    .map(|()| output)
             }
         }
     }
@@ -147,21 +149,26 @@ mod decrypt {
     fn derive_key_material<KeySize: ArrayLength<u8>, IvSize: ArrayLength<u8>>(
         kdf: &OpenSshKdf,
         passphrase: SecretString,
-    ) -> (GenericArray<u8, KeySize>, GenericArray<u8, IvSize>) {
-        let kdf_output = kdf.derive(passphrase, KeySize::USIZE + IvSize::USIZE);
-        let (key, iv) = kdf_output.split_at(KeySize::USIZE);
-        (
-            GenericArray::from_exact_iter(key.iter().copied()).expect("key is correct length"),
-            GenericArray::from_exact_iter(iv.iter().copied()).expect("iv is correct length"),
-        )
+    ) -> Option<(GenericArray<u8, KeySize>, GenericArray<u8, IvSize>)> {
+        kdf.derive(passphrase, KeySize::USIZE + IvSize::USIZE)
+            .map(|kdf_output| {
+                let (key, iv) = kdf_output.split_at(KeySize::USIZE);
+                (
+                    GenericArray::from_exact_iter(key.iter().copied())
+                        .expect("key is correct length"),
+                    GenericArray::from_exact_iter(iv.iter().copied())
+                        .expect("iv is correct length"),
+                )
+            })
     }
 
     pub(super) fn aes_cbc<C: BlockDecryptMut + KeyIvInit>(
         kdf: &OpenSshKdf,
         passphrase: SecretString,
         ciphertext: &[u8],
     ) -> Result<Vec<u8>, DecryptError> {
-        let (key, iv) = derive_key_material::<C::KeySize, C::IvSize>(kdf, passphrase);
+        let (key, iv) = derive_key_material::<C::KeySize, C::IvSize>(kdf, passphrase)
+            .ok_or(DecryptError::KeyDecryptionFailed)?;
         let cipher = C::new(&key, &iv);
         cipher
             .decrypt_padded_vec_mut::<NoPadding>(ciphertext)
@@ -172,20 +179,22 @@ mod decrypt {
         kdf: &OpenSshKdf,
         passphrase: SecretString,
         ciphertext: &[u8],
-    ) -> Vec<u8> {
-        let (key, iv) = derive_key_material::<C::KeySize, C::IvSize>(kdf, passphrase);
+    ) -> Result<Vec<u8>, DecryptError> {
+        let (key, iv) = derive_key_material::<C::KeySize, C::IvSize>(kdf, passphrase)
+            .ok_or(DecryptError::KeyDecryptionFailed)?;
         let mut cipher = C::new(&key, &iv);
         let mut plaintext = ciphertext.to_vec();
         cipher.apply_keystream(&mut plaintext);
-        plaintext
+        Ok(plaintext)
     }
 
     pub(super) fn aes_gcm<C: AeadMut + KeyInit>(
         kdf: &OpenSshKdf,
         passphrase: SecretString,
         ciphertext: &[u8],
     ) -> Result<Vec<u8>, DecryptError> {
-        let (key, nonce) = derive_key_material::<C::KeySize, C::NonceSize>(kdf, passphrase);
+        let (key, nonce) = derive_key_material::<C::KeySize, C::NonceSize>(kdf, passphrase)
+            .ok_or(DecryptError::KeyDecryptionFailed)?;
         let mut cipher = C::new(&key);
         cipher
             .decrypt(&nonce, ciphertext)
```

---

### Incident Patch 10: `5e530a3a` (2026-04-07)
**Commit Message**: Merge pull request #609 from str4d/fix-plugins

Fix plugin Bech32 decoding bugs

**File**: `.github/workflows/interop.yml` (modified, +23/-9)
```diff
@@ -20,12 +20,15 @@ jobs:
       - name: cargo build
         run: cargo build --release --features unstable
         working-directory: ./rage
+      - name: Build the dummy plugin
+        run: cargo build --release --example age-plugin-unencrypted
       - uses: actions/upload-artifact@v4
         with:
           name: rage
           path: |
             target/release/rage
             target/release/rage-keygen
+            target/release/examples/age-plugin-unencrypted
 
       - name: Update FiloSottile/age status with result
         if: always() && github.event.action == 'age-interop-request'
@@ -95,7 +98,7 @@ jobs:
       matrix:
         alice: [rage, age]
         bob: [rage, age]
-        recipient: [x25519, ssh-rsa, ssh-ed25519]
+        recipient: [x25519, ssh-rsa, ssh-ed25519, plugin]
       fail-fast: false
 
     steps:
@@ -119,18 +122,23 @@ jobs:
       - run: chmod +x age
       - run: chmod +x age-keygen
 
+      # Prepare the plugin environment
+      - name: Prepare the plugin environment
+        if: matrix.recipient == 'plugin'
+        run: |
+          chmod +x ./examples/age-plugin-unencrypted
+          mkdir -p ~/.local/bin
+          mv ./examples/age-plugin-unencrypted ~/.local/bin
+
       # Prepare the test environment
       - name: Install dos2unix for simulating Windows files
         run: sudo apt update && sudo apt install dos2unix
-      - name: Write (very not private) age X25519 key
-        if: matrix.recipient == 'x25519'
-        run: echo "AGE-SECRET-KEY-1TRYTV7PQS5XPUYSTAQZCD7DQCWC7Q77YJD7UVFJRMW4J82Q6930QS70MRX" >key.txt
-      - name: Save the corresponding age x25519 recipient
+      - name: Set up the X25519 identity and recipient
         if: matrix.recipient == 'x25519'
-        run: echo "age1y8m84r6pwd4da5d45zzk03rlgv2xr7fn9px80suw3psrahul44ashl0usm" >key.txt.pub
-      - name: Set the corresponding age x25519 recipient
-        if: matrix.recipient == 'x25519'
-        run: echo "AGE_PUBKEY=-r age1y8m84r6pwd4da5d45zzk03rlgv2xr7fn9px80suw3psrahul44ashl0usm" >> $GITHUB_ENV
+        run: |
+          echo "AGE-SECRET-KEY-1TRYTV7PQS5XPUYSTAQZCD7DQCWC7Q77YJD7UVFJRMW4J82Q6930QS70MRX" >key.txt
+          echo "age1y8m84r6pwd4da5d45zzk03rlgv2xr7fn9px80suw3psrahul44ashl0usm" >key.txt.pub
+          echo "AGE_PUBKEY=-r age1y8m84r6pwd4da5d45zzk03rlgv2xr7fn9px80suw3psrahul44ashl0usm" >> $GITHUB_ENV
       - name: Generate an ssh-rsa key
         if: matrix.recipient == 'ssh-rsa'
         run: ssh-keygen -t rsa -N "" -f key.txt
@@ -140,6 +148,12 @@ jobs:
       - name: Set the corresponding SSH recipient
         if: matrix.recipient == 'ssh-rsa' || matrix.recipient == 'ssh-ed25519'
         run: echo "AGE_PUBKEY=-R key.txt.pub" >> $GITHUB_ENV
+      - name: Set up the plugin identity and recipient
+        if: matrix.recipient == 'plugin'
+        run: |
+          age-plugin-unencrypted >key.txt
+          echo "age1unencrypted1k5fr0r" >key.txt.pub
+          echo "AGE_PUBKEY=-r age1unencrypted1k5fr0r" >> $GITHUB_ENV
       - name: Store key.txt in case we need it
         uses: actions/upload-artifact@v4
         with:
```

**File**: `age-plugin/src/identity.rs` (modified, +14/-10)
```diff
@@ -267,25 +267,29 @@ pub(crate) fn run_v1<P: IdentityPluginV1>(mut plugin: P) -> io::Result<()> {
                 .map(|(index, item)| {
                     bech32_decode(
                         &item,
-                        |_| (),
+                        |_| "invalid Bech32 encoding",
                         |hrp| {
-                            (hrp.as_str().starts_with(PLUGIN_IDENTITY_PREFIX)
+                            (hrp.len() > PLUGIN_IDENTITY_PREFIX.len()
+                                && hrp.as_str().starts_with(PLUGIN_IDENTITY_PREFIX)
                                 && hrp.as_str().ends_with('-'))
                             .then_some(())
-                            .ok_or(())
+                            .ok_or("invalid HRP")
                         },
                         |hrp, bytes| Ok((hrp, bytes.collect::<Vec<_>>())),
                     )
-                    .map_err(|()| Error::Identity {
+                    .map_err(|message| Error::Identity {
                         index,
-                        message: "Invalid identity encoding".to_owned(),
+                        message: message.to_owned(),
                     })
                     .and_then(|(hrp, bytes)| {
-                        plugin.add_identity(
-                            index,
-                            &hrp.as_str()[PLUGIN_IDENTITY_PREFIX.len()..hrp.len() - 1],
-                            &bytes,
-                        )
+                        // TODO: Decide whether to allow plugin names to end in -
+                        let name = hrp
+                            .as_str()
+                            .split_at(PLUGIN_IDENTITY_PREFIX.len())
+                            .1
+                            .trim_end_matches('-')
+                            .to_lowercase();
+                        plugin.add_identity(index, &name, &bytes)
                     })
                 })
                 .filter_map(|res| res.err())
```

**File**: `age-plugin/src/lib.rs` (modified, +1/-1)
```diff
@@ -190,7 +190,7 @@ pub mod recipient;
 
 // Plugin HRPs are age1[name] and AGE-PLUGIN-[NAME]-
 const PLUGIN_RECIPIENT_PREFIX: &str = "age1";
-const PLUGIN_IDENTITY_PREFIX: &str = "age-plugin-";
+const PLUGIN_IDENTITY_PREFIX: &str = "AGE-PLUGIN-";
 
 /// Prints the newly-created identity and corresponding recipient to standard out.
 ///
```

**File**: `age-plugin/src/recipient.rs` (modified, +17/-5)
```diff
@@ -331,7 +331,7 @@ pub(crate) fn run_v1<P: RecipientPluginV1>(mut plugin: P) -> io::Result<()> {
     // and add them to the plugin.
     fn parse_and_add(
         items: Result<Vec<String>, Vec<Error>>,
-        plugin_name: impl Fn(&str) -> Option<&str>,
+        plugin_name: impl Fn(&str) -> Option<String>,
         error: impl Fn(usize) -> Error,
         mut adder: impl FnMut(usize, &str, Vec<u8>) -> Result<(), Error>,
     ) -> Result<usize, Vec<Error>> {
@@ -347,7 +347,7 @@ pub(crate) fn run_v1<P: RecipientPluginV1>(mut plugin: P) -> io::Result<()> {
                         |_| Ok(()),
                         |hrp, bytes| {
                             plugin_name(hrp.as_str())
-                                .map(|plugin_name| (plugin_name.to_string(), bytes.collect()))
+                                .map(|plugin_name| (plugin_name, bytes.collect()))
                                 .ok_or(())
                         },
                     )
@@ -366,7 +366,10 @@ pub(crate) fn run_v1<P: RecipientPluginV1>(mut plugin: P) -> io::Result<()> {
     }
     let recipients = parse_and_add(
         recipients,
-        |hrp| hrp.strip_prefix(PLUGIN_RECIPIENT_PREFIX),
+        |hrp| {
+            hrp.strip_prefix(PLUGIN_RECIPIENT_PREFIX)
+                .map(|s| s.to_owned())
+        },
         |index| Error::Recipient {
             index,
             message: "Invalid recipient encoding".to_owned(),
@@ -376,8 +379,17 @@ pub(crate) fn run_v1<P: RecipientPluginV1>(mut plugin: P) -> io::Result<()> {
     let identities = parse_and_add(
         identities,
         |hrp| {
-            if hrp.starts_with(PLUGIN_IDENTITY_PREFIX) && hrp.ends_with('-') {
-                Some(&hrp[PLUGIN_IDENTITY_PREFIX.len()..hrp.len() - 1])
+            if hrp.len() > PLUGIN_IDENTITY_PREFIX.len()
+                && hrp.starts_with(PLUGIN_IDENTITY_PREFIX)
+                && hrp.ends_with('-')
+            {
+                // TODO: Decide whether to allow plugin names to end in -
+                let name = hrp
+                    .split_at(PLUGIN_IDENTITY_PREFIX.len())
+                    .1
+                    .trim_end_matches('-')
+                    .to_lowercase();
+                Some(name)
             } else {
                 None
             }
```

**File**: `age/src/plugin.rs` (modified, +3/-2)
```diff
@@ -165,7 +165,8 @@ impl std::str::FromStr for Identity {
             |_| "invalid Bech32 encoding",
             |hrp| {
                 (hrp.len() > PLUGIN_IDENTITY_PREFIX.len()
-                    && hrp.as_str().starts_with(PLUGIN_IDENTITY_PREFIX))
+                    && hrp.as_str().starts_with(PLUGIN_IDENTITY_PREFIX)
+                    && hrp.as_str().ends_with('-'))
                 .then_some(())
                 .ok_or("invalid HRP")
             },
@@ -176,7 +177,7 @@ impl std::str::FromStr for Identity {
                     .split_at(PLUGIN_IDENTITY_PREFIX.len())
                     .1
                     .trim_end_matches('-')
-                    .to_owned();
+                    .to_lowercase();
                 if valid_plugin_name(&name) {
                     Ok(Identity {
                         name,
```

---

### Incident Patch 11: `98f395d4` (2026-04-07)
**Commit Message**: Merge pull request #602 from str4d/mutants-fixes

Fixes from mutation testing

**File**: `.github/workflows/mutants.yml` (modified, +9/-1)
```diff
@@ -60,10 +60,18 @@ jobs:
         shell: sh
         env:
           TOOLCHAIN: ${{steps.toolchain.outputs.name}}
+      - name: Install linux build dependencies
+        run: sudo apt update && sudo apt install libfuse-dev
       - uses: taiki-e/install-action@650c5ca14212efbbf3e580844b04bdccf68dac31 # v2.67.18
         with:
           tool: cargo-mutants
-      - run: cargo mutants --package "${{ matrix.package }}" --all-features -vV --in-place
+      - run: >
+          cargo mutants
+          --package "${{ matrix.package }}"
+          --all-features
+          -vV
+          --in-place
+          --test-workspace true
       - uses: actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f # v6.0.0
         if: always()
         with:
```

---

### Incident Patch 12: `6b097057` (2026-03-08)
**Commit Message**: Fix trycmd keygen snapshots to accept non-UTC timezone offsets

The timestamp pattern ended with a literal Z, which only matches UTC.
Since rage-keygen uses Local::now(), non-UTC systems produce offsets
like -05:00, causing test failures. Remove the trailing Z so the
wildcard matches any timezone suffix.

Fixes str4d/rage#562

**File**: `rage/tests/cmd/rage-keygen/gen-output.out/key.txt` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
-# created: 20[..]-[..]-[..]T[..]:[..]:[..]Z
+# created: 20[..]-[..]-[..]T[..]:[..]:[..]
 # public key: age1[..]
 AGE-SECRET-KEY-1[..]
\ No newline at end of file
```

**File**: `rage/tests/cmd/rage-keygen/gen-stdout.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 bin.name = "rage-keygen"
 args = ""
 stdout = """
-# created: 20[..]-[..]-[..]T[..]:[..]:[..]Z
+# created: 20[..]-[..]-[..]T[..]:[..]:[..]
 # public key: age1[..]
 AGE-SECRET-KEY-1[..]
 """
```

---

### Incident Patch 13: `5d58b5a7` (2026-02-10)
**Commit Message**: CI: Install build dependencies for mutation testing

**File**: `.github/workflows/mutants.yml` (modified, +2/-0)
```diff
@@ -60,6 +60,8 @@ jobs:
         shell: sh
         env:
           TOOLCHAIN: ${{steps.toolchain.outputs.name}}
+      - name: Install linux build dependencies
+        run: sudo apt update && sudo apt install libfuse-dev
       - uses: taiki-e/install-action@650c5ca14212efbbf3e580844b04bdccf68dac31 # v2.67.18
         with:
           tool: cargo-mutants
```

---

### Incident Patch 14: `135fa360` (2026-01-04)
**Commit Message**: Merge pull request #596 from str4d/ci-fix-interop

CI: Switch to Go 1.24 for interop tests

**File**: `.github/workflows/interop.yml` (modified, +2/-2)
```diff
@@ -48,10 +48,10 @@ jobs:
           -H 'Authorization: token ${{ secrets.AGE_STATUS_ACCESS_TOKEN }}' \
           --data '{"state": "pending", "target_url": "https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}", "description": "In progress", "context": "Interoperability tests / Build age"}'
 
-      - name: Set up Go 1.19
+      - name: Set up Go 1.24
         uses: actions/setup-go@v5
         with:
-          go-version: 1.19
+          go-version: 1.24
         id: go
 
       - name: Use specified FiloSottile/age commit
```

#### Recent Merged Pull Requests:
- **PR #634** (2026-07-14): Release 0.12.1 (@str4d)
- **PR #633** (2026-07-14): `age 0.11.5` (@str4d)
- **PR #631** (2026-07-13): Update dependencies for 0.13.0 (@str4d)
- **PR #630** (2026-07-13): Release 0.12.0 (@str4d)
- **PR #629** (2026-07-13): `rage 0.11.3` (@str4d)
- **PR #628** (2026-07-13): age 0.11.4 (@str4d)
- **PR #627** (2026-07-12): Update dependencies yet again (@str4d)
- **PR #626** (closed): Bump MSRV to 1.88 (@dannywillems)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
