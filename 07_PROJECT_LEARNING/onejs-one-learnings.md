# Forensic Learning Record (Deep Inspection): onejs/one

> **Canonical Artifact**: `07_PROJECT_LEARNING/onejs-one-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/onejs/one](https://github.com/onejs/one))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:53:52.891Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `onejs/one`
- **Description**: ❶ One lets you target React web and React Native with a single Vite plugin. Everything you need to build great websites and apps with unified routing.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 4491 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/ios-simulator-skill/scripts/app_state_capture.py`
```
#!/usr/bin/env python3
"""
App State Capture for iOS Simulator

Captures complete app state including screenshot, accessibility tree, and logs.
Optimized for minimal token output.

Usage: python scripts/app_state_capture.py [options]
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from common import (
    capture_screenshot,
    count_elements,
    get_accessibility_tree,
    resolve_udid,
)


class AppStateCapture:
    """Captures comprehensive app state for debugging."""

    def __init__(
        self,
        app_bundle_id: str | None = None,
        udid: str | None = None,
        inline: bool = False,
        screenshot_size: str = "half",
    ):
        """
        Initialize state capture.

        Args:
            app_bundle_id: Optional app bundle ID for log filtering
            udid: Optional device UDID (uses booted if not specified)
            inline: If True, return screenshots as base64 (for vision-based automation)
            screenshot_size: 'full', 'half', 'quarter', 'thumb' (default: 'half')
        """
        self.app_bundle_id = app_bundle_id
        self.udid = udid
        self.inline = inline
        self.screenshot_size = screenshot_size

    def capture_screenshot(self, output_path: Path) -> bool:
        """Capture screenshot of current screen."""
        cmd = ["xcrun", "simctl", "io"]

        if self.udid:
            cmd.append(self.udid)
        else:
            cmd.append("booted")

        cmd.extend(["screenshot", str(output_path)])

        try:
            subprocess.run(cmd, capture_output=True, check=True)
            return True
        except subprocess.CalledProcessError:
            return False

    def capture_accessibility_tree(self, output_path: Path) -> dict:
        """Capture accessibility tree using shared utility."""
        try:
            # Use shared utility to fetch tree
            tree = get_accessibility_tree(self.udid, nested=True)

            # Save tree
            with open(output_path, "w") as f:
                json.dump(tree, f, indent=2)

            # Return summary using shared utility
            return {"captured": True, "element_count": count_elements(tree)}
        except Exception as e:
            return {"captured": False, "error": str(e)}

    def capture_logs(self, output_path: Path, line_limit: int = 100) -> dict:
        """Capture recent app logs."""
        if not self.app_bundle_id:
            # Can't capture logs without app ID
            return {"captured": False, "reason": "No app bundle ID specified"}

        # Get app name from bundle ID (simplified)
        app_name = self.app_bundle_id.split(".")[-1]

        cmd = ["xcrun", "simctl", "spawn"]

        if self.udid:
            cmd.append(self.udid)
        else:
            cmd.append("booted")

        cmd.extend(
            [
                "log",
                "show",
                "--predicate",
                f'process == "{app_name}"',
                "--last",
                "1m",  # Last 1 minute
                "--style",
                "compact",
            ]
        )

        try:
            result = subprocess.run(cmd, check=False, capture_output=True, text=True, timeout=5)
            logs = result.stdout

            # Limit lines for token efficiency
            lines = logs.split("\n")
            if len(lines) > line_limit:
                lines = lines[-line_limit:]

            # Save logs
            with open(output_path, "w") as f:
                f.write("\n".join(lines))

            # Analyze for issues
            warning_count = sum(1 for line in lines if "warning" in line.lower())
            error_count = sum(1 for line in lines if "error" in line.lower())

            return {
                "captured": True,
                "lines": len(lines),
                "warnings": warning_count,
                "errors": error_count,
            }
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            return {"captured": False, "error": str(e)}

    def capture_device_info(self) -> dict:
        """Get device information."""
        cmd = ["xcrun", "simctl", "list", "devices", "booted"]

        if self.udid:
            # Specific device info
            cmd = ["xcrun", "simctl", "list", "devices"]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)

            # Parse output for device info (simplified)
            lines = result.stdout.split("\n")
            device_info = {}

            for line in lines:
                if "iPhone" in line or "iPad" in line:
                    # Extract device name and state
                    parts = line.strip().split("(")
                    if parts:
                        device_info["name"] = parts[0].strip()
                        if len(parts) > 2:
                            device_info["udid"] = parts[1].replace(")", "").strip()
                            device_info["state"] = parts[2].replace(")", "").strip()
                    break

            return device_info
        except subprocess.CalledProcessError:
            return {}

    def capture_all(
        self, output_dir: str, log_lines: int = 100, app_name: str | None = None
    ) -> dict:
        """
        Capture complete app state.

        Args:
            output_dir: Directory to save artifacts
            log_lines: Number of log lines to capture
            app_name: App name for semantic naming (for inline mode)

        Returns:
            Summary of captured state
        """
        # Create output directory (only if not in inline mode)
        output_path = Path(output_dir)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        if not self.inline:
            capture_dir = output_path / f"app-state-{timestamp}"
            capture_dir.mkdir(parents=True, exist_ok=True)
        else:
            capture_dir = None

        summary = {
            "timestamp": datetime.now().isoformat(),
            "screenshot_mode": "inline" if self.inline else "file",
        }

        if capture_dir:
            summary["output_dir"] = str(capture_dir)

        # Capture screenshot using new unified utility
        screenshot_result = capture_screenshot(
            self.udid,
            size=self.screenshot_size,
            inline=self.inline,
            app_name=app_name,
        )

        if self.inline:
            # Inline mode: store base64
            summary["screenshot"] = {
                "mode": "inline",
                "base64": screenshot_result["base64_data"],
                "width": screenshot_result["width"],
                "height": screenshot_result["height"],
                "size_preset": self.screenshot_size,
            }
        else:
            # File mode: save to disk
            screenshot_path = capture_dir / "screenshot.png"
            # Move temp file to target location
            import shutil

            shutil.move(screenshot_result["file_path"], screenshot_path)
            summary["screenshot"] = {
                "mode": "file",
                "file": "screenshot.png",
                "size_bytes": screenshot_result["size_bytes"],
            }

        # Capture accessibility tree
        if not self.inline or capture_dir:
            accessibility_path = (capture_dir or output_path) / "accessibility-tree.json"
        else:
            accessibility_path = None

        if accessibility_path:
            tree_info = self.capture_accessibility_tree(accessibility_path)
            summary["accessibility"] = tree_info

        # Capture logs (if app ID provided)
        if self.app_bundle_id:
            if not self.inline or capture_dir:
                logs_path = (capture_dir or output_path) / "app-logs.txt"
            else:
                logs_path = None

            if logs_path:
                log_info = self.capture_logs(logs_path, log_lines)
                summary["logs"] = log_info

        # Get device info
        device_info = self.capture_device_info()
        if device_info:
            summary["device"] = device_info
            # Save device info (file mode only)
            if capture_dir:
                with open(capture_dir / "device-info.json", "w") as f:
                    json.dump(device_info, f, indent=2)

        # Save summary (file mode only)
        if capture_dir:
            with open(capture_dir / "summary.json", "w") as f:
                json.dump(summary, f, indent=2)

            # Create markdown summary
            self._create_summary_md(capture_dir, summary)

        return summary

    def _create_summary_md(self, capture_dir: Path, summary: dict) -> None:
        """Create markdown summary file."""
        md_path = capture_dir / "summary.md"

        with open(md_path, "w") as f:
            f.write("# App State Capture\n\n")
            f.write(f"**Timestamp:** {summary['timestamp']}\n\n")

            if "device" in summary:
                f.write("## Device\n")
                device = summary["device"]
                f.write(f"- Name: {device.get('name', 'Unknown')}\n")
                f.write(f"- UDID: {device.get('udid', 'N/A')}\n")
                f.write(f"- State: {device.get('state', 'Unknown')}\n\n")

            f.write("## Screenshot\n")
            f.write("![Current Screen](screenshot.png)\n\n")

            if "accessibility" in summary:
                acc = summary["accessibility"]
                f.write("## Accessibility\n")
                if acc.get("captured"):
                    f.write(f"- Elements: {acc.get('element_count', 0)}\n")
                else:
                    f.write(f"- Error: {acc.get('error', 'Unknown')}\n")
                f.write("\n")

            if "logs" in summary:
                logs = summary["logs"]
                f.write("## Logs\n")
                if logs.get("captured"):
              
```

### Core Architecture Module: `.claude/skills/ios-simulator-skill/scripts/common/cache_utils.py`
```
#!/usr/bin/env python3
"""
Progressive disclosure cache for large outputs.

Implements cache system to support progressive disclosure pattern:
- Return concise summary with cache_id for large outputs
- User retrieves full details on demand via cache_id
- Reduces token usage by 96% for common queries

Cache directory: ~/.ios-simulator-skill/cache/
Cache expiration: Configurable per cache type (default 1 hour)

Used by:
- sim_list.py - Simulator listing progressive disclosure
- Future: build logs, UI trees, etc.
"""

import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any


class ProgressiveCache:
    """Cache for progressive disclosure pattern.

    Stores large outputs with timestamped IDs for on-demand retrieval.
    Automatically cleans up expired entries.
    """

    def __init__(self, cache_dir: str | None = None, max_age_hours: int = 1):
        """Initialize cache system.

        Args:
            cache_dir: Cache directory path (default: ~/.ios-simulator-skill/cache/)
            max_age_hours: Max age for cache entries before expiration (default: 1 hour)
        """
        if cache_dir is None:
            cache_dir = str(Path("~/.ios-simulator-skill/cache").expanduser())

        self.cache_dir = Path(cache_dir)
        self.max_age_hours = max_age_hours

        # Create cache directory if needed
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def save(self, data: dict[str, Any], cache_type: str) -> str:
        """Save data to cache and return cache_id.

        Args:
            data: Dictionary data to cache
            cache_type: Type of cache ('simulator-list', 'build-log', 'ui-tree', etc.)

        Returns:
            Cache ID like 'sim-20251028-143052' for use in progressive disclosure

        Example:
            cache_id = cache.save({'devices': [...]}, 'simulator-list')
            # Returns: 'sim-20251028-143052'
        """
        # Generate cache_id with timestamp
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        cache_prefix = cache_type.split("-")[0]  # e.g., 'sim' from 'simulator-list'
        cache_id = f"{cache_prefix}-{timestamp}"

        # Save to file
        cache_file = self.cache_dir / f"{cache_id}.json"
        with open(cache_file, "w") as f:
            json.dump(
                {
                    "cache_id": cache_id,
                    "cache_type": cache_type,
                    "created_at": datetime.now().isoformat(),
                    "data": data,
                },
                f,
                indent=2,
            )

        return cache_id

    def get(self, cache_id: str) -> dict[str, Any] | None:
        """Retrieve data from cache by cache_id.

        Args:
            cache_id: Cache ID from save() or list_entries()

        Returns:
            Cached data dictionary, or None if not found/expired

        Example:
            data = cache.get('sim-20251028-143052')
            if data:
                print(f"Found {len(data)} devices")
        """
        cache_file = self.cache_dir / f"{cache_id}.json"

        if not cache_file.exists():
            return None

        # Check if expired
        if self._is_expired(cache_file):
            cache_file.unlink()  # Delete expired file
            return None

        try:
            with open(cache_file) as f:
                entry = json.load(f)
                return entry.get("data")
        except (OSError, json.JSONDecodeError):
            return None

    def list_entries(self, cache_type: str | None = None) -> list[dict[str, Any]]:
        """List available cache entries with metadata.

        Args:
            cache_type: Filter by type (e.g., 'simulator-list'), or None for all

        Returns:
            List of cache entries with id, type, created_at, age_seconds

        Example:
            entries = cache.list_entries('simulator-list')
            for entry in entries:
                print(f"{entry['id']} - {entry['age_seconds']}s old")
        """
        entries = []

        for cache_file in sorted(self.cache_dir.glob("*.json"), reverse=True):
            # Check if expired
            if self._is_expired(cache_file):
                cache_file.unlink()
                continue

            try:
                with open(cache_file) as f:
                    entry = json.load(f)

                    # Filter by type if specified
                    if cache_type and entry.get("cache_type") != cache_type:
                        continue

                    created_at = datetime.fromisoformat(entry.get("created_at", ""))
                    age_seconds = (datetime.now() - created_at).total_seconds()

                    entries.append(
                        {
                            "id": entry.get("cache_id"),
                            "type": entry.get("cache_type"),
                            "created_at": entry.get("created_at"),
                            "age_seconds": int(age_seconds),
                        }
                    )
            except (OSError, json.JSONDecodeError, ValueError):
                continue

        return entries

    def cleanup(self, max_age_hours: int | None = None) -> int:
        """Remove expired cache entries.

        Args:
            max_age_hours: Age threshold (default: uses instance max_age_hours)

        Returns:
            Number of entries deleted

        Example:
            deleted = cache.cleanup()
            print(f"Deleted {deleted} expired cache entries")
        """
        if max_age_hours is None:
            max_age_hours = self.max_age_hours

        deleted = 0

        for cache_file in self.cache_dir.glob("*.json"):
            if self._is_expired(cache_file, max_age_hours):
                cache_file.unlink()
                deleted += 1

        return deleted

    def clear(self, cache_type: str | None = None) -> int:
        """Clear all cache entries of a type.

        Args:
            cache_type: Type to clear (e.g., 'simulator-list'), or None to clear all

        Returns:
            Number of entries deleted

        Example:
            cleared = cache.clear('simulator-list')
            print(f"Cleared {cleared} simulator list entries")
        """
        deleted = 0

        for cache_file in self.cache_dir.glob("*.json"):
            if cache_type is None:
                # Clear all
                cache_file.unlink()
                deleted += 1
            else:
                # Clear by type
                try:
                    with open(cache_file) as f:
                        entry = json.load(f)
                        if entry.get("cache_type") == cache_type:
                            cache_file.unlink()
                            deleted += 1
                except (OSError, json.JSONDecodeError):
                    pass

        return deleted

    def _is_expired(self, cache_file: Path, max_age_hours: int | None = None) -> bool:
        """Check if cache file is expired.

        Args:
            cache_file: Path to cache file
            max_age_hours: Age threshold (default: uses instance max_age_hours)

        Returns:
            True if file is older than max_age_hours
        """
        if max_age_hours is None:
            max_age_hours = self.max_age_hours

        try:
            with open(cache_file) as f:
                entry = json.load(f)
                created_at = datetime.fromisoformat(entry.get("created_at", ""))
                age = datetime.now() - created_at
                return age > timedelta(hours=max_age_hours)
        except (OSError, json.JSONDecodeError, ValueError):
            return True


# Module-level cache instances (lazy-loaded)
_cache_instances: dict[str, ProgressiveCache] = {}


def get_cache(cache_dir: str | None = None) -> ProgressiveCache:
    """Get or create global cache instance.

    Args:
        cache_dir: Custom cache directory (uses default if None)

    Returns:
        ProgressiveCache instance
    """
    # Use cache_dir as key, or 'default' if None
    key = cache_dir or "default"

    if key not in _cache_instances:
        _cache_instances[key] = ProgressiveCache(cache_dir)

    return _cache_instances[key]

```

### Core Architecture Module: `.claude/skills/ios-simulator-skill/scripts/common/device_utils.py`
```
#!/usr/bin/env python3
"""
Shared device and simulator utilities.

Common patterns for interacting with simulators via xcrun simctl and IDB.
Standardizes command building and device targeting to prevent errors.

Follows Jackson's Law - only extracts genuinely reused patterns.

Used by:
- app_launcher.py (8 call sites) - App lifecycle commands
- Multiple scripts (15+ locations) - IDB command building
- navigator.py, gesture.py - Coordinate transformation
- test_recorder.py, app_state_capture.py - Auto-UDID detection
"""

import json
import re
import subprocess


def build_simctl_command(
    operation: str,
    udid: str | None = None,
    *args,
) -> list[str]:
    """
    Build xcrun simctl command with proper device handling.

    Standardizes command building to prevent device targeting bugs.
    Automatically uses "booted" if no UDID provided.

    Used by:
    - app_launcher.py: launch, terminate, install, uninstall, openurl, listapps, spawn
    - Multiple scripts: generic simctl operations

    Args:
        operation: simctl operation (launch, terminate, install, etc.)
        udid: Device UDID (uses 'booted' if None)
        *args: Additional command arguments

    Returns:
        Complete command list ready for subprocess.run()

    Examples:
        # Launch app on booted simulator
        cmd = build_simctl_command("launch", None, "com.app.bundle")
        # Returns: ["xcrun", "simctl", "launch", "booted", "com.app.bundle"]

        # Launch on specific device
        cmd = build_simctl_command("launch", "ABC123", "com.app.bundle")
        # Returns: ["xcrun", "simctl", "launch", "ABC123", "com.app.bundle"]

        # Install app on specific device
        cmd = build_simctl_command("install", "ABC123", "/path/to/app.app")
        # Returns: ["xcrun", "simctl", "install", "ABC123", "/path/to/app.app"]
    """
    cmd = ["xcrun", "simctl", operation]

    # Add device (booted or specific UDID)
    cmd.append(udid if udid else "booted")

    # Add remaining arguments
    cmd.extend(str(arg) for arg in args)

    return cmd


def build_idb_command(
    operation: str,
    udid: str | None = None,
    *args,
) -> list[str]:
    """
    Build IDB command with proper device targeting.

    Standardizes IDB command building across all scripts using IDB.
    Handles device UDID consistently.

    Used by:
    - navigator.py: ui tap, ui text, ui describe-all
    - gesture.py: ui swipe, ui tap
    - keyboard.py: ui key, ui text, ui tap
    - And more: 15+ locations

    Args:
        operation: IDB operation path (e.g., "ui tap", "ui text", "ui describe-all")
        udid: Device UDID (omits --udid flag if None, IDB uses booted by default)
        *args: Additional command arguments

    Returns:
        Complete command list ready for subprocess.run()

    Examples:
        # Tap on booted simulator
        cmd = build_idb_command("ui tap", None, "200", "400")
        # Returns: ["idb", "ui", "tap", "200", "400"]

        # Tap on specific device
        cmd = build_idb_command("ui tap", "ABC123", "200", "400")
        # Returns: ["idb", "ui", "tap", "200", "400", "--udid", "ABC123"]

        # Get accessibility tree
        cmd = build_idb_command("ui describe-all", "ABC123", "--json", "--nested")
        # Returns: ["idb", "ui", "describe-all", "--json", "--nested", "--udid", "ABC123"]

        # Enter text
        cmd = build_idb_command("ui text", None, "hello world")
        # Returns: ["idb", "ui", "text", "hello world"]
    """
    # Split operation into parts (e.g., "ui tap" -> ["ui", "tap"])
    cmd = ["idb"] + operation.split()

    # Add arguments
    cmd.extend(str(arg) for arg in args)

    # Add device targeting if specified (optional for IDB, uses booted by default)
    if udid:
        cmd.extend(["--udid", udid])

    return cmd


def get_booted_device_udid() -> str | None:
    """
    Auto-detect currently booted simulator UDID.

    Queries xcrun simctl for booted devices and returns first match.

    Returns:
        UDID of booted simulator, or None if no simulator is booted.

    Example:
        udid = get_booted_device_udid()
        if udid:
            print(f"Booted simulator: {udid}")
        else:
            print("No simulator is currently booted")
    """
    try:
        result = subprocess.run(
            ["xcrun", "simctl", "list", "devices", "booted"],
            capture_output=True,
            text=True,
            check=True,
        )

        # Parse output to find UDID
        # Format: "  iPhone 16 Pro (ABC123-DEF456) (Booted)"
        for line in result.stdout.split("\n"):
            # Look for UUID pattern in parentheses
            match = re.search(r"\(([A-F0-9\-]{36})\)", line)
            if match:
                return match.group(1)

        return None
    except subprocess.CalledProcessError:
        return None


def resolve_udid(udid_arg: str | None) -> str:
    """
    Resolve device UDID with auto-detection fallback.

    If udid_arg is provided, returns it immediately.
    If None, attempts to auto-detect booted simulator.
    Raises error if neither is available.

    Args:
        udid_arg: Explicit UDID from command line, or None

    Returns:
        Valid UDID string

    Raises:
        RuntimeError: If no UDID provided and no booted simulator found

    Example:
        try:
            udid = resolve_udid(args.udid)  # args.udid might be None
            print(f"Using device: {udid}")
        except RuntimeError as e:
            print(f"Error: {e}")
            sys.exit(1)
    """
    if udid_arg:
        return udid_arg

    booted_udid = get_booted_device_udid()
    if booted_udid:
        return booted_udid

    raise RuntimeError(
        "No device UDID provided and no simulator is currently booted.\n"
        "Boot a simulator or provide --udid explicitly:\n"
        "  xcrun simctl boot <device-name>\n"
        "  python scripts/script_name.py --udid <device-udid>"
    )


def get_device_screen_size(udid: str) -> tuple[int, int]:
    """
    Get actual screen dimensions for device via accessibility tree.

    Queries IDB accessibility tree to determine actual device resolution.
    Falls back to iPhone 14 defaults (390x844) if detection fails.

    Args:
        udid: Device UDID

    Returns:
        Tuple of (width, height) in pixels

    Example:
        width, height = get_device_screen_size("ABC123")
        print(f"Device screen: {width}x{height}")
    """
    try:
        cmd = build_idb_command("ui describe-all", udid, "--json")
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)

        # Parse JSON response
        data = json.loads(result.stdout)
        tree = data[0] if isinstance(data, list) and len(data) > 0 else data

        # Get frame size from root element
        if tree and "frame" in tree:
            frame = tree["frame"]
            width = int(frame.get("width", 390))
            height = int(frame.get("height", 844))
            return (width, height)

        # Fallback
        return (390, 844)
    except Exception:
        # Graceful fallback to iPhone 14 Pro defaults
        return (390, 844)


def resolve_device_identifier(identifier: str) -> str:
    """
    Resolve device name or partial UDID to full UDID.

    Supports multiple identifier formats:
    - Full UDID: "ABC-123-DEF456..." (36 character UUID)
    - Device name: "iPhone 16 Pro" (matches full name)
    - Partial match: "iPhone 16" (matches first device containing this string)
    - Special: "booted" (resolves to currently booted device)

    Args:
        identifier: Device UDID, name, or special value "booted"

    Returns:
        Full device UDID

    Raises:
        RuntimeError: If identifier cannot be resolved

    Example:
        udid = resolve_device_identifier("iPhone 16 Pro")
        # Returns: "ABC123DEF456..."

        udid = resolve_device_identifier("booted")
        # Returns UDID of booted simulator
    """
    # Handle "booted" special case
    if identifier.lower() == "booted":
        booted = get_booted_device_udid()
        if booted:
            return booted
        raise RuntimeError(
            "No simulator is currently booted. "
            "Boot a simulator first: xcrun simctl boot <device-udid>"
        )

    # Check if already a full UDID (36 character UUID format)
    if re.match(r"^[A-F0-9\-]{36}$", identifier, re.IGNORECASE):
        return identifier.upper()

    # Try to match by device name
    simulators = list_simulators(state=None)
    exact_matches = [s for s in simulators if s["name"].lower() == identifier.lower()]
    if exact_matches:
        return exact_matches[0]["udid"]

    # Try partial match
    partial_matches = [s for s in simulators if identifier.lower() in s["name"].lower()]
    if partial_matches:
        return partial_matches[0]["udid"]

    # No match found
    raise RuntimeError(
        f"Device '{identifier}' not found. "
        f"Use 'xcrun simctl list devices' to see available simulators."
    )


def list_simulators(state: str | None = None) -> list[dict]:
    """
    List iOS simulators with optional state filtering.

    Queries xcrun simctl and returns structured list of simulators.
    Optionally filters by state (available, booted, all).

    Args:
        state: Optional filter - "available", "booted", or None for all

    Returns:
        List of simulator dicts with keys:
        - "name": Device name (e.g., "iPhone 16 Pro")
        - "udid": Device UDID (36 char UUID)
        - "state": Device state ("Booted", "Shutdown", "Unavailable")
        - "runtime": iOS version (e.g., "iOS 18.0", "unavailable")
        - "type": Device type ("iPhone", "iPad", "Apple Watch", etc.)

    Example:
        # List all simulators
        all_sims = list_simulators()
        print(f"Total simulators: {len(all_sims)}")

        # List only available simulators
        available = list_simulators(state="available")
        for sim in available:
    
```

