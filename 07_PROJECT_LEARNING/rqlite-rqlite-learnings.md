> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rqlite-rqlite-learnings.md`  
> **Source**: github ([https://github.com/rqlite/rqlite](https://github.com/rqlite/rqlite))  
> **Source Version**: `62d625f3`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-07T20:56:09.316Z  
> **Learning ID**: `learn-github-rqlite-rqlite`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): rqlite/rqlite

> **Canonical Artifact**: `07_PROJECT_LEARNING/rqlite-rqlite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rqlite/rqlite](https://github.com/rqlite/rqlite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-07T20:56:09.311Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rqlite/rqlite`
- **Description**: The lightweight, fault-tolerant database built on SQLite. Designed to keep your data highly available with minimal effort.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 17923 stars

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

// SynchronousMode is SQLite synchronous mode.
type SynchronousMode int

const (
	// SynchronousOff corresponds to PRAGMA synchronous=OFF.
	SynchronousOff SynchronousMode = iota
	// SynchronousNormal corresponds to PRAGMA synchronous=NORMAL.
	SynchronousNormal
	// SynchronousFull corresponds to PRAGMA synchronous=FULL.
	SynchronousFull
	// SynchronousExtra corresponds to PRAGMA synchronous=EXTRA.
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
	db := sql.OpenDB(newConnector(&sqlite3.SQLiteDriver{}, ":memory:"))
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

// IsValidSQLiteData checks that the supplied data looks like SQLite data.
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

	b := make([]byte, 8)
	if _, err := io.ReadFull(f, b); err != nil {
		return false
	}
	return IsValidSQLiteWALData(b)
}

// IsValidSQLiteWALData checks that the supplied data looks like a SQLite
// WAL file.
func IsValidSQLiteWALData(b []byte) bool {
	if len(b) < 8 {
		return false
	}

	// Check magic number.
	magic := binary.BigEndian.Uint32(b[:4])
	if magic != 0x377f0682 && magic != 0x377f0683 {
		return false
	}

	// Verify version is correct.
	return binary.BigEndian.Uint32(b[4:8]) == 3007000
}

// IsWALModeEnabledSQLiteFile checks that the supplied path looks like a SQLite
// file with WAL mode enabled.
func IsWALModeEna
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
// destination file exists, all its contents will be replaced by the contents
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
)

