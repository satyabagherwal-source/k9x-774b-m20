# Forensic Learning Record (Deep Inspection): rqlite/rqlite

> **Canonical Artifact**: `07_PROJECT_LEARNING/rqlite-rqlite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rqlite/rqlite](https://github.com/rqlite/rqlite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:01:04.173Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rqlite/rqlite`
- **Description**: The lightweight, fault-tolerant database built on SQLite. Designed to keep your data highly available with minimal effort.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 17783 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/rqbench/queued_http.go`
```
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// QueuedHTTPTester represents an HTTP transport tester that uses
// queued writes
type QueuedHTTPTester struct {
	client  http.Client
	url     string
	waitURL string
	br      *bytes.Reader
}

// NewQueuedHTTPTester returns an instantiated HTTP tester.
func NewQueuedHTTPTester(addr, path string) *QueuedHTTPTester {
	return &QueuedHTTPTester{
		client:  http.Client{},
		url:     fmt.Sprintf("http://%s%s?queue", addr, path),
		waitURL: fmt.Sprintf("http://%s%s?queue&wait", addr, path),
	}
}

// String returns a string representation of the tester.
func (h *QueuedHTTPTester) String() string {
	return h.url
}

// Prepare prepares the tester for execution.
func (h *QueuedHTTPTester) Prepare(stmt string, bSz int, _ bool) error {
	s := make([]string, bSz)
	for i := range s {
		s[i] = stmt
	}

	b, err := json.Marshal(s)
	if err != nil {
		return err
	}
	h.br = bytes.NewReader(b)

	return nil
}

// Once executes a single test request.
func (h *QueuedHTTPTester) Once() (time.Duration, error) {
	h.br.Seek(0, io.SeekStart)

	start := time.Now()
	resp, err := h.client.Post(h.url, "application/json", h.br)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	_, err = io.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("received %s", resp.Status)
	}
	dur := time.Since(start)

	return dur, nil
}

// Close closes the tester
func (h *QueuedHTTPTester) Close() error {
	start := time.Now()
	resp, err := h.client.Post(h.waitURL, "application/json", h.br)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Close() received %s", resp.Status)
	}
	fmt.Println("Queued tester wait request took", time.Since(start))
	return nil
}

```

### Core Architecture Module: `db/state.go`
```
package db

import (
	"compress/gzip"
	"context"
	"database/sql"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/mattn/go-sqlite3"
	command "github.com/rqlite/rqlite/v10/command/proto"
	"github.com/rqlite/rqlite/v10/internal/fsutil"
	"github.com/rqlite/rqlite/v10/internal/random"
)

const (
	// ModeReadOnly is the mode to open a database in read-only mode.
	ModeReadOnly = true
	// ModeReadWrite is the mode to open a database in read-write mode.
	ModeReadWrite = false
)

var (
	// ErrWALReplayDirectoryMismatch is returned when the WAL file(s) are not in the same
	// directory as the database file.
	ErrWALReplayDirectoryMismatch = errors.New("WAL file(s) not in same directory as database file")

	// ErrWALAlreadyExists is returned when attempting to replay WAL files but a WAL file
	// already exists alongside the database file.
	ErrWALAlreadyExists = errors.New("cannot replay WAL files: existing WAL file present")

	// ErrWALStillExists is returned when a WAL file still exists after checkpointing and
	// closing the database.
	ErrWALStillExists = errors.New("WAL file still exists after checkpointing and closing the database")
)

// SQLiteError is a representation of the SQLite-level detailed error.
type SQLiteError struct {
	Code         int32
	ExtendedCode int32
	SystemErrno  int32
}

// ReadOnlyError returns true if the error is a read-only error.
func (e *SQLiteError) ReadOnlyError() bool {
	return e.Code == int32(sqlite3.ErrReadonly)
}

// NewSQLiteErrorFromError extracts a full structured SQLite error from an error,
// returning nil if the error is not a SQLite error.
func NewSQLiteErrorFromError(err error) *SQLiteError {
	var sqErr sqlite3.Error
	if errors.As(err, &sqErr) {
		return &SQLiteError{
			Code:         int32(sqErr.Code),
			ExtendedCode: int32(sqErr.ExtendedCode),
			SystemErrno:  int32(sqErr.SystemErrno),
		}
	}
	return nil
}

// SynchronousMode is SQLite synchronous mode.
type SynchronousMode int

const (
	SynchronousOff SynchronousMode = iota
	SynchronousNormal
	SynchronousFull
	SynchronousExtra
)

// String returns the string representation of the synchronous mode.
func (s SynchronousMode) String() string {
	switch s {
	case SynchronousOff:
		return "OFF"
	case SynchronousNormal:
		return "NORMAL"
	case SynchronousFull:
		return "FULL"
	case SynchronousExtra:
		return "EXTRA"
	default:
		panic("unknown synchronous mode")
	}
}

// SynchronousModeFromString returns the synchronous mode from the given string.
func SynchronousModeFromString(s string) (SynchronousMode, error) {
	switch strings.ToUpper(s) {
	case "OFF":
		return SynchronousOff, nil
	case "NORMAL":
		return SynchronousNormal, nil
	case "FULL":
		return SynchronousFull, nil
	case "EXTRA":
		return SynchronousExtra, nil
	default:
		return 0, fmt.Errorf("unknown synchronous mode %s", s)
	}
}

// SynchronousModeFromInt returns the synchronous mode from the given integer.
func SynchronousModeFromInt(i int) (SynchronousMode, error) {
	switch i {
	case 0:
		return SynchronousOff, nil
	case 1:
		return SynchronousNormal, nil
	case 2:
		return SynchronousFull, nil
	case 3:
		return SynchronousExtra, nil
	default:
		return 0, fmt.Errorf("unknown synchronous mode %d", i)
	}
}

// breakingPragmasAnyForm lists pragma names that are breaking in any form:
// bare name, =value, or (arg).
var breakingPragmasAnyForm = []string{
	"wal_checkpoint",
}

// breakingPragmasAssignment lists pragma names that are breaking only when
// used in an assignment form (name = value or name(value)).
var breakingPragmasAssignment = []string{
	"journal_mode",
	"wal_autocheckpoint",
	"synchronous",
	"query_only",
}

// IsBreakingPragma reports whether any SQL statement contains a PRAGMA that
// would break the database layer. It recognizes both assignment forms, quoted
// identifiers, and comments, while skipping quoted SQL text.
func IsBreakingPragma(stmt string) bool {
	start := true
	for len(stmt) > 0 {
		var token string
		token, stmt = nextPragmaToken(stmt)
		if token == ";" {
			start = true
			continue
		}
		// Some PRAGMAs take effect during preparation, including when the
		// statement is prefixed with EXPLAIN or EXPLAIN QUERY PLAN.
		if start && strings.EqualFold(token, "EXPLAIN") {
			token, stmt = nextPragmaToken(stmt)
			if strings.EqualFold(token, "QUERY") {
				token, stmt = nextPragmaToken(stmt)
				if strings.EqualFold(token, "PLAN") {
					token, stmt = nextPragmaToken(stmt)
				}
			}
		}
		if start && strings.EqualFold(token, "PRAGMA") && isBreakingPragmaBody(stmt) {
			return true
		}
		start = false
	}
	return false
}

func isBreakingPragmaBody(stmt string) bool {
	name, rest := nextPragmaToken(stmt)
	next, rest := nextPragmaToken(rest)
	if next == "." {
		name, rest = nextPragmaToken(rest)
		next, _ = nextPragmaToken(rest)
	}
	if len(name) > 1 {
		switch name[0] {
		case '\'', '"', '`', '[':
			name = name[1 : len(name)-1]
		}
	}
	for _, p := range breakingPragmasAnyForm {
		if strings.EqualFold(name, p) {
			return true
		}
	}
	for _, p := range breakingPragmasAssignment {
		if strings.EqualFold(name, p) {
			return next == "=" || next == "("
		}
	}
	return false
}

// nextPragmaToken scans only the SQL tokens needed to recognize PRAGMAs and
// statement boundaries. Quoted tokens are returned intact, so semicolons and
// comment markers inside strings or identifiers cannot become SQL syntax.
func nextPragmaToken(s string) (token, rest string) {
	for len(s) > 0 {
		if isASCIISpace(s[0]) {
			s = s[1:]
			continue
		}
		if strings.HasPrefix(s, "\ufeff") {
			s = s[3:]
			continue
		}
		if strings.HasPrefix(s, "--") {
			if i := strings.IndexByte(s, '\n'); i >= 0 {
				s = s[i+1:]
			} else {
				return "", ""
			}
			continue
		}
		if strings.HasPrefix(s, "/*") {
			if i := strings.Index(s[2:], "*/"); i >= 0 {
				s = s[i+4:]
			} else {
				return "", ""
			}
			continue
		}
		break
	}
	if len(s) == 0 {
		return "", ""
	}

	switch s[0] {
	case '\'', '"', '`', '[':
		quote := s[0]
		if quote == '[' {
			quote = ']'
		}
		for i := 1; i < len(s); i++ {
			if s[i] != quote {
				continue
			}
			if quote != ']' && i+1 < len(s) && s[i+1] == quote {
				i++
				continue
			}
			return s[:i+1], s[i+1:]
		}
		return s, ""
	}
	i := 0
	for i < len(s) {
		b := s[i]
		if b >= 'a' && b <= 'z' || b >= 'A' && b <= 'Z' || b >= '0' && b <= '9' || b == '_' || b == '$' || b >= 0x80 {
			i++
			continue
		}
		break
	}
	if i == 0 {
		i = 1
	}
	return s[:i], s[i:]
}

func isASCIISpace(b byte) bool {
	return b == ' ' || b == '\t' || b == '\n' || b == '\r' || b == '\v' || b == '\f'
}

// ParseHex parses the given string into a byte slice as per the SQLite specification:
//
//	BLOB literals are string literals containing hexadecimal data and preceded by a single
//	"x" or "X" character. Example: X'53514C697465'
func ParseHex(s string) ([]byte, error) {
	t := strings.TrimSpace(s)
	if len(t) < 3 || t[0] != 'X' && t[0] != 'x' {
		return nil, fmt.Errorf("invalid hex string %s", t)
	}
	t = t[1:]

	if t[0] != '\'' || t[len(t)-1] != '\'' {
		return nil, fmt.Errorf("invalid hex string %s", t)
	}

	b, err := hex.DecodeString(t[1 : len(t)-1])
	if err != nil {
		return nil, fmt.Errorf("invalid hex string %s: %s", t, err)
	}
	return b, nil
}

// ValidateExtension validates the given extension path can be loaded into a SQLite database.
func ValidateExtension(path string) error {
	name := path + "-" + random.String()
	sql.Register(name, &sqlite3.SQLiteDriver{})
	db, err := sql.Open(name, ":memory:")
	if err != nil {
		return err
	}
	defer db.Close()

	f := func(driverConn any) error {
		c := driverConn.(*sqlite3.SQLiteConn)
		return c.LoadExtension(path, "")
	}

	conn, err := db.Conn(context.Background())
	if err != nil {
		return err
	}
	defer conn.Close()
	if err := conn.Raw(f); err != nil {
		return err
	}
	return nil
}

// MakeDSN returns a SQLite DSN for the given path, with the given options.
// The returned DSN always sets Synchronous=OFF.
func MakeDSN(path string, readOnly, fkEnabled, walEnabled bool) string {
	opts := url.Values{}
	if readOnly {
		opts.Add("mode", "ro")
		opts.Add("_query_only", "true")
	}
	opts.Add("_fk", strconv.FormatBool(fkEnabled))
	opts.Add("_journal", "WAL")
	if !walEnabled {
		opts.Set("_journal", "DELETE")
	}
	opts.Add("_sync", "0")
	return fmt.Sprintf("file:%s?%s", path, opts.Encode())
}

// WALPath returns the path to the WAL file for the given database path.
func WALPath(dbPath string) string {
	return dbPath + "-wal"
}

// IsValidSQLiteFile checks that the supplied path looks like a SQLite file.
// A nonexistent file is considered invalid.
func IsValidSQLiteFile(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()

	b := make([]byte, 16)
	if _, err := io.ReadFull(f, b); err != nil {
		return false
	}

	return IsValidSQLiteData(b)
}

// IsValidSQLiteData checks that the supplied data looks like a SQLite data.
// See https://www.sqlite.org/fileformat.html.
func IsValidSQLiteData(b []byte) bool {
	return len(b) > 13 && string(b[0:13]) == "SQLite format"
}

// IsValidSQLiteFileCompressed checks that the supplied path looks like a
// compressed SQLite file. A nonexistent file, invalid Gzip archive, or
// gzip archive that does not contain a valid SQLite file is considered
// invalid.
func IsValidSQLiteFileCompressed(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()
	gz, err := gzip.NewReader(f)
	if err != nil {
		return false
	}
	defer gz.Close()

	b := make([]byte, 16)
	_, err = io.ReadFull(gz, b)
	if err != nil {
		return false
	}
	return IsValidSQLiteData(b)
}

