# Verification Protocol: Verification Protocol: Empirical Defect Shield for 0xCUB3/wBlock

<!-- PROVENANCE_START
{
  "source_repository": "0xCUB3/wBlock",
  "source_url": "https://github.com/0xCUB3/wBlock",
  "source_version": "03e46e4a",
  "license": "GPL-3.0",
  "timestamp": "2026-11-16T15:51:08.677Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-0xcub3-wblock",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [0xCUB3/wBlock](https://github.com/0xCUB3/wBlock) (Revision: `03e46e4a`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-16T15:51:08.677Z`  
> **Learning ID**: `learn-github-0xcub3-wblock`


## 1. Scope & Verification Target
- **Target Repository**: `0xCUB3/wBlock` (Commit: `03e46e4a`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): 0xCUB3/wBlock

> **Canonical Artifact**: `07_PROJECT_LEARNING/0xcub3-wblock-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/0xCUB3/wBlock](https://github.com/0xCUB3/wBlock))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-16T15:51:07.585Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `0xCUB3/wBlock`
- **Description**: Free, open-source Safari ad blocker for macOS, iOS, iPadOS and visionOS. Up to 750,000 rules, custom filter lists, userscripts and userstyles. No subscription.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3241 stars

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

        /// Maps the engine that starts `offset` bytes into the file at `path`.
        /// Replace the file by rename; never write it in place while open.
        public init(path: String, offset: Int) throws {
            guard let handle = wbe_engine_open(path, offset) else { throw EngineError.last() }
            self.handle = handle
        }

        deinit { wbe_engine_free(handle) }

        /// `{"hide":[..],"procedural":[..],"scriptlets":[[name, args..]],"generichide":bool}`.
        /// `topUrl` is the page embedding a subframe, nil for a top frame.
        public func lookup(url: String, topUrl: String? = nil) throws -> Data {
            guard let json = wbe_engine_lookup(handle, url, topUrl) else { throw EngineError.last() }
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

/* Maps the engine at offset in the file at path; replace the file by rename, never write it in place. */
WbeEngine *wbe_engine_open(const char *path, size_t offset);
/* PagePayload JSON: {"hide":[..],"procedural":[..],"scriptlets":[[name,args..],..],"generichide":bool}.
   top_url is NULL for a top frame, else the page embedding the frame (for `name>>` scriptlets). */
char *wbe_engine_lookup(const WbeEngine *engine, const char *url, const char *top_url);
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
    compile_blocker, parallel_indices, parse_list, CompileOptions, CompileOutput,
    surviving, NetworkContext, Others, Stats,
};
use crate::compile::prune::Seen;
use crate::parse::{cosmetic::with_domains, restate};
use crate::webkit::{SafariVersion, WebkitJson, WkAction, WkRule, WkTrigger};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use rustc_hash::{FxHashMap, FxHashSet};
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

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct CosmeticScope {
    #[serde(flatten)]
    pub sites: SiteScope,
    /// False drops hides that name no site.
    pub generic: bool,
}

impl Default for CosmeticScope {
    fn default() -> Self {
        CosmeticScope { sites: SiteScope::default(), generic: true }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct PlanRequest {
    pub safari: (u16, u16),
    /// In compile order.
    pub lists: Vec<ListSpec>,
    pub targets: Vec<TargetSpec>,
    #[serde(default)]
    pub cosmetics: CosmeticScope,
    #[serde(default)]
    pub limits: Limits,
}

/// Extra text one blocker compiles after its lists (zapper rules, wBlock's
/// compatibility rules, redirect carve-outs).
#[derive(Debug, Clone, Deserialize)]
pub struct Extra {
    pub text: String,
    #[serde(default)]
    pub trusted: bool,
    /// Every blocker of the plan is given this text. Its blocks that
    /// exceptions can reach then compile in the wide blocker alone (`Wide`).
    #[serde(default)]
    pub every_blocker: bool,
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
    /// A network rule, so the network pass can skip the other kinds unparsed.
    network: bool,
    /// A network rule a blocker's `NetworkContext` holds, so its scan parses it.
    in_context: bool,
    /// `is_plain_block`, which the segment of #925 compiles unscoped.
    plain: bool,
    /// What decides the rule's blocker.
    route: Route,
    /// Affinity types of the enclosing `!#safari_cb_affinity` block.
    affinity: Option<u8>,
}

struct ParsedList {
    /// The records in line order, in the chunks they were parsed in.
    chunks: Vec<Vec<Parsed>>,
    has_affinity: bool,
    /// A `!#` directive anywhere keeps the list out of #681 dedupe, as before.
    has_directive: bool,
    stats: Stats,
}

impl ParsedList {
    fn records(&self) -> impl Iterator<Item = &Parsed> + '_ {
        self.chunks.iter().flatten()
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
}

impl ParseKey {
    fn of(list: &ListSpec, text: u64) -> ParseKey {
        ParseKey {
            text,
            len: list.text.len(),
            trusted: list.trusted,
            scope: hash(&(&list.scope.exclude, &list.scope.only)),
            version: crate::OUTPUT_VERSION,
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
        let parsed = Arc::new(parse(list));
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
    limits: Limits,
    /// List index -> rule identities a blocker other than this one owns (#681).
    duplicates: Vec<Vec<FxHashSet<u64>>>,
    /// Hash of each list's text, for `fingerprint`.
    text_hashes: Vec<u64>,
    /// Where the blocks exceptions can reach go, when they go to one blocker.
    wide: Option<Wide>,
    capacity_error: Option<String>,
}

/// What one blocker may hold. The wide blocker gains rules from every list,
/// so a plan has one only while its measured output stays within these.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(default)]
pub struct Limits {
    /// Safari's rule limit per content blocker. 0 for a blocker built outside
    /// the shared plan: every blocker then keeps its own lists' blocks.
    pub rules: usize,
    /// The app's budget for a blocker's JSON.
    pub bytes: usize,
}

impl Default for Limits {
    fn default() -> Self {
        Limits { rules: 150_000, bytes: 19_000_000 }

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
    /// `name>>` (uBO 1.64): a frame with the hostname or entity as an
    /// ancestor. Only scriptlets accept it, as only uBO's scriptlet lookup
    /// reads ancestors.
    Ancestor(Box<DomainMatcher>),
}

impl DomainMatcher {
    /// The entry as filter text, which is also its runtime host key.
    pub fn text(&self) -> String {
        match self {
            Self::Hostname(h) => h.clone(),
            Self::Entity(e) => format!("{e}.*"),
            Self::Regex(r) => format!("/{r}/"),
            Self::Ancestor(m) => format!("{}>>", m.text()),
        }
    }
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

    /// Drops excludes that share no host with any include, so `a.com,~b.com`
    /// is just `a.com`, as uBO matches it. An exclude that is a parent of an
    /// include (`b.a.com,~a.com`) still cancels it. Only hostname lists are
    /// judged.
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
        let within = |a: &str, b: &str| a == b || a.strip_suffix(b).is_some_and(|p| p.ends_with('.'));
        let reachable = |x: &str| hosts.iter().any(|h| within(x, h) || within(h, x));
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
    /// Whether a given Safari version accepts it is the compiler's ca
```

### Core Architecture Module: `Packages/wblock-engine/crates/wbe/src/bin/wbe.rs`
```
//! `wbe compile [--safari 18.0] [--runtime-out FILE] [--trusted] LIST...`
//! writes Safari JSON to stdout and stats JSON to stderr. `--trusted` marks
//! the list after it as trusted (may use `trusted-*` scriptlets).
//! `wbe plan REQUEST.json OUTDIR` compiles every blocker of an apply request
//! (the JSON of `apply::PlanRequest`) to `OUTDIR/blocker-N.json` and prints
//! each one's rule count and compile time.
//! `wbe engine-build --out FILE RUNTIME.txt` serializes a runtime engine.
//! `wbe lookup [--bench N] ENGINE URL...`
//! prints PagePayload JSON per URL; with `--bench` it prints p50/p99 JSON for
//! N lookups over the URLs in the file.

use std::time::Instant;
use wbe::apply::{Plan, PlanRequest};
use wbe::runtime::Engine;
use wbe::webkit::{to_json, SafariVersion};
use wbe::{compile, CompileOptions, ListInput};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("compile") => compile_cmd(&args[1..]),
        Some("plan") => plan_cmd(&args[1..]),
        Some("engine-build") => engine_build_cmd(&args[1..]),
        Some("lookup") => lookup_cmd(&args[1..]),
        _ => {
            eprintln!(
                "usage: wbe compile [--safari 18.0] [--runtime-out FILE] [--trusted] LIST..."
            );
            eprintln!("       wbe plan REQUEST.json OUTDIR");
            eprintln!("       wbe engine-build --out FILE RUNTIME.txt");
            eprintln!("       wbe lookup [--bench N] ENGINE URL|URLFILE...");
            std::process::exit(2);
        }
    }
}

fn read(path: &str) -> String {
    std::fs::read_to_string(path).unwrap_or_else(|e| panic!("{path}: {e}"))
}

fn plan_cmd(args: &[String]) {
    let [request, out] = args else {
        eprintln!("usage: wbe plan REQUEST.json OUTDIR");
        std::process::exit(2);
    };
    let mut request: PlanRequest = serde_json::from_str(&read(request)).expect("request JSON");
    for list in &mut request.lists {
        if let Some(path) = &list.path {
            list.text = read(path);
        }
    }
    let start = Instant::now();
    let plan = Plan::new(request);
    plan.check_capacity().unwrap_or_else(|error| panic!("{error}"));
    let plan_ms = start.elapsed().as_secs_f64() * 1000.0;
    for target in 0..plan.target_count() {
        let start = Instant::now();
        let compiled = plan.compile_target(target, &[]);
        let compile_ms = start.elapsed().as_secs_f64() * 1000.0;
        let rules = compiled.output.webkit.rules();
        let path = format!("{out}/blocker-{}.json", target + 1);
        std::fs::write(&path, compiled.output.webkit.as_str()).unwrap_or_else(|e| panic!("{path}: {e}"));
        std::fs::write(format!("{out}/runtime-{}.txt", target + 1), compiled.output.runtime.join("\n"))
            .expect("write runtime rules");
        println!("{}", serde_json::json!({ "blocker": target + 1, "rules": rules, "compile_ms": compile_ms }));
    }
    println!("{}", serde_json::json!({ "plan_ms": plan_ms }));
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
    let engine = Engine::open(engine_path.as_ref(), 0).unwrap_or_else(|e| panic!("{engine_path}: {e}"));
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
//!
//! Only generic hides (no site named) compile natively: a hide scoped to sites
//! costs WebKit a rule to compile on every apply, and the wBlock Scripts
//! extension applies it per page from the runtime engine instead, with the
//! key's exceptions. When a key's exceptions cannot be expressed natively,
//! every hide and exception of the key goes to `runtime`.

use super::{CompileOptions, Stats, Tier, Tiered};
use crate::ast::{CosmeticBody, CosmeticRule, DomainMatcher};
use crate::webkit::{SafariVersion, WkAction, WkResourceType, WkRule, WkTrigger};
use std::collections::{BTreeMap, BTreeSet};

/// Selectors per emitted rule. AdGuard's Compiler uses the same limit
/// (`MAX_SELECTORS_PER_RULE`).
const GROUP_SIZE: usize = 250;

/// A selector and the `:matches-path()` argument it is scoped to.
type Key<'a> = (&'a str, Option<&'a str>);

/// The hides and exceptions of one key, with whether Safari takes the selector.
#[derive(Default)]
struct Group<'a> {
    native: bool,
    hides: Vec<&'a CosmeticRule>,
    exceptions: Vec<&'a CosmeticRule>,
}

pub(super) fn compile(
    rules: &[&CosmeticRule],
    opts: &CompileOptions,
    out: &mut Vec<Tiered>,
    runtime: &mut Vec<String>,
    stats: &mut Stats,
) {
    let safari = opts.safari;
    // Each selector's verdict depends on it alone, so they are worked out in
    // parallel; the rest is in rule order.
    let verdicts = super::parallel_indices(rules.len(), |i| match &rules[i].body {
        CosmeticBody::Hide(selector) => Some(verdict(selector, safari)),
        CosmeticBody::Procedural(_) | CosmeticBody::Style(_) => None,
    });
    let mut groups: BTreeMap<Key, Group> = BTreeMap::new();
    let mut runtime_lines = BTreeSet::new();
    for (rule, verdict) in rules.iter().zip(verdicts) {
        let (selector, verdict) = match (&rule.body, verdict) {
            (CosmeticBody::Hide(selector), Some(verdict)) => (selector, verdict),
            _ => {
                runtime_lines.insert(rule.raw.as_str());
                continue;
            }
        };
        if verdict == Verdict::Invalid {
            stats.drop("invalid cosmetic selector");
            continue;
        }
        let group = groups.entry((selector.as_str(), rule.matches_path.as_deref())).or_default();
        group.native = verdict == Verdict::Native;
        if rule.exception {
            group.exceptions.push(rule);
        } else {
            group.hides.push(rule);
        }
    }

    // A specific copy of a generic hide goes to the runtime with the other
    // specific hides: `$generichide` cancels only the generic one.
    let mut native: BTreeMap<Trigger, BTreeSet<&str>> = BTreeMap::new();
    for (key, group) in &groups {
        let (triggers, to_runtime) = resolve(key.1, group);
        for trigger in triggers {
            native.entry(trigger).or_default().insert(key.0);
        }
        runtime_lines.extend(to_runtime.into_iter().map(|r| r.raw.as_str()));
    }
    for (trigger, selectors) in native {
        let selectors: Vec<&str> = selectors.into_iter().collect();
        out.extend(selectors.chunks(GROUP_SIZE).map(|chunk| Tiered {
            tier: Tier::GenericHide,
            rule: WkRule {
                trigger: trigger.to_trigger(),
                action: WkAction::CssDisplayNone {
                    selector: chunk.join(", "),
                },
            },
        }));
    }

    runtime.extend(runtime_lines.into_iter().map(str::to_string));
}

/// One Safari trigger of a generic hide.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
enum Trigger {
    Generic,
    Unless(Vec<String>),
    Url(String),
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
            Trigger::Url(r) => {
                trigger.url_filter = r.clone();
                trigger.url_filter_is_case_sensitive = Some(true);
            }
        }
        // A scoped hide only needs checking when a document loads, not on
        // every subresource (wBlock #873).
        trigger.resource_type = Some(vec![WkResourceType::Document]);
        trigger
    }
}

/// The hostnames of a domain list, or `None` if it has an entity or regex.
fn hostnames(matchers: &[DomainMatcher]) -> Option<Vec<&str>> {
    matchers
        .iter()
        .map(|m| match m {
            DomainMatcher::Hostname(h) => Some(h.as_str()),
            _ => None,
        })
        .collect()
}

/// Resolves the hides and exceptions of one key: the native triggers of its
/// generic hides, and the rules that go to the runtime. The runtime gets the
/// hides that name sites, and the key's exceptions with them so they lift
/// those hides too.
fn resolve<'a>(path: Option<&str>, group: &Group<'a>) -> (Vec<Trigger>, Vec<&'a CosmeticRule>) {
    let everything = || (Vec::new(), group.hides.iter().chain(&group.exceptions).copied().collect());
    if !group.native {
        return everything();
    }
    let mut excepted: Vec<&str> = Vec::new();
    for exception in &group.exceptions {
        let Some(hosts) = hostnames(&exception.domains.include).filter(|_| exception.domains.exclude.is_empty()) else {
            return everything();
        };
        if hosts.is_empty() {
            // A generic exception lifts the key everywhere.
            return (Vec::new(), Vec::new());
        }
        excepted.extend(hosts);
    }
    // uBO compiles a negated hostname of a hide as an exception on that
    // hostname, so it lifts every hide of the key there.
    for hide in &group.hides {
        let Some(hosts) = hostnames(&hide.domains.exclude) else {
            return everything();
        };
        excepted.extend(hosts);
    }
    let (generic, specific): (Vec<&CosmeticRule>, Vec<&CosmeticRule>) =
        group.hides.iter().partition(|h| h.domains.include.is_empty());
    let trigger = match (generic.is_empty(), path, excepted.is_empty()) {
        (true, ..) => None,
        (false, None, true) => Some(Trigger::Generic),
        (false, None, false) => Some(Trigger::Unless(domains(&excepted))),
        (false, Some(path), true) => match url_regex(path) {
            Some(regex) => Some(Trigger::Url(regex)),
            None => return everything(),
        },
        (false, Some(_), false) => return everything(),
    };
    let mut to_runtime = Vec::new();
    if !specific.is_empty() {
        to_runtime.extend(specific);
        to_runtime.extend(&group.exceptions);
        // The runtime needs the negations of the generic hides as exceptions.
        to_runtime.extend(generic.iter().filter(|h| !h.domains.exclude.is_empty()));
    }
    (trigger.into_iter().collect(), to_runtime)
}

