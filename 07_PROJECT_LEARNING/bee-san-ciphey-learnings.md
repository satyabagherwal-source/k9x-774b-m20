# Forensic Learning Record (Deep Inspection): bee-san/Ciphey

> **Canonical Artifact**: `07_PROJECT_LEARNING/bee-san-ciphey-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bee-san/Ciphey](https://github.com/bee-san/Ciphey))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:27:38.881Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bee-san/Ciphey`
- **Description**: ⚡ Automatically decrypt encryptions without knowing the key or cipher, decode encodings, and crack hashes ⚡
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 21654 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/bin/ciphey-mcp/worker.rs`
```
//! Runs tool calls in worker processes.
//!
//! [`ProcessRunner`] starts this executable again with `--worker`, writes a [`WorkerRequest`]
//! as one line of JSON to its stdin and reads the response, `{"Ok": <result>}` or
//! `{"Err": <message>}`, from the last line of its stdout. The worker ([`run`]) configures
//! the library for that one request, runs it, and exits.

use std::io::Read;
use std::path::PathBuf;
use std::process::{ExitCode, Output, Stdio};
use std::sync::{Mutex, PoisonError};
use std::thread;
use std::time::Duration;

use ciphey::config::Config;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;
use tokio::sync::Semaphore;

use crate::decode_with::{self, DecodeWithOutput, DecodeWithRequest};
use crate::detect::{self, DetectOutput, DetectRequest};
use crate::server::{BoxFuture, DecodeOutput, DecodeStatus, Runner};

/// How long a worker may run past its time limit before it is killed. Covers process
/// start-up and a worker too stuck to stop itself.
const KILL_GRACE: Duration = Duration::from_secs(5);
/// Decodes allowed to run at once. Each worker already spreads its search over every core.
const MAX_CONCURRENT_DECODES: usize = 2;
/// `decode_with` and `detect_plaintext` calls allowed to run at once. They have slots of
/// their own, so that two long decodes don't hold them up.
const MAX_CONCURRENT_QUICK_CALLS: usize = 4;
/// How long a call waits for a free slot. With the 30 s search limit and [`KILL_GRACE`] a
/// call takes at most 45 s, under the ~60 s tool-call timeout of many MCP clients.
const QUEUE_TIMEOUT: Duration = Duration::from_secs(10);
/// How long a `decode_with` call may run. The slowest crackers, the rail fence and ROT47,
/// take up to 10 s on 65,536 characters in a release build.
pub const DECODE_WITH_TIME_LIMIT: Duration = Duration::from_secs(30);
/// How long a `detect_plaintext` call may run. The checks take well under a second on
/// 65,536 characters.
pub const DETECT_TIME_LIMIT: Duration = Duration::from_secs(10);
/// Resident memory a decode may use before it is stopped. A search that finds nothing grows
/// until its timeout: a few kilobytes of input can otherwise reach several gigabytes.
const DECODE_MEMORY_LIMIT: u64 = 1 << 30;
/// Resident memory a `decode_with` or `detect_plaintext` call may use before it is stopped.
/// The most any decoder used on 65,536 characters was 40 MiB, cracking ROT47.
const QUICK_CALL_MEMORY_LIMIT: u64 = 256 << 20;
/// How much of a failed worker's stderr to put in the error message.
const STDERR_TAIL_CHARS: usize = 1_000;
/// How often a worker checks its memory use.
const MEMORY_POLL_INTERVAL: Duration = Duration::from_millis(50);

/// What the server sends a worker: one job, and the limits it runs under.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkerRequest {
    /// The tool call to run.
    pub job: Job,
    /// Resident memory, in bytes, at which the worker gives up.
    pub max_memory_bytes: u64,
    /// Milliseconds after which the worker gives up. `None` for a decode, which the
    /// library's own timer stops.
    pub time_limit_ms: Option<u64>,
}

/// A tool call for a worker to run.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "tool", rename_all = "snake_case")]
pub enum Job {
    /// `decode`: the whole search.
    Decode(CrackRequest),
    /// `decode_with`: one decoder.
    DecodeWith(DecodeWithRequest),
    /// `detect_plaintext`: the plaintext checks.
    DetectPlaintext(DetectRequest),
}

impl Job {
    /// The tool the job is for, for messages.
    fn tool(&self) -> &'static str {
        match self {
            Job::Decode(_) => "decode",
            Job::DecodeWith(_) => "decode_with",
            Job::DetectPlaintext(_) => "detect_plaintext",
        }
    }
}

/// A validated `decode` call, sent from the server to a worker.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CrackRequest {
    /// The text to decode.
    pub text: String,
    /// Seconds the search may run.
    pub timeout_secs: u32,
    /// Only accept plaintext that matches this regex.
    pub regex: Option<String>,
}

/// What a worker prints: the job's result, or a message saying why it failed.
type WorkerResponse<T> = Result<T, String>;

/// Entry point of `ciphey-mcp --worker`: reads one [`WorkerRequest`] line from stdin and
/// prints one response line to stdout.
///
/// The server keeps stdin open until the worker is done, so the worker exits as soon as it
/// sees EOF: the server is gone, and nobody would read the result.
pub fn run() -> ExitCode {
    let mut line = String::new();
    match std::io::stdin().read_line(&mut line) {
        Ok(_) => {
            exit_on_eof();
            match serde_json::from_str::<WorkerRequest>(&line) {
                Ok(request) => run_job(request),
                Err(error) => fail(format!("invalid worker request: {error}")),
            }
        }
        Err(error) => fail(format!("could not read the worker request: {error}")),
    }
}

/// Ends the worker once stdin reaches EOF (see [`run`]).
fn exit_on_eof() {
    thread::spawn(|| {
        let mut buffer = [0; 64];
        // Nothing follows the request, so this blocks until the server closes stdin.
        while matches!(std::io::stdin().read(&mut buffer), Ok(read) if read > 0) {}
        std::process::exit(1);
    });
}

/// Runs `request`'s job under its limits and prints the result. Works once per process: the
/// library's config can only be set once.
fn run_job(request: WorkerRequest) -> ExitCode {
    watch_memory(
        request.max_memory_bytes,
        over_memory(&request.job, request.max_memory_bytes),
    );
    if let Some(limit) = request.time_limit_ms {
        watch_time(request.job.tool(), Duration::from_millis(limit));
    }
    // Without a database path every connection opens a new, empty in-memory database, so the
    // cache is effectively off and the worker never touches ~/.ciphey/database.sqlite.
    let _ = ciphey::storage::database::DB_PATH.set(None);
    match request.job {
        Job::Decode(request) => respond(&crack(request)),
        Job::DecodeWith(request) => {
            // The decoders' checks follow the config's crib, as they do in a search.
            ciphey::config::set_global_config(Config {
                regex: request.regex.clone(),
                ..quiet_config()
            });
            respond(&decode_with::run(&request))
        }
        Job::DetectPlaintext(request) => {
            // detect_plaintext takes its crib from the request, not the config.
            ciphey::config::set_global_config(quiet_config());
            respond(&detect::run(&request))
        }
    }
}