### Core Architecture Module: `.claude/skills/ios-simulator-skill/scripts/common/idb_utils.py`
```
#!/usr/bin/env python3
"""
Shared IDB utility functions.

This module provides common IDB operations used across multiple scripts.
Follows Jackson's Law - only shared code that's truly reused, not speculative.

Used by:
- navigator.py - Accessibility tree navigation
- screen_mapper.py - UI element analysis
- accessibility_audit.py - WCAG compliance checking
- test_recorder.py - Test documentation
- app_state_capture.py - State snapshots
- gesture.py - Touch gesture operations
"""

import json
import subprocess
import sys


def get_accessibility_tree(udid: str | None = None, nested: bool = True) -> dict:
    """
    Fetch accessibility tree from IDB.

    The accessibility tree represents the complete UI hierarchy of the current
    screen, with all element properties needed for semantic navigation.

    Args:
        udid: Device UDID (uses booted simulator if None)
        nested: Include nested structure (default True). If False, returns flat array.

    Returns:
        Root element of accessibility tree as dict.
        Structure: {
            "type": "Window",
            "AXLabel": "App Name",
            "frame": {"x": 0, "y": 0, "width": 390, "height": 844},
            "children": [...]
        }

    Raises:
        SystemExit: If IDB command fails or returns invalid JSON

    Example:
        tree = get_accessibility_tree("UDID123")
        # Root is Window element with all children nested
    """
    cmd = ["idb", "ui", "describe-all", "--json"]
    if nested:
        cmd.append("--nested")
    if udid:
        cmd.extend(["--udid", udid])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        tree_data = json.loads(result.stdout)

        # IDB returns array format, extract first element (root)
        if isinstance(tree_data, list) and len(tree_data) > 0:
            return tree_data[0]
        return tree_data
    except subprocess.CalledProcessError as e:
        print(f"Error: Failed to get accessibility tree: {e.stderr}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError:
        print("Error: Invalid JSON from idb", file=sys.stderr)
        sys.exit(1)


def flatten_tree(node: dict, depth: int = 0, elements: list[dict] | None = None) -> list[dict]:
    """
    Flatten nested accessibility tree into list of elements.

    Converts the hierarchical accessibility tree into a flat list where each
    element includes its depth for context.

    Used by:
    - navigator.py - Element finding
    - screen_mapper.py - Element analysis
    - accessibility_audit.py - Audit scanning

    Args:
        node: Root node of tree (typically from get_accessibility_tree)
        depth: Current depth (used internally, start at 0)
        elements: Accumulator list (used internally, start as None)

    Returns:
        Flat list of elements, each with "depth" key indicating nesting level.
        Structure of each element: {
            "type": "Button",
            "AXLabel": "Login",
            "frame": {...},
            "depth": 2,
            ...
        }

    Example:
        tree = get_accessibility_tree()
        flat = flatten_tree(tree)
        for elem in flat:
            print(f"{'  ' * elem['depth']}{elem.get('type')}: {elem.get('AXLabel')}")
    """
    if elements is None:
        elements = []

    # Add current node with depth tracking
    node_copy = node.copy()
    node_copy["depth"] = depth
    elements.append(node_copy)

    # Process children recursively
    for child in node.get("children", []):
        flatten_tree(child, depth + 1, elements)

    return elements


def count_elements(node: dict) -> int:
    """
    Count total elements in tree (recursive).

    Traverses entire tree counting all elements for reporting purposes.

    Used by:
    - test_recorder.py - Element counting per step
    - screen_mapper.py - Summary statistics

    Args:
        node: Root node of tree

    Returns:
        Total element count including root and all descendants

    Example:
        tree = get_accessibility_tree()
        total = count_elements(tree)
        print(f"Screen has {total} elements")
    """
    count = 1
    for child in node.get("children", []):
        count += count_elements(child)
    return count


def get_screen_size(udid: str | None = None) -> tuple[int, int]:
    """
    Get screen dimensions from accessibility tree.

    Extracts the screen size from the root element's frame. Useful for
    gesture calculations and coordinate normalization.

    Used by:
    - gesture.py - Gesture positioning
    - Potentially: screenshot positioning, screen-aware scaling

    Args:
        udid: Device UDID (uses booted if None)

    Returns:
        (width, height) tuple. Defaults to (390, 844) if detection fails
        or tree cannot be accessed.

    Example:
        width, height = get_screen_size()
        center_x = width // 2
        center_y = height // 2
    """
    DEFAULT_WIDTH = 390  # iPhone 14
    DEFAULT_HEIGHT = 844

    try:
        tree = get_accessibility_tree(udid, nested=False)
        frame = tree.get("frame", {})
        width = int(frame.get("width", DEFAULT_WIDTH))
        height = int(frame.get("height", DEFAULT_HEIGHT))
        return (width, height)
    except Exception:
        # Silently fall back to defaults if tree access fails
        return (DEFAULT_WIDTH, DEFAULT_HEIGHT)

```

### Core Architecture Module: `.claude/skills/ios-simulator-skill/scripts/common/screenshot_utils.py`
```
#!/usr/bin/env python3
"""
Screenshot utilities with dual-mode support.

Provides unified screenshot handling with:
- File-based mode: Persistent artifacts for test documentation
- Inline base64 mode: Vision-based automation for agent analysis
- Size presets: Token optimization (full/half/quarter/thumb)
- Semantic naming: {appName}_{screenName}_{state}_{timestamp}.png

Supports resize operations via PIL (optional dependency).

Used by:
- test_recorder.py - Step-based screenshot recording
- app_state_capture.py - State snapshot captures
"""

import base64
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Try to import PIL for resizing, but make it optional
try:
    from PIL import Image

    HAS_PIL = True
except ImportError:
    HAS_PIL = False


def generate_screenshot_name(
    app_name: str | None = None,
    screen_name: str | None = None,
    state: str | None = None,
    timestamp: str | None = None,
    extension: str = "png",
) -> str:
    """Generate semantic screenshot filename.

    Format: {appName}_{screenName}_{state}_{timestamp}.{ext}
    Falls back to: screenshot_{timestamp}.{ext}

    Args:
        app_name: Application name (e.g., 'MyApp')
        screen_name: Screen name (e.g., 'Login')
        state: State description (e.g., 'Empty', 'Filled', 'Error')
        timestamp: ISO timestamp (uses current time if None)
        extension: File extension (default: 'png')

    Returns:
        Semantic filename ready for safe file creation

    Example:
        name = generate_screenshot_name('MyApp', 'Login', 'Empty')
        # Returns: 'MyApp_Login_Empty_20251028-143052.png'

        name = generate_screenshot_name()
        # Returns: 'screenshot_20251028-143052.png'
    """
    if timestamp is None:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    # Build semantic name
    if app_name or screen_name or state:
        parts = [app_name, screen_name, state]
        parts = [p for p in parts if p]  # Filter None/empty
        name = "_".join(parts) + f"_{timestamp}"
    else:
        name = f"screenshot_{timestamp}"

    return f"{name}.{extension}"


def get_size_preset(size: str = "half") -> tuple[float, float]:
    """Get scale factors for size preset.

    Args:
        size: 'full', 'half', 'quarter', 'thumb'

    Returns:
        Tuple of (scale_x, scale_y) for resizing

    Example:
        scale_x, scale_y = get_size_preset('half')
        # Returns: (0.5, 0.5)
    """
    presets = {
        "full": (1.0, 1.0),
        "half": (0.5, 0.5),
        "quarter": (0.25, 0.25),
        "thumb": (0.1, 0.1),
    }
    return presets.get(size, (0.5, 0.5))


def resize_screenshot(
    input_path: str,
    output_path: str | None = None,
    size: str = "half",
    quality: int = 85,
) -> tuple[str, int, int]:
    """Resize screenshot for token optimization.

    Requires PIL (Pillow). Falls back gracefully without it.

    Args:
        input_path: Path to original screenshot
        output_path: Output path (uses input_path if None)
        size: 'full', 'half', 'quarter', 'thumb'
        quality: JPEG quality (1-100, default: 85)

    Returns:
        Tuple of (output_path, width, height) of resized image

    Raises:
        FileNotFoundError: If input file doesn't exist
        ValueError: If PIL not installed and size != 'full'

    Example:
        output, w, h = resize_screenshot(
            'screenshot.png',
            'screenshot_half.png',
            'half'
        )
        print(f"Resized to {w}x{h}")
    """
    input_file = Path(input_path)
    if not input_file.exists():
        raise FileNotFoundError(f"Screenshot not found: {input_path}")

    # If full size, just copy
    if size == "full":
        if output_path:
            import shutil

            shutil.copy(input_path, output_path)
            output_file = Path(output_path)
        else:
            output_file = input_file

        # Get original dimensions
        if HAS_PIL:
            img = Image.open(str(output_file))
            return (str(output_file), img.width, img.height)
        return (str(output_file), 0, 0)  # Dimensions unknown without PIL

    # Need PIL to resize
    if not HAS_PIL:
        raise ValueError(
            f"Size preset '{size}' requires PIL (Pillow). " "Install with: pip3 install pillow"
        )

    # Open original image
    img = Image.open(str(input_file))
    orig_w, orig_h = img.size

    # Calculate new size
    scale_x, scale_y = get_size_preset(size)
    new_w = int(orig_w * scale_x)
    new_h = int(orig_h * scale_y)

    # Resize with high-quality resampling
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Determine output path
    if output_path is None:
        # Insert size marker before extension
        stem = input_file.stem
        suffix = input_file.suffix
        output_path = str(input_file.parent / f"{stem}_{size}{suffix}")

    # Save resized image
    resized.save(output_path, quality=quality, optimize=True)

    return (output_path, new_w, new_h)


def capture_screenshot(
    udid: str,
    output_path: str | None = None,
    size: str = "half",
    inline: bool = False,
    app_name: str | None = None,
    screen_name: str | None = None,
    state: str | None = None,
) -> dict[str, Any]:
    """Capture screenshot with flexible output modes.

    Supports both file-based (persistent artifacts) and inline base64 modes
    (for vision-based automation).

    Args:
        udid: Device UDID
        output_path: File path for file mode (generates semantic name if None)
        size: 'full', 'half', 'quarter', 'thumb' (default: 'half')
        inline: If True, returns base64 data instead of saving to file
        app_name: App name for semantic naming
        screen_name: Screen name for semantic naming
        state: State description for semantic naming

    Returns:
        Dict with mode-specific fields:

        File mode:
        {
            'mode': 'file',
            'file_path': str,
            'size_bytes': int,
            'width': int,
            'height': int,
            'size_preset': str
        }

        Inline mode:
        {
            'mode': 'inline',
            'base64_data': str,
            'mime_type': 'image/png',
            'width': int,
            'height': int,
            'size_preset': str
        }

    Example:
        # File mode
        result = capture_screenshot('ABC123', app_name='MyApp')
        print(f"Saved to: {result['file_path']}")

        # Inline mode
        result = capture_screenshot('ABC123', inline=True, size='half')
        print(f"Screenshot: {result['width']}x{result['height']}")
        print(f"Base64: {result['base64_data'][:50]}...")
    """
    try:
        # Capture raw screenshot to temp file
        temp_path = "/tmp/ios_simulator_screenshot.png"
        cmd = ["xcrun", "simctl", "io", udid, "screenshot", temp_path]

        subprocess.run(cmd, capture_output=True, text=True, check=True)

        if inline:
            # Inline mode: resize and convert to base64
            # Resize if needed
            if size != "full" and HAS_PIL:
                resized_path, width, height = resize_screenshot(temp_path, size=size)
            else:
                resized_path = temp_path
                # Get dimensions via PIL if available
                if HAS_PIL:
                    img = Image.open(resized_path)
                    width, height = img.size
                else:
                    width, height = 390, 844  # Fallback to common device size

            # Read and encode as base64
            with open(resized_path, "rb") as f:
                base64_data = base64.b64encode(f.read()).decode("utf-8")

            # Clean up temp files
            Path(temp_path).unlink(missing_ok=True)
            if resized_path != temp_path:
                Path(resized_path).unlink(missing_ok=True)

            return {
                "mode": "inline",
                "base64_data": base64_data,
                "mime_type": "image/png",
                "width": width,
                "height": height,
                "size_preset": size,
            }

        # File mode: save to output path with semantic naming
        if output_path is None:
            output_path = generate_screenshot_name(app_name, screen_name, state)

        # Resize if needed
        if size != "full" and HAS_PIL:
            final_path, width, height = resize_screenshot(temp_path, output_path, size)
        else:
            # Just move temp to output
            import shutil

            shutil.move(temp_path, output_path)
            final_path = output_path

            # Get dimensions via PIL if available
            if HAS_PIL:
                img = Image.open(final_path)
                width, height = img.size
            else:
                width, height = 390, 844  # Fallback

        # Get file size
        size_bytes = Path(final_path).stat().st_size

        return {
            "mode": "file",
            "file_path": final_path,
            "size_bytes": size_bytes,
            "width": width,
            "height": height,
            "size_preset": size,
        }

    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Failed to capture screenshot: {e.stderr}") from e
    except Exception as e:
        raise RuntimeError(f"Screenshot capture error: {e!s}") from e


def format_screenshot_result(result: dict[str, Any]) -> str:
    """Format screenshot result for human-readable output.

    Args:
        result: Result dictionary from capture_screenshot()

    Returns:
        Formatted string for printing

    Example:
        result = capture_screenshot('ABC123', inline=True)
        print(format_screenshot_result(result))
    """
    if result["mode"] == "file":
        return (
            f"Screenshot: {result['file_path']}\n"
            f"Dimensions: {result['width']}x{res
```

### Core Architecture Module: `packages/compiler/src/transformHermesLoops.ts`
```
import MagicString from 'magic-string'
import { parseSync } from 'oxc-parser'

/**
 * Hermes does not give a loop a per-iteration binding, for its head OR for
 * anything its body declares. It emits one CreateFunctionEnvironment before the
 * loop, so every closure created in the body captures the same variable and
 * observes its final value:
 *
 *   for (let i = 0; i < 2; i++) fns.push(() => i)
 *   fns.map(f => f())  // [2, 2] on Hermes, [0, 1] everywhere else
 *
 * The body form bites just as hard, and is what breaks react-native's own
 * NativeAnimatedHelper, where every native operation wrapper ends up resolving
 * the last method name in the list:
 *
 *   for (var i = 0; i < 2; i++) { const j = i; fns.push(() => j) }
 *
 * Verified with hermesc -dump-bytecode and on device. Nothing else in the
 * pipeline can lower it: oxc's target floor is es2015 and no target it accepts
 * rewrites loop bindings, and esbuild refuses ("Transforming let to the
 * configured target environment is not supported yet") at every target.
 *
 * A function call is the only construct that gets a fresh environment per
 * invocation, so a loop that captures its binding becomes:
 *
 *   var _loop = (i) => { ...body... }
 *   for (var i = 0; i < 2; i++) _loop(i)
 *
 * Only loops that actually capture their binding in a closure are touched, so
 * this is a no-op for the overwhelming majority of loops.
 */

// only a loop can share a binding this way, and only a lexical declaration can
// be shared, so a module missing either cannot be affected and is never parsed.
const LOOP_RE = /\b(?:for|while)\s*(?:await\s+)?\(/
const LEXICAL_RE = /\b(?:let|const|class)\b/

type Loop = {
  node: any
  names: string[]
}

function langFor(filename: string) {
  const ext = filename.split('?')[0].split('.').pop() || 'js'
  // a .ts file is not tsx (`const f = <T>(x: T) => x` is a type parameter
  // there, an unclosed element under tsx), but everything else is parsed as
  // jsx: react-native ships jsx inside plain .js, and oxc's `js` rejects it.
  if (ext === 'ts' || ext === 'cts' || ext === 'mts') return 'ts' as const
  if (ext === 'tsx') return 'tsx' as const
  return 'jsx' as const
}

function collectPatternNames(node: any, out: string[]) {
  if (!node || typeof node !== 'object') return
  switch (node.type) {
    case 'Identifier':
      out.push(node.name)
      return
    case 'ObjectPattern':
      for (const p of node.properties || []) {
        collectPatternNames(p.value ?? p.argument, out)
      }
      return
    case 'ArrayPattern':
      for (const el of node.elements || []) collectPatternNames(el, out)
      return
    case 'AssignmentPattern':
      collectPatternNames(node.left, out)
      return
    case 'RestElement':
      collectPatternNames(node.argument, out)
      return
  }
}

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
])

function eachChild(node: any, fn: (child: any) => void) {
  for (const key in node) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'parent') continue
    const value = node[key]
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item.type === 'string') fn(item)
      }
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      fn(value)
    }
  }
}

/** does any closure inside `body` read one of `names`? */
function capturesInClosure(body: any, names: Set<string>): boolean {
  let found = false

  function scanInsideFunction(node: any, shadowed: Set<string>) {
    if (found || !node || typeof node !== 'object') return
    if (node.type === 'Identifier' && names.has(node.name) && !shadowed.has(node.name)) {
      found = true
      return
    }
    if (FUNCTION_TYPES.has(node.type)) {
      const inner = new Set(shadowed)
      const params: string[] = []
      for (const p of node.params || []) collectPatternNames(p, params)
      for (const p of params) inner.add(p)
      if (node.id?.name) inner.add(node.id.name)
      eachChild(node, (c) => scanInsideFunction(c, inner))
      return
    }
    // a member expression's property is not a reference to the binding
    if (node.type === 'MemberExpression' && !node.computed) {
      scanInsideFunction(node.object, shadowed)
      return
    }
    if (node.type === 'Property' && !node.computed && node.key === node.value) {
      // shorthand `{ i }` still reads i
      scanInsideFunction(node.value, shadowed)
      return
    }
    eachChild(node, (c) => scanInsideFunction(c, shadowed))
  }

  function walk(node: any) {
    if (found || !node || typeof node !== 'object') return
    if (FUNCTION_TYPES.has(node.type)) {
      const shadowed = new Set<string>()
      const params: string[] = []
      for (const p of node.params || []) collectPatternNames(p, params)
      for (const p of params) shadowed.add(p)
      eachChild(node, (c) => scanInsideFunction(c, shadowed))
      return
    }
    eachChild(node, walk)
  }

  walk(body)
  return found
}

type BodyFacts = {
  hasBreak: boolean
  hasContinue: boolean
  hasReturn: boolean
  hasAwait: boolean
  hasYield: boolean
  assignsBinding: boolean
  hasLabeledJump: boolean
}

/**
 * Control flow that has to survive being moved into a function body. `break`
 * and `continue` are only relevant when they belong to THIS loop, so nested
 * loops and switches are not descended into for those.
 */
function analyzeBody(body: any, names: Set<string>): BodyFacts {
  const facts: BodyFacts = {
    hasBreak: false,
    hasContinue: false,
    hasReturn: false,
    hasAwait: false,
    hasYield: false,
    assignsBinding: false,
    hasLabeledJump: false,
  }

  function walk(
    node: any,
    inNestedBreakable: boolean,
    inNestedLoop: boolean,
    inFunction: boolean
  ) {
    if (!node || typeof node !== 'object') return

    if (FUNCTION_TYPES.has(node.type)) {
      eachChild(node, (c) => walk(c, inNestedBreakable, inNestedLoop, true))
      return
    }

    switch (node.type) {
      case 'BreakStatement':
        if (node.label) facts.hasLabeledJump = true
        else if (!inNestedBreakable) facts.hasBreak = true
        break
      case 'ContinueStatement':
        if (node.label) facts.hasLabeledJump = true
        else if (!inNestedLoop) facts.hasContinue = true
        break
      case 'ReturnStatement':
        if (!inFunction) facts.hasReturn = true
        break
      case 'AwaitExpression':
        if (!inFunction) facts.hasAwait = true
        break
      case 'YieldExpression':
        if (!inFunction) facts.hasYield = true
        break
      case 'AssignmentExpression':
        if (node.left?.type === 'Identifier' && names.has(node.left.name)) {
          facts.assignsBinding = true
        }
        break
      case 'UpdateExpression':
        if (node.argument?.type === 'Identifier' && names.has(node.argument.name)) {
          facts.assignsBinding = true
        }
        break
    }

    const isLoop =
      node.type === 'ForStatement' ||
      node.type === 'ForOfStatement' ||
      node.type === 'ForInStatement' ||
      node.type === 'WhileStatement' ||
      node.type === 'DoWhileStatement'
    const isBreakable = isLoop || node.type === 'SwitchStatement'

    eachChild(node, (c) =>
      walk(c, inNestedBreakable || isBreakable, inNestedLoop || isLoop, inFunction)
    )
  }

  walk(body, false, false, false)
  return facts
}

/**
 * Lexical names the body itself declares. Nested functions are skipped, since
 * their declarations already get a fresh environment per call, but nested
 * blocks and nested loop heads are not: Hermes gives the whole loop one
 * environment, so anything declared anywhere under it is shared too.
 */
function collectBodyLexicalNames(node: any, out: string[]) {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return
  if (FUNCTION_TYPES.has(node.type) || node.type === 'ClassBody') return
  if (node.type === 'VariableDeclaration') {
    if (node.kind === 'let' || node.kind === 'const') {
      for (const d of node.declarations || []) collectPatternNames(d.id, out)
    }
    return
  }
  if (node.type === 'ClassDeclaration') {
    if (node.id?.name) out.push(node.id.name)
    return
  }
  eachChild(node, (c) => collectBodyLexicalNames(c, out))
}

const LOOP_TYPES = new Set([
  'ForStatement',
  'ForOfStatement',
  'ForInStatement',
  'WhileStatement',
  'DoWhileStatement',
])

function headDeclaration(node: any): any {
  if (node.type === 'ForStatement') return node.init
  if (node.type === 'ForOfStatement' || node.type === 'ForInStatement') return node.left
  return null
}

/**
 * One pass. Only the outermost qualifying loop of a nested chain is rewritten,
 * because rewriting an inner loop whose text is about to be moved would produce
 * overlapping edits. The caller re-runs until the code stops changing, which
 * picks up inner loops on later passes.
 */
function transformOnce(
  code: string,
  filename: string
): { code: string; map: any } | null {
  const parsed = parseSync(filename, code, { lang: langFor(filename) })
  if (!parsed?.program || parsed.errors?.length) return null

  const candidates: Loop[] = []

  function findLoops(node: any, insideCandidate: boolean) {
    if (!node || typeof node !== 'object') return

    let isCandidate = false
    if (LOOP_TYPES.has(node.type) && node.body) {
      // only head names become parameters of the lifted function; body
      // declarations are made fresh just by moving into a function body.
      const names: string[] = []
      const decl = headDeclaration(node)
      if (
        decl?.type === 'VariableDeclaration' &&
        (decl.kind === 'let' || decl.kind === 'const')
      ) {
        for (const d of decl.declarations || []) collectPatternNames(d.id, names)
      }
      const shared = [...names]
      collectBodyLexicalNames(node.body, shared)
      if (shared.length && capturesInClosure(node.body, new Set(shared))) {
```