fn domains(hosts: &[&str]) -> Vec<String> {
    let mut out: Vec<String> = hosts.iter().map(|h| format!("*{h}")).collect();
    out.sort();
    out.dedup();
    out
}

/// A url-filter for a `:matches-path()` argument on any host. uBO tests the
/// argument against `pathname + search`, case-sensitively and unanchored, so
/// it must match after the host and before any fragment. uBO matches it
/// against each frame's own URL, which is what a document load's url-filter
/// tests; `if-top-url` would follow the tab's page instead.
fn url_regex(path: &str) -> Option<String> {
    let head = r"^[^:]+:\/\/[^\/]+";
    let re = if path.starts_with('/') {
        // The argument may start at the pathname's leading slash.
        format!(r"{head}(:[^\/#]*)?(\/[^#]*)?{}", plain_path(path)?)
    } else {
        format!(r"{head}(:[^\/#]*)?\/[^#]*{}", plain_path(path)?)
    };
    super::regex::webkit_accepts(&re).then_some(re)
}

/// uBO's `regexFromString` for a plain `:matches-path()` argument, in the
/// url-filter subset Safari accepts. Regex arguments and characters that
/// would need other escaping go to the runtime. A `#` would reach into the
/// fragment, which uBO never tests.
fn plain_path(path: &str) -> Option<String> {
    let regex = path
        .strip_prefix('/')
        .and_then(|rest| rest.rsplit_once('/'))
        .is_some_and(|(body, flags)| !body.is_empty() && flags.chars().all(|c| "imu".contains(c)));
    if regex {
        return None;
    }
    let mut out = String::new();
    for c in path.chars() {
        match c {
            c if c.is_ascii_alphanumeric() || "-_%=&~,;:'\"<>@! ".contains(c) => out.push(c),
            '/' | '.' | '?' | '+' | '*' => {
                out.push('\\');
                out.push(c);
            }
            _ => return None,
        }
    }
    Some(out)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Verdict {
    /// Plain CSS that this Safari accepts.
    Native,
    /// Valid CSS that this Safari rejects. A JS runtime can still apply it.
    NeedsJs,
    /// Not CSS, or not a selector WebKit knows. Dropped.
    Invalid,
}

/// Checks a selector with the same parser brave/adblock-rust uses for its
/// `css-validation` feature. A selector that only the permissive dialect
/// accepts (`:lang()`, `:dir()`) is valid for JS, so it needs the runtime.
/// Version gates follow AdGuard's CosmeticRule (`:has()` 16.4, `:is()` 14).
fn verdict(selector: &str, safari: SafariVersion) -> Verdict {
    let Some((permissive, js_only)) = css::canonical(selector, css::Dialect::Permissive) else {
        return Verdict::Invalid;
    };
    // Without a JS-only pseudo-class, WebKit's dialect parses it the same way.
    let webkit = match js_only {
        true => css::canonical(selector, css::Dialect::Web
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
pub(crate) mod network;
pub(crate) mod prune;
pub mod regex;

use crate::ast::{CosmeticRule, NetworkRule, ParsedLine, Rule, ScriptletRule, SourceRef};
use crate::webkit::{SafariVersion, WebkitJson, WkRule};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Tier {
    /// Hides that name no site. Hides scoped to sites are the runtime's.
    GenericHide = 0,
    /// `$generichide` and `$elemhide`: cancel the native hides.
    HideException = 1,
    /// `$denyallow`: the block, then its exclusions.
    DenyallowBlock = 2,
    /// The exclusions of a `$denyallow` block. Each cancels only the blocks
    /// before it, so they sit ahead of every other block.
    DenyallowException = 3,
    /// Blocks with no page domains, which `$genericblock` lifts.
    GenericBlock = 4,
    /// `$genericblock`: cancels the generic blocks before it on the page's
    /// subresources, leaving its hides and the blocks after it in place.
    GenericBlockException = 5,
    Block = 6,
    Exception = 7,
    /// `$important` with `$denyallow`: the block, then its exclusions.
    ImportantDenyallowBlock = 8,
    /// The exclusions of an important `$denyallow` block, ahead of every
    /// other important block for the same reason.
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
    /// The blocks anchored at a hostname, for `network::drop_subsumed`.
    anchored: Vec<network::Anchored>,
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
    shape: prune::Shape,
}

#[derive(Debug)]
pub(super) struct DomainSpan {
    /// `arena[start..head]` ends before the `if-domain` key and
    /// `arena[tail..end]` starts after its array.
    head: usize,
    tail: usize,
    domains: Vec<String>,
    /// Written as `if-top-url` regexes (`regex::host_top_url`).
    top: bool,
}

impl DomainSpan {
    /// The condition's key and value, as written.
    fn json(&self) -> (&'static [u8], Vec<u8>) {
        let value = if self.top {
            let urls: Vec<String> = self
                .domains
                .iter()
                .map(|d| regex::host_top_url(d).expect("ASCII domain"))
                .collect();
            serde_json::to_vec(&urls)
        } else {
            serde_json::to_vec(&self.domains)
        };
        let key: &[u8] = if self.top { b",\"if-top-url\":" } else { b",\"if-domain\":" };
        (key, value.expect("domains serialize"))
    }
}

pub(crate) use network::{split_host, surviving, Context as NetworkContext};

/// Tiers in output order.
const TIERS: [Tier; 13] = [
    Tier::GenericHide,
    Tier::HideException,
    Tier::DenyallowBlock,
    Tier::DenyallowException,
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
            anchored: Vec::new(),
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
            anchored: Vec::new(),
        };
        for part in parts {
            let base = out.arenas.len() as u32;
            let first = out.entries.len();
            out.arenas.extend(part.arenas);
            out.anchored.extend(part.anchored.into_iter().map(|mut a| {
                a.entry += first;
                a
            }));
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
                let (key, value) = span.json();
                out.extend_from_slice(&arena[entry.start..span.head]);
                out.extend_from_slice(key);
                out.extend_from_slice(&value);
                out.extend_from_slice(&arena[span.tail..entry.end]);
            }
        }
    }

    /// The bytes `render` writes for `entry`.
    fn rendered_len(&self, entry: &Entry) -> usize {
        match &entry.domain {
            None => entry.end - entry.start,
            Some(span) => {
                let (key, value) = span.json();
                (span.head - entry.start) + key.len() + value.len() + (entry.end - span.tail)
            }
        }
    }

    pub(crate) fn push_rule(&mut self, tier: Tier, rule: &WkRule) {
        let arena = self.arena();
        let bytes = &mut self.arenas[arena];
        let start = bytes.len();
        serde_json::to_writer(&mut *bytes, rule).expect("WkRule serializes");
        let end = bytes.len();
        let ignore = rule.action == crate::webkit::WkAction::IgnorePreviousRules;
        self.entries.push(Entry {
            tier,
            arena: arena as u32,
            start,
            end,
            domain: None,
            shape: prune::Shape::of_trigger(ignore, &rule.trigger),
        });
    }

    /// Everything emitted, in tier order; within a tier, emission order.
    /// `seen` holds the rules that come before these; an ignore that cancels
    /// none of them or of the rules here before it is left out (`prune`).
    /// `network_front` goes after the hides and their exceptions and before
    /// every network tier: a hide exception applies to every load of its
    /// page, so nothing it can cancel may come before it but hides.
    fn into_webkit(mut self, seen: &mut prune::Seen, network_front: &WebkitJson) -> WebkitJson {
        let mut order = Vec::with_capacity(self.entries.len());
        let mut front_at = 0;
        for tier in TIERS {
            if tier == Tier::DenyallowBlock {
                front_at = order.len();
            }
            for (i, entry) in self.entries.iter_mut().enumerate().filter(|(_, e)| e.tier == tier) {
                if let Some(span) = entry.domain.as_deref().filter(|s| s.top) {
                    entry.shape.set_page(prune::Page::If(span.domains.iter().map(|d| prune::domain_host(d)).collect()));
                }
                if tier == Tier::GenericHide {
                    seen.add_hide(&entry.shape);
                } else if !entry.shape.ignore {
                    seen.add(&entry.shape);
                } else if !seen.overlaps(&entry.shape, matches!(tier, Tier::HideException | Tier::DocumentException)) {
                    continue;
                }
                order.push(i);
            }
        }
        // Sized up front so the output is never copied to grow.
        let front = network_front.as_str();
        let front = &front[1..front.len() - 1];
        let size = order.iter().map(|&i| self.rendered_len(&self.entries[i]) + 1).sum::<usiz
```

### Core Architecture Module: `Packages/wblock-engine/crates/wbe/src/compile/network.rs`
```
//! uBO network rules to WebKit rules.
//!
//! Blocks are dropped when a condition cannot be expressed, so they never
//! block more than uBO does. Exceptions drop the condition instead, which
//! makes them wider and can only under-block. Each rule's tier follows
//! `compile/mod.rs`; exceptions use ignore-previous-rules.

use super::regex::{apart, domain_top_url, host_top_url, url_filter};
use super::prune::{domain_host, if_page, unless_page, Page, Shape};
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
    /// `$badfilter` rules by pattern body.
    bad: FxHashMap<String, Vec<Bad>>,
    /// The pages of `$genericblock` exceptions (`genericblock_host`).
    generic_pages: Vec<String>,
}

/// A `$badfilter` rule with the shapes `surviving` compares, made once.
struct Bad {
    types: ResourceTypes,
    include: Vec<DomainMatcher>,
    shape: NetworkRule,
    /// The shape for a "just origin" filter, when the rule is one.
    origin_shape: Option<NetworkRule>,
}

impl Context {
    pub(crate) fn add(&mut self, rule: &NetworkRule) {
        self.strict.add(rule);
        self.generic_pages.extend(genericblock_host(rule));
        if rule.badfilter {
            let bad = Bad {
                types: rule.types,
                include: rule.from.include.clone(),
                shape: shape(rule, false),
                origin_shape: just_origin(rule).then(|| shape(rule, true)),
            };
            self.bad.entry(rule.pattern.body.clone()).or_default().push(bad);
        }
    }

    /// Whether `add` keeps anything of `rule`.
    pub(crate) fn holds(rule: &NetworkRule) -> bool {
        rule.badfilter || StrictHosts::host(rule).is_some() || genericblock_host(rule).is_some()
    }

    /// Whether a `$genericblock` exception covers pages of `domain`.
    fn generic_page(&self, domain: &DomainMatcher) -> bool {
        let DomainMatcher::Hostname(host) = domain else {
            return !self.generic_pages.is_empty();
        };
        let under = |a: &str, b: &str| a.strip_suffix(b).is_some_and(|rest| rest.is_empty() || rest.ends_with('.'));
        self.generic_pages.iter().any(|page| under(host, page) || under(page, host))
    }

    pub(crate) fn merge(&mut self, other: Context) {
        self.strict.hosts.extend(other.strict.hosts);
        self.strict.parents.extend(other.strict.parents);
        self.generic_pages.extend(other.generic_pages);
        for (body, bad) in other.bad {
            self.bad.entry(body).or_default().extend(bad);
        }
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
    rule: NetworkRule,
    out: &mut Emitted,
    stats: &mut Stats,
) {
    for rule in surviving(ctx, rule) {
        if let Err(reason) = compile_rule(&rule, safari, ctx, out, None) {
            stats.drop(&reason);
        }
    }
}

/// uBO's network types: a filter with all of them is stored typeless.
const NETWORK_TYPES: ResourceTypes = ResourceTypes::SCRIPT
    .union(ResourceTypes::IMAGE)
    .union(ResourceTypes::CSS)
    .union(ResourceTypes::OBJECT)
    .union(ResourceTypes::XHR)
    .union(ResourceTypes::FRAME)
    .union(ResourceTypes::FONT)
    .union(ResourceTypes::MEDIA)
    .union(ResourceTypes::PING)
    .union(ResourceTypes::WEBSOCKET)
    .union(ResourceTypes::OTHER);

/// What `$badfilter` leaves of `rule`. uBO stores a filter as one entry per
/// type, a typeless one standing for every network type, and a
/// `*$domain=a|b` filter as one per page hostname; a badfilter removes the
/// entries identical to its own (static-net-filtering.js,
/// `compileToAtomicFilter` and `freeze`).
pub(crate) fn surviving(ctx: &Context, rule: NetworkRule) -> Vec<NetworkRule> {
    if rule.badfilter {
        return Vec::new();
    }
    let Some(bad) = ctx.bad.get(rule.pattern.body.as_str()) else {
        return vec![rule];
    };
    // (typeless entry, typed entries) of a type set.
    let split = |t: ResourceTypes| match t {
        t if t.is_empty() => (true, t),
        t if t.contains(NETWORK_TYPES) => (true, t.difference(NETWORK_TYPES)),
        t => (false, t),
    };
    let by_origin = just_origin(&rule);
    let key = shape(&rule, by_origin);
    let origins: Vec<Option<&DomainMatcher>> = if by_origin {
        rule.from.include.iter().map(Some).collect()
    } else {
        vec![None]
    };
    let mut left = vec![split(rule.types); origins.len()];
    let same = |b: &&Bad| match by_origin {
        true => b.origin_shape.as_ref() == Some(&key),
        false => b.shape == key,
    };
    for bad in bad.iter().filter(same) {
        let (typeless, typed) = split(bad.types);
        for (origin, left) in origins.iter().zip(&mut left) {
            if origin.is_none_or(|o| bad.include.contains(o)) {
                left.0 &= !typeless;
                left.1.remove(typed);
            }
        }
    }
    if left.iter().all(|&l| l == split(rule.types)) {
        return vec![rule];
    }
    let network = if rule.types.is_empty() { ResourceTypes::empty() } else { NETWORK_TYPES };
    origins
        .into_iter()
        .zip(left)
        .filter(|(_, (typeless, typed))| *typeless || !typed.is_empty())
        .map(|(origin, (typeless, typed))| {
            let mut r = rule.clone();
            r.types = if typeless { network.union(typed) } else { typed };
            if let Some(origin) = origin {
                r.from.include = vec![origin.clone()];
            }
            r
        })
        .collect()
}

/// uBO's "just origin" filter, `*$domain=a|b` with no other option, which it
/// stores once per page hostname.
fn just_origin(r: &NetworkRule) -> bool {
    r.pattern.is_match_all()
        && !r.from.include.is_empty()
        && r.from.exclude.is_empty()
        && !r.from.include.iter().any(|d| matches!(d, DomainMatcher::Regex(_)))
        && r.to.is_empty()
        && r.denyallow.is_empty()
        && r.method.include.is_empty()
        && r.method.exclude.is_empty()
        && r.runtime_only_options.is_empty()
        && r.negated_types.is_empty()
        && !r.important
        && !matches!(r.party, Party::StrictFirst | Party::StrictThird)
        && matches!(r.action, NetworkAction::Block)
}

/// What `$badfilter` compares of a rule: no provenance, flag or types, and
/// for a "just origin" filter (`by_origin`) no page hostnames.
fn shape(r: &NetworkRule, by_origin: bool) -> NetworkRule {
    let mut r = r.clone();
    r.source = SourceRef::default();
    r.raw.clear();
    r.badfilter = false;
    r.types = ResourceTypes::empty();
    if by_origin {
        r.from.include.clear();
    }
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
        if !r.exception {
            return Err("dnr:scope-on-block".into());
        }
        // uBO stores the page options as types beside the request types, so
        // `@@...$elemhide,script` also allows the scripts it matches. The
        // page exception already covers `$document`'s own request.
        let types = r.types.difference(ResourceTypes::DOC);
        let requests = NetworkRule { scope: ExceptionScope::empty(), types, ..r.clone() };
        let page = compile_scope(r, v, out);
        if !types.is_empty() {
            compile_rule(&requests, v, ctx, out, tier)?;
        }
        return page;
    }
    let exception = r.exception;
    // `@@...$cname` only exempts a request 
```

### Core Architecture Module: `Packages/wblock-engine/crates/wbe/src/compile/prune.rs`
```
//! Drops `ignore-previous-rules` that cancel nothing. WebKit applies one to
//! the earlier rules of its own list that match the same load, so an ignore
//! no earlier rule can match together with it changes no verdict, yet it
//! still costs compile time. #836 copies exceptions into every blocker whose
//! blocks they might lift, and shards keep all of a list's exceptions.
//!
//! The test errs toward keeping. Two triggers are disjoint only when their
//! resource types, load types or load contexts share nothing, their page
//! conditions provably exclude each other, or both url-filters are anchored
//! at hosts that cannot be the same. Everything else, including any
//! url-filter not anchored at a whole host, overlaps.
//!
//! Host anchors: `^[a-z]+://([a-z0-9._-]+\.)?host` or `^[a-z]+://host`, then `/`,
//! `:`, `[/:?#]`, `\?` or `$`. In an http, https, ws or wss URL the text
//! between `//` and the first `/` or `:` (the authority, up to a port or
//! password) holds no `?` or `#`, so such a filter matches only when that
//! text is `host` or ends in `.host` (or is exactly `host`). Two anchors meet
//! exactly when one host is the other or, where subdomains match, a
//! subdomain of it. Separator classes (`[^a-zA-Z0-9_.%-]`) can match `@` in
//! a user name, so they do not end an anchor. The same holds for `if-top-url`
//! and `unless-top-url` regexes, which `regex::host_top_url` writes in this
//! form. `if-domain` compiles to an unanchored regex in WebKit, so it is any
//! page.

use crate::webkit::{WkLoadContext, WkLoadType, WkResourceType, WkTrigger};
use rustc_hash::{FxHashMap, FxHashSet};

use super::regex::{EXACT_START, HOST_START};
/// What may follow a host for the filter to end the host there.
const HOST_ENDS: [&str; 5] = ["[/:?#]", "/", ":", "\\?", "$"];

/// A host a url-filter or top-URL regex is anchored at. `star` when its
/// subdomains match too.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub(crate) struct Host {
    name: Box<str>,
    star: bool,
}

/// The pages a trigger fires on.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub(crate) enum Page {
    Any,
    /// Only pages on one of these hosts.
    If(Box<[Host]>),
    /// Every page except some on these hosts (a subset of the excluded ones).
    Unless(Box<[Host]>),
}

/// What `prune` needs of one rule.
#[derive(Clone, Debug)]
pub(crate) struct Shape {
    pub(crate) ignore: bool,
    /// None when the url-filter is not anchored at a whole host.
    url: Option<Host>,
    types: u16,
    load: u8,
    context: u8,
    page: Page,
}

const ALL_TYPES: u16 = (1 << 13) - 1;

fn type_bit(t: WkResourceType) -> u16 {
    1 << t as u16
}

impl Shape {
    pub(crate) fn new(
        ignore: bool,
        url: &str,
        types: Option<&[WkResourceType]>,
        load: Option<&[WkLoadType]>,
        context: Option<&[WkLoadContext]>,
        page: Page,
    ) -> Shape {
        Shape {
            ignore,
            url: anchor(url).map(|(host, _)| host),
            types: types.map_or(ALL_TYPES, |t| t.iter().fold(0, |m, &t| m | type_bit(t))),
            load: load.map_or(3, |l| l.iter().fold(0, |m, &l| m | 1 << l as u8)),
            context: context.map_or(3, |c| c.iter().fold(0, |m, &c| m | 1 << c as u8)),
            page,
        }
    }

    pub(crate) fn of_trigger(ignore: bool, t: &WkTrigger) -> Shape {
        let page = if let Some(urls) = &t.if_top_url {
            if_page(urls.iter().map(String::as_str))
        } else if let Some(urls) = &t.unless_top_url {
            unless_page(urls.iter().map(String::as_str))
        } else if let Some(domains) = &t.unless_domain {
            Page::Unless(domains.iter().map(|d| domain_host(d)).collect())
        } else {
            // if-domain, if-frame-url and unless-frame-url: any page.
            Page::Any
        };
        Shape::new(
            ignore,
            &t.url_filter,
            t.resource_type.as_deref(),
            t.load_type.as_deref(),
            t.load_context.as_deref(),
            page,
        )
    }

    /// The shape with its page condition replaced.
    pub(crate) fn set_page(&mut self, page: Page) {
        self.page = page;
    }
}

/// `if-top-url` regexes: any page when one of them is not a host anchor.
pub(crate) fn if_page<'a>(urls: impl Iterator<Item = &'a str>) -> Page {
    urls.map(|u| anchor(u).map(|(host, _)| host))
        .collect::<Option<Box<[Host]>>>()
        .map_or(Page::Any, Page::If)
}

