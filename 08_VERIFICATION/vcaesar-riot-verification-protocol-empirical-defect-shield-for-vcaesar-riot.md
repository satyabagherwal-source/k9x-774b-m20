# Verification Protocol: Verification Protocol: Empirical Defect Shield for vcaesar/riot

<!-- PROVENANCE_START
{
  "source_repository": "vcaesar/riot",
  "source_url": "https://github.com/vcaesar/riot",
  "source_version": "de6bec55",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T09:43:41.803Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-vcaesar-riot",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vcaesar/riot](https://github.com/vcaesar/riot) (Revision: `de6bec55`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T09:43:41.803Z`  
> **Learning ID**: `learn-github-vcaesar-riot`


## 1. Scope & Verification Target
- **Target Repository**: `vcaesar/riot` (Commit: `de6bec55`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): vcaesar/riot

> **Canonical Artifact**: `07_PROJECT_LEARNING/vcaesar-riot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vcaesar/riot](https://github.com/vcaesar/riot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T09:43:40.659Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vcaesar/riot`
- **Description**: Go Open Source, Distributed, Simple and fastest efficient text/vector Search Engine
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 6066 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `analysis/token/camelcase_states.go`
```
//  Copyright (c) 2020 Couchbase, Inc.
//  Copyright (c) 2026 The AtomAI.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package token

import (
	"unicode"
)

// States codify the classes that the parser recognizes.
type State interface {
	// is _sym_ the start character
	StartSym(sym rune) bool

	// is _sym_ a member of a class.
	// peek, the next sym on the tape, can also be used to determine a class.
	Member(sym rune, peek *rune) bool
}

type LowerCaseState struct{}

func (s *LowerCaseState) Member(sym rune, _ *rune) bool {
	return unicode.IsLower(sym)
}

func (s *LowerCaseState) StartSym(sym rune) bool {
	return s.Member(sym, nil)
}

type UpperCaseState struct {
	startedCollecting bool // denotes that the start character has been read
	collectingUpper   bool // denotes if this is a class of all upper case letters
}

func (s *UpperCaseState) Member(sym rune, peek *rune) bool {
	if !unicode.IsLower(sym) && !unicode.IsUpper(sym) {
		return false
	}

	if peek != nil && unicode.IsUpper(sym) && unicode.IsLower(*peek) {
		return false
	}

	if !s.startedCollecting {
		// now we have to determine if upper-case letters are collected.
		s.startedCollecting = true
		s.collectingUpper = unicode.IsUpper(sym)
		return true
	}

	return s.collectingUpper == unicode.IsUpper(sym)
}

func (s *UpperCaseState) StartSym(sym rune) bool {
	return unicode.IsUpper(sym)
}

type NumberCaseState struct{}

func (s *NumberCaseState) Member(sym rune, _ *rune) bool {
	return unicode.IsNumber(sym)
}

func (s *NumberCaseState) StartSym(sym rune) bool {
	return s.Member(sym, nil)
}

type NonAlphaNumericCaseState struct{}

func (s *NonAlphaNumericCaseState) Member(sym rune, _ *rune) bool {
	return !unicode.IsLower(sym) && !unicode.IsUpper(sym) && !unicode.IsNumber(sym)
}

func (s *NonAlphaNumericCaseState) StartSym(sym rune) bool {
	return s.Member(sym, nil)
}

```

### Core Architecture Module: `analysis/util.go`
```
//  Copyright (c) 2014 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package analysis

import (
	"bytes"
	"unicode/utf8"
)

func DeleteRune(in []rune, pos int) []rune {
	if pos >= len(in) {
		return in
	}
	copy(in[pos:], in[pos+1:])
	return in[:len(in)-1]
}

func InsertRune(in []rune, pos int, r rune) []rune {
	// create a new slice 1 rune larger
	rv := make([]rune, len(in)+1)
	// copy the characters before the insert pos
	copy(rv[0:pos], in[0:pos])
	// set the inserted rune
	rv[pos] = r
	// copy the characters after the insert pos
	copy(rv[pos+1:], in[pos:])
	return rv
}

// BuildTermFromRunesOptimistic will build a term from the provided runes
// AND optimistically attempt to encode into the provided buffer
// if at any point it appears the buffer is too small, a new buffer is
// allocated and that is used instead
// this should be used in cases where frequently the new term is the same
// length or shorter than the original term (in number of bytes)
func BuildTermFromRunesOptimistic(buf []byte, runes []rune) []byte {
	rv := buf
	used := 0
	for _, r := range runes {
		nextLen := utf8.RuneLen(r)
		if used+nextLen > len(rv) {
			// alloc new buf
			buf = make([]byte, len(runes)*utf8.UTFMax)
			// copy work we've already done
			copy(buf, rv[:used])
			rv = buf
		}
		written := utf8.EncodeRune(rv[used:], r)
		used += written
	}
	return rv[:used]
}

func BuildTermFromRunes(runes []rune) []byte {
	return BuildTermFromRunesOptimistic(make([]byte, len(runes)*utf8.UTFMax), runes)
}

func TruncateRunes(input []byte, num int) []byte {
	runes := bytes.Runes(input)
	runes = runes[:len(runes)-num]
	out := BuildTermFromRunes(runes)
	return out
}

func RunesEndsWith(input []rune, suffix string) bool {
	inputLen := len(input)
	suffixRunes := []rune(suffix)
	suffixLen := len(suffixRunes)
	if suffixLen > inputLen {
		return false
	}

	for i := suffixLen - 1; i >= 0; i-- {
		if input[inputLen-(suffixLen-i)] != suffixRunes[i] {
			return false
		}
	}

	return true
}

```

### Core Architecture Module: `search/highlight/fragment_scorer_simple.go`
```
//  Copyright (c) 2020 Couchbase, Inc.
//  Copyright (c) 2026 The AtomAI.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package highlight

import (
	"github.com/vcaesar/riot/search"
)

// FragmentScorer will score fragments by how many
// unique terms occur in the fragment with no regard for
// any boost values used in the original query
type SimpleFragmentScorer struct {
	tlm search.TermLocationMap
}

func NewFragmentScorer(tlm search.TermLocationMap) *SimpleFragmentScorer {
	return &SimpleFragmentScorer{
		tlm: tlm,
	}
}

func (s *SimpleFragmentScorer) Score(f *Fragment) {
	score := 0.0
	for _, locations := range s.tlm {
		for _, location := range locations {
			if location.Start >= f.Start && location.End <= f.End {
				score += 1.0
				// once we find a term in the fragment
				// don't care about additional matches
				break
			}
		}
	}
	f.Score = score
}

```

### Core Architecture Module: `search/util.go`
```
//  Copyright (c) 2020 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package search

func MergeLocations(locations []FieldTermLocationMap) FieldTermLocationMap {
	rv := locations[0]

	for i := 1; i < len(locations); i++ {
		nextLocations := locations[i]
		for field, termLocationMap := range nextLocations {
			rvTermLocationMap, rvHasField := rv[field]
			if rvHasField {
				rv[field] = MergeTermLocationMaps(rvTermLocationMap, termLocationMap)
			} else {
				rv[field] = termLocationMap
			}
		}
	}

	return rv
}

func MergeTermLocationMaps(rv, other TermLocationMap) TermLocationMap {
	for term, locationMap := range other {
		// for a given term/document there cannot be different locations
		// if they came back from different clauses, overwrite is ok
		rv[term] = locationMap
	}
	return rv
}

func MergeFieldTermLocations(dest []FieldTermLocation, matches []*DocumentMatch) []FieldTermLocation {
	n := len(dest)
	for _, dm := range matches {
		n += len(dm.FieldTermLocations)
	}
	if cap(dest) < n {
		dest = append(make([]FieldTermLocation, 0, n), dest...)
	}

	for _, dm := range matches {
		for _, ftl := range dm.FieldTermLocations {
			dest = append(dest, FieldTermLocation{
				Field: ftl.Field,
				Term:  ftl.Term,
				Location: Location{
					Pos:   ftl.Location.Pos,
					Start: ftl.Location.Start,
					End:   ftl.Location.End,
				},
			})
		}
	}

	return dest
}

```

### Core Architecture Module: `analysis/analyzer/keyword.go`
```
//  Copyright (c) 2020 Couchbase, Inc.
//  Copyright (c) 2026 The AtomAI.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package analyzer

import (
	"github.com/vcaesar/riot/analysis"
	"github.com/vcaesar/riot/analysis/tokenizer"
)

func NewKeywordAnalyzer() *analysis.Analyzer {
	return &analysis.Analyzer{
		Tokenizer: tokenizer.NewSingleTokenTokenizer(),
	}
}

```

### Core Architecture Module: `analysis/analyzer/simple.go`
```
//  Copyright (c) 2020 Couchbase, Inc.
//  Copyright (c) 2026 The AtomAI.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package analyzer

import (
	"github.com/vcaesar/riot/analysis"
	"github.com/vcaesar/riot/analysis/token"
	"github.com/vcaesar/riot/analysis/tokenizer"
)

func NewSimpleAnalyzer() *analysis.Analyzer {
	return &analysis.Analyzer{
		Tokenizer: tokenizer.NewLetterTokenizer(),
		TokenFilters: []analysis.TokenFilter{
			token.NewLowerCaseFilter(),
		},
	}
}

```

### Core Architecture Module: `analysis/analyzer/standard.go`
```
//  Copyright (c) 2020 Couchbase, Inc.
//  Copyright (c) 2026 The AtomAI.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package analyzer

import (
	"github.com/vcaesar/riot/analysis"
	"github.com/vcaesar/riot/analysis/token"
	"github.com/vcaesar/riot/analysis/tokenizer"
)

func NewStandardAnalyzer() *analysis.Analyzer {
	return &analysis.Analyzer{
		Tokenizer: tokenizer.NewUnicodeTokenizer(),
		TokenFilters: []analysis.TokenFilter{
			token.NewLowerCaseFilter(),
		},
	}
}

```

### Core Architecture Module: `analysis/analyzer/web.go`
```
//  Copyright (c) 2020 Couchbase, Inc.
//  Copyright (c) 2026 The AtomAI.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package analyzer

import (
	"github.com/vcaesar/riot/analysis"
	"github.com/vcaesar/riot/analysis/lang/en"
	"github.com/vcaesar/riot/analysis/token"
	"github.com/vcaesar/riot/analysis/tokenizer"
)

func NewWebAnalyzer() *analysis.Analyzer {
	return &analysis.Analyzer{
		Tokenizer: tokenizer.NewWebTokenizer(),
		TokenFilters: []analysis.TokenFilter{
			token.NewLowerCaseFilter(),
			en.StopWordsFilter(),
		},
	}
}

```

### Core Architecture Module: `analysis/char/asciifolding.go`
```
//  Copyright (c) 2020 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// converted to Go from Lucene's AsciiFoldingFilter
// https://lucene.apache.org/core/4_0_0/analyzers-common/org/apache/lucene/analysis/miscellaneous/ASCIIFoldingFilter.html

package char

// Worst-case length required if all runes fold to 4 runes
const maxRuneExpansion = 4

type ASCIIFoldingFilter struct{}

func NewASCIIFoldingFilter() *ASCIIFoldingFilter {
	return &ASCIIFoldingFilter{}
}

func (s *ASCIIFoldingFilter) Filter(input []byte) []byte {
	if len(input) == 0 {
		return input
	}

	in := []rune(string(input))
	length := len(in)

	out := make([]rune, length, length*maxRuneExpansion)

	out = foldToASCII(in, 0, out, 0, length)
	return []byte(string(out))
}

// Converts characters above ASCII to their ASCII equivalents.
// For example, accents are removed from accented characters.
func foldToASCII(input []rune, inputPos int, output []rune, outputPos int, length int) []rune {
	end := inputPos + length
	for pos := inputPos; pos < end; pos++ {
		c := input[pos]

		// Quick test: if it's not in range then just keep current character
		if c < '\u0080' {
			output[outputPos] = c
			outputPos++
		} else {
			switch c {
			case '\u00C0': // À [LATIN CAPITAL LETTER A WITH GRAVE]
				fallthrough
			case '\u00C1': // Á [LATIN CAPITAL LETTER A WITH ACUTE]
				fallthrough
			case '\u00C2': // Â [LATIN CAPITAL LETTER A WITH CIRCUMFLEX]
				fallthrough
			case '\u00C3': // Ã [LATIN CAPITAL LETTER A WITH TILDE]
				fallthrough
			case '\u00C4': // Ä [LATIN CAPITAL LETTER A WITH DIAERESIS]
				fallthrough
			case '\u00C5': // Å [LATIN CAPITAL LETTER A WITH RING ABOVE]
				fallthrough
			case '\u0100': // Ā [LATIN CAPITAL LETTER A WITH MACRON]
				fallthrough
			case '\u0102': // Ă [LATIN CAPITAL LETTER A WITH BREVE]
				fallthrough
			case '\u0104': // Ą [LATIN CAPITAL LETTER A WITH OGONEK]
				fallthrough
			case '\u018F': // Ə http://en.wikipedia.org/wiki/Schwa [LATIN CAPITAL LETTER SCHWA]
				fallthrough
			case '\u01CD': // Ǎ [LATIN CAPITAL LETTER A WITH CARON]
				fallthrough
			case '\u01DE': // Ǟ [LATIN CAPITAL LETTER A WITH DIAERESIS AND MACRON]
				fallthrough
			case '\u01E0': // Ǡ [LATIN CAPITAL LETTER A WITH DOT ABOVE AND MACRON]
				fallthrough
			case '\u01FA': // Ǻ [LATIN CAPITAL LETTER A WITH RING ABOVE AND ACUTE]
				fallthrough
			case '\u0200': // Ȁ [LATIN CAPITAL LETTER A WITH DOUBLE GRAVE]
				fallthrough
			case '\u0202': // Ȃ [LATIN CAPITAL LETTER A WITH INVERTED BREVE]
				fallthrough
			case '\u0226': // Ȧ [LATIN CAPITAL LETTER A WITH DOT ABOVE]
				fallthrough
			case '\u023A': // Ⱥ [LATIN CAPITAL LETTER A WITH STROKE]
				fallthrough
			case '\u1D00': // ᴀ [LATIN LETTER SMALL CAPITAL A]
				fallthrough
			case '\u1E00': // Ḁ [LATIN CAPITAL LETTER A WITH RING BELOW]
				fallthrough
			case '\u1EA0': // Ạ [LATIN CAPITAL LETTER A WITH DOT BELOW]
				fallthrough
			case '\u1EA2': // Ả [LATIN CAPITAL LETTER A WITH HOOK ABOVE]
				fallthrough
			case '\u1EA4': // Ấ [LATIN CAPITAL LETTER A WITH CIRCUMFLEX AND ACUTE]
				fallthrough
			case '\u1EA6': // Ầ [LATIN CAPITAL LETTER A WITH CIRCUMFLEX AND GRAVE]
				fallthrough
			case '\u1EA8': // Ẩ [LATIN CAPITAL LETTER A WITH CIRCUMFLEX AND HOOK ABOVE]
				fallthrough
			case '\u1EAA': // Ẫ [LATIN CAPITAL LETTER A WITH CIRCUMFLEX AND TILDE]
				fallthrough
			case '\u1EAC': // Ậ [LATIN CAPITAL LETTER A WITH CIRCUMFLEX AND DOT BELOW]
				fallthrough
			case '\u1EAE': // Ắ [LATIN CAPITAL LETTER A WITH BREVE AND ACUTE]
				fallthrough
			case '\u1EB0': // Ằ [LATIN CAPITAL LETTER A WITH BREVE AND GRAVE]
				fallthrough
			case '\u1EB2': // Ẳ [LATIN CAPITAL LETTER A WITH BREVE AND HOOK ABOVE]
				fallthrough
			case '\u1EB4': // Ẵ [LATIN CAPITAL LETTER A WITH BREVE AND TILDE]
				fallthrough
			case '\u24B6': // Ⓐ [CIRCLED LATIN CAPITAL LETTER A]
				fallthrough
			case '\uFF21': // Ａ [FULLWIDTH LATIN CAPITAL LETTER A]
				fallthrough
			case '\u1EB6': // Ặ [LATIN CAPITAL LETTER A WITH BREVE AND DOT BELOW]
				output[outputPos] = 'A'
				outputPos++

			case '\u00E0': // à [LATIN SMALL LETTER A WITH GRAVE]
				fallthrough
			case '\u00E1': // á [LATIN SMALL LETTER A WITH ACUTE]
				fallthrough
			case '\u00E2': // â [LATIN SMALL LETTER A WITH CIRCUMFLEX]
				fallthrough
			case '\u00E3': // ã [LATIN SMALL LETTER A WITH TILDE]
				fallthrough
			case '\u00E4': // ä [LATIN SMALL LETTER A WITH DIAERESIS]
				fallthrough
			case '\u00E5': // å [LATIN SMALL LETTER A WITH RING ABOVE]
				fallthrough
			case '\u0101': // ā [LATIN SMALL LETTER A WITH MACRON]
				fallthrough
			case '\u0103': // ă [LATIN SMALL LETTER A WITH BREVE]
				fallthrough
			case '\u0105': // ą [LATIN SMALL LETTER A WITH OGONEK]
				fallthrough
			case '\u01CE': // ǎ [LATIN SMALL LETTER A WITH CARON]
				fallthrough
			case '\u01DF': // ǟ [LATIN SMALL LETTER A WITH DIAERESIS AND MACRON]
				fallthrough
			case '\u01E1': // ǡ [LATIN SMALL LETTER A WITH DOT ABOVE AND MACRON]
				fallthrough
			case '\u01FB': // ǻ [LATIN SMALL LETTER A WITH RING ABOVE AND ACUTE]
				fallthrough
			case '\u0201': // ȁ [LATIN SMALL LETTER A WITH DOUBLE GRAVE]
				fallthrough
			case '\u0203': // ȃ [LATIN SMALL LETTER A WITH INVERTED BREVE]
				fallthrough
			case '\u0227': // ȧ [LATIN SMALL LETTER A WITH DOT ABOVE]
				fallthrough
			case '\u0250': // ɐ [LATIN SMALL LETTER TURNED A]
				fallthrough
			case '\u0259': // ə [LATIN SMALL LETTER SCHWA]
				fallthrough
			case '\u025A': // ɚ [LATIN SMALL LETTER SCHWA WITH HOOK]
				fallthrough
			case '\u1D8F': // ᶏ [LATIN SMALL LETTER A WITH RETROFLEX HOOK]
				fallthrough
			case '\u1D95': // ᶕ [LATIN SMALL LETTER SCHWA WITH RETROFLEX HOOK]
				fallthrough
			case '\u1E01': // ạ [LATIN SMALL LETTER A WITH RING BELOW]
				fallthrough
			case '\u1E9A': // ả [LATIN SMALL LETTER A WITH RIGHT HALF RING]
				fallthrough
			case '\u1EA1': // ạ [LATIN SMALL LETTER A WITH DOT BELOW]
				fallthrough
			case '\u1EA3': // ả [LATIN SMALL LETTER A WITH HOOK ABOVE]
				fallthrough
			case '\u1EA5': // ấ [LATIN SMALL LETTER A WITH CIRCUMFLEX AND ACUTE]
				fallthrough
			case '\u1EA7': // ầ [LATIN SMALL LETTER A WITH CIRCUMFLEX AND GRAVE]
				fallthrough
			case '\u1EA9': // ẩ [LATIN SMALL LETTER A WITH CIRCUMFLEX AND HOOK ABOVE]
				fallthrough
			case '\u1EAB': // ẫ [LATIN SMALL LETTER A WITH CIRCUMFLEX AND TILDE]
				fallthrough
			case '\u1EAD': // ậ [LATIN SMALL LETTER A WITH CIRCUMFLEX AND DOT BELOW]
				fallthrough
			case '\u1EAF': // ắ [LATIN SMALL LETTER A WITH BREVE AND ACUTE]
				fallthrough
			case '\u1EB1': // ằ [LATIN SMALL LETTER A WITH BREVE AND GRAVE]
				fallthrough
			case '\u1EB3': // ẳ [LATIN SMALL LETTER A WITH BREVE AND HOOK ABOVE]
				fallthrough
			case '\u1EB5': // ẵ [LATIN SMALL LETTER A WITH BREVE AND TILDE]
				fallthrough
			case '\u1EB7': // ặ [LATIN SMALL LETTER A WITH BREVE AND DOT BELOW]
				fallthrough
			case '\u2090': // ₐ [LATIN SUBSCRIPT SMALL LETTER A]
				fallthrough
			case '\u2094': // ₔ [LATIN SUBSCRIPT SMALL LETTER SCHWA]
				fallthrough
			case '\u24D0': // ⓐ [CIRCLED LATIN SMALL LETTER A]
				fallthrough
			case '\u2C65': // ⱥ [LATIN SMALL LETTER A WITH STROKE]
				fallthrough
			case '\u2C6F': // Ɐ [LATIN CAPITAL LETTER TURNED A]
				fallthrough
			case '\uFF41': // ａ [FULLWIDTH LATIN SMALL LETTER A]
				output[outputPos] = 'a'
				outputPos++

			case '\uA732': // Ꜳ [LATIN CAPITAL LETTER AA]
				output = output[:(len(output) + 1)]
				output[outputPos] = 'A'
				outputPos++
				output[outputPos] = 'A'
				outputPos++

			case '\u00C6': // Æ [LATIN CAPITAL LETTER AE]
				fallthrough
			case '\u01E2': // Ǣ [LATIN CAPITAL LETTER AE WITH MACRON]
				fallthrough
			case '\u01FC': // Ǽ [LATIN CAPITAL LETTER AE WITH ACUTE]
				fallthrough
			case '\u1D01': // ᴁ [LATIN LETTER SMALL CAPITAL AE]
				output = output[:(len(output) + 1)]
				output[outputPos] = 'A'
				outputPos++
				output[outputPos] = 'E'
				outputPos++

			case '\uA734': // Ꜵ [LATIN CAPITAL LETTER AO]
				output = output[:(len(output) + 1)]
				output[outputPos] = 'A'
				outputPos++
				output[outputPos] = 'O'
				outputPos++

			case '\uA736': // Ꜷ [LATIN CAPITAL LETTER AU]
				output = output[:(len(output) + 1)]
				output[outputPos] = 'A'
				outputPos++
				output[outputPos] = 'U'
				outputPos++

			case '\uA738': // Ꜹ [LATIN CAPITAL LETTER AV]
				fallthrough
			case '\uA73A': // Ꜻ [LATIN CAPITAL LETTER AV WITH HORIZONTAL BAR]
				output = output[:(len(output) + 1)]
				output[outputPos] = 'A'
				outputPos++
				output[outputPos] = 'V'
				outputPos++

			case '\uA73C': // Ꜽ [LATIN CAPITAL LETTER AY]
				output = output[:(len(output) + 1)]
				output[outputPos] = 'A'
				outputPos++
				output[outputPos] = 'Y'
				outputPos++

			case '\u249C': // ⒜ [PARENTHESIZED LATIN SMALL LETTER A]
				output = output[:(len(output) + 2)]
				output[outputPos] = '('
				outputPos++
				output[outputPos] = 'a'
				outputPos++
				output[outputPos] = ')'
				outputPos++

			case '\uA733': // ꜳ [LATIN SMALL LETTER AA]
				output = output[:(len(output) + 1)]
				output[outputPos] = 'a'
				outputPos++
				output[outputPos] = 'a'
				outputPos++

			case '\u00E6': // æ [LATIN SMALL LETTER AE]
				fallthrough
			case '\u01E3': // ǣ [LATIN SMALL LETTER AE WITH MACRON]
				fallthrough
			case '\u01FD': // ǽ [LATIN SMALL LETTER AE WITH ACUTE]
				fallthrough
			case '\u1D02': // ᴂ [LATIN SMALL LETTER TURNED AE]
				output = output[:(len(output) + 1)]
				output[outputPos] = 'a'
				outputPos++
				output[outpu
```

### Core Architecture Module: `analysis/char/html.go`
```
//  Copyright (c) 2020 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package char

import (
	"regexp"
)

var htmlCharFilterRegexp = regexp.MustCompile(`</?[!\w]+((\s+\w+(\s*=\s*(?:".*?"|'.*?'|[^'">\s]+))?)+\s*|\s*)/?>`)

func NewHTMLCharFilter() *RegexpCharFilter {
	return NewRegexpCharFilter(htmlCharFilterRegexp, []byte(" "))
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #181** (2026-11-13): **chore: add new ice and riot index version for faster and smaller index**
  *Symptoms*: Generated with Codg Assisted-by: claude-fable-5-2 via Codg <codg@atomai.cc>  **Please provide Issues links to:**  - Issues: #  **Provide test code:**      ```Go              ```      ## Description  ... 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/vcaesar/riot?pullRequest=181) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/vcaesar/riot?pullRequest=181) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/vcaesar/riot?pullRequest=181) it.</sub>

- **Issue #174** (2026-11-03): **update: update go mod fix bugs**
  *Symptoms*: **Please provide Issues links to:**  - Issues: #  **Provide test code:**      ```Go              ```      ## Description  ... 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/vcaesar/riot?pullRequest=174) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/vcaesar/riot?pullRequest=174) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/vcaesar/riot?pullRequest=174) it.</sub>

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

### Incident Patch 1: `8c8e4e36` (2026-11-18)
**Commit Message**: fix: macOS CI timeout in TestInt8RecallAndExactScores

- Update quant_test.go, tests.yml

Generated with Codg
Assisted-by: claude-opus-5-5 via Codg <[REDACTED_EMAIL]>

**File**: `.github/workflows/tests.yml` (modified, +4/-2)
```diff
@@ -20,12 +20,14 @@ jobs:
       - name: Install Go
         uses: actions/setup-go@v7
         with:
-          go-version-file: go.mod
+          go-version: stable
+          check-latest: true
       - name: Test
         run: |
           go version
           go test -run '^TestTextFieldReleaseAllocations$' .
-          go test -race '-coverprofile=coverage.out' ./...
+          go test -race ./...
+          go test '-coverprofile=coverage.out' ./...
       - name: Upload coverage
         uses: codecov/codecov-action@v7
         with:
```

**File**: `hnsw/quant_test.go` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ func TestInt8RecallAndExactScores(t *testing.T) {
 	for _, metric := range []vec.Metric{vec.Cosine, vec.DotProduct, vec.L2} {
 		total := map[Quantization]float64{}
 		for _, quant := range []Quantization{QuantizationInt8, QuantizationNone} {
-			g := build(t, metric, Params{Quantization: quant}, vectors)
+			g := build(t, metric, Params{EfConstruction: 64, Quantization: quant}, vectors)
 			for _, q := range queries {
 				got, err := g.Search(q, 10, 0, nil)
 				if err != nil {
```

---

### Incident Patch 2: `2501765a` (2026-11-04)
**Commit Message**: chore: add index v10 code, and review code and lint fixes in CI changes

- Update config_test.go, config.go

Generated with Codg
Assisted-by: claude-opus-5-5 via Codg <[REDACTED_EMAIL]>

**File**: `.github/workflows/lint.yml` (modified, +1/-1)
```diff
@@ -21,6 +21,6 @@ jobs:
       - name: golangci-lint
         uses: golangci/golangci-lint-action@v9
         with:
-          version: v2.13.2
+          version: v2.15.0
           # Build with the module's Go version so the analyzer supports it.
           install-mode: goinstall
```

**File**: `.github/workflows/tests.yml` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@ jobs:
       - name: Test
         run: |
           go version
+          go test -run '^TestTextFieldReleaseAllocations$' .
           go test -race ./...
       - name: Build 32-bit
         if: matrix.platform == 'ubuntu-latest'
```

**File**: `.golangci.yml` (modified, +11/-0)
```diff
@@ -159,6 +159,17 @@ linters:
         linters:
           - gochecknoinits
 
+      # language packages register their analyzer when imported
+      - path: ^analysis/lang/.*/register\.go$
+        linters:
+          - gochecknoinits
+
+      # test stubs implement interfaces with value receivers
+      - path: _test\.go
+        linters:
+          - gocritic
+        text: "hugeParam:"
+
       # and allow init here
       - path: analysis/freq.go
         linters:
```

**File**: `README.md` (modified, +2/-0)
```diff
@@ -401,6 +401,8 @@ All three engines run the same workload: 100,000 synthetic documents (`body` tex
 
 Scores differ from Bluge's because riot fixed Bluge's BM25 idf to Lucene's `log(1 + (N − n + 0.5)/(n + 0.5))`. Bluge has no vector search; Bleve's needs the `vectors` build tag and FAISS through cgo. These are single-machine numbers on synthetic data, not a formal benchmark.
 
+Riot (Go) is already on par with Tantivy: it is faster on 7 of 10 query workloads in the same run. An even faster Zig version of riot is also in development. It is still beta and not published yet. In the same benchmark run it was about 2–5× faster than riot (Go) on most queries and 2.9× faster at indexing, and it was at least 1.5× faster than Tantivy on every query workload (2–8× on most).
+
 ## License
 
 Apache License Version 2.0
```

**File**: `analysis/freq.go` (modified, +153/-45)
```diff
@@ -17,7 +17,9 @@ package analysis
 
 import (
 	"bytes"
+	"math"
 	"reflect"
+	"slices"
 	"sync"
 	"unsafe"
 
@@ -37,49 +39,56 @@ func init() {
 // TokenLocation represents one occurrence of a term at a particular location in
 // a field. Start, End and Position have the same meaning as in analysis.Token.
 // Field and ArrayPositions identify the field value in the source document.
-// See document.Field for details.
+// See document.Field for details. Values beyond int32 are stored as -1,
+// which segments reject as a negative location.
 type TokenLocation struct {
 	FieldVal    string
-	StartVal    int
-	EndVal      int
-	PositionVal int
+	StartVal    int32
+	EndVal      int32
+	PositionVal int32
+}
+
+// Loc32 converts a location value for TokenLocation: -1 when it does not
+// fit an int32.
+func Loc32(v int) int32 {
+	if v > math.MaxInt32 || v < math.MinInt32 {
+		return -1
+	}
+	return int32(v)
 }
 
 func (tl *TokenLocation) Field() string {
 	return tl.FieldVal
 }
 
 func (tl *TokenLocation) Pos() int {
-	return tl.PositionVal
+	return int(tl.PositionVal)
 }
 
 func (tl *TokenLocation) Start() int {
-	return tl.StartVal
+	return int(tl.StartVal)
 }
 
 func (tl *TokenLocation) End() int {
-	return tl.EndVal
+	return int(tl.EndVal)
 }
 
 func (tl *TokenLocation) Size() int {
 	return reflectStaticSizeTokenLocation
 }
 
 // TokenFreq represents all the occurrences of a term in all fields of a
-// document.
+// document. Locations holds the values, not pointers, so a term's
+// locations are one allocation (or a window of one shared by the field).
 type TokenFreq struct {
 	TermVal   []byte
-	Locations []*TokenLocation
+	Locations []TokenLocation
 	frequency int
 }
 
 func (tf *TokenFreq) Size() int {
-	rv := reflectStaticSizeTokenFreq
-	rv += len(tf.TermVal)
-	for _, loc := range tf.Locations {
-		rv += loc.Size()
-	}
-	return rv
+	return reflectStaticSizeTokenFreq + len(tf.TermVal) +
+		len(tf.Locations)*reflectStaticSizeTokenLocation
 }
 
 func (tf *TokenFreq) Term() []byte {
@@ -91,8 +100,8 @@ func (tf *TokenFreq) Frequency() int {
 }
 
 func (tf *TokenFreq) EachLocation(location segment.VisitLocation) {
-	for _, tl := range tf.Locations {
-		location(tl)
+	for i := range tf.Locations {
+		location(&tf.Locations[i])
 	}
 }
 
@@ -122,8 +131,8 @@ func (tfs TokenFrequencies) MergeAll(remoteField string, other TokenFrequencies)
 
 func (tfs TokenFrequencies) mergeOne(remoteField, tfk string, tf *TokenFreq, block []TokenFreq, blockCap int) []TokenFreq {
 	// set the remoteField value in incoming token freqs
-	for _, l := range tf.Locations {
-		l.FieldVal = remoteField
+	for i := range tf.Locations {
+		tf.Locations[i].FieldVal = remoteField
 	}
 	existingTf, exists := tfs[tfk]
 	if exists {
@@ -147,8 +156,8 @@ func (tfs TokenFrequencies) mergeOne(remoteField, tfk string, tf *TokenFreq, blo
 
 func (tfs TokenFrequencies) MergeOneBytes(remoteField string, tfk []byte, tf *TokenFreq) {
 	// set the remoteField value in incoming token freqs
-	for _, l := range tf.Locations {
-		l.FieldVal = remoteField
+	for i := range tf.Locations {
+		tf.Locations[i].FieldVal = remoteField
 	}
 	existingTf, exists := tfs[string(tfk)]
 	if exists {
@@ -158,9 +167,8 @@ func (tfs TokenFrequencies) MergeOneBytes(remoteField string, tfk []byte, tf *To
 		tfs[string(tfk)] = &TokenFreq{
 			TermVal:   tf.TermVal,
 			frequency: tf.frequency,
-			Locations: make([]*TokenLocation, len(tf.Locations)),
+			Locations: slices.Clone(tf.Locations),
 		}
-		copy(tfs[string(tfk)].Locations, tf.Locations)
 	}
 }
 
@@ -190,19 +198,111 @@ const maxPooledDedup = 1 << 14
 // Keys alias token bytes and are cleared before the map is put back.
 var dedupMaps = sync.Pool{New: func() any { return make(map[string]int32) }}
 
+// maxPooledTermOf bounds the per-token term index scratch kept for reuse.
+const maxPooledTermOf = 1 << 16
+
+// termOfs recycles TokenFrequencySlice's token -> term index scratch.
+var termOfs = sync.Pool{New: func() any { return new([]int32) }}
+
+// AppendTerm adds one occurrence of term, without a location, to tfs: as
+// TokenFrequencySlice does for a short stream without term vectors.
+func AppendTerm(tfs []TokenFreq, term []byte) []TokenFreq {
+	for i := range tfs {
+		if bytes.Equal(tfs[i].TermVal, term) {
+			tfs[i].frequency++
+			return tfs
+		}
+	}
+	return append(tfs, TokenFreq{TermVal: term, frequency: 1})
+}
+
+// SingleTokenFrequency is TokenFrequencySlice for a stream of one token
+// spanning all of term (position increment 1), without building the stream.
+func SingleTokenFrequency(term []byte, includeTermVectors bool, startOffset int) (
+	tfs []TokenFreq, position int) {
+	if !includeTermVectors {
+		return []TokenFreq{{TermVal: term, frequency: 1}}, 0
+	}
+	// the term and its location in one allocation
+	one := &struct {
+		tf  [1]TokenFreq
+		loc [1]TokenLocation
+	}{}
+	position = startOffset + 1
+	one.loc[0] = TokenLocation{EndVal: Loc32(len(term)), PositionVal: Loc32(position)}
+	one.tf[0] = TokenFreq
```

**File**: `analysis/freq_test.go` (modified, +68/-8)
```diff
@@ -16,8 +16,12 @@
 package analysis
 
 import (
+	"bytes"
+	"math"
 	"reflect"
+	"strconv"
 	"testing"
+	"unsafe"
 )
 
 func TestTokenFrequency(t *testing.T) {
@@ -38,7 +42,7 @@ func TestTokenFrequency(t *testing.T) {
 	expectedResult := TokenFrequencies{
 		"water": &TokenFreq{
 			TermVal: []byte("water"),
-			Locations: []*TokenLocation{
+			Locations: []TokenLocation{
 				{
 					PositionVal: 1,
 					StartVal:    0,
@@ -63,7 +67,7 @@ func TestTokenFrequenciesMergeAll(t *testing.T) {
 	tf1 := TokenFrequencies{
 		"water": &TokenFreq{
 			TermVal: []byte("water"),
-			Locations: []*TokenLocation{
+			Locations: []TokenLocation{
 				{
 					PositionVal: 1,
 					StartVal:    0,
@@ -80,7 +84,7 @@ func TestTokenFrequenciesMergeAll(t *testing.T) {
 	tf2 := TokenFrequencies{
 		"water": &TokenFreq{
 			TermVal: []byte("water"),
-			Locations: []*TokenLocation{
+			Locations: []TokenLocation{
 				{
 					PositionVal: 1,
 					StartVal:    0,
@@ -97,7 +101,7 @@ func TestTokenFrequenciesMergeAll(t *testing.T) {
 	expectedResult := TokenFrequencies{
 		"water": &TokenFreq{
 			TermVal: []byte("water"),
-			Locations: []*TokenLocation{
+			Locations: []TokenLocation{
 				{
 					PositionVal: 1,
 					StartVal:    0,
@@ -134,7 +138,7 @@ func TestTokenFrequenciesMergeAllLeftEmpty(t *testing.T) {
 	tf2 := TokenFrequencies{
 		"water": &TokenFreq{
 			TermVal: []byte("water"),
-			Locations: []*TokenLocation{
+			Locations: []TokenLocation{
 				{
 					PositionVal: 1,
 					StartVal:    0,
@@ -151,7 +155,7 @@ func TestTokenFrequenciesMergeAllLeftEmpty(t *testing.T) {
 	expectedResult := TokenFrequencies{
 		"water": &TokenFreq{
 			TermVal: []byte("water"),
-			Locations: []*TokenLocation{
+			Locations: []TokenLocation{
 				{
 					FieldVal:    "tf2",
 					PositionVal: 1,
@@ -222,7 +226,7 @@ func TestTokenFrequenciesMergeAllDoesNotAliasSource(t *testing.T) {
 	if got := len(composite["x"].Locations); got != 4 {
 		t.Fatalf("composite has %d locations, want 4", got)
 	}
-	if len(src["x"].Locations) != 3 || srcLocs[:cap(srcLocs)][3] != nil {
+	if len(src["x"].Locations) != 3 || srcLocs[:cap(srcLocs)][3] != (TokenLocation{}) {
 		t.Fatal("merge wrote into the source field's spare capacity")
 	}
 	for _, l := range src["x"].Locations {
@@ -289,7 +293,7 @@ func TestTokenFrequencySliceDedupPaths(t *testing.T) {
 				}
 				for _, loc := range tf.Locations {
 					if tok := tokens[loc.Pos()-11]; string(tok.Term) != order[i] || tok.Start != loc.Start() {
-						t.Fatalf("n=%d term %q: location %+v points at %q", n, tf.Term(), *loc, tok.Term)
+						t.Fatalf("n=%d term %q: location %+v points at %q", n, tf.Term(), loc, tok.Term)
 					}
 				}
 				total += tf.Frequency()
@@ -308,3 +312,59 @@ func TestNewTokenFrequenciesPointsIntoSlice(t *testing.T) {
 		t.Fatalf("map %v does not index the slice", m)
 	}
 }
+
+// Each term's locations are a capped window of one field block, so
+// appending to one term never overwrites its neighbour's locations.
+func TestTokenFrequencyLocationWindows(t *testing.T) {
+	if s := unsafe.Sizeof(TokenLocation{}); s != 32 {
+		t.Fatalf("TokenLocation is %d bytes, want 32", s)
+	}
+	tfs, _ := TokenFrequencySlice(TokenStream{
+		{Term: []byte("a"), Start: 0, End: 1, PositionIncr: 1},
+		{Term: []byte("b"), Start: 2, End: 3, PositionIncr: 1},
+		{Term: []byte("a"), Start: 4, End: 5, PositionIncr: 1},
+	}, true, 0)
+	a, b := &tfs[0], &tfs[1]
+	if len(a.Locations) != 2 || cap(a.Locations) != 2 || len(b.Locations) != 1 {
+		t.Fatalf("windows a=%d/%d b=%d", len(a.Locations), cap(a.Locations), len(b.Locations))
+	}
+	a.Locations = append(a.Locations, TokenLocation{PositionVal: 99})
+	if b.Locations[0].Pos() != 2 || b.Locations[0].Start() != 2 {
+		t.Fatalf("append to a clobbered b: %+v", b.Locations[0])
+	}
+}
+
+func TestLoc32(t *testing.T) {
+	for v, want := range map[int]int32{0: 0, 7: 7, math.MaxInt32: math.MaxInt32, -3: -3} {
+		if got := Loc32(v); got != want {
+			t.Fatalf("Loc32(%d) = %d", v, got)
+		}
+	}
+	if strconv.IntSize == 64 {
+		for _, v := range []int{math.MaxInt32 + 1, math.MinInt32 - 1} {
+			if got := Loc32(v); got != -1 {
+				t.Fatalf("Loc32(%d) = %d, want -1", v, got)
+			}
+		}
+	}
+}
+
+// SingleTokenFrequency matches TokenFrequencySlice of the one-token stream
+// a keyword field used to build, with and without term vectors.
+func TestSingleTokenFrequency(t *testing.T) {
+	for _, term := range [][]byte{[]byte("doc-42"), {}} {
+		for _, vectors := range []bool{false, true} {
+			stream := TokenStream{{Term: term, End: len(term), PositionIncr: 1, Type: AlphaNumeric}}
+			want, wantPos := TokenFrequencySlice(stream, vectors, 7)
+			got, gotPos := SingleTokenFrequency(term, vectors, 7)
+			if gotPos != wantPos || len(got) != 1 || len(want) != 1 {
+				t.Fatalf("%q vectors=%v: pos %d/%d len %d/%d", term, vectors, gotPos, wantPos, len(got), len(want))
+			}
+			g, w := got[0], want[0]
+			if !bytes.Equal(g.TermVal, w.TermVal) || g.Frequency() != w.Frequency() ||
+				!reflect.D
```

**File**: `analysis/lang/lang.go` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+//  Copyright (c) 2026 The AtomAI.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// 		http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+// Package lang is the registry of language analyzers selected by code, for
+// example riot.Config.WithLang("de").
+//
+// Only "standard", "simple", "keyword", "web" and "en" are built in. A
+// language package registers its code when imported, so a binary links only
+// the languages it activates:
+//
+//	import _ "github.com/vcaesar/riot/analysis/lang/de"
+package lang
+
+import (
+	"fmt"
+	"sort"
+	"sync"
+
+	"github.com/vcaesar/riot/analysis"
+	"github.com/vcaesar/riot/analysis/analyzer"
+	"github.com/vcaesar/riot/analysis/lang/en"
+)
+
+var (
+	mu        sync.RWMutex
+	analyzers = map[string]func() *analysis.Analyzer{
+		"standard": analyzer.NewStandardAnalyzer,
+		"simple":   analyzer.NewSimpleAnalyzer,
+		"keyword":  analyzer.NewKeywordAnalyzer,
+		"web":      analyzer.NewWebAnalyzer,
+		"en":       en.NewAnalyzer,
+	}
+)
+
+// Register makes the analyzer constructor available under code; a later
+// registration of the same code replaces it.
+func Register(code string, newAnalyzer func() *analysis.Analyzer) {
+	mu.Lock()
+	analyzers[code] = newAnalyzer
+	mu.Unlock()
+}
+
+// Codes lists the registered codes, sorted.
+func Codes() []string {
+	mu.RLock()
+	codes := make([]string, 0, len(analyzers))
+	for code := range analyzers {
+		codes = append(codes, code)
+	}
+	mu.RUnlock()
+	sort.Strings(codes)
+	return codes
+}
+
+// New returns a new analyzer for code.
+func New(code string) (*analysis.Analyzer, error) {
+	mu.RLock()
+	newAnalyzer, ok := analyzers[code]
+	mu.RUnlock()
+	if !ok {
+		return nil, fmt.Errorf("error unknown language analyzer %q (import its analysis/lang package to activate it), want one of %v",
+			code, Codes())
+	}
+	return newAnalyzer(), nil
+}
```

**File**: `analysis/tokenizer/unicode.go` (modified, +178/-57)
```diff
@@ -31,84 +31,205 @@ func NewUnicodeTokenizer() *UnicodeTokenizer {
 }
 
 func (rt *UnicodeTokenizer) Tokenize(input []byte) analysis.TokenStream {
-	rvx := make([]analysis.TokenStream, 0, 10) // When rv gets full, append to rvx.
 	// size the first stream and token block for words of about 5 bytes
 	// plus a separator, so short inputs of such text never regrow them
 	est := len(input)/6 + 1
-	rv := make(analysis.TokenStream, 0, min(est, maxRvCapacity))
+	return tokenize(input, make(analysis.TokenStream, 0, min(est, maxRvCapacity)),
+		make([]analysis.Token, min(est, maxEstimatedRemainingSegments)))
+}
 
-	ta := make([]analysis.Token, min(est, maxEstimatedRemainingSegments))
-	taNext := 0
+// Scratch is the reusable token storage of TokenizeInto.
+type Scratch struct {
+	stream analysis.TokenStream
+	tokens []analysis.Token
+}
 
-	segmenter := segment.NewWordSegmenterDirect(input)
-	start := 0
+// TokenizeInto is Tokenize reusing s's stream and first token block; the
+// tokens returned are valid only until s is used again.
+func (rt *UnicodeTokenizer) TokenizeInto(input []byte, s *Scratch) analysis.TokenStream {
+	if est := min(len(input)/6+1, maxEstimatedRemainingSegments); cap(s.tokens) < est {
+		s.tokens = make([]analysis.Token, est)
+	}
+	if est := min(len(input)/6+1, maxRvCapacity); cap(s.stream) < est {
+		s.stream = make(analysis.TokenStream, 0, est)
+	}
+	rv := tokenize(input, s.stream[:0], s.tokens[:cap(s.tokens)])
+	if cap(rv) > cap(s.stream) {
+		s.stream = rv[:0]
+	}
+	return rv
+}
 
-	guessRemaining := func(end int) int {
-		avgSegmentLen := end / (len(rv) + 1)
-		if avgSegmentLen < 1 {
-			avgSegmentLen = 1
-		}
+// tokens collects a token stream, taking tokens from ta, then from blocks
+// sized by the words seen so far.
+type tokens struct {
+	input  []byte
+	rv     analysis.TokenStream
+	rvx    []analysis.TokenStream // filled streams, before rv
+	ta     []analysis.Token
+	taNext int
+}
 
-		remainingLen := len(input) - end
+// tokenize appends the tokens of input to rv, taking them from ta first.
+func tokenize(input []byte, rv analysis.TokenStream, ta []analysis.Token) analysis.TokenStream {
+	t := tokens{input: input, rv: rv, ta: ta}
+	t.addWords()
+	return t.stream()
+}
 
-		return remainingLen / avgSegmentLen
+// addWords adds the words of the input. No Unicode word rule joins over
+// an ASCII separator (asciiBreak), so each span from one up to the next
+// that is not plain ASCII is left to the segmenter, and the rest to
+// addPlainASCII.
+func (t *tokens) addWords() {
+	in := t.input
+	done := 0
+	for i := 0; i < len(in); i++ {
+		if in[i] < 0x80 && asciiClass[in[i]] != 0 {
+			continue
+		}
+		lo, hi := i, i+1
+		for lo > done && !isBreak(in[lo]) {
+			lo--
+		}
+		for hi < len(in) && !isBreak(in[hi]) {
+			hi++
+		}
+		t.addPlainASCII(done, lo)
+		t.addSegments(lo, hi)
+		done, i = hi, hi
 	}
+	t.addPlainASCII(done, len(in))
+}
 
-	for segmenter.Segment() {
-		segmentBytes := segmenter.Bytes()
-		end := start + len(segmentBytes)
-		if segmenter.Type() != segment.None {
-			if taNext >= len(ta) {
-				remainingSegments := guessRemaining(end)
-				if remainingSegments > maxEstimatedRemainingSegments {
-					remainingSegments = maxEstimatedRemainingSegments
-				}
-				if remainingSegments < 1 {
-					remainingSegments = 1
-				}
+func isBreak(b byte) bool { return b < 0x80 && asciiClass[b] == asciiBreak }
 
-				ta = make([]analysis.Token, remainingSegments)
-				taNext = 0
-			}
-
-			token := &ta[taNext]
-			taNext++
+// addSegments adds the words the Unicode segmenter finds in input[lo:hi].
+func (t *tokens) addSegments(lo, hi int) {
+	segmenter := segment.NewWordSegmenterDirect(t.input[lo:hi])
+	start := lo
+	for segmenter.Segment() {
+		end := start + len(segmenter.Bytes())
+		if typ := segmenter.Type(); typ != segment.None {
+			t.add(start, end, convertType(typ))
+		}
+		start = end
+	}
+}
 
-			token.Term = segmentBytes
-			token.Start = start
-			token.End = end
-			token.PositionIncr = 1
-			token.Type = convertType(segmenter.Type())
+func (t *tokens) add(start, end int, typ analysis.TokenType) {
+	if t.taNext >= len(t.ta) {
+		// guess the remaining words from the average length so far
+		remaining := (len(t.input) - end) / max(end/(len(t.rv)+1), 1)
+		t.ta = make([]analysis.Token, min(max(remaining, 1), maxEstimatedRemainingSegments))
+		t.taNext = 0
+	}
+	token := &t.ta[t.taNext]
+	t.taNext++
+	*token = analysis.Token{ // reused blocks may hold an old token
+		Term:         t.input[start:end],
+		Start:        start,
+		End:          end,
+		PositionIncr: 1,
+		Type:         typ,
+	}
+	if len(t.rv) >= cap(t.rv) { // When rv is full, save it into rvx.
+		t.rvx = append(t.rvx, t.rv)
+		t.rv = make(analysis.TokenStream, 0, min(cap(t.rv)*2, maxRvCapacity)) // Next rv cap is bigger.
+	}
+	t.rv = append(t.rv, token)
+}
 
-			if len(rv) >= cap(rv) { // When rv is full, save it into rvx.
-				rvx = append(rvx, rv)
+func (t *tokens) stream() analysis.TokenStream {
+	if len(t
```

---

### Incident Patch 3: `58c5043e` (2026-11-05)
**Commit Message**: fix: windows CI failures in snapshot backup tests

- Update snapshot_backup_incr_test.go, snapshot_backup_test.go

Generated with Codg
Assisted-by: claude-opus-5-5 via Codg <[REDACTED_EMAIL]>

**File**: `index/snapshot_backup_incr_test.go` (modified, +3/-1)
```diff
@@ -140,8 +140,10 @@ func TestBackupReplacesMismatchedItem(t *testing.T) {
 		}
 	})
 	writeDocs(t, cfg, "1", "2")
-	r := openTestReader(t, cfg)
+	// before the reader: cleanups run last in first out, and Windows cannot
+	// remove a link of the segment the reader still maps
 	dst, path := backupDir(t)
+	r := openTestReader(t, cfg)
 
 	outside := filepath.Join(t.TempDir(), "other-index.seg")
 	junk := []byte("segment of another index")
```

**File**: `index/snapshot_backup_test.go` (modified, +4/-0)
```diff
@@ -17,6 +17,7 @@ package index
 import (
 	"os"
 	"path/filepath"
+	"runtime"
 	"strconv"
 	"testing"
 )
@@ -250,6 +251,9 @@ func BenchmarkBackup(b *testing.B) {
 // TestBackupSegmentFileRemoved checks that a segment whose file the deletion
 // policy removed after a merge is still backed up from the open snapshot.
 func TestBackupSegmentFileRemoved(t *testing.T) {
+	if runtime.GOOS == "windows" {
+		t.Skip("windows cannot remove a segment file the snapshot maps")
+	}
 	cfg, cleanup := CreateConfig("TestBackupSegmentFileRemoved")
 	t.Cleanup(func() {
 		if err := cleanup(); err != nil {
```

#### Recent Merged Pull Requests:
- **PR #185** (2026-11-19): chore: raise Go test coverage from 61% to 98%+ across packages (@vcaesar)
- **PR #184** (2026-11-18): chore: raise Go test coverage from 61% to 89%+ across packages (@vcaesar)
- **PR #183** (2026-11-18): feat: add codecov.io to tests.yml CI (@vcaesar)
- **PR #182** (2026-11-15): chore: update README.md new version bm and translate into langs/ (@vcaesar)
- **PR #181** (2026-11-13): chore: add new ice and riot index version for faster and smaller index (@vcaesar)
- **PR #180** (2026-11-12): chore: update README.md bm and translate into langs/ (@vcaesar)

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

## X. macOS CI timeout in TestInt8RecallAndExactScores

**RULE**:
When implementing operations in `.github/workflows/tests.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in vcaesar/riot. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8c8e4e36`: macOS CI timeout in TestInt8RecallAndExactScores. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/tests.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
          go-version: stable
          check-latest: true
          go test -race ./...
          go test '-coverprofile=coverage.out' ./...
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
          go-version-file: go.mod
          go test -race '-coverprofile=coverage.out' ./...
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8c8e4e36` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