### Core Architecture Module: `packages/compiler/types/transformHermesLoops.d.ts`
```
export declare function transformHermesLoops(code: string, filename: string): {
    code: string;
    maps: any[];
} | null;
//# sourceMappingURL=transformHermesLoops.d.ts.map
```

### Core Architecture Module: `packages/native/ios/Toolbar/FontUtils.swift`
```
// adapted from expo-router (MIT license) - https://github.com/expo/expo
import React

import UIKit

struct FontUtils {
  static func convertTitleStyleToFont(_ titleStyle: TitleStyle) -> UIFont {
    let fontFamily = titleStyle.fontFamily
    let fontWeight = titleStyle.fontWeight
    let resolvedFontSize = resolveFontSize(titleStyle.fontSize)
    if fontFamily != nil || fontWeight != nil {
      return RCTFont.update(
        nil, withFamily: fontFamily, size: NSNumber(value: Float(resolvedFontSize)),
        weight: fontWeight, style: nil, variant: nil, scaleMultiplier: 1.0)
    }
    return UIFont.systemFont(ofSize: resolvedFontSize)
  }

  static func setTitleStyle(fromConfig titleStyle: TitleStyle, for item: UIBarButtonItem) {
    var attrs: [NSAttributedString.Key: Any] = [:]
    attrs[.font] = convertTitleStyleToFont(titleStyle)
    if let color = titleStyle.color { attrs[.foregroundColor] = color }
    item.setTitleTextAttributes(attrs, for: .normal)
    item.setTitleTextAttributes(attrs, for: .highlighted)
    item.setTitleTextAttributes(attrs, for: .disabled)
    item.setTitleTextAttributes(attrs, for: .selected)
    item.setTitleTextAttributes(attrs, for: .focused)
  }

  static func clearTitleStyle(for item: UIBarButtonItem) {
    item.setTitleTextAttributes(nil, for: .normal)
    item.setTitleTextAttributes(nil, for: .highlighted)
    item.setTitleTextAttributes(nil, for: .disabled)
    item.setTitleTextAttributes(nil, for: .selected)
    item.setTitleTextAttributes(nil, for: .focused)
  }

  private static func resolveFontSize(_ fontSize: Double?) -> CGFloat {
    if let fontSize = fontSize { return CGFloat(fontSize) }
    #if os(tvOS)
      return 17.0
    #else
      return UIFont.labelFontSize
    #endif
  }
}

```

### Core Architecture Module: `packages/one/src/__mocks__/expo-modules-core.ts`
```
// Mock for expo-modules-core used in vitest tests

export const EventEmitter = class EventEmitter {
  addListener() {}
  removeListener() {}
  emit() {}
}

export const NativeModulesProxy = {}
export const requireNativeModule = () => ({})
export const requireOptionalNativeModule = () => null

```

### Core Architecture Module: `packages/one/src/cli/workerPool.ts`
```
/**
 * Worker pool for parallel page building using true multicore.
 */
import { Worker } from 'node:worker_threads'
import { cpus } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface PendingTask {
  id: number
  resolve: (result: any) => void
  reject: (error: Error) => void
}

export class BuildWorkerPool {
  private workers: Worker[] = []
  private available: Worker[] = []
  private taskQueue: Array<{ msg: any; pending: PendingTask }> = []
  private pendingById = new Map<number, PendingTask>()
  private nextId = 0
  private readyCount = 0
  private initCount = 0
  private _ready: Promise<void>
  private _resolveReady!: () => void
  private _initialized: Promise<void>
  private _resolveInitialized!: () => void
  private _terminated = false

  constructor(size = Math.max(1, cpus().length - 1)) {
    this._ready = new Promise((resolve) => {
      this._resolveReady = resolve
    })
    this._initialized = new Promise((resolve) => {
      this._resolveInitialized = resolve
    })

    // use .mjs for proper ESM module resolution in worker threads
    const workerPath = join(__dirname, 'buildPageWorker.mjs')

    for (let i = 0; i < size; i++) {
      const worker = new Worker(workerPath)

      worker.on('message', (msg: any) => {
        if (msg.type === 'ready') {
          this.readyCount++
          this.available.push(worker)
          if (this.readyCount === size) {
            this._resolveReady()
          }
        } else if (msg.type === 'init-done') {
          this.initCount++
          if (this.initCount === size) {
            this._resolveInitialized()
          }
          this.dispatch()
        } else if (msg.type === 'done' || msg.type === 'error') {
          const pending = this.pendingById.get(msg.id)
          if (pending) {
            this.pendingById.delete(msg.id)
            if (msg.type === 'done') {
              pending.resolve(msg.result)
            } else {
              pending.reject(new Error(msg.error))
            }
          }
          this.available.push(worker)
          this.dispatch()
        }
      })

      worker.on('error', (err) => {
        console.error('[BuildWorkerPool] Worker error:', err)
      })

      this.workers.push(worker)
    }
  }

  get size() {
    return this.workers.length
  }

  // initialize all workers with pre-loaded config from main thread
  async initialize(oneOptions?: any) {
    await this._ready
    // pass oneOptions via postMessage so workers skip loading vite config
    for (const worker of this.workers) {
      worker.postMessage({ type: 'init', id: this.nextId++, oneOptions })
    }
    // wait for all workers to be initialized
    await this._initialized
  }

  private dispatch() {
    while (this.available.length > 0 && this.taskQueue.length > 0) {
      const worker = this.available.shift()!
      const { msg, pending } = this.taskQueue.shift()!
      this.pendingById.set(pending.id, pending)
      worker.postMessage(msg)
    }
  }

  async buildPage(args: {
    serverEntry: string
    routerRoot: string
    path: string
    relativeId: string
    params: any
    foundRoute: any
    clientManifestEntry: any
    staticDir: string
    clientDir: string
    builtMiddlewares: Record<string, string>
    serverJsPath: string
    preloads: string[]
    allCSS: string[]
    layoutCSS: string[]
    routePreloads: Record<string, string>
    allCSSContents?: string[]
    criticalPreloads?: string[]
    deferredPreloads?: string[]
    useAfterLCP?: boolean
    useAfterLCPAggressive?: boolean
  }): Promise<any> {
    if (this._terminated) {
      throw new Error('Worker pool has been terminated')
    }

    // serialize foundRoute to only include plain data (no functions)
    // workers can't receive non-serializable data like functions
    const serializedRoute = {
      type: args.foundRoute.type,
      file: args.foundRoute.file,
      // only keep serializable layout data
      layouts: args.foundRoute.layouts?.map((layout: any) => ({
        contextKey: layout.contextKey,
        loaderServerPath: layout.loaderServerPath,
        layoutRenderMode: layout.layoutRenderMode,
      })),
      // only keep contextKey from middlewares
      middlewares: args.foundRoute.middlewares?.map((mw: any) => ({
        contextKey: mw.contextKey,
      })),
    }

    const id = this.nextId++
    const msg = {
      type: 'build',
      id,
      args: {
        ...args,
        foundRoute: serializedRoute,
      },
    }

    return new Promise((resolve, reject) => {
      const pending: PendingTask = { id, resolve, reject }
      this.taskQueue.push({ msg, pending })
      this.dispatch()
    })
  }

  async terminate() {
    this._terminated = true
    await Promise.all(this.workers.map((w) => w.terminate()))
    this.workers = []
    this.available = []
  }
}

// singleton pool instance
let pool: BuildWorkerPool | null = null

export function getWorkerPool(size?: number): BuildWorkerPool {
  if (!pool) {
    pool = new BuildWorkerPool(size)
  }
  return pool
}

export async function terminateWorkerPool() {
  if (pool) {
    await pool.terminate()
    pool = null
  }
}

```

### Core Architecture Module: `packages/one/src/daemon/utils.ts`
```
// daemon utility functions

import * as fs from 'node:fs'
import * as path from 'node:path'

export interface AppConfig {
  expo?: {
    name?: string
    slug?: string
    ios?: {
      bundleIdentifier?: string
    }
    android?: {
      package?: string
    }
  }
  // bare RN config
  name?: string
}

export function getBundleIdFromConfig(root: string): string | undefined {
  const appJsonPath = path.join(root, 'app.json')

  if (!fs.existsSync(appJsonPath)) {
    return undefined
  }

  try {
    const appConfig: AppConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'))

    // try expo config first
    if (appConfig.expo?.ios?.bundleIdentifier) {
      return appConfig.expo.ios.bundleIdentifier
    }

    if (appConfig.expo?.android?.package) {
      return appConfig.expo.android.package
    }

    // fallback to slug or name
    if (appConfig.expo?.slug) {
      return appConfig.expo.slug
    }

    if (appConfig.expo?.name) {
      return appConfig.expo.name.toLowerCase().replace(/\s+/g, '-')
    }

    if (appConfig.name) {
      return appConfig.name.toLowerCase().replace(/\s+/g, '-')
    }

    return undefined
  } catch {
    return undefined
  }
}

const MAX_PORT = 65535

export function getAvailablePort(
  preferredPort: number,
  excludePort?: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    import('node:net').then((netModule) => {
      const tryPort = (port: number) => {
        if (port > MAX_PORT) {
          reject(
            new Error(`No available port found between ${preferredPort} and ${MAX_PORT}`)
          )
          return
        }

        if (port === excludePort) {
          tryPort(port + 1)
          return
        }

        // create fresh server for each attempt
        const server = netModule.createServer()

        server.once('error', () => {
          server.close()
          tryPort(port + 1)
        })

        server.once('listening', () => {
          server.close(() => {
            resolve(port)
          })
        })

        server.listen(port, '0.0.0.0')
      }

      tryPort(preferredPort)
    })
  })
}

```

### Core Architecture Module: `packages/one/src/fork/getPathFromState-mods.ts`
```
/**
 * This file exports things that will be used to modify the forked code in `getPathFromState.ts`.
 *
 * The purpose of keeping things in this separated file is to keep changes to the copied code as little as possible, making merging upstream updates easier.
 */

import type { Route } from '@react-navigation/core'

import { matchDynamicName, matchGroupName } from '../router/matchers'
import { getParamName } from './_shared'

export type AdditionalOptions = {
  preserveDynamicRoutes?: boolean
  preserveGroups?: boolean
  shouldEncodeURISegment?: boolean
}

export type ConfigItemMods = {
  // Used as fallback for groups
  initialRouteName?: string
}

export function getPathWithConventionsCollapsed({
  pattern,
  route,
  params,
  preserveGroups,
  preserveDynamicRoutes,
  shouldEncodeURISegment = true,
  initialRouteName,
}: AdditionalOptions & {
  pattern: string
  route: Route<any>
  params: Record<string, any>
  initialRouteName?: string
}) {
  const segments = pattern.split('/')
  return segments
    .map((p, i) => {
      const name = getParamName(p)

      // We don't know what to show for wildcard patterns
      // Showing the route name seems ok, though whatever we show here will be incorrect
      // Since the page doesn't actually exist
      if (p.startsWith('*')) {
        if (preserveDynamicRoutes) {
          if (name === 'not-found') {
            return '+not-found'
          }

          return `[...${name}]`
        }

        if (params[name]) {
          if (Array.isArray(params[name])) {
            return params[name].join('/')
          }
          return params[name]
        }

        if (route.name.startsWith('[') && route.name.endsWith(']')) {
          return ''
        }

        if (i === 0) {
          // This can occur when a wildcard matches all routes and the given path was `/`.
          return route
        }

        if (p === '*not-found') {
          return ''
        }
        // remove existing segments from route.path and return it
        // this is used for nested wildcard routes. Without this, the path would add
        // all nested segments to the beginning of the wildcard route.
        return route.name
          ?.split('/')
          .slice(i + 1)
          .join('/')
      }

      // If the path has a pattern for a param, put the param in the path
      if (p.startsWith(':')) {
        if (preserveDynamicRoutes) {
          return `[${name}]`
        }
        // Optional params without value assigned in route.params should be ignored
        const value = params[name]
        if (value === undefined && p.endsWith('?')) {
          return undefined
        }

        // return params[name]
        return (shouldEncodeURISegment ? encodeURISegment(value) : value) ?? 'undefined'
      }

      if (!preserveGroups && matchGroupName(p) != null) {
        // When the last part is a group it could be a shared URL
        // if the route has an initialRouteName defined, then we should
        // use that as the component path as we can assume it will be shown.
        if (segments.length - 1 === i) {
          if (initialRouteName) {
            // Return an empty string if the init route is ambiguous.
            if (segmentMatchesConvention(initialRouteName)) {
              return ''
            }

            return shouldEncodeURISegment
              ? encodeURIComponentPreservingBrackets(initialRouteName)
              : initialRouteName
          }
        }
        return ''
      }

      return shouldEncodeURISegment ? encodeURIComponentPreservingBrackets(p) : p
    })
    .map((v) => v ?? '')
    .join('/')
}

function encodeURIComponentPreservingBrackets(str: string) {
  return encodeURIComponent(str).replace(/%5B/g, '[').replace(/%5D/g, ']')
}

export function appendBaseUrl(
  path: string,
  baseUrl: string | undefined = process.env.EXPO_BASE_URL
) {
  if (process.env.NODE_ENV !== 'development') {
    if (baseUrl) {
      return `/${baseUrl.replace(/^\/+/, '').replace(/\/$/, '')}${path}`
    }
  }
  return path
}

function segmentMatchesConvention(segment: string): boolean {
  return (
    segment === 'index' ||
    matchDynamicName(segment) != null ||
    matchGroupName(segment) != null
  )
}

function encodeURISegment(str: string, { preserveBrackets = false } = {}) {
  // Valid characters according to
  // https://datatracker.ietf.org/doc/html/rfc3986#section-3.3 (see pchar definition)
  str = String(str).replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]/g, (char) =>
    encodeURIComponent(char)
  )

  if (preserveBrackets) {
    // Preserve brackets
    str = str.replace(/%5B/g, '[').replace(/%5D/g, ']')
  }
  return str
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #587** (2026-02-09): **HMR failes to reload when running on Expo Go mobile**
  *Symptoms*: ### Current Behavior  When running on Expo Go mobile, the HMR picks a few changes and closes connection when theres a syntax error.  ### Expected Behavior  The HMR should respond to file changes and not terminate the `one dev` process  ### One Version  ```markdown 1.1.506 ```  ### Platform (Web, iOS, Android)  ```markdown iOS ```  ### Reproduction  ```markdown 1. Create a new project using `bunx one` 2. Select Minimal TamaGUI template 3. Run `bun install` 4. Run `bun run dev` 5. Enter qr to open expo go on mobile 6. start to make changes to codebase 7. after a few seconds the process in the terminal terminates ```  ### System Info  ```markdown System:     OS: macOS 26.0     CPU: (12) arm64 Apple M4 Pro     Memory: 88.77 MB / 24.00 GB     Shell: 5.9 - /bin/zsh   Binaries:     Node: 22.14.0 - ~/.nvm/versions/node/v22.14.0/bin/node     npm: 10.9.2 - ~/.nvm/versions/node/v22.14.0/bin/npm     pnpm: 10.7.1 - ~/.bun/bin/pnpm     bun: 1.2.17 - ~/.bun/bin/bun   Browsers:     Safari: 26.0   npmPackages:     @biomejs/biome: 1.9.4 => 1.9.4      @react-native-community/cli: 19.0.0 => 19.0.0      @tamagui/animations-css: ^1.132.9 => 1.132.11      @tamagui/animations-moti: ^1.132.9 => 1.132.11      @tamagui/colors: ^1.132.9 => 1.132.11      @tamagui/config: ^1.132.9 => 1.132.11      @tamagui/image-next: ^1.132.9 => 1.132.11      @tamagui/lucide-icons: ^1.132.9 => 1.132.11      @tamagui/react-native-media-driver: ^1.132.9 => 1.132.11      @tamagui/shorthands: ^1.132.9 => 1.132.11      @tamag
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. A few clarifying questions:  1. What is the exact error message when the process terminates? Any stack trace in the terminal? 2. Does the web HMR work correctly, or is it only the native/Expo Go HMR that fails? 3. Does this happen with any file change, or specifically when there's a syntax error? 4. If you fix the syntax error and save again, does HMR recover or does it stay disconnected?  This information will help narrow down whether it's a WebSocket connection issue, a Metro bundler issue, or something specific to the error recovery flow.

- **Issue #526** (2026-01-07): **defaultRenderMode: 'spa' doesn't work on windows**
  *Symptoms*: ### Current Behavior  When it is set to 'spa' the page is rendered blank.   I realize that windows is not yet supported but I spent a lot of time trying to get the zero example working on windows.  I was able to narrow the problem down to the fact that the default render mode of 'spa' was the problem.    Changing it to 'ssg' the application started working.  I'm hoping this bug report may help other people who are trying to test functionality on windows until you are able to resolve this issue.  ### Expected Behavior  I expected to install one using npx one and install the zero example and have it work with windows like the basic example.  The basic example uses ssg while the zero version is set to spa.   ### One Version  ```markdown "one": "1.1.446" ```  ### Platform (Web, iOS, Android)  ```markdown Windows (Web, desktop, ios) ```  ### Reproduction  ```markdown Change the default render mode in vite.config.ts to  defaultRenderMode: 'spa'  and the application will not work. Then change it to   defaultRenderMode: 'ssg'  and the application works again. ```  ### System Info  ```markdown System:     OS: Windows 11 10.0.26100     CPU: (12) x64 Intel(R) Core(TM) i7-8750H CPU @ 2.20GHz     Memory: 9.59 GB / 31.90 GB   Binaries:     Node: 22.13.1 - ~\.nvm\versions\node\v22.13.1\bin\node.EXE     Yarn: 1.22.22 - ~\.nvm\versions\node\v22.13.1\bin\yarn.CMD     npm: 11.1.0 - ~\.nvm\versions\node\v22.13.1\bin\npm.CMD   Browsers:     Chrome: 134.0.6998.118     Edge: Chromium (133.0.3065.82

- **Issue #512** (2025-03-16): **Jotai not working**
  *Symptoms*: ### Current Behavior  using Jotai throws error.  ``` Error rendering / on server Cannot read properties of null (reading 'useContext')                     TypeError: Cannot read properties of null (reading 'useContext')     at process.env.NODE_ENV.exports.useContext (/Users/ps/code/demo/apps/app/node_modules/react/cjs/react.development.js:1464:25)     at useStore (file:///Users/ps/code/demo/apps/app/node_modules/jotai/esm/react.mjs:9:17)     at useAtomValue (file:///Users/ps/code/demo/apps/app/node_modules/jotai/esm/react.mjs:96:17)     at useAtom (file:///Users/ps/code/demo/apps/app/node_modules/jotai/esm/react.mjs:153:5)     at AppShell (/Users/ps/code/demo/apps/app/src/interface/appShell/appShell.tsx:16:27) ```  ### Expected Behavior  should work without errors  ### One Version  ```markdown 1.1.459 ```  ### Platform (Web, iOS, Android)  ```markdown Web ```  ### Reproduction  ```markdown add the dependency using `bun add jotai`.  add the following code to one of the route.   export const helloAtom = atom('hello');  export function HomePage() {    const [hello] = useAtom(helloAtom);    return <>{hello}</>; }   versions:      "one": "1.1.459",     "jotai": "^2.12.1", ```  ### System Info  ```markdown  ```
  **Post-Mortem & Fix Analysis**:
  > Seeing this warning:  ``` Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons: 1. You might have mismatching versions of React and the renderer (such as React DOM) 2. You might be breaking the Rules of Hooks 3. You might have more than one copy of React in the same app See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem. ```  So the actual issue is duplicated React in SSR mode.  Adding this in `vite.config.ts` can resolve:  ```ts export default {   ssr: {     optimizeDeps: {       include: ['jotai'],     },     noExternal: ['jotai'],   }, // ... ```

- **Issue #506** (2026-01-07): **Naming Mismatch Causes 404 Errors for Dynamically Imported Modules**
  *Symptoms*: ### Current Behavior  After building the one web app client and serving it as static files, the web application functions, but the web console shows errors for every route or module preloading. The errors are as follows:  ``` GET https://myapp.dev/assets/_88132734_vxrn_loader.js net::ERR_ABORTED 404 (Not Found) Uncaught (in promise) TypeError: Failed to fetch dynamically imported module: https://myapp.dev/assets/_88132734_vxrn_loader.js ```  Upon debugging, I discovered that this issue is caused by a naming mismatch. The actual files generated by the build process end with `_preload.js`, but the application attempts to fetch files with the suffix `_vxrn_loader.js`.  This mismatch occurs in the constants defined in the [core code](https://github.com/onejs/one/blob/2a99dcd1d244844fc1dccd3ffcd18d37c61367f7/packages/one/src/constants.ts#L9-L14):  ```ts // this two should match export const LOADER_JS_POSTFIX_UNCACHED = `_vxrn_loader.js` export const PRELOAD_JS_POSTFIX = `_${CACHE_KEY}_preload.js` ```  As a result, the application fails to load the required modules, leading to runtime errors.  ### Expected Behavior  The suffixes used for dynamically imported module files should match. Specifically, the `LOADER_JS_POSTFIX_UNCACHED` constant should align with the `PRELOAD_JS_POSTFIX` constant so that the application correctly fetches the preloaded modules without causing 404 errors.  For example, if the build process generates files with the suffix `_preload.js`, the application shou

- **Issue #452** (2026-01-07): **React Native color scheme not changing when system theme changes**
  *Symptoms*: I made sure to set `expo.userInterfaceStyle = "automatic"`  Note: I'm doing my testing on iOS 18.1 simulator, and both debug and release schemes seem to be broken.  1. Clone the [reproduction repo](https://github.com/christianjuth/one-darkmode-not-chaning-with-system-bug) 2. `npm i --force` 3. `npm run prebuild:native` 4. Set scheme to release, build, and install on iOS 18.1 simulator 5. Launch the app. The color scheme should correctly read the system theme 6. Put the app in the background, but don't close it 7. Toggle the system theme 8. Put the app back in the foreground and see if it changed with the system 9. Repeat steps 6-8 a second time, as the theme seems to sometimes change one but not a second time  Note: I imagine 18.1 isn't the issue, but just wanted to mention that incase it's a factor.  Since `@vxrn/color-scheme` uses React Native `useColorScheme` under the hood, it also doesn't seem to work.
  **Post-Mortem & Fix Analysis**:
  > Is React Native useColorScheme broken?
  > @natew that's what it seems? It's working in Expo but not One. No idea how that's even possible

- **Issue #446** (2026-02-06): **SSR routes return 404 when layout present only in parent**
  *Symptoms*: I receive this error from the prod server:  ``` app serve: Server running on http://0.0.0.0:8080 app serve:  [one] Error handling request: TypeError: Cannot read properties of undefined (reading 'cleanPath') app serve:     at Object.handlePage (file:///workspaces/project/node_modules/one/dist/esm/server/oneServe.mjs:89:74) app serve:     at file:///workspaces/project/node_modules/one/dist/esm/createHandleRequest.mjs:82:112 app serve:     at runMiddlewares (file:///workspaces/project/node_modules/one/dist/esm/createHandleRequest.mjs:9:42) app serve:     at file:///workspaces/project/node_modules/one/dist/esm/createHandleRequest.mjs:82:44 app serve:     at file:///workspaces/project/node_modules/one/dist/esm/vite/resolveResponse.mjs:7:32 app serve:     at file:///workspaces/project/node_modules/one/dist/esm/vite/one-server-only.mjs:22:17 app serve:     at AsyncLocalStorage.run (node:async_hooks:346:14) app serve:     at runWithAsyncLocalContext (file:///workspaces/project/node_modules/one/dist/esm/vite/one-server-only.mjs:21:42) app serve:     at file:///workspaces/project/node_modules/one/dist/esm/vite/resolveResponse.mjs:5:5 app serve:     at new Promise (<anonymous>) ```  I'm using: - Bun (1.1.43) - Node (v20.18.1) - one (1.1.411) - SSR as the default render mode  My file structure is like this:  ``` app/     _layout.tsx     home/         _layout.tsx         index+ssg.tsx         search/             _layout.tsx             [query].tsx ``` The app-level _layout I've left ther
  **Post-Mortem & Fix Analysis**:
  > This issue may have been fixed in a more recent version. The current code at `oneServe.ts:191` uses optional chaining (`buildInfo?.cleanPath`) which should handle the undefined case gracefully.  Could you try upgrading to the latest version of One and see if the issue persists? If it does, please share: 1. Your current One version 2. Your full file structure (with all \_layout.tsx files) 3. The render mode of each route (SSR, SSG, SPA)  This will help us reproduce and fix any remaining issues.
  > should be fixed
  > Oh thanks for working on it; sorry I missed your comment from January!  I'll be starting another project with One soon and can give it a try then!

