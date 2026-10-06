# Forensic Learning Record (Deep Inspection): shanraisshan/claude-code-best-practice

> **Canonical Artifact**: `07_PROJECT_LEARNING/shanraisshan-claude-code-best-practice-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:50:43.120Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `shanraisshan/claude-code-best-practice`
- **Description**: from vibe coding to agentic engineering - practice makes claude perfect
- **Primary Language / Ecosystem**: HTML
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 67150 stars

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
    3. If neither exists or the key is missing, assume hook is enabled (return False)

    Args:
        event_name: The hook event name (e.g., "PreToolUse", "PostToolUse")

    Returns:
        True if the hook is disabled, False otherwise
    """
    try:
        # Scripts are in .claude/hooks/scripts/, config is in .claude/hooks/config/
        script_dir = Path(__file__).parent  # .claude/hooks/scripts/
        hooks_dir = script_dir.parent  # .claude/hooks/
        config_dir = hooks_dir / "config"  # .claude/hooks/config/

        local_config_path = config_dir / "hooks-config.local.json"
        default_config_path = config_dir / "hooks-config.json"

        # Map event names to config keys
        config_key = f"disable{event_name}Hook"

        # Try to load local config first
        local_config = None
        if local_config_path.exists():
            try:
                with open(local_config_path, "r", encoding="utf-8") as config_file:
                    local_config = json.load(config_file)
            except Exception as e:
                print(f"Error reading local config: {e}", file=sys.stderr)

        # Try to load default config
        default_config = None
        if default_config_path.exists():
            try:
                with open(default_config_path, "r", encoding="utf-8") as config_file:
                    default_config = json.load(config_file)
            except Exception as e:
                print(f"Error reading default config: {e}", file=sys.stderr)

        # Apply fallback logic: local -> default -> False (enabled)
        if local_config is not None and config_key in local_config:
            return local_config[config_key]
        elif default_config is not None and config_key in default_config:
            return default_config[config_key]
        else:
            # If neither config has the key, assume hook is enabled
            return False

    except Exception as e:
        # If anything goes wrong, assume hook is enabled
        print(f"Error in is_hook_disabled: {e}"
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
            "last_assistant_message": hook_data.get("last_assistant_message", ""),
        }

        script_dir = Path(__file__).parent
        hooks_dir = script_dir.parent
        logs_dir = hooks_dir / "logs"

        logs_dir.mkdir(parents=True, exist_ok=True)

        log_path = logs_dir / "hooks-log.jsonl"
        with open(log_path, "a", encoding="utf-8") as log_file:
            log_file.write(json.dumps(log_entry, ensure_ascii=False, indent=2) + "\n")
    except Exception as e:
        print(f"Failed to log hook_data: {e}", file=sys.stderr)


def get_session_context():
    """
    Gather context information for SessionStart hook.
    This output goes to stdout and feeds into the model's context.

    Returns:
        String of context information
    """
    return "hooks context: run"


def parse_args(argv):
    """
    Parse command line arguments.
    All hooks use: hooks.py --hook <hook-name>

    Args:
        argv: sys.argv[1:] list

    Returns:
        Tuple of (event_type, input_data) where input_data is the parsed JSON dict or None
    """
    if not argv:
        return None, None

    # hooks.json calling convention: --hook <event-type>
    # The hooks engine passes JSON via stdin
    if argv[0] == "--hook" and len(argv) >= 2:
        event_type = argv[1]
        input_data = {"type": event_type}
        # Read stdin payload from hooks engine (non-blocking)
        try:
            if not sys.stdin.isatty():
                stdin_data = sys.stdin.read()
                if stdin_data.strip():
                    input_data = json.loads(stdin_data)
                    input_data["type"] = event_type
        except Exception:
            pass
        return event_type, input_data

    return None, None


def main():
    """
    Main program - runs when Codex CLI triggers a hook.

    Supports 8 hooks:
    1. SessionStart (hooks.json): Outputs context to stdout + plays sound
    2. PreToolUse (hooks.json): Plays sound before a tool executes
    3. PermissionRequest (hooks.json): Play
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

### Incident Patch 1: `904a211d` (2026-10-04)
**Commit Message**: Append 2026-10-04 CONCEPTS changelog: v2.1.289 quiet run, 0 new findings

Also includes entries for v2.1.286-288 from prior routine runs that
were committed to a detached HEAD and not pushed. Version bumped
288→289; all 13 recurring ON HOLD items carried forward; all 60+
external URLs validated; all beta badges confirmed current.

Co-Authored-By: Claude <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01E92vrapWtCpVdYKVbkvnnz

**File**: `changelog/best-practice/concepts/changelog.md` (modified, +33/-0)
```diff
@@ -3420,3 +3420,36 @@ Tracks drift between the README CONCEPTS table and official Claude Code document
 | 24 | LOW | Verification | TIPS URL consistency (rule #6) — TIPS commands linking to `/skills` flagged as RECURRING finding (see #12); all other TIPS URLs consistent | ✅ COMPLETE (1 recurring inconsistency carried forward) |
 | 25 | LOW | Verification | Sitemap checked (213 pages); `/en/claude-projects` carried forward as RECURRING (see #2); Mods pages carried forward as RECURRING (see #13); no new concept-worthy docs pages since last run | ✅ COMPLETE (no new concept-worthy pages) |
 | 26 | LOW | Verification | Both agents launched in parallel; workflow-concepts-agent completed with 213-page docs index analysis confirming v2.1.288; claude-code-guide completed with 95-feature inventory; coordinator independently verified all URLs, beta badges, anchor fragments, local files, and CHANGELOG v2.1.288; 0 items requiring auto-apply; all findings recurring from prior runs | ✅ COMPLETE (quiet run; version bumped 287→288; 0 new findings) |
+
+---
+
+## [2026-10-04 09:43 AM PKT] Claude Code v2.1.289
+
+| # | Priority | Type | Action | Status |
+|---|----------|------|--------|--------|
+| 1 | MED | Changed Concept (recurring) | Memory row Location missing `AGENTS.md` — v2.1.277 added `AGENTS.md` as officially supported alternative to `CLAUDE.md`; confidence 0.90 | ⏸️ ON HOLD (RECURRING from 2026-09-23; editorial judgment needed — user decides whether to include alternative config file formats in Location column) |
+| 2 | MED | Missing Concept (recurring) | Projects (`/en/claude-projects`) — "Let Claude coordinate ongoing work with Projects"; coordinates parallel cloud sessions with shared repos, instructions, and memory; has dedicated docs page; confidence 0.90 | ⏸️ ON HOLD (RECURRING from 2026-09-18; requires user judgment — may be covered by Claude Code Web or Agent Teams, or may warrant standalone Hot row) |
+| 3 | MED | Changed URL (recurring) | Plugins row URLs use deprecated patterns — `/discover-plugins` redirects to `/plugins/install` (label "Marketplaces" mismatches destination "Install and manage plugins"), `/plugin-marketplaces` redirects to `/plugins/create-marketplace`; all URLs functional via redirects; confidence 0.90 | ⏸️ ON HOLD (RECURRING from 2026-09-25; URLs functional via redirects; updating requires label changes — editorial preference) |
+| 4 | MED | Changed Concept (recurring) | Claude Code Web → Cloud Sessions naming shift — v2.1.281 changed "Web" setting label to "Cloud sessions"; official docs page titled "Use Claude Code in the cloud"; confidence 0.75 | ⏸️ ON HOLD (RECURRING from 2026-09-25; naming transition in progress — requires user judgment on when to rename) |
+| 5 | MED | Changed Concept (recurring) | Tasks deprecation signal — v2.1.233 deprecated task/todo tools on newer models; Tasks row links to internal report with no official docs page; no badge type for deprecation | ⏸️ ON HOLD (RECURRING from 2026-08-15; no `!/tags/deprecated.svg` badge exists; requires user decision) |
+| 6 | MED | Missing Concept (recurring) | Claude Tag (`/en/claude-tag`) — official replacement for Slack integration on Team/Enterprise plans; distinct from existing Slack row; confidence 0.78 | ⏸️ ON HOLD (RECURRING from 2026-08-08; requires user judgment on standalone row vs sub-link in Slack Description) |
+| 7 | MED | Location Update (recurring) | Bundled Skills Location column lists `/code-review`, `/batch` but official docs enumerate 10+ bundled skills; confidence 0.70 | ⏸️ ON HOLD (RECURRING from 2026-06-27; which subset to display requires user judgement) |
+| 8 | MED | Changed Concept (recurring) | No Flicker Mode naming mismatch — official docs title is "Fullscreen rendering" but README uses "No Flicker Mode"; confirmed still "research preview"; confidence 0.90 | ⏸️ ON HOLD (RECURRING from 2026-08-11; community vs official naming — requires user judgment) |
+| 9 | MED | Structural (recurring) | AI Terms row is not a Claude Code concept/feature — links to external AI terminology report; structurally out of place; confidence 0.70 | ⏸️ ON HOLD (RECURRING from 2026-08-15; removal is destructive; requires user decision) |
+| 10 | MED | Missing Concept (recurring) | Headless Mode (`/en/headless`) — programmatic/CI usage with `claude -p`; currently a supplementary link in Remote Control Description; has own docs page; confidence 0.70 | ⏸️ ON HOLD (RECURRING from 2026-08-15; user previously classified similar items as not standalone concepts) |
+| 11 | MED | Changed URL (recurring) | Hooks primary link points to reference (`/en/hooks`) — alternative: user-facing guide (`/en/hooks-guide`); both valid; confidence 0.70 | ⏸️ ON HOLD (RECURRING from 2026-08-14; editorial preference — current link is the canonical hooks page) |
+| 12 | MED | TIPS URL Inconsistency (recurring) | TIPS section links "commands"/"slash commands" text to `/en/skills` instead of `/en/commands`; CONCEPTS table links Commands to `/en/c
```

---

### Incident Patch 2: `380dce7f` (2026-10-02)
**Commit Message**: docs(commands): update badge to v2.1.287 and apply description fixes from official docs

- Bump Last Updated badge to Oct 02, 2026 and version badge to v2.1.287
- /mcp: add non-interactive (-p) mode detail from official docs
- /rename: add name-collision variant behavior and empty-name rejection notes

Co-Authored-By: Claude <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01EdJtm52zgvFGMqQhBoThEL

**File**: `best-practice/claude-commands.md` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 # Commands Best Practice
 
-![Last Updated](https://img.shields.io/badge/Last_Updated-Oct%2001%2C%202026%2011%3A14%20AM%20PKT-white?style=flat&labelColor=555) ![Version](https://img.shields.io/badge/Claude_Code-v2.1.286-blue?style=flat&labelColor=555)<br>
+![Last Updated](https://img.shields.io/badge/Last_Updated-Oct%2002%2C%202026%2011%3A14%20AM%20PKT-white?style=flat&labelColor=555) ![Version](https://img.shields.io/badge/Claude_Code-v2.1.287-blue?style=flat&labelColor=555)<br>
 [![Implemented](https://img.shields.io/badge/Implemented-2ea44f?style=flat)](../implementation/claude-commands-implementation.md)
 
 Claude Code commands — frontmatter fields and official built-in slash commands.
@@ -91,7 +91,7 @@ Claude Code commands — frontmatter fields and official built-in slash commands
 | 44 | `/chrome` | ![Extensions](https://img.shields.io/badge/Extensions-16A085?style=flat) | Configure Claude in Chrome settings |
 | 45 | `/hooks` | ![Extensions](https://img.shields.io/badge/Extensions-16A085?style=flat) | View hook configurations for tool events |
 | 46 | `/ide` | ![Extensions](https://img.shields.io/badge/Extensions-16A085?style=flat) | Manage IDE integrations and show status |
-| 47 | `/mcp [reconnect <server>\|enable\|disable [<server>\|all]]` | ![Extensions](https://img.shields.io/badge/Extensions-16A085?style=flat) | Manage MCP server connections and OAuth authentication. Run with no argument to open the interactive list, pass `reconnect <server>` to reconnect one disconnected server, or pass `enable`/`disable` with a server name or `all` to change connection state without opening the dialog |
+| 47 | `/mcp [reconnect <server>\|enable\|disable [<server>\|all]]` | ![Extensions](https://img.shields.io/badge/Extensions-16A085?style=flat) | Manage MCP server connections and OAuth authentication. Run with no argument to open the interactive list, pass `reconnect <server>` to reconnect one disconnected server, or pass `enable`/`disable` with a server name or `all` to change connection state without opening the dialog. In non-interactive (`-p`) mode, running it with no argument prints a text summary of server status (requires v2.1.205+) |
 | 48 | `/plugin [subcommand]` | ![Extensions](https://img.shields.io/badge/Extensions-16A085?style=flat) | Manage Claude Code plugins. Run with no argument to open the plugin menu, or pass a subcommand such as `list`, `install`, `enable`, or `disable` to act directly |
 | 49 | `/reload-plugins [--force]` | ![Extensions](https://img.shields.io/badge/Extensions-16A085?style=flat) | Reload all active plugins to apply pending changes without restarting. Reports counts for each reloaded component and flags any load errors. When the reload would change which MCP tools are loaded and invalidate the prompt cache, the command warns and skips unless you pass `--force` |
 | 50 | `/reload-skills` | ![Extensions](https://img.shields.io/badge/Extensions-16A085?style=flat) | Re-scan skill and command directories so skills added or changed on disk during the session become available without restarting. Reports how many skills are available and how many were added or removed |
@@ -133,7 +133,7 @@ Claude Code commands — frontmatter fields and official built-in slash commands
 | 86 | `/goal [condition\|clear]` | ![Session](https://img.shields.io/badge/Session-4A90D9?style=flat) | Set a goal — Claude keeps working across turns until the condition is met. With no argument, shows the current or most recently achieved goal. `clear`, `stop`, `off`, `reset`, `none`, or `cancel` removes an active goal early |
 | 87 | `/list-agents` | ![Session](https://img.shields.io/badge/Session-4A90D9?style=flat) | List the subagents, agent team teammates, and other Claude Code sessions Claude can message, with the name to use for each. Teammate rows and the first line showing this session's own name require v2.1.239 or later. Also available as `/peers`. Only available where cross-session messaging is enabled |
 | 88 | `/recap` | ![Session](https://img.shields.io/badge/Session-4A90D9?style=flat) | Generate a one-line summary of the current session on demand, without affecting the ongoing conversation |
-| 89 | `/rename [name]` | ![Session](https://img.shields.io/badge/Session-4A90D9?style=flat) | Rename the current session and show the name on the prompt bar. Without a name, auto-generates one from conversation history. Also works in `-p` mode (v2.1.205+). Strips control and invisible characters and caps names at 200 characters (v2.1.221+) |
+| 89 | `/rename [name]` | ![Session](https://img.shields.io/badge/Session-4A90D9?style=flat) | Rename the current session and show the name on the prompt bar. Without a name, auto-generates one from conversation history. Also works in `-p` mode (v2.1.205+). Strips control and invisible characters and caps names at 200 characters (v2.1.221+). If another live session on this machine already uses the name, Claude Code applies a variant. A name left empty afte
```

---

### Incident Patch 3: `5d350327` (2026-10-01)
**Commit Message**: docs(claude-commands): fix /resume description for v2.1.285 behavior; bump badge to v2.1.286

v2.1.285 reversed /resume behavior for running background sessions: resuming
now attaches this terminal instead of refusing. Updated description to remove
the incorrect "cannot be resumed" clause and replace it with the attach behavior.
Also bumped version badge v2.1.285 → v2.1.286 and Last Updated date to Oct 01, 2026.

Co-Authored-By: Claude <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01MKpGUeNkb7T8CXEKHt7cLt

**File**: `best-practice/claude-commands.md` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 # Commands Best Practice
 
-![Last Updated](https://img.shields.io/badge/Last_Updated-Sep%2030%2C%202026%2011%3A15%20AM%20PKT-white?style=flat&labelColor=555) ![Version](https://img.shields.io/badge/Claude_Code-v2.1.285-blue?style=flat&labelColor=555)<br>
+![Last Updated](https://img.shields.io/badge/Last_Updated-Oct%2001%2C%202026%2011%3A14%20AM%20PKT-white?style=flat&labelColor=555) ![Version](https://img.shields.io/badge/Claude_Code-v2.1.286-blue?style=flat&labelColor=555)<br>
 [![Implemented](https://img.shields.io/badge/Implemented-2ea44f?style=flat)](../implementation/claude-commands-implementation.md)
 
 Claude Code commands — frontmatter fields and official built-in slash commands.
@@ -134,7 +134,7 @@ Claude Code commands — frontmatter fields and official built-in slash commands
 | 87 | `/list-agents` | ![Session](https://img.shields.io/badge/Session-4A90D9?style=flat) | List the subagents, agent team teammates, and other Claude Code sessions Claude can message, with the name to use for each. Teammate rows and the first line showing this session's own name require v2.1.239 or later. Also available as `/peers`. Only available where cross-session messaging is enabled |
 | 88 | `/recap` | ![Session](https://img.shields.io/badge/Session-4A90D9?style=flat) | Generate a one-line summary of the current session on demand, without affecting the ongoing conversation |
 | 89 | `/rename [name]` | ![Session](https://img.shields.io/badge/Session-4A90D9?style=flat) | Rename the current session and show the name on the prompt bar. Without a name, auto-generates one from conversation history. Also works in `-p` mode (v2.1.205+). Strips control and invisible characters and caps names at 200 characters (v2.1.221+) |
-| 90 | `/resume [session]` | ![Session](https://img.shields.io/badge/Session-4A90D9?style=flat) | Resume a conversation by ID or name, or open the session picker. As of v2.1.144, background sessions appear in the picker marked with `bg`. A still-running background session cannot be resumed from the picker — attach via `claude agents` or stop it first. Alias: `/continue` |
+| 90 | `/resume [session]` | ![Session](https://img.shields.io/badge/Session-4A90D9?style=flat) | Resume a conversation by ID or name, or open the session picker. As of v2.1.144, background sessions appear in the picker marked with `bg`. Resuming a running background session attaches this terminal to it and moves your current conversation to the background — press `←` on an empty prompt to return to agent view. Alias: `/continue` |
 | 91 | `/rewind` | ![Session](https://img.shields.io/badge/Session-4A90D9?style=flat) | Rewind the conversation and/or code to a previous point, or summarize from a selected message. See checkpointing. Alias: `/checkpoint`, `/undo` |
 | 92 | `/stop` | ![Session](https://img.shields.io/badge/Session-4A90D9?style=flat) | Stop the current background session. Only available while attached to a background session; the transcript and any worktree are kept. To detach without stopping, use `/exit` or press `←` |
 | 93 | `/subtask <task>` | ![Session](https://img.shields.io/badge/Session-4A90D9?style=flat) | Spawn a forked subagent: a background subagent that inherits the full conversation and works on the task while you keep working. Its result returns to this conversation when it finishes. Requires v2.1.212+. Not available when agent view is off |
```

---

### Incident Patch 4: `ffaf106f` (2026-09-30)
**Commit Message**: docs(commands): update badge to v2.1.285 and fix /rate-limit-options description

- Bump version badge from v2.1.284 to v2.1.285
- Update Last Updated badge to Sep 30, 2026 11:15 AM PKT
- Remove stale "Doesn't appear in the command menu; type it in full."
  clause from /rate-limit-options: v2.1.284 added the command to /help
  and the command menu for claude.ai subscribers; official docs confirmed

Co-Authored-By: Claude <[REDACTED_EMAIL]>
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

---

### Incident Patch 5: `bfe1f114` (2026-09-29)
**Commit Message**: changelog(concepts): add 2026-09-29 entry — v2.1.284, quiet run, 0 new findings

Version bumped 283→284 (Sonnet 5.5 default, effortSlider keybinding, /mcp reconnect all).
All 12 recurring ON HOLD items carried forward; 3 INVALID items unchanged.
Both research agents completed; 9 verification rules executed; 0 auto-apply actions.

Co-Authored-By: Claude <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_0114xNuTEjaFaNn81mCTCNxo

**File**: `changelog/best-practice/concepts/changelog.md` (modified, +32/-0)
```diff
@@ -3258,3 +3258,35 @@ Tracks drift between the README CONCEPTS table and official Claude Code document
 | 23 | LOW | Verification | TIPS URL consistency (rule #6) — TIPS commands linking to `/skills` flagged as RECURRING finding (see #12); all other TIPS URLs consistent | ✅ COMPLETE (1 recurring inconsistency carried forward) |
 | 24 | LOW | Verification | Sitemap checked; `/en/claude-projects` carried forward as RECURRING (see #2); no new user-facing feature docs pages since last run | ✅ COMPLETE (no new concept-worthy pages) |
 | 25 | LOW | Verification | Both agents launched in parallel; claude-code-guide completed with 65-feature inventory confirming v2.1.283; workflow-concepts-agent ran 511KB output before context limit; coordinator independently verified all URLs, beta badges, anchor fragments, local files, and CHANGELOG v2.1.283; 0 items requiring auto-apply; all findings recurring from prior runs | ✅ COMPLETE (quiet run; version unchanged; 0 new findings) |
+
+---
+
+## [2026-09-29 09:43 AM PKT] Claude Code v2.1.284
+
+| # | Priority | Type | Action | Status |
+|---|----------|------|--------|--------|
+| 1 | MED | Changed Concept (recurring) | Memory row Location missing `AGENTS.md` — v2.1.277 added `AGENTS.md` as officially supported alternative to `CLAUDE.md`; confidence 0.90 | ⏸️ ON HOLD (RECURRING from 2026-09-23; editorial judgment needed — user decides whether to include alternative config file formats in Location column) |
+| 2 | MED | Missing Concept (recurring) | Projects (`/en/claude-projects`) — "Let Claude coordinate ongoing work with Projects"; coordinates parallel cloud sessions with shared repos, instructions, and memory; has dedicated docs page; confidence 0.90 | ⏸️ ON HOLD (RECURRING from 2026-09-18; requires user judgment — may be covered by Claude Code Web or Agent Teams, or may warrant standalone Hot row) |
+| 3 | MED | Changed URL (recurring) | Plugins row URLs use deprecated patterns — `/discover-plugins` redirects to `/plugins/install` (label "Marketplaces" mismatches destination "Install and manage plugins"), `/plugin-marketplaces` redirects to `/plugins/create-marketplace`; all URLs functional via redirects; confidence 0.90 | ⏸️ ON HOLD (RECURRING from 2026-09-25; URLs functional via redirects; updating requires label changes — editorial preference) |
+| 4 | MED | Changed Concept (recurring) | Claude Code Web → Cloud Sessions naming shift — v2.1.281 changed "Web" setting label to "Cloud sessions"; official docs page titled "Use Claude Code in the cloud"; confidence 0.75 | ⏸️ ON HOLD (RECURRING from 2026-09-25; naming transition in progress — requires user judgment on when to rename) |
+| 5 | MED | Changed Concept (recurring) | Tasks deprecation signal — v2.1.233 deprecated task/todo tools on newer models; Tasks row links to internal report with no official docs page; no badge type for deprecation | ⏸️ ON HOLD (RECURRING from 2026-08-15; no `!/tags/deprecated.svg` badge exists; requires user decision) |
+| 6 | MED | Missing Concept (recurring) | Claude Tag (`/en/claude-tag`) — official replacement for Slack integration on Team/Enterprise plans; distinct from existing Slack row; confidence 0.78 | ⏸️ ON HOLD (RECURRING from 2026-08-08; requires user judgment on standalone row vs sub-link in Slack Description) |
+| 7 | MED | Location Update (recurring) | Bundled Skills Location column lists `/code-review`, `/batch` but official docs enumerate 10+ bundled skills; confidence 0.70 | ⏸️ ON HOLD (RECURRING from 2026-06-27; which subset to display requires user judgement) |
+| 8 | MED | Changed Concept (recurring) | No Flicker Mode naming mismatch — official docs title is "Fullscreen rendering" but README uses "No Flicker Mode"; confirmed still "research preview"; confidence 0.90 | ⏸️ ON HOLD (RECURRING from 2026-08-11; community vs official naming — requires user judgment) |
+| 9 | MED | Structural (recurring) | AI Terms row is not a Claude Code concept/feature — links to external AI terminology report; structurally out of place; confidence 0.70 | ⏸️ ON HOLD (RECURRING from 2026-08-15; removal is destructive; requires user decision) |
+| 10 | MED | Missing Concept (recurring) | Headless Mode (`/en/headless`) — programmatic/CI usage with `claude -p`; currently a supplementary link in Remote Control Description; has own docs page; confidence 0.70 | ⏸️ ON HOLD (RECURRING from 2026-08-15; user previously classified similar items as not standalone concepts) |
+| 11 | MED | Changed URL (recurring) | Hooks primary link points to reference (`/en/hooks`) — alternative: user-facing guide (`/en/hooks-guide`); both valid; confidence 0.70 | ⏸️ ON HOLD (RECURRING from 2026-08-14; editorial preference — current link is the canonical hooks page) |
+| 12 | MED | TIPS URL Inconsistency (recurring) | TIPS section links "commands"/"slash commands" text to `/en/skills` instead of `/en/commands`; CONCEPTS table links Commands to `/en/commands`; confidence 0.75 | ⏸️ ON HOLD (RECURRING from 2026-08-29; ma
```

---

### Incident Patch 6: `00229acf` (2026-09-28)
**Commit Message**: changelog(concepts): add 2026-09-28 drift entry — v2.1.283 quiet run

All 25 items RECURRING; 0 new findings; 12 ON HOLD items require user
judgment; 3 INVALID items carried forward; all verification checks pass.
Includes backfill of Sep 24-27 entries from detached HEAD.

Co-Authored-By: Claude <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_016riBHtQ8QsGk5FPggdcMvj

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 # claude-code-best-practice
 from vibe coding to agentic engineering - practice makes claude perfect
 
-![updated with Claude Code](https://img.shields.io/badge/updated_with_Claude_Code-Sep%2028%2C%202026%209%3A18%20AM%20PKT-white?style=flat&labelColor=555) <a href="https://github.com/shanraisshan/claude-code-best-practice/stargazers"><img src="https://img.shields.io/github/stars/shanraisshan/claude-code-best-practice?style=flat&label=%E2%98%85&labelColor=555&color=white" alt="GitHub Stars"></a><br>
+![updated with Claude Code](https://img.shields.io/badge/updated_with_Claude_Code-Sep%2028%2C%202026%209%3A44%20AM%20PKT-white?style=flat&labelColor=555) <a href="https://github.com/shanraisshan/claude-code-best-practice/stargazers"><img src="https://img.shields.io/github/stars/shanraisshan/claude-code-best-practice?style=flat&label=%E2%98%85&labelColor=555&color=white" alt="GitHub Stars"></a><br>
 
 [![Best Practice](!/tags/best-practice.svg)](best-practice/) [![Implemented](!/tags/implemented.svg)](implementation/) [![Orchestration Workflow](!/tags/orchestration-workflow.svg)](orchestration-workflow/orchestration-workflow.md) [![Claude](!/tags/claude.svg)](https://code.claude.com/docs) [![Boris](!/tags/boris-cherny.svg)](#-tips-and-tricks) [![Community](!/tags/community.svg)](#-subscribe) ![Click on these badges below to see the actual sources](!/tags/click-badges.svg)<br>
 <img src="!/tags/a.svg" height="14"> = Agents · <img src="!/tags/c.svg" height="14"> = Commands · <img src="!/tags/s.svg" height="14"> = Skills
```

**File**: `changelog/best-practice/concepts/changelog.md` (modified, +32/-0)
```diff
@@ -3226,3 +3226,35 @@ Tracks drift between the README CONCEPTS table and official Claude Code document
 | 23 | LOW | Verification | TIPS URL consistency (rule #6) — TIPS commands linking to `/skills` flagged as RECURRING finding (see #12); all other TIPS URLs consistent | ✅ COMPLETE (1 recurring inconsistency carried forward) |
 | 24 | LOW | Verification | Sitemap checked (269 pages per llms.txt); `/en/claude-projects` carried forward as RECURRING (see #2); no new user-facing feature docs pages since last run | ✅ COMPLETE (sitemap expanded 210→269 pages from plugins restructuring; no new concept-worthy pages) |
 | 25 | LOW | Verification | Both agents (workflow-concepts-agent + claude-code-guide) launched in parallel and completed; workflow-concepts-agent: 35 concepts verified, 2 redirect URLs (Plugins), 0 new findings; claude-code-guide: 56-feature inventory confirming v2.1.283; coordinator independently verified all URLs, beta badges, anchor fragments, local files; 0 items requiring auto-apply; all findings recurring from prior runs | ✅ COMPLETE (quiet run; version same as yesterday; 0 new findings) |
+
+---
+
+## [2026-09-28 09:44 AM PKT] Claude Code v2.1.283
+
+| # | Priority | Type | Action | Status |
+|---|----------|------|--------|--------|
+| 1 | MED | Changed Concept (recurring) | Memory row Location missing `AGENTS.md` — v2.1.277 added `AGENTS.md` as officially supported alternative to `CLAUDE.md`; confidence 0.90 | ⏸️ ON HOLD (RECURRING from 2026-09-23; editorial judgment needed — user decides whether to include alternative config file formats in Location column) |
+| 2 | MED | Missing Concept (recurring) | Projects (`/en/claude-projects`) — "Let Claude coordinate ongoing work with Projects"; coordinates parallel cloud sessions with shared repos, instructions, and memory; has dedicated docs page; confidence 0.90 | ⏸️ ON HOLD (RECURRING from 2026-09-18; requires user judgment — may be covered by Claude Code Web or Agent Teams, or may warrant standalone Hot row) |
+| 3 | MED | Changed URL (recurring) | Plugins row URLs use deprecated patterns — `/discover-plugins` redirects to `/plugins/install` (label "Marketplaces" mismatches destination "Install and manage plugins"), `/plugin-marketplaces` redirects to `/plugins/create-marketplace`; all URLs functional via redirects; confidence 0.90 | ⏸️ ON HOLD (RECURRING from 2026-09-25; URLs functional via redirects; updating requires label changes — editorial preference) |
+| 4 | MED | Changed Concept (recurring) | Claude Code Web → Cloud Sessions naming shift — v2.1.281 changed "Web" setting label to "Cloud sessions"; official docs page titled "Use Claude Code in the cloud"; confidence 0.75 | ⏸️ ON HOLD (RECURRING from 2026-09-25; naming transition in progress — requires user judgment on when to rename) |
+| 5 | MED | Changed Concept (recurring) | Tasks deprecation signal — v2.1.233 deprecated task/todo tools on newer models; Tasks row links to internal report with no official docs page; no badge type for deprecation | ⏸️ ON HOLD (RECURRING from 2026-08-15; no `!/tags/deprecated.svg` badge exists; requires user decision) |
+| 6 | MED | Missing Concept (recurring) | Claude Tag (`/en/claude-tag`) — official replacement for Slack integration on Team/Enterprise plans; distinct from existing Slack row; confidence 0.78 | ⏸️ ON HOLD (RECURRING from 2026-08-08; requires user judgment on standalone row vs sub-link in Slack Description) |
+| 7 | MED | Location Update (recurring) | Bundled Skills Location column lists `/code-review`, `/batch` but official docs enumerate 10+ bundled skills; confidence 0.70 | ⏸️ ON HOLD (RECURRING from 2026-06-27; which subset to display requires user judgement) |
+| 8 | MED | Changed Concept (recurring) | No Flicker Mode naming mismatch — official docs title is "Fullscreen rendering" but README uses "No Flicker Mode"; confirmed still "research preview"; confidence 0.90 | ⏸️ ON HOLD (RECURRING from 2026-08-11; community vs official naming — requires user judgment) |
+| 9 | MED | Structural (recurring) | AI Terms row is not a Claude Code concept/feature — links to external AI terminology report; structurally out of place; confidence 0.70 | ⏸️ ON HOLD (RECURRING from 2026-08-15; removal is destructive; requires user decision) |
+| 10 | MED | Missing Concept (recurring) | Headless Mode (`/en/headless`) — programmatic/CI usage with `claude -p`; currently a supplementary link in Remote Control Description; has own docs page; confidence 0.70 | ⏸️ ON HOLD (RECURRING from 2026-08-15; user previously classified similar items as not standalone concepts) |
+| 11 | MED | Changed URL (recurring) | Hooks primary link points to reference (`/en/hooks`) — alternative: user-facing guide (`/en/hooks-guide`); both valid; confidence 0.70 | ⏸️ ON HOLD (RECURRING from 2026-08-14; editorial preference — current link is the canonical hooks page) |
+| 12 | MED | TIPS URL Inconsistency (recurring) | TIPS section links "commands"/"slash commands" text to `/en/sk
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
