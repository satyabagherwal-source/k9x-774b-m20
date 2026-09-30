# Forensic Learning Record (Deep Inspection): shanraisshan/claude-code-best-practice

> **Canonical Artifact**: `07_PROJECT_LEARNING/shanraisshan-claude-code-best-practice-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:04:00.346Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `shanraisshan/claude-code-best-practice`
- **Description**: from vibe coding to agentic engineering - practice makes claude perfect
- **Primary Language / Ecosystem**: HTML
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 66842 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/hooks/scripts/hooks.py`
```
#!/usr/bin/env python3
"""
Claude Code Hook Handler
=============================================
This script handles events from Claude Code and plays sounds for different hook events.
Supports all 30 Claude Code hooks: https://code.claude.com/docs/en/hooks

Special handling for git commits: plays pretooluse-git-committing.mp3

Agent Support:
  Use --agent=<name> to play agent-specific sounds from agent_* folders.
  Agent frontmatter hooks support 6 hooks: PreToolUse, PostToolUse, PermissionRequest, PostToolUseFailure, Stop, SubagentStop
"""

import sys
import json
import subprocess
import re
import platform
import argparse
from pathlib import Path

# Windows-only module for playing WAV files
try:
    import winsound
except ImportError:
    winsound = None

# ===== HOOK EVENT TO SOUND FOLDER MAPPING =====
# Maps each hook event to its corresponding sound folder
HOOK_SOUND_MAP = {
    "PreToolUse": "pretooluse",
    "PermissionRequest": "permissionrequest",
    "PostToolUse": "posttooluse",
    "PostToolUseFailure": "posttoolusefailure",
    "PostToolBatch": "posttoolbatch",
    "UserPromptSubmit": "userpromptsubmit",
    "UserPromptExpansion": "userpromptexpansion",
    "Notification": "notification",
    "MessageDisplay": "messagedisplay",
    "Stop": "stop",
    "SubagentStart": "subagentstart",
    "SubagentStop": "subagentstop",
    "PreCompact": "precompact",
    "PostCompact": "postcompact",
    "SessionStart": "sessionstart",
    "SessionEnd": "sessionend",
    "Setup": "setup",
    "TeammateIdle": "teammateidle",
    "TaskCreated": "taskcreated",
    "TaskCompleted": "taskcompleted",
    "ConfigChange": "configchange",
    "WorktreeCreate": "worktreecreate",
    "WorktreeRemove": "worktreeremove",
    "InstructionsLoaded": "instructionsloaded",
    "Elicitation": "elicitation",
    "ElicitationResult": "elicitationresult",
    "StopFailure": "stopfailure",
    "CwdChanged": "cwdchanged",
    "FileChanged": "filechanged",
    "PermissionDenied": "permissiondenied"
}

# ===== AGENT HOOK EVENT TO SOUND FOLDER MAPPING =====
# Maps agent hook events to agent-specific sound folders
# Only the 6 hooks that actually fire in agent contexts are mapped
AGENT_HOOK_SOUND_MAP = {
    "PreToolUse": "agent_pretooluse",
    "PostToolUse": "agent_posttooluse",
    "PermissionRequest": "agent_permissionrequest",
    "PostToolUseFailure": "agent_posttoolusefailure",
    "Stop": "agent_stop",
    "SubagentStop": "agent_subagentstop"
}

# ===== BASH COMMAND PATTERNS =====
# Regex patterns to detect specific bash commands and map to special sounds
BASH_PATTERNS = [
    (r'git commit', "pretooluse-git-committing"),  # Git commits (anywhere in command)
]

def get_audio_player():
    """
    Detect the appropriate audio player for the current platform.

    Returns:
        List of command and args to use for playing audio, or None if no player found
    """
    system = platform.system()

    if system == "Darwin":
        # macOS: use afplay (built-in)
        return ["afplay"]
    elif system == "Linux":
        # Linux: try different players in order of preference
        # Try to find an available player
        players = [
            ["paplay"],           # PulseAudio (most common on modern Linux)
            ["aplay"],            # ALSA (fallback)
            ["ffplay", "-nodisp", "-autoexit"],  # FFmpeg (if installed)
            ["mpg123", "-q"],     # mpg123 (if installed)
        ]

        for player in players:
            try:
                # Check if the player exists
                subprocess.run(
                    ["which", player[0]],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=True
                )
                return player
            except (subprocess.CalledProcessError, FileNotFoundError):
                continue

        # No player found
        return None
    elif system == "Windows":
        # Windows: Use winsound for WAV, PowerShell for MP3
        return ["WINDOWS"]
    else:
        # Other OS - not supported yet
        return None


def play_sound(sound_name):
    """
    Play a sound file for the given sound name.

    Args:
        sound_name: Name of the sound file (e.g., "pretooluse", "pretooluse-git-committing")
                   The file should be at .claude/hooks/sounds/{folder}/{sound_name}.{mp3|wav}

    Returns:
        True if sound played successfully, False otherwise
    """
    # Security check: Prevent directory traversal attacks
    if "/" in sound_name or "\\" in sound_name or ".." in sound_name:
        print(f"Invalid sound name: {sound_name}", file=sys.stderr)
        return False

    # Get the appropriate audio player for this platform
    audio_player = get_audio_player()
    if not audio_player:
        # No audio player available - fail silently
        return False

    # Build the path to the sound folder
    # Scripts are in .claude/hooks/scripts/, sounds are in .claude/hooks/sounds/
    script_dir = Path(__file__).parent  # .claude/hooks/scripts/
    hooks_dir = script_dir.parent  # .claude/hooks/

    # Determine the folder based on the sound name prefix
    # For special sounds like "pretooluse-git-committing", look in "pretooluse" folder
    folder_name = sound_name.split('-')[0]
    sounds_dir = hooks_dir / "sounds" / folder_name

    # Check if we're on Windows and need special handling
    is_windows = audio_player[0] == "WINDOWS"

    # Try different audio formats
    # Note: paplay (PulseAudio) doesn't support MP3, so try WAV first
    # On Windows, only use WAV files to avoid PowerShell/COM issues
    extensions = ['.wav'] if is_windows else ['.wav', '.mp3']

    for extension in extensions:
        file_path = sounds_dir / f"{sound_name}{extension}"

        if file_path.exists():
            try:
                if is_windows:
                    # Windows: Use winsound for WAV files (built-in, reliable, fast)
                    if winsound:
                        # SND_FILENAME: file_path is a filename
                        # SND_SYNC: play sound synchronously (wait until complete)
                        # SND_NODEFAULT: don't play default sound if file not found
                        # Note: Using SND_SYNC instead of SND_ASYNC because the script exits immediately
                        # after this call, which would terminate async playback before it completes
                        winsound.PlaySound(str(file_path),
                                         winsound.SND_FILENAME | winsound.SND_SYNC | winsound.SND_NODEFAULT)
                        return True
                    else:
                        # winsound not available, fail silently
                        return False
                else:
                    # Unix/Linux/macOS: use subprocess with audio player
                    subprocess.Popen(
                        audio_player + [str(file_path)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        start_new_session=True
                    )
                    return True
            except (FileNotFoundError, OSError) as e:
                print(f"Error playing sound {file_path.name}: {e}", file=sys.stderr)
                return False
            except Exception as e:
                # Catch any other exceptions (e.g., winsound errors)
                print(f"Error playing sound {file_path.name}: {e}", file=sys.stderr)
                return False

    # Sound not found - fail silently to avoid disrupting Claude's work
    return False

def is_hook_disabled(event_name):
    """
    Check if a specific hook is disabled in the config files.
    Uses fallback logic: hooks-config.local.json -> hooks-config.json

    Priority:
    1. If hooks-config.local.json exists and has the setting, use it
    2. Otherwise, fall back to hooks-config.json
    3. If neither exists or the key is missing, assume ho
```