- **Issue #216** (2024-11-05): **Could not read from file: codegenNativeComponent' (when running example code)**
  *Symptoms*: Using node 21 and 22, tried with bun and npm.    I get the following errors in terminal: ``` (...)  🩹 Patching @expo/vector-icons  🩹 Patching @react-native-community/cli-config  🩹 Patching rollup  🩹 Patching react-dom      ➡ [tamagui] built config and components (109ms) [vite] connected. Cannot optimize dependency: @expo/cli, present in ssr 'optimizeDeps.include' ✘ [ERROR] Could not read from file: /Users/janek/Developer/temp/onestack-test/hello-world/node_modules/react-native-web/dist/cjs/index.js/Libraries/Utilities/codegenNativeComponent      node_modules/react-native-screens/lib/module/fabric/FullWindowOverlayNativeComponent.js:1:35:       1 │ import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';         ╵                                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  ✘ [ERROR] Could not read from file: /Users/janek/Developer/temp/onestack-test/hello-world/node_modules/react-native-web/dist/cjs/index.js/Libraries/Utilities/codegenNativeCommands      node_modules/react-native-screens/lib/module/fabric/SearchBarNativeComponent.js:3:34:       3 │ import codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';         ╵                                   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  Build failed with 2 errors: node_modules/react-native-screens/lib/module/fabric/FullWindowOverlayNativeComponent.js:1:35: ERROR: Could not r
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting. Can you send us your package.json to let us know what package versions you're using, also which template you're creating your app from?
  > Having this issue too, and seems it could be a regression between 1.1.325 (no issue) and 1.1.327 (reproducible by running `npm run dev` after installing Minimal Tamagui template)  EDIT: I can reproduce on 1.1.326 as well.
  > Just got this one mine as well -- got it one both the minimal tamagui and fullstack setups ``` {   "name": "newproject",   "version": "1.1.327",   "private": true,   "type": "module",   "scripts": {     "dev": "one dev",     "dev:clean": "one dev --clean",     "clean": "one clean",     "prebuild:native": "one prebuild",     "build:web": "one build",     "serve": "one serve",     "ios": "one run:ios",     "android": "one run:android",     "upgrade:tamagui": "$npm_execpath up '*tamagui*' '@tamagui/*'"   },   "installConfig": {     "hoistingLimits": "workspaces"   },   "dependencies": {     "@react-native-masked-view/masked-view": "^0.3.1",     "@tamagui/animations-moti": "^1.116.7",     "@tamagui/colors": "^1.116.7",     "@tamagui/image-next": "^1.116.7",     "@tamagui/lucide-icons": "^1.116.7",     "@tamagui/react-native-media-driver": "^1.116.7",     "@vxrn/color-scheme": "1.1.327",     "expo": "~51.0.28",     "expo-modules-core": "^1.12.24",     "one": "

- **Issue #201** (2024-12-17): **When building an API endpoint, the dist folder contains absolute path import**
  *Symptoms*: Context: I'm building for a node environment using bun.  When building a One app (via `bun build:web`) with an API endpoint that imports a `~/code` file that imports an external dependency (e.g. zod), the dist folder contains a reference to an absolute path of my local dev machine, making deployment of the dist/ folder untenable. (The target machine does not have `/home/duane/one-recommended/node_modules/...` in its filesystem, so it can't import the node_modules dep)  Repro: https://github.com/canadaduane/one-abs-path-issue  Repro steps: 1. Clone the repo, `bun install` 2. Prep docker containers via docker-compose and create a .env file with DATABASE_URL pointing there 3. Run `bun build:web` 4. Open the `dist/api/api/other.js` file and see something simliar to the following:  ```js import { z } from "/home/duane/tmp/one-recommended/node_modules/zod/lib/index.mjs"; const booleanSchema = z.object({   boolean: z.boolean() }); async function POST(request) {   const json = await request.json();   const parsed = booleanSchema.parse(json.value);   return new Response(JSON.stringify(parsed.boolean), {     status: 200,     headers: { "Content-Type": "application/json" }   }); } export {   POST }; ``` 
  **Post-Mortem & Fix Analysis**:
  > i believe this is fixed, tested it out locally and i can see it using relative imports now (we change api route building to never let external imports be a thing:  ![CleanShot 2024-12-17 at 09 05 27@2x](https://github.com/user-attachments/assets/4d392fef-1758-49e4-81a5-bd84a3d46d12) 

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

### Incident Patch 1: `17e60fd2` (2026-09-24)
**Commit Message**: revert agent commits that landed on main instead of v2-beta

reverts 12250c93b, 45ac8b6b2 and 547ad3d24. all three already live on v2-beta, which is where One work goes; main stays as it was.

Team-Machine-Session: r44972

**File**: `packages/native/codegen/emitControls.ts` (modified, +1/-1)
```diff
@@ -445,7 +445,7 @@ ${value ? '    model.onChange = { [weak self] value, count, revision in self?.on
       controller = OneNativeHostingController(rootView: ${measured ? `OneNativeMeasuredStandalone(content: ${name}Content(model: model), onHeight: { [weak self] height in self?.onHeight?(height) })` : `OneNativeStandalone(content: ${name}Content(model: model))`})
     }
     controller?.attach(to: self)
-    model.active = controller?.isAttached == true
+    model.active = controller?.parent != nil
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeAlertView.swift` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ private final class AlertModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeStandalone(content: AlertContent(model: model)))
     }
     controller?.attach(to: self)
-    model.active = controller?.isAttached == true
+    model.active = controller?.parent != nil
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeButtonView.swift` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ private final class ButtonModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeMeasuredStandalone(content: ButtonContent(model: model), onHeight: { [weak self] height in self?.onHeight?(height) }))
     }
     controller?.attach(to: self)
-    model.active = controller?.isAttached == true
+    model.active = controller?.parent != nil
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeColorPickerView.swift` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ private final class ColorPickerModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeMeasuredStandalone(content: ColorPickerContent(model: model), onHeight: { [weak self] height in self?.onHeight?(height) }))
     }
     controller?.attach(to: self)
-    model.active = controller?.isAttached == true
+    model.active = controller?.parent != nil
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeConfirmationDialogView.swift` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ private final class ConfirmationDialogModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeStandalone(content: ConfirmationDialogContent(model: model)))
     }
     controller?.attach(to: self)
-    model.active = controller?.isAttached == true
+    model.active = controller?.parent != nil
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeContentUnavailableViewView.swift` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ private final class ContentUnavailableViewModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeStandalone(content: ContentUnavailableViewContent(model: model)))
     }
     controller?.attach(to: self)
-    model.active = controller?.isAttached == true
+    model.active = controller?.parent != nil
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeDatePickerView.swift` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ private final class DatePickerModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeMeasuredStandalone(content: DatePickerContent(model: model), onHeight: { [weak self] height in self?.onHeight?(height) }))
     }
     controller?.attach(to: self)
-    model.active = controller?.isAttached == true
+    model.active = controller?.parent != nil
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeGaugeView.swift` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ private final class GaugeModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeMeasuredStandalone(content: GaugeContent(model: model), onHeight: { [weak self] height in self?.onHeight?(height) }))
     }
     controller?.attach(to: self)
-    model.active = controller?.isAttached == true
+    model.active = controller?.parent != nil
   }
   public func reset() {
     compositionParent = nil
```

---

### Incident Patch 2: `45ac8b6b` (2026-09-18)
**Commit Message**: fix(native): guard UIAction.subtitle behind iOS 16

UIAction.subtitle is iOS 16.0+, and VxrnNative's podspec declares iOS 15.1,
so xcode 27's swift compiler rejects the unguarded assignment outright:
"'subtitle' is only available in iOS 16.0 or newer". the line sits next to
a keepsMenuPresented assignment that already carries the same guard.

Team-Machine-Session: r37991

**File**: `packages/native/ios/Menu/MenuActionView.swift` (modified, +1/-1)
```diff
@@ -317,7 +317,7 @@ class MenuActionView: RCTView, MenuUpdatable {
     baseUiAction.image = image
     baseUiAction.attributes = attributes
     baseUiAction.state = _isOn == true ? .on : .off
-    if let subtitle = _subtitle { baseUiAction.subtitle = subtitle }
+    if #available(iOS 16.0, *) { if let subtitle = _subtitle { baseUiAction.subtitle = subtitle } }
     if let label = _discoverabilityLabel { baseUiAction.discoverabilityTitle = label }
     parentMenuUpdatable?.updateMenu()
   }
```

---

### Incident Patch 3: `12250c93` (2026-09-22)
**Commit Message**: fix(native): a hosted swiftui view under a tab bar controller attaches without containment

OneNativeHostingController parented every host to the nearest view
controller. when that controller is a UITabBarController (a host inside
the tab bar's own view, such as a react-native-screens bottom accessory)
the host becomes one of the tab controller's children, which uikit
reports as a tab, and react-native-screens casts each of them to a tab
screen: updateTabBarA11yIfNeeded aborts with an unrecognized selector.
v2-beta had redirected such a host to the selected tab instead, which
fails uikit's containment check (UIViewControllerHierarchyInconsistency),
so neither parent works.

the parent stays the nearest controller, and when that is a
UITabBarController the host is added as a plain subview with no parent.
callers that gated activation on a parent now ask isAttached, which is
what they meant.

RAN on the apple music demo, iphone 16 ios 27.0, from the v2-beta build:
both crashes gone, the tab accessory and stack toolbar items under
native tabs render, no hierarchy inconsistency in the sim log.

(cherry picked from commit 75fb7035ebf58eaea13fbb7b3ea79724d9a7d5df)

Team-Machine-Session: 

**File**: `packages/native/codegen/emitControls.ts` (modified, +1/-1)
```diff
@@ -445,7 +445,7 @@ ${value ? '    model.onChange = { [weak self] value, count, revision in self?.on
       controller = OneNativeHostingController(rootView: ${measured ? `OneNativeMeasuredStandalone(content: ${name}Content(model: model), onHeight: { [weak self] height in self?.onHeight?(height) })` : `OneNativeStandalone(content: ${name}Content(model: model))`})
     }
     controller?.attach(to: self)
-    model.active = controller?.parent != nil
+    model.active = controller?.isAttached == true
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeAlertView.swift` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ private final class AlertModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeStandalone(content: AlertContent(model: model)))
     }
     controller?.attach(to: self)
-    model.active = controller?.parent != nil
+    model.active = controller?.isAttached == true
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeButtonView.swift` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ private final class ButtonModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeMeasuredStandalone(content: ButtonContent(model: model), onHeight: { [weak self] height in self?.onHeight?(height) }))
     }
     controller?.attach(to: self)
-    model.active = controller?.parent != nil
+    model.active = controller?.isAttached == true
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeColorPickerView.swift` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ private final class ColorPickerModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeMeasuredStandalone(content: ColorPickerContent(model: model), onHeight: { [weak self] height in self?.onHeight?(height) }))
     }
     controller?.attach(to: self)
-    model.active = controller?.parent != nil
+    model.active = controller?.isAttached == true
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeConfirmationDialogView.swift` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ private final class ConfirmationDialogModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeStandalone(content: ConfirmationDialogContent(model: model)))
     }
     controller?.attach(to: self)
-    model.active = controller?.parent != nil
+    model.active = controller?.isAttached == true
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeContentUnavailableViewView.swift` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ private final class ContentUnavailableViewModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeStandalone(content: ContentUnavailableViewContent(model: model)))
     }
     controller?.attach(to: self)
-    model.active = controller?.parent != nil
+    model.active = controller?.isAttached == true
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeDatePickerView.swift` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ private final class DatePickerModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeMeasuredStandalone(content: DatePickerContent(model: model), onHeight: { [weak self] height in self?.onHeight?(height) }))
     }
     controller?.attach(to: self)
-    model.active = controller?.parent != nil
+    model.active = controller?.isAttached == true
   }
   public func reset() {
     compositionParent = nil
```

**File**: `packages/native/ios/Generated/OneNativeGaugeView.swift` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ private final class GaugeModel: ObservableObject {
       controller = OneNativeHostingController(rootView: OneNativeMeasuredStandalone(content: GaugeContent(model: model), onHeight: { [weak self] height in self?.onHeight?(height) }))
     }
     controller?.attach(to: self)
-    model.active = controller?.parent != nil
+    model.active = controller?.isAttached == true
   }
   public func reset() {
     compositionParent = nil
```

---

### Incident Patch 4: `547ad3d2` (2026-09-22)
**Commit Message**: fix(vite): the client tree-shake extension guard admits .json

the guard reads /\.(js|jsx|ts|tsx)/ with no anchor, and `.js` is a prefix of
`.json`, so a JSON module walks past a test written to admit only JS. inside,
the only remaining gate is /generateStaticParams|loader/ against the file's
text, and any JSON large enough to contain the word "loader" passes it. the
module then reaches parseSync as JavaScript and, in production, throws.

downstream this crashed a prod build on a 1.5MB generated icon catalog whose
material symbols include clock_loader_10 through clock_loader_80. the catalog
is not unusual; any sufficiently large JSON in the client graph does it.

WHAT ANCHORING STOPS ADMITTING, since that is the first question about
anchoring a regex. exactly two extensions change, both of which should never
have reached a JS parser:

  .json   was admitted, now skipped
  .jsonc  was admitted, now skipped

every extension the guard is meant to admit is unaffected, and .mjs, .cjs,
.mts and .cts are false under BOTH forms, so this neither widens nor narrows
them. that they were already excluded is a separate question and this change
deliberately does not touch it.

Team-Machine-Sessi

**File**: `packages/one/src/vite/plugins/clientTreeShakePlugin.ts` (modified, +4/-1)
```diff
@@ -32,7 +32,10 @@ export const clientTreeShakePlugin = (opts?: {
         if (runtime === 'vite' && this.environment?.name === 'ssr') {
           return
         }
-        if (!/\.(js|jsx|ts|tsx)/.test(extname(id))) {
+        // anchored: unanchored, `.json` matches the `js` alternative and a JSON
+        // module reaches the JS parser below, where a large enough one is
+        // certain to contain `loader` somewhere and fail the prod build.
+        if (!/\.(js|jsx|ts|tsx)$/.test(extname(id))) {
           return
         }
         if (/node_modules/.test(id)) {
```

---

### Incident Patch 5: `5ebeb01c` (2026-09-18)
**Commit Message**: fix(bun): pin bun 1.4.2

bun 1.4.0's --compile leaves a Mach-O whose signature no longer matches its
pages and macOS 27 kills it at launch. CI reads bun-version-file from
package.json, so packageManager moves with mise.toml and the workflows follow.

RAN: `bun install --frozen-lockfile --dry-run` under 1.4.2 exits 0.
Team-Machine-Session: r36885

**File**: `mise.toml` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 [tools]
-bun = "1.4.0"
+bun = "1.4.2"
 node = "24.3.0"
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
     "./examples/*",
     "./tests/*"
   ],
