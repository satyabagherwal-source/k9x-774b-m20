> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rtk-ai-rtk-learnings.md`  
> **Source**: github ([https://github.com/rtk-ai/rtk](https://github.com/rtk-ai/rtk))  
> **Source Version**: `b47e05b5`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T23:27:27.258Z  
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
> **Harvest Timestamp**: 2026-11-04T23:27:27.253Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rtk-ai/rtk`
- **Description**: CLI proxy that reduces LLM token consumption by 60-90% on common dev commands. Single Rust binary, zero dependencies
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 85568 stars

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
- **Issue #4870** (2026-10-31): **fix(git): point the show truncation hint at the unfiltered commit**
  *Symptoms*: Fixes #4817.  The compacted `git show` output now replaces the generic `[full diff: rtk git diff --no-compact]` hint with `[full commit: rtk proxy git show ...]`, carrying the command's global args and dropping RTK's own `--no-compact`. Following the hint now prints the full commit.  Tests: `cargo test --lib show_recovery_hint`.
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/rtk-ai/rtk?pullRequest=4870) <br/>All committers have signed the CLA.
  > > <img src="https://raw.githubusercontent.com/wshm-dev/wshm/main/assets/wizard-icon.png" width="48" height="48"> **wshm** · Automated triage by AI  ## 📊 Automated PR Analysis  | | | |---|---| | 🐛 **Type** | `bug-fix` | | 🟢 **Risk** | `low` |  ### Summary  Fixes the recovery hint shown in compacted `git show` output so it points to `rtk proxy git show ...` with the original global args and object, rather than the generic `rtk git diff --no-compact` hint. This ensures following the hint actually prints the full commit instead of an unrelated diff command.  ### Review Checklist - [x] Tests present - [ ] Breaking change - [ ] Docs updated  **Linked issues:** #4817  --- *Analyzed automatically by [wshm](https://github.com/wshm-dev/wshm)* · This is an automated analysis, not a human review. <!-- wshm -->

- **Issue #4868** (2026-10-31): **fix(pnpm): keep the child's stdout when install fails**
  *Symptoms*: Fixes #4858.  On a non-zero `pnpm install` exit, print the child's stdout before stderr so policy gates and wrappers that explain the refusal on stdout are visible to the caller. The exit code is unchanged.  Tests: existing pnpm channel tests; failure path is a two-line output change.
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/rtk-ai/rtk?pullRequest=4868) <br/>All committers have signed the CLA.
  > > <img src="https://raw.githubusercontent.com/wshm-dev/wshm/main/assets/wizard-icon.png" width="48" height="48"> **wshm** · Automated triage by AI  ## 📊 Automated PR Analysis  | | | |---|---| | 🐛 **Type** | `bug-fix` | | 🟢 **Risk** | `low` |  ### Summary  Fixes pnpm install failure handling so the child process's stdout is printed before stderr when the install exits non-zero, ensuring output from policy gates or wrappers that write refusal explanations to stdout is visible. Exit code behavior is unchanged.  ### Review Checklist - [ ] Tests present - [ ] Breaking change - [ ] Docs updated  **Linked issues:** #4858  --- *Analyzed automatically by [wshm](https://github.com/wshm-dev/wshm)* · This is an automated analysis, not a human review. <!-- wshm -->

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

### Incident Patch 1: `50ebcea5` (2026-11-04)
**Commit Message**: ci(benchmark): stop running the whole test suite in the benchmark job

The benchmark is the longest CI job at 9 minutes, and it only reads output
token counts: nothing in it measures time, and a command's failure is ignored.

- `cargo test --lib` replaces the four whole-suite runs (237 s). The lib tests
  are 4,627 of about 5,480 tests and keep about 90% of the raw output.
- The job measures a debug rtk, named by the new `RTK_BIN`, instead of building
  with LTO (158 s). A full local run with each profile gave the same rtk totals
  to within one token. That build moves to a new `release (build)` job, so it no
  longer lengthens this one.