### Core Architecture Module: `.codex/hooks/scripts/hooks.py`
```
#!/usr/bin/env python3
"""
Codex CLI Hook Handler
=============================================
This script handles hooks from Codex CLI and plays sounds.
Codex CLI supports 8 hooks:
  1. SessionStart - via hooks.json (v0.114.0+)
  2. PreToolUse - via hooks.json (v0.117.0+)
  3. PermissionRequest - via hooks.json (v0.122.0+)
  4. PostToolUse - via hooks.json (v0.117.0+)
  5. Stop - via hooks.json (v0.114.0+)
  6. UserPromptSubmit - via hooks.json (v0.116.0+)
  7. PreCompact - via hooks.json (v0.130.0+)
  8. PostCompact - via hooks.json (v0.130.0+)

Input:
  - All hooks use --hook <hook-name> flag via hooks.json
"""

import sys
import json
import subprocess
import platform
from pathlib import Path
from datetime import datetime

# Windows-only module for playing WAV files
try:
    import winsound
except ImportError:
    winsound = None

# ===== HOOK EVENT TO SOUND MAPPING =====
# Sound name -> resolves to sounds/<name>/<name>.{mp3|wav}
HOOK_SOUND_MAP = {
    "SessionStart": "SessionStart",
    "PreToolUse": "PreToolUse",
    "PermissionRequest": "PermissionRequest",
    "PostToolUse": "PostToolUse",
    "Stop": "Stop",
    "UserPromptSubmit": "UserPromptSubmit",
    "PreCompact": "PreCompact",
    "PostCompact": "PostCompact",
}

# ===== HOOK EVENT TO CONFIG KEY MAPPING =====
HOOK_CONFIG_MAP = {
    "SessionStart": "disableSessionStartHook",
    "PreToolUse": "disablePreToolUseHook",
    "PermissionRequest": "disablePermissionRequestHook",
    "PostToolUse": "disablePostToolUseHook",
    "Stop": "disableStopHook",
    "UserPromptSubmit": "disableUserPromptSubmitHook",
    "PreCompact": "disablePreCompactHook",
    "PostCompact": "disablePostCompactHook",
}



def get_audio_player():
    """
    Detect the appropriate audio player for the current platform.

    Returns:
        List of command and args to use for playing audio, or None if no player found
    """
    system = platform.system()

    if system == "Darwin":
        # macOS: use afplay (built-in)
        return ["afplay"]
    elif system == "Linux":
        # Linux: try different players in order of preference
        players = [
            ["paplay"],           # PulseAudio (most common on modern Linux)
            ["aplay"],            # ALSA (fallback)
            ["ffplay", "-nodisp", "-autoexit"],  # FFmpeg (if installed)
            ["mpg123", "-q"],     # mpg123 (if installed)
        ]

        for player in players:
            try:
                subprocess.run(
                    ["which", player[0]],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=True
                )
                return player
            except (subprocess.CalledProcessError, FileNotFoundError):
                continue

        return None
    elif system == "Windows":
        # Windows: Use winsound for WAV files (built-in, reliable)
        return ["WINDOWS"]
    else:
        return None


def play_sound(sound_name):
    """
    Play a sound file for the given sound name.

    Args:
        sound_name: Name of the sound file (e.g., "SessionStart")
                   The file should be at .codex/hooks/sounds/{name}/{name}.{mp3|wav}

    Returns:
        True if sound played successfully, False otherwise
    """
    # Security check: Prevent directory traversal attacks
    if "/" in sound_name or "\\" in sound_name or ".." in sound_name:
        print(f"Invalid sound name: {sound_name}", file=sys.stderr)
        return False

    audio_player = get_audio_player()
    if not audio_player:
        return False

    # Build path: scripts/ -> hooks/ -> sounds/{folder}/
    script_dir = Path(__file__).parent  # .codex/hooks/scripts/
    hooks_dir = script_dir.parent       # .codex/hooks/

    # Sound folder matches sound name: sounds/<name>/<name>.{mp3|wav}
    sounds_dir = hooks_dir / "sounds" / sound_name

    is_windows = audio_player[0] == "WINDOWS"
    extensions = ['.wav'] if is_windows else ['.wav', '.mp3']

    for extension in extensions:
        file_path = sounds_dir / f"{sound_name}{extension}"

        if file_path.exists():
            try:
                if is_windows:
                    if winsound:
                        winsound.PlaySound(str(file_path),
                                         winsound.SND_FILENAME | winsound.SND_NODEFAULT)
                        return True
                    else:
                        return False
                else:
                    subprocess.Popen(
                        audio_player + [str(file_path)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        start_new_session=True
                    )
                    return True
            except (FileNotFoundError, OSError) as e:
                print(f"Error playing sound {file_path.name}: {e}", file=sys.stderr)
                return False
            except Exception as e:
                print(f"Error playing sound {file_path.name}: {e}", file=sys.stderr)
                return False

    return False


def load_config():
    """
    Load the hook configuration from config files.
    Uses fallback logic: hooks-config.local.json -> hooks-config.json

    Returns:
        Tuple of (local_config, default_config) - either may be None
    """
    try:
        script_dir = Path(__file__).parent
        hooks_dir = script_dir.parent
        config_dir = hooks_dir / "config"

        local_config_path = config_dir / "hooks-config.local.json"
        default_config_path = config_dir / "hooks-config.json"

        local_config = None
        if local_config_path.exists():
            try:
                with open(local_config_path, "r", encoding="utf-8") as f:
                    local_config = json.load(f)
            except Exception:
                pass

        default_config = None
        if default_config_path.exists():
            try:
                with open(default_config_path, "r", encoding="utf-8") as f:
                    default_config = json.load(f)
            except Exception:
                pass

        return local_config, default_config
    except Exception:
        return None, None


def get_config_value(key, default=False):
    """
    Get a config value with fallback logic: local -> default -> provided default.

    Args:
        key: The config key to look up
        default: Default value if key not found in any config

    Returns:
        The config value
    """
    local_config, default_config = load_config()

    if local_config is not None and key in local_config:
        return local_config[key]
    elif default_config is not None and key in default_config:
        return default_config[key]
    else:
        return default


def is_hook_disabled(event_name):
    """
    Check if a hook is disabled in the config files.
    Uses fallback logic: hooks-config.local.json -> hooks-config.json

    Args:
        event_name: The event name (e.g., "SessionStart", "Stop", "UserPromptSubmit")

    Returns:
        True if the hook is disabled, False otherwise
    """
    config_key = HOOK_CONFIG_MAP.get(event_name)
    return get_config_value(config_key, default=False)


def is_logging_disabled():
    """
    Check if logging is disabled in the config files.
    Uses fallback logic: hooks-config.local.json -> hooks-config.json

    Returns:
        True if logging is disabled, False otherwise
    """
    return get_config_value("disableLogging", default=False)


def log_hook_data(hook_data):
    """
    Log the hook_data to hooks-log.jsonl for debugging/auditing.
    Log file is stored at .codex/hooks/logs/hooks-log.jsonl

    Logs 3 keys: hook, timestamp, last_assistant_message
    """
    if is_logging_disabled():
        return

    try:
        log_entry = {
            "hook": hook_data.get("type", ""),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "last_assistant_message"
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #210** (2026-09-02): **Daily settings drift check — 2026-09-01 (Claude Code v2.1.252)**
  *Symptoms*: ## Summary  Settings drift audit for **Claude Code v2.1.252** (28 versions ahead of last run at v2.1.224, Aug 07 2026). Two research agents (workflow-claude-settings-agent + claude-code-guide) ran in parallel against 3 official sources. All 24 verification-checklist rules executed.  **Headline drift:** The `docs/en/settings` page was restructured into a task-oriented guide — the canonical key index moved to `docs/en/settings-reference` (~180 keys). The old source URL is now missing from Sources.  ### Changes in `best-practice/claude-settings.md`  **Badge & counts** - Version badge: `v2.1.224` → `v2.1.252`; Last Updated: `Sep 01, 2026 10:39 AM PKT` - Header counts: `127+ settings / 311 env vars` → `140+ settings / 315+ env vars`  **New source added** - `docs/en/settings-reference` (new canonical key index — was missing from Sources)  **New settings keys (15 total)** - *General Settings:* `crossSessionInbound`, `dialogExpiry`, `autoContinueAtUsageLimit`, `feedbackDrafts` (v2.1.247), `desktopSessionCleanupPeriodDays` (v2.1.248) - *Model section:* `modelSettings` (per-model effort, merge exception), `modelPicker` (curate /model picker, merge exception), `modelPricing` (managed-only), `promptCacheTtl`, `subagentPromptCacheTtl` (v2.1.243) - *Display Settings:* `keybindingFlavor` (v2.1.236), `spellcheck` (v2.1.235) - *Plugin Settings:* `disableCommandPluginSources` (managed, v2.1.229) - *Sandbox:* `sandbox.credentials.files[].decode`, `.maskClaims`, `sandbox.credentials.awsPairs`, `

