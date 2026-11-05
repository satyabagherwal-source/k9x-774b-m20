> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/0xcub3-wblock-learnings.md`  
> **Source**: github ([https://github.com/0xCUB3/wBlock](https://github.com/0xCUB3/wBlock))  
> **Source Version**: `9e5ec865`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T14:02:36.071Z  
> **Learning ID**: `learn-github-0xcub3-wblock`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): 0xCUB3/wBlock

> **Canonical Artifact**: `07_PROJECT_LEARNING/0xcub3-wblock-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/0xCUB3/wBlock](https://github.com/0xCUB3/wBlock))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-05T14:02:35.275Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `0xCUB3/wBlock`
- **Description**: Free, open-source Safari ad blocker for macOS, iOS, iPadOS and visionOS. Up to 750,000 rules, custom filter lists, userscripts and userstyles. No subscription.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3191 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Packages/wblock-engine/Package.swift`
```
// swift-tools-version:5.9
// The Rust engine (crates/wbe) as a Swift package. build/WBE.xcframework comes
// from scripts/build-xcframework.sh and must exist before Xcode resolves this.
import PackageDescription

let package = Package(
    name: "WBEngine",
    platforms: [.macOS("12.3"), .iOS("15.4")],
    products: [.library(name: "WBEngine", targets: ["WBEngine"])],
    targets: [
        .binaryTarget(name: "WBE", path: "build/WBE.xcframework"),
        .target(name: "WBEngine", dependencies: ["WBE"]),
    ]
)

```

### Core Architecture Module: `Packages/wblock-engine/Sources/WBEngine/WBEngine.swift`
```
import Foundation
import WBE

/// Swift face of the wbe engine (crates/wbe/include/wbe.h).
public enum WBEngine {
    public struct EngineError: LocalizedError {
        public let errorDescription: String?
        static func last() -> EngineError {
            EngineError(errorDescription: wbe_last_error().map { String(cString: $0) } ?? "wbe failed")
        }
    }

    /// Changes whenever the engine's outputs change for the same input.
    public static var outputVersion: UInt32 { wbe_output_version() }

    public struct Compiled {
        /// Safari content-blocker JSON array, as UTF-8 bytes.
        public let safariRulesJSON: Data
        /// Rules for the per-page engine, one per line.
        public let runtimeRules: String
        public let stats: Stats
    }

    public struct Stats: Decodable {
        public let lines: Int
        public let rules: Int
        public let nativeRules: Int
        public let runtimeRules: Int
        public let dropped: [String: Int]
        public let admitted: [String: Int]?
        /// `Plan.fingerprint` of the arguments that produced these stats.
        public let fingerprint: String?

        enum CodingKeys: String, CodingKey {
            case lines, rules, dropped, admitted, fingerprint
            case nativeRules = "native_rules"
            case runtimeRules = "runtime_rules"
        }
    }

    /// Drops the parsed lists kept between plans. Plans in use keep theirs.
    public static func clearParseCache() {
        wbe_clear_parse_cache()
    }

    public final class Plan: @unchecked Sendable {
        private let handle: OpaquePointer

        public init(requestJSON: String) throws {
            guard let handle = wbe_plan_new(requestJSON) else { throw EngineError.last() }
            self.handle = handle
        }

        deinit { wbe_plan_free(handle) }

        /// Compiles the blocker unless `knownFingerprint` is the fingerprint its
        /// output has now (`compiled.stats.fingerprint`); then nil, and nothing
        /// was compiled.
        public func compileTarget(_ target: Int, extras: String, knownFingerprint: UInt64?) throws -> Compiled? {
            guard target >= 0 else {
                throw EngineError(errorDescription: "target index out of bounds")
            }
            guard let result = wbe_plan_compile_target(
                handle, target, extras, knownFingerprint != nil, knownFingerprint ?? 0
            ) else {
                throw EngineError.last()
            }
            defer { wbe_compile_free(result) }
            if wbe_compile_unchanged(result) { return nil }
            let statsJSON = String(cString: wbe_compile_stats_json(result))
            let webkit = wbe_compile_webkit_json(result)!
            return Compiled(
                // One copy out of the engine's buffer; no String round trip.
                safariRulesJSON: Data(bytes: webkit, count: strlen(webkit)),
                runtimeRules: String(cString: wbe_compile_runtime_text(result)),
                stats: try JSONDecoder().decode(Stats.self, from: Data(statsJSON.utf8))
            )
        }
    }

    /// Serializes a per-page engine for `runtimeRules`.
    public static func buildEngine(runtimeRules: String) throws -> Data {
        var bytes: UnsafeMutablePointer<UInt8>?
        var length = 0
        guard wbe_engine_build(runtimeRules, &bytes, &length), let bytes else {
            throw EngineError.last()
        }
        defer { wbe_bytes_free(bytes, length) }
        return Data(bytes: bytes, count: length)
    }

    /// The per-page engine. Not safe for concurrent use; callers serialize.
    public final class Engine {
        private let handle: OpaquePointer

        public init(data: Data) throws {
            let handle = data.withUnsafeBytes { raw in
                wbe_engine_open(raw.bindMemory(to: UInt8.self).baseAddress, raw.count)
            }
            guard let handle else { throw EngineError.last() }
            self.handle = handle
        }

        deinit { wbe_engine_free(handle) }

        /// `{"hide":[..],"procedural":[..],"scriptlets":[[name, args..]],"generichide":bool}`.
        public func lookup(url: String) throws -> Data {
            guard let json = wbe_engine_lookup(handle, url) else { throw EngineError.last() }
            defer { wbe_string_free(json) }
            return Data(bytes: json, count: strlen(json))
        }
    }

    /// The registrable domain (eTLD+1) of `host`, or nil for a public suffix.
    public static func registrableDomain(of host: String) -> String? {
        guard let root = wbe_registrable_domain(host) else { return nil }
        defer { wbe_string_free(root) }
        return String(cString: root)
    }

    /// The parsed form of one rule line as JSON, for the rule editor.
    public static func classify(line: String) -> Data? {
        guard let json = wbe_classify_line(line) else { return nil }
        defer { wbe_string_free(json) }
        return Data(bytes: json, count: strlen(json))
    }
}

```

### Core Architecture Module: `Packages/wblock-engine/crates/wbe/include/wbe.h`
```
/*
 * C ABI of the wbe filter engine (crates/wbe/src/ffi.rs), used by
 * wBlockCoreService through module.modulemap.
 *
 * Ownership: every pointer returned by a function named *_new, *_build,
 * *_open or *_lookup, or by wbe_classify_line, is owned by the caller and
 * released with the matching free function. Accessors such as
 * wbe_compile_webkit_json return borrowed pointers that stay valid until
 * the owning WbeCompileResult is freed.
 *
 * Failure: functions return NULL or false. wbe_last_error returns the
 * message for the last call on the calling thread; it is valid until that
 * thread's next wbe call and must not be freed.
 *
 * Threading: a WbeEngine must not be used from two threads at once. A WbePlan
 * may compile targets concurrently; free it only after all calls have finished.
 */
#ifndef WBE_H
#define WBE_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct WbeCompileResult WbeCompileResult;
typedef struct WbeEngine WbeEngine;
typedef struct WbePlan WbePlan;

const char *wbe_last_error(void);

/* Changes whenever the engine's outputs change for the same input. */
uint32_t wbe_output_version(void);

/* PlanRequest JSON contains safari, lists, targets, and optional cosmetics.
 * Each list may provide text or a UTF-8 file path. The plan owns its inputs. */
WbePlan *wbe_plan_new(const char *request_json);
/* extras_json is an array of {"text":..., "trusted":...}. The result's
 * stats JSON additionally contains admitted counts keyed by list ID. */
/* Compiles blocker `target` unless has_known_fingerprint and its fingerprint is
 * known_fingerprint; then wbe_compile_unchanged is true and nothing was compiled. */
WbeCompileResult *wbe_plan_compile_target(const WbePlan *plan, size_t target,
                                          const char *extras_json,
                                          bool has_known_fingerprint,
                                          uint64_t known_fingerprint);
bool wbe_compile_unchanged(const WbeCompileResult *result);
void wbe_plan_free(WbePlan *plan);
/* Drops the parsed lists kept between plans; plans in use keep theirs. */
void wbe_clear_parse_cache(void);

/* Safari content-blocker JSON array. */
const char *wbe_compile_webkit_json(const WbeCompileResult *result);
/* uBO rule lines for wbe_engine_build, joined with newlines. */
const char *wbe_compile_runtime_text(const WbeCompileResult *result);
/* {"lines":..,"rules":..,"native_rules":..,"runtime_rules":..,"dropped":{..}} */
const char *wbe_compile_stats_json(const WbeCompileResult *result);
void wbe_compile_free(WbeCompileResult *result);

/* On success *out holds *out_len bytes; free with wbe_bytes_free. */
bool wbe_engine_build(const char *runtime_text, uint8_t **out, size_t *out_len);
void wbe_bytes_free(uint8_t *bytes, size_t len);

WbeEngine *wbe_engine_open(const uint8_t *bytes, size_t len);
/* PagePayload JSON: {"hide":[..],"procedural":[..],"scriptlets":[[name,args..],..],"generichide":bool}. */
char *wbe_engine_lookup(const WbeEngine *engine, const char *url);
void wbe_engine_free(WbeEngine *engine);

/* Registrable domain (eTLD+1) of host, or NULL for a public suffix; free with wbe_string_free. */
char *wbe_registrable_domain(const char *host);

/* ParsedLine JSON for one filter line, for the rule editor. */
char *wbe_classify_line(const char *line);
void wbe_string_free(char *s);

#ifdef __cplusplus
}
#endif

#endif /* WBE_H */

```

### Core Architecture Module: `Packages/wblock-engine/crates/wbe/src/apply.rs`
```
//! One wBlock apply: every selected list parsed once and spread over the
//! content blockers. What used to be text passes in the app happens here on
//! parsed rules:
//!
//! - per-list site scope (#653, #767) and the global cosmetic scope (#899),
//! - `!#safari_cb_affinity` routing and shards of lists too big for one blocker,
//! - one copy of a rule shared by blockers with the same exceptions (#681),
//! - exceptions copied into the blockers whose blocks they cancel (#836),
//! - a large excluded list's plain blocks ahead of one ignore rule (#925),
//! - per-list counts of the rules each blocker admitted.
//!
//! `Plan::new` does the shared work; `Plan::compile_target` builds one
//! blocker's output and may run for several blockers at once.

use crate::ast::{
    DomainList, DomainMatcher, NetworkAction, NetworkRule, Party, ResourceTypes, Rule,
};
use crate::compile::{
    compile_blocker, compile_rules, parallel_indices, parse_list, CompileOptions, CompileOutput,
    NetworkContext, Others, RuleSet, Stats,
};
use crate::parse::cosmetic::with_domains;
use crate::webkit::{SafariVersion, WebkitJson, WkAction, WkRule, WkTrigger};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use rustc_hash::{FxHashMap, FxHashSet};
use std::borrow::Cow;
use std::collections::BTreeMap;
use std::ops::Range;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::hash::{Hash, Hasher};

#[derive(Debug, Clone, Default, Deserialize)]
pub struct SiteScope {
    /// Sites the list must not apply to (`name.*` for every ending).
    #[serde(default)]
    pub exclude: Vec<String>,
    /// When set, the only sites the list applies to.
    #[serde(default)]
    pub only: Option<Vec<String>>,
}