/// Prints `response` as the worker's one line of output. Only the first call prints: the
/// watchdogs can race the job to respond.
fn respond<T: Serialize>(response: &WorkerResponse<T>) -> ExitCode {
    static RESPONDED: Mutex<bool> = Mutex::new(false);
    let mut responded = RESPONDED.lock().unwrap_or_else(PoisonError::into_inner);
    if std::mem::replace(&mut *responded, true) {
        return ExitCode::SUCCESS;
    }
    match serde_json::to_string(response) {
        Ok(line) => {
            println!("{line}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("could not encode the worker response: {error}");
            ExitCode::FAILURE
        }
    }
}

/// Prints `message` as the worker's error response. It reads as an error whatever result
/// the server expects.
fn fail(message: String) -> ExitCode {
    respond(&WorkerResponse::<()>::Err(message))
}

/// Prints `message` as the worker's error response, and ends the worker and its search.
fn fail_and_exit(message: String) -> ! {
    let code = fail(message);
    std::process::exit(if code == ExitCode::SUCCESS { 0 } else { 1 });
}

/// The library settings every worker uses.
fn quiet_config() -> Config {
    Config {
        // Keeps the library from printing to stdout, which carries our response.
        api_mode: true,
        human_checker_on: false,
        ..Config::default()
    }
}

/// Runs the whole search on `request`.
fn crack(request: CrackRequest) -> WorkerResponse<DecodeOutput> {
    let config = Config {
        timeout: request.timeout_secs,
        regex: request.regex,
        ..quiet_config()
    };
    DecodeOutput::from_crack(
        ciphey::perform_cracking(&request.text, config),
        request.timeout_secs,
    )
}

/// Ends the worker with the error `message` once its resident memory passes `limit` bytes.
///
/// A search that finds nothing keeps every open node in memory until its timeout, which can
/// reach several gigabytes for inputs a few kilobytes long.
fn watch_memory(limit: u64, message: String) {
    thread::spawn(move || loop {
        let resident = memory_stats::memory_stats().map(|usage| usage.physical_mem as u64);
        if resident.is_some_and(|resident| resident > limit) {
            fail_and_exit(message);
        }
        thread::sleep(MEMORY_POLL_INTERVAL);
    });
}

/// The error for `job` stopped at `limit` bytes of memory.
fn over_memory(job: &Job, limit: u64) -> String {
    let mib = limit >> 20;
    match job {
        Job::Decode(_) => format!(
            "the search used more than {mib} MiB of memory without finding plaintext. Try a \
             smaller `timeout_secs`, a `regex` crib, or a shorter part of the text"
        ),
        _ => format!(
            "`{}` used more than {mib} MiB of memory without finishing. Try a shorter `text`",
            job.tool()
        ),
    }
}

/// Ends the worker with an error once it has run `tool` for `limit`.
fn watch_time(tool: &'static str, limit: Duration) {
    thread::spawn(move || {
        thread::sleep(limit);
        fail_and_exit(format!(
            "`{tool}` stopped after {} without finishing. Try a shorter `text`",
            describe(limit)
        ));
    
```

### Core Architecture Module: `src/decoders/core_socialist_values_decoder.rs`
```
//! Decode the Core Socialist Values encoding (社会主义核心价值观编码), which writes the
//! UTF-8 bytes of a message as base-12 digits, each digit one of the twelve two-character
//! values:
//!
//! ```text
//! 0 富强  1 民主  2 文明  3 和谐  4 自由  5 平等  6 公正  7 法治  8 爱国  9 敬业  10 诚信  11 友善
//! ```
//!
//! The encoder takes the upper-case hex of the bytes. A hex digit from 0 to 9 is one value.
//! A digit from A to F is two: 诚信 (10) and then the digit minus 10, or 友善 (11) and then
//! the digit minus 6, chosen at random for each digit, so one text has many encodings. In
//! `hello world`, which starts 公正爱国公正平等公正友善公正, `h` is 0x68 (公正 爱国) and
//! `l` is 0x6C (公正, then 友善 公正 for C).
//!
//! The reference decoder skips every character that isn't one of the 24 and reads only the
//! first character of each value. This one is strict, so that it only fires on text that
//! is this encoding: ASCII whitespace is skipped, but any other character, a value split
//! across two others (`强民`), an escape followed by a digit the encoder never writes after
//! it, or a leftover digit fails.
//!
//! Reference: `valuesEncode` and `valuesDecode` in sym233/core-values-encoder
//! <https://github.com/sym233/core-values-encoder/blob/a419ea532629782ebe7442a8682b72bb5ae3eab5/src/index.js>
//! (ISC; the algorithm is ported, not copied) and its web page
//! <https://sym233.github.io/core-values-encoder/>.

use crate::checkers::CheckerTypes;
use crate::decoders::interface::check_string_success;

use super::crack_results::CrackResult;
use super::interface::Crack;
use super::interface::Decoder;

use log::{debug, info, trace};

/// The Core Socialist Values decoder, call:
/// `let decoder = Decoder::<CoreSocialistValuesDecoder>::new()` to create a new instance
/// And then call:
/// `result = decoder.crack(input)` to decode a Core Socialist Values string
/// The struct generated by new() comes from interface.rs
/// ```
/// use ciphey::decoders::core_socialist_values_decoder::CoreSocialistValuesDecoder;
/// use ciphey::decoders::interface::{Crack, Decoder};
/// use ciphey::checkers::{athena::Athena, CheckerTypes, checker_type::{Check, Checker}};
///
/// let decoder = Decoder::<CoreSocialistValuesDecoder>::new();
/// let athena_checker = Checker::<Athena>::new();
/// let checker = CheckerTypes::CheckAthena(athena_checker);
///
/// let result = decoder
///     .crack(
///         "公正爱国公正平等公正友善公正公正友善公正公正诚信平等文明富强法治法治公正诚信平等法治文明公正诚信文明公正自由",
///         &checker,
///     )
///     .unencrypted_text;
/// assert!(result.is_some());
/// assert_eq!(result.unwrap()[0], "hello world");
/// ```
pub struct CoreSocialistValuesDecoder;

/// The fewest characters (four values) the decoder accepts. One byte takes two to four
/// values, and the search rejects results of two bytes or fewer anyway.
const MIN_CHARS: usize = 8;

impl Crack for Decoder<CoreSocialistValuesDecoder> {
    fn new() -> Decoder<CoreSocialistValuesDecoder> {
        Decoder {
            name: "Core Socialist Values",
            description: "Core Socialist Values encoding (社会主义核心价值观): UTF-8 bytes written as base-12 digits using the twelve two-character values",
            link: "https://github.com/sym233/core-values-encoder",
            tags: vec!["core_socialist_values", "chinese", "ctf", "base", "decoder"],
            // Common in Chinese CTF warm-ups and rare anywhere else. It costs nothing on
            // other input: everything that isn't these 24 characters fails at once.
            popularity: 0.3,
            phantom: std::marker::PhantomData,
        }
    }

    /// Decodes `text` as Core Socialist Values and checks the result with `checker`.
    /// `unencrypted_text` is `None` when `text` isn't this encoding or doesn't decode to
    /// text.
    fn crack(&self, text: &str, checker: &CheckerTypes) -> CrackResult {
        trace!("Trying Core Socialist Values with text {:?}", text);
        let mut results = CrackResult::new(self, text.to_string());

        let Some(bytes) = decode_core_socialist_values(text) else {
            debug!("Failed to decode Core Socialist Values because the text isn't made of the twelve values");
            return results;
        };

        // Strict UTF-8, as the reference's decodeURIComponent is
        let Ok(decoded_text) = String::from_utf8(bytes) else {
            debug!("Failed to decode Core Socialist Values because the bytes aren't UTF-8");
            return results;
        };
        trace!("Decoded text for Core Socialist Values: {:?}", decoded_text);

        if !is_text(&decoded_text) {
            debug!("Failed to decode Core Socialist Values because the bytes are control characters or only whitespace");
            return results;
        }

        if !check_string_success(&decoded_text, text) {
            info!(
                "Failed to decode Core Socialist Values because check_string_success returned false on string {}",
                decoded_text
            );
            return results;
        }

        let checker_result = checker.check(&decoded_text);
        results.unencrypted_text = Some(vec![decoded_text]);
        results.update_checker(&checker_result);

        results
    }

    /// Gets all tags for this decoder
    fn get_tags(&self) -> &Vec<&str> {
        &self.tags
    }
    /// Gets the name for the current decoder
    fn get_name(&self) -> &str {
        self.name
    }
    /// Gets the popularity for the current decoder
    fn get_popularity(&self) -> f32 {
        self.popularity
    }
    /// Gets the description for the current decoder
    fn get_description(&self) -> &str {
        self.description
    }
    /// Gets the link for the current decoder
    fn get_link(&self) -> &str {
        self.link
    }
}

/// Reads the values back into the bytes they stand for, or returns `None` if `text` isn't
/// the Core Socialist Values encoding.
///
/// ASCII whitespace anywhere is skipped. Everything else must be one of the 24 characters,
/// in the pairs that make the twelve values, and the values must make whole hex digits
/// and whole bytes.
fn decode_core_socialist_values(text: &str) -> Option<Vec<u8>> {
    // Every value is two Han characters, so ASCII text (Base64, hex, English, ...) isn't
    // this encoding. Almost every text a search tries stops here.
    if text.is_ascii() {
        return None;
    }

    let mut bytes = Vec::new();
    // The first character of the value being read, as its index in `char_index`
    let mut first_half: Option<u8> = None;
    // A 10 or 11 waiting for the digit after it
    let mut escape: Option<u8> = None;
    // The high nibble of the byte being read
    let mut high_nibble: Option<u8> = None;
    let mut chars = 0;

    for c in text.chars() {
        if c.is_ascii_whitespace() {
            continue;
        }
        // Fails on the first character that isn't one of the 24, so Chinese prose, emoji,
        // Braille and Base65536 stop at their first character, before anything is
        // allocated
        let index = char_index(c)?;
        chars += 1;

        let Some(first) = first_half.take() else {
            // 富, 民, 文, ... start a value; 强, 主, 明, ... end one
            if !index.is_multiple_of(2) {
                return None;
            }
            first_half = Some(index);
            continue;
        };
        // The second half of the same value: 富强, not 富民 or 富富
        if index != first + 1 {
            return None;
        }

        let digit = first / 2;
        let nibble = match escape.take() {
            None if digit < 10 => digit,
            None => {
                escape = Some(digit);
                continue;
            }
            // 诚信 then 富强 to 平等 is A to F
            Some(10) if digit <= 5 => digit + 10,
            // 友善 then 自由 to 敬业 is A to F
            Some(11) if (4..=9).contains(&digit) => digit + 6,
            // The encoder never writes these: the reference would make a wrong hex digit or
            // one past F
            Some(_) => return None,
        };
        match high_nibble.take() {
            None => high_nibble = Some(nibble),
            Some(high) => bytes.push(high << 4 | nibble),
        }
    }

    // Half a value, an escape with nothing after it, or half a byte left over
    if chars < MIN_CHARS || first_half.is_some() || escape.is_some() || high_nibble.is_some() {
        return None;
    }
    Some(bytes)
}

/// Where `c` is in 富强民主文明和谐自由平等公正法治爱国敬业诚信友善 (0 to 23), so the value
/// for digit `d` is the characters at `2d` and `2d + 1`. `None` for any other character.
fn char_index(c: char) -> Option<u8> {
    Some(match c {
        '富' => 0,
        '强' => 1,
        '民' => 2,
        '主' => 3,
        '文' => 4,
        '明' => 5,
        '和' => 6,
        '谐' => 7,
        '自' => 8,
        '由' => 9,
        '平' => 10,
        '等' => 11,
        '公' => 12,
        '正' => 13,
        '法' => 14,
        '治' => 15,
        '爱' => 16,
        '国' => 17,
        '敬' => 18,
        '业' => 19,
        '诚' => 20,
        '信' => 21,
        '友' => 22,
        '善' => 23,
        _ => return None,
    })
}

/// Whether decoded bytes are text: no control characters except tabs and line breaks
/// (U+007F and the C1 controls count as control characters), and not only whitespace.
fn is_text(text: &str) -> bool {
    !text.trim().is_empty()
        && !text
            .chars()
            .any(|c| c.is_control() && !matches!(c, '\t' | '\n' | '\r'))
}

#[cfg(test)]
mod tests {
    use super::{decode_core_socialist_values, CoreSocialistValuesDecoder};
    use crate::checkers::athena::Athena;
    use crate::checkers::checker_type::{Check, Checker};
    use crate::checkers::CheckerTypes;
    use crate::decoders::interface::{Crack, Decoder};
    use crate::decoders::{DecoderType, DECODER_MAP};
    use crate::filtration_system::get_decoder_by_name;

    // Unless noted otherwise, the encodings here were made with `valuesEncode` from the
    // reference implementation (sym233/core-values-encoder@a4
```

### Core Architecture Module: `benches/checkers.rs`
```
//! The plaintext checkers: English (gibberish detection), LemmeKnow (regex database of
//! known formats), the common-password list, and Athena, which runs them in turn and is
//! what every decoder calls on every candidate.
//!
//! Misses matter most: during a search almost every candidate is rejected, and a
//! rejected candidate pays for every checker Athena runs.
//!
//! The regex and wordlist checkers need a different global config, see `crib.rs`.
//!
//! Run: `cargo bench --bench checkers` (add `-- athena` to run one checker).

mod common;

use ciphey::checkers::athena::Athena;
use ciphey::checkers::checker_type::{Check, Checker};
use ciphey::checkers::english::EnglishChecker;
use ciphey::checkers::lemmeknow_checker::LemmeKnow;
use ciphey::checkers::password::PasswordChecker;
use ciphey::checkers::CheckerTypes;
use common::CheckerFixtures;
use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use std::hint::black_box;
use std::time::Duration;

fn checkers(c: &mut Criterion) {
    common::init(common::bench_config());
    let fixtures: CheckerFixtures = common::load("checkers.toml");

    let mut group = c.benchmark_group("checkers");
    group
        .warm_up_time(Duration::from_millis(500))
        .measurement_time(Duration::from_secs(2));

    for case in fixtures.case.iter().filter(|c| !c.crib) {
        let text = fixtures.input(&case.input);
        let checker = match case.checker.as_str() {
            "english" => CheckerTypes::CheckEnglish(Checker::<EnglishChecker>::new()),
            "lemmeknow" => CheckerTypes::CheckLemmeKnow(Checker::<LemmeKnow>::new()),
            "password" => CheckerTypes::CheckPassword(Checker::<PasswordChecker>::new()),
            "athena" => CheckerTypes::CheckAthena(Checker::<Athena>::new()),
            other => panic!("unknown checker {other:?} in checkers.toml"),
        }
        .with_sensitivity(common::sensitivity(case.sensitivity.as_deref()));

        let name = case.bench_name();
        assert_eq!(
            checker.check(text).is_identified,
            case.identified,
            "{name} on {}: is_identified changed",
            case.input
        );
        group.throughput(Throughput::Bytes(text.len() as u64));
        group.bench_with_input(BenchmarkId::new(name, &case.input), text, |b, text| {
            b.iter(|| checker.check(black_box(text)))
        });
    }
    group.finish();
}

criterion_group!(benches, checkers);
criterion_main!(benches);

```

### Core Architecture Module: `benches/common/mod.rs`
```
//! Helpers shared by the benchmark binaries: fixture loading and process-wide setup.
//!
//! Ciphey keeps its config and database path in process-wide `OnceCell`s that can only be
//! set once, so each bench binary picks one configuration at startup with [`init`] and
//! keeps it. That is also why the regex/wordlist checkers live in their own binary.

// Each bench binary uses a different subset of these helpers.
#![allow(dead_code)]

use ciphey::config::{set_global_config, Config};
use gibberish_or_not::Sensitivity;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// Path of a file in `benches/data`.
pub fn data_path(file: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("benches")
        .join("data")
        .join(file)
}

/// Reads and parses a TOML fixture from `benches/data`.
pub fn load<T: DeserializeOwned>(file: &str) -> T {
    let path = data_path(file);
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("could not read {}: {e}", path.display()));
    toml::from_str(&text).unwrap_or_else(|e| panic!("could not parse {}: {e}", path.display()))
}

/// The config every bench runs with: no prompts, nothing printed.
pub fn bench_config() -> Config {
    Config {
        api_mode: true,
        human_checker_on: false,
        verbose: 0,
        ..Config::default()
    }
}

/// Installs `config` as the process-wide config and keeps the cache database in memory.
///
/// With an in-memory database every `perform_cracking` call is a cache miss (each
/// connection gets a fresh, empty database) and nothing under `~/.ciphey` is touched.
/// Call once, before anything else reads the config.
pub fn init(config: Config) {
    ciphey::storage::database::DB_PATH
        .set(None)
        .expect("the database path was already set");
    set_global_config(config);
    assert!(
        ciphey::config::get_config().api_mode,
        "the global config was already initialised"
    );
}

/// Call before every timed search.
///
/// The A* search keeps per-decoder success statistics for the life of the process and
/// uses them in its edge costs, so without this a search's path, and so its time,
/// depends on how many searches ran before it in the same process (and so on how fast
/// the code is). A real `ciphey` run always starts with empty statistics.
pub fn fresh_search() {
    ciphey::reset_decoder_stats();
}

/// Parses a sensitivity name from the fixtures, defaulting to Medium.
pub fn sensitivity(name: Option<&str>) -> Sensitivity {
    match name {
        None | Some("Medium") => Sensitivity::Medium,
        Some("Low") => Sensitivity::Low,
        Some("High") => Sensitivity::High,
        Some(other) => panic!("unknown sensitivity {other:?}"),
    }
}

/// Turns a decoder name like "Base58 Bitcoin" into a benchmark id like "base58_bitcoin".
pub fn slug(name: &str) -> String {
    name.to_ascii_lowercase().replace([' ', '-'], "_")
}

/// `benches/data/decoders.toml`
#[derive(Deserialize)]
pub struct DecoderFixtures {
    /// Gibberish that no decoder accepts, run through every decoder.
    pub miss: String,
    /// One entry per decoder and input size.
    pub case: Vec<DecoderCase>,
}

/// One decoder input.
#[derive(Deserialize)]
pub struct DecoderCase {
    /// Key into `ciphey::decoders::DECODER_MAP`.
    pub decoder: String,
    /// "medium" or "long".
    pub size: String,
    /// Whether `crack` reports success with the Athena checker.
    pub success: bool,
    /// Encoded text.
    pub input: String,
    /// One of the strings `crack` returns.
    pub expected: String,
}

/// `benches/data/checkers.toml`
#[derive(Deserialize)]
pub struct CheckerFixtures {
    /// Named input texts.
    pub inputs: BTreeMap<String, String>,
    /// One entry per checker and input.
    pub case: Vec<CheckerCase>,
}

impl CheckerFixtures {
    /// Text of a named input.
    pub fn input(&self, name: &str) -> &str {
        self.inputs
            .get(name)
            .unwrap_or_else(|| panic!("no input named {name:?} in checkers.toml"))
    }
}

/// One checker run.
#[derive(Deserialize)]
pub struct CheckerCase {
    /// Which checker to run.
    pub checker: String,
    /// Sensitivity, defaults to Medium.
    #[serde(default)]
    pub sensitivity: Option<String>,
    /// Name of the input in `[inputs]`.
    pub input: String,
    /// Expected `is_identified`.
    pub identified: bool,
    /// Needs the regex/wordlist config, so runs in `crib.rs` instead of `checkers.rs`.
    #[serde(default)]
    pub crib: bool,
}

impl CheckerCase {
    /// Benchmark function name, e.g. "english" or "english_low".
    pub fn bench_name(&self) -> String {
        match &self.sensitivity {
            Some(s) => format!("{}_{}", self.checker, s.to_ascii_lowercase()),
            None => self.checker.clone(),
        }
    }
}

/// `benches/data/search.toml`
#[derive(Deserialize)]
pub struct SearchFixtures {
    /// The corpus.
    pub case: Vec<SearchCase>,
}

/// One end-to-end search.
#[derive(Deserialize)]
pub struct SearchCase {
    /// "plaintext", "single", "multi" or "no_solution".
    pub kind: String,
    /// Benchmark id.
    pub name: String,
    /// Encodings applied to the plaintext, innermost first. Documentation only.
    #[serde(default)]
    pub layers: Vec<String>,
    /// Text passed to `perform_cracking`.
    pub input: String,
    /// Expected plaintext, empty for no_solution cases.
    pub expected: String,
    /// How a no_solution search ends: "exhausted", "false_positive" or "timeout".
    #[serde(default)]
    pub outcome: Option<String>,
}

```

### Core Architecture Module: `benches/crib.rs`
```
//! The crib checkers, which need their own process because they read the global config:
//! runs as if the CLI was started with `--regex 'flag\{[^}]*\}'` and
//! `--wordlist benches/data/wordlist.txt` (5,000 words).
//!
//! With a regex set, Athena runs only the regex checker, so `crib/search` also shows what
//! a `--regex` search costs end to end.
//!
//! Run: `cargo bench --bench crib`

mod common;

use ciphey::checkers::athena::Athena;
use ciphey::checkers::checker_type::{Check, Checker};
use ciphey::checkers::regex_checker::RegexChecker;
use ciphey::checkers::wordlist::WordlistChecker;
use ciphey::checkers::CheckerTypes;
use ciphey::config::{load_wordlist, Config};
use ciphey::perform_cracking;
use common::CheckerFixtures;
use criterion::{
    criterion_group, criterion_main, BatchSize, BenchmarkId, Criterion, SamplingMode, Throughput,
};
use std::hint::black_box;
use std::time::Duration;

/// The crib, a typical CTF flag format.
const CRIB_REGEX: &str = r"flag\{[^}]*\}";

/// End-to-end `--regex` searches: (bench name, input name). Both decode to `flag_sentence`.
const CRIB_SEARCHES: &[(&str, &str)] = &[
    ("base64", "flag_base64"),
    ("rot13_base64", "flag_rot13_base64"),
];

/// Same timeout as `search.rs`.
const TIMEOUT_SECS: u32 = 1;

fn crib_config() -> Config {
    Config {
        regex: Some(CRIB_REGEX.to_string()),
        timeout: TIMEOUT_SECS,
        ..common::bench_config()
    }
}

fn crib(c: &mut Criterion) {
    let mut config = crib_config();
    config.wordlist = Some(
        load_wordlist(common::data_path("wordlist.txt")).expect("could not load wordlist.txt"),
    );
    common::init(config);
    let fixtures: CheckerFixtures = common::load("checkers.toml");

    let mut group = c.benchmark_group("crib");
    group
        .warm_up_time(Duration::from_millis(500))
        .measurement_time(Duration::from_secs(2));
    for case in fixtures.case.iter().filter(|c| c.crib) {
        let text = fixtures.input(&case.input);
        let checker = match case.checker.as_str() {
            "regex" => CheckerTypes::CheckRegex(Checker::<RegexChecker>::new()),
            "wordlist" => CheckerTypes::CheckWordlist(Checker::<WordlistChecker>::new()),
            "athena" => CheckerTypes::CheckAthena(Checker::<Athena>::new()),
            other => panic!("unknown crib checker {other:?} in checkers.toml"),
        };
        let name = case.bench_name();
        assert_eq!(
            checker.check(text).is_identified,
            case.identified,
            "{name} on {}: is_identified changed",
            case.input
        );
        group.throughput(Throughput::Bytes(text.len() as u64));
        group.bench_with_input(BenchmarkId::new(name, &case.input), text, |b, text| {
            b.iter(|| checker.check(black_box(text)))
        });
    }
    group.finish();

    let mut group = c.benchmark_group("crib/search");
    group
        .sampling_mode(SamplingMode::Flat)
        .sample_size(20)
        .warm_up_time(Duration::from_secs(1))
        .measurement_time(Duration::from_secs(4));
    let expected = fixtures.input("flag_sentence");
    for (name, input) in CRIB_SEARCHES {
        let input = fixtures.input(input);
        // Unoptimised builds (`cargo test --benches`) may not finish within the timeout.
        if !cfg!(debug_assertions) {
            common::fresh_search();
            let result = perform_cracking(input, crib_config())
                .unwrap_or_else(|e| panic!("crib search {name} failed: {e}"))
                .unwrap_or_else(|| panic!("crib search {name} found nothing"));
            assert_eq!(
                result.text[0], expected,
                "crib search {name}: wrong plaintext"
            );
        }
        group.bench_function(*name, |b| {
            b.iter_batched(
                || {
                    common::fresh_search();
                    crib_config()
                },
                |config| perform_cracking(black_box(input), config),
                BatchSize::PerIteration,
            )
        });
    }
    group.finish();
}

criterion_group!(benches, crib);
criterion_main!(benches);

```

### Core Architecture Module: `benches/decoders.rs`
```
//! Every decoder on realistic input.
//!
//! For each decoder in `benches/data/decoders.toml`:
//! * `medium` / `long`: an 84 / 576 character English text encoded with that decoder,
//! * `miss`: a gibberish string the decoder rejects, which is what most decoders see
//!   during a search.
//!
//! `crack` runs with the Athena checker, the same as during a search, so the times
//! include checking the candidates it produces.
//!
//! The decoders in [`SLOW`] take a large part of a second per call on their inputs, so
//! they are measured in their own group, `decoders_slow`, with fewer samples. With the
//! settings of the `decoders` group criterion would run each of them for minutes.
//!
//! Run: `cargo bench --bench decoders` (add `-- caesar` to run one decoder).

mod common;

use ciphey::checkers::athena::Athena;
use ciphey::checkers::checker_type::{Check, Checker};
use ciphey::checkers::CheckerTypes;
use ciphey::decoders::DECODER_MAP;
use common::{DecoderCase, DecoderFixtures};
use criterion::measurement::WallTime;
use criterion::{
    criterion_group, criterion_main, BenchmarkGroup, BenchmarkId, Criterion, SamplingMode,
    Throughput,
};
use std::hint::black_box;
use std::time::Duration;

/// Decoders benchmarked in the `decoders_slow` group: crackers that search for a key for
/// hundreds of milliseconds on their `long` input.
const SLOW: &[&str] = &["Playfair"];

fn decoders(c: &mut Criterion) {
    common::init(common::bench_config());
    let fixtures: DecoderFixtures = common::load("decoders.toml");
    let checker = CheckerTypes::CheckAthena(Checker::<Athena>::new());

    let mut names: Vec<&str> = fixtures.case.iter().map(|c| c.decoder.as_str()).collect();
    names.dedup();
    let (slow, fast): (Vec<&str>, Vec<&str>) = names.into_iter().partition(|n| SLOW.contains(n));

    let mut group = c.benchmark_group("decoders");
    group
        .warm_up_time(Duration::from_millis(500))
        .measurement_time(Duration::from_secs(2));
    for name in fast {
        bench_decoder(&mut group, name, &fixtures, &checker);
    }
    group.finish();

    let mut group = c.benchmark_group("decoders_slow");
    group
        .sampling_mode(SamplingMode::Flat)
        .sample_size(10)
        .warm_up_time(Duration::from_secs(1))
        .measurement_time(Duration::from_secs(10));
    for name in slow {
        bench_decoder(&mut group, name, &fixtures, &checker);
    }
    group.finish();
}

/// Benchmarks decoder `name` on each of its cases and on the miss input, in `group`.
fn bench_decoder(
    group: &mut BenchmarkGroup<'_, WallTime>,
    name: &str,
    fixtures: &DecoderFixtures,
    checker: &CheckerTypes,
) {
    let decoder = DECODER_MAP
        .get(name)
        .unwrap_or_else(|| panic!("no decoder named {name:?} in DECODER_MAP"))
        .get::<()>();
    let id = common::slug(name);

    for case in fixtures.case.iter().filter(|c| c.decoder == name) {
        verify(case, decoder.crack(&case.input, checker));
        group.throughput(Throughput::Bytes(case.input.len() as u64));
        group.bench_with_input(
            BenchmarkId::new(&id, &case.size),
            case.input.as_str(),
            |b, input| b.iter(|| decoder.crack(black_box(input), checker)),
        );
    }

    let miss = decoder.crack(&fixtures.miss, checker);
    assert!(!miss.success, "{name} accepted the miss input: {miss:?}");
    group.throughput(Throughput::Bytes(fixtures.miss.len() as u64));
    group.bench_with_input(
        BenchmarkId::new(&id, "miss"),
        fixtures.miss.as_str(),
        |b, input| b.iter(|| decoder.crack(black_box(input), checker)),
    );
}

/// Panics if the decoder no longer behaves the way the fixture recorded, so a
/// behaviour change can't hide behind a timing change.
fn verify(case: &DecoderCase, result: ciphey::decoders::crack_results::CrackResult) {
    let outputs = result.unencrypted_text.unwrap_or_default();
    assert_eq!(
        result.success, case.success,
        "{} {}: success changed (outputs {:?})",
        case.decoder, case.size, outputs
    );
    assert!(
        outputs.contains(&case.expected),
        "{} {}: expected {:?} among outputs {:?}",
        case.decoder,
        case.size,
        case.expected,
        outputs
    );
}

criterion_group!(benches, decoders);
criterion_main!(benches);

```

### Core Architecture Module: `benches/search.rs`
```
//! The A* search end to end, through `ciphey::perform_cracking`, on the corpus in
//! `benches/data/search.toml`:
//!
//! * `search/plaintext`: input that is already plaintext (early exit),
//! * `search/single`: one encoding or cipher,
//! * `search/multi`: two or three stacked layers,
//! * `search/no_solution`: input with no plaintext to find. These end when the decoders
//!   run out of candidates, when the search settles on a false positive, or when the
//!   fixed 1 second timeout fires, so each sample is bounded by the timeout.
//!
//! The cache database is in memory (see `common::init`), so every iteration is a
//! cache miss and does the full search.
//!
//! Run: `cargo bench --bench search` (add `-- search/multi` to run one group).

mod common;

use ciphey::config::Config;
use ciphey::{perform_cracking, CipheyError};
use common::{SearchCase, SearchFixtures};
use criterion::{criterion_group, criterion_main, BatchSize, Criterion, SamplingMode};
use std::hint::black_box;
use std::time::Duration;

/// Search timeout. The timer counts whole seconds, so 1 is the smallest useful value.
const TIMEOUT_SECS: u32 = 1;

/// Unoptimised builds (`cargo test --benches`) are too slow to finish some searches
/// within the timeout, so they only smoke-run the benchmarks without checking results.
const VERIFY: bool = !cfg!(debug_assertions);

fn search_config() -> Config {
    Config {
        timeout: TIMEOUT_SECS,
        ..common::bench_config()
    }
}

/// Per-iteration setup: a fresh config, and decoder statistics cleared so every search
/// explores in the same order a fresh `ciphey` process would (see `common::fresh_search`).
fn setup() -> Config {
    common::fresh_search();
    search_config()
}

fn search(c: &mut Criterion) {
    common::init(search_config());
    let fixtures: SearchFixtures = common::load("search.toml");

    for kind in ["plaintext", "single", "multi", "no_solution"] {
        let mut group = c.benchmark_group(format!("search/{kind}"));
        group.sampling_mode(SamplingMode::Flat);
        if kind == "no_solution" {
            // Up to ~1 s per iteration.
            group
                .sample_size(10)
                .warm_up_time(Duration::from_secs(1))
                .measurement_time(Duration::from_secs(8));
        } else {
            group
                .sample_size(20)
                .warm_up_time(Duration::from_secs(1))
                .measurement_time(Duration::from_secs(3));
        }

        for case in fixtures.case.iter().filter(|c| c.kind == kind) {
            verify(case);
            group.bench_function(&case.name, |b| {
                b.iter_batched(
                    setup,
                    |config| perform_cracking(black_box(&case.input), config),
                    BatchSize::PerIteration,
                )
            });
        }
        group.finish();
    }
}

/// Checks the search still ends the way the fixture says before timing it.
fn verify(case: &SearchCase) {
    if !VERIFY {
        return;
    }
    let result = perform_cracking(&case.input, setup());
    match (case.kind.as_str(), case.outcome.as_deref()) {
        ("no_solution", Some("exhausted")) => assert!(
            matches!(result, Ok(None)),
            "{}: expected the search to exhaust, got {result:?}",
            case.name
        ),
        ("no_solution", Some("timeout")) => assert!(
            matches!(result, Err(CipheyError::Timeout { .. })),
            "{}: expected a timeout, got {result:?}",
            case.name
        ),
        ("no_solution", _) => {}
        _ => {
            let found = result
                .unwrap_or_else(|e| panic!("{}: search failed: {e}", case.name))
                .unwrap_or_else(|| panic!("{}: search found nothing", case.name));
            assert_eq!(
                found.text[0],
                case.expected,
                "{}: wrong plaintext via {:?}",
                case.name,
                found.path.iter().map(|p| p.decoder).collect::<Vec<_>>()
            );
        }
    }
}

criterion_group!(benches, search);
criterion_main!(benches);

```

### Core Architecture Module: `benches/startup.rs`
```
//! Startup and per-call overhead outside the search itself.
//!
//! * `startup/config`: building the default config, loading `~/.ciphey/config.toml`
//!   (the fixture copy, see below) and loading a 5,000 word wordlist.
//! * `startup/cache`: the SQLite cache every `perform_cracking` call goes through, on a
//!   database file in a scratch dir: schema setup, cache lookups, and an insert.
//! * `startup/perform_cracking`: plaintext input end to end against that file, as a
//!   cache hit and as a cache miss (the miss includes writing the result to the cache).
//! * `startup/cli` (Unix only): the real `ciphey` binary started as a subprocess, which
//!   adds process start, argument parsing, logger setup and every lazy `static` the run
//!   touches (LemmeKnow compiles its ~130 regexes on first use).
//!
//! `HOME` is pointed at a scratch dir under `target/tmp` holding `benches/data/config.toml`,
//! so nothing reads or writes your real `~/.ciphey` and the first-run wizard never starts.
//! The scratch dir is removed afterwards.
//!
//! Run: `cargo bench --bench startup`

mod common;

use ciphey::config::{load_wordlist, Config};
use ciphey::decoders::crack_results::CrackResult;
use ciphey::decoders::interface::{Decoder, DefaultDecoder};
use ciphey::perform_cracking;
use ciphey::storage::database::{self, CacheEntry};
use criterion::{criterion_group, criterion_main, BatchSize, Criterion, SamplingMode};
use std::hint::black_box;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Already plaintext, so `perform_cracking` returns before searching.
const PLAINTEXT: &str =
    "Meet me at the old lighthouse after midnight and bring the map, the key and a torch.";
/// `PLAINTEXT` in base64: one search step.
const BASE64: &str = "TWVldCBtZSBhdCB0aGUgb2xkIGxpZ2h0aG91c2UgYWZ0ZXIgbWlkbmlnaHQgYW5kIGJyaW5nIHRoZSBtYXAsIHRoZSBrZXkgYW5kIGEgdG9yY2gu";
/// Never inserted, for cache misses.
const NOT_CACHED: &str = "this text is never written to the cache";

/// Scratch dir under `target/`, removed on drop.
struct TempDir(PathBuf);

impl TempDir {
    fn new() -> Self {
        // CARGO_TARGET_TMPDIR is Cargo's scratch space for benches and integration tests,
        // fixed at compile time (`target/tmp`).
        let path = Path::new(env!("CARGO_TARGET_TMPDIR"))
            .join(format!("ciphey-bench-startup-{}", std::process::id()));
        std::fs::create_dir_all(path.join(".ciphey")).expect("could not create scratch dir");
        std::fs::copy(
            common::data_path("config.toml"),
            path.join(".ciphey").join("config.toml"),
        )
        .expect("could not copy config.toml");
        TempDir(path)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn startup(c: &mut Criterion) {
    let home = TempDir::new();
    // Safe here: nothing else is running yet. `dirs::home_dir` reads HOME on Unix.
    std::env::set_var("HOME", &home.0);
    let db_path = home.0.join("bench.sqlite");
    database::DB_PATH
        .set(Some(db_path.clone()))
        .expect("the database path was already set");
    ciphey::config::set_global_config(common::bench_config());

    config_benches(c);
    cache_benches(c, &db_path);
    #[cfg(unix)]
    cli_benches(c, &home.0);
    #[cfg(not(unix))]
    eprintln!("skipping startup/cli: HOME can only be redirected on Unix");
}

fn config_benches(c: &mut Criterion) {
    let mut group = c.benchmark_group("startup/config");
    group
        .warm_up_time(Duration::from_millis(500))
        .measurement_time(Duration::from_secs(2));

    group.bench_function("default", |b| b.iter(Config::default));

    // What the CLI does first: read and parse ~/.ciphey/config.toml (HOME is the scratch dir).
    #[cfg(unix)]
    {
        let loaded = ciphey::config::get_config_file_into_struct();
        assert_eq!(loaded.timeout, 5, "did not read benches/data/config.toml");
        group.bench_function("load_config_file", |b| {
            b.iter(ciphey::config::get_config_file_into_struct)
        });
    }

    let wordlist = common::data_path("wordlist.txt");
    assert_eq!(load_wordlist(&wordlist).unwrap().len(), 5000);
    group.bench_function("load_wordlist_5k", |b| {
        b.iter(|| load_wordlist(black_box(&wordlist)).unwrap())
    });
    group.finish();
}

fn cache_entry(text: &str) -> CacheEntry {
    let mut step = CrackResult::new(&Decoder::<DefaultDecoder>::default(), text.to_string());
    step.unencrypted_text = Some(vec![text.to_string()]);
    CacheEntry {
        uuid: uuid::Uuid::new_v4(),
        encoded_text: text.to_string(),
        decoded_text: text.to_string(),
        path: vec![step],
        execution_time_ms: 1,
    }
}

fn cache_benches(c: &mut Criterion, db_path: &Path) {
    database::setup_database().expect("could not create the cache database");
    database::insert_cache(&cache_entry(PLAINTEXT)).expect("could not seed the cache");

    let mut group = c.benchmark_group("startup/cache");
    group
        .warm_up_time(Duration::from_millis(500))
        .measurement_time(Duration::from_secs(2));
    group.bench_function("setup_database", |b| {
        b.iter(|| database::setup_database().unwrap())
    });
    let missing = NOT_CACHED.to_string();
    assert!(database::read_cache(&missing).unwrap().is_none());
    group.bench_function("read_miss", |b| {
        b.iter(|| database::read_cache(black_box(&missing)).unwrap())
    });
    let present = PLAINTEXT.to_string();
    assert!(database::read_cache(&present).unwrap().is_some());
    group.bench_function("read_hit", |b| {
        b.iter(|| database::read_cache(black_box(&present)).unwrap())
    });
    // A new row each iteration, committed (and synced) like a real run.
    group.bench_function("insert", |b| {
        b.iter_batched(
            || cache_entry(NOT_CACHED),
            |entry| database::insert_cache(&entry).unwrap(),
            BatchSize::SmallInput,
        )
    });
    database::delete_cache(NOT_CACHED).unwrap();
    group.finish();

    let mut group = c.benchmark_group("startup/perform_cracking");
    group
        .warm_up_time(Duration::from_millis(500))
        .measurement_time(Duration::from_secs(3));
    let hit = perform_cracking(PLAINTEXT, common::bench_config()).unwrap();
    assert_eq!(hit.unwrap().text[0], PLAINTEXT);
    group.bench_function("plaintext_cache_hit", |b| {
        b.iter_batched(
            common::bench_config,
            |config| perform_cracking(black_box(PLAINTEXT), config),
            BatchSize::SmallInput,
        )
    });
    // Remove the row before every iteration so each one misses and writes it back.
    group.bench_function("plaintext_cache_miss", |b| {
        b.iter_batched(
            || {
                database::delete_cache(PLAINTEXT).unwrap();
                common::bench_config()
            },
            |config| perform_cracking(black_box(PLAINTEXT), config),
            BatchSize::PerIteration,
        )
    });
    group.finish();
    let _ = std::fs::remove_file(db_path);
}

#[cfg(unix)]
fn cli_benches(c: &mut Criterion, home: &Path) {
    use std::process::{Command, Stdio};

    let db = home.join(".ciphey").join("database.sqlite");
    let run = |text: &str| {
        let status = Command::new(env!("CARGO_BIN_EXE_ciphey"))
            .args(["--disable-human-checker", "--text", text])
            .env("HOME", home)
            .env_remove("RUST_LOG")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .expect("could not start the ciphey binary");
        assert!(status.success(), "ciphey exited with {status}");
    };
    let output = Command::new(env!("CARGO_BIN_EXE_ciphey"))
        .args(["--disable-human-checker", "--text", BASE64])
        .env("HOME", home)
        .env("NO_COLOR", "1")
        .env_remove("RUST_LOG")
        .stdin(Stdio::null())
        .output()
        .expect("could not start the ciphey binary");
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        stdout.contains(PLAINTEXT),
        "unexpected CLI output: {stdout}"
    );

    let mut group = c.benchmark_group("startup/cli");
    group
        .sampling_mode(SamplingMode::Flat)
        .sample_size(20)
        .warm_up_time(Duration::from_secs(1))
        .measurement_time(Duration::from_secs(4));
    // Cache hit: the cheapest possible run.
    run(PLAINTEXT);
    group.bench_function("plaintext_cache_hit", |b| b.iter(|| run(PLAINTEXT)));
    // Fresh database: create the schema, check the input, store the result.
    group.bench_function("plaintext_fresh_db", |b| {
        b.iter_batched(
            || {
                let _ = std::fs::remove_file(&db);
            },
            |()| run(PLAINTEXT),
            BatchSize::PerIteration,
        )
    });
    // Fresh database plus a one-step search.
    group.bench_function("base64_fresh_db", |b| {
        b.iter_batched(
            || {
                let _ = std::fs::remove_file(&db);
            },
            |()| run(BASE64),
            BatchSize::PerIteration,
        )
    });
    group.finish();
}

criterion_group!(benches, startup);
criterion_main!(benches);

```

### Core Architecture Module: `examples/decode.rs`
```
//! Runs single Ciphey decoders and the plaintext detector through the library API.
//!
//! ```sh
//! cargo run --example decode                                # a short tour
//! cargo run --example decode -- list                        # every decoder and its key
//! cargo run --example decode -- caesar 'Uryyb jbeyq'        # crack with one decoder
//! cargo run --example decode -- vigenere 'Rijvs uyvjn' KEY  # decrypt with a key
//! cargo run --example decode -- detect 192.168.0.1          # is it plaintext?
//! ```

use std::process::ExitCode;

use ciphey::detection::{detect_plaintext, DetectOptions, Detection};
use ciphey::{decode_with, decoders, list_decoders, CipheyError, DecodeOptions, Decoded};

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let result = match args.as_slice() {
        [] => tour(),
        ["list"] => {
            list();
            Ok(())
        }
        ["detect", text] => {
            detect(text);
            Ok(())
        }
        [decoder, text] => decode(decoder, text, None),
        [decoder, text, key] => decode(decoder, text, Some(key)),
        _ => {
            eprintln!("usage: decode [list | detect <text> | <decoder> <text> [<key>]]");
            return ExitCode::from(2);
        }
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::FAILURE
        }
    }
}

/// Shows each part of the API once.
fn tour() -> Result<(), CipheyError> {
    println!("An encoding, with its function:");
    show(&decoders::base64("aGVsbG8gd29ybGQ="));

    println!("\nA cipher without its key, cracked:");
    show(&decoders::caesar("Uryyb jbeyq"));

    println!("\nThe same cipher with its key:");
    show(&decoders::caesar_with_key("Uryyb jbeyq", 13));

    println!("\nA decoder picked by name (an alias here), with a key:");
    show(&decode_with(
        "vigenère",
        "Rijvs uyvjn",
        &DecodeOptions::with_key("KEY"),
    )?);

    println!("\nWhen no decoding passes the checks, you get them all:");
    let decoded = decoders::caesar("xkcd");
    println!(
        "  {} candidates from {}, none marked as plaintext",
        decoded.candidates.len(),
        decoded.decoder
    );

    println!("\nPlaintext detection:");
    for text in ["192.168.0.1", "hello there general", "aGVsbG8gdGhlcmU="] {
        detect(text);
    }

    println!(
        "\n{} decoders in all: cargo run --example decode -- list",
        list_decoders().len()
    );
    Ok(())
}

/// Lists every decoder, with its aliases and the key it takes.
fn list() {
    for decoder in list_decoders() {
        let mut names = vec![decoder.function];
        names.extend(decoder.aliases);
        println!("{} ({})", decoder.name, names.join(", "));
        if let Some(key) = decoder.key_format {
            println!("    key: {key}");
        }
    }
}

/// Runs one decoder by name, cracking or decrypting with `key`.
fn decode(decoder: &str, text: &str, key: Option<&str>) -> Result<(), CipheyError> {
    let options = match key {
        Some(key) => DecodeOptions::with_key(key),
        None => DecodeOptions::default(),
    };
    show(&decode_with(decoder, text, &options)?);
    Ok(())
}

/// Says whether `text` is plaintext and what it is.
fn detect(text: &str) {
    match detect_plaintext(text, &DetectOptions::default()) {
        Some(detection) => println!("  {text:?}: {}", describe(&detection)),
        None => println!("  {text:?}: not plaintext"),
    }
}

/// Prints a decoder's candidates, the accepted one marked with a tick.
fn show(decoded: &Decoded) {
    if decoded.is_empty() {
        println!(
            "  {}: nothing, the text isn't in its format",
            decoded.decoder
        );
    }
    for candidate in decoded.candidates.iter().take(5) {
        let mark = if candidate.is_plaintext() { '✓' } else { ' ' };
        print!("  {mark} {}: {:?}", decoded.decoder, candidate.text);
        if let Some(key) = &candidate.key {
            print!(" (key {key})");
        }
        if let Some(detection) = &candidate.detection {
            print!(", {}", describe(detection));
        }
        println!();
    }
    if decoded.candidates.len() > 5 {
        println!("    and {} more", decoded.candidates.len() - 5);
    }
}

/// What a checker found, in words.
fn describe(detection: &Detection) -> String {
    match detection.confidence {
        Some(confidence) => format!(
            "{} (by the {}, confidence {confidence})",
            detection.description, detection.checker
        ),
        None => format!("{} (by the {})", detection.description, detection.checker),
    }
}

```

### Core Architecture Module: `src/api_library_input_struct.rs`
```
/// import general checker
use crate::checkers::{
    checker_type::{Check, Checker},
    default_checker::DefaultChecker,
};
use lemmeknow::Identifier;
use std::collections::HashSet;

/// Library input is the default API input
/// The CLI turns its arguments into a LibraryInput struct
#[allow(dead_code)]
pub struct LibraryInput<Type> {
    /// The input to be decoded.
    /// Given to us by the user.
    pub encoded_text: String,
    /// A level of verbosity to determine.
    /// How much we print in logs.
    pub verbose: i32,
    /// The checker to use
    pub checker: Checker<Type>,
    /// The lemmeknow config to use
    pub lemmeknow_config: Identifier,
    /// Pre-loaded wordlist (allows library users to provide wordlist directly)
    pub wordlist: Option<HashSet<String>>,
}

/// Creates a default lemmeknow config
// Only reachable through `LibraryInput::default()`, which is currently unused
// (see `cli_input_parser::_main`). Kept for the library API.
#[allow(dead_code)]
const LEMMEKNOW_DEFAULT_CONFIG: Identifier = Identifier {
    min_rarity: 0.0,
    max_rarity: 0.0,
    tags: vec![],
    exclude_tags: vec![],
    file_support: false,
    boundaryless: false,
};

impl Default for LibraryInput<DefaultChecker> {
    fn default() -> Self {
        LibraryInput {
            encoded_text: String::new(),
            // this will be of type Checker<DefaultChecker>
            verbose: 0,
            checker: Checker::new(),
            lemmeknow_config: LEMMEKNOW_DEFAULT_CONFIG,
            wordlist: None,
        }
    }
}

impl<Type> LibraryInput<Type> {
    /// Set a pre-loaded wordlist
    ///
    /// This method is part of the public API for library users who want to provide
    /// a pre-loaded wordlist directly. While it may not be used internally yet,
    /// it's maintained for API compatibility and future use cases.
    #[allow(dead_code)]
    pub fn with_wordlist(mut self, wordlist: HashSet<String>) -> Self {
        self.wordlist = Some(wordlist);
        self
    }
}

```

### Core Architecture Module: `src/bin/ciphey-mcp/decode_with.rs`
```
//! The `list_decoders` and `decode_with` tools: list the decoders, and run one of them,
//! chosen by name, with [`ciphey::list_decoders`] and [`ciphey::decode_with`].

use ciphey::{Candidate, DecodeOptions, Decoded};
use rmcp::schemars;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;

use crate::detect::DetectionOutput;
use crate::server::{check_length, check_regex, MAX_INPUT_CHARS, MAX_REGEX_CHARS};

/// Longest `decoder` that `decode_with` accepts, in characters. The longest name is far
/// shorter.
pub const MAX_DECODER_NAME_CHARS: usize = 100;
/// Most candidates a `decode_with` result lists. The ROT47 cracker returns the most, 93.
pub const MAX_CANDIDATES: usize = 100;
/// Most characters of candidate text in a `decode_with` result, all candidates together, as
/// they are written in JSON (see [`json_chars`]). Without a limit, cracking ROT47 on 65,536
/// characters would return 6 million.
pub const MAX_OUTPUT_CHARS: usize = 65_536;

/// Result of the `list_decoders` tool.
#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct DecoderList {
    /// Every decoder ciphey has, sorted by `id`.
    pub decoders: Vec<DecoderInfo>,
}

/// A decoder ciphey can apply.
#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct DecoderInfo {
    /// What to pass to `decode_with` as `decoder`, such as `base64` or `caesar`.
    pub id: String,
    /// The decoder's name, as `decode` paths and `decode_with` results show it, such as
    /// `Base64` or `caesar`. `decode_with` accepts it too.
    pub name: String,
    /// Other names `decode_with` accepts, such as `b64` or `rot13`.
    pub aliases: Vec<String>,
    /// What the decoder handles.
    pub description: String,
    /// Where to read more.
    pub link: String,
    /// Categories such as `base`, `substitution`, `classic` or `decoder`.
    pub tags: Vec<String>,
    /// The key `decode_with` can decrypt with and how to write it, or null if the decoder
    /// takes no key. Without a key, ciphers are cracked and encodings decoded.
    pub key_format: Option<String>,
}

impl DecoderList {
    /// Every decoder the library can run on its own.
    pub fn all() -> Self {
        Self {
            decoders: ciphey::list_decoders()
                .iter()
                .map(DecoderInfo::from)
                .collect(),
        }
    }
}

impl From<&ciphey::DecoderInfo> for DecoderInfo {
    fn from(info: &ciphey::DecoderInfo) -> Self {
        Self {
            id: info.function.to_string(),
            name: info.name.to_string(),
            aliases: info.aliases.iter().map(|alias| alias.to_string()).collect(),
            description: info.description.to_string(),
            link: info.link.to_string(),
            tags: info.tags.iter().map(|tag| tag.to_string()).collect(),
            key_format: info.key_format.map(str::to_string),
        }
    }
}

/// Arguments of the `decode_with` tool.
#[derive(Debug, Default, Deserialize, schemars::JsonSchema)]
pub struct DecodeWithParams {
    /// The decoder or cipher to run: an `id` from `list_decoders`, or its name or an alias,
    /// in any case, such as `base64`, `hexadecimal`, `morse`, `caesar`, `rot13`, `vigenere`,
    /// `xor_single_byte` or `railfence`.
    #[schemars(length(min = 1, max = MAX_DECODER_NAME_CHARS))]
    pub decoder: String,
    /// The text to decode, decrypt or crack (at most 65536 characters).
    #[schemars(length(min = 1, max = MAX_INPUT_CHARS))]
    pub text: String,
    /// Decrypt with this key instead of cracking (at most 65536 characters). Only for
    /// decoders whose `key_format` in `list_decoders` isn't null, written as it says: `13`
    /// for caesar, `LEMON` for vigenere, `a=5, b=8` for affine, `rails=3, offset=1` for
    /// railfence, `0x58` for xor_single_byte. Leave it out to crack the cipher (every key is
    /// tried) or to decode an encoding.
    #[serde(default, deserialize_with = "string_or_number")]
    #[schemars(with = "Option<String>", length(max = MAX_INPUT_CHARS))]
    pub key: Option<String>,
    /// A regex or crib, such as a flag format like `flag\{` (at most 1000 characters). When
    /// set, only decodings that match it pass the plaintext check, which helps crack a cipher
    /// whose plaintext isn't English.
    #[schemars(length(max = MAX_REGEX_CHARS))]
    pub regex: Option<String>,
}

/// Reads an optional key given as a string or, as models often send a Caesar shift, as a
/// number (`13`).
fn string_or_number<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<String>, D::Error> {
    match Option::<Value>::deserialize(deserializer)? {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(key)) => Ok(Some(key)),
        Some(Value::Number(key)) => Ok(Some(key.to_string())),
        Some(other) => Err(serde::de::Error::custom(format!(
            "`key` must be a string, such as \"13\" or \"LEMON\", not {other}"
        ))),
    }
}

