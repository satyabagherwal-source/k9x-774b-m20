# Forensic Learning Record (Deep Inspection): stakpak/agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/stakpak-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/stakpak/agent](https://github.com/stakpak/agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:29:32.213Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `stakpak/agent`
- **Description**: Ship your code, on autopilot. An open source agent that lives on your machines 24/7 and keeps your apps running. 🦀
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 1813 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/src/commands/acp/utils.rs`
```
use regex::Regex;

/// Strip the MCP server prefix and any trailing "()" from a tool name.
/// Example: "stakpak__run_command" -> "run_command"
/// Example: "run_command" -> "run_command"
/// Example: "str_replace()" -> "str_replace"
pub fn strip_tool_name(name: &str) -> &str {
    let mut result = name;

    // Strip the MCP server prefix (e.g., "stakpak__")
    if let Some(pos) = result.find("__")
        && pos + 2 < result.len()
    {
        result = &result[pos + 2..];
    }

    // Strip trailing "()" if present
    if result.ends_with("()") {
        result = &result[..result.len() - 2];
    }

    result
}

/// Convert XML tags to markdown headers using pattern matching.
/// Handles core context tags plus both legacy and current skill sections.
pub fn convert_xml_tags_to_markdown(text: &str) -> String {
    let mut result = text.to_string();

    let tag_patterns = [
        ("<scratchpad>", "## **Scratchpad**\n"),
        ("<todo>", "### **Todo**\n"),
        ("<local_context>", "### **Local Context**\n"),
        ("<available_skills>", "### **Skills**\n"),
        // Legacy tag kept for backward compatibility with older checkpoints.
        ("<rulebooks>", "### **Skills**\n"),
    ];

    let closing_patterns = [
        "</scratchpad>",
        "</todo>",
        "</local_context>",
        "</available_skills>",
        "</rulebooks>",
    ];

    // Convert opening tags
    for (opening_tag, markdown_header) in tag_patterns.iter() {
        result = result.replace(opening_tag, markdown_header);
    }

    // Remove closing tags
    for closing_tag in closing_patterns.iter() {
        result = result.replace(closing_tag, "");
    }

    result
}

/// Process checkpoint patterns - remove checkpoint IDs completely
pub fn remove_checkpoint_patterns(text: &str) -> String {
    let pattern = r"<checkpoint_id>([^<]*)</checkpoint_id>";
    let regex = match Regex::new(pattern) {
        Ok(r) => r,
        Err(_) => return text.to_string(),
    };

    regex.replace_all(text, "").to_string()
}