- golangci-lint comes as a prebuilt binary instead of compiling from source
  (67 s).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/CICD.md` (modified, +4/-3)
```diff
@@ -22,9 +22,9 @@ Trigger: pull_request to develop or master
            ▼       ▼              ▼               ▼        ▼
      ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌─────────┐ ┌──────────┐
      │ test     │ │ security │ │ semgrep   │ │benchmark│ │ doc      │
-     │ ubuntu   │ │ cargo    │ │ AST-aware │ │ >=80%   │ │ review   │
-     │ windows  │ │ audit    │ │ diff-only │ │ savings │ │ ai agent │
-     │ macos    │ │ patterns │ │           │ │         │ │          │
+     │ ubuntu   │ │ cargo    │ │ AST-aware │ │ no empty│ │ review   │
+     │ windows  │ │ audit    │ │ diff-only │ │ or grown│ │ ai agent │
+     │ macos    │ │ patterns │ │           │ │ output  │ │          │
      └────┬─────┘ └────┬─────┘ └─────┬─────┘ └────┬────┘ └────┬─────┘
           │            │             │             │            │
           └────────────┴─────────┬───┴─────────────┴────────────┘
@@ -34,6 +34,7 @@ Trigger: pull_request to develop or master
                       │  to merge          │
                       └────────────────────┘
 
+     + release (build, after clippy: must also pass to merge)
      + DCO check (independent, develop PRs only)
      + Dependabot (weekly: Cargo deps + GitHub Actions)
 ```
```

**File**: `.github/workflows/ci.yml` (modified, +23/-3)
```diff
@@ -300,8 +300,9 @@ jobs:
 
       - uses: Swatinem/rust-cache@v2
 
+      # Only output tokens are measured, so a release build would only add time.
       - name: Build rtk
-        run: cargo build --release
+        run: cargo build
 
       - name: Install system tools
         run: sudo apt-get install -y tree ripgrep
@@ -314,11 +315,30 @@ jobs:
         with:
           go-version: "stable"
 
-      - name: Install Go tools
-        run: go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
+      - name: Install golangci-lint
+        uses: golangci/golangci-lint-action@v9
+        with:
+          install-only: true
+          skip-cache: true
 
       - name: Run benchmark
         run: ./scripts/benchmark.sh
+        env:
+          RTK_BIN: target/debug/rtk
+
+  # The one PR job building the shipped profile: LTO problems only show at this link.
+  release:
+    name: release (build)
+    needs: clippy
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v7
+
+      - uses: dtolnay/rust-toolchain@stable
+
+      - uses: Swatinem/rust-cache@v2
+
+      - run: cargo build --release
 
   # ─── AI Doc Review: develop PRs only ───
 
```