impl DecodeWithParams {
    /// Checks the input limits, finds the decoder and checks that it takes the key, if there
    /// is one. An `Err` tells the caller what to fix.
    pub fn into_request(self) -> Result<DecodeWithRequest, String> {
        let name = self.decoder.trim();
        if name.is_empty() {
            return Err(format!(
                "`decoder` is empty: pass the id of a decoder, one of {}",
                decoder_ids(|_| true)
            ));
        }
        check_length("decoder", name, MAX_DECODER_NAME_CHARS)?;
        let Some(info) = ciphey::decoder_info(name) else {
            return Err(format!(
                "no decoder is called {name:?}. Pass one of these ids, or a name or alias from \
                 `list_decoders`: {}",
                decoder_ids(|_| true)
            ));
        };
        if self.text.is_empty() {
            return Err("`text` is empty: pass the text to decode".to_string());
        }
        check_length("text", &self.text, MAX_INPUT_CHARS)?;
        // Clients often send "" for an optional argument they don't use.
        let key = self.key.filter(|key| !key.is_empty());
        if let Some(key) = &key {
            if !info.accepts_key() {
                return Err(format!(
                    "{} doesn't take a key: leave `key` out to decode or crack the text. These \
                     decoders take one: {}",
                    info.name,
                    decoder_ids(ciphey::DecoderInfo::accepts_key)
                ));
            }
            check_length("key", key, MAX_INPUT_CHARS)?;
        }
        Ok(DecodeWithRequest {
            decoder: info.function.to_string(),
            text: self.text,
            key,
            regex: check_regex(self.regex)?,
        })
    }
}

/// The ids of the decoders `wanted` picks, for error messages.
fn decoder_ids(wanted: impl Fn(&ciphey::DecoderInfo) -> bool) -> String {
    let ids: Vec<&str> = ciphey::list_decoders()
        .iter()
        .filter(|info| wanted(info))
        .map(|info| info.function)
        .collect();
    ids.join(", ")
}

/// A validated `decode_with` call, sent from the server to a worker.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DecodeWithRequest {
    /// The decoder's id, as [`ciphey::decode_with`] takes it.
    pub decoder: String,
    /// The text to decode.
    pub text: String,
    /// Decrypt with this key instead of cracking.
    pub key: Option<String>,
    /// Only accept plaintext that matches this regex. The worker puts it in the library's
    /// config, which the decoders' checks follow.
    pub regex: Option<String>,
}

/// Runs the decoder `request` asks for. Called in a worker, which has put `request.regex`
/// in the library's config.
pub fn run(request: &DecodeWithRequest) -> Result<DecodeWithOutput, String> {
    let options = match &request.key {
        Some(key) => DecodeOptions::with_key(key.clone()),
        None => DecodeOptions::default(),
    };
    ciphey::decode_with(&request.decoder, &request.text, &options)
        .map(DecodeWithOutput::from_decoded)
        .map_err(|error| error.to_string())
}

/// How a `decode_with` call ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum DecodeWithStatus {
    /// A candidate passed the plaintext check. It comes first.
    PlaintextFound,
    /// The decoder gave candidates, but none passed the plaintext check: judge them
    /// yourself.
    NoPlaintext,
    /// The decoder gave nothing, usually because the text isn't in its format.
    NoCandidates,
}

/// Result of the `decode_with` tool.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct DecodeWithOutput {
    /// The decoder that ran, by name, as `list_decoders` and `decode` paths show it.
    pub decoder: String,
    /// `plaintext_found`, `no_plaintext` or `no_candidates`.
    pub status: DecodeWithStatus,
    /// The decodings, the one that passed the plaintext check first. Without a key, a
    /// decoder whose check accepts a decoding returns only that one. Otherwise it returns
    /// what it would hand on to ciphey's search, unfiltered: all 25 Caesar shifts, say, or
    /// the best few keys of crackers with many keys.
    pub candidates: Vec<CandidateOutput>,
    /// How many candidates the decoder returned. More than are listed if some were left out
    /// to keep the result to 100 candidates and 65536 characters of text (as JSON writes it,
    /// so an escaped control character such as `\u0001` counts as 6).
    pub total_candidates: usize,
}

/// One decoding of the text.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct CandidateOutput {
    /// The decoded text.
    pub text: String,
    /// Whether `text` was cut short to keep the result to 65536 characters of text.
    pub truncated: bool,
    /// The key that gave this tex
```

### Core Architecture Module: `src/bin/ciphey-mcp/detect.rs`
```
//! The `detect_plaintext` tool: runs ciphey's plaintext checks on a text, with
//! [`ciphey::detect_plaintext`], and says which checker accepted it and what it took it for.

use ciphey::detection::{CheckerKind, DetectOptions, Detection, Sensitivity};
use rmcp::schemars;
use serde::{Deserialize, Serialize};

use crate::server::{check_length, check_regex, MAX_INPUT_CHARS, MAX_REGEX_CHARS};

/// Arguments of the `detect_plaintext` tool.
#[derive(Debug, Default, Deserialize, schemars::JsonSchema)]
pub struct DetectParams {
    /// The text to check (at most 65536 characters). It is checked as it is: nothing is
    /// decoded first.
    #[schemars(length(min = 1, max = MAX_INPUT_CHARS))]
    pub text: String,
    /// The checkers to run, by default all three. `lemmeknow` recognises over 100 formats
    /// (IP and email addresses, URLs, API keys and tokens, crypto wallets, credit card
    /// numbers, CTF flags, ...), `password` matches common passwords and `english` accepts
    /// English text. They run in that order, and the first to accept the text answers.
    pub checkers: Option<Vec<CheckerChoice>>,
    /// How readily the English checker takes text for English: `low` is the strictest,
    /// `medium` the default, and `high` the most lenient (it accepts English with typos,
    /// names or other noise in it, and more gibberish). The other checkers ignore it.
    pub sensitivity: Option<SensitivityChoice>,
    /// A regex or crib, such as `^flag\{` (at most 1000 characters). On its own it is the
    /// only check, as in `decode`: text it matches is plaintext. Pass `checkers` as well to
    /// run them after it.
    #[schemars(length(max = MAX_REGEX_CHARS))]
    pub regex: Option<String>,
}

/// A checker `detect_plaintext` can be asked to run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
#[schemars(inline)]
pub enum CheckerChoice {
    // The variants have no doc comments on purpose: with them, schemars describes the enum
    // with `oneOf`, which some MCP clients don't understand, instead of a plain `enum`.
    Lemmeknow,
    Password,
    English,
}

impl From<CheckerChoice> for CheckerKind {
    fn from(choice: CheckerChoice) -> Self {
        match choice {
            CheckerChoice::Lemmeknow => CheckerKind::LemmeKnow,
            CheckerChoice::Password => CheckerKind::Password,
            CheckerChoice::English => CheckerKind::English,
        }
    }
}

/// How lenient the English checker is, see [`DetectParams::sensitivity`].
#[derive(
    Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema,
)]
#[serde(rename_all = "snake_case")]
#[schemars(inline)]
pub enum SensitivityChoice {
    // No doc comments, as for `CheckerChoice`.
    Low,
    #[default]
    Medium,
    High,
}

impl From<SensitivityChoice> for Sensitivity {
    fn from(choice: SensitivityChoice) -> Self {
        match choice {
            SensitivityChoice::Low => Sensitivity::Low,
            SensitivityChoice::Medium => Sensitivity::Medium,
            SensitivityChoice::High => Sensitivity::High,
        }
    }
}

impl DetectParams {
    /// Checks the input limits and fills in defaults. An `Err` tells the caller what to fix.
    pub fn into_request(self) -> Result<DetectRequest, String> {
        if self.text.is_empty() {
            return Err("`text` is empty: pass the text to check".to_string());
        }
        check_length("text", &self.text, MAX_INPUT_CHARS)?;
        let request = DetectRequest {
            text: self.text,
            checkers: self.checkers,
            sensitivity: self.sensitivity.unwrap_or_default(),
            regex: check_regex(self.regex)?,
        };
        if request.options()?.enabled_checkers().next().is_none() {
            return Err(
                "there are no checkers to run: list at least one of `lemmeknow`, \
                 `password` and `english` in `checkers`, or pass a `regex`"
                    .to_string(),
            );
        }
        Ok(request)
    }
}

/// A validated `detect_plaintext` call, sent from the server to a worker.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DetectRequest {
    /// The text to check.
    pub text: String,
    /// The checkers to run, or `None` for the default ones (or only the crib, if there is
    /// one).
    pub checkers: Option<Vec<CheckerChoice>>,
    /// How lenient the English checker is.
    pub sensitivity: SensitivityChoice,
    /// A crib, checked before the other checkers.
    pub regex: Option<String>,
}

impl DetectRequest {
    /// The library's options for this request.
    pub fn options(&self) -> Result<DetectOptions, String> {
        let mut options = DetectOptions::new().sensitivity(self.sensitivity.into());
        if let Some(pattern) = &self.regex {
            // Turns the other checkers off, as `ciphey --regex` does.
            options = options
                .regex(pattern)
                .map_err(|error| format!("`regex` is not a valid regular expression: {error}"))?;
        }
        if let Some(checkers) = &self.checkers {
            let crib = self.regex.as_ref().map(|_| CheckerKind::Regex);
            options = options.checkers(crib.into_iter().chain(checkers.iter().map(|&c| c.into())));
        }
        Ok(options)
    }
}

/// Runs the checks `request` asks for. Called in a worker.
pub fn run(request: &DetectRequest) -> Result<DetectOutput, String> {
    let options = request.options()?;
    let detection = ciphey::detect_plaintext(&request.text, &options);
    Ok(DetectOutput {
        is_plaintext: detection.is_some(),
        detection: detection.as_ref().map(DetectionOutput::from),
        checkers: options
            .enabled_checkers()
            .map(|kind| kind.id().to_string())
            .collect(),
    })
}

/// Result of the `detect_plaintext` tool.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct DetectOutput {
    /// Whether one of the checkers accepted the text as plaintext.
    pub is_plaintext: bool,
    /// What the checker that accepted the text found. Null if none accepted it.
    pub detection: Option<DetectionOutput>,
    /// The checkers that ran, in order, such as `["lemmeknow", "password", "english"]`.
    pub checkers: Vec<String>,
}

/// What one of ciphey's plaintext checkers found.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, schemars::JsonSchema)]
pub struct DetectionOutput {
    /// The checker that accepted the text: `regex` (the crib), `lemmeknow`, `password`,
    /// `english`, or `jwt_structure` (a well-formed JSON Web Token, only in `decode_with`
    /// results of the JWT decoder).
    pub checker: String,
    /// What the checker took the text for: `Words` for English, the name of the format
    /// LemmeKnow matched, such as `Internet Protocol (IP) Address Version 4`,
    /// `Common Password`, or `Regex matched: <pattern>`.
    pub description: String,
    /// How sure the checker is, from 0 to 1, if it has a measure of it. Only LemmeKnow does:
    /// the rarity of the format it matched, 1 for formats little else matches (an AWS S3
    /// URL), less for broad ones (0.7 for an IP address or a URL, 0.5 for an email address).
    /// Null for the other checkers, which answer yes or no.
    pub confidence: Option<f64>,
}

impl From<&Detection> for DetectionOutput {
    fn from(detection: &Detection) -> Self {
        Self {
            checker: detection.checker.id().to_string(),
            description: detection.description.clone(),
            confidence: detection.confidence.map(tidy_confidence),
        }
    }
}