- **Issue #209** (2026-09-02): **Daily settings drift check — 2026-08-31 (Claude Code v2.1.251)**
  *Symptoms*: ## Summary  Daily automated settings drift check for `best-practice/claude-settings.md`. Report covers Claude Code **v2.1.224 → v2.1.251** (27 versions, ~24 days).  Two research agents ran in parallel: - `workflow-claude-settings-agent` (Opus 5): grep-based local analysis + official doc fetches - `claude-code-guide` (Haiku): independent web research  ---  ## Verification Log  | Rule | Category | Depth | Result | Notes | |------|----------|-------|--------|-------| | 1A | Key Completeness | field-level | FAIL | 24 missing keys; 17 confirmed on official settings page (added to ON HOLD — descriptions not recovered after context compaction) | | 1B | Key Types | content-match | PASS | Existing key types correct | | 1C | Key Defaults | content-match | PASS | Existing defaults correct | | 1D | Key Descriptions | content-match | FAIL | `CLAUDE_CODE_SUBAGENT_MODEL` stale — now sets default not override (FIXED) | | 1E | Scope Column | content-match | PASS | Scopes verified for MCP/permission tables | | 1F | Inverse Completeness | field-level | PASS | No unbackable keys found | | 1G | Edge-Case Semantics | content-match | FAIL | `spinnerTipsOverride` new structured tip schema not documented (FIXED) | | 1H | File Scope Check | content-match | PASS | settings.json vs ~/.claude.json division correct | | 1I | Skills Settings Keys | field-level | PASS | All skills settings keys present | | 2A | Priority Levels | field-level | PASS | 5-level hierarchy correct | | 2B | File Locations | content