// IsValidSQLiteWALFile checks that the supplied path looks like a SQLite
// WAL file. See https://www.sqlite.org/fileformat2.html#walformat. A
// nonexistent file is considered invalid.
func IsValidSQLiteWALFile(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()

	b := make(
```

### Core Architecture Module: `http/console/static/js/core.js`
```
/* Pure helpers shared by the console and its dependency-free tests. */
(function (root) {
    "use strict";

    // Keep unsafe JSON numbers as their original literals, not rounded Numbers.
    function ExactNumber(literal) { this.literal = literal; }
    ExactNumber.prototype.toString = function () { return this.literal; };
    ExactNumber.prototype.valueOf = function () { return Number(this.literal); };

    function parseJSON(text) {
        var numbers = [];
        var marked = text.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, function (token) {
            if (token[0] === '"') return token;
            numbers.push(token);
            return token;
        });
        // Validate before replacing numeric tokens, so malformed JSON cannot
        // become valid as a side effect of the lossless conversion.
        var validated = JSON.stringify(JSON.parse(marked));
        var index = 0;
        var prefix = "__rqlite_number__";
        while (validated.indexOf(prefix) !== -1) prefix += "_";
        marked = text.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, function (token) {
            if (token[0] === '"') return token;
            var n = Number(token);
            var id = index++;
            if (!Number.isFinite(n) || (Number.isInteger(n) && !Number.isSafeInteger(n))) {
                return JSON.stringify(prefix + id);
            }
            return token;
        });
        return JSON.parse(marked, function (_, value) {
            if (typeof value === "string" && value.indexOf(prefix) === 0) {
                return new ExactNumber(numbers[Number(value.slice(prefix.length))]);
            }
            return value;
        });
    }

    function stringifyJSON(value, pretty) {
        function encode(v, depth) {
            if (v instanceof ExactNumber) return v.literal;
            if (v === null || typeof v !== "object") return JSON.stringify(v);
            var array = Array.isArray(v);
            var keys = array ? v.map(function (_, i) { return i; }) : Object.keys(v);
            var parts = keys.map(function (key) {
                return (array ? "" : JSON.stringify(key) + (pretty ? ": " : ":")) + encode(v[key], depth + 1);
            });
            var open = array ? "[" : "{";
            var close = array ? "]" : "}";
            if (!parts.length) return open + close;
            if (!pretty) return open + parts.join(",") + close;
            var indent = "  ".repeat(depth + 1);
            return open + "\n" + indent + parts.join(",\n" + indent) + "\n" + "  ".repeat(depth) + close;
        }
        return encode(value, 0);
    }

    function cellText(value) {
        if (value === null || value === undefined) return "NULL";
        if (value instanceof ExactNumber) return value.literal;
        return typeof value === "object" ? stringifyJSON(value) : String(value);
    }

    function csvCell(value) {
        if (value === null || value === undefined) return "NULL";
        var s = cellText(value);
        // Quote literal NULL and empty strings to distinguish them from nulls.
        return /[",\r\n]/.test(s) || s === "NULL" || s === "" ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    function resultCSV(result) {
        return [result.columns.map(csvCell).join(",")].concat((result.values || []).map(function (row) {
            return result.columns.map(function (_, i) { return csvCell(row[i]); }).join(",");
        })).join("\r\n");
    }

    // SQLite strings, quoted identifiers, and comments must stay intact when
    // splitting scripts. Retain token offsets for editor highlighting, too.
    function sqlTokens(sql, tolerant) {
        var tokens = [];
        var i = 0;
        while (i < sql.length) {
            var start = i;
            var c = sql[i];
            var kind = "punctuation";
            if (/\s/.test(c)) {
                kind = "space";
                while (i < sql.length && /\s/.test(sql[i])) i++;
            } else if (sql.slice(i, i + 2) === "--") {
                kind = "comment";
                while (i < sql.length && sql[i] !== "\n") i++;
            } else if (sql.slice(i, i + 2) === "/*") {
                kind = "comment";
                var end = sql.indexOf("*/", i + 2);
                i = end < 0 ? sql.length : end + 2;
                if (end < 0 && !tolerant) throw new Error("Unclosed SQL comment.");
            } else if (c === "'" || c === '"' || c === "`" || c === "[") {
                kind = c === "'" ? "string" : "identifier";
                var close = c === "[" ? "]" : c;
                var closed = false;
                i++;
                while (i < sql.length) {
                    if (sql[i++] === close) {
                        if (close !== "]" && sql[i] === close) { i++; continue; }
                        closed = true;
                        break;
                    }
                }
                if (!closed && !tolerant) throw new Error("Unclosed SQL string or identifier.");
            } else if (/[A-Za-z_]/.test(c)) {
                kind = "word";
                while (i < sql.length && /[A-Za-z_0-9$]/.test(sql[i])) i++;
            } else if (/[0-9]/.test(c)) {
                kind = "number";
                while (i < sql.length && /[0-9.eE]/.test(sql[i])) i++;
            } else {
                i++;
            }
            tokens.push({ text: sql.slice(start, i), kind: kind, start: start, end: i });
        }
        return tokens;
    }

    function splitSQL(sql) {
        // Same completion states as SQLite's sqlite3_complete(): trigger bodies
        // end at ; END ;, not at an internal semicolon or a CASE expression.
        // Columns named "end" and EXPLAIN CREATE TRIGGER work here as well.
        var transitions = [
            [1, 0, 2, 3, 4, 2, 2, 2], // empty
            [1, 1, 2, 3, 4, 2, 2, 2], // statement boundary
            [1, 2, 2, 2, 2, 2, 2, 2], // normal SQL
            [1, 3, 3, 2, 4, 2, 2, 2], // EXPLAIN
            [1, 4, 2, 2, 2, 4, 5, 2], // CREATE [TEMP]
            [6, 5, 5, 5, 5, 5, 5, 5], // trigger body
            [6, 6, 5, 5, 5, 5, 5, 7], // trigger semicolon
            [1, 7, 5, 5, 5, 5, 5, 5]  // trigger END
        ];
        var tokenTypes = { EXPLAIN: 3, CREATE: 4, TEMP: 5, TEMPORARY: 5, TRIGGER: 6, END: 7 };
        var statements = [];
        var state = 0;
        var start = 0;
        var hasSQL = false;
        sqlTokens(sql).forEach(function (token) {
            if (token.kind === "space" || token.kind === "comment") return;
            var type = token.text === ";" ? 0 : (token.kind === "word" ? tokenTypes[token.text.toUpperCase()] || 2 : 2);
            state = transitions[state][type];
            if (state === 1) {
                if (hasSQL) statements.push(sql.slice(start, token.end).trim());
                start = token.end;
                hasSQL = false;
            } else hasSQL = true;
        });
        if (state === 5 || state === 6) throw new Error("Incomplete trigger: expected END;.");
        if (hasSQL) statements.push(sql.slice(start).trim());
        return statements;
    }

    function requestBody(sql, parameters) {
        var statements = splitSQL(sql);
        if (!statements.length) throw new Error("Enter a SQL statement to run.");
        statements.forEach(function (statement) {
            var first = sqlTokens(statement).filter(function (t) { return t.kind !== "space" && t.kind !== "comment"; })[0];
            if (/^(BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE)$/i.test(first.text)) {
                throw new Error("Use Execute atomically instead of SQL transaction-control statements.");
            }
        });
        if (!parameters.trim()) return statements;
        var params = parseJSON(parameters);
        if (!params || typeof params !== "object" || params instanceof ExactNumber) {
            throw new Error("Parameters must be a JSON array or object.");
        }
        if (Array.isArray(params) && statements.length !== 1) {
            throw new Error("Positional parameters require one statement. Use named parameters for a batch.");
        }
        return statements.map(function (statement) {
            return Array.isArray(params) ? [statement].concat(params) : [statement, params];
        });
    }

    // HTTP errors may be plain text, even when Content-Type says JSON.
    function readResponse(resp) {
        return resp.text().then(function (text) {
            var data;
            try { data = parseJSON(text); } catch (_) {
                if (resp.ok) throw new Error("Server returned an invalid JSON response.");
            }
            if (!resp.ok) {
                throw new Error("HTTP " + resp.status + ": " + ((data && data.error) || text || resp.statusText || "Request failed"));
            }
            if (data && data.error) throw new Error(String(data.error));
            if (!data || typeof data !== "object") throw new Error("Server returned an empty or invalid response.");
            return { status: resp.status, data: data };
        });
    }

    var api = { ExactNumber: ExactNumber, parseJSON: parseJSON, stringifyJSON: stringifyJSON,
        cellText: cellText, resultCSV: resultCSV, sqlTokens: sqlTokens, splitSQL: splitSQL,
        requestBody: requestBody, readResponse: readResponse };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.ConsoleUtils = api;
})(typeof window !== "undefined" ? window : this);

```

### Core Architecture Module: `internal/fsutil/copy.go`
```
package fsutil

/* MIT License
 *
 * Copyright (c) 2017 Roland Singer [roland.singer@desertbit.com]
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
)

// tmpSuffix is the suffix given to the temporary directory used to stage a
// directory copy before it is atomically moved into place.
const tmpSuffix = ".tmp"

// CopyDir recursively copies a directory tree, attempting to preserve permissions.
// Source directory must exist, destination directory must *not* exist.
// Symlinks are ignored and skipped.
//
// The copy is atomic. The tree is first staged in a temporary directory
// alongside the destination (the destination path plus a ".tmp" suffix). Once
// the staged tree has been synced to stable storage it is renamed to dst, and
// the parent directory synced. A failure part-way through therefore never
// leaves a partially-copied tree at dst -- dst either does not exist, or it is
// a complete copy of src. Any temporary directory left behind by an earlier
// interrupted copy to the same destination is removed first.
func CopyDir(src string, dst string) error {
	src = filepath.Clean(src)
	dst = filepath.Clean(dst)

	si, err := os.Stat(src)
	if err != nil {
		return err
	}
	if !si.IsDir() {
		return fmt.Errorf("source is not a directory")
	}

	_, err = os.Stat(dst)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	if err == nil {
		return fmt.Errorf("destination already exists")
	}

	// Stage the copy in a temporary directory next to the destination, clearing
	// out any remains of an earlier interrupted copy. The deferred removal is a
	// no-op once the rename below has succeeded.
	tmp := dst + tmpSuffix
	if err := RemoveAll(tmp); err != nil {
		return err
	}
	defer RemoveAll(tmp)

	if err := copyDir(src, tmp); err != nil {
		return err
	}
	if err := Rename(tmp, dst); err != nil {
		return err
	}
	return SyncDirParentMaybe(dst)
}

// copyDir performs the actual recursive copy of src to dst, syncing each
// directory it creates so that the directory entries are on stable storage
// by the time it returns.
func copyDir(src string, dst string) (err error) {
	si, err := os.Stat(src)
	if err != nil {
		return err
	}
	if !si.IsDir() {
		return fmt.Errorf("source is not a directory")
	}

	err = os.MkdirAll(dst, si.Mode())
	if err != nil {
		return
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			err = copyDir(srcPath, dstPath)
			if err != nil {
				return
			}
		} else {
			// Skip symlinks.
			if entry.Type()&fs.ModeSymlink != 0 {
				continue
			}

			err = copyFile(srcPath, dstPath)
			if err != nil {
				return
			}
		}
	}

	// Sync this directory so its entries -- including those of the
	// subdirectories copied above, which synced themselves -- are durable.
	return SyncDirMaybe(dst)
}

// copyFile copies the contents of the file named src to the file named
// by dst. The file will be created if it does not already exist. If the
// destination file exists, all it's contents will be replaced by the contents
// of the source file. The file mode will be copied from the source and
// the copied data is synced/flushed to stable storage.
func copyFile(src, dst string) (err error) {
	in, err := os.Open(src)
	if err != nil {
		return
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return
	}
	defer func() {
		if e := out.Close(); e != nil {
			err = e
		}
	}()

	_, err = io.Copy(out, in)
	if err != nil {
		return
	}

	err = out.Sync()
	if err != nil {
		return
	}

	si, err := os.Stat(src)
	if err != nil {
		return
	}
	err = os.Chmod(dst, si.Mode())
	if err != nil {
		return
	}

	return
}

```

### Core Architecture Module: `internal/fsutil/fsutil.go`
```
package fsutil

import (
	"bytes"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"time"
)

// Windows error codes returned when another process has a file or directory open.
const (
	errorAccessDenied     syscall.Errno = 5
	errorSharingViolation syscall.Errno = 32

	removeInterval = 10 * time.Millisecond
	removeTimeout  = 5 * time.Second

	renameInterval = 10 * time.Millisecond
	renameTimeout  = 5 * time.Second
)

// PathExists returns true if the given path exists.
func PathExists(p string) bool {
	if _, err := os.Lstat(p); err != nil && os.IsNotExist(err) {
		return false
	}
	return true
}

// FileExists returns true if a file exists at path and it is not a directory.
func FileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

// DirExists returns true if an actual directory exists at the given path.
func DirExists(path string) bool {
	stat, err := os.Stat(path)
	return err == nil && stat.IsDir()
}

// PathExistsWithData returns true if the given path exists and has data.
func PathExistsWithData(p string) bool {
	stat, err := os.Stat(p)
	if err != nil {
		return false
	}
	return stat.Size() > 0
}

// FileSize returns the size of the file at the given path.
func FileSize(path string) (int64, error) {
	stat, err := os.Stat(path)
	if err != nil {
		return 0, err
	}
	return stat.Size(), nil
}

// FileSizeExists returns the size of the given file, or 0 if the file does not
// exist. Any other error is returned.
func FileSizeExists(path string) (int64, error) {
	stat, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	return stat.Size(), nil
}

// DirSize returns the total size of all files in the given directory.
func DirSize(path string) (int64, error) {
	var size int64
	err := filepath.WalkDir(path, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			// If the file doesn't exist, we can ignore it. Snapshot files might
			// disappear during walking.
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		if !d.IsDir() {
			info, err := d.Info()
			if err != nil {
				if os.IsNotExist(err) {
					return nil
				}
				return err
			}
			size += info.Size()
		}
		return nil
	})
	return size, err
}

// ModTimeSize returns the modification time and size of the file at the given path.
func ModTimeSize(path string) (time.Time, int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return time.Time{}, 0, err
	}
	return info.ModTime(), info.Size(), nil
}

// LastModified returns the modification time of the file at the given path.
func LastModified(path string) (time.Time, error) {
	info, err := os.Stat(path)
	if err != nil {
		return time.Time{}, err
	}
	return info.ModTime(), nil
}

// EnsureDirExists creates the directory at the given path if it does not exist.
func EnsureDirExists(path string) error {
	return os.MkdirAll(path, 0755)
}

// DirIsEmpty returns true if the given directory is empty.
func DirIsEmpty(dir string) (bool, error) {
	files, err := os.ReadDir(dir)
	if err != nil {
		return false, err
	}
	return len(files) == 0, nil
}

// Rename renames (moves) oldpath to newpath.
func Rename(oldpath, newpath string) error {
	_, err := RenameWithRetry(oldpath, newpath, renameTimeout, renameInterval)
	return err
}

// Remove removes the file at the given path if it exists.
func Remove(path string) error {
	_, err := RemoveWithRetry(path, removeTimeout, removeInterval)
	if err != nil && os.IsNotExist(err) {
		return nil
	}
	return err
}

// RemoveAll removes path and any children it contains.
func RemoveAll(path string) error {
	return os.RemoveAll(path)
}

// RenameWithRetry renames src to dst. On Windows, if another process has
// the path open, the rename is retried until timeout elapses. Returns the
// number of times the rename was retried.
func RenameWithRetry(src, dst string, timeout, retryInterval time.Duration) (int, error) {
	return retryInUse(func() error { return os.Rename(src, dst) }, timeout, retryInterval)
}

// RemoveWithRetry removes the named file or empty directory. On Windows, if
// another process has the path open, the removal is retried until timeout elapses.
// Returns the number of times the rename was retried.
func RemoveWithRetry(path string, timeout, retryInterval time.Duration) (int, error) {
	return retryInUse(func() error { return os.Remove(path) }, timeout, retryInterval)
}

// RemoveWithRetry removes the named file or empty directory recursively. On Windows,
// if another process has the path open, the removal is retried until timeout elapses.
// Returns the number of times the rename was retried.
func RemoveAllWithRetry(path string, timeout, retryInterval time.Duration) (int, error) {
	return retryInUse(func() error { return os.RemoveAll(path) }, timeout, retryInterval)
}

// RemoveDirSync removes the directory and syncs the parent directory.
func RemoveDirSync(dir string) error {
	if err := RemoveAll(dir); err != nil {
		return err
	}
	return SyncDirParentMaybe(dir)
}

// SyncDir syncs the given directory to stable storage.
func SyncDir(dir string) error {
	fh, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer fh.Close()
	return fh.Sync()
}

// SyncDirMaybe syncs the given directory, but only on non-Windows platforms.
func SyncDirMaybe(dir string) error {
	if runtime.GOOS == "windows" {
		return nil
	}
	return SyncDir(dir)
}

// SyncDirParentMaybe syncs the parent directory of the given
// directory, but only on non-Windows platforms.
//
// A note on the SyncDir* functions. This is the same approach
// that Hashicorp Raft uses in its implementation. Since the
// os.Rename() is atomic, the lack of directory-level sync
// means the rename may be rolled back after a power loss on
// Windows. This is OK. The main thing is the rename will
// have either happened or it will not have.
func SyncDirParentMaybe(dir string) error {
	if runtime.GOOS == "windows" {
		return nil
	}
	return SyncDir(filepath.Dir(dir))
}

// FilesIdentical returns true if the two files at the given paths have identical contents.
func FilesIdentical(path1, path2 string) bool {
	b1, err := os.ReadFile(path1)
	if err != nil {
		return false
	}
	b2, err := os.ReadFile(path2)
	if err != nil {
		return false
	}
	return bytes.Equal(b1, b2)
}

// retryInUse calls fn until it succeeds, fails for a reason other than the path
// being in use, or timeout elapses. It returns the last error from fn.
func retryInUse(fn func() error, timeout, retryInterval time.Duration) (int, error) {
	deadline := time.Now().Add(timeout)
	nRetries := 0
	for {
		err := fn()
		if err == nil || !isInUse(err) || time.Now().After(deadline) {
			return nRetries, err
		}
		nRetries++
		time.Sleep(retryInterval)
	}
}

// isInUse returns true if err is the error Windows returns when another
// process has the path open.
func isInUse(err error) bool {
	if runtime.GOOS != "windows" {
		return false
	}
	return errors.Is(err, errorAccessDenied) || errors.Is(err, errorSharingViolation)
}

```

### Core Architecture Module: `internal/rsync/state.go`
```
package rsync

import (
	"errors"
	"fmt"
	"time"
)

// ErrTimeout is returned when a timeout occurs.
var ErrTimeout = errors.New("timeout")

// CloseOrTimeout waits for a channel to be closed or a timeout expires.
func CloseOrTimeout(ch <-chan struct{}, timeout time.Duration) error {
	select {
	case <-ch:
		return nil
	case <-time.After(timeout):
		return fmt.Errorf("timeout after %v, %w", timeout, ErrTimeout)
	}
}

```

### Core Architecture Module: `queue/queue.go`
```
package queue

import (
	"errors"
	"expvar"
	"sync"
	"time"
)

// stats captures stats for the Queue.
var stats *expvar.Map

const (
	numObjectsRx = "objects_rx"
	numObjectsTx = "objects_tx"
	numTimeout   = "num_timeout"
	numFlush     = "num_flush"
)

func init() {
	stats = expvar.NewMap("queue")
	ResetStats()
}

// ResetStats resets the expvar stats for this module. Mostly for test purposes.
func ResetStats() {
	stats.Init()
	stats.Add(numObjectsRx, 0)
	stats.Add(numObjectsTx, 0)
	stats.Add(numTimeout, 0)
	stats.Add(numFlush, 0)
}

// FlushChannel is the type passed to the Queue, if caller wants
// to know when a specific set of objects has been processed.
type FlushChannel chan bool

// Request represents a batch of objects to be processed.
type Request[T any] struct {
	SequenceNumber int64
	Objects        []T
	flushChans     []FlushChannel
}

// Close closes a request, closing any associated flush channels.
func (r *Request[T]) Close() {
	for _, c := range r.flushChans {
		close(c)
	}
}

type queuedObjects[T any] struct {
	SequenceNumber int64
	Objects        []T
	flushChan      FlushChannel
}

func mergeQueued[T any](qs []*queuedObjects[T]) *Request[T] {
	if len(qs) == 0 {
		return nil
	}
	var req *Request[T]
	req = &Request[T]{
		SequenceNumber: qs[0].SequenceNumber,
		flushChans:     make([]FlushChannel, 0),
	}

	for i := range qs {
		if req.SequenceNumber < qs[i].SequenceNumber {
			req.SequenceNumber = qs[i].SequenceNumber
		}
		req.Objects = append(req.Objects, qs[i].Objects...)
		if qs[i].flushChan != nil {
			req.flushChans = append(req.flushChans, qs[i].flushChan)
		}
	}
	return req
}

// Queue is a batching queue with a timeout.
type Queue[T any] struct {
	maxSize   int
	batchSize int
	timeout   time.Duration

	batchCh chan *queuedObjects[T]

	sendCh chan *Request[T]
	C      <-chan *Request[T]

	done   chan struct{}
	closed chan struct{}

	seqMu  sync.Mutex
	seqNum int64

	// Whitebox unit-testing
	numTimeouts int
}

// New returns a instance of a Queue. t is the maximum time that
// objects can remain in the queue before being sent, even if
// the batch size has not been reached. If t is zero, there is no
// timeout, and batches are sent only when the batch size is reached.
func New[T any](maxSize, batchSize int, t time.Duration) *Queue[T] {
	q := &Queue[T]{
		maxSize:   maxSize,
		batchSize: batchSize,
		timeout:   t,
		batchCh:   make(chan *queuedObjects[T], maxSize),
		sendCh:    make(chan *Request[T], 1),
		done:      make(chan struct{}),
		closed:    make(chan struct{}),
		seqNum:    time.Now().UnixNano(),
	}

	q.C = q.sendCh
	go q.run()
	return q
}

// Write queues a request, and returns a monotonically increasing
// sequence number associated with the slice of objects. A slice with
// a lower sequence number than second slice will always be transmitted
// on the Queue's C object before the second slice.
//
// c is an optional channel. If non-nil, it will be closed when the Request
// containing these objects is closed. Normally this close operation should
// be called by whatever is processing the objects read from the queue, to
// indicate that the objects have been processed. The canonical use of this
// is to allow the caller to block until the objects are processed.
func (q *Queue[T]) Write(objects []T, c FlushChannel) (int64, error) {
	select {
	case <-q.done:
		return 0, errors.New("queue is closed")
	default:
	}

	// Take the lock and don't release it until the function returns.
	// This ensures that the incremented sequence number and write to
	// batch channel are synchronized.
	q.seqMu.Lock()
	defer q.seqMu.Unlock()
	q.seqNum++

	q.batchCh <- &queuedObjects[T]{
		SequenceNumber: q.seqNum,
		Objects:        objects,
		flushChan:      c,
	}
	stats.Add(numObjectsRx, int64(len(objects)))
	return q.seqNum, nil
}

// WriteOne queues a single object, and returns a monotonically increasing
// sequence number associated with the object. See Write() for more details.
func (q *Queue[T]) WriteOne(object T, c FlushChannel) (int64, error) {
	return q.Write([]T{object}, c)
}

// Flush flushes the queue
func (q *Queue[T]) Flush() error {
	q.batchCh <- nil
	return nil
}

// Close closes the queue. A closed queue should not be used.
func (q *Queue[T]) Close() error {
	select {
	case <-q.done:
	default:
		close(q.done)
		<-q.closed
	}
	return nil
}

// Depth returns the number of queued requests
func (q *Queue[T]) Depth() int {
	return len(q.batchCh)
}

// Stats returns stats on this queue.
func (q *Queue[T]) Stats() (map[string]any, error) {
	return map[string]any{
		"max_size":   q.maxSize,
		"batch_size": q.batchSize,
		"timeout":    q.timeout.String(),
	}, nil
}

func (q *Queue[T]) run() {
	defer close(q.closed)

	qObjs := make([]*queuedObjects[T], 0)
	// Create an initial timer, in the stopped state.
	timer := time.NewTimer(0)
	<-timer.C

	writeFn := func() {
		// mergeQueued returns a new object, ownership will pass
		// implicitly to the other side of sendCh.
		req := mergeQueued(qObjs)
		if req != nil {
			q.sendCh <- req
			stats.Add(numObjectsTx, int64(len(req.Objects)))
			qObjs = qObjs[:0] // Better on the GC than setting to nil.
		}
	}

	for {
		select {
		case s := <-q.batchCh:
			if s == nil { // flush marker
				stats.Add(numFlush, 1)
				stopTimer(timer)
				writeFn()
				break
			}

			qObjs = append(qObjs, s)
			if len(qObjs) == 1 {
				if q.timeout != 0 {
					// First item in queue, start the timer so that if
					// we don't get in a batch, we'll still write.
					timer.Reset(q.timeout)
				}
			}
			if len(qObjs) == q.batchSize {
				stopTimer(timer)
				writeFn()
			}
		case <-timer.C:
			stats.Add(numTimeout, 1)
			q.numTimeouts++
			writeFn()
		case <-q.done:
			stopTimer(timer)
			return
		}
	}
}

func stopTimer(timer *time.Timer) {
	if !timer.Stop() && len(timer.C) > 0 {
		<-timer.C
	}
}

```

### Core Architecture Module: `snapshot/state.go`
```
package snapshot

import (
	"expvar"
	"fmt"
	"io"
	"log"
	"path/filepath"
	"time"

	"github.com/hashicorp/raft"
	"github.com/rqlite/rqlite/v10/internal/fsutil"
	"github.com/rqlite/rqlite/v10/internal/progress"
)

// Clone copies the snapshot located in dir, and indicated by id, and
// installs it in dir, but with the new index and term.
//
// The data files, and their CRC32 sidecars, are copied verbatim, so the clone
// holds exactly the database state of the snapshot it was made from -- only its
// identity changes. A clone is therefore of the same type, Full or Incremental,
// as its source.
//
// Clone exists for testing: it makes it possible to build a Snapshot Store
// holding a snapshot at an arbitrary index without driving a node to that index
// first. Clone returns an error if a snapshot with the resulting ID already
// exists, so it never overwrites one.
func Clone(dir, id string, index, term uint64) error {
	srcPath := filepath.Join(dir, id)
	if !fsutil.DirExists(srcPath) {
		return fmt.Errorf("snapshot %q not found in %q", id, dir)
	}
	meta, err := readRaftMeta(metaPath(srcPath))
	if err != nil {
		return fmt.Errorf("reading meta of snapshot %q: %w", id, err)
	}

	snapshotNamer := NewSnapshotNamer(nil)
	newID := snapshotNamer.MakeName(SnapshotSet{}, term, index)
	dstPath := filepath.Join(dir, newID)
	if fsutil.PathExists(dstPath) {
		return fmt.Errorf("snapshot %q already exists in %q", newID, dir)
	}

	// Build the clone under a temporary name, so a partially-written copy is
	// never picked up by a scan of the Snapshot Store.
	tmpPath := tmpName(dstPath)
	if err := fsutil.RemoveAll(tmpPath); err != nil {
		return fmt.Errorf("removing stale temporary directory %q: %w", tmpPath, err)
	}
	defer fsutil.RemoveAll(tmpPath)
	if err := fsutil.CopyDir(srcPath, tmpPath); err != nil {
		return fmt.Errorf("copying snapshot %q: %w", id, err)
	}

	// Only the metadata needs rewriting: the data files are unchanged, so their
	// CRC32 sidecars remain correct.
	meta.ID = newID
	meta.Index = index
	meta.Term = term
	if err := writeMeta(tmpPath, meta); err != nil {
		return fmt.Errorf("writing meta of snapshot %q: %w", newID, err)
	}

	if err := fsutil.SyncDirMaybe(tmpPath); err != nil {
		return err
	}
	if err := fsutil.Rename(tmpPath, dstPath); err != nil {
		return fmt.Errorf("renaming snapshot %q into place: %w", newID, err)
	}
	return fsutil.SyncDirMaybe(dir)
}

// LatestIndexTerm returns the index and term of the most recent snapshot
// in the given directory. If no snapshots are found, it returns 0, 0, nil.
//
// This function does not take any lock on the Snapshot store contained at dir,
// so it not safe to call on an open Snapshot store.
func LatestIndexTerm(dir string) (uint64, uint64, error) {
	cat := &SnapshotCatalog{}
	sset, err := cat.Scan(dir)
	if err != nil {
		return 0, 0, err
	}
	newest, ok := sset.Newest()
	if !ok {
		return 0, 0, nil
	}
	return newest.raftMeta.Index, newest.raftMeta.Term, nil
}

// StateReader represents a snapshot of the database state.
type StateReader struct {
	rc     io.ReadCloser
	logger *log.Logger
}

// NewStateReader creates a new StateReader.
func NewStateReader(rc io.ReadCloser) *StateReader {
	return &StateReader{
		rc:     rc,
		logger: log.New(log.Writer(), "[snapshot] ", log.LstdFlags),
	}
}

// Persist writes the State to the given sink.
func (s *StateReader) Persist(sink raft.SnapshotSink) error {
	defer s.rc.Close()
	startT := time.Now()

	cw := progress.NewCountingWriter(sink)
	cm := progress.StartCountingMonitor(func(n int64) {
		s.logger.Printf("persisted %d bytes", n)
	}, cw)
	n, err := func() (int64, error) {
		defer cm.StopAndWait()
		return io.Copy(cw, s.rc)
	}()
	if err != nil {
		return err
	}

	stats.Get(persistSize).(*expvar.Int).Set(n)
	recordDuration(persistDuration, startT)
	return err
}

// Release releases the StateReader.
func (s *StateReader) Release() {
	// Ensure that the source data for the snapshot is closed regardless of
	// whether the snapshot is persisted or not.
	s.rc.Close()
}

// IndexTermer is implemented by a snapshot sink which knows the Raft index and
// term of the snapshot it is capturing. Sink implements it.
type IndexTermer interface {
	Index() uint64
	Term() uint64
}

// SinkIndexTerm returns the Raft index and term of the snapshot the given sink is
// capturing. Raft's SnapshotSink interface exposes only the snapshot ID, so the
// index and term must be recovered from the sink itself. Every sink Raft holds
// comes from Store.Create in this package, so a sink which cannot supply them is
// a programming error and is reported as such.
func SinkIndexTerm(sink raft.SnapshotSink) (uint64, uint64, error) {
	it, ok := sink.(IndexTermer)
	if !ok {
		return 0, 0, fmt.Errorf("snapshot sink of type %T does not know its index and term", sink)
	}
	return it.Index(), it.Term(), nil
}

// StreamerIndexTerm returns the Raft index and term of the snapshot being streamed.
// Raft does not hand the ReadCloser returned by Store.Open to the FSM directly, but
// wraps it first, so any wrappers are unwrapped before the index and term are read.
func StreamerIndexTerm(rc io.ReadCloser) (uint64, uint64, error) {
	for src := rc; ; {
		if it, ok := src.(IndexTermer); ok {
			return it.Index(), it.Term(), nil
		}
		w, ok := src.(raft.ReadCloserWrapper)
		if !ok {
			return 0, 0, fmt.Errorf("snapshot streamer of type %T does not know its index and term", rc)
		}
		src = w.WrappedReadCloser()
	}
}

```

### Core Architecture Module: `store/state.go`
```
package store

import (
	"fmt"
	"log"
	"net"
	"path/filepath"
	"strings"
	"time"

	"github.com/hashicorp/raft"
	"github.com/rqlite/rqlite/v10/command/chunking"
	"github.com/rqlite/rqlite/v10/command/proto"
	sql "github.com/rqlite/rqlite/v10/db"
	"github.com/rqlite/rqlite/v10/internal/fsutil"
	"github.com/rqlite/rqlite/v10/internal/random"
	"github.com/rqlite/rqlite/v10/snapshot"
	rlog "github.com/rqlite/rqlite/v10/store/log"
)

// RaftConfigAsJSON returns a JSON-serializable representation of a raft.Config.
func RaftConfigAsJSON(config *raft.Config) any {
	// create a temp struct

	type raftConfigJSON struct {
		LocalID                  string `json:"LocalID"`
		HeartbeatTimeout         int64  `json:"HeartbeatTimeout"`
		ElectionTimeout          int64  `json:"ElectionTimeout"`
		LeaderLeaseTimeout       int64  `json:"LeaderLeaseTimeout"`
		CommitTimeout            int64  `json:"CommitTimeout"`
		SnapshotInterval         int64  `json:"SnapshotInterval"`
		SnapshotThreshold        uint64 `json:"SnapshotThreshold"`
		MaxAppendEntries         int    `json:"MaxAppendEntries"`
		ShutdownOnRemove         bool   `json:"ShutdownOnRemove"`
		LogLevel                 string `json:"LogLevel"`
		NoSnapshotRestoreOnStart bool   `json:"NoSnapshotRestoreOnStart"`
	}

	// populate the temp struct with values from the raft.Config
	rcj := raftConfigJSON{
		LocalID:                  string(config.LocalID),
		HeartbeatTimeout:         config.HeartbeatTimeout.Nanoseconds(),
		ElectionTimeout:          config.ElectionTimeout.Nanoseconds(),
		LeaderLeaseTimeout:       config.LeaderLeaseTimeout.Nanoseconds(),
		CommitTimeout:            config.CommitTimeout.Nanoseconds(),
		SnapshotInterval:         config.SnapshotInterval.Nanoseconds(),
		SnapshotThreshold:        config.SnapshotThreshold,
		MaxAppendEntries:         config.MaxAppendEntries,
		ShutdownOnRemove:         config.ShutdownOnRemove,
		LogLevel:                 config.LogLevel,
		NoSnapshotRestoreOnStart: config.NoSnapshotRestoreOnStart,
	}
	return rcj
}

// PragmaCheckRequest is a type that wraps a proto.Request and checks
// whether a request contains any disallowed pragmas.
type PragmaCheckRequest proto.Request

// Check checks whether a request contains any disallowed pragmas.
func (p *PragmaCheckRequest) Check() error {
	if p == nil {
		return nil
	}
	for _, stmt := range p.Statements {
		if sql.IsBreakingPragma(stmt.Sql) {
			return fmt.Errorf("disallowed pragma")
		}
	}
	return nil
}

// IsStaleRead returns whether a read is stale.
//
// The Raft library sends heartbeats, which contain just term and leader set,
// on one message, but messages which contain the current term and index set
// on a different message. The latter are called "append entries". Checking
// if a read is stale requires timestamps for both.
//
// lastHeartbeatTime: last time we received a heartbeat from the Leader.
// lastAppendEntriesTime: last time we receievd an AppendEntries request from the Leader.
// lastAppliedIndex: index currently applied to the FSM.
// lastAppliedAtTime: time the currently applied index was actually applied.
// freshness: freshness window
// strict: whether strict freshness is required.
func IsStaleRead(
	lastHeartbeatTime time.Time,
	lastAppendEntriesTime time.Time,
	lastAppliedIndex uint64,
	leaderCommitIndex uint64,
	lastAppliedAtTime time.Time,
	freshness int64,
	strict bool,
) bool {
	if freshness == 0 {
		// Freshness not set, so no read can be stale.
		return false
	}
	if time.Since(lastHeartbeatTime).Nanoseconds() > freshness {
		// The Leader has not been in contact within the freshness window, so
		// the read is stale.
		return true
	}
	if !strict {
		// Strict mode is not enabled, so no further checks are needed.
		return false
	}

	if time.Since(lastAppendEntriesTime).Nanoseconds() > freshness {
		// The Leader sent us heartbeats, but hasn't sent us an AppendEntries
		// message within the required window. We're stale.
		// See https://github.com/dotnwat/torx/issues/18
		return true
	}

	if lastAppliedIndex >= leaderCommitIndex {
		// We've applied the latest leader commit index we know about and that
		// commit index arrived within the window, we can't be stale.
		return false
	}

	// We've haven't yet applied the leader's latest commit index, but was the currently
	// applied index applied within the freshness window?
	return time.Since(lastAppliedAtTime).Nanoseconds() > freshness
}

// IsNewNode returns whether a node using raftDir would be a brand-new node.
// It also means that the window for this node joining a different cluster has passed.
func IsNewNode(raftDir string) bool {
	// If there is any preexisting Raft state, then this node
	// has already been created.
	return !fsutil.PathExists(filepath.Join(raftDir, raftDBPath))
}

// HasData returns true if the given dir indicates that at least one FSM entry
// has been committed to the log. This is true if there are any snapshots, or
// if there are any entries in the log of raft.LogCommand type. This function
// will block if the Bolt database is already open.
func HasData(dir string) (bool, error) {
	if !fsutil.DirExists(dir) {
		return false, nil
	}
	sstr, err := snapshot.NewStore(filepath.Join(dir, snapshotsDirName))
	if err != nil {
		return false, err
	}
	defer sstr.Close()
	snaps, err := sstr.List()
	if err != nil {
		return false, err
	}
	if len(snaps) > 0 {
		return true, nil
	}
	logs, err := rlog.New(filepath.Join(dir, raftDBPath), false)
	if err != nil {
		return false, err
	}
	defer logs.Close()
	h, err := logs.HasCommand()
	if err != nil {
		return false, err
	}
	return h, nil
}

// RecoverNode is used to manually force a new configuration, in the event that
// quorum cannot be restored. This borrows heavily from RecoverCluster functionality
// of the Hashicorp Raft library, but has been customized for rqlite use.
// dbConf supplies the extensions and foreign-key enforcement used during log replay.
func RecoverNode(dataDir string, dbConf *DBConfig, logger *log.Logger, logs raft.LogStore,
	stable *rlog.Log, snaps raft.SnapshotStore, tn raft.Transport, conf raft.Configuration) error {
	logPrefix := logger.Prefix()
	logger.SetPrefix(fmt.Sprintf("%s[recovery] ", logPrefix))
	defer logger.SetPrefix(logPrefix)

	// Sanity check the Raft peer configuration.
	if err := checkRaftConfiguration(conf); err != nil {
		return err
	}

	// Get a path to a temporary file to use for a temporary database.
	tmpDBPath := filepath.Join(dataDir, "recovery.db")
	defer fsutil.Remove(tmpDBPath)

	// Attempt to restore any latest snapshot.
	var (
		snapshotIndex uint64
		snapshotTerm  uint64
	)

	snapshots, err := snaps.List()
	if err != nil {
		return fmt.Errorf("failed to list snapshots: %s", err)
	}
	logger.Printf("recovery detected %d snapshots", len(snapshots))
	if len(snapshots) > 0 {
		if err := func() error {
			snapID := snapshots[0].ID
			_, rc, err := snaps.Open(snapID)
			if err != nil {
				return fmt.Errorf("failed to open snapshot %s: %s", snapID, err)
			}
			defer rc.Close()
			_, err = snapshot.Restore(rc, tmpDBPath)
			if err != nil {
				return fmt.Errorf("failed to restore snapshot %s to temporary database: %s", snapID, err)
			}
			snapshotIndex = snapshots[0].Index
			snapshotTerm = snapshots[0].Term
			return nil
		}(); err != nil {
			return err
		}
	}

	// Now, open the database so we can replay any outstanding Raft log entries.
	drv := sql.DefaultDriver()
	if len(dbConf.Extensions) > 0 {
		drv = sql.NewDriver(random.StringPattern("rqlite-extended-recover-xxxx-xxxx-xxxx"),
			dbConf.Extensions, sql.CnkOnCloseModeDisabled)
	}
	db, err := sql.OpenSwappable(tmpDBPath, drv, dbConf.FKConstraints, true, 0)
	if err != nil {
		return fmt.Errorf("failed to open temporary database: %s", err)
	}
	defer db.Close()

	// Need a dechunker manager to handle any chunked load requests.
	decMgmr, err := chunking.NewDechunkerManager(dataDir)
	if err != nil {
		return fmt.Errorf("failed to create dechunker manager: %s", err.Error())
	}
	defer decMgmr.Close()
	cmdProc := NewCommandProcessor(logger, decMgmr)

	// The snapshot information is the best known end point for the data
	// until we play back the Raft log entries.
	lastIndex := snapshotIndex
	lastTerm := snapshotTerm

	// Apply any Raft log entries past the snapshot.
	lastLogIndex, err := logs.LastIndex()
	if err != nil {
		return fmt.Errorf("failed to find last log: %v", err)
	}
	logger.Printf("snapshot's last index is %d, last index written to log is %d, last term is %d",
		lastIndex, lastLogIndex, lastTerm)

	for index := snapshotIndex + 1; index <= lastLogIndex; index++ {
		var entry raft.Log
		if err = logs.GetLog(index, &entry); err != nil {
			return fmt.Errorf("failed to get log at index %d: %v", index, err)
		}
		if entry.Type == raft.LogCommand {
			if _, _, _, err := cmdProc.Process(entry.Data, db); err != nil {
				return fmt.Errorf("failed to replay command at index %d: %w", index, err)
			}
		}
		lastIndex = entry.Index
		lastTerm = entry.Term
	}
	if snapshotIndex+1 <= lastLogIndex {
		logger.Printf("replayed logs from %d to %d", snapshotIndex+1, lastLogIndex)
		logger.Printf("last index is now %d, last term is %d", lastIndex, lastTerm)
	}

	// Create a new snapshot, placing the configuration in as if it was
	// committed at index 1.
	_, _, err = db.Checkpoint(nil, truncateTimeout)
	if err != nil {
		return fmt.Errorf("failed to checkpoint database: %s", err)
	}
	streamer, err := snapshot.NewSnapshotStreamer(tmpDBPath)
	if err != nil {
		return fmt.Errorf("failed to create snapshot streamer: %s", err)
	}
	defer streamer.Close()
	if err := streamer.Open(); err != nil {
		return fmt.Errorf("failed to open snapshot streamer: %s", err)
	}
	fsmSnapshot := snapshot.NewStateReader(streamer) // tmpDBPath contains full state now.
	sink, err := snaps.Create(1, lastIndex, lastTerm, conf, 1, tn)
	if err != nil {
		return fmt.Errorf("failed to create snapshot: %v", err)
	}
	defer sink.Cancel() // If we fail, make sure to cancel the snapshot.
	if err 
```

### Core Architecture Module: `tools/check-fsutil/main.go`
```
// Command check-fsutil rejects direct uses of filesystem operations that must
// go through internal/fsutil.
package main

import (
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
)

func main() {
	root := flag.String("root", ".", "repository root containing go.mod")
	flag.Parse()
	if flag.NArg() != 0 {
		fmt.Fprintln(os.Stderr, "usage: check-fsutil [-root directory]")
		os.Exit(1)
	}
	n, err := check(*root, os.Stderr)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
	}
	if err != nil || n != 0 {
		os.Exit(1)
	}
}

func check(root string, out io.Writer) (int, error) {
	if _, err := os.Stat(filepath.Join(root, "go.mod")); err != nil {
		return 0, fmt.Errorf("repository root must contain go.mod: %w", err)
	}
	fset := token.NewFileSet()
	violations := 0
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			if entry.Name() == ".git" || entry.Name() == "vendor" {
				return filepath.SkipDir
			}
			return nil
		}
		if filepath.Ext(path) != ".go" {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		file, err := parser.ParseFile(fset, path, nil, parser.AllErrors)
		if err != nil {
			return err
		}
		for _, pos := range forbiddenUses(file, filepath.ToSlash(rel)) {
			position := fset.PositionFor(pos.pos, false)
			fmt.Fprintf(out, "%s:%d:%d: use fsutil.%s instead of os.%s\n",
				filepath.ToSlash(rel), position.Line, position.Column, pos.operation, pos.operation)
			violations++
		}
		return nil
	})
	return violations, err
}

type violation struct {
	pos       token.Pos
	operation string
}

func forbiddenUses(file *ast.File, path string) []violation {
	imports := make(map[string]bool)
	for _, spec := range file.Imports {
		name, err := strconv.Unquote(spec.Path.Value)
		if err != nil || name != "os" {
			continue
		}
		alias := "os"
		if spec.Name != nil {
			alias = spec.Name.Name
		}
		imports[alias] = true
	}
	// Parser resolution distinguishes local declarations from imported names.
	// Unresolved also excludes selector fields, which are not dot-import uses.
	unresolved := make(map[*ast.Ident]bool)
	for _, id := range file.Unresolved {
		unresolved[id] = true
	}
	var violations []violation
	for _, decl := range file.Decls {
		function := ""
		if fn, ok := decl.(*ast.FuncDecl); ok && fn.Recv == nil {
			function = fn.Name.Name
		}
		ast.Inspect(decl, func(node ast.Node) bool {
			operation := ""
			switch node := node.(type) {
			case *ast.SelectorExpr:
				if id, ok := node.X.(*ast.Ident); ok && id.Obj == nil && imports[id.Name] {
					operation = node.Sel.Name
				}
			case *ast.Ident:
				if imports["."] && unresolved[node] {
					operation = node.Name
				}
			}
			switch operation {
			case "Rename", "Remove", "RemoveAll":
				// These are the implementation boundary, including their retry closures.
				if path == "internal/fsutil/fsutil.go" && file.Name.Name == "fsutil" &&
					(function == operation || function == operation+"WithRetry") {
					return true
				}
				violations = append(violations, violation{node.Pos(), operation})
			}
			return true
		})
	}
	return violations
}

```

### Core Architecture Module: `auth/credential_store.go`
```
// Package auth is a lightweight credential store.
// It provides functionality for loading credentials, as well as validating credentials.
package auth

import (
	"encoding/json"
	"io"
	"os"
)

const (
	// AllUsers is the username that indicates all users, even anonymous users (requests without
	// any BasicAuth information).
	AllUsers = "*"

	// PermAll means all actions permitted.
	PermAll = "all"
	// PermJoin means user is permitted to join cluster.
	PermJoin = "join"
	// PermJoinReadOnly means user is permitted to join the cluster only as a read replica node
	PermJoinReadOnly = "join-read-only"
	// PermJoinReadReplica means user is permitted to join the cluster only as a read replica node
	PermJoinReadReplica = "join-read-replica"
	// PermRemove means user is permitted to remove a node.
	PermRemove = "remove"
	// PermExecute means user can access execute endpoint.
	PermExecute = "execute"
	// PermQuery means user can access query endpoint
	PermQuery = "query"
	// PermStatus means user can retrieve node status.
	PermStatus = "status"
	// PermReady means user can retrieve ready status.
	PermReady = "ready"
	// PermBackup means user can backup node.
	PermBackup = "backup"
	// PermLoad means user can load a SQLite dump into a node.
	PermLoad = "load"
	// PermSnapshot means user can request a snapshot.
	PermSnapshot = "snapshot"
	// PermLeaderOps means user can perform leader-related operations.
	PermLeaderOps = "leader-ops"
	// PermCDCHWMUpdate = means a user can perform CDC high watermark updates.
	PermCDCHWMUpdate = "cdc-hwm-update"
	// PermUI means user can access the UI.
	PermUI = "ui"
)

// BasicAuther is the interface an object must support to return basic auth information.
type BasicAuther interface {
	BasicAuth() (string, string, bool)
}

// Credential represents authentication and authorization configuration for a single user.
type Credential struct {
	Username string   `json:"username,omitempty"`
	Password string   `json:"password,omitempty"`
	Perms    []string `json:"perms,omitempty"`
}

// CredentialsStore stores authentication and authorization information for all users.
type CredentialsStore struct {
	store map[string]string
	perms map[string]map[string]bool
}

// NewCredentialsStore returns a new instance of a CredentialStore.
func NewCredentialsStore() *CredentialsStore {
	return &CredentialsStore{
		store: make(map[string]string),
		perms: make(map[string]map[string]bool),
	}
}

// NewCredentialsStoreFromFile returns a new instance of a CredentialStore loaded from a file.
func NewCredentialsStoreFromFile(path string) (*CredentialsStore, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	c := NewCredentialsStore()
	return c, c.Load(f)
}

// Load loads credential information from a reader.
func (c *CredentialsStore) Load(r io.Reader) error {
	dec := json.NewDecoder(r)
	// Read open bracket
	_, err := dec.Token()
	if err != nil {
		return err
	}

	var cred Credential
	for dec.More() {
		err := dec.Decode(&cred)
		if err != nil {
			return err
		}
		c.store[cred.Username] = cred.Password
		c.perms[cred.Username] = make(map[string]bool, len(cred.Perms))
		for _, p := range cred.Perms {
			c.perms[cred.Username][p] = true
		}
	}

	// Read closing bracket.
	_, err = dec.Token()
	if err != nil {
		return err
	}

	return nil
}

// Check returns true if the password is correct for the given username.
func (c *CredentialsStore) Check(username, password string) bool {
	pw, ok := c.store[username]
	return ok && pw == password
}

// Password returns the password for the given user.
func (c *CredentialsStore) Password(username string) (string, bool) {
	pw, ok := c.store[username]
	return pw, ok
}

// CheckRequest returns true if b contains a valid username and password.
func (c *CredentialsStore) CheckRequest(b BasicAuther) bool {
	username, password, ok := b.BasicAuth()
	if !ok || !c.Check(username, password) {
		return false
	}
	return true
}

// HasPerm returns true if username has the given perm, either directly or
// via AllUsers. It does not perform any password checking.
func (c *CredentialsStore) HasPerm(username string, perm string) bool {
	if m, ok := c.perms[username]; ok {
		if _, ok := m[perm]; ok {
			return true
		}
	}

	if m, ok := c.perms[AllUsers]; ok {
		if _, ok := m[perm]; ok {
			return true
		}
	}

	return false
}

// HasAnyPerm returns true if username has at least one of the given perms,
// either directly, or via AllUsers. It does not perform any password checking.
func (c *CredentialsStore) HasAnyPerm(username string, perm ...string) bool {
	return func(p []string) bool {
		for i := range p {
			if c.HasPerm(username, p[i]) {
				return true
			}
		}
		return false
	}(perm)
}

// AA authenticates and checks authorization for the given username and password
// for the given perm. If the credential store is nil, then this function always
// returns true. If AllUsers have the given perm, authentication is not done.
// Only then are the credentials checked, and then the perm checked.
func (c *CredentialsStore) AA(username, password, perm string) bool {
	// No credential store? Auth is not even enabled.
	if c == nil {
		return true
	}

	// Is the required perm granted to all users, including anonymous users?
	if c.HasAnyPerm(AllUsers, perm, PermAll) {
		return true
	}

	// At this point a username needs to have been supplied.
	if username == "" {
		return false
	}

	// Authenticate the user.
	if !c.Check(username, password) {
		return false
	}

	// Is the specified user authorized?
	return c.HasAnyPerm(username, perm, PermAll)
}

// HasPermRequest returns true if the username returned by b has the given perm.
// It does not perform any password checking, but if there is no username
// in the request, it returns false.
func (c *CredentialsStore) HasPermRequest(b BasicAuther, perm string) bool {
	username, _, ok := b.BasicAuth()
	return ok && c.HasPerm(username, perm)
}

```

### Core Architecture Module: `auto/aws/s3.go`
```
package aws

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var (
	AWSS3IDKey = "x-rqlite-auto-backup-id"
)

// S3Config is the subconfig for the S3 storage type
type S3Config struct {
	Endpoint        string `json:"endpoint,omitempty"`
	Region          string `json:"region"`
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`
	Bucket          string `json:"bucket"`
	Path            string `json:"path"`
	ForcePathStyle  bool   `json:"force_path_style"`
}

// S3Client is a client for uploading data to S3.
type S3Client struct {
	endpoint  string
	region    string
	accessKey string
	secretKey string
	bucket    string
	key       string
	timestamp bool

	s3 *s3.Client

	// These fields are used for testing via dependency injection.
	uploader   uploader
	downloader downloader
	now        func() time.Time
}

// S3ClientOpts are options for creating an S3Client.
type S3ClientOpts struct {
	ForcePathStyle bool
	Timestamp      bool
}

// NewS3Client returns an instance of an S3Client. opts can be nil.
func NewS3Client(endpoint, region, accessKey, secretKey, bucket, key string, opts *S3ClientOpts) (*S3Client, error) {
	// Load the default config
	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(region),
		config.WithRequestChecksumCalculation(aws.RequestChecksumCalculationWhenRequired),
	)
	if err != nil {
		return nil, fmt.Errorf("unable to load SDK config, %v", err)
	}

	// If credentials are provided, set them
	if accessKey != "" && secretKey != "" {
		cfg.Credentials = aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""))
	}

	// If an endpoint is provided, set it and the path style
	s3 := s3.NewFromConfig(cfg, func(o *s3.Options) {
		if opts != nil {
			if endpoint != "" {
				if !hasProtocol(endpoint) {
					endpoint = fmt.Sprintf("https://%s", endpoint)
				}
				o.BaseEndpoint = aws.String(endpoint)
			}
			o.UsePathStyle = opts.ForcePathStyle
		}
	})

	client := &S3Client{
		endpoint:  endpoint,
		region:    region,
		accessKey: accessKey,
		secretKey: secretKey,
		bucket:    bucket,
		key:       key,

		s3:         s3,
		uploader:   manager.NewUploader(s3),
		downloader: manager.NewDownloader(s3),
	}
	if opts != nil {
		client.timestamp = opts.Timestamp
	}
	return client, nil
}

// String returns a string representation of the S3Client.
func (s *S3Client) String() string {
	if s.endpoint == "" || isAWSEndpoint(s.endpoint) {
		// Native Amazon S3, use AWS's S3 URL format
		return fmt.Sprintf("s3://%s/%s", s.bucket, s.key)
	}
	return fmt.Sprintf("%s/%s/%s", s.endpoint, s.bucket, s.key)
}

// EnsureBucket ensures the bucket actually exists in S3.
func (s *S3Client) EnsureBucket(ctx context.Context) error {
	_, err := s.s3.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(s.bucket),
	})
	if err != nil {
		return fmt.Errorf("failed to create bucket %v: %w", s.bucket, err)
	}
	return nil
}

// Upload uploads data to S3.
func (s *S3Client) Upload(ctx context.Context, reader io.Reader, id string) error {
	key := s.key
	if s.timestamp {
		if s.now == nil {
			s.now = func() time.Time {
				return time.Now().UTC()
			}
		}
		key = TimestampedPath(key, s.now())
	}
	input := &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Body:   reader,
	}

	if id != "" {
		input.Metadata = map[string]string{
			AWSS3IDKey: id,
		}
	}
	_, err := s.uploader.Upload(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to upload to %v: %w", s, err)
	}
	return nil
}

// CurrentID returns the last ID uploaded to S3.
func (s *S3Client) CurrentID(ctx context.Context) (string, error) {
	input := &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key),
	}

	result, err := s.s3.HeadObject(ctx, input)
	if err != nil {
		return "", fmt.Errorf("failed to get object head for %v: %w", s, err)
	}

	id, ok := result.Metadata[AWSS3IDKey]
	if !ok {
		return "", fmt.Errorf("sum metadata not found for %v", s)
	}
	return id, nil
}

// Download downloads data from S3.
func (s *S3Client) Download(ctx context.Context, writer io.WriterAt) error {
	_, err := s.downloader.Download(ctx, writer, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key),
	})
	if err != nil {
		return fmt.Errorf("failed to download from %v: %w", s, err)
	}
	return nil
}

// Delete deletes object from S3.
func (s *S3Client) Delete(ctx context.Context) error {
	_, err := s.s3.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete %v: %w", s, err)
	}
	return nil
}

// TimestampedPath returns a new path with the given timestamp prepended.
// If path contains /, the timestamp is prepended to the last segment.
func TimestampedPath(path string, t time.Time) string {
	parts := strings.Split(path, "/")
	parts[len(parts)-1] = fmt.Sprintf("%s_%s", t.Format("20060102150405"), parts[len(parts)-1])
	return strings.Join(parts, "/")
}

func isAWSEndpoint(s string) bool {
	return strings.HasSuffix(s, "amazonaws.com")
}

func hasProtocol(s string) bool {
	return strings.Contains(s, "://")
}

type uploader interface {
	Upload(ctx context.Context, input *s3.PutObjectInput, opts ...func(*manager.Uploader)) (*manager.UploadOutput, error)
}

type downloader interface {
	Download(ctx context.Context, w io.WriterAt, input *s3.GetObjectInput, opts ...func(*manager.Downloader)) (n int64, err error)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2846** (2026-10-05): **Simplify runWALSnapshot logic**
  *Symptoms*: 

- **Issue #2845** (2026-10-05): **Check Raft Snapshot threshold every 5 seconds by default**
  *Symptoms*: 10 seconds is a long time if there write load is high, so check more often. The overhead on the system of checking every 5 seconds is still trivial.

- **Issue #2844** (2026-10-05): **Verify WAL-related SQLite compile-time options**
  *Symptoms*: 

- **Issue #2842** (2026-10-04): **Claude GitHub 2795 drivers**
  *Symptoms*: 

- **Issue #2841** (2026-10-04): **Disable autocheckpointing at connect time**
  *Symptoms*: If the underlying driver timed out, it would create its own connection without disabling autocheckpointing. 

- **Issue #2840** (2026-10-04): **Emit CDC events for every request in a bulk request**
  *Symptoms*: 

- **Issue #2839** (2026-10-03): **Don't clear CDC streamer index after Commit or Rollback**
  *Symptoms*: 

- **Issue #2837** (2026-10-01): **More Console Topology improvements**
  *Symptoms*: 

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

### Incident Patch 1: `752a8959` (2026-10-01)
**Commit Message**: UI should use "read replicas"

**File**: `http/console/index.html` (modified, +3/-2)
```diff
@@ -41,6 +41,7 @@ <h2>Topology</h2>
                     <p id="cluster-perspective" class="cluster-muted">Membership and reachability</p>
                 </div>
                 <div class="cluster-controls">
+                    <label><input type="checkbox" id="cluster-show-read-replicas" checked> Show read replicas</label>
                     <label><input type="checkbox" id="cluster-auto-refresh" checked> Auto-refresh (5s)</label>
                     <button type="button" id="cluster-refresh">Refresh</button>
                 </div>
@@ -58,7 +59,7 @@ <h2>Topology</h2>
                     <span><i class="cluster-dot is-unreachable"></i> Unreachable</span>
                     <span><i class="cluster-dot is-unknown"></i> Unknown / stale</span>
                     <span><i class="cluster-line-key"></i> Voter</span>
-                    <span><i class="cluster-line-key is-replica"></i> Read-only</span>
+                    <span><i class="cluster-line-key is-replica"></i> Read Replica</span>
                 </div>
             </div>
             <p class="cluster-footnote">Connections show replication relationships. Reachability is checked from the node serving this console; it does not measure every connection or replication health.</p>
@@ -98,7 +99,7 @@ <h2>Topology</h2>
             <div id="status-cards" class="cards"></div>
             <div class="nodes-header">
                 <h3>Nodes</h3>
-                <label class="nodes-option"><input type="checkbox" id="show-nonvoters"> Include non-voters</label>
+                <label class="nodes-option"><input type="checkbox" id="show-nonvoters"> Include read replicas</label>
             </div>
             <div id="nodes-table"></div>
             <div id="detail-sections"></div>
```

**File**: `http/console/static/js/cluster.js` (modified, +10/-6)
```diff
@@ -19,7 +19,7 @@
         nodes.forEach(function (node) {
             node.isLeader = node === leader;
             node.role = node.isLeader ? (node.leader ? "Leader" : "Reported leader") :
-                (node.voter ? "Follower" : "Read-only");
+                (node.voter ? "Follower" : "Read Replica");
             // Without a known leader, we cannot infer a voting node's Raft state.
             if (!leader && node.voter) node.role = "Voter";
         });
@@ -58,6 +58,7 @@
     var summary = document.getElementById("cluster-summary");
     var refresh = document.getElementById("cluster-refresh");
     var auto = document.getElementById("cluster-auto-refresh");
+    var showReadReplicas = document.getElementById("cluster-show-read-replicas");
     var message = document.getElementById("cluster-message");
     var updated = document.getElementById("cluster-updated");
     var model = null;
@@ -100,15 +101,17 @@
     }
 
     function render() {
-        var geometry = layout(model);
+        var visibleNodes = model.nodes.filter(function (node) { return showReadReplicas.checked || node.voter; });
+        var visibleLeader = visibleNodes.find(function (node) { return node.isLeader; });
+        var geometry = layout(Object.assign({}, model, { nodes: visibleNodes, leader: visibleLeader }));
         map.style.height = geometry.height + "px";
         svg.setAttribute("viewBox", "0 0 " + geometry.width + " " + geometry.height);
         svg.replaceChildren();
         var voters = model.nodes.filter(function (n) { return n.voter; }).length;
         var reachable = model.nodes.filter(function (n) { return n.reachable === true; }).length;
         summary.innerHTML = [
             [model.nodes.length, "Nodes"], [voters, "Voters"],
-            [model.nodes.length - voters, "Read-only"],
+            [model.nodes.length - voters, "Read Replicas"],
             [stale ? "—" : reachable + " / " + model.nodes.length, "Reachable"]
         ].map(function (item) {
             return '<div><strong>' + item[0] + '</strong><span>' + item[1] + '</span></div>';
@@ -119,10 +122,10 @@
         cards.forEach(function (card, id) {
             if (!geometry.positions.has(id)) { card.wrapper.remove(); cards.delete(id); }
         });
-        model.nodes.forEach(function (node) {
+        visibleNodes.forEach(function (node) {
             var position = geometry.positions.get(node.id);
-            if (model.leader && !node.isLeader) {
-                var origin = geometry.positions.get(model.leader.id);
+            if (visibleLeader && !node.isLeader) {
+                var origin = geometry.positions.get(visibleLeader.id);
                 var line = document.createElementNS(svg.namespaceURI, "line");
                 line.setAttribute("x1", origin.x);
                 line.setAttribute("y1", origin.y);
@@ -220,6 +223,7 @@
     }
 
     refresh.addEventListener("click", load);
+    showReadReplicas.addEventListener("change", function () { if (model) render(); });
     auto.addEventListener("change", function () { if (auto.checked) load(); else clearTimeout(timer); });
     function visibilityChanged() {
         if (active()) load();
```

---

### Incident Patch 2: `16d65079` (2026-10-01)
**Commit Message**: Add new Cluster tab to web UI

**File**: `http/console/static/css/cluster.css` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
+#cluster {
+    --cluster-node-bg: #fff;
+    --cluster-node-hover: #f5f8fc;
+    --cluster-node-border: #8292a6;
+    --cluster-node-shadow: 0 4px 14px rgba(20, 40, 65, 0.18);
+}
+[data-theme="dark"] #cluster {
+    --cluster-node-bg: #243650;
+    --cluster-node-hover: #2b4162;
+    --cluster-node-border: #7387a3;
+    --cluster-node-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
+}
+.cluster-toolbar, .cluster-controls, .cluster-map-heading, .cluster-legend {
+    display: flex;
+    align-items: center;
+    justify-content: space-between;
+    gap: 1rem;
+    flex-wrap: wrap;
+}
+.cluster-toolbar { margin-bottom: 1.25rem; }
+.cluster-toolbar h2 { font-size: 1.4rem; font-weight: 600; }
+.cluster-muted, .cluster-controls, .cluster-footnote { color: var(--text-secondary); font-size: 0.8125rem; }
+.cluster-controls label { display: flex; align-items: center; gap: 0.4rem; }
+#cluster-refresh {
+    border: 1px solid var(--border);
+    border-radius: 5px;
+    background: var(--surface);
+    color: var(--text);
+    padding: 0.45rem 0.85rem;
+    cursor: pointer;
+}
+#cluster-refresh:hover { border-color: var(--accent); }
+#cluster-refresh:disabled { opacity: 0.6; cursor: wait; }
+.cluster-message { padding: 0.8rem 1rem; background: var(--surface); border-left: 3px solid var(--accent); margin-bottom: 1rem; font-size: 0.875rem; }
+.cluster-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
+.cluster-summary > div { background: var(--surface); border: 1px solid var(--border); border-radius: 7px; padding: 0.8rem 1rem; }
+.cluster-summary strong { font-size: 1.5rem; font-weight: 600; display: block; }
+.cluster-summary span { font-size: 0.75rem; color: var(--text-secondary); }
+.cluster-map-panel { border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
+.cluster-map-heading { padding: 1rem 1.2rem; font-size: 0.8125rem; border-bottom: 1px solid var(--border-light); }
+.cluster-map { position: relative; background-image: radial-gradient(var(--border-light) 1px, transparent 1px); background-size: 18px 18px; }
+.cluster-links { position: absolute; width: 100%; height: 100%; inset: 0; }
+.cluster-edge { stroke: var(--border); stroke-width: 2; }
+.cluster-edge.is-reachable { stroke: var(--success); opacity: 0.6; }
+.cluster-edge.is-unreachable { stroke: var(--error); opacity: 0.6; }
+.cluster-edge.is-replica { stroke-dasharray: 6 5; }
+.cluster-node { position: absolute; width: 235px; transform: translate(-50%, -50%); }
+.cluster-node:hover, .cluster-node:focus-within { z-index: 3; }
+.cluster-node-button {
+    display: block;
+    width: 100%;
+    padding: 0.85rem;
+    border: 2px solid var(--cluster-node-border);
+    border-radius: 9px;
+    background: var(--cluster-node-bg);
+    color: var(--text);
+    text-align: left;
+    font: inherit;
+    cursor: pointer;
+    box-shadow: var(--cluster-node-shadow);
+}
+.cluster-node-button.is-leader { border: 2px solid var(--accent); box-shadow: 0 0 0 4px var(--accent-shadow), var(--cluster-node-shadow); }
+.cluster-node-button.is-replica { border-style: dashed; }
+.cluster-node-button:hover, .cluster-node-button[aria-pressed="true"] { background: var(--cluster-node-hover); }
+.cluster-node-button:focus-visible, #cluster-refresh:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; }
+.cluster-node-heading { display: flex; gap: 0.6rem; align-items: center; margin-bottom: 0.7rem; }
+.cluster-node-heading > span:nth-child(2) { min-width: 0; }
+.cluster-node-heading strong { display: block; font-size: 0.875rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
+.cluster-node-role { display: block; font-size: 0.7rem; color: var(--text-secondary); }
+.cluster-node-icon { flex: 0 0 32px; height: 32px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 50%; color: var(--success-text); }
+.is-unreachable .cluster-node-icon { color: var(--error-text); }
+.is-unknown .cluster-node-icon { color: var(--text-muted); }
+.is-leader .cluster-node-icon { background: var(--accent); color: var(--surface); border-color: var(--accent); }
+.cluster-this-node { margin-left: auto; font-size: 0.6rem; white-space: nowrap; color: var(--accent); }
+.cluster-address { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.7rem; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
+.cluster-address b { display: inline-block; width: 2.5em; color: var(--text-secondary); font-weight: 400; }
+.cluster-node-health { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.65rem; font-size: 0.7rem; color: var(--text-secondary); }
+.cluster-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0; }
+.cluster-dot.is-reachable { background: var(--success); }
+.cluster-dot.is-unreachable { background: var(--error); }
+.cluster-legend {
```

**File**: `http/console/static/js/cluster.js` (added, +274/-0)
```diff
@@ -0,0 +1,274 @@
+/* Cluster topology: all observations come from the node serving this console. */
+(function () {
+    "use strict";
+
+    function topology(status, data) {
+        var store = status.store || {};
+        var reportedLeader = store.leader || {};
+        var nodes = data.nodes.slice().sort(function (a, b) {
+            return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
+        }).map(function (node) {
+            return Object.assign({}, node, { id: String(node.id) });
+        });
+        var leader = nodes.find(function (node) { return node.leader; });
+        if (!leader) {
+            leader = nodes.find(function (node) {
+                return node.id === String(reportedLeader.node_id) && node.addr === reportedLeader.addr;
+            });
+        }
+        nodes.forEach(function (node) {
+            node.isLeader = node === leader;
+            node.role = node.isLeader ? (node.leader ? "Leader" : "Reported leader") :
+                (node.voter ? "Follower" : "Read-only");
+            // Without a known leader, we cannot infer a voting node's Raft state.
+            if (!leader && node.voter) node.role = "Voter";
+        });
+        return { nodes: nodes, leader: leader, localID: String(store.node_id || "") };
+    }
+
+    function layout(model) {
+        var peers = model.nodes.filter(function (node) { return !node.isLeader; });
+        var positions = new Map();
+        var height = peers.length === 0 && model.leader ? 250 : peers.length === 2 ? 470 : 610;
+        if (model.leader) positions.set(model.leader.id, { x: 450, y: peers.length === 0 ? 125 : peers.length === 2 ? 140 : 305 });
+        if (peers.length <= 6 && model.leader) {
+            peers.forEach(function (node, i) {
+                var angle = peers.length === 2 ? (i ? 1 : 5) * Math.PI / 6 :
+                    -Math.PI / 2 + i * 2 * Math.PI / Math.max(peers.length, 1);
+                positions.set(node.id, { x: 450 + 305 * Math.cos(angle), y: (peers.length === 2 ? 230 : 305) + 210 * Math.sin(angle) });
+            });
+        } else {
+            // Two stable columns leave a clear central lane for larger clusters.
+            height = Math.max(400, Math.ceil(peers.length / 2) * 180 + 60);
+            if (model.leader) positions.set(model.leader.id, { x: 450, y: height / 2 });
+            peers.forEach(function (node, i) {
+                positions.set(node.id, { x: i % 2 ? 755 : 145, y: 110 + Math.floor(i / 2) * 180 });
+            });
+        }
+        return { positions: positions, width: 900, height: height };
+    }
+
+    if (typeof module !== "undefined" && module.exports) {
+        module.exports = { topology: topology, layout: layout };
+        return;
+    }
+
+    var section = document.getElementById("cluster");
+    var map = document.getElementById("cluster-map");
+    var summary = document.getElementById("cluster-summary");
+    var details = document.getElementById("cluster-details");
+    var refresh = document.getElementById("cluster-refresh");
+    var auto = document.getElementById("cluster-auto-refresh");
+    var message = document.getElementById("cluster-message");
+    var updated = document.getElementById("cluster-updated");
+    var model = null;
+    var stale = false;
+    var selected = null;
+    var timer = null;
+    var busy = false;
+    var cards = new Map();
+    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
+    svg.classList.add("cluster-links");
+    svg.setAttribute("aria-hidden", "true");
+    svg.setAttribute("preserveAspectRatio", "none");
+    map.appendChild(svg);
+
+    function escape(value) {
+        return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
+            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
+        });
+    }
+
+    function health(node) {
+        return stale ? "unknown" : node.reachable === true ? "reachable" :
+            node.reachable === false ? "unreachable" : "unknown";
+    }
+
+    function healthLabel(node) {
+        return stale ? "Stale observation" : { reachable: "Reachable", unreachable: "Unreachable", unknown: "Unknown" }[health(node)];
+    }
+
+    function detailHTML(node) {
+        var rows = [
+            ["Role", node.role], ["Reachability", healthLabel(node)],
+            ["Raft address", node.addr || "Unavailable"],
+            ["API address", node.api_addr || "Unavailable"],
+            ["Version", node.version || "Unavailable"],
+            ["Probe time", node.time_s || "Unavailable"]
+        ];
+        if (node.error) rows.push(["Probe error", node.error]);
+        return '<strong>Node ' + escape(node.id) + '</strong><dl>' + rows.map(function (row) {
+            return '<div><dt>' + row[0] + '</dt><dd>' + escape(row[1]) + '</dd></div>';
+        }).join("") + '</dl>';
+    }
+
+    function renderSelection() {
+        var node = model.nodes.find(funct
```

**File**: `http/console/static/js/core.js` (added, +202/-0)
```diff
@@ -0,0 +1,202 @@
+/* Pure helpers shared by the console and its dependency-free tests. */
+(function (root) {
+    "use strict";
+
+    // Keep unsafe JSON numbers as their original literals, not rounded Numbers.
+    function ExactNumber(literal) { this.literal = literal; }
+    ExactNumber.prototype.toString = function () { return this.literal; };
+    ExactNumber.prototype.valueOf = function () { return Number(this.literal); };
+
+    function parseJSON(text) {
+        var numbers = [];
+        var marked = text.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, function (token) {
+            if (token[0] === '"') return token;
+            numbers.push(token);
+            return token;
+        });
+        // Validate before replacing numeric tokens, so malformed JSON cannot
+        // become valid as a side effect of the lossless conversion.
+        var validated = JSON.stringify(JSON.parse(marked));
+        var index = 0;
+        var prefix = "__rqlite_number__";
+        while (validated.indexOf(prefix) !== -1) prefix += "_";
+        marked = text.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, function (token) {
+            if (token[0] === '"') return token;
+            var n = Number(token);
+            var id = index++;
+            if (!Number.isFinite(n) || (Number.isInteger(n) && !Number.isSafeInteger(n))) {
+                return JSON.stringify(prefix + id);
+            }
+            return token;
+        });
+        return JSON.parse(marked, function (_, value) {
+            if (typeof value === "string" && value.indexOf(prefix) === 0) {
+                return new ExactNumber(numbers[Number(value.slice(prefix.length))]);
+            }
+            return value;
+        });
+    }
+
+    function stringifyJSON(value, pretty) {
+        function encode(v, depth) {
+            if (v instanceof ExactNumber) return v.literal;
+            if (v === null || typeof v !== "object") return JSON.stringify(v);
+            var array = Array.isArray(v);
+            var keys = array ? v.map(function (_, i) { return i; }) : Object.keys(v);
+            var parts = keys.map(function (key) {
+                return (array ? "" : JSON.stringify(key) + (pretty ? ": " : ":")) + encode(v[key], depth + 1);
+            });
+            var open = array ? "[" : "{";
+            var close = array ? "]" : "}";
+            if (!parts.length) return open + close;
+            if (!pretty) return open + parts.join(",") + close;
+            var indent = "  ".repeat(depth + 1);
+            return open + "\n" + indent + parts.join(",\n" + indent) + "\n" + "  ".repeat(depth) + close;
+        }
+        return encode(value, 0);
+    }
+
+    function cellText(value) {
+        if (value === null || value === undefined) return "NULL";
+        if (value instanceof ExactNumber) return value.literal;
+        return typeof value === "object" ? stringifyJSON(value) : String(value);
+    }
+
+    function csvCell(value) {
+        if (value === null || value === undefined) return "NULL";
+        var s = cellText(value);
+        // Quote literal NULL and empty strings to distinguish them from nulls.
+        return /[",\r\n]/.test(s) || s === "NULL" || s === "" ? '"' + s.replace(/"/g, '""') + '"' : s;
+    }
+
+    function resultCSV(result) {
+        return [result.columns.map(csvCell).join(",")].concat((result.values || []).map(function (row) {
+            return result.columns.map(function (_, i) { return csvCell(row[i]); }).join(",");
+        })).join("\r\n");
+    }
+
+    // SQLite strings, quoted identifiers, and comments must stay intact when
+    // splitting scripts. Retain token offsets for editor highlighting, too.
+    function sqlTokens(sql, tolerant) {
+        var tokens = [];
+        var i = 0;
+        while (i < sql.length) {
+            var start = i;
+            var c = sql[i];
+            var kind = "punctuation";
+            if (/\s/.test(c)) {
+                kind = "space";
+                while (i < sql.length && /\s/.test(sql[i])) i++;
+            } else if (sql.slice(i, i + 2) === "--") {
+                kind = "comment";
+                while (i < sql.length && sql[i] !== "\n") i++;
+            } else if (sql.slice(i, i + 2) === "/*") {
+                kind = "comment";
+                var end = sql.indexOf("*/", i + 2);
+                i = end < 0 ? sql.length : end + 2;
+                if (end < 0 && !tolerant) throw new Error("Unclosed SQL comment.");
+            } else if (c === "'" || c === '"' || c === "`" || c === "[") {
+                kind = c === "'" ? "string" : "identifier";
+                var close = c === "[" ? "]" : c;
+                var closed = false;
+                i++;
+                while (i < sql.length) {
+                    if (sql[i++] === close) {
+                        if (close !== "]" && sql[i] === close) { i++; continue; }
+                        closed = true;
+                    
```

---

### Incident Patch 3: `af22fead` (2026-09-29)
**Commit Message**: Update build-windows.yml to Go 1.27

**File**: `.github/workflows/build-windows.yml` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ jobs:
     - name: Set up Go
       uses: actions/setup-go@v5
       with:
-        go-version: '1.26'
+        go-version: '1.27'
 
     - name: Install C Compiler
       run: choco install mingw
```

---

### Incident Patch 4: `dbd5d78b` (2026-09-29)
**Commit Message**: Log, don't panic

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@
 - [PR #2827](https://github.com/rqlite/rqlite/pull/2827): Support configurable queued-writes retries. See [torx #17](https://github.com/dotnwat/torx/issues/17). Thanks @dotnwat
 
 ### Implementation changes and bug fixes
+- [PR #2830](https://github.com/rqlite/rqlite/pull/2830): Log-fatal, don't panic.
 - [PR #2828](https://github.com/rqlite/rqlite/pull/2828): DB `Dump()` returns number of bytes written.
 - [PR #2821](https://github.com/rqlite/rqlite/pull/2821): HTTP layer performs Backup directly, setting _Trailer_ HTTP header `X-STREAM-ERROR` on error.
 
```

**File**: `store/command_processor.go` (modified, +6/-6)
```diff
@@ -45,35 +45,35 @@ func NewCommandProcessor(logger *log.Logger, dm *chunking.DechunkerManager) *Com
 func (c *CommandProcessor) Process(data []byte, db *sql.SwappableDB) (*proto.Command, bool, any) {
 	cmd := &proto.Command{}
 	if err := command.Unmarshal(data, cmd); err != nil {
-		panic(fmt.Sprintf("failed to unmarshal cluster command: %s", err.Error()))
+		c.logger.Fatalf("failed to unmarshal cluster command: %s", err.Error())
 	}
 
 	switch cmd.Type {
 	case proto.Command_COMMAND_TYPE_QUERY:
 		var qr proto.QueryRequest
 		if err := command.UnmarshalSubCommand(cmd, &qr); err != nil {
-			panic(fmt.Sprintf("failed to unmarshal query subcommand: %s", err.Error()))
+			c.logger.Fatalf("failed to unmarshal query subcommand: %s", err.Error())
 		}
 		r, err := db.Query(qr.Request, qr.Timings)
 		return cmd, false, &fsmQueryResponse{rows: r, error: err}
 	case proto.Command_COMMAND_TYPE_EXECUTE:
 		var er proto.ExecuteRequest
 		if err := command.UnmarshalSubCommand(cmd, &er); err != nil {
-			panic(fmt.Sprintf("failed to unmarshal execute subcommand: %s", err.Error()))
+			c.logger.Fatalf("failed to unmarshal execute subcommand: %s", err.Error())
 		}
 		r, err := db.Execute(er.Request, er.Timings)
 		return cmd, true, &fsmExecuteQueryResponse{results: r, error: err}
 	case proto.Command_COMMAND_TYPE_EXECUTE_QUERY:
 		var eqr proto.ExecuteQueryRequest
 		if err := command.UnmarshalSubCommand(cmd, &eqr); err != nil {
-			panic(fmt.Sprintf("failed to unmarshal execute-query subcommand: %s", err.Error()))
+			c.logger.Fatalf("failed to unmarshal execute-query subcommand: %s", err.Error())
 		}
 		r, err := db.Request(eqr.Request, eqr.Timings)
 		return cmd, ExecuteQueryResponses(r).Mutation(), &fsmExecuteQueryResponse{results: r, error: err}
 	case proto.Command_COMMAND_TYPE_LOAD:
 		var lr proto.LoadRequest
 		if err := command.UnmarshalLoadRequest(cmd.SubCommand, &lr); err != nil {
-			panic(fmt.Sprintf("failed to unmarshal load subcommand: %s", err.Error()))
+			c.logger.Fatalf("failed to unmarshal load subcommand: %s", err.Error())
 		}
 
 		// create a scratch file in the same directory as s.db.Path()
@@ -97,7 +97,7 @@ func (c *CommandProcessor) Process(data []byte, db *sql.SwappableDB) (*proto.Com
 	case proto.Command_COMMAND_TYPE_LOAD_CHUNK:
 		var lcr proto.LoadChunkRequest
 		if err := command.UnmarshalLoadChunkRequest(cmd.SubCommand, &lcr); err != nil {
-			panic(fmt.Sprintf("failed to unmarshal load-chunk subcommand: %s", err.Error()))
+			c.logger.Fatalf("failed to unmarshal load-chunk subcommand: %s", err.Error())
 		}
 
 		dec, err := c.decMgmr.Get(lcr.StreamId)
```

---

### Incident Patch 5: `8ce683c5` (2026-09-28)
**Commit Message**: Update bug_report.md

**File**: `.github/ISSUE_TEMPLATE/bug_report.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ labels: ''
 assignees: ''
 
 ---
-_If you use AI to generate a bug report, state the Agent version you are using, and show clearly how to reproduce the issue. For example if you say some simple action crashes rqlite then show step-by-step how to reproduce the crash. If you say lines in the code are buggy, then link to the actual lines in the source. If you say you have a test or benchmark that shows the issue, then include code. If these guidelines are not followed, then issue may be closed without comment._
+_If you used AI to identify an issue, or generate a bug report, state the Agent you are using, and show clearly how to reproduce the issue. For example if you say some simple action crashes rqlite then show step-by-step how to reproduce the crash. If you say lines in the code are buggy, then link to the actual lines in the source. If you say you have a test or benchmark that shows the issue, then include code. If these guidelines are not followed, then issue may be closed without comment._
 
 **What version are you running?**
 
```

---

### Incident Patch 6: `9ac32697` (2026-09-28)
**Commit Message**: CDC can now require creds for HWM updates

**File**: `CHANGELOG.md` (modified, +5/-2)
```diff
@@ -1,8 +1,11 @@
-## v10.3.7 (unreleased)
+## v10.3.7 (September 28th 2026)
+This release addresses a gap in the role-based access permissions related to change-data-capture handling. If you run a cluster where the Raft port is accesible by other systems you should upgrade (though that is not recommended production practise in the first place -- see the [rqlite Security guide](https://rqlite.io/docs/guides/security/)).
+
 ### Implementation changes and bug fixes
 - [PR #2822](https://github.com/rqlite/rqlite/pull/2822): Backup calls now return number of bytes written.
 - [PR #2823](https://github.com/rqlite/rqlite/pull/2823): Stop CI testing against MinIO.
 - [PR #2824](https://github.com/rqlite/rqlite/pull/2824): Database `Backup` returns size of backup file.
+- [PR #2826](https://github.com/rqlite/rqlite/pull/2826): Add new permission for CDC high watermark updates. Fixes issue [#2825](https://github.com/rqlite/rqlite/issues/2825). Thanks @White0xdi3
 
 ## v10.3.6 (September 22nd 2026)
 ### Implementation changes and bug fixes
@@ -13,7 +16,7 @@
 - [PR #2811](https://github.com/rqlite/rqlite/pull/2811): Upgrade dependencies.
 - [PR #2811](https://github.com/rqlite/rqlite/pull/2811): Add support for _File_ Renaming and Removing with retries.
 - [PR #2816](https://github.com/rqlite/rqlite/pull/2816): Replace standard library with fsutil.
-- [PR #2817](https://github.com/rqlite/rqlite/pull/2817): File _Rename_ and _Remove_ are retried, addressing possible errors on Windows. Fixes issue [#2813](https://github.com/rqlite/rqlite/issues/2813). Thanks@orrery-dev
+- [PR #2817](https://github.com/rqlite/rqlite/pull/2817): File _Rename_ and _Remove_ are retried, addressing possible errors on Windows. Fixes issue [#2813](https://github.com/rqlite/rqlite/issues/2813). Thanks @orrery-dev
 - [PR #2812](https://github.com/rqlite/rqlite/pull/2812): Keep snapshot ordering correct regardless of clock. Fixes issue [#2809](https://github.com/rqlite/rqlite/issues/2809). Thanks @goingforstudying-ctrl, @rohanpadhy
 - [PR #2819](https://github.com/rqlite/rqlite/pull/2819): Remove snapshot name generation ID, backing out [PR #2807](https://github.com/rqlite/rqlite/pull/2807) and [PR #2808](https://github.com/rqlite/rqlite/pull/2808).
 
```

**File**: `auth/credential_store.go` (modified, +3/-1)
```diff
@@ -37,8 +37,10 @@ const (
 	PermLoad = "load"
 	// PermSnapshot means user can request a snapshot.
 	PermSnapshot = "snapshot"
-	// PermLeaderOps means user can perform leader-related operations
+	// PermLeaderOps means user can perform leader-related operations.
 	PermLeaderOps = "leader-ops"
+	// PermCDCHWMUpdate = means a user can perform CDC high watermark updates.
+	PermCDCHWMUpdate = "cdc-hwm-update"
 	// PermUI means user can access the UI.
 	PermUI = "ui"
 )
```

**File**: `cdc/cdc_cluster.go` (modified, +15/-1)
```diff
@@ -2,9 +2,11 @@ package cdc
 
 import (
 	"context"
+	"sync"
 	"time"
 
 	"github.com/rqlite/rqlite/v10/cluster"
+	"github.com/rqlite/rqlite/v10/cluster/proto"
 	"github.com/rqlite/rqlite/v10/store"
 )
 
@@ -14,6 +16,9 @@ type CDCCluster struct {
 	store  *store.Store
 	clstr  *cluster.Service
 	client *cluster.Client
+
+	mu    sync.RWMutex
+	creds *proto.Credentials
 }
 
 // NewCDCCluster creates a new CDCCluster instance with the given store,
@@ -59,6 +64,15 @@ func (c *CDCCluster) BroadcastHighWatermark(value uint64) error {
 	const timeout = 5 * time.Second
 
 	// Broadcast to all cluster nodes
-	_, err = c.client.BroadcastHWM(context.Background(), value, retries, timeout, nodeAddrs...)
+	c.mu.RLock()
+	_, err = c.client.BroadcastHWM(context.Background(), value, c.creds, retries, timeout, nodeAddrs...)
+	c.mu.RUnlock()
 	return err
 }
+
+// SetAuth sets credentials for broadcasting to other nodes.
+func (c *CDCCluster) SetAuth(creds *proto.Credentials) {
+	c.mu.Lock()
+	defer c.mu.Unlock()
+	c.creds = creds
+}
```

**File**: `cdc/service.go` (modified, +5/-1)
```diff
@@ -6,6 +6,7 @@ import (
 	"log"
 	"os"
 	"path/filepath"
+	"strings"
 	"sync"
 	"sync/atomic"
 	"time"
@@ -609,7 +610,10 @@ func (s *Service) leaderHWMLoop() (chan struct{}, chan struct{}) {
 				// followers get the update even if there are no new events,
 				// or nodes that join the cluster get the current HWM.
 				if err := s.clstr.BroadcastHighWatermark(hwm); err != nil {
-					s.logger.Printf("error broadcasting high watermark to Cluster: %v", err)
+					s.logger.Printf("error broadcasting high watermark to Cluster - this will affect CDC operation: %v", err)
+					if strings.Contains(err.Error(), "unauthorized") {
+						s.logger.Println("did you forget to set authentication credentials for cdc-hwm-update?")
+					}
 				}
 				// While we always broadcast the high watermark, we only prune the
 				// FIFO if it has advanced since the last time we did so. There
```

**File**: `cluster/client.go` (modified, +2/-1)
```diff
@@ -567,7 +567,7 @@ func (c *Client) Join(ctx context.Context, jr *command.JoinRequest, nodeAddr str
 }
 
 // BroadcastHWM performs a broadcast to all specified nodes.
-func (c *Client) BroadcastHWM(ctx context.Context, hwm uint64, retries int, timeout time.Duration, nodeAddr ...string) (map[string]*proto.HighwaterMarkUpdateResponse, error) {
+func (c *Client) BroadcastHWM(ctx context.Context, hwm uint64, creds *proto.Credentials, retries int, timeout time.Duration, nodeAddr ...string) (map[string]*proto.HighwaterMarkUpdateResponse, error) {
 	if err := ctx.Err(); err != nil {
 		return nil, err
 	}
@@ -610,6 +610,7 @@ func (c *Client) BroadcastHWM(ctx context.Context, hwm uint64, retries int, time
 				Request: &proto.Command_HighwaterMarkUpdateRequest{
 					HighwaterMarkUpdateRequest: br,
 				},
+				Credentials: creds,
 			}
 
 			// Attempt with retries
```

**File**: `cluster/client_test.go` (modified, +51/-4)
```diff
@@ -744,7 +744,7 @@ func Test_ClientBroadcast(t *testing.T) {
 
 	c := NewClient(&simpleDialer{}, 0)
 	c.SetLocal("node1", nil) // Set local node address to match test expectation
-	responses, err := c.BroadcastHWM(context.Background(), 12345, 0, time.Second, srv.Addr())
+	responses, err := c.BroadcastHWM(context.Background(), 12345, nil, 0, time.Second, srv.Addr())
 	if err != nil {
 		t.Fatal(err)
 	}
@@ -793,7 +793,7 @@ func Test_ClientBroadcast_MultipleNodes(t *testing.T) {
 
 	c := NewClient(&simpleDialer{}, 0)
 	c.SetLocal("test-node", nil) // Set local node address to match test expectation
-	responses, err := c.BroadcastHWM(context.Background(), 999, 0, time.Second, srv1.Addr(), srv2.Addr())
+	responses, err := c.BroadcastHWM(context.Background(), 999, nil, 0, time.Second, srv1.Addr(), srv2.Addr())
 	if err != nil {
 		t.Fatal(err)
 	}
@@ -809,7 +809,7 @@ func Test_ClientBroadcast_MultipleNodes(t *testing.T) {
 
 func Test_ClientBroadcast_EmptyNodeList(t *testing.T) {
 	c := NewClient(&simpleDialer{}, 0)
-	responses, err := c.BroadcastHWM(context.Background(), 1, 0, time.Second)
+	responses, err := c.BroadcastHWM(context.Background(), 1, nil, 0, time.Second)
 	if err != nil {
 		t.Fatal(err)
 	}
@@ -842,7 +842,54 @@ func Test_ClientBroadcast_WithError(t *testing.T) {
 
 	c := NewClient(&simpleDialer{}, 0)
 	c.SetLocal("node1", nil) // Set local node address to match test expectation
-	responses, err := c.BroadcastHWM(context.Background(), 12345, 0, time.Second, srv.Addr())
+	responses, err := c.BroadcastHWM(context.Background(), 12345, nil, 0, time.Second, srv.Addr())
+	if err != nil {
+		t.Fatal(err)
+	}
+	if len(responses) != 1 {
+		t.Fatalf("expected 1 response, got %d", len(responses))
+	}
+	resp, exists := responses[srv.Addr()]
+	if !exists {
+		t.Fatalf("response for %s not found", srv.Addr())
+	}
+	if resp.Error != "test error" {
+		t.Fatalf("expected 'test error', got '%s'", resp.Error)
+	}
+}
+
+func Test_ClientBroadcast_WithCreds(t *testing.T) {
+	srv := servicetest.NewService()
+	srv.Handler = func(conn net.Conn) {
+		var p []byte
+		var err error
+		c := readCommand(conn)
+		if c == nil {
+			return
+		}
+		if c.Credentials == nil {
+			t.Fatal("got nil credentials")
+		}
+		if c.Credentials.Username != "bob" || c.Credentials.Password != "passwd" {
+			t.Fatal("got wrong credentials")
+		}
+		if c.Type != proto.Command_COMMAND_TYPE_HIGHWATER_MARK_UPDATE {
+			t.Fatalf("unexpected command type: %d", c.Type)
+		}
+
+		p, err = pb.Marshal(&proto.HighwaterMarkUpdateResponse{Error: "test error"})
+		if err != nil {
+			conn.Close()
+		}
+		writeBytesWithLength(conn, p)
+	}
+	srv.Start()
+	defer srv.Close()
+
+	c := NewClient(&simpleDialer{}, 0)
+	c.SetLocal("node1", nil) // Set local node address to match test expectation
+	creds := &proto.Credentials{Username: "bob", Password: "passwd"}
+	responses, err := c.BroadcastHWM(context.Background(), 12345, creds, 0, time.Second, srv.Addr())
 	if err != nil {
 		t.Fatal(err)
 	}
```

**File**: `cluster/service.go` (modified, +2/-0)
```diff
@@ -665,6 +665,8 @@ func (s *Service) handleConn(conn net.Conn) {
 			br := c.GetHighwaterMarkUpdateRequest()
 			if br == nil {
 				resp.Error = "HighwaterMarkUpdateRequest is nil"
+			} else if !s.checkCommandPerm(c, auth.PermCDCHWMUpdate) {
+				resp.Error = "unauthorized"
 			} else {
 				// Send to registered channel if available
 				s.hwmMu.RLock()
```

**File**: `cluster/service_test.go` (modified, +60/-2)
```diff
@@ -444,7 +444,7 @@ func Test_ServiceHandleHighwaterMarkUpdate(t *testing.T) {
 	c.SetLocal("test-node", nil)
 
 	// Use the client to send a highwater mark update
-	responses, err := c.BroadcastHWM(context.Background(), 987654, 0, 5*time.Second, s.Addr())
+	responses, err := c.BroadcastHWM(context.Background(), 987654, nil, 0, 5*time.Second, s.Addr())
 	if err != nil {
 		t.Fatalf("failed to broadcast highwater mark update: %s", err)
 	}
@@ -484,7 +484,7 @@ func Test_ServiceRegisterHWMUpdate(t *testing.T) {
 
 	// Use the client to send a highwater mark update
 	testHWM := uint64(123456)
-	responses, err := c.BroadcastHWM(context.Background(), testHWM, 0, 5*time.Second, s.Addr())
+	responses, err := c.BroadcastHWM(context.Background(), testHWM, nil, 0, 5*time.Second, s.Addr())
 	if err != nil {
 		t.Fatalf("failed to broadcast highwater mark update: %s", err)
 	}
@@ -511,6 +511,64 @@ func Test_ServiceRegisterHWMUpdate(t *testing.T) {
 	}
 }
 
+// Test_ServiceRegisterHWMUpdate_WithAuth checks that the CDC service checks credentials.
+func Test_ServiceRegisterHWMUpdate_WithAuth(t *testing.T) {
+	creds := &proto.Credentials{Username: "bob", Password: "passwd"}
+	ml := mustNewMockTransport()
+	mgr := mustNewMockManager()
+	credStr := mustNewMockCredentialStore()
+	credStr.aaFunc = func(username, password, perm string) bool {
+		return username == creds.Username && password == creds.Password
+	}
+	s := New(ml, mustNewMockDatabase(), mgr, credStr)
+	if s == nil {
+		t.Fatalf("failed to create cluster service")
+	}
+
+	if err := s.Open(); err != nil {
+		t.Fatalf("failed to open cluster service")
+	}
+	defer s.Close()
+
+	// Create a client and send highwater mark update
+	c := NewClient(ml, 30*time.Second)
+	c.SetLocal("test-node", nil)
+
+	// Use the client to send a highwater mark update
+	testHWM := uint64(123456)
+	responses, err := c.BroadcastHWM(context.Background(), testHWM, creds, 0, 5*time.Second, s.Addr())
+	if err != nil {
+		t.Fatalf("failed to broadcast highwater mark update: %s", err)
+	}
+
+	// Check that we got a response for the service address
+	resp, ok := responses[s.Addr()]
+	if !ok {
+		t.Fatalf("expected response for address %s", s.Addr())
+	}
+
+	// Check response has no error
+	if resp.Error != "" {
+		t.Fatalf("expected no error, got: %s", resp.Error)
+	}
+
+	// Change required creds and ensure auth kicks in to deny.
+	credStr.aaFunc = func(username, password, perm string) bool {
+		return username == creds.Username && password == "foo"
+	}
+	responses, err = c.BroadcastHWM(context.Background(), testHWM, creds, 0, 5*time.Second, s.Addr())
+	if err != nil {
+		t.Fatalf("failed to broadcast highwater mark update: %s", err)
+	}
+	resp, ok = responses[s.Addr()]
+	if !ok {
+		t.Fatalf("expected response for address %s", s.Addr())
+	}
+	if resp.Error != "unauthorized" {
+		t.Fatal("expected an error")
+	}
+}
+
 func Test_ServiceClosesIdleConnection(t *testing.T) {
 	ml := mustNewMockTransport()
 	s := New(ml, mustNewMockDatabase(), mustNewMockManager(), mustNewMockCredentialStore())
```

---

### Incident Patch 7: `0b3efe2d` (2026-09-22)
**Commit Message**: Merge pull request #2812 from goingforstudying-ctrl/fix/snapshot-naming-backwards-clock

Keep snapshot ordering correct when the clock moves backwards

**File**: `snapshot/DESIGN.md` (modified, +2/-0)
```diff
@@ -32,6 +32,8 @@ The result is that a slow node catching up via snapshot transfer no longer degra
 
 A snapshot is a directory under the store root. The directory name is the snapshot ID (derived from Raft term, index, and a timestamp). Each directory contains a `meta.json` file with Raft metadata and one or more data files.
 
+Snapshot IDs are generated so that a snapshot always sorts as newer than any existing snapshot with the same term and index: the timestamp field is the larger of the current wall-clock time and one more than the largest timestamp found among those existing snapshots. Ordering therefore stays correct even if the system clock moves backwards between the creation of two such snapshots.
+
 The snapshot type is determined by what files are present:
 
 - **Full snapshot**: Contains `data.db` (a valid SQLite database). May also contain zero or more `.wal` files. A full snapshot is always the base from which database state is reconstructed.
```

**File**: `snapshot/snaphot_namer_test.go` (modified, +93/-11)
```diff
@@ -8,6 +8,8 @@ import (
 	"sync"
 	"testing"
 	"time"
+
+	"github.com/hashicorp/raft"
 )
 
 // Test_NewSnapshotNamer_NilNowFn checks that a nil nowFn falls back to
@@ -22,7 +24,7 @@ func Test_NewSnapshotNamer_NilNowFn(t *testing.T) {
 	}
 
 	before := time.Now().UnixNano() / int64(time.Millisecond)
-	name := sn.MakeName(7, 8, 9)
+	name := sn.MakeName(SnapshotSet{}, 7, 8, 9)
 	after := time.Now().UnixNano() / int64(time.Millisecond)
 
 	term, index, msec, gen := parseName(t, name)
@@ -39,7 +41,7 @@ func Test_NewSnapshotNamer_CustomNowFn(t *testing.T) {
 	tm := time.Unix(1500000000, 0).UTC() // 1500000000000 msec
 	sn := NewSnapshotNamer(fixedClock(tm))
 
-	if got, want := sn.MakeName(1, 1, 0), "1-1-1500000000000"; got != want {
+	if got, want := sn.MakeName(SnapshotSet{}, 1, 1, 0), "1-1-1500000000000"; got != want {
 		t.Fatalf("got %q, want %q", got, want)
 	}
 }
@@ -70,7 +72,7 @@ func Test_MakeName_Format(t *testing.T) {
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
-			if got := sn.MakeName(tt.term, tt.index, tt.gen); got != tt.want {
+			if got := sn.MakeName(SnapshotSet{}, tt.term, tt.index, tt.gen); got != tt.want {
 				t.Fatalf("got %q, want %q", got, tt.want)
 			}
 		})
@@ -99,7 +101,7 @@ func Test_MakeName_TimestampTruncation(t *testing.T) {
 		t.Run(tt.name, func(t *testing.T) {
 			sn := NewSnapshotNamer(fixedClock(tt.now))
 			want := fmt.Sprintf("3-4-%d-1", tt.want)
-			if got := sn.MakeName(3, 4, 1); got != want {
+			if got := sn.MakeName(SnapshotSet{}, 3, 4, 1); got != want {
 				t.Fatalf("got %q, want %q", got, want)
 			}
 		})
@@ -116,7 +118,7 @@ func Test_MakeName_CallsNowFnOncePerCall(t *testing.T) {
 	})
 
 	for i := 0; i < 5; i++ {
-		sn.MakeName(uint64(i), uint64(i), 1)
+		sn.MakeName(SnapshotSet{}, uint64(i), uint64(i), 1)
 	}
 	if calls != 5 {
 		t.Fatalf("nowFn called %d times, want 5", calls)
@@ -129,8 +131,8 @@ func Test_MakeName_CallsNowFnOncePerCall(t *testing.T) {
 func Test_MakeName_CollidesWithinSameMillisecond(t *testing.T) {
 	sn := NewSnapshotNamer(fixedClock(time.Unix(1500000000, 0)))
 
-	first := sn.MakeName(1, 2, 3)
-	second := sn.MakeName(1, 2, 3)
+	first := sn.MakeName(SnapshotSet{}, 1, 2, 3)
+	second := sn.MakeName(SnapshotSet{}, 1, 2, 3)
 	if first != second {
 		t.Fatalf("got %q and %q, want identical names", first, second)
 	}
@@ -149,7 +151,7 @@ func Test_MakeName_DistinctInputsDistinctNames(t *testing.T) {
 	for _, tc := range []struct{ term, index uint64 }{
 		{1, 1}, {1, 2}, {2, 1}, {1, 1},
 	} {
-		name := sn.MakeName(tc.term, tc.index, 1)
+		name := sn.MakeName(SnapshotSet{}, tc.term, tc.index, 1)
 		if seen[name] {
 			t.Fatalf("duplicate name %q", name)
 		}
@@ -170,7 +172,7 @@ func Test_MakeName_Concurrent(t *testing.T) {
 		go func() {
 			defer wg.Done()
 			for j := 0; j < iterations; j++ {
-				if got := sn.MakeName(1, 2, 3); got != want {
+				if got := sn.MakeName(SnapshotSet{}, 1, 2, 3); got != want {
 					errs <- got
 				}
 			}
@@ -184,6 +186,86 @@ func Test_MakeName_Concurrent(t *testing.T) {
 	}
 }
 
+// Test_makeName_MinMsec checks that makeName raises the millisecond field to
+// the given minimum when the clock reads lower, and leaves it alone otherwise.
+func Test_makeName_MinMsec(t *testing.T) {
+	sn := NewSnapshotNamer(fixedClock(time.UnixMilli(1000)))
+
+	if got, want := sn.makeName(1, 2, 0, 1500), "1-2-1500"; got != want {
+		t.Fatalf("got %q, want %q", got, want)
+	}
+	if got, want := sn.makeName(1, 2, 3, 1500), "1-2-1500-3"; got != want {
+		t.Fatalf("got %q, want %q", got, want)
+	}
+	if got, want := sn.makeName(1, 2, 0, 500), "1-2-1000"; got != want {
+		t.Fatalf("got %q, want %q", got, want)
+	}
+	if got, want := sn.makeName(1, 2, 3, 1000), "1-2-1000-3"; got != want {
+		t.Fatalf("got %q, want %q", got, want)
+	}
+}
+
+// Test_MakeName_Set exercises set-aware name generation: a name made for a
+// term and index already present in the set must sort after every snapshot in
+// the set with that term and index.
+func Test_MakeName_Set(t *testing.T) {
+	mkSnap := func(id string, term, index uint64) *Snapshot {
+		return &Snapshot{id: id, raftMeta: &raft.SnapshotMeta{Term: term, Index: index}}
+	}
+
+	t.Run("clock backwards with same term and index", func(t *testing.T) {
+		set := SnapshotSet{dir: "/test", items: []*Snapshot{
+			mkSnap("3-100-1000", 3, 100),
+			mkSnap("3-100-1500-2", 3, 100),
+			mkSnap("3-101-9999", 3, 101),
+			mkSnap("4-100-9999", 4, 100),
+		}}
+		sn := NewSnapshotNamer(fixedClock(time.UnixMilli(500)))
+		if exp, got := "3-100-1501", sn.MakeName(set, 3, 100, 0); got != exp {
+			t.Fatalf("got %q, want %q", got, exp)
+		}
+	})
+
+	t.Run("clock ahead ignores floor", func(t *testing.T) {
+		set := SnapshotSet{dir: "/test", items: []*Snapshot{
+			mkSnap("3-100-1000", 3, 100),
+		}}
+		sn := NewSnapshotNamer(fixedClock(time.UnixMilli(2000)))
+		if exp, got := "3-100-2000", sn.MakeName(set, 3, 100, 0); got != exp {
+			t.Fatalf("got %q, want %q", got, exp)
+		}
+	})
+
+	t.Run("empty set"
```

**File**: `snapshot/snapshot_namer.go` (modified, +28/-3)
```diff
@@ -2,6 +2,7 @@ package snapshot
 
 import (
 	"fmt"
+	"math"
 	"strconv"
 	"strings"
 	"time"
@@ -21,11 +22,35 @@ func NewSnapshotNamer(nowFn func() time.Time) *SnapshotNamer {
 	return &SnapshotNamer{nowFn}
 }
 
-// MakeName returns a name for the Snapshot, for the given the term, index, and
-// and generation. If gen is less than 1, then no generation is present in the name.
-func (sn *SnapshotNamer) MakeName(term, index uint64, gen int64) string {
+// MakeName returns a name for the Snapshot, for the given snapshot set, term,
+// index, and generation. If gen is less than 1, then no generation is present
+// in the name.
+//
+// The name is generated so that it sorts as newer than every snapshot in the
+// set sharing the given term and index: the millisecond field is the larger of
+// the current wall-clock time and one more than the millisecond field of the
+// newest such snapshot. Ordering therefore stays correct even if the system
+// clock moved backwards since those snapshots were created.
+func (sn *SnapshotNamer) MakeName(set SnapshotSet, term, index uint64, gen int64) string {
+	minMsec := int64(math.MinInt64)
+	if newest, ok := set.WithTermIndex(term, index).Newest(); ok {
+		// A snapshot whose ID has no parsable timestamp cannot take part in
+		// the floor, so it is simply ignored.
+		if _, _, msec, _, err := ParseSnapshotName(newest.id); err == nil {
+			minMsec = msec + 1
+		}
+	}
+	return sn.makeName(term, index, gen, minMsec)
+}
+
+// makeName returns a name for the Snapshot, as MakeName does, but the
+// millisecond field is raised to minMsec if the current time is lower.
+func (sn *SnapshotNamer) makeName(term, index uint64, gen int64, minMsec int64) string {
 	now := sn.nowFn()
 	msec := now.UnixNano() / int64(time.Millisecond)
+	if msec < minMsec {
+		msec = minMsec
+	}
 	if gen < 1 {
 		return fmt.Sprintf("%d-%d-%d", term, index, msec)
 	}
```

**File**: `snapshot/state.go` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ func Clone(dir, id string, index, term uint64, gen int64) error {
 	}
 
 	snapshotNamer := NewSnapshotNamer(nil)
-	newID := snapshotNamer.MakeName(term, index, gen)
+	newID := snapshotNamer.MakeName(SnapshotSet{}, term, index, gen)
 	dstPath := filepath.Join(dir, newID)
 	if fsutil.PathExists(dstPath) {
 		return fmt.Errorf("snapshot %q already exists in %q", newID, dir)
```

**File**: `snapshot/store.go` (modified, +10/-3)
```diff
@@ -292,9 +292,16 @@ func NewStore(dir string) (*Store, error) {
 // Create creates a new snapshot sink for the given parameters.
 func (s *Store) Create(version raft.SnapshotVersion, index, term uint64, configuration raft.Configuration,
 	configurationIndex uint64, trans raft.Transport) (retSink raft.SnapshotSink, retErr error) {
+	// Read the store under a read lock so the scan cannot race with a reap.
+	s.mrsw.BeginReadBlocking()
+	snapSet, err := s.getSnapshots()
+	s.mrsw.EndRead()
+	if err != nil {
+		return nil, err
+	}
 	sink := NewSink(s.dir, &raft.SnapshotMeta{
 		Version:            version,
-		ID:                 s.snapshotNamer.MakeName(term, index, 0),
+		ID:                 s.snapshotNamer.MakeName(snapSet, term, index, 0),
 		Index:              index,
 		Term:               term,
 		Configuration:      configuration,
@@ -657,15 +664,15 @@ func (s *Store) reapInternal() (int, int, error) {
 		}
 
 		gen := int64(1)
-		newID := s.snapshotNamer.MakeName(newest.raftMeta.Term, newest.raftMeta.Index, gen)
+		newID := s.snapshotNamer.MakeName(snapSet, newest.raftMeta.Term, newest.raftMeta.Index, gen)
 		for {
 			finalDir := filepath.Join(s.dir, newID)
 			if !fsutil.DirExists(finalDir) {
 				// No ID collision, use it.
 				break
 			}
 			gen++
-			newID = s.snapshotNamer.MakeName(newest.raftMeta.Term, newest.raftMeta.Index, gen)
+			newID = s.snapshotNamer.MakeName(snapSet, newest.raftMeta.Term, newest.raftMeta.Index, gen)
 		}
 
 		newMeta := copyRaftMeta(newest.raftMeta)
```

**File**: `snapshot/store_test.go` (modified, +106/-15)
```diff
@@ -1054,10 +1054,10 @@ func Test_Store_Reap_Full_FullWALs(t *testing.T) {
 	}
 }
 
-// Test_Store_Reap_Full_FullWALs_NameCollision_NoGen tests reaping when the name
-// generated for the consolidated snapshot is identical to the name of the newest
-// full snapshot and the snapshot IDs don't use generations. This is the case with
-// older releases.
+// Test_Store_Reap_Full_FullWALs_NameCollision_NoGen tests reaping when the
+// clock reads the same millisecond recorded in the newest full snapshot's ID
+// and the snapshot IDs don't use generations, as with older releases. The
+// consolidated snapshot must still sort after the snapshot it replaces.
 func Test_Store_Reap_Full_FullWALs_NameCollision_NoGen(t *testing.T) {
 	dir := t.TempDir()
 	store, err := NewStore(dir)
@@ -1070,8 +1070,9 @@ func Test_Store_Reap_Full_FullWALs_NameCollision_NoGen(t *testing.T) {
 	createSnapshotInStore(t, store, "3-2000-2222222222222", 2000, 3, 1,
 		"testdata/db-and-wals/full2.db", "testdata/db-and-wals/full2-wal-00")
 
-	// Now use a fixed clock so we get the same timestamp when we reap. This should trigger a bump in
-	// generation from 0 (implied because it's not in the snapshot ID) to 1.
+	// Now use a fixed clock reading the same millisecond recorded in the
+	// newest snapshot's ID. The consolidated snapshot must sort strictly
+	// after it, so the millisecond field is bumped past the existing one.
 	store.snapshotNamer = NewSnapshotNamer(fixedClock(time.UnixMilli(2222222222222)))
 	if _, _, err := store.Reap(); err != nil {
 		t.Fatalf("Failed to reap snapshots: %v", err)
@@ -1086,14 +1087,15 @@ func Test_Store_Reap_Full_FullWALs_NameCollision_NoGen(t *testing.T) {
 	if err != nil {
 		t.Fatalf("failed to parse snapshot name: %s", err)
 	}
-	if term != 3 || index != 2000 || msec != 2222222222222 || gen != 1 {
+	if term != 3 || index != 2000 || msec != 2222222222223 || gen != 1 {
 		t.Fatalf("incorrect snapshot ID, got %d, %d, %d, %d", term, index, msec, gen)
 	}
 }
 
-// Test_Store_Reap_Full_FullWALs_NameCollision_WithGen tests reaping when the name
-// generated for the consolidated snapshot is identical to the name of the newest
-// full snapshot and generations are in use.
+// Test_Store_Reap_Full_FullWALs_NameCollision_WithGen tests reaping when the
+// clock reads the same millisecond recorded in the newest full snapshot's ID
+// and generations are in use. The consolidated snapshot must still sort after
+// the snapshot it replaces.
 func Test_Store_Reap_Full_FullWALs_NameCollision_WithGen(t *testing.T) {
 	dir := t.TempDir()
 	store, err := NewStore(dir)
@@ -1106,8 +1108,9 @@ func Test_Store_Reap_Full_FullWALs_NameCollision_WithGen(t *testing.T) {
 	createSnapshotInStore(t, store, "3-2000-2222222222222-1", 2000, 3, 1,
 		"testdata/db-and-wals/full2.db", "testdata/db-and-wals/full2-wal-00")
 
-	// Now use a fixed clock so we get the same timestamp when we reap. This should trigger a bump in
-	// generation from 1 to 2.
+	// Now use a fixed clock reading the same millisecond recorded in the
+	// newest snapshot's ID. The consolidated snapshot must sort strictly
+	// after it, so the millisecond field is bumped past the existing one.
 	store.snapshotNamer = NewSnapshotNamer(fixedClock(time.UnixMilli(2222222222222)))
 	if _, _, err := store.Reap(); err != nil {
 		t.Fatalf("Failed to reap snapshots: %v", err)
@@ -1122,7 +1125,95 @@ func Test_Store_Reap_Full_FullWALs_NameCollision_WithGen(t *testing.T) {
 	if err != nil {
 		t.Fatalf("failed to parse snapshot name: %s", err)
 	}
-	if term != 3 || index != 2000 || msec != 2222222222222 || gen != 2 {
+	if term != 3 || index != 2000 || msec != 2222222222223 || gen != 1 {
+		t.Fatalf("incorrect snapshot ID, got %d, %d, %d, %d", term, index, msec, gen)
+	}
+}
+
+// Test_Store_Create_ClockBackward_SameTermIndex tests that a snapshot created
+// after the system clock moves backwards still sorts as newer than an existing
+// snapshot with the same term and index.
+func Test_Store_Create_ClockBackward_SameTermIndex(t *testing.T) {
+	dir := t.TempDir()
+	store, err := NewStore(dir)
+	if err != nil {
+		t.Fatalf("Failed to create new store: %v", err)
+	}
+	defer store.Close()
+
+	// Existing snapshot at term 3, index 100, created at millisecond 1000.
+	createSnapshotInStore(t, store, "3-100-1000", 100, 3, 1, "testdata/db-and-wals/backup.db")
+
+	// The clock moves backwards to millisecond 500. A new snapshot at the same
+	// term and index must still sort as newer than the existing one.
+	store.snapshotNamer = NewSnapshotNamer(fixedClock(time.UnixMilli(500)))
+	sink, err := store.Create(1, 100, 3, makeTestConfiguration("1", "localhost:1"), 1, nil)
+	if err != nil {
+		t.Fatalf("Failed to create sink: %v", err)
+	}
+	if exp, got := "3-100-1001", sink.ID(); exp != got {
+		t.Fatalf("expected sink ID %s, got %s", exp, got)
+	}
+
+	streamer, err := NewSnapshotStreamer("testdata/db-and-wals/backup.db")
+	if err != nil {
+		t.Fatalf("Failed to create SnapshotStreamer: %v", err)
+
```

---

### Incident Patch 8: `52e5cd15` (2026-09-19)
**Commit Message**: More test fixes

**File**: `db/querylog/querylog_test.go` (modified, +4/-4)
```diff
@@ -128,8 +128,8 @@ func Test_QueryLogger_FallbackToStmtOrTrigger(t *testing.T) {
 	if !strings.Contains(output, "PRAGMA journal_mode") {
 		t.Fatalf("expected log to contain StmtOrTrigger text, got: %s", output)
 	}
-	if !strings.Contains(output, "[0s]") {
-		t.Fatalf("expected [0s] for zero-duration, got: %s", output)
+	if !strings.Contains(output, "(0s)") {
+		t.Fatalf("expected (0s) for zero-duration, got: %s", output)
 	}
 }
 
@@ -291,8 +291,8 @@ func Test_QueryLogger_MinDuration_AboveThreshold(t *testing.T) {
 	if !strings.Contains(output, "SELECT 'above_threshold'") {
 		t.Fatalf("expected query above threshold to be logged, got: %s", output)
 	}
-	if !strings.Contains(output, "[50ms]") {
-		t.Fatalf("expected [50ms] in output, got: %s", output)
+	if !strings.Contains(output, "(50ms)") {
+		t.Fatalf("expected (50ms) in output, got: %s", output)
 	}
 }
 
```

---

### Incident Patch 9: `eb418bce` (2026-09-19)
**Commit Message**: Fix querylog test

**File**: `db/querylog/querylog_test.go` (modified, +3/-3)
```diff
@@ -75,15 +75,15 @@ func Test_QueryLogger_StmtThenProfile(t *testing.T) {
 		EventCode:      sqlite3.TraceProfile,
 		ConnHandle:     0x100,
 		StmtHandle:     0x200,
-		RunTimeNanosec: 3_000_000,
+		RunTimeNanosec: 30_000_000,
 	})
 
 	output := buf.String()
 	if !strings.Contains(output, "INSERT INTO t VALUES ('alice')") {
 		t.Fatalf("expected log to contain expanded SQL, got: %s", output)
 	}
-	if !strings.Contains(output, "[3ms]") {
-		t.Fatalf("expected log to contain [3ms], got: %s", output)
+	if !strings.Contains(output, "(30ms)") {
+		t.Fatalf("expected log to contain [30ms], got: %s", output)
 	}
 }
 
```

---

### Incident Patch 10: `f198b621` (2026-09-19)
**Commit Message**: Deflake query timeout test

**File**: `system_test/single_node_test.go` (modified, +6/-8)
```diff
@@ -784,18 +784,16 @@ func Test_SingleNodeQueryTimeout(t *testing.T) {
 		t.Fatalf("test received wrong result\nexp: %s\ngot: %s\n", exp, r)
 	}
 
-	q := `SELECT key1, key_id, key2, key3, key4, key5, key6, data
-	FROM test_table
-	ORDER BY key2 ASC`
-	r, err = node.QueryWithTimeout(q, 1*time.Millisecond)
+	// Counting 5000^3 combinations keeps SQLite busy long enough for the
+	// timeout cancellation to run, even when Go timer delivery is delayed.
+	q := `SELECT COUNT(*) FROM test_table t1
+	CROSS JOIN test_table t2 CROSS JOIN test_table t3`
+	r, err = node.QueryWithTimeout(q, 50*time.Millisecond)
 	if err != nil {
 		t.Fatalf("failed to query with timeout: %s", err.Error())
 	}
 	if !strings.Contains(r, `"error":"query timeout"`) {
-		// This test is brittle, but it's the best we can do, as we can't be sure
-		// how much of the query will actually be executed. We just know it should
-		// time out at some point.
-		t.Fatalf("query ran to completion, but should have timed out")
+		t.Fatalf("expected query timeout, got: %s", r)
 	}
 }
 
```

---

### Incident Patch 11: `30ae9dd2` (2026-09-18)
**Commit Message**: Fix HTTP logic error for queued statements

**File**: `http/service.go` (modified, +4/-1)
```diff
@@ -1300,7 +1300,10 @@ func (s *Service) queuedExecute(w http.ResponseWriter, r *http.Request, qp Query
 
 	stmts, err := ParseRequest(r.Body)
 	if err != nil {
-		if errors.Is(err, ErrNoStatements) && !qp.Wait() {
+		if (errors.Is(err, ErrNoStatements) || errors.Is(err, ErrInvalidRequest)) && qp.Wait() {
+			// These errors are OK if waiting.
+			err = nil
+		} else {
 			http.Error(w, err.Error(), http.StatusBadRequest)
 			return
 		}
```

---

### Incident Patch 12: `994db9eb` (2026-09-18)
**Commit Message**: UI console fixes

**File**: `http/console/static/js/app.js` (modified, +16/-19)
```diff
@@ -498,14 +498,11 @@
         loadStatus();
     });
 
-    function nodesURL() {
-        return showNonVoters.checked ? "/nodes?nonvoters" : "/nodes";
-    }
-
     function loadStatus() {
         Promise.all([
             apiRequest("GET", "/status"),
-            apiRequest("GET", nodesURL())
+            // Keep complete membership for restore routing; filter only the table.
+            apiRequest("GET", "/nodes?nonvoters")
         ]).then(function (responses) {
             lastStatusData = responses[0].data;
             renderStatus(lastStatusData);
@@ -709,7 +706,9 @@
     }
 
     function renderNodesTable() {
-        var nodes = lastNodesData.slice();
+        var nodes = lastNodesData.filter(function (node) {
+            return showNonVoters.checked || node.voter;
+        });
 
         if (nodesSortKey) {
             nodes.sort(function (a, b) {
@@ -879,15 +878,9 @@
     }
 
     function isSingleNodeCluster() {
-        // Prefer the node list if available; fall back to raft.num_peers.
-        if (lastNodesData && lastNodesData.length > 0) {
-            return lastNodesData.length === 1;
-        }
-        if (lastStatusData && lastStatusData.store && lastStatusData.store.raft) {
-            return Number(lastStatusData.store.raft.num_peers) === 0;
-        }
-        // Unknown — be safe and assume cluster (uses /db/load).
-        return false;
+        // This list includes non-voters. raft.num_peers counts only voting peers
+        // and cannot establish whether /boot is allowed. Unknown uses /db/load.
+        return lastNodesData.length === 1;
     }
 
     function sniffFileType(file) {
@@ -984,6 +977,9 @@
     restoreBtn.addEventListener("click", function () {
         if (!restoreSelection) return;
         var sel = restoreSelection;
+        // Membership may have refreshed since the file was selected.
+        sel.method = pickMethod(sel.kind);
+        restoreMethodSpan.textContent = sel.method.label;
 
         var confirmMsg = "Restore from \"" + sel.file.name + "\" via " + sel.method.label + "?\n\n" +
             "This replaces ALL existing data in the database. This action cannot be undone.";
@@ -1050,14 +1046,15 @@
             stopProcessingTimer();
             restoreBtn.disabled = false;
 
-            // /db/load can return 200 OK with a SQL parse error nested in the
-            // response body, e.g. {"results":[{"error":"near \"foo\": syntax
-            // error"}]}. Treat any error key in results[] as a failure.
+            // /db/load can return 200 OK with a top-level request error or
+            // a SQL error nested in results[]. Treat either as a failure.
             var jsonErr = null;
             if (xhr.responseText) {
                 try {
                     var resp = JSON.parse(xhr.responseText);
-                    if (resp && Array.isArray(resp.results)) {
+                    if (resp && resp.error) {
+                        jsonErr = resp.error;
+                    } else if (resp && Array.isArray(resp.results)) {
                         for (var i = 0; i < resp.results.length; i++) {
                             if (resp.results[i] && resp.results[i].error) {
                                 jsonErr = resp.results[i].error;
```

---

### Incident Patch 13: `fab7abd3` (2026-09-18)
**Commit Message**: Build releases with go 1.27

**File**: `.github/workflows/build-release-binaries.yml` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ jobs:
       - name: Set up Go
         uses: actions/setup-go@v5
         with:
-          go-version: 1.26
+          go-version: 1.27
 
       - name: Display the version of go that we have installed
         run: go version
```

#### Recent Merged Pull Requests:
- **PR #2846** (2026-10-05): Simplify runWALSnapshot logic (@otoolep)
- **PR #2845** (2026-10-05): Check Raft Snapshot threshold every 5 seconds by default (@otoolep)
- **PR #2844** (2026-10-05): Verify WAL-related SQLite compile-time options (@otoolep)
- **PR #2842** (closed): Claude GitHub 2795 drivers (@otoolep)
- **PR #2841** (2026-10-04): Disable autocheckpointing at connect time (@otoolep)
- **PR #2840** (2026-10-04): Emit CDC events for every request in a bulk request (@otoolep)
- **PR #2839** (2026-10-03): Don't clear CDC streamer index after Commit or Rollback (@otoolep)
- **PR #2837** (2026-10-01): More Console Topology improvements (@otoolep)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
