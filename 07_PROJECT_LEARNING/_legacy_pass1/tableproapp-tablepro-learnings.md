# Forensic Learning Record (Deep Inspection): TableProApp/TablePro

> **Canonical Artifact**: `07_PROJECT_LEARNING/tableproapp-tablepro-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TableProApp/TablePro](https://github.com/TableProApp/TablePro))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:30:48.708Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TableProApp/TablePro`
- **Description**: Free and open source database client built natively for developers
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6173 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/release/scripts/lint-draft.py`
```
#!/usr/bin/env python3
"""Mechanical checks for a TablePro newsletter or X-post draft.

Catches the things that are decidable by looking at the text: house-style violations, sentence
length, subject and preview budgets, and links or images that cannot be resolved. It cannot
tell you whether a sentence is true; that pass is references/fact-checks.md.

Usage:
    python3 lint-draft.py <draft.md> [--repo <path-to-TablePro>]

Exits 1 when a hard rule is broken, 0 otherwise. Advisories never fail the run.
"""

import argparse
import os
import re
import sys

HARD = "hard"
SOFT = "soft"

BANNED = [
    "seamless", "robust", "comprehensive", "intuitive", "effortless", "streamlined",
    "leverage", "elevate", "unlock", "unleash", "supercharge", "delve", "utilize",
    "facilitate", "game-changer", "dive into", "empower", "harness",
    "you asked, we listened", "and much more", "worth your time", "you will notice",
    "excited", "thrilled", "introducing the",
]

VAGUE = [
    "many", "several", "a lot of", "significantly", "much faster", "greatly",
    "various", "numerous", "a number of",
]

FIRST_PERSON = re.compile(r"(?<![\w'])(we|our|ours|us|we're|we've|i'm|i've)(?![\w'])", re.I)
EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF⬀-⯿]"
)

SUBJECT_COMFORTABLE = 48
SUBJECT_FIRST_ITEM = 41
PREVIEW_MIN, PREVIEW_MAX = 40, 95
MAX_SENTENCE_WORDS = 35


def strip_code(text):
    """Blank out fenced blocks and inline code so their contents do not trip the word rules."""
    text = re.sub(r"```.*?```", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    return re.sub(r"`[^`\n]*`", "``", text)


def lines_of(text):
    return text.split("\n")


def find_all(text, needle):
    """Line numbers where needle appears, case-insensitively, on a word boundary."""
    pattern = re.compile(r"(?<!\w)" + re.escape(needle) + r"(?!\w)", re.I)
    return [i for i, line in enumerate(lines_of(text), 1) if pattern.search(line)]


def sentences(text):
    """Prose sentences with their line numbers, links collapsed and headings dropped."""
    out = []
    for i, line in enumerate(lines_of(text), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith(("#", ">", "|", "---", "**Subject:", "**Preview")):
            continue
        collapsed = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", stripped)
        collapsed = re.sub(r"^[-*]\s+", "", collapsed)
        for sentence in re.split(r"(?<=[.!?])\s+", collapsed):
            if sentence.strip():
                out.append((i, sentence.strip()))
    return out


def check(text, repo):
    findings = []

    def add(level, rule, detail, line=None):
        findings.append((level, rule, detail, line))

    clean = strip_code(text)

    for line in find_all(clean, "—") or [i for i, l in enumerate(lines_of(clean), 1) if "—" in l]:
        add(HARD, "em dash", "use a comma, a period, a colon, or rewrite", line)

    for i, line in enumerate(lines_of(clean), 1):
        for match in FIRST_PERSON.finditer(line):
            add(HARD, "first person", f'"{match.group(0)}", the subject is the product or "you"', i)
        if ";" in line and "&#" not in line:
            add(HARD, "semicolon", "neither shipped newsletter uses one", i)
        if "!" in line and not line.lstrip().startswith("!["):
            add(SOFT, "exclamation mark", "check this is not enthusiasm", i)
        for match in EMOJI.finditer(line):
            add(HARD, "emoji", f"{match.group(0)!r}", i)

    for word in BANNED:
        for line in find_all(clean, word):
            add(HARD, "banned filler", f'"{word}"', line)

    for word in VAGUE:
        for line in find_all(clean, word):
            add(SOFT, "vague quantifier", f'"{word}", the house writes a figure', line)

    for i, sentence in sentences(clean):
        count = len(sentence.split())
        if count > MAX_SENTENCE_WORDS and ":" not in sentence:
            add(SOFT, "long sentence", f"{count} words, split it", i)

    for i, line in enumerate(lines_of(clean), 1):
        if re.match(r"^It also\b", line.strip()):
            add(SOFT, "\"It also\" opener", "open with the real subject", i)
        if re.match(r"^\*\*[^*]{1,40}\.\*\*\s+\S", line.strip()):
            add(SOFT, "bold run-in headline", "bold is for menu paths and new proper nouns", i)

    subject = re.search(r"^\*\*Subject:\*\*\s*(.+)$", text, re.M)
    if subject:
        value = subject.group(1).strip()
        head = value.split(",")[0]
        if len(value) > SUBJECT_COMFORTABLE:
            add(SOFT, "subject length", f"{len(value)} chars, Apple Mail iPhone shows about 48")
        if len(head) > SUBJECT_FIRST_ITEM:
            add(HARD, "subject first item", f"{len(head)} chars, Gmail iOS cuts near 40")
        items = [p for p in value.split(":", 1)[-1].split(",") if p.strip()]
        if len(items) > 3:
            add(SOFT, "subject items", f"{len(items)} items, the house uses two or three")
    else:
        add(SOFT, "subject", "no **Subject:** line found")

    preview = re.search(r"^\*\*Preview text:\*\*\s*(.+)$", text, re.M)
    if preview:
        length = len(preview.group(1).strip())
        if not PREVIEW_MIN <= length <= PREVIEW_MAX:
            add(SOFT, "preview length", f"{length} chars, aim for {PREVIEW_MIN} to {PREVIEW_MAX}")
    elif subject:
        add(SOFT, "preview text", "no **Preview text:** line found")

    check_assets(text, repo, add)
    return findings


def check_assets(text, repo, add):
    if not repo:
        return

    for i, line in enumerate(lines_of(text), 1):
        for path in re.findall(r"https://docs\.tablepro\.app/images/([\w.-]+)", line):
            local = os.path.join(repo, "docs", "images", path)
            if not os.path.exists(local):
                add(HARD, "missing image", path, i)
                continue
            size = png_size(local)
            if size == (1560, 960):
                add(HARD, "placeholder image", f"{path} is a 1560x960 placeholder card", i)

        for page in re.findall(r"https://docs\.tablepro\.app/(features|databases)/([\w-]+)", line):
            local = os.path.join(repo, "docs", page[0], page[1] + ".mdx")
            if not os.path.exists(local):
                add(HARD, "missing docs page", "/".join(page), i)


def png_size(path):
    """Width and height from the PNG IHDR, so this needs no image library."""
    try:
        with open(path, "rb") as handle:
            header = handle.read(24)
        if header[:8] != b"\x89PNG\r\n\x1a\n":
            return None
        return (
            int.from_bytes(header[16:20], "big"),
            int.from_bytes(header[20:24], "big"),
        )
    except OSError:
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("draft")
    parser.add_argument("--repo", default=find_repo())
    args = parser.parse_args()

    with open(args.draft, encoding="utf-8") as handle:
        text = handle.read()

    findings = check(text, args.repo)
    hard = [f for f in findings if f[0] == HARD]
    soft = [f for f in findings if f[0] == SOFT]

    words = len(strip_code(text).split())
    print(f"{args.draft}: {words} words, {len(hard)} to fix, {len(soft)} to look at\n")

    for level, label in ((HARD, "Fix"), (SOFT, "Look at")):
        group = hard if level == HARD else soft
        if not group:
            continue
        print(f"{label}:")
        for _, rule, detail, line in sorted(group, key=lambda f: (f[1], f[3] or 0)):
            where = f"line {line}" if line else "header"
            print(f"  {where:>10}  {rule}: {detail}")
        print()

    if not findings:
        print("Nothing mechanical to report. The factual pass is references/fact-checks.md.")

    return 1 if hard else 0


def find_repo():
    path = os.getcwd()
    while path != "/":
        if os.path.exists(os.path.join(path, "CHANGELOG.md")) and \
           os.path.isdir(os.path.join(path, "docs")):
            return path

```

### Core Architecture Module: `Native/DamengBridge/src/lib.rs`
```
// Safety contracts for the exported C ABI are documented in CDameng.h, next to
// the declarations consumed by Swift.
#![allow(clippy::missing_safety_doc)]

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::ptr;
use std::slice;
use std::str;
use std::sync::Arc;
use std::time::Instant;

use dameng::{Client, Interrupt};
use dameng_types::encoding::ServerEncoding;
use dameng_types::{DmValue, DmValueType};

const MAX_HOST_BYTES: usize = 1_024;
const MAX_CREDENTIAL_BYTES: usize = 4_096;
const MAX_SQL_BYTES: usize = 16 * 1_024 * 1_024;

pub struct TpDmConnection {
    client: Option<Client>,
    /// Kept beside the client rather than inside it: an in-flight statement moves the
    /// client out of this handle, and `tp_dm_cancel` still has to reach the read loop.
    interrupt: Arc<Interrupt>,
}

pub struct TpDmError {
    message: Vec<u8>,
    cancelled: bool,
    /// The failure left the connection closed rather than merely rejecting the statement.
    /// Swift needs this to tell "the server refused this SQL" from "reconnect before the
    /// next one", which the message text cannot express.
    connection_lost: bool,
}

pub struct TpDmResult {
    columns: Vec<TpDmColumn>,
    rows: Vec<Vec<TpDmCell>>,
    rows_affected: u64,
    execution_time_seconds: f64,
    is_truncated: bool,
}

struct TpDmColumn {
    name: Vec<u8>,
    type_name: Vec<u8>,
}

#[cfg_attr(test, derive(Debug, PartialEq))]
enum TpDmCell {
    Null,
    Text(Vec<u8>),
    Bytes(Vec<u8>),
}

fn set_error(error_out: *mut *mut TpDmError, message: impl Into<String>) {
    store_error(error_out, message.into(), false, false);
}

/// The handle outlived its client, which an earlier failure disposed. Reported as lost so
/// the caller reconnects instead of retrying against a handle that can never serve again.
fn set_closed_error(error_out: *mut *mut TpDmError, message: impl Into<String>) {
    store_error(error_out, message.into(), false, true);
}

/// Preserves whether the failure was a caller-requested stop, which Swift reports as a
/// cancellation rather than as a query error, and whether it closed the connection, which
/// is the same classification `dispose` acts on.
fn set_driver_error(error_out: *mut *mut TpDmError, error: &dameng::Error) {
    store_error(
        error_out,
        error.to_string(),
        is_cancellation(error),
        !is_recoverable(error),
    );
}

fn store_error(
    error_out: *mut *mut TpDmError,
    message: String,
    cancelled: bool,
    connection_lost: bool,
) {
    if error_out.is_null() {
        return;
    }
    let error = Box::new(TpDmError {
        message: message.into_bytes(),
        cancelled,
        connection_lost,
    });
    unsafe {
        *error_out = Box::into_raw(error);
    }
}

fn clear_error(error_out: *mut *mut TpDmError) {
    if error_out.is_null() {
        return;
    }
    unsafe {
        *error_out = ptr::null_mut();
    }
}

fn panic_message(payload: Box<dyn std::any::Any + Send>) -> String {
    if let Some(message) = payload.downcast_ref::<String>() {
        return message.clone();
    }
    if let Some(message) = payload.downcast_ref::<&str>() {
        return (*message).to_string();
    }
    "Dameng transport panicked".to_string()
}

unsafe fn required_string(
    bytes: *const u8,
    length: usize,
    maximum: usize,
    field: &str,
) -> Result<String, String> {
    if bytes.is_null() {
        return Err(format!("{field} is missing"));
    }
    if length == 0 || length > maximum {
        return Err(format!("{field} length is invalid"));
    }
    let value = slice::from_raw_parts(bytes, length);
    str::from_utf8(value)
        .map(str::to_owned)
        .map_err(|_| format!("{field} is not valid UTF-8"))
}

unsafe fn password_string(bytes: *const u8, length: usize) -> Result<String, String> {
    if length > MAX_CREDENTIAL_BYTES {
        return Err("password length is invalid".to_string());
    }
    if length == 0 {
        return Ok(String::new());
    }
    if bytes.is_null() {
        return Err("password is missing".to_string());
    }
    let value = slice::from_raw_parts(bytes, length);
    str::from_utf8(value)
        .map(str::to_owned)
        .map_err(|_| "password is not valid UTF-8".to_string())
}

unsafe fn optional_sql(bytes: *const u8, length: usize) -> Result<String, String> {
    if bytes.is_null() || length == 0 || length > MAX_SQL_BYTES {
        return Err("query length is invalid".to_string());
    }
    let value = slice::from_raw_parts(bytes, length);
    str::from_utf8(value)
        .map(str::to_owned)
        .map_err(|_| "query is not valid UTF-8".to_string())
}

fn detect_server_encoding(client: &mut Client) -> Result<(), String> {
    let result = client
        .query("SELECT UNICODE()")
        .map_err(|error| error.to_string())?;
    let row = result
        .rows
        .first()
        .ok_or_else(|| "DM8 did not return its Unicode mode".to_string())?;
    let flag = row.get_i32(0).map_err(|error| error.to_string())?;
    client.server_encoding = if flag == 1 {
        ServerEncoding::Utf8
    } else {
        ServerEncoding::Gb18030
    };
    Ok(())
}

fn text_cell(value: impl ToString) -> TpDmCell {
    TpDmCell::Text(value.to_string().into_bytes())
}

fn is_lob_column(column: &dameng::row::Column) -> bool {
    matches!(
        DmValueType::from_type_code(column.type_code),
        Some(DmValueType::BLOB) | Some(DmValueType::CLOB)
    )
}

fn undecoded_cell(row: &dameng::Row, index: usize) -> TpDmCell {
    match row.values.get(index).and_then(Option::as_ref) {
        Some(raw) if !raw.is_empty() => TpDmCell::Bytes(raw.clone()),
        _ => TpDmCell::Null,
    }
}

/// A value DM8 stored away from the row arrives as a locator, a pointer the client is meant to
/// dereference with LOB_GETLEN and LOB_READ. That exchange is not implemented correctly here:
/// measured against DM8 8.1, reading a 1000 character CLOB makes the server close the
/// connection. Reporting the cell empty keeps the rest of the row, and the connection, intact.
/// A small value DM8 sends inline is not a locator and still reads normally.
fn convert_cell(
    row: &dameng::Row,
    columns: &[dameng::row::Column],
    index: usize,
) -> Result<TpDmCell, dameng::Error> {
    let is_lob = columns.get(index).is_some_and(is_lob_column);
    let Some(value) = row.get(index, columns) else {
        // The raw bytes of a large-object cell are its locator, so handing them over would
        // render a pointer as though it were the stored text.
        return Ok(if is_lob {
            TpDmCell::Null
        } else {
            undecoded_cell(row, index)
        });
    };
    match value {
        DmValue::Null => Ok(TpDmCell::Null),
        DmValue::Boolean(value) => Ok(text_cell(if value { "1" } else { "0" })),
        DmValue::TinyInt(value) => Ok(text_cell(value)),
        DmValue::SmallInt(value) => Ok(text_cell(value)),
        DmValue::Int(value) => Ok(text_cell(value)),
        DmValue::BigInt(value) => Ok(text_cell(value)),
        DmValue::Float(value) => Ok(text_cell(value)),
        DmValue::Double(value) => Ok(text_cell(value)),
        DmValue::Text(value) => Ok(TpDmCell::Text(value.into_bytes())),
        DmValue::Bytea(value) => Ok(TpDmCell::Bytes(value)),
        DmValue::Decimal(value) => Ok(text_cell(value)),
        DmValue::Date(value) => Ok(text_cell(value)),
        DmValue::Time(value) => Ok(text_cell(value)),
        DmValue::Timestamp(value) => Ok(text_cell(value)),
        DmValue::LobLocator(_) => Ok(TpDmCell::Null),
    }
}

/// Reads the rest of a result set off the cursor.
///
/// DM8 answers a query with one inline batch, around 32KB of it, and holds the rest until the
/// client asks. Stopping at the first batch silently returned 662 rows of a 20000 row table
/// while reporting the result complete. `row_cap` fetches one row past the cap so the caller
/// can tell "exactly this many rows" from "more than the caller asked for".
fn drain_cursor(

```

### Core Architecture Module: `Native/HanaBridge/internal/frame/frame.go`
```
package frame

import (
	"encoding/binary"
	"errors"
	"io"
	"math"
)

const (
	HeaderSize    = 13
	MaxBodyLength = math.MaxInt32
)

var (
	ErrShortHeader  = errors.New("the stream ended inside a frame header")
	ErrShortBody    = errors.New("the stream ended inside a frame body")
	ErrBodyTooLarge = errors.New("the frame body is larger than allowed")
)

type Frame struct {
	ID   uint64
	Code byte
	Body []byte
}

type header struct {
	length uint32
	id     uint64
	code   byte
}

func encodeHeader(id uint64, code byte, bodyLength int) ([HeaderSize]byte, error) {
	var encoded [HeaderSize]byte
	if bodyLength < 0 || uint64(bodyLength) > MaxBodyLength {
		return encoded, ErrBodyTooLarge
	}
	binary.BigEndian.PutUint32(encoded[0:4], uint32(bodyLength))
	binary.BigEndian.PutUint64(encoded[4:12], id)
	encoded[12] = code
	return encoded, nil
}

func decodeHeader(encoded [HeaderSize]byte) header {
	return header{
		length: binary.BigEndian.Uint32(encoded[0:4]),
		id:     binary.BigEndian.Uint64(encoded[4:12]),
		code:   encoded[12],
	}
}

func Read(input io.Reader, maxBodyLength uint32) (Frame, error) {
	var encoded [HeaderSize]byte
	if _, err := io.ReadFull(input, encoded[:]); err != nil {
		if errors.Is(err, io.ErrUnexpectedEOF) {
			return Frame{}, ErrShortHeader
		}
		return Frame{}, err
	}
	decoded := decodeHeader(encoded)
	if decoded.length > maxBodyLength {
		return Frame{}, ErrBodyTooLarge
	}
	body := make([]byte, decoded.length)
	if _, err := io.ReadFull(input, body); err != nil {
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			return Frame{}, ErrShortBody
		}
		return Frame{}, err
	}
	return Frame{ID: decoded.id, Code: decoded.code, Body: body}, nil
}

func Write(output io.Writer, outgoing Frame) error {
	encoded, err := encodeHeader(outgoing.ID, outgoing.Code, len(outgoing.Body))
	if err != nil {
		return err
	}
	if _, err := output.Write(encoded[:]); err != nil {
		return err
	}
	if len(outgoing.Body) == 0 {
		return nil
	}
	_, err = output.Write(outgoing.Body)
	return err
}

```

### Core Architecture Module: `Native/HanaBridge/internal/hana/bridge.go`
```
package hana

type Bridge struct {
	sessions *sessionRegistry
}

func NewBridge() *Bridge {
	return &Bridge{sessions: newSessionRegistry()}
}

func (b *Bridge) Open(configJSON []byte) (sessionID uint64, failure []byte) {
	id, bridgeFailure := b.openSession(configJSON)
	return id, encodedFailure(bridgeFailure)
}

func (b *Bridge) Connect(sessionID uint64, operationID uint64) (result []byte, failure []byte) {
	encoded, bridgeFailure := b.connectSession(sessionID, operationID)
	return encoded, encodedFailure(bridgeFailure)
}

func (b *Bridge) Execute(sessionID uint64, operationID uint64, requestJSON []byte) (result []byte, failure []byte) {
	encoded, bridgeFailure := b.executeOnSession(sessionID, operationID, requestJSON)
	return encoded, encodedFailure(bridgeFailure)
}

func (b *Bridge) Explain(sessionID uint64, operationID uint64, requestJSON []byte) (result []byte, failure []byte) {
	encoded, bridgeFailure := b.explainOnSession(sessionID, operationID, requestJSON)
	return encoded, encodedFailure(bridgeFailure)
}

func (b *Bridge) Ping(sessionID uint64, operationID uint64) (failure []byte) {
	return encodedFailure(b.pingSession(sessionID, operationID))
}

func (b *Bridge) Cancel(sessionID uint64, operationID uint64) {
	b.cancelOnSession(sessionID, operationID)
}

func (b *Bridge) Close(sessionID uint64) {
	b.closeSession(sessionID)
}

func (b *Bridge) CloseAll() {
	for _, entry := range b.sessions.removeAll() {
		entry.close()
	}
}

func InternalFailure(message string) []byte {
	return internalError(message).encoded()
}

func encodedFailure(failure *bridgeError) []byte {
	if failure == nil {
		return nil
	}
	return failure.encoded()
}

func (b *Bridge) openSession(configJSON []byte) (uint64, *bridgeError) {
	config, failure := parseConnectionConfig(configJSON)
	if failure != nil {
		return 0, failure
	}
	entry, failure := newSession(config)
	if failure != nil {
		return 0, failure
	}
	return b.sessions.register(entry), nil
}

func (b *Bridge) connectSession(sessionID uint64, operationID uint64) ([]byte, *bridgeError) {
	entry, failure := b.sessions.lookup(sessionID)
	if failure != nil {
		return nil, failure
	}
	return entry.connect(operationID)
}

func (b *Bridge) executeOnSession(sessionID uint64, operationID uint64, requestJSON []byte) ([]byte, *bridgeError) {
	entry, failure := b.sessions.lookup(sessionID)
	if failure != nil {
		return nil, failure
	}
	request, failure := decodeRequest[executeRequest](requestJSON)
	if failure != nil {
		return nil, failure
	}
	return entry.execute(operationID, request)
}

func (b *Bridge) explainOnSession(sessionID uint64, operationID uint64, requestJSON []byte) ([]byte, *bridgeError) {
	entry, failure := b.sessions.lookup(sessionID)
	if failure != nil {
		return nil, failure
	}
	request, failure := decodeRequest[explainRequest](requestJSON)
	if failure != nil {
		return nil, failure
	}
	return entry.explain(operationID, request)
}

func (b *Bridge) pingSession(sessionID uint64, operationID uint64) *bridgeError {
	entry, failure := b.sessions.lookup(sessionID)
	if failure != nil {
		return failure
	}
	return entry.ping(operationID)
}

func (b *Bridge) cancelOnSession(sessionID uint64, operationID uint64) {
	entry, failure := b.sessions.lookup(sessionID)
	if failure != nil {
		return
	}
	entry.cancel(operationID)
}

func (b *Bridge) closeSession(sessionID uint64) {
	entry, found := b.sessions.remove(sessionID)
	if !found {
		return
	}
	entry.close()
}

```

### Core Architecture Module: `Native/HanaBridge/internal/hana/config.go`
```
package hana

import (
	"encoding/json"
	"net"
	"strconv"
	"strings"
	"time"
)

const defaultConnectTimeout = 30 * time.Second

type connectionConfig struct {
	Host                  string  `json:"host"`
	Port                  int     `json:"port"`
	Username              string  `json:"username"`
	Password              string  `json:"password"`
	Schema                string  `json:"schema"`
	TLSMode               string  `json:"tlsMode"`
	TLSServerName         string  `json:"tlsServerName"`
	CACertificatePath     string  `json:"caCertificatePath"`
	ClientCertificatePath string  `json:"clientCertificatePath"`
	ClientKeyPath         string  `json:"clientKeyPath"`
	ConnectTimeoutSeconds float64 `json:"connectTimeoutSeconds"`
}

func parseConnectionConfig(data []byte) (connectionConfig, *bridgeError) {
	var config connectionConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return connectionConfig{}, internalError(err.Error())
	}
	if failure := config.validate(); failure != nil {
		return connectionConfig{}, failure
	}
	return config, nil
}

func (c connectionConfig) validate() *bridgeError {
	switch {
	case c.hostName() == "":
		return configurationError("host")
	case c.Port < 1 || c.Port > 65535:
		return configurationError("port")
	case strings.TrimSpace(c.Username) == "":
		return configurationError("username")
	case !isKnownTLSMode(c.TLSMode):
		return configurationError("tlsMode")
	case c.hasClientCertificatePath() != c.hasClientKeyPath():
		return configurationError("clientCertificate")
	case c.ConnectTimeoutSeconds < 0:
		return configurationError("connectTimeoutSeconds")
	}
	return nil
}

func (c connectionConfig) hostName() string {
	host := strings.TrimSpace(c.Host)
	if strings.HasPrefix(host, "[") && strings.HasSuffix(host, "]") {
		return host[1 : len(host)-1]
	}
	return host
}

func (c connectionConfig) address() string {
	return net.JoinHostPort(c.hostName(), strconv.Itoa(c.Port))
}

func (c connectionConfig) hasClientCertificatePath() bool {
	return strings.TrimSpace(c.ClientCertificatePath) != ""
}

func (c connectionConfig) hasClientKeyPath() bool {
	return strings.TrimSpace(c.ClientKeyPath) != ""
}

func (c connectionConfig) hasClientCertificate() bool {
	return c.hasClientCertificatePath() && c.hasClientKeyPath()
}

func (c connectionConfig) connectTimeout() time.Duration {
	if c.ConnectTimeoutSeconds <= 0 {
		return defaultConnectTimeout
	}
	return time.Duration(c.ConnectTimeoutSeconds * float64(time.Second))
}

```

### Core Architecture Module: `Native/HanaBridge/internal/hana/control.go`
```
package hana

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"
)