- **Issue #208** (2026-09-02): **Daily settings drift check — 2026-08-30 (Claude Code v2.1.251)**
  *Symptoms*: ## Summary  Automated daily drift audit against **Claude Code v2.1.251** (27 versions since last report update at v2.1.224). Two research agents ran in parallel; findings confirmed against the official settings-reference page (`/docs/en/settings-reference`) which became the new authoritative per-key index as of v2.1.242.  ---  ## Drift Found  ### Critical Corrections (6 wrong descriptions fixed)  | Key | Was | Now | |-----|-----|-----| | `ultracode` | "Session-only — not persisted" | Valid `Any file` boolean; Claude Code reads but never writes it; takes precedence over `effortLevel` | | `dialogExpiry` | `number / 30000` (ms) | `string / "5m"` — values: `"60s"`, `"5m"`, `"10m"`, `"never"` | | `feedbackDrafts` | `"queue"` to enable | `"notify"` (default) \| `"quiet"` \| `"off"` | | `spellcheck` | `boolean / false` | Object `{enabled, checker, language, color}` | | `modelPicker` | `array` | Object `{options[], replaceBuiltInOptions}` | | `extraKnownMarketplaces` scope | `Project` | `Any file` |  ### Missing Settings Keys Added (15)  | Key | Scope | Version | |-----|-------|---------| | `crossSessionInbound` | Any file | v2.1.224 (was ON HOLD — now confirmed) | | `isolatePeerMachines` | Any file | — | | `enableWorkflows` | Any file | — | | `managedSourcesBehavior` | Managed | v2.1.242 | | `disableDesktopLocalSessions` | Managed | — | | `sshHostAllowlist` | Managed | — | | `skipAutoPermissionPrompt` | User/managed | — | | `syncClaudeAiSkills` | User/local/managed | — | | `disableC