-  "packageManager": "bun@1.4.0",
+  "packageManager": "bun@1.4.2",
   "engines": {
     "node": "24.3.0",
     "npm": "10.8.3"
```

---

### Incident Patch 6: `5aaab1e0` (2026-09-15)
**Commit Message**: fix(native): raise ios deployment target to 26 for @vxrn/native consumers

Team-Machine-Session: p44444

**File**: `examples/testflight/app.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
         "expo-build-properties",
         {
           "ios": {
-            "deploymentTarget": "16.4",
+            "deploymentTarget": "26.0",
             "useFrameworks": "static",
             "ccacheEnabled": true
           }
```

**File**: `tests/rn-test-container/app.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
       "expo-build-properties",
       {
         "ios": {
-          "deploymentTarget": "16.4",
+          "deploymentTarget": "26.0",
           "ccacheEnabled": true,
           "buildReactNativeFromSource": true
         }
```

---

### Incident Patch 7: `1661fdc1` (2026-09-15)
**Commit Message**: fix(compiler): keep esm and import.meta when applying a user babel config in the vite and rolldown pipeline

babel-preset-expo, reached through one/babel-preset from an ejected babel.config,
rewrote project modules to commonjs and import.meta.hot to
globalThis.__ExpoImportMetaRegistry because transformBabel passed no caller.
transformBabel now declares a vxrn caller with static esm support, one/babel-preset
adds nothing under it since the pipeline already runs the One chain, and the
generated-config marker matches what one patch writes.

Team-Machine-Session: m14540
(cherry picked from commit 2cb30a4bd0d87b47eb47a7600d0793af0f131f49)

**File**: `packages/compiler/src/transformBabel.test.ts` (modified, +56/-14)
```diff
@@ -399,9 +399,12 @@ describe('findUserBabelConfig and user Babel config respect', () => {
     try {
       expect(findUserBabelConfig(projectRoot)).toBeNull()
 
-      // Created with @one-generated marker -> ignored
+      // written by `one patch` with the generated marker -> ignored
       const generatedFile = path.join(projectRoot, 'babel.config.js')
-      fs.writeFileSync(generatedFile, '// @one-generated\nmodule.exports = {}')
+      fs.writeFileSync(
+        generatedFile,
+        '// @one/generated bundler-config\nmodule.exports = {}'
+      )
       expect(findUserBabelConfig(projectRoot)).toBeNull()
 
       // Overwritten with user config -> detected
@@ -460,16 +463,37 @@ describe('findUserBabelConfig and user Babel config respect', () => {
     )
     try {
       const code = '/* remove me */ export const x = 1'
+      const res = await transformBabel(path.join(projectRoot, 'src', 'index.ts'), code, {
+        configFile: userConfig,
+        babelrc: true,
+      })
+      expect(res.code).not.toContain('remove me')
+      expect(res.code).toContain('export const x = 1')
+    } finally {
+      fs.rmSync(projectRoot, { recursive: true, force: true })
+    }
+  })
+
+  it('tells user babel config it runs in a bundler that keeps static esm', async () => {
+    const projectRoot = fs.realpathSync(
+      fs.mkdtempSync(path.join(os.tmpdir(), 'vxrn-babel-conf-'))
+    )
+    const userConfig = path.join(projectRoot, 'babel.config.js')
+    // presets such as babel-preset-expo read this caller to decide whether to
+    // rewrite esm to commonjs and import.meta to a metro runtime global
+    fs.writeFileSync(
+      userConfig,
+      `module.exports = (api) => ({
+        comments: !api.caller((c) => c?.name === 'vxrn' && c?.supportsStaticESM === true),
+      })`
+    )
+    try {
       const res = await transformBabel(
         path.join(projectRoot, 'src', 'index.ts'),
-        code,
-        {
-          configFile: userConfig,
-          babelrc: true,
-        }
+        '/* remove me */ export const x = 1',
+        { configFile: userConfig, babelrc: true }
       )
       expect(res.code).not.toContain('remove me')
-      expect(res.code).toContain('export const x = 1')
     } finally {
       fs.rmSync(projectRoot, { recursive: true, force: true })
     }
@@ -523,7 +547,10 @@ describe('explicit swc/oxc per-file choice with a user babel config', () => {
       path.join(projectRoot, 'babel.config.js'),
       'module.exports = { plugins: [] }'
     )
-    configureVXRNCompilerPlugin({ enableCompiler: false, enableReanimated: false })
+    configureVXRNCompilerPlugin({
+      enableCompiler: false,
+      enableReanimated: false,
+    })
     try {
       const plugins = await createVXRNCompilerPlugin({
         transform: () => ({ transform: 'swc' }) as any,
@@ -534,7 +561,10 @@ describe('explicit swc/oxc per-file choice with a user babel config', () => {
       const result = await hook.call({ environment: { name: 'client' } }, code, file)
       expect(result == null).toBe(true)
     } finally {
-      configureVXRNCompilerPlugin({ enableCompiler: false, enableReanimated: false })
+      configureVXRNCompilerPlugin({
+        enableCompiler: false,
+        enableReanimated: false,
+      })
       fs.rmSync(projectRoot, { recursive: true, force: true })
     }
   })
@@ -556,7 +586,10 @@ describe('user babel config end-to-end through the compiler plugin', () => {
       path.join(projectRoot, 'babel.config.json'),
       JSON.stringify({ comments: false })
     )
-    configureVXRNCompilerPlugin({ enableCompiler: false, enableReanimated: false })
+    configureVXRNCompilerPlugin({
+      enableCompiler: false,
+      enableReanimated: false,
+    })
     try {
       const plugins = await createVXRNCompilerPlugin()
       const plugin = plugins.find((p: any) => p.name === 'one:compiler') as any
@@ -569,7 +602,10 @@ describe('user babel config end-to-end through the compiler plugin', () => {
       expect(result.code).toContain('export const x = 1')
       expect(result.code).not.toContain(marker)
     } finally {
-      configureVXRNCompilerPlugin({ enableCompiler: false, enableReanimated: false })
+      configureVXRNCompilerPlugin({
+        enableCompiler: false,
+        enableReanimated: false,
+      })
       fs.rmSync(projectRoot, { recursive: true, force: true })
     }
   })
@@ -586,7 +622,10 @@ describe('user babel config end-to-end through the compiler plugin', () => {
     const code = `/* ${marker} */ export const x = 1`
     fs.writeFileSync(file, code)
     const userConfig = path.join(projectRoot, 'babel.config.json')
-    configureVXRNCompilerPlugin({ enableCompiler: false, enableReanimated: false })
+    configureVXRNCompilerPlugin({
+      enableCompiler: false,
+      enableReanimated: false,
+    })
     try {
       const plugins = await createVXRNCompilerPlugin({
         transform: () => 'babel' as const,
@@ -609,7 +648,10 @@ describe('user babel config en
```

**File**: `packages/compiler/src/transformBabel.ts` (modified, +16/-11)
```diff
@@ -24,7 +24,8 @@ const USER_BABEL_CONFIG_FILES = [
   '.babelrc.json',
 ] as const
 
-const ONE_GENERATED_MARKER = '@one-generated'
+// matches ONE_GENERATED_MARKER in one/src/cli/generateBundlerConfig.ts
+const ONE_GENERATED_MARKER = '@one/generated bundler-config'
 
 export function findUserBabelConfig(projectRoot?: string): string | null {
   if (!projectRoot) return null
@@ -54,9 +55,7 @@ export function getBabelOptions(props: Props): babel.TransformOptions | null {
 
   const isProjectFile = !props.id.includes('node_modules')
   const userBabelConfig =
-    isProjectFile && props.projectRoot
-      ? findUserBabelConfig(props.projectRoot)
-      : null
+    isProjectFile && props.projectRoot ? findUserBabelConfig(props.projectRoot) : null
 
   if (props.userSetting === 'babel') {
     return getOptions(props, true, userBabelConfig)
@@ -68,9 +67,7 @@ export function getBabelOptions(props: Props): babel.TransformOptions | null {
     if (props.userSetting?.excludeDefaultPlugins) {
       return {
         ...props.userSetting,
-        ...(userBabelConfig
-          ? { configFile: userBabelConfig, babelrc: true }
-          : {}),
+        ...(userBabelConfig ? { configFile: userBabelConfig, babelrc: true } : {}),
       }
     }
     return getOptions(props, false, userBabelConfig)
@@ -138,9 +135,7 @@ const getOptions = (
   if (plugins.length || userBabelConfig) {
     return {
       plugins,
-      ...(userBabelConfig
-        ? { configFile: userBabelConfig, babelrc: true }
-        : {}),
+      ...(userBabelConfig ? { configFile: userBabelConfig, babelrc: true } : {}),
     }
   }
 
@@ -200,7 +195,10 @@ export async function transformOxcReactCompiler(
     )
   }
 
-  return { code: result.code, map: sourceMap ? (result.map as any) : undefined }
+  return {
+    code: result.code,
+    map: sourceMap ? (result.map as any) : undefined,
+  }
 }
 
 /**
@@ -226,6 +224,13 @@ export async function transformBabel(
     sourceMaps: false,
     minified: false,
     ...options,
+    // vite and rolldown own module syntax and import.meta, so presets written for
+    // metro (babel-preset-expo) must keep esm instead of rewriting it for metro's runtime
+    caller: {
+      name: 'vxrn',
+      supportsStaticESM: true,
+      supportsDynamicImport: true,
+    },
     presets: [
       isTS
         ? [
```

**File**: `packages/one/src/babel-preset/index.test.ts` (modified, +13/-0)
```diff
@@ -86,6 +86,19 @@ describe('one/babel-preset', () => {
 
     expect(result.plugins).toEqual([])
   })
+
+  it('adds nothing when @vxrn/compiler applies it inside the vite and rolldown pipeline', () => {
+    const result = oneBabelPreset(
+      {
+        cache: () => {},
+        cwd: () => projectRoot,
+        caller: <T>(cb: (caller: unknown) => T): T => cb({ name: 'vxrn' }),
+      },
+      { projectRoot }
+    )
+
+    expect(result).toEqual({ presets: [], plugins: [] })
+  })
 })
 
 describe('buildOneBabelPlugins', () => {
```

**File**: `packages/one/src/babel-preset/index.ts` (modified, +13/-1)
```diff
@@ -70,6 +70,16 @@ export default function oneBabelPreset(
       ? api.caller((caller) => !!(caller as any)?.oneViteMetroBabelConfig)
       : false
 
+  // @vxrn/compiler applies a user babel config inside the vite and rolldown
+  // pipeline, which already runs the One chain and handles what babel-preset-expo does for metro
+  const isVxrnCompiler =
+    typeof api?.caller === 'function'
+      ? api.caller((caller) => (caller as { name?: string } | undefined)?.name === 'vxrn')
+      : false
+  if (isVxrnCompiler) {
+    return { presets: [], plugins: [] }
+  }
+
   if (!api?.caller && typeof api?.cache === 'function') {
     api.cache(true)
   }
@@ -136,7 +146,9 @@ export function buildOneBabelPlugins({
   }
 
   const require = module.createRequire(projectRoot + '/')
-  const metroEntryPath = require.resolve('one/metro-entry', { paths: [projectRoot] })
+  const metroEntryPath = require.resolve('one/metro-entry', {
+    paths: [projectRoot],
+  })
 
   const setupFileRelativeToMetroEntry = (() => {
     if (!setupFile) return undefined
```

**File**: `packages/vite-plugin-metro/src/transformer/metroNativeWorker.test.ts` (modified, +20/-18)
```diff
@@ -246,7 +246,9 @@ describe('metroNativeWorker', () => {
       off.find((d) => d.name === 'react-native-worklets-core')!.data.isOptional
     ).toBeUndefined()
 
-    const on = extractDependencies(code, 'setup.js', { allowOptionalDependencies: true })
+    const on = extractDependencies(code, 'setup.js', {
+      allowOptionalDependencies: true,
+    })
     expect(on.find((d) => d.name === 'react-native-worklets-core')!.data.isOptional).toBe(
       true
     )
@@ -567,9 +569,12 @@ describe('metroNativeWorker', () => {
       const config1 = await buildMetroConfigInputFromViteConfig(mockViteConfig, {})
       expect(config1.defaultConfig.transformerPath).toContain('metroNativeWorker')
 
-      // Generated @one-generated config is ignored, still uses metroNativeWorker
+      // a config written by `one patch` is ignored, still uses metroNativeWorker
       const babelConfigPath = path.join(tempDir, 'babel.config.js')
-      fs.writeFileSync(babelConfigPath, '// @one-generated\nmodule.exports = {}')
+      fs.writeFileSync(
+        babelConfigPath,
+        '// @one/generated bundler-config\nmodule.exports = {}'
+      )
       const config2 = await buildMetroConfigInputFromViteConfig(mockViteConfig, {})
       expect(config2.defaultConfig.transformerPath).toContain('metroNativeWorker')
 
@@ -606,9 +611,7 @@ describe('metroNativeWorker', () => {
       delete process.env.ONE_METRO_NATIVE_TRANSFORMS
       const mockViteConfig = { root: tempDir } as any
       const warnsWithConfig = (spy: any) =>
-        spy.mock.calls.some((args: any[]) =>
-          args.join(' ').includes(babelConfigPath)
-        )
+        spy.mock.calls.some((args: any[]) => args.join(' ').includes(babelConfigPath))
 
       // explicit option force still uses the worker, but names the dropped config
       const optionWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
@@ -638,9 +641,7 @@ describe('metroNativeWorker', () => {
       const respectedWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
       try {
         const respected = await buildMetroConfigInputFromViteConfig(mockViteConfig, {})
-        expect(respected.defaultConfig.transformerPath).not.toContain(
-          'metroNativeWorker'
-        )
+        expect(respected.defaultConfig.transformerPath).not.toContain('metroNativeWorker')
         expect(warnsWithConfig(respectedWarn)).toBe(false)
       } finally {
         respectedWarn.mockRestore()
@@ -669,10 +670,7 @@ describe('metroNativeWorker', () => {
       // user config: both builders fall back to the babel transformer
       const babelConfigPath = path.join(tempDir, 'babel.config.js')
       fs.writeFileSync(babelConfigPath, 'module.exports = { plugins: [] }')
-      const fallbackInput = await buildMetroConfigInputFromViteConfig(
-        mockViteConfig,
-        {}
-      )
+      const fallbackInput = await buildMetroConfigInputFromViteConfig(mockViteConfig, {})
       const fallbackFull = await getMetroConfigFromViteConfig(mockViteConfig, {})
       expect(fallbackInput.defaultConfig.transformerPath).not.toContain(
         'metroNativeWorker'
@@ -688,9 +686,7 @@ describe('metroNativeWorker', () => {
         const forcedFull = await getMetroConfigFromViteConfig(mockViteConfig, {
           nativeTransforms: true,
         })
-        expect(forcedInput.defaultConfig.transformerPath).toContain(
-          'metroNativeWorker'
-        )
+        expect(forcedInput.defaultConfig.transformerPath).toContain('metroNativeWorker')
         expect((forcedFull as any).transformerPath).toContain('metroNativeWorker')
         expect(
           forcedWarn.mock.calls.some((args: any[]) =>
@@ -1321,7 +1317,11 @@ describe('one native transform ports', () => {
   it('inlines import.meta.env reads, which oxc otherwise lowers to an empty object', () => {
     // oxc's CJS lowering emits `var import_meta = {}`, so an untouched
     // `import.meta.env.X` silently reads undefined in every native bundle.
-    const env = { DEV: false, VITE_POSTHOG_API_KEY: 'pk_live', TAMAGUI_TARGET: 'native' }
+    const env = {
+      DEV: false,
+      VITE_POSTHOG_API_KEY: 'pk_live',
+      TAMAGUI_TARGET: 'native',
+    }
     const out = applyInlineEnvVars(
       `export const key = import.meta.env.VITE_POSTHOG_API_KEY;
 export const target = import.meta.env?.TAMAGUI_TARGET;
@@ -1416,7 +1416,9 @@ export const all = { ...import.meta.env };`,
     // takeout adds `hot-updater/babel-plugin` for OTA; dropping it silently
     // would ship a build whose updates never apply.
     const withPlugins = (plugins: any[]) =>
-      ({ customTransformOptions: { vite: { babelConfig: { plugins } } } }) as any
+      ({
+        customTransformOptions: { vite: { babelConfig: { plugins } } },
+      }) as any
 
     expect(() =>
       assertNoUnportedBabelPlugins(
```

---

### Incident Patch 8: `993673ad` (2026-09-15)
**Commit Message**: fix(native): build against react native 0.87 deep import types

Team-Machine-Session: p44444

**File**: `packages/native/tsconfig.json` (modified, +2/-1)
```diff
@@ -4,7 +4,8 @@
   "exclude": ["dist", "types", "tests"],
   "compilerOptions": {
     "composite": true,
-    "rootDir": "src"
+    "rootDir": "src",
+    "customConditions": ["react-native-legacy-deep-imports"]
   },
   "references": [
     {
```

**File**: `packages/one/src/getDevServer.native.ts` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 // Isolated to suppress deprecation warning for deep import
 // React Native 0.81+ discourages deep imports but doesn't provide official alternative yet
+// @ts-ignore
 import getDevServerDefault from 'react-native/Libraries/Core/Devtools/getDevServer'
 
 // handle CJS/ESM interop — Metro may wrap the default export in a module object
```

**File**: `packages/vite-native-client/src/client.ts` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 // import '@vite/env'
+// @ts-ignore
 import getDevServer from 'react-native/Libraries/Core/Devtools/getDevServer'
 import type { InferCustomEventPayload } from './customEvent'
 import type { ErrorPayload, HMRPayload, Update } from './hmrPayload'
```

---

### Incident Patch 9: `a77699f9` (2026-09-14)
**Commit Message**: feat(native): add SwiftUI controls and containers

Team-Machine-Session: p42493

**File**: `packages/native/README.md` (modified, +100/-1)
```diff
@@ -341,6 +341,11 @@ to true.
 `step` numbers. `minimumValue` must be less than `maximumValue`, `step` must be
 greater than 0, and `value` must sit in that range. Defaults are 0, 100, and 1.
 
+`Slider` takes text at each end of the track with `minimumValueLabel` and
+`maximumValueLabel`, and SF Symbol names there with `minimumValueImage` and
+`maximumValueImage`. An image wins over a label on the same side. A slider that
+sets none of the four keeps SwiftUI's label-free slider.
+
 Every control also accepts `label`, `disabled`, and `revision`.
 
 ## Buttons, indicators, and text input
@@ -408,7 +413,10 @@ is `destructive`, `cancel`, `confirm`, `close`, or empty for none; it is named
 `buttonRole` because React Native's `ViewProps` already owns `role` for the
 accessibility role. `buttonStyle` is `automatic`, `plain`, `borderless`,
 `bordered`, `borderedProminent`, `glass`, or `glassProminent`. `onPress` does
-not fire while `disabled`.
+not fire while `disabled`. `disclosureIndicator` shapes the button as the row iOS uses
+for something that opens: the label, a `Spacer`, and a trailing secondary chevron,
+filling the width the button is given. It is what makes a `Button` inside a `Swift.Form`
+read as "Change flight >".
 
 `ProgressView` shows determinate progress when `value` is set and an
 indeterminate spinner when it is omitted. `total` defaults to 1 and must be
@@ -787,6 +795,10 @@ no height of its own.
 and `alignment` (`leading`, `center`, `trailing`) is the cross axis, so it places
 children horizontally down a column and vertically across a row.
 
+`Swift.HStack` and `Swift.VStack` are that host with the axis fixed, so a row is
+`<Swift.HStack spacing={8} alignment="center">` and a column is
+`<Swift.VStack spacing={8} alignment="leading">`. Neither takes an `axis`.
+
 A composed child is still its own Fabric component, so its props, events, enum
 validation and controlled state work exactly as they do standalone. What changes is
 where it renders: the host publishes each child's SwiftUI content into its own tree and
@@ -822,6 +834,37 @@ ideal height. That is SwiftUI's layout for content that does not fit, not a
 measurement error, but it means a horizontal host wants few children or explicit
 widths.
 
+### Overlays and spacers
+
+`Swift.ZStack` lays its children over one another instead of in a line, and sizes itself
+to the largest of them. `alignment` says where the smaller ones sit: `center` by
+default, or `topLeading`, `top`, `topTrailing`, `leading`, `trailing`, `bottomLeading`,
+`bottom`, `bottomTrailing`.
+
+```tsx
+<Swift.ZStack alignment="bottomTrailing">
+  <Swift.Image systemName="photo" />
+  <Swift.Label label="Draft" systemImage="pencil" />
+</Swift.ZStack>
+```
+
+Like a host, a ZStack reports the height SwiftUI measured back to Yoga, so it works
+standalone or composed into a form, a section, a stack, or another ZStack.
+
+`Swift.Spacer` takes the free space its stack offers, which pushes its siblings apart.
+It has to be inside a container, and it only has space to take where the stack is given
+more than its content asks for: across a `Swift.HStack` that is the width of the row,
+while a vertical stack reports its own ideal height and leaves a spacer at `minLength`,
+0 by default.
+
+```tsx
+<Swift.HStack>
+  <Swift.Label label="Change flight" systemImage="airplane" />
+  <Swift.Spacer />
+  <Swift.Button label="Edit" onPress={edit} />
+</Swift.HStack>
+```
+
 ### Forms and sections
 
 `Swift.Form` is a SwiftUI `Form` and `Swift.Section` is a section inside one. They
@@ -843,6 +886,28 @@ describes the SwiftUI tree.
 
 An empty `title` or `footer` omits that header or footer.
 
+### Labeled content
+
+`Swift.LabeledContent` is the key-value row a form, a section, or a host holds. The
+`label` names the row and is required. The content is either a `value` string or
+composed children, never both, and one of the two is required.
+
+```tsx
+<Swift.Form style={{ flex: 1 }}>
+  <Swift.Section title="Trip">
+    <Swift.LabeledContent label="Destination" value="Lisbon, Portugal" systemImage="airplane" />
+    <Swift.LabeledContent label="Per night">
+      <Swift.Text text="$410" swiftStyle={{ fontWeight: 'bold' }} />
+    </Swift.LabeledContent>
+  </Swift.Section>
+</Swift.Form>
+```
+
+`systemImage` adds an SF Symbol beside the label. A row with neither a value nor
+children throws where it is written. Compose a row out of controls rather than a plain
+`View`: the children are One Native controls, and React Native content goes in a
+`Swift.Slot`.
+
 A `Form` is height-greedy and reports no ideal height, so it fills the box React Native
 gives it: give it a height or a flex parent. That is also why a `Form` cannot be a child
 of a `Swift.Host`. A host measures what it holds, SwiftUI answers zero for a form, and
@@ -874,6 +939,40 @@ Inside the slot everything works as it does anywhere else in React Native: touch
 state, providers, and layout. A slot has to be a child of a container,
```

**File**: `packages/native/codegen/catalog.ts` (modified, +11/-0)
```diff
@@ -150,6 +150,9 @@ export type StyleFieldKind = 'number' | 'string' | 'color'
 export interface StyleField {
   name: string
   kind: StyleFieldKind
+  // the accepted values of a string field. the generated TypeScript alias and the Swift
+  // resolver are built from this one list, so a value cannot exist in one and not the other.
+  values?: readonly string[]
 }
 
 export const styleFields: readonly StyleField[] = [
@@ -177,6 +180,14 @@ export const styleFields: readonly StyleField[] = [
   { name: 'opacity', kind: 'number' },
   { name: 'borderColor', kind: 'color' },
   { name: 'borderWidth', kind: 'number' },
+  // liquid glass and the material surfaces underneath it. these names are the wire values
+  // Swift.Glass takes too, so a glass surface reads the same in a style and in a container.
+  { name: 'glassEffect', kind: 'string', values: ['regular', 'clear', 'interactive'] },
+  {
+    name: 'material',
+    kind: 'string',
+    values: ['ultraThin', 'thin', 'regular', 'thick', 'ultraThick'],
+  },
 ] as const
 export const enumTypes = [
   'MenuOrder',
```

**File**: `packages/native/codegen/emitContainers.ts` (modified, +94/-5)
```diff
@@ -12,7 +12,7 @@ const environmentProps = {
   colorScheme: 'string',
   dynamicTypeSize: 'string',
   locale: 'string',
-  tint: 'ColorValue',
+  tint: 'ColorValue?',
   isEnabled: 'string',
 } as const
 
@@ -44,6 +44,28 @@ export const containerComponents = [
     // the measured height needs a hand-written shadow node, state and descriptor.
     interfaceOnly: true,
   },
+  {
+    name: 'OneNativeZStack',
+    publicName: 'ZStack',
+    props: { alignment: 'string' },
+    events: {},
+    enumProps: {},
+    layout: { kind: 'measured' },
+    slots: [composedContent],
+    // the measured height needs a hand-written shadow node, state and descriptor.
+    interfaceOnly: true,
+  },
+  {
+    name: 'OneNativeSpacer',
+    publicName: 'Spacer',
+    props: { minLength: 'Double' },
+    events: {},
+    enumProps: {},
+    layout: { kind: 'container' },
+    // a spacer holds nothing; it takes the free space its parent stack offers.
+    slots: [],
+    interfaceOnly: false,
+  },
   {
     name: 'OneNativeForm',
     publicName: 'Form',
@@ -64,6 +86,34 @@ export const containerComponents = [
     slots: [composedContent],
     interfaceOnly: false,
   },
+  {
+    name: 'OneNativeLabeledContent',
+    publicName: 'LabeledContent',
+    props: { label: 'string', value: 'string', systemImage: 'string' },
+    events: {},
+    enumProps: {},
+    // a row has an ideal height SwiftUI knows, so standalone it measures like a host.
+    layout: { kind: 'measured' },
+    slots: [composedContent],
+    // the measured height needs a hand-written shadow node, state and descriptor.
+    interfaceOnly: true,
+  },
+  {
+    name: 'OneNativeGlass',
+    publicName: 'Glass',
+    // a glass surface takes the box React Native gave it.
+    props: {
+      material: 'string?',
+      glassEffect: 'string?',
+      cornerRadius: 'Double?',
+      tint: 'ColorValue?',
+    },
+    events: {},
+    enumProps: {},
+    layout: { kind: 'container' },
+    slots: [composedContent],
+    interfaceOnly: false,
+  },
   {
     name: 'OneNativeContainerSlot',
     publicName: 'Slot',
@@ -86,21 +136,36 @@ export const containerComponents = [
 
 export const hostAxes = ['vertical', 'horizontal'] as const
 export const hostAlignments = ['leading', 'center', 'trailing'] as const
+export const zStackAlignments = [
+  'topLeading',
+  'top',
+  'topTrailing',
+  'leading',
+  'center',
+  'trailing',
+  'bottomLeading',
+  'bottom',
+  'bottomTrailing',
+] as const
 
 export function emitContainers(header: string, outputs: Map<string, string>) {
   for (const component of containerComponents) {
-    const props = Object.entries(component.props)
+    const props = Object.entries(component.props).map(([key, declared]) => ({
+      key,
+      optional: declared.endsWith('?'),
+      type: declared.replace('?', ''),
+    }))
     const reactNativeTypes = [
-      ...(props.some(([, type]) => type === 'ColorValue') ? ['ColorValue'] : []),
+      ...(props.some(({ type }) => type === 'ColorValue') ? ['ColorValue'] : []),
       'ViewProps',
     ]
     outputs.set(
       `src/specs/${component.name}NativeComponent.ts`,
       header +
         `import type { ${reactNativeTypes.join(', ')} } from 'react-native'
-${props.some(([, type]) => type === 'Double') ? `import type { Double } from 'react-native/Libraries/Types/CodegenTypes'\n` : ''}import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent'
+${props.some(({ type }) => type === 'Double') ? `import type { Double } from 'react-native/Libraries/Types/CodegenTypes'\n` : ''}import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent'
 interface NativeProps extends ViewProps {
-${props.map(([key, type]) => `  ${key}${key === 'tint' ? '?' : ''}: ${type}`).join('\n')}
+${props.map(({ key, optional, type }) => `  ${key}${optional ? '?' : ''}: ${type}`).join('\n')}
 }
 export default codegenNativeComponent<NativeProps>('${component.name}'${component.interfaceOnly ? ', { interfaceOnly: true }' : ''})
 `
@@ -111,9 +176,11 @@ export default codegenNativeComponent<NativeProps>('${component.name}'${componen
     header +
       `import type { ReactNode } from 'react'
 import type { ColorValue, ViewProps } from 'react-native'
+import type { GlassEffect, Material } from './controlTypes'
 import type { ColorScheme, DynamicTypeSize } from './swiftui'
 export type HostAxis = ${hostAxes.map((axis) => JSON.stringify(axis)).join(' | ')}
 export type HostAlignment = ${hostAlignments.map((value) => JSON.stringify(value)).join(' | ')}
+export type ZStackAlignment = ${zStackAlignments.map((value) => JSON.stringify(value)).join(' | ')}
 export interface EnvironmentProps {
   colorScheme?: ColorScheme
   dynamicTypeSize?: DynamicTypeSize
@@ -127,6 +194,14 @@ export interface HostProps extends ViewProps, EnvironmentProps {
   alignment?: HostAlignment
   children: ReactNode
 }
+export type StackProps = Omit<HostProps, 'axis'>
+export interface ZSta
```

**File**: `packages/native/codegen/emitControls.ts` (modified, +20/-2)
```diff
@@ -1,5 +1,6 @@
 import { controls } from './controlCatalog'
 import { styleFields } from './catalog'
+import type { StyleField } from './catalog'
 import type { Control, ControlField, ScalarType } from './controlTypes'
 
 const swiftScalar = (type: ScalarType) =>
@@ -23,6 +24,18 @@ const lower = (name: string) => name[0].toLowerCase() + name.slice(1)
 const upper = (name: string) => name[0].toUpperCase() + name.slice(1)
 // an enum field defaulting to the empty string means unset; the Swift helper passes self through.
 const optionalEnum = (field: ControlField) => Boolean(field.enum) && field.default === ''
+// a style field that lists its values gets a named alias, so Swift.Glass can take the same
+// names swiftStyle does. the spec keeps the plain string: React Native's codegen would turn
+// a literal union into a C++ enum, and the Objective-C side reads a string.
+const styleAlias = (field: StyleField) => upper(field.name)
+const styleFieldType = (field: StyleField) =>
+  field.kind === 'number'
+    ? 'number'
+    : field.kind === 'color'
+      ? 'ColorValue'
+      : field.values
+        ? styleAlias(field)
+        : 'string'
 
 export function emitControls(header: string, outputs: Map<string, string>) {
   if (!controls.length) return
@@ -46,13 +59,18 @@ export function emitControls(header: string, outputs: Map<string, string>) {
 import type * as Styles from './swiftui'
 import type { KeyboardType, TextContentType } from '../textTypes'
 
-export interface OneNativeStyle {
 ${styleFields
+  .filter((field) => field.values)
   .map(
     (field) =>
-      `  ${field.name}?: ${field.kind === 'number' ? 'number' : field.kind === 'color' ? 'ColorValue' : 'string'}`
+      `export type ${styleAlias(field)} = ${field.values!.map((value) => JSON.stringify(value)).join(' | ')}`
   )
   .join('\n')}
+
+export interface OneNativeStyle {
+${styleFields
+  .map((field) => `  ${field.name}?: ${styleFieldType(field)}`)
+  .join('\n')}
 }
 
 // the React Native props a One Native control honors. a composed control renders inside its
```

**File**: `packages/native/codegen/emitStyle.ts` (modified, +1/-0)
```diff
@@ -52,6 +52,7 @@ extension View {
       .oneNativePadding(style)
       .oneNativeFrame(style)
       .oneNativeBackground(style.background)
+      .oneNativeGlassEffect(style)
       .oneNativeCornerRadius(style.cornerRadius)
       .oneNativeOpacity(style.opacity)
       .oneNativeBorder(color: style.borderColor, width: style.borderWidth)
```

**File**: `packages/native/codegen/formCatalog.ts` (modified, +44/-6)
```diff
@@ -34,6 +34,10 @@ export const formControls: Control[] = [
       minimumValue: { type: 'Double', default: 0 },
       maximumValue: { type: 'Double', default: 100 },
       step: { type: 'Double', default: 1 },
+      minimumValueLabel: { type: 'string', default: '' },
+      maximumValueLabel: { type: 'string', default: '' },
+      minimumValueImage: { type: 'string', default: '' },
+      maximumValueImage: { type: 'string', default: '' },
     },
     constructors: [
       {
@@ -46,13 +50,47 @@ export const formControls: Control[] = [
           { label: 'onEditingChanged', type: '@escaping (Swift.Bool) -> Swift.Void' },
         ],
       },
+      {
+        type: 'Slider',
+        parameters: [
+          { label: 'value', type: 'SwiftUICore.Binding<V>' },
+          { label: 'in', type: 'Swift.ClosedRange<V>' },
+          { label: 'step', type: 'V.Stride' },
+          { label: 'label', type: '() -> Label' },
+          { label: 'minimumValueLabel', type: '() -> ValueLabel' },
+          { label: 'maximumValueLabel', type: '() -> ValueLabel' },
+          { label: 'onEditingChanged', type: '@escaping (Swift.Bool) -> Swift.Void' },
+        ],
+      },
     ],
-    swift: `Slider(value: Binding(
-        get: { model.controlled.value },
-        set: { value in model.change(value) }
-      ), in: model.minimumValue...model.maximumValue, step: model.step) {
-        Text(model.label)
-      } onEditingChanged: { _ in }`,
+    // a slider that sets none of the four value labels keeps the SDK's no-value-label
+    // initializer, so every slider written before these props existed renders unchanged.
+    swift: `Group {
+        if model.minimumValueImage.isEmpty, model.minimumValueLabel.isEmpty,
+          model.maximumValueImage.isEmpty, model.maximumValueLabel.isEmpty {
+          Slider(value: oneNativeSliderBinding(model), in: model.minimumValue...model.maximumValue, step: model.step) {
+            Text(model.label)
+          } onEditingChanged: { _ in }
+        } else {
+          Slider(value: oneNativeSliderBinding(model), in: model.minimumValue...model.maximumValue, step: model.step) {
+            Text(model.label)
+          } minimumValueLabel: {
+            oneNativeSliderValueLabel(image: model.minimumValueImage, label: model.minimumValueLabel)
+          } maximumValueLabel: {
+            oneNativeSliderValueLabel(image: model.maximumValueImage, label: model.maximumValueLabel)
+          } onEditingChanged: { _ in }
+        }
+      }`,
+    extraSwift: `private func oneNativeSliderBinding(_ model: SliderModel) -> Binding<Double> {
+  Binding(get: { model.controlled.value }, set: { value in model.change(value) })
+}
+
+// an image wins over a label on the same side; neither one set draws nothing there.
+@ViewBuilder private func oneNativeSliderValueLabel(image: String, label: String) -> some View {
+  if !image.isEmpty { Image(systemName: image) }
+  else if !label.isEmpty { Text(label) }
+  else { EmptyView() }
+}`,
     validate: `  if (![value, minimumValue, maximumValue, step].every(Number.isFinite)) throw new Error('Slider value, minimumValue, maximumValue, and step must be finite numbers')
   if (minimumValue >= maximumValue) throw new Error('Slider minimumValue must be less than maximumValue')
   if (step <= 0) throw new Error('Slider step must be greater than 0')
```

**File**: `packages/native/codegen/generate.ts` (modified, +4/-4)
```diff
@@ -283,10 +283,10 @@ outputs.set(
           name: component.name,
           publicName: component.publicName,
           props: Object.fromEntries(
-            Object.entries(component.props).map(([key, type]) => [
-              key,
-              enumProps[key] ? { type, enum: enumProps[key] } : { type },
-            ])
+            Object.entries(component.props).map(([key, declared]) => {
+              const type = declared.replace('?', '')
+              return [key, enumProps[key] ? { type, enum: enumProps[key] } : { type }]
+            })
           ),
           events: Object.fromEntries(
             Object.entries(component.events).map(([key, payload]) => [
```

**File**: `packages/native/codegen/leafCatalog.ts` (modified, +18/-3)
```diff
@@ -49,6 +49,9 @@ export const leafControls: Control[] = [
         default: 'automatic',
         enum: 'PrimitiveButtonStyle',
       },
+      // turns the row into the "Change flight >" shape a form uses for a row that opens
+      // something, by pushing a secondary chevron to the trailing edge.
+      disclosureIndicator: { type: 'boolean', default: false },
     },
     constructors: [
       {
@@ -64,14 +67,26 @@ export const leafControls: Control[] = [
       },
     ],
     swift: `Button(role: OneNativeGenerated.buttonRole(model.buttonRole), action: { model.press() }) {
-        if model.systemImage.isEmpty {
-          Text(model.label)
+        if model.disclosureIndicator {
+          HStack {
+            model.oneNativeLabel
+            Spacer()
+            Image(systemName: "chevron.right").foregroundStyle(.secondary)
+          }
+          .frame(maxWidth: .infinity)
         } else {
-          Label(model.label, systemImage: model.systemImage)
+          model.oneNativeLabel
         }
       }
       .oneNativeButtonStyle(model.buttonStyle)`,
     validate: `  if (typeof label !== 'string' || !label) throw new Error('Button label must be a non-empty string')`,
+    extraSwift: `private extension ButtonModel {
+  // the label is the same whether or not a disclosure indicator follows it, so the
+  // image-or-text rule is written once.
+  @ViewBuilder var oneNativeLabel: some View {
+    if systemImage.isEmpty { Text(label) } else { Label(label, systemImage: systemImage) }
+  }
+}`,
   },
   {
     name: 'ProgressView',
```

---

### Incident Patch 10: `c412682c` (2026-09-14)
**Commit Message**: fix(native): route the removed assets-registry import to react native 0.87's registry

React Native 0.87 dropped @react-native/assets-registry, but react-native-svg
15.15.x still imports @react-native/assets-registry/registry. Web and worker
builds now alias it to react-native-web's AssetRegistry, like
react-native/asset-registry. Native builds resolve it to
react-native/asset-registry, the same registry singleton React Native uses.

Verified: tests/test test:prod builds and passes (30 files) where it failed
with 'Rolldown failed to resolve import @react-native/assets-registry/registry'.
A native bundle probe importing the old path now includes
react-native/src/asset-registry.js in prod and dev builds, where before it
left an unresolved external import. vxrn and one build and typecheck;
createNativeDevEngine tests 88 pass; compiler tests 87 pass.

Team-Machine-Session: r30943

**File**: `packages/one/src/cli/build.ts` (modified, +3/-1)
```diff
@@ -1426,7 +1426,9 @@ export default {
               replacement: resolvePath('@vxrn/vite-plugin-metro/empty', options.root),
             },
             {
-              find: 'react-native/asset-registry',
+              // react native 0.87 removed @react-native/assets-registry, but libraries
+              // like react-native-svg still import its registry
+              find: /^(react-native\/asset-registry|@react-native\/assets-registry\/registry)$/,
               replacement: resolvePath(
                 'react-native-web/dist/modules/AssetRegistry',
                 options.root
```

**File**: `packages/one/src/vite/plugins/workerdDevPlugin.ts` (modified, +8/-2)
```diff
@@ -332,12 +332,18 @@ export function createWorkerdDevPlugins(
     // worker aliases with a worker-only resolveId (rolldown cannot parse RN Flow)
     resolveId: {
       filter: {
-        id: /^(react-native(\/|$)|react-native-safe-area-context$)/,
+        id: /^(react-native(\/|$)|react-native-safe-area-context$|@react-native\/assets-registry\/registry$)/,
       },
       handler(source) {
         if (this.environment.name !== 'worker') return
         if (/^react-native\/Libraries\//.test(source)) return empty
-        if (source === 'react-native/asset-registry') return rnWebAssetRegistry
+        // react native 0.87 removed @react-native/assets-registry, but libraries
+        // like react-native-svg still import its registry
+        if (
+          source === 'react-native/asset-registry' ||
+          source === '@react-native/assets-registry/registry'
+        )
+          return rnWebAssetRegistry
         if (source === 'react-native/package.json') return rnWebPkg
         if (source === 'react-native') return rnWeb
         if (source === 'react-native-safe-area-context') return safeArea
```

**File**: `packages/vxrn/src/config/getBaseViteConfigOnly.ts` (modified, +3/-1)
```diff
@@ -101,7 +101,9 @@ export async function getBaseViteConfig(
           replacement: resolvePath('@vxrn/vite-plugin-metro/empty', import.meta.dirname),
         },
         {
-          find: 'react-native/asset-registry',
+          // react native 0.87 removed @react-native/assets-registry, but libraries
+          // like react-native-svg still import its registry
+          find: /^(react-native\/asset-registry|@react-native\/assets-registry\/registry)$/,
           replacement: resolvePath('react-native-web/dist/modules/AssetRegistry', root),
         },
         {
```

**File**: `packages/vxrn/src/utils/createNativeDevEngine.ts` (modified, +12/-0)
```diff
@@ -265,6 +265,18 @@ function getNativePlugins(
     // rolldown-runtime WebSocket); RN's client otherwise opens a /hot socket and
     // red-boxes "unknown-message [object Object]" on every edit (new arch)
     hmrClientNoopPlugin(),
+    // react native 0.87 removed @react-native/assets-registry. libraries like
+    // react-native-svg still import its registry, which is now the same
+    // singleton at react-native/asset-registry. unresolved, rolldown would
+    // leave it as an external import that throws when the module runs.
+    {
+      name: 'vxrn:legacy-asset-registry',
+      resolveId(source, importer) {
+        if (source === '@react-native/assets-registry/registry') {
+          return this.resolve('react-native/asset-registry', importer, { skipSelf: true })
+        }
+      },
+    } satisfies Plugin,
     ...(dev ? [reactNativeDedupePlugin(root)] : []),
     // stub CSS imports — native doesn't support CSS and rolldown removed CSS bundling
     cssStubPlugin(),
```

---

### Incident Patch 11: `43ff9eee` (2026-09-14)
**Commit Message**: fix(native): pin the metro worker's one babel pass for react native flow

react-native 0.87 flow uses syntax fast-flow-transform 0.0.3 cannot parse:
it rejects 124 of the 631 flow sources in react-native 0.87.1 (readonly
properties, newer type parameter forms). the worker therefore strips flow
through the hermes-parser babel pass in @vxrn/compiler, which also lowers
the flow enums VirtualView exports.

the worker test mocked @babel/core without its default export, which is how
@vxrn/compiler reaches babel, so every zero-babel assertion in the file was
blind to that path. the mock now counts both, flow files assert exactly one
transform call, and a new case covers an exported enum with readonly props.

also type the site's Hint key handler with react native's KeyDownEvent,
which view onKeyDown uses as of 0.87.

Team-Machine-Session: r30943

**File**: `apps/onestack.dev/components/Hint.tsx` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
 import { ColorTokens, Paragraph, Text, Tooltip } from 'tamagui'
-import type { KeyboardEvent } from 'react'
+import type { KeyDownEvent } from 'react-native'
 
 export const Hint = ({
   children,
@@ -10,8 +10,8 @@ export const Hint = ({
   hintContents: React.ReactNode
   tint?: 'green' | 'pink' | 'blue' | 'red' | 'purple'
 }) => {
-  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
-    if (event.key === 'Enter' || event.key === ' ') {
+  const handleKeyDown = (event: KeyDownEvent) => {
+    if (event.nativeEvent.key === 'Enter' || event.nativeEvent.key === ' ') {
       event.preventDefault()
       // Trigger the tooltip (this depends on how Tamagui's Tooltip handles this)
       // You might need to use a ref or other method to programmatically show the tooltip
```

**File**: `packages/vite-plugin-metro/src/transformer/metroNativeWorker.test.ts` (modified, +65/-29)
```diff
@@ -35,33 +35,25 @@ const babelCalls = {
 
 vi.mock('@babel/core', async (importOriginal) => {
   const actual = await importOriginal<typeof import('@babel/core')>()
-  return {
-    ...actual,
-    transform: vi.fn((...args: any[]) => {
-      babelCalls.transform++
-      return (actual.transform as any)(...args)
-    }),
-    transformSync: vi.fn((...args: any[]) => {
-      babelCalls.transformSync++
-      return (actual.transformSync as any)(...args)
-    }),
-    transformAsync: vi.fn((...args: any[]) => {
-      babelCalls.transformAsync++
-      return (actual.transformAsync as any)(...args)
-    }),
-    transformFromAstSync: vi.fn((...args: any[]) => {
-      babelCalls.transformFromAstSync++
-      return (actual.transformFromAstSync as any)(...args)
-    }),
-    parse: vi.fn((...args: any[]) => {
-      babelCalls.parse++
-      return (actual.parse as any)(...args)
-    }),
-    parseSync: vi.fn((...args: any[]) => {
-      babelCalls.parseSync++
-      return (actual.parseSync as any)(...args)
-    }),
-  }
+  const names = [
+    'transform',
+    'transformSync',
+    'transformAsync',
+    'transformFromAstSync',
+    'parse',
+    'parseSync',
+  ] as const
+  const counted = Object.fromEntries(
+    names.map((name) => [
+      name,
+      vi.fn((...args: any[]) => {
+        babelCalls[name]++
+        return (actual[name] as any)(...args)
+      }),
+    ])
+  )
+  // @vxrn/compiler reaches babel through the default export, so count that too
+  return { ...actual, ...counted, default: { ...actual, ...counted } }
 })
 
 // module scope so every describe in this file can assert it, not just the first
@@ -74,6 +66,20 @@ beforeEach(() => {
   babelCalls.parseSync = 0
 })
 
+// flow stripping is the one place the worker runs babel: react-native's flow
+// syntax (readonly properties, enums) is beyond fast-flow-transform, so the
+// hermes-parser pass in @vxrn/compiler strips it in a single transform call
+function assertOnlyFlowStripBabelCall() {
+  expect(babelCalls).toEqual({
+    transform: 1,
+    transformSync: 0,
+    transformAsync: 0,
+    transformFromAstSync: 0,
+    parse: 0,
+    parseSync: 0,
+  })
+}
+
 function assertZeroBabelCalls() {
   expect(babelCalls.transform).toBe(0)
   expect(babelCalls.transformSync).toBe(0)
@@ -421,7 +427,7 @@ describe('metroNativeWorker', () => {
     expect(depNames).toContain('react-native/asset-registry')
   })
 
-  it('handles Flow files by stripping types without Babel', async () => {
+  it('strips Flow types with a single hermes-parser Babel pass', async () => {
     const flowSource = `
       // @flow
       function add(a: number, b: number): number {
@@ -438,11 +444,41 @@ describe('metroNativeWorker', () => {
       { dev: false, platform: 'ios', type: 'module' }
     )
 
-    assertZeroBabelCalls()
+    assertOnlyFlowStripBabelCall()
     expect(result.output[0].data.code).not.toContain(': number')
     expect(result.output[0].data.code).toContain('function add(a, b)')
   })
 
+  it('lowers React Native Flow enums and readonly properties', async () => {
+    // react-native 0.87 ships VirtualView.js with exported Flow enums, and
+    // readonly object properties throughout its type declarations
+    const flowSource = `
+      // @flow strict-local
+      type Props = { readonly state: VirtualViewRenderState };
+      export enum VirtualViewRenderState {
+        Unknown = 0,
+        Rendered = 1,
+        None = 2,
+      }
+      export function isRendered(state: VirtualViewRenderState): boolean {
+        return state === VirtualViewRenderState.Rendered;
+      }
+    `
+
+    const result = await transform(
+      {},
+      '/project',
+      'node_modules/react-native/src/private/components/virtualview/VirtualView.js',
+      Buffer.from(flowSource, 'utf8'),
+      { dev: false, platform: 'ios', type: 'module' }
+    )
+
+    assertOnlyFlowStripBabelCall()
+    expect(result.output[0].data.code).not.toContain('enum VirtualViewRenderState')
+    expect(result.output[0].data.code).not.toContain('readonly')
+    expect(result.dependencies.map((d) => d.name)).toContain('flow-enums-runtime')
+  })
+
   it('generates a deterministic cache key without Babel', () => {
     const key1 = getCacheKey(
       { globalPrefix: '__one_', minifierPath: 'terser' },
```

---

### Incident Patch 12: `04813ef7` (2026-09-14)
**Commit Message**: Merge branch 'fix/one-native-android-track-a-finish' into feat/one-native-android

**File**: `packages/native/README.md` (modified, +65/-0)
```diff
@@ -61,6 +61,71 @@ arrangement. `Box` accepts `contentAlignment`.
 `disabled`, `variant` (`filled`, `outlined`, or `text`), and `tone` (`default` or
 `danger`). `Switch` is controlled with `isOn`, `onIsOnChange`, and optional `revision`.
 
+### Android toolchain pins and device proof
+
+`android/build.gradle` pins the Compose toolchain with exact versions, not ranges:
+
+| Artifact | Pinned | Resolved in `:app:assembleDebug` |
+| --- | --- | --- |
+| Compose UI / foundation | 1.11.4 | 1.11.4 (RN 0.86 transitives at 1.8.x/1.7.x/1.0.1 all resolve up to the pin) |
+| Material 3 | 1.4.0 | 1.4.0 (`material3-android`) |
+| Kotlin Gradle plugin | 2.1.20 | 2.1.20 (stdlib floats to 2.2.20 via RN alignment) |
+| AGP | expo SDK 57 template | 8.12.0 |
+| Gradle | wrapper | 9.3.1 on Java 17 |
+| compileSdk / targetSdk / minSdk | expo and RN 0.86 defaults | 36 / 36 / 24 (target and min read from the built APK) |
+| react-native / react | workspace | 0.86.2 / 19.2.3 |
+
+Compose UI 1.12.x stays rejected until compileSdk 37 and AGP 9.1 are adopted:
+1.12 requires the newer SDK and build toolchain, and the pins above are exact
+strings, so Gradle cannot silently select 1.12.1 through a transitive range.
+The `:app:dependencies` output above is the gate: every `androidx.compose`
+line must resolve to the pinned version.
+
+To reproduce, from a clean checkout in `tests/native-features`:
+
+```sh
+bun install
+bunx turbo run build --filter=one --filter=@vxrn/native
+bun run prebuild:native --platform android --no-install
+cd android && ./gradlew :app:assembleDebug
+```
+
+The debug APK loads its bundle from Metro, so start `bun run dev`,
+`adb reverse tcp:8081 tcp:8081`, install the APK, and run the proof:
+
+```sh
+bun tests/native-features/scripts/one-native-conformance.android.ts \
+  --device-id <serial> --package-id dev.vxrn.nativefeatures.tests \
+  --artifact-dir /tmp/one-native-android-proof
+```
+
+The suite drives `tests/native-features/app/one-native-android.tsx` through
+`uiautomator` dumps and coordinate taps: mount marker, accessibility and order,
+prop mutation with fresh bounds, two button taps, controlled Switch reject,
+accept, and revision reset, keyed reorder, optional unmount and remount,
+disabled controls rejecting taps, and a decoy negative control. It then runs
+a bounded stress block: six rapid unmount/remount toggles plus four rapid
+reorders with a duplicate-node sweep over every proof testID, single-handler
+taps proving no duplicate event delivery, and a configuration-change block
+that sets `wm density 560` (density is not in the activity's `configChanges`,
+so the activity recreates), re-navigates from the reloaded home screen, proves
+a single remount with default state, proves a single post-recreation button
+event, proves the expanded bounds width scales with the density ratio
+(619px at 420dpi to 826px at 560dpi, ratio 1.334 against 1.333 expected),
+then resets the density and proves the remount once more. 24 checks pass on
+the standard emulator.
+
+Two behaviors are worth knowing when reading the artifacts. A non-scrollable
+`Column` taller than the window keeps composing its tail, but at 560dpi the
+309x686dp window leaves the order row and decoy box out of the uiautomator
+tree, so the post-rotation checks assert the observable subset and the full
+duplicate sweep runs again after the density reset. And process memory across
+24 optional-child remount cycles drifts up about 1.6% total (310.1MB to
+315.3MB PSS, roughly 190KB per cycle with Native Heap holding two thirds of
+the process); the run-to-run slope is unchanged, which is consistent with GC
+laziness on a debug process and proves no rapid leak, but a short sample
+cannot prove leak freedom.
+
 ```tsx
 import { useState } from 'react'
 import { Text, View } from 'react-native'
```

**File**: `tests/native-features/scripts/one-native-conformance.android.ts` (modified, +238/-0)
```diff
@@ -461,6 +461,86 @@ function runDetail(nodes: Node[], ids: string[]) {
   return Object.fromEntries(ids.map((id) => [id, shortNode(matching(nodes, { id })[0])]))
 }
 
+const proofIds = [
+  'one-native-android-mounted',
+  'one-native-android-prop-status',
+  'one-native-android-bounds-box',
+  'one-native-android-prop-value',
+  'one-native-android-prop-mutate',
+  'one-native-android-button-status',
+  'one-native-android-real-button',
+  'one-native-android-reorder',
+  'one-native-android-switch-status',
+  'one-native-android-switch-policy-status',
+  'one-native-android-switch',
+  'one-native-android-switch-policy',
+  'one-native-android-switch-reset',
+  'one-native-android-lifecycle-status',
+  'one-native-android-toggle-optional',
+  'one-native-android-optional',
+  'one-native-android-optional-text',
+  'one-native-android-disabled-status',
+  'one-native-android-disabled-button',
+  'one-native-android-disabled-switch',
+  'one-native-android-order-status',
+  'one-native-android-order-row',
+  'one-native-android-order-alpha',
+  'one-native-android-order-beta',
+  'one-native-android-decoy',
+  'one-native-android-decoy-label',
+]
+
+function duplicateIds(nodes: Node[]) {
+  return duplicateIdsIn(nodes, proofIds)
+}
+
+function duplicateIdsIn(nodes: Node[], ids: string[]) {
+  return ids.filter((id) => matching(nodes, { id }).length !== 1)
+}
+
+// At 560dpi the 309x686dp window clips the Column tail: the order row and the
+// decoy box are composed but absent from the uiautomator tree. Assert the
+// observable subset there and the full set at the default density.
+const proofIdsVisibleSmall = [
+  'one-native-android-mounted',
+  'one-native-android-prop-status',
+  'one-native-android-bounds-box',
+  'one-native-android-prop-value',
+  'one-native-android-prop-mutate',
+  'one-native-android-button-status',
+  'one-native-android-real-button',
+  'one-native-android-reorder',
+  'one-native-android-switch-status',
+  'one-native-android-switch-policy-status',
+  'one-native-android-switch',
+  'one-native-android-switch-policy',
+  'one-native-android-switch-reset',
+  'one-native-android-lifecycle-status',
+  'one-native-android-toggle-optional',
+  'one-native-android-optional',
+  'one-native-android-optional-text',
+  'one-native-android-disabled-status',
+  'one-native-android-disabled-button',
+  'one-native-android-disabled-switch',
+  'one-native-android-order-status',
+]
+
+function nodeWidth(node: Node) {
+  if (!node.bounds) return 0
+  return node.bounds.right - node.bounds.left
+}
+
+function readDensity(config: Config) {
+  const output = adbText(config, ['shell', 'wm', 'density']).trim()
+  const match = output.match(/density:\s*(\d+)\s*$/m)
+  if (!match) throw new Error(`Could not parse wm density output: ${output}`)
+  return Number(match[1])
+}
+
+function writeDensity(config: Config, value: string) {
+  adbText(config, ['shell', 'wm', 'density', value])
+}
+
 async function run(config: Config) {
   mkdirSync(config.artifactDir, { recursive: true })
   const checks: Check[] = []
@@ -841,6 +921,164 @@ async function run(config: Config) {
       'one-native-android-mounted'
     )
 
+    for (let cycle = 0; cycle < 6; cycle++)
+      tapFresh(config, `Rapid recycle toggle ${cycle + 1}`, {
+        id: 'one-native-android-toggle-optional',
+        role: 'button',
+        clickable: true,
+      })
+    for (let cycle = 0; cycle < 4; cycle++)
+      tapFresh(config, `Rapid recycle reorder ${cycle + 1}`, {
+        id: 'one-native-android-reorder',
+        role: 'button',
+        clickable: true,
+      })
+    await expect(
+      'rapid-recycle-stress',
+      (nodes) =>
+        textIncludes(nodes, 'Optional: mounted') &&
+        exactlyOneId(nodes, 'one-native-android-optional') &&
+        orderIds(nodes).join(',') === 'beta,alpha' &&
+        duplicateIds(nodes).length === 0,
+      'one-native-android-mounted',
+      (nodes) => ({
+        order: orderIds(nodes),
+        duplicates: duplicateIds(nodes),
+        optional: shortNode(nodeById(nodes, 'one-native-android-optional')),
+      })
+    )
+
+    tapFresh(config, 'Post-stress real button tap', {
+      id: 'one-native-android-real-button',
+      role: 'button',
+      clickable: true,
+    })
+    await expect(
+      'post-stress-single-handler',
+      (nodes) =>
+        textIncludes(nodes, 'Button taps: 3') &&
+        textIncludes(nodes, 'Disabled button taps: 0 · Disabled switch taps: 0') &&
+        duplicateIds(nodes).length === 0,
+      'one-native-android-mounted',
+      (nodes) => ({ duplicates: duplicateIds(nodes) })
+    )
+
+    tapFresh(config, 'Post-stress switch tap', {
+      id: 'one-native-android-switch',
+      role: 'switch',
+      clickable: true,
+    })
+    await expect(
+      'post-stress-switch-accept',
+      (nodes) => {
+        const control = matching(nodes, {
+          id: 'one-native-android-switch',
+          role: 'switch',
+          checked: true,
+        
```

**File**: `tests/native-features/scripts/one-native-memory.android.ts` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+#!/usr/bin/env bun
+import { execFileSync } from 'node:child_process'
+import { mkdirSync, writeFileSync } from 'node:fs'
+import path from 'node:path'
+
+// Bounded remount-cycle memory probe for the One Native Android proof screen.
+// Taps the optional-child toggle off/on per cycle (a real Fabric unmount/remount
+// through OneNativeComposeNodeView.resetForReuse) and samples TOTAL PSS/USS via
+// dumpsys meminfo. Reports the series plus a coarse growth guard. A short sample
+// cannot prove leak freedom; it can only catch clear monotonic growth.
+
+type Sample = { cycle: number; state: string; pssKb: number; privateDirtyKb: number }
+
+function parse(args: string[]) {
+  let deviceId = ''
+  let packageId = ''
+  let artifactDir = '/tmp/one-native-android-memory'
+  let cycles = 12
+  let timeout = 15_000
+  for (let index = 0; index < args.length; index++) {
+    const arg = args[index]
+    if (arg === '--device-id' || arg === '--serial' || arg === '--adb-device')
+      deviceId = args[++index] || ''
+    else if (arg === '--package-id' || arg === '--bundle-id')
+      packageId = args[++index] || ''
+    else if (arg === '--artifact-dir') artifactDir = args[++index] || ''
+    else if (arg === '--cycles') cycles = Number(args[++index])
+    else if (arg === '--timeout') timeout = Number(args[++index])
+    else throw new Error(`Unknown argument: ${arg}`)
+  }
+  if (!deviceId || !packageId || !Number.isInteger(cycles) || cycles <= 0)
+    throw new Error('A device id, package id, and positive integer cycles are required.')
+  return { deviceId, packageId, artifactDir, cycles, timeout }
+}
+
+function adb(deviceId: string, args: string[]) {
+  return execFileSync('adb', ['-s', deviceId, ...args], {
+    encoding: 'utf8',
+    stdio: ['ignore', 'pipe', 'pipe'],
+    timeout: 30_000,
+  })
+}
+
+function dump(deviceId: string) {
+  const remote = `/sdcard/one-native-android-memory-${process.pid}.xml`
+  adb(deviceId, ['shell', 'uiautomator', 'dump', remote])
+  return adb(deviceId, ['exec-out', 'cat', remote])
+}
+
+function toggleCenter(xml: string) {
+  const tag = xml.indexOf('one-native-android-toggle-optional')
+  if (tag < 0) throw new Error('Toggle button not found in accessibility dump.')
+  const window = xml.slice(tag, tag + 3000)
+  const match = window.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
+  if (!match) throw new Error('Toggle button has no usable bounds.')
+  const [, left, top, right, bottom] = match.map(Number)
+  return {
+    x: Math.round((left + right) / 2),
+    y: Math.round((top + bottom) / 2),
+  }
+}
+
+function meminfo(deviceId: string, packageId: string): Omit<Sample, 'cycle' | 'state'> {
+  const output = adb(deviceId, ['shell', 'dumpsys', 'meminfo', packageId])
+  const match = output.match(/^\s*TOTAL\s+(\d+)\s+(\d+)/m)
+  if (!match) throw new Error('Could not parse dumpsys meminfo TOTAL line.')
+  return { pssKb: Number(match[1]), privateDirtyKb: Number(match[2]) }
+}
+
+async function waitState(
+  deviceId: string,
+  expected: string,
+  timeout: number
+): Promise<string> {
+  const started = Date.now()
+  while (Date.now() - started < timeout) {
+    const xml = dump(deviceId)
+    if (xml.includes(expected)) return xml
+    await Bun.sleep(250)
+  }
+  throw new Error(`Timed out waiting for "${expected}".`)
+}
+
+async function run() {
+  const config = parse(process.argv.slice(2))
+  mkdirSync(config.artifactDir, { recursive: true })
+  const samples: Sample[] = []
+
+  await waitState(config.deviceId, 'one-native-android-mounted', config.timeout)
+  const coords = toggleCenter(dump(config.deviceId))
+
+  for (let cycle = 1; cycle <= config.cycles; cycle++) {
+    adb(config.deviceId, ['shell', 'input', 'tap', String(coords.x), String(coords.y)])
+    await waitState(config.deviceId, 'Optional: unmounted', config.timeout)
+    adb(config.deviceId, ['shell', 'input', 'tap', String(coords.x), String(coords.y)])
+    const xml = await waitState(config.deviceId, 'Optional: mounted', config.timeout)
+    const mountedCount = xml.split('one-native-android-optional-text').length - 1
+    const memory = meminfo(config.deviceId, config.packageId)
+    const state = `mountedCount=${mountedCount}`
+    samples.push({ cycle, state, ...memory })
+    console.log(
+      `cycle ${cycle}: ${state} pss=${memory.pssKb}KB privateDirty=${memory.privateDirtyKb}KB`
+    )
+  }
+
+  const median = (values: number[]) => {
+    const sorted = [...values].sort((a, b) => a - b)
+    return sorted[Math.floor(sorted.length / 2)]
+  }
+  const first = median(samples.slice(0, 3).map((sample) => sample.pssKb))
+  const last = median(samples.slice(-3).map((sample) => sample.pssKb))
+  const growth = (last - first) / first
+  const monotonic =
+    samples.slice(-3).every((sample) => sample.pssKb > first) && growth > 0.2
+  const report = {
+    suite: 'one-native-android-memory',
+    deviceId: config.deviceId,
+    packageId: config.packageId,
+    cycles: config.cyc
```

---

### Incident Patch 13: `f2c47364` (2026-09-14)
**Commit Message**: fix(tests): resolve the expo tsconfig base through its json export

the Expo 58 canary maps expo/* to ./*.js, so the extensionless
expo/tsconfig.base resolves to a file that does not exist and every fixture
dev server extending it exits with "Tsconfig not found". the .json spelling
matches the ./*.json export and exists in both Expo 57 and 58.

also teach depcheck that babel-plugin-transform-flow-enums is required by
string id in transformBabel.

Team-Machine-Session: r30943

**File**: `packages/compiler/.depcheckrc` (modified, +2/-0)
```diff
@@ -7,5 +7,7 @@ ignores:
   - "@vxrn/vite-native-client"
   # required by string id in reactNativeViewConfig, so depcheck cannot see it
   - "hermes-parser"
+  # required by string id in transformBabel, so depcheck cannot see it
+  - "babel-plugin-transform-flow-enums"
   # kept as export for vxrn native HMR consumers, dep provided by workspace
   - "@swc/core"
```

**File**: `tests/native-features/tsconfig.json` (modified, +1/-1)
```diff
@@ -32,5 +32,5 @@
     "lib": ["dom", "esnext"]
   },
   "exclude": ["node_modules", ".expo", "**/dist", "**/types"],
-  "extends": "expo/tsconfig.base"
+  "extends": "expo/tsconfig.base.json"
 }
```

**File**: `tests/sandbox/tsconfig.json` (modified, +1/-1)
```diff
@@ -62,5 +62,5 @@
       "path": "../../packages/one"
     }
   ],
-  "extends": "expo/tsconfig.base"
+  "extends": "expo/tsconfig.base.json"
 }
```

**File**: `tests/test-cloudflare/tsconfig.json` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@
   "typeAcquisition": {
     "enable": true
   },
-  "extends": "expo/tsconfig.base",
+  "extends": "expo/tsconfig.base.json",
   "references": [
     {
       "path": "../../packages/one"
```

**File**: `tests/test-layout-render-modes/tsconfig.json` (modified, +1/-1)
```diff
@@ -41,5 +41,5 @@
   "references": [
     { "path": "../../packages/one" }
   ],
-  "extends": "expo/tsconfig.base"
+  "extends": "expo/tsconfig.base.json"
 }
```

**File**: `tests/test-loaders/tsconfig.json` (modified, +1/-1)
```diff
@@ -63,5 +63,5 @@
       "path": "../../packages/one"
     }
   ],
-  "extends": "expo/tsconfig.base"
+  "extends": "expo/tsconfig.base.json"
 }
```

**File**: `tests/test-weird-deps/tsconfig.json` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@
   "typeAcquisition": {
     "enable": true
   },
-  "extends": "expo/tsconfig.base",
+  "extends": "expo/tsconfig.base.json",
   "references": [
     {
       "path": "../../packages/one"
```

**File**: `tests/test/tsconfig.json` (modified, +1/-1)
```diff
@@ -64,5 +64,5 @@
       "path": "../../packages/one"
     }
   ],
-  "extends": "expo/tsconfig.base"
+  "extends": "expo/tsconfig.base.json"
 }
```

---

### Incident Patch 14: `53e43e09` (2026-09-14)
**Commit Message**: fix(router): do not preload links with file extensions or non-self targets

Team-Machine-Session: m14270

**File**: `packages/one/src/router/router.ts` (modified, +10/-1)
```diff
@@ -28,7 +28,7 @@ import { getLoaderPath, getPreloadCSSPath, getPreloadPath } from '../utils/clean
 import { dynamicImport } from '../utils/dynamicImport'
 import { PLATFORM } from '../utils/platform'
 import { isVersionStale } from '../skewProtection'
-import { shouldLinkExternally } from '../utils/url'
+import { hasFileExtension, shouldLinkExternally, shouldPreloadRoute } from '../utils/url'
 import {
   ParamValidationError,
   RouteValidationError,
@@ -965,6 +965,10 @@ export function getPreloadHistory(): PreloadEntry[] {
 
 export function preloadRoute(href: string, injectCSS = false): Promise<any> | undefined {
   if (process.env.TAMAGUI_TARGET !== 'native') {
+    if (!shouldPreloadRoute(href)) {
+      return
+    }
+
     // in dev mode, use a simpler preload that just fetches the loader directly
     // this avoids issues with production-only preload paths while still ensuring
     // loader data is available before navigation completes
@@ -1104,6 +1108,11 @@ export async function linkTo(
     return
   }
 
+  if (process.env.TAMAGUI_TARGET !== 'native' && hasFileExtension(href)) {
+    window.location.href = href
+    return
+  }
+
   // if a new version was detected via polling, force full page navigation
   if (isVersionStale()) {
     window.location.href = href
```

**File**: `packages/one/src/utils/url.test.ts` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+import { describe, expect, it } from 'vitest'
+import { hasFileExtension, shouldLinkExternally, shouldPreloadRoute } from './url'
+
+describe('url utils', () => {
+  describe('hasFileExtension', () => {
+    it('returns true for common file extensions', () => {
+      expect(hasFileExtension('/ui/button.md')).toBe(true)
+      expect(hasFileExtension('/llms.txt')).toBe(true)
+      expect(hasFileExtension('/favicon.ico')).toBe(true)
+      expect(hasFileExtension('/assets/image.png')).toBe(true)
+      expect(hasFileExtension('/doc.pdf')).toBe(true)
+      expect(hasFileExtension('/data.json')).toBe(true)
+      expect(hasFileExtension('/archive.zip')).toBe(true)
+      expect(hasFileExtension('/styles.css')).toBe(true)
+      expect(hasFileExtension('/script.js')).toBe(true)
+      expect(hasFileExtension('/manifest.webmanifest')).toBe(true)
+      expect(hasFileExtension('/font.woff2')).toBe(true)
+    })
+
+    it('returns true with query params or hashes', () => {
+      expect(hasFileExtension('/ui/button.md?download=1')).toBe(true)
+      expect(hasFileExtension('/llms.txt#section')).toBe(true)
+      expect(hasFileExtension('https://tamagui.dev/ui/button.md?foo=bar#baz')).toBe(true)
+    })
+
+    it('returns false for route paths without extensions', () => {
+      expect(hasFileExtension('/')).toBe(false)
+      expect(hasFileExtension('/about')).toBe(false)
+      expect(hasFileExtension('/ui/button')).toBe(false)
+      expect(hasFileExtension('/docs/components/button')).toBe(false)
+      expect(hasFileExtension('/v1.0')).toBe(false)
+      expect(hasFileExtension('/version-2.1.0')).toBe(false)
+      expect(hasFileExtension('/docs/1.0/intro')).toBe(false)
+    })
+
+    it('returns false for empty or invalid inputs', () => {
+      expect(hasFileExtension('')).toBe(false)
+    })
+  })
+
+  describe('shouldPreloadRoute', () => {
+    it('returns true for valid internal routes', () => {
+      expect(shouldPreloadRoute('/')).toBe(true)
+      expect(shouldPreloadRoute('/about')).toBe(true)
+      expect(shouldPreloadRoute('/ui/button')).toBe(true)
+      expect(shouldPreloadRoute('/docs/components/button')).toBe(true)
+    })
+
+    it('returns false for file extensions', () => {
+      expect(shouldPreloadRoute('/ui/button.md')).toBe(false)
+      expect(shouldPreloadRoute('/llms.txt')).toBe(false)
+      expect(shouldPreloadRoute('/favicon.ico')).toBe(false)
+    })
+
+    it('returns false for external urls or schemes', () => {
+      expect(shouldPreloadRoute('https://example.com/about')).toBe(false)
+      expect(shouldPreloadRoute('http://example.com')).toBe(false)
+      expect(shouldPreloadRoute('mailto:test@example.com')).toBe(false)
+      expect(shouldPreloadRoute('tel:123456')).toBe(false)
+    })
+
+    it('returns false for hash links or empty hrefs', () => {
+      expect(shouldPreloadRoute('#section')).toBe(false)
+      expect(shouldPreloadRoute('')).toBe(false)
+    })
+  })
+})
```

**File**: `packages/one/src/utils/url.ts` (modified, +22/-0)
```diff
@@ -19,3 +19,25 @@ export function shouldLinkExternally(href: string): boolean {
   // Cheap check first to avoid regex if the href is not a path fragment.
   return !/^[./]/.test(href) && (hasUrlProtocolPrefix(href) || isWellKnownUri(href))
 }
+
+const staticFileExtensionRegex = /\.(?:[a-z0-9]{2,5}|webmanifest|wasm|woff2)$/i
+
+export function hasFileExtension(href: string): boolean {
+  if (!href) return false
+  try {
+    const url = new URL(href, 'http://localhost')
+    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
+      return true
+    }
+    return staticFileExtensionRegex.test(url.pathname)
+  } catch {
+    return false
+  }
+}
+
+export function shouldPreloadRoute(href: string): boolean {
+  if (!href || href[0] === '#') return false
+  if (shouldLinkExternally(href)) return false
+  if (hasFileExtension(href)) return false
+  return true
+}
```

**File**: `packages/one/src/views/PreloadLinks.test.ts` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+import { describe, expect, it } from 'vitest'
+import { getPrefetchableHref } from './PreloadLinks'
+
+function createMockAnchor(attrs: {
+  href?: string
+  target?: string
+  download?: boolean
+  rel?: string
+}): HTMLAnchorElement {
+  const el = {
+    getAttribute(name: string) {
+      if (name === 'href') return attrs.href ?? null
+      if (name === 'rel') return attrs.rel ?? null
+      return null
+    },
+    hasAttribute(name: string) {
+      if (name === 'download') return !!attrs.download
+      return false
+    },
+    target: attrs.target ?? '',
+  } as unknown as HTMLAnchorElement
+  return el
+}
+
+describe('getPrefetchableHref', () => {
+  const baseUrl = 'https://tamagui.dev'
+
+  it('returns clean href for valid internal routes', () => {
+    const anchor = createMockAnchor({ href: '/ui/button' })
+    expect(getPrefetchableHref(anchor, baseUrl)).toBe('/ui/button')
+  })
+
+  it('returns clean href for absolute urls matching baseUrl', () => {
+    const anchor = createMockAnchor({ href: 'https://tamagui.dev/docs/intro' })
+    expect(getPrefetchableHref(anchor, baseUrl)).toBe('/docs/intro')
+  })
+
+  it('returns null for target="_blank"', () => {
+    const anchor = createMockAnchor({ href: '/docs/intro', target: '_blank' })
+    expect(getPrefetchableHref(anchor, baseUrl)).toBeNull()
+  })
+
+  it('returns null for download attribute', () => {
+    const anchor = createMockAnchor({ href: '/archive.zip', download: true })
+    expect(getPrefetchableHref(anchor, baseUrl)).toBeNull()
+  })
+
+  it('returns null for rel="external"', () => {
+    const anchor = createMockAnchor({ href: '/docs', rel: 'external' })
+    expect(getPrefetchableHref(anchor, baseUrl)).toBeNull()
+  })
+
+  it('returns null for file extensions (.md, .txt, .png, etc.)', () => {
+    expect(
+      getPrefetchableHref(createMockAnchor({ href: '/ui/button.md' }), baseUrl)
+    ).toBeNull()
+    expect(
+      getPrefetchableHref(createMockAnchor({ href: '/llms.txt' }), baseUrl)
+    ).toBeNull()
+    expect(
+      getPrefetchableHref(
+        createMockAnchor({ href: 'https://tamagui.dev/ui/button.md' }),
+        baseUrl
+      )
+    ).toBeNull()
+    expect(
+      getPrefetchableHref(
+        createMockAnchor({ href: 'https://tamagui.dev/llms.txt' }),
+        baseUrl
+      )
+    ).toBeNull()
+  })
+
+  it('returns null for external urls', () => {
+    const anchor = createMockAnchor({ href: 'https://google.com/about' })
+    expect(getPrefetchableHref(anchor, baseUrl)).toBeNull()
+  })
+})
```

**File**: `packages/one/src/views/PreloadLinks.tsx` (modified, +22/-11)
```diff
@@ -2,6 +2,8 @@ import { useEffect, useRef } from 'react'
 import { getURL } from '../getURL'
 import { preloadRoute } from '../router/router'
 
+import { shouldPreloadRoute } from '../utils/url'
+
 /**
  * Resolved at build time via vite define - enables tree-shaking of unused modes.
  * Defaults to 'intent' for smart trajectory-based prefetching.
@@ -21,18 +23,27 @@ const PREFETCH_MODE = (process.env.ONE_LINK_PREFETCH || 'intent') as
  * - 'hover': Prefetches on mouseover
  * - 'false': Disabled
  */
-function getHrefFromTarget(url: string, target: EventTarget | null): string | null {
-  if (!(target instanceof HTMLElement)) return null
-  const anchor = target instanceof HTMLAnchorElement ? target : target.closest('a')
-  if (!(anchor instanceof HTMLAnchorElement)) return null
+export function getPrefetchableHref(anchor: HTMLAnchorElement, url: string): string | null {
+  if (anchor.target && anchor.target !== '_self') return null
+  if (anchor.hasAttribute('download')) return null
+  if (anchor.getAttribute('rel')?.includes('external')) return null
   const href = anchor.getAttribute('href')
   if (!href) return null
   if (href[0] === '/' || href.startsWith(url)) {
-    return href.replace(url, '')
+    const cleanHref = href.replace(url, '')
+    if (!shouldPreloadRoute(cleanHref)) return null
+    return cleanHref
   }
   return null
 }
 
+function getHrefFromTarget(url: string, target: EventTarget | null): string | null {
+  if (!(target instanceof HTMLElement)) return null
+  const anchor = target instanceof HTMLAnchorElement ? target : target.closest('a')
+  if (!(anchor instanceof HTMLAnchorElement)) return null
+  return getPrefetchableHref(anchor, url)
+}
+
 export function PreloadLinks() {
   if (typeof window === 'undefined') {
     return null
@@ -92,16 +103,16 @@ export function PreloadLinks() {
           const seen = new WeakSet<Element>()
 
           const observeLinks = () => {
-            const links = document.querySelectorAll(
+            const links = document.querySelectorAll<HTMLAnchorElement>(
               'a[href^="/"], a[href^="' + url + '"]'
             )
             links.forEach((link) => {
               if (seen.has(link)) return
               seen.add(link)
-              const href = link.getAttribute('href')
+              const href = getPrefetchableHref(link, url)
               if (href) {
                 cleanups.push(
-                  observePrefetchViewport(link as HTMLElement, href.replace(url, ''))
+                  observePrefetchViewport(link, href)
                 )
               }
             })
@@ -139,16 +150,16 @@ export function PreloadLinks() {
           const seen = new WeakSet<Element>()
 
           const observeLinks = () => {
-            const links = document.querySelectorAll(
+            const links = document.querySelectorAll<HTMLAnchorElement>(
               'a[href^="/"], a[href^="' + url + '"]'
             )
             links.forEach((link) => {
               if (seen.has(link)) return
               seen.add(link)
-              const href = link.getAttribute('href')
+              const href = getPrefetchableHref(link, url)
               if (href) {
                 cleanups.push(
-                  observePrefetchIntent(link as HTMLElement, href.replace(url, ''))
+                  observePrefetchIntent(link, href)
                 )
               }
             })
```

**File**: `packages/one/types/utils/url.d.ts` (modified, +2/-0)
```diff
@@ -5,4 +5,6 @@
 export declare function hasUrlProtocolPrefix(href: string): boolean;
 export declare function isWellKnownUri(href: string): boolean;
 export declare function shouldLinkExternally(href: string): boolean;
+export declare function hasFileExtension(href: string): boolean;
+export declare function shouldPreloadRoute(href: string): boolean;
 //# sourceMappingURL=url.d.ts.map
\ No newline at end of file
```

**File**: `packages/one/types/views/PreloadLinks.d.ts` (modified, +10/-0)
```diff
@@ -1,2 +1,12 @@
+/**
+ * Handles link prefetching in production builds.
+ *
+ * Modes:
+ * - 'intent': Predicts navigation based on mouse trajectory (default)
+ * - 'viewport': Prefetches links when they enter the viewport
+ * - 'hover': Prefetches on mouseover
+ * - 'false': Disabled
+ */
+export declare function getPrefetchableHref(anchor: HTMLAnchorElement, url: string): string | null;
 export declare function PreloadLinks(): null;
 //# sourceMappingURL=PreloadLinks.d.ts.map
\ No newline at end of file
```

---

### Incident Patch 15: `deb09f4e` (2026-09-14)
**Commit Message**: fix(compiler): invalidate on user babel config, honor explicit transforms, warn on forced native

Fold the resolved user babel config (path plus mtime and content hash)
into the compiler cache fingerprint so adding or editing babel.config.*
misses stale entries. Guard explicit swc/oxc per-file choices (string and
object forms) against the user-config babel fallback. Warn naming the
ignored config when native Metro transforms are explicitly forced over a
detected user config, via one helper shared by both config builders.
Align the Metro babel fallback loader with the compiler detector on the
json config names. Add behavioral regression cases for each.

Team-Machine-Session: p43265

**File**: `packages/compiler/src/cache.ts` (modified, +37/-7)
```diff
@@ -50,7 +50,7 @@ function getCacheDir(): string {
 }
 
 // hash config state so cache invalidates when compiler/reanimated/nativewind toggles change
-function getConfigFingerprint(): string {
+function getConfigFingerprint(userBabelConfigPath?: string | null): string {
   return createHash('sha1')
     .update(
       JSON.stringify({
@@ -59,6 +59,10 @@ function getConfigFingerprint(): string {
         nativeWorklets: isNativeWorkletsEnabled(),
         nativewind: configuration.enableNativewind,
         nativeCSS: configuration.enableNativeCSS,
+        // transform output depends on the user babel config when one applies,
+        // so its identity joins the fingerprint. adding, removing, or editing
+        // babel.config.* must miss entries written without that change.
+        babelConfig: getBabelConfigIdentity(userBabelConfigPath),
         // bump when the transform engine changes, so entries written by a
         // previous engine aren't served for the same source
         engine: 'oxc-worklets-hermes-async',
@@ -68,9 +72,33 @@ function getConfigFingerprint(): string {
     .slice(0, 8)
 }
 
-function getCacheKey(filePath: string, environment: string): string {
+// identity of the user babel config influencing a transform: path plus mtime
+// and content hash, or null when none applies. mtime alone misses edits that
+// preserve it, content alone misses same-byte swaps across paths. cheap: the
+// file is tiny and its path is already resolved by the caller.
+function getBabelConfigIdentity(configPath?: string | null): string | null {
+  if (!configPath) return null
+  try {
+    const mtime = statSync(configPath).mtimeMs
+    const hash = createHash('sha1')
+      .update(readFileSync(configPath))
+      .digest('hex')
+      .slice(0, 16)
+    return `${configPath}:${mtime}:${hash}`
+  } catch {
+    // deleted or unreadable between resolve and hash: the path alone still
+    // distinguishes this entry from the no-config one.
+    return configPath
+  }
+}
+
+function getCacheKey(
+  filePath: string,
+  environment: string,
+  userBabelConfigPath?: string | null
+): string {
   const hash = createHash('sha1')
-    .update(`${environment}:${filePath}:${getConfigFingerprint()}`)
+    .update(`${environment}:${filePath}:${getConfigFingerprint(userBabelConfigPath)}`)
     .digest('hex')
   return hash
 }
@@ -83,13 +111,14 @@ function getContentHash(code: string): string {
 export function getCachedTransform(
   filePath: string,
   code: string,
-  environment: string
+  environment: string,
+  userBabelConfigPath?: string | null
 ): { code: string; map?: any } | null {
   try {
     // Strip leading null byte (Vite virtual module prefix) if present
     const cleanPath = filePath.startsWith('\0') ? filePath.slice(1) : filePath
     const cacheDir = getCacheDir()
-    const cacheKey = getCacheKey(cleanPath, environment)
+    const cacheKey = getCacheKey(cleanPath, environment, userBabelConfigPath)
     const cachePath = join(cacheDir, `${cacheKey}.json`)
 
     if (!existsSync(cachePath)) {
@@ -126,13 +155,14 @@ export function setCachedTransform(
   filePath: string,
   code: string,
   result: { code: string; map?: any },
-  environment: string
+  environment: string,
+  userBabelConfigPath?: string | null
 ): void {
   try {
     // Strip leading null byte (Vite virtual module prefix) if present
     const cleanPath = filePath.startsWith('\0') ? filePath.slice(1) : filePath
     const cacheDir = getCacheDir()
-    const cacheKey = getCacheKey(cleanPath, environment)
+    const cacheKey = getCacheKey(cleanPath, environment, userBabelConfigPath)
     const cachePath = join(cacheDir, `${cacheKey}.json`)
 
     const mtime = statSync(cleanPath).mtimeMs
```

**File**: `packages/compiler/src/index.ts` (modified, +7/-3)
```diff
@@ -172,8 +172,12 @@ async function performBabelTransform({
         (x) => Array.isArray(x) && x[0] === 'babel-plugin-react-compiler'
       )
 
-      // Check cache first
-      const cached = getCachedTransform(id, code, environment)
+      // Check cache first. the user babel config feeds the transform output,
+      // so its identity joins the key: adding or editing babel.config.* must
+      // miss entries cached without that change.
+      const userBabelConfigPath =
+        typeof babelOptions.configFile === 'string' ? babelOptions.configFile : null
+      const cached = getCachedTransform(id, code, environment, userBabelConfigPath)
       if (cached) {
         perfStats.babel.byEnvironment[environment].transforms++
         if (
@@ -322,7 +326,7 @@ async function performBabelTransform({
         const result = { code: outCode, map: babelOut.map }
 
         // Cache the result
-        setCachedTransform(id, code, result, environment)
+        setCachedTransform(id, code, result, environment, userBabelConfigPath)
 
         return result
       }
```

**File**: `packages/compiler/src/transformBabel.test.ts` (modified, +140/-0)
```diff
@@ -456,3 +456,143 @@ describe('findUserBabelConfig and user Babel config respect', () => {
   })
 })
 
+describe('explicit swc/oxc per-file choice with a user babel config', () => {
+  it('returns null for swc/oxc string and object forms', () => {
+    const projectRoot = fs.realpathSync(
+      fs.mkdtempSync(path.join(os.tmpdir(), 'vxrn-babel-conf-'))
+    )
+    const userConfig = path.join(projectRoot, 'babel.config.js')
+    fs.writeFileSync(userConfig, 'module.exports = { plugins: [] }')
+    try {
+      const base = {
+        id: path.join(projectRoot, 'src', 'index.tsx'),
+        code: `export const x = 1`,
+        projectRoot,
+        development: true,
+        environment: 'client' as const,
+        reactForRNVersion: '19' as const,
+      }
+      // merely adding babel.config.js must not flip an explicit non-babel choice
+      expect(getBabelOptions({ ...base, userSetting: 'swc' })).toBeNull()
+      expect(getBabelOptions({ ...base, userSetting: 'oxc' })).toBeNull()
+      expect(getBabelOptions({ ...base, userSetting: { transform: 'swc' } })).toBeNull()
+      expect(getBabelOptions({ ...base, userSetting: { transform: 'oxc' } })).toBeNull()
+      // controls: babel choices still resolve through the user config
+      expect(getBabelOptions({ ...base, userSetting: 'babel' })?.configFile).toBe(
+        userConfig
+      )
+      expect(
+        getBabelOptions({ ...base, userSetting: { transform: 'babel' } })?.configFile
+      ).toBe(userConfig)
+      expect(getBabelOptions(base)?.configFile).toBe(userConfig)
+    } finally {
+      fs.rmSync(projectRoot, { recursive: true, force: true })
+    }
+  })
+
+  it('skips the transform end-to-end for object-form swc', async () => {
+    const { createVXRNCompilerPlugin } = await import('./index')
+    const projectRoot = fs.realpathSync(
+      fs.mkdtempSync(path.join(os.tmpdir(), 'vxrn-babel-conf-'))
+    )
+    const srcDir = path.join(projectRoot, 'src')
+    fs.mkdirSync(srcDir, { recursive: true })
+    const file = path.join(srcDir, 'index.ts')
+    const code = `export const x = 1`
+    fs.writeFileSync(file, code)
+    fs.writeFileSync(
+      path.join(projectRoot, 'babel.config.js'),
+      'module.exports = { plugins: [] }'
+    )
+    configureVXRNCompilerPlugin({ enableCompiler: false, enableReanimated: false })
+    try {
+      const plugins = await createVXRNCompilerPlugin({
+        transform: () => ({ transform: 'swc' }) as any,
+      })
+      const plugin = plugins.find((p: any) => p.name === 'one:compiler') as any
+      await plugin.configResolved({ root: projectRoot, build: {} })
+      const hook = plugin.transform.handler || plugin.transform
+      const result = await hook.call({ environment: { name: 'client' } }, code, file)
+      expect(result == null).toBe(true)
+    } finally {
+      configureVXRNCompilerPlugin({ enableCompiler: false, enableReanimated: false })
+      fs.rmSync(projectRoot, { recursive: true, force: true })
+    }
+  })
+})
+
+describe('user babel config end-to-end through the compiler plugin', () => {
+  it('runs the user config when default plugins are empty', async () => {
+    const { createVXRNCompilerPlugin } = await import('./index')
+    const projectRoot = fs.realpathSync(
+      fs.mkdtempSync(path.join(os.tmpdir(), 'vxrn-babel-e2e-'))
+    )
+    const srcDir = path.join(projectRoot, 'src')
+    fs.mkdirSync(srcDir, { recursive: true })
+    const file = path.join(srcDir, 'index.ts')
+    const marker = 'babel-e2e-probe'
+    const code = `/* ${marker} */ export const x = 1`
+    fs.writeFileSync(file, code)
+    fs.writeFileSync(
+      path.join(projectRoot, 'babel.config.json'),
+      JSON.stringify({ comments: false })
+    )
+    configureVXRNCompilerPlugin({ enableCompiler: false, enableReanimated: false })
+    try {
+      const plugins = await createVXRNCompilerPlugin()
+      const plugin = plugins.find((p: any) => p.name === 'one:compiler') as any
+      await plugin.configResolved({ root: projectRoot, build: {} })
+      const hook = plugin.transform.handler || plugin.transform
+      const result = await hook.call({ environment: { name: 'client' } }, code, file)
+      // default plugins are empty here, but the user configFile must still
+      // route through transformBabel instead of taking the skip fast-path
+      expect(result).toBeDefined()
+      expect(result.code).toContain('export const x = 1')
+      expect(result.code).not.toContain(marker)
+    } finally {
+      configureVXRNCompilerPlugin({ enableCompiler: false, enableReanimated: false })
+      fs.rmSync(projectRoot, { recursive: true, force: true })
+    }
+  })
+
+  it('invalidates the cache when the user babel config is added or edited', async () => {
+    const { createVXRNCompilerPlugin } = await import('./index')
+    const projectRoot = fs.realpathSync(
+      fs.mkdtempSync(path.join(os.tmpdir(), 'vxrn-babel-cache-'))
+    )
+    const srcDir = path.join(projectRoot, 'src')
+    fs.mkd
```

**File**: `packages/compiler/src/transformBabel.ts` (modified, +13/-0)
```diff
@@ -75,6 +75,19 @@ export function getBabelOptions(props: Props): babel.TransformOptions | null {
     }
     return getOptions(props, false, userBabelConfig)
   }
+  // an explicit per-file opt-out of babel survives a user config. without
+  // this, merely adding babel.config.js flips swc/oxc files to babel.
+  const userSetting = props.userSetting
+  if (
+    userSetting === 'swc' ||
+    userSetting === 'oxc' ||
+    userSetting === false ||
+    (typeof userSetting === 'object' &&
+      userSetting !== null &&
+      (userSetting.transform === 'swc' || userSetting.transform === 'oxc'))
+  ) {
+    return null
+  }
   if (userBabelConfig) {
     return getOptions(props, false, userBabelConfig)
   }
```

**File**: `packages/compiler/types/cache.d.ts` (modified, +2/-2)
```diff
@@ -4,14 +4,14 @@ interface CacheStats {
     writes: 0;
     errors: 0;
 }
-export declare function getCachedTransform(filePath: string, code: string, environment: string): {
+export declare function getCachedTransform(filePath: string, code: string, environment: string, userBabelConfigPath?: string | null): {
     code: string;
     map?: any;
 } | null;
 export declare function setCachedTransform(filePath: string, code: string, result: {
     code: string;
     map?: any;
-}, environment: string): void;
+}, environment: string, userBabelConfigPath?: string | null): void;
 /** Drop every cached transform, for `react-native bundle --reset-cache`. */
 export declare function clearTransformCache(): void;
 export declare function getCacheStats(): CacheStats;
```

**File**: `packages/vite-plugin-metro/src/metro-config/getMetroConfigFromViteConfig.ts` (modified, +43/-30)
```diff
@@ -81,6 +81,47 @@ async function isWatchmanResponsive(projectRoot: string) {
   return probe
 }
 
+/**
+ * Decides whether Metro runs the native worker or the babel transformer.
+ * No babel by default: the worker throws on a babel plugin it has no port
+ * for, so opting back in is explicit rather than something you drift into.
+ * When a user adds a custom babel config, respect it rather than forcing
+ * native transforms, unless explicitly overridden. Shared by both config
+ * builders so the two never drift apart.
+ */
+function resolveNativeTransforms(
+  projectRoot: string,
+  metroPluginOptions: MetroPluginOptions
+): { isNativeTransforms: boolean; userBabelConfigPath: string | null } {
+  const userBabelConfigPath = projectRoot ? findUserBabelConfig(projectRoot) : null
+  const hasUserBabelConfig = Boolean(userBabelConfigPath)
+
+  const isNativeTransforms =
+    process.env.ONE_METRO_NATIVE_TRANSFORMS === '0'
+      ? false
+      : process.env.ONE_METRO_NATIVE_TRANSFORMS === '1'
+        ? true
+        : metroPluginOptions.nativeTransforms === false
+          ? false
+          : metroPluginOptions.nativeTransforms === true
+            ? true
+            : hasUserBabelConfig
+              ? false
+              : true
+
+  // the native worker runs no babel at all, so reaching it here means an
+  // explicit override is about to silently drop the user's plugins. name the
+  // ignored file rather than swallowing it.
+  if (userBabelConfigPath && isNativeTransforms) {
+    console.warn(
+      `[vxrn/metro] Ignoring user babel config at ${userBabelConfigPath} because native transforms are explicitly enabled (nativeTransforms: true or ONE_METRO_NATIVE_TRANSFORMS=1). ` +
+        `Port its plugins to nativeTransformModules, or set nativeTransforms: false (or ONE_METRO_NATIVE_TRANSFORMS=0) to use the babel transformer.`
+    )
+  }
+
+  return { isNativeTransforms, userBabelConfigPath }
+}
+
 /**
  * Build the Metro config input WITHOUT calling Metro's `loadConfig`. Returns
  * the same shape Metro `loadConfig` expects as its second argument. Use this
@@ -175,21 +216,7 @@ export async function buildMetroConfigInputFromViteConfig(
   // no babel by default. the worker throws on a babel plugin it has no port
   // for, so opting back in is explicit rather than something you drift into.
   // When a user adds a custom babel config, respect it rather than forcing native transforms.
-  const hasUserBabelConfig =
-    Boolean(projectRoot) && Boolean(findUserBabelConfig(projectRoot))
-
-  const isNativeTransforms =
-    process.env.ONE_METRO_NATIVE_TRANSFORMS === '0'
-      ? false
-      : process.env.ONE_METRO_NATIVE_TRANSFORMS === '1'
-        ? true
-        : metroPluginOptions.nativeTransforms === false
-          ? false
-          : metroPluginOptions.nativeTransforms === true
-            ? true
-            : hasUserBabelConfig
-              ? false
-              : true
+  const { isNativeTransforms } = resolveNativeTransforms(projectRoot, metroPluginOptions)
 
   let nativeWorkerPath: string | undefined
   if (isNativeTransforms) {
@@ -363,21 +390,7 @@ export async function getMetroConfigFromViteConfig(
   // no babel by default. the worker throws on a babel plugin it has no port
   // for, so opting back in is explicit rather than something you drift into.
   // When a user adds a custom babel config, respect it rather than forcing native transforms.
-  const hasUserBabelConfig =
-    Boolean(projectRoot) && Boolean(findUserBabelConfig(projectRoot))
-
-  const isNativeTransforms =
-    process.env.ONE_METRO_NATIVE_TRANSFORMS === '0'
-      ? false
-      : process.env.ONE_METRO_NATIVE_TRANSFORMS === '1'
-        ? true
-        : metroPluginOptions.nativeTransforms === false
-          ? false
-          : metroPluginOptions.nativeTransforms === true
-            ? true
-            : hasUserBabelConfig
-              ? false
-              : true
+  const { isNativeTransforms } = resolveNativeTransforms(projectRoot, metroPluginOptions)
 
   let nativeWorkerPath: string | undefined
   if (isNativeTransforms) {
```

**File**: `packages/vite-plugin-metro/src/transformer/loadBabelConfig.ts` (modified, +2/-0)
```diff
@@ -31,9 +31,11 @@ export const loadBabelConfig = (() => {
       const possibleBabelRCPaths = [
         '.babelrc',
         '.babelrc.js',
+        '.babelrc.json',
         'babel.config.js',
         'babel.config.cjs',
         'babel.config.mjs',
+        'babel.config.json',
       ]
 
       const foundBabelRCPath = possibleBabelRCPaths.find((configFileName) =>
```

**File**: `packages/vite-plugin-metro/src/transformer/metroNativeWorker.test.ts` (modified, +154/-1)
```diff
@@ -19,7 +19,10 @@ import {
   applyEnvironmentGuard,
   getRemoveServerCodeRouterRoot,
 } from './metroNativeWorker'
-import { buildMetroConfigInputFromViteConfig } from '../metro-config/getMetroConfigFromViteConfig'
+import {
+  buildMetroConfigInputFromViteConfig,
+  getMetroConfigFromViteConfig,
+} from '../metro-config/getMetroConfigFromViteConfig'
 
 const babelCalls = {
   transform: 0,
@@ -533,6 +536,117 @@ describe('metroNativeWorker', () => {
     }
   })
 
+  it('warns naming the ignored user babel config when native transforms are forced', async () => {
+    const tempDir = fs.realpathSync(
+      fs.mkdtempSync(path.join(process.cwd(), '.tmp-metro-test-'))
+    )
+    fs.writeFileSync(path.join(tempDir, 'package.json'), '{}')
+    const babelConfigPath = path.join(tempDir, 'babel.config.js')
+    fs.writeFileSync(babelConfigPath, 'module.exports = { plugins: [] }')
+    try {
+      delete process.env.ONE_METRO_NATIVE_TRANSFORMS
+      const mockViteConfig = { root: tempDir } as any
+      const warnsWithConfig = (spy: any) =>
+        spy.mock.calls.some((args: any[]) =>
+          args.join(' ').includes(babelConfigPath)
+        )
+
+      // explicit option force still uses the worker, but names the dropped config
+      const optionWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
+      try {
+        const forced = await buildMetroConfigInputFromViteConfig(mockViteConfig, {
+          nativeTransforms: true,
+        })
+        expect(forced.defaultConfig.transformerPath).toContain('metroNativeWorker')
+        expect(warnsWithConfig(optionWarn)).toBe(true)
+      } finally {
+        optionWarn.mockRestore()
+      }
+
+      // env var force warns the same way
+      const envWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
+      try {
+        process.env.ONE_METRO_NATIVE_TRANSFORMS = '1'
+        const envForced = await buildMetroConfigInputFromViteConfig(mockViteConfig, {})
+        expect(envForced.defaultConfig.transformerPath).toContain('metroNativeWorker')
+        expect(warnsWithConfig(envWarn)).toBe(true)
+      } finally {
+        envWarn.mockRestore()
+        delete process.env.ONE_METRO_NATIVE_TRANSFORMS
+      }
+
+      // default (no force) respects the config silently: babel fallback, no warning
+      const respectedWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
+      try {
+        const respected = await buildMetroConfigInputFromViteConfig(mockViteConfig, {})
+        expect(respected.defaultConfig.transformerPath).not.toContain(
+          'metroNativeWorker'
+        )
+        expect(warnsWithConfig(respectedWarn)).toBe(false)
+      } finally {
+        respectedWarn.mockRestore()
+      }
+    } finally {
+      delete process.env.ONE_METRO_NATIVE_TRANSFORMS
+      fs.rmSync(tempDir, { recursive: true, force: true })
+    }
+  })
+
+  it('selects the same transformer in both metro config builders', async () => {
+    const tempDir = fs.realpathSync(
+      fs.mkdtempSync(path.join(process.cwd(), '.tmp-metro-test-'))
+    )
+    fs.writeFileSync(path.join(tempDir, 'package.json'), '{}')
+    try {
+      delete process.env.ONE_METRO_NATIVE_TRANSFORMS
+      const mockViteConfig = { root: tempDir } as any
+
+      // no user config: both builders default to the native worker
+      const nativeInput = await buildMetroConfigInputFromViteConfig(mockViteConfig, {})
+      const nativeFull = await getMetroConfigFromViteConfig(mockViteConfig, {})
+      expect(nativeInput.defaultConfig.transformerPath).toContain('metroNativeWorker')
+      expect((nativeFull as any).transformerPath).toContain('metroNativeWorker')
+
+      // user config: both builders fall back to the babel transformer
+      const babelConfigPath = path.join(tempDir, 'babel.config.js')
+      fs.writeFileSync(babelConfigPath, 'module.exports = { plugins: [] }')
+      const fallbackInput = await buildMetroConfigInputFromViteConfig(
+        mockViteConfig,
+        {}
+      )
+      const fallbackFull = await getMetroConfigFromViteConfig(mockViteConfig, {})
+      expect(fallbackInput.defaultConfig.transformerPath).not.toContain(
+        'metroNativeWorker'
+      )
+      expect((fallbackFull as any).transformerPath).not.toContain('metroNativeWorker')
+
+      // forced with a user config: both builders warn naming the ignored file
+      const forcedWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
+      try {
+        const forcedInput = await buildMetroConfigInputFromViteConfig(mockViteConfig, {
+          nativeTransforms: true,
+        })
+        const forcedFull = await getMetroConfigFromViteConfig(mockViteConfig, {
+          nativeTransforms: true,
+        })
+        expect(forcedInput.defaultConfig.transformerPath).toContain(
+          'metroNativeWorker'
+        )
+        expect((forcedFull as any).transformerPath).toContain('metroNativeWorker')
+        expect(
+          forcedWarn.mock.calls.some((args: any[]) =>
+      
```

#### Recent Merged Pull Requests:
- **PR #793** (2026-09-22): validate: apple-file (@natew)
- **PR #792** (2026-09-22): validate: image picker (@natew)
- **PR #791** (2026-09-21): validate: UIScene template + haptics, crypto, app info (@natew)
- **PR #787** (2026-09-14): ci: allow authorized forced releases (@natew)
- **PR #786** (2026-09-14): v1.27.0 (@natew)
- **PR #785** (2026-09-14): fix(test): keep CI iOS simulator headless (@natew)
- **PR #784** (2026-09-21): docs: allow branch beta releases (@natew)
- **PR #783** (2026-09-13): ci: enable automatic V2 beta releases (@natew)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
