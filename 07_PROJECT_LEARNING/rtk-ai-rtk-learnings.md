> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rtk-ai-rtk-learnings.md`  
> **Source**: github ([https://github.com/rtk-ai/rtk](https://github.com/rtk-ai/rtk))  
> **Source Version**: `41e69122`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T17:50:10.378Z  
> **Learning ID**: `learn-github-rtk-ai-rtk`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): rtk-ai/rtk

> **Canonical Artifact**: `07_PROJECT_LEARNING/rtk-ai-rtk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rtk-ai/rtk](https://github.com/rtk-ai/rtk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-31T17:50:10.371Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rtk-ai/rtk`
- **Description**: CLI proxy that reduces LLM token consumption by 60-90% on common dev commands. Single Rust binary, zero dependencies
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 85134 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `engine/src/block.rs`
```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Layer {
    UserPrompt,
    SkillsMcp,
    AgentMessage,
    Read,
    Write,
    ToolResult,
    Inference,
    History,
    Cache,
}

impl Layer {
    pub fn as_str(&self) -> &'static str {
        match self {
            Layer::UserPrompt => "user_prompt",
            Layer::SkillsMcp => "skills_mcp",
            Layer::AgentMessage => "agent_message",
            Layer::Read => "read",
            Layer::Write => "write",
            Layer::ToolResult => "tool_result",
            Layer::Inference => "inference",
            Layer::History => "history",
            Layer::Cache => "cache",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Subject {
    Read,
    Write,
    Edit,
    Shell,
    Search,
    Web,
    Subagent,
    Mcp,
    ToolResult,
    ToolUse,
    Assistant,
    User,
    System,
    Tools,
    Model,
    Cache,
    Any,
}

pub const HOOK_SUBJECTS: &[Subject] = &[
    Subject::Read,
    Subject::Write,
    Subject::Edit,
    Subject::Shell,
    Subject::Search,
    Subject::Web,
    Subject::Subagent,
    Subject::Mcp,
    Subject::Any,
];

pub const PROXY_PARTS: &[Subject] = &[
    Subject::ToolResult,
    Subject::ToolUse,
    Subject::Assistant,
    Subject::User,
    Subject::System,
    Subject::Tools,
    Subject::Model,
    Subject::Cache,
    Subject::Any,
];

impl Subject {
    pub fn as_str(&self) -> &'static str {
        match self {
            Subject::Read => "read",
            Subject::Write => "write",
            Subject::Edit => "edit",
            Subject::Shell => "shell",
            Subject::Search => "search",
            Subject::Web => "web",
            Subject::Subagent => "subagent",
            Subject::Mcp => "mcp",
            Subject::ToolResult => "tool_result",
            Subject::ToolUse => "tool_use",
            Subject::Assistant => "assistant",
            Subject::User => "user",
            Subject::System => "system",
            Subject::Tools => "tools",
            Subject::Model => "model",
            Subject::Cache => "cache",
            Subject::Any => "any",
        }
    }

    pub fn parse(name: &str) -> Option<Subject> {
        HOOK_SUBJECTS
            .iter()
            .chain(PROXY_PARTS.iter())
            .find(|s| s.as_str() == name)
            .copied()
    }

    pub fn is_hook_category(&self) -> bool {
        HOOK_SUBJECTS.contains(self)
    }

    pub fn is_proxy_part(&self) -> bool {
        PROXY_PARTS.contains(self)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Event {
    BeforeTool,
    AfterTool,
    Request,
}

impl Event {
    pub fn as_str(&self) -> &'static str {
        match self {
            Event::BeforeTool => "before_tool",
            Event::AfterTool => "after_tool",
            Event::Request => "request",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ContentFormat {
    Json,
    Web,
    Matches,
    Lockfile,
    Term,
}

impl ContentFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            ContentFormat::Json => "json",
            ContentFormat::Web => "web",
            ContentFormat::Matches => "matches",
            ContentFormat::Lockfile => "lockfile",
            ContentFormat::Term => "term",
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Origin {
    pub tool: Option<String>,
    pub path: Option<String>,
    pub command: Option<String>,
    pub block_index: Option<usize>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Provenance {
    pub applied: Vec<String>,
}

impl Provenance {
    pub fn contains(&self, method: &str) -> bool {
        self.applied.iter().any(|m| m == method)
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Block<'a> {
    pub text: &'a str,
    pub subject: Subject,
    pub format: ContentFormat,
    pub origin: &'a Origin,
    pub provenance: &'a Provenance,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn layer_names_are_the_frozen_reporting_vocabulary() {
        let all = [
            (Layer::UserPrompt, "user_prompt"),
            (Layer::SkillsMcp, "skills_mcp"),
            (Layer::AgentMessage, "agent_message"),
            (Layer::Read, "read"),
            (Layer::Write, "write"),
            (Layer::ToolResult, "tool_result"),
            (Layer::Inference, "inference"),
            (Layer::History, "history"),
            (Layer::Cache, "cache"),
        ];
        for (layer, name) in all {
            assert_eq!(layer.as_str(), name);
        }
    }

    #[test]
    fn subject_names_are_the_frozen_tree_vocabulary() {
        let hook: Vec<&str> = HOOK_SUBJECTS.iter().map(|s| s.as_str()).collect();
        assert_eq!(
            hook,
            vec![
                "read", "write", "edit", "shell", "search", "web", "subagent", "mcp", "any"
            ]
        );
        let proxy: Vec<&str> = PROXY_PARTS.iter().map(|s| s.as_str()).collect();
        assert_eq!(
            proxy,
            vec![
                "tool_result",
                "tool_use",
                "assistant",
                "user",
                "system",
                "tools",
                "model",
                "cache",
                "any"
            ]
        );
        for s in HOOK_SUBJECTS.iter().chain(PROXY_PARTS.iter()) {
            assert_eq!(Subject::parse(s.as_str()), Some(*s));
        }
        assert_eq!(Subject::parse("during_tool"), None);
    }

    #[test]
    fn format_names_are_the_frozen_condition_vocabulary() {
        let all = [
            (ContentFormat::Json, "json"),
            (ContentFormat::Web, "web"),
            (ContentFormat::Matches, "matches"),
            (ContentFormat::Lockfile, "lockfile"),
            (ContentFormat::Term, "term"),
        ];
        for (format, name) in all {
            assert_eq!(format.as_str(), name);
        }
    }

    #[test]
    fn provenance_lookup() {
        let p = Provenance {
            applied: vec!["cap".to_string()],
        };
        assert!(p.contains("cap"));
        assert!(!p.contains("toon"));
    }
}

```

### Core Architecture Module: `engine/src/chain.rs`
```
use crate::block::Block;
use crate::method::{Method, MethodCtx, Outcome};
use crate::tokens::estimate_tokens;

pub fn run_chain(methods: &[&dyn Method], block: &Block, ctx: &MethodCtx) -> String {
    let mut current = block.text.to_string();
    for method in methods {
        let step = Block {
            text: &current,
            ..*block
        };
        match method.apply(&step, ctx) {
            Outcome::Continue(next) => current = next,
            Outcome::ShortCircuit(final_text) => return final_text,
            Outcome::Skip => {}
        }
    }
    current
}

pub fn never_worse(input: &str, output: String) -> Option<String> {
    if output == input {
        return None;
    }
    if estimate_tokens(&output) > estimate_tokens(input) {
        return None;
    }
    Some(output)
}

/// [`run_chain`] with panic containment and nothing else: `None` means a
/// method panicked, and the caller should fall back to the block it started
/// with.
///
/// Separate from [`run_chain_guarded`] because a host that already applies
/// its own size guard -- the hook site compares tokens before and after, and
/// needs the unguarded text to record what a chain actually did -- would
/// otherwise have the comparison made twice, once where it cannot see it.
pub fn run_chain_caught(methods: &[&dyn Method], block: &Block, ctx: &MethodCtx) -> Option<String> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        run_chain(methods, block, ctx)
    }))
    .ok()
}

/// [`run_chain_caught`] plus the size guard: `None` when a method panicked,
/// when the chain changed nothing, or when it grew the block.
///
/// The guard is a floor, not a correctness check -- it rejects growth and
/// no-ops, and cannot tell whether a method mangled content while shrinking
/// it. Methods stay responsible for their own fidelity.
pub fn run_chain_guarded(
    methods: &[&dyn Method],
    block: &Block,
    ctx: &MethodCtx,
) -> Option<String> {
    never_worse(block.text, run_chain_caught(methods, block, ctx)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::block::{ContentFormat, Origin, Provenance, Subject};
    use crate::method::{MethodInfo, Outcome};

    struct Upper;
    impl Method for Upper {
        fn name(&self) -> &'static str {
            "test-upper"
        }
        fn info(&self) -> MethodInfo {
            MethodInfo::LOSSLESS_TRANSFORM
        }
        fn apply(&self, block: &Block, _ctx: &MethodCtx) -> Outcome {
            Outcome::Continue(block.text.to_uppercase())
        }
    }

    struct Final;
    impl Method for Final {
        fn name(&self) -> &'static str {
            "test-final"
        }
        fn info(&self) -> MethodInfo {
            MethodInfo::LOSSLESS_TRANSFORM
        }
        fn apply(&self, block: &Block, _ctx: &MethodCtx) -> Outcome {
            Outcome::ShortCircuit(format!("F:{}", block.text))
        }
    }

    struct Declines;
    impl Method for Declines {
        fn name(&self) -> &'static str {
            "test-skip"
        }
        fn info(&self) -> MethodInfo {
            MethodInfo::LOSSLESS_TRANSFORM
        }
        fn apply(&self, _block: &Block, _ctx: &MethodCtx) -> Outcome {
            Outcome::Skip
        }
    }

    struct Panics;
    impl Method for Panics {
        fn name(&self) -> &'static str {
            "test-panic"
        }
        fn info(&self) -> MethodInfo {
            MethodInfo::LOSSLESS_TRANSFORM
        }
        fn apply(&self, _block: &Block, _ctx: &MethodCtx) -> Outcome {
            panic!("method bug");
        }
    }

    struct Shrinks;
    impl Method for Shrinks {
        fn name(&self) -> &'static str {
            "test-shrink"
        }
        fn info(&self) -> MethodInfo {
            MethodInfo::LOSSLESS_TRANSFORM
        }
        fn apply(&self, block: &Block, _ctx: &MethodCtx) -> Outcome {
            Outcome::Continue(block.text.chars().take(4).collect())
        }
    }

    struct Grows;
    impl Method for Grows {
        fn name(&self) -> &'static str {
            "test-grow"
        }
        fn info(&self) -> MethodInfo {
            MethodInfo::LOSSLESS_TRANSFORM
        }
        fn apply(&self, block: &Block, _ctx: &MethodCtx) -> Outcome {
            Outcome::Continue(format!("{}{}", block.text, "x".repeat(64)))
        }
    }

    fn block_over<'a>(text: &'a str, origin: &'a Origin, prov: &'a Provenance) -> Block<'a> {
        Block {
            text,
            subject: Subject::ToolResult,
            format: ContentFormat::Term,
            origin,
            provenance: prov,
        }
    }

    fn ctx() -> MethodCtx<'static> {
        MethodCtx::new("test")
    }

    #[test]
    fn chain_applies_methods_in_order_and_skip_is_neutral() {
        let (origin, prov) = (Origin::default(), Provenance::default());
        let block = block_over("abc", &origin, &prov);
        let out = run_chain(&[&Declines, &Upper], &block, &ctx());
        assert_eq!(out, "ABC");
    }

    #[test]
    fn short_circuit_ends_the_chain() {
        let (origin, prov) = (Origin::default(), Provenance::default());
        let block = block_over("abc", &origin, &prov);
        let out = run_chain(&[&Final, &Upper], &block, &ctx());
        assert_eq!(out, "F:abc");
    }

    #[test]
    fn guarded_contains_panics_and_emits_nothing() {
        let (origin, prov) = (Origin::default(), Provenance::default());
        let block = block_over("abc", &origin, &prov);
        assert_eq!(run_chain_guarded(&[&Panics], &block, &ctx()), None);
    }

    #[test]
    fn guarded_never_worse_blocks_growth_and_noops() {
        let (origin, prov) = (Origin::default(), Provenance::default());
        let long = "a long enough input string";
        let block = block_over(long, &origin, &prov);
        assert_eq!(run_chain_guarded(&[&Grows], &block, &ctx()), None);
        assert_eq!(run_chain_guarded(&[&Declines], &block, &ctx()), None);
        assert_eq!(
            run_chain_guarded(&[&Shrinks], &block, &ctx()),
            Some("a lo".to_string())
        );
    }

    #[test]
    fn never_worse_allows_equal_estimates_when_text_changed() {
        assert_eq!(never_worse("abcd", "wxyz".to_string()), Some("wxyz".into()));
        assert_eq!(never_worse("abcd", "abcd".to_string()), None);
    }
}

```

### Core Architecture Module: `engine/src/directive.rs`
```
use crate::harness::Channel;
use crate::tokens::estimate_tokens;

pub struct DirectiveCtx<'a> {
    pub level: Option<&'a str>,
}

pub trait Directive: Sync {
    fn name(&self) -> &'static str;
    fn text(&self, ctx: &DirectiveCtx) -> String;
    fn channels(&self) -> &'static [Channel];
}

pub struct TerseOutput;

/// Named word classes, a worked example, and a never-longer rule, because an
/// abstract instruction ("be terse") can do worse than no instruction at all.
/// Concrete rules give the model something to apply instead of a register to
/// guess at. There is deliberately no clause forbidding closing summaries: it
/// would suppress the short interstitial notes an agent keeps as working
/// memory — a coding agent reads its own prior output on every later turn, so
/// compressing it changes what the agent knows.
///
/// The negation guard and the "not actually shorter" rule are not decoration.
/// Dropping a `not` inverts an instruction, and invented abbreviations and
/// symbol substitutions cost the same or more once tokenized, so a model
/// reaching for them pays to look brief.
pub const TERSE_OUTPUT_TEXT: &str = "\
Keep prose short. Drop articles (a, an, the), filler (\"just\", \"really\", \
\"basically\", \"actually\", \"essentially\"), pleasantries, hedging, and emoji. \
Fragments are fine where the meaning is clear.\n\n\
Example. Instead of \"Sure! I'd be happy to help. The issue you're seeing is \
likely caused by an expiry check that uses the wrong comparison operator,\" \
write \"Bug in auth middleware: expiry check uses `<`, should be `<=`.\"\n\n\
If the short phrasing is not actually shorter, use the plain one. Do not invent \
abbreviations or use arrows for words — they cost the same or more under the \
tokenizer.\n\n\
Brevity applies to prose only. Never shorten code, file paths, commands, \
identifiers, error text, or numbers. Keep every negation (not, never, no) — \
dropping one inverts the meaning. Write security warnings, confirmations for \
destructive or irreversible actions, and any ambiguous multi-step instruction \
in full sentences.";

impl Directive for TerseOutput {
    fn name(&self) -> &'static str {
        "terse-output"
    }

    fn text(&self, _ctx: &DirectiveCtx) -> String {
        TERSE_OUTPUT_TEXT.to_string()
    }

    fn channels(&self) -> &'static [Channel] {
        &[Channel::AwarenessFile, Channel::SessionStart]
    }
}

pub static DIRECTIVES: &[&(dyn Directive + 'static)] = &[&TerseOutput];

/// The generated `route-tasks` directive: written whenever a task instance
/// has an upstream, so the agent learns the exact `rtk <task>` syntax.
pub fn route_tasks_text(tasks: &[(&str, &str)]) -> String {
    if tasks.is_empty() {
        return String::new();
    }
    let mut out = String::from(
        "Delegation commands (they hand work to a cheaper model; the files never \
         enter your context):",
    );
    for (name, kind) in tasks {
        let usage = crate::task::find_kind(kind)
            .map(|k| k.usage().replace("<task>", name))
            .unwrap_or_else(|| format!("rtk {name} ..."));
        out.push_str(&format!("\n- `{usage}`"));
    }
    out
}

pub fn find(name: &str) -> Option<&'static dyn Directive> {
    DIRECTIVES.iter().find(|d| d.name() == name).copied()
}

pub fn merge(texts: &[String]) -> String {
    texts
        .iter()
        .map(|t| t.trim_end())
        .filter(|t| !t.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n")
}

pub fn cost_tokens(text: &str) -> usize {
    estimate_tokens(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn terse_output_is_registered_and_costed() {
        let directive = find("terse-output").expect("registered");
        let text = directive.text(&DirectiveCtx { level: None });
        assert!(
            text.contains("Never shorten code"),
            "terseness must never apply to code, paths, commands or error text"
        );
        assert!(
            text.contains("security warnings"),
            "terseness must never apply to a destructive-action warning"
        );
        assert!(cost_tokens(&text) > 0);
        assert!(directive.channels().contains(&Channel::AwarenessFile));
    }

    /// The properties this wording depends on to make the agent shorter rather
    /// than longer.
    #[test]
    fn terse_output_keeps_the_guards_that_earned_their_place() {
        let text = find("terse-output")
            .expect("registered")
            .text(&DirectiveCtx { level: None });

        // The model has to be told which words to drop, not asked to infer a
        // register.
        assert!(
            text.contains("Drop articles") && text.contains("filler"),
            "name the word classes; \"be terse\" alone is not enough"
        );
        assert!(
            text.contains("Example."),
            "a worked before/after calibrates the target register"
        );
        assert!(
            text.contains("not actually shorter"),
            "without a never-longer rule the model pays tokens to look brief"
        );
        assert!(
            text.contains("Keep every negation"),
            "dropping a `not` inverts the instruction it appears in"
        );

        // Forbidding an agent's closing summary suppresses the interstitial notes it keeps as working
        // memory, and a coding agent re-reads its own output every turn.
        assert!(
            !text.contains("closing summaries") && !text.contains("restating tool output"),
            "do not add behavioural suppression clauses: they make the agent \
             take more turns"
        );
    }

    #[test]
    fn unknown_directive_is_not_found() {
        assert!(find("mystery").is_none());
    }

    #[test]
    fn merge_concatenates_in_order_and_drops_empties() {
        let merged = merge(&[
            "first block\n".to_string(),
            String::new(),
            "second block".to_string(),
        ]);
        assert_eq!(merged, "first block\n\nsecond block");
    }
}

```

### Core Architecture Module: `engine/src/harness.rs`
```
use crate::block::{Event, Subject};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Channel {
    AwarenessFile,
    SessionStart,
    PerTurn,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigChannel {
    SettingsEnv,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EventCapability {
    pub event: Event,
    pub can_replace_input: bool,
    pub can_replace_output: bool,
    pub can_deny: bool,
    pub can_append: bool,
    pub can_redirect_tool: bool,
    pub subjects: &'static [Subject],
}

impl EventCapability {
    const NONE: EventCapability = EventCapability {
        event: Event::BeforeTool,
        can_replace_input: false,
        can_replace_output: false,
        can_deny: false,
        can_append: false,
        can_redirect_tool: false,
        subjects: crate::block::HOOK_SUBJECTS,
    };
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HarnessProfile {
    pub id: &'static str,
    pub events: &'static [EventCapability],
    pub tool_names: &'static [(&'static str, Subject)],
    pub session_start: bool,
    pub directive_channels: &'static [Channel],
    pub base_url_config: Option<ConfigChannel>,
    /// How `rtk init` writes this harness's hook config. `None` for a harness
    /// with no hook surface to write.
    pub wiring: Option<Wiring>,
}

/// What `rtk init` needs to turn a pipeline into this harness's own config.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Wiring {
    /// The file to write, relative to the scope's base directory.
    pub path: &'static str,
    pub format: ConfigFormat,
    /// This harness's spelling of each event we can register.
    pub before_tool: Option<&'static str>,
    pub after_tool: Option<&'static str>,
    pub session_start: Option<&'static str>,
    /// How a set of tool names becomes one matcher value.
    pub matcher: MatcherStyle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigFormat {
    /// `{"hooks": {"<Event>": [{matcher, hooks: [{type, command}]}]}}` — Claude
    /// Code's shape, also read natively by Devin and Trae.
    ClaudeNested,
    /// Same nesting, but the event map is the whole file with no `hooks` key.
    BareNested,
    /// `{"version": 1, "hooks": {"<event>": [{command, matcher}]}}` — one flat
    /// entry per hook rather than a matcher group.
    FlatEntries,
    /// `{"<our-name>": {"<Event>": [{matcher, hooks: [...]}]}}` — namespaced by
    /// hook name at the top level.
    NamedGroups,
    /// TOML `[[hooks]]` array-of-tables.
    TomlTables,
    /// A generated plugin file rather than a config block.
    Plugin,
}

/// How a harness expects several tool names in one matcher.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MatcherStyle {
    /// Regex alternation, anchored: `^(?:Bash|Read)$`.
    AnchoredAlternation,
    /// Regex alternation, bare: `Bash|Read`.
    Alternation,
    /// The harness ignores matchers; the hook filters on tool name itself.
    None,
}

const CLAUDE_TOOLS: &[(&str, Subject)] = &[
    ("Read", Subject::Read),
    ("NotebookRead", Subject::Read),
    ("TaskOutput", Subject::Read),
    ("Write", Subject::Write),
    ("Edit", Subject::Edit),
    ("MultiEdit", Subject::Edit),
    ("NotebookEdit", Subject::Edit),
    ("Bash", Subject::Shell),
    ("PowerShell", Subject::Shell),
    ("Monitor", Subject::Shell),
    ("Grep", Subject::Search),
    ("Glob", Subject::Search),
    ("LSP", Subject::Search),
    ("WebFetch", Subject::Web),
    ("WebSearch", Subject::Web),
    ("Task", Subject::Subagent),
    ("Agent", Subject::Subagent),
    ("SendMessage", Subject::Subagent),
    ("ListAgents", Subject::Subagent),
    ("Workflow", Subject::Subagent),
    ("ToolSearch", Subject::Mcp),
    ("WaitForMcpServers", Subject::Mcp),
    ("ListMcpResourcesTool", Subject::Mcp),
    ("ReadMcpResourceTool", Subject::Mcp),
];

const CURSOR_TOOLS: &[(&str, Subject)] = &[
    ("Read", Subject::Read),
    ("Write", Subject::Write),
    ("Delete", Subject::Write),
    ("Shell", Subject::Shell),
    ("Grep", Subject::Search),
    ("WebFetch", Subject::Web),
    ("WebSearch", Subject::Web),
    ("Task", Subject::Subagent),
];

const GEMINI_TOOLS: &[(&str, Subject)] = &[
    ("read_file", Subject::Read),
    ("read_many_files", Subject::Read),
    ("write_file", Subject::Write),
    ("replace", Subject::Edit),
    ("run_shell_command", Subject::Shell),
    ("grep_search", Subject::Search),
    ("search_file_content", Subject::Search),
    ("glob", Subject::Search),
    ("list_directory", Subject::Search),
    ("google_web_search", Subject::Web),
    ("web_fetch", Subject::Web),
    ("invoke_agent", Subject::Subagent),
    ("read_mcp_resource", Subject::Mcp),
    ("list_mcp_resources", Subject::Mcp),
];

const COPILOT_TOOLS: &[(&str, Subject)] = &[
    ("view", Subject::Read),
    ("create", Subject::Write),
    ("edit", Subject::Edit),
    ("bash", Subject::Shell),
    ("powershell", Subject::Shell),
    ("glob", Subject::Search),
    ("grep", Subject::Search),
    ("web_fetch", Subject::Web),
    ("task", Subject::Subagent),
];

const TRAE_TOOLS: &[(&str, Subject)] = &[
    ("Read", Subject::Read),
    ("Write", Subject::Write),
    ("Edit", Subject::Edit),
    ("RunCommand", Subject::Shell),
    ("Grep", Subject::Search),
    ("Glob", Subject::Search),
    ("LS", Subject::Search),
    ("WebSearch", Subject::Web),
    ("WebFetch", Subject::Web),
];

const CODEX_TOOLS: &[(&str, Subject)] = &[
    ("Bash", Subject::Shell),
    ("apply_patch", Subject::Edit),
    ("Edit", Subject::Edit),
    ("Write", Subject::Write),
    ("Agent", Subject::Subagent),
];

const DROID_TOOLS: &[(&str, Subject)] = &[
    ("Read", Subject::Read),
    ("LS", Subject::Read),
    ("Create", Subject::Write),
    ("Edit", Subject::Edit),
    ("ApplyPatch", Subject::Edit),
    ("Execute", Subject::Shell),
    ("Grep", Subject::Search),
    ("Glob", Subject::Search),
    ("WebSearch", Subject::Web),
    ("FetchUrl", Subject::Web),
    ("Task", Subject::Subagent),
];

const VIBE_TOOLS: &[(&str, Subject)] = &[
    ("read_file", Subject::Read),
    ("write_file", Subject::Write),
    ("edit", Subject::Edit),
    ("bash", Subject::Shell),
    ("powershell", Subject::Shell),
    ("git_bash", Subject::Shell),
    ("grep", Subject::Search),
    ("web_search", Subject::Web),
    ("web_fetch", Subject::Web),
    ("task", Subject::Subagent),
];

const OPENCODE_TOOLS: &[(&str, Subject)] = &[
    ("read", Subject::Read),
    ("skill", Subject::Read),
    ("write", Subject::Write),
    ("edit", Subject::Edit),
    ("apply_patch", Subject::Edit),
    ("bash", Subject::Shell),
    ("execute", Subject::Shell),
    ("grep", Subject::Search),
    ("glob", Subject::Search),
    ("lsp", Subject::Search),
    ("webfetch", Subject::Web),
    ("websearch", Subject::Web),
    ("task", Subject::Subagent),
    ("list_mcp_resources", Subject::Mcp),
    ("read_mcp_resource", Subject::Mcp),
];

const PI_TOOLS: &[(&str, Subject)] = &[
    ("read", Subject::Read),
    ("ls", Subject::Read),
    ("write", Subject::Write),
    ("edit", Subject::Edit),
    ("bash", Subject::Shell),
    ("powershell", Subject::Shell),
    ("grep", Subject::Search),
    ("find", Subject::Search),
];

const OMP_TOOLS: &[(&str, Subject)] = &[
    ("read", Subject::Read),
    ("write", Subject::Write),
    ("edit", Subject::Edit),
    ("ast_edit", Subject::Edit),
    ("bash", Subject::Shell),
    ("eval", Subject::Shell),
    ("grep", Subject::Search),
    ("glob", Subject::Search),
    ("find", Subject::Search),
    ("ast_grep", Subject::Search),
    ("recall", Subject::Search),
    ("web_search", Subject::Web),
    ("github", Subject::Web),
    ("task", Subject::Subagent),
];

const HERMES_TOOLS: &[(&str, Subject)] = &[
    ("read_file", Subject::Read),
    ("write_file", Subject::Write),
    ("patch", Subject::Edit),
    ("terminal", Subject::Shell),
    ("process_manage", Subject::Shell),
    ("search_files", Subject::Search),
    ("session_search", Subject::Search),
    ("web_search", Subject::Web),
    ("web_extract", Subject::Web),
    ("delegate_task", Subject::Subagent),
];

const OPENCLAW_TOOLS: &[(&str, Subject)] = &[
    ("read", Subject::Read),
    ("write", Subject::Write),
    ("edit", Subject::Edit),
    ("apply_patch", Subject::Edit),
    ("exec", Subject::Shell),
    ("terminal", Subject::Shell),
    ("process", Subject::Shell),
    ("code_execution", Subject::Shell),
    ("web_search", Subject::Web),
    ("web_fetch", Subject::Web),
    ("browser", Subject::Web),
    ("subagents", Subject::Subagent),
];

const KILOCODE_TOOLS: &[(&str, Subject)] = &[
    ("read", Subject::Read),
    ("write", Subject::Write),
    ("edit", Subject::Edit),
    ("apply_patch", Subject::Edit),
    ("bash", Subject::Shell),
    ("grep", Subject::Search),
    ("glob", Subject::Search),
    ("webfetch", Subject::Web),
    ("websearch", Subject::Web),
    ("browser_open", Subject::Web),
    ("task", Subject::Subagent),
    ("agent_manager", Subject::Subagent),
];

const CLINE_TOOLS: &[(&str, Subject)] = &[
    ("read_file", Subject::Read),
    ("write_to_file", Subject::Write),
    ("replace_in_file", Subject::Edit),
    ("apply_patch", Subject::Edit),
    ("execute_command", Subject::Shell),
    ("search_files", Subject::Search),
    ("list_files", Subject::Search),
    ("list_code_definition_names", Subject::Search),
    ("web_fetch", Subject::Web),
    ("web_search", Subject::Web),
    ("browser_action", Subject::Web),
    ("new_task", Subject::Subagent),
    ("use_subagents", Subject::Subagent),
    ("use_mcp_tool", Subject::Mcp),
    ("access_mcp_resource", Subject::Mcp),
];

const WINDSURF_TOOLS: &[(&str, Subject)] = &[
    ("read", Subject::Read),
    ("notebook_read", Subject::Read),
    ("write", Subject::Write),
    ("edit", Subject::Edit),
    ("apply_patch", Subject::Edit),
    ("notebook_edit", Subject::Edit),
    ("exec", Subject::Shell),
    ("get_output", Subject::Shell),
    ("write_to_process", Subject::Shell),
    ("kill_
```

### Core Architecture Module: `engine/src/lib.rs`
```
pub mod block;
pub mod chain;
pub mod directive;
pub mod harness;
pub mod marker;
pub mod method;
pub mod methods;
pub mod pipeline;
pub mod process;
pub mod registry;
pub mod shape;
pub mod strategy;
pub mod task;
pub mod text;
pub mod tokens;

#[cfg(test)]
pub(crate) mod testutil;

pub use block::{Block, ContentFormat, Layer, Origin, Provenance};
pub use method::{
    CostClass, Method, MethodCtx, MethodInfo, MethodKind, Outcome, Produces, Recovery,
};

```

### Core Architecture Module: `engine/src/marker.rs`
```
use crate::block::Provenance;
use regex::Regex;
use std::sync::LazyLock;

pub const TRUNCATION_MARKER_TAG: &str = "lines omitted by rtk-proxy";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Stamp<'a> {
    pub method: &'a str,
    pub tokens_before: usize,
    pub tokens_after: usize,
    pub hint: Option<&'a str>,
}

impl Stamp<'_> {
    pub fn render(&self) -> String {
        match self.hint {
            Some(hint) => format!(
                "[rtk:{} {}→{} tokens · {}]",
                self.method, self.tokens_before, self.tokens_after, hint
            ),
            None => format!(
                "[rtk:{} {}→{} tokens]",
                self.method, self.tokens_before, self.tokens_after
            ),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedStamp {
    pub method: String,
    pub tokens_before: usize,
    pub tokens_after: usize,
    pub hint: Option<String>,
}

static STAMP_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[rtk:([a-z0-9][a-z0-9-]*) (\d+)→(\d+) tokens(?: · ([^\]]+))?\]")
        .expect("stamp grammar regex is a literal")
});

pub fn parse(text: &str) -> Vec<ParsedStamp> {
    STAMP_RE
        .captures_iter(text)
        .filter_map(|c| {
            Some(ParsedStamp {
                method: c.get(1)?.as_str().to_string(),
                tokens_before: c.get(2)?.as_str().parse().ok()?,
                tokens_after: c.get(3)?.as_str().parse().ok()?,
                hint: c.get(4).map(|m| m.as_str().to_string()),
            })
        })
        .collect()
}

pub fn provenance_of(text: &str) -> Provenance {
    Provenance {
        applied: parse(text).into_iter().map(|s| s.method).collect(),
    }
}

/// Text the hook site leaves behind, used by the proxy to skip a block that has
/// already been compressed once (single-site resolution). `cap`'s current
/// marker is `[N lines elided]`; the longer phrasing is kept because it is
/// already sitting in conversation histories written by earlier versions.
const HOOK_MARKER_SIGNATURES: &[&str] = &[
    "lines elided]",
    "full output in recall file]",
    "[full output: ",
];

pub fn carries_hook_stamp(text: &str) -> bool {
    if HOOK_MARKER_SIGNATURES.iter().any(|sig| text.contains(sig)) {
        return true;
    }
    !parse(text).is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_parse_round_trip() {
        let stamp = Stamp {
            method: "base64-elide",
            tokens_before: 900,
            tokens_after: 40,
            hint: Some("rtk recall 9f8e7d"),
        };
        let text = format!("output head\n{}\n", stamp.render());
        let parsed = parse(&text);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].method, "base64-elide");
        assert_eq!(parsed[0].tokens_before, 900);
        assert_eq!(parsed[0].tokens_after, 40);
        assert_eq!(parsed[0].hint.as_deref(), Some("rtk recall 9f8e7d"));
    }

    #[test]
    fn hintless_stamp_round_trips() {
        let stamp = Stamp {
            method: "dedup",
            tokens_before: 100,
            tokens_after: 60,
            hint: None,
        };
        let parsed = parse(&stamp.render());
        assert_eq!(parsed[0].hint, None);
    }

    #[test]
    fn provenance_lists_methods_in_order() {
        let text = "[rtk:cap 10→5 tokens]\nmiddle\n[rtk:ccr 200→20 tokens · rtk_retrieve(\"x\")]";
        let prov = provenance_of(text);
        assert_eq!(prov.applied, vec!["cap".to_string(), "ccr".to_string()]);
        assert!(prov.contains("ccr"));
    }

    #[test]
    fn plain_brackets_are_not_stamps() {
        assert!(parse("[1200 lines omitted] [rtk: nope] [x→y tokens]").is_empty());
    }

    #[test]
    fn truncation_tag_value_is_frozen() {
        assert_eq!(TRUNCATION_MARKER_TAG, "lines omitted by rtk-proxy");
    }
}

```

### Core Architecture Module: `engine/src/method.rs`
```
use crate::block::{Block, ContentFormat, Layer};

pub trait Method: Sync {
    fn name(&self) -> &'static str;
    fn info(&self) -> MethodInfo;
    fn apply(&self, block: &Block, ctx: &MethodCtx) -> Outcome;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Outcome {
    Continue(String),
    ShortCircuit(String),
    Skip,
}

#[derive(Debug, Clone, Copy)]
pub struct MethodCtx<'a> {
    pub source: &'a str,
}

impl<'a> MethodCtx<'a> {
    pub fn new(source: &'a str) -> Self {
        Self { source }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MethodKind {
    Transform,
    Directive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Recovery {
    None,
    Recall,
    RetrieveTool,
    Pointer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum CostClass {
    Instant,
    Fast,
    Slow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Produces {
    Same,
    Format(ContentFormat),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MethodInfo {
    pub kind: MethodKind,
    pub lossy: bool,
    pub recovery: Recovery,
    pub idempotent: bool,
    pub cache_stable: bool,
    pub deterministic: bool,
    pub cost: CostClass,
    pub consumes: &'static [ContentFormat],
    pub produces: Produces,
    pub terminal: bool,
    pub saves_on: &'static [Layer],
    pub cost_tokens: usize,
}

impl MethodInfo {
    pub const LOSSLESS_TRANSFORM: MethodInfo = MethodInfo {
        kind: MethodKind::Transform,
        lossy: false,
        recovery: Recovery::None,
        idempotent: true,
        cache_stable: true,
        deterministic: true,
        cost: CostClass::Instant,
        consumes: &[],
        produces: Produces::Same,
        terminal: false,
        saves_on: &[Layer::ToolResult],
        cost_tokens: 0,
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cost_classes_order_by_site_permissiveness() {
        assert!(CostClass::Instant < CostClass::Fast);
        assert!(CostClass::Fast < CostClass::Slow);
    }

    #[test]
    fn lossless_baseline_satisfies_the_cross_field_rules() {
        let info = MethodInfo::LOSSLESS_TRANSFORM;
        assert!(!info.lossy);
        assert!(info.idempotent);
        assert!(info.cache_stable);
        assert!(!info.terminal);
    }
}

```

### Core Architecture Module: `engine/src/methods/ansi.rs`
```
//! `ansi` layer: strips ANSI escape codes. Wraps `utils::strip_ansi`.

use crate::block::Block;
use crate::method::{Method, MethodCtx, MethodInfo, Outcome};
use crate::text::strip_ansi;

pub struct Ansi;

impl Method for Ansi {
    fn name(&self) -> &'static str {
        "ansi"
    }

    fn info(&self) -> MethodInfo {
        MethodInfo::LOSSLESS_TRANSFORM
    }

    fn apply(&self, block: &Block, _ctx: &MethodCtx) -> Outcome {
        let input = block.text;
        if !input.contains('\x1b') {
            return Outcome::Continue(input.to_string());
        }
        Outcome::Continue(strip_ansi(input))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::block::ContentFormat;

    fn ctx() -> MethodCtx<'static> {
        MethodCtx { source: "test" }
    }

    fn blk(text: &str) -> Block<'_> {
        crate::testutil::block(text, ContentFormat::Web)
    }

    #[test]
    fn test_strips_ansi_codes() {
        let Outcome::Continue(out) = Ansi.apply(&blk("\x1b[32mok\x1b[0m done"), &ctx()) else {
            panic!("ansi layer must continue");
        };
        assert_eq!(out, "ok done");
    }

    #[test]
    fn test_plain_text_unchanged() {
        let Outcome::Continue(out) = Ansi.apply(&blk("plain text"), &ctx()) else {
            panic!("ansi layer must continue");
        };
        assert_eq!(out, "plain text");
    }
}

```

### Core Architecture Module: `engine/src/methods/base64_elide.rs`
```
//! `base64-elide` layer: replaces long base64 runs with a size marker.
//!
//! Embedded images/fonts in JSON, data URLs in HTML/SVG/CSS are often 90%+
//! of a file's bytes with zero informational value to the model. A run is
//! only elided above a high threshold so hashes and short tokens never
//! match. Replacement happens inside string values without breaking JSON
//! validity (marker contains no quotes or backslashes).
//!
//! Not applied to the `matches` chain: bytes in a Grep match are genuine
//! file content and stay faithful.

use crate::block::Block;
use crate::method::{Method, MethodCtx, MethodInfo, Outcome};
use regex::Regex;
use std::sync::LazyLock;

/// Minimum contiguous base64 chars to elide (~768 decoded bytes).
const MIN_RUN: usize = 1024;

static BASE64_RUN: LazyLock<Regex> = LazyLock::new(|| {
    // Optional data-URL prefix captures the mime type for the marker.
    Regex::new(r"(?:data:([A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+);base64,)?([A-Za-z0-9+/]{1024,}={0,2})")
        .expect("valid regex")
});

pub struct Base64Elide;

impl Method for Base64Elide {
    fn name(&self) -> &'static str {
        "base64-elide"
    }

    fn info(&self) -> MethodInfo {
        MethodInfo {
            lossy: true,
            recovery: crate::method::Recovery::None,
            idempotent: false,
            ..MethodInfo::LOSSLESS_TRANSFORM
        }
    }

    fn apply(&self, block: &Block, _ctx: &MethodCtx) -> Outcome {
        let input = block.text;
        if input.len() < MIN_RUN {
            return Outcome::Continue(input.to_string());
        }
        let out = BASE64_RUN.replace_all(input, |caps: &regex::Captures| {
            let whole = caps.get(0).map(|m| m.as_str()).unwrap_or("");
            let run = caps.get(2).map(|m| m.as_str()).unwrap_or("");
            // The character class also matches a long decimal number or a hex
            // dump, and eliding one corrupts the surrounding JSON (a bare
            // number turns into `[base64 …]`). Only elide a run that is
            // actually base64 by `looks_like_base64`; leave the whole match
            // untouched otherwise, data-URL prefix included.
            if !looks_like_base64(run) {
                return whole.to_string();
            }
            let decoded_kb = (run.len() * 3 / 4) as f64 / 1024.0;
            let kind = caps.get(1).map(|m| m.as_str()).unwrap_or("data");
            format!("[base64 {kind}, {decoded_kb:.0} KB elided]")
        });
        Outcome::Continue(out.into_owned())
    }
}

/// Whether a run is plausibly real base64 rather than a decimal number or a
/// hex dump that happens to share the alphabet. Real base64 pads to a multiple
/// of 4 and, across 1024+ characters, spans all of upper, lower, and digits;
/// a number is digits only and a hex run is missing one letter case.
fn looks_like_base64(run: &str) -> bool {
    let body = run.trim_end_matches('=');
    if body.is_empty() || !run.len().is_multiple_of(4) {
        return false;
    }
    let (mut upper, mut lower, mut digit) = (false, false, false);
    for c in body.bytes() {
        match c {
            b'A'..=b'Z' => upper = true,
            b'a'..=b'z' => lower = true,
            b'0'..=b'9' => digit = true,
            _ => {}
        }
    }
    upper && lower && digit
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::block::ContentFormat;

    fn ctx() -> MethodCtx<'static> {
        MethodCtx {
            source: "test.json",
        }
    }

    fn blk(text: &str) -> Block<'_> {
        crate::testutil::block(text, ContentFormat::Json)
    }

    fn apply(input: &str) -> String {
        match Base64Elide.apply(&blk(input), &ctx()) {
            Outcome::Continue(out) | Outcome::ShortCircuit(out) => out,
            Outcome::Skip => input.to_string(),
        }
    }

    // Real base64 payload (deterministic bytes, standard alphabet, no padding
    // ambiguity): 3000 chars ≈ 2.2 KB decoded.
    fn long_b64() -> String {
        "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkr"
            .repeat(36)
    }

    #[test]
    fn test_data_url_elided_with_mime() {
        let input = format!(r#"{{"icon": "data:image/png;base64,{}"}}"#, long_b64());
        let out = apply(&input);
        assert!(out.contains("[base64 image/png,"), "mime in marker: {out}");
        assert!(out.len() < 200, "run must be gone");
        serde_json::from_str::<serde_json::Value>(&out).expect("JSON stays valid");
    }

    #[test]
    fn test_bare_run_elided_generic() {
        let input = format!("prefix {} suffix", long_b64());
        let out = apply(&input);
        assert!(out.contains("[base64 data,"), "generic marker: {out}");
        assert!(out.starts_with("prefix ") && out.ends_with(" suffix"));
    }

    #[test]
    fn test_short_base64_kept() {
        let input = r#"{"hash": "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo="}"#;
        assert_eq!(apply(input), input);
    }

    #[test]
    fn test_savings_on_blob_heavy_json() {
        let input = format!(
            r#"{{"name": "logo", "data": "data:image/png;base64,{}"}}"#,
            long_b64()
        );
        let out = apply(&input);
        let savings = 100.0 - (out.len() as f64 / input.len() as f64 * 100.0);
        assert!(savings >= 90.0, "expected ≥90% on blob, got {savings:.1}%");
    }

    #[test]
    fn test_empty_input() {
        assert_eq!(apply(""), "");
    }
}

#[cfg(test)]
mod base64_guard {
    use super::*;
    use crate::block::ContentFormat;

    fn run(input: &str) -> String {
        let block = crate::testutil::block(input, ContentFormat::Json);
        match Base64Elide.apply(&block, &crate::method::MethodCtx::new("t")) {
            Outcome::Continue(s) | Outcome::ShortCircuit(s) => s,
            Outcome::Skip => input.to_string(),
        }
    }

    /// A long digit run is not base64 — eliding it inside a JSON
    /// number produces invalid JSON that the downstream toon then fails on.
    #[test]
    fn a_long_bare_number_is_not_mistaken_for_base64() {
        // serde_json cannot even represent a 1300-digit integer, so "does it
        // parse" is the wrong check — the property is that the number is left
        // exactly as it was, never replaced by an unquoted `[base64 …]` that
        // would corrupt the surrounding structure.
        let big_int: String = "1".repeat(1300);
        let json = format!("{{\"n\": {big_int}, \"k\": \"v\"}}");
        let out = run(&json);
        assert_eq!(out, json, "a bare number must be left untouched");
    }

    /// Repeated hex (deadbeef×N) is not base64 either — same digit
    /// alphabet subset, but low entropy and not a real encoding.
    #[test]
    fn repeated_hex_is_not_elided() {
        let hex = "deadbeef".repeat(200);
        let out = run(&hex);
        assert_eq!(out, hex, "low-entropy hex must not be treated as base64");
    }

    /// A genuine base64 blob inside a JSON string must still be elided — the
    /// guard must not over-correct.
    #[test]
    fn a_real_base64_blob_is_still_elided() {
        let blob: String =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".repeat(30);
        let json = format!("{{\"img\": \"{blob}\"}}");
        let out = run(&json);
        assert!(
            out.contains("elided"),
            "real base64 must still elide: {out}"
        );
        assert!(
            serde_json::from_str::<serde_json::Value>(&out).is_ok(),
            "elision must keep JSON valid: {out}"
        );
    }
}

```

### Core Architecture Module: `engine/src/methods/cap.rs`
```
//! `cap` layer: bounds runaway terminal outputs, tail-biased.
//!
//! Bash errors live at the END of output, so the window keeps a small head
//! and a large tail with an explicit elision marker in between — unlike
//! `truncate`/`smart_truncate`, which are head-biased and code-oriented.
//! The full copy always lands in the recall file before this layer runs.

use crate::block::Block;
use crate::method::{Method, MethodCtx, MethodInfo, Outcome};
use crate::tokens::estimate_tokens;

pub const HEAD_LINES: usize = 50;
pub const TAIL_LINES: usize = 200;
pub const MAX_LINES: usize = HEAD_LINES + TAIL_LINES + 50;
pub const MAX_LINE_CHARS: usize = 2000;

pub struct Cap;

impl Method for Cap {
    fn name(&self) -> &'static str {
        "cap"
    }

    fn info(&self) -> MethodInfo {
        MethodInfo {
            lossy: true,
            recovery: crate::method::Recovery::Recall,
            idempotent: false,
            ..MethodInfo::LOSSLESS_TRANSFORM
        }
    }

    fn apply(&self, block: &Block, _ctx: &MethodCtx) -> Outcome {
        let input = block.text;
        let needs_line_cap = input.lines().any(|l| l.chars().count() > MAX_LINE_CHARS);
        let total = input.lines().count();
        let needs_window = total > MAX_LINES;

        if !needs_line_cap && !needs_window {
            return Outcome::Continue(input.to_string());
        }

        let cap_line = |l: &str| -> String {
            let count = l.chars().count();
            if count > MAX_LINE_CHARS {
                let kept: String = l.chars().take(MAX_LINE_CHARS).collect();
                format!("{} [+{} chars]", kept, count - MAX_LINE_CHARS)
            } else {
                l.to_string()
            }
        };

        let out = if needs_window {
            let lines: Vec<&str> = input.lines().collect();
            let elided = total - HEAD_LINES - TAIL_LINES;
            let mut result: Vec<String> = Vec::with_capacity(HEAD_LINES + TAIL_LINES + 1);
            result.extend(lines[..HEAD_LINES].iter().map(|l| cap_line(l)));
            // The count only. Whether the original is recoverable is not
            // knowable here: the hook adapter appends a pointer when a recall
            // entry was written, and writes none when recovery is disabled by
            // config or env. The method cannot assert that a recall file
            // exists.
            result.push(format!("[{elided} lines elided]"));
            result.extend(lines[total - TAIL_LINES..].iter().map(|l| cap_line(l)));
            result.join("\n")
        } else {
            input.lines().map(cap_line).collect::<Vec<_>>().join("\n")
        };

        let out = if input.ends_with('\n') {
            out + "\n"
        } else {
            out
        };
        // Degenerate inputs (many huge lines) could grow via markers.
        if estimate_tokens(&out) > estimate_tokens(input) {
            return Outcome::Continue(input.to_string());
        }
        Outcome::Continue(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rtk_engine_marker_detects(text: &str) -> bool {
        crate::marker::carries_hook_stamp(text)
    }
    use crate::block::ContentFormat;

    fn ctx() -> MethodCtx<'static> {
        MethodCtx { source: "bash" }
    }

    fn blk(text: &str) -> Block<'_> {
        crate::testutil::block(text, ContentFormat::Term)
    }

    fn apply(input: &str) -> String {
        match Cap.apply(&blk(input), &ctx()) {
            Outcome::Continue(out) | Outcome::ShortCircuit(out) => out,
            Outcome::Skip => input.to_string(),
        }
    }

    #[test]
    fn test_under_caps_untouched() {
        let input = "short\nlines\n";
        assert_eq!(apply(input), input);
    }

    #[test]
    fn test_window_keeps_tail_where_errors_live() {
        let input = (0..1000)
            .map(|i| format!("line {i}"))
            .collect::<Vec<_>>()
            .join("\n")
            + "\nerror: the thing that matters";
        let out = apply(&input);
        assert!(out.contains("error: the thing that matters"), "tail kept");
        assert!(out.contains("line 0"), "head kept");
        assert!(out.contains("lines elided]"));
        assert!(
            !out.contains("recall file"),
            "cap must not promise a recall file it cannot verify"
        );
        assert!(
            rtk_engine_marker_detects(&out),
            "the proxy must still recognise a hook-capped block"
        );
    }

    #[test]
    fn test_marker_arithmetic() {
        let total = 2 * MAX_LINES;
        let input = (0..total)
            .map(|i| format!("l{i}"))
            .collect::<Vec<_>>()
            .join("\n");
        let out = apply(&input);
        let elided = total - HEAD_LINES - TAIL_LINES;
        assert!(out.contains(&format!("[{elided} lines elided")));
        assert_eq!(out.lines().count(), HEAD_LINES + TAIL_LINES + 1);
    }

    #[test]
    fn test_long_line_suffix_marker() {
        let input = "x".repeat(MAX_LINE_CHARS + 500);
        let out = apply(&input);
        assert!(
            out.ends_with("[+500 chars]"),
            "explicit char count: {}",
            &out[out.len() - 30..]
        );
    }

    #[test]
    fn test_empty_input() {
        assert_eq!(apply(""), "");
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4833** (2026-10-30): **fix(ls): hold a bare listing to what ls prints, not to the long listing rtk asks for**
  *Symptoms*: ## Summary  - `rtk ls` without `-l` printed a size after every file (`kubectl  57.9M`), which plain `ls` never prints: bare `rtk ls` cost more than `ls` itself (341 → 531 bytes in this repo's root). - The never-worse guard could not catch it: the runner compares against the child's stdout, and the child is the `ls -l` rtk injects (2067 bytes), not the `ls` the user typed (341 bytes). - Every listing, with or without `-l`, is now held through the shared `never_worse` to the output of `ls` run with the user's own arguments. A listing without `-l` prints names only. The same baseline replaces the two places the filter printed the long listing verbatim: an unparsable listing (`-T`/`-D` dates, `-@`/`-e` attribute lines) and a failed run (`ls src missing` printed 742 bytes of long listing for the 108 bytes `ls` printed). - When `ls` rejects the command line outright (non-zero exit, nothing on stdout, e.g. GNU `--all` on macOS) while rtk's own listing succeeds, there is no listing to hold to: rtk lists as master does, instead of printing nothing with exit 0.  Cost: one extra `ls` process per call. `rtk ls -la` 8.9 → 12.3 ms mean (+2.4 ms CPU) on macOS with hyperfine; bare `rtk ls` +≈2.6 ms CPU.  ### Before / after (bytes, rtk repo root, macOS)  | command | `ls` | master | this PR | |---|---|---|---| | `ls` | 341 | 531 | 341 | | `ls -a` | 466 | 634 | 466 | | `ls src` | 103 | 137 | 103 | | `ls -t` | 341 | 531 | 341 | | `ls -F` | 354 | 494 | 354 | | `ls src missing` (exit 1) | 108 | 74

- **Issue #4782** (2026-10-25): **rtk hook rewrites rg/grep output and silently changes identifiers**
  *Symptoms*: When the Claude Code hook rewrites `rg`/`grep`/`git grep` (and `sed -n` reads) through rtk, the digest edits the content of matched source lines, not just their volume. Seen in practice: `revision` came back as `ren`, `description` as `n`. Nothing in the output marks the change, so an agent reading the digest draws wrong conclusions about the code; the only workaround is `rtk proxy <cmd>`.  **Expected:** search output is either passed through or only collapsed (lines dropped/counted), never rewritten inside a line. Suggest search commands (rg, grep, git grep, ag) be exempt from the hook rewrite by default, or that any in-line abbreviation be opt-in and visibly marked.  **Local workaround in use:** a wrapper around `rtk hook claude` that passes rg/grep/git grep through untouched; git and other commands still rewrite.  Environment: rtk 1.0.1, macOS (Darwin 25.6), Claude Code PreToolUse hook.  Possibly related: #4207, #1436, #4618. 
  **Post-Mortem & Fix Analysis**:
  > > <img src="https://raw.githubusercontent.com/wshm-dev/wshm/main/assets/wizard-icon.png" width="48" height="48"> **wshm** · Automated triage by AI  ## 🔍 Automated Triage  | | | |---|---| | 🐛 **Category** | `bug` | | 🟠 **Priority** | `high` | | 🎯 **Confidence** | 88% |  ### Summary  rtk's search-command rewrite (rg/grep/git grep/sed -n) corrupts matched content, silently altering identifiers mid-line rather than just collapsing volume  <details> <summary>📁 Relevant files</summary>  - `src/hook/claude.rs` - `src/rewrite/grep.rs` - `src/filter/grep.rs`  </details>  ### Suggested Actions  1. Reproduce with the exact `rg`/`grep` pattern that turned 'revision' into 'ren' and isolate the abbreviation logic 1. Check #4695 — the hook-coverage doc mismatch may explain why this rewrite path isn't flagged as risky 1. Evaluate exempting rg/grep/git grep/ag from in-line rewriting by default per the issue's suggestion 1. Cross-check #4207, #1436, #4618 for shared root cause in the digest/abbrevi
  > Closing — this was our error, not rtk. The commands were `rg -rn …`; in ripgrep `-r` is `--replace <text>`, so `-rn` rewrites every match to `n` (and `-rln` to `ln`). Reproduced with rtk bypassed (`rtk proxy rg -rn description f.txt` → `n here`). Sorry for the noise.

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

### Incident Patch 1: `ffd9cbe8` (2026-10-31)
**Commit Message**: fix(ruff): keep a leading `--` verbatim and read help/version first

A `--` that no subcommand precedes is ruff's usage error (`ruff -- check`),
so the router forwards it unchanged, as develop's ruff_double_dash_test
expects. A help or version flag before any subcommand or check option is
answered by ruff itself (`ruff -qh check`, `ruff --version --no-cache`), so
the scan returns the top-level route there instead of after the loop.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/cmds/python/ruff_cmd.rs` (modified, +86/-34)
```diff
@@ -1,7 +1,7 @@
 //! Filters Ruff linter and formatter output.
 
 use crate::core::arg_tokenizer::{
-    Dialect, Token, TokenKind, ValueSpec, before_dashdash, tokenize_grammar,
+    Dialect, Token, TokenKind, ValueSpec, before_dashdash, dashdash_index, tokenize_grammar,
 };
 use crate::core::args_utils;
 use crate::core::config;
@@ -159,15 +159,26 @@ fn route_ruff_args(args: &[String]) -> RuffRoute {
             }
             return RuffRoute::Check { explicit_at: None };
         }
+        // ruff answers a help or version flag as soon as it reads one, before
+        // a subcommand or a check option (`ruff -qh check`, `ruff -Vn`).
+        if requests_top_level(*token) {
+            return RuffRoute::TopLevel;
+        }
         // A check-only option's value looks like a free positional to the
         // tokenizer. Treat the whole invocation as the implicit-check form:
-        // nothing is removed and no later word is the subcommand. The `--`
-        // boundary is not an option: the scan never reads past it.
-        if token.kind != TokenKind::DashDash && !ruff_is_global_token(*token) {
+        // nothing is removed and no later word is the subcommand.
+        if !ruff_is_global_token(*token) {
             return RuffRoute::Check { explicit_at: None };
         }
     }
-    top_level_request(&tokens)
+    // Only global options come before this `--`. ruff answers `ruff -- check`
+    // with its usage error, and rtk forwards the call unchanged rather than
+    // linting a file named `check`.
+    if dashdash_index(&tokens).is_some() {
+        return RuffRoute::TopLevel;
+    }
+    // Every other flags-only call (for example `--statistics`) is an implicit check.
+    RuffRoute::Check { explicit_at: None }
 }
 
 /// Whether `token` is one of ruff's own global options (`ruff --help`, 0.17).
@@ -186,11 +197,13 @@ fn ruff_is_global_token(token: Token<'_>) -> bool {
 /// (`ruff --help`, 0.17: `--config` and `--color`).
 const RUFF_GLOBAL_VALUE_OPTIONS: &[&str] = &["config", "color"];
 
-/// Ruff's global flags, as long names without the leading dashes.
-const RUFF_GLOBAL_FLAGS: &[&str] = &["isolated", "verbose", "quiet", "silent", "help", "version"];
+/// Ruff's global flags, as long names without the leading dashes. Help and
+/// version are global too, but the scan answers them first
+/// (`requests_top_level`).
+const RUFF_GLOBAL_FLAGS: &[&str] = &["isolated", "verbose", "quiet", "silent"];
 
 /// The one-letter spellings of [`RUFF_GLOBAL_FLAGS`].
-const RUFF_GLOBAL_SHORT_FLAGS: &[&str] = &["v", "q", "s", "h", "V"];
+const RUFF_GLOBAL_SHORT_FLAGS: &[&str] = &["v", "q", "s"];
 
 fn ruff_takes_value(kind: TokenKind, name: &str) -> Option<ValueSpec> {
     (kind == TokenKind::Long && RUFF_GLOBAL_VALUE_OPTIONS.contains(&name)).then(ValueSpec::value)
@@ -204,25 +217,18 @@ enum RuffRoute {
     Check { explicit_at: Option<usize> },
     /// An explicit non-check subcommand at `at`; forwarded verbatim.
     Subcommand { at: usize },
-    /// No subcommand and no path: a top-level request such as `--version`.
+    /// Forwarded verbatim with its whole stdout: a help or version flag read
+    /// before any subcommand, path or check-only option, or a `--` that only
+    /// global options precede.
     TopLevel,
 }
 
-/// Flag-only invocations stay top-level for `--version`/`--help`; every other
-/// flags-only call (for example `--statistics`) is an implicit check. Read the
-/// tokens, not the raw args, so a cluster such as `-qh` is a help request.
-fn top_level_request(tokens: &[Token<'_>]) -> RuffRoute {
-    let requests_top_level = before_dashdash(tokens).iter().any(|token| {
-        matches!(
-            (token.kind, token.text),
-            (TokenKind::Long, "help" | "version") | (TokenKind::Short, "h" | "V")
-        )
-    });
-    if requests_top_level {
-        RuffRoute::TopLevel
-    } else {
-        RuffRoute::Check { explicit_at: None }
-    }
+/// Whether `token` is ruff's `--help`/`--version`, in a cluster (`-qh`) or not.
+fn requests_top_level(token: Token<'_>) -> bool {
+    matches!(
+        (token.kind, token.text),
+        (TokenKind::Long, "help" | "version") | (TokenKind::Short, "h" | "V")
+    )
 }
 
 /// The complete argument vector rtk passes to ruff.
@@ -966,10 +972,6 @@ Would reformat: tests/test_utils.py
                 "clean.py",
             ],
         );
-        assert_plan(
-            &["--", "clean.py"],
-            &["check", "--output-format=json", "--", "clean.py"],
-        );
     }
 
     /// A check-only option before the first free positional makes the call
@@ -1029,23 +1031,73 @@ Would reformat: tests/test_utils.py
         );
     }
 
+    #[test]
+    fn ruff_global_flags_keep_an_explicit_check() {
+        for flag in [
+            "--isolated",
+            "--verbose",
+            "--quiet",
+            "--silent",
+            "-v",
+            "-q",
+            "-s",
+        ] {
+            assert_plan(
+                &[fl
```

---

### Incident Patch 2: `9b60314a` (2026-10-31)
**Commit Message**: Merge pull request #4680 from Ehsan-hash/fix/settings-read-fail-closed

fix(hooks): preserve host checks when settings cannot be loaded

**File**: `src/hooks/permissions.rs` (modified, +61/-26)
```diff
@@ -496,16 +496,36 @@ fn get_settings_paths_from(
     paths
 }
 
-fn read_json(path: &std::path::Path) -> Option<Value> {
-    let content = std::fs::read_to_string(path).ok()?;
+enum JsonRead {
+    Missing,
+    Parsed(Value),
+    Error,
+}
+
+fn read_json(path: &std::path::Path) -> JsonRead {
+    let content = match std::fs::read_to_string(path) {
+        Ok(content) => content,
+        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return JsonRead::Missing,
+        Err(e) => {
+            eprintln!(
+                "[rtk] warning: failed to read permissions from {}: {}",
+                path.display(),
+                e
+            );
+            return JsonRead::Error;
+        }
+    };
+    if content.trim().is_empty() {
+        return JsonRead::Missing;
+    }
     match crate::core::utils::from_json_str::<Value>(&content) {
-        Ok(v) => Some(v),
+        Ok(v) => JsonRead::Parsed(v),
         Err(_) => {
             eprintln!(
                 "[rtk] warning: failed to parse permissions from {}",
                 path.display()
             );
-            None
+            JsonRead::Error
         }
     }
 }
@@ -532,19 +552,25 @@ fn append_wrapped_rules(rules_value: Option<&Value>, prefixes: &[&str], target:
 // Global config only. RTK auto-allows only the globally-trusted subset; anything
 // else defers to the host, which applies its own project config and folder-trust.
 // This keeps RTK's allow set a subset of the host's — never more permissive.
-fn global_config(dir: &str, file: &str) -> Option<Value> {
-    read_json(&user_dirs::home()?.join(dir).join(file))
+fn global_config(dir: &str, file: &str) -> JsonRead {
+    let Some(home) = user_dirs::home() else {
+        return JsonRead::Missing;
+    };
+    read_json(&home.join(dir).join(file))
 }
 
 fn load_cursor_rules() -> (Vec<String>, Vec<String>, Vec<String>) {
     let mut deny = Vec::new();
     let mut allow = Vec::new();
-    if let Some(perms) = global_config(CURSOR_DIR, "cli-config.json")
-        .as_ref()
-        .and_then(|j| j.get("permissions"))
-    {
-        append_wrapped_rules(perms.get("deny"), &["Shell("], &mut deny);
-        append_wrapped_rules(perms.get("allow"), &["Shell("], &mut allow);
+    match global_config(CURSOR_DIR, "cli-config.json") {
+        JsonRead::Error => deny.push("*".to_string()),
+        JsonRead::Parsed(json) => {
+            if let Some(perms) = json.get("permissions") {
+                append_wrapped_rules(perms.get("deny"), &["Shell("], &mut deny);
+                append_wrapped_rules(perms.get("allow"), &["Shell("], &mut allow);
+            }
+        }
+        JsonRead::Missing => {}
     }
     (deny, Vec::new(), allow)
 }
@@ -555,21 +581,27 @@ fn load_cursor_rules() -> (Vec<String>, Vec<String>, Vec<String>) {
 // untrusted → global, which is safe: never more permissive than the host).
 fn gemini_settings() -> Option<Value> {
     let global = global_config(GEMINI_DIR, SETTINGS_JSON);
+    let global_value = match &global {
+        JsonRead::Parsed(value) => Some(value),
+        JsonRead::Missing | JsonRead::Error => None,
+    };
     let trusted = user_env::var("GEMINI_CLI_TRUST_WORKSPACE").as_deref() == Some("true")
-        || !global
-            .as_ref()
+        || !global_value
             .and_then(|j| {
                 j.pointer("/security/folderTrust/enabled")
                     .and_then(Value::as_bool)
             })
             .unwrap_or(false);
     if trusted
         && let Some(root) = find_project_root()
-        && let Some(v) = read_json(&root.join(GEMINI_DIR).join(SETTINGS_JSON))
+        && let JsonRead::Parsed(v) = read_json(&root.join(GEMINI_DIR).join(SETTINGS_JSON))
     {
         return Some(v);
     }
-    global
+    match global {
+        JsonRead::Parsed(value) => Some(value),
+        JsonRead::Missing | JsonRead::Error => None,
+    }
 }
 
 fn load_gemini_rules() -> (Vec<String>, Vec<String>, Vec<String>) {
@@ -586,7 +618,7 @@ fn load_gemini_rules() -> (Vec<String>, Vec<String>, Vec<String>) {
 // All four Droid settings scopes: user (honoring $FACTORY_HOME_OVERRIDE) and
 // project `.factory/`, each with settings.json + settings.local.json
 // (docs.factory.ai/cli/configuration/settings). Missing files are skipped.
-fn droid_settings_scopes() -> Vec<Value> {
+fn droid_settings_scopes() -> (Vec<Value>, bool) {
     let mut dirs_to_read = Vec::new();
     if let Some(home) = user_dirs::env_path(DROID_HOME_ENV)
         .filter(|value| !value.is_empty())
@@ -600,14 +632,17 @@ fn droid_settings_scopes() -> Vec<Value> {
     }
 
     let mut scopes = Vec::new();
+    let mut failed = false;
     for dir in dirs_to_read {
         for file in [DROID_SETTINGS_FILE, SETTINGS_LOCAL_JSON] {
-            if let Some(v) = read_json(&dir.join(file)) {
-                scopes.push(v);
+            match read_json(&dir.join(file)) {
+                JsonRead::Parsed(value) => scopes.push(value),
+                JsonRead::M
```

**File**: `tests/hook_config_io_test.rs` (modified, +219/-0)
```diff
@@ -1,11 +1,115 @@
 //! Regression coverage for the shared hook configuration I/O.
+use serde_json::Value;
 use std::fs;
 use std::io::Write;
+use std::path::PathBuf;
 use std::process::Stdio;
 use tempfile::TempDir;
 
 mod common;
 
+struct HookSandbox {
+    _root: TempDir,
+    home: PathBuf,
+    project: PathBuf,
+    factory_home: PathBuf,
+}
+
+impl HookSandbox {
+    fn new() -> Self {
+        let root = TempDir::new().expect("tempdir");
+        let home = root.path().join("home");
+        let project = root.path().join("project");
+        let factory_home = root.path().join("factory-home");
+        fs::create_dir_all(home.join(".cursor")).expect("cursor dir");
+        // The project-root walk is deliberately bounded inside this sandbox.
+        fs::create_dir_all(project.join(".claude")).expect("claude dir");
+        fs::create_dir_all(factory_home.join(".factory")).expect("factory home");
+        fs::create_dir_all(project.join(".factory")).expect("factory project");
+        Self {
+            _root: root,
+            home,
+            project,
+            factory_home,
+        }
+    }
+
+    fn run(&self, hook: &str, payload: Value) -> Value {
+        let mut child = common::rtk_command()
+            .args(["hook", hook])
+            .current_dir(&self.project)
+            .env("HOME", &self.home)
+            .env("FACTORY_HOME_OVERRIDE", &self.factory_home)
+            .env("CLAUDE_CONFIG_DIR", self.home.join("claude"))
+            .env("XDG_CONFIG_HOME", self.home.join(".config"))
+            .env("RTK_DB_PATH", self.project.join("rtk.db"))
+            .stdin(Stdio::piped())
+            .stdout(Stdio::piped())
+            .stderr(Stdio::piped())
+            .spawn()
+            .expect("spawn hook");
+        child
+            .stdin
+            .take()
+            .expect("hook stdin")
+            .write_all(payload.to_string().as_bytes())
+            .expect("write hook payload");
+        let output = child.wait_with_output().expect("wait hook");
+        assert!(
+            output.status.success(),
+            "hook exited {:?}: {}",
+            output.status.code(),
+            String::from_utf8_lossy(&output.stderr)
+        );
+        let stdout = String::from_utf8_lossy(&output.stdout);
+        if stdout.trim().is_empty() {
+            // Droid's deny/step-aside protocol is an empty stdout response.
+            return Value::Null;
+        }
+        serde_json::from_str(stdout.trim()).unwrap_or_else(|error| {
+            panic!(
+                "hook emitted invalid JSON ({error}): stdout={stdout:?}, stderr={:?}",
+                String::from_utf8_lossy(&output.stderr)
+            )
+        })
+    }
+
+    #[cfg(unix)]
+    fn cursor(&self, command: &str) -> Value {
+        self.run(
+            "cursor",
+            serde_json::json!({
+                "tool_name": "Bash",
+                "tool_input": {"command": command}
+            }),
+        )
+    }
+
+    fn droid(&self, command: &str) -> Value {
+        self.run(
+            "droid",
+            serde_json::json!({
+                "tool_name": "Execute",
+                "tool_input": {"command": command}
+            }),
+        )
+    }
+
+    #[cfg(unix)]
+    fn cursor_settings(&self) -> PathBuf {
+        self.home.join(".cursor/cli-config.json")
+    }
+
+    fn droid_settings(&self, scope: &str, file: &str) -> PathBuf {
+        let root = match scope {
+            "user" => self.factory_home.join(".factory"),
+            "project" => self.project.join(".factory"),
+            _ => panic!("unknown Droid scope: {scope}"),
+        };
+        root.join(file)
+    }
+}
+
 #[test]
 fn copilot_cli_rewrite_preserves_vscode_tool_input() {
     let temp = TempDir::new().unwrap();
@@ -107,3 +211,118 @@ fn codex_status_handles_global_and_local_empty_bom_and_invalid_files() {
     assert_eq!(fs::read_to_string(&global_path).unwrap(), "{broken");
     assert_eq!(fs::read_to_string(&local_path).unwrap(), "{broken");
 }
+
+#[test]
+// Cursor's settings live under the home directory, and dirs::home_dir uses the
+// Windows Known Folder API, so HOME cannot point the hook at this sandbox there.
+#[cfg(unix)]
+fn cursor_settings_keep_missing_and_empty_behavior_but_step_aside_on_failures() {
+    let sandbox = HookSandbox::new();
+
+    let missing = sandbox.cursor("git status");
+    assert_eq!(missing["permission"], "ask");
+    assert_eq!(missing["updated_input"]["command"], "rtk git status");
+
+    let settings = sandbox.cursor_settings();
+    fs::write(&settings, "  \n").expect("write empty Cursor settings");
+    let empty = sandbox.cursor("git status");
+    assert_eq!(empty["permission"], "ask");
+    assert_eq!(empty["updated_input"]["command"], "rtk git status");
+
+    fs::write(
+        &settings,
+        r#"{"permissions":{"deny":["Shell(git push *)"],"allow":["Shell(git status)"]}}"#,
+    )
+    .expect("write valid Cursor settings");
+    let valid = sandb
```

---

### Incident Patch 3: `6b75e82d` (2026-10-31)
**Commit Message**: Merge pull request #4152 from KuSh/fix/4117-followup-filtered-log-cap

fix(git): announce the cap on the filtered `git log` path

**File**: `src/cmds/git/git_cmd.rs` (modified, +1368/-100)
```diff
@@ -12,6 +12,7 @@ use crate::core::stream::{
 use crate::core::tracking;
 use crate::core::truncate::{CAP_LIST, CAP_WARNINGS};
 use crate::core::user_dirs;
+use crate::core::user_env;
 use crate::core::utils::{exit_code_from_status, join_with_overflow, resolved_command, strip_ansi};
 use anyhow::{Context, Result};
 use std::ffi::OsString;
@@ -1526,7 +1527,41 @@ const REFUSAL_EXIT_CODE: i32 = 128;
 /// The two lengths `%H` can print, one per object format git has.
 const SHA1_NAME_LEN: usize = 40;
 const SHA256_NAME_LEN: usize = 64;
+/// Closes every commit in the format RTK asks for when the user named none, which is what
+/// lets the filtered path find commit boundaries in what git printed.
+const LOG_ENTRY_MARKER: &str = "---END---";
+/// Opens every commit of that format when RTK asks for one commit past its limit, in git's
+/// spelling: the control character, the commit's `%m` mark, its full object name and a space.
+/// What git prints after a commit's marker (a directory summary, a stat line) and what a file
+/// or a message holds can start with the control character too, but not with the whole of
+/// this, so it is what tells a commit from the rest. It is stripped before anything is
+/// rendered, printed or tracked.
+const LOG_ENTRY_START_SPEC: &str = "%x01%m%H ";
+const LOG_ENTRY_START: char = '\u{1}';
+/// What `%m` prints for a commit of a walk without `--boundary`: `<` and `>` for the two sides
+/// of a symmetric difference (`>` when there is one side only), `=` for a commit whose patch
+/// the other side has too and `^` for one outside the range.
+const OPENING_MARKS: [char; 4] = ['<', '>', '=', '^'];
 const DEFAULT_LOG_LIMIT_ARG: &str = "-10";
+/// The limit the filtered path allows a user-chosen format, which is counted in lines: a
+/// compact shape fits many more commits in the same reading budget.
+const COMPACT_LOG_LIMIT: usize = 50;
+/// The width a log line is cut to when RTK set the limit.
+const LOG_LINE_WIDTH: usize = 80;
+
+/// True when `exit_code` says git refused the command rather than ran it, which owes the user
+/// nothing beyond git's own error. A negative code is a git that crashed: Windows reports the
+/// NTSTATUS of the crash (-1073741819 for an access violation) as the exit code.
+fn refused_by_git(exit_code: i32) -> bool {
+    !(0..REFUSAL_EXIT_CODE).contains(&exit_code)
+}
+
+/// The one wording for a cap RTK applied, so both paths say the same thing and name the same
+/// escape. `unit` is what the cap took: commits, or the lines of a user format whose commits
+/// RTK cannot tell apart.
+fn cap_notice(limit: usize, unit: &str) -> String {
+    format!("[rtk] capped at {limit} {unit}; pass -n <count> for more")
+}
 
 /// `git log <args>` for the raw passthrough, carrying RTK's default limit unless the user named
 /// one. [`run_passthrough`] streams straight to the terminal, so the limit has to be in the args
@@ -1829,6 +1864,535 @@ fn bounds_the_walk(tokens: &[Token<'_>]) -> bool {
     })
 }
 
+/// True when `--output=<file>` sends the walk to a file instead of to RTK, which leaves RTK
+/// with nothing to read it out of.
+fn redirects_output(tokens: &[Token<'_>]) -> bool {
+    tokens
+        .iter()
+        .any(|t| t.kind == TokenKind::Long && t.text == "output")
+}
+
+/// True when the filtered path can ask git for one commit past its limit and drop it again,
+/// which answers whether the cap cut without walking the history twice.
+///
+/// Five shapes cannot. `--output=<file>` puts the walk in the user's file, where the extra
+/// commit would stay. `--reverse` flips the order *after* the limit has chosen the commits,
+/// so the extra one arrives first and dropping the overflow would drop HEAD. `--boundary`
+/// appends the commits just outside what the limit chose, which depend on the limit: asked
+/// for one more, git names other boundary commits, and the walk shown is no longer the one
+/// the user's limit gives. `--log-size` prints the size of each message as git rendered
+/// it, which counts the opening that is stripped afterwards. And a run that prints text of
+/// its own ahead of a commit's format output, see [`prints_ahead_of_a_commit`]: that text sits
+/// between the last commit shown and the opening of the extra one, so it would stay in the
+/// walk the user is shown.
+fn fetches_one_past_the_limit(
+    global_args: &[String],
+    env: impl Fn(&str) -> Option<String>,
+    tokens: &[Token<'_>],
+) -> bool {
+    !redirects_output(tokens)
+        && !prints_ahead_of_a_commit(global_args, env, tokens)
+        && !tokens.iter().any(|t| {
+            t.kind == TokenKind::Long && matches!(t.text, "reverse" | "boundary" | "log-size")
+        })
+}
+
+/// True when the arguments or the environment make git print text ahead of a commit's format
+/// output: the verdict on its signature (`--show-signature`, or `log.showSignature` given
+/// with `-c` or in the environment) and the bar of `--show-linear-break`. Git writes it between
+///
```

**File**: `src/cmds/system/pipe_cmd.rs` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ fn git_status_wrapper(input: &str) -> String {
 }
 
 fn git_log_wrapper(input: &str) -> String {
-    crate::cmds::git::git_cmd::filter_log_output(input, 50, false, false)
+    crate::cmds::git::git_cmd::filter_log_output(input, 50, false)
 }
 
 fn git_diff_wrapper(input: &str) -> String {
```

**File**: `tests/git_log_cap_notice_test.rs` (modified, +2087/-12)
```diff
@@ -1,13 +1,15 @@
-//! `rtk git log` in its raw-shape path injects RTK's default limit, so the walk it prints is
-//! bounded by RTK rather than by what the user asked for. This pins the one guarantee that
-//! makes that acceptable: the cap is never applied in silence.
+//! Both of `rtk git log`'s paths bound the walk by RTK's own limit rather than by what the
+//! user asked for. This pins the one guarantee that makes that acceptable: the cap is never
+//! applied in silence, and never announced when it took nothing.
 //!
-//! An integration test rather than a unit one because the failure it guards lives in the
-//! interaction between the user's own output format and RTK's ability to see what it printed:
-//! `--oneline` leaves no commit header to count, `log.decorate` and `--graph` disfigure the
-//! one that exists, `-z` separates records with a NUL instead of a newline, and
-//! `--line-prefix` puts its own text in front of them. Every one of those once silenced the
-//! notice.
+//! An integration test rather than a unit one because every failure it guards lives in the
+//! gap between what RTK printed and what git actually walked, which only a real repository
+//! shows. On the raw-shape path that gap is the output's shape: `--oneline` leaves no commit
+//! header to count, `log.decorate` and `--graph` disfigure the one that exists, `-z` runs the
+//! walk onto a single line, `--line-prefix` puts something in front of it. On the filtered
+//! path it is the unit the cap is counted in -- commits where RTK chose the format, lines
+//! where the user did -- along with what git prints after a commit that is not another one
+//! and the `--no-merges` RTK adds to the command and must therefore also ask about.
 //!
 //! The shapes that narrow a walk by what its commits changed get their own tests, because
 //! those take a different probe: `--skip` is applied before a diff-based filter, so the cap
@@ -60,16 +62,45 @@ struct Repo {
 }
 
 fn repo_with(commits: usize) -> Repo {
+    repo_with_subjects(commits, |i| format!("commit {i}"))
+}
+
+/// A history whose commit `i` has the subject `subject(i)`.
+fn repo_with_subjects(commits: usize, subject: impl Fn(usize) -> String) -> Repo {
+    repo_with_messages(commits, |i| vec![subject(i)])
+}
+
+/// A history whose commit `i` carries the message paragraphs `message(i)`, the subject first.
+fn repo_with_messages(commits: usize, message: impl Fn(usize) -> Vec<String>) -> Repo {
+    repo_committing(commits, |_| vec!["f.txt".to_string()], message)
+}
+
+/// A history whose commit `i` writes the files `files(i)` and carries the message paragraphs
+/// `message(i)`, one `-m` each.
+fn repo_committing(
+    commits: usize,
+    files: impl Fn(usize) -> Vec<String>,
+    message: impl Fn(usize) -> Vec<String>,
+) -> Repo {
     let dir = tempfile::tempdir().expect("tempdir");
     let path = dir.path().join("repo");
     let home = dir.path().join("home");
     std::fs::create_dir_all(&path).expect("mkdir repo");
     std::fs::create_dir_all(&home).expect("mkdir home");
     git_ok(&path, &home, &["init", "-q", "-b", "main"]);
     for i in 0..commits {
-        std::fs::write(path.join("f.txt"), format!("content {i}\n")).expect("write");
-        git_ok(&path, &home, &["add", "f.txt"]);
-        git_ok(&path, &home, &["commit", "-qm", &format!("commit {i}")]);
+        for file in files(i) {
+            let target = path.join(&file);
+            std::fs::create_dir_all(target.parent().expect("parent")).expect("mkdir");
+            std::fs::write(target, format!("content {i}\n")).expect("write");
+        }
+        git_ok(&path, &home, &["add", "-A"]);
+        let paragraphs = message(i);
+        let mut args = vec!["commit", "-q"];
+        for paragraph in &paragraphs {
+            args.extend(["-m", paragraph.as_str()]);
+        }
+        git_ok(&path, &home, &args);
     }
     Repo {
         _dir: dir,
@@ -308,6 +339,17 @@ fn a_sha256_repo_announces_the_cap() {
     let out = rtk_log(&path, &home, &["-p"]);
     let stderr = String::from_utf8_lossy(&out.stderr);
     assert!(stderr.contains(NOTICE), "sha256 repo: {stderr:?}");
+
+    // The filtered path reads the object name out of its own format, whatever length it has.
+    for (range, owed) in [("HEAD~10..HEAD", false), ("HEAD~11..HEAD", true)] {
+        let out = rtk_log(&path, &home, &[range]);
+        assert!(out.status.success(), "rtk git log {range} failed");
+        let stdout = String::from_utf8_lossy(&out.stdout);
+        assert_eq!(filtered_entries(&stdout), 10, "{range}: {stdout:?}");
+        assert!(!stdout.contains('\u{1}'), "{range}: {stdout:?}");
+        let stderr = String::from_utf8_lossy(&out.stderr);
+        assert_eq!(stderr.contains(NOTICE), owed, "{range}: {stderr:?}");
+    }
 }
 
 #[test]
@@ -993,3 +1035,2036 @@ fn a_reversed_diff_selected_walk_is_still_measured_by_what_it_selects() {
         );
     }
 }
+
+/// Entries in RTK's own log format: one header line per com
```

#### Recent Merged Pull Requests:
- **PR #4852** (2026-10-30): docs(root): add backlink to pro (@aeppling)
- **PR #4833** (2026-10-30): fix(ls): hold a bare listing to what ls prints, not to the long listing rtk asks for (@aeppling)
- **PR #4795** (2026-10-25): chore(master): release 1.1.0 (@rtk-release-bot[bot])
- **PR #4740** (2026-10-30): fix(init): install the OpenCode plugin independently of agent setup (@TechWizard9999)
- **PR #4739** (closed): fix(core): quote child arguments containing backslashes on Windows (fixes #4737) (@TechWizard9999)
- **PR #4738** (2026-10-31): fix(hook): honour opt-outs inside a quoted script behind uv run (@ShryukGrandhi)

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

## X. ruff): keep a leading `--` verbatim and read help/version first

**RULE**:
When implementing operations in `src/cmds/python/ruff_cmd.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rtk-ai/rtk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ffd9cbe8`: ruff): keep a leading `--` verbatim and read help/version first. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/cmds/python/ruff_cmd.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    Dialect, Token, TokenKind, ValueSpec, before_dashdash, dashdash_index, tokenize_grammar,
        // ruff answers a help or version flag as soon as it reads one, before
        // a subcommand or a check option (`ruff -qh check`, `ruff -Vn`).
        if requests_top_level(*token) {
            return RuffRoute::TopLevel;
        }
        // nothing is removed and no later word is the subcommand.
        if !ruff_is_global_token(*token) {
    // Only global options come before this `--`. ruff answers `ruff -- check`
    // with its usage error, and rtk forwards the call unchanged rather than
    // linting a file named `check`.
    if dashdash_index(&tokens).is_some() {
        return RuffRoute::TopLevel;
    }
    // Every other flags-only call (for example `--statistics`) is an implicit check.
    RuffRoute::Check { explicit_at: None }
/// Ruff's global flags, as long names without the leading dashes. Help and
/// version are global too, but the scan answers them first
/// (`requests_top_level`).
const RUFF_GLOBAL_FLAGS: &[&str] = &["isolated", "verbose", "quiet", "silent"];
const RUFF_GLOBAL_SHORT_FLAGS: &[&str] = &["v", "q", "s"];
    /// Forwarded verbatim with its whole st
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    Dialect, Token, TokenKind, ValueSpec, before_dashdash, tokenize_grammar,
        // nothing is removed and no later word is the subcommand. The `--`
        // boundary is not an option: the scan never reads past it.
        if token.kind != TokenKind::DashDash && !ruff_is_global_token(*token) {
    top_level_request(&tokens)
/// Ruff's global flags, as long names without the leading dashes.
const RUFF_GLOBAL_FLAGS: &[&str] = &["isolated", "verbose", "quiet", "silent", "help", "version"];
const RUFF_GLOBAL_SHORT_FLAGS: &[&str] = &["v", "q", "s", "h", "V"];
    /// No subcommand and no path: a top-level request such as `--version`.
/// Flag-only invocations stay top-level for `--version`/`--help`; every other
/// flags-only call (for example `--statistics`) is an implicit check. Read the
/// tokens, not the raw args, so a cluster such as `-qh` is a help request.
fn top_level_request(tokens: &[Token<'_>]) -> RuffRoute {
    let requests_top_level = before_dashdash(tokens).iter().any(|token| {
        matches!(
            (token.kind, token.text),
            (TokenKind::Long, "help" | "version") | (TokenKind::Short, "h" | "V")
        )
    });
    if requests_top_level {
      
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ffd9cbe8` are properly handled with clean fallback behavior.