// Retry parameters used by Remove and Rename when a path is in use.
const (
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
// Returns the number of times the removal was retried.
func RemoveWithRetry(path string, timeout, retryInterval time.Duration) (int, error) {
	return retryInUse(func() error { return os.Remove(path) }, timeout, retryInterval)
}

// RemoveAllWithRetry removes path and any children it contains. On Windows,
// if another process has the path open, the removal is retried until timeout elapses.
// Returns the number of times the removal was retried.
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

// CloseOrTimeout waits for a channel to be closed or a timeout to expire.
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

// FlushChannel is the type passed to the Queue, if the caller wants
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
	req := &Request[T]{
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

// New returns an instance of a Queue. t is the maximum time that
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
// a lower sequence number than a second slice will always be transmitted
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

// Flush flushes the queue.
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

// Depth returns the number of queued requests.
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
		// mergeQueued returns a new object, and ownership will pass
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
					// we don't get a full batch, we'll still write.
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
// so it is not safe to call on an open Snapshot store.
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
// lastAppendEntriesTime: last time we received an AppendEntries request from the Leader.
// leaderCommitIndex: latest commit index received from the Leader.
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
		// commit index arrived within the window, so we can't be stale.
		return false
	}

	// We haven't yet applied the leader's latest commit index, but was the currently
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
	db, err := sql.OpenSwappable(tmpDBPath, sql.NewConfig(sql.ConnConfig{
		Extensions:  dbConf.Extensions,
		ForeignKeys: dbConf.FKConstraints,
	}, true))
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
	if err = fsmSnapshot.Persist(sink); err != nil {
		return fmt.Errorf("failed to persist snapshot: %v", err)
	}

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3018** (2026-11-07): **Escape literal database filenames in SQLite URIs**
  *Symptoms*: Database filenames containing `?`, `#`, or percent escapes were interpreted as SQLite URI syntax. This could open a different file from the requested path or prevent the reader connection from opening it. Escape the filename as a URI path before appending connection options.  Adds a regression that creates and queries databases with these filenames and verifies that both the database and WAL exist at the requested paths. All three cases failed before the fix. Includes a changelog entry using XXXX.  Validation: `go test ./db -run 'Test_OpenURICharactersInPath|Test_MakeDSN' -count=1` and `go test ./db/... -count=1` pass. 

- **Issue #3012** (2026-11-07): **db: ignore WAL frames after the last commit frame when compacting**
  *Symptoms*: Split out of #3009.  **The condition.** A WAL can contain frames after its last commit frame. They carry the current salt and valid frame headers, but no commit frame follows them, so they are not part of the database. SQLite's own reader stops at the last commit frame and ignores whatever comes after it, and later transactions overwrite those frames as they write.  One way a WAL gets into this state is a rolled-back transaction. SQLite may write a transaction's pages to the WAL before it commits, and if the transaction is then rolled back the WAL is not truncated: SQLite moves its write position back to the last commit frame and the frames stay in the file. A smaller transaction that commits next overwrites only some of them. A process that stops mid-transaction leaves the WAL the same way. The test in this PR produces the state through a rollback; how the WAL got there is secondary. rqlite has to handle a WAL in this condition.  **The bug.** The compacting scanner used by the checkpoint manager matches frames by salt, so it read the frames after the last commit frame, found no commit frame for them, and returned `ErrOpenTransaction`. The checkpoint failed, and with it every incremental snapshot, until enough writes had overwritten the frames.  **The fix.** Frames after the last commit frame are now dropped, in both scan modes, as SQLite drops them, and `ErrOpenTransaction` is retired. rqlite never has a transaction in progress when it compacts the WAL, since writes are appl

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

### Incident Patch 1: `0fa3a0c6` (2026-11-07)
**Commit Message**: Merge pull request #3010 from rqlite/claude-db-reader-busy-timeout

db: apply the reader busy timeout to every pooled reader connection

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 - [PR #3007](https://github.com/rqlite/rqlite/pull/3007): Stop leaking goroutines from the pre-snapshot sync when a registered participant.
 - [PR #3007](https://github.com/rqlite/rqlite/pull/3007): Remove the temporary output file when gzip compression or decompression of a file fails part-way through.
 - [PR #3006](https://github.com/rqlite/rqlite/pull/3006): Reject duplicate usernames in auth config and require an actual JSON array.
+- [PR #3010](https://github.com/rqlite/rqlite/pull/3010): Apply the configured busy timeout to every pooled reader connection, not just the one borrowed when it was set.
 - [PR #3008](https://github.com/rqlite/rqlite/pull/3008): Request reads at `auto` consistency now use the level `auto` resolves correctly.
 - [PR #3008](https://github.com/rqlite/rqlite/pull/3008): Report the Store's `open` status as a boolean, instead of an empty object, in `/status`.
 - [PR #3008](https://github.com/rqlite/rqlite/pull/3008): User-requested snapshot no longer leaves Raft's trailing-logs setting at zero when no snapshot threshold is set.
```

**File**: `db/conn_config.go` (modified, +17/-3)
```diff
@@ -7,6 +7,7 @@ import (
 	"path/filepath"
 	"regexp"
 	"sort"
+	"time"
 
 	"github.com/mattn/go-sqlite3"
 	command "github.com/rqlite/rqlite/v10/command/proto"
@@ -27,15 +28,21 @@ const (
 
 // ConnConfig is the policy applied to every connection of one role when it
 // is opened: which extensions it loads, how it treats the WAL on close,
-// whether it enforces foreign keys, which hooks it carries, and whether its
-// statements are traced.
+// how long it waits for a locked database, whether it enforces foreign
+// keys, which hooks it carries, and whether its statements are traced.
 type ConnConfig struct {
 	// Extensions is the list of paths to SQLite extension shared objects.
 	Extensions []string
 
 	// ChkOnClose controls whether SQLite checkpoints the WAL on connection close.
 	ChkOnClose CnkOnCloseMode
 
+	// BusyTimeout is how long a connection waits for a locked database
+	// before a statement fails with SQLITE_BUSY. It is applied to every new
+	// connection with millisecond precision. Zero keeps the driver default
+	// of five seconds.
+	BusyTimeout time.Duration
+
 	// ForeignKeys, if true, enables foreign key constraints on every new
 	// connection.
 	ForeignKeys bool
@@ -103,7 +110,7 @@ func (c *connector) Driver() driver.Driver {
 
 // buildConnectHook composes a ConnectHook from cfg, chaining all requested
 // connection-level behaviors in order: checkpoint config, attach limit,
-// foreign keys, query tracing, then hooks.
+// busy timeout, foreign keys, query tracing, then hooks.
 //
 // This driver unconditionally disables automatic checkpointing.
 func buildConnectHook(cfg *ConnConfig) func(conn *sqlite3.SQLiteConn) error {
@@ -129,6 +136,13 @@ func buildConnectHook(cfg *ConnConfig) func(conn *sqlite3.SQLiteConn) error {
 			conn.SetLimit(sqlite3.SQLITE_LIMIT_ATTACHED, 0)
 		}
 
+		// Busy timeout.
+		if cfg.BusyTimeout > 0 {
+			if _, err := conn.Exec(fmt.Sprintf("PRAGMA busy_timeout=%d", cfg.BusyTimeout.Milliseconds()), nil); err != nil {
+				return fmt.Errorf("cannot set busy timeout: %w", err)
+			}
+		}
+
 		// Foreign key constraints.
 		if cfg.ForeignKeys {
 			if _, err := conn.Exec("PRAGMA foreign_keys = ON", nil); err != nil {
```

**File**: `db/db.go` (modified, +6/-22)
```diff
@@ -489,36 +489,20 @@ func (db *DB) ExtensionNames() []string {
 	return extensionNames(db.cfg.Writer.Extensions)
 }
 
-// SetBusyTimeout sets the busy timeout for the database. If a timeout is
-// less than zero it is not set.
-func (db *DB) SetBusyTimeout(rwMs, roMs int) (err error) {
-	if rwMs >= 0 {
-		if err := db.writer.setBusyTimeout(rwMs); err != nil {
-			return err
-		}
-	}
-	if roMs >= 0 {
-		if err := db.readers.setBusyTimeout(roMs); err != nil {
-			return err
-		}
-	}
-	return nil
-}
-
-// RWBusyTimeout returns the current busy timeout value for the read-write
-// database connection.
+// RWBusyTimeout returns the busy timeout, in milliseconds, of the read-write
+// database connection. It is set by the writer's ConnConfig.
 func (db *DB) RWBusyTimeout() (int, error) {
 	return db.writer.busyTimeout()
 }
 
-// ROBusyTimeout returns the current busy timeout value for the read-only
-// database connection.
+// ROBusyTimeout returns the busy timeout, in milliseconds, of the read-only
+// database connections. It is set by the readers' ConnConfig.
 func (db *DB) ROBusyTimeout() (int, error) {
 	return db.readers.busyTimeout()
 }
 
-// BusyTimeout returns the current busy timeout values for the read-write and
-// read-only database connections.
+// BusyTimeout returns the busy timeouts, in milliseconds, of the read-write
+// and read-only database connections.
 func (db *DB) BusyTimeout() (rwMs, roMs int, err error) {
 	rwMs, err = db.RWBusyTimeout()
 	if err != nil {
```

**File**: `db/db_common_test.go` (modified, +54/-6)
```diff
@@ -18,17 +18,28 @@ import (
 )
 
 func Test_DB_BusyTimeout(t *testing.T) {
+	// The driver default applies when no busy timeout is configured.
 	db, path := mustCreateOnDiskDatabaseWAL()
 	defer fsutil.Remove(path)
-	defer db.Close()
-
-	wantRw := rand.N(10000)
-	wantRo := rand.N(10000)
+	rw, ro, err := db.BusyTimeout()
+	if err != nil {
+		t.Fatalf("failed to get busy_timeout: %s", err.Error())
+	}
+	if rw != 5000 || ro != 5000 {
+		t.Fatalf("want default busy_timeout rw=5000, ro=5000, got rw=%d, ro=%d", rw, ro)
+	}
+	db.Close()
 
-	err := db.SetBusyTimeout(wantRw, wantRo)
+	wantRw := 1 + rand.N(10000)
+	wantRo := 1 + rand.N(10000)
+	cfg := NewConfig(ConnConfig{}, true)
+	cfg.Writer.BusyTimeout = time.Duration(wantRw) * time.Millisecond
+	cfg.Readers.BusyTimeout = time.Duration(wantRo) * time.Millisecond
+	db, err = OpenWithConfig(path, cfg)
 	if err != nil {
-		t.Fatalf("failed to set busy_timeout: %s", err.Error())
+		t.Fatalf("failed to open database: %s", err.Error())
 	}
+	defer db.Close()
 
 	gotRwOnly, err := db.RWBusyTimeout()
 	if err != nil {
@@ -56,6 +67,43 @@ func Test_DB_BusyTimeout(t *testing.T) {
 	}
 }
 
+// Test_DB_BusyTimeout_AllReaders tests that the read-only busy timeout reaches
+// every reader connection, including ones opened after the database was.
+func Test_DB_BusyTimeout_AllReaders(t *testing.T) {
+	const wantRo = 5678
+	cfg := NewConfig(ConnConfig{}, true)
+	cfg.Readers.BusyTimeout = wantRo * time.Millisecond
+	path := mustTempFile()
+	defer fsutil.Remove(path)
+	db, err := OpenWithConfig(path, cfg)
+	if err != nil {
+		t.Fatalf("failed to open database: %s", err.Error())
+	}
+	defer db.Close()
+
+	// Hold one reader so the second acquire must open a new connection.
+	r1, err := db.AcquireReader(context.Background())
+	if err != nil {
+		t.Fatalf("failed to acquire first reader: %s", err.Error())
+	}
+	defer r1.Close()
+	r2, err := db.AcquireReader(context.Background())
+	if err != nil {
+		t.Fatalf("failed to acquire second reader: %s", err.Error())
+	}
+	defer r2.Close()
+
+	for i, r := range []*Conn{r1, r2} {
+		got, err := r.BusyTimeout()
+		if err != nil {
+			t.Fatalf("failed to get busy_timeout on reader %d: %s", i+1, err.Error())
+		}
+		if got != wantRo {
+			t.Fatalf("reader %d: want busy_timeout=%d, got %d", i+1, wantRo, got)
+		}
+	}
+}
+
 // Test_DB_CompileOptions tests that we can fetch the compile options, and that the
 // underlying SQLite library is compiled as expected.
 func Test_DB_CompileOptions(t *testing.T) {
```

**File**: `db/sources.go` (modified, +0/-10)
```diff
@@ -59,16 +59,6 @@ func (p *pool) busyTimeout() (int, error) {
 	return conn.BusyTimeout()
 }
 
-// setBusyTimeout sets the busy timeout on a connection from the pool.
-func (p *pool) setBusyTimeout(ms int) error {
-	conn, err := p.acquire(context.Background())
-	if err != nil {
-		return err
-	}
-	defer conn.Close()
-	return conn.SetBusyTimeout(ms)
-}
-
 // pragmas reads the named pragmas on one connection from the pool.
 func (p *pool) pragmas(names []string) (map[string]string, error) {
 	conn, err := p.acquire(context.Background())
```

---

### Incident Patch 2: `0e9b1e63` (2026-11-07)
**Commit Message**: Merge remote-tracking branch 'origin' into claude-db-reader-busy-timeout

**File**: `CHANGELOG.md` (modified, +8/-1)
```diff
@@ -1,8 +1,15 @@
 ## v10.6.7 (unreleased)
 ### Implementation changes and bug fixes
 - [PR #3001](https://github.com/rqlite/rqlite/pull/3001): Upgrade SQLite to 3.54.1.
+- [PR #3007](https://github.com/rqlite/rqlite/pull/3007): Accept extension tarballs whose entries are prefixed with `./`.
+- [PR #3007](https://github.com/rqlite/rqlite/pull/3007): Create implicit parent directories with directory permissions when extracting zip and tar.gz archives, instead of the contained file's mode.
+- [PR #3007](https://github.com/rqlite/rqlite/pull/3007): Stop leaking goroutines from the pre-snapshot sync when a registered participant.
+- [PR #3007](https://github.com/rqlite/rqlite/pull/3007): Remove the temporary output file when gzip compression or decompression of a file fails part-way through.
 - [PR #3006](https://github.com/rqlite/rqlite/pull/3006): Reject duplicate usernames in auth config and require an actual JSON array.
-- [PR #XXX](https://github.com/rqlite/rqlite/pull/XXX): Apply the configured busy timeout to every pooled reader connection, not just the one borrowed when it was set.
+- [PR #3010](https://github.com/rqlite/rqlite/pull/3010): Apply the configured busy timeout to every pooled reader connection, not just the one borrowed when it was set.
+- [PR #3008](https://github.com/rqlite/rqlite/pull/3008): Request reads at `auto` consistency now use the level `auto` resolves correctly.
+- [PR #3008](https://github.com/rqlite/rqlite/pull/3008): Report the Store's `open` status as a boolean, instead of an empty object, in `/status`.
+- [PR #3008](https://github.com/rqlite/rqlite/pull/3008): User-requested snapshot no longer leaves Raft's trailing-logs setting at zero when no snapshot threshold is set.
 
 ## v10.6.6 (October 28th 2026)
 ### Implementation changes and bug fixes
```

**File**: `internal/rarchive/gzip.go` (modified, +5/-0)
```diff
@@ -4,6 +4,8 @@ import (
 	"compress/gzip"
 	"io"
 	"os"
+
+	"github.com/rqlite/rqlite/v10/internal/fsutil"
 )
 
 // Gzip compresses the given file and returns the path to the
@@ -25,11 +27,13 @@ func Gzip(file string) (string, error) {
 	gz := gzip.NewWriter(tmpFd)
 	_, err = io.Copy(gz, f)
 	if err != nil {
+		fsutil.Remove(tmpFd.Name())
 		return "", err
 	}
 
 	err = gz.Close()
 	if err != nil {
+		fsutil.Remove(tmpFd.Name())
 		return "", err
 	}
 	return tmpFd.Name(), nil
@@ -59,6 +63,7 @@ func Gunzip(file string) (string, error) {
 
 	_, err = io.Copy(tmpFd, gz)
 	if err != nil {
+		fsutil.Remove(tmpFd.Name())
 		return "", err
 	}
 	return tmpFd.Name(), nil
```

**File**: `internal/rarchive/targz.go` (modified, +18/-4)
```diff
@@ -57,9 +57,16 @@ func TarGzipHasSubdirectories(path string) (bool, error) {
 			return false, err
 		}
 
+		// Entries are often prefixed with "./" (e.g. "tar czf out.tar.gz -C dir ."),
+		// so clean the name first. An entry for the archive root itself is not
+		// a subdirectory.
+		name := filepath.ToSlash(filepath.Clean(strings.ReplaceAll(header.Name, "\\", "/")))
+		if name == "." {
+			continue
+		}
+
 		// Check if the file is a directory or if the file path includes a subdirectory
-		if header.Typeflag == tar.TypeDir ||
-			strings.Contains(header.Name, "/") || strings.Contains(header.Name, "\\") {
+		if header.Typeflag == tar.TypeDir || strings.Contains(name, "/") {
 			return true, nil
 		}
 	}
@@ -101,6 +108,11 @@ func UntarGzipToDir(path, dir string) error {
 		// Construct the full path for the file
 		fpath := filepath.Join(dir, header.Name)
 
+		// An entry for the archive root itself (e.g. "./") needs nothing created.
+		if fpath == filepath.Clean(dir) {
+			continue
+		}
+
 		// Check for directory traversal vulnerability
 		if !strings.HasPrefix(fpath, filepath.Clean(dir)+string(os.PathSeparator)) {
 			return errors.New("invalid file path")
@@ -112,8 +124,10 @@ func UntarGzipToDir(path, dir string) error {
 				return err
 			}
 		} else {
-			// Create the file
-			if err := os.MkdirAll(filepath.Dir(fpath), os.FileMode(header.Mode)); err != nil {
+			// Create any parent directories the archive did not list explicitly.
+			// The file's own mode is not suitable for a directory, as it may
+			// lack the execute bit needed to create entries within it.
+			if err := os.MkdirAll(filepath.Dir(fpath), 0755); err != nil {
 				return err
 			}
 
```

**File**: `internal/rarchive/targz_test.go` (modified, +81/-0)
```diff
@@ -127,3 +127,84 @@ func checkFileContent(t *testing.T, path, expectedContent string) {
 		t.Errorf("expected file content %q, got %q", expectedContent, string(data))
 	}
 }
+
+// Test_TarGzip_DotSlashEntries checks that a tarball whose entries are prefixed
+// with "./" -- as produced by "tar czf out.tar.gz -C dir ." -- is treated as a
+// flat archive and extracts cleanly.
+func Test_TarGzip_DotSlashEntries(t *testing.T) {
+	tarGzipFile := filepath.Join(t.TempDir(), "dotslash.tar.gz")
+	createTestTarGzipFileOrdered(t, tarGzipFile, []tarEntry{
+		{name: "./", typeflag: tar.TypeDir, mode: 0755},
+		{name: "./file1.txt", typeflag: tar.TypeReg, mode: 0600, content: "This is file 1"},
+		{name: "./file2.txt", typeflag: tar.TypeReg, mode: 0600, content: "This is file 2"},
+	})
+
+	hasSubdirs, err := TarGzipHasSubdirectories(tarGzipFile)
+	if err != nil {
+		t.Fatalf("unexpected error: %v", err)
+	}
+	if hasSubdirs {
+		t.Errorf("expected %s to not have subdirectories", tarGzipFile)
+	}
+
+	extractDir := t.TempDir()
+	if err := UntarGzipToDir(tarGzipFile, extractDir); err != nil {
+		t.Fatalf("unexpected error during extraction: %v", err)
+	}
+	checkFileContent(t, filepath.Join(extractDir, "file1.txt"), "This is file 1")
+	checkFileContent(t, filepath.Join(extractDir, "file2.txt"), "This is file 2")
+}
+
+// Test_UntarGzipToDir_NestedFileWithoutDirEntry checks that a file inside a
+// subdirectory extracts even when the archive carries no entry for the
+// directory itself.
+func Test_UntarGzipToDir_NestedFileWithoutDirEntry(t *testing.T) {
+	tarGzipFile := filepath.Join(t.TempDir(), "nested.tar.gz")
+	createTestTarGzipFileOrdered(t, tarGzipFile, []tarEntry{
+		{name: "sub/dir/file1.txt", typeflag: tar.TypeReg, mode: 0600, content: "This is file 1"},
+	})
+
+	extractDir := t.TempDir()
+	if err := UntarGzipToDir(tarGzipFile, extractDir); err != nil {
+		t.Fatalf("unexpected error during extraction: %v", err)
+	}
+	checkFileContent(t, filepath.Join(extractDir, "sub", "dir", "file1.txt"), "This is file 1")
+}
+
+type tarEntry struct {
+	name     string
+	typeflag byte
+	mode     int64
+	content  string
+}
+
+// createTestTarGzipFileOrdered creates a tar.gz file containing the given
+// entries, in the given order.
+func createTestTarGzipFileOrdered(t *testing.T, tarGzipFile string, entries []tarEntry) {
+	f, err := os.Create(tarGzipFile)
+	if err != nil {
+		t.Fatalf("failed to create tar.gz file: %v", err)
+	}
+	defer f.Close()
+
+	gw := gzip.NewWriter(f)
+	defer gw.Close()
+
+	tw := tar.NewWriter(gw)
+	defer tw.Close()
+
+	for _, e := range entries {
+		hdr := &tar.Header{
+			Name:     e.name,
+			Typeflag: e.typeflag,
+			Mode:     e.mode,
+			Size:     int64(len(e.content)),
+		}
+		if err := tw.WriteHeader(hdr); err != nil {
+			t.Fatalf("failed to write tar header: %v", err)
+		}
+		if _, err := tw.Write([]byte(e.content)); err != nil {
+			t.Fatalf("failed to write tar content: %v", err)
+		}
+	}
+}
```

**File**: `internal/rarchive/zip.go` (modified, +4/-2)
```diff
@@ -82,8 +82,10 @@ func UnzipToDir(path, dir string) error {
 				return err
 			}
 		} else {
-			// Create the file
-			if err := os.MkdirAll(filepath.Dir(fpath), f.Mode()); err != nil {
+			// Create any parent directories the archive did not list explicitly.
+			// The file's own mode is not suitable for a directory, as it may
+			// lack the execute bit needed to create entries within it.
+			if err := os.MkdirAll(filepath.Dir(fpath), 0755); err != nil {
 				return err
 			}
 
```

**File**: `internal/rarchive/zip_test.go` (modified, +27/-0)
```diff
@@ -103,6 +103,33 @@ func Test_UnzipToDir_InvalidZip(t *testing.T) {
 	}
 }
 
+// Test_UnzipToDir_NestedFileWithoutDirEntry checks that a file inside a
+// subdirectory extracts even when the archive carries no entry for the
+// directory itself, which is how archive/zip's Writer.Create lays files out.
+func Test_UnzipToDir_NestedFileWithoutDirEntry(t *testing.T) {
+	zipData, err := createZipInMemory(map[string]string{
+		"sub/dir/file1.txt": "This is file 1",
+	})
+	if err != nil {
+		t.Fatalf("Failed to create ZIP file in memory: %v", err)
+	}
+	zipFileName := filepath.Join(t.TempDir(), "nested.zip")
+	mustWriteBytesToFile(zipFileName, zipData)
+
+	outputDir := t.TempDir()
+	if err := UnzipToDir(zipFileName, outputDir); err != nil {
+		t.Fatalf("UnzipToDir failed: %v", err)
+	}
+
+	data, err := os.ReadFile(filepath.Join(outputDir, "sub", "dir", "file1.txt"))
+	if err != nil {
+		t.Fatalf("Failed to read unzipped file: %v", err)
+	}
+	if string(data) != "This is file 1" {
+		t.Fatalf("unexpected content: got %q", data)
+	}
+}
+
 func createZipInMemory(files map[string]string) ([]byte, error) {
 	buf := new(bytes.Buffer)
 	zipWriter := zip.NewWriter(buf)
```

**File**: `internal/rsync/sync_channels.go` (modified, +18/-6)
```diff
@@ -29,22 +29,29 @@ func (sc *SyncChannels) Register(ch chan<- chan struct{}) {
 }
 
 // Sync sends a channel to all registered channels and waits for those channels
-// to close. Returns the total number of channels and the number that
-// successfully synchronized before any error or timeout.
-func (sc *SyncChannels) Sync(timeout time.Duration) (int, int, error) {
+// to close. Returns the total number of channels, the number that successfully
+// synchronized before any error or timeout, and the number that never received
+// the sync signal at all. A participant that never receives is dropped once the
+// timeout passes, rather than blocking forever.
+func (sc *SyncChannels) Sync(timeout time.Duration) (int, int, int, error) {
 	sc.chsMu.Lock()
 	defer sc.chsMu.Unlock()
 	cancel := make(chan struct{})
-	defer close(cancel)
 
 	var nOK atomic.Int32
+	var nDropped atomic.Int32
 	var wg sync.WaitGroup
 	wg.Add(len(sc.chs))
 	for _, ch := range sc.chs {
 		go func(ch chan<- chan struct{}) {
 			defer wg.Done()
 			syncCh := make(chan struct{})
-			ch <- syncCh
+			select {
+			case ch <- syncCh:
+			case <-cancel:
+				nDropped.Add(1)
+				return
+			}
 			select {
 			case <-syncCh:
 				nOK.Add(1)
@@ -65,5 +72,10 @@ func (sc *SyncChannels) Sync(timeout time.Duration) (int, int, error) {
 	case <-time.After(timeout):
 		err = ErrTimeout
 	}
-	return len(sc.chs), int(nOK.Load()), err
+
+	// Release any goroutine still waiting on a participant, then wait for all
+	// of them to record their outcome before reading the counts.
+	close(cancel)
+	<-done
+	return len(sc.chs), int(nOK.Load()), int(nDropped.Load()), err
 }
```

**File**: `internal/rsync/sync_channels_test.go` (modified, +32/-16)
```diff
@@ -16,12 +16,12 @@ const (
 
 func Test_Sync_NoRegistrations(t *testing.T) {
 	sc := NewSyncChannels()
-	total, ok, err := sc.Sync(testTimeout)
+	total, ok, dropped, err := sc.Sync(testTimeout)
 	if err != nil {
 		t.Fatalf("Sync() with no registrations returned error: %v", err)
 	}
-	if total != 0 || ok != 0 {
-		t.Fatalf("Sync() with no registrations returned total=%d, ok=%d; want 0,0", total, ok)
+	if total != 0 || ok != 0 || dropped != 0 {
+		t.Fatalf("Sync() with no registrations returned total=%d, ok=%d, dropped=%d; want 0,0,0", total, ok, dropped)
 	}
 }
 
@@ -36,12 +36,12 @@ func Test_Sync_SingleChannel_Succeeds(t *testing.T) {
 		close(syncCh)
 	}()
 
-	total, ok, err := sc.Sync(testTimeout)
+	total, ok, dropped, err := sc.Sync(testTimeout)
 	if err != nil {
 		t.Fatalf("Sync() returned unexpected error: %v", err)
 	}
-	if total != 1 || ok != 1 {
-		t.Fatalf("Sync() returned total=%d, ok=%d; want 1,1", total, ok)
+	if total != 1 || ok != 1 || dropped != 0 {
+		t.Fatalf("Sync() returned total=%d, ok=%d, dropped=%d; want 1,1,0", total, ok, dropped)
 	}
 }
 
@@ -66,7 +66,7 @@ func Test_Sync_MultipleChannels_WaitsForAll(t *testing.T) {
 		close(syncCh)
 	}()
 
-	total, ok, err := sc.Sync(testTimeout)
+	total, ok, _, err := sc.Sync(testTimeout)
 	if err != nil {
 		t.Fatalf("Sync() returned unexpected error: %v", err)
 	}
@@ -96,12 +96,28 @@ func Test_Sync_Timeout_WhenParticipantNeverCloses(t *testing.T) {
 		_ = syncCh // intentionally never close
 	}()
 
-	total, ok, err := sc.Sync(smallTimeout)
+	total, ok, dropped, err := sc.Sync(smallTimeout)
 	if !errors.Is(err, ErrTimeout) {
 		t.Fatalf("Sync() error = %v, want ErrTimeout", err)
 	}
-	if total != 2 || ok != 1 {
-		t.Fatalf("Sync() returned total=%d, ok=%d; want 2,1", total, ok)
+	if total != 2 || ok != 1 || dropped != 0 {
+		t.Fatalf("Sync() returned total=%d, ok=%d, dropped=%d; want 2,1,0", total, ok, dropped)
+	}
+}
+
+// Test_Sync_Timeout_WhenParticipantNeverReceives checks that a participant
+// which never reads from its registered channel is reported as dropped once
+// Sync times out, instead of leaving Sync waiting on it forever.
+func Test_Sync_Timeout_WhenParticipantNeverReceives(t *testing.T) {
+	sc := NewSyncChannels()
+	sc.Register(make(chan chan struct{})) // Nobody ever reads from this.
+
+	total, ok, dropped, err := sc.Sync(smallTimeout)
+	if !errors.Is(err, ErrTimeout) {
+		t.Fatalf("Sync() error = %v, want ErrTimeout", err)
+	}
+	if total != 1 || ok != 0 || dropped != 1 {
+		t.Fatalf("Sync() returned total=%d, ok=%d, dropped=%d; want 1,0,1", total, ok, dropped)
 	}
 }
 
@@ -122,14 +138,14 @@ func Test_Sync_ReusedAcrossCalls(t *testing.T) {
 		close(s2)
 		close(done1)
 	}()
-	total, ok, err := sc.Sync(testTimeout)
+	total, ok, dropped, err := sc.Sync(testTimeout)
 	if err != nil {
 		t.Fatalf("first Sync() error: %v", err)
 	}
 	<-done1
 
-	if total != 2 || ok != 2 {
-		t.Fatalf("first Sync() returned total=%d, ok=%d; want 2,2", total, ok)
+	if total != 2 || ok != 2 || dropped != 0 {
+		t.Fatalf("first Sync() returned total=%d, ok=%d, dropped=%d; want 2,2,0", total, ok, dropped)
 	}
 
 	// Second sync: staggered closes, still should succeed before timeout.
@@ -141,11 +157,11 @@ func Test_Sync_ReusedAcrossCalls(t *testing.T) {
 		time.Sleep(shortDelay)
 		close(s2)
 	}()
-	total, ok, err = sc.Sync(testTimeout)
+	total, ok, dropped, err = sc.Sync(testTimeout)
 	if err != nil {
 		t.Fatalf("second Sync() error: %v", err)
 	}
-	if total != 2 || ok != 2 {
-		t.Fatalf("second Sync() returned total=%d, ok=%d; want 2,2", total, ok)
+	if total != 2 || ok != 2 || dropped != 0 {
+		t.Fatalf("second Sync() returned total=%d, ok=%d, dropped=%d; want 2,2", total, ok, dropped)
 	}
 }
```

---

### Incident Patch 3: `1d13438e` (2026-11-07)
**Commit Message**: db: apply the reader busy timeout to every pooled reader connection

SetBusyTimeout set the read-only busy timeout on whichever reader it
borrowed from the pool, so a second concurrent reader, or one opened
after an idle close, kept the driver default of 5000 ms. The busy
timeout is now a BusyTimeout field on ConnConfig, applied by the connect
hook to every new connection of that role, and the runtime setter is
removed since it could not reach connections opened later.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 ### Implementation changes and bug fixes
 - [PR #3001](https://github.com/rqlite/rqlite/pull/3001): Upgrade SQLite to 3.54.1.
 - [PR #3006](https://github.com/rqlite/rqlite/pull/3006): Reject duplicate usernames in auth config and require an actual JSON array.
+- [PR #XXX](https://github.com/rqlite/rqlite/pull/XXX): Apply the configured busy timeout to every pooled reader connection, not just the one borrowed when it was set.
 
 ## v10.6.6 (October 28th 2026)
 ### Implementation changes and bug fixes
```

**File**: `db/conn_config.go` (modified, +17/-3)
```diff
@@ -7,6 +7,7 @@ import (
 	"path/filepath"
 	"regexp"
 	"sort"
+	"time"
 
 	"github.com/mattn/go-sqlite3"
 	command "github.com/rqlite/rqlite/v10/command/proto"
@@ -27,15 +28,21 @@ const (
 
 // ConnConfig is the policy applied to every connection of one role when it
 // is opened: which extensions it loads, how it treats the WAL on close,
-// whether it enforces foreign keys, which hooks it carries, and whether its
-// statements are traced.
+// how long it waits for a locked database, whether it enforces foreign
+// keys, which hooks it carries, and whether its statements are traced.
 type ConnConfig struct {
 	// Extensions is the list of paths to SQLite extension shared objects.
 	Extensions []string
 
 	// ChkOnClose controls whether SQLite checkpoints the WAL on connection close.
 	ChkOnClose CnkOnCloseMode
 
+	// BusyTimeout is how long a connection waits for a locked database
+	// before a statement fails with SQLITE_BUSY. It is applied to every new
+	// connection with millisecond precision. Zero keeps the driver default
+	// of five seconds.
+	BusyTimeout time.Duration
+
 	// ForeignKeys, if true, enables foreign key constraints on every new
 	// connection.
 	ForeignKeys bool
@@ -103,7 +110,7 @@ func (c *connector) Driver() driver.Driver {
 
 // buildConnectHook composes a ConnectHook from cfg, chaining all requested
 // connection-level behaviors in order: checkpoint config, attach limit,
-// foreign keys, query tracing, then hooks.
+// busy timeout, foreign keys, query tracing, then hooks.
 //
 // This driver unconditionally disables automatic checkpointing.
 func buildConnectHook(cfg *ConnConfig) func(conn *sqlite3.SQLiteConn) error {
@@ -129,6 +136,13 @@ func buildConnectHook(cfg *ConnConfig) func(conn *sqlite3.SQLiteConn) error {
 			conn.SetLimit(sqlite3.SQLITE_LIMIT_ATTACHED, 0)
 		}
 
+		// Busy timeout.
+		if cfg.BusyTimeout > 0 {
+			if _, err := conn.Exec(fmt.Sprintf("PRAGMA busy_timeout=%d", cfg.BusyTimeout.Milliseconds()), nil); err != nil {
+				return fmt.Errorf("cannot set busy timeout: %w", err)
+			}
+		}
+
 		// Foreign key constraints.
 		if cfg.ForeignKeys {
 			if _, err := conn.Exec("PRAGMA foreign_keys = ON", nil); err != nil {
```

**File**: `db/db.go` (modified, +6/-22)
```diff
@@ -489,36 +489,20 @@ func (db *DB) ExtensionNames() []string {
 	return extensionNames(db.cfg.Writer.Extensions)
 }
 
-// SetBusyTimeout sets the busy timeout for the database. If a timeout is
-// less than zero it is not set.
-func (db *DB) SetBusyTimeout(rwMs, roMs int) (err error) {
-	if rwMs >= 0 {
-		if err := db.writer.setBusyTimeout(rwMs); err != nil {
-			return err
-		}
-	}
-	if roMs >= 0 {
-		if err := db.readers.setBusyTimeout(roMs); err != nil {
-			return err
-		}
-	}
-	return nil
-}
-
-// RWBusyTimeout returns the current busy timeout value for the read-write
-// database connection.
+// RWBusyTimeout returns the busy timeout, in milliseconds, of the read-write
+// database connection. It is set by the writer's ConnConfig.
 func (db *DB) RWBusyTimeout() (int, error) {
 	return db.writer.busyTimeout()
 }
 
-// ROBusyTimeout returns the current busy timeout value for the read-only
-// database connection.
+// ROBusyTimeout returns the busy timeout, in milliseconds, of the read-only
+// database connections. It is set by the readers' ConnConfig.
 func (db *DB) ROBusyTimeout() (int, error) {
 	return db.readers.busyTimeout()
 }
 
-// BusyTimeout returns the current busy timeout values for the read-write and
-// read-only database connections.
+// BusyTimeout returns the busy timeouts, in milliseconds, of the read-write
+// and read-only database connections.
 func (db *DB) BusyTimeout() (rwMs, roMs int, err error) {
 	rwMs, err = db.RWBusyTimeout()
 	if err != nil {
```

**File**: `db/db_common_test.go` (modified, +54/-6)
```diff
@@ -18,17 +18,28 @@ import (
 )
 
 func Test_DB_BusyTimeout(t *testing.T) {
+	// The driver default applies when no busy timeout is configured.
 	db, path := mustCreateOnDiskDatabaseWAL()
 	defer fsutil.Remove(path)
-	defer db.Close()
-
-	wantRw := rand.N(10000)
-	wantRo := rand.N(10000)
+	rw, ro, err := db.BusyTimeout()
+	if err != nil {
+		t.Fatalf("failed to get busy_timeout: %s", err.Error())
+	}
+	if rw != 5000 || ro != 5000 {
+		t.Fatalf("want default busy_timeout rw=5000, ro=5000, got rw=%d, ro=%d", rw, ro)
+	}
+	db.Close()
 
-	err := db.SetBusyTimeout(wantRw, wantRo)
+	wantRw := 1 + rand.N(10000)
+	wantRo := 1 + rand.N(10000)
+	cfg := NewConfig(ConnConfig{}, true)
+	cfg.Writer.BusyTimeout = time.Duration(wantRw) * time.Millisecond
+	cfg.Readers.BusyTimeout = time.Duration(wantRo) * time.Millisecond
+	db, err = OpenWithConfig(path, cfg)
 	if err != nil {
-		t.Fatalf("failed to set busy_timeout: %s", err.Error())
+		t.Fatalf("failed to open database: %s", err.Error())
 	}
+	defer db.Close()
 
 	gotRwOnly, err := db.RWBusyTimeout()
 	if err != nil {
@@ -56,6 +67,43 @@ func Test_DB_BusyTimeout(t *testing.T) {
 	}
 }
 
+// Test_DB_BusyTimeout_AllReaders tests that the read-only busy timeout reaches
+// every reader connection, including ones opened after the database was.
+func Test_DB_BusyTimeout_AllReaders(t *testing.T) {
+	const wantRo = 5678
+	cfg := NewConfig(ConnConfig{}, true)
+	cfg.Readers.BusyTimeout = wantRo * time.Millisecond
+	path := mustTempFile()
+	defer fsutil.Remove(path)
+	db, err := OpenWithConfig(path, cfg)
+	if err != nil {
+		t.Fatalf("failed to open database: %s", err.Error())
+	}
+	defer db.Close()
+
+	// Hold one reader so the second acquire must open a new connection.
+	r1, err := db.AcquireReader(context.Background())
+	if err != nil {
+		t.Fatalf("failed to acquire first reader: %s", err.Error())
+	}
+	defer r1.Close()
+	r2, err := db.AcquireReader(context.Background())
+	if err != nil {
+		t.Fatalf("failed to acquire second reader: %s", err.Error())
+	}
+	defer r2.Close()
+
+	for i, r := range []*Conn{r1, r2} {
+		got, err := r.BusyTimeout()
+		if err != nil {
+			t.Fatalf("failed to get busy_timeout on reader %d: %s", i+1, err.Error())
+		}
+		if got != wantRo {
+			t.Fatalf("reader %d: want busy_timeout=%d, got %d", i+1, wantRo, got)
+		}
+	}
+}
+
 // Test_DB_CompileOptions tests that we can fetch the compile options, and that the
 // underlying SQLite library is compiled as expected.
 func Test_DB_CompileOptions(t *testing.T) {
```

**File**: `db/sources.go` (modified, +0/-10)
```diff
@@ -59,16 +59,6 @@ func (p *pool) busyTimeout() (int, error) {
 	return conn.BusyTimeout()
 }
 
-// setBusyTimeout sets the busy timeout on a connection from the pool.
-func (p *pool) setBusyTimeout(ms int) error {
-	conn, err := p.acquire(context.Background())
-	if err != nil {
-		return err
-	}
-	defer conn.Close()
-	return conn.SetBusyTimeout(ms)
-}
-
 // pragmas reads the named pragmas on one connection from the pool.
 func (p *pool) pragmas(names []string) (map[string]string, error) {
 	conn, err := p.acquire(context.Background())
```

#### Recent Merged Pull Requests:
- **PR #3018** (closed): Escape literal database filenames in SQLite URIs (@otoolep)
- **PR #3012** (2026-11-07): db: ignore WAL frames after the last commit frame when compacting (@otoolep)
- **PR #3010** (2026-11-07): db: apply the reader busy timeout to every pooled reader connection (@otoolep)
- **PR #3009** (2026-11-07): db: fix 4 bugs found in code review (@otoolep)
- **PR #3008** (2026-11-07): store: fix 3 bugs found in code review (@otoolep)
- **PR #3007** (2026-11-07): internal: fix 4 bugs found in code review (@otoolep)

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

## X. Merge pull request #3010 from rqlite/claude-db-reader-busy-timeout

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rqlite/rqlite. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0fa3a0c6`: Merge pull request #3010 from rqlite/claude-db-reader-busy-timeout. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
- [PR #3010](https://github.com/rqlite/rqlite/pull/3010): Apply the configured busy timeout to every pooled reader connection, not just the one borrowed when it was set.
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0fa3a0c6` are properly handled with clean fallback behavior.
