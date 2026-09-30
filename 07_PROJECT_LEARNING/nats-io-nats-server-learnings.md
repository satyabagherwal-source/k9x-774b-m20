# Forensic Learning Record (Deep Inspection): nats-io/nats-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/nats-io-nats-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nats-io/nats-server](https://github.com/nats-io/nats-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:14:13.200Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nats-io/nats-server`
- **Description**: High-Performance server for NATS.io, the cloud and edge native messaging system.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 20814 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `conf/fuzz.go`
```
// Copyright 2020-2025 The NATS Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build gofuzz

package conf

func Fuzz(data []byte) int {
	_, err := Parse(string(data))
	if err != nil {
		return 0
	}
	return 1
}

```

### Core Architecture Module: `conf/lex.go`
```
// Copyright 2013-2024 The NATS Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Customized heavily from
// https://github.com/BurntSushi/toml/blob/master/lex.go, which is based on
// Rob Pike's talk: http://cuddle.googlecode.com/hg/talk/lex.html

// The format supported is less restrictive than today's formats.
// Supports mixed Arrays [], nested Maps {}, multiple comment types (# and //)
// Also supports key value assignments using '=' or ':' or whiteSpace()
//   e.g. foo = 2, foo : 2, foo 2
// maps can be assigned with no key separator as well
// semicolons as value terminators in key/value assignments are optional
//
// see lex_test.go for more examples.

package conf

import (
	"encoding/hex"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"
)

type itemType int

const (
	itemError itemType = iota
	itemNIL            // used in the parser to indicate no type
	itemEOF
	itemKey
	itemText
	itemString
	itemBool
	itemInteger
	itemFloat
	itemDatetime
	itemArrayStart
	itemArrayEnd
	itemMapStart
	itemMapEnd
	itemCommentStart
	itemVariable
	itemInclude
)

const (
	eof               = 0
	mapStart          = '{'
	mapEnd            = '}'
	keySepEqual       = '='
	keySepColon       = ':'
	arrayStart        = '['
	arrayEnd          = ']'
	arrayValTerm      = ','
	mapValTerm        = ','
	commentHashStart  = '#'
	commentSlashStart = '/'
	dqStringStart     = '"'
	dqStringEnd       = '"'
	sqStringStart     = '\''
	sqStringEnd       = '\''
	optValTerm        = ';'
	topOptStart       = '{'
	topOptValTerm     = ','
	topOptTerm        = '}'
	blockStart        = '('
	blockEnd          = ')'
	mapEndString      = string(mapEnd)
)

type stateFn func(lx *lexer) stateFn

type lexer struct {
	input string
	start int
	pos   int
	width int
	line  int
	state stateFn
	items chan item

	// A stack of state functions used to maintain context.
	// The idea is to reuse parts of the state machine in various places.
	// For example, values can appear at the top level or within arbitrarily
	// nested arrays. The last state on the stack is used after a value has
	// been lexed. Similarly for comments.
	stack []stateFn

	// Used for processing escapable substrings in double-quoted and raw strings
	stringParts   []string
	stringStateFn stateFn

	// lstart is the start position of the current line.
	lstart int

	// ilstart is the start position of the line from the current item.
	ilstart int
}

type item struct {
	typ  itemType
	val  string
	line int
	pos  int
}

func (lx *lexer) nextItem() item {
	for {
		select {
		case item := <-lx.items:
			return item
		default:
			lx.state = lx.state(lx)
		}
	}
}

func lex(input string) *lexer {
	lx := &lexer{
		input:       input,
		state:       lexTop,
		line:        1,
		items:       make(chan item, 10),
		stack:       make([]stateFn, 0, 10),
		stringParts: []string{},
	}
	return lx
}

func (lx *lexer) push(state stateFn) {
	lx.stack = append(lx.stack, state)
}

func (lx *lexer) pop() stateFn {
	if len(lx.stack) == 0 {
		return lx.errorf("BUG in lexer: no states to pop.")
	}
	li := len(lx.stack) - 1
	last := lx.stack[li]
	lx.stack = lx.stack[0:li]
	return last
}

func (lx *lexer) emit(typ itemType) {
	val := strings.Join(lx.stringParts, "") + lx.input[lx.start:lx.pos]
	// Position of item in line where it started.
	pos := lx.pos - lx.ilstart - len(val)
	lx.items <- item{typ, val, lx.line, pos}
	lx.start = lx.pos
	lx.ilstart = lx.lstart
}

func (lx *lexer) emitString() {
	var finalString string
	if len(lx.stringParts) > 0 {
		finalString = strings.Join(lx.stringParts, "") + lx.input[lx.start:lx.pos]
		lx.stringParts = []string{}
	} else {
		finalString = lx.input[lx.start:lx.pos]
	}
	// Position of string in line where it started.
	pos := lx.pos - lx.ilstart - len(finalString)
	lx.items <- item{itemString, finalString, lx.line, pos}
	lx.start = lx.pos
	lx.ilstart = lx.lstart
}

func (lx *lexer) addCurrentStringPart(offset int) {
	lx.stringParts = append(lx.stringParts, lx.input[lx.start:lx.pos-offset])
	lx.start = lx.pos
}

func (lx *lexer) addStringPart(s string) stateFn {
	lx.stringParts = append(lx.stringParts, s)
	lx.start = lx.pos
	return lx.stringStateFn
}

func (lx *lexer) hasEscapedParts() bool {
	return len(lx.stringParts) > 0
}

func (lx *lexer) next() (r rune) {
	if lx.pos >= len(lx.input) {
		lx.width = 0
		return eof
	}

	if lx.input[lx.pos] == '\n' {
		lx.line++

		// Mark start position of current line.
		lx.lstart = lx.pos
	}
	r, lx.width = utf8.DecodeRuneInString(lx.input[lx.pos:])
	lx.pos += lx.width

	return r
}

// ignore skips over the pending input before this point.
func (lx *lexer) ignore() {
	lx.start = lx.pos
	lx.ilstart = lx.lstart
}

// backup steps back one rune. Can be called only once per call of next.
func (lx *lexer) backup() {
	lx.pos -= lx.width
	if lx.pos < len(lx.input) && lx.input[lx.pos] == '\n' {
		lx.line--
	}
}

// peek returns but does not consume the next rune in the input.
func (lx *lexer) peek() rune {
	r := lx.next()
	lx.backup()
	return r
}

// errorf stops all lexing by emitting an error and returning `nil`.
// Note that any value that is a character is escaped if it's a special
// character (new lines, tabs, etc.).
func (lx *lexer) errorf(format string, values ...any) stateFn {
	for i, value := range values {
		if v, ok := value.(rune); ok {
			values[i] = escapeSpecial(v)
		}
	}

	// Position of error in current line.
	pos := lx.pos - lx.lstart
	lx.items <- item{
		itemError,
		fmt.Sprintf(format, values...),
		lx.line,
		pos,
	}
	return nil
}

// lexTop consumes elements at the top level of data structure.
func lexTop(lx *lexer) stateFn {
	r := lx.next()
	if unicode.IsSpace(r) {
		return lexSkip(lx, lexTop)
	}

	switch r {
	case topOptStart:
		lx.push(lexTop)
		return lexSkip(lx, lexBlockStart)
	case commentHashStart:
		lx.push(lexTop)
		return lexCommentStart
	case commentSlashStart:
		rn := lx.next()
		if rn == commentSlashStart {
			lx.push(lexTop)
			return lexCommentStart
		}
		lx.backup()
		fallthrough
	case eof:
		if lx.pos > lx.start {
			return lx.errorf("Unexpected EOF.")
		}
		lx.emit(itemEOF)
		return nil
	}

	// At this point, the only valid item can be a key, so we back up
	// and let the key lexer do the rest.
	lx.backup()
	lx.push(lexTopValueEnd)
	return lexKeyStart
}

// lexTopValueEnd is entered whenever a top-level value has been consumed.
// It must see only whitespace, and will turn back to lexTop upon a new line.
// If it sees EOF, it will quit the lexer successfully.
func lexTopValueEnd(lx *lexer) stateFn {
	r := lx.next()
	switch {
	case r == commentHashStart:
		// a comment will read to a new line for us.
		lx.push(lexTop)
		return lexCommentStart
	case r == commentSlashStart:
		rn := lx.next()
		if rn == commentSlashStart {
			lx.push(lexTop)
			return lexCommentStart
		}
		lx.backup()
		fallthrough
	case isWhitespace(r):
		return lexTopValueEnd
	case isNL(r) || r == eof || r == optValTerm || r == topOptValTerm || r == topOptTerm:
		lx.ignore()
		return lexTop
	}
	return lx.errorf("Expected a top-level value to end with a new line, "+
		"comment or EOF, but got '%v' instead.", r)
}

func lexBlockStart(lx *lexer) stateFn {
	r := lx.next()
	if unicode.IsSpace(r) {
		return lexSkip(lx, lexBlockStart)
	}

	switch r {
	case topOptStart:
		lx.push(lexBlockEnd)
		return lexSkip(lx, lexBlockStart)
	case topOptTerm:
		lx.ignore()
		return lx.pop()
	case commentHashStart:
		lx.push(lexBlockStart)
		return lexCommentStart
	case commentSlashStart:
		rn := lx.next()
		if rn == comm
```

### Core Architecture Module: `conf/parse.go`
```
// Copyright 2013-2026 The NATS Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package conf supports a configuration file format used by gnatsd. It is
// a flexible format that combines the best of traditional
// configuration formats and newer styles such as JSON and YAML.
package conf

// The format supported is less restrictive than today's formats.
// Supports mixed Arrays [], nested Maps {}, multiple comment types (# and //)
// Also supports key value assignments using '=' or ':' or whiteSpace()
//   e.g. foo = 2, foo : 2, foo 2
// maps can be assigned with no key separator as well
// semicolons as value terminators in key/value assignments are optional
//
// see parse_test.go for more examples.

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode"
)

const _EMPTY_ = ""

type parser struct {
	mapping map[string]any
	lx      *lexer

	// The current scoped context, can be array or map
	ctx any

	// stack of contexts, either map or array/slice stack
	ctxs []any

	// Keys stack
	keys []string

	// Keys stack as items
	ikeys []item

	// The config file path, empty by default.
	fp string

	// pedantic reports error when configuration is not correct.
	pedantic bool

	// Tracks environment variable references, to avoid cycles
	envVarReferences map[string]bool
}

// Parse will return a map of keys to any, although concrete types
// underly them. The values supported are string, bool, int64, float64, DateTime.
// Arrays and nested Maps are also supported.
func Parse(data string) (map[string]any, error) {
	p, err := parse(data, "", false)
	if err != nil {
		return nil, err
	}
	return p.mapping, nil
}

// ParseWithChecks is equivalent to Parse but runs in pedantic mode.
func ParseWithChecks(data string) (map[string]any, error) {
	p, err := parse(data, "", true)
	if err != nil {
		return nil, err
	}
	return p.mapping, nil
}

// ParseFile is a helper to open file, etc. and parse the contents.
func ParseFile(fp string) (map[string]any, error) {
	data, err := os.ReadFile(fp)
	if err != nil {
		return nil, fmt.Errorf("error opening config file: %v", err)
	}

	p, err := parse(string(data), fp, false)
	if err != nil {
		return nil, err
	}
	return p.mapping, nil
}

// ParseFileWithChecks is equivalent to ParseFile but runs in pedantic mode.
func ParseFileWithChecks(fp string) (map[string]any, error) {
	data, err := os.ReadFile(fp)
	if err != nil {
		return nil, err
	}

	p, err := parse(string(data), fp, true)
	if err != nil {
		return nil, err
	}

	return p.mapping, nil
}

// configDigest returns a digest for the parsed config.
func configDigest(m map[string]any) (string, error) {
	digest := sha256.New()
	e := json.NewEncoder(digest)
	if err := e.Encode(m); err != nil {
		return _EMPTY_, err
	}
	return fmt.Sprintf("sha256:%x", digest.Sum(nil)), nil
}

// ParseFileWithChecksDigest returns the processed config and a digest
// that represents the configuration.
func ParseFileWithChecksDigest(fp string) (map[string]any, string, error) {
	m, err := ParseFileWithChecks(fp)
	if err != nil {
		return nil, _EMPTY_, err
	}
	digest, err := configDigest(m)
	if err != nil {
		return nil, _EMPTY_, err
	}
	return m, digest, nil
}

type token struct {
	item         item
	value        any
	usedVariable bool
	sourceFile   string
}

func (t *token) MarshalJSON() ([]byte, error) {
	return json.Marshal(t.value)
}

func (t *token) Value() any {
	return t.value
}

func (t *token) Line() int {
	return t.item.line
}

func (t *token) IsUsedVariable() bool {
	return t.usedVariable
}

func (t *token) SourceFile() string {
	return t.sourceFile
}

func (t *token) Position() int {
	return t.item.pos
}

func newParser(data, fp string, pedantic bool) *parser {
	return &parser{
		mapping:          make(map[string]any),
		lx:               lex(data),
		ctxs:             make([]any, 0, 4),
		keys:             make([]string, 0, 4),
		ikeys:            make([]item, 0, 4),
		fp:               filepath.Dir(fp),
		pedantic:         pedantic,
		envVarReferences: make(map[string]bool),
	}
}

func parse(data, fp string, pedantic bool) (*parser, error) {
	p := newParser(data, fp, pedantic)
	if err := p.parse(fp); err != nil {
		return nil, err
	}
	return p, nil
}

func parseEnv(data string, parent *parser) (*parser, error) {
	p := newParser(data, "", false)
	p.envVarReferences = parent.envVarReferences
	if err := p.parse(""); err != nil {
		return nil, err
	}
	return p, nil
}

func (p *parser) parse(fp string) error {
	p.pushContext(p.mapping)

	var prevItem item
	for {
		it := p.next()
		if it.typ == itemEOF {
			// Here we allow the final character to be a bracket '}'
			// in order to support JSON like configurations.
			if prevItem.typ == itemKey && prevItem.val != mapEndString {
				return fmt.Errorf("config is invalid (%s:%d:%d)", fp, it.line, it.pos)
			}
			break
		}
		prevItem = it
		if err := p.processItem(it, fp); err != nil {
			return err
		}
	}
	return nil
}

func (p *parser) next() item {
	return p.lx.nextItem()
}

func (p *parser) pushContext(ctx any) {
	p.ctxs = append(p.ctxs, ctx)
	p.ctx = ctx
}

func (p *parser) popContext() any {
	if len(p.ctxs) == 0 {
		panic("BUG in parser, context stack empty")
	}
	li := len(p.ctxs) - 1
	last := p.ctxs[li]
	p.ctxs = p.ctxs[0:li]
	p.ctx = p.ctxs[len(p.ctxs)-1]
	return last
}

func (p *parser) pushKey(key string) {
	p.keys = append(p.keys, key)
}

func (p *parser) popKey() string {
	if len(p.keys) == 0 {
		panic("BUG in parser, keys stack empty")
	}
	li := len(p.keys) - 1
	last := p.keys[li]
	p.keys = p.keys[0:li]
	return last
}

func (p *parser) pushItemKey(key item) {
	p.ikeys = append(p.ikeys, key)
}

func (p *parser) popItemKey() item {
	if len(p.ikeys) == 0 {
		panic("BUG in parser, item keys stack empty")
	}
	li := len(p.ikeys) - 1
	last := p.ikeys[li]
	p.ikeys = p.ikeys[0:li]
	return last
}

func (p *parser) processItem(it item, fp string) error {
	setValue := func(it item, v any) {
		if p.pedantic {
			p.setValue(&token{it, v, false, fp})
		} else {
			p.setValue(v)
		}
	}

	switch it.typ {
	case itemError:
		return fmt.Errorf("Parse error on line %d: '%s'", it.line, it.val)
	case itemKey:
		// Keep track of the keys as items and strings,
		// we do this in order to be able to still support
		// includes without many breaking changes.
		p.pushKey(it.val)

		if p.pedantic {
			p.pushItemKey(it)
		}
	case itemMapStart:
		newCtx := make(map[string]any)
		p.pushContext(newCtx)
	case itemMapEnd:
		setValue(it, p.popContext())
	case itemString:
		// FIXME(dlc) sanitize string?
		setValue(it, it.val)
	case itemInteger:
		lastDigit := 0
		for _, r := range it.val {
			if !unicode.IsDigit(r) && r != '-' {
				break
			}
			lastDigit++
		}
		numStr := it.val[:lastDigit]
		num, err := strconv.ParseInt(numStr, 10, 64)
		if err != nil {
			if e, ok := err.(*strconv.NumError); ok &&
				e.Err == strconv.ErrRange {
				return fmt.Errorf("integer '%s' is out of the range", it.val)
			}
			return fmt.Errorf("expected integer, but got '%s'", it.val)
		}
		// Process a suffix
		suffix := strings.ToLower(strings.TrimSpace(it.val[lastDigit:]))

		switch suffix {
		case "":
			setValue(it, num)
		case "k":
			setValue(it, num*1000)
		case "kb", "ki", "kib":
			setValue(it, num*1024)
		case "m":
			setValue(it, num*1000*1000)
		case "mb", "mi", "mib":
			setValue(it, num*1024*1024)
		case "g":
			setValue(it, num*1000*1000*1000)
		case "gb", "gi", "gib":
			setValue(it, num*1024*1024*1024)
		case "t":

```