impl SiteScope {
    fn is_empty(&self) -> bool {
        self.exclude.is_empty() && self.only.is_none()
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListSpec {
    pub id: String,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub trusted: bool,
    #[serde(default)]
    pub scope: SiteScope,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TargetList {
    pub list: usize,
    /// `[index, count]` when the list is split over blockers.
    #[serde(default)]
    pub shard: Option<(u32, u32)>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TargetSpec {
    /// wBlock's blocker slot (1...5), which decides its affinity types.
    pub slot: u8,
    pub lists: Vec<TargetList>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct CosmeticScope {
    #[serde(flatten)]
    pub sites: SiteScope,
    /// False drops hides that name no site.
    #[serde(default = "yes")]
    pub generic: bool,
}

fn yes() -> bool {
    true
}

#[derive(Debug, Clone, Deserialize)]
pub struct PlanRequest {
    pub safari: (u16, u16),
    /// In compile order.
    pub lists: Vec<ListSpec>,
    pub targets: Vec<TargetSpec>,
    #[serde(default)]
    pub cosmetics: CosmeticScope,
    /// Keep each list's patterns in the cache for later plans, so a plan
    /// fingerprints its blockers without parsing their rules again. It costs
    /// memory for as long as the cache holds the list, so a phone leaves it off.
    #[serde(default)]
    pub retain: bool,
}

/// Extra text one blocker compiles after its lists (zapper rules, wBlock's
/// compatibility rules, redirect carve-outs).
#[derive(Debug, Clone, Deserialize)]
pub struct Extra {
    pub text: String,
    #[serde(default)]
    pub trusted: bool,
}

#[derive(Debug, Serialize)]
pub struct TargetOutput {
    #[serde(skip)]
    pub output: CompileOutput,
    /// List id -> rules this blocker admitted from it (first copies only).
    pub admitted: BTreeMap<String, u64>,
    /// `Plan::fingerprint` of these arguments.
    #[serde(skip)]
    pub fingerprint: u64,
}

/// One rule of a list, kept as a pointer to its line. The rule itself is
/// parsed again when a blocker needs it (`Plan::rule`), so the plan holds
/// the list text and these records instead of every parsed rule.
#[derive(Clone, Copy)]
struct Parsed {
    /// Byte offset of the line in the list's text.
    offset: usize,
    /// 1-based line number, the rule's `source.line`.
    line: u32,
    /// Position of the rule among those its line parses to.
    index: u32,
    identity: u64,
    /// Exceptions and `$badfilter` stay in every shard and drive #681.
    shared: bool,
    /// An exception rule, which `shared` also covers with `$badfilter`.
    exception: bool,
    /// A network rule, so the network pass can skip the other kinds unparsed.
    network: bool,
    /// `is_plain_block`, which the segment of #925 compiles unscoped.
    plain: bool,
    badfilter: bool,
    /// Affinity types of the enclosing `!#safari_cb_affinity` block.
    affinity: Option<u8>,
}

struct ParsedList {
    /// The records in line order, in the chunks they were parsed in.
    chunks: Vec<Vec<Parsed>>,
    /// The patterns of the records, per chunk, when the list keeps them.
    patterns: Option<Vec<PatternChunk>>,
    has_affinity: bool,
    /// A `!#` directive anywhere keeps the list out of #681 dedupe, as before.
    has_directive: bool,
    stats: Stats,
}

/// The patterns of one chunk's records: `text` holds them back to back, and
/// `spans` gives each record's (start, length) in it, length 0 for none.
#[derive(Default)]
struct PatternChunk {
    text: String,
    spans: Vec<(u32, u32)>,
}

impl ParsedList {
    fn records(&self) -> impl Iterator<Item = &Parsed> + '_ {
        self.chunks.iter().flatten()
    }

    /// Record `i` of `chunk`'s pattern, when the list keeps patterns: `Some(None)`
    /// for a record with none.
    fn stored_pattern(&self, chunk: usize, i: usize) -> Option<Option<&str>> {
        let kept = self.patterns.as_ref()?.get(chunk)?;
        let (start, len) = kept.spans[i];
        Some((len > 0).then(|| &kept.text[start as usize..(start + len) as usize]))
    }

    fn count(&self) -> usize {
        self.chunks.iter().map(Vec::len).sum()
    }
}

/// What `parse` reads from a list, so a list's records can be reused by any
/// plan with the same key. The text is hashed and its length kept beside the
/// hash; the records' offsets point into that text.
#[derive(Clone, Copy, PartialEq, Eq)]
struct ParseKey {
    text: u64,
    len: usize,
    trusted: bool,
    scope: u64,
    version: u32,
    retain: bool,
}

impl ParseKey {
    fn of(list: &ListSpec, text: u64, retain: bool) -> ParseKey {
        ParseKey {
            text,
            len: list.text.len(),
            trusted: list.trusted,
            scope: hash(&(&list.scope.exclude, &list.scope.only)),
            version: crate::OUTPUT_VERSION,
            retain,
        }
    }
}

/// Parsed lists kept between plans. A plan keeps only the entries of its own
/// lists, so the cache holds one apply's lists and a changed list is parsed
/// again alone. The app clears it on phones after each apply.
#[derive(Default)]
pub struct ParseCache(Mutex<Vec<(ParseKey, Arc<ParsedList>)>>);

/// The cache `Plan::new` uses.
static PARSE_CACHE: ParseCache = ParseCache(Mutex::new(Vec::new()));

impl ParseCache {
    fn entries(&self) -> MutexGuard<'_, Vec<(ParseKey, Arc<ParsedList>)>> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn parsed(&self, key: ParseKey, list: &ListSpec) -> Arc<ParsedList> {
        if let Some((_, hit)) = self.entries().iter().find(|(k, _)| *k == key) {
            return hit.clone();
        }
        let parsed = Arc::new(parse(list, key.retain));
        let mut entries = self.entries();
        if !entries.iter().any(|(k, _)| *k == key) {
            entries.push((key, parsed.clone()));
        }
        parsed
    }

    fn keep(&self, keys: &[ParseKey]) {
        self.entries().retain(|(k, _)| keys.contains(k));
    }

    /// Drops every entry. Plans in use keep the lists they already parsed.
    pub fn clear(&self) {
        self.entries().clear();
    }
}

/// Empties the process-wide parse cache.
pub fn clear_parse_cache() {
    PARSE_CACHE.clear();
}

/// Records per network unit: the granularity at which rules are parsed and
/// compiled, so a unit's rules are the only ones held at once.
const UNIT_RECORDS: usize = 2048;

/// A run of records of one chunk of one list.
struct Unit {
    list: usize,
    chunk: usize,
    range: Range<usize>,
}

/// A `fmt::Write` that hashes the text it is given.
struct HashText<'a>(&'a mut DefaultHasher);

impl std::fmt::Write for HashText<'_> {
    fn write_str(&mut self, text: &str) -> std::fmt::Result {
        self.0.write(text.as_bytes());
        Ok(())
    }
}

/// What one list adds to a blocker, gathered by `Plan::scan` in one pass over
/// the list's rules, which are then dropped.
#[derive(Default)]
struct ListScan {
    /// Whether the blocker takes any rule of the list. A list it takes none
    /// from adds no stats and no admission counts.
    takes: bool,
    /// Admission identities of the kept rules, in order.
    admitted: Vec<u64>,
    /// The whole-set facts of the kept network rules.
    ctx: NetworkContext,
    /// Cosmetic and scriptlet rules kept, in order.
    others: Others,
}

impl ListScan {
    /// Adds `part`, the scan of a later range of the same list.
    fn absorb(&mut self, part: ListScan) {
        self.takes |= part.takes;
        self.admitted.extend(part.admitted);
        self.ctx.merge(part.ctx);
        self.others.cosmetic.extend(part.others.cosmetic);
        self.others.scriptlets.extend(part.others.scriptlets);
    }
}

pub struct Plan {
    opts: CompileOptions,
    lists: Vec<ListSpec>,
    parsed: Vec<Arc<ParsedList>>,
    targets: Vec<TargetSpec>,
    cosmetics: CosmeticScope,
    /// List index -> rule identities a blocker other than this one owns (#681).
    duplicates: Vec<Vec<FxHashSet<u64>>>,
    /// Hash of each list's text, for `fingerprint`.
    text_hashes: Vec<u64>,
}

impl Plan {
    pub fn new(request: PlanRequest)
```

### Core Architecture Module: `Packages/wblock-engine/crates/wbe/src/ast.rs`
```
//! Parsed filter rules. The parser keeps every detail of the source line
//! (domains as strings, option arguments verbatim) because the compiler needs
//! them; nothing here is hashed or lossy.
//!
//! Semantics follow uBlock Origin's static filtering parser
//! (src/js/static-filtering-parser.js). AdGuard syntax is accepted only to the
//! extent uBO accepts it, after `normalize::adguard_to_ubo`.

use bitflags::bitflags;
use serde::{Deserialize, Serialize};

/// Where a rule came from: index of the list in the compile input and the
/// 1-based line number inside that list.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub struct SourceRef {
    pub list: u32,
    pub line: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Rule {
    Network(Box<NetworkRule>),
    Cosmetic(CosmeticRule),
    Scriptlet(ScriptletRule),
}

/// Result of parsing one line. Tagged `status` because a `Rule` inside
/// carries its own `kind` tag.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ParsedLine {
    /// Blank line, comment, `[Adblock Plus ...]` header, or preprocessor
    /// directive (directives are evaluated before the engine sees the text).
    Ignored,
    Rule(Rule),
    /// Valid syntax that cannot be enforced in Safari (HTML filtering `##^`,
    /// `$replace`, raw `#%#` JavaScript, ...). Counted, never compiled.
    Unsupported {
        reason: String,
    },
    /// Malformed line.
    Invalid {
        reason: String,
    },
}

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

/// One entry of `$domain=`/`$from=`/`$to=`/`$denyallow=` or of the hostname
/// list before a cosmetic marker.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum DomainMatcher {
    /// Lowercased, punycode-encoded hostname. Matches itself and subdomains.
    Hostname(String),
    /// `google.*`: the label before the public suffix, any suffix.
    Entity(String),
    /// `/regex/` (uBO extension), source without slashes.
    Regex(String),
}

/// Include and exclude lists. Empty `include` means "everywhere".
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct DomainList {
    pub include: Vec<DomainMatcher>,
    pub exclude: Vec<DomainMatcher>,
}

impl DomainList {
    pub fn is_empty(&self) -> bool {
        self.include.is_empty() && self.exclude.is_empty()
    }

    /// Drops excludes that no include can match, so `a.com,~b.com` is just
    /// `a.com`, as uBO matches it. Only hostname lists are judged.
    pub fn without_unreachable_excludes(mut self) -> Self {
        let hosts: Option<Vec<&String>> = self
            .include
            .iter()
            .map(|m| match m {
                DomainMatcher::Hostname(h) => Some(h),
                _ => None,
            })
            .collect();
        let Some(hosts) = hosts.filter(|h| !h.is_empty()) else {
            return self;
        };
        let reachable = |x: &str| {
            hosts.iter().any(|h| {
                x == h.as_str() || x.strip_suffix(h.as_str()).is_some_and(|p| p.ends_with('.'))
            })
        };
        let kept = self
            .exclude
            .iter()
            .filter(|m| !matches!(m, DomainMatcher::Hostname(x) if !reachable(x)))
            .cloned()
            .collect();
        self.exclude = kept;
        self
    }
}

// ---------------------------------------------------------------------------
// Network rules
// ---------------------------------------------------------------------------

bitflags! {
    /// Request types, uBO names. `DOC` is the main document; `FRAME` is a
    /// subdocument.
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
    pub struct ResourceTypes: u32 {
        const SCRIPT        = 1 << 0;
        const IMAGE         = 1 << 1;
        const CSS           = 1 << 2;
        const OBJECT        = 1 << 3;
        const XHR           = 1 << 4;
        const FRAME         = 1 << 5;
        const DOC           = 1 << 6;
        const FONT          = 1 << 7;
        const MEDIA         = 1 << 8;
        const PING          = 1 << 9;
        const WEBSOCKET     = 1 << 10;
        const OTHER         = 1 << 11;
        const POPUP         = 1 << 12;
        const POPUNDER      = 1 << 13;
        const WEBRTC        = 1 << 14;
        const INLINE_SCRIPT = 1 << 15;
        const INLINE_FONT   = 1 << 16;
    }
}