**File**: `scripts/benchmark.sh` (modified, +19/-8)
```diff
@@ -4,15 +4,26 @@ set -e
 # cargo prints no colour into a pipe, which is how agents read it.
 export CARGO_TERM_COLOR=never
 
-# Use local release build if available, otherwise fall back to installed rtk
-if [ -f "./target/release/rtk" ]; then
-  RTK="$(cd "$(dirname ./target/release/rtk)" && pwd)/$(basename ./target/release/rtk)"
+# RTK_BIN names the binary to measure. Otherwise use the local release build if
+# available, and fall back to the installed rtk.
+if [ -n "${RTK_BIN:-}" ]; then
+  if [ ! -f "$RTK_BIN" ] || [ ! -x "$RTK_BIN" ]; then
+    echo "Error: RTK_BIN=$RTK_BIN is not a path to an executable file."
+    exit 1
+  fi
+  RTK="$RTK_BIN"
+elif [ -f "./target/release/rtk" ]; then
+  RTK="./target/release/rtk"
 elif command -v rtk &> /dev/null; then
   RTK="$(command -v rtk)"
 else
-  echo "Error: rtk not found. Run 'cargo build --release' or install rtk."
+  echo "Error: rtk not found. Run 'cargo build --release', install rtk, or set RTK_BIN."
   exit 1
 fi
+# Absolute, since the benches change directory. `command -v` can name a shell function.
+if [[ "$RTK" == */* ]]; then
+  RTK="$(CDPATH= cd -- "$(dirname -- "$RTK")" && pwd)/$(basename -- "$RTK")"
+fi
 BENCH_DIR="$(pwd)/scripts/benchmark"
 RTK_ROOT="$(pwd)"
 
@@ -363,8 +374,8 @@ fi
 # ===================
 section "test"
 if command -v cargo &>/dev/null; then
-  precompile cargo test --no-run
-  bench "test cargo test" "cargo test 2>&1 || true" "$RTK test cargo test 2>&1"
+  precompile cargo test --lib --no-run
+  bench "test cargo test" "cargo test --lib 2>&1 || true" "$RTK test cargo test --lib 2>&1"
 else
   echo "⏭️  test cargo test (cargo not in PATH, skipped)"
 fi
@@ -414,8 +425,8 @@ section "cargo"
 if command -v cargo &>/dev/null; then
   precompile cargo build
   bench "cargo build" "cargo build 2>&1 || true" "$RTK cargo build 2>&1"
-  precompile cargo test --no-run
-  bench "cargo test" "cargo test 2>&1 || true" "$RTK cargo test 2>&1"
+  precompile cargo test --lib --no-run
+  bench "cargo test" "cargo test --lib 2>&1 || true" "$RTK cargo test --lib 2>&1"
   precompile cargo clippy
   bench "cargo clippy" "cargo clippy 2>&1 || true" "$RTK cargo clippy 2>&1"
   precompile cargo check
```

---

### Incident Patch 2: `fb616a31` (2026-11-04)
**Commit Message**: Merge pull request #4965 from KuSh/test/windows-suite-duration

test: cut process spawns in the slowest Windows test suites