### Core Architecture Module: `internal/antithesis/noop.go`
```
// Copyright 2022-2024 The NATS Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This file is used iff the `enable_antithesis_sdk` build tag is not present
//go:build !enable_antithesis_sdk

package antithesis

import (
	"testing"
)

// AssertUnreachable this implementation is a NOOP
func AssertUnreachable(_ testing.TB, _ string, _ map[string]any) {}

// Assert this implementation is a NOOP
func Assert(_ testing.TB, _ bool, _ string, _ map[string]any) {}

```

### Core Architecture Module: `internal/ldap/dn.go`
```
// Copyright (c) 2011-2015 Michael Mitton (mmitton@gmail.com)
// Portions copyright (c) 2015-2016 go-ldap Authors
package ldap

import (
	"bytes"
	"crypto/x509/pkix"
	"encoding/asn1"
	enchex "encoding/hex"
	"errors"
	"fmt"
	"strings"
)

var attributeTypeNames = map[string]string{
	"2.5.4.3":  "CN",
	"2.5.4.5":  "SERIALNUMBER",
	"2.5.4.6":  "C",
	"2.5.4.7":  "L",
	"2.5.4.8":  "ST",
	"2.5.4.9":  "STREET",
	"2.5.4.10": "O",
	"2.5.4.11": "OU",
	"2.5.4.17": "POSTALCODE",
	// FIXME: Add others.
	"0.9.2342.19200300.100.1.25": "DC",
}

// AttributeTypeAndValue represents an attributeTypeAndValue from https://tools.ietf.org/html/rfc4514
type AttributeTypeAndValue struct {
	// Type is the attribute type
	Type string
	// Value is the attribute value
	Value string
}

// RelativeDN represents a relativeDistinguishedName from https://tools.ietf.org/html/rfc4514
type RelativeDN struct {
	Attributes []*AttributeTypeAndValue
}

// DN represents a distinguishedName from https://tools.ietf.org/html/rfc4514
type DN struct {
	RDNs []*RelativeDN
}

// FromCertSubject takes a pkix.Name from a cert and returns a DN
// that uses the same set.  Does not support multi value RDNs.
func FromCertSubject(subject pkix.Name) (*DN, error) {
	dn := &DN{
		RDNs: make([]*RelativeDN, 0),
	}
	for i := len(subject.Names) - 1; i >= 0; i-- {
		name := subject.Names[i]
		oidString := name.Type.String()
		typeName, ok := attributeTypeNames[oidString]
		if !ok {
			return nil, fmt.Errorf("invalid type name: %+v", name)
		}
		v, ok := name.Value.(string)
		if !ok {
			return nil, fmt.Errorf("invalid type value: %+v", v)
		}
		rdn := &RelativeDN{
			Attributes: []*AttributeTypeAndValue{
				{
					Type:  typeName,
					Value: v,
				},
			},
		}
		dn.RDNs = append(dn.RDNs, rdn)
	}
	return dn, nil
}

// FromRawCertSubject takes a raw subject from a certificate
// and uses asn1.Unmarshal to get the individual RDNs in the
// original order, including multi-value RDNs.
func FromRawCertSubject(rawSubject []byte) (*DN, error) {
	dn := &DN{
		RDNs: make([]*RelativeDN, 0),
	}
	var rdns pkix.RDNSequence
	_, err := asn1.Unmarshal(rawSubject, &rdns)
	if err != nil {
		return nil, err
	}

	for i := len(rdns) - 1; i >= 0; i-- {
		rdn := rdns[i]
		if len(rdn) == 0 {
			continue
		}

		r := &RelativeDN{}
		attrs := make([]*AttributeTypeAndValue, 0)
		for j := len(rdn) - 1; j >= 0; j-- {
			atv := rdn[j]

			typeName := ""
			name := atv.Type.String()
			typeName, ok := attributeTypeNames[name]
			if !ok {
				return nil, fmt.Errorf("invalid type name: %+v", name)
			}
			value, ok := atv.Value.(string)
			if !ok {
				return nil, fmt.Errorf("invalid type value: %+v", atv.Value)
			}
			attr := &AttributeTypeAndValue{
				Type:  typeName,
				Value: value,
			}
			attrs = append(attrs, attr)
		}
		r.Attributes = attrs
		dn.RDNs = append(dn.RDNs, r)
	}

	return dn, nil
}

// ParseDN returns a distinguishedName or an error.
// The function respects https://tools.ietf.org/html/rfc4514
func ParseDN(str string) (*DN, error) {
	dn := new(DN)
	dn.RDNs = make([]*RelativeDN, 0)
	rdn := new(RelativeDN)
	rdn.Attributes = make([]*AttributeTypeAndValue, 0)
	buffer := bytes.Buffer{}
	attribute := new(AttributeTypeAndValue)
	escaping := false

	unescapedTrailingSpaces := 0
	stringFromBuffer := func() string {
		s := buffer.String()
		s = s[0 : len(s)-unescapedTrailingSpaces]
		buffer.Reset()
		unescapedTrailingSpaces = 0
		return s
	}

	for i := 0; i < len(str); i++ {
		char := str[i]
		switch {
		case escaping:
			unescapedTrailingSpaces = 0
			escaping = false
			switch char {
			case ' ', '"', '#', '+', ',', ';', '<', '=', '>', '\\':
				buffer.WriteByte(char)
				continue
			}
			// Not a special character, assume hex encoded octet
			if len(str) == i+1 {
				return nil, errors.New("got corrupted escaped character")
			}

			dst := []byte{0}
			n, err := enchex.Decode([]byte(dst), []byte(str[i:i+2]))
			if err != nil {
				return nil, fmt.Errorf("failed to decode escaped character: %s", err)
			} else if n != 1 {
				return nil, fmt.Errorf("expected 1 byte when un-escaping, got %d", n)
			}
			buffer.WriteByte(dst[0])
			i++
		case char == '\\':
			unescapedTrailingSpaces = 0
			escaping = true
		case char == '=':
			attribute.Type = stringFromBuffer()
			// Special case: If the first character in the value is # the following data
			// is BER encoded. Throw an error since not supported right now.
			if len(str) > i+1 && str[i+1] == '#' {
				return nil, errors.New("unsupported BER encoding")
			}
		case char == ',' || char == '+':
			// We're done with this RDN or value, push it
			if len(attribute.Type) == 0 {
				return nil, errors.New("incomplete type, value pair")
			}
			attribute.Value = stringFromBuffer()
			rdn.Attributes = append(rdn.Attributes, attribute)
			attribute = new(AttributeTypeAndValue)
			if char == ',' {
				dn.RDNs = append(dn.RDNs, rdn)
				rdn = new(RelativeDN)
				rdn.Attributes = make([]*AttributeTypeAndValue, 0)
			}
		case char == ' ' && buffer.Len() == 0:
			// ignore unescaped leading spaces
			continue
		default:
			if char == ' ' {
				// Track unescaped spaces in case they are trailing and we need to remove them
				unescapedTrailingSpaces++
			} else {
				// Reset if we see a non-space char
				unescapedTrailingSpaces = 0
			}
			buffer.WriteByte(char)
		}
	}
	if buffer.Len() > 0 {
		if len(attribute.Type) == 0 {
			return nil, errors.New("DN ended with incomplete type, value pair")
		}
		attribute.Value = stringFromBuffer()
		rdn.Attributes = append(rdn.Attributes, attribute)
		dn.RDNs = append(dn.RDNs, rdn)
	}
	return dn, nil
}

// Equal returns true if the DNs are equal as defined by rfc4517 4.2.15 (distinguishedNameMatch).
// Returns true if they have the same number of relative distinguished names
// and corresponding relative distinguished names (by position) are the same.
func (d *DN) Equal(other *DN) bool {
	if len(d.RDNs) != len(other.RDNs) {
		return false
	}
	for i := range d.RDNs {
		if !d.RDNs[i].Equal(other.RDNs[i]) {
			return false
		}
	}
	return true
}

// RDNsMatch returns true if the individual RDNs of the DNs
// are the same regardless of ordering.
func (d *DN) RDNsMatch(other *DN) bool {
	if len(d.RDNs) != len(other.RDNs) {
		return false
	}
	matched := make([]bool, len(other.RDNs))
	for _, irdn := range d.RDNs {
		found := false
		for j, ordn := range other.RDNs {
			if !matched[j] && irdn.Equal(ordn) {
				matched[j] = true
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// AncestorOf returns true if the other DN consists of at least one RDN followed by all the RDNs of the current DN.
// "ou=widgets,o=acme.com" is an ancestor of "ou=sprockets,ou=widgets,o=acme.com"
// "ou=widgets,o=acme.com" is not an ancestor of "ou=sprockets,ou=widgets,o=foo.com"
// "ou=widgets,o=acme.com" is not an ancestor of "ou=widgets,o=acme.com"
func (d *DN) AncestorOf(other *DN) bool {
	if len(d.RDNs) >= len(other.RDNs) {
		return false
	}
	// Take the last `len(d.RDNs)` RDNs from the other DN to compare against
	otherRDNs := other.RDNs[len(other.RDNs)-len(d.RDNs):]
	for i := range d.RDNs {
		if !d.RDNs[i].Equal(otherRDNs[i]) {
			return false
		}
	}
	return true
}

// Equal returns true if the RelativeDNs are equal as defined by rfc4517 4.2.15 (distinguishedNameMatch).
// Relative distinguished names are the same if and only if they have the same number of AttributeTypeAndValues
// and each attribute of the first RDN is the same as the attribute of the second RDN with the same attribute type.
// The order of attributes is not significant.
// Case of attribute types is not significant.
func (r *RelativeDN) Equal(other *RelativeDN) bool {
	if len(r.Attributes) != len(other.Attributes) {
		return false
	}
	return r.hasAllAttributes(other.Attributes) && other.hasAllAttributes(r.Attributes)
}

func (r *RelativeDN) hasAllAttributes(attrs []*AttributeTypeAndValue) bool {
	for _, attr := range attrs {
		found := false
		for _, myattr := range r.Attribut
```