const cancelDeadline = 10 * time.Second

var errUnknownServerConnection = errors.New("the server connection id is unknown")

func cancelSessionStatement(connectionID int64) string {
	return "ALTER SYSTEM CANCEL SESSION '" + strconv.FormatInt(connectionID, 10) + "'"
}

func (s *session) interruptStatement(reason stopReason) {
	if reason == stopClosed {
		return
	}
	defer func() {
		if recover() != nil {
			s.loseConnection()
		}
	}()
	if _, err := runUnderWatchdog(cancelDeadline, s.loseConnection, s.sendCancel); err != nil {
		s.loseConnection()
	}
}

func (s *session) sendCancel() error {
	connectionID := s.serverConnectionID()
	if connectionID <= 0 {
		return errUnknownServerConnection
	}
	statement := cancelSessionStatement(connectionID)
	s.controlMu.Lock()
	defer s.controlMu.Unlock()
	conn, reused, err := s.controlConnection()
	if err != nil {
		return err
	}
	_, err = conn.ExecContext(context.Background(), statement)
	if err == nil {
		return nil
	}
	s.discardControlConnection()
	if !reused || !isConnectionFailure(err) {
		return err
	}
	conn, _, err = s.controlConnection()
	if err != nil {
		return err
	}
	if _, err = conn.ExecContext(context.Background(), statement); err != nil {
		s.discardControlConnection()
	}
	return err
}

func (s *session) controlConnection() (*sql.Conn, bool, error) {
	if s.control != nil {
		return s.control, true, nil
	}
	dialContext, cancel := context.WithTimeout(context.Background(), cancelDeadline)
	defer cancel()
	conn, err := s.controlDB.Conn(dialContext)
	if err != nil {
		return nil, false, err
	}
	s.control = conn
	return conn, false, nil
}

func (s *session) discardControlConnection() {
	if s.control == nil {
		return
	}
	_ = s.control.Close()
	s.control = nil
}

```

### Core Architecture Module: `Native/HanaBridge/internal/hana/dialer.go`
```
package hana

import (
	"context"
	"crypto/tls"
	"errors"
	"net"
	"sync"

	"github.com/SAP/go-hdb/driver/dial"
)

var errDialerSevered = errors.New("session sockets closed")

type trackingDialer struct {
	base      dial.Dialer
	tlsConfig *tls.Config

	mu      sync.Mutex
	severed bool
	live    map[*trackedConn]struct{}
}

func newTrackingDialer(base dial.Dialer, tlsConfig *tls.Config) *trackingDialer {
	return &trackingDialer{base: base, tlsConfig: tlsConfig, live: map[*trackedConn]struct{}{}}
}

func (d *trackingDialer) DialContext(ctx context.Context, address string, options dial.DialerOptions) (net.Conn, error) {
	if d.isSevered() {
		return nil, errDialerSevered
	}
	raw, err := d.base.DialContext(ctx, address, options)
	if err != nil {
		return nil, err
	}
	conn, err := d.track(raw)
	if err != nil {
		return nil, err
	}
	if d.tlsConfig == nil {
		return conn, nil
	}
	secured := tls.Client(conn, d.tlsConfig)
	if err := secured.HandshakeContext(ctx); err != nil {
		_ = conn.Close()
		return nil, &handshakeError{cause: err}
	}
	return secured, nil
}

func (d *trackingDialer) track(raw net.Conn) (*trackedConn, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.severed {
		_ = raw.Close()
		return nil, errDialerSevered
	}
	conn := &trackedConn{Conn: raw, owner: d}
	d.live[conn] = struct{}{}
	return conn, nil
}

func (d *trackingDialer) forget(conn *trackedConn) {
	d.mu.Lock()
	defer d.mu.Unlock()
	delete(d.live, conn)
}

func (d *trackingDialer) isSevered() bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.severed
}

func (d *trackingDialer) liveConnections() int {
	d.mu.Lock()
	defer d.mu.Unlock()
	return len(d.live)
}

func (d *trackingDialer) sever() {
	d.mu.Lock()
	d.severed = true
	conns := make([]*trackedConn, 0, len(d.live))
	for conn := range d.live {
		conns = append(conns, conn)
	}
	clear(d.live)
	d.mu.Unlock()
	for _, conn := range conns {
		_ = conn.Conn.Close()
	}
}

type trackedConn struct {
	net.Conn
	owner *trackingDialer
}

func (c *trackedConn) Close() error {
	c.owner.forget(c)
	return c.Conn.Close()
}

```

### Core Architecture Module: `Native/HanaBridge/internal/hana/envelope.go`
```
package hana

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strconv"
	"time"
	"unicode/utf8"
)

type cellKind uint8

const (
	cellNull cellKind = iota
	cellText
	cellBytes
)

var errMalformedCell = errors.New("a cell must be null, a string or an object with a bytes field")

type cell struct {
	kind  cellKind
	text  string
	bytes []byte
}

func nullCell() cell {
	return cell{kind: cellNull}
}

func textCell(text string) cell {
	return cell{kind: cellText, text: text}
}

func bytesCell(data []byte) cell {
	return cell{kind: cellBytes, bytes: data}
}

func (c *cell) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if bytes.Equal(trimmed, []byte("null")) {
		*c = nullCell()
		return nil
	}
	if len(trimmed) > 0 && trimmed[0] == '"' {
		var text string
		if err := json.Unmarshal(trimmed, &text); err != nil {
			return err
		}
		*c = textCell(text)
		return nil
	}
	var object struct {
		Bytes *string `json:"bytes"`
	}
	if err := json.Unmarshal(trimmed, &object); err != nil {
		return err
	}
	if object.Bytes == nil {
		return errMalformedCell
	}
	decoded, err := base64.StdEncoding.DecodeString(*object.Bytes)
	if err != nil {
		return err
	}
	*c = bytesCell(decoded)
	return nil
}

func (c cell) appendJSON(buffer []byte) []byte {
	switch c.kind {
	case cellText:
		return appendJSONString(buffer, c.text)
	case cellBytes:
		buffer = append(buffer, `{"bytes":"`...)
		buffer = base64.StdEncoding.AppendEncode(buffer, c.bytes)
		return append(buffer, `"}`...)
	default:
		return append(buffer, "null"...)
	}
}