/// `unless-top-url` regexes. Only a regex that matches every page of its
/// host (nothing after the host) may stand for that host; the rest are left
/// out, which leaves fewer pages excluded.
pub(crate) fn unless_page<'a>(urls: impl Iterator<Item = &'a str>) -> Page {
    Page::Unless(urls.filter_map(anchor).filter(|(_, whole)| *whole).map(|(host, _)| host).collect())
}

/// An `if-domain`/`unless-domain` entry: `*host` also matches subdomains.
pub(crate) fn domain_host(entry: &str) -> Host {
    match entry.strip_prefix('*') {
        Some(name) => Host { name: name.into(), star: true },
        None => Host { name: entry.into(), star: false },
    }
}

/// The host `filter` is anchored at, and whether nothing but the host's end
/// follows it.
fn anchor(filter: &str) -> Option<(Host, bool)> {
    let (rest, star) = match filter.strip_prefix(HOST_START) {
        Some(rest) => (rest, true),
        None => (filter.strip_prefix(EXACT_START)?, false),
    };
    let bytes = rest.as_bytes();
    let mut name = String::new();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'\\' if bytes.get(i + 1) == Some(&b'.') => {
                name.push('.');
                i += 2;
            }
            b @ (b'a'..=b'z' | b'0'..=b'9' | b'-') => {
                name.push(b as char);
                i += 1;
            }
            // A case-sensitive filter can name an uppercase host, which no
            // URL has; as lowercase it matches more, which is safe.
            b @ b'A'..=b'Z' => {
                name.push(b.to_ascii_lowercase() as char);
                i += 1;
            }
            _ => break,
        }
    }
    let tail = &rest[i..];
    if name.is_empty() || name.starts_with('.') || name.ends_with('.') || name.contains("..") {
        return None;
    }
    HOST_ENDS.iter().any(|e| tail.starts_with(e)).then(|| (Host { name: name.into(), star }, tail == "[/:?#]"))
}

/// `host` and each parent of it: `a.b.c`, `b.c`, `c`.
fn labels(host: &str) -> impl Iterator<Item = &str> {
    std::iter::once(host).chain(host.match_indices('.').map(|(i, _)| &host[i + 1..]))
}

/// Whether one URL host can match both anchors.
fn hosts_meet(a: &Host, b: &Host) -> bool {
    let under = |x: &Host, y: &Host| {
        y.star && x.name.len() > y.name.len() && x.name.ends_with(&*y.name)
            && x.name.as_bytes()[x.name.len() - y.name.len() - 1] == b'.'
    };
    a.name == b.name || under(a, b) || under(b, a)
}

/// Whether `unless` excludes every page `host` matches.
fn covered(host: &Host, unless: &[Host]) -> bool {
    unless.iter().any(|u| {
        u.name == host.name && (u.star || !host.star)
            || u.star && host.name.len() > u.name.len() && host.name.ends_with(&*u.name)
                && host.name.as_bytes()[host.name.len() - u.name.len() - 1] == b'.'
    })
}

fn pages_meet(a: &Page, b: &Page) -> bool {
    match (a, b) {
        (Page::Any, _) | (_, Page::Any) | (Page::Unless(_), Page::Unless(_)) => true,
        (Page::If(a), Page::If(b)) => a.iter().any(|x| b.iter().any(|y| hosts_meet(x, y))),
        (Page::If(hosts), Page::Unless(unless)) | (Page::Unless(unless), Page::If(hosts)) => {
            !hosts.iter().all(|h| covered(h, unless))
        }
    }
}