### Core Architecture Module: `internal/ocsp/ocsp.go`
```
// Copyright 2019-2024 The NATS Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package testhelper

import (
	"crypto"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"golang.org/x/crypto/ocsp"
)

const (
	defaultResponseTTL = 4 * time.Second
	defaultAddress     = "127.0.0.1:8888"
)

func NewOCSPResponderCustomAddress(t *testing.T, issuerCertPEM, issuerKeyPEM string, addr string) *http.Server {
	t.Helper()
	return NewOCSPResponderBase(t, issuerCertPEM, issuerCertPEM, issuerKeyPEM, false, addr, defaultResponseTTL, "")
}

func NewOCSPResponder(t *testing.T, issuerCertPEM, issuerKeyPEM string) *http.Server {
	t.Helper()
	return NewOCSPResponderBase(t, issuerCertPEM, issuerCertPEM, issuerKeyPEM, false, defaultAddress, defaultResponseTTL, "")
}

func NewOCSPResponderDesignatedCustomAddress(t *testing.T, issuerCertPEM, respCertPEM, respKeyPEM string, addr string) *http.Server {
	t.Helper()
	return NewOCSPResponderBase(t, issuerCertPEM, respCertPEM, respKeyPEM, true, addr, defaultResponseTTL, "")
}

func NewOCSPResponderPreferringHTTPMethod(t *testing.T, issuerCertPEM, issuerKeyPEM, method string) *http.Server {
	t.Helper()
	return NewOCSPResponderBase(t, issuerCertPEM, issuerCertPEM, issuerKeyPEM, false, defaultAddress, defaultResponseTTL, method)
}

func NewOCSPResponderCustomTimeout(t *testing.T, issuerCertPEM, issuerKeyPEM string, responseTTL time.Duration) *http.Server {
	t.Helper()
	return NewOCSPResponderBase(t, issuerCertPEM, issuerCertPEM, issuerKeyPEM, false, defaultAddress, responseTTL, "")
}

func NewOCSPResponderBase(t *testing.T, issuerCertPEM, respCertPEM, respKeyPEM string, embed bool, addr string, responseTTL time.Duration, method string) *http.Server {
	t.Helper()
	var mu sync.Mutex
	status := make(map[string]int)

	issuerCert := parseCertPEM(t, issuerCertPEM)
	respCert := parseCertPEM(t, respCertPEM)
	respKey := parseKeyPEM(t, respKeyPEM)

	mux := http.NewServeMux()
	// The "/statuses/" endpoint is for directly setting a key-value pair in
	// the CA's status database.
	mux.HandleFunc("/statuses/", func(rw http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()

		key := r.URL.Path[len("/statuses/"):]
		switch r.Method {
		case "GET":
			mu.Lock()
			n, ok := status[key]
			if !ok {
				n = ocsp.Unknown
			}
			mu.Unlock()

			fmt.Fprintf(rw, "%s %d", key, n)
		case "POST":
			data, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(rw, err.Error(), http.StatusBadRequest)
				return
			}

			n, err := strconv.Atoi(string(data))
			if err != nil {
				http.Error(rw, err.Error(), http.StatusBadRequest)
				return
			}

			mu.Lock()
			status[key] = n
			mu.Unlock()

			fmt.Fprintf(rw, "%s %d", key, n)
		default:
			http.Error(rw, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
	})
	// The "/" endpoint is for normal OCSP requests. This actually parses an
	// OCSP status request and signs a response with a CA. Lightly based off:
	// https://www.ietf.org/rfc/rfc2560.txt
	mux.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
		var reqData []byte
		var err error

		switch {
		case r.Method == "GET":
			if method != "" && r.Method != method {
				http.Error(rw, "", http.StatusBadRequest)
				return
			}
			reqData, err = base64.StdEncoding.DecodeString(r.URL.Path[1:])
		case r.Method == "POST":
			if method != "" && r.Method != method {
				http.Error(rw, "", http.StatusBadRequest)
				return
			}
			reqData, err = io.ReadAll(r.Body)
			r.Body.Close()
		default:
			http.Error(rw, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		if err != nil {
			http.Error(rw, err.Error(), http.StatusBadRequest)
			return
		}

		ocspReq, err := ocsp.ParseRequest(reqData)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusBadRequest)
			return
		}

		mu.Lock()
		n, ok := status[ocspReq.SerialNumber.String()]
		if !ok {
			n = ocsp.Unknown
		}
		mu.Unlock()

		tmpl := ocsp.Response{
			Status:       n,
			SerialNumber: ocspReq.SerialNumber,
			ThisUpdate:   time.Now(),
		}
		if responseTTL != 0 {
			tmpl.NextUpdate = tmpl.ThisUpdate.Add(responseTTL)
		}
		if embed {
			tmpl.Certificate = respCert
		}
		respData, err := ocsp.CreateResponse(issuerCert, respCert, tmpl, respKey)
		if err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}

		rw.Header().Set("Content-Type", "application/ocsp-response")
		rw.Header().Set("Content-Length", fmt.Sprint(len(respData)))

		fmt.Fprint(rw, string(respData))
	})

	srv := &http.Server{
		Addr:        addr,
		Handler:     mux,
		ReadTimeout: time.Second * 5,
	}
	go srv.ListenAndServe()
	time.Sleep(1 * time.Second)
	return srv
}

func parseCertPEM(t *testing.T, certPEM string) *x509.Certificate {
	t.Helper()
	block := parsePEM(t, certPEM)

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		t.Fatalf("failed to parse cert '%s': %s", certPEM, err)
	}
	return cert
}

func parseKeyPEM(t *testing.T, keyPEM string) crypto.Signer {
	t.Helper()
	block := parsePEM(t, keyPEM)

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		key, err = x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			t.Fatalf("failed to parse ikey %s: %s", keyPEM, err)
		}
	}
	keyc := key.(crypto.Signer)
	return keyc
}

func parsePEM(t *testing.T, pemPath string) *pem.Block {
	t.Helper()
	data, err := os.ReadFile(pemPath)
	if err != nil {
		t.Fatal(err)
	}

	block, _ := pem.Decode(data)
	if block == nil {
		t.Fatalf("failed to decode PEM %s", pemPath)
	}
	return block
}

func GetOCSPStatus(s tls.ConnectionState) (*ocsp.Response, error) {
	if len(s.VerifiedChains) == 0 {
		return nil, fmt.Errorf("missing TLS verified chains")
	}
	chain := s.VerifiedChains[0]

	if got, want := len(chain), 2; got < want {
		return nil, fmt.Errorf("incomplete cert chain, got %d, want at least %d", got, want)
	}
	leaf, issuer := chain[0], chain[1]

	resp, err := ocsp.ParseResponseForCert(s.OCSPResponse, leaf, issuer)
	if err != nil {
		return nil, fmt.Errorf("failed to parse OCSP response: %w", err)
	}
	if err := resp.CheckSignatureFrom(issuer); err != nil {
		return resp, err
	}
	return resp, nil
}

func SetOCSPStatus(t *testing.T, ocspURL, certPEM string, status int) {
	t.Helper()

	cert := parseCertPEM(t, certPEM)

	hc := &http.Client{Timeout: 10 * time.Second}
	resp, err := hc.Post(
		fmt.Sprintf("%s/statuses/%s", ocspURL, cert.SerialNumber),
		"",
		strings.NewReader(fmt.Sprint(status)),
	)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("failed to read OCSP HTTP response body: %s", err)
	}

	if got, want := resp.Status, "200 OK"; got != want {
		t.Error(strings.TrimSpace(string(data)))
		t.Fatalf("unexpected OCSP HTTP set status, got %q, want %q", got, want)
	}
}

```

### Core Architecture Module: `logger/log.go`
```
// Copyright 2012-2025 The NATS Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package logger provides logging facilities for the NATS server
package logger

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Default file permissions for log files.
const defaultLogPerms = os.FileMode(0640)

// Logger is the server logger
type Logger struct {
	sync.Mutex
	logger     *log.Logger
	debug      bool
	trace      bool
	infoLabel  string
	warnLabel  string
	errorLabel string
	fatalLabel string
	debugLabel string
	traceLabel string
	fl         *fileLogger
}

type LogOption interface {
	isLoggerOption()
}

// LogUTC controls whether timestamps in the log output should be UTC or local time.
type LogUTC bool

func (l LogUTC) isLoggerOption() {}

func logFlags(time bool, opts ...LogOption) int {
	flags := 0
	if time {
		flags = log.LstdFlags | log.Lmicroseconds
	}

	for _, opt := range opts {
		switch v := opt.(type) {
		case LogUTC:
			if time && bool(v) {
				flags |= log.LUTC
			}
		}
	}

	return flags
}

// NewStdLogger creates a logger with output directed to Stderr
func NewStdLogger(time, debug, trace, colors, pid bool, opts ...LogOption) *Logger {
	flags := logFlags(time, opts...)

	pre := ""
	if pid {
		pre = pidPrefix()
	}

	l := &Logger{
		logger: log.New(os.Stderr, pre, flags),
		debug:  debug,
		trace:  trace,
	}

	if colors {
		setColoredLabelFormats(l)
	} else {
		setPlainLabelFormats(l)
	}

	return l
}

// NewFileLogger creates a logger with output directed to a file
func NewFileLogger(filename string, time, debug, trace, pid bool, opts ...LogOption) *Logger {
	flags := logFlags(time, opts...)

	pre := ""
	if pid {
		pre = pidPrefix()
	}

	fl, err := newFileLogger(filename, pre, time)
	if err != nil {
		log.Fatalf("error opening file: %v", err)
		return nil
	}

	l := &Logger{
		logger: log.New(fl, pre, flags),
		debug:  debug,
		trace:  trace,
		fl:     fl,
	}
	fl.Lock()
	fl.l = l
	fl.Unlock()

	setPlainLabelFormats(l)
	return l
}

type writerAndCloser interface {
	Write(b []byte) (int, error)
	Close() error
	Name() string
}

type fileLogger struct {
	out       int64
	canRotate int32
	sync.Mutex
	l           *Logger
	f           writerAndCloser
	limit       int64
	olimit      int64
	pid         string
	time        bool
	closed      bool
	maxNumFiles int
}

func newFileLogger(filename, pidPrefix string, time bool) (*fileLogger, error) {
	fileflags := os.O_WRONLY | os.O_APPEND | os.O_CREATE
	f, err := os.OpenFile(filename, fileflags, defaultLogPerms)
	if err != nil {
		return nil, err
	}
	stats, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	fl := &fileLogger{
		canRotate: 0,
		f:         f,
		out:       stats.Size(),
		pid:       pidPrefix,
		time:      time,
	}
	return fl, nil
}

func (l *fileLogger) setLimit(limit int64) {
	l.Lock()
	l.olimit, l.limit = limit, limit
	atomic.StoreInt32(&l.canRotate, 1)
	rotateNow := l.out > l.limit
	l.Unlock()
	if rotateNow {
		l.l.Noticef("Rotating logfile...")
	}
}

func (l *fileLogger) setMaxNumFiles(max int) {
	l.Lock()
	l.maxNumFiles = max
	l.Unlock()
}

func (l *fileLogger) logDirect(label, format string, v ...any) int {
	var entrya = [256]byte{}
	var entry = entrya[:0]
	if l.pid != "" {
		entry = append(entry, l.pid...)
	}
	if l.time {
		now := time.Now()
		year, month, day := now.Date()
		hour, min, sec := now.Clock()
		microsec := now.Nanosecond() / 1000
		entry = append(entry, fmt.Sprintf("%04d/%02d/%02d %02d:%02d:%02d.%06d ",
			year, month, day, hour, min, sec, microsec)...)
	}
	entry = append(entry, label...)
	entry = append(entry, fmt.Sprintf(format, v...)...)
	entry = append(entry, '\r', '\n')
	l.f.Write(entry)
	return len(entry)
}

func (l *fileLogger) logPurge(fname string) {
	var backups []string
	lDir := filepath.Dir(fname)
	lBase := filepath.Base(fname)
	entries, err := os.ReadDir(lDir)
	if err != nil {
		l.logDirect(l.l.errorLabel, "Unable to read directory %q for log purge (%v), will attempt next rotation", lDir, err)
		return
	}
	for _, entry := range entries {
		if entry.IsDir() || entry.Name() == lBase || !strings.HasPrefix(entry.Name(), lBase) {
			continue
		}
		if stamp, found := strings.CutPrefix(entry.Name(), fmt.Sprintf("%s%s", lBase, ".")); found {
			_, err := time.Parse("2006:01:02:15:04:05.999999999", strings.Replace(stamp, ".", ":", 5))
			if err == nil {
				backups = append(backups, entry.Name())
			}
		}
	}
	currBackups := len(backups)
	maxBackups := l.maxNumFiles - 1
	if currBackups > maxBackups {
		// backups sorted oldest to latest based on timestamped lexical filename (ReadDir)
		for i := 0; i < currBackups-maxBackups; i++ {
			if err := os.Remove(filepath.Join(lDir, string(os.PathSeparator), backups[i])); err != nil {
				l.logDirect(l.l.errorLabel, "Unable to remove backup log file %q (%v), will attempt next rotation", backups[i], err)
				// Bail fast, we'll try again next rotation
				return
			}
			l.logDirect(l.l.infoLabel, "Purged log file %q", backups[i])
		}
	}
}

func (l *fileLogger) Write(b []byte) (int, error) {
	if atomic.LoadInt32(&l.canRotate) == 0 {
		n, err := l.f.Write(b)
		if err == nil {
			atomic.AddInt64(&l.out, int64(n))
		}
		return n, err
	}
	l.Lock()
	n, err := l.f.Write(b)
	if err == nil {
		l.out += int64(n)
		if l.out > l.limit {
			if err := l.f.Close(); err != nil {
				l.limit *= 2
				l.logDirect(l.l.errorLabel, "Unable to close logfile for rotation (%v), will attempt next rotation at size %v", err, l.limit)
				l.Unlock()
				return n, err
			}
			fname := l.f.Name()
			now := time.Now()
			bak := fmt.Sprintf("%s.%04d.%02d.%02d.%02d.%02d.%02d.%09d", fname,
				now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute(),
				now.Second(), now.Nanosecond())
			os.Rename(fname, bak)
			fileflags := os.O_WRONLY | os.O_APPEND | os.O_CREATE
			f, err := os.OpenFile(fname, fileflags, defaultLogPerms)
			if err != nil {
				l.Unlock()
				panic(fmt.Sprintf("Unable to re-open the logfile %q after rotation: %v", fname, err))
			}
			l.f = f
			n := l.logDirect(l.l.infoLabel, "Rotated log, backup saved as %q", bak)
			l.out = int64(n)
			l.limit = l.olimit
			if l.maxNumFiles > 0 {
				l.logPurge(fname)
			}
		}
	}
	l.Unlock()
	return n, err
}

func (l *fileLogger) close() error {
	l.Lock()
	if l.closed {
		l.Unlock()
		return nil
	}
	l.closed = true
	l.Unlock()
	return l.f.Close()
}

// SetSizeLimit sets the size of a logfile after which a backup
// is created with the file name + "year.month.day.hour.min.sec.nanosec"
// and the current log is truncated.
func (l *Logger) SetSizeLimit(limit int64) error {
	l.Lock()
	if l.fl == nil {
		l.Unlock()
		return fmt.Errorf("can set log size limit only for file logger")
	}
	fl := l.fl
	l.Unlock()
	fl.setLimit(limit)
	return nil
}

// SetMaxNumFiles sets the number of archived log files that will be retained
func (l *Logger) SetMaxNumFiles(max int) error {
	l.Lock()
	if l.fl == nil {
		l.Unlock()
		return fmt.Errorf("can set log max number of files only for file logger")
	}
	fl := l.fl
	l.Unlock()
	fl.setMaxNumFiles(max)
	return nil
}

// NewTestLogger creates a logger with output directed to Stderr with a prefix.
// Useful for tracing in tests when multiple servers are in the same pid
func NewTestLogger(prefix string, time bool) *Logger {
	flags := 0
	if time {
		flags = log.LstdFlags | log.Lmicroseconds
	}
	l := &Logger{
		logger: log.New(os.Stderr, prefix, flags),
		debug:  true,
		trace:  true,
	}
	setColoredLabelFormats(l)
	return l
}

```