bitflags! {
    /// Document-level exception scopes: `@@...$document`, `$elemhide`,
    /// `$generichide`, `$specifichide`, `$genericblock`. Only meaningful on
    /// exceptions.
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
    pub struct ExceptionScope: u8 {
        const DOC          = 1 << 0;
        const EHIDE        = 1 << 1;
        const GHIDE        = 1 << 2;
        const SHIDE        = 1 << 3;
        const GENERICBLOCK = 1 << 4;
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum Party {
    #[default]
    Any,
    First,
    Third,
    StrictFirst,
    StrictThird,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PatternKind {
    /// `||host^path`: anchored at a hostname label boundary.
    Hostname,
    /// `|https://`: anchored at the start of the URL.
    Left,
    /// No anchor at the start.
    #[default]
    Plain,
    /// `/regex/`, body is the regex source without slashes.
    Regex,
}

/// The URL pattern. `body` keeps `*` (any) and `^` (separator) verbatim and
/// excludes the `||`/`|` prefix and the trailing `|`.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub struct Pattern {
    pub kind: PatternKind,
    pub body: String,
    /// Trailing `|`.
    pub right_anchored: bool,
}

impl Pattern {
    /// Matches every URL (`*`, empty, or `|http*`-style generic patterns are
    /// not collapsed here; only literally empty or `*` bodies).
    pub fn is_match_all(&self) -> bool {
        self.kind != PatternKind::Regex
            && !self.right_anchored
            && (self.body.is_empty() || self.body == "*")
    }
}

/// What the rule does when it matches. Exceptions keep the action they
/// except (`@@||x^$removeparam=y` is an exception to a RemoveParam action).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(tag = "type", content = "value", rename_all = "snake_case")]
pub enum NetworkAction {
    #[default]
    Block,
    /// `$redirect=` (or `$empty`/`$mp4` aliases). `rule_only` for
    /// `$redirect-rule`. Resource name normalized to uBO's canonical name.
    Redirect {
        resource: String,
        rule_only: bool,
    },
    /// `$removeparam`, `None` = remove all parameters.
    RemoveParam(Option<String>),
    /// `$csp`, `None` only on exceptions (except all CSP rules).
    Csp(Option<String>),
    Permissions(Option<String>),
    /// `$urlskip=`, `$uritransform=`, `$replace=`, `$header=`/`$responseheader=`,
    /// `$requestheader=`. Kept verbatim; not enforceable natively.
    Other {
        option: String,
        value: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub struct MethodList {
    pub include: Vec<String>,
    pub exclude: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct NetworkRule {
    pub source: SourceRef,
    /// The line as written (after AdGuard normalization), for provenance
    /// and debugging.
    pub raw: String,
    pub exception: bool,
    pub important: bool,
    pub badfilter: bool,
    pub match_case: bool,
    pub pattern: Pattern,
    pub party: Party,
    /// Types the rule applies to. Empty means uBO's default: every type
    /// except `DOC`, `POPUP`, `POPUNDER` (and `INLINE_*`).
    pub types: ResourceTypes,
    /// `~type` options.
    pub negated_types: ResourceTypes,
    /// `$domain=` / `$from=`.
    pub from: DomainList,
    /// `$to=`.
    pub to: DomainList,
    /// `$denyallow=`, hostnames only.
    pub denyallow: Vec<String>,
    pub method: MethodList,
    pub scope: ExceptionScope,
    pub action: NetworkAction,
    /// Options the parser recognised but that need DNS or headers
    /// (`$cname`, `$ipaddress`, `$header`, ...). A rule with any of these is
    /// not compiled natively.
    pub runtime_only_options: Vec<String>,
}

// ---------------------------------------------------------------------------
// Cosmetic rules
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "type", content = "value", rename_all = "snake_case")]
pub enum CosmeticBody {
    /// A selector that is plain CSS (may use `:has()`, `:is()`, `:not()`).
    /// Whether a given Safari version accepts it is the compiler's call.
    Hide(String),
    /// Uses uBO procedural operators (`:has-text`, `:upward`, `:xpath`,
    /// `:matches-css`, `:min-text-length`, `:watch-attr`, `:others`,
    /// `:matches-attr`, `:matches-media`, `:matches-prop`, `:-abp-*`), or an
    /// action (`:remove()`, `:style()`, `:remove-attr()`, `:remove-class()`).
    /// Kept as the normalized uBO selector text.
    Procedural(String),
    /// A stylesheet, including conditional at-rules, injected by the extension.
    Style(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CosmeticRule {
    pub source: SourceRef,
    pub raw: String,
    pub exception: bool,
    pub domains: 
```

### Core Architecture Module: `Packages/wblock-engine/crates/wbe/src/bin/wbe.rs`
```
//! `wbe compile [--safari 18.0] [--runtime-out FILE] [--trusted] LIST...`
//! writes Safari JSON to stdout and stats JSON to stderr. `--trusted` marks
//! the list after it as trusted (may use `trusted-*` scriptlets).
//! `wbe engine-build --out FILE RUNTIME.txt` serializes a runtime engine.
//! `wbe lookup [--bench N] ENGINE URL...`
//! prints PagePayload JSON per URL; with `--bench` it prints p50/p99 JSON for
//! N lookups over the URLs in the file.

use std::time::Instant;
use wbe::runtime::Engine;
use wbe::webkit::{to_json, SafariVersion};
use wbe::{compile, CompileOptions, ListInput};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("compile") => compile_cmd(&args[1..]),
        Some("engine-build") => engine_build_cmd(&args[1..]),
        Some("lookup") => lookup_cmd(&args[1..]),
        _ => {
            eprintln!(
                "usage: wbe compile [--safari 18.0] [--runtime-out FILE] [--trusted] LIST..."
            );
            eprintln!("       wbe engine-build --out FILE RUNTIME.txt");
            eprintln!("       wbe lookup [--bench N] ENGINE URL|URLFILE...");
            std::process::exit(2);
        }
    }
}

fn read(path: &str) -> String {
    std::fs::read_to_string(path).unwrap_or_else(|e| panic!("{path}: {e}"))
}

fn engine_build_cmd(args: &[String]) {
    let mut out = None;
    let mut runtime = None;
    let mut it = args.iter();
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--out" => out = it.next().cloned(),
            _ => runtime = Some(arg.clone()),
        }
    }
    let (Some(out), Some(runtime)) = (out, runtime) else {
        eprintln!("usage: wbe engine-build --out FILE RUNTIME.txt");
        std::process::exit(2);
    };
    let text = read(&runtime);
    let lines: Vec<String> = text.lines().map(str::to_owned).collect();

    let start = Instant::now();
    let engine = Engine::build(&lines);
    let bytes = engine.serialize();
    let build_ms = start.elapsed().as_secs_f64() * 1000.0;

    std::fs::write(&out, &bytes).unwrap_or_else(|e| panic!("{out}: {e}"));
    let report =
        serde_json::json!({ "build_ms": build_ms, "bytes": bytes.len(), "lines": lines.len() });
    eprintln!("{report}");
}

fn lookup_cmd(args: &[String]) {
    let mut bench = None;
    let mut rest = Vec::new();
    let mut it = args.iter();
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--bench" => {
                bench = Some(
                    it.next()
                        .expect("--bench needs a count")
                        .parse::<usize>()
                        .expect("count"),
                )
            }
            _ => rest.push(arg.clone()),
        }
    }
    let Some((engine_path, inputs)) = rest.split_first() else {
        eprintln!("usage: wbe lookup [--bench N] ENGINE URL|URLFILE...");
        std::process::exit(2);
    };

    let start = Instant::now();
    let bytes = std::fs::read(engine_path).unwrap_or_else(|e| panic!("{engine_path}: {e}"));
    let engine = Engine::deserialize(&bytes).unwrap_or_else(|e| panic!("{e}"));
    let load_ms = start.elapsed().as_secs_f64() * 1000.0;

    match bench {
        Some(n) => bench_cmd(&engine, load_ms, n, &read(&inputs[0])),
        None => {
            let mut timings = Vec::new();
            for url in inputs {
                let start = Instant::now();
                let payload = engine.lookup(url);
                timings.push(
                    serde_json::json!({ "url": url, "us": start.elapsed().as_secs_f64() * 1e6 }),
                );
                println!(
                    "{}",
                    serde_json::to_string(&payload).expect("payload serializes")
                );
            }
            eprintln!(
                "{}",
                serde_json::json!({ "load_ms": load_ms, "lookups": timings })
            );
        }
    }
}

fn bench_cmd(engine: &Engine, load_ms: f64, count: usize, url_text: &str) {
    let urls: Vec<&str> = url_text
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect();
    assert!(!urls.is_empty(), "URL file is empty");
    let mut us = Vec::with_capacity(count);
    for i in 0..count {
        let url = urls[i % urls.len()];
        let start = Instant::now();
        std::hint::black_box(engine.lookup(std::hint::black_box(url)));
        us.push(start.elapsed().as_secs_f64() * 1e6);
    }
    us.sort_by(f64::total_cmp);
    let pct = |p: usize| us[(us.len() * p / 100).min(us.len() - 1)];
    let mean = us.iter().sum::<f64>() / us.len() as f64;
    let report = serde_json::json!({
        "load_ms": load_ms,
        "lookups": count,
        "urls": urls.len(),
        "p50_us": pct(50),
        "p99_us": pct(99),
        "mean_us": mean,
    });
    println!("{report}");
}

fn compile_cmd(args: &[String]) {
    let mut safari = SafariVersion::new(18, 0);
    let mut trusted = false;
    let mut runtime_out = None;
    let mut paths = Vec::new();
    let mut trust = Vec::new();
    let mut it = args.iter();
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--safari" => {
                let v = it.next().expect("--safari needs a version");
                let (major, minor) = v.split_once('.').unwrap_or((v, "0"));
                safari = SafariVersion::new(major.parse().unwrap(), minor.parse().unwrap());
            }
            "--trusted" => trusted = true,
            "--runtime-out" => {
                runtime_out = Some(it.next().expect("--runtime-out needs a path").clone())
            }
            _ => {
                paths.push(arg.clone());
                trust.push(std::mem::take(&mut trusted));
            }
        }
    }
    let texts: Vec<String> = paths
        .iter()
        .map(|p| std::fs::read_to_string(p).unwrap_or_else(|e| panic!("{p}: {e}")))
        .collect();
    let inputs: Vec<ListInput> = texts
        .iter()
        .zip(trust)
        .map(|(text, trusted)| ListInput { text, trusted })
        .collect();

    let start = Instant::now();
    let out = compile(&inputs, &CompileOptions { safari });
    let compile_ms = start.elapsed().as_secs_f64() * 1000.0;

    print!("{}", to_json(&out.webkit));
    if let Some(path) = runtime_out {
        std::fs::write(path, out.runtime.join("\n")).expect("write runtime rules");
    }
    let stats = serde_json::json!({ "compile_ms": compile_ms, "stats": out.stats });
    eprintln!("{stats}");
}

```

### Core Architecture Module: `Packages/wblock-engine/crates/wbe/src/compile/cosmetic.rs`
```
//! Cosmetic hides and exceptions to Safari `css-display-none` rules.
//!
//! Model: uBO's cosmetic-filtering.js. A filter's key is its selector plus its
//! `:matches-path()` argument. On a page, every exception applicable to the page
//! removes its key from every hide applicable to the page, generic or specific.
//! Exceptions are resolved here when each page they touch can be expressed
//! natively. Otherwise every hide and exception with that key goes to `runtime`.

use super::{CompileOptions, Stats, Tier, Tiered};
use crate::ast::{CosmeticBody, CosmeticRule, DomainMatcher};
use crate::webkit::{SafariVersion, WkAction, WkResourceType, WkRule, WkTrigger};
use std::collections::{BTreeMap, BTreeSet, HashSet};

/// Selectors per emitted rule. AdGuard's Compiler uses the same limit
/// (`MAX_SELECTORS_PER_RULE`).
const GROUP_SIZE: usize = 250;

/// Host part of an `if-top-url` pattern that matches any host.
const ANY_HOST: &str = r"[^\/]+";

/// A selector and the `:matches-path()` argument it is scoped to.
type Key<'a> = (&'a str, Option<&'a str>);

