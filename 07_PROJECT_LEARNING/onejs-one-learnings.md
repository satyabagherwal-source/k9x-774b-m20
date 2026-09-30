# Forensic Learning Record (Deep Inspection): onejs/one

> **Canonical Artifact**: `07_PROJECT_LEARNING/onejs-one-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/onejs/one](https://github.com/onejs/one))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:16:55.558Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `onejs/one`
- **Description**: ❶ One lets you target React web and React Native with a single Vite plugin. Everything you need to build great websites and apps with unified routing.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 4490 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/ios-simulator-skill/scripts/accessibility_audit.py`
```
#!/usr/bin/env python3
"""
iOS Simulator Accessibility Audit

Scans the current simulator screen for accessibility compliance issues.
Optimized for minimal token output while maintaining functionality.

Usage: python scripts/accessibility_audit.py [options]
"""

import argparse
import json
import subprocess
import sys
from dataclasses import asdict, dataclass
from typing import Any

from common import flatten_tree, get_accessibility_tree, resolve_udid


@dataclass
class Issue:
    """Represents an accessibility issue."""

    severity: str  # critical, warning, info
    rule: str
    element_type: str
    issue: str
    fix: str

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


class AccessibilityAuditor:
    """Performs accessibility audits on iOS simulator screens."""

    # Critical rules that block users
    CRITICAL_RULES = {
        "missing_label": lambda e: e.get("type") in ["Button", "Link"] and not e.get("AXLabel"),
        "empty_button": lambda e: e.get("type") == "Button"
        and not (e.get("AXLabel") or e.get("AXValue")),
        "image_no_alt": lambda e: e.get("type") == "Image" and not e.get("AXLabel"),
    }

    # Warnings that degrade UX
    WARNING_RULES = {
        "missing_hint": lambda e: e.get("type") in ["Slider", "TextField"] and not e.get("help"),
        "missing_traits": lambda e: e.get("type") and not e.get("traits"),
    }

    # Info level suggestions
    INFO_RULES = {
        "no_identifier": lambda e: not e.get("AXUniqueId"),
        "deep_nesting": lambda e: e.get("depth", 0) > 5,
    }

    def __init__(self, udid: str | None = None):
        """Initialize auditor with optional device UDID."""
        self.udid = udid

    def get_accessibility_tree(self) -> dict:
        """Fetch accessibility tree from simulator using shared utility."""
        return get_accessibility_tree(self.udid, nested=True)

    @staticmethod
    def _is_small_target(element: dict) -> bool:
        """Check if touch target is too small (< 44x44 points)."""
        frame = element.get("frame", {})
        width = frame.get("width", 0)
        height = frame.get("height", 0)
        return width < 44 or height < 44

    def _flatten_tree(self, node: dict, depth: int = 0) -> list[dict]:
        """Flatten nested accessibility tree for easier processing using shared utility."""
        return flatten_tree(node, depth)

    def audit_element(self, element: dict) -> list[Issue]:
        """Audit a single element for accessibility issues."""
        issues = []

        # Check critical rules
        for rule_name, rule_func in self.CRITICAL_RULES.items():
            if rule_func(element):
                issues.append(
                    Issue(
                        severity="critical",
                        rule=rule_name,
                        element_type=element.get("type", "Unknown"),
                        issue=self._get_issue_description(rule_name),
                        fix=self._get_fix_suggestion(rule_name),
                    )
                )

        # Check warnings (skip if critical issues found)
        if not issues:
            for rule_name, rule_func in self.WARNING_RULES.items():
                if rule_func(element):
                    issues.append(
                        Issue(
                            severity="warning",
                            rule=rule_name,
                            element_type=element.get("type", "Unknown"),
                            issue=self._get_issue_description(rule_name),
                            fix=self._get_fix_suggestion(rule_name),
                        )
                    )

        # Check info level (only if verbose or no other issues)
        if not issues:
            for rule_name, rule_func in self.INFO_RULES.items():
                if rule_func(element):
                    issues.append(
                        Issue(
                            severity="info",
                            rule=rule_name,
                            element_type=element.get("type", "Unknown"),
                            issue=self._get_issue_description(rule_name),
                            fix=self._get_fix_suggestion(rule_name),
                        )
                    )

        return issues

    def _get_issue_description(self, rule: str) -> str:
        """Get human-readable issue description."""
        descriptions = {
            "missing_label": "Interactive element missing accessibility label",
            "empty_button": "Button has no text or label",
            "image_no_alt": "Image missing alternative text",
            "missing_hint": "Complex control missing hint",
            "small_touch_target": "Touch target smaller than 44x44pt",
            "missing_traits": "Element missing accessibility traits",
            "no_identifier": "Missing accessibility identifier",
            "deep_nesting": "Deeply nested (>5 levels)",
        }
        return descriptions.get(rule, "Accessibility issue")

    def _get_fix_suggestion(self, rule: str) -> str:
        """Get fix suggestion for issue."""
        fixes = {
            "missing_label": "Add accessibilityLabel",
            "empty_button": "Set button title or accessibilityLabel",
            "image_no_alt": "Add accessibilityLabel with description",
            "missing_hint": "Add accessibilityHint",
            "small_touch_target": "Increase to minimum 44x44pt",
            "missing_traits": "Set appropriate accessibilityTraits",
            "no_identifier": "Add accessibilityIdentifier for testing",
            "deep_nesting": "Simplify view hierarchy",
        }
        return fixes.get(rule, "Review accessibility")

    def audit(self, verbose: bool = False) -> dict[str, Any]:
        """Perform full accessibility audit."""
        # Get accessibility tree
        tree = self.get_accessibility_tree()

        # Flatten for processing
        elements = self._flatten_tree(tree)

        # Audit each element
        all_issues = []
        for element in elements:
            issues = self.audit_element(element)
            for issue in issues:
                issue_dict = issue.to_dict()
                # Add minimal element info for context
                issue_dict["element"] = {
                    "type": element.get("type", "Unknown"),
                    "label": element.get("AXLabel", "")[:30] if element.get("AXLabel") else None,
                }
                all_issues.append(issue_dict)

        # Count by severity
        critical = len([i for i in all_issues if i["severity"] == "critical"])
        warning = len([i for i in all_issues if i["severity"] == "warning"])
        info = len([i for i in all_issues if i["severity"] == "info"])

        # Build result (token-optimized)
        result = {
            "summary": {
                "total": len(elements),
                "issues": len(all_issues),
                "critical": critical,
                "warning": warning,
                "info": info,
            }
        }

        if verbose:
            # Full details only if requested
            result["issues"] = all_issues
        else:
            # Default: top issues only (token-efficient)
            result["top_issues"] = self._get_top_issues(all_issues)

        return result

    def _get_top_issues(self, issues: list[dict]) -> list[dict]:
        """Get top 3 issues grouped by type (token-efficient)."""
        if not issues:
            return []

        # Group by rule
        grouped = {}
        for issue in issues:
            rule = issue["rule"]
            if rule not in grouped:
                grouped[rule] = {
                    "severity": issue["severity"],
                    "rule": rule,
                    "count": 0,
                    "fix": issue["fix"],
                }
            grouped[rule]["count"] += 1

        # Sort by severity and coun
```