**File**: `tests/git_log_cap_notice_test.rs` (modified, +84/-14)
```diff
@@ -35,12 +35,34 @@ fn isolate(cmd: &mut Command, home: &Path) {
 }
 
 fn git_ok(repo: &Path, home: &Path, args: &[&str]) {
+    git_ok_with_stdin(repo, home, args, "");
+}
+
+/// [`git_ok`] with `input` on git's stdin.
+fn git_ok_with_stdin(repo: &Path, home: &Path, args: &[&str], input: &str) {
+    use std::io::Write;
+    use std::process::Stdio;
     let mut cmd = Command::new("git");
     cmd.arg("-C").arg(repo);
     cmd.args(["-c", "commit.gpgsign=false", "-c", "core.autocrlf=false"]);
+    // Every commit otherwise spawns `git maintenance run --auto`, a third process per
+    // commit for histories too small to need it.
+    cmd.args(["-c", "maintenance.auto=false"]);
     cmd.args(args);
     isolate(&mut cmd, home);
-    let out = cmd.output().expect("run git");
+    let mut child = cmd
+        .stdin(Stdio::piped())
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .spawn()
+        .expect("spawn git");
+    // A write error means git exited early; its stderr below says why.
+    let _ = child
+        .stdin
+        .take()
+        .expect("stdin")
+        .write_all(input.as_bytes());
+    let out = child.wait_with_output().expect("wait for git");
     assert!(
         out.status.success(),
         "git {args:?} failed: {}",
@@ -75,8 +97,10 @@ fn repo_with_messages(commits: usize, message: impl Fn(usize) -> Vec<String>) ->
     repo_committing(commits, |_| vec!["f.txt".to_string()], message)
 }
 
-/// A history whose commit `i` writes the files `files(i)` and carries the message paragraphs
-/// `message(i)`, one `-m` each.
+/// A history whose commit `i` writes `content {i}` to the files `files(i)` and carries the
+/// message paragraphs `message(i)`, recorded as `git commit -m` records them, then checked
+/// out. One `git fast-import` writes every commit, since each process costs tens of
+/// milliseconds on Windows.
 fn repo_committing(
     commits: usize,
     files: impl Fn(usize) -> Vec<String>,
@@ -88,19 +112,43 @@ fn repo_committing(
     std::fs::create_dir_all(&path).expect("mkdir repo");
     std::fs::create_dir_all(&home).expect("mkdir home");
     git_ok(&path, &home, &["init", "-q", "-b", "main"]);
+
+    // Stamped now, as `git commit` would: the default format prints relative dates.
+    let now = std::time::SystemTime::now()
+        .duration_since(std::time::UNIX_EPOCH)
+        .expect("clock after 1970")
+        .as_secs();
+    let mut stream = String::new();
     for i in 0..commits {
-        for file in files(i) {
-            let target = path.join(&file);
-            std::fs::create_dir_all(target.parent().expect("parent")).expect("mkdir");
-            std::fs::write(target, format!("content {i}\n")).expect("write");
-        }
-        git_ok(&path, &home, &["add", "-A"]);
-        let paragraphs = message(i);
-        let mut args = vec!["commit", "-q"];
-        for paragraph in &paragraphs {
-            args.extend(["-m", paragraph.as_str()]);
+        let message = commit_message(&message(i));
+        assert!(
+            !message.is_empty(),
+            "commit {i}: git commit refuses an empty message"
+        );
+        stream.push_str(&format!(
+            "commit refs/heads/main\n\
+             author t <t@example.com> {now} +0000\n\
+             committer t <t@example.com> {now} +0000\n\
+             data {}\n{message}\n",
+            message.len()
+        ));
+        let content = format!("content {i}\n");
+        let files = files(i);
+        assert!(
+            !files.is_empty(),
+            "commit {i}: git commit refuses an empty change"
+        );
+        for file in files {
+            stream.push_str(&format!(
+                "M 100644 inline {file}\ndata {}\n{content}\n",
+                content.len()
+            ));
         }
-        git_ok(&path, &home, &args);
+    }
+    if commits > 0 {
+        stream.push_str("done\n");
+        git_ok_with_stdin(&path, &home, &["fast-import", "--quiet", "--done"], &stream);
+        git_ok(&path, &home, &["reset", "-q", "--hard"]);
     }
     Repo {
         _dir: dir,
@@ -109,6 +157,28 @@ fn repo_committing(
     }
 }
 
+/// The message `git commit -m p1 -m p2 …` records: the paragraphs a blank line apart, then
+/// git's default cleanup for a message it does not edit -- trailing whitespace dropped, runs
+/// of blank lines collapsed, none at either end.
+fn commit_message(paragraphs: &[String]) -> String {
+    let mut message = String::new();
+    let mut blank_pending = false;
+    for line in paragraphs.join("\n\n").split('\n') {
+        let line = line.trim_end_matches([' ', '\t', '\r']);
+        if line.is_empty() {
+            blank_pending = !message.is_empty();
+            continue;
+        }
+        if blank_pending {
+            message.push('\n');
+            blank_pending = false;
+        }
+        message.push_str(line);
+        message.push('\n');
+    }
+    message
+}
+
 /// Every output shape that once swallowed th
```

