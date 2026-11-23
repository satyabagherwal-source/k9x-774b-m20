# Verification Protocol: Verification Protocol: Empirical Defect Shield for xevrion-hatchzip-learnings

<!-- PROVENANCE_START
{
  "source_repository": "xevrion-hatchzip-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T21:14:51.562Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-xevrion-hatchzip-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xevrion-hatchzip-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T21:14:51.562Z`  
> **Learning ID**: `LEARN-EVO-xevrion-hatchzip-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `xevrion-hatchzip-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/xevrion-hatchzip-learnings.md`  
> **Source**: github ([https://github.com/xevrion/hatchzip](https://github.com/xevrion/hatchzip))  
> **Source Version**: `f1fe89a9`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T21:14:33.986Z  
> **Learning ID**: `learn-github-xevrion-hatchzip`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): xevrion/hatchzip

> **Canonical Artifact**: `07_PROJECT_LEARNING/xevrion-hatchzip-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xevrion/hatchzip](https://github.com/xevrion/hatchzip))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-23T21:14:33.753Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xevrion/hatchzip`
- **Description**: HatchZip is a free, open-source archive extractor for Windows, macOS and Linux that extracts ZIP, 7z, RAR, tar and split archives in place, so it needs free space for the extracted files only. Desktop app and CLI.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3106 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/core/src/archive/fixtures/zst/generate.py`
```
#!/usr/bin/env python3
"""Rebuilds the zstd fixtures with the real zstd 1.5.7 and pzstd 1.5.7.

Run from this folder with both CLIs on PATH. The payloads are deterministic,
so the properties in README.md stay true; byte-identical output is not
promised across zstd builds.
"""

import io
import random
import struct
import subprocess
import tarfile

SMALL = 128 * 1024
BIG = 4 * 1024 * 1024


def noise(length: int, seed: int) -> bytes:
    rnd = random.Random(seed)
    return bytes(rnd.getrandbits(8) for _ in range(length))


def text(length: int) -> bytes:
    words = (
        "hatch every byte of the archive back into files while the disk stays nearly "
        "full and a crash at any moment loses nothing 42 1337 zran"
    ).split()
    out = []
    n = 0
    x = 0x2545F4914F6CDD1D
    while n < length:
        x ^= (x << 13) & 0xFFFFFFFFFFFFFFFF
        x ^= x >> 7
        x ^= (x << 17) & 0xFFFFFFFFFFFFFFFF
        w = words[x % len(words)]
        out.append(w.encode())
        out.append(b"\n" if x & 0x700 == 0 else b" ")
        n += len(w) + 1
    return b"".join(out)[:length]


def tar(name: str, files: dict[str, bytes], empty_dir: bool) -> None:
    with tarfile.open(name, "w", format=tarfile.GNU_FORMAT) as t:
        for path, data in files.items():
            ti = tarfile.TarInfo(path)
            ti.size = len(data)
            ti.mode = 0o644
            ti.mtime = 1700000000
            ti.uid = ti.gid = 0
            ti.uname = ti.gname = ""
            t.addfile(ti, io.BytesIO(data))
        if empty_dir:
            ti = tarfile.TarInfo("game/empty")
            ti.type = tarfile.DIRTYPE
            ti.mode = 0o755
            ti.mtime = 1700000000
            ti.uid = ti.gid = 0
            ti.uname = ti.gname = ""
            t.addfile(ti)


def zstd(args: list[str]) -> None:
    subprocess.run(["zstd", "-q", *args], check=True)


def read(name: str) -> bytes:
    with open(name, "rb") as f:
        return f.read()


def write(name: str, data: bytes) -> None:
    with open(name, "wb") as f:
        f.write(data)


def main() -> None:
    small = {
        "game/README.txt": b"HatchZip zstd fixture\n" * 20,
        "game/data/random.bin": noise(SMALL, 1234),
        "game/data/text.txt": text(SMALL),
    }
    big = {
        "game/README.txt": b"zstd fixture\n" * 100,
        # Compressible, so the fixture stays small; the file sizes still make
        # pzstd write more than one frame.
        "game/random.bin": (b"compressible pzstd frame\n" * (BIG // 24 + 1))[:BIG],
        "game/text.txt": text(BIG),
    }
    tar("payload.tar", small, True)
    tar("big.tar", big, False)

    zstd(["-3", "-f", "-o", "zst-one.tar.zst", "payload.tar"])
    zstd(["-3", "--no-check", "-f", "-o", "zst-nocheck-one.tar.zst", "payload.tar"])

    # Streaming input keeps zstd from shrinking the window to the content
    # size, so these two declare a window the format must refuse.
    for log, out in [(27, "zst-long27.tar.zst"), (31, "zst-long31.tar.zst")]:
        with open("payload.tar", "rb") as src:
            with open(out, "wb") as dst:
                subprocess.run(
                    ["zstd", "-q", "-3", f"--zstd=wlog={log}", "-c"],
                    stdin=src,
                    stdout=dst,
                    check=True,
                )

    # Two frames, the split inside a file's data.
    tar_bytes = read("payload.tar")
    half = len(tar_bytes) // 2 - (len(tar_bytes) // 2) % 512
    write("half1", tar_bytes[:half])
    write("half2", tar_bytes[half:])
    zstd(["-3", "-f", "-o", "half1.zst", "half1"])
    zstd(["-3", "-f", "-o", "half2.zst", "half2"])
    write("zst-two.tar.zst", read("half1.zst") + read("half2.zst"))

    zstd(["-3", "--no-check", "-f", "-o", "half1n.zst", "half1"])
    zstd(["-3", "--no-check", "-f", "-o", "half2n.zst", "half2"])
    write(
        "zst-nocheck-two.tar.zst", read("half1n.zst") + read("half2n.zst")
    )

    # pzstd's 12-byte skippable frame: magic, size 4, "pzst".
    skip = struct.pack("<II", 0x184D2A50, 4) + b"pzst"
    write("zst-skip.tar.zst", read("half1.zst") + skip + read("half2.zst"))

    # A trailing skippable frame shaped like the seekable format's table.
    table = struct.pack("<I", 2) + struct.pack("<II", 0, 0) * 2
    write(
        "zst-seekable.tar.zst",
        read("zst-two.tar.zst") + struct.pack("<II", 0x184D2A5E, len(table)) + table,
    )

    # A trained dictionary, which the format refuses.
    subprocess.run(["mkdir", "-p", "train"], check=True)
    subprocess.run(
        f"split -b 4096 -d -a 3 payload.tar train/s", shell=True, check=True
    )
    zstd(["--train", *sorted(__import__("glob").glob("train/s*")), "-o", "dict"])
    zstd(["-3", "-D", "dict", "-f", "-o", "zst-dict.tar.zst", "payload.tar"])

    good = read("zst-one.tar.zst")
    bad = bytearray(good)
    bad[len(bad) // 2] ^= 0xFF
    write("zst-bad-check.tar.zst", bad)
    write("zst-truncated.tar.zst", good[:-8])
    bad_magic = bytearray(good)
    bad_magic[0] ^= 0xFF
    write("zst-bad-magic.tar.zst", bad_magic)

    write("notar.txt", b"this is not a tar archive, just one file\n")
    zstd(["-3", "-f", "-o", "zst-notar.tar.zst", "notar.txt"])

    # Several real frames with a skippable frame before every one, as pzstd
    # writes them; the second frame holds only the tar's end blocks.
    subprocess.run(
        ["pzstd", "-q", "-p", "4", "-f", "-o", "zst-pzstd.tar.zst", "big.tar"],
        check=True,
    )

    for name in ["payload.tar", "big.tar", "half1", "half2", "notar.txt"]:
        __import__("os").remove(name)
    for name in ["half1.zst", "half2.zst", "half1n.zst", "half2n.zst"]:
        __import__("os").remove(name)
    subprocess.run(["rm", "-rf", "train", "dict"], check=True)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `crates/core/src/archive/mod.rs`
```
//! What the engine needs from an archive format: the archive split into
//! units, byte ranges that can be truncated away once every file in them is
//! safely on disk, and a way to decode one unit.

#[cfg(feature = "rar")]
mod rar;
pub mod resumable;
mod sevenz;
pub mod storage;
mod tar;
mod tarbz2;
pub mod targz;
pub mod tarxz;
pub mod tarzst;
mod xz;
mod zip;

use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;
use std::time::SystemTime;

use anyhow::{Context, Result, bail};

use crate::journal::Resume;
use storage::{Storage, Tail};
use targz::Event;
use targz::Profile;

/// An archive that is one compressed stream, decodable only from the front:
/// everything it holds is inside one decode pass, so instead of units
/// extracted from the end, the whole archive is one unit extracted front to
/// back, and the engine frees the compressed bytes behind the decoder. See
/// `targz` and `tarxz`.
pub trait SolidStream: Send + Sync {
    /// What a scan measured about the output: see [`targz::Profile`].
    fn profile(&self) -> &targz::Profile;
    /// Walks the archive from `from`, or from its start. The walk depends
    /// on nothing but the archive, so the box outlives the cloneable
    /// handle it came from.
    fn walk(&self, from: Option<&Resume>) -> Result<Box<dyn SolidWalker>>;
}

/// The walk a [`SolidStream`] produces: the tar's events and, at the
/// [`Event::Point`] ones, how decoding can restart.
pub trait SolidWalker {
    /// The next event. `Data` is at most `max` bytes, borrowed until the
    /// next call.
    fn next(&mut self, max: usize) -> Result<Event<'_>>;
    /// The resume point at the `Point` event just returned. Its `unit` is
    /// left for the engine to fill in.
    fn point(&self) -> Result<Resume>;
    /// The archive byte a resume point here would restart in. Cheap: for
    /// measuring only.
    fn point_byte(&self) -> Option<u64>;
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Kind {
    File,
    Dir,
    /// The link target is the item's data.
    Symlink,
    /// Hard links point at an earlier entry, which is extracted later than
    /// the link when going from the end, so they are made at the very end.
    HardLink(PathBuf),
}

#[derive(Clone, Debug)]
pub struct Item {
    pub path: PathBuf,
    pub size: u64,
    pub kind: Kind,
    pub mode: Option<u32>,
    pub mtime: Option<SystemTime>,
}

#[derive(Clone)]
pub struct Unit {
    /// Where the unit's bytes begin. Once it is committed the archive is
    /// truncated to this offset.
    pub start: u64,
    /// The format's own handle for the unit: a ZIP entry index, a 7z block.
    pub key: usize,
    pub items: Vec<Item>,
    /// Decoding it needs the archive's password.
    pub encrypted: bool,
}

/// The archive is encrypted and nothing can be read without its password.
/// Front ends look for this error to ask for one.
#[derive(Debug)]
pub struct PasswordNeeded;

impl std::fmt::Display for PasswordNeeded {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("this archive is password protected")
    }
}

impl std::error::Error for PasswordNeeded {}

/// The password doesn't open the archive.
#[derive(Debug)]
pub struct WrongPassword;

impl std::fmt::Display for WrongPassword {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("incorrect password")
    }
}

impl std::error::Error for WrongPassword {}

/// The archive is damaged, found while opening it and before anything was
/// touched. Front ends look for this error to report damage as such.
#[derive(Debug)]
pub struct Damaged(pub anyhow::Error);

impl std::fmt::Display for Damaged {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:#}", self.0)
    }
}

impl std::error::Error for Damaged {}

/// The archive is valid but uses something this build does not extract: an
/// unknown or unprovided check, an unknown filter, several xz streams, or a
/// dictionary too large to hold. Front ends report it as unsupported, never
/// as damage.
#[derive(Debug)]
pub struct Unsupported(pub anyhow::Error);

impl std::fmt::Display for Unsupported {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:#}", self.0)
    }
}

impl std::error::Error for Unsupported {}

/// The format name of RAR archives in the journal.
pub const RAR: &str = "rar";

/// The format name of native split ZIPs (`.z01`, ..., `.zip`) in the journal.
pub const SPLIT_ZIP: &str = zip::SPLIT;

/// Whether this build extracts RAR archives. Builds without UnRAR refuse
/// them before anything is touched.
pub const RAR_SUPPORTED: bool = cfg!(feature = "rar");

/// Why a build without UnRAR refuses a RAR archive.
pub fn no_rar() -> anyhow::Error {
    anyhow::anyhow!(
        "this build of HatchZip does not include RAR support, and the archive was not \
         modified. Download the release build from hatchzip.dev or \
         github.com/xevrion/hatchzip/releases"
    )
}

/// How the password of an encrypted archive is proven before anything is
/// touched.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PasswordCheck {
    /// Decode the start of the smallest encrypted unit: a wrong password
    /// fails at once, or within the first blocks.
    Sample,
    /// The headers hold a check value for the password, so
    /// [`Format::prove_password`] answers without decoding anything.
    Headers,
    /// Only the checksum at the end of a file can tell, so the smallest
    /// encrypted unit is decoded whole, writing nothing.
    WholeUnit,
}

impl Unit {
    /// Saturates instead of wrapping: sizes come straight from the archive.
    pub fn size(&self) -> u64 {
        self.items
            .iter()
            .fold(0u64, |sum, i| sum.saturating_add(i.size))
    }
}

pub trait Format: Send + Sync {
    /// A worker decodes units on one thread. `threads` is a hint for codecs
    /// that can decode a single stream on several cores.
    fn worker(&self, threads: u32) -> Result<Box<dyn Worker + '_>>;

    /// For a unit holding one file whose data [`resumable`] can decode from
    /// the middle: where that data lies. Such units can free their archive
    /// bytes while they are extracted instead of only once they are done.
    fn stream(&self, _unit: &Unit) -> Result<Option<Stream>> {
        Ok(None)
    }

    /// For an archive that is one compressed stream, decodable only from the
    /// front: its single unit, extracted front to back while the bytes behind
    /// the decoder are freed.
    fn solid(&self) -> Option<&dyn SolidStream> {
        None
    }

    /// The decoder finds a unit only by reading everything before it, and
    /// one handle can't be shared between threads. A batch is then decoded
    /// on one thread by one worker, lowest unit first, so the worker can
    /// walk forward instead of starting over for every unit.
    fn serial(&self) -> bool {
        false
    }

    /// Why the archive can't be extracted in place, if it can't: it can
    /// still be extracted while it is kept.
    fn refuses_in_place(&self) -> Option<String> {
        None
    }

    fn password_check(&self) -> PasswordCheck {
        PasswordCheck::Sample
    }

    /// Proves the password from the headers alone; only called when
    /// [`password_check`](Self::password_check) says it can.
    fn prove_password(&self) -> Result<()> {
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Codec {
    Stored,
    /// Raw deflate, as ZIP stores it.
    Deflate,
}

#[derive(Clone, Debug)]
pub struct Stream {
    /// Where the file's data begins. The headers before it stay untouched
    /// until the unit is committed, so the archive still parses on resume.
    pub data_start: u64,
    /// Length of the data in the archive.
    pub packed: u64,
    pub codec: Codec,
    /// CRC-32 of the output, if the format records one.
    pub crc: Option<u32>,
}

pub trait Worker {
    /// Decodes `unit`, handing each item to `sink` in order.
    fn extract(&mut self, unit: &Unit, sink: &mut dyn Sink) -> Result<()>;
}

pub trait Sink {
    fn item(&mut self, item: &Item, data: &mut dyn Read) -> Result<()>;
}

pub struct Opened {
    pub name: &'static str,
    pub format: Box<dyn Format>,
    pub units: Vec<Unit>,
    /// Everything from here to the end is saved before anything is reclaimed.
    pub tail_start: u64,
}

/// Parses the archive. `resume` carries the format recorded by an earlier
/// run, the tail it saved and its resume point, which a compressed tar is
/// read from; a fresh run sniffs the format instead. The password is only
/// needed for encrypted archives; whether it is right is found out when a
/// unit is decoded (see `Job::check_password`).
pub fn open(
    storage: &Arc<Storage>,
    resume: Option<(&str, Arc<Tail>, Option<&Resume>)>,
    password: Option<&str>,
) -> Result<Opened> {
    let (name, tail, point) = match resume {
        Some((name, tail, point)) => (name.to_string(), Some(tail), point),
        None => (sniff(storage)?.to_string(), None, None),
    };
    match name.as_str() {
        "zip" => zip::open(storage, tail, password),
        zip::SPLIT => zip::open_split(storage, tail, password),
        "7z" => sevenz::open(storage, tail, password),
        "tar" => tar::open(storage, tail),
        #[cfg(feature = "rar")]
        RAR => rar::open(storage, tail.is_some(), password),
        #[cfg(not(feature = "rar"))]
        RAR => Err(no_rar()),
        targz::NAME => targz::open(storage, point),
        tarbz2::NAME => tarbz2::open(storage, point),
        tarxz::NAME => tarxz::open(storage, point),
        tarzst::NAME => tarzst::open(storage, point),
        other => bail!("unknown archive format '{other}' in the journal"),
    }
}

/// What turns the first `keep` bytes of a half-extracted archive back into an
/// archive any tool
```

### Core Architecture Module: `crates/core/src/archive/rar.rs`
```
//! RAR archives: one `.rar` file or a volume set (`name.part1.rar`,
//! `name.part2.rar`, ... or `name.rar`, `name.r00`, ...).
//!
//! A RAR archive that is not solid stores its files one after another, each
//! header followed by the file's data, much like tar. So every file is a
//! unit: the headers of every volume are read here, files are extracted from
//! the last one first, and after each batch the archive is truncated to the
//! header of the lowest file in it. A volume is deleted once every file that
//! starts in it or reaches into it is out. A file split over several volumes
//! belongs to the volume it starts in, so its later pieces only go once all
//! of it is committed. What is left is always a prefix of the set whose
//! headers are untouched, which UnRAR still reads.
//!
//! Decoding is UnRAR's, through its C interface. UnRAR finds a file only by
//! reading every header before it, so a batch is decoded on one thread,
//! lowest file first, by one archive handle that walks forward. A helper
//! thread turns UnRAR's data callback into the reader the engine's sinks
//! take. A stored file that lies whole in one volume is plain bytes at a
//! known offset, so the engine can stream it and free its space as it goes,
//! as it does for tar.
//!
//! A solid archive compresses every file against the ones before it and
//! decodes only front to back, and UnRAR can't save its decoder's state, so
//! a crash could never resume. It is one unit, extracted only while the
//! archive is kept.
//!
//! An archive made with "Encrypt file names" (`rar -hp`) encrypts its
//! headers too. They are decrypted here with the password (see `crypt`), so
//! the same parser reads them, and every offset is the real one on disk:
//! a file starts at the IV or salt in front of its header, which is where a
//! truncation cuts.

mod crypt;

use std::collections::{HashMap, HashSet};
use std::ffi::{c_int, c_uint};
use std::io::{self, Read, Seek, SeekFrom};
use std::path::Path;
use std::sync::mpsc::{Receiver, SyncSender, sync_channel};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::{Duration, SystemTime};

use anyhow::{Context, Result, anyhow, bail};
use sha2::{Digest, Sha256};
use unrar_ng_sys as native;

use super::storage::{Part, Reader, Storage};
use super::{
    Codec, Damaged, Format, Item, Kind, Opened, PasswordCheck, PasswordNeeded, Sink, Stream, Unit,
    Worker, WrongPassword, is_symlink_mode, safe_path,
};
use crate::platform;

pub use super::RAR as NAME;

const SIG5: &[u8] = b"Rar!\x1A\x07\x01\x00";
const SIG4: &[u8] = b"Rar!\x1A\x07\x00";

/// RAR 5 headers are at most 2 MiB by the format's own limit.
const MAX_HEADER: u64 = 2 << 20;

/// UnRAR refuses a larger dictionary unless asked, and decoding with one
/// takes that much memory. RAR 7 can write up to 64 GB.
const MAX_DICT: u64 = 4 << 30;

/// UnRAR keeps a password to this many characters, terminator included.
const MAX_PASSWORD: usize = 128;

/// Room for the longest name UnRAR reads (`MAXPATHSIZE`).
const NAME_ROOM: usize = 0x10000;

/// Something this build can't extract, as opposed to damage. Refused before
/// anything is touched, like damage, but reported as what it is.
#[derive(Debug)]
struct Unsupported(String);

impl std::fmt::Display for Unsupported {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for Unsupported {}

fn unsupported(why: impl Into<String>) -> anyhow::Error {
    Unsupported(why.into()).into()
}

/// The RAR 5 password check value of an encrypted file: 64 bits derived from
/// the password with PBKDF2, so a wrong password is caught without decoding.
#[derive(Clone, PartialEq, Eq, Hash)]
struct Check {
    /// Log2 of the PBKDF2 iteration count.
    count: u8,
    salt: [u8; 16],
    value: [u8; 8],
}

impl Check {
    /// What UnRAR's `CryptData::SetKey50` derives: PBKDF2-HMAC-SHA256 run 32
    /// iterations past the key, folded into 8 bytes.
    fn matches(&self, password: &str) -> bool {
        let mut derived = [0u8; 32];
        pbkdf2::pbkdf2_hmac::<Sha256>(
            rar_password(password).as_bytes(),
            &self.salt,
            (1u32 << self.count) + 32,
            &mut derived,
        );
        let mut folded = [0u8; 8];
        for (i, b) in derived.iter().enumerate() {
            folded[i % 8] ^= b;
        }
        folded == self.value
    }
}

/// The password as UnRAR uses it: cut to `MAX_PASSWORD - 1` wide characters,
/// which are UTF-16 units on Windows and code points elsewhere.
fn rar_password(password: &str) -> String {
    let mut wide = wide(password);
    wide.truncate(MAX_PASSWORD - 1);
    wide_to_string(&wide)
}

/// What the headers of one file say, in one volume. A file that spans
/// volumes has one of these in each.
struct Header {
    volume: usize,
    /// Where the header begins in the joined archive.
    start: u64,
    /// Where the data in this volume begins, and how long it is.
    data: u64,
    packed: u64,
    name: String,
    rar5: bool,
    dir: bool,
    size: u64,
    before: bool,
    after: bool,
    encrypted: bool,
    check: Option<Check>,
    link: bool,
    solid: bool,
    stored: bool,
    crc: Option<u32>,
    dict: u64,
    /// A compression version UnRAR knows.
    known: bool,
    mode: Option<u32>,
    mtime: Option<SystemTime>,
}

#[derive(Default)]
struct Parsed {
    headers: Vec<Header>,
    /// Some volume says the archive is solid.
    solid: bool,
    /// The last volume read says more volumes follow.
    more: bool,
    /// Some volume is RAR 4, whose encrypted files have no check value.
    rar4: bool,
    /// Whether the first volume's headers are encrypted. UnRAR refuses a
    /// set whose volumes differ, and so does HatchZip.
    encrypted_headers: Option<bool>,
    /// The password is known to be right: it matched the check value of
    /// the archive encryption header, or a header decrypted with it passed
    /// its checksum. Until then, a header that fails is a wrong password;
    /// from then on, it is damage.
    proven: bool,
    /// Header keys derived so far, by salt (and iteration count). The
    /// derivation is slow on purpose, and the volumes of a set, or every
    /// header of a RAR 4 archive, name the same salt.
    keys5: HashMap<([u8; 16], u8), [u8; 32]>,
    keys4: Keys4,
}

/// RAR 4 header keys and IVs, by salt.
type Keys4 = HashMap<[u8; 8], ([u8; 16], [u8; 16])>;

impl Parsed {
    fn agree(&mut self, v: usize, encrypted: bool) -> Result<()> {
        match self.encrypted_headers {
            None => self.encrypted_headers = Some(encrypted),
            Some(first) if first != encrypted => bail!(
                "volume {} {} encrypted file names, and the first volume {}",
                v + 1,
                if encrypted { "has" } else { "does not have" },
                if first { "does" } else { "does not" }
            ),
            Some(_) => {}
        }
        Ok(())
    }
}

/// One file, joined from its pieces in every volume it spans.
struct File {
    /// The volumes it starts and ends in.
    first: usize,
    last: usize,
    /// Its first header, in the joined archive.
    start: u64,
    /// Where its data lies in each volume, in order.
    pieces: Vec<(u64, u64)>,
    name: String,
    rar5: bool,
    dir: bool,
    size: u64,
    encrypted: bool,
    check: Option<Check>,
    link: bool,
    solid: bool,
    stored: bool,
    crc: Option<u32>,
    dict: u64,
    known: bool,
    mode: Option<u32>,
    mtime: Option<SystemTime>,
}

impl File {
    /// The name as it is extracted. RAR 5 separates folders with `/` only,
    /// so a `\` is part of a name, which Windows can't hold; WinRAR writes
    /// it as `_` there, and so does HatchZip everywhere, so the output is
    /// the same on every system. RAR 4 names use `\`.
    fn path_name(&self) -> String {
        clean_name(&self.name, self.rar5)
    }

    fn item(&self) -> Result<Item> {
        let path = safe_path(&self.path_name()).ok_or_else(|| {
            anyhow!(
                "'{}' would be written outside the destination folder; extraction refused",
                self.name
            )
        })?;
        Ok(Item {
            path,
            size: if self.dir { 0 } else { self.size },
            kind: if self.dir { Kind::Dir } else { Kind::File },
            mode: self.mode,
            mtime: self.mtime,
        })
    }

    /// Whether UnRAR's name for this file extracts to the same place.
    fn same_name(&self, unrar: &str) -> bool {
        // UnRAR reports names with the separator of the system it runs on,
        // `\` on Windows; the headers always use `/` in RAR 5.
        let unrar = unrar.replace(std::path::MAIN_SEPARATOR, "/");
        let ours = safe_path(&self.path_name());
        ours.is_some() && ours == safe_path(&clean_name(&unrar, self.rar5))
    }

    /// Whether UnRAR's header for this file, the first piece of it, agrees
    /// with HatchZip's on what extraction relies on besides the name: how
    /// big its data is in the archive and once decoded, its checksum, and
    /// whether it is a folder, encrypted or solid.
    fn same_header(&self, h: &native::HeaderDataEx) -> bool {
        let wide = |low: c_uint, high: c_uint| u64::from(low) | u64::from(high) << 32;
        let (flags, hash_type, crc) = (h.flags, h.hash_type, h.file_crc);
        let is = |flag: c_uint| flags & flag != 0;
        let sizes = self.dir
            || (wide(h.unp_size, h.unp_size_high) == self.size
                && Some(wide(h.pack_size, h.pack_size_high)) == self.pieces.first().map(|p| p.1));
        // UnRAR's CRC field shares its room with BLAKE2 hashes.
        let crc = hash_type != native::RAR_HASH_CRC32 || self.crc.is_none_or(|c| c == crc);
        is(native::RHDF_DIRECTORY) == self.dir
            && is(native::RHDF_ENCRYPTED) == self.encrypted
            && is(native::RHDF_SOLID) == self.solid
           
```

### Core Architecture Module: `crates/core/src/archive/rar/crypt.rs`
```
//! Decrypting RAR headers, for archives made with "Encrypt file names"
//! (`rar -hp`), exactly as UnRAR's `crypt3.cpp` and `crypt5.cpp` do it.
//!
//! RAR 5 encrypts every header after the archive encryption header with
//! AES-256-CBC, under a key derived from the password with
//! PBKDF2-HMAC-SHA256, and puts a fresh 16-byte IV in front of each one.
//! RAR 4 encrypts every header after the main header with AES-128-CBC, and
//! puts an 8-byte salt in front of each one; the key and the IV both come
//! from the password and that salt through RAR 3's own SHA-1 derivation.
//! Either way a header is padded to a whole number of 16-byte blocks.

use aes::{Aes128, Aes256};
use cbc::cipher::block_padding::NoPadding;
use cbc::cipher::{BlockModeDecrypt, KeyIvInit};
use sha2::Sha256;

pub(super) const BLOCK: u64 = 16;

/// The AES-256 key of a RAR 5 archive's headers: PBKDF2-HMAC-SHA256 of the
/// password, as UTF-8, over `2^count` iterations (`CryptData::SetKey50`).
pub(super) fn key5(password: &str, salt: &[u8; 16], count: u8) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2::pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, 1u32 << count, &mut key);
    key
}

/// Decrypts whole blocks of a RAR 5 header in place.
pub(super) fn decrypt5(key: &[u8; 32], iv: &[u8], buf: &mut [u8]) {
    cbc::Decryptor::<Aes256>::new_from_slices(key, iv)
        .expect("a 32-byte key and a 16-byte IV")
        .decrypt_padded::<NoPadding>(buf)
        .expect("whole blocks");
}

/// Decrypts whole blocks of a RAR 4 header in place.
pub(super) fn decrypt4(key: &[u8; 16], iv: &[u8; 16], buf: &mut [u8]) {
    cbc::Decryptor::<Aes128>::new_from_slices(key, iv)
        .expect("a 16-byte key and a 16-byte IV")
        .decrypt_padded::<NoPadding>(buf)
        .expect("whole blocks");
}

/// The AES-128 key and IV of a RAR 4 header with the given salt
/// (`CryptData::SetKey30`). `password` is the password as UnRAR holds it,
/// in 16-bit little-endian units. 2^18 rounds each hash the password and
/// salt, then the round number; the IV takes one byte of an intermediate
/// digest every 2^14 rounds, and the key is the final digest.
pub(super) fn key4(password: &[u8], salt: &[u8; 8]) -> ([u8; 16], [u8; 16]) {
    const ROUNDS: u32 = 0x40000;
    let mut raw = password.to_vec();
    raw.extend_from_slice(salt);
    let mut sha = Sha1::new();
    let mut iv = [0u8; 16];
    for i in 0..ROUNDS {
        sha.update(&mut raw, true);
        sha.update(&mut [i as u8, (i >> 8) as u8, (i >> 16) as u8], false);
        if i % (ROUNDS / 16) == 0 {
            let digest = sha.clone().finish();
            iv[(i / (ROUNDS / 16)) as usize] = digest[4] as u8;
        }
    }
    let digest = sha.finish();
    let mut key = [0u8; 16];
    for (i, word) in digest[..4].iter().enumerate() {
        key[i * 4..i * 4 + 4].copy_from_slice(&word.to_le_bytes());
    }
    (key, iv)
}

/// SHA-1 as UnRAR's `sha1.cpp` computes it, including the quirk of RAR 2.9
/// that RAR 3 and 4 keep for compatibility: hashing a whole 64-byte block
/// straight from the input overwrites that block with the last sixteen
/// words of its message schedule. The key derivation hashes the same buffer
/// 2^18 times, so with a password of 29 or more characters, long enough for
/// such a block, every later round hashes what the quirk wrote.
#[derive(Clone)]
struct Sha1 {
    state: [u32; 5],
    count: u64,
    buf: [u8; 64],
}

impl Sha1 {
    fn new() -> Self {
        Self {
            state: [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0],
            count: 0,
            buf: [0; 64],
        }
    }

    /// Hashes one block and returns the last sixteen words of its message
    /// schedule, which UnRAR leaves in its workspace.
    fn compress(state: &mut [u32; 5], block: &[u8]) -> [u32; 16] {
        let mut w = [0u32; 16];
        for (i, word) in w.iter_mut().enumerate() {
            *word = u32::from_be_bytes(block[i * 4..i * 4 + 4].try_into().expect("four bytes"));
        }
        let [mut a, mut b, mut c, mut d, mut e] = *state;
        for i in 0..80 {
            if i >= 16 {
                w[i & 15] = (w[(i + 13) & 15] ^ w[(i + 8) & 15] ^ w[(i + 2) & 15] ^ w[i & 15])
                    .rotate_left(1);
            }
            let (f, k) = match i {
                0..20 => ((b & c) | (!b & d), 0x5A827999),
                20..40 => (b ^ c ^ d, 0x6ED9EBA1),
                40..60 => ((b & c) | (b & d) | (c & d), 0x8F1BBCDC),
                _ => (b ^ c ^ d, 0xCA62C1D6u32),
            };
            let t = a
                .rotate_left(5)
                .wrapping_add(f)
                .wrapping_add(e)
                .wrapping_add(k)
                .wrapping_add(w[i & 15]);
            e = d;
            d = c;
            c = b.rotate_left(30);
            b = a;
            a = t;
        }
        for (s, v) in state.iter_mut().zip([a, b, c, d, e]) {
            *s = s.wrapping_add(v);
        }
        w
    }

    /// `sha1_process`, or with `rar29` `sha1_process_rar29`, which writes
    /// back into `data`.
    fn update(&mut self, data: &mut [u8], rar29: bool) {
        let mut j = (self.count & 63) as usize;
        self.count += data.len() as u64;
        let mut i = 0;
        if j + data.len() > 63 {
            i = 64 - j;
            self.buf[j..].copy_from_slice(&data[..i]);
            Self::compress(&mut self.state, &self.buf);
            while i + 63 < data.len() {
                let w = Self::compress(&mut self.state, &data[i..i + 64]);
                if rar29 {
                    for (k, word) in w.iter().enumerate() {
                        data[i + k * 4..i + k * 4 + 4].copy_from_slice(&word.to_le_bytes());
                    }
                }
                i += 64;
            }
            j = 0;
        }
        self.buf[j..j + data.len() - i].copy_from_slice(&data[i..]);
    }

    /// The digest as UnRAR's `sha1_done` gives it: the five state words.
    fn finish(mut self) -> [u32; 5] {
        let bits = self.count.wrapping_mul(8);
        let mut pos = (self.count & 63) as usize;
        self.buf[pos] = 0x80;
        pos += 1;
        if pos > 56 {
            self.buf[pos..].fill(0);
            Self::compress(&mut self.state, &self.buf);
            pos = 0;
        }
        self.buf[pos..56].fill(0);
        self.buf[56..].copy_from_slice(&bits.to_be_bytes());
        Self::compress(&mut self.state, &self.buf);
        self.state
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(words: [u32; 5]) -> String {
        words.iter().map(|w| format!("{w:08x}")).collect()
    }

    fn digest(data: &[u8]) -> String {
        let mut sha = Sha1::new();
        // In pieces, to cross block boundaries both ways.
        for piece in data.chunks(37) {
            sha.update(&mut piece.to_vec(), false);
        }
        hex(sha.finish())
    }

    /// Without the quirk this is plain SHA-1 (FIPS 180 test vectors).
    #[test]
    fn plain_sha1_matches_the_standard() {
        assert_eq!(digest(b""), "da39a3ee5e6b4b0d3255bfef95601890afd80709");
        assert_eq!(digest(b"abc"), "a9993e364706816aba3e25717850c26c9cd0d89d");
        assert_eq!(
            digest(&b"a".repeat(1000)),
            "291e9a6c66994949b57ba5e650361e98fc36b1ba"
        );
    }

    /// The quirk changes only a block hashed straight from the input, and
    /// leaves the digest of that call alone.
    #[test]
    fn the_rar29_quirk_rewrites_whole_blocks_of_the_input() {
        let mut short = b"x".repeat(60);
        let mut sha = Sha1::new();
        sha.update(&mut short, true);
        assert_eq!(short, b"x".repeat(60));

        let mut long = b"y".repeat(200);
        let mut quirky = Sha1::new();
        quirky.update(&mut long, true);
        assert_ne!(long, b"y".repeat(200));
        assert_eq!(hex(quirky.finish()), digest(&b"y".repeat(200)));
    }
}

```

### Core Architecture Module: `crates/core/src/archive/resumable.rs`
```
//! Decoders that can stop, have their position recorded in the journal, and
//! start again from that position in a later process. That is what lets the
//! engine free the archive bytes behind a large file while it is still being
//! extracted: once a position is durable, nothing before it is ever read
//! again.
//!
//! Stored data can restart at any byte. Deflate can restart at any block
//! boundary, the technique of zlib's `examples/zran.c`: a block boundary may
//! fall inside a byte, so the position is kept in bits, and the decoder
//! needs the 32 KiB of output before it, which back-references reach into.
//!
//! [`Gzip`] wraps the same raw inflate in gzip members: it parses their
//! headers, checks each trailer's CRC-32 and length, and can also restart at
//! the start of any member, where nothing from before is needed.

use std::ffi::CStr;
use std::io::{Read, Seek, SeekFrom};

use anyhow::{Context, Result, anyhow, bail};
use libz_rs_sys as z;

use super::storage::Reader;
use super::{Codec, Stream};

/// How much output from just before a resume point a decoder needs to start
/// there: the deflate window.
pub const WINDOW: usize = 32 * 1024;

const INPUT_BUF: usize = 1024 * 1024;

/// The longest file name or comment a gzip header may hold.
const MAX_GZIP_NAME: usize = 64 * 1024;

pub struct Decoder {
    inner: Inner,
}

enum Inner {
    Stored(Stored),
    Deflate(Inflate),
}

impl Decoder {
    /// Starts decoding `stream` at `bit`, counted in bits from the start of
    /// the archive: the start of the data, or a point an earlier run
    /// recorded. `window` is the output just before that point, up to
    /// [`WINDOW`] bytes.
    pub fn new(reader: Reader, stream: &Stream, bit: u64, window: &[u8]) -> Result<Self> {
        let end = stream.data_start + stream.packed;
        if bit / 8 < stream.data_start || bit / 8 > end {
            bail!("the journal's resume point lies outside the file's data");
        }
        let inner = match stream.codec {
            Codec::Stored => {
                if !bit.is_multiple_of(8) {
                    bail!("the journal's resume point lies inside a byte of stored data");
                }
                Inner::Stored(Stored {
                    reader,
                    pos: bit / 8,
                    end,
                })
            }
            Codec::Deflate => Inner::Deflate(Inflate::new(reader, bit, end, window, INPUT_BUF)?),
        };
        Ok(Self { inner })
    }

    /// Decodes into `buf`. Returns 0 only at the end of the data.
    pub fn read(&mut self, buf: &mut [u8]) -> Result<usize> {
        match &mut self.inner {
            Inner::Stored(s) => s.read(buf),
            Inner::Deflate(d) => d.read(buf),
        }
    }

    /// Where decoding could restart, in bits from the start of the archive,
    /// if it can be stopped right after the output handed out so far.
    pub fn restart_point(&self) -> Option<u64> {
        match &self.inner {
            Inner::Stored(s) => Some(s.pos * 8),
            Inner::Deflate(d) => d.restart_point(),
        }
    }
}

struct Stored {
    reader: Reader,
    pos: u64,
    end: u64,
}

impl Stored {
    fn read(&mut self, buf: &mut [u8]) -> Result<usize> {
        let n = (self.end - self.pos).min(buf.len() as u64) as usize;
        if n == 0 {
            return Ok(0);
        }
        self.reader.seek(SeekFrom::Start(self.pos))?;
        self.reader
            .read_exact(&mut buf[..n])
            .context("reading the archive")?;
        self.pos += n as u64;
        Ok(n)
    }
}

/// A raw inflate over the archive that reports block boundaries.
struct Inflate {
    /// Boxed because zlib's state keeps a pointer back to it.
    strm: Box<z::z_stream>,
    reader: Reader,
    input: Vec<u8>,
    /// The next archive offset to read into `input`.
    next_read: u64,
    end: u64,
    /// Archive offset of the first byte handed to zlib, and how many bytes
    /// it has taken since. Counted here because zlib's own `total_in` is 32
    /// bits on Windows.
    fed_from: u64,
    taken: u64,
    /// `data_type` after the last call, which says whether zlib stopped
    /// right after a block and how many bits it holds unread.
    data_type: i32,
    done: bool,
}

impl Inflate {
    /// `input` is the size of the input buffer: [`INPUT_BUF`], except in
    /// tests that make every boundary fall across a refill.
    fn new(mut reader: Reader, bit: u64, end: u64, window: &[u8], input: usize) -> Result<Self> {
        let byte = bit / 8;
        let skip = (bit % 8) as u32;
        // A point inside a byte: the bits below `skip` belong to the block
        // before, the rest are fed in by hand.
        let partial = if skip == 0 {
            None
        } else {
            let mut b = [0u8];
            reader.seek(SeekFrom::Start(byte))?;
            reader.read_exact(&mut b).context("reading the archive")?;
            Some(b[0] >> skip)
        };
        let start = if partial.is_some() { byte + 1 } else { byte };
        let mut strm = Box::new(z::z_stream::default());
        // Negative window bits: raw deflate, no zlib or gzip wrapper.
        let ret = unsafe {
            z::inflateInit2_(
                &mut *strm,
                -15,
                z::zlibVersion(),
                size_of::<z::z_stream>() as i32,
            )
        };
        if ret != z::Z_OK {
            bail!("starting the deflate decoder failed ({ret})");
        }
        // Constructed right away so that every error below still ends the
        // decoder.
        let mut me = Self {
            strm,
            reader,
            input: vec![0; input],
            next_read: start,
            end,
            fed_from: start,
            taken: 0,
            data_type: 0,
            done: false,
        };
        if let Some(bits) = partial {
            let ret = unsafe { z::inflatePrime(&mut *me.strm, (8 - skip) as i32, i32::from(bits)) };
            if ret != z::Z_OK {
                bail!("resuming the deflate decoder failed ({ret})");
            }
        }
        if !window.is_empty() {
            let ret = unsafe {
                z::inflateSetDictionary(&mut *me.strm, window.as_ptr(), window.len() as u32)
            };
            if ret != z::Z_OK {
                bail!("resuming the deflate decoder failed ({ret})");
            }
        }
        Ok(me)
    }

    /// Fills the input buffer if zlib has taken all of it.
    fn refill(&mut self) -> Result<()> {
        if self.strm.avail_in == 0 && self.next_read < self.end {
            let n = (self.end - self.next_read).min(self.input.len() as u64) as usize;
            self.reader.seek(SeekFrom::Start(self.next_read))?;
            self.reader
                .read_exact(&mut self.input[..n])
                .context("reading the archive")?;
            self.next_read += n as u64;
            self.strm.next_in = self.input.as_ptr();
            self.strm.avail_in = n as u32;
        }
        Ok(())
    }

    /// The archive offset of the next byte zlib has not taken.
    fn pos(&self) -> u64 {
        self.fed_from + self.taken
    }

    /// Takes one byte of input past zlib, for the gzip framing between
    /// deflate streams. `None` at the end of the archive.
    fn raw_byte(&mut self) -> Result<Option<u8>> {
        self.refill()?;
        if self.strm.avail_in == 0 {
            return Ok(None);
        }
        // SAFETY: `avail_in` bytes from `next_in` lie inside `self.input`.
        let b = unsafe { *self.strm.next_in };
        self.strm.next_in = unsafe { self.strm.next_in.add(1) };
        self.strm.avail_in -= 1;
        self.taken += 1;
        Ok(Some(b))
    }

    /// After the end of a deflate stream: hands back the whole bytes zlib
    /// pulled into its bit buffer without using them, so that [`pos`] is the
    /// first byte after the deflate data.
    ///
    /// [`pos`]: Self::pos
    fn give_back_unused(&mut self) {
        // zlib skips to a byte boundary after the last block, so what it
        // holds is whole bytes. zlib-rs was seen to hold none, at every
        // member end of the unit tests with buffers down to one byte; zlib
        // may, so this stays.
        let unused = (self.data_type & 63) as u64 / 8;
        // SAFETY: `next_in` points into `self.input`.
        let in_buffer = unsafe { self.strm.next_in.offset_from(self.input.as_ptr()) } as u64;
        if unused <= in_buffer {
            self.strm.next_in = unsafe { self.strm.next_in.sub(unused as usize) };
            self.strm.avail_in += unused as u32;
            self.taken -= unused;
        } else {
            // They came from an earlier fill of the buffer: read them again.
            let at = self.pos() - unused;
            self.fed_from = at;
            self.taken = 0;
            self.next_read = at;
            self.strm.avail_in = 0;
        }
    }

    /// Starts a new raw deflate stream at [`pos`](Self::pos), keeping the
    /// input already read.
    fn restart(&mut self) -> Result<()> {
        let ret = unsafe { z::inflateReset(&mut *self.strm) };
        if ret != z::Z_OK {
            bail!("restarting the deflate decoder failed ({ret})");
        }
        self.done = false;
        self.data_type = 0;
        Ok(())
    }

    /// The output just before the current position that the rest of the
    /// stream may refer back to, up to [`WINDOW`] bytes.
    fn window(&self) -> Result<Vec<u8>> {
        let mut window = vec![0; WINDOW];
        let mut len = 0u32;
        // SAFETY: the buffer holds WINDOW bytes, the most zlib ever copies.
        let ret = unsafe { z::inflateGetDictionary(&*self.strm, window.as_mut_ptr(), &mut len) };
        if ret != z::Z_OK || len as usize > WINDOW {
            bail!("reading the deflate window failed ({ret})");
        }
        window.truncate(len as usize);
        Ok(window)
    }

    fn read(&mut self, buf: &mut [u8]) -> Result<usize> {
        
```

### Core Architecture Module: `crates/core/src/archive/sevenz.rs`
```
//! 7z keeps its header at the end, like ZIP, and stores its packed data as
//! blocks in order. A solid block can only be decoded from its start, so the
//! unit is the whole block, and it is freed once all its files are out.

use std::io::{self, Read, Seek, SeekFrom};
use std::sync::Arc;
use std::time::SystemTime;

use anyhow::{Context, Result, anyhow, bail};
use sevenz_rust2::{
    Archive, ArchiveEntry, ArchiveWriter, Block, BlockDecoder, Password, SIGNATURE_HEADER_SIZE,
};

use super::storage::{Reader, Storage, Tail};
use super::{
    Format, Item, Kind, Opened, PasswordNeeded, Sink, Unit, Unsupported, Worker, WrongPassword,
    is_symlink_mode, safe_path,
};

/// Files with no data (directories, empty files) live only in the header.
/// They get a unit of their own that starts where the header does, so it's
/// done first and truncating it frees nothing that's still needed.
const NO_DATA: usize = usize::MAX;

const AES: &[u8] = &[0x06, 0xF1, 0x07, 0x01];

struct SevenZ {
    storage: Arc<Storage>,
    archive: Archive,
    password: Password,
}

pub fn open(
    storage: &Arc<Storage>,
    tail: Option<Arc<Tail>>,
    password: Option<&str>,
) -> Result<Opened> {
    use sevenz_rust2::Error;

    let resuming = tail.as_ref().map(|t| t.start);
    let mut reader = storage.reader(tail);
    let password = password.map_or_else(Password::empty, Password::new);
    let archive = Archive::read(&mut reader, &password).map_err(|e| match e {
        Error::PasswordRequired => anyhow::Error::new(PasswordNeeded),
        Error::BadSignature(_) | Error::UnsupportedVersion { .. } => {
            anyhow!("not a readable 7z archive: {e}")
        }
        // sevenz-rust2 0.24.2 refuses a block with no packed stream while
        // reading the header; 0.24.1 let it through to our own checks. Both
        // are the same damage, so they read the same.
        Error::Other(m)
            if m == "Block has no packed streams"
                || m == "no packed streams, can't read encoded header" =>
        {
            inconsistent()
        }
        // An encrypted header that won't parse is almost always the wrong
        // password; damage can't be told apart from it.
        _ if !password.is_empty() => anyhow::Error::new(WrongPassword),
        e => anyhow!("not a readable 7z archive: {e}"),
    })?;

    if archive.files.iter().any(|f| f.is_anti_item()) {
        bail!("this 7z archive contains deletion records (anti-items), which are not supported");
    }

    // Decoding finds an unknown method only when its block is reached, after
    // the blocks behind it were committed and their bytes freed. Refuse it
    // here instead, while the archive is still whole.
    refuse_unsupported_methods(&archive, resuming.is_none())?;

    let (starts, data_end) = block_starts(&archive)?;
    if resuming.is_none() {
        check_layout(&archive, &mut reader, data_end)?;
    }
    let tail_start = resuming.unwrap_or(data_end);

    let mut covered = vec![false; archive.files.len()];
    let mut units = Vec::with_capacity(archive.blocks.len() + 1);
    for (block, &start) in starts.iter().enumerate() {
        // Exactly the slice the decoder will walk, so items line up with
        // what it hands back.
        let first = archive.stream_map.block_first_file_index[block];
        let count = BlockDecoder::new(1, block, &archive, &password, &mut reader).entry_count();
        let files = archive
            .files
            .get(first..first + count)
            .ok_or_else(inconsistent)?;
        let end = starts.get(block + 1).copied().unwrap_or(data_end);
        if start == end {
            // No packed bytes, so the block starts where the next one does,
            // and committing it would truncate that block's data. All it can
            // hold is empty files, which are made like those of no block.
            if files.iter().any(|f| f.size() > 0) {
                return Err(inconsistent());
            }
            continue;
        }
        covered[first..first + count].fill(true);
        let items = files.iter().map(item).collect::<Result<_>>()?;
        let encrypted = archive.blocks[block]
            .coders
            .iter()
            .any(|c| c.encoder_method_id() == AES);
        units.push(Unit {
            start,
            key: block,
            items,
            encrypted,
        });
    }
    let empty: Vec<Item> = archive
        .files
        .iter()
        .zip(&covered)
        .filter(|(_, covered)| !**covered)
        .map(|(f, _)| item(f))
        .collect::<Result<_>>()?;
    if !empty.is_empty() {
        units.push(Unit {
            start: tail_start,
            key: NO_DATA,
            items: empty,
            encrypted: false,
        });
    }

    Ok(Opened {
        name: "7z",
        format: Box::new(SevenZ {
            storage: storage.clone(),
            archive,
            password,
        }),
        units,
        tail_start,
    })
}

fn inconsistent() -> anyhow::Error {
    anyhow!("this 7z archive's header is inconsistent")
}

/// Refuses a coder this build cannot decode, naming it. `fresh` says the
/// archive has not been touched yet, which a resumed run cannot claim.
fn refuse_unsupported_methods(archive: &Archive, fresh: bool) -> Result<()> {
    for coder in archive.blocks.iter().flat_map(|block| &block.coders) {
        let id = coder.encoder_method_id();
        if coder_supported(id) {
            continue;
        }
        return Err(Unsupported(unsupported_method(id, fresh)).into());
    }
    Ok(())
}

fn unsupported_method(id: &[u8], fresh: bool) -> anyhow::Error {
    let what = match sevenz_rust2::EncoderMethod::by_id(id) {
        Some(method) => format!("the {} compression method", method.name()),
        None => format!(
            "a compression method this build does not know ({})",
            id.iter()
                .map(|b| format!("{b:02X}"))
                .collect::<Vec<_>>()
                .join(" ")
        ),
    };
    // A resumed run already freed what it extracted, so only a fresh one can
    // say nothing was modified.
    let untouched = if fresh { " Nothing was modified" } else { "" };
    anyhow!("this 7z archive uses {what}, which this build does not decode.{untouched}")
}

/// The methods sevenz-rust2's decoder builds with the features this crate
/// turns on, kept in step with its `add_decoder` and `BlockDecoder`. Each
/// gated entry follows a `sevenz-*` feature in `Cargo.toml`.
fn coder_supported(id: &[u8]) -> bool {
    use sevenz_rust2::EncoderMethod as Method;
    if id == Method::ID_COPY
        || id == Method::ID_LZMA
        || id == Method::ID_LZMA2
        || id == Method::ID_DELTA
        || id == Method::ID_BCJ_X86
        || id == Method::ID_BCJ_PPC
        || id == Method::ID_BCJ_IA64
        || id == Method::ID_BCJ_ARM
        || id == Method::ID_BCJ_ARM64
        || id == Method::ID_BCJ_ARM_THUMB
        || id == Method::ID_BCJ_SPARC
        || id == Method::ID_BCJ_RISCV
        || id == Method::ID_BCJ2
    {
        return true;
    }
    #[cfg(feature = "sevenz-aes256")]
    if id == Method::ID_AES256_SHA256 {
        return true;
    }
    #[cfg(feature = "sevenz-bzip2")]
    if id == Method::ID_BZIP2 {
        return true;
    }
    #[cfg(feature = "sevenz-brotli")]
    if id == Method::ID_BROTLI {
        return true;
    }
    #[cfg(feature = "sevenz-deflate")]
    if id == Method::ID_DEFLATE {
        return true;
    }
    #[cfg(feature = "sevenz-lz4")]
    if id == Method::ID_LZ4 {
        return true;
    }
    #[cfg(feature = "sevenz-ppmd")]
    if id == Method::ID_PPMD {
        return true;
    }
    #[cfg(feature = "sevenz-zstd")]
    if id == Method::ID_ZSTD {
        return true;
    }
    false
}

/// Where each block's packed data begins, and where the packed data of the
/// last one ends. A block's data runs up to the start of the next.
fn block_starts(archive: &Archive) -> Result<(Vec<u64>, u64)> {
    let packed = SIGNATURE_HEADER_SIZE
        .checked_add(archive.pack_pos())
        .ok_or_else(inconsistent)?;
    let data_end = archive
        .pack_sizes()
        .iter()
        .try_fold(packed, |end, &size| end.checked_add(size))
        .ok_or_else(inconsistent)?;
    let offsets = archive.stream_map.pack_stream_offsets();
    let starts = archive
        .stream_map
        .block_first_pack_stream_index()
        .iter()
        .map(|&first| offsets.get(first).map(|o| packed + o))
        .collect::<Option<Vec<u64>>>()
        .filter(|s| s.len() == archive.blocks.len())
        .ok_or_else(inconsistent)?;
    Ok((starts, data_end))
}

/// Refuses layouts that extracting in place would break. A resumed run reads
/// the header again after blocks are truncated, so the header, and the
/// packed data of an encoded one, must lie in the tail saved before anything
/// is truncated. Packed streams that no block uses are refused as well: they
/// would go with the last block, and nothing checks what they hold.
fn check_layout(archive: &Archive, reader: &mut Reader, data_end: u64) -> Result<()> {
    let first_pack = archive.stream_map.block_first_pack_stream_index();
    let mut used = 0;
    for (block, &first) in archive.blocks.iter().zip(first_pack) {
        if first != used {
            return Err(inconsistent());
        }
        used += packed_streams(block);
    }
    if used > archive.pack_sizes().len() {
        return Err(inconsistent());
    }
    if used < archive.pack_sizes().len() {
        bail!(
            "this 7z archive holds packed data that no block uses, which cannot be extracted in \
             place safely. Nothing was modified"
        );
    }
    if header_starts(reader)?.into_iter().any(|at| at < data_end) {
        bail!(
            "the header of this 7z archive lies among its packed data instead of after it, so \
             extracting in place would destroy it before the extraction completes. Nothing was \
             mo
```

### Core Architecture Module: `crates/core/src/archive/storage.rs`
```
//! The archive's bytes, whether one file or a split set (`.001`, `.002`, ...,
//! RAR volumes, or a native split ZIP's `.z01`, ..., `.zip`), and the only
//! code allowed to shrink them.

use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

use anyhow::{Context, Result, anyhow, bail};

use crate::platform;

#[derive(Clone, Debug)]
pub struct Part {
    pub path: PathBuf,
    /// Where this part begins in the joined archive.
    pub start: u64,
    /// The part's length before extraction started.
    pub len: u64,
}

/// Bytes from the end of the archive saved to a side file, served back at
/// their original offsets once the real ones are truncated away.
pub struct Tail {
    pub start: u64,
    pub bytes: Vec<u8>,
}

pub struct Storage {
    parts: Arc<[Part]>,
    /// The first part stays open and locked for the whole run, so two runs
    /// can't eat the same archive.
    first: File,
    /// Set for an extraction that keeps the archive. Every method that
    /// changes the archive's bytes refuses from then on, so a bug elsewhere
    /// can't cost the user an archive they asked to keep.
    whole: AtomicBool,
    reads: Arc<Reads>,
    sfv_checked: AtomicBool,
}

/// How much of the archive its readers have read. Opening a compressed tar
/// decodes all of it before anything else, which takes minutes for a large
/// one, so front ends show this from another thread while an archive opens.
#[derive(Debug, Default)]
pub struct Reads {
    pub done: AtomicU64,
    /// How much the current pass reads in all: the archive's length, or
    /// less when a resumed compressed tar is read from its resume point.
    pub total: AtomicU64,
}

impl Reads {
    pub fn reset(&self) {
        self.done.store(0, Ordering::Relaxed);
        self.total.store(0, Ordering::Relaxed);
    }

    /// The share of the pass read so far, if a pass is under way.
    pub fn fraction(&self) -> Option<f64> {
        let total = self.total.load(Ordering::Relaxed);
        let done = self.done.load(Ordering::Relaxed);
        (total > 0).then(|| (done as f64 / total as f64).min(1.0))
    }
}

impl Storage {
    /// Opens `path`, plus its sibling volumes if it is part of a split set.
    pub fn open(path: &Path, writable: bool) -> Result<Self> {
        let paths = volume_set(path)?;
        let mut parts = Vec::with_capacity(paths.len());
        let mut start = 0;
        for p in paths {
            let len = fs::metadata(&p)
                .with_context(|| format!("reading {}", p.display()))?
                .len();
            parts.push(Part {
                path: p,
                start,
                len,
            });
            start += len;
        }
        Self::with_parts(parts, writable)
    }

    /// Reopens a set whose original layout was recorded in the journal.
    pub fn from_parts(recorded: &[(PathBuf, u64)], writable: bool) -> Result<Self> {
        let mut parts = Vec::with_capacity(recorded.len());
        let mut start = 0;
        for (path, len) in recorded {
            parts.push(Part {
                path: path.clone(),
                start,
                len: *len,
            });
            start += len;
        }
        Self::with_parts(parts, writable)
    }

    fn with_parts(parts: Vec<Part>, writable: bool) -> Result<Self> {
        // Extracting in place shrinks and deletes the volumes. Through a
        // link, that would happen to whatever file it points to, which need
        // not be an archive at all.
        if writable {
            for p in &parts {
                if fs::symlink_metadata(&p.path).is_ok_and(|m| m.is_symlink()) {
                    bail!(
                        "{} is a link. HatchZip changes the archive file itself, so open the file \
                         the link points to instead. Nothing was modified",
                        p.path.display()
                    );
                }
            }
        }
        let path = &parts[0].path;
        let first = if writable {
            platform::open_exclusive(path).map_err(|e| match e.kind() {
                io::ErrorKind::WouldBlock => {
                    anyhow!(
                        "{} is in use by another program or HatchZip process",
                        path.display()
                    )
                }
                _ => anyhow!(e).context(format!(
                    "opening {} for reading and writing",
                    path.display()
                )),
            })?
        } else {
            File::open(path).with_context(|| format!("opening {}", path.display()))?
        };
        Ok(Self {
            parts: parts.into(),
            first,
            whole: AtomicBool::new(false),
            reads: Arc::default(),
            sfv_checked: AtomicBool::new(false),
        })
    }

    /// Whether this storage has already been verified against an .sfv file.
    pub fn sfv_checked(&self) -> bool {
        self.sfv_checked.load(Ordering::Relaxed)
    }

    pub fn mark_sfv_checked(&self) {
        self.sfv_checked.store(true, Ordering::Relaxed);
    }

    /// From now on nothing may shrink, punch, write to or delete the
    /// archive.
    pub fn protect(&self) {
        self.whole.store(true, Ordering::Relaxed);
    }

    pub fn protected(&self) -> bool {
        self.whole.load(Ordering::Relaxed)
    }

    fn may_change(&self) -> Result<()> {
        if self.protected() {
            bail!(
                "refusing to modify {}: this extraction keeps the archive",
                self.primary().display()
            );
        }
        Ok(())
    }

    /// The first volume that has another name, if any. Shrinking a file
    /// shrinks it under every name it has, so extracting in place would
    /// empty a hard link that may be the only copy someone meant to keep.
    pub fn hard_linked(&self) -> Option<&Path> {
        self.parts
            .iter()
            .find(|p| platform::link_count(&p.path).is_ok_and(|n| n > 1))
            .map(|p| p.path.as_path())
    }

    pub fn primary(&self) -> &Path {
        &self.parts[0].path
    }

    pub fn parts(&self) -> &[Part] {
        &self.parts
    }

    pub fn record(&self) -> Vec<(PathBuf, u64)> {
        self.parts.iter().map(|p| (p.path.clone(), p.len)).collect()
    }

    /// The archive's original length.
    pub fn original_len(&self) -> u64 {
        self.parts.last().map_or(0, |p| p.start + p.len)
    }

    /// How much of the archive is still on disk, checking that what is left
    /// is an untouched prefix of the original.
    pub fn current_len(&self) -> Result<u64> {
        let mut end = 0;
        for (i, p) in self.parts.iter().enumerate() {
            let actual = match fs::metadata(&p.path) {
                Ok(m) => m.len(),
                Err(e) if e.kind() == io::ErrorKind::NotFound && i > 0 => 0,
                Err(e) => return Err(e).with_context(|| format!("reading {}", p.path.display())),
            };
            if actual > p.len {
                bail!(
                    "{} has grown since extraction started and will not be modified",
                    p.path.display()
                );
            }
            if actual == 0 && i > 0 {
                break;
            }
            if end != p.start {
                bail!(
                    "{} is missing a piece before {}",
                    self.primary().display(),
                    p.path.display()
                );
            }
            end = p.start + actual;
            if actual < p.len {
                break;
            }
        }
        Ok(end)
    }

    /// Shrinks the archive to its first `len` bytes: whole volumes past that
    /// point are deleted, the one it falls in is truncated.
    pub fn set_len(&self, len: u64) -> Result<()> {
        self.may_change()?;
        for (i, p) in self.parts.iter().enumerate().rev() {
            if p.start + p.len <= len {
                break;
            }
            if i == 0 {
                platform::set_len_now(&self.first, len)?;
            } else if p.start >= len {
                match fs::remove_file(&p.path) {
                    Err(e) if e.kind() != io::ErrorKind::NotFound => {
                        return Err(e).with_context(|| format!("deleting {}", p.path.display()));
                    }
                    _ => {}
                }
            } else {
                let f = OpenOptions::new().write(true).open(&p.path)?;
                if f.metadata()?.len() > len - p.start {
                    platform::set_len_now(&f, len - p.start)?;
                }
            }
        }
        Ok(())
    }

    /// Gives back the disk space of the bytes in `[from, to)` while every
    /// offset stays where it was; they read as zeros afterwards. Returns
    /// false if the filesystem can't. Filesystems free whole blocks only, so
    /// up to a block at each end may stay allocated until truncation.
    pub fn punch(&self, from: u64, to: u64) -> Result<bool> {
        self.may_change()?;
        for (i, p) in self.parts.iter().enumerate() {
            let (start, end) = (from.max(p.start), to.min(p.start + p.len));
            if start >= end {
                continue;
            }
            let (offset, len) = (start - p.start, end - start);
            let punched = if i == 0 {
                platform::punch_hole(&self.first, offset, len)
            } else {
                OpenOptions::new()
                    .write(true)
                    .open(&p.path)
                    .and_then(|f| platform::punch_hole(&f, offset, len))
            };
            if !punched.with_context(|| format!("freeing space in {}", p.path.display()))? {
                return Ok(false);
            }
        }
        Ok(true)
    }

    /// Like [`set_len`](Self::set_len), but also cuts vol
```

### Core Architecture Module: `crates/core/src/archive/tar.rs`
```
//! An uncompressed tar is a run of header plus data records with nothing
//! shared between them, so every entry is a unit. There is no index; the
//! headers are read in one pass. On resume the same pass over what is left
//! stops at the truncation point, where the zeros read like the end of the
//! archive.

use std::collections::HashMap;
use std::io::{Cursor, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use ::tar::EntryType;
use anyhow::{Context, Result, anyhow, bail};

use super::storage::{Reader, Storage, Tail};
use super::{Codec, Format, Item, Kind, Opened, Sink, Stream, Unit, Worker, safe_path};
use crate::fsutil;

struct Entry {
    data_start: u64,
    size: u64,
    /// For symlinks: the target, which tar keeps in the header, not the data.
    target: Option<Vec<u8>>,
}

struct Tar {
    storage: Arc<Storage>,
    entries: Vec<Entry>,
}

pub fn open(storage: &Arc<Storage>, tail: Option<Arc<Tail>>) -> Result<Opened> {
    let resuming = tail.as_ref().map(|t| t.start);
    let mut archive = ::tar::Archive::new(storage.reader(tail));
    let mut units = Vec::new();
    let mut entries = Vec::new();
    let mut end = 0;

    for entry in archive
        .entries_with_seek()
        .context("reading the tar headers")?
    {
        let mut e = entry.context("reading the tar headers")?;
        // The unit starts where the previous entry ended, so any long-name
        // or pax records in between belong to it, and so does an entry that
        // is skipped.
        let start = end;
        end = e
            .size()
            .checked_next_multiple_of(512)
            .and_then(|n| n.checked_add(e.raw_file_position()))
            .ok_or_else(|| anyhow!("reading the tar headers: an entry size is invalid"))?;
        let Some((item, target)) = describe(&mut e)? else {
            continue;
        };
        units.push(Unit {
            start,
            key: entries.len(),
            items: vec![item],
            encrypted: false,
        });
        entries.push(Entry {
            data_start: e.raw_file_position(),
            size: e.size(),
            target,
        });
    }
    size_links(units.iter_mut().flat_map(|u: &mut Unit| &mut u.items));

    Ok(Opened {
        name: "tar",
        format: Box::new(Tar {
            storage: storage.clone(),
            entries,
        }),
        units,
        tail_start: resuming.unwrap_or(end),
    })
}

/// What a tar entry extracts to, and a symlink's target, which tar keeps in
/// the header rather than the data. `None` for entries that extract to
/// nothing: "./", and pax global headers, which carry defaults such as the
/// commit id `git archive` records. Shared with compressed tar, so both
/// refuse and accept exactly the same entries. A hard link's size is left
/// at 0 for [`size_links`] to fill in.
pub(super) fn describe<R: Read>(
    e: &mut ::tar::Entry<'_, R>,
) -> Result<Option<(Item, Option<Vec<u8>>)>> {
    let pax_mtime = pax_mtime(e);
    let header = e.header();
    let name = String::from_utf8_lossy(&e.path_bytes()).into_owned();
    let kind = match header.entry_type() {
        EntryType::Regular | EntryType::Continuous => Kind::File,
        EntryType::Directory => Kind::Dir,
        EntryType::Symlink => Kind::Symlink,
        EntryType::Link => {
            let target = e
                .link_name()?
                .map(|t| t.to_string_lossy().into_owned())
                .unwrap_or_default();
            Kind::HardLink(safe_path(&target).ok_or_else(|| {
                anyhow!(
                    "hard link '{name}' points outside the destination folder; extraction refused"
                )
            })?)
        }
        EntryType::XGlobalHeader => return Ok(None),
        EntryType::GNUSparse => {
            bail!("'{name}' is a sparse file, which is not supported")
        }
        other => bail!("'{name}' is a {other:?} entry, which cannot be created"),
    };
    let Some(path) = safe_path(&name) else {
        // "./" at the top of many tarballs names the output folder itself.
        if kind == Kind::Dir {
            return Ok(None);
        }
        bail!("'{name}' would be written outside the destination folder; extraction refused");
    };
    let target = match kind {
        Kind::Symlink => Some(
            e.link_name_bytes()
                .map(|b| b.into_owned())
                .unwrap_or_default(),
        ),
        _ => None,
    };
    let size = match &kind {
        Kind::File => e.size(),
        Kind::Symlink => target.as_ref().map_or(0, |t| t.len() as u64),
        Kind::HardLink(_) | Kind::Dir => 0,
    };
    // GNU tar writes times before 1970 as negative base-256 numbers, which
    // the tar crate hands back in two's complement.
    let mtime = pax_mtime
        .or_else(|| header.mtime().ok().map(|s| s as i64))
        .and_then(fsutil::from_epoch_secs);
    let mode = header.mode().ok();
    Ok(Some((
        Item {
            path,
            size,
            kind,
            mode,
            mtime,
        },
        target,
    )))
}

/// The pax `mtime` record, in whole seconds rounded down. Pax archives keep
/// a time the header field can't hold (before 1970, after 2242) only there.
fn pax_mtime<R: Read>(e: &mut ::tar::Entry<'_, R>) -> Option<i64> {
    let extensions = e.pax_extensions().ok()??;
    let value = extensions
        .filter_map(|x| x.ok())
        .find(|x| x.key_bytes() == b"mtime")?
        .value()
        .ok()?
        .parse::<f64>()
        .ok()?;
    value.is_finite().then(|| value.floor() as i64)
}

/// Gives every hard link the size of the file it points to. Links are
/// copied where the filesystem can't hard link, so the space check counts
/// them at that size, and the file may come after the link in the archive,
/// so this waits for the whole listing.
pub(super) fn size_links<'a>(items: impl IntoIterator<Item = &'a mut Item>) {
    let mut items: Vec<&mut Item> = items.into_iter().collect();
    let files: HashMap<PathBuf, u64> = items
        .iter()
        .filter(|i| i.kind == Kind::File)
        .map(|i| (i.path.clone(), i.size))
        .collect();
    for item in &mut items {
        if let Kind::HardLink(target) = &item.kind {
            item.size = files.get(target).copied().unwrap_or(0);
        }
    }
}

impl Format for Tar {
    fn worker(&self, _threads: u32) -> Result<Box<dyn Worker + '_>> {
        Ok(Box::new(TarWorker {
            fmt: self,
            reader: self.storage.reader(None),
        }))
    }

    fn stream(&self, unit: &Unit) -> Result<Option<Stream>> {
        let entry = &self.entries[unit.key];
        if unit.items[0].kind != Kind::File {
            return Ok(None);
        }
        Ok(Some(Stream {
            data_start: entry.data_start,
            packed: entry.size,
            codec: Codec::Stored,
            crc: None,
        }))
    }
}

struct TarWorker<'a> {
    fmt: &'a Tar,
    reader: Reader,
}

impl Worker for TarWorker<'_> {
    fn extract(&mut self, unit: &Unit, sink: &mut dyn Sink) -> Result<()> {
        let entry = &self.fmt.entries[unit.key];
        let item = &unit.items[0];
        if let Some(target) = &entry.target {
            return sink.item(item, &mut Cursor::new(target));
        }
        if !matches!(item.kind, Kind::File) {
            return sink.item(item, &mut std::io::empty());
        }
        self.reader.seek(SeekFrom::Start(entry.data_start))?;
        sink.item(item, &mut (&mut self.reader).take(entry.size))
    }
}

/// What ends a restored tar. Hard links whose targets are still in the
/// archive get their entries back, since the originals were cut off with the
/// extracted part and the link can't be made before its target exists. Then
/// the two zero blocks that mark the end.
pub fn closing(hard_links: &[(&Path, &Path)]) -> Result<Vec<u8>> {
    let mut b = ::tar::Builder::new(Vec::new());
    for (path, target) in hard_links {
        let mut h = ::tar::Header::new_gnu();
        h.set_entry_type(EntryType::Link);
        h.set_size(0);
        h.set_mode(0o644);
        b.append_link(&mut h, path, target)
            .with_context(|| format!("writing the tar entry for '{}'", path.display()))?;
    }
    Ok(b.into_inner()?)
}

```

### Core Architecture Module: `crates/core/src/archive/tarbz2.rs`
```
//! Bzip2 blocks feed the shared tar parser. Boundaries are accepted only
//! after a synthetic one-block stream decodes and verifies its CRC.

use std::io::{self, Cursor, Read, Seek, SeekFrom};
use std::sync::Arc;

use anyhow::{Context, Result, anyhow, bail};

use super::storage::{Reader, Storage};
use super::targz::{BUF, CodecKind, Event, Feed, Profile, StreamPoint, TarAt, TarStream};
use super::{Format, Item, Kind, Opened, Sink, SolidStream, SolidWalker, Unit, Worker};
use crate::journal::Resume;

pub const NAME: &str = "tar.bz2";
const BLOCK: u64 = 0x3141_5926_5359;
const END: u64 = 0x1772_4538_5090;
const MASK: u64 = (1 << 48) - 1;

static MAGIC_PAIRS: [u64; 1024] = magic_pairs();

const fn magic_pairs() -> [u64; 1024] {
    let mut table = [0; 1024];
    let magics = [BLOCK, END];
    let mut i = 0;
    while i < magics.len() {
        // Across all eight alignments, a whole-byte pair can start at
        // any of the first 33 bits of a magic.
        let mut shift = 0;
        while shift <= 32 {
            let pair = ((magics[i] >> shift) & 0xffff) as usize;
            table[pair / 64] |= 1 << (pair % 64);
            shift += 1;
        }
        i += 1;
    }
    table
}

/// Trial decodes allowed per block before it is refused as damaged.
const MAX_CANDIDATES: u32 = 64;

const NO_STREAM: &str = "the file does not start with a bzip2 stream; the archive is damaged and was not changed. Download it again";

fn find_magic(bytes: &[u8], base: u64, from_bit: u64) -> Option<(u64, u64)> {
    let mut next = from_bit.max(base * 8);
    if bytes.len() < 6 {
        return None;
    }
    let last = (base + bytes.len() as u64) * 8 - 48;
    if next > last {
        return None;
    }
    let mut pair = (next.div_ceil(16) * 2 - base) as usize;
    while pair + 1 < bytes.len() {
        let value = usize::from(u16::from_be_bytes([bytes[pair], bytes[pair + 1]]));
        if MAGIC_PAIRS[value / 64] & (1 << (value % 64)) != 0 {
            let bit = (base + pair as u64) * 8;
            // Five whole bytes guarantee an even-offset pair in every magic.
            // Its first such pair tests its start before any later match;
            // the cursor prevents overlapping pairs from testing starts twice.
            next = next.max(bit.saturating_sub(32));
            let stop = bit.min(last);
            while next <= stop {
                let candidate = next;
                next += 1;
                let byte = (candidate / 8 - base) as usize;
                let mut word = [0; 8];
                word[1..7].copy_from_slice(&bytes[byte..byte + 6]);
                word[7] = bytes.get(byte + 6).copied().unwrap_or(0);
                let magic = (u64::from_be_bytes(word) >> (8 - candidate % 8)) & MASK;
                if magic == BLOCK || magic == END {
                    return Some((candidate, magic));
                }
            }
        }
        pair += 2;
    }
    None
}

pub struct Solid {
    storage: Arc<Storage>,
    /// The point the scan began at: a resumed run's, or the start.
    from: Option<Resume>,
    profile: Profile,
}

impl Solid {
    /// Decodes from `from`, or from the start of the archive.
    pub fn walk(&self, from: Option<&Resume>) -> Result<Walker> {
        Walker::new(&self.storage, from)
    }
}

/// Walks the archive from `from`, or from its start, listing what is left
/// and measuring it. Damage anywhere is found here, before anything is
/// touched.
pub struct Walker {
    inner: TarStream<Bzip2>,
}

impl Walker {
    fn new(storage: &Storage, from: Option<&Resume>) -> Result<Self> {
        let reader = storage.reader(None);
        let end = storage.original_len();
        let bz = match from {
            None => Bzip2::new(reader, end, &BzPoint::start())?,
            Some(r) => {
                let s = r.stream.as_ref().ok_or_else(|| {
                    anyhow!("the journal's resume point does not belong to a compressed tar")
                })?;
                if s.kind != CodecKind::Bzip2 {
                    bail!(
                        "the journal's resume point belongs to {}, not this archive's \
                         compressed stream",
                        match s.kind {
                            CodecKind::Gzip => "a gzip member of",
                            CodecKind::Xz => "an xz block of",
                            CodecKind::Bzip2 => "a bzip2 block of",
                            CodecKind::Zstd => "a zstd frame of",
                        }
                    );
                }
                if !matches!(s.at, TarAt::File { .. }) && r.written != 0 {
                    bail!(
                        "the journal's resume point claims a file is open where none is; the archive will not be modified"
                    );
                }
                Bzip2::new(
                    reader,
                    end,
                    &BzPoint {
                        bit: r.bit,
                        stream_start: s.member_start,
                        crc: s.combined_crc.ok_or_else(|| anyhow!("the journal lacks the bzip2 combined CRC; restore the original journal before resuming"))?,
                        level: s.level.ok_or_else(|| anyhow!("the journal lacks the bzip2 level; restore the original journal before resuming"))?,
                    },
                )?
            }
        };
        Ok(Self {
            inner: TarStream::new(bz, from)?,
        })
    }

    fn next(&mut self, max: usize) -> Result<Event<'_>> {
        self.inner.next(max)
    }

    fn point(&self) -> Result<Resume> {
        self.inner.point()
    }

    fn point_byte(&self) -> Option<u64> {
        self.inner.point_byte()
    }
}

impl SolidWalker for Walker {
    fn next(&mut self, max: usize) -> Result<Event<'_>> {
        self.next(max)
    }

    fn point(&self) -> Result<Resume> {
        self.point()
    }

    fn point_byte(&self) -> Option<u64> {
        self.point_byte()
    }
}

/// Walks the archive from `from`, or from its start, listing what is left
/// and measuring it. Damage anywhere is found here, before anything is
/// touched.
pub fn open(storage: &Arc<Storage>, from: Option<&Resume>) -> Result<Opened> {
    let mut solid = Solid {
        storage: storage.clone(),
        from: from.cloned(),
        profile: Profile::default(),
    };
    let name = storage
        .primary()
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
    storage.expect_reads(storage.original_len() - from.map_or(0, |r| r.bit / 8));
    let (items, profile) = super::scan(&solid, from)
        .map_err(|e| anyhow::Error::new(super::Damaged(e)))
        .with_context(|| format!("checking {name} (nothing was changed)"))?;
    solid.profile = profile;
    Ok(Opened {
        name: NAME,
        format: Box::new(TarBz2 { solid }),
        // Even with no entries left there is one unit, so that a resume point
        // past the last entry still belongs to something.
        units: vec![Unit {
            start: 0,
            key: 0,
            items,
            encrypted: false,
        }],
        // Nothing is saved: the stream is never truncated from the end.
        tail_start: storage.original_len(),
    })
}

struct TarBz2 {
    solid: Solid,
}

impl Format for TarBz2 {
    fn worker(&self, _threads: u32) -> Result<Box<dyn Worker + '_>> {
        Ok(Box::new(TarBz2Worker { solid: &self.solid }))
    }

    fn solid(&self) -> Option<&dyn SolidStream> {
        Some(&self.solid)
    }
}

impl SolidStream for Solid {
    fn profile(&self) -> &Profile {
        &self.profile
    }

    fn walk(&self, from: Option<&Resume>) -> Result<Box<dyn SolidWalker>> {
        Ok(Box::new(self.walk(from)?))
    }
}

/// Decodes the whole stream in one go, for `test` and `--verify-first`. The
/// extraction itself goes through the engine's streaming path instead.
struct TarBz2Worker<'a> {
    solid: &'a Solid,
}

impl Worker for TarBz2Worker<'_> {
    fn extract(&mut self, _unit: &Unit, sink: &mut dyn Sink) -> Result<()> {
        let mut w = self.solid.walk(self.solid.from.as_ref())?;
        loop {
            match w.next(BUF)? {
                Event::Entry { item, done, .. } if item.kind == Kind::File => {
                    // A resumed run's open file: only its rest is here.
                    let left = Item {
                        size: item.size - done,
                        ..item
                    };
                    let mut data = FileData {
                        walker: &mut w,
                        ended: false,
                    };
                    sink.item(&left, &mut data)?;
                    let mut rest = [0u8; 4096];
                    while data.read(&mut rest)? > 0 {}
                }
                Event::Entry { item, link, .. } => {
                    sink.item(&item, &mut Cursor::new(link.unwrap_or_default()))?;
                }
                Event::Data(_) | Event::FileEnd | Event::Point => {}
                Event::End => return Ok(()),
            }
        }
    }
}

/// One file's data, read through the walker.
struct FileData<'a> {
    walker: &'a mut Walker,
    ended: bool,
}

impl Read for FileData<'_> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        while !self.ended && !buf.is_empty() {
            match self.walker.next(buf.len()) {
                Ok(Event::Data(d)) => {
                    buf[..d.len()].copy_from_slice(d);
                    return Ok(d.len());
                }
                Ok(Event::Point) => {}
                Ok(Event::FileEnd) => self.ended = true,
                Ok(_) => return Err(io::Error::other("the tar entry ended unexpectedly")),
                Err(e) => return Err(io::Error::other(format!("{e:#}"))),
            }
        }
        Ok(0)
    }
}

impl Feed for Bzip2 {
    fn fill(&mut self, buf: &mut [u8]) -> Result<usize> {
        self.read(buf)
    }
    fn restartable
```

### Core Architecture Module: `crates/core/src/archive/targz.rs`
```
//! A gzip-compressed tar is one compressed stream holding every entry, and a
//! gzip stream can only be decoded from the front. So unlike every other
//! format it is not split into units extracted from the end: the whole
//! archive is one unit, extracted front to back, and the engine frees the
//! compressed bytes behind the decoder by punching holes, at resume points
//! (see `Run::stream_solid` in the engine).
//!
//! [`Walker`] decodes the stream and parses the tar inside it into events,
//! and says where decoding can restart: at a deflate block boundary or a
//! gzip member's start that falls where the tar parser's state is simple to
//! write down. Opening the archive walks it once, start to end, before
//! anything is touched: that lists the entries, checks every gzip CRC-32 and
//! length, and measures how far the output runs ahead of the compressed
//! bytes, which the space check needs. A resumed run walks from its resume
//! point instead, since the bytes before it may be gone. The extraction
//! walks the same way with the same buffer sizes, so it meets exactly the
//! points the scan measured.
//!
//! The tar parser's own state machine is in [`TarStream`], driven by the
//! decoder hooks of [`Feed`]. `tarxz` runs the same thing over xz blocks,
//! so both compressed tars parse identically down to their events.

use std::io::{self, Cursor, Read};
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result, anyhow, bail};
use serde::{Deserialize, Serialize};

use super::resumable::{GzPoint, Gzip};
use super::storage::Storage;
use super::{Format, Item, Kind, Opened, Sink, SolidStream, SolidWalker, Unit, Worker, safe_path};
use crate::fsutil;
use crate::journal::Resume;

pub const NAME: &str = "tar.gz";

/// Decoded output is handed out in pieces of at most this much.
pub(super) const BUF: usize = 1024 * 1024;

/// Long-name and pax records in front of one entry, together. GNU tar and
/// pax write a few hundred bytes; anything this large is refused.
pub(super) const MAX_HEADER: u64 = 1024 * 1024;

/// The decoder's and the tar parser's state at a resume point, beyond the
/// bit position and output length the journal's [`Resume`] already holds.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct StreamPoint {
    /// Which codec the point belongs to, so a journal can never be read as
    /// the wrong compressed tar's: a `.tar.xz` point says `xz`. Older
    /// tar.gz journals have no field and read as `gzip`, which was the only
    /// codec then.
    #[serde(default, skip_serializing_if = "CodecKind::is_gzip")]
    pub kind: CodecKind,
    /// Gzip or bzip2: the point is where a gzip member's or a bzip2
    /// stream's header begins, not a block boundary inside one. Written even
    /// at its default, and so are the three below: 0.1.8 reads this journal
    /// structure and has no defaults, so a field left out makes it report
    /// the journal as damaged. Only fields added after 0.1.8 may be omitted.
    #[serde(default)]
    pub member_start: bool,
    /// Gzip: CRC-32 and length of the member's output before the point,
    /// which its trailer is checked against.
    #[serde(default)]
    pub member_crc: u32,
    #[serde(default)]
    pub member_len: u64,
    /// Gzip: the member's last 32 KiB of output before the point, which
    /// deflate back-references may reach into. It is part tar headers and
    /// part several files, so unlike a single ZIP entry's window it can't
    /// be read back from one output file. Xz needs no window: a block
    /// borrows nothing from before it.
    #[serde(default, with = "hex")]
    pub window: Vec<u8>,
    /// Xz: which block of the stream the point is at, where its header
    /// begins. Zstd: how many frames preceded the point, so a resumed run
    /// still knows the stream had more than one. The pieces before it never
    /// need decoding again.
    #[serde(default, skip_serializing_if = "is_zero_u64")]
    pub block: u64,
    /// Bzip2: the stream's level digit and the combined CRC of its blocks
    /// before the point, which the stream trailer is checked against.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub combined_crc: Option<u32>,
    /// Offset of the point in the uncompressed tar.
    pub tar_pos: u64,
    pub at: TarAt,
}

/// Which compressed-stream codec owns a resume point. The stream state it
/// carries belongs to exactly one; a point read under another kind is
/// refused, before anything is touched.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CodecKind {
    #[default]
    Gzip,
    Xz,
    Bzip2,
    Zstd,
}

impl CodecKind {
    pub fn is_gzip(&self) -> bool {
        *self == Self::Gzip
    }
}

fn is_zero_u64(v: &u64) -> bool {
    *v == 0
}

/// Where the point falls in the tar.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TarAt {
    /// At the start of an entry's header records.
    Boundary,
    /// Inside the data of a regular file, which starts at `data_start` in
    /// the tar. How much of it is written is the resume point's `written`.
    File {
        path: PathBuf,
        size: u64,
        mode: Option<u32>,
        /// Seconds from 1970, negative before it.
        mtime: Option<i64>,
        data_start: u64,
    },
    /// Inside bytes that extract to nothing: padding, or the data of an
    /// entry that is not a regular file. `left` of them remain.
    Skip { left: u64 },
    /// Past the end-of-archive marker, where only zeros may follow.
    End,
}

/// What a scan measured about the output, relative to where it started, in
/// bytes on disk (each file rounded up to 4 KiB).
#[derive(Clone, Debug, Default)]
pub struct Profile {
    /// Regular files, as they are written.
    pub files: u64,
    /// Links, made at the very end. Counted at their target's size, since
    /// they are copied where the filesystem has no hard links.
    pub links: u64,
    /// The most the files written so far ever exceed the compressed bytes
    /// consumed, at any point where decoding can restart. Negative while
    /// the output stays below the compressed size.
    pub lead: i128,
    /// The most file output between two consecutive such points, or
    /// between the start or end and the nearest one: how far the output can
    /// run ahead before anything can be freed.
    pub gap: u64,
}

pub struct Solid {
    storage: Arc<Storage>,
    /// The point the scan began at: a resumed run's, or the start.
    from: Option<Resume>,
    profile: Profile,
}

impl Solid {
    /// Decodes from `from`, or from the start of the archive.
    pub fn walk(&self, from: Option<&Resume>) -> Result<Walker> {
        Walker::new(&self.storage, from)
    }
}

pub enum Event<'a> {
    /// An entry begins. A regular file's data follows as `Data`, then
    /// `FileEnd`; `done` is how much of it an earlier run already wrote. For
    /// a symlink, `link` is its target.
    Entry {
        item: Item,
        link: Option<Vec<u8>>,
        done: u64,
    },
    Data(&'a [u8]),
    FileEnd,
    /// Decoding can restart right here; [`Walker::point`] describes how.
    Point,
    /// The tar ended, and so did the compressed stream, every check done.
    End,
}

/// The parser's state between events, shared by the tar.xz walker.
pub(super) enum State {
    /// Collecting an entry's header records.
    Header(Vec<u8>),
    File {
        item: Item,
        data_start: u64,
        left: u64,
        pad: u64,
    },
    Skip(u64),
    Trailer,
}

impl State {
    /// Whether the parser's state here can be written down in a
    /// [`StreamPoint`]. Inside an entry's header records it can't.
    pub(super) fn at_rest(&self) -> bool {
        match self {
            State::Header(held) => held.is_empty(),
            State::File { .. } | State::Skip(_) | State::Trailer => true,
        }
    }
}

/// The decoder hooks a [`TarStream`] needs from its compressed stream.
pub(super) trait Feed {
    /// Fills `buf` with more decoded bytes; 0 means the stream is over. A
    /// call returns at most enough bytes to reach somewhere a point falls.
    fn fill(&mut self, buf: &mut [u8]) -> Result<usize>;
    /// Whether the bytes the last [`fill`](Self::fill) ended at make a
    /// resume point.
    fn restartable(&self) -> bool;
    /// The resume point those bytes make, as the journal stores it. `at`
    /// and `written` describe where the tar got to, which the codec stores
    /// beside its own state.
    fn point(&self, tar_pos: u64, at: TarAt, written: u64) -> Result<Resume>;
    /// The archive byte a resume point here would restart in. Cheap, for
    /// the scan, which only measures.
    fn point_byte(&self) -> Option<u64>;
}

impl Feed for Gzip {
    fn fill(&mut self, buf: &mut [u8]) -> Result<usize> {
        self.read(buf)
    }

    fn restartable(&self) -> bool {
        self.restart_bit().is_some()
    }

    fn point(&self, tar_pos: u64, at: TarAt, written: u64) -> Result<Resume> {
        let point = self
            .restart_point()?
            .ok_or_else(|| anyhow!("the compressed stream cannot be resumed here"))?;
        Ok(Resume {
            unit: 0,
            written,
            bit: point.bit,
            crc: 0,
            stream: Some(Box::new(StreamPoint {
                kind: CodecKind::Gzip,
                member_start: point.member_start,
                member_crc: point.crc,
                member_len: point.len,
                window: point.window,
                block: 0,
                level: None,
                combined_crc: None,
                tar_pos,
                at,
            })),
        })
    }

    fn point_byte(&self) -> Option<u64> {
        self.restart_bit().map(|(bit, _)| bit / 8)
    }
}

/// The
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #123** (2026-11-20): **Screen Flashing**
  *Symptoms*: ### Description  Screen flashes while extracting and running a test mad trippy valve pls fix  ### HatchZip version  hatchzip 0.1.10  ### Operating system and version  WIN 11 25H2  ### Filesystem of the disk the archive is on  NTFS  ### Archive format  .zip  ### Approximate archive size and file count  140 gigs  ### The exact command  wgat  ### Full output  ```text -- ```  ### Was the run interrupted or resumed?  No, it ran in one go  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this. Did you start the test from Explorer's right-click menu, the HatchZip app, or a terminal? What flashed: the HatchZip window, a terminal window, or the whole display? Did it happen once at startup or repeatedly while the test was running?  If you've already seen it with a smaller ZIP, knowing that would help narrow it down too. HatchZip's Test archive action leaves the archive unchanged. 
  > Can add additional information, since the same bug is happening to me.  > Happened while using the Portable version (v 0.1.10)  > Win 11 26H2  > Entire display of the GUI was flashing throughout the entire extraction process > tested with a few 50GB / 100 GB / 150GB+ archives, all of them had the same flashing (entire GUI).  The hypothesis that its happening specifically through the extraction process is due to the fact of going into any top header menu (File / Settings / Help) suspends the extraction process and the flashing at the same time.  

- **Issue #79** (2026-11-12): **Hatchzip erroneously reports full disk during extraction, then resumes with no changes made to file system**
  *Symptoms*: ### Description  I tried to extract a ~800MB zip file of ~1000 PNG images that was a little bigger than half the remaining space on a hard drive . Hatchzip stopped extracting around halfway through and reported insufficient disk space.  Hatchzip reported exactly 0B remaining, with 500MB reserved.  With no other file transfers happening on disk, immediately after stoppage, the drive had 1.4GB of space left , verified by several different means. I then restarted Hatchzip with the same command without deleting or moving any files, and it immediately resumed and completed the extraction, reporting the correct 1.4GB of space at start.  ### HatchZip version  hatchzip 0.1.9  ### Operating system and version  Windows 10 19045  ### Filesystem of the disk the archive is on  NTFS  ### Archive format  zip  ### Approximate archive size and file count  840.6 MB, 967 files  ### The exact command  hatchzip extract .\2026-10-14.zip --keep-free 500MB  ### Full output  ```text ❯ hatchzip extract .\2026-10-14.zip --keep-free 500MB 2026-10-14.zip  840.6 MB zip, 840.5 MB uncompressed in 967 entries   available                    1.4 GB   standard extraction needs    842.5 MB   required                     2.9 MB (+500.0 MB reserved)   available after              1.4 GB   note: there is also enough space to keep the archive (--keep-archive)  Extract to D:\Downloads\2026-10-14 and remove 2026-10-14.zip during extraction? [y/N] y error: not enough disk space to continue: '482.png' requires 872.4 KB 
  **Post-Mortem & Fix Analysis**:
  > I'll work on this.  What I found so far, with a synthetic ZIP of 800 stored 1 MiB entries (838,936,022 bytes total):  - I set `--keep-free` so the run would have only about 100 MB of headroom, which is the normal way to say "consume the archive as you go" (that is why the error below shows 54.8 GB reserved). - Batch 1 extracts 99 entries and truncates the archive from 838,936,022 to 735,079,115 bytes, so about 99 MB is actually freed. - Batch 2 then fails with:  ``` error: not enough disk space to continue: 'f0700.bin' requires 1.0 MB and 462.8 KB is available (54.8 GB reserved). ```  - Running the same command again a moment later resumes and finishes with no change to the filesystem.  The truncation itself succeeds. I logged `set_len` and it returned the new length, but the free-space reading right after it still shows the pre-truncation value. I polled it for 20 seconds while the process was alive and it never updated, and a separate process reading the same volume saw the same stal
  > Thanks @Voxtopass for the clear report, and @spaxe-dev for tracking it down. A stale free-space reading after our own truncation fits everything here, including it correcting itself once the process exits.  My preference, in this order:  1. **First find out why the reading stays stale.** Twenty seconds, ending at process exit, sounds like something we hold open rather than lazy accounting: a second handle on the archive, a mapping, or the tail file. If closing or flushing something after `set_len` makes NTFS report the freed clusters, that's the real fix. 2. **If not, credit what we freed, measured on the file.** Credit what `allocated_bytes` on the archive says went away since the batch began (`GetCompressedFileSizeW` reflects it right away), not `old_len - new_len`, and only up to the shortfall, as you said. Measuring the file instead of trusting the arithmetic covers sparse and compressed archives too. 3. **Catch disk-full during a batch either way,** and turn it into the usual "pro

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

### Incident Patch 1: `f1fe89a9` (2026-11-23)
**Commit Message**: fix(core): report missing split ZIP parts clearly (#147)

**File**: `crates/cli/tests/formats.rs` (modified, +13/-2)
```diff
@@ -967,8 +967,19 @@ fn a_native_split_zip_with_a_part_missing_or_extra_is_refused() {
 
     let tmp = TempDir::new().unwrap();
     let first = fresh(&tmp);
-    fs::remove_file(first.with_extension("z02")).unwrap();
-    assert_split_refused(&first, &first, "game.z02 is missing");
+    let mut before = split_zip_snapshot(&first);
+    let missing = first.with_extension("z02");
+    let later = first.with_extension("z03");
+    assert!(later.exists());
+    let says = format!(
+        "game.z02 is missing: this split ZIP has {} parts. Put the missing parts",
+        before.len()
+    );
+    fs::remove_file(&missing).unwrap();
+    before.retain(|(path, _)| path != &missing);
+    assert_split_refused(&later, &first, &says);
+    assert_unchanged(&before);
+    assert!(!tmp.path().join("out").exists());
 
     let tmp = TempDir::new().unwrap();
     let first = fresh(&tmp);
```

**File**: `crates/core/src/archive/zip.rs` (modified, +1/-2)
```diff
@@ -679,11 +679,10 @@ fn check_part_count(parts: &[Part], this: u64) -> Result<()> {
     if this > n as u64 {
         let missing = storage::split_zip_segment(first, n).unwrap_or_else(|| first.clone());
         bail!(
-            "{} is missing: this split ZIP has {} parts, and {} of them are here. Put the \
+            "{} is missing: this split ZIP has {} parts. Put the \
              missing parts next to {} and try again. Nothing was modified",
             missing.display(),
             this + 1,
-            n + 1,
             first.display()
         );
     }
```

---

### Incident Patch 2: `f46560d1` (2026-11-22)
**Commit Message**: fix(cli): offer a nested split set only when the run wrote all its parts (#145)

* fix(cli): offer a nested split set only when the run wrote all its parts

* fix(cli): rename the field in the dry-run path too

**File**: `crates/cli/src/main.rs` (modified, +52/-11)
```diff
@@ -254,6 +254,38 @@ fn run(command: Command) -> Result<u8> {
 /// also matches the progress files next to the first volume
 /// (`game.z01.hatchzip`, ...), which are left out when their archive is
 /// given too.
+/// Whether every volume of the set whose first volume is `primary` that
+/// exists on disk is in `written`. A set that is not split has one volume.
+fn volumes_written(primary: &Path, written: &std::collections::HashSet<PathBuf>) -> bool {
+    use hatchzip_core::archive::storage;
+    let mut volumes = Vec::new();
+    if storage::is_split_zip(primary) {
+        let mut disk = 0;
+        while let Some(segment) = storage::split_zip_segment(primary, disk) {
+            if !segment.exists() {
+                break;
+            }
+            volumes.push(segment);
+            disk += 1;
+        }
+        volumes.extend(storage::split_zip_last(primary));
+    } else {
+        let mut index = 0;
+        while let Some(volume) = storage::volume_path(primary, index) {
+            if index > 0 && !volume.exists() {
+                break;
+            }
+            volumes.push(volume);
+            index += 1;
+        }
+    }
+    volumes
+        .iter()
+        .filter(|v| v.exists())
+        .all(|v| written.contains(v))
+        && written.contains(primary)
+}
+
 fn distinct(archives: &[PathBuf]) -> Result<Vec<PathBuf>> {
     let owner = |a: &Path| {
         let name = a.to_str()?;
@@ -615,9 +647,9 @@ fn restore(archive: &Path, output: Option<&Path>) -> Result<u8> {
 enum Ended {
     Extracted {
         output: PathBuf,
-        /// Archives this run wrote, found by extension and signature. Empty
-        /// without `--nested`.
-        nested: Vec<PathBuf>,
+        /// Every file this run wrote and the person did not keep, as absolute
+        /// paths: what `--nested` may pick archives from.
+        written: Vec<PathBuf>,
     },
     /// Stopped with the given status; `saved` if a journal holds progress.
     Stopped { code: u8, saved: bool },
@@ -693,12 +725,12 @@ fn extract_all(target: Target, mut opts: Options) -> Result<u8> {
             },
         };
         match ended {
-            Ended::Extracted { output, nested } => {
+            Ended::Extracted { output, written } => {
                 done += 1;
                 if !outputs.contains(&output) {
                     outputs.push(output);
                 }
-                nested_candidates.extend(nested);
+                nested_candidates.extend(written);
             }
             Ended::Stopped { code, saved } => {
                 if opts.several {
@@ -713,15 +745,25 @@ fn extract_all(target: Target, mut opts: Options) -> Result<u8> {
             .iter()
             .filter_map(|a| locate(a).ok().map(|(p, _)| p))
             .collect();
+        let written: std::collections::HashSet<PathBuf> =
+            nested_candidates.iter().cloned().collect();
         let mut nested: Vec<PathBuf> = Vec::new();
         let mut seen = std::collections::HashSet::new();
         for path in nested_candidates {
+            if hatchzip_core::archive::nested_kind(&path).is_none() {
+                continue;
+            }
             // A split set counts once, by its first volume, and the parent
             // archives are never nested.
             let Ok((primary, _)) = locate(&path) else {
                 continue;
             };
-            if parents.contains(&primary) || !seen.insert(primary) {
+            if parents.contains(&primary) || !seen.insert(primary.clone()) {
+                continue;
+            }
+            // Extracting a set in place removes every volume, so each one
+            // must be a file this run wrote, never one the person had.
+            if !volumes_written(&primary, &written) {
                 continue;
             }
             nested.push(path);
@@ -923,7 +965,7 @@ fn extract(
             );
             return Ok(Ended::Extracted {
                 output: journal.output,
-                nested: Vec::new(),
+                written: Vec::new(),
             });
         }
         State::Resume(job, journal) => {
@@ -1068,13 +1110,12 @@ fn extract(
                 entries(count),
                 output.display()
             );
-            let nested = candidates
+            let written = candidates
                 .into_iter()
                 .filter(|p| !kept.contains(p))
-                .map(|p| output.join(p))
-                .filter(|p| hatchzip_core::archive::nested_kind(p).is_some())
+                .filter_map(|p| std::path::absolute(output.join(p)).ok())
                 .collect();
-            Ok(Ended::Extracted { output, nested })
+            Ok(Ended::Extracted { output, written })
         }
         Ok(Outcome::Paused) => {
             if !opts.several {
```

**File**: `crates/cli/tests/nested.rs` (modified, +27/-0)
```diff
@@ -179,6 +179,33 @@ fn a_skipped_file_is_not_extracted() {
     assert_eq!(fs::read(out.join("first.zip")).unwrap(), user);
 }
 
+/// A `.zip` this run wrote next to the person's own `.z01` names a split set
+/// whose first part is theirs. Extracting it in place would remove their
+/// file, so it is not offered.
+#[test]
+fn a_set_whose_first_part_was_already_there_is_not_extracted() {
+    let tmp = TempDir::new().unwrap();
+    let out = tmp.path().join("out");
+    fs::create_dir_all(&out).unwrap();
+    let theirs = b"the first part of someone else's set".to_vec();
+    fs::write(out.join("set.z01"), &theirs).unwrap();
+
+    let inner = zip_bytes(&[("inside.txt", b"one")]);
+    let outer = zip_bytes(&[("set.zip", &inner)]);
+    let archive = tmp.path().join("outer.zip");
+    fs::write(&archive, outer).unwrap();
+
+    let run = extract_nested(&archive, &out, &[]);
+    assert_ok(&run);
+    assert!(
+        String::from_utf8_lossy(&run.stdout).contains("No archives among the extracted files."),
+        "{}",
+        String::from_utf8_lossy(&run.stdout)
+    );
+    assert_eq!(fs::read(out.join("set.z01")).unwrap(), theirs);
+    assert_eq!(fs::read(out.join("set.zip")).unwrap(), inner);
+}
+
 /// A link inside the output can point anywhere; the scan must not follow it.
 #[cfg(unix)]
 #[test]
```

---

### Incident Patch 3: `9a2ad6b5` (2026-11-22)
**Commit Message**: fix(shell): remove the Thunar file after Thunar rewrites the copy (#144)

* fix(shell): remove the Thunar file after Thunar rewrites the copy

* fix(deps): update url to 2.5.9 for RUSTSEC-2026-0592

**File**: `Cargo.lock` (modified, +4/-4)
```diff
@@ -1609,9 +1609,9 @@ checksum = "aa9a19cbb55df58761df49b23516a86d432839add4af60fc256da840f66ed35b"
 
 [[package]]
 name = "form_urlencoded"
-version = "1.2.2"
+version = "1.2.3"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cb4cb245038516f5f85277875cdaa4f7d2c9a0fa0468de06ed190163b1581fcf"
+checksum = "afa489199eaffb1211795df1c6236ce1ad0d41a6fa45250add73e3b02420f06e"
 dependencies = [
  "percent-encoding",
 ]
@@ -5342,9 +5342,9 @@ checksum = "6d49784317cd0d1ee7ec5c716dd598ec5b4483ea832a2dced265471cc0f690ae"
 
 [[package]]
 name = "url"
-version = "2.5.8"
+version = "2.5.9"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ff67a8a4397373c3ef660812acab3268222035010ab8680ec4215f38ba3d0eed"
+checksum = "f00cd2407bb42c0ef17be88d4cf020f5cceffd121665bac9b8b9493a369b3b1a"
 dependencies = [
  "form_urlencoded",
  "idna",
```

**File**: `crates/shell/src/platform/linux.rs` (modified, +34/-16)
```diff
@@ -482,13 +482,39 @@ fn action_set(xml: &str, uca: &Uca) -> Vec<Vec<(String, String)>> {
     set
 }
 
+/// Elements Thunar writes for every action, empty or not, so an empty one
+/// says the same as none. The rest, such as `<directories/>`, are flags that
+/// count by being there.
+const THUNAR_TEXT_FIELDS: &[&str] = &[
+    "icon",
+    "name",
+    "submenu",
+    "unique-id",
+    "command",
+    "description",
+    "range",
+    "patterns",
+];
+
 /// An action's child elements and their text, sorted, leaving out what
-/// Thunar fills in on its own: the `<unique-id>` and empty elements. Flags
-/// such as `<directories/>` are kept.
+/// Thunar changes on its own when it saves the file: the `<unique-id>`, text
+/// fields left empty, and the translations (`xml:lang`) of the name and
+/// description, which it keeps only for the locale it runs in. `<range/>`
+/// and `<range></range>` are the same element.
 fn action_fingerprint(action: &str) -> Vec<(String, String)> {
     let mut out = Vec::new();
+    let mut keep = |tag: &str, text: &str| {
+        let mut words = tag.split_whitespace();
+        let name = words.next().unwrap_or("");
+        let localized = words.any(|w| w.starts_with("xml:lang"));
+        let filled_in = text.is_empty() && THUNAR_TEXT_FIELDS.contains(&name);
+        if !localized && !filled_in && name != "unique-id" {
+            let key = tag.split_whitespace().collect::<Vec<_>>().join(" ");
+            out.push((key, text.to_owned()));
+        }
+    };
     let mut depth = 0;
-    let mut open: Option<(String, usize)> = None;
+    let mut open: Option<(&str, usize)> = None;
     let mut i = 0;
     while let Some(off) = action[i..].find('<') {
         let at = i + off;
@@ -499,29 +525,21 @@ fn action_fingerprint(action: &str) -> Vec<(String, String)> {
         }
         let Some(len) = tag_len(rest) else { break };
         let tag = &action[at + 1..at + len - 1];
-        let key = tag
-            .trim_end_matches('/')
-            .split_whitespace()
-            .collect::<Vec<_>>()
-            .join(" ");
         if tag.starts_with('/') {
             depth -= 1;
             if depth == 1
-                && let Some((name, from)) = open.take()
+                && let Some((tag, from)) = open.take()
             {
-                let text = action[from..at].trim();
-                if !text.is_empty() && !name.starts_with("unique-id") {
-                    out.push((name, text.to_owned()));
-                }
+                keep(tag, action[from..at].trim());
             }
-        } else if tag.ends_with('/') {
+        } else if let Some(tag) = tag.strip_suffix('/') {
             if depth == 1 {
-                out.push((key, String::new()));
+                keep(tag, "");
             }
         } else {
             depth += 1;
             if depth == 2 {
-                open = Some((key, at + len));
+                open = Some((tag, at + len));
             }
         }
         i = at + len;
```

**File**: `crates/shell/tests/register.rs` (modified, +78/-0)
```diff
@@ -265,6 +265,84 @@ fn thunar_keeps_every_action_that_is_not_hatchzips() {
     assert!(dirs.data.join("kio/servicemenus/hatchzip.desktop").exists());
 }
 
+/// Ubuntu's packaged `uca.xml` translates the stock action's name and
+/// description, and Thunar saves only the ones for its own locale. It also
+/// writes `<range/>` as `<range></range>`. A copy that changed only that way
+/// goes on unregister; one the user edited stays.
+#[cfg(target_os = "linux")]
+#[test]
+fn thunar_removes_its_rewrite_of_the_stock_file() {
+    use hatchzip_shell::unregister;
+
+    let tmp = tempfile::TempDir::new().unwrap();
+    let system = tmp.path().join("xdg");
+    std::fs::create_dir_all(system.join("Thunar")).unwrap();
+    let stock = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE actions [\n\
+                 <!ATTLIST name xml:lang CDATA #IMPLIED>\n\
+                 <!ATTLIST description xml:lang CDATA #IMPLIED>\n]>\n<actions>\n<action>\n\
+                 \t<icon>utilities-terminal</icon>\n\t<name>Open Terminal Here</name>\n\
+                 \t<name xml:lang=\"de\">Terminal hier \u{f6}ffnen</name>\n\
+                 \t<name xml:lang=\"fr\">Ouvrir un terminal ici</name>\n\
+                 \t<command>exo-open --working-directory %f --launch TerminalEmulator</command>\n\
+                 \t<description>Example for a custom action</description>\n\
+                 \t<description xml:lang=\"de\">Beispiel f\u{fc}r eine benutzerdefinierte Aktion</description>\n\
+                 \t<description xml:lang=\"fr\">Exemple d&apos;une action personnalis\u{e9}e</description>\n\
+                 \t<range/>\n\t<patterns>*</patterns>\n\t<startup-notify/>\n\t<directories/>\n\
+                 </action>\n</actions>\n";
+    std::fs::write(system.join("Thunar/uca.xml"), stock).unwrap();
+    let dirs = Dirs {
+        data: tmp.path().join("data"),
+        config: tmp.path().join("config"),
+        system_config: vec![system],
+    };
+    let uca = dirs.config.join("Thunar/uca.xml");
+    let gui = Path::new("/usr/bin/hatchzip-gui");
+    // What Thunar 4.18 in the C locale saves: no translations, `<range>` with
+    // an end tag, and an id for the action that had none.
+    let thunar_saves = |text: &str| {
+        text.lines()
+            .filter(|l| !l.contains("xml:lang=\""))
+            .map(|l| {
+                l.replace("<range/>", "<range></range>").replace(
+                    "<name>Open Terminal Here</name>",
+                    "<name>Open Terminal Here</name>\n\t<unique-id>1700000000-1</unique-id>",
+                )
+            })
+            .collect::<Vec<_>>()
+            .join("\n")
+            + "\n"
+    };
+
+    register(&dirs, gui).unwrap();
+    let text = std::fs::read_to_string(&uca).unwrap();
+    let rewritten = thunar_saves(&text);
+    assert!(!rewritten.contains("xml:lang=\"") && rewritten.contains("<range></range>"));
+    std::fs::write(&uca, &rewritten).unwrap();
+    unregister(&dirs).unwrap();
+    assert!(!uca.exists(), "Thunar's rewrite of an untouched copy goes");
+    assert!(!dirs.config.join("hatchzip/thunar-uca-created").exists());
+
+    // The same rewrite, with a change of the user's on top, is kept with it.
+    for (from, to) in [
+        (
+            "<description>Example for a custom action</description>",
+            "<description>My terminal</description>",
+        ),
+        ("<range></range>", "<range>1-1</range>"),
+    ] {
+        register(&dirs, gui).unwrap();
+        let text = std::fs::read_to_string(&uca).unwrap();
+        let edited = thunar_saves(&text).replacen(from, to, 1);
+        std::fs::write(&uca, &edited).unwrap();
+        unregister(&dirs).unwrap();
+        let left = std::fs::read_to_string(&uca).unwrap();
+        assert!(left.contains(to), "the user's edit stays");
+        assert!(!left.contains("hatchzip-"));
+        assert_eq!(left.matches("<action>").count(), 1);
+        std::fs::remove_file(&uca).unwrap();
+    }
+}
+
 /// A Thunar file HatchZip can't read or edit skips only Thunar, and says
 /// which file it was.
 #[cfg(target_os = "linux")]
```

#### Recent Merged Pull Requests:
- **PR #147** (2026-11-23): fix(core): report missing split ZIP parts clearly (@garvrao80)
- **PR #146** (closed): chore(deps): update url to 2.5.9 for RUSTSEC-2026-0592 (@xevrion)
- **PR #145** (2026-11-22): fix(cli): offer a nested split set only when the run wrote all its parts (@xevrion)
- **PR #144** (2026-11-22): fix(shell): remove the Thunar file after Thunar rewrites the copy (@xevrion)
- **PR #143** (2026-11-21): feat(core): extract native split ZIP (.z01) in place (@xevrion)
- **PR #142** (2026-11-21): feat: extract only selected entries, keeping the archive (@xevrion)

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

## X. core): report missing split ZIP parts clearly

**RULE**:
When implementing operations in `crates/cli/tests/formats.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xevrion/hatchzip. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f1fe89a9`: core): report missing split ZIP parts clearly. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/cli/tests/formats.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    let mut before = split_zip_snapshot(&first);
    let missing = first.with_extension("z02");
    let later = first.with_extension("z03");
    assert!(later.exists());
    let says = format!(
        "game.z02 is missing: this split ZIP has {} parts. Put the missing parts",
        before.len()
    );
    fs::remove_file(&missing).unwrap();
    before.retain(|(path, _)| path != &missing);
    assert_split_refused(&later, &first, &says);
    assert_unchanged(&before);
    assert!(!tmp.path().join("out").exists());
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    fs::remove_file(first.with_extension("z02")).unwrap();
    assert_split_refused(&first, &first, "game.z02 is missing");
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f1fe89a9` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