/// Process all XML patterns in sequence
pub fn process_all_xml_patterns(text: &str) -> String {
    let mut result = text.to_string();

    // First remove checkpoint patterns
    result = remove_checkpoint_patterns(&result);

    // Then convert XML tags to markdown
    result = convert_xml_tags_to_markdown(&result);

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_tool_name() {
        assert_eq!(strip_tool_name("stakpak__run_command"), "run_command");
        assert_eq!(strip_tool_name("run_command"), "run_command");
        assert_eq!(strip_tool_name("other__server__tool"), "server__tool");
        assert_eq!(strip_tool_name("prefix__"), "prefix__");
        assert_eq!(strip_tool_name("__tool"), "tool");
        assert_eq!(strip_tool_name("str_replace()"), "str_replace");
        assert_eq!(strip_tool_name("create()"), "create");
        assert_eq!(strip_tool_name("stakpak__str_replace()"), "str_replace");
    }

    #[test]
    fn test_convert_xml_tags_to_markdown() {
        let input = "<scratchpad>\n<todo>\n- Task 1\n- Task 2\n</todo>\n</scratchpad>";
        let expected = "## **Scratchpad**\n\n### **Todo**\n\n- Task 1\n- Task 2\n\n";
        let result = convert_xml_tags_to_markdown(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_convert_available_skills_tag_to_markdown() {
        let input = "<available_skills>\n- skill one\n</available_skills>";
        let expected = "### **Skills**\n\n- skill one\n";
        let result = convert_xml_tags_to_markdown(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_convert_legacy_rulebooks_tag_to_skills_markdown() {
        let input = "<rulebooks>\n- skill one\n</rulebooks>";
        let expected = "### **Skills**\n\n- skill one\n";
        let result = convert_xml_tags_to_markdown(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_remove_checkpoint_patterns() {
        let input = "Hello <checkpoint_id>123</checkpoint_id> world";
        let expected = "Hello  world";
        let result = remove_checkpoint_patterns(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_process_all_xml_patterns() {
        let input = "<checkpoint_id>abc</checkpoint_id><scratchpad>\n<todo>\n- Task\n</todo>\n</scratchpad>";
        let expected = "## **Scratchpad**\n\n### **Todo**\n\n- Task\n\n";
        let result = process_all_xml_patterns(input);
        assert_eq!(result, expected);
    }
}

```

### Core Architecture Module: `cli/src/commands/agent/run/renderer.rs`
```
use crossterm::style::Stylize;
use serde_json::Value;
use stakpak_api::storage::{SessionStats, ToolUsageStats};
use stakpak_shared::models::{integrations::openai::ChatMessage, llm::LLMTokenUsage};
use std::fmt;

use crate::utils::cli_colors::crossterm_colors;

#[derive(Debug, Clone, PartialEq)]
pub enum OutputFormat {
    Json,
    Text,
}

impl fmt::Display for OutputFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OutputFormat::Json => write!(f, "json"),
            OutputFormat::Text => write!(f, "text"),
        }
    }
}

impl std::str::FromStr for OutputFormat {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "json" => Ok(OutputFormat::Json),
            "text" => Ok(OutputFormat::Text),
            _ => Err(format!(
                "Invalid output format: {}. Valid values are 'json' or 'text'",
                s
            )),
        }
    }
}

pub struct OutputRenderer {
    format: OutputFormat,
    verbose: bool,
}

impl OutputRenderer {
    pub fn new(format: OutputFormat, verbose: bool) -> Self {
        Self { format, verbose }
    }

    // Generic rendering functions

    pub fn render_title(&self, title: &str) -> String {
        match (&self.format, self.verbose) {
            (OutputFormat::Text, true) => {
                format!(
                    "╭─────────────────────────────────────────────────────────────────────────────────╮\n│ {:<79} │\n╰─────────────────────────────────────────────────────────────────────────────────╯\n",
                    title
                )
            }
            _ => String::new(),
        }
    }

    pub fn render_step_header(&self, step: usize, tool_count: usize) -> String {
        match (&self.format, self.verbose) {
            (OutputFormat::Text, true) => {
                let header_text = if tool_count > 0 {
                    format!(
                        "Step {} - Executing {} tool{}",
                        step,
                        tool_count,
                        if tool_count == 1 { "" } else { "s" }
                    )
                } else {
                    format!("Step {} - Agent response", step)
                };

                format!(
                    "\n{}\n{}\n",
                    header_text,
                    "─".repeat(header_text.chars().count())
                )
            }
            _ => String::new(),
        }
    }

    pub fn render_section_break(&self) -> String {
        match (&self.format, self.verbose) {
            (OutputFormat::Text, true) => "\n".to_string(),
            _ => String::new(),
        }
    }

    pub fn render_assistant_message(&self, content: &str, is_final: bool) -> String {
        match (&self.format, self.verbose) {
            (OutputFormat::Text, true) => {
                let formatted_content = self.format_xml_tags_as_boxes(content);

                if is_final {
                    format!(
                        "┌─ Final Agent Response ──────────────────────────────────────────────────────────\n{}\n└─────────────────────────────────────────────────────────────────────────────────",
                        formatted_content
                            .lines()
                            .map(|line| format!("│ {}", line))
                            .collect::<Vec<_>>()
                            .join("\n")
                    )
                } else {
                    let mut output = String::new();
                    output.push_str("Agent Response:\n");

                    if self.verbose {
                        // Show full response
                        for line in formatted_content.lines() {
                            output.push_str(&format!("  {}\n", line));
                        }
                    } else {
                        // Show truncated response - first 3 lines max
                        let lines: Vec<&str> = formatted_content.lines().collect();
                        let display_lines = if lines.len() > 3 { 3 } else { lines.len() };

                        for line in lines.iter().take(display_lines) {
                            let truncated_line = if line.chars().count() > 80 {
                                let truncated: String = line.chars().take(80).collect();
                                format!("{}...", truncated)
                            } else {
                                line.to_string()
                            };
                            output.push_str(&format!("  {}\n", truncated_line));
                        }

                        if lines.len() > 3 {
                            output.push_str(&format!("  ... ({} more lines)\n", lines.len() - 3));
                        }
                    }
                    output
                }
            }
            _ => String::new(),
        }
    }

    pub fn render_tool_execution(
        &self,
        tool_name: &str,
        tool_params: &str,
        tool_index: usize,
        total_tools: usize,
    ) -> String {
        match (&self.format, self.verbose) {
            (OutputFormat::Text, true) => {
                let mut output =
                    format!("Tool {}/{}: {}\n", tool_index + 1, total_tools, tool_name);

                if !tool_params.trim().is_empty() {
                    if let Ok(params_json) = serde_json::from_str::<Value>(tool_params) {
                        let truncated_params = truncate_yaml_value(&params_json, 200);
                        if let Ok(pretty_json) = serde_json::to_string_pretty(&truncated_params) {
                            output.push_str("  Arguments:\n");
                            for line in pretty_json.lines() {
                                output.push_str(&format!("    {}\n", line));
                            }
                        } else {
                            output.push_str(&format!("  Arguments: {}\n", tool_params));
                        }
                    } else {
                        output.push_str(&format!("  Arguments: {}\n", tool_params));
                    }
                }
                output
            }
            _ => String::new(),
        }
    }

    pub fn render_tool_result(&self, result: &str) -> String {
        match (&self.format, self.verbose) {
            (OutputFormat::Text, true) => {
                let mut output = String::from("  Result:\n");

                if self.verbose {
                    for line in result.lines() {
                        output.push_str(&format!("    {}\n", line));
                    }
                    output.push('\n'); // Add blank line after verbose tool output
                } else {
                    // Show truncated result
                    let first_line = result.lines().next().unwrap_or("").trim();
                    if !first_line.is_empty() {
                        let truncated = if first_line.chars().count() > 80 {
                            let truncated_chars: String = first_line.chars().take(80).collect();
                            format!("{}...", truncated_chars)
                        } else {
                            first_line.to_string()
                        };
                        output.push_str(&format!("    {}\n", truncated));
                    }
                }
                output
            }
            _ => String::new(),
        }
    }

    pub fn render_info(&self, message: &str) -> String {
        match (&self.format, self.verbose) {
            (OutputFormat::Text, true) => format!("[info] {}\n", message),
            _ => String::new(),
        }
    }

    pub fn render_success(&self, message: &str) -> String {
        match (&self.format, self.verbose) {
            (OutputFormat::Text, true) => format!("[success] {}\n", message),
            _ => String::new(),
        }
    }

    pub fn render_warning(&self, message: &str) -> String {
        match self.format {
            OutputFormat::Json => String::new(),
            OutputFormat::Text => format!("[warning] {}\n", message),
        }
    }

    pub fn render_error(&self, message: &str) -> String {
        match self.format {
            OutputFormat::Json => String::new(),
            OutputFormat::Text => format!("[error] {}\n", message),
        }
    }

    pub fn render_stat_line(&self, label: &str, value: &str) -> String {
        match self.format {
            OutputFormat::Json => String::new(),
            OutputFormat::Text => self.render_info(&format!("{}: {}", label, value)),
        }
    }

    pub fn render_final_completion(&self, messages: &[ChatMessage]) -> String {
        match self.format {
            OutputFormat::Json => {
                if self.verbose {
                    serde_json::to_string_pretty(messages).unwrap_or_default()
                } else {
                    // Find the last assistant message
                    let final_message = messages.iter().rev().find(|m| {
                        m.role == stakpak_shared::models::integrations::openai::Role::Assistant
                    });

                    if let Some(message) = final_message {
                        serde_json::to_string_pretty(message).unwrap_or_default()
                    } else {
                        "{}".to_string()
                    }
                }
            }
            OutputFormat::Text => {
                // if self.verbose {
                let mut output = String::new();

                // Show final assistant message
                if let Some(final_message) = messages.iter().rev().find(|m| {
                    m.role == stakpak_shared::models::integrations::openai::Role::Assistant
                }) && let Some(content) = &final_message.content
                {
                    let content_str = self.extract_content_string(content);
                   
```

### Core Architecture Module: `cli/src/commands/watch/utils.rs`
```
//! Shared utilities for autopilot commands.

use std::process::Command;

/// Check if a process is running (safe, no unsafe code).
pub fn is_process_running(pid: u32) -> bool {
    #[cfg(unix)]
    {
        // Use kill -0 to check if process exists (signal 0 just checks existence)
        Command::new("kill")
            .arg("-0")
            .arg(pid.to_string())
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }

    #[cfg(windows)]
    {
        // On Windows, use tasklist to check if process exists
        Command::new("tasklist")
            .arg("/FI")
            .arg(format!("PID eq {}", pid))
            .arg("/FO")
            .arg("CSV")
            .output()
            .map(|output| {
                let output_str = String::from_utf8_lossy(&output.stdout);
                output_str.lines().count() > 1 // More than just header line
            })
            .unwrap_or(false)
    }
}

```

### Core Architecture Module: `cli/src/utils/agent_context.rs`
```
use crate::utils::agents_md::{AgentsMdInfo, format_agents_md_for_context};
use crate::utils::apps_md::{AppsMdInfo, format_apps_md_for_context};
use crate::utils::local_context::LocalContext;
use stakpak_api::models::Skill;

#[derive(Debug, Clone)]
pub struct AgentContext {
    /// Pre-formatted local context string. Snapshotted once at construction;
    /// does not refresh on subsequent injections (by design — avoids blocking
    /// filesystem walks on every message).
    pub local_context_formatted: Option<String>,
    pub skills: Option<Vec<Skill>>,
    pub agents_md: Option<AgentsMdInfo>,
    pub apps_md: Option<AppsMdInfo>,
}

impl AgentContext {
    pub async fn from_parts(
        local_context: Option<LocalContext>,
        skills: Option<Vec<Skill>>,
        agents_md: Option<AgentsMdInfo>,
        apps_md: Option<AppsMdInfo>,
    ) -> Self {
        let local_context_formatted = if let Some(ref ctx) = local_context {
            ctx.format_display().await.ok()
        } else {
            None
        };

        Self {
            local_context_formatted,
            skills,
            agents_md,
            apps_md,
        }
    }

    pub fn update_skills(&mut self, skills: Option<Vec<Skill>>) {
        self.skills = skills;
    }

    pub fn enrich_prompt(
        &self,
        user_input: &str,
        is_first_message: bool,
        force_context: bool,
    ) -> String {
        if !is_first_message && !force_context {
            return user_input.to_string();
        }

        let mut result = user_input.to_string();

        if let Some(ref formatted) = self.local_context_formatted {
            result = format!(
                "{}\n<local_context>\n{}\n</local_context>",
                result, formatted
            );
        }

        if let Some(ref skills) = self.skills
            && !skills.is_empty()
        {
            let skills_text = format_skills(skills);
            result = format!(
                "{}\n<available_skills>\n{}\n</available_skills>",
                result, skills_text
            );
        }

        if is_first_message {
            if let Some(ref agents_md) = self.agents_md {
                let agents_text = format_agents_md_for_context(agents_md);
                result = format!("{}\n<agents_md>\n{}\n</agents_md>", result, agents_text);
            }

            if let Some(ref apps_md) = self.apps_md {
                let apps_text = format_apps_md_for_context(apps_md);
                result = format!("{}\n<apps_md>\n{}\n</apps_md>", result, apps_text);
            }
        }

        result
    }
}

fn format_skills(skills: &[Skill]) -> String {
    format!(
        "# Available Skills:\n\n{}",
        skills
            .iter()
            .map(|skill| format!("  - {}", skill.to_metadata_text()))
            .collect::<Vec<String>>()
            .join("\n")
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn make_agents_md() -> AgentsMdInfo {
        AgentsMdInfo {
            content: "## Setup\n- Run tests".to_string(),
            path: PathBuf::from("/project/AGENTS.md"),
        }
    }

    fn make_apps_md() -> AppsMdInfo {
        AppsMdInfo {
            content: "## My App\n- Port 8080".to_string(),
            path: PathBuf::from("/project/APPS.md"),
        }
    }

    fn make_skills() -> Vec<Skill> {
        vec![Skill {
            name: "skill_test_001".to_string(),
            uri: "stakpak://test/skill.md".to_string(),
            description: "Test skill".to_string(),
            source: stakpak_api::models::SkillSource::Remote {
                provider: stakpak_api::models::RemoteProvider::Rulebook {
                    visibility: stakpak_api::models::RuleBookVisibility::Public,
                },
            },
            content: None,
            tags: vec!["test".to_string()],
            license: None,
            compatibility: None,
            metadata: None,
            allowed_tools: None,
        }]
    }

    fn make_context(
        local_context_formatted: Option<&str>,
        skills: Option<Vec<Skill>>,
        agents_md: Option<AgentsMdInfo>,
        apps_md: Option<AppsMdInfo>,
    ) -> AgentContext {
        AgentContext {
            local_context_formatted: local_context_formatted.map(String::from),
            skills,
            agents_md,
            apps_md,
        }
    }

    #[test]
    fn enrich_prompt_first_message_full_context() {
        let ctx = make_context(
            Some("# System Details\n\nMachine: test"),
            Some(make_skills()),
            Some(make_agents_md()),
            Some(make_apps_md()),
        );

        let result = ctx.enrich_prompt("Hello agent", true, false);

        assert!(result.starts_with("Hello agent"));
        assert!(result.contains("<local_context>"));
        assert!(result.contains("Machine: test"));
        assert!(result.contains("<available_skills>"));
        assert!(result.contains("Test skill"));
        assert!(result.contains("<agents_md>"));
        assert!(result.contains("<apps_md>"));
    }

    #[test]
    fn enrich_prompt_not_first_message_returns_unchanged() {
        let ctx = make_context(
            Some("# System Details"),
            Some(make_skills()),
            Some(make_agents_md()),
            Some(make_apps_md()),
        );

        let result = ctx.enrich_prompt("Follow-up question", false, false);
        assert_eq!(result, "Follow-up question");
    }

    #[test]
    fn enrich_prompt_force_context_injects_local_and_skills_only() {
        let ctx = make_context(
            Some("# System Details\n\nMachine: test"),
            Some(make_skills()),
            Some(make_agents_md()),
            Some(make_apps_md()),
        );

        let result = ctx.enrich_prompt("Updated question", false, true);

        assert!(result.contains("<local_context>"));
        assert!(result.contains("<available_skills>"));
        assert!(!result.contains("<agents_md>"));
        assert!(!result.contains("<apps_md>"));
    }

    #[test]
    fn enrich_prompt_empty_context_returns_input_unchanged() {
        let ctx = make_context(None, None, None, None);
        let result = ctx.enrich_prompt("Hello", true, false);
        assert_eq!(result, "Hello");
    }

    #[test]
    fn enrich_prompt_skips_empty_skills_block() {
        let ctx = make_context(None, Some(vec![]), None, None);
        let result = ctx.enrich_prompt("Hello", true, false);
        assert_eq!(result, "Hello");
    }

    #[test]
    fn update_skills_replaces_skills() {
        let mut ctx = make_context(None, None, None, None);
        assert!(ctx.skills.is_none());

        ctx.update_skills(Some(make_skills()));
        assert!(ctx.skills.is_some());
    }
}

```

### Core Architecture Module: `cli/src/utils/agents_md.rs`
```
use std::fs;
use std::path::{Path, PathBuf};

/// Maximum number of parent directories to traverse when searching for AGENTS.md
const MAX_TRAVERSAL_DEPTH: usize = 5;

/// Information about a discovered AGENTS.md file
#[derive(Debug, Clone)]
pub struct AgentsMdInfo {
    pub content: String,
    pub path: PathBuf,
}

/// Discovers and reads AGENTS.md file from the given directory upward (up to 5 levels).
/// Returns the nearest AGENTS.md found (closest to start_dir wins per spec).
///
/// Search order at each directory level:
/// 1. AGENTS.md (canonical)
/// 2. agents.md (lowercase variant)
pub fn discover_agents_md(start_dir: &Path) -> Option<AgentsMdInfo> {
    let mut current = start_dir.to_path_buf();

    for _ in 0..=MAX_TRAVERSAL_DEPTH {
        // Check canonical AGENTS.md first
        let agents_file = current.join("AGENTS.md");
        if agents_file.exists()
            && let Ok(content) = fs::read_to_string(&agents_file)
        {
            return Some(AgentsMdInfo {
                content,
                path: agents_file,
            });
        }

        // Check lowercase variant
        let agents_file_lower = current.join("agents.md");
        if agents_file_lower.exists()
            && let Ok(content) = fs::read_to_string(&agents_file_lower)
        {
            return Some(AgentsMdInfo {
                content,
                path: agents_file_lower,
            });
        }

        // Move up to parent directory
        if !current.pop() {
            break;
        }
    }

    None
}

/// Format AGENTS.md content for context injection
pub fn format_agents_md_for_context(info: &AgentsMdInfo) -> String {
    format!(
        "# AGENTS.md (from {})\n\n{}",
        info.path.display(),
        info.content.trim()
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn test_discover_agents_md_in_current_dir() {
        let temp_dir = TempDir::new().unwrap();
        let agents_path = temp_dir.path().join("AGENTS.md");
        let mut file = File::create(&agents_path).unwrap();
        writeln!(file, "# Test AGENTS.md\n\nSome content").unwrap();

        let result = discover_agents_md(temp_dir.path());
        assert!(result.is_some());
        let info = result.unwrap();
        assert!(info.content.contains("Test AGENTS.md"));
        assert_eq!(info.path, agents_path);
    }

    #[test]
    fn test_discover_agents_md_in_parent_dir() {
        let temp_dir = TempDir::new().unwrap();
        let agents_path = temp_dir.path().join("AGENTS.md");
        let mut file = File::create(&agents_path).unwrap();
        writeln!(file, "# Parent AGENTS.md").unwrap();

        let child_dir = temp_dir.path().join("subdir");
        fs::create_dir(&child_dir).unwrap();

        let result = discover_agents_md(&child_dir);
        assert!(result.is_some());
        let info = result.unwrap();
        assert!(info.content.contains("Parent AGENTS.md"));
    }

    #[test]
    fn test_discover_agents_md_lowercase() {
        let temp_dir = TempDir::new().unwrap();
        let agents_path = temp_dir.path().join("agents.md");
        let mut file = File::create(&agents_path).unwrap();
        writeln!(file, "# Lowercase agents.md").unwrap();

        let result = discover_agents_md(temp_dir.path());
        assert!(result.is_some());
        let info = result.unwrap();
        assert!(info.content.contains("Lowercase agents.md"));
    }

    #[test]
    fn test_discover_agents_md_canonical_takes_precedence() {
        let temp_dir = TempDir::new().unwrap();

        // Create canonical AGENTS.md
        let canonical = temp_dir.path().join("AGENTS.md");
        let mut file = File::create(&canonical).unwrap();
        writeln!(file, "# Canonical").unwrap();

        // On case-insensitive filesystems (macOS, Windows), creating agents.md
        // would overwrite AGENTS.md. So we just verify that AGENTS.md is found
        // when it exists (the precedence logic works on case-sensitive systems).
        let result = discover_agents_md(temp_dir.path());
        assert!(result.is_some());
        let info = result.unwrap();
        // Should find the file we created
        assert!(info.content.contains("Canonical"));
    }

    #[test]
    fn test_discover_agents_md_not_found() {
        let temp_dir = TempDir::new().unwrap();
        let result = discover_agents_md(temp_dir.path());
        assert!(result.is_none());
    }

    #[test]
    fn test_discover_agents_md_respects_max_depth() {
        let temp_dir = TempDir::new().unwrap();

        // Create AGENTS.md 7 levels up — should NOT be found (max depth is 5)
        let agents_path = temp_dir.path().join("AGENTS.md");
        let mut file = File::create(&agents_path).unwrap();
        writeln!(file, "# Too far AGENTS.md").unwrap();

        let deep_dir = temp_dir
            .path()
            .join("a")
            .join("b")
            .join("c")
            .join("d")
            .join("e")
            .join("f")
            .join("g");
        fs::create_dir_all(&deep_dir).unwrap();

        let result = discover_agents_md(&deep_dir);
        if let Some(info) = result {
            assert!(
                !info.content.contains("Too far"),
                "Should not discover AGENTS.md beyond max traversal depth"
            );
        }
    }

    #[test]
    fn test_discover_agents_md_within_max_depth() {
        let temp_dir = TempDir::new().unwrap();

        // Create AGENTS.md 5 levels up — should be found
        let agents_path = temp_dir.path().join("AGENTS.md");
        let mut file = File::create(&agents_path).unwrap();
        writeln!(file, "# Reachable AGENTS.md").unwrap();

        let deep_dir = temp_dir
            .path()
            .join("a")
            .join("b")
            .join("c")
            .join("d")
            .join("e");
        fs::create_dir_all(&deep_dir).unwrap();

        let result = discover_agents_md(&deep_dir);
        assert!(result.is_some());
        assert!(
            result.unwrap().content.contains("Reachable"),
            "Should discover AGENTS.md within max traversal depth"
        );
    }

    #[test]
    fn test_format_agents_md_for_context() {
        let info = AgentsMdInfo {
            content: "## Setup\n- Run tests".to_string(),
            path: PathBuf::from("/project/AGENTS.md"),
        };

        let formatted = format_agents_md_for_context(&info);
        assert!(formatted.contains("# AGENTS.md (from /project/AGENTS.md)"));
        assert!(formatted.contains("## Setup"));
        assert!(formatted.contains("- Run tests"));
    }
}

```

### Core Architecture Module: `cli/src/utils/apps_md.rs`
```
use std::fs;
use std::path::{Path, PathBuf};

/// Maximum number of parent directories to traverse when searching for APPS.md
const MAX_TRAVERSAL_DEPTH: usize = 5;

/// Information about a discovered APPS.md file
#[derive(Debug, Clone)]
pub struct AppsMdInfo {
    pub content: String,
    pub path: PathBuf,
}

/// Discovers and reads the nearest APPS.md file from the given directory upward
/// (up to 3 parent levels), falling back to the global `~/.stakpak/APPS.md`.
///
/// Returns the first (nearest) APPS.md found. Closest to start_dir wins.
///
/// Search order at each directory level:
/// 1. APPS.md (canonical)
/// 2. apps.md (lowercase variant)
///
/// If nothing found within 3 levels:
/// 3. ~/.stakpak/APPS.md (global fallback)
pub fn discover_apps_md(start_dir: &Path) -> Option<AppsMdInfo> {
    let mut current = start_dir.to_path_buf();

    for _ in 0..=MAX_TRAVERSAL_DEPTH {
        // Check canonical APPS.md first
        let apps_file = current.join("APPS.md");
        if apps_file.exists()
            && let Ok(content) = fs::read_to_string(&apps_file)
        {
            return Some(AppsMdInfo {
                content,
                path: apps_file.canonicalize().unwrap_or(apps_file),
            });
        }

        // Check lowercase variant
        let apps_file_lower = current.join("apps.md");
        if apps_file_lower.exists()
            && let Ok(content) = fs::read_to_string(&apps_file_lower)
        {
            return Some(AppsMdInfo {
                content,
                path: apps_file_lower.canonicalize().unwrap_or(apps_file_lower),
            });
        }

        // Move up to parent directory
        if !current.pop() {
            break;
        }
    }

    // Fall back to global ~/.stakpak/APPS.md
    if let Some(home) = std::env::home_dir() {
        let global_apps = home.join(".stakpak").join("APPS.md");
        if global_apps.exists()
            && let Ok(content) = fs::read_to_string(&global_apps)
        {
            return Some(AppsMdInfo {
                content,
                path: global_apps.canonicalize().unwrap_or(global_apps),
            });
        }
    }

    None
}

/// Format APPS.md content for context injection
pub fn format_apps_md_for_context(info: &AppsMdInfo) -> String {
    format!(
        "# APPS.md (from {})\n\n{}",
        info.path.display(),
        info.content.trim()
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn test_discover_apps_md_in_current_dir() {
        let temp_dir = TempDir::new().unwrap();
        let apps_path = temp_dir.path().join("APPS.md");
        let mut file = File::create(&apps_path).unwrap();
        writeln!(file, "# Test APPS.md\n\nSome content").unwrap();

        let result = discover_apps_md(temp_dir.path());
        assert!(result.is_some());
        let info = result.unwrap();
        assert!(info.content.contains("Test APPS.md"));
        assert_eq!(info.path, apps_path.canonicalize().unwrap());
    }

    #[test]
    fn test_discover_apps_md_in_parent_dir() {
        let temp_dir = TempDir::new().unwrap();
        let apps_path = temp_dir.path().join("APPS.md");
        let mut file = File::create(&apps_path).unwrap();
        writeln!(file, "# Parent APPS.md").unwrap();

        let child_dir = temp_dir.path().join("subdir");
        fs::create_dir(&child_dir).unwrap();

        let result = discover_apps_md(&child_dir);
        assert!(result.is_some());
        let info = result.unwrap();
        assert!(info.content.contains("Parent APPS.md"));
    }

    #[test]
    fn test_discover_apps_md_lowercase() {
        let temp_dir = TempDir::new().unwrap();
        let apps_path = temp_dir.path().join("apps.md");
        let mut file = File::create(&apps_path).unwrap();
        writeln!(file, "# Lowercase apps.md").unwrap();

        let result = discover_apps_md(temp_dir.path());
        assert!(result.is_some());
        let info = result.unwrap();
        assert!(info.content.contains("Lowercase apps.md"));
    }

    #[test]
    fn test_discover_apps_md_respects_max_depth() {
        let temp_dir = TempDir::new().unwrap();

        // Create APPS.md 7 levels up — should NOT be found (max depth is 5)
        let apps_path = temp_dir.path().join("APPS.md");
        let mut file = File::create(&apps_path).unwrap();
        writeln!(file, "# Too far APPS.md").unwrap();

        let deep_dir = temp_dir
            .path()
            .join("a")
            .join("b")
            .join("c")
            .join("d")
            .join("e")
            .join("f")
            .join("g");
        fs::create_dir_all(&deep_dir).unwrap();

        let result = discover_apps_md(&deep_dir);
        // Should not find the APPS.md that is 7 levels up
        if let Some(info) = result {
            assert!(
                !info.content.contains("Too far"),
                "Should not discover APPS.md beyond max traversal depth"
            );
        }
    }

    #[test]
    fn test_discover_apps_md_within_max_depth() {
        let temp_dir = TempDir::new().unwrap();

        // Create APPS.md 5 levels up — should be found
        let apps_path = temp_dir.path().join("APPS.md");
        let mut file = File::create(&apps_path).unwrap();
        writeln!(file, "# Reachable APPS.md").unwrap();

        let deep_dir = temp_dir
            .path()
            .join("a")
            .join("b")
            .join("c")
            .join("d")
            .join("e");
        fs::create_dir_all(&deep_dir).unwrap();

        let result = discover_apps_md(&deep_dir);
        assert!(result.is_some());
        assert!(
            result.unwrap().content.contains("Reachable"),
            "Should discover APPS.md within max traversal depth"
        );
    }

    #[test]
    fn test_discover_apps_md_nearest_wins() {
        let temp_dir = TempDir::new().unwrap();

        // Create APPS.md at root
        let root_apps = temp_dir.path().join("APPS.md");
        let mut file = File::create(&root_apps).unwrap();
        writeln!(file, "# Root APPS.md").unwrap();

        // Create APPS.md in child
        let child_dir = temp_dir.path().join("child");
        fs::create_dir(&child_dir).unwrap();
        let child_apps = child_dir.join("APPS.md");
        let mut file = File::create(&child_apps).unwrap();
        writeln!(file, "# Child APPS.md").unwrap();

        let result = discover_apps_md(&child_dir);
        assert!(result.is_some());
        let info = result.unwrap();
        // Nearest (child) should win
        assert!(info.content.contains("Child APPS.md"));
        assert_eq!(info.path, child_apps.canonicalize().unwrap());
    }

    #[test]
    fn test_discover_apps_md_not_found() {
        let temp_dir = TempDir::new().unwrap();
        let result = discover_apps_md(temp_dir.path());
        // May find global ~/.stakpak/APPS.md if it exists, otherwise None
        if let Some(info) = result {
            assert!(
                info.path.to_string_lossy().contains(".stakpak"),
                "Should only find global APPS.md (if any)"
            );
        }
    }

    #[test]
    fn test_discover_apps_md_canonical_takes_precedence() {
        let temp_dir = TempDir::new().unwrap();

        // Create canonical APPS.md
        let canonical = temp_dir.path().join("APPS.md");
        let mut file = File::create(&canonical).unwrap();
        writeln!(file, "# Canonical").unwrap();

        // On case-insensitive filesystems (macOS, Windows), creating apps.md
        // would overwrite APPS.md. So we just verify that APPS.md is found
        // when it exists (the precedence logic works on case-sensitive systems).
        let result = discover_apps_md(temp_dir.path());
        assert!(result.is_some());
        assert!(result.unwrap().content.contains("Canonical"));
    }

    #[test]
    fn test_format_apps_md_for_context() {
        let info = AppsMdInfo {
            content: "## My App\n- Port 8080".to_string(),
            path: PathBuf::from("/project/APPS.md"),
        };

        let formatted = format_apps_md_for_context(&info);
        assert!(formatted.contains("# APPS.md (from /project/APPS.md)"));
        assert!(formatted.contains("## My App"));
        assert!(formatted.contains("- Port 8080"));
    }
}

```

### Core Architecture Module: `cli/src/utils/check_update.rs`
```
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use semver::Version;
use serde::Deserialize;
use stakpak_shared::tls_client::{TlsClientConfig, create_tls_client};
use std::error::Error;
use std::future::Future;

use crate::commands::auto_update::run_auto_update;
use crate::utils::cli_colors::CliColors;

/// Parse version string (with or without 'v' prefix) into semver Version
fn parse_version(version_str: &str) -> Option<Version> {
    let cleaned = version_str.strip_prefix('v').unwrap_or(version_str);
    Version::parse(cleaned).ok()
}

/// Check if remote version is newer than current version using semver
pub(crate) fn is_newer_version(current: &str, remote: &str) -> bool {
    match (parse_version(current), parse_version(remote)) {
        (Some(current_ver), Some(remote_ver)) => remote_ver > current_ver,
        // If parsing fails, fall back to string comparison (shouldn't happen with valid versions)
        _ => current != remote,
    }
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
pub struct LatestRelease {
    pub tag_name: String,
    pub name: String,
    pub published_at: String,
    pub html_url: String,
    pub prerelease: bool,
    pub draft: bool,
    pub body: Option<String>,
}

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
pub struct ReleaseResponse {
    pub repository: String,
    pub stargazers_count: u64,
    pub latest_release: LatestRelease,
    pub cached_at: String,
    pub expires_at: String,
}

fn format_changelog(body: &str) -> String {
    let mut output = String::new();
    let lines: Vec<&str> = body.lines().collect();
    let mut i = 0;
    let mut is_first_section = true;

    let magenta = CliColors::magenta();
    let text = CliColors::text();
    let reset = CliColors::reset();

    while i < lines.len() {
        let trimmed_line = lines[i].trim();

        // Skip version header (## 0.3.1)
        if trimmed_line.starts_with("## ") {
            i += 1;
            continue;
        }

        // Skip "Released on" line
        if trimmed_line.starts_with("Released on") {
            i += 1;
            continue;
        }

        // Handle section headers (### Features, ### Maintenance, etc.)
        if trimmed_line.starts_with("### ") {
            let section_name = trimmed_line.strip_prefix("### ").unwrap_or("").trim();
            if !section_name.is_empty() {
                if !is_first_section {
                    output.push('\n');
                }
                // Ensure consistent indentation: exactly 2 spaces before bullet
                output.push_str("  ");
                output.push_str(magenta);
                output.push_str("● ");
                output.push_str(section_name);
                output.push(':');
                output.push_str(reset);
                output.push('\n');
                is_first_section = false;
            }
            i += 1;
            continue;
        }

        // Handle list items (- item)
        if trimmed_line.starts_with("- ") {
            let item = trimmed_line.strip_prefix("- ").unwrap_or("").trim();
            if !item.is_empty() {
                output.push_str("    ");
                output.push_str(text);
                output.push('•');
                output.push(' ');
                output.push_str(item);
                output.push_str(reset);
                output.push('\n');
            }
            i += 1;
            continue;
        }

        // Skip empty lines
        if trimmed_line.is_empty() {
            i += 1;
            continue;
        }

        // Handle other content as regular text
        output.push_str("  ");
        output.push_str(text);
        output.push_str(trimmed_line);
        output.push_str(reset);
        output.push('\n');

        i += 1;
    }
    output.trim_end().to_string()
}

pub async fn check_update(current_version: &str) -> Result<(), Box<dyn Error>> {
    let release = get_latest_release().await?;
    if is_newer_version(current_version, &release.tag_name) {
        let blue = CliColors::blue();
        let cyan = CliColors::cyan();
        let yellow = CliColors::yellow();
        let green = CliColors::green();
        let magenta = CliColors::magenta();
        let text = CliColors::text();
        let reset = CliColors::reset();

        let sep = format!("{}═{}", magenta, reset).repeat(40);
        println!("\n{}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓{}", blue, reset);
        println!(
            "{}┃{}{}⮕ {} Version Update Available!{}{}┃{}",
            blue, reset, cyan, text, reset, blue, reset
        );
        println!("{}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛{}", blue, reset);
        println!(
            "{} {}{}{} → {}{}{}",
            text, yellow, current_version, reset, green, release.tag_name, reset
        );
        println!("{}", sep);

        if let Some(body) = &release.body
            && !body.trim().is_empty()
        {
            println!("{} What's new in this update:{}", text, reset);
            println!("{}", sep);
            let changelog = format_changelog(body);
            println!("{}", changelog);
            println!("{}", sep);
            println!(
                "{} View full changelog: {}{}{}{}",
                text, reset, cyan, release.html_url, reset
            );
            println!("{}", sep);
        }

        println!(
            "{} Upgrade to access the latest features! 🚀{}",
            text, reset
        );
        println!("{}", sep);
    }

    Ok(())
}

pub async fn get_latest_release() -> Result<LatestRelease, Box<dyn Error>> {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("update-checker"));

    let client = create_tls_client(TlsClientConfig::default().with_headers(headers))?;

    let url = "https://apiv2.stakpak.dev/github/releases".to_string();

    let response = client.get(&url).send().await?;

    if !response.status().is_success() {
        return Err("Failed to fetch release info".into());
    }

    let release_response: ReleaseResponse = response.json().await?;
    Ok(release_response.latest_release)
}

pub async fn get_latest_cli_version() -> Result<String, Box<dyn Error>> {
    let release = get_latest_release().await?;
    Ok(release.tag_name)
}

async fn run_auto_update_if_newer<F, Fut>(
    current_version: &str,
    release: &LatestRelease,
    run_update: F,
) -> Result<bool, String>
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<(), String>>,
{
    if is_newer_version(current_version, &release.tag_name) {
        run_update().await?;
        return Ok(true);
    }

    Ok(false)
}

/// Force auto-update without prompting (for ACP mode).
/// Returns true if an update was performed and the process should restart.
pub async fn force_auto_update() -> Result<bool, Box<dyn Error>> {
    let release = get_latest_release().await?;
    let current_version = format!("v{}", env!("CARGO_PKG_VERSION"));
    if is_newer_version(&current_version, &release.tag_name) {
        eprintln!(
            "🔄 Updating Stakpak: {} → {} ...",
            current_version, release.tag_name
        );
    }

    run_auto_update_if_newer(&current_version, &release, || async {
        run_auto_update(true).await
    })
    .await
    .map_err(std::io::Error::other)
    .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    };

    fn release(tag_name: &str) -> LatestRelease {
        LatestRelease {
            tag_name: tag_name.to_string(),
            name: format!("Stakpak {tag_name}"),
            published_at: "2026-01-01T00:00:00Z".to_string(),
            html_url: "https://github.com/stakpak/agent/releases/latest".to_string(),
            prerelease: false,
            draft: false,
            body: Some("### Features\n- Faster updates".to_string()),
        }
    }

    #[tokio::test]
    async fn auto_update_runs_updater_when_release_is_newer() {
        let invoked = Arc::new(AtomicBool::new(false));
        let invoked_clone = Arc::clone(&invoked);

        let updated = run_auto_update_if_newer("v0.3.78", &release("v9.9.9"), || {
            invoked_clone.store(true, Ordering::SeqCst);
            async { Ok::<(), String>(()) }
        })
        .await
        .expect("auto update succeeds");

        assert!(updated);
        assert!(invoked.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn auto_update_skips_updater_when_release_is_not_newer() {
        let invoked = Arc::new(AtomicBool::new(false));
        let invoked_clone = Arc::clone(&invoked);

        let updated = run_auto_update_if_newer("v9.9.9", &release("v9.9.9"), || {
            invoked_clone.store(true, Ordering::SeqCst);
            async { Ok::<(), String>(()) }
        })
        .await
        .expect("auto update succeeds");

        assert!(!updated);
        assert!(!invoked.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn auto_update_logic_is_non_interactive() {
        let result = tokio::time::timeout(
            std::time::Duration::from_millis(100),
            run_auto_update_if_newer("v0.3.78", &release("v9.9.9"), || async {
                Ok::<(), String>(())
            }),
        )
        .await;

        assert!(
            result.is_ok(),
            "auto-update logic should not wait for stdin"
        );
        let update_result = result.expect("timeout result");
        assert!(update_result.is_ok(), "auto-update logic should succeed");
    }
}

```

### Core Architecture Module: `cli/src/utils/cli_colors.rs`
```
//! Theme-aware CLI colors for terminal output
//!
//! Provides ANSI escape codes that adapt to light/dark terminal backgrounds.
//! Delegates theme detection to stakpak_shared::terminal_theme for consistency
//! with the TUI crate.

/// Check if terminal is in light mode (delegates to shared detection)
pub fn is_light_mode() -> bool {
    stakpak_shared::terminal_theme::is_light_mode()
}

/// Theme-aware ANSI color codes for CLI output
pub struct CliColors;

impl CliColors {
    // ==========================================================================
    // Primary colors - adapt based on terminal background
    // ==========================================================================

    /// Yellow - for titles, warnings, active items
    /// Dark mode: bright yellow, Light mode: dark gold/orange
    pub fn yellow() -> &'static str {
        if is_light_mode() {
            "\x1b[38;5;136m" // Dark gold (ANSI 256 color 136)
        } else {
            "\x1b[1;33m" // Bright yellow
        }
    }

    /// Cyan - for borders, accents, selected items
    /// Dark mode: bright cyan, Light mode: dark cyan/teal
    pub fn cyan() -> &'static str {
        if is_light_mode() {
            "\x1b[38;5;30m" // Dark cyan (ANSI 256 color 30)
        } else {
            "\x1b[1;36m" // Bright cyan
        }
    }

    /// Green - for success, completed steps
    /// Dark mode: bright green, Light mode: dark green
    pub fn green() -> &'static str {
        if is_light_mode() {
            "\x1b[38;5;28m" // Dark green (ANSI 256 color 28)
        } else {
            "\x1b[1;32m" // Bright green
        }
    }

    /// Red - for errors
    /// Dark mode: bright red, Light mode: dark red
    pub fn red() -> &'static str {
        if is_light_mode() {
            "\x1b[38;5;160m" // Dark red (ANSI 256 color 160)
        } else {
            "\x1b[1;31m" // Bright red
        }
    }

    /// Magenta - for info messages, highlights
    /// Dark mode: bright magenta, Light mode: dark magenta
    pub fn magenta() -> &'static str {
        if is_light_mode() {
            "\x1b[38;5;127m" // Dark magenta (ANSI 256 color 127)
        } else {
            "\x1b[1;35m" // Bright magenta
        }
    }

    /// Blue - for links, info
    /// Dark mode: bright blue, Light mode: dark blue
    pub fn blue() -> &'static str {
        if is_light_mode() {
            "\x1b[38;5;25m" // Dark blue (ANSI 256 color 25)
        } else {
            "\x1b[1;34m" // Bright blue
        }
    }

    /// White/primary text - main content
    /// Dark mode: bright white, Light mode: dark gray
    pub fn text() -> &'static str {
        if is_light_mode() {
            "\x1b[38;5;235m" // Very dark gray (ANSI 256 color 235)
        } else {
            "\x1b[1;37m" // Bright white
        }
    }

    /// Gray - for secondary/inactive text
    /// Dark mode: dark gray, Light mode: medium gray
    pub fn gray() -> &'static str {
        if is_light_mode() {
            "\x1b[38;5;243m" // Medium gray (ANSI 256 color 243)
        } else {
            "\x1b[90m" // Dark gray
        }
    }

    /// Orange - for special highlights
    /// Dark mode: bright orange, Light mode: dark orange
    pub fn orange() -> &'static str {
        if is_light_mode() {
            "\x1b[38;5;166m" // Dark orange (ANSI 256 color 166)
        } else {
            "\x1b[38;5;214m" // Bright orange (ANSI 256 color 214)
        }
    }

    /// Reset - return to default terminal colors
    pub fn reset() -> &'static str {
        "\x1b[0m"
    }

    /// Bold modifier (for future use)
    #[allow(dead_code)]
    pub fn bold() -> &'static str {
        "\x1b[1m"
    }
}

/// Crossterm Color equivalents for use with crossterm::style
pub mod crossterm_colors {
    use crossterm::style::Color;

    /// Check if terminal is in light mode
    pub fn is_light_mode() -> bool {
        super::is_light_mode()
    }

    /// Theme-aware cyan color
    pub fn cyan() -> Color {
        if is_light_mode() {
            Color::AnsiValue(30) // Dark cyan
        } else {
            Color::Cyan
        }
    }

    /// Theme-aware green color
    pub fn green() -> Color {
        if is_light_mode() {
            Color::AnsiValue(28) // Dark green
        } else {
            Color::Green
        }
    }

    /// Theme-aware yellow color
    pub fn yellow() -> Color {
        if is_light_mode() {
            Color::AnsiValue(136) // Dark gold
        } else {
            Color::Yellow
        }
    }

    /// Theme-aware magenta color
    pub fn magenta() -> Color {
        if is_light_mode() {
            Color::AnsiValue(127) // Dark magenta
        } else {
            Color::Magenta
        }
    }

    /// Theme-aware white/text color
    pub fn white() -> Color {
        if is_light_mode() {
            Color::AnsiValue(235) // Very dark gray
        } else {
            Color::White
        }
    }

    /// Theme-aware gray color
    pub fn gray() -> Color {
        if is_light_mode() {
            Color::AnsiValue(243) // Medium gray
        } else {
            Color::DarkGrey
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_colors_return_valid_ansi() {
        // All color functions should return valid ANSI escape sequences
        assert!(CliColors::yellow().starts_with("\x1b["));
        assert!(CliColors::cyan().starts_with("\x1b["));
        assert!(CliColors::green().starts_with("\x1b["));
        assert!(CliColors::red().starts_with("\x1b["));
        assert!(CliColors::magenta().starts_with("\x1b["));
        assert!(CliColors::blue().starts_with("\x1b["));
        assert!(CliColors::text().starts_with("\x1b["));
        assert!(CliColors::gray().starts_with("\x1b["));
        assert!(CliColors::reset().starts_with("\x1b["));
    }

    #[test]
    fn test_reset_code() {
        assert_eq!(CliColors::reset(), "\x1b[0m");
    }
}

```

### Core Architecture Module: `cli/src/utils/discovery/cloud_accounts.rs`
```
use std::fmt::Write;
use std::path::{Path, PathBuf};

/// Discover cloud account configurations by reading config files directly.
/// No CLI calls — pure filesystem reads for speed. Cross-platform.
pub fn discover() -> String {
    let mut out = String::with_capacity(2048);

    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return "(cannot determine home directory)\n".to_string(),
    };

    discover_aws(&home, &mut out);
    discover_gcp(&home, &mut out);
    discover_azure(&home, &mut out);
    discover_kubernetes(&home, &mut out);
    discover_docker_registries(&home, &mut out);
    discover_other_platforms(&home, &mut out);

    if out.is_empty() {
        return "(no cloud account configurations found)\n".to_string();
    }
    out
}

/// Parse AWS config/credentials to enumerate profiles, then call
/// `aws sts get-caller-identity` per profile (in parallel) to get
/// definitive account IDs and validate credentials are live.
fn discover_aws(home: &Path, out: &mut String) {
    let config_path = home.join(".aws/config");
    let creds_path = home.join(".aws/credentials");

    if !config_path.exists() && !creds_path.exists() {
        return;
    }

    let _ = writeln!(out, "### AWS\n");

    // Step 1: Parse config file for profile metadata
    let mut profiles: Vec<AwsProfile> = Vec::new();

    if let Ok(content) = std::fs::read_to_string(&config_path) {
        let mut current_name: Option<String> = None;
        let mut region: Option<String> = None;
        let mut sso_url: Option<String> = None;
        let mut role_arn: Option<String> = None;
        let mut source_profile: Option<String> = None;
        let mut sso_account_id: Option<String> = None;

        let flush = |profiles: &mut Vec<AwsProfile>,
                     name: &Option<String>,
                     region: &Option<String>,
                     sso_url: &Option<String>,
                     role_arn: &Option<String>,
                     source_profile: &Option<String>,
                     sso_account_id: &Option<String>| {
            if let Some(n) = name {
                let method = if sso_url.is_some() {
                    "SSO"
                } else if role_arn.is_some() {
                    "assume-role"
                } else {
                    "credentials"
                };
                profiles.push(AwsProfile {
                    name: n.clone(),
                    method: method.to_string(),
                    region: region.clone(),
                    role_arn: role_arn.clone(),
                    source_profile: source_profile.clone(),
                    sso_account_id: sso_account_id.clone(),
                    // Will be filled by sts call
                    live_account_id: None,
                    live_arn: None,
                    auth_ok: None,
                });
            }
        };

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('[') && trimmed.ends_with(']') {
                flush(
                    &mut profiles,
                    &current_name,
                    &region,
                    &sso_url,
                    &role_arn,
                    &source_profile,
                    &sso_account_id,
                );
                let section = &trimmed[1..trimmed.len() - 1];
                current_name = Some(
                    section
                        .strip_prefix("profile ")
                        .unwrap_or(section)
                        .to_string(),
                );
                region = None;
                sso_url = None;
                role_arn = None;
                source_profile = None;
                sso_account_id = None;
            } else if let Some((key, value)) = trimmed.split_once('=') {
                let key = key.trim();
                let value = value.trim();
                match key {
                    "region" => region = Some(value.to_string()),
                    "sso_start_url" => sso_url = Some(value.to_string()),
                    "role_arn" => role_arn = Some(value.to_string()),
                    "source_profile" => source_profile = Some(value.to_string()),
                    "sso_account_id" => sso_account_id = Some(value.to_string()),
                    _ => {}
                }
            }
        }
        flush(
            &mut profiles,
            &current_name,
            &region,
            &sso_url,
            &role_arn,
            &source_profile,
            &sso_account_id,
        );
    }

    // Step 2: Call `aws sts get-caller-identity --profile X --output json` per profile in parallel
    if which::which("aws").is_ok() && !profiles.is_empty() {
        use std::thread;

        let handles: Vec<_> = profiles
            .iter()
            .map(|p| {
                let name = p.name.clone();
                thread::spawn(move || {
                    let output = std::process::Command::new("aws")
                        .args([
                            "sts",
                            "get-caller-identity",
                            "--profile",
                            &name,
                            "--output",
                            "json",
                        ])
                        .output();
                    (name, output)
                })
            })
            .collect();

        for handle in handles {
            if let Ok((name, output)) = handle.join()
                && let Some(profile) = profiles.iter_mut().find(|p| p.name == name)
            {
                match output {
                    Ok(o) if o.status.success() => {
                        let stdout = String::from_utf8_lossy(&o.stdout);
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                            profile.live_account_id = json
                                .get("Account")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());
                            profile.live_arn = json
                                .get("Arn")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());
                        }
                        profile.auth_ok = Some(true);
                    }
                    _ => {
                        profile.auth_ok = Some(false);
                    }
                }
            }
        }
    }

    // Step 3: Format output
    for p in &profiles {
        // Best account ID: live > sso_account_id > extracted from role_arn
        let extracted_from_arn = p
            .role_arn
            .as_ref()
            .and_then(|arn| extract_account_from_arn(arn));
        let account_id = p
            .live_account_id
            .as_ref()
            .or(p.sso_account_id.as_ref())
            .or(extracted_from_arn.as_ref());

        let _ = write!(out, "- Profile: {}  method:{}", p.name, p.method);
        if let Some(acct) = account_id {
            let _ = write!(out, "  account:{}", acct);
        }
        if let Some(r) = &p.region {
            let _ = write!(out, "  region:{}", r);
        }
        if let Some(arn) = &p.live_arn {
            let _ = write!(out, "  arn:{}", arn);
        }
        if let Some(role) = &p.role_arn {
            let _ = write!(out, "  role:{}", role);
        }
        if let Some(src) = &p.source_profile {
            let _ = write!(out, "  source:{}", src);
        }
        match p.auth_ok {
            Some(true) => {
                let _ = write!(out, "  status:✓");
            }
            Some(false) => {
                let _ = write!(out, "  status:✗ auth-failed");
            }
            None => {} // aws CLI not available, don't show status
        }
        let _ = writeln!(out);
    }

    // Check env vars
    if let Ok(profile) = std::env::var("AWS_PROFILE") {
        let _ = writeln!(out, "- ENV: AWS_PROFILE={}", profile);
    }
    if let Ok(region) = std::env::var("AWS_REGION") {
        let _ = writeln!(out, "- ENV: AWS_REGION={}", region);
    }
    if let Ok(region) = std::env::var("AWS_DEFAULT_REGION") {
        let _ = writeln!(out, "- ENV: AWS_DEFAULT_REGION={}", region);
    }
    out.push('\n');
}