### Core Architecture Module: `logger/syslog.go`
```
// Copyright 2012-2025 The NATS Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build !windows

package logger

import (
	"fmt"
	"log"
	"log/syslog"
	"net/url"
	"os"
	"strings"
)

// SysLogger provides a system logger facility
type SysLogger struct {
	writer *syslog.Writer
	debug  bool
	trace  bool
}

// SetSyslogName sets the name to use for the syslog.
// Currently used only on Windows.
func SetSyslogName(name string) {}

// GetSysLoggerTag generates the tag name for use in syslog statements. If
// the executable is linked, the name of the link will be used as the tag,
// otherwise, the name of the executable is used.  "nats-server" is the default
// for the NATS server.
func GetSysLoggerTag() string {
	procName := os.Args[0]
	if strings.ContainsRune(procName, os.PathSeparator) {
		parts := strings.FieldsFunc(procName, func(c rune) bool {
			return c == os.PathSeparator
		})
		procName = parts[len(parts)-1]
	}
	return procName
}

// NewSysLogger creates a new system logger
func NewSysLogger(debug, trace bool) *SysLogger {
	w, err := syslog.New(syslog.LOG_DAEMON|syslog.LOG_NOTICE, GetSysLoggerTag())
	if err != nil {
		log.Fatalf("error connecting to syslog: %q", err.Error())
	}

	return &SysLogger{
		writer: w,
		debug:  debug,
		trace:  trace,
	}
}

// NewRemoteSysLogger creates a new remote system logger
func NewRemoteSysLogger(fqn string, debug, trace bool) *SysLogger {
	network, addr := getNetworkAndAddr(fqn)
	w, err := syslog.Dial(network, addr, syslog.LOG_DEBUG, GetSysLoggerTag())
	if err != nil {
		log.Fatalf("error connecting to syslog: %q", err.Error())
	}

	return &SysLogger{
		writer: w,
		debug:  debug,
		trace:  trace,
	}
}

func getNetworkAndAddr(fqn string) (network, addr string) {
	u, err := url.Parse(fqn)
	if err != nil {
		log.Fatal(err)
	}

	network = u.Scheme
	if network == "udp" || network == "tcp" {
		addr = u.Host
	} else if network == "unix" {
		addr = u.Path
	} else {
		log.Fatalf("error invalid network type: %q", u.Scheme)
	}

	return
}

// Noticef logs a notice statement
func (l *SysLogger) Noticef(format string, v ...any) {
	l.writer.Notice(fmt.Sprintf(format, v...))
}

// Warnf logs a warning statement
func (l *SysLogger) Warnf(format string, v ...any) {
	l.writer.Warning(fmt.Sprintf(format, v...))
}

// Fatalf logs a fatal error
func (l *SysLogger) Fatalf(format string, v ...any) {
	l.writer.Crit(fmt.Sprintf(format, v...))
}

// Errorf logs an error statement
func (l *SysLogger) Errorf(format string, v ...any) {
	l.writer.Err(fmt.Sprintf(format, v...))
}

// Debugf logs a debug statement
func (l *SysLogger) Debugf(format string, v ...any) {
	if l.debug {
		l.writer.Debug(fmt.Sprintf(format, v...))
	}
}

// Tracef logs a trace statement
func (l *SysLogger) Tracef(format string, v ...any) {
	if l.trace {
		l.writer.Notice(fmt.Sprintf(format, v...))
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6558** (2026-09-02): **Fix the MOVE and CANCEL behaviours on Assets**
  *Symptoms*: ### Proposed change  There are several consistency and behaviour issues with moving assets:   * It's quite brittle and bandwidth expensive  * If it fails or get cancelled the stream might end up with the incorrect configuration - tags that does not reflect where the stream actually runs  * The cancel API is poorly implemented and does not respond with useful data   * The cancel API is not in the user account  There are some back story in https://github.com/nats-io/natscli/issues/724#issuecomment-1968986511  Dereks suggest we might pick 1 node in the target tag/cluster and bring it up to current, then make that the leader and only then expand the replicas in the target location so they sync from the leader that is then in their cluster.  This would greatly improve the performance and cost of super cluster moves.  This might be a bug fix in 2.11.x  ### Use case  We want to build tooling that proactively balances clusters using moves and cancels, users need to be able to do so manually without fear.  ### Contribution  _No response_

- **Issue #4707** (2023-10-30): **Different behavior between single node and clustered nats-servers regarding 'DeliverLastPerSubjectPolicy' with multiple subjects.**
  *Symptoms*: ### Observed behavior  We have go code that runs an ordered consumer with two subjects and the 'DeliverLastPerSubjectPolicy'. It works great using a nats-server 2.10.3 as single node. But if we use the same code on the three nodes cluster, we get a strange error.  I checked out 'nats.go' and added a line to debug what is sent to nats-server. See image for reference:  <img width="1285" alt="image" src="https://github.com/nats-io/nats-server/assets/719156/a90fb3b2-b3b7-4712-997c-976e82953e8b">  This is the local server, single-server with no auth setup:  ``` "$JS.API.CONSUMER.CREATE.kcl-orderlist.faQrdj1mbBnQdTMzO7DpLJ_1" / {"stream_name":"kcl-orderlist","config":{"name":"faQrdj1mbBnQdTMzO7DpLJ_1","deliver_policy":"last_per_subject","ack_policy":"none","replay_policy":"instant","inactive_threshold":300000000000,"num_replicas":1,"mem_storage":true,"filter_subjects":["kcl.v1.orderlist.*.*.*.*.data","kcl.v1.orderlist.*.*.info"]},"action":""} / (*jetstream.APIError)(nil) ```  This is the same code against our 3 node cluster running with an admin user (full access) on the:  ``` "$JS.API.CONSUMER.CREATE.kcl-orderlist.b0bjYmCvgD8ZONdSKx3CuF_1" / {"stream_name":"kcl-orderlist","config":{"name":"b0bjYmCvgD8ZONdSKx3CuF_1","deliver_policy":"last_per_subject","ack_policy":"none","replay_policy":"instant","inactive_threshold":300000000000,"num_replicas":1,"mem_storage":true,"filter_subjects":["kcl.v1.orderlist.*.*.*.*.data","kcl.v1.orderlist.*.*.info"]},"action":""} / &jets
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. I'm taking a look into it.

- **Issue #4529** (2023-09-13): **Panic in recalculateFirstForSubj**
  *Symptoms*: ### What version were you using?  [v2.9.22](https://github.com/nats-io/nats-server/releases/tag/v2.9.22)  ### What environment was the server running in?  Kubernetes/Linux  ### Is this defect reproducible?  I'm not sure how to reproduce this, but this out of bounds access may be related to the fix that was put in for this issue? https://github.com/nats-io/nats-server/issues/4445 https://github.com/nats-io/nats-server/commit/8865c2a703886356769bcbf877546010b79c3523 Maybe this caused the out of bounds access  ``` [1] 2023/09/13 15:35:12.278427 [DBG] JETSTREAM - JetStream connection closed: Client Closed panic: runtime error: slice bounds out of range [-3785495:]  goroutine 30 [running]: github.com/nats-io/nats-server/v2/server.(*msgBlock).recalculateFirstForSubj(0xc01d4b2680, {0xc023bedb80, 0x77}, 0xba431, 0xc0126d6500)     github.com/nats-io/nats-server/v2/server/filestore.go:5979 +0x2ca github.com/nats-io/nats-server/v2/server.(*fileStore).firstSeqForSubj(0xc00aa80580, {0xc023bedb80, 0x77})     github.com/nats-io/nats-server/v2/server/filestore.go:2584 +0x1c6 github.com/nats-io/nats-server/v2/server.(*fileStore).storeRawMsg(0xc00aa80580, {0xc023bedb80, 0x77}, {0xc02339efc0, 0x205, 0x205}, {0xc01bfef8c0, 0x293, 0x293}, 0xc422b, ...)     github.com/nats-io/nats-server/v2/server/filestore.go:2389 +0x675 github.com/nats-io/nats-server/v2/server.(*fileStore).StoreMsg(0xc00aa80580, {0xc023bedb80, 0x77}, {0xc02339efc0, 0x205, 0x205}, {0xc01bfef8c0, 0x293, 0x293})    