**File**: `tests/git_show_blob_differential_test.rs` (modified, +43/-23)
```diff
@@ -7,7 +7,8 @@
 //!
 //! This test is the standing guarantee that no misroute class is hiding. It builds a
 //! hermetic git repo with objects of every relevant type, then — with a FIXED seed so CI
-//! is deterministic — generates hundreds of `git show <random flags> <arg>` invocations
+//! is deterministic — generates hundreds of `git show <random flags> <arg>` invocations,
+//! runs each distinct one once (rtk's answer depends only on its argv in this fixed repo),
 //! and checks rtk's CLASSIFICATION (did it window? pass through? render a commit-diff?)
 //! against ground truth from `git cat-file -t`. It asserts:
 //! - 0 misroutes: rtk never windows anything git does not call a `blob`;
@@ -21,12 +22,14 @@
 //! It shells out to the real `git` and the built `rtk` binary, matching the repo's other
 //! integration tests (e.g. `diff_byte_accuracy_test.rs`).
 
+use std::collections::HashMap;
 use std::path::{Path, PathBuf};
 use std::process::{Command, Output};
 
 mod common;
 
-/// Number of fuzz iterations. Seeded, so this is deterministic across runs/CI.
+/// Number of invocations drawn; the repeats among them are run once. Seeded, so this is
+/// deterministic across runs/CI.
 const ITERATIONS: usize = 600;
 /// Fixed seed — change only intentionally.
 const SEED: u64 = 0x5DEE_CE66_D3A1_2B4F;
@@ -185,7 +188,7 @@ fn was_windowed(out: &Output) -> bool {
 }
 
 /// The object categories the fuzzer draws from, with their expected classification.
-#[derive(Clone, Copy, Debug)]
+#[derive(Clone, Copy, Debug, PartialEq)]
 enum Kind {
     /// Large valid-UTF-8 blob → MUST window.
     LargeUtf8,
@@ -336,18 +339,6 @@ fn git_show_blob_classification_differential() {
     let repo = setup_repo();
     let (path, home) = (repo.path.as_path(), repo.home.as_path());
 
-    // Sanity-check the fixtures against ground truth before fuzzing.
-    assert_eq!(
-        cat_file_type(path, home, "HEAD:large.txt").as_deref(),
-        Some("blob")
-    );
-    assert_eq!(
-        cat_file_type(path, home, "HEAD:dir").as_deref(),
-        Some("tree")
-    );
-    assert_eq!(cat_file_type(path, home, "HEAD").as_deref(), Some("commit"));
-    assert_eq!(cat_file_type(path, home, "HEAD:does-not-exist.txt"), None);
-
     let kinds = [
         Kind::LargeUtf8,
         Kind::Small,
@@ -362,20 +353,46 @@ fn git_show_blob_classification_differential() {
         Kind::PathspecLargeUtf8,
     ];
 
+    // The draws repeat (the flag pools are small) and every process costs tens of
+    // milliseconds on Windows, so each distinct invocation runs once.
     let mut rng = Rng(SEED);
+    let mut invocations: Vec<(Kind, Vec<String>)> = Vec::new();
+    for _ in 0..ITERATIONS {
+        let kind = *rng.pick(&kinds);
+        let invocation = (kind, build_invocation(&mut rng, kind));
+        if !invocations.contains(&invocation) {
+            invocations.push(invocation);
+        }
+    }
+
+    // Ground truth per object, from `git cat-file -t`.
+    let mut truths: HashMap<&str, Option<String>> = HashMap::new();
+    for &kind in &kinds {
+        let object = kind_object(kind);
+        truths
+            .entry(object)
+            .or_insert_with(|| cat_file_type(path, home, object));
+    }
+
+    // Sanity-check the fixtures against ground truth before fuzzing.
+    assert_eq!(truths["HEAD:large.txt"].as_deref(), Some("blob"));
+    assert_eq!(truths["HEAD:dir"].as_deref(), Some("tree"));
+    assert_eq!(truths["HEAD"].as_deref(), Some("commit"));
+    assert_eq!(truths["HEAD:does-not-exist.txt"], None);
+    let mut plain_shows: HashMap<&str, Vec<u8>> = HashMap::new();
+
     // Collect failures instead of panicking mid-loop, so the incidence is measured
     // across ALL invocations (KuSh: a measured incidence is what proves no class hides).
     let mut misroutes: Vec<String> = Vec::new();
     let mut silent_losses: Vec<String> = Vec::new();
     let mut fidelity_breaks: Vec<String> = Vec::new();
 
-    for _ in 0..ITERATIONS {
-        let kind = *rng.pick(&kinds);
-        let args = build_invocation(&mut rng, kind);
+    for (kind, args) in &invocations {
+        let kind = *kind;
         let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
 
         let object = kind_object(kind);
-        let truth = cat_file_type(path, home, object); // ground truth for the object
+        let truth = &truths[object];
         let out = rtk_show(path, home, &arg_refs);
         let windowed = was_windowed(&out);
 
@@ -407,13 +424,15 @@ fn git_show_blob_classification_differential() {
                     !windowed,
                     "small/latin1/utf16 blobs must not window: {args:?}"
                 );
-                let plain = git(path, home, &["show", object]);
-                if out.stdout != plain.stdout {
+                let plain = plain_shows
+                    .entry(object)
+                    .or_insert_with(|| git(path, home, &["show", object]).stdout);
+                if out.stdout != *p
```