- **Issue #207** (2026-09-02): **Daily settings drift check — 2026-08-29 (Claude Code v2.1.251)**
  *Symptoms*: ## Summary  Automated daily drift audit of `best-practice/claude-settings.md` against the official Claude Code docs. Report pinned at **v2.1.224**; latest shipped is **v2.1.251** (27-version gap). The official docs also restructured: `/docs/en/settings` no longer contains the key list — it moved to `/docs/en/settings-reference`, which is now added as source #1.  **22 drift items applied. 2 left ON HOLD.**  ---  ## Verification Log  | Rule | Category | Depth | Result | Notes | |------|----------|-------|--------|-------| | 1A | Key Completeness | field-level | ⚠️ PARTIAL | 24 missing keys found; 11 high-priority ones applied | | 1B | Key Types | content-match | ⚠️ ON HOLD | 17 type mismatches flagged; confidence 0.75 — docs may simplify complex types | | 1C | Key Defaults | content-match | ✅ PASS | Defaults verified for applied keys | | 1D | Key Descriptions | content-match | ✅ PASS | CLAUDE_CODE_SUBAGENT_MODEL, CLAUDE_CONFIG_DIR, CLAUDE_CODE_TMPDIR updated | | 1E | Scope Column | content-match | ✅ PASS | allowedMcpServers/deniedMcpServers scope fixed | | 1F | Inverse Completeness | field-level | ✅ PASS | Unverified keys retain annotations | | 1G | Edge-Case Semantics | content-match | ✅ PASS | | | 1H | File Scope Check | content-match | ✅ PASS | showTurnDuration/terminalProgressBarEnabled correctly in settings.json since v2.1.119 | | 1I | Skills Settings Keys | field-level | ✅ PASS | skillOverrides, disableSkillShellExecution, skillListingMaxDescChars, skillListingBudgetFract