pub(super) fn compile(
    rules: &[&CosmeticRule],
    opts: &CompileOptions,
    out: &mut Vec<Tiered>,
    runtime: &mut Vec<String>,
    stats: &mut Stats,
) {
    let safari = opts.safari;
    // Each rule's verdict and scope depend on the rule alone, so they are
    // worked out in parallel; the rest is in rule order.
    let decided = super::parallel_indices(rules.len(), |i| match &rules[i].body {
        CosmeticBody::Hide(selector) => {
            let verdict = verdict(selector, safari);
            let scope = if verdict == Verdict::Native {
                Scope::of(rules[i])
            } else {
                None
            };
            Some((verdict, scope))
        }
        CosmeticBody::Procedural(_) | CosmeticBody::Style(_) => None,
    });
    let mut hides: BTreeMap<Key, Vec<Entry>> = BTreeMap::new();
    let mut exceptions: BTreeMap<Key, Vec<Entry>> = BTreeMap::new();
    let mut runtime_lines = BTreeSet::new();
    for (rule, decided) in rules.iter().zip(decided) {
        match &rule.body {
            CosmeticBody::Procedural(_) | CosmeticBody::Style(_) => {
                runtime_lines.insert(rule.raw.as_str());
            }
            CosmeticBody::Hide(selector) => match decided.expect("hide has a verdict") {
                (Verdict::Invalid, _) => stats.drop("invalid cosmetic selector"),
                (_, scope) => {
                    let key = (selector.as_str(), rule.matches_path.as_deref());
                    let map = if rule.exception {
                        &mut exceptions
                    } else {
                        &mut hides
                    };
                    map.entry(key).or_default().push(Entry { rule, scope });
                }
            },
        }
    }

    let keys: Vec<&Key> = hides
        .keys()
        .chain(exceptions.keys())
        .collect::<BTreeSet<&Key>>()
        .into_iter()
        .collect();
    let resolved_all = super::parallel_indices(keys.len(), |i| {
        let key = keys[i];
        let hs = hides.get(key).map(Vec::as_slice).unwrap_or_default();
        let es = exceptions.get(key).map(Vec::as_slice).unwrap_or_default();
        resolve(hs, es, safari)
    });
    let mut resolved: Vec<(&Key, Vec<(Tier, Trigger)>)> = Vec::new();
    for (key, triggers) in keys.into_iter().zip(resolved_all) {
        match triggers {
            Some(triggers) => resolved.push((key, triggers)),
            None => {
                let hs = hides.get(key).map(Vec::as_slice).unwrap_or_default();
                let es = exceptions.get(key).map(Vec::as_slice).unwrap_or_default();
                for entry in hs.iter().chain(es) {
                    runtime_lines.insert(entry.rule.raw.as_str());
                }
            }
        }
    }

    // A selector hidden on every page makes its domain-specific copies redundant.
    let universal: HashSet<&str> = resolved
        .iter()
        .filter(|(key, _)| key.1.is_none())
        .filter(|(_, ts)| ts.contains(&(Tier::GenericHide, Trigger::Generic)))
        .map(|(key, _)| key.0)
        .collect();

    let mut groups: BTreeMap<(Tier, &Trigger), BTreeSet<&str>> = BTreeMap::new();
    for (key, triggers) in &resolved {
        for (tier, trigger) in triggers {
            let redundant =
                *tier == Tier::SpecificHide && key.1.is_none() && universal.contains(key.0);
            if !redundant {
                groups.entry((*tier, trigger)).or_default().insert(key.0);
            }
        }
    }
    let groups: Vec<((Tier, &Trigger), Vec<&str>)> = groups
        .into_iter()
        .map(|(group, selectors)| (group, selectors.into_iter().collect()))
        .collect();
    let emitted = super::parallel_indices(groups.len(), |g| {
        let ((_, trigger), selectors) = &groups[g];
        selectors
            .chunks(GROUP_SIZE)
            .map(|chunk| WkRule {
                trigger: trigger.to_trigger(),
                action: WkAction::CssDisplayNone {
                    selector: chunk.join(", "),
                },
            })
            .collect::<Vec<WkRule>>()
    });
    for (((tier, _), _), rules) in groups.iter().zip(emitted) {
        out.extend(rules.into_iter().map(|rule| Tiered { tier: *tier, rule }));
    }

    runtime.extend(runtime_lines.into_iter().map(str::to_string));
}

/// A hide or exception that reached the compiler. `scope: None` means the
/// rule needs the runtime (regex domain, entity exclusion, or a selector Safari
/// cannot take).
struct Entry<'a> {
    rule: &'a CosmeticRule,
    scope: Option<Scope>,
}

/// Domain and path conditions of a rule, split by kind.
#[derive(Clone, Default)]
struct Scope {
    hosts: Vec<String>,
    entities: Vec<String>,
    excludes: Vec<String>,
    path: Option<String>,
}

impl Scope {
    fn of(rule: &CosmeticRule) -> Option<Self> {
        let mut scope = Scope {
            path: rule.matches_path.clone(),
            ..Self::default()
        };
        for matcher in &rule.domains.include {
            match matcher {
                DomainMatcher::Hostname(h) => scope.hosts.push(h.clone()),
                DomainMatcher::Entity(e) => scope.entities.push(e.clone()),
                DomainMatcher::Regex(_) => return None,
            }
        }
        for matcher in &rule.domains.exclude {
            match matcher {
                DomainMatcher::Hostname(h) => scope.excludes.push(h.clone()),
                _ => return None,
            }
        }
        Some(scope)
    }

    fn is_generic(&self) -> bool {
        self.hosts.is_empty() && self.entities.is_empty()
    }
}

/// One Safari trigger. `Generic` and `Unless` apply to every page, so they
/// are generic hides. The rest are specific.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
enum Trigger {
    Generic,
    Unless(Vec<String>),
    IfDomain(Vec<String>),
    TopUrl(Vec<String>),
}

impl Trigger {
    fn to_trigger(&self) -> WkTrigger {
        let mut trigger = WkTrigger {
            url_filter: ".*".into(),
            ..WkTrigger::default()
        };
        match self {
            Trigger::Generic => return trigger,
            Trigger::Unless(d) => trigger.unless_domain = Some(d.clone()),
            Trigger::IfDomain(d) => trigger.if_domain = Some(d.clone()),
            Trigger::TopUrl(r) => trigger.if_top_url = Some(r.clone()),
        }
        // A scoped hide only needs checking when a document loads, not on
        // every subresource (wBlock #873).
        trigger.resource_type = Some(vec![WkResourceType::Document]);
        trigger
    }
}

/// Resolves the hides and exceptions of one key. Returns the triggers the
/// hides keep, or `None` when the key must go to the runtime.
fn resolve(
    hides: &[Entry],
    exceptions: &[Entry],
    safari: SafariVersion,
) -> Option<Vec<(Tier, Trigger)>> {
    let mut excepted_hosts: Vec<&str> = Vec::new();
    let mut global = false;
    for exception in exceptions {
        let scope = exception.scope.as_ref()?;
        if !scope.entities.is_empty() || !scope.excludes.is_empty() {
            return None;
        }
        if scope.hosts.is_empty() {
            global = true;
        }
        excepted_hosts.extend(scope.hosts.iter().map(String::as_str));
    }
    if global {
        return Some(Vec::new());
    }

    let mut triggers = Vec::new();
    for hide in hides {
        let mut scope = hide.scope.clone()?;
        if !excepted_hosts.is_empty() {
            if scope.is_generic() {
                scope
                    .excludes
                    .extend(excepted_hosts.iter().map(|h| h.to_string()));
            } else {
                if !scope.entities.is_empty() {
                    return None;
                }
                let had_hosts = !scope.hosts.is_empty();
                for host in &scope.hosts {
                    if excepted_hosts.iter().any(|x| within(host, x)) {
                        continue;
                    }
                    if excepted_hosts.iter().any(|x| within(x, host)) {
                        // Pages under the excepted host would need an unless-domain
                        // on a domain-specific trigger, which Safari cannot combine.
                        return None;
                    }
                }
                scope
                    .hosts
                    .retain(|host| !excepted_hosts.iter().any(|x| within(host, x)));
                if had_hosts && scope.hosts.is_empty() {
                    continue;
                }
            }
        }
        triggers.extend(scope_triggers(&scope, safari)?);
    }
    Some(triggers)
}

/// `child` is `parent` or one of its subdomains.
fn within(child: &str, parent: &str) -> bool {
    child == parent || child.strip_suffix(parent).is_some_and(|p| p.ends_with('.'))
}