- **Issue #1789** (2024-06-05): **account cycle check broken when renaming subjects**
  *Symptoms*: unit test to demonstrate issue  ``` func TestAccountCycleWithRenaming(t *testing.T) { 	conf := createConfFile(t, []byte(` 		accounts { 		  A { 		    exports [ { service: * } ] 			imports [ { service { subject: foo, account: B }, to: foo } ] 		  } 		  B { 		    exports [ { service: foo } ] 			imports [ { service { subject: *, account: A }, to: "$1" } ] // will pass without to 		  } 		} 	`)) 	defer os.Remove(conf) 	if _, err := server.ProcessConfigFile(conf); err == nil || !strings.Contains(err.Error(), server.ErrImportFormsCycle.Error()) { 		t.Fatalf("Expected an error on cycle service import, got none") 	}  	conf = createConfFile(t, []byte(` 		accounts { 		  A { 		    exports [ { stream: * } ] 			imports [ { stream { subject: foo, account: B }, to: foo } ] 		  } 		  B { 		    exports [ { stream: foo } ] 			imports [ { stream { subject: *, account: A }, to: "$1" } ] // will pass without to 		  } 		} 	`)) 	defer os.Remove(conf) 	if _, err := server.ProcessConfigFile(conf); err == nil || !strings.Contains(err.Error(), server.ErrImportFormsCycle.Error()) { 		t.Fatalf("Expected an error on cycle service import, got none") 	} }  ```
  **Post-Mortem & Fix Analysis**:
  > I just tested this and still fails.
  > ok not high on my list, let's see if someone else can pick up.

- **Issue #432** (2017-05-18): **Authorization Timeout and TLS**
  *Symptoms*: When TLS and authorization is enabled, the authorization timeout can fire during the TLS handshake, causing the server to write the authorization timeout error string into the client socket, injecting what becomes bad data into the TLS handshake.  This creates misleading errors on the client such as `tls: oversized record received with length 21024`.  I've only seen this happen when the host machine is under very heavy load with many clients simultaneously connecting, causing the server to become CPU bound.  There are a few ways to tackle this, but I propose waiting to schedule the authorization timer until after TLS is fully established to avoid this scenario.  Any thoughts?
  **Post-Mortem & Fix Analysis**:
  > FYI, this issue (or a variation of it) appears to still exist. We were seeing connection problems a lot of the time, using gnats 1.10. Examining the network capture, I see the negotiation starting to take place, and then the server sends a plaintext "-ERR 'Secure Connection - TLS Required', which naturally derails the client.  Increasing the TLS handshake timeout resolved the issue. Before the change, every other connection would fail (staging environment, one client, no load). After the change, no connections appear to fail. If it matters, we use client certificates.  EDIT: After some more research, I now understand that in gnatsd there are two separate timeout settings, one for auth and another for TLS. The former seems to have been addressed, but the latter is still problematic. If you want to keep the TLS handshake timeout, I suggest increasing it to a reasonable value that will not trigger under normal circumstances. The default value is too low.  Having said that, what prob
  > Being able to set these is due to DOS attack mitigation.
  > Interesting. Has this been done preemptively, or have there been attacks against TLS handshakes in the past?

- **Issue #5** (2013-07-31): **gnatsd HTTP monitoring has some issues**
  *Symptoms*: First, gnatsd takes a parameter to use as the HTTP monitoring port, however it doesn't actually use the passed parameter.  The port is hardcoded to 6062.  Second, gnatsd always starts the HTTP server, but only registers the handlers for the server if the monitoring port is specified.  The goroutine to launch the HTTP monitoring should be moved within the if statement to see if a monitoring port was specified. 
  **Post-Mortem & Fix Analysis**:
  > I think monitoring ports for varz, etc are ok. Do you mean the pprof http? 
  > I will add in support for configuring via the config file, which is new, etc.. 
  > Yes, the HTTP monitoring, not the profiler.  The provider appears to be hard-coded to "localhost:6062", but it is isolated to the gnatsd binary and not the actual server's goroutine, so should be fine. 

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

### Incident Patch 1: `9df443af` (2026-09-30)
**Commit Message**: Fix TLS pin matching on config reload (#8679)

This ensures that we check validity of the correct pins.

**File**: `server/reload.go` (modified, +3/-3)
```diff
@@ -1313,13 +1313,13 @@ func (s *Server) recheckPinnedCerts(curOpts *Options, newOpts *Options) {
 	disconnectClients := []*client{}
 	protoToPinned := map[int]PinnedCertSet{}
 	if !reflect.DeepEqual(newOpts.TLSPinnedCerts, curOpts.TLSPinnedCerts) {
-		protoToPinned[NATS] = curOpts.TLSPinnedCerts
+		protoToPinned[NATS] = newOpts.TLSPinnedCerts
 	}
 	if !reflect.DeepEqual(newOpts.MQTT.TLSPinnedCerts, curOpts.MQTT.TLSPinnedCerts) {
-		protoToPinned[MQTT] = curOpts.MQTT.TLSPinnedCerts
+		protoToPinned[MQTT] = newOpts.MQTT.TLSPinnedCerts
 	}
 	if !reflect.DeepEqual(newOpts.Websocket.TLSPinnedCerts, curOpts.Websocket.TLSPinnedCerts) {
-		protoToPinned[WS] = curOpts.Websocket.TLSPinnedCerts
+		protoToPinned[WS] = newOpts.Websocket.TLSPinnedCerts
 	}
 	for _, c := range s.clients {
 		if c.kind != CLIENT {
```

**File**: `server/reload_test.go` (modified, +40/-0)
```diff
@@ -442,6 +442,46 @@ func TestConfigReloadRotateTLS(t *testing.T) {
 	}
 }
 
+func TestConfigReloadTLSPinnedCertsDisconnectsClient(t *testing.T) {
+	const config = `
+		host: localhost
+		port: -1
+		tls {
+			ca_file: "../test/configs/certs/ca.pem"
+			cert_file: "../test/configs/certs/server-cert.pem"
+			key_file: "../test/configs/certs/server-key.pem"
+			verify: true
+			pinned_certs: ["%s"]
+		}
+	`
+	const (
+		clientCertPin = "bf6f821f09fde09451411ba3b42c0f74727d61a974c69fd3cf5257f39c75f0e9"
+		otherCertPin  = "aaaaaaaa09fde09451411ba3b42c0f74727d61a974c69fd3cf5257f39c75f0e9"
+	)
+
+	conf := createConfFile(t, fmt.Appendf(nil, config, clientCertPin))
+	srv, _ := RunServerWithConfig(conf)
+	defer srv.Shutdown()
+
+	nc, err := nats.Connect(srv.ClientURL(),
+		nats.RootCAs("../test/configs/certs/ca.pem"),
+		nats.ClientCert("../test/configs/certs/client-cert.pem", "../test/configs/certs/client-key.pem"),
+		nats.NoReconnect(),
+	)
+	require_NoError(t, err)
+	defer nc.Close()
+
+	require_NoError(t, os.WriteFile(conf, fmt.Appendf(nil, config, otherCertPin), 0660))
+	require_NoError(t, srv.Reload())
+
+	checkFor(t, 2*time.Second, 10*time.Millisecond, func() error {
+		if !nc.IsClosed() {
+			return fmt.Errorf("client with removed certificate pin is still connected")
+		}
+		return nil
+	})
+}
+
 // Ensure Reload supports enabling TLS. Test this by starting a server without
 // TLS enabled, connect to it to verify, reload config with TLS enabled, ensure
 // reconnect fails, then ensure reconnect succeeds when using secure.
```

---

### Incident Patch 2: `a503b635` (2026-09-30)
**Commit Message**: Fix TLS pin matching on config reload

Signed-off-by: Neil Twigg <neil@nats.io>
Reported-by: ARSB1

**File**: `server/reload.go` (modified, +3/-3)
```diff
@@ -1313,13 +1313,13 @@ func (s *Server) recheckPinnedCerts(curOpts *Options, newOpts *Options) {
 	disconnectClients := []*client{}
 	protoToPinned := map[int]PinnedCertSet{}
 	if !reflect.DeepEqual(newOpts.TLSPinnedCerts, curOpts.TLSPinnedCerts) {
-		protoToPinned[NATS] = curOpts.TLSPinnedCerts
+		protoToPinned[NATS] = newOpts.TLSPinnedCerts
 	}
 	if !reflect.DeepEqual(newOpts.MQTT.TLSPinnedCerts, curOpts.MQTT.TLSPinnedCerts) {
-		protoToPinned[MQTT] = curOpts.MQTT.TLSPinnedCerts
+		protoToPinned[MQTT] = newOpts.MQTT.TLSPinnedCerts
 	}
 	if !reflect.DeepEqual(newOpts.Websocket.TLSPinnedCerts, curOpts.Websocket.TLSPinnedCerts) {
-		protoToPinned[WS] = curOpts.Websocket.TLSPinnedCerts
+		protoToPinned[WS] = newOpts.Websocket.TLSPinnedCerts
 	}
 	for _, c := range s.clients {
 		if c.kind != CLIENT {
```

**File**: `server/reload_test.go` (modified, +40/-0)
```diff
@@ -442,6 +442,46 @@ func TestConfigReloadRotateTLS(t *testing.T) {
 	}
 }
 
+func TestConfigReloadTLSPinnedCertsDisconnectsClient(t *testing.T) {
+	const config = `
+		host: localhost
+		port: -1
+		tls {
+			ca_file: "../test/configs/certs/ca.pem"
+			cert_file: "../test/configs/certs/server-cert.pem"
+			key_file: "../test/configs/certs/server-key.pem"
+			verify: true
+			pinned_certs: ["%s"]
+		}
+	`
+	const (
+		clientCertPin = "bf6f821f09fde09451411ba3b42c0f74727d61a974c69fd3cf5257f39c75f0e9"
+		otherCertPin  = "aaaaaaaa09fde09451411ba3b42c0f74727d61a974c69fd3cf5257f39c75f0e9"
+	)
+
+	conf := createConfFile(t, fmt.Appendf(nil, config, clientCertPin))
+	srv, _ := RunServerWithConfig(conf)
+	defer srv.Shutdown()
+
+	nc, err := nats.Connect(srv.ClientURL(),
+		nats.RootCAs("../test/configs/certs/ca.pem"),
+		nats.ClientCert("../test/configs/certs/client-cert.pem", "../test/configs/certs/client-key.pem"),
+		nats.NoReconnect(),
+	)
+	require_NoError(t, err)
+	defer nc.Close()
+
+	require_NoError(t, os.WriteFile(conf, fmt.Appendf(nil, config, otherCertPin), 0660))
+	require_NoError(t, srv.Reload())
+
+	checkFor(t, 2*time.Second, 10*time.Millisecond, func() error {
+		if !nc.IsClosed() {
+			return fmt.Errorf("client with removed certificate pin is still connected")
+		}
+		return nil
+	})
+}
+
 // Ensure Reload supports enabling TLS. Test this by starting a server without
 // TLS enabled, connect to it to verify, reload config with TLS enabled, ensure
 // reconnect fails, then ensure reconnect succeeds when using secure.
```

---

### Incident Patch 3: `19c21979` (2026-09-30)
**Commit Message**: [FIXED] Per-account routes double count inbound account stats (#8677)

A message arriving over a route is added to the account's received
totals when it is routed. A per-account route's connection also belongs
to that account, so the read loop added the same messages a second time.
Accounts pinned via cluster.accounts, and the system account, which is
pinned by default, reported twice the received msgs and bytes, while the
route breakdown and server totals counted them once.

<!-- Please make sure to read @CONTRIBUTING.md, then delete this notice
and replace it with your PR description. Commit sign-offs certify that
the contribution is your original work and that you license the work to
the project under the Apache-2.0 license. We cannot accept contributions
without it. We accept AI-assisted contributions but AI agents should not
open pull requests directly. -->

**File**: `server/client.go` (modified, +3/-1)
```diff
@@ -1648,7 +1648,9 @@ func (c *client) readLoop(pre []byte) {
 			atomic.AddInt64(&c.inMsgs, inMsgs)
 			atomic.AddInt64(&c.inBytes, inBytes)
 
-			if acc != nil {
+			// A per-account route has its account set, but routed messages were
+			// already added to the account's stats in processInboundRoutedMsg.
+			if acc != nil && c.kind != ROUTER {
 				acc.stats.Lock()
 				acc.stats.inMsgs += inMsgs
 				acc.stats.inBytes += inBytes
```

**File**: `server/routes_test.go` (modified, +72/-0)
```diff
@@ -2800,6 +2800,78 @@ func TestRoutePerAccountImplicit(t *testing.T) {
 	checkClusterFormed(t, s1, s2, s3)
 }
 
+func TestRoutePerAccountInboundStatsCountedOnce(t *testing.T) {
+	tmpl := `
+		port: -1
+		accounts {
+			A { users: [{user: "a", password: "a"}] }
+			B { users: [{user: "b", password: "b"}] }
+		}
+		cluster {
+			port: -1
+			name: "local"
+			accounts: ["A"]
+			%s
+		}
+	`
+	conf1 := createConfFile(t, []byte(fmt.Sprintf(tmpl, _EMPTY_)))
+	s1, o1 := RunServerWithConfig(conf1)
+	defer s1.Shutdown()
+
+	conf2 := createConfFile(t, []byte(fmt.Sprintf(tmpl,
+		fmt.Sprintf("routes: [\"nats://127.0.0.1:%d\"]", o1.Cluster.Port))))
+	s2, _ := RunServerWithConfig(conf2)
+	defer s2.Shutdown()
+
+	checkClusterFormed(t, s1, s2)
+
+	const n = 10
+	payload := []byte("hello")
+
+	// Account A has a dedicated route, account B uses the pool. Messages that
+	// reach s2 only over a route must count once in the account's received
+	// totals either way, matching the route breakdown and the sender's count.
+	for _, acc := range []string{"A", "B"} {
+		t.Run(acc, func(t *testing.T) {
+			user := strings.ToLower(acc)
+			s2nc := natsConnect(t, s2.ClientURL(), nats.UserInfo(user, user))
+			defer s2nc.Close()
+			sub := natsSubSync(t, s2nc, "foo")
+			natsFlush(t, s2nc)
+
+			s1nc := natsConnect(t, s1.ClientURL(), nats.UserInfo(user, user))
+			defer s1nc.Close()
+			checkSubInterest(t, s1, acc, "foo", time.Second)
+
+			for i := 0; i < n; i++ {
+				natsPub(t, s1nc, "foo", payload)
+			}
+			for i := 0; i < n; i++ {
+				natsNexMsg(t, sub, time.Second)
+			}
+
+			checkFor(t, time.Second, 15*time.Millisecond, func() error {
+				stz, err := s2.AccountStatz(&AccountStatzOptions{Accounts: []string{acc}})
+				if err != nil {
+					return err
+				}
+				if len(stz.Accounts) != 1 {
+					return fmt.Errorf("expected 1 account, got %d", len(stz.Accounts))
+				}
+				recv := stz.Accounts[0].Received
+				if recv.Routes == nil || recv.Routes.Msgs != n {
+					return fmt.Errorf("expected %d route msgs received, got %+v", n, recv.Routes)
+				}
+				if recv.Msgs != n || recv.Bytes != int64(n*len(payload)) {
+					return fmt.Errorf("expected %d msgs and %d bytes received, got %d and %d",
+						n, n*len(payload), recv.Msgs, recv.Bytes)
+				}
+				return nil
+			})
+		})
+	}
+}
+
 func TestRoutePerAccountDefaultForSysAccount(t *testing.T) {
 	tmpl := `
 		port: -1
```

---

### Incident Patch 4: `24c0b9d9` (2026-09-30)
**Commit Message**: [FIXED] Services Import/Export: several data races during reload (#8675)

Fixed several data races during configuration reload or update of
account with claims for service import/export/latency.

Relates to #8509 (created by @waterWang)
Resolves #8499

Signed-off-by: Ivan Kozlovic <ivan@synadia.com>

**File**: `server/accounts.go` (modified, +18/-13)
```diff
@@ -2531,14 +2531,16 @@ func (a *Account) newServiceReply(tracking bool) []byte {
 	reply = append(reply, replyPre...)
 	reply = append(reply, b[:]...)
 
-	if tracking && s.sys != nil {
-		// Add in our tracking identifier. This allows the metrics to get back to only
-		// this server without needless SUBS/UNSUBS.
-		reply = append(reply, '.')
-		reply = append(reply, s.sys.shash...)
-		reply = append(reply, '.', 'T')
-	}
+	if tracking {
+		if shash := s.Node(); shash != _EMPTY_ {
+			// Add in our tracking identifier. This allows the metrics to get back to only
+			// this server without needless SUBS/UNSUBS.
+			reply = append(reply, '.')
+			reply = append(reply, shash...)
+			reply = append(reply, '.', 'T')
 
+		}
+	}
 	return reply
 }
 
@@ -2668,12 +2670,15 @@ func (a *Account) SetServiceExportAllowTrace(export string, allowTrace bool) err
 func (a *Account) addRespServiceImport(dest *Account, to string, osi *serviceImport, tracking bool, header http.Header, mt *msgTrace) *serviceImport {
 	nrr := string(osi.acc.newServiceReply(tracking))
 
+	dest.mu.Lock()
+	osiSe, osiLat, osiRT, osiShare := osi.se, osi.latency, osi.rt, osi.share
+	dest.mu.Unlock()
+
 	a.mu.Lock()
-	rt := osi.rt
 
 	// dest is the requestor's account. a is the service responder with the export.
 	// Marked as internal here, that is how we distinguish.
-	si := &serviceImport{dest, nil, osi.se, nil, nrr, to, nil, 0, rt, nil, nil, nil, mt, false, true, false, osi.share, false, false, false, nil}
+	si := &serviceImport{dest, nil, osiSe, nil, nrr, to, nil, 0, osiRT, nil, nil, nil, mt, false, true, false, osiShare, false, false, false, nil}
 
 	if a.exports.responses == nil {
 		a.exports.responses = make(map[string]*serviceImport)
@@ -2682,12 +2687,12 @@ func (a *Account) addRespServiceImport(dest *Account, to string, osi *serviceImp
 
 	// Always grab time and make sure response threshold timer is running.
 	si.ts = time.Now().UnixNano()
-	if osi.se != nil {
-		osi.se.setResponseThresholdTimer()
+	if osiSe != nil {
+		osiSe.setResponseThresholdTimer()
 	}
 
-	if rt == Singleton && tracking {
-		si.latency = osi.latency
+	if osiRT == Singleton && tracking {
+		si.latency = osiLat
 		si.tracking = true
 		si.trackingHdr = header
 	}
```

**File**: `server/client.go` (modified, +21/-8)
```diff
@@ -4636,9 +4636,9 @@ func (c *client) handleGWReplyMap(msg []byte) bool {
 }
 
 // Used to setup the response map for a service import request that has a reply subject.
-func (c *client) setupResponseServiceImport(acc *Account, si *serviceImport, tracking bool, header http.Header) *serviceImport {
+func (c *client) setupResponseServiceImport(acc *Account, si *serviceImport, hasLatency, tracking bool, header http.Header) *serviceImport {
 	rsi := si.acc.addRespServiceImport(acc, string(c.pa.reply), si, tracking, header, nil)
-	if si.latency != nil {
+	if hasLatency {
 		if c.rtt == 0 {
 			// We have a service import that we are tracking but have not established RTT.
 			c.sendRTTPing()
@@ -4925,16 +4925,17 @@ func (c *client) processServiceImport(si *serviceImport, acc *Account, msg []byt
 	if (c.kind == GATEWAY || c.kind == ROUTER) && !isResponse {
 		return false
 	}
+	// We need to protect `si` fields with account's read lock.
+	acc.mu.RLock()
 	// Detect cycles and ignore (return) when we detect one.
 	if len(c.pa.psi) > 0 {
 		for i := len(c.pa.psi) - 1; i >= 0; i-- {
 			if psi := c.pa.psi[i]; psi.se == si.se {
+				acc.mu.RUnlock()
 				return false
 			}
 		}
 	}
-
-	acc.mu.RLock()
 	var checkJS bool
 	shouldReturn := si.invalid || acc.sl == nil
 	if !shouldReturn && !isResponse && si.to == jsAllAPI {
@@ -4945,37 +4946,49 @@ func (c *client) processServiceImport(si *serviceImport, acc *Account, msg []byt
 	siAcc := si.acc
 	allowTrace := si.atrc
 	isMsgTraceResp := isResponse && si.mt != nil
+	siSe := si.se
+	siLat := si.latency
 	acc.mu.RUnlock()
 
 	// We have a special case where JetStream pulls in all service imports through one export.
 	// However the GetNext for consumers and DirectGet for streams are a no-op and causes buildups of service imports,
 	// response service imports and rrMap entries which all will need to simply expire.
 	// TODO(dlc) - Come up with something better.
-	if shouldReturn || (checkJS && si.se != nil && si.se.acc == c.srv.SystemAccount()) {
+	if shouldReturn {
 		return false
 	}
+	if checkJS && siSe != nil {
+		// siSe.acc is updated by configureAccounts() under the exporting
+		// account's lock (siAcc), so read it under that lock.
+		siAcc.mu.RLock()
+		viaSysAcc := siSe.acc == c.srv.SystemAccount()
+		siAcc.mu.RUnlock()
+		if viaSysAcc {
+			return false
+		}
+	}
 
 	mt, traceOnly := c.isMsgTraceEnabled()
 
 	var nrr []byte
 	var rsi *serviceImport
 
 	// Check if there is a reply present and set up a response.
-	tracking, headers := shouldSample(si.latency, c)
+	tracking, headers := shouldSample(siLat, c)
 	if len(c.pa.reply) > 0 {
 		// Special case for now, need to formalize.
 		// TODO(dlc) - Formalize as a service import option for reply rewrite.
 		// For now we can't do $JS.ACK since that breaks pull consumers across accounts.
 		if !bytes.HasPrefix(c.pa.reply, []byte(jsAckPre)) {
-			if rsi = c.setupResponseServiceImport(acc, si, tracking, headers); rsi != nil {
+			if rsi = c.setupResponseServiceImport(acc, si, siLat != nil, tracking, headers); rsi != nil {
 				nrr = []byte(rsi.from)
 			}
 		} else {
 			// This only happens when we do a pull subscriber that trampolines through another account.
 			// Normally this code is not called.
 			nrr = c.pa.reply
 		}
-	} else if !isResponse && si.latency != nil && tracking {
+	} else if !isResponse && siLat != nil && tracking {
 		// Check to see if this was a bad request with no reply and we were supposed to be tracking.
 		siAcc.sendBadRequestTrackingLatency(si, c, headers)
 	}
```

**File**: `server/reload_test.go` (modified, +89/-0)
```diff
@@ -7817,3 +7817,92 @@ func TestConfigReloadKeepsJetStreamAPIImportLinkedToSystemExport(t *testing.T) {
 	fetch()
 	require_Equal(t, numResponses(), before)
 }
+
+func TestConfigReloadNoRaceWithServiceImports(t *testing.T) {
+	kp, err := nkeys.CreateUser()
+	require_NoError(t, err)
+	pub, _ := kp.PublicKey()
+
+	storeDir := t.TempDir()
+	mkOpts := func() *Options {
+		return &Options{
+			Host:      "127.0.0.1",
+			Port:      -1,
+			JetStream: true,
+			StoreDir:  storeDir,
+			NoSigs:    true,
+			NoLog:     true,
+			Nkeys:     []*NkeyUser{{Nkey: pub}},
+		}
+	}
+	srv := RunServer(mkOpts())
+	defer srv.Shutdown()
+
+	sign := func(nonce []byte) ([]byte, error) { return kp.Sign(nonce) }
+	nc, js := jsClientConnect(t, srv, nats.Nkey(pub, sign), nats.Timeout(5*time.Second))
+	defer nc.Close()
+
+	_, err = js.AddStream(&nats.StreamConfig{Name: "S", Subjects: []string{"js.>"}})
+	require_NoError(t, err)
+	pull, err := js.PullSubscribe("js.>", "dur")
+	require_NoError(t, err)
+
+	stop := make(chan struct{})
+	var wg sync.WaitGroup
+	for i := 0; i < 4; i++ { // concurrent JetStream publishers ($JS.API service imports)
+		wg.Add(1)
+		go func() {
+			defer wg.Done()
+			for {
+				select {
+				case <-stop:
+					return
+				default:
+				}
+				_, _ = js.Publish("js.x", []byte("x"), nats.AckWait(500*time.Millisecond))
+			}
+		}()
+	}
+	wg.Add(1)
+	go func() { // consumer fetch loop: delivery is the read side
+		defer wg.Done()
+		for {
+			select {
+			case <-stop:
+				return
+			default:
+			}
+			msgs, _ := pull.Fetch(20, nats.MaxWait(200*time.Millisecond))
+			for _, m := range msgs {
+				_ = m.Ack()
+			}
+		}
+	}()
+	wg.Add(1)
+	errCh := make(chan error, 1)
+	go func() { // ReloadOptions loop: the write side
+		defer wg.Done()
+		tk := time.NewTicker(5 * time.Millisecond)
+		defer tk.Stop()
+		for {
+			select {
+			case <-stop:
+				return
+			case <-tk.C:
+				if err := srv.ReloadOptions(mkOpts()); err != nil {
+					errCh <- fmt.Errorf("reload error: %v", err)
+					return
+				}
+			}
+		}
+	}()
+
+	time.Sleep(3 * time.Second)
+	close(stop)
+	wg.Wait()
+	select {
+	case err := <-errCh:
+		t.Fatal(err)
+	default:
+	}
+}
```

**File**: `test/service_latency_test.go` (modified, +103/-0)
```diff
@@ -1921,3 +1921,106 @@ func TestServiceLatencyDoubleResponse(t *testing.T) {
 	rsub.NextMsg(time.Second)
 	time.Sleep(time.Second)
 }
+
+func TestServiceLatencyNoRaceOnUpdateClaims(t *testing.T) {
+	okp, _ := nkeys.FromSeed(oSeed)
+
+	// Create three accounts, system, service and normal account.
+	sysJWT, sysKP, _ := createAccountWithJWT(t)
+	sysPub, _ := sysKP.PublicKey()
+
+	_, svcKP, svcAcc := createAccountWithJWT(t)
+	svcPub, _ := svcKP.PublicKey()
+
+	// Add in the service export with latency tracking here.
+	serviceExport := &jwt.Export{Subject: "req.*", Type: jwt.Service}
+	svcAcc.Exports.Add(serviceExport)
+	svcJWT, err := svcAcc.Encode(okp)
+	if err != nil {
+		t.Fatalf("Error encoding service export: %v", err)
+	}
+
+	_, accKP, accAcc := createAccountWithJWT(t)
+	accPub, _ := accKP.PublicKey()
+
+	// Add in the import.
+	serviceImport := &jwt.Import{Account: svcPub, Subject: "request", To: "req.echo", Type: jwt.Service}
+	accAcc.Imports.Add(serviceImport)
+	accJWT, err := accAcc.Encode(okp)
+	if err != nil {
+		t.Fatalf("Error encoding service import: %v", err)
+	}
+
+	cf := `
+	listen: 127.0.0.1:-1
+	operator = "../test/configs/nkeys/op.jwt"
+	system_account = "%s"
+	resolver = MEMORY
+	resolver_preload = {
+		%s : "%s"
+		%s : "%s"
+		%s : "%s"
+	}
+	`
+	contents := strings.Replace(fmt.Sprintf(cf, sysPub, sysPub, sysJWT, svcPub, svcJWT, accPub, accJWT), "\n\t", "\n", -1)
+	conf := createConfFile(t, []byte(contents))
+
+	s, opts := RunServerWithConfig(conf)
+	defer s.Shutdown()
+
+	// Create service provider.
+	url := fmt.Sprintf("nats://%s:%d", opts.Host, opts.Port)
+	nc, err := nats.Connect(url, createUserCreds(t, s, svcKP), nats.Name("fooService"))
+	if err != nil {
+		t.Fatalf("Error on connect: %v", err)
+	}
+	defer nc.Close()
+
+	// The service listener.
+	nc.Subscribe("req.echo", func(msg *nats.Msg) {
+		time.Sleep(10 * time.Millisecond)
+		msg.Respond(msg.Data)
+	})
+	// Listen for metrics
+	nc.Subscribe("results", func(_ *nats.Msg) {})
+	nc.Flush()
+
+	nc2, err := nats.Connect(url, createUserCreds(t, s, accKP))
+	if err != nil {
+		t.Fatalf("Error on connect: %v", err)
+	}
+	defer nc2.Close()
+
+	updateAccount := func() {
+		t.Helper()
+		svcAccount, err := s.LookupAccount(svcPub)
+		if err != nil {
+			t.Fatalf("Could not lookup service account from server %+v", s)
+		}
+		s.UpdateAccountClaims(svcAccount, svcAcc)
+	}
+
+	wg := sync.WaitGroup{}
+	wg.Add(1)
+	doneCh := make(chan struct{})
+	go func() {
+		defer wg.Done()
+		for {
+			nc2.PublishRequest("request", "some.inbox", []byte("hello"))
+			select {
+			case <-doneCh:
+				return
+			default:
+			}
+		}
+	}()
+
+	for i := 99; i > 0; i-- {
+		serviceExport.Latency = &jwt.ServiceLatency{Sampling: jwt.SamplingRate(i), Results: "results"}
+		updateAccount()
+		time.Sleep(5 * time.Millisecond)
+	}
+
+	close(doneCh)
+	wg.Wait()
+}
```

---

### Incident Patch 5: `9feeba17` (2026-09-29)
**Commit Message**: [FIXED] Services Import/Export: several data races during reload

Fixed several data races during configuration reload or update
of account with claims for service import/export/latency.

Relates to #8509 (created by @waterWang)
Resolves #8499

Signed-off-by: Ivan Kozlovic <ivan@synadia.com>

**File**: `server/accounts.go` (modified, +19/-14)
```diff
@@ -2531,14 +2531,16 @@ func (a *Account) newServiceReply(tracking bool) []byte {
 	reply = append(reply, replyPre...)
 	reply = append(reply, b[:]...)
 
-	if tracking && s.sys != nil {
-		// Add in our tracking identifier. This allows the metrics to get back to only
-		// this server without needless SUBS/UNSUBS.
-		reply = append(reply, '.')
-		reply = append(reply, s.sys.shash...)
-		reply = append(reply, '.', 'T')
-	}
+	if tracking {
+		if shash := s.Node(); shash != _EMPTY_ {
+			// Add in our tracking identifier. This allows the metrics to get back to only
+			// this server without needless SUBS/UNSUBS.
+			reply = append(reply, '.')
+			reply = append(reply, shash...)
+			reply = append(reply, '.', 'T')
 
+		}
+	}
 	return reply
 }
 
@@ -2668,12 +2670,18 @@ func (a *Account) SetServiceExportAllowTrace(export string, allowTrace bool) err
 func (a *Account) addRespServiceImport(dest *Account, to string, osi *serviceImport, tracking bool, header http.Header, mt *msgTrace) *serviceImport {
 	nrr := string(osi.acc.newServiceReply(tracking))
 
+	dest.mu.Lock()
+	osiSe, osiLat, osiRT, osiShare := osi.se, osi.latency, osi.rt, osi.share
+	if osiSe != nil {
+		osiSe.setResponseThresholdTimer()
+	}
+	dest.mu.Unlock()
+
 	a.mu.Lock()
-	rt := osi.rt
 
 	// dest is the requestor's account. a is the service responder with the export.
 	// Marked as internal here, that is how we distinguish.
-	si := &serviceImport{dest, nil, osi.se, nil, nrr, to, nil, 0, rt, nil, nil, nil, mt, false, true, false, osi.share, false, false, false, nil}
+	si := &serviceImport{dest, nil, osiSe, nil, nrr, to, nil, 0, osiRT, nil, nil, nil, mt, false, true, false, osiShare, false, false, false, nil}
 
 	if a.exports.responses == nil {
 		a.exports.responses = make(map[string]*serviceImport)
@@ -2682,12 +2690,9 @@ func (a *Account) addRespServiceImport(dest *Account, to string, osi *serviceImp
 
 	// Always grab time and make sure response threshold timer is running.
 	si.ts = time.Now().UnixNano()
-	if osi.se != nil {
-		osi.se.setResponseThresholdTimer()
-	}
 
-	if rt == Singleton && tracking {
-		si.latency = osi.latency
+	if osiRT == Singleton && tracking {
+		si.latency = osiLat
 		si.tracking = true
 		si.trackingHdr = header
 	}
```

**File**: `server/client.go` (modified, +21/-8)
```diff
@@ -4636,9 +4636,9 @@ func (c *client) handleGWReplyMap(msg []byte) bool {
 }
 
 // Used to setup the response map for a service import request that has a reply subject.
-func (c *client) setupResponseServiceImport(acc *Account, si *serviceImport, tracking bool, header http.Header) *serviceImport {
+func (c *client) setupResponseServiceImport(acc *Account, si *serviceImport, hasLatency, tracking bool, header http.Header) *serviceImport {
 	rsi := si.acc.addRespServiceImport(acc, string(c.pa.reply), si, tracking, header, nil)
-	if si.latency != nil {
+	if hasLatency {
 		if c.rtt == 0 {
 			// We have a service import that we are tracking but have not established RTT.
 			c.sendRTTPing()
@@ -4925,16 +4925,17 @@ func (c *client) processServiceImport(si *serviceImport, acc *Account, msg []byt
 	if (c.kind == GATEWAY || c.kind == ROUTER) && !isResponse {
 		return false
 	}
+	// We need to protect `si` fields with account's read lock.
+	acc.mu.RLock()
 	// Detect cycles and ignore (return) when we detect one.
 	if len(c.pa.psi) > 0 {
 		for i := len(c.pa.psi) - 1; i >= 0; i-- {
 			if psi := c.pa.psi[i]; psi.se == si.se {
+				acc.mu.RUnlock()
 				return false
 			}
 		}
 	}
-
-	acc.mu.RLock()
 	var checkJS bool
 	shouldReturn := si.invalid || acc.sl == nil
 	if !shouldReturn && !isResponse && si.to == jsAllAPI {
@@ -4945,37 +4946,49 @@ func (c *client) processServiceImport(si *serviceImport, acc *Account, msg []byt
 	siAcc := si.acc
 	allowTrace := si.atrc
 	isMsgTraceResp := isResponse && si.mt != nil
+	siSe := si.se
+	siLat := si.latency
 	acc.mu.RUnlock()
 
 	// We have a special case where JetStream pulls in all service imports through one export.
 	// However the GetNext for consumers and DirectGet for streams are a no-op and causes buildups of service imports,
 	// response service imports and rrMap entries which all will need to simply expire.
 	// TODO(dlc) - Come up with something better.
-	if shouldReturn || (checkJS && si.se != nil && si.se.acc == c.srv.SystemAccount()) {
+	if shouldReturn {
 		return false
 	}
+	if checkJS && siSe != nil {
+		// siSe.acc is updated by configureAccounts() under the exporting
+		// account's lock (siAcc), so read it under that lock.
+		siAcc.mu.RLock()
+		viaSysAcc := siSe.acc == c.srv.SystemAccount()
+		siAcc.mu.RUnlock()
+		if viaSysAcc {
+			return false
+		}
+	}
 
 	mt, traceOnly := c.isMsgTraceEnabled()
 
 	var nrr []byte
 	var rsi *serviceImport
 
 	// Check if there is a reply present and set up a response.
-	tracking, headers := shouldSample(si.latency, c)
+	tracking, headers := shouldSample(siLat, c)
 	if len(c.pa.reply) > 0 {
 		// Special case for now, need to formalize.
 		// TODO(dlc) - Formalize as a service import option for reply rewrite.
 		// For now we can't do $JS.ACK since that breaks pull consumers across accounts.
 		if !bytes.HasPrefix(c.pa.reply, []byte(jsAckPre)) {
-			if rsi = c.setupResponseServiceImport(acc, si, tracking, headers); rsi != nil {
+			if rsi = c.setupResponseServiceImport(acc, si, siLat != nil, tracking, headers); rsi != nil {
 				nrr = []byte(rsi.from)
 			}
 		} else {
 			// This only happens when we do a pull subscriber that trampolines through another account.
 			// Normally this code is not called.
 			nrr = c.pa.reply
 		}
-	} else if !isResponse && si.latency != nil && tracking {
+	} else if !isResponse && siLat != nil && tracking {
 		// Check to see if this was a bad request with no reply and we were supposed to be tracking.
 		siAcc.sendBadRequestTrackingLatency(si, c, headers)
 	}
```

**File**: `server/reload_test.go` (modified, +89/-0)
```diff
@@ -7817,3 +7817,92 @@ func TestConfigReloadKeepsJetStreamAPIImportLinkedToSystemExport(t *testing.T) {
 	fetch()
 	require_Equal(t, numResponses(), before)
 }
+
+func TestConfigReloadNoRaceWithServiceImports(t *testing.T) {
+	kp, err := nkeys.CreateUser()
+	require_NoError(t, err)
+	pub, _ := kp.PublicKey()
+
+	storeDir := t.TempDir()
+	mkOpts := func() *Options {
+		return &Options{
+			Host:      "127.0.0.1",
+			Port:      -1,
+			JetStream: true,
+			StoreDir:  storeDir,
+			NoSigs:    true,
+			NoLog:     true,
+			Nkeys:     []*NkeyUser{{Nkey: pub}},
+		}
+	}
+	srv := RunServer(mkOpts())
+	defer srv.Shutdown()
+
+	sign := func(nonce []byte) ([]byte, error) { return kp.Sign(nonce) }
+	nc, js := jsClientConnect(t, srv, nats.Nkey(pub, sign), nats.Timeout(5*time.Second))
+	defer nc.Close()
+
+	_, err = js.AddStream(&nats.StreamConfig{Name: "S", Subjects: []string{"js.>"}})
+	require_NoError(t, err)
+	pull, err := js.PullSubscribe("js.>", "dur")
+	require_NoError(t, err)
+
+	stop := make(chan struct{})
+	var wg sync.WaitGroup
+	for i := 0; i < 4; i++ { // concurrent JetStream publishers ($JS.API service imports)
+		wg.Add(1)
+		go func() {
+			defer wg.Done()
+			for {
+				select {
+				case <-stop:
+					return
+				default:
+				}
+				_, _ = js.Publish("js.x", []byte("x"), nats.AckWait(500*time.Millisecond))
+			}
+		}()
+	}
+	wg.Add(1)
+	go func() { // consumer fetch loop: delivery is the read side
+		defer wg.Done()
+		for {
+			select {
+			case <-stop:
+				return
+			default:
+			}
+			msgs, _ := pull.Fetch(20, nats.MaxWait(200*time.Millisecond))
+			for _, m := range msgs {
+				_ = m.Ack()
+			}
+		}
+	}()
+	wg.Add(1)
+	errCh := make(chan error, 1)
+	go func() { // ReloadOptions loop: the write side
+		defer wg.Done()
+		tk := time.NewTicker(5 * time.Millisecond)
+		defer tk.Stop()
+		for {
+			select {
+			case <-stop:
+				return
+			case <-tk.C:
+				if err := srv.ReloadOptions(mkOpts()); err != nil {
+					errCh <- fmt.Errorf("reload error: %v", err)
+					return
+				}
+			}
+		}
+	}()
+
+	time.Sleep(3 * time.Second)
+	close(stop)
+	wg.Wait()
+	select {
+	case err := <-errCh:
+		t.Fatal(err)
+	default:
+	}
+}
```

**File**: `test/service_latency_test.go` (modified, +103/-0)
```diff
@@ -1921,3 +1921,106 @@ func TestServiceLatencyDoubleResponse(t *testing.T) {
 	rsub.NextMsg(time.Second)
 	time.Sleep(time.Second)
 }
+
+func TestServiceLatencyNoRaceOnUpdateClaims(t *testing.T) {
+	okp, _ := nkeys.FromSeed(oSeed)
+
+	// Create three accounts, system, service and normal account.
+	sysJWT, sysKP, _ := createAccountWithJWT(t)
+	sysPub, _ := sysKP.PublicKey()
+
+	_, svcKP, svcAcc := createAccountWithJWT(t)
+	svcPub, _ := svcKP.PublicKey()
+
+	// Add in the service export with latency tracking here.
+	serviceExport := &jwt.Export{Subject: "req.*", Type: jwt.Service}
+	svcAcc.Exports.Add(serviceExport)
+	svcJWT, err := svcAcc.Encode(okp)
+	if err != nil {
+		t.Fatalf("Error encoding service export: %v", err)
+	}
+
+	_, accKP, accAcc := createAccountWithJWT(t)
+	accPub, _ := accKP.PublicKey()
+
+	// Add in the import.
+	serviceImport := &jwt.Import{Account: svcPub, Subject: "request", To: "req.echo", Type: jwt.Service}
+	accAcc.Imports.Add(serviceImport)
+	accJWT, err := accAcc.Encode(okp)
+	if err != nil {
+		t.Fatalf("Error encoding service import: %v", err)
+	}
+
+	cf := `
+	listen: 127.0.0.1:-1
+	operator = "../test/configs/nkeys/op.jwt"
+	system_account = "%s"
+	resolver = MEMORY
+	resolver_preload = {
+		%s : "%s"
+		%s : "%s"
+		%s : "%s"
+	}
+	`
+	contents := strings.Replace(fmt.Sprintf(cf, sysPub, sysPub, sysJWT, svcPub, svcJWT, accPub, accJWT), "\n\t", "\n", -1)
+	conf := createConfFile(t, []byte(contents))
+
+	s, opts := RunServerWithConfig(conf)
+	defer s.Shutdown()
+
+	// Create service provider.
+	url := fmt.Sprintf("nats://%s:%d", opts.Host, opts.Port)
+	nc, err := nats.Connect(url, createUserCreds(t, s, svcKP), nats.Name("fooService"))
+	if err != nil {
+		t.Fatalf("Error on connect: %v", err)
+	}
+	defer nc.Close()
+
+	// The service listener.
+	nc.Subscribe("req.echo", func(msg *nats.Msg) {
+		time.Sleep(10 * time.Millisecond)
+		msg.Respond(msg.Data)
+	})
+	// Listen for metrics
+	nc.Subscribe("results", func(_ *nats.Msg) {})
+	nc.Flush()
+
+	nc2, err := nats.Connect(url, createUserCreds(t, s, accKP))
+	if err != nil {
+		t.Fatalf("Error on connect: %v", err)
+	}
+	defer nc2.Close()
+
+	updateAccount := func() {
+		t.Helper()
+		svcAccount, err := s.LookupAccount(svcPub)
+		if err != nil {
+			t.Fatalf("Could not lookup service account from server %+v", s)
+		}
+		s.UpdateAccountClaims(svcAccount, svcAcc)
+	}
+
+	wg := sync.WaitGroup{}
+	wg.Add(1)
+	doneCh := make(chan struct{})
+	go func() {
+		defer wg.Done()
+		for {
+			nc2.PublishRequest("request", "some.inbox", []byte("hello"))
+			select {
+			case <-doneCh:
+				return
+			default:
+			}
+		}
+	}()
+
+	for i := 99; i > 0; i-- {
+		serviceExport.Latency = &jwt.ServiceLatency{Sampling: jwt.SamplingRate(i), Results: "results"}
+		updateAccount()
+		time.Sleep(5 * time.Millisecond)
+	}
+
+	close(doneCh)
+	wg.Wait()
+}
```

---

### Incident Patch 6: `b24c552d` (2026-09-29)
**Commit Message**: [FIXED] Per-account routes double count inbound account stats

A message arriving over a route is added to the account's received
totals when it is routed. A per-account route's connection also belongs
to that account, so the read loop added the same messages a second time.
Accounts pinned via cluster.accounts, and the system account, which is
pinned by default, reported twice the received msgs and bytes, while the
route breakdown and server totals counted them once.

Signed-off-by: Byron Ruth <byron@nats.io>

**File**: `server/client.go` (modified, +3/-1)
```diff
@@ -1648,7 +1648,9 @@ func (c *client) readLoop(pre []byte) {
 			atomic.AddInt64(&c.inMsgs, inMsgs)
 			atomic.AddInt64(&c.inBytes, inBytes)
 
-			if acc != nil {
+			// A per-account route has its account set, but routed messages were
+			// already added to the account's stats in processInboundRoutedMsg.
+			if acc != nil && c.kind != ROUTER {
 				acc.stats.Lock()
 				acc.stats.inMsgs += inMsgs
 				acc.stats.inBytes += inBytes
```

**File**: `server/routes_test.go` (modified, +72/-0)
```diff
@@ -2800,6 +2800,78 @@ func TestRoutePerAccountImplicit(t *testing.T) {
 	checkClusterFormed(t, s1, s2, s3)
 }
 
+func TestRoutePerAccountInboundStatsCountedOnce(t *testing.T) {
+	tmpl := `
+		port: -1
+		accounts {
+			A { users: [{user: "a", password: "a"}] }
+			B { users: [{user: "b", password: "b"}] }
+		}
+		cluster {
+			port: -1
+			name: "local"
+			accounts: ["A"]
+			%s
+		}
+	`
+	conf1 := createConfFile(t, []byte(fmt.Sprintf(tmpl, _EMPTY_)))
+	s1, o1 := RunServerWithConfig(conf1)
+	defer s1.Shutdown()
+
+	conf2 := createConfFile(t, []byte(fmt.Sprintf(tmpl,
+		fmt.Sprintf("routes: [\"nats://127.0.0.1:%d\"]", o1.Cluster.Port))))
+	s2, _ := RunServerWithConfig(conf2)
+	defer s2.Shutdown()
+
+	checkClusterFormed(t, s1, s2)
+
+	const n = 10
+	payload := []byte("hello")
+
+	// Account A has a dedicated route, account B uses the pool. Messages that
+	// reach s2 only over a route must count once in the account's received
+	// totals either way, matching the route breakdown and the sender's count.
+	for _, acc := range []string{"A", "B"} {
+		t.Run(acc, func(t *testing.T) {
+			user := strings.ToLower(acc)
+			s2nc := natsConnect(t, s2.ClientURL(), nats.UserInfo(user, user))
+			defer s2nc.Close()
+			sub := natsSubSync(t, s2nc, "foo")
+			natsFlush(t, s2nc)
+
+			s1nc := natsConnect(t, s1.ClientURL(), nats.UserInfo(user, user))
+			defer s1nc.Close()
+			checkSubInterest(t, s1, acc, "foo", time.Second)
+
+			for i := 0; i < n; i++ {
+				natsPub(t, s1nc, "foo", payload)
+			}
+			for i := 0; i < n; i++ {
+				natsNexMsg(t, sub, time.Second)
+			}
+
+			checkFor(t, time.Second, 15*time.Millisecond, func() error {
+				stz, err := s2.AccountStatz(&AccountStatzOptions{Accounts: []string{acc}})
+				if err != nil {
+					return err
+				}
+				if len(stz.Accounts) != 1 {
+					return fmt.Errorf("expected 1 account, got %d", len(stz.Accounts))
+				}
+				recv := stz.Accounts[0].Received
+				if recv.Routes == nil || recv.Routes.Msgs != n {
+					return fmt.Errorf("expected %d route msgs received, got %+v", n, recv.Routes)
+				}
+				if recv.Msgs != n || recv.Bytes != int64(n*len(payload)) {
+					return fmt.Errorf("expected %d msgs and %d bytes received, got %d and %d",
+						n, n*len(payload), recv.Msgs, recv.Bytes)
+				}
+				return nil
+			})
+		})
+	}
+}
+
 func TestRoutePerAccountDefaultForSysAccount(t *testing.T) {
 	tmpl := `
 		port: -1
```

---

### Incident Patch 7: `aabc8b39` (2026-09-28)
**Commit Message**: [FIXED] MQTT: reload stops QoS 1/2 delivery when max_ack_pending is unset (#8671)

Resolves #8661.

A reload that treats the `mqtt` options as changed calls
`mqttUpdateMaxAckPending`, which assigned the configured
`max_ack_pending` to every existing session as is. When the option is
not set that is 0, and `trackPublish` then refuses a packet ID for every
QoS 1/2 message. New sessions were fine because `mqttSessionCreate`
falls back to `mqttDefaultMaxAckPending`; this applies the same fallback
on reload.

The reporter saw it only with `verify_and_map` because a `tls {}` block
makes every reload re-apply the MQTT options. The test covers that no-op
reload and a reload changing `ack_wait` without TLS; both fail without
the fix. `go test ./server -run TestMQTT` passes.

**File**: `server/mqtt.go` (modified, +5/-0)
```diff
@@ -1120,6 +1120,11 @@ func (s *Server) mqttHandleClosedClient(c *client) {
 // Runs from a server configuration reload routine.
 // No lock held on entry.
 func (s *Server) mqttUpdateMaxAckPending(newmaxp uint16) {
+	// Same default as mqttSessionCreate: an unset option must not leave the
+	// sessions with a limit of 0, which would stop all QoS 1 and 2 deliveries.
+	if newmaxp == 0 {
+		newmaxp = mqttDefaultMaxAckPending
+	}
 	msm := &s.mqtt.sessmgr
 	s.accounts.Range(func(k, _ any) bool {
 		accName := k.(string)
```

**File**: `server/mqtt_test.go` (modified, +76/-0)
```diff
@@ -6882,6 +6882,82 @@ func TestMQTTConfigReload(t *testing.T) {
 	testMQTTCheckPubMsg(t, c, r, "bar", mqttPubQos1, []byte("msg4"))
 }
 
+func TestMQTTConfigReloadKeepsQoS1DeliveryWithDefaultMaxAckPending(t *testing.T) {
+	tlsMap := `tls {
+		cert_file: "../test/configs/certs/tlsauth/server.pem"
+		key_file: "../test/configs/certs/tlsauth/server-key.pem"
+		ca_file: "../test/configs/certs/tlsauth/ca.pem"
+		verify_and_map: true
+		timeout: 2
+	}`
+	for _, test := range []struct {
+		name   string
+		before string
+		after  string
+		users  string
+		cert   bool
+	}{
+		// With a tls block the TLS config is rebuilt on every reload, so even a
+		// reload that changes nothing applies the MQTT options again (#8661).
+		{"no-op reload with certificate mapped user", tlsMap, tlsMap, `users = [ { user: "CN=example.com,OU=NATS.io" } ]`, true},
+		{"reload changing ack_wait", `ack_wait: "30s"`, `ack_wait: "45s"`, `users = [ { user: "u", password: "p" } ]`, false},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			tmpl := `
+				listen: 127.0.0.1:-1
+				server_name: mqtt
+				jetstream { store_dir: %q }
+				mqtt {
+					listen: 127.0.0.1:-1
+					%s
+				}
+				authorization { %s }
+			`
+			dir := t.TempDir()
+			conf := createConfFile(t, []byte(fmt.Sprintf(tmpl, dir, test.before, test.users)))
+			s, o := RunServerWithConfig(conf)
+			defer testMQTTShutdownServer(s)
+
+			connect := func(id string) (net.Conn, *mqttReader) {
+				ci := &mqttConnInfo{clientID: id, cleanSess: true}
+				if test.cert {
+					tlsc, err := GenTLSConfig(&TLSConfigOpts{
+						CertFile: "../test/configs/certs/tlsauth/client.pem",
+						KeyFile:  "../test/configs/certs/tlsauth/client-key.pem",
+					})
+					require_NoError(t, err)
+					tlsc.InsecureSkipVerify = true
+					tlsc.MinVersion = tls.VersionTLS13
+					ci.tls, ci.tlsc = true, tlsc
+				} else {
+					ci.user, ci.pass = "u", "p"
+				}
+				c, r := testMQTTConnect(t, ci, o.MQTT.Host, o.MQTT.Port)
+				testMQTTCheckConnAck(t, r, mqttConnAckRCConnectionAccepted, false)
+				return c, r
+			}
+			sub, rs := connect("sub")
+			defer sub.Close()
+			testMQTTSub(t, 1, sub, rs, []*mqttFilter{{filter: "foo", qos: 1}}, []byte{1})
+			testMQTTFlush(t, sub, nil, rs)
+			pub, rp := connect("pub")
+			defer pub.Close()
+
+			testMQTTPublish(t, pub, rp, 1, false, false, "foo", 1, []byte("msg1"))
+			pi := testMQTTCheckPubMsg(t, sub, rs, "foo", mqttPubQos1, []byte("msg1"))
+			testMQTTSendPIPacket(mqttPacketPubAck, t, sub, pi)
+
+			changeCurrentConfigContentWithNewContent(t, conf, []byte(fmt.Sprintf(tmpl, dir, test.after, test.users)))
+			require_NoError(t, s.Reload())
+
+			// max_ack_pending is not set, so the session must keep the default
+			// limit instead of 0, which would stop every QoS 1 delivery.
+			testMQTTPublish(t, pub, rp, 1, false, false, "foo", 2, []byte("msg2"))
+			testMQTTCheckPubMsg(t, sub, rs, "foo", mqttPubQos1, []byte("msg2"))
+		})
+	}
+}
+
 func TestMQTTStreamInfoReturnsNonEmptySubject(t *testing.T) {
 	o := testMQTTDefaultOptions()
 	s := testMQTTRunServer(t, o)
```

---

### Incident Patch 8: `c7e80801` (2026-09-28)
**Commit Message**: [FIXED] MQTT: reload stops QoS 1/2 delivery when max_ack_pending is unset

mqttUpdateMaxAckPending applied the raw option value to existing sessions,
so an unset max_ack_pending set their limit to 0 and no QoS 1 or 2 message
could be delivered any more. Use the same default as mqttSessionCreate.

With a tls block in the mqtt config the MQTT options are re-applied on every
reload, since the TLS config is rebuilt, so even a no-op reload hit this.

Resolves #8661

Signed-off-by: Andrey Karazhev <karazhev@gmail.com>

**File**: `server/mqtt.go` (modified, +5/-0)
```diff
@@ -1120,6 +1120,11 @@ func (s *Server) mqttHandleClosedClient(c *client) {
 // Runs from a server configuration reload routine.
 // No lock held on entry.
 func (s *Server) mqttUpdateMaxAckPending(newmaxp uint16) {
+	// Same default as mqttSessionCreate: an unset option must not leave the
+	// sessions with a limit of 0, which would stop all QoS 1 and 2 deliveries.
+	if newmaxp == 0 {
+		newmaxp = mqttDefaultMaxAckPending
+	}
 	msm := &s.mqtt.sessmgr
 	s.accounts.Range(func(k, _ any) bool {
 		accName := k.(string)
```

**File**: `server/mqtt_test.go` (modified, +76/-0)
```diff
@@ -6882,6 +6882,82 @@ func TestMQTTConfigReload(t *testing.T) {
 	testMQTTCheckPubMsg(t, c, r, "bar", mqttPubQos1, []byte("msg4"))
 }
 
+func TestMQTTConfigReloadKeepsQoS1DeliveryWithDefaultMaxAckPending(t *testing.T) {
+	tlsMap := `tls {
+		cert_file: "../test/configs/certs/tlsauth/server.pem"
+		key_file: "../test/configs/certs/tlsauth/server-key.pem"
+		ca_file: "../test/configs/certs/tlsauth/ca.pem"
+		verify_and_map: true
+		timeout: 2
+	}`
+	for _, test := range []struct {
+		name   string
+		before string
+		after  string
+		users  string
+		cert   bool
+	}{
+		// With a tls block the TLS config is rebuilt on every reload, so even a
+		// reload that changes nothing applies the MQTT options again (#8661).
+		{"no-op reload with certificate mapped user", tlsMap, tlsMap, `users = [ { user: "CN=example.com,OU=NATS.io" } ]`, true},
+		{"reload changing ack_wait", `ack_wait: "30s"`, `ack_wait: "45s"`, `users = [ { user: "u", password: "p" } ]`, false},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			tmpl := `
+				listen: 127.0.0.1:-1
+				server_name: mqtt
+				jetstream { store_dir: %q }
+				mqtt {
+					listen: 127.0.0.1:-1
+					%s
+				}
+				authorization { %s }
+			`
+			dir := t.TempDir()
+			conf := createConfFile(t, []byte(fmt.Sprintf(tmpl, dir, test.before, test.users)))
+			s, o := RunServerWithConfig(conf)
+			defer testMQTTShutdownServer(s)
+
+			connect := func(id string) (net.Conn, *mqttReader) {
+				ci := &mqttConnInfo{clientID: id, cleanSess: true}
+				if test.cert {
+					tlsc, err := GenTLSConfig(&TLSConfigOpts{
+						CertFile: "../test/configs/certs/tlsauth/client.pem",
+						KeyFile:  "../test/configs/certs/tlsauth/client-key.pem",
+					})
+					require_NoError(t, err)
+					tlsc.InsecureSkipVerify = true
+					tlsc.MinVersion = tls.VersionTLS13
+					ci.tls, ci.tlsc = true, tlsc
+				} else {
+					ci.user, ci.pass = "u", "p"
+				}
+				c, r := testMQTTConnect(t, ci, o.MQTT.Host, o.MQTT.Port)
+				testMQTTCheckConnAck(t, r, mqttConnAckRCConnectionAccepted, false)
+				return c, r
+			}
+			sub, rs := connect("sub")
+			defer sub.Close()
+			testMQTTSub(t, 1, sub, rs, []*mqttFilter{{filter: "foo", qos: 1}}, []byte{1})
+			testMQTTFlush(t, sub, nil, rs)
+			pub, rp := connect("pub")
+			defer pub.Close()
+
+			testMQTTPublish(t, pub, rp, 1, false, false, "foo", 1, []byte("msg1"))
+			pi := testMQTTCheckPubMsg(t, sub, rs, "foo", mqttPubQos1, []byte("msg1"))
+			testMQTTSendPIPacket(mqttPacketPubAck, t, sub, pi)
+
+			changeCurrentConfigContentWithNewContent(t, conf, []byte(fmt.Sprintf(tmpl, dir, test.after, test.users)))
+			require_NoError(t, s.Reload())
+
+			// max_ack_pending is not set, so the session must keep the default
+			// limit instead of 0, which would stop every QoS 1 delivery.
+			testMQTTPublish(t, pub, rp, 1, false, false, "foo", 2, []byte("msg2"))
+			testMQTTCheckPubMsg(t, sub, rs, "foo", mqttPubQos1, []byte("msg2"))
+		})
+	}
+}
+
 func TestMQTTStreamInfoReturnsNonEmptySubject(t *testing.T) {
 	o := testMQTTDefaultOptions()
 	s := testMQTTRunServer(t, o)
```

---

### Incident Patch 9: `60b9679c` (2026-09-28)
**Commit Message**: [FIXED] Pull requests leak response service imports after a config reload (#8650)

After a config reload, every JetStream pull request
(`CONSUMER.MSG.NEXT`) and direct get (`DIRECT.GET`) leaves behind a
response service import that never expires. Server memory then grows
with the request rate until the server is restarted.

### Cause

When the system account is declared in the `accounts` block,
`configureAccounts(reloading=true)` resets its exports and rebuilds them
from the options. The internally added `$JS.API.>` export is not in the
options, so it is missing until `addSystemAccountExports` adds it back
at the end of the function. The import swap loop runs in between and
re-resolves the `$JS.API.>` service import of every JetStream-enabled
account against the system account, so `si.se` ends up `nil`, and
nothing re-resolves it afterwards.

Two places depend on `si.se`:

- `processServiceImport` short-circuits `MSG.NEXT` and `DIRECT.GET` only
when `si.se.acc` is the system account (the "no-op and causes buildups"
comment). With `si.se == nil` these requests go through the service
import, and each one creates a response service import plus a reverse
response map entry.
- `addRespS

**File**: `server/reload_test.go` (modified, +71/-0)
```diff
@@ -7746,3 +7746,74 @@ func TestConfigReloadDoesNotDisconnectJWTClientSendingNkey(t *testing.T) {
 	require_NoError(t, err)
 	require_True(t, strings.HasPrefix(l, "PONG"))
 }
+
+func TestConfigReloadKeepsJetStreamAPIImportLinkedToSystemExport(t *testing.T) {
+	tmpl := jsClusterTempl + `
+		authorization {
+			users = [
+				{user: app, password: pwd}
+			]
+		}
+	`
+	c := createJetStreamClusterWithTemplate(t, tmpl, "R3S", 3)
+	defer c.shutdown()
+
+	s := c.randomServer()
+	nc, js := jsClientConnect(t, s, nats.UserInfo("app", "pwd"))
+	defer nc.Close()
+
+	_, err := js.AddStream(&nats.StreamConfig{Name: "TEST", Subjects: []string{"foo"}, Replicas: 3})
+	require_NoError(t, err)
+	sub, err := js.PullSubscribe("foo", "dur")
+	require_NoError(t, err)
+
+	fetch := func() {
+		t.Helper()
+		for i := 0; i < 50; i++ {
+			_, err := js.Publish("foo", []byte("msg"))
+			require_NoError(t, err)
+			msgs, err := sub.Fetch(1, nats.MaxWait(time.Second))
+			require_NoError(t, err)
+			for _, m := range msgs {
+				require_NoError(t, m.AckSync())
+			}
+		}
+	}
+	numResponses := func() int {
+		sacc := s.SystemAccount()
+		sacc.mu.RLock()
+		defer sacc.mu.RUnlock()
+		return len(sacc.exports.responses)
+	}
+	checkImportLinked := func() {
+		t.Helper()
+		gacc := s.GlobalAccount()
+		gacc.mu.RLock()
+		defer gacc.mu.RUnlock()
+		sis := gacc.imports.services[jsAllAPI]
+		require_Len(t, len(sis), 1)
+		if se := sis[0].se; se == nil || se.acc != s.SystemAccount() {
+			t.Fatalf("Expected %q import to be linked to the system account export, got %+v", jsAllAPI, se)
+		}
+	}
+
+	fetch()
+	checkImportLinked()
+	before := numResponses()
+
+	// Any authorization change reconfigures the accounts on reload.
+	for _, srv := range c.servers {
+		cf := srv.getOpts().ConfigFile
+		buf, err := os.ReadFile(cf)
+		require_NoError(t, err)
+		nbuf := bytes.Replace(buf, []byte("{user: app, password: pwd}"), []byte("{user: app, password: pwd}\n\t\t\t\t{user: other, password: pwd}"), 1)
+		require_NoError(t, os.WriteFile(cf, nbuf, defaultFilePerms))
+		require_NoError(t, srv.Reload())
+	}
+
+	checkImportLinked()
+	// Pull requests must still bypass the service import, otherwise each one
+	// leaves behind a response service import that never expires.
+	fetch()
+	require_Equal(t, numResponses(), before)
+}
```

**File**: `server/server.go` (modified, +27/-0)
```diff
@@ -1484,6 +1484,33 @@ func (s *Server) configureAccounts(reloading bool) (map[string]struct{}, error)
 		s.mu.Unlock()
 		s.addSystemAccountExports(sysAcc)
 		s.mu.Lock()
+		// On reload the system account's exports were rebuilt from the
+		// options above, which dropped the internally added ones (such as
+		// the JetStream API export) until addSystemAccountExports put them
+		// back. Imports resolved in between were left with a nil export,
+		// so re-resolve them now that every export exists again.
+		if reloading {
+			s.accounts.Range(func(_, v any) bool {
+				acc := v.(*Account)
+				acc.mu.Lock()
+				for _, sis := range acc.imports.services {
+					for _, si := range sis {
+						if si.se != nil || si.acc == nil {
+							continue
+						}
+						if si.acc == acc {
+							si.se = acc.getServiceExport(si.to)
+							continue
+						}
+						si.acc.mu.RLock()
+						si.se = si.acc.getServiceExport(si.to)
+						si.acc.mu.RUnlock()
+					}
+				}
+				acc.mu.Unlock()
+				return true
+			})
+		}
 	}
 
 	return awcsti, nil
```

---

### Incident Patch 10: `f7394a15` (2026-09-28)
**Commit Message**: Fix clustered ephemeral consumer snapshots (#8651)

## Summary
Fixes clustered JetStream snapshots for ephemeral consumers whose
generated name is stored on the consumer assignment rather than the
original config.
Snapshots now use the assignment’s canonical consumer name, preventing
invalid `consumers` archive entries and allowing backup validation and
restore to succeed.

## Testing

- Added clustered ephemeral consumer snapshot/restore coverage
- `go test ./server -run
'^(TestJetStreamClusterUserSnapshotAndRestore|TestJetStreamSnapshotV2.*|TestJetStreamRestoreV2.*)$'`
- `go vet ./server`

**File**: `server/jetstream_cluster_1_test.go` (modified, +30/-0)
```diff
@@ -2687,6 +2687,27 @@ func TestJetStreamClusterUserSnapshotAndRestore(t *testing.T) {
 	if err != nil {
 		t.Fatalf("Unexpected error: %v", err)
 	}
+	// Clustered ephemeral consumers use the assignment name as their identity,
+	// while the original consumer config can have an empty Name. Make sure a
+	// snapshot remains restorable in that case.
+	ephSubj := nats.NewInbox()
+	ephSub, err := nc.Subscribe(ephSubj, func(*nats.Msg) {})
+	if err != nil {
+		t.Fatalf("Unexpected error subscribing for ephemeral consumer: %v", err)
+	}
+	defer ephSub.Unsubscribe()
+	if err := nc.Flush(); err != nil {
+		t.Fatalf("Unexpected error flushing ephemeral consumer subscription: %v", err)
+	}
+	eph, err := js.AddConsumer("TEST", &nats.ConsumerConfig{
+		DeliverSubject:    ephSubj,
+		DeliverPolicy:     nats.DeliverNewPolicy,
+		AckPolicy:         nats.AckNonePolicy,
+		InactiveThreshold: time.Minute,
+	})
+	if err != nil {
+		t.Fatalf("Unexpected error creating ephemeral consumer: %v", err)
+	}
 
 	jsub, err := js.PullSubscribe("foo", "dlc")
 	if err != nil {
@@ -2840,6 +2861,7 @@ func TestJetStreamClusterUserSnapshotAndRestore(t *testing.T) {
 
 	// Wait on the system to elect a leader for the restored consumer.
 	c.waitOnConsumerLeader("$G", "TEST", "dlc")
+	c.waitOnConsumerLeader("$G", "TEST", eph.Name)
 
 	// Now check for the consumer being recreated.
 	nci, err := js.ConsumerInfo("TEST", "dlc")
@@ -2859,6 +2881,14 @@ func TestJetStreamClusterUserSnapshotAndRestore(t *testing.T) {
 		t.Fatalf("Ack floors did not match %+v vs %+v", nci.AckFloor, ci.AckFloor)
 	}
 
+	ephInfo, err := js.ConsumerInfo("TEST", eph.Name)
+	if err != nil {
+		t.Fatalf("Unexpected error getting restored ephemeral consumer info: %v", err)
+	}
+	if ephInfo.Config.Durable != _EMPTY_ {
+		t.Fatalf("Expected restored consumer to remain ephemeral, got durable %q", ephInfo.Config.Durable)
+	}
+
 	// Make sure consumer works.
 	// It should pick up immediately after the ack floor and deliver everything
 	// through the current stream tail.
```

**File**: `server/stream_backup.go` (modified, +6/-1)
```diff
@@ -189,8 +189,13 @@ func (js *jetStream) streamSnapshotV2(store StreamStore, state *StreamState, w i
 					errCh <- fmt.Errorf("failed to get consumer state for '%s > %s'", sa.Config.Name, ca.Name)
 					return
 				}
+				// Ephemeral clustered consumers are named by their assignment. Their
+				// original config may not carry that generated name, but snapshots
+				// need it both for the archive entry and for restoration.
+				config := *ca.Config
+				config.Name = ca.Name
 				if err := writeConsumerMsg(SnapshotConsumerState{
-					ConsumerConfig: ca.Config,
+					ConsumerConfig: &config,
 					ConsumerState:  consumerStateFromInfo(ci),
 				}); err != nil {
 					errCh <- err
```

#### Recent Merged Pull Requests:
- **PR #8681** (2026-09-30): Improve num pending last block correction (@neilalexander)
- **PR #8680** (2026-09-30): Num pending improvements (@neilalexander)
- **PR #8679** (2026-09-30): Fix TLS pin matching on config reload (@neilalexander)
- **PR #8677** (2026-09-30): [FIXED] Per-account routes double count inbound account stats (@bruth)
- **PR #8675** (2026-09-30): [FIXED] Services Import/Export: several data races during reload (@kozlovic)
- **PR #8671** (2026-09-28): [FIXED] MQTT: reload stops QoS 1/2 delivery when max_ack_pending is unset (@akarazhev)
- **PR #8669** (closed): Combine else/if into else if (@randomizedcoder)
- **PR #8668** (closed): Use canonical Deprecated: comment marker (@randomizedcoder)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