### Core Architecture Module: `.claude/skills/ios-simulator-skill/scripts/app_launcher.py`
```
#!/usr/bin/env python3
"""
iOS App Launcher - App Lifecycle Control

Launches, terminates, and manages iOS apps in the simulator.
Handles deep links and app switching.

Usage: python scripts/app_launcher.py --launch com.example.app
"""

import argparse
import contextlib
import subprocess
import sys
import time

from common import build_simctl_command, resolve_udid


class AppLauncher:
    """Controls app lifecycle on iOS simulator."""

    def __init__(self, udid: str | None = None):
        """Initialize app launcher."""
        self.udid = udid

    def launch(self, bundle_id: str, wait_for_debugger: bool = False) -> tuple[bool, int | None]:
        """
        Launch an app.

        Args:
            bundle_id: App bundle identifier
            wait_for_debugger: Wait for debugger attachment

        Returns:
            (success, pid) tuple
        """
        cmd = build_simctl_command("launch", self.udid, bundle_id)

        if wait_for_debugger:
            cmd.insert(3, "--wait-for-debugger")  # Insert after "launch" operation

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            # Parse PID from output if available
            pid = None
            if result.stdout:
                # Output format: "com.example.app: <PID>"
                parts = result.stdout.strip().split(":")
                if len(parts) > 1:
                    with contextlib.suppress(ValueError):
                        pid = int(parts[1].strip())
            return (True, pid)
        except subprocess.CalledProcessError:
            return (False, None)

    def terminate(self, bundle_id: str) -> bool:
        """
        Terminate an app.

        Args:
            bundle_id: App bundle identifier

        Returns:
            Success status
        """
        cmd = build_simctl_command("terminate", self.udid, bundle_id)

        try:
            subprocess.run(cmd, capture_output=True, check=True)
            return True
        except subprocess.CalledProcessError:
            return False

    def install(self, app_path: str) -> bool:
        """
        Install an app.

        Args:
            app_path: Path to .app bundle

        Returns:
            Success status
        """
        cmd = build_simctl_command("install", self.udid, app_path)

        try:
            subprocess.run(cmd, capture_output=True, check=True)
            return True
        except subprocess.CalledProcessError:
            return False

    def uninstall(self, bundle_id: str) -> bool:
        """
        Uninstall an app.

        Args:
            bundle_id: App bundle identifier

        Returns:
            Success status
        """
        cmd = build_simctl_command("uninstall", self.udid, bundle_id)

        try:
            subprocess.run(cmd, capture_output=True, check=True)
            return True
        except subprocess.CalledProcessError:
            return False

    def open_url(self, url: str) -> bool:
        """
        Open URL (for deep linking).

        Args:
            url: URL to open (http://, myapp://, etc.)

        Returns:
            Success status
        """
        cmd = build_simctl_command("openurl", self.udid, url)

        try:
            subprocess.run(cmd, capture_output=True, check=True)
            return True
        except subprocess.CalledProcessError:
            return False

    def list_apps(self) -> list[dict[str, str]]:
        """
        List installed apps.

        Returns:
            List of app info dictionaries
        """
        cmd = build_simctl_command("listapps", self.udid)

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)

            # Parse plist output using plutil to convert to JSON
            plist_data = result.stdout

            # Use plutil to convert plist to JSON
            convert_cmd = ["plutil", "-convert", "json", "-o", "-", "-"]
            convert_result = subprocess.run(
                convert_cmd, check=False, input=plist_data, capture_output=True, text=True
            )

            apps = []
            if convert_result.returncode == 0:
                import json

                try:
                    data = json.loads(convert_result.stdout)
                    for bundle_id, app_info in data.items():
                        # Skip system internal apps that are hidden
                        if app_info.get("ApplicationType") == "Hidden":
                            continue

                        apps.append(
                            {
                                "bundle_id": bundle_id,
                                "name": app_info.get(
                                    "CFBundleDisplayName", app_info.get("CFBundleName", bundle_id)
                                ),
                                "path": app_info.get("Path", ""),
                                "version": app_info.get("CFBundleVersion", "Unknown"),
                                "type": app_info.get("ApplicationType", "User"),
                            }
                        )
                except json.JSONDecodeError:
                    pass

            return apps
        except subprocess.CalledProcessError:
            return []

    def get_app_state(self, bundle_id: str) -> str:
        """
        Get app state (running, suspended, etc.).

        Args:
            bundle_id: App bundle identifier

        Returns:
            State string or 'unknown'
        """
        # Check if app is running by trying to get its PID
        cmd = build_simctl_command("spawn", self.udid, "launchctl", "list")

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            if bundle_id in result.stdout:
                return "running"
            return "not running"
        except subprocess.CalledProcessError:
            return "unknown"

    def restart_app(self, bundle_id: str, delay: float = 1.0) -> bool:
        """
        Restart an app (terminate then launch).

        Args:
            bundle_id: App bundle identifier
            delay: Delay between terminate and launch

        Returns:
            Success status
        """
        # Terminate
        self.terminate(bundle_id)
        time.sleep(delay)

        # Launch
        success, _ = self.launch(bundle_id)
        return success


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Control iOS app lifecycle")

    # Actions
    parser.add_argument("--launch", help="Launch app by bundle ID")
    parser.add_argument("--terminate", help="Terminate app by bundle ID")
    parser.add_argument("--restart", help="Restart app by bundle ID")
    parser.add_argument("--install", help="Install app from .app path")
    parser.add_argument("--uninstall", help="Uninstall app by bundle ID")
    parser.add_argument("--open-url", help="Open URL (deep link)")
    parser.add_argument("--list", action="store_true", help="List installed apps")
    parser.add_argument("--state", help="Get app state by bundle ID")

    # Options
    parser.add_argument(
        "--wait-for-debugger", action="store_true", help="Wait for debugger when launching"
    )
    parser.add_argument(
        "--udid",
        help="Device UDID (auto-detects booted simulator if not provided)",
    )

    args = parser.parse_args()

    # Resolve UDID with auto-detection
    try:
        udid = resolve_udid(args.udid)
    except RuntimeError as e:
        print(f"Error: {e}")
        sys.exit(1)

    launcher = AppLauncher(udid=udid)

    # Execute requested action
    if args.launch:
        success, pid = launcher.launch(args.launch, args.wait_for_debugger)
        if success:
            if pid:
                print(f"Launched {args.launch} (PID: {pid})")
            else:
                print(f"Launched {args.launch}")
        else:
            print(f"Failed to launch {args.launch
```

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
                log_info = self.capture_logs(l
```

### Core Architecture Module: `.claude/skills/ios-simulator-skill/scripts/clipboard.py`
```
#!/usr/bin/env python3
"""
iOS Simulator Clipboard Manager

Copy text to simulator clipboard for testing paste flows.
Optimized for minimal token output.

Usage: python scripts/clipboard.py --copy "text to copy"
"""

import argparse
import subprocess
import sys

from common import resolve_udid


class ClipboardManager:
    """Manages clipboard operations on iOS simulator."""

    def __init__(self, udid: str | None = None):
        """Initialize clipboard manager.

        Args:
            udid: Optional device UDID (auto-detects booted simulator if None)
        """
        self.udid = udid

    def copy(self, text: str) -> bool:
        """
        Copy text to simulator clipboard.

        Args:
            text: Text to copy to clipboard

        Returns:
            Success status
        """
        cmd = ["xcrun", "simctl", "pbcopy"]

        if self.udid:
            cmd.append(self.udid)
        else:
            cmd.append("booted")

        cmd.append(text)

        try:
            subprocess.run(cmd, capture_output=True, check=True)
            return True
        except subprocess.CalledProcessError:
            return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Copy text to iOS simulator clipboard")
    parser.add_argument("--copy", required=True, help="Text to copy to clipboard")
    parser.add_argument(
        "--udid",
        help="Device UDID (auto-detects booted simulator if not provided)",
    )
    parser.add_argument("--test-name", help="Test scenario name for tracking")
    parser.add_argument("--expected", help="Expected behavior after paste")

    args = parser.parse_args()

    # Resolve UDID with auto-detection
    try:
        udid = resolve_udid(args.udid)
    except RuntimeError as e:
        print(f"Error: {e}")
        sys.exit(1)

    # Create manager and copy text
    manager = ClipboardManager(udid=udid)

    if manager.copy(args.copy):
        # Token-efficient output
        output = f'Copied: "{args.copy}"'

        if args.test_name:
            output += f" (test: {args.test_name})"

        print(output)

        # Provide usage guidance
        if args.expected:
            print(f"Expected: {args.expected}")

        print()
        print("Next steps:")
        print("1. Tap text field with: python scripts/navigator.py --find-type TextField --tap")
        print("2. Paste with: python scripts/keyboard.py --key return")
        print("   Or use Cmd+V gesture with: python scripts/keyboard.py --key cmd+v")

    else:
        print("Failed to copy text to clipboard")
        sys.exit(1)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.claude/skills/ios-simulator-skill/scripts/common/__init__.py`
```
"""
Common utilities shared across iOS simulator scripts.

This module centralizes genuinely reused code patterns to eliminate duplication
while respecting Jackson's Law - no over-abstraction, only truly shared logic.

Organization:
- device_utils: Device detection, command building, coordinate transformation
- idb_utils: IDB-specific operations (accessibility tree, element manipulation)
- cache_utils: Progressive disclosure caching for large outputs
- screenshot_utils: Screenshot capture with file and inline modes
"""

from .cache_utils import ProgressiveCache, get_cache
from .device_utils import (
    build_idb_command,
    build_simctl_command,
    get_booted_device_udid,
    get_device_screen_size,
    resolve_udid,
    transform_screenshot_coords,
)
from .idb_utils import (
    count_elements,
    flatten_tree,
    get_accessibility_tree,
    get_screen_size,
)
from .screenshot_utils import (
    capture_screenshot,
    format_screenshot_result,
    generate_screenshot_name,
    get_size_preset,
    resize_screenshot,
)

__all__ = [
    # cache_utils
    "ProgressiveCache",
    # device_utils
    "build_idb_command",
    "build_simctl_command",
    # screenshot_utils
    "capture_screenshot",
    # idb_utils
    "count_elements",
    "flatten_tree",
    "format_screenshot_result",
    "generate_screenshot_name",
    "get_accessibility_tree",
    "get_booted_device_udid",
    "get_cache",
    "get_device_screen_size",
    "get_screen_size",
    "get_size_preset",
    "resize_screenshot",
    "resolve_udid",
    "transform_screenshot_coords",
]

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
        cache_dir: Custom cache directory (uses defaul
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
    # Handle "booted"
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
       ex
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
-    const env
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

### Incident Patch 9: `c412682c` (2026-09-14)
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

### Incident Patch 10: `43ff9eee` (2026-09-14)
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
+    e
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