struct AwsProfile {
    name: String,
    method: String,
    region: Option<String>,
    role_arn: Option<String>,
    source_profile: Option<String>,
    sso_account_id: Option<String>,
    live_account_id: Option<String>,
    live_arn: Option<String>,
    auth_ok: Option<bool>,
}

/// Parse GCP config to enumerate projects and configurations.
fn discover_gcp(home: &Path, out: &mut String) {
    let gcloud_dir = home.join(".config/gcloud");
    if !gcloud_dir.exists() {
        return;
    }

    let _ = writeln!(out, "### GCP\n");

    // Read active config
    let active_config = gcloud_dir.join("active_config");
    let active = std::fs::read_to_string(&active_config)
        .ok()
        .map(|s| s.trim().to_string());

    if let Some(ref name) = active {
        let _ = writeln!(out, "- Active config: {}", name);
    }

    // Read properties from active config or default
    let configs_dir = gcloud_dir.join("configurations");
    if configs_dir.exists()
        && let Ok(entries) = std::fs::read_dir(&configs_dir)
    {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("config_") {
                continue;
            }
            let config_name = name.strip_prefix("config_").unwrap_or(&name);
            if let Ok(content) = std::fs::read_to_string(entry.path()) {
                let project = extract_ini_value(&content, "project");
                let account = extract_ini_value(&content, "account");
                let region = extract_ini_value(&content, "region");
                let 
```

### Core Architecture Module: `cli/src/utils/discovery/crontabs.rs`
```
use std::fmt::Write;
use std::process::Command;

/// Discover cron jobs / scheduled tasks for the current user.
/// Linux/macOS: parse crontab. macOS also checks launchd. Windows: schtasks.
pub fn discover() -> String {
    let os = std::env::consts::OS;
    match os {
        "linux" => discover_linux(),
        "macos" => discover_macos(),
        "windows" => discover_windows(),
        _ => discover_linux(), // best effort
    }
}

fn discover_linux() -> String {
    let mut out = String::with_capacity(512);

    // User crontab
    if let Ok(output) = Command::new("crontab").arg("-l").output()
        && output.status.success()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let jobs: Vec<&str> = stdout
            .lines()
            .filter(|l| !l.trim().is_empty() && !l.trim().starts_with('#'))
            .collect();
        if !jobs.is_empty() {
            let _ = writeln!(out, "### User Crontab\n");
            for job in &jobs {
                let _ = writeln!(out, "- {}", job.trim());
            }
            out.push('\n');
        }
    }

    // System cron dirs (existence check only)
    let cron_dirs = [
        "/etc/cron.d",
        "/etc/cron.daily",
        "/etc/cron.hourly",
        "/etc/cron.weekly",
        "/etc/cron.monthly",
    ];
    let mut sys_entries = Vec::new();
    for dir in &cron_dirs {
        let path = std::path::Path::new(dir);
        if path.exists()
            && let Ok(entries) = std::fs::read_dir(path)
        {
            let count = entries
                .flatten()
                .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
                .count();
            if count > 0 {
                sys_entries.push(format!("- {} ({} entries)", dir, count));
            }
        }
    }
    if !sys_entries.is_empty() {
        let _ = writeln!(out, "### System Cron Dirs\n");
        for entry in &sys_entries {
            let _ = writeln!(out, "{}", entry);
        }
        out.push('\n');
    }

    // Systemd timers
    if let Ok(output) = Command::new("systemctl")
        .args(["list-timers", "--no-pager", "--no-legend"])
        .output()
        && output.status.success()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let timers: Vec<&str> = stdout.lines().filter(|l| !l.trim().is_empty()).collect();
        if !timers.is_empty() {
            let _ = writeln!(out, "### Systemd Timers\n");
            for timer in timers.iter().take(20) {
                let _ = writeln!(out, "- {}", timer.trim());
            }
            out.push('\n');
        }
    }

    if out.is_empty() {
        "(no cron jobs or scheduled tasks found)\n".to_string()
    } else {
        out
    }
}

fn discover_macos() -> String {
    let mut out = String::with_capacity(512);

    // User crontab
    if let Ok(output) = Command::new("crontab").arg("-l").output()
        && output.status.success()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let jobs: Vec<&str> = stdout
            .lines()
            .filter(|l| !l.trim().is_empty() && !l.trim().starts_with('#'))
            .collect();
        if !jobs.is_empty() {
            let _ = writeln!(out, "### User Crontab\n");
            for job in &jobs {
                let _ = writeln!(out, "- {}", job.trim());
            }
            out.push('\n');
        }
    }

    // LaunchAgents (user)
    let home = dirs::home_dir();
    if let Some(ref h) = home {
        let launch_agents = h.join("Library/LaunchAgents");
        if launch_agents.exists()
            && let Ok(entries) = std::fs::read_dir(&launch_agents)
        {
            let plists: Vec<String> = entries
                .flatten()
                .filter_map(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    if name.ends_with(".plist") {
                        Some(name)
                    } else {
                        None
                    }
                })
                .collect();
            if !plists.is_empty() {
                let _ = writeln!(out, "### User LaunchAgents\n");
                for plist in plists.iter().take(20) {
                    let _ = writeln!(out, "- {}", plist);
                }
                out.push('\n');
            }
        }
    }

    if out.is_empty() {
        "(no cron jobs or scheduled tasks found)\n".to_string()
    } else {
        out
    }
}