- **Issue #206** (2026-09-02): **Daily settings drift check — 2026-08-28 (Claude Code v2.1.250)**
  *Symptoms*: ## Summary  Settings report drift audit: v2.1.224 → v2.1.250 (26 versions, Aug 7–28, 2026).  **2 files changed** | `best-practice/claude-settings.md` (69 insertions, 13 deletions) + `changelog/best-practice/claude-settings/changelog.md` (26 insertions)  ---  ## Critical Fixes (HIGH)  - **`askUserQuestionTimeout` scope was inverted** — report said "only honored from project and local settings" but official docs say "User or managed". Actively misleading; corrected. - **`allowedMcpServers` / `deniedMcpServers` scope** — changed from "Managed only" → "Any" per official settings-reference. - **`skipDangerousModePermissionPrompt`** — was documented as nested under `permissions.*`; it is a top-level key. - **`Read` deny now cascades to `Edit` and `Write`** (v2.1.208/228) — security behavior entirely missing from permissions section. `MultiEdit` also added to never-consulted allow-rule list. - **`/docs/en/settings-reference` added as primary source** — the `/docs/en/settings` page is now a conceptual overview; all per-key documentation moved to `/settings-reference`. - **v2.1.211 local settings location** — `.claude/settings.local.json` now resolves to git repo root (not starting directory); added note.  ## New Settings Added (23 keys)  | Category | Keys Added | |---|---| | General | `crossSessionInbound`, `dialogExpiry`, `autoContinueAtUsageLimit`, `desktopSessionCleanupPeriodDays`, `syncClaudeAiSkills`, `isolatePeerMachines`, `enableWorkflows`, `promptSuggestionEnabled`, `feedback

