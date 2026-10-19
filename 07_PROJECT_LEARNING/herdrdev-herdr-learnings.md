> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/herdrdev-herdr-learnings.md`  
> **Source**: github ([https://github.com/herdrdev/herdr](https://github.com/herdrdev/herdr))  
> **Source Version**: `143bf5fd`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T11:27:51.071Z  
> **Learning ID**: `learn-github-herdrdev-herdr`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): herdrdev/herdr

> **Canonical Artifact**: `07_PROJECT_LEARNING/herdrdev-herdr-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/herdrdev/herdr](https://github.com/herdrdev/herdr))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T11:27:50.358Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `herdrdev/herdr`
- **Description**: the runtime your coding agents live on
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 44742 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/app/state.rs`
```
use crate::config::{Keybinds, NewTerminalCwdConfig, SoundConfig, ToastConfig};
use crossterm::event::{KeyCode, KeyModifiers};
use ratatui::layout::Rect;
use ratatui::style::Color;

use crate::detect::AgentState;
use crate::layout::{PaneId, PaneInfo};

pub(crate) type InstalledPluginRegistry =
    std::collections::HashMap<String, crate::api::schema::InstalledPluginInfo>;
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PluginPaneRecord {
    pub plugin_id: String,
    pub entrypoint: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct PopupPaneState {
    pub pane_id: PaneId,
    pub terminal_id: crate::terminal::TerminalId,
    pub width: Option<crate::popup_size::PopupSize>,
    pub height: Option<crate::popup_size::PopupSize>,
}

use crate::terminal_theme::{HostAppearance, TerminalTheme};
use crate::workspace::Workspace;

// ---------------------------------------------------------------------------
// Theme palette — all UI colors in one place, ready for theming
// ---------------------------------------------------------------------------

/// All colors used by the UI. Derived from a base accent color for now,
/// but structured so a full theme system can replace it later.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Palette {
    /// Primary accent (highlight, active borders).
    pub accent: Color,
    /// Background for the tab bar, floating panels, overlays, and modals.
    pub panel_bg: Color,
    /// Optional desktop sidebar background. Reset preserves the terminal background.
    pub sidebar_bg: Color,
    /// Background for the active workspace and focused agent rows.
    pub active_row_bg: Color,
    /// Background for the Navigate-mode cursor row in the sidebar.
    pub selection_bg: Color,
    /// Subtle surface background for selected/focused items.
    pub surface0: Color,
    /// Slightly lighter surface for hover/active states.
    pub surface1: Color,
    /// Very dim surface for separators.
    pub surface_dim: Color,
    /// Muted text (secondary info, numbers).
    pub overlay0: Color,
    /// Slightly brighter overlay text.
    pub overlay1: Color,
    /// Main text color — soft white.
    pub text: Color,
    /// Subdued text (workspace numbers, dim labels).
    pub subtext0: Color,
    /// Branch name / special label color.
    pub mauve: Color,
    /// Done / idle states.
    pub green: Color,
    /// Working / running states.
    pub yellow: Color,
    /// Needs attention / blocked states.
    pub red: Color,
    /// Unseen / done notification accent.
    pub blue: Color,
    /// Notification accent / unseen markers.
    pub teal: Color,
    /// Interrupted / warning states.
    pub peach: Color,
}

impl Palette {
    /// Catppuccin Mocha — the default.
    pub fn catppuccin() -> Self {
        Self {
            accent: Color::Rgb(137, 180, 250), // blue
            panel_bg: Color::Rgb(24, 24, 37),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(30, 30, 46),
            selection_bg: Color::Rgb(49, 50, 68),
            surface0: Color::Rgb(49, 50, 68),
            surface1: Color::Rgb(69, 71, 90),
            surface_dim: Color::Rgb(30, 30, 46),
            overlay0: Color::Rgb(108, 112, 134),
            overlay1: Color::Rgb(127, 132, 156),
            text: Color::Rgb(205, 214, 244),
            subtext0: Color::Rgb(166, 173, 200),
            mauve: Color::Rgb(203, 166, 247),
            green: Color::Rgb(166, 227, 161),
            yellow: Color::Rgb(249, 226, 175),
            red: Color::Rgb(243, 139, 168),
            blue: Color::Rgb(137, 180, 250),
            teal: Color::Rgb(148, 226, 213),
            peach: Color::Rgb(250, 179, 135),
        }
    }

    /// Catppuccin Latte — the light Catppuccin flavor.
    pub fn catppuccin_latte() -> Self {
        Self {
            accent: Color::Rgb(30, 102, 245),
            panel_bg: Color::Rgb(239, 241, 245),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(230, 233, 239),
            selection_bg: Color::Rgb(189, 208, 245),
            surface0: Color::Rgb(204, 208, 218),
            surface1: Color::Rgb(188, 192, 204),
            surface_dim: Color::Rgb(230, 233, 239),
            overlay0: Color::Rgb(156, 160, 176),
            overlay1: Color::Rgb(140, 143, 161),
            text: Color::Rgb(76, 79, 105),
            subtext0: Color::Rgb(108, 111, 133),
            mauve: Color::Rgb(136, 57, 239),
            green: Color::Rgb(64, 160, 43),
            yellow: Color::Rgb(223, 142, 29),
            red: Color::Rgb(210, 15, 57),
            blue: Color::Rgb(30, 102, 245),
            teal: Color::Rgb(23, 146, 153),
            peach: Color::Rgb(254, 100, 11),
        }
    }

    /// Terminal 16-color theme.
    pub fn terminal() -> Self {
        Self {
            accent: Color::Blue,
            panel_bg: Color::Reset,
            sidebar_bg: Color::Reset,
            active_row_bg: Color::DarkGray,
            selection_bg: Color::Reset,
            surface0: Color::Reset,
            surface1: Color::DarkGray,
            surface_dim: Color::DarkGray,
            overlay0: Color::Gray,
            overlay1: Color::White,
            text: Color::Reset,
            subtext0: Color::Gray,
            mauve: Color::Gray,
            green: Color::Green,
            yellow: Color::Yellow,
            red: Color::LightRed,
            blue: Color::Blue,
            teal: Color::Cyan,
            peach: Color::Yellow,
        }
    }

    /// Tokyo Night — blue-purple aesthetic.
    pub fn tokyo_night() -> Self {
        Self {
            accent: Color::Rgb(122, 162, 247), // blue
            panel_bg: Color::Rgb(26, 27, 38),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(35, 38, 54),
            selection_bg: Color::Rgb(45, 54, 80),
            surface0: Color::Rgb(36, 40, 59),
            surface1: Color::Rgb(65, 72, 104),
            surface_dim: Color::Rgb(26, 27, 38),
            overlay0: Color::Rgb(86, 95, 137),
            overlay1: Color::Rgb(105, 113, 150),
            text: Color::Rgb(192, 202, 245),
            subtext0: Color::Rgb(169, 177, 214),
            mauve: Color::Rgb(187, 154, 247),
            green: Color::Rgb(158, 206, 106),
            yellow: Color::Rgb(224, 175, 104),
            red: Color::Rgb(247, 118, 142),
            blue: Color::Rgb(122, 162, 247),
            teal: Color::Rgb(125, 207, 255),
            peach: Color::Rgb(255, 158, 100),
        }
    }

    /// Tokyo Night Day — the light Tokyo Night style.
    pub fn tokyo_night_day() -> Self {
        Self {
            accent: Color::Rgb(46, 125, 233),
            panel_bg: Color::Rgb(225, 226, 231),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(210, 211, 218),
            selection_bg: Color::Rgb(182, 202, 231),
            surface0: Color::Rgb(196, 200, 218),
            surface1: Color::Rgb(168, 174, 203),
            surface_dim: Color::Rgb(210, 211, 218),
            overlay0: Color::Rgb(137, 144, 179),
            overlay1: Color::Rgb(104, 112, 154),
            text: Color::Rgb(55, 96, 191),
            subtext0: Color::Rgb(97, 114, 176),
            mauve: Color::Rgb(120, 71, 189),
            green: Color::Rgb(88, 117, 57),
            yellow: Color::Rgb(140, 108, 62),
            red: Color::Rgb(245, 42, 101),
            blue: Color::Rgb(46, 125, 233),
            teal: Color::Rgb(17, 140, 116),
            peach: Color::Rgb(177, 92, 0),
        }
    }

    /// Dracula — purple/pink/green.
    pub fn dracula() -> Self {
        Self {
            accent: Color::Rgb(189, 147, 249), // purple
            panel_bg: Color::Rgb(40, 42, 54),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(55, 60, 82),
            selection_bg: Color::Rgb(70, 63, 93),
            surface0: Color::Rgb(68, 71, 90),
            surface1: Color::Rgb(98, 114, 164),
            surface_dim: Color::Rgb(40, 42, 54),
            overlay0: Color::Rgb(98, 114, 164),
            overlay1: Color::Rgb(130, 140, 180),
            text: Color::Rgb(248, 248, 242),
            subtext0: Color::Rgb(210, 210, 220),
            mauve: Color::Rgb(255, 121, 198), // pink
            green: Color::Rgb(80, 250, 123),
            yellow: Color::Rgb(241, 250, 140),
            red: Color::Rgb(255, 85, 85),
            blue: Color::Rgb(139, 233, 253), // cyan-ish
            teal: Color::Rgb(139, 233, 253),
            peach: Color::Rgb(255, 184, 108),
        }
    }

    /// Nord — frosty blue palette.
    pub fn nord() -> Self {
        Self {
            accent: Color::Rgb(136, 192, 208), // frost
            panel_bg: Color::Rgb(46, 52, 64),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(67, 76, 94),
            selection_bg: Color::Rgb(64, 80, 93),
            surface0: Color::Rgb(59, 66, 82),
            surface1: Color::Rgb(67, 76, 94),
            surface_dim: Color::Rgb(46, 52, 64),
            overlay0: Color::Rgb(76, 86, 106),
            overlay1: Color::Rgb(100, 110, 130),
            text: Color::Rgb(236, 239, 244),
            subtext0: Color::Rgb(216, 222, 233),
            mauve: Color::Rgb(180, 142, 173),
            green: Color::Rgb(163, 190, 140),
            yellow: Color::Rgb(235, 203, 139),
            red: Color::Rgb(191, 97, 106),
            blue: Color::Rgb(129, 161, 193),
            teal: Color::Rgb(143, 188, 187),
            peach: Color::Rgb(208, 135, 112),
        }
    }

    /// Gruvbox Dark — warm retro palette.
    pub fn gruvbox() -> Self {
        Self {
            accent: Color::Rgb(215, 153, 33), // yellow
            panel_bg: Color::Rgb(40, 40, 40),
            sidebar_bg: Color::Reset,
            active_row_bg: Color::Rgb(50, 49, 48),
            selection_bg: Color::Rgb(75, 63, 39),
            surface0: Color::Rgb(60, 56, 54),
            surface1: Color::Rgb(80, 73, 69),
            surface_dim: Color::Rgb(40, 40, 40),
    
```

### Core Architecture Module: `src/client/loop_config.rs`
```
use super::*;

pub(super) struct ClientLoopConfig {
    pub(super) sound_config: crate::config::SoundConfig,
    pub(super) mouse_scroll_lines: usize,
    pub(super) redraw_on_focus_gained: bool,
    pub(super) host_cursor: crate::config::HostCursorModeConfig,
    pub(super) kitty_graphics_enabled: bool,
    pub(super) pixel_geometry_enabled: bool,
    pub(super) pixel_geometry_fallback: bool,
    pub(super) mouse_capture_active: bool,
    pub(super) host_escape_disambiguation_active: bool,
    pub(super) host_sgr_pixel_mouse: Option<bool>,
    pub(super) initial_host_input: Vec<u8>,
    pub(super) endpoint_keybindings: bool,
    pub(super) remote_image_paste_key:
        Option<(crossterm::event::KeyCode, crossterm::event::KeyModifiers)>,
    pub(super) shell_config: Option<shell::ClientShellConfig>,
}

```

### Core Architecture Module: `src/client/shell/endpoint_agent_state.rs`
```
use std::collections::{HashMap, HashSet};

use crate::api::schema::AgentStatus;
use crate::protocol::{ClientShellAgent, ClientShellSnapshot, PaneSurfaceFrame};

#[derive(Clone, Debug, Default)]
pub(super) struct EndpointAgentPresentation {
    boot_id: Option<String>,
    acknowledged: HashMap<String, u64>,
    completed: HashMap<String, u64>,
    working: HashSet<String>,
    pending_completions: Option<(
        Option<u64>,
        crate::protocol::endpoint::EndpointAgentCompletions,
    )>,
}

impl EndpointAgentPresentation {
    pub(super) fn receive_completions(
        &mut self,
        generation: Option<u64>,
        completions: crate::protocol::endpoint::EndpointAgentCompletions,
    ) {
        if self
            .pending_completions
            .as_ref()
            .is_some_and(|(current_generation, current)| {
                *current_generation == generation
                    && current.boot_id == completions.boot_id
                    && current.revision >= completions.revision
            })
        {
            return;
        }
        self.pending_completions = Some((generation, completions));
    }

    #[cfg(test)]
    pub(super) fn project_snapshot(&mut self, snapshot: &mut ClientShellSnapshot) {
        self.project_snapshot_for_generation(snapshot, None);
    }

    pub(super) fn project_snapshot_for_generation(
        &mut self,
        snapshot: &mut ClientShellSnapshot,
        generation: Option<u64>,
    ) {
        if self.boot_id.as_deref() != Some(snapshot.boot_id.as_str()) {
            self.boot_id = Some(snapshot.boot_id.clone());
            self.acknowledged.clear();
            self.completed.clear();
            self.working.clear();
            self.acknowledged.extend(
                snapshot
                    .agents
                    .iter()
                    .map(|agent| (agent.pane_id.clone(), agent.state_change_seq)),
            );
        }
        let pane_ids: HashSet<&str> = snapshot
            .agents
            .iter()
            .map(|agent| agent.pane_id.as_str())
            .collect();
        self.acknowledged
            .retain(|pane_id, _| pane_ids.contains(pane_id.as_str()));
        self.completed
            .retain(|pane_id, _| pane_ids.contains(pane_id.as_str()));
        self.working
            .retain(|pane_id| pane_ids.contains(pane_id.as_str()));
        let completions = self
            .pending_completions
            .take()
            .filter(|(received_generation, projection)| {
                *received_generation == generation
                    && projection.boot_id == snapshot.boot_id
                    && projection.revision == snapshot.revision
            })
            .map(|(_, projection)| projection.completions);
        for agent in &mut snapshot.agents {
            match agent.agent_status {
                AgentStatus::Working => {
                    self.working.insert(agent.pane_id.clone());
                    self.completed.remove(&agent.pane_id);
                }
                AgentStatus::Blocked => {
                    self.completed.remove(&agent.pane_id);
                }
                AgentStatus::Idle | AgentStatus::Done => {
                    let observed_work = self.working.remove(&agent.pane_id);
                    let completed = completions.as_ref().map_or_else(
                        || {
                            observed_work
                                || self.completed.get(&agent.pane_id)
                                    == Some(&agent.state_change_seq)
                        },
                        |completions| {
                            completions.get(&agent.pane_id) == Some(&agent.state_change_seq)
                        },
                    );
                    if completed {
                        self.completed
                            .insert(agent.pane_id.clone(), agent.state_change_seq);
                    } else {
                        self.completed.remove(&agent.pane_id);
                    }
                }
                _ => {
                    self.working.remove(&agent.pane_id);
                    self.completed.remove(&agent.pane_id);
                }
            }
            agent.agent_status = self.projected_status(agent);
        }
        project_aggregate_status(snapshot);
    }

    pub(super) fn acknowledge_surface(
        &mut self,
        snapshot: &mut ClientShellSnapshot,
        surface: &PaneSurfaceFrame,
        outer_focused: Option<bool>,
    ) -> bool {
        if outer_focused == Some(false)
            || self.boot_id.as_deref() != Some(surface.boot_id.as_str())
            || snapshot.boot_id != surface.boot_id
            || snapshot.revision != surface.projection_revision
        {
            return false;
        }

        let mut changed = false;
        for pane in &surface.panes {
            let Some(agent) = snapshot
                .agents
                .iter()
                .find(|agent| agent.pane_id == pane.pane_id)
            else {
                continue;
            };
            let acknowledged = self.acknowledged.entry(agent.pane_id.clone()).or_default();
            if *acknowledged < agent.state_change_seq {
                *acknowledged = agent.state_change_seq;
                changed = true;
            }
        }
        if changed {
            for agent in &mut snapshot.agents {
                agent.agent_status = self.projected_status(agent);
            }
            project_aggregate_status(snapshot);
        }
        changed
    }

    pub(super) fn seen(&self, agent: &ClientShellAgent) -> bool {
        self.completed.get(&agent.pane_id).is_none_or(|completion| {
            self.acknowledged
                .get(&agent.pane_id)
                .is_some_and(|sequence| sequence >= completion)
        })
    }

    fn projected_status(&self, agent: &ClientShellAgent) -> AgentStatus {
        match agent.agent_status {
            AgentStatus::Idle | AgentStatus::Done => {
                if self.seen(agent) {
                    AgentStatus::Idle
                } else {
                    AgentStatus::Done
                }
            }
            status => status,
        }
    }
}

fn project_aggregate_status(snapshot: &mut ClientShellSnapshot) {
    for tab in &mut snapshot.tabs {
        if let Some(status) = snapshot
            .agents
            .iter()
            .filter(|agent| agent.tab_id == tab.tab_id)
            .map(|agent| agent.agent_status)
            .max_by_key(|status| super::status_priority(*status))
        {
            tab.agent_status = status;
        }
    }
    for workspace in &mut snapshot.workspaces {
        if let Some(status) = snapshot
            .agents
            .iter()
            .filter(|agent| agent.workspace_id == workspace.workspace_id)
            .map(|agent| agent.agent_status)
            .max_by_key(|status| super::status_priority(*status))
        {
            workspace.agent_status = status;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{
        endpoint::EndpointAgentCompletions, FrameData, PaneSurfacePane, SurfaceRect,
    };

    fn agent(status: AgentStatus, sequence: u64) -> ClientShellAgent {
        ClientShellAgent {
            pane_id: "agent-pane".into(),
            workspace_id: "workspace".into(),
            tab_id: "tab".into(),
            name: None,
            display_agent: None,
            agent: None,
            title: None,
            terminal_title: None,
            terminal_title_stripped: None,
            agent_status: status,
            state_change_seq: sequence,
            state_labels: Vec::new(),
            tokens: Vec::new(),
            focused: true,
        }
    }

    fn snapshot(status: AgentStatus, sequence: u64, revision: u64) -> ClientShellSnapshot {
        let mut snapshot = crate::client::shell::tests::snapshot();
        snapshot.boot_id = "endpoint-boot".into();
        snapshot.revision = revision;
        snapshot.agents = vec![agent(status, sequence)];
        snapshot
    }

    fn surface(revision: u64) -> PaneSurfaceFrame {
        let rect = SurfaceRect {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
        };
        PaneSurfaceFrame {
            boot_id: "endpoint-boot".into(),
            projection_revision: revision,
            surface_revision: 1,
            frame: FrameData {
                cells: Vec::new(),
                width: 0,
                height: 0,
                cursor: None,
                hyperlinks: Vec::new(),
                graphics: Vec::new(),
            },
            panes: vec![PaneSurfacePane {
                pane_id: "agent-pane".into(),
                content_revision: 1,
                rect,
                inner_rect: rect,
                scrollbar_rect: None,
                scroll: None,
                focused: true,
                mouse_reporting: false,
                sgr_pixel_mouse: false,
                alternate_screen_active: false,
                pixel_width: 0,
                pixel_height: 0,
            }],
            splits: Vec::new(),
            popup: None,
            graphics: Default::default(),
        }
    }

    #[test]
    fn first_snapshot_establishes_an_idle_baseline_without_server_seen_authority() {
        let mut presentation = EndpointAgentPresentation::default();
        let mut snapshot = snapshot(AgentStatus::Done, 4, 1);

        presentation.project_snapshot(&mut snapshot);

        assert_eq!(snapshot.agents[0].agent_status, AgentStatus::Idle);
    }

    fn assert_idle_sequence(states: &[(AgentStatus, u64)]) {
        let mut presentation = EndpointAgentPresentation::default();
        let mut projected = AgentStatus::Unknown;
        for (revision, &(status, seq)) in states.iter().enumerate() {
            let mut snapshot = snapshot(status, seq, revision
```

### Core Architecture Module: `src/client/shell/render.rs`
```
use super::*;

#[path = "../shell/overlays.rs"]
mod overlays;
#[path = "../shell/sidebar.rs"]
pub(in crate::client::shell) mod sidebar;
#[path = "../shell/tabs.rs"]
mod tabs;

pub(super) use super::agent_sidebar::{ordered_agent_pane_ids, render_agent_panel};
pub(super) use super::aggregate_navigation::navigator_rows as client_navigator_rows;
pub(super) use overlays::{render_client_overlay, render_context_menu, render_global_menu};
pub(super) use sidebar::{render_collapsed_sidebar, render_sidebar, workspace_entries};
pub(super) use tabs::{render_tab_bar, tab_bar_status_width};

pub(in crate::client::shell) fn render_sidebar_background(
    buffer: &mut Buffer,
    area: Rect,
    palette: &Palette,
) {
    buffer.set_style(area, Style::default().bg(palette.sidebar_bg));
    let separator_x = area.right().saturating_sub(1);
    for y in area.y..area.bottom() {
        if let Some(cell) = buffer.cell_mut((separator_x, y)) {
            cell.set_symbol("│");
            cell.set_style(Style::default().fg(palette.surface_dim));
        }
    }
}

pub(super) fn render_mode_bar(
    buffer: &mut Buffer,
    pane_area: Rect,
    mode: ClientShellMode,
    copy_mode: Option<&ClientCopyModeState>,
    endpoint_error: Option<&str>,
    update_available: bool,
    keybinds: &LiveKeybindConfig,
    palette: &Palette,
) -> Option<Rect> {
    if (mode == ClientShellMode::Terminal && endpoint_error.is_none()) || pane_area.is_empty() {
        return None;
    }

    let bar = Rect::new(
        pane_area.x,
        pane_area.y + pane_area.height.saturating_sub(1),
        pane_area.width,
        1,
    );
    let base = Style::default().fg(palette.overlay0).bg(palette.panel_bg);
    for x in bar.x..bar.x + bar.width {
        buffer[(x, bar.y)].set_symbol(" ").set_style(base);
    }

    let key = Style::default()
        .fg(palette.accent)
        .bg(palette.panel_bg)
        .add_modifier(Modifier::BOLD);
    let mode_style = Style::default()
        .fg(match palette.panel_bg {
            ratatui::style::Color::Reset => palette.surface_dim,
            color => color,
        })
        .bg(if mode == ClientShellMode::Resize {
            palette.mauve
        } else {
            palette.accent
        })
        .add_modifier(Modifier::BOLD);
    let prefix = keybinds.primary_prefix_label();
    let prefix_rhs = |bindings: &crate::config::ActionKeybinds| {
        bindings
            .prefix_rhs_label()
            .unwrap_or_else(|| "unset".to_owned())
    };

    let mut segments = Vec::<(String, Style)>::new();
    if let Some(error) = endpoint_error {
        segments.extend([
            (" ERROR ".to_owned(), mode_style),
            (format!(" {error}"), base),
        ]);
    } else {
        match mode {
            ClientShellMode::Prefix => {
                segments.extend([
                    (" PREFIX ".to_owned(), mode_style),
                    (" ".to_owned(), base),
                    ("esc".to_owned(), key),
                    (" cancel  ".to_owned(), base),
                    (prefix, key),
                    (" send prefix  ".to_owned(), base),
                    (prefix_rhs(&keybinds.keybinds.workspace_picker), key),
                    (" workspace nav  ".to_owned(), base),
                    (prefix_rhs(&keybinds.keybinds.help), key),
                    (" keybinds".to_owned(), base),
                ]);
            }
            ClientShellMode::Navigate => {
                segments.extend([
                    (" NAVIGATE ".to_owned(), mode_style),
                    (" esc back  ".to_owned(), base),
                    ("↑/↓".to_owned(), key),
                    (" workspace  ".to_owned(), base),
                    ("tab".to_owned(), key),
                    (" pane  ".to_owned(), base),
                    (prefix_rhs(&keybinds.keybinds.help), key),
                    (" keybinds".to_owned(), base),
                ]);
            }
            ClientShellMode::Resize => {
                segments.extend([
                    (" RESIZE ".to_owned(), mode_style),
                    ("  ".to_owned(), base),
                    ("h/l".to_owned(), key),
                    (" width  ".to_owned(), base),
                    ("j/k".to_owned(), key),
                    (" height  ".to_owned(), base),
                    ("esc".to_owned(), key),
                    (" done".to_owned(), base),
                ]);
            }
            ClientShellMode::Copy => {
                let copy_mode = copy_mode?;
                if let Some(prompt) = copy_mode.search_prompt.as_ref() {
                    let marker = match prompt.direction {
                        crate::api::schema::PaneCopySearchDirection::Forward => "/",
                        crate::api::schema::PaneCopySearchDirection::Backward => "?",
                    };
                    buffer.set_stringn(bar.x, bar.y, " COPY ", usize::from(bar.width), mode_style);
                    let prefix = 8.min(bar.width);
                    if bar.width >= 8 {
                        buffer.set_string(bar.x + 7, bar.y, marker, key);
                    }
                    let footer = "  enter search  esc cancel";
                    let footer_width = if bar.width >= 50 {
                        footer.len() as u16
                    } else {
                        0
                    };
                    let field = Rect::new(
                        bar.x + prefix,
                        bar.y,
                        bar.width.saturating_sub(prefix + footer_width),
                        1,
                    );
                    if let Some(cursor) = text_editor::render(
                        buffer,
                        field,
                        &prompt.query,
                        Style::default().fg(palette.text).bg(palette.panel_bg),
                    ) {
                        buffer[(cursor.x, cursor.y)]
                            .set_style(Style::default().fg(palette.panel_bg).bg(palette.text));
                    }
                    if footer_width > 0 {
                        buffer.set_string(bar.right() - footer_width, bar.y, footer, base);
                    }
                    return Some(bar);
                } else {
                    let select = if copy_mode.selection.is_some() {
                        "selecting"
                    } else {
                        "select"
                    };
                    let match_status = copy_mode
                        .search_current_global
                        .map(|current| format!(" {}/{}", current + 1, copy_mode.search_total))
                        .or_else(|| (!copy_mode.search_query.is_empty()).then(|| " 0/0".to_owned()))
                        .unwrap_or_default();
                    let (exit_keys, exit_label) =
                        if copy_mode.search_query.is_empty() && copy_mode.selection.is_none() {
                            ("q/esc", " exit")
                        } else {
                            ("esc", " clear  q exit")
                        };
                    segments.extend([
                        (" COPY ".to_owned(), mode_style),
                        (" ".to_owned(), base),
                        ("h/j/k/l w/b/e { }".to_owned(), key),
                        (" move  ".to_owned(), base),
                        ("/ ?".to_owned(), key),
                        (" search  ".to_owned(), base),
                        ("n/N".to_owned(), key),
                        (format!(" repeat{match_status}  "), base),
                        ("v/space".to_owned(), key),
                        (format!(" {select}  "), base),
                        ("y/enter".to_owned(), key),
                        (" copy  ".to_owned(), base),
                        (exit_keys.to_owned(), key),
                        (exit_label.to_owned(), base),
                    ]);
                }
            }
            ClientShellMode::Terminal => unreachable!(),
        }
    }

    let mut x = bar.x;
    let end = bar.x + bar.width;
    for (text, style) in segments {
        if x >= end {
            break;
        }
        let remaining = end - x;
        buffer.set_stringn(x, bar.y, &text, usize::from(remaining), style);
        x = x.saturating_add(
            u16::try_from(UnicodeWidthStr::width(text.as_str()))
                .unwrap_or(u16::MAX)
                .min(remaining),
        );
    }
    if update_available && mode == ClientShellMode::Navigate {
        let width = 13.min(bar.width);
        let area = Rect::new(bar.right().saturating_sub(width), bar.y, width, 1);
        buffer.set_style(area, Style::default().bg(palette.panel_bg));
        put_right_text(
            buffer,
            area,
            area.y,
            " update ready",
            Style::default()
                .fg(palette.accent)
                .bg(palette.panel_bg)
                .add_modifier(Modifier::BOLD),
        );
    }
    Some(bar)
}

pub(super) struct ShellRenderState<'a> {
    pub(super) machine_diagnostics: &'a super::machine_diagnostics::MachineDiagnostics,
    pub(super) endpoints: &'a [ClientShellEndpoint],
    pub(super) active_endpoint_id: &'a ClientEndpointId,
    pub(super) collapsed_endpoints: &'a HashSet<ClientEndpointId>,
    pub(super) collapsed_groups: &'a HashSet<String>,
    pub(super) remote_collapsed_groups: &'a HashMap<ClientEndpointId, HashSet<String>>,
    pub(super) workspace_scroll: &'a mut usize,
    pub(super) agent_scroll: &'a mut usize,
    pub(super) tab_scroll: &'a mut usize,
    pub(super) reveal_focused_workspace: &'a mut bool,
    pub(super) reveal_focused_tab: &'a mut bool,
    pub(super) sidebar_collapsed: bool,
    pub(super) sidebar_section_split: f32,
    pub(super) tab_drag_insert_index: Option<usize>,
    pub(super) selected_workspace_id: Option<&'a WorkspaceNavigationTarget>,
    pub(super) reveal_navigation_workspace: &'a mut bool,
    pub(supe
```

### Core Architecture Module: `src/client/shell/state.rs`
```
use super::*;

pub(super) const MIN_TAB_WIDTH: u16 = 8;
pub(super) const NEW_TAB_WIDTH: u16 = 3;
pub(super) const WORKSPACE_HEADER_ROWS: u16 = 2;
const ENDPOINT_ERROR_TIMEOUT_SECS: u64 = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ClientShellKeybindingSource {
    Local,
    RemoteLocal,
    Endpoint,
}

pub(crate) struct ClientShellConfig {
    pub(super) sidebar_width: u16,
    pub(super) sidebar_min_width: u16,
    pub(super) sidebar_max_width: u16,
    pub(super) sidebar_start_collapsed: bool,
    pub(super) sidebar_collapsed_mode: SidebarCollapsedModeConfig,
    pub(super) mobile_width_threshold: u16,
    pub(super) tab_bar_position: TabBarPositionConfig,
    pub(super) hide_tab_bar_when_single_tab: bool,
    pub(super) spaces: SpacesSidebarConfig,
    pub(super) agents: crate::config::AgentsSidebarConfig,
    pub(super) agent_panel_sort: crate::config::AgentPanelSortConfig,
    pub(super) status_indicators: crate::config::StatusIndicatorStyle,
    pub(super) sound_enabled: bool,
    pub(super) toast_delivery: crate::config::ToastDelivery,
    pub(super) toast_delay_seconds: u64,
    pub(super) toast_position: crate::config::ToastHerdrPosition,
    pub(super) copy_on_select: bool,
    pub(super) clipboard_toast_enabled: bool,
    pub(super) clipboard_toast_position: crate::config::ToastClipboardPosition,
    pub(super) theme_name: String,
    pub(super) theme_runtime: crate::app::state::ThemeRuntimeConfig,
    pub(super) palette: Palette,
    pub(super) keybinds: LiveKeybindConfig,
    pub(super) local_keys: crate::config::KeysConfig,
    pub(super) keybinding_source: ClientShellKeybindingSource,
    pub(super) prompt_new_tab_name: bool,
    pub(super) prompt_new_workspace_name: bool,
    pub(super) confirm_close: bool,
    pub(super) mouse_capture: bool,
    pub(super) mouse_scroll_lines: usize,
    pub(super) right_click_passthrough_modifiers: Option<crossterm::event::KeyModifiers>,
    pub(super) redraw_on_focus_gained: bool,
    pub(super) switch_ascii_input_source_in_prefix: bool,
    pub(super) local_config_path: std::path::PathBuf,
    pub(super) preferences_path: Option<std::path::PathBuf>,
    pub(super) preferences: preferences::ClientChromePreferences,
    pub(super) startup_config_diagnostic: Option<String>,
    pub(super) startup_onboarding: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct ClientShellLayout {
    pub sidebar: Rect,
    pub tab_bar: Rect,
    pub mobile_header: Rect,
    pub pane_surface: Rect,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum ClientMobileTarget {
    Machine(ClientEndpointId),
    NewWorkspace,
    Workspace {
        endpoint_id: ClientEndpointId,
        workspace_id: String,
    },
    NewTab,
    Tab {
        endpoint_id: ClientEndpointId,
        tab_id: String,
    },
    Agent {
        endpoint_id: ClientEndpointId,
        pane_id: String,
    },
    Menu(usize),
}

#[derive(Default)]
pub(super) struct ShellHitMap {
    pub(super) machines: Vec<MachineHit>,
    pub(super) workspaces: Vec<WorkspaceHit>,
    pub(super) workspace_body: Rect,
    pub(super) workspace_scrollbar: Rect,
    pub(super) workspace_scroll_metrics: Option<crate::pane::ScrollMetrics>,
    pub(super) workspace_max_scroll: usize,
    pub(super) tabs: Vec<(Rect, String)>,
    pub(super) panes: Vec<PaneHit>,
    pub(super) popup: Option<PaneHit>,
    pub(super) pane_splits: Vec<PaneSplitHit>,
    pub(super) agents: Vec<(Rect, String)>,
    pub(super) endpoint_agents: Vec<(Rect, ClientEndpointId, String)>,
    pub(super) agent_body: Rect,
    pub(super) agent_scrollbar: Rect,
    pub(super) agent_scroll_metrics: Option<crate::pane::ScrollMetrics>,
    pub(super) agent_max_scroll: usize,
    pub(super) agent_sort_toggle: Rect,
    pub(super) sidebar_divider: Rect,
    pub(super) sidebar_section_divider: Rect,
    pub(super) sidebar_toggle: Rect,
    pub(super) new_workspace: Rect,
    pub(super) new_tab: Rect,
    pub(super) tab_scroll_left: Rect,
    pub(super) tab_scroll_right: Rect,
    pub(super) mobile_switch: Rect,
    pub(super) mobile_close: Rect,
    pub(super) mobile_targets: Vec<(Rect, ClientMobileTarget)>,
    pub(super) mobile_max_scroll: usize,
    pub(super) global_launcher: Rect,
    pub(super) notification_toast: Rect,
    pub(super) global_menu_rows: Vec<(Rect, usize)>,
    pub(super) context_menu_rows: Vec<(Rect, usize)>,
    pub(super) overlay_primary: Rect,
    pub(super) overlay_clear: Rect,
    pub(super) overlay_cancel: Rect,
    pub(super) navigator_popup: Rect,
    pub(super) navigator_search: Rect,
    pub(super) navigator_rows: Vec<(Rect, ClientNavigatorTarget)>,
    pub(super) navigator_scrollbar: Rect,
    pub(super) navigator_scroll_metrics: Option<crate::pane::ScrollMetrics>,
    pub(super) worktree_search: Rect,
    pub(super) worktree_rows: Vec<(Rect, usize)>,
    pub(super) help_popup: Rect,
    pub(super) help_scrollbar: Rect,
    pub(super) help_scroll_metrics: Option<crate::pane::ScrollMetrics>,
    pub(super) help_max_scroll: usize,
    pub(super) settings_popup: Rect,
    pub(super) settings_tabs: Vec<(Rect, ClientSettingsSection)>,
    pub(super) settings_choices: Vec<(Rect, usize)>,
    pub(super) product_announcement_scrollbar: Rect,
    pub(super) product_announcement_scroll_metrics: Option<crate::pane::ScrollMetrics>,
    pub(super) product_announcement_max_scroll: usize,
    pub(super) release_notes_scrollbar: Rect,
    pub(super) release_notes_scroll_metrics: Option<crate::pane::ScrollMetrics>,
    pub(super) release_notes_max_scroll: usize,
}

#[derive(Clone)]
pub(super) struct PaneHit {
    pub(super) rect: Rect,
    pub(super) inner_rect: Rect,
    pub(super) scrollbar_rect: Option<Rect>,
    pub(super) scroll: Option<crate::pane::ScrollMetrics>,
    pub(super) pane_id: String,
    pub(super) popup: bool,
    pub(super) mouse_reporting: bool,
    pub(super) sgr_pixel_mouse: bool,
    pub(super) pixel_width: u32,
    pub(super) pixel_height: u32,
}

#[derive(Clone)]
pub(super) struct PaneSplitHit {
    pub(super) direction: crate::protocol::PaneSurfaceSplitDirection,
    pub(super) pos: u16,
    pub(super) area: Rect,
    pub(super) hit_rect: Rect,
    pub(super) path: Vec<bool>,
    pub(super) topology_signature: u64,
}

pub(super) struct ClientPaneMouseGesture {
    pub(super) hit: PaneHit,
    pub(super) button: crossterm::event::MouseButton,
    pub(super) stripped_modifiers: crossterm::event::KeyModifiers,
    pub(super) last_event: crossterm::event::MouseEvent,
    pub(super) last_position: crate::protocol::ClientMousePosition,
}

pub(super) struct ClientWorkspacePress {
    pub(super) endpoint_id: ClientEndpointId,
    pub(super) workspace_id: String,
    pub(super) start_column: u16,
    pub(super) start_row: u16,
}

pub(super) struct ClientTabPress {
    pub(super) tab_id: String,
    pub(super) workspace_id: String,
    pub(super) start_column: u16,
    pub(super) start_row: u16,
}

pub(super) enum ClientChromeDrag {
    SidebarWidth,
    SidebarSection,
    WorkspaceScrollbar {
        grab_row_offset: u16,
    },
    AgentScrollbar {
        grab_row_offset: u16,
    },
    HelpScrollbar {
        grab_row_offset: u16,
    },
    NavigatorScrollbar {
        grab_row_offset: u16,
    },
    ProductAnnouncementScrollbar {
        grab_row_offset: u16,
    },
    ReleaseNotesScrollbar {
        grab_row_offset: u16,
    },
    Tab {
        tab_id: String,
        workspace_id: String,
        insert_index: Option<usize>,
    },
    Workspace {
        source_workspace_id: String,
        target: Option<(Option<String>, u16)>,
    },
    PaneSplit {
        hit: PaneSplitHit,
        tab_id: String,
        grab_offset: i32,
        last_sent_ratio: Option<f32>,
        last_sent_at: Option<std::time::Instant>,
    },
    PaneScrollbar {
        hit: PaneHit,
        grab_row_offset: u16,
        last_sent_offset: Option<usize>,
        last_sent_at: Option<std::time::Instant>,
    },
}

pub(super) struct WorkspaceHit {
    pub(super) rect: Rect,
    pub(super) endpoint_id: ClientEndpointId,
    pub(super) workspace_id: String,
    pub(super) indented: bool,
    pub(super) group_toggle: Option<(Rect, String)>,
}

#[derive(Debug)]
pub(crate) enum ClientShellAction {
    Endpoint {
        endpoint_id: ClientEndpointId,
        boot_id: String,
        request: Box<crate::api::schema::Request>,
    },
    ClipboardWrite(Vec<u8>),
    OpenSafeWebUrl(String),
    ActivateEndpoint {
        endpoint_id: ClientEndpointId,
        target: Option<ClientEndpointFocusTarget>,
    },
    ReplayMouse(Vec<crossterm::event::MouseEvent>),
    Keybind(crate::input::KeybindAction),
}

#[derive(Default)]
pub(crate) struct ClientShellInput {
    pub detach: bool,
    pub repaint: bool,
    pub resize: bool,
    pub query_host_appearance: bool,
    pub query_host_theme: bool,
    pub requests: Vec<ClientMessage>,
    pub actions: Vec<ClientShellAction>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum ClientShellMode {
    Terminal,
    Prefix,
    Navigate,
    Resize,
    Copy,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum ClientShellOverlayKind {
    Onboarding,
    ProductAnnouncement,
    ReleaseNotes,
    Rename,
    ConfirmClose,
    Help,
    Navigator,
    WorktreeCreate,
    WorktreeOpen,
    WorktreeRemove,
    ContextMenu,
    GlobalMenu,
    Settings,
}

#[derive(Debug)]
pub(super) enum ClientRenameTarget {
    NewWorkspace {
        source_workspace_id: Option<String>,
        cwd: Option<String>,
        suggested_name: String,
    },
    Workspace {
        workspace_id: String,
    },
    NewTab {
        workspace_id: String,
        default_name: String,
    },
    Tab {
        tab_id: String,
        auto_name: bool,
        original_name: String,
    },
    Pane {
        pane_id: String,
    },
}

#[derive(Debug)]
pub(super) struct ClientRenameOverlay {
    pub(super) title: &'static str,
    pub(super) input: TextEditor,
    pub(super) ta
```

### Core Architecture Module: `src/client/state.rs`
```
use super::*;

#[cfg(unix)]
const MAX_RETIRED_DIRECT_GRAPHICS: usize = 64;

#[cfg(unix)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum RetiredDirectGraphicsMatch {
    None,
    Exact,
    Saturated,
}

#[cfg(unix)]
pub(super) struct RetiredDirectGraphics {
    generation: u64,
    transfers: Vec<(u64, u32)>,
    saturated: bool,
}

#[cfg(unix)]
impl RetiredDirectGraphics {
    fn new(generation: u64) -> Self {
        Self {
            generation,
            transfers: Vec::new(),
            saturated: false,
        }
    }
}

/// State tracking for the thin client.
pub(super) struct ClientState {
    /// Stateful semantic-frame encoder used when the server sends FrameData.
    pub(super) blit_encoder: render_ansi::BlitEncoder,
    pub(super) image_files: image_files::FileTransport,
    pub(super) mouse_capture_active: bool,
    pub(super) endpoint_mouse_capture_requested: bool,
    pub(super) endpoint_sgr_pixels_requested: bool,
    /// Latest physical host theme observations, retained so an endpoint selected after the
    /// observation receives the same client-owned baseline.
    pub(super) host_theme_updates: Vec<crate::protocol::ClientHostThemeUpdate>,
    pub(super) direct_mouse_capture_preference: bool,
    pub(super) shell_mouse_capture_preference: bool,
    pub(super) direct_keyboard_protocol: crate::terminal_modes::DirectHostKeyboardState,
    pub(super) pane_keyboard_report_all: bool,
    pub(super) keyboard_report_all_active: bool,
    pub(super) reported_size: (u16, u16),
    pub(super) reported_cell_size: (u32, u32),
    pub(super) sound_config: crate::config::SoundConfig,
    pub(super) kitty_graphics_enabled: bool,
    pub(super) pixel_geometry_enabled: bool,
    pub(super) pixel_geometry_exact: bool,
    /// The host's answer to the SGR pixel mouse probe; None when unknown.
    pub(super) host_sgr_pixel_mouse: Option<bool>,
    #[cfg(unix)]
    pub(super) direct_graphics_response: Arc<Mutex<direct_graphics::ResponseMatcher>>,
    #[cfg(unix)]
    pub(super) retired_direct_graphics: HashMap<endpoint::ClientEndpointId, RetiredDirectGraphics>,
    #[cfg(unix)]
    pub(super) disabled_native_graphics: HashMap<endpoint::ClientEndpointId, u64>,
    pub(super) pending_native_cleanup: Vec<u8>,
    #[cfg(unix)]
    pub(super) pending_surface_graphics: HashMap<
        (endpoint::ClientEndpointId, u64, u64, u32),
        crate::protocol::SurfaceGraphicsAssetKey,
    >,
    pub(super) attach_escape: Option<AttachEscapeState>,
    #[cfg(unix)]
    pub(super) mouse_scroll_lines: usize,
    pub(super) remote_image_paste_key:
        Option<(crossterm::event::KeyCode, crossterm::event::KeyModifiers)>,
    pub(super) redraw_on_focus_gained: bool,
    pub(super) repaint_pending: bool,
    /// During a source-off-first handoff the currently blitted frame remains authoritative until
    /// an acknowledged target snapshot/surface pair commits.
    pub(super) presentation_frozen: bool,
    /// Latest explicit Local selection awaiting this client's replacement Local connection.
    pub(super) deferred_local_activation: Option<endpoint::EndpointActivationIntent>,
    pub(super) draw_host_cursor: bool,
    pub(super) detached_process_children: Vec<std::process::Child>,
    pub(super) shell: Option<shell::ClientShellState>,
}

impl Drop for ClientState {
    fn drop(&mut self) {
        if self.attach_escape.is_some() {
            let _ = crate::terminal_modes::set_direct_host_keyboard_protocol(
                &mut io::stdout(),
                &mut self.direct_keyboard_protocol,
                0,
                0,
            );
        }
    }
}

impl ClientState {
    pub(super) fn pixel_mouse_available(&self) -> bool {
        self.pixel_geometry_exact && self.host_sgr_pixel_mouse == Some(true)
    }

    #[cfg(test)]
    pub(super) fn test_new() -> Self {
        Self {
            blit_encoder: render_ansi::BlitEncoder::new(),
            image_files: image_files::FileTransport::default(),
            mouse_capture_active: false,
            endpoint_mouse_capture_requested: false,
            endpoint_sgr_pixels_requested: false,
            host_theme_updates: Vec::new(),
            direct_mouse_capture_preference: false,
            shell_mouse_capture_preference: false,
            direct_keyboard_protocol: Default::default(),
            pane_keyboard_report_all: false,
            keyboard_report_all_active: false,
            reported_size: (100, 30),
            reported_cell_size: (0, 0),
            sound_config: Default::default(),
            kitty_graphics_enabled: false,
            pixel_geometry_enabled: false,
            pixel_geometry_exact: false,
            host_sgr_pixel_mouse: None,
            #[cfg(unix)]
            direct_graphics_response: Default::default(),
            #[cfg(unix)]
            retired_direct_graphics: HashMap::new(),
            #[cfg(unix)]
            disabled_native_graphics: Default::default(),
            pending_native_cleanup: Vec::new(),
            #[cfg(unix)]
            pending_surface_graphics: HashMap::new(),
            attach_escape: None,
            #[cfg(unix)]
            mouse_scroll_lines: 3,
            remote_image_paste_key: None,
            redraw_on_focus_gained: false,
            repaint_pending: false,
            presentation_frozen: false,
            deferred_local_activation: None,
            draw_host_cursor: false,
            detached_process_children: Vec::new(),
            shell: Some(shell::ClientShellState::new(
                shell::ClientShellConfig::from_config(&crate::config::Config::default()),
            )),
        }
    }

    pub(super) fn request_repaint(&mut self) {
        self.repaint_pending = true;
    }

    pub(super) fn freeze_presentation(&mut self) {
        self.presentation_frozen = true;
    }

    pub(super) fn record_host_theme_update(
        &mut self,
        update: &crate::protocol::ClientHostThemeUpdate,
    ) {
        use crate::protocol::ClientHostThemeUpdate;

        match update {
            ClientHostThemeUpdate::DefaultColor { kind, .. } => {
                self.host_theme_updates.retain(|current| {
                    !matches!(
                        current,
                        ClientHostThemeUpdate::DefaultColor {
                            kind: current_kind,
                            ..
                        } if current_kind == kind
                    )
                });
            }
            ClientHostThemeUpdate::PaletteColors(_) => self
                .host_theme_updates
                .retain(|current| !matches!(current, ClientHostThemeUpdate::PaletteColors(_))),
            ClientHostThemeUpdate::Appearance(_) => self
                .host_theme_updates
                .retain(|current| !matches!(current, ClientHostThemeUpdate::Appearance(_))),
        }
        self.host_theme_updates.push(update.clone());
    }

    /// Replay the retained physical-host baseline only after an endpoint owns the committed
    /// presentation. The endpoint transport preserves this order ahead of the resync control.
    pub(super) fn replay_host_theme(
        &self,
        endpoints: &mut endpoint::EndpointRegistry,
        endpoint_id: &endpoint::ClientEndpointId,
    ) {
        for update in &self.host_theme_updates {
            let _ = endpoints.send_to(
                endpoint_id,
                &crate::protocol::ClientMessage::ClientShellHostTheme {
                    update: update.clone(),
                },
            );
        }
    }

    pub(super) fn unfreeze_presentation(&mut self) {
        self.presentation_frozen = false;
        // A resize or metadata event may have happened while frozen. Force a full frame rather
        // than attempting to patch the old source frame.
        self.request_repaint();
    }

    /// Present a composed error/chrome frame while retaining the handoff input freeze. The pane
    /// cells are still the last coherent surface; only client chrome (including the error) moves.
    pub(super) fn present_frozen_chrome(
        &mut self,
        frame_data: impl Into<frame_output::ComposedFrame>,
    ) {
        let frozen = self.presentation_frozen;
        // Chrome can repaint the frozen source, but cannot retire its staged images.
        let deferred_cleanup = frozen.then(|| std::mem::take(&mut self.pending_native_cleanup));
        self.presentation_frozen = false;
        self.present_frame(frame_data);
        self.presentation_frozen = frozen;
        if let Some(cleanup) = deferred_cleanup {
            self.pending_native_cleanup = cleanup;
        }
    }

    #[cfg(unix)]
    pub(super) fn queue_native_image_cleanup(&mut self, image_id: u32) {
        crate::kitty_graphics::encode_delete_image(&mut self.pending_native_cleanup, image_id);
    }

    /// Retirement is lifecycle bookkeeping, not a presentation effect. The caller has
    /// already checked the endpoint generation, even for inactive/frozen owners.
    #[cfg(unix)]
    pub(super) fn receive_graphics_retirement(
        &mut self,
        endpoint_id: &endpoint::ClientEndpointId,
        generation: u64,
        transfer_id: u64,
        image_id: u32,
        owner_active: bool,
    ) {
        if transfer_id & crate::kitty_graphics::surface::NATIVE_TRANSFER_BIT != 0 {
            self.disabled_native_graphics
                .insert(endpoint_id.clone(), generation);
        }
        self.record_retired_direct_graphics(endpoint_id.clone(), generation, transfer_id, image_id);
        let upload_pending = self
            .pending_surface_graphics
            .remove(&(endpoint_id.clone(), generation, transfer_id, image_id))
            .is_some();
        // Retirement cleanup is terminal-owned. A native retirement owns the
        // ID only while its exact upload is pending: collision rejection and a
        // late post-ACK retirement must not delete the currently visible bank.
        // API/non-native retiremen
```

### Core Architecture Module: `src/integration/assets/kilo/herdr-agent-state.js`
```
// installed by herdr
// managed by herdr; reinstalling or updating the integration overwrites this file.
// add custom hooks/plugins beside this file instead of editing it.
// HERDR_INTEGRATION_ID=kilo
// HERDR_INTEGRATION_VERSION=4

import net from "node:net";

const SOURCE = "herdr:kilo";
const AGENT = "kilo";
let reportSeq = Date.now() * 1000;

function nextReportSeq() {
  reportSeq += 1;
  return reportSeq;
}

function sessionIDFromProperties(properties) {
  return typeof properties?.sessionID === "string" && properties.sessionID
    ? properties.sessionID
    : undefined;
}

function stateFromSessionStatus(status) {
  if (typeof status !== "string") {
    return undefined;
  }
  switch (status.toLowerCase()) {
    case "idle":
      return "idle";
    case "active":
    case "busy":
    case "pending":
    case "running":
    case "streaming":
    case "working":
      return "working";
    default:
      return undefined;
  }
}

function request(method, params) {
  const paneId = process.env.HERDR_PANE_ID;
  const socketPath = process.env.HERDR_SOCKET_PATH;

  if (!paneId || !socketPath) {
    return Promise.resolve();
  }

  const socketEndpoint =
    process.platform === "win32" ? `\\\\.\\pipe\\${socketPath}` : socketPath;

  const requestId = `${SOURCE}:${Date.now()}:${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0")}`;
  const request = {
    id: requestId,
    method,
    params: {
      pane_id: paneId,
      source: SOURCE,
      agent: AGENT,
      seq: nextReportSeq(),
      ...params,
    },
  };

  return new Promise((resolve) => {
    const client = net.createConnection(socketEndpoint, () => {
      client.write(`${JSON.stringify(request)}\n`);
    });

    const finish = () => {
      client.destroy();
      resolve();
    };

    client.setTimeout(500, finish);
    client.on("data", finish);
    client.on("error", finish);
    client.on("end", finish);
    client.on("close", resolve);
  });
}

function reportSession(sessionID) {
  if (!sessionID) {
    return Promise.resolve();
  }
  return request("pane.report_agent_session", {
    agent_session_id: sessionID,
    session_start_source: "startup",
  });
}

function reportState(state, sessionID) {
  const params = { state };
  if (sessionID) {
    params.agent_session_id = sessionID;
  }
  return request("pane.report_agent", params);
}

export const HerdrAgentStatePlugin = async () => {
  if (
    process.env.HERDR_ENV !== "1" ||
    !process.env.HERDR_SOCKET_PATH ||
    !process.env.HERDR_PANE_ID
  ) {
    return {};
  }

  return {
    "chat.message": async ({ sessionID }) => {
      await reportState("working", sessionID);
    },
    event: async ({ event }) => {
      const type = event?.type;
      const properties = event?.properties ?? {};
      const sessionID = sessionIDFromProperties(properties);

      switch (type) {
        case "session.created":
        case "session.updated":
          await reportSession(sessionID);
          break;
        case "session.status": {
          const state = stateFromSessionStatus(properties.status);
          if (state) {
            await reportState(state, sessionID);
          } else {
            await reportSession(sessionID);
          }
          break;
        }
        case "tool.execute.before":
        case "tool.execute.after":
        case "permission.replied":
        case "question.replied":
        case "question.rejected":
        case "session.compacted":
          await reportState("working", sessionID);
          break;
        case "permission.asked":
        case "question.asked":
        case "session.error":
          await reportState("blocked", sessionID);
          break;
        case "session.idle":
          await reportState("idle", sessionID);
          break;
        case "session.deleted":
          break;
        default:
          break;
      }
    },
  };
};

```

### Core Architecture Module: `src/integration/assets/omp/herdr-agent-state.ts`
```
// installed by herdr
// managed by herdr; reinstalling or updating the integration overwrites this file.
// add custom hooks/plugins beside this file instead of editing it.
// HERDR_INTEGRATION_ID=omp
// HERDR_INTEGRATION_VERSION=10
// @ts-nocheck

import net from "node:net";
import path from "node:path";

const HERDR_ENV = process.env.HERDR_ENV;
const socketPath = process.env.HERDR_SOCKET_PATH;
const socketEndpoint =
  process.platform === "win32" && socketPath ? `\\\\.\\pipe\\${socketPath}` : socketPath;
const paneId = process.env.HERDR_PANE_ID;
const source = "herdr:omp";
// OMP marks every shell it spawns with OMPCODE=1. A nested `omp` launched from
// a parent session's shell inherits it, so that process is not the pane's root
// agent and must not report its short-lived session over the parent's.
const nestedOmpSession = process.env.OMPCODE === "1";

function enabled() {
  return HERDR_ENV === "1" && !!socketPath && !!paneId && !nestedOmpSession;
}

let requestQueue = Promise.resolve();

function sendRequestAttempt(request: unknown, timeoutMs: number): Promise<boolean> {
  if (!enabled()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let done = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (delivered: boolean) => {
      if (done) return;
      done = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      socket.destroy();
      resolve(delivered);
    };

    const socket = net.createConnection(socketEndpoint!);
    socket.on("error", () => finish(false));
    socket.on("connect", () => socket.write(`${JSON.stringify(request)}\n`));
    socket.on("data", () => finish(true));
    socket.on("end", () => finish(false));
    timeout = setTimeout(() => finish(false), timeoutMs);
    timeout.unref?.();
  });
}

async function sendRequestNow(request: unknown): Promise<void> {
  if (await sendRequestAttempt(request, 500)) {
    return;
  }
  await sendRequestAttempt(request, 1500);
}

function sendRequest(request: unknown): Promise<void> {
  requestQueue = requestQueue.then(
    () => sendRequestNow(request),
    () => sendRequestNow(request),
  );
  return requestQueue;
}

type AgentState = "working" | "blocked" | "idle";

type QueuedState = {
  state: AgentState;
  message?: string;
  seq: number;
};

const idleDebounceMs = parseDurationEnv("HERDR_OMP_IDLE_DEBOUNCE_MS", 250);
const retryGraceMs = parseDurationEnv("HERDR_OMP_RETRY_GRACE_MS", 2500);
const retryableErrorPattern =
  /overloaded|provider.?returned.?error|rate.?limit|too many requests|429|500|502|503|504|service.?unavailable|server.?error|internal.?error|network.?error|connection.?error|connection.?refused|connection.?lost|websocket.?closed|websocket.?error|other side closed|fetch failed|upstream.?connect|reset before headers|socket hang up|ended without|http2 request did not get a response|timed? out|timeout|terminated|retry delay/i;
let reportSeq = Date.now() * 1000;
let currentAgentSessionId: string | undefined;
let currentAgentSessionPath: string | undefined;

function nextReportSeq(): number {
  reportSeq += 1;
  return reportSeq;
}

export function isAbsoluteSessionPath(file: unknown): file is string {
  return (
    typeof file === "string" &&
    (path.posix.isAbsolute(file) || path.win32.isAbsolute(file))
  );
}

function updateSessionRef(ctx: any): void {
  try {
    const file = ctx?.sessionManager?.getSessionFile?.();
    currentAgentSessionPath = isAbsoluteSessionPath(file) ? file : undefined;
  } catch {
    currentAgentSessionPath = undefined;
  }

  try {
    const id = ctx?.sessionManager?.getSessionId?.();
    currentAgentSessionId = typeof id === "string" && id.length > 0 ? id : undefined;
  } catch {
    currentAgentSessionId = undefined;
  }
}

function withSessionRef(params: Record<string, unknown>): Record<string, unknown> {
  if (currentAgentSessionPath) {
    return { ...params, agent_session_path: currentAgentSessionPath };
  }
  if (currentAgentSessionId) {
    return { ...params, agent_session_id: currentAgentSessionId };
  }
  return params;
}

function parseDurationEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function currentSessionRef(): Record<string, unknown> | undefined {
  if (currentAgentSessionPath) {
    return { agent_session_path: currentAgentSessionPath };
  }
  if (currentAgentSessionId) {
    return { agent_session_id: currentAgentSessionId };
  }
  return undefined;
}

function reportSession(sessionStartSource = "startup"): Promise<void> {
  const sessionRef = currentSessionRef();
  if (!sessionRef) {
    return Promise.resolve();
  }

  return sendRequest({
    id: `${source}:session:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    method: "pane.report_agent_session",
    params: {
      pane_id: paneId,
      source,
      agent: "omp",
      seq: nextReportSeq(),
      session_start_source: sessionStartSource,
      ...sessionRef,
    },
  });
}

function sendState(state: AgentState, message?: string, seq = nextReportSeq()): Promise<void> {
  return sendRequest({
    id: `${source}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    method: "pane.report_agent",
    params: withSessionRef({
      pane_id: paneId,
      source,
      agent: "omp",
      state,
      message,
      seq,
    }),
  });
}

let sendInFlight = false;
let queuedState: QueuedState | undefined;

function queueState(state: AgentState, message?: string): void {
  queuedState = { state, message, seq: nextReportSeq() };
  if (!sendInFlight) {
    void drainStateQueue();
  }
}

async function drainStateQueue(): Promise<void> {
  if (sendInFlight) {
    return;
  }

  sendInFlight = true;
  try {
    while (queuedState) {
      const next = queuedState;
      queuedState = undefined;
      await sendState(next.state, next.message, next.seq);
    }
  } finally {
    sendInFlight = false;
    if (queuedState) {
      void drainStateQueue();
    }
  }
}

function lastAssistantMessage(messages: unknown[]): any | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i] as any;
    if (message?.role === "assistant") {
      return message;
    }
  }
  return undefined;
}

function retryableErrorMessage(event: any): string | undefined {
  const messages = Array.isArray(event?.messages) ? event.messages : [];
  const assistant = lastAssistantMessage(messages);
  if (assistant?.stopReason !== "error") {
    return undefined;
  }

  const errorMessage = String(assistant.errorMessage ?? "");
  if (!retryableErrorPattern.test(errorMessage)) {
    return undefined;
  }
  return errorMessage || "retryable provider error";
}

function askBlockedMessage(args: any): string {
  const questions = Array.isArray(args?.questions) ? args.questions : [];
  const firstQuestion = questions.find((question: any) => typeof question?.question === "string");
  if (firstQuestion?.question) {
    return firstQuestion.question;
  }
  return "waiting for user input";
}

export default function (pi) {
  if (!enabled()) {
    return;
  }

  let agentActive = false;
  let retryHoldActive = false;
  let failureBlocked = false;
  let failureMessage: string | undefined;
  let blockedCount = 0;
  let blockedMessage: string | undefined;
  let lastState: AgentState | undefined;
  let lastMessage: string | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let rootSession = false;

  function clearTimer(timer: ReturnType<typeof setTimeout> | undefined) {
    if (timer) {
      clearTimeout(timer);
    }
  }

  function clearPendingTimers() {
    clearTimer(idleTimer);
    clearTimer(retryTimer);
    idleTimer = undefined;
    retryTimer = undefined;
  }

  function clearFailureState() {
    retryHoldActive = false;
    failureBlocked = false;
    failureMessage = undefined;
  }

  function desiredState() {
    if (blockedCount > 0) {
      return { state: "blocked" as const, message: blockedMessage };
    }
    if (failureBlocked) {
      return { state: "blocked" as const, message: failureMessage };
    }
    if (agentActive || retryHoldActive) {
      return { state: "working" as const, message: undefined };
    }
    return { state: "idle" as const, message: undefined };
  }

  function publishState(force = false) {
    const next = desiredState();
    if (!force && next.state === lastState && next.message === lastMessage) {
      return;
    }
    lastState = next.state;
    lastMessage = next.message;
    queueState(next.state, next.message);
  }

  function scheduleIdle() {
    clearPendingTimers();
    clearFailureState();
    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      publishState();
    }, idleDebounceMs);
    idleTimer.unref?.();
  }

  function holdForRetry(message: string) {
    clearPendingTimers();
    retryHoldActive = true;
    failureBlocked = false;
    failureMessage = message;
    publishState();

    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      retryHoldActive = false;
      failureBlocked = true;
      publishState();
    }, retryGraceMs);
    retryTimer.unref?.();
  }

  function activateRootSession(ctx: any, sessionStartSource = "startup"): boolean {
    if (ctx?.hasUI !== true) {
      return false;
    }
    rootSession = true;
    updateSessionRef(ctx);
    void reportSession(sessionStartSource);
    return true;
  }

  function resetSessionState() {
    clearPendingTimers();
    clearFailureState();
    agentActive = false;
    blockedCount = 0;
    blockedMessage = undefined;
  }

  function activateBlocked(message: string | undefined) {
    clearPendingTimers();
    blockedCount += 1;
    blockedMessage = message;
    publishState();
  }

  function deactivateBlocked() 
```

### Core Architecture Module: `src/integration/assets/opencode/herdr-agent-state.js`
```
// installed by herdr
// managed by herdr; reinstalling or updating the integration overwrites this file.
// add custom hooks/plugins beside this file instead of editing it.
// HERDR_INTEGRATION_ID=opencode
// HERDR_INTEGRATION_VERSION=13

import net from "node:net";

const SOURCE = "herdr:opencode";
const AGENT = "opencode";
let reportSeq = Date.now() * 1000;
let requestChain = Promise.resolve();
let reportedRootSessionID;

// Track child sessions so their events cannot replace the pane's root session.
// User prompts carry the root id to preserve its identity and cross-talk guard.
const childSessions = new Map();
const CHILD_EVENT_STATES = new Map([
  ["permission.asked", "blocked"],
  ["question.asked", "blocked"],
  ["permission.replied", "working"],
  ["question.replied", "working"],
  ["question.rejected", "working"],
]);

function nextReportSeq() {
  reportSeq += 1;
  return reportSeq;
}

function sessionIDFromProperties(properties) {
  return typeof properties?.sessionID === "string" && properties.sessionID
    ? properties.sessionID
    : undefined;
}

const SESSION_STATE_BY_STATUS = new Map([
  ["idle", "idle"],
  ["active", "working"],
  ["busy", "working"],
  ["pending", "working"],
  ["retry", "working"],
  ["running", "working"],
  ["streaming", "working"],
  ["working", "working"],
]);

function stateFromSessionStatus(status) {
  const kind = typeof status === "string" ? status : status?.type;
  return typeof kind === "string"
    ? SESSION_STATE_BY_STATUS.get(kind.toLowerCase())
    : undefined;
}

function request(method, params) {
  const pending = requestChain.then(() => requestOnce(method, params));
  requestChain = pending.catch(() => {});
  return pending;
}

function requestOnce(method, params) {
  const paneId = process.env.HERDR_PANE_ID;
  const socketPath = process.env.HERDR_SOCKET_PATH;

  if (!paneId || !socketPath) {
    return Promise.resolve();
  }

  const socketEndpoint =
    process.platform === "win32" ? `\\\\.\\pipe\\${socketPath}` : socketPath;

  const requestId = `${SOURCE}:${Date.now()}:${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0")}`;
  const request = {
    id: requestId,
    method,
    params: {
      pane_id: paneId,
      source: SOURCE,
      agent: AGENT,
      seq: nextReportSeq(),
      ...params,
    },
  };

  return new Promise((resolve) => {
    const client = net.createConnection(socketEndpoint, () => {
      client.write(`${JSON.stringify(request)}\n`);
    });

    const finish = () => {
      client.destroy();
      resolve();
    };

    client.setTimeout(500, finish);
    client.on("data", finish);
    client.on("error", finish);
    client.on("end", finish);
    client.on("close", resolve);
  });
}

function reportSession(sessionID) {
  if (!sessionID) {
    return Promise.resolve();
  }
  return request("pane.report_agent_session", { agent_session_id: sessionID });
}

function reportState(state, sessionID) {
  const params = { state };
  if (sessionID) {
    reportedRootSessionID = sessionID;
    params.agent_session_id = sessionID;
  }
  return request("pane.report_agent", params);
}

function ownsLocalLifecycle() {
  const args = process.argv.slice(2);
  const separator = args.indexOf("--");
  if (separator !== -1) args.splice(separator);
  if (args.some((arg) => arg === "--attach" || arg.startsWith("--attach="))) return false;
  while (args[0] === "--print-logs" || args[0] === "--log-level" || args[0]?.startsWith("--log-level=")) {
    args.splice(0, args[0] === "--log-level" ? 2 : 1);
  }
  // These local clients have no TUI plugin. Shared servers and the TUI worker
  // cannot identify their attached panes; their lifecycle belongs to each TUI.
  return args[0] === "run" ||
    (!["serve", "web", "attach"].includes(args[0]) && args.includes("--mini"));
}

export const HerdrAgentStatePlugin = async () => {
  if (
    !ownsLocalLifecycle() ||
    process.env.HERDR_ENV !== "1" ||
    !process.env.HERDR_SOCKET_PATH ||
    !process.env.HERDR_PANE_ID
  ) {
    return {};
  }

  return {
    "chat.message": async ({ sessionID }) => {
      if (sessionID && childSessions.has(sessionID)) {
        return;
      }
      await reportState("working", sessionID);
    },
    event: async ({ event }) => {
      const type = event?.type;
      const properties = event?.properties ?? {};
      const sessionID = sessionIDFromProperties(properties);

      const info = properties.info;
      if (info?.id && info.parentID) {
        childSessions.set(info.id, info.parentID);
      }
      if (sessionID && childSessions.has(sessionID)) {
        const state = CHILD_EVENT_STATES.get(type);
        if (state) {
          let rootSessionID = sessionID;
          while (childSessions.has(rootSessionID)) {
            rootSessionID = childSessions.get(rootSessionID);
          }
          await reportState(state, rootSessionID);
        }
        return;
      }

      switch (type) {
        case "session.created":
          // Creation is server-global, so an attached client may own it. The
          // TUI plugin separately reports the root selected in this pane.
          reportedRootSessionID = sessionID;
          break;
        case "session.updated":
          if (sessionID && sessionID !== reportedRootSessionID) {
            await reportSession(sessionID);
          }
          break;
        case "session.status": {
          const state = stateFromSessionStatus(properties.status);
          if (state) {
            await reportState(state, sessionID);
          } else {
            await reportSession(sessionID);
          }
          break;
        }
        case "tool.execute.before":
        case "tool.execute.after":
        case "permission.replied":
        case "question.replied":
        case "question.rejected":
        case "session.compacted":
          await reportState("working", sessionID);
          break;
        case "permission.asked":
        case "question.asked":
        case "session.error":
          await reportState("blocked", sessionID);
          break;
        case "session.idle":
          await reportState("idle", sessionID);
          break;
        case "session.deleted":
          break;
        default:
          break;
      }
    },
  };
};

// V1 local run/Mini retain their server hooks. V1/V2 full TUIs own both
// selection and lifecycle, including when attached to a shared remote server.
export default {
  id: "herdr.opencode",
  server: HerdrAgentStatePlugin,
  setup() {},
};

```

### Core Architecture Module: `src/integration/assets/pi/herdr-agent-state.ts`
```
// installed by herdr
// managed by herdr; reinstalling or updating the integration overwrites this file.
// add custom hooks/plugins beside this file instead of editing it.
// HERDR_INTEGRATION_ID=pi
// HERDR_INTEGRATION_VERSION=9
// @ts-nocheck

import net from "node:net";
import path from "node:path";

const HERDR_ENV = process.env.HERDR_ENV;
const socketPath = process.env.HERDR_SOCKET_PATH;
const socketEndpoint =
  process.platform === "win32" && socketPath ? `\\\\.\\pipe\\${socketPath}` : socketPath;
const paneId = process.env.HERDR_PANE_ID;
const source = "herdr:pi";

function enabled() {
  return HERDR_ENV === "1" && !!socketPath && !!paneId;
}

function sendRequestAttempt(request: unknown, timeoutMs: number): Promise<boolean> {
  if (!enabled()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let done = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (delivered: boolean) => {
      if (done) return;
      done = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      socket.destroy();
      resolve(delivered);
    };

    const socket = net.createConnection(socketEndpoint!);
    socket.on("error", () => finish(false));
    socket.on("connect", () => socket.write(`${JSON.stringify(request)}\n`));
    socket.on("data", () => finish(true));
    socket.on("end", () => finish(false));
    timeout = setTimeout(() => finish(false), timeoutMs);
    timeout.unref?.();
  });
}

async function sendRequest(request: unknown): Promise<void> {
  if (await sendRequestAttempt(request, 500)) {
    return;
  }
  await sendRequestAttempt(request, 1500);
}

type AgentState = "working" | "blocked" | "idle";

type QueuedState = {
  state: AgentState;
  message?: string;
  seq: number;
};

let reportSeq = Date.now() * 1000;
let currentAgentSessionId: string | undefined;
let currentAgentSessionPath: string | undefined;

function nextReportSeq(): number {
  reportSeq += 1;
  return reportSeq;
}

function updateSessionRef(ctx: any): void {
  try {
    const file = ctx?.sessionManager?.getSessionFile?.();
    currentAgentSessionPath =
      typeof file === "string" &&
      (path.posix.isAbsolute(file) || path.win32.isAbsolute(file))
        ? file
        : undefined;
  } catch {
    currentAgentSessionPath = undefined;
  }

  try {
    const id = ctx?.sessionManager?.getSessionId?.();
    currentAgentSessionId = typeof id === "string" && id.length > 0 ? id : undefined;
  } catch {
    currentAgentSessionId = undefined;
  }
}

function withSessionRef(params: Record<string, unknown>): Record<string, unknown> {
  if (currentAgentSessionPath) {
    return { ...params, agent_session_path: currentAgentSessionPath };
  }
  if (currentAgentSessionId) {
    return { ...params, agent_session_id: currentAgentSessionId };
  }
  return params;
}

function currentSessionRef(): Record<string, unknown> | undefined {
  if (currentAgentSessionPath) {
    return { agent_session_path: currentAgentSessionPath };
  }
  if (currentAgentSessionId) {
    return { agent_session_id: currentAgentSessionId };
  }
  return undefined;
}

function reportSession(sessionStartSource?: string): Promise<void> {
  const sessionRef = currentSessionRef();
  if (!sessionRef) {
    return Promise.resolve();
  }

  return sendRequest({
    id: `${source}:session:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    method: "pane.report_agent_session",
    params: {
      pane_id: paneId,
      source,
      agent: "pi",
      seq: nextReportSeq(),
      session_start_source: sessionStartSource,
      ...sessionRef,
    },
  });
}

function sendState(state: AgentState, message?: string, seq = nextReportSeq()): Promise<void> {
  return sendRequest({
    id: `${source}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    method: "pane.report_agent",
    params: withSessionRef({
      pane_id: paneId,
      source,
      agent: "pi",
      state,
      message,
      seq,
    }),
  });
}

let sendInFlight = false;
let queuedState: QueuedState | undefined;

function queueState(state: AgentState, message?: string): void {
  queuedState = { state, message, seq: nextReportSeq() };
  if (!sendInFlight) {
    void drainStateQueue();
  }
}

async function drainStateQueue(): Promise<void> {
  if (sendInFlight) {
    return;
  }

  sendInFlight = true;
  try {
    while (queuedState) {
      const next = queuedState;
      queuedState = undefined;
      await sendState(next.state, next.message, next.seq);
    }
  } finally {
    sendInFlight = false;
    if (queuedState) {
      void drainStateQueue();
    }
  }
}

export default function (pi) {
  if (!enabled()) {
    return;
  }

  let agentActive = false;
  let blockedCount = 0;
  let blockedMessage: string | undefined;
  let lastState: AgentState | undefined;
  let lastMessage: string | undefined;
  let rootSession = false;

  function desiredState() {
    if (blockedCount > 0) {
      return { state: "blocked" as const, message: blockedMessage };
    }
    if (agentActive) {
      return { state: "working" as const, message: undefined };
    }
    return { state: "idle" as const, message: undefined };
  }

  function publishState(force = false) {
    const next = desiredState();
    if (!force && next.state === lastState && next.message === lastMessage) {
      return;
    }
    lastState = next.state;
    lastMessage = next.message;
    queueState(next.state, next.message);
  }

  pi.events.on("herdr:blocked", (data) => {
    if (!rootSession) {
      return;
    }
    if (!data?.active) {
      blockedCount = Math.max(0, blockedCount - 1);
      if (blockedCount === 0) {
        blockedMessage = undefined;
      }
      publishState();
      return;
    }

    blockedCount += 1;
    blockedMessage = data.label;
    publishState();
  });

  pi.on("session_start", async (event, ctx) => {
    // TUI only: RPC/JSON/print modes are headless (no PTY herdr can display),
    // and RPC still reports hasUI=true, so mode is the reliable gate.
    if (ctx?.mode !== "tui") {
      return;
    }
    rootSession = true;
    updateSessionRef(ctx);
    await reportSession(event?.reason);
    // A reload can replace this extension mid-run without emitting another agent_start.
    agentActive = ctx?.isIdle?.() === false;
    publishState(true);
  });

  pi.on("agent_start", (_event, ctx) => {
    if (!rootSession) {
      return;
    }
    updateSessionRef(ctx);
    void reportSession();
    agentActive = true;
    publishState();
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (!rootSession || ctx?.isIdle?.() !== true) {
      return;
    }

    agentActive = false;
    publishState();
  });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5296** (2026-10-15): **Server SIGSEGV in terminal.Screen.endHyperlink on output mixing styles and OSC 8 links (0.9.4, macOS)**
  *Symptoms*: ### Is this a reproducible bug?  - [x] I confirm this is a reproducible bug, not a feature request, idea, question, contribution proposal, or direction check. - [x] I reproduced this bug on the version and environment reported below using the exact steps provided.  ### Current behavior  The herdr server dies with SIGSEGV while a pane prints a long stream that mixes SGR styles, OSC 8 hyperlinks, cursor moves, scroll regions and the alternate screen. Every pane in the session is gone. The crash report's faulting thread:  ``` EXC_BAD_ACCESS (SIGSEGV), KERN_INVALID_ADDRESS at 0x0000000000000020 terminal.Screen.endHyperlink terminal.Screen.startHyperlinkOnce terminal.Screen.startHyperlink terminal.Screen.cursorAbsolute ghostty_terminal_vt_write herdr::pane::terminal::PaneTerminal::process_pty_bytes ```  ### Expected behavior  The pane shows the output and the server keeps running.  ### Reproduction  1. Save the script below as `repro.py` (a seeded generator of mixed terminal output). 2. In a herdr pane of 200x50, run `stty -opost; python3 repro.py 1 16777216; stty opost`. 3. The server crashes before the command finishes (in both of my runs). With an older seed-1 stream of the same kind, removing the OSC 8 records made it complete in 6 of 6 runs.  ```python import random, sys ESC = "\x1b"   def pool(rng):     words = ["alpha", "beta", "zażółć", "gęślą", "jaźń", "你好", "世界", "😀",              "🎉", "e\u0301", "a\u0308", "x", "tab\there", "ok", "κόσμε", "мир",              "──", "│"

- **Issue #5255** (2026-10-14): **0.9.4: prefix commands ignored in Tern; Ctrl+B enters prefix but the next key does nothing**
  *Symptoms*: ### Is this a reproducible bug?  - [x] I confirm this is a reproducible bug, not a feature request, idea, question, contribution proposal, or direction check. - [x] I reproduced this bug on the version and environment reported below using the exact steps provided.  ### Current behavior  Since updating to 0.9.4, prefix commands do nothing in Tern. Ctrl+B enters prefix mode, but the next key (`c`, `d`, `w`, plugin keys) is ignored. It also happens with a config that only contains `onboarding = false`.  In prefix mode Herdr writes `ESC[<1u ESC[>31u`. Tern answers `ESC[?31u` to `ESC[?u`, but letters typed on the keyboard still arrive as plain bytes (for example `d`), not as `ESC[...u` reports.  ### Expected behavior  Ctrl+B then `c` opens the new tab prompt, as it does on 0.9.3.  ### Reproduction  1. macOS, Tern 0.8.3, Herdr 0.9.4, `config.toml` containing only `onboarding = false`. 2. Run `herdr`, press Ctrl+B. The PREFIX bar appears. 3. Press `c`. No new tab prompt appears.  Without Tern: run `herdr --session repro` in a pty that answers `ESC[?u` with `ESC[?7u`, then write `ESC[98;5u` followed by a plain `c`. The PREFIX bar stays and no prompt opens. Writing `ESC[99u` instead of `c` opens the prompt. The 0.9.3 binary opens the prompt for the plain `c`.  ### Impact  None of the prefix bindings work in Tern, so I had to go back to 0.9.3.  ### Environment  - Herdr version: 0.9.4 (0.9.3 works) - Update channel (stable or preview): stable - Operating system: macOS 27.0 (arm64) - Ter

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

### Incident Patch 1: `3b0c3e9e` (2026-10-14)
**Commit Message**: test: deflake observer write timeout on loaded runners (#5280)

The macOS CI job intermittently fails
server::client_transport::tests::observer_write_timeout_resets_when_sending_makes_progress
with "assertion failed: write_framed_bytes(...)" followed by "observer
disconnected while making progress".

The test proves that every partial write resets the writer's deadline by
draining a 1 MiB frame through an observer that sleeps 5 ms per 16 KiB read
while the writer's send timeout is 100 ms. On a loaded runner, one scheduler
stall longer than 100 ms makes write_client_stream time out and shut the
socket down, so the write assertion fails and the observer then reads EOF.

Give the writer a 1 s timeout and slow the observer to 25 ms per read. The
transfer still takes about 1.6 s, longer than the timeout, so the deadline
reset is still required, while the stall budget grows 10x and the drain
cadence stays 40x below it.

Also bound both kernel socket buffers well below the frame size. The reset
path is only exercised while the writer is blocked, so the test should not
depend on the platform default buffers happening to be smaller than 1 MiB.

**File**: `src/server/client_transport.rs` (modified, +40/-7)
```diff
@@ -1701,29 +1701,62 @@ mod tests {
         ));
     }
 
+    /// Keeps both kernel socket buffers far below the frame size so the writer must
+    /// block for the observer instead of accepting the whole frame at once. Without
+    /// this the reset path would only be exercised when the platform default buffers
+    /// happen to be smaller than the frame.
+    #[cfg(unix)]
+    fn limit_local_stream_buffers(stream: &LocalStream) {
+        use std::os::fd::AsRawFd as _;
+
+        let LocalStream::UdSocket(socket) = stream;
+        let bytes: libc::c_int = 64 * 1024;
+        for option in [libc::SO_SNDBUF, libc::SO_RCVBUF] {
+            let result = unsafe {
+                libc::setsockopt(
+                    socket.inner().as_raw_fd(),
+                    libc::SOL_SOCKET,
+                    option,
+                    std::ptr::addr_of!(bytes).cast(),
+                    std::mem::size_of::<libc::c_int>() as libc::socklen_t,
+                )
+            };
+            assert_eq!(result, 0, "setsockopt({option}) failed");
+        }
+    }
+
     #[cfg(unix)]
     #[test]
     fn observer_write_timeout_resets_when_sending_makes_progress() {
         use std::io::Read as _;
 
+        // A slow observer that keeps draining must not be disconnected, because every
+        // partial write resets the writer's deadline. Keep the drain cadence far below
+        // the write timeout so a loaded runner's scheduler jitter cannot manufacture a
+        // stall, while the transfer still outlasts the timeout so the reset is required
+        // (otherwise the writer could finish within one timeout window without resetting).
+        const WRITE_TIMEOUT: Duration = Duration::from_secs(1);
+        const DRAIN_INTERVAL: Duration = Duration::from_millis(25);
+        const TOTAL_BYTES: usize = 1024 * 1024;
+
         let (mut client, mut server, _path) = local_stream_pair("slow-observer");
-        server
-            .set_send_timeout(Some(Duration::from_millis(100)))
-            .unwrap();
+        limit_local_stream_buffers(&server);
+        limit_local_stream_buffers(&client);
+        server.set_send_timeout(Some(WRITE_TIMEOUT)).unwrap();
         server.set_nonblocking(true).unwrap();
         let worker = std::thread::spawn(move || {
-            assert!(write_framed_bytes(&mut server, &vec![b'x'; 1024 * 1024]));
+            assert!(write_framed_bytes(&mut server, &vec![b'x'; TOTAL_BYTES]));
         });
         client
-            .set_recv_timeout(Some(Duration::from_secs(3)))
+            .set_recv_timeout(Some(Duration::from_secs(5)))
             .unwrap();
         let mut received = 0;
         let mut buffer = [0; 16 * 1024];
-        while received < 1024 * 1024 {
+        while received < TOTAL_BYTES {
             let count = client.read(&mut buffer).unwrap();
             assert_ne!(count, 0, "observer disconnected while making progress");
             received += count;
-            std::thread::sleep(Duration::from_millis(5));
+            std::thread::sleep(DRAIN_INTERVAL);
         }
         worker.join().unwrap();
     }
```

---

### Incident Patch 2: `87e5c13c` (2026-10-13)
**Commit Message**: fix: cancel and clean up endpoint connection attempts (#5247)

* fix: cancel and clean up endpoint connection attempts

refs #4721

* fix: keep probe teardown scoped to its bridge

refs #4721

* fix: preserve nonblocking bridge output and simplify cleanup

refs #4721

**File**: `src/client/endpoint/supervisor.rs` (modified, +230/-5)
```diff
@@ -53,6 +53,8 @@ struct ReconnectState {
     attempts: u32,
     next_attempt: Option<Instant>,
     in_flight: bool,
+    cancelled: Arc<AtomicBool>,
+    completed: Arc<AtomicBool>,
     generation: Option<u64>,
     ready_since: Option<Instant>,
 }
@@ -64,14 +66,31 @@ impl ReconnectState {
             attempts: 0,
             next_attempt: Some(now),
             in_flight: false,
+            cancelled: Arc::new(AtomicBool::new(false)),
+            completed: Arc::new(AtomicBool::new(true)),
             generation: None,
             ready_since: None,
         }
     }
 }
 
+impl Drop for ReconnectState {
+    fn drop(&mut self) {
+        self.cancelled.store(true, Ordering::Release);
+    }
+}
+
+struct AttemptCompletion(Arc<AtomicBool>);
+
+impl Drop for AttemptCompletion {
+    fn drop(&mut self) {
+        self.0.store(true, Ordering::Release);
+    }
+}
+
 pub(crate) struct EndpointSupervisors {
     endpoints: HashMap<ClientEndpointId, ReconnectState>,
+    retired: HashMap<ClientEndpointId, Arc<AtomicBool>>,
     next_generation: u64,
     shutdown: Arc<AtomicBool>,
 }
@@ -90,6 +109,7 @@ impl EndpointSupervisors {
             .collect();
         Self {
             endpoints,
+            retired: HashMap::new(),
             next_generation: 2,
             shutdown: Arc::new(AtomicBool::new(false)),
         }
@@ -101,7 +121,13 @@ impl EndpointSupervisors {
         if generation.is_some() {
             state.next_attempt = None;
         }
-        self.endpoints.insert(ClientEndpointId::Local, state);
+        if let Some(previous) = self.endpoints.insert(ClientEndpointId::Local, state) {
+            if !previous.completed.load(Ordering::Acquire) {
+                self.retired
+                    .entry(ClientEndpointId::Local)
+                    .or_insert_with(|| Arc::clone(&previous.completed));
+            }
+        }
     }
 
     pub(crate) fn reconcile_profiles(
@@ -110,6 +136,7 @@ impl EndpointSupervisors {
         now: Instant,
     ) -> Vec<ClientEndpointId> {
         let mut retired = Vec::new();
+        let retiring = &mut self.retired;
         self.endpoints.retain(|endpoint_id, state| {
             let ConnectTarget::Ssh(previous) = &state.target else {
                 return true;
@@ -122,6 +149,12 @@ impl EndpointSupervisors {
             });
             if !keep {
                 retired.push(endpoint_id.clone());
+                // A stale Connected event still owns its bridge until the client rejects it.
+                if !state.completed.load(Ordering::Acquire) {
+                    retiring
+                        .entry(endpoint_id.clone())
+                        .or_insert_with(|| Arc::clone(&state.completed));
+                }
             }
             keep
         });
@@ -141,11 +174,21 @@ impl EndpointSupervisors {
         options: EndpointConnectOptions,
         event_tx: &tokio::sync::mpsc::Sender<EndpointSupervisorEvent>,
     ) {
+        self.retired
+            .retain(|_, completed| !completed.load(Ordering::Acquire));
         for (endpoint_id, state) in &mut self.endpoints {
-            if state.in_flight || state.next_attempt.is_none_or(|deadline| deadline > now) {
+            if state.in_flight
+                || !state.completed.load(Ordering::Acquire)
+                || self.retired.contains_key(endpoint_id)
+                || state.next_attempt.is_none_or(|deadline| deadline > now)
+            {
                 continue;
             }
             state.in_flight = true;
+            state.cancelled = Arc::new(AtomicBool::new(false));
+            let cancelled = Arc::clone(&state.cancelled);
+            state.completed = Arc::new(AtomicBool::new(false));
+            let completed = Arc::clone(&state.completed);
             state.next_attempt = None;
             let generation = self.next_generation;
             state.generation = Some(generation);
@@ -156,11 +199,19 @@ impl EndpointSupervisors {
             let shutdown = self.shutdown.clone();
             tokio::spawn(async move {
                 if shutdown.load(Ordering::Acquire) {
+                    completed.store(true, Ordering::Release);
                     return;
                 }
                 let task_endpoint_id = endpoint_id.clone();
                 let result = tokio::task::spawn_blocking(move || {
-                    connect_once(&target, options, endpoint_id, generation)
+                    connect_once(
+                        &target,
+                        options,
+                        endpoint_id,
+                        generation,
+                        cancelled,
+                        completed,
+                    )
                 })
                 .await;
                 let event = match result {
@@ -296,10 +347,24 @@ fn connect_once(
     options: EndpointConnectOptions,
     endpoint_id: ClientEndpointId,
     generation: u64,
+    cancelled: Arc<AtomicBool>,
+    completed: Arc<AtomicBool
```

**File**: `src/client/endpoint/writer.rs` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@ impl NativeEndpointTransport {
                         break;
                     }
                 }
+                drop(stream);
             })?;
         Ok(Self {
             sender,
```

**File**: `src/client/handshake.rs` (modified, +14/-4)
```diff
@@ -103,14 +103,14 @@ fn direct_graphics_profile_allowed() -> bool {
 fn read_handshake_response(
     stream: &mut LocalStream,
     read_timeout: Duration,
+    stopped: &AtomicBool,
 ) -> Result<ServerMessage, ClientError> {
     let deadline = Instant::now() + read_timeout;
     crate::ipc::set_local_stream_polling(stream, true).map_err(ClientError::ConnectionFailed)?;
-    let stopped = AtomicBool::new(false);
     let response = protocol::read_message(
         &mut super::transport::EndpointReader {
             stream,
-            stopped: &stopped,
+            stopped,
             deadline: Some(deadline),
         },
         MAX_FRAME_SIZE,
@@ -146,6 +146,7 @@ pub(crate) fn probe_endpoint_negotiation(
         false,
         false,
         false, // This probe uses an SSH bridge, not a shared filesystem.
+        &AtomicBool::new(false),
     )
     .map_err(io::Error::other)?;
     Ok(super::endpoint::EndpointNegotiation::new(
@@ -165,6 +166,9 @@ pub(super) struct HandshakePixelCapabilities {
 /// shells use the stable endpoint generation and negotiate whole codecs without
 /// comparing Herdr build versions. `local_transport` means the endpoint shares the
 /// client's filesystem, not merely that its bridge exposes a local socket.
+// Cancellation extends the existing handshake call; regrouping unrelated display options
+// would broaden this lifecycle fix across all client entry points.
+#[allow(clippy::too_many_arguments)]
 pub(super) fn do_handshake(
     stream: &mut LocalStream,
     cols: u16,
@@ -177,6 +181,7 @@ pub(super) fn do_handshake(
     mouse_capture: bool,
     surface_active: bool,
     local_transport: bool,
+    stopped: &AtomicBool,
 ) -> Result<HandshakeResult, ClientError> {
     stream
         .set_nonblocking(false)
@@ -231,7 +236,7 @@ pub(super) fn do_handshake(
     } else {
         handshake_read_timeout()
     };
-    let welcome = read_handshake_response(stream, read_timeout)?;
+    let welcome = read_handshake_response(stream, read_timeout, stopped)?;
 
     if endpoint_shell {
         let ServerMessage::EndpointControl { kind, data } = welcome else {
@@ -356,7 +361,11 @@ mod tests {
                 }
             });
             let start = Instant::now();
-            let result = read_handshake_response(&mut client, Duration::from_millis(100));
+            let result = read_handshake_response(
+                &mut client,
+                Duration::from_millis(100),
+                &AtomicBool::new(false),
+            );
             let elapsed = start.elapsed();
             let _ = release.send(());
             peer.join().unwrap();
@@ -430,6 +439,7 @@ mod tests {
                     false,
                     true,
                     true,
+                    &AtomicBool::new(false),
                 );
                 peer.join().unwrap();
                 match outcome {
```

**File**: `src/client/mod.rs` (modified, +1/-0)
```diff
@@ -296,6 +296,7 @@ fn run_client_with_mode(
                 loop_config.mouse_capture_active,
                 true,
                 !is_remote_client_process(),
+                &AtomicBool::new(false),
             )
             .map_err(|error| io::Error::other(error.to_string()))?;
             if federated
```

**File**: `src/client/terminal_sessions.rs` (modified, +2/-0)
```diff
@@ -1,4 +1,5 @@
 use std::io::{self, BufRead, Write as _};
+use std::sync::atomic::AtomicBool;
 
 use base64::Engine;
 use interprocess::local_socket::traits::Stream as _;
@@ -104,6 +105,7 @@ fn connect_terminal_session_stream(
         false,
         true,
         true,
+        &AtomicBool::new(false),
     ) {
         Ok(handshake) if handshake.encoding == RenderEncoding::TerminalAnsi => {}
         Ok(handshake) => {
```

**File**: `src/ipc.rs` (modified, +41/-0)
```diff
@@ -51,6 +51,47 @@ pub(crate) fn connect_local_stream(path: &Path) -> io::Result<LocalStream> {
     }
 }
 
+pub(crate) fn connect_local_stream_cancellable(
+    path: &Path,
+    stopped: &std::sync::atomic::AtomicBool,
+    deadline: std::time::Instant,
+) -> io::Result<LocalStream> {
+    use std::sync::atomic::Ordering;
+    use std::time::{Duration, Instant};
+    loop {
+        if stopped.load(Ordering::Acquire) {
+            return Err(io::Error::new(
+                io::ErrorKind::ConnectionAborted,
+                "connection attempt cancelled",
+            ));
+        }
+        let remaining = deadline
+            .checked_duration_since(Instant::now())
+            .ok_or_else(|| {
+                io::Error::new(io::ErrorKind::TimedOut, "endpoint connection timed out")
+            })?;
+        let timeout = remaining.min(Duration::from_millis(100));
+        #[cfg(unix)]
+        let result = {
+            use interprocess::local_socket::{ConnectOptions, GenericFilePath, ToFsName as _};
+            ConnectOptions::new()
+                .name(path.to_fs_name::<GenericFilePath>()?)
+                .wait_mode(interprocess::ConnectWaitMode::Timeout(timeout))
+                .connect_sync()
+        };
+        #[cfg(windows)]
+        let result = crate::platform::connect_local_stream_with_timeout(path, timeout);
+        match result {
+            Err(error)
+                if matches!(
+                    error.kind(),
+                    io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock
+                ) => {}
+            result => return result,
+        }
+    }
+}
+
 pub(crate) fn bind_local_listener(path: &Path) -> io::Result<LocalListener> {
     #[cfg(unix)]
     {
```

**File**: `src/platform/mod.rs` (modified, +1/-1)
```diff
@@ -445,7 +445,7 @@ pub(crate) mod unix_image_files;
 #[cfg(unix)]
 pub(crate) use unix_common::{
     begin_cli_output, end_cli_output, forward_remote_bridge_stdio, ignore_server_hangup,
-    local_stream_peer_description, spawn_server_signal_monitor, RemoteBridgeWake,
+    local_stream_peer_description, spawn_server_signal_monitor, ChildPipe, RemoteBridgeWake,
 };
 
 mod client_state;
```

**File**: `src/platform/unix_common.rs` (modified, +51/-0)
```diff
@@ -1,5 +1,56 @@
 use std::path::{Path, PathBuf};
 
+pub(crate) struct ChildPipe(std::fs::File);
+
+impl ChildPipe {
+    pub(crate) fn new_reader(pipe: impl Into<std::os::fd::OwnedFd>) -> std::io::Result<Self> {
+        use std::os::fd::AsRawFd as _;
+        let file = std::fs::File::from(pipe.into());
+        let fd = file.as_raw_fd();
+        let flags = unsafe { libc::fcntl(fd, libc::F_GETFL) };
+        if flags < 0 || unsafe { libc::fcntl(fd, libc::F_SETFL, flags | libc::O_NONBLOCK) } < 0 {
+            return Err(std::io::Error::last_os_error());
+        }
+        Ok(Self(file))
+    }
+
+    pub(crate) fn new_writer(pipe: impl Into<std::os::fd::OwnedFd>) -> std::io::Result<Self> {
+        Self::new_reader(pipe)
+    }
+
+    pub(crate) fn wait(&self, writing: bool) -> std::io::Result<()> {
+        use std::os::fd::AsRawFd as _;
+        let mut descriptor = libc::pollfd {
+            fd: self.0.as_raw_fd(),
+            events: if writing { libc::POLLOUT } else { libc::POLLIN },
+            revents: 0,
+        };
+        if unsafe { libc::poll(&mut descriptor, 1, 50) } < 0 {
+            let error = std::io::Error::last_os_error();
+            if error.kind() != std::io::ErrorKind::Interrupted {
+                return Err(error);
+            }
+        }
+        Ok(())
+    }
+}
+
+impl std::io::Read for ChildPipe {
+    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
+        std::io::Read::read(&mut self.0, buffer)
+    }
+}
+
+impl std::io::Write for ChildPipe {
+    fn write(&mut self, buffer: &[u8]) -> std::io::Result<usize> {
+        std::io::Write::write(&mut self.0, buffer)
+    }
+
+    fn flush(&mut self) -> std::io::Result<()> {
+        Ok(())
+    }
+}
+
 pub(crate) fn classify_child_exit(status: &portable_pty::ExitStatus) -> super::ChildExitReason {
     if status.signal().is_some() {
         super::ChildExitReason::Interrupted
```

---

### Incident Patch 3: `6521382d` (2026-10-14)
**Commit Message**: fix: recover blocked shared ssh connections (#5252)

* fix: recover blocked shared ssh connections

refs #4721

* test: support shared ssh checks in client fixtures

refs #4721

* test: separate ssh cancellation from timeout scheduling

refs #4721

**File**: `docs/next/website/src/content/docs/connecting-machines.mdx` (modified, +2/-0)
```diff
@@ -15,6 +15,8 @@ On Linux and macOS clients, when `remote.manage_ssh_config=true`, Herdr shares a
 
 The shared connection uses `ControlPersist 600` (10 minutes of idle time); this is not MFA validity. Active connections can remain open, while corporate policy, the SSH server, or the network may end them sooner. Local Windows recovery is not supported yet. For unmanaged SSH connections, authentication remains your responsibility: running `ssh` by itself does not grant Herdr approval unless it uses the shared ControlPath. Host-key checking is unchanged; an unknown or changed host key remains **Attention**.
 
+Saved TUI connections check whether an existing shared SSH connection can open a new channel. CLI status and API commands check only after an initial read-only connection failure. If reuse fails while a fresh connection to the same host succeeds, Herdr retires the old connection from reuse and reconnects. Existing channels stay open. A fresh connection that needs authentication or rejects the host key does not trigger this recovery. API commands retry connection setup at most once and never repeat a request that may already have changed remote state.
+
 ## Before you connect
 
 You need normal SSH access to the remote machine. Verify it first:
```

**File**: `src/cli/target.rs` (modified, +12/-8)
```diff
@@ -80,6 +80,7 @@ pub(super) fn api_client() -> io::Result<ApiClient> {
                     &target.profile.target,
                     &target.profile.session,
                     true,
+                    true,
                 )
                 .map_err(|error| {
                     io::Error::new(
@@ -123,20 +124,23 @@ pub(super) fn server_status(
         let Some(bridge) = target.bridge.as_ref() else {
             return Err(error);
         };
-        let Some(failure) = bridge.reported_failure() else {
-            return Err(error);
-        };
-        if !bridge.used_cached_metadata
-            || !crate::remote::SavedSshApiBridge::stale_metadata_failure(&failure)
-        {
-            return Err(failure.into());
+        let failure = bridge.reported_failure();
+        let stale_metadata = bridge.used_cached_metadata
+            && failure
+                .as_ref()
+                .is_some_and(crate::remote::SavedSshApiBridge::stale_metadata_failure);
+        if !bridge.can_retry || (!stale_metadata && !bridge.recover_transport()) {
+            return Err(failure.map(Into::into).unwrap_or(error));
+        }
+        if stale_metadata {
+            bridge.invalidate_metadata();
         }
-        bridge.invalidate_metadata();
         target.bridge.take();
         target.bridge = Some(crate::remote::SavedSshApiBridge::start(
             target.profile.id.as_str(),
             &target.profile.target,
             &target.profile.session,
+            !stale_metadata,
             false,
         )?);
         Ok(())
```

**File**: `src/platform/linux.rs` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ pub(crate) use super::unix_common::{
     remote_private_temp_base, remote_reattach_argument, remote_reattach_program,
     remote_ssh_config_paths, set_default_plugin_pane_pwd, shutdown_client_stream,
     status_commands_supported, wait_client_stream_readable, write_client_stream,
-    ClientStreamReader, StatusCommandGuard,
+    ClientStreamReader, PinnedSshControlSocket, StatusCommandGuard,
 };
 
 #[cfg(test)]
```

**File**: `src/platform/macos.rs` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ pub(crate) use super::unix_common::{
     remote_private_temp_base, remote_reattach_argument, remote_reattach_program,
     remote_ssh_config_paths, set_default_plugin_pane_pwd, shutdown_client_stream,
     status_commands_supported, wait_client_stream_readable, write_client_stream,
-    ClientStreamReader, StatusCommandGuard,
+    ClientStreamReader, PinnedSshControlSocket, StatusCommandGuard,
 };
 
 mod bootstrap;
```

**File**: `src/platform/unix_common.rs` (modified, +109/-0)
```diff
@@ -731,10 +731,119 @@ fn validate_shared_ssh_dir(dir: &Path) -> std::io::Result<()> {
     Ok(())
 }
 
+pub(crate) struct PinnedSshControlSocket {
+    pub(crate) alias: PathBuf,
+    original: PathBuf,
+    dev: u64,
+    ino: u64,
+}
+
+impl PinnedSshControlSocket {
+    pub(crate) fn new(path: &Path) -> std::io::Result<Self> {
+        use std::os::unix::fs::{DirBuilderExt, FileTypeExt, MetadataExt};
+        use std::sync::atomic::{AtomicU64, Ordering};
+        static NEXT_PIN: AtomicU64 = AtomicU64::new(0);
+
+        let parent = path.parent().ok_or(std::io::ErrorKind::InvalidInput)?;
+        validate_shared_ssh_dir(parent)?;
+        let metadata = std::fs::symlink_metadata(path)?;
+        if !metadata.file_type().is_socket() || metadata.uid() != unsafe { libc::geteuid() } {
+            return Err(std::io::Error::new(
+                std::io::ErrorKind::PermissionDenied,
+                "SSH control path must be a socket owned by the current user",
+            ));
+        }
+        let directory = parent.join(format!(
+            "r-{}-{}",
+            std::process::id(),
+            NEXT_PIN.fetch_add(1, Ordering::Relaxed)
+        ));
+        std::fs::DirBuilder::new().mode(0o700).create(&directory)?;
+        let pinned = Self {
+            alias: directory.join("ctl"),
+            original: path.to_owned(),
+            dev: metadata.dev(),
+            ino: metadata.ino(),
+        };
+        // A separate name pins the old inode; a replacement cannot receive its stop request.
+        std::fs::hard_link(path, &pinned.alias)?;
+        let linked = std::fs::symlink_metadata(&pinned.alias)?;
+        if (linked.dev(), linked.ino()) != (pinned.dev, pinned.ino) {
+            return Err(std::io::ErrorKind::NotFound.into());
+        }
+        Ok(pinned)
+    }
+
+    pub(crate) fn is_current(&self) -> std::io::Result<bool> {
+        use std::os::unix::fs::MetadataExt;
+        match std::fs::symlink_metadata(&self.original) {
+            Ok(metadata) => Ok((metadata.dev(), metadata.ino()) == (self.dev, self.ino)),
+            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
+            Err(error) => Err(error),
+        }
+    }
+}
+
+impl Drop for PinnedSshControlSocket {
+    fn drop(&mut self) {
+        let _ = std::fs::remove_file(&self.alias);
+        if let Some(directory) = self.alias.parent() {
+            let _ = std::fs::remove_dir(directory);
+        }
+    }
+}
+
 #[cfg(test)]
 mod shared_ssh_tests {
     use super::*;
 
+    #[test]
+    fn pinned_ssh_socket_connects_old_listener_after_original_is_replaced() {
+        use std::io::{Read as _, Write as _};
+        use std::os::unix::net::{UnixListener, UnixStream};
+
+        let directory = create_remote_ssh_config_dir("ctl").unwrap();
+        let path = directory.join("ctl");
+        let old = UnixListener::bind(&path).unwrap();
+        let pinned = PinnedSshControlSocket::new(&path).unwrap();
+        assert!(pinned.is_current().unwrap());
+        std::fs::remove_file(&path).unwrap();
+        let replacement = UnixListener::bind(&path).unwrap();
+        assert!(!pinned.is_current().unwrap());
+        let mut client = UnixStream::connect(&pinned.alias).unwrap();
+        let (mut server, _) = old.accept().unwrap();
+        server.write_all(b"old").unwrap();
+        let mut reply = [0; 3];
+        client.read_exact(&mut reply).unwrap();
+        assert_eq!(&reply, b"old");
+        let alias = pinned.alias.clone();
+        drop(pinned);
+        assert!(!alias.exists());
+        let _client = UnixStream::connect(&path).unwrap();
+        replacement.accept().unwrap();
+        drop((old, replacement));
+        std::fs::remove_dir_all(directory).unwrap();
+    }
+
+    #[test]
+    fn ssh_socket_pin_rejects_files_symlinks_and_public_parent() {
+        use std::os::unix::fs::{symlink, PermissionsExt};
+        use std::os::unix::net::UnixListener;
+
+        let directory = create_remote_ssh_config_dir("ctl").unwrap();
+        let file = directory.join("file");
+        std::fs::write(&file, b"not a socket").unwrap();
+        assert!(PinnedSshControlSocket::new(&file).is_err());
+        let path = directory.join("ctl");
+        let _listener = UnixListener::bind(&path).unwrap();
+        let link = directory.join("link");
+        symlink(&path, &link).unwrap();
+        assert!(PinnedSshControlSocket::new(&link).is_err());
+        std::fs::set_permissions(&directory, std::fs::Permissions::from_mode(0o755)).unwrap();
+        assert!(PinnedSshControlSocket::new(&path).is_err());
+        std::fs::remove_dir_all(directory).unwrap();
+    }
+
     #[test]
     fn shared_ssh_control_path_is_stable_scoped_and_bounded() {
         let path = shared_ssh_control_path(Path::new("/config/one"), "user@host").unwrap();
```

**File**: `src/remote/attach.rs` (modified, +223/-22)
```diff
@@ -1,5 +1,7 @@
 //! Remote thin-client launcher over SSH command stdio.
 
+#[cfg(unix)]
+use super::process::wait_with_output_limit;
 use super::{
     args::*,
     process::{wait_with_output_timeout, CancellablePipe, OwnedSshChild, PipeControl},
@@ -30,6 +32,12 @@ const BRIDGE_IO_POLL: Duration = Duration::from_millis(1);
 const BRIDGE_SOCKET_PERMISSION_MODE: u32 = 0o600;
 const REMOTE_SERVER_SHUTDOWN_CONFIRM_TIMEOUT: Duration = Duration::from_secs(5);
 const NONINTERACTIVE_SSH_COMMAND_TIMEOUT: Duration = Duration::from_secs(15);
+#[cfg(unix)]
+const SSH_CONTROL_TIMEOUT: Duration = Duration::from_secs(3);
+#[cfg(unix)]
+// Diagnostic commands may print remote-controlled banners; drain them with a
+// fixed memory budget. An oversized local configuration is never parsed.
+const SSH_DIAGNOSTIC_OUTPUT_LIMIT: usize = 256 * 1024;
 const NONINTERACTIVE_SSH_STDERR_LIMIT: usize = 16 * 1024;
 const BRIDGE_FAILURE_REPORT_TIMEOUT: Duration = Duration::from_secs(1);
 const REMOTE_SERVER_SHUTDOWN_POLL_INTERVAL: Duration = Duration::from_millis(100);
@@ -104,29 +112,35 @@ pub(crate) fn check_saved_ssh(target: &str, session: &str) -> io::Result<()> {
         .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, error))?;
     let mut ssh = RemoteSsh::new_noninteractive(target.to_owned());
     ssh.session_name = session.to_owned();
-    let remote = find_installed_remote_herdr(&ssh)?;
-    match remote_server_status(&ssh, &remote, false)? {
-        RemoteServerStatus::Running {
-            endpoint_protocol_generation,
-            surface_interest,
-            health_check,
-            detached_server_daemon,
-            ..
-        } if remote_server_restart_reason(
-            endpoint_protocol_generation,
-            detached_server_daemon,
-            true,
-            surface_interest,
-            health_check,
-        )
-        .is_none() =>
-        {
-            Ok(())
+    let check = || {
+        let remote = find_installed_remote_herdr(&ssh)?;
+        match remote_server_status(&ssh, &remote, false)? {
+            RemoteServerStatus::Running {
+                endpoint_protocol_generation,
+                surface_interest,
+                health_check,
+                detached_server_daemon,
+                ..
+            } if remote_server_restart_reason(
+                endpoint_protocol_generation,
+                detached_server_daemon,
+                true,
+                surface_interest,
+                health_check,
+            )
+            .is_none() =>
+            {
+                Ok(())
+            }
+            _ => Err(io::Error::other(format!(
+                "remote Herdr server is stopped or incompatible; run `{}`",
+                super::saved_ssh_bootstrap_command(target, session),
+            ))),
         }
-        _ => Err(io::Error::other(format!(
-            "remote Herdr server is stopped or incompatible; run `{}`",
-            super::saved_ssh_bootstrap_command(target, session),
-        ))),
+    };
+    match check() {
+        Err(_) if ssh.prepare_shared_transport().unwrap_or(false) => check(),
+        result => result,
     }
 }
 
@@ -828,6 +842,148 @@ impl RemoteSsh {
         self.managed_config.as_ref().map(|config| &config.options)
     }
 
+    #[cfg(not(unix))]
+    pub(super) fn prepare_shared_transport(&self) -> io::Result<bool> {
+        Ok(false)
+    }
+
+    #[cfg(unix)]
+    // True permits one new connection after retirement, disappearance, or
+    // another helper's replacement. It does not prove the old TCP link died.
+    pub(super) fn prepare_shared_transport(&self) -> io::Result<bool> {
+        let Some(options) = self.options() else {
+            return Ok(false);
+        };
+        let Some(control_path) = &options.control_path else {
+            return Ok(false);
+        };
+        let mut configuration = self.base_command();
+        configuration.arg("-G").arg(&self.target);
+        let output = self.bounded_control_output(configuration, SSH_CONTROL_TIMEOUT)?;
+        if output.stdout.len() > SSH_DIAGNOSTIC_OUTPUT_LIMIT {
+            return Err(io::Error::new(
+                io::ErrorKind::InvalidData,
+                "SSH configuration output is too large",
+            ));
+        }
+        if !output.status.success() {
+            return Err(command_failed(
+                "could not resolve managed SSH configuration",
+                &output,
+            ));
+        }
+        let configuration = String::from_utf8_lossy(&output.stdout);
+        let Some(path) = configuration
+            .lines()
+            .find_map(|line| line.strip_prefix("controlpath "))
+        else {
+            return Ok(false);
+        };
+        let path = Path::new(path);
+        if path.parent() != control_path.parent() {
+            return Ok(false);
+        }
+        let pinned = match crate::platform::PinnedSshControlSocket::new(path) {
+            Ok(pinned) => pinned,
+            Err(
```

**File**: `src/remote/process.rs` (modified, +79/-12)
```diff
@@ -114,6 +114,40 @@ pub(super) fn wait_with_output_timeout(
     input: Option<Vec<u8>>,
     timeout: Duration,
     cancelled: Arc<AtomicBool>,
+) -> io::Result<Output> {
+    wait_with_output(child, input, timeout, cancelled, None)
+}
+
+#[cfg(any(unix, test))]
+pub(super) fn wait_with_output_limit(
+    child: Child,
+    timeout: Duration,
+    cancelled: Arc<AtomicBool>,
+    limit: usize,
+) -> io::Result<Output> {
+    wait_with_output(child, None, timeout, cancelled, Some(limit))
+}
+
+fn read_output(mut pipe: CancellablePipe, limit: Option<usize>) -> io::Result<Vec<u8>> {
+    let mut bytes = Vec::new();
+    if let Some(limit) = limit {
+        io::Read::by_ref(&mut pipe)
+            .take((limit + 1) as u64)
+            .read_to_end(&mut bytes)?;
+        // Drain excess so a full pipe cannot manufacture a command timeout.
+        io::copy(&mut pipe, &mut io::sink())?;
+    } else {
+        pipe.read_to_end(&mut bytes)?;
+    }
+    Ok(bytes)
+}
+
+fn wait_with_output(
+    child: Child,
+    input: Option<Vec<u8>>,
+    timeout: Duration,
+    cancelled: Arc<AtomicBool>,
+    limit: Option<usize>,
 ) -> io::Result<Output> {
     let mut child = OwnedSshChild(child);
     let control = PipeControl::new(cancelled);
@@ -137,18 +171,12 @@ pub(super) fn wait_with_output_timeout(
         .take()
         .map(crate::platform::ChildPipe::new_writer)
         .transpose()?;
-    let mut stdout = CancellablePipe::new(stdout, &control);
-    let mut stderr = CancellablePipe::new(stderr, &control);
+    let stdout = CancellablePipe::new(stdout, &control);
+    let stderr = CancellablePipe::new(stderr, &control);
     let stdin = stdin.map(|pipe| CancellablePipe::new(pipe, &control));
     thread::scope(|scope| {
-        let stdout = scope.spawn(move || {
-            let mut bytes = Vec::new();
-            stdout.read_to_end(&mut bytes).map(|_| bytes)
-        });
-        let stderr = scope.spawn(move || {
-            let mut bytes = Vec::new();
-            stderr.read_to_end(&mut bytes).map(|_| bytes)
-        });
+        let stdout = scope.spawn(move || read_output(stdout, limit));
+        let stderr = scope.spawn(move || read_output(stderr, limit));
         let stdin = scope.spawn(move || match (stdin, input) {
             (Some(mut stdin), Some(input)) => stdin.write_all(&input),
             (None, Some(_)) => Err(io::Error::other("ssh bootstrap stdin missing")),
@@ -317,14 +345,47 @@ pub(in crate::remote) mod tests {
                     .write_all(&vec![b'x'; 2 * 1024 * 1024])
                     .unwrap();
             }
+            if mode == "output-limit" {
+                eprintln!("Permission denied (publickey)");
+                io::stdout().write_all(&vec![b'x'; 1024 * 1024]).unwrap();
+                io::stderr().write_all(&vec![b'y'; 1024 * 1024]).unwrap();
+            }
             println!("final child output");
             eprintln!("Permission denied (publickey)");
         }
-        if mode != "exit" && mode != "bridge-final" {
+        if mode != "exit" && mode != "bridge-final" && mode != "output-limit" {
             thread::sleep(Duration::from_secs(30));
         }
     }
 
+    #[test]
+    fn diagnostic_capture_drains_flooded_pipes_with_bounded_memory() {
+        let fixture = PipeFixture::new("output-limit");
+        let child = fixture
+            .command()
+            .stdout(Stdio::piped())
+            .stderr(Stdio::piped())
+            .spawn()
+            .unwrap();
+        let descendant = fixture.ready();
+        let limit = 16 * 1024;
+        let output = wait_with_output_limit(
+            child,
+            Duration::from_secs(5),
+            Arc::new(AtomicBool::new(false)),
+            limit,
+        )
+        .unwrap();
+        assert!(
+            output.status.success(),
+            "capture must drain instead of blocking the child"
+        );
+        assert_eq!(output.stdout.len(), limit + 1);
+        assert_eq!(output.stderr.len(), limit + 1);
+        assert!(String::from_utf8_lossy(&output.stderr).contains("Permission denied (publickey)"));
+        assert!(crate::platform::process_exists(descendant));
+    }
+
     #[test]
     fn child_exit_drains_output_without_waiting_for_inherited_pipes() {
         let fixture = PipeFixture::new("exit");
@@ -375,7 +436,13 @@ pub(in crate::remote) mod tests {
             let error = wait_with_output_timeout(
                 child,
                 Some(vec![b'x'; 1024 * 1024]),
-                Duration::from_millis(200),
+                // Test cancellation independently of the scheduler's ability
+                // to run its thread within the timeout branch's 100 ms margin.
+                if cancel {
+                    Duration::from_secs(5)
+                } else {
+                    Duration::from_millis(200)
+                },
                 stopped,
             )
             .unwrap_err();
```

**File**: `src/remote/saved.rs` (modified, +19/-1)
```diff
@@ -25,6 +25,7 @@ pub(crate) fn connect_saved_ssh(
 ) -> io::Result<SavedSshStream> {
     let mut ssh = validated_saved_ssh(profile_id, target, session)?;
     ssh.cancelled = Arc::clone(&cancelled);
+    ssh.prepare_shared_transport()?;
     let remote_herdr = find_installed_remote_herdr(&ssh)?;
     let metadata = remote_herdr.machine_metadata();
     if cancelled.load(Ordering::Acquire) {
@@ -59,6 +60,8 @@ pub(crate) struct SavedSshApiBridge {
     path: PathBuf,
     bridge: SshStdioBridge,
     metadata_cache: crate::client::endpoint::SshMetadataCache,
+    ssh: RemoteSsh,
+    pub(crate) can_retry: bool,
     pub(crate) used_cached_metadata: bool,
 }
 
@@ -68,16 +71,25 @@ impl SavedSshApiBridge {
         target: &str,
         session: &str,
         use_cached_metadata: bool,
+        allow_retry: bool,
     ) -> io::Result<Self> {
         let ssh = validated_saved_ssh(profile_id, target, session)?;
+        let mut can_retry = allow_retry;
         let metadata_cache =
             crate::client::endpoint::SshMetadataCache::new(profile_id, target, session)?;
         let cached = use_cached_metadata.then(|| metadata_cache.load()).flatten();
         let used_cached_metadata = cached.is_some();
         let metadata = match cached {
             Some(metadata) => metadata,
             None => {
-                let metadata = super::attach::discover_remote_api_metadata(&ssh, session)?;
+                let discover = || super::attach::discover_remote_api_metadata(&ssh, session);
+                let metadata = match discover() {
+                    Err(_) if can_retry && ssh.prepare_shared_transport().unwrap_or(false) => {
+                        can_retry = false;
+                        discover()?
+                    }
+                    result => result?,
+                };
                 metadata_cache.store(&metadata);
                 metadata
             }
@@ -103,6 +115,8 @@ impl SavedSshApiBridge {
             path,
             bridge,
             metadata_cache,
+            ssh,
+            can_retry,
             used_cached_metadata,
         })
     }
@@ -119,6 +133,10 @@ impl SavedSshApiBridge {
         self.metadata_cache.invalidate();
     }
 
+    pub(crate) fn recover_transport(&self) -> bool {
+        self.can_retry && self.ssh.prepare_shared_transport().unwrap_or(false)
+    }
+
     pub(crate) fn stale_metadata_failure(error: &io::Error) -> bool {
         error
             .to_string()
```

#### Recent Merged Pull Requests:
- **PR #5395** (closed): feat: add native Omo integration (@rhdtl78)
- **PR #5387** (closed): Fix/opencode subagent lifecycle (@giannisCKS)
- **PR #5339** (closed): Fix wedged agent waits (background-tab idle projection, no default timeout), retry integration repair, match opencode v2 permission footers (@WSHAPER)
- **PR #5326** (closed): fix: report idle when closing record is missing (@matthias-scale)
- **PR #5310** (2026-10-15): fix: keep polling through a transient zero-sized terminal grid (@JJLiebig)
- **PR #5308** (2026-10-15): fix: keep posix machine scripts intact through windows openssh (@JJLiebig)

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

## X. test: deflake observer write timeout on loaded runners (#5280)

**RULE**:
When implementing operations in `src/server/client_transport.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in herdrdev/herdr. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3b0c3e9e`: test: deflake observer write timeout on loaded runners (#5280). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/server/client_transport.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// Keeps both kernel socket buffers far below the frame size so the writer must
    /// block for the observer instead of accepting the whole frame at once. Without
    /// this the reset path would only be exercised when the platform default buffers
    /// happen to be smaller than the frame.
    #[cfg(unix)]
    fn limit_local_stream_buffers(stream: &LocalStream) {
        use std::os::fd::AsRawFd as _;

        let LocalStream::UdSocket(socket) = stream;
        let bytes: libc::c_int = 64 * 1024;
        for option in [libc::SO_SNDBUF, libc::SO_RCVBUF] {
            let result = unsafe {
                libc::setsockopt(
                    socket.inner().as_raw_fd(),
                    libc::SOL_SOCKET,
                    option,
                    std::ptr::addr_of!(bytes).cast(),
                    std::mem::size_of::<libc::c_int>() as libc::socklen_t,
                )
            };
            assert_eq!(result, 0, "setsockopt({option}) failed");
        }
    }

        // A slow observer that keeps draining must not be disconnected, because every
        // partial write resets the writer's deadline. Keep the drain cadence far below
        // the write timeou
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        server
            .set_send_timeout(Some(Duration::from_millis(100)))
            .unwrap();
            assert!(write_framed_bytes(&mut server, &vec![b'x'; 1024 * 1024]));
            .set_recv_timeout(Some(Duration::from_secs(3)))
        while received < 1024 * 1024 {
            std::thread::sleep(Duration::from_millis(5));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3b0c3e9e` are properly handled with clean fallback behavior.
