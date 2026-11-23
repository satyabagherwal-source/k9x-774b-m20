# Verification Protocol: Verification Protocol: Empirical Defect Shield for erkamyaman/rust-anything

<!-- PROVENANCE_START
{
  "source_repository": "erkamyaman/rust-anything",
  "source_url": "https://github.com/erkamyaman/rust-anything",
  "source_version": "b30206b1",
  "license": "MIT",
  "timestamp": "2026-11-23T06:14:14.593Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-erkamyaman-rust-anything",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [erkamyaman/rust-anything](https://github.com/erkamyaman/rust-anything) (Revision: `b30206b1`).  
> **License**: MIT | **Timestamp**: `2026-11-23T06:14:14.593Z`  
> **Learning ID**: `learn-github-erkamyaman-rust-anything`


## 1. Scope & Verification Target
- **Target Repository**: `erkamyaman/rust-anything` (Commit: `b30206b1`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): erkamyaman/rust-anything

> **Canonical Artifact**: `07_PROJECT_LEARNING/erkamyaman-rust-anything-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/erkamyaman/rust-anything](https://github.com/erkamyaman/rust-anything))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-23T06:14:12.843Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `erkamyaman/rust-anything`
- **Description**: Rewrite your whole app in Rust, one piece at a time, checked against the original's recorded behavior at every step. CLIs, HTTP servers and libraries in TypeScript, Python, C, Go, Ruby and Java.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 8161 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `demo/real-world/eslint-rs/linter-rs/src/code_path/fixtures/loops.js`
```
for (let i = 0; i < n; i++) { if (i) continue; if (j) break; }
for (;;) { if (a) break; }
while (a) { if (b) break; c(); }
do { if (x) continue; } while (y);
outer: for (const k of o) { for (const m in k) { if (m) continue outer; if (n) break outer; } }
while (true) {}
foo();

```

### Core Architecture Module: `demo/real-world/eslint-rs/linter-rs/src/code_path/state.rs`
```
//! lib/linter/code-path-analysis/code-path-state.js, fork-context.js and code-path-segment.js

use super::{CpId, EventKind, Graph, Raw, SegId, Segment};
use crate::ast::NodeId;

type FcId = usize;

pub(super) struct Sink {
    pub g: Graph,
    pub out: Vec<Raw>,
    pub node: NodeId,
}

impl Graph {
    fn new_segment(&mut self, id: String, all_prev: Vec<SegId>, reachable: bool) -> SegId {
        let prev = all_prev
            .iter()
            .copied()
            .filter(|p| self.reachable(*p))
            .collect();
        self.segments.push(Segment {
            id,
            next: Vec::new(),
            prev,
            all_next: Vec::new(),
            all_prev,
            reachable,
            used: false,
            looped_prev: Vec::new(),
        });
        (self.segments.len() - 1) as SegId
    }

    fn flatten_unused(&self, segs: &[SegId]) -> Vec<SegId> {
        let mut done: Vec<SegId> = Vec::new();
        for &s in segs {
            if done.contains(&s) {
                continue;
            }
            let seg = self.seg(s);
            if !seg.used {
                for &p in &seg.all_prev {
                    if !done.contains(&p) {
                        done.push(p);
                    }
                }
            } else {
                done.push(s);
            }
        }
        done
    }

    fn new_next(&mut self, id: String, all_prev: &[SegId]) -> SegId {
        let flat = self.flatten_unused(all_prev);
        let reachable = all_prev.iter().any(|p| self.reachable(*p));
        self.new_segment(id, flat, reachable)
    }

    fn new_unreachable(&mut self, id: String, all_prev: &[SegId]) -> SegId {
        let flat = self.flatten_unused(all_prev);
        let s = self.new_segment(id, flat, false);
        self.mark_used(s);
        s
    }

    fn new_disconnected(&mut self, id: String, all_prev: &[SegId]) -> SegId {
        let reachable = all_prev.iter().any(|p| self.reachable(*p));
        self.new_segment(id, Vec::new(), reachable)
    }

    pub(super) fn mark_used(&mut self, s: SegId) {
        let seg = &mut self.segments[s as usize];
        if seg.used {
            return;
        }
        seg.used = true;
        let reachable = seg.reachable;
        let prevs = seg.all_prev.clone();
        for p in prevs {
            let ps = &mut self.segments[p as usize];
            ps.all_next.push(s);
            if reachable {
                ps.next.push(s);
            }
        }
    }
}

#[derive(Clone, Copy)]
enum Make {
    Next,
    Unreachable,
    Disconnected,
}

struct ForkCtx {
    upper: Option<FcId>,
    count: usize,
    list: Vec<Vec<SegId>>,
}

struct BreakCtx {
    breakable: bool,
    label: Option<String>,
    broken: FcId,
}

#[derive(Clone)]
pub(super) struct ChoiceCtx {
    kind: &'static str,
    forking: bool,
    t: FcId,
    f: FcId,
    n: FcId,
    processed: bool,
}

struct SwitchCtx {
    has_case: bool,
    default_segs: Option<Vec<SegId>>,
    default_body: Option<Vec<SegId>>,
    found_empty_default: bool,
    last_is_default: bool,
    fork_count: usize,
}

#[derive(PartialEq, Clone, Copy)]
enum TryPos {
    Try,
    Catch,
    Finally,
}

struct TryCtx {
    has_finalizer: bool,
    position: TryPos,
    returned: Option<FcId>,
    thrown: FcId,
    last_try_reachable: bool,
    last_catch_reachable: bool,
}

#[derive(PartialEq, Clone, Copy)]
pub(super) enum LoopType {
    While,
    DoWhile,
    For,
    ForIn,
    ForOf,
}

struct LoopCtx {
    ty: LoopType,
    label: Option<String>,
    broken: FcId,
    test: Option<bool>,
    continue_dest: Option<Vec<SegId>>,
    entry: Option<Vec<SegId>>,
    continue_fc: Option<FcId>,
    end_of_init: Option<Vec<SegId>>,
    test_segs: Option<Vec<SegId>>,
    end_of_test: Option<Vec<SegId>>,
    update_segs: Option<Vec<SegId>>,
    end_of_update: Option<Vec<SegId>>,
    prev_segs: Option<Vec<SegId>>,
    left_segs: Option<Vec<SegId>>,
    end_of_left: Option<Vec<SegId>>,
}

enum Ctx {
    State,
    Try(usize),
}

pub(super) struct State {
    pub cp: CpId,
    prefix: String,
    n: u32,
    fcs: Vec<ForkCtx>,
    fork: FcId,
    choices: Vec<ChoiceCtx>,
    switches: Vec<SwitchCtx>,
    tries: Vec<TryCtx>,
    loops: Vec<LoopCtx>,
    breaks: Vec<BreakCtx>,
    chains: Vec<u32>,
    pub current: Vec<SegId>,
    pub initial: SegId,
    pub final_segs: Vec<SegId>,
    pub returned: Vec<SegId>,
    pub thrown: Vec<SegId>,
}

fn remove_from(v: &mut Vec<SegId>, x: SegId) {
    match v.iter().position(|e| *e == x) {
        Some(i) => {
            v.remove(i);
        }
        None => {
            v.pop();
        }
    }
}

fn add_returned_or_thrown(
    dest: &mut Vec<SegId>,
    others: &[SegId],
    all: &mut Vec<SegId>,
    segs: &[SegId],
) {
    for &s in segs {
        dest.push(s);
        if !others.contains(&s) {
            all.push(s);
        }
    }
}

impl State {
    pub fn new(cp: CpId, cp_id: &str, g: &mut Graph) -> State {
        let mut st = State {
            cp,
            prefix: format!("{cp_id}_"),
            n: 0,
            fcs: vec![ForkCtx {
                upper: None,
                count: 1,
                list: Vec::new(),
            }],
            fork: 0,
            choices: Vec::new(),
            switches: Vec::new(),
            tries: Vec::new(),
            loops: Vec::new(),
            breaks: Vec::new(),
            chains: Vec::new(),
            current: Vec::new(),
            initial: 0,
            final_segs: Vec::new(),
            returned: Vec::new(),
            thrown: Vec::new(),
        };
        let id = st.next_id();
        let root = g.new_segment(id, Vec::new(), true);
        st.fcs[0].list.push(vec![root]);
        st.initial = root;
        st
    }

    fn next_id(&mut self) -> String {
        self.n += 1;
        format!("{}{}", self.prefix, self.n)
    }

    pub fn head(&self) -> Vec<SegId> {
        self.fc_head(self.fork)
    }

    pub fn reachable(&self, g: &Graph) -> bool {
        self.fc_reachable(g, self.fork)
    }

    fn fc_head(&self, fc: FcId) -> Vec<SegId> {
        self.fcs[fc].list.last().cloned().unwrap_or_default()
    }

    fn fc_empty(&self, fc: FcId) -> bool {
        self.fcs[fc].list.is_empty()
    }

    fn fc_reachable(&self, g: &Graph, fc: FcId) -> bool {
        let h = self.fcs[fc].list.last();
        h.is_some_and(|h| !h.is_empty() && h.iter().any(|s| g.reachable(*s)))
    }

    fn fc_create(
        &mut self,
        g: &mut Graph,
        fc: FcId,
        range: Option<(i64, i64)>,
        make: Make,
    ) -> Vec<SegId> {
        let len = self.fcs[fc].list.len() as i64;
        let (b, e) = match range {
            Some((s, e)) => (
                if s >= 0 { s } else { len + s },
                if e >= 0 { e } else { len + e },
            ),
            None => (0, -1),
        };
        let mut out = Vec::new();
        for i in 0..self.fcs[fc].count {
            let mut all_prev = Vec::new();
            let mut j = b;
            while j <= e {
                if let Some(s) = self.fcs[fc].list.get(j as usize).and_then(|l| l.get(i)) {
                    all_prev.push(*s);
                }
                j += 1;
            }
            let id = self.next_id();
            out.push(match make {
                Make::Next => g.new_next(id, &all_prev),
                Make::Unreachable => g.new_unreachable(id, &all_prev),
                Make::Disconnected => g.new_disconnected(id, &all_prev),
            });
        }
        out
    }

    fn make_next(&mut self, g: &mut Graph, fc: FcId, s: i64, e: i64) -> Vec<SegId> {
        self.fc_create(g, fc, Some((s, e)), Make::Next)
    }

    fn merge_extra(&mut self, g: &mut Graph, fc: FcId, segs: Vec<SegId>) -> Vec<SegId> {
        let mut cur = segs;
        while cur.len() > self.fcs[fc].count {
            let length = cur.len() / 2;
            let mut merged = Vec::new();
            for i in 0..length {
                let id = self.next_id();
                merged.push(g.new_next(id, &[cur[i], cur[i + length]]));
            }
            cur = merged;
        }
        cur
    }

    fn fc_add(&mut self, g: &mut Graph, fc: FcId, segs: Vec<SegId>) {
        let m = self.merge_extra(g, fc, segs);
        self.fcs[fc].list.push(m);
    }

    fn fc_replace_head(&mut self, g: &mut Graph, fc: FcId, segs: Vec<SegId>) {
        let m = self.merge_extra(g, fc, segs);
        let list = &mut self.fcs[fc].list;
        list.pop();
        list.push(m);
    }

    fn fc_add_all(&mut self, fc: FcId, other: FcId) {
        let l = self.fcs[other].list.clone();
        self.fcs[fc].list.extend(l);
    }

    fn fc_new_empty(&mut self, parent: FcId, fork_leaving: bool) -> FcId {
        let count = if fork_leaving { 2 } else { 1 } * self.fcs[parent].count;
        self.fcs.push(ForkCtx {
            upper: Some(parent),
            count,
            list: Vec::new(),
        });
        self.fcs.len() - 1
    }

    fn upper(&self, fc: FcId) -> FcId {
        self.fcs[fc].upper.unwrap_or(fc)
    }

    fn return_ctx(&self) -> Ctx {
        for (i, t) in self.tries.iter().enumerate().rev() {
            if t.has_finalizer && t.position != TryPos::Finally {
                return Ctx::Try(i);
            }
        }
        Ctx::State
    }

    fn throw_ctx(&self) -> Ctx {
        for (i, t) in self.tries.iter().enumerate().rev() {
            if t.position == TryPos::Try || (t.has_finalizer && t.position == TryPos::Catch) {
                return Ctx::Try(i);
            }
        }
        Ctx::State
    }

    fn add_returned(&mut self, g: &mut Graph, segs: Vec<SegId>) {
        match self.return_ctx() {
            Ctx::State => add_returned_or_thrown(
                &mut self.returned,
                &self.thrown,
                &mut self.final_segs,
                &segs,
            ),
            Ctx::Try(i) => {
                if let Some(fc) = self.tries[i].returned {
                    
```

### Core Architecture Module: `demo/real-world/eslint-rs/linter-rs/src/core_rules.rs`
```
//! Generated from ESLint 10.15.0 lib/rules/index.js and conf/replacements.json.

pub const CORE_RULES: &[&str] = &[
    "accessor-pairs",
    "array-bracket-newline",
    "array-bracket-spacing",
    "array-callback-return",
    "array-element-newline",
    "arrow-body-style",
    "arrow-parens",
    "arrow-spacing",
    "block-scoped-var",
    "block-spacing",
    "brace-style",
    "callback-return",
    "camelcase",
    "capitalized-comments",
    "class-methods-use-this",
    "comma-dangle",
    "comma-spacing",
    "comma-style",
    "complexity",
    "computed-property-spacing",
    "consistent-return",
    "consistent-this",
    "constructor-super",
    "curly",
    "default-case",
    "default-case-last",
    "default-param-last",
    "dot-location",
    "dot-notation",
    "eol-last",
    "eqeqeq",
    "for-direction",
    "func-call-spacing",
    "func-name-matching",
    "func-names",
    "func-style",
    "function-call-argument-newline",
    "function-paren-newline",
    "generator-star-spacing",
    "getter-return",
    "global-require",
    "grouped-accessor-pairs",
    "guard-for-in",
    "handle-callback-err",
    "id-blacklist",
    "id-denylist",
    "id-length",
    "id-match",
    "implicit-arrow-linebreak",
    "indent",
    "indent-legacy",
    "init-declarations",
    "jsx-quotes",
    "key-spacing",
    "keyword-spacing",
    "line-comment-position",
    "linebreak-style",
    "lines-around-comment",
    "lines-around-directive",
    "lines-between-class-members",
    "logical-assignment-operators",
    "max-classes-per-file",
    "max-depth",
    "max-len",
    "max-lines",
    "max-lines-per-function",
    "max-nested-callbacks",
    "max-params",
    "max-statements",
    "max-statements-per-line",
    "multiline-comment-style",
    "multiline-ternary",
    "new-cap",
    "new-parens",
    "newline-after-var",
    "newline-before-return",
    "newline-per-chained-call",
    "no-alert",
    "no-array-constructor",
    "no-async-promise-executor",
    "no-await-in-loop",
    "no-bitwise",
    "no-buffer-constructor",
    "no-caller",
    "no-case-declarations",
    "no-catch-shadow",
    "no-class-assign",
    "no-compare-neg-zero",
    "no-cond-assign",
    "no-confusing-arrow",
    "no-console",
    "no-const-assign",
    "no-constant-binary-expression",
    "no-constant-condition",
    "no-constructor-return",
    "no-continue",
    "no-control-regex",
    "no-debugger",
    "no-delete-var",
    "no-div-regex",
    "no-dupe-args",
    "no-dupe-class-members",
    "no-dupe-else-if",
    "no-dupe-keys",
    "no-duplicate-case",
    "no-duplicate-imports",
    "no-else-return",
    "no-empty",
    "no-empty-character-class",
    "no-empty-function",
    "no-empty-pattern",
    "no-empty-static-block",
    "no-eq-null",
    "no-eval",
    "no-ex-assign",
    "no-extend-native",
    "no-extra-bind",
    "no-extra-boolean-cast",
    "no-extra-label",
    "no-extra-parens",
    "no-extra-semi",
    "no-fallthrough",
    "no-floating-decimal",
    "no-func-assign",
    "no-global-assign",
    "no-implicit-coercion",
    "no-implicit-globals",
    "no-implied-eval",
    "no-import-assign",
    "no-inline-comments",
    "no-inner-declarations",
    "no-invalid-regexp",
    "no-invalid-this",
    "no-irregular-whitespace",
    "no-iterator",
    "no-label-var",
    "no-labels",
    "no-lone-blocks",
    "no-lonely-if",
    "no-loop-func",
    "no-loss-of-precision",
    "no-magic-numbers",
    "no-misleading-character-class",
    "no-mixed-operators",
    "no-mixed-requires",
    "no-mixed-spaces-and-tabs",
    "no-multi-assign",
    "no-multi-spaces",
    "no-multi-str",
    "no-multiple-empty-lines",
    "no-native-reassign",
    "no-negated-condition",
    "no-negated-in-lhs",
    "no-nested-ternary",
    "no-new",
    "no-new-func",
    "no-new-native-nonconstructor",
    "no-new-object",
    "no-new-require",
    "no-new-symbol",
    "no-new-wrappers",
    "no-nonoctal-decimal-escape",
    "no-obj-calls",
    "no-object-constructor",
    "no-octal",
    "no-octal-escape",
    "no-param-reassign",
    "no-path-concat",
    "no-plusplus",
    "no-process-env",
    "no-process-exit",
    "no-promise-executor-return",
    "no-proto",
    "no-prototype-builtins",
    "no-redeclare",
    "no-regex-spaces",
    "no-restricted-exports",
    "no-restricted-globals",
    "no-restricted-imports",
    "no-restricted-modules",
    "no-restricted-properties",
    "no-restricted-syntax",
    "no-return-assign",
    "no-return-await",
    "no-script-url",
    "no-self-assign",
    "no-self-compare",
    "no-sequences",
    "no-setter-return",
    "no-shadow",
    "no-shadow-restricted-names",
    "no-spaced-func",
    "no-sparse-arrays",
    "no-sync",
    "no-tabs",
    "no-template-curly-in-string",
    "no-ternary",
    "no-this-before-super",
    "no-throw-literal",
    "no-trailing-spaces",
    "no-unassigned-vars",
    "no-undef",
    "no-undef-init",
    "no-undefined",
    "no-underscore-dangle",
    "no-unexpected-multiline",
    "no-unmodified-loop-condition",
    "no-unneeded-ternary",
    "no-unreachable",
    "no-unreachable-loop",
    "no-unsafe-finally",
    "no-unsafe-negation",
    "no-unsafe-optional-chaining",
    "no-unused-expressions",
    "no-unused-labels",
    "no-unused-private-class-members",
    "no-unused-vars",
    "no-use-before-define",
    "no-useless-assignment",
    "no-useless-backreference",
    "no-useless-call",
    "no-useless-catch",
    "no-useless-computed-key",
    "no-useless-concat",
    "no-useless-constructor",
    "no-useless-escape",
    "no-useless-rename",
    "no-useless-return",
    "no-var",
    "no-void",
    "no-warning-comments",
    "no-whitespace-before-property",
    "no-with",
    "nonblock-statement-body-position",
    "object-curly-newline",
    "object-curly-spacing",
    "object-property-newline",
    "object-shorthand",
    "one-var",
    "one-var-declaration-per-line",
    "operator-assignment",
    "operator-linebreak",
    "padded-blocks",
    "padding-line-between-statements",
    "prefer-arrow-callback",
    "prefer-const",
    "prefer-destructuring",
    "prefer-exponentiation-operator",
    "prefer-named-capture-group",
    "prefer-numeric-literals",
    "prefer-object-has-own",
    "prefer-object-spread",
    "prefer-promise-reject-errors",
    "prefer-reflect",
    "prefer-regex-literals",
    "prefer-rest-params",
    "prefer-spread",
    "prefer-template",
    "preserve-caught-error",
    "quote-props",
    "quotes",
    "radix",
    "require-atomic-updates",
    "require-await",
    "require-unicode-regexp",
    "require-yield",
    "rest-spread-spacing",
    "semi",
    "semi-spacing",
    "semi-style",
    "sort-imports",
    "sort-keys",
    "sort-vars",
    "space-before-blocks",
    "space-before-function-paren",
    "space-in-parens",
    "space-infix-ops",
    "space-unary-ops",
    "spaced-comment",
    "strict",
    "switch-colon-spacing",
    "symbol-description",
    "template-curly-spacing",
    "template-tag-spacing",
    "unicode-bom",
    "use-isnan",
    "valid-typeof",
    "vars-on-top",
    "wrap-iife",
    "wrap-regex",
    "yield-star-spacing",
    "yoda",
];

pub const REPLACED: &[(&str, &str)] = &[
    ("generator-star", "generator-star-spacing"),
    ("global-strict", "strict"),
    (
        "no-arrow-condition",
        "no-confusing-arrow, no-constant-condition",
    ),
    ("no-comma-dangle", "comma-dangle"),
    ("no-empty-class", "no-empty-character-class"),
    ("no-empty-label", "no-labels"),
    ("no-extra-strict", "strict"),
    ("no-reserved-keys", "quote-props"),
    ("no-space-before-semi", "semi-spacing"),
    ("no-wrap-func", "no-extra-parens"),
    ("space-after-function-name", "space-before-function-paren"),
    ("space-after-keywords", "keyword-spacing"),
    (
        "space-before-function-parentheses",
        "space-before-function-paren",
    ),
    ("space-before-keywords", "keyword-spacing"),
    (
        "space-in-brackets",
        "object-curly-spacing, array-bracket-spacing, computed-property-spacing",
    ),
    ("space-return-throw-case", "keyword-spacing"),
    ("space-unary-word-ops", "space-unary-ops"),
    ("spaced-line-comment", "spaced-comment"),
];

pub const RULE_TYPES: &[(&str, &str)] = &[
    ("accessor-pairs", "suggestion"),
    ("array-bracket-newline", "layout"),
    ("array-bracket-spacing", "layout"),
    ("array-callback-return", "problem"),
    ("array-element-newline", "layout"),
    ("arrow-body-style", "suggestion"),
    ("arrow-parens", "layout"),
    ("arrow-spacing", "layout"),
    ("block-scoped-var", "suggestion"),
    ("block-spacing", "layout"),
    ("brace-style", "layout"),
    ("callback-return", "suggestion"),
    ("camelcase", "suggestion"),
    ("capitalized-comments", "suggestion"),
    ("class-methods-use-this", "suggestion"),
    ("comma-dangle", "layout"),
    ("comma-spacing", "layout"),
    ("comma-style", "layout"),
    ("complexity", "suggestion"),
    ("computed-property-spacing", "layout"),
    ("consistent-return", "suggestion"),
    ("consistent-this", "suggestion"),
    ("constructor-super", "problem"),
    ("curly", "suggestion"),
    ("default-case", "suggestion"),
    ("default-case-last", "suggestion"),
    ("default-param-last", "suggestion"),
    ("dot-location", "layout"),
    ("dot-notation", "suggestion"),
    ("eol-last", "layout"),
    ("eqeqeq", "suggestion"),
    ("for-direction", "problem"),
    ("func-call-spacing", "layout"),
    ("func-name-matching", "suggestion"),
    ("func-names", "suggestion"),
    ("func-style", "suggestion"),
    ("function-call-argument-newline", "layout"),
    ("function-paren-newline", "layout"),
    ("generator-star-spacing", "layout"),
    ("getter-return", "problem"),
    ("global-require", "suggestion"),
    ("grouped-accessor-pairs", "suggestion"),
    ("guard-for-in", "suggestion"),
    ("handle-callback-err", "suggestion"),
    ("id-blacklist", "suggestion"),
    ("id-denyli
```

### Core Architecture Module: `demo/real-world/eslint-rs/linter-rs/src/eslint_utils.rs`
```
//! @eslint-community/eslint-utils 4.9.1 (the parts rules use) and the scope-related helpers of
//! lib/rules/utils/ast-utils.js.

use crate::ast::{Ast, NodeId, Prop};
use crate::scope::{ScopeId, ScopeManager, VarId};

/// `getInnermostScope(initialScope, node)`.
pub fn get_innermost_scope(
    sm: &ScopeManager,
    ast: &Ast,
    initial: ScopeId,
    node: NodeId,
) -> ScopeId {
    let location = ast.range(node).0;
    let mut scope = initial;
    loop {
        let next = sm.scope(scope).child_scopes.iter().copied().find(|c| {
            let (s, e) = ast.range(sm.scope(*c).block);
            s <= location && location < e
        });
        match next {
            Some(c) => scope = c,
            None => return scope,
        }
    }
}

/// `findVariable(initialScope, name)`.
pub fn find_variable_by_name(sm: &ScopeManager, initial: ScopeId, name: &str) -> Option<VarId> {
    sm.variable_by_name(initial, name)
}

/// `findVariable(initialScope, identifierNode)`.
pub fn find_variable(
    sm: &ScopeManager,
    ast: &Ast,
    initial: ScopeId,
    node: NodeId,
) -> Option<VarId> {
    let name = ast.name(node).unwrap_or("");
    let scope = get_innermost_scope(sm, ast, initial, node);
    sm.variable_by_name(scope, name)
}

/// `String(literal.value)` as ast-utils `getStaticStringValue` computes it.
pub fn get_static_string_value(ast: &Ast, node: NodeId) -> Option<String> {
    match ast.kind(node) {
        "Literal" => {
            if let Some(r) = ast.other(node, "regex") {
                let p = r.get("pattern").and_then(|v| v.as_str()).unwrap_or("");
                let f = r.get("flags").and_then(|v| v.as_str()).unwrap_or("");
                return Some(format!("/{p}/{f}"));
            }
            if let Some(b) = ast.str(node, "bigint") {
                return Some(b.to_string());
            }
            match ast.prop(node, "value") {
                Some(Prop::Str(s)) => Some(s.clone()),
                Some(Prop::Num(n)) => Some(crate::json::js_number(*n)),
                Some(Prop::Bool(b)) => Some(b.to_string()),
                Some(Prop::Null) => Some("null".to_string()),
                _ => None,
            }
        }
        "TemplateLiteral" => {
            let quasis = ast.list(node, "quasis");
            if ast.list(node, "expressions").is_empty() && quasis.len() == 1 {
                let q = quasis[0]?;
                return ast
                    .other(q, "value")
                    .and_then(|v| v.get("cooked"))
                    .and_then(|c| c.as_str())
                    .map(str::to_string);
            }
            None
        }
        _ => None,
    }
}

/// ast-utils `getStaticPropertyName(node)`.
pub fn get_static_property_name(ast: &Ast, node: NodeId) -> Option<String> {
    let prop = match ast.kind(node) {
        "ChainExpression" => return get_static_property_name(ast, ast.child(node, "expression")?),
        "Property" | "PropertyDefinition" | "MethodDefinition" => ast.child(node, "key")?,
        "MemberExpression" => ast.child(node, "property")?,
        _ => return None,
    };
    if ast.is(prop, "Identifier") && !ast.bool(node, "computed") {
        return ast.name(prop).map(str::to_string);
    }
    get_static_string_value(ast, prop)
}

/// ast-utils `skipChainExpression(node)`.
pub fn skip_chain_expression(ast: &Ast, node: NodeId) -> NodeId {
    if ast.is(node, "ChainExpression") {
        ast.child(node, "expression").unwrap_or(node)
    } else {
        node
    }
}

/// ast-utils `isSpecificMemberAccess(node, objectName, propertyName)` with predicates for the
/// names (`None` skips the check).
pub fn is_specific_member_access(
    ast: &Ast,
    node: NodeId,
    object: Option<&dyn Fn(&str) -> bool>,
    property: Option<&dyn Fn(&str) -> bool>,
) -> bool {
    let check = skip_chain_expression(ast, node);
    if !ast.is(check, "MemberExpression") {
        return false;
    }
    if let Some(f) = object {
        let Some(o) = ast.child(check, "object") else {
            return false;
        };
        if !(ast.is(o, "Identifier") && f(ast.name(o).unwrap_or(""))) {
            return false;
        }
    }
    if let Some(f) = property {
        match get_static_property_name(ast, check) {
            Some(p) if f(&p) => {}
            _ => return false,
        }
    }
    true
}

/// ast-utils `isInLoop(node)`.
pub fn is_in_loop(ast: &Ast, node: NodeId) -> bool {
    let mut cur = Some(node);
    while let Some(n) = cur {
        if crate::utils::is_function(ast, n) {
            return false;
        }
        if matches!(
            ast.kind(n),
            "DoWhileStatement"
                | "ForStatement"
                | "ForInStatement"
                | "ForOfStatement"
                | "WhileStatement"
        ) {
            return true;
        }
        cur = ast.parent(n);
    }
    false
}

```

### Core Architecture Module: `demo/real-world/eslint-rs/linter-rs/src/rules/core/eqeqeq.rs`
```
//! lib/rules/eqeqeq.js

use crate::rules::{Rule, RuleDef};
use crate::ast::NodeId;
use crate::linter::Cx;
use crate::report::SugVal;
use crate::rule::{fixer, Report, SuggestSpec};
use crate::utils::{is_null_literal, is_static_template_literal, literal_typeof};
use serde_json::Value;

pub static DEF: RuleDef = RuleDef {
    name: "eqeqeq",
    messages: &[
        ("unexpected", "Expected '{{expectedOperator}}' and instead saw '{{actualOperator}}'."),
        ("replaceOperator", "Use '{{expectedOperator}}' instead of '{{actualOperator}}'."),
    ],
    has_default_options: true,
    create,
};

struct R {
    smart: bool,
    enforce_null: bool,
    inverse_null: bool,
}

fn create(options: &[Value]) -> Result<Box<dyn Rule>, String> {
    let config = match options.first() {
        None => "always",
        Some(Value::String(s)) if matches!(s.as_str(), "always" | "smart" | "allow-null") => s.as_str(),
        _ => return Err("invalid option".into()),
    };
    let null = match options.get(1) {
        None => "always",
        Some(Value::Object(o)) if config == "always" => {
            if o.keys().any(|k| k != "null") {
                return Err("invalid option".into());
            }
            match o.get("null") {
                None => "always",
                Some(Value::String(s)) if matches!(s.as_str(), "always" | "never" | "ignore") => s.as_str(),
                _ => return Err("invalid option".into()),
            }
        }
        _ => return Err("invalid option".into()),
    };
    if options.len() > 2 {
        return Err("invalid option".into());
    }
    let null_option = if config == "always" { null } else { "ignore" };
    Ok(Box::new(R { smart: config == "smart", enforce_null: null_option == "always", inverse_null: null_option == "never" }))
}

fn is_typeof(cx: &Cx, n: NodeId) -> bool {
    cx.sc.ast.is(n, "UnaryExpression") && cx.sc.ast.str(n, "operator") == Some("typeof")
}

fn literal_type(cx: &Cx, n: NodeId) -> Option<&'static str> {
    if cx.sc.ast.is(n, "Literal") {
        return Some(literal_typeof(&cx.sc.ast, n));
    }
    if is_static_template_literal(&cx.sc.ast, n) {
        return Some("string");
    }
    None
}

impl R {
    fn report(&self, cx: &mut Cx, node: NodeId, expected: &str) {
        let ast = &cx.sc.ast;
        let (Some(left), Some(right)) = (ast.child(node, "left"), ast.child(node, "right")) else { return };
        let op = ast.str(node, "operator").unwrap_or("").to_string();
        let Some(tok) = cx.sc.first_token_between(left, right, |t| t.value == op) else { return };
        let loc = cx.sc.tok_loc(tok);
        let fix = fixer::replace_tok(tok, expected);
        let typeof_bin = is_typeof(cx, left) || is_typeof(cx, right);
        let lt = literal_type(cx, left);
        let same = lt.is_some() && lt == literal_type(cx, right);
        let mut r = Report::loc(loc, "unexpected").data("expectedOperator", expected).data("actualOperator", op.as_str());
        r.node = Some(node);
        if typeof_bin || same {
            r = r.fix(fix);
        } else {
            r.suggest.push(SuggestSpec {
                keys: vec![
                    ("messageId", SugVal::Str("replaceOperator".into())),
                    ("data", SugVal::Data(vec![("expectedOperator".into(), expected.into()), ("actualOperator".into(), op.as_str().into())])),
                    ("fix", SugVal::Fix),
                ],
                fix: Some(fix),
            });
        }
        cx.report(r);
    }
}

impl Rule for R {
    fn listeners(&self) -> &'static [&'static str] {
        &["BinaryExpression"]
    }

    fn on(&mut self, _: usize, node: NodeId, cx: &mut Cx) {
        let ast = &cx.sc.ast;
        let (Some(left), Some(right)) = (ast.child(node, "left"), ast.child(node, "right")) else { return };
        let is_null = is_null_literal(ast, right) || is_null_literal(ast, left);
        let op = ast.str(node, "operator").unwrap_or("");
        if op != "==" && op != "!=" {
            if self.inverse_null && is_null && (op == "===" || op == "!==") {
                let e = op[..op.len() - 1].to_string();
                self.report(cx, node, &e);
            }
            return;
        }
        if self.smart {
            let lt = literal_type(cx, left);
            let same = lt.is_some() && lt == literal_type(cx, right);
            if is_typeof(cx, left) || is_typeof(cx, right) || same || is_null {
                return;
            }
        }
        if !self.enforce_null && is_null {
            return;
        }
        let e = format!("{op}=");
        self.report(cx, node, &e);
    }
}

```

### Core Architecture Module: `demo/real-world/eslint-rs/linter-rs/src/rules/core/mod.rs`
```
use crate::rules::RuleDef;

macro_rules! rules {
    ($($m:ident),* $(,)?) => {
        $(pub mod $m;)*
        pub static ALL: &[&RuleDef] = &[$(&$m::DEF),*];
    };
}

rules!(eqeqeq, no_debugger, no_empty);

```

### Core Architecture Module: `demo/real-world/eslint-rs/linter-rs/src/rules/core/no_debugger.rs`
```
//! lib/rules/no-debugger.js

use crate::rules::{Rule, RuleDef};
use crate::ast::NodeId;
use crate::linter::Cx;
use crate::rule::Report;
use serde_json::Value;

pub static DEF: RuleDef = RuleDef {
    name: "no-debugger",
    messages: &[("unexpected", "Unexpected 'debugger' statement.")],
    has_default_options: false,
    create,
};

struct R;

fn create(options: &[Value]) -> Result<Box<dyn Rule>, String> {
    if !options.is_empty() {
        return Err("no options allowed".into());
    }
    Ok(Box::new(R))
}

impl Rule for R {
    fn listeners(&self) -> &'static [&'static str] {
        &["DebuggerStatement"]
    }

    fn on(&mut self, _: usize, node: NodeId, cx: &mut Cx) {
        cx.report(Report::node(node, "unexpected"));
    }
}

```

### Core Architecture Module: `demo/real-world/eslint-rs/linter-rs/src/rules/core/no_empty.rs`
```
//! lib/rules/no-empty.js

use crate::rules::{Rule, RuleDef};
use crate::ast::NodeId;
use crate::linter::Cx;
use crate::report::SugVal;
use crate::rule::{fixer, Report, SuggestSpec};
use crate::source::Loc;
use crate::utils::{is_function, is_opening_brace};
use serde_json::Value;

pub static DEF: RuleDef = RuleDef {
    name: "no-empty",
    messages: &[
        ("unexpected", "Empty {{type}} statement."),
        ("suggestComment", "Add comment inside empty {{type}} statement."),
    ],
    has_default_options: true,
    create,
};

struct R {
    allow_empty_catch: bool,
}

fn create(options: &[Value]) -> Result<Box<dyn Rule>, String> {
    let mut allow = false;
    match options {
        [] => {}
        [Value::Object(o)] => {
            for (k, v) in o {
                match (k.as_str(), v) {
                    ("allowEmptyCatch", Value::Bool(b)) => allow = *b,
                    _ => return Err("invalid option".into()),
                }
            }
        }
        _ => return Err("invalid option".into()),
    }
    Ok(Box::new(R { allow_empty_catch: allow }))
}

fn suggest(kind: &str, range: (u32, u32)) -> SuggestSpec {
    SuggestSpec {
        keys: vec![
            ("messageId", SugVal::Str("suggestComment".into())),
            ("data", SugVal::Data(vec![("type".into(), kind.into())])),
            ("fix", SugVal::Fix),
        ],
        fix: Some(fixer::replace_range(range, " /* empty */ ")),
    }
}

impl Rule for R {
    fn listeners(&self) -> &'static [&'static str] {
        &["BlockStatement", "SwitchStatement"]
    }

    fn on(&mut self, l: usize, node: NodeId, cx: &mut Cx) {
        let ast = &cx.sc.ast;
        if l == 0 {
            if !ast.list(node, "body").is_empty() {
                return;
            }
            let Some(parent) = ast.parent(node) else { return };
            if is_function(ast, parent) {
                return;
            }
            if self.allow_empty_catch && ast.is(parent, "CatchClause") {
                return;
            }
            if !cx.sc.comments_inside(node).is_empty() {
                return;
            }
            let (s, e) = ast.range(node);
            let mut r = Report::node(node, "unexpected").data("type", "block");
            r.suggest.push(suggest("block", (s + 1, e - 1)));
            cx.report(r);
        } else {
            if !ast.list(node, "cases").is_empty() {
                return;
            }
            let Some(disc) = ast.child(node, "discriminant") else { return };
            let Some(open) = cx.sc.token_after_f(disc, is_opening_brace) else { return };
            let Some(close) = cx.sc.last_token(node, crate::tokens::N) else { return };
            if cx.sc.comments_exist_between(open.end, close.start) {
                return;
            }
            let loc = Loc { start: cx.sc.loc_of(open.start), end: cx.sc.loc_of(close.end) };
            let range = (open.end, close.start);
            let mut r = Report::loc(loc, "unexpected").data("type", "switch");
            r.node = Some(node);
            r.suggest.push(suggest("switch", range));
            cx.report(r);
        }
    }
}

```

### Core Architecture Module: `demo/real-world/eslint-rs/linter-rs/src/rules/group_re/util.rs`
```
//! lib/rules/utils/char-source.js, regular-expressions.js and unicode/*.

use crate::ast::NodeId;
use crate::linter::Cx;
use crate::regexpp::validator::{Options, Validator};
use crate::scope::ScopeId;
use crate::static_value::{
    ReferenceTracker, TraceMap, V, get_static_value, get_string_if_constant, num_to_string,
};

pub fn utf16(s: &str) -> Vec<u16> {
    s.encode_utf16().collect()
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CodeUnit {
    pub start: usize,
    pub len: usize,
    pub value: u16,
}

impl CodeUnit {
    pub fn end(&self) -> usize {
        self.start + self.len
    }
}

struct TextReader<'a> {
    source: &'a [u16],
    pos: usize,
}

impl TextReader<'_> {
    fn at(&self, offset: isize) -> Option<u16> {
        let i = self.pos as isize + offset;
        if i < 0 {
            return None;
        }
        self.source.get(i as usize).copied()
    }

    fn read(&self, offset: isize, length: usize) -> Vec<u16> {
        let start = (self.pos as isize + offset).max(0) as usize;
        let end = (start + length).min(self.source.len());
        if start >= end {
            Vec::new()
        } else {
            self.source[start..end].to_vec()
        }
    }
}

fn hex_value(units: &[u16]) -> Option<u32> {
    let s = String::from_utf16(units).ok()?;
    u32::from_str_radix(&s, 16).ok()
}

fn read_hex_sequence(reader: &mut TextReader, length: usize) -> Vec<u16> {
    let units = reader.read(0, length);
    reader.pos += length;
    vec![hex_value(&units).unwrap_or(0) as u16]
}

fn read_unicode_sequence(reader: &mut TextReader) -> Vec<u16> {
    if reader.at(0) == Some(u16::from(b'{')) {
        let mut i = reader.pos + 1;
        while i < reader.source.len()
            && reader.source[i] < 0x80
            && (reader.source[i] as u8).is_ascii_hexdigit()
        {
            i += 1;
        }
        if i > reader.pos + 1 && reader.source.get(i) == Some(&u16::from(b'}')) {
            let cp = hex_value(&reader.source[reader.pos + 1..i]).unwrap_or(0);
            reader.pos = i + 1;
            let mut buf = [0u16; 2];
            return match char::from_u32(cp) {
                Some(c) => c.encode_utf16(&mut buf).to_vec(),
                None => vec![cp as u16],
            };
        }
    }
    read_hex_sequence(reader, 4)
}

fn read_octal_sequence(reader: &mut TextReader, max_length: usize) -> Vec<u16> {
    let units = reader.read(-1, max_length);
    let n = units
        .iter()
        .take_while(|u| (u16::from(b'0')..=u16::from(b'7')).contains(u))
        .count();
    reader.pos += n.saturating_sub(1);
    let mut v = 0u32;
    for u in &units[..n] {
        v = v * 8 + u32::from(*u - u16::from(b'0'));
    }
    vec![v as u16]
}

fn read_escape_sequence_or_line_continuation(reader: &mut TextReader) -> Vec<u16> {
    let ch = reader.at(1);
    reader.pos += 2;
    let Some(ch) = ch else { return Vec::new() };
    let simple = match ch {
        0x62 => Some(0x08),
        0x66 => Some(0x0c),
        0x6e => Some(0x0a),
        0x72 => Some(0x0d),
        0x74 => Some(0x09),
        0x76 => Some(0x0b),
        _ => None,
    };
    if let Some(s) = simple {
        return vec![s];
    }
    match ch {
        0x78 => read_hex_sequence(reader, 2),
        0x75 => read_unicode_sequence(reader),
        0x0d => {
            if reader.at(0) == Some(0x0a) {
                reader.pos += 1;
            }
            Vec::new()
        }
        0x0a | 0x2028 | 0x2029 => Vec::new(),
        0x30..=0x33 => read_octal_sequence(reader, 3),
        0x34..=0x37 => read_octal_sequence(reader, 2),
        _ => vec![ch],
    }
}

fn map_escape_sequence_or_line_continuation(reader: &mut TextReader, out: &mut Vec<CodeUnit>) {
    let start = reader.pos;
    let units = read_escape_sequence_or_line_continuation(reader);
    let len = reader.pos - start;
    for u in units.iter().take(2) {
        out.push(CodeUnit {
            start,
            len,
            value: *u,
        });
    }
}

pub fn parse_string_literal(source: &[u16]) -> Vec<CodeUnit> {
    let mut reader = TextReader { source, pos: 0 };
    let quote = reader.at(0);
    reader.pos += 1;
    let mut out = Vec::new();
    loop {
        let ch = reader.at(0);
        if ch == quote || ch.is_none() {
            break;
        }
        if ch == Some(0x5c) {
            map_escape_sequence_or_line_continuation(&mut reader, &mut out);
        } else {
            out.push(CodeUnit {
                start: reader.pos,
                len: 1,
                value: ch.unwrap_or(0),
            });
            reader.pos += 1;
        }
    }
    out
}

pub fn parse_template_token(source: &[u16]) -> Vec<CodeUnit> {
    let mut reader = TextReader { source, pos: 0 };
    reader.pos += 1;
    let mut out = Vec::new();
    loop {
        let ch = reader.at(0);
        if ch.is_none() || ch == Some(0x60) || (ch == Some(0x24) && reader.at(1) == Some(0x7b)) {
            break;
        }
        if ch == Some(0x5c) {
            map_escape_sequence_or_line_continuation(&mut reader, &mut out);
        } else if ch == Some(0x0d) {
            let len = if reader.at(1) == Some(0x0a) { 2 } else { 1 };
            out.push(CodeUnit {
                start: reader.pos,
                len,
                value: 0x0a,
            });
            reader.pos += len;
        } else {
            out.push(CodeUnit {
                start: reader.pos,
                len: 1,
                value: ch.unwrap_or(0),
            });
            reader.pos += 1;
        }
    }
    out
}

pub fn is_combining_character(cp: u32) -> bool {
    crate::regexpp::validator::is_mark(cp)
}

pub fn is_emoji_modifier(code: u32) -> bool {
    (0x1f3fb..=0x1f3ff).contains(&code)
}

pub fn is_regional_indicator_symbol(code: u32) -> bool {
    (0x1f1e6..=0x1f1ff).contains(&code)
}

pub fn is_surrogate_pair(lead: u32, tail: u32) -> bool {
    (0xd800..0xdc00).contains(&lead) && (0xdc00..0xe000).contains(&tail)
}

pub const REGEXPP_LATEST_ECMA_VERSION: u32 = 2025;

pub fn is_valid_with_unicode_flag(ecma_version: u32, pattern: &[u16]) -> bool {
    if ecma_version <= 5 {
        return false;
    }
    let options = Options {
        strict: false,
        ecma_version: Some(ecma_version.min(REGEXPP_LATEST_ECMA_VERSION)),
    };
    Validator::new(options, ())
        .validate_pattern(pattern, 0, pattern.len(), Some((true, false)))
        .is_ok()
}

pub fn node_text16(cx: &Cx, node: NodeId) -> Vec<u16> {
    utf16(cx.sc.node_text(node))
}

pub fn regex_of(cx: &Cx, node: NodeId) -> Option<(Vec<u16>, String)> {
    let ast = &cx.sc.ast;
    if !ast.is(node, "Literal") || ast.prop(node, "regex").is_none() {
        return None;
    }
    let raw = cx.sc.node_text(node);
    let slash = raw.rfind('/')?;
    if slash == 0 {
        return None;
    }
    Some((utf16(&raw[1..slash]), raw[slash + 1..].to_string()))
}

pub fn string_value(cx: &Cx, node: NodeId) -> Option<Vec<u16>> {
    let ast = &cx.sc.ast;
    if !ast.is(node, "Literal")
        || !matches!(ast.prop(node, "value"), Some(crate::ast::Prop::Str(_)))
    {
        return None;
    }
    Some(
        parse_string_literal(&node_text16(cx, node))
            .iter()
            .map(|u| u.value)
            .collect(),
    )
}

pub fn static_template_value(cx: &Cx, node: NodeId) -> Option<Vec<u16>> {
    if !crate::utils::is_static_template_literal(&cx.sc.ast, node) {
        return None;
    }
    Some(
        parse_template_token(&node_text16(cx, node))
            .iter()
            .map(|u| u.value)
            .collect(),
    )
}

#[derive(Debug, Clone, PartialEq)]
pub enum Static {
    Null,
    Str(Vec<u16>),
    Regex,
    Unknown,
}

fn from_value(v: &V) -> Static {
    match v {
        V::Str(s) if s.contains('\u{fffd}') => Static::Unknown,
        V::Str(s) => Static::Str(utf16(s)),
        V::Undefined => Static::Str(utf16("undefined")),
        V::Null => Static::Str(utf16("null")),
        V::Bool(b) => Static::Str(utf16(if *b { "true" } else { "false" })),
        V::Num(n) => Static::Str(utf16(&num_to_string(*n))),
        V::RegExp(_) => Static::Regex,
        _ => Static::Unknown,
    }
}

fn exact_string(cx: &Cx, node: NodeId) -> Option<Vec<u16>> {
    string_value(cx, node).or_else(|| static_template_value(cx, node))
}

pub fn static_value(cx: &Cx, node: Option<NodeId>, scope: ScopeId) -> Static {
    let Some(node) = node else {
        return Static::Null;
    };
    if let Some(s) = exact_string(cx, node) {
        return Static::Str(s);
    }
    match get_static_value(&cx.sc.ast, cx.sm(), node, Some(scope)) {
        Ok(Some(v)) => from_value(&v.value),
        Ok(None) => Static::Null,
        Err(_) => Static::Unknown,
    }
}

pub fn string_if_constant(cx: &Cx, node: Option<NodeId>, scope: ScopeId) -> Static {
    let Some(node) = node else {
        return Static::Null;
    };
    if let Some(s) = exact_string(cx, node) {
        return Static::Str(s);
    }
    match get_string_if_constant(&cx.sc.ast, cx.sm(), Some(node), Some(scope)) {
        Ok(Some(s)) if s.contains('\u{fffd}') => Static::Unknown,
        Ok(Some(s)) => Static::Str(utf16(&s)),
        Ok(None) => Static::Null,
        Err(_) => Static::Unknown,
    }
}

pub fn regexp_global_calls(cx: &Cx) -> Result<Vec<NodeId>, &'static str> {
    let sm = cx.sm();
    let map = TraceMap {
        keys: vec![(
            "RegExp".into(),
            TraceMap {
                call: Some(0),
                construct: Some(0),
                ..TraceMap::default()
            },
        )],
        ..TraceMap::default()
    };
    let refs = ReferenceTracker::new(&cx.sc.ast, sm, sm.global_scope())
        .iterate_global_references(&map)
        .map_err(|_| "RegExp reference this port does not track")?;
    Ok(refs.into_iter().map(|r| r.node).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn units(s: &str) -> Vec<(usize, usize, u16)> {
        parse_string_literal(&utf16(s))
            .ite
```

### Core Architecture Module: `demo/real-world/eslint-rs/linter-rs/src/utils.rs`
```
//! The parts of lib/rules/utils/ast-utils.js the ported rules use.

use crate::ast::{Ast, NodeId, Prop};
use crate::source::{TokKind, Token};

pub fn is_function(ast: &Ast, n: NodeId) -> bool {
    matches!(
        ast.kind(n),
        "FunctionDeclaration" | "FunctionExpression" | "ArrowFunctionExpression"
    )
}

/// `isSpecificId(node, name)`.
pub fn is_specific_id(ast: &Ast, n: NodeId, name: &str) -> bool {
    ast.is(n, "Identifier") && ast.name(n) == Some(name)
}

/// `isCallee(node)`.
pub fn is_callee(ast: &Ast, n: NodeId) -> bool {
    ast.parent(n)
        .is_some_and(|p| ast.is(p, "CallExpression") && ast.child(p, "callee") == Some(n))
}

/// `couldBeError(node)`.
pub fn could_be_error(ast: &Ast, n: NodeId) -> bool {
    let op = ast.str(n, "operator").unwrap_or("");
    let c = |k: &str| ast.child(n, k).is_some_and(|x| could_be_error(ast, x));
    match ast.kind(n) {
        "Identifier"
        | "CallExpression"
        | "NewExpression"
        | "MemberExpression"
        | "TaggedTemplateExpression"
        | "YieldExpression"
        | "AwaitExpression"
        | "ChainExpression" => true,
        "AssignmentExpression" => match op {
            "=" | "&&=" => c("right"),
            "||=" | "??=" => c("left") || c("right"),
            _ => false,
        },
        "SequenceExpression" => ast
            .list(n, "expressions")
            .last()
            .copied()
            .flatten()
            .is_some_and(|x| could_be_error(ast, x)),
        "LogicalExpression" => {
            if op == "&&" {
                c("right")
            } else {
                c("left") || c("right")
            }
        }
        "ConditionalExpression" => c("consequent") || c("alternate"),
        _ => false,
    }
}

/// `isNullOrUndefined(node)`.
pub fn is_null_or_undefined(ast: &Ast, n: NodeId) -> bool {
    is_null_literal(ast, n)
        || (ast.is(n, "Identifier") && ast.name(n) == Some("undefined"))
        || (ast.is(n, "UnaryExpression") && ast.str(n, "operator") == Some("void"))
}

/// `getUpperFunction(node)`.
pub fn get_upper_function(ast: &Ast, n: NodeId) -> Option<NodeId> {
    std::iter::once(n)
        .chain(ast.ancestors(n))
        .find(|x| is_function(ast, *x))
}

/// `startsWithUpperCase(s)`.
pub fn starts_with_upper_case(s: &str) -> bool {
    s.chars()
        .next()
        .is_some_and(|c| c.to_lowercase().ne(std::iter::once(c)))
}

fn has_this_tag(value: &str) -> bool {
    let chars: Vec<char> = value.chars().collect();
    let mut line_start = true;
    for i in 0..chars.len() {
        if line_start {
            let mut j = i;
            while j < chars.len() && (chars[j] == '*' || is_js_whitespace(chars[j])) {
                j += 1;
            }
            if chars[j..].starts_with(&['@', 't', 'h', 'i', 's']) {
                return true;
            }
        }
        line_start = matches!(chars[i], '\n' | '\r' | '\u{2028}' | '\u{2029}');
    }
    false
}

fn find_jsdoc_comment(sc: &crate::source::SourceCode, n: NodeId) -> Option<&Token> {
    let t = sc.token_before(n, crate::tokens::C)?;
    let line = sc.node_loc(n).start.line;
    (t.kind == TokKind::Block
        && t.value.starts_with('*')
        && line as i64 - sc.loc_of(t.end).line as i64 <= 1)
        .then_some(t)
}

fn get_jsdoc_comment(sc: &crate::source::SourceCode, n: NodeId) -> Option<&Token> {
    let ast = &sc.ast;
    let parent = ast.parent(n)?;
    match ast.kind(n) {
        "ClassDeclaration" | "FunctionDeclaration" => {
            let target = if matches!(
                ast.kind(parent),
                "ExportDefaultDeclaration" | "ExportNamedDeclaration" | "ExportAllDeclaration"
            ) {
                parent
            } else {
                n
            };
            find_jsdoc_comment(sc, target)
        }
        "ClassExpression" => find_jsdoc_comment(sc, ast.parent(parent)?),
        "ArrowFunctionExpression" | "FunctionExpression" => {
            if !matches!(ast.kind(parent), "CallExpression" | "NewExpression") {
                let mut p = Some(parent);
                while let Some(x) = p {
                    if !sc.comments_before(ast.range(x).0).is_empty()
                        || ast.kind(x).contains("Function")
                        || matches!(ast.kind(x), "MethodDefinition" | "Property")
                    {
                        break;
                    }
                    p = ast.parent(x);
                }
                if let Some(x) = p
                    && !matches!(ast.kind(x), "FunctionDeclaration" | "Program")
                {
                    return find_jsdoc_comment(sc, x);
                }
            }
            find_jsdoc_comment(sc, n)
        }
        _ => None,
    }
}

/// `isDefaultThisBinding(node, sourceCode, { capIsConstructor })`.
pub fn is_default_this_binding(
    sc: &crate::source::SourceCode,
    node: NodeId,
    cap_is_constructor: bool,
) -> bool {
    use crate::eslint_utils::is_specific_member_access as member;
    let ast = &sc.ast;
    if let Some(p) = ast.parent(node)
        && ast.is(p, "PropertyDefinition")
        && ast.child(p, "value") == Some(node)
    {
        return false;
    }
    if ast.is(node, "StaticBlock") {
        return false;
    }
    if matches!(ast.kind(node), "FunctionDeclaration" | "FunctionExpression")
        && ast
            .nodes_of(node, "params")
            .any(|p| is_specific_id(ast, p, "this"))
    {
        return false;
    }
    let id = ast.child(node, "id");
    let es5_ctor = id
        .and_then(|i| ast.name(i))
        .is_some_and(starts_with_upper_case);
    if (cap_is_constructor && es5_ctor)
        || get_jsdoc_comment(sc, node).is_some_and(|c| has_this_tag(&c.value))
        || sc
            .comments_before(ast.range(node).0)
            .iter()
            .any(|c| has_this_tag(&c.value))
    {
        return false;
    }
    let anonymous = id.is_none();
    let mut current = node;
    loop {
        let Some(parent) = ast.parent(current) else {
            return true;
        };
        match ast.kind(parent) {
            "LogicalExpression" | "ConditionalExpression" | "ChainExpression" => current = parent,
            "ReturnStatement" => {
                let Some(func) = get_upper_function(ast, parent) else {
                    return true;
                };
                if !is_callee(ast, func) {
                    return true;
                }
                let Some(p) = ast.parent(func) else {
                    return true;
                };
                current = p;
            }
            "ArrowFunctionExpression" => {
                if ast.child(parent, "body") != Some(current) || !is_callee(ast, parent) {
                    return true;
                }
                let Some(p) = ast.parent(parent) else {
                    return true;
                };
                current = p;
            }
            "Property" | "PropertyDefinition" | "MethodDefinition" => {
                return ast.child(parent, "value") != Some(current);
            }
            "AssignmentExpression" | "AssignmentPattern" => {
                let Some(left) = ast.child(parent, "left") else {
                    return true;
                };
                if ast.is(left, "MemberExpression") {
                    return false;
                }
                return !(cap_is_constructor
                    && anonymous
                    && ast.is(left, "Identifier")
                    && ast.name(left).is_some_and(starts_with_upper_case));
            }
            "VariableDeclarator" => {
                let id = ast.child(parent, "id");
                return !(cap_is_constructor
                    && anonymous
                    && ast.child(parent, "init") == Some(current)
                    && id.is_some_and(|i| {
                        ast.is(i, "Identifier") && ast.name(i).is_some_and(starts_with_upper_case)
                    }));
            }
            "MemberExpression" => {
                if ast.child(parent, "object") == Some(current)
                    && member(
                        ast,
                        parent,
                        None,
                        Some(&|p: &str| matches!(p, "bind" | "call" | "apply")),
                    )
                {
                    let Some(pp) = ast.parent(parent) else {
                        return true;
                    };
                    let maybe = if ast.is(pp, "ChainExpression") {
                        pp
                    } else {
                        parent
                    };
                    let Some(call) = ast.parent(maybe) else {
                        return true;
                    };
                    let first = ast.list(call, "arguments").first().copied().flatten();
                    return !(is_callee(ast, maybe)
                        && first.is_some_and(|a| !is_null_or_undefined(ast, a)));
                }
                return true;
            }
            "CallExpression" => {
                let Some(callee) = ast.child(parent, "callee") else {
                    return true;
                };
                let args = ast.list(parent, "arguments");
                let arg = |i: usize| args.get(i).copied().flatten();
                let nul = |i: usize| arg(i).is_some_and(|a| is_null_or_undefined(ast, a));
                if member(
                    ast,
                    callee,
                    Some(&|o: &str| o == "Reflect"),
                    Some(&|p: &str| p == "apply"),
                ) {
                    return args.len() != 3 || arg(0) != Some(current) || nul(1);
                }
                if member(
                    ast,
                    callee,
                    Some(&|o: &str| o.ends_with("Array")),
                    Some(&|p: &str| p == "from"),
                ) || member(
                    ast,
                
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #126** (2026-11-20): **analyze: C dependency is missed when only the source file's header includes it**
  *Symptoms*: ### What happened  `rust-anything analyze --lang c --whole-app --json` puts `src/a.c` and `src/b.c` in the same migration wave with no internal dependency between them. `a.c` calls `b()`, and the declaration is available through `a.c` → `a.h` → `b.h`.  I expected `src/a.c` to list `src/b.c` in `internal_deps` and run in a later wave. Adding `#include "b.h"` directly to `a.c` gives that result. The dependency chain also appears if `a.h` is renamed to `api.h` and the include in `a.c` is updated. This points to [`discover()` dropping headers with a matching `.c` basename](https://github.com/erkamyaman/rust-anything/blob/v2.1.0/src/lang/c.rs#L108-L117) before the analyzer reads their includes.  ### How to reproduce  ```shell rust-anything --version repro=$(mktemp -d) mkdir -p "$repro/src" printf '#include "a.h"\nint a(void) { return b(); }\n' > "$repro/src/a.c" printf '#pragma once\n#include "b.h"\nint a(void);\n' > "$repro/src/a.h" printf '#include "b.h"\nint b(void) { return 42; }\n' > "$repro/src/b.c" printf '#pragma once\nint b(void);\n' > "$repro/src/b.h"  (cd "$repro/src" && gcc -MM a.c b.c) rust-anything analyze "$repro" --lang c --whole-app --json |   python3 -c 'import json,sys; r=json.load(sys.stdin); print([(u["id"], u["internal_deps"], u["wave"]) for u in r["units"]])' ```  ### Output  ```text rust-anything 2.1.0 a.o: a.c a.h b.h b.o: b.c b.h [('src/a.c', [], 0), ('src/b.c', [], 0)]   The last line shows `(id, internal_deps, wave)` for each unit. The two entries in `w

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

### Incident Patch 1: `8a675e19` (2026-11-22)
**Commit Message**: fix(js): capture `--from-tests` arguments with the codec `record` uses (#198)

The JS capture hook had its own copy of the encoder, behind `CODEC_JS`: a `Buffer` was captured
as a `Uint8Array`, other typed arrays as objects with numeric keys, and an object shaped like a
marker (`{ $date: 'x' }`) was replayed as a `Date`, so the original recorded results its tests
never saw. The hook now takes `enc` from `CODEC_JS` and leaves out a call whose arguments `dec`
would turn into a different value (a RegExp, Error, URL, ArrayBuffer, boxed primitive, or an
object with `toJSON`). Its names take a `__ra` prefix and it reads built-ins from `globalThis`,
so a wrapped function named `enc` or `Buffer` changes nothing. Array holes stay `undefined`, and
a typed array subclass is captured as its built-in kind. A unit test keeps the copy in step with
`CODEC_JS`.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: Kam <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -11,6 +11,14 @@
   failed every case with `TypeError: unexpected keyword argument`. A Python mismatch shows its
   keyword arguments after the positional ones, as Ruby's does, so a `known-diffs.jsonl` entry
   for `f(x)` no longer explains `f(x, flag=True)`.
+- JS/TS `record --from-tests` encodes the captured arguments with the codec `record` and `diff`
+  use, instead of a copy of it that had fallen behind. A `Buffer` was captured as a `Uint8Array`
+  (so `b.toString('hex')` recorded `"104,105"`), a `Float64Array` or other typed array as an
+  object with numeric keys, and an object shaped like a marker (`{ $date: 'x' }`) was replayed as
+  a `Date`. A call is now left out, as one that passes a function or a cycle already was, when an
+  argument is a RegExp, an Error, a `URL`, an `ArrayBuffer`, a boxed primitive or an object with
+  `toJSON`: those were captured as `{}`, their own fields or their `toJSON` result, which replay
+  passed as a different value. A class instance is still captured as its own fields.
 
 ## 3.1.0 (2026-11-22)
 
```

**File**: `src/from_tests.rs` (modified, +111/-17)
```diff
@@ -167,6 +167,7 @@ fn instrument_js(m: &Manifest, skipped: &mut Vec<String>) -> Result<Restore> {
         by_file.entry(&f.file).or_default().push(&f.name);
     }
     let mut guard = Restore(Vec::new());
+    let capture = JS_CAPTURE.replace("__CODEC__", &js_codec());
     for (file, names) in by_file {
         let path = m.root.join(file);
         restore(&path);
@@ -202,7 +203,7 @@ fn instrument_js(m: &Manifest, skipped: &mut Vec<String>) -> Result<Restore> {
         let instrumented = format!(
             "{}{text}\n{}",
             if ts { "// @ts-nocheck\n" } else { "" },
-            JS_CAPTURE.replace("__WRAPS__", &wraps)
+            capture.replace("__WRAPS__", &wraps)
         );
         std::fs::write(&path, instrumented)
             .with_context(|| format!("instrumenting {}", path.display()))?;
@@ -216,29 +217,19 @@ const JS_CAPTURE: &str = r#"// rust-anything record --from-tests: removed when t
 {
   const __raFs = globalThis.process?.getBuiltinModule?.('node:fs')
   const __raOut = globalThis.process?.env?.RUST_ANYTHING_CAPTURE
-  const __raCount = new Map()
-  const __raReplacer = function (k, v) {
-    const raw = this[k]
-    if (typeof raw === 'function' || typeof raw === 'symbol') throw new Error('not data')
-    if (raw instanceof Date) return { $date: Number.isNaN(raw.getTime()) ? 'Invalid' : raw.toISOString() }
-    if (raw instanceof Uint8Array) return { $bytes: Array.from(raw) }
-    if (raw instanceof Map) return { $map: [...raw] }
-    if (raw instanceof Set) return { $set: [...raw] }
-    return v === undefined ? { $undefined: true }
-      : typeof v === 'bigint' ? { $bigint: String(v) }
-      : typeof v === 'number' ? (Number.isFinite(v) && !Object.is(v, -0) ? v : { $num: Object.is(v, -0) ? '-0' : String(v) })
-      : typeof v === 'string' && !v.isWellFormed() ? { $utf16: Array.from({ length: v.length }, (_, i) => v.charCodeAt(i)) }
-      : v
-  }
+  const __raCount = new globalThis.Map()
+  // The built-in name of a typed array, which a subclass cannot change.
+  const __raTypedName = globalThis.Object.getOwnPropertyDescriptor(globalThis.Object.getPrototypeOf(globalThis.Uint8Array.prototype), globalThis.Symbol.toStringTag).get
+__CODEC__
   const __raWrap = (name, orig) => {
     if (!__raFs || !__raOut || typeof orig !== 'function') return orig
     const wrapped = function (...args) {
       const n = __raCount.get(name) ?? 0
       if (n < 5000) {
         __raCount.set(name, n + 1)
-        try { __raFs.appendFileSync(__raOut, JSON.stringify({ fn: name, args }, __raReplacer) + '\n') } catch {}
+        try { __raFs.appendFileSync(__raOut, globalThis.JSON.stringify({ fn: name, args: globalThis.Array.from(args, a => __raEnc(a)) }) + '\n') } catch {}
       }
-      return new.target ? Reflect.construct(orig, args, new.target) : orig.apply(this, args)
+      return new.target ? globalThis.Reflect.construct(orig, args, new.target) : orig.apply(this, args)
     }
     if (typeof exports === 'object' && exports !== null) {
       for (const key of [name, 'default']) if (exports[key] === orig) exports[key] = wrapped
@@ -249,6 +240,71 @@ __WRAPS__}
 /* c8 ignore stop */
 "#;
 
+/// What the capture hook changes in the `enc` of `CODEC_JS`: a value `dec` cannot give back
+/// throws, so the call is left out. That is a function, symbol, cycle, RegExp or Error, an
+/// object `dec` would rebuild as a plain one although it is not (a `URL`, an `ArrayBuffer`, a
+/// boxed string, anything with `toJSON`, or a RegExp, Error, Map, Set or Date from another
+/// realm), and a typed array keeps its built-in kind (a subclass is not a global `dec` can find).
+/// Array holes stay `undefined`, as `JSON.stringify` saw them before. A class instance is still
+/// captured as its own fields, as before.
+const JS_CAPTURE_ENC: &[(&str, &str)] = &[
+    ("return { $function: v.name }", NOT_DATA),
+    ("return { $symbol: String(v.description) }", NOT_DATA),
+    ("return { $cycle: true }", NOT_DATA),
+    ("return { $regexp: String(v) }", NOT_DATA),
+    ("return { $error: v.message }", NOT_DATA),
+    (
+        "if (Array.isArray(v)) return v.map(x => enc(x, next))",
+        "if (Array.isArray(v)) return Array.from(v, x => enc(x, next))",
+    ),
+    ("kind: v.constructor.name,", "kind: __raTypedName.call(v),"),
+    (
+        "const plain = Object.fromEntries(",
+        "if (Object.prototype.toString.call(v) !== '[object Object]' || typeof v.toJSON === 'function') throw new Error('not data')\n  const plain = Object.fromEntries(",
+    ),
+];
+
+const NOT_DATA: &str = "throw new Error('not data')";
+
+/// The `enc` of `CODEC_JS`, which `record` uses, for the capture hook, changed as
+/// `JS_CAPTURE_ENC` says. It runs inside the user's module: its names take a `__ra` prefix so
+/// they cannot shadow a wrapped function of the same name, and the built-ins it uses are read
+/// from `globalThis` so the module's own names cannot shadow them. Strings and comments are left
+/// as they ar
```

**File**: `tests/recording.rs` (modified, +72/-0)
```diff
@@ -289,6 +289,78 @@ fn records_the_calls_a_js_test_suite_makes_and_restores_the_source() {
     assert!(inputs.contains(r#"{"fn":"label","args":[7]}"#), "{inputs}");
 }
 
+#[test]
+fn js_test_calls_are_captured_with_the_codec_record_uses() {
+    if !common::have("node") {
+        return;
+    }
+    let root = project(
+        "ts-codec",
+        &[
+            (
+                "package.json",
+                r#"{"name":"bin","version":"0.1.0","type":"module"}"#,
+            ),
+            (
+                "src/bin.ts",
+                "export function hex(b: Buffer): string {\n  return b.toString('hex')\n}\n\n\
+                 export function total(xs: Float64Array): number {\n  let s = 0\n  for (const x of xs) s += x\n  return s\n}\n\n\
+                 export function tag(o: { $date: string }): string {\n  return typeof o.$date\n}\n\n\
+                 export function hole(xs: (number | undefined)[]): boolean {\n  return xs[1] === undefined\n}\n\n\
+                 export function enc(s: string): string {\n  return s + '!'\n}\n\n\
+                 export function looksLikeMarker(s: string): string {\n  return s + '?'\n}\n\n\
+                 export function kind(v: unknown): string {\n  return Object.prototype.toString.call(v)\n}\n\n\
+                 export function Buffer(s: string): string {\n  return s + '#'\n}\n",
+            ),
+            (
+                "test.ts",
+                "import { hex, total, tag, hole, enc, looksLikeMarker, kind, Buffer as B } from './src/bin.ts'\n\
+                 class Sub extends Float64Array {}\n\
+                 class Tagged extends Float64Array { get [Symbol.toStringTag]() { return 'Tagged' } }\n\
+                 class T { a = 1; toJSON() { return 1 } }\n\
+                 const cyclic: any = {}\ncyclic.self = cyclic\n\
+                 if (hex(Buffer.from('hi')) !== '6869') process.exit(1)\n\
+                 if (total(new Float64Array([1.5, 2])) !== 3.5) process.exit(1)\n\
+                 if (total(new Sub([1, 2])) !== 3 || total(new Tagged([2, 2])) !== 4) process.exit(1)\n\
+                 if (B('c') !== 'c#') process.exit(1)\n\
+                 if (tag({ $date: 'x' }) !== 'string') process.exit(1)\n\
+                 if (!hole([1, , 3])) process.exit(1)\n\
+                 if (enc('a') !== 'a!' || looksLikeMarker('b') !== 'b?') process.exit(1)\n\
+                 for (const v of [() => 1, Symbol('s'), cyclic, /a/, new Error('e'), { r: /a/ },\n\
+                   new URL('https://example.com/'), new ArrayBuffer(2), new String('s'), new T()]) kind(v)\n\
+                 if (kind([0]) !== '[object Array]') process.exit(1)\n",
+            ),
+        ],
+    );
+    let (printed, inputs) = from_tests(&root, "src/bin.ts", &["node", "test.ts"]);
+    let cases = std::fs::read_to_string(root.join("port").join("cases.jsonl")).unwrap();
+    std::fs::remove_dir_all(&root).unwrap();
+    // Values `dec` cannot give back (a function, symbol, cycle, RegExp, Error, URL, ArrayBuffer,
+    // boxed string, or anything with `toJSON`, also nested) leave their call out; functions of
+    // the unit named like the codec's `enc` and `looksLikeMarker` are still wrapped, and one
+    // named `Buffer` does not stop the codec from telling a `Buffer`.
+    assert!(
+        printed.contains("Captured 10 call(s)"),
+        "{printed}\n{inputs}"
+    );
+    assert_eq!(inputs.matches(r#"{"fn":"kind""#).count(), 1, "{inputs}");
+    // Replayed through `dec`, each captured input gives the original what the test passed.
+    for line in [
+        r#"{"fn":"hex","args":[{"$buffer":[104,105]}],"ok":"6869"}"#,
+        r#"{"fn":"total","args":[{"$typed":{"kind":"Float64Array","values":[1.5,2]}}],"ok":3.5}"#,
+        r#"{"fn":"total","args":[{"$typed":{"kind":"Float64Array","values":[1,2]}}],"ok":3}"#,
+        r#"{"fn":"total","args":[{"$typed":{"kind":"Float64Array","values":[2,2]}}],"ok":4}"#,
+        r#"{"fn":"Buffer","args":["c"],"ok":"c#"}"#,
+        r#"{"fn":"tag","args":[{"$object":{"$date":"x"}}],"ok":"string"}"#,
+        r#"{"fn":"hole","args":[[1,{"$undefined":true},3]],"ok":true}"#,
+        r#"{"fn":"enc","args":["a"],"ok":"a!"}"#,
+        r#"{"fn":"looksLikeMarker","args":["b"],"ok":"b?"}"#,
+        r#"{"fn":"kind","args":[[0]],"ok":"[object Array]"}"#,
+    ] {
+        assert!(cases.contains(line), "{line}\n{cases}");
+    }
+}
+
 #[test]
 fn record_reports_lines_of_the_original_no_case_reached() {
     if !common::have("node") {
```

---

### Incident Patch 2: `ca817a1d` (2026-11-22)
**Commit Message**: fix(demo): link the Ruby and Python real-world crates on macOS

ruby-shellwords-rs and python-colorsys-rs predate the build.rs that bridge now writes for magnus
and PyO3, so they failed to link on macOS without -undefined dynamic_lookup.

**File**: `demo/real-world/python-colorsys-rs/build.rs` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+fn main() {
+    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
+        println!("cargo:rustc-link-arg=-Wl,-undefined,dynamic_lookup");
+    }
+}
```

**File**: `demo/real-world/ruby-shellwords-rs/build.rs` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+fn main() {
+    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
+        println!("cargo:rustc-link-arg=-Wl,-undefined,dynamic_lookup");
+    }
+}
```

---

### Incident Patch 3: `7b9f7e99` (2026-11-22)
**Commit Message**: fix(python): keep `--from-tests` calls that pass arguments by keyword (#193)

* fix(python): keep `--from-tests` calls that pass arguments by keyword

The Python capture hook wrote a call only when `inspect.Signature.bind` put every argument in
`bound.args`. A keyword-only argument (`def f(x, *, flag)`) or one named after a skipped default
(`f(x, fill='*')`) lands in `bound.kwargs`, so those calls were silently dropped. They are now
written with a `kwargs` object of encoded values, which `run_case` in the driver already reads.
The `--inputs` help and the `RecordOptions` doc now mention `kwargs`.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(python): replay keyword arguments under the bindings' names, and key mismatches by them

`diff` and `bench` passed captured and generated keyword arguments to the Rust bindings under
the original's names, while `signature()` names each binding parameter in snake_case: a
keyword-only `scaleBy` failed every case with `unexpected keyword argument 'scaleBy'`. The driver
now renames them with `binding_name()`, a copy of `bridge::snake_case` without `r#`.

A Python mismatch now shows keyword arguments after the positional ones, as Ruby's 

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -2,6 +2,16 @@
 
 ## Unreleased
 
+- Python `record --from-tests` keeps the calls that pass arguments by keyword where Python does
+  not bind them by position: keyword-only parameters (`def f(x, *, flag)`) and an argument named
+  after a skipped default (`f(x, fill='*')`). They were dropped from `test-inputs.jsonl`; they
+  are now written with a `kwargs` object, which the driver already replays.
+- Python `diff` and `bench` pass keyword arguments to the Rust bindings under the bindings'
+  snake_case names (`scaleBy=10` as `scale_by=10`); a keyword-only parameter named in camelCase
+  failed every case with `TypeError: unexpected keyword argument`. A Python mismatch shows its
+  keyword arguments after the positional ones, as Ruby's does, so a `known-diffs.jsonl` entry
+  for `f(x)` no longer explains `f(x, flag=True)`.
+
 ## 3.1.0 (2026-11-22)
 
 - `go` runs `bench` after gate and switches a unit on only when it is not slower as its callers
```

**File**: `src/from_tests.rs` (modified, +10/-6)
```diff
@@ -26,7 +26,8 @@ const BACKUP: &str = ".rust-anything-backup";
 
 #[derive(Debug)]
 pub struct Capture {
-    /// The captured inputs, one `{"fn", "args"}` per line, in the `--inputs` format.
+    /// The captured inputs, one `{"fn", "args"}` per line (with `"kwargs"` for Python arguments
+    /// passed by keyword), in the `--inputs` format.
     pub inputs: PathBuf,
     pub per_function: BTreeMap<String, usize>,
     /// Exports the capture cannot see (not a function declaration), with why.
@@ -292,11 +293,14 @@ def _wrap(name, orig):
         if n < 5000 and sig is not None:
             try:
                 bound = sig.bind(*args, **kwargs)
-                if not bound.kwargs:
-                    line = json.dumps({"fn": name, "args": enc(list(bound.args))}, ensure_ascii=False, allow_nan=False)
-                    with open(_OUT, "a", encoding="utf-8") as f:
-                        f.write(line + "\n")
-                    _COUNT[name] = n + 1
+                case = {"fn": name, "args": enc(list(bound.args))}
+                # Keyword-only arguments, and those named after a skipped default.
+                if bound.kwargs:
+                    case["kwargs"] = {k: enc(v) for k, v in bound.kwargs.items()}
+                line = json.dumps(case, ensure_ascii=False, allow_nan=False)
+                with open(_OUT, "a", encoding="utf-8") as f:
+                    f.write(line + "\n")
+                _COUNT[name] = n + 1
             except Exception:
                 pass
         return orig(*args, **kwargs)
```

**File**: `src/harness.rs` (modified, +2/-1)
```diff
@@ -110,7 +110,8 @@ pub struct RecordOptions<'a> {
     pub crate_dir: &'a Path,
     /// Generated cases per function.
     pub count: usize,
-    /// Extra cases, one `{"fn": name, "args": [...]}` JSON object per line.
+    /// Extra cases, one `{"fn": name, "args": [...]}` JSON object per line, with `"kwargs": {...}`
+    /// for Python and Ruby arguments passed by keyword.
     pub inputs: Option<&'a Path>,
     /// Import the original from this JS module instead of the TS source files.
     pub module: Option<&'a Path>,
```

**File**: `src/harness_py.rs` (modified, +35/-8)
```diff
@@ -389,7 +389,34 @@ def call_args(args):
     return [dec(a) for a in args]
 
 
-def run_case(mod, c):
+def binding_name(name):
+    """The name the Rust bindings give a parameter: `bridge::snake_case`, without `r#`."""
+    out = []
+    for i, ch in enumerate(name):
+        if ch.isupper():
+            prev = name[i - 1] if i else ""
+            nxt = name[i + 1:i + 2]
+            if prev and (prev.islower() or "0" <= prev <= "9") or (prev.isupper() and nxt.islower()):
+                out.append("_")
+            out.append(ch.lower())
+        else:
+            out.append(ch if ch.isalnum() else "_")
+    return "".join(out)
+
+
+def call_kwargs(c, rename=None):
+    """Keyword arguments by their names in the original, or in the bindings with `rename`."""
+    return {(rename(k) if rename else k): dec(v) for k, v in c.get("kwargs", {}).items()}
+
+
+def shown_args(c):
+    """A case's arguments as mismatches show them: keyword arguments appended, as Ruby does."""
+    if c.get("class"):
+        return [c.get("ctor"), c.get("calls")]
+    return c["args"] + [c["kwargs"]] if c.get("kwargs") else c["args"]
+
+
+def run_case(mod, c, rename=None):
     if c.get("class"):
         cls = getattr(mod, c["class"])
         results = []
@@ -409,7 +436,7 @@ def run_case(mod, c):
             except BaseException as e:  # noqa: BLE001
                 results.append({"error": error_text(e)})
         return {"results": results}
-    kwargs = {k: dec(v) for k, v in c.get("kwargs", {}).items()}
+    kwargs = call_kwargs(c, rename)
     try:
         return {"ok": enc(getattr(mod, c["fn"])(*call_args(c["args"]), **kwargs))}
     except (KeyboardInterrupt, SystemExit):
@@ -474,7 +501,7 @@ def diff(cases_path, out_path, package_dir, name, key_order):
             continue
         if PIN_CASE:
             PIN_CASE(index)
-        got = run_case(mod, c)
+        got = run_case(mod, c, binding_name)
         if c.get("class"):
             want, have = c["results"], got["results"]
             ok = len(want) == len(have) and all(same(w, h, sort) for w, h in zip(want, have))
@@ -487,7 +514,7 @@ def diff(cases_path, out_path, package_dir, name, key_order):
             summary["passed"] += 1
         else:
             summary["failed"] += 1
-            summary["mismatches"].append({"fn": name_, "args": c.get("args", [c.get("ctor"), c.get("calls")]), "expected": expected, "actual": actual})
+            summary["mismatches"].append({"fn": name_, "args": shown_args(c), "expected": expected, "actual": actual})
     json.dump(summary, open(out_path, "w", encoding="utf-8"), ensure_ascii=False)
 
 
@@ -505,15 +532,15 @@ def bench(cases_path, out_path, package_dir, name, modules_path, min_ms):
             continue
         old = load(sources[key])
 
-        def timed(mod):
+        def timed(mod, rename=None):
             if cases[0].get("class"):
                 def once():
                     for c in cases:
-                        run_case(mod, c)
+                        run_case(mod, c, rename)
             else:
                 # Arguments are decoded once: only the calls are timed.
                 fn = getattr(mod, key)
-                prepared = [(call_args(c["args"]), {k: dec(v) for k, v in c.get("kwargs", {}).items()}) for c in cases]
+                prepared = [(call_args(c["args"]), call_kwargs(c, rename)) for c in cases]
 
                 def once():
                     for args, kwargs in prepared:
@@ -531,7 +558,7 @@ def bench(cases_path, out_path, package_dir, name, modules_path, min_ms):
                 elapsed = time.perf_counter() - start
                 if elapsed * 1000 >= min_ms:
                     return elapsed * 1e9 / (passes * len(cases))
-        original_ns, rust_ns = timed(old), timed(new)
+        original_ns, rust_ns = timed(old), timed(new, binding_name)
         label = f"class {key}" if cases[0].get("class") else key
         rows.append({"fn": label, "cases": len(cases), "original_ns": original_ns, "rust_ns": rust_ns, "speedup": original_ns / rust_ns})
     json.dump(rows, open(out_path, "w", encoding="utf-8"))
```

**File**: `src/main.rs` (modified, +2/-1)
```diff
@@ -118,7 +118,8 @@ enum Cmd {
         /// Generated cases per function.
         #[arg(long, default_value_t = 200)]
         count: usize,
-        /// Extra cases: JSONL of `{"fn": name, "args": [...]}`.
+        /// Extra cases: JSONL of `{"fn": name, "args": [...]}`, plus `"kwargs": {...}` for Python
+        /// and Ruby arguments passed by keyword.
         #[arg(long)]
         inputs: Option<PathBuf>,
         /// Import the original from this JS module (e.g. built output) instead of the TS source.
```

**File**: `tests/recording.rs` (modified, +119/-0)
```diff
@@ -132,6 +132,125 @@ fn records_the_calls_a_python_test_suite_makes() {
     assert!(inputs.contains(r#"{"$num": "NaN"}"#), "{inputs}");
 }
 
+#[test]
+fn records_python_test_calls_that_pass_arguments_by_keyword() {
+    if !common::have("python3") {
+        return;
+    }
+    let root = project(
+        "py-kw",
+        &[
+            (
+                "pyproject.toml",
+                "[project]\nname = \"shape\"\nversion = \"0.1.0\"\n",
+            ),
+            (
+                "shape.py",
+                "def scale(n: float, *, by: float = 2.0) -> float:\n    return n * by\n\n\n\
+                 def pad(s: str, width: int = 4, fill: str = ' ') -> str:\n    return s.ljust(width, fill)\n",
+            ),
+            (
+                "test_shape.py",
+                "import unittest\nfrom shape import pad, scale\n\n\
+                 class T(unittest.TestCase):\n    def test_it(self):\n        \
+                 self.assertEqual(scale(3), 6)\n        self.assertEqual(scale(3, by=10), 30)\n        \
+                 self.assertEqual(pad('a', fill='*'), 'a***')\n",
+            ),
+        ],
+    );
+    let (printed, inputs) = from_tests(&root, "shape.py", &["python3", "-m", "unittest"]);
+    let cases = std::fs::read_to_string(root.join("port").join("cases.jsonl")).unwrap();
+    std::fs::remove_dir_all(&root).unwrap();
+    // The original ran with the keyword arguments when the cases were recorded.
+    assert!(
+        cases.contains(r#""args": [3], "kwargs": {"by": 10}, "ok": 30"#),
+        "{cases}"
+    );
+    assert!(
+        cases.contains(r#""args": ["a"], "kwargs": {"fill": "*"}, "ok": "a***""#),
+        "{cases}"
+    );
+    // A keyword-only argument, and one passed by name after a skipped default.
+    assert!(printed.contains("Captured 3 call(s)"), "{printed}");
+    assert!(
+        inputs.contains(r#"{"fn": "scale", "args": [3], "kwargs": {"by": 10}}"#),
+        "{inputs}"
+    );
+    assert!(
+        inputs.contains(r#"{"fn": "pad", "args": ["a"], "kwargs": {"fill": "*"}}"#),
+        "{inputs}"
+    );
+}
+
+#[test]
+fn diff_replays_python_keyword_arguments_by_their_binding_names() {
+    if !common::have("python3") {
+        return;
+    }
+    let root = project(
+        "py-kw-diff",
+        &[
+            (
+                "pyproject.toml",
+                "[project]\nname = \"shape\"\nversion = \"0.1.0\"\n",
+            ),
+            (
+                "shape.py",
+                "def scale(n: float, *, scaleBy: float = 2.0) -> float:\n    return n * scaleBy\n\n\n\
+                 def pad(s: str, width: int = 4, fill: str = ' ') -> str:\n    return s.ljust(width, fill)\n",
+            ),
+            (
+                "test_shape.py",
+                "import unittest\nfrom shape import pad, scale\n\n\
+                 class T(unittest.TestCase):\n    def test_it(self):\n        \
+                 self.assertEqual(scale(3, scaleBy=10), 30)\n        \
+                 self.assertEqual(pad('a'), 'a   ')\n        self.assertEqual(pad('a', fill='*'), 'a***')\n",
+            ),
+        ],
+    );
+    let (printed, _) = from_tests(&root, "shape.py", &["python3", "-m", "unittest"]);
+    assert!(printed.contains("Captured 3 call(s)"), "{printed}");
+    let crate_dir = root.join("port");
+    let lib = std::fs::read_to_string(crate_dir.join("src/lib.rs")).unwrap();
+    // The bindings name the parameter in snake_case.
+    assert!(lib.contains("signature = (n, *, scale_by="), "{lib}");
+    // A pure-Python stand-in for the built package, with the bindings' parameter names: `scale`
+    // is right, and `pad` ignores a `fill` of `*`.
+    let manifest = Manifest::load(&crate_dir).unwrap();
+    let package = crate_dir.join("python").join(manifest.lib_name());
+    std::fs::create_dir_all(&package).unwrap();
+    std::fs::write(
+        package.join("__init__.py"),
+        "def scale(n, *, scale_by=2.0):\n    return n * scale_by\n\n\n\
+         def pad(s, width=4, fill=' '):\n    return s.ljust(width, ' ' if fill == '*' else fill)\n",
+    )
+    .unwrap();
+    let outcome = rust_anything::harness::diff(&rust_anything::harness::DiffOptions {
+        crate_dir: &crate_dir,
+        module: None,
+        ignore_key_order: false,
+        float_tolerance: None,
+        node_args: &[],
+    })
+    .unwrap();
+    // A known difference for `pad('a')` does not explain `pad('a', fill='*')`.
+    let known = [serde_json::json!({
+        "fn": "pad", "args": ["a"], "actual": {"ok": "a   "}, "reason": "x"
+    })];
+    let (failed, mismatches) = (outcome.failed, outcome.mismatches.clone());
+    let accepted = recording::apply_known(outcome, &known);
+    std::fs::remove_dir_all(&root).unwrap();
+    // `scaleBy=10` reached the bindings as `scale_by=10`.
+    assert_eq!(failed, 1, "{mismatches:?}");
+    // The mismatch shows the keyword argument, as Ruby's do.
+    assert_eq!(mismatches[0]["fn"], "pad");
+    assert_eq!(
+        mis
```

#### Recent Merged Pull Requests:
- **PR #206** (2026-11-22): fix(profile): judge hot functions with the rules `bridge` applies, so `go` skips what it keeps in JS (@OnurrUgur)
- **PR #205** (2026-11-22): fix(enable): switch a wasm port on through its wrapper (@XiaoBinGan)
- **PR #203** (2026-11-22): fix(python): record a float subclass as its float value (@fullfud)
- **PR #201** (2026-11-22): docs(status): say which command covers which language (@XiaoBinGan)
- **PR #199** (2026-11-22): fix(analyze): judge bridgeable exports with the rules `bridge` applies (@OnurrUgur)
- **PR #198** (2026-11-22): fix(js): capture `--from-tests` arguments with the codec `record` uses (@OnurrUgur)

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

## X. js): capture `--from-tests` arguments with the codec `record` uses

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in erkamyaman/rust-anything. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8a675e19`: js): capture `--from-tests` arguments with the codec `record` uses. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- JS/TS `record --from-tests` encodes the captured arguments with the codec `record` and `diff`
  use, instead of a copy of it that had fallen behind. A `Buffer` was captured as a `Uint8Array`
  (so `b.toString('hex')` recorded `"104,105"`), a `Float64Array` or other typed array as an
  object with numeric keys, and an object shaped like a marker (`{ $date: 'x' }`) was replayed as
  a `Date`. A call is now left out, as one that passes a function or a cycle already was, when an
  argument is a RegExp, an Error, a `URL`, an `ArrayBuffer`, a boxed primitive or an object with
  `toJSON`: those were captured as `{}`, their own fields or their `toJSON` result, which replay
  passed as a different value. A class instance is still captured as its own fields.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8a675e19` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