/// A rule without its url, with its page interned in `Pages`.
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
struct Sig {
    types: u16,
    load: u8,
    context: u8,
    page: u32,
}

/// Interned page conditions and which pairs of them meet.
#[derive(Default)]
struct Pages {
    ids: FxHashMap<Page, u32>,
    list: Vec<Page>,
    meets: FxHashMap<(u32, u32), bool>,
}

impl Pages {
    fn sig(&mut self, shape: &Shape) -> Sig {
        let page = match self.ids.get(&shape.page) {
            Some(&id) => id,
            None => {
                let id = self.list.len() as u32;
                self.ids.insert(shape.page.clone(), id);
                self.list.push(shape.page.clone());
                id
            }
        };
        Sig { types: shape.types, load: shape.load, context: shape.context, page }
    }

    fn meet(&mut self, a: Sig, b: Sig) -> bool {
        if a.types & b.types == 0 || a.load & b.load == 0 || a.context & b.context == 0 {
            return false;
        }
        let key = (a.page.min(b.page), a.page.max(b.page));
        let list = &self.list;
        *self.meets.entry(key).or_insert_with(|| pages_meet(&list[a.page as usize], &list[b.page as usize]))
    }
}

/// The rules seen so far, indexed by the host their url-filter is anchored at.
#[derive(Default)]
pub(crate) struct Seen {
    pages: Pages,
    /// Every rule's signature.
    all: FxHashSet<Sig>,
    /// Rules not anchored at a host.
    floating: FxHashSet<Sig>,
    /// Cosmetic hides, which only the page exceptions meant for them cancel.
    hides: FxHashSet<Sig>,
    /// Host -> (subdomains too, signature) of the rules anchored there.
    hosts: FxHashMap<Box<str>, FxHashSet<(bool, Sig)>>,
    /// Host -> signatures of the rules anchored strictly below it.
    below: FxHashMap<Box<str>, FxHashSet<Sig>>,
}

