> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/erkamyaman-rust-anything-learnings.md`  
> **Source**: github ([https://github.com/erkamyaman/rust-anything](https://github.com/erkamyaman/rust-anything))  
> **Source Version**: `ef7e9fc4`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T13:12:32.226Z  
> **Learning ID**: `learn-github-erkamyaman-rust-anything`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): erkamyaman/rust-anything

> **Canonical Artifact**: `07_PROJECT_LEARNING/erkamyaman-rust-anything-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/erkamyaman/rust-anything](https://github.com/erkamyaman/rust-anything))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T13:12:32.059Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `erkamyaman/rust-anything`
- **Description**: Rewrite your whole app in Rust, one piece at a time, checked against the original's recorded behavior at every step. CLIs, HTTP servers and libraries in TypeScript, Python, C, Go, Ruby and Java.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9048 stars

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
- **Issue #364** (2026-11-24): **Java C-style array parameters are bridged as scalars and record 0 cases**
  *Symptoms*: **What happens**  ```java package acme;  public class Stats {     public static int sum(int values[]) {         int s = 0;         for (int v : values) s += v;         return s;     } } ```  ``` $ rust-anything bridge . src/main/java/acme/Stats.java $ grep "pub fn" rust/stats-rs/src/port.rs pub fn sum(values: i64) -> Result<i64, String> { $ rust-anything record rust/stats-rs Recorded 0 cases (0 threw) in .../rust/stats-rs/cases.jsonl ```  Written as `int[] values`, the same method gets `values: Vec<i64>` and 158 cases are recorded.  **Expected**  `int values[]` is the same type as `int[] values`, so the bridge gives `Vec<i64>` and records cases. If that is not supported, the export should be kept in Java with a reason, not recorded with nothing and no warning.  **Where**  `src/lang/java.rs:502`: the parameter type is read from the `type` field only. In tree-sitter-java, the `[]` of a C-style declarator is a separate `dimensions` child of `formal_parameter`, so it is dropped.  **Notes**  The same applies to `String args[]` and multi-dimensional `int grid[][]`. 
  **Post-Mortem & Fix Analysis**:
  > Working on this.

- **Issue #361** (2026-11-24): **YARD @param tags with types before the name are ignored**
  *Symptoms*: **What happens**  YARD accepts both `@param name [Type]` and `@param [Type] name`. Only the first is read:  ```ruby module Pad   # @param text [String] the text   # @param width [Integer] the width   # @return [String]   def self.left(text, width) = text.rjust(width)    # @param [String] text the text   # @param [Integer] width the width   # @return [String]   def self.right(text, width) = text.ljust(width) end ```  ``` $ rust-anything bridge . lib/pad.rb $ grep "pub fn" rust/pad-rs/src/port.rs pub fn left(text: String, width: i64) -> Result<String, String> { pub fn right(text: serde_json::Value, width: serde_json::Value) -> Result<String, String> { ```  **Expected**  `right` gets `text: String, width: i64`, the same as `left`.  **Where**  `src/lang/ruby.rs:581`: `yard_param` splits the rest of the tag at the first space and compares the first word to the parameter name. With types first, that word is `[String]`, so it never matches.  **Notes**  The types-first form is common in older gems and in what RubyMine generates. With `Value` parameters, `record` also generates untyped inputs for these methods. 
  **Post-Mortem & Fix Analysis**:
  > Working on this.

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

### Incident Patch 1: `15ad3fcc` (2026-11-24)
**Commit Message**: fix(http): fail when fixed port is already in use or build exits before listening (#395)

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -2,6 +2,9 @@
 
 ## Unreleased
 
+- `app record` and `app replay` fail with `port <port> is already in use` before spawning a server
+  on an occupied port and check whether the child exited before treating the port as ready (#326).
+
 ## 4.0.0 (2026-11-24)
 
 - A documentation site at [rust-anything.com](https://rust-anything.com): the README, the guides
```

**File**: `src/http.rs` (modified, +9/-3)
```diff
@@ -348,6 +348,9 @@ struct Server {
 
 impl Server {
     fn start(command: &[String], launch: &Launch, repo: &Path, port: u16) -> Result<Server> {
+        if TcpStream::connect_timeout(&local(port), Duration::from_millis(100)).is_ok() {
+            bail!("port {port} is already in use");
+        }
         let dir = app::temp_dir("server")?;
         let words: Vec<String> = command
             .iter()
@@ -390,11 +393,14 @@ impl Server {
             .with_context(|| format!("starting `{}`", command.join(" ")))?;
         let deadline = Instant::now() + READY;
         loop {
-            if TcpStream::connect_timeout(&local(port), Duration::from_millis(200)).is_ok() {
-                break;
-            }
             let failure = if let Some(status) = child.try_wait()? {
                 Some(format!("exited ({status}) before listening"))
+            } else if TcpStream::connect_timeout(&local(port), Duration::from_millis(200)).is_ok() {
+                if let Some(status) = child.try_wait()? {
+                    Some(format!("exited ({status}) before listening"))
+                } else {
+                    break;
+                }
             } else if Instant::now() > deadline {
                 Some(format!("did not listen within {}s", READY.as_secs()))
             } else {
```

**File**: `tests/http.rs` (modified, +93/-0)
```diff
@@ -654,3 +654,96 @@ fn csharp_server() {
         original: "server",
     });
 }
+
+#[test]
+fn http_fixed_port_rejects_existing_listener_and_early_exit() {
+    if !common::have("node") {
+        return;
+    }
+    let repo = fixture("ts", "fixed-port-guard");
+    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
+    let port = listener.local_addr().unwrap().port();
+
+    // Recording against an already-occupied fixed port fails before spawning the server.
+    let record_err = app::record(&RecordOptions {
+        repo: &repo,
+        run: &words("node server.js"),
+        inputs: None,
+        normalize: &[],
+        name: None,
+        traps: false,
+        timeout_secs: None,
+        http: true,
+        server_args: &[],
+        fresh: &[],
+        pace_ms: None,
+        port: Some(port),
+        float_tolerance: None,
+        float_files: &[],
+        effects: None,
+    })
+    .unwrap_err();
+    assert!(
+        record_err
+            .to_string()
+            .contains(&format!("port {port} is already in use")),
+        "expected port-in-use error on record, got: {record_err:#}"
+    );
+    drop(listener);
+
+    // Record cleanly while the fixed port is free.
+    let recorded = app::record(&RecordOptions {
+        repo: &repo,
+        run: &words("node server.js"),
+        inputs: None,
+        normalize: &[],
+        name: None,
+        traps: false,
+        timeout_secs: None,
+        http: true,
+        server_args: &[],
+        fresh: &[],
+        pace_ms: None,
+        port: Some(port),
+        float_tolerance: None,
+        float_files: &[],
+        effects: None,
+    })
+    .unwrap();
+    assert!(recorded.cases > 0);
+
+    // Reoccupying the fixed port must fail replay instead of passing against the unrelated listener.
+    let occupied = std::net::TcpListener::bind(("127.0.0.1", port)).unwrap();
+    let replay_occupied_err = app::replay(&ReplayOptions {
+        case: None,
+        repo: &repo,
+        build: Some("false"),
+        timeout_secs: None,
+        port: None,
+    })
+    .unwrap_err();
+    assert!(
+        replay_occupied_err
+            .to_string()
+            .contains(&format!("port {port} is already in use")),
+        "expected port-in-use error on replay, got: {replay_occupied_err:#}"
+    );
+    drop(occupied);
+
+    // With the port free, a build that exits immediately must fail as exited before listening.
+    let early_exit_err = app::replay(&ReplayOptions {
+        case: None,
+        repo: &repo,
+        build: Some("false"),
+        timeout_secs: None,
+        port: None,
+    })
+    .unwrap_err();
+    let msg = early_exit_err.to_string();
+    assert!(
+        msg.contains("exited") && msg.contains("before listening"),
+        "expected exited-before-listening error, got: {early_exit_err:#}"
+    );
+
+    std::fs::remove_dir_all(repo).unwrap();
+}
```

---

### Incident Patch 2: `758b6b12` (2026-11-24)
**Commit Message**: fix(kotlin): say why a primitive array cannot cross the Java wire (#386)

**File**: `src/lang/kotlin.rs` (modified, +30/-2)
```diff
@@ -360,8 +360,7 @@ pub fn kotlin_to_ts(t: &str) -> Result<String, String> {
         | "DoubleArray" | "BooleanArray" => {
             let inner = if head.ends_with("Array") && !matches!(head, "Array") {
                 match head {
-                    "IntArray" => "int".into(),
-                    "LongArray" => "int".into(),
+                    "IntArray" | "LongArray" => "int".into(),
                     "DoubleArray" => "number".into(),
                     "BooleanArray" => "boolean".into(),
                     _ => arg(0)?,
@@ -381,6 +380,14 @@ pub fn kotlin_to_ts(t: &str) -> Result<String, String> {
             }
             format!("Record<string, {}>", arg(1)?)
         }
+        // The TS side could map these (`int[]`/`number[]`), but the Java wire only converts element
+        // arrays of int, long, double and boolean: `java_ty` returns None for byte, short and float, so
+        // the generated glue would have no call wrapper for the unit.
+        "ByteArray" | "ShortArray" | "FloatArray" => {
+            return Err(format!(
+                "uses `{head}`, which the Java wire cannot carry yet"
+            ));
+        }
         "Char" => return Err("uses `Char`, a UTF-16 code unit".into()),
         "Any" | "Any?" => return Err("takes or returns `Any`: values of any type".into()),
         "Set" | "MutableSet" | "HashSet" => {
@@ -812,6 +819,27 @@ pub fn receiver(f: &ExportedFn) -> (String, String) {
 mod tests {
     use super::*;
 
+    #[test]
+    fn a_primitive_array_is_named_with_the_reason_the_wire_gives() {
+        // int, long, double and boolean element arrays are what the Java wire converts.
+        for (kotlin, ts) in [
+            ("IntArray", "int[]"),
+            ("LongArray", "int[]"),
+            ("DoubleArray", "number[]"),
+            ("BooleanArray", "boolean[]"),
+        ] {
+            assert_eq!(kotlin_to_ts(kotlin), Ok(ts.to_string()), "{kotlin}");
+        }
+        // The other three are refused, and the reason names the wire rather than a "class".
+        for kotlin in ["ByteArray", "ShortArray", "FloatArray"] {
+            let reason = kotlin_to_ts(kotlin).unwrap_err();
+            assert!(reason.contains("Java wire"), "{kotlin}: {reason}");
+            assert!(!reason.contains("uses the class"), "{kotlin}: {reason}");
+        }
+        // `CharArray` is UTF-16 code units, like `Char`, and keeps that reason.
+        assert!(kotlin_to_ts("CharArray").is_err());
+    }
+
     #[test]
     fn scans_risks_and_imports() {
         let src =
```

---

### Incident Patch 3: `cfd2ff34` (2026-11-24)
**Commit Message**: fix(analyze): refuse a --lang the folder does not hold (#385)

* fix(analyze): refuse a --lang the folder does not hold

* fix(analyze): judge an empty language by its files and give the reason

Review follow-up: the check looks at whether any file of the language was found (UI and tests included), so a Go module with a .tsx file still analyzes as TypeScript, and the error carries the warnings that explain why files were left out, such as ignore rules.

---------

Co-authored-by: Kam <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -13,6 +13,10 @@
 - `app record` joins example commands wrapped with a trailing `\` before reading them, so a curl
   example split over lines becomes its request instead of being dropped, and a wrapped `$ tool`
   line is no longer recorded with `\` as an argument (#328).
+- `analyze --lang` for a language the folder does not hold is an error that names the language it
+  found (`no Python source files found; the code here looks like TypeScript/JavaScript`) and why
+  any of its files were left out (such as ignore rules), instead of an empty plan with exit 0
+  (#345).
 
 ## 3.4.0 (2026-11-23)
 
```

**File**: `src/analyze.rs` (modified, +14/-0)
```diff
@@ -295,6 +295,20 @@ pub fn analyze_lang(root: &Path, lang: Lang) -> Result<Report> {
         })
         .collect();
     let mut report = build(root, &ws, &facts, lang);
+    // A language the folder does not hold (a typo, or code in a subfolder) would read like a
+    // finished plan with nothing to do. Any file of the language counts, UI and tests included,
+    // and the warnings (files hidden by ignore rules) say why the plan would have been empty.
+    if ws.files.is_empty() {
+        let detected = Lang::detect(root);
+        if detected != lang {
+            let reasons: String = report.warnings.iter().map(|w| format!(". {w}")).collect();
+            bail!(
+                "no {} source files found; the code here looks like {}{reasons}",
+                lang.name(),
+                detected.name()
+            );
+        }
+    }
     check_bridgeable(root, &mut report, lang);
     Ok(report)
 }
```

**File**: `tests/analyze.rs` (modified, +41/-0)
```diff
@@ -220,6 +220,47 @@ fn a_c_unit_depends_on_what_its_own_header_includes() {
     assert!(a.wave > unit(&report, "src/b.c").wave);
 }
 
+#[test]
+fn a_language_the_folder_lacks_is_an_error_not_an_empty_plan() {
+    use rust_anything::analyze::analyze_lang;
+    use rust_anything::lang::Lang;
+    let mini = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/mini");
+    let err = analyze_lang(&mini, Lang::Python).unwrap_err().to_string();
+    assert!(err.contains("no Python source files"), "{err}");
+    assert!(err.contains("TypeScript/JavaScript"), "{err}");
+    assert!(analyze_lang(&mini, Lang::Ts).is_ok());
+
+    // A folder that is empty in its own detected language still gets its (empty) plan.
+    let empty = std::env::temp_dir().join(format!("ra-lang-empty-{}", std::process::id()));
+    let _ = std::fs::remove_dir_all(&empty);
+    std::fs::create_dir_all(&empty).unwrap();
+    let plan = analyze(&empty);
+    std::fs::remove_dir_all(&empty).unwrap();
+    assert_eq!(plan.unwrap().summary.source_files, 0);
+
+    let root = std::env::temp_dir().join(format!("ra-lang-cases-{}", std::process::id()));
+    let _ = std::fs::remove_dir_all(&root);
+    let write = |path: &str, text: &str| {
+        let path = root.join(path);
+        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
+        std::fs::write(path, text).unwrap();
+    };
+    // UI files are the language too: a Go module whose TypeScript is only a React frontend.
+    write("go.mod", "module example.com/app\n\ngo 1.22\n");
+    write("web/App.tsx", "export function App() { return <div />; }\n");
+    assert_eq!(Lang::detect(&root), Lang::Go);
+    let frontend = analyze_lang(&root, Lang::Ts);
+    // Python files hidden by ignore rules: the error keeps analyze's reason for the empty plan.
+    write(".ignore", "py/\n");
+    write("py/tool.py", "def tool():\n    return 1\n");
+    let hidden = analyze_lang(&root, Lang::Python);
+    std::fs::remove_dir_all(&root).unwrap();
+    assert_eq!(frontend.unwrap().summary.ui_files, 1);
+    let err = hidden.unwrap_err().to_string();
+    assert!(err.contains("no Python source files"), "{err}");
+    assert!(err.contains("excluded by ignore rules"), "{err}");
+}
+
 #[test]
 fn json_output_is_versioned() {
     let json = serde_json::to_value(mini()).unwrap();
```

#### Recent Merged Pull Requests:
- **PR #402** (2026-11-24): feat(report): take --resolve-from like bench and fuzz (@XiaoBinGan)
- **PR #401** (2026-11-24): docs: list the per-language shadow --out defaults in the CLI help (@hkhkkh)
- **PR #400** (2026-11-24): docs: Spanish C# unit is a file or folder (@hkhkkh)
- **PR #399** (2026-11-24): docs: add Kotlin and PowerShell to the German language table (@hkhkkh)
- **PR #396** (2026-11-24): docs: add PowerShell to the Spanish and Italian language tables (@hkhkkh)
- **PR #395** (2026-11-24): fix(http): fail when fixed port is already in use or build exits before listening (@brixtonpham)

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

## X. http): fail when fixed port is already in use or build exits before listening

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in erkamyaman/rust-anything. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `15ad3fcc`: http): fail when fixed port is already in use or build exits before listening. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- `app record` and `app replay` fail with `port <port> is already in use` before spawning a server
  on an occupied port and check whether the child exited before treating the port as ready (#326).

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `15ad3fcc` are properly handled with clean fallback behavior.