type executeRequest struct {
	SQL            string  `json:"sql"`
	Parameters     *[]cell `json:"parameters"`
	RowCap         int64   `json:"rowCap"`
	TimeoutSeconds float64 `json:"timeoutSeconds"`
}

func (r executeRequest) hasParameters() bool {
	return r.Parameters != nil && len(*r.Parameters) > 0
}

func (r executeRequest) rowLimit() int {
	if r.RowCap <= 0 {
		return 0
	}
	return int(r.RowCap)
}

type explainRequest struct {
	SQL            string  `json:"sql"`
	TimeoutSeconds float64 `json:"timeoutSeconds"`
}

func secondsDuration(seconds float64) time.Duration {
	if seconds <= 0 {
		return 0
	}
	return time.Duration(seconds * float64(time.Second))
}

func decodeRequest[Request any](data []byte) (Request, *bridgeError) {
	var request Request
	if err := json.Unmarshal(data, &request); err != nil {
		return request, internalError(err.Error())
	}
	return request, nil
}

type connectResult struct {
	ServerVersion string `json:"serverVersion"`
	CurrentSchema string `json:"currentSchema"`
	ConnectionID  int64  `json:"connectionId"`
}

type resultEnvelope struct {
	columns               []string
	columnTypeNames       []string
	columnClassifications []string
	rows                  [][]cell
	rowsAffected          int64
	hasResultSet          bool
	executionTime         float64
	isTruncated           bool
	truncatedLobCount     int
	sessionLost           bool
}

func affectedRowsEnvelope(rowsAffected int64) *resultEnvelope {
	return &resultEnvelope{rowsAffected: rowsAffected}
}

func tabularEnvelope(columns []columnInfo) *resultEnvelope {
	envelope := &resultEnvelope{hasResultSet: true}
	for _, column := range columns {
		envelope.columns = append(envelope.columns, column.name)
		envelope.columnTypeNames = append(envelope.columnTypeNames, column.reportedTypeName())
		envelope.columnClassifications = append(envelope.columnClassifications, column.classification())
	}
	return envelope
}

func (e *resultEnvelope) appendJSON(buffer []byte) []byte {
	buffer = append(buffer, `{"columns":`...)
	buffer = appendStringArray(buffer, e.columns)
	buffer = append(buffer, `,"columnTypeNames":`...)
	buffer = appendStringArray(buffer, e.columnTypeNames)
	buffer = append(buffer, `,"columnClassifications":`...)
	buffer = appendOptionalStringArray(buffer, e.columnClassifications)
	buffer = append(buffer, `,"rows":[`...)
	for index, row := range e.rows {
		if index > 0 {
			buffer = append(buffer, ',')
		}
		buffer = appendRow(buffer, row)
	}
	buffer = append(buffer, `],"rowsAffected":`...)
	buffer = strconv.AppendInt(buffer, e.rowsAffected, 10)
	buffer = append(buffer, `,"hasResultSet":`...)
	buffer = strconv.AppendBool(buffer, e.hasResultSet)
	buffer = append(buffer, `,"executionTime":`...)
	buffer = strconv.AppendFloat(buffer, e.executionTime, 'f', -1, 64)
	buffer = append(buffer, `,"isTruncated":`...)
	buffer = strconv.AppendBool(buffer, e.isTruncated)
	buffer = append(buffer, `,"truncatedLobCount":`...)
	buffer = strconv.AppendInt(buffer, int64(e.truncatedLobCount), 10)
	buffer = append(buffer, `,"sessionLost":`...)
	buffer = strconv.AppendBool(buffer, e.sessionLost)
	return append(buffer, '}')
}

func appendRow(buffer []byte, row []cell) []byte {
	buffer = append(buffer, '[')
	for index, value := range row {
		if index > 0 {
			buffer = append(buffer, ',')
		}
		buffer = value.appendJSON(buffer)
	}
	return append(buffer, ']')
}

func appendStringArray(buffer []byte, values []string) []byte {
	buffer = append(buffer, '[')
	for index, value := range values {
		if index > 0 {
			buffer = append(buffer, ',')
		}
		buffer = appendJSONString(buffer, value)
	}
	return append(buffer, ']')
}

func appendOptionalStringArray(buffer []byte, values []string) []byte {
	buffer = append(buffer, '[')
	for index, value := range values {
		if index > 0 {
			buffer = append(buffer, ',')
		}
		if value == "" {
			buffer = append(buffer, "null"...)
			continue
		}
		buffer = appendJSONString(buffer, value)
	}
	return append(buffer, ']')
}

const lowercaseHexDigits = "0123456789abcdef"

func appendJSONString(buffer []byte, text string) []byte {
	buffer = append(buffer, '"')
	start := 0
	for index := 0; index < len(text); {
		character := text[index]
		if character < utf8.RuneSelf {
			if character >= 0x20 && character != '"' && character != '\\' {
				index++
				continue
			}
			buffer = append(buffer, text[start:index]...)
			buffer = appendEscapedASCII(buffer, character)
			index++
			start = index
			continue
		}
		decoded, size := utf8.DecodeRuneInString(text[index:])
		if decoded == utf8.RuneError && size == 1 {
			buffer = append(buffer, text[start:index]...)
			buffer = utf8.AppendRune(buffer, utf8.RuneError)
			index += size
			start = index
			continue
		}
		index += size
	}
	buffer = append(buffer, text[start:]...)
	return append(buffer, '"')
}