- **Issue #205** (2026-09-02): **Daily settings drift check — 2026-08-27 (Claude Code v2.1.247)**
  *Symptoms*: ## Summary  23-version drift catch-up: `best-practice/claude-settings.md` was pinned at **v2.1.224**; upstream is at **v2.1.247**. Both agents found 24 missing settings keys, 11 scope/description errors, and 31 missing env vars. Official settings page was also restructured — the canonical key list now lives at `/docs/en/settings-reference` (216 keys).  **Resolves 3 ON HOLD items from previous run (v2.1.224):** `crossSessionInbound`, `dialogExpiry`, and `sandbox.credentials.awsPairs/sigv4` are all now on the official settings page.  ## Changes  ### `best-practice/claude-settings.md`  **Badge & metadata:** - Badge: `v2.1.224` → `v2.1.247`, `Aug 07` → `Aug 27, 2026` - Header count: `127+ settings / 311 env vars` → `150+ settings / 342 env vars` - Added `settings-reference` to Sources section  **New settings (confirmed on official page):** - `feedbackDrafts`, `autoContinueAtUsageLimit`, `crossSessionInbound`, `dialogExpiry`, `isolatePeerMachines`, `enableWorkflows`, `promptSuggestionEnabled`, `skipAutoPermissionPrompt`, `terminalTitleFromRename` → General Settings - `promptCacheTtl`, `subagentPromptCacheTtl` → Plans & Memory - `sandbox.credentials.awsPairs`, `sandbox.credentials.sigv4`, `sandbox.ripgrep` → Sandbox - `disableCommandPluginSources`, `syncClaudeAiSkills` → Plugins - `modelPicker`, `modelPricing` → Model Configuration - `keybindingFlavor`, `spellcheck`, `subagentStatusLine` → Display Settings - `sshHostAllowlist` → Workspace & Teams - `disableDesktopLocalSessions` → M

- **Issue #204** (2026-09-02): **Daily settings drift check — 2026-08-26 (Claude Code v2.1.246)**
  *Symptoms*: ## Summary  Automated daily drift check for `best-practice/claude-settings.md` against Claude Code v2.1.246 (22 releases ahead of the previous audit at v2.1.224).  **Key structural finding:** `/docs/en/settings` is now a how-to page only — the authoritative key list moved to `/docs/en/settings-reference`. Added Rule 1J to the verification checklist to catch this going forward.  ---  ## Drift Report — Claude Code v2.1.246  ### New Settings Added (8 keys)  | Key | Type | Scope | Version | Section | |-----|------|-------|---------|---------| | `crossSessionInbound` | string | User/managed | v2.1.232 | General Settings | | `dialogExpiry` | number (ms) | User/managed | v2.1.232 | General Settings | | `spellcheck` | object | User/managed | v2.1.235 | Display Settings | | `keybindingFlavor` | string | Any | v2.1.238 | Display Settings | | `promptCacheTtl` | number (s) | Any | v2.1.243 | Model Configuration | | `subagentPromptCacheTtl` | number (s) | Any | v2.1.243 | Model Configuration | | `modelPicker` | object | User/managed | v2.1.243 | Model Configuration | | `subagentStatusLine` | object | Any | — | Display Settings |  Also added: `autoContinueAtUsageLimit` and `terminalTitleFromRename` to General Settings.  ### New Environment Variable  - `ANTHROPIC_DEFAULT_MODEL` (v2.1.236) — model new sessions start on when no `model` key is set in any settings file. Unlike `ANTHROPIC_MODEL`, it does not override per-project settings.  ### Changed Behavior  - **`outputStyle`**: Expanded desc

- **Issue #203** (2026-09-02): **Claude  new**
  *Symptoms*: New

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

### Incident Patch 1: `ffaf106f` (2026-09-30)
**Commit Message**: docs(commands): update badge to v2.1.285 and fix /rate-limit-options description

- Bump version badge from v2.1.284 to v2.1.285
- Update Last Updated badge to Sep 30, 2026 11:15 AM PKT
- Remove stale "Doesn't appear in the command menu; type it in full."
  clause from /rate-limit-options: v2.1.284 added the command to /help
  and the command menu for claude.ai subscribers; official docs confirmed

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0122uveTv58qeWg9QneSfo2C

**File**: `best-practice/claude-commands.md` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 # Commands Best Practice
 