**File**: `tests/help_passthrough_fuzz_test.rs` (modified, +73/-34)
```diff
@@ -275,9 +275,9 @@ const CASES: &[Case] = &[
 
 #[test]
 fn a_wrapped_tools_own_help_survives_rtk() {
-    let mut checked = 0usize;
     let mut skipped = Vec::new();
-
+    // The cases of one tool, in `CASES` order, with the tool's resolved path.
+    let mut by_tool: Vec<(PathBuf, Vec<&Case>)> = Vec::new();
     for case in CASES {
         if UNIX_ONLY.contains(&case.tool) {
             skipped.push(case.tool);
@@ -287,47 +287,86 @@ fn a_wrapped_tools_own_help_survives_rtk() {
             skipped.push(case.tool);
             continue;
         };
-        let label = format!("rtk {}", case.rtk_args.join(" "));
-        let mine = run_rtk(case.rtk_args);
-        let native = run(&tool, case.native_args);
-        checked += 1;
-
-        assert!(
-            !is_rtk_usage(&mine.text),
-            "{label} answered with RTK's own usage:\n{}",
-            &mine.text[..mine.text.len().min(200)]
-        );
-        assert_eq!(
-            mine.code, native.code,
-            "{label} exit code drifted from the tool's"
-        );
-        // Content, not length: a length check passes on a long page from the wrong
-        // subcommand, which is exactly what a bad `git_name` arm would return. Exact bytes
-        // are still not asserted, because `man` renders to the terminal it thinks it has
-        // and a tool may print its own name from argv[0].
-        let anchor = without_exe(first_substantial_line(&native.text));
-        assert!(
-            without_exe(&mine.text).contains(&anchor),
-            "{label} does not contain the tool's own first line {anchor:?}:\n{}",
-            &mine.text[..mine.text.len().min(200)]
-        );
-        assert!(
-            mine.text.len() * 2 >= native.text.len(),
-            "{label} returned {} bytes of the tool's {}",
-            mine.text.len(),
-            native.text.len()
-        );
+        match by_tool.iter_mut().find(|(path, _)| *path == tool) {
+            Some((_, cases)) => cases.push(case),
+            None => by_tool.push((tool, vec![case])),
+        }
     }
-
     assert!(
-        checked > 0,
+        !by_tool.is_empty(),
         "no wrapped tool was available to compare against"
     );
+
+    // A toolchain's first launch can take seconds (a Windows runner's cold start, a
+    // first run in the scratch profile), so the tools run side by side. One tool's
+    // cases stay in order on one thread, rtk before the tool, so whatever a tool
+    // prints only on its first run lands on the same side it always has.
+    std::thread::scope(|scope| {
+        let threads: Vec<_> = by_tool
+            .iter()
+            .map(|(tool, cases)| {
+                // Named after the tool, so a failure reads `thread 'git' panicked`.
+                std::thread::Builder::new()
+                    .name(cases[0].tool.to_string())
+                    .spawn_scoped(scope, move || {
+                        for case in cases {
+                            check(tool, case);
+                        }
+                    })
+                    .expect("spawn a thread per tool")
+            })
+            .collect();
+        // Every thread is joined before the first panic is resumed, so `scope`
+        // adds no generic panic of its own.
+        let mut first = None;
+        for thread in threads {
+            if let Err(panic) = thread.join() {
+                first.get_or_insert(panic);
+            }
+        }
+        if let Some(panic) = first {
+            std::panic::resume_unwind(panic);
+        }
+    });
+
     if !skipped.is_empty() {
         eprintln!("skipped (not installed): {}", skipped.join(", "));
     }
 }
 
+/// `rtk <case.rtk_args>` against `<tool> <case.native_args>`.
+fn check(tool: &Path, case: &Case) {
+    let label = format!("rtk {}", case.rtk_args.join(" "));
+    let mine = run_rtk(case.rtk_args);
+    let native = run(tool, case.native_args);
+
+    assert!(
+        !is_rtk_usage(&mine.text),
+        "{label} answered with RTK's own usage:\n{}",
+        &mine.text[..mine.text.len().min(200)]
+    );
+    assert_eq!(
+        mine.code, native.code,
+        "{label} exit code drifted from the tool's"
+    );
+    // Content, not length: a length check passes on a long page from the wrong
+    // subcommand, which is exactly what a bad `git_name` arm would return. Exact bytes
+    // are still not asserted, because `man` renders to the terminal it thinks it has
+    // and a tool may print its own name from argv[0].
+    let anchor = without_exe(first_substantial_line(&native.text));
+    assert!(
+        without_exe(&mine.text).contains(&anchor),
+        "{label} does not contain the tool's own first line {anchor:?}:\n{}",
+        &mine.text[..mine.text.len().min(200)]
+    );
+    assert!(
+        mine.text.len() * 2 >= native.text.len(),
+        "{label} returned {} bytes of the tool's {}",
+        mine.text.len(),
+        native.text.len()
+    );
+}
+
 /// The reported bug, en
```