func appendEscapedASCII(buffer []byte, character byte) []byte {
	switch character {
	case '"', '\\':
		return append(buffer, '\\', character)
	case '\n':
		return append(buffer, '\\', 'n')
	case '\r':
		return append(buffer, '\\', 'r')
	case '\t':
		return append(buffer, '\\', 't')
	default:
		return append(buffer, '\\', 'u', '0', '0', lowercaseHexDigits[character>>4], lowercaseHexDigits[character&0xF])
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3166** (2026-09-28): **Failed to connect to DB on 443 port**
  *Symptoms*: ### What happened?  There is an error when i try to connect to Trino on 443 port ``` HTTP 400: <html> <head><title>400 The plain HTTP request was sent to HTTPS port</title></head> <body> <center><h1>400 Bad Request</h1></center> <center>The plain HTTP request was sent to HTTPS port</center> <hr><center>nginx</center> </body> </html> ``` DB: trino url: jdbc:trino://my.domain.com:443  DBeaver works well with driver: Trino JDBC Driver 483  ### Steps to reproduce  _No response_  ### Expected behavior  _No response_  ### Database type  N/A  ### TablePro version  0.75.0  ### macOS version & chip  macOS 26.6.2 / Apple Silicon  ### Screenshots / Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > That was really fast.. Thank you!

- **Issue #3132** (2026-09-26): **Can't create,edit or remove properties from MongoDB database. Why??????**
  *Symptoms*: ### What happened?  Where is the UI controls to add, edit and remove properties into MongoDB collection??????  <img width="1249" height="307" alt="Image" src="https://github.com/user-attachments/assets/05c678f6-2388-4caa-a289-d464d476dd8c" />  ### Steps to reproduce  1. Open MongoDB connection 2. Create a new database 3. Type the first collection name 4. it creates the database with single collection and single property: ObjectId 5. You can't do anything with it.  ### Expected behavior  The software should be able to handle and manage MongoDB collections and databases  ### Database type  MongoDB  ### TablePro version  0.75.0  ### macOS version & chip  macOS 27.0 / Apple Silicon  ### Screenshots / Logs  _No response_

- **Issue #3131** (2026-09-26): **Can't create a database collection from the visual editor**
  *Symptoms*: ### What happened?  Just, why?????  <img width="1021" height="486" alt="Image" src="https://github.com/user-attachments/assets/774e4204-1f7a-4de3-be8e-f1fe75148c72" />  ### Steps to reproduce  1. Open a MongoDB connection 2. Create a new database 3. It creates a new database with single collection and single property: ObjectId 4. Try to create a new collection with any number of fields  ### Expected behavior  The Software should be able to create collections with any number of fields without restrictions.  ### Database type  MongoDB  ### TablePro version  0.75.0  ### macOS version & chip  macOS 27 / Apple Silicon  ### Screenshots / Logs  _No response_

- **Issue #3103** (2026-09-24): **[PostgreSQL] When querying metadata, the process is not released**
  *Symptoms*: ### What happened?  [PostgreSQL] When I query metadata, the process is not released. As a result, there are a lot of processes in the DB.  While we're at it, is it possible to add Session Manager? Reference on DBeaver: https://dbeaver.com/docs/dbeaver/Session-Manager-Guide/  <img width="563" height="835" alt="Image" src="https://github.com/user-attachments/assets/497f0440-e827-4b5d-908d-3d37a8bdb7ab" />  ### Steps to reproduce  1. Open a PostgreSQL connection. 2. Click a table. 3. Click tab Structure. 4. Move to other tables and do the same.  ### Expected behavior  _No response_  ### Database type  PostgreSQL  ### TablePro version  0.75.0  ### macOS version & chip  macOS 27.0 / Apple silicon  ### Screenshots / Logs  _No response_

- **Issue #3078** (2026-09-24): **SQL Server batch variables are lost between statements**
  *Symptoms*: ### What happened?  ### Query  ```sql DECLARE @sn NVARCHAR(50) = '2404GQV000066A00105';  SELECT * FROM serialnew WHERE [S/N] = @sn;  SELECT * FROM [v_wms_joined] WHERE [S/N] = @sn;  SELECT * FROM drm_report_n WHERE [Serial number] = @sn;  SELECT * FROM serial_existed WHERE sn_code = @sn;  Actual behavior TablePro reports: Statement 2/5 failed: Must declare the scalar variable "@sn". Expected behavior The complete SQL Server script should be sent as one T-SQL batch, so @sn remains available to all following statements. Each SELECT result should still be displayed separately if possible.  Investigation The query editor currently appears to split the script at semicolons using SQLStatementScanner, then executes each statement separately. SQL Server local variables only live within a single batch, so @sn declared in the first statement is unavailable to later statements. Relevant code:  Packages/TableProCore/Sources/TableProSQLGrammar/SQLStatementScanner.swift TablePro/Core/Coordinators/QueryExecutionCoordinator+Parameters.swift Plugins/MSSQLDriverPlugin/MSSQLPlugin.swift SQLScriptText already has SQL Server-specific GO batch handling for scripts, but that path does not seem to be used by the query editor.  Could you please review whether SQL Server query execution should preserve T-SQL batches containing DECLARE, SET, IF, BEGIN/END, and similar batch-scoped constructs?  ### Steps to reproduce  _No response_  ### Expected behavior  _No response_  ### Database type  SQL Server  ##

- **Issue #3058** (2026-09-23): **Can't set default value of column to Null via query or via Inspector. It remains as empty.**
  *Symptoms*: ### What happened?  I have tried two methods of setting the default value of a column to Null:  1. Via the inspector 2. Via a query  In both instances this is not saved and the column defaults back to empty.  ### Steps to reproduce  **Method 1**  1. Open Inspector 2. Click on select for Default field and select Null 3. ⌘S to Save  **Method 2**  1. Write a query to perform the update: ALTER TABLE Event MODIFY COLUMN Name VARCHAR(255) NULL DEFAULT NULL; 2. Navigate to the Structure View. 3. ⌘R to refresh  _Screen Recording attached below._  ### Expected behavior  I would expect to be able to set the default value via either method  ### Database type  MySQL / MariaDB  ### TablePro version  Version 0.75.0 (131)  ### macOS version & chip  27.0 (26A428) Silicon  ### Screenshots / Logs  https://www.icloud.com/iclouddrive/0bd6iexM8tkQpDG6cIpjS45ag

- **Issue #3053** (2026-09-22): **[Oracle] Schema switch fails with clientClosedConnection on a healthy connection**
  *Symptoms*: ### What happened?  When I open a saved Oracle connection and TablePro restores or switches to another accessible schema, it shows this dialog:  ``` Schema switch failed OracleSQLError(code: clientClosedConnection, triggeredFromRequestInFile: *******, line: *******, statement: *******) - Some information has been reducted to prevent accidental leakage of sensitive data. ```  The Oracle server and network path were healthy at the time.  Diagnostics performed on the same Mac and network:  - macOS network logs show the TCP connections to the Oracle listener reached the ready state in about 0.1 seconds over the VPN. - There was no remote READ_CLOSE before the error. TablePro cancelled an auxiliary connection after reporting the failure. - An independent python-oracledb test using the same network and credentials connected in 0.296 seconds. - `SELECT ... FROM dual`, `ALTER SESSION SET CURRENT_SCHEMA` to the target schema, and restoring the original schema all succeeded. - TablePro's query timeout is 180 seconds. This error appeared about 17.5 seconds after the sockets became ready, so it does not appear to be a query timeout.  No persistent database changes were made during the diagnostic test.  ### Steps to reproduce  1. Open a saved Oracle connection that has a previously selected schema. 2. Wait for the initial connection and object tree to begin loading. 3. Let TablePro restore the last schema, or select another accessible schema. 4. Observe the `Schema switch failed` dialog w

- **Issue #3047** (2026-09-22): **Can't import CSV files**
  *Symptoms*: ### What happened?  In the documentation for TablePro it states that csv files can be imported via File -> Import -> Import Data, but csv files are greyed out in the finder, and whilst it is possible to open them, by double clicking on the file and then clicking 'Open', it looks like TablePro is treating them as sql files and so the import fails.  ### Steps to reproduce  1. File -> Import -> Import Data 2. Double click on csv file which is greyed out and click 'Open' 3. Click 'Import' 4. Import fails  ### Expected behavior  As per the manual, I was expecting TablePro to be able to import csv files.  <img width="524" height="854" alt="Image" src="https://github.com/user-attachments/assets/9039e81f-a268-442f-a28e-92fe59bfa9aa" />  ### Database type  MySQL / MariaDB  ### TablePro version  Version 0.75.0 (131)  ### macOS version & chip  27.0 (26A428) Silicon  ### Screenshots / Logs  https://www.icloud.com/iclouddrive/0e2fW-PnJxKpy4R3TCD0UJRtw

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

### Incident Patch 1: `c2ef9057` (2026-09-30)
**Commit Message**: fix(ios): Shortcuts Add Row rejects any CSV with CRLF line endings (#3224)

* fix(ios): Shortcuts Add Row rejects any CSV with CRLF line endings

* fix(ios): Info tab shows a DuckDB file connection as a server at 127.0.0.1:3306

* fix(ios): SELECT * FROM template writes LIMIT 100 on SQL Server, Oracle and Redis

* fix(ios): deleting a connection keeps its query history, and a synced delete keeps its secrets

* fix(ios): history list shows a duplicate entry the store already dropped

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -50,6 +50,11 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - CSV import with single quotes merging rows at a double quote inside a field.
 - Binary values in Latin-1 and Windows-1252 SQL dumps imported as different bytes.
 - Shortcuts rejecting CSV and JSON files that are not UTF-8.
+- Shortcuts Add Row and Add Rows rejecting CSV with CRLF or CR line endings as having no data.
+- iOS Info tab showing a DuckDB connection as a server at 127.0.0.1:3306 instead of its file.
+- iOS `SELECT * FROM` template writing `LIMIT 100` on SQL Server, Oracle and Redis, and leaving out the selected schema.
+- iOS keeping the query history of deleted connections, and the passwords of connections deleted on another device.
+- iOS history list showing a repeated query twice until the connection is reopened.
 - Redis Cluster through a tunnel failing to connect with advice to set Connection Mode to Cluster.
 - Redis `SCAN` typed in a query tab showing one page of keys with no next cursor to continue from.
 - etcd `lease revoke`, `auth disable` and user or role deletion skipping confirmation, and list commands gated as writes.
```

**File**: `TableProMobile/TableProMobile/AppState.swift` (modified, +11/-11)
```diff
@@ -40,6 +40,7 @@ final class AppState {
     let sshProvider: IOSSSHProvider
     let secureStore: any SecureStore
     let localDatabaseFiles: LocalDatabaseFileLocator
+    let queryHistory: QueryHistoryStorage
 
     private let sampleInstaller: SampleDatabaseInstaller
     private let libraryPublisher: ConnectionLibraryPublisher
@@ -65,6 +66,7 @@ final class AppState {
         libraryPreferences = ConnectionLibraryPreferences(defaults: defaults)
         syncCoordinator = injectedSyncCoordinator ?? IOSSyncCoordinator()
         storage = ConnectionPersistence(directory: libraryDirectory)
+        queryHistory = QueryHistoryStorage(directory: libraryDirectory)
         groupStorage = GroupPersistence(directory: libraryDirectory)
         tagStorage = TagPersistence(directory: libraryDirectory)
         let driverFactory = IOSDriverFactory(bookmarkStore: bookmarkStore, localFiles: localDatabaseFiles)
@@ -141,7 +143,9 @@ final class AppState {
     func applySyncedConnections(_ merged: [DatabaseConnection]) {
         guard !refuseWriteIfNotReady() else { return }
         guard merged != connections else { return }
+        let removedIds = Set(connections.map(\.id)).subtracting(merged.map(\.id))
         persist(connections: merged)
+        localState.purge(removedIds)
         publishLibrary()
     }
 
@@ -316,12 +320,8 @@ final class AppState {
         guard !refuseWriteIfNotReady() else { return }
         let removed = connections.filter { ids.contains($0.id) }
         guard !removed.isEmpty else { return }
-        let secrets = ConnectionSecrets(secureStore: secureStore)
-        for connection in removed {
-            secrets.delete(for: connection.id)
-            clearPerConnectionPreferences(for: connection.id)
-        }
         persist(connections: connections.filter { !ids.contains($0.id) })
+        localState.purge(Set(removed.map(\.id)))
         publishLibrary()
         for connection in removed where connection.participatesInSync {
             syncCoordinator.markDeleted(connection.id)
@@ -343,12 +343,12 @@ final class AppState {
         return true
     }
 
-    private func clearPerConnectionPreferences(for id: UUID) {
-        let suffix = id.uuidString
-        let defaults = UserDefaults.standard
-        for prefix in ["lastTab.", "lastDB.", "lastSchema.", "lastQuery."] {
-            defaults.removeObject(forKey: prefix + suffix)
-        }
+    private var localState: ConnectionLocalState {
+        ConnectionLocalState(
+            secrets: ConnectionSecrets(secureStore: secureStore),
+            queryHistory: queryHistory,
+            defaults: .standard
+        )
     }
 
     // MARK: - Groups
```

**File**: `TableProMobile/TableProMobile/Coordinators/ConnectionCoordinator.swift` (modified, +12/-12)
```diff
@@ -26,15 +26,15 @@ final class ConnectionCoordinator {
 
     var selectedTab: ConnectedTab = .tables {
         didSet {
-            UserDefaults.standard.set(selectedTab.rawValue, forKey: "lastTab.\(connection.id.uuidString)")
+            UserDefaults.standard.set(selectedTab.rawValue, forKey: ConnectionDefaultsKey.lastTab.name(for: connection.id))
         }
     }
     var pendingQuery: String?
     var pendingTableName: String?
     var selectedTable: TableInfo?
 
     private(set) var queryHistory: [QueryHistoryItem] = []
-    private let historyStorage = QueryHistoryStorage()
+    private var historyStorage: QueryHistoryStorage { appState.queryHistory }
 
     private let appState: AppState
 
@@ -72,13 +72,13 @@ final class ConnectionCoordinator {
     // MARK: - Persisted State
 
     func restorePersistedState() {
-        let key = connection.id.uuidString
-        if let savedTab = UserDefaults.standard.string(forKey: "lastTab.\(key)"),
+        let defaults = UserDefaults.standard
+        if let savedTab = defaults.string(forKey: ConnectionDefaultsKey.lastTab.name(for: connection.id)),
            let tab = ConnectedTab(rawValue: savedTab) {
             selectedTab = tab
         }
-        activeDatabase = UserDefaults.standard.string(forKey: "lastDB.\(key)") ?? ""
-        activeSchema = UserDefaults.standard.string(forKey: "lastSchema.\(key)") ?? "public"
+        activeDatabase = defaults.string(forKey: ConnectionDefaultsKey.lastDB.name(for: connection.id)) ?? ""
+        activeSchema = defaults.string(forKey: ConnectionDefaultsKey.lastSchema.name(for: connection.id)) ?? "public"
     }
 
     // MARK: - Connection Lifecycle
@@ -272,7 +272,7 @@ final class ConnectionCoordinator {
                     self.session = freshSession
                 }
                 activeDatabase = name
-                UserDefaults.standard.set(name, forKey: "lastDB.\(connection.id.uuidString)")
+                UserDefaults.standard.set(name, forKey: ConnectionDefaultsKey.lastDB.name(for: connection.id))
                 if let current = self.session {
                     self.tables = try await current.driver.fetchTables(schema: nil)
                 }
@@ -297,7 +297,7 @@ final class ConnectionCoordinator {
             self.session = newSession
             self.tables = try await newSession.driver.fetchTables(schema: nil)
             activeDatabase = database
-            UserDefaults.standard.set(database, forKey: "lastDB.\(connection.id.uuidString)")
+            UserDefaults.standard.set(database, forKey: ConnectionDefaultsKey.lastDB.name(for: connection.id))
             await loadSchemas()
         } catch {
             Self.logger.error("Failed to switch to database \(database, privacy: .public): \(error.localizedDescription, privacy: .public)")
@@ -329,7 +329,7 @@ final class ConnectionCoordinator {
         do {
             try await session.driver.switchSchema(to: name)
             activeSchema = name
-            UserDefaults.standard.set(name, forKey: "lastSchema.\(connection.id.uuidString)")
+            UserDefaults.standard.set(name, forKey: ConnectionDefaultsKey.lastSchema.name(for: connection.id))
             self.tables = try await session.driver.fetchTables(schema: name)
         } catch {
             failureAlertMessage = String(localized: "Failed to switch schema")
@@ -358,8 +358,8 @@ final class ConnectionCoordinator {
     }
 
     func addHistoryItem(_ item: QueryHistoryItem) {
-        historyStorage.save(item)
-        queryHistory.append(item)
+        guard historyStorage.save(item) else { return }
+        loadHistory()
     }
 
     func deleteHistoryItem(_ id: UUID) {
@@ -368,7 +368,7 @@ final class ConnectionCoordinator {
     }
 
     func clearHistory() {
-        historyStorage.clearAll(for: connection.id)
+        historyStorage.clearAll(for: [connection.id])
         queryHistory = []
     }
 
```

**File**: `TableProMobile/TableProMobile/Helpers/ConnectionDefaultsKey.swift` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+import Foundation
+
+nonisolated enum ConnectionDefaultsKey: String, CaseIterable {
+    case lastTab
+    case lastDB
+    case lastSchema
+    case lastQuery
+
+    func name(for connectionId: UUID) -> String {
+        "\(rawValue).\(connectionId.uuidString)"
+    }
+}
```

**File**: `TableProMobile/TableProMobile/Helpers/ConnectionDetailFormatter.swift` (modified, +2/-6)
```diff
@@ -3,12 +3,8 @@ import TableProModels
 
 nonisolated enum ConnectionDetailFormatter {
     static func detail(for connection: DatabaseConnection) -> String {
-        switch connection.type {
-        case .sqlite, .duckdb:
-            return fileDetail(connection.database)
-        default:
-            return networkDetail(for: connection)
-        }
+        guard connection.type.isLocalFile else { return networkDetail(for: connection) }
+        return fileDetail(connection.database)
     }
 
     private static func fileDetail(_ path: String) -> String {
```

---

### Incident Patch 2: `ad7abca7` (2026-09-30)
**Commit Message**: fix(plugins): restore the main build after #3205 and #3208 changed the same cell text API (#3225)

**File**: `Plugins/SurrealDBDriverPlugin/SurrealValue+Display.swift` (modified, +8/-2)
```diff
@@ -53,8 +53,14 @@ public extension SurrealValue {
         }
     }
 
-    var jsonText: String {
-        JSONTruncation.truncate(Self.jsonFragment(self), maxLength: Self.maxSerializedLength)
+    private func jsonText(_ length: SurrealTextLength) -> String {
+        let json = Self.jsonFragment(self)
+        switch length {
+        case .display:
+            return JSONTruncation.truncate(json, maxLength: Self.maxSerializedLength)
+        case .whole:
+            return json
+        }
     }
 
     var typeName: String {
```

**File**: `TableProTests/Plugins/ElasticsearchDriverTests.swift` (modified, +1/-1)
```diff
@@ -1202,7 +1202,7 @@ struct ElasticsearchStatementGeneratorTests {
     }
 
     private func displayed(_ value: Any) -> String {
-        ElasticsearchMappingFlattener.cell(value).asText ?? ""
+        ElasticsearchMappingFlattener.cell(value, length: .display).asText ?? ""
     }
 
     private func shortenedRefusal(_ column: String) -> PluginRowWriteRefusal {
```

**File**: `TableProTests/Plugins/TypesenseDriverTests.swift` (modified, +2/-2)
```diff
@@ -964,7 +964,7 @@ struct TypesenseStatementGeneratorTests {
     }
 
     private func shortenedAuthors() -> String {
-        TypesenseSchema.cell((0..<1_500).map { "author-\($0)" }).asText ?? ""
+        TypesenseSchema.cell((0..<1_500).map { "author-\($0)" }, length: .display).asText ?? ""
     }
 
     private func shortenedRefusal(_ column: String) -> PluginRowWriteRefusal {
@@ -1025,7 +1025,7 @@ struct TypesenseStatementGeneratorTests {
 
     @Test("A complete array written over one shortened for display is refused, since it may be the shown part closed")
     func updateRefusesACompleteArrayWrittenOverAShortenedOne() throws {
-        let shownPart = TypesenseSchema.cell((0..<600).map { "author-\($0)" }).asText ?? ""
+        let shownPart = TypesenseSchema.cell((0..<600).map { "author-\($0)" }, length: .display).asText ?? ""
         try #require(!shownPart.hasSuffix("..."))
         #expect(throws: shortenedRefusal("authors")) {
             try updateRequest(authorsEdit(from: shortenedAuthors(), to: .text(shownPart)))
```

---

### Incident Patch 3: `4e5d62d0` (2026-09-30)
**Commit Message**: fix(ios): read an unrecognized Safe Mode level from iCloud as Confirm Writes, not Off (#3214)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -86,6 +86,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Literal backticks in cloudflared, cloud-sql-proxy, SSH config, remote command and dump tool install messages.
 - Tunnel command preview showing port 0 or the wrong host when Port is blank or the connection uses a host list.
 - SSH tab host-list warning naming replica set failover for Redis and Kafka, and implying Sentinel works through a tunnel.
+- iPhone and iPad reading a Safe Mode level they do not recognize from iCloud as Off.
 
 ### Security
 
```

**File**: `Packages/TableProCore/Sources/TableProSync/SyncRecordMapper.swift` (modified, +2/-12)
```diff
@@ -187,22 +187,12 @@ public enum SyncRecordMapper {
     }
 
     private static func storedSafeModeLevel(in fields: SyncRecordFields<ConnectionSyncField>) -> SafeModeLevel {
-        safeModeLevel(
-            fromWire: fields[.safeModeLevel] as? String,
+        SafeModeLevel(
+            wireValue: fields[.safeModeLevel] as? String,
             isReadOnly: (fields[.isReadOnly] as? Int64 ?? 0) != 0
         )
     }
 
-    private static func safeModeLevel(fromWire raw: String?, isReadOnly: Bool) -> SafeModeLevel {
-        guard let raw else { return isReadOnly ? .readOnly : .off }
-        if let level = SafeModeLevel(rawValue: raw) { return level }
-        switch raw {
-        case "silent": return .off
-        case "alert", "alertFull", "safeMode", "safeModeFull": return .confirmWrites
-        default: return isReadOnly ? .readOnly : .off
-        }
-    }
-
     // MARK: - Update Existing CKRecord (preserves macOS-only fields)
 
     public static func updateRecord(_ record: CKRecord, with connection: DatabaseConnection) {
```

---

### Incident Patch 4: `91150eb6` (2026-09-30)
**Commit Message**: fix(plugins): CSV, XLSX and MQL exports ignore the per-table row scope (#3197)

* fix(plugins): offer and apply the export row scope only on engines with a SQL dialect

* fix(plugins): read CSV, XLSX and MQL exports through the per-table row scope

* fix(plugins): write 64-bit integers and whole doubles in MQL exports through their type constructors

* fix(plugins): give every XLSX export sheet a unique name within 31 characters

---------

Signed-off-by: Ngô Quốc Đạt <datlechin@gmail.com>

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -25,6 +25,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Explain Analyze running write statements on Read-Only connections and skipping the Alert and Safe Mode confirmation.
 - Remote deletions of connections, groups, tags, SSH profiles and table favorites applied with their sync category off.
 - **Local only** connections taking edits and deletions made on another device.
+- Export dialog offering a SQL row scope on MongoDB, Redis and other engines without SQL.
+- CSV, XLSX and MQL exports ignoring a table's row filter, row limit and column choice.
+- MQL export rounding 64-bit integers past 2^53 and restoring whole doubles and small 64-bit integers as 32-bit ones.
+- XLSX export writing duplicate sheet names that Excel only opens after a repair.
 - Oracle, Snowflake and Dameng `NUMBER` rounded or left empty, and `DECIMAL` losing digits, in Parquet exports.
 - Oracle `BINARY_FLOAT` and `BINARY_DOUBLE` columns written as text in Parquet exports.
 - PostgreSQL `money` values written as null in Parquet exports.
```

**File**: `Plugins/CSVExportPlugin/CSVExportPlugin.swift` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ final class CSVExportPlugin: ObservableObject, ExportFormatPlugin, SettablePlugi
             var isFirstBatch = true
             var columns: [String] = []
 
-            let stream = dataSource.streamRows(table: table.name, databaseName: table.databaseName)
+            let stream = dataSource.streamRows(for: table)
             for try await element in stream {
                 try progress.checkCancellation()
 
```

**File**: `Plugins/MQLExportPlugin/MQLExportHelpers.swift` (modified, +12/-0)
```diff
@@ -45,12 +45,24 @@ enum MQLExportHelpers {
         case "DECIMAL":
             guard NumberText.isJSONNumberLiteral(value) else { break }
             return "NumberDecimal(\(JavaScriptText.stringLiteral(value)))"
+        case "BIGINT":
+            guard Int64(value) != nil else { break }
+            return "NumberLong(\(JavaScriptText.stringLiteral(value)))"
+        case "FLOAT":
+            guard NumberText.isJSONNumber(value), let number = Double(value), readsBackAsInteger(number) else { break }
+            return "Double(\(value))"
         default:
             break
         }
         return mqlJsonValue(for: value)
     }
 
+    private static let largestExactInteger: Double = 9_007_199_254_740_991
+
+    private static func readsBackAsInteger(_ number: Double) -> Bool {
+        number.rounded(.towardZero) == number && abs(number) <= largestExactInteger
+    }
+
     private static func isIso8601(_ value: String) -> Bool {
         let formatter = ISO8601DateFormatter()
         formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
```

**File**: `Plugins/MQLExportPlugin/MQLExportPlugin.swift` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ final class MQLExportPlugin: ObservableObject, ExportFormatPlugin, SettablePlugi
                 var columnTypeNames: [String] = []
                 var documentBatch: [String] = []
 
-                let stream = dataSource.streamRows(table: table.name, databaseName: table.databaseName)
+                let stream = dataSource.streamRows(for: table)
                 for try await element in stream {
                     try progress.checkCancellation()
 
```

**File**: `Plugins/XLSXExportPlugin/XLSXExportPlugin.swift` (modified, +1/-2)
```diff
@@ -57,7 +57,7 @@ final class XLSXExportPlugin: ObservableObject, ExportFormatPlugin, SettablePlug
             var columns: [String] = []
             let headerRowCount = settings.includeHeaderRow ? 1 : 0
 
-            let stream = dataSource.streamRows(table: table.name, databaseName: table.databaseName)
+            let stream = dataSource.streamRows(for: table)
             for try await element in stream {
                 try progress.checkCancellation()
 
@@ -162,7 +162,6 @@ final class XLSXExportPlugin: ObservableObject, ExportFormatPlugin, SettablePlug
                 )
                 writer.finishSheet()
             }
-
         }
 
         try await writer.write(to: destination)
```

---

### Incident Patch 5: `e5423e5a` (2026-09-30)
**Commit Message**: fix(plugin-parquet): NUMBER exports as BIGINT and PostgreSQL money as null (#3195)

* fix(plugin-parquet): export NUMBER, DECIMAL and NUMERIC by their declared precision and scale

* fix(plugin-parquet): export PostgreSQL money as text and SQL Server money as an exact decimal

* fix(plugin-parquet): remove the files already written when a multi-table export is stopped between tables

---------

Signed-off-by: Ngô Quốc Đạt <datlechin@gmail.com>

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -25,6 +25,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Explain Analyze running write statements on Read-Only connections and skipping the Alert and Safe Mode confirmation.
 - Remote deletions of connections, groups, tags, SSH profiles and table favorites applied with their sync category off.
 - **Local only** connections taking edits and deletions made on another device.
+- Oracle, Snowflake and Dameng `NUMBER` rounded or left empty, and `DECIMAL` losing digits, in Parquet exports.
+- Oracle `BINARY_FLOAT` and `BINARY_DOUBLE` columns written as text in Parquet exports.
+- PostgreSQL `money` values written as null in Parquet exports.
+- Files left behind when a multi-table Parquet export is stopped between tables.
 - Filter-bar BETWEEN refused on Typesense and Weaviate, and given the wrong lower bound on BigQuery.
 - Cassandra filter error telling MCP clients to use a Match All control they do not have.
 - Japanese, Chinese and Korean text in CSV, TSV and SQL files opening as garbled characters.
```

**File**: `Plugins/ParquetExportPlugin/ParquetExportPlugin.swift` (modified, +4/-15)
```diff
@@ -61,21 +61,9 @@ final class ParquetExportPlugin: ObservableObject, ExportFormatPlugin, SettableP
     ) async throws -> ExportFormatResult {
         guard !tables.isEmpty else { return ExportFormatResult() }
         var warnings: [String] = []
-        var written: [URL] = []
 
-        for (index, table) in tables.enumerated() {
-            try progress.checkCancellation()
-            progress.setCurrentTable(table.qualifiedName, index: index + 1)
-            let fileURL = tables.count == 1
-                ? destination
-                : ParquetFileNaming.perTableURL(destination: destination, table: table.name)
-            do {
-                try await writeTable(table, dataSource: dataSource, to: fileURL, progress: progress)
-                written.append(fileURL)
-            } catch {
-                for url in written { try? FileManager.default.removeItem(at: url) }
-                throw error
-            }
+        try await ParquetTableFiles.write(tables, destination: destination, progress: progress) { table, fileURL in
+            try await writeTable(table, dataSource: dataSource, to: fileURL, progress: progress)
         }
 
         if tables.count > 1 {
@@ -109,7 +97,8 @@ final class ParquetExportPlugin: ObservableObject, ExportFormatPlugin, SettableP
             case .header(let header):
                 columns = header.columns
                 let types = columns.map { column in
-                    ParquetTypeMapper.duckDBType(forColumnType: declaredTypes[column] ?? "")
+                    ParquetTypeMapper.duckDBType(
+                        forColumnType: declaredTypes[column] ?? "", databaseTypeId: dataSource.databaseTypeId)
                 }
                 try staging.createTable(columns: columns, types: types)
                 created = true
```

**File**: `Plugins/ParquetExportPlugin/ParquetTableFiles.swift` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+//
+//  ParquetTableFiles.swift
+//  ParquetExportPlugin
+//
+
+import Foundation
+import TableProPluginKit
+
+public enum ParquetTableFiles {
+    public static func write(
+        _ tables: [PluginExportTable],
+        destination: URL,
+        progress: PluginExportProgress,
+        writeTable: (PluginExportTable, URL) async throws -> Void
+    ) async throws {
+        var written: [URL] = []
+        do {
+            for (index, table) in tables.enumerated() {
+                try progress.checkCancellation()
+                progress.setCurrentTable(table.qualifiedName, index: index + 1)
+                let fileURL = fileURL(for: table, tableCount: tables.count, destination: destination)
+                try await writeTable(table, fileURL)
+                written.append(fileURL)
+            }
+        } catch {
+            for url in written { try? FileManager.default.removeItem(at: url) }
+            throw error
+        }
+    }
+
+    private static func fileURL(for table: PluginExportTable, tableCount: Int, destination: URL) -> URL {
+        guard tableCount > 1 else { return destination }
+        return ParquetFileNaming.perTableURL(destination: destination, table: table.name)
+    }
+}
```

**File**: `Plugins/ParquetExportPlugin/ParquetTypeMapper.swift` (modified, +42/-9)
```diff
@@ -11,17 +11,18 @@ import TableProPluginKit
 /// Parquet is a typed format, so writing every column as a string would produce a file that reads
 /// back with no numbers, no dates and no booleans. The source engine's own type name is the only
 /// thing that says what a column holds, because a streamed value arrives as text either way.
-///
-/// The mapping is deliberately coarse. Getting a width or a precision wrong writes a file that
-/// silently truncates, and Parquet's own type set is small: matching families is right, matching
-/// exact declarations is not achievable across twenty engines.
 public enum ParquetTypeMapper {
     /// The DuckDB type for a column, or `VARCHAR` when nothing better is known. A value that fails
     /// to cast becomes null rather than failing the export, which is what `TRY_CAST` gives.
-    public static func duckDBType(forColumnType typeName: String) -> String {
+    public static func duckDBType(forColumnType typeName: String, databaseTypeId: String) -> String {
         let base = baseName(typeName)
+        if let moneyType = fixedPointMoneyTypes[databaseTypeId]?[base] { return moneyType }
         if integerTypes.contains(base) { return "BIGINT" }
-        if decimalTypes.contains(base) { return "DOUBLE" }
+        if exactNumericTypes.contains(base) {
+            guard !enginesIgnoringDeclaredPrecision.contains(databaseTypeId) else { return "DOUBLE" }
+            return exactNumericType(declaredAs: typeName)
+        }
+        if approximateNumericTypes.contains(base) { return "DOUBLE" }
         if booleanTypes.contains(base) { return "BOOLEAN" }
         if dateTypes.contains(base) { return "DATE" }
         if timestampTypes.contains(base) { return "TIMESTAMP" }
@@ -43,13 +44,45 @@ public enum ParquetTypeMapper {
             .map(String.init) ?? withoutArgs
     }
 
+    private static func exactNumericType(declaredAs typeName: String) -> String {
+        let arguments = typeArguments(typeName)
+        guard let precision = arguments.first.flatMap({ Int($0) }),
+              (1 ... maximumDecimalDigits).contains(precision) else { return "DOUBLE" }
+        let scale = arguments.count > 1 ? Int(arguments[1]) : 0
+        guard let scale, (0 ... precision).contains(scale) else { return "DOUBLE" }
+        if scale == 0, precision <= maximumBigIntDigits { return "BIGINT" }
+        return "DECIMAL(\(precision),\(scale))"
+    }
+
+    private static func typeArguments(_ typeName: String) -> [String] {
+        guard let open = typeName.firstIndex(of: "("),
+              let close = typeName[open...].firstIndex(of: ")") else { return [] }
+        return typeName[typeName.index(after: open) ..< close]
+            .split(separator: ",")
+            .map { $0.trimmingCharacters(in: .whitespaces) }
+    }
+
+    private static let maximumBigIntDigits = 18
+
+    private static let maximumDecimalDigits = 38
+
+    private static let enginesIgnoringDeclaredPrecision: Set<String> = [
+        "SQLite", "libSQL", "Turso", "Cloudflare D1"
+    ]
+
+    private static let fixedPointMoneyTypes: [String: [String: String]] = [
+        "SQL Server": ["money": "DECIMAL(19,4)", "smallmoney": "DECIMAL(10,4)"]
+    ]
+
     private static let integerTypes: Set<String> = [
         "int", "int2", "int4", "int8", "integer", "smallint", "bigint", "tinyint",
-        "mediumint", "serial", "bigserial", "smallserial", "year", "number"
+        "mediumint", "serial", "bigserial", "smallserial", "year"
     ]
 
-    private static let decimalTypes: Set<String> = [
-        "decimal", "numeric", "float", "float4", "float8", "double", "real", "money"
+    private static let exactNumericTypes: Set<String> = ["decimal", "numeric", "number"]
+
+    private static let approximateNumericTypes: Set<String> = [
+        "float", "float4", "float8", "double", "real", "binary_float", "binary_double"
     ]
 
     private static let booleanTypes: Set<String> = ["bool", "boolean", "bit"]
```

**File**: `TableProTests/Plugins/ExportFormatEscapingTests.swift` (modified, +77/-19)
```diff
@@ -8,7 +8,6 @@ import TableProPluginKit
 import Testing
 
 struct MarkdownExportEscapingTests {
-
     /// A pipe closes a cell, so a value holding one would end the cell early and shift every
     /// column after it.
     @Test("A pipe in a value is escaped")
@@ -66,7 +65,6 @@ struct MarkdownExportEscapingTests {
 }
 
 struct HTMLExportEscapingTests {
-
     /// Every value in an export comes from the database, so a value holding markup reaches a file
     /// someone opens in a browser.
     @Test("Markup characters are escaped")
@@ -98,7 +96,6 @@ struct HTMLExportEscapingTests {
 }
 
 struct XMLExportEscapingTests {
-
     @Test("The five predefined entities are escaped")
     func entitiesAreEscaped() {
         #expect(XMLEscaping.text("<a & b>") == "&lt;a &amp; b&gt;")
@@ -139,43 +136,105 @@ struct XMLExportEscapingTests {
 }
 
 struct ParquetTypeMapperTests {
+    private func mapped(_ typeName: String, on databaseTypeId: String = "PostgreSQL") -> String {
+        ParquetTypeMapper.duckDBType(forColumnType: typeName, databaseTypeId: databaseTypeId)
+    }
 
     @Test("Integer families map to BIGINT")
     func integerFamilies() {
         for type in ["INT", "int4", "BIGINT", "smallint", "TINYINT", "SERIAL", "MEDIUMINT"] {
-            #expect(ParquetTypeMapper.duckDBType(forColumnType: type) == "BIGINT", "\(type)")
+            #expect(mapped(type) == "BIGINT", "\(type)")
+        }
+    }
+
+    @Test("Floating families and undeclared exact numerics map to DOUBLE")
+    func doubleFamilies() {
+        for type in ["numeric", "FLOAT", "double precision", "REAL"] {
+            #expect(mapped(type) == "DOUBLE", "\(type)")
         }
     }
 
-    @Test("Decimal families map to DOUBLE")
-    func decimalFamilies() {
-        for type in ["DECIMAL(10,2)", "numeric", "FLOAT", "double precision", "REAL", "money"] {
-            #expect(ParquetTypeMapper.duckDBType(forColumnType: type) == "DOUBLE", "\(type)")
+    @Test("PostgreSQL money keeps its text, since it carries a currency symbol no cast can read")
+    func postgresMoneyStaysText() {
+        #expect(mapped("money", on: "PostgreSQL") == "VARCHAR")
+        #expect(mapped("MONEY", on: "PostgreSQL") == "VARCHAR")
+    }
+
+    @Test("SQL Server money keeps its exact four decimal places")
+    func sqlServerMoneyIsFixedPoint() {
+        #expect(mapped("money", on: "SQL Server") == "DECIMAL(19,4)")
+        #expect(mapped("smallmoney", on: "SQL Server") == "DECIMAL(10,4)")
+        #expect(mapped("SMALLMONEY", on: "SQL Server") == "DECIMAL(10,4)")
+    }
+
+    @Test("An exact numeric with no usable declaration maps to DOUBLE")
+    func undeclaredExactNumericIsDouble() {
+        let types = ["number", "NUMBER", "NUMBER(*,0)", "numeric", "numeric(65,30)", "NUMBER(2,5)"]
+        for type in types {
+            #expect(mapped(type, on: "Oracle") == "DOUBLE", "\(type)")
         }
     }
 
+    @Test("A declared exact numeric keeps its precision and scale")
+    func declaredExactNumericKeepsPrecision() {
+        let expected: [String: String] = [
+            "NUMBER(10,2)": "DECIMAL(10,2)",
+            "number(10, 2)": "DECIMAL(10,2)",
+            "NUMBER(19)": "DECIMAL(19,0)",
+            "number(38)": "DECIMAL(38,0)",
+            "DECIMAL(10,2)": "DECIMAL(10,2)",
+            "numeric(38,10)": "DECIMAL(38,10)"
+        ]
+        for (type, duckDBType) in expected {
+            #expect(mapped(type, on: "Oracle") == duckDBType, "\(type)")
+        }
+    }
+
+    @Test("An exact numeric declared with scale 0 and at most 18 digits maps to BIGINT")
+    func exactNumericWithScaleZeroIsAnInteger() {
+        let types = ["number(10)", "NUMBER(18)", "NUMBER(18,0)", "number(1, 0)", "DECIMAL(10,0)", "numeric(5)"]
+        for type in types {
+            #expect(mapped(type, on: "Oracle") == "BIGINT", "\(type)")
+        }
+    }
+
+    @Test("SQLite-family engines ignore a declared precision, so their exact numerics map to DOUBLE")
+    func sqliteFamilyIgnore
```

---

### Incident Patch 6: `cf15874b` (2026-09-30)
**Commit Message**: fix(plugins): refuse saving an Elasticsearch, Typesense or SurrealDB value shortened for display (#3208)

Signed-off-by: Ngô Quốc Đạt <datlechin@gmail.com>

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -49,6 +49,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `EXPLAIN ANALYSE` treated as a plain `EXPLAIN` that does not run its statement.
 - Safe Mode level lost when importing a connection file from Mac to iOS or from iOS to Mac.
 - Undo and Redo in a tab with unsaved edits replaying another tab's changes against the wrong rows.
+- MongoDB, Elasticsearch, Typesense and SurrealDB saving a long array or object shortened for display as the cut text.
+- MongoDB refusing text like `[DRAFT] Chapter one...` as a value shortened for display.
 - Clipboard URL banner turning `sslmode=verify-full` or `verify-ca` into Required and ignoring `sslmode=disable`.
 - Import from URL ignoring `ssl=1`, `ssl=require` and `ssl=0`.
 - Registry plugins refused as needing a newer TablePro on releases the registry still publishes binaries for.
```

**File**: `Packages/TableProCore/Sources/TableProNumberFormatting/NumberText.swift` (modified, +5/-3)
```diff
@@ -98,9 +98,11 @@ public enum JSONTruncation {
     /// A structure whose text was cut short no longer closes, so it is no longer the value it
     /// came from. Callers that write or export must refuse it rather than store the fragment.
     public static func isIncompleteStructure(_ text: String) -> Bool {
-        guard let first = text.first, first == "{" || first == "[" else { return false }
-        guard text.hasSuffix(marker) else { return false }
-        return !(text.hasSuffix("}" + marker) || text.hasSuffix("]" + marker))
+        let scalars = text.unicodeScalars
+        let markerLength = marker.unicodeScalars.count
+        guard let first = scalars.first, first == "{" || first == "[" else { return false }
+        guard scalars.suffix(markerLength).elementsEqual(marker.unicodeScalars) else { return false }
+        return UnclosedJSONContainer.isOpenedBy(scalars.dropLast(markerLength))
     }
 }
 
```

**File**: `Packages/TableProCore/Sources/TableProNumberFormatting/UnclosedJSONContainer.swift` (added, +161/-0)
```diff
@@ -0,0 +1,161 @@
+internal struct UnclosedJSONContainer {
+    private enum Container {
+        case array
+        case object
+    }
+
+    private enum Expectation {
+        case value
+        case valueOrClose
+        case key
+        case keyOrClose
+        case colon
+        case separatorOrClose
+        case nothing
+    }
+
+    private enum Lexeme {
+        case structure
+        case string
+        case escape
+        case unicodeEscape(remainingDigits: Int)
+        case bareWord
+    }
+
+    private static let simpleEscapes: Set<Unicode.Scalar> = ["\"", "\\", "/", "b", "f", "n", "r", "t"]
+    private static let whitespace: Set<Unicode.Scalar> = [" ", "\t", "\n", "\r"]
+    private static let bareWordSymbols: Set<Unicode.Scalar> = ["+", "-", "."]
+
+    private var containers: [Container] = []
+    private var expectation = Expectation.value
+    private var lexeme = Lexeme.structure
+
+    internal static func isOpenedBy<Scalars: Sequence>(
+        _ scalars: Scalars
+    ) -> Bool where Scalars.Element == Unicode.Scalar {
+        var scanner = UnclosedJSONContainer()
+        for scalar in scalars {
+            guard scanner.consume(scalar) else { return false }
+        }
+        return !scanner.containers.isEmpty
+    }
+
+    private mutating func consume(_ scalar: Unicode.Scalar) -> Bool {
+        switch lexeme {
+        case .structure:
+            return consumeStructure(scalar)
+        case .string:
+            return consumeString(scalar)
+        case .escape:
+            return consumeEscape(scalar)
+        case .unicodeEscape(let remainingDigits):
+            guard scalar.properties.isASCIIHexDigit else { return false }
+            lexeme = remainingDigits > 1 ? .unicodeEscape(remainingDigits: remainingDigits - 1) : .string
+            return true
+        case .bareWord:
+            guard !Self.isBareWordScalar(scalar) else { return true }
+            lexeme = .structure
+            return consumeStructure(scalar)
+        }
+    }
+
+    private mutating func consumeString(_ scalar: Unicode.Scalar) -> Bool {
+        switch scalar {
+        case "\"":
+            lexeme = .structure
+        case "\\":
+            lexeme = .escape
+        default:
+            return scalar.value >= 0x20
+        }
+        return true
+    }
+
+    private mutating func consumeEscape(_ scalar: Unicode.Scalar) -> Bool {
+        if scalar == "u" {
+            lexeme = .unicodeEscape(remainingDigits: 4)
+            return true
+        }
+        guard Self.simpleEscapes.contains(scalar) else { return false }
+        lexeme = .string
+        return true
+    }
+
+    private mutating func consumeStructure(_ scalar: Unicode.Scalar) -> Bool {
+        guard !Self.whitespace.contains(scalar) else { return true }
+        switch expectation {
+        case .value:
+            return openValue(scalar)
+        case .valueOrClose:
+            return scalar == "]" ? close(.array) : openValue(scalar)
+        case .key:
+            return openKey(scalar)
+        case .keyOrClose:
+            return scalar == "}" ? close(.object) : openKey(scalar)
+        case .colon:
+            guard scalar == ":" else { return false }
+            expectation = .value
+            return true
+        case .separatorOrClose:
+            return separateOrClose(scalar)
+        case .nothing:
+            return false
+        }
+    }
+
+    private mutating func openValue(_ scalar: Unicode.Scalar) -> Bool {
+        switch scalar {
+        case "[":
+            containers.append(.array)
+            expectation = .valueOrClose
+        case "{":
+            containers.append(.object)
+            expectation = .keyOrClose
+        case "\"":
+            lexeme = .string
+            expectation = expectationAfterValue
+        default:
+            guard Self.isBareWordScalar(scalar) else { return false }
+            lexeme = .bareWord
+            expectation = expectationAfterValue
+    
```

**File**: `Packages/TableProCore/Tests/TableProNumberFormattingTests/NumberTextTests.swift` (modified, +27/-0)
```diff
@@ -222,4 +222,31 @@ final class NumberTextTests: XCTestCase {
         XCTAssertFalse(JSONTruncation.isIncompleteStructure("plain text..."))
         XCTAssertTrue(JSONTruncation.isIncompleteStructure(#"{"a":1, "b":"xx..."#))
     }
+
+    func testIncompleteStructureCatchesEveryCutOfAStructure() {
+        let json = #"{"deep":[[1,2],[3,[4]]],"rows":[{"id":1,"ok":true},{"id":-2.5e3,"note":null}],"#
+            + #""tags":["a","b\"c","é"],"ctl":"a\u0001b"}"#
+        let length = (json as NSString).length
+        for maxLength in 1..<length {
+            let cut = JSONTruncation.truncate(json, maxLength: maxLength)
+            XCTAssertTrue(JSONTruncation.isIncompleteStructure(cut), cut)
+        }
+        XCTAssertFalse(JSONTruncation.isIncompleteStructure(JSONTruncation.truncate(json, maxLength: length)))
+    }
+
+    func testIncompleteStructureCatchesACutRightAfterAnInnerCloser() {
+        XCTAssertTrue(JSONTruncation.isIncompleteStructure(#"[{"a":1},{"a":2}..."#))
+        XCTAssertTrue(JSONTruncation.isIncompleteStructure("[[1,2],[3,4]..."))
+    }
+
+    func testIncompleteStructureIgnoresProseThatOpensWithABracket() {
+        XCTAssertFalse(JSONTruncation.isIncompleteStructure("[DRAFT] Chapter one..."))
+        XCTAssertFalse(JSONTruncation.isIncompleteStructure("[Note: see below..."))
+        XCTAssertFalse(JSONTruncation.isIncompleteStructure("{see notes} and more..."))
+        XCTAssertFalse(JSONTruncation.isIncompleteStructure(#"{"a":1}..."#))
+    }
+
+    func testIncompleteStructureReadsBareWordsAsNumbersOrLiterals() {
+        XCTAssertTrue(JSONTruncation.isIncompleteStructure("[1,inf,-inf,nan,tr..."))
+    }
 }
```

**File**: `Plugins/ElasticsearchDriverPlugin/ElasticsearchStatementGenerator.swift` (modified, +24/-0)
```diff
@@ -6,6 +6,7 @@
 //
 
 import Foundation
+import TableProNumberFormatting
 import TableProPluginKit
 
 struct ElasticsearchWriteRequest: Equatable {
@@ -101,6 +102,9 @@ struct ElasticsearchStatementGenerator {
             }
         }
 
+        if let column = shortenedColumn(in: values) {
+            throw PluginRowWriteRefusal(rowIndex: change.rowIndex, reason: Self.shortenedValueReason(column))
+        }
         if let reason = unwritableInsertValue(in: change, values: values) {
             throw PluginRowWriteRefusal(rowIndex: change.rowIndex, reason: reason)
         }
@@ -122,6 +126,14 @@ struct ElasticsearchStatementGenerator {
         return .init(method: "POST", path: "/\(encodedIndex)/_doc\(Self.refreshQuery)", body: body)
     }
 
+    private func shortenedColumn(in values: [String: PluginCellValue]) -> String? {
+        columns.first { values[$0].map(Self.isShortened) ?? false }
+    }
+
+    private static func isShortened(_ value: PluginCellValue) -> Bool {
+        value.asText.map(JSONTruncation.isIncompleteStructure) ?? false
+    }
+
     /// A new row's leaf value reaches the server only inside its array, so one the user typed, one
     /// whose array is empty, or one that says something other than its array would be dropped.
     /// Metadata other than `_id` is the server's to set.
@@ -187,6 +199,9 @@ struct ElasticsearchStatementGenerator {
                 )
             }
             if let text = cellChange.newValue.asText {
+                guard !Self.isShortened(cellChange.newValue), !Self.isShortened(cellChange.oldValue) else {
+                    throw PluginRowWriteRefusal(rowIndex: change.rowIndex, reason: Self.shortenedValueReason(column))
+                }
                 doc[column] = jsonValue(text, for: column)
             } else {
                 doc[column] = NSNull()
@@ -218,6 +233,15 @@ struct ElasticsearchStatementGenerator {
         String(format: String(localized: "'%@' is document metadata and cannot be edited."), column)
     }
 
+    private static func shortenedValueReason(_ column: String) -> String {
+        String(
+            format: String(
+                localized: "The value in %@ is shortened for display, so saving it would store only the part shown. Change this field with a query."
+            ),
+            column
+        )
+    }
+
     private static var missingIdReason: String {
         String(localized: "The document's _id is unknown, so it cannot be addressed.")
     }
```

---

### Incident Patch 7: `0836d1fe` (2026-09-30)
**Commit Message**: fix(connection-form): keep the clipboard URL's sslmode by parsing it with the Import from URL parser (#3207)

* fix(connection-form): keep the clipboard URL's sslmode by parsing it with the Import from URL parser

* fix(connections): read ssl=1, ssl=require and ssl=0 in connection URLs

---------

Signed-off-by: Ngô Quốc Đạt <datlechin@gmail.com>

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -12,6 +12,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - SAP HANA database driver plugin. (#1966)
 - Shift JIS, EUC-JP, GB 18030, Big5, EUC-KR and UTF-16 options for CSV and SQL import.
 
+### Changed
+
+- Clipboard URL banner for every scheme Import from URL accepts, `+ssh` URLs included.
+
 ### Fixed
 
 - Save disabled for Kafka connections set to Verify Identity without a CA file.
@@ -45,6 +49,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `EXPLAIN ANALYSE` treated as a plain `EXPLAIN` that does not run its statement.
 - Safe Mode level lost when importing a connection file from Mac to iOS or from iOS to Mac.
 - Undo and Redo in a tab with unsaved edits replaying another tab's changes against the wrong rows.
+- Clipboard URL banner turning `sslmode=verify-full` or `verify-ca` into Required and ignoring `sslmode=disable`.
+- Import from URL ignoring `ssl=1`, `ssl=require` and `ssl=0`.
 - Registry plugins refused as needing a newer TablePro on releases the registry still publishes binaries for.
 - Release highlights in the update dialog run together into one paragraph.
 - Removed and Deprecated listed after Fixed in GitHub release notes.
```

**File**: `TablePro/Core/Database/ConnectionStringParser.swift` (removed, +0/-221)
```diff
@@ -1,221 +0,0 @@
-import Foundation
-
-struct ParsedConnection: Equatable {
-    let type: DatabaseType
-    let host: String
-    let port: Int
-    let username: String?
-    let password: String?
-    let database: String?
-    let useSSL: Bool
-    let rawScheme: String
-    let queryParameters: [String: String]
-}
-
-enum ConnectionStringParserError: Error, LocalizedError, Equatable {
-    case unsupportedScheme(String)
-    case malformedURL
-
-    var errorDescription: String? {
-        switch self {
-        case .unsupportedScheme(let scheme):
-            return String(format: String(localized: "Unsupported connection scheme: %@"), scheme)
-        case .malformedURL:
-            return String(localized: "The text doesn't look like a connection URL.")
-        }
-    }
-}
-
-enum ConnectionStringParser {
-    static func parse(_ string: String) throws -> ParsedConnection {
-        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
-        guard !trimmed.isEmpty else {
-            throw ConnectionStringParserError.malformedURL
-        }
-
-        guard let schemeRange = trimmed.range(of: "://") else {
-            throw ConnectionStringParserError.malformedURL
-        }
-        let rawScheme = String(trimmed[trimmed.startIndex..<schemeRange.lowerBound]).lowercased()
-
-        guard let descriptor = SchemeDescriptor.match(rawScheme: rawScheme) else {
-            throw ConnectionStringParserError.unsupportedScheme(rawScheme)
-        }
-
-        let normalized = normalizeForFoundationURL(trimmed, descriptor: descriptor)
-        guard let components = URLComponents(string: normalized) else {
-            throw ConnectionStringParserError.malformedURL
-        }
-
-        let host = components.host ?? ""
-        guard !host.isEmpty else {
-            throw ConnectionStringParserError.malformedURL
-        }
-        let port: Int
-        if let explicit = components.port {
-            guard (1...65_535).contains(explicit) else {
-                throw ConnectionStringParserError.malformedURL
-            }
-            port = explicit
-        } else if rawScheme == "mongodb+srv" {
-            port = 0
-        } else {
-            port = descriptor.defaultPort
-        }
-
-        let username = components.user.flatMap { $0.removingPercentEncoding ?? $0 }
-        let password = components.password.flatMap { $0.removingPercentEncoding ?? $0 }
-
-        let path = components.path
-        let database: String?
-        if path.isEmpty || path == "/" {
-            database = nil
-        } else {
-            let trimmedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
-            database = trimmedPath.isEmpty ? nil : trimmedPath
-        }
-
-        let queryParameters = decodeQueryItems(components.queryItems)
-        let useSSL = resolveUseSSL(
-            descriptor: descriptor,
-            queryParameters: queryParameters
-        )
-
-        return ParsedConnection(
-            type: descriptor.databaseType,
-            host: host,
-            port: port,
-            username: username?.nilIfEmpty,
-            password: password?.nilIfEmpty,
-            database: database,
-            useSSL: useSSL,
-            rawScheme: rawScheme,
-            queryParameters: queryParameters
-        )
-    }
-
-    // MARK: - Helpers
-
-    private static func decodeQueryItems(_ items: [URLQueryItem]?) -> [String: String] {
-        var result: [String: String] = [:]
-        guard let items else { return result }
-        for item in items {
-            guard let value = item.value else { continue }
-            let decoded = value.removingPercentEncoding ?? value
-            result[item.name] = decoded
-        }
-        return result
-    }
-
-    private static func resolveUseSSL(
-        descriptor: SchemeDescriptor,
-        queryParameters: [String: String]
-    ) -> Bool {
-        if descriptor.forcesSSL { return true }
-
-        if descriptor.datab
```

**File**: `TablePro/Core/Utilities/Connection/ClipboardConnectionCandidate.swift` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+//
+//  ClipboardConnectionCandidate.swift
+//  TablePro
+//
+
+import Foundation
+
+struct ClipboardConnectionCandidate {
+    let scheme: String
+    let parsed: ParsedConnectionURL
+
+    init?(clipboardText: String) {
+        let firstLine = clipboardText
+            .components(separatedBy: .newlines)
+            .first?
+            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
+        guard let schemeEnd = firstLine.range(of: "://"),
+              case .success(let parsed) = ConnectionURLParser.parse(firstLine),
+              !parsed.host.isEmpty
+        else { return nil }
+        self.scheme = firstLine[firstLine.startIndex..<schemeEnd.lowerBound].lowercased()
+        self.parsed = parsed
+    }
+}
```

**File**: `TablePro/Core/Utilities/Connection/ConnectionURLParser.swift` (modified, +2/-2)
```diff
@@ -687,10 +687,10 @@ struct ConnectionURLParser {
             }
         case "tls", "ssl":
             switch value.lowercased() {
-            case "true":
+            case "true", "1", "require", "required":
                 ext.requestsTLS = true
                 ext.disablesTLS = false
-            case "false":
+            case "false", "0":
                 ext.disablesTLS = true
                 ext.requestsTLS = false
             default:
```

**File**: `TablePro/Resources/Localizable.xcstrings` (modified, +0/-68)
```diff
@@ -162638,40 +162638,6 @@
         }
       }
     },
-    "The text doesn't look like a connection URL." : {
-      "localizations" : {
-        "ko" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "텍스트가 연결 URL 형식이 아닙니다."
-          }
-        },
-        "tr" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Metin bir bağlantı URL'sine benzemiyor."
-          }
-        },
-        "vi" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Văn bản này không giống một URL kết nối."
-          }
-        },
-        "zh-Hans" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "该文本看起来不是连接 URL。"
-          }
-        },
-        "zh-Hant" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "這段文字看起來不像連線 URL。"
-          }
-        }
-      }
-    },
     "The text is not valid JSON. Save anyway?" : {
       "localizations" : {
         "ko" : {
@@ -173134,40 +173100,6 @@
         }
       }
     },
-    "Unsupported connection scheme: %@" : {
-      "localizations" : {
-        "ko" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "지원되지 않는 연결 스킴: %@"
-          }
-        },
-        "tr" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Desteklenmeyen bağlantı şeması: %@"
-          }
-        },
-        "vi" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "Scheme kết nối không được hỗ trợ: %@"
-          }
-        },
-        "zh-Hans" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "不支持的连接协议：%@"
-          }
-        },
-        "zh-Hant" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "不支援的連線協定：%@"
-          }
-        }
-      }
-    },
     "Unsupported database scheme: %@" : {
       "localizations" : {
         "ko" : {
```

---

### Incident Patch 8: `00b17ba8` (2026-09-30)
**Commit Message**: fix(plugin-redis): check the server hostname under Verify Identity on macOS and iOS (#3206)

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -70,6 +70,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Tunnel command preview showing port 0 or the wrong host when Port is blank or the connection uses a host list.
 - SSH tab host-list warning naming replica set failover for Redis and Kafka, and implying Sentinel works through a tunnel.
 
+### Security
+
+- Redis Verify Identity accepting a server certificate issued for another host.
+
 ## [0.76.1] - 2026-09-29
 
 ### Changed
```

**File**: `Packages/TableProCore/Package.swift` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@ let package = Package(
         .library(name: "TableProTeradataCore", targets: ["TableProTeradataCore"]),
         .library(name: "TableProTrinoCore", targets: ["TableProTrinoCore"]),
         .library(name: "TableProTLSClientIdentity", targets: ["TableProTLSClientIdentity"]),
+        .library(name: "TableProTLSTestFixtures", targets: ["TableProTLSTestFixtures"]),
         .library(name: "TableProGoogleCloud", targets: ["TableProGoogleCloud"]),
         .library(name: "TableProSpannerCore", targets: ["TableProSpannerCore"]),
         .library(name: "TableProWeaviateCore", targets: ["TableProWeaviateCore"]),
```

**File**: `Plugins/RedisDriverPlugin/CRedis/CRedis.h` (modified, +1/-0)
```diff
@@ -11,5 +11,6 @@
 
 #include "include/hiredis/hiredis.h"
 #include "include/hiredis/hiredis_ssl.h"
+#include "include/openssl_tls_client.h"
 
 #endif /* CRedis_h */
```

**File**: `Plugins/RedisDriverPlugin/CRedis/include/openssl_tls_client.h` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+#ifndef OPENSSL_TLS_CLIENT_H
+#define OPENSSL_TLS_CLIENT_H
+
+typedef struct ssl_st SSL;
+typedef struct ssl_ctx_st SSL_CTX;
+typedef struct ssl_method_st SSL_METHOD;
+typedef struct x509_store_ctx_st X509_STORE_CTX;
+typedef int (*SSL_verify_cb)(int preverify_ok, X509_STORE_CTX *x509_ctx);
+
+#define SSL_FILETYPE_PEM 1
+#define SSL_CTRL_SET_TLSEXT_HOSTNAME 55
+#define SSL_CTRL_SET_MIN_PROTO_VERSION 123
+#define TLSEXT_NAMETYPE_host_name 0
+#define TLS1_2_VERSION 0x0303
+#define X509_V_ERR_HOSTNAME_MISMATCH 62
+#define X509_V_ERR_IP_ADDRESS_MISMATCH 64
+
+const SSL_METHOD *TLS_client_method(void);
+SSL_CTX *SSL_CTX_new(const SSL_METHOD *meth);
+void SSL_CTX_free(SSL_CTX *ctx);
+long SSL_CTX_ctrl(SSL_CTX *ctx, int cmd, long larg, void *parg);
+void SSL_CTX_set_verify(SSL_CTX *ctx, int mode, SSL_verify_cb callback);
+int SSL_CTX_load_verify_locations(SSL_CTX *ctx, const char *CAfile, const char *CApath);
+int SSL_CTX_set_default_verify_paths(SSL_CTX *ctx);
+int SSL_CTX_use_certificate_chain_file(SSL_CTX *ctx, const char *file);
+int SSL_CTX_use_PrivateKey_file(SSL_CTX *ctx, const char *file, int type);
+SSL *SSL_new(SSL_CTX *ctx);
+void SSL_free(SSL *ssl);
+long SSL_ctrl(SSL *ssl, int cmd, long larg, void *parg);
+int SSL_set1_host(SSL *s, const char *hostname);
+long SSL_get_verify_result(const SSL *ssl);
+const char *X509_verify_cert_error_string(long n);
+
+#endif
```

**File**: `Plugins/RedisDriverPlugin/RedisPluginConnection.swift` (modified, +11/-71)
```diff
@@ -31,7 +31,6 @@ final class RedisPluginConnection: RedisCommandChannel, @unchecked Sendable {
     }()
 
     private var context: UnsafeMutablePointer<redisContext>?
-    private var sslContext: OpaquePointer?
     #endif
 
     private let queue = DispatchQueue(label: "com.TablePro.redis.plugin", qos: .userInitiated)
@@ -120,18 +119,12 @@ final class RedisPluginConnection: RedisCommandChannel, @unchecked Sendable {
         #if canImport(CRedis)
         stateLock.lock()
         let handle = context
-        let ssl = sslContext
         context = nil
-        sslContext = nil
         stateLock.unlock()
 
         // Dispatch cleanup to the serial queue to ensure in-flight commands complete first
-        if handle != nil || ssl != nil {
-            let cleanupQueue = queue
-            cleanupQueue.async {
-                if let handle { redisFree(handle) }
-                if let ssl { redisFreeSSLContext(ssl) }
-            }
+        if let handle {
+            queue.async { redisFree(handle) }
         }
         #endif
     }
@@ -167,9 +160,7 @@ final class RedisPluginConnection: RedisCommandChannel, @unchecked Sendable {
         stateLock.lock()
         #if canImport(CRedis)
         let handle = context
-        let ssl = sslContext
         context = nil
-        sslContext = nil
         #endif
         _isConnected = false
         _cachedServerVersion = nil
@@ -178,16 +169,8 @@ final class RedisPluginConnection: RedisCommandChannel, @unchecked Sendable {
         stateLock.unlock()
 
         #if canImport(CRedis)
-        let cleanupQueue = queue
-        if handle != nil || ssl != nil {
-            cleanupQueue.async {
-                if let handle = handle {
-                    redisFree(handle)
-                }
-                if let ssl = ssl {
-                    redisFreeSSLContext(ssl)
-                }
-            }
+        if let handle {
+            queue.async { redisFree(handle) }
         }
         #endif
     }
@@ -397,52 +380,12 @@ extension RedisPluginConnection: RedisClusterNodeConnection {}
 
 #if canImport(CRedis)
 private extension RedisPluginConnection {
-    func connectSSL(_ ctx: UnsafeMutablePointer<redisContext>) throws {
-        var sslError = redisSSLContextError(0)
-
-        let useCaCert = sslConfig.verifiesCertificate && !sslConfig.caCertificatePath.isEmpty
-        let caCert: UnsafePointer<CChar>? = useCaCert
-            ? (sslConfig.caCertificatePath as NSString).utf8String
-            : nil
-        let clientCert: UnsafePointer<CChar>? = sslConfig.clientCertificatePath.isEmpty
-            ? nil
-            : (sslConfig.clientCertificatePath as NSString).utf8String
-        let clientKey: UnsafePointer<CChar>? = sslConfig.clientKeyPath.isEmpty
-            ? nil
-            : (sslConfig.clientKeyPath as NSString).utf8String
-        let sniHostname: UnsafePointer<CChar>? = sslConfig.isEnabled
-            ? (host as NSString).utf8String
-            : nil
-
-        var options = redisSSLOptions()
-        options.cacert_filename = caCert
-        options.capath = nil
-        options.cert_filename = clientCert
-        options.private_key_filename = clientKey
-        options.server_name = sniHostname
-        options.verify_mode = sslConfig.verifiesCertificate
-            ? REDIS_SSL_VERIFY_PEER
-            : REDIS_SSL_VERIFY_NONE
-
-        guard let ssl = redisCreateSSLContextWithOptions(&options, &sslError) else {
-            let errCode = Int(sslError.rawValue)
-            throw RedisPluginError(
-                code: errCode,
-                message: "Failed to create SSL context (error \(errCode))"
-            )
-        }
-
-        let result = redisInitiateSSLWithContext(ctx, ssl)
-        if result != REDIS_OK {
-            redisFreeSSLContext(ssl)
-            let errMsg = Self.contextErrorMessage(ctx)
-            if let sslError = RedisSSLClassifier.classifySSLError(errMsg) {
-                throw sslError
-            }
-     
```

---

### Incident Patch 9: `cca8dfa9` (2026-09-30)
**Commit Message**: fix(release): each plugin publish overwrites minAppVersion and blocks older apps (#3202)

* fix(release): keep a registry entry's minAppVersion at its oldest retained binary's

* fix(release): require the PluginKit retention count in update-registry.py

* ci(release): fail Repo Hygiene when currentPluginKitVersion moves twice in one release cycle

* fix(release): put each release highlight in its own Markdown paragraph

* fix(release): order GitHub release note sections the way Keep a Changelog does

* fix(release): require the architecture in create-dmg.sh and take its bundle from build-release.sh

---------

Signed-off-by: Ngô Quốc Đạt <datlechin@gmail.com>

**File**: `.github/scripts/test_update_registry.py` (modified, +141/-2)
```diff
@@ -3,8 +3,12 @@
 
 Run: python3 .github/scripts/test_update_registry.py
 """
+import contextlib
 import importlib.util
+import io
 import os
+import sys
+from unittest import mock
 
 _spec = importlib.util.spec_from_file_location(
     "update_registry",
@@ -83,7 +87,7 @@ class Args:
     assert all(update_registry.kit_version(b) is not None for b in entry["binaries"])
 
 
-def _args(version, pkv, keep=2):
+def _args(version, pkv, keep=2, min_app_version="0.43.0"):
     class Args:
         id = "com.TablePro.DynamoDBDriverPlugin"
         name = "DynamoDB"
@@ -93,14 +97,14 @@ class Args:
         arm64_sha = "a"
         x86_64_url = "https://x/x86_64"
         x86_64_sha = "b"
-        min_app_version = "0.43.0"
         icon = "icon"
         homepage = "https://tablepro.app"
         category = "database-driver"
 
     Args.version = version
     Args.plugin_kit_version = pkv
     Args.keep_kit_versions = keep
+    Args.min_app_version = min_app_version
     return Args
 
 
@@ -169,6 +173,133 @@ def test_publishing_below_the_retained_window_refuses():
         raise AssertionError("expected SystemExit when the new binary would be pruned away")
 
 
+def _entry(manifest):
+    return next(p for p in manifest["plugins"] if p["id"] == "com.TablePro.DynamoDBDriverPlugin")
+
+
+def test_min_app_version_admits_the_oldest_retained_binary():
+    manifest = {"schemaVersion": 2, "plugins": []}
+    manifest = update_registry.update_plugin_entry(
+        manifest, _args("1.0.16", 25, keep=3, min_app_version="0.73.0")
+    )
+    manifest = update_registry.update_plugin_entry(
+        manifest, _args("1.0.17", 33, keep=3, min_app_version="0.76.1")
+    )
+    entry = _entry(manifest)
+    assert entry["minAppVersion"] == "0.73.0", entry["minAppVersion"]
+    assert {
+        (update_registry.kit_version(b), b["minAppVersion"]) for b in entry["binaries"]
+    } == {(25, "0.73.0"), (33, "0.76.1")}, entry["binaries"]
+
+    manifest = update_registry.update_plugin_entry(
+        manifest, _args("1.0.18", 33, keep=3, min_app_version="0.76.1")
+    )
+    assert _entry(manifest)["minAppVersion"] == "0.73.0", _entry(manifest)["minAppVersion"]
+
+
+def test_min_app_version_compares_numerically():
+    manifest = {"schemaVersion": 2, "plugins": []}
+    manifest = update_registry.update_plugin_entry(
+        manifest, _args("1.0.16", 25, keep=3, min_app_version="0.9.0")
+    )
+    manifest = update_registry.update_plugin_entry(
+        manifest, _args("1.0.17", 33, keep=3, min_app_version="0.10.0")
+    )
+    assert _entry(manifest)["minAppVersion"] == "0.9.0", _entry(manifest)["minAppVersion"]
+
+
+def test_min_app_version_rises_once_the_oldest_binary_is_evicted():
+    manifest = {"schemaVersion": 2, "plugins": []}
+    for pkv, app in ((25, "0.73.0"), (30, "0.74.0"), (32, "0.75.0"), (33, "0.76.1")):
+        manifest = update_registry.update_plugin_entry(
+            manifest, _args("1.0.16", pkv, keep=3, min_app_version=app)
+        )
+    entry = _entry(manifest)
+    assert sorted({update_registry.kit_version(b) for b in entry["binaries"]}) == [30, 32, 33]
+    assert entry["minAppVersion"] == "0.74.0", entry["minAppVersion"]
+
+
+def test_republishing_a_kit_never_raises_its_minimum_app_version():
+    manifest = {"schemaVersion": 2, "plugins": []}
+    for pkv, app in ((33, "0.76.0"), (33, "0.76.1"), (34, "0.77.0"), (35, "0.78.0")):
+        manifest = update_registry.update_plugin_entry(
+            manifest, _args("1.0.16", pkv, keep=3, min_app_version=app)
+        )
+    entry = _entry(manifest)
+    assert entry["minAppVersion"] == "0.76.0", entry["minAppVersion"]
+    assert sorted(
+        b["minAppVersion"] for b in entry["binaries"] if update_registry.kit_version(b) == 33
+    ) == ["0.76.0", "0.76.0"], entry["binaries"]
+
+
+def test_republishing_a_kit_never_raises_it_over_a_binary_without_its_own_value():
+    manifest = _manifest(33)
+    _entry(manifest)["minAppVersion"] = "0.76.0"
+    manifest = update_regis
```

**File**: `.github/scripts/update-registry.py` (modified, +37/-5)
```diff
@@ -7,13 +7,17 @@
   - Preserves binaries for other PluginKit versions (up to --keep-kit-versions)
   - Drops binaries for PluginKit versions older than (newest - keep + 1)
   - Updates plugin-level metadata (name, summary, etc.) from the newest binary set
+  - Records minAppVersion on each new binary and sets the entry's minAppVersion to the lowest
+    across the retained binaries. Binaries on one PluginKit version share one ABI, so republishing
+    a kit keeps the lowest minAppVersion that kit already carried rather than raising it
   - Sets schemaVersion to 2
   - Writes atomically via a temp file + rename
 """
 
 import argparse
 import json
 import os
+import re
 import sys
 import tempfile
 
@@ -37,7 +41,7 @@ def parse_args():
     parser.add_argument("--plugin-kit-version", required=True, type=int)
     parser.add_argument(
         "--keep-kit-versions",
-        default=2,
+        required=True,
         type=int,
         help="Number of distinct PluginKit versions to retain per plugin. Oldest dropped first.",
     )
@@ -88,29 +92,55 @@ def prune_old_kit_versions(binaries, keep_count):
     return [b for b in typed if kit_version(b) in versions_to_keep]
 
 
+def app_version_key(version):
+    return tuple(int(part) for part in re.findall(r"\d+", version))
+
+
+def kit_min_app_version(existing_entry, pkv, requested):
+    if existing_entry is None:
+        return requested
+    previous_entry_value = existing_entry.get("minAppVersion")
+    carried = [
+        b.get("minAppVersion") or previous_entry_value
+        for b in existing_entry.get("binaries", [])
+        if kit_version(b) == pkv
+    ]
+    return min([requested, *filter(None, carried)], key=app_version_key)
+
+
+def entry_min_app_version(binaries, previous_entry_value):
+    candidates = [b["minAppVersion"] for b in binaries if b.get("minAppVersion")]
+    if previous_entry_value and any(not b.get("minAppVersion") for b in binaries):
+        candidates.append(previous_entry_value)
+    return min(candidates, key=app_version_key)
+
+
 def update_plugin_entry(manifest, args):
     bundle_id = args.id
     db_type_ids = json.loads(args.db_type_ids)
     pkv = args.plugin_kit_version
 
+    existing_plugins = manifest.get("plugins", [])
+    existing_entry = next((p for p in existing_plugins if p["id"] == bundle_id), None)
+    min_app_version = kit_min_app_version(existing_entry, pkv, args.min_app_version)
+
     new_binaries = [
         {
             "architecture": "arm64",
             "pluginKitVersion": pkv,
             "downloadURL": args.arm64_url,
             "sha256": args.arm64_sha,
+            "minAppVersion": min_app_version,
         },
         {
             "architecture": "x86_64",
             "pluginKitVersion": pkv,
             "downloadURL": args.x86_64_url,
             "sha256": args.x86_64_sha,
+            "minAppVersion": min_app_version,
         },
     ]
 
-    existing_plugins = manifest.get("plugins", [])
-    existing_entry = next((p for p in existing_plugins if p["id"] == bundle_id), None)
-
     if existing_entry is not None:
         surviving = [
             b for b in existing_entry.get("binaries", [])
@@ -131,6 +161,8 @@ def update_plugin_entry(manifest, args):
             f"publishing would advertise {args.version} with no binary for it"
         )
 
+    previous_min_app_version = existing_entry.get("minAppVersion") if existing_entry else None
+
     updated_entry = {
         "id": bundle_id,
         "name": args.name,
@@ -142,7 +174,7 @@ def update_plugin_entry(manifest, args):
         "databaseTypeIds": db_type_ids,
         "iconName": args.icon,
         "isVerified": True,
-        "minAppVersion": args.min_app_version,
+        "minAppVersion": entry_min_app_version(merged_binaries, previous_min_app_version),
         "binaries": merged_binaries,
     }
 
```

**File**: `.github/workflows/repo-hygiene.yml` (modified, +12/-0)
```diff
@@ -139,6 +139,15 @@ jobs:
       - name: Validate the registry update script
         run: python3 .github/scripts/test_update_registry.py
 
+      # Only the kit version a release tags ever ships, and the registry keeps binaries for three,
+      # so a second bump in one release cycle drops an older release out of that window for nothing.
+      # The checkout is shallow and carries no tags, so the check lists them on origin itself.
+      - name: Check currentPluginKitVersion moved at most once since the last release
+        run: python3 scripts/ci/check-pluginkit-bump-cadence.py --remote origin
+
+      - name: Validate the PluginKit bump cadence check
+        run: python3 scripts/ci/test_check_pluginkit_bump_cadence.py
+
       # The macOS suite cannot catch this one: the script runs before any test does, and when it
       # gets this wrong no test runs at all. An empty quarantine list made it print a blank line,
       # which the caller turned into an empty xcodebuild argument, and main went red for three
@@ -149,6 +158,9 @@ jobs:
       - name: Validate release note extraction
         run: python3 scripts/ci/test_release_notes.py
 
+      - name: Validate the DMG script's arguments
+        run: bash scripts/ci/test_create_dmg_args.sh
+
       - name: Validate changelog contributor credits
         run: python3 scripts/ci/test_changelog_credits.py
 
```

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -45,6 +45,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `EXPLAIN ANALYSE` treated as a plain `EXPLAIN` that does not run its statement.
 - Safe Mode level lost when importing a connection file from Mac to iOS or from iOS to Mac.
 - Undo and Redo in a tab with unsaved edits replaying another tab's changes against the wrong rows.
+- Registry plugins refused as needing a newer TablePro on releases the registry still publishes binaries for.
+- Release highlights in the update dialog run together into one paragraph.
+- Removed and Deprecated listed after Fixed in GitHub release notes.
 - PostgreSQL 18 virtual generated columns written without their expression in Show DDL, Copy DDL and SQL export.
 - Empty Check Constraints tab and no check constraints in MCP `describe_table` on CockroachDB.
 - Connect errors a server answered through PGlite, such as a missing database, reported as an unreachable socket server.
```

**File**: `scripts/ci/check-pluginkit-bump-cadence.py` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
+#!/usr/bin/env python3
+"""Fail when currentPluginKitVersion has moved more than one past the newest release tag.
+
+Only the value at release time ever ships, so every PluginKit change in one release cycle reuses
+the number the first one took. The registry keeps binaries for the three newest kit versions, and
+each extra bump pushes one more shipped release out of that window: v0.74.0 shipped kit 30, two
+bumps before v0.75.0 took main to 32, and the next registry publish at kit 33 kept 31 to 33, which
+left v0.74.0 with nothing to install.
+
+The newest release is the highest vX.Y.Z tag by version number. With --remote the tag list comes
+from that remote and the one tag is fetched when it is missing, so a shallow CI checkout with no tags
+works. The fetch is at depth 1 only in a checkout that is already shallow: in a full clone it would
+cut the history every worktree shares down to that one commit.
+test_check_pluginkit_bump_cadence.py pins what it must and must not report.
+"""
+
+from __future__ import annotations
+
+import argparse
+import re
+import subprocess
+import sys
+from pathlib import Path
+
+ROOT = Path(__file__).resolve().parents[2]
+PLUGIN_MANAGER = "TablePro/Core/Plugins/PluginManager.swift"
+KIT_DECLARATION = re.compile(r"\bstatic\s+let\s+currentPluginKitVersion\s*=\s*(\d+)\b")
+RELEASE_TAG = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")
+
+
+def git(repo: Path, *args: str) -> str:
+    result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)
+    if result.returncode != 0:
+        raise SystemExit(f"ERROR: git {' '.join(args)} failed: {result.stderr.strip()}")
+    return result.stdout
+
+
+def kit_version(source: str, origin: str) -> int:
+    match = KIT_DECLARATION.search(source)
+    if match is None:
+        raise SystemExit(f"ERROR: no currentPluginKitVersion declaration in {origin}")
+    return int(match.group(1))
+
+
+def newest_release_tag(names: list[str]) -> str | None:
+    releases = [
+        (tuple(int(part) for part in match.groups()), name)
+        for name in names
+        if (match := RELEASE_TAG.match(name))
+    ]
+    return max(releases)[1] if releases else None
+
+
+def local_tag_names(repo: Path) -> list[str]:
+    return git(repo, "tag", "--list", "v*").split()
+
+
+def remote_tag_names(repo: Path, remote: str) -> list[str]:
+    output = git(repo, "ls-remote", "--tags", "--refs", remote, "refs/tags/v*")
+    return [line.split("refs/tags/", 1)[1] for line in output.splitlines() if "refs/tags/" in line]
+
+
+def has_commit(repo: Path, ref: str) -> bool:
+    result = subprocess.run(
+        ["git", "-C", str(repo), "rev-parse", "--quiet", "--verify", f"{ref}^{{commit}}"],
+        capture_output=True,
+    )
+    return result.returncode == 0
+
+
+def fetch_tag(repo: Path, remote: str, tag: str) -> None:
+    if has_commit(repo, f"refs/tags/{tag}"):
+        return
+    shallow = git(repo, "rev-parse", "--is-shallow-repository").strip() == "true"
+    depth = ["--depth=1"] if shallow else []
+    git(repo, "fetch", "--quiet", "--no-tags", *depth, remote, f"+refs/tags/{tag}:refs/tags/{tag}")
+
+
+def cadence_violation(tag: str, released: int, current: int) -> str | None:
+    if current <= released + 1:
+        return None
+    return (
+        f"currentPluginKitVersion is {current}, but {tag} shipped {released}. It moves at most once "
+        f"per release cycle, so every PluginKit change until the next release reuses {released + 1}."
+    )
+
+
+def main(argv: list[str] | None = None) -> int:
+    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
+    parser.add_argument("--repo", type=Path, default=ROOT)
+    parser.add_argument("--remote", help="read the release tags from this remote and fetch the newest")
+    args = parser.parse_args(argv)
+
+    names = remote_tag_names(args.repo, args.remote) if args.remote else local_tag_names(args.repo)
+    tag = newest_release_tag(names)
+    if tag is None:
+  
```

---

### Incident Patch 10: `b78af539` (2026-09-30)
**Commit Message**: fix(plugin-postgresql): PostgreSQL 18 VIRTUAL generated columns lose their expression in DDL (#3199)

* fix(plugin-postgresql): write PostgreSQL 18 virtual generated columns with their expression in table DDL

* fix(plugin-postgresql): fetch CockroachDB check constraints through the shared libpq driver extension

* fix(plugin-postgresql): keep the server's own connect error on PGlite instead of reporting an unreachable socket server

* fix(plugin-postgresql): offer and send REINDEX VERBOSE only on PostgreSQL 9.5 and later, at table and database scope

* fix(plugin-postgresql): let PGlite reorder columns through the PostgreSQL rebuild script

* fix(connection-form): name the ~/.pgpass toggle the same on PostgreSQL, Redshift and CockroachDB

---------

Signed-off-by: Ngô Quốc Đạt <datlechin@gmail.com>

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -45,6 +45,12 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `EXPLAIN ANALYSE` treated as a plain `EXPLAIN` that does not run its statement.
 - Safe Mode level lost when importing a connection file from Mac to iOS or from iOS to Mac.
 - Undo and Redo in a tab with unsaved edits replaying another tab's changes against the wrong rows.
+- PostgreSQL 18 virtual generated columns written without their expression in Show DDL, Copy DDL and SQL export.
+- Empty Check Constraints tab and no check constraints in MCP `describe_table` on CockroachDB.
+- Connect errors a server answered through PGlite, such as a missing database, reported as an unreachable socket server.
+- REINDEX VERBOSE offered on PostgreSQL 9.1 to 9.4, where it fails, and ignored when reindexing a whole database.
+- PGlite saying it cannot change the order of a table's columns.
+- `Use ~/.pgpass` toggle named `Use Password File` on Redshift and CockroachDB.
 - etcd `(root)` Delete and Truncate erasing the whole Key Prefix Root, and a root with no trailing `/` reaching sibling keys.
 - etcd commands and saved edits reaching a different key when the key starts with a combining mark.
 - Elasticsearch, Typesense and SurrealDB table exports cutting arrays and objects over 10,000 characters into unreadable JSON.
```

**File**: `Plugins/PostgreSQLDriverPlugin/LibPQDriverCore.swift` (modified, +18/-0)
```diff
@@ -290,6 +290,24 @@ extension LibPQBackedDriver {
         )
     }
 
+    func fetchCheckConstraints(table: String, schema: String?) async throws -> [PluginCheckConstraintInfo] {
+        let query = PostgreSQLSchemaQueries.checkConstraintsQuery(
+            schema: schema ?? core.currentSchema,
+            table: table
+        )
+        let result = try await execute(query: query)
+        return result.rows.compactMap { row in
+            guard let name = row[safe: 0]?.asText,
+                  let definition = row[safe: 1]?.asText else { return nil }
+            return PluginCheckConstraintInfo(
+                name: name,
+                expression: PostgreSQLCheckConstraintDefinition.expression(fromConstraintDef: definition),
+                columns: PostgreSQLTextArray.values(row[safe: 3]?.asText),
+                isValidated: PostgreSQLCatalogBoolean.isTrue(row[safe: 2]?.asText)
+            )
+        }
+    }
+
     func connect() async throws {
         try await core.connect()
     }
```

**File**: `Plugins/PostgreSQLDriverPlugin/PGliteConnectFailure.swift` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+//
+//  PGliteConnectFailure.swift
+//  PostgreSQLDriverPlugin
+//
+
+import Foundation
+import TableProPluginKit
+
+enum PGliteConnectFailure {
+    private static let serverSeverityMarkers = ["FATAL:", "PANIC:", "ERROR:"]
+
+    static func presented(_ underlying: Error, host: String, port: Int) -> Error {
+        guard let failure = transportFailure(underlying) else { return underlying }
+        let template = String(
+            localized: "Can't reach a PGlite socket server at %@:%d. Start it with 'npx @electric-sql/pglite-socket', then try again."
+        )
+        return PGliteConnectionError(
+            pluginErrorMessage: String(format: template, host, port),
+            pluginErrorDetail: failure.message.isEmpty ? nil : failure.message
+        )
+    }
+
+    private static func transportFailure(_ error: Error) -> LibPQPluginError? {
+        guard let libpqError = error as? LibPQPluginError else { return nil }
+        let serverAnswered = serverSeverityMarkers.contains { libpqError.message.contains($0) }
+        return serverAnswered ? nil : libpqError
+    }
+}
+
+struct PGliteConnectionError: PluginDriverError {
+    let pluginErrorMessage: String
+    let pluginErrorDetail: String?
+}
```

**File**: `Plugins/PostgreSQLDriverPlugin/PGlitePluginDriver.swift` (modified, +1/-17)
```diff
@@ -32,23 +32,7 @@ final class PGlitePluginDriver: PostgreSQLPluginDriver {
         } catch is CancellationError {
             throw CancellationError()
         } catch {
-            throw Self.connectError(underlying: error, host: connectHost, port: connectPort)
+            throw PGliteConnectFailure.presented(error, host: connectHost, port: connectPort)
         }
     }
-
-    private static func connectError(underlying: Error, host: String, port: Int) -> Error {
-        let reason = (underlying as? LibPQPluginError)?.message ?? underlying.localizedDescription
-        let template = String(
-            localized: "Can't reach a PGlite socket server at %@:%d. Start it with 'npx @electric-sql/pglite-socket', then try again."
-        )
-        return PGliteConnectionError(
-            pluginErrorMessage: String(format: template, host, port),
-            pluginErrorDetail: reason.isEmpty ? nil : reason
-        )
-    }
-}
-
-struct PGliteConnectionError: PluginDriverError {
-    let pluginErrorMessage: String
-    let pluginErrorDetail: String?
 }
```

**File**: `Plugins/PostgreSQLDriverPlugin/PostgreSQLCapabilities.swift` (modified, +1/-0)
```diff
@@ -52,6 +52,7 @@ nonisolated struct PostgreSQLCapabilities: Sendable, Equatable {
     var hasSpGistIndexes: Bool { serverVersion >= 90_200 }
     var hasCreateSchemaIfNotExists: Bool { serverVersion >= 90_300 }
     var hasBrinIndexes: Bool { serverVersion >= 90_500 }
+    var hasReindexOptions: Bool { serverVersion >= 90_500 }
     /// `INCLUDE` columns and the `indnkeyatts` count that tells them from key columns landed in 11.
     var hasCoveringIndexes: Bool { serverVersion >= 110_000 }
     var hasExecuteFunctionTriggerSyntax: Bool { serverVersion >= 110_000 }
```

#### Recent Merged Pull Requests:
- **PR #3225** (2026-09-30): fix(plugins): restore the main build after #3205 and #3208 changed the same cell text API (@datlechin)
- **PR #3224** (2026-09-30): fix(ios): Shortcuts Add Row rejects any CSV with CRLF line endings (@datlechin)
- **PR #3214** (2026-09-30): fix(ios): read an unrecognized Safe Mode level from iCloud as Confirm Writes, not Off (@datlechin)
- **PR #3210** (2026-09-30): fix(sync): keep Local only connections' favorites, saved queries and layouts off iCloud (@datlechin)
- **PR #3208** (2026-09-30): fix(plugins): refuse saving an Elasticsearch, Typesense or SurrealDB value shortened for display (@datlechin)
- **PR #3207** (2026-09-30): fix(connection-form): keep the clipboard URL's sslmode by parsing it with the Import from URL parser (@datlechin)
- **PR #3206** (2026-09-30): fix(plugin-redis): check the server hostname under Verify Identity on macOS and iOS (@datlechin)
- **PR #3205** (2026-09-30): fix(plugins): keep long arrays and objects whole in Elasticsearch, Typesense and SurrealDB table exports (@datlechin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