-![Last Updated](https://img.shields.io/badge/Last_Updated-Sep%2029%2C%202026%2011%3A15%20AM%20PKT-white?style=flat&labelColor=555) ![Version](https://img.shields.io/badge/Claude_Code-v2.1.284-blue?style=flat&labelColor=555)<br>
+![Last Updated](https://img.shields.io/badge/Last_Updated-Sep%2030%2C%202026%2011%3A15%20AM%20PKT-white?style=flat&labelColor=555) ![Version](https://img.shields.io/badge/Claude_Code-v2.1.285-blue?style=flat&labelColor=555)<br>
 [![Implemented](https://img.shields.io/badge/Implemented-2ea44f?style=flat)](../implementation/claude-commands-implementation.md)
 
 Claude Code commands — frontmatter fields and official built-in slash commands.
@@ -74,7 +74,7 @@ Claude Code commands — frontmatter fields and official built-in slash commands
 | 27 | `/context [all]` | ![Context](https://img.shields.io/badge/Context-8E44AD?style=flat) | Visualize current context usage as a colored grid. Shows optimization suggestions for context-heavy tools, memory bloat, and capacity warnings. Pass `all` to expand the full breakdown |
 | 28 | `/cost` | ![Context](https://img.shields.io/badge/Context-8E44AD?style=flat) | Alias for `/usage` |
 | 29 | `/insights` | ![Context](https://img.shields.io/badge/Context-8E44AD?style=flat) | Generate an HTML report analyzing Claude Code sessions on this machine, including project areas, interaction patterns, and friction points. Not available in cloud sessions |
-| 30 | `/rate-limit-options` | ![Context](https://img.shields.io/badge/Context-8E44AD?style=flat) | Show ways to keep working when a claude.ai usage limit blocks a request: wait and continue automatically when the limit resets, add usage credits, or upgrade your plan. Claude Code can also open this menu on its own when you hit a limit at your own terminal. Requires a claude.ai subscription. Doesn't appear in the command menu; type it in full. The wait-and-continue rows require Claude Code v2.1.234 or later |
+| 30 | `/rate-limit-options` | ![Context](https://img.shields.io/badge/Context-8E44AD?style=flat) | Show ways to keep working when a claude.ai usage limit blocks a request: wait and continue automatically when the limit resets, add usage credits, or upgrade your plan. Claude Code can also open this menu on its own when you hit a limit at your own terminal. Requires a claude.ai subscription. The wait-and-continue rows require Claude Code v2.1.234 or later |
 | 31 | `/stats` | ![Context](https://img.shields.io/badge/Context-8E44AD?style=flat) | Alias for `/usage`. Opens on the Stats tab |
 | 32 | `/status` | ![Context](https://img.shields.io/badge/Context-8E44AD?style=flat) | Open the Settings interface (Status tab) showing version, model, account, and connectivity. Includes a Session kind row showing whether the session is running as a background job (attached or unattended) or interactively. Works while Claude is responding, without waiting for the current response to finish |
 | 33 | `/usage` | ![Context](https://img.shields.io/badge/Context-8E44AD?style=flat) | Show session cost, plan usage limits, and activity stats. On a Pro, Max, Team, or Enterprise plan, includes a breakdown of what counts against your plan limits. `/cost` and `/stats` are aliases |
```

#### Recent Merged Pull Requests:
- **PR #210** (2026-09-02): Daily settings drift check — 2026-09-01 (Claude Code v2.1.252) (@shanraisshan)
- **PR #209** (closed): Daily settings drift check — 2026-08-31 (Claude Code v2.1.251) (@shanraisshan)
- **PR #208** (closed): Daily settings drift check — 2026-08-30 (Claude Code v2.1.251) (@shanraisshan)
- **PR #207** (closed): Daily settings drift check — 2026-08-29 (Claude Code v2.1.251) (@shanraisshan)
- **PR #206** (closed): Daily settings drift check — 2026-08-28 (Claude Code v2.1.250) (@shanraisshan)
- **PR #205** (closed): Daily settings drift check — 2026-08-27 (Claude Code v2.1.247) (@shanraisshan)
- **PR #204** (closed): Daily settings drift check — 2026-08-26 (Claude Code v2.1.246) (@shanraisshan)
- **PR #199** (closed): Daily settings drift check — 2026-08-25 (Claude Code v2.1.245) (@shanraisshan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