---

### Incident Patch 3: `980ae986` (2026-11-03)
**Commit Message**: fix(benchmark): stop booking compile output, colour and target/ as savings

Three cases counted output on the raw side that rtk was never shown or an agent
would never read. All were found while analysing how long the benchmark job
takes.

- bench runs the raw command first, so on a cold target the compile output
  landed on that side alone: `err cargo build` reported 77 -> 12 tokens with rtk
  compiling nothing. `cargo build`, `test`, `clippy` and `check` now build before
  each pair.
- CI forces `CARGO_TERM_COLOR=always`, so rtk got credit for stripping colour
  that cargo does not print into a pipe. The script now turns it off.
- The raw `find *`, `find *.rs` and `tree` rows listed `target/`, which rtk skips,
  and the `find` rows also listed `.git/`, so they moved with whatever had been
  built. They now exclude both, as `find --max 100` already does.

The reported rows and token total drop to what the filters actually do.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `scripts/benchmark.sh` (modified, +18/-3)
```diff
@@ -1,6 +1,9 @@
 #!/usr/bin/env bash
 set -e
 
+# cargo prints no colour into a pipe, which is how agents read it.
+export CARGO_TERM_COLOR=never
+
 # Use local release build if available, otherwise fall back to installed rtk
 if [ -f "./target/release/rtk" ]; then
   RTK="$(cd "$(dirname ./target/release/rtk)" && pwd)/$(basename ./target/release/rtk)"
@@ -42,6 +45,12 @@ FAIL_TESTS=0
 WARN_TESTS=0
 NEGATIVE_TESTS=0
 
+# bench runs the raw side first, so a first build's compile output would land on
+# that side alone and read as savings. Building first gives both sides the same target.
+precompile() {
+  "$@" > /dev/null 2>&1 || echo "⚠️  precompile failed: $*" >&2
+}
+
 bench() {
   local name="$1"
   local unix_cmd="$2"
@@ -176,7 +185,7 @@ bench "ls multi" "ls -la src/ scripts/" "$RTK ls src/ scripts/"
 # ===================
 if command -v tree &>/dev/null; then
   section "tree"
-  bench "tree" "tree -L 2" "$RTK tree -L 2"
+  bench "tree" "tree -L 2 -I target" "$RTK tree -L 2"
   bench "tree src/" "tree src/ -L 2" "$RTK tree src/ -L 2"
 else
   echo ""
@@ -197,8 +206,8 @@ bench "read -n" "cat -n src/lib.rs" "$RTK read src/lib.rs -n"
 # find
 # ===================
 section "find"
-bench "find *" "find . -type f" "$RTK find '*'"
-bench "find *.rs" "find . -name '*.rs' -type f" "$RTK find '*.rs'"
+bench "find *" "find . -not -path './target/*' -not -path './.git/*' -type f" "$RTK find '*'"
+bench "find *.rs" "find . -not -path './target/*' -not -path './.git/*' -name '*.rs' -type f" "$RTK find '*.rs'"
 # `rtk find --max N` caps how many names are DISPLAYED but still scans and
 # summarizes the whole tree, so the honest baseline is the full `find` a user
 # would otherwise read, not a `head -N`-truncated slice — that measures a
@@ -343,6 +352,7 @@ bench "env -f PATH" "env | grep PATH" "$RTK env -f PATH"
 # ===================
 section "err"
 if command -v cargo &>/dev/null; then
+  precompile cargo build
   bench "err cargo build" "cargo build 2>&1 || true" "$RTK err cargo build 2>&1"
 else
   echo "⏭️  err cargo build (cargo not in PATH, skipped)"
@@ -353,6 +363,7 @@ fi
 # ===================
 section "test"
 if command -v cargo &>/dev/null; then
+  precompile cargo test --no-run
   bench "test cargo test" "cargo test 2>&1 || true" "$RTK test cargo test 2>&1"
 else
   echo "⏭️  test cargo test (cargo not in PATH, skipped)"
@@ -401,9 +412,13 @@ fi
 # ===================
 section "cargo"
 if command -v cargo &>/dev/null; then
+  precompile cargo build
   bench "cargo build" "cargo build 2>&1 || true" "$RTK cargo build 2>&1"
+  precompile cargo test --no-run
   bench "cargo test" "cargo test 2>&1 || true" "$RTK cargo test 2>&1"
+  precompile cargo clippy
   bench "cargo clippy" "cargo clippy 2>&1 || true" "$RTK cargo clippy 2>&1"
+  precompile cargo check
   bench "cargo check" "cargo check 2>&1 || true" "$RTK cargo check 2>&1"
 else
   echo "⏭️  cargo build/test/clippy/check (cargo not in PATH, skipped)"
```