/// `confidence` as the `f64` with the same shortest decimal form, so that 0.7 is sent as
/// 0.7 and not as 0.699999988079071.
fn tidy_confidence(confidence: f32) -> f64 {
    confidence
        .to_string()
        .parse()
        .unwrap_or_else(|_| f64::from(confidence))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params(text: &str) -> DetectParams {
        DetectParams {
            text: text.to_string(),
            ..DetectParams::default()
        }
    }

    fn detect(params: DetectParams) -> DetectOutput {
        run(&params.into_request().unwrap()).unwrap()
    }

    #[test]
    fn into_request_applies_defaults() {
        assert_eq!(
            params("192.168.0.1").into_request().unwrap(),
            DetectRequest {
                text: "192.168.0.1".to_string(),
                checkers: None,
                sensitivity: SensitivityChoice::Medium,
                regex: None,
            }
        );
    }

    #[test]
    fn into_request_checks_the_limits() {
        let error = params("").into_request().unwrap_err();
        assert!(error.contains("`text` is empty"), "{error}");

        assert!(params(&"é".repeat(MAX_INPUT_CHARS)).into_request().is_ok());
        let error = params(&"é".repeat(MAX_INPUT_CHARS + 1))
            .into_request()
            .unwrap_err();
        assert!(error.contains("the limit is 65536"), "{error}");

        let error = DetectParams {
            regex: Some("(unclosed".to_string()),
            ..params("hi")
        }
        .into_request()
        .unwrap_err();
        assert!(error.contains("not a valid regular expression"), "{error}");

        let error = DetectParams {
            regex: Some("a".repeat(MAX_REGEX_CHARS + 1)),
            ..params("hi")
        }
        .into_request()
        .unwrap_err();
        assert!(error.contains("the limit is 1000"), "{error}");
    }

    #[test]
    fn into_request_needs_a_checker_to_run() {
        let error = DetectParams {
            checkers: Some(Vec::new()),
            ..params("hello there general")
        }
        .into_request()
        .unwrap_err();
        assert!(error.contains("no checkers to run"), "{error}");

        // A crib on its own is enough, and "" means no crib, as clients send 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #908** (2026-10-01): **index out of bounds**
  *Symptoms*: Westdoor@DESKTOP-P9V3VCT MINGW64 ~/Downloads/ciphey-windows-x86_64 $ ./ciphey.exe -t "Mjc1NjI2ZDY1N2U2ZjU1NjY3OTY2Ng=="  thread '<unnamed>' (18928) panicked at src\decoders\vigenere_decoder.rs:169:41: index out of bounds: the len is 26 but the index is 149 note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace 

- **Issue #903** (2026-10-01): **[BUG] Windows-CLI color syntax**
  *Symptoms*: ciphey -f asdf.txt --enable-enhanced-detection ←[0m←[1m←[38;2;255;255;255mEnhanced detection enabled.←[0m  thread '<unnamed>' (20012) panicked at src\decoders\vigenere_decoder.rs:169:41: index out of bounds: the len is 26 but the index is 59 note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace  
  **Post-Mortem & Fix Analysis**:
  > Ai suggest: works   <img width="665" height="326" alt="Image" src="https://github.com/user-attachments/assets/773847dd-e2ce-4467-b78d-d3cb3c0cbc0f" /> 

- **Issue #902** (2026-10-01): **[BUG] index out of bounds**
  *Symptoms*: ciphey -f asdf.txt  thread '<unnamed>' (18316) panicked at src\decoders\vigenere_decoder.rs:169:41: index out of bounds: the len is 26 but the index is 59 note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace  on windows, x64 win10 
  **Post-Mortem & Fix Analysis**:
  > Ai suggest:   <img width="671" height="442" alt="Image" src="https://github.com/user-attachments/assets/527d5e04-20df-40ce-a1b6-fca9b080af10" />

- **Issue #823** (2026-06-01): **Brew does not find a package named "ciphey"**
  *Symptoms*: <!--**⚠️IMPORTANT⚠️ if you do not fill this out, we will automatically delete your issue. We will not help anyone that cannot fill out this template.**-->  - [X] Have you read our [Wiki page "Common Issues & Their Solutions"?](https://github.com/Ciphey/Ciphey/wiki/Common-Issues-&-Their-Solutions)  **Describe the bug** When trying to install Chiphey from brew, pasting the `brew install ciphey` command as listed in README, an error happens. Search on homebrew site also doesn't fetch results.  A report for this seems to exist in #820, but it doesn't fully follow report format and probably hence is ignored (at least emoji-filled warnings warned it may be).  **Plaintext** <!--**⚠️IMPORTANT⚠️ The below code is non-negotiable for "Ciphey didn't decrypt...." problems. If you do not tell us your plaintext, we will not help you.** -->  <pre><font color="#26A269"><b>user@fedora</b></font>:<font color="#26A269"><b>~</b></font>$ brew install ciphey <font color="#A2734C">Warning:</font> No available formula with the name &quot;ciphey&quot;. <font color="#12488B">==&gt;</font> <b>Searching for similarly named formulae and casks...</b> <font color="#C01C28">Error:</font> No formulae or casks found for ciphey. </pre>  **Version** <!--**⚠️IMPORTANT⚠️ We need this information because different environments will induce different bugs in Ciphey**-->  - OS/Distro:  ```bash user@fedora:~$ cat /etc/os-release NAME="Fedora Linux" VERSION="41 (Workstation Edition)" RELEASE_TYPE=stable ID=fedora VERSIO
  **Post-Mortem & Fix Analysis**:
  > i have the same problem
  > i have the same problem
  > try to install it using pip or clone and just build it

- **Issue #820** (2026-04-15): **brew install ciphey  is falure?**
  *Symptoms*: **⚠️IMPORTANT⚠️ if you do not fill this out, we will automatically delete your issue. We will not help anyone that cannot fill out this template.**  - [ ] Have you read our [Wiki page "Common Issues & Their Solutions"?](https://github.com/Ciphey/Ciphey/wiki/Common-Issues-&-Their-Solutions)  **Describe the bug** A clear and concise description of what the bug is.  **Plaintext** **⚠️IMPORTANT⚠️ The below code is non-negotiable for "Ciphey didn't decrypt...." problems. If you do not tell us your plaintext, we will not help you.**   ``` brew install ciphey ==> Auto-updating Homebrew... ==> Auto-updated Homebrew! ==> Updated Homebrew from e4e75f5474 to 1cfc303969. ==> Downloading https://formulae.brew.sh/api/formula.jws.json ==> Downloading https://formulae.brew.sh/api/formula.jws.json Updated 1 tap (homebrew/cask). ==> New Casks burp-suite-professional@early-adopter burp-suite@early-adopter  You have 1 outdated formula installed.  ==> Downloading https://formulae.brew.sh/api/cask.jws.json Warning: cask.jws.json: update failed, falling back to cached version. ==> Downloading https://formulae.brew.sh/api/cask.jws.json Warning: No available formula with the name "ciphey". ==> Searching for similarly named formulae and casks... ==> Casks clipy  To install clipy, run: brew install --cask clipy ``` **Version** **⚠️IMPORTANT⚠️ We need this information because different environments will induce different bugs in Ciphey** Mac 15.4.1 (24E263)  **Verbose Output** **⚠️IMPORTANT⚠️ Verbose out

- **Issue #814** (2025-03-04): **win11 执行报错**
  *Symptoms*: **⚠️IMPORTANT⚠️ if you do not fill this out, we will automatically delete your issue. We will not help anyone that cannot fill out this template.**  - [ ] Have you read our [Wiki page "Common Issues & Their Solutions"?](https://github.com/Ciphey/Ciphey/wiki/Common-Issues-&-Their-Solutions)  **Describe the bug** A clear and concise description of what the bug is.  **Plaintext** **⚠️IMPORTANT⚠️ The below code is non-negotiable for "Ciphey didn't decrypt...." problems. If you do not tell us your plaintext, we will not help you.**   ``` Include your plaintext here, replacing this  ``` **Version** **⚠️IMPORTANT⚠️ We need this information because different environments will induce different bugs in Ciphey**  - OS/Distro: [e.g. Windows, Debian 11.0, Arch, OS X El Capitan]  - Python version: [python3 --version]  - Ciphey versions: [python3 -m pip show ciphey cipheycore cipheydists]  - Did you use Docker?  **Verbose Output** **⚠️IMPORTANT⚠️ Verbose output will tell us why it's not working the way we expected it to be.** Run Ciphey with `ciphey -vvv` and paste the results into [Pastebin.com](https://pastebin.com) or a [GitHub Gist](https://gist.github.com/)  **To Reproduce** Steps to reproduce the behavior: 1. What input did you use? 2. What flags / arguments did you use?  **Expected behavior** A clear and concise description of what you expected to happen.  **Any other information?** Add any other context about the problem here. ![image](https://githu

- **Issue #810** (2025-03-04): **no reponse / long time/timeout**
  *Symptoms*: ```sh docker run -it --rm remnux/ciphey -t "E+/DxMOXoKraZHnFNND51Q==" -v ```
  **Post-Mortem & Fix Analysis**:
  > cpu is hight
  > ``` 2024-11-01 10:10:46.598 | DEBUG    | ciphey.basemods.Decoders.url:decode:20 - URL successful, returning 'Y /ErNIYiLlbTIhGHOXHRR==' 2024-11-01 10:10:46.599 | DEBUG    | ciphey.basemods.Crackers.vigenere:getInfo:67 - Vigenere has likelihood 0.44116747248883803 with lens [2] 2024-11-01 10:10:46.599 | DEBUG    | ciphey.basemods.Decoders.url:decode:20 - URL successful, returning '==RRHXOHGhITblLiYINrE/ Y' 2024-11-01 10:10:46.599 | DEBUG    | ciphey.basemods.Crackers.vigenere:getInfo:67 - Vigenere has likelihood 0.44116747248883803 with lens [2] 2024-11-01 10:10:46.600 | DEBUG    | ciphey.basemods.Decoders.url:decode:20 - URL successful, returning '==IISCLSTsRGyoOrBRMiV/ B' 2024-11-01 10:10:46.600 | DEBUG    | ciphey.basemods.Crackers.vigenere:getInfo:67 - Vigenere has likelihood 0.44116747248883803 with lens [2] 2024-11-01 10:10:46.600 | DEBUG    | ciphey.basemods.Decoders.url:decode:20 - URL successful, returning '==I15CLSTsRGyoOrBRMiV/ B' 2024-11-01 10:10:46.622 | DEBUG    | c
  > 11

- **Issue #809** (2024-12-19): **Cannot install on Windows**
  *Symptoms*: **⚠️IMPORTANT⚠️ if you do not fill this out, we will automatically delete your issue. We will not help anyone that cannot fill out this template.**  - [x] Have you read our [Wiki page "Common Issues & Their Solutions"?](https://github.com/Ciphey/Ciphey/wiki/Common-Issues-&-Their-Solutions) yes  **Describe the bug** I run install command. It fails with some stack trace. I dont see ciphey added to the PATH. See the attached [command.txt](https://github.com/user-attachments/files/17530704/command.txt) to see full log of commands run (includes python version that Im using  **Plaintext** **⚠️IMPORTANT⚠️ The below code is non-negotiable for "Ciphey didn't decrypt...." problems. If you do not tell us your plaintext, we will not help you.**   ``` Include your plaintext here, replacing this  ``` **Version** **⚠️IMPORTANT⚠️ We need this information because different environments will induce different bugs in Ciphey**  - OS/Distro: Windows 10 pro (version 22H2; OS build: 19045.5011)  - Python version: Python 3.13.0  - Ciphey versions: -  - Did you use Docker? no  **Verbose Output** **⚠️IMPORTANT⚠️ Verbose output will tell us why it's not working the way we expected it to be.** Run Ciphey with `ciphey -vvv` and paste the results into [Pastebin.com](https://pastebin.com) or a [GitHub Gist](https://gist.github.com/) -  **To Reproduce** Steps to reproduce the behavior: 1. What input did you use? python -m pip install -U ciphey 2. What flags / arguments did yo
  **Post-Mortem & Fix Analysis**:
  > It is a bug in the `absl-py` library dependency. It can't correctly determine that Python 3.13 is greater than 3.4.  The easiest thing to do is just install Python 3.9 until that library fixes this issue.  https://stackoverflow.com/questions/75250036/runtimeerror-python-version-2-7-or-3-4-is-required-even-if-i-already-have-3-10
  > i got the same issues, my python version is 3.11

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

### Incident Patch 1: `0e135fc2` (2026-10-05)
**Commit Message**: fix(railfence): size zigzag by characters, not bytes (#1037)

The decoder took text.len() (bytes) positions from the zigzag but zipped them with chars(), so any input with a multi-byte character was assigned the wrong rail positions and decoded to garbled text.

Co-authored-by: Autumn Skerritt <[REDACTED_EMAIL]>

**File**: `src/decoders/railfence_decoder.rs` (modified, +16/-8)
```diff
@@ -99,9 +99,8 @@ impl Crack for Decoder<RailfenceDecoder> {
 /// rails one after another. So the ciphertext fills rail 0's positions left to right,
 /// then rail 1's, and so on: a stable counting sort of the positions by rail.
 pub(crate) fn railfence_decoder(text: &str, rails: usize, offset: usize) -> String {
-    // Positions run over the byte length, not the character count, as they always
-    // have: for non-ASCII text some positions stay empty and are skipped.
-    let len = text.len();
+    // One position per character, not per byte, so multibyte text decodes correctly.
+    let len = text.chars().count();
     let rail_of: Vec<usize> = zigzag(rails, offset).take(len).collect();
 
     // next[r]: where rail r's next position goes in the rail-by-rail order.
@@ -122,11 +121,11 @@ pub(crate) fn railfence_decoder(text: &str, rails: usize, offset: usize) -> Stri
         next[rail] += 1;
     }
 
-    let mut plaintext: Vec<Option<char>> = vec![None; len];
+    let mut plaintext = vec!['\0'; len];
     for (c, &position) in text.chars().zip(&order) {
-        plaintext[position] = Some(c);
+        plaintext[position] = c;
     }
-    plaintext.into_iter().flatten().collect()
+    plaintext.into_iter().collect()
 }
 
 /// Returns an iterator that yields the indexes of a zigzag pattern with the specified number of rails and offset
@@ -154,9 +153,12 @@ mod tests {
         CheckerTypes::CheckAthena(athena_checker)
     }
 
-    /// `railfence_decoder` as it was before the counting sort.
+    /// `railfence_decoder` as a plain sort, sized by characters.
     fn railfence_decoder_reference(text: &str, rails: usize, offset: usize) -> String {
-        let mut indexes: Vec<_> = zigzag(rails, offset).zip(1..).take(text.len()).collect();
+        let mut indexes: Vec<_> = zigzag(rails, offset)
+            .zip(1..)
+            .take(text.chars().count())
+            .collect();
         indexes.sort();
         let mut char_with_index: Vec<_> = text
             .chars()
@@ -260,6 +262,12 @@ mod tests {
         assert!(result.is_none());
     }
 
+    #[test]
+    fn railfence_decoder_counts_chars_not_bytes() {
+        // 'Ä' is two bytes; the zigzag must be sized by characters.
+        assert_eq!(railfence_decoder("ÄCEBDF", 2, 0), "ÄBCDEF");
+    }
+
     #[test]
     fn railfence_handles_panic_if_emoji() {
         // This tests if Railfence can handle an emoji
```

---

### Incident Patch 2: `509b539e` (2026-10-05)
**Commit Message**: build(deps): bump xxhash-rust (#1114)

Bumps the cargo group with 1 update in the / directory: [xxhash-rust](https://github.com/DoumanAsh/xxhash-rust).


Updates `xxhash-rust` from 0.8.15 to 0.8.19
- [Commits](https://github.com/DoumanAsh/xxhash-rust/commits)

---
updated-dependencies:
- dependency-name: xxhash-rust
  dependency-version: 0.8.19
  dependency-type: indirect
  dependency-group: cargo
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -6459,9 +6459,9 @@ dependencies = [
 
 [[package]]
 name = "xxhash-rust"
-version = "0.8.15"
+version = "0.8.19"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fdd20c5420375476fbd4394763288da7eb0cc0b8c11deed431a91562af7335d3"
+checksum = "550a2b930b62486a393c52d5c3b84bff264b28aa437ed64694d31e93b1757af7"
 
 [[package]]
 name = "yoke"
```

---

### Incident Patch 3: `79bd8227` (2026-10-05)
**Commit Message**: fix(search): accept answers longer than 820 characters (#1067)

check_if_string_cant_be_decoded, the sanity check every result has to pass,
also required calculate_string_quality >= 0.2. Past its other two checks
(at least 3 characters, at most 30% non-printable) that only fails for text
of 821 to 5,000 characters: the length score 1 - |len - 100| / 900 drops
below 0.2 at 821 characters, and text over 5,000 gets a flat 0.3. So a
correct answer of that length was always rejected and the search ran on:
Base64 of a 2,900 character paragraph ran into the timeout, and hex of it
ended on a railfence > rot47 false positive after 4 seconds.

Results no longer need the quality score. Which candidates are worth
decoding further (calculate_string_worth) is unchanged, so the search
explores exactly what it did before.

**File**: `src/lib.rs` (modified, +26/-0)
```diff
@@ -479,6 +479,32 @@ mod tests {
         assert!(result.unwrap().text[0] == "hello there general")
     }
 
+    #[test]
+    fn test_perform_cracking_decodes_long_base64() {
+        // 966 characters of plaintext. Text between 821 and 5,000 characters used to be
+        // rejected as a result, so this ran into the timeout.
+        let _test_db = TestDatabase::default();
+        set_test_db_path();
+
+        let plaintext = "It was the best of times, it was the worst of times, it was the age of \
+            wisdom, it was the age of foolishness, it was the epoch of belief. "
+            .repeat(7);
+        assert!(plaintext.len() > 900);
+        let encoded = {
+            use base64::Engine as _;
+            base64::engine::general_purpose::STANDARD.encode(&plaintext)
+        };
+        let config = Config {
+            // Unoptimised builds need a while for the first search step on this much text
+            timeout: 60,
+            ..Config::default()
+        };
+        let result = perform_cracking(&encoded, config).unwrap();
+        let result = result.expect("the long Base64 should be decoded");
+        assert_eq!(result.text[0], plaintext);
+        assert_eq!(result.path.last().unwrap().decoder, "Base64");
+    }
+
     #[test]
     fn test_perform_cracking_early_exit_if_input_is_plaintext() {
         let _test_db = TestDatabase::default();
```

**File**: `src/searchers/helper_functions.rs` (modified, +19/-8)
```diff
@@ -248,15 +248,18 @@ pub fn generate_heuristic(
 /// A string is considered undecodeble if:
 /// - It has 2 or fewer characters
 /// - It has more than 30% non-printable characters
-/// - Its overall quality score is below 0.2
+///
+/// Length is not held against it. This used to also require a
+/// [`calculate_string_quality`] of 0.2, which past the two checks above only fails for
+/// text of 821 to 5,000 characters (the length score drops below 0.2 at 821 characters,
+/// and text over 5,000 gets 0.3), so a correct answer that long was always rejected.
 ///
 /// ## Rationale
 ///
 /// 1. The gibberish_or_not library requires at least 3 characters to work effectively
 /// 2. LemmeKnow and other pattern matchers perform poorly on very short strings
 /// 3. Most encoding schemes produce output of at least 3 characters
 /// 4. Strings with high percentages of non-printable characters are unlikely to be valid encodings
-/// 5. Very low quality strings waste computational resources and rarely yield useful results
 ///
 /// Filtering out these strings early saves computational resources and
 /// prevents the search from exploring unproductive paths.
@@ -272,12 +275,6 @@ pub fn check_if_string_cant_be_decoded(text: &str) -> bool {
         return true;
     }
 
-    // Check for overall string quality
-    let quality = calculate_string_quality(text);
-    if quality < 0.2 {
-        return true;
-    }
-
     false
 }
 
@@ -346,6 +343,20 @@ mod tests {
         assert_eq!(all_invisible_quality, 0.0);
     }
 
+    #[test]
+    fn long_text_can_be_a_result() {
+        // The quality check used to reject every text of 821 to 5,000 characters
+        let sentence = "The quick brown fox jumps over the lazy dog. ";
+        for repeats in [17, 19, 25, 60, 110, 120] {
+            let text = sentence.repeat(repeats);
+            assert!(
+                !check_if_string_cant_be_decoded(&text),
+                "{} chars",
+                text.len()
+            );
+        }
+    }
+
     #[test]
     fn test_check_if_string_cant_be_decoded() {
         // Test strings that are too short
```

---

### Incident Patch 4: `cec8387e` (2026-10-05)
**Commit Message**: build(deps): bump winapi-util from 0.1.9 to 0.1.11 (#1055)

Bumps [winapi-util](https://github.com/BurntSushi/winapi-util) from 0.1.9 to 0.1.11.
- [Commits](https://github.com/BurntSushi/winapi-util/compare/0.1.9...0.1.11)

---
updated-dependencies:
- dependency-name: winapi-util
  dependency-version: 0.1.11
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +3/-3)
```diff
@@ -5863,11 +5863,11 @@ checksum = "ac3b87c63620426dd9b991e5ce0329eff545bccbbb34f3be09ff6fb6ab51b7b6"
 
 [[package]]
 name = "winapi-util"
-version = "0.1.9"
+version = "0.1.11"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "cf221c93e13a30d793f7645a0e7762c55d169dbb0a49671918a2319d289b10bb"
+checksum = "c2a7b1c03c876122aa43f3020e6c3c3ee5c05081c9a00739faf7503aeba10d22"
 dependencies = [
- "windows-sys 0.59.0",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
```

---

### Incident Patch 5: `74b76951` (2026-10-05)
**Commit Message**: build(deps): bump thiserror from 2.0.17 to 2.0.21 (#1054)

Bumps [thiserror](https://github.com/dtolnay/thiserror) from 2.0.17 to 2.0.21.
- [Release notes](https://github.com/dtolnay/thiserror/releases)
- [Commits](https://github.com/dtolnay/thiserror/compare/2.0.17...2.0.21)

---
updated-dependencies:
- dependency-name: thiserror
  dependency-version: 2.0.21
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +20/-20)
```diff
@@ -472,7 +472,7 @@ dependencies = [
  "supports-color",
  "supports-unicode",
  "swrite",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
  "tracing",
  "tracing-subscriber",
 ]
@@ -497,7 +497,7 @@ dependencies = [
  "semver",
  "serde",
  "serde_json",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
 ]
 
 [[package]]
@@ -646,7 +646,7 @@ dependencies = [
  "serial_test",
  "termcolor",
  "text_io",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
  "tokio",
  "toml 1.1.6+spec-1.1.0",
  "urlencoding",
@@ -1357,7 +1357,7 @@ dependencies = [
  "pretty-hex",
  "serde",
  "serde_json",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
  "zerocopy",
 ]
 
@@ -1369,7 +1369,7 @@ checksum = "dc09b90bda5770641457f1c0a42c8203c48f5a3d9799dcf1bafbd84e30ccf080"
 dependencies = [
  "pest",
  "pest_derive",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
 ]
 
 [[package]]
@@ -2950,7 +2950,7 @@ dependencies = [
  "regex",
  "regex-syntax 0.8.11",
  "smol_str",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
  "winnow 0.7.15",
 ]
 
@@ -3033,7 +3033,7 @@ dependencies = [
  "tar",
  "target-spec",
  "target-spec-miette",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
  "tokio",
  "tokio-stream",
  "toml 0.9.12+spec-1.1.0",
@@ -3640,7 +3640,7 @@ dependencies = [
  "newtype-uuid",
  "quick-xml 0.38.4",
  "strip-ansi-escapes",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
  "uuid",
 ]
 
@@ -3676,7 +3676,7 @@ dependencies = [
  "rustc-hash",
  "rustls",
  "socket2 0.5.9",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
  "tokio",
  "tracing",
  "web-time",
@@ -3697,7 +3697,7 @@ dependencies = [
  "rustls",
  "rustls-pki-types",
  "slab",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
  "tinyvec",
  "tracing",
  "web-time",
@@ -3881,7 +3881,7 @@ checksum = "dd6f9d3d47bdd2ad6945c5015a226ec6155d0bcdfd8f7cd29f86b71f8de99d2b"
 dependencies = [
  "getrandom 0.2.16",
  "libredox",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
 ]
 
 [[package]]
@@ -4062,7 +4062,7 @@ dependencies = [
  "schemars",
  "serde",
  "serde_json",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
  "tokio",
  "tokio-util",
  "tracing",
@@ -5051,11 +5051,11 @@ dependencies = [
 
 [[package]]
 name = "thiserror"
-version = "2.0.17"
+version = "2.0.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f63587ca0f12b72a0600bcba1d40081f830876000bb46dd2337a3051618f4fc8"
+checksum = "09e52cb86a36cede5cb101bf8908837b3e4c6e5e59fe7fd85c23fb56200d189e"
 dependencies = [
- "thiserror-impl 2.0.17",
+ "thiserror-impl 2.0.21",
 ]
 
 [[package]]
@@ -5071,13 +5071,13 @@ dependencies = [
 
 [[package]]
 name = "thiserror-impl"
-version = "2.0.17"
+version = "2.0.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "3ff15c8ecd7de3849db632e14d18d2571fa09dfc5ed93479bc4485c7a517c913"
+checksum = "fe5197923287db20a58125f0bc85c062f7f2c892de97b18c356f9efb14b28524"
 dependencies = [
  "proc-macro2",
  "quote",
- "syn 2.0.117",
+ "syn 3.0.3",
 ]
 
 [[package]]
@@ -5562,7 +5562,7 @@ dependencies = [
  "serde",
  "serde_json",
  "syn 2.0.117",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
  "thread-id",
 ]
 
@@ -6559,7 +6559,7 @@ checksum = "a9240c17ab9e129def0c16b56608e90a734724dfb2bcf73af30f63e340cac495"
 dependencies = [
  "base64 0.22.1",
  "ed25519-dalek",
- "thiserror 2.0.17",
+ "thiserror 2.0.21",
 ]
 
 [[package]]
```

---

### Incident Patch 6: `2adaa2e5` (2026-10-05)
**Commit Message**: build(deps): bump tokio from 1.48.0 to 1.50.0 (#1113)

Bumps [tokio](https://github.com/tokio-rs/tokio) from 1.48.0 to 1.50.0.
- [Release notes](https://github.com/tokio-rs/tokio/releases)
- [Commits](https://github.com/tokio-rs/tokio/compare/tokio-1.48.0...tokio-1.50.0)

---
updated-dependencies:
- dependency-name: tokio
  dependency-version: 1.50.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -5160,9 +5160,9 @@ dependencies = [
 
 [[package]]
 name = "tokio"
-version = "1.48.0"
+version = "1.50.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ff360e02eab121e0bc37a2d3b4d4dc622e6eda3a8e5253d5435ecf5bd4c68408"
+checksum = "27ad5e34374e03cfffefc301becb44e9dc3c17584f414349ebe29ed26661822d"
 dependencies = [
  "bytes",
  "libc",
```

---

### Incident Patch 7: `03067f59` (2026-10-05)
**Commit Message**: build(deps): bump encoding_rs from 0.8.35 to 0.8.42 (#1112)

Bumps [encoding_rs](https://github.com/hsivonen/encoding_rs) from 0.8.35 to 0.8.42.
- [Commits](https://github.com/hsivonen/encoding_rs/compare/v0.8.35...v0.8.42)

---
updated-dependencies:
- dependency-name: encoding_rs
  dependency-version: 0.8.42
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +25/-2)
```diff
@@ -833,6 +833,12 @@ version = "0.8.7"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "773648b94d0e5d620f64f280777445740e61fe701025087ec8b57f45c791888b"
 
+[[package]]
+name = "core_detect"
+version = "1.0.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7f8f80099a98041a3d1622845c271458a2d73e688351bf3cb999266764b81d48"
+
 [[package]]
 name = "cpufeatures"
 version = "0.2.17"
@@ -1448,11 +1454,16 @@ checksum = "34aa73646ffb006b8f5147f3dc182bd4bcb190227ce861fc4a4844bf8e3cb2c0"
 
 [[package]]
 name = "encoding_rs"
-version = "0.8.35"
+version = "0.8.42"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "75030f3c4f45dafd7586dd6780965a8c7e8e285a5ecb86713e63a79c5b2766f3"
+checksum = "8e985e0451871ad22fb8d2b6b076e2028a502a0d3950998c2c5c0a4f9b5d9679"
 dependencies = [
  "cfg-if",
+ "core_detect",
+ "multiversion_no_op",
+ "rustversion",
+ "scopeguard",
+ "simdutf8",
 ]
 
 [[package]]
@@ -2885,6 +2896,12 @@ dependencies = [
  "thiserror 1.0.69",
 ]
 
+[[package]]
+name = "multiversion_no_op"
+version = "1.0.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "743fb55ba31b18fb1ecef6bdc9aa2743314978ac084044301a7eee33fb99a20d"
+
 [[package]]
 name = "native-tls"
 version = "0.2.14"
@@ -4651,6 +4668,12 @@ version = "0.3.10"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "3a219298ac11a56ea9a6d2120044824d6f01aeb034955e7af7bc16858527deea"
 
+[[package]]
+name = "simdutf8"
+version = "0.1.5"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "e3a9fe34e3e7a50316060351f37187a3f546bce95496156754b601a5fa71b76e"
+
 [[package]]
 name = "siphasher"
 version = "1.0.1"
```

---

### Incident Patch 8: `bcd7b58f` (2026-10-05)
**Commit Message**: build(deps): bump idna from 1.0.3 to 1.1.0 (#1111)

Bumps [idna](https://github.com/servo/rust-url) from 1.0.3 to 1.1.0.
- [Release notes](https://github.com/servo/rust-url/releases)
- [Commits](https://github.com/servo/rust-url/commits)

---
updated-dependencies:
- dependency-name: idna
  dependency-version: 1.1.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -2402,9 +2402,9 @@ checksum = "b9e0384b61958566e926dc50660321d12159025e767c18e043daf26b70104c39"
 
 [[package]]
 name = "idna"
-version = "1.0.3"
+version = "1.1.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "686f825264d630750a544639377bae737628043f20d38bbc029e8f29ea968a7e"
+checksum = "3b0875f23caa03898994f6ddc501886a45c7d3d62d04d2d90788d47be1b1e4de"
 dependencies = [
  "idna_adapter",
  "smallvec",
```

---

### Incident Patch 9: `24abdba4` (2026-10-03)
**Commit Message**: feat(decoders): add Null cipher (acrostic) decoder (#1098)

* feat(decoders): add Null cipher (acrostic) decoder

Finds a message hidden in a cover text with the usual null cipher rules:
the first or last letter of each word or line, letter 2 to 5 of each word,
every 2nd to 5th letter from each starting letter, the capital letters, and
letter 1 to 3 after each punctuation mark (the Trevanion letter). The message
is returned as upper-case letters without spaces, with the rule as the key.

Each candidate is split into words from english_words.txt (a DP over squared
word lengths). Outside crib mode only candidates whose words cover 90% of the
letters, with at most half of the pieces one or two letters long, are shown
to the checker, spaced ("HELLO WORLD"), best three first. With a crib every
candidate is checked, as it is and spaced. Candidates that keep more than
half of the text's letters are dropped: spaced-out letters such as
Repeating-key XOR's view of UTF-16 text aren't an acrostic.

Cheap pre-checks turn away text with fewer than six words or under 70%
letters after one pass over at most 4,000 characters.

An English cover text is accepted as plaintext before the search starts,

**File**: `benches/data/decoders.toml` (modified, +19/-0)
```diff
@@ -768,6 +768,25 @@ success = true
 input = "Charlie India Papa Hotel Echo Yankee  India Sierra  Alfa November  Alfa Uniform Tango Oscar Mike Alfa Tango Echo Delta  Delta Echo Charlie Oscar Delta India November Golf  Tango Oscar Oscar Lima Full stop  Yankee Oscar Uniform  Golf India Victor Echo  India Tango  Echo November Charlie Romeo Yankee Papa Tango Echo Delta  Oscar Romeo  Echo November Charlie Oscar Delta Echo Delta  Tango Echo X-ray Tango  Alfa November Delta  India Tango  Tango Romeo India Echo Sierra  Tango Oscar  Whiskey Oscar Romeo Kilo  Oscar Uniform Tango  Whiskey Hotel Alfa Tango  Whiskey Alfa Sierra  Delta Oscar November Echo  Tango Oscar  India Tango Comma  Whiskey India Tango Hotel Oscar Uniform Tango  Yankee Oscar Uniform  Hotel Alfa Victor India November Golf  Tango Oscar  Kilo November Oscar Whiskey  Tango Hotel Echo  Kilo Echo Yankee  Oscar Romeo  Echo Victor Echo November  Tango Hotel Echo  Charlie India Papa Hotel Echo Romeo Full stop  India Tango  Sierra Echo Alfa Romeo Charlie Hotel Echo Sierra  Tango Hotel Romeo Oscar Uniform Golf Hotel  Mike Alfa November Yankee  Papa Oscar Sierra Sierra India Bravo Lima Echo  Delta Echo Charlie Oscar Delta India November Golf Sierra Comma  Charlie Hotel Echo Charlie Kilo Sierra  Echo Alfa Charlie Hotel  Charlie Alfa November Delta India Delta Alfa Tango Echo  Tango Oscar  Sierra Echo Echo  Whiskey Hotel Echo Tango Hotel Echo Romeo  India Tango  Lima Oscar Oscar Kilo Sierra  Lima India Kilo Echo  Echo November Golf Lima India Sierra Hotel  Oscar Romeo  Mike Alfa Tango Charlie Hotel Echo Sierra  Alfa  Kilo November Oscar Whiskey November  Papa Alfa Tango Tango Echo Romeo November  Sierra Uniform Charlie Hotel  Alfa Sierra  Alfa November  Echo Mike Alfa India Lima  Alfa Delta Delta Romeo Echo Sierra Sierra Comma  Alfa November Delta  Sierra Tango Oscar Papa Sierra  Whiskey Hotel Echo November  India Tango  Foxtrot India November Delta Sierra  Sierra Oscar Mike Echo Tango Hotel India November Golf  Tango Hotel Alfa Tango  Romeo Echo Alfa Delta Sierra  Lima India Kilo Echo  Papa Lima Alfa India November Tango Echo X-ray Tango Full stop  Mike Oscar Sierra Tango  Oscar Foxtrot  Tango Hotel Echo  Tango India Mike Echo  Tango Hotel India Sierra  Tango Alfa Kilo Echo Sierra  Lima Echo Sierra Sierra  Tango Hotel Alfa November  Alfa  Sierra Echo Charlie Oscar November Delta Comma  Whiskey Hotel India Charlie Hotel  Mike Alfa Kilo Echo Sierra  India Tango  Hotel Alfa November Delta Yankee  Foxtrot Oscar Romeo  Charlie Alfa Papa Tango Uniform Romeo Echo  Tango Hotel Echo  Foxtrot Lima Alfa Golf  Charlie Hotel Alfa Lima Lima Echo November Golf Echo Sierra Comma  Papa Uniform Zulu Zulu Lima Echo  Hotel Uniform November Tango Sierra  Alfa November Delta  Foxtrot Oscar Romeo  Alfa November Yankee Oscar November Echo  Whiskey Hotel Oscar  Sierra Tango Uniform Mike Bravo Lima Echo Sierra  Alfa Charlie Romeo Oscar Sierra Sierra  Alfa  Sierra Tango Romeo Alfa November Golf Echo  Sierra Tango Romeo India November Golf  India November  Alfa  Lima Oscar Golf  Foxtrot India Lima Echo Full stop "
 expected = "ciphey is an automated decoding tool. you give it encrypted or encoded text and it tries to work out what was done to it, without you having to know the key or even the cipher. it searches through many possible decodings, checks each candidate to see whether it looks like english or matches a known pattern such as an email address, and stops when it finds something that reads like plaintext. most of the time this takes less than a second, which makes it handy for capture the flag challenges, puzzle hunts and for anyone who stumbles across a strange string in a log file."
 
+# Null cipher inputs are acrostics of the plaintexts: each of their letters, upper-cased,
+# becomes the next word of src/storage/ngrams/english_words.txt with that initial and at
+# least 4 letters (in file order, starting again at the first when they run out),
+# capitalised, and the words are joined with spaces. The message is the first letter of
+# each word.
+[[case]]
+decoder = "Null cipher"
+size = "medium"
+success = true
+input = "Macey Each Eager Table Machine Eagerly Abandon Tablecloth Tables Habit Eagerness Oaken Label Dagger Labor Iceberg Gable Habitation Tablet Habits Oaks Ugly Sabbath Eagle Abandoned Fable Tablets Earl Rabbit Madam Iceland Daggoo Nail Idea Gabriel Habitual Tacit Abbey Nailed Daily Baboon Race Ideal Nails Gaiety Tackle Habitually Earlier Madame Abbot Pace Tackles Hackney Earliest Keel Early Yard Abel Naked Dainty Abhor Taffrail Oakshott Races Cabaco Hadn"
+expected = "MEETMEATTHEOLDLIGHTHOUSEAFTERMIDNIGHTANDBRINGTHEMAPTHEKEYANDATORCH"
+
+[[case]]
+decoder = "Null cipher"
+size = "long"
+success = true
+input = "Cabaco Iceberg Pace Habit Each Yard Iceland Sabbath Abandon Nail Abandoned Ugly Table Oaken Macey Abbey Tablecloth Eager Dagger Daggoo Eagerly Cabin Oaks Daily Idea Nailed Gable Tables Oakshott Oakum Label Yards Oars Ulster Gabriel Ideal Vacancies Eagerness Id
```

**File**: `src/decoders/api/functions.rs` (modified, +17/-0)
```diff
@@ -50,6 +50,7 @@ use crate::decoders::monoalphabetic_substitution_decoder::MonoalphabeticSubstitu
 use crate::decoders::morse_code::MorseCodeDecoder;
 use crate::decoders::multi_tap_decoder::MultiTapDecoder;
 use crate::decoders::nato_phonetic_decoder::NatoPhoneticDecoder;
+use crate::decoders::null_cipher_decoder::NullCipherDecoder;
 use crate::decoders::octal_decoder::OctalDecoder;
 use crate::decoders::ook_decoder::OokDecoder;
 use crate::decoders::polybius_decoder::PolybiusDecoder;
@@ -577,6 +578,22 @@ decoder_functions! {
     /// ```
     nato_phonetic: NatoPhoneticDecoder, aliases ["nato", "phonetic_alphabet", "spelling_alphabet"], key None;
 
+    /// Finds a message hidden in a null cipher: the first or last letters of the words or
+    /// lines of a cover text (an acrostic), every n-th letter, the capital letters, or the
+    /// letters after punctuation. The message comes back in capitals without spaces, and
+    /// the key names the rule that found it. Ciphey's checks only see messages that split
+    /// into dictionary words, unless `Config::regex` is set.
+    ///
+    /// ```
+    /// let decoded = ciphey::decoders::null_cipher(
+    ///     "Help Everyone Love Lots Of Wildlife: Observe Raptors, Lizards, Deer.",
+    /// );
+    /// let plaintext = decoded.plaintext().unwrap();
+    /// assert_eq!(plaintext.text, "HELLOWORLD");
+    /// assert_eq!(plaintext.key.as_deref(), Some("first letter of each word"));
+    /// ```
+    null_cipher: NullCipherDecoder, aliases ["acrostic", "concealment_cipher"], key None;
+
     /// Decodes character codes written in octal.
     ///
     /// ```
```

**File**: `src/decoders/api/tests.rs` (modified, +21/-0)
```diff
@@ -550,6 +550,27 @@ fn nato_phonetic_decodes() {
     assert!(nato_phonetic("hello world").is_empty());
 }
 
+#[test]
+fn null_cipher_decodes() {
+    let decoded =
+        null_cipher("Help Everyone Love Lots Of Wildlife: Observe Raptors, Lizards, Deer.");
+    assert_plaintext(&decoded, "HELLOWORLD");
+    assert_eq!(plaintext_key(&decoded), "first letter of each word");
+    // Every 3rd letter
+    assert_plaintext(
+        &null_cipher("Hat ebbl idla powl waro rero tlot dog"),
+        "HELLOWORLD",
+    );
+    // English with nothing hidden in it, and text with too few words
+    assert!(null_cipher(
+        "The quick brown fox jumps over the lazy dog while the cat sleeps on the warm windowsill."
+    )
+    .is_empty());
+    assert!(null_cipher("hello world").is_empty());
+    let found = decoder_info("acrostic").expect("an alias");
+    assert_eq!(found.name, "Null cipher");
+}
+
 #[test]
 fn octal_decodes() {
     assert_plaintext(
```

**File**: `src/decoders/mod.rs` (modified, +10/-0)
```diff
@@ -243,6 +243,9 @@ pub mod t9_decoder;
 /// The yunying_decoder module decodes the 01248 (Yunying) cipher, letters as sums of 1, 2, 4 and 8
 pub mod yunying_decoder;
 
+/// The null_cipher_decoder module finds messages hidden in null ciphers such as acrostics
+pub mod null_cipher_decoder;
+
 use atbash_decoder::AtbashDecoder;
 use backslash_escape_decoder::BackslashEscapeDecoder;
 use baconian_decoder::BaconianDecoder;
@@ -288,6 +291,7 @@ use monoalphabetic_substitution_decoder::MonoalphabeticSubstitutionDecoder;
 use morse_code::MorseCodeDecoder;
 use multi_tap_decoder::MultiTapDecoder;
 use nato_phonetic_decoder::NatoPhoneticDecoder;
+use null_cipher_decoder::NullCipherDecoder;
 use octal_decoder::OctalDecoder;
 use ook_decoder::OokDecoder;
 use polybius_decoder::PolybiusDecoder;
@@ -465,6 +469,8 @@ pub enum DecoderType {
     ),
     /// T9 predictive text decoder
     T9Decoder(t9_decoder::T9Decoder),
+    /// null cipher (acrostic) decoder
+    NullCipherDecoder(null_cipher_decoder::NullCipherDecoder),
 }
 
 /// Wrapper struct to hold Decoders for DECODER_MAP
@@ -681,5 +687,9 @@ pub static DECODER_MAP: Lazy<HashMap<&str, DecoderBox>> = Lazy::new(|| {
             "Keyboard layout",
             DecoderBox::new(Decoder::<KeyboardLayoutDecoder>::new()),
         ),
+        (
+            "Null cipher",
+            DecoderBox::new(Decoder::<NullCipherDecoder>::new()),
+        ),
     ])
 });
```

**File**: `src/decoders/null_cipher_decoder.rs` (added, +1153/-0)
```diff
@@ -0,0 +1,1153 @@
+//! Find a message hidden in a null cipher (concealment cipher), such as an acrostic.
+//!
+//! A null cipher hides a message in an innocent-looking cover text: the reader keeps the
+//! letters at agreed positions and ignores the rest, the "nulls". This decoder tries the
+//! usual rules:
+//!
+//! * the first or last letter of each word (an acrostic),
+//! * the first or last letter of each line, for texts of three or more lines,
+//! * letter 2, 3, 4 or 5 of each word, skipping shorter words,
+//! * every 2nd, 3rd, 4th or 5th letter of the text, from each possible first letter,
+//! * the capital letters, unless the text is mostly capitals,
+//! * letter 1, 2 or 3 after each punctuation mark (`, . ; : ! ?`), as in the Trevanion
+//!   letter.
+//!
+//! The hidden message is returned as upper-case letters without spaces (`HELLOWORLD`), with
+//! the rule that found it as the key. See <https://en.wikipedia.org/wiki/Null_cipher> and
+//! <https://www.dcode.fr/acrostic-extraction>.
+//!
+//! The checker accepts `HELLO WORLD` but not `HELLOWORLD`, so each candidate is first split
+//! into dictionary words, and the checker is shown the spaced form. Only candidates whose
+//! words cover at least 90% of their letters, in pieces that are mostly longer than two
+//! letters, get that far: ordinary English yields candidates such as `SET IT R T IT EST
+//! HOLE`, which the checker would accept. With a crib (`--regex`) the crib decides instead,
+//! so every candidate is checked as it is and spaced.
+//!
+//! Ciphey runs every decoder on every text the search expands, so text that can't be a
+//! cover text (fewer than six words, or less than 70% letters, like Base64 and hex) is
+//! turned away after one pass over at most its first 4,000 characters.
+//!
+//! An English cover text is itself accepted as plaintext before the search starts, so in
+//! practice the full search only reaches this decoder with a crib, which turns the other
+//! checkers off.
+
+use super::crack_results::CrackResult;
+use super::interface::{Crack, Decoder};
+use crate::checkers::checker_result::CheckResult;
+use crate::checkers::CheckerTypes;
+use crate::config::get_config;
+use crate::decoders::affine_decoder::BIGRAM_LOG_PROBS;
+use log::trace;
+use once_cell::sync::Lazy;
+use std::collections::HashMap;
+use std::hash::{BuildHasherDefault, Hasher};
+use std::ops::Range;
+
+/// Pre-check: the fewest whitespace-separated words (with at least one ASCII letter) that
+/// a cover text needs. Encodings like Base64, hex and binary have one or two.
+const MIN_WORDS: usize = 6;
+
+/// Pre-check: ASCII letters must make up at least this many tenths of the characters that
+/// aren't whitespace.
+const MIN_LETTER_TENTHS: usize = 7;
+
+/// Only the first this many characters are read. Hidden messages are short, and longer
+/// texts are only ever the input itself.
+const MAX_CHARS: usize = 4_000;
+
+/// Candidates with fewer letters than this are dropped: short letter runs read as words
+/// by chance.
+const MIN_MESSAGE_LETTERS: usize = 8;
+
+/// The line rules need at least this many lines that contain a letter.
+const MIN_LINES: usize = 3;
+
+/// The capital-letter rule needs at least this many capitals.
+const MIN_CAPITALS: usize = 4;
+
+/// The punctuation rules need at least this many punctuation marks.
+const MIN_MARKS: usize = 4;
+
+/// The punctuation marks that the punctuation rules count from.
+const PUNCTUATION: &[u8] = b",.;:!?";
+
+/// The longest dictionary word the segmentation looks for.
+const MAX_WORD_LEN: usize = 12;
+
+// A word of MAX_WORD_LEN letters, five bits each, has to fit in a lexicon key
+const _: () = assert!(MAX_WORD_LEN * 5 <= u64::BITS as usize);
+
+/// Segmentation score of a letter that isn't part of a dictionary word. A word of `n`
+/// letters scores `n²`.
+const UNCOVERED_PENALTY: i64 = 4;
+
+/// A candidate is shown to the checker only if dictionary words cover at least this share
+/// of its letters...
+const MIN_COVERAGE: f32 = 0.9;
+
+/// ...and at most this share of its pieces are one or two letters long.
+const MAX_SHORT_SHARE: f32 = 0.5;
+
+/// How many candidates, best first, are shown to the checker, and returned when none is
+/// identified.
+const MAX_CHECKED: usize = 3;
+
+/// Rule: the first letter of each word.
+const FIRST_OF_WORD: &str = "first letter of each word";
+/// Rule: the last letter of each word.
+const LAST_OF_WORD: &str = "last letter of each word";
+/// Rule: the first letter of each line.
+const FIRST_OF_LINE: &str = "first letter of each line";
+/// Rule: the last letter of each line.
+const LAST_OF_LINE: &str = "last letter of each line";
+/// Rule: the capital letters.
+const CAPITALS: &str = "capital letters";
+
+/// Rules: letter `n` of each word with at least `n` letters, as `(n, rule)`.
+const LETTER_OF_WORD_RULES: [(usize, &str); 4] = [
+    (2, "letter 2 of each word"),
+    (3, "letter 3 of each word"),
+    (4, "letter 4 of each word"),
+    (5, "lett
```

**File**: `src/filtration_system/mod.rs` (modified, +5/-0)
```diff
@@ -57,6 +57,7 @@ use crate::decoders::monoalphabetic_substitution_decoder::MonoalphabeticSubstitu
 use crate::decoders::morse_code::MorseCodeDecoder;
 use crate::decoders::multi_tap_decoder::MultiTapDecoder;
 use crate::decoders::nato_phonetic_decoder::NatoPhoneticDecoder;
+use crate::decoders::null_cipher_decoder::NullCipherDecoder;
 use crate::decoders::punycode_decoder::PunycodeDecoder;
 use crate::decoders::quoted_printable_decoder::QuotedPrintableDecoder;
 use crate::decoders::railfence_decoder::RailfenceDecoder;
@@ -347,6 +348,7 @@ pub fn filter_and_get_decoders(_text_struct: &DecoderResult) -> Decoders {
     let monoalphabetic_substitution = Decoder::<MonoalphabeticSubstitutionDecoder>::new();
     let keyboard_layout = Decoder::<KeyboardLayoutDecoder>::new();
     let keyboard_shift = Decoder::<KeyboardShiftDecoder>::new();
+    let null_cipher = Decoder::<NullCipherDecoder>::new();
 
     Decoders {
         components: vec![
@@ -483,6 +485,9 @@ pub fn filter_and_get_decoders(_text_struct: &DecoderResult) -> Decoders {
             Box::new(monoalphabetic_substitution),
             Box::new(keyboard_shift),
             Box::new(keyboard_layout),
+            // Last: a hidden message is a rarer answer than any other decoder's, so the
+            // others win ties within a search batch.
+            Box::new(null_cipher),
         ],
     }
 }
```

**File**: `tests/null_cipher_crib.rs` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+//! End-to-end tests for the Null cipher decoder (#982): the full A* search, through
+//! `perform_cracking`, has to find the message hidden in a cover text.
+//!
+//! They run in crib mode (`--regex`). With the default checkers an English cover text is
+//! accepted as plaintext before the search starts, so `perform_cracking` would return the
+//! cover unchanged. A crib turns the other checkers off. The global config is set once
+//! per process, so every test in this file uses the same crib.
+
+use ciphey::config::Config;
+use ciphey::storage::database::DB_PATH;
+use ciphey::{perform_cracking, DecoderResult};
+
+/// The crib for every test here.
+const CRIB: &str = "HELLO|PERSHING";
+
+/// Runs the whole search on `cover` with [`CRIB`] and returns what it found.
+fn search(cover: &str) -> DecoderResult {
+    // Keep the cache in memory, so nothing under ~/.ciphey is read or written.
+    let _ = DB_PATH.set(None);
+    let config = Config {
+        regex: Some(CRIB.to_string()),
+        ..Config::default()
+    };
+    perform_cracking(cover, config)
+        .expect("the search finishes before the timeout")
+        .expect("the search finds the hidden message")
+}
+
+/// Asserts that the search finds `message` in `cover` in one Null cipher step that
+/// reports `rule`.
+fn assert_found(cover: &str, message: &str, rule: &str) {
+    let result = search(cover);
+    let path: Vec<&str> = result.path.iter().map(|step| step.decoder).collect();
+    assert_eq!(result.text[0], message, "path: {path:?}");
+    assert_eq!(path, ["Null cipher"]);
+    assert_eq!(result.path[0].key.as_deref(), Some(rule));
+}
+
+#[test]
+fn crib_search_finds_the_issue_acrostic() {
+    // The example from #982
+    assert_found(
+        "Help Everyone Love Lots Of Wildlife: Observe Raptors, Lizards, Deer.",
+        "HELLOWORLD",
+        "first letter of each word",
+    );
+}
+
+#[test]
+fn crib_search_finds_the_wwi_telegram() {
+    // From https://en.wikipedia.org/wiki/Null_cipher: "Pershing sails from NY June 1".
+    // Without a crib the decoder doesn't show it to the checker: PERSHING and NY aren't
+    // dictionary words.
+    assert_found(
+        "PRESIDENT'S EMBARGO RULING SHOULD HAVE IMMEDIATE NOTICE. GRAVE SITUATION \
+         AFFECTING INTERNATIONAL LAW. STATEMENT FORESHADOWS RUIN OF MANY NEUTRALS. YELLOW \
+         JOURNALS UNIFYING NATIONAL EXCITEMENT IMMENSELY.",
+        "PERSHINGSAILSFROMNYJUNEI",
+        "first letter of each word",
+    );
+}
```

---

### Incident Patch 10: `982b2fe9` (2026-10-03)
**Commit Message**: fix(lib): a function for the Multi-tap decoder (#1081)

#1075 and #1072 merged one after the other, so master has Multi-tap in the
search but not in the library API, and every_decoder_in_the_search_has_a_function
fails on master.

**File**: `src/decoders/api/functions.rs` (modified, +10/-0)
```diff
@@ -39,6 +39,7 @@ use crate::decoders::jwt_decoder::JwtDecoder;
 use crate::decoders::mime_encoded_word_decoder::MimeEncodedWordDecoder;
 use crate::decoders::monoalphabetic_substitution_decoder::MonoalphabeticSubstitutionDecoder;
 use crate::decoders::morse_code::MorseCodeDecoder;
+use crate::decoders::multi_tap_decoder::MultiTapDecoder;
 use crate::decoders::octal_decoder::OctalDecoder;
 use crate::decoders::punycode_decoder::PunycodeDecoder;
 use crate::decoders::quoted_printable_decoder::QuotedPrintableDecoder;
@@ -418,6 +419,15 @@ decoder_functions! {
     /// ```
     morse: MorseCodeDecoder, aliases [], key None;
 
+    /// Decodes Multi-tap, the text entry of keypad phones: `44` is H, `555` is L, and `0`
+    /// is a space.
+    ///
+    /// ```
+    /// let decoded = ciphey::decoders::multi_tap("44 33 555 555 666 0 9 666 777 555 3");
+    /// assert_eq!(decoded.candidates[0].text, "HELLO WORLD");
+    /// ```
+    multi_tap: MultiTapDecoder, aliases ["multitap", "phone_keypad"], key None;
+
     /// Decodes character codes written in octal.
     ///
     /// ```
```

**File**: `src/decoders/api/tests.rs` (modified, +8/-0)
```diff
@@ -418,6 +418,14 @@ fn morse_decodes() {
     );
 }
 
+#[test]
+fn multi_tap_decodes() {
+    assert_plaintext(
+        &multi_tap("44-33-555-555-666 9-666-777-555-3"),
+        "HELLO WORLD",
+    );
+}
+
 #[test]
 fn octal_decodes() {
     assert_plaintext(
```

---

### Incident Patch 11: `764472f2` (2026-10-02)
**Commit Message**: fix(decoders): keep gen_quadgrams.py's file paths out of user input (#1058)

CodeQL's Python analysis, enabled on master after #1052 merged, reported six
py/path-injection alerts (#97-#102) in the script that regenerates the monoalphabetic
substitution cracker's quadgram and word lists: --cache-dir and --output-dir flowed into
open() and os.makedirs().

The script doesn't need either option. Downloaded books now go to target/ciphey-gutenberg
in the repository (git ignores target/), and the two files are written next to the
script, which is where the cracker reads them from. The count options stay.

Checked by running the old script (with --cache-dir/--output-dir) and the new one on the
same five locally cached Project Gutenberg books: both outputs are byte-identical.

**File**: `src/storage/ngrams/gen_quadgrams.py` (modified, +15/-20)
```diff
@@ -16,7 +16,9 @@
   ("ll", "re", "de"), which would let gibberish split into "words".
 
 Only the Python standard library is used. Downloaded books are kept in
---cache-dir, so a second run doesn't download them again.
+target/ciphey-gutenberg at the top of the repository (Cargo's build directory,
+which git ignores), so a second run doesn't download them again. The two files
+are written next to this script.
 
     python3 src/storage/ngrams/gen_quadgrams.py
 """
@@ -26,7 +28,6 @@
 import os
 import re
 import sys
-import tempfile
 import time
 import urllib.request
 
@@ -47,10 +48,16 @@
 
 HERE = os.path.dirname(os.path.abspath(__file__))
 
+# Where downloaded books are kept: target/ciphey-gutenberg in the repository.
+# Fixed rather than a command-line option, so no file path comes from user input.
+CACHE_DIR = os.path.join(
+    os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "target", "ciphey-gutenberg"
+)
 
-def download(book_id, cache_dir):
+
+def download(book_id):
     """Returns the book's text, from the cache if it's there."""
-    path = os.path.join(cache_dir, "pg{}.txt".format(book_id))
+    path = os.path.join(CACHE_DIR, "pg{}.txt".format(book_id))
     if not os.path.exists(path):
         url = URL.format(id=book_id)
         print("downloading", url, file=sys.stderr)
@@ -142,16 +149,6 @@ def write_words(path, words, min_count):
 
 def main():
     parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
-    parser.add_argument(
-        "--cache-dir",
-        default=os.path.join(tempfile.gettempdir(), "ciphey-gutenberg"),
-        help="where downloaded books are kept (default: %(default)s)",
-    )
-    parser.add_argument(
-        "--output-dir",
-        default=HERE,
-        help="where the two files are written (default: %(default)s)",
-    )
     parser.add_argument(
         "--min-quadgram-count",
         type=int,
@@ -165,12 +162,12 @@ def main():
         help="leave out words seen fewer times (default: %(default)s)",
     )
     args = parser.parse_args()
-    os.makedirs(args.cache_dir, exist_ok=True)
+    os.makedirs(CACHE_DIR, exist_ok=True)
 
     quadgrams = collections.Counter()
     words = collections.Counter()
     for book_id in BOOK_IDS:
-        text = body(book_id, download(book_id, args.cache_dir))
+        text = body(book_id, download(book_id))
         stream = letters(text)
         # Counted per book, so no quadgram spans two books
         quadgrams.update(stream[i : i + 4] for i in range(len(stream) - 3))
@@ -179,13 +176,11 @@ def main():
         words.update(WORD.findall(text.upper()))
 
     write_quadgrams(
-        os.path.join(args.output_dir, "english_quadgrams.txt"),
+        os.path.join(HERE, "english_quadgrams.txt"),
         quadgrams,
         args.min_quadgram_count,
     )
-    write_words(
-        os.path.join(args.output_dir, "english_words.txt"), words, args.min_word_count
-    )
+    write_words(os.path.join(HERE, "english_words.txt"), words, args.min_word_count)
 
 
 if __name__ == "__main__":
```

---

### Incident Patch 12: `8ac82bb0` (2026-10-02)
**Commit Message**: feat(decoders): add Unicode escape decoder (\uXXXX, %uXXXX, U+XXXX) (#1040)

* feat(decoders): add Unicode escape sequences decoder (\uXXXX, %uXXXX, U+XXXX)

* bench: add Unicode Escapes decoder and search fixtures

Medium and long \uXXXX inputs in decoders.toml, like every other decoder, and a
search/single/unicode_escapes case in search.toml. Also keeps codespell from
flagging the caf\u00e9 test vector.

**File**: `benches/data/decoders.toml` (modified, +17/-0)
```diff
@@ -374,6 +374,23 @@ success = true
 input = "xyxxxxyyxyyxyxxyxyyyxxxxxyyxyxxxxyyxxyxyxyyyyxxyxxyxxxxxxyyxyxxyxyyyxxyyxxyxxxxxxyyxxxxyxyyxyyyxxxyxxxxxxyyxxxxyxyyyxyxyxyyyxyxxxyyxyyyyxyyxyyxyxyyxxxxyxyyyxyxxxyyxxyxyxyyxxyxxxxyxxxxxxyyxxyxxxyyxxyxyxyyxxxyyxyyxyyyyxyyxxyxxxyyxyxxyxyyxyyyxxyyxxyyyxxyxxxxxxyyyxyxxxyyxyyyyxyyxyyyyxyyxyyxxxxyxyyyxxxyxxxxxxyxyyxxyxyyxyyyyxyyyxyxyxxyxxxxxxyyxxyyyxyyxyxxyxyyyxyyxxyyxxyxyxxyxxxxxxyyxyxxyxyyyxyxxxxyxxxxxxyyxxyxyxyyxyyyxxyyxxxyyxyyyxxyxxyyyyxxyxyyyxxxxxyyyxyxxxyyxxyxyxyyxxyxxxxyxxxxxxyyxyyyyxyyyxxyxxxyxxxxxxyyxxyxyxyyxyyyxxyyxxxyyxyyxyyyyxyyxxyxxxyyxxyxyxyyxxyxxxxyxxxxxxyyyxyxxxyyxxyxyxyyyyxxxxyyyxyxxxxyxxxxxxyyxxxxyxyyxyyyxxyyxxyxxxxyxxxxxxyyxyxxyxyyyxyxxxxyxxxxxxyyyxyxxxyyyxxyxxyyxyxxyxyyxxyxyxyyyxxyyxxyxxxxxxyyyxyxxxyyxyyyyxxyxxxxxxyyyxyyyxyyxyyyyxyyyxxyxxyyxyxyyxxyxxxxxxyyxyyyyxyyyxyxyxyyyxyxxxxyxxxxxxyyyxyyyxyyxyxxxxyyxxxxyxyyyxyxxxxyxxxxxxyyyxyyyxyyxxxxyxyyyxxyyxxyxxxxxxyyxxyxxxyyxyyyyxyyxyyyxxyyxxyxyxxyxxxxxxyyyxyxxxyyxyyyyxxyxxxxxxyyxyxxyxyyyxyxxxxyxyyxxxxyxxxxxxyyyxyyyxyyxyxxyxyyyxyxxxyyxyxxxxyyxyyyyxyyyxyxyxyyyxyxxxxyxxxxxxyyyyxxyxyyxyyyyxyyyxyxyxxyxxxxxxyyxyxxxxyyxxxxyxyyyxyyxxyyxyxxyxyyxyyyxxyyxxyyyxxyxxxxxxyyyxyxxxyyxyyyyxxyxxxxxxyyxyxyyxyyxyyyxxyyxyyyyxyyyxyyyxxyxxxxxxyyyxyxxxyyxyxxxxyyxxyxyxxyxxxxxxyyxyxyyxyyxxyxyxyyyyxxyxxyxxxxxxyyxyyyyxyyyxxyxxxyxxxxxxyyxxyxyxyyyxyyxxyyxxyxyxyyxyyyxxxyxxxxxxyyyxyxxxyyxyxxxxyyxxyxyxxyxxxxxxyyxxxyyxyyxyxxyxyyyxxxxxyyxyxxxxyyxxyxyxyyyxxyxxxyxyyyxxxyxxxxxxyxxyxxyxyyyxyxxxxyxxxxxxyyyxxyyxyyxxyxyxyyxxxxyxyyyxxyxxyyxxxyyxyyxyxxxxyyxxyxyxyyyxxyyxxyxxxxxxyyyxyxxxyyxyxxxxyyyxxyxxyyxyyyyxyyyxyxyxyyxxyyyxyyxyxxxxxyxxxxxxyyxyyxyxyyxxxxyxyyxyyyxxyyyyxxyxxyxxxxxxyyyxxxxxyyxyyyyxyyyxxyyxyyyxxyyxyyxyxxyxyyxxxyxxyyxyyxxxyyxxyxyxxyxxxxxxyyxxyxxxyyxxyxyxyyxxxyyxyyxyyyyxyyxxyxxxyyxyxxyxyyxyyyxxyyxxyyyxyyyxxyyxxyxyyxxxxyxxxxxxyyxxxyyxyyxyxxxxyyxxyxyxyyxxxyyxyyxyxyyxyyyxxyyxxyxxxxxxyyxxyxyxyyxxxxyxyyxxxyyxyyxyxxxxxyxxxxxxyyxxxyyxyyxxxxyxyyxyyyxxyyxxyxxxyyxyxxyxyyxxyxxxyyxxxxyxyyyxyxxxyyxxyxyxxyxxxxxxyyyxyxxxyyxyyyyxxyxxxxxxyyyxxyyxyyxxyxyxyyxxyxyxxyxxxxxxyyyxyyyxyyxyxxxxyyxxyxyxyyyxyxxxyyxyxxxxyyxxyxyxyyyxxyxxxyxxxxxxyyxyxxyxyyyxyxxxxyxxxxxxyyxyyxxxyyxyyyyxyyxyyyyxyyxyxyyxyyyxxyyxxyxxxxxxyyxyyxxxyyxyxxyxyyxyxyyxyyxxyxyxxyxxxxxxyxxxyxyxyyxyyyxxyyxxyyyxyyxyyxxxyyxyxxyxyyyxxyyxyyxyxxxxxyxxxxxxyyxyyyyxyyyxxyxxxyxxxxxxyyxyyxyxyyxxxxyxyyyxyxxxyyxxxyyxyyxyxxxxyyxxyxyxyyyxxyyxxyxxxxxxyyxxxxyxxyxxxxxxyyxyxyyxyyxyyyxxyyxyyyyxyyyxyyyxyyxyyyxxxyxxxxxxyyyxxxxxyyxxxxyxyyyxyxxxyyyxyxxxyyxxyxyxyyyxxyxxyyxyyyxxxyxxxxxxyyyxxyyxyyyxyxyxyyxxxyyxyyxyxxxxxyxxxxxxyyxxxxyxyyyxxyyxxyxxxxxxyyxxxxyxyyxyyyxxxyxxxxxxyyxxyxyxyyxyyxyxyyxxxxyxyyxyxxyxyyxyyxxxxyxxxxxxyyxxxxyxyyxxyxxxyyxxyxxxyyyxxyxxyyxxyxyxyyyxxyyxyyyxxyyxxyxyyxxxxyxxxxxxyyxxxxyxyyxyyyxxyyxxyxxxxyxxxxxxyyyxxyyxyyyxyxxxyyxyyyyxyyyxxxxxyyyxxyyxxyxxxxxxyyyxyyyxyyxyxxxxyyxxyxyxyyxyyyxxxyxxxxxxyyxyxxyxyyyxyxxxxyxxxxxxyyxxyyxxyyxyxxyxyyxyyyxxyyxxyxxxyyyxxyyxxyxxxxxxyyyxxyyxyyxyyyyxyyxyyxyxyyxxyxyxyyyxyxxxyyxyxxxxyyxyxxyxyyxyyyxxyyxxyyyxxyxxxxxxyyyxyxxxyyxyxxxxyyxxxxyxyyyxyxxxxyxxxxxxyyyxxyxxyyxxyxyxyyxxxxyxyyxxyxxxyyyxxyyxxyxxxxxxyyxyyxxxyyxyxxyxyyxyxyyxyyxxyxyxxyxxxxxxyyyxxxxxyyxyyxxxyyxxxxyxyyxyxxyxyyxyyyxxyyyxyxxxyyxxyxyxyyyyxxxxyyyxyxxxxyxyyyxxxyxxxxxxyxxyyxyxyyxyyyyxyyyxxyyxyyyxyxxxxyxxxxxxyyxyyyyxyyxxyyxxxyxxxxxxyyyxyxxxyyxyxxxxyyxxyxyxxyxxxxxxyyyxyxxxyyxyxxyxyyxyyxyxyyxxyxyxxyxxxxxxyyyxyxxxyyxyxxxxyyxyxxyxyyyxxyyxxyxxxxxxyyyxyxxxyyxxxxyxyyxyxyyxyyxxyxyxyyyxxyyxxyxxxxxxyyxyyxxxyyxxyxyxyyyxxyyxyyyxxyyxxyxxxxxxyyyxyxxxyyxyxxxxyyxxxxyxyyxyyyxxxyxxxxxxyyxxxxyxxyxxxxxxyyyxxyyxyyxxyxyxyyxxxyyxyyxyyyyxyyxyyyxxyyxxyxxxxyxyyxxxxyxxxxxxyyyxyyyxyyxyxxxxyyxyxxyxyyxxxyyxyyxyxxxxxyxxxxxxyyxyyxyxyyxxxxyxyyxyxyyxyyxxyxyxyyyxxyyxxyxxxxxxyyxyxxyxyyyxyxxxxyxxxxxxyyxyxxxxyyxxxxyxyyxyyyxxyyxxyxxxyyyyxxyxxyxxxxxxyyxxyyxxyyxyyyyxyyyxxyxxxyxxxxxxyyxxxyyxyyxxxxyxyyyxxxxxyyyxyxxxyyyxyxyxyyyxxyxxyyxxyxyxxyxxxxxxyyyxyxxxyyxyxxxxyyxxyxyxxyxxxxxxyyxxyyxxyyxyyxxxyyxxxxyxyyxxyyyxxyxxxxxxyyxxxyyxyyxyxxxxyyxxxxyxyyxyyxxxyyxyyxxxyyxxyxyxyyxyyyxxyyxxyyyxyyxxyxyxyyyxxyyxxyxyyxxxxyxxxxxxyyyxxxxxyyyxyxyxyyyyxyxxyyyyxyxxyyxyyxxxyyxxyxyxxyxxxxxxyyxyxxxxyyyxyxyxyyxyyyxxyyyxyxxxyyyxxyyxxyxxxxxxyyxxxxyxyyxyyyxxyyxxyxxxxyxxxxxxyyxxyyxxyyxyyyyxyyyxxyxxxyxxxxxxyyxxxxyxyyxyyyxxyyyyxxyxyyxyyyyxyyxyyyxxyyxxyxyxxyxxxxxxyyyxyyyxyyxyxxxxyyxyyyyxxyxxxxxxyyyxxyyxyyyxyxxxyyyxyxyxyyxyyxyxyyxxxyxxyyxyyxxxyyxxyxyxyyyxxyyxxyxxxxxxyyxxxxyxyyxxxyyxyyyxxyxxyyxyyyyxyyyxxyyxyyyxxyyxxyxxxxxxyyxxxxyxxyxxxxxxyyyxxyyxyyyxyxxxyyyxxyxxyyxxxxyxyyxyyyxxyyxxyyyxyyxxyxyxxyxxxxxxyyyxxyyxyyyxyxxxyyyxxyxxyyxyxxyxyyxyyyxxyyxxyyyxxyxxxxxxyyxyxxyxyyxyyyxxxyxxxxxxyyxxxxyxxyxxxxxxyyxyyxxxyyxyyyyxyyxxyyyxxyxxxxxxyyxxyyxxyyxyxxyxyyxyyxxxyyxxyxyxxyxyyyx"
 expected = "Ciphey is an automated decoding tool. You give it encrypted or encoded text and it tries to work out what was done to it, without you having to know the key or even the cipher. It searches through many possible decodings, checks each candidate to see whether it looks like English or matches a known pattern such as an email addres
```

**File**: `benches/data/search.toml` (modified, +7/-0)
```diff
@@ -96,6 +96,13 @@ layers = ["URL"]
 input = "Meet%20me%20at%20the%20old%20lighthouse%20after%20midnight%20and%20bring%20the%20map%2C%20the%20key%20and%20a%20torch."
 expected = "Meet me at the old lighthouse after midnight and bring the map, the key and a torch."
 
+[[case]]
+kind = "single"
+name = "unicode_escapes"
+layers = ["Unicode Escapes"]
+input = '\u004D\u0065\u0065\u0074\u0020\u006D\u0065\u0020\u0061\u0074\u0020\u0074\u0068\u0065\u0020\u006F\u006C\u0064\u0020\u006C\u0069\u0067\u0068\u0074\u0068\u006F\u0075\u0073\u0065\u0020\u0061\u0066\u0074\u0065\u0072\u0020\u006D\u0069\u0064\u006E\u0069\u0067\u0068\u0074\u0020\u0061\u006E\u0064\u0020\u0062\u0072\u0069\u006E\u0067\u0020\u0074\u0068\u0065\u0020\u006D\u0061\u0070\u002C\u0020\u0074\u0068\u0065\u0020\u006B\u0065\u0079\u0020\u0061\u006E\u0064\u0020\u0061\u0020\u0074\u006F\u0072\u0063\u0068\u002E'
+expected = "Meet me at the old lighthouse after midnight and bring the map, the key and a torch."
+
 [[case]]
 kind = "single"
 name = "citrix_ctx1"
```

**File**: `src/decoders/mod.rs` (modified, +9/-0)
```diff
@@ -46,6 +46,8 @@ pub mod citrix_ctx1_decoder;
 /// The crack_results module defines the CrackResult
 /// Each and every decoder return same CrackResult
 pub mod crack_results;
+/// The unicode_escape_decoder module decodes Unicode escapes like `\u00e9`, `%u00E9` and `U+00E9`
+pub mod unicode_escape_decoder;
 /// The url_decoder module decodes url
 pub mod url_decoder;
 
@@ -111,6 +113,7 @@ use railfence_decoder::RailfenceDecoder;
 use reverse_decoder::ReverseDecoder;
 use rot47_decoder::ROT47Decoder;
 use substitution_generic_decoder::SubstitutionGenericDecoder;
+use unicode_escape_decoder::UnicodeEscapeDecoder;
 use url_decoder::URLDecoder;
 use vigenere_decoder::VigenereDecoder;
 use z85_decoder::Z85Decoder;
@@ -161,6 +164,8 @@ pub enum DecoderType {
     CitrixCtx1Decoder(citrix_ctx1_decoder::CitrixCTX1Decoder),
     /// url decoder
     UrlDecoder(url_decoder::URLDecoder),
+    /// unicode escape decoder
+    UnicodeEscapeDecoder(unicode_escape_decoder::UnicodeEscapeDecoder),
     /// reverse decoder
     ReverseDecoder(reverse_decoder::ReverseDecoder),
     /// morse decoder
@@ -250,6 +255,10 @@ pub static DECODER_MAP: Lazy<HashMap<&str, DecoderBox>> = Lazy::new(|| {
             DecoderBox::new(Decoder::<CitrixCTX1Decoder>::new()),
         ),
         ("URL", DecoderBox::new(Decoder::<URLDecoder>::new())),
+        (
+            "Unicode Escapes",
+            DecoderBox::new(Decoder::<UnicodeEscapeDecoder>::new()),
+        ),
         ("Base32", DecoderBox::new(Decoder::<Base32Decoder>::new())),
         ("Reverse", DecoderBox::new(Decoder::<ReverseDecoder>::new())),
         (
```

**File**: `src/decoders/unicode_escape_decoder.rs` (added, +649/-0)
```diff
@@ -0,0 +1,649 @@
+//! Decode Unicode escape sequences: `\u00e9`, `\u{1F600}`, `\U0001F600`, `%u00E9` and
+//! `U+00E9`.
+//!
+//! The text is scanned once. Every well-formed escape is replaced by its character and
+//! everything else is copied unchanged, so partly escaped text such as `na\u00efve` decodes
+//! too, and a `\u` that isn't followed by hex digits (`C:\users`) is left alone.
+//!
+//! | Form         | Used by                    | Hex digits                                  |
+//! |--------------|----------------------------|---------------------------------------------|
+//! | `\uXXXX`     | JSON, JavaScript, Java, C# | 4, a UTF-16 surrogate pair above U+FFFF     |
+//! | `\u{X…}`     | JavaScript (ES2015), Rust  | 1 to 6                                      |
+//! | `\UXXXXXXXX` | Python, C, C++             | 8                                           |
+//! | `%uXXXX`     | JavaScript `escape()`      | 4, a UTF-16 surrogate pair above U+FFFF     |
+//! | `U+XXXX`     | Unicode notation           | 4 to 6                                      |
+//!
+//! References:
+//! * ECMA-262 string escapes: <https://tc39.es/ecma262/#prod-UnicodeEscapeSequence>
+//! * JSON escapes and surrogate pairs, RFC 8259 section 7:
+//!   <https://datatracker.ietf.org/doc/html/rfc8259#section-7>
+//! * Python's `unicode_escape` codec:
+//!   <https://docs.python.org/3/library/codecs.html#text-encodings>
+//! * JavaScript `unescape()`: <https://tc39.es/ecma262/#sec-unescape-string>
+//! * CyberChef "Unescape Unicode Characters":
+//!   <https://gchq.github.io/CyberChef/#recipe=Unescape_Unicode_Characters('%5C%5Cu')>
+
+use crate::checkers::CheckerTypes;
+use crate::decoders::interface::check_string_success;
+
+use super::crack_results::CrackResult;
+use super::interface::Crack;
+use super::interface::Decoder;
+
+use log::{debug, info, trace};
+
+/// The Unicode escape decoder, call:
+/// `let unicode_escape_decoder = Decoder::<UnicodeEscapeDecoder>::new()` to create a new instance
+/// And then call:
+/// `result = unicode_escape_decoder.crack(input)` to decode Unicode escape sequences
+/// The struct generated by new() comes from interface.rs
+/// ```
+/// use ciphey::decoders::unicode_escape_decoder::UnicodeEscapeDecoder;
+/// use ciphey::decoders::interface::{Crack, Decoder};
+/// use ciphey::checkers::{athena::Athena, CheckerTypes, checker_type::{Check, Checker}};
+///
+/// let decoder = Decoder::<UnicodeEscapeDecoder>::new();
+/// let athena_checker = Checker::<Athena>::new();
+/// let checker = CheckerTypes::CheckAthena(athena_checker);
+///
+/// let result = decoder
+///     .crack(r"\u0043\u0061\u0066\u00E9\u0020\u2615", &checker)
+///     .unencrypted_text;
+/// assert!(result.is_some());
+/// assert_eq!(result.unwrap()[0], "Café ☕");
+/// ```
+pub struct UnicodeEscapeDecoder;
+
+impl Crack for Decoder<UnicodeEscapeDecoder> {
+    fn new() -> Decoder<UnicodeEscapeDecoder> {
+        Decoder {
+            name: "Unicode Escapes",
+            description: "Unicode escape sequences write each character as its code point in hexadecimal: \\u00E9 (JSON, JavaScript, Java and C#, with UTF-16 surrogate pairs above U+FFFF), \\u{1F600} (JavaScript and Rust), \\U0001F600 (Python and C), %u00E9 (JavaScript escape()) and U+00E9 (Unicode notation).",
+            link: "https://en.wikipedia.org/wiki/Escape_sequences_in_C#Universal_character_names",
+            tags: vec!["unicode_escape", "unicode", "escape", "decoder"],
+            popularity: 0.4,
+            phantom: std::marker::PhantomData,
+        }
+    }
+
+    /// Replaces every escape in `text` with its character (see the module docs for the
+    /// forms) and runs the checker on the result.
+    ///
+    /// Fails unless at least one escape was replaced. Also fails if an escape is not a
+    /// character (a lone surrogate, or above U+10FFFF) or the result has control
+    /// characters other than tab, carriage return and line feed.
+    fn crack(&self, text: &str, checker: &CheckerTypes) -> CrackResult {
+        trace!("Trying Unicode escapes with text {:?}", text);
+        let mut results = CrackResult::new(self, text.to_string());
+
+        // One pass over the bytes that rejects almost every input the search tries
+        if !has_escape_marker(text) {
+            trace!("No Unicode escape marker in text");
+            return results;
+        }
+
+        let Some(decoded_text) = decode_unicode_escapes(text) else {
+            debug!("Failed to decode Unicode escapes: none found, or one is not a character");
+            return results;
+        };
+
+        if has_unexpected_control_character(&decoded_text) {
+            debug!(
+                "Failed to decode Unicode escapes: {:?} has control characters",
+                decoded_text
+            );
+            return results;
+        }
+
+        if !check_string_success(&decoded_text, text) {
+            info!(
+                "Failed to decode Unicode escapes because check_str
```

**File**: `src/filtration_system/mod.rs` (modified, +3/-0)
```diff
@@ -34,6 +34,7 @@ use crate::decoders::railfence_decoder::RailfenceDecoder;
 use crate::decoders::reverse_decoder::ReverseDecoder;
 use crate::decoders::rot47_decoder::ROT47Decoder;
 use crate::decoders::substitution_generic_decoder::SubstitutionGenericDecoder;
+use crate::decoders::unicode_escape_decoder::UnicodeEscapeDecoder;
 use crate::decoders::url_decoder::URLDecoder;
 use crate::decoders::vigenere_decoder::VigenereDecoder;
 use crate::decoders::z85_decoder::Z85Decoder;
@@ -251,6 +252,7 @@ pub fn filter_and_get_decoders(_text_struct: &DecoderResult) -> Decoders {
     let base65536 = Decoder::<Base65536Decoder>::new();
     let citrix_ctx1 = Decoder::<CitrixCTX1Decoder>::new();
     let url = Decoder::<URLDecoder>::new();
+    let unicode_escape = Decoder::<UnicodeEscapeDecoder>::new();
     let base32 = Decoder::<Base32Decoder>::new();
     let reversedecoder = Decoder::<ReverseDecoder>::new();
     let morsecodedecoder = Decoder::<MorseCodeDecoder>::new();
@@ -292,6 +294,7 @@ pub fn filter_and_get_decoders(_text_struct: &DecoderResult) -> Decoders {
             Box::new(railfencedecoder),
             Box::new(citrix_ctx1),
             Box::new(url),
+            Box::new(unicode_escape),
             Box::new(rot47decoder),
             Box::new(z85),
             Box::new(ascii85),
```

**File**: `src/searchers/helper_functions.rs` (modified, +1/-0)
```diff
@@ -86,6 +86,7 @@ pub fn is_common_sequence(prev_decoder: &str, current_cipher: &str) -> bool {
         "Binary",
         "Octal",
         "URL",
+        "Unicode Escapes",
     ];
     STACKABLE.contains(&prev_decoder) && STACKABLE.contains(&current_cipher)
 }
```

**File**: `tests/unicode_escape_decoder.rs` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+//! End-to-end tests for the Unicode escape decoder: the whole search, started through
+//! `perform_cracking`, has to find the plaintext.
+
+use ciphey::config::Config;
+use ciphey::perform_cracking;
+use ciphey::{set_test_db_path, TestDatabase};
+use serial_test::serial;
+
+/// The config for every test here: the default one with a longer timeout.
+///
+/// Ciphey's config is process-wide and only the first one set takes effect, so the tests
+/// in this file can't use different ones. The two-layer search in
+/// `test_cracks_base64_of_unicode_escapes` takes a couple of seconds in an unoptimised
+/// build on a busy machine, close to the default 5 second timeout. Every search returns
+/// as soon as it finds the plaintext, so a passing test never waits for the timeout.
+fn config() -> Config {
+    Config {
+        timeout: 30,
+        ..Config::default()
+    }
+}
+
+/// Cracks `encoded` and returns the plaintext and the names of the decoders on the path
+fn crack(encoded: &str) -> (String, Vec<&'static str>) {
+    let _test_db = TestDatabase::default();
+    set_test_db_path();
+
+    let result = perform_cracking(encoded, config())
+        .expect("the search should not time out")
+        .expect("the search should find the plaintext");
+    let path = result.path.iter().map(|step| step.decoder).collect();
+    (result.text[0].clone(), path)
+}
+
+#[test]
+#[serial]
+fn test_cracks_backslash_u_escapes() {
+    let (plaintext, path) =
+        crack(r"\u0048\u0065\u006C\u006C\u006F\u002C\u0020\u0057\u006F\u0072\u006C\u0064\u0021");
+    assert_eq!(plaintext, "Hello, World!");
+    assert!(path.contains(&"Unicode Escapes"), "path: {path:?}");
+}
+
+#[test]
+#[serial]
+fn test_cracks_percent_u_escapes() {
+    // JavaScript escape() style, made with CyberChef "Escape Unicode Characters" (prefix %u)
+    let (plaintext, path) = crack(
+        "%u0054%u0068%u0065%u0020%u0071%u0075%u0069%u0063%u006B%u0020%u0062%u0072%u006F%u0077%u006E%u0020%u0066%u006F%u0078%u0020%u006A%u0075%u006D%u0070%u0073%u0020%u006F%u0076%u0065%u0072%u0020%u0074%u0068%u0065%u0020%u006C%u0061%u007A%u0079%u0020%u0064%u006F%u0067",
+    );
+    assert_eq!(plaintext, "The quick brown fox jumps over the lazy dog");
+    assert!(path.contains(&"Unicode Escapes"), "path: {path:?}");
+}
+
+#[test]
+#[serial]
+fn test_cracks_base64_of_unicode_escapes() {
+    // Base64 of the \u escapes in test_cracks_backslash_u_escapes
+    let (plaintext, path) = crack(
+        "XHUwMDQ4XHUwMDY1XHUwMDZDXHUwMDZDXHUwMDZGXHUwMDJDXHUwMDIwXHUwMDU3XHUwMDZGXHUwMDcyXHUwMDZDXHUwMDY0XHUwMDIx",
+    );
+    assert_eq!(plaintext, "Hello, World!");
+    assert_eq!(path, ["Base64", "Unicode Escapes"]);
+}
```

---

### Incident Patch 13: `ee6fb8bb` (2026-10-01)
**Commit Message**: bench: criterion suite for decoders, checkers, search and startup (#1032)

* bench: criterion suite for decoders, checkers, A* search and startup

Replaces the old benches, which used tiny inputs and mostly measured
cache hits, with five criterion suites over checked-in fixtures:

- decoders: every decoder on medium, long and rejected input
- checkers: English, LemmeKnow, password and Athena on hits and misses
- crib: regex and wordlist checkers plus end-to-end --regex searches
- search: perform_cracking on single-layer, multi-layer and no-solution
  inputs with a fixed 1 s timeout
- startup: config and wordlist loading, the SQLite cache, and the CLI
  binary as a subprocess

Each case is checked against its fixture before it is timed. CI builds
the benchmarks (unoptimised) without running them. Baseline numbers
and a profile are in docs/benchmarks.md.

* bench: start every timed search with fresh decoder statistics

The A* search keeps per-decoder success statistics for the whole process
and uses them in its edge costs, so a benchmarked search explored in a
different order depending on how many searches ran before it, and faster
code (more iterations) changed the path being measur

**File**: `.codespellrc` (modified, +2/-0)
```diff
@@ -1,3 +1,5 @@
 [codespell]
 # "ue" appears in Caesar-cipher test vectors in caesar_decoder.rs
 ignore-words-list = ue
+# Encoded benchmark inputs are gibberish by design
+skip = ./benches/data/*,benches/data/*
```

**File**: `.github/workflows/quickstart.yml` (modified, +23/-0)
```diff
@@ -29,6 +29,29 @@ jobs:
       - name: Run cargo check
         run: cargo check --all-targets
 
+  bench-build:
+    name: Benchmarks build
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout sources
+        uses: actions/checkout@v4
+
+      - name: Install stable toolchain
+        uses: dtolnay/rust-toolchain@stable
+
+      - name: Cache cargo artifacts
+        uses: Swatinem/rust-cache@v2
+
+      # Builds the benchmarks without running them; they are too slow and noisy for CI.
+      # The bench profile inherits fat LTO and one codegen unit from the release profile,
+      # which only matters for timing, so this check builds them unoptimised instead.
+      - name: Build benchmarks
+        run: cargo bench --no-run
+        env:
+          CARGO_PROFILE_BENCH_OPT_LEVEL: "0"
+          CARGO_PROFILE_BENCH_LTO: "false"
+          CARGO_PROFILE_BENCH_CODEGEN_UNITS: "256"
+
   test:
     name: Test Suite (${{ matrix.os }})
     strategy:
```

**File**: `Cargo.toml` (modified, +12/-3)
```diff
@@ -84,16 +84,25 @@ codegen-units = 1
 [profile.dist]
 inherits = "release"
 
+# Criterion benchmarks, see benches/README.md
 [[bench]]
-name = "benchmark_crackers"
+name = "decoders"
 harness = false
 
 [[bench]]
-name = "benchmark_decoders"
+name = "checkers"
 harness = false
 
 [[bench]]
-name = "benchmark_whole_program"
+name = "crib"
+harness = false
+
+[[bench]]
+name = "search"
+harness = false
+
+[[bench]]
+name = "startup"
 harness = false
 
 # Config for 'cargo dist'
```

**File**: `benches/README.md` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+# Benchmarks
+
+Criterion benchmarks for the decoders, the checkers, the A* search and startup.
+Baseline numbers and a profile are in [docs/benchmarks.md](../docs/benchmarks.md).
+
+```sh
+cargo bench                          # everything, about 10 minutes
+cargo bench --bench decoders         # one suite
+cargo bench --bench decoders -- caesar        # benchmarks whose id matches a regex
+cargo bench --bench search -- search/multi
+cargo bench -- --test                # run every benchmark once and check the fixtures
+```
+
+| Suite | What it measures | Ids |
+|---|---|---|
+| `decoders` | `Decoder::crack` with the Athena checker, for every decoder, on an 84 character text encoded with that decoder (`medium`), a 576 character one (`long`), and a gibberish string it rejects (`miss`, the common case during a search) | `decoders/<decoder>/{medium,long,miss}` |
+| `checkers` | English (gibberish detection), LemmeKnow, the password list, and Athena (all of them in turn), on hits and misses, at each sensitivity the decoders use | `checkers/<checker>[_<sensitivity>]/<input>` |
+| `crib` | The regex and wordlist checkers, plus two end-to-end `--regex` searches | `crib/...`, `crib/search/...` |
+| `search` | `perform_cracking` end to end: input that is already plaintext, single-layer and multi-layer encodings, and inputs with no solution, all with a 1 second timeout | `search/{plaintext,single,multi,no_solution}/<case>` |
+| `startup` | Config defaults, loading `config.toml` and a wordlist, the SQLite cache, `perform_cracking` on a cache hit and miss, and the `ciphey` binary started as a subprocess (Unix only) | `startup/...` |
+
+Criterion keeps results in `target/criterion` and compares each run with the previous
+one. To compare against a named baseline:
+
+```sh
+cargo bench -- --save-baseline before
+# ...change something...
+cargo bench -- --baseline before
+```
+
+On a busy machine two full runs minutes apart can differ by more than the change you
+are measuring. To compare two versions fairly, build both bench binaries (for example
+from a `git worktree`, with a different `CARGO_TARGET_DIR`) and alternate between them
+one benchmark at a time, sending each side's results to its own `CRITERION_HOME`:
+
+```sh
+for id in $(target/release/deps/search-<hash> --bench --list | sed -n 's/: benchmark$//p'); do
+  CRITERION_HOME=/tmp/old /path/to/old/target/release/deps/search-<hash> --bench "^$id\$"
+  CRITERION_HOME=/tmp/new target/release/deps/search-<hash> --bench "^$id\$"
+done
+```
+
+## Inputs
+
+All inputs are checked in under [`data/`](data) so runs are comparable:
+
+* `decoders.toml`: one `medium` and one `long` input per decoder, plus the shared `miss` input.
+* `checkers.toml`: named inputs and the checker runs over them.
+* `search.toml`: the A* corpus. `layers` says how each input was built, innermost first.
+* `config.toml`: the default `~/.ciphey/config.toml`, used by the startup benchmarks.
+* `wordlist.txt`: 5,000 words for the wordlist checker and wordlist loading.
+
+Every benchmark first runs its case once and panics if the result differs from the
+fixture (`expected`, `success`, `identified`, `outcome`), so a behaviour change shows up
+as a failure instead of as a different number. If you change behaviour on purpose,
+update the fixture. Search results are only checked in optimised builds: under
+`cargo test --benches` some searches don't finish within the 1 second timeout.
+
+## Things to know
+
+* Ciphey's config and database path are process-wide and can only be set once, so each
+  suite picks one configuration when it starts. That is why the regex/wordlist
+  checkers have their own suite.
+* `decoders`, `checkers`, `crib` and `search` keep the cache database in memory, so
+  every `perform_cracking` call is a cache miss and nothing under `~/.ciphey` is read or
+  written. `startup` uses a scratch dir under `target/tmp` for its database and as
+  `HOME` for the CLI.
+* The A* search keeps per-decoder success statistics for the life of the process and
+  uses them in its edge costs. The search benchmarks clear them before every
+  iteration (`ciphey::reset_decoder_stats`), so each search explores in the same order
+  as in a fresh `ciphey` process instead of depending on how many searches ran before.
+* The no-solution searches end when the decoders run out of candidates, when the
+  search settles on a false positive (most gibberish ends up as rot47 → Vigenere), or
+  at the timeout. Which one happens can depend on machine speed, so only the
+  "exhausted" and "timeout" outcomes are checked.
+* The search runs on rayon's thread pool, so its numbers depend on core count and on
+  whatever else the machine is doing. Close other heavy work before comparing runs.
+
+## Profiling
+
+The bench profile inherits `strip = "symbols"` from the release profile. To profile,
+build with symbols and use criterion's profile mode, which runs a benchmark for a fixed
+time without analysi
```

**File**: `benches/benchmark_checkers.rs` (removed, +0/-19)
```diff
@@ -1,19 +0,0 @@
-use ciphey::checkers::athena::Athena;
-use ciphey::checkers::checker_type::{Check, Checker};
-use ciphey::checkers::CheckerTypes;
-use ciphey::decoders::base64_decoder::Base64Decoder;
-use ciphey::decoders::interface::{Crack, Decoder};
-use criterion::{criterion_group, criterion_main, Criterion};
-use std::hint::black_box;
-
-pub fn criterion_benchmark(c: &mut Criterion) {
-    let decode_base64 = Decoder::<Base64Decoder>::new();
-    let athena_checker = Checker::<Athena>::new();
-    let checker = CheckerTypes::CheckAthena(athena_checker);
-    c.bench_function("base64 successful decoding", |b| {
-        b.iter(|| decode_base64.crack(black_box("aGVsbG8gd29ybGQ="), &checker))
-    });
-}
-
-criterion_group!(benches, criterion_benchmark);
-criterion_main!(benches);
```

**File**: `benches/benchmark_crackers.rs` (removed, +0/-35)
```diff
@@ -1,35 +0,0 @@
-use ciphey::checkers::athena::Athena;
-use ciphey::checkers::checker_type::{Check, Checker};
-use ciphey::checkers::CheckerTypes;
-use ciphey::config::{set_global_config, Config};
-use ciphey::decoders::base64_decoder::Base64Decoder;
-use ciphey::decoders::interface::{Crack, Decoder};
-use criterion::{criterion_group, criterion_main, Criterion};
-use env_logger::Builder;
-use log::LevelFilter;
-use std::hint::black_box;
-
-pub fn criterion_benchmark(c: &mut Criterion) {
-    // Initialize logger with only error level to suppress debug messages
-    let mut builder = Builder::new();
-    builder.filter_level(LevelFilter::Error);
-    builder.init();
-
-    // Setup global config to suppress output
-    let config = Config {
-        api_mode: true,
-        verbose: 0,
-        ..Config::default()
-    };
-    set_global_config(config);
-
-    let decode_base64 = Decoder::<Base64Decoder>::new();
-    let athena_checker = Checker::<Athena>::new();
-    let checker = CheckerTypes::CheckAthena(athena_checker);
-    c.bench_function("base64 successful decoding", |b| {
-        b.iter(|| decode_base64.crack(black_box("aGVsbG8gd29ybGQ="), &checker))
-    });
-}
-
-criterion_group!(benches, criterion_benchmark);
-criterion_main!(benches);
```

**File**: `benches/benchmark_decoders.rs` (removed, +0/-160)
```diff
@@ -1,160 +0,0 @@
-use ciphey::checkers::athena::Athena;
-use ciphey::checkers::checker_type::{Check, Checker};
-use ciphey::checkers::CheckerTypes;
-use ciphey::config::{set_global_config, Config};
-use ciphey::decoders::{
-    base32_decoder::Base32Decoder,
-    base58_bitcoin_decoder::Base58BitcoinDecoder,
-    base58_flickr_decoder::Base58FlickrDecoder,
-    base64_decoder::Base64Decoder,
-    binary_decoder::BinaryDecoder,
-    hexadecimal_decoder::HexadecimalDecoder,
-    interface::{Crack, Decoder},
-};
-use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
-use env_logger::Builder;
-use log::LevelFilter;
-use std::hint::black_box;
-use std::time::Duration;
-
-// Test cases for different decoders
-struct DecoderTestCase<'a> {
-    encoded: &'a str,
-    // Documents the expected plaintext; not asserted on, this is a benchmark not a test.
-    #[allow(dead_code)]
-    expected: &'a str,
-    description: &'a str,
-}
-
-// Test data for benchmarking each decoder
-const BASE64_TESTS: &[DecoderTestCase] = &[
-    DecoderTestCase {
-        encoded: "aGVsbG8gd29ybGQ=",
-        expected: "hello world",
-        description: "simple",
-    },
-    DecoderTestCase {
-        encoded: "TXV0bGV5LCB5b3Ugc25pY2tlcmluZywgZmxvcHB5IGVhcmVkIGhvdW5kLiBXaGVuIGNvdXJhZ2UgaXMgbmVlZGVkLCB5b3XigJlyZSBuZXZlciBhcm91bmQu",
-        expected: "Mutley, you snickering, floppy eared hound. When courage is needed, you're never around.",
-        description: "medium",
-    },
-];
-
-const BASE32_TESTS: &[DecoderTestCase] = &[DecoderTestCase {
-    encoded: "NBSWY3DPEB3W64TMMQ======",
-    expected: "hello world",
-    description: "simple",
-}];
-
-const HEX_TESTS: &[DecoderTestCase] = &[DecoderTestCase {
-    encoded: "68656c6c6f20776f726c64",
-    expected: "hello world",
-    description: "simple",
-}];
-
-const BINARY_TESTS: &[DecoderTestCase] = &[
-    DecoderTestCase {
-        encoded: "01101000 01100101 01101100 01101100 01101111 00100000 01110111 01101111 01110010 01101100 01100100",
-        expected: "hello world",
-        description: "simple",
-    },
-];
-
-const BASE58_BITCOIN_TESTS: &[DecoderTestCase] = &[DecoderTestCase {
-    encoded: "StV1DL6CwTryKyV",
-    expected: "hello world",
-    description: "simple",
-}];
-
-const BASE58_FLICKR_TESTS: &[DecoderTestCase] = &[DecoderTestCase {
-    encoded: "rTu1dk6cWsRYjYu",
-    expected: "hello world",
-    description: "simple",
-}];
-
-pub fn benchmark_decoders(c: &mut Criterion) {
-    // Initialize logger with only error level to suppress debug messages
-    let mut builder = Builder::new();
-    builder.filter_level(LevelFilter::Error);
-    builder.init();
-
-    // Setup global config to suppress output
-    let config = Config {
-        api_mode: true,
-        verbose: 0,
-        ..Config::default()
-    };
-    set_global_config(config);
-
-    // Create a benchmark group with appropriate measurement time
-    let mut group = c.benchmark_group("decoder_performance");
-    group.measurement_time(Duration::from_secs(5));
-    group.sample_size(50); // More samples for better statistical significance
-
-    // Create a checker to use for all decoders
-    let athena_checker = Checker::<Athena>::new();
-    let checker = CheckerTypes::CheckAthena(athena_checker);
-
-    // Base64 decoder benchmarks
-    benchmark_decoder::<Base64Decoder>(&mut group, "base64", BASE64_TESTS, &checker);
-
-    // Base32 decoder benchmarks
-    benchmark_decoder::<Base32Decoder>(&mut group, "base32", BASE32_TESTS, &checker);
-
-    // Hex decoder benchmarks
-    benchmark_decoder::<HexadecimalDecoder>(&mut group, "hexadecimal", HEX_TESTS, &checker);
-
-    // Binary decoder benchmarks
-    benchmark_decoder::<BinaryDecoder>(&mut group, "binary", BINARY_TESTS, &checker);
-
-    // Base58 Bitcoin decoder benchmarks
-    benchmark_decoder::<Base58BitcoinDecoder>(
-        &mut group,
-        "base58_bitcoin",
-        BASE58_BITCOIN_TESTS,
-        &checker,
-    );
-
-    // Base58 Flickr decoder benchmarks
-    benchmark_decoder::<Base58FlickrDecoder>(
-        &mut group,
-        "base58_flickr",
-        BASE58_FLICKR_TESTS,
-        &checker,
-    );
-
-    group.finish();
-}
-
-// Generic function to benchmark any decoder with its test cases
-fn benchmark_decoder<T>(
-    group: &mut criterion::BenchmarkGroup<criterion::measurement::WallTime>,
-    decoder_name: &str,
-    test_cases: &[DecoderTestCase],
-    checker: &CheckerTypes,
-) where
-    Decoder<T>: Crack,
-{
-    let decoder = Decoder::<T>::new();
-
-    for test in test_cases {
-        let id = BenchmarkId::new(
-            format!("{}_{}", decoder_name, test.description),
-            test.encoded.len(),
-        );
-
-        group.bench_with_input(id, test.encoded, |b, encoded| {
-            b.iter_batched_ref(
-                || {
-                    let _test_db = ciphey::TestDatabase::default();
-                    ciphey::set_test_db_path();
-                },
-                |_|
```

**File**: `benches/benchmark_whole_program.rs` (removed, +0/-118)
```diff
@@ -1,118 +0,0 @@
-use ciphey::config::Config;
-use ciphey::perform_cracking;
-use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
-use env_logger::Builder;
-use log::LevelFilter;
-use std::hint::black_box;
-use std::time::Duration;
-
-// Test cases with different encodings/encryptions and varying complexity
-const TEST_CASES: &[(&str, &str)] = &[
-    // Format: (encoded_text, description)
-    // Base64 encoded text (simple)
-    (
-        "aGVsbG8gd29ybGQ=",
-        "base64_simple",
-    ),
-    // Base64 encoded longer text
-    (
-        "TXV0bGV5LCB5b3Ugc25pY2tlcmluZywgZmxvcHB5IGVhcmVkIGhvdW5kLiBXaGVuIGNvdXJhZ2UgaXMgbmVlZGVkLCB5b3XigJlyZSBuZXZlciBhcm91bmQu",
-        "base64_medium",
-    ),
-    // Long Base64 encoded text (from integration test)
-    (
-        "TXV0bGV5LCB5b3Ugc25pY2tlcmluZywgZmxvcHB5IGVhcmVkIGhvdW5kLiBXaGVuIGNvdXJhZ2UgaXMgbmVlZGVkLCB5b3XigJlyZSBuZXZlciBhcm91bmQuIFRob3NlIG1lZGFscyB5b3Ugd2VhciBvbiB5b3VyIG1vdGgtZWF0ZW4gY2hlc3Qgc2hvdWxkIGJlIHRoZXJlIGZvciBidW5nbGluZyBhdCB3aGljaCB5b3UgYXJlIGJlc3QuIFNvLCBzdG9wIHRoYXQgcGlnZW9uLCBzdG9wIHRoYXQgcGlnZW9uLCBzdG9wIHRoYXQgcGlnZW9uLCBzdG9wIHRoYXQgcGlnZW9uLCBzdG9wIHRoYXQgcGlnZW9uLCBzdG9wIHRoYXQgcGlnZW9uLCBzdG9wIHRoYXQgcGlnZW9uLiBIb3d3d3chIE5hYiBoaW0sIGphYiBoaW0sIHRhYiBoaW0sIGdyYWIgaGltLCBzdG9wIHRoYXQgcGlnZW9uIG5vdy4g",
-        "base64_long",
-    ),
-    // Base32 encoded text
-    (
-        "NBSWY3DPEB3W64TMMQ======",
-        "base32",
-    ),
-    // Hex encoded text
-    (
-        "68656c6c6f20776f726c64",
-        "hex",
-    ),
-    // Binary encoded text
-    (
-        "01101000 01100101 01101100 01101100 01101111 00100000 01110111 01101111 01110010 01101100 01100100",
-        "binary",
-    ),
-    // Plain text (early exit case)
-    (
-        "This is just plain text 123",
-        "plaintext",
-    ),
-    // Empty string (failure case)
-    (
-        "",
-        "empty_string",
-    ),
-];
-
-pub fn criterion_benchmark(c: &mut Criterion) {
-    // Initialize logger with only error level to suppress debug messages
-    let mut builder = Builder::new();
-    builder.filter_level(LevelFilter::Error);
-    builder.init();
-
-    // Create a benchmark group with longer measurement times for more accurate results
-    let mut group = c.benchmark_group("program_performance");
-
-    // Configure the benchmark group for better statistics
-    group.measurement_time(Duration::from_secs(10));
-    group.sample_size(30);
-
-    // Run benchmarks with different configurations
-    benchmark_with_config(&mut group, false, 5); // Default config
-    benchmark_with_config(&mut group, false, 1); // Fast config
-
-    group.finish();
-}
-
-fn benchmark_with_config(
-    group: &mut criterion::BenchmarkGroup<criterion::measurement::WallTime>,
-    top_results: bool,
-    timeout: u32,
-) {
-    let config_name = if top_results {
-        "top_results"
-    } else {
-        "default"
-    };
-    let timeout_str = format!("timeout_{}", timeout);
-
-    for (text, description) in TEST_CASES {
-        let id = BenchmarkId::new(
-            format!("{}_{}_{}", config_name, timeout_str, description),
-            text.len(),
-        );
-        group.bench_with_input(id, text, |b, text| {
-            b.iter_batched_ref(
-                || {
-                    let _test_db = ciphey::TestDatabase::default();
-                    ciphey::set_test_db_path();
-                },
-                |_| {
-                    // Create config and set necessary parameters
-                    let config = Config {
-                        timeout,
-                        top_results,
-                        verbose: 0,
-                        human_checker_on: false,
-                        api_mode: true, // Set to true to suppress output
-                        ..Config::default()
-                    };
-
-                    // Use perform_cracking with the configuration
-                    perform_cracking(black_box(text), config)
-                },
-                criterion::BatchSize::SmallInput,
-            );
-        });
-    }
-}
-
-criterion_group!(benches, criterion_benchmark);
-criterion_main!(benches);
```

---

### Incident Patch 14: `47bd16d6` (2026-10-01)
**Commit Message**: Fix hangs, panics and wrong results found in a general audit (#1033)

* fix(search): stop --top-results from hanging when the timer expires

When the timer fired, wait_for_search_result joined the A* thread without
receiving from the result channel. In top_results mode A* keeps sending every
result it finds into a bounded(1) channel, so once the buffer was full it blocked
in send() while the main thread blocked in join(): ciphey never exited.

Repro: ciphey --top-results -c 2 -t SGVsbG8sIFdvcmxkIQ== hangs (eu-stack shows
main in JoinHandle::join and the search thread in Sender::send).

Stopping the search now drains the channel until the thread has finished. A
result that arrives while stopping in normal mode (e.g. one the user accepted at
the human checker prompt as the timer ran out) is returned instead of a timeout.

Adds tests/cli.rs, end-to-end tests that run the binary against a temporary
HOME (Unix only, as dirs::home_dir() ignores HOME on Windows).

* fix(config): don't let get_config() lock in the default config

get_config() used get_or_init(Config::default), so any call made before
set_global_config() permanently installed the defaults and the later
set_global_config() w

**File**: `Cargo.lock` (modified, +2/-2)
```diff
@@ -3507,9 +3507,9 @@ dependencies = [
 
 [[package]]
 name = "quinn-proto"
-version = "0.11.14"
+version = "0.11.15"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "434b42fec591c96ef50e21e886936e66d3cc3f737104fdb9b737c40ffb94c098"
+checksum = "4fcb935c5bec503c2f0e306bdd3e58bb9029dcb14fa8d9ac76e3a5256ac0763e"
 dependencies = [
  "bytes",
  "getrandom 0.3.3",
```

**File**: `src/checkers/checker_type.rs` (modified, +2/-2)
```diff
@@ -32,9 +32,9 @@ pub struct Checker<Type> {
     /// Enhanced gibberish detector using BERT model
     /// This is only used when enhanced detection is enabled
     pub enhanced_detector: Option<()>, // Changed from GibberishDetector to () since we don't have the actual type
-    /// https://doc.rust-lang.org/std/marker/struct.PhantomData.html
+    /// <https://doc.rust-lang.org/std/marker/struct.PhantomData.html>
     /// Let's us save memory by telling the compiler that our type
-    /// acts like a type <T> even though it doesn't.
+    /// acts like a type `T` even though it doesn't.
     /// Stops the compiler complaining, else we'd need to implement
     /// some magic to make it work.
     pub _phantom: std::marker::PhantomData<Type>,
```

**File**: `src/checkers/english.rs` (modified, +16/-4)
```diff
@@ -27,7 +27,7 @@ impl Check for Checker<EnglishChecker> {
 
     fn check(&self, text: &str) -> CheckResult {
         // Normalize before checking
-        let text = normalise_string(text);
+        let normalised = normalise_string(text);
 
         // Get config to check if enhanced detection is enabled
         let config = get_config();
@@ -38,10 +38,12 @@ impl Check for Checker<EnglishChecker> {
             is_identified: if is_enhanced {
                 // When enhanced detection is enabled, use a more sensitive setting
                 // This is a simple approximation since we don't have the actual BERT model
-                !is_gibberish(&text, Sensitivity::High)
+                !is_gibberish(&normalised, Sensitivity::High)
             } else {
-                !is_gibberish(&text, self.sensitivity)
+                !is_gibberish(&normalised, self.sensitivity)
             },
+            // The text as given, not the normalised copy: this is what the human checker
+            // asks about and what top results lists.
             text: text.to_string(),
             checker_name: self.name,
             checker_description: self.description,
@@ -50,7 +52,7 @@ impl Check for Checker<EnglishChecker> {
         };
 
         // Handle edge case of very short strings after normalization
-        if text.len() < 2 {
+        if normalised.len() < 2 {
             // Reduced from 3 since normalization may remove punctuation
             result.is_identified = false;
         }
@@ -152,6 +154,16 @@ mod tests {
         assert!(checker.check("Prei?nterview He!llo Dog?").is_identified);
     }
 
+    #[test]
+    fn test_check_result_has_the_original_text() {
+        // The text is normalised for detection only. Returning the normalised copy made the
+        // human checker ask about "hello world" when the candidate was "Hello, World!".
+        let checker = Checker::<EnglishChecker>::new();
+        let result = checker.check("Hello, World!");
+        assert!(result.is_identified);
+        assert_eq!(result.text, "Hello, World!");
+    }
+
     #[test]
     fn test_check_fail_single_puncuation_char() {
         let checker = Checker::<EnglishChecker>::new();
```

**File**: `src/checkers/human_checker.rs` (modified, +69/-14)
```diff
@@ -47,6 +47,19 @@ pub fn human_checker(input: &CheckResult) -> bool {
         return true;
     }
 
+    let result = ask_once(input, prompt_user);
+    timer::resume();
+
+    cli_pretty_printing::success(&format!("DEBUG: Human checker returning: {}", result));
+    result
+}
+
+/// Asks the human about `input` with `ask`, unless they were already asked about it.
+///
+/// Only one prompt is shown at a time. Accepting a candidate ends the search, so a
+/// candidate that was already asked about was rejected and is rejected again without
+/// asking.
+fn ask_once(input: &CheckResult, ask: impl FnOnce(&CheckResult) -> bool) -> bool {
     // Acquire the lock to ensure only one thread prompts the user at a time
     let lock_result = get_prompt_lock().lock();
     let _guard = match lock_result {
@@ -63,35 +76,36 @@ pub fn human_checker(input: &CheckResult) -> bool {
     // Double-check HUMAN_CONFIRMED after acquiring the lock
     // Another thread might have confirmed while we were waiting for the lock
     if HUMAN_CONFIRMED.load(Ordering::Acquire) {
-        timer::resume();
         return true;
     }
 
     // Check if we've already prompted for this text
     let prompt_key = format!("{}{}", input.description, input.text);
     if !get_seen_prompts().insert(prompt_key) {
-        timer::resume();
-        return true; // Return true to allow the search to continue
+        // The human already rejected it; returning true here used to accept it anyway
+        return false;
     }
 
-    human_checker_check(&input.description, &input.text);
-
-    let reply: String = read!("{}\n");
-    cli_pretty_printing::success(&format!("DEBUG: Human checker received reply: '{}'", reply));
-    let result = reply.to_ascii_lowercase().starts_with('y');
+    let result = ask(input);
     // If the user confirmed, set the atomic boolean to true
     if result {
         HUMAN_CONFIRMED.store(true, Ordering::Release);
         cli_pretty_printing::success(
             "DEBUG: Human confirmed a result, future checks will be skipped",
         );
     }
-
     // Lock is released here when _guard goes out of scope
-    drop(_guard);
-    timer::resume();
+    result
+}
 
-    cli_pretty_printing::success(&format!("DEBUG: Human checker returning: {}", result));
+/// Shows the prompt for `input` and reads the answer from stdin.
+/// Rejections are recorded in the database.
+fn prompt_user(input: &CheckResult) -> bool {
+    human_checker_check(&input.description, &input.text);
+
+    let reply: String = read!("{}\n");
+    cli_pretty_printing::success(&format!("DEBUG: Human checker received reply: '{}'", reply));
+    let result = reply.to_ascii_lowercase().starts_with('y');
 
     if !result {
         let fd_result = database::insert_human_rejection(uuid::Uuid::new_v4(), &input.text, input);
@@ -104,7 +118,48 @@ pub fn human_checker(input: &CheckResult) -> bool {
                 ));
             }
         }
-        return false;
     }
-    true
+    result
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use crate::checkers::checker_type::{Check, Checker};
+    use crate::checkers::english::EnglishChecker;
+
+    /// A candidate plaintext as the English checker would report it
+    fn candidate(text: &str) -> CheckResult {
+        let mut result = CheckResult::new(&Checker::<EnglishChecker>::new());
+        result.is_identified = true;
+        result.text = text.to_string();
+        result.description = "Words".to_string();
+        result
+    }
+
+    #[test]
+    fn rejected_candidate_is_not_accepted_when_seen_again() {
+        // The prompt history is global, so use text no other test checks
+        let rejected = candidate("human checker test: candidate seen twice");
+        let mut prompts = 0;
+
+        assert!(!ask_once(&rejected, |_| {
+            prompts += 1;
+            false
+        }));
+        // Used to return true, accepting the candidate the human had just rejected
+        assert!(!ask_once(&rejected, |_| {
+            prompts += 1;
+            false
+        }));
+        assert_eq!(prompts, 1, "the human should only be asked once");
+
+        // Other candidates are still asked about
+        let other = candidate("human checker test: a different candidate");
+        assert!(!ask_once(&other, |_| {
+            prompts += 1;
+            false
+        }));
+        assert_eq!(prompts, 2);
+    }
 }
```

**File**: `src/cli/mod.rs` (modified, +50/-17)
```diff
@@ -5,18 +5,19 @@ pub use first_run::run_first_time_setup;
 use std::{fs::File, io::Read};
 
 use crate::cli_pretty_printing;
-use crate::cli_pretty_printing::panic_failure_both_input_and_fail_provided;
 use crate::config::{get_config_file_into_struct, load_wordlist, Config};
 /// This doc string acts as a help message when the uses run '--help' in CLI mode
 /// as do all doc strings on fields
-use clap::Parser;
+use clap::{ArgGroup, Parser};
 use log::trace;
 
 /// The struct for Clap CLI arguments
 #[derive(Parser)]
 #[command(author = "Bee <bee@skerritt.blog>", about, long_about = None)]
+// Exactly one of --text and --file is required
+#[command(group(ArgGroup::new("input").required(true).args(["text", "file"])))]
 pub struct Opts {
-    /// Some input. Because this isn't an Option<T> it's required to be used
+    /// The text to decode. Use either this or `--file`
     #[arg(short, long)]
     text: Option<String>,
 
@@ -67,8 +68,8 @@ pub struct Opts {
 /// Parse CLI Arguments turns a Clap Opts struct, seen above
 /// Into a library Struct for use within the program
 /// The library struct can be found in the [config](../config) folder.
-/// # Panics
-/// This function can panic when it gets both a file and text input at the same time.
+///
+/// Exits with a usage error unless exactly one of `--text` and `--file` is given.
 pub fn parse_cli_args() -> (String, Config) {
     let mut opts: Opts = Opts::parse();
     let min_log_level = match opts.verbose {
@@ -81,16 +82,10 @@ pub fn parse_cli_args() -> (String, Config) {
         env_logger::Env::default().filter_or(env_logger::DEFAULT_FILTER_ENV, min_log_level),
     );
 
-    let input_text: String = match (opts.file.take(), opts.text.take()) {
-        (Some(_), Some(_)) => {
-            panic_failure_both_input_and_fail_provided();
-            unreachable!("panic helper should terminate the process");
-        }
-        (Some(file), None) => read_and_parse_file(file),
-        (None, Some(text)) => text,
-        (None, None) => {
-            panic!("Error. No input was provided. Please use ciphey --help")
-        }
+    // clap has already checked that exactly one of these was given
+    let input_text: String = match opts.file.take() {
+        Some(file) => read_and_parse_file(file),
+        None => opts.text.take().unwrap_or_default(),
     };
 
     trace!("Program was called with CLI 😉");
@@ -159,8 +154,10 @@ fn cli_args_into_config_struct(opts: Opts, text: String) -> (String, Config) {
         }
     }
 
-    // Set top_results mode if the flag is present
-    config.top_results = opts.top_results;
+    // --top-results turns top results mode on; without it the config file decides
+    if opts.top_results {
+        config.top_results = true;
+    }
 
     // If top_results is enabled, automatically disable the human checker
     if config.top_results {
@@ -180,3 +177,39 @@ fn cli_args_into_config_struct(opts: Opts, text: String) -> (String, Config) {
 
     (text, config)
 }
+
+#[cfg(test)]
+mod tests {
+    use super::Opts;
+    use clap::error::ErrorKind;
+    use clap::{CommandFactory, Parser};
+
+    #[test]
+    fn cli_definition_is_valid() {
+        Opts::command().debug_assert();
+    }
+
+    #[test]
+    fn missing_input_is_a_usage_error() {
+        // Used to panic with "Error. No input was provided"
+        let error = Opts::try_parse_from(["ciphey"])
+            .err()
+            .expect("no input should be rejected");
+        assert_eq!(error.kind(), ErrorKind::MissingRequiredArgument);
+    }
+
+    #[test]
+    fn text_and_file_together_is_a_usage_error() {
+        // Used to panic with "Failed -- both file and text were provided"
+        let error = Opts::try_parse_from(["ciphey", "-t", "aGVsbG8=", "-f", "input.txt"])
+            .err()
+            .expect("--text with --file should be rejected");
+        assert_eq!(error.kind(), ErrorKind::ArgumentConflict);
+    }
+
+    #[test]
+    fn text_or_file_alone_is_accepted() {
+        assert!(Opts::try_parse_from(["ciphey", "-t", "aGVsbG8="]).is_ok());
+        assert!(Opts::try_parse_from(["ciphey", "-f", "input.txt"]).is_ok());
+    }
+}
```

**File**: `src/cli_pretty_printing/mod.rs` (modified, +34/-10)
```diff
@@ -386,20 +386,11 @@ pub fn program_exiting_successful_decoding(result: DecoderResult) {
     /// If 30% of the characters are invisible characters, then prompt the
     /// user to save the resulting plaintext into a file
     const INVIS_CHARS_DETECTION_PERCENTAGE: f64 = 0.3;
-    let mut invis_chars_found: f64 = 0.0;
-    for char in plaintext[0].chars() {
-        if storage::INVISIBLE_CHARS
-            .iter()
-            .any(|invis_chars| *invis_chars == char)
-        {
-            invis_chars_found += 1.0;
-        }
-    }
 
     // If the percentage of invisible characters in the plaintext exceeds
     // the detection percentage, prompt the user asking if they want to
     // save the plaintext into a file
-    let invis_char_percentage = invis_chars_found / plaintext[0].len() as f64;
+    let invis_char_percentage = invisible_char_ratio(&plaintext[0]);
     if invis_char_percentage > INVIS_CHARS_DETECTION_PERCENTAGE {
         let invis_char_percentage_string = format!("{:2.0}%", invis_char_percentage * 100.0);
         println!(
@@ -438,6 +429,22 @@ pub fn program_exiting_successful_decoding(result: DecoderResult) {
     );
 }
 
+/// Fraction of the characters in `text` that are invisible, between 0.0 and 1.0.
+///
+/// Counts characters rather than bytes: zero-width characters take 3 bytes in UTF-8,
+/// so dividing by the byte length made text that is entirely invisible look 33% invisible.
+fn invisible_char_ratio(text: &str) -> f64 {
+    let total = text.chars().count();
+    if total == 0 {
+        return 0.0;
+    }
+    let invisible = text
+        .chars()
+        .filter(|c| storage::INVISIBLE_CHARS.contains(c))
+        .count();
+    invisible as f64 / total as f64
+}
+
 /// Prints the number of decoding attempts performed.
 ///
 /// # Arguments
@@ -689,3 +696,20 @@ fn test_parse_rgb() {
         assert!(result.is_some());
     }
 }
+
+#[test]
+fn test_invisible_char_ratio_counts_characters_not_bytes() {
+    let zero_width_space = '\u{200B}';
+    // Entirely invisible, but 3 bytes per character
+    let all_invisible = zero_width_space.to_string().repeat(10);
+    assert!((invisible_char_ratio(&all_invisible) - 1.0).abs() < f64::EPSILON);
+
+    // Half invisible. Dividing by bytes gave 25%, below the 30% threshold.
+    let half_invisible: String = "abcde"
+        .chars()
+        .flat_map(|c| [c, zero_width_space])
+        .collect();
+    assert!((invisible_char_ratio(&half_invisible) - 0.5).abs() < f64::EPSILON);
+
+    assert!(invisible_char_ratio("").abs() < f64::EPSILON);
+}
```

**File**: `src/config/mod.rs` (modified, +165/-60)
```diff
@@ -1,11 +1,11 @@
 /// import general checker
 use lemmeknow::Identifier;
 use memmap2::Mmap;
-use once_cell::sync::OnceCell;
+use once_cell::sync::{Lazy, OnceCell};
 use serde::{Deserialize, Serialize};
 use std::collections::{HashMap, HashSet};
 use std::fs::{self, File};
-use std::io::{self, BufRead, BufReader};
+use std::io;
 use std::io::{Read, Write};
 use std::path::Path;
 
@@ -74,15 +74,33 @@ pub struct Config {
 /// Cell for storing global Config
 static CONFIG: OnceCell<Config> = OnceCell::new();
 
+/// Returned by [`get_config`] until [`set_global_config`] is called
+static DEFAULT_CONFIG: Lazy<Config> = Lazy::new(Config::default);
+
 /// To initialize global config with custom values
 pub fn set_global_config(config: Config) {
     CONFIG.set(config).ok(); // ok() used to make compiler happy about using Result
 }
 
 /// Get the global config.
-/// This will return default config if the config wasn't already initialized
+///
+/// Until [`set_global_config`] is called this returns the default config, without
+/// stopping a later [`set_global_config`] call from taking effect:
+/// ```rust
+/// use ciphey::config::{get_config, set_global_config, Config};
+///
+/// assert_eq!(get_config().timeout, 5);
+///
+/// let mut config = Config::default();
+/// config.timeout = 42;
+/// set_global_config(config);
+/// assert_eq!(get_config().timeout, 42);
+/// ```
 pub fn get_config() -> &'static Config {
-    CONFIG.get_or_init(Config::default)
+    // Don't initialise CONFIG here: anything printed before the real config is set
+    // (e.g. a warning while parsing the config file) would otherwise lock in the
+    // defaults and silently discard every CLI option.
+    CONFIG.get().unwrap_or_else(|| &DEFAULT_CONFIG)
 }
 
 /// Creates a default lemmeknow config
@@ -199,10 +217,12 @@ fn read_config_file() -> std::io::Result<String> {
     Ok(contents)
 }
 
-/// Parse a TOML string into a Config struct, handling unknown keys
-fn parse_toml_with_unknown_keys(contents: &str) -> Config {
+/// Parse a TOML string into a Config struct, warning about unknown keys
+///
+/// Returns an error if `contents` isn't valid TOML or a setting has the wrong type.
+fn parse_toml_with_unknown_keys(contents: &str) -> Result<Config, toml::de::Error> {
     // First parse into a generic Value to check for unknown keys
-    let parsed_value: toml::Value = toml::from_str(contents).expect("Could not parse config file");
+    let parsed_value: toml::Value = toml::from_str(contents)?;
 
     // Check for unknown keys at the root level
     if let toml::Value::Table(table) = &parsed_value {
@@ -232,14 +252,17 @@ fn parse_toml_with_unknown_keys(contents: &str) -> Config {
     }
 
     // Parse into Config struct
-    let mut config: Config = toml::from_str(contents).expect("Could not parse config file");
+    let mut config: Config = toml::from_str(contents)?;
     update_identifier_in_config(&mut config);
-    config
+    Ok(config)
 }
 
 /// Loads a wordlist from a file into a HashSet for efficient lookups
 /// Uses memory mapping for large files to improve performance and memory usage
 ///
+/// Lines that aren't valid UTF-8 are skipped: decoded text is always valid UTF-8, so
+/// they could never match. Real wordlists such as rockyou.txt contain some.
+///
 /// # Arguments
 /// * `path` - Path to the wordlist file
 ///
@@ -251,15 +274,14 @@ fn parse_toml_with_unknown_keys(contents: &str) -> Config {
 /// This function will return an error if:
 /// * The file does not exist
 /// * The file cannot be opened due to permissions
-/// * The file cannot be memory-mapped
-/// * The file contains invalid UTF-8 characters
+/// * The file cannot be read or memory-mapped
 ///
 /// # Safety
 /// This implementation uses memory mapping for large files.
 /// `unsafe { Mmap::map(&file) }` is required because the map could become invalid
 /// if the underlying file is modified while the mapping is in use.
 pub fn load_wordlist<P: AsRef<Path>>(path: P) -> io::Result<HashSet<String>> {
-    let file = File::open(path)?;
+    let mut file = File::open(path)?;
     let file_size = file.metadata()?.len();
 
     // For small files (under 10MB), use regular file reading
@@ -269,39 +291,36 @@ pub fn load_wordlist<P: AsRef<Path>>(path: P) -> io::Result<HashSet<String>> {
     // 3. 10MB allows for roughly 1 million words (assuming average word length of 10 chars)
     if file_size < 10_000_000 {
         // 10MB threshold
-        let reader = BufReader::new(file);
-        let mut wordlist = HashSet::new();
-
-        for word in reader.lines().map_while(Result::ok) {
-            let trimmed = word.trim().to_string();
-            if !trimmed.is_empty() {
-                wordlist.insert(trimmed);
-            }
-        }
-
-        Ok(wordlist)
+        let mut contents = Vec::new();
+        file.read_to_end(&mut contents)?;
+        Ok(parse_wordlist(&contents))
     } else {
         // For large files, use memory mapping
-        // First create the me
```

**File**: `src/decoders/a1z26_decoder.rs` (modified, +2/-2)
```diff
@@ -24,7 +24,7 @@ impl Crack for Decoder<A1Z26Decoder> {
     }
 
     /// Decode using the A1Z26 encoding
-    /// It returns an Option<string> if it was successful
+    /// It returns an `Option<String>` if it was successful
     /// Else the Option returns nothing and the error is logged in Trace
     ///
     /// A1Z26 is an encoding that maps each letter to its numeric position in the alphabet. This
@@ -96,7 +96,7 @@ impl Crack for Decoder<A1Z26Decoder> {
 }
 
 /// This function does the actual decoding
-/// It returns an Option<string> if it was successful
+/// It returns an `Option<String>` if it was successful
 /// Else the Option returns nothing and the error is logged in Trace
 fn decode_a1z26(ctext: &str) -> Option<String> {
     let re_has_a_digit = Regex::new(r"[0-9]").expect("Regex should be valid");
```

---

### Incident Patch 15: `42fbebcc` (2026-10-01)
**Commit Message**: fix(cli): enable ANSI colours on Windows and respect NO_COLOR (#918)

* fix(cli): enable ANSI colours on Windows and respect NO_COLOR

All CLI colouring builds strings with termcolor's Buffer::ansi(), which
always emits ANSI escape codes, and nothing ever turned on virtual
terminal processing for the Windows console. Consoles without VT
processing (cmd.exe, PowerShell outside Windows Terminal) print the codes
literally, e.g. "←[0m←[1m←[38;2;255;255;255mEnhanced detection enabled.←[0m".
NO_COLOR was ignored as well.

- Route all colouring (cli_pretty_printing and the first-run wizard)
  through a shared colorize() helper gated by color_enabled().
- color_enabled() is decided once: colour is off if NO_COLOR is set to a
  non-empty value (no-color.org), otherwise on Windows it enables VT
  processing on stdout/stderr via winapi-util and falls back to plain
  text if a console refuses (pre-Windows 10). Non-console streams and
  other platforms are unchanged.
- winapi-util is a Windows-only dependency and was already in Cargo.lock
  via termcolor, so no new crates are pulled in.
- Fix two typos codespell flags in the touched files.

Tests: unit tests for colorize() with and without colo

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -623,6 +623,7 @@ dependencies = [
  "toml 1.1.6+spec-1.1.0",
  "urlencoding",
  "uuid",
+ "winapi-util",
  "z85",
 ]
 
```

**File**: `Cargo.toml` (modified, +4/-0)
```diff
@@ -65,6 +65,10 @@ z85 = "3.0.7"
 brainfuck-exe = { version = "0.2.4", default-features = false }
 dashmap = "6.2.1"
 
+# Used to turn on ANSI colour support in the Windows console
+[target.'cfg(windows)'.dependencies]
+winapi-util = "0.1.9"
+
 # Dev dependencies
 [dev-dependencies]
 cargo-nextest = "0.9.117"
```

**File**: `src/cli/first_run.rs` (modified, +7/-16)
```diff
@@ -4,13 +4,14 @@
 //! and user preferences. It provides functionality for creating and managing color schemes,
 //! handling user input, and converting between different color formats.
 
+use crate::cli_pretty_printing::{color_enabled, colorize};
 use gibberish_or_not::download_model_with_progress_bar;
 use rpassword;
 use std::collections::HashMap;
 use std::fmt::Display;
 use std::io::{self, Write};
 use std::path::Path;
-use termcolor::{Buffer, Color, ColorSpec, WriteColor};
+use termcolor::{Color, ColorSpec};
 
 /// Represents a color scheme with RGB values for different message types and roles.
 /// Each color is stored as a comma-separated RGB string in the format "r,g,b"
@@ -110,17 +111,12 @@ fn print_rgb(text: &str, rgb: &str) -> String {
 /// * `color` - The color to apply
 ///
 /// # Returns
-/// * `String` - The text with ANSI color codes applied
+/// * `String` - The text with ANSI color codes applied, or the plain text if colours are disabled
 fn apply_color(text: &str, color: Color) -> String {
-    let mut buffer = Buffer::ansi();
     let mut color_spec = ColorSpec::new();
     color_spec.set_fg(Some(color));
 
-    buffer.set_color(&color_spec).unwrap_or(());
-    write!(&mut buffer, "{}", text).unwrap_or(());
-    buffer.reset().unwrap_or(());
-
-    String::from_utf8_lossy(buffer.as_slice()).to_string()
+    colorize(text, &color_spec, color_enabled())
 }
 
 /// Helper function to apply RGB color to text using termcolor.
@@ -132,17 +128,12 @@ fn apply_color(text: &str, color: Color) -> String {
 /// * `b` - Blue value (0-255)
 ///
 /// # Returns
-/// * `String` - The text with ANSI color codes applied
+/// * `String` - The text with ANSI color codes applied, or the plain text if colours are disabled
 fn apply_color_with_rgb(text: &str, r: u8, g: u8, b: u8) -> String {
-    let mut buffer = Buffer::ansi();
     let mut color_spec = ColorSpec::new();
     color_spec.set_fg(Some(Color::Rgb(r, g, b)));
 
-    buffer.set_color(&color_spec).unwrap_or(());
-    write!(&mut buffer, "{}", text).unwrap_or(());
-    buffer.reset().unwrap_or(());
-
-    String::from_utf8_lossy(buffer.as_slice()).to_string()
+    colorize(text, &color_spec, color_enabled())
 }
 
 /// Returns the Capptucin color scheme with warm, muted colors.
@@ -326,7 +317,7 @@ pub fn run_first_time_setup() -> HashMap<String, String> {
     println!("\n{}", print_question("What sounds better to you?"));
     println!(
         "\n{}",
-        print_statement("1. ciphey will ask you everytime it detects plaintext if it is plaintext.\n2. ciphey stores all possible plaintext in a list, and at the end of the program presents it to you.")
+        print_statement("1. ciphey will ask you every time it detects plaintext if it is plaintext.\n2. ciphey stores all possible plaintext in a list, and at the end of the program presents it to you.")
     );
     let wait_athena_choice = get_user_input_range("Enter your choice", 1, 2);
 
```

**File**: `src/cli_pretty_printing/mod.rs` (modified, +91/-4)
```diff
@@ -15,6 +15,12 @@
 //! - Question: Interactive prompts and user queries
 //! - Statement: Standard output and neutral messages
 //!
+//! # Colour Support
+//! Colours are written as ANSI escape codes. On Windows, ANSI support is turned on
+//! for the console before the first colour is used. If the console can't handle
+//! ANSI codes, or the `NO_COLOR` environment variable is set (<https://no-color.org/>),
+//! text is printed without colour.
+//!
 //! # Usage
 //! ```rust
 //! use ciphey::cli_pretty_printing::{success, warning};
@@ -32,8 +38,10 @@ use crate::storage;
 use crate::storage::wait_athena_storage::PlaintextResult;
 use crate::DecoderResult;
 use std::env;
+use std::ffi::OsStr;
 use std::fs::write;
 use std::io::Write;
+use std::sync::OnceLock;
 use termcolor::{Buffer, Color, ColorSpec, WriteColor};
 use text_io::read;
 
@@ -160,20 +168,99 @@ fn color_string(text: &str, role: &str) -> String {
 /// * `b` - Blue value (0-255)
 ///
 /// # Returns
-/// * `String` - The text with ANSI color codes applied
+/// * `String` - The text with ANSI color codes applied, or the plain text if colours are disabled
 fn apply_color_with_rgb(text: &str, r: u8, g: u8, b: u8) -> String {
-    let mut buffer = Buffer::ansi();
     let mut color_spec = ColorSpec::new();
     color_spec.set_fg(Some(Color::Rgb(r, g, b)));
     color_spec.set_bold(true);
 
-    buffer.set_color(&color_spec).unwrap_or(());
+    colorize(text, &color_spec, color_enabled())
+}
+
+/// Applies a termcolor colour spec to text, producing ANSI escape codes.
+///
+/// # Arguments
+/// * `text` - The text to be colored
+/// * `color_spec` - The colour and style to apply
+/// * `use_color` - Whether to add ANSI codes at all, normally the result of [`color_enabled`]
+///
+/// # Returns
+/// * `String` - The text wrapped in ANSI color codes, or the unchanged text if `use_color` is false
+pub(crate) fn colorize(text: &str, color_spec: &ColorSpec, use_color: bool) -> String {
+    if !use_color {
+        return text.to_string();
+    }
+
+    let mut buffer = Buffer::ansi();
+    buffer.set_color(color_spec).unwrap_or(());
     write!(&mut buffer, "{}", text).unwrap_or(());
     buffer.reset().unwrap_or(());
 
     String::from_utf8_lossy(buffer.as_slice()).to_string()
 }
 
+/// Returns whether CLI output should be coloured with ANSI escape codes.
+///
+/// This is decided once, the first time any text is coloured. Colours are off if the
+/// user set `NO_COLOR` or the terminal can't display ANSI codes (see [`enable_ansi_support`]).
+/// Without this check, consoles that don't understand ANSI print the codes literally,
+/// e.g. `←[0m←[1m←[38;2;255;255;255mEnhanced detection enabled.←[0m`.
+pub(crate) fn color_enabled() -> bool {
+    /// Cached result so the console is only configured once
+    static COLOR_ENABLED: OnceLock<bool> = OnceLock::new();
+    *COLOR_ENABLED.get_or_init(|| {
+        // Check NO_COLOR first so we don't touch the console when colours aren't wanted
+        !no_color_requested(env::var_os("NO_COLOR").as_deref()) && enable_ansi_support()
+    })
+}
+
+/// Checks the value of the `NO_COLOR` environment variable.
+///
+/// Following <https://no-color.org/>, colour is disabled when the variable is
+/// present and not empty, whatever its value.
+///
+/// # Arguments
+/// * `no_color` - The value of `NO_COLOR`, or None if it isn't set
+///
+/// # Returns
+/// * `bool` - true if the user asked for output without colour
+fn no_color_requested(no_color: Option<&OsStr>) -> bool {
+    no_color.is_some_and(|value| !value.is_empty())
+}
+
+/// Turns on ANSI escape code support in the Windows console.
+///
+/// The Windows console (cmd.exe, or PowerShell outside Windows Terminal) only
+/// interprets ANSI codes once virtual terminal processing is enabled for it.
+/// This enables it on stdout and stderr when they're attached to a console.
+/// Streams that aren't consoles (pipes, files, or terminals like mintty that
+/// handle ANSI codes themselves) are left alone.
+///
+/// # Returns
+/// * `bool` - false if a console doesn't support ANSI codes (Windows versions
+///   before Windows 10), in which case output should not be coloured
+#[cfg(windows)]
+fn enable_ansi_support() -> bool {
+    use winapi_util::console::Console;
+
+    [Console::stdout(), Console::stderr()]
+        .into_iter()
+        .all(|console| match console {
+            Ok(mut console) => console.set_virtual_terminal_processing(true).is_ok(),
+            // Not a console, so whatever is reading the output handles the codes
+            Err(_) => true,
+        })
+}
+
+/// Terminals on platforms other than Windows understand ANSI escape codes.
+///
+/// # Returns
+/// * `bool` - Always true
+#[cfg(not(windows))]
+fn enable_ansi_support() -> bool {
+    true
+}
+
 /// Colors text based on its role, defaulting to statement color if no role is specified.
 ///
 /// # Arguments
@@ -581,7 +668,7 @@ pub fn display_top_results(results: &[PlaintextResult]) {
           
```

**File**: `src/cli_pretty_printing/tests.rs` (modified, +40/-0)
```diff
@@ -1,4 +1,44 @@
+use super::{colorize, no_color_requested};
 use crate::storage::INVISIBLE_CHARS;
+use std::ffi::OsStr;
+use termcolor::{Color, ColorSpec};
+
+/// The colour spec `statement()` uses with the default colour scheme
+fn bold_white() -> ColorSpec {
+    let mut color_spec = ColorSpec::new();
+    color_spec
+        .set_fg(Some(Color::Rgb(255, 255, 255)))
+        .set_bold(true);
+    color_spec
+}
+
+/// Regression test for https://github.com/bee-san/Ciphey/issues/903
+/// When colours are disabled (a console that can't display ANSI codes, or NO_COLOR is set)
+/// the text must be returned as-is, otherwise the console prints the raw escape codes.
+#[test]
+fn test_colorize_without_color_returns_plain_text() {
+    let text = "Enhanced detection enabled.";
+    assert_eq!(colorize(text, &bold_white(), false), text);
+}
+
+/// Terminals that support colour keep getting the same ANSI escape codes as before
+#[test]
+fn test_colorize_with_color_adds_ansi_codes() {
+    assert_eq!(
+        colorize("Enhanced detection enabled.", &bold_white(), true),
+        "\x1b[0m\x1b[1m\x1b[38;2;255;255;255mEnhanced detection enabled.\x1b[0m"
+    );
+}
+
+/// NO_COLOR disables colour when it is set to any non-empty value (https://no-color.org/)
+#[test]
+fn test_no_color_requested() {
+    assert!(!no_color_requested(None));
+    assert!(!no_color_requested(Some(OsStr::new(""))));
+    assert!(no_color_requested(Some(OsStr::new("1"))));
+    assert!(no_color_requested(Some(OsStr::new("0"))));
+    assert!(no_color_requested(Some(OsStr::new("false"))));
+}
 
 /// Test that checks if the invisible character detection works correctly
 #[test]
```

**File**: `tests/cli_color_test.rs` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+//! End-to-end tests for coloured CLI output.
+//! Regression tests for https://github.com/bee-san/Ciphey/issues/903
+//!
+//! On Windows `dirs::home_dir()` ignores `HOME`, so these tests can't point ciphey
+//! at a temporary config directory and would start the interactive first-run setup.
+#![cfg(unix)]
+
+use std::fs;
+use std::path::PathBuf;
+use std::process::{Command, Stdio};
+
+/// A temporary home directory with a ciphey config file, removed when dropped.
+/// Having a config file means ciphey skips the interactive first-run setup.
+struct TempHome {
+    /// Path to the temporary home directory
+    path: PathBuf,
+}
+
+impl TempHome {
+    /// Creates a new temporary home directory inside Cargo's scratch directory for
+    /// integration tests (`target/tmp`). The path is fixed at compile time rather
+    /// than read from the environment at runtime.
+    fn new(name: &str) -> Self {
+        let dir_name = format!("ciphey-{}-{}", name, std::process::id());
+        let path = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join(dir_name);
+        let _ = fs::remove_dir_all(&path);
+        fs::create_dir_all(path.join(".ciphey")).expect("Could not create temporary home");
+        fs::write(path.join(".ciphey").join("config.toml"), "")
+            .expect("Could not create config file");
+        TempHome { path }
+    }
+}
+
+impl Drop for TempHome {
+    fn drop(&mut self) {
+        let _ = fs::remove_dir_all(&self.path);
+    }
+}
+
+/// Runs ciphey on plaintext input and returns everything it printed to stdout and stderr.
+/// `--enable-enhanced-detection` prints the message from the bug report to stderr.
+fn run_ciphey(no_color: Option<&str>) -> String {
+    let home = TempHome::new(&format!("color-test-{}", no_color.unwrap_or("unset")));
+    let mut command = Command::new(env!("CARGO_BIN_EXE_ciphey"));
+    command
+        .args([
+            "-t",
+            "Hello, World!",
+            "--disable-human-checker",
+            "--enable-enhanced-detection",
+        ])
+        .env("HOME", &home.path)
+        .env_remove("NO_COLOR")
+        .stdin(Stdio::null());
+    if let Some(value) = no_color {
+        command.env("NO_COLOR", value);
+    }
+
+    let output = command.output().expect("Could not run ciphey");
+    let printed = format!(
+        "{}{}",
+        String::from_utf8_lossy(&output.stdout),
+        String::from_utf8_lossy(&output.stderr)
+    );
+    assert!(output.status.success(), "ciphey failed:\n{printed}");
+    printed
+}
+
+#[test]
+fn test_no_color_disables_ansi_escape_codes() {
+    let printed = run_ciphey(Some("1"));
+    assert!(printed.contains("Enhanced detection enabled."));
+    assert!(printed.contains("Hello, World!"));
+    assert!(
+        !printed.contains('\x1b'),
+        "Found ANSI escape codes with NO_COLOR set:\n{printed:?}"
+    );
+}
+
+#[test]
+fn test_colors_are_used_by_default() {
+    let printed = run_ciphey(None);
+    assert!(printed.contains("Hello, World!"));
+    assert!(
+        printed.contains("\x1b[38;2;"),
+        "Expected coloured output:\n{printed:?}"
+    );
+}
```

#### Recent Merged Pull Requests:
- **PR #1114** (2026-10-05): build(deps): bump xxhash-rust from 0.8.15 to 0.8.19 in the cargo group across 1 directory (@dependabot[bot])
- **PR #1113** (2026-10-05): build(deps): bump tokio from 1.48.0 to 1.50.0 (@dependabot[bot])
- **PR #1112** (2026-10-05): build(deps): bump encoding_rs from 0.8.35 to 0.8.42 (@dependabot[bot])
- **PR #1111** (2026-10-05): build(deps): bump idna from 1.0.3 to 1.1.0 (@dependabot[bot])
- **PR #1110** (2026-10-03): feat(decoders): add ROT5 / ROT18 decoder (@bee-san)
- **PR #1109** (2026-10-03): feat(decoders): add Hill cipher cracker (@bee-san)
- **PR #1108** (2026-10-03): feat(decoders): add Bzip2 decoder (@bee-san)
- **PR #1107** (2026-10-03): feat(decoders): add Beaufort cracker (@bee-san)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