fn discover_windows() -> String {
    let output = match Command::new("schtasks")
        .args(["/Query", "/FO", "LIST", "/V"])
        .output()
    {
        Ok(o) if o.status.success() => o,
        _ => return "(failed to query scheduled tasks)\n".to_string(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut tasks = Vec::new();
    let mut current_name: Option<String> = None;
    let mut current_status: Option<String> = None;

    for line in stdout.lines() {
        let trimmed = line.trim();
        if let Some(name) = trimmed.strip_prefix("TaskName:") {
            current_name = Some(name.trim().to_string());
        } else if let Some(status) = trimmed.strip_prefix("Status:") {
            current_status = Some(status.trim().to_string());
        } else if trimmed.is_empty() {
            if let Some(ref name) = current_name {
                // Skip system tasks
                if !name.starts_with("\\Microsoft\\") {
                    tasks.push(format!(
                        "- {} ({})",
                        name,
                        current_status.as_deref().unwrap_or("?")
                    ));
                }
            }
            current_name = None;
            current_status = None;
        }
    }

    if tasks.is_empty() {
        return "(no user scheduled tasks found)\n".to_string();
    }

    let mut out = String::with_capacity(tasks.len() * 60);
    let _ = writeln!(out, "### Scheduled Tasks\n");
    for task in tasks.iter().take(30) {
        let _ = writeln!(out, "{}", task);
    }
    out
}

```

### Core Architecture Module: `cli/src/utils/discovery/git_repos.rs`
```
use ignore::WalkBuilder;
use std::fmt::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Discover all git repositories under $HOME (or common dev paths).
/// Returns a formatted string listing each repo with its language and remote.
pub fn discover(home: Option<&Path>) -> String {
    let search_roots = build_search_roots(home);
    if search_roots.is_empty() {
        return String::new();
    }

    let mut repos: Vec<RepoInfo> = Vec::new();

    for root in &search_roots {
        if !root.exists() {
            continue;
        }
        // Use ignore crate for fast traversal that respects .gitignore
        let walker = WalkBuilder::new(root)
            .hidden(false) // don't skip hidden dirs (we need .git)
            .git_ignore(false) // don't use gitignore for the walk itself
            .max_depth(Some(6))
            .filter_entry(|entry| {
                let name = entry.file_name().to_string_lossy();
                // Skip known heavy dirs that never contain user repos
                !matches!(
                    name.as_ref(),
                    "node_modules"
                        | "vendor"
                        | "target"
                        | ".terraform"
                        | "venv"
                        | ".venv"
                        | "__pycache__"
                        | ".cache"
                        | ".Trash"
                        | "Library"
                        | ".local"
                        | ".cargo"
                        | ".rustup"
                        | ".npm"
                        | ".nvm"
                        | ".pyenv"
                        | ".gradle"
                        | ".m2"
                        | ".docker"
                        | ".kube"
                        | ".aws"
                )
            })
            .build();

        for entry in walker.flatten() {
            let path = entry.path();
            if path.file_name().map(|n| n == ".git").unwrap_or(false) && path.is_dir() {
                let repo_root = match path.parent() {
                    Some(p) => p,
                    None => continue,
                };
                let remote = get_remote(repo_root);
                let lang = detect_language(repo_root);
                let branch = get_branch(repo_root);
                repos.push(RepoInfo {
                    path: repo_root.to_path_buf(),
                    remote,
                    language: lang,
                    branch,
                });
            }
        }
    }

    if repos.is_empty() {
        return "(no git repositories found)\n".to_string();
    }

    repos.sort_by(|a, b| a.path.cmp(&b.path));
    repos.dedup_by(|a, b| a.path == b.path);

    let mut out = String::with_capacity(repos.len() * 120);
    for repo in &repos {
        let _ = writeln!(
            out,
            "- {}  [{}]  branch:{}  remote:{}",
            repo.path.display(),
            repo.language,
            repo.branch.as_deref().unwrap_or("?"),
            repo.remote.as_deref().unwrap_or("(none)"),
        );
    }
    out
}

struct RepoInfo {
    path: PathBuf,
    remote: Option<String>,
    language: String,
    branch: Option<String>,
}

fn build_search_roots(home: Option<&Path>) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(h) = home {
        roots.push(h.to_path_buf());
    }
    // Also check common non-home dev paths
    for extra in &["/opt", "/srv", "/var/www"] {
        let p = PathBuf::from(extra);
        if p.exists() {
            roots.push(p);
        }
    }
    roots
}

fn get_remote(repo_root: &Path) -> Option<String> {
    let output = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(repo_root)
        .output()
        .ok()?;
    if output.status.success() {
        let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !url.is_empty() {
            return Some(url);
        }
    }
    None
}

fn get_branch(repo_root: &Path) -> Option<String> {
    // Fast path: read HEAD file directly instead of spawning git
    let head_path = repo_root.join(".git/HEAD");
    if let Ok(content) = std::fs::read_to_string(&head_path) {
        let content = content.trim();
        if let Some(branch) = content.strip_prefix("ref: refs/heads/") {
            return Some(branch.to_string());
        }
        // Detached HEAD — return short hash
        return Some(content.chars().take(8).collect());
    }
    None
}

fn detect_language(repo_root: &Path) -> String {
    static MARKERS: &[(&str, &str)] = &[
        ("package.json", "Node.js"),
        ("go.mod", "Go"),
        ("Cargo.toml", "Rust"),
        ("pyproject.toml", "Python"),
        ("setup.py", "Python"),
        ("requirements.txt", "Python"),
        ("pom.xml", "Java"),
        ("build.gradle", "Java/Gradle"),
        ("build.gradle.kts", "Kotlin"),
        ("Gemfile", "Ruby"),
        ("composer.json", "PHP"),
        ("mix.exs", "Elixir"),
        ("pubspec.yaml", "Dart"),
        ("*.csproj", "C#"),
        ("*.sln", "C#"),
        ("CMakeLists.txt", "C/C++"),
        ("Makefile", "Make"),
    ];

    for (marker, lang) in MARKERS {
        if let Some(ext) = marker.strip_prefix('*') {
            // Glob pattern — check if any file matches
            // e.g. ".csproj"
            if let Ok(entries) = std::fs::read_dir(repo_root) {
                for entry in entries.flatten() {
                    if entry.file_name().to_string_lossy().ends_with(ext) {
                        return lang.to_string();
                    }
                }
            }
        } else if repo_root.join(marker).exists() {
            return lang.to_string();
        }
    }
    "unknown".to_string()
}

```

### Core Architecture Module: `cli/src/utils/discovery/listening_ports.rs`
```
use std::fmt::Write;
use std::process::Command;

/// Discover listening TCP ports on the local machine.
/// Uses pure /proc parsing on Linux, lsof on macOS, netstat on Windows.
pub fn discover() -> String {
    let os = std::env::consts::OS;
    match os {
        "linux" => discover_linux(),
        "macos" => discover_macos(),
        "windows" => discover_windows(),
        _ => discover_fallback(),
    }
}

/// Linux: parse /proc/net/tcp and /proc/net/tcp6 directly — no external deps.
fn discover_linux() -> String {
    let mut ports = Vec::new();

    for proto_file in &["/proc/net/tcp", "/proc/net/tcp6"] {
        if let Ok(content) = std::fs::read_to_string(proto_file) {
            for line in content.lines().skip(1) {
                // Fields: sl local_address rem_address st ...
                let fields: Vec<&str> = line.split_whitespace().collect();
                if fields.len() < 4 {
                    continue;
                }
                // st == "0A" means LISTEN
                if fields[3] != "0A" {
                    continue;
                }
                // local_address is hex_ip:hex_port
                if let Some(port_hex) = fields[1].split(':').nth(1)
                    && let Ok(port) = u16::from_str_radix(port_hex, 16)
                {
                    // Parse the hex IP to determine bind address
                    let addr = parse_proc_addr(fields[1], proto_file.contains("tcp6"));
                    ports.push((port, addr));
                }
            }
        }
    }

    if ports.is_empty() {
        return "(no listening ports detected)\n".to_string();
    }

    ports.sort_by_key(|(port, _)| *port);
    ports.dedup();

    let mut out = String::with_capacity(ports.len() * 40);
    for (port, addr) in &ports {
        let _ = writeln!(out, "- {}:{}", addr, port);
    }
    out
}

/// Parse hex address from /proc/net/tcp format into human-readable form.
fn parse_proc_addr(hex_addr: &str, is_v6: bool) -> String {
    let parts: Vec<&str> = hex_addr.split(':').collect();
    if parts.is_empty() {
        return "?".to_string();
    }
    let ip_hex = parts[0];

    if is_v6 {
        if ip_hex == "00000000000000000000000000000000" {
            return "[::]".to_string();
        }
        if ip_hex == "00000000000000000000FFFF00000000" || ip_hex.ends_with("00000000") {
            return "0.0.0.0".to_string();
        }
        return "[::...]".to_string();
    }

    // IPv4: hex is in little-endian
    if ip_hex.len() == 8
        && let Ok(num) = u32::from_str_radix(ip_hex, 16)
    {
        let bytes = num.to_le_bytes();
        return format!("{}.{}.{}.{}", bytes[0], bytes[1], bytes[2], bytes[3]);
    }
    "?".to_string()
}

/// macOS: use lsof (always available).
fn discover_macos() -> String {
    let output = match Command::new("lsof")
        .args(["-iTCP", "-sTCP:LISTEN", "-P", "-n"])
        .output()
    {
        Ok(o) if o.status.success() => o,
        Ok(_) | Err(_) => return "(failed to run lsof)\n".to_string(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut entries: Vec<String> = Vec::new();

    for line in stdout.lines().skip(1) {
        // COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
        let fields: Vec<&str> = line.split_whitespace().collect();
        if fields.len() < 9 {
            continue;
        }
        let command = fields[0];
        let pid = fields[1];
        let name = fields[fields.len() - 1]; // last field is the address
        entries.push(format!("- {} (pid:{} cmd:{})", name, pid, command));
    }

    if entries.is_empty() {
        return "(no listening ports detected)\n".to_string();
    }

    entries.sort();
    entries.dedup();
    entries.join("\n") + "\n"
}

/// Windows: use netstat.
fn discover_windows() -> String {
    let output = match Command::new("netstat").args(["-an", "-p", "TCP"]).output() {
        Ok(o) if o.status.success() => o,
        _ => return "(failed to run netstat)\n".to_string(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut entries: Vec<String> = Vec::new();

    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.contains("LISTENING") {
            let fields: Vec<&str> = trimmed.split_whitespace().collect();
            if fields.len() >= 2 {
                entries.push(format!("- {}", fields[1]));
            }
        }
    }

    if entries.is_empty() {
        return "(no listening ports detected)\n".to_string();
    }

    entries.sort();
    entries.dedup();
    entries.join("\n") + "\n"
}

/// Fallback: try ss, then netstat, then give up.
fn discover_fallback() -> String {
    // Try ss
    if let Ok(output) = Command::new("ss").args(["-tlnp"]).output()
        && output.status.success()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = stdout.lines().skip(1).take(30).collect();
        if !lines.is_empty() {
            return lines.join("\n") + "\n";
        }
    }
    // Try netstat
    if let Ok(output) = Command::new("netstat").args(["-tlnp"]).output()
        && output.status.success()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = stdout
            .lines()
            .filter(|l| l.contains("LISTEN"))
            .take(30)
            .collect();
        if !lines.is_empty() {
            return lines.join("\n") + "\n";
        }
    }
    "(no method available to detect listening ports)\n".to_string()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #557** (2026-03-18): **bug: tilde (`~`) expansion in check script paths may be fragile**
  *Symptoms*: ## Summary  Check script paths in `autopilot.toml` using `~` (e.g., `~/.stakpak/checks/endpoints.sh`) work in some contexts but may fail when the autopilot runs as a systemd service under a different user or environment where `HOME` is not set.  ## Details  The config supports paths like:  ```toml [[schedules]] name = "endpoint-health" cron = "*/3 * * * *" check = "~/.stakpak/checks/endpoints.sh" ```  The code in `cli/src/commands/watch/config.rs` has an `expand_tilde()` function that handles this, but:  1. It is unclear whether this expansion is guaranteed in all execution contexts (e.g., systemd service with `User=` directive, cron jobs, Docker containers) 2. There is no documentation about whether `~` is supported or recommended 3. If expansion fails silently, the check script path becomes invalid and the schedule fails  ## Observed Behavior  During deployment, switching from `~/.stakpak/checks/endpoints.sh` to absolute paths (`/home/ec2-user/.stakpak/checks/endpoints.sh`) resolved intermittent issues.  ## Expected Behavior  Either: 1. **Document** that `~` is expanded and under what conditions, OR 2. **Always expand** `~` internally using the process owner's home directory (not relying on `$HOME` env var), OR 3. **Warn** at config load time if a path contains `~` and suggest using absolute paths  ## Key Files  - `cli/src/commands/watch/config.rs` — `expand_tilde()` function - `cli/src/commands/watch/commands/run.rs` — where check paths are resolved
  **Post-Mortem & Fix Analysis**:
  > I' ll do it.

- **Issue #556** (2026-02-16): **bug: stale run state not cleaned on autopilot crash**
  *Symptoms*: ## Summary  When the autopilot process crashes (e.g., due to SIGSEGV #552), schedule runs that were in-progress remain stuck in `running` status indefinitely in the SQLite database. This blocks new runs for the same schedule because the singleton guard in `handle_schedule_event` sees an existing running run and skips execution.  ## Steps to Reproduce  1. Start autopilot with a schedule 2. Trigger the schedule so a run starts 3. Kill the process (or let it crash via #552) 4. Restart autopilot 5. The schedule fires again but is skipped: `"Skipping: previous run still in progress"`  ## Root Cause  The singleton guard in `cli/src/commands/watch/commands/run.rs:231-252`:  ```rust match db.has_running_run(&schedule.name).await {     Ok(true) => {         info!(schedule = %schedule.name, "Skipping: previous run still in progress");         return Ok(());     }     ... } ```  When the process crashes, `update_run_finished()` is never called, so the run stays in `running` status forever.  ## Expected Behavior  On startup, the autopilot should detect and clean up stale runs from previous crashed sessions:  1. Query all runs with `status = "running"` 2. Check if the PID that started them is still alive 3. If not, mark them as `failed` with an error message like `"Autopilot process crashed during execution"`  ## Workaround  Manually run `stakpak autopilot schedule clean` to clear stale runs.  ## Key Files  - `cli/src/commands/watch/commands/run.rs` — singleton guard logic - `cli/src/comm

- **Issue #555** (2026-02-16): **bug: `autopilot channel add` missing `--target` flag**
  *Symptoms*: ## Summary  `stakpak autopilot channel add` does not support a `--target` flag, making it impossible to fully configure a channel via CLI. Combined with the config overwrite bug (#553), this creates a broken workflow.  ## Steps to Reproduce  ```bash stakpak autopilot channel add slack --bot-token xoxb-... --app-token xapp-... --target "#engineering" # Error: unexpected argument '--target' ```  ## Impact  The `target` field (which Slack channel to post to) is one of the most common config fields. Without `--target`:  1. You must manually edit the config file to add `target = "#engineering"` 2. But if you edit the file first and then run `channel add`, it overwrites your edits (#553) 3. The only working path is: run `channel add` first, then manually edit the file  This makes non-interactive/scripted setup impossible for channels with a target.  ## Expected Behavior  `--target` should be a supported flag:  ```bash stakpak autopilot channel add slack \   --bot-token xoxb-... \   --app-token xapp-... \   --target "#engineering" ```  Generating: ```toml [channels.slack] type = "slack" bot_token = "xoxb-..." app_token = "xapp-..." target = "#engineering" enabled = true ```  ## Key Files  - `cli/src/commands/autopilot.rs` — channel add command implementation

- **Issue #554** (2026-02-16): **bug: `autopilot channel add` omits `type` field in generated config**
  *Symptoms*: ## Summary  `stakpak autopilot channel add slack --bot-token ... --app-token ...` generates a config block that is missing the required `type` field. `stakpak up` then fails with a TOML parse error.  ## Steps to Reproduce  1. Run: ```bash stakpak autopilot channel add slack --bot-token xoxb-... --app-token xapp-... ```  2. Inspect `~/.stakpak/autopilot.toml` — the generated config is: ```toml [channels.slack] bot_token = "xoxb-..." app_token = "xapp-..." ```  3. Run `stakpak up` — fails with: ``` TOML parse error at line 24, column 1 missing field `type` ```  ## Expected Behavior  Since the channel type is the positional argument to `channel add`, the command should automatically include `type = "slack"` in the generated config:  ```toml [channels.slack] type = "slack" bot_token = "xoxb-..." app_token = "xapp-..." ```  ## Workaround  Manually add `type = "slack"` to the config file.  ## Key Files  - `cli/src/commands/autopilot.rs` — channel add command implementation

- **Issue #553** (2026-02-16): **bug: `autopilot channel add` overwrites entire autopilot.toml**
  *Symptoms*: ## Summary  Running `stakpak autopilot channel add slack --bot-token ... --app-token ...` replaces the **entire contents** of `~/.stakpak/autopilot.toml` with just the channel/gateway config, destroying all existing schedule definitions and other settings.  ## Steps to Reproduce  1. Create `~/.stakpak/autopilot.toml` with schedules: ```toml [[schedules]] name = "health-check" cron = "*/5 * * * *" prompt = "Check system health" enabled = true  [[schedules]] name = "backup-audit" cron = "0 8 * * *" prompt = "Check backup status" enabled = true ```  2. Run: ```bash stakpak autopilot channel add slack --bot-token xoxb-... --app-token xapp-... ```  3. Check the file — all schedule definitions are gone, replaced with only: ```toml [channels.slack] bot_token = "xoxb-..." app_token = "xapp-..." ```  ## Impact  **Data loss** — all user-configured schedules, runtime settings, and other config are silently destroyed. The user must recreate the entire config from scratch.  ## Expected Behavior  `channel add` should **merge** the channel config into the existing file, preserving all other sections (schedules, runtime, routing, etc.).  ## Key Files  - `cli/src/commands/autopilot.rs` — channel add command implementation

- **Issue #552** (2026-02-16): **bug: SIGSEGV in libsql Hrana driver during autopilot agent execution**
  *Symptoms*: ## Summary  Stakpak autopilot crashes with **SIGSEGV (signal 11)** during agent execution. The crash occurs reproducibly in `libsql::hrana::hyper::HranaStream::execute` on tokio worker threads. Every triggered schedule that invokes the agent results in a segfault within 10-40 seconds, creating an infinite crash loop under systemd.  ## Root Cause  **Known upstream bug: [tursodatabase/libsql#2132](https://github.com/tursodatabase/libsql/issues/2132)**  libsql `Connection` uses `RefCell` internally — not safe for concurrent async access. In release builds, `RefCell` borrow checks are optimized away, so instead of a clean panic (`already mutably borrowed: BorrowError`), the result is memory corruption → SIGSEGV.  The codebase wraps `Connection` in `tokio::sync::Mutex<Connection>`, but this does not help because libsql internally clones the connection via `RefCell::clone` during `prepare()` calls, and the cloned connection shares the same underlying `RefCell` state.  ### Secondary issue: `Database` dropped while `Connection` still alive  All three storage constructors drop the `Database` object at the end of `new()` while the `Connection` continues to be used:  ```rust let db = libsql::Builder::new_local(db_path).build().await?; let conn = db.connect()?; // db is dropped here! Connection outlives its Database. let storage = Self { conn: Mutex::new(conn) }; ```  ## Affected Code  All three storage types use the identical vulnerable pattern:  | Storage Type | File | Line | |--------

- **Issue #502** (2026-02-08): **fix(api): prevent duplicate and orphaned tool_result Anthropic API 400 errors**
  *Symptoms*: ## Description  Fixes two Anthropic API 400 errors that occur during interactive tool execution:  1. **`each tool_use must have a single result`** — Duplicate `tool_result` blocks for the same `tool_use_id`, caused by the cancel/retry flow pushing a result in `AcceptTool` and then again in `SendToolResult`.  2. **`unexpected tool_use_id found in tool_result blocks`** — Caused by (a) consecutive `role=user` messages when multiple `role=tool` messages are converted for Anthropic, and (b) orphaned `tool_result` blocks from checkpoint resume edge cases.  ## Changes Made  ### Three-layer defense in depth  **Layer 1 — Source prevention** (`mode_interactive.rs`, AcceptTool handler): - Skip pushing `tool_result` for cancelled tool calls when retry/shell will send the final result - Push a `TOOL_CALL_CANCELLED` placeholder only when queued tools need the `tool_use` resolved immediately  **Layer 2 — Pre-API sanitization** (`mode_interactive.rs`, `sanitize_tool_results()`): - Called before every API request - Deduplicates: keeps only the last `tool_result` per `tool_call_id` - Removes orphans: drops `tool_result` messages that don't match any assistant `tool_call`  **Layer 3 — Context manager post-processing** (`task_board_context_manager.rs`): - `merge_consecutive_same_role()`: Combines consecutive `role=tool` messages into one message with multiple `ToolResult` parts, preventing consecutive `role=user` messages after Anthropic conversion - `dedup_tool_results()`: Removes duplicate `To

- **Issue #415** (2026-01-03): **fix: tool call handling**
  *Symptoms*: - Implemented ID-based matching for tool calls in the Anthropic and OpenAI streams, allowing for better tracking and separation of tool calls with the same index. - Updated the processing logic to accumulate arguments and emit ToolCallEnd events correctly. - Added comprehensive tests to verify the correct behavior of tool calls, including scenarios with multiple calls and handling of arguments across chunks. - Improved the handling of tool call names and arguments in the StakAI client to ensure proper JSON parsing and accumulation.
  **Post-Mortem & Fix Analysis**:
  > Test works locally. that's weird

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

### Incident Patch 1: `863a27a5` (2026-06-10)
**Commit Message**: Merge pull request #752 from stakpak/fix/ak-publish-version

fix(ak): specify version for stakpak-api dependency

**File**: `libs/ak/Cargo.toml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ regex = { workspace = true }
 globset = { workspace = true }
 grep-matcher = { workspace = true }
 grep-regex = { workspace = true }
-stakpak-api = { path = "../api" }
+stakpak-api = { workspace = true }
 tokio = { workspace = true }
 
 [dev-dependencies]
```

---

### Incident Patch 2: `34a846a1` (2026-06-10)
**Commit Message**: fix(ak): specify version for stakpak-api dependency

The bare path dependency on stakpak-api had no version requirement,
which causes cargo publish to fail (crates.io requires a version for
all dependencies). Switch to the workspace dependency like every other
crate, which inherits version = "0.3.87".

**File**: `libs/ak/Cargo.toml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ regex = { workspace = true }
 globset = { workspace = true }
 grep-matcher = { workspace = true }
 grep-regex = { workspace = true }
-stakpak-api = { path = "../api" }
+stakpak-api = { workspace = true }
 tokio = { workspace = true }
 
 [dev-dependencies]
```

---

### Incident Patch 3: `24102b83` (2026-06-10)
**Commit Message**: Merge pull request #750 from stakpak/fix/mcp-proxy-large-output-artifacts

fix(mcp): artifact large tool outputs in proxy

**File**: `libs/mcp/proxy/src/client/mod.rs` (modified, +31/-0)
```diff
@@ -25,12 +25,20 @@ impl ProxyClientHandler {
     }
 }
 
+fn progress_notification_for_forwarding(
+    notification: ProgressNotificationParam,
+) -> ProgressNotificationParam {
+    notification
+}
+
 impl ClientHandler for ProxyClientHandler {
     async fn on_progress(
         &self,
         notification: ProgressNotificationParam,
         _ctx: NotificationContext<RoleClient>,
     ) {
+        let notification = progress_notification_for_forwarding(notification);
+
         // Then forward progress notification from upstream server to downstream server
         let peer = self.downstream_peer.lock().await;
         if let Some(ref peer) = *peer {
@@ -282,6 +290,7 @@ fn substitute_env_vars(s: &str) -> String {
 #[cfg(test)]
 mod tests {
     use super::*;
+    use rmcp::model::{NumberOrString, ProgressToken};
     use std::env;
     use std::sync::Mutex;
 
@@ -318,6 +327,28 @@ mod tests {
         }
     }
 
+    #[test]
+    fn progress_notification_forwarding_preserves_large_message_without_artifacting() {
+        let large_message = "progress line\n".repeat(400);
+        let notification = ProgressNotificationParam {
+            progress_token: ProgressToken(NumberOrString::Number(0)),
+            progress: 50.0,
+            total: None,
+            message: Some(large_message.clone()),
+        };
+
+        let forwarded = progress_notification_for_forwarding(notification);
+
+        assert_eq!(forwarded.message.as_deref(), Some(large_message.as_str()));
+        assert!(
+            !forwarded
+                .message
+                .as_deref()
+                .expect("message should be preserved")
+                .contains("Full output saved to ")
+        );
+    }
+
     #[test]
     fn test_substitute_no_vars() {
         assert_eq!(substitute_env_vars("hello world"), "hello world");
```

**File**: `libs/mcp/proxy/src/server/mod.rs` (modified, +183/-0)
```diff
@@ -22,6 +22,7 @@ use rmcp::transport::streamable_http_client::StreamableHttpClientTransportConfig
 use stakpak_shared::cert_utils::CertificateChain;
 use stakpak_shared::paths::stakpak_home_dir;
 use stakpak_shared::secret_manager::SecretManager;
+use stakpak_shared::utils::{LargeOutputLimits, handle_large_output_with_limits};
 use std::collections::HashMap;
 use std::future::Future;
 use std::sync::Arc;
@@ -126,6 +127,51 @@ fn restore_secrets_in_json_value(
     }
 }
 
+const PROXY_LARGE_OUTPUT_MAX_LINES: usize = 300;
+const PROXY_LARGE_OUTPUT_MAX_BYTES: usize = 64 * 1024;
+
+fn artifact_final_tool_result_text(
+    mut result: CallToolResult,
+    client_name: &str,
+    tool_name: &str,
+) -> CallToolResult {
+    let mut text_blocks = Vec::new();
+    let mut non_text_content = Vec::new();
+
+    for item in result.content {
+        if let Some(text_content) = item.raw.as_text() {
+            text_blocks.push(text_content.text.clone());
+        } else {
+            non_text_content.push(item);
+        }
+    }
+
+    if text_blocks.is_empty() {
+        result.content = non_text_content;
+        return result;
+    }
+
+    let flattened_text = text_blocks.join("\n");
+    let file_prefix = format!("tool-output.{}.{}", client_name, tool_name);
+    let processed_text = match handle_large_output_with_limits(
+        &flattened_text,
+        LargeOutputLimits {
+            file_prefix: &file_prefix,
+            max_lines: PROXY_LARGE_OUTPUT_MAX_LINES,
+            max_bytes: PROXY_LARGE_OUTPUT_MAX_BYTES,
+            show_head: false,
+        },
+    ) {
+        Ok(text) => text,
+        Err(e) => format!("FAILED_TO_HANDLE_LARGE_OUTPUT: {}", e),
+    };
+
+    result.content = std::iter::once(Content::text(processed_text))
+        .chain(non_text_content)
+        .collect();
+    result
+}
+
 #[derive(Debug, Clone)]
 struct RequestTracking {
     client_name: String,
@@ -670,6 +716,8 @@ impl ServerHandler for ProxyServer {
                 .collect();
         }
 
+        result = artifact_final_tool_result_text(result, &client_name, &tool_name);
+
         Ok(result)
     }
 
@@ -881,8 +929,40 @@ pub async fn start_proxy_server(
 #[cfg(test)]
 mod tests {
     use super::*;
+    use rmcp::model::ResourceContents;
     use serde_json::json;
 
+    fn text_content(content: &Content) -> &str {
+        content
+            .raw
+            .as_text()
+            .map(|text| text.text.as_str())
+            .expect("content should be text")
+    }
+
+    fn artifact_path_from_preview(preview: &str) -> &str {
+        preview
+            .lines()
+            .next()
+            .and_then(|line| line.split_once("Full output saved to "))
+            .map(|(_, path)| path)
+            .expect("preview should contain saved artifact path")
+    }
+
+    fn read_artifact_from_preview(preview: &str) -> String {
+        let artifact_path = artifact_path_from_preview(preview);
+        let artifact = std::fs::read_to_string(artifact_path).expect("artifact should be readable");
+        std::fs::remove_file(artifact_path).expect("artifact should be removable");
+        artifact
+    }
+
+    fn numbered_lines(prefix: &str, count: usize) -> String {
+        (1..=count)
+            .map(|line| format!("{prefix}-{line:03}"))
+            .collect::<Vec<_>>()
+            .join("\n")
+    }
+
     /// Helper: build a redaction map from pairs
     fn map(pairs: &[(&str, &str)]) -> HashMap<String, String> {
         pairs
@@ -891,6 +971,109 @@ mod tests {
             .collect()
     }
 
+    #[test]
+    fn artifact_final_tool_result_previews_large_success_text() {
+        let output = numbered_lines("success", 301);
+        let result = CallToolResult::success(vec![Content::text(output.clone())]);
+
+        let processed = artifact_final_tool_result_text(result, "stakpak", "run_command");
+
+        assert_eq!(processed.is_error, Some(false));
+        assert_eq!(processed.content.len(), 1);
+        let preview = text_content(&processed.content[0]);
+        assert!(preview.starts_with("Showing the last 300 / 301 output lines."));
+        assert!(preview.contains("Full output saved to "));
+        assert!(!preview.contains("success-001"));
+        assert!(preview.contains("success-301"));
+
+        let artifact = read_artifact_from_preview(preview);
+        assert_eq!(artifact, output);
+    }
+
+    #[test]
+    fn artifact_final_tool_result_preserves_large_error_status() {
+        let output = numbered_lines("error", 301);
+        let result = CallToolResult::error(vec![Content::text(output.clone())]);
+
+        let processed = artifact_final_tool_result_text(result, "stakpak", "get_task_details");
+
+        assert_eq!(processed.is_error, Some(true));
+        assert_eq!(processed.content.len(), 1);
+        let preview = text_content(&processed.content[0]);
+        assert!(preview.starts_with("Showing the last 300 / 301 output lines."));
+
+        let artifact = read_artifact_f
```

**File**: `libs/mcp/server/src/local_tools.rs` (modified, +4/-42)
```diff
@@ -25,7 +25,7 @@ use stakpak_shared::models::integrations::openai::{
 use stakpak_shared::task_manager::{StartTaskOptions, TaskInfo};
 use stakpak_shared::tls_client::{TlsClientConfig, create_tls_client};
 use stakpak_shared::utils::{
-    LocalFileSystemProvider, generate_directory_tree, handle_large_output, sanitize_text_output,
+    LocalFileSystemProvider, generate_directory_tree, sanitize_text_output,
 };
 use std::fs::{self};
 use std::path::Path;
@@ -309,8 +309,6 @@ impl ToolContainer {
     #[tool(
         description = "Execute a shell command locally with full system access.
 
-If the command's output exceeds 300 lines the result will be truncated and the full output will be saved to a file in the current directory.
-
 For remote command execution via SSH, use the run_remote_command tool instead."
     )]
     pub async fn run_command(
@@ -338,8 +336,6 @@ REMOTE EXECUTION:
   * 'user@server.com' (uses default port 22 and auto-discovered keys)
   * 'user@server.com:2222' with password authentication
 
-If the command's output exceeds 300 lines the result will be truncated and the full output will be saved to a file in the current directory.
-
 For local command execution, use the run_command tool instead.")]
     pub async fn run_remote_command(
         &self,
@@ -702,8 +698,6 @@ This tool provides comprehensive details about a background task started with ru
 - Complete command output
 - Error information if the task failed
 
-If the task output exceeds 300 lines the result will be truncated and the full output will be saved to a file in the current directory.
-
 Use this tool to check the progress and results of long-running background tasks."
     )]
     pub async fn get_task_details(
@@ -760,16 +754,7 @@ Use this tool to check the progress and results of long-running background tasks
                         // Subagent output - use Display impl for LLM-friendly formatting
                         manifest.to_string()
                     } else {
-                        // Regular task output - use standard handling
-                        match handle_large_output(output, "task.output", 300, false) {
-                            Ok(result) => result,
-                            Err(e) => {
-                                return Ok(CallToolResult::error(vec![
-                                    Content::text("OUTPUT_HANDLING_ERROR"),
-                                    Content::text(format!("Failed to handle task output: {}", e)),
-                                ]));
-                            }
-                        }
+                        output.clone()
                     }
                 } else {
                     "No output available".to_string()
@@ -1018,9 +1003,7 @@ SECURITY FEATURES:
 - Only allows HTTPS URLs for secure connections
 - Follows redirects safely with limits
 
-The tool fetches the HTML content from the specified URL and converts it to clean, readable markdown. This is useful for reading web articles, documentation, or any web content in a text-friendly format.
-
-The response will be truncated if it exceeds 300 lines, with the full content saved to a local file."
+The tool fetches the HTML content from the specified URL and converts it to clean, readable markdown. This is useful for reading web articles, documentation, or any web content in a text-friendly format."
     )]
     pub async fn view_web_page(
         &self,
@@ -1097,17 +1080,7 @@ The response will be truncated if it exceeds 300 lines, with the full content sa
         let markdown_content = html2md::rewrite_html(&html_content, false);
         let sanitized_content = sanitize_text_output(&markdown_content);
 
-        let result = match handle_large_output(&sanitized_content, "webpage", 300, false) {
-            Ok(result) => result,
-            Err(e) => {
-                return Ok(CallToolResult::error(vec![
-                    Content::text("OUTPUT_HANDLING_ERROR"),
-                    Content::text(format!("Failed to handle output: {}", e)),
-                ]));
-            }
-        };
-
-        let formatted_output = format!("# Web Page Content: {}\n\n{}", url, result);
+        let formatted_output = format!("# Web Page Content: {}\n\n{}", url, sanitized_content);
 
         Ok(CallToolResult::success(vec![Content::text(
             &formatted_output,
@@ -1232,17 +1205,6 @@ SAFETY NOTES:
     fn format_command_result(
         command_result: &mut CommandResult,
     ) -> Result<CallToolResult, McpError> {
-        command_result.output =
-            match handle_large_output(&command_result.output, "command.output", 300, false) {
-                Ok(result) => result,
-                Err(e) => {
-                    return Ok(CallToolResult::error(vec![
-                        Content::text("OUTPUT_HANDLING_ERROR"),
-                        Content::text(format!("Failed to handle command output: {}", e)),
-                    ]));
-                }
-            
```

**File**: `libs/mcp/server/src/remote_tools.rs` (modified, +2/-25)
```diff
@@ -5,7 +5,7 @@ use rmcp::{
 };
 use serde::Deserialize;
 use stakpak_api::models::SearchDocsRequest as ApiSearchDocsRequest;
-use stakpak_shared::utils::{handle_large_output, sanitize_text_output};
+use stakpak_shared::utils::sanitize_text_output;
 // use stakpak_api::models::CodeIndex;
 // use stakpak_shared::local_store::LocalStore;
 // use stakpak_shared::models::indexing::IndexingStatus;
@@ -302,34 +302,11 @@ If your goal requires understanding multiple distinct topics or technologies, ma
             }
         };
 
-        const MAX_LINES: usize = 600;
-
-        let mut remaining_lines = MAX_LINES;
-        let mut remaining_items = response.len();
-
         let processed: Vec<Content> = response
             .into_iter()
             .map(|c| {
-                // Compute this element's allowance at the last possible moment
-                let allowance = if remaining_items > 0 {
-                    (remaining_lines / remaining_items).max(1)
-                } else {
-                    1
-                };
-
-                remaining_items = remaining_items.saturating_sub(1);
-
                 if let Some(RawTextContent { text, meta: None }) = c.as_text() {
-                    let sanitized = sanitize_text_output(text);
-                    match handle_large_output(&sanitized, "search", allowance, true) {
-                        Ok(final_text) => {
-                            // Estimate consumption (best-effort)
-                            let used = final_text.lines().count().min(remaining_lines);
-                            remaining_lines = remaining_lines.saturating_sub(used);
-                            Content::text(final_text)
-                        }
-                        Err(e) => Content::text(format!("FAILED_TO_HANDLE_LARGE_OUTPUT: {}", e)),
-                    }
+                    Content::text(sanitize_text_output(text))
                 } else {
                     c
                 }
```

**File**: `libs/shared/src/utils.rs` (modified, +245/-36)
```diff
@@ -3,6 +3,7 @@ use async_trait::async_trait;
 use rand::Rng;
 use std::fs;
 use std::path::{Path, PathBuf};
+use uuid::Uuid;
 use walkdir::DirEntry;
 
 /// Read .gitignore patterns from the specified base directory
@@ -250,6 +251,132 @@ pub fn truncate_chars_with_ellipsis(text: &str, max_chars: usize) -> String {
     truncated
 }
 
+pub struct LargeOutputLimits<'a> {
+    pub file_prefix: &'a str,
+    pub max_lines: usize,
+    pub max_bytes: usize,
+    pub show_head: bool,
+}
+
+fn sanitize_artifact_file_prefix(file_prefix: &str) -> String {
+    let sanitized = file_prefix
+        .chars()
+        .map(|c| {
+            if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.') {
+                c
+            } else {
+                '-'
+            }
+        })
+        .collect::<String>()
+        .trim_matches(|c| matches!(c, '-' | '_' | '.'))
+        .to_string();
+
+    if sanitized.is_empty() {
+        "output".to_string()
+    } else {
+        sanitized
+    }
+}
+
+fn write_output_artifact(file_prefix: &str, output: &str) -> Result<String, String> {
+    let output_file = format!(
+        "{}.{}.txt",
+        sanitize_artifact_file_prefix(file_prefix),
+        Uuid::new_v4().simple()
+    );
+
+    LocalStore::write_session_data(&output_file, output)
+        .map_err(|e| format!("Failed to write session data: {}", e))
+}
+
+fn line_preview(
+    output_lines: &[&str],
+    output_file_path: &str,
+    max_lines: usize,
+    show_head: bool,
+) -> String {
+    let excerpt = if show_head {
+        let head_lines: Vec<&str> = output_lines.iter().take(max_lines).copied().collect();
+        head_lines.join("\n")
+    } else {
+        let mut tail_lines: Vec<&str> =
+            output_lines.iter().rev().take(max_lines).copied().collect();
+        tail_lines.reverse();
+        tail_lines.join("\n")
+    };
+
+    let position = if show_head { "first" } else { "last" };
+    format!(
+        "Showing the {} {} / {} output lines. Full output saved to {}\n{}\n{}",
+        position,
+        max_lines,
+        output_lines.len(),
+        output_file_path,
+        if show_head { "" } else { "...\n" },
+        excerpt
+    )
+}
+
+// start/end are adjusted to valid UTF-8 character boundaries before slicing.
+#[allow(clippy::string_slice)]
+fn byte_excerpt(output: &str, max_bytes: usize, show_head: bool) -> (&str, usize) {
+    if show_head {
+        let mut end = max_bytes.min(output.len());
+        while end > 0 && !output.is_char_boundary(end) {
+            end -= 1;
+        }
+        (&output[..end], end)
+    } else {
+        let mut start = output.len().saturating_sub(max_bytes);
+        while start < output.len() && !output.is_char_boundary(start) {
+            start += 1;
+        }
+        (&output[start..], output.len() - start)
+    }
+}
+
+fn byte_preview(output: &str, output_file_path: &str, max_bytes: usize, show_head: bool) -> String {
+    let (excerpt, excerpt_bytes) = byte_excerpt(output, max_bytes, show_head);
+    let position = if show_head { "first" } else { "last" };
+
+    format!(
+        "Showing the {} {} / {} output bytes. Full output saved to {}\n{}\n{}",
+        position,
+        excerpt_bytes,
+        output.len(),
+        output_file_path,
+        if show_head { "" } else { "...\n" },
+        excerpt
+    )
+}
+
+pub fn handle_large_output_with_limits(
+    output: &str,
+    limits: LargeOutputLimits<'_>,
+) -> Result<String, String> {
+    let output_lines = output.lines().collect::<Vec<_>>();
+    if output_lines.len() >= limits.max_lines {
+        let output_file_path = write_output_artifact(limits.file_prefix, output)?;
+        Ok(line_preview(
+            &output_lines,
+            &output_file_path,
+            limits.max_lines,
+            limits.show_head,
+        ))
+    } else if output.len() > limits.max_bytes {
+        let output_file_path = write_output_artifact(limits.file_prefix, output)?;
+        Ok(byte_preview(
+            output,
+            &output_file_path,
+            limits.max_bytes,
+            limits.show_head,
+        ))
+    } else {
+        Ok(output.to_string())
+    }
+}
+
 /// Handle large output: if the output has >= `max_lines`, save the full content to session
 /// storage and return a string showing only the first or last `max_lines` lines with a pointer
 /// to the saved file. Returns `Ok(final_string)` or `Err(error_string)` on failure.
@@ -259,44 +386,15 @@ pub fn handle_large_output(
     max_lines: usize,
     show_head: bool,
 ) -> Result<String, String> {
-    let output_lines = output.lines().collect::<Vec<_>>();
-    if output_lines.len() >= max_lines {
-        let mut __rng__ = rand::rng();
-        let output_file = format!(
-            "{}.{:06x}.txt",
+    handle_large_output_with_limits(
+        output,
+        LargeOutputLimits {
             file_prefix,
-            __rng__.random_range(0..=0xFFFFFF)
-        );
-        let output_file_path = match LocalSt
```

---

### Incident Patch 4: `bbacb4c6` (2026-06-10)
**Commit Message**: refactor(mcp): drop mcp- prefix from proxy artifact filenames

Rename large-output artifact prefix from mcp-tool-output to tool-output
so it doesn't leak MCP protocol semantics to the model (we also proxy
internal tools). Keeps a neutral, self-describing prefix so artifacts
stay greppable in the shared session store.

Addresses review feedback on #750.

**File**: `libs/mcp/proxy/src/server/mod.rs` (modified, +1/-1)
```diff
@@ -152,7 +152,7 @@ fn artifact_final_tool_result_text(
     }
 
     let flattened_text = text_blocks.join("\n");
-    let file_prefix = format!("mcp-tool-output.{}.{}", client_name, tool_name);
+    let file_prefix = format!("tool-output.{}.{}", client_name, tool_name);
     let processed_text = match handle_large_output_with_limits(
         &flattened_text,
         LargeOutputLimits {
```

---

### Incident Patch 5: `01464938` (2026-06-05)
**Commit Message**: fix(mcp): artifact large tool outputs in proxy

**File**: `libs/mcp/proxy/src/client/mod.rs` (modified, +31/-0)
```diff
@@ -25,12 +25,20 @@ impl ProxyClientHandler {
     }
 }
 
+fn progress_notification_for_forwarding(
+    notification: ProgressNotificationParam,
+) -> ProgressNotificationParam {
+    notification
+}
+
 impl ClientHandler for ProxyClientHandler {
     async fn on_progress(
         &self,
         notification: ProgressNotificationParam,
         _ctx: NotificationContext<RoleClient>,
     ) {
+        let notification = progress_notification_for_forwarding(notification);
+
         // Then forward progress notification from upstream server to downstream server
         let peer = self.downstream_peer.lock().await;
         if let Some(ref peer) = *peer {
@@ -282,6 +290,7 @@ fn substitute_env_vars(s: &str) -> String {
 #[cfg(test)]
 mod tests {
     use super::*;
+    use rmcp::model::{NumberOrString, ProgressToken};
     use std::env;
     use std::sync::Mutex;
 
@@ -318,6 +327,28 @@ mod tests {
         }
     }
 
+    #[test]
+    fn progress_notification_forwarding_preserves_large_message_without_artifacting() {
+        let large_message = "progress line\n".repeat(400);
+        let notification = ProgressNotificationParam {
+            progress_token: ProgressToken(NumberOrString::Number(0)),
+            progress: 50.0,
+            total: None,
+            message: Some(large_message.clone()),
+        };
+
+        let forwarded = progress_notification_for_forwarding(notification);
+
+        assert_eq!(forwarded.message.as_deref(), Some(large_message.as_str()));
+        assert!(
+            !forwarded
+                .message
+                .as_deref()
+                .expect("message should be preserved")
+                .contains("Full output saved to ")
+        );
+    }
+
     #[test]
     fn test_substitute_no_vars() {
         assert_eq!(substitute_env_vars("hello world"), "hello world");
```

**File**: `libs/mcp/proxy/src/server/mod.rs` (modified, +183/-0)
```diff
@@ -22,6 +22,7 @@ use rmcp::transport::streamable_http_client::StreamableHttpClientTransportConfig
 use stakpak_shared::cert_utils::CertificateChain;
 use stakpak_shared::paths::stakpak_home_dir;
 use stakpak_shared::secret_manager::SecretManager;
+use stakpak_shared::utils::{LargeOutputLimits, handle_large_output_with_limits};
 use std::collections::HashMap;
 use std::future::Future;
 use std::sync::Arc;
@@ -126,6 +127,51 @@ fn restore_secrets_in_json_value(
     }
 }
 
+const PROXY_LARGE_OUTPUT_MAX_LINES: usize = 300;
+const PROXY_LARGE_OUTPUT_MAX_BYTES: usize = 64 * 1024;
+
+fn artifact_final_tool_result_text(
+    mut result: CallToolResult,
+    client_name: &str,
+    tool_name: &str,
+) -> CallToolResult {
+    let mut text_blocks = Vec::new();
+    let mut non_text_content = Vec::new();
+
+    for item in result.content {
+        if let Some(text_content) = item.raw.as_text() {
+            text_blocks.push(text_content.text.clone());
+        } else {
+            non_text_content.push(item);
+        }
+    }
+
+    if text_blocks.is_empty() {
+        result.content = non_text_content;
+        return result;
+    }
+
+    let flattened_text = text_blocks.join("\n");
+    let file_prefix = format!("mcp-tool-output.{}.{}", client_name, tool_name);
+    let processed_text = match handle_large_output_with_limits(
+        &flattened_text,
+        LargeOutputLimits {
+            file_prefix: &file_prefix,
+            max_lines: PROXY_LARGE_OUTPUT_MAX_LINES,
+            max_bytes: PROXY_LARGE_OUTPUT_MAX_BYTES,
+            show_head: false,
+        },
+    ) {
+        Ok(text) => text,
+        Err(e) => format!("FAILED_TO_HANDLE_LARGE_OUTPUT: {}", e),
+    };
+
+    result.content = std::iter::once(Content::text(processed_text))
+        .chain(non_text_content)
+        .collect();
+    result
+}
+
 #[derive(Debug, Clone)]
 struct RequestTracking {
     client_name: String,
@@ -670,6 +716,8 @@ impl ServerHandler for ProxyServer {
                 .collect();
         }
 
+        result = artifact_final_tool_result_text(result, &client_name, &tool_name);
+
         Ok(result)
     }
 
@@ -881,8 +929,40 @@ pub async fn start_proxy_server(
 #[cfg(test)]
 mod tests {
     use super::*;
+    use rmcp::model::ResourceContents;
     use serde_json::json;
 
+    fn text_content(content: &Content) -> &str {
+        content
+            .raw
+            .as_text()
+            .map(|text| text.text.as_str())
+            .expect("content should be text")
+    }
+
+    fn artifact_path_from_preview(preview: &str) -> &str {
+        preview
+            .lines()
+            .next()
+            .and_then(|line| line.split_once("Full output saved to "))
+            .map(|(_, path)| path)
+            .expect("preview should contain saved artifact path")
+    }
+
+    fn read_artifact_from_preview(preview: &str) -> String {
+        let artifact_path = artifact_path_from_preview(preview);
+        let artifact = std::fs::read_to_string(artifact_path).expect("artifact should be readable");
+        std::fs::remove_file(artifact_path).expect("artifact should be removable");
+        artifact
+    }
+
+    fn numbered_lines(prefix: &str, count: usize) -> String {
+        (1..=count)
+            .map(|line| format!("{prefix}-{line:03}"))
+            .collect::<Vec<_>>()
+            .join("\n")
+    }
+
     /// Helper: build a redaction map from pairs
     fn map(pairs: &[(&str, &str)]) -> HashMap<String, String> {
         pairs
@@ -891,6 +971,109 @@ mod tests {
             .collect()
     }
 
+    #[test]
+    fn artifact_final_tool_result_previews_large_success_text() {
+        let output = numbered_lines("success", 301);
+        let result = CallToolResult::success(vec![Content::text(output.clone())]);
+
+        let processed = artifact_final_tool_result_text(result, "stakpak", "run_command");
+
+        assert_eq!(processed.is_error, Some(false));
+        assert_eq!(processed.content.len(), 1);
+        let preview = text_content(&processed.content[0]);
+        assert!(preview.starts_with("Showing the last 300 / 301 output lines."));
+        assert!(preview.contains("Full output saved to "));
+        assert!(!preview.contains("success-001"));
+        assert!(preview.contains("success-301"));
+
+        let artifact = read_artifact_from_preview(preview);
+        assert_eq!(artifact, output);
+    }
+
+    #[test]
+    fn artifact_final_tool_result_preserves_large_error_status() {
+        let output = numbered_lines("error", 301);
+        let result = CallToolResult::error(vec![Content::text(output.clone())]);
+
+        let processed = artifact_final_tool_result_text(result, "stakpak", "get_task_details");
+
+        assert_eq!(processed.is_error, Some(true));
+        assert_eq!(processed.content.len(), 1);
+        let preview = text_content(&processed.content[0]);
+        assert!(preview.starts_with("Showing the last 300 / 301 output lines."));
+
+        let artifact = read_artifa
```

**File**: `libs/mcp/server/src/local_tools.rs` (modified, +4/-42)
```diff
@@ -25,7 +25,7 @@ use stakpak_shared::models::integrations::openai::{
 use stakpak_shared::task_manager::{StartTaskOptions, TaskInfo};
 use stakpak_shared::tls_client::{TlsClientConfig, create_tls_client};
 use stakpak_shared::utils::{
-    LocalFileSystemProvider, generate_directory_tree, handle_large_output, sanitize_text_output,
+    LocalFileSystemProvider, generate_directory_tree, sanitize_text_output,
 };
 use std::fs::{self};
 use std::path::Path;
@@ -309,8 +309,6 @@ impl ToolContainer {
     #[tool(
         description = "Execute a shell command locally with full system access.
 
-If the command's output exceeds 300 lines the result will be truncated and the full output will be saved to a file in the current directory.
-
 For remote command execution via SSH, use the run_remote_command tool instead."
     )]
     pub async fn run_command(
@@ -338,8 +336,6 @@ REMOTE EXECUTION:
   * 'user@server.com' (uses default port 22 and auto-discovered keys)
   * 'user@server.com:2222' with password authentication
 
-If the command's output exceeds 300 lines the result will be truncated and the full output will be saved to a file in the current directory.
-
 For local command execution, use the run_command tool instead.")]
     pub async fn run_remote_command(
         &self,
@@ -702,8 +698,6 @@ This tool provides comprehensive details about a background task started with ru
 - Complete command output
 - Error information if the task failed
 
-If the task output exceeds 300 lines the result will be truncated and the full output will be saved to a file in the current directory.
-
 Use this tool to check the progress and results of long-running background tasks."
     )]
     pub async fn get_task_details(
@@ -760,16 +754,7 @@ Use this tool to check the progress and results of long-running background tasks
                         // Subagent output - use Display impl for LLM-friendly formatting
                         manifest.to_string()
                     } else {
-                        // Regular task output - use standard handling
-                        match handle_large_output(output, "task.output", 300, false) {
-                            Ok(result) => result,
-                            Err(e) => {
-                                return Ok(CallToolResult::error(vec![
-                                    Content::text("OUTPUT_HANDLING_ERROR"),
-                                    Content::text(format!("Failed to handle task output: {}", e)),
-                                ]));
-                            }
-                        }
+                        output.clone()
                     }
                 } else {
                     "No output available".to_string()
@@ -1018,9 +1003,7 @@ SECURITY FEATURES:
 - Only allows HTTPS URLs for secure connections
 - Follows redirects safely with limits
 
-The tool fetches the HTML content from the specified URL and converts it to clean, readable markdown. This is useful for reading web articles, documentation, or any web content in a text-friendly format.
-
-The response will be truncated if it exceeds 300 lines, with the full content saved to a local file."
+The tool fetches the HTML content from the specified URL and converts it to clean, readable markdown. This is useful for reading web articles, documentation, or any web content in a text-friendly format."
     )]
     pub async fn view_web_page(
         &self,
@@ -1097,17 +1080,7 @@ The response will be truncated if it exceeds 300 lines, with the full content sa
         let markdown_content = html2md::rewrite_html(&html_content, false);
         let sanitized_content = sanitize_text_output(&markdown_content);
 
-        let result = match handle_large_output(&sanitized_content, "webpage", 300, false) {
-            Ok(result) => result,
-            Err(e) => {
-                return Ok(CallToolResult::error(vec![
-                    Content::text("OUTPUT_HANDLING_ERROR"),
-                    Content::text(format!("Failed to handle output: {}", e)),
-                ]));
-            }
-        };
-
-        let formatted_output = format!("# Web Page Content: {}\n\n{}", url, result);
+        let formatted_output = format!("# Web Page Content: {}\n\n{}", url, sanitized_content);
 
         Ok(CallToolResult::success(vec![Content::text(
             &formatted_output,
@@ -1232,17 +1205,6 @@ SAFETY NOTES:
     fn format_command_result(
         command_result: &mut CommandResult,
     ) -> Result<CallToolResult, McpError> {
-        command_result.output =
-            match handle_large_output(&command_result.output, "command.output", 300, false) {
-                Ok(result) => result,
-                Err(e) => {
-                    return Ok(CallToolResult::error(vec![
-                        Content::text("OUTPUT_HANDLING_ERROR"),
-                        Content::text(format!("Failed to handle command output: {}", e)),
-                    ]));
-                }
-            
```

**File**: `libs/mcp/server/src/remote_tools.rs` (modified, +2/-25)
```diff
@@ -5,7 +5,7 @@ use rmcp::{
 };
 use serde::Deserialize;
 use stakpak_api::models::SearchDocsRequest as ApiSearchDocsRequest;
-use stakpak_shared::utils::{handle_large_output, sanitize_text_output};
+use stakpak_shared::utils::sanitize_text_output;
 // use stakpak_api::models::CodeIndex;
 // use stakpak_shared::local_store::LocalStore;
 // use stakpak_shared::models::indexing::IndexingStatus;
@@ -302,34 +302,11 @@ If your goal requires understanding multiple distinct topics or technologies, ma
             }
         };
 
-        const MAX_LINES: usize = 600;
-
-        let mut remaining_lines = MAX_LINES;
-        let mut remaining_items = response.len();
-
         let processed: Vec<Content> = response
             .into_iter()
             .map(|c| {
-                // Compute this element's allowance at the last possible moment
-                let allowance = if remaining_items > 0 {
-                    (remaining_lines / remaining_items).max(1)
-                } else {
-                    1
-                };
-
-                remaining_items = remaining_items.saturating_sub(1);
-
                 if let Some(RawTextContent { text, meta: None }) = c.as_text() {
-                    let sanitized = sanitize_text_output(text);
-                    match handle_large_output(&sanitized, "search", allowance, true) {
-                        Ok(final_text) => {
-                            // Estimate consumption (best-effort)
-                            let used = final_text.lines().count().min(remaining_lines);
-                            remaining_lines = remaining_lines.saturating_sub(used);
-                            Content::text(final_text)
-                        }
-                        Err(e) => Content::text(format!("FAILED_TO_HANDLE_LARGE_OUTPUT: {}", e)),
-                    }
+                    Content::text(sanitize_text_output(text))
                 } else {
                     c
                 }
```

**File**: `libs/shared/src/utils.rs` (modified, +245/-36)
```diff
@@ -3,6 +3,7 @@ use async_trait::async_trait;
 use rand::Rng;
 use std::fs;
 use std::path::{Path, PathBuf};
+use uuid::Uuid;
 use walkdir::DirEntry;
 
 /// Read .gitignore patterns from the specified base directory
@@ -250,6 +251,132 @@ pub fn truncate_chars_with_ellipsis(text: &str, max_chars: usize) -> String {
     truncated
 }
 
+pub struct LargeOutputLimits<'a> {
+    pub file_prefix: &'a str,
+    pub max_lines: usize,
+    pub max_bytes: usize,
+    pub show_head: bool,
+}
+
+fn sanitize_artifact_file_prefix(file_prefix: &str) -> String {
+    let sanitized = file_prefix
+        .chars()
+        .map(|c| {
+            if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.') {
+                c
+            } else {
+                '-'
+            }
+        })
+        .collect::<String>()
+        .trim_matches(|c| matches!(c, '-' | '_' | '.'))
+        .to_string();
+
+    if sanitized.is_empty() {
+        "output".to_string()
+    } else {
+        sanitized
+    }
+}
+
+fn write_output_artifact(file_prefix: &str, output: &str) -> Result<String, String> {
+    let output_file = format!(
+        "{}.{}.txt",
+        sanitize_artifact_file_prefix(file_prefix),
+        Uuid::new_v4().simple()
+    );
+
+    LocalStore::write_session_data(&output_file, output)
+        .map_err(|e| format!("Failed to write session data: {}", e))
+}
+
+fn line_preview(
+    output_lines: &[&str],
+    output_file_path: &str,
+    max_lines: usize,
+    show_head: bool,
+) -> String {
+    let excerpt = if show_head {
+        let head_lines: Vec<&str> = output_lines.iter().take(max_lines).copied().collect();
+        head_lines.join("\n")
+    } else {
+        let mut tail_lines: Vec<&str> =
+            output_lines.iter().rev().take(max_lines).copied().collect();
+        tail_lines.reverse();
+        tail_lines.join("\n")
+    };
+
+    let position = if show_head { "first" } else { "last" };
+    format!(
+        "Showing the {} {} / {} output lines. Full output saved to {}\n{}\n{}",
+        position,
+        max_lines,
+        output_lines.len(),
+        output_file_path,
+        if show_head { "" } else { "...\n" },
+        excerpt
+    )
+}
+
+// start/end are adjusted to valid UTF-8 character boundaries before slicing.
+#[allow(clippy::string_slice)]
+fn byte_excerpt(output: &str, max_bytes: usize, show_head: bool) -> (&str, usize) {
+    if show_head {
+        let mut end = max_bytes.min(output.len());
+        while end > 0 && !output.is_char_boundary(end) {
+            end -= 1;
+        }
+        (&output[..end], end)
+    } else {
+        let mut start = output.len().saturating_sub(max_bytes);
+        while start < output.len() && !output.is_char_boundary(start) {
+            start += 1;
+        }
+        (&output[start..], output.len() - start)
+    }
+}
+
+fn byte_preview(output: &str, output_file_path: &str, max_bytes: usize, show_head: bool) -> String {
+    let (excerpt, excerpt_bytes) = byte_excerpt(output, max_bytes, show_head);
+    let position = if show_head { "first" } else { "last" };
+
+    format!(
+        "Showing the {} {} / {} output bytes. Full output saved to {}\n{}\n{}",
+        position,
+        excerpt_bytes,
+        output.len(),
+        output_file_path,
+        if show_head { "" } else { "...\n" },
+        excerpt
+    )
+}
+
+pub fn handle_large_output_with_limits(
+    output: &str,
+    limits: LargeOutputLimits<'_>,
+) -> Result<String, String> {
+    let output_lines = output.lines().collect::<Vec<_>>();
+    if output_lines.len() >= limits.max_lines {
+        let output_file_path = write_output_artifact(limits.file_prefix, output)?;
+        Ok(line_preview(
+            &output_lines,
+            &output_file_path,
+            limits.max_lines,
+            limits.show_head,
+        ))
+    } else if output.len() > limits.max_bytes {
+        let output_file_path = write_output_artifact(limits.file_prefix, output)?;
+        Ok(byte_preview(
+            output,
+            &output_file_path,
+            limits.max_bytes,
+            limits.show_head,
+        ))
+    } else {
+        Ok(output.to_string())
+    }
+}
+
 /// Handle large output: if the output has >= `max_lines`, save the full content to session
 /// storage and return a string showing only the first or last `max_lines` lines with a pointer
 /// to the saved file. Returns `Ok(final_string)` or `Err(error_string)` on failure.
@@ -259,44 +386,15 @@ pub fn handle_large_output(
     max_lines: usize,
     show_head: bool,
 ) -> Result<String, String> {
-    let output_lines = output.lines().collect::<Vec<_>>();
-    if output_lines.len() >= max_lines {
-        let mut __rng__ = rand::rng();
-        let output_file = format!(
-            "{}.{:06x}.txt",
+    handle_large_output_with_limits(
+        output,
+        LargeOutputLimits {
             file_prefix,
-            __rng__.random_range(0..=0xFFFFFF)
-        );
-        let output_file_path = match LocalSt
```

---

### Incident Patch 6: `b2f9b8e5` (2026-06-04)
**Commit Message**: Merge pull request #749 from stakpak/feat/aap-builtin-mcp-server

feat(mcp): add aap as built-in remote MCP server

**File**: `cli/src/commands/agent/run/mcp_init.rs` (modified, +31/-4)
```diff
@@ -187,6 +187,8 @@ async fn start_mcp_server(
 fn build_proxy_config(
     local_server_url: String,
     server_cert_chain: Arc<Option<CertificateChain>>,
+    api_endpoint: &str,
+    api_key: Option<&str>,
 ) -> ClientPoolConfig {
     let mut servers: HashMap<String, ServerConfig> = HashMap::new();
 
@@ -201,24 +203,44 @@ fn build_proxy_config(
         },
     );
 
-    // Add external paks server
+    // Add external paks server (derived from api_endpoint so local profiles work)
+    let api_base = api_endpoint.trim_end_matches('/');
     servers.insert(
         "paks".to_string(),
         ServerConfig::Http {
-            url: "https://apiv2.stakpak.dev/v1/paks/mcp".to_string(),
+            url: format!("{api_base}/v1/paks/mcp"),
             headers: None,
             certificate_chain: Arc::new(None),
             client_tls_config: None,
         },
     );
 
+    // Add external aap server (derived from api_endpoint so local profiles work).
+    // AAP requires `Authorization: Bearer <api_key>` on every call. The session
+    // id is forwarded via the JSON-RPC `_meta["dev.stakpak/session-id"]` field
+    // (set in cli/src/commands/agent/run/tooling.rs), not as an HTTP header.
+    let aap_headers = api_key.map(|key| {
+        let mut h = HashMap::new();
+        h.insert("Authorization".to_string(), format!("Bearer {key}"));
+        h
+    });
+    servers.insert(
+        "aap".to_string(),
+        ServerConfig::Http {
+            url: format!("{api_base}/v1/aap/mcp"),
+            headers: aap_headers,
+            certificate_chain: Arc::new(None),
+            client_tls_config: None,
+        },
+    );
+
     // Load external servers from config file (skip mcp_servers with reserved names)
     if let Ok(config_path) = stakpak_mcp_config::find_config_file() {
         match load_external_servers(&config_path) {
             Ok(external_servers) => {
                 let mut loaded_servers = 0;
                 for (name, config) in external_servers {
-                    if name == "stakpak" || name == "paks" {
+                    if name == "stakpak" || name == "paks" || name == "aap" {
                         tracing::warn!(
                             "Skipping external MCP server {} (reserved for stakpak's internal use)",
                             name
@@ -365,7 +387,12 @@ pub async fn initialize_mcp_server_and_tools(
     .await?;
 
     // 5. Build and start proxy
-    let pool_config = build_proxy_config(local_mcp_server_url, certs.server_chain);
+    let pool_config = build_proxy_config(
+        local_mcp_server_url,
+        certs.server_chain,
+        &app_config.api_endpoint,
+        app_config.api_key.as_deref(),
+    );
     start_proxy(
         pool_config,
         &mcp_config,
```

**File**: `cli/src/commands/agent/run/tooling.rs` (modified, +8/-1)
```diff
@@ -63,9 +63,16 @@ pub async fn run_tool_call(
         let metadata = Some({
             let mut meta = serde_json::Map::new();
             if let Some(session_id) = session_id {
+                let session_id_str = session_id.to_string();
+                // Legacy key — consumed by the local stakpak MCP server (ctx.meta.get("session_id"))
                 meta.insert(
                     "session_id".to_string(),
-                    serde_json::Value::String(session_id.to_string()),
+                    serde_json::Value::String(session_id_str.clone()),
+                );
+                // MCP-spec-compliant reverse-DNS key — consumed by the AAP MCP server
+                meta.insert(
+                    "dev.stakpak/session-id".to_string(),
+                    serde_json::Value::String(session_id_str),
                 );
             }
             if let Some(model_id) = model_id {
```

**File**: `libs/mcp/config/src/lib.rs` (modified, +3/-3)
```diff
@@ -236,7 +236,7 @@ pub fn add_server(
     name: &str,
     entry: McpServerEntry,
 ) -> Result<(), String> {
-    if name == "stakpak" || name == "paks" {
+    if name == "stakpak" || name == "paks" || name == "aap" {
         return Err(format!("Cannot add server with reserved name '{name}'."));
     }
 
@@ -251,7 +251,7 @@ pub fn add_server(
 
 /// Remove a server entry. Fails if name not found.
 pub fn remove_server(config: &mut McpConfigFile, name: &str) -> Result<McpServerEntry, String> {
-    if name == "stakpak" || name == "paks" {
+    if name == "stakpak" || name == "paks" || name == "aap" {
         return Err(format!("Cannot remove internal server '{name}'."));
     }
 
@@ -267,7 +267,7 @@ pub fn set_server_disabled(
     name: &str,
     disabled: bool,
 ) -> Result<(), String> {
-    if name == "stakpak" || name == "paks" {
+    if name == "stakpak" || name == "paks" || name == "aap" {
         return Err(format!("Cannot modify internal server '{name}'."));
     }
 
```

**File**: `libs/server/src/sandbox.rs` (modified, +11/-0)
```diff
@@ -883,6 +883,17 @@ fn build_sandbox_proxy_config(
         },
     );
 
+    // Keep the external aap server accessible
+    servers.insert(
+        "aap".to_string(),
+        ServerConfig::Http {
+            url: "https://apiv2.stakpak.dev/v1/aap/mcp".to_string(),
+            headers: None,
+            certificate_chain: Arc::new(None),
+            client_tls_config: None,
+        },
+    );
+
     ClientPoolConfig::with_servers(servers)
 }
 
```

---

### Incident Patch 7: `a6d4afd4` (2026-06-04)
**Commit Message**: fix(knowledge) fix cached_path validation

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `libs/api/src/stakpak/knowledge/cache.rs` (modified, +3/-3)
```diff
@@ -24,12 +24,12 @@ fn knowledge_cache_root(account: &str) -> Option<PathBuf> {
 
 /// Compute the absolute on-disk path for a cached knowledge file.
 ///
-/// Refuses to resolve paths that contain [`..`, absolute paths, Windows-style backslashe] and returns `None`.
+/// Refuses to resolve paths that contain `..`, absolute paths (leading `/`), or Windows-style backslashes and returns `None`.
 pub fn cached_path(account: &str, rel_path: &str) -> Option<PathBuf> {
-    if rel_path.is_empty() || rel_path.contains("..") || rel_path.contains('\\') {
+    if rel_path.is_empty() || rel_path.starts_with('/') || rel_path.contains('\\') {
         return None;
     }
-    let trimmed = rel_path.trim_start_matches('/');
+    let trimmed = rel_path;
     if trimmed.is_empty() {
         return None;
     }
```

---

### Incident Patch 8: `e3524084` (2026-06-04)
**Commit Message**: fix(knowledge) make normalize knowledge path platform independent

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `libs/api/src/stakpak/knowledge/mod.rs` (modified, +3/-3)
```diff
@@ -124,10 +124,10 @@ fn normalize_knowledge_path(path: &str) -> Result<String, KnowledgeApiError> {
         return Ok(String::new());
     }
 
-    let mut relative = PathBuf::new();
+    let mut parts: Vec<String> = Vec::new();
     for component in Path::new(path).components() {
         match component {
-            Component::Normal(part) => relative.push(part),
+            Component::Normal(part) => parts.push(part.to_string_lossy().into_owned()),
             Component::CurDir => {}
             Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                 return Err(KnowledgeApiError::BadRequest {
@@ -137,7 +137,7 @@ fn normalize_knowledge_path(path: &str) -> Result<String, KnowledgeApiError> {
         }
     }
 
-    Ok(relative.to_string_lossy().into_owned())
+    Ok(parts.join("/"))
 }
 
 impl StakpakApiClient {
```

---

### Incident Patch 9: `46bee272` (2026-06-04)
**Commit Message**: fix(knowledge) use try_current instead of current in block on operations in knowledge not to panic

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `libs/ak/src/store.rs` (modified, +4/-2)
```diff
@@ -487,9 +487,11 @@ impl RemoteBackend {
 
 impl StorageBackend for RemoteBackend {
     fn create(&self, path: &str, content: &[u8]) -> Result<(), Error> {
+        let handle = tokio::runtime::Handle::try_current().map_err(|_| {
+            Error::Parse("remote backend requires a running tokio runtime".to_string())
+        })?;
         tokio::task::block_in_place(|| {
-            tokio::runtime::Handle::current()
-                .block_on(async { self.client.create_knowledge_file(path, content).await })
+            handle.block_on(async { self.client.create_knowledge_file(path, content).await })
         })
         .map(|_| ())
         .map_err(|e| map_knowledge_err(path, e))
```

---

### Incident Patch 10: `caa1ec1c` (2026-06-04)
**Commit Message**: fix(knowledge) fix the remote-knowledge cache path

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `libs/api/src/stakpak/knowledge/mod.rs` (modified, +1/-1)
```diff
@@ -210,7 +210,7 @@ impl StakpakApiClient {
     }
 
     /// Read a knowledge file. Uses the on-disk cache at
-    /// `~/.stakpak/remote-cache/knowledge/<account>/<path>` together with the
+    /// `~/.stakpak/remote-knowledge/<account>/<path>` together with the
     /// server's `If-None-Match` support to avoid re-downloading unchanged
     /// content.
     pub async fn read_knowledge_file(&self, path: &str) -> Result<Vec<u8>, KnowledgeApiError> {
```

---

### Incident Patch 11: `df0f5c0d` (2026-06-04)
**Commit Message**: feat(mcp): add aap as built-in remote MCP server

Wires up the AAP MCP service (`/v1/aap/mcp`) as a built-in upstream alongside
`stakpak` and `paks`, with auth and session forwarding per the AAP spec.

Changes:

- `cli/src/commands/agent/run/mcp_init.rs`: register `aap` upstream in
  `build_proxy_config()`, derive its URL from `AppConfig.api_endpoint` (so
  local profiles work), and attach a static `Authorization: Bearer <api_key>`
  header. `paks` URL is now also derived from `api_endpoint` for consistency.
- `cli/src/commands/agent/run/tooling.rs`: add the MCP-spec-compliant
  reverse-DNS key `dev.stakpak/session-id` to per-call `_meta` alongside
  the legacy `session_id` key. AAP reads the new key; existing consumers
  (local stakpak server) keep using the legacy one.
- `libs/mcp/config/src/lib.rs`: add `aap` to the reserved-name list so
  user-supplied MCP configs can't shadow the built-in.
- `libs/server/src/sandbox.rs`: register `aap` in the sandbox proxy too.

Tested with `./target/debug/stakpak --profile local -a` against a local AAP
server: `aap__list_capabilities` and `aap__execute_capability` both succeed
end-to-end (verified with a real Langfuse query).

Known follow-up

**File**: `cli/src/commands/agent/run/mcp_init.rs` (modified, +31/-4)
```diff
@@ -187,6 +187,8 @@ async fn start_mcp_server(
 fn build_proxy_config(
     local_server_url: String,
     server_cert_chain: Arc<Option<CertificateChain>>,
+    api_endpoint: &str,
+    api_key: Option<&str>,
 ) -> ClientPoolConfig {
     let mut servers: HashMap<String, ServerConfig> = HashMap::new();
 
@@ -201,24 +203,44 @@ fn build_proxy_config(
         },
     );
 
-    // Add external paks server
+    // Add external paks server (derived from api_endpoint so local profiles work)
+    let api_base = api_endpoint.trim_end_matches('/');
     servers.insert(
         "paks".to_string(),
         ServerConfig::Http {
-            url: "https://apiv2.stakpak.dev/v1/paks/mcp".to_string(),
+            url: format!("{api_base}/v1/paks/mcp"),
             headers: None,
             certificate_chain: Arc::new(None),
             client_tls_config: None,
         },
     );
 
+    // Add external aap server (derived from api_endpoint so local profiles work).
+    // AAP requires `Authorization: Bearer <api_key>` on every call. The session
+    // id is forwarded via the JSON-RPC `_meta["dev.stakpak/session-id"]` field
+    // (set in cli/src/commands/agent/run/tooling.rs), not as an HTTP header.
+    let aap_headers = api_key.map(|key| {
+        let mut h = HashMap::new();
+        h.insert("Authorization".to_string(), format!("Bearer {key}"));
+        h
+    });
+    servers.insert(
+        "aap".to_string(),
+        ServerConfig::Http {
+            url: format!("{api_base}/v1/aap/mcp"),
+            headers: aap_headers,
+            certificate_chain: Arc::new(None),
+            client_tls_config: None,
+        },
+    );
+
     // Load external servers from config file (skip mcp_servers with reserved names)
     if let Ok(config_path) = stakpak_mcp_config::find_config_file() {
         match load_external_servers(&config_path) {
             Ok(external_servers) => {
                 let mut loaded_servers = 0;
                 for (name, config) in external_servers {
-                    if name == "stakpak" || name == "paks" {
+                    if name == "stakpak" || name == "paks" || name == "aap" {
                         tracing::warn!(
                             "Skipping external MCP server {} (reserved for stakpak's internal use)",
                             name
@@ -365,7 +387,12 @@ pub async fn initialize_mcp_server_and_tools(
     .await?;
 
     // 5. Build and start proxy
-    let pool_config = build_proxy_config(local_mcp_server_url, certs.server_chain);
+    let pool_config = build_proxy_config(
+        local_mcp_server_url,
+        certs.server_chain,
+        &app_config.api_endpoint,
+        app_config.api_key.as_deref(),
+    );
     start_proxy(
         pool_config,
         &mcp_config,
```

**File**: `cli/src/commands/agent/run/tooling.rs` (modified, +8/-1)
```diff
@@ -63,9 +63,16 @@ pub async fn run_tool_call(
         let metadata = Some({
             let mut meta = serde_json::Map::new();
             if let Some(session_id) = session_id {
+                let session_id_str = session_id.to_string();
+                // Legacy key — consumed by the local stakpak MCP server (ctx.meta.get("session_id"))
                 meta.insert(
                     "session_id".to_string(),
-                    serde_json::Value::String(session_id.to_string()),
+                    serde_json::Value::String(session_id_str.clone()),
+                );
+                // MCP-spec-compliant reverse-DNS key — consumed by the AAP MCP server
+                meta.insert(
+                    "dev.stakpak/session-id".to_string(),
+                    serde_json::Value::String(session_id_str),
                 );
             }
             if let Some(model_id) = model_id {
```

**File**: `libs/mcp/config/src/lib.rs` (modified, +3/-3)
```diff
@@ -236,7 +236,7 @@ pub fn add_server(
     name: &str,
     entry: McpServerEntry,
 ) -> Result<(), String> {
-    if name == "stakpak" || name == "paks" {
+    if name == "stakpak" || name == "paks" || name == "aap" {
         return Err(format!("Cannot add server with reserved name '{name}'."));
     }
 
@@ -251,7 +251,7 @@ pub fn add_server(
 
 /// Remove a server entry. Fails if name not found.
 pub fn remove_server(config: &mut McpConfigFile, name: &str) -> Result<McpServerEntry, String> {
-    if name == "stakpak" || name == "paks" {
+    if name == "stakpak" || name == "paks" || name == "aap" {
         return Err(format!("Cannot remove internal server '{name}'."));
     }
 
@@ -267,7 +267,7 @@ pub fn set_server_disabled(
     name: &str,
     disabled: bool,
 ) -> Result<(), String> {
-    if name == "stakpak" || name == "paks" {
+    if name == "stakpak" || name == "paks" || name == "aap" {
         return Err(format!("Cannot modify internal server '{name}'."));
     }
 
```

**File**: `libs/server/src/sandbox.rs` (modified, +11/-0)
```diff
@@ -883,6 +883,17 @@ fn build_sandbox_proxy_config(
         },
     );
 
+    // Keep the external aap server accessible
+    servers.insert(
+        "aap".to_string(),
+        ServerConfig::Http {
+            url: "https://apiv2.stakpak.dev/v1/aap/mcp".to_string(),
+            headers: None,
+            certificate_chain: Arc::new(None),
+            client_tls_config: None,
+        },
+    );
+
     ClientPoolConfig::with_servers(servers)
 }
 
```

---

### Incident Patch 12: `65290550` (2026-06-03)
**Commit Message**: fixes

**File**: `cli/src/commands/autopilot/mod.rs` (modified, +98/-9)
```diff
@@ -570,6 +570,9 @@ fn default_enabled() -> bool {
     true
 }
 
+const MIN_SCHEDULE_MAX_TURNS: usize = 1;
+const MAX_SCHEDULE_MAX_TURNS: usize = 256;
+
 fn load_toml_root_table(path: &Path) -> Result<toml::value::Table, String> {
     if !path.exists() {
         return Ok(toml::value::Table::new());
@@ -2560,6 +2563,14 @@ fn resolve_schedule_notify_target(
     }
 }
 
+fn validate_schedule_max_turns(flag: &str, value: usize) -> Result<usize, String> {
+    if (MIN_SCHEDULE_MAX_TURNS..=MAX_SCHEDULE_MAX_TURNS).contains(&value) {
+        Ok(value)
+    } else {
+        Err(format!("{flag} must be 1-256, got {value}"))
+    }
+}
+
 fn resolve_schedule_max_turns(
     max_turns: Option<usize>,
     max_steps: Option<usize>,
@@ -2569,15 +2580,26 @@ fn resolve_schedule_max_turns(
             "Conflicting turn limit flags: --max-turns {} and deprecated --max-steps {}. Use only --max-turns.",
             turns, steps
         )),
-        (Some(turns), None) => Ok(Some(turns)),
+        (Some(turns), None) => validate_schedule_max_turns("--max-turns", turns).map(Some),
         (None, Some(steps)) => {
+            let steps = validate_schedule_max_turns("--max-steps", steps)?;
             eprintln!("Warning: --max-steps is deprecated; use --max-turns instead.");
             Ok(Some(steps))
         }
         (None, None) => Ok(None),
     }
 }
 
+fn schedule_has_notification_route(schedule: &AutopilotScheduleConfig) -> bool {
+    schedule
+        .notify_channel
+        .as_deref()
+        .is_some_and(|channel| !channel.trim().is_empty())
+        || schedule
+            .resolved_notify_target()
+            .is_some_and(|target| !target.trim().is_empty())
+}
+
 #[cfg(test)]
 fn add_schedule_in_config(
     config: &mut AutopilotConfigFile,
@@ -2680,6 +2702,10 @@ fn add_schedule_to_path(path: &Path, schedule: AutopilotScheduleConfig) -> Resul
     validate_schedule(&schedule)?;
 
     let mut root = load_toml_root_table(path)?;
+    if schedule_has_notification_route(&schedule) {
+        ensure_notification_gateway_config(&mut root);
+    }
+
     let schedules = schedule_array_mut(&mut root)?;
     if schedules
         .iter()
@@ -2887,6 +2913,17 @@ fn resolve_default_gateway_url(root: &toml::value::Table) -> String {
         .unwrap_or_else(|| "http://127.0.0.1:4096".to_string())
 }
 
+fn ensure_notification_gateway_config(root: &mut toml::value::Table) {
+    let default_gateway_url = resolve_default_gateway_url(root);
+    let notifications = ensure_toml_table(root, "notifications");
+    if !notifications.contains_key("gateway_url") {
+        notifications.insert(
+            "gateway_url".to_string(),
+            toml::Value::String(default_gateway_url),
+        );
+    }
+}
+
 fn apply_default_notification_target(
     root: &mut toml::value::Table,
     channel: &str,
@@ -2900,15 +2937,8 @@ fn apply_default_notification_target(
         return Err("Target cannot be empty".to_string());
     }
 
-    let default_gateway_url = resolve_default_gateway_url(root);
-
+    ensure_notification_gateway_config(root);
     let notifications = ensure_toml_table(root, "notifications");
-    if !notifications.contains_key("gateway_url") {
-        notifications.insert(
-            "gateway_url".to_string(),
-            toml::Value::String(default_gateway_url),
-        );
-    }
     notifications.insert(
         "channel".to_string(),
         toml::Value::String(channel.trim().to_string()),
@@ -4935,6 +4965,46 @@ target = "#default"
         let _ = std::fs::remove_file(path);
     }
 
+    #[test]
+    fn schedule_add_to_path_creates_notification_gateway_for_schedule_route() {
+        let path = temp_file_path("autopilot-schedule-add-route-gateway");
+        std::fs::write(
+            &path,
+            r##"
+[server]
+listen = "127.0.0.1:4097"
+"##,
+        )
+        .expect("write config");
+
+        let mut schedule = sample_schedule("slack-alert");
+        schedule.notify_channel = Some("slack".to_string());
+        schedule.notify_target = Some("#ops".to_string());
+
+        add_schedule_to_path(&path, schedule).expect("schedule should be added");
+
+        let reloaded = std::fs::read_to_string(&path).expect("read config");
+        assert!(reloaded.contains("[notifications]"));
+        assert!(reloaded.contains("gateway_url = \"http://127.0.0.1:4097\""));
+        assert!(reloaded.contains("notify_channel = \"slack\""));
+        assert!(reloaded.contains("notify_target = \"#ops\""));
+
+        let runtime_config =
+            crate::commands::watch::ScheduleConfig::load(&path).expect("runtime should load");
+        let notifications = runtime_config
+            .notifications
+            .as_ref()
+            .expect("notifications should be created for schedule-specific route");
+        let delivery = runtime_config.schedules[0]
+            .effective_delivery(notifications)
+            .expect("schedule route should be runtime-readable");
+
+        assert_eq!
```

**File**: `cli/tests/ak_cli.rs` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ use std::process::Command;
 
 const RETROSPECT_MARKDOWN: &str = include_str!("../../libs/ak/src/skills/retrospect.v1.md");
 
-const AUTOPILOT_ONE_LINER: &str = r#"stakpak autopilot schedule add --name retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)""#;
+const AUTOPILOT_ONE_LINER: &str = r#"stakpak autopilot schedule add retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)""#;
 
 #[test]
 fn ak_skill_retrospect_prints_bundled_prompt() {
```

**File**: `libs/ak/src/skills.rs` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ pub const SKILL_MAINTAIN: &str = include_str!("skills/maintain.v1.md");
 mod tests {
     use super::{SKILL_RETROSPECT, SKILL_USAGE};
 
-    const AUTOPILOT_ONE_LINER: &str = r#"stakpak autopilot schedule add --name retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)""#;
+    const AUTOPILOT_ONE_LINER: &str = r#"stakpak autopilot schedule add retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)""#;
 
     #[test]
     fn retrospect_skill_matches_bundled_markdown() {
@@ -26,7 +26,7 @@ mod tests {
         );
         assert!(
             SKILL_RETROSPECT.trim_end().ends_with(
-                r#"stakpak autopilot schedule add --name retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)""#
+                r#"stakpak autopilot schedule add retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)""#
             ),
             "SKILL_RETROSPECT appears to have been trimmed or mutated at its tail"
         );
```

**File**: `libs/ak/src/skills/retrospect.v1.md` (modified, +1/-1)
```diff
@@ -127,4 +127,4 @@ runs.
 
 Schedule this skill via the canonical one-liner:
 
-    stakpak autopilot schedule add --name retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)"
+    stakpak autopilot schedule add retrospect --cron "0 3 * * *" --prompt "$(stakpak ak skill retrospect)"
```

---

### Incident Patch 13: `1cde9a66` (2026-06-01)
**Commit Message**: Merge pull request #743 from stakpak/fix/sanitize-anthropic-tool-ids

fix(ai): rewrite invalid tool_use IDs for Anthropic-family providers

**File**: `libs/ai/src/providers/anthropic/convert.rs` (modified, +280/-1)
```diff
@@ -13,7 +13,7 @@ use crate::types::{
     OutputTokenDetails, ResponseContent, Role, Usage,
 };
 use serde_json::json;
-use std::collections::HashSet;
+use std::collections::{HashMap, HashSet};
 
 /// Check whether the target model belongs to the Opus 4.7 (or later) family.
 ///
@@ -521,6 +521,8 @@ fn sanitize_anthropic_message(msg: &mut AnthropicMessage) {
 /// 6. Conversation must not end with role="assistant" (no prefill — some
 ///    models reject it; defensive for cross-model compatibility)
 /// 7. Re-merges consecutive same-role messages after mutations
+/// 8. Tool IDs must match Anthropic-family provider validation
+///    (`^[a-zA-Z0-9_-]+$`)
 fn sanitize_message_sequence(messages: &mut Vec<AnthropicMessage>) {
     if messages.is_empty() {
         return;
@@ -561,6 +563,10 @@ fn sanitize_message_sequence(messages: &mut Vec<AnthropicMessage>) {
 
     // Step 7: Ensure the conversation does not end with an assistant message.
     ensure_not_trailing_assistant(messages);
+
+    // Step 8: Rewrite invalid tool_use/tool_result IDs after all structural
+    // fixes, so injected placeholder results are covered too.
+    sanitize_tool_use_ids(messages);
 }
 
 /// Ensure every `tool_use` in assistant messages has a matching `tool_result`
@@ -857,6 +863,132 @@ fn inject_placeholder_tool_results(msg: &mut AnthropicMessage, missing_ids: &[St
     }
 }
 
+/// Rewrite invalid `tool_use.id` and matching `tool_result.tool_use_id` values
+/// in the outgoing request. This preserves local conversation history while
+/// satisfying Anthropic-family validators that require `^[a-zA-Z0-9_-]+$`.
+///
+/// Uses a two-pass approach to avoid clobbering originally-valid IDs:
+///
+/// 1. **Reserve pass**: collect every already-valid ID (matches
+///    `^[a-zA-Z0-9_-]+$`) into `used_ids`/`id_map` (mapping it to itself).
+///    These IDs are never rewritten, even if a later invalid ID would
+///    normalize to the same value.
+/// 2. **Rewrite pass**: visit every block again and only rename invalid or
+///    empty IDs. Collision resolution in `safe_anthropic_tool_id` then suffixes
+///    the *sanitized* ID (e.g. `a_b_2`) instead of stealing a reserved valid
+///    original (`a_b`).
+fn sanitize_tool_use_ids(messages: &mut [AnthropicMessage]) {
+    let mut id_map = HashMap::new();
+    let mut used_ids = HashSet::new();
+
+    // Pass 1: reserve all already-valid IDs so they cannot be clobbered by
+    // a later invalid ID that normalizes to the same value.
+    for message in messages.iter() {
+        let AnthropicMessageContent::Blocks(blocks) = &message.content else {
+            continue;
+        };
+
+        for block in blocks {
+            let id = match block {
+                AnthropicContent::ToolUse { id, .. } => id,
+                AnthropicContent::ToolResult { tool_use_id, .. } => tool_use_id,
+                _ => continue,
+            };
+
+            if is_anthropic_tool_id(id) && !used_ids.contains(id) {
+                used_ids.insert(id.clone());
+                id_map.insert(id.clone(), id.clone());
+            }
+        }
+    }
+
+    // Pass 2: rewrite only invalid/empty IDs. Already-valid IDs were
+    // registered above and are short-circuited by the lookup in
+    // `safe_anthropic_tool_id`.
+    for message in messages {
+        let AnthropicMessageContent::Blocks(blocks) = &mut message.content else {
+            continue;
+        };
+
+        for block in blocks {
+            match block {
+                AnthropicContent::ToolUse { id, .. } => {
+                    rewrite_tool_id(id, &mut id_map, &mut used_ids);
+                }
+                AnthropicContent::ToolResult { tool_use_id, .. } => {
+                    rewrite_tool_id(tool_use_id, &mut id_map, &mut used_ids);
+                }
+                _ => {}
+            }
+        }
+    }
+}
+
+fn rewrite_tool_id(
+    id: &mut String,
+    id_map: &mut HashMap<String, String>,
+    used_ids: &mut HashSet<String>,
+) {
+    // Already-valid IDs were reserved in pass 1 of `sanitize_tool_use_ids`
+    // and are therefore present in `id_map` (mapped to themselves). Nothing
+    // to do here.
+    if is_anthropic_tool_id(id) && id_map.get(id).is_some_and(|mapped| mapped == id) {
+        return;
+    }
+
+    let safe_id = safe_anthropic_tool_id(id, id_map, used_ids);
+    if safe_id != *id {
+        *id = safe_id;
+    }
+}
+
+fn safe_anthropic_tool_id(
+    original_id: &str,
+    id_map: &mut HashMap<String, String>,
+    used_ids: &mut HashSet<String>,
+) -> String {
+    if let Some(mapped) = id_map.get(original_id) {
+        return mapped.clone();
+    }
+
+    let base = normalize_anthropic_tool_id(original_id);
+    let mut candidate = if base.is_empty() {
+        "toolu".to_string()
+    } else {
+        base
+    };
+
+    if used_ids.contains(&candidate) {
+        let base = candidate;
+        let mut suffix = 2usize;
+        loop {
+            candidate = format!("{base}_{suffix}
```

**File**: `libs/ai/src/providers/bedrock/convert.rs` (modified, +46/-1)
```diff
@@ -82,7 +82,7 @@ pub fn to_bedrock_body(
 mod tests {
     use super::*;
     use crate::providers::anthropic::types::AnthropicConfig;
-    use crate::types::{GenerateRequest, Message, Model, Role};
+    use crate::types::{ContentPart, GenerateRequest, Message, MessageContent, Model, Role};
 
     /// Helper to create a dummy AnthropicConfig for Bedrock conversion
     /// (Bedrock doesn't use the API key, but the conversion layer needs a valid config)
@@ -176,6 +176,51 @@ mod tests {
         assert_eq!(messages[0]["role"], "user");
     }
 
+    #[test]
+    fn test_bedrock_body_rewrites_invalid_tool_use_ids() {
+        let invalid_id = "kimi.tool/use:1";
+        let request = GenerateRequest::new(
+            Model::custom("anthropic.claude-opus-4-5-20251101-v1:0", "bedrock"),
+            vec![
+                Message::new(Role::User, "Use the tool."),
+                Message::new(
+                    Role::Assistant,
+                    MessageContent::Parts(vec![ContentPart::tool_call(
+                        invalid_id,
+                        "search",
+                        serde_json::json!({"query": "rust"}),
+                    )]),
+                ),
+                Message::new(
+                    Role::Tool,
+                    MessageContent::Parts(vec![ContentPart::tool_result(
+                        invalid_id,
+                        serde_json::json!("result"),
+                    )]),
+                ),
+            ],
+        );
+
+        let result = to_bedrock_body(&request, &dummy_anthropic_config()).unwrap();
+        let messages = result.body["messages"].as_array().expect("messages array");
+
+        let tool_use_id = messages[1]["content"][0]["id"]
+            .as_str()
+            .expect("tool_use id");
+        let tool_result_id = messages[2]["content"][0]["tool_use_id"]
+            .as_str()
+            .expect("tool_result id");
+
+        assert_ne!(tool_use_id, invalid_id);
+        assert_eq!(tool_result_id, tool_use_id);
+        assert!(
+            tool_use_id
+                .chars()
+                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-'),
+            "Bedrock tool_use.id must match ^[a-zA-Z0-9_-]+$, got {tool_use_id}"
+        );
+    }
+
     #[test]
     fn test_bedrock_body_preserves_max_tokens() {
         let request = GenerateRequest::new(
```

---

### Incident Patch 14: `0423574f` (2026-06-01)
**Commit Message**: fix(ai): reserve already valid anthropic ids

**File**: `libs/ai/src/providers/anthropic/convert.rs` (modified, +134/-3)
```diff
@@ -866,10 +866,45 @@ fn inject_placeholder_tool_results(msg: &mut AnthropicMessage, missing_ids: &[St
 /// Rewrite invalid `tool_use.id` and matching `tool_result.tool_use_id` values
 /// in the outgoing request. This preserves local conversation history while
 /// satisfying Anthropic-family validators that require `^[a-zA-Z0-9_-]+$`.
+///
+/// Uses a two-pass approach to avoid clobbering originally-valid IDs:
+///
+/// 1. **Reserve pass**: collect every already-valid ID (matches
+///    `^[a-zA-Z0-9_-]+$`) into `used_ids`/`id_map` (mapping it to itself).
+///    These IDs are never rewritten, even if a later invalid ID would
+///    normalize to the same value.
+/// 2. **Rewrite pass**: visit every block again and only rename invalid or
+///    empty IDs. Collision resolution in `safe_anthropic_tool_id` then suffixes
+///    the *sanitized* ID (e.g. `a_b_2`) instead of stealing a reserved valid
+///    original (`a_b`).
 fn sanitize_tool_use_ids(messages: &mut [AnthropicMessage]) {
     let mut id_map = HashMap::new();
     let mut used_ids = HashSet::new();
 
+    // Pass 1: reserve all already-valid IDs so they cannot be clobbered by
+    // a later invalid ID that normalizes to the same value.
+    for message in messages.iter() {
+        let AnthropicMessageContent::Blocks(blocks) = &message.content else {
+            continue;
+        };
+
+        for block in blocks {
+            let id = match block {
+                AnthropicContent::ToolUse { id, .. } => id,
+                AnthropicContent::ToolResult { tool_use_id, .. } => tool_use_id,
+                _ => continue,
+            };
+
+            if is_anthropic_tool_id(id) && !used_ids.contains(id) {
+                used_ids.insert(id.clone());
+                id_map.insert(id.clone(), id.clone());
+            }
+        }
+    }
+
+    // Pass 2: rewrite only invalid/empty IDs. Already-valid IDs were
+    // registered above and are short-circuited by the lookup in
+    // `safe_anthropic_tool_id`.
     for message in messages {
         let AnthropicMessageContent::Blocks(blocks) = &mut message.content else {
             continue;
@@ -894,9 +929,10 @@ fn rewrite_tool_id(
     id_map: &mut HashMap<String, String>,
     used_ids: &mut HashSet<String>,
 ) {
-    if is_anthropic_tool_id(id) && !used_ids.contains(id) {
-        used_ids.insert(id.clone());
-        id_map.insert(id.clone(), id.clone());
+    // Already-valid IDs were reserved in pass 1 of `sanitize_tool_use_ids`
+    // and are therefore present in `id_map` (mapped to themselves). Nothing
+    // to do here.
+    if is_anthropic_tool_id(id) && id_map.get(id).is_some_and(|mapped| mapped == id) {
         return;
     }
 
@@ -2879,6 +2915,101 @@ mod tests {
         );
     }
 
+    /// Regression test: an invalid ID that normalizes to a value already used
+    /// by a separate, originally-valid ID must NOT clobber the valid one.
+    ///
+    /// Setup:
+    ///   - assistant emits tool_use `a/b` (invalid) — normalizes to `a_b`
+    ///   - tool result for `a/b`
+    ///   - assistant emits tool_use `a_b` (already valid) — must keep `a_b`
+    ///   - tool result for `a_b`
+    ///
+    /// Expectation: the valid `a_b` stays as `a_b`; the sanitized `a/b`
+    /// becomes a suffixed variant (e.g. `a_b_2`). Each tool_use still pairs
+    /// with its matching tool_result.
+    #[test]
+    fn test_sanitize_preserves_valid_id_when_invalid_id_normalizes_to_it() {
+        use crate::providers::anthropic::types::{AnthropicMessage, AnthropicMessageContent};
+
+        let mut messages = vec![
+            // assistant: tool_use with INVALID id "a/b"
+            AnthropicMessage {
+                role: "assistant".to_string(),
+                content: AnthropicMessageContent::Blocks(vec![AnthropicContent::ToolUse {
+                    id: "a/b".to_string(),
+                    name: "search".to_string(),
+                    input: serde_json::json!({}),
+                    cache_control: None,
+                }]),
+            },
+            // user: tool_result for "a/b"
+            AnthropicMessage {
+                role: "user".to_string(),
+                content: AnthropicMessageContent::Blocks(vec![AnthropicContent::ToolResult {
+                    tool_use_id: "a/b".to_string(),
+                    content: Some(AnthropicMessageContent::String("r1".to_string())),
+                    is_error: None,
+                    cache_control: None,
+                }]),
+            },
+            // assistant: tool_use with VALID id "a_b"
+            AnthropicMessage {
+                role: "assistant".to_string(),
+                content: AnthropicMessageContent::Blocks(vec![AnthropicContent::ToolUse {
+                    id: "a_b".to_string(),
+                    name: "search".to_string(),
+                    input: serde_json::json!({}),
+                    cache_control: None,
+                }]),
+            },
+            // user: tool_result
```

---

### Incident Patch 15: `6faf91c9` (2026-05-20)
**Commit Message**: fix(ai): rewrite invalid tool_use IDs for Anthropic-family providers

Anthropic and Bedrock require tool IDs matching ^[a-zA-Z0-9_-]+$ but
some providers (e.g. Kimi) emit IDs with slashes, colons, or other
characters. Add sanitize_tool_use_ids as Phase 8 in the Anthropic
message pipeline to rewrite invalid IDs consistently across tool_use
and tool_result blocks using a deterministic mapping. Bedrock inherits
the fix since it delegates conversion to the Anthropic layer.

- Add sanitize_tool_use_ids + rewrite_tool_id + safe_anthropic_tool_id
- Invalid chars replaced with _; collisions resolved with numeric suffix
- Mapping preserved across paired tool_use/tool_result references
- Tests for both Anthropic and Bedrock conversion paths

**File**: `libs/ai/src/providers/anthropic/convert.rs` (modified, +149/-1)
```diff
@@ -13,7 +13,7 @@ use crate::types::{
     OutputTokenDetails, ResponseContent, Role, Usage,
 };
 use serde_json::json;
-use std::collections::HashSet;
+use std::collections::{HashMap, HashSet};
 
 /// Check whether the target model belongs to the Opus 4.7 (or later) family.
 ///
@@ -521,6 +521,8 @@ fn sanitize_anthropic_message(msg: &mut AnthropicMessage) {
 /// 6. Conversation must not end with role="assistant" (no prefill — some
 ///    models reject it; defensive for cross-model compatibility)
 /// 7. Re-merges consecutive same-role messages after mutations
+/// 8. Tool IDs must match Anthropic-family provider validation
+///    (`^[a-zA-Z0-9_-]+$`)
 fn sanitize_message_sequence(messages: &mut Vec<AnthropicMessage>) {
     if messages.is_empty() {
         return;
@@ -561,6 +563,10 @@ fn sanitize_message_sequence(messages: &mut Vec<AnthropicMessage>) {
 
     // Step 7: Ensure the conversation does not end with an assistant message.
     ensure_not_trailing_assistant(messages);
+
+    // Step 8: Rewrite invalid tool_use/tool_result IDs after all structural
+    // fixes, so injected placeholder results are covered too.
+    sanitize_tool_use_ids(messages);
 }
 
 /// Ensure every `tool_use` in assistant messages has a matching `tool_result`
@@ -857,6 +863,96 @@ fn inject_placeholder_tool_results(msg: &mut AnthropicMessage, missing_ids: &[St
     }
 }
 
+/// Rewrite invalid `tool_use.id` and matching `tool_result.tool_use_id` values
+/// in the outgoing request. This preserves local conversation history while
+/// satisfying Anthropic-family validators that require `^[a-zA-Z0-9_-]+$`.
+fn sanitize_tool_use_ids(messages: &mut [AnthropicMessage]) {
+    let mut id_map = HashMap::new();
+    let mut used_ids = HashSet::new();
+
+    for message in messages {
+        let AnthropicMessageContent::Blocks(blocks) = &mut message.content else {
+            continue;
+        };
+
+        for block in blocks {
+            match block {
+                AnthropicContent::ToolUse { id, .. } => {
+                    rewrite_tool_id(id, &mut id_map, &mut used_ids);
+                }
+                AnthropicContent::ToolResult { tool_use_id, .. } => {
+                    rewrite_tool_id(tool_use_id, &mut id_map, &mut used_ids);
+                }
+                _ => {}
+            }
+        }
+    }
+}
+
+fn rewrite_tool_id(
+    id: &mut String,
+    id_map: &mut HashMap<String, String>,
+    used_ids: &mut HashSet<String>,
+) {
+    if is_anthropic_tool_id(id) && !used_ids.contains(id) {
+        used_ids.insert(id.clone());
+        id_map.insert(id.clone(), id.clone());
+        return;
+    }
+
+    let safe_id = safe_anthropic_tool_id(id, id_map, used_ids);
+    if safe_id != *id {
+        *id = safe_id;
+    }
+}
+
+fn safe_anthropic_tool_id(
+    original_id: &str,
+    id_map: &mut HashMap<String, String>,
+    used_ids: &mut HashSet<String>,
+) -> String {
+    if let Some(mapped) = id_map.get(original_id) {
+        return mapped.clone();
+    }
+
+    let base = normalize_anthropic_tool_id(original_id);
+    let mut candidate = if base.is_empty() {
+        "toolu".to_string()
+    } else {
+        base
+    };
+
+    if used_ids.contains(&candidate) {
+        let base = candidate;
+        let mut suffix = 2usize;
+        loop {
+            candidate = format!("{base}_{suffix}");
+            if !used_ids.contains(&candidate) {
+                break;
+            }
+            suffix += 1;
+        }
+    }
+
+    used_ids.insert(candidate.clone());
+    id_map.insert(original_id.to_string(), candidate.clone());
+    candidate
+}
+
+fn normalize_anthropic_tool_id(id: &str) -> String {
+    id.chars()
+        .map(|c| if is_anthropic_tool_id_char(c) { c } else { '_' })
+        .collect()
+}
+
+fn is_anthropic_tool_id(id: &str) -> bool {
+    !id.is_empty() && id.chars().all(is_anthropic_tool_id_char)
+}
+
+fn is_anthropic_tool_id_char(c: char) -> bool {
+    c.is_ascii_alphanumeric() || c == '_' || c == '-'
+}
+
 /// Set cache_control on an AnthropicContent block.
 fn set_block_cache_control(block: &mut AnthropicContent, cc: Option<AnthropicCacheControl>) {
     match block {
@@ -2731,6 +2827,58 @@ mod tests {
         crate::providers::anthropic::types::AnthropicConfig::new("key")
     }
 
+    #[test]
+    fn test_anthropic_request_rewrites_invalid_tool_use_ids() {
+        let invalid_id = "kimi.tool/use:1";
+        let request = crate::types::GenerateRequest::new(
+            crate::types::Model::custom("claude-opus-4-5", "anthropic"),
+            vec![
+                crate::types::Message::new(crate::types::Role::User, "Use the tool."),
+                crate::types::Message::new(
+                    crate::types::Role::Assistant,
+                    MessageContent::Parts(vec![ContentPart::tool_call(
+                        invalid_id,
+                        "search",
+                        serde_json::json!({"query": "rust"}),
+                    )]),
+               
```

**File**: `libs/ai/src/providers/bedrock/convert.rs` (modified, +46/-1)
```diff
@@ -82,7 +82,7 @@ pub fn to_bedrock_body(
 mod tests {
     use super::*;
     use crate::providers::anthropic::types::AnthropicConfig;
-    use crate::types::{GenerateRequest, Message, Model, Role};
+    use crate::types::{ContentPart, GenerateRequest, Message, MessageContent, Model, Role};
 
     /// Helper to create a dummy AnthropicConfig for Bedrock conversion
     /// (Bedrock doesn't use the API key, but the conversion layer needs a valid config)
@@ -176,6 +176,51 @@ mod tests {
         assert_eq!(messages[0]["role"], "user");
     }
 
+    #[test]
+    fn test_bedrock_body_rewrites_invalid_tool_use_ids() {
+        let invalid_id = "kimi.tool/use:1";
+        let request = GenerateRequest::new(
+            Model::custom("anthropic.claude-opus-4-5-20251101-v1:0", "bedrock"),
+            vec![
+                Message::new(Role::User, "Use the tool."),
+                Message::new(
+                    Role::Assistant,
+                    MessageContent::Parts(vec![ContentPart::tool_call(
+                        invalid_id,
+                        "search",
+                        serde_json::json!({"query": "rust"}),
+                    )]),
+                ),
+                Message::new(
+                    Role::Tool,
+                    MessageContent::Parts(vec![ContentPart::tool_result(
+                        invalid_id,
+                        serde_json::json!("result"),
+                    )]),
+                ),
+            ],
+        );
+
+        let result = to_bedrock_body(&request, &dummy_anthropic_config()).unwrap();
+        let messages = result.body["messages"].as_array().expect("messages array");
+
+        let tool_use_id = messages[1]["content"][0]["id"]
+            .as_str()
+            .expect("tool_use id");
+        let tool_result_id = messages[2]["content"][0]["tool_use_id"]
+            .as_str()
+            .expect("tool_result id");
+
+        assert_ne!(tool_use_id, invalid_id);
+        assert_eq!(tool_result_id, tool_use_id);
+        assert!(
+            tool_use_id
+                .chars()
+                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-'),
+            "Bedrock tool_use.id must match ^[a-zA-Z0-9_-]+$, got {tool_use_id}"
+        );
+    }
+
     #[test]
     fn test_bedrock_body_preserves_max_tokens() {
         let request = GenerateRequest::new(
```

#### Recent Merged Pull Requests:
- **PR #763** (closed): docs: add llmman as a local OpenAI-compatible provider example (@ericcurtin)
- **PR #759** (2026-07-06): Update default API image for search service (@shehab299)
- **PR #758** (2026-07-04): Add third-party OSS attribution notices (@kajogo777)
- **PR #755** (2026-06-28): Add Stakpak, inc in License (@shehab299)
- **PR #752** (2026-06-10): fix(ak): specify version for stakpak-api dependency (@ahmedhesham6)
- **PR #751** (closed): Feat/ak sync (@shehab299)
- **PR #750** (2026-06-10): fix(mcp): artifact large tool outputs in proxy (@ahmedhesham6)
- **PR #749** (2026-06-04): feat(mcp): add aap as built-in remote MCP server (@kajogo777)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