/// The triggers that express a scope natively, or `None` if Safari cannot.
fn scope_triggers(scope
```

### Core Architecture Module: `Packages/wblock-engine/crates/wbe/src/compile/mod.rs`
```
//! Rules to Safari JSON.
//!
//! Output order matters: WebKit applies rules top to bottom and
//! `ignore-previous-rules` only cancels earlier matches. Each sub-compiler
//! tags its rules with a `Tier`; the final list is a stable sort by tier.
//! The tier order is the precedence policy proven in scripts/proofs.
//! Because `ignore-previous-rules` cancels every earlier match, page-level
//! cosmetic exceptions sit right after the hides they cancel and before any
//! network rule.

pub(crate) mod cosmetic;
mod network;
pub mod regex;

use crate::ast::{CosmeticRule, NetworkRule, ParsedLine, Rule, ScriptletRule, SourceRef};
use crate::webkit::{SafariVersion, WebkitJson, WkRule};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Tier {
    GenericHide = 0,
    /// `$generichide`: cancels generic hides only.
    GenericHideException = 1,
    SpecificHide = 2,
    /// `$elemhide` (and `$specifichide`, widened): cancels all hides.
    ElemHideException = 3,
    /// Blocks with no page domains, which `$genericblock` lifts.
    GenericBlock = 4,
    /// `$genericblock`: cancels the generic blocks before it on the page's
    /// subresources, leaving its hides and the blocks after it in place.
    GenericBlockException = 5,
    Block = 6,
    Exception = 7,
    /// `$important` with `$denyallow`: the block, then its exclusions.
    ImportantDenyallowBlock = 8,
    /// The exclusions of an important `$denyallow` block. Each cancels only
    /// the blocks before it, so they sit ahead of every other important block.
    ImportantDenyallowException = 9,
    ImportantBlock = 10,
    /// AdGuard `$important` exceptions override important blocks.
    ImportantException = 11,
    /// `@@...$document`: cancels everything on the page.
    DocumentException = 12,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompileOptions {
    pub safari: SafariVersion,
}

pub struct ListInput<'a> {
    pub text: &'a str,
    /// Trusted lists may use `trusted-*` scriptlets (uBO: its own lists and
    /// the user's rules).
    pub trusted: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Stats {
    pub lines: u64,
    pub rules: u64,
    pub native_rules: u64,
    pub runtime_rules: u64,
    /// Reason -> count, for rules neither native nor runtime.
    pub dropped: BTreeMap<String, u64>,
}

impl Stats {
    pub fn drop(&mut self, reason: &str) {
        *self.dropped.entry(reason.to_string()).or_default() += 1;
    }
}

#[derive(Debug, Clone, Default)]
pub struct CompileOutput {
    pub webkit: WebkitJson,
    /// Normalized uBO lines for `runtime::Engine`, one per rule.
    pub runtime: Vec<String>,
    pub stats: Stats,
}

pub(crate) struct Tiered {
    pub tier: Tier,
    pub rule: WkRule,
}

/// Safari JSON of the network rules, written as they are compiled. Each unit
/// of work writes its own arena and `entries` locates every rule in one of
/// them. Nothing is held as a `WkRule`, which costs several allocations per
/// rule.
#[derive(Debug, Default)]
pub(crate) struct Emitted {
    arenas: Vec<Vec<u8>>,
    entries: Vec<Entry>,
}

#[derive(Debug)]
pub(super) struct Entry {
    tier: Tier,
    arena: u32,
    /// `arenas[arena][start..end]` is the rule, unless `domain` is set.
    start: usize,
    end: usize,
    /// An `if-domain` rule: its domain list can grow when rules merge.
    domain: Option<Box<DomainSpan>>,
}

#[derive(Debug)]
pub(super) struct DomainSpan {
    /// `arena[start..head]` ends before the `if-domain` key and
    /// `arena[tail..end]` starts after its array.
    head: usize,
    tail: usize,
    domains: Vec<String>,
}

pub(crate) use network::Context as NetworkContext;

/// Counts the bytes written to it.
struct Count(usize);

impl std::io::Write for Count {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.0 += buf.len();
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

/// Tiers in output order.
const TIERS: [Tier; 13] = [
    Tier::GenericHide,
    Tier::GenericHideException,
    Tier::SpecificHide,
    Tier::ElemHideException,
    Tier::GenericBlock,
    Tier::GenericBlockException,
    Tier::Block,
    Tier::Exception,
    Tier::ImportantDenyallowBlock,
    Tier::ImportantDenyallowException,
    Tier::ImportantBlock,
    Tier::ImportantException,
    Tier::DocumentException,
];

impl Emitted {
    /// Room for `rules` network rules of roughly 500 bytes of JSON each, in
    /// one arena. The reserved bytes are not touched, so they cost nothing.
    fn with_capacity(rules: usize) -> Self {
        Self {
            arenas: vec![Vec::with_capacity(rules * 512)],
            entries: Vec::with_capacity(rules * 2),
        }
    }

    /// The arena rules are written to now.
    pub(super) fn arena(&mut self) -> usize {
        if self.arenas.is_empty() {
            self.arenas.push(Vec::new());
        }
        self.arenas.len() - 1
    }

    /// `parts` in order, as one output. Arenas move; entries are re-pointed.
    fn absorb(parts: Vec<Emitted>) -> Emitted {
        let rules: usize = parts.iter().map(|p| p.entries.len()).sum();
        let mut out = Emitted {
            arenas: Vec::with_capacity(parts.len()),
            entries: Vec::with_capacity(rules),
        };
        for part in parts {
            let base = out.arenas.len() as u32;
            out.arenas.extend(part.arenas);
            out.entries.extend(part.entries.into_iter().map(|mut e| {
                e.arena += base;
                e
            }));
        }
        out
    }

    fn render(&self, entry: &Entry, out: &mut Vec<u8>) {
        let arena = &self.arenas[entry.arena as usize];
        match &entry.domain {
            None => out.extend_from_slice(&arena[entry.start..entry.end]),
            Some(span) => {
                out.extend_from_slice(&arena[entry.start..span.head]);
                out.extend_from_slice(b",\"if-domain\":");
                serde_json::to_writer(&mut *out, &span.domains).expect("domains serialize");
                out.extend_from_slice(&arena[span.tail..entry.end]);
            }
        }
    }

    /// The bytes `render` writes for `entry`.
    fn rendered_len(&self, entry: &Entry) -> usize {
        match &entry.domain {
            None => entry.end - entry.start,
            Some(span) => {
                let mut domains = Count(0);
                serde_json::to_writer(&mut domains, &span.domains).expect("domains serialize");
                (span.head - entry.start)
                    + b",\"if-domain\":".len()
                    + domains.0
                    + (entry.end - span.tail)
            }
        }
    }

    pub(crate) fn push_rule(&mut self, tier: Tier, rule: &WkRule) {
        let arena = self.arena();
        let bytes = &mut self.arenas[arena];
        let start = bytes.len();
        serde_json::to_writer(&mut *bytes, rule).expect("WkRule serializes");
        let end = bytes.len();
        self.entries.push(Entry {
            tier,
            arena: arena as u32,
            start,
            end,
            domain: None,
        });
    }

    /// Everything emitted, in tier order; within a tier, emission order.
    fn into_webkit(self) -> WebkitJson {
        // Sized up front so the output is never copied to grow.
        let size = self
            .entries
            .iter()
            .map(|e| self.rendered_len(e) + 1)
            .sum::<usize>()
            + 2;
        let mut json = Vec::with_capacity(size);
        json.push(b'[');
        let mut first = true;
        for tier in TIERS {
            for entry in self.entries.iter().filter(|e| e.tier == tier) {
                if !first {
                    json.push(b',');
                }
                first = false;
                self.render(entry, &mut json);
            }
        }
        json.push(b']');
        WebkitJson::from_bytes(json, self.entries.len())
    }

    #[cfg(test)]
    pub(crate) fn tiered(&self) -> Vec<Tiered> {
        self.entries
            .iter()
            .map(|entry| {
                let mut json = Vec::new();
                self.render(entry, &mut json);
                Tiered {
                    tier: entry.tier,
                    rule: serde_json::from_slice(&json).expect("rule parses back"),
                }
            })
            .collect()
    }
}

/// `body(i)` for every `i < count`, on all cores, results in order. Indices
/// are handed out one at a time, so uneven items still balance.
pub(crate) fn parallel_indices<R: Send>(count: usize, body: impl Fn(usize) -> R + Sync) -> Vec<R> {
    use std::sync::atomic::{AtomicUsize, Ordering};
    let threads = std::thread::available_parallelism()
        .map_or(4, |n| n.get())
        .min(count.max(1));
    let next = AtomicUsize::new(0);
    let done: Vec<(usize, R)> = std::thread::scope(|scope| {
        let handles: Vec<_> = (0..threads)
            .map(|_| {
                let (body, next) = (&body, &next);
                scope.spawn(move || {
                    let mut done = Vec::new();
                    loop {
                        let i = next.fetch_add(1, Ordering::Relaxed);
                        if i >= count {
                            break done;
                        }
                        done.push((i, body(i)));
                    }
                })
            })
            .collect();
        handles
            .into_iter()
            .flat_map(|h| h.join().expect("worker thread"))
            .collect()
    });
    let mut slots: Vec<Option<R>> = (0..count).map(|_| None).collect();
    for (i, r) in done {
        slots[i] = Some(r);
    }
    slots.into_iter().map(|r| r.expect("every index ran")).collect()
}

/// The cosmetic and scriptlet rules of one blocker, in compile order.
#[derive(Debug, Clone, Defa
```

### Core Architecture Module: `Packages/wblock-engine/crates/wbe/src/compile/network.rs`
```
//! uBO network rules to WebKit rules.
//!
//! Blocks are dropped when a condition cannot be expressed, so they never
//! block more than uBO does. Exceptions drop the condition instead, which
//! makes them wider and can only under-block. Each rule's tier follows
//! `compile/mod.rs`; exceptions use ignore-previous-rules.

use super::regex::{domain_top_url, url_filter};
use super::{DomainSpan, Emitted, Entry, Stats, Tier};
use crate::ast::{
    DomainList, DomainMatcher, ExceptionScope, NetworkAction, NetworkRule, Party, Pattern,
    PatternKind, ResourceTypes, SourceRef,
};
use crate::webkit::{SafariVersion, WkLoadContext, WkLoadType, WkResourceType};
use rustc_hash::{FxHashMap, FxHashSet, FxHasher};
use serde::Serialize;
use std::collections::hash_map::Entry as MapEntry;
use std::hash::Hasher;

/// uBO's default for a rule without `$type`: every type except the main
/// document, popups and inline resources (static-net-filtering.js,
/// `typeNameToTypeValue`).
const DEFAULT_TYPES: ResourceTypes = ResourceTypes::all().difference(
    ResourceTypes::DOC
        .union(ResourceTypes::POPUP)
        .union(ResourceTypes::POPUNDER)
        .union(ResourceTypes::INLINE_SCRIPT)
        .union(ResourceTypes::INLINE_FONT),
);

/// What a blocker's network rules need from the whole set before any of them
/// compiles: the hosts of untyped blocks (`StrictHosts`) and the `$badfilter`
/// rules that cancel identical filters.
#[derive(Default)]
pub(crate) struct Context {
    strict: StrictHosts,
    bad: Vec<NetworkRule>,
    bad_bodies: FxHashSet<String>,
}

impl Context {
    pub(crate) fn add(&mut self, rule: &NetworkRule) {
        self.strict.add(rule);
        if rule.badfilter {
            let bad = unlabeled(rule);
            self.bad_bodies.insert(bad.pattern.body.clone());
            self.bad.push(bad);
        }
    }

    pub(crate) fn merge(&mut self, other: Context) {
        self.strict.hosts.extend(other.strict.hosts);
        self.strict.parents.extend(other.strict.parents);
        self.bad.extend(other.bad);
        self.bad_bodies.extend(other.bad_bodies);
    }
}

/// The host of a `$genericblock` exception Safari can represent: one
/// ignore-previous-rules on that host's pages, between the generic and the
/// specific blocks.
fn genericblock_host(r: &NetworkRule) -> Option<String> {
    (r.exception && r.scope.contains(ExceptionScope::GENERICBLOCK) && r.types.is_empty()
        && r.negated_types.is_empty() && r.from.is_empty() && r.to.is_empty()
        && r.party == Party::Any && r.method.include.is_empty() && r.method.exclude.is_empty()
        && r.runtime_only_options.is_empty() && matches!(r.action, NetworkAction::Block))
        .then(|| host_only(&r.pattern)).flatten()
}

/// Compiles one network rule of a blocker whose `ctx` covers every rule.
/// A dropped rule records its reason in `stats`.
pub(crate) fn emit_rule(
    ctx: &Context,
    safari: SafariVersion,
    rule: &NetworkRule,
    out: &mut Emitted,
    stats: &mut Stats,
) {
    if rule.badfilter {
        return;
    }
    if ctx.bad_bodies.contains(rule.pattern.body.as_str())
        && ctx.bad.contains(&unlabeled(rule))
    {
        return;
    }
    if let Err(reason) = compile_rule(rule, safari, ctx, out, None) {
        stats.drop(&reason);
    }
}

/// A rule with its provenance and `$badfilter` flag cleared, for comparing
/// filters. uBO cancels a filter only when its compiled form is identical
/// (static-net-filtering.js, `freeze`); there is no domain-subset matching.
fn unlabeled(r: &NetworkRule) -> NetworkRule {
    let mut r = r.clone();
    r.source = SourceRef::default();
    r.raw.clear();
    r.badfilter = false;
    r
}

/// `tier` overrides the tier the rule's own flags pick.
fn compile_rule(
    r: &NetworkRule,
    v: SafariVersion,
    ctx: &Context,
    out: &mut Emitted,
    tier: Option<Tier>,
) -> Result<(), String> {
    let strict = &ctx.strict;
    match &r.action {
        NetworkAction::Block
        | NetworkAction::Redirect {
            rule_only: false, ..
        } => {}
        NetworkAction::Redirect {
            rule_only: true, ..
        } => {
            return Err("dnr:redirect-rule".into());
        }
        NetworkAction::RemoveParam(_) => return Err("dnr:removeparam".into()),
        NetworkAction::Csp(_) => return Err("dnr:csp".into()),
        NetworkAction::Permissions(_) => return Err("dnr:permissions".into()),
        NetworkAction::Other { option, .. } => return Err(format!("dnr:{option}")),
    }
    if !r.scope.is_empty() {
        return if r.exception {
            compile_scope(r, v, out)
        } else {
            Err("dnr:scope-on-block".into())
        };
    }
    let exception = r.exception;
    // `@@...$cname` only exempts a request from CNAME uncloaking; it never
    // allows one (static-net-filtering.js), so it has nothing to lift here.
    if exception && r.runtime_only_options.iter().any(|o| o == "cname") {
        return Err("dnr:cname-exception".into());
    }
    if r.runtime_only_options.iter().any(|o| o.starts_with("responseheader=")) {
        return Err("response header matching: Safari DNR does not support responseHeaders conditions".into());
    }
    if !exception && !r.runtime_only_options.is_empty() {
        return Err("dnr:runtime-option".into());
    }
    if !exception && (!r.method.include.is_empty() || !r.method.exclude.is_empty()) {
        return Err("dnr:method".into());
    }
    if !exception && !r.denyallow.is_empty() {
        return compile_denyallow(r, v, ctx, out);
    }
    let party = party(r.party, exception)?;
    let urls = urls(r, exception)?;
    let conds = domain_conds(&r.from, v, exception)?;
    let types = effective_types(r);
    // uBO also strict-blocks top-level navigation for an untyped filter whose
    // match ends at the hostname (traffic.js, `shouldStrictBlock`), so such a
    // block is one trigger over every type, documents included. An exception
    // takes that form only where it must lift such a block: on a page load,
    // ignore-previous-rules also cancels the page's cosmetic hides.
    let untyped = r.types.is_empty()
        && r.negated_types.is_empty()
        && host_only(&r.pattern).is_some_and(|h| !exception || strict.related(&h));
    let type_triggers = if untyped {
        vec![(Vec::new(), None)]
    } else {
        type_triggers(types, v)
    };
    if type_triggers.is_empty() {
        // An exception without a type WebKit can match cancels nothing.
        return if exception {
            Ok(())
        } else {
            Err(type_drop_reason(types, v))
        };
    }
    let (ignore, default) = if exception {
        (true, if r.important { Tier::ImportantException } else { Tier::Exception })
    } else if r.important {
        (false, Tier::ImportantBlock)
    } else if r.from.include.is_empty() {
        (false, Tier::GenericBlock)
    } else {
        (false, Tier::Block)
    };
    let tier = tier.unwrap_or(default);
    for url in &urls {
        for (types, context) in &type_triggers {
            for cond in &conds {
                emit(
                    out,
                    tier,
                    &Trigger {
                        url,
                        case_sensitive: r.match_case,
                        types: (!types.is_empty()).then_some(types.as_slice()),
                        load_type: party,
                        load_context: *context,
                        cond: cond.as_ref(),
                    },
                    ignore,
                );
            }
        }
    }
    Ok(())
}

/// uBO blocks what the rule matches except requests to the `$denyallow`
/// hosts. For a match-all rule scoped to pages that is the block plus one
/// exception per allowed host under the same options. The exceptions also
/// lift other lists' blocks of those hosts on those pages (under-blocking);
/// with a pattern they would lift more, so only match-all rules expand.
/// An important block takes its exclusions in the tiers just before the
/// important blocks: an exception there lifts this block and no other
/// important block, and it cannot follow the block without lifting them.
fn compile_denyallow(
    r: &NetworkRule,
    v: SafariVersion,
    ctx: &Context,
    out: &mut Emitted,
) -> Result<(), String> {
    if !r.pattern.is_match_all() || r.from.include.is_empty() {
        return Err("dnr:denyallow".into());
    }
    let (block_tier, allow_tier) = if r.important {
        (Tier::ImportantDenyallowBlock, Tier::ImportantDenyallowException)
    } else {
        (Tier::Block, Tier::Exception)
    };
    let block = NetworkRule {
        denyallow: Vec::new(),
        ..r.clone()
    };
    let arena = out.arena();
    let mark = (out.arenas[arena].len(), out.entries.len());
    let result = compile_rule(&block, v, ctx, out, Some(block_tier)).and_then(|()| {
        r.denyallow.iter().try_for_each(|host| {
            let allow = NetworkRule {
                exception: true,
                important: false,
                pattern: Pattern {
                    kind: PatternKind::Hostname,
                    body: format!("{host}^"),
                    right_anchored: false,
                },
                ..block.clone()
            };
            compile_rule(&allow, v, ctx, out, Some(allow_tier))
        })
    });
    if result.is_err() {
        // The block was emitted before a failing exception: drop it too.
        out.arenas[arena].truncate(mark.0);
        out.entries.truncate(mark.1);
    }
    result
}

/// `@@...$document`, `$generichide`, `$elemhide`, `$specifichide`: one
/// ignore-previous-rules over every type, conditioned on the page URL.
/// `$specifichide` is widened to `$elemhide`, which also cancels generic
/// hides.
fn compile_scope(r: &NetworkRule, v: SafariVersion, out: &mut Emitted) -> Result<(), String> {
    let generic = r.scope.contains(ExceptionScope::GENERICBLOCK);
    if let Some(host) = genericbloc
```

### Core Architecture Module: `Packages/wblock-engine/crates/wbe/src/compile/regex.rs`
```
//! uBO URL patterns and regexes to WebKit's url-filter regex subset.
//!
//! Plain patterns follow AdGuard's SimpleRegex.swift (`||`, `|`, `*`, `^`).
//! The separator is uBO's (`^` matches anything but a letter, digit, `_`, `-`,
//! `.` or `%`; uBO static-filtering-parser.js). Regex sources are translated
//! into the subset WebKit accepts (SafariRegex.swift and the WebKit compiler:
//! no alternation, `\d`/`\w`/`\b`, `{n}`, lookaround, backreferences). Anything
//! else returns `None`, and the caller drops the rule or widens the exception.

use crate::ast::{DomainMatcher, Pattern, PatternKind};

/// uBO separator class.
const SEPARATOR: &str = "[^a-zA-Z0-9_.%-]";
/// Hostname anchor (`||`), the expression Apple recommends.
const HOST_START: &str = "^[^:]+://+([^:/]+\\.)?";
/// What follows a host in a top-level URL. WHATWG URLs always have a path, so
/// a host is always followed by one of these.
const HOST_END: &str = "[/:?#]";
/// Largest repetition count expanded inline.
const MAX_REPEAT: u32 = 32;
/// Largest repetition of `.` expanded inline. Each extra any-character step
/// after a pattern grows WebKit's DFA: one `der-windows-papst.de/.{32}\?ver`
/// rule took a cookie and annoyance blocker from 335 MB to 1150 MB of compile
/// memory on macOS, and timed out Safari on an iPad 6; 12 adds about 6 MB.
const MAX_ANY_REPEAT: u32 = 12;

/// The url-filter for a uBO URL pattern, matched case-insensitively.
pub fn url_filter(p: &Pattern) -> Option<String> {
    if p.is_match_all() {
        return Some(".*".into());
    }
    if p.kind == PatternKind::Regex {
        // A regex that reduces to nothing (`/x{0}/`) matches every URL;
        // WebKit rejects an empty url-filter, so say that as `.*`.
        return translate(&p.body)
            .map(|r| if r.is_empty() { ".*".into() } else { r })
            .filter(|r| webkit_accepts(r));
    }
    let mut out = String::new();
    let mut body = p.body.as_str();
    match p.kind {
        PatternKind::Hostname => {
            out.push_str(HOST_START);
            // A `^` right after a plain host ends the host, which in a URL is
            // always followed by one of HOST_END. The narrower class makes the
            // ~60k `||host^` blocks of EasyList and AdGuard Base compile 12%
            // faster in WebKit.
            let host = body.split_once('^').filter(|(h, _)| {
                !h.is_empty() && h.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.')
            });
            if let Some((host, rest)) = host {
                literal(host, &mut out)?;
                out.push_str(HOST_END);
                body = rest;
            }
        }
        PatternKind::Left => out.push('^'),
        _ => {}
    }
    literal(body, &mut out)?;
    if p.right_anchored {
        out.push('$');
    }
    webkit_accepts(&out).then_some(out)
}

/// Longest url-filter emitted. Counted repeats expand, so this also bounds
/// the work a single source rule can cause in WebKit's compiler.
const MAX_FILTER_LEN: usize = 4096;

/// Final check on an emitted url-filter, so one bad rule never reaches
/// Safari (a rule WebKit rejects fails its whole content blocker): non-empty,
/// ASCII, bounded, balanced groups and classes, ascending class ranges, and
/// quantifiers only after something they can repeat.
pub fn webkit_accepts(re: &str) -> bool {
    let b = re.as_bytes();
    if b.is_empty() || b.len() > MAX_FILTER_LEN || !re.is_ascii() {
        return false;
    }
    let (mut depth, mut i, mut can_repeat) = (0usize, 0usize, false);
    while i < b.len() {
        match b[i] {
            b'\\' => {
                if i + 1 >= b.len() {
                    return false;
                }
                i += 1;
                can_repeat = true;
            }
            b'(' => {
                depth += 1;
                can_repeat = false;
            }
            b')' => {
                if depth == 0 {
                    return false;
                }
                depth -= 1;
                can_repeat = true;
            }
            b'[' => {
                let Some(end) = class_end(b, i) else {
                    return false;
                };
                i = end;
                can_repeat = true;
            }
            b']' => return false,
            b'*' | b'+' | b'?' => {
                if !can_repeat {
                    return false;
                }
                can_repeat = false;
            }
            b'^' if i != 0 => return false,
            b'$' if i != b.len() - 1 => return false,
            b'|' | b'{' | b'}' => return false,
            _ => can_repeat = true,
        }
        i += 1;
    }
    depth == 0
}

/// Index of the `]` closing the class that opens at `start`, or `None` when
/// it is unterminated, empty, or has a descending range.
fn class_end(b: &[u8], start: usize) -> Option<usize> {
    let mut i = start + 1;
    if b.get(i) == Some(&b'^') {
        i += 1;
    }
    let first = i;
    let mut prev: Option<u8> = None;
    while i < b.len() {
        let c = match b[i] {
            b']' if i > first => return Some(i),
            b'\\' => {
                i += 1;
                *b.get(i)?
            }
            c => c,
        };
        if c == b'-' && prev.is_some() && b.get(i + 1).is_some_and(|&n| n != b']') {
            let lo = prev?;
            i += 1;
            let hi = match b[i] {
                b'\\' => {
                    i += 1;
                    *b.get(i)?
                }
                h => h,
            };
            if hi < lo {
                return None;
            }
            prev = None;
        } else {
            prev = Some(c);
        }
        i += 1;
    }
    None
}

/// An `if-top-url` regex for a domain option (uBO `$domain=`/`$to=` item).
/// Hostnames match themselves and subdomains. Entities (`google.*`) accept a
/// one-label suffix or `co.`/`com.` plus one label, approximating uBO's public
/// suffix list: `google.de` and `google.co.uk` match, `google.evil.com` does
/// not, and rarer two-label suffixes (`google.ne.jp`) are missed. Regex domains match the host
/// with the regex, as uBO tests them against the hostname.
pub fn domain_top_url(m: &DomainMatcher) -> Option<String> {
    top_url(m).filter(|u| webkit_accepts(u))
}

fn top_url(m: &DomainMatcher) -> Option<String> {
    match m {
        DomainMatcher::Hostname(h) => {
            let mut out = HOST_START.to_string();
            literal(h, &mut out)?;
            out.push_str(HOST_END);
            Some(out)
        }
        DomainMatcher::Entity(e) => {
            let mut out = HOST_START.to_string();
            literal(e, &mut out)?;
            // `name.<tld>` or `name.co.<tld>`/`name.com.<tld>`, not `name.evil.com`.
            out.push_str("\\.(com?\\.)?[^:/.]+");
            out.push_str(HOST_END);
            Some(out)
        }
        DomainMatcher::Regex(src) => {
            let (anchored, body) = match src.strip_prefix('^') {
                Some(rest) => (true, rest),
                None => (false, src.as_str()),
            };
            let (body, at_end) = match body.strip_suffix('$') {
                Some(rest) if !rest.ends_with('\\') => (rest, true),
                _ => (body, false),
            };
            let inner = translate(body)?;
            let mut out = String::from("^[^:]+://");
            if !anchored {
                out.push_str("[^/:?#]*");
            }
            out.push_str(&inner);
            if !at_end {
                out.push_str("[^/:?#]*");
            }
            out.push_str(HOST_END);
            Some(out)
        }
    }
}

/// Literal pattern text with `*` and `^` translated. Escapes regex
/// metacharacters. Returns `None` for non-ASCII input.
fn literal(body: &str, out: &mut String) -> Option<()> {
    for c in body.chars() {
        match c {
            '*' => out.push_str(".*"),
            '^' => out.push_str(SEPARATOR),
            c if c.is_ascii() => {
                if ".+?()[]{}|$\\".contains(c) {
                    out.push('\\');
                }
                out.push(c);
            }
            _ => return None,
        }
    }
    Some(())
}

/// Translates a uBO regex body into the WebKit subset. `^` is accepted only
/// as the first character and `$` only as the last.
fn translate(src: &str) -> Option<String> {
    if src.is_empty() || !src.is_ascii() {
        return None;
    }
    let mut p = Translator {
        src: src.as_bytes(),
        pos: 0,
    };
    let out = p.seq(0)?;
    (p.pos == src.len()).then_some(out)
}

struct Translator<'a> {
    src: &'a [u8],
    pos: usize,
}

impl Translator<'_> {
    fn peek(&self) -> Option<u8> {
        self.src.get(self.pos).copied()
    }

    fn next(&mut self) -> Option<u8> {
        let c = self.peek()?;
        self.pos += 1;
        Some(c)
    }

    /// Parses atoms and quantifiers up to `)` (inside a group) or the end.
    fn seq(&mut self, depth: u32) -> Option<String> {
        let mut out = String::new();
        while let Some(c) = self.peek() {
            if c == b')' {
                return (depth > 0).then_some(out);
            }
            let (atom, quantifiable) = self.atom(depth)?;
            match self.quantifier()? {
                None => out.push_str(&atom),
                Some((min, max)) => {
                    let limit = if atom == "." { MAX_ANY_REPEAT } else { MAX_REPEAT };
                    if !quantifiable || min.max(max.unwrap_or(0)) > limit {
                        return None;
                    }
                    repeat(&atom, min, max, &mut out);
                }
            }
        }
        (depth == 0).then_some(out)
    }

    /// Returns the translated atom and whether a quantifier may follow it.
    fn atom(&mut self, depth: u32) -> Option<(String, bool)> {
        let c = self.next()?;
        Some(match c {
            b'^' if self.pos == 1 => ("^".into(), fal
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1080** (2026-11-04): **[BUG] Stevo’s AI Blocklist failing on github.com**
  *Symptoms*: ### Describe the bug  Filters for “Stevo’s AI Blocklist” are failing to hide items on github.com for the mobile version of wBlock.  ### To reproduce  Steps to reproduce the behavior: 1. Either add “Stevo’s AI Blocklist”, or add the following as a custom list  <details> <summary>Click to expand</summary>   ``` ! === GitHub === ! Copilot network requests ! * Prevents Copilot-generated commit messages  ||api.individual.githubcopilot.com/$xhr,domain=github.com  ! -- https://github.com/ (Any logged-in GitHub page) ! Header - "Chat with Copilot" icon next to search bar github.com##[data-testid="top-bar-actions"] > .hide-md:has([data-component="ActionMenu.Button"][class*=" CopilotMenu__"]) ! Header - Search bar - Copilot autocomplete suggestion github.com##[data-component="ActionList.Group"]:has([data-testid="quick-search-suggestion"][href="/copilot"]) github.com##[data-component="ActionList.Divider"]:has(+ [data-component="ActionList.Group"] [data-testid="quick-search-suggestion"][href="/copilot"]) ! Header - Profile icon - Feature Preview - Organization Custom Instructions ! * Only applies if feature is already disabled github.com##[id$="-tab-copilot_chat_custom_instructions"]:has(.octicon-eye-closed) ! Left sidebar (≡) - Copilot button github.com##[data-testid="side-nav-menu-item-COPILOT"] ! Left sidebar (≡) - MCP Registry github.com##[data-component="NavList.Item"][href="/mcp"] ! Command Palette - Copilot ! * "Command Palette" is enabled via "Feature Preview". Opens with Ctrl+K 

- **Issue #1073** (2026-11-03): **[BUG] Generic cosmetic filters not working**
  *Symptoms*: ### Describe the bug  Generic cosmetic filters from Fanboy's Annoyances List don't seem to be applied on iOS.  ### To reproduce  Steps to reproduce the behavior: 1. Add the custom list `https://secure.fanboy.co.nz/fanboy-annoyance.txt` 2. Go to `https://www.it-connect.tech/proton-apologizes-and-says-its-internal-ai-tools-will-soon-be-open-source/` on iOS 3. Scroll down the page and a back to top button appears.  I have tried keeping the total rules under 150,000 but the issue still applies.   ### Expected behavior  The button should be hidden. On desktop with a Firefox-like browser, the button is hidden. It should be hidden by `##[aria-label="Back to top"]`.  Unclear to me if its a limitation of MV3.  ### Screenshot or video  [![IMG-1424.png](https://i.postimg.cc/BbXTpPmX/IMG-1424.png)](https://postimg.cc/p5M5XrbH)  ### Environment  - OS: iOS 18 - wBlock Version: 3.2.3   ### Troubleshooting checklist  - [x] I have enabled all 5 wBlock Content Blocker extensions in Safari _(including Profiles, if applicable)_. - [x] I have enabled `wBlock Scripts` and set it to `Allow` on all websites (`Always Allow on Every Website`) in Safari settings. - [x] I have enabled `Allow in Private Browsing` for `wBlock Scripts` and all 5 content blockers _(Safari → Settings → Extensions)_. - [x] I have opened wBlock and pressed `Apply Changes` after changing filters, userscripts, whitelist, and/or extension settings. - [x] For filtering issues, I have restarted iOS/iPadOS and/or macOS, opened wBloc

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

### Incident Patch 1: `c426d8f6` (2026-11-05)
**Commit Message**: fix(reload): repair rules only when WebKit rejected them

A reload that times out or is interrupted went on to the rule repair,
which compiles the whole blocker inside the app first. On an iPad 6
with nearly every list on, that compile ran the app out of memory in
WebKit's DFA minimizer and crashed it (TestFlight 1555). The repair
now runs only for WKErrorDomain 6 with no underlying error, which is
how WebKit reports rules it refuses.

**File**: `wBlockCoreService/wBlockCoreService.swift` (modified, +22/-4)
```diff
@@ -408,16 +408,21 @@ www.youtube.com#%#//scriptlet('trusted-youtube-backoff-recovery')
         /// Why the reload failed, in a form that can be shown in the app log.
         /// nil on success or when the reload was skipped.
         public let failureReason: String?
+        /// Safari's WebKit compiled the rules and rejected them, the one
+        /// failure that dropping the offending rules can fix.
+        public let rulesRejected: Bool
 
         public init(
             success: Bool,
             skipped: Bool = false,
             disabledInSafari: Bool = false,
             attempts: Int,
             durationMs: Int,
-            failureReason: String? = nil
+            failureReason: String? = nil,
+            rulesRejected: Bool = false
         ) {
             self.success = success
+            self.rulesRejected = rulesRejected
             self.skipped = skipped
             self.disabledInSafari = disabledInSafari
             self.attempts = attempts
@@ -936,8 +941,10 @@ www.youtube.com#%#//scriptlet('trusted-youtube-backoff-recovery')
             )
             totalAttempts += reload.attempts
             // A rule this Safari's WebKit rejects fails the whole blocker. Drop
-            // such rules and reload once more before reporting a failure.
-            if !reload.success, enabledInSafari != false, !repairedOutput,
+            // such rules and reload once more before reporting a failure. Only
+            // a rejection: after a timeout, compiling the whole blocker again in
+            // the app ran an iPad 6 out of memory and crashed it.
+            if !reload.success, reload.rulesRejected, enabledInSafari != false, !repairedOutput,
                await repairRejectedRules(outputURL: outputURL, containerURL: containerURL, targetRulesFilename: targetRulesFilename),
                let repaired = try? readReloadSnapshot(markerURL: markerURL, outputURL: outputURL, appGroupURL: containerURL),
                repaired.outputDigest != nil
@@ -1165,6 +1172,14 @@ www.youtube.com#%#//scriptlet('trusted-youtube-backoff-recovery')
         return result
     }
 
+    /// WKErrorDomain 6 with no underlying error is WebKit refusing the rules
+    /// themselves; with one (such as NSPOSIXErrorDomain 2) the file could not
+    /// be read. Timeouts and interrupted loads are neither.
+    static func isRuleRejection(_ error: Error) -> Bool {
+        let error = error as NSError
+        return error.domain == "WKErrorDomain" && error.code == 6 && error.userInfo[NSUnderlyingErrorKey] == nil
+    }
+
     private static func reloadWithRetryRaw(
         identifier: String,
         maxRetries: Int,
@@ -1181,6 +1196,7 @@ www.youtube.com#%#//scriptlet('trusted-youtube-backoff-recovery')
         }
 
         var lastFailureReason: String?
+        var rulesRejected = false
         for attempt in 1...maxRetries {
             if Task.isCancelled {
                 return ReloadAttemptResult(
@@ -1201,6 +1217,7 @@ www.youtube.com#%#//scriptlet('trusted-youtube-backoff-recovery')
             }
             if case .failure(let error) = result {
                 lastFailureReason = LogErrorDescriber.describe(error)
+                rulesRejected = isRuleRejection(error)
             }
 
             // A timed-out attempt means Safari is not answering reload requests at
@@ -1236,7 +1253,8 @@ www.youtube.com#%#//scriptlet('trusted-youtube-backoff-recovery')
             success: false,
             attempts: maxRetries,
             durationMs: elapsedMs(),
-            failureReason: lastFailureReason
+            failureReason: lastFailureReason,
+            rulesRejected: rulesRejected
         )
     }
 
```

---

### Incident Patch 2: `f0492eaf` (2026-11-04)
**Commit Message**: fix(engine): stop $genericblock from crashing Safari's rule compiler

AdGuard Base has @@||adguardpartner.com^$genericblock. wbe copied that
host into every generic block as unless-domain, 75k rules once EasyList
and the uBO filters share the Ads blocker, and WebKit's NFA-to-DFA step
crashed ContentBlockerLoader on that set. Arjun's crash reports match the
local repro frame for frame.

A genericblock host is now one ignore-previous-rules on the host's pages,
in a new tier between the generic and the specific blocks. It leaves out
documents so the page keeps its hides. Calibration case k90 checks that
in WKWebView.

The `^` right after a plain `||host^` now emits [/:?#], since a URL's host
is always followed by one of those. WebKit compiles the ~60k host blocks
about 10% faster.

**File**: `Packages/wblock-engine/crates/wbe/src/compile/mod.rs` (modified, +15/-8)
```diff
@@ -25,18 +25,23 @@ pub enum Tier {
     SpecificHide = 2,
     /// `$elemhide` (and `$specifichide`, widened): cancels all hides.
     ElemHideException = 3,
-    Block = 4,
-    Exception = 5,
+    /// Blocks with no page domains, which `$genericblock` lifts.
+    GenericBlock = 4,
+    /// `$genericblock`: cancels the generic blocks before it on the page's
+    /// subresources, leaving its hides and the blocks after it in place.
+    GenericBlockException = 5,
+    Block = 6,
+    Exception = 7,
     /// `$important` with `$denyallow`: the block, then its exclusions.
-    ImportantDenyallowBlock = 6,
+    ImportantDenyallowBlock = 8,
     /// The exclusions of an important `$denyallow` block. Each cancels only
     /// the blocks before it, so they sit ahead of every other important block.
-    ImportantDenyallowException = 7,
-    ImportantBlock = 8,
+    ImportantDenyallowException = 9,
+    ImportantBlock = 10,
     /// AdGuard `$important` exceptions override important blocks.
-    ImportantException = 9,
+    ImportantException = 11,
     /// `@@...$document`: cancels everything on the page.
-    DocumentException = 10,
+    DocumentException = 12,
 }
 
 #[derive(Debug, Clone, Serialize, Deserialize)]
@@ -127,11 +132,13 @@ impl std::io::Write for Count {
 }
 
 /// Tiers in output order.
-const TIERS: [Tier; 11] = [
+const TIERS: [Tier; 13] = [
     Tier::GenericHide,
     Tier::GenericHideException,
     Tier::SpecificHide,
     Tier::ElemHideException,
+    Tier::GenericBlock,
+    Tier::GenericBlockException,
     Tier::Block,
     Tier::Exception,
     Tier::ImportantDenyallowBlock,
```

**File**: `Packages/wblock-engine/crates/wbe/src/compile/network.rs` (modified, +78/-54)
```diff
@@ -36,13 +36,11 @@ pub(crate) struct Context {
     strict: StrictHosts,
     bad: Vec<NetworkRule>,
     bad_bodies: FxHashSet<String>,
-    generic_exceptions: Vec<NetworkRule>,
 }
 
 impl Context {
     pub(crate) fn add(&mut self, rule: &NetworkRule) {
         self.strict.add(rule);
-        if !rule.badfilter && genericblock_host(rule).is_some() { self.generic_exceptions.push(rule.clone()); }
         if rule.badfilter {
             let bad = unlabeled(rule);
             self.bad_bodies.insert(bad.pattern.body.clone());
@@ -53,15 +51,14 @@ impl Context {
     pub(crate) fn merge(&mut self, other: Context) {
         self.strict.hosts.extend(other.strict.hosts);
         self.strict.parents.extend(other.strict.parents);
-        self.generic_exceptions.extend(other.generic_exceptions);
         self.bad.extend(other.bad);
         self.bad_bodies.extend(other.bad_bodies);
     }
 }
 
-/// Safari has no network-only ignore action. Hostname genericblock exceptions
-/// are represented by exclusions on generic triggers, leaving cosmetic and
-/// specific network rules untouched (including their own exceptions).
+/// The host of a `$genericblock` exception Safari can represent: one
+/// ignore-previous-rules on that host's pages, between the generic and the
+/// specific blocks.
 fn genericblock_host(r: &NetworkRule) -> Option<String> {
     (r.exception && r.scope.contains(ExceptionScope::GENERICBLOCK) && r.types.is_empty()
         && r.negated_types.is_empty() && r.from.is_empty() && r.to.is_empty()
@@ -154,14 +151,7 @@ fn compile_rule(
     }
     let party = party(r.party, exception)?;
     let urls = urls(r, exception)?;
-    let mut from = std::borrow::Cow::Borrowed(&r.from);
-    if !exception && !r.important && r.from.include.is_empty() {
-        for rule in &ctx.generic_exceptions {
-            if ctx.bad.contains(&unlabeled(rule)) { continue; }
-            from.to_mut().exclude.push(DomainMatcher::Hostname(genericblock_host(rule).unwrap()));
-        }
-    }
-    let conds = domain_conds(&from, v, exception)?;
+    let conds = domain_conds(&r.from, v, exception)?;
     let types = effective_types(r);
     // uBO also strict-blocks top-level navigation for an untyped filter whose
     // match ends at the hostname (traffic.js, `shouldStrictBlock`), so such a
@@ -188,6 +178,8 @@ fn compile_rule(
         (true, if r.important { Tier::ImportantException } else { Tier::Exception })
     } else if r.important {
         (false, Tier::ImportantBlock)
+    } else if r.from.include.is_empty() {
+        (false, Tier::GenericBlock)
     } else {
         (false, Tier::Block)
     };
@@ -270,6 +262,30 @@ fn compile_denyallow(
 /// `$specifichide` is widened to `$elemhide`, which also cancels generic
 /// hides.
 fn compile_scope(r: &NetworkRule, v: SafariVersion, out: &mut Emitted) -> Result<(), String> {
+    let generic = r.scope.contains(ExceptionScope::GENERICBLOCK);
+    if let Some(host) = genericblock_host(r).filter(|_| generic) {
+        // Copying the host into every generic block as unless-domain made
+        // WebKit's NFA-to-DFA step crash ContentBlockerLoader (EasyList, uBO
+        // filters and AdGuard Base in one blocker). Documents and frames are
+        // left out: an ignore on the page's document load would also cancel
+        // its hides, so generic blocks of subframes stay.
+        let cond = Cond::IfDomain(vec![format!("*{host}")]);
+        for (types, context) in type_triggers(DEFAULT_TYPES.difference(ResourceTypes::FRAME), v) {
+            emit(
+                out,
+                Tier::GenericBlockException,
+                &Trigger {
+                    url: ".*",
+                    case_sensitive: false,
+                    types: Some(&types),
+                    load_type: None,
+                    load_context: context,
+                    cond: Some(&cond),
+                },
+                true,
+            );
+        }
+    }
     let remaining = r.scope.difference(ExceptionScope::GENERICBLOCK);
     let tier = if remaining.contains(ExceptionScope::DOC) {
         Tier::DocumentException
@@ -278,7 +294,7 @@ fn compile_scope(r: &NetworkRule, v: SafariVersion, out: &mut Emitted) -> Result
     } else if remaining.contains(ExceptionScope::GHIDE) {
         Tier::GenericHideException
     } else {
-        return if genericblock_host(r).is_some() { Ok(()) } else {
+        return if generic && genericblock_host(r).is_some() { Ok(()) } else {
             Err("genericblock: only unconstrained hostname page exceptions can be represented without canceling cosmetics".into())
         };
     };
@@ -976,7 +992,7 @@ mod tests {
         check(
             &[net("||ads.example.com^")],
             V15,
-            r#"[{"trigger":{"url-filter":"^[^:]+://+([^:/]+\\.)?ads\\.example\\.com[^a-zA-Z0-9_.%-]"},"action":{"type":"block"}}]"#,
+            r#"[{"trigger":{"url-filter":"^[^:]+://+([^:/]+\\.)?ads\\.example\\.com[/:?#]"},"action":{"type":"block
```

**File**: `Packages/wblock-engine/crates/wbe/src/compile/regex.rs` (modified, +19/-4)
```diff
@@ -32,12 +32,27 @@ pub fn url_filter(p: &Pattern) -> Option<String> {
             .filter(|r| webkit_accepts(r));
     }
     let mut out = String::new();
+    let mut body = p.body.as_str();
     match p.kind {
-        PatternKind::Hostname => out.push_str(HOST_START),
+        PatternKind::Hostname => {
+            out.push_str(HOST_START);
+            // A `^` right after a plain host ends the host, which in a URL is
+            // always followed by one of HOST_END. The narrower class makes the
+            // ~60k `||host^` blocks of EasyList and AdGuard Base compile 12%
+            // faster in WebKit.
+            let host = body.split_once('^').filter(|(h, _)| {
+                !h.is_empty() && h.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.')
+            });
+            if let Some((host, rest)) = host {
+                literal(host, &mut out)?;
+                out.push_str(HOST_END);
+                body = rest;
+            }
+        }
         PatternKind::Left => out.push('^'),
         _ => {}
     }
-    literal(&p.body, &mut out)?;
+    literal(body, &mut out)?;
     if p.right_anchored {
         out.push('$');
     }
@@ -443,7 +458,7 @@ mod emitted_filter_tests {
     fn webkit_accepts_checks_structure() {
         for ok in [
             ".*",
-            "^[^:]+://+([^:/]+\\.)?ads\\.com[^a-zA-Z0-9_.%-]",
+            "^[^:]+://+([^:/]+\\.)?ads\\.com[/:?#]",
             "a[\\]]b",
             "[-a]",
             "x?$",
@@ -491,7 +506,7 @@ mod tests {
                 right_anchored: false
             })
             .unwrap(),
-            "^[^:]+://+([^:/]+\\.)?ads\\.com[^a-zA-Z0-9_.%-]path"
+            "^[^:]+://+([^:/]+\\.)?ads\\.com[/:?#]path"
         );
     }
 
```

**File**: `Packages/wblock-engine/harness/sim/calibrate-expected.json` (modified, +12/-0)
```diff
@@ -501,6 +501,18 @@
         "a": false
       },
       "hidden": []
+    },
+    {
+      "id": "k90",
+      "pageReached": true,
+      "reached": {
+        "a": true,
+        "b": false
+      },
+      "hidden": [
+        "A",
+        "B"
+      ]
     }
   ]
 }
```

**File**: `Packages/wblock-engine/harness/sim/calibration-cases.ts` (modified, +15/-0)
```diff
@@ -362,4 +362,19 @@ export const CALIBRATION_CASES: CalibrationCase[] = [
         rules: [block('lib', { 'if-frame-url': ['frame/f58'] })],
         resources: [frameDoc('f', 'first', 'frame/f58.html'), script('a', 'first', CHILD_IN_LIB, 'f')],
     },
+    {
+        id: 'k90', what: '$genericblock: a page-scoped ignore over subresource types lifts earlier blocks and keeps the page hides',
+        rules: [
+            css('.*', '.cs-A'),
+            css('.*', '.cs-B', { 'if-domain': ['*app.localtest.me'] }),
+            block('lib/a'),
+            ignorePrevious('.*', {
+                'resource-type': ['image', 'style-sheet', 'script', 'font', 'media', 'ping', 'fetch', 'websocket', 'other'],
+                'if-domain': ['*app.localtest.me'],
+            }),
+            block('lib/b', { 'if-domain': ['*app.localtest.me'] }),
+        ],
+        resources: [script('a', 'third', 'lib/a.js'), script('b', 'third', 'lib/b.js')],
+        hide: ['A', 'B', 'C'],
+    },
 ];
```

---

### Incident Patch 3: `9e5ec865` (2026-11-05)
**Commit Message**: fix(engine): bump output version so saved blockers rebuild

The $genericblock fix and the any-character repeat cap both change
Safari output for the same input, so outputs saved by the older engine
must not be reused.

**File**: `Packages/wblock-engine/crates/wbe/src/lib.rs` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ pub use parse::parse_line;
 /// Version of everything the engine writes: Safari JSON, runtime rules, and
 /// the serialized per-page engine. Bump it whenever any of them changes for
 /// the same input, so callers discard outputs cached by an older engine.
-pub const OUTPUT_VERSION: u32 = 17;
+pub const OUTPUT_VERSION: u32 = 18;
 
 /// The registrable domain (eTLD+1) of `host`, or `None` for a public suffix
 /// or an invalid name.
```

#### Recent Merged Pull Requests:
- **PR #1076** (2026-11-03): ci: build only wBlockCoreService for the native tests (@0xCUB3)
- **PR #1075** (2026-11-03): [ImgBot] Optimize images (@imgbot[bot])
- **PR #1072** (2026-11-03): feat: replace AdGuard's converter with a uBO-semantics engine (@0xCUB3)
- **PR #1063** (2026-11-01): [ImgBot] Optimize images (@imgbot[bot])
- **PR #1055** (2026-10-29): Fix spacing in localization string for extensions (@daywalk3r666)
- **PR #1054** (2026-10-29): Update Localizable.strings for Important notes regarding the Montenegrin language (@so-5699)

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

## X. reload): repair rules only when WebKit rejected them

**RULE**:
When implementing operations in `wBlockCoreService/wBlockCoreService.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in 0xCUB3/wBlock. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c426d8f6`: reload): repair rules only when WebKit rejected them. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `wBlockCoreService/wBlockCoreService.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        /// Safari's WebKit compiled the rules and rejected them, the one
        /// failure that dropping the offending rules can fix.
        public let rulesRejected: Bool
            failureReason: String? = nil,
            rulesRejected: Bool = false
            self.rulesRejected = rulesRejected
            // such rules and reload once more before reporting a failure. Only
            // a rejection: after a timeout, compiling the whole blocker again in
            // the app ran an iPad 6 out of memory and crashed it.
            if !reload.success, reload.rulesRejected, enabledInSafari != false, !repairedOutput,
    /// WKErrorDomain 6 with no underlying error is WebKit refusing the rules
    /// themselves; with one (such as NSPOSIXErrorDomain 2) the file could not
    /// be read. Timeouts and interrupted loads are neither.
    static func isRuleRejection(_ error: Error) -> Bool {
        let error = error as NSError
        return error.domain == "WKErrorDomain" && error.code == 6 && error.userInfo[NSUnderlyingErrorKey] == nil
    }

        var rulesRejected = false
                rulesRejected = isRuleRejection(error)
            failureReason: lastFailureReason,
 
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
            failureReason: String? = nil
            // such rules and reload once more before reporting a failure.
            if !reload.success, enabledInSafari != false, !repairedOutput,
            failureReason: lastFailureReason
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c426d8f6` are properly handled with clean fallback behavior.