impl Seen {
    /// Records a rule that is not an ignore.
    pub(crate) fn add(&mut self, shape: &Shape) {
        let sig = self.pages.sig(shape);
        self.all.insert(sig);
        match &shape.url {
            None => {
                self.floating.insert(sig);
            }
            Some(host) => {
                self.hosts.entry(host.name.clone()).or_default().insert((host.star, sig));
                for parent i
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1115** (2026-11-16): **[BUG] wBlock alpha breaks Spotify**
  *Symptoms*: ### Describe the bug  When opening open.spotify.com, playback does not work, it just skips around songs and puts up the message Spotify can’t play this now. I was hoping the new alpha might fix this and be better than uBOL in this way, since it can run more scriptlets from my understanding.  ### To reproduce  Steps to reproduce the behavior: 1. Go to 'open.spotify.com’ 2. Play a song or album. 3. See it skip around and error out.   ### Expected behavior  It would allow playback and skip audio ads in the player like uBO. Thanks for all the great work! You’re amazing!  ### Screenshot or video  _No response_  ### Environment  - OS: [iPadOS 27.3 beta] - wBlock Version: [4.0.0 alpha]   ### Troubleshooting checklist  - [x] I have enabled all 5 wBlock Content Blocker extensions in Safari _(including Profiles, if applicable)_. - [x] I have enabled `wBlock Scripts` and set it to `Allow` on all websites (`Always Allow on Every Website`) in Safari settings. - [x] I have enabled `Allow in Private Browsing` for `wBlock Scripts` and all 5 content blockers _(Safari → Settings → Extensions)_. - [x] I have opened wBlock and pressed `Apply Changes` after changing filters, userscripts, whitelist, and/or extension settings. - [x] For filtering issues, I have restarted iOS/iPadOS and/or macOS, opened wBlock, manually checked for updates 🔄, and reopened Safari. _(Optional)_  ### Additional context  Logs attached  [wBlock_logs_11-15-2026.txt](https://github.com/user-attachments/files/34896152/wBlo

- **Issue #1114** (2026-11-14): **[BUG] [iOS - wBlock] Bypass Paywalls Clean fails on Télérama and Courrier International (works on Le Monde)**
  *Symptoms*: ### Describe the bug  ### Describe the bug The **Bypass Paywalls Clean** userscript fails to bypass paywalls on certain French news websites—specifically **Télérama** and **Courrier International**—when running through the **wBlock** app on iOS.   However, the paywall bypass works properly on **Le Monde** (`lemonde.fr`) with the exact same setup.  ### Active wBlock Configuration - **Filter enabled:** `Bypass Paywalls Clean Filter` - **Userscripts enabled:**    - `Bypass Paywalls Clean`   - `Bypass Paywalls Clean - fr`  ### Context & Comparison - **App/Extension:** wBlock (iOS) - **Affected websites (not working):**    - https://www.telerama.fr   - https://www.courrierinternational.com - **Working website:**    - https://www.lemonde.fr (works as expected) - **Browser/App Comparison:** This issue does **not** occur when using *Stay for Safari* on the same iOS device with the exact same userscripts. Both Télérama and Courrier International are bypassed properly in Safari via Stay.    ### To reproduce  Steps to reproduce the behavior: 1. In wBlock on iOS, enable the `Bypass Paywalls Clean Filter` as well as both `Bypass Paywalls Clean` and `Bypass Paywalls Clean - fr` userscripts. 2. Open a paywalled article on `lemonde.fr` and observe that it unlocks properly. 3. Navigate to a paywalled article on `telerama.fr` or `courrierinternational.com`. 4. Observe that the paywall remains active and the full article content stays locked/hidden.   ### Expected behavior  _No response_  ### S

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

### Incident Patch 1: `03e46e4a` (2026-11-16)
**Commit Message**: fix(engine): Respect Spotify music exceptions across blockers

**File**: `extension-src/background.js` (modified, +4/-2)
```diff
@@ -2000,7 +2000,8 @@
   // supported dynamic DNR but did not expose their quota, so keep a
   // conservative compatibility ceiling only for that legacy tier.
   const REMOVE_PARAM_DNR_OLD_SAFARI_FALLBACK_LIMIT = 5000;
-  const REDIRECT_DNR_STATUS_REPORT_KEY = "wblockRedirectDNRStatusReport";
+  // Old entries could claim success after native rejected the report.
+  const REDIRECT_DNR_STATUS_REPORT_KEY = "wblockRedirectDNRStatusReportV2";
   const REDIRECT_DNR_STATUS_REPORT_THROTTLE_MS = 6 * 60 * 60 * 1000;
   let removeParamDNRInstallPromise = null;
   let removeParamDNRRulesCache = null;
@@ -2163,12 +2164,13 @@
       if (shouldReport) {
         // Priority path: a slow queued request (script updates wait up to
         // two minutes) must not hold this report until the page suspends.
-        await sendPriorityNativeMessage({
+        const response = await sendPriorityNativeMessage({
           action: "reportRedirectDNRStatus",
           installedRedirects,
           hostAccess,
           privateAccess
         });
+        if (response?.ok !== true) throw new Error("Native host did not save redirect status");
         await browser.storage.local.set({ [REDIRECT_DNR_STATUS_REPORT_KEY]: status });
       }
     } catch (error) {
```

**File**: `scripts/test_redirect_dnr_rules.swift` (modified, +145/-0)
```diff
@@ -73,9 +73,154 @@ struct RedirectDNRRuleTests {
         expect(!RemoveParamDNRRuleGenerator.carveOutsAllowed(status: bad, redirectCount: 4, now: now), "fewer installed than planned")
         expect(!RemoveParamDNRRuleGenerator.carveOutsAllowed(status: good, redirectCount: 4, now: now.addingTimeInterval(4 * 86_400)), "stale report")
         expect(!RemoveParamDNRRuleGenerator.carveOutsAllowed(status: nil, redirectCount: 4, now: now), "never reported")
+
+        plainExceptions()
+        try savedRules()
         print("redirect DNR rule tests passed")
     }
 
+    typealias Rule = RemoveParamDNRRuleGenerator.DeclarativeRule
+
+    /// Redirect rules resolved from `lists`, each extracted as its own list, by URL filter.
+    static func redirects(_ lists: String...) -> [String: Rule] {
+        let sources = lists.map { RemoveParamDNRRuleGenerator.extractRedirectLines(from: $0) }
+        let rules = RemoveParamDNRRuleGenerator.generateRules(from: "", redirectSources: sources).rules
+        return Dictionary(
+            rules.filter { $0.action.redirect?.extensionPath != nil }.map { ($0.condition.urlFilter ?? "", $0) },
+            uniquingKeysWith: { first, _ in first }
+        )
+    }
+
+    /// A blocking exception stops the redirect of the requests it covers, and nothing else.
+    static func plainExceptions() {
+        let directives = """
+        ||cdn.example/lib.js$script,redirect=noopjs
+        ||media.example/audio/$media,redirect=noop-1s.mp4,domain=player.example
+        ||media.example/audio/$script,redirect=noopjs,domain=player.example
+        ||media.example/mp3/$media,redirect=noop-1s.mp4,domain=player.example
+        ||ads.media.example^$media,redirect=noop-1s.mp4,domain=player.example
+        ||tags.example/gpt.js$script,redirect=noopjs
+        ||typeless.example/a.js$redirect=noopjs
+        ||party.example/t.js$script,redirect=noopjs
+        ||adhost.example/tag.js$script,redirect=noopjs
+        ||static.site.example/app.js$script,redirect=noopjs
+        ||firm.example/x.js$script,redirect=noopjs,important
+        ||firmer.example/x.js$script,redirect=noopjs,important
+        ||revived.example/x.js$script,redirect=noopjs
+        ||cosmetic.example/x.js$script,redirect=noopjs
+        ||wide.example^$script,redirect=noopjs
+        ||wild.example/v2/sdk.js$script,redirect=noopjs
+        ||wild.example/v2/other.js$script,redirect=noopjs
+        ||hit.metrics.example/g.js$script,redirect=noopjs
+        """
+        let exceptions = """
+        @@||cdn.example^
+        @@||media.example/audio/$media,domain=player.example
+        @@||tags.example/gpt.js$script,domain=news.example
+        @@||typeless.example/a.js$script
+        @@||party.example/t.js$third-party
+        @@*$script,1p,domain=site.example
+        @@*$script,domain=entity.*
+        @@||firm.example^$script
+        @@||firmer.example^$script,important
+        @@||revived.example^$script
+        @@||cosmetic.example^$elemhide
+        @@||cosmetic.example^$document
+        @@||cosmetic.example^$csp=script-src 'self'
+        @@||wide.example/keep.js$script
+        @@||wild.example/*/sdk.js$script
+        @@||metrics.example/g.js
+        """
+        let kept = RemoveParamDNRRuleGenerator.extractRedirectLines(from: exceptions)
+        expect(kept.contains("@@||cdn.example^\n"), "extraction keeps an exception from a list with no redirect")
+        expect(!kept.contains("elemhide") && !kept.contains("csp"), "extraction drops exceptions from other than blocking")
+
+        let rules = redirects(directives, exceptions, "@@||revived.example^$script,badfilter")
+        expectEqual(Set(rules.keys), [
+            "||media.example/audio/", "||media.example/mp3/", "||ads.media.example^", "||tags.example/gpt.js",
+            "||typeless.example/a.js", "||party.example/t.js", "||adhost.example/tag.js",
+            "||static.site.example/app.js", "||firm.example/x.js", "||revived.example/x.js",
+            "||cosmetic.example/x.js", "||wide.example^", "||wild.example/v2/other.js",
+        ], "exceptions drop only the directives they cover")
+        expectEqual(redirects(directives).count, 17, "every directive resolves without the exceptions")
+        expectEqual(redirects(directives)["||media.example/audio/"]!.condition.resourceTypes, ["media"], "the media directive resolves without its exception")
+        expectEqual(rules["||media.example/audio/"]!.condition.resourceTypes, ["script"], "a media exception leaves the script directive")
+
+        let tags = rules["||tags.example/gpt.js"]!
+        expectEqual(tags.condition.excludedDomains, ["news.example"], "a scoped exception is subtracted")
+        expectEqual(RemoveParamDNRRuleGenerator.carveOutLine(for: tags), "@@||tags.example/gpt.js$script,domain=~news.example,important", "the carve-out leaves the excepted site blocked")
+        expectEqual(rules["||typeless.example/a.js"]!.condition.resourceTypes, ["xmlhttprequest"], "an excepted t
```

**File**: `scripts/test_redirect_dnr_status_report.mjs` (modified, +40/-4)
```diff
@@ -125,6 +125,7 @@ const loadBackground = ({
           { id: 1500001, priority: 15100, action: { type: "redirect", redirect: { extensionPath: "/redirects/noop.html" } }, condition: {} }
         ], ruleIdBase: 1500000, ruleIdLimit: 1650000 };
       }
+      if (message?.action === "reportRedirectDNRStatus") return { ok: true };
       return { payload: { css: [], procedural: [], scriptlets: [], engineTimestamp: 1 } };
     },
     permissions: { '{\"origins\":[\"*://*/*\"]}': true },
@@ -139,7 +140,7 @@ const loadBackground = ({
   check("report has correct installedRedirects count", statusReport && statusReport.installedRedirects === 2);
   check("report has correct hostAccess", statusReport && statusReport.hostAccess === true);
   check("report has correct privateAccess", statusReport && statusReport.privateAccess === false);
-  check("status is persisted in storage", state.storage.wblockRedirectDNRStatusReport && state.storage.wblockRedirectDNRStatusReport.installedRedirects === 2);
+  check("status is persisted in storage", state.storage.wblockRedirectDNRStatusReportV2 && state.storage.wblockRedirectDNRStatusReportV2.installedRedirects === 2);
 }
 
 // Scenario B: second run within 6 hours with unchanged values sends nothing
@@ -148,7 +149,7 @@ const loadBackground = ({
   const state = loadBackground({
     storage: {
       wblockRemoveParamDNRVersion: { version: "test", count: 2 },
-      wblockRedirectDNRStatusReport: previousReport
+      wblockRedirectDNRStatusReportV2: previousReport
     },
     nativeHandler: message => {
       if (message && message.action === "getRemoveParamDNRRules") {
@@ -157,6 +158,7 @@ const loadBackground = ({
           { id: 1500001, priority: 15100, action: { type: "redirect", redirect: { extensionPath: "/redirects/noop.html" } }, condition: {} }
         ], ruleIdBase: 1500000, ruleIdLimit: 1650000 };
       }
+      if (message?.action === "reportRedirectDNRStatus") return { ok: true };
       return { payload: { css: [], procedural: [], scriptlets: [], engineTimestamp: 1 } };
     },
     permissions: { '{\"origins\":[\"*://*/*\"]}': true },
@@ -179,7 +181,7 @@ const loadBackground = ({
   const state = loadBackground({
     storage: {
       wblockRemoveParamDNRVersion: { version: "test", count: 2 },
-      wblockRedirectDNRStatusReport: previousReport
+      wblockRedirectDNRStatusReportV2: previousReport
     },
     nativeHandler: message => {
       if (message && message.action === "getRemoveParamDNRRules") {
@@ -188,6 +190,7 @@ const loadBackground = ({
           { id: 1500001, priority: 15100, action: { type: "redirect", redirect: { extensionPath: "/redirects/noop.html" } }, condition: {} }
         ], ruleIdBase: 1500000, ruleIdLimit: 1650000 };
       }
+      if (message?.action === "reportRedirectDNRStatus") return { ok: true };
       return { payload: { css: [], procedural: [], scriptlets: [], engineTimestamp: 1 } };
     },
     permissions: { '{\"origins\":[\"*://*/*\"]}': false },
@@ -214,6 +217,7 @@ const loadBackground = ({
           { id: 1500000, priority: 15000, action: { type: "redirect", redirect: { extensionPath: "/redirects/noopjs.js" } }, condition: {} }
         ], ruleIdBase: 1500000, ruleIdLimit: 1650000 };
       }
+      if (message?.action === "reportRedirectDNRStatus") return { ok: true };
       return { payload: { css: [], procedural: [], scriptlets: [], engineTimestamp: 1 } };
     },
     permissions: { '{\"origins\":[\"*://*/*\"]}': true },
@@ -240,7 +244,8 @@ const loadBackground = ({
             { id: 1500000, priority: 15000, action: { type: "redirect", redirect: { extensionPath: "/redirects/noopjs.js" } }, condition: {} }
           ], ruleIdBase: 1500000, ruleIdLimit: 1650000 };
         }
-        return { payload: { css: [], procedural: [], scriptlets: [], engineTimestamp: 1 } };
+        if (message?.action === "reportRedirectDNRStatus") return { ok: true };
+      return { payload: { css: [], procedural: [], scriptlets: [], engineTimestamp: 1 } };
       },
       onMessage: { addListener: () => {} },
       connectNative: () => ({ onMessage: { addListener: () => {} }, onDisconnect: { addListener: () => {} } }),
@@ -305,6 +310,7 @@ const loadBackground = ({
           { id: 1500003, priority: 1, action: { type: "allow" }, condition: {} }
         ], ruleIdBase: 1500000, ruleIdLimit: 1650000 };
       }
+      if (message?.action === "reportRedirectDNRStatus") return { ok: true };
       return { payload: { css: [], procedural: [], scriptlets: [], engineTimestamp: 1 } };
     },
     permissions: { '{\"origins\":[\"*://*/*\"]}': true },
@@ -318,6 +324,36 @@ const loadBackground = ({
   check("counts only extension path redirects", statusReport && statusReport.installedRedirects === 2);
 }
 
+// A rejected or missing acknowledgement must not throttle the next attempt.
+for (const acknowledgement of [{ ok: false }, undefined]) {
+  let response = acknowledgement;
+  const redirect = { id: 1500000, priority: 15000,
```

**File**: `wBlock Scripts (iOS)/Resources/background.js` (modified, +41/-41)
```diff
@@ -5,12 +5,12 @@ const i=o.slice(Me.length);if(i==="js")return z({target:t,world:"MAIN",injectImm
 AIN",injectImmediately:!0,func:Tt,args:[o]}))n.push(o);else for(const l of new Set(o.map(([p])=>p))){const p=await z({target:t,world:"MAIN",injectImmediately:!0,files:[`scriptlets/${l}.js`]});n.push(p?[]:o.filter(u=>u[0]===l))}return(await Promise.all(n)).flat()},Pt=t=>{if(t instanceof Error)return t.stack||t.message||String(t);if(typeof t=="string")return t;try{return JSON.stringify(t)}catch{return String(t)}},B=(...t)=>console.error(t.map(Pt).join(" ")),Ft=["permission","not allowed","denied",
 "cannot access","not granted","not permitted","does not have access","not found"],ge=t=>{const e=String(t&&t.message||t||"").toLowerCase();return Ft.some(r=>e.includes(r))},z=async t=>{let e;try{e=await s.scripting.executeScript(t)}catch(r){ge(r)||B("[wBlock] Failed to execute script in target",t.target,"error",r);return}if(e?.[0]?.error){ge(e[0].error)||B("[wBlock] Failed to execute script in target",t.target,"error",e[0].error);return}return e?.[0]},xt=(t,e,r)=>{const o={tabId:t,frameIds:[e]},
 n=r.css||[],i=r.procedural||[],l=[Ve(o,r.scriptlets||[])],p=[...r.styles||[],...n.map(u=>`${u} { display: none !important; }`)];for(let u=0;u<p.length;u+=je)l.push(s.scripting.insertCSS({target:o,origin:"USER",css:p.slice(u,u+je).join(`
-`)}));for(const u of["ISOLATED","MAIN"]){const g=i.filter(m=>/"type"\s*:\s*"matches-(?:prop|property)"/.test(m)===(u==="MAIN"));g.length&&l.push((async()=>{(await z({target:o,world:u,func:y=>globalThis.wbeProcedural?(globalThis.wbeProcedural.apply(y),!0):!1,args:[g]}))?.result||(await z({target:o,world:u,files:["procedural.js"],injectImmediately:!0}),await z({target:o,world:u,func:y=>wbeProcedural.apply(y),args:[g]}))})())}return Promise.allSettled(l).then(u=>{for(const g of u)g.status==="reject\
-ed"&&!ge(g.reason)&&B("[wBlock] Failed to apply configuration in target",o,"error",g.reason);return u[0].status==="fulfilled"?u[0].value:r.scriptlets||[]})},k=new Map,Bt=128,ye="wblockConfigCacheV2",Ke=40,Ut=1e3;let K=null;const Lt=()=>{if(K!==null)return;const t=G;K=setTimeout(async()=>{if(K=null,t===G)try{const e=[];for(const[r,o]of k)r.endsWith("#")&&e.push([r,o]);await s.storage.local.set({[ye]:{engineTimestamp:V,entries:e.slice(-Ke)}})}catch(e){console.warn("[wBlock] Failed to persist confi\
-g cache:",e)}},Ut)},qt=()=>(K!==null&&(clearTimeout(K),K=null),s.storage.local.remove(ye).catch(t=>{console.warn("[wBlock] Failed to clear persisted config cache:",t)})),We=(async()=>{const t=G;try{const e=await s.storage.local.get(ye);if(t!==G)return;const r=e&&e[ye];if(!r||typeof r.engineTimestamp!="number"||!Array.isArray(r.entries)||k.size>0||V!==0)return;V=r.engineTimestamp;for(const o of r.entries.slice(-Ke))Array.isArray(o)&&typeof o[0]=="string"&&o[1]&&typeof o[1]=="object"&&k.set(o[0],o[1])}catch(e){
+`)}));for(const u of["ISOLATED","MAIN"]){const g=i.filter(m=>/"type"\s*:\s*"matches-(?:prop|property)"/.test(m)===(u==="MAIN"));g.length&&l.push((async()=>{(await z({target:o,world:u,func:h=>globalThis.wbeProcedural?(globalThis.wbeProcedural.apply(h),!0):!1,args:[g]}))?.result||(await z({target:o,world:u,files:["procedural.js"],injectImmediately:!0}),await z({target:o,world:u,func:h=>wbeProcedural.apply(h),args:[g]}))})())}return Promise.allSettled(l).then(u=>{for(const g of u)g.status==="reject\
+ed"&&!ge(g.reason)&&B("[wBlock] Failed to apply configuration in target",o,"error",g.reason);return u[0].status==="fulfilled"?u[0].value:r.scriptlets||[]})},k=new Map,Bt=128,he="wblockConfigCacheV2",Ke=40,Ut=1e3;let K=null;const Lt=()=>{if(K!==null)return;const t=G;K=setTimeout(async()=>{if(K=null,t===G)try{const e=[];for(const[r,o]of k)r.endsWith("#")&&e.push([r,o]);await s.storage.local.set({[he]:{engineTimestamp:V,entries:e.slice(-Ke)}})}catch(e){console.warn("[wBlock] Failed to persist confi\
+g cache:",e)}},Ut)},qt=()=>(K!==null&&(clearTimeout(K),K=null),s.storage.local.remove(he).catch(t=>{console.warn("[wBlock] Failed to clear persisted config cache:",t)})),We=(async()=>{const t=G;try{const e=await s.storage.local.get(he);if(t!==G)return;const r=e&&e[he];if(!r||typeof r.engineTimestamp!="number"||!Array.isArray(r.entries)||k.size>0||V!==0)return;V=r.engineTimestamp;for(const o of r.entries.slice(-Ke))Array.isArray(o)&&typeof o[0]=="string"&&o[1]&&typeof o[1]=="object"&&k.set(o[0],o[1])}catch(e){
 console.warn("[wBlock] Failed to hydrate config cache:",e)}})(),te=async()=>{if(!(!s.tabs||typeof s.tabs.query!="function"))try{const t=await s.tabs.query({});await Promise.all(t.map(e=>!e||typeof e.id!="number"?Promise.resolve():s.tabs.sendMessage(e.id,{type:"wblock:clearDocumentStartSessionCache"}).catch(()=>{})))}catch{}};let Ze=Promise.resolve();const Xe=t=>{const e=t&&typeof t.action=="string"?t.action:"";return e==="syncZapperRules"||e==="getZapperRules"?3500:e==="startFilterUpdate"||e==="\
-getFilterUpdateStatus"?1e4:e==="maybeUpdateUserScripts"||e==="maybeStageFilterUpdates"?12e4:e==="getBlockingSta
```

**File**: `wBlockCoreService/RedirectDNRRules.swift` (modified, +312/-91)
```diff
@@ -1,4 +1,5 @@
 import Foundation
+internal import WBEngine
 
 // `$redirect` support: a matching request is served a bundled stand-in from
 // wBlock Scripts instead of failing. Safari content blockers cannot redirect,
@@ -9,7 +10,17 @@ import Foundation
 // pattern, domains, or resource are not exactly representable. `$redirect-rule`
 // (replace only if something else blocks) has no DNR form; it is used only when
 // the same list blocks the request's whole host and excepts nothing there.
+//
+// A blocking exception (`@@||host/path$script`) from any list also stops a
+// redirect of the requests it covers, as it stops the block they stand in for.
 extension RemoveParamDNRRuleGenerator {
+    /// Bump when `extractRedirectLines` changes, so cached lists rescan.
+    static let redirectExtractionFormat = 2
+    /// The built-in compatibility rules reach every content blocker, so their
+    /// exceptions are weighed against every list's redirects too.
+    static let compatibilityRedirectLines = extractRedirectLines(
+        from: ContentBlockerService.embeddedCompatibilityRules
+    )
     static let redirectPriority = 15_000
     static let importantRedirectPriority = 15_100
     public static let redirectCarveOutsFilename = "redirect_carveouts.txt"
@@ -37,6 +48,19 @@ extension RemoveParamDNRRuleGenerator {
         "gif": ["image"], "png": ["image"], "mp3": ["media"], "mp4": ["media"],
     ]
 
+    /// DNR type of a resource-type option, including types no stand-in serves.
+    private static func requestType(_ option: String) -> String? {
+        redirectTypeMap[option] ?? resourceTypeMap[option]?.first
+    }
+
+    private static func domainType(_ option: String) -> String? {
+        switch option {
+        case "third-party", "3p", "~first-party", "~1p": return "thirdParty"
+        case "~third-party", "~3p", "first-party", "1p": return "firstParty"
+        default: return nil
+        }
+    }
+
     struct RedirectLine {
         var isException: Bool
         var pattern: String
@@ -47,22 +71,26 @@ extension RemoveParamDNRRuleGenerator {
         var token: String?
         var isConditional: Bool
         var isBadfilter: Bool
+        /// A blocking exception with no redirect option, such as `@@||host^$script`.
+        var isPlain: Bool
 
         init?(_ rawLine: Substring) {
-            var line = rawLine.trimmingCharacters(in: .whitespaces)
+            let line = rawLine.trimmingCharacters(in: .whitespaces)
+            // The byte check spares the five searches: few network rules have a `#`.
             guard !line.isEmpty, !line.hasPrefix("!"), !line.hasPrefix("["),
-                  !line.contains("##"), !line.contains("#@#"), !line.contains("#%#"),
-                  !line.contains("#$#"), !line.contains("#?#"),
-                  let dollar = line.lastIndex(of: "$")
+                  !line.utf8.contains(UInt8(ascii: "#"))
+                    || !["##", "#@#", "#%#", "#$#", "#?#"].contains(where: line.contains)
             else { return nil }
             isException = line.hasPrefix("@@")
-            pattern = String(line[..<dollar])
+            let dollar = line.lastIndex(of: "$")
+            pattern = String(line[..<(dollar ?? line.endIndex)])
             if isException { pattern.removeFirst(2) }
-            line = String(line[line.index(after: dollar)...])
             var token: String?
             var kind: String?
             var rest: [(name: String, value: String?)] = []
-            for option in RemoveParamDNRRuleGenerator.splitOptions(line) {
+            for option in RemoveParamDNRRuleGenerator.splitOptions(
+                dollar.map { String(line[line.index(after: $0)...]) } ?? ""
+            ) {
                 let pair = RemoveParamDNRRuleGenerator.optionNameAndValue(option)
                 if pair.name == "redirect" || pair.name == "redirect-rule" {
                     guard kind == nil else { return nil }
@@ -79,17 +107,34 @@ extension RemoveParamDNRRuleGenerator {
                     rest.append(pair)
                 }
             }
-            guard let kind else { return nil }
+            isPlain = kind == nil
             isConditional = kind == "redirect-rule"
             isBadfilter = rest.contains { $0.name == "badfilter" }
             options = rest.filter { $0.name != "badfilter" }
             self.token = token.flatMap { $0.isEmpty ? nil : $0 }
+            // Any other option makes it an exception from something other than
+            // blocking (`$elemhide`, `$csp`), or narrows it in a way not modelled
+            // here (`$to`). A regex pattern cannot be compared with a directive.
+            if isPlain {
+                guard isException, !(pattern.hasPrefix("/") && pattern.hasSuffix("/") && pattern.count > 1),
+                      options.allSatisfy({ option in
+                          switch option.name {
+                          case "domain": return option.value != nil
+                          case "
```

**File**: `wBlockCoreService/RemoveParamDNRRuleGenerator.swift` (modified, +17/-7)
```diff
@@ -213,9 +213,10 @@ public enum RemoveParamDNRRuleGenerator {
     public static func generateRules(
         from rulesText: String,
         redirectSources: [String] = [],
+        scopedRedirectSources: Set<Int> = [],
         disabledSites: [String] = []
     ) -> (rules: [DeclarativeRule], summary: Summary) {
-        let resolvedRedirects = resourceRedirectRules(fromSources: redirectSources)
+        let resolvedRedirects = resourceRedirectRules(fromSources: redirectSources, scopedSources: scopedRedirectSources)
         let disabledRules = makeDisabledSiteAllowRules(
             disabledSites,
             startingID: ruleIDBase,
@@ -357,6 +358,7 @@ public enum RemoveParamDNRRuleGenerator {
         let generated = generateRules(
             from: extracted.removeParam,
             redirectSources: extracted.redirectSources,
+            scopedRedirectSources: extracted.scopedRedirectSources,
             disabledSites: disabledSites
         )
         try? FileManager.default.removeItem(at: containerURL.appendingPathComponent(generationStateFilename))
@@ -411,7 +413,7 @@ public enum RemoveParamDNRRuleGenerator {
     }
 
     /// Bump when the generator's output changes for the same inputs.
-    private static let generationSchema = 8
+    private static let generationSchema = 9
     private static let generationStateFilename = "dnr-generation-state.json"
 
     private final class BuildMarker {}
@@ -427,6 +429,7 @@ public enum RemoveParamDNRRuleGenerator {
         var canonical = "schema=\(generationSchema)\nbuild=\(bundle.infoDictionary?["CFBundleShortVersionString"] ?? "")"
         canonical += "|\(bundle.infoDictionary?["CFBundleVersion"] ?? "")\n"
         canonical += "blocked=\(blockedCount ? blockedCountExtractionFormat : 0)\n"
+        canonical += "redirect=\(redirectExtractionFormat)|\(compatibilityRedirectLines)\n"
         canonical += "disabled=\(disabledSites.joined(separator: "\n"))\n"
         for filter in filters {
             guard let sourceURL = ContentBlockerIncrementalCache.existingLocalFileURL(
@@ -470,6 +473,8 @@ public enum RemoveParamDNRRuleGenerator {
         var fingerprint: String
         var lines: String
         var redirectLines: String
+        /// Missing in caches written before plain exceptions were kept.
+        var redirectFormat: Int?
         /// Missing in caches written before the blocked-request count.
         var blockedCountLines: String?
         var blockedCountFormat: Int?
@@ -482,7 +487,7 @@ public enum RemoveParamDNRRuleGenerator {
         for filters: [FilterList],
         containerURL: URL,
         includeBlockedCount: Bool
-    ) -> (removeParam: String, redirectSources: [String], blockedCount: String, pageRules: [PageRule]) {
+    ) -> (removeParam: String, redirectSources: [String], scopedRedirectSources: Set<Int>, blockedCount: String, pageRules: [PageRule]) {
         try? FileManager.default.removeItem(
             at: containerURL.appendingPathComponent(legacyExtractionCacheFilename)
         )
@@ -504,7 +509,7 @@ public enum RemoveParamDNRRuleGenerator {
             let key = sourceURL.lastPathComponent
             let fingerprint = fileFingerprint(at: sourceURL) ?? "missing"
             let cached = cache[key].flatMap { entry in
-                entry.fingerprint == fingerprint
+                entry.fingerprint == fingerprint && entry.redirectFormat == redirectExtractionFormat
                     && (!includeBlockedCount || entry.blockedCountFormat == blockedCountExtractionFormat)
                     ? entry : nil
             }
@@ -518,6 +523,7 @@ public enum RemoveParamDNRRuleGenerator {
                     fingerprint: sources[index].fingerprint,
                     lines: extractRemoveParamLines(from: contents),
                     redirectLines: extractRedirectLines(from: contents),
+                    redirectFormat: redirectExtractionFormat,
                     blockedCountLines: includeBlockedCount ? extractBlockedCountLines(from: contents) : nil,
                     blockedCountFormat: includeBlockedCount ? blockedCountExtractionFormat : nil
                 )
@@ -529,7 +535,8 @@ public enum RemoveParamDNRRuleGenerator {
         var pageRules: [PageRule] = []
         var scopedExceptions = Set<String>()
         var blockedCount = ""
-        var redirectSources: [String] = []
+        var redirectSources = [compatibilityRedirectLines].filter { !$0.isEmpty }
+        var scopedRedirectSources = Set<Int>()
         var updated: [String: ExtractionEntry] = [:]
         var cacheChanged = false
         for (index, source) in sources.enumerated() {
@@ -548,7 +555,10 @@ public enum RemoveParamDNRRuleGenerator {
                 return page
             }
             if includeBlockedCount { blockedCount.append(entry.blockedCountLines ?? "") }
-            if !entry.redirectLines.isEmpty { redirectSources.append(entry.redirectLines) }
+            if !entry.redirectLines.isEmpty {
+                if 
```

**File**: `wBlockCoreService/wBlockCoreService.swift` (modified, +9/-2)
```diff
@@ -152,7 +152,8 @@ private struct StoredTargetSourceRuleProvenance: Codable {
     // 11: collapse Pornhub's mobile top ad slot, whose padding outlives a hidden ad.
     // 12: hide Pornhub's ad boxes, from AdGuard Base and Mobile Ads.
     // 13: restore mobile YouTube request timing and guard initial backoff recovery.
-    public static let embeddedCompatibilityRulesVersion = "13"
+    // 14: keep Spotify FairPlay song segments out of media ad replacements.
+    public static let embeddedCompatibilityRulesVersion = "14"
     /// The engine and Safari level outputs are compiled for; see SafariVersionDetection.
     public static var compilerIdentity: String { SafariVersionDetection.compilerIdentity }
     public static var upgradeSignature: String {
@@ -184,7 +185,13 @@ private struct StoredTargetSourceRuleProvenance: Codable {
     ///
     /// Diagnostic-site rules are scoped to their hostnames so they do not affect
     /// normal browsing.
-    private static let embeddedCompatibilityRules = """
+    static let embeddedCompatibilityRules = """
+! Spotify FairPlay uses native HLS media for songs, unlike Chromium's fetch/MSE path.
+! These audio paths carry music in Safari and must not become silent ad replacements.
+@@||scdn.co/audio/$media,domain=open.spotify.com
+@@||spotifycdn.com/audio/$media,domain=open.spotify.com
+@@||akamaized.net/audio/$media,domain=open.spotify.com
+
 ! Common synthetic ad bait paths
 /js/widget/ads.js$script
 /js/pagead.js$script
```

---

### Incident Patch 2: `56856362` (2026-11-14)
**Commit Message**: fix(extension): Retry scriptlets after failed Safari injections

**File**: `extension-src/background.js` (modified, +38/-26)
```diff
@@ -33,7 +33,10 @@
   // page script element. Runs as a function, so it must not close over anything.
   const queueScriptletCalls = calls => {
     const queue = globalThis.__wbeScriptletCalls || (globalThis.__wbeScriptletCalls = {});
-    for (const [name, ...args] of calls) (queue[name] || (queue[name] = [])).push(args);
+    for (const [name, ...args] of calls) {
+      const pending = queue[name] || (queue[name] = []);
+      if (!pending.some(call => call.length === args.length && call.every((value, i) => value === args[i]))) pending.push(args);
+    }
   };
   // AdGuard-syntax rules with no uBO equivalent arrive as `adg:<name>` calls,
   // raw `#%#` scripts as `adg:js`; both run the way AdGuard runs them.
@@ -63,7 +66,7 @@
   };
   const runAdguardCalls = async (target, calls) => {
     const library = calls.some(([name]) => name !== 'adg:js') ? await loadAdguardScriptlets() : null;
-    await Promise.all(calls.map(([prefixed, ...args]) => {
+    return Promise.all(calls.map(([prefixed, ...args]) => {
       const name = prefixed.slice(ADGUARD_PREFIX.length);
       if (name === 'js') return executeInFrame({ target, world: 'MAIN', injectImmediately: true, func: runPageScript, args });
       const func = library && library.getScriptletFunction(name);
@@ -75,16 +78,19 @@
   const runScriptlets = async (target, calls) => {
     const adguard = calls.filter(([name]) => name.startsWith(ADGUARD_PREFIX));
     const ubo = adguard.length > 0 ? calls.filter(([name]) => !name.startsWith(ADGUARD_PREFIX)) : calls;
-    const pending = [];
-    if (adguard.length > 0) pending.push(runAdguardCalls(target, adguard));
+    const pending = adguard.map(async call => {
+      const [result] = await runAdguardCalls(target, [call]);
+      return result ? [] : [call];
+    });
     if (ubo.length > 0) {
-      pending.push((async () => {
-        await executeInFrame({ target, world: 'MAIN', injectImmediately: true, func: queueScriptletCalls, args: [ubo] });
-        const files = [...new Set(ubo.map(([name]) => `scriptlets/${name}.js`))];
-        await executeInFrame({ target, world: 'MAIN', injectImmediately: true, files });
-      })());
+      const queued = await executeInFrame({ target, world: 'MAIN', injectImmediately: true, func: queueScriptletCalls, args: [ubo] });
+      if (!queued) pending.push(ubo);
+      else for (const name of new Set(ubo.map(([name]) => name))) {
+        const result = await executeInFrame({ target, world: 'MAIN', injectImmediately: true, files: [`scriptlets/${name}.js`] });
+        pending.push(result ? [] : ubo.filter(call => call[0] === name));
+      }
     }
-    await Promise.all(pending);
+    return (await Promise.all(pending)).flat();
   };
   // Safari's extension error summary shows only the first console argument, so
   // each line is one string with its details folded in.
@@ -115,10 +121,13 @@
       }
       return;
     }
-    if (results && results.length > 0 && results[0].error) {
-      logError('[wBlock] Failed to execute script in target', injection.target, 'error', results[0].error);
+    if (results?.[0]?.error) {
+      if (!isSkippedTarget(results[0].error)) {
+        logError('[wBlock] Failed to execute script in target', injection.target, 'error', results[0].error);
+      }
+      return;
     }
-    return results && results.length > 0 ? results[0].result : undefined;
+    return results?.[0];
   };
   /**
    * Applies a per-page payload to one frame. Scriptlets are queued first so
@@ -127,17 +136,13 @@
    * @param tabId ID of the tab to apply the configuration to.
    * @param frameId ID of the frame to apply the configuration to.
    * @param configuration Payload from the native handler.
-   * @returns Promise that resolves when the injections have settled.
+   * @returns Promise resolving to the scriptlets that still need injection.
    */
   const applyConfiguration = (tabId, frameId, configuration) => {
     const target = { tabId, frameIds: [frameId] };
     const selectors = configuration.css || [];
     const procedural = configuration.procedural || [];
-    const pending = [];
-    const scriptlets = configuration.scriptlets || [];
-    if (scriptlets.length > 0) {
-      pending.push(runScriptlets(target, scriptlets));
-    }
+    const pending = [runScriptlets(target, configuration.scriptlets || [])];
     // One stylesheet for the page's styles and hides, which include the hides
     // scoped to its site. One rule per selector: a selector the engine
     // rejects drops only itself.
@@ -154,12 +159,19 @@
           globalThis.wbeProcedural.apply(filters);
           return true;
         }, args: [filters] });
-        if (applied) return;
+        if (applied?.result) return;
         await executeInFrame({ target, world, files: ['procedural.js'], injectImmediately: true });
         await executeInFrame({ target, world, func: filters => wbeProcedural.apply(filters), args: [filters] });
       })());
     }
-    return Promise.all(pen
```

**File**: `extension-src/content.js` (modified, +2/-1)
```diff
@@ -124,7 +124,8 @@
     for (const delay of SCRIPTLET_RETRY_DELAYS_MS) {
       if (delay) await new Promise(resolve => setTimeout(resolve, delay));
       const response = await browser.runtime.sendMessage({ action: 'wblock:injectScriptlets', scriptlets }).catch(() => null);
-      if (response && response.injected) return;
+      if (response?.injected) return;
+      if (Array.isArray(response?.failedScriptlets)) scriptlets = response.failedScriptlets;
     }
   };
   const applyConfiguration = configuration => {
```

**File**: `scripts/test_background_config_cache.mjs` (modified, +59/-3)
```diff
@@ -9,6 +9,7 @@
 import { readFileSync } from "node:fs";
 import { runtimeMessageListener } from "./helpers/runtime-message.mjs";
 import assert from "node:assert/strict";
+import vm from "node:vm";
 import path from "node:path";
 import { fileURLToPath } from "node:url";
 
@@ -551,20 +552,22 @@ const runScriptInjectionScenario = async executeScript => {
   const errors = [];
   const originalConsoleError = console.error;
   let rejected = false;
+  let response;
   console.error = (...args) => { errors.push(args); };
   try {
-    await state.onMessage({ type: "InitContentScript" }, topFrameSender(pageUrl));
+    response = await state.onMessage({ type: "InitContentScript" }, topFrameSender(pageUrl));
   } catch {
     rejected = true;
   } finally {
     console.error = originalConsoleError;
   }
-  return { errors, rejected };
+  return { errors, rejected, response };
 };
 
 {
   const outcome = await runScriptInjectionScenario(async () => []);
   check("empty executeScript results are skipped without an error", !outcome.rejected && outcome.errors.length === 0);
+  check("empty execution results keep scriptlets pending", outcome.response?.payload?.scriptlets.length === 1);
 }
 
 for (const message of [
@@ -575,6 +578,9 @@ for (const message of [
     throw new Error(message);
   });
   check(`executeScript rejection "${message}" is skipped without an error`, !outcome.rejected && outcome.errors.length === 0);
+  check(`executeScript rejection "${message}" keeps scriptlets pending`, outcome.response?.payload?.scriptlets.length === 1);
+  const result = await runScriptInjectionScenario(async () => [{ error: message }]);
+  check(`executeScript result "${message}" stays pending without an error log`, !result.rejected && result.errors.length === 0 && result.response?.payload?.scriptlets.length === 1);
 }
 
 {
@@ -599,6 +605,56 @@ for (const message of [
   );
 }
 
+// A failed file must remain retryable without replaying completed scriptlets.
+{
+  const scriptlets = [["set-constant", "probe", "1"], ["prevent-fetch", "adsbygoogle"]];
+  const page = vm.createContext({});
+  const installed = [];
+  let firstCompleted = false;
+  let secondStartedAfterFirst;
+  let unavailable = true;
+  const state = loadBackground({
+    nativeHandler: () => ({ payload: makeConfig([], 19, [], scriptlets) }),
+    executeScript: async injection => {
+      if (injection.func) vm.runInContext(`(${injection.func})(...${JSON.stringify(injection.args)})`, page);
+      if (injection.files?.includes("scriptlets/set-constant.js")) {
+        await sleep(5);
+        firstCompleted = true;
+      }
+      if (injection.files?.includes("scriptlets/prevent-fetch.js")) secondStartedAfterFirst ??= firstCompleted;
+      if (unavailable && injection.files?.includes("scriptlets/prevent-fetch.js")) {
+        return [{ error: "Script execution target not found" }];
+      }
+      for (const file of injection.files || []) {
+        const name = file.slice("scriptlets/".length, -3);
+        for (const args of page.__wbeScriptletCalls?.[name] || []) installed.push([name, ...args]);
+        delete page.__wbeScriptletCalls?.[name];
+      }
+      return [{}];
+    }
+  });
+  const sender = topFrameSender("https://injection.example/");
+  const response = await state.onMessage({ type: "InitContentScript" }, sender);
+  check("scriptlet files retain their execution order", secondStartedAfterFirst === true);
+  check("normal frame hands back only failed scriptlets", JSON.stringify(response?.payload?.scriptlets) === JSON.stringify([scriptlets[1]]));
+  const failed = await state.onMessage({ action: "wblock:injectScriptlets", scriptlets: [scriptlets[1]] }, sender);
+  check("failed scriptlet execution is not acknowledged", failed?.injected === false && JSON.stringify(failed.failedScriptlets) === JSON.stringify([scriptlets[1]]));
+  unavailable = false;
+  const recovered = await state.onMessage({ action: "wblock:injectScriptlets", scriptlets: [scriptlets[1]] }, sender);
+  check("scriptlet injection recovers when its target becomes available", recovered?.injected === true);
+  check("retries neither duplicate pending arguments nor replay successful files", JSON.stringify(installed) === JSON.stringify(scriptlets));
+}
+
+{
+  const calls = [["adg:js", "window.first = true"], ["adg:js", "window.second = true"]];
+  const state = loadBackground({
+    nativeHandler: () => ({ payload: makeConfig([], 19) }),
+    executeScript: async injection => injection.args?.[0] === calls[1][1] ? [] : [{}]
+  });
+  const response = await state.onMessage({ action: "wblock:injectScriptlets", scriptlets: calls }, topFrameSender("https://injection.example/"));
+  check("AdGuard calls report only failed injections", response?.injected === false && JSON.stringify(response.failedScriptlets) === JSON.stringify([calls[1]]));
+}
+
 // Scenario I: blank frames receive the payload back so the content script can
 // apply it; normal HTTP frames are applied by the backgroun
```

**File**: `scripts/test_content_scriptlet_injection.mjs` (modified, +27/-2)
```diff
@@ -109,7 +109,7 @@ const frameGlobals = document => ({
   MutationObserver: class { observe() {} disconnect() {} },
   getComputedStyle: () => ({}),
   navigator: { userAgent: "test" },
-  location: { href: "about:blank", hostname: "" },
+  location: { href: "about:blank", hostname: "", protocol: "about:" },
   Event: class Event { constructor(name) { this.name = name; } },
   CustomEvent: class CustomEvent { constructor(name) { this.name = name; } },
   CSS: { supports: () => false },
@@ -124,7 +124,7 @@ const runBlankFrameWithPayload = async payload => {
     addEventListener() {},
     removeEventListener() {},
     dispatchEvent() { return true; },
-    location: { href: "about:blank", hostname: "" },
+    location: { href: "about:blank", hostname: "", protocol: "about:" },
     wbeProcedural: { apply: filters => applied.push(filters) },
   };
   const browserPayload = {
@@ -596,6 +596,31 @@ try {
   console.error(error);
 }
 
+// Retry only the scriptlets that the background could not execute.
+{
+  const calls = [["set-constant", "probe", "1"], ["prevent-fetch", "adsbygoogle"]];
+  const requests = [];
+  const location = { href: "https://example.com/", hostname: "example.com", protocol: "https:" };
+  const win = { ...windowStub, location };
+  win.top = win;
+  await withGlobals({ ...frameGlobals(documentStub), location }, async () => {
+    new Function("browser", "window", "self", source)({ runtime: {
+      onMessage: { addListener() {} },
+      sendMessage: async message => {
+        if (message.type === "InitContentScript") return { disabled: false, paused: false, payload: { scriptlets: calls } };
+        if (message.action === "wblock:injectScriptlets") {
+          requests.push(message.scriptlets);
+          return requests.length === 1 ? { injected: false, failedScriptlets: [calls[1]] } : { injected: true };
+        }
+        return {};
+      }
+    } }, win, win);
+    await sleep(100);
+  });
+  check("failed scriptlet handoff retries until acknowledged", requests.length === 2);
+  check("scriptlet retry excludes already successful calls", JSON.stringify(requests[1]) === JSON.stringify([calls[1]]));
+}
+
 if (failures > 0) {
   console.error(`\n${failures} content scriptlet injection check(s) failed`);
   process.exit(1);
```

**File**: `wBlock Scripts (iOS)/Resources/background.js` (modified, +94/-94)
```diff
@@ -1,96 +1,96 @@
 /*! Generated artifact — do not edit. Edit extension-src/background.js and run scripts/minify-extension-js.sh */
-(function(s){"use strict";var x;(function(t){t.InitContentScript="InitContentScript"})(x||(x={}));let V=0,O=0;const $e=1e3,Tt=t=>{const e=globalThis.__wbeScriptletCalls||(globalThis.__wbeScriptletCalls={});for(const[r,...o]of t)(e[r]||(e[r]=[])).push(o)},Ee="adg:";let je;const Dt=()=>je||(je=import("./scriptlets/adguard.js").then(()=>globalThis.wbeAdguardScriptlets||null).catch(t=>(G("[wBlock] Failed to load AdGuard scriptlets",t),null))),Et=t=>{const e=Symbol.for("wBlock.pageScriptPolicy");let r=window[e];
-if(r===void 0){try{r=window.trustedTypes?window.trustedTypes.createPolicy("wblock-scripts",{createScript:n=>n}):null}catch{r=null}Object.defineProperty(window,e,{value:r})}const o=document.createElement("script");o.textContent=r?r.createScript(t):t,(document.head||document.documentElement).appendChild(o),o.remove()},Mt=async(t,e)=>{const r=e.some(([o])=>o!=="adg:js")?await Dt():null;await Promise.all(e.map(([o,...n])=>{const c=o.slice(Ee.length);if(c==="js")return z({target:t,world:"MAIN",injectImmediately:!0,
-func:Et,args:n});const l=r&&r.getScriptletFunction(c);return l?z({target:t,world:"MAIN",injectImmediately:!0,func:l,args:[{name:c,args:n,engine:"extension",version:"",verbose:!1},n]}):void 0}))},He=async(t,e)=>{const r=e.filter(([c])=>c.startsWith(Ee)),o=r.length>0?e.filter(([c])=>!c.startsWith(Ee)):e,n=[];r.length>0&&n.push(Mt(t,r)),o.length>0&&n.push((async()=>{await z({target:t,world:"MAIN",injectImmediately:!0,func:Tt,args:[o]});const c=[...new Set(o.map(([l])=>`scriptlets/${l}.js`))];await z(
-{target:t,world:"MAIN",injectImmediately:!0,files:c})})()),await Promise.all(n)},Pt=t=>{if(t instanceof Error)return t.stack||t.message||String(t);if(typeof t=="string")return t;try{return JSON.stringify(t)}catch{return String(t)}},G=(...t)=>console.error(t.map(Pt).join(" ")),Ft=["permission","not allowed","denied","cannot access","not granted","not permitted","does not have access","not found"],Ve=t=>{const e=String(t&&t.message||t||"").toLowerCase();return Ft.some(r=>e.includes(r))},z=async t=>{
-let e;try{e=await s.scripting.executeScript(t)}catch(r){Ve(r)||G("[wBlock] Failed to execute script in target",t.target,"error",r);return}return e&&e.length>0&&e[0].error&&G("[wBlock] Failed to execute script in target",t.target,"error",e[0].error),e&&e.length>0?e[0].result:void 0},xt=(t,e,r)=>{const o={tabId:t,frameIds:[e]},n=r.css||[],c=r.procedural||[],l=[],f=r.scriptlets||[];f.length>0&&l.push(He(o,f));const d=[...r.styles||[],...n.map(g=>`${g} { display: none !important; }`)];for(let g=0;g<
-d.length;g+=$e)l.push(s.scripting.insertCSS({target:o,origin:"USER",css:d.slice(g,g+$e).join(`
-`)}));for(const g of["ISOLATED","MAIN"]){const m=c.filter(h=>/"type"\s*:\s*"matches-(?:prop|property)"/.test(h)===(g==="MAIN"));m.length&&l.push((async()=>{await z({target:o,world:g,func:R=>globalThis.wbeProcedural?(globalThis.wbeProcedural.apply(R),!0):!1,args:[m]})||(await z({target:o,world:g,files:["procedural.js"],injectImmediately:!0}),await z({target:o,world:g,func:R=>wbeProcedural.apply(R),args:[m]}))})())}return Promise.all(l)},v=new Map,Bt=128,ge="wblockConfigCacheV2",Ke=40,Ut=1e3;let K=null;
-const Lt=()=>{if(K!==null)return;const t=O;K=setTimeout(async()=>{if(K=null,t===O)try{const e=[];for(const[r,o]of v)r.endsWith("#")&&e.push([r,o]);await s.storage.local.set({[ge]:{engineTimestamp:V,entries:e.slice(-Ke)}})}catch(e){console.warn("[wBlock] Failed to persist config cache:",e)}},Ut)},qt=()=>(K!==null&&(clearTimeout(K),K=null),s.storage.local.remove(ge).catch(t=>{console.warn("[wBlock] Failed to clear persisted config cache:",t)})),We=(async()=>{const t=O;try{const e=await s.storage.local.
-get(ge);if(t!==O)return;const r=e&&e[ge];if(!r||typeof r.engineTimestamp!="number"||!Array.isArray(r.entries)||v.size>0||V!==0)return;V=r.engineTimestamp;for(const o of r.entries.slice(-Ke))Array.isArray(o)&&typeof o[0]=="string"&&o[1]&&typeof o[1]=="object"&&v.set(o[0],o[1])}catch(e){console.warn("[wBlock] Failed to hydrate config cache:",e)}})(),ee=async()=>{if(!(!s.tabs||typeof s.tabs.query!="function"))try{const t=await s.tabs.query({});await Promise.all(t.map(e=>!e||typeof e.id!="number"?Promise.
-resolve():s.tabs.sendMessage(e.id,{type:"wblock:clearDocumentStartSessionCache"}).catch(()=>{})))}catch{}};let Ze=Promise.resolve();const Xe=t=>{const e=t&&typeof t.action=="string"?t.action:"";return e==="syncZapperRules"||e==="getZapperRules"?3500:e==="startFilterUpdate"||e==="getFilterUpdateStatus"?1e4:e==="maybeUpdateUserScripts"||e==="maybeStageFilterUpdates"?12e4:e==="getBlockingState"?1e4:3e4},Ye=(t,e,r)=>{let o=null;return Promise.race([Promise.resolve(t).finally(()=>{o!==null&&clearTimeout(
-o)}),new Promise((n,c)=>{o=setTimeout(()=>c(new Error(`Native message timed out: ${r||"unknown"}`)),e)})])},he=5e3,te=new Map,D=new Map,Ot=t=>Date.now()-(te.get(t)||0)<he;let ne=0;const $=()=>{ne+=1,te
```

**File**: `wBlock Scripts (iOS)/Resources/content.js` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 (function(s){"use strict";const h=e=>{const{MutationObserver:t}=window;if(!t)return;new t(r=>{for(let o=0;o<r.length;o+=1){const i=r[o];if(e.hasAttribute("mod")&&e.getAttribute("mod")==="inner"){e.removeAttribute("mod");break}e.setAttribute("mod","inner");let a=!1;if(i.removedNodes.length>0)for(let f=0;f<i.removedNodes.length;f+=1)a=!0,e.appendChild(i.removedNodes[f]);else i.oldValue&&(a=!0,e.textContent=i.oldValue);a||e.removeAttribute("mod")}}).observe(e,{childList:!0,characterData:!0,subtree:!0,
 characterDataOldValue:!0})};var c;if((function(e){e.InitContentScript="InitContentScript"})(c||(c={})),!s||!s.runtime||!s.runtime.sendMessage)return;let d=!1;const m=/just a moment|verifying you are human|attention required|enable cookies/i,w=e=>m.test(e||""),g=()=>{d||(d=!0,console.info("[wBlock] Cloudflare challenge context detected \u2014 skipping content script."))},y=()=>{try{const e=window.location&&typeof window.location.hostname=="string"?window.location.hostname:"",t=window.location&&typeof window.
 location.pathname=="string"?window.location.pathname:"";if(e==="challenges.cloudflare.com"||t.startsWith("/cdn-cgi/challenge-platform")||t.startsWith("/cdn-cgi/challenge"))return!0}catch{}return!1},l=(e=!1)=>(!d&&(y()||w(document.title)||e&&document.querySelector('script[src^="/cdn-cgi/challenge-platform"],script[src*="challenges.cloudflare.com"],#challenge-form,#challenge-stage,#challenge-runner'))&&g(),d),C=[0,50,150,400,1e3,2500],b=async e=>{for(const t of C){t&&await new Promise(r=>setTimeout(
-r,t));const n=await s.runtime.sendMessage({action:"wblock:injectScriptlets",scriptlets:e}).catch(()=>null);if(n&&n.injected)return}},k=e=>{try{const t=e.css||[],n=e.styles||[];if(t.length>0||n.length>0){const o=document.createElement("style");o.setAttribute("type","text/css"),o.textContent=[...n,...t.map(i=>`${i} { display: none !important; }`)].join(`
+r,t));const n=await s.runtime.sendMessage({action:"wblock:injectScriptlets",scriptlets:e}).catch(()=>null);if(n?.injected)return;Array.isArray(n?.failedScriptlets)&&(e=n.failedScriptlets)}},k=e=>{try{const t=e.css||[],n=e.styles||[];if(t.length>0||n.length>0){const o=document.createElement("style");o.setAttribute("type","text/css"),o.textContent=[...n,...t.map(i=>`${i} { display: none !important; }`)].join(`
 `),(document.head||document.documentElement).appendChild(o),h(o)}e.procedural&&e.procedural.length>0&&window.wbeProcedural.apply(e.procedural.filter(o=>!/"type"\s*:\s*"matches-(?:prop|property)"/.test(o)));const r=e.scriptlets||[];r.length>0&&location.protocol.startsWith("http")&&b(r)}catch(t){console.error(`[wBlock] Failed to apply configuration in content script: ${t&&t.stack||t}`)}};let u;const p=[250,1e3,3e3],v=e=>e&&e.state==="error"?Promise.resolve(!0):Promise.resolve(!(e&&typeof e.disabled==
 "boolean"&&typeof e.paused=="boolean")||e.disabled||e.paused);(async()=>{if(l())return;const e={type:c.InitContentScript,includeUserScripts:window.top!==window&&/^https?:$/.test(location.protocol)},n=(async()=>{for(let o=0;;o+=1){const i=await s.runtime.sendMessage(e).catch(a=>({type:c.InitContentScript,state:"error",error:String(a&&a.message?a.message:a)}));if(!(i&&i.state==="error")||o>=p.length||l())return i;await new Promise(a=>setTimeout(a,p[o]))}})();e.includeUserScripts&&(globalThis.__wblockFrameInitialization=
 n,globalThis.__wblockZapperInitialization=n.then(o=>o?.zapper)),u=n.then(v);const r=await n;await u||r?.payload&&!l(!0)&&k(r.payload)})().catch(e=>{console.error(`[wBlock] Error in content script: ${e&&e.stack||e}`)}),(async()=>{try{if(window.top!==window||await(u||Promise.resolve(!1))||l()||!/^https?:/i.test(window.location.href)||typeof s>"u"||!s.runtime||!s.runtime.sendMessage)return;const e=window.location.href,t=await s.runtime.sendMessage({action:"wblock:getCleanURL",url:e}),n=t&&typeof t.
```

---

### Incident Patch 3: `2fe4eb87` (2026-11-14)
**Commit Message**: fix(userscripts): let GM requests reach the page's own site (#1114)

Bypass Paywalls Clean - fr fetches Télérama and Courrier International
articles from apps.<site> APIs it never lists in @connect, so wBlock
blocked them while Stay, which ignores @connect, let them through. A
script that declares any @connect may now also reach the page's
registrable domain and its subdomains. Empty declarations still fail
closed, and IP or public suffix pages keep the exact-host self.

**File**: `scripts/test_userscript_matching_and_payload.swift` (modified, +19/-4)
```diff
@@ -226,23 +226,38 @@ struct UserScriptMatchingAndPayloadTests {
             (["example.org"], "https://evil-example.org/x", false),
             (["example.org"], "https://example.org.evil/x", false),
             (["self"], "https://page.invalid:8443/x", true),
-            (["self"], "https://sub.page.invalid/x", false),
+            (["self"], "https://sub.page.invalid/x", true),
+            (["mediafin.be"], "https://apps.page.invalid/x", true),
+            (["mediafin.be"], "https://otherpage.invalid/x", false),
+            (["mediafin.be"], "https://invalid/x", false),
             (["localhost"], "http://localhost:8080/x", true),
             (["*"], "file:///etc/passwd", false),
             (["*"], "https://user:secret@example.org/", false),
             (["*"], "https://anywhere.invalid/", true),
             (["https://example.org"], "https://example.org/", false),
             ([String](), "https://page.invalid/", false)
         ] {
-            expectEqual(UserScriptConnectPolicy(entries: entries, pageURL: page).allows(URL(string: target)!), allowed, "connect policy for \(target) with \(entries)")
+            expectEqual(UserScriptConnectPolicy(entries: entries, pageURL: page, pageSite: "page.invalid").allows(URL(string: target)!), allowed, "connect policy for \(target) with \(entries)")
+        }
+        // Sites as WBEngine.registrableDomain resolves them; nil is a public suffix.
+        for (pageURL, site, target, allowed) in [
+            ("https://www.telerama.fr/a", "telerama.fr", "https://apps.telerama.fr/tlr/v1", true),
+            ("https://news.bbc.co.uk/", "bbc.co.uk", "https://www.bbc.co.uk/", true),
+            ("https://news.bbc.co.uk/", "bbc.co.uk", "https://evil.co.uk/", false),
+            ("https://github.io/", nil, "https://me.github.io/", false),
+            ("https://github.io/", nil, "https://github.io/x", true),
+            ("http://10.0.1.1/", "1.1", "http://10.0.1.1/x", true),
+            ("http://10.0.1.1/", "1.1", "http://192.168.1.1/x", false)
+        ] as [(String, String?, String, Bool)] {
+            expectEqual(UserScriptConnectPolicy(entries: ["mediafin.be"], pageURL: URL(string: pageURL)!, pageSite: site).allows(URL(string: target)!), allowed, "same-site connect for \(target) from \(pageURL)")
         }
 
         let session = URLSession(configuration: .ephemeral)
         defer { session.invalidateAndCancel() }
         let redirectResponse = HTTPURLResponse(url: page, statusCode: 302, httpVersion: nil, headerFields: nil)!
         for (mode, target, allowed) in [("follow", page, true), ("follow", URL(string: "https://outside.invalid/")!, false), ("manual", page, false), ("error", page, false)] {
             let task = session.dataTask(with: page)
-            let delegate = GMRedirectPolicyDelegate(policy: UserScriptConnectPolicy(entries: ["self"], pageURL: page), redirect: mode)
+            let delegate = GMRedirectPolicyDelegate(policy: UserScriptConnectPolicy(entries: ["self"], pageURL: page, pageSite: "page.invalid"), redirect: mode)
             var called = false
             delegate.urlSession(session, task: task, willPerformHTTPRedirection: redirectResponse, newRequest: URLRequest(url: target)) { request in
                 called = true
@@ -257,7 +272,7 @@ struct UserScriptMatchingAndPayloadTests {
         authenticated.setValue("secret", forHTTPHeaderField: "Authorization")
         authenticated.setValue("session=secret", forHTTPHeaderField: "Cookie")
         let redirectTask = session.dataTask(with: page)
-        GMRedirectPolicyDelegate(policy: UserScriptConnectPolicy(entries: ["*"], pageURL: page), redirect: "follow")
+        GMRedirectPolicyDelegate(policy: UserScriptConnectPolicy(entries: ["*"], pageURL: page, pageSite: "page.invalid"), redirect: "follow")
             .urlSession(session, task: redirectTask, willPerformHTTPRedirection: redirectResponse, newRequest: authenticated) { request in
                 expectEqual(request?.url, crossHost, "approved cross-host redirect may proceed")
                 expect(request?.value(forHTTPHeaderField: "Authorization") == nil, "native redirect strips cross-host authorization")
```

**File**: `wBlockCoreService/UserScript.swift` (modified, +11/-2)
```diff
@@ -267,8 +267,17 @@ public struct UserScriptConnectPolicy: Sendable {
     public let entries: [String]
     public let pageURL: URL
 
-    public init(entries: [String], pageURL: URL) {
-        self.entries = entries
+    /// A script that declares any `@connect` may also reach the page's own
+    /// site (`pageSite`, its registrable domain, and subdomains), so `self`
+    /// covers the whole site. Paywall scripts fetch `apps.<site>` APIs they
+    /// don't declare, and Stay allows them (#1114). An empty declaration still fails closed, and IP
+    /// or public suffix pages (nil `pageSite`) keep the exact-host `self`.
+    public init(entries: [String], pageURL: URL, pageSite: String?) {
+        let declared = entries.filter { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() != "self" }
+        let host = pageURL.host ?? ""
+        let isIP = host.contains(":") || host.allSatisfy { $0.isNumber || $0 == "." }
+        let site = isIP ? nil : pageSite?.lowercased()
+        self.entries = entries.isEmpty ? [] : declared + [site ?? "self"]
         self.pageURL = pageURL
     }
 
```

**File**: `wBlockCoreService/WebExtensionRequestHandler.swift` (modified, +5/-1)
```diff
@@ -6,6 +6,7 @@
 //
 
 import Foundation
+internal import WBEngine
 #if os(macOS)
 import AppKit
 #endif
@@ -1518,7 +1519,10 @@ public enum WebExtensionRequestHandler {
         guard let script = manager.userScript(withId: scriptID),
               !script.isUserStyle, script.allowsGMXMLHttpRequest,
               scriptAllowsFrame(script, message: message, manager: manager) else { return nil }
-        return UserScriptConnectPolicy(entries: script.connect, pageURL: page)
+        return UserScriptConnectPolicy(
+            entries: script.connect, pageURL: page,
+            pageSite: page.host.flatMap { WBEngine.registrableDomain(of: $0) }
+        )
     }
 
     private static func handleUserScriptRequestPolicy(message: [String: Any?], context: NSExtensionContext) {
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

## X. engine): Respect Spotify music exceptions across blockers

**RULE**:
When implementing operations in `extension-src/background.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in 0xCUB3/wBlock. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `03e46e4a`: engine): Respect Spotify music exceptions across blockers. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `extension-src/background.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
  // Old entries could claim success after native rejected the report.
  const REDIRECT_DNR_STATUS_REPORT_KEY = "wblockRedirectDNRStatusReportV2";
        const response = await sendPriorityNativeMessage({
        if (response?.ok !== true) throw new Error("Native host did not save redirect status");
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
  const REDIRECT_DNR_STATUS_REPORT_KEY = "wblockRedirectDNRStatusReport";
        await sendPriorityNativeMessage({
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `03e46e4a` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