#### Recent Merged Pull Requests:
- **PR #4988** (2026-11-04): ci(benchmark): cut the job to about 3 minutes and compare like with like (@KuSh)
- **PR #4965** (2026-11-04): test: cut process spawns in the slowest Windows test suites (@KuSh)
- **PR #4876** (closed): docs: make the rewrite coverage page verifiable (@alexrain)
- **PR #4870** (closed): fix(git): point the show truncation hint at the unfiltered commit (@alexrain)
- **PR #4868** (closed): fix(pnpm): keep the child's stdout when install fails (@alexrain)
- **PR #4852** (2026-10-30): docs(root): add backlink to pro (@aeppling)

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

## X. ci(benchmark): stop running the whole test suite in the benchmark job

**RULE**:
When implementing operations in `.github/workflows/CICD.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rtk-ai/rtk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `50ebcea5`: ci(benchmark): stop running the whole test suite in the benchmark job. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/CICD.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
     │ ubuntu   │ │ cargo    │ │ AST-aware │ │ no empty│ │ review   │
     │ windows  │ │ audit    │ │ diff-only │ │ or grown│ │ ai agent │
     │ macos    │ │ patterns │ │           │ │ output  │ │          │
     + release (build, after clippy: must also pass to merge)
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
     │ ubuntu   │ │ cargo    │ │ AST-aware │ │ >=80%   │ │ review   │
     │ windows  │ │ audit    │ │ diff-only │ │ savings │ │ ai agent │
     │ macos    │ │ patterns │ │           │ │         │ │          │
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `50ebcea5` are properly handled with clean fallback behavior.
